# V2 setup-dotnet

Date: 2021-02-15
Status: Proposed

# Context
- GitHub-hosted Ubuntu and Windows runners have .NET versions pre-installed in system directories (Ubuntu:`/usr/share/dotnet`, Windows:`C:\Program Files\dotnet`), but the `v1` version of action installs .NET to user's directory (Ubuntu:`/home/runner/.dotnet`, Windows: `C:\Users\runneradmin\AppData\Local\Microsoft\dotnet`) for that runners. It means that action always download and install .NET version even if it is pre-installed and after using the action all pre-installed .NET versions are unavailable.
The behavior is different for macOS runners because pre-installation directory matches the one that is used by action. It means action can use pre-installed versions if it exists, which speeds up customer's workflow.

- The different behavior of setup task on Ubuntu, Windows and MacOS runners is being unclear and confusing for customers.

- .NET supports installing and using multiple versions of .NET SDK and .NET runtime sidy-by-side and .NET CLI will use the latest of installed .NET SDK and .NET runtime version, this behavior is defined by .NET design (https://docs.microsoft.com/en-us/dotnet/core/versions/selection). The common practice is specifying required versions in project file. From other side, the presence of pre-installed .NET versions that are higher than version that the customers specify in the setup task can be breaking for some customers, who expect only one installed .NET version on runner after using setup task, so we should release new task version for consistent behavior on all runners and avoid breaking changes.

- The action contains logic to handle inputs with wildcards, for example `5.0.x`, `5.0.*`, `5.x` or `5.*`. This logic uses metadata from 'https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json' to retrieve list of available releases and get the latest release version for the specified major and/or minor version from input. After that, installer script (`dotnet-install.ps1` for Windows or `dotnet-install.sh` for Linux and MacOS) installs required SDK using exact version as parameter. We can get rid of this unnecessary logic in action since installer scripts have similar logic to find the latest release if the script is invoked with `channel` option. Example: the execution `dotnet-install.ps1 -Channel 5.0` installs the latest patch version for 5.0 sdk. In this way we can handle inputs with wildcard as patch version (`5.0.x` or `5.0.*`) by passing major and minor version to installer script directly as `channel` parameter. The inputs with wildcard as minor version (`5.x`) should be unsupported in V2 version of the action.

# Proposal
- Change .NET installation path for Windows and Ubuntu images to match the location of pre-installed versions by using `-InstallDir` (Windows) and `--install-dir` (Ubuntu) property for installer scripts:
https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-install-script
- Get rid of redundant logic for retrieving releases metadata to find exact version and use possibilities of installer scripts for these operations to handle inputs with wildcards.
- Release new task version to avoid breaking changes for customers.

# v2-preview
There will be a v2-preview branch that will be created for development and testing. Any changes will first be merged into v2-preview branch. After a period of testing & verification, the v2-preview branch will be merged into the main branch and a v2 tag will be created. Any GitHub public documentation and starter workflows that mention setup-dotnet will then be updated to use v2 instead of v1:
- [README.md](https://github.com/actions/setup-dotnet/blob/main/README.md)
- [action.yml](https://github.com/actions/setup-dotnet/blob/main/action.yml)
- [GitHub docs](https://docs.github.com/en/actions/guides/building-and-testing-net#using-a-specific-net-version)
- Starter-workflow yamls: [#1](https://github.com/actions/starter-workflows/blob/main/ci/dotnet.yml#L17), [#2](https://github.com/actions/starter-workflows/blob/main/ci/dotnet-desktop.yml#L72)

# Consequences
- Customers will be able to use pre-installed .NET versions with setup-dotnet action on Windows and Ubuntu.
- Maintanance of the action will be easier due the simplier logic of handling inputs with wildcards.