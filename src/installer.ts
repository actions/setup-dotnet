// Load tempDirectory before it gets wiped by tool-cache
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as hc from '@actions/http-client';
import {chmodSync} from 'fs';
import {readdir} from 'fs/promises';
import path from 'path';
import os from 'os';
import semver from 'semver';
import {IS_WINDOWS, getPlatform} from './utils';
import {QualityOptions} from './setup-dotnet';

export interface DotnetVersion {
  type: string;
  value: string;
  qualityFlag: boolean;
}

export class DotnetVersionResolver {
  private inputVersion: string;
  private resolvedArgument: DotnetVersion;

  constructor(version: string) {
    this.inputVersion = version.trim();
    this.resolvedArgument = {type: '', value: '', qualityFlag: false};
  }

  private async resolveVersionInput(): Promise<void> {
    if (!semver.validRange(this.inputVersion)) {
      throw new Error(
        `'dotnet-version' was supplied in invalid format: ${this.inputVersion}! Supported syntax: A.B.C, A.B, A.B.x, A, A.x`
      );
    }
    if (semver.valid(this.inputVersion)) {
      this.resolvedArgument.type = 'version';
      this.resolvedArgument.value = this.inputVersion;
    } else {
      const [major, minor] = this.inputVersion.split('.');

      if (this.isNumericTag(major)) {
        this.resolvedArgument.type = 'channel';
        if (this.isNumericTag(minor)) {
          this.resolvedArgument.value = `${major}.${minor}`;
        } else {
          const httpClient = new hc.HttpClient('actions/setup-dotnet', [], {
            allowRetries: true,
            maxRetries: 3
          });
          this.resolvedArgument.value = await this.getLatestVersion(
            httpClient,
            [major, minor]
          );
        }
      }
      this.resolvedArgument.qualityFlag = +major >= 6 ? true : false;
    }
  }

  private isNumericTag(versionTag): boolean {
    return /^\d+$/.test(versionTag);
  }

  public async createDotnetVersion(): Promise<{
    type: string;
    value: string;
    qualityFlag: boolean;
  }> {
    await this.resolveVersionInput();
    if (!this.resolvedArgument.type) {
      return this.resolvedArgument;
    }
    if (IS_WINDOWS) {
      this.resolvedArgument.type =
        this.resolvedArgument.type === 'channel' ? '-Channel' : '-Version';
    } else {
      this.resolvedArgument.type =
        this.resolvedArgument.type === 'channel' ? '--channel' : '--version';
    }
    return this.resolvedArgument;
  }

  private async getLatestVersion(
    httpClient: hc.HttpClient,
    versionParts: string[]
  ): Promise<string> {
    const response = await httpClient.getJson<any>(
      DotnetVersionResolver.DotNetCoreIndexUrl
    );
    const result = response.result || {};
    const releasesInfo: any[] = result['releases-index'];

    const releaseInfo = releasesInfo.find(info => {
      const sdkParts: string[] = info['channel-version'].split('.');
      return sdkParts[0] === versionParts[0];
    });

    if (!releaseInfo) {
      throw new Error(
        `Could not find info for version ${versionParts.join('.')} at ${
          DotnetVersionResolver.DotNetCoreIndexUrl
        }`
      );
    }

    return releaseInfo['channel-version'];
  }

  static DotNetCoreIndexUrl =
    'https://dotnetcli.azureedge.net/dotnet/release-metadata/releases-index.json';
}

export class DotnetInstallScript {
  private scriptName = IS_WINDOWS ? 'install-dotnet.ps1' : 'install-dotnet.sh';
  private escapedScript: string;
  private scriptArguments: string[] = [];
  private scriptPath = '';
  private scriptReady: Promise<void>;

