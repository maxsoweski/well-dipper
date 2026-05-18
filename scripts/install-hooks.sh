#!/usr/bin/env bash
# One-time installer for well-dipper git hooks.
# Run after first clone: bash scripts/install-hooks.sh
#
# Per Rule 8: enables the pre-push doc-rot check.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_SRC="${REPO_ROOT}/scripts/git-hooks/pre-push"
HOOK_DST="${REPO_ROOT}/.git/hooks/pre-push"

if [ ! -f "$HOOK_SRC" ]; then
  echo "error: $HOOK_SRC not found" >&2
  exit 1
fi

if [ -f "$HOOK_DST" ]; then
  if cmp -s "$HOOK_SRC" "$HOOK_DST"; then
    echo "pre-push hook already installed (identical contents); nothing to do"
    exit 0
  fi
  echo "warning: $HOOK_DST already exists and differs from $HOOK_SRC" >&2
  echo "  current contents:" >&2
  head -5 "$HOOK_DST" | sed 's/^/    /' >&2
  echo "  refusing to overwrite. Either:" >&2
  echo "    1. Remove existing hook: rm $HOOK_DST" >&2
  echo "    2. Manually merge contents" >&2
  echo "    3. Wrap existing hook in scripts/git-hooks/pre-push" >&2
  exit 1
fi

cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"
echo "installed: $HOOK_DST"
echo ""
echo "verify with: git push --dry-run"
