# Contributors

Thank you for contributing! This action is targetted around setting up the dotnet cli and related sdks for GitHub actions. As part of that we use proxy settings (for self-hosted runners) and set-up nuget authentication for private feeds.

If you would like to contribute there are a few things to consider:

## Commands to use

- npm run build - Compiles the action into a single js file at dist/index.js (Please check in the changes made by this command)
- npm run test - Runs all tests under __tests__
- npm run format - Runs formatting required to pass the lint test (Please check in the changes made by this command)
- npm run update-installers - Updates the install-dotnet scripts in externals (Please check in the changes made by this command)

## To check in or not to check in

- Do check in source (src)
- Do check in index file (dist)
- Do check in updates to install-dotnet scripts (externals)
- Do not check in build output (lib)
- Do not check in runtime (node_modules)

## Writing tests

With any contribution please take time to consider how this can be tested to maintain high quality. Current tests can be found in the folder __tests__ for examples.
