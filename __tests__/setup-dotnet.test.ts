import io = require('@actions/io');
import fs = require('fs');
import os = require('os');
import path = require('path');

const toolDir = path.join(__dirname, 'runner', 'tools2');
const tempDir = path.join(__dirname, 'runner', 'temp2');

import * as setup from '../src/setup-dotnet';

const IS_WINDOWS = process.platform === 'win32';

describe('setup-dotnet tests', () => {
  beforeAll(async () => {
    process.env.RUNNER_TOOL_CACHE = toolDir;
    process.env.DOTNET_INSTALL_DIR = toolDir;
    process.env.RUNNER_TEMP = tempDir;
    await io.rmRF(toolDir);
    await io.rmRF(tempDir);
  });

  afterAll(async () => {
    try {
      await io.rmRF(path.join(process.cwd(), 'global.json'));
      await io.rmRF(toolDir);
      await io.rmRF(tempDir);
    } catch {
      console.log('Failed to remove test directories');
    }
  }, 30000);

  it('Acquires version of dotnet if no matching version is installed', async () => {
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
});
