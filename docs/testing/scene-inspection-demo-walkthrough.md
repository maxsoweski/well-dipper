# Scene-inspection layer — step-by-step demo (2026-05-07)

A guided walk-through of every feature shipped in the workstream. Each step has:
- **What it shows** — the capability being demonstrated.
- **You do** — exact keypress or paste-into-console.
- **You'll see** — concrete expected output.
- **Why it matters** — what this enables that wasn't possible before.

Total time: ~10–15 minutes if everything works first try; ~20 if the warp demo gets re-run for the visual experience.

---

## Setup (one-time before the demo)

In a WSL terminal:
```
cd ~/projects/well-dipper && npm run dev
```

In Chrome at `http://localhost:5174/well-dipper/`:
1. Click the splash text once (dismisses the prompt).
2. Press Space twice (advances through the studio + title splashes).
3. Open DevTools (F12), Console tab.
4. Paste:
   ```js
   localStorage.setItem('well-dipper-settings', JSON.stringify({masterVolume: 0}));
   _lab.enterSol();
   ```
5. Wait ~4 seconds. You should now be in Sol with 13 planets loaded.

Sanity check (paste in console):
```js
typeof __wd === 'object' && __wd.scenes().map(s => s.name)
```
Expected: `['main', 'sky']`. If `false` or `undefined`, the inspector didn't install — refresh and redo the splash steps.

---

## Demo 1 — Canonical naming taxonomy

**What it shows:** Every load-bearing scene asset has a stable, dotted-three-segment name.

**You do:** paste in console:
```js
const arr = __wd.takeSceneInventory().meshes.filter(m => m.name).map(m => m.name).sort();
({
  totalNamed: arr.length,
  byCategory: {
    'body.planet': arr.filter(n => n.startsWith('body.planet.')).length,
    'body.moon': arr.filter(n => n.startsWith('body.moon.')).length,
    'body.asteroid-belt': arr.filter(n => n.startsWith('body.asteroid-belt.')).length,
    'effect.warp': arr.filter(n => n.startsWith('effect.warp.')).length,
    'effect.starflare': arr.filter(n => n.startsWith('effect.starflare.')).length,
    'sky': arr.filter(n => n.startsWith('sky.')).length,
    'hud': arr.filter(n => n.startsWith('hud.')).length,
    'ship.npc': arr.filter(n => n.startsWith('ship.npc.')).length,
  },
  spotChecks: {
    earth: arr.includes('body.planet.earth'),
    mars: arr.includes('body.planet.mars'),
    luna: arr.includes('body.moon.luna'),
    'starflare.sol': arr.includes('effect.starflare.sol'),
    'warp.tunnel': arr.includes('effect.warp.tunnel'),
    'starfield.main': arr.includes('sky.starfield.main'),
  },
});
```

**You'll see** (in Sol with default debug-camera state):
```
{
  totalNamed: ~78,
  byCategory: {
    body.planet: 14,        // 9 canonical + 4 hash-named outer-Sol + Titan-as-planet
    body.moon: ~24,         // 7 canonical + ~17 hash-named smaller moons
    body.asteroid-belt: 2,  // main + kuiper
    effect.warp: 5,         // portal-a/b/tunnel/landing-strip/entry-strip
    effect.starflare: 1,    // effect.starflare.sol
    sky: 3,                 // starfield.main, glow.procedural, feature-layer.main
    hud: 0,                 // HUD only renders when targeting active
    'ship.npc': <varies>,   // ShipSpawner spawns 0-3 per planet
  },
  spotChecks: { earth: true, mars: true, luna: true, 'starflare.sol': true, ... },
}
```

All `spotChecks` should be `true`. `hud: 0` and `ship.npc: <varies>` are expected — HUD is conditional, ship spawn count varies by run. `body.star.sol` is intentionally absent — the star is represented as `effect.starflare.sol` since `StarRenderer.create()` was documented in the brief but never invoked in production (per scene-inspection commit `da3d4a2`).

**Why it matters:** Before this workstream, scene state was anonymous Object3D references. Now every body, effect, sky layer, and HUD element has a queryable name. `meshVisibleAt('body.planet.earth', ...)` resolves.

---

## Demo 2 — Multi-scene source tagging

**What it shows:** Meshes are tagged with which scene they came from (`'main'` or `'sky'`), so predicates can scope by scene.

**You do:**
```js
const inv = __wd.takeSceneInventory();
const counts = {};
for (const m of inv.meshes) counts[m.source] = (counts[m.source] || 0) + 1;
counts;
```

