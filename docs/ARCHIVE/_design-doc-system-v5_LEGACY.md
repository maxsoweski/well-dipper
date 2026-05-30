# Design — Well Dipper doc system (v5)

**Status:** Design spec, awaiting Max approval before step 3 migration.
**Authors:** Max + working-Claude, 2026-05-18 session.
**Lifecycle:** Archive after migration is complete (becomes
`ARCHIVE/_design-doc-system-v5_LEGACY.md`).
**Reference material:** game-dev documentation conventions research
(in chat history); `docs/_intake-2026-05-18-max-feature-status.md`;
supersedes v4 at `docs/_design-doc-system-v4.md`.
**v5 vs v4 diff:** v5 closes the 5 gaps found in the v4 audit —
doc-rot `--workstream` mechanics, orchestration-file ownership,
CLAUDE.md size budget, SYSTEMS.md graph staleness check, parseable
"Systems touched" field. All fixes are in the automation/glue layer;
static doc structure unchanged from v4.

## Purpose

Documentation system that:

- Lets Max (Director / Team Lead / UAT) and Claude (Developer) stay
  coherent across sessions despite Claude having no persistent memory
- Answers "what's the F&F MVP status of feature X," "how do these
  systems wire together," "what does the player experience," "what's
  the blast radius of refactoring Y"
- Honors decay rates; automates hand-maintenance that reliably rots
- Bears load Max named as missing from current Bible: system wiring,
  pipelines, player-experience targets, Max-authoritative inventory

## Principles

1. **AI-collaborator-friendly across sessions.** Thin always-loaded
   root (target <120 lines); rest on demand.
2. **Max-authoritative feature truth.** Commit history is supporting
   evidence only.
3. **System wiring + pipelines as first-class artifact.**
4. **Player Beats with "feel" half mandatory.** Keith form.
5. **Generator catalogs for procedural systems.** Caves of Qud pattern.
6. **Decay-rate split.**
7. **No empty folders.** Missing tracked in JOURNEY structural-debt.
8. **Don't drag old structures forward.**
9. **Automate hand-maintenance that reliably rots.**
10. **Consult dep graph at feature-planning time.**
11. **Project-specific triggers in project CLAUDE.md, not cross-project
    persona files.**
12. **Project docs link memory files, don't paste.**
13. **CLAUDE.md is a trigger index, not a protocol manual.** (NEW v5 —
    fixes audit Gap J.) Triggers stated compactly with links to detailed
    protocols. Working-Claude follows the link when actually executing
    the rule.
14. **Structured fields where automation reads them.** (NEW v5 — fixes
    audit Gaps H + L.) `Module(s):`, `Systems touched:`, workstream
    `Scope:` are not free-form prose; they follow a specified format so
    `doc-graph.js` and `doc-rot-check.sh` can parse them.

## Role coverage

| Role | Filled by | Primary docs | Decides |
|---|---|---|---|
| Director | Max | `HEART_OF_DESIRE.md`, `PILLARS.md`, `PLAYER_EXPERIENCE.md`, `JOURNEY.md`, `MOOD/` | scope, kill/keep, pillars match |
| Team Lead | Max | `NOW.md`, `JOURNEY.md`, `FEATURES.md`, `WORKSTREAMS/`, `npm run uat-status` | next work, blockers, ship timing |
| UAT | Max | `FEATURES/<feature>.md` Player Beats + ACs, `WORKSTREAMS/<active>.md` verdicts, recording protocol | feature done?, shipped matches spec? |
| Developer | Claude | `SYSTEMS/<sys>/*`, `FEATURES/<feature>.md`, `WORKSTREAMS/<active>.md`, `PILLARS.md` + `MOOD/`, `PROTOCOLS/development.md` | implementation, refactor scope |
| PM (subagent) | Claude subagent | `FEATURES.md`, `PILLARS.md`, `PLAYER_EXPERIENCE.md`, **refreshed** `SYSTEMS.md`; authors `WORKSTREAMS/<new>.md` with structured `Scope:` | brief scope, ACs, citations, blast radius |
| Tester (subagent) | Claude subagent | `WORKSTREAMS/<active>.md` ACs + `Scope:`, `FEATURES/<feature>.md` Player Beats, recording, `npm run doc-rot --workstream <slug>` output | PASS / FAIL / INSUFFICIENT (doc-coverage scoped to workstream `Scope:`) |

