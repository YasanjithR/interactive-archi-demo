#!/usr/bin/env bash
# Encode one song's stems for the web.
#   encode_stems.sh <STEMS subdir> <content panel dir> <name=file>...
# Every stem is trimmed to the SHORTEST common length: the exports differ by a
# few hundred samples, which is inaudible once but drifts audibly over a loop.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$HERE/STEMS/$1"; OUT="$HERE/content/$2/stems"; shift 2
mkdir -p "$OUT"

shortest=""
for pair in "$@"; do
  f="$SRC/${pair##*=}"
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  if [ -z "$shortest" ] || (( $(echo "$d < $shortest" | bc -l) )); then shortest=$d; fi
done
# back off a hair so no file can be one sample short
dur=$(echo "$shortest - 0.02" | bc -l)
printf 'common length: %.3fs\n' "$dur"

for pair in "$@"; do
  name="${pair%%=*}"; f="$SRC/${pair##*=}"
  ffmpeg -v error -y -i "$f" -t "$dur" -ac 1 -ar 44100 -c:a libmp3lame -b:a 96k "$OUT/$name.mp3"
  printf '  %-12s %6s  %s\n' "$name" "$(du -h "$OUT/$name.mp3" | cut -f1)" \
    "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$name.mp3")"
done
