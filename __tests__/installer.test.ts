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
  const statSync = jest.fn(() => ({isFile: () => true}));
  const accessSync = jest.fn();
  return {
    ...actual,
    chmodSync,
    readdirSync,
    existsSync,
    statSync,
    accessSync,
    default: {
      ...actual,
      chmodSync,
      readdirSync,
      existsSync,
      statSync,
      accessSync
    }
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
      const statSyncSpy = fs.statSync as unknown as jest.Mock;
      const accessSyncSpy = fs.accessSync as unknown as jest.Mock;

      const asFile = {isFile: () => true};
      const muxerName = IS_WINDOWS ? 'dotnet.exe' : 'dotnet';
      const isMuxer = (target: unknown) => String(target).endsWith(muxerName);
      const throwEnoent = () => {
        throw new Error('ENOENT');
      };

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
        statSyncSpy.mockReturnValue(asFile);
        accessSyncSpy.mockImplementation(() => undefined);
      });

      afterEach(() => {
        readdirSyncSpy.mockReset();
        statSyncSpy.mockReset();
        accessSyncSpy.mockReset();
      });

      interface LocalReuseCase {
        name: string;
        version: string;
        quality?: string;
        dotnetChannel?: string;
        minimumVersion?: string;
        installed: string[];
        expected: string | null;
      }

      const localReuseCases: LocalReuseCase[] = [
        {
          name: 'reuses a locally installed pinned SDK and skips all install scripts',
          version: '8.0.422',
          installed: ['8.0.100', '8.0.422'],
          expected: '8.0.422'
        },
        {
          name: 'falls back to online install when no local SDK matches the pinned request',
          version: '8.0.422',
          installed: ['8.0.100'],
          expected: null
        },
        {
          name: 'reuses the highest matching patch for a floating A.B.x request',
          version: '8.0.x',
          installed: ['8.0.100', '8.0.412', '8.0.205'],
          expected: '8.0.412'
        },
        {
          name: 'matches the correct feature band for an A.B.Cxx request',
          version: '8.0.1xx',
          installed: ['8.0.100', '8.0.105', '8.0.203'],
          expected: '8.0.105'
        },
        {
          name: 'picks the highest installed SDK for a channel-less latest request',
          version: 'latest',
          installed: ['8.0.412', '9.0.101'],
          expected: '9.0.101'
        },
        {
          name: 'ignores prerelease SDKs when quality is not preview/daily',
          version: '8.0.x',
          installed: ['8.0.100-preview.1', '8.0.100'],
          expected: '8.0.100'
        },
        {
          name: 'reuses the highest installed SDK for a major-only request',
          version: '8',
          installed: ['8.0.100', '8.0.412', '8.0.205'],
          expected: '8.0.412'
        },
        {
          name: 'reuses a prerelease SDK when quality is preview',
          version: '8.0.x',
          quality: 'preview',
          installed: ['8.0.100-preview.1', '8.0.100-preview.2'],
          expected: '8.0.100-preview.2'
        },
        {
          name: 'falls back to online install when no local SDK matches a floating request',
          version: '9.0.x',
          installed: ['8.0.412'],
          expected: null
        },
        {
          name: 'installs online for a latest request with an LTS channel',
          version: 'latest',
          dotnetChannel: 'LTS',
          installed: ['8.0.412', '9.0.101'],
          expected: null
        },
        {
          name: 'reuses the SDK of the requested channel for a latest request',
          version: 'latest',
          dotnetChannel: '8.0',
          installed: ['8.0.412', '9.0.101'],
          expected: '8.0.412'
        },
        {
          name: 'installs online for a wildcard request instead of guessing',
          version: 'x',
          installed: ['8.0.412', '9.0.101'],
          expected: null
        },
        {
          name: 'does not reuse a local SDK below the global.json minimum version',
          version: '8.0',
          minimumVersion: '8.0.400',
          installed: ['8.0.100', '8.0.205'],
          expected: null
        },
        {
          name: 'reuses a local SDK at or above the global.json minimum version',
          version: '8.0',
          minimumVersion: '8.0.400',
          installed: ['8.0.100', '8.0.412'],
          expected: '8.0.412'
        },
        {
          name: 'installs online when quality is preview but only GA SDKs are local',
          version: '8.0.x',
          quality: 'preview',
          installed: ['8.0.412'],
          expected: null
        },
        {
          name: 'ignores the quality input for majors below 6 when matching locally',
          version: '3.1',
          quality: 'preview',
          installed: ['3.1.426', '3.1.500-preview.1'],
          expected: '3.1.426'
        }
      ];

      each(localReuseCases).it(
        '$name',
        async ({
          version,
          quality = '',
          dotnetChannel,
          minimumVersion,
          installed,
          expected
        }: LocalReuseCase) => {
          readdirSyncSpy.mockReturnValue(makeDirents(installed));
          maxSatisfyingSpy.mockImplementation(() => '8.0.412');

          const installedVersion = await new installer.DotnetCoreInstaller(
            version,
            quality as any,
            undefined,
            dotnetChannel,
            false,
            minimumVersion
          ).installDotnet();

          if (expected === null) {
            expect(getExecOutputSpy).toHaveBeenCalledTimes(2);
          } else {
            expect(installedVersion).toBe(expected);
            expect(getExecOutputSpy).not.toHaveBeenCalled();
          }
        }
      );

      it('rejects an A.B.Cxx request below .NET 5 instead of reusing a local SDK', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['3.1.100']));

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          '3.1.1xx',
          '',
          undefined,
          undefined,
          false
        );

        await expect(dotnetInstaller.installDotnet()).rejects.toThrow(
          `The 'dotnet-version' was supplied in invalid format: 3.1.1xx! The A.B.Cxx syntax is available since the .NET 5.0 release.`
        );
        expect(getExecOutputSpy).not.toHaveBeenCalled();
      });

      each(['preview', 'daily'] as const).it(
        "reuses the highest local prerelease SDK for a channel-less latest request with '%s' quality",
        async quality => {
          readdirSyncSpy.mockReturnValue(
            makeDirents(['8.0.412', '9.0.100-preview.1', '9.0.100-preview.2'])
          );

          const dotnetInstaller = new installer.DotnetCoreInstaller(
            'latest',
            quality,
            undefined,
            undefined,
            false
          );
          const installedVersion = await dotnetInstaller.installDotnet();

          expect(installedVersion).toBe('9.0.100-preview.2');
          expect(getExecOutputSpy).not.toHaveBeenCalled();
        }
      );

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

      it('installs online when the dotnet muxer is missing', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.412']));
        statSyncSpy.mockImplementation((target: string) => {
          if (isMuxer(target)) {
            throwEnoent();
          }
          return asFile;
        });
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

      const itOnPosix = IS_WINDOWS ? it.skip : it;

      itOnPosix(
        'installs online when the dotnet muxer is not executable',
        async () => {
          readdirSyncSpy.mockReturnValue(makeDirents(['8.0.412']));
          accessSyncSpy.mockImplementation((target: string) => {
            if (isMuxer(target)) {
              throw new Error('EACCES');
            }
          });
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
        }
      );

      it('installs online when the dotnet muxer path is a directory', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.412']));
        statSyncSpy.mockImplementation((target: string) =>
          isMuxer(target) ? {isFile: () => false} : asFile
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

          await expect(dotnetInstaller.installDotnet()).rejects.toThrow(
            `The 'dotnet-version' was supplied in invalid format: ${version}!`
          );
        }
      );

      it('ignores an sdk folder that does not contain an SDK', async () => {
        readdirSyncSpy.mockReturnValue(makeDirents(['8.0.412']));
        statSyncSpy.mockImplementation((target: string) => {
          if (String(target).includes('dotnet.dll')) {
            throwEnoent();
          }
          return asFile;
        });
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

      describe('global.json rollForward tests', () => {
        interface RollForwardCase {
          name: string;
          version?: string;
          quality?: string;
          minimumVersion?: string;
          rollForward?: string;
          installed: string[];
          expected: string | null;
        }

        const rollForwardCases: RollForwardCase[] = [
          {
            name: 'latestMajor reuses the highest local SDK across majors',
            minimumVersion: '8.0.100',
            rollForward: 'latestMajor',
            installed: ['8.0.412', '9.0.101'],
            expected: '9.0.101'
          },
          {
            name: 'latestMajor ignores local SDKs below the declared version',
            minimumVersion: '8.0.412',
            rollForward: 'latestMajor',
            installed: ['8.0.100', '7.0.400'],
            expected: null
          },
          {
            name: 'latestMajor keeps requiring GA builds when quality is preview',
            quality: 'preview',
            minimumVersion: '8.0.100',
            rollForward: 'latestMajor',
            installed: ['9.0.200-preview.1'],
            expected: null
          },
          {
            name: 'latestMinor reuses a higher local minor of the same major',
            version: '8',
            minimumVersion: '8.1.100',
            rollForward: 'latestMinor',
            installed: ['8.1.200', '8.2.300'],
            expected: '8.2.300'
          },
          {
            name: 'latestMinor does not cross into another major',
            version: '8',
            minimumVersion: '8.1.100',
            rollForward: 'latestMinor',
            installed: ['9.0.101'],
            expected: null
          },
          {
            name: 'latestMinor ignores local SDKs below the declared version',
            version: '8',
            minimumVersion: '8.1.100',
            rollForward: 'latestMinor',
            installed: ['8.0.412'],
            expected: null
          },
          {
            name: 'latestFeature takes the highest band of the declared major.minor',
            version: '8.0',
            minimumVersion: '8.0.100',
            rollForward: 'latestFeature',
            installed: ['8.0.105', '8.0.400'],
            expected: '8.0.400'
          },
          {
            name: 'latestPatch stays inside the declared feature band',
            version: '8.0.2xx',
            minimumVersion: '8.0.200',
            rollForward: 'latestPatch',
            installed: ['8.0.205', '8.0.412'],
            expected: '8.0.205'
          },
          {
            name: 'latestPatch takes the highest patch even when the declared version is installed',
            version: '8.0.1xx',
            minimumVersion: '8.0.100',
            rollForward: 'latestPatch',
            installed: ['8.0.100', '8.0.105'],
            expected: '8.0.105'
          },
          {
            name: 'patch prefers the exact declared version',
            version: '8.0.100',
            minimumVersion: '8.0.100',
            rollForward: 'patch',
            installed: ['8.0.100', '8.0.105'],
            expected: '8.0.100'
          },
          {
            name: 'patch stays inside the declared feature band',
            version: '8.0.100',
            minimumVersion: '8.0.100',
            rollForward: 'patch',
            installed: ['8.0.105', '8.0.200'],
            expected: '8.0.105'
          },
          {
            name: 'feature prefers the declared band over a higher band',
            version: '8.0.100',
            minimumVersion: '8.0.100',
            rollForward: 'feature',
            installed: ['8.0.105', '8.0.400'],
            expected: '8.0.105'
          },
          {
            name: 'feature rolls to the next higher band, not the highest',
            version: '8.0.100',
            minimumVersion: '8.0.100',
            rollForward: 'feature',
            installed: ['8.0.200', '8.0.300', '8.0.400'],
            expected: '8.0.200'
          },
          {
            name: 'feature takes the latest patch of the selected band',
            version: '8.0.100',
            minimumVersion: '8.0.100',
            rollForward: 'feature',
            installed: ['8.0.201', '8.0.205', '8.0.400'],
            expected: '8.0.205'
          },
          {
            name: 'feature does not cross into another minor',
            version: '8.0.100',
            minimumVersion: '8.0.100',
            rollForward: 'feature',
            installed: ['8.1.100'],
            expected: null
          },
          {
            name: 'minor prefers a higher band of the declared minor over a higher minor',
            version: '8.0.100',
            minimumVersion: '8.0.100',
            rollForward: 'minor',
            installed: ['8.0.400', '8.1.100'],
            expected: '8.0.400'
          },
          {
            name: 'minor rolls to the next higher minor, not the highest',
            version: '8.0.100',
            minimumVersion: '8.0.100',
            rollForward: 'minor',
            installed: ['8.1.100', '8.2.100'],
            expected: '8.1.100'
          },
          {
            name: 'major prefers the declared major over a higher major',
            version: '8.0.100',
            minimumVersion: '8.0.100',
            rollForward: 'major',
            installed: ['8.0.400', '9.0.100'],
            expected: '8.0.400'
          },
          {
            name: 'major rolls to the next higher major, not the highest',
            version: '8.0.100',
            minimumVersion: '8.0.100',
            rollForward: 'major',
            installed: ['9.0.100', '10.0.100'],
            expected: '9.0.100'
          },
          {
            name: 'non-latest policies ignore dotnet-quality, as the online path does',
            version: '8.0.100',
            quality: 'preview',
            minimumVersion: '8.0.100',
            rollForward: 'patch',
            installed: ['8.0.105'],
            expected: '8.0.105'
          },
          {
            name: 'non-latest policies never prefer a prerelease over a GA build',
            version: '8.0.100',
            quality: 'preview',
            minimumVersion: '8.0.100',
            rollForward: 'major',
            installed: ['8.0.100', '9.0.100-rc.2'],
            expected: '8.0.100'
          },
          {
            name: 'roll-forward policies never select below the declared version',
            version: '8.0.200',
            minimumVersion: '8.0.200',
            rollForward: 'major',
            installed: ['8.0.100'],
            expected: null
          },
          {
            name: 'disable requires the exact declared version',
            version: '8.0.100',
            installed: ['8.0.200'],
            expected: null
          },
          {
            name: 'installs online for an empty version without a rollForward floor',
            installed: ['8.0.412'],
            expected: null
          }
        ];

        each(rollForwardCases).it(
          '$name',
          async ({
            version = '',
            quality = '',
            minimumVersion,
            rollForward,
            installed,
            expected
          }: RollForwardCase) => {
            readdirSyncSpy.mockReturnValue(makeDirents(installed));
            maxSatisfyingSpy.mockImplementation(() => '8.0.412');

            const installedVersion = await new installer.DotnetCoreInstaller(
              version,
              quality as any,
              undefined,
              undefined,
              false,
              minimumVersion,
              rollForward
            ).installDotnet();

            if (expected === null) {
              expect(getExecOutputSpy).toHaveBeenCalledTimes(2);
            } else {
              expect(installedVersion).toBe(expected);
              expect(getExecOutputSpy).not.toHaveBeenCalled();
            }
          }
        );
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
