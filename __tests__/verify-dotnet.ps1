param(
  [ValidateNotNullOrEmpty()]
  [string[]]$Patterns,
  [ValidateNotNullOrEmpty()]
  [string]$ContainedPattern,
  [switch]$CheckNugetConfig
)

if ($CheckNugetConfig.IsPresent) {
  if (!(Test-Path "../nuget.config"))
  {
    throw "The nuget.config file is not generated correctly."
  }
}

if (!$Patterns.Count)
{
  throw "At least 1 dotnet-version pattern should be supplied to script."
}

Write-Host "Those patterns were supplied to the script: $($Patterns -join ', ')."
$dotnet = Get-Command dotnet | Select-Object -First 1 | ForEach-Object { $_.Path }
Write-Host "Found: '$dotnet'"

# SDKs are listed on multiple lines with the path afterwards in square brackets
$versions = & $dotnet --list-sdks | ForEach-Object { $_.SubString(0, $_.IndexOf('[')).Trim() }
Write-Host "Installed versions: $($versions -join ', ')."
$InstalledVersionCount = 0
foreach($pattern in $Patterns)
{
  foreach ($version in $versions)
  {
    if ($ContainedPattern) 
    {
      if ($version.StartsWith($pattern.ToString()) -and $version.Contains($ContainedPattern))
      {
        $InstalledVersionCount++
      } 
    } 
      elseif ($version.StartsWith($pattern.ToString()))
      {
          $InstalledVersionCount++
      }
  }
}
if ( $InstalledVersionCount -ne $Patterns.Count)
{
  throw "An unexpected version of Dotnet is found on the machine, please check the script's dotnet-version patterns."
}

Write-Host "Changing directory to the ./__tests__/e2e-test-csproj"
Set-Location ./__tests__/e2e-test-csproj

$targetFrameworkVersionMapping = @{
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
 }

foreach ($version in $versions)
{
  Write-Host "Creating temporary global.json file for $version .NET version."
  & $dotnet new globaljson --sdk-version $version --force
  Write-Host "The global.json file for the version $version is created. Currently used .NET version is: $(& $dotnet --version)"
  $version -match "^(?<key>\d+\.\d+)"
  Write-Host "Setting the TEST_TARGET_FRAMEWORK environment variable to $($targetFrameworkVersionMapping[$Matches.key])"
  [Environment]::SetEnvironmentVariable('TEST_TARGET_FRAMEWORK', $($targetFrameworkVersionMapping[$Matches.key]))

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

  Write-Host "Removing temprary global.json file."
  Remove-Item ./global.json
}

Set-Location ../..