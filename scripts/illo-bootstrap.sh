#!/usr/bin/env bash
# Bootstrap illo for cover generation (local or CI).
# - Ensures scripts/vendor/illo.py exists (vendored, or download pin)
# - Installs the Blip character pack into ~/.config/illo/characters/blip
# - Optionally seeds OpenRouter config when OPENROUTER_API_KEY is set
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_DIR="$ROOT/scripts/vendor"
ILLO_PY="${ILLO_PY:-$VENDOR_DIR/illo.py}"
# Pin: illo skill engine version we vendor against (see scripts/vendor/ILLO_VERSION)
ILLO_VERSION_FILE="$VENDOR_DIR/ILLO_VERSION"
CHARACTER="${ILLO_CHARACTER:-blip}"
PACKS_REPO="${ILLO_PACKS_REPO:-https://raw.githubusercontent.com/tmchow/illo-characters/main}"

mkdir -p "$VENDOR_DIR"

if [[ ! -f "$ILLO_PY" ]]; then
  echo "illo.py missing at $ILLO_PY — downloading from illo-skill…"
  # Fallback fetch if someone deleted the vendor file
  url="https://raw.githubusercontent.com/tmchow/illo-skill/main/skills/illo/scripts/illo.py"
  curl -fsSL "$url" -o "$ILLO_PY"
  chmod +x "$ILLO_PY"
fi

if [[ -f "$ILLO_VERSION_FILE" ]]; then
  echo "Using vendored illo engine ($(cat "$ILLO_VERSION_FILE"))"
else
  echo "Using illo engine at $ILLO_PY"
fi

echo "Installing character pack: $CHARACTER"
python3 "$ILLO_PY" packs install "$CHARACTER" --force --repo "$PACKS_REPO"

if [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
  echo "Seeding OpenRouter config from OPENROUTER_API_KEY (key not printed)"
  CFG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/illo"
  mkdir -p "$CFG_DIR"
  MODEL="${ILLO_MODEL:-x-ai/grok-imagine-image-quality}"
  cat > "$CFG_DIR/config.yaml" <<EOF
configVersion: 2
apiKey: ${OPENROUTER_API_KEY}
backend: openrouter
model: ${MODEL}
defaultCharacter: ${CHARACTER}
aspect: "16:9"
EOF
  chmod 600 "$CFG_DIR/config.yaml"
else
  echo "OPENROUTER_API_KEY not set — using existing illo config / local CLI backend"
fi

echo "Running illo doctor…"
python3 "$ILLO_PY" doctor || true

echo "Bootstrap complete."
