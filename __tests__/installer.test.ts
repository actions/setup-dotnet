import io = require('@actions/io');
import fs = require('fs');
import path = require('path');
import httpClient = require('typed-rest-client/HttpClient');

const toolDir = path.join(__dirname, 'runner', 'tools');
const tempDir = path.join(__dirname, 'runner', 'temp');

import * as installer from '../src/installer';

const IS_WINDOWS = process.platform === 'win32';

describe('installer tests', () => {
  beforeAll(async () => {
    process.env.RUNNER_TOOL_CACHE = toolDir;
    process.env.DOTNET_INSTALL_DIR = toolDir;
    process.env.RUNNER_TEMP = tempDir;
    await io.rmRF(toolDir);
    await io.rmRF(tempDir);
  });

  afterAll(async () => {
    try {
      await io.rmRF(toolDir);
      await io.rmRF(tempDir);
    } catch {
      console.log('Failed to remove test directories');
    }
  }, 30000);

  it('Acquires version of dotnet if no matching version is installed', async () => {
    await getDotnet('3.1.100');
    expect(fs.existsSync(path.join(toolDir, 'sdk', '3.1.100'))).toBe(true);
    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(toolDir, 'dotnet.exe'))).toBe(true);
    } else {
      expect(fs.existsSync(path.join(toolDir, 'dotnet'))).toBe(true);
    }
  }, 100000);

  it('Throws if no location contains correct dotnet version', async () => {
    let thrown = false;
    try {
      await getDotnet('1000.0.0');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  }, 30000);

  it('Uses an up to date bash download script', async () => {
    var httpCallbackClient = new httpClient.HttpClient(
      'setup-dotnet-test',
      [],
      {}
    );
    const response: httpClient.HttpClientResponse = await httpCallbackClient.get(
      'https://dot.net/v1/dotnet-install.sh'
    );
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
    var httpCallbackClient = new httpClient.HttpClient(
      'setup-dotnet-test',
      [],
      {}
    );
    const response: httpClient.HttpClientResponse = await httpCallbackClient.get(
      'https://dot.net/v1/dotnet-install.ps1'
    );
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

function normalizeFileContents(contents: string): string {
  return contents
    .trim()
    .replace(new RegExp('\r\n', 'g'), '\n')
    .replace(new RegExp('\r', 'g'), '\n');
}

async function getDotnet(version: string): Promise<void> {
  const dotnetInstaller = new installer.DotnetCoreInstaller(version);
  await dotnetInstaller.installDotnet();
}
