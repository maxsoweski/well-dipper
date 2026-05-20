# Now — Well Dipper

**This file changes every session. It's the single screen that says where we are.**

For longer arc, see `JOURNEY.md`. For meta-purpose, see `HEART_OF_DESIRE.md`.

Last updated: 2026-05-19 by working-Claude (Phase 6 ship; v5 doc-system migration 8 of 11 phases shipped).

---

## Active workstream

**Doc system v5 migration** — 8 of 11 phases shipped (commits
`fd98f23` → Phase 6 commit). Phase 6 (SYSTEMS.md + SYSTEMS/app-shell/)
landed this session: 26-system flat map authored, `app-shell` deep dive
with `(meta: orchestration)` flag, doc-graph + doc-rot pipelines
verified end-to-end. Manual-claimed only `src/main.js` per Rule 1; the
other 25 systems get their `SYSTEMS/<slug>/README.md` authored
progressively as feature work touches them (117 `unclaimed-src` warns
are expected baseline and will burn down over time).

**Maps to journey:** Foundational structural work; not a SCREENSAVER MVP feature itself, but unblocks coherent F&F-MVP scoping going forward. After migration completes, focus shifts to Deep-sky cleanup (highest-priority F&F-MVP work surfaced by the audit).

## Next 1-3 queued (in priority order)

1. **Phase 7 — Standardize FEATURES/{autopilot,warp}.md.** ~2-3 hours.
   Mechanical; just template conformance. Phase 6 slugs are now
   available for the `**Systems touched:**` lines.
2. **Phase 11 — Workstream Scope frontmatter + archive migration
   artifacts.** ~2-3 hours mostly batch. Depends on Phase 5+6 for
   feature/system slug lookups. Closes the migration.
3. **Phase 8 — Deep-sky cleanup PM-scoping** (only remaining audit
   item; other three resolved by 2026-05-19 code sweep).

After Phase 11, migration is done. Next workstream candidate:
**Deep-sky cleanup** (F&F-MVP / ASAP per Max — kill dice-roll arrival
path; see `FEATURES.md` Deep-sky section + per-row notes for the 9
usage sites with KEEP/REMOVE annotations).

## Remaining migration phases — PASS/FAIL criteria

### Phase 7 — Standardize FEATURES/{autopilot,warp}.md

**PASS criteria** (all must hold for BOTH files):
- [ ] `**Systems touched:**` line present near top; format = comma-separated slugs matching SYSTEMS.md row names
- [ ] `## Player Beats` section present with per-tier subsections (SCREENSAVER / ENRICHED / GAME, only those applicable to the feature)
- [ ] Every Player Beat uses Keith form: *"As a player/viewer, I want [X] so I can feel [Y]"* — both halves present (or explicit note "no felt outcome" for pure infra)
- [ ] Every Player Beat has at least one observable acceptance criterion (pass/fail-able language; not just vibes)
- [ ] Existing prose content from prior versions preserved (reshaped into template sections, not deleted)
- [ ] `npm run doc-rot` flags neither file with `stale-deep-dive` (recent update) or `orphan-systems-touched` (slugs valid)

**FAIL signals:**
- Systems touched: line missing or free-form (not parseable)
- Player Beats missing "feel" half
- ACs are vague ("feels good", "looks right")

### Phase 8 — Deep-sky cleanup PM-scoping (other audit items already resolved)

**Resolved by 2026-05-19 code sweep:**
- ✅ Autopilot deep-sky target audit: confirmed stars-only
- ✅ 18 planet types wiring audit: all wired
- ✅ Easter egg turn-back message audit: confirmed NOT built (ENRICHED row added)

**Remaining:** Deep-sky cleanup workstream needs PM-scoped brief.

**PASS criteria:**
- [ ] `docs/WORKSTREAMS/deep-sky-cleanup-<date>.md` exists, authored by PM agent
- [ ] Brief includes YAML frontmatter `Scope:` block (per v5 Rule 14) with paths (likely `src/main.js`, `src/generation/DestinationPicker.js`), features (likely `deep-sky-cleanup`), systems (likely TBD pending Phase 6)
- [ ] Brief enumerates the 9 deep-sky usage sites with KEEP / REMOVE annotation (per `FEATURES.md` per-row notes section); confirms each site's disposition
- [ ] ACs specify: dice-roll path removed; title screen procedural background still works; debug gallery still works; external-galaxy click warp still works; turn-back message TODO remains (not in scope of this workstream)
- [ ] Max GATE 1 approval on brief before execution begins

