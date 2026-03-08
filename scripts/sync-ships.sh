#!/bin/bash

# Syncs .glb ship exports from Blender export folder into well-dipper assets,
# then regenerates the ship manifest.
#
# Usage: ./scripts/sync-ships.sh
#    or: npm run sync-ships

SRC="/mnt/c/Users/Max/Documents/Blender/ship_exports"
DST="$(dirname "$0")/../public/assets/ships"

if [ ! -d "$SRC" ]; then
  echo "Source not found: $SRC"
  echo "Make sure Blender exports go to: C:\\Users\\Max\\Documents\\Blender\\ship_exports\\"
  exit 1
fi

echo "Syncing ships from Blender exports..."
rsync -av --include='*/' --include='*.glb' --exclude='*' "$SRC/" "$DST/"

echo ""
echo "Regenerating manifest..."
node "$(dirname "$0")/generate-ship-manifest.js"
