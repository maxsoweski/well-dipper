# Now — Well Dipper

**This file changes every session. It's the single screen that says where we are.**

For longer arc, see `JOURNEY.md`. For meta-purpose, see `HEART_OF_DESIRE.md`.

Last updated: 2026-06-09 by working-Claude (warp cruise problem #2 **FIXED, VERIFIED_PENDING_MAX `8bda388`** — wall-scroll reversal killed: single motion source + soft-creep park. Entry-reliability Fix D still VERIFIED_PENDING_MAX. All warp work unpushed).

---

## Active workstream

**`warp-tunnel-pocket-traversal-2026-06-06`** — **cruise-visual tuning.**
**Problem #2 (walls reverse halfway) FIXED `8bda388`, VERIFIED_PENDING_MAX.**
Root cause: two opposing wall-motion sources — the constant `uScroll += dt*0.5`
drift (static-camera lab holdover) vs real camera parallax; the AC5 dead-stop
park exposed the drift as a reversal. Per Max's decision (continuous flight):
drift removed; park is now a soft creep (`parkBackDepth()` in
`portalTraversal.js`, eases 20u→6u over min-cruise, entry-depth-capped so the
swap's shallow drop-in — measured ~14.7u live — can't re-freeze it). Live
telemetry (GPU 9223, 241fps, 3 warps): uScroll 0 throughout, zero frozen frames
(was 280/843 gated), real INSIDE→OUTSIDE_B crossings, no AC4 force-flip.
Headless 37/37. **Max UAT: ride warps — does the reversal go away?**

**Task B blocker FIXED `87d5560`, VERIFIED_PENDING_MAX** — distB at cruise start
was ~15-32u (varying), not 60: the swap fires at the Portal-A crossing DURING
enter, and the remainder of ENTER (22.5→45 u/s, up to ~1.5s) flew the camera
into the fresh pocket before HYPER. Fix: enter→hyper at `_swapFired` (WarpEffect)
— cruise now starts at the full pocket length (live: 59.8/58.1 across 2 runs,
deterministic; speed snap at the seam also shrank, ~26→20 vs 45→20).

**Max rode both fixes (UAT positive: "Much better already" / "Quite good") and set
3 next goals (2026-06-09, his words):** (1) Portal A spawns too far away — often
behind the nearest planet; should spawn "like 100m away"; (2) asteroid belt shows
through the tunnel walls; (3) entry hitch — "everything stops moving" at tunnel
entry. Target feel for all three: *one* long tunnel; after a few seconds of travel
the far end appears, grows, and the new system shows through it.
**→ Next-session prep (goals, code map, couplings, sequencing):
`/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-09b.md`.**
Older context: `/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-07b.md`,
`/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-09.md`.

Prior sub-state — **Tasks 0–3 DONE; entry-reliability
Fix D implemented + live-verified, VERIFIED_PENDING_MAX (UAT).** Root cause was the
off-axis approach (camera advanced along mid-slerp facing, missing the 3u gate).
**Fix D** (`src/main.js` ~6753, UNCOMMITTED): advance camera *position* along the
locked `_tunnelForward` axis (orientation slerp unchanged); guard falls back to
facing post-swap. Preserves AC2 → no contract change. **Live result (GPU 9223, full
speed): fresh enterSol → 12/12 ALL_REGISTERED; 13–24 consecutive → 10/12.** Headless
`warp-tunnel-rebase.test.js` 4/4. Residual deep-state 2/12 = finding-#4 turn-alignment
accumulation (DEFERRED, separate thread). Off-axis root cause + Fix D writeup:
`docs/WORKSTREAMS/warp-tunnel-pocket-traversal-2026-06-06/entry-reliability-rootcause-2026-06-06.md` (session-3 addendum).
- Plan (8 tasks, 4–7 not started): `docs/superpowers/plans/2026-06-06-warp-tunnel-pocket-traversal.md` (`31b3c93`)
- Telemetry committed `4fc9a36`; warp commits (UNPUSHED, master): `5a94a19` (T0), `1427ebb`+`9c334c2` (T1), `a16d617`+`39fa8f2` (T2), `7064478` (T3)
- **Next:** Max UAT (ride warps — into Portal A / cruise / out Portal B, repeats + far targets) → commit Fix D → resume T4–7. Deferred: finding-#4 turn-alignment accumulation.

**Maps to journey:** Travel-loop signature moment (35% SCREENSAVER-MVP).

### Also pending Max UAT (separate)
- **`warp-landing-strip-persists-2026-05-10`** — VERIFIED_PENDING_MAX @ `e31ee65`.

## Next 1-3 queued (in priority order)

0. **`planet-refinement-campaign` — Phase 3 DONE 2026-06-10 (`17052ab`…
   `407682c`): all 15 built-feature cards verdicted — 13 🟢, F03 🟡
   (full-disk rays read as speckle; cell-truncation carry-forward,
   taste-call for Phase 7), F08 🟡 (Max live UAT: cell-based lava-flow
   shape failed visual QA → fix cycle 1 shipped: domain-warped crack
   channels + province clustering + flow-front glow; Max re-look
   queued). ~70 shots in cards/shots/; vitest 8/8 green; zero other code
   fixes needed. Lab method notes: setPreset doesn't re-derive drivers
   (call `_lab.applyDrivers()`); zero uCloudCoverage before any
   pixel-diff. Tracker flipped Phase 4a ▶️.** Next: Max starts a FRESH
   session and pastes the tracker's **Phase-4a `/goal` launch card**
   (build pass, fluvial+aeolian, 8 cards, heavy loop). Serves
   SCREENSAVER-MVP visual polish (planets = hero objects). Runs parallel
   to warp on shared tree — explicit-path staging only.
1. **`warp-landing-strip-persists` Max UAT** — confirm the fix in Max's
   browser, then flip to Shipped + push.
2. **`warp-tunnel-second-half-not-rendering`** — needs PM-scoping. Last
   warp regression; likely a Phase-E tunnel-pipeline rewrite.
3. **`world-origin-reset-on-system-swap-2026-06-04`** — SCOPED (`466a0c5`),
   **awaiting GATE 1**, queued behind MVP. Structural fix to the rebasing
   bug class (wire dead `resetWorldOrigin()` + invariant test). Full review:
   `~/briefings/well-dipper-rebasing-review-2026-06-04.md`. (Rebasing fix
   #2 — duplicate-call/telemetry — committed `a1a01b6`, not pushed, live
   telemetry confirm pending.)

## Recently shipped

- **world-origin spawn-once-body centering** (2026-06-04) — single (non-binary)
  system stars, planet orbit rings, and asteroid belts were spawned at the raw
  scene origin and never rewritten per-frame, so in warp-reached systems they
  were displaced from the barycenter by `worldOrigin`-at-spawn (star "above the
  orbital plane"; rings/belts off-center). Fix: seed each into the rebased frame
  at spawn via `WorldOrigin.placeInRebasedFrame` (`main.js` single star @3557,
  binary-star rings, planet ring, belt; new `WorldOrigin.js` export). TDD'd
  (`tests/orbit-ring-rebase.test.js` — star invariant + characterization), Tester
  PASS, verified live: single-star `|planet−star| == orbitRadiusScene` 0% error +
  coplanar, planet rings centered on star/barycenter with exact radii, binaries
  unaffected. (WU7a `3946dca` deployed alongside — Tester PASS, planets render
  clean.)
- **Audit-3 remediation WU1 + WU3 + WU5** (2026-05-31) — three audit-3 bug-fix
  work-units shipped to production, each one commit + Tester PASS + deploy green:
  WU1 camera FrameDiagnostics ruler + NaN guard (`416a171`); WU3 disposal
  completeness across renderers + tunnel star-wrap seam (`45866f9`); WU5
  binary-system planet light-direction rebase fix (`fe9303a`). Plan + remaining
  WU6-WU9 in `~/briefings/well-dipper-audit3-remediation-plan.md`.
- **deep-sky-cleanup dead-code follow-up** (2026-05-31, `d018c60`) — multi-agent
  blast-radius audit of the cleanup found 0 bugs / all KEEP paths intact; only
  residue was orphaned `_navigable` machinery (the deleted `spawnNavigableDeepSky`
  was its sole writer). Removed `buildNavigableQueue`/`populateNavigableQueueRefs`,
  7 always-false branches, 8 always-true conjuncts, orphaned `simRandom` import;
  −160 LOC, no behavior change. Audit report:
  `~/briefings/well-dipper-deepsky-blast-radius-audit-2f1a878.md`. (Audits #3 bug /
  #2 architecture / #1 whole-codebase queued for later sessions.)
- **`deep-sky-cleanup-2026-05-29` SHIPPED** (2026-05-30) — removed the legacy
  random dice-roll arrival (`deepSkyChance` roll + `DestinationPicker` deep-sky
  weights/helpers + `spawnNavigableDeepSky` + `'deepsky'` audio track + autopilot
  deep-sky tour stops); −351 LOC. Every warp now lands a real star-system or
  explicit target. 3 KEEP paths intact (title backdrop, debug gallery,
  external-galaxy click). All 5 ACs verified live (chrome-devtools GPU); pushed
  to production GitHub Pages.
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
- **Christian (Max's brother) music tracks status** — `hyperspace / warp-charge / arrival` wired in MusicManager but absent on disk. (`deepsky` track removed from the list in deep-sky-cleanup, shipped 2026-05-30.) Status of brother's deliveries unknown.

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
