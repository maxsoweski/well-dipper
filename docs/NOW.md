# Now — Well Dipper

**This file changes every session. It's the single screen that says where we are.**

For longer arc, see `JOURNEY.md`. For meta-purpose, see `HEART_OF_DESIRE.md`.

Last updated: 2026-06-10 by working-Claude (flash session: **Max's entry flash FIXED `4278037`, VERIFIED_PENDING_MAX.** Root cause was NONE of the handoff's 4 candidates — it predates the swap: `updateTraversal` ran in simStep (60Hz) while the rendered camera interpolates per render frame (240Hz), so the camera crossed Portal A's plane up to ~4 rendered frames before the mode flipped; those frames drew stencil-ON with the disc behind the camera → empty stencil mask → tunnel invisible → ~3 frames (~12ms) of raw origin sky. Proven by in-page per-frame canvas capture frame-aligned with signed plane distance (sky-bright frames == sd<0 ∧ OUTSIDE_A exactly, 2 pre-fix warps). Fix: detection moved to renderFrame after camera interpolation. Post-fix: 3 warps, 0 stale frames (was 3/warp), flat crossing brightness, no AC4/AC10 warnings. Headless 54/54. Prior session's 3 goals all VERIFIED_PENDING_MAX `c85480f`. TEMP `__swapTiming` instrumentation still in main.js — remove before workstream ships. **Pushed + Pages deploy green 2026-06-10. Flash fix UAT-PASSED, belts CONFIRMED, far-opening residual CONFIRMED FINE — Max, post-fix ride. All 3 goals + flash SHIPPED.** Next (Max, 2026-06-10): arrival distance — exit farther from system center so star(s) show as billboards on emergence, consistent with the starfield-version of the star seen from the origin system when warping via starfield targeting (vs nav comp). **ARRIVAL-DISTANCE IMPLEMENTED same day (`4afd58e` `29405f5` `04d3437`, master, unpushed): orbitDist now derived from new `StarFlare.billboardSwitchDistance()` × 1.3 (knob `window._warpArrivalMargin`), both warp paths, binaries take max+sep. Spec/plan in docs/superpowers/{specs,plans}/2026-06-10-warp-arrival-billboard-distance*. 6/6 unit tests; subagent spec+quality reviews clean. **Live verify (Task 3) COMPLETE — ARRIVAL-DISTANCE VERIFIED_PENDING_MAX `04d3437`.** 5 controlled warps all-state-tools (no screenshots, game muted per Max's directives): warp 1 full PASS (prior session), warp 3 starfield emergence PASS w/ in-eval center-raycast + >100px mesh sweep (only sky-dome scenery; NO giant flare — §3 anomaly did NOT reproduce at 2 instrumented emergences, CLOSED as runaway-tour scenery), LOD crossover observed BOTH directions (disc 3186–3408 / billboard ≥3631, brackets switchDist ≈ emergence/1.3), nav-comp path PASS via real AutopilotNavSequence (overlay→commit→dispatch→arrival), binary (M+M, seed 175217743) BOTH stars `bbVis=true, discVis=false` at emergence incl. the dim-companion +sep worst case, large-orbitDist arrival ~4.9k units clean. Note: dist-at-idle-detection jitters around orbitDist (coast before / fly-in after the idle flip) — invariant is billboard-range emergence, held every observation. Console: only the known pre-existing travel-telemetry oscillation warning; no AC4/AC5. Fresh: 6/6 unit, build clean. Seed-targeted nav-data warps work from console (replicate `_setWarpTargetFromNavStar` field writes on `window._warpTarget` + `_beginWarpTurn`). **Max UAT next: ride starfield + nav-comp warp, tune `window._warpArrivalMargin` (default 1.3, read per-warp) — confirmed value gets baked. Then remove TEMP `__swapTiming` + push on Max's word.**

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
**3-goals session 1 (2026-06-10): Goal 1 shipped `ec47b84` (spawn 10u, live-verified,
window._warpPreviewDist UAT knob). Goal 3 partially fixed `db2388d` (swap compile
gate; stall inventory + open leads in handoff). Goal 2 statically diagnosed
(logdepthbuf mismatch), no fix yet.**
**3-goals session 2 (2026-06-10 cont.): Goals 2+3 FIXED** (`81fe37b` `094e8a2`
`f75842e` `c85480f`). **All 3 goals VERIFIED_PENDING_MAX. Max RODE it → flagged
"a little flash where the tunnel disappears after we enter it."**
**Flash session (2026-06-10): FIXED `4278037`, UAT-PASSED + SHIPPED (deployed)** —
sim-vs-render cadence bug at the Portal-A crossing, NOT a swap/load artifact; no
latency spent (Max's offered levers unneeded — load was already hidden; see
Last-updated line). Known residual nobody has felt yet: the far-end opening shows
black (gated sky) for the ~0.4s compile
window post-swap, then destination stars pop in — small (3u opening at ~60u),
measured sub-0.2%-of-pixels; fix candidates exist (keep old sky alive through
the gate) if he feels it. Other residuals: one unattributed ~530ms hyper frame
(1-in-10, likely GC).
**Handoff trail: `/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-10b.md`** (its
§0 candidate mechanisms 1-4 all ruled out by evidence; §3 test method still current).
Older: `/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-10.md` (§3 test method
still current; §1-2 closed).
Older context: `/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-09b.md`,
`/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-07b.md`,
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

0. **`planet-refinement-campaign` — Phase 4a DONE 2026-06-10
   (`deedff6`…`244368e`): all 8 fluvial+aeolian cards built + verdicted —
   F14/F16 🟢, F12/F13/F15/F19/F20/F21 🟡 taste-call. Heavy loop per
   §13.4 (subagent implement → adversarial review → live A/B pixel-diff
   verify on :9223). Notable: F19's hostGrad = gradIn − gradBase trick
   (additivity contract comment at the call site); 2 tuning cycles burned
   on band-coverage defaults (F13 width, F21 plateau level — absolute-h
   masks bite low-relief worlds). Lab method note: editing
   planet-lod-lab.html Vite-reloads the :9223 page — FIXED 2026-06-10
   post-4a: the lab now persists the full GUI scenario (preset/solo/
   distance/knobs) to sessionStorage across reloads, verified end-to-end
   (tracer survived a real Vite reload). Fresh tabs still boot defaults;
   ?fresh=1 opts out / clears. Vitest 19/19; evidence shots in
   repo root (F13-*/F15-*/F16-*/F19-*/F20-*/F21v2-*).** Next: Max starts
   a FRESH session and pastes the tracker's **Phase-4b `/goal` launch
   card** (atmosphere pass, F24-F33, 10 cards). Phase-3 notes (setPreset
   doesn't re-derive drivers → call `_lab.applyDrivers()`; zero
   uCloudCoverage before pixel-diffs) still apply.
1. **`warp-landing-strip-persists` Max UAT** — confirm the fix in Max's
   browser, then flip to Shipped + push.
2. **`warp-tunnel-second-half-not-rendering`** — **SHIPPED 2026-06-10:
   Max UAT-passed ("Looks like it works!") `1787c3f` + `2c23ee8`, pushed
   same day** (no rewrite needed). Arrival-distance (`04d3437`) UAT-passed
   in the same ride — margin stays at default 1.3 (no tune requested). TWO independent causes, both reproduced per-frame on GPU 9223
   after Max's UAT report ("freeze + second half missing on binary
   destinations"): (a) Portal-A re-anchor margin 1e-10 < float64 rounding
   at destination coords → spurious INSIDE→OUTSIDE_A one frame post-swap
   → disc B can never reveal, AC4 silent; binary correlation was larger
   orbitDist coords, not binarity. Margin → 0.5u + anchor from portal pos.
   (b) Null-seed known objects (IC1396/IC434/CasA/IC2602 — no messier/ngc)
   crash SkyFeatureLayer._hashSeed inside onSwapSystem → gate held, AC4
   stall, arrived system stranded with no sky/starfield. Seed falls back
   to catalog key + _hashSeed fails soft. 12-warp post-fix ride clean
   (dotA −0.5 invariant, everB all warps incl. binaries); IC1396-adjacent
   warp clean + follow-up warp not stranded. Tests:
   `portal-traversal-margin.test.js`, `known-object-feature-seed.test.js`.
   **NEW LATENT BUG found while pinning (separate, unfixed): IC434
   Horsehead shares IDENTICAL galacticPos with M78 and the known-object
   injection dedup splices it — Horsehead never renders anywhere.**
   Also shipped 2026-06-10: **default-mute** (`19134e9`) — app opens
   silent every load; session-only "Sound Enabled" checkbox in settings.
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