  constructor() {
    this.escapedScript = path
      .join(__dirname, '..', 'externals', this.scriptName)
      .replace(/'/g, "''");

    this.scriptReady = IS_WINDOWS
      ? this.setupScriptPowershell()
      : this.setupScriptBash();
  }

  private async setupScriptPowershell() {
    this.scriptArguments = [
      '-NoLogo',
      '-Sta',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Unrestricted',
      '-Command'
    ];

    this.scriptArguments.push('&', `'${this.escapedScript}'`);

    if (process.env['https_proxy'] != null) {
      this.scriptArguments.push(`-ProxyAddress ${process.env['https_proxy']}`);
    }
    // This is not currently an option
    if (process.env['no_proxy'] != null) {
      this.scriptArguments.push(`-ProxyBypassList ${process.env['no_proxy']}`);
    }

    this.scriptPath =
      (await io.which('pwsh', false)) || (await io.which('powershell', true));
  }

  private async setupScriptBash() {
    chmodSync(this.escapedScript, '777');

    this.scriptArguments = [];

    this.scriptPath = await io.which(this.escapedScript, true);
  }

  public useArguments(...args: string[]) {
    this.scriptArguments.push(...args);
    return this;
  }

  public useVersion(dotnetVersion: DotnetVersion, quality?: QualityOptions) {
    if (dotnetVersion.type) {
      this.useArguments(dotnetVersion.type, dotnetVersion.value);
    }

    if (quality && !dotnetVersion.qualityFlag) {
      core.warning(
        `'dotnet-quality' input can be used only with .NET SDK version in A.B, A.B.x, A and A.x formats where the major tag is higher than 5. You specified: ${dotnetVersion.value}. 'dotnet-quality' input is ignored.`
      );
      return this;
    }

    if (quality) {
      this.useArguments(IS_WINDOWS ? '-Quality' : '--quality', quality);
    }

    return this;
  }

  public async execute() {
    const getExecOutputOptions = {
      ignoreReturnCode: true,
      env: process.env as {string: string}
    };

    await this.scriptReady;

    return exec.getExecOutput(
      `"${this.scriptPath}"`,
      this.scriptArguments,
      getExecOutputOptions
    );
  }
}

export abstract class DotnetInstallDir {
  private static readonly default = {
    linux: '/usr/share/dotnet',
    mac: path.join(process.env['HOME'] + '', '.dotnet'),
    windows: path.join(process.env['PROGRAMFILES'] + '', 'dotnet')
  };

  public static readonly path = process.env['DOTNET_INSTALL_DIR']
    ? DotnetInstallDir.convertInstallPathToAbsolute(
        process.env['DOTNET_INSTALL_DIR']
      )
    : DotnetInstallDir.default[getPlatform()];

  private static convertInstallPathToAbsolute(installDir: string): string {
    let transformedPath;
    if (path.isAbsolute(installDir)) {
      transformedPath = installDir;
    } else {
      transformedPath = installDir.startsWith('~')
        ? path.join(os.homedir(), installDir.slice(1))
        : (transformedPath = path.join(process.cwd(), installDir));
    }
    return path.normalize(transformedPath);
  }

  public static addToPath() {
    core.addPath(process.env['DOTNET_INSTALL_DIR']!);
    core.exportVariable('DOTNET_ROOT', process.env['DOTNET_INSTALL_DIR']);
  }

  public static initialize() {
    process.env['DOTNET_INSTALL_DIR'] = DotnetInstallDir.path;
  }
}

export class DotnetCoreInstaller {
  static addToPath = DotnetInstallDir.addToPath;

  static {
    DotnetInstallDir.initialize();
  }

  constructor(private version: string, private quality: QualityOptions) {}

  public async installDotnet(): Promise<string> {
    const versionResolver = new DotnetVersionResolver(this.version);
    const dotnetVersion = await versionResolver.createDotnetVersion();

    const installScript = new DotnetInstallScript()
      .useArguments(
        IS_WINDOWS ? '-SkipNonVersionedFiles' : '--skip-non-versioned-files'
      )
      .useVersion(dotnetVersion, this.quality);

    const {exitCode, stderr} = await installScript.execute();

    if (exitCode) {
      throw new Error(
        `Failed to install dotnet, exit code: ${exitCode}. ${stderr}`
      );
    }

    return this.outputDotnetVersion(dotnetVersion.value);
  }

  private async outputDotnetVersion(version): Promise<string> {
    const installationPath = process.env['DOTNET_INSTALL_DIR']!;
    const versionsOnRunner: string[] = await readdir(
      path.join(installationPath.replace(/'/g, ''), 'sdk')
    );

    const installedVersion = semver.maxSatisfying(versionsOnRunner, version, {
      includePrerelease: true
    })!;

    return installedVersion;
  }
}
