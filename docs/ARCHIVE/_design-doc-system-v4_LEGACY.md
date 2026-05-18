# Design — Well Dipper doc system (v4)

**Status:** Design spec, awaiting Max approval before step 3 migration.
**Authors:** Max + working-Claude, 2026-05-18 session.
**Lifecycle:** Archive after migration is complete (becomes
`ARCHIVE/_design-doc-system-v4_LEGACY.md`).
**Reference material:** game-dev documentation conventions research
(in chat history); `docs/_intake-2026-05-18-max-feature-status.md`;
supersedes v3 at `docs/_design-doc-system-v3.md`.
**v4 vs v3 diff:** v4 closes the 7 gaps found in the v3 audit —
PM-persona scoping, doc-graph many-to-many, doc-rot per-workstream,
mood-promotion rot check, mood-bootstrap markers, dev-doc / memory
relationship, install-hooks setup.

## Purpose

Documentation system that:

- Lets Max (Director / Team Lead / UAT) and Claude (Developer) stay
  coherent across sessions despite Claude having no persistent memory
- Answers "what's the F&F MVP status of feature X," "how do these
  systems wire together," "what does the player experience," "what's
  the blast radius of refactoring Y"
- Honors decay rates; automates hand-maintenance that reliably rots
- Bears the load Max named as missing from the current Bible: system
  wiring, pipelines, player-experience targets, Max-authoritative
  feature inventory

## Principles

1. **AI-collaborator-friendly across sessions.** Thin always-loaded
   root; everything else on demand.
2. **Max-authoritative feature truth.** Commit history is supporting
   evidence only.
3. **System wiring + pipelines as first-class artifact.**
4. **Player Beats with "feel" half mandatory.** Keith form: "As a
   player, I want X *so I can feel Y*."
5. **Generator catalogs for procedural systems.** Caves of Qud pattern:
   input space, grammar, output space, known dead-zones.
6. **Decay-rate split.**
7. **No empty folders.** Missing tracked in JOURNEY structural-debt.
8. **Don't drag old structures forward.** Migration is fresh authoring.
9. **Automate hand-maintenance that reliably rots.**
10. **Consult dep graph at feature-planning time.**
11. **Project-specific triggers live in project CLAUDE.md, not in
    cross-project persona files.** (NEW in v4 — fixes v3 audit Gap A.)
12. **Project docs link to memory files, don't paste.** (NEW in v4 —
    fixes v3 audit Gap F. Cross-project patterns stay in Claude memory;
    project-local specifics live in the project. When a project doc
    references a cross-project pattern, it links — never copies — to
    prevent drift.)

## Role coverage

