// Load tempDirectory before it gets wiped by tool-cache
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import httpClient = require('typed-rest-client/HttpClient');
import {chmodSync} from 'fs';
import * as path from 'path';
import * as semver from 'semver';

const IS_WINDOWS = process.platform === 'win32';

export class DotnetCoreInstaller {
  constructor(version: string) {
    if (semver.valid(semver.clean(version) || '') == null) {
      throw 'Implicit version not permitted';
    }
    this.version = version;
  }

  public async installDotnet() {
    let output = '';
    let resultCode = 0;

    if (IS_WINDOWS) {
      let escapedScript = path
        .join(__dirname, '..', 'externals', 'install-dotnet.ps1')
        .replace(/'/g, "''");
      let command = `& '${escapedScript}' -Version ${this.version}`;

      const powershellPath = await io.which('powershell', true);
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
        {
          listeners: {
            stdout: (data: Buffer) => {
              output += data.toString();
            }
          }
        }
      );
    } else {
      let escapedScript = path
        .join(__dirname, '..', 'externals', 'install-dotnet.sh')
        .replace(/'/g, "''");
      chmodSync(escapedScript, '777');

      const scriptPath = await io.which(escapedScript, true);
      resultCode = await exec.exec(
        `"${scriptPath}"`,
        ['--version', this.version],
        {
          listeners: {
            stdout: (data: Buffer) => {
              output += data.toString();
            }
          }
        }
      );
    }

    if (resultCode != 0) {
      throw `Failed to install dotnet ${resultCode}. ${output}`;
    }
  }

  private version: string;
}
