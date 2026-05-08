# Workstream: scene-inspection layer (2026-05-06)

**Shipped `c24d3f1` 2026-05-07** — kit `motion-test-kit:7be6857`. Tester PASS at the to-be-shipped commit (verdict T4 in `~/.claude/state/dev-collab/tester-audits/welldipper-scene-inspection-layer-2026-05-06.md`). Phase 1-4 all landed. Three deliberate carve-outs (AsteroidBelt naming + ShipSpawner naming + lights category) are documented in commit bodies; flagged for follow-up if/when the brief's predicates need them. Two parked regressions (reticle-persists-after-warp, warp-tunnel-second-half-not-rendering) remain parked but are now diagnose-able via `window.__wd.takeSceneInventory()` + `meshVisibleAt('effect.warp.tunnel', ...)` — triage workstream pending.

## Test Coverage Plan (retroactive annotation, 2026-05-07)

Added retroactively to validate the new three-layer testing framework (per `feedback_three-layer-test-coverage.md`) on real shipped material. Maps the work that already happened (verdicts T1-T4) to the unit / integration / UAT vocabulary. Citations point at well-dipper's `docs/TESTING_CONVENTIONS.md`.

| Phase | Unit coverage | Integration coverage | UAT coverage |
|---|---|---|---|
| Phase 1 (kit-side, 7be6857) | Kit's `tests/scene-inventory-phase1-2026-05-06.test.js` (30 new) + `tests/hash.test.js` bit-stable cases (9 new). 191/191 pass. **Unit: PASS.** | Kit's `tests/inventory-predicates.test.js` covers predicate composition; 161 baseline preserved. Cross-project smoke test in `examples/three-vite-smoke/` (per AC #19 of motion-test-kit-scene-inventory-2026-05-05). **Integration: PASS** at the kit-side scope. | N/A — kit Phase 1 is library code; no UI. Tester verdict T1 noted "no real-browser path for Phase 1." **UAT: N/A (per brief — engineering-only at this phase).** |
| Phase 2 (well-dipper, bdb872f → da3d4a2) | No new vitest files; relies on existing well-dipper unit suite (233/237 baseline preserved). **Unit: PASS** by regression-prevention. | `__wd.takeSceneInventory()` driven via chrome-devtools verifies canonical-name presence in Sol. Eventually subsumed by recording-replay (Phase 0 queued in well-dipper-progress.md). **Integration: PASS** via in-session smoke. | Tester verdict T2 drove canonical-name probe in real Chrome:9223 + reported findings; Max ran the snippets to confirm. **UAT: PASS — Max-confirmed live in Sol** during fixup #2 verification. |
| Phase 3 (well-dipper, c24d3f1) | No new vitest files; production-bundle drift guard (`scripts/check-prod-no-inspector.sh`) is unit-flavored grep over build output. **Unit: PASS** + drift guard PASS. | `__wd.runIntegrationSuite()` (19 tests, Groups A-F) + `__wd.runWarpSuite()` (4 layer-functionality + 2 regressions detected) — both runners shipped IN this phase + verified in-session. **Integration: PASS** at the inspection-layer scope; the warp suite simultaneously revealed the two parked regressions as expected diagnostics. | Tester verdict T3 verified Tier 1 surface + Shift+I panel + golden serializer + production drift guard via chrome-devtools. **UAT: PASS — Max-confirmed live in Sol** for `__wd` surface; Shift+I panel UX explicitly deferred to Max in next session per `well-dipper-progress.md` "PENDING MAX UAT" section. |
| Phase 4 (docs + AC #21 close) | grep assertions on persona docs + runbook 06 + AC #21 annotation. **Unit: PASS** (file presence + content greps clean). | N/A — doc-only phase; no behavioral integration to verify. **Integration: N/A (per phase — doc-only).** | Max reads the updated PERSONAS docs in next session. **UAT: deferred to Max** for legibility check. |

### Coverage gaps surfaced by the new lens

1. **No record-replay integration tests yet.** Phase 0 queued in `well-dipper-progress.md` "Next-up testing roadmap." The current integration coverage is in-session console runners, not CI-autonomous. This is documented gap, not a regression of the workstream.
2. **Goldens scaffold present but no goldens captured.** `__wd.saveGolden(scenarioName)` works; canonical scenarios not yet committed to `tests/golden/scene-inventory/`. Next-up triage workstream uses this surface.
3. **Phase 4's UAT items remain pending.** Max's review of the updated PERSONAS docs + the inspection-layer demo walkthrough doc happens in next session(s); the workstream is "Shipped structurally, pending Max UAT" until then per `well-dipper-progress.md` 2026-05-07 entry.

### Why the retroactive annotation matters

Without this section, the new lens (`feedback_three-layer-test-coverage.md`) is purely theoretical — written as policy, never validated on real material. Annotating one shipped brief shows the vocabulary actually fits how the workstream was verified. Future briefs use the new shape from the start; this annotation is the bridge.

---

## Why we care

Max's words (verbatim, 2026-05-06):

> "This feature makes it possible to do effective testing and debugging. It should also make our workflow a lot more streamlined because you will have a non-visual representation of what is happening visually in a rendered scene. That should allow you to programmatically address issues that otherwise would take a ton of testing visually to confirm."

The point isn't "name some meshes." The point is *Claude (and Max, secondarily) can read scene state non-visually so the iteration cycle stops being bottlenecked on Max's eyes.* Scope discipline later checks against this.

## Current objective + success criteria

**Objective:** Every game asset that this system is supposed to be able to tag and monitor is actually being tagged and monitored.

**Success criterion (Max's words):** "100% of all game assets fitting the criteria are tagged and can be monitored live."

That criterion has two prongs:
- **Tagged:** the asset has a stable `Object3D.name` per the dotted three-segment convention + `userData = { category, kind, id, generation }` mirroring richer metadata.
- **Monitored live:** the asset appears in `takeSceneInventory(...)` output, queryable via kit predicates, accessible at runtime through Tier 1/2/3 inspector surfaces.

To make 100% verifiable, this brief enumerates the criteria-fitting asset set explicitly (§"Canonical naming list" below) — that's the working answer to "what counts as 100%." Tester verifies the inventory contains every name in the list, no `name === ''` for any entry on the list, and predicate lookups for each name resolve.

### Tester verification path (per new workflow)

For each named asset in the canonical list:

1. Tester invokes `chrome-devtools press_key('Shift+1')` (or whichever lab-mode scenario reaches the asset's category).
2. Tester evaluates `await window.__wd.takeSceneInventory({ scenes: [main, sky] })` via chrome-devtools `evaluate_script`.
3. Tester asserts each name in the canonical list is present + non-empty + correctly categorized.
4. Tester asserts `meshVisibleAt({ meshName, phaseKey })` resolves PASS/FAIL with semantic correctness (no fail-by-not-found).
5. Tester runs `Shift+I` (real keypress) → confirms inspector panel renders.
6. Tester writes plain-English Summary for Max naming the load-bearing assets observed + 2-3 user inputs Max should try in his real browser to confirm.

## Architectural connections

### Inputs (what this feature consumes)

- **`motion-test-kit`** — needs extending to (a) accept a list of scenes with `source` tagging on each entry, (b) expose 9 new inventory categories beyond the existing meshes / DOM / composer / renderer.info shape, (c) add predicate functions for the new categories. `takeSceneInventory(...)`, `createOverlayRegistry(...)`, and predicate API surface all evolve.
- **Well-dipper's mesh-construction sites** — `Planet.js`, `Moon.js`, `AsteroidBelt.js`, `WarpPortal.js`, `WarpEffect.js` (state-machine, no meshes itself), `WarpTunnel.js`, `StarFlare.js`, `Ship.js` / `ShipSpawner.js`, sky layers (`StarfieldLayer`, `WarpTunnelStarfieldLayer`, `GalaxyGlowLayer`, `ProceduralGlowLayer`, `SkyFeatureLayer`), UI 3D (`SystemMap.js`, `GravityWellMap.js`, `GravityWell.js`, `TargetingReticle.js`). Each site sets `.name` + `userData` at construction.
- **`KnownSystems` / `SolarSystemData`** — canonical names for Sol's planets/moons (`earth`, `mars`, `luna`).
- **Procedural generation pipeline** (`StarSystemGenerator`, `PlanetGenerator`, `MoonGenerator`) — feeds `fnv1a(seed + ':' + ordinal)` for procedural-planet hashes.
- **`RetroRenderer`** — needs `renderer.info.autoReset = false` set on the underlying `WebGLRenderer`.
- **Lab-mode** (`src/debug/LabMode.js`) — already has `captureEntrySnapshot`; needs updates for new categories + the wrong reticle selector fix (`#targeting-reticle` → `#targeting-overlay`).
- **Existing telemetry surfaces** — `_autopilot.telemetry.samples[]`, `_warpEffect.state`, `AudioContext.currentTime` — feed phase / audio / clock inventory categories.
- **Vite build system** — gates Tier 2 (inspector panel) behind `import.meta.env.DEV` for production tree-shake. Names ship in production (`Object3D.name` strings, ~2KB cost) so `?debug=1` field debugging works on live deploys.

### Outputs (what depends on this feature)

- **Tester subagent's verification path** — predicates + Summary-for-Max use the inventory shape.
- **Future workstreams that assert per-phase visibility** — warp ACs, autopilot ACs, manual-flying-toggle, anything with phase-sourced criteria.
- **Triage of the two parked regressions** — `reticle-persists-after-warp` (DOM overlay registry + `phase.warp` state predicate) + `warp-tunnel-second-half-not-rendering` (mesh + material/uniform watchlist + composer pass).
- **Lab-mode scenarios' entry snapshots** — get richer; capture full structural state post-this.
- **Max's interactive evaluation via Tier 2 inspector panel** — toggle Shift+I, see latest snapshot inline.
- **Tier 3 golden snapshot files** — `tests/golden/scene-inventory/<scenario>.json`, diffed in PRs.
- **AC #21 deferred check** in `motion-test-kit-scene-inventory-2026-05-05` — annotated DEFERRED until lab-mode + scene-inventory both shipped end-to-end; this workstream's mesh-naming closure unblocks AC #21.

### Features that must stay working (regression-prevention checklist)

This is the working integration map Tester checks after the change. Each item below = a feature/path that this workstream's edits MUST NOT break:

- **All current rendering paths**: warp (idle/fold/enter/hyper/exit), autopilot (CRUISE/STATION), screensaver loop, sky rendering, HUD, system map, gravity-well visualization.
- **All current keybinds**: 1-9 (autopilot navigation + focus planet), K (keybinds overlay), P (settings), Space (commit/burn), WASD (flight), Q (autopilot toggle), T/X (various), Shift+1..7 + Shift+L (lab-mode), F9 (input recording).
- **Lab-mode scenarios** — currently scenarios 4+7 partially broken (adjacent issue, NOT this workstream's scope to fix; just not regressed by this work).
- **Deploy pipeline** — well-dipper is on the established-deploy list per `feedback_deploy-established-sites.md`. Tier 2 inspector panel must NOT ship to production accidentally.
- **Audio system** — audio inventory category captures state without affecting playback (read-only inspection).
- **`renderer.info.autoReset = false`** — flipping this changes the semantic of `renderer.info.calls/triangles` between renders. Verify existing readers (debug HUD, performance monitoring) still get sensible numbers.
- **Existing kit predicates** — name-based lookups (e.g., `meshVisibleAt('tunnel')`) currently fail-by-not-found. After this workstream they start succeeding. Any test or harness implicitly relying on the FAILURE shape needs review.
- **Backward compatibility for unnamed objects** — auto-generated geometry left unnamed must STILL be inventoried (just without `.name`). The criteria-fitting set is named; the rest is enumerated as `{ name: '', ... }` entries.

## Canonical naming list (option α — enumerated in brief)

Format per Q1 decision: dotted three-segment hierarchy on `Object3D.name`. Per Q2 decision: hash-with-Sol-carveout for `<id>` segment.

### `body.*` — celestial bodies

| Name | Source | Notes |
|---|---|---|
| `body.star.<systemId>` | `StarRenderer.create()` returns `star.mesh` | systemId = canonical for Sol (`sol`), seed-hash for procedural |
| `body.planet.<id>` | `Planet.js` `this.mesh` (Group with IcosahedronGeometry) | id = canonical name for Sol (`mars`, `earth`); 5-6-char fnv1a hash for procedural |
| `body.moon.<id>` | `Moon.js` `this.mesh` | id = canonical for Sol (`luna`, `phobos`); hash for procedural |
| `body.asteroid-belt.<id>` | `AsteroidBelt.js` parent Group | container only; per-shape InstancedMesh children unnamed |

### `effect.warp.*` — warp transition (state-machine-bound)

| Name | Source | Notes |
|---|---|---|
| `effect.warp.portal-a` | `WarpPortal._discA:97` | origin disc |
| `effect.warp.portal-b` | `WarpPortal._discB:103` | destination disc |
| `effect.warp.tunnel` | `WarpPortal._tunnel:126` | the "warp-tunnel-second-half" regression target |
| `effect.warp.landing-strip` | `WarpPortal._landingStrip:302` | the "crosses runway" regression target — green-cross sprites past the destination portal |
| `effect.warp.portal-strips` | `WarpPortal:387, 430` | two sprite strips on portal entry |

### `effect.starflare.<systemId>` — diffraction-spike flare (main-sequence stars only)

| Name | Source | Notes |
|---|---|---|
| `effect.starflare.<systemId>` | `StarFlare.js` `this.mesh` | systemId = same as `body.star.<systemId>` |

### `ship.*` — player + NPCs

| Name | Source | Notes |
|---|---|---|
| `ship.player` | `Ship` class (singleton — confirm in execution) | n=1 |
| `ship.npc.<archetype>.<id>` | `ShipSpawner.ships[]` | archetype from manifest; id = ordinal-from-spawn-seed |

### `sky.*` — background sky elements (separate scene from main; `source: 'sky'` per Q1 decision)

| Name | Source | Notes |
|---|---|---|
| `sky.starfield.main` | `StarfieldLayer.this.mesh` | container; individual Points unnamed |
| `sky.starfield.warp-tunnel` | `WarpTunnelStarfieldLayer.this.mesh` | warp-specific starfield variant |
| `sky.glow.galaxy` | `GalaxyGlowLayer.this.mesh` | container |
| `sky.glow.procedural` | `ProceduralGlowLayer.this.mesh` | container |
| `sky.feature-layer` | `SkyFeatureLayer.this.mesh` | globular clusters etc. |

### `hud.*` — 3D-scene HUD (most well-dipper HUD is DOM, not 3D)

| Name | Source | Notes |
|---|---|---|
| `hud.system-map` | `SystemMap.js` parent Group | children unnamed |
| `hud.gravity-well-map` | `GravityWellMap.js` `this.mesh` | container |
| `hud.gravity-well.<bodyId>` | `GravityWell.js` (per body) | small canonical-set, may be predicate-asserted |

### DOM overlays (separate registry — `domOverlays` in inventory)

| Registered id | Selector | Notes |
|---|---|---|
| `targeting-overlay` | `#targeting-overlay` | the reticle 2D canvas — DOM, not 3D mesh. Parked-regression target. (Current LabMode.js has wrong selector `#targeting-reticle` — fix in this workstream.) |
| `hud` | `#hud` if exists, else null resolver | main HUD if any |
| `keybinds-overlay` | `#keybinds-overlay` | already registered |
| `lab-hud` | `#lab-hud` | already registered |
| `debug-hud` | `#debug-hud` | DebugPanel.js:130 |
| `debug-overlay` | `#debug-overlay` | DebugPanel.js:235 |
| `nav-computer` | `#nav-panel` if exists | NavComputer.js DOM |

### Categories beyond meshes / DOM / composer (the 9 additions per Q3 research)

Each new category gets a name pattern + capture surface. Per the research, all 9 are in scope for this workstream.

| Category | Name pattern | Capture surface | Examples |
|---|---|---|---|
| **camera** | `camera.<role>` | three.js `THREE.Camera` instances | `camera.player`, `camera.system-map`, `camera.gallery` |
| **light** | `light.<kind>.<id>` | three.js `THREE.Light` instances | `light.star.sol`, `light.ambient.system` |
| **material** (uniform watchlist) | `material.<role>` | per-construction-site declared watchlist of "load-bearing" uniforms | `material.warp.tunnel` watching `uTime`, `uPhase`; `material.sky.galaxyglow` watching key uniforms |
| **clock** | `clock.<system>` | numerical state of clocks/elapsed-time fields | `clock.warp` (warp-effect elapsed), `clock.autopilot-tour`, `clock.audio-beat` |
| **mode** | `mode.<slot>` | string-valued mode flags | `mode.viewport` (`'system'\|'galaxy'\|'gallery'`), `mode.render-pipeline`, `mode.debug` |
| **rt** (render-target) | `rt.<name>` | `WebGLRenderTarget` instances | `rt.composer.read`, `rt.composer.write`, `rt.galaxy-glow` |
| **phase** | `phase.<system>` | active-phase string per state machine | `phase.autopilot` (`'CRUISE'\|'STATION'\|...`), `phase.warp` (`'fold'\|'enter'\|'hyper'\|'exit'\|'idle'`) |
| **audio** | `audio.<track>` | playing/start-time/currentTime/volume per track | `audio.bgm`, `audio.warp-rumble` |
| **input** | `input.<kind>` | input-layer state | `input.held-keys`, `input.last-action` |

The kit-side `takeSceneInventory(...)` exposes one new top-level field per category. Predicates per category land in `core/inventory/predicates.js`:

- `cameraConfigAt({ cameraRole, expected: { fov, aspect, near, far } })`
- `lightActiveAt({ lightId, intensity-min })`
- `uniformValueAt({ materialRole, uniformName, expected, tolerance })`
- `clockProgressedSince({ clockSystem, since-frame, by-min-seconds })`
- `modeIs({ slot, expected })`
- `renderTargetSize({ rtName, expected: [w, h] })`
- `phaseEquals({ system, expected })` — already covered partially by existing predicates; this is the inventory-shape version
- `audioPlayingAt({ track })`
- `inputContains({ kind, expected })`

### NOT named (anti-criteria — explicit exclusion)

- Per-instance asteroid shards (InstancedMesh instances)
- Per-particle stars in `StarfieldLayer` / `Galaxy` / `Nebula`
- Geometry / material primitives (named at the Mesh level only, never on geometries / materials directly)
- Helpers (proxy mesh at `main.js:3687-3689`, channel mesh at `main.js:4840`)
- Hot-path-recreated debug lines / temp visualizations

## Implementation pointers

### Naming convention recap

- Format: `<category>.<kind>.<stable-id>` on `Object3D.name`.
- `userData = { category, kind, id, generation }` — `generation` is a counter bumped on regeneration (e.g., new system load) so tests can detect stale captures.
- Stable IDs: canonical for Sol (real names), 5-6-char `fnv1a(systemSeed + ':' + ordinal)` for procedural. `userData.id` carries the full hash for collision safety. `userData.systemSeed` is the system seed.
- `mtk.` prefix on any meshes the kit adapter injects into well-dipper's scene (e.g., debug bbox helpers).
- **GLTF caveat**: GLTF loader silently mangles names with dots and special characters. For runtime-constructed objects (which is all of well-dipper's named set), this is fine. If well-dipper ever round-trips through GLTF, names would be mangled silently. Documented for future reference; not a blocker.
- Bit-stable hash test: a CI / self-test asserts that `body.planet.<hash>` for a fixed system seed is byte-identical across `git log` runs of the kit. Refactoring the hash function is a save-breaking change and should fail loudly.

### Multi-scene API extension (kit-side)

Per Q1 decision (option b with source tagging):

```js
// Old:
takeSceneInventory({ scene, camera, ... })

// New:
takeSceneInventory({
  scenes: [
    { name: 'main', scene: mainScene, camera: mainCamera },
    { name: 'sky',  scene: skyScene,  camera: skyCamera  },
  ],
  ...
})
// Returns flat inventory array; each mesh entry has source: 'main' | 'sky'.
```

Existing single-scene callers continue working via a back-compat shim (or one-time call-site sweep — execution decision).

Predicates default to "search across all sources"; opt-in `{ source: 'sky' }` to scope.

### Tier 1 — Programmatic surface

```js
// Behind import.meta.env.DEV (or ?debug=1 URL gate — execution decision)
window.__wd = {
  takeSceneInventory,    // bound with main + sky scenes pre-wired
  scene: mainScene,       // direct reference for ad-hoc inspection
  skyScene,               // ditto
  getNamed: (name) => /* return Object3D by name across scenes */,
};
```

### Tier 2 — In-page inspector panel

- Keybind: **Shift+I** (per Q4 research recommendation).
- No-op when focused in a text input.
- Panel is fixed-position floating div; renders latest snapshot as collapsible JSON tree; "copy to clipboard" button.
- Toggleable. Documented in keybinds-overlay (K).
- Bundle-gate via `import.meta.env.DEV`.

### Tier 3 — Golden snapshot files

- Lab-mode scenario entry writes inventory snapshot to disk at `tests/golden/scene-inventory/<scenario>.json` (NOT auto-committed; needs Max approval).
- Diff tool: kit's existing `core/inventory/diff.js` `diffInventories(a, b)`.
- Generation workflow: lab-mode `?lab=1&saveGoldens=1` mode writes snapshots; default mode reads + asserts against existing goldens.
- Stable ordering required: snapshots are sorted by `name` (alphabetic) before serialization so diffs are clean.

### Phasing (Tester verifies after each phase)

**Phase 1 — Kit-side extensions.** Multi-scene API + 9 inventory categories + new predicates + cross-project smoke test. ~3-4 commits to `motion-test-kit` repo.

**Phase 2 — Well-dipper canonical naming.** Census every mesh-construction site, set `.name` + `userData` per the canonical list, set `renderer.info.autoReset = false`, fix LabMode reticle selector. ~1-3 commits to well-dipper.

**Phase 3 — Tier 1 + Tier 2 + Tier 3 inspector.** `window.__wd`, Shift+I panel, golden snapshot scaffold. ~2-3 commits.

**Phase 4 — Persona + runbook + Tester verification of full layer.** Update `docs/PERSONAS/tester.md` Inventory invocation pattern with new categories + Shift+I path. Update `runbooks/06-scene-inventory.md` for multi-scene + new categories. Cross-workstream: close AC #21 of `motion-test-kit-scene-inventory-2026-05-05`.

Each phase: working-Claude implements → reports to Max → Max confirms hand-off → Tester verifies via real-user path → summary for Max → Max confirms in real browser → next phase.

## In scope

- Naming convention applied to every mesh in the canonical list (§"Canonical naming list" above).
- 9 new inventory categories (camera / light / material / clock / mode / rt / phase / audio / input) added to kit `takeSceneInventory(...)` output.
- Predicate functions for each new category in `core/inventory/predicates.js`.
- Multi-scene API (`scenes: [...]`) for `takeSceneInventory(...)`.
- `userData = { category, kind, id, generation }` mirroring on every named asset.
- `renderer.info.autoReset = false` on `RetroRenderer`'s `WebGLRenderer`.
- `mtk.` namespace prefix discipline for kit-injected meshes.
- LabMode reticle selector fix (`#targeting-reticle` → `#targeting-overlay`).
- Tier 1 programmatic surface (`window.__wd.takeSceneInventory`, etc.) gated by `import.meta.env.DEV`.
- Tier 2 in-page inspector panel toggled by Shift+I (no-op in text input focus).
- Tier 3 golden snapshot scaffold: per-scenario JSON files at `tests/golden/scene-inventory/<scenario>.json`, sorted-by-name serialization, generation workflow via lab-mode flag.
- Bit-stable hash test in kit self-tests (refactor of fnv1a function fails loudly).
- Tester persona update: Inventory invocation pattern extended with new categories + multi-scene + Shift+I path.
- Runbook 06 update: same.
- Cross-workstream verification of `motion-test-kit-scene-inventory-2026-05-05` AC #21.

## Out of scope

- **Triaging the two parked regressions** (reticle-persists-after-warp, warp-tunnel-second-half-not-rendering). This workstream UNBLOCKS triage by providing the inspection layer; the actual diagnose-and-fix work happens in a follow-up workstream.
- **Fixing lab-mode scenarios 4 + 7** (the warp-rendering bug surfaced today). Adjacent; not this workstream's scope. Sibling/follow-up.
- **Names on auto-generated geometry** (starfield points, asteroid shards, nebula particles). Anti-criteria: container is named, instances aren't.
- **GLTF round-trip support** for the dotted naming. Documented as a future constraint; not actively supported here.
- **Production-shippable inspector panel.** Tier 2 is dev-only via `import.meta.env.DEV`. If Max wants the inspector reachable on the live deploy, that's a follow-up workstream.
- **Camera or light naming for procedural scene-trees beyond well-dipper's current set.** Future projects may extend the convention.
- **`audio.beat-sync` BPM detection** beyond what `AudioContext.currentTime` already exposes. Audio inventory captures playback state, not derived beat analysis.

## Drift risks

### Risk 1 — Naming-policy drift across construction sites

Mesh construction is spread across many files. Over time, new meshes get added without naming policy applied. The 100% criterion erodes silently.

**Why it happens:** Each new feature's PR adds a mesh; the author doesn't think about the naming convention; reviewer doesn't catch it; the canonical list goes out of date.

**Guard:** A kit self-test (CI-shape) walks the well-dipper scene at canonical scenarios + asserts every load-bearing-criteria mesh has a non-empty name. If a new mesh is added without naming, the test FAILs and points at the construction site.

### Risk 2 — Hash collisions in procedural-system planet IDs

`fnv1a` is non-cryptographic; collision probability at 5-6 hex chars is ~1 in 1M-16M. Across many systems, collisions WILL happen eventually.

**Why it happens:** Birthday paradox at scale.

**Guard:** Two-tier ID — short hash on `name` for greppability, full-length hash on `userData.id` for collision safety. Tester predicate uses `userData.id` for cross-system resolution; `name` is for human inspection within a single system. Document this in the convention; flag if Tester ever encounters a same-name-different-id within a single inventory snapshot (real signal something's wrong).

### Risk 3 — Multi-scene `source` tagging breaks single-scene callers

Existing kit consumers call `takeSceneInventory({ scene, camera })`. Extending to `scenes: [...]` is breaking unless we ship a back-compat shim.

**Why it happens:** API evolution.

**Guard:** Phase 1 of execution explicitly verifies all existing kit callers (well-dipper Phase 5 telemetry, lab-mode `captureEntrySnapshot`, kit's own self-tests + cross-project smoke) keep working through the API change. Either via shim (single-scene call rewrites internally to single-element list) or via a one-time call-site sweep.

### Risk 4 — Tier 2 inspector panel ships to production

Vite tree-shaking + `import.meta.env.DEV` is the standard pattern, but a typo or misconfigured export can leak the panel into the prod bundle.

**Why it happens:** Single-character config bug, easy to miss.

**Guard:** Phase 3 commits include a production-build smoke test: `npm run build` + grep the dist bundle for the inspector panel's distinctive string ("Lab mode" or "Inventory") and assert zero matches.

### Risk 5 — `renderer.info.autoReset = false` semantic change breaks existing readers

Setting autoReset to false changes when `renderer.info.calls/triangles` reset. Existing code that READS those values for debug HUD or performance monitoring may now see accumulating numbers across frames.

**Why it happens:** Three.js's default behavior changes; downstream consumers haven't been audited.

**Guard:** Phase 2 includes a code search for `renderer.info.calls`, `renderer.info.triangles`, `renderer.info.points`, `renderer.info.lines` reads in well-dipper's codebase. Each reader either (a) explicitly resets before reading (`renderer.info.reset()`) or (b) deals with cumulative numbers (e.g., performance over a window).

### Risk 6 — Inventory category sprawl

9 new categories is a lot. Future workstreams will tempt adding "just one more category" — geometry, instance counts, render order, sort-bucket assignments, etc. The inventory shape grows unboundedly.

**Why it happens:** Each new assertion need adds a category that "feels" useful.

**Guard:** This brief scopes 9 categories explicitly. Adding a 10th requires a brief amendment OR a new workstream that justifies the addition against the load-bearing criteria from the research. PM owns the budget; working-Claude doesn't add categories ad-hoc.

### Risk 7 — Bit-stable hash function changes silently

If `fnv1a` is swapped for a different hash (or its implementation changes subtly), every procedural planet's name changes. Save-breaking; Tester references break.

**Why it happens:** A future refactor "modernizes" the hash function for some unrelated reason.

**Guard:** Bit-stable test in kit self-tests: assert `body.planet.<hash>` for system seed `12345` is byte-identical to a hardcoded expected value. Test fails loudly on any change. Refactoring the hash is then a deliberate save-migration decision, not an accident.

### Risk 8 — DOM-overlay registry stale references

The lab-mode overlay registry caches resolved Element references. If the targeted DOM elements get re-mounted (e.g., HUD rebuilt on system change), the cached references go stale.

**Why it happens:** DOM lifecycle of HUD elements + cache invalidation gap.

**Guard:** Per runbook 06 §"Common pitfalls" #4 — registry uses lazy resolver functions instead of selector strings for elements that mount/unmount mid-session. Document in the registry's own JSDoc.

## Handoff to working-Claude

**Read first, in this order:**

1. This brief end-to-end.
2. `~/.claude/projects/-home-ax/memory/feedback_one-feature-at-a-time.md` — the workflow that gates each phase.
3. `~/.claude/projects/-home-ax/memory/feedback_test-actual-user-flow.md` — programmatic-API verification doesn't substitute for user-input verification.
4. `~/projects/motion-test-kit/runbooks/06-scene-inventory.md` — current kit invocation patterns; extend per Phase 1.
5. `~/projects/motion-test-kit/core/inventory/inventory-shape.md` — existing shape; will be extended in Phase 1.
6. `docs/PERSONAS/tester.md` §"Production-grade verification (post-migration)" — Tester's verification stack reference.

**Build order is dependency-strict:**

- Phase 1 (kit-side extensions) — depends on nothing prior.
- Phase 2 (well-dipper naming) — can start in parallel with Phase 1's tail (Phase 1's API can stub if Phase 2 needs to compile against it earlier), but Phase 2's full integration depends on Phase 1's API being final.
- Phase 3 (Tier 1/2/3 inspector) — depends on Phase 2 (named meshes exist).
- Phase 4 (persona + runbook + cross-workstream) — depends on Phases 1-3.

Each phase: working-Claude commits → reports to Max → Max confirms hand-off → Tester verifies via real-user path (no programmatic-API substitution per `feedback_test-actual-user-flow.md`) → Tester writes Summary-for-Max + structured verdict → Max confirms in real browser → next phase.

**Critical rules:**

1. **The canonical naming list is the contract.** If working-Claude finds a mesh-construction site that fits the load-bearing criteria but isn't on the list, surface to PM for amendment — don't silently add OR silently skip.
2. **`mtk.` prefix is non-negotiable for kit-injected meshes.** Don't reach around and let a kit helper land in well-dipper's `body.*` or `effect.*` namespace.
3. **Bit-stable hash test is a hard gate.** Phase 1 ships only if the bit-stability test passes.
4. **Tier 2 must NOT ship to production.** Phase 3's production-build grep test is a hard gate.
5. **Don't fix lab-mode scenarios 4 + 7 in this workstream.** That's adjacent/follow-up; out of scope.
6. **Don't triage the two parked regressions in this workstream.** Same — out of scope; this workstream UNBLOCKS triage.
7. **Tester verification uses real `chrome-devtools press_key`, NOT `evaluate_script` calling internal functions.** Per `feedback_test-actual-user-flow.md`. Programmatic-API verification is a separate AC, not a substitute.

**What "done" looks like:**

- Every name in the canonical list resolves via `getObjectByName` at the appropriate scenario.
- Inventory snapshot at any lab-mode scenario shows: 100% criteria-fitting assets named (no `name === ''` for any criteria-fitting asset), 9 new categories populated, multi-scene `source` tagging working, `renderer.info` aggregates non-zero (autoReset off + at least one render frame elapsed).
- `meshVisibleAt`, `overlayVisibleAt`, all 9 new predicates resolve correctly (PASS or FAIL with semantic correctness, never fail-by-not-found).
- Shift+I (real keypress) toggles Tier 2 inspector panel showing latest snapshot.
- `tests/golden/scene-inventory/<scenario>.json` files generated for at least one canonical scenario; `diffInventories` against goldens works.
- Tester PASS at the to-be-shipped commit.
- Brief flipped to `Shipped <commit-sha>`. Push origin per `feedback_push-on-shipped.md` (well-dipper on established-deploy list); bump kit submodule pointer in well-dipper if Phase 1 changes shipped to kit's master.

**What artifacts to produce:**

- `motion-test-kit` repo commits across Phase 1 (multi-scene API + 9 categories + predicates + bit-stable hash test + smoke test extension).
- Well-dipper commits across Phases 2-3 (canonical naming applied site-by-site + autoReset + LabMode fixes + Tier 1/2/3 inspector + golden snapshot scaffold).
- `docs/PERSONAS/tester.md` update for Phase 4 (in well-dipper repo).
- `~/projects/motion-test-kit/runbooks/06-scene-inventory.md` update for Phase 4.
- Cross-workstream verification commit closing AC #21 of `motion-test-kit-scene-inventory-2026-05-05`.

## Open questions

1. **Scope-narrow Q3?** I scoped all 9 inventory categories per the research recommendation. Max could opt to narrow to load-bearing-for-current-needs (e.g., `material` + `phase` + `clock` only) if the full 9-category scope feels too large for one workstream. Default: all 9.

2. **Sol's planet IDs vs procedural — how do we handle a procedural system that happens to be Sol's seed?** Edge case. The Sol carve-out should match on canonical-name-presence, not seed value. Surface during execution if it becomes contested.

3. **Tier 2 inspector panel UX details.** Panel size, position, JSON pretty-print depth, how the "copy to clipboard" interaction works — leaving these to working-Claude execution per Drift Risk #4 of the lab-mode brief ("scope-creep on per-scenario polish"). If Max has strong UX preferences, surface during Phase 3.

---

*Brief authored by Claude (in PM step-into role) 2026-05-06 against well-dipper HEAD `651bdab` + motion-test-kit HEAD `1b79c78`. Per `feedback_one-feature-at-a-time.md`, this is one workstream — no near-autonomous multi-workstream campaigns. Three-Max-gate loop applies: PM persona ↔ Max → brief → working-Claude executes one phase → reports to Max → Max confirms hand-off → Tester verifies → Max confirms in real browser → next phase.*