| Role | Filled by | Primary docs | Decides |
|---|---|---|---|
| Director | Max | `HEART_OF_DESIRE.md`, `PILLARS.md`, `PLAYER_EXPERIENCE.md`, `JOURNEY.md`, `MOOD/` | scope, kill/keep, pillars match, path to heart |
| Team Lead | Max | `NOW.md`, `JOURNEY.md` current objective, `FEATURES.md`, `WORKSTREAMS/` index, `npm run uat-status` output | next work, blockers, ship timing |
| UAT | Max | `FEATURES/<feature>.md` Player Beats + ACs, `WORKSTREAMS/<active>.md` Tester verdicts, `PROTOCOLS/max-recording.md` | feature done?, shipped matches spec? |
| Developer | Claude | `SYSTEMS/<sys>/*`, `FEATURES/<feature>.md` context, `WORKSTREAMS/<active>.md` scope, `PILLARS.md` + `MOOD/` for taste, `PROTOCOLS/development.md` for build/deploy | implementation, refactor scope |
| PM (subagent) | Claude subagent | `FEATURES.md`, `PILLARS.md`, `PLAYER_EXPERIENCE.md`, **refreshed** `SYSTEMS.md` (working-Claude refreshes via `npm run doc-graph` before invoking PM); authors `WORKSTREAMS/<new>.md` | brief scope, ACs, citations, blast-radius surfacing |
| Tester (subagent) | Claude subagent | `WORKSTREAMS/<active>.md` ACs, `FEATURES/<feature>.md` Player Beats, recording artifact, `npm run doc-rot --workstream <slug>` output | PASS / FAIL / INSUFFICIENT (includes doc-coverage criterion, scoped to workstream's diff) |

## Structure

```
~/projects/well-dipper/
  CLAUDE.md                          # auto-loaded; carries project-specific triggers (Rule 7, Rule 8, Rule 11)
  package.json                       # adds doc-rot, doc-graph, uat-status scripts
  
  scripts/
    doc-rot-check.sh                 # rot detection (project-wide + --workstream <slug> scoped)
    doc-graph.js                     # file→system mapping + graph generation
    uat-status.sh                    # UAT rollup digest
    mood-index-bootstrap.sh          # initial MOOD/README.md inventory from Pictures folder
    git-hooks/
      pre-push                       # runs doc-rot project-wide; warns on rot
    install-hooks.sh                 # one-time installer for git hooks
  
  docs/
    README.md                        # one-screen doc map
    
    # Orientation
    HEART_OF_DESIRE.md               # Director — WHY (rare)
    JOURNEY.md                       # Director + Team Lead — PATH + structural debt (~weekly)
    NOW.md                           # Team Lead — active + queued (per-session)
    
    # Game identity
    PILLARS.md                       # Director — WHAT this game IS (rare)
    PLAYER_EXPERIENCE.md             # Director + UAT — per-mode experience targets (medium)
    
    # Feature truth
    FEATURES.md                      # Team Lead — Max-authoritative flat inventory
    FEATURES/                        # per-feature deep dives
      <feature>.md
    
    # System truth
    SYSTEMS.md                       # flat wiring map + auto-generated graph
    SYSTEMS/                         # per-system deep dives (created on demand)
      <sys>/
        README.md                    # purpose · interface · wiring · history · Module(s) (1-to-1 ownership)
        CLAUDE.md       (optional)
        pipeline.md     (optional)
        generator.md    (optional)
        changelog.md
        ROADMAP.md      (optional)
    
    # Visual reference — index only, images stay in Pictures folder
    MOOD/
      README.md                      # index w/ Annotated + Unannotated (AUTO-INVENTORY) sections
      .gitignore                     # excludes everything except README.md
    
    # Work in flight
    WORKSTREAMS/                     # PM/Tester/Team Lead (existing)
    
    # Process
    PERSONAS/                        # PM, Tester, Game-Dev (existing, symlinked, project-agnostic)
    PROTOCOLS/                       # NEW folder
      max-recording.md
      shipped-gate.md
      three-max-gate.md
      doc-updates-on-ship.md         # codifies Rule 3
      development.md                 # build/run/deploy + first-time setup; links to memory files for cross-project patterns
      glossary.md
    
    # Archaeology
    ARCHIVE/                         # NEW folder
```

## Per-file specifications

### `CLAUDE.md` (project root)

Auto-loads `HEART_OF_DESIRE.md` + `JOURNEY.md` current-objective +
`NOW.md` at session start. **Carries all project-specific triggers**
(Rules 3, 7, 8, 9). PERSONAS at `docs/PERSONAS/` remain
project-agnostic — they don't know about `npm run doc-graph` or
`scripts/doc-rot-check.sh`. CLAUDE.md is where well-dipper-specific
behavior is encoded.

Specific triggers CLAUDE.md must carry:
- **Rule 7:** "When invoking PM to scope a workstream that changes a
  system, run `npm run doc-graph` first to refresh SYSTEMS.md, then
  point PM at the refreshed file."
- **Rule 3:** "Before flipping a workstream Status to Shipped,
  working-Claude updates FEATURES.md row + PLAYER_EXPERIENCE.md
  if shipped experience differs + SYSTEMS/<sys>/README.md if wiring
  changed + SYSTEMS/<sys>/changelog.md if approaches were tried-and-
  abandoned. Tester checks these as part of PASS criterion via
  `npm run doc-rot --workstream <slug>`."
- **Rule 11:** "Don't put well-dipper-specific commands in
  docs/PERSONAS/* files. Project-specific triggers live here in
  CLAUDE.md."

### `docs/README.md`

One screen. Doc map.

### `docs/HEART_OF_DESIRE.md`

**Already exists.** No structural change. Decay: rare.

### `docs/JOURNEY.md`

**Already exists. Adds "Doc system completion" section** for missing-but-
needed docs. Combined-doc rationale: holds milestones + structural debt;
split if debt > ~20 items.

Decay: weekly.

### `docs/NOW.md`

**Already exists.** No structural change.

Decay: per-session.

### `docs/PILLARS.md`

**New.** Genre, pillars, aesthetic, key fictions (lore folds in here),
what this game is NOT. Links to `MOOD/` for visual references.

Decay: rare.

### `docs/PLAYER_EXPERIENCE.md`

**New.** Per-mode experience targets (SCREENSAVER / ENRICHED / GAME).
Target experience + Anti-experience per tier. Bound to Tester PASS-on-
Shipped ritual (Rule 3).

Decay: medium.

### `docs/FEATURES.md`

**New.** Max-authoritative flat inventory.

Status schema: `shipped-confirmed`, `shipped-code`, `verified-pending-max`,
`in-flight`, `scoped`, `proposed`, `parked`, `dead`.

Tier schema: `F&F-MVP`, `ENRICHED`, `GAME`, `unsure`.

Columns: Feature | Tier | Status | Blocks | Blocked by | Deep dive

Authority header declares Max as source of truth. Cross-cutting status
notes at header capture project-wide truths.

Decay: per-shipment.

### `docs/FEATURES/<feature>.md`

**New template, existing folder.** Per-feature deep dives. Sections:
Purpose, Player Beats (per tier, mandatory "so I can feel Y" + observable
AC), Current state, Open questions, Systems touched.

Authored only when content beyond the FEATURES.md row justifies it.

Decay: medium.

### `docs/SYSTEMS.md`

**New.** Flat wiring map + auto-generated regions.

Template:

```markdown
# Systems — Well Dipper

## System-of-systems diagram
<!-- AUTO-GENERATED: graph (npm run doc-graph) -->
[mermaid/ASCII diagram regenerated from import graph + file→system mapping]
<!-- /AUTO-GENERATED -->

## Systems
<!-- AUTO-GENERATED: table (npm run doc-graph) -->
| System | Purpose | Calls | Called by | Has deep dive |
|---|---|---|---|---|
<!-- /AUTO-GENERATED -->

## Manual overlays
[Hand-curated notes that don't fit auto-generated regions —
e.g., "Inspection layer has no production callers; invoked via __wd.* only."]
```

Auto-generated regions regenerated by `npm run doc-graph`. Manual
overlays preserved.

Decay: per-refactor (auto-regenerated).

### `docs/SYSTEMS/<sys>/README.md`

**New template, new per-system folder.** Sections: Purpose, Module(s),
Tier(s) served, Interface (Triggers / Inputs / Outputs / State), Wiring
(Calls into / Called by / Reads / Writes), History, Open questions.

**`Module(s)` line uses strict 1-to-1 ownership (fixes v3 audit Gap B).**
Each `src/**/*.js` file appears in exactly ONE system's Module(s) line.
Files that legitimately span systems must be either:
- **Split** into per-system files (preferred), OR
- **Qualified** with a function/method scope:
  `src/rendering/RetroRenderer.js (scope: hyperspace() method only)`

Doc-graph script reads scopes; if no scope, claims the whole file. If a
file appears in two systems' Module(s) without scopes, doc-graph errors.

Rationale: many-to-many file→system mapping over-reports system
dependencies (warp "calls" everything main.js imports). 1-to-1 ownership
with optional scoping handles real cases cleanly.

### `docs/SYSTEMS/<sys>/CLAUDE.md` (optional)

**New, optional.** Per-system instructions when conventions differ
from root.

### `docs/SYSTEMS/<sys>/pipeline.md` (optional)

**New, optional.** Sequence diagrams / step-by-step flow.

### `docs/SYSTEMS/<sys>/generator.md` (optional)

**New, optional.** 4-section template for procedural systems.

### `docs/SYSTEMS/<sys>/changelog.md`

**New.** First-class "what we tried, what we abandoned, what landed."

### `docs/SYSTEMS/<sys>/ROADMAP.md` (optional)

**New, optional.** Multi-phase plans. Absorbs archived `PLAN_*.md`
content via fresh authoring.

### `docs/MOOD/` (new — references Pictures folder)

**New folder.** Visual references for aesthetic decisions.

**Image files stay at** `/mnt/c/Users/Max/Pictures/well-dipper/` —
126 files, 249 MB, not committed to repo. The `.gitignore` excludes
everything except `README.md`.

**`README.md` template:**

```markdown
# Mood — Well Dipper

Visual references for aesthetic decisions. Cross-linked from
`PILLARS.md` Aesthetic section, and from per-feature/per-system docs.

**Image files:** `/mnt/c/Users/Max/Pictures/well-dipper/`
(not committed per .gitignore).

## How this index works

- **Annotated** entries: caption + "what it references" + cited-by
  links. These are actively used in design decisions.
- **Unannotated** entries: bootstrapped from filenames; pure inventory
  until referenced. Promote to Annotated when cited from a feature/system.

## Annotated references

### blade-runner-concept-art-syd-mead-1981-...webp
- **References:** UI / HUD aesthetic — Syd Mead retrofuturism
- **Cited by:** `PILLARS.md` (Aesthetic section)
- **Added:** 2026-03-14

[... more as cited from features/systems ...]

## Unannotated inventory

<!-- AUTO-INVENTORY-START -->
Subfolder: `screenshots/` — [count] files
Subfolder: `galaxy-debug/` — [count] files

Root-level files:
- `00e81cf5-60d6-4685-b174-82c0975bc5ef_1184x864.jpg` (added 2026-03-07)
- ...
<!-- /AUTO-INVENTORY-END -->
```

**Idempotence markers (fixes v3 audit Gap E):** `mood-index-bootstrap.sh`
only touches content between `<!-- AUTO-INVENTORY-START -->` and
`<!-- /AUTO-INVENTORY-END -->`. Annotation promotion moves a line OUT
of the auto-inventory block into the Annotated section above.

**Promotion rot check (fixes v3 audit Gap D):** `doc-rot-check.sh`
detects when an image filename is cited from any `FEATURES/*.md` or
`SYSTEMS/*/*.md` but still appears in the Unannotated block. Flagged
as "promotion needed."

### `docs/WORKSTREAMS/` (existing)

No structural change.

### `docs/PERSONAS/` (existing)

**Path preserved** to avoid breaking `~/.claude/agents/<persona>.md`
symlinks. **Stays project-agnostic per Rule 11** — no well-dipper-specific
commands. Project triggers live in CLAUDE.md instead.

### `docs/PROTOCOLS/` (new)

Files on migration:
- `max-recording.md` — was `MAX_RECORDING_PROTOCOL.md`
- `shipped-gate.md`
- `three-max-gate.md`
- `doc-updates-on-ship.md`
- `development.md`
- `glossary.md`

### `docs/PROTOCOLS/development.md` (G3 + fixes v3 audit Gaps F + G)

**New.** Well-dipper-specific dev info: build, run, deploy, common
workflows, troubleshooting.

**Relationship to Claude memory files (Rule 12):** development.md is the
**canonical** location for well-dipper-specific dev info. Cross-project
patterns in Claude memory (e.g., `feedback_no-start-servers.md`,
`feedback_vite-wsl2-stale-modules.md`, `feedback_deploy-established-sites.md`,
`chrome-devtools-9223-launch.md`) are **linked, never pasted**. When info
lives in BOTH places, development.md says:

> "Applies cross-project rule from `feedback_no-start-servers.md`.
> Specifically for well-dipper: dev server runs on port 5173 via
> `npm run dev`; Max runs this in his own terminal."

Drift prevention: when a memory file relevant to well-dipper updates,
working-Claude verifies the link in development.md still resolves and
the cross-project rule still applies.

**Template:**

```markdown
# Development — Well Dipper

## Stack
Vite + Three.js + custom GLSL shaders.

## First-time setup
1. Install dependencies: `npm install`
2. **Install git hooks:** `bash scripts/install-hooks.sh`
   (one-time; required for Rule 8 pre-push rot check to fire)
3. Verify hook installed: `ls .git/hooks/pre-push` should resolve.

## Dev server
[Exact command, port, expected URL]
Cross-project rule: `feedback_no-start-servers.md` — Max runs in own terminal.

## Build
[Exact command, output location]

## Deploy
[Current hosting; planned hosting; exact commands; verification]
Cross-project rule: `feedback_deploy-established-sites.md` — push without asking
on established projects.

## Common workflows
- **chrome-devtools on port 9223:** see `chrome-devtools-9223-launch.md`
  for the second-Chrome launch pattern. Use this instead of Playwright per
  `feedback_prefer-chrome-devtools.md`.
- **Visual QA after edits:** `feedback_visual-qa-mandatory.md` applies —
  take chrome-devtools screenshot after any visual-scope edit.
- ...

## Troubleshooting
- **Stale modules:** see `feedback_vite-wsl2-stale-modules.md`. Restart
  `npm run dev` if Edit lands but browser fetches old bytes.
- ...
```

**First-time setup section (fixes v3 audit Gap G):** prompts Max to run
`install-hooks.sh` so Rule 8 actually fires.

### `docs/PROTOCOLS/glossary.md` (G4)

**New.** Project-specific terminology. In-fiction terms reference
PILLARS.md Key Fictions; technical/dev terms documented in full here.

### `docs/ARCHIVE/` (new)

**New folder.** Archaeology. Initial contents on migration:
- `GAME_BIBLE_LEGACY.md`
- `FEATURE_AUDIT_LEGACY.md`
- `MVP_SYSTEMS_REVIEW_2026-03-30_LEGACY.md`
- `PLAN_world-origin-rebasing_LEGACY.md`
- `PLAN_inspection-layer-v2_LEGACY.md`
- `_design-doc-system-v2_LEGACY.md`
- `_design-doc-system-v3_LEGACY.md`

After step 3 completes, this design doc joins archive as
`_design-doc-system-v4_LEGACY.md`.

## Automation — scripts/

### `scripts/doc-rot-check.sh` (G1, updated for Gap C)

**Updated in v4 with `--workstream <slug>` flag.**

**Default invocation (`npm run doc-rot`):** project-wide. Runs on every
push via pre-push hook (Rule 8). Output: `~/briefings/well-dipper-doc-rot-<sha>.md`.

**Scoped invocation (`npm run doc-rot --workstream <slug>`):** filters
output to rot touching files/docs the named workstream's diff modifies.
Tester runs this version as part of PASS criterion (CLAUDE.md trigger).

**Checks (project-wide; scoped version filters by workstream's modified files):**

| Check | Flags |
|---|---|
| Stale deep dives | `FEATURES/<X>.md` last-modified >30 days older than most recent commit touching files claimed by that feature's systems |
| Unclaimed source files | `src/**/*.js` not appearing in any `SYSTEMS/<sys>/README.md` Module(s) line |
| Broken doc references | Markdown links in `docs/` that don't resolve |
| Status-stuck features | `FEATURES.md` rows in `in-flight` >14 days without recent Tester verdict |
| Confirmation lag | `FEATURES.md` rows in `shipped-code` >7 days without `shipped-confirmed` transition |
| System-doc absence | `SYSTEMS.md` rows marked "no doc yet" not appearing in JOURNEY structural-debt with rationale |
| **Mood-promotion needed** (NEW v4) | Image filename cited from any `FEATURES/*.md` or `SYSTEMS/*/*.md` but still appears in `MOOD/README.md` Unannotated block |

**Push behavior:** warns loudly; does not block push by default.
Configurable via env var `WELL_DIPPER_DOC_ROT_BLOCK=true`.

**Discord push:** only if new rot since last run crossed severity
threshold (per `feedback_discord-push-exception-only.md`).

### `scripts/doc-graph.js` (G2, updated for Gap B)

**Updated in v4 with strict 1-to-1 ownership.**

**Approach:**
1. Use `madge` to parse ES module import graph from `src/**/*.js`
2. Read file→system mapping from `Module(s):` sections (1-to-1 ownership
   per Gap B fix)
3. Join: file imports A → owning system → system X calls system Y
4. Write system-of-systems diagram + Calls/Called by columns into
   SYSTEMS.md between `<!-- AUTO-GENERATED -->` markers

**Errors:**
- File listed in two systems' Module(s) without scope qualifier → error
  "file in multiple Module(s); split or qualify with (scope: ...)"
- Unclaimed file (in `src/` but not in any Module(s)) → warning (also
  caught by doc-rot)
- Dynamic `import()` calls → flagged as uncertain edges in the graph

**Trigger:**
- On demand via `npm run doc-graph`
- Consulted at PM-planning time (Rule 7) — CLAUDE.md says working-Claude
  runs `npm run doc-graph` before invoking PM for a system-changing
  workstream
- NOT regenerated on every commit

**Implementation notes (for step 3):**
- Atomic write to tempfile + rename (prevent mid-generation corruption)
- madge as devDependency (`npm install --save-dev madge`)

### `scripts/uat-status.sh` (G6)

**New.** UAT status rollup digest.

Queries FEATURES.md for `verified-pending-max` and `shipped-code` rows.
Outputs:

```
=== UAT Status — Well Dipper — <date> ===

WAITING ON MAX UAT (verified-pending-max):
- <feature> | <workstream link> | Tester PASS on <sha> at <date>

SHIPPED-CODE PENDING CONFIRMATION (shipped-code):
- <feature> | shipped <date> | <days since> days without UAT
```

Trigger: `npm run uat-status` on demand.

### `scripts/mood-index-bootstrap.sh` (G7, updated for Gap E)

**Updated in v4 with explicit idempotence markers.**

Reads `/mnt/c/Users/Max/Pictures/well-dipper/` and generates/refreshes
the Unannotated inventory section of `docs/MOOD/README.md`.

**Idempotence implementation:**
- Only touches content between `<!-- AUTO-INVENTORY-START -->` and
  `<!-- /AUTO-INVENTORY-END -->` markers
- If markers don't exist, creates them at end of file
- Adds new files; never removes manually-promoted entries (those are
  outside the markers, in the Annotated section)
- Per-file format: `- ` + filename + ` (added YYYY-MM-DD)` from mtime
- Subfolders get their own subsections within the auto-inventory block

### `scripts/git-hooks/pre-push` + `scripts/install-hooks.sh`

**New.** Pre-push hook runs `doc-rot-check.sh` project-wide. Installer
copies hook into `.git/hooks/pre-push`. **Setup step required in
`PROTOCOLS/development.md` First-time setup** (Gap G fix).

## Rules

### Rule 1 — No empty folders
Missing tracked in JOURNEY structural-debt.

### Rule 2 — Don't drag old structures forward
Migration is fresh authoring informed by archived material.

### Rule 3 — Tester PASS-on-Shipped triggers doc updates
Before Shipped flip, working-Claude updates:
- `FEATURES.md` row status (always)
- `PLAYER_EXPERIENCE.md` (if shipped experience differs from spec)
- `SYSTEMS/<sys>/README.md` (if wiring/interface changed)
- `SYSTEMS/<sys>/changelog.md` (if approach was tried-and-abandoned)

Tester checks via `npm run doc-rot --workstream <slug>`. Doc gap = FAIL.

### Rule 4 — FEATURES.md authority
Max-authoritative. `shipped-code` vs `shipped-confirmed` distinguishes
in-main from UAT-passed.

### Rule 5 — Player Beats require "so I can feel Y"
Keith form mandatory. Every beat has at least one observable AC.

### Rule 6 — Generator docs use 4-section template
Input space, Grammar/rules, Output space, Known dead-zones.

### Rule 7 — Consult dep graph at feature-planning time
When working-Claude invokes PM to scope a workstream that changes a
system, run `npm run doc-graph` first to refresh SYSTEMS.md, then point
PM at the refreshed file. PM consults "Called by" + "Depended on by"
for blast radius. Brief includes a "Blast radius" section.

**Trigger lives in well-dipper CLAUDE.md, not PM persona** (Rule 11).

### Rule 8 — Pre-push rot check
`scripts/doc-rot-check.sh` runs project-wide on every `git push` via
pre-push hook. Warns loudly; does not block by default. Pre-push hook
only fires if `scripts/install-hooks.sh` was run during first-time setup
(per `PROTOCOLS/development.md`).

### Rule 9 — Auto-generated regions in SYSTEMS.md
SYSTEMS.md graph + table auto-generated between `<!-- AUTO-GENERATED -->`
markers by `npm run doc-graph`. Manual edits inside markers are
overwritten; manual content goes outside, in "Manual overlays" section.

### Rule 10 — Module(s) lines use strict 1-to-1 ownership
Each `src/**/*.js` file in exactly ONE system's `Module(s):` list.
Cross-system files split or qualified with `(scope: function-name)`.
Doc-graph errors on unqualified duplicates.

### Rule 11 — Project-specific triggers in CLAUDE.md, not persona files (NEW)
`docs/PERSONAS/` files (pm.md, tester.md, game-dev.md) are symlinked
cross-project. They stay project-agnostic. Well-dipper-specific commands,
file paths, and workflows live in well-dipper's `CLAUDE.md`. When a
persona needs project-specific behavior, CLAUDE.md tells working-Claude
how to set it up before invoking the persona (e.g., "refresh SYSTEMS.md
before invoking PM"), or what to pass to the persona as context.

### Rule 12 — Project docs link memory files, don't paste (NEW)
When info exists in BOTH a Claude memory file (cross-project pattern)
and a project doc, the project doc links and adds project-specific
context — never copies the memory file's content. Drift prevention.

## Decisions made

- **Lore (Bible §15):** fold into `PILLARS.md` Key Fictions.
- **PERSONAS folder:** keep at `docs/PERSONAS/`; stays project-agnostic.
- **PLAN_*.md disposition:** all archive on migration; ROADMAP authored
  fresh per-system when needed.
- **Bible §14 Open Questions:** distribute by topic.
- **JOURNEY combined-doc:** holds milestones + structural debt; split if
  debt > ~20 items.
- **MOOD images:** stay at Pictures folder; index in repo; progressive
  annotation.

## Migration approach

11 steps (unchanged from v3 in count; step 10 updated for Gap A):

1. **Archive infrastructure.** Create `ARCHIVE/`; move Bible,
   FEATURE_AUDIT, MVP_SYSTEMS_REVIEW, PLAN_*, v2 and v3 design docs
   with `_LEGACY` suffix.
2. **Author thin v4 infrastructure.** `README.md`, `PILLARS.md`,
   `PLAYER_EXPERIENCE.md` skeletons + `PROTOCOLS/` folder + relocated
   `max-recording.md` + new `development.md` (with First-time setup)
   + new `glossary.md` + new `doc-updates-on-ship.md` + `shipped-gate.md`
   + `three-max-gate.md`.
3. **Author scripts.** `scripts/doc-rot-check.sh` (with `--workstream`
   flag and mood-promotion check), `scripts/doc-graph.js` (with strict
   1-to-1 ownership), `scripts/uat-status.sh`,
   `scripts/mood-index-bootstrap.sh` (with idempotence markers),
   `scripts/git-hooks/pre-push`, `scripts/install-hooks.sh`. Add npm
   scripts to `package.json`. Install madge as devDependency.
4. **Wire up MOOD index.** Create `docs/MOOD/README.md` (with
   AUTO-INVENTORY markers) + `.gitignore`; run
   `scripts/mood-index-bootstrap.sh`; link from PILLARS Aesthetic section.
5. **Author FEATURES.md with Max.** Dedicated session. Max-authoritative
   per row.
6. **Author SYSTEMS.md flat map.** Working-Claude drafts manual sections
   + initial row list + Module(s) ownership decisions. Run
   `npm run doc-graph` to populate auto-generated regions.
   SYSTEMS/<sys>/ folders NOT created — only when first doc inside
   authored.
7. **Standardize existing FEATURES/<feature>.md docs.** Add Player Beats
   sections per template.
8. **Resolve audit items from intake doc.** Deep-sky code audit;
   autopilot target audit; 18 planet types audit; Easter egg audit.
9. **Update CLAUDE.md** for v4 structure. Session-start protocol +
   Rules 3 / 7 / 8 / 9 / 11 / 12 encoded as project-specific triggers.
10. **Verify pre-push hook installed.** Run `bash scripts/install-hooks.sh`;
    confirm `.git/hooks/pre-push` exists; test with `git push --dry-run`.
    **PERSONAS files unchanged** — project-specific triggers stayed in
    CLAUDE.md per Rule 11.
11. **Archive intake + design docs.** Both join ARCHIVE as `_LEGACY`.

## What the structure does NOT do

- **Cross-project sharing of doc patterns.** Out of scope; possibly
  worth generalizing later.
- **Discord-relay surface representation.** Cross-project infrastructure
  lives in Claude memory.
- **Automated rendering-quality regression detection.** Visual quality
  drift is perceptual; stays a Max-eye job.

## Open uncertainties

- **High confidence:** decay-rate split, FEATURES.md authority schema,
  generator catalog template, Tester-PASS doc-update rule, rot-check
  trigger on every push, dep-graph consulted at planning time, strict
  1-to-1 Module(s) ownership, link-not-paste rule for memory files.
- **Medium confidence:** PILLARS vs PLAYER_EXPERIENCE split, SYSTEMS.md
  flat-map sufficiency, scoping of `--workstream` filter (might miss
  rot that's technically not in workstream diff but is caused by it).
- **Lower confidence:** whether per-system `CLAUDE.md` pays off,
  whether `changelog.md` gets maintained, whether pre-push rot warnings
  become friction-fatigue Max ignores, whether mood-promotion rot check
  is too aggressive (citation might be vague — "see references in MOOD/"
  vs naming a specific file).
- Synthesis from research + intake, not a proven pattern. v5 expected
  as patterns prove or fail in practice.
