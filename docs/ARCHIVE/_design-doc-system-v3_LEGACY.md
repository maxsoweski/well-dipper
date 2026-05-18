# Design — Well Dipper doc system (v3)

**Status:** Design spec, awaiting Max approval before step 3 migration.
**Authors:** Max + working-Claude, 2026-05-18 session.
**Lifecycle:** Archive after migration is complete (becomes
`ARCHIVE/_design-doc-system-v3_LEGACY.md`).
**Reference material:** game-dev documentation conventions research
(in chat history, summarized inline); `docs/_intake-2026-05-18-max-feature-status.md`
(Max's verbatim feature audit); supersedes v2 at `docs/_design-doc-system-v2.md`.
**v3 vs v2 diff:** v3 closes the "what the structure does NOT do" gaps —
auto rot detection (pre-push hook), dependency graph generation
(consulted at feature-planning time), build/run/deploy doc, glossary,
UAT status rollup, mood/art reference folder.

## Purpose

Design a documentation system for Well Dipper that:

- Lets Max (Director / Team Lead / UAT) and Claude (Developer) stay
  coherent across sessions despite Claude having no persistent memory
- Answers the questions actually asked: "what's the F&F MVP status of
  feature X," "how do these systems wire together," "what does the
  player experience here," "what's the blast radius of refactoring Y"
- Honors decay rates (some things change rarely, some weekly, some
  per-session) and uses automation where hand-maintenance reliably rots
- Bears load Max named as missing from the current Game Bible: system
  wiring, pipelines, player-experience targets, Max-authoritative
  feature inventory

## Principles

1. **AI-collaborator-friendly across sessions.** Thin always-loaded
   root; everything else on demand.
2. **Max-authoritative feature truth.** Commit history is supporting
   evidence only. Max confirms "done."
3. **System wiring + pipelines as a first-class artifact.** The
   TDD-style content missing from current setup, per research.
4. **Player Beats per-feature with the "feel" half mandatory.** Per
   Keith's game-dev adaptation: "As a player, I want X *so I can
   feel Y*."
5. **Generator catalogs for procedural systems.** Per Caves of Qud:
   input space, grammar, output space, known dead-zones.
6. **Decay-rate split.** Vision rarely changes; system structure
   changes per-refactor; work-in-flight changes per-session.
7. **No empty folders.** A folder exists when a doc inside it
   justifies it. Missing-but-needed docs tracked in `JOURNEY.md`
   structural-debt section.
8. **Don't drag old structures forward.** Migration is fresh authoring
   informed by archived material — not transcription.
9. **Automate hand-maintenance that reliably rots.** Dependency graph,
   coverage checks, link integrity — generated, not hand-curated.
10. **Consult the dep graph at feature-planning time.** When PM scopes
    a workstream that changes a system, blast radius is visible before
    the work begins.

## Role coverage

| Role | Filled by | Primary docs | Decides |
|---|---|---|---|
| Director | Max | `HEART_OF_DESIRE.md`, `PILLARS.md`, `PLAYER_EXPERIENCE.md`, `JOURNEY.md`, `MOOD/` | scope, kill/keep, pillars match, path to heart |
| Team Lead | Max | `NOW.md`, `JOURNEY.md` current objective, `FEATURES.md`, `WORKSTREAMS/` index, UAT rollup output | next work, blockers, ship timing, friction |
| UAT | Max | `FEATURES/<feature>.md` Player Beats + ACs, `WORKSTREAMS/<active>.md` Tester verdicts, `PROTOCOLS/max-recording.md` | feature done?, shipped matches spec?, pass/fail |
| Developer | Claude | `SYSTEMS/<sys>/*`, `FEATURES/<feature>.md` context, `WORKSTREAMS/<active>.md` scope, `PILLARS.md` + `MOOD/` for taste, `PROTOCOLS/development.md` for build/deploy | implementation, refactor scope, when to ask |
| PM (subagent) | Claude subagent | `FEATURES.md`, `PILLARS.md`, `PLAYER_EXPERIENCE.md`, `SYSTEMS.md` (dep graph for blast radius); authors `WORKSTREAMS/<new>.md` | brief scope, ACs, citations, blast-radius surfacing |
| Tester (subagent) | Claude subagent | `WORKSTREAMS/<active>.md` ACs, `FEATURES/<feature>.md` Player Beats, recording artifact, `npm run doc-rot` output | PASS / FAIL / INSUFFICIENT (includes doc-coverage criterion) |

## Structure

```
~/projects/well-dipper/
  CLAUDE.md                          # auto-loaded; updated for v3 structure
  package.json                       # adds doc-rot, doc-graph, uat-status scripts
  
  scripts/
    doc-rot-check.sh                 # NEW — pre-push hook + manual command
    doc-graph.js                     # NEW — file→system mapping + graph gen
    uat-status.sh                    # NEW — UAT rollup digest
    mood-index-bootstrap.sh          # NEW — initial MOOD/README.md inventory from Pictures folder
    git-hooks/
      pre-push                       # NEW — runs doc-rot, warns on rot
    install-hooks.sh                 # NEW — one-time installer for git hooks
  
  docs/
    README.md                        # one-screen doc map
    
    # Orientation (decay-rate split)
    HEART_OF_DESIRE.md               # Director — WHY (rare)
    JOURNEY.md                       # Director + Team Lead — PATH + structural debt (~weekly)
    NOW.md                           # Team Lead — active + queued (per-session)
    
    # Game identity
    PILLARS.md                       # Director — WHAT this game IS (rare)
    PLAYER_EXPERIENCE.md             # Director + UAT — per-mode experience targets (medium)
    
    # Feature truth
    FEATURES.md                      # Team Lead — Max-authoritative flat inventory (per-ship)
    FEATURES/                        # UAT + Developer — per-feature deep dives
      <feature>.md                   #   (only created when content justifies it)
    
    # System truth
    SYSTEMS.md                       # Developer — flat wiring map + auto-generated graph
    SYSTEMS/                         # Developer — per-system deep dives
      <sys>/                         #   (only created when first doc inside is authored)
        README.md                    #   purpose · interface · wiring · history · open Qs · Modules:
        CLAUDE.md       (optional)   #   per-system instructions when conventions differ
        pipeline.md     (optional)   #   data/event flow when it matters
        generator.md    (optional)   #   procedural systems — 4-section template
        changelog.md                 #   what we tried, what we abandoned, what landed
        ROADMAP.md      (optional)   #   multi-phase plan (absorbs old PLAN_*.md)
    
    # Visual reference — index only, images stay in Pictures folder
    MOOD/
      README.md                      # index w/ annotated + unannotated sections
      .gitignore                     # excludes everything except README.md
                                     # (image files live at
                                     #  /mnt/c/Users/Max/Pictures/well-dipper/
                                     #  — 126 files, 249 MB, not committed)
    
    # Work in flight
    WORKSTREAMS/                     # PM/Tester/Team Lead (existing)
    
    # Process
    PERSONAS/                        # PM, Tester, Game-Dev (existing, symlinked)
    PROTOCOLS/                       # NEW folder
      max-recording.md               # was MAX_RECORDING_PROTOCOL.md
      shipped-gate.md                # VERIFIED_PENDING_MAX → Shipped flow
      three-max-gate.md              # GATE 1/2/3 review pattern
      doc-updates-on-ship.md         # codifies Rule 3
      development.md                 # NEW — build/run/deploy reference
      glossary.md                    # NEW — project-specific terminology
    
    # Archaeology
    ARCHIVE/                         # NEW folder — Bible, FEATURE_AUDIT, PLAN_*, etc.
```

## Per-file specifications

### `CLAUDE.md` (project root)

Auto-loads `HEART_OF_DESIRE.md` + `JOURNEY.md` current-objective section
+ `NOW.md` at session start. Carries:
- Tester-PASS-on-Shipped doc-update rule (Rule 3)
- Feature-planning trigger that consults dep graph (Rule 7)
- Reference to doc map at `docs/README.md`

### `docs/README.md`

One screen. Lists every top-level doc with one-line purpose + decay rate
+ primary audience role. Entry point for new sessions.

### `docs/HEART_OF_DESIRE.md`

**Already exists.** No structural change. Why this game exists.
Decay: rare.

### `docs/JOURNEY.md`

**Already exists. Adds "Doc system completion" section** for tracking
missing-but-needed docs (audit fix from v2). Combined-doc rationale:
v1 holds milestones + structural debt; split if debt grows past ~20
items.

Decay: weekly.

### `docs/NOW.md`

**Already exists.** No structural change. Active + queued + recently
shipped + deferred.

Decay: per-session.

### `docs/PILLARS.md`

**New.** Genre, pillars, aesthetic, key fictions (lore), what this
game is NOT. Links to `MOOD/` for visual references.

Template:

```markdown
# Pillars — Well Dipper

## Genre / shape
## Pillars
1. **[Pillar name]** — [what it means; what it rules in/out]
## Aesthetic
[CRT / retro UI / palette / sound character. References at MOOD/]
## Key fictions
[Diegetic claims — ship size, propulsion lore, what nebulas are
in-fiction. Where Bible §15 narrative content folds in.]
## What this game is NOT
[Explicit anti-scope.]
```

Decay: rare.

### `docs/PLAYER_EXPERIENCE.md`

**New.** Per-mode experience targets across SCREENSAVER / ENRICHED /
GAME tiers. Each tier has Target experience + Anti-experience.

**Bound to Tester PASS-on-Shipped ritual (Rule 3)** — if shipped
experience differs from spec, spec gets updated or divergence flagged.

Decay: medium.

### `docs/FEATURES.md`

**New.** Max-authoritative flat inventory.

Status schema:
- `shipped-confirmed` — Max UAT pass; in production
- `shipped-code` — code in main; not Max-confirmed
- `verified-pending-max` — Tester PASS; awaiting Max UAT
- `in-flight` — active workstream
- `scoped` — PM brief exists, not started
- `proposed` — surfaced, unscoped
- `parked` — explicitly deferred (link to reason)
- `dead` — used to exist, removed (link to history)

Tier schema: `F&F-MVP`, `ENRICHED`, `GAME`, `unsure`.

Columns: Feature | Tier | Status | Blocks | Blocked by | Deep dive

**Authority header** declares Max as source of truth; commit history is
supporting evidence only.

**Cross-cutting status notes** at header capture project-wide truths
(all renderings placeholder, all SFX placeholder, etc.) so individual
rows don't repeat.

Decay: per-shipment.

### `docs/FEATURES/<feature>.md`

**New template, existing folder.** Per-feature deep dives.

Sections: Purpose, Player Beats (per tier, mandatory "so I can feel Y"),
Current state, Open questions, Systems touched.

Every Player Beat has at least one observable acceptance criterion.

Authored only when content beyond the FEATURES.md row justifies it.

Decay: medium.

### `docs/SYSTEMS.md`

**New.** Flat wiring map + auto-generated system-of-systems diagram +
auto-generated Calls/Called by columns (per Rule 9).

Template:

```markdown
# Systems — Well Dipper

## System-of-systems diagram
<!-- AUTO-GENERATED: graph (npm run doc-graph) -->
[mermaid or ASCII diagram regenerated from import graph + file→system mapping]
<!-- /AUTO-GENERATED -->

## Systems
<!-- AUTO-GENERATED: table (npm run doc-graph) -->
| System | Purpose | Calls | Called by | Has deep dive |
|---|---|---|---|---|
| ... | | | | |
<!-- /AUTO-GENERATED -->

## Manual overlays
[Hand-curated notes that don't belong in the auto-generated regions —
e.g., "Inspection layer intentionally has no callers in production
paths; only invoked via __wd.* debug API."]
```

Auto-generated regions regenerated by `npm run doc-graph`. Manual
overlays preserved.

Decay: per-refactor (auto-regenerated).

### `docs/SYSTEMS/<sys>/README.md`

**New template, new folder per system.** Per-system deep dive.

Sections: Purpose, Module(s), Tier(s) served, Interface (Triggers /
Inputs / Outputs / State), Wiring (Calls into / Called by / Reads /
Writes), History, Open questions.

**`Module(s):` line is structured** — drives the file→system mapping
that `doc-graph.js` consumes:

```markdown
## Module(s)
- `src/effects/WarpEffect.js`
- `src/effects/WarpPortal.js`
- `src/rendering/RetroRenderer.js` (hyperspace() method only)
```

### `docs/SYSTEMS/<sys>/CLAUDE.md` (optional)

**New, optional.** Per-system instructions for systems where
conventions differ from root CLAUDE.md. Auto-loaded when working in
the system's directory.

### `docs/SYSTEMS/<sys>/pipeline.md` (optional)

**New, optional.** Sequence diagrams / step-by-step flow for systems
where order is load-bearing.

### `docs/SYSTEMS/<sys>/generator.md` (optional)

**New, optional. Mandatory 4-section template** for procedural
systems: Input space, Grammar/rules, Output space, Known dead-zones.

### `docs/SYSTEMS/<sys>/changelog.md`

**New. First-class "what we tried, what we abandoned, what landed"** —
addresses Sweatman's "doesn't allow for failure" GDD critique.

Template per entry:
```markdown
## YYYY-MM-DD — [decision or attempt name]
**Tried:** [what]
**Outcome:** [worked / abandoned / partial]
**Why abandoned:** [failure mode, if applicable]
**What landed:** [current state]
**Reference:** [workstream link, commit, memory file]
```

### `docs/SYSTEMS/<sys>/ROADMAP.md` (optional)

**New, optional.** Multi-phase plans for systems undergoing substantial
work. Absorbs content from archived `PLAN_*.md` (fresh authoring, not
transcription).

### `docs/MOOD/` (new — references Max's existing mood/art folder)

**New folder.** Visual references for aesthetic decisions. Director +
Developer audience.

**Existing mood corpus:** `/mnt/c/Users/Max/Pictures/well-dipper/`
(Windows-side Pictures folder; ~126 files, ~249 MB, mostly PNG/WEBP/JPG
plus 2 MP4s; includes subfolders `screenshots/` and `galaxy-debug/`).

**Files stay where they are; only the index lives in the repo.**
Rationale:
- 249 MB of mood images would bloat the git repo and clone time
- Binary churn doesn't deserve git history
- The Windows Pictures path is where Max naturally drops new
  references (drag from browser, screenshot, etc.) — keeping them
  there preserves his existing workflow

**Structure:**
```
docs/MOOD/
  README.md                # the index — lives in repo, committed
  .gitignore               # excludes everything except README.md
                           # (defensive — in case files get dropped here later)
```

The actual image/video files at
`/mnt/c/Users/Max/Pictures/well-dipper/` are referenced by the index
via Windows path. Inline markdown image embeds (`![](file://...)`) work
in Obsidian and many markdown previewers but not on github.com — that's
acceptable; this is a working doc, not a public artifact.

**`README.md` template:**

```markdown
# Mood — Well Dipper

Visual references for aesthetic decisions. Cross-linked from
`PILLARS.md` Aesthetic section, and from per-feature/per-system docs
where a specific reference applies.

**Image files:** `/mnt/c/Users/Max/Pictures/well-dipper/`
(Windows-side Pictures folder, not committed to repo per .gitignore).

## How this index works

- **Annotated** entries have caption + "what it references" + cited-by
  links. These are the references actively used in design decisions.
- **Unannotated** entries are bootstrapped from filenames at index
  creation; they're inventory, not citation. Promote to annotated when
  they get referenced from a feature or system.

## Annotated references

### blade-runner-concept-art-syd-mead-1981-...webp
- **References:** UI / HUD aesthetic — Syd Mead retrofuturism
- **Cited by:** `PILLARS.md` (Aesthetic section)
- **Added:** 2026-03-14

### 02_Star_Fox_64_Lylat_Map.webp
- **References:** nav computer map aesthetic — low-poly readable
  galactic overview
- **Cited by:** `FEATURES/nav-computer.md` (when authored)
- **Added:** 2026-03-19

### did-star-fox-64-always-have-this-static-effect...webp
- **References:** CRT static / scanline character target
- **Cited by:** `PILLARS.md` (Aesthetic section)
- **Added:** 2026-03-18

[... more as cited from features/systems ...]

## Unannotated inventory (126 files at migration time)

Subfolder: `screenshots/` — [count] files
Subfolder: `galaxy-debug/` — [count] files

Root-level files (unannotated):
- `00e81cf5-60d6-4685-b174-82c0975bc5ef_1184x864.jpg` (added 2026-03-07)
- `1743701570327872.jpg` (added 2025-05-11)
- `1773558657457306.jpg` (added 2026-03-15)
- [... rest ...]
```

**Bootstrap script (migration helper):** `scripts/mood-index-bootstrap.sh`
reads the Pictures folder, generates the initial unannotated inventory
section of `MOOD/README.md` with filenames + add-dates from file mtime.
Annotation happens progressively, not as a big-bang at migration.

**Annotation trigger:** when a feature or system doc cites a mood
reference, the cited image migrates from "Unannotated inventory" to
"Annotated references" with caption + cited-by link.

### `docs/WORKSTREAMS/` (existing)

**No structural change.** PM-authored briefs, Tester verdicts,
Status: lines. Tooling preserved.

### `docs/PERSONAS/` (existing)

**Path preserved** to avoid breaking `~/.claude/agents/<persona>.md`
symlinks.

### `docs/PROTOCOLS/` (new)

**New folder.** Process protocols.

Files on migration:
- `max-recording.md` — was `MAX_RECORDING_PROTOCOL.md`
- `shipped-gate.md` — codifies VERIFIED_PENDING_MAX → Shipped flow
- `three-max-gate.md` — codifies GATE 1/2/3 review pattern
- `doc-updates-on-ship.md` — codifies Rule 3 (Tester PASS triggers doc updates)
- `development.md` — **NEW** — build/run/deploy reference (G3)
- `glossary.md` — **NEW** — project-specific terminology (G4)

### `docs/PROTOCOLS/development.md` (G3)

**New.** Build/run/deploy reference. The doc a new collaborator (or
fresh Claude session needing to do deploy work) needs.

Template:

```markdown
# Development — Well Dipper

## Stack
Vite + Three.js + custom GLSL shaders.

## Dev server
[Exact command, terminal, expected URL]

## Build
[Exact command, output location]

## Deploy
[Current hosting (GitHub Pages); planned hosting (easymaking).
Exact deploy command, where to push, how to verify deploy succeeded.]

## Common dev workflows
[Running tests, viewing in chrome-devtools on port 9223, etc.]

## Troubleshooting
[Vite WSL2 stale module cache fix, etc.]
```

### `docs/PROTOCOLS/glossary.md` (G4)

**New.** Project-specific terminology.

Template:

```markdown
# Glossary — Well Dipper

## In-fiction terms (lore — see also PILLARS.md Key Fictions)
- **Hyperspace** — diegetic name for the warp tunnel mechanism. See FEATURES/warp.md.
- **Deep sky** — DEPRECATED in-game gameplay term (see "Deep sky" below for current meaning).
- ...

## Technical / dev terms
- **OOI** — Object Of Interest. The targetable-body abstraction.
- **Burn to body** — autopilot mode that accelerates camera toward selected body.
- **Screensaver mode** — the F&F MVP target deliverable; passive observation.
- **Tier** — SCREENSAVER / ENRICHED / GAME — see `PLAYER_EXPERIENCE.md`.
- **Deep sky** — historical first-month gameplay term (dice-roll arrivals).
  Now refers only to the rendering pipeline for title screen + debug gallery.
  See `SYSTEMS/deep-sky-rendering/README.md` History.
- ...
```

### `docs/ARCHIVE/` (new)

**New folder.** Archaeology — originals preserved, content distributes.

Initial contents on migration:
- `GAME_BIBLE_LEGACY.md` (untouched)
- `FEATURE_AUDIT_LEGACY.md`
- `MVP_SYSTEMS_REVIEW_2026-03-30_LEGACY.md`
- `PLAN_world-origin-rebasing_LEGACY.md`
- `PLAN_inspection-layer-v2_LEGACY.md`
- (other `PLAN_*.md` as identified)
- `_design-doc-system-v2_LEGACY.md` (this doc's predecessor)

After step 3 completes, this design doc joins archive as
`_design-doc-system-v3_LEGACY.md`.

## Automation — scripts/

### `scripts/doc-rot-check.sh` (G1)

**New.** Auto rot detection. Runs on every push via git pre-push hook
+ available as `npm run doc-rot` for manual ad-hoc runs.

**Checks:**

| Check | Flags |
|---|---|
| Stale deep dives | `FEATURES/<X>.md` last-modified >30 days older than most recent commit touching files claimed by that feature's systems |
| Unclaimed source files | `src/**/*.js` not appearing in any `SYSTEMS/<sys>/README.md` Module(s) line |
| Broken doc references | Markdown links in `docs/` that don't resolve |
| Status-stuck features | `FEATURES.md` rows in `in-flight` >14 days without recent Tester verdict |
| Confirmation lag | `FEATURES.md` rows in `shipped-code` >7 days without `shipped-confirmed` transition |
| System-doc absence | `SYSTEMS.md` rows marked "no doc yet" not appearing in JOURNEY structural-debt with rationale |

**Output:** writes report to `~/briefings/well-dipper-doc-rot-<sha>.md`.

**Push behavior:** warns loudly on rot but DOES NOT block the push by
default. Configurable to hard-block via env var
`WELL_DIPPER_DOC_ROT_BLOCK=true`. Rationale: noisy gate that blocks
common operations gets bypassed; loud warning + briefing trail catches
drift without friction.

**Discord push:** only if NEW rot since last run crossed severity
threshold (per `feedback_discord-push-exception-only.md`).

### `scripts/doc-graph.js` (G2)

**New.** Dependency graph generation.

**Approach:**
1. Use `madge` (existing Node tool) to parse ES module import graph
   from `src/**/*.js`
2. Read file→system mapping from `Module(s):` sections in every
   `SYSTEMS/<sys>/README.md`
3. Join: file imports A → system mapping → system X calls system Y
4. Write the system-of-systems diagram + Calls/Called by columns back
   into `SYSTEMS.md` between `<!-- AUTO-GENERATED -->` markers

**Trigger:**
- Run via `npm run doc-graph` on demand
- **Consulted at feature-planning time (Rule 7)** — when PM scopes a
  workstream that changes a system, `npm run doc-graph` runs first,
  then PM consults SYSTEMS.md for blast radius (who depends on what
  we're changing)
- NOT regenerated on every commit — only when planning or when
  SYSTEMS.md content is manually edited

**Honest limits:**
- Works for static ES imports; flags dynamic `import()` calls as
  uncertain edges
- File→system mapping is hand-maintained; if mapping rots, graph rots.
  `doc-rot-check.sh` catches unclaimed files as an early-warning signal.
- A "system" isn't always 1:1 with a file. Mapping handles many-to-many
  but introduces ambiguity when files cross system boundaries.

### `scripts/uat-status.sh` (G6)

**New.** UAT status rollup digest.

Queries `FEATURES.md` for rows in `verified-pending-max` and
`shipped-code` status. Outputs:

```
=== UAT Status — Well Dipper — <date> ===

WAITING ON MAX UAT (verified-pending-max):
- <feature> | <workstream link> | Tester PASS on <sha> at <date>

SHIPPED-CODE PENDING CONFIRMATION (shipped-code):
- <feature> | shipped <date> | <days since> days without UAT
```

**Trigger:** ad-hoc via `npm run uat-status`. Useful when Max sits down
to do UAT batch.

### `scripts/mood-index-bootstrap.sh` (G7 migration helper)

**New.** One-time bootstrap that reads
`/mnt/c/Users/Max/Pictures/well-dipper/` and generates the initial
unannotated inventory section of `docs/MOOD/README.md`.

Output per file: filename + add-date (from mtime). Subfolders
(`screenshots/`, `galaxy-debug/`) get their own sections.

Idempotent — re-running adds new files without disturbing manual
annotations.

### `scripts/git-hooks/pre-push` + `scripts/install-hooks.sh`

**New.** Pre-push hook that runs `doc-rot-check.sh`. Installer is a
one-time setup (`bash scripts/install-hooks.sh`) that copies the hook
into `.git/hooks/pre-push`.

Why installer rather than direct repo hook: git doesn't auto-install
hooks from repo contents; installer is the standard workaround.

## Rules

### Rule 1 — No empty folders
Folders exist when a doc inside justifies them. Missing tracked in
JOURNEY structural-debt.

### Rule 2 — Don't drag old structures forward
Migration is fresh authoring informed by archived material — not
transcription.

### Rule 3 — Tester PASS-on-Shipped triggers doc updates
Before Shipped flip, working-Claude updates:
- `FEATURES.md` row status (always)
- `PLAYER_EXPERIENCE.md` (if shipped experience differs from spec)
- `SYSTEMS/<sys>/README.md` (if wiring/interface changed)
- `SYSTEMS/<sys>/changelog.md` (if approach was tried-and-abandoned)

Tester's PASS criterion includes doc coverage. Doc gap = FAIL.

### Rule 4 — FEATURES.md authority
Max-authoritative. Status schema distinguishes `shipped-code` (in main,
unconfirmed) from `shipped-confirmed` (Max UAT pass).

### Rule 5 — Player Beats require "so I can feel Y"
Every Player Beat uses Keith form. "So I can feel Y" mandatory; if
genuinely no felt outcome (pure infra feature), say so explicitly.
Every beat has at least one observable AC.

### Rule 6 — Generator docs use 4-section template
Input space, Grammar/rules, Output space, Known dead-zones.

### Rule 7 — Consult dep graph at feature-planning time (NEW)
When PM scopes a workstream that changes a system:
1. Working-Claude runs `npm run doc-graph` to refresh
2. PM consults SYSTEMS.md "Called by" + "Depended on by" columns for
   the system being changed
3. Brief includes a "Blast radius" section listing systems/features
   downstream of the change

PM persona doc (`PERSONAS/pm.md`) updated to reflect this trigger.

### Rule 8 — Pre-push rot check (NEW)
`scripts/doc-rot-check.sh` runs on every `git push` via pre-push hook.
Warns loudly on rot; does not block push by default. Writes report to
`~/briefings/`. Discord push only on severity threshold.

### Rule 9 — Auto-generated regions in SYSTEMS.md (NEW)
SYSTEMS.md graph + Calls/Called by are auto-generated between
`<!-- AUTO-GENERATED -->` markers by `npm run doc-graph`. Manual edits
inside those markers are overwritten. Manual content goes outside the
markers in a "Manual overlays" section.

## Decisions made (carried from v2)

- **Lore (Bible §15):** fold into `PILLARS.md` Key Fictions section.
  Promote to standalone `LORE.md` only if lore starts shipping in-game.
- **PERSONAS folder:** keep at `docs/PERSONAS/` to preserve symlinks.
- **PLAN_*.md disposition:** all archive on migration. ROADMAP authored
  fresh per-system when needed.
- **Bible §14 Open Questions:** distribute by topic.
- **JOURNEY combined-doc:** v1 holds milestones + structural debt
  together; split if debt > ~20 items.

## Migration approach (sketch — full plan is step 3 deliverable)

High-level sequence:

1. **Archive infrastructure.** Create `ARCHIVE/`; move Bible, FEATURE_AUDIT,
   MVP_SYSTEMS_REVIEW, PLAN_* with `_LEGACY` suffix.
2. **Author thin v3 infrastructure.** `README.md`, `PILLARS.md`,
   `PLAYER_EXPERIENCE.md` skeletons + `PROTOCOLS/` folder + relocated
   `max-recording.md` + new `development.md` + new `glossary.md` + new
   `doc-updates-on-ship.md` + `shipped-gate.md` + `three-max-gate.md`.
3. **Author scripts.** `scripts/doc-rot-check.sh`, `scripts/doc-graph.js`,
   `scripts/uat-status.sh`, `scripts/git-hooks/pre-push`,
   `scripts/install-hooks.sh`. Add npm scripts to `package.json`.
   Install madge as devDependency. Run `bash scripts/install-hooks.sh`
   to wire pre-push hook.
4. **Wire up MOOD index.** Max's existing mood/art corpus stays at
   `/mnt/c/Users/Max/Pictures/well-dipper/` (~126 files, 249 MB —
   not committed). Create `docs/MOOD/README.md` + `.gitignore`;
   run `scripts/mood-index-bootstrap.sh` to generate initial
   unannotated inventory; link from `PILLARS.md` Aesthetic section.
   Annotation happens progressively as features cite specific
   references.
5. **Author FEATURES.md with Max.** Dedicated session. Max-authoritative
   judgment on every row, informed by intake + archived FEATURE_AUDIT.
   Highest-effort single step.
6. **Author SYSTEMS.md flat map.** Working-Claude drafts the manual
   sections + initial flat row list. Run `npm run doc-graph` to populate
   auto-generated regions. SYSTEMS/<sys>/ folders NOT created — only
   when first doc inside is authored.
7. **Standardize existing FEATURES/<feature>.md docs.** Add Player Beats
   sections per template.
8. **Resolve audit items from intake doc.** Deep-sky code audit;
   autopilot target audit; 18 planet types audit; Easter egg audit.
   Results land in FEATURES.md / SYSTEMS/<sys>/README.md.
9. **Update CLAUDE.md** for v3 structure. Session-start protocol +
   Rules 3 / 7 / 8 / 9 encoded.
10. **Update PM persona** (`docs/PERSONAS/pm.md`) for Rule 7.
11. **Archive intake + design docs.** Both join ARCHIVE as `_LEGACY`.

Full migration map (per-file: what goes where, transforms applied,
archive paths) is step 3 deliverable.

## What the structure does NOT do (substantially reduced from v2)

- **Cross-project sharing of doc patterns.** This design is well-
  dipper-specific. If patterns prove out over months, may be worth
  generalizing, but not in scope.
- **Discord-relay surface representation.** Cross-project infrastructure
  lives in Claude memory.
- **Automated rendering-quality regression detection.** Visual quality
  drift (the "all renderings placeholder" problem) is inherently
  perceptual — no script catches "this nebula now looks worse than
  last week." Stays a Max-eye job.

Previously listed (now closed):
- ~~Auto rot detection~~ → `scripts/doc-rot-check.sh` (Rule 8, pre-push hook)
- ~~Dependency graph generation~~ → `scripts/doc-graph.js` (Rule 7, planning-time)
- ~~Structured UAT log~~ → `scripts/uat-status.sh` (G6)
- ~~Glossary~~ → `PROTOCOLS/glossary.md` (G4)
- ~~Build/run/deploy reference~~ → `PROTOCOLS/development.md` (G3)
- ~~Mood/art reference repository~~ → `docs/MOOD/` (G7, Max-pointed)

## Open uncertainties (Claude's confidence calibration)

- **High confidence:** decay-rate split, FEATURES.md authority schema,
  generator catalog template, Tester-PASS doc-update rule, rot-check
  trigger on every push, dep-graph consulted at planning time.
- **Medium confidence:** PILLARS vs PLAYER_EXPERIENCE split (could be
  one doc), SYSTEMS.md flat-map sufficiency without per-system one-pagers,
  doc-graph file→system mapping handling many-to-many systems cleanly.
- **Lower confidence:** whether per-system `CLAUDE.md` actually pays off
  in practice (untested pattern), whether `changelog.md` as
  "what we tried" gets maintained or rots, whether the pre-push rot
  warning becomes friction-fatigue that Max ignores.
- This design is synthesis from research + intake, not a copy of a
  proven pattern. A year from now we may discover a structural choice
  doesn't fit — design v4 expected.