**You'll see:** `{ main: <large>, sky: <smaller> }` — split between game-world and sky-sphere meshes.

**Why it matters:** During warp the SkyRenderer can hold both an origin starfield and a destination starfield; the source tag disambiguates them.

---

## Demo 3 — All 9 inventory categories

**What it shows:** Beyond meshes, the inventory captures cameras, lights, materials (with uniform watchlists), clocks, modes, phases, audio, render targets, and input.

**You do:**
```js
const inv = __wd.takeSceneInventory();
({
  meshes: inv.meshes.length,
  cameras: inv.cameras.length,
  lights: inv.lights.length,
  materials: inv.materials.map(m => m.role),
  clocks: inv.clocks,
  modes: inv.modes,
  phases: inv.phases,
  rendererInfo: { calls: inv.rendererInfo.drawCalls, triangles: inv.rendererInfo.triangles },
})
```

**You'll see** (in Sol with default debug-camera state):
```
{
  meshes: ~178,                        // includes named-Group containers + ship.npc.*; varies
  cameras: 1,                          // main world camera
  lights: 1,                           // synthetic light.star.sol (host-derived)
  materials: ['warp.tunnel', 'sky.galaxyglow'],
  clocks: {
    wall: <large>,                     // performance.now()/1000; grows monotonically
    warp: 0,                           // 0 in idle (gated by phases.warp); current elapsed when warping
    'audio.context': 0,                // well-dipper doesn't expose AudioContext on window
    'autopilot.tour': 0,               // 0 in idle
  },
  modes: { 'sky.crossover': 'idle', 'autopilot.camera': 'ESTABLISHING', 'warp.pipeline': 'dual-portal' },
  phases: { warp: 'idle', autopilot: 'idle' },
  rendererInfo: { calls: <large>, triangles: <large> },  // accumulating; autoReset=false
}
```

Mesh count varies by ship spawn rate + camera state. `audio.context` is 0 in well-dipper because the host doesn't expose its AudioContext globally; the `audio` category is opt-in via `__wd.setAudioProvider(fn)` for hosts that want richer audio observability. Empty `audio: []` is expected here.

**Why it matters:** Each category has a matching predicate so you can write assertions across all of them.

---

## Demo 4 — getNamed lookup (direct Object3D access)

**What it shows:** From a name string, you get the actual `THREE.Object3D` reference for interactive poking.

**You do:**
```js
const earth = __wd.getNamed('body.planet.earth');
({
  position: earth.position.toArray().map(n => Number(n.toFixed(2))),
  visible: earth.visible,
  childrenCount: earth.children.length,
})
```

**You'll see:** Earth's position in scene units + visibility + child count.

**Why it matters:** Debugger handle. `__wd.getNamed('effect.warp.tunnel').material.uniforms.uPhase.value` reads the live shader uniform.

---

## Demo 5 — Predicate library

**What it shows:** The 9 new predicates (plus mesh/overlay/pass) work end-to-end against live state.

**You do:**
```js
const inv = __wd.takeSceneInventory();
const invs = new Map([['NOW', inv]]);
const { meshVisibleAt, lightActiveAt, phaseEquals, modeIs } =
  await import('motion-test-kit/core/inventory/predicates.js');

({
  earthVisible: meshVisibleAt(invs, { phaseKey: 'NOW', meshName: 'body.planet.earth' }).passed,
  starLightActive: lightActiveAt(invs, { phaseKey: 'NOW', lightId: 'light.star.sol', intensityMin: 0.9 }).passed,
  warpIdle: phaseEquals(invs, { phaseKey: 'NOW', system: 'warp', expected: 'idle' }).passed,
  pipelineDualPortal: modeIs(invs, { phaseKey: 'NOW', slot: 'warp.pipeline', expected: 'dual-portal' }).passed,
})
```

**You'll see:** all `true` (Earth may be `false` if frustum-culled at the default camera position; that's correct behavior).

**Why it matters:** Predicates are the assertion vocabulary. Tester / CI uses these to verify ACs without writing custom poke-the-scene code.

---

## Demo 6 — Shift+I inspector panel (Tier 2)

**What it shows:** Visual JSON-tree inspector overlay, toggleable via real keypress.

**You do:** click on the page (focus canvas), then press **Shift + I**.

**You'll see:** Floating panel bottom-right with header (`__wd Scene Inspector` + refresh/copy/close), summary line, and collapsible JSON tree. Click `▸` triangles to expand. "copy" puts JSON on clipboard. Shift+I again closes.

