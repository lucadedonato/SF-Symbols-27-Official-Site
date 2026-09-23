$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

$candidates = @(
    (Join-Path $env:USERPROFILE "Downloads\SF-Symbols-27-Final\data\raw\recovered\sf_symbols_27_animation_manifest.json"),
    (Join-Path $env:USERPROFILE "Downloads\SF-Symbols-27-Final\app\data\sf_symbols_27_animation_manifest.json"),
    (Join-Path $root "data\sf_symbols_27_animation_manifest.json")
)

$manifest = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $manifest) {
    throw "Manifest original nao encontrado em SF-Symbols-27-Final\data\raw\recovered."
}

if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3.14 (Join-Path $root "tools\build_full_animation_data.py") $manifest
}
elseif (Get-Command python -ErrorAction SilentlyContinue) {
    & python (Join-Path $root "tools\build_full_animation_data.py") $manifest
}
else {
    throw "Python nao encontrado."
}

if ($LASTEXITCODE -ne 0) {
    throw "Falha ao preparar os dados completos de animacao."
}

Write-Host ""
Write-Host "Dados completos do manifest oficial recuperado foram integrados ao site."
