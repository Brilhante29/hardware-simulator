#!/usr/bin/env bash
# Grava o tour da plataforma (~3 min) em docs/media/hardware-studio-plataforma.mp4.
# Uso: tools/demo-video/run-platform.sh [prefixos de capítulo]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
{ for t in pcb editor all display-contrast; do echo "\$ node tests/$t.mjs"; node "$ROOT/tests/$t.mjs" | tail -4; echo; done; } > "$HERE/demo/tests.txt" 2>&1 || true
cp "$ROOT/assets/fonts/pixelify-sans.woff" "$HERE/demo/"
node "$HERE/server.cjs" "$ROOT" "$HERE/demo" 8080 & SERVER=$!; trap 'kill $SERVER' EXIT; sleep 0.5
node "$HERE/platform.cjs" "$@"
V="$HERE/out-platform"; ls "$V"/[0-9]*-*.mp4 | sort -V | sed "s#^#file '#;s#\$#'#" > "$V/list.txt"
python3 "$HERE/synth.py" "$V" "$V/audio.wav"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$V/list.txt" -i "$V/audio.wav" -map 0:v -map 1:a -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p \
  -af loudnorm=I=-15:TP=-1.5:LRA=7 -ar 44100 -c:a aac -b:a 192k -shortest -movflags +faststart "$ROOT/docs/media/hardware-studio-plataforma.mp4"
ls -la "$ROOT/docs/media/hardware-studio-plataforma.mp4"
