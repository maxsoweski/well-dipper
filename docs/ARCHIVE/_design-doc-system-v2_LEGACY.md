# Design — Well Dipper doc system (v2)

**Status:** Design spec, awaiting Max approval before step 3 migration.
**Authors:** Max + working-Claude, 2026-05-18 session.
**Lifecycle:** Archive after migration is complete (becomes
`ARCHIVE/_design-doc-system-v2_LEGACY.md`).
**Reference material:** game-dev documentation conventions research
(in chat history, summarized below); `docs/_intake-2026-05-18-max-feature-status.md`
(Max's verbatim feature audit).

## Purpose

Design a documentation system for Well Dipper that:

- Lets Max (Director / Team Lead / UAT) and Claude (Developer) stay
  coherent across sessions despite Claude having no persistent memory
- Answers the questions actually asked: "what's the F&F MVP status of
  feature X," "how do these systems wire together," "what does the
  player experience here"
- Honors decay rates (some things change rarely, some weekly, some
  per-session)
- Bears load Max named as missing from the current Game Bible: system
  wiring, pipelines, player-experience targets, Max-authoritative
  feature inventory

## Principles

1. **AI-collaborator-friendly across sessions.** Thin always-loaded
   root; everything else on demand. (zazencodes / Anthropic-eng pattern.)
2. **Max-authoritative feature truth.** Commit history is supporting
   evidence only. Max confirms "done."
3. **System wiring + pipelines as a first-class artifact.** This is
   the TDD-style content missing from current setup, per research.
4. **Player Beats per-feature with the "feel" half mandatory.** Per
   Clinton Keith's game-dev adaptation of user stories: "As a player,
   I want X *so I can feel Y*." The felt half distinguishes from
   enterprise software stories.
5. **Generator catalogs for procedural systems.** Per Caves of Qud
   pattern: document input space, grammar, output space, known
   dead-zones.
6. **Decay-rate split.** Vision rarely changes; system structure
   changes per-refactor; work-in-flight changes per-session. Co-locating
   different decay rates causes drift.
7. **No empty folders.** A folder exists when a doc inside it justifies
   it. Missing-but-needed docs are tracked at JOURNEY altitude as
   structural debt.
8. **Don't drag old structures forward.** Migration is fresh authoring
   informed by archived material — not transcription of old structure
   into new files.

## Role coverage

| Role | Filled by | Primary docs | Decides |
|---|---|---|---|
| Director | Max | `HEART_OF_DESIRE.md`, `PILLARS.md`, `PLAYER_EXPERIENCE.md`, `JOURNEY.md` | scope, kill/keep, pillars match, path to heart |
| Team Lead | Max | `NOW.md`, `JOURNEY.md` current objective, `FEATURES.md`, `WORKSTREAMS/` index | next work, blockers, ship timing, friction |
| UAT | Max | `FEATURES/<feature>.md` Player Beats + ACs, `WORKSTREAMS/<active>.md` Tester verdicts, `PROTOCOLS/max-recording.md` | feature done?, shipped matches spec?, pass/fail |
| Developer | Claude | `SYSTEMS/<sys>/*`, `FEATURES/<feature>.md` context, `WORKSTREAMS/<active>.md` scope, `PILLARS.md` for taste | implementation, refactor scope, when to ask |
| PM (subagent) | Claude subagent | `FEATURES.md`, `PILLARS.md`, `PLAYER_EXPERIENCE.md`; authors `WORKSTREAMS/<new>.md` | brief scope, ACs, citations |
| Tester (subagent) | Claude subagent | `WORKSTREAMS/<active>.md` ACs, `FEATURES/<feature>.md` Player Beats, recording artifact | PASS / FAIL / INSUFFICIENT |

## Structure

```
~/projects/well-dipper/
  CLAUDE.md                          # auto-loaded; updated for v2 structure
  
  docs/
    README.md                        # one-screen doc map
    
    HEART_OF_DESIRE.md               # Director — WHY (rare decay)
    JOURNEY.md                       # Director + Team Lead — PATH + structural debt (~weekly)
    NOW.md                           # Team Lead — active + queued (per-session)
    
    PILLARS.md                       # Director — WHAT this game IS (rare)
    PLAYER_EXPERIENCE.md             # Director + UAT — per-mode experience targets (medium)
    
    FEATURES.md                      # Team Lead — Max-authoritative flat inventory (per-ship)
    FEATURES/                        # UAT + Developer — per-feature deep dives
      <feature>.md                   #   (only created when content justifies it)
    
    SYSTEMS.md                       # Developer — flat wiring map w/ system-of-systems diagram
    SYSTEMS/                         # Developer — per-system deep dives
      <sys>/                         #   (only created when first doc inside is authored)
        README.md                    #   purpose · interface · wiring · history · open Qs
        CLAUDE.md       (optional)   #   per-system instructions when conventions differ from root
        pipeline.md     (optional)   #   data/event flow when it matters
        generator.md    (optional)   #   for procedural systems
        changelog.md                 #   what we tried, what landed, what we abandoned
        ROADMAP.md      (optional)   #   multi-phase plan, absorbs old PLAN_*.md content
    
    WORKSTREAMS/                     # PM/Tester/Team Lead — briefs + verdicts (existing)
    PERSONAS/                        # process — PM, Tester, Game-Dev (existing, symlinked)
    PROTOCOLS/                       # process — max-recording, shipped-gate, three-max-gate (new)
    ARCHIVE/                         # archaeology — Bible, FEATURE_AUDIT, PLAN_*, MVP_SYSTEMS_REVIEW (new)
```

## Per-file specifications

### `CLAUDE.md` (project root)

Updated for v2. Auto-loads `HEART_OF_DESIRE.md` + `JOURNEY.md` (current
objective section) + `NOW.md` at session start. References the doc map.
Carries Tester-PASS-on-Shipped doc-update rule (below).

### `docs/README.md`

One screen. Lists every top-level doc with one-line purpose + decay rate
+ primary audience role. New collaborators (or new Claude session)
finds their way from here.

### `docs/HEART_OF_DESIRE.md`

**Already exists.** No structural change.

Why this game exists at all — agentic dev practice meta-purpose +
screensaver→game product arc. Decay: rare.

### `docs/JOURNEY.md`

**Already exists. Adds new section: "Doc system completion."**

Current shape (heart-of-desire-anchored milestones at 35/60/85/100%)
preserved. New section added at bottom listing every missing-but-needed
doc with: what's needed, why not authored yet (lazy/blocked/unscoped),
dependency if blocked, target trigger to fill.

**Combined-doc rationale:** structural debt tracking and product
milestones coexist here for v1. If structural debt grows past ~20 items
or starts churning, split to standalone `STRUCTURAL_DEBT.md`.

Decay: weekly.

### `docs/NOW.md`

**Already exists.** No structural change.

One screen: active workstream + next 1-3 queued + recently shipped +
deferred. Decay: per-session.

### `docs/PILLARS.md`

**New.** Distilled from Bible §1-2 (game identity sections).

Template:

```markdown
# Pillars — Well Dipper

## Genre / shape
[One paragraph: what kind of game this is. Retro space screensaver
becoming a slow exploration game. Procedurally generated Milky Way.
Etc.]

## Pillars
[3-5 named design pillars — the things that, if violated, this isn't
the same game anymore.]

1. **[Pillar name]** — [what it means; what it rules in/out]
2. ...

## Aesthetic
[CRT / retro UI / palette / sound character. Reference images if
worth it.]

## Key fictions
[The diegetic claims the game makes — ship is house-sized, propulsion
lore, what nebulas are in-fiction, etc. Distinct from systems; this is
"what does the game say is true."]

## What this game is NOT
[Explicit anti-scope. Helps Director say "no" cleanly.]
```

Decay: rare (months/years).

### `docs/PLAYER_EXPERIENCE.md`

**New.** Per-mode experience targets across SCREENSAVER / ENRICHED /
GAME tiers.

Template:

```markdown
# Player Experience — Well Dipper

## SCREENSAVER mode
**Frame:** Viewer, not player. Passive observation.

**Target experience:**
- [Felt outcome — "what should the viewer feel watching for 90 seconds"]
- [Quality bar — "what would make Max proud to leave running on a second monitor"]

**Anti-experience:**
- [Things the viewer should NEVER feel — "catalog of defects," "abrupt jank"]

## ENRICHED mode
[Same structure, but for the depth-additive tier]

## GAME mode
[Same structure, for the playable tier]
```

**Doom-Bible-risk mitigation:** this doc is the highest-drift-risk in
the system because shipped experience evolves through implementation.
Bound to Tester PASS-on-Shipped ritual (see Rules below) — when a
feature ships and the shipped experience differs from the spec, update
the spec or explicitly mark sections "spec aspirational, shipped reality
diverges in <ways>."

Decay: medium.

### `docs/FEATURES.md`

**New.** Max-authoritative flat inventory. The doc Team Lead consults
most often.

Template (header + flat rows):

```markdown
# Features — Well Dipper

**Authority:** Max. Working-Claude proposes status updates;
Max confirms. Commit history is supporting evidence only, not
authority.

**Cross-cutting status notes:**
- All visual renderings are currently placeholder quality. Universal
  polish pass needed before F&F MVP. Not tracked per-row.
- All SFX are placeholders (clipping/pitch-shifting title theme).
  Replacement needed before F&F MVP.
- All music tracks except [shipped ones] are placeholders.

**Status schema:**
- `shipped-confirmed` — Max has UAT'd; matches spec; in production
- `shipped-code` — code is in main; Max has not UAT-confirmed
- `verified-pending-max` — Tester PASSed, awaiting Max UAT
- `in-flight` — active workstream
- `scoped` — PM brief exists, not started
- `proposed` — surfaced but unscoped
- `parked` — explicitly deferred (link to reason)
- `dead` — used to exist, removed (link to history)

**Tier schema:** `F&F-MVP` (must ship before F&F), `ENRICHED`,
`GAME`, `unsure` (needs disposition).

---

## Features

| Feature | Tier | Status | Blocks | Blocked by | Deep dive |
|---|---|---|---|---|---|
| Warp opening | F&F-MVP | in-flight | — | — | FEATURES/warp.md |
| Warp tunnel | F&F-MVP | in-flight | — | — | FEATURES/warp.md |
| ... | | | | | |
```

**On the "shipped-code vs shipped-confirmed" split:** this is the
direct answer to your "shipped commit ≠ feature done" correction.
Status `shipped-code` is visible-but-unconfirmed; status
`shipped-confirmed` requires Max UAT pass. The gap is structurally
visible.

Decay: per-shipment.

### `docs/FEATURES/<feature>.md`

**New template (existing folder).** Per-feature deep dives. Authored
when content justifies — not every row in FEATURES.md needs a deep
dive.

Template:

```markdown
# <Feature name>

**Status:** [link to FEATURES.md row]
**Tier:** [F&F-MVP / ENRICHED / GAME / unsure]
**Systems touched:** [list of SYSTEMS/<sys>/ links]

## Purpose
[1-2 paragraphs: what this feature is, why it exists in the game]

## Player Beats

### SCREENSAVER tier (if applicable — frame as viewer beats)
- As a viewer, I want [X] so I can feel [Y].
  - **Acceptance criterion:** [observable, pass/fail-able]

### ENRICHED tier (if applicable)
- As a player, I want [X] so I can feel [Y].
  - **Acceptance criterion:** [observable, pass/fail-able]

### GAME tier (if applicable)
- As a player, I want [X] so I can feel [Y].
  - **Acceptance criterion:** [observable, pass/fail-able]

## Current state (notes)
[Free-form: what's working, what's not, known defects, recent
workstream pointers]

## Open questions
[Things to resolve before this feature can be considered done]
```

**Mandatory "so I can feel Y" half:** per Keith's game-dev adaptation,
the felt/motivational half is the distinguishing feature of game-dev
user stories. Without it, beats degenerate into feature checklists. If
the "feel" half is genuinely "nothing" (e.g., a pure infrastructure
feature with no player-facing surface), say so explicitly — don't
omit the half.

**Every Player Beat has at least one observable acceptance criterion.**
This is the Tester's verification surface. "Acceleration feels kinetic"
is not pass/fail-able on its own; "within 0.4s of warp engaging, the
forward velocity multiplier exceeds 50x" is.

Decay: medium (changes when vision/spec evolves).

### `docs/SYSTEMS.md`

**New.** Flat wiring map of every system. Developer's primary reference.

Template:

```markdown
# Systems — Well Dipper

## System-of-systems diagram

```
[ASCII or mermaid diagram showing major systems + call/data graph.
This is the Librande one-pager view — the relationship picture that
flat per-system docs lose.]
```

## Systems

| System | Purpose | Calls | Called by | Has deep dive |
|---|---|---|---|---|
| Warp / Hyperspace | Move camera between systems w/ acceleration + arrival | AudioBus, HUD, GenerationGalaxy | StateMachine, AutopilotSubsystem | 📄 SYSTEMS/warp/ |
| RetroRenderer | Frame production + post-processing | — | every visible feature | — no doc yet |
| ... | | | | |
```

**System-of-systems diagram (audit fix #2):** the flat row layout
preserves grep-ability but loses spatial relationships. The diagram
at top — even ASCII — restores the whole-game picture.

**"Depended on by" callouts (audit fix #9):** when about to refactor a
system, this column makes blast radius visible.

**"📄 [path] / — no doc yet" markers:** make the structural debt
visible in-place. Doc-less systems also surface in JOURNEY's structural
debt section with rationale.

Decay: per-refactor.

### `docs/SYSTEMS/<sys>/README.md`

**New.** Per-system deep dive — purpose, interface, wiring, history.

Template:

```markdown
# <System name>

**Purpose:** [one paragraph]

**Module(s):** [primary source files]

**Tier(s) served:** [SCREENSAVER / ENRICHED / GAME — typically multiple]

## Interface
**Triggers:** [what causes this system to act]
**Inputs:** [data this system consumes]
**Outputs:** [data + side effects this system produces]
**State:** [any persistent state this system owns]

## Wiring
- Calls into: [list of other systems]
- Called by: [list of other systems]
- Reads: [data sources outside its module]
- Writes: [data destinations outside its module]

## History
[Significant past decisions, abandoned approaches, terminology shifts.
Example: "Deep-sky rendering originally served dice-roll warp arrivals;
that mechanic was removed [date]; rendering now serves title screen +
debug gallery only."]

## Open questions
[Active design questions for this system]
```

### `docs/SYSTEMS/<sys>/CLAUDE.md` (optional, audit fix #4)

**New, optional.** Per-system Claude instructions for systems where
conventions differ from project-root CLAUDE.md.

Most systems don't need one. Examples where it might pay off:
- Shader / GLSL pipeline (different code style than JS)
- Inspection layer (specific test-authoring conventions)
- Audio system (different file layout, different testing approach)

If created, kept short (~30 lines). Auto-loaded when working in
`SYSTEMS/<sys>/` directory.

### `docs/SYSTEMS/<sys>/pipeline.md` (optional)

**New, optional.** Dynamic data/event flow when it matters.

Sequence diagrams or step-by-step flow for systems where the order of
operations is load-bearing (warp, autopilot, init sequence, etc.).

Skip for systems whose flow is obvious from README + code.

### `docs/SYSTEMS/<sys>/generator.md` (optional, audit fix #3)

**New, optional.** For procedural systems only.

Mandatory 4-section template per Caves of Qud pattern:

```markdown
# <System> — Generator catalog

## Input space
[What seeds + constraints does this generator take? What's the domain
of valid inputs?]

## Grammar / rules
[The rules the generator follows. May be explicit grammar, table-driven,
or algorithmic. Document the rules first-class — not as code commentary.]

## Output space
[What can this generator produce? Categories, archetypes, value
ranges, distributions. This is the "what could come out" question that
matters for testing + content audits.]

## Known dead-zones
[Where in the output space does the generator produce data that doesn't
reach a shader / isn't consumed downstream / is mis-rendered? This is
the FEATURE_AUDIT-style "exists but never reaches a shader" record,
made first-class.]
```

**Why mandatory 4 sections:** without "Known dead-zones," generator
docs miss the active question for Well Dipper — what procedural data is
generated but not surfaced. FEATURE_AUDIT.md (now archived) was
catalog-shaped around this question; the format carries forward.

### `docs/SYSTEMS/<sys>/changelog.md` (audit fix #5)

**New.** First-class "what we tried, what we abandoned, what landed."

Not a structural change log (git is for that). This is the **decisions
+ failed attempts log** — answers Sweatman's "doesn't allow for failure"
critique of GDDs.

Template:

```markdown
# <System> — changelog

## YYYY-MM-DD — [decision or attempt name]
**Tried:** [what we tried]
**Outcome:** [worked / abandoned / partially worked]
**Why abandoned (if applicable):** [the failure mode]
**What landed:** [the actual current state]
**Reference:** [workstream link, commit, memory file]
```

Example entries this file would carry for `SYSTEMS/ship-spawner/`:
- 2026-05-09 — Scene-global THREE.DirectionalLight + AmbientLight for
  ship visibility. Outcome: abandoned. Why: tanked FPS to 1-1.5 even
  with layer isolation. What landed: emissive = base color
  (workaround). Reference: ship-scanner workstream UAT round 3.

### `docs/SYSTEMS/<sys>/ROADMAP.md` (optional)

**New, optional.** Multi-phase plans for systems undergoing substantial
work.

Absorbs content from old `PLAN_*.md` files when relevant. The PLAN is
archived; the ROADMAP is freshly authored against current state.
Different doc, different lifecycle — ROADMAP is living, PLAN is
archived snapshot.

### `docs/WORKSTREAMS/` (existing)

**No structural change.** Existing convention. PM-authored briefs,
Tester verdicts, Status: lines. Tooling (`active-workstream.json`,
tester-audits) preserved.

### `docs/PERSONAS/` (existing)

**No change. Path preserved** to avoid breaking
`~/.claude/agents/<persona>.md` symlinks.

If at any point we want to consolidate under `PROTOCOLS/PERSONAS/`, the
symlinks need updating — one-line fix but worth flagging.

### `docs/PROTOCOLS/` (new)

**New folder.** Process protocols. Receives existing root-level docs
on migration:
- `MAX_RECORDING_PROTOCOL.md` → `PROTOCOLS/max-recording.md`
- New: `PROTOCOLS/shipped-gate.md` (codifies VERIFIED_PENDING_MAX → Shipped flow)
- New: `PROTOCOLS/three-max-gate.md` (codifies GATE 1/2/3 review pattern)
- New: `PROTOCOLS/doc-updates-on-ship.md` (codifies the rules in this design)

### `docs/ARCHIVE/` (new)

**New folder.** Archaeology — content distributes but originals preserved
for reference.

Initial contents on migration:
- `GAME_BIBLE_LEGACY.md` (untouched 2225-line Bible)
- `FEATURE_AUDIT_LEGACY.md`
- `MVP_SYSTEMS_REVIEW_2026-03-30_LEGACY.md`
- `PLAN_world-origin-rebasing_LEGACY.md`
- `PLAN_inspection-layer-v2_LEGACY.md`
- (other root-level PLAN_*.md as identified during migration)

Once this design doc itself completes its purpose, it joins archive as
`_design-doc-system-v2_LEGACY.md`.

## Rules

### Rule 1 — No empty folders

A folder exists when a doc inside it justifies it. Missing-but-needed
folders/docs are tracked in `JOURNEY.md` "Doc system completion"
section with: what's needed, why not authored, dependency, target
trigger.

### Rule 2 — Don't drag old structures forward

Migration is fresh authoring informed by archived material — not
transcription. When authoring `FEATURES.md`, do not paste from
`FEATURE_AUDIT.md`. Read the audit, decide what's true now, write the
row. Same for SYSTEMS docs against Bible sections.

### Rule 3 — Tester PASS-on-Shipped triggers doc updates

When a workstream Tester PASSes for shipping, working-Claude updates
the following BEFORE flipping Status: Shipped:
- `FEATURES.md` row status (always)
- `PLAYER_EXPERIENCE.md` (if the shipped experience differs from spec —
  update spec or mark divergence explicitly)
- `SYSTEMS/<sys>/README.md` (if wiring, interface, or major behavior
  changed — audit fix #8)
- `SYSTEMS/<sys>/changelog.md` (if approach was tried-and-abandoned in
  the workstream — audit fix #5)

Tester's "shipped-ready" criterion includes doc coverage. If
working-Claude misses an update, Tester FAILs the doc-coverage
criterion and the Shipped flip waits.

### Rule 4 — FEATURES.md authority

Max-authoritative. Working-Claude proposes status updates; Max confirms.
Status schema distinguishes `shipped-code` (in main, unconfirmed) from
`shipped-confirmed` (Max UAT pass). This is the structural answer to
"shipped commit ≠ feature done."

### Rule 5 — Player Beats require "so I can feel Y"

Every Player Beat in `FEATURES/<feature>.md` uses Keith-style form.
"So I can feel Y" half is mandatory. If genuinely no felt outcome (pure
infrastructure feature), say so explicitly — don't omit the half.

Every Player Beat has at least one observable acceptance criterion.

### Rule 6 — Generator docs use 4-section template

`generator.md` MUST include: Input space, Grammar/rules, Output space,
Known dead-zones. The dead-zones section is the FEATURE_AUDIT-style
record that surfaces procedural data not reaching a shader.

## Decisions made

These were called out as open decisions in v1 and decided in v2:

- **Lore (Bible §15) placement:** fold into `PILLARS.md` as a "Key
  fictions" section. Promote to standalone `LORE.md` only if lore
  starts shipping in-game (Layer 3 territory).
- **PERSONAS folder location:** keep at `docs/PERSONAS/` to preserve
  symlinks.
- **PLAN_*.md disposition:** all archive on migration. SYSTEMS/<sys>/ROADMAP.md
  authored fresh when each system gets its full doc; archived PLAN
  consulted as reference.
- **Bible §14 Open Questions:** distribute by topic to per-feature or
  per-system "Open questions" sections — no standalone questions doc.
- **JOURNEY combined-doc:** v1 holds milestones + structural debt
  together. Split if structural debt grows past ~20 items or churns.

## Migration approach (sketch — full plan is step 3)

High-level sequence:

1. **Create archive infrastructure.** `ARCHIVE/` folder created; Bible,
   FEATURE_AUDIT, MVP_SYSTEMS_REVIEW, PLAN_* moved with `_LEGACY` suffix.
   Old paths no longer resolve — anything that referenced them gets
   updated.
2. **Author thin v2 infrastructure.** `README.md`, `PILLARS.md`,
   `PLAYER_EXPERIENCE.md` skeletons + `PROTOCOLS/` folder + relocated
   `MAX_RECORDING_PROTOCOL.md`.
3. **Author `FEATURES.md` with Max.** Dedicated session. Max-authoritative
   judgment on every row, informed by archived FEATURE_AUDIT + intake
   doc. Highest-effort single step.
4. **Author `SYSTEMS.md` flat map + system-of-systems diagram.** Working-
   Claude drafts from code inspection; Max reviews. SYSTEMS/<sys>/
   folders NOT created — only when first doc inside is authored.
5. **Standardize existing FEATURES/<feature>.md docs.** Add Player Beats
   sections per template. Existing content preserved.
6. **Resolve audit items from intake doc.** Deep-sky code audit;
   autopilot target audit; 18 planet types audit; Easter egg audit. Each
   resolution feeds the relevant FEATURES.md row or SYSTEMS/<sys>/README.md.
7. **Update CLAUDE.md** for v2 structure. Updated session-start protocol;
   Tester-PASS-on-Shipped doc-update rule encoded.
8. **Delete intake doc + this design doc.** Both archive as `_LEGACY`.

Full migration map (per-file: what goes where, what transforms, what
archives) is step 3 deliverable.

## What the structure does NOT do

Honest boundaries:

- **No automated doc-rot detection.** Drift relies on Tester gate +
  Max's eye. If both miss, docs lag silently. Possible future addition:
  hook that flags FEATURES.md rows where the linked deep dive is
  >30 days older than the most recent commit touching the related code.
- **No automated dependency-graph generation.** "Calls / Called by" in
  SYSTEMS.md is hand-maintained. Could be code-generated but isn't.
- **No structured UAT log.** Tester verdicts append to per-workstream
  files; there's no rolled-up "things Max has UAT'd recently" view.
  Probably fine — if needed, easy to add as a query script over
  WORKSTREAMS/.
- **No cross-project sharing of doc patterns.** This design is well-
  dipper-specific. If the patterns prove out, they may be worth
  generalizing for other projects, but that's not in scope here.
- **Discord-relay surface not represented.** Cross-project infrastructure
  lives in Claude memory, not project docs.

## Open uncertainties (Claude's confidence calibration)

- High confidence in: decay-rate split, FEATURES.md authority schema,
  generator catalog template, Tester-PASS doc-update rule.
- Medium confidence in: PILLARS vs PLAYER_EXPERIENCE split (could be
  one doc), SYSTEMS.md flat-map sufficiency without per-system one-pagers
  (Librande would split further).
- Lower confidence in: whether `SYSTEMS/<sys>/CLAUDE.md` actually
  pays off in practice (untested pattern in this codebase), whether
  changelog.md as "what we tried, what we abandoned" gets actually
  maintained or rots.
- This whole design is synthesis from research + intake, not a copy of
  a proven pattern. A year from now we may discover a structural choice
  doesn't fit — design v3 expected.