**Why it matters:** Visual triage when something looks wrong on-screen. Faster than typing console snippets.

---

## Demo 7 — Golden-snapshot scaffold (Tier 3)

**What it shows:** Inventory serializes to a stable canonical form (uuids stripped, positions rounded, arrays sorted) suitable for committing as a regression-detection baseline.

**You do:**
```js
const golden = __wd.serializeForGolden();
({
  size: JSON.stringify(golden).length,
  hasUuid: 'uuid' in golden.meshes[0],
  firstThreeMeshes: golden.meshes.slice(0, 3).map(m => m.name),
})
```

**You'll see:** `{ size: ~12000, hasUuid: false, firstThreeMeshes: [sorted names] }`.

To save as a download:
```js
__wd.saveGolden('sol-default-camera');
```

A file `sol-default-camera.json` downloads. Drop into `tests/golden/scene-inventory/` to commit a baseline.

**Why it matters:** Catches structural regressions (mesh names appeared/disappeared, draw-call budget exceeded) without flaky pixel comparisons.

---

## Demo 8 — Integration suite (auto-runner, Groups A–F)

**What it shows:** 19 deterministic structural tests run in <2 seconds, single command.

**You do:**
```js
const r = await __wd.runIntegrationSuite();
({ passed: r.passed, failed: r.failed, total: r.total })
```

**You'll see:** `{ passed: 19, failed: 0, total: 19 }`. The console also shows a grouped log with `✔` per test name.

**Why it matters:** Fast-feedback regression check. Run after touching any scene-construction code; if a test goes red, the naming taxonomy regressed.

---

## Demo 9 — Warp lifecycle suite + regression detection

**What it shows:** Drives a real warp end-to-end while sampling inventory at 100ms cadence. Verifies layer functionality AND reports rendering regressions.

**You do:** (heads-up: ~14 seconds wall time + visible warp animation)
```js
const r = await __wd.runWarpSuite();
({
  layerHealth: `${r.passed}/${r.total} PASS`,
  durationSec: r.durationSec.toFixed(1),
  phasesObserved: r.distinctPhases,
  regressions: r.regressions.map(rg => rg.id),
})
```

**You'll see:** A visible warp tunnel + transition on the canvas. Then in console:
```
{
  layerHealth: '4/4 PASS',
  durationSec: '14.0',
  phasesObserved: ['idle', 'fold', 'enter', 'hyper', 'exit'],
  regressions: ['warp-tunnel-second-half-not-rendering', 'reticle-persists-after-warp']
}
```

**Why it matters:**
- `4/4 PASS` = inspection layer captured the full warp lifecycle (every phase transition sampled, every observability check resolved).
- `regressions` array names the two parked bugs you called out at the start of the workstream — surfaced with concrete evidence (sample counts + phase context), without the layer itself failing. This is the ultimate test of the workstream's success.

---

## Demo 10 — Production drift guard

**What it shows:** The inspector + suite are dev-only. Production builds tree-shake the entire module.

**You do:** in a WSL terminal:
```
cd ~/projects/well-dipper && npm run build && ./scripts/check-prod-no-inspector.sh
```

**You'll see:** `PASS: no inspector strings in production bundle (dist/assets/*.js)`.

To prove it the other direction:
```
grep -c '__wd-inspector-panel' dist/assets/*.js
```
Expected: `0` matches.

**Why it matters:** The brief explicitly called this out as a drift risk (Tier 2 must not ship to prod). The grep test runs in CI / pre-commit and asserts the contract.

---

## After the demo

If everything passed and the warp suite reported the two regressions, the workstream is doing its job: gave us a vocabulary for scene state and a programmatic bug-detector. Two follow-ups available when you want:

1. **Triage workstream** — use the layer to diagnose `warp-tunnel-second-half-not-rendering` + `reticle-persists-after-warp` and fix them.
2. **Goldens** — capture per-scenario goldens via `__wd.saveGolden(scenarioName)` and commit so regressions in any structural-visibility AC become CI-detectable.

## Cross-references

- `docs/testing/scene-inspection-integration-tests.md` — full pass/fail catalog (Groups A–I).
- `docs/WORKSTREAMS/welldipper-scene-inspection-layer-2026-05-06.md` — workstream brief.
- `~/projects/motion-test-kit/runbooks/06-scene-inventory.md` — kit-side technique reference.
