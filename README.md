# setup-dotnet

<p align="left">
  <a href="https://github.com/actions/setup-dotnet"><img alt="GitHub Actions status" src="https://github.com/actions/setup-dotnet/workflows/Main%20workflow/badge.svg"></a>
</p>

This action sets up a [dotnet core cli](https://github.com/dotnet/cli) environment for use in actions by:

- optionally downloading and caching a version of dotnet by SDK version and adding to PATH
- registering problem matchers for error output
- setting up authentication to private package sources like GitHub Packages

# Usage

See [action.yml](action.yml)

Basic:
```yaml
steps:
- uses: actions/checkout@master
- uses: actions/setup-dotnet@v1
  with:
    dotnet-version: '3.1.x' # SDK Version to use; x will use the latest version of the 3.1 channel
- run: dotnet build <my project>
```

Matrix Testing:
```yaml
jobs:
  build:
    runs-on: ubuntu-16.04
    strategy:
      matrix:
        dotnet: [ '2.2.103', '3.0', '3.1.x' ]
    name: Dotnet ${{ matrix.dotnet }} sample
    steps:
      - uses: actions/checkout@master
      - name: Setup dotnet
        uses: actions/setup-dotnet@v1
        with:
          dotnet-version: ${{ matrix.dotnet }}
      - run: dotnet build <my project>
```

Authentication for nuget feeds:
```yaml
steps:
- uses: actions/checkout@master
# Authenticates packages to push to GPR
- uses: actions/setup-dotnet@v1
  with:
    dotnet-version: '3.1.x' # SDK Version to use.
    source-url: https://nuget.pkg.github.com/<owner>/index.json
  env:
    NUGET_AUTH_TOKEN: ${{secrets.GITHUB_TOKEN}}
- run: dotnet build <my project>
- name: Create the package
  run: dotnet pack --configuration Release <my project>
 - name: Publish the package to GPR
  run: dotnet nuget push <my project>/bin/Release/*.nupkg

# Authticates packages to push to Azure Artifacts
- uses: actions/setup-dotnet@v1
  with:
    source-url: https://pkgs.dev.azure.com/<your-organization>/_packaging/<your-feed-name>/nuget/v3/index.json
  env:
    NUGET_AUTH_TOKEN: ${{secrets.AZURE_DEVOPS_PAT}} # Note, create a secret with this name in Settings
- name: Publish the package to Azure Artifacts
  run: dotnet nuget push <my project>/bin/Release/*.nupkg
```

## Environment Variables to use with dotnet

Some environment variables may be necessary for your particular case or to improve logging. Some examples are listed below, but the full list with complete details can be found here: https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet#environment-variables

- DOTNET_NOLOGO - removes logo and telemetry message from first run of dotnet cli (default: false)
- DOTNET_CLI_TELEMETRY_OPTOUT - opt-out of telemetry being sent to Microsoft (default: false)
- DOTNET_MULTILEVEL_LOOKUP - configures whether the global install location is used as a fall-back (default: true)

Example usage:
```
build:
  runs-on: ubuntu-latest
  env:
    DOTNET_NOLOGO: true
  steps:
    - uses: actions/checkout@master
    - uses: actions/setup-dotnet@v1
      with:
        dotnet-version: '3.1.100' # SDK Version to use.
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

# Contributions

Contributions are welcome!  See [Contributor's Guide](docs/contributors.md)
