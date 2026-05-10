# Workstream: Warp landing strip persists + multiplies post-warp (2026-05-10)

**Slug:** `warp-landing-strip-persists-2026-05-10`
**Status:** PM-scoped (proxy authoring). Awaiting Max GATE 1.
**Predecessors:** `ship-scanner-2026-05-09` (Shipped `30aa1cf`), `reticle-ghosting-fix-and-ui-overlay-inspection-2026-05-09` (Shipped same sha).

## Why

Max reported during 2026-05-10 session: "the warp landing strip that keeps multiplying and following the player around."

The integration suite (`runWarpSuite`) has tracked this as a known regression diagnostic for several sessions — H/I checks emit a `'LANDING-STRIP PERSISTS POST-WARP (reticle-persists-after-warp)'` finding when post-warp samples show `landingLive === true`. Per `feedback_pass-fail-vs-diagnostic.md` retired-2026-05-08 in favor of regressions-as-failures, this should be treated as a real bug to fix and gate, not a perpetual diagnostic.

Symptoms (Max's verbatim):
1. **Multiplying** — landing strip appears more than once after warp.
2. **Following the player around** — strip persists in or near view as the camera moves through space, instead of staying anchored at the destination arrival point.

The new screen-space inspection layer + `ui.reticle.*` synthetic entries + `runShipScannerBurnArrivalTest`-style telemetry harness (built in the prior workstreams that just shipped) are the right diagnostic surface for this regression. We can sample `effect.warp.landing-strip` mesh entries across warp lifecycle phases and assert exactly-one-instance + post-warp-cleanup.

## What

Single deliverable: **diagnose + fix + lock-in via integration test**. The work has three coupled parts:

### Part A — Diagnostic harness via inspection layer

Extend `runWarpSuite` (or author a sibling `runWarpLandingStripRegressionTest`) to:
- Drive a real warp (ship + Sol → some destination), sampling inventory at high cadence across `idle → fold → enter → hyper → exit → idle` phases.
- For each sample, count meshes named `effect.warp.landing-strip` AND meshes whose visible+inFrustum state would render them.
- Assert: at most ONE landing-strip mesh exists at any phase. (AC: `count <= 1`.)
- Assert: post-warp (≥ 2s after final `idle`), `landingLive === false`. (AC: cleanup.)
- Assert: during `OUTSIDE_B` (destination-side post-emergence), strip is positioned at the destination arrival region, not following camera. (AC: position stable in world frame, not tracking camera position.)

Per session evidence: the existing `runWarpSuite` H2/I1/I1b diagnostics already partially capture this (landingLivePostWarp count + finding string). Reframe those as gate-class assertions for this workstream, and add a "follows-player" assertion via position-vs-camera correlation across post-warp samples.

### Part B — Root-cause investigation

Probable cause vectors (don't pre-commit; the integration test isolates):
- **Multiplying:** `_createLandingStrip` may be called more than once across warps if WarpPortal isn't being properly re-used. Or the GLTF/sprite children of `_landingStrip` accumulate.
- **Following:** `warpPortal.group.position` is set in `open(position, direction)`. If `open()` is called again with `position = camera.position + offset` (warp re-init), the strip moves with the camera. Or `setTraversalMode('OUTSIDE_B')` keeps the strip visible after warp completes.
- **Cleanup gap:** `warpPortal.close()` only sets `group.visible = false` — doesn't clear traversalMode or reset landingStrip state. Subsequent warp `open()` may re-show without resetting.

Files to investigate:
- `src/effects/WarpPortal.js` — `open()`, `close()`, `setTraversalMode()`, `_createLandingStrip()`, the per-frame `update()`.
- `src/main.js` — warp lifecycle hooks: where `warpPortal.open()`, `close()`, and `setTraversalMode()` are called. Search for `warpPortal\.` to enumerate all call sites.
- `src/effects/WarpEffect.js` — the warp state machine. Phase transitions to FOLD / ENTER / HYPER / EXIT / IDLE. Where does the post-IDLE cleanup hook fire?

### Part C — Fix + verification

Once Part A's RED test isolates the bug, fix in-stream. Re-run the regression test; convert from RED → GREEN. No follow-up workstream unless the fix exceeds ~3 files / non-local refactor.

## Acceptance Criteria

| # | AC | Test layer |
|---|----|-----------|
| 1 | At most one mesh named `effect.warp.landing-strip` exists in `takeSceneInventory().meshes` at any warp lifecycle phase. | Integration: new `runWarpLandingStripRegressionTest` (or extension of `runWarpSuite`). |
| 2 | After warp completes (≥ 2s in IDLE phase post-warp), no mesh named `effect.warp.landing-strip` is `visible && inFrustum`. (Strip cleared.) | Integration. Currently failing as a diagnostic; convert to gate. |
| 3 | During warp post-emergence (OUTSIDE_B traversal mode, after camera exits Portal B), the landing strip's `worldPos` is stable in world frame across N samples — does NOT track camera.position with correlation > 0.1 over a 2s window. | Integration: position-vs-camera correlation assertion. |
| 4 | Existing `runWarpSuite` H1 (phase transitions) continues to PASS. H2/I1/I1b currently emit diagnostic findings — this workstream's fix flips landing-strip-related findings from "PERSISTS" to "cleared as expected." Remaining tunnel-second-half-not-rendering finding (Phase E concern) stays unaddressed. | Integration regression. |
| 5 | No regression in `runReticleInspectionTests` (6/6), `runShipScannerInspectionTests` (11/11), `runPhaseATests` (11/11), or `runIntegrationSuite` (19/19). | Integration regression. |
| 6 | Production-bundle drift guard (`scripts/check-prod-no-inspector.sh`) still PASSes. | Build-time. |
| 7 | Max UAT GATE 3 in real Chrome at `localhost:5174/well-dipper/?lab=1`: warp from Sol to a star, observe arrival. Landing strip appears ONCE at the destination arrival region, doesn't follow camera, fades / disappears as part of post-arrival cleanup. Subsequent warp from new system: same behavior — no carry-over duplicates. | UAT, Max's hands. |

## Out of scope

- Other warp-lifecycle bugs (tunnel mid-HYPER dimness, fold animation, exit/reveal sequencing). The "warp suite" tracks several diagnostics; this workstream covers ONLY the landing-strip persistence + multiplication. Other diagnostics route to separate Phase E re-author workstream.
- Visual redesign of the landing strip itself.
- Performance work on warpPortal (geometry rebuilds, etc.).
- Entry strip (`effect.warp.entry-strip`) cleanup — track separately if it has the same bug pattern; for now scope is landing strip only.

## Drift risks

- **Symptom-vs-cause confusion.** "Multiplying" could be one of: (a) multiple meshes with same name, (b) multiple sprites within a single mesh's `children[]`, (c) draw-call duplication via post-process compositor. Inspection layer surfaces (a) directly via `takeSceneInventory().meshes.filter(name === 'effect.warp.landing-strip').length`; (b) and (c) need different probes. Start with (a); if AC1 holds while Max still sees "multiplying," widen to (b)/(c).
- **State leak across systems.** Warp completes → `spawnSystem` fires → previous landing-strip should be reset. If `spawnSystem` doesn't touch warpPortal, the strip carries state. Verify in Part B.
- **Re-using the warpPortal singleton vs disposing.** If the fix attempts to `dispose()` the warpPortal between warps, that's a memory-management refactor much bigger than this scope. Prefer state-reset (visibility flags + position re-anchor) over dispose-and-rebuild.
- **Test brittleness.** A 1100ms-cadence-dependent test (similar to ship scanner burn-arrival timing) is acceptable but slow (~15s wall time per run). Document the slowness in the runner's docstring.
- **Position-vs-camera correlation in AC3.** Be careful: the strip is parented to warpPortal.group, which is set at the destination arrival area. After origin rebasing kicks in, both camera.position and strip.worldPos shift by the same offset — correlation might appear high in scene-graph coords. Compute correlation in pre-rebase delta-from-arrival-anchor space, or anchor the assertion to a rebase-invariant metric.

## Per-AC test layer

| AC | Unit | Integration | UAT |
|----|------|-------------|-----|
| 1 count ≤ 1 | N/A | `runWarpLandingStripRegressionTest` — sample inventory across warp lifecycle. | Bundled into AC7. |
| 2 post-warp cleanup | N/A | Same runner — assert post-IDLE samples have no `landingLive`. | Bundled. |
| 3 stable in world frame | N/A | Same runner — compute correlation between strip worldPos delta and camera.position delta across post-warp samples. | Bundled. |
| 4 H1 + H2/I1/I1b flip | N/A | `runWarpSuite` re-run; H2/I1/I1b "PERSISTS" findings flip to "cleared as expected." | Bundled. |
| 5 no regressions | Existing well-dipper unit suites. | All sibling integration suites GREEN. | N/A. |
| 6 prod-drift | N/A | `scripts/check-prod-no-inspector.sh`. | N/A. |
| 7 felt-experience UAT | N/A | N/A. | Max's hands: warp Sol→system, observe single landing strip stable at arrival; warp again, no carry-over. |

## Handoff

**Active workstream pointer:** set 2026-05-10 to this slug.

**Tester invocation after fix lands:** `Agent(subagent_type="tester")` with brief path = this file. Verdicts append to `~/.claude/state/dev-collab/tester-audits/warp-landing-strip-persists-2026-05-10.md`.

**Push-on-shipped:** well-dipper is established-deploy. Per `feedback_push-on-shipped.md`.

**Execution plan (suggested):**

1. **Diagnostic harness first** (Part A): write `runWarpLandingStripRegressionTest`. Run at HEAD — should FAIL on AC1 or AC2 or AC3, isolating which symptom of the bug is JS-detectable.
2. **Root-cause investigation** (Part B): with the failing test in hand, grep / read the relevant warpPortal.js + main.js paths. Don't fix until cause is named.
3. **Fix + verify** (Part C): apply minimum-viable fix; re-run the regression test; should now PASS. Re-run all sibling suites; no regressions.
4. **Tester invocation** for verdict.
5. **Max UAT GATE 3** (live in real Chrome — single warp, observe single landing strip, warp again, no carry-over).
6. **Shipped flip** + push.

---

**PM-proxy authoring note (2026-05-10):** Authored by working-Claude as PM-proxy because the `pm` subagent type is not registered in this harness (per Dev Collab OS degraded-mode rule). Structure mirrors prior briefs in `docs/WORKSTREAMS/`. Symptoms drawn from Max's verbatim 2026-05-10 message; root-cause vectors drawn from light grep of WarpPortal.js. AC3 (position correlation) is the speculative new metric — adjust during execution if telemetry surfaces a cleaner signal.
