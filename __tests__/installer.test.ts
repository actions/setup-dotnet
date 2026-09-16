import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals';
import each from 'jest-each';
import semver from 'semver';
import fspromises from 'fs/promises';
import os from 'os';
import path from 'path';

jest.unstable_mockModule('@actions/exec', () => ({
  getExecOutput: jest.fn()
}));
jest.unstable_mockModule('@actions/core', () => ({
  warning: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  setOutput: jest.fn(),
  exportVariable: jest.fn((name: string, val: string) => {
    process.env[name] = val;
  }),
  addPath: jest.fn((p: string) => {
    process.env['PATH'] = `${p}${path.delimiter}${process.env['PATH']}`;
  })
}));
jest.unstable_mockModule('@actions/io', () => ({
  which: jest.fn()
}));
jest.unstable_mockModule('fs', () => {
  const actual = jest.requireActual('fs') as typeof import('fs');
  const chmodSync = jest.fn();
  const readdirSync = jest.fn();
  const existsSync = jest.fn(() => true);
  return {
    ...actual,
    chmodSync,
    readdirSync,
    existsSync,
    default: {...actual, chmodSync, readdirSync, existsSync}
  };
});

const exec = await import('@actions/exec');
const core = await import('@actions/core');
const io = await import('@actions/io');
const fs = await import('fs');
const installer = await import('../src/installer.js');
const {IS_WINDOWS} = await import('../src/utils.js');