## Structure

```
~/projects/well-dipper/
  CLAUDE.md                          # auto-loaded; trigger index (<120 lines)
  package.json                       # adds doc-rot, doc-graph, uat-status scripts
  
  scripts/
    doc-rot-check.sh                 # rot detection (project-wide + --workstream <slug>)
    doc-graph.js                     # file→system mapping + graph generation (handles meta: orchestration)
    uat-status.sh                    # UAT rollup digest
    mood-index-bootstrap.sh          # initial MOOD/README.md inventory
    git-hooks/
      pre-push                       # runs doc-rot project-wide
    install-hooks.sh                 # one-time installer
  
  docs/
    README.md                        # doc map
    
    # Orientation
    HEART_OF_DESIRE.md               # rare
    JOURNEY.md                       # weekly (incl. structural-debt section)
    NOW.md                           # per-session
    
    # Game identity
    PILLARS.md                       # rare
    PLAYER_EXPERIENCE.md             # medium (bound to Tester PASS ritual)
    
    # Feature truth
    FEATURES.md                      # Max-authoritative flat inventory (per-ship)
    FEATURES/
      <feature>.md                   # template w/ machine-parseable Systems touched: line
    
    # System truth
    SYSTEMS.md                       # flat wiring map + auto-generated graph
    SYSTEMS/
      app-shell/                     # NEW v5 — claims main.js + bootstrap/init code (Gap I)
        README.md
        ...
      <sys>/                         # other systems
        README.md                    # Module(s) supports meta: orchestration flag
        ...
    
    # Visual reference
    MOOD/
      README.md                      # Annotated + Unannotated (AUTO-INVENTORY markers)
      .gitignore
    
    # Work in flight
    WORKSTREAMS/                     # briefs include structured Scope: frontmatter
    
    # Process
    PERSONAS/                        # project-agnostic (symlinked)
    PROTOCOLS/                       # NEW folder; carries detailed rule mechanics (Rule 13)
      max-recording.md
      shipped-gate.md
      three-max-gate.md
      doc-updates-on-ship.md         # full Rule 3 protocol
      development.md                 # build/run/deploy + first-time setup
      glossary.md
    
    # Archaeology
    ARCHIVE/
```

## Per-file specifications

### `CLAUDE.md` (project root)

**Compact trigger index per Rule 13.** Target: <120 lines.

Auto-loads `HEART_OF_DESIRE.md` + `JOURNEY.md` current-objective +
`NOW.md` at session start. Triggers stated compactly (2-3 lines each)
with links to detailed protocol in `PROTOCOLS/`.

Template structure:

```markdown
# Well Dipper — project-local Claude instructions

[Brief project framing — 5 lines max]

## Session start
1. Re-read HEART_OF_DESIRE.md (5 sec)
2. Skim JOURNEY.md current-objective
3. Read NOW.md active + queued
4. Verify ~/.claude/state/dev-collab/active-workstream.json matches NOW.md

## Triggers

### Before invoking PM for a system-changing workstream
Run `npm run doc-graph` to refresh SYSTEMS.md. Pass refreshed SYSTEMS.md
to PM. Brief must include "Blast radius" section.
→ Full protocol: PROTOCOLS/doc-updates-on-ship.md §PM-trigger

### Before flipping workstream Status: Shipped
Update FEATURES.md row, PLAYER_EXPERIENCE.md (if shipped diverges from spec),
SYSTEMS/<sys>/README.md (if wiring changed), SYSTEMS/<sys>/changelog.md (if
approach was tried-and-abandoned). Tester verifies via
`npm run doc-rot --workstream <slug>`. Doc gap = FAIL.
→ Full protocol: PROTOCOLS/doc-updates-on-ship.md

### Don't put well-dipper-specific commands in PERSONAS/
PERSONAS files are symlinked cross-project. Project triggers live here.
→ Rationale: PROTOCOLS/doc-updates-on-ship.md §Rule-11

### Don't paste memory file content into project docs
Link to memory files; add project-specific context. Drift prevention.
→ Rationale: PROTOCOLS/doc-updates-on-ship.md §Rule-12

[... other triggers, each ~3 lines + link]
```

