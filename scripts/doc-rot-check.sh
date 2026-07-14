#!/usr/bin/env bash
# doc-rot-check.sh — rot detection for well-dipper docs.
#
# Modes:
#   npm run doc-rot                          # project-wide (default; pre-push hook)
#   npm run doc-rot -- --workstream <slug>   # scoped (Tester usage)
#
# Exit codes:
#   0 — clean (or only warnings)
#   1 — rot found AND WELL_DIPPER_DOC_ROT_BLOCK=true
# Pre-push hook treats exit 1 as block-push; default behavior is exit 0
# regardless of findings (warn-only).
#
# Writes report to ~/briefings/well-dipper-doc-rot-<sha>.md.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ---- Parse args ----
WORKSTREAM_SLUG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --workstream)
      WORKSTREAM_SLUG="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# ---- Config (env var overrides) ----
STALE_DAYS="${WELL_DIPPER_DOC_ROT_STALE_DAYS:-30}"
STUCK_DAYS="${WELL_DIPPER_DOC_ROT_STUCK_DAYS:-14}"
CONFIRM_DAYS="${WELL_DIPPER_DOC_ROT_CONFIRM_DAYS:-7}"

# ---- Output setup ----
BRIEFINGS_DIR="${HOME}/briefings"
mkdir -p "$BRIEFINGS_DIR"
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "no-commit")
SCOPE_TAG=""
if [ -n "$WORKSTREAM_SLUG" ]; then
  SCOPE_TAG="-workstream-${WORKSTREAM_SLUG}"
fi
REPORT="${BRIEFINGS_DIR}/well-dipper-doc-rot-${SHA}${SCOPE_TAG}.md"
> "$REPORT"

# Track flagged count for exit code
FLAGGED=0

# ---- Helpers ----

flag() {
  local check="$1"
  local msg="$2"
  echo "  ❌ [$check] $msg" >> "$REPORT"
  FLAGGED=$((FLAGGED + 1))
}

warn() {
  local check="$1"
  local msg="$2"
  echo "  ⚠️  [$check] $msg" >> "$REPORT"
}

section() {
  echo "" >> "$REPORT"
  echo "## $1" >> "$REPORT"
  echo "" >> "$REPORT"
}

# ---- Resolve --workstream scope (if specified) ----
# Outputs: SCOPE_PATHS (file globs), SCOPE_FEATURES (slugs), SCOPE_SYSTEMS (slugs)
# All empty if no --workstream.

SCOPE_PATHS=""
SCOPE_FEATURES=""
SCOPE_SYSTEMS=""

if [ -n "$WORKSTREAM_SLUG" ]; then
  WS_FILE="docs/WORKSTREAMS/${WORKSTREAM_SLUG}.md"
  WS_CONTRACT="docs/WORKSTREAMS/${WORKSTREAM_SLUG}/contract.json"
  if [ ! -f "$WS_FILE" ] && [ -f "$WS_CONTRACT" ]; then
    # Directory-format workstream (dev-collab contract, post-2026-06-06 migration):
    # read optional top-level "scope": {"paths": [...], "features": [...], "systems": [...]}
    PYOUT=$(python3 - "$WS_CONTRACT" <<'PY'
import sys, json
c = json.load(open(sys.argv[1]))
scope = c.get('scope', {}) or {}
print("PATHS=" + ' '.join(scope.get('paths', [])))
print("FEATURES=" + ' '.join(scope.get('features', [])))
print("SYSTEMS=" + ' '.join(scope.get('systems', [])))
PY
    )
    SCOPE_PATHS=$(echo "$PYOUT" | grep '^PATHS=' | sed 's/^PATHS=//')
    SCOPE_FEATURES=$(echo "$PYOUT" | grep '^FEATURES=' | sed 's/^FEATURES=//')
    SCOPE_SYSTEMS=$(echo "$PYOUT" | grep '^SYSTEMS=' | sed 's/^SYSTEMS=//')
    if [ -z "$SCOPE_PATHS$SCOPE_FEATURES$SCOPE_SYSTEMS" ]; then
      echo "error: directory-format workstream has no top-level \"scope\" in contract.json — add {\"scope\":{\"paths\":[...]}} for scoped doc-rot" >&2
      exit 2
    fi
    WS_FILE=""   # skip the legacy frontmatter parse below
  elif [ ! -f "$WS_FILE" ]; then
    echo "error: workstream not found: $WS_FILE (flat) or $WS_CONTRACT (directory format)" >&2
    exit 2
  fi
  # Parse YAML frontmatter via python3 (assumed available) — legacy flat format only
  if [ -n "$WS_FILE" ]; then
    PYOUT=$(python3 - "$WS_FILE" <<'PY'
import sys, re, yaml
path = sys.argv[1]
text = open(path).read()
m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
if not m:
    print("PATHS=")
    print("FEATURES=")
    print("SYSTEMS=")
    sys.exit(0)
data = yaml.safe_load(m.group(1)) or {}
scope = data.get('Scope', {})
paths = ' '.join(scope.get('paths', []))
features = ' '.join(scope.get('features', []))
systems = ' '.join(scope.get('systems', []))
print(f"PATHS={paths}")
print(f"FEATURES={features}")
print(f"SYSTEMS={systems}")
PY
    )
    SCOPE_PATHS=$(echo "$PYOUT" | grep '^PATHS=' | sed 's/^PATHS=//')
    SCOPE_FEATURES=$(echo "$PYOUT" | grep '^FEATURES=' | sed 's/^FEATURES=//')
    SCOPE_SYSTEMS=$(echo "$PYOUT" | grep '^SYSTEMS=' | sed 's/^SYSTEMS=//')
  fi
