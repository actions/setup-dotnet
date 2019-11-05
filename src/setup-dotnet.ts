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
    console.log(
      `::warning::Use the v1 tag to get the last version, master may contain breaking changes and will not contain any required packages in the future. i.e. actions/setup-dotnet@v1`
    );

    let version: string = core.getInput('dotnet-version');

    if (version) {
      const dotnetInstaller = new installer.DotnetCoreInstaller(version);
      await dotnetInstaller.installDotnet();
    } else {
      // Try to fall back to global.json
      core.debug('No version found, falling back to global.json');
      const globalJsonPath = path.join(process.cwd(), 'global.json');
      if (fs.existsSync(globalJsonPath)) {
        const dotnetInstaller = new installer.DotnetCoreInstaller(
          undefined,
          globalJsonPath
        );
        await dotnetInstaller.installDotnet();
      }
    }

    // TODO: setup proxy from runner proxy config

    const matchersPath = path.join(__dirname, '..', '.github');
    console.log(`##[add-matcher]${path.join(matchersPath, 'csc.json')}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
