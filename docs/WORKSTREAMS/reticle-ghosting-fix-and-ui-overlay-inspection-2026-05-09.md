# Workstream: Reticle ghosting fix + UI-overlay inspection layer (2026-05-09)

**Slug:** `reticle-ghosting-fix-and-ui-overlay-inspection-2026-05-09`
**Active workstream pointer:** set 2026-05-09 (well-dipper).
**Status:** PM-scoped (proxy authoring — see footer). Awaiting Max GATE 1 review.
**Predecessors:** `inspection-layer-v2-phase-a-cheap-analytic-primitives-2026-05-08` (Shipped `1008b5b`).
**Blocks:** `inspection-layer-v2-phase-b-frame-timing-primitives-2026-05-08` (queued, GATE 1 unstarted).

## Why

During Phase A UAT GATE 3 (2026-05-09), Max surfaced a fresh visible defect: when click-and-dragging a planet to orbit the camera, the **selected planet's** targeting reticle and body-name label duplicate with a visible ghosting trail. Non-selected reticles (hover-tentative + ghost-bracket sub-pixel bodies) render correctly under the same drag.

Two coupled motivations make this a single workstream rather than two:

1. **The bug is real and visible** — degrades the core navigation experience (selecting a target is the most-used interaction).
2. **The inspection layer doesn't see it.** `TargetingReticle` is a `<canvas id="targeting-overlay">` 2D Canvas API overlay (`src/ui/TargetingReticle.js`), not a Three.js scene-graph entity. Phase A's `takeSceneInventory()` walks the scene graph and has no path to canvas overlays. This is a real coverage gap that Max named explicitly:

> "If the reticles that render on screen are tracked by any of the systems that we've implemented, then that would be a good candidate for not only fixing the bug but testing that feature. If not, then that's okay for now, although I do want to know why reticles are not one of the things that we inventory in terms of screen space effects and assets. Let's use the unit to integration to UAT pipeline to uncover the issue, create effects, test effects, and merge."

Coupling the layer expansion to the bug fix dogfoods the layer on a real defect — the highest-signal validation of whether the layer is doing its job. If we fixed the bug visually-only without the layer, we'd merge a fix without a regression test. If we built the layer expansion without an immediate consumer, we'd ship surface that hasn't been exercised.

## What

Two coupled deliverables in one workstream:

### Deliverable 1 — UI-overlay inspection layer

Extend the inspection layer to surface targeting-reticle state with screen-space data. Recommended shape (working-Claude can revise during execution if a different shape fits the existing pattern better):

- Synthetic entries in `takeSceneInventory().meshes` named `ui.reticle.<bodyKind>.<bodyName>` (e.g., `ui.reticle.planet.earth`), one per actively-drawn reticle. The `ui.*` source tag distinguishes them from real scene-graph entries (`body.*`, `effect.*`, etc.).
- Each entry includes: `state` (`'none' | 'ghost' | 'tentative' | 'selected'`), `screenSpace { x, y }` in CSS pixels (the projected center the brackets surround), `label` (the rendered name string, or `null`), `bracketHalf` (px), `frameDrawCount` (incremented each `update()` call this frame — to detect double-rendering).
- A frame-aggregate field on the inventory root: `ui.reticleOverlay { canvasW, canvasH, dpr, lastClearAt, drawCallsThisFrame }` so tests can assert the canvas is being cleared at the expected cadence.

Alternative shape considered: a separate `takeUiInventory()` sibling. **Rejected** because the existing inventory already mixes synthetic categories (`effect.warp.tunnel`, `effect.warp.landing-strip`) with real scene-graph entries — adding `ui.reticle.*` follows the same pattern with no new API surface for callers to learn. Working-Claude may switch to a sibling API if the shape forces it during execution; flag in the commit message if so.

### Deliverable 2 — Reticle ghosting bug fix

