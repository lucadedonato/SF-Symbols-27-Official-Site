$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$port = 8000
$url = "http://localhost:$port"

$fullAnimationData = Join-Path $root "data\full-animation-data.json"
$prepare = Join-Path $root "prepare-full-animation-data.ps1"
if (-not (Test-Path $fullAnimationData) -and (Test-Path $prepare)) {
    $originalManifest = Join-Path $env:USERPROFILE "Downloads\SF-Symbols-27-Final\data\raw\recovered\sf_symbols_27_animation_manifest.json"
    if (Test-Path $originalManifest) {
        & $prepare
    }
}

Start-Process $url

if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3.14 -m http.server $port --directory $root
}
elseif (Get-Command python -ErrorAction SilentlyContinue) {
    & python -m http.server $port --directory $root
}
else {
    throw "Python nao encontrado."
}
