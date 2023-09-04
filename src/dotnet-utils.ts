import * as exec from '@actions/exec';

export const listSdks = async () => {
  const {stdout, exitCode} = await exec
    .getExecOutput('dotnet', ['--list-sdks'], {
      ignoreReturnCode: true
    })
    .catch(() => ({stdout: '', exitCode: 1}));

  if (exitCode) {
    return [];
  }

  return (
    stdout
      .trim()
      .split('\n')
      .map(versionInfo => versionInfo.trim())
      .map(versionInfo => versionInfo.split(' ')[0])
      // reverses output so newer versions are first
      .reverse()
  );
};

/**
 * Function that matches string like that
 * '3.1', '3.1.x', '3', '3.x', '6.0.4xx' to
 * correct version number like '3.1.201', '3.1.201', '3.1.201', '3.1.201', '6.0.402'
 */
export const matchVersionToList = (version: string, versions: string[]) => {
  const versionRegex = new RegExp(`^${version.replace(/x/g, '\\d+')}`);
  const matchedVersion = versions.find(v => versionRegex.test(v));

  return matchedVersion;
};
