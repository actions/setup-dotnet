// Load tempDirectory before it gets wiped by tool-cache
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import hc = require('@actions/http-client');
import {chmodSync} from 'fs';
import * as path from 'path';
import {ExecOptions} from '@actions/exec/lib/interfaces';

const IS_WINDOWS = process.platform === 'win32';
const IS_LINUX = process.platform === 'linux';

export class DotnetQualityResolver {
  private quality: string;
  private qualityOptions: string[];
  constructor(quality: string) {
    this.quality = quality;
    this.qualityOptions = ['daily', 'signed', 'validated', 'preview', 'GA'];
  }

  public resolveQuality() {
    if (!this.qualityOptions.includes(this.quality)) {
      throw new Error(
        `${this.quality} is not a supported value for 'dotnet-quality' option. Supported values are: daily, signed, validated, preview, ga.`
      );
    }
    return this.quality;
  }
}
export class DotnetVersionResolver {
  private inputVersion: string;
  private resolvedArgument: {type: string; value: string};

  constructor(version: string) {
    this.inputVersion = version.trim();
    this.resolvedArgument = {type: '', value: ''};
  }

  private resolveVersionInput(): void {
    const RegExXY = /^\d+.\d+$/;
    const RegExXYx = /^(\d+.\d+).[x/*]$/i;
    const RegExXYZxx = /^(\d+.\d+.\d{1})[x*]{2}$/i;

    if (RegExXY.test(this.inputVersion)) {
      this.resolvedArgument.type = 'channel';
      this.resolvedArgument.value = this.inputVersion;
    } else if (RegExXYx.test(this.inputVersion)) {
      this.resolvedArgument.type = 'channel';
      this.resolvedArgument.value = this.inputVersion.match(RegExXYx)?.[1]!;
    } else if (RegExXYZxx.test(this.inputVersion)) {
      this.resolvedArgument.type = 'channel';
      this.resolvedArgument.value = this.inputVersion
        .match(RegExXYZxx)?.[1]
        .concat('xx')!;
    } else {
      this.resolvedArgument.type = 'version';
      this.resolvedArgument.value = this.inputVersion;
    }
  }

  public createLineArgument(): {type: string; value: string} {
    this.resolveVersionInput();
    if (IS_WINDOWS) {
      if (this.resolvedArgument.type === 'channel') {
        this.resolvedArgument.type = '-Channel';
      } else {
        this.resolvedArgument.type = '-Version';
      }
    } else {
      if (this.resolvedArgument.type === 'channel') {
        this.resolvedArgument.type = '--channel';
      } else {
        this.resolvedArgument.type = '--version';
      }
    }
    return this.resolvedArgument;
  }
}

export class DotnetCoreInstaller {
  private version: string;
  private quality: string;

  constructor(version: string, quality: string) {
    this.version = version;
    this.quality = quality;
  }

  public async installDotnet() {
    let output = '';
    let resultCode = 0;
    const installationDirectoryWindows = 'C:\\Program` Files\\dotnet';
    const installationDirectoryLinux = '/usr/share/dotnet';

    const versionObject = new DotnetVersionResolver(
      this.version
    ).createLineArgument();

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
      let command = `& '${escapedScript}'`;

      if (versionObject) {
        command += ` ${versionObject.type} ${versionObject.value}`;
      }

      if (this.quality) {
        if (versionObject.type == '-Channel') {
          command += ` -Quality ${this.quality}`;
        } else {
          core.warning(
            "Input 'dotnet-quality' can't be used with the specified exact version of .NET. 'dotnet-quality' input will be ignored."
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

      command += ` -InstallDir ${installationDirectoryWindows}`;

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

      let scriptArguments: string[] = [];

      if (versionObject) {
        scriptArguments.push(versionObject.type, versionObject.value);
      }

      if (this.quality) {
        if (versionObject.type == '--channel') {
          scriptArguments.push('--quality', this.quality);
        } else {
          core.warning(
            "Input 'dotnet-quality' can't be used with the specified exact version of .NET. 'dotnet-quality' input will be ignored."
          );
        }
      }

      if (IS_LINUX) {
        scriptArguments.push('--install-dir', installationDirectoryLinux);
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
        // This is the default set in install-dotnet.ps1
        core.addPath(
          path.join(process.env['LocalAppData'] + '', 'Microsoft', 'dotnet')
        );
        core.exportVariable(
          'DOTNET_ROOT',
          path.join(process.env['LocalAppData'] + '', 'Microsoft', 'dotnet')
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
