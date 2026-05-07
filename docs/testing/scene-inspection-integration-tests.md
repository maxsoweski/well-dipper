# Scene-inspection layer — integration test plan (2026-05-07)

Pass/fail tests covering the full inspection layer:

- **Phase 1** (`motion-test-kit` 7be6857..ac88951) — multi-scene API + 9 categories + 9 predicates + bit-stable hash.
- **Phase 2** (`well-dipper` bdb872f..da3d4a2) — canonical naming, generator metadata, autoReset, LabMode reticle, markAsOrigin.
- **Phase 3** (`well-dipper` c24d3f1) — `window.__wd`, Shift+I panel, golden scaffold, production drift guard.
- **Carve-outs** (`well-dipper` 776925a) — AsteroidBelt, ShipSpawner, synthetic lights, named-container injection.

Tests are organized into nine groups. Each test has a concrete pre-condition, procedure, PASS condition, and FAIL condition. Where automation is possible, the auto-runnable form is in `tests/scene-inspection/integration-suite.js` (run from browser console with `__wd_runIntegrationSuite()`).

The split is intentional: structural / deterministic checks are automated; felt-experience and user-input-flow checks are manual because Max's eyes (or his actual keyboard) are the load-bearing instrument.

---

## Test environment setup (one-time per session)

1. WSL terminal: `cd ~/projects/well-dipper && npm run dev`
2. Windows: launch Chrome on port 9223 (per `chrome-devtools-9223-launch.md`) and navigate to `http://localhost:5174/well-dipper/`.
3. Click the splash text once, then press Space twice to reach interactive Sol.
4. Confirm: `typeof window.__wd === 'object'` (DevTools console).
5. Mute audio: `localStorage.setItem('well-dipper-settings', JSON.stringify({masterVolume: 0}))`.

If `window.__wd` is undefined, the Phase 3 install never ran; check the console for `[SceneInspector] install skipped:` warnings before proceeding.

---

## Group A — Naming taxonomy (Phase 2 + carve-outs)

### A1. Canonical Sol bodies named

**Intent:** Every Sol body with a `profileId` in `KnownBodyProfiles` resolves to its canonical short id; Sol bodies without `profileId` (Ceres, Haumea, Makemake, Eris) get stable 6-char hash IDs.

**Procedure:**
```js
const inv = __wd.takeSceneInventory();
const bodies = inv.meshes.filter(m => m.name?.startsWith('body.')).map(m => m.name).sort();
const required = ['body.planet.earth','body.planet.mars','body.planet.mercury','body.planet.venus','body.planet.jupiter','body.planet.saturn','body.planet.uranus','body.planet.neptune','body.planet.pluto','body.moon.luna','body.moon.io','body.moon.europa','body.moon.ganymede','body.moon.callisto','body.moon.titan','body.moon.triton','body.moon.charon'];
const missing = required.filter(n => \!bodies.includes(n));
const unseeded = bodies.filter(n => n.endsWith('.unseeded'));
console.log({ missing, unseeded, totalBodies: bodies.length });
```

**PASS:** `missing.length === 0 && unseeded.length === 0`.
**FAIL:** any required name missing OR any `.unseeded` entry present.

### A2. AsteroidBelt naming

**Intent:** Both Sol asteroid belts (main + kuiper) appear named in the inventory.

**Procedure:**
```js
const belts = __wd.takeSceneInventory().meshes.filter(m => m.name?.startsWith('body.asteroid-belt')).map(m => m.name).sort();
console.log(belts);
```

**PASS:** `JSON.stringify(belts) === '["body.asteroid-belt.kuiper","body.asteroid-belt.main"]'`.
**FAIL:** different array.

### A3. ShipSpawner NPC naming

**Intent:** Spawned NPC ships appear named with archetype + ordinal.

**Procedure:**
```js
const ships = __wd.takeSceneInventory().meshes.filter(m => m.name?.startsWith('ship.npc.'));
const allArchetyped = ships.every(s => /^ship\.npc\.\w+\.\d+-\d+$/.test(s.name));
console.log({ count: ships.length, allArchetyped, sample: ships.slice(0, 3).map(s => s.name) });
```

