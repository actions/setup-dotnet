import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';

import {getNuGetFolderPath} from './cache-utils';
import {lockFilePattern, State, Outputs} from './constants';

export const restoreCache = async (cacheDependencyPath?: string) => {
  const fileHash = await glob.hashFiles(cacheDependencyPath || lockFilePattern);
  if (!fileHash) {
    throw new Error(
      'Some specified paths were not resolved, unable to cache dependencies.'
    );
  }

  const platform = process.env.RUNNER_OS;
  const primaryKey = `dotnet-cache-${platform}-${fileHash}`;
  core.debug(`primary key is ${primaryKey}`);

  core.saveState(State.CachePrimaryKey, primaryKey);

  const {'global-packages': cachePath} = await getNuGetFolderPath();
  const cacheKey = await cache.restoreCache([cachePath], primaryKey);
  core.setOutput(Outputs.CacheHit, Boolean(cacheKey));

  if (!cacheKey) {
    core.info('dotnet cache is not found');
    return;
  }

  core.saveState(State.CacheMatchedKey, cacheKey);
  core.info(`Cache restored from key: ${cacheKey}`);
};
