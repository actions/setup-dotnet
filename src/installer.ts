// Load tempDirectory before it gets wiped by tool-cache
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import hc = require('@actions/http-client');
import {chmodSync} from 'fs';
import * as path from 'path';
import {ExecOptions} from '@actions/exec/lib/interfaces';
import * as semver from 'semver';

const IS_WINDOWS = process.platform === 'win32';

/**
 * Represents the inputted version information
 */
export class DotNetVersionInfo {
  public inputVersion: string;
  private fullversion: string;
  private isExactVersionSet: boolean = false;

  constructor(version: string) {
    this.inputVersion = version;

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

export class DotnetCoreInstaller {
  constructor(version: string) {
    this.version = version;
  }

  public async installDotnet() {
    let output = '';
    let resultCode = 0;

    let calculatedVersion = await this.resolveVersion(
      new DotNetVersionInfo(this.version)
    );

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
      if (calculatedVersion) {
        command += ` -Version ${calculatedVersion}`;
      }
      if (process.env['https_proxy'] != null) {
        command += ` -ProxyAddress ${process.env['https_proxy']}`;
      }
      // This is not currently an option
      if (process.env['no_proxy'] != null) {
        command += ` -ProxyBypassList ${process.env['no_proxy']}`;
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

    if (process.env['DOTNET_INSTALL_DIR']) {
      core.addPath(process.env['DOTNET_INSTALL_DIR']);
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
      }
    }

    console.log(process.env['PATH']);

    if (resultCode != 0) {
      throw `Failed to install dotnet ${resultCode}. ${output}`;
    }
  }

  // versionInfo - versionInfo of the SDK/Runtime
  async resolveVersion(versionInfo: DotNetVersionInfo): Promise<string> {
    if (versionInfo.isExactVersion()) {
      return versionInfo.version();
    }

    const httpClient = new hc.HttpClient('actions/setup-dotnet', [], {
      allowRetries: true,
      maxRetries: 3
    });

    const releasesJsonUrl: string = await this.getReleasesJsonUrl(
      httpClient,
      versionInfo.version().split('.')
    );

    const releasesResponse = await httpClient.getJson<any>(releasesJsonUrl);
    const releasesResult = releasesResponse.result || {};
    let releasesInfo: any[] = releasesResult['releases'];
    releasesInfo = releasesInfo.filter((releaseInfo: any) => {
      return (
        semver.satisfies(
          releaseInfo['sdk']['version'],
          versionInfo.version()
        ) ||
        semver.satisfies(
          releaseInfo['sdk']['version-display'],
          versionInfo.version()
        )
      );
    });

    // Exclude versions that are newer than the latest if using not exact
    let latestSdk: string = releasesResult['latest-sdk'];

    releasesInfo = releasesInfo.filter((releaseInfo: any) =>
      semver.lte(releaseInfo['sdk']['version'], latestSdk)
    );

    // Sort for latest version
    releasesInfo = releasesInfo.sort((a, b) =>
      semver.rcompare(a['sdk']['version'], b['sdk']['version'])
    );

    if (releasesInfo.length == 0) {
      throw `Could not find dotnet core version. Please ensure that specified version ${versionInfo.inputVersion} is valid.`;
    }

    let release = releasesInfo[0];
    return release['sdk']['version'];
  }

  private async getReleasesJsonUrl(
    httpClient: hc.HttpClient,
    versionParts: string[]
  ): Promise<string> {
    const response = await httpClient.getJson<any>(DotNetCoreIndexUrl);
    const result = response.result || {};
    let releasesInfo: any[] = result['releases-index'];
    releasesInfo = releasesInfo.filter((info: any) => {
      // channel-version is the first 2 elements of the version (e.g. 2.1), filter out versions that don't match 2.1.x.
      const sdkParts: string[] = info['channel-version'].split('.');
      if (versionParts.length >= 2 && versionParts[1] != 'x') {
        return versionParts[0] == sdkParts[0] && versionParts[1] == sdkParts[1];
      }
      return versionParts[0] == sdkParts[0];
    });
    if (releasesInfo.length === 0) {
      throw `Could not find info for version ${versionParts.join(
        '.'
      )} at ${DotNetCoreIndexUrl}`;
    }
    return releasesInfo[0]['releases.json'];
  }

  private version: string;
}

const DotNetCoreIndexUrl: string =
  'https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json';
