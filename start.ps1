$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$port = 8000
$url = "http://localhost:$port"

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
