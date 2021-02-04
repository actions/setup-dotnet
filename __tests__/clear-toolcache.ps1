$dotnetPaths = @{
    Linux = @("/usr/share/dotnet")
    macOS = @("$env:HOME/.dotnet")
    Windows = @("$env:ProgramFiles\dotnet/*",
                  "$env:LocalAppData\Microsoft\dotnet/*")
}

foreach ($path in $dotnetPaths[$args[0]]) {
    if (Test-Path $path) {
        Write-Host "Clear $path path"
        Remove-Item $path -Recurse -Force
    }
}