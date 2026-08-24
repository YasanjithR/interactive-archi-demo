#!/usr/bin/env bash
# The demo must be served over http — fetch() of the manifest and stems is
# blocked on file://. No install, no network needed.
PORT="${1:-8080}"
cd "$(dirname "$0")"
echo "Resonance Field  →  http://localhost:$PORT"
echo "ctrl-c to stop"
python3 -m http.server "$PORT" --bind 127.0.0.1