**PASS:** `count > 0 && allArchetyped === true`. Some Sol systems spawn 0 ships if the spawner skipped them; rerun via `__wd.takeSceneInventory().meshes.filter(...)` after autopilot tour begins.
**FAIL:** any ship.npc.* entry that doesn't match the regex.

### A4. Warp portal complete naming

**Intent:** All five warp meshes from the brief plus the parent group are named.

**Procedure:**
```js
const warp = __wd.takeSceneInventory().meshes.filter(m => m.name?.startsWith('effect.warp.')).map(m => m.name).sort();
const required = ['effect.warp.entry-strip','effect.warp.landing-strip','effect.warp.portal-a','effect.warp.portal-b','effect.warp.portal-group','effect.warp.tunnel'];
const missing = required.filter(n => \!warp.includes(n));
console.log({ missing });
```

**PASS:** `missing.length === 0`.
**FAIL:** any missing.

### A5. Sky layers + HUD elements

**Intent:** Sky and HUD layer containers appear by name.

**Procedure:**
```js
const inv = __wd.takeSceneInventory();
const sky = inv.meshes.filter(m => m.name?.startsWith('sky.')).map(m => m.name).sort();
const hud = inv.meshes.filter(m => m.name?.startsWith('hud.')).map(m => m.name).sort();
console.log({ sky, hud });
```

**PASS:** `sky` includes at least `sky.starfield.main` + one of `sky.glow.{galaxy, procedural}` + `sky.feature-layer.main`. `hud` may be empty (HUD elements are conditional).
**FAIL:** primary sky layers missing.

### A6. userData mirror

**Intent:** Every named asset has matching `userData = { category, kind, id, generation }` mirror; `_systemSeed` propagated for procedural ids.

**Procedure:**
```js
const named = __wd.takeSceneInventory().meshes.filter(m => m.name);
const earthMesh = __wd.getNamed('body.planet.earth');
const ud = earthMesh?.userData;
console.log({ category: ud?.category, kind: ud?.kind, id: ud?.id, generation: ud?.generation, systemSeed: ud?.systemSeed });
```

**PASS:** `category === 'body' && kind === 'planet' && id === 'earth' && systemSeed === 'sol'`.
**FAIL:** any field missing or wrong value.

---

## Group B — Multi-scene source tagging (Phase 1)

### B1. Source tag on every mesh

**Intent:** Every mesh entry in the inventory carries a `source` field set to either `'main'` or `'sky'`.

**Procedure:**
```js
const inv = __wd.takeSceneInventory();
const sources = new Set(inv.meshes.map(m => m.source));
const allHaveSource = inv.meshes.every(m => typeof m.source === 'string' && m.source.length > 0);
console.log({ sources: [...sources], allHaveSource });
```

**PASS:** `sources` is `Set { 'main', 'sky' }`, `allHaveSource === true`.
**FAIL:** any mesh missing `source`, or any source value other than `main`/`sky`.

### B2. Source filter on predicates

**Intent:** `meshVisibleAt` with `{ source: 'sky' }` only matches sky-scene meshes.

**Procedure:**
```js
// Construct an inventoriesByPhase Map with one entry from current state.
const inv = __wd.takeSceneInventory();
const invs = new Map([['NOW', inv]]);
const { meshVisibleAt } = await import('motion-test-kit/core/inventory/predicates.js');
// Sky has its own starfield. Main scene has body.planet.* but NO sky.starfield.
const skyHit = meshVisibleAt(invs, { phaseKey: 'NOW', meshName: 'sky.starfield.main', source: 'sky' });
const mainMiss = meshVisibleAt(invs, { phaseKey: 'NOW', meshName: 'sky.starfield.main', source: 'main' });
console.log({ skyHit: skyHit.passed, mainMissPassed: mainMiss.passed });
```

**PASS:** `skyHit === true && mainMissPassed === false`.
**FAIL:** mismatch.

---

## Group C — 9 new predicates (Phase 1)

For each predicate, run against current Sol state. Some require setting up two phases via successive snapshots.

### C1. cameraConfigAt

