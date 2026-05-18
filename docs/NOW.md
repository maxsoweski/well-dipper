# Now — Well Dipper

**This file changes every session. It's the single screen that says where we are.**

For longer arc, see `JOURNEY.md`. For meta-purpose, see `HEART_OF_DESIRE.md`.

Last updated: 2026-05-18 by working-Claude.

---

## Active workstream

**`warp-landing-strip-persists-2026-05-10`** — fix at `e31ee65`, Tester **VERIFIED_PENDING_MAX**.

Awaiting Max UAT GATE 3 in real Chrome: warp from Sol → another system, observe single brief landing-strip appearance at exit moment, no follow-camera, look-back shows Portal B without trailing strip. On Max PASS: flip Shipped, `git push origin master` (local ahead by 2 commits including doc updates), verify deploy.

Brief: `docs/WORKSTREAMS/warp-landing-strip-persists-2026-05-10.md`

**Maps to journey:** Closing the last visible warp-arrival defect en route to the **35% SCREENSAVER MVP shipped** milestone.

## Next 1-3 queued (in priority order)

1. **Verify gameplay music status** (KR2 of current objective). Per `MVP_SYSTEMS_REVIEW_2026-03-30.md`, explore/hyperspace/deepsky tracks were flagged as critical-blocker MISSING. Status of Max's brother's track delivery is unknown. Quick check; might already be resolved.

2. **`warp-tunnel-second-half-not-rendering`** PM-scoping. Last remaining warp regression tracked by `runWarpSuite`. Likely a substantial Phase E rewrite of the tunnel visual pipeline. Bigger scope than recent workstreams.

3. **`inspection-layer-v2 Phase B` execution.** Frame-timing primitives. Brief authored at `docs/WORKSTREAMS/inspection-layer-v2-phase-b-frame-timing-primitives-2026-05-08.md`. Test infrastructure that catches frame stalls — relevant because we've hit two FPS/stall investigations in the last two sessions.

**Maps to journey:** All three are 35% SCREENSAVER MVP milestone work.

## Recently shipped (this session arc — 2026-05-09 → 2026-05-18)

- `30aa1cf` — **Ship Scanner** end-to-end (4 units + 3 UAT rounds). Alt-toggle scanner, cyan reticles on/off-screen, click-select, burn-to-ship at 45° angular framing, ship-lock (camera follows ship's local frame), drag-rotate within ship-lock.
- `30aa1cf` — **Reticle Ghosting fix** (same HEAD, rode along). `camera.updateMatrixWorld(true)` inside `renderFrame` after interpolation block. 1-in-4 oscillation gone.
- `1008b5b` — **Phase A inspection-layer-v2 polish** (F-key UAT keybinds skip enterSol when system loaded; toast Copy button).
- New test infrastructure: `__wd.runReticleInspectionTests` (6/6), `runShipScannerInspectionTests` (11/11), `runShipScannerBurnArrivalTest` (3/3), `runWarpLandingStripRegressionTest` (3/3 post-fix).

## Open structural decisions

- **MVP-scope reconciliation.** Game Bible §1A claims SCREENSAVER "functionally complete." `PLAN_inspection-layer-v2.md` documents 5+ visible defects observed 2026-05-07 contradicting that. Needs Max decision: is "MVP done" functional-with-known-defects (Bible's standard) or zero-visible-defects (inspection-layer-v2's standard)? Surfaced in `JOURNEY.md` 35% milestone but unanswered.

- **Layer-2 (ENRICHED) PM-scoping.** Several existing one-off workstream briefs (autopilot-camera-establishing, ooi-capture-and-exposure, warp-phase-perf-pass) are Layer-2-ish but predate the Layer taxonomy. Re-evaluate under JOURNEY's 60% milestone framing once 35% milestone ships.

## Deferred (deliberate)

- **World-origin rebasing** — `PLAN_world-origin-rebasing.md`. Required before Layer-3 ship-scale features. 2-4 focused days.
- **Sol-naming triage** — `body.star.sol` not tagged in partial inspection layer. Small workstream surfaced during Phase A.
- **Ship lighting via custom shader** — emissive-only is the current workaround; scene-global THREE.Lights killed FPS. Custom star-position shader is the proper fix. Polish, not MVP-blocking.
- **Phase E warp visual rewrite** — substantial scope. Holds `warp-tunnel-second-half-not-rendering` and other accumulated warp findings.

## What's NOT in the queue right now

To make the queue legible, here's what we're explicitly NOT working on, with reasons:

- Layer-3 GAME features (rotor fuel, ship upgrades, NPC comms, combat, factions, discovery log) — gated by world-origin-rebasing AND by 35% milestone shipping cleanly first.
- New procedural generation work — Game Bible §4 generation depth is Layer-2 work; comes after 35% ships.
- Refactors not tied to a specific workstream — `feedback_simplify-when-touching-code.md` covers in-flight cleanup; standalone refactor sprees aren't in scope.

## Session checklist (start of each working session)

1. Re-read `HEART_OF_DESIRE.md` (rare change; checking we still know what we're for)
2. Skim `JOURNEY.md` current-objective section (KR status)
3. Read THIS file's Active workstream + Next 1-3 (orient to what's in flight)
4. Check `~/.claude/state/dev-collab/active-workstream.json` matches Active workstream above (if mismatched, this file is stale — update before proceeding)

## How this file updates

- **Working-Claude updates this file at session end** when work landed, when active workstream pointer changed, when something queued moves to in flight, when something completes.
- **Max edits this file** when priorities shift, when items move in/out of queue, when deferred status changes.

Don't let this file grow past one screen. If it's growing, push detail to `JOURNEY.md` (long-arc context) or to individual workstream briefs (per-feature context).
