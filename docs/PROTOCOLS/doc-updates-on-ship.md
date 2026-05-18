# Doc updates on ship — protocol mechanics

CLAUDE.md trigger statements reference this doc for detailed
mechanics. Read this when actually executing a rule, not at every
session start.

## §Rule 3 — Tester PASS-on-Shipped doc updates

**Trigger:** Before flipping a workstream Status to Shipped
(`shipped-code` or `shipped-confirmed`), working-Claude must update
specific docs. Tester checks these as part of PASS criterion.

### What updates under which conditions

**`FEATURES.md` row (ALWAYS):**
- Status field: `verified-pending-max` → `shipped-code`
- If Max GATE 3 then passes UAT: → `shipped-confirmed`
- If Blocks / Blocked by changed during workstream: update those
  fields

**`PLAYER_EXPERIENCE.md` (if shipped experience differs from spec):**
- If actual shipped experience matches the per-tier Target/Anti-experience
  as written: no update needed
- If actual shipped experience differs (e.g., the warp tunnel
  feels "punchy" rather than "gentle" because we tuned during
  implementation): UPDATE the relevant tier section to match what
  shipped — OR explicitly flag "spec aspirational; shipped reality
  diverges in <ways>"
- Detection: working-Claude reviews the relevant tier section against
  recording artifact + own observation; if mismatch, update before
  Shipped flip

**`SYSTEMS/<sys>/README.md` (if wiring / interface / major behavior changed):**
- If Module(s) line changed (file added/removed from system, scope
  qualifier changed, meta flag changed): UPDATE
- If Interface block changed (Triggers / Inputs / Outputs / State):
  UPDATE
- If Wiring block changed (Calls into / Called by / Reads / Writes):
  UPDATE (note: Calls/Called by auto-regenerate via `npm run doc-graph`;
  manual entries cover non-import dependencies like event subscriptions)
- If History block needs an entry (significant decision or terminology
  shift): UPDATE
- Detection: working-Claude reviews diff; any of these conditions =
  update needed

**`SYSTEMS/<sys>/changelog.md` (if approach was tried-and-abandoned):**
- If the workstream tried an approach that didn't work and abandoned it
  for a different approach: ADD changelog entry per template
- If the workstream is a straightforward successful implementation:
  no changelog entry needed
- Detection: explicit — working-Claude knows when "we tried X, it
  didn't work, switched to Y"

### How Tester runs the check

```bash
npm run doc-rot --workstream <slug>
```

This invokes the scoped-mode rot check (per v5 design). It:
1. Reads `WORKSTREAMS/<slug>.md` `Scope:` frontmatter
2. Computes downstream doc surface (features + systems + per-feature
   "Systems touched:" expansions)
3. Filters standard rot checks to flag only items in that surface
4. Outputs a report

**Doc-coverage check counts as FAIL if:**
- Any `Stale deep dives` flag for a feature in workstream scope
- Any `SYSTEMS.md graph staleness` flag (run `npm run doc-graph`
  if so)
- Any `Orphan Systems-touched` flag for a feature touched by the
  workstream