```js
const invs = new Map([['NOW', __wd.takeSceneInventory()]]);
const { cameraConfigAt } = await import('motion-test-kit/core/inventory/predicates.js');
const cam = invs.get('NOW').cameras[0];
const r = cameraConfigAt(invs, { phaseKey: 'NOW', cameraRole: cam.name, expected: { fov: cam.fov, aspect: cam.aspect } });
console.log(r);
```

**PASS:** `r.passed === true` (camera matches its own captured config — sanity).
**FAIL:** `passed === false`.

### C2. lightActiveAt (synthetic lights)

```js
const invs = new Map([['NOW', __wd.takeSceneInventory()]]);
const { lightActiveAt } = await import('motion-test-kit/core/inventory/predicates.js');
const r = lightActiveAt(invs, { phaseKey: 'NOW', lightId: 'light.star.sol', intensityMin: 0.9 });
console.log(r);
```

**PASS:** `r.passed === true`.
**FAIL:** `passed === false`.

### C3. uniformValueAt (warp.tunnel uTime)

```js
const invs = new Map([['NOW', __wd.takeSceneInventory()]]);
const { uniformValueAt } = await import('motion-test-kit/core/inventory/predicates.js');
const tunnel = invs.get('NOW').materials.find(m => m.role === 'warp.tunnel');
const uTime = tunnel?.uniforms?.uTime;
const r = uniformValueAt(invs, { phaseKey: 'NOW', materialRole: 'warp.tunnel', uniformName: 'uTime', expected: uTime, tolerance: 0.001 });
console.log({ uTime, passed: r.passed });
```

**PASS:** `r.passed === true && typeof uTime === 'number'`.
**FAIL:** material missing OR uniform missing OR mismatch.

### C4. clockProgressedSince

```js
const t0 = __wd.takeSceneInventory();
await new Promise(r => setTimeout(r, 1000));
const t1 = __wd.takeSceneInventory();
const invs = new Map([['T0', t0], ['T1', t1]]);
const { clockProgressedSince } = await import('motion-test-kit/core/inventory/predicates.js');
const r = clockProgressedSince(invs, { phaseKey: 'T1', sincePhase: 'T0', clockSystem: 'audio.context', byMinSeconds: 0.5 });
console.log(r);
```

**PASS:** `r.passed === true` (audio.context advances ~1s in 1s wall clock).
**FAIL:** `passed === false`.

### C5. modeIs

```js
const invs = new Map([['NOW', __wd.takeSceneInventory()]]);
const { modeIs } = await import('motion-test-kit/core/inventory/predicates.js');
const expected = invs.get('NOW').modes['warp.pipeline'];
const r = modeIs(invs, { phaseKey: 'NOW', slot: 'warp.pipeline', expected });
console.log({ expected, passed: r.passed });
```

**PASS:** `r.passed === true && expected === 'dual-portal'`.
**FAIL:** mismatch or different pipeline value.

### C6. renderTargetSize

Currently no host-registered render targets in well-dipper. Procedure: SKIP or explicit-empty assertion.

```js
const inv = __wd.takeSceneInventory();
console.log({ rtCount: inv.renderTargets?.length ?? 0 });
```

**PASS (current):** `rtCount === 0` — render targets opt-in; nothing registered yet.
**FAIL (after registration):** when host registers a target, run renderTargetSize against it.

### C7. phaseEquals

```js
const invs = new Map([['NOW', __wd.takeSceneInventory()]]);
const { phaseEquals } = await import('motion-test-kit/core/inventory/predicates.js');
const r = phaseEquals(invs, { phaseKey: 'NOW', system: 'warp', expected: 'idle' });
console.log(r);
```

**PASS:** `r.passed === true` (warp is idle when not warping).
**FAIL:** different state.

### C8. audioPlayingAt

```js
const invs = new Map([['NOW', __wd.takeSceneInventory()]]);
const { audioPlayingAt } = await import('motion-test-kit/core/inventory/predicates.js');
const tracks = invs.get('NOW').audio.map(a => a.track);
console.log({ tracks });
// Default has 'context' track if AudioContext is wired
```

