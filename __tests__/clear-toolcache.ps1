Write-Host $args[0]

$os = $args[0]

$linuxDotnetPaths = @("/usr/share/dotnet")
$macOSDotnetPaths = @("/Users/runner/.dotnet")
$windowsDotnetPaths = @("$env:LocalAppData\Microsoft\dotnet/*", "$env:ProgramFiles\dotnet/*")

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
        Write-Host "Clear $path"
        Remove-Item $path -Recurse -Force
    }
}

dotnet --info