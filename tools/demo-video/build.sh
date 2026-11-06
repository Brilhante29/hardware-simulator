#!/usr/bin/env bash
# Junta os clipes de out/, gera a trilha (synth.py) e grava docs/media/hardware-studio-tour.mp4.
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"; V="$D/out"; DEST="$D/../../docs/media/hardware-studio-tour.mp4"
ls "$V"/[0-9]-*.mp4 | sed "s#^#file '#;s#\$#'#" > "$V/list.txt"
python3 "$D/synth.py" "$V" "$V/audio.wav"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$V/list.txt" -i "$V/audio.wav" -map 0:v -map 1:a -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p \
  -af loudnorm=I=-15:TP=-1.5:LRA=7 -ar 44100 -c:a aac -b:a 192k -shortest -movflags +faststart "$DEST"
ls -la "$DEST"
