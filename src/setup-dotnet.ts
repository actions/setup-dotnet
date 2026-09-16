import * as core from '@actions/core';
import * as exec from '@actions/exec';
import {
  DotnetCoreInstaller,
  DotnetInstallDir,
  normalizeArch
} from './installer.js';
import * as fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import semver from 'semver';
import os from 'os';
import * as auth from './authutil.js';
import {isCacheFeatureAvailable} from './cache-utils.js';
import {restoreCache} from './cache-restore.js';
import {Outputs} from './constants.js';
import JSON5 from 'json5';

const qualityOptions = ['daily', 'preview', 'ga'] as const;
const supportedArchitectures = [
  'x64',
  'x86',
  'arm64',
  'amd64',
  'arm',
  's390x',
  'ppc64le',
  'riscv64'
] as const;
type SupportedArchitecture = (typeof supportedArchitectures)[number];

export type QualityOptions = (typeof qualityOptions)[number] | '';

/**
 * Environment variable that mirrors the 'check-latest' input. Workflows that
 * GitHub generates and runs on the user's behalf (Automatic Dependency
 * Submission, for example) cannot be edited, so the runner environment is the
 * only configuration surface their users have.
 */
const CHECK_LATEST_ENV_VAR = 'DOTNET_CHECK_LATEST';

function isValidChannel(channel: string): boolean {
  const upper = channel.toUpperCase();
  if (upper === 'LTS' || upper === 'STS') return true;
  // A.B format (e.g., 3.1, 8.0)
  if (/^\d+\.\d+$/.test(channel)) return true;
  // A.B.Cxx format (e.g., 8.0.1xx) - available since 5.0
  const match = channel.match(/^(?<major>\d+)\.\d+\.\d{1}xx$/);
  if (match && parseInt(match.groups!.major) >= 5) return true;
  return false;
}

