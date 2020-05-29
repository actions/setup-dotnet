// Load tempDirectory before it gets wiped by tool-cache
let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || '';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import hc = require('@actions/http-client');
import {chmodSync} from 'fs';
import * as os from 'os';
import * as path from 'path';
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
    this.versionInfo = new DotNetVersionInfo(version);
    this.cachedToolName = 'dncs';
    this.arch = 'x64';
  }

  public async installDotnet() {
    // Check cache
    let toolPath: string = '';
    let osSuffixes = await this.detectMachineOS();
    let parts = osSuffixes[0].split('-');
    if (parts.length > 1) {
      this.arch = parts[1];
    }

    // If version is not generic -> look up cache
    if (this.versionInfo.isExactVersion())
      toolPath = this.getLocalTool(this.versionInfo.version());

    if (!toolPath) {
      // download, extract, cache
      console.log('Getting a download url', this.versionInfo.version());
      let resolvedVersionInfo = await this.resolveInfos(
        osSuffixes,
        this.versionInfo
      );

      //Check if cache exists for resolved version
      toolPath = this.getLocalTool(resolvedVersionInfo.resolvedVersion);
      if (!toolPath) {
        //If not exists install it
        toolPath = await this.downloadAndInstall(resolvedVersionInfo);
      } else {
        console.log('Using cached tool');
      }
    } else {
      console.log('Using cached tool');
    }

    // Need to set this so that .NET Core global tools find the right locations.
    core.exportVariable('DOTNET_ROOT', toolPath);

    // Prepend the tools path. instructs the agent to prepend for future tasks
    core.addPath(toolPath);
  }

  private getLocalTool(version: string): string {
    console.log('Checking tool cache', version);
    return tc.find(this.cachedToolName, version, this.arch);
  }

  private async detectMachineOS(): Promise<string[]> {
    let osSuffix: string[] = [];
    let output = '';

    let resultCode = 0;
    if (IS_WINDOWS) {
      let escapedScript = path
        .join(__dirname, '..', 'externals', 'get-os-platform.ps1')
        .replace(/'/g, "''");
      let command = `& '${escapedScript}'`;

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
      let scriptPath = path.join(
        __dirname,
        '..',
        'externals',
        'get-os-distro.sh'
      );
      chmodSync(scriptPath, '777');

      const toolPath = await io.which(scriptPath, true);
      resultCode = await exec.exec(`"${toolPath}"`, [], {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          }
        }
      });
    }

    if (resultCode != 0) {
      throw `Failed to detect os with result code ${resultCode}. Output: ${output}`;
    }

    let index;
    if ((index = output.indexOf('Primary:')) >= 0) {
      let primary = output.substr(index + 'Primary:'.length).split(os.EOL)[0];
      osSuffix.push(primary);
    }

    if ((index = output.indexOf('Legacy:')) >= 0) {
      let legacy = output.substr(index + 'Legacy:'.length).split(os.EOL)[0];
      osSuffix.push(legacy);
    }

    if (osSuffix.length == 0) {
      throw 'Could not detect platform';
    }

    return osSuffix;
  }

  private async downloadAndInstall(resolvedVersionInfo: ResolvedVersionInfo) {
    let downloaded = false;
    let downloadPath = '';
    for (const url of resolvedVersionInfo.downloadUrls) {
      try {
        downloadPath = await tc.downloadTool(url);
        downloaded = true;
        break;
      } catch (error) {
        console.log('Could not Download', url, JSON.stringify(error));
      }
    }

    if (!downloaded) {
      throw 'Failed to download package';
    }

    // extract
    console.log('Extracting Package', downloadPath);
    let extPath: string = IS_WINDOWS
      ? await tc.extractZip(downloadPath)
      : await tc.extractTar(downloadPath);

    // cache tool
    console.log('Caching tool');
    let cachedDir = await tc.cacheDir(
      extPath,
      this.cachedToolName,
      resolvedVersionInfo.resolvedVersion,
      this.arch
    );

    console.log('Successfully installed', resolvedVersionInfo.resolvedVersion);
    return cachedDir;
  }

  // OsSuffixes - The suffix which is a part of the file name ex- linux-x64, windows-x86
  // Type - SDK / Runtime
  // versionInfo - versionInfo of the SDK/Runtime
  async resolveInfos(
    osSuffixes: string[],
    versionInfo: DotNetVersionInfo
  ): Promise<ResolvedVersionInfo> {
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
    if (!versionInfo.isExactVersion()) {
      let latestSdk: string = releasesResult['latest-sdk'];

      releasesInfo = releasesInfo.filter((releaseInfo: any) =>
        semver.lte(releaseInfo['sdk']['version'], latestSdk)
      );
    }

    // Sort for latest version
    releasesInfo = releasesInfo.sort((a, b) =>
      semver.rcompare(a['sdk']['version'], b['sdk']['version'])
    );

    let downloadedVersion: string = '';
    let downloadUrls: string[] = [];

    if (releasesInfo.length != 0) {
      let release = releasesInfo[0];

      downloadedVersion = release['sdk']['version'];

      let files: any[] = release['sdk']['files'];
      files = files.filter((file: any) => {
        if (file['rid'] == osSuffixes[0] || file['rid'] == osSuffixes[1]) {
          return (
            file['url'].endsWith('.zip') || file['url'].endsWith('.tar.gz')
          );
        }
      });

      if (files.length > 0) {
        files.forEach((file: any) => {
          downloadUrls.push(file['url']);
        });
      } else {
        throw `The specified version's download links are not correctly formed in the supported versions document => ${releasesJsonUrl}`;
      }
    } else {
      console.log(
        `Could not fetch download information for version ${versionInfo.version()}`
      );

      if (versionInfo.isExactVersion()) {
        console.log('Using fallback');

        downloadUrls = await this.getFallbackDownloadUrls(
          versionInfo.version()
        );
        downloadedVersion = versionInfo.version();
      } else {
        console.log('Unable to use fallback, version is generic!');
      }
    }

    if (downloadUrls.length == 0) {
      throw `Could not construct download URL. Please ensure that specified version ${versionInfo.version()}/${downloadedVersion} is valid.`;
    }

    core.debug(`Got download urls ${downloadUrls}`);

    return new ResolvedVersionInfo(downloadUrls, downloadedVersion);
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

  private async getFallbackDownloadUrls(version: string): Promise<string[]> {
    let primaryUrlSearchString: string;
    let legacyUrlSearchString: string;
    let output = '';
    let resultCode = 0;

    if (IS_WINDOWS) {
      let escapedScript = path
        .join(__dirname, '..', 'externals', 'install-dotnet.ps1')
        .replace(/'/g, "''");
      let command = `& '${escapedScript}' -Version ${version} -DryRun`;

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

      primaryUrlSearchString = 'dotnet-install: Primary named payload URL: ';
      legacyUrlSearchString = 'dotnet-install: Legacy named payload URL: ';
    } else {
      let escapedScript = path
        .join(__dirname, '..', 'externals', 'install-dotnet.sh')
        .replace(/'/g, "''");
      chmodSync(escapedScript, '777');

      const scriptPath = await io.which(escapedScript, true);
      resultCode = await exec.exec(
        `"${scriptPath}"`,
        ['--version', version, '--dry-run'],
        {
          listeners: {
            stdout: (data: Buffer) => {
              output += data.toString();
            }
          }
        }
      );

      primaryUrlSearchString = 'dotnet-install: Primary named payload URL: ';
      legacyUrlSearchString = 'dotnet-install: Legacy named payload URL: ';
    }

    if (resultCode != 0) {
      throw `Failed to get download urls with result code ${resultCode}. ${output}`;
    }

    let primaryUrl: string = '';
    let legacyUrl: string = '';
    if (!!output && output.length > 0) {
      let lines: string[] = output.split(os.EOL);

      // Fallback to \n if initial split doesn't work (not consistent across versions)
      if (lines.length === 1) {
        lines = output.split('\n');
      }
      if (!!lines && lines.length > 0) {
        lines.forEach((line: string) => {
          if (!line) {
            return;
          }
          var primarySearchStringIndex = line.indexOf(primaryUrlSearchString);
          if (primarySearchStringIndex > -1) {
            primaryUrl = line.substring(
              primarySearchStringIndex + primaryUrlSearchString.length
            );
            return;
          }

          var legacySearchStringIndex = line.indexOf(legacyUrlSearchString);
          if (legacySearchStringIndex > -1) {
            legacyUrl = line.substring(
              legacySearchStringIndex + legacyUrlSearchString.length
            );
            return;
          }
        });
      }
    }

    return [primaryUrl, legacyUrl];
  }

  private versionInfo: DotNetVersionInfo;
  private cachedToolName: string;
  private arch: string;
}

const DotNetCoreIndexUrl: string =
  'https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json';
