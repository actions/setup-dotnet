// Load tempDirectory before it gets wiped by tool-cache
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import hc = require('@actions/http-client');
import {chmodSync} from 'fs';
import * as path from 'path';
import semver from 'semver';
import {ExecOptions} from '@actions/exec/lib/interfaces';

const IS_WINDOWS = process.platform === 'win32';
const IS_LINUX = process.platform === 'linux';

export class DotnetQualityValidator {
  private quality: string;
  private qualityOptions: string[];

  constructor(quality: string) {
    this.quality = quality;
    this.qualityOptions = ['daily', 'signed', 'validated', 'preview', 'ga'];
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

export class DotnetVersionResolver {
  private inputVersion: string;
  private resolvedArgument: {type: string; value: string; qualityFlag: boolean};

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
      if (semver.validRange(this.inputVersion)) {
        let coercedVersion = semver.coerce(this.inputVersion);
        this.resolvedArgument.value = coercedVersion?.major + "." + coercedVersion?.minor;
      } else {
        this.resolvedArgument.value = this.inputVersion;
      }
    }
  }

  public createVersionObject(): {
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
  static readonly installationDirectoryWindows = path.join(process.env['PROGRAMFILES'] + '', "dotnet");
  static readonly installationDirectoryLinux = '/usr/share/dotnet';

  constructor(version: string, quality: string) {
    this.version = version;
    this.quality = quality;
  }

  public async installDotnet() {
    let output = '';
    let resultCode = 0;
    

    const versionResolver = new DotnetVersionResolver(this.version);
    const versionObject = versionResolver.createVersionObject();

    var envVariables: {[key: string]: string} = {};
    for (let key in process.env) {
      if (process.env[key]) {
        let value: any = process.env[key];
        envVariables[key] = value;
      }
    }
    if (IS_WINDOWS) {
      let escapedScript = path
        .join(__dirname, '..', 'externals', 'install-dotnet.ps1')
        .replace(/'/g, "''");
      let command = `& '${escapedScript}' ${versionObject.type} ${versionObject.value}`;

      if (this.quality) {
        if (versionObject.qualityFlag) {
          command += ` -Quality ${this.quality}`;
        } else {
          logWarning(
            `'dotnet-quality' input can't be used with exact version: ${versionObject.value} of .NET. 'dotnet-quality' input is ignored.`
          );
        }
      }

      if (process.env['https_proxy'] != null) {
        command += ` -ProxyAddress ${process.env['https_proxy']}`;
      }
      // This is not currently an option
      if (process.env['no_proxy'] != null) {
        command += ` -ProxyBypassList ${process.env['no_proxy']}`;
      }

      command += ` -InstallDir '${DotnetCoreInstaller.installationDirectoryWindows}'`;

      // process.env must be explicitly passed in for DOTNET_INSTALL_DIR to be used
      const powershellPath = await io.which('powershell', true);

      var options: ExecOptions = {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          }
        },
        env: envVariables
      };

      resultCode = await exec.exec(
        `"${powershellPath}"`,
        [
          '-NoLogo',
          '-Sta',
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Unrestricted',
          '-Command',
          command
        ],
        options
      );
    } else {
      let escapedScript = path
        .join(__dirname, '..', 'externals', 'install-dotnet.sh')
        .replace(/'/g, "''");
      chmodSync(escapedScript, '777');

      const scriptPath = await io.which(escapedScript, true);

      let scriptArguments: string[] = [versionObject.type, versionObject.value];

      if (this.quality) {
        if (versionObject.qualityFlag) {
          scriptArguments.push('--quality', this.quality);
        } else {
          logWarning(
            `'dotnet-quality' input can't be used with exact version: ${versionObject.value} of .NET. 'dotnet-quality' input is ignored.`
          );
        }
      }

      if (IS_LINUX) {
        scriptArguments.push('--install-dir', DotnetCoreInstaller.installationDirectoryLinux);
      }

      // process.env must be explicitly passed in for DOTNET_INSTALL_DIR to be used
      resultCode = await exec.exec(`"${scriptPath}"`, scriptArguments, {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          }
        },
        env: envVariables
      });
    }

    if (resultCode != 0) {
      throw new Error(`Failed to install dotnet ${resultCode}. ${output}`);
    }
  }

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
      }
      else if (IS_LINUX) {
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

    console.log(process.env['PATH']);
  }
}

export function logWarning(message: string): void {
  const warningPrefix = '[warning]';
  core.info(`${warningPrefix}${message}`);
}