describe('installer tests', () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {...env};
    (core.exportVariable as jest.Mock).mockImplementation(
      (...args: unknown[]) => {
        const [name, val] = args as [string, string];
        process.env[name] = val;
      }
    );
    (core.addPath as jest.Mock).mockImplementation((...args: unknown[]) => {
      const [p] = args as [string];
      process.env['PATH'] = `${p}${path.delimiter}${process.env['PATH']}`;
    });
  });

  describe('DotnetCoreInstaller tests', () => {
    const getExecOutputSpy = exec.getExecOutput as jest.Mock;
    const warningSpy = core.warning as jest.Mock;
    const whichSpy = io.which as jest.Mock;
    const maxSatisfyingSpy = jest.spyOn(semver, 'maxSatisfying');
    const chmodSyncSpy = fs.chmodSync as jest.Mock;
    const readdirSpy = jest.spyOn(fspromises, 'readdir');

    describe('installDotnet() tests', () => {
      beforeAll(() => {
        whichSpy.mockImplementation(() => Promise.resolve('PathToShell'));
        chmodSyncSpy.mockImplementation(() => {});
        readdirSpy.mockImplementation(() => Promise.resolve([]));
      });

      afterAll(() => {
        jest.resetAllMocks();
      });

      it('should throw the error in case of non-zero exit code of the installation script. The error message should contain logs.', async () => {
        const inputVersion = '10.0.101';
        const inputQuality = '';
        const errorMessage = 'fictitious error message!';

        getExecOutputSpy.mockImplementation(() => {
          return Promise.resolve({
            exitCode: 1,
            stdout: '',
            stderr: errorMessage
          });
        });

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          inputVersion,
          inputQuality
        );
        await expect(dotnetInstaller.installDotnet()).rejects.toThrow(
          `Failed to install dotnet, exit code: 1. ${errorMessage}`
        );
      });

      it('should return version of .NET SDK after installation complete', async () => {
        const inputVersion = '10.0.101';
        const inputQuality = '';
        const stdout = `Fictitious dotnet version ${inputVersion} is installed`;
        getExecOutputSpy.mockImplementation(() => {
          return Promise.resolve({
            exitCode: 0,
            stdout: `${stdout}`,
            stderr: ''
          });
        });
        maxSatisfyingSpy.mockImplementation(() => inputVersion);

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          inputVersion,
          inputQuality
        );
        const installedVersion = await dotnetInstaller.installDotnet();

        expect(installedVersion).toBe(inputVersion);
      });

      it(`should supply 'version' argument to the installation script if supplied version is in A.B.C syntax`, async () => {
        const inputVersion = '10.0.101';
        const inputQuality = '';
        const stdout = `Fictitious dotnet version ${inputVersion} is installed`;

        getExecOutputSpy.mockImplementation(() => {
          return Promise.resolve({
            exitCode: 0,
            stdout: `${stdout}`,
            stderr: ''
          });
        });
        maxSatisfyingSpy.mockImplementation(() => inputVersion);

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          inputVersion,
          inputQuality
        );

        await dotnetInstaller.installDotnet();

        /**
         * First time script would be called to
         * install runtime, here we checking only the
         * second one that installs actual SDK. i.e. 1
         */
        const callIndex = 1;

        const scriptArguments = (
          getExecOutputSpy.mock.calls[callIndex][1] as string[]
        ).join(' ');
        const expectedArgument = IS_WINDOWS
          ? `-Version ${inputVersion}`
          : `--version ${inputVersion}`;

        expect(scriptArguments).toContain(expectedArgument);
      });

      it(`should warn if the 'quality' input is set and the supplied version is in A.B.C syntax`, async () => {
        const inputVersion = '10.0.101';
        const inputQuality = 'ga';
        const stdout = `Fictitious dotnet version ${inputVersion} is installed`;
        getExecOutputSpy.mockImplementation(() => {
          return Promise.resolve({
            exitCode: 0,
            stdout: `${stdout}`,
            stderr: ''
          });
        });
        maxSatisfyingSpy.mockImplementation(() => inputVersion);

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          inputVersion,
          inputQuality
        );

        await dotnetInstaller.installDotnet();

        expect(warningSpy).toHaveBeenCalledWith(
          `The 'dotnet-quality' input can be used only with .NET SDK version in A.B, A.B.x, A, A.x and A.B.Cxx formats where the major tag is higher than 5. You specified: ${inputVersion}. 'dotnet-quality' input is ignored.`
        );
      });

      it(`should warn if the 'quality' input is set and version isn't in A.B.C syntax but major tag is lower then 6`, async () => {
        const inputVersion = '3.1';
        const inputQuality = 'ga';
        const stdout = `Fictitious dotnet version ${inputVersion} is installed`;

        getExecOutputSpy.mockImplementation(() => {
          return Promise.resolve({
            exitCode: 0,
            stdout: `${stdout}`,
            stderr: ''
          });
        });
        maxSatisfyingSpy.mockImplementation(() => inputVersion);

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          inputVersion,
          inputQuality
        );

        await dotnetInstaller.installDotnet();

        expect(warningSpy).toHaveBeenCalledWith(
          `The 'dotnet-quality' input can be used only with .NET SDK version in A.B, A.B.x, A, A.x and A.B.Cxx formats where the major tag is higher than 5. You specified: ${inputVersion}. 'dotnet-quality' input is ignored.`
        );
      });

      each(['10', '10.0', '10.0.x', '10.0.*', '10.0.X']).test(
        `should supply 'quality' argument to the installation script if quality input is set and version (%s) is not in A.B.C syntax`,
        async inputVersion => {
          const inputQuality = 'ga';
          const exitCode = 0;
          const stdout = `Fictitious dotnet version ${inputVersion} is installed`;
          getExecOutputSpy.mockImplementation(() => {
            return Promise.resolve({
              exitCode: exitCode,
              stdout: `${stdout}`,
              stderr: ''
            });
          });
          maxSatisfyingSpy.mockImplementation(() => inputVersion);

          const dotnetInstaller = new installer.DotnetCoreInstaller(
            inputVersion,
            inputQuality
          );

          await dotnetInstaller.installDotnet();

          /**
           * First time script would be called to
           * install runtime, here we checking only the
           * second one that installs actual SDK. i.e. 1
           */
          const callIndex = 1;

          const scriptArguments = (
            getExecOutputSpy.mock.calls[callIndex][1] as string[]
          ).join(' ');
          const expectedArgument = IS_WINDOWS
            ? `-Quality ${inputQuality}`
            : `--quality ${inputQuality}`;

          expect(scriptArguments).toContain(expectedArgument);
        }
      );

      each(['10', '10.0', '10.0.x', '10.0.*', '10.0.X']).test(
        `should supply 'channel' argument to the installation script if version (%s) isn't in A.B.C syntax`,
        async inputVersion => {
          const inputQuality = '';
          const exitCode = 0;
          const stdout = `Fictitious dotnet version ${inputVersion} is installed`;
          getExecOutputSpy.mockImplementation(() => {
            return Promise.resolve({
              exitCode: exitCode,
              stdout: `${stdout}`,
              stderr: ''
            });
          });
          maxSatisfyingSpy.mockImplementation(() => inputVersion);

          const dotnetInstaller = new installer.DotnetCoreInstaller(
            inputVersion,
            inputQuality
          );

          await dotnetInstaller.installDotnet();

          /**
           * First time script would be called to
           * install runtime, here we checking only the
           * second one that installs actual SDK. i.e. 1
           */
          const callIndex = 1;

          const scriptArguments = (
            getExecOutputSpy.mock.calls[callIndex][1] as string[]
          ).join(' ');
          const expectedArgument = IS_WINDOWS
            ? `-Channel 10.0`
            : `--channel 10.0`;

          expect(scriptArguments).toContain(expectedArgument);
        }
      );

      if (IS_WINDOWS) {
        it(`should supply '-ProxyAddress' argument to the installation script if env.variable 'https_proxy' is set`, async () => {
          process.env['https_proxy'] = 'https://proxy.com';
          const inputVersion = '10.0.101';
          const inputQuality = '';
          const stdout = `Fictitious dotnet version ${inputVersion} is installed`;

          getExecOutputSpy.mockImplementation(() => {
            return Promise.resolve({
              exitCode: 0,
              stdout: `${stdout}`,
              stderr: ''
            });
          });
          maxSatisfyingSpy.mockImplementation(() => inputVersion);

          const dotnetInstaller = new installer.DotnetCoreInstaller(
            inputVersion,
            inputQuality
          );

          await dotnetInstaller.installDotnet();

          /**
           * First time script would be called to
           * install runtime, here we checking only the
           * second one that installs actual SDK. i.e. 1
           */
          const callIndex = 1;

          const scriptArguments = (
            getExecOutputSpy.mock.calls[callIndex][1] as string[]
          ).join(' ');

          expect(scriptArguments).toContain(
            `-ProxyAddress ${process.env['https_proxy']}`
          );
        });

        it(`should supply '-ProxyBypassList' argument to the installation script if env.variable 'no_proxy' is set`, async () => {
          process.env['no_proxy'] = 'first.url,second.url';
          const inputVersion = '10.0.101';
          const inputQuality = '';
          const stdout = `Fictitious dotnet version ${inputVersion} is installed`;

          getExecOutputSpy.mockImplementation(() => {
            return Promise.resolve({
              exitCode: 0,
              stdout: `${stdout}`,
              stderr: ''
            });
          });
          maxSatisfyingSpy.mockImplementation(() => inputVersion);

          const dotnetInstaller = new installer.DotnetCoreInstaller(
            inputVersion,
            inputQuality
          );

          await dotnetInstaller.installDotnet();

          /**
           * First time script would be called to
           * install runtime, here we checking only the
           * second one that installs actual SDK. i.e. 1
           */
          const callIndex = 1;

          const scriptArguments = (
            getExecOutputSpy.mock.calls[callIndex][1] as string[]
          ).join(' ');

          expect(scriptArguments).toContain(
            `-ProxyBypassList ${process.env['no_proxy']}`
          );
        });
      }

      it(`should supply 'architecture' argument to the installation script when architecture is provided`, async () => {
        const inputVersion = '10.0.101';
        const inputQuality = '';
        const inputArchitecture = 'x64';
        const stdout = `Fictitious dotnet version ${inputVersion} is installed`;

        getExecOutputSpy.mockImplementation(() => {
          return Promise.resolve({
            exitCode: 0,
            stdout: `${stdout}`,
            stderr: ''
          });
        });
        maxSatisfyingSpy.mockImplementation(() => inputVersion);

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          inputVersion,
          inputQuality,
          inputArchitecture
        );

        await dotnetInstaller.installDotnet();

        const callIndex = 1;
        const scriptArguments = (
          getExecOutputSpy.mock.calls[callIndex][1] as string[]
        ).join(' ');
        const expectedArgument = IS_WINDOWS
          ? `-Architecture ${inputArchitecture}`
          : `--architecture ${inputArchitecture}`;

        expect(scriptArguments).toContain(expectedArgument);
      });

      it(`should NOT supply 'architecture' argument when architecture is not provided`, async () => {
        const inputVersion = '10.0.101';
        const inputQuality = '';
        const stdout = `Fictitious dotnet version ${inputVersion} is installed`;

        getExecOutputSpy.mockImplementation(() => {
          return Promise.resolve({
            exitCode: 0,
            stdout: `${stdout}`,
            stderr: ''
          });
        });
        maxSatisfyingSpy.mockImplementation(() => inputVersion);

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          inputVersion,
          inputQuality
        );

        await dotnetInstaller.installDotnet();

        const callIndex = 1;
        const scriptArguments = (
          getExecOutputSpy.mock.calls[callIndex][1] as string[]
        ).join(' ');

        expect(scriptArguments).not.toContain('--architecture');
        expect(scriptArguments).not.toContain('-Architecture');
      });

      it(`should supply 'install-dir' with arch subdirectory for cross-arch install`, async () => {
        const inputVersion = '10.0.101';
        const inputQuality = '';
        const inputArchitecture = 'x64';
        const stdout = `Fictitious dotnet version ${inputVersion} is installed`;

        getExecOutputSpy.mockImplementation(() => {
          return Promise.resolve({
            exitCode: 0,
            stdout: `${stdout}`,
            stderr: ''
          });
        });
        maxSatisfyingSpy.mockImplementation(() => inputVersion);

        // Mock os.arch() to return a different arch to simulate cross-arch
        const archSpy = jest.spyOn(os, 'arch').mockReturnValue('arm64');

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          inputVersion,
          inputQuality,
          inputArchitecture
        );

        await dotnetInstaller.installDotnet();

        const callIndex = 1;
        const scriptArguments = (
          getExecOutputSpy.mock.calls[callIndex][1] as string[]
        ).join(' ');

        const expectedInstallDirFlag = IS_WINDOWS
          ? '-InstallDir'
          : '--install-dir';

        expect(scriptArguments).toContain(expectedInstallDirFlag);
        expect(scriptArguments).toContain(inputArchitecture);

        archSpy.mockRestore();
      });

      it(`should NOT supply 'install-dir' when architecture matches runner's native arch`, async () => {
        const inputVersion = '10.0.101';
        const inputQuality = '';
        const nativeArch = os.arch().toLowerCase();
        const stdout = `Fictitious dotnet version ${inputVersion} is installed`;

        getExecOutputSpy.mockImplementation(() => {
          return Promise.resolve({
            exitCode: 0,
            stdout: `${stdout}`,
            stderr: ''
          });
        });
        maxSatisfyingSpy.mockImplementation(() => inputVersion);

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          inputVersion,
          inputQuality,
          nativeArch
        );

        await dotnetInstaller.installDotnet();

        const callIndex = 1;
        const scriptArguments = (
          getExecOutputSpy.mock.calls[callIndex][1] as string[]
        ).join(' ');

        expect(scriptArguments).not.toContain('--install-dir');
        expect(scriptArguments).not.toContain('-InstallDir');
      });
    });

    describe('check-latest: false (local SDK reuse) tests', () => {
      const readdirSyncSpy = fs.readdirSync as unknown as jest.Mock;
      const existsSyncSpy = fs.existsSync as unknown as jest.Mock;

      const makeDirents = (names: string[]): any =>
        names.map(name => ({
          name,
          isDirectory: () => true,
          isSymbolicLink: () => false
        }));

      const makeSymlinks = (names: string[]): any =>
        names.map(name => ({
          name,
          isDirectory: () => false,
          isSymbolicLink: () => true
        }));

      beforeEach(() => {
        getExecOutputSpy.mockClear();
        getExecOutputSpy.mockImplementation(() =>
          Promise.resolve({
            exitCode: 0,
            stdout: 'Fictitious dotnet version 1.2.3 is installed',
            stderr: ''
          })
        );
        // The dotnet muxer is expected to sit next to the SDK folders.
        existsSyncSpy.mockReturnValue(true);
      });

      afterEach(() => {
        readdirSyncSpy.mockReset();
        existsSyncSpy.mockReset();
      });

      it('reuses a locally installed pinned SDK and skips all install scripts', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.100', '8.0.422']));

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0.422',
          '',
          undefined,
          undefined,
          false
        );
        const installedVersion = await dotnetInstaller.installDotnet();

        expect(installedVersion).toBe('8.0.422');
        expect(getExecOutputSpy).not.toHaveBeenCalled();
      });

      it('falls back to online install when no local SDK matches the pinned request', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.100']));
        maxSatisfyingSpy.mockImplementation(() => '8.0.422');

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0.422',
          '',
          undefined,
          undefined,
          false
        );
        await dotnetInstaller.installDotnet();

        // Runtime pre-install + SDK install => two script executions.
        expect(getExecOutputSpy).toHaveBeenCalledTimes(2);
      });

      it('reuses the highest matching patch for a floating A.B.x request', async () => {
        readdirSyncSpy.mockReturnValue(
          makeDirents(['8.0.100', '8.0.412', '8.0.205'])
        );

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0.x',
          '',
          undefined,
          undefined,
          false
        );
        const installedVersion = await dotnetInstaller.installDotnet();

        expect(installedVersion).toBe('8.0.412');
        expect(getExecOutputSpy).not.toHaveBeenCalled();
      });

      it('matches the correct feature band for an A.B.Cxx request', async () => {
        readdirSyncSpy.mockReturnValue(
          makeDirents(['8.0.100', '8.0.105', '8.0.203'])
        );

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0.1xx',
          '',
          undefined,
          undefined,
          false
        );
        const installedVersion = await dotnetInstaller.installDotnet();

        expect(installedVersion).toBe('8.0.105');
        expect(getExecOutputSpy).not.toHaveBeenCalled();
      });

      it('rejects an A.B.Cxx request below .NET 5 instead of reusing a local SDK', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['3.1.100']));

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '3.1.1xx',
          '',
          undefined,
          undefined,
          false
        );

        // The online path owns the validation, so the error has to stay the
        // same regardless of what is installed locally.
        await expect(dotnetInstaller.installDotnet()).rejects.toThrow(
          `The 'dotnet-version' was supplied in invalid format: 3.1.1xx! The A.B.Cxx syntax is available since the .NET 5.0 release.`
        );
        expect(getExecOutputSpy).not.toHaveBeenCalled();
      });

      it('picks the highest installed SDK for a channel-less latest request', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.412', '9.0.101']));

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          'latest',
          '',
          undefined,
          undefined,
          false
        );
        const installedVersion = await dotnetInstaller.installDotnet();

        expect(installedVersion).toBe('9.0.101');
        expect(getExecOutputSpy).not.toHaveBeenCalled();
      });

      it('ignores prerelease SDKs when quality is not preview/daily', async () => {
        readdirSyncSpy.mockReturnValue(
          makeDirents(['8.0.100-preview.1', '8.0.100'])
        );

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0.x',
          '',
          undefined,
          undefined,
          false
        );
        const installedVersion = await dotnetInstaller.installDotnet();

        expect(installedVersion).toBe('8.0.100');
        expect(getExecOutputSpy).not.toHaveBeenCalled();
      });

      it('does NOT reuse a local SDK for a cross-architecture request', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.412']));
        maxSatisfyingSpy.mockImplementation(() => '8.0.412');
        const archSpy = jest.spyOn(os, 'arch').mockReturnValue('arm64');

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0.x',
          '',
          'x64',
          undefined,
          false
        );
        await dotnetInstaller.installDotnet();

        // Cross-arch always goes online (two script executions).
        expect(getExecOutputSpy).toHaveBeenCalledTimes(2);
        archSpy.mockRestore();
      });

      it('installs online when check-latest defaults to true even if SDK is local', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.422']));
        maxSatisfyingSpy.mockImplementation(() => '8.0.422');

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0.422',
          ''
        );
        await dotnetInstaller.installDotnet();

        expect(getExecOutputSpy).toHaveBeenCalledTimes(2);
      });

      it('reuses the highest installed SDK for a major-only request', async () => {
        readdirSyncSpy.mockReturnValue(
          makeDirents(['8.0.100', '8.0.412', '8.0.205'])
        );

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8',
          '',
          undefined,
          undefined,
          false
        );
        const installedVersion = await dotnetInstaller.installDotnet();

        expect(installedVersion).toBe('8.0.412');
        expect(getExecOutputSpy).not.toHaveBeenCalled();
      });

      it('reuses a prerelease SDK when quality is preview', async () => {
        readdirSyncSpy.mockReturnValue(
          makeDirents(['8.0.100-preview.1', '8.0.100-preview.2'])
        );

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0.x',
          'preview',
          undefined,
          undefined,
          false
        );
        const installedVersion = await dotnetInstaller.installDotnet();

        expect(installedVersion).toBe('8.0.100-preview.2');
        expect(getExecOutputSpy).not.toHaveBeenCalled();
      });

      it('falls back to online install when no local SDK matches a floating request', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.412']));
        maxSatisfyingSpy.mockImplementation(() => '9.0.101');

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '9.0.x',
          '',
          undefined,
          undefined,
          false
        );
        await dotnetInstaller.installDotnet();

        // No local match => runtime pre-install + SDK install (two executions).
        expect(getExecOutputSpy).toHaveBeenCalledTimes(2);
      });

      it('installs online for a latest request with an LTS channel', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.412', '9.0.101']));
        maxSatisfyingSpy.mockImplementation(() => '8.0.412');

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          'latest',
          '',
          undefined,
          'LTS',
          false
        );
        await dotnetInstaller.installDotnet();

        // LTS cannot be mapped to a version offline => online resolution.
        expect(getExecOutputSpy).toHaveBeenCalledTimes(2);
      });

      it('reuses the SDK of the requested channel for a latest request', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.412', '9.0.101']));

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          'latest',
          '',
          undefined,
          '8.0',
          false
        );
        const installedVersion = await dotnetInstaller.installDotnet();

        expect(installedVersion).toBe('8.0.412');
        expect(getExecOutputSpy).not.toHaveBeenCalled();
      });

      it('installs online for a wildcard request instead of guessing', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.412', '9.0.101']));
        maxSatisfyingSpy.mockImplementation(() => '8.0.412');

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          'x',
          '',
          undefined,
          undefined,
          false
        );
        await dotnetInstaller.installDotnet();

        // 'x' resolves to the LTS channel online, which is not known locally.
        expect(getExecOutputSpy).toHaveBeenCalledTimes(2);
      });

      it('does not reuse a local SDK below the global.json minimum version', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.100', '8.0.205']));
        maxSatisfyingSpy.mockImplementation(() => '8.0.412');

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0',
          '',
          undefined,
          undefined,
          false,
          '8.0.400'
        );
        await dotnetInstaller.installDotnet();

        // Rolling back below the global.json version would break dotnet build.
        expect(getExecOutputSpy).toHaveBeenCalledTimes(2);
      });

      it('reuses a local SDK at or above the global.json minimum version', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.100', '8.0.412']));

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0',
          '',
          undefined,
          undefined,
          false,
          '8.0.400'
        );
        const installedVersion = await dotnetInstaller.installDotnet();

        expect(installedVersion).toBe('8.0.412');
        expect(getExecOutputSpy).not.toHaveBeenCalled();
      });

      it('installs online when the dotnet muxer is missing', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.412']));
        existsSyncSpy.mockReturnValue(false);
        maxSatisfyingSpy.mockImplementation(() => '8.0.412');

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0.x',
          '',
          undefined,
          undefined,
          false
        );
        await dotnetInstaller.installDotnet();

        // An orphaned sdk folder without the CLI must not count as installed.
        expect(getExecOutputSpy).toHaveBeenCalledTimes(2);
      });

      it('reuses an SDK exposed as a symbolic link', async () => {
        readdirSyncSpy.mockReturnValue(makeSymlinks(['8.0.412']));

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0.x',
          '',
          undefined,
          undefined,
          false
        );
        const installedVersion = await dotnetInstaller.installDotnet();

        expect(installedVersion).toBe('8.0.412');
        expect(getExecOutputSpy).not.toHaveBeenCalled();
      });

      it('installs online when quality is preview but only GA SDKs are local', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.412']));
        maxSatisfyingSpy.mockImplementation(() => '8.0.412');

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0.x',
          'preview',
          undefined,
          undefined,
          false
        );
        await dotnetInstaller.installDotnet();

        expect(getExecOutputSpy).toHaveBeenCalledTimes(2);
      });

      it('matches the online channel mapping for legacy major-only requests', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['3.0.103', '3.1.426']));

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '3',
          '',
          undefined,
          undefined,
          false
        );
        const installedVersion = await dotnetInstaller.installDotnet();

        // Online a bare '3' maps to the 3.1 channel, so 3.0.103 must be ignored.
        expect(installedVersion).toBe('3.1.426');
        expect(getExecOutputSpy).not.toHaveBeenCalled();
      });

      each(['8.0.X', '8.0.x', '8.0.*', '8.0']).it(
        'reuses a local SDK for the floating request %s',
        async (version: string) => {
          readdirSyncSpy.mockReturnValue(makeDirents(['8.0.100', '8.0.412']));

          const dotnetInstaller = new installer.DotnetCoreInstaller(
            version,
            '',
            undefined,
            undefined,
            false
          );
          const installedVersion = await dotnetInstaller.installDotnet();

          expect(installedVersion).toBe('8.0.412');
          expect(getExecOutputSpy).not.toHaveBeenCalled();
        }
      );

      each(['8.X', '8.x', '8.*', '8']).it(
        'reuses a local SDK for the major-only request %s',
        async (version: string) => {
          readdirSyncSpy.mockReturnValue(makeDirents(['8.0.100', '8.0.412']));

          const dotnetInstaller = new installer.DotnetCoreInstaller(
            version,
            '',
            undefined,
            undefined,
            false
          );
          const installedVersion = await dotnetInstaller.installDotnet();

          expect(installedVersion).toBe('8.0.412');
          expect(getExecOutputSpy).not.toHaveBeenCalled();
        }
      );

      it('does not reuse a local SDK for an uppercase feature band request', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.105']));

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0.1XX',
          '',
          undefined,
          undefined,
          false
        );

        // The online resolver rejects 'A.B.CXX', so reusing it locally would
        // turn an invalid input into a silent success.
        await expect(dotnetInstaller.installDotnet()).rejects.toThrow(
          `The 'dotnet-version' was supplied in invalid format: 8.0.1XX!`
        );
      });

      each(['08.0.x', '8.00.x', '08']).it(
        'does not reuse a local SDK for the invalid request %s',
        async (version: string) => {
          readdirSyncSpy.mockReturnValue(makeDirents(['8.0.412']));

          const dotnetInstaller = new installer.DotnetCoreInstaller(
            version,
            '',
            undefined,
            undefined,
            false
          );

          // The online resolver rejects leading zeros, so matching them
          // locally would turn an invalid input into a silent success.
          await expect(dotnetInstaller.installDotnet()).rejects.toThrow(
            `The 'dotnet-version' was supplied in invalid format: ${version}!`
          );
        }
      );

      it('ignores an sdk folder that does not contain an SDK', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.412']));
        // The muxer exists, but the sdk/8.0.412 folder is empty.
        existsSyncSpy.mockImplementation(
          (target: string) => !target.includes('dotnet.dll')
        );
        maxSatisfyingSpy.mockImplementation(() => '8.0.412');

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '8.0.x',
          '',
          undefined,
          undefined,
          false
        );
        await dotnetInstaller.installDotnet();

        expect(getExecOutputSpy).toHaveBeenCalledTimes(2);
      });

      it('ignores the quality input for majors below 6 when matching locally', async () => {
        readdirSyncSpy.mockReturnValue(
          makeDirents(['3.1.426', '3.1.500-preview.1'])
        );

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '3.1',
          'preview',
          undefined,
          undefined,
          false
        );
        const installedVersion = await dotnetInstaller.installDotnet();

        // The install script ignores 'dotnet-quality' below .NET 6, so the
        // online path would select the GA build here as well.
        expect(installedVersion).toBe('3.1.426');
        expect(getExecOutputSpy).not.toHaveBeenCalled();
      });
    });

    describe('addToPath() tests', () => {
      it(`should export DOTNET_ROOT env.var with value from DOTNET_INSTALL_DIR env.var`, async () => {
        process.env['DOTNET_INSTALL_DIR'] = 'fictitious/dotnet/install/dir';
        installer.DotnetInstallDir.addToPath();
        const dotnet_root = process.env['DOTNET_ROOT'];
        expect(dotnet_root).toBe(process.env['DOTNET_INSTALL_DIR']);
      });

      it(`should export value from DOTNET_INSTALL_DIR env.var to the PATH`, async () => {
        process.env['DOTNET_INSTALL_DIR'] = 'fictitious/dotnet/install/dir';
        installer.DotnetInstallDir.addToPath();
        const path = process.env['PATH'];
        expect(path).toContain(process.env['DOTNET_INSTALL_DIR']);
      });
    });
  });

  describe('normalizeArch() tests', () => {
    it(`should normalize 'amd64' to 'x64'`, () => {
      expect(installer.normalizeArch('amd64')).toBe('x64');
    });

    it(`should normalize 'AMD64' to 'x64' (case-insensitive)`, () => {
      expect(installer.normalizeArch('AMD64')).toBe('x64');
    });

    it(`should pass through 'x64' unchanged`, () => {
      expect(installer.normalizeArch('x64')).toBe('x64');
    });

    it(`should pass through 'arm64' unchanged`, () => {
      expect(installer.normalizeArch('arm64')).toBe('arm64');
    });

    it(`should lowercase 'ARM64'`, () => {
      expect(installer.normalizeArch('ARM64')).toBe('arm64');
    });

    it(`should pass through 'x86' unchanged`, () => {
      expect(installer.normalizeArch('x86')).toBe('x86');
    });
  });

  describe('DotnetVersionResolver tests', () => {
    describe('createDotnetVersion() tests', () => {
      each([
        '10.0',
        '10.x',
        '10.0.x',
        '10.0.*',
        '10.0.X',
        '10.0.0',
        '10.0.0-preview7',
        '10.0.1xx'
      ]).test(
        'if valid version is supplied (%s), it should return version object with some value',
        async version => {
          const dotnetVersionResolver = new installer.DotnetVersionResolver(
            version
          );
          const versionObject =
            await dotnetVersionResolver.createDotnetVersion();

          expect(!!versionObject.value).toBe(true);
        }
      );

      each([
        '.',
        '..',
        ' . ',
        '. ',
        ' .',
        ' . . ',
        ' .. ',
        ' .  ',
        '-1.-1',
        '-1',
        '-1.-1.-1',
        '..3',
        '1..3',
        '1..',
        '.2.3',
        '.2.x',
        '*.',
        '1.2.',
        '1.2.-abc',
        'a.b',
        'a.b.c',
        'a.b.c-preview',
        ' 0 . 1 . 2 ',
        'invalid'
      ]).test(
        'if invalid version is supplied (%s), it should throw',
        async version => {
          const dotnetVersionResolver = new installer.DotnetVersionResolver(
            version
          );

          await expect(
            async () => await dotnetVersionResolver.createDotnetVersion()
          ).rejects.toThrow();
        }
      );

      each(['10', '10.0', '10.0.x', '10.0.*', '10.0.X', '10.0.1xx']).test(
        "if version that can be resolved to 'channel' option is supplied (%s), it should set type to 'channel' in version object",
        async version => {
          const dotnetVersionResolver = new installer.DotnetVersionResolver(
            version
          );
          const versionObject =
            await dotnetVersionResolver.createDotnetVersion();

          expect(versionObject.type.toLowerCase().includes('channel')).toBe(
            true
          );
        }
      );

      each(['10.0', '10.0.x', '10.0.*', '10.0.X', '10.0.1xx']).test(
        "if version that can be resolved to 'channel' option is supplied and its major tag is >= 6 (%s), it should set type to 'channel' and qualityFlag to 'true' in version object",
        async version => {
          const dotnetVersionResolver = new installer.DotnetVersionResolver(
            version
          );
          const versionObject =
            await dotnetVersionResolver.createDotnetVersion();

          expect(versionObject.type.toLowerCase().includes('channel')).toBe(
            true
          );
          expect(versionObject.qualityFlag).toBe(true);
        }
      );

      each(['10.0.0', '10.0.0-preview7']).test(
        "if version that can be resolved to 'version' option is supplied (%s), it should set quality flag to 'false' and type to 'version' in version object",
        async version => {
          const dotnetVersionResolver = new installer.DotnetVersionResolver(
            version
          );
          const versionObject =
            await dotnetVersionResolver.createDotnetVersion();

          expect(versionObject.type.toLowerCase().includes('version')).toBe(
            true
          );
          expect(versionObject.qualityFlag).toBe(false);
        }
      );

      each(['10.0.0', '10.0']).test(
        'it should create proper line arguments for powershell/bash installation scripts',
        async version => {
          const dotnetVersionResolver = new installer.DotnetVersionResolver(
            version
          );
          const versionObject =
            await dotnetVersionResolver.createDotnetVersion();
          const windowsRegEx = new RegExp(/^-(Version|Channel)/);
          const nonWindowsRegEx = new RegExp(/^--(version|channel)/);

          if (IS_WINDOWS) {
            expect(windowsRegEx.test(versionObject.type)).toBe(true);
            expect(nonWindowsRegEx.test(versionObject.type)).toBe(false);
          } else {
            expect(nonWindowsRegEx.test(versionObject.type)).toBe(true);
            expect(windowsRegEx.test(versionObject.type)).toBe(false);
          }
        }
      );

      it(`should throw if dotnet-version is supplied in A.B.Cxx syntax with major tag lower that 5`, async () => {
        const version = '3.0.1xx';
        const dotnetVersionResolver = new installer.DotnetVersionResolver(
          version
        );
        await expect(
          async () => await dotnetVersionResolver.createDotnetVersion()
        ).rejects.toThrow(
          `'dotnet-version' was supplied in invalid format: ${version}! The A.B.Cxx syntax is available since the .NET 5.0 release.`
        );
      });
    });
  });
});
