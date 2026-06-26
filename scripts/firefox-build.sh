#!/usr/bin/env bash
# Build a Firefox-loadable copy of the extension.
#
# Firefox's "Load Temporary Add-on" always reads the file named manifest.json
# in the selected directory — it ignores manifest.firefox.json. So we stage a
# copy where the MV2 manifest IS manifest.json, leaving the repo's Chromium
# manifest.json untouched for Chrome/Edge/Brave.
#
# Usage:  ./scripts/firefox-build.sh
# Then in Firefox: about:debugging -> This Firefox -> Load Temporary Add-on
#                  -> select dist/firefox/manifest.json
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="dist/firefox"

rm -rf "$OUT"
mkdir -p "$OUT"

# Copy everything the extension needs at runtime.
for d in lib content background popup assets; do
  [ -e "$d" ] && cp -R "$d" "$OUT/"
done

# The MV2 manifest becomes the canonical manifest.json in the Firefox build.
cp manifest.firefox.json "$OUT/manifest.json"

echo "Firefox build ready: $OUT/manifest.json"
echo "Load it via about:debugging -> This Firefox -> Load Temporary Add-on."