Detailed mechanics (what exactly counts as "wiring changed," how Tester
runs doc-rot, etc.) live in `PROTOCOLS/doc-updates-on-ship.md`. CLAUDE.md
just says "do X, see Y for detail." Working-Claude follows the link only
when actually executing the rule.

### `docs/README.md`

One screen. Doc map.

### `docs/HEART_OF_DESIRE.md` / `JOURNEY.md` / `NOW.md`

Already exist. JOURNEY adds "Doc system completion" structural-debt
section.

### `docs/PILLARS.md`

**New.** Genre, pillars, aesthetic, key fictions (lore), what game is NOT.
Decay: rare.

### `docs/PLAYER_EXPERIENCE.md`

**New.** Per-mode experience targets + anti-experience. Bound to Tester
PASS (Rule 3). Decay: medium.

### `docs/FEATURES.md`

**New.** Max-authoritative flat inventory.

Status: `shipped-confirmed`, `shipped-code`, `verified-pending-max`,
`in-flight`, `scoped`, `proposed`, `parked`, `dead`.
Tier: `F&F-MVP`, `ENRICHED`, `GAME`, `unsure`.
Columns: Feature | Tier | Status | Blocks | Blocked by | Deep dive.

Authority header + cross-cutting status notes at top.

Decay: per-shipment.

### `docs/FEATURES/<feature>.md`

**New template. Updated v5 with parseable "Systems touched:" line
(Gap L fix).**

```markdown
# <Feature name>

**Status:** [link to FEATURES.md row]
**Tier:** [F&F-MVP / ENRICHED / GAME / unsure]
**Systems touched:** warp, audio, hud
                     ^^^^^^^^^^^^^^^^^^^^
                     Comma-separated system slugs.
                     Each slug = SYSTEMS/<slug>/ folder name.
                     Parsed by doc-graph + doc-rot --workstream.

## Purpose
[1-2 paragraphs]

## Player Beats

### SCREENSAVER tier (viewer beats if applicable)
- As a viewer, I want [X] so I can feel [Y].
  - **Acceptance criterion:** [observable, pass/fail-able]

### ENRICHED tier
- As a player, I want [X] so I can feel [Y].
  - **Acceptance criterion:** [observable]

### GAME tier
- As a player, I want [X] so I can feel [Y].
  - **Acceptance criterion:** [observable]

## Current state
[Free-form notes on what's working, what's not, known defects]

## Open questions
[Things to resolve before this feature is done]
```

**Parseable contract:** the `**Systems touched:**` line is matched by
regex `^\*\*Systems touched:\*\*\s+(.+)$`. Slugs are comma-separated,
trimmed. Each slug must correspond to an existing `SYSTEMS/<slug>/`
folder (or be flagged by doc-rot as orphan reference).

Decay: medium.

### `docs/SYSTEMS.md`

**New.** Flat wiring map + auto-generated graph.

