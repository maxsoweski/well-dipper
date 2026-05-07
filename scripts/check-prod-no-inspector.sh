#\!/bin/bash
# Phase 3 Drift Risk #4 guard: verify the SceneInspector / Lab-mode inspector
# strings DO NOT leak into the production bundle. The inspector is wrapped in
# `if (import.meta.env.DEV)` so vite should DCE it; a misconfigured export or
# stray reference would let it ship to prod (~7-10kB + a debug surface that
# users could reach from console).
#
# Usage: scripts/check-prod-no-inspector.sh
# Exits 0 on PASS, 1 on FAIL.
set -e

cd "$(dirname "$0")/.."
DIST_DIR="dist/assets"

if [ \! -d "$DIST_DIR" ]; then
  echo "ERROR: $DIST_DIR does not exist. Run 'npm run build' first."
  exit 1
fi

# Strings that are unique to the inspector. If any appear in the prod bundle,
# the DCE failed.
NEEDLES=(
  "__wd-inspector-panel"
  "__wd Scene Inspector"
  "[__wd.saveGolden]"
  "installSceneInspector"
)

FAIL=0
for needle in "${NEEDLES[@]}"; do
  if grep -F -l "$needle" "$DIST_DIR"/*.js 2>/dev/null; then
    echo "FAIL: '$needle' leaked into production bundle"
    FAIL=1
  fi
done

if [ $FAIL -eq 0 ]; then
  echo "PASS: no inspector strings in production bundle ($DIST_DIR/*.js)"
fi
exit $FAIL
