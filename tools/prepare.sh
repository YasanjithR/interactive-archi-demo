#!/usr/bin/env bash
# Asset pipeline. Intermediates live in /tmp so nothing untracked lands in the repo.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
WORK=/tmp/stemwork; mkdir -p "$WORK"
OUT="$HERE/content/panel-01/stems"

case "${1:-placeholder}" in
  placeholder)
    python3 "$HERE/tools/make_stems.py" "$WORK" ;;
  real)
    # 1. separate:  python -m demucs -n htdemucs_ft track.wav
    # 2. drop the four wavs into $WORK, then run this
    echo "using existing wavs in $WORK" ;;
  *) echo "usage: prepare.sh [placeholder|real]"; exit 1 ;;
esac

for f in "$WORK"/*.wav; do
  n=$(basename "$f" .wav)
  # measure loudness — use this to set "trim" in panel.json
  echo "--- $n"
  ffmpeg -v error -i "$f" -af ebur128=peak=true -f null - 2>&1 | tail -6 | sed 's/^/    /' || true
  ffmpeg -v error -y -i "$f" -ac 1 -ar 48000 -c:a libmp3lame -b:a 96k "$OUT/$n.mp3"
done
python3 "$HERE/tools/make_images.py" "$HERE/content/panel-01/images"
echo "assets written to content/panel-01/"
