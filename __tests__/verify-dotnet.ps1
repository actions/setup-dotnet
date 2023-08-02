<#
  .DESCRIPTION
  Verifies that installed on the machine .NET SDK versions match the input patterns.
  Optionally checks that the nuget.config file is generated correctly.

  .PARAMETER Patterns
  Specifies the regular expression patterns that should be matched with the installed
  on the machine .NET SDK versions. The number of patterns should be equal to the number
  of installed .NET versions. 

  .PARAMETER CheckNugetConfig
  Switches the check for the existence of the nuget.config file.

  .EXAMPLE
  PS> .\verify-dotnet.ps1 -Paterns "^3.1.200$", "^6.0" -CheckNugetConfig
#>

param(
  [ValidateNotNullOrEmpty()]
  [Parameter(Mandatory=$true)]
  [string[]]$Patterns,
  [switch]$CheckNugetConfig
)

$PatternsList = [System.Collections.ArrayList]($Patterns)

if ($CheckNugetConfig.IsPresent -and !(Test-Path "../nuget.config")) {
  throw "The nuget.config file is not generated correctly."
}

Write-Host "These patterns were supplied to the script: $($PatternsList -join ', ')."
$dotnet = Get-Command dotnet | Select-Object -First 1 | ForEach-Object { $_.Path }
Write-Host "Found: '$dotnet'"

# SDKs are listed on multiple lines with the path afterwards in square brackets
$Versions = & $dotnet --list-sdks | ForEach-Object { $_.SubString(0, $_.IndexOf('[')).Trim() }
Write-Host "Found installed versions: $($Versions -join ', ')."
$InstalledVersionCount = $Versions.Count

foreach($version in $Versions)
{
  foreach($pattern in $PatternsList) 
  {
    if ($version -match $pattern)
    { 
      $PatternsList.Remove($pattern)
      $InstalledVersionCount--
      break
    }
  }
}

if ( $InstalledVersionCount -ne 0)
{
  throw "An unexpected version of Dotnet is found on the machine, please check the correctness of the -Patterns input."
}

$workingDir = Get-Location
$testProjectDir = "./__tests__/e2e-test-csproj"
Write-Host "Changing directory to the $testProjectDir"
Set-Location $testProjectDir

$targetFrameworkVersionMap = @{
  "1.0" = "netcoreapp1.0";
  "1.1" = "netcoreapp1.1";
  "2.0" = "netcoreapp2.0";
  "2.1" = "netcoreapp2.1";
  "2.2" = "netcoreapp2.2";
  "3.0" = "netcoreapp3.0";
  "3.1" = "netcoreapp3.1";
  "5.0" = "net5.0";
  "6.0" = "net6.0";
  "7.0" = "net7.0";
  "8.0" = "net8.0";
 }

foreach ($version in $Versions)
{
  # Creating temporary global.json file inside e2e-test-csproj dir and setting exact version of .NET inside allows to override default behavior of .NET and run build and tests on that exact version. 
  Write-Host "Creating temporary global.json file for $version .NET version."
  & $dotnet new globaljson --sdk-version $version --force | Out-Null
  if (!(Test-Path "./global.json"))
  {
    throw "An error occured while creating the global.json file. Exit code: $LASTEXITCODE"
  }
  Write-Host "The global.json file for the version $version is created. Currently used .NET version is: $(& $dotnet --version)."

  # Environment variable TEST_TARGET_FRAMEWORK is used inside the test.csproj file to target required framework version
  $version -match "^(?<key>\d+\.\d+)" | Out-Null
  if (!($targetFrameworkVersionMap.ContainsKey($Matches.key)))
  {
    throw "The map with the framework targets doesn't contain a target name for the version $version."
  }
  Write-Host "Setting the TEST_TARGET_FRAMEWORK environment variable to $($targetFrameworkVersionMap[$Matches.key])"
  [Environment]::SetEnvironmentVariable('TEST_TARGET_FRAMEWORK', $($targetFrameworkVersionMap[$Matches.key]))

  Write-Host "Building test C# project with $version .NET version."
  & $dotnet build --no-cache
  if ($LASTEXITCODE -ne 0)
  {
    throw "Building process is not successful, exit code: $LASTEXITCODE"
  }

  Write-Host "Testing compiled C# project with $version .NET version."
  & $dotnet test --no-build
  if ($LASTEXITCODE -ne 0)
  {
    throw "Testing process is not successful, exit code: $LASTEXITCODE"
  }

  Write-Host "Tests are completed successfully!"

  Write-Host "Removing temporary global.json file."
  Remove-Item ./global.json
}

Set-Location $workingDir
