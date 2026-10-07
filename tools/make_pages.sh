#!/usr/bin/env bash
# Render a PDF to page images for the in-app reader.
#
# The browser's own PDF viewer cannot be relied on: Chrome has a setting that
# downloads PDFs instead of opening them, and iOS Safari often refuses to
# render one inside an iframe. Shipping page images means the reader always
# works; the PDF stays available as a download.
#   make_pages.sh <in.pdf> <out-dir> <slug> [dpi] [quality]
set -euo pipefail
IN="$1"; OUT="$2"; SLUG="$3"; DPI="${4:-100}"; Q="${5:-72}"
mkdir -p "$OUT/$SLUG"
pdftoppm -jpeg -r "$DPI" -jpegopt "quality=$Q,optimize=y,progressive=y" "$IN" "$OUT/$SLUG/p"
python3 -I - "$OUT/$SLUG" "$SLUG" <<'PY'
import sys, os, glob, json
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
d, slug = sys.argv[1], sys.argv[2]
pages = []
for i, f in enumerate(sorted(glob.glob(f"{d}/p-*.jpg")), 1):
    new = f"{d}/{i:03d}.jpg"
    os.rename(f, new)
    with Image.open(new) as im: w, h = im.size
    pages.append({"src": f"pages/{slug}/{i:03d}.jpg", "w": w, "h": h})
json.dump(pages, open(f"{d}/_pages.json", "w"))
tot = sum(os.path.getsize(f"{d}/{p['src'].split('/')[-1]}") for p in pages)
print(f"  {slug:24s} {len(pages):3d} pages  {pages[0]['w']}x{pages[0]['h']}  {tot/1048576:.1f} MB")
PY