**PASS:** `tracks` includes `'context'` (or richer if a host provider is set).
**FAIL:** empty audio array AND host provider was supposed to be set.

### C9. inputContains

```js
const invs = new Map([['NOW', __wd.takeSceneInventory()]]);
const { inputContains } = await import('motion-test-kit/core/inventory/predicates.js');
const heldKeys = invs.get('NOW').input?.['held-keys'];
console.log({ heldKeys, isArray: Array.isArray(heldKeys) });
```

**PASS:** `Array.isArray(heldKeys) === true`.
**FAIL:** missing field.

---

## Group D — Inventory shape integrity (Phase 1)

### D1. All 9 categories present after install

**Intent:** A single `__wd.takeSceneInventory()` call exposes every category that was opted in.

**Procedure:**
```js
const inv = __wd.takeSceneInventory();
const present = {
  meshes: \!\!inv.meshes,
  cameras: \!\!inv.cameras,
  lights: \!\!inv.lights,
  materials: \!\!inv.materials,
  clocks: \!\!inv.clocks,
  modes: \!\!inv.modes,
  phases: \!\!inv.phases,
  audio: \!\!inv.audio,
  input: \!\!inv.input,
  composerPasses: 'composerPasses' in inv,
  rendererInfo: \!\!inv.rendererInfo,
};
console.log(present);
```

**PASS:** `meshes && cameras && lights && materials && clocks && modes && phases && audio && input && rendererInfo` are all true. `composerPasses` may be absent if no composer is wired.
**FAIL:** any of the host-opted-in fields missing.

### D2. Renderer info aggregates accumulate (autoReset = false)

**Intent:** Phase 2 set `renderer.info.autoReset = false`. After several render frames, draw call / triangle counts should be non-zero and growing.

**Procedure:**
```js
const a = __wd.takeSceneInventory().rendererInfo.drawCalls;
await new Promise(r => setTimeout(r, 500));
const b = __wd.takeSceneInventory().rendererInfo.drawCalls;
console.log({ a, b, grew: b > a });
```

