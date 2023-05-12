import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

import {cliCommand} from './constants';

type NuGetFolderName =
  | 'http-cache'
  | 'global-packages'
  | 'temp'
  | 'plugins-cache';

/**
 * Get NuGet global packages, cache, and temp folders from .NET CLI.
 * @returns (Folder Name)-(Path) mappings
 * @see https://docs.microsoft.com/nuget/consume-packages/managing-the-global-packages-and-cache-folders
 * @example
 * Windows
 * ```json
 * {
 *   "http-cache": "C:\\Users\\user1\\AppData\\Local\\NuGet\\v3-cache",
 *   "global-packages": "C:\\Users\\user1\\.nuget\\packages\\",
 *   "temp": "C:\\Users\\user1\\AppData\\Local\\Temp\\NuGetScratch",
 *   "plugins-cache": "C:\\Users\\user1\\AppData\\Local\\NuGet\\plugins-cache"
 * }
 * ```
 *
 * Mac/Linux
 * ```json
 * {
 *   "http-cache": "/home/user1/.local/share/NuGet/v3-cache",
 *   "global-packages": "/home/user1/.nuget/packages/",
 *   "temp": "/tmp/NuGetScratch",
 *   "plugins-cache": "/home/user1/.local/share/NuGet/plugins-cache"
 * }
 * ```
 */
export const getNuGetFolderPath = async () => {
  const {stdout, stderr, exitCode} = await exec.getExecOutput(
    cliCommand,
    undefined,
    {ignoreReturnCode: true, silent: true}
  );

  if (exitCode) {
    throw new Error(
      !stderr.trim()
        ? `The '${cliCommand}' command failed with exit code: ${exitCode}`
        : stderr
    );
  }

  const result: Record<NuGetFolderName, string> = {
    'http-cache': '',
    'global-packages': '',
    temp: '',
    'plugins-cache': ''
  };

  const regex = /(?:^|\s)(?<key>[a-z-]+): (?<path>.+[/\\].+)$/gm;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(stdout)) !== null) {
    const key = match.groups!.key;
    if ((key as NuGetFolderName) in result) {
      result[key] = match.groups!.path;
    }
  }

  return result;
};

export function isCacheFeatureAvailable(): boolean {
  if (cache.isFeatureAvailable()) {
    return true;
  }

  if (isGhes()) {
    core.warning(
      'Cache action is only supported on GHES version >= 3.5. If you are on version >=3.5 Please check with GHES admin if Actions cache service is enabled or not.'
    );
    return false;
  }
  core.warning(
    'The runner was not able to contact the cache service. Caching will be skipped'
  );

  return false;
}

/**
 * Returns this action runs on GitHub Enterprise Server or not.
 * (port from https://github.com/actions/toolkit/blob/457303960f03375db6f033e214b9f90d79c3fe5c/packages/cache/src/internal/cacheUtils.ts#L134)
 */
function isGhes(): boolean {
  const url = process.env['GITHUB_SERVER_URL'] || 'https://github.com';
  return new URL(url).hostname.toUpperCase() !== 'GITHUB.COM';
}
