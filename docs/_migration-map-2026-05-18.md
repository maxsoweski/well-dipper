# Migration Map — Well Dipper doc system v5

**Status:** Step 3 of the doc-system overhaul. Awaiting Max approval.
Once approved, this map is executed phase by phase.
**Lifecycle:** Archive after migration completes (becomes
`ARCHIVE/_migration-map-2026-05-18_LEGACY.md`).
**Source design:** `docs/_design-doc-system-v5.md` (v5 with audit fixes
M / N / O / P / Q applied in-place).
**Source intake:** `docs/_intake-2026-05-18-max-feature-status.md`
(Max's verbatim feature audit).

## How to read this map

Three sections:
1. **Disposition table** — every existing file, what happens to it.
2. **New artifacts** — every file/folder to create, with source material
   and effort estimate.
3. **Phased execution** — 11 phases with dependencies, batching, and
   checkpoints.

**Effort estimates** are working-Claude time, not wall-clock (Max's
review/session time is separate).

**Phasing intent:** phases 1-4 (archive, infrastructure, scripts, MOOD)
land in a single autonomous session after Max approves. Phase 5
(FEATURES.md authoring) is a dedicated Max session. Phases 6-11 spread
across normal work (progressive authoring as systems are touched).

---

## Section 1 — Disposition of existing files

### `docs/` top-level — keep as-is

| Current | Action | Notes |
|---|---|---|
| `HEART_OF_DESIRE.md` | **KEEP** | Built this session; aligned with v5 design |
| `JOURNEY.md` | **KEEP + add section** | Add "Doc system completion" structural-debt section during Phase 9 |
| `NOW.md` | **KEEP + update** | Update per session during normal work |

### `docs/` top-level — archive (Rule 8: don't drag old structures forward)

| Current | Action | Target | Notes |
|---|---|---|---|
| `GAME_BIBLE.md` | **ARCHIVE** | `ARCHIVE/GAME_BIBLE_LEGACY.md` | 2225 lines; content distributes via fresh authoring |
| `FEATURE_AUDIT.md` | **ARCHIVE** | `ARCHIVE/FEATURE_AUDIT_LEGACY.md` | Superseded by FEATURES.md; consulted during Phase 5 authoring |
| `MVP_SYSTEMS_REVIEW_2026-03-30.md` | **ARCHIVE** | `ARCHIVE/MVP_SYSTEMS_REVIEW_2026-03-30_LEGACY.md` | Dated audit; consulted during Phase 5 |
| `BUGS_2026-03-30.md` | **ARCHIVE** | `ARCHIVE/BUGS_2026-03-30_LEGACY.md` | Dated bug list; stale |
| `CODE_REVIEW_2026-03-30.md` | **ARCHIVE** | `ARCHIVE/CODE_REVIEW_2026-03-30_LEGACY.md` | Dated review |
| `REPORT_implementation-readiness.md` | **ARCHIVE** | `ARCHIVE/REPORT_implementation-readiness_LEGACY.md` | One-off readiness report |
| `SCALE_AUDIT.md` | **ARCHIVE** | `ARCHIVE/SCALE_AUDIT_LEGACY.md` | One-off audit |
| `SUMMARY_overnight-research.md` | **ARCHIVE** | `ARCHIVE/SUMMARY_overnight-research_LEGACY.md` | One-off |
| `ARCHITECTURE.md` | **ARCHIVE** | `ARCHIVE/ARCHITECTURE_LEGACY.md` | Replaced by SYSTEMS/ folder + SYSTEMS.md; consulted during Phase 6 |
| `SYSTEM_CONTRACTS.md` | **ARCHIVE** | `ARCHIVE/SYSTEM_CONTRACTS_LEGACY.md` | Pulls into per-system SYSTEMS/<sys>/README.md Interface sections during Phase 6+ |
| `OBJECTS_OF_INTEREST.md` | **ARCHIVE** | `ARCHIVE/OBJECTS_OF_INTEREST_LEGACY.md` | Consulted when SYSTEMS/objects-of-interest/ authored |
| `COMPOSER_REFERENCE.md` | **ARCHIVE** | `ARCHIVE/COMPOSER_REFERENCE_LEGACY.md` | Consulted when SYSTEMS/warp/ or SYSTEMS/rendering/ authored |
| `DESIGN_procedural-lod2.md` | **ARCHIVE** | `ARCHIVE/DESIGN_procedural-lod2_LEGACY.md` | Consulted when generation system docs authored |

### `docs/` top-level — PLAN_*.md archive (Rule 2)

All PLAN_*.md archive on migration; ROADMAP authored fresh per-system when needed.

| Current | Action | Target |
|---|---|---|
| `PLAN_world-origin-rebasing.md` | **ARCHIVE** | `ARCHIVE/PLAN_world-origin-rebasing_LEGACY.md` |
| `PLAN_inspection-layer-v2.md` | **ARCHIVE** | `ARCHIVE/PLAN_inspection-layer-v2_LEGACY.md` |
| `PLAN_lens-flare-ghosts.md` | **ARCHIVE** | `ARCHIVE/PLAN_lens-flare-ghosts_LEGACY.md` |
| `PLAN_nav-galaxy-images.md` | **ARCHIVE** | `ARCHIVE/PLAN_nav-galaxy-images_LEGACY.md` |
| `PLAN_scale-audit.md` | **ARCHIVE** | `ARCHIVE/PLAN_scale-audit_LEGACY.md` |
| `PLAN_session-restore.md` | **ARCHIVE** | `ARCHIVE/PLAN_session-restore_LEGACY.md` |
| `PLAN_transition-freeze-fix.md` | **ARCHIVE** | `ARCHIVE/PLAN_transition-freeze-fix_LEGACY.md` |
| `PLAN_warp-tunnel-v2.md` | **ARCHIVE** | `ARCHIVE/PLAN_warp-tunnel-v2_LEGACY.md` |
| `PLAN_warp-tunnel.md` | **ARCHIVE** | `ARCHIVE/PLAN_warp-tunnel_LEGACY.md` |

### `docs/` top-level — move to project research/ folder

RESEARCH_* files are research artifacts, not project docs. Project
already has `research/` folder for this purpose.

| Current | Action | Target |
|---|---|---|
| `RESEARCH_blender-geometry-nodes-vs-python.md` | **MOVE** | `research/` |
| `RESEARCH_galaxy-generation.md` | **MOVE** | `research/` |
| `RESEARCH_game-interaction-systems.md` | **MOVE** | `research/` |
| `RESEARCH_megastructures-and-nav-computer.md` | **MOVE** | `research/` |
| `RESEARCH_procedural-3d-generation.md` | **MOVE** | `research/` |
| `RESEARCH_relativistic-experience.md` | **MOVE** | `research/` |
| `RESEARCH_rendering-physics-data.md` | **MOVE** | `research/` |
| `RESEARCH_star-population-synthesis.md` | **MOVE** | `research/` |
| `RESEARCH_transit-propulsion.md` | **MOVE** | `research/` |
| `RESEARCH_zone-variability.md` | **MOVE** | `research/` |
| `astronomical-data-research.md` | **MOVE** | `research/` |

### `docs/` top-level — transform to PROTOCOLS

| Current | Action | Target | Notes |
|---|---|---|---|
| `MAX_RECORDING_PROTOCOL.md` | **MOVE** | `PROTOCOLS/max-recording.md` | Rename to lowercase (PROTOCOLS convention) |
| `CONVENTIONS_test-harnesses.md` | **MERGE** | `PROTOCOLS/test-harnesses.md` | Merge with `TESTING_CONVENTIONS.md` + `TESTING_CONVENTIONS_TEMPLATE.md` |
| `TESTING_CONVENTIONS.md` | **MERGE** | `PROTOCOLS/test-harnesses.md` | (See above) |
| `TESTING_CONVENTIONS_TEMPLATE.md` | **MERGE** | `PROTOCOLS/test-harnesses.md` | Template section within merged doc |
| `REFACTOR_VERIFICATION_PROTOCOL.md` | **MOVE** | `PROTOCOLS/refactor-verification.md` | Rename to lowercase |

### `docs/` top-level — PARKING_LOT.md

| Current | Action | Notes |
|---|---|---|
| `PARKING_LOT.md` | **EVALUATE** | Read content; if active deferred items, fold into `NOW.md` "Deferred" section; if stale ideas, archive. Decision during Phase 1. |

### `docs/FEATURES/`

| Current | Action | Notes |
|---|---|---|
| `FEATURES/autopilot.md` | **KEEP + transform** | Phase 7: add Player Beats sections per template, add machine-parseable `**Systems touched:**` line |
| `FEATURES/warp.md` | **KEEP + transform** | Phase 7: same |
| `FEATURES/_drafts/` | **EVALUATE** | Check contents in Phase 1; promote any drafted-but-not-published features to FEATURES.md rows, decide per-file |

### `docs/PERSONAS/` (stays project-agnostic per Rule 11)

| Current | Action | Notes |
|---|---|---|
| `PERSONAS/README.md` | **KEEP** | No change |
| `PERSONAS/pm.md` | **KEEP** | No change — well-dipper specifics live in CLAUDE.md per Rule 11 |
| `PERSONAS/tester.md` | **KEEP** | No change |
| `PERSONAS/game-dev.md` | **KEEP** | No change |
| `PERSONAS/director.md` | **KEEP** | Retired persona; historical archaeology per global CLAUDE.md notes |

### `docs/WORKSTREAMS/` (38 files)

| Current | Action | Notes |
|---|---|---|
| Active workstream (warp-landing-strip-persists-2026-05-10) | **KEEP + add Scope frontmatter** | Working-Claude authors Scope from PM brief + Max review (Phase 11) |
| 37 archived workstreams | **KEEP + batch Scope frontmatter** | Working-Claude infers Scope from `git log --follow` over each slug; low-effort batch (Phase 11) |

### `docs/refactor-audits/`

| Current | Action | Target |
|---|---|---|
| `refactor-audits/fixed-timestep-migration-call-sites.md` | **ARCHIVE** | `ARCHIVE/refactor-audit-fixed-timestep-migration-call-sites_LEGACY.md` |

Folder itself: **DELETE** after archive (per Rule 1, no empty folders).

### `docs/testing/`

| Current | Action | Notes |
|---|---|---|
| `testing/scene-inspection-demo-walkthrough.md` | **MOVE** | `PROTOCOLS/test-harnesses.md` appendix OR archive; decide during Phase 2 |
| `testing/scene-inspection-integration-tests.md` | **MOVE** | Same — likely appendix in `PROTOCOLS/test-harnesses.md` |

Folder itself: **DELETE** after moves.

### `docs/` — design + intake docs

| Current | Action | Target | Notes |
|---|---|---|---|
| `_design-doc-system-v2.md` | **ARCHIVE** | `ARCHIVE/_design-doc-system-v2_LEGACY.md` | Phase 1 |
| `_design-doc-system-v3.md` | **ARCHIVE** | `ARCHIVE/_design-doc-system-v3_LEGACY.md` | Phase 1 |
| `_design-doc-system-v4.md` | **ARCHIVE** | `ARCHIVE/_design-doc-system-v4_LEGACY.md` | Phase 1 |
| `_design-doc-system-v5.md` | **STAYS until migration completes** | → `ARCHIVE/_design-doc-system-v5_LEGACY.md` at Phase 11 | Active reference during execution |
| `_intake-2026-05-18-max-feature-status.md` | **STAYS until migration completes** | → `ARCHIVE/_intake-2026-05-18-max-feature-status_LEGACY.md` at Phase 11 | Consumed during Phase 5 |
| `_migration-map-2026-05-18.md` (this file) | **STAYS until migration completes** | → `ARCHIVE/_migration-map-2026-05-18_LEGACY.md` at Phase 11 | Executed phase by phase |

### Project root `.md` files

| Current | Action | Target | Notes |
|---|---|---|---|
| `CLAUDE.md` | **KEEP + transform per v5 step 9** | Stays at root | Phase 9 — full transformation enumerated in v5 step 9 |
| `TEST_PLAN.md` | **ARCHIVE** | `ARCHIVE/TEST_PLAN_LEGACY.md` | One-off test plan; testing flows through workstreams now |
| `TEST_PLAN_autopilot_nav.md` | **ARCHIVE** | `ARCHIVE/TEST_PLAN_autopilot_nav_LEGACY.md` | One-off |
| `VERIFY.md` | **ARCHIVE** | `ARCHIVE/VERIFY_LEGACY.md` | One-off |
| `marketing-research.md` | **MOVE** | `research/marketing-research.md` | Research artifact |

---

## Section 2 — New artifacts to create

### Top-level `docs/` files

| New file | Source material | Effort |
|---|---|---|
| `docs/README.md` | Author from scratch — doc map listing every top-level doc, one-line purpose, decay rate, audience role | Small |
| `docs/PILLARS.md` | Extract from `ARCHIVE/GAME_BIBLE_LEGACY.md` §1-2 + intake doc + Max collaboration on key fictions | Medium |
| `docs/PLAYER_EXPERIENCE.md` | Extract from `ARCHIVE/GAME_BIBLE_LEGACY.md` §1A mode descriptions + intake doc + Max collaboration on per-tier targets | Medium |
| `docs/FEATURES.md` | **Max-authoritative dedicated session** (Phase 5). Inputs: archived FEATURE_AUDIT, intake doc, Bible feature tags, workstream Status: lines | **Large — Max session** |
| `docs/SYSTEMS.md` | Working-Claude drafts manual sections + initial row list from code inspection; `npm run doc-graph` populates auto-generated regions | Medium |

### `docs/MOOD/`

| New file | Source material | Effort |
|---|---|---|
| `docs/MOOD/README.md` | Template from v5; bootstrap script populates Unannotated inventory | Small (auto) |
| `docs/MOOD/.gitignore` | One-line: `*\n!README.md\n!.gitignore` (excludes everything except README + gitignore itself) | Trivial |

### `docs/PROTOCOLS/`

| New file | Source material | Effort |
|---|---|---|
| `docs/PROTOCOLS/max-recording.md` | Relocated `MAX_RECORDING_PROTOCOL.md` | Trivial (move) |
| `docs/PROTOCOLS/shipped-gate.md` | Author from scratch — codifies VERIFIED_PENDING_MAX → Shipped flow; refs global CLAUDE.md Dev Collab OS | Small |
| `docs/PROTOCOLS/three-max-gate.md` | Author from scratch — codifies GATE 1/2/3 review pattern; refs global CLAUDE.md | Small |
| `docs/PROTOCOLS/doc-updates-on-ship.md` | Author per outline in v5 spec (§Rule 3 / §PM-trigger / §Rule 11 rationale / §Rule 12 rationale); target ~150 lines | Medium |
| `docs/PROTOCOLS/development.md` | Compose from: Vite/Three.js knowledge + memory files (`feedback_no-start-servers.md`, `feedback_vite-wsl2-stale-modules.md`, `feedback_deploy-established-sites.md`, `chrome-devtools-9223-launch.md`) — link, don't paste per Rule 12 | Medium |
| `docs/PROTOCOLS/glossary.md` | Author from scratch — start with terms in intake (OOI, warp portal, deep sky historical reframe, screensaver tier semantics, etc.); grows over time | Medium |
| `docs/PROTOCOLS/test-harnesses.md` | Merge content from `CONVENTIONS_test-harnesses.md` + `TESTING_CONVENTIONS.md` + `TESTING_CONVENTIONS_TEMPLATE.md`; optionally append scene-inspection walkthroughs from testing/ | Medium |
| `docs/PROTOCOLS/refactor-verification.md` | Move from `REFACTOR_VERIFICATION_PROTOCOL.md` (rename) | Trivial |

### `docs/SYSTEMS/`

| New file | Source material | Effort |
|---|---|---|
| `docs/SYSTEMS/app-shell/README.md` | Author from scratch — identifies orchestration files (main.js + any bootstrap/init) via `(meta: orchestration)` flag; Calls/Called by populated by doc-graph | Small |

Other SYSTEMS/<sys>/ folders created PROGRESSIVELY during normal work
when a system gets first authoritative doc inside. Per Rule 1 (no empty
folders), do NOT create during initial migration.

### `docs/ARCHIVE/`

Created during Phase 1. Contents listed in Section 1 disposition.

### `scripts/`

| New file | Source spec | Effort |
|---|---|---|
| `scripts/doc-rot-check.sh` | v5 §`scripts/doc-rot-check.sh` — full checks table + --workstream mechanics + graph-staleness check + mood-promotion check | **Large** |
| `scripts/doc-graph.js` | v5 §`scripts/doc-graph.js` — madge integration + Module(s) parsing + meta:orchestration handling + atomic write | **Large** |
| `scripts/uat-status.sh` | v5 §`scripts/uat-status.sh` — query FEATURES.md, output digest | Small |
| `scripts/mood-index-bootstrap.sh` | v5 §`scripts/mood-index-bootstrap.sh` — AUTO-INVENTORY markers + Pictures folder scan | Small |
| `scripts/git-hooks/pre-push` | Shell script invoking `npm run doc-rot` | Trivial |
| `scripts/install-hooks.sh` | Shell script copying pre-push into `.git/hooks/`; checks for existing hook | Small |

### `package.json` updates

Add scripts:
```json
"scripts": {
  "doc-rot": "bash scripts/doc-rot-check.sh",
  "doc-graph": "node scripts/doc-graph.js",
  "uat-status": "bash scripts/uat-status.sh",
  "mood-bootstrap": "bash scripts/mood-index-bootstrap.sh"
}
```

Add devDependency:
```json
"devDependencies": {
  "madge": "^X.Y.Z"
}
```

---

## Section 3 — Phased execution plan

### Phase 1 — Archive infrastructure

**Goal:** Create ARCHIVE folder; move all archive-target files with
`_LEGACY` suffix.

**Steps:**
1. `mkdir docs/ARCHIVE`
2. Evaluate `docs/PARKING_LOT.md` content; fold active items into
   `docs/NOW.md` "Deferred" section; archive stale items
3. Evaluate `docs/FEATURES/_drafts/` content; promote to FEATURES.md
   rows (Phase 5) or archive per-file
4. Batch git mv each file per Section 1 disposition tables
5. `rmdir docs/refactor-audits` after move
6. `rmdir docs/testing` after content moved (Phase 2)
7. Move `RESEARCH_*.md` + `astronomical-data-research.md` +
   `marketing-research.md` to `research/`
8. Commit: "docs: archive pre-v5 docs as _LEGACY; move research to research/"

**Effort:** Working-Claude ~30 minutes; mostly file moves.
**Dependencies:** None.
**Checkpoint:** `docs/` should have HEART_OF_DESIRE.md, JOURNEY.md,
NOW.md, _design-doc-system-v5.md, _intake-2026-05-18-..., _migration-map-2026-05-18.md,
and folders ARCHIVE/, FEATURES/, PERSONAS/, WORKSTREAMS/.

### Phase 2 — Thin v5 infrastructure (new docs)

**Goal:** Author new top-level docs and PROTOCOLS folder.

**Steps:**
1. Author `docs/README.md` (doc map)
2. Author `docs/PILLARS.md` skeleton from Bible §1-2 + intake (Max
   reviews after; finalizes Key Fictions section)
3. Author `docs/PLAYER_EXPERIENCE.md` skeleton from Bible §1A + intake
   (Max reviews after; finalizes per-tier Target/Anti-experience)
4. Create `docs/PROTOCOLS/` folder
5. Author each PROTOCOLS file per Section 2 spec (max-recording,
   shipped-gate, three-max-gate, doc-updates-on-ship, development,
   glossary, test-harnesses, refactor-verification)
6. Commit: "docs: author v5 infrastructure (PILLARS, PLAYER_EXPERIENCE,
   PROTOCOLS, README)"