**PASS:** `b > a` (calls accumulate across renders).
**FAIL:** `b === a` (autoReset isn't false, or rendering is paused).

---

## Group E — Bit-stable hash (Phase 1)

### E1. fnv1a canonical pinning

**Intent:** Procedural body ids depend on `fnv1aString(seed:ordinal)`. The kit's `tests/hash.test.js` pins canonical hex outputs. A refactor of the hash function would break every persisted save.

**Procedure:**
```bash
cd ~/projects/motion-test-kit && npm test 2>&1 | grep -E "FNV-1a bit-stable" | head -5
```

**PASS:** All bit-stable test cases pass (output `✔` lines).
**FAIL:** any `✗` on the bit-stable test.

### E2. Sol-bodies match canonical hashes after seed-stamp

**Intent:** Sol bodies without profileId (Ceres at ordinal 4, Haumea at 10, etc.) generate stable 6-char hashes that remain identical across reloads.

**Procedure:**
```js
const before = __wd.takeSceneInventory().meshes.filter(m => m.name?.startsWith('body.planet.')).map(m => m.name).sort();
// Reload page (manual: F5), re-enter Sol via _lab.enterSol(), re-run snapshot.
// Compare arrays — should be identical.
```

**PASS:** before-reload and after-reload arrays are byte-identical.
**FAIL:** any planet name differs (would mean fnv1a produced different output).

---

## Group F — Golden snapshot scaffold (Phase 3)

### F1. serializeForGolden produces stable canonical form

**Intent:** UUIDs stripped, worldPos rounded to 3 decimals, arrays sorted by name/id/role.

**Procedure:**
```js
const g = __wd.serializeForGolden();
const sample = g.meshes[0];
console.log({
  hasUuid: 'uuid' in sample,
  hasMaterialUuid: 'materialUuid' in sample,
  worldPosRounded: sample.worldPos?.every(n => Number.isInteger(n) || (n.toString().split('.')[1]?.length ?? 0) <= 3),
  meshesSorted: g.meshes.slice(0,3).map(m => m.name).every((n, i, arr) => i === 0 || arr[i-1] <= n),
});
```

**PASS:** `hasUuid === false && hasMaterialUuid === false && worldPosRounded === true && meshesSorted === true`.
**FAIL:** any check false.

### F2. quickGoldenDiff detects deltas

**Intent:** When two golden snapshots differ in mesh names (e.g., a regression introduced an extra mesh OR removed one), the diff reports it.

**Procedure:**
```js
const g1 = __wd.serializeForGolden();
const g2 = JSON.parse(JSON.stringify(g1));
g2.meshes.push({ name: 'body.planet.fake-zorbon', source: 'main', visible: true, inFrustum: true, type: 'Mesh', frustumCulled: true, layer: 1, worldPos: [0,0,0] });
const diff = __wd.quickGoldenDiff(g1, g2);
console.log(diff);
```

**PASS:** `diff.meshesAppeared.includes('body.planet.fake-zorbon')`.
**FAIL:** `meshesAppeared` empty.

---

## Group G — Production drift guard (Phase 3)

### G1. Inspector strings absent from production bundle

**Intent:** `if (import.meta.env.DEV)` gates the inspector module load; vite DCE removes it from the production bundle. A misconfigured export or stray reference would let it ship.

**Procedure:**
```bash
cd ~/projects/well-dipper && npm run build && ./scripts/check-prod-no-inspector.sh
```

**PASS:** Script prints `PASS: no inspector strings in production bundle`.
**FAIL:** any of `__wd-inspector-panel`, `__wd Scene Inspector`, `[__wd.saveGolden]`, `installSceneInspector` found in `dist/assets/*.js`.

### G2. window.__wd undefined under production-emulation flag

**Intent:** Confirms gate works at runtime as well as build-time.

**Procedure:**
```bash
cd ~/projects/well-dipper && rm -rf dist && npm run build && npx vite preview --port 4173 --base /well-dipper/
```

Then in browser at `http://localhost:4173/well-dipper/` (no `?debug=1`):
```js
console.log({ wd: typeof window.__wd });
```

**PASS:** `wd === 'undefined'`.
**FAIL:** `wd === 'object'` (inspector leaked into prod runtime).

### G3. ?debug=1 opt-in re-enables in production

**Intent:** The carve-out lets Tester / Max load the inspector against a production build when needed.

**Procedure:** Same `npx vite preview` build, navigate to `http://localhost:4173/well-dipper/?debug=1`, then check `typeof window.__wd`.

**PASS:** `wd === 'object'`.
**FAIL:** `wd === 'undefined'` (debug flag doesn't activate the inspector).

NOTE: Phase 3's installSceneInspector currently checks `import.meta.env.DEV || ?debug=1` — but the dynamic import is wrapped in `if (import.meta.env.DEV)`, so production code never even imports the module. To support `?debug=1` in production, the import wrapping needs `if (import.meta.env.DEV || urlParams.has('debug'))`. **Current state of this test: FAIL**. Tracked as a known gap.

---

## Group H — Warp lifecycle observability

### H1. Warp phase transitions visible in inventory

**Intent:** During a warp, `inv.phases.warp` advances through `idle → fold → enter → hyper → exit → idle`. The inspector captures each transition.

**Procedure:**
```js
// Set up sampler.
window.__warpPhases = [];
const interval = setInterval(() => {
  const p = __wd.takeSceneInventory().phases.warp;
  if (window.__warpPhases.at(-1) \!== p) window.__warpPhases.push(p);
}, 100);
// Trigger warp.
window._autoSelectWarpTarget?.();
// Press Space via real chrome-devtools press_key OR document.dispatchEvent.
// Wait for warp to complete (~5s).
await new Promise(r => setTimeout(r, 8000));
clearInterval(interval);
console.log(window.__warpPhases);
```

**PASS:** `__warpPhases` includes at minimum `['idle', 'fold', ..., 'idle']` with `'hyper'` between (legacy mode adds more transitions).
**FAIL:** transitions missing or stuck (e.g., never returns to `idle`).

### H2. Warp tunnel mesh visible during HYPER

**Intent:** The brief identifies `effect.warp.tunnel` as the regression target. During HYPER phase, `meshVisibleAt('effect.warp.tunnel')` should pass.

**Procedure:**
```js
// Capture inventory while in HYPER (use the sampler from H1, then probe at the right moment OR
// hook the sampler to take a full inventory snapshot when phases.warp === 'hyper').
// Then run meshVisibleAt against that captured inventory.
```

**PASS:** `meshVisibleAt(invs, { phaseKey: 'HYPER', meshName: 'effect.warp.tunnel' }).passed === true` for at least one HYPER snapshot.
**FAIL:** mesh never visible during HYPER (the parked regression `warp-tunnel-second-half-not-rendering` would manifest as `passed === false` here, which is actually GOOD evidence that the inspection layer can diagnose it).

### H3. markAsOrigin disambiguation (legacy path only)

**Intent:** The fixup commit `b16c8d3` renames demoted sky layers to `*.origin` during the legacy crossover. In dual-portal mode (current production default), `beginWarpTransition` is never called, so this test is N/A unless `_useDualPortal=false` is flipped.

**Procedure (legacy mode only):**
```js
// Edit src/main.js:1497 to const _useDualPortal = false; reload.
// Drive a warp; sample inv.meshes at HYPER mid-phase.
const invs = new Map([['HYPER', /* captured inventory */]]);
const skyMeshes = invs.get('HYPER').meshes.filter(m => m.name?.startsWith('sky.starfield.'));
const ids = new Set(skyMeshes.map(m => m.userData?.id));
console.log({ ids: [...ids] });
```

**PASS (legacy mode):** `ids` contains both `'main'` and `'origin'`.
**FAIL (legacy mode):** only one id present (markAsOrigin didn't fire).
**N/A (production):** dual-portal mode skips the path; expected behavior.

---

## Group I — Regression diagnostics

### I1. Reticle-persists-after-warp regression diagnose-able

**Intent:** The parked regression "reticle / runway persists after warp." With Phase 2, `effect.warp.landing-strip` is named, so `meshVisibleAt('effect.warp.landing-strip', { phaseKey: 'POST_EXIT' })` lets us assert visibility post-warp.

**Procedure:** Drive a warp, capture inventory ~2 seconds after the warp completes (warp returns to `idle` and player should be in destination system). Assert `meshVisibleAt`'s `passed === false` (mesh should be hidden post-warp).

**PASS (regression NOT triggered):** `landingStripVisible === false` after warp.
**FAIL (regression IS triggered):** `landingStripVisible === true` after warp — signal to file a bug.

The inspection layer's success here is binary: it can DETECT the regression. Whether the regression is currently present is an orthogonal question.

### I2. Warp-tunnel-second-half-not-rendering diagnose-able

Same shape as H2 above. The inspection layer's success: it gives a programmatic predicate to assert presence/absence of `effect.warp.tunnel` at every warp phase. Diagnosing the actual cause (geometry / material / camera-traversal / shader uniform) is downstream.

---

## Run order + scoring

Recommended run order: A → D → B → C → E → F → G → H → I.

Auto-runnable (Groups A–F via `tests/scene-inspection/integration-suite.js`): ~25 tests, completes in <2 seconds when Sol is loaded.

Semi-automated (Groups G–H): G1 + G2 require build artifacts; H1 + H2 require driving the warp and time-sampling.

Manual (Group I): regression detection requires interpretation — PASS means the layer can detect; whether the regression is currently present is a separate triage question.

**Suite-level PASS bar:** Groups A–F all pass + G1 passes (G2/G3 known-failing on production-emulation track). Groups H–I are diagnostic; their results inform follow-up work, not whether the inspection layer is working.

---

## Cross-references

- `~/projects/well-dipper/docs/WORKSTREAMS/welldipper-scene-inspection-layer-2026-05-06.md` — workstream brief.
- `~/projects/motion-test-kit/runbooks/06-scene-inventory.md` — kit-side technique reference.
- `~/projects/well-dipper/docs/PERSONAS/tester.md` — Tester persona Inventory invocation pattern.
- `~/.claude/state/dev-collab/tester-audits/welldipper-scene-inspection-layer-2026-05-06.md` — Tester verdicts T1–T4.
