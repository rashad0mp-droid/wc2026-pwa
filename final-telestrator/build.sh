#!/bin/sh
# One-command build: voice → reading check → picture → mix → subtitles → master.
# Needs the Lemo-Opuscar library set up (core + voice) with the freepats / vsco2ce / vcsl sample packs.
set -e
LIB=/root/lemo-opuscar
HERE=$(cd "$(dirname "$0")" && pwd); export LIB
PY="$LIB/.venv/bin/python"
[ -f "$HERE/audio/vo/v1.wav" ] || "$PY" "$LIB/core/tts/tts.py" "$HERE/audio/lines.json" "$HERE/audio/vo"
cd "$LIB"
node core/render/readcheck.mjs "$HERE" --step 0.05
node core/render/video.mjs "$HERE" --fps 30 --workers ${WORKERS:-4} --out "$HERE/out/video.mp4"
"$PY" "$HERE/tools/mix.py"
"$PY" core/render/srt.py "$HERE/audio/cues.json" "$HERE/subtitles_en.srt"
if sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/final-telestrator.mp4" 30 2; then :; else
  # fallback for ffmpeg 6 (the same two-pass loudnorm, limiter and grain as mux.sh); check the result's length and loudness
  cd "$HERE/out"
  M=$(ffmpeg -hide_banner -nostats -i mix.wav -af loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
  g(){ echo "$M" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
  LN="loudnorm=I=-14:TP=-1.2:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=192000,alimiter=limit=0.8318:attack=10:release=200:level=disabled:latency=1,aresample=48000"
  ffmpeg -y -hide_banner -loglevel error -i video.mp4 -i mix.wav -map 0:v -map 1:a -vf "noise=alls=2:allf=t" -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -r 30 -af "$LN" -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart "$HERE/final-telestrator.mp4"
fi
echo "done: $HERE/final-telestrator.mp4"