**Effort:** Working-Claude ~90-120 minutes; PROTOCOLS authoring is the
bulk.
**Dependencies:** Phase 1 (Bible must be archived as LEGACY to consult
during authoring).
**Checkpoint:** PILLARS + PLAYER_EXPERIENCE + 8 PROTOCOLS files exist;
README references them.

### Phase 3 — Author scripts

**Goal:** All automation scripts working.

**Steps:**
1. `npm install --save-dev madge`
2. Author `scripts/doc-rot-check.sh` per v5 spec (use shellcheck;
   test each check independently)
3. Author `scripts/doc-graph.js` per v5 spec (Module(s) parser;
   meta:orchestration handling; atomic write; mermaid output)
4. Author `scripts/uat-status.sh`
5. Author `scripts/mood-index-bootstrap.sh`
6. Author `scripts/git-hooks/pre-push`
7. Author `scripts/install-hooks.sh`
8. Update `package.json` with npm scripts
9. Test: `npm run doc-rot` (should run; will flag many items because
   structure isn't complete yet — OK, baseline)
10. Test: `npm run doc-graph` (should error or report no Module(s)
    declarations yet — OK, baseline)
11. Test: `npm run uat-status` (should report empty)
12. Test: `npm run mood-bootstrap` (should populate MOOD/README.md when
    that file exists — actually requires Phase 4 first; defer test)
13. Commit: "scripts: author doc-rot, doc-graph, uat-status, mood-bootstrap, git hooks"

**Effort:** Working-Claude ~3-4 hours; doc-rot + doc-graph are the bulk.
**Dependencies:** Phase 1 (so scripts don't error on stale references
to archived docs).
**Checkpoint:** All `npm run <script>` commands execute without crash;
checks run against current (incomplete) state and report what's missing.

### Phase 4 — Wire up MOOD index

**Goal:** MOOD/README.md exists with Unannotated inventory of Pictures
folder.

**Steps:**
1. `mkdir docs/MOOD`
2. Create `docs/MOOD/.gitignore` with `*\n!README.md\n!.gitignore`
3. Create `docs/MOOD/README.md` with template from v5 (with AUTO-INVENTORY markers)
4. Run `npm run mood-bootstrap` to populate Unannotated inventory
5. Verify: index has all 126 files + 2 subfolders accounted for
6. Update `docs/PILLARS.md` Aesthetic section to link `MOOD/README.md`
7. Commit: "docs: wire up MOOD index (126 files at Pictures folder)"

**Effort:** Working-Claude ~30 minutes.
**Dependencies:** Phase 2 (PILLARS exists), Phase 3 (mood-bootstrap script exists).
**Checkpoint:** `docs/MOOD/README.md` is non-empty; `.gitignore` works
(no images appear in `git status`).

---

**End of autonomous-execution batch (Phases 1-4).**

Phases 1-4 can land in a single working-Claude session after Max
approves. Max reviews PILLARS and PLAYER_EXPERIENCE drafts produced in
Phase 2 before next phase begins.

---

### Phase 5 — Author FEATURES.md with Max (DEDICATED MAX SESSION)

**Goal:** Max-authoritative inventory of every feature.

**Steps:**
1. Max sits down with working-Claude
2. Working-Claude has loaded: intake doc, archived FEATURE_AUDIT,
   archived MVP_SYSTEMS_REVIEW, all workstream Status lines
3. Working-Claude proposes initial row list (probably 40-60 features)
4. Max walks each row: confirms feature exists, sets Tier (F&F-MVP /
   ENRICHED / GAME / unsure), sets Status (8-value schema), notes
   Blocks/Blocked by where known
5. Working-Claude writes `docs/FEATURES.md` with authority header +
   cross-cutting status notes (rendering placeholder, SFX placeholder)
   + rows
6. Commit: "docs: author FEATURES.md (Max-authoritative inventory)"

**Effort:** Max session ~90-120 minutes; working-Claude ~30 minutes
prep + 30 minutes writing.
**Dependencies:** Phase 1 (FEATURE_AUDIT archived), Phase 2 (PILLARS
exists for tier-anchoring discussion).
**Checkpoint:** Every feature Max would name is present with a
status; cross-cutting placeholder notes captured.

### Phase 6 — Author SYSTEMS.md + SYSTEMS/app-shell/

**Goal:** Flat map of every system; app-shell deep dive exists; doc-graph
populates auto-regions.

**Steps:**
1. Working-Claude reads `src/` to enumerate systems (one per major
   feature area). Probably ~25-30 systems.
2. For each system, decide initial Module(s) ownership. Identify
   orchestration files (main.js + any bootstrap) for app-shell.
3. Author `docs/SYSTEMS.md` manual sections + initial row list
   (system name, one-line purpose, "Has deep dive: — no doc yet" for all
   except app-shell)
4. `mkdir docs/SYSTEMS/app-shell`
5. Author `docs/SYSTEMS/app-shell/README.md` with Module(s) including
   `(meta: orchestration)` flag on main.js
6. Run `npm run doc-graph` to populate SYSTEMS.md auto-generated regions
7. Add required app-shell asymmetry annotation to SYSTEMS.md Manual
   Overlays section (per v5 spec, Gap O fix)
8. Commit: "docs: author SYSTEMS.md flat map + SYSTEMS/app-shell/ deep dive"

**Effort:** Working-Claude ~2-3 hours; Module(s) ownership decisions
need careful thought; doc-graph may surface mapping issues to resolve.
**Dependencies:** Phase 1 (ARCHITECTURE, SYSTEM_CONTRACTS archived for
reference), Phase 3 (doc-graph script exists).
**Checkpoint:** `npm run doc-graph` completes without errors; SYSTEMS.md
auto-regions populated; `npm run doc-rot` flags fewer items than before.

### Phase 7 — Standardize existing FEATURES/<feature>.md docs

**Goal:** autopilot.md + warp.md follow v5 template (Player Beats with
"feel Y" + observable ACs + parseable "Systems touched:").

**Steps:**
1. Read existing `FEATURES/autopilot.md`; identify content gaps vs
   template
2. Add `**Systems touched:**` line at top (parseable format per Rule 14)
3. Add Player Beats sections per tier with Keith form + observable ACs
4. Preserve all existing prose content; reshape into template sections
5. Same for `FEATURES/warp.md`
6. Test: `npm run doc-rot` should now find fewer orphan-systems-touched
   issues
7. Commit: "docs: standardize FEATURES/{autopilot,warp}.md per v5 template"

**Effort:** Working-Claude ~60-90 minutes per feature; 2-3 hours total.
**Dependencies:** Phase 5 (FEATURES.md exists so Status can link there),
Phase 6 (SYSTEMS.md exists so Systems touched: orphans don't false-fire).
**Checkpoint:** Both files validate against template; doc-rot doesn't
flag them.

### Phase 8 — Resolve audit items from intake doc

**Goal:** Close the 4 audit items from intake doc §"Open audit items":
deep-sky code audit, autopilot target audit, 18 planet types audit,
Easter egg audit.

**Steps:**
1. **Deep-sky code audit:** grep for any in-game (non-title-screen,
   non-debug-gallery) references to deep-sky rendering. Remove or flag
   as dead code. Update SYSTEMS/deep-sky-rendering/ (if/when authored)
   with History note per intake doc.
2. **Autopilot target audit:** read autopilot code; confirm whether it
   ever selects non-stellar destinations. If so, dead code. Update
   FEATURES/autopilot.md "Current state" + SYSTEMS/autopilot/README.md
   if applicable.
3. **18 planet types audit:** enumerate planet types in code; verify
   each renders end-to-end. Document which are wired vs unwired in
   SYSTEMS/generation-planet/README.md or FEATURES.md row notes.
4. **Easter egg audit:** confirm whether the "warp to another galaxy →
   turn-back message" exists. Add to FEATURES.md as appropriate Status.
5. Commit per resolved item: "audit: resolve <item> from intake"

**Effort:** Working-Claude ~60-120 minutes per audit item (varies);
~4-8 hours total across the four.
**Dependencies:** Phase 5 (FEATURES.md exists), Phase 6 (SYSTEMS.md
exists).
**Checkpoint:** Intake doc's "Open audit items" section can be marked
resolved; deep-sky terminology updated per glossary; dead code removed
or explicitly flagged.

### Phase 9 — Update CLAUDE.md for v5 structure

**Goal:** CLAUDE.md is a compact trigger index per Rule 13; target <120 lines.

**Steps (per v5 step 9 enumeration):**
1. **KEEP, shorter:** Compress "Three-file orienting structure" to
   "Session start" protocol (4 lines)
2. **KEEP, transform:** Compress "Contextualize each feature" to
   one-paragraph principle; full detail moves to
   `PROTOCOLS/doc-updates-on-ship.md`
3. **REMOVE:** "Game Bible anchoring" section entirely (Bible archived)
4. **MOVE:** "Inspection-layer-v2 is the testing roadmap" pointer →
   becomes `SYSTEMS/inspection-layer/ROADMAP.md` when that system gets
   its deep dive (track in JOURNEY structural debt for now)
5. **KEEP:** sibling-project well-dipper-visual note
6. **ADD:** Compact trigger statements (~3 lines each) for Rules
   3 / 7 / 8 / 11 / 12 / 14, each linking to
   `PROTOCOLS/doc-updates-on-ship.md` section
7. **ADD:** doc map reference (link to `docs/README.md`)
8. Verify line count: `wc -l CLAUDE.md` → should be ≤120
9. Also: add "Doc system completion" section to `docs/JOURNEY.md` for
   structural-debt tracking
10. Commit: "CLAUDE.md, JOURNEY.md: update for v5 doc system"

**Effort:** Working-Claude ~45-60 minutes.
**Dependencies:** Phase 2 (PROTOCOLS/doc-updates-on-ship.md exists).
**Checkpoint:** CLAUDE.md is ≤120 lines; JOURNEY has structural-debt
section.

### Phase 10 — Verify pre-push hook installed

**Goal:** Rule 8 (pre-push rot check) actually fires.

**Steps:**
1. Run `bash scripts/install-hooks.sh`
2. Verify `.git/hooks/pre-push` exists and is executable
3. Test: `git push --dry-run` — hook should run; rot output writes to
   `~/briefings/`
4. Confirm: `~/briefings/well-dipper-doc-rot-*.md` exists with expected
   content
5. Document the install command in `PROTOCOLS/development.md` First-time
   setup section (should already be there from Phase 2)

**Effort:** Working-Claude ~15 minutes.
**Dependencies:** Phase 3 (scripts exist), Phase 2 (development.md exists).
**Checkpoint:** Hook is installed; running `git push --dry-run` produces
expected rot report.

### Phase 11 — Workstream Scope frontmatter + archive intake/design docs

**Goal:** All workstreams have `Scope:` frontmatter; intake + design
docs archived.

**Steps:**
1. For the active workstream (warp-landing-strip-persists-2026-05-10):
   - Working-Claude authors Scope frontmatter carefully from PM brief
   - Max reviews
2. For 37 archived workstreams:
   - Working-Claude batch-infers Scope from `git log --follow` over
     each slug + workstream content
   - Low-effort; mark uncertain Scopes with a `# unverified` comment
   - Don't block migration on perfection here
3. Test: `npm run doc-rot --workstream warp-landing-strip-persists-2026-05-10`
   should produce scoped output
4. Archive intake + design docs:
   - `git mv docs/_intake-2026-05-18-max-feature-status.md docs/ARCHIVE/_intake-2026-05-18-max-feature-status_LEGACY.md`
   - `git mv docs/_design-doc-system-v5.md docs/ARCHIVE/_design-doc-system-v5_LEGACY.md`
   - `git mv docs/_migration-map-2026-05-18.md docs/ARCHIVE/_migration-map-2026-05-18_LEGACY.md`
5. Commit: "docs: workstream Scope frontmatter + archive migration artifacts"

**Effort:** Working-Claude ~2-3 hours (mostly the batch workstream
processing).
**Dependencies:** Phase 6 (SYSTEMS.md exists for Scope.systems
references), Phase 5 (FEATURES.md exists for Scope.features references).
**Checkpoint:** Migration is complete; ARCHIVE has full historical
record; `npm run doc-rot` baseline established for ongoing rot detection.

---

## Section 4 — Risks and verifications

### Known risks

- **Phase 5 (Max session) is the long pole.** Until FEATURES.md exists,
  Phase 7 (standardize feature docs) can't run cleanly. Schedule the
  Max session before starting Phase 7.
- **Phase 6 (SYSTEMS.md) requires Module(s) ownership decisions that
  may need iteration.** First-pass ownership may be wrong; running
  `npm run doc-graph` will surface duplicates/orphans. Plan for 2-3
  refinement passes during the phase.
- **doc-rot will fire LOUDLY during early phases** when structure is
  incomplete. Don't let warning-fatigue cause Max to push the
  `WELL_DIPPER_DOC_ROT_BLOCK=true` setting; baseline noise should
  decrease as phases complete.
- **Phase 8 audit items may surface architectural surprises** (e.g.,
  autopilot actually does target deep-sky destinations and that path
  is alive). If surprises emerge, surface to Max — don't silently
  remove code.
- **Active workstream Scope authoring (Phase 11) must be careful.** The
  warp-landing-strip workstream is awaiting Max UAT; getting its Scope
  wrong would mis-fire Tester checks.

### Verifications between phases

After each phase:
- `npm run doc-rot` runs without error
- Item count of flagged issues decreases (or stays flat where expected)
- Git history is clean (one commit per phase, descriptive messages)
- No accidentally-staged binary files (Phase 4 should not stage Pictures
  content)

### Definition of "migration complete"

Migration is complete when:
- All 11 phases checkpoints met
- `docs/_design-doc-system-v5.md`, `docs/_intake-2026-05-18-...`,
  `docs/_migration-map-2026-05-18.md` archived
- `npm run doc-rot` produces output that Max accepts as baseline (some
  rot may be deferred — see JOURNEY structural debt — but no
  showstoppers)
- CLAUDE.md is ≤120 lines and references the new structure
- `~/.claude/state/dev-collab/active-workstream.json` (well-dipper key)
  still matches `NOW.md` active workstream

### Out of scope for this migration

- Authoring SYSTEMS/<sys>/ deep dives beyond app-shell (progressive
  per Rule 1)
- Authoring FEATURES/<feature>.md deep dives for features that don't
  have them today (created on-demand when content justifies)
- Authoring per-system CLAUDE.md / pipeline.md / generator.md /
  ROADMAP.md (optional, on-demand)
- Resolving the still-active feature work named in intake (warp
  rewrite, autopilot bugs, planet rendering, etc.) — that's normal
  ongoing development AFTER migration