export async function run() {
  try {
    //
    // dotnet-version is optional, but needs to be provided for most use cases.
    // If supplied, install / use from the tool cache.
    // global-version-file may be specified to point to a specific global.json
    // and will be used to install an additional version.
    // If not supplied, look for version in ./global.json.
    // If a valid version still can't be identified, nothing will be installed.
    // Proxy, auth, (etc) are still set up, even if no version is identified
    //
    const versions = core.getMultilineInput('dotnet-version');
    // Version spec -> lowest SDK version accepted for it. Only global.json with
    // a 'rollForward' policy sets a floor, because rolling forward widens the
    // spec while the declared version stays the minimum.
    const minimumVersions = new Map<string, string>();
    const addVersionFromGlobalJson = (globalJsonPath: string) => {
      const {version, minimumVersion} =
        getVersionFromGlobalJson(globalJsonPath);
      versions.push(version);
      if (minimumVersion) {
        minimumVersions.set(version, minimumVersion);
      }
    };
    const installedDotnetVersions: (string | null)[] = [];
    const architecture = getArchitectureInput();
    const checkLatest = getCheckLatestInput();
    let dotnetChannel = core.getInput('dotnet-channel');

    const isLatestRequested = versions.some(
      version => version && version.toLowerCase() === 'latest'
    );
    if (dotnetChannel && !isValidChannel(dotnetChannel)) {
      if (isLatestRequested) {
        throw new Error(
          `Value '${dotnetChannel}' is not supported for the 'dotnet-channel' option. Supported values are: LTS, STS, A.B (e.g. 8.0), A.B.Cxx (e.g. 8.0.1xx).`
        );
      } else {
        core.warning(
          `Value '${dotnetChannel}' is not supported for the 'dotnet-channel' option and will be ignored because 'dotnet-version' is not set to 'latest'. Supported values are: LTS, STS, A.B (e.g. 8.0), A.B.Cxx (e.g. 8.0.1xx).`
        );
        dotnetChannel = '';
      }
    } else if (dotnetChannel && !isLatestRequested) {
      core.warning(
        `The 'dotnet-channel' input is only supported when 'dotnet-version' is set to 'latest'.`
      );
      dotnetChannel = '';
    }

    const globalJsonFileInput = core.getInput('global-json-file');
    if (globalJsonFileInput) {
      const globalJsonPath = path.resolve(process.cwd(), globalJsonFileInput);
      if (!fs.existsSync(globalJsonPath)) {
        throw new Error(
          `The specified global.json file '${globalJsonFileInput}' does not exist`
        );
      }
      addVersionFromGlobalJson(globalJsonPath);
    }

    if (!versions.length) {
      // Try to fall back to global.json
      core.debug('No version found, trying to find version from global.json');
      const globalJsonPath = path.join(process.cwd(), 'global.json');
      if (fs.existsSync(globalJsonPath)) {
        addVersionFromGlobalJson(globalJsonPath);
      } else {
        core.info(
          `The global.json wasn't found in the root directory. No .NET version will be installed.`
        );
      }
    }

    if (versions.length) {
      const quality = core.getInput('dotnet-quality') as QualityOptions;

      if (quality && !qualityOptions.includes(quality)) {
        throw new Error(
          `Value '${quality}' is not supported for the 'dotnet-quality' option. Supported values are: daily, preview, ga.`
        );
      }

      let dotnetInstaller: DotnetCoreInstaller;
      const uniqueVersions = new Set<string>(
        versions.map(v => (v.toLowerCase() === 'latest' ? 'latest' : v))
      );
      for (const version of uniqueVersions) {
        dotnetInstaller = new DotnetCoreInstaller(
          version,
          quality,
          architecture,
          version.toLowerCase() === 'latest' ? dotnetChannel : undefined,
          checkLatest,
          minimumVersions.get(version)
        );
        const installedVersion = await dotnetInstaller.installDotnet();
        installedDotnetVersions.push(installedVersion);
      }
      if (
        architecture &&
        normalizeArch(architecture) !== normalizeArch(os.arch())
      ) {
        process.env['DOTNET_INSTALL_DIR'] = path.join(
          DotnetInstallDir.dirPath,
          architecture
        );
      }
      DotnetInstallDir.addToPath();

      const workloadsInput = core.getInput('workloads');
      if (workloadsInput) {
        const workloads = workloadsInput
          .split(',')
          .map(w => w.trim())
          .filter(Boolean);

        if (workloads.length) {
          try {
            core.info(`Refreshing workload manifests...`);
            await exec.exec('dotnet', ['workload', 'update']);

            core.info(`Installing workloads: ${workloads.join(', ')}`);
            await exec.exec('dotnet', ['workload', 'install', ...workloads]);
          } catch (err) {
            throw new Error(
              `Failed to install workloads [${workloads.join(', ')}]: ${err}`,
              {cause: err}
            );
          }
        }
      }
    }

    const sourceUrl: string = core.getInput('source-url');
    const configFile: string = core.getInput('config-file');
    if (sourceUrl) {
      auth.configAuthentication(sourceUrl, configFile);
    }

    outputInstalledVersion(installedDotnetVersions, globalJsonFileInput);

    if (core.getBooleanInput('cache') && isCacheFeatureAvailable()) {
      const cacheDependencyPath = core.getInput('cache-dependency-path');
      await restoreCache(cacheDependencyPath);
    }

    const matchersPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      '.github'
    );
    core.info(`##[add-matcher]${path.join(matchersPath, 'csc.json')}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

function getArchitectureInput(): SupportedArchitecture | '' {
  const raw = (core.getInput('architecture') || '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  if ((supportedArchitectures as readonly string[]).includes(normalized)) {
    return normalizeArch(normalized) as SupportedArchitecture;
  }
  throw new Error(
    `Value '${raw}' is not supported for the 'architecture' option. Supported values are: ${supportedArchitectures.join(
      ', '
    )}.`
  );
}

/**
 * Resolves 'check-latest' from the workflow input, then from
 * DOTNET_CHECK_LATEST, then from the default. 'action.yml' deliberately
 * declares no default for the input: the runner materializes action defaults
 * into INPUT_CHECK_LATEST, which would make the input look explicitly set on
 * every run and hide the environment variable.
 */
function getCheckLatestInput(): boolean {
  // An explicitly supplied input always wins and is validated strictly.
  if ((core.getInput('check-latest') || '').trim()) {
    return core.getBooleanInput('check-latest');
  }

  const rawEnvValue = (process.env[CHECK_LATEST_ENV_VAR] || '').trim();
  if (rawEnvValue) {
    const envValue = rawEnvValue.toLowerCase();
    if (envValue === 'true' || envValue === 'false') {
      core.debug(
        `The 'check-latest' option is set to '${envValue}' by the ${CHECK_LATEST_ENV_VAR} environment variable.`
      );
      return envValue === 'true';
    }
    // A generated workflow cannot be corrected by the user, so an unusable
    // value must warn and fall back instead of failing the run.
    core.warning(
      `Value '${rawEnvValue}' is not supported for the ${CHECK_LATEST_ENV_VAR} environment variable. Supported values are: true, false. The 'check-latest' option falls back to 'true'.`
    );
  }

  return true;
}

interface GlobalJsonVersion {
  /** The version spec handed to the installer. */
  version: string;
  /**
   * Lowest SDK version that still satisfies global.json. Set only when
   * 'rollForward' widened the spec, because rolling forward never allows an
   * SDK older than the declared version.
   */
  minimumVersion?: string;
}

function getVersionFromGlobalJson(globalJsonPath: string): GlobalJsonVersion {
  let version = '';
  let minimumVersion: string | undefined;
  const globalJson = JSON5.parse(
    // .trim() is necessary to strip BOM https://github.com/nodejs/node/issues/20649
    fs.readFileSync(globalJsonPath, {encoding: 'utf8'}).trim(),
    // is necessary as JSON5 supports wider variety of options for numbers: https://www.npmjs.com/package/json5#numbers
    (key, value) => {
      if (key === 'version' || key === 'rollForward') return String(value);
      return value;
    }
  );
  if (globalJson.sdk && globalJson.sdk.version) {
    version = globalJson.sdk.version;
    const rollForward = globalJson.sdk.rollForward;
    if (rollForward && !semver.prerelease(version)) {
      const versionPattern = /^\d+\.\d+\.[1-9]\d{2,}$/;
      if (!versionPattern.test(version)) {
        throw new Error(
          `Version '${version}' is not valid for the 'sdk.version' value in global.json. ` +
            `When 'rollForward' is specified, a full SDK version is required. ` +
            `See: https://learn.microsoft.com/en-us/dotnet/core/tools/global-json`
        );
      }

      const [major, minor, featurePatch] = version.split('.');
      const feature = featurePatch.substring(0, 1);

      switch (rollForward) {
        case 'latestMajor':
          version = '';
          break;

        case 'latestMinor':
          version = `${major}`;
          break;

        case 'latestFeature':
          version = `${major}.${minor}`;
          break;

        case 'latestPatch':
          version = `${major}.${minor}.${feature}xx`;
          break;
      }

      if (version !== globalJson.sdk.version) {
        minimumVersion = globalJson.sdk.version;
      }
    }
  }
  return {version, minimumVersion};
}

function outputInstalledVersion(
  installedVersions: (string | null)[],
  globalJsonFileInput: string
): void {
  if (!installedVersions.length) {
    core.info(`The '${Outputs.DotnetVersion}' output will not be set.`);
    return;
  }

  if (installedVersions.includes(null)) {
    core.warning(
      `Failed to output the installed version of .NET. The '${Outputs.DotnetVersion}' output will not be set.`
    );
    return;
  }

  if (globalJsonFileInput) {
    const versionToOutput = installedVersions.at(-1); // .NET SDK version parsed from the global.json file is installed last
    core.setOutput(Outputs.DotnetVersion, versionToOutput);
    return;
  }

  const versionToOutput = semver.maxSatisfying(
    installedVersions as string[],
    '*',
    {
      includePrerelease: true
    }
  );

  core.setOutput(Outputs.DotnetVersion, versionToOutput);
}

run();
