# V3 setup-dotnet

Date: 2022-08-25  
Status: Proposed

# Context
- GitHub-hosted Ubuntu and Windows runners have .NET versions pre-installed in system directories
  - Ubuntu:`/usr/share/dotnet`
  - Windows:`C:\Program Files\dotnet`
- V1 version of Action installs .NET to user's directory
  - Ubuntu:`/home/runner/.dotnet`
  - Windows: `C:\Users\runneradmin\AppData\Local\Microsoft\dotnet`
- It means that action always download and install .NET version even if it is pre-installed. Also after using the action all pre-installed .NET versions are unavailable because `DOTNET_ROOT` is overriden to user's directory.
The behavior is different for macOS runners because pre-installation directory matches the one that is used by action. It means action can use pre-installed versions if they exist, which speeds up customer's workflow.

- The different behavior of the setup task on Ubuntu, Windows and MacOS runners is unclear and confusing for customers.

- .NET supports installing and using multiple versions of .NET SDK and .NET runtime side-by-side. .NET CLI will use the latest installed .NET SDK and .NET runtime versions if there is no global.json file containing a different version. This behavior is defined by .NET design (https://docs.microsoft.com/en-us/dotnet/core/versions/selection).

# Proposal
- Change .NET installation path for Windows and Ubuntu images to match the location of pre-installed versions by using `-InstallDir` (Windows) and `--install-dir` (Ubuntu) properties for installer scripts:
https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-install-script

# Breaking changes
- The presence of pre-installed .NET versions that are higher than version that the users specify in the setup task can be breaking for some customers, who expect only one installed .NET version on runner after using the setup task. If user doesn't have .NET version specified in project file, `dotnet` will use the latest installed version instead of provided in the setup task.  
> **Note:** It is the biggest deal in this ADR.
Previously, when a user would specify a .NET version, this exact version was used by `dotnet` command by default (because it was installed in a separate folder and there were no other.NET versions in that folder)  
In proposal, the specified version will be installed on machine but the latest version will be used by `dotnet` command by default (because specified version will be installed alongside with pre-installed .NET versions).  
Based on [official .NET documentation](https://docs.microsoft.com/en-us/dotnet/core/versions/selection), it is expected behavior and how it works on user's local machine with multiple installed .NET versions but some customers could be broken because they already rely on current behavior.

To avoid breaking customers, we will need to release a new major task version (V3).

# v3-preview
There will be a v3-preview branch that will be created for development and testing. Any changes will first be merged into v3-preview branch. After a period of testing & verification, the v3-preview branch will be merged into the main branch and a v3 tag will be created. Any GitHub public documentation and starter workflows that mention setup-dotnet will then be updated to use v3 instead of v2:
- [README.md](https://github.com/actions/setup-dotnet/blob/main/README.md)
- [action.yml](https://github.com/actions/setup-dotnet/blob/main/action.yml)
- [GitHub docs](https://docs.github.com/en/actions/guides/building-and-testing-net#using-a-specific-net-version)
- Starter-workflow yamls: [#1](https://github.com/actions/starter-workflows/blob/main/ci/dotnet.yml#L17), [#2](https://github.com/actions/starter-workflows/blob/main/ci/dotnet-desktop.yml#L72)

# Consequences
- Customers will be able to use pre-installed .NET versions with setup-dotnet action on Windows and Ubuntu