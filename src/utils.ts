export const IS_WINDOWS = process.platform === 'win32';
export const IS_LINUX = process.platform === 'linux';
export const getPlatform = (): 'windows' | 'linux' | 'mac' => {
  if (IS_WINDOWS) return 'windows';
  if (IS_LINUX) return 'linux';
  return 'mac';
};
