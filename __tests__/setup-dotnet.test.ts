import * as core from '@actions/core';
import fs from 'fs';
import semver from 'semver';
import * as auth from '../src/authutil';
import os from 'os';
import * as setup from '../src/setup-dotnet';
import {DotnetCoreInstaller, DotnetInstallDir} from '../src/installer';
import * as cacheUtils from '../src/cache-utils';
import * as cacheRestore from '../src/cache-restore';

describe('setup-dotnet tests', () => {
  const inputs = {} as any;

  const getInputSpy = jest.spyOn(core, 'getInput');
  const getMultilineInputSpy = jest.spyOn(core, 'getMultilineInput');
  const getBooleanInputSpy = jest.spyOn(core, 'getBooleanInput');
  const setFailedSpy = jest.spyOn(core, 'setFailed');
  const warningSpy = jest.spyOn(core, 'warning');
  const debugSpy = jest.spyOn(core, 'debug');
  const infoSpy = jest.spyOn(core, 'info');
  const setOutputSpy = jest.spyOn(core, 'setOutput');

  const existsSyncSpy = jest.spyOn(fs, 'existsSync');

  const maxSatisfyingSpy = jest.spyOn(semver, 'maxSatisfying');

  const installDotnetSpy = jest.spyOn(
    DotnetCoreInstaller.prototype,
    'installDotnet'
  );

  const isCacheFeatureAvailableSpy = jest.spyOn(
    cacheUtils,
    'isCacheFeatureAvailable'
  );
  const restoreCacheSpy = jest.spyOn(cacheRestore, 'restoreCache');
  const configAuthenticationSpy = jest.spyOn(auth, 'configAuthentication');
  const addToPathOriginal = DotnetInstallDir.addToPath;

  describe('run() tests', () => {
    beforeEach(() => {
      DotnetInstallDir.addToPath = jest.fn();
      getMultilineInputSpy.mockImplementation(input => inputs[input as string]);
      getInputSpy.mockImplementation(input => inputs[input as string]);
      getBooleanInputSpy.mockImplementation(input => inputs[input as string]);
    });

    afterEach(() => {
      DotnetInstallDir.addToPath = addToPathOriginal;
      jest.clearAllMocks();
      jest.resetAllMocks();
    });

    it('should fail the action if global-json-file input is present, but the file does not exist in the file system', async () => {
      inputs['global-json-file'] = 'fictitious.json';
      inputs['dotnet-version'] = [];

      const expectedErrorMessage = `The specified global.json file '${inputs['global-json-file']}' does not exist`;

      await setup.run();
      expect(setFailedSpy).toHaveBeenCalledWith(expectedErrorMessage);
    });

    test(`if 'dotnet-version' and 'global-json-file' inputs aren't present, should log into debug output, try to find global.json in the repo root, fail and log message into info output`, async () => {
      inputs['global-json-file'] = '';
      inputs['dotnet-version'] = [];

      maxSatisfyingSpy.mockImplementation(() => null);
      setOutputSpy.mockImplementation(() => {});

      const expectedDebugMessage =
        'No version found, trying to find version from global.json';
      const expectedInfoMessage = `The global.json wasn't found in the root directory. No .NET version will be installed.`;

      await setup.run();

      expect(debugSpy).toHaveBeenCalledWith(expectedDebugMessage);
      expect(existsSyncSpy).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledWith(expectedInfoMessage);
    });

    it('should fail the action if quality is supplied but its value is not supported', async () => {
      inputs['global-json-file'] = '';
      inputs['dotnet-version'] = ['10.0'];
      inputs['dotnet-quality'] = 'fictitiousQuality';

      const expectedErrorMessage = `Value '${inputs['dotnet-quality']}' is not supported for the 'dotnet-quality' option. Supported values are: daily, preview, ga.`;

      await setup.run();
      expect(setFailedSpy).toHaveBeenCalledWith(expectedErrorMessage);
    });

    it('should call installDotnet() multiple times if dotnet-version multiline input is provided', async () => {
      inputs['global-json-file'] = '';
      inputs['dotnet-version'] = ['9.0', '10.0'];
      inputs['dotnet-quality'] = '';

      installDotnetSpy.mockImplementation(() => Promise.resolve(''));

      await setup.run();
      expect(installDotnetSpy).toHaveBeenCalledTimes(2);
    });

    it('should call addToPath() after installation complete', async () => {
      inputs['global-json-file'] = '';
      inputs['dotnet-version'] = ['9.0', '10.0'];
      inputs['dotnet-quality'] = '';

      installDotnetSpy.mockImplementation(() => Promise.resolve(''));

      await setup.run();
      expect(DotnetInstallDir.addToPath).toHaveBeenCalledTimes(1);
    });

    it('should call auth.configAuthentication() if source-url input is provided', async () => {
      inputs['global-json-file'] = '';
      inputs['dotnet-version'] = [];
      inputs['dotnet-quality'] = '';
      inputs['source-url'] = 'fictitious.source.url';

      configAuthenticationSpy.mockImplementation(() => {});

      await setup.run();
      expect(configAuthenticationSpy).toHaveBeenCalledWith(
        inputs['source-url'],
        undefined
      );
    });

    it('should call auth.configAuthentication() with proper parameters if source-url and config-file inputs are provided', async () => {
      inputs['global-json-file'] = '';
      inputs['dotnet-version'] = [];
      inputs['dotnet-quality'] = '';
      inputs['source-url'] = 'fictitious.source.url';
      inputs['config-file'] = 'fictitious.path';

      configAuthenticationSpy.mockImplementation(() => {});
      setOutputSpy.mockImplementation(() => {});

      await setup.run();
      expect(configAuthenticationSpy).toHaveBeenCalledWith(
        inputs['source-url'],
        inputs['config-file']
      );
    });

    it('should call setOutput() after installation complete successfully', async () => {
      inputs['dotnet-version'] = ['10.0.101'];

      installDotnetSpy.mockImplementation(() =>
        Promise.resolve(`${inputs['dotnet-version']}`)
      );

      await setup.run();
      expect(DotnetInstallDir.addToPath).toHaveBeenCalledTimes(1);
    });

    it(`shouldn't call setOutput() if parsing dotnet-installer logs failed`, async () => {
      inputs['dotnet-version'] = ['10.0.101'];
      const warningMessage = `Failed to output the installed version of .NET. The 'dotnet-version' output will not be set.`;

      installDotnetSpy.mockImplementation(() => Promise.resolve(null));

      await setup.run();
      expect(warningSpy).toHaveBeenCalledWith(warningMessage);
      expect(setOutputSpy).not.toHaveBeenCalled();
    });

    it(`shouldn't call setOutput() if actions didn't install .NET`, async () => {
      inputs['dotnet-version'] = [];
      const warningMessage = `The 'dotnet-version' output will not be set.`;

      await setup.run();

      expect(infoSpy).toHaveBeenCalledWith(warningMessage);
      expect(setOutputSpy).not.toHaveBeenCalled();
    });

    it(`should get 'cache-dependency-path' and call restoreCache() if input cache is set to true and cache feature is available`, async () => {
      inputs['dotnet-version'] = ['10.0.101'];
      inputs['dotnet-quality'] = '';
      inputs['cache'] = true;
      inputs['cache-dependency-path'] = 'fictitious.package.lock.json';

      installDotnetSpy.mockImplementation(() => Promise.resolve(''));

      isCacheFeatureAvailableSpy.mockImplementation(() => true);
      restoreCacheSpy.mockImplementation(() => Promise.resolve());

      await setup.run();
      expect(isCacheFeatureAvailableSpy).toHaveBeenCalledTimes(1);
      expect(restoreCacheSpy).toHaveBeenCalledWith(
        inputs['cache-dependency-path']
      );
    });

    it(`shouldn't call restoreCache() if input cache isn't set to true`, async () => {
      inputs['dotnet-version'] = ['10.0.101'];
      inputs['dotnet-quality'] = '';
      inputs['cache'] = false;

      installDotnetSpy.mockImplementation(() => Promise.resolve(''));

      isCacheFeatureAvailableSpy.mockImplementation(() => true);
      restoreCacheSpy.mockImplementation(() => Promise.resolve());

      await setup.run();
      expect(restoreCacheSpy).not.toHaveBeenCalled();
    });

    it(`shouldn't call restoreCache() if cache feature isn't available`, async () => {
      inputs['dotnet-version'] = ['10.0.101'];
      inputs['dotnet-quality'] = '';
      inputs['cache'] = true;

      installDotnetSpy.mockImplementation(() => Promise.resolve(''));

      isCacheFeatureAvailableSpy.mockImplementation(() => false);
      restoreCacheSpy.mockImplementation(() => Promise.resolve());

      await setup.run();
      expect(restoreCacheSpy).not.toHaveBeenCalled();
    });

    it('should pass valid architecture input to DotnetCoreInstaller', async () => {
      inputs['dotnet-version'] = ['10.0.101'];
      inputs['dotnet-quality'] = '';
      inputs['architecture'] = os.arch().toLowerCase();

      installDotnetSpy.mockImplementation(() => Promise.resolve(''));

      await setup.run();
      expect(installDotnetSpy).toHaveBeenCalledTimes(1);
      expect(DotnetInstallDir.addToPath).toHaveBeenCalledTimes(1);
    });

    it('should work with empty architecture input for auto-detection', async () => {
      inputs['dotnet-version'] = ['10.0.101'];
      inputs['dotnet-quality'] = '';
      inputs['architecture'] = '';

      installDotnetSpy.mockImplementation(() => Promise.resolve(''));

      await setup.run();
      expect(installDotnetSpy).toHaveBeenCalledTimes(1);
      expect(DotnetInstallDir.addToPath).toHaveBeenCalledTimes(1);
    });

    it('should fail the action if unsupported architecture is provided', async () => {
      inputs['dotnet-version'] = ['10.0.101'];
      inputs['dotnet-quality'] = '';
      inputs['architecture'] = 'x688';

      const expectedErrorMessage = `Value 'x688' is not supported for the 'architecture' option. Supported values are: x64, x86, arm64, amd64, arm, s390x, ppc64le, riscv64.`;

      await setup.run();
      expect(setFailedSpy).toHaveBeenCalledWith(expectedErrorMessage);
    });

    it('should fail the action if unsupported dotnet-channel value is provided with latest', async () => {
      inputs['dotnet-version'] = ['latest'];
      inputs['dotnet-quality'] = '';
      inputs['dotnet-channel'] = 'invalid';
      inputs['architecture'] = '';

      const expectedErrorMessage = `Value 'invalid' is not supported for the 'dotnet-channel' option. Supported values are: LTS, STS, A.B (e.g. 8.0), A.B.Cxx (e.g. 8.0.1xx).`;

      await setup.run();
      expect(setFailedSpy).toHaveBeenCalledWith(expectedErrorMessage);
    });

    it('should warn but not fail if unsupported dotnet-channel value is provided with a specific version', async () => {
      inputs['dotnet-version'] = ['8.0.x'];
      inputs['dotnet-quality'] = '';
      inputs['dotnet-channel'] = 'invalid';
      inputs['architecture'] = '';

      installDotnetSpy.mockImplementation(() => Promise.resolve(''));

      await setup.run();
      expect(setFailedSpy).not.toHaveBeenCalled();
      expect(warningSpy).toHaveBeenCalledWith(
        `Value 'invalid' is not supported for the 'dotnet-channel' option and will be ignored because 'dotnet-version' is not set to 'latest'. Supported values are: LTS, STS, A.B (e.g. 8.0), A.B.Cxx (e.g. 8.0.1xx).`
      );
    });

    it('should pass valid dotnet-channel value through without error', async () => {
      inputs['dotnet-version'] = ['latest'];
      inputs['dotnet-quality'] = '';
      inputs['dotnet-channel'] = 'LTS';
      inputs['architecture'] = '';

      installDotnetSpy.mockImplementation(() => Promise.resolve(''));

      await setup.run();
      expect(setFailedSpy).not.toHaveBeenCalled();
    });

    it('should pass A.B channel value through without error when used with latest', async () => {
      inputs['dotnet-version'] = ['latest'];
      inputs['dotnet-quality'] = '';
      inputs['dotnet-channel'] = '8.0';
      inputs['architecture'] = '';

      installDotnetSpy.mockImplementation(() => Promise.resolve(''));

      await setup.run();
      expect(setFailedSpy).not.toHaveBeenCalled();
    });

    it('should pass A.B.Cxx channel value through without error when used with latest', async () => {
      inputs['dotnet-version'] = ['latest'];
      inputs['dotnet-quality'] = '';
      inputs['dotnet-channel'] = '8.0.1xx';
      inputs['architecture'] = '';

      installDotnetSpy.mockImplementation(() => Promise.resolve(''));

      await setup.run();
      expect(setFailedSpy).not.toHaveBeenCalled();
    });

    it('should fail with A.B.Cxx channel if major version is below 5', async () => {
      inputs['dotnet-version'] = ['latest'];
      inputs['dotnet-quality'] = '';
      inputs['dotnet-channel'] = '3.1.1xx';
      inputs['architecture'] = '';

      const expectedErrorMessage = `Value '3.1.1xx' is not supported for the 'dotnet-channel' option. Supported values are: LTS, STS, A.B (e.g. 8.0), A.B.Cxx (e.g. 8.0.1xx).`;

      await setup.run();
      expect(setFailedSpy).toHaveBeenCalledWith(expectedErrorMessage);
    });

    it('should warn and not fail if valid dotnet-channel is provided with a non-latest version', async () => {
      inputs['dotnet-version'] = ['8.0.x'];
      inputs['dotnet-quality'] = '';
      inputs['dotnet-channel'] = 'LTS';
      inputs['architecture'] = '';

      installDotnetSpy.mockImplementation(() => Promise.resolve(''));

      await setup.run();
      expect(setFailedSpy).not.toHaveBeenCalled();
      expect(warningSpy).toHaveBeenCalledWith(
        `The 'dotnet-channel' input is only supported when 'dotnet-version' is set to 'latest'.`
      );
    });
  });
});
