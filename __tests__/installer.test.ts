import * as io from '@actions/io';
import * as os from 'os';
import fs from 'fs';
import path from 'path';
import each from 'jest-each';
import * as hc from '@actions/http-client';
import * as installer from '../src/installer';
import {QualityOptions} from '../src/setup-dotnet';

import {IS_WINDOWS} from '../src/utils';
import {IS_LINUX} from '../src/utils';

let toolDir: string;

if (IS_WINDOWS) {
  toolDir = path.join(process.env['PROGRAMFILES'] + '', 'dotnet');
} else if (IS_LINUX) {
  toolDir = '/usr/share/dotnet';
} else {
  toolDir = path.join(process.env['HOME'] + '', '.dotnet');
}
const tempDir = path.join(__dirname, 'runner', 'temp');

process.env['RUNNER_TOOL_CACHE'] = toolDir;
process.env['RUNNER_TEMP'] = tempDir;

describe('DotnetCoreInstaller tests', () => {
  beforeAll(async () => {
    process.env.RUNNER_TOOL_CACHE = toolDir;
    process.env.DOTNET_INSTALL_DIR = toolDir;
    process.env.RUNNER_TEMP = tempDir;
    process.env.DOTNET_ROOT = '';
    try {
      await io.rmRF(`${toolDir}/*`);
      await io.rmRF(`${tempDir}/*`);
    } catch (err) {
      console.log(
        `Failed to remove test directories, check the error message:${os.EOL}`,
        err.message
      );
    }
  }, 30000);

  afterEach(async () => {
    try {
      await io.rmRF(`${toolDir}/*`);
      await io.rmRF(`${tempDir}/*`);
    } catch (err) {
      console.log(
        `Failed to remove test directories, check the error message:${os.EOL}`,
        err.message
      );
    }
  }, 30000);

  it('Aquires multiple versions of dotnet', async () => {
    const versions = ['2.2.207', '3.1.120'];

    for (const version of versions) {
      await getDotnet(version);
    }
    expect(fs.existsSync(path.join(toolDir, 'sdk', '2.2.207'))).toBe(true);
    expect(fs.existsSync(path.join(toolDir, 'sdk', '3.1.120'))).toBe(true);

    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(toolDir, 'dotnet.exe'))).toBe(true);
    } else {
      expect(fs.existsSync(path.join(toolDir, 'dotnet'))).toBe(true);
    }

    expect(process.env.DOTNET_ROOT).toBeDefined();
    expect(process.env.PATH).toBeDefined();
    expect(process.env.DOTNET_ROOT).toBe(toolDir);
    expect(process.env.PATH?.startsWith(toolDir)).toBe(true);
  }, 600000);

  it('Acquires version of dotnet if no matching version is installed', async () => {
    await getDotnet('3.1.201');
    expect(fs.existsSync(path.join(toolDir, 'sdk', '3.1.201'))).toBe(true);
    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(toolDir, 'dotnet.exe'))).toBe(true);
    } else {
      expect(fs.existsSync(path.join(toolDir, 'dotnet'))).toBe(true);
    }

    expect(process.env.DOTNET_ROOT).toBeDefined();
    expect(process.env.PATH).toBeDefined();
    expect(process.env.DOTNET_ROOT).toBe(toolDir);
    expect(process.env.PATH?.startsWith(toolDir)).toBe(true);
  }, 600000); //This needs some time to download on "slower" internet connections

  it('Acquires generic version of dotnet if no matching version is installed', async () => {
    await getDotnet('3.1');
    const directory = fs
      .readdirSync(path.join(toolDir, 'sdk'))
      .filter(fn => fn.startsWith('3.1.'));
    expect(directory.length > 0).toBe(true);
    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(toolDir, 'dotnet.exe'))).toBe(true);
    } else {
      expect(fs.existsSync(path.join(toolDir, 'dotnet'))).toBe(true);
    }

    expect(process.env.DOTNET_ROOT).toBeDefined();
    expect(process.env.PATH).toBeDefined();
    expect(process.env.DOTNET_ROOT).toBe(toolDir);
    expect(process.env.PATH?.startsWith(toolDir)).toBe(true);
  }, 600000); //This needs some time to download on "slower" internet connections

  it('Returns string with installed SDK version', async () => {
    const version = '3.1.120';

    const installedVersion = await getDotnet(version);

    expect(installedVersion).toBe('3.1.120');
  }, 600000);

  it('Throws if no location contains correct dotnet version', async () => {
    await expect(async () => {
      await getDotnet('1000.0.0');
    }).rejects.toThrow();
  }, 30000);

  it('Uses an up to date bash download script', async () => {
    const httpCallbackClient = new hc.HttpClient('setup-dotnet-test', [], {
      allowRetries: true,
      maxRetries: 3
    });
    const response: hc.HttpClientResponse = await httpCallbackClient.get(
      'https://dot.net/v1/dotnet-install.sh'
    );
    expect(response.message.statusCode).toBe(200);
    const upToDateContents: string = await response.readBody();
    const currentContents: string = fs
      .readFileSync(
        path.join(__dirname, '..', 'externals', 'install-dotnet.sh')
      )
      .toString();
    expect(normalizeFileContents(currentContents)).toBe(
      normalizeFileContents(upToDateContents)
    );
  }, 30000);

  it('Uses an up to date powershell download script', async () => {
    const httpCallbackClient = new hc.HttpClient('setup-dotnet-test', [], {
      allowRetries: true,
      maxRetries: 3
    });
    const response: hc.HttpClientResponse = await httpCallbackClient.get(
      'https://dot.net/v1/dotnet-install.ps1'
    );
    expect(response.message.statusCode).toBe(200);
    const upToDateContents: string = await response.readBody();
    const currentContents: string = fs
      .readFileSync(
        path.join(__dirname, '..', 'externals', 'install-dotnet.ps1')
      )
      .toString();
    expect(normalizeFileContents(currentContents)).toBe(
      normalizeFileContents(upToDateContents)
    );
  }, 30000);
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
    "if valid version: '%s' is supplied, it should return version object with some value",
    async version => {
      const dotnetVersionResolver = new installer.DotnetVersionResolver(
        version
      );
      const versionObject = await dotnetVersionResolver.createDotnetVersion();

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
    "if invalid version: '%s' is supplied, it should throw",
    async version => {
      const dotnetVersionResolver = new installer.DotnetVersionResolver(
        version
      );

      await expect(
        async () => await dotnetVersionResolver.createDotnetVersion()
      ).rejects.toThrow();
    }
  );

  each(['3.1', '3.1.x', '3.1.*', '3.1.X']).test(
    "if version: '%s' that can be resolved to 'channel' option is supplied, it should set type to 'channel' in version object",
    async version => {
      const dotnetVersionResolver = new installer.DotnetVersionResolver(
        version
      );
      const versionObject = await dotnetVersionResolver.createDotnetVersion();

      expect(versionObject.type.toLowerCase().includes('channel')).toBe(true);
    }
  );

  each(['6.0', '6.0.x', '6.0.*', '6.0.X']).test(
    "if version: '%s' that can be resolved to 'channel' option is supplied and its major tag is >= 6, it should set type to 'channel' and qualityFlag to 'true' in version object",
    async version => {
      const dotnetVersionResolver = new installer.DotnetVersionResolver(
        version
      );
      const versionObject = await dotnetVersionResolver.createDotnetVersion();

      expect(versionObject.type.toLowerCase().includes('channel')).toBe(true);
      expect(versionObject.qualityFlag).toBe(true);
    }
  );

  each(['3.1.2', '3.1.0-preview1']).test(
    "if version: '%s' that can be resolved to 'version' option is supplied, it should set quality flag to 'false' and type to 'version' in version object",
    async version => {
      const dotnetVersionResolver = new installer.DotnetVersionResolver(
        version
      );
      const versionObject = await dotnetVersionResolver.createDotnetVersion();

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
      const versionObject = await dotnetVersionResolver.createDotnetVersion();
      const windowsRegEx = new RegExp(/^-[VC]/);
      const nonWindowsRegEx = new RegExp(/^--[vc]/);

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

function normalizeFileContents(contents: string): string {
  return contents
    .trim()
    .replace(new RegExp('\r\n', 'g'), '\n')
    .replace(new RegExp('\r', 'g'), '\n');
}

async function getDotnet(version: string, quality = ''): Promise<string> {
  const dotnetInstaller = new installer.DotnetCoreInstaller(
    version,
    quality as QualityOptions
  );
  const installedVersion = await dotnetInstaller.installDotnet();
  installer.DotnetCoreInstaller.addToPath();
  return installedVersion;
}
