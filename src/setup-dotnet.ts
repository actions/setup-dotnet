import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as installer from './installer';
import * as fs from 'fs';
import * as path from 'path';
import * as auth from './authutil';

export async function run() {
  try {
    //
    // Version is optional.  If supplied, install / use from the tool cache
    // If not supplied then task is still used to setup proxy, auth, etc...
    //
    let version: string = core.getInput('version');
    if (!version) {
      version = core.getInput('dotnet-version');
    }
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
      let toolPaths = new Array<string>();
      let versions = version.split(',');
      console.log(`Specified .NET verions: ${versions}`);
      for (var currentVersion of versions) {
        console.log(`Installing .NET SDK ${currentVersion}...`);
        const dotnetInstaller = new installer.DotnetCoreInstaller(
          currentVersion
        );
        toolPaths.push(await dotnetInstaller.installDotnet());
      }
      if (toolPaths.length > 0) {
        console.log(`Setting up SxS .NET SDK versions...`);
        const sxsInstall = new installer.SxSDotnetCoreInstaller(toolPaths);
        await sxsInstall.setupSxs();
      }
    }

    const sourceUrl: string = core.getInput('source-url');
    const configFile: string = core.getInput('config-file');
    if (sourceUrl) {
      auth.configAuthentication(sourceUrl, configFile);
    }

    const matchersPath = path.join(__dirname, '..', '.github');
    console.log(`##[add-matcher]${path.join(matchersPath, 'csc.json')}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
