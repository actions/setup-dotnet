// Load tempDirectory before it gets wiped by tool-cache
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as hc from '@actions/http-client';
import {chmodSync, existsSync, readdirSync} from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import os from 'os';
import semver from 'semver';
import {IS_WINDOWS, PLATFORM} from './utils.js';
import type {QualityOptions} from './setup-dotnet.js';

export interface DotnetVersion {
  type: string;
  value: string;
  qualityFlag: boolean;
}

interface ReleaseIndexEntry {
  'channel-version': string;
  'support-phase': string;
  'release-type': string;
}

interface ReleaseIndexResponse {
  'releases-index': ReleaseIndexEntry[];
}

const QUALITY_INPUT_MINIMAL_MAJOR_TAG = 6;
const LATEST_PATCH_SYNTAX_MINIMAL_MAJOR_TAG = 5;

/**
 * Maps a bare major version tag to the channel used by the install scripts.
 * Starting with .NET 5, the minor version is always zero. The earlier versions
 * are hardcoded because they will not get new releases.
 */
function channelForMajor(major: string): string {
  switch (major) {
    case '1':
      return '1.1';
    case '2':
      return '2.2';
    case '3':
      return '3.1';
    default:
      return `${major}.0`;
  }
}

export class DotnetVersionResolver {
  private inputVersion: string;
  private resolvedArgument: DotnetVersion;

  constructor(
    version: string,
    private quality: QualityOptions = '',
    private dotnetChannel?: string
  ) {
    this.inputVersion = version.trim();
    this.resolvedArgument = {type: '', value: '', qualityFlag: false};
  }

  private isVersionChannel(channel: string): boolean {
    // A.B format (e.g., 3.1, 8.0)
    if (/^\d+\.\d+$/.test(channel)) return true;
    // A.B.Cxx format (e.g., 8.0.1xx) is supported only for .NET 5.0+
    const latestPatchMatch = channel.match(/^(\d+)\.\d+\.\d{1}xx$/);
    if (latestPatchMatch) {
      const major = Number(latestPatchMatch[1]);
      return (
        !Number.isNaN(major) && major >= LATEST_PATCH_SYNTAX_MINIMAL_MAJOR_TAG
      );
    }
    return false;
  }

  private async resolveVersionInput(): Promise<void> {
    if (this.inputVersion.toLowerCase() === 'latest') {
      const channel = this.dotnetChannel || '';
      if (this.isVersionChannel(channel)) {
        // A.B or A.B.Cxx channels are passed directly to the install script
        this.resolvedArgument.value = channel;
      } else {
        // LTS, STS, or empty — resolve via releases index API
        this.resolvedArgument.value = await this.getLatestVersion(channel);
      }
      this.resolvedArgument.type = 'channel';
      const latestChannelMajorTag = Number(
        this.resolvedArgument.value.split('.')[0]
      );
      this.resolvedArgument.qualityFlag =
        !Number.isNaN(latestChannelMajorTag) &&
        latestChannelMajorTag >= QUALITY_INPUT_MINIMAL_MAJOR_TAG;
      return;
    }

    if (this.dotnetChannel) {
      core.warning(
        `The 'dotnet-channel' input is only supported when 'dotnet-version' is set to 'latest'.`
      );
    }

    if (!semver.validRange(this.inputVersion) && !this.isLatestPatchSyntax()) {
      throw new Error(
        `The 'dotnet-version' was supplied in invalid format: ${this.inputVersion}! Supported syntax: A.B.C, A.B, A.B.x, A, A.x, A.B.Cxx, latest`
      );
    }
    if (semver.valid(this.inputVersion)) {
      this.createVersionArgument();
    } else {
      await this.createChannelArgument();
    }
  }

  private isNumericTag(versionTag): boolean {
    return /^\d+$/.test(versionTag);
  }

