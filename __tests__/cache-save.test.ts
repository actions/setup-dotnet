import {jest} from '@jest/globals';

jest.unstable_mockModule('@actions/cache', () => ({
  saveCache: jest.fn()
}));
jest.unstable_mockModule('@actions/core', () => ({
  setFailed: jest.fn(),
  getState: jest.fn(),
  setOutput: jest.fn(),
  getBooleanInput: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn()
}));
jest.unstable_mockModule('node:fs', () => ({
  default: {
    existsSync: jest.fn()
  }
}));
jest.unstable_mockModule('../src/cache-utils', () => ({
  getNuGetFolderPath: jest.fn()
}));

const cache = await import('@actions/cache');
const core = await import('@actions/core');
const fs = (await import('node:fs')).default;
const {run} = await import('../src/cache-save.js');
const {getNuGetFolderPath} = await import('../src/cache-utils.js');
const {State} = await import('../src/constants.js');

describe('cache-save tests', () => {
  beforeAll(() => {
    jest.mocked(getNuGetFolderPath).mockResolvedValue({
      'global-packages': 'global-packages',
      'http-cache': 'http-cache',
      temp: 'temp',
      'plugins-cache': 'plugins-cache'
    });
  });
  beforeEach(() => {
    jest.mocked(core.setFailed).mockClear();
    jest.mocked(core.getState).mockClear();
    jest.mocked(core.setOutput).mockClear();
    jest.mocked(cache.saveCache).mockClear();
    jest.mocked(fs.existsSync).mockClear();
  });

  it('does not save cache when inputs:cache === false', async () => {
    jest.mocked(core.getBooleanInput).mockReturnValue(false);

    await run();

    expect(jest.mocked(core.setFailed)).not.toHaveBeenCalled();
    expect(jest.mocked(core.getState)).not.toHaveBeenCalled();
    expect(jest.mocked(fs.existsSync)).not.toHaveBeenCalled();
    expect(jest.mocked(cache.saveCache)).not.toHaveBeenCalled();
  });

  it('does not save cache when core.getState("CACHE_KEY") returns ""', async () => {
    jest.mocked(core.getBooleanInput).mockReturnValue(true);
    jest.mocked(core.getState).mockReturnValue('');

    await run();

    expect(jest.mocked(core.setFailed)).not.toHaveBeenCalled();
    expect(jest.mocked(core.getState)).toHaveBeenCalledTimes(2);
    expect(jest.mocked(fs.existsSync)).not.toHaveBeenCalled();
    expect(jest.mocked(cache.saveCache)).not.toHaveBeenCalled();
  });

  it('throws Error when cachePath not exists', async () => {
    jest.mocked(core.getBooleanInput).mockReturnValue(true);
    jest.mocked(core.getState).mockReturnValue('cache-key');
    jest.mocked(fs.existsSync).mockReturnValue(false);

    await run();

    expect(jest.mocked(core.setFailed)).toHaveBeenCalled();
    expect(jest.mocked(core.getState)).toHaveBeenCalledTimes(2);
    expect(jest.mocked(cache.saveCache)).not.toHaveBeenCalled();
  });

  it('does not save cache when state.CACHE_KEY === state.CACHE_RESULT', async () => {
    jest.mocked(core.getBooleanInput).mockReturnValue(true);
    jest.mocked(core.getState).mockReturnValue('cache-key');
    jest.mocked(fs.existsSync).mockReturnValue(true);

    await run();

    expect(jest.mocked(core.setFailed)).not.toHaveBeenCalled();
    expect(jest.mocked(core.getState)).toHaveBeenCalledTimes(2);
    expect(jest.mocked(cache.saveCache)).not.toHaveBeenCalled();
  });

  it('saves cache when state.CACHE_KEY !== state.CACHE_RESULT', async () => {
    jest.mocked(core.getBooleanInput).mockReturnValue(true);
    jest.mocked(core.getState).mockImplementation(s => s);
    jest.mocked(fs.existsSync).mockReturnValue(true);

    await run();

    expect(jest.mocked(core.setFailed)).not.toHaveBeenCalled();
    expect(jest.mocked(core.getState)).toHaveBeenCalledTimes(2);
    expect(jest.mocked(cache.saveCache)).toHaveBeenCalled();
  });

  it('does not fail and traces when saveCache returns -1', async () => {
    jest.mocked(core.getBooleanInput).mockReturnValue(true);
    jest.mocked(core.getState).mockImplementation(s => s);
    jest.mocked(fs.existsSync).mockReturnValue(true);
    jest.mocked(cache.saveCache).mockResolvedValue(-1);

    await run();

    expect(jest.mocked(core.setFailed)).not.toHaveBeenCalled();
    expect(jest.mocked(cache.saveCache)).toHaveBeenCalled();
    expect(jest.mocked(core.debug)).toHaveBeenCalledWith(
      `Cache was not saved for the key: ${State.CachePrimaryKey}`
    );
    expect(jest.mocked(core.info)).not.toHaveBeenCalledWith(
      `Cache saved with the key: ${State.CachePrimaryKey}`
    );
  });
});
