#!/usr/bin/env bash
# Bootstrap / refresh the Unannotated inventory section of
# docs/MOOD/README.md from /mnt/c/Users/Max/Pictures/well-dipper/.
#
# Idempotent — only touches content between AUTO-INVENTORY markers.
# Manual annotations (in the Annotated section above the markers) are
# preserved across runs.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
INDEX="${REPO_ROOT}/docs/MOOD/README.md"
PICTURES="/mnt/c/Users/Max/Pictures/well-dipper"

START_MARKER="<!-- AUTO-INVENTORY-START -->"
END_MARKER="<!-- AUTO-INVENTORY-END -->"

if [ ! -d "$PICTURES" ]; then
  echo "error: Pictures folder not found at $PICTURES" >&2
  exit 1
fi

if [ ! -f "$INDEX" ]; then
  echo "error: $INDEX not found. Create it first (Phase 4 of v5 migration)." >&2
  exit 1
fi

if ! grep -q "$START_MARKER" "$INDEX" || ! grep -q "$END_MARKER" "$INDEX"; then
  echo "error: AUTO-INVENTORY markers not found in $INDEX" >&2
  echo "expected:" >&2
  echo "  $START_MARKER" >&2
  echo "  ..." >&2
  echo "  $END_MARKER" >&2
  exit 1
fi

# Build the new auto-inventory section
TMP=$(mktemp)
trap "rm -f $TMP" EXIT

echo "$START_MARKER" > "$TMP"

# Subfolders first
for subfolder in "$PICTURES"/*/; do
  if [ -d "$subfolder" ]; then
    name=$(basename "$subfolder")
    count=$(find "$subfolder" -maxdepth 1 -type f | wc -l | tr -d ' ')
    echo "" >> "$TMP"
    echo "**Subfolder: \`$name/\`** — $count files" >> "$TMP"
  fi
done

# Root-level files
echo "" >> "$TMP"
echo "**Root-level files:**" >> "$TMP"
echo "" >> "$TMP"

# List files at top level only (not in subfolders), sorted by name
# Format: - `filename` (added YYYY-MM-DD from mtime)
find "$PICTURES" -maxdepth 1 -type f | sort | while read -r f; do
  fname=$(basename "$f")
  mtime=$(date -r "$f" +%Y-%m-%d 2>/dev/null || stat -c %y "$f" 2>/dev/null | cut -d' ' -f1)
  echo "- \`$fname\` (added $mtime)" >> "$TMP"
done

echo "" >> "$TMP"
echo "$END_MARKER" >> "$TMP"

# Splice: keep everything before START_MARKER + new content + everything after END_MARKER
NEW_INDEX=$(mktemp)
trap "rm -f $TMP $NEW_INDEX" EXIT

# Print up to (but not including) the start marker line
sed -n "1,/^$START_MARKER\$/p" "$INDEX" | sed '$d' > "$NEW_INDEX"
# Append the new section
cat "$TMP" >> "$NEW_INDEX"
# Append everything after the end marker line
sed -n "/^$END_MARKER\$/,\$p" "$INDEX" | sed '1d' >> "$NEW_INDEX"

# Atomic replace
mv "$NEW_INDEX" "$INDEX"

ROOT_COUNT=$(find "$PICTURES" -maxdepth 1 -type f | wc -l | tr -d ' ')
TOTAL_COUNT=$(find "$PICTURES" -type f | wc -l | tr -d ' ')
echo "MOOD index refreshed:"
echo "  root-level files: $ROOT_COUNT"
echo "  total files (incl. subfolders): $TOTAL_COUNT"
echo "  index: $INDEX"
