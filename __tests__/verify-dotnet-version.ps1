if (!$args[0])
{
  throw "Must supply dotnet version argument"
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