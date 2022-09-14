import * as core from '@actions/core';

export const IS_WINDOWS = process.platform === 'win32';
export const IS_LINUX = process.platform === 'linux';

export function logWarning(message: string): void {
  const warningPrefix = '[warning]';
  core.info(`${warningPrefix}${message}`);
}
