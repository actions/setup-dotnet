import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

import {cliCommand} from './constants';

const folders = new Set([
  'http-cache',
  'global-packages',
  'temp',
  'plugins-cache'
] as const);
type NuGetFolder = Parameters<typeof folders.has>[0];

/**
 * Get NuGet global packages, cache, and temp folders from .NET CLI.
 * @returns (Folder Name)-(Path) mappings
 * @summary This function only works in .NET Core SDK 3.1 and above.
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
    {ignoreReturnCode: true}
  );

  if (exitCode) {
    throw new Error(
      !stderr.trim()
        ? `The '${cliCommand}' command failed with exit code: ${exitCode}`
        : stderr
    );
  }

  const result: Record<NuGetFolder, string> = {
    'http-cache': '',
    'global-packages': '',
    temp: '',
    'plugins-cache': ''
  };

  const regex = /^([a-z-]+): (.+[/\\].+)$/gm;

  let m: RegExpExecArray | null;
  while ((m = regex.exec(stdout)) !== null) {
    const [, key, path] = m;
    if (folders.has(key as NuGetFolder)) {
      result[key] = path;
    }
  }

  return result;
};

export function isCacheFeatureAvailable(): boolean {
  if (cache.isFeatureAvailable()) {
    return true;
  }

  if (isGhes()) {
    throw new Error(
      'Cache action is only supported on GHES version >= 3.5. If you are on version >=3.5 Please check with GHES admin if Actions cache service is enabled or not.'
    );
  }
  core.warning(
    'The runner was not able to contact the cache service. Caching will be skipped'
  );

  return false;

  function isGhes(): boolean {
    const url = process.env['GITHUB_SERVER_URL'] || 'https://github.com';
    return new URL(url).hostname.toUpperCase() !== 'GITHUB.COM';
  }
}
