import io = require('@actions/io');
import fs = require('fs');
import os = require('os');
import path = require('path');

const toolDir = path.join(__dirname, 'runner', 'tools');
const tempDir = path.join(__dirname, 'runner', 'temp');

process.env['RUNNER_TOOLSDIRECTORY'] = toolDir;
process.env['RUNNER_TEMPDIRECTORY'] = tempDir;
import * as installer from '../src/installer';

const IS_WINDOWS = process.platform === 'win32';

describe('installer tests', () => {
  beforeAll(() => {});
  beforeAll(async () => {
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
  }, 100000);

  it('Acquires version of dotnet if no matching version is installed', async () => {
    await getDotnet('2.2.104');
    const dotnetDir = path.join(toolDir, 'dncs', '2.2.104', os.arch());

    expect(fs.existsSync(`${dotnetDir}.complete`)).toBe(true);
    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(dotnetDir, 'dotnet.exe'))).toBe(true);
    } else {
      expect(fs.existsSync(path.join(dotnetDir, 'dotnet'))).toBe(true);
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
  });

  it('Uses version of dotnet installed in cache', async () => {
    const dotnetDir: string = path.join(toolDir, 'dncs', '250.0.0', os.arch());
    await io.mkdirP(dotnetDir);
    fs.writeFileSync(`${dotnetDir}.complete`, 'hello');
    // This will throw if it doesn't find it in the cache (because no such version exists)
    await getDotnet('250.0.0');
    return;
  });

  it('Doesnt use version of dotnet that was only partially installed in cache', async () => {
    const dotnetDir: string = path.join(toolDir, 'dncs', '251.0.0', os.arch());
    await io.mkdirP(dotnetDir);
    let thrown = false;
    try {
      // This will throw if it doesn't find it in the cache (because no such version exists)
      await getDotnet('251.0.0');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
    return;
  });
});

async function getDotnet(version: string): Promise<void> {
  const dotnetInstaller = new installer.DotnetCoreInstaller(version);
  await dotnetInstaller.installDotnet();
}