```markdown
# Systems — Well Dipper

## System-of-systems diagram
<!-- AUTO-GENERATED: graph (npm run doc-graph) -->
[mermaid diagram from import graph + Module(s) ownership]
<!-- /AUTO-GENERATED -->

## Systems
<!-- AUTO-GENERATED: table (npm run doc-graph) -->
| System | Purpose | Calls | Called by | Has deep dive |
|---|---|---|---|---|
<!-- /AUTO-GENERATED -->

## Manual overlays

**Required annotation (v5-audit Gap O):** the following note must
be carried in this section so readers understand the orchestration
asymmetry in the auto-generated regions above:

> Note: `app-shell`'s outward calls render in the system-of-systems
> diagram (arrows from app-shell to other systems) but are EXCLUDED
> from per-system "Called by" columns in the table. This asymmetry
> is intentional — orchestration files would over-report dependencies
> if treated as ordinary callers. The diagram shows what app-shell
> wires up; the table shows production-call relationships.

[Other hand-curated cross-cutting notes go below this annotation.]
```

Decay: per-refactor (auto-regenerated; required annotation persists).

### `docs/SYSTEMS/<sys>/README.md`

**New template. Updated v5 Module(s) format (Gap I fix).**

Sections: Purpose, Module(s), Tier(s) served, Interface, Wiring, History,
Open questions.

**Module(s) format with meta: flag (Gap I):**

```markdown
## Module(s)
- `src/effects/WarpEffect.js`
- `src/effects/WarpPortal.js`
- `src/rendering/RetroRenderer.js` (scope: hyperspace() method only)
- `src/main.js` (meta: orchestration)
```

Three forms:
- **Plain path** — the system claims the whole file
- **`(scope: ...)`** — the system claims only a method/section of the file
- **`(meta: orchestration)`** — the file is orchestration; doc-graph
  treats specially (see below)

**Strict 1-to-1 ownership** still applies: each file in exactly one
system's Module(s), unless qualified with `(scope: ...)` for genuine
multi-system files.

**Orchestration files** (main.js, app-bootstrap, init code) belong to
`SYSTEMS/app-shell/`. The `(meta: orchestration)` flag tells doc-graph:
"this file legitimately calls many systems; don't propagate outward
edges from it." app-shell appears in the graph as a single node;
arrows fan out without creating false dependencies on the receiving
systems' part.

### `docs/SYSTEMS/app-shell/` (NEW v5 — Gap I)

**New system.** Claims orchestration files. Initial Module(s):

```markdown
## Module(s)
- `src/main.js` (meta: orchestration)
- [other bootstrap/init files as identified during migration]
```

**Purpose:** wire systems together at app startup; own the top-level
game loop; handle URL params / debug shortcuts; manage scene/state
transitions at the highest level.

README structure same as other SYSTEMS/<sys>/README.md. Calls-into is
naturally broad; the meta: flag prevents this from showing as
"everything depends on everything."

### `docs/SYSTEMS/<sys>/CLAUDE.md` / `pipeline.md` / `generator.md` / `changelog.md` / `ROADMAP.md`

Unchanged from v4.

### `docs/MOOD/`

Unchanged from v4. Index in repo; images at Pictures folder;
progressive annotation; AUTO-INVENTORY markers.

### `docs/WORKSTREAMS/<slug>.md`

**Updated v5 with structured Scope: frontmatter (Gap H fix).**

Existing PM-authored brief format gets a new YAML-ish frontmatter block
at top:

```markdown
---
Scope:
  base: master                       # branch the workstream forks from
  paths:                             # file globs the workstream touches
    - src/effects/WarpEffect.js
    - src/effects/WarpPortal.js
    - src/rendering/RetroRenderer.js
  features:                          # FEATURES.md slugs in scope
    - warp
  systems:                           # SYSTEMS slugs in scope
    - warp
    - rendering
---

# <Workstream title>

[Rest of PM brief as before: context, ACs, plan, Tester verdicts,
Status: line]
```

**Parsed by `doc-rot-check.sh --workstream <slug>`:** reads
`WORKSTREAMS/<slug>.md` frontmatter, computes downstream doc surface
(features + systems mentioned + any FEATURES/<feature>.md whose
"Systems touched:" includes a listed system), filters rot output to
that surface.

