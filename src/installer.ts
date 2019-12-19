// Load tempDirectory before it gets wiped by tool-cache
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import {chmodSync} from 'fs';
import * as path from 'path';
import {ExecOptions} from '@actions/exec/lib/interfaces';

const IS_WINDOWS = process.platform === 'win32';

export class DotnetCoreInstaller {
  constructor(version: string = '', jsonfile: string = '') {
    this.version = version;
    this.jsonfile = jsonfile;
  }

  public async installDotnet() {
    let output = '';
    let resultCode = 0;

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
      if (this.version) {
        command += ` -Version ${this.version}`;
      }
      if (this.jsonfile) {
        command += ` -jsonfile ${this.jsonfile}`;
      }

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
      if (this.version) {
        scriptArguments.push('--version', this.version);
      }
      if (this.jsonfile) {
        scriptArguments.push('--jsonfile', this.jsonfile);
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
      throw `Failed to install dotnet ${resultCode}. ${output}`;
    }
  }

  private version: string;
  private jsonfile: string;
}
