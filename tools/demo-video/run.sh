#!/usr/bin/env bash
# Grava o tour em vídeo. Requer node, ffmpeg e o pacote playwright com Chromium.
# Uso: tools/demo-video/run.sh [01 05 ...]   (sem argumentos grava todos os capítulos)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
{ echo '$ node tests/all.mjs'; node "$ROOT/tests/all.mjs"; echo; echo '$ node tests/display-contrast.mjs'; node "$ROOT/tests/display-contrast.mjs"; } > "$HERE/demo/tests.txt" 2>&1 || true
cp "$ROOT/assets/fonts/pixelify-sans.woff" "$HERE/demo/"
node "$HERE/server.cjs" "$ROOT" "$HERE/demo" 8080 & SERVER=$!; trap 'kill $SERVER' EXIT; sleep 0.5
mkdir -p "$HERE/out"; node "$HERE/record.cjs" "$@"; python3 "$HERE/build.py"