**Authoring (v5-audit Gap N):** PM stays project-agnostic per Rule 11
and does NOT author the Scope frontmatter. PM writes the prose brief
(features, systems, files mentioned). Working-Claude post-processes:
reads the PM-authored brief, extracts the structured Scope fields
(base branch + file globs + feature slugs + system slugs) using
well-dipper schema knowledge, prepends the YAML frontmatter. Order:
working-Claude refreshes graph (Rule 7) → invokes PM → PM returns
brief → working-Claude adds Scope frontmatter → workstream file
committed.

For existing workstreams (37 archived + 1 active), working-Claude
infers Scope from `git log --follow` over each workstream's slug
+ Max review for active ones. Archived workstreams: batch
low-effort.

**Format:** standard YAML frontmatter (delimited by `---` lines).
Doc-rot uses a YAML parser; no custom syntax.

### `docs/PERSONAS/` / `PROTOCOLS/` / `ARCHIVE/`

Unchanged structurally from v4. PROTOCOLS now carries detailed rule
mechanics referenced from CLAUDE.md trigger statements (Rule 13).

**`PROTOCOLS/doc-updates-on-ship.md` outline (v5-audit Gap Q):** since
CLAUDE.md trigger statements reference this doc heavily, here's the
content brief — sections this protocol doc must carry:

- **§Rule 3 (Tester PASS-on-Shipped doc updates) — full mechanics**
  - Which docs update under which conditions (always FEATURES.md;
    PLAYER_EXPERIENCE only if shipped diverges; SYSTEMS/<sys>/README
    only if wiring changed; changelog only if approaches abandoned)
  - How working-Claude detects "wiring changed" vs "implementation
    changed without changing wiring"
  - How Tester runs `npm run doc-rot --workstream <slug>` and what
    output to look for (which checks count as doc-coverage gaps)
  - Tester FAIL behavior: workstream Status stays at
    `verified-pending-max`, doc gap noted in verdict, working-Claude
    addresses + re-invokes Tester
- **§PM-trigger (Rule 7 — consult dep graph at planning)**
  - When to run `npm run doc-graph` (system-changing workstreams)
  - How to read SYSTEMS.md "Called by" / "Depended on by" for blast
    radius
  - How working-Claude post-processes PM brief to add `Scope:`
    frontmatter
- **§Rule 11 rationale (project triggers in CLAUDE.md, not PERSONAS)**
  - Why PERSONAS stays project-agnostic (cross-project symlinks)
  - What to do when a persona seems to want project-specific behavior
    (encode in CLAUDE.md, pass to persona as context)
