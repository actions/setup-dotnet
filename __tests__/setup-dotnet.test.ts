import * as io from '@actions/io';
import * as core from '@actions/core';
import fs from 'fs';
import os from 'os';
import path from 'path';

import * as setup from '../src/setup-dotnet';
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

const tempDir = path.join(__dirname, 'runner', 'temp2');

describe('setup-dotnet tests', () => {
  let getInputSpy = jest.spyOn(core, 'getInput');
  let getMultilineInputSpy = jest.spyOn(core, 'getMultilineInput');
  let setOutputSpy = jest.spyOn(core, 'setOutput');

  let inputs = {} as any;

  beforeAll(async () => {
    process.env.RUNNER_TOOL_CACHE = toolDir;
    process.env.DOTNET_INSTALL_DIR = toolDir;
    process.env.RUNNER_TEMP = tempDir;
    try {
      await io.rmRF(`${toolDir}/*`);
      await io.rmRF(`${tempDir}/*`);
    } catch (err) {
      console.log(err.message);
      console.log('Failed to remove test directories');
    }
  }, 30000);

  afterEach(async () => {
    try {
      await io.rmRF(path.join(process.cwd(), 'global.json'));
      await io.rmRF(`${toolDir}/*`);
      await io.rmRF(`${tempDir}/*`);
    } catch (err) {
      console.log(err.message);
      console.log('Failed to remove test directories');
    }
  }, 30000);

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
  }, 400000);

  it("Sets output with the latest installed by action version if global.json file isn't specified", async () => {
    inputs['dotnet-version'] = ['3.1.201', '6.0.401'];

    getMultilineInputSpy.mockImplementation(input => inputs[input]);

    await setup.run();

    expect(setOutputSpy).toBeCalledWith('dotnet-version', '6.0.401');
  }, 400000);

  it("Sets output with the version specified in global.json, if it's present", async () => {
    const globalJsonPath = path.join(process.cwd(), 'global.json');
    const jsonContents = `{${os.EOL}"sdk": {${os.EOL}"version": "3.0.103"${os.EOL}}${os.EOL}}`;
    if (!fs.existsSync(globalJsonPath)) {
      fs.writeFileSync(globalJsonPath, jsonContents);
    }

    inputs['dotnet-version'] = ['3.1.201', '6.0.401'];
    inputs['global-json-file'] = './global.json';

    getMultilineInputSpy.mockImplementation(input => inputs[input]);

    getInputSpy.mockImplementation(input => inputs[input]);

    await setup.run();

    expect(setOutputSpy).toBeCalledWith('dotnet-version', '3.0.103');
  }, 400000);
});
