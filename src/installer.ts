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
import {IS_LINUX, IS_WINDOWS} from './utils';
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

  public async createDotNetVersion(): Promise<{
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
    let releasesInfo: any[] = result['releases-index'];

    let releaseInfo = releasesInfo.find(info => {
      let sdkParts: string[] = info['channel-version'].split('.');
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

  static DotNetCoreIndexUrl: string =
    'https://dotnetcli.azureedge.net/dotnet/release-metadata/releases-index.json';
}

export class DotnetCoreInstaller {
  private version: string;
  private quality: QualityOptions;

  static {
    const installationDirectoryWindows = path.join(
      process.env['PROGRAMFILES'] + '',
      'dotnet'
    );
    const installationDirectoryLinux = '/usr/share/dotnet';
    const installationDirectoryMac = path.join(
      process.env['HOME'] + '',
      '.dotnet'
    );
    const dotnetInstallDir: string | undefined =
      process.env['DOTNET_INSTALL_DIR'];
    if (dotnetInstallDir) {
      process.env['DOTNET_INSTALL_DIR'] =
        this.convertInstallPathToAbsolute(dotnetInstallDir);
    } else {
      if (IS_WINDOWS) {
        process.env['DOTNET_INSTALL_DIR'] = installationDirectoryWindows;
      } else {
        process.env['DOTNET_INSTALL_DIR'] = IS_LINUX
          ? installationDirectoryLinux
          : installationDirectoryMac;
      }
    }
  }

  constructor(version: string, quality: QualityOptions) {
    this.version = version;
    this.quality = quality;
  }

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

  static addToPath() {
    core.addPath(process.env['DOTNET_INSTALL_DIR']!);
    core.exportVariable('DOTNET_ROOT', process.env['DOTNET_INSTALL_DIR']);
  }

  private setQuality(
    dotnetVersion: DotnetVersion,
    scriptArguments: string[]
  ): void {
    const option = IS_WINDOWS ? '-Quality' : '--quality';
    if (dotnetVersion.qualityFlag) {
      scriptArguments.push(option, this.quality);
    } else {
      core.warning(
        `'dotnet-quality' input can be used only with .NET SDK version in A.B, A.B.x, A and A.x formats where the major tag is higher than 5. You specified: ${this.version}. 'dotnet-quality' input is ignored.`
      );
    }
  }

  public async installDotnet(): Promise<string> {
    const windowsDefaultOptions = [
      '-NoLogo',
      '-Sta',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Unrestricted',
      '-Command'
    ];
    const scriptName = IS_WINDOWS ? 'install-dotnet.ps1' : 'install-dotnet.sh';
    const escapedScript = path
      .join(__dirname, '..', 'externals', scriptName)
      .replace(/'/g, "''");
    let scriptArguments: string[];
    let scriptPath = '';

    const versionResolver = new DotnetVersionResolver(this.version);
    const dotnetVersion = await versionResolver.createDotNetVersion();

    if (IS_WINDOWS) {
      scriptArguments = ['&', `'${escapedScript}'`];

      if (dotnetVersion.type) {
        scriptArguments.push(dotnetVersion.type, dotnetVersion.value);
      }

      if (this.quality) {
        this.setQuality(dotnetVersion, scriptArguments);
      }

      if (process.env['https_proxy'] != null) {
        scriptArguments.push(`-ProxyAddress ${process.env['https_proxy']}`);
      }
      // This is not currently an option
      if (process.env['no_proxy'] != null) {
        scriptArguments.push(`-ProxyBypassList ${process.env['no_proxy']}`);
      }

      scriptPath =
        (await io.which('pwsh', false)) || (await io.which('powershell', true));
      scriptArguments = windowsDefaultOptions.concat(scriptArguments);
    } else {
      chmodSync(escapedScript, '777');
      scriptPath = await io.which(escapedScript, true);
      scriptArguments = [];

      if (dotnetVersion.type) {
        scriptArguments.push(dotnetVersion.type, dotnetVersion.value);
      }

      if (this.quality) {
        this.setQuality(dotnetVersion, scriptArguments);
      }
    }
    // process.env must be explicitly passed in for DOTNET_INSTALL_DIR to be used
    const getExecOutputOptions = {
      ignoreReturnCode: true,
      env: process.env as {string: string}
    };
    const {exitCode, stdout} = await exec.getExecOutput(
      `"${scriptPath}"`,
      scriptArguments,
      getExecOutputOptions
    );
    if (exitCode) {
      throw new Error(`Failed to install dotnet ${exitCode}. ${stdout}`);
    }

    return this.outputDotnetVersion(dotnetVersion.value);
  }

  private async outputDotnetVersion(version): Promise<string> {
    const installationPath = process.env['DOTNET_INSTALL_DIR']!;
    let versionsOnRunner: string[] = await readdir(
      path.join(installationPath.replace(/'/g, ''), 'sdk')
    );

    let installedVersion = semver.maxSatisfying(versionsOnRunner, version, {
      includePrerelease: true
    })!;

    return installedVersion;
  }
}