**FAIL signals:**
- Brief assumes deep-sky rendering is dead (it isn't entirely — title/gallery/Easter-egg uses survive)
- Brief tries to also build the turn-back message (out of scope; ENRICHED)

### Phase 11 — Workstream Scope frontmatter + archive migration artifacts

**PASS criteria:**
- [ ] **Active workstream** (`warp-landing-strip-persists-2026-05-10.md`):
  YAML frontmatter `Scope:` block present at top, with `base: master`,
  `paths:` (the warp files modified by the fix), `features:` (likely
  `["warp"]`), `systems:` (TBD per Phase 6). Authored by working-Claude
  from PM brief content; Max reviews
- [ ] **`npm run doc-rot --workstream warp-landing-strip-persists-2026-05-10`**
  produces a scoped report (filtered output for that workstream's downstream
  doc surface), not the full project-wide report
- [ ] **37 archived workstreams** have `Scope:` frontmatter added via batch
  process; uncertain Scopes marked `# unverified` comment; not blocking on
  perfection here
- [ ] `docs/_intake-2026-05-18-max-feature-status.md` moved to
  `docs/ARCHIVE/_intake-2026-05-18-max-feature-status_LEGACY.md`
- [ ] `docs/_design-doc-system-v5.md` moved to
  `docs/ARCHIVE/_design-doc-system-v5_LEGACY.md`
- [ ] `docs/_migration-map-2026-05-18.md` moved to
  `docs/ARCHIVE/_migration-map-2026-05-18_LEGACY.md`
- [ ] `docs/NOW.md` updated to reflect post-migration state (active
  workstream becomes the next real work, not the migration itself)
- [ ] `docs/README.md` updated — the "Transitional artifacts" section
  removed since those files are archived

**FAIL signals:**
- `npm run doc-rot --workstream <slug>` errors on missing/malformed YAML
- Existing archived workstreams' Scope fields claim files those workstreams
  didn't touch (validation: spot-check 2-3 with `git log --follow`)

## Recently shipped (this session arc — 2026-05-18 → 2026-05-19)

- **Phase 6 — SYSTEMS.md + SYSTEMS/app-shell/** (this session) — 26-system flat map, `app-shell` deep dive, doc-graph + doc-rot verified clean. Maps every `src/**/*.js` to a system slug; auto-table grows as deep dives author progressively.
- `ac4b477` — **Phase 5 — FEATURES.md** Max-authoritative inventory (69 rows)
- `5a97e41` — **Phase 9 — CLAUDE.md transform** (62 → 81 lines; under 120 budget) + JOURNEY structural-debt section
- `81c9f22` — **Phase 4 — MOOD index** wired (66 root + 3 subfolders inventoried from Pictures folder)
- `75c4a35` — **Phase 3 — Scripts** authored (doc-rot, doc-graph, uat-status, mood-bootstrap, pre-push hook); 4 npm scripts; madge installed
- `8625a8a` — **Phase 2 — Infrastructure** authored (PILLARS, PLAYER_EXPERIENCE, 8 PROTOCOLS files, README)
- `fd98f23` — **Phase 1 — Archive** (~50 file moves; Bible/audits/PLAN_*/etc. to ARCHIVE/; RESEARCH_* to research/)
- `a021e99` — staged lingering deletion from Phase 1
- **Phase 10** — pre-push hook installed + verified (fires `npm run doc-rot` on every push)
- **Code sweep finding:** code-explorer + code-architect agents stolen from feature-dev plugin; saved to `~/.claude/agents/`; tweaked `model: opus`

## Open structural decisions (from session)

- **code-explorer + code-architect version control** — currently no git tracking. Max flagged for revisit. Options: move to `well-dipper/docs/PERSONAS/` + symlink up (matches PM/Tester pattern but ties cross-project tools to well-dipper); separate `claude-agents` repo; accept untracked.
- **Ship NPC spawning disable for F&F** — `ShipSpawner` will be turned off before F&F ship; preserve code for ENRICHED reactivation. Small follow-up workstream; not yet scoped.
- **Christian (Max's brother) music tracks status** — `hyperspace.mp3 / deepsky.mp3 / warp-charge.mp3 / arrival.mp3` wired in MusicManager but absent on disk. Status of brother's deliveries unknown.

## Deferred (deliberate)

- **Per-system SYSTEMS/<sys>/ROADMAPs** — `PLAN_world-origin-rebasing.md` + `PLAN_inspection-layer-v2.md` archived; ROADMAPs authored fresh when each system gets its first deep dive (per Rule 1 no empty folders).
- **Sol-naming triage** — `body.star.sol` not tagged in partial inspection layer.
- **PARKING_LOT.md** — P1/P2/P3 deferred items still in transitional doc; migrate to per-system Open Questions when those systems get deep dives (tracked in JOURNEY structural debt).

## What's NOT in the queue right now

- Layer-3 GAME features (15+ rows in FEATURES.md GAME section) — gated by F&F MVP ship completion. Time-debt mechanic, propulsion tiers, combat (Rule of Three + Newtonian physics), on-foot, ship interior walk-around, scanner-4-layers, etc.
- New ENRICHED work — gated by F&F MVP ship. 4 ENRICHED rows currently (Ship Scanner, Ship NPCs, Easter egg, Ship reticle).
- Doc system v6 — not foreseen; v5 expected to hold for ≥6 months per v5 design uncertainty calibration.

## Session checklist (start of each working session)

1. Re-read `HEART_OF_DESIRE.md`
2. Skim `JOURNEY.md` current-objective section
3. Read THIS file's Active workstream + Next 1-3 + Remaining migration phases section
4. Check `~/.claude/state/dev-collab/active-workstream.json` matches Active workstream (if mismatched, this file is stale — update before proceeding)

## How this file updates

- **Working-Claude updates at session end** per CLAUDE.md session-end protocol
- **Max edits** when priorities shift, when items move in/out of queue, when deferred status changes
- **Pass/fail criteria for migration phases** stay here until those phases complete; remove (or move to a phase-archive note) when migration done
- Don't let this file grow past one screen. Currently denser than ideal; the migration-phase section comes out after Phase 11
