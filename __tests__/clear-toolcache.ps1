$dotnetPaths = @{
    Linux = "/usr/share/dotnet"
    macOS = "$env:HOME/.dotnet"
    Windows = "$env:ProgramFiles\dotnet", "$env:LocalAppData\Microsoft\dotnet"
}

foreach ($srcPath in $dotnetPaths[$args[0]]) {
    if (Test-Path $srcPath) {
        Write-Host "Move $srcPath path"
        $dstPath = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName())
        Move-Item -Path $srcPath -Destination $dstPath
    }
}