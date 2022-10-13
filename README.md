# setup-dotnet

[![GitHub Actions Status](https://github.com/actions/setup-dotnet/workflows/Main%20workflow/badge.svg)](https://github.com/actions/setup-dotnet)

This action sets up a [.NET CLI](https://github.com/dotnet/sdk) environment for use in actions by:

- optionally downloading and caching a version(s) of dotnet by SDK version(s) and adding to PATH
- registering problem matchers for error output
- setting up authentication to private package sources like GitHub Packages

> **Note**: GitHub hosted runners have some versions of the .NET SDK
preinstalled. Installed versions are subject to change. Please refer to the
documentation
[software installed on github hosted runners](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners#supported-software)
for .NET SDK versions that are currently available.

## Usage

See [action.yml](action.yml)

**Basic**:
```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-dotnet@v3
  with:
    dotnet-version: '3.1.x'
- run: dotnet build <my project>
```

**Multiple version installation**:
```yml
steps:
- uses: actions/checkout@v3
- name: Setup dotnet
  uses: actions/setup-dotnet@v3
  with:
    dotnet-version: | 
      3.1.x
      5.0.x
- run: dotnet build <my project>
```
> **Note**: In case multiple versions are installed, the latest .NET version will be used by default unless another version is specified in the `global.json` file.

## Supported version syntax

The `dotnet-version` input supports following syntax:

- **A.B.C** (e.g 6.0.400, 7.0.100-preview.7.22377.5) - installs exact version of .NET SDK
- **A.B** or **A.B.x** (e.g. 3.1, 3.1.x) - installs the latest patch version of .NET SDK on the channel `3.1`, including prerelease versions (preview, rc)
- **A** or **A.x** (e.g. 3, 3.x) - installs the latest minor version of the specified major tag, including prerelease versions (preview, rc)


## Using the `dotnet-quality` input
This input sets up the action to install the latest build of the specified quality in the channel. The possible values of `dotnet-quality` are: **daily**, **signed**, **validated**, **preview**, **ga**.

> **Note**: `dotnet-quality` input can be used only with .NET SDK version in 'A.B', 'A.B.x', 'A' and 'A.x' formats where the major version is higher than 5. In other cases, `dotnet-quality` input will be ignored.

```yml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-dotnet@v3
  with:
    dotnet-version: '6.0.x'
    dotnet-quality: 'preview'
- run: dotnet build <my project>
```

## Using the `global-json-file` input
`setup-dotnet` action can read .NET SDK version from a `global.json` file. Input `global-json-file` is used for specifying the path to the `global.json`. If the file that was supplied to `global-json-file` input doesn't exist, the action will fail with error.

>**Note**: In case both `dotnet-version` and `global-json-file` inputs are used, versions from both inputs will be installed.

```yml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-dotnet@v3
  with:
    global-json-file: csharp/global.json
- run: dotnet build <my project>
  working-directory: csharp
```

## Matrix Testing
Using `setup-dotnet` it's possible to use [matrix syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategymatrix) to install several versions of .NET SDK:
```yml
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        dotnet: [ '2.1.x', '3.1.x', '5.0.x' ]
    name: Dotnet ${{ matrix.dotnet }} sample
    steps:
      - uses: actions/checkout@v3
      - name: Setup dotnet
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: ${{ matrix.dotnet }}
      - run: dotnet build <my project>
```
## Setting up authentication for nuget feeds

### Github Package Registry (GPR)
```yml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-dotnet@v3
  with:
    dotnet-version: '3.1.x'
    source-url: https://nuget.pkg.github.com/<owner>/index.json
  env:
    NUGET_AUTH_TOKEN: ${{secrets.GITHUB_TOKEN}}
- run: dotnet build <my project>
- name: Create the package
  run: dotnet pack --configuration Release <my project>
- name: Publish the package to GPR
  run: dotnet nuget push <my project>/bin/Release/*.nupkg
```

### Azure Artifacts
```yml
- uses: actions/setup-dotnet@v3
  with:
    source-url: https://pkgs.dev.azure.com/<your-organization>/_packaging/<your-feed-name>/nuget/v3/index.json
  env:
    NUGET_AUTH_TOKEN: ${{secrets.AZURE_DEVOPS_PAT}} # Note, create a secret with this name in Settings
- name: Publish the package to Azure Artifacts
  run: dotnet nuget push <my project>/bin/Release/*.nupkg
```

### nuget.org
```yml
- uses: actions/setup-dotnet@v3
  with:
    dotnet-version: 3.1.x
- name: Publish the package to nuget.org
  run: dotnet nuget push */bin/Release/*.nupkg -k $NUGET_AUTH_TOKEN -s https://api.nuget.org/v3/index.json
  env:
    NUGET_AUTH_TOKEN: ${{ secrets.NUGET_TOKEN }}
```
> **Note**: It's the only way to push a package to nuget.org feed for macOS/Linux machines due to API key config store limitations.

# Outputs and environment variables

## Outputs

### `dotnet-version`

Using the **dotnet-version** output it's possible to get the installed by the action .NET SDK version. 

**Single version installation**

In case of a single version installation, the `dotnet-version` output contains the version that is installed by the action.

```yaml
    - uses: actions/setup-dotnet@v3
      id: cp310
      with:
        dotnet-version: 3.1.422
    - run: echo '${{ steps.cp310.outputs.dotnet-version }}' # outputs 3.1.422
```

**Multiple version installation**

In case of a multiple version installation, the `dotnet-version` output contains the latest version that is installed by the action.

```yaml
    - uses: actions/setup-dotnet@v3
      id: cp310
      with:
        dotnet-version: | 
          3.1.422
          5.0.408
    - run: echo '${{ steps.cp310.outputs.dotnet-version }}' # outputs 5.0.408
```
**Installation from global.json**

When the `dotnet-version` input is used along with the `global-json-file` input, the `dotnet-version` output contains the version resolved from the `global.json`.

```yaml
    - uses: actions/setup-dotnet@v3
      id: cp310
      with:
        dotnet-version: | 
          3.1.422
          5.0.408
        global-json-file: "./global.json" # contains version 2.2.207
    - run: echo '${{ steps.cp310.outputs.dotnet-version }}' # outputs 2.2.207
```

## Environment variables

Some environment variables may be necessary for your particular case or to improve logging. Some examples are listed below, but the full list with complete details can be found here: https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-environment-variables

| **Env.variable**      | **Description** | **Default value** |
| ----------- | ----------- | ----------- |
| DOTNET_INSTALL_DIR      |Specifies a directory where .NET SDKs should be installed by the action.|*default value for each OS* |
| DOTNET_NOLOGO      |Removes logo and telemetry message from first run of dotnet cli|*false*|
| DOTNET_CLI_TELEMETRY_OPTOUT   |Opt-out of telemetry being sent to Microsoft|*false*|
| DOTNET_MULTILEVEL_LOOKUP   |Configures whether the global install location is used as a fall-back|*true*|

The default value of the `DOTNET_INSTALL_DIR` environment variable depends on the operation system which is used on a runner:
| **Operation system**      | **Default value** |
| ----------- | ----------- |
| **Windows** | `C:\Program Files\dotnet` |
| **Ubuntu** | `/usr/share/dotnet` |
| **macOS** | `/Users/runner/.dotnet` |

**Example usage**:
```yml
build:
  runs-on: ubuntu-latest
  env:
    DOTNET_INSTALL_DIR: "path/to/directory"
  steps:
    - uses: actions/checkout@main
    - uses: actions/setup-dotnet@v3
      with:
        dotnet-version: '3.1.x'
```

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

## Contributions

Contributions are welcome! See [Contributor's Guide](docs/contributors.md)
