import * as cache from '@actions/cache';
import * as core from '@actions/core';
import fs from 'node:fs';
import {run} from '../src/cache-save';
import {getNuGetFolderPath} from '../src/cache-utils';

jest.mock('@actions/cache');
jest.mock('@actions/core');
jest.mock('node:fs');
jest.mock('../src/cache-utils');

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
});
