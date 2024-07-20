$dotnetPaths = @{
    Linux = "/usr/share/dotnet"
    macOS = "$env:HOME/.dotnet"
    Windows = "$env:ProgramFiles\dotnet", "$env:LocalAppData\Microsoft\dotnet"
}

foreach ($srcPath in $dotnetPaths[$args[0]]) {
    if (Test-Path $srcPath) {
        $dstPath = "$srcPath-" + [IO.Path]::GetRandomFileName()
        Write-Host "Moving $srcPath to $dstPath"
        Move-Item -Path $srcPath -Destination $dstPath
    }
}