# V2 setup-dotnet

Date: 2021-02-15
Status: Proposed

# Context
- The `v1` version of `setup-dotnet` installs dotnet to user directory. The pre-installed versions are located in system directories on Windows and Ubuntu images and after using the task all pre-installed versions become unavailable. The task always installs any dotnet version even if it is pre-installed. This behavior is different for macOS runner, where pre-installed dotnet versions are located in the same user directory and remain available. For the same reason the task on macOS runner doesn't download dotnet version again if it is pre-installed and the task uses pre-installed version.

- According dotnet documentation, if there are several installed `side-by-side` versions the dotnet CLI commands use the latest installed .NET SDK and .NET runtime for dotnet. Sometimes this behavior is unclear for users who expect the dotnet version specified in the task.

# Decision
- Change default location for dotnet installation on Windows and Ubuntu images to the pre-installed versions location. It can be reached by using `-InstallDir` (or `--install-dir` for Ubuntu) property for installer scripts: https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-install-script

- Create `global.json` file via `setup-dotnet` to specify installed dotnet version as current: https://docs.microsoft.com/en-us/dotnet/core/versions/selection

# v2-preview
There will be a v2-preview branch that will be created for development and testing. Any changes will first be merged into v2-preview branch. After a period of testing & verification, the v2-preview branch will be merged into the main branch and a v2 tag will be created. Any GitHub public documentation and starter workflows that mention setup-dotnet will then be updated to use v2 instead of v1.

# Consequences
- Users will be able to use pre-installed dotnet versions after using `setup-dotnet` task on Windows and Ubuntu runners.
- The current dotnet version will be forced to version that user points in the task.