  private isLatestPatchSyntax() {
    const majorTag = this.inputVersion.match(
      /^(?<majorTag>\d+)\.\d+\.\d{1}x{2}$/
    )?.groups?.majorTag;
    if (
      majorTag &&
      parseInt(majorTag) < LATEST_PATCH_SYNTAX_MINIMAL_MAJOR_TAG
    ) {
      throw new Error(
        `The 'dotnet-version' was supplied in invalid format: ${this.inputVersion}! The A.B.Cxx syntax is available since the .NET 5.0 release.`
      );
    }
    return majorTag ? true : false;
  }

  private createVersionArgument() {
    this.resolvedArgument.type = 'version';
    this.resolvedArgument.value = this.inputVersion;
  }

  private async createChannelArgument() {
    this.resolvedArgument.type = 'channel';
    const [major, minor] = this.inputVersion.split('.');
    if (this.isLatestPatchSyntax()) {
      this.resolvedArgument.value = this.inputVersion;
    } else if (this.isNumericTag(major) && this.isNumericTag(minor)) {
      this.resolvedArgument.value = `${major}.${minor}`;
    } else if (this.isNumericTag(major)) {
      this.resolvedArgument.value = channelForMajor(major);
    } else {
      // If "dotnet-version" is specified as *, x or X resolve latest version of .NET explicitly from LTS channel. The version argument will default to "latest" by install-dotnet script.
      this.resolvedArgument.value = 'LTS';
    }
    this.resolvedArgument.qualityFlag =
      parseInt(major) >= QUALITY_INPUT_MINIMAL_MAJOR_TAG ? true : false;
  }

