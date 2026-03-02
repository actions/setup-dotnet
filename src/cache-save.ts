import * as core from '@actions/core';
import * as cache from '@actions/cache';
import fs from 'node:fs';
import {getNuGetFolderPath} from './cache-utils';
import {State} from './constants';

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on('uncaughtException', e => {
  const warningPrefix = '[warning]';
  core.info(`${warningPrefix}${e.message}`);
});

export async function run() {
  try {
    if (core.getBooleanInput('cache')) {
      await cachePackages();
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

const cachePackages = async () => {
  const state = core.getState(State.CacheMatchedKey);
  const primaryKey = core.getState(State.CachePrimaryKey);

  if (!primaryKey) {
    core.info('Primary key was not generated, not saving cache.');
    return;
  }

  const {'global-packages': cachePath} = await getNuGetFolderPath();

  if (!fs.existsSync(cachePath)) {
    throw new Error(
      `Cache folder path is retrieved for .NET CLI but doesn't exist on disk: ${cachePath}`
    );
  }

  if (primaryKey === state) {
    core.info(
      `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
    );
    return;
  }

  const cacheId = await cache.saveCache([cachePath], primaryKey);
  if (cacheId == -1) {
    return;
  }

  core.info(`Cache saved with the key: ${primaryKey}`);
};

run();
