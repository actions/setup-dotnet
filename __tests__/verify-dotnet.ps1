if (!$args[0])
{
  throw "Must supply dotnet version argument"
}

if (-Not (Test-Path "../nuget.config"))
{
  throw "nuget file not generated correctly"
}

$dotnet = Get-Command dotnet | Select-Object -First 1 | ForEach-Object { $_.Path }
Write-Host "Found '$dotnet'"

$version = & $dotnet --version | Out-String | ForEach-Object { $_.Trim() }
Write-Host "Version $version"
if ($version -ne $args[0])
{
  Write-Host "PATH='$env:path'"
  throw "Unexpected version"
}

if ($args[1])
{
  # SDKs are listed on multiple lines with the path afterwards in square brackets
  $version = & $dotnet --list-sdks | ForEach-Object { $_.SubString(0, $_.IndexOf('[')).Trim() }
  Write-Host "Version $version"
  if (-not ($version -contains $args[1]))
  {
    Write-Host "PATH='$env:path'"
    throw "Unexpected version"
  }
}

Write-Host "Building sample csproj"
& $dotnet build __tests__/sample-csproj/ --no-cache
if ($LASTEXITCODE -ne 0)
{
  throw "Unexpected exit code $LASTEXITCODE"
}

Write-Host "Testing compiled app"
$sample_output = "$(dotnet test __tests__/sample-csproj/ --no-build)"
Write-Host "Sample output: $sample_output"
# For Side-by-Side installs we want to run the tests twice, for a single install the tests will run once
if ($args[1])
{
  if ($sample_output -notlike "*Test Run Successful.*Test Run Successful.*")
  {
    throw "Unexpected output"
  }
}
else
{
  if ($sample_output -notlike "*Test Run Successful.*")
  {
    throw "Unexpected output"
  }
}
