# v3 setup-dotnet

Date: 2022-08-25  
Status: Accepted

# Context
- GitHub-hosted Ubuntu and Windows runners have .NET versions pre-installed in system directories
  - Ubuntu:`/usr/share/dotnet`
  - Windows:`C:\Program Files\dotnet`
- V1 version of Action installs .NET to the user's directory
  - Ubuntu:`/home/runner/.dotnet`
  - Windows: `C:\Users\runneradmin\AppData\Local\Microsoft\dotnet`
- It means that action always downloads and installs .NET version even if it is pre-installed. Also after using the action all pre-installed .NET versions are unavailable because `DOTNET_ROOT` is overridden to the user's directory.
The behavior is different for macOS runners because the pre-installation directory matches the one that is used by action. It means action can use pre-installed versions if they exist, which speeds up the customer's workflow.

- The different behavior of the setup task on Ubuntu, Windows and macOS runners is unclear and confusing for customers.

- .NET supports installing and using multiple versions of .NET SDK and .NET runtime side-by-side. .NET CLI will use the latest installed .NET SDK and .NET runtime versions if there is no global.json file containing a different version. This behavior is defined by .NET design (https://docs.microsoft.com/en-us/dotnet/core/versions/selection).

- The action contains logic to handle inputs with wildcards, for example `5.0.x`, `5.0.*`, `5.x` or `5.*`. This logic uses metadata from `https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json` to retrieve the list of available releases and get the latest release version for the specified major and/or minor version from the input. After that, installer script (`dotnet-install.ps1` for Windows or `dotnet-install.sh` for Linux and macOS) installs the required SDK using exact version as a parameter.

# Proposal

- Change .NET installation path for Windows and Ubuntu images to match the location of pre-installed versions by using `-InstallDir` (Windows) and `--install-dir` (Ubuntu) properties for installer scripts:
https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-install-script

- Simplify and in some cases fully get rid of logic for resolving wildcard versions and start relying on [official installer scripts provided by .NET Core team](https://github.com/dotnet/install-scripts).  
The execution `dotnet-install.ps1 -Channel 5.0` installs the latest patch version for 5.0 SDK. If SDK is in the prerelease phase, the latest prerelease version (preview or rc) will be installed.

Inputs with wildcards in the patch tag (`5.0.x` or `5.0.*`) can be handled by passing major and minor versions to the installer script directly as a `channel` parameter. This parameter supports two-part version in `X.Y` format as input value ([see installer scripts documentation](https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-install-script)).

Inputs with wildcards in the minor tag (`3.x` or `3.*`) can be handled like that:
1. The request is sent to MS dist and the `releases.json` file is got
2. The action gets the latest possible channel version out of retrieved `releases.json` that satisfies input major tag (e.g. for `3.x` nowadays it's `3.1`) 
3. Retrieved channel version is passed to installer script directly as `channel` parameter.

> **Note:** Using the `channel` parameter of the MS .NET installer scripts will allow us to use the `quality` parameter as well. This functionality is also asked for by our customers.

# Breaking changes
- The presence of pre-installed .NET versions that are higher than the version that the users specify in the setup task can be breaking for some customers, who expect only one installed .NET version on the runner after using the setup task. If a user doesn't have .NET version specified in project file, the `dotnet` will use the latest installed version instead of provided in the setup task.  
> **Note:** It is the biggest deal in this ADR.

Previously, when a user would specify a .NET version, this exact version was used by the `dotnet` command by default (because it was installed in a separate folder and there were no other.NET versions in that folder)  
In the proposal, the specified version will be installed on the machine but the latest version will be used by the `dotnet` command by default (because specified version will be installed alongside with pre-installed .NET versions).  
Based on [official .NET documentation](https://docs.microsoft.com/en-us/dotnet/core/versions/selection), it is expected behavior and how it works on user's local machine with multiple installed .NET versions but some customer's workflows could be broken because they already rely on current behavior.

To avoid breaking customers, we will need to release a new major task version (v3).

# v3-preview
There will be a v3-preview branch that will be created for development and testing. Any changes will first be merged into the v3-preview branch. After a period of testing & verification, the v3-preview branch will be merged into the main branch and a v3 tag will be created. Any GitHub public documentation and starter workflows that mention setup-dotnet will then be updated to use v3 instead of v2:
- [README.md](https://github.com/actions/setup-dotnet/blob/main/README.md)
- [action.yml](https://github.com/actions/setup-dotnet/blob/main/action.yml)
- [GitHub docs](https://docs.github.com/en/actions/guides/building-and-testing-net#using-a-specific-net-version)
- Starter-workflow yamls: [#1](https://github.com/actions/starter-workflows/blob/main/ci/dotnet.yml#L17), [#2](https://github.com/actions/starter-workflows/blob/main/ci/dotnet-desktop.yml#L72)

# Consequences
- Customers will be able to use pre-installed .NET versions with setup-dotnet action on Windows and Ubuntu