fi

# Helper: returns 0 if scope is empty (no filter) OR file matches scope
in_scope() {
  local file="$1"
  if [ -z "$WORKSTREAM_SLUG" ]; then return 0; fi

  # Direct path match
  for p in $SCOPE_PATHS; do
    if [[ "$file" == $p ]] || [[ "$file" == "$p" ]]; then return 0; fi
  done

  # FEATURES/<feature>.md match
  for f in $SCOPE_FEATURES; do
    if [[ "$file" == "docs/FEATURES/${f}.md" ]]; then return 0; fi
  done

  # SYSTEMS/<system>/* match
  for s in $SCOPE_SYSTEMS; do
    if [[ "$file" == docs/SYSTEMS/${s}/* ]]; then return 0; fi
  done

  return 1
}

# ---- Report header ----
{
  echo "# Doc rot report — well-dipper"
  echo ""
  echo "**Run:** $(date)"
  echo "**Commit:** $SHA"
  echo "**Mode:** $([ -n "$WORKSTREAM_SLUG" ] && echo "scoped to workstream \`$WORKSTREAM_SLUG\`" || echo "project-wide")"
  if [ -n "$WORKSTREAM_SLUG" ]; then
    echo "**Scope paths:** ${SCOPE_PATHS:-(none)}"
    echo "**Scope features:** ${SCOPE_FEATURES:-(none)}"
    echo "**Scope systems:** ${SCOPE_SYSTEMS:-(none)}"
  fi
} > "$REPORT"

# ---- Check 1: Unclaimed source files ----
section "Unclaimed source files"
if [ -d "docs/SYSTEMS" ]; then
  ALL_SRC=$(find src -name '*.js' -not -path '*/node_modules/*' 2>/dev/null | sort)
  # Collect all Module(s) entries (plain paths + scope-qualified base paths)
  CLAIMED=$(grep -hrE '^- `[^`]+`' docs/SYSTEMS/*/README.md 2>/dev/null \
    | sed -E 's/^- `([^`]+)`.*/\1/' \
    | sort -u || true)
  for src_file in $ALL_SRC; do
    if ! echo "$CLAIMED" | grep -qxF "$src_file"; then
      if in_scope "$src_file"; then
        flag "unclaimed-src" "$src_file (not in any SYSTEMS/<sys>/README.md Module(s))"
      fi
    fi
  done
else
  echo "  (skipped — docs/SYSTEMS/ not authored yet)" >> "$REPORT"
fi

# ---- Check 2: Broken doc references ----
section "Broken doc references"
# Find markdown links of form [text](relative/path.md) or [text](relative/path.md#anchor)
# Skip http(s), mailto, file://, and lines in code blocks.
python3 - <<'PY' >> "$REPORT" || true
import os, re, sys
repo = os.environ.get('PWD', '.')
flagged = 0
for root, dirs, files in os.walk(os.path.join(repo, 'docs')):
    # Skip ARCHIVE/ — broken links there are expected (refer to moved files)
    if '/ARCHIVE' in root: continue
    for fname in files:
        if not fname.endswith('.md'): continue
        path = os.path.join(root, fname)
        try:
            text = open(path, encoding='utf-8').read()
        except Exception:
            continue
        in_code = False
        for lineno, line in enumerate(text.split('\n'), 1):
            if line.strip().startswith('```'):
                in_code = not in_code
                continue
            if in_code: continue
            for m in re.finditer(r'\[[^\]]+\]\(([^)]+)\)', line):
                link = m.group(1).split('#')[0].strip()
                if not link: continue
                if link.startswith(('http://', 'https://', 'mailto:', 'file://', '/mnt/', '/home/', '~/')):
                    continue
                target = os.path.normpath(os.path.join(os.path.dirname(path), link))
                if not os.path.exists(target):
                    rel = os.path.relpath(path, repo)
                    print(f"  ❌ [broken-link] {rel}:{lineno} → {link}")
                    flagged += 1
print(f"  ({flagged} broken links)")
PY

# ---- Check 3: FEATURES.md status rot (stuck + confirmation lag) ----
section "FEATURES.md status rot"
if [ -f "docs/FEATURES.md" ]; then
  # Parse table rows; status column is column 4 (between | feature | tier | status |)
  # Status `in-flight` rot is per workstream Tester verdict age — skip detailed check
  # for now; project-level heuristic: count rows.
  IN_FLIGHT=$(awk -F'|' '/^\|/ && $4 ~ /in-flight/' docs/FEATURES.md | wc -l | tr -d ' ')
  SHIPPED_CODE=$(awk -F'|' '/^\|/ && $4 ~ /shipped-code/' docs/FEATURES.md | wc -l | tr -d ' ')
  echo "  in-flight rows: $IN_FLIGHT" >> "$REPORT"
  echo "  shipped-code rows (pending UAT): $SHIPPED_CODE" >> "$REPORT"
  # Per-row date check would require row-level dates — add column or use git log
  # (Future: when FEATURES.md adds a Last-status-change column, check per-row age)
else
  echo "  (skipped — docs/FEATURES.md not authored yet)" >> "$REPORT"
fi

# ---- Check 4: SYSTEMS.md row absence vs JOURNEY structural debt ----
section "System doc absence"
if [ -f "docs/SYSTEMS.md" ] && [ -f "docs/JOURNEY.md" ]; then
  # Find SYSTEMS.md rows marked "— no doc yet" or similar; check JOURNEY structural debt mentions them
  NO_DOC=$(grep -E '^\|[^|]+\|[^|]+\|[^|]+\|[^|]+\| —' docs/SYSTEMS.md 2>/dev/null | wc -l | tr -d ' ' || echo 0)
  echo "  systems without deep dives: $NO_DOC" >> "$REPORT"
  # (Full enforcement would parse each system slug and check JOURNEY structural-debt mentions)
else
  echo "  (skipped — SYSTEMS.md or JOURNEY.md missing)" >> "$REPORT"
fi

# ---- Check 5: Mood-promotion needed ----
section "Mood-promotion needed"
if [ -f "docs/MOOD/README.md" ]; then
  # Find image filenames cited from FEATURES/*.md or SYSTEMS/*/*.md
  # that still appear in MOOD/README.md AUTO-INVENTORY block
  CITED=$(grep -rhoE '`[^`]+\.(png|jpg|jpeg|webp|gif|mp4)`' docs/FEATURES docs/SYSTEMS 2>/dev/null \
    | sed 's/`//g' | sort -u || true)
  if [ -n "$CITED" ]; then
    # Get the AUTO-INVENTORY block content
    INVENTORY=$(awk '/<!-- AUTO-INVENTORY-START -->/,/<!-- AUTO-INVENTORY-END -->/' docs/MOOD/README.md)
    for img in $CITED; do
      if echo "$INVENTORY" | grep -qF "\`$img\`"; then
        flag "mood-promote" "$img cited but still in Unannotated block — promote to Annotated"
      fi
    done
  fi
else
  echo "  (skipped — docs/MOOD/README.md not authored yet)" >> "$REPORT"
fi

# ---- Check 6: SYSTEMS.md graph staleness ----
section "SYSTEMS.md graph staleness"
if [ -f "docs/SYSTEMS.md" ] && [ -x "scripts/doc-graph.js" ]; then
  # Snapshot current SYSTEMS.md; run doc-graph; diff; restore
  SNAPSHOT=$(mktemp)
  cp docs/SYSTEMS.md "$SNAPSHOT"
  if node scripts/doc-graph.js >/dev/null 2>&1; then
    if ! diff -q "$SNAPSHOT" docs/SYSTEMS.md >/dev/null 2>&1; then
      flag "graph-stale" "SYSTEMS.md auto-regions differ from fresh doc-graph output — run 'npm run doc-graph' and commit"
      # Restore original — doc-rot should not silently update docs
      mv "$SNAPSHOT" docs/SYSTEMS.md
    else
      rm -f "$SNAPSHOT"
    fi
  else
    warn "graph-check" "doc-graph errored; cannot verify staleness"
    mv "$SNAPSHOT" docs/SYSTEMS.md
  fi
else
  echo "  (skipped — SYSTEMS.md or doc-graph.js missing)" >> "$REPORT"
fi

# ---- Check 7: Orphan Systems-touched (per Gap M v5-audit fix) ----
section "Orphan Systems-touched"
if [ -f "docs/SYSTEMS.md" ] && [ -d "docs/FEATURES" ]; then
  # Get list of system slugs from SYSTEMS.md flat-map rows
  # (Format: | <system> | <purpose> | ... | first column)
  SYS_SLUGS=$(awk -F'|' '/^\| [a-z][-a-z0-9]+ +\|/ {print $2}' docs/SYSTEMS.md \
    | sed 's/^ *//;s/ *$//' | sort -u || true)
  for f in docs/FEATURES/*.md; do
    [ -f "$f" ] || continue
    # Extract Systems touched: line (parseable per Rule 14)
    # `|| true`: under `set -euo pipefail`, a no-match grep returns 1 and aborts the
    # whole script before later checks run (a FEATURES doc with no Systems-touched
    # line is legitimate). Empty TOUCHED is already handled by the [ -z ] guard below.
    TOUCHED=$(grep -E '^\*\*Systems touched:\*\*' "$f" | sed -E 's/^\*\*Systems touched:\*\* *//' | tr ',' '\n' | sed 's/^ *//;s/ *$//' || true)
    for slug in $TOUCHED; do
      [ -z "$slug" ] && continue
      if ! echo "$SYS_SLUGS" | grep -qxF "$slug"; then
        if in_scope "$f"; then
          flag "orphan-systems-touched" "$f references system '$slug' but no row exists in SYSTEMS.md"
        fi
      fi
    done
  done
else
  echo "  (skipped — SYSTEMS.md or docs/FEATURES/ missing)" >> "$REPORT"
fi

# ---- Check 8: Stale deep dives ----
section "Stale deep dives"
if [ -f "docs/FEATURES.md" ] && [ -d "docs/FEATURES" ]; then
  STALE_SEC=$((STALE_DAYS * 24 * 3600))
  NOW=$(date +%s)
  for f in docs/FEATURES/*.md; do
    [ -f "$f" ] || continue
    if ! in_scope "$f"; then continue; fi
    DOC_MTIME=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null || echo 0)
    AGE=$((NOW - DOC_MTIME))
    if [ "$AGE" -gt "$STALE_SEC" ]; then
      DAYS=$((AGE / 86400))
      flag "stale-deep-dive" "$f hasn't been touched in $DAYS days (threshold: $STALE_DAYS)"
    fi
  done
else
  echo "  (skipped — docs/FEATURES.md or docs/FEATURES/ missing)" >> "$REPORT"
fi

# ---- Check: feature-cards generated-file staleness ----
section "Feature-cards generated-file staleness"
if [ -f "planet-feature-cards.generated.js" ] && [ -f "scripts/gen-feature-cards.mjs" ]; then
  # Snapshot committed file; regen; diff; restore (never silently update).
  FC_SNAPSHOT=$(mktemp)
  cp planet-feature-cards.generated.js "$FC_SNAPSHOT"
  if node scripts/gen-feature-cards.mjs >/dev/null 2>&1; then
    if ! diff -q "$FC_SNAPSHOT" planet-feature-cards.generated.js >/dev/null 2>&1; then
      flag "feature-cards-stale" "planet-feature-cards.generated.js differs from fresh gen — run 'npm run gen-feature-cards' and commit"
      mv "$FC_SNAPSHOT" planet-feature-cards.generated.js   # restore committed version
    else
      rm -f "$FC_SNAPSHOT"
    fi
  else
    # exit non-zero from the generator here means a STRUCTURAL parse error (not a coverage warning)
    warn "feature-cards-check" "gen-feature-cards errored (structural parse?); cannot verify staleness"
    mv "$FC_SNAPSHOT" planet-feature-cards.generated.js
  fi
else
  echo "  (skipped — planet-feature-cards.generated.js or gen-feature-cards.mjs missing)" >> "$REPORT"
fi

# ---- Summary ----
{
  echo ""
  echo "---"
  echo ""
  echo "## Summary"
  echo ""
  echo "**Flagged:** $FLAGGED issue(s) requiring action."
  if [ "$FLAGGED" -gt 0 ]; then
    echo ""
    echo "Set \`WELL_DIPPER_DOC_ROT_BLOCK=true\` to hard-block pushes on rot."
  fi
} >> "$REPORT"

# ---- Exit ----
echo "doc-rot report: $REPORT"
echo "flagged: $FLAGGED"

if [ "$FLAGGED" -gt 0 ] && [ "${WELL_DIPPER_DOC_ROT_BLOCK:-}" = "true" ]; then
  exit 1
fi
exit 0
