# V2 setup-dotnet

Date: 2021-02-15
Status: Proposed

# Context
- GitHub-hosted Ubuntu and Windows runners have .NET versions pre-installed in system directories (Ubuntu:`/usr/share/dotnet`, Windows:`C:\Program Files\dotnet`), but the `v1` version of action installs .NET to user's directory `$HOME/.dotnet` for that runners. It means that action always download and install .NET version even if it is pre-installed and after using the action all pre-installed .NET versions are unavailable.
The behavior is different for macOS runners because pre-installation directory matches the one that is used by action. It means action can use pre-installed versions if it exists, which speeds up customer's workflow.

- According to .NET documentation (https://docs.microsoft.com/en-us/dotnet/core/versions/selection), .NET CLI will use the latest installed .NET SDK and .NET runtime if there are multiple versions installed side-by-side.
It is unclear for customers who expect that .NET specified in the task will be used for their project.

# Proposal
- Change .NET installation path for Windows and Ubuntu images to match the location of pre-installed versions by using `-InstallDir` (Windows) and `--install-dir` (Ubuntu) property for installer scripts:
https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-install-script
- Implement additional flag to create `global.json` file in runtime to set installed .NET version as a current one.
- Release new task version to avoid breacking changes for customers.

# v2-preview
There will be a v2-preview branch that will be created for development and testing. Any changes will first be merged into v2-preview branch. After a period of testing & verification, the v2-preview branch will be merged into the main branch and a v2 tag will be created. Any GitHub public documentation and starter workflows that mention setup-dotnet will then be updated to use v2 instead of v1: [README.md](https://github.com/actions/setup-dotnet/blob/main/README.md
), [action.yml](https://github.com/actions/setup-dotnet/blob/main/action.yml)

# Consequences
- Customers will be able to use pre-installed .NET versions with setup-dotnet action on Windows and Ubuntu.
- The current .NET version will be forced to the version that the customer specifies in the action inputs.