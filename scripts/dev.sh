#!/usr/bin/env bash
# scripts/dev.sh — start THIS checkout's Vite dev server on a fixed port.
#
# Usage:   scripts/dev.sh            → port 5175 (lane A's port in the lane table)
#          scripts/dev.sh 5173       → any other port
# Stop:    Ctrl+C in the terminal that is running it.
#
# The server serves the repo this script lives in, so the copy in ~/projects/well-dipper
# serves lane A (feature/world-engine-production-L1) and a copy in ~/projects/well-dipper-trunk
# would serve master. Give each its own port if two run at once.
#
# --strictPort: if the port is already taken, FAIL LOUDLY instead of silently moving to the
# next free one. A server that quietly lands on 5176 while Chrome is pointed at 5175 is how
# a stale build gets measured.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-5175}"
cd "$ROOT"
if [ ! -d node_modules ]; then
  echo "node_modules is missing in $ROOT — run 'npm install' there first." >&2
  exit 1
fi
echo "Serving  $ROOT"
echo "Branch   $(git -C "$ROOT" branch --show-current 2>/dev/null || echo '?')"
echo "Open     http://localhost:$PORT/well-dipper/     (Ctrl+C stops the server)"
exec npx vite --port "$PORT" --strictPort
