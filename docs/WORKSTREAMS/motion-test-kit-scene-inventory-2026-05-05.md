# Workstream: Motion Test Kit — Scene-Inventory Snapshots (technique #6) (2026-05-05)

## Status

**Shipped `1b79c785` + welldipper@`656a5854` — kit @ motion-test-kit:`1b79c785`** (Tester §T1 PASS 2026-05-06). All 20 verifiable ACs satisfied; AC #21 cross-workstream check deferred per the brief carve until `welldipper-lab-mode-2026-05-05` ships. 159 kit self-tests pass (74 baseline + 85 new). Engine-purity grep on `core/inventory/` returns zero matches — Drift risk #1 guard held.

**Scoped 2026-05-06 against motion-test-kit @ `b2b0473` + well-dipper HEAD `3345e40`.** Authored as **parallel sibling** to `welldipper-lab-mode-2026-05-05` (well-dipper-side keybind layer). Both queued for the same execution window. Each ships independently:

- This workstream is standalone kit infrastructure — usable by any host project, not just well-dipper. It does NOT need lab-mode to ship to be useful.
- Lab-mode does NOT block on this brief shipping (its Phase 1 telemetry-only fallback covers AC #3 entry-snapshot when scene-inventory isn't yet available — see `docs/WORKSTREAMS/welldipper-lab-mode-2026-05-05.md` AC #3).

This brief promotes the "Structural-visibility-class" row of the bug-class table in `docs/PERSONAS/tester.md` from **forward dependency** ("not yet implemented in the kit; lands in sibling workstream `motion-test-kit-scene-inventory-2026-05-05` as kit technique #6") to **active default**: predicate-shaped meshVisibleAt / overlayVisibleAt / passEnabledAt assertions readable by Tester from kit-shape inventory snapshots. Persona update happens in this workstream's Phase 4 — same ship, same gate.

## Parent feature

**N/A — kit infrastructure / verification-tooling workstream.** Per `docs/PERSONAS/pm.md` §"Carve-out: process / tooling workstreams," ACs are contract-shaped (deliverable interface + verifiable observation), not phase-sourced. The kit has no authored game phases of its own; its job is to *enable* per-phase structural-visibility verification on host projects' game-feature workstreams.

This is the second tooling-workstream sibling under the lab-mode-not-recordings rule (`~/.claude/projects/-home-ax/memory/feedback_lab-modes-not-recordings.md`). The two siblings together implement the new verification stack:

- **welldipper-lab-mode-2026-05-05** — interactive felt-experience surface for Max.
- **motion-test-kit-scene-inventory-2026-05-05** (this brief) — structural-visibility snapshot for Tester.

Together they retire recordings as the default Shipped-gate artifact for visible / animated / phased features — replacing them with telemetry predicates + scene-inventory snapshots + lab-mode interactive evaluation.

The kit's *consumers* for technique #6 are feature workstreams whose ACs include phase-sourced visibility criteria — examples currently in well-dipper:

- `docs/FEATURES/warp.md` §"Phase-level criteria (V1)" — every phase mentions which assets should be visible / dim / absent. The 2026-04-18 warp-hyper-dimness miss closed Shipped on symptom ACs ("stars visible in HYPER") because no kit predicate could evaluate "tunnelMesh + crowning + stars-with-correct-dimming + post-FX-pass enabled" as a structural assertion. Scene-inventory makes that assertion expressible.
- `docs/FEATURES/autopilot.md` per-phase criteria — STATION should hold reticle-overlay visible, CRUISE should not.
- DOM-overlay regressions like the 2026-05-05 reticle/runway-persist bug — overlay visibility per phase is exactly what scene-inventory captures.

## Implementation plan

N/A as a separate `docs/PLAN_*.md` doc. The phasing in §"Acceptance criteria" carries the architecture inline because the kit's API surface IS its acceptance criteria. Two reference inputs working-Claude reads first:

- The prior kit brief at `docs/WORKSTREAMS/motion-test-kit-2026-05-02.md` — same architecture pattern, same `core/` purity rule, same per-technique runbook discipline. This brief is technique #6 added to that kit's existing five.
- The lab-mode parallel sibling at `docs/WORKSTREAMS/welldipper-lab-mode-2026-05-05.md` — its AC #3 names this workstream's API surface as the "forward-dependency-aware path." If lab-mode ships first, scene-inventory plugs in via detection (`typeof window._motionKit?.sceneInventory === 'function'`); if scene-inventory ships first, lab-mode picks it up at the next iteration.

## Source material

**Read in order before authoring code:**

1. `~/.claude/projects/-home-ax/memory/feedback_lab-modes-not-recordings.md` — the rule both siblings serve. §"How to apply" subsection #2 names "scene-inventory snapshot at each phase boundary" as the structural-pass artifact.
2. `docs/WORKSTREAMS/welldipper-lab-mode-2026-05-05.md` AC #3 — the consumer's expected entry point (`window._motionKit.sceneInventory(...)` or equivalent) and the fallback structure that has to remain compatible.
3. `docs/PERSONAS/tester.md` §"Production-grade verification (post-migration)" — the bug-class table's "Structural-visibility-class" row currently named as forward dependency. Phase 4 of this brief replaces that row.
4. `~/projects/motion-test-kit/core/predicates/sample-shape.md` — the kit's existing pure-data record convention. The new `inventory` field this brief adds extends `SampleRecord` per the conventions there (no engine references, JSON-serializable, no derived fields, no nested cycles).
5. `~/projects/motion-test-kit/core/predicates/index.js` — the existing predicate function shape (`(samples, options) → { passed, violations, totalSamples }`). New inventory predicates match this shape, just reading `samples[i].inventory.*` instead of `samples[i].anchor.*`.
6. `~/projects/motion-test-kit/runbooks/01-per-frame-deltas-and-predicates.md` — runbook 06 mirrors this structure. Same five sections (When to use / How to invoke from a brief AC / What the Tester does with it / Pass-fail evidence shape / Common pitfalls).
7. `~/projects/motion-test-kit/runbooks/05-flight-recorder.md` — the additive-extras pattern this brief reuses (`bindCaptureToBuffer`'s `extras` parameter; sugar via higher-order capture wrappers).
8. The research report consumed by this brief (in PM context, not on-disk) — covers three.js scene-graph traversal, three frustum integration approaches, DOM-overlay registry, post-effect composer enumeration, sampling cadence trade-offs, SampleRecord extension shape, existing-tools survey, performance budget.

## Scope statement

Build technique #6 — **scene-inventory snapshots** — as a sixth standalone technique inside the existing motion-test-kit at `~/projects/motion-test-kit/`. The technique answers *"which renderable things existed and were active at simulation tick T?"* — a structural sibling to SampleRecord that captures asset visibility, DOM-overlay state, post-effect pipeline state, and renderer aggregate counters as pure-data JSON-serializable records.

The technique is implemented across four phases in one shipped unit (no partial consumption between phases — same constraint as the prior kit workstream). Phase 1 lands the load-bearing core: `takeSceneInventory()` adapter for three.js with manual-frustum visibility resolution. Phase 2 adds DOM-overlay registry + post-effect-composer enumeration + renderer.info aggregate. Phase 3 lands inventory predicates (`meshVisibleAt`, `overlayVisibleAt`, `passEnabledAt`, `drawCallBudget`) + a diff API (`diffInventories`) that names which assets appeared / disappeared between phases. Phase 4 lands the runbook + the Tester persona update + the cross-project smoke test that demonstrates the technique works against any minimal three.js scene.

The technique is opt-in per scenario via an `inventory` extension to the existing `SampleRecord` shape; existing predicates ignore the field. Default sampling cadence is `phaseBoundary` (cheapest, most useful — sub-millisecond cost per snapshot, only fires when host's named state field transitions). Kit also ships `everyN` and `everyFrame` cadences with explicit performance characterization. Inventory always opt-in; cheap to omit.

The kit's hexagonal architecture is preserved: pure-data inventory records and predicates live in `core/inventory/`; three.js scene-graph traversal + frustum integration lives in `adapters/three/scene-inventory.js`; DOM overlay-registry helper lives in `adapters/dom/overlay-registry.js`. `core/inventory/` MUST NOT import THREE or DOM APIs — the same Principle-5 (Model Produces → Pipeline Carries → Renderer Consumes) constraint that protected the prior workstream's Godot-portability commitment.

Skinned / instanced / batched mesh handling is carved as a known v1 limitation (manual-frustum is unsafe against skinned bounds). v2 onAfterRender-mode extension is named as future work, not in this scope.

The diff API (which-meshes-appeared-between-phase-A-and-B) is **in scope for v1** per the research recommendation — load-bearing for warp-style verification ("what disappeared between HYPER and EXIT?") and structurally hard to add later if not built into the core API shape from day one.

## How it fits the bigger picture

This workstream is the structural-visibility-class half of the verification stack the new lab-mode-not-recordings rule defines. The companion workstream (`welldipper-lab-mode-2026-05-05`) handles felt-experience-class evaluation interactively; this workstream handles structural assertions automatically.

It advances:

- **Game Bible §11 / Principle 6 (First Principles Over Patches).** The 2026-04-18 warp-hyper-dimness miss is the load-bearing precedent: Shipped flipped on symptom ACs ("stars visible in HYPER") that could not evaluate the authored experience because no structural assertion vocabulary existed for "tunnelMesh + crown + post-FX pass + dimming-pass-enabled, all together, at this phase boundary." The patch path was ad-hoc telemetry per workstream — pattern-match `WarpEffect.state` strings, peek at `tunnelMesh.visible`, screenshot at timestamps. The first-principles redesign is a structured per-phase inventory snapshot that any predicate can read like a SampleRecord. This brief is that redesign.

- **Game Bible §11 / Principle 5 (Model Produces → Pipeline Carries → Renderer Consumes).** Inventory snapshots are pure-data records emitted by `adapters/three/scene-inventory.js` (the renderer-side adapter), carried through the same `core/recorder/ring-buffer.js` pipeline as motion samples, consumed by `core/inventory/predicates.js` (engine-agnostic). A future Godot adapter is `adapters/godot/scene-inventory.js`; nothing else changes. **What violates it:** letting `core/inventory/predicates.js` import `THREE.Object3D` or `getComputedStyle` for "convenience"; embedding three.js mesh references in inventory records ("just store the mesh, we'll dereference at predicate time"); adding DOM Element references to overlay records. All three failure modes destroy portability and turn technique #6 into a three.js-private addition by accident.

- **Game Bible §11 / Principle 2 (No Tack-On Systems).** The temptation here is to bolt scene-inventory into well-dipper directly (`window._labMode.captureInventory()` in `LabMode.js`), bypassing the kit. That works for one workstream and rots into per-project private helpers across many. The kit-as-canonical-vocabulary discipline from the prior workstream — Dana's 9 named invariants made callable, runbook-documented, predicate-uniform — extends to inventory: meshVisibleAt / overlayVisibleAt / passEnabledAt / drawCallBudget become first-class predicates in a published surface, not project-private patterns reinvented per consumer.

- **Tester persona's bug-class taxonomy completion.** The post-migration table currently names four real classes (felt-experience / invariant / regression / reproducibility) plus one forward-dependency placeholder (structural-visibility). After this workstream Ships, all five rows are active; Tester has a tool for every named class. The forward-dependency annotation in §"Production-grade verification (post-migration)" gets replaced with active links into runbook 06 + predicate API.

The story for cross-project portability: well-dipper is the first consumer (via kit submodule + lab-mode integration), but the kit's existing `examples/three-vite-smoke/` already demonstrates portability for the prior five techniques. This brief extends that smoke test with a sixth-technique demonstration; any project consuming the kit later (paper-theater, lowpoly-studio if interactive, future game-shaped projects) gets technique #6 for free.

## Acceptance criteria

Contract-shaped per the §"Carve-out: process / tooling workstreams" rule. Each AC names a deliverable's interface + a verifiable observation (file at path, function returns contract-matching value, doc contains named section). Four phases; ACs grouped by phase.

### Phase 1 — Core inventory + three.js adapter (load-bearing)

1. **`core/inventory/inventory-shape.md` documents the inventory record shape** parallel to `core/predicates/sample-shape.md`. Contains: typedefs for `MeshInventoryEntry` (name, type, uuid, visible, frustumCulled, inFrustum, worldPos, layer, materialUuid, geometryUuid; optional `boundingSphereRadius`), `OverlayInventoryEntry` (id, visible, opacity, display), `ComposerPassEntry` (name, enabled, renderToScreen), `RendererInfoSnapshot` (drawCalls, triangles, points, lines, programs, geometries, textures), the top-level `SceneInventory` object, and the optional `inventory` field added to `SampleRecord`. Documents per-predicate field requirements (which inventory predicates read which fields) parallel to the table in `core/predicates/sample-shape.md`. Documents what's intentionally NOT in the shape (no THREE.Object3D references, no DOM Element references, no derived fields). Verifiable: `grep "^## " core/inventory/inventory-shape.md` returns the named sections (Shape / Required vs optional fields per predicate / Validation / Construction / What's intentionally NOT in the shape).

2. **`core/inventory/errors.js` exports `MissingInventoryFieldError` (extends Error)** with the same loud-failure-at-test-time semantics as `core/predicates/errors.js`'s `MissingFieldError`. Inventory predicates throw this error with a named message when a sample is missing a field they require — fails loudly rather than silently returning `passed: true`. Verifiable: `grep -E "from 'three'|from '@?[a-z]+/three'|window\.|document\." core/inventory/errors.js` returns zero matches; self-test imports the error class and instantiates it with a path.

3. **`adapters/three/scene-inventory.js` exports `takeSceneInventory({ scene, camera, composer?, overlayRegistry?, renderer?, meshNamePrefix?, includeBoundingSphere? }) → SceneInventory`.** Implementation MUST use manual-frustum visibility resolution as the default (per research §3 recommendation): build `Frustum` from `camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse)`, traverse via `scene.traverseVisible(callback)`, per-mesh compute `inFrustum = frustumCulled === false || boundingSphereRadius != null && frustum.intersectsSphere(...)`. The function returns a pure-data `SceneInventory` object with no THREE references in its output. Synchronous, no rAF dependency — runs at sim tick before render. Verifiable: `grep -rE "from 'three'" adapters/three/scene-inventory.js` returns matches (adapter imports allowed); self-test in `tests/scene-inventory.test.js` constructs a stubbed three.js scene (uses real `three` package as devDep) with three meshes (one inside frustum, one outside frustum, one with `visible: false`) and asserts the returned inventory's `inFrustum` field matches expectation per mesh.

4. **`adapters/three/scene-inventory.js` warns on unnamed meshes when `verbose: true`** is passed in options. Empty `name === ''` is the load-bearing assertion-key risk per research §2: predicates that assert "tunnelMesh visible during HYPER" can't run if the mesh has no name. The warning is opt-in (default `verbose: false`) so production capture isn't noisy; verbose mode is for kit-development + first-time host integration. NEVER throws on unnamed meshes — kit doesn't get to decide host project's mesh-naming policy. Verifiable: self-test with `verbose: true` against a scene containing one unnamed mesh emits a warning to stderr; `verbose: false` (default) doesn't.

5. **Skinned / instanced / batched mesh handling explicitly carved as v1 known limitation.** `adapters/three/scene-inventory.js` traverses `THREE.SkinnedMesh` / `THREE.InstancedMesh` / `THREE.BatchedMesh` instances normally but documents in a header comment block + in `core/inventory/inventory-shape.md` §"What's intentionally NOT in the shape" that:
   - For skinned meshes, manual-frustum results are unreliable (bounding sphere ≠ skinned bounds after pose update). The inventory captures the static-bounds frustum result; expect false-positives "in frustum" when the mesh is skinned outside its rest pose.
   - For instanced meshes, the inventory reports the parent `InstancedMesh` once (not per-instance). Per-instance visibility is out of scope; if needed, the host can capture instance counts separately as an extras field.
   - v2 will add `mode: 'onAfterRender'` for exact-render-set capture per research §3(b); v1 ships manual-frustum only.
   Verifiable: header comment block in `adapters/three/scene-inventory.js` contains a "Known limitations" section naming all three classes; `core/inventory/inventory-shape.md` documents the same.

### Phase 2 — DOM overlay registry + composer/renderer integration

6. **`adapters/dom/overlay-registry.js` exports `createOverlayRegistry()` →`{ register(id, selectorOrResolver), unregister(id), snapshot() → OverlayInventoryEntry[] }`.** `register` accepts either a CSS selector string OR a function `() => Element | null` (lazy resolver). The resolver is called per snapshot if no element is currently cached; null returns are tolerated (re-resolved next snapshot). Visibility check sequence per research §4: `!el.isConnected → false`; `getComputedStyle(el).display === 'none' → false`; `visibility === 'hidden' → false`; `parseFloat(opacity) === 0 → false`; otherwise `true`. Self-test in `tests/overlay-registry.test.js` registers three overlays (one connected/visible, one hidden via display, one disconnected from DOM) and asserts `snapshot()` returns the expected visibility values. Verifiable: `grep -E "from 'three'" adapters/dom/overlay-registry.js` returns zero matches (DOM-only adapter, three-free); self-test passes.

7. **`takeSceneInventory({ ..., composer })` enumerates `composer.passes` when present.** For each pass: `{ name: pass.constructor.name || pass.name || 'unknown', enabled: pass.enabled !== false, renderToScreen: !!pass.renderToScreen, needsSwap: !!pass.needsSwap }`. Duck-types on `composer.passes` array — accepts both legacy three.js `EffectComposer` and pmndrs/postprocessing's composer. r183+ `RenderPipeline` is named in inventory-shape.md §"Composer compatibility" as forward work, not v1. Verifiable: self-test constructs a stubbed composer with three passes (one enabled, one disabled, one renderToScreen) and asserts inventory's `composerPasses` array matches expected per pass.

8. **`takeSceneInventory({ ..., renderer })` snapshots `renderer.info` aggregate.** Captures `{ drawCalls, triangles, points, lines, programs, geometries, textures }`. Documents in inventory-shape.md that `renderer.info.autoReset` should be set to `false` by the host for stable per-tick aggregates (otherwise three.js resets at end of each render frame). Verifiable: self-test stubs `renderer.info` with known values; inventory's `rendererInfo` field matches.

9. **`takeSceneInventory({ ..., overlayRegistry })` invokes the registry's snapshot.** When passed, calls `overlayRegistry.snapshot()` and stores the result as `inventory.domOverlays`. When not passed, `inventory.domOverlays` is omitted (not empty array — distinguishes "host opted out" from "host opted in but registered zero overlays"). Verifiable: self-test with registry returns inventory with `domOverlays` populated; self-test without registry returns inventory without the field.

10. **`adapters/three/sample-capture.js`'s existing `captureFrame` extended with optional `inventory` extras** per research §10 "Integration with bindCaptureToBuffer." New signature: `captureFrame({ anchor, target?, input?, state?, inventory? }) → SampleRecord`. When `inventory` is passed (as a `SceneInventory` object from `takeSceneInventory`), the SampleRecord's `inventory` field is populated. When omitted, the field is absent (not `null` — same opt-in convention as overlay registry). Existing predicates ignore the field; new inventory predicates require it. Verifiable: self-test calls `captureFrame` with and without `inventory`, asserts the field's presence/absence in the returned record.

11. **Sugar wrapper `withPhaseBoundaryInventory({ recorder, scene, camera, stateFieldPath, ... }) → detach()` exports from `adapters/three/scene-inventory.js`.** Subscribes the recorder to a state-field-change watcher: on every recorder push, if `samples[i].state.<stateFieldPath>` differs from `samples[i-1].state.<stateFieldPath>`, takes a fresh inventory snapshot and attaches it to that frame's record. This is the cheapest sampling mode (sub-millisecond cost per phase transition; zero cost between transitions). `everyN(N)` and `everyFrame` modes also exported as alternatives with explicit cost-characterization in their JSDoc (per research §6: ~3-6% frame budget at 60Hz everyFrame for ~500 meshes; ~0.5% at everyN=6; sub-ms at phaseBoundary). Verifiable: self-test attaches `withPhaseBoundaryInventory` to a stubbed recorder, drives synthetic state transitions, asserts inventory only attached to frames where state changed.

### Phase 3 — Inventory predicates + diff API

12. **`core/inventory/predicates.js` exports the named inventory predicates.** Each predicate matches the existing kit predicate shape `(samples | inventories, options) → { passed, violations, totalSamples }`. Required predicates:
    - `meshVisibleAt(inventories, { phaseKey, meshName })` → asserts the named mesh is `visible === true && inFrustum === true` in the inventory at the given phase key.
    - `meshHiddenAt(inventories, { phaseKey, meshName })` → inverse.
    - `overlayVisibleAt(inventories, { phaseKey, overlayId })` → asserts the named overlay is `visible === true` in the inventory.
    - `overlayHiddenAt(inventories, { phaseKey, overlayId })` → inverse.
    - `passEnabledAt(inventories, { phaseKey, passName })` → asserts the named composer pass is `enabled === true`.
    - `drawCallBudget(inventories, { phaseKey?, max })` → asserts `rendererInfo.drawCalls <= max` at the named phase (or all phases if `phaseKey` omitted).
    - `triangleBudget(inventories, { phaseKey?, max })` → same shape, triangles.
   Each takes either a `samples` array (with `samples[i].inventory` populated) OR a `Map<phaseKey, SceneInventory>` produced by `snapshotAtPhaseBoundaries`. Verifiable: `import * as invPredicates from 'motion-test-kit/core/inventory/predicates';` returns at least 7 named functions, each callable. Self-test `tests/inventory-predicates.test.js` exercises a positive + negative case per predicate (≥14 assertions total).

13. **`core/inventory/diff.js` exports `diffInventories(invA, invB) → { appearedMeshes, disappearedMeshes, appearedOverlays, disappearedOverlays, enabledPasses, disabledPasses, drawCallDelta, triangleDelta }`.** Computes structural deltas between two snapshots: which mesh names exist in B but not A (appeared) and vice versa (disappeared); same for overlays + passes; numerical deltas for renderer.info aggregates. Pure function over inventory records. The diff API is load-bearing per research §10 "Open questions" — answers "what disappeared between HYPER and EXIT?" which is the canonical warp-style verification question. Self-test exercises diff over two synthetic inventories: meshes A:{tunnel, ship, stars} vs B:{ship, stars, crown} should produce `appearedMeshes:['crown']`, `disappearedMeshes:['tunnel']`. Verifiable: predicate function exists, exports match shape, self-test passes.

14. **Phase-keyed inventory collection helper `snapshotAtPhaseBoundaries(samples, phaseKeys, stateFieldPath) → Map<phaseKey, SceneInventory>`** exports from `core/inventory/predicates.js`. Walks the samples array, finds the first frame where `samples[i].state.<stateFieldPath> === phaseKey` for each requested phaseKey, returns the inventory at that frame as a Map keyed by phaseKey. Used by Tester to compose per-phase assertions cleanly: `const invs = snapshotAtPhaseBoundaries(samples, ['HYPER', 'EXIT'], 'warpState'); assert(meshVisibleAt(invs, { phaseKey: 'HYPER', meshName: 'tunnelMesh' }).passed);`. Verifiable: self-test runs over a 100-sample synthetic stream with state transitions; helper returns expected Map keys.

15. **Performance benchmark as kit self-test.** `tests/inventory-benchmark.test.js` constructs a representative scene (300 meshes — pegged to "well-dipper-scale" per research §9 estimate), takes 1000 inventory snapshots in a tight loop, reports p50 / p95 / p99 wall-clock cost in milliseconds. Test does NOT assert a numerical bound (host-machine variance makes that fragile) — it asserts the benchmark ran to completion AND emits the timings to stdout for documentation. Documentation block at top of test file records the expected order-of-magnitude per research §9 (~0.5-1.0ms per snapshot at 300 meshes everyFrame; sub-ms at phaseBoundary) so future regressions to the kit are visible against the documented baseline. Verifiable: `npm test` runs the benchmark file without error; stdout contains "p50:" / "p95:" / "p99:" lines.

16. **All Phase 3 self-tests pass under `npm test` in the kit repo.** Combined with prior 74 self-tests = ≥88 tests. Verifiable: `cd ~/projects/motion-test-kit && npm test` exits 0.

### Phase 4 — Runbook + Tester persona update + cross-project smoke test

17. **`runbooks/06-scene-inventory.md` exists** with all five required sections matching the prior runbooks' structure (When to use / How to invoke from a brief AC / What the Tester does with it / Pass-fail evidence shape / Common pitfalls). The "AC vocabulary → predicate mapping" table inside §"How to invoke from a brief AC" must include at minimum:

    | AC vocabulary (in PM brief) | Predicate function | Required options |
    |---|---|---|
    | "tunnelMesh visible during HYPER phase" | `meshVisibleAt` | `phaseKey`, `meshName` |
    | "reticle hidden during warp" | `overlayHiddenAt` | `phaseKey`, `overlayId` |
    | "exit-reveal pass enabled at EXIT" | `passEnabledAt` | `phaseKey`, `passName` |
    | "draw calls under N during STATION" | `drawCallBudget` | `phaseKey`, `max` |
    | "what disappeared between HYPER and EXIT" | `diffInventories` | (no options — pure function over two inventories) |

    The "Common pitfalls" section must include at minimum: (a) unnamed meshes break assertions silently, (b) manual-frustum unreliable for skinned/instanced meshes, (c) `phaseBoundary` cadence misses intra-phase regressions, (d) overlay registry not refreshed on overlay mount/unmount can produce stale visibility reads. Cross-references section names this brief, the lab-mode sibling brief, the feedback memo, and `docs/PERSONAS/tester.md` §"Bug-class taxonomy."
    Verifiable: `grep "^## " runbooks/06-scene-inventory.md` returns the five named sections; `grep "meshVisibleAt" runbooks/06-scene-inventory.md` returns matches inside the vocabulary table.

18. **`docs/PERSONAS/tester.md` "Production-grade verification (post-migration)" §"Bug-class → technique mapping" Structural-visibility-class row updated.** Currently reads (lines ~381):

    > **Structural-visibility-class** | Scene-inventory snapshots — which meshes are visible, which DOM overlays are present, which post-effect passes are active per phase. *Forward dependency:* not yet implemented in the kit; lands in sibling workstream `motion-test-kit-scene-inventory-2026-05-05` as kit technique #6. Until that workstream Ships, Tester uses telemetry-only structural assertions for phase-boundary verification (e.g., assert `WarpEffect.phase` advances `IDLE → ENTER → HYPER → EXIT → IDLE` monotonically without skipping).

    Replaced with:

    > **Structural-visibility-class** | Scene-inventory snapshots from kit technique #6 (`motion-test-kit/core/inventory/predicates`). Run `meshVisibleAt` / `overlayVisibleAt` / `passEnabledAt` / `drawCallBudget` against per-phase inventories captured via `withPhaseBoundaryInventory` or `snapshotAtPhaseBoundaries`. Diff API (`diffInventories`) names which meshes / overlays / passes appeared or disappeared between two phase boundaries — load-bearing for warp-style "what changed between HYPER and EXIT" verification. See `~/projects/motion-test-kit/runbooks/06-scene-inventory.md` for invocation patterns; see `docs/WORKSTREAMS/motion-test-kit-scene-inventory-2026-05-05.md` for technique origin.

    A new §"Inventory invocation pattern" subsection added below the existing §"Invocation pattern" subsection (parallel to the predicates one) showing concrete code: import `takeSceneInventory` + predicates, register overlays, capture per-phase inventories, run assertions. Verifiable: `grep "Forward dependency: not yet implemented" docs/PERSONAS/tester.md` returns zero matches (the placeholder is gone); `grep "kit technique #6" docs/PERSONAS/tester.md` returns matches; `grep "^### Inventory invocation pattern" docs/PERSONAS/tester.md` matches.

19. **Cross-project smoke test extended in `examples/three-vite-smoke/`.** The kit's existing smoke project gets a new scene-inventory demonstration: load a minimal three.js scene with 3-5 named meshes + a couple of DOM overlays, capture inventory at scene start + after a state transition, run `meshVisibleAt` + `overlayVisibleAt` + `diffInventories` predicates, log results. The smoke test runs via `npm run dev` in `examples/three-vite-smoke/` and the page console shows predicate results. Pattern-matches the prior workstream's AC #25 cross-project smoke test (motion predicates against synthetic scene). Verifiable: `examples/three-vite-smoke/scene-inventory-demo.html` (or equivalent — working-Claude's call on filename) exists; loading it in chrome-devtools shows console output with predicate PASS/FAIL results for the three demo predicates.

20. **`README.md` at kit root updated** to add technique #6 to the existing list of techniques + dependency notes. Existing README documents 5 techniques; updated README documents 6 with technique #6's dependency line ("Independent of techniques 1-5; consumed alongside per-frame predicates via the `inventory` field on `SampleRecord`"). Verifiable: `grep "technique #6" README.md` matches; `grep "scene-inventory" README.md` matches in the techniques section.

21. **Lab-mode sibling brief's AC #3 forward-dependency-aware path is verifiable as live.** This is a cross-workstream verification: with both this workstream and the lab-mode workstream Shipped, navigate to `http://localhost:5173/?lab=1`, press any of Shift+1..Shift+7, evaluate `window._labMode.lastEntrySnapshot` — the snapshot's structure should now include kit-shape inventory (not just telemetry-only fallback). Verifiable: chrome-devtools live evaluation shows `lastEntrySnapshot.inventory.meshes !== undefined` after a scenario entry. NB: this AC is gated on the lab-mode brief also being Shipped; if lab-mode hasn't shipped yet at this brief's Shipped flip time, AC #21 is annotated `DEFERRED — verify when lab-mode ships` and the deferred verification appended to this brief's audit log when it lands. Either ordering is fine; the AC is structural ("kit consumable from lab-mode"), not temporal.

> **AC #21 CLOSED 2026-05-07** by `welldipper-scene-inspection-layer-2026-05-06` Phase 3 (well-dipper master `c24d3f1`). The cross-workstream check is satisfied via a different but equivalent path: `welldipper-lab-mode-2026-05-05`'s `_labMode.lastEntrySnapshot.inventory` already consumed kit-shape inventory at its own Shipped flip; the scene-inspection-layer workstream went further and built `window.__wd.takeSceneInventory()` as the canonical runtime surface in well-dipper, which itself uses kit-shape multi-scene inventory. The "kit consumable from well-dipper" verification is now true at two layers (lab-mode entry snapshot + runtime inspector). Live verification: with well-dipper at `c24d3f1`, `window.__wd.takeSceneInventory().meshes[0].source` returns `'main'` (or `'sky'`), confirming the multi-scene API is live; `window.__wd.takeSceneInventory().materials.find(m => m.role === 'warp.tunnel')` returns the warp tunnel's uniform watchlist, confirming the 9-categories extension is live. Both are kit-shape per `core/inventory/inventory-shape.md`.

## Principles that apply

(From `docs/GAME_BIBLE.md` §"Development Philosophy [BOTH]" — naming the load-bearing 2-3 for *this* work, not blanket-listing.)

- **Principle 5 — Model Produces → Pipeline Carries → Renderer Consumes.** Hexagonal architecture is this principle applied to testing tooling. Inventory records are produced by `adapters/three/scene-inventory.js` (the renderer-side adapter), carried as pure-data through `core/recorder/ring-buffer.js`, consumed by `core/inventory/predicates.js` (engine-agnostic). Data flows one direction. **What violates it in this workstream:** letting `core/inventory/predicates.js` import `THREE.Object3D` for "convenience" (e.g., to access `mesh.layers.test()`); embedding `THREE.Mesh` references in `MeshInventoryEntry` ("just store the mesh, dereference at predicate time"); making `OverlayInventoryEntry` carry the live `Element` reference instead of structural fields. Each violation destroys portability and quietly turns technique #6 into a three.js-private addition. AC #2 + AC #3 explicitly verify-by-grep that `core/inventory/` has zero engine/DOM imports.

- **Principle 6 — First Principles Over Patches.** Like the prior kit workstream, this brief IS Principle 6 applied to verification infrastructure. The patch path is "ad-hoc DOM checks + mesh.visible peeks per workstream" — every visible-feature workstream invents its own `checkMeshVisible(name)` helper, and the vocabulary erodes per project. The first-principles redesign is structured per-phase inventory snapshots that any predicate can read uniformly. **What violates it:** allowing this workstream to ship Phase 1 alone and let consumers start using `takeSceneInventory()` directly without predicates (Phase 3) — working-Claude's verifier scripts will invent ad-hoc inventory parsers, and the "callable predicate vocabulary" pattern that makes the kit valuable erodes immediately. Land all four phases together; turn on consumption only after the persona update is in place (AC #18).

- **Principle 2 — No Tack-On Systems.** The temptation is to bolt scene-inventory into well-dipper directly (`window._labMode.captureInventory()` in `LabMode.js`), bypassing the kit. The kit-as-canonical-vocabulary discipline from the prior workstream's Principle-2 framing applies here at the per-technique level: meshVisibleAt / overlayVisibleAt / passEnabledAt become first-class predicate names in a published surface, not project-private patterns. **What violates it:** working-Claude shipping a well-dipper-private `src/debug/SceneInventory.js` instead of consuming `motion-test-kit/adapters/three/scene-inventory.js`; or letting lab-mode's fallback path drift into a parallel implementation that diverges from the kit's shape. AC #21 is the explicit cross-workstream check: lab-mode's `_labMode.lastEntrySnapshot.inventory` must be kit-shape, not lab-mode-shape.

## Drift risks

- **Risk: `core/inventory/` accidentally imports THREE because `Frustum.setFromProjectionMatrix` is convenient.**
  **Why it happens:** Three.js's `Frustum` class is exactly the math you want for visibility tests. The temptation to import it into the predicate layer is real, especially since `adapters/three/scene-inventory.js` already imports it.
  **Guard:** All Frustum / projection-matrix math lives in `adapters/three/scene-inventory.js`. The pure-data `inFrustum: boolean` field is computed there and stored on the inventory record; predicates in `core/inventory/predicates.js` only read the boolean. AC #3's CI grep assertion (`grep -rE "from 'three'" core/inventory/`) returns zero matches; this gate is non-negotiable. If a predicate genuinely needs frustum math (it shouldn't, by construction), the kit ships a pure-data frustum helper in `core/math/` first.

- **Risk: scope-creep into onAfterRender mode within Phase 1.**
  **Why it happens:** Manual-frustum has known limitations (skinned bounds, instanced visibility) that onAfterRender resolves cleanly. The temptation to ship "the right answer" instead of v1's documented limitation is real, especially since onAfterRender is a small additional code path.
  **Guard:** AC #5 explicitly carves skinned/instanced as v1 known limitations. onAfterRender mode is named as v2 future work, not in this scope. If working-Claude's PR adds an `onAfterRender` mode, that's a scope change requiring brief amendment, not a stealth-improvement. Write the v1 manual-frustum path; document the v2 path in the runbook §"Common pitfalls" and inventory-shape.md §"Future work" only.

- **Risk: phase-boundary cadence misses intra-phase regressions silently.**
  **Why it happens:** Phase-boundary is the cheapest cadence and the natural default. But a regression that fires mid-HYPER and clears before EXIT (e.g., a transient mesh-visible glitch at hyper-onset+200ms) won't appear in either snapshot and silently passes assertions.
  **Guard:** Runbook 06 §"Common pitfalls" must explicitly call this out — phase-boundary is the right default for steady-state assertions but everyN (N=6) or everyFrame should be used when the AC names a transient property. Predicate JSDoc on every inventory predicate names "this asserts at the captured phase boundary; intra-phase regressions require finer cadence." AC #17 verifies the runbook contains this pitfall.

- **Risk: unnamed meshes break assertions silently in production.**
  **Why it happens:** Predicates assert by mesh `name` — but three.js scenes commonly have unnamed meshes, especially auto-generated geometry, debug helpers, instanced child meshes. An assertion `meshVisibleAt({meshName: 'tunnelMesh'})` returns FAIL not because tunnelMesh is missing but because it has `name === ''` and the lookup misses.
  **Guard:** AC #4 ships `verbose: true` warning mode on first integration. AC #17 runbook §"Common pitfalls" leads with this. The predicate violations array reports both "mesh not found at phase X" AND "mesh found but name was empty" as separable failure modes — predicate authors distinguish them so working-Claude's diagnostic loop converges quickly. Working-Claude's first integration of the kit in well-dipper runs once with `verbose: true` to surface unnamed load-bearing meshes; commit + name them per the host-side naming policy that emerges.

- **Risk: post-effect composer compatibility drifts as three.js evolves.**
  **Why it happens:** The composer API has churned across three.js versions (legacy `EffectComposer`, pmndrs/postprocessing, r183+ `RenderPipeline`). Duck-typing on `composer.passes` works today; r184+ may rename or remove the field.
  **Guard:** AC #7 names r183+ `RenderPipeline` as forward work. Inventory-shape.md §"Composer compatibility" documents the duck-type boundary. Runbook 06 §"Common pitfalls" names "if `composer.passes` is undefined, scene-inventory silently omits the field — feature your `passEnabledAt` predicate to FAIL on missing data, not PASS on empty array." Working-Claude verifies host's three.js + composer combination at first integration; flags to PM if the duck-type breaks.

- **Risk: diff API gets postponed to "follow-up workstream" because Phase 3 is large.**
  **Why it happens:** Phase 3 ships predicates AND diff AND a phase-keyed collection helper AND a benchmark. Feels like a lot. The diff API in particular is the easiest to defer ("we'll add diffInventories when someone needs it").
  **Guard:** AC #13 is in this workstream, not a follow-up. The research report explicitly recommends diff in v1 with the strong-motivation note: "what disappeared between HYPER and EXIT?" is the canonical warp-style verification question and structurally hard to add later (the predicate API shape changes if diff is bolted on rather than first-class). Working-Claude does NOT defer this AC. If Phase 3 is genuinely too large for one commit, split into 3a (predicates) + 3b (diff + phase-keyed helper + benchmark), but ship both in this workstream.

- **Risk: cross-project smoke test (AC #19) becomes well-dipper-shaped.**
  **Why it happens:** working-Claude knows well-dipper, defaults to well-dipper-shaped scenarios. The smoke test is supposed to demonstrate technique #6 against a *minimal* three.js scene with no well-dipper assumptions — a planet-and-camera, not a warp simulation.
  **Guard:** AC #19 specifies a 3-5 named meshes + a couple of DOM overlays — small, generic, project-agnostic. The existing `examples/three-vite-smoke/` for prior techniques is the pattern to mirror. PM (or working-Claude as PM proxy) reviews the smoke-test scene before AC #19 is verified — if the scene has well-dipper-flavored mesh names ("tunnelMesh", "ship", "reticle"), the smoke test isn't generic enough. Use generic names ("planet", "moon", "ship-icon", "hud-panel").

## In scope

- New module tree at `~/projects/motion-test-kit/`:
  - `core/inventory/inventory-shape.md` — typedef documentation (parallel to `core/predicates/sample-shape.md`).
  - `core/inventory/errors.js` — `MissingInventoryFieldError`.
  - `core/inventory/predicates.js` — 7+ predicate functions + `snapshotAtPhaseBoundaries` helper.
  - `core/inventory/diff.js` — `diffInventories` pure function.
  - `adapters/three/scene-inventory.js` — `takeSceneInventory` + `withPhaseBoundaryInventory` + manual-frustum helpers.
  - `adapters/dom/overlay-registry.js` — `createOverlayRegistry`.
- `SampleRecord` extension to add optional `inventory` field (additive — existing predicates ignore it).
- Self-tests in `tests/`: `scene-inventory.test.js`, `overlay-registry.test.js`, `inventory-predicates.test.js`, `inventory-benchmark.test.js`.
- Runbook 06 at `runbooks/06-scene-inventory.md` with all five required sections.
- Tester persona update at `docs/PERSONAS/tester.md` (well-dipper repo; symlinked from `~/.claude/agents/tester.md`).
- Cross-project smoke test extension in `examples/three-vite-smoke/`.
- Performance benchmark as kit self-test (1000 inventories at ~300 meshes; reports p50/p95/p99 to stdout).
- README.md at kit root updated to document technique #6.
- Diff API (`diffInventories`) — explicitly v1, not deferred.

## Out of scope

- **Migrating well-dipper's `LabMode.js` to consume scene-inventory directly.** That's the lab-mode sibling brief's territory; this brief ships the kit-side technique. Lab-mode picks it up via its AC #3 forward-dependency-aware path when both ship; AC #21 of this brief is the cross-workstream verification.
- **onAfterRender mode for exact-render-set capture.** Carved as v2 per AC #5 / research §3(b). v1 is manual-frustum only with documented limitations.
- **Skinned / instanced / batched per-instance visibility.** v1 captures these meshes with caveat-documented manual-frustum results; per-instance handling is v2.
- **r183+ `RenderPipeline` composer compatibility.** v1 duck-types on legacy `composer.passes`; r183+ is documented forward work.
- **Object3D.toJSON-based deep-snapshot mode.** Research §8 named this as a possible opt-in path; out of scope for v1 — the per-mesh fields specified in AC #1 are sufficient for the named predicates.
- **Visual debug HUD that renders the inventory live in-page.** Out-of-scope per the prior workstream's same-named carve. If host wants this, it's a host-side dev tool consuming the kit's pure-data output.
- **Property-based / fuzzing tests over inventory.** Same carve as prior workstream.
- **Godot adapter for technique #6.** Architecture supports it (manual-frustum math is engine-agnostic; only the scene-graph traversal differs); building it is a future workstream.
- **Cross-machine deterministic inventory replay.** Inventory snapshots are timepoint-pure-data; replaying the simulation to reach the same inventory inherits the determinism limits documented in technique #3 / runbook 03.

## Handoff to working-Claude

**Read first (in this order):**

1. `~/.claude/projects/-home-ax/memory/feedback_lab-modes-not-recordings.md` — the rule.
2. `docs/WORKSTREAMS/motion-test-kit-2026-05-02.md` — prior kit workstream; same architecture pattern, same `core/` purity rule, same per-technique runbook discipline.
3. `docs/WORKSTREAMS/welldipper-lab-mode-2026-05-05.md` AC #3 — the consumer's expected entry point.
4. `~/projects/motion-test-kit/core/predicates/sample-shape.md` + `~/projects/motion-test-kit/core/predicates/index.js` — extant pure-data conventions + predicate shape this brief extends.
5. `~/projects/motion-test-kit/runbooks/01-per-frame-deltas-and-predicates.md` — runbook 06 mirrors this structure.
6. `docs/PERSONAS/tester.md` §"Production-grade verification (post-migration)" — the bug-class table this workstream amends in Phase 4.

**Build order is dependency-strict:**

- Phase 1 (Core inventory shape + three.js adapter with manual-frustum) — ACs #1-#5. Load-bearing; everything downstream depends on it.
- Phase 2 (DOM overlay registry + composer + renderer.info + sample-capture extension + cadence wrapper) — ACs #6-#11. Depends on Phase 1.
- Phase 3 (Predicates + diff + phase-keyed helper + benchmark) — ACs #12-#16. Depends on Phase 1 + 2.
- Phase 4 (Runbook + persona update + cross-project smoke test + README + lab-mode cross-verification) — ACs #17-#21. Depends on Phases 1-3.

Each phase commits separately; AC #19 (cross-project smoke) gates Phase 4 alongside AC #18 (persona update).

**The `core/inventory/` purity rule is load-bearing.** Before each commit in Phases 1-3, run `grep -rE "from 'three'|from '@?[a-z]+/three'|window\.|document\.|require\\\('three" core/inventory/` and verify zero matches. If you need vector math in `core/inventory/`, extend `core/math/` (already exists per prior workstream); if you need geometry helpers, add them as pure-data array-based functions there. This is non-negotiable — violating it costs cross-project portability.

**The `name`-as-assertion-key invariant is load-bearing.** Predicates assert by mesh name + overlay id + pass name. Empty-string names are a silent-failure trap. AC #4's `verbose: true` warning is the kit's user-facing honesty about this; the predicate violations array distinguishes "mesh not found" from "mesh found but unnamed." Both signals reach working-Claude in the diagnostic loop.

**The diff API is in v1.** Don't postpone it. The "what changed between HYPER and EXIT" question is the canonical warp-style verification and the predicate-shape gets harder to add later if diff isn't first-class from day one. AC #13 is non-negotiable.

**The cross-project smoke test must be project-agnostic.** Generic mesh names ("planet", "moon", "ship-icon"), no well-dipper-specific scenarios. The smoke test demonstrates the kit's portability — if the scene reads as well-dipper-shaped, the demonstration fails its purpose even if the predicates run.

**What "done" looks like:**

- All 21 ACs verified.
- Kit at `~/projects/motion-test-kit/` has technique #6 landed across the four phases; ≥88 self-tests pass under `npm test` (74 prior + ≥14 new).
- Performance benchmark documented baseline timings for 300-mesh scenes at the cadences supported.
- Runbook 06 exists with all five required sections + the AC-vocabulary mapping table.
- `docs/PERSONAS/tester.md` Structural-visibility-class row replaced with active links into runbook 06 + this brief; new §"Inventory invocation pattern" subsection added.
- `examples/three-vite-smoke/` extended with scene-inventory demonstration; smoke test runs via `npm run dev` and shows console-logged predicate results.
- README.md at kit root documents 6 techniques (was 5).
- AC #21 cross-workstream verification: either live-verified at workstream Shipped flip if lab-mode is also Shipped, or annotated DEFERRED with audit-log entry promised when lab-mode lands.
- Tester verdict PASS on the to-be-shipped kit-repo commit + the well-dipper-side persona-update commit.
- Brief flipped to `Shipped <kit-sha> + welldipper@<sha> — kit @ motion-test-kit:<sha>` once Tester PASSes. No recording gate (tooling workstream; AC verification is contract-shaped).
- Push to origin both the kit repo and well-dipper (well-dipper is on the established-deploy list per `~/.claude/projects/-home-ax/memory/feedback_deploy-established-sites.md`).

**What artifacts to produce:**

- Kit repo commits across the four phases: Phase 1 (core shape + three adapter), Phase 2 (DOM + composer + renderer + sample-capture extension), Phase 3 (predicates + diff + benchmark), Phase 4 (runbook + smoke + README).
- Well-dipper-side commit for Tester persona update (`docs/PERSONAS/tester.md`).
- Workstream commit messages cite which ACs each commit closes.

**What to avoid:**

- Importing THREE / DOM into `core/inventory/` (Drift risk #1, Principle 5).
- Shipping Phase 1 alone and starting consumption (Drift risk #6 of prior brief, Principle 6).
- Postponing the diff API (Drift risk on this brief).
- Postponing the Tester persona update.
- Shallow runbook (Drift risk on prior brief).
- onAfterRender mode in v1 (Drift risk #2 — scope creep).
- Well-dipper-shaped smoke test (Drift risk #7).

**Tester invocation (after each coherent phase, and before Shipped):**

```
Agent(subagent_type="tester", model="opus", prompt="""Verify against
docs/WORKSTREAMS/motion-test-kit-scene-inventory-2026-05-05.md ACs
#<phase-acs>. Diff: <commit-sha or range>. Kit repo at
~/projects/motion-test-kit/. Self-tests run via
`cd ~/projects/motion-test-kit && npm test` (≥88 passing post-Phase 3).
Engine-agnostic grep assertion:
`grep -rE "from 'three'|from 'gl-matrix'|window\\.|document\\." ~/projects/motion-test-kit/core/inventory/`
must return zero matches. For Phase 4, additionally verify:
(a) `runbooks/06-scene-inventory.md` exists with the five named sections,
(b) `docs/PERSONAS/tester.md` Structural-visibility-class row no longer says
    "Forward dependency: not yet implemented",
(c) `examples/three-vite-smoke/` smoke runs via `npm run dev` showing
    inventory-predicate console output.
Render verdict per Tester audit shape.""")
```

For Phase 4 specifically, the Tester reads `docs/PERSONAS/tester.md` post-update and verifies the new §"Inventory invocation pattern" subsection against AC #18's required-contents list — same self-referential pattern as the prior workstream's Phase 5 (Tester verifies its own persona doc; the AC is contract-shaped, not behavioral).

## Open questions

1. **Should runbook 06 also document the everyN cadence's recommended N for production-soak vs short-regression captures?** Research §6 names N=6 (10Hz) as the cost-effective soak default. Working-Claude could either (a) bake the recommendation into the runbook with the cost characterization, or (b) leave it to host-side discretion. PM proposes (a) — explicit recommendation with the cost-rationale documented helps the next consumer not re-derive the same trade-off.

2. **Should `withPhaseBoundaryInventory` debounce same-frame state changes?** A host that mutates `state.warpPhase` twice in one sim tick (e.g., transition + immediate sub-state update) would trigger two snapshots from the watcher. Cheap (sub-ms) but redundant. Working-Claude proposes single-snapshot-per-tick semantics by default; debounce is the simple form. Flag in implementation if a concrete host scenario surfaces a need for finer-grained per-transition snapshots.

3. **Should the diff API support a third "modified" category for renderer.info aggregates beyond strict appeared/disappeared?** Currently `drawCallDelta` is a number; appeared/disappeared sets are only over named entities (meshes, overlays, passes). Could extend to `{ appeared, disappeared, modified: [{name, fieldChanges}] }` for meshes whose `worldPos` changed but identity didn't. PM proposes deferring — modified-tracking adds shape complexity for marginal value (the same per-frame motion data is in `samples[i].anchor.pos` already). If a real consumer surfaces, follow-up workstream territory.

---

*Brief authored by PM 2026-05-06 against motion-test-kit @ `b2b0473` + well-dipper HEAD `3345e40`. Parallel sibling to `docs/WORKSTREAMS/welldipper-lab-mode-2026-05-05.md`. No parent feature doc — kit-infrastructure / verification-tooling workstream per `docs/PERSONAS/pm.md` §"Carve-out: process / tooling workstreams." Implements technique #6 of the motion-test-kit, the structural-visibility-class half of the new lab-mode-not-recordings verification stack (`~/.claude/projects/-home-ax/memory/feedback_lab-modes-not-recordings.md`).*
