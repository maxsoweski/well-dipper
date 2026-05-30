# Now — Well Dipper

**This file changes every session. It's the single screen that says where we are.**

For longer arc, see `JOURNEY.md`. For meta-purpose, see `HEART_OF_DESIRE.md`.

Last updated: 2026-05-29 by working-Claude (doc-system v5 migration COMPLETE — all 11 phases shipped; Phase 8 deep-sky-cleanup brief approved at GATE 1; Phase 11 closed: workstream Scope frontmatter + transitional-doc archive).

---

## Active workstream

**F&F-MVP screensaver completion.** The doc-system v5 migration is DONE
(all 11 phases). Focus returns to shipping the screensaver MVP. Two
concrete items are live:

1. **`warp-landing-strip-persists-2026-05-10`** — landing-strip stops
   following the player post-warp. **Tester VERIFIED_PENDING_MAX @ `e31ee65`** —
   awaiting Max UAT. (Scope frontmatter added Phase 11.)
2. **`deep-sky-cleanup-2026-05-29`** — **APPROVED at GATE 1 (2026-05-29)**,
   ready to implement in a future session. Kill the random dice-roll
   arrival; keep title backdrop / debug gallery / external-galaxy click.
   All open questions resolved toward clean delete. **This is the next
   implementation pickup.**

**Maps to journey:** Both are 35% SCREENSAVER-MVP work. Deep-sky cleanup
is the highest-priority F&F-MVP item surfaced by the 2026-05-18 audit.

## Next 1-3 queued (in priority order)

1. **Implement `deep-sky-cleanup-2026-05-29`** — brief is GATE-1 approved;
   surgical removal of the dice-roll arrival path (8-item removal list in
   the brief). Re-locate line numbers at impl time (they drift). Tester
   gate on the 5 ACs before Shipped.
2. **`warp-landing-strip-persists` Max UAT** — confirm the fix in Max's
   browser, then flip to Shipped + push.
3. **`warp-tunnel-second-half-not-rendering`** — needs PM-scoping. Last
   warp regression; likely a Phase-E tunnel-pipeline rewrite.

## Recently shipped

- **Doc-system v5 migration COMPLETE** (2026-05-29) — Phase 8
  (deep-sky-cleanup PM-scoped + GATE-1 approved) and Phase 11 (Scope
  frontmatter on all 39 workstreams; 3 transitional docs archived to
  `ARCHIVE/*_LEGACY.md`; README "Transitional artifacts" section removed;
  this NOW.md post-migration rewrite). All 11 phases done.
- **Phase 7 — FEATURES/{autopilot,warp}.md standardized to v5** (2026-05-29, `a4ddc47`) — `**Systems touched:**` lines + `## Player Beats` (F&F-MVP + ENRICHED/GAME, Keith form, observable ACs); prior prose preserved; `doc-rot` clean.
- **4 net-new FEATURES deep dives** (2026-05-25, `0373d1f`→`039b52c`) — galactic-rendering, nebulae, planet-rendering, nav-computer; nav-computer Level 4 COLUMN→PRISM rename (`039b52c`).
- **Phase 6 — SYSTEMS.md + SYSTEMS/app-shell/** (2026-05-19, `cb1fc4d`) — 26-system flat map, `app-shell` deep dive, doc-graph + doc-rot clean.
- `ac4b477` — **Phase 5 — FEATURES.md** Max-authoritative inventory (69 rows)
- `5a97e41` — **Phase 9 — CLAUDE.md transform** (62 → 81 lines) + JOURNEY structural-debt section
- `81c9f22` — **Phase 4 — MOOD index** wired
- `75c4a35` — **Phase 3 — Scripts** (doc-rot, doc-graph, uat-status, mood-bootstrap, pre-push hook)
- `8625a8a` — **Phase 2 — Infrastructure** (PILLARS, PLAYER_EXPERIENCE, 8 PROTOCOLS, README)
- `fd98f23` — **Phase 1 — Archive** (~50 file moves)
- **Phase 10** — pre-push hook (fires `npm run doc-rot` on every push)

## Open structural decisions (from session)

- **Historical-workstream Scope `# unverified` back-fill** — Phase 11
  added Scope frontmatter to all 37 historical workstreams, but `paths:`
  were left `[] # unverified` (not back-filled from shipped commits), and
  6 process/ambiguous ones have `systems: [] # unverified`
  (canvas-recording-workflow-formalization, dev-collab-three-layer-testing,
  warp-shipped-gate-process-fix, ooi-capture-and-exposure-system). Back-fill
  each when its workstream is next touched. Not blocking.
- **code-explorer + code-architect version control** — currently no git tracking. Max flagged for revisit. Options: `well-dipper/docs/PERSONAS/` + symlink up; separate `claude-agents` repo; accept untracked.
- **Ship NPC spawning disable for F&F** — `ShipSpawner` turned off before F&F ship; preserve code for ENRICHED reactivation. Small follow-up workstream; not yet scoped.
- **Christian (Max's brother) music tracks status** — `hyperspace / deepsky / warp-charge / arrival` wired in MusicManager but absent on disk. (Note: `deepsky` track slated for removal per deep-sky-cleanup GATE 1.) Status of brother's deliveries unknown.

## Deferred (deliberate)

- **Per-system SYSTEMS/<sys>/ROADMAPs** — authored fresh when each system gets its first deep dive (Rule 1 no empty folders).
- **Sol-naming triage** — `body.star.sol` not tagged in partial inspection layer.
- **PARKING_LOT.md** — P1/P2/P3 deferred items; migrate to per-system Open Questions when those systems get deep dives (tracked in JOURNEY structural debt).

## What's NOT in the queue right now

- Layer-3 GAME features (15+ rows in FEATURES.md GAME section) — gated by F&F MVP ship completion.
- New ENRICHED work — gated by F&F MVP ship. 4 ENRICHED rows currently.
- Doc system v6 — not foreseen; v5 expected to hold ≥6 months.

## Session checklist (start of each working session)

1. Re-read `HEART_OF_DESIRE.md`
2. Skim `JOURNEY.md` current-objective section
3. Read THIS file's Active workstream + Next 1-3
4. Check `~/.claude/state/dev-collab/active-workstream.json` matches Active workstream (if mismatched, this file is stale — update before proceeding)

## How this file updates

- **Working-Claude updates at session end** per CLAUDE.md session-end protocol
- **Max edits** when priorities shift, when items move in/out of queue, when deferred status changes
- Don't let this file grow past one screen.