- (Other flags surface as warnings but don't auto-FAIL)

**Tester FAIL behavior:**
- Workstream Status stays at `verified-pending-max` (NOT flipped to
  Shipped)
- Doc gap noted in Tester verdict §"Doc coverage"
- Working-Claude addresses doc gaps
- Working-Claude re-invokes Tester
- Repeat until PASS

### Workstream order of operations

1. PM scopes brief (GATE 1)
2. Working-Claude refreshes graph: `npm run doc-graph`
3. PM authors brief; working-Claude post-processes to add `Scope:`
   frontmatter
4. Max GATE 1 (brief review)
5. Working-Claude executes per plan; demos at coherent units
6. Max GATE 2 (demo review)
7. Working-Claude updates the docs above PER THIS PROTOCOL
8. Working-Claude invokes Tester subagent
9. Tester runs `npm run doc-rot --workstream <slug>` + functional
   verification; renders verdict
10. If PASS: working-Claude flips Status to `verified-pending-max <sha>`
11. Ping Max for GATE 3
12. Max UAT pass: flip to `Shipped <sha> — verified against <recording>`
13. Push origin per `shipped-gate.md` push protocol

## §PM-trigger — Rule 7 (consult dep graph at feature-planning time)

**Trigger:** When working-Claude is about to invoke PM subagent for a
workstream that changes a system.

**Steps:**
1. Run `npm run doc-graph` to refresh SYSTEMS.md auto-generated regions
2. Verify regions updated (manually review the diff)
3. Invoke PM with the refreshed SYSTEMS.md available as context
4. PM consults SYSTEMS.md:
   - **"Called by" column** for the system being changed → who depends
     on this; blast radius for callers
   - **"Depended on by" manual overlay (if present)** → non-import
     dependencies (event subscriptions, shared state)
5. PM brief includes a **"Blast radius"** section listing
   systems/features downstream of the change

**After PM returns brief:** working-Claude post-processes to add
`Scope:` frontmatter (PM persona is project-agnostic per Rule 11 and
doesn't know well-dipper YAML schema):
1. Read PM brief; identify mentioned features (slugs from FEATURES.md)
2. Identify mentioned systems (slugs from SYSTEMS.md)
3. Identify file paths in scope (from PM's Implementation Plan section)
4. Identify base branch (usually `master`)
5. Prepend YAML frontmatter to workstream file per template

**When this rule does NOT apply:**
- Trivial edits (typo, log level, internal-only refactor): no PM,
  no graph refresh
- Bug fix or single-file change with observable behavior: PM may be
  skipped; graph refresh optional based on whether the fix touches
  multiple systems
- Doc-only workstreams: no PM, no graph refresh

## §Rule 11 — Project-specific triggers in CLAUDE.md, not PERSONAS

**Why:** `docs/PERSONAS/{pm,tester,game-dev}.md` files are symlinked
into `~/.claude/agents/<persona>.md` and used across ALL projects.
Adding well-dipper-specific commands (`npm run doc-graph`, file paths
in this repo, this project's YAML schema) to those files would cause
those personas to fire wrong instructions in other projects.

**What to do when a persona seems to want project-specific behavior:**
1. Encode the trigger in well-dipper's `CLAUDE.md`
2. Working-Claude executes the project-specific setup BEFORE invoking
   the persona
3. Working-Claude passes any project-specific context as part of the
   persona invocation
4. The persona itself stays generic

**Example:** Rule 7 wants PM to consult the dep graph. Instead of
adding "run npm run doc-graph" to `PERSONAS/pm.md`, well-dipper's
CLAUDE.md tells working-Claude to run the command BEFORE invoking
PM. PM consumes the refreshed SYSTEMS.md as ordinary context.

## §Rule 12 — Project docs link memory files, don't paste

**Why:** When info exists in BOTH a Claude memory file (cross-project
pattern) AND a project doc:
- Pasting duplicates content → guaranteed drift over time
- The memory file is the canonical source for the cross-project
  pattern
- The project doc should add project-specific context, not restate the
  cross-project rule

**Linking pattern:**
> "Applies cross-project rule from `feedback_<name>.md`. Specifically
> for well-dipper: <project-specific details>."

**Examples in `PROTOCOLS/development.md`:**
- Dev server: "Applies `feedback_no-start-servers.md` — Max runs in
  own terminal. Port: 5174."
- Deploy: "Applies `feedback_deploy-established-sites.md` — push
  without asking. Hosting: GitHub Pages at wow.pjh.is/well-dipper/."

**Drift verification:** when a memory file relevant to well-dipper
updates, working-Claude verifies the link in the project doc still
resolves and the cross-project rule still applies as stated.

**`doc-rot-check.sh` doesn't currently auto-detect link-vs-paste
violations** (semantic comparison is hard). Discipline only.

## Cross-references

- `docs/PROTOCOLS/shipped-gate.md` — what counts as a Shipped flip
  beyond doc updates (recording artifact required for visible
  features)
- `docs/PROTOCOLS/three-max-gate.md` — GATE 1/2/3 review pattern
- `docs/PROTOCOLS/test-harnesses.md` — three-layer test coverage
  framework Tester uses
- `docs/PROTOCOLS/development.md` — first-time setup that enables
  Rule 8 pre-push rot check
- Claude memory: `feedback_three-layer-test-coverage.md`,
  `feedback_push-on-shipped.md`, `feedback_deploy-established-sites.md`
