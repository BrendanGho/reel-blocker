#!/usr/bin/env bash
# Build a Chromium-loadable copy of the extension (Chrome, Edge, Brave, Opera).
#
# Chrome refuses to load an unpacked extension if the selected directory
# contains any file or folder whose name starts with "_" (e.g. __pycache__),
# and it also chokes on dev cruft like .venv/ and orchestrator.py. The repo
# root has all of that, so we stage a CLEAN directory containing only the files
# the extension needs at runtime, with the MV3 manifest as manifest.json.
#
# Usage:  ./scripts/chrome-build.sh
# Then in Chrome: chrome://extensions -> Developer mode -> Load unpacked
#                 -> select dist/chrome
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="dist/chrome"

rm -rf "$OUT"
mkdir -p "$OUT"

# Copy only the runtime directories. Nothing starting with "_" is included.
for d in lib content background popup assets; do
  [ -e "$d" ] && cp -R "$d" "$OUT/"
done

# The MV3 manifest is already named manifest.json — copy it as-is.
cp manifest.json "$OUT/manifest.json"

# Safety net: strip any stray underscore-prefixed or Python artifacts that may
# have been nested inside copied dirs, so Chrome never rejects the load.
find "$OUT" -depth \( -name '__pycache__' -o -name '_*' -o -name '*.pyc' \) -exec rm -rf {} + 2>/dev/null || true

echo "Chrome build ready: $OUT"
echo "Load it via chrome://extensions -> Developer mode -> Load unpacked -> select $OUT"
