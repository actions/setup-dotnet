# V2 setup-dotnet

Date: 2021-02-15
Status: Proposed

# Context
- GitHub-hosted Ubuntu and Windows runners have .NET versions pre-installed in system directories, but the `v1` version of action installs .NET to user's directory for that runners. It means that action always download and install .NET version even if it is pre-installed.
The behavior is different for macOS runners because pre-installation directory matches the one that is used by action. It means action can use pre-installed versions if it exists, which speeds up customer's workflow.

- According to .NET documentation (https://docs.microsoft.com/en-us/dotnet/core/versions/selection), .NET CLI will use the latest installed .NET SDK and .NET runtime if there are multiple versions installed side-by-side.
It is unclear for customers who expect that .NET specified in the task will be used for their project.

# Decision
- Change default location for dotnet installation on Windows and Ubuntu images to the pre-installed versions location. It can be reached by using `-InstallDir` (or `--install-dir` for Ubuntu) property for installer scripts: https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-install-script

- Create `global.json` file via `setup-dotnet` to specify installed dotnet version as current

# v2-preview
There will be a v2-preview branch that will be created for development and testing. Any changes will first be merged into v2-preview branch. After a period of testing & verification, the v2-preview branch will be merged into the main branch and a v2 tag will be created. Any GitHub public documentation and starter workflows that mention setup-dotnet will then be updated to use v2 instead of v1.

# Consequences
- Users will be able to use pre-installed dotnet versions after using `setup-dotnet` task on Windows and Ubuntu runners.
- The current dotnet version will be forced to version that user points in the task.