#!/usr/bin/env bash
# UAT status rollup for well-dipper.
# Queries docs/FEATURES.md for rows in `verified-pending-max` and
# `shipped-code` status; outputs a digest for batch UAT sessions.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
FEATURES="${REPO_ROOT}/docs/FEATURES.md"

if [ ! -f "$FEATURES" ]; then
  echo "error: $FEATURES not found." >&2
  echo "(FEATURES.md is authored in Phase 5 of v5 migration.)" >&2
  exit 1
fi

DATE=$(date +%Y-%m-%d)
echo "=== UAT Status — Well Dipper — $DATE ==="
echo ""

# FEATURES.md format expected:
# | Feature | Tier | Status | Blocks | Blocked by | Deep dive |
# | ... | ... | verified-pending-max | ... | ... | ... |
# Parse table rows where Status column contains the target value.

echo "WAITING ON MAX UAT (verified-pending-max):"
awk -F'|' '
  /^\|/ && $4 ~ /verified-pending-max/ {
    feature = $2; gsub(/^[ \t]+|[ \t]+$/, "", feature)
    status  = $4; gsub(/^[ \t]+|[ \t]+$/, "", status)
    deep    = $7; gsub(/^[ \t]+|[ \t]+$/, "", deep)
    print "  - " feature " | " deep
  }
' "$FEATURES" || true

echo ""
echo "SHIPPED-CODE PENDING CONFIRMATION (shipped-code):"
awk -F'|' '
  /^\|/ && $4 ~ /shipped-code/ {
    feature = $2; gsub(/^[ \t]+|[ \t]+$/, "", feature)
    deep    = $7; gsub(/^[ \t]+|[ \t]+$/, "", deep)
    print "  - " feature " | " deep
  }
' "$FEATURES" || true

echo ""
echo "(For full details, read docs/FEATURES.md or follow Deep dive links.)"