- **§Rule 12 rationale (link memory files, don't paste)**
  - Drift mechanism if pasted
  - Linking pattern: "Applies cross-project rule from <file>;
    specifically for well-dipper: <details>"
  - Verification: when a memory file relevant to well-dipper updates,
    verify the link in development.md still resolves

Target length: ~150 lines. Authored at migration step 2.

## Automation — scripts/

### `scripts/doc-rot-check.sh`

**Updated v5 with --workstream mechanics + SYSTEMS.md graph staleness
check (Gaps H + K).**

**Invocation:**
- `npm run doc-rot` — project-wide; runs on every push via pre-push hook (Rule 8)
- `npm run doc-rot --workstream <slug>` — scoped (Tester usage)

**Scoped mode (Gap H mechanics):**
1. Read `WORKSTREAMS/<slug>.md` frontmatter `Scope:` block
2. Expand `Scope.systems` to all docs under `SYSTEMS/<system>/`
3. Expand `Scope.features` to `FEATURES.md` rows + `FEATURES/<feature>.md`
4. Find any `FEATURES/<feature>.md` whose `Systems touched:` line
   includes a listed system → add to downstream surface
5. Filter the standard rot checks to flag only items in the downstream
   surface

**Checks:**

| Check | Flags |
|---|---|
| Stale deep dives | `FEATURES/<X>.md` last-modified >30 days older than most recent commit touching Module(s) files claimed by that feature's systems |
| Unclaimed source files | `src/**/*.js` not appearing in any `SYSTEMS/<sys>/README.md` Module(s) line (excl. `meta: orchestration` files) |
| Broken doc references | Markdown links in `docs/` that don't resolve |
| Status-stuck features | `FEATURES.md` rows in `in-flight` >14 days without recent Tester verdict |
| Confirmation lag | `FEATURES.md` rows in `shipped-code` >7 days without `shipped-confirmed` transition |
| System-doc absence | `SYSTEMS.md` rows marked "no doc yet" not appearing in JOURNEY structural-debt with rationale |
| Mood-promotion needed | Image filename cited from `FEATURES/*.md` or `SYSTEMS/*/*.md` but still in `MOOD/README.md` Unannotated block |
| **Graph staleness** (NEW v5, Gap K) | `SYSTEMS.md` auto-generated regions differ from a fresh `npm run doc-graph` run (compared via tempfile diff) |
| **Orphan Systems-touched** (NEW v5; clarified v5-audit Gap M) | `FEATURES/<X>.md` "Systems touched:" lists a slug with no corresponding row in `SYSTEMS.md` flat map. Check is against SYSTEMS.md row presence, NOT folder existence — per Rule 1, folders may legitimately not exist yet for systems that don't have deep dives authored. |

**Threshold tuning:** 30 days / 14 days / 7 days are defaults via env
vars (`WELL_DIPPER_DOC_ROT_STALE_DAYS=30` etc.). Tune by noise.

**Push behavior:** warns loudly; does not block by default. Configurable
via `WELL_DIPPER_DOC_ROT_BLOCK=true`.

**Discord push:** only on severity threshold (per
`feedback_discord-push-exception-only.md`).

### `scripts/doc-graph.js`

**Updated v5 with meta: orchestration handling (Gap I).**

**Approach:**
1. Use `madge` to parse ES module import graph from `src/**/*.js`
2. Read `Module(s):` from every `SYSTEMS/<sys>/README.md`
3. Apply ownership rules:
   - Plain path → file belongs to system
   - `(scope: foo)` → file's `foo` method belongs to system; rest
     unowned (or owned elsewhere)
   - `(meta: orchestration)` → file belongs to system but doc-graph
     does NOT propagate its outward import edges to claim "system calls X"
4. Join: file imports A → owning system X → system X calls system Y
   (skipping orchestration files' outward edges)
5. Write system-of-systems diagram + Calls/Called by columns into
   `SYSTEMS.md` between markers (atomic write to tempfile + rename)

**Orchestration semantics:**
- `app-shell` appears as a node in the graph
- Arrows FROM `app-shell` to other systems are rendered (so you can see
  what app-shell wires up)
- But other systems' "Called by" columns do NOT list `app-shell` for
  imports that came from orchestration files — those would over-report

**Errors:**
- File listed in two systems' Module(s) without `(scope: ...)` → error;
  exit 1; leave SYSTEMS.md unchanged
- Unclaimed file in `src/` → warning (also caught by doc-rot)
- Dynamic `import()` calls → flagged as uncertain edges

**Trigger:**
- On demand via `npm run doc-graph`
- Consulted at PM-planning time (Rule 7)
- NOT regenerated on every commit (staleness caught by doc-rot Gap K check)

### `scripts/uat-status.sh`

Unchanged from v4.

### `scripts/mood-index-bootstrap.sh`

Unchanged from v4. `<!-- AUTO-INVENTORY-START/END -->` markers handle
idempotence.

### `scripts/git-hooks/pre-push` + `scripts/install-hooks.sh`

Unchanged from v4. First-time setup required in
`PROTOCOLS/development.md`.

## Rules

### Rule 1 — No empty folders
Missing tracked in JOURNEY structural-debt section.

### Rule 2 — Don't drag old structures forward
Fresh authoring informed by archived material.

### Rule 3 — Tester PASS-on-Shipped triggers doc updates
Per CLAUDE.md trigger; mechanics in `PROTOCOLS/doc-updates-on-ship.md`.
Tester runs `npm run doc-rot --workstream <slug>`. Doc gap = FAIL.

### Rule 4 — FEATURES.md authority
Max-authoritative. `shipped-code` vs `shipped-confirmed` schema.

### Rule 5 — Player Beats require "so I can feel Y"
Keith form mandatory. Every beat has at least one observable AC.

### Rule 6 — Generator docs use 4-section template
Input space, Grammar/rules, Output space, Known dead-zones.

### Rule 7 — Consult dep graph at feature-planning time
Working-Claude runs `npm run doc-graph` before invoking PM for a
system-changing workstream. PM brief includes "Blast radius" section.
Trigger in CLAUDE.md (Rule 11).

### Rule 8 — Pre-push rot check
`scripts/doc-rot-check.sh` project-wide on every `git push`. Warns;
does not block by default. Requires `install-hooks.sh` first-time setup.

### Rule 9 — Auto-generated regions in SYSTEMS.md
`<!-- AUTO-GENERATED -->` markers. Manual edits inside overwritten;
manual content goes outside in "Manual overlays."
**Staleness caught by Rule 8 doc-rot check.**

### Rule 10 — Module(s) lines use strict 1-to-1 ownership
Each `src/**/*.js` in exactly one Module(s). Forms: plain, `(scope: ...)`,
`(meta: orchestration)`. Orchestration files belong to `SYSTEMS/app-shell/`.
Doc-graph errors on unqualified duplicates.

### Rule 11 — Project-specific triggers in CLAUDE.md, not persona files
PERSONAS stays project-agnostic.

### Rule 12 — Project docs link memory files, don't paste
Drift prevention.

### Rule 13 — CLAUDE.md is a trigger index, not a protocol manual (NEW v5)
Triggers stated compactly (~3 lines each) with links to detailed
protocol in `PROTOCOLS/`. Working-Claude follows the link when
actually executing the rule. Target CLAUDE.md size: <120 lines.

### Rule 14 — Structured fields where automation reads them (NEW v5)
`Module(s):` in SYSTEMS/<sys>/README.md, `Systems touched:` in
FEATURES/<feature>.md, `Scope:` frontmatter in WORKSTREAMS/<slug>.md
follow specified formats. Doc-graph + doc-rot parse them. Free-form
prose in those locations breaks automation.

## Decisions made

(Unchanged from v4.)

- Lore → `PILLARS.md` Key Fictions
- PERSONAS folder stays at `docs/PERSONAS/`; project-agnostic
- PLAN_*.md archive on migration; ROADMAP authored fresh
- Bible §14 Open Questions distribute by topic
- JOURNEY combined-doc; split if debt > ~20 items
- MOOD images stay at Pictures folder

## Migration approach

11 steps (unchanged in count; updated for v5 fixes):

1. **Archive infrastructure.** Create `ARCHIVE/`; move Bible,
   FEATURE_AUDIT, MVP_SYSTEMS_REVIEW, PLAN_*, v2 / v3 / v4 design docs
   with `_LEGACY` suffix.
2. **Author thin v5 infrastructure.** `README.md`, `PILLARS.md`,
   `PLAYER_EXPERIENCE.md` skeletons + `PROTOCOLS/` folder + relocated
   `max-recording.md` + `development.md` (with First-time setup +
   memory-file links per Rule 12) + `glossary.md` +
   `doc-updates-on-ship.md` (full Rule 3 protocol detail referenced
   from CLAUDE.md per Rule 13) + `shipped-gate.md` + `three-max-gate.md`.
3. **Author scripts.** `doc-rot-check.sh` (with `--workstream` mechanics,
   graph-staleness check, mood-promotion check, parseable field parsing),
   `doc-graph.js` (with `meta: orchestration` handling, atomic writes),
   `uat-status.sh`, `mood-index-bootstrap.sh` (AUTO-INVENTORY markers),
   `git-hooks/pre-push`, `install-hooks.sh`. Add npm scripts to
   `package.json`. Install madge.
4. **Wire up MOOD index.** Create `docs/MOOD/README.md` + `.gitignore`;
   run `mood-index-bootstrap.sh`; link from PILLARS.
5. **Author FEATURES.md with Max.** Dedicated session. Max-authoritative
   per row.
6. **Author SYSTEMS.md flat map + `SYSTEMS/app-shell/`.** Working-Claude
   drafts manual sections; identifies orchestration files via
   `(meta: orchestration)` flag; runs `npm run doc-graph` to populate
   auto-generated regions. Other SYSTEMS/<sys>/ folders NOT created
   until first doc inside authored.
7. **Standardize existing FEATURES/<feature>.md docs.** Add Player Beats
   sections + parseable `Systems touched:` lines per template (Rule 14).
8. **Resolve audit items from intake doc.** Deep-sky code audit;
   autopilot target audit; 18 planet types audit; Easter egg audit.
9. **Update CLAUDE.md** for v5 structure (v5-audit Gap P enumerates).
   Compact trigger index per Rule 13; target <120 lines. Per-section
   transformation:
   - **KEEP, shorter:** "Three-file orienting structure" → compress to
     "Session start" protocol (4 lines)
   - **KEEP, transform:** "Contextualize each feature" → compress to
     a one-paragraph principle; detail moves to
     `PROTOCOLS/doc-updates-on-ship.md`
   - **REMOVE:** "Game Bible anchoring" section entirely — Bible is
     archived per Rule 8 (don't drag old structures forward)
   - **MOVE:** "Inspection-layer-v2 is the testing roadmap" pointer →
     becomes `SYSTEMS/inspection-layer/ROADMAP.md` (authored when
     inspection-layer system gets its deep dive)
   - **KEEP:** sibling-project (well-dipper-visual) note as-is
   - **ADD:** trigger statements for Rules 3 / 7 / 8 / 11 / 12 / 14
     (~3 lines each), each linking to `PROTOCOLS/doc-updates-on-ship.md`
     section for detail
   - **ADD:** doc map reference (link to `docs/README.md`)
10. **Verify pre-push hook installed.** Run `bash scripts/install-hooks.sh`;
    confirm `.git/hooks/pre-push` exists; test with `git push --dry-run`.
11. **Update existing WORKSTREAMS/<slug>.md** to add `Scope:` frontmatter
    where applicable (active workstreams + the warp-landing-strip one
    awaiting Max UAT). Archive intake + design docs to ARCHIVE as
    `_LEGACY`.

## What the structure does NOT do

- **Cross-project sharing of doc patterns.** Out of scope.
- **Discord-relay surface representation.** Cross-project; lives in
  Claude memory.
- **Automated rendering-quality regression detection.** Perceptual;
  Max-eye job.

## Open uncertainties

- **High confidence:** decay-rate split, FEATURES.md authority schema,
  generator catalog template, Tester-PASS doc-update rule, rot-check
  pre-push trigger, dep-graph at planning time, strict 1-to-1 Module(s)
  ownership, link-not-paste memory rule, structured-fields-for-
  automation rule, orchestration via app-shell + meta flag.
- **Medium confidence:** PILLARS vs PLAYER_EXPERIENCE split, SYSTEMS.md
  flat-map sufficiency, --workstream filter precision (downstream-doc
  surface computation might miss subtle dependencies), CLAUDE.md
  staying under 120 lines as triggers accumulate over time.
- **Lower confidence:** whether per-system `CLAUDE.md` pays off,
  whether `changelog.md` gets maintained, whether pre-push rot warnings
  become friction-fatigue Max ignores, whether mood-promotion rot check
  catches the right citation pattern.
- Synthesis from research + intake. v6 expected as patterns prove or
  fail in practice.
