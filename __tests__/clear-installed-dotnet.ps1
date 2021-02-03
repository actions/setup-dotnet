$os = $args[0]

$linuxDotnetPaths = @("/usr/share/dotnet", "$env:HOME/.dotnet")
$macOSDotnetPaths = @("$env:HOME/.dotnet")
$windowsDotnetPaths = @("$env:HOME\.dotnet",
                        "$env:ProgramFiles\dotnet/*",
                        "$env:LocalAppData\Microsoft\dotnet/*")

$pathsToClear = @()

if ($os -eq "Linux") {
    $pathsToClear = $linuxDotnetPaths
} elseif ($os -eq "macOS") {
    $pathsToClear = $macOSDotnetPaths
} elseif ($os -eq "Windows") {
    $pathsToClear = $windowsDotnetPaths
}

foreach ($path in $pathsToClear) {
    if (Test-Path $path) {
        Write-Host "Clear $path path"
        Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}
