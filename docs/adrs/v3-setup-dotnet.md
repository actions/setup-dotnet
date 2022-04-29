# V3 setup-dotnet

Date: 2021-06-30  
Status: Proposed

# Context
- GitHub-hosted Ubuntu and Windows runners have .NET versions pre-installed in system directories
  - Ubuntu:`/usr/share/dotnet`
  - Windows:`C:\Program Files\dotnet`
- V1 version of Action installs .NET to user's directory
  - Ubuntu:`/home/runner/.dotnet`
  - Windows: `C:\Users\runneradmin\AppData\Local\Microsoft\dotnet`
- It means that action always download and install .NET version even if it is pre-installed. Also after using the action all pre-installed .NET versions are unavailable because `DOTNET_ROOT` is overriden to user directory.
The behavior is different for macOS runners because pre-installation directory matches the one that is used by action. It means action can use pre-installed versions if it exists, which speeds up customer's workflow.

- The different behavior of setup task on Ubuntu, Windows and MacOS runners is unclear and confusing for customers.

- .NET supports installing and using multiple versions of .NET SDK and .NET runtime sidy-by-side. .NET CLI will use the latest of installed .NET SDK and .NET runtime version if there is no global.json file containing a different version. This behavior is defined by .NET design (https://docs.microsoft.com/en-us/dotnet/core/versions/selection).

- The action contains logic to handle inputs with wildcards, for example `5.0.x`, `5.0.*`, `5.x` or `5.*`. This logic uses metadata from `https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json` to retrieve the list of available releases and get the latest release version for the specified major and/or minor version from input. After that, installer script (`dotnet-install.ps1` for Windows or `dotnet-install.sh` for Linux and MacOS) installs required SDK using exact version as a parameter.

# Proposal
- Change .NET installation path for Windows and Ubuntu images to match the location of pre-installed versions by using `-InstallDir` (Windows) and `--install-dir` (Ubuntu) property for installer scripts:
https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-install-script
- Get rid of redundant logic to resolve wildcard version on Action side and start relying on [official installer scripts provided by .NET Core team](https://github.com/dotnet/install-scripts).  
The execution `dotnet-install.ps1 -Channel 5.0` installs the latest patch version for 5.0 sdk. In this way we can handle inputs with wildcard as patch version (`5.0.x` or `5.0.*`) by passing major and minor version to installer script directly as `channel` parameter. This parameter supports two-part version in X.Y format as input values ([see installer scripts documentation](https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-install-script)). In further the version input format of action will follow the format which is supported by installers scripts. 

# Breaking changes
- The presence of pre-installed .NET versions that are higher than version that the users specify in the setup task can be breaking for some customers, who expect only one installed .NET version on runner after using setup task. If user doesn't have .NET version specified in project file, `dotnet` will use the latest installed version instead of provided in setup task.  
> **Note:** It is the biggest deal in this ADR.
Previously, when user specifies .NET version, this exact version was used by `dotnet` command by default (because it was installed in the separate folder and there are no any other .NET versions in that folder)  
In proposal, the specified version will be installed on machine but the latest version will be used by `dotnet` command by default (because specified version will be installed alongside with pre-installed .NET versions).  
Based on [official .NET documentation](https://docs.microsoft.com/en-us/dotnet/core/versions/selection), it is expected behavior and how it works on user's local machine with multiple installed .NET versions but some customers could be broken because they already rely on current behavior.

- All possible inputs will continue to work as previously except `5.x`. It is totally okay to drop it because we shouldn't allow user to rely on such input. New minor release of .NET will break their builds

To avoid breaking customers, we will need to release new major task version (V3).

# v3-preview
There will be a v3-preview branch that will be created for development and testing. Any changes will first be merged into v3-preview branch. After a period of testing & verification, the v3-preview branch will be merged into the main branch and a v3 tag will be created. Any GitHub public documentation and starter workflows that mention setup-dotnet will then be updated to use v3 instead of v2:
- [README.md](https://github.com/actions/setup-dotnet/blob/main/README.md)
- [action.yml](https://github.com/actions/setup-dotnet/blob/main/action.yml)
- [GitHub docs](https://docs.github.com/en/actions/guides/building-and-testing-net#using-a-specific-net-version)
- Starter-workflow yamls: [#1](https://github.com/actions/starter-workflows/blob/main/ci/dotnet.yml#L17), [#2](https://github.com/actions/starter-workflows/blob/main/ci/dotnet-desktop.yml#L72)

# Consequences
- Customers will be able to use pre-installed .NET versions with setup-dotnet action on Windows and Ubuntu
- Maintenance of the action will be easier due the simplier logic of handling inputs with wildcards