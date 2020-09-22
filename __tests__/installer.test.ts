import io = require('@actions/io');
import fs = require('fs');
import os = require('os');
import path = require('path');
import hc = require('@actions/http-client');

const toolDir = path.join(__dirname, 'runner', 'tools');
const tempDir = path.join(__dirname, 'runner', 'temp');

process.env['RUNNER_TOOL_CACHE'] = toolDir;
process.env['RUNNER_TEMP'] = tempDir;
import * as setup from '../src/setup-dotnet';
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
    await getDotnet('3.1.201');
    expect(fs.existsSync(path.join(toolDir, 'sdk', '3.1.201'))).toBe(true);
    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(toolDir, 'dotnet.exe'))).toBe(true);
    } else {
      expect(fs.existsSync(path.join(toolDir, 'dotnet'))).toBe(true);
    }
  }, 400000); //This needs some time to download on "slower" internet connections

  it('Acquires version of dotnet from global.json if no matching version is installed', async () => {
    const globalJsonPath = path.join(process.cwd(), 'global.json');
    const jsonContents = `{${os.EOL}"sdk": {${os.EOL}"version": "3.1.201"${os.EOL}}${os.EOL}}`;
    if (!fs.existsSync(globalJsonPath)) {
      fs.writeFileSync(globalJsonPath, jsonContents);
    }
    await setup.run();

    expect(fs.existsSync(path.join(toolDir, 'sdk', '3.1.201'))).toBe(true);
    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(toolDir, 'dotnet.exe'))).toBe(true);
    } else {
      expect(fs.existsSync(path.join(toolDir, 'dotnet'))).toBe(true);
    }
    fs.unlinkSync(globalJsonPath);
  }, 100000);

  it('Acquires generic version of dotnet if no matching version is installed', async () => {
    await getDotnet('3.1');
    var directory = fs
      .readdirSync(path.join(toolDir, 'sdk'))
      .filter(fn => fn.startsWith('3.1.'));
    expect(directory.length > 0).toBe(true);
    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(toolDir, 'dotnet.exe'))).toBe(true);
    } else {
      expect(fs.existsSync(path.join(toolDir, 'dotnet'))).toBe(true);
    }
  }, 400000); //This needs some time to download on "slower" internet connections

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
    var httpCallbackClient = new hc.HttpClient('setup-dotnet-test', [], {
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
