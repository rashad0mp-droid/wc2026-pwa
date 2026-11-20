#!/bin/sh
# One command: voice → reading check → picture → mix → subtitles → master (1080x1920, 30 fps, 45.0 s).
set -e
LIB=/root/lemo-opuscar
HERE=$(cd "$(dirname "$0")" && pwd); export LIB
PY="$LIB/.venv/bin/python"
[ -f "$HERE/audio/vo/v1.wav" ] || "$PY" "$LIB/core/tts/tts.py" "$HERE/audio/lines.json" "$HERE/audio/vo"
cd "$LIB"
node core/render/readcheck.mjs "$HERE" --step 0.05 --size 1080x1920 || true
node core/render/video.mjs "$HERE" --fps 30 --size 1080x1920 --workers ${WORKERS:-4} --out "$HERE/out/video.mp4"
"$PY" "$HERE/tools/mix.py"
"$PY" core/render/srt.py "$HERE/audio/cues.json" "$HERE/subtitles_en.srt"
OUT="$HERE/honesty-layer.mp4"
if ! sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$OUT" 30 1; then
  # ffmpeg 6 fallback: same two-pass loudnorm (-14 LUFS) + true-peak limiter + light grain
  cd "$HERE/out"
  M=$(ffmpeg -hide_banner -nostats -i mix.wav -af loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
  g(){ echo "$M" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
  LN="loudnorm=I=-14:TP=-1.2:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=192000,alimiter=limit=0.8318:attack=10:release=200:level=disabled:latency=1,aresample=48000"
  ffmpeg -y -hide_banner -loglevel error -i video.mp4 -i mix.wav -map 0:v -map 1:a -vf "noise=alls=1:allf=t" -c:v libx264 -profile:v high -crf 17 -preset slow -pix_fmt yuv420p -r 30 -af "$LN" -c:a aac -b:a 256k -ar 48000 -t 45 -movflags +faststart "$OUT"
fi
echo "done: $OUT"
