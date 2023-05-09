import each from 'jest-each';
import semver from 'semver';
import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as io from '@actions/io';
import * as installer from '../src/installer';

import {IS_WINDOWS} from '../src/utils';
import {QualityOptions} from '../src/setup-dotnet';

const env = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = {...env};
});

afterEach(() => {
  process.env = env;
});

describe('DotnetCoreInstaller tests', () => {
  const getExecOutputSpy = jest.spyOn(exec, 'getExecOutput');
  const warningSpy = jest.spyOn(core, 'warning');
  const whichSpy = jest.spyOn(io, 'which');
  const maxSatisfyingSpy = jest.spyOn(semver, 'maxSatisfying');

  describe('installDotnet() tests', () => {
    whichSpy.mockImplementation(() => Promise.resolve('PathToShell'));

    it('should throw the error in case of non-zero exit code of the installation script. The error message should contain logs.', async () => {
      const inputVersion = '3.1.100';
      const inputQuality = '' as QualityOptions;
      const errorMessage = 'Fictious error message!';
      getExecOutputSpy.mockImplementation(() => {
        return Promise.resolve({exitCode: 1, stdout: '', stderr: errorMessage});
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
      const inputVersion = '3.1.100';
      const inputQuality = '' as QualityOptions;
      getExecOutputSpy.mockImplementation(() => {
        return Promise.resolve({exitCode: 0, stdout: '', stderr: ''});
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
      const inputVersion = '6.0.300';
      const inputQuality = '' as QualityOptions;

      getExecOutputSpy.mockImplementation(() => {
        return Promise.resolve({exitCode: 0, stdout: '', stderr: ''});
      });
      maxSatisfyingSpy.mockImplementation(() => inputVersion);

      const dotnetInstaller = new installer.DotnetCoreInstaller(
        inputVersion,
        inputQuality
      );

      await dotnetInstaller.installDotnet();

      const scriptArguments = (
        getExecOutputSpy.mock.calls[0][1] as string[]
      ).join(' ');
      const expectedArgument = IS_WINDOWS
        ? `-Version ${inputVersion}`
        : `--version ${inputVersion}`;

      expect(scriptArguments).toContain(expectedArgument);
    });

    it(`should warn if the 'quality' input is set and the supplied version is in A.B.C syntax`, async () => {
      const inputVersion = '6.0.300';
      const inputQuality = 'ga' as QualityOptions;

      getExecOutputSpy.mockImplementation(() => {
        return Promise.resolve({exitCode: 0, stdout: '', stderr: ''});
      });
      maxSatisfyingSpy.mockImplementation(() => inputVersion);

      const dotnetInstaller = new installer.DotnetCoreInstaller(
        inputVersion,
        inputQuality
      );

      await dotnetInstaller.installDotnet();

      expect(warningSpy).toHaveBeenCalledWith(
        `'dotnet-quality' input can be used only with .NET SDK version in A.B, A.B.x, A and A.x formats where the major tag is higher than 5. You specified: ${inputVersion}. 'dotnet-quality' input is ignored.`
      );
    });

    it(`should warn if the 'quality' input is set and version isn't in A.B.C syntax but major tag is lower then 6`, async () => {
      const inputVersion = '3.1';
      const inputQuality = 'ga' as QualityOptions;

      getExecOutputSpy.mockImplementation(() => {
        return Promise.resolve({exitCode: 0, stdout: '', stderr: ''});
      });
      maxSatisfyingSpy.mockImplementation(() => inputVersion);

      const dotnetInstaller = new installer.DotnetCoreInstaller(
        inputVersion,
        inputQuality
      );

      await dotnetInstaller.installDotnet();

      expect(warningSpy).toHaveBeenCalledWith(
        `'dotnet-quality' input can be used only with .NET SDK version in A.B, A.B.x, A and A.x formats where the major tag is higher than 5. You specified: ${inputVersion}. 'dotnet-quality' input is ignored.`
      );
    });

    each(['6', '6.0', '6.0.x', '6.0.*', '6.0.X']).test(
      `should supply 'quality' argument to the installation script if quality input is set and version is not in A.B.C syntax`,
      async inputVersion => {
        const inputQuality = 'ga' as QualityOptions;
        const exitCode = 0;
        getExecOutputSpy.mockImplementation(() => {
          return Promise.resolve({exitCode: exitCode, stdout: '', stderr: ''});
        });
        maxSatisfyingSpy.mockImplementation(() => inputVersion);

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          inputVersion,
          inputQuality
        );

        await dotnetInstaller.installDotnet();

        const scriptArguments = (
          getExecOutputSpy.mock.calls[0][1] as string[]
        ).join(' ');
        const expectedArgument = IS_WINDOWS
          ? `-Quality ${inputQuality}`
          : `--quality ${inputQuality}`;

        expect(scriptArguments).toContain(expectedArgument);
      }
    );

    each(['6', '6.0', '6.0.x', '6.0.*', '6.0.X']).test(
      `should supply 'channel' argument to the installation script if version isn't in A.B.C syntax`,
      async inputVersion => {
        const inputQuality = '' as QualityOptions;
        const exitCode = 0;
        getExecOutputSpy.mockImplementation(() => {
          return Promise.resolve({exitCode: exitCode, stdout: '', stderr: ''});
        });
        maxSatisfyingSpy.mockImplementation(() => inputVersion);

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          inputVersion,
          inputQuality
        );

        await dotnetInstaller.installDotnet();

        const scriptArguments = (
          getExecOutputSpy.mock.calls[0][1] as string[]
        ).join(' ');
        const expectedArgument = IS_WINDOWS ? `-Channel 6.0` : `--channel 6.0`;

        expect(scriptArguments).toContain(expectedArgument);
      }
    );

    if (IS_WINDOWS) {
      it(`should supply '-ProxyAddress' argument to the installation script if env.variable 'https_proxy' is set`, async () => {
        process.env['https_proxy'] = 'https://proxy.com';
        const inputVersion = '6.0.100';
        const inputQuality = '' as QualityOptions;

        getExecOutputSpy.mockImplementation(() => {
          return Promise.resolve({exitCode: 0, stdout: '', stderr: ''});
        });
        maxSatisfyingSpy.mockImplementation(() => inputVersion);

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          inputVersion,
          inputQuality
        );

        await dotnetInstaller.installDotnet();

        const scriptArguments = (
          getExecOutputSpy.mock.calls[0][1] as string[]
        ).join(' ');

        expect(scriptArguments).toContain(
          `-ProxyAddress ${process.env['https_proxy']}`
        );
      });

      it(`should supply '-ProxyBypassList' argument to the installation script if env.variable 'no_proxy' is set`, async () => {
        process.env['no_proxy'] = 'first.url,second.url';
        const inputVersion = '6.0.100';
        const inputQuality = '' as QualityOptions;

        getExecOutputSpy.mockImplementation(() => {
          return Promise.resolve({exitCode: 0, stdout: '', stderr: ''});
        });
        maxSatisfyingSpy.mockImplementation(() => inputVersion);

        const dotnetInstaller = new installer.DotnetCoreInstaller(
          inputVersion,
          inputQuality
        );

        await dotnetInstaller.installDotnet();

        const scriptArguments = (
          getExecOutputSpy.mock.calls[0][1] as string[]
        ).join(' ');

        expect(scriptArguments).toContain(
          `-ProxyBypassList ${process.env['no_proxy']}`
        );
      });
    }
  });
  describe('addToPath() tests', () => {
    it(`should export DOTNET_ROOT env.var with value from DOTNET_INSTALL_DIR env.var`, async () => {
      process.env['DOTNET_INSTALL_DIR'] = 'fictious/dotnet/install/dir';
      installer.DotnetCoreInstaller.addToPath();
      const dotnet_root = process.env['DOTNET_ROOT'];
      expect(dotnet_root).toBe(process.env['DOTNET_INSTALL_DIR']);
    });

    it(`should export value from the DOTNET_INSTALL_DIR env.var to the PATH`, async () => {
      process.env['DOTNET_INSTALL_DIR'] = 'fictious/dotnet/install/dir';
      installer.DotnetCoreInstaller.addToPath();
      const path = process.env['PATH'];
      expect(path).toContain(process.env['DOTNET_INSTALL_DIR']);
    });
  });
});

describe('DotnetVersionResolver tests', () => {
  each([
    '3.1',
    '3.x',
    '3.1.x',
    '3.1.*',
    '3.1.X',
    '3.1.2',
    '3.1.0-preview1'
  ]).test(
    'if valid version is supplied, it should return version object with some value',
    async version => {
      const dotnetVersionResolver = new installer.DotnetVersionResolver(
        version
      );
      const versionObject = await dotnetVersionResolver.createDotNetVersion();

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
  ]).test('if invalid version is supplied, it should throw', async version => {
    const dotnetVersionResolver = new installer.DotnetVersionResolver(version);

    await expect(
      async () => await dotnetVersionResolver.createDotNetVersion()
    ).rejects.toThrow();
  });

  each(['3', '3.1', '3.1.x', '3.1.*', '3.1.X']).test(
    "if version that can be resolved to 'channel' option is supplied, it should set type to 'channel' in version object",
    async version => {
      const dotnetVersionResolver = new installer.DotnetVersionResolver(
        version
      );
      const versionObject = await dotnetVersionResolver.createDotNetVersion();

      expect(versionObject.type.toLowerCase().includes('channel')).toBe(true);
    }
  );

  each(['6.0', '6.0.x', '6.0.*', '6.0.X']).test(
    "if version that can be resolved to 'channel' option is supplied and its major tag is >= 6, it should set type to 'channel' and qualityFlag to 'true' in version object",
    async version => {
      const dotnetVersionResolver = new installer.DotnetVersionResolver(
        version
      );
      const versionObject = await dotnetVersionResolver.createDotNetVersion();

      expect(versionObject.type.toLowerCase().includes('channel')).toBe(true);
      expect(versionObject.qualityFlag).toBe(true);
    }
  );

  each(['3.1.2', '3.1.0-preview1']).test(
    "if version that can be resolved to 'version' option is supplied, it should set quality flag to 'false' and type to 'version' in version object",
    async version => {
      const dotnetVersionResolver = new installer.DotnetVersionResolver(
        version
      );
      const versionObject = await dotnetVersionResolver.createDotNetVersion();

      expect(versionObject.type.toLowerCase().includes('version')).toBe(true);
      expect(versionObject.qualityFlag).toBe(false);
    }
  );

  each(['3.1.2', '3.1']).test(
    'it should create proper line arguments for powershell/bash installation scripts',
    async version => {
      const dotnetVersionResolver = new installer.DotnetVersionResolver(
        version
      );
      const versionObject = await dotnetVersionResolver.createDotNetVersion();
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
});