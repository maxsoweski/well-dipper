# Workstream: inspection-layer-v2 Phase A — cheap analytic primitives (2026-05-08)

First phase of `docs/PLAN_inspection-layer-v2.md`. Establishes screen-space + camera-distance + real-frustum analytic primitives in the scene-inventory API. Foundation for Phases B-G; most subsequent phases compose against these primitives.

## Why we care

Per the 2026-05-08 framework correction (`feedback_integration-must-cover-visible.md`): for visible-behavior projects, integration coverage must catch every visible defect programmatically before UAT runs. The current inspection layer (shipped in `welldipper-scene-inspection-layer-2026-05-06`) covers naming, categories, predicates, golden-snapshot scaffold — but has NO surface for "is this entity actually visible on screen, at what size, in what frustum position." That gap is why `runWarpSuite` PASSed while Max watched 4 visible defects unfold (no fold-in, mid-warp freeze, landing-strip accumulation, Sol-not-rendered).

Phase A closes the screen-space dimension of that gap. After Phase A, defects like "Sol claims loaded but camera 100M units away from body.planet.earth" become a one-line predicate FAIL instead of a Max-eyes catch. That's the bar.

The phase is also load-bearing for Phase B (frame timing), C (cross-event state), D (pixel-buffer + filmstrip), E (re-author warp tests), F (triage fixes). All depend on the inventory shape being extended with screen-space data.

## Current objective + success criteria

**Objective:** Every entry in `takeSceneInventory(...)` output that has a `worldPos` field (meshes, particles, lights with positions) ALSO has computed screen-space + projected-size + camera-distance + real-frustum-intersect data. Predicates expose the new fields ergonomically so future briefs write `meshOnScreen('effect.warp.tunnel', minPixelArea: 1000)` instead of hand-rolling projection math each time.

