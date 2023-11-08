export const IS_WINDOWS = process.platform === 'win32';
export const PLATFORM = ((): 'windows' | 'linux' | 'mac' => {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'linux') return 'linux';
  return 'mac';
})();
export const isSelfHosted = (): boolean =>
  process.env['AGENT_ISSELFHOSTED'] === '1' ||
  (process.env['AGENT_ISSELFHOSTED'] === undefined &&
    process.env['RUNNER_ENVIRONMENT'] !== 'github-hosted');