  public async createDotnetVersion(): Promise<DotnetVersion> {
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

  private async getLatestVersion(channelFilter: string): Promise<string> {
    const httpClient = new hc.HttpClient('actions/setup-dotnet', [], {
      allowRetries: true,
      maxRetries: 3
    });

    const response = await httpClient.getJson<ReleaseIndexResponse>(
      DotnetVersionResolver.DotnetCoreIndexUrl
    );

    const result = response.result;
    const rawReleasesInfo = result?.['releases-index'];

    if (!Array.isArray(rawReleasesInfo)) {
      throw new Error('Unexpected response format from .NET releases index.');
    }

    let releasesInfo = rawReleasesInfo;

    // Filter out EOL versions
    releasesInfo = releasesInfo.filter(info => info['support-phase'] !== 'eol');

    // Filter out preview versions if quality is not 'preview' or 'daily'
    // If quality is not specified, we assume strict stability (GA only)
    const normalizedQuality = (this.quality || '').toLowerCase();
    if (!['preview', 'daily'].includes(normalizedQuality)) {
      releasesInfo = releasesInfo.filter(
        info => info['support-phase'] !== 'preview'
      );
    }

    // Apply channel filter (LTS/STS)
    if (channelFilter) {
      const type = channelFilter.toLowerCase();
      releasesInfo = releasesInfo.filter(info => info['release-type'] === type);
    }

    releasesInfo.sort((a, b) => {
      const partsA = a['channel-version'].split('.').map(Number);
      const partsB = b['channel-version'].split('.').map(Number);
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const diff = (partsB[i] || 0) - (partsA[i] || 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });

    if (releasesInfo.length === 0) {
      throw new Error(
        `Could not find any active releases matching channel '${
          channelFilter || 'any'
        }'`
      );
    }

    return releasesInfo[0]['channel-version'];
  }

  static DotnetCoreIndexUrl =
    'https://builds.dotnet.microsoft.com/dotnet/release-metadata/releases-index.json';
}

export class DotnetInstallScript {
  private scriptName = IS_WINDOWS ? 'install-dotnet.ps1' : 'install-dotnet.sh';
  private escapedScript: string;
  private scriptArguments: string[] = [];

  constructor() {
    this.escapedScript = path
      .join(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'externals',
        this.scriptName
      )
      .replace(/'/g, "''");

    if (IS_WINDOWS) {
      this.setupScriptPowershell();
      return;
    }

    this.setupScriptBash();
  }

  private setupScriptPowershell() {
    this.scriptArguments = [
      '-NoLogo',
      '-Sta',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Unrestricted',
      '-Command'
    ];

    this.scriptArguments.push('&', `'${this.escapedScript}'`);

    if (process.env['https_proxy'] != null) {
      this.scriptArguments.push(`-ProxyAddress ${process.env['https_proxy']}`);
    }
    // This is not currently an option
    if (process.env['no_proxy'] != null) {
      this.scriptArguments.push(`-ProxyBypassList ${process.env['no_proxy']}`);
    }
  }

  private setupScriptBash() {
    chmodSync(this.escapedScript, '777');
  }

  private async getScriptPath() {
    if (IS_WINDOWS) {
      return (await io.which('pwsh', false)) || io.which('powershell', true);
    }

    return io.which(this.escapedScript, true);
  }

  public useArguments(...args: string[]) {
    this.scriptArguments.push(...args);
    return this;
  }

  // When architecture is empty/undefined, the installer auto-detects the current runner architecture.
  public useArchitecture(architecture?: string) {
    if (!architecture) return this;
    this.useArguments(
      IS_WINDOWS ? '-Architecture' : '--architecture',
      architecture
    );
    return this;
  }

  public useVersion(dotnetVersion: DotnetVersion, quality?: QualityOptions) {
    if (dotnetVersion.type) {
      this.useArguments(dotnetVersion.type, dotnetVersion.value);
    }

    if (quality && !dotnetVersion.qualityFlag) {
      core.warning(
        `The 'dotnet-quality' input can be used only with .NET SDK version in A.B, A.B.x, A, A.x and A.B.Cxx formats where the major tag is higher than 5. You specified: ${dotnetVersion.value}. 'dotnet-quality' input is ignored.`
      );
      return this;
    }

    if (quality) {
      this.useArguments(IS_WINDOWS ? '-Quality' : '--quality', quality);
    }

    return this;
  }

  public async execute() {
    const getExecOutputOptions = {
      ignoreReturnCode: true,
      env: process.env as {string: string}
    };

    return exec.getExecOutput(
      `"${await this.getScriptPath()}"`,
      this.scriptArguments,
      getExecOutputOptions
    );
  }
}

export abstract class DotnetInstallDir {
  private static readonly default = {
    linux: '/usr/share/dotnet',
    mac: path.join(process.env['HOME'] + '', '.dotnet'),
    windows: path.join(process.env['PROGRAMFILES'] + '', 'dotnet')
  };

  public static readonly dirPath = process.env['DOTNET_INSTALL_DIR']
    ? DotnetInstallDir.convertInstallPathToAbsolute(
        process.env['DOTNET_INSTALL_DIR']
      )
    : DotnetInstallDir.default[PLATFORM];

  private static convertInstallPathToAbsolute(installDir: string): string {
    if (path.isAbsolute(installDir)) return path.normalize(installDir);

    const transformedPath = installDir.startsWith('~')
      ? path.join(os.homedir(), installDir.slice(1))
      : path.join(process.cwd(), installDir);

    return path.normalize(transformedPath);
  }

  public static addToPath() {
    core.addPath(process.env['DOTNET_INSTALL_DIR']!);
    core.exportVariable('DOTNET_ROOT', process.env['DOTNET_INSTALL_DIR']);
  }

  public static setEnvironmentVariable() {
    process.env['DOTNET_INSTALL_DIR'] = DotnetInstallDir.dirPath;
  }
}

export function normalizeArch(arch: string): string {
  switch (arch.toLowerCase()) {
    case 'amd64':
      return 'x64';
    case 'ia32':
      return 'x86';
    default:
      return arch.toLowerCase();
  }
}

export class DotnetCoreInstaller {
  private static readonly FeatureBandSyntax = /^(\d+)\.(\d+)\.(\d)xx$/;

  static {
    DotnetInstallDir.setEnvironmentVariable();
  }

  constructor(
    private version: string,
    private quality: QualityOptions,
    private architecture?: string,
    private dotnetChannel?: string,
    private checkLatest: boolean = true,
    private minimumVersion?: string
  ) {
    // Align with DotnetVersionResolver, which trims the input. Without this,
    // leading/trailing whitespace could prevent a local-SDK match when
    // 'check-latest' is false, even though the online resolver would accept it.
    this.version = version.trim();
  }

  /**
   * Enumerates the SDK versions already installed under the install directory.
   * Returns only entries that are valid semver versions and contain a usable
   * SDK.
   */
  private getInstalledSdkVersions(): string[] {
    const sdkDir = path.join(DotnetInstallDir.dirPath, 'sdk');
    try {
      const versions = readdirSync(sdkDir, {withFileTypes: true})
        // Custom and container images often symlink SDK folders instead of
        // copying them, so symlinks have to be treated as directories.
        .filter(entry => entry.isDirectory() || entry.isSymbolicLink())
        .map(entry => entry.name)
        .filter(name => semver.valid(name) !== null)
        // An emptied folder left over by a failed install (or a dangling
        // symlink) still has a version-shaped name, so the SDK entry point has
        // to be present as well. 'existsSync' resolves symlinks, which also
        // filters out broken ones.
        .filter(name => existsSync(path.join(sdkDir, name, 'dotnet.dll')));
      core.debug(
        `Locally installed .NET SDKs in '${sdkDir}': ${
          versions.join(', ') || '<none>'
        }`
      );
      return versions;
    } catch {
      // Directory doesn't exist or can't be read - treat as no local SDKs.
      core.debug(`Unable to read the SDK directory '${sdkDir}'.`);
      return [];
    }
  }

  /**
   * The SDK folders are only usable when the 'dotnet' muxer sits next to them.
   * A partially removed installation would otherwise be reported as a success
   * while the CLI is not runnable at all.
   */
  private hasDotnetMuxer(): boolean {
    return existsSync(
      path.join(DotnetInstallDir.dirPath, IS_WINDOWS ? 'dotnet.exe' : 'dotnet')
    );
  }

  /**
   * Mirrors DotnetVersionResolver's quality gating: the 'dotnet-quality' input
   * is only honored when the requested major tag is .NET 6 or higher. An
   * unknown major (bare 'latest', wildcards, LTS/STS) resolves to a supported
   * channel online, so quality applies there.
   */
  private qualityApplies(): boolean {
    const source =
      this.version.toLowerCase() === 'latest'
        ? (this.dotnetChannel || '').trim()
        : this.version;
    const major = source.match(/^(\d+)/)?.[1];
    return major ? Number(major) >= QUALITY_INPUT_MINIMAL_MAJOR_TAG : true;
  }

  private findByMajorMinor(
    candidates: string[],
    major: string,
    minor: string
  ): string | null {
    return (
      candidates.find(version => {
        const parsed = semver.parse(version);
        return (
          parsed &&
          parsed.major === Number(major) &&
          parsed.minor === Number(minor)
        );
      }) ?? null
    );
  }

  private findByFeatureBand(
    candidates: string[],
    major: string,
    minor: string,
    band: string
  ): string | null {
    return (
      candidates.find(version => {
        const parsed = semver.parse(version);
        return (
          parsed &&
          parsed.major === Number(major) &&
          parsed.minor === Number(minor) &&
          Math.floor(parsed.patch / 100) === Number(band)
        );
      }) ?? null
    );
  }

  /**
   * When 'check-latest' is false, look for a locally installed SDK that
   * satisfies the requested version and return it. Returns null when nothing
   * local satisfies the request (in which case the online path is used).
   */
  private findLocalSdkVersion(): string | null {
    const installed = this.getInstalledSdkVersions();
    if (!installed.length) {
      return null;
    }

    if (!this.hasDotnetMuxer()) {
      core.debug(
        `The 'dotnet' executable was not found in '${DotnetInstallDir.dirPath}'. Locally installed SDKs are ignored.`
      );
      return null;
    }

    // A global.json 'rollForward' policy only ever rolls forward: the version
    // it declares stays a lower bound. Reusing a lower SDK would make the
    // action succeed while the next 'dotnet build' fails with
    // "A compatible .NET SDK was not found".
    const minimumVersion = this.minimumVersion;
    const allowed = minimumVersion
      ? installed.filter(version => semver.gte(version, minimumVersion))
      : installed;

    if (!allowed.length) {
      core.debug(
        `No locally installed .NET SDK satisfies the global.json minimum version '${minimumVersion}'.`
      );
      return null;
    }

    // A pinned version must always match exactly, including prereleases.
    if (semver.valid(this.version)) {
      return allowed.find(version => version === this.version) ?? null;
    }

    // Reuse the resolver's own validation so that inputs it rejects (e.g. the
    // leading zeros in '08.0.x' or '8.00') are never matched locally and reach
    // the online path, which throws the proper error. 'latest' and the A.B.Cxx
    // syntax are not semver ranges and are validated separately.
    if (
      this.version.toLowerCase() !== 'latest' &&
      !DotnetCoreInstaller.FeatureBandSyntax.test(this.version) &&
      !semver.validRange(this.version)
    ) {
      core.debug(
        `The requested version '${this.version}' is not a valid version spec. Locally installed SDKs are ignored.`
      );
      return null;
    }

    // For floating/channel/latest requests, honor the quality input: 'preview'
    // and 'daily' ask for prerelease builds, every other value requires GA.
    // The install script ignores 'dotnet-quality' below .NET 6, so a prerelease
    // must not be reused locally for those versions either.
    const wantsPrerelease =
      ['preview', 'daily'].includes((this.quality || '').toLowerCase()) &&
      this.qualityApplies();
    const candidates = allowed
      .filter(version =>
        wantsPrerelease
          ? semver.prerelease(version) !== null
          : semver.prerelease(version) === null
      )
      .sort(semver.rcompare); // highest version first

    if (!candidates.length) {
      return null;
    }

    const input = this.version.toLowerCase();

    // 'latest' has to honor 'dotnet-channel' exactly like the online path does.
    if (input === 'latest') {
      const channel = (this.dotnetChannel || '').trim();
      // Without a channel the highest installed SDK is the right answer.
      if (!channel) {
        return candidates[0];
      }
      const channelMinor = channel.match(/^(\d+)\.(\d+)$/);
      if (channelMinor) {
        return this.findByMajorMinor(
          candidates,
          channelMinor[1],
          channelMinor[2]
        );
      }
      const channelBand = channel.match(/^(\d+)\.(\d+)\.(\d)xx$/);
      if (channelBand) {
        return this.findByFeatureBand(
          candidates,
          channelBand[1],
          channelBand[2],
          channelBand[3]
        );
      }
      // LTS and STS cannot be mapped to a version without the releases index.
      return null;
    }

    // Feature band A.B.Cxx (e.g. 8.0.1xx). Only lowercase is accepted here,
    // because the online resolver rejects 'A.B.CXX' as an invalid format.
    // The syntax exists only since .NET 5, so an older major is left to the
    // online path, which rejects it with the proper error message.
    const bandMatch = this.version.match(DotnetCoreInstaller.FeatureBandSyntax);
    if (bandMatch) {
      if (Number(bandMatch[1]) < LATEST_PATCH_SYNTAX_MINIMAL_MAJOR_TAG) {
        return null;
      }
      return this.findByFeatureBand(
        candidates,
        bandMatch[1],
        bandMatch[2],
        bandMatch[3]
      );
    }

    // A.B or A.B.x / A.B.X / A.B.* (e.g. 8.0, 8.0.x). semver treats 'x', 'X'
    // and '*' as equivalent wildcards, so all of them have to be accepted.
    const minorMatch = this.version.match(/^(\d+)\.(\d+)(?:\.[xX*])?$/);
    if (minorMatch) {
      return this.findByMajorMinor(candidates, minorMatch[1], minorMatch[2]);
    }

    // A or A.x / A.X / A.* (e.g. 8, 8.x). The online path turns a bare major
    // into a concrete channel, so the same mapping has to be applied here.
    const majorMatch = this.version.match(/^(\d+)(?:\.[xX*])?$/);
    if (majorMatch) {
      const [major, minor] = channelForMajor(majorMatch[1]).split('.');
      return this.findByMajorMinor(candidates, major, minor);
    }

    // Bare wildcards ('x', 'X', '*') resolve to the LTS channel online and
    // anything else is rejected by the resolver. Neither can be decided
    // locally, so the online path stays responsible for resolving and
    // validating the input.
    return null;
  }

  public async installDotnet(): Promise<string | null> {
    const isCrossArch =
      !!this.architecture &&
      normalizeArch(this.architecture) !== normalizeArch(os.arch());

    // When check-latest is false, try to reuse a locally installed SDK and
    // skip all network calls. Cross-architecture requests are excluded because
    // a host-arch SDK would be the wrong architecture; those always install
    // online (and fail naturally when offline).
    if (!this.checkLatest && !isCrossArch) {
      const localVersion = this.findLocalSdkVersion();
      if (localVersion) {
        core.info(
          `'check-latest' is false and a locally installed .NET SDK (${localVersion}) satisfies the '${this.version}' request. Skipping download.`
        );
        return localVersion;
      }
      core.info(
        `'check-latest' is false but no locally installed .NET SDK satisfies the '${this.version}' request. Falling back to online installation.`
      );
    }

    const versionResolver = new DotnetVersionResolver(
      this.version,
      this.quality,
      this.dotnetChannel
    );
    const dotnetVersion = await versionResolver.createDotnetVersion();

    const architectureArguments = isCrossArch
      ? [
          IS_WINDOWS ? '-InstallDir' : '--install-dir',
          IS_WINDOWS
            ? `"${path.join(DotnetInstallDir.dirPath, this.architecture!)}"`
            : path.join(DotnetInstallDir.dirPath, this.architecture!)
        ]
      : [];
    /**
     * Install dotnet runtime first in order to get
     * the latest stable version of dotnet CLI
     */
    const runtimeInstallOutput = await new DotnetInstallScript()
      .useArchitecture(this.architecture)
      // If dotnet CLI is already installed - avoid overwriting it
      .useArguments(
        IS_WINDOWS ? '-SkipNonVersionedFiles' : '--skip-non-versioned-files'
      )
      // Install only runtime + CLI
      .useArguments(IS_WINDOWS ? '-Runtime' : '--runtime', 'dotnet')
      // Use latest stable version
      .useArguments(IS_WINDOWS ? '-Channel' : '--channel', 'LTS')
      .useArguments(...architectureArguments)
      .execute();

    if (runtimeInstallOutput.exitCode) {
      /**
       * dotnetInstallScript will install CLI and runtime even if previous script haven't succeded,
       * so at this point it's too early to throw an error
       */
      core.warning(
        `Failed to install dotnet runtime + cli, exit code: ${runtimeInstallOutput.exitCode}. ${runtimeInstallOutput.stderr}`
      );
    }

    /**
     * Install dotnet over the latest version of
     * dotnet CLI
     */
    const dotnetInstallOutput = await new DotnetInstallScript()
      .useArchitecture(this.architecture)
      // Don't overwrite CLI because it should be already installed
      .useArguments(
        IS_WINDOWS ? '-SkipNonVersionedFiles' : '--skip-non-versioned-files'
      )
      // Use version provided by user
      .useVersion(dotnetVersion, this.quality)
      .useArguments(...architectureArguments)
      .execute();

    if (dotnetInstallOutput.exitCode) {
      throw new Error(
        `Failed to install dotnet, exit code: ${dotnetInstallOutput.exitCode}. ${dotnetInstallOutput.stderr}`
      );
    }

    return this.parseInstalledVersion(dotnetInstallOutput.stdout);
  }

  private parseInstalledVersion(stdout: string): string | null {
    const regex = /(?<version>\d+\.\d+\.\d+[a-z0-9._-]*)/gm;
    const matchedResult = regex.exec(stdout);

    if (!matchedResult) {
      core.warning(`Failed to parse installed by the script version of .NET`);
      return null;
    }
    return matchedResult.groups!.version;
  }
}
