import * as core from '@actions/core';
import * as installer from './installer';
import * as fs from 'fs';
import * as path from 'path';

export async function run() {
  try {
    //
    // Version is optional.  If supplied, install / use from the tool cache
    // If not supplied then task is still used to setup proxy, auth, etc...
    //
    let version: string = core.getInput('version');
    if (!version) {
      // Try to fall back to global.json
      core.debug('No version found, trying to find version from global.json');
      const globalJsonPath = path.join(process.cwd(), 'global.json');
      if (fs.existsSync(globalJsonPath)) {
        const globalJson = JSON.parse(
          fs.readFileSync(globalJsonPath, {encoding: 'utf8'})
        );
        if (globalJson.sdk && globalJson.sdk.version) {
          version = globalJson.sdk.version;
        }
      }
    }

    if (version) {
      const dotnetInstaller = new installer.DotnetCoreInstaller(version);
      await dotnetInstaller.installDotnet();
    }

    // TODO: setup proxy from runner proxy config

    const matchersPath = path.join(__dirname, '..', '.github');
    console.log(`##[add-matcher]${path.join(matchersPath, 'csc.json')}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
