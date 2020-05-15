if (!$args[0])
{
  throw "Must supply dotnet version argument"
}

$dotnet = Get-Command dotnet | Select-Object -First 1 | ForEach-Object { $_.Path }
Write-Host "Found '$dotnet'"

$version = & $dotnet --version | Out-String | ForEach-Object { $_.Trim() }
Write-Host "Version $version"
# if ($version -ne $args[0])
# {
#   Write-Host "PATH='$env:path'"
#   Write-Host "gcm dotnet:"
#   gcm dotnet | fl
#   throw "Unexpected version"
# }

Write-Host "Building sample csproj"
& $dotnet build __tests__/sample-csproj/ --no-cache
if ($LASTEXITCODE -ne 0)
{
  throw "Unexpected exit code $LASTEXITCODE"
}

Write-Host "Testing compiled app"
$sample_output = "$(__tests__/sample-csproj/bin/Debug/netcoreapp3.0/sample.exe)".Trim()
Write-Host "Sample output: $sample_output"
if ($sample_output -notlike "*Hello*World*")
{
  throw "Unexpected output"
}