**Success criteria (in Max's language):**

1. **Every renderable inventory entry has `screenSpace: { x, y, depth, inViewport }`.** Computed via `Vector3.project(camera)` from `worldPos`. `x` and `y` are in pixel coordinates (0..viewport.width / 0..viewport.height). `depth` is NDC z (-1..1). `inViewport` is true when 0 <= x <= width AND 0 <= y <= height AND -1 <= depth <= 1.
2. **Every renderable inventory entry has `projectedSize: { width, height, pixelArea }`.** Computed by projecting all 8 corners of `Box3.fromObject(mesh)`, taking min/max in screen space. `width` and `height` in pixels; `pixelArea = width * height`.
3. **Every renderable inventory entry has `apparentDegrees` and `estimatedPixelCoverage`.** Computed from `boundingSphereRadius / cameraDistance` (the angular size formula): `apparentDegrees = 2 * atan(radius / distance) * 180/PI`. `estimatedPixelCoverage` cross-checks `projectedSize.pixelArea` against angular size — if they disagree by >2x, flag as a numerical sanity warning.
4. **Every renderable inventory entry has `cameraDistance`.** Euclidean distance from `worldPos` to `camera.getWorldPosition()`. In world units.
5. **Every renderable inventory entry has `realFrustumIntersect: boolean`.** Computed via `THREE.Frustum.setFromProjectionMatrix(camera.projectionMatrix * camera.matrixWorldInverse).intersectsObject(mesh)`. This is the rigorous test, distinct from the existing `inFrustum` flag (which was an axis-aligned approximation in the partial layer).
6. **Predicate `meshOnScreen(name, options)`** returns PASS when the named mesh's `screenSpace.inViewport === true` AND `realFrustumIntersect === true` AND `projectedSize.pixelArea >= options.minPixelArea` (default 1).
7. **Predicate `meshAtViewportPosition(name, options)`** returns PASS when the named mesh's `screenSpace.{x,y}` falls within the specified viewport region (e.g., `{ region: 'center', tolerance: 0.1 }` or `{ x: 960, y: 540, tolerance: 50 }`).
8. **Predicate `meshApparentSize(name, options)`** returns PASS when the named mesh's `apparentDegrees` is within the specified bounds (e.g., `{ min: 0.5, max: 30 }`).
9. **Predicate `cameraNear(name, options)`** returns PASS when the named entity's `cameraDistance < options.maxDistance`. Catches the `enterSol claims Sol but camera 100M units from body.planet.earth` defect class directly.
10. **Existing `runIntegrationSuite` and `runWarpSuite` continue to PASS** with no regressions to existing assertions. The new fields are additive.
11. **Phase-A-specific integration test** added to `__wd.runIntegrationSuite()` (or a new `__wd.runPhaseATests()` if cleaner) that exercises all 5 new fields + all 4 new predicates against the current Sol scene. Concrete fixtures: e.g., `body.planet.earth` should have `screenSpace.inViewport === true` from default Sol camera position, `apparentDegrees > 1`, `cameraDistance` within expected range. The mystery defect from prior session — Sol-claimed-but-camera-far — is caught HERE if it exists; if integration tests FAIL, that's the right behavior (regression IS integration failure per `feedback_pass-fail-vs-diagnostic.md`).

## Architectural connections

### Inputs (what this consumes)

- **`motion-test-kit/scene-inventory-adapter.js`** — adapter where new field-derivation logic lives. Vendored at `vendor/motion-test-kit/`. Edits land in kit first (with kit-side unit tests) then sync to vendor.
- **`motion-test-kit/predicates/*.js`** — predicate library; new predicates added as new files OR appended to an existing file (PM-during-execution decision; smallest unit).
- **Three.js APIs:** `Vector3.project(camera)`, `Box3.setFromObject(mesh)`, `Frustum.setFromProjectionMatrix`, `Frustum.intersectsObject`. All stable in r183 (well-dipper's pinned version).
- **Existing inventory shape** at `vendor/motion-test-kit/scene-inventory-adapter.js` — extended, not replaced. Backward-compat: existing fields stay; new fields are additive.
- **Existing predicates** in `vendor/motion-test-kit/predicates/` — referenced for naming convention + return-shape consistency.

### Outputs (what depends on this)

- **Phase B** (frame timing) — composes against the extended inventory shape.
- **Phase C** (cross-event state diff) — `entityCountStableAcross` predicate uses screen-space data to filter "entities visible to user" vs "off-screen entities."
- **Phase D** (pixel-buffer + filmstrip) — `screenSpace` data is the index for which regions of the captured frame to diff.
- **Phase E** (re-authored warp tests) — re-uses the 4 new predicates extensively.
- **All future runtime-behavior workstreams** — the screen-space surface is the new default for "is this thing visible to the user" assertions.
- **`well-dipper-progress.md` testing roadmap section** — Phase A's status entry replaces the current "queued" placeholder.

### Features that must stay working (regression-prevention checklist)

- `__wd.takeSceneInventory(...)` — extended shape; no field removal.
- `__wd.runIntegrationSuite()` — all 19 existing tests continue to PASS.
- `__wd.runWarpSuite()` — current behavior preserved; the 2 regression detections still fire (will be re-authored as integration-test FAILs in Phase E, NOT Phase A).
- `motion-test-kit` baseline unit suite (191 tests in kit, 30+ integration in well-dipper) — no regressions.
- The Shift+I inspector panel — the new fields appear in the JSON tree if categorized correctly; panel rendering unchanged.
- Production-bundle drift guard at `scripts/check-prod-no-inspector.sh` — still PASSes (the new code is dev-only via `import.meta.env.DEV`).
- Performance: per-snapshot computation cost stays under ~16ms for a typical Sol scene (~50-100 entries). Projection math is cheap; budget set as a precaution.

## Test Coverage Plan

Per the new three-layer framework (`docs/TESTING_CONVENTIONS.md`). Phase A is a runtime-behavior workstream; UAT applicable but presupposes integration GREEN.

| AC | Unit coverage | Integration coverage | UAT coverage |
|---|---|---|---|
| 1 `screenSpace` | Kit-side `tests/scene-inventory-screenspace.test.js` — pure-function tests against synthetic camera + mesh fixtures. Covers in-viewport / off-viewport / behind-camera / extreme-z cases. | `__wd.runPhaseATests()` exercises against live Sol scene; asserts body.planet.earth has expected screenSpace.x within ~10% of viewport center when camera is in default Sol position. | UAT N/A for AC1 alone — internal data shape, no user-visible behavior. Bundled into AC10/11 UAT below. |
| 2 `projectedSize` | Kit-side unit test — Box3 corners projection against synthetic geometries. Edge case: zero-size mesh returns 0 area, not NaN. | `__wd.runPhaseATests()` — body.planet.earth should have pixelArea > 100 in default Sol view, < 5 from far enough back. | Bundled into AC11 UAT. |
| 3 `apparentDegrees` | Kit-side unit test — angular-size formula against known radius/distance pairs. Covers radius=0, distance=0 (edge cases return 0 not Infinity/NaN). | `__wd.runPhaseATests()` — body.planet.earth apparentDegrees within expected range from default Sol camera. | Bundled into AC11 UAT. |
| 4 `cameraDistance` | Kit-side unit test — Vector3.distanceTo against synthetic camera + worldPos. | `__wd.runPhaseATests()` — body.planet.earth cameraDistance within expected range. | Bundled into AC11 UAT. |
| 5 `realFrustumIntersect` | Kit-side unit test — Frustum.intersectsObject against synthetic mesh + camera. Covers in-frustum / out-of-frustum / partial-clip / behind-camera / mesh-larger-than-frustum cases. | `__wd.runPhaseATests()` — body.planet.earth realFrustumIntersect === true in default Sol view. | Bundled into AC11 UAT. |
| 6 `meshOnScreen` predicate | Kit-side `tests/predicates-screenspace.test.js` — PASS / FAIL / missing-name paths. | `__wd.runPhaseATests()` — assertion against Sol scene. | Bundled into AC11 UAT. |
| 7 `meshAtViewportPosition` predicate | Kit-side unit test — region presets + tolerance edges. | `__wd.runPhaseATests()` — assertion against Sol scene. | Bundled into AC11 UAT. |
| 8 `meshApparentSize` predicate | Kit-side unit test — min/max bounds + edge cases. | `__wd.runPhaseATests()` — assertion against Sol scene. | Bundled into AC11 UAT. |
| 9 `cameraNear` predicate | Kit-side unit test — distance threshold + missing-name path. | `__wd.runPhaseATests()` — explicitly catches the prior-session Sol-not-rendered mystery: if camera is NOT near body.planet.earth after enterSol(), the assertion FAILs. **Expected to either PASS (mystery was transient) or FAIL (mystery still present, fix routes to a defect resolution).** Per `feedback_layer-routes-defect-resolution.md`, integration FAIL → fix in-stream OR scope a triage workstream. | Bundled into AC11 UAT. |
| 10 No regressions | Existing well-dipper unit suite (`npm test`) — 233/237 baseline preserved. Existing kit unit suite (`cd vendor/motion-test-kit && npm test`) — 191/191 preserved. | Existing `__wd.runIntegrationSuite()` (19 tests) + `__wd.runWarpSuite()` — both PASS at the to-be-shipped commit. | UAT N/A — regression coverage is integration-layer. |
| 11 Phase A integration test | N/A — single test runner, not a unit. | `__wd.runPhaseATests()` (or extension to runIntegrationSuite) — at least 9 assertions covering each new field + predicate against live Sol. | Max in his real Chrome at `localhost:5174/well-dipper/?lab=1` runs `await __wd.runPhaseATests()` from console after Tester PASS. Evaluates: does the API surface feel ergonomic to write predicates against? Are field names self-documenting? Is the runner output legible? Per `feedback_drive-vs-watch-distinction.md`, this is real UAT — Max's hands, Max's environment. |

### Coverage notes

- **Performance budget** is informally checked but not asserted in tests: working-Claude self-checks `__wd.takeSceneInventory()` round-trip stays under ~50ms for a typical Sol scene before flipping to Tester. If significantly slower, scope a perf pass before shipping.
- **Backward-compat:** the new fields are additive. Existing assertions referencing the inventory shape (e.g., the partial layer's `inFrustum` flag) stay valid. PM does NOT remove `inFrustum` in this phase even though `realFrustumIntersect` supersedes it — that cleanup is a follow-up.
- **Phase A does NOT re-author runWarpSuite.** Re-authoring belongs to Phase E. Phase A's integration tests are NEW assertions in a new runner (`runPhaseATests`), exercising the new primitives. The existing `runWarpSuite` continues to report its 2 regressions in current diagnostic shape; converting to integration-FAIL framing happens in Phase E.

## In scope

- Extending `motion-test-kit/scene-inventory-adapter.js` with the 5 new fields per renderable entry.
- Adding 4 new predicates to `motion-test-kit/predicates/`.
- Kit-side unit tests for the 5 fields + 4 predicates.
- Well-dipper-side integration runner (`__wd.runPhaseATests` OR extension to existing `runIntegrationSuite`) — execution-time PM decision based on suite-organization clarity.
- Vendoring updated kit into well-dipper (`vendor/motion-test-kit/` sync).
- Updating `docs/testing/scene-inspection-integration-tests.md` Group H or new Group J with the Phase A test list.
- Updating `well-dipper-progress.md` testing roadmap with Phase A status entry.
- Tester verdict at to-be-shipped commit covering Unit + Integration; UAT deferred to Max GATE 3 in real browser.

## Out of scope

- **Re-authoring `runWarpSuite`** — Phase E concern.
- **Cleaning up the obsolete `inFrustum` flag** — follow-up workstream after Phase A ships.
- **Phase B's frame-timing primitives** — separate workstream; can run parallel after Phase A.
- **Phase C-G work** — dependent on Phase A landing; queued.
- **Fixing any defect that Phase A's integration tests catch** (e.g., Sol-not-rendered) — per `feedback_layer-routes-defect-resolution.md`, defects route to in-stream fix OR triage workstream depending on size. PM judges at integration-FAIL time.
- **Performance optimization of the projection math** — unless self-check exceeds the ~50ms budget, default to "ship and optimize later if needed."
- **Documentation updates beyond the testing-doc + progress-file entries** — persona docs, METHODOLOGY-equivalents are not Phase A's burden.

## Drift risks

- **Cross-event-state defect masquerading as a Phase A failure.** If the Sol-not-rendered mystery is actually a state-leak across enterSol() invocations, `cameraNear` will FAIL for reasons Phase A can't fix — that's Phase C territory. Resolution: Phase A integration test FAIL is correctly signaling the bug; routing decision happens at FAIL time.
- **Smallest-unit drift.** Plan recommends bundling all 5 primitives in one commit. During execution, if working-Claude finds a primitive blocks others (e.g., `realFrustumIntersect` setup affects how `screenSpace` projects), break into sub-units — one primitive per commit. Per Max's directive: "treat each of these as its own unit (meaning you'll need to figure out what the smallest unit of each is as you go)."
- **Vendoring drift.** Kit edits land in `~/projects/motion-test-kit/` first, then `cd ~/projects/well-dipper && git submodule update --remote vendor/motion-test-kit && git add vendor/motion-test-kit && git commit`. If the smoke test in `examples/three-vite-smoke/` doesn't exercise the new fields, add a smoke assertion before vendoring.
- **Three.js API surface changes between r183 (well-dipper) and kit's expected version.** Audit at execution time: `Vector3.project`, `Box3.setFromObject`, `Frustum.setFromProjectionMatrix` all stable in r183 per `library-context` cached brief.
- **Performance regression in the inspection layer itself.** If snapshot time crosses the budget, the layer becomes too slow for routine use — defeats its own purpose. Self-check before flipping to Tester.

## Handoff

**Active workstream pointer:** set via `~/.claude/state/dev-collab/set-active.sh well-dipper inspection-layer-v2-phase-a-cheap-analytic-primitives-2026-05-08` immediately before working-Claude starts execution.

**Tester invocation after coherent unit lands:** `Agent(subagent_type="tester")` with brief path = this file. Tester verdicts append to `~/.claude/state/dev-collab/tester-audits/inspection-layer-v2-phase-a-cheap-analytic-primitives-2026-05-08.md`.

**Three-Max-gate loop** (per `feedback_one-feature-at-a-time.md`):
- **Gate 1:** Max reviews this brief, greenlights or revises.
- **Gate 2:** working-Claude executes one phase/sub-unit, demos, waits for Max's "go to Tester."
- **Gate 3:** Tester PASS → Max confirms in his real browser at `localhost:5174/well-dipper/?lab=1` (presupposing dev server up, audio muted per `feedback_default-mute-audio-in-dev.md`, Sol entered via lab-mode). UAT items in AC11.

**Push-on-shipped:** well-dipper is established-deploy. Shipped flip → `git push origin master` → verify deploy. Per `feedback_push-on-shipped.md`.

**Queued downstream:** Phase B (frame timing) is the next-most-decoupled phase; can be PM-scoped in parallel with Phase A's execution if Max wants. Phase C-G wait for predecessors per the dependency tree in `docs/PLAN_inspection-layer-v2.md`.

## Status

**Shipped `781a5f2` — 2026-05-09.** Tester PASS at `08c0560` (substantive Phase A surface) + Tester PASS at `781a5f2` (UAT-keybind scaffold polish). Max UAT GATE 3 evidence (real Chrome, localhost:5174): F2 → 11/11 Phase A; F3 → 19/19 integration; F4 → H/I diagnostic-class as designed. Polish commits since first PASS: `66d88fb` (Shift+P + toast), `ca2e8d0` (F-key migration), `781a5f2` (enterSol gate + copy button).
