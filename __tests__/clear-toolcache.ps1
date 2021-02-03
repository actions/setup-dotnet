Write-Host $args[0]

$os = $args[0]

$linuxDotnetPaths = @("/usr/share/dotnet")
$macOSDotnetPaths = @("/Users/runner/.dotnet")
$windowsDotnetPaths = @("$env:LocalAppData\Microsoft\dotnet/*", "$env:ProgramFiles\dotnet/*")

$pathsToClear = @()

if ($os == "linux") {
    $pathsToClear = $linuxDotnetPaths
} elseif ($os == "macOS") {
    $pathsToClear = $macOSDotnetPaths
} elseif ($os == "windows") {
    $pathsToClear = $windowsDotnetPaths
}

foreach ($path in $pathsToClear) {
    if (Test-Path $path) {
        Write-Host "Clear $path"
        Remove-Item $path -Recurse -Force
    }
}

dotnet --info