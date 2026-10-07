#!/usr/bin/env bash
# Rasterise a PDF to JPEG pages and rebuild it.
#
# Ghostscript downsampling fails on PDFs whose images carry soft masks — it
# leaves them at full resolution and the file barely shrinks. Rasterising is
# blunt but predictable: it trades text selection for a file that actually
# deploys. These are visual portfolios, so that is the right trade.
#   flatten_pdf.sh <in.pdf> <out.pdf> [dpi] [quality]
set -euo pipefail
IN="$1"; OUT="$2"; DPI="${3:-120}"; Q="${4:-72}"
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
pdftoppm -jpeg -r "$DPI" -jpegopt "quality=$Q,optimize=y,progressive=y" "$IN" "$WORK/p"
img2pdf --output "$OUT" $(ls "$WORK"/p-*.jpg | sort -V)
printf '  %-26s %7s → %7s  (%s pages @ %s dpi)\n' "$(basename "$OUT")" \
  "$(du -h "$IN" | cut -f1)" "$(du -h "$OUT" | cut -f1)" \
  "$(pdfinfo "$OUT" | awk '/^Pages/{print $2}')" "$DPI"
