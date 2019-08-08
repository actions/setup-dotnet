// Load tempDirectory before it gets wiped by tool-cache
let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || '';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import httpClient = require('typed-rest-client/HttpClient');
import {HttpClientResponse} from 'typed-rest-client/HttpClient';
import {chmodSync} from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import * as util from 'util';

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

export class DotnetCoreInstaller {
  constructor(version: string) {
    if (semver.valid(semver.clean(version) || '') == null) {
      throw 'Implicit version not permitted';
    }
    this.version = version;
    this.cachedToolName = 'dncs';
    this.arch = 'x64';
  }

  public async installDotnet() {
    // Check cache
    let toolPath: string;
    let osSuffixes = await this.detectMachineOS();
    let parts = osSuffixes[0].split('-');
    if (parts.length > 1) {
      this.arch = parts[1];
    }
    toolPath = this.getLocalTool();

    if (!toolPath) {
      // download, extract, cache
      console.log('Getting a download url', this.version);
      let downloadUrls = await this.getDownloadUrls(osSuffixes, this.version);
      toolPath = await this.downloadAndInstall(downloadUrls);
    } else {
      console.log('Using cached tool');
    }

    // Need to set this so that .NET Core global tools find the right locations.
    core.exportVariable('DOTNET_ROOT', toolPath);

    // Prepend the tools path. instructs the agent to prepend for future tasks
    core.addPath(toolPath);
  }

  private getLocalTool(): string {
    console.log('Checking tool cache');
    return tc.find(this.cachedToolName, this.version, this.arch);
  }

  private async detectMachineOS(): Promise<string[]> {
    let osSuffix = [];
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

  private async downloadAndInstall(downloadUrls: string[]) {
    let downloaded = false;
    let downloadPath = '';
    for (const url of downloadUrls) {
      try {
        downloadPath = await tc.downloadTool(url);
        downloaded = true;
        break;
      } catch (error) {
        console.log('Could Not Download', url, JSON.stringify(error));
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
      this.version,
      this.arch
    );

    console.log('Successfully installed', this.version);
    return cachedDir;
  }

  // OsSuffixes - The suffix which is a part of the file name ex- linux-x64, windows-x86
  // Type - SDK / Runtime
  // Version - Version of the SDK/Runtime
  private async getDownloadUrls(
    osSuffixes: string[],
    version: string
  ): Promise<string[]> {
    let downloadUrls = [];
    let releasesJSON = await this.getReleasesJson();
    core.debug('Releases: ' + releasesJSON);

    let releasesInfo = JSON.parse(await releasesJSON.readBody());
    releasesInfo = releasesInfo.filter((releaseInfo: any) => {
      return (
        releaseInfo['version-sdk'] === version ||
        releaseInfo['version-sdk-display'] === version
      );
    });

    if (releasesInfo.length != 0) {
      let release = releasesInfo[0];
      let blobUrl: string = release['blob-sdk'];
      let dlcUrl: string = release['dlc--sdk'];
      let fileName: string = release['sdk-' + osSuffixes[0]]
        ? release['sdk-' + osSuffixes[0]]
        : release['sdk-' + osSuffixes[1]];

      if (!!fileName) {
        fileName = fileName.trim();
        // For some latest version, the filename itself can be full download url.
        // Do a very basic check for url(instead of regex) as the url is only for downloading and
        // is coming from .net core releases json and not some ransom user input
        if (fileName.toLowerCase().startsWith('https://')) {
          downloadUrls.push(fileName);
        } else {
          if (!!blobUrl) {
            downloadUrls.push(util.format('%s%s', blobUrl.trim(), fileName));
          }

          if (!!dlcUrl) {
            downloadUrls.push(util.format('%s%s', dlcUrl.trim(), fileName));
          }
        }
      } else {
        throw `The specified version's download links are not correctly formed in the supported versions document => ${DotNetCoreReleasesUrl}`;
      }
    } else {
      console.log(
        `Could not fetch download information for version ${version}`
      );
      downloadUrls = await this.getFallbackDownloadUrls(version);
    }

    if (downloadUrls.length == 0) {
      throw `Could not construct download URL. Please ensure that specified version ${version} is valid.`;
    }

    core.debug(`Got download urls ${downloadUrls}`);

    return downloadUrls;
  }

  private getReleasesJson(): Promise<HttpClientResponse> {
    var httpCallbackClient = new httpClient.HttpClient('setup-dotnet', [], {});
    return httpCallbackClient.get(DotNetCoreReleasesUrl);
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

  private version: string;
  private cachedToolName: string;
  private arch: string;
}

const DotNetCoreReleasesUrl: string =
  'https://raw.githubusercontent.com/dotnet/core/master/release-notes/releases.json';
