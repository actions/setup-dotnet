import {jest} from '@jest/globals';

jest.unstable_mockModule('node:fs/promises', () => ({
  readdir: jest.fn()
}));
jest.unstable_mockModule('@actions/cache', () => ({
  restoreCache: jest.fn()
}));
jest.unstable_mockModule('@actions/core', () => ({
  saveState: jest.fn(),
  setOutput: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn()
}));
jest.unstable_mockModule('@actions/glob', () => ({
  hashFiles: jest.fn()
}));
jest.unstable_mockModule('../src/cache-utils', () => ({
  getNuGetFolderPath: jest.fn()
}));

const {readdir} = await import('node:fs/promises');
const cache = await import('@actions/cache');
const core = await import('@actions/core');
const glob = await import('@actions/glob');
const {restoreCache} = await import('../src/cache-restore.js');
const {getNuGetFolderPath} = await import('../src/cache-utils.js');
const {lockFilePatterns} = await import('../src/constants.js');

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
