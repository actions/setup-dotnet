import {readdir} from 'node:fs/promises';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import {restoreCache} from '../src/cache-restore';
import {getNuGetFolderPath} from '../src/cache-utils';
import {lockFilePatterns} from '../src/constants';

jest.mock('node:fs/promises');
jest.mock('@actions/cache');
jest.mock('@actions/core');
jest.mock('@actions/glob');
jest.mock('../src/cache-utils');

describe('cache-restore tests', () => {
  describe.each(lockFilePatterns)('restoreCache("%s")', lockFilePattern => {
    /** Store original process.env.GITHUB_WORKSPACE */
    let githubWorkspace: string | undefined;
    beforeAll(() => {
      githubWorkspace = process.env.GITHUB_WORKSPACE;
      jest.mocked(getNuGetFolderPath).mockResolvedValue({
        'global-packages': 'global-packages',
        'http-cache': 'http-cache',
        temp: 'temp',
        'plugins-cache': 'plugins-cache'
      });
    });
    beforeEach(() => {
      process.env.GITHUB_WORKSPACE = './';
      jest.mocked(glob.hashFiles).mockClear();
      jest.mocked(core.saveState).mockClear();
      jest.mocked(core.setOutput).mockClear();
      jest.mocked(cache.restoreCache).mockClear();
    });
    afterEach(() => (process.env.GITHUB_WORKSPACE = githubWorkspace));

    it('throws error when lock file is not found', async () => {
      jest.mocked(glob.hashFiles).mockResolvedValue('');

      await expect(restoreCache(lockFilePattern)).rejects.toThrow();

      expect(jest.mocked(core.saveState)).not.toHaveBeenCalled();
      expect(jest.mocked(core.setOutput)).not.toHaveBeenCalled();
      expect(jest.mocked(cache.restoreCache)).not.toHaveBeenCalled();
    });

    it('does not call core.saveState("CACHE_RESULT") when cache.restoreCache() returns falsy', async () => {
      jest.mocked(glob.hashFiles).mockResolvedValue('hash');
      jest.mocked(cache.restoreCache).mockResolvedValue(undefined);

      await restoreCache(lockFilePattern);

      const expectedKey = `dotnet-cache-${process.env.RUNNER_OS}-hash`;
      expect(jest.mocked(core.saveState)).toHaveBeenCalledWith(
        'CACHE_KEY',
        expectedKey
      );
      expect(jest.mocked(core.saveState)).not.toHaveBeenCalledWith(
        'CACHE_RESULT',
        expectedKey
      );
      expect(jest.mocked(core.setOutput)).toHaveBeenCalledWith(
        'cache-hit',
        false
      );
    });

    it('calls core.saveState("CACHE_RESULT") when cache.restoreCache() returns key', async () => {
      const expectedKey = `dotnet-cache-${process.env.RUNNER_OS}-hash`;
      jest.mocked(glob.hashFiles).mockResolvedValue('hash');
      jest.mocked(cache.restoreCache).mockResolvedValue(expectedKey);

      await restoreCache(lockFilePattern);

      expect(jest.mocked(core.saveState)).toHaveBeenCalledWith(
        'CACHE_KEY',
        expectedKey
      );
      expect(jest.mocked(core.saveState)).toHaveBeenCalledWith(
        'CACHE_RESULT',
        expectedKey
      );
      expect(jest.mocked(core.setOutput)).toHaveBeenCalledWith(
        'cache-hit',
        true
      );
    });

    it('calls glob.hashFiles("/packages.lock.json") if cacheDependencyPath is falsy', async () => {
      const expectedKey = `dotnet-cache-${process.env.RUNNER_OS}-hash`;
      jest.mocked(glob.hashFiles).mockResolvedValue('hash');
      jest.mocked(cache.restoreCache).mockResolvedValue(expectedKey);
      jest.mocked(readdir).mockResolvedValue([lockFilePattern] as any);

      await restoreCache('');

      expect(jest.mocked(glob.hashFiles)).not.toHaveBeenCalledWith('');
      expect(jest.mocked(glob.hashFiles)).toHaveBeenCalledWith(lockFilePattern);
    });
  });
});
