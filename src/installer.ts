// Load tempDirectory before it gets wiped by tool-cache
let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || '';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import {chmodSync} from 'fs';
import * as path from 'path';
import {ExecOptions} from '@actions/exec/lib/interfaces';
import * as semver from 'semver';

const IS_WINDOWS = process.platform === 'win32';

if (!tempDirectory) {
  let baseLocation;
  if (IS_WINDOWS) {
    // On windows use the USERPROFILE env variable
    baseLocation = process.env['USERPROFILE'] || 'C:\\';
  } else {
    if (process.platform === 'darwin') {
      baseLocation = '/Users';
    } else {
      baseLocation = '/home';
    }
  }
  tempDirectory = path.join(baseLocation, 'actions', 'temp');
}

/**
 * Represents the inputted version information
 */
export class DotNetVersionInfo {
  private fullversion: string;
  private isExactVersionSet: boolean = false;

  constructor(version: string) {
    // Check for exact match
    if (semver.valid(semver.clean(version) || '') != null) {
      this.fullversion = semver.clean(version) as string;
      this.isExactVersionSet = true;

      return;
    }

    //Note: No support for previews when using generic
    let parts: string[] = version.split('.');

    if (parts.length < 2 || parts.length > 3) this.throwInvalidVersionFormat();

    if (parts.length == 3 && parts[2] !== 'x' && parts[2] !== '*') {
      this.throwInvalidVersionFormat();
    }

    let major = this.getVersionNumberOrThrow(parts[0]);
    let minor = this.getVersionNumberOrThrow(parts[1]);

    this.fullversion = major + '.' + minor;
  }

  private getVersionNumberOrThrow(input: string): number {
    try {
      if (!input || input.trim() === '') this.throwInvalidVersionFormat();

      let number = Number(input);

      if (Number.isNaN(number) || number < 0) this.throwInvalidVersionFormat();

      return number;
    } catch {
      this.throwInvalidVersionFormat();
      return -1;
    }
  }

  private throwInvalidVersionFormat() {
    throw 'Invalid version format! Supported: 1.2.3, 1.2, 1.2.x, 1.2.*';
  }

  /**
   * If true exacatly one version should be resolved
   */
  public isExactVersion(): boolean {
    return this.isExactVersionSet;
  }

  public version(): string {
    return this.fullversion;
  }
}

/**
 * Represents a resolved version from the Web-Api
 */
class ResolvedVersionInfo {
  downloadUrls: string[];
  resolvedVersion: string;

  constructor(downloadUrls: string[], resolvedVersion: string) {
    if (downloadUrls.length === 0) {
      throw 'DownloadUrls can not be empty';
    }

    if (!resolvedVersion) {
      throw 'Resolved version is invalid';
    }

    this.downloadUrls = downloadUrls;
    this.resolvedVersion = resolvedVersion;
  }
}

export class DotnetCoreInstaller {
  constructor(version: string) {
    this.version = version;
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
}
