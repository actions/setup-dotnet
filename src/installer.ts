// Load tempDirectory before it gets wiped by tool-cache
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import {chmodSync} from 'fs';
import path from 'path';
import semver from 'semver';
import {IS_LINUX, IS_WINDOWS, logWarning} from './utils';

interface IDotNetVersion {
  type: string;
  value: string;
  qualityFlag: boolean;
}

export class DotnetQualityValidator {
  private quality: string;
  private qualityOptions = ['daily', 'signed', 'validated', 'preview', 'ga'];

  constructor(quality: string) {
    this.quality = quality;
  }

  public validateQuality() {
    if (this.quality && !this.qualityOptions.includes(this.quality)) {
      throw new Error(
        `${this.quality} is not a supported value for 'dotnet-quality' option. Supported values are: daily, signed, validated, preview, ga.`
      );
    }
    return this.quality;
  }
}

class DotnetVersionResolver {
  private inputVersion: string;
  private resolvedArgument: IDotNetVersion;

  constructor(version: string) {
    this.inputVersion = version.trim();
    this.resolvedArgument = {type: '', value: '', qualityFlag: false};
  }

  private resolveVersionInput(): void {
    if (
      !semver.valid(this.inputVersion) &&
      !semver.validRange(this.inputVersion)
    ) {
      throw new Error(
        `'dotnet-version' was supplied in invalid format: ${this.inputVersion}! Supported syntax: A.B, A.B.C, A.B.C-D, A.B.x, A.B.X, A.B.*`
      );
    }
    if (semver.valid(this.inputVersion)) {
      this.resolvedArgument.type = 'version';
      this.resolvedArgument.value = this.inputVersion;
    } else {
      this.resolvedArgument.type = 'channel';
      this.resolvedArgument.qualityFlag = true;
      const coercedVersion = semver.coerce(this.inputVersion);
      this.resolvedArgument.value = `${coercedVersion?.major}.${coercedVersion?.minor}`;
    }
  }

  public createDotNetVersion(): {
    type: string;
    value: string;
    qualityFlag: boolean;
  } {
    this.resolveVersionInput();
    if (IS_WINDOWS) {
      this.resolvedArgument.type =
        this.resolvedArgument.type === 'channel' ? '-Channel' : '-Version';
    } else {
      this.resolvedArgument.type =
        this.resolvedArgument.type === 'channel' ? '--channel' : '--version';
    }
    return this.resolvedArgument;
  }
}

export class DotnetCoreInstaller {
  private version: string;
  private quality: string;
  private static readonly installationDirectoryWindows = path.join(
    process.env['PROGRAMFILES'] + '',
    'dotnet'
  );
  private static readonly installationDirectoryLinux = '/usr/share/dotnet';

  static addToPath() {
    if (process.env['DOTNET_INSTALL_DIR']) {
      core.addPath(process.env['DOTNET_INSTALL_DIR']);
      core.exportVariable('DOTNET_ROOT', process.env['DOTNET_INSTALL_DIR']);
    } else {
      if (IS_WINDOWS) {
        core.addPath(DotnetCoreInstaller.installationDirectoryWindows);
        core.exportVariable(
          'DOTNET_ROOT',
          DotnetCoreInstaller.installationDirectoryWindows
        );
      } else if (IS_LINUX) {
        core.addPath(DotnetCoreInstaller.installationDirectoryLinux);
        core.exportVariable(
          'DOTNET_ROOT',
          DotnetCoreInstaller.installationDirectoryLinux
        );
      } else {
        // This is the default set in install-dotnet.sh
        core.addPath(path.join(process.env['HOME'] + '', '.dotnet'));
        core.exportVariable(
          'DOTNET_ROOT',
          path.join(process.env['HOME'] + '', '.dotnet')
        );
      }
    }
  }

  constructor(version: string, quality: string) {
    this.version = version;
    this.quality = quality;
  }

  private setQuality(
    dotnetVersion: IDotNetVersion,
    scriptArguments: string[]
  ): void {
    const option = IS_WINDOWS ? '-Quality' : '--quality';
    if (dotnetVersion.qualityFlag) {
      scriptArguments.push(option, this.quality);
    } else {
      logWarning(
        `'dotnet-quality' input can't be used with exact version: ${dotnetVersion.value} of .NET. 'dotnet-quality' input is ignored.`
      );
    }
  }

  public async installDotnet() {
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
    const dotnetVersion = versionResolver.createDotNetVersion();

    const envVariables: {[key: string]: string} = {};
    for (let key in process.env) {
      if (process.env[key]) {
        let value: any = process.env[key];
        envVariables[key] = value;
      }
    }
    if (IS_WINDOWS) {
      scriptArguments = [
        '&',
        `'${escapedScript}'`,
        dotnetVersion.type,
        dotnetVersion.value
      ];

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

      scriptArguments.push(
        `-InstallDir '${DotnetCoreInstaller.installationDirectoryWindows}'`
      );
      // process.env must be explicitly passed in for DOTNET_INSTALL_DIR to be used
      scriptPath = await io.which('powershell', true);
      scriptArguments = [...windowsDefaultOptions, scriptArguments.join(' ')];
    } else {
      chmodSync(escapedScript, '777');
      scriptPath = await io.which(escapedScript, true);
      scriptArguments = [dotnetVersion.type, dotnetVersion.value];

      if (this.quality) {
        this.setQuality(dotnetVersion, scriptArguments);
      }

      if (IS_LINUX) {
        scriptArguments.push(
          '--install-dir',
          DotnetCoreInstaller.installationDirectoryLinux
        );
      }
    }
    const {exitCode, stdout} = await exec.getExecOutput(
      `"${scriptPath}"`,
      scriptArguments,
      {env: envVariables}
    );
    if (exitCode) {
      throw new Error(`Failed to install dotnet ${exitCode}. ${stdout}`);
    }
  }
}
