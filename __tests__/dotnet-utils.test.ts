import * as dotnetUtils from '../src/dotnet-utils';
import * as exec from '@actions/exec';

describe('dotnet-utils', () => {
  describe('matchVersionToList', () => {
    it('matches all versions with all syntaxes correctly', () => {
      expect(
        dotnetUtils.matchVersionToList('3.1', ['3.1.201', '6.0.402'])
      ).toEqual('3.1.201');
      expect(
        dotnetUtils.matchVersionToList('3.1.x', ['3.1.201', '6.0.402'])
      ).toEqual('3.1.201');
      expect(
        dotnetUtils.matchVersionToList('3', ['3.1.201', '6.0.402'])
      ).toEqual('3.1.201');
      expect(
        dotnetUtils.matchVersionToList('3.x', ['3.1.201', '6.0.402'])
      ).toEqual('3.1.201');
      expect(
        dotnetUtils.matchVersionToList('6.0.4xx', ['3.1.201', '6.0.402'])
      ).toEqual('6.0.402');
    });

    it('returns undefined if no version is matched', () => {
      expect(
        dotnetUtils.matchVersionToList('6.0.5xx', ['3.1.201', '6.0.403'])
      ).toEqual(undefined);
      expect(dotnetUtils.matchVersionToList('6.0.5xx', [])).toEqual(undefined);
    });

    it("returns the first version if 'x' or '*' version is provided", () => {
      expect(
        dotnetUtils.matchVersionToList('x', ['3.1.201', '6.0.403'])
      ).toEqual('3.1.201');
      expect(
        dotnetUtils.matchVersionToList('*', ['3.1.201', '6.0.403'])
      ).toEqual('3.1.201');
    });

    it('returns undefined if empty version list is provided', () => {
      expect(dotnetUtils.matchVersionToList('6.0.4xx', [])).toEqual(undefined);
    });
  });

  describe('listSdks', () => {
    const execSpy = jest.spyOn(exec, 'getExecOutput');

    it('correctly parses versions from output and sorts them from newest to oldest', async () => {
      const stdout = `
        2.2.207 [C:\\Users\\User_Name\\AppData\\Local\\Microsoft\\dotnet\\sdk]
        6.0.413 [C:\\Users\\User_Name\\AppData\\Local\\Microsoft\\dotnet\\sdk]
        6.0.414 [C:\\Users\\User_Name\\AppData\\Local\\Microsoft\\dotnet\\sdk]
      `;

      execSpy.mockImplementationOnce(() =>
        Promise.resolve({stdout, exitCode: 0, stderr: ''})
      );
      expect(await dotnetUtils.listSdks()).toEqual([
        '6.0.414',
        '6.0.413',
        '2.2.207'
      ]);
    });

    it('returns empty array if exit code is not 0', async () => {
      execSpy.mockImplementationOnce(() =>
        Promise.resolve({stdout: '', exitCode: 1, stderr: 'arbitrary error'})
      );
      expect(await dotnetUtils.listSdks()).toEqual([]);
    });

    it('returns empty array on error', async () => {
      execSpy.mockImplementationOnce(() =>
        Promise.reject(new Error('arbitrary error'))
      );
      expect(await dotnetUtils.listSdks()).toEqual([]);
    });
  });
});
