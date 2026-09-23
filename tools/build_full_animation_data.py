import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "catalog.js"
OUTPUT = ROOT / "data" / "full-animation-data.json"

def load_catalog_names():
    raw = CATALOG.read_text(encoding="utf-8").strip()
    prefix = "window.SF_CATALOG="
    if not raw.startswith(prefix):
        raise RuntimeError("Formato de data/catalog.js não reconhecido.")
    data = json.loads(raw[len(prefix):].rstrip(";"))
    return [item["name"] for item in data["symbols"]]

def compact_symbol(item):
    effects = item.get("effects") or {}
    preferences = item.get("preferences") or {}
    result = {
        "preferences": {
            key: value for key, value in preferences.items()
            if key in {
                "wiggleDirection", "customWiggleAngleRaw",
                "rotationDirection", "rotationAnchorPoints",
                "variableColorOrder", "defaultVariableRendering"
            }
        },
        "effects": {}
    }

    for name in ("bounce", "pulse", "wiggle", "rotate", "breathe", "draw", "replace"):
        source = effects.get(name)
        if isinstance(source, dict):
            result["effects"][name] = {
                key: value for key, value in source.items()
                if key in {
                    "recipe", "translationRecipe", "rotationRecipe",
                    "preferredDirection", "customAngleRaw",
                    "annotatedLayerTargets", "anchorPoints",
                    "tieCount", "attachmentCount"
                }
            }

    layers = []
    for layer in item.get("layers") or []:
        compact = {
            key: layer[key] for key in (
                "path", "type", "components", "animateTogether",
                "canPulse", "canRotate", "motionGroup", "autovariable"
            ) if key in layer
        }
        if compact:
            layers.append(compact)
    if layers:
        result["layers"] = layers
    return result

def main():
    if len(sys.argv) != 2:
        raise SystemExit("Uso: py tools/build_full_animation_data.py <sf_symbols_27_animation_manifest.json>")

    source = Path(sys.argv[1]).expanduser().resolve()
    if not source.exists():
        raise SystemExit(f"Manifest não encontrado: {source}")

    manifest = json.loads(source.read_text(encoding="utf-8"))
    symbol_source = manifest.get("symbols")
    if not isinstance(symbol_source, dict):
        raise RuntimeError("Manifest inválido: chave 'symbols' ausente.")

    names = load_catalog_names()
    missing = [name for name in names if name not in symbol_source]
    if missing:
        raise RuntimeError(f"{len(missing)} símbolos do catálogo não estão no manifest. Primeiro: {missing[0]}")

    compact = {
        "schema": "sf-symbols-27-browser-animation-data/v1",
        "sourceSchema": manifest.get("schema"),
        "catalogCount": len(names),
        "generic": manifest.get("generic", {}),
        "symbols": {name: compact_symbol(symbol_source[name]) for name in names}
    }

    OUTPUT.write_text(
        json.dumps(compact, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8"
    )
    print(f"OK: {len(names)} símbolos integrados")
    print(f"Arquivo: {OUTPUT}")
    print(f"Tamanho: {OUTPUT.stat().st_size:,} bytes")

if __name__ == "__main__":
    main()