Use the new layer surface to reproduce + fix the bug. Probable causes worth investigating (don't pre-commit to one — the integration test is what isolates):

- **Canvas not being cleared between frames during drag** (trails accumulate). Check `_clear()` (around `TargetingReticle.js:240-242`) is called every `update()` and that drag doesn't bypass `update()`.
- **Two reticle draw passes per frame during drag.** Camera orbit handlers in `main.js` may trigger a synchronous reticle update inside the drag handler in addition to the per-frame loop call.
- **DPR / canvas-resize interaction during drag.** `_resize()` listens to window resize but if drag triggers anything that mutates `this._cssW`/`_cssH` mid-frame, projection coordinates desync.
- **Pixel-snap rounding during sub-pixel motion.** The `PX = 3` retro-pixel grid (line 57) snaps coordinates — if drag motion is sub-PX per frame, multiple snapped positions could overlap.
- **Selected-state-specific render path.** Symptom is selected-only — there's a code path that runs only for selected reticles that may double-render or skip clear.

The integration test for AC8 must FAIL at HEAD (RED) and PASS after the fix (GREEN). That's how we know we fixed the actual bug, not a sibling.

## Acceptance Criteria

| # | AC | Test layer |
|---|---|---|
| 1 | `takeSceneInventory()` returns at least one `ui.reticle.*` entry whenever `TargetingReticle.update()` has drawn at least one reticle in the current frame. | Unit (kit-side inventory shape test) + Integration (`__wd.runReticleInspectionTests()` against live Sol with a target selected). |
| 2 | Each `ui.reticle.*` entry has `state ∈ {'ghost','tentative','selected'}`, `screenSpace.{x,y}` in CSS pixels (numeric, finite), `label` (string or null), `bracketHalf` (numeric > 0). | Integration — assert shape against current scene. |
| 3 | The `screenSpace` of `ui.reticle.planet.earth` (when selected) tracks the projection of `body.planet.earth` within ±2 px tolerance. | Integration — capture both, compute delta. |
| 4 | When no target is hovered or selected and no ghost targets, `takeSceneInventory().meshes.filter(m => m.name.startsWith('ui.reticle.'))` returns `[]`. | Integration — clear selection, assert empty. |
| 5 | New predicate `reticleDrawCount(bodyName, options)` returns PASS when the body's reticle was drawn exactly `options.expected` times in the most recent frame. Catches double-render bugs. | Unit (kit-side predicate test) + Integration (assert `expected: 1` for the selected body). |
| 6 | Frame-aggregate `ui.reticleOverlay.drawCallsThisFrame` equals the number of `ui.reticle.*` entries this frame. | Integration — sanity check. |
| 7 | New integration test `__wd.runReticleGhostingRegression()` drives a synthetic drag (mouse-down on selected body → mousemove sequence over ~10 frames → mouse-up) and asserts: (a) every frame during the drag has exactly one `ui.reticle.<selected>` entry, (b) `frameDrawCount` for that entry equals 1 across all frames, (c) the canvas was cleared at least once per frame (`ui.reticleOverlay.lastClearAt` advanced). **This test must FAIL at the workstream's starting commit.** | Integration only — Max UAT confirms visible. |
| 8 | After the bug fix, `__wd.runReticleGhostingRegression()` PASSes. | Integration. |
| 9 | Existing `__wd.runIntegrationSuite()` (19/19) continues to PASS. Existing `__wd.runPhaseATests()` (11/11) continues to PASS. No regressions. | Integration. |
| 10 | Production-bundle drift guard (`scripts/check-prod-no-inspector.sh`) still PASSes — UI-overlay inspection is dev-only via the same `import.meta.env.DEV` gate. | Build-time. |
| 11 | Max UAT GATE 3 in real Chrome at `localhost:5174/well-dipper/?lab=1`: enter Sol, click a planet to select it, click-and-drag to orbit camera. Reticle and label track the planet smoothly with NO ghosting trail, NO duplicate brackets, NO duplicate labels. F2/F3/F4 toasts continue to work. | UAT — Max's hands. |

## Out of scope

- **Other UI overlays** (DebugPanel, BodyInfo HUD, NavComputer, SystemMap minimap, GravityWellMap). Inspection coverage for those is a future workstream — this one covers `TargetingReticle` only.
- **Re-styling reticles** — visual design (colors, thickness, animation timing) stays as-is. Bug fix only.
- **Selection-state machine refactor** — if the bug roots into how main.js dispatches `selectedTarget`, fix the symptom (no double-draw) without restructuring the selection lifecycle. A larger refactor routes to its own workstream.
- **Phase B / C / D / E** — separate workstreams, queued.
- **Performance optimization of the reticle draw path** — unless inspection-layer self-check exceeds the per-frame budget.

## Drift risks

- **Layer scope creep.** "While we're in here, let's also cover NavComputer / DebugPanel / SystemMap." Resist — those are separate workstreams with their own ACs. If a sibling overlay is structurally entangled with `TargetingReticle` (shared canvas, shared draw path), flag at execution time and PM-revise the brief; don't silently expand.
- **Integration-test brittleness on synthetic drag.** Mouse-driven drag is timing-sensitive. The `runReticleGhostingRegression()` test must be deterministic — use synchronous frame ticks (manually call the per-frame `update()` between synthetic mouse events) rather than wallclock waits. If drag handlers depend on async event-loop ordering that resists synthesis, escalate to working-Claude — may need to expose a hook in main.js (e.g., `_lab.simulateDrag({ from, to, frames })`) similar to how `_lab.enterSol` exists.
- **Root-cause assumption baked in too early.** The brief lists probable causes; do NOT pick one before the integration test isolates it. The RED test is the diagnostic — the fix follows the diagnosis, not the suspicion.
- **Synthetic entries vs. real meshes.** Phase A's K4 test (`meshApparentSize` on a NAMED mesh with bounding sphere) explicitly filters for named meshes with bounding spheres; synthetic `ui.reticle.*` entries don't have `BufferGeometry`. Confirm Phase A predicates don't break when iterating an inventory that contains synthetic UI entries — adding entries that pre-existing predicates should ignore. If they do break, scope the predicate-filter fix into this workstream's AC9.
- **DPR-dependent flakiness.** Bug may only manifest at `devicePixelRatio !== 1`. Test environment should match Max's display DPR (capture from `window.devicePixelRatio` at test start; if test runner overrides DPR, document it).
- **Canvas-clear timing sensitivity.** `lastClearAt` semantics: the test asserts the canvas was cleared at least once per frame. If `update()` is called multiple times per frame legitimately (e.g., once for hover update, once for full render), the test must allow that — what we forbid is *not clearing* between draw passes that paint over each other.

## Per-AC test layer

| AC | Unit | Integration | UAT |
|---|---|---|---|
| 1 inventory has reticle entries | Kit-side inventory-shape test for `ui.reticle.*` filtering. | `__wd.runReticleInspectionTests()` — select Earth, assert at least one `ui.reticle.*` entry. | Bundled into AC11. |
| 2 entry shape | Kit-side type-shape unit test. | Same runner — assert each field exists + types match. | Bundled. |
| 3 screenSpace tracks projection | N/A — depends on live scene. | Same runner — projection delta < 2px. | Bundled. |
| 4 empty when no targets | N/A. | Same runner — clear selection, re-take inventory. | Bundled. |
| 5 `reticleDrawCount` predicate | Kit-side unit test (PASS / FAIL / missing-name paths). | Same runner. | Bundled. |
| 6 frame-aggregate consistency | N/A. | Same runner. | Bundled. |
| 7 ghosting regression test FAILs at HEAD | N/A. | `__wd.runReticleGhostingRegression()` — RED at start. | N/A — diagnostic. |
| 8 ghosting regression test PASSes after fix | N/A. | Same runner — GREEN after fix. | Bundled into AC11. |
| 9 no regressions | Existing well-dipper unit suite + kit unit suite. | Phase A + integration suite still GREEN. | N/A — regression coverage. |
| 10 prod-drift guard | N/A. | `scripts/check-prod-no-inspector.sh`. | N/A. |
| 11 visual UAT | N/A. | N/A. | Max in real Chrome — drag selected planet, no ghosting. |

## Handoff

**Max GATE 1:** review this brief, greenlight or revise.

**Working-Claude execution order (suggested):**
1. **Unit:** Add `ui.reticle.*` shape + `reticleDrawCount` predicate to the kit (`vendor/motion-test-kit`). Unit-test it. Vendor bump into well-dipper.
2. **Integration scaffold:** Wire `TargetingReticle` to emit per-frame state into a probe `__wd` reads from when building inventory. Add `__wd.runReticleInspectionTests()` covering AC1-6.
3. **RED test:** Implement `__wd.runReticleGhostingRegression()` (AC7). Run it — must FAIL.
4. **Fix the bug.** Diagnose from the failing test's evidence. Don't fix what isn't broken.
5. **GREEN test:** Re-run AC7's runner — must PASS. Re-run Phase A (F2) + integration suite (F3) — both GREEN.
6. **Tester invocation** — `Agent(subagent_type="tester")` with this brief path. Tester verifies via chrome-devtools.
7. **Max GATE 3** — Max in his real Chrome runs F2/F3, then drags the selected planet. Visual confirmation of no ghosting.
8. **Shipped flip** — append Status section to this brief with `Shipped <sha>`. Push origin master. Verify deploy.

**Tester invocation after coherent unit lands:** `Agent(subagent_type="tester")` with brief path = this file. Tester verdicts append to `~/.claude/state/dev-collab/tester-audits/reticle-ghosting-fix-and-ui-overlay-inspection-2026-05-09.md`.

**Push-on-shipped:** well-dipper is established-deploy. Shipped flip → `git push origin master` → verify deploy. Per `feedback_push-on-shipped.md`.

**Queued downstream:** Phase B (frame timing primitives) — brief at `docs/WORKSTREAMS/inspection-layer-v2-phase-b-frame-timing-primitives-2026-05-08.md`. Resumes after this workstream ships.

---

**PM-proxy authoring note (2026-05-09):** This brief authored by working-Claude as PM-proxy because the `pm` subagent type is not registered in the current harness (per Dev Collab OS degraded-mode rule). Structure mirrors the Phase A brief at `docs/WORKSTREAMS/inspection-layer-v2-phase-a-cheap-analytic-primitives-2026-05-08.md`. Per CLAUDE.md PM persona at `docs/PERSONAS/pm.md`, ACs are programmatically testable, OOS lines drawn, drift risks named, per-AC test layer specified. Max should review with sharper-than-usual scrutiny; if PM subagent comes back online during execution, re-invoke for revisions.
