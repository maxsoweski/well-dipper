# Plan: Inspection Layer v2 — Visible-Coverage Extension (2026-05-08)

Persistent roadmap. Each phase is its own workstream — PM-scoped, integration-tested, UAT'd separately. Save state across sessions; iterate through it.

## Why this exists

The original `welldipper-scene-inspection-layer-2026-05-06` workstream shipped a **partial** inspection layer covering: mesh / camera / light naming, multi-scene tagging, 9 inventory categories, predicate library, golden-snapshot scaffold. Tester PASSed it T1-T4 against ACs that didn't include screen-space / frame-timing / cross-event-state coverage.

`welldipper-inspection-layer-uat-2026-05-07` then ran what was framed as UAT against the partial layer. Revealed (via Max's eyes during runWarpSuite execution) three classes of visible defects the layer didn't catch programmatically:

1. No fold-in / portal-A spawn animation — state machine reports being in 'fold' phase but rendering during fold is broken.
2. Multi-second freeze mid-warp — likely tied to async system generation; not a frame-timing issue the layer can detect.
3. Landing-strip accumulation across warps (4-5 strips overlapping pre-warp from prior runs).

Plus an outstanding discrepancy: `_lab.enterSol()` reported success and inspector showed Sol's bodies in inventory, but Max watched the whole time and was never visually in Sol. Cause unknown.

Per Max's correction (2026-05-08): UAT presupposes integration is GREEN. UAT is for ergonomics / navigation, not for catching feature bugs. The features above ARE BROKEN, meaning we have not advanced past integration for them. The whole point of the inspection layer is to catch visible defects programmatically — *anything broken at a level the user can see is a failure of integration*. Current inspection layer is far below that bar.

Industry research (`feedback_research-game-dev-testing-standards.md`) confirmed: studios that hit the bar layer 4-6 mechanisms — cheap analytic asserts + deterministic clock + filmstrip + perf-budget CI gate + real-GPU smoke + bespoke state-diff harness. We need to extend `__wd` to cover the dimensions that aren't yet covered.

## The bar

> Anything broken at a level the user can see is a failure of integration. Our testing/monitoring tools are supposed to make complete integration testing possible, programmatically, without relying on visual user testing.

If a defect can only be detected by asking Max to look at the screen, that is a coverage gap in the integration framework. UAT-as-safety-net is wrong; integration must catch.

## Phases

Each is its own workstream. Smallest meaningful unit per phase. Integration-tested as we go (the new primitives must themselves be exercised before declaring the phase shipped). UAT for the phase = does the new API feel right to use (Max-with-his-hands).

### Phase A — Cheap analytic primitives

Foundation. Most other phases depend on its primitives. Adds to every mesh / asset entry:
- `screenSpace: { x, y, depth, inViewport }` via `Vector3.project(camera)`.
- `projectedSize: { width, height, pixelArea }` via projecting `Box3.fromObject(mesh)` corners.
- `apparentDegrees + estimatedPixelCoverage` from `boundingSphereRadius / cameraDistance`.
- `cameraDistance` (Euclidean to camera worldPos).
- `realFrustumIntersect` boolean from `THREE.Frustum.intersectsObject` (vs the existing `inFrustum` flag).

Plus matching predicates: `meshOnScreen`, `meshAtViewportPosition`, `meshApparentSize`, `cameraNear`.

**Catches by itself:** the camera-rendered-vs-data-reported defect (e.g., enterSol claims Sol but camera nowhere near body.planet.earth — `cameraNear('body.planet.earth', distance: 100k)` would FAIL).

**Smallest unit options:** each primitive could be its own commit (5 commits), OR all five as one commit. Recommend bundling as one commit since they share the projection-math infrastructure.

**Integration test for the phase itself:**
- Each primitive returns expected values against current Sol scene (e.g., body.planet.earth has worldPos[0] of ~3.7M, projectedSize.pixelArea > 0 if visible, etc.).
- Predicates correctly distinguish visible-on-screen from off-screen.
- Re-run `runIntegrationSuite` against the extended inventory shape — no regressions to existing tests.

**UAT for the phase:** Max uses the new predicates in console interactively, evaluates whether the API surface feels natural to write predicates against.

### Phase B — Frame timing primitives

Independent of A; can run in parallel. Adds:
- `PerformanceObserver` with `long-animation-frame` type --> `inv.timing.longFrames[]` array of {frameId, duration, blockingDuration}.
- `EXT_disjoint_timer_query_webgl2` integration --> `inv.timing.gpuPasses[]` array of {pass, duration_ns}.
- Predicates: `frameTimeBound`, `noLongAnimationFrames`, `gpuPassTimeBound`.

**Catches:** the multi-second freeze mid-warp (long-animation-frame with duration > 1000ms during HYPER would FAIL). Any future framerate regression.

**Smallest unit:** LoAF observer first (cheap, browser-native). GPU timer query second (more setup).

**Integration test:** Drive a deliberately-slow scenario (e.g., toggle a GPU-stressing flag), assert LoAF fires; remove flag, assert no LoAF.

### Phase C — Cross-event state diff

Industry-unsolved area. We invent for well-dipper. Pattern:
- `__wd.recordEventBoundary(name)` snapshots inventory at named event start/end.
- `__wd.diffAcrossEvent(name)` returns entities created vs destroyed between boundaries.
- Multi-event assertion: `entityCountStableAcross(events: [...], pattern: 'effect.warp.landing-strip')` — drive N events, assert post-state count matches expected.

**Catches:** the landing-strip accumulation. Any future state-leak class.

**Dependencies:** A's inventory shape stable; can compose.

**Smallest unit:** event-boundary snapshot + simple diff first. Multi-event predicate after.

**Integration test:** Drive 3 warps in sequence, assert post-warp `effect.warp.landing-strip` count is constant (CURRENTLY this WILL FAIL because the bug exists; that's the right behavior — the test correctly identifies the bug).

### Phase D — Pixel-buffer readback + filmstrip

Heaviest of the phases. Determinism prerequisites:
- Audit codebase for `Date.now()` / `performance.now()` reads bypassing the injectable clock.
- Ensure `bindToRAF` accumulator is the only clock for sim-tick.
- Seeded RNG (kit's Mulberry32 already in place via `SimRandom.js`).

Then:
- `__wd.captureFrame(name)` --> `WebGLRenderer.readRenderTargetPixels` + canvas blob --> PNG.
- `__wd.captureFilmstrip(scenarioFn, frames, name)` --> fixed-timestep run, capture per Nth frame.
- SSIM-based diff (BlazeDiff or implement small SSIM in pure JS) for shader-heavy frames.

**Catches:** the no-fold-in defect (filmstrip during fold phase shows expected portal-A spawn --> if it doesn't, FAIL). Any visual-fidelity regression.

**Dependencies:** C's deterministic-clock work + A's screen-space primitives.

**Smallest unit:** captureFrame first (single-frame readback). captureFilmstrip second (multi-frame). SSIM diff third.

**Integration test:** Capture a known-good Sol scene baseline; diff against re-capture immediately after; assert empty diff. Then perturb a uniform; diff non-empty.

### Phase E — Apply primitives to warp-feature integration tests

Re-author `runWarpSuite` assertions using A+B+C+D primitives:
- `noLongAnimationFramesDuringHyper(thresholdMs: 250)`.
- `meshOnScreen('effect.warp.tunnel', minPixelArea: 1000) DURING HYPER`.
- `entityCountStableAcross(3 warps, pattern: 'effect.warp.landing-strip')`.
- `filmstripMatch('warp-fold-phase-baseline')` — needs Phase D.

Expected outcome: ALL of these FAIL initially, correctly identifying the bugs they were authored to catch. That's the right behavior; re-runs after Phase F's fixes will go GREEN.

This phase is also where the **prior-work re-verification** happens: the existing `runWarpSuite` (4 layer-functionality + 2 regressions) gets re-authored under the new framework. The "2 regressions reported" is replaced by "N integration tests FAIL," which is the correct framing per `feedback_pass-fail-vs-diagnostic.md`.

### Phase F — Triage workstream — fix the bugs

Once Phases A-E are in place, every visible bug we know about is programmatically catchable. Triage workstream fixes them:
- Mid-warp freeze (likely `pendingSystemDataPromise` blocking HYPER).
- Tunnel-second-half-not-rendering.
- Landing-strip accumulation (proper teardown in completeWarpTransition).
- No-fold-in / portal-A spawn animation.
- Sol-not-rendered (whatever the actual cause is).

Each fix lands together with its catching test going GREEN. Per `feedback_layer-routes-defect-resolution.md`, integration-layer fixes happen in-stream.

### Phase G — Apply primitives to other features

After warp, similar coverage extension for autopilot, sky (galaxy / glow / feature layer), lab-mode. Smaller per-feature workstreams using the now-mature A-D primitives.

## Dependency graph

```
        +-- A (analytic primitives)
        |      |
        |      +--> C (cross-event state diff) ----+
        |      |                                    |
        +--> B (frame timing) ----------------+    |
        |                                      |    |
        +--> D (pixel/filmstrip) -------+     |    |
              [needs C's clock]          |     |    |
                                         v     v    v
                                       E (warp integration tests)
                                        |
                                        v
                                       F (triage / fix bugs)
                                        |
                                        v
                                       G (other features)
```

A unblocks the most. B is independent, can run anytime. C/D depend on A. D additionally depends on C's clock prerequisites. E waits for A+B+C+D. F waits for E (tests in place + correctly failing). G is post-F.

## Ordering rationale

Why **A first**:
- Provides the screen-space primitives every other phase composes against.
- Catches the highest-priority outstanding mystery (camera-rendered-vs-data-reported) on its own.
- Lowest novel-work content; primitives all have stable Three.js APIs.
- Smallest blast radius if it surfaces unknowns.

Why **B can be in parallel with A or right after**:
- Independent of A's inventory shape.
- LoAF is browser-native; minimal new infrastructure.
- Catches the freeze defect class on its own.
- Lower technical risk than C or D.

Why **C and D after A+B**:
- C needs A's inventory shape stable.
- D depends on C's deterministic-clock prerequisites + A's screen-space primitives.
- Higher novel-work content (C is industry-unsolved; D requires SSIM implementation choice).

Why **E after A+B+C+D**:
- Needs all four primitives to write meaningful warp-feature integration tests.
- Confirms the primitives compose correctly against a real feature.
- Surfaces gaps in primitives that need backfill before F.

Why **F after E**:
- Tests must be in place + correctly failing before fix work, so fixes have a green-target to hit.
- Avoids the ambiguity of "did the fix fix the bug or did the test just regress?"

Why **G after F**:
- F validates the framework on the highest-stakes feature (warp).
- G is then mechanical application to other features.

## Revisitation of prior workstreams (2026-05-06 onward testing-tools work)

All prior workstreams that touched the testing-tools layer were authored under the misframed framework (UAT-as-safety-net, regressions-as-diagnostics). They need re-running through the corrected process.

### `welldipper-scene-inspection-layer-2026-05-06` (Shipped partial)

- **Status correction:** Shipped partial — current dimensions (naming + multi-scene + categories + predicates + golden) are GREEN within their scope; full integration coverage requires Phases A-D additions.
- **Re-run plan:** Phases A-D ARE the proper integration coverage that the original workstream should have included. The shipped artifacts get extended, not redone.
- **No re-UAT needed yet:** integration must complete first.

### `dev-collab-three-layer-testing-2026-05-07` (Shipped, framework misframed)

- **Status correction:** Framework artifacts (PM persona, Tester persona, TESTING_CONVENTIONS template) were correct in shape but their UAT definition was wrong. Memos `feedback_pass-fail-vs-diagnostic.md`, `feedback_three-layer-test-coverage.md` already amended.
- **Re-run plan:**
  - Update PM persona with the corrected UAT definition.
  - Update Tester persona similarly.
  - Update TESTING_CONVENTIONS template + well-dipper instance.
  - Append a "2026-05-08 framework correction" section to the workstream brief documenting what the framework GOT WRONG.
- **No re-UAT needed:** framework is doc-only; corrections embed the fix.

### `welldipper-inspection-layer-uat-2026-05-07` (in progress, MISSCOPED)

- **Status correction:** Misscoped at brief time. Items were a mix of:
  - True UAT (Item 2 Shift+I panel UX, Item 3 runWarpSuite felt experience, Demo 6 of Item 1) — PASS.
  - Integration testing of the partial inspection layer dressed up as UAT (Item 1 demos 1-5 + 7-10, Item 4, Item 8) — needs re-running as integration tests under new bar (much will FAIL because primitives don't yet exist for full coverage).
  - Investigation that revealed coverage gaps (Item 5, Item 9 / runWarpSuite watch) — outcome was the gap inventory feeding this plan.
  - Items not done (Item 6 dev-workflow self-report) — defer to post-Phase-G when primitives are mature.
- **Closure:** Mark as MISSCOPED-CLOSED with reclassification documented. The valid UAT outcomes (panel ergonomics PASS, warp-watch UAT identified the visible defects) are preserved in the audit log.

### Future workstreams under the corrected framework

Any workstream that mentions "UAT" must check: are the features under test confirmed integration-GREEN? If not, the work is integration coverage / extension, not UAT. PM persona's Test Coverage Plan section enforces this distinction.

## How this plan is iterated

Save in `~/projects/well-dipper/docs/PLAN_inspection-layer-v2.md` (this file).

Each session resuming this work:
1. Read this plan top-to-bottom.
2. Check current phase status + last completed.
3. Continue from there — usually means PM-scoping the next phase as a fresh workstream.

Update the plan's "Current state" section (below) at end of each session that advances it.

## Current state (live; update as work progresses)

- Plan authored: 2026-05-08.
- Phase A: PM-scoping queued.
- Phases B-G: queued; will scope after each predecessor's Tester PASS.
- Prior workstream reclassification: queued.
- Framework artifact corrections: queued.
- The 5 visible defects + camera-rendered-vs-data-reported mystery: queued for Phase F triage; not yet scoped per-defect.

## Cross-references

- Research: `~/.claude/projects/-home-ax/memory/feedback_research-game-dev-testing-standards.md`.
- Methodology corrections (must read together):
  - `~/.claude/projects/-home-ax/memory/feedback_integration-must-cover-visible.md`
  - `~/.claude/projects/-home-ax/memory/feedback_three-layer-test-coverage.md` (updated 2026-05-08)
  - `~/.claude/projects/-home-ax/memory/feedback_pass-fail-vs-diagnostic.md` (rewritten 2026-05-08)
  - `~/.claude/projects/-home-ax/memory/feedback_drive-vs-watch-distinction.md`
  - `~/.claude/projects/-home-ax/memory/feedback_layer-routes-defect-resolution.md`
  - `~/.claude/projects/-home-ax/memory/feedback_per-fix-regression-discipline.md`
  - `~/.claude/projects/-home-ax/memory/feedback_no-time-estimates.md`
- Project conventions: `~/projects/well-dipper/docs/TESTING_CONVENTIONS.md`.
- System-wide template: `~/.claude/agents/templates/TESTING_CONVENTIONS.md` (symlink to well-dipper).
- Personas (need correction):
  - `~/projects/well-dipper/docs/PERSONAS/pm.md`
  - `~/projects/well-dipper/docs/PERSONAS/tester.md`
- Prior workstream artifacts:
  - `docs/WORKSTREAMS/welldipper-scene-inspection-layer-2026-05-06.md`
  - `docs/WORKSTREAMS/dev-collab-three-layer-testing-2026-05-07.md`
  - `docs/WORKSTREAMS/welldipper-inspection-layer-uat-2026-05-07.md`
