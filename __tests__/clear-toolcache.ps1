Write-Host $args[0]

$os = $args[0]

$linuxDotnetPaths = @("/usr/share/dotnet", "$env:HOME/.dotnet")
$macOSDotnetPaths = @("$env:HOME/.dotnet")
$windowsDotnetPaths = @("$env:LocalAppData\Microsoft\dotnet/*",
                        "$env:ProgramFiles\dotnet/*",
                        "$env:HOME\.dotnet")

$pathsToClear = @()

if ($os -eq "Linux") {
    $pathsToClear = $linuxDotnetPaths
} elseif ($os -eq "macOS") {
    $pathsToClear = $macOSDotnetPaths
} elseif ($os -eq "Windows") {
    Write-Host $env:LocalAppData
    $pathsToClear = $windowsDotnetPaths
}

foreach ($path in $pathsToClear) {
    if (Test-Path $path) {
        Write-Host "Clear $path path"
        Remove-Item $path -Recurse -Force
    }
}

dotnet --info