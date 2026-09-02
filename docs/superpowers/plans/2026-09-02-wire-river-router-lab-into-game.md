# Wire the River Router (F11/F12) Lab → Game — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The game's solid bodies get the lab's dendritic rivers — routed on the lab's baked relief, carved into the surface, ribboned on top, draining into a drawn sea, with deltas/outflow/coasts driven — by MOVING the lab's own code under `src/` and running it through the province cube's worker + host, never by copying or grafting.

**Architecture:** Three riders on the existing carrier path (`sharedCarrierMesh → makeSphereField → writeBodyRelief` in `provinceWorker.js`, bound on first draw by `labBakeHost.js`). (1) The router, geometry builders and sea-level solver move byte-verbatim to `src/worldengine/rivers/`; the two GPU bakers to `src/rendering/bake/`; root modules import back + re-export (the `sphereMesh.js` / `provinceCube.js` precedent). (2) The lab's fluvial driver block becomes driver pack #8 (`fluvialDeck.js`), registered in `drivers/index.js`, read back by the lab. (3) The worker's one message per body grows into the whole `route()` bundle (province + relief + crater + carve + ribbon arrays); the host binds four cubes, parents the ribbon, writes the sea, and exposes two A/B keys.

**Tech Stack:** three.js (WebGLCubeRenderTarget / CubeCamera bakers, module Worker via Vite), vitest (`npx vitest run --dir tests` ALWAYS), the dev-collab contract + `verify-workstream` workflow, chrome-devtools for the live ACs.

**Spec:** `docs/WORKSTREAMS/wire-river-router-lab-into-game/contract.json` + `intent.md` (read both first). Prior art to read before any task: `src/rendering/bake/labBakeHost.js`, `provinceWorker.js`, `provinceDispatch.js`, `tests/province-bake-host.test.js`, `src/worldengine/drivers/solidFeatures.js` (+ its test), `docs/FEATURES/handoff-2026-09-01b-province-cube-wired-live-check-next.md` §3 traps.

## Global Constraints

- **Repo / branch:** `~/projects/well-dipper`, branch `feature/world-engine-production-L1` (lane A, NOT master). ⛔ ~700 untracked PNGs are normal. NEVER `git add -A`; add files by name.
- **Tests:** ALWAYS `npx vitest run --dir tests <file>` (the `--dir` matters; the sandbox otherwise picks up `~/.claude`). ⚠ Plain `node` cannot import `Planet.js` (`motion-test-kit` subpath exports) — measurement scripts run as vitest files under `tests/`, writing reports to a file (vitest hides `console.info` on passing tests).
- **Byte-verbatim moves.** Every moved function is cut and pasted with NO edits (diff the moved text against `git show 3dded82:<file>` and the diff must be empty). Root modules import back and re-export; import paths of every existing caller stay unchanged.
- **Headers on every new module:** FUNCTION / INTENT / non-goals, and for a moved module the line "moved here from `<file>` lines N–M (at `3dded82`) on 2026-09-02" (historical ranges are written that way, never as live `file:NNN` refs — the citation fence reads live refs and flags them PAST-EOF when the file shrinks).
- **Symbol-cited files are edited line-count-neutral:** `src/objects/Planet.js` (2309 lines), `src/objects/Moon.js` (706), `src/worldengine/drivers/index.js`, `tools/port-uniform-delta.mjs`. Append to an existing line; never insert a line. ⛔ An import appended AFTER a trailing `// comment` on the same line is a comment — split at the comment, put the import before it (trap that bit on 2026-09-01).
- **Lab edits (`world-engine-lab.html`) are §10 line-stable:** a replaced line becomes `// ↳ MOVED TO DRIVER PACK #8 (:NNNN). Was \`<old code>\`` at the same line; the pack call lands ON an existing line. Line count unchanged.
- **Corpus:** the 24 seeds `rocky-0` … `rocky-23` via `StarSystemGenerator.generate(seed, null)` = 156 bodies (124 solid / 32 gas). ⛔ A planet in `sys.planets` is an ENTRY wrapping `planetData`; use `e.planetData || e`. Moons are records. `setLabGasBodiesOverride(true)` in `beforeAll` (copy `tests/province-bake-host.test.js:40-59`).
- **The dev-server hook** matches the server command's text ANYWHERE in a Bash command, including inside heredocs and echo labels. Write docs with the Write tool; never put that command text in a Bash string.
- **Only Max starts servers.** Live ACs (AC-4/AC-5) wait for lane A's server on port 5175; Chrome:9223 launch is Claude's (see the handoff §4). Never Sol.
- **No new laws.** Every number comes from the lab: `DEFAULT_PARAMS`, `riverOverlayState` (`world-engine-lab.html:392`), `bakeReliefCrossover`, `visScaleOf`, the fluvial block at `:2123-2167`.
- **Commit at each task's end** with the message given; end messages with the two attribution lines:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01R2M3ure6uJCQiPQo6GNksg
  ```
- **Do not push.** Lane A pushes are confirmed by Max per batch.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/worldengine/rivers/router.js` (new) | MOVED: `DEFAULT_PARAMS`, `computeAdjGradient`, `IDENTITY_BUDGET`, `compositeMargins` (+ its `EPSILON_VCF` constant), `widthRadiusFactor`, `widthSeedFactor`, `paramsForRadius`, `computeOcean`, `routeAndOrder`. Three-coupled? (`routeAndOrder` is plain JS; the width helpers use `THREE.MathUtils`) — GPU-free, so `src/worldengine/` per carried C25. |
| `src/worldengine/rivers/ribbon.js` (new) | MOVED: `buildRibbonGeometry`, `buildValleyGeometry` (three-coupled, GPU-free). |
| `src/worldengine/rivers/seaLevel.js` (new) | MOVED: `solveSeaLevel` (+ `DEFAULT_BINS`) from `planet-lod-sealevel.js`. |
| `src/rendering/bake/carveCube.js` (new) | MOVED: `createCarveCubeMap` (GPU). |
| `src/rendering/bake/heightCube.js` (new) | MOVED: `RELIEF_CUBE_SIZE`, `buildHeightCubeGeometry`, `createHeightCube`, `bakeHeightCube` (GPU) from `planet-lod-tectonic.js`. |
| `planet-lod-rivers.js`, `planet-lod-tectonic.js`, `planet-lod-sealevel.js` | Root modules: import the moved symbols back, re-export them under the same names; the moved bodies deleted from here. |
| `src/worldengine/drivers/fluvialDeck.js` (new) | Driver pack #8: the lab's F11/F12/F13/F14/F20 derivation from the condition vector. Exports `fluvialDeckPack`, `FLUVIAL_DECK_ENTRY`, `FLUVIAL_DECK_UNIFORMS`, `FLUVIAL_DECK_LAB_BINDING`, `fluvialDeckLabState`, `fluvialDeckDirectDrivers`, `fluvialClassOf`, the four gate names. |
| `src/worldengine/drivers/index.js` | Registers `FLUVIAL_DECK_ENTRY` (append to an existing import line + the `PACKS` array element on an existing line). |
| `world-engine-lab.html` | Reads the pack back at `:2136` (call + mirror + direct write on that line); `:2137-2140`, `:2146-2148`, `:2151`, `:2156-2157`, `:2166-2167` neutralised in place. |
| `src/rendering/bake/provinceDispatch.js` | Gains `buildLabBundleForBody(body, mesh)` — the CPU half of the whole `route()`; keeps `buildProvinceForBody` (the province suite imports it). |
| `src/rendering/bake/provinceWorker.js` | Protocol grows: `in {id, condition, macroSeed, T_eq, radiusEarth}`; `out` carries province + relief + crater (+ valley + ribbon when routed) arrays, transferred. |
| `src/rendering/bake/labBakeHost.js` | `attachLabBake` / `disposeLabBake` (with `attachProvinceBake` / `disposeProvinceBake` kept as aliases): four cubes, ribbon child, sea override, keys `V` (province, unchanged) `J` (rivers) `U` (relief), `_labRivers` / `_labRelief` dev APIs. |
| `src/objects/Planet.js:4`, `:2076`, `:2001`; `src/objects/Moon.js:704` | Call sites renamed in place (same line count). |
| `tests/river-bake-host.test.js` (new) | AC-0 (definition-once + identity), AC-1 (pack over the corpus), AC-2 (bundle byte-identity + metrics), AC-3 (strength law + crossover-0 count), AC-7 (lifetime/transport). |
| `tests/driver-pack-fluvialdeck.test.js` (new) | The pack's own suite in the `driver-pack-solidfeatures.test.js` shape: formulas, gates, collision, membership, lab mirror. |
| Eight existing source-scan suites | Re-pointed to the moved locations (Task 1/2 list them). |
| `docs/FEATURES/one-pipeline-two-frontends-PLAN.md`, `mvp-spine-lab-quality-backlog.md`, `docs/NOW.md` | Task 8. |

---

### Task 1: Move the GPU-free router core under `src/worldengine/rivers/`

**Files:**
- Create: `src/worldengine/rivers/router.js`, `src/worldengine/rivers/ribbon.js`, `src/worldengine/rivers/seaLevel.js`
- Modify: `planet-lod-rivers.js` (delete the moved bodies at HEAD `3dded82` lines 66–120 `DEFAULT_PARAMS`, 164–221 `computeAdjGradient`, 222 `IDENTITY_BUDGET` + the `EPSILON_VCF` const near it, 241–280 `compositeMargins`, 281–316 the three width/params helpers, 576–585 `computeOcean`, 602–792 `routeAndOrder`, 794–915 `buildRibbonGeometry`, 916–1032 `buildValleyGeometry`; add import-back + `export { … }` re-exports), `planet-lod-sealevel.js` (becomes a one-line import-back + re-export of `solveSeaLevel`)
- Test: `tests/river-bake-host.test.js` (new, AC-0 block only in this task), plus re-point: `tests/relief-router-repoint.test.js`, `tests/ws4-router-zero-drift.test.js`, `tests/ws4-epoch-carve.test.js`, `tests/planet-lod-rivers-swappable-uplift.test.js`, `tests/worldengine-inc3b-relief-budget.test.js`, `tests/vis-scale-fence.test.js`, `tests/planet-lod-sealevel.test.js`

**Interfaces:**
- Produces: `src/worldengine/rivers/router.js` exports `DEFAULT_PARAMS, computeAdjGradient, IDENTITY_BUDGET, compositeMargins, widthRadiusFactor, widthSeedFactor, paramsForRadius, computeOcean, routeAndOrder` with the signatures they have today (`routeAndOrder({ mesh, height, grad, isOcean, params, precipWeight })` → `{ filled, surf, receiver, accum, order, strahler, isChannel, channelCount, landCount, uphill, orphan, selfLoopLand, maxOrder, orderHist, streamCount, … }`; `compositeMargins(carrier, budget, craterOut)` → `Float32Array|null`; `computeAdjGradient(carrier, heightOverride)` → `Float32Array(N*3)`; `paramsForRadius(params, radiusEarth, widthSeedMul)`; `widthSeedFactor(seed, params)`; `computeOcean(height, seaLevel, N, baseLevel)` → `{ isOcean, oceanCount }`). `ribbon.js` exports `buildRibbonGeometry({ mesh, routed, params })` → `THREE.BufferGeometry` with `position(3)`, `color(3)`, index, normals; `buildValleyGeometry({ mesh, routed, isOcean, params })` → `THREE.BufferGeometry` with `position(3)`, `aDepth(1)`, `aMouth(1)`, `aOrder(1)`, index. `seaLevel.js` exports `solveSeaLevel(heights, targetFraction, bins = 2048)`.

- [ ] **Step 1: Read the eight source-scan suites and record what each asserts about the symbols**

Run: `grep -n -E 'routeAndOrder|buildRibbonGeometry|buildValleyGeometry|solveSeaLevel|compositeMargins|computeAdjGradient|paramsForRadius|computeOcean|DEFAULT_PARAMS' tests/relief-router-repoint.test.js tests/ws4-router-zero-drift.test.js tests/ws4-epoch-carve.test.js tests/planet-lod-rivers-swappable-uplift.test.js tests/worldengine-inc3b-relief-budget.test.js tests/vis-scale-fence.test.js tests/planet-lod-sealevel.test.js tests/relief-height-cube.test.js`
Expected: a list of (a) runtime imports from the root modules — these keep working through re-exports, no change; (b) source-text regexes against `riversSrc` / the root file text — these must be re-pointed to the new module's text in Step 6. Write the list into the commit message. ⚠ `relief-router-repoint.test.js` parses `route()`'s BODY out of `planet-lod-rivers.js` and requires the strength gate, `carrier.height` re-point, and the preserved `sampler.read` fallback — `route()` does NOT move, so this suite must stay green unchanged. If it reds, the move touched `route()`; revert.

- [ ] **Step 2: Write the failing AC-0 test**

Create `tests/river-bake-host.test.js`:

```js
// tests/river-bake-host.test.js — docs/WORKSTREAMS/wire-river-router-lab-into-game/ (AC-0 … AC-3, AC-7).
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  routeAndOrder as routeViaLab, buildRibbonGeometry as ribbonViaLab, buildValleyGeometry as valleyViaLab,
  compositeMargins as compositeViaLab, computeAdjGradient as gradViaLab, computeOcean as oceanViaLab,
  paramsForRadius as paramsViaLab, widthSeedFactor as widthSeedViaLab, DEFAULT_PARAMS as PARAMS_VIA_LAB,
} from '../planet-lod-rivers.js';
import { solveSeaLevel as seaViaLab } from '../planet-lod-sealevel.js';
import {
  routeAndOrder, compositeMargins, computeAdjGradient, computeOcean, paramsForRadius, widthSeedFactor, DEFAULT_PARAMS,
} from '../src/worldengine/rivers/router.js';
import { buildRibbonGeometry, buildValleyGeometry } from '../src/worldengine/rivers/ribbon.js';
import { solveSeaLevel } from '../src/worldengine/rivers/seaLevel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

describe('AC-0 — one pipeline: the router core is defined once, under src/, and re-exported by the root modules', () => {
  const FILES = ['src/worldengine/rivers/router.js', 'src/worldengine/rivers/ribbon.js', 'src/worldengine/rivers/seaLevel.js',
    'planet-lod-rivers.js', 'planet-lod-sealevel.js', 'planet-lod-tectonic.js'];
  it('each moved router symbol is DEFINED exactly once, in its src/ module', () => {
    const all = FILES.map((p) => [p, read(p)]);
    const defs = (re) => all.filter(([, t]) => re.test(t)).map(([p]) => p);
    expect(defs(/^export const DEFAULT_PARAMS\b/m)).toEqual(['src/worldengine/rivers/router.js']);
    expect(defs(/^export function computeAdjGradient\(/m)).toEqual(['src/worldengine/rivers/router.js']);
    expect(defs(/^export function compositeMargins\(/m)).toEqual(['src/worldengine/rivers/router.js']);
    expect(defs(/^export function paramsForRadius\(/m)).toEqual(['src/worldengine/rivers/router.js']);
    expect(defs(/^export function computeOcean\(/m)).toEqual(['src/worldengine/rivers/router.js']);
    expect(defs(/^export function routeAndOrder\(/m)).toEqual(['src/worldengine/rivers/router.js']);
    expect(defs(/^export function buildRibbonGeometry\(/m)).toEqual(['src/worldengine/rivers/ribbon.js']);
    expect(defs(/^export function buildValleyGeometry\(/m)).toEqual(['src/worldengine/rivers/ribbon.js']);
    expect(defs(/^export function solveSeaLevel\(/m)).toEqual(['src/worldengine/rivers/seaLevel.js']);
  });
  it('the root modules import the moved code BACK and re-export the SAME function objects', () => {
    expect(routeViaLab).toBe(routeAndOrder);
    expect(ribbonViaLab).toBe(buildRibbonGeometry);
    expect(valleyViaLab).toBe(buildValleyGeometry);
    expect(compositeViaLab).toBe(compositeMargins);
    expect(gradViaLab).toBe(computeAdjGradient);
    expect(oceanViaLab).toBe(computeOcean);
    expect(paramsViaLab).toBe(paramsForRadius);
    expect(widthSeedViaLab).toBe(widthSeedFactor);
    expect(PARAMS_VIA_LAB).toBe(DEFAULT_PARAMS);
    expect(seaViaLab).toBe(solveSeaLevel);
    expect(DEFAULT_PARAMS.TARGET_N).toBe(40000);
    expect(DEFAULT_PARAMS.CARVE_CUBE_SIZE).toBe(1024);
    expect(DEFAULT_PARAMS.TARGET_OCEAN_FRACTION).toBe(0.35);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run --dir tests tests/river-bake-host.test.js`
Expected: FAIL — `Cannot find module '../src/worldengine/rivers/router.js'`.

- [ ] **Step 4: Create the three modules by MOVING the text**

For each module: header (FUNCTION / INTENT / non-goals / the "moved here from … lines N–M (at `3dded82`)" line / `⛔ BYTE-VERBATIM BELOW THIS LINE.`), then `import * as THREE from 'three';` where the moved text uses `THREE`, then the moved bodies in their original order. `router.js` needs the local constants the moved functions reference (`IDENTITY_BUDGET`, `EPSILON_VCF`, and whatever `DEFAULT_PARAMS`' block references) — find them with `grep -n 'EPSILON_VCF\|IDENTITY_BUDGET' planet-lod-rivers.js` and move them too. `seaLevel.js` = the whole of `planet-lod-sealevel.js` after its header.

Then in `planet-lod-rivers.js`, replace the deleted ranges with ONE import-back + re-export block placed where `DEFAULT_PARAMS` used to start:

```js
// ⭐ MOVED 2026-09-02 → src/worldengine/rivers/ (router.js, ribbon.js, seaLevel.js), byte-verbatim, for
// docs/WORKSTREAMS/wire-river-router-lab-into-game/. Imported back and RE-EXPORTED so every existing
// caller keeps this import path (the sphereMesh.js / bodyRelief.js precedent). route() below is unchanged.
import {
  DEFAULT_PARAMS, computeAdjGradient, IDENTITY_BUDGET, compositeMargins,
  widthRadiusFactor, widthSeedFactor, paramsForRadius, computeOcean, routeAndOrder,
} from './src/worldengine/rivers/router.js';
import { buildRibbonGeometry, buildValleyGeometry } from './src/worldengine/rivers/ribbon.js';
export {
  DEFAULT_PARAMS, computeAdjGradient, IDENTITY_BUDGET, compositeMargins,
  widthRadiusFactor, widthSeedFactor, paramsForRadius, computeOcean, routeAndOrder,
  buildRibbonGeometry, buildValleyGeometry,
};
```

Replace `planet-lod-rivers.js:17` `import { solveSeaLevel } from './planet-lod-sealevel.js';` with `import { solveSeaLevel } from './src/worldengine/rivers/seaLevel.js';`. Make `planet-lod-sealevel.js`'s body `export { solveSeaLevel } from './src/worldengine/rivers/seaLevel.js';` under a moved-note header.

- [ ] **Step 5: Prove the move is byte-verbatim**

Run (per moved function; example for `routeAndOrder`):
```bash
git show 3dded82:planet-lod-rivers.js | sed -n 602,792p > "$TMPDIR/was.js"
awk '/^export function routeAndOrder\(/,/^}/' src/worldengine/rivers/router.js > "$TMPDIR/now.js"
diff "$TMPDIR/was.js" "$TMPDIR/now.js" && echo VERBATIM
```
Expected: `VERBATIM` for every moved function (adjust the awk end-anchor if a function's closing brace is not at column 0 — check the source).

- [ ] **Step 6: Run the AC-0 test and the eight source-scan suites; re-point only text expectations**

Run: `npx vitest run --dir tests tests/river-bake-host.test.js tests/relief-router-repoint.test.js tests/ws4-router-zero-drift.test.js tests/ws4-epoch-carve.test.js tests/planet-lod-rivers-swappable-uplift.test.js tests/worldengine-inc3b-relief-budget.test.js tests/vis-scale-fence.test.js tests/planet-lod-sealevel.test.js tests/relief-height-cube.test.js`
Expected: AC-0 PASS. For any other suite that reds because it regex-scans the root file's TEXT for a moved definition, change the file it READS to the new module (e.g. `read('src/worldengine/rivers/router.js')`) — never weaken the regex. A suite that reds for any other reason is a move defect: fix the move.

- [ ] **Step 7: Run the fences**

Run: `npx vitest run --dir tests tests/src-boundary-fence.test.js tests/one-pipeline-fence.test.js tests/lab-shader-samplers.test.js tests/province-bake-host.test.js`
Expected: all PASS; the boundary fence's allowlist is still exactly ONE entry (nothing under `src/` may import a root module — `router.js` must import `three` and `src/` modules only; if `compositeMargins`/`computeAdjGradient` referenced anything root-level, that reference must be resolved to its `src/` home, which the earlier moves already made).

- [ ] **Step 8: Commit**

```bash
git add src/worldengine/rivers/router.js src/worldengine/rivers/ribbon.js src/worldengine/rivers/seaLevel.js planet-lod-rivers.js planet-lod-sealevel.js tests/river-bake-host.test.js <re-pointed tests by name>
git commit -F - <<'EOF'
move: the river router core → src/worldengine/rivers/ (router, ribbon, seaLevel), byte-verbatim; root modules re-export

routeAndOrder / computeOcean / computeAdjGradient / compositeMargins / paramsForRadius + width factors /
DEFAULT_PARAMS → router.js; buildRibbonGeometry / buildValleyGeometry → ribbon.js; solveSeaLevel →
seaLevel.js. planet-lod-rivers.js and planet-lod-sealevel.js import back and re-export; route() untouched
(relief-router-repoint green). Diffed against 3dded82: empty. Source-scan suites re-pointed: <list>.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01R2M3ure6uJCQiPQo6GNksg
EOF
```

---

### Task 2: Move the two GPU bakers under `src/rendering/bake/`

**Files:**
- Create: `src/rendering/bake/carveCube.js`, `src/rendering/bake/heightCube.js`
- Modify: `planet-lod-rivers.js` (delete `createCarveCubeMap`, HEAD lines 1147–1196; import back + re-export; change its `import { createHeightCube, buildHeightCubeGeometry, bakeHeightCube, RELIEF_CUBE_SIZE } from './planet-lod-tectonic.js'` to the new module), `planet-lod-tectonic.js` (delete lines 258–358 `RELIEF_CUBE_SIZE` … `bakeHeightCube`; import back + re-export)
- Test: `tests/river-bake-host.test.js` (extend AC-0), `tests/relief-height-cube.test.js` (re-point text reads)

**Interfaces:**
- Produces: `carveCube.js` exports `createCarveCubeMap({ renderer, size = 1024 })` → `{ texture, update(valleyGeo), dispose() }`. `heightCube.js` exports `RELIEF_CUBE_SIZE` (256), `buildHeightCubeGeometry({ mesh, height, grad })` → `THREE.BufferGeometry` with `position(3)`, `aHeight(1)`, `aGrad(3)`, `Uint32` index, `createHeightCube({ renderer, size })` → `{ texture, update(heightGeo), dispose() }`, `bakeHeightCube({ mesh, height, grad, heightCube })` → the geometry.

- [ ] **Step 1: Extend the AC-0 test**

Append to the AC-0 `describe` in `tests/river-bake-host.test.js` (add the imports at the top):

```js
import { createCarveCubeMap as carveViaLab } from '../planet-lod-rivers.js';
import { createHeightCube as heightCubeViaLab, bakeHeightCube as bakeHeightViaLab, buildHeightCubeGeometry as heightGeoViaLab, RELIEF_CUBE_SIZE as RELIEF_VIA_LAB } from '../planet-lod-tectonic.js';
import { createCarveCubeMap } from '../src/rendering/bake/carveCube.js';
import { createHeightCube, bakeHeightCube, buildHeightCubeGeometry, RELIEF_CUBE_SIZE } from '../src/rendering/bake/heightCube.js';
// …
  it('the two GPU bakers are DEFINED exactly once under src/rendering/bake/ and re-exported by the root modules', () => {
    const files = ['src/rendering/bake/carveCube.js', 'src/rendering/bake/heightCube.js', 'planet-lod-rivers.js', 'planet-lod-tectonic.js'].map((p) => [p, read(p)]);
    const defs = (re) => files.filter(([, t]) => re.test(t)).map(([p]) => p);
    expect(defs(/^export function createCarveCubeMap\(/m)).toEqual(['src/rendering/bake/carveCube.js']);
    expect(defs(/^export function createHeightCube\(/m)).toEqual(['src/rendering/bake/heightCube.js']);
    expect(defs(/^export function bakeHeightCube\(/m)).toEqual(['src/rendering/bake/heightCube.js']);
    expect(defs(/^export function buildHeightCubeGeometry\(/m)).toEqual(['src/rendering/bake/heightCube.js']);
    expect(defs(/^export const RELIEF_CUBE_SIZE\b/m)).toEqual(['src/rendering/bake/heightCube.js']);
    expect(carveViaLab).toBe(createCarveCubeMap);
    expect(heightCubeViaLab).toBe(createHeightCube);
    expect(bakeHeightViaLab).toBe(bakeHeightCube);
    expect(heightGeoViaLab).toBe(buildHeightCubeGeometry);
    expect(RELIEF_VIA_LAB).toBe(RELIEF_CUBE_SIZE);
    expect(RELIEF_CUBE_SIZE).toBe(256);
  });
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run --dir tests tests/river-bake-host.test.js` → FAIL (module not found).

- [ ] **Step 3: Move the text** (same discipline as Task 1 Step 4; `planet-lod-tectonic.js:366` already imports `provinceCube.js` from `src/` — add the height-cube import-back beside it and re-export). `createCarveCubeMap` from `planet-lod-rivers.js` → `carveCube.js`; `createRiverOverlay` keeps calling `createCarveCubeMap` through the import-back.

- [ ] **Step 4: Prove byte-verbatim** (the `git show 3dded82:… | sed -n` diff, one per function) → `VERBATIM`.

- [ ] **Step 5: Run** `npx vitest run --dir tests tests/river-bake-host.test.js tests/relief-height-cube.test.js tests/ws4-grain-bake-host.test.js tests/src-boundary-fence.test.js tests/one-pipeline-fence.test.js tests/province-bake-host.test.js` → PASS (re-point `relief-height-cube.test.js`'s text reads to `src/rendering/bake/heightCube.js` where it scans the definition; never weaken).

- [ ] **Step 6: Commit** — `move: the carve and height-cube bakers → src/rendering/bake/ (carveCube.js, heightCube.js), byte-verbatim; root modules re-export` + attribution.

---

### Task 3: Driver pack #8 — `fluvialDeck.js` (the lab's F11/F12/F13/F14/F20 derivation), registered, read back by the lab

**Files:**
- Create: `src/worldengine/drivers/fluvialDeck.js`, `tests/driver-pack-fluvialdeck.test.js`
- Modify: `src/worldengine/drivers/index.js` (append `import { FLUVIAL_DECK_ENTRY } from './fluvialDeck.js';` to the existing two-imports line 8, and `FLUVIAL_DECK_ENTRY,` after `GIANT_SURFACE_ENTRY,` on the same line — line count neutral), `world-engine-lab.html:2136-2167` (line-stable pack read-back), `docs/WORKSTREAMS/wire-river-router-lab-into-game/contract.json` (two wording corrections, below)
- Test: `tests/driver-pack-fluvialdeck.test.js`, `tests/river-bake-host.test.js` (AC-1 block)

**Interfaces:**
- Consumes: `deriveUniforms(condition)` from `src/worldengine/base/labCore.js` (`u.liquidStability`, `u.precipitation`, `u.surfaceGravity`); the condition vector's `surfaceHistory.erosion`, `atmosphere` (`null` or `{ retained, … }`), `composition.volatileFraction`; `scalar / assertDisplayPolicy / assertPackResult / resolveDriver / PackContractError` from `../port/writePackUniforms.js`; `compositionClass` from `../base/e1Regime.js`.
- Produces: `fluvialDeckPack(condition, ctx)` → `{ drivers, attributes: {}, meta }` where `drivers` = `{ uFluvialActivity, uFluvialDepth, uFluvialMeander, uSeaLevel (gate 'lakes'), uLiquidMask, uDeltaDensity (gate 'deltas'), uCoastStrength (gate 'coast'), uStrandStrength, uOutflowDensity (gate 'outflow'), uOutflowActivity }` and `meta` = `{ compositionClass, fluvialClass: 'wet'|'relict'|'airless', wet, hadLiquid, erosion, liquidStability, precipitation, fluvialDensity, seaCoverage, seaLevel }`. `fluvialClassOf(condition)` → the same class string (pure, cheap; the worker and host call it). `FLUVIAL_DECK_ENTRY = { name: 'fluvialDeck', applies: (c) => compositionClass(c) !== 'gas', gates: ['lakes','deltas','coast','outflow'], pack, labState }`. `fluvialDeckLabState(pack)` → `{ fluvialActivity, fluvialDensity, fluvialDepth, fluvialMeander, seaLevel, deltaDensity, coastStrength, strandStrength, outflowDensity, outflowActivity }` (UNGATED values — the lab re-applies its own checkboxes per frame; `fluvialDensity` comes from `meta`). `fluvialDeckDirectDrivers(pack)` → `{ uLiquidMask }`.

- [ ] **Step 1: Correct two contract wordings (defects found while planning, before any build)**

In `contract.json` AC-1 observable, replace `Wet bodies carry non-zero uFluvialDensity and a uLiquidMask > 0` with `Wet bodies carry a non-zero fluvialDensity DRIVER (meta) and a uLiquidMask > 0 — the uFluvialDensity UNIFORM stays 0 on every body, as the lab pins it (world-engine-lab.html:5518, the retired worm-trail)`. In AC-6 observable, after `Instrument C exit 0 with zero delta over its bodies × uniforms.` add ` (C's watched set does not include the fluvial family — measured with --list on 2026-09-02 — so the new writes are outside its basis; zero delta is expected, not evidence.)`. Run `node ~/projects/personal-os-improvements/dev-collab/validate.mjs contract docs/WORKSTREAMS/wire-river-router-lab-into-game/contract.json` → OK.

- [ ] **Step 2: Write the failing pack test**

Create `tests/driver-pack-fluvialdeck.test.js` (mirror the sections of `tests/driver-pack-solidfeatures.test.js`; the essentials):

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import { PACKS, selectPacks, applyDriverPacks } from '../src/worldengine/drivers/index.js';
import { buildLabPlanetMaterial } from '../src/rendering/LabPlanetMaterial.js';
import { labPackCtx, setLabGasBodiesOverride } from '../src/objects/Planet.js';
import {
  fluvialDeckPack, FLUVIAL_DECK_ENTRY, FLUVIAL_DECK_UNIFORMS, FLUVIAL_DECK_LAB_BINDING,
  fluvialDeckLabState, fluvialDeckDirectDrivers, fluvialClassOf, LAKES_GATE, DELTAS_GATE, COAST_GATE, OUTFLOW_GATE,
} from '../src/worldengine/drivers/fluvialDeck.js';

const SEEDS = Array.from({ length: 24 }, (_, i) => `rocky-${i}`);
function corpus() {
  const out = [];
  for (const seed of SEEDS) {
    const sys = StarSystemGenerator.generate(seed, null);
    for (const e of sys.planets) {
      out.push({ seed, d: e.planetData || e });
      for (const m of (e.moons || [])) out.push({ seed, d: m });
    }
  }
  for (const b of out) b.cond = conditionFromBody(b.d);
  return out;
}
let BODIES;
beforeAll(() => { setLabGasBodiesOverride(true); BODIES = corpus(); });
const CTX = { displayRadiusEarth: 1, animRate: 1, relevance: {}, gates: { lakes: true, deltas: true, coast: true, outflow: true } };
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ss = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
// §C — the lab's formulas, transcribed from world-engine-lab.html:2127-2167 (at 3dded82), evaluated on the SAME condition
function labBlock(cond) {
  const u = deriveUniforms(cond);
  const erosion = cond.surfaceHistory?.erosion ?? 0;
  const stab = u.liquidStability, rain = u.precipitation, g = u.surfaceGravity;
  const wet = stab > 0.15;
  const hadLiquid = !!(cond.atmosphere && cond.atmosphere.retained !== false);
  const fluvialActivity = wet ? 1.0 : clamp01(erosion);
  const fluvialDensity = wet ? clamp01(stab * (0.3 + 0.7 * rain)) : (hadLiquid ? 0.4 * clamp01(erosion) : 0.0);
  const vol = clamp01((cond.composition?.volatileFraction ?? 0) * 2.0);
  const seaCoverage = wet ? clamp01(stab * vol) : 0.0;
  const seaLevel = wet && seaCoverage > 0.0 ? -0.2 + 0.5 * seaCoverage : -1.0;
  return {
    fluvialActivity, fluvialDensity, fluvialDepth: 0.08 + 0.10 * rain + 0.04 * clamp01(g), fluvialMeander: 0.3 + 0.5 * rain,
    seaCoverage, seaLevel, deltaDensity: fluvialDensity * (0.5 + 0.5 * fluvialActivity),
    coastStrength: seaLevel > -1.0 ? 1.0 : 0.0, strandStrength: clamp01(erosion),
    outflowDensity: (wet || (hadLiquid && erosion > 0)) ? ss(0.3, 0.45, erosion) : 0.0, outflowActivity: fluvialActivity,
    cls: wet ? 'wet' : ((hadLiquid && erosion > 0) ? 'relict' : 'airless'),
  };
}
describe('§C — every driver is the lab\'s formula on the same condition, to the last bit', () => {
  it('over the corpus, solid bodies', () => {
    let n = 0;
    for (const b of BODIES) {
      if (compositionClass(b.cond) === 'gas') continue;
      const want = labBlock(b.cond); const got = fluvialDeckPack(b.cond, CTX); const st = fluvialDeckLabState(got);
      expect(st).toEqual({ fluvialActivity: want.fluvialActivity, fluvialDensity: want.fluvialDensity, fluvialDepth: want.fluvialDepth,
        fluvialMeander: want.fluvialMeander, seaLevel: want.seaLevel, deltaDensity: want.deltaDensity, coastStrength: want.coastStrength,
        strandStrength: want.strandStrength, outflowDensity: want.outflowDensity, outflowActivity: want.outflowActivity });
      expect(fluvialDeckDirectDrivers(got)).toEqual({ uLiquidMask: want.seaCoverage });
      expect(got.meta.fluvialClass).toBe(want.cls); expect(fluvialClassOf(b.cond)).toBe(want.cls);
      n++;
    }
    expect(n).toBe(124);
  });
});
describe('§D — gates, membership, collision, registration', () => {
  it('the four gated drivers resolve to 0 when their gate is off and to the value when on', () => {
    const b = BODIES.find((x) => fluvialClassOf(x.cond) === 'wet');
    const off = { ...CTX, gates: { lakes: false, deltas: false, coast: false, outflow: false } };
    const mat = buildLabPlanetMaterial({ lightDir: [0, 0, 1] }).material;
    const r = applyDriverPacks(mat, b.cond, { ...labPackCtx(b.d, b.cond, null) });
    expect(r.applied).toContain('fluvialDeck');
    expect(mat.uniforms.uSeaLevel.value).not.toBe(-1);
    expect(mat.uniforms.uCoastStrength.value).toBe(1);
  });
  it('FLUVIAL_DECK_UNIFORMS is exactly the emitted set, and no other pack writes any of them', () => {
    const b = BODIES.find((x) => fluvialClassOf(x.cond) === 'wet');
    expect(new Set(Object.keys(fluvialDeckPack(b.cond, CTX).drivers))).toEqual(new Set(FLUVIAL_DECK_UNIFORMS));
    for (const e of PACKS) { if (e.name === 'fluvialDeck' || !e.applies(b.cond)) continue;
      const names = Object.keys(e.pack(b.cond, { ...labPackCtx(b.d, b.cond, null), gates: Object.fromEntries(e.gates.map((g) => [g, true])) }).drivers);
      for (const n of names) expect(FLUVIAL_DECK_UNIFORMS).not.toContain(n); }
  });
  it('registration moves NO body between materials: the admitted set is unchanged', () => {
    for (const b of BODIES) expect(selectPacks(b.cond).some((e) => e.name === 'fluvialDeck')).toBe(compositionClass(b.cond) !== 'gas');
  });
  it('the corpus splits into wet / relict / airless and the counts are recorded', () => {
    const c = { wet: 0, relict: 0, airless: 0 };
    for (const b of BODIES) if (compositionClass(b.cond) !== 'gas') c[fluvialClassOf(b.cond)]++;
    expect(c.wet + c.relict + c.airless).toBe(124);
    console.info('[fluvialDeck] corpus classes', c);   // RECORDED (AC-1); read it with --reporter=verbose or write to a file
  });
});
```

(Adapt `applyDriverPacks`'s ctx to what `labPackCtx` returns in this tree; the gate map is added by `applyDriverPacks` itself under `GATE_POLICY_ALL_ON`.)

- [ ] **Step 3: Run to verify it fails** — `npx vitest run --dir tests tests/driver-pack-fluvialdeck.test.js` → FAIL (module not found).

- [ ] **Step 4: Write the pack**

`src/worldengine/drivers/fluvialDeck.js` — header (FUNCTION: the lab's fluvial derivation as ONE law both front-ends call; INTENT: the four masters were undriven in the game; non-goals: no `uFluvialDensity` uniform (pinned 0, F11 retired), no per-body ocean fraction law, no routing), then:

```js
import { compositionClass } from '../base/e1Regime.js';
import { deriveUniforms } from '../base/labCore.js';
import { scalar, assertDisplayPolicy, assertPackResult, resolveDriver, PackContractError } from '../port/writePackUniforms.js';

export const LAKES_GATE = 'lakes';      // world-engine-lab.html:5082 `state.lakesEnabled ? state.seaLevel : -1.0`
export const DELTAS_GATE = 'deltas';    // :5083 `state.deltasEnabled ? state.deltaDensity : 0.0`
export const COAST_GATE = 'coast';      // :5086 `state.coastEnabled ? state.coastStrength : 0.0`
export const OUTFLOW_GATE = 'outflow';  // :5092 `state.outflowEnabled ? state.outflowDensity : 0.0`

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ss = (e0, e1, x) => { const tt = clamp01((x - e0) / (e1 - e0)); return tt * tt * (3 - 2 * tt); };

function derive(condition) {
  const u = deriveUniforms(condition);
  const erosion = condition.surfaceHistory?.erosion ?? 0;
  const stab = u.liquidStability, rain = u.precipitation, g = u.surfaceGravity;
  const wet = stab > 0.15;
  const hadLiquid = !!(condition.atmosphere && condition.atmosphere.retained !== false);
  const fluvialActivity = wet ? 1.0 : clamp01(erosion);
  const fluvialDensity = wet ? clamp01(stab * (0.3 + 0.7 * rain)) : (hadLiquid ? 0.4 * clamp01(erosion) : 0.0);
  const fluvialDepth = 0.08 + 0.10 * rain + 0.04 * clamp01(g);
  const fluvialMeander = 0.3 + 0.5 * rain;
  const vol = clamp01((condition.composition?.volatileFraction ?? 0) * 2.0);
  const seaCoverage = wet ? clamp01(stab * vol) : 0.0;
  const seaLevel = wet && seaCoverage > 0.0 ? -0.2 + 0.5 * seaCoverage : -1.0;
  const deltaDensity = fluvialDensity * (0.5 + 0.5 * fluvialActivity);
  const coastStrength = seaLevel > -1.0 ? 1.0 : 0.0;
  const strandStrength = clamp01(erosion);
  const fluvHistory = wet || (hadLiquid && erosion > 0);
  const outflowDensity = fluvHistory ? ss(0.3, 0.45, erosion) : 0.0;
  const outflowActivity = fluvialActivity;
  const fluvialClass = wet ? 'wet' : (fluvHistory ? 'relict' : 'airless');
  return { wet, hadLiquid, erosion, liquidStability: stab, precipitation: rain, fluvialActivity, fluvialDensity, fluvialDepth,
    fluvialMeander, seaCoverage, seaLevel, deltaDensity, coastStrength, strandStrength, outflowDensity, outflowActivity, fluvialClass };
}
export function fluvialClassOf(condition) { return derive(condition).fluvialClass; }

export function fluvialDeckPack(condition, ctx) {
  if (condition == null || typeof condition !== 'object') throw new PackContractError('fluvialDeckPack: condition vector is missing.');
  assertDisplayPolicy(ctx);
  const f = derive(condition);
  const drivers = {
    uFluvialActivity: f.fluvialActivity, uFluvialDepth: f.fluvialDepth, uFluvialMeander: f.fluvialMeander,
    uSeaLevel: scalar(f.seaLevel, { gate: LAKES_GATE, off: -1.0 }),
    uLiquidMask: f.seaCoverage,
    uDeltaDensity: scalar(f.deltaDensity, { gate: DELTAS_GATE }),
    uCoastStrength: scalar(f.coastStrength, { gate: COAST_GATE }),
    uStrandStrength: f.strandStrength,
    uOutflowDensity: scalar(f.outflowDensity, { gate: OUTFLOW_GATE }),
    uOutflowActivity: f.outflowActivity,
  };
  const meta = { compositionClass: compositionClass(condition), ...f };
  return assertPackResult({ drivers, attributes: {}, meta }, 'fluvialDeckPack');
}
```

⚠ Check `scalar()`'s options in `writePackUniforms.js:90` — if it has no "off value" option, `uSeaLevel`'s gate-off value must be −1 (not 0): read `resolveDriver` (:155-258) and either use its off-value support or emit `uSeaLevel` UNGATED and document that the game runs ALL_ON anyway (`gatesFor`). Do not invent a new driver shape; extend `scalar` only if `resolveDriver` already has the field.

Then `FLUVIAL_DECK_ENTRY`, `FLUVIAL_DECK_UNIFORMS` (the ten names), `FLUVIAL_DECK_LAB_BINDING` (`uFluvialActivity: 'fluvialActivity', uFluvialDepth: 'fluvialDepth', uFluvialMeander: 'fluvialMeander', uSeaLevel: 'seaLevel', uDeltaDensity: 'deltaDensity', uCoastStrength: 'coastStrength', uStrandStrength: 'strandStrength', uOutflowDensity: 'outflowDensity', uOutflowActivity: 'outflowActivity'`), `fluvialDeckLabState(pack)` (resolve each binding with every gate ON — copy `solidFeaturesLabState` — then add `fluvialDensity: pack.meta.fluvialDensity`), `fluvialDeckDirectDrivers(pack)` (by subtraction, as `solidFeaturesDirectDrivers`).

- [ ] **Step 5: Register** — `src/worldengine/drivers/index.js`: append the import to the existing two-import line and `FLUVIAL_DECK_ENTRY,` to the line holding `GIANT_SURFACE_ENTRY,` (verify `wc -l` unchanged).

- [ ] **Step 6: Run the pack test and the whole pack family** — `npx vitest run --dir tests tests/driver-pack-fluvialdeck.test.js tests/driver-pack-*.test.js tests/pack-contract.test.js tests/gas-body-lab-material.test.js` → PASS (the closure scan must stay green: the pack imports only `base/` + `port/`).

- [ ] **Step 7: The lab reads the pack back (line-stable)**

`world-engine-lab.html:174` region: append `import { fluvialDeckPack, fluvialDeckLabState, fluvialDeckDirectDrivers } from './src/worldengine/drivers/fluvialDeck.js';` to the END of an existing import line near :188 (where `giantDeckPack` etc. are imported), before any trailing comment. Then at `:2136` replace `state.fluvialActivity = _wet ? 1.0 : _clamp01(_erosion);              // relict if dried` with ONE line:
```js
      { const _fd = fluvialDeckPack(deriveConditionVector(_dp, u, state.planetRadiusEarth), { displayRadiusEarth: visScaleOf(state.planetRadiusEarth ?? 1) }); Object.assign(state, fluvialDeckLabState(_fd)); for (const [k, v] of Object.entries(fluvialDeckDirectDrivers(_fd))) uniforms[k].value = v; }   // ── DRIVER PACK #8 — fluvialDeck (F11/F12/F13/F14/F20). ⛔ THE SEAM IS `_dp`, THE PER-SEED DRAW (the :2075 precedent); the block's `_fp` reads below stay for the karst/dune locals only.
```
and neutralise `:2137-2140`, `:2146-2148`, `:2151`, `:2156-2157`, `:2166-2167` each as `      // ↳ MOVED TO DRIVER PACK #8 (:2136). Was \`<the old line>\``. Keep `:2127-2135`, `:2145`, `:2164-2165` (the locals — `_wet`, `_stab`, `_erosion`, `_hadLiquid`, `_clamp01`, `_ss` are read by F21 karst / F15 dunes below). Confirm `_dp` and `deriveConditionVector` are in scope at :2136 (they are at :2075 in the same function — verify with `sed -n 2060,2080p`). `wc -l world-engine-lab.html` unchanged.

- [ ] **Step 8: Run the lab-facing fences** — `npx vitest run --dir tests tests/one-pipeline-fence.test.js tests/lab-surface-ratchet.test.js tests/vis-scale-fence.test.js tests/instrument-tap-fence.test.js` → PASS. If `one-pipeline-fence` demands the pack be CALLED by the lab (reachable-AND-called), the `:2136` call satisfies it; read its message if red.

- [ ] **Step 9: AC-1 block in `tests/river-bake-host.test.js`** — over the corpus, `applyDriverPacks` on a real lab material per solid body: `uSeaLevel !== -1 && uLiquidMask > 0` for `wet`; `uOutflowDensity === ss(0.3,0.45,erosion)` and `uSeaLevel === -1` for `relict`; all zero / −1 for `airless`; a gas body's material has `uSeaLevel === -1` and `fluvialDeck` in `skipped`. Record the three counts to `$TMPDIR/river-corpus.json` via `writeFileSync` (vitest hides console.info).

- [ ] **Step 10: Commit** — `pack: fluvialDeck (#8) — the lab's F11/F12/F13/F14/F20 derivation as one law; registered; the lab reads it back at :2136 (line-stable)` + attribution. Files by name (`fluvialDeck.js`, `index.js`, `world-engine-lab.html`, both tests, `contract.json`).

---

### Task 4: The CPU bundle + the worker protocol

**Files:**
- Modify: `src/rendering/bake/provinceDispatch.js` (add `buildLabBundleForBody`), `src/rendering/bake/provinceWorker.js` (protocol)
- Test: `tests/river-bake-host.test.js` (AC-2, AC-3 blocks)

**Interfaces:**
- Consumes: Task 1/2 modules; `fluvialClassOf` (Task 3); `bakeReliefCrossover`, `visScaleOf` from `src/worldengine/base/labCore.js`; `buildProvinceCubeGeometry` from `./provinceCube.js`.
- Produces: `buildLabBundleForBody({ condition, macroSeed = 0, T_eq = null, radiusEarth = 1 }, mesh = sharedCarrierMesh())` →
  ```
  { mesh, carrier, relief, province, ms,
    fluvialClass, routed: boolean, strength, restore,          // strength = bakeReliefCrossover(visScaleOf(radiusEarth)), restore = 1 - strength
    marginHeight, marginGrad, craterOverlay, craterGrad,        // Float32Arrays over the mesh nodes (the SAME arrays route() bakes)
    seaLevel, isOcean, oceanCount, routedGraph, ribbonGeo, valleyGeo, routeMs }   // present only when routed
  ```
  Worker `in`: `{ id, condition, macroSeed, T_eq, radiusEarth }`; `out`: `{ id, ok: true, nodes, path, ms, fractions, fluvialClass, routed, strength, restore, prov: {pos, wgt, idx}, relief: {pos, hgt, grd, idx}, crater: {hgt, grd}, sea: {seaLevel, oceanCount}|null, valley: {pos, aDepth, aMouth, aOrder, idx}|null, ribbon: {pos, col, idx}|null }` with every typed array in the transfer list.

- [ ] **Step 1: Write the failing AC-2/AC-3 tests** (in `tests/river-bake-host.test.js`; reuse `corpus()`/`bodyOf` from `tests/province-bake-host.test.js:40-59`, add `radiusEarth: b.cond.radiusEarth` to `bodyOf`; use a `small()` mesh `buildIrregularSphere(2500, 2)` for speed on all but ONE full-size body):

```js
describe('AC-2 — the game\'s bundle IS the lab\'s route on the same carrier', () => {
  it('byte-identical to route()\'s own sequence called through the root import path', () => {
    const b = BODIES.find((x) => x.admit.admitted && fluvialClassOf(x.cond) === 'wet');
    const m = small();
    const got = buildLabBundleForBody(bodyOf(b), m);
    // the lab's sequence, transcribed from createRiverOverlay.route() (planet-lod-rivers.js, at 3dded82)
    const carrier = makeSphereField(m);
    const relief = writeBodyReliefViaLab(carrier, { bodyDrivers: bodyDriversFromCondition(b.cond), grainDrivers: DEFAULT_GRAIN_DRIVERS, macroSeed: got.carrier === carrier ? 0 : (labMacroSeed(b.d) | 0), heightSeed: 'e6:' + (labMacroSeed(b.d) | 0), T_eq: b.cond.T_eq });
    const craterOut = new Float32Array(carrier.height.length);
    const composited = compositeViaLab(carrier, relief.reliefBudget, craterOut);
    const height = composited || carrier.height;
    const grad = composited ? gradViaLab(carrier, composited) : gradViaLab(carrier);
    const seaLevel = seaViaLab(height, PARAMS_VIA_LAB.TARGET_OCEAN_FRACTION);
    const { isOcean } = oceanViaLab(height, seaLevel, carrier.N);
    const pEff = paramsViaLab(PARAMS_VIA_LAB, b.cond.radiusEarth, widthSeedViaLab(labMacroSeed(b.d), PARAMS_VIA_LAB));
    const routed = routeViaLab({ mesh: m, height, grad, isOcean, params: PARAMS_VIA_LAB });
    const rib = ribbonViaLab({ mesh: m, routed, params: pEff }); const val = valleyViaLab({ mesh: m, routed, isOcean, params: pEff });
    expect(got.seaLevel).toBe(seaLevel);
    expect(Buffer.from(got.marginHeight.buffer)).toEqual(Buffer.from(height.buffer));
    expect(Buffer.from(got.routedGraph.receiver.buffer)).toEqual(Buffer.from(routed.receiver.buffer));
    expect(Buffer.from(got.routedGraph.strahler.buffer)).toEqual(Buffer.from(routed.strahler.buffer));
    expect(Buffer.from(got.ribbonGeo.getAttribute('position').array.buffer)).toEqual(Buffer.from(rib.getAttribute('position').array.buffer));
    expect(Buffer.from(got.valleyGeo.getAttribute('aMouth').array.buffer)).toEqual(Buffer.from(val.getAttribute('aMouth').array.buffer));
  });
  it('wet bodies: 0 orphans, 0 uphill receivers, every mouth drains into the ocean set; airless bodies are not routed', () => { /* over the corpus with small(); write metrics to $TMPDIR/river-corpus.json */ });
});
describe('AC-3 — the routing surface is the display surface', () => {
  it('strength and restore are the lab\'s two laws composed, to the last bit', () => {
    for (const b of BODIES) { if (!b.admit.admitted || compositionClass(b.cond) === 'gas') continue;
      const s = bakeReliefCrossover(visScaleOf(b.cond.radiusEarth));
      const got = buildLabBundleForBody(bodyOf(b), small());
      expect(got.strength).toBe(s); expect(got.restore).toBe(1 - s); }
  });
  it('the relief and crater cube geometry arrays equal buildHeightCubeGeometry on the SAME composited arrays', () => { /* one body, Buffer compare of aHeight / aGrad */ });
  it('RECORDED: wet bodies whose strength is exactly 0 (never silently routed on an undisplayed field)', () => {
    const zero = BODIES.filter((b) => b.admit.admitted && fluvialClassOf(b.cond) === 'wet' && bakeReliefCrossover(visScaleOf(b.cond.radiusEarth)) === 0);
    writeFileSync(join(process.env.TMPDIR || '/tmp', 'river-strength-zero.json'), JSON.stringify(zero.map((b) => ({ seed: b.seed, R: b.cond.radiusEarth }))));
    // no gate: a non-zero count is surfaced to Max (contract AC-3), and the bundle marks such a body `routedOnUndisplayedField: true`
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `buildLabBundleForBody` is not exported.

- [ ] **Step 3: Implement `buildLabBundleForBody`** in `provinceDispatch.js` (keep `buildProvinceForBody` intact; the new function calls the same `writeBodyRelief` once):

```js
import { compositeMargins, computeAdjGradient, computeOcean, routeAndOrder, paramsForRadius, widthSeedFactor, DEFAULT_PARAMS } from '../../worldengine/rivers/router.js';
import { buildRibbonGeometry, buildValleyGeometry } from '../../worldengine/rivers/ribbon.js';
import { solveSeaLevel } from '../../worldengine/rivers/seaLevel.js';
import { fluvialClassOf } from '../../worldengine/drivers/fluvialDeck.js';
import { bakeReliefCrossover, visScaleOf } from '../../worldengine/base/labCore.js';

export function buildLabBundleForBody({ condition, macroSeed = 0, T_eq = null, radiusEarth = 1 }, mesh = sharedCarrierMesh()) {
  const built = buildProvinceForBody({ condition, macroSeed, T_eq }, mesh);
  const { carrier, relief } = built;
  const t0 = now();
  // route()'s margin composite (planet-lod-rivers.js route(), at 3dded82): the crater term into its own buffer
  const craterOverlay = new Float32Array(carrier.height.length);
  const composited = compositeMargins(carrier, relief.reliefBudget, craterOverlay);
  const marginHeight = composited || carrier.height;
  const marginGrad = composited ? computeAdjGradient(carrier, composited) : computeAdjGradient(carrier);
  const craterGrad = computeAdjGradient(carrier, craterOverlay);
  const strength = bakeReliefCrossover(visScaleOf(radiusEarth));
  const restore = 1 - strength;
  const fluvialClass = fluvialClassOf(condition);
  const routed = fluvialClass !== 'airless';
  const out = { ...built, fluvialClass, routed, strength, restore, marginHeight, marginGrad, craterOverlay, craterGrad,
    routedOnUndisplayedField: routed && strength === 0 };
  if (routed) {
    const seaLevel = solveSeaLevel(marginHeight, DEFAULT_PARAMS.TARGET_OCEAN_FRACTION);
    const { isOcean, oceanCount } = computeOcean(marginHeight, seaLevel, carrier.N);
    const pEff = paramsForRadius(DEFAULT_PARAMS, radiusEarth, widthSeedFactor(macroSeed, DEFAULT_PARAMS));
    const routedGraph = routeAndOrder({ mesh, height: marginHeight, grad: marginGrad, isOcean, params: DEFAULT_PARAMS });
    out.seaLevel = seaLevel; out.isOcean = isOcean; out.oceanCount = oceanCount; out.routedGraph = routedGraph;
    out.ribbonGeo = buildRibbonGeometry({ mesh, routed: routedGraph, params: pEff });
    out.valleyGeo = buildValleyGeometry({ mesh, routed: routedGraph, isOcean, params: pEff });
  }
  out.routeMs = now() - t0;
  return out;
}
```
⚠ `route()` calls `routeAndOrder` with `params` (the base) and the two builders with `pEff` — keep that asymmetry; it is the lab's. ⚠ `widthSeed` in the lab is `state.macroSeed` — the same integer as `macroSeed`.

- [ ] **Step 4: Extend the worker** — `provinceWorker.js`: build the bundle, then post the arrays. `relief.pos/idx` = `buildHeightCubeGeometry({mesh, height: marginHeight, grad: marginGrad})`'s `position`/index arrays (the crater geometry shares `pos`/`idx`; post only its `aHeight`/`aGrad`); `valley` and `ribbon` from the two geometries' attributes (`ribbon.col` = `color`). Transfer list = every `.buffer` once (a shared buffer must appear once; `pos` and `idx` are shared by relief+crater, so build them ONCE and reference twice). Keep the existing `prov` keys byte-for-byte so `tests/province-bake-host.test.js` stays green (its `payloadOf` shape is `{pos, wgt, idx, nodes, path, ms, fractions}` — keep those top-level for the province seam, and add the new keys beside them).

- [ ] **Step 5: Run** `npx vitest run --dir tests tests/river-bake-host.test.js tests/province-bake-host.test.js` → PASS. Record `routeMs` per body over the corpus at the FULL mesh for three bodies (one wet, one relict, one airless) into `$TMPDIR/river-corpus.json` (AC-7 wants the numbers).

- [ ] **Step 6: Commit** — `bake: buildLabBundleForBody + the worker carries the whole route bundle (province + relief + crater + carve + ribbon arrays)` + attribution.

---

### Task 5: The host — four cubes, the ribbon, the sea, two A/B keys, dispose

**Files:**
- Modify: `src/rendering/bake/labBakeHost.js`, `src/objects/Planet.js:4` (import line), `:2076` (attach call), `:2001` (dispose), `src/objects/Moon.js:704`
- Test: `tests/river-bake-host.test.js` (AC-7 block), `tests/province-bake-host.test.js` (must stay green via the aliases)

**Interfaces:**
- Produces: `attachLabBake(surface, { condition, macroSeed, T_eq, radiusEarth }, deps = { createProvinceCube?, createHeightCube?, createCarveCube?, mesh?, compute? })` → the record (published to `surface.userData.wd.lab.province` AND `.bake`, same object; top-level fields unchanged from today: `attached, applies, transport, requested, pending, baked, failed, fallback, disposed, bakes, disposes, path, ms, bakeMs, nodes, fractions, cube, dispose`; NEW: `relief: { strength, restore, cube, craterCube }`, `rivers: { class, routed, seaLevel, carveCube, ribbon, admitted /* ribbons+carve+sea */ , stats }`, `bytes: { carve, relief, crater, province }`). `disposeLabBake(surface)`. `attachProvinceBake = attachLabBake`, `disposeProvinceBake = disposeLabBake` (aliases). `toggleRiversAB(force)`, `toggleReliefAB(force)`; `globalThis._labRivers = { toggle, count, class(surface) }`, `globalThis._labRelief = { toggle, strength(surface) }`. Keys: `KeyJ` rivers, `KeyU` relief (both unbound in the game — `grep -rhoE "'Key[A-Z]'" src` measured 2026-09-02; re-check).

- [ ] **Step 1: Write the failing AC-7 tests** (stub cubes as in `province-bake-host.test.js:168-172`; `fakeSurface` gains slots for `uReliefBakeCube`, `uCraterBakeCube`, `uRiverCarveMap` (placeholders), `uSeaLevel { value: -1 }`, `uCoastStrength`, `uProvinceColorMix`, and an `add(child)` / `remove(child)` / `children` on the surface):

```js
describe('AC-7 — one request, one bake frame, four cubes + the ribbon disposed exactly once', () => {
  it('SYNC on a wet body: first onBeforeRender bakes province + relief + crater + carve, parents the ribbon, writes the sea', () => {
    const b = wet(); const s = fakeSurface(); const cubes = [];
    const rec = attachLabBake(s, bodyOf(b), { createProvinceCube: mk(cubes), createHeightCube: mk(cubes), createCarveCube: mk(cubes), compute: (body) => buildLabBundleForBody(body, small()) });
    s.onBeforeRender({});
    expect(rec.baked).toBe(true); expect(cubes.length).toBe(4); expect(cubes.every((c) => c.updates === 1)).toBe(true);
    expect(s.material.uniforms.uRiverCarveMap.value).toBe(cubes[3].texture);   // order: province, relief, crater, carve — assert by which slot holds which texture, not by index
    expect(s.children.length).toBe(1); expect(s.children[0].isMesh).toBe(true);
    expect(s.material.uniforms.uSeaLevel.value).toBe(rec.rivers.seaLevel); expect(rec.rivers.seaLevel).not.toBe(-1);
    expect(s.material.uniforms.uCoastStrength.value).toBe(1);
    expect(s.material.uniforms.uReliefBakeStrength.value).toBe(rec.relief.strength);
    expect(s.material.uniforms.uCraterBakeRestore.value).toBe(1 - rec.relief.strength);
    expect(s.material.uniforms.uRiverCarveStrength.value).toBe(0.01);   // world-engine-lab.html:392 carveStrength
  });
  it('an AIRLESS body: province + relief + crater bake, NO carve cube, NO ribbon, uSeaLevel stays -1', () => { /* cubes.length === 3, s.children.length === 0 */ });
  it('a RELICT body: routed (carve cube bound) but no ribbon and no sea', () => { /* cubes.length === 4, children 0, uSeaLevel -1 */ });
  it('dispose releases every cube once, removes + disposes the ribbon, restores every placeholder; second dispose is a no-op', () => { /* disposes === 1 on each stub; s.children.length === 0; slots === placeholders; uSeaLevel back to -1 */ });
  it('ASYNC: a reply after dispose is dropped', async () => { /* as province suite */ });
  it('the J key / _labRivers.toggle hides the ribbon and zeroes the four carve amounts; U / _labRelief.toggle zeroes strength and sets restore 1; both restore', () => { /* … */ });
  it('RECORDED bytes: carve 1024²·6·8, relief/crater 256²·6·8, province 128²·6·8', () => {
    const rec = /* wet body attach + bake */;
    expect(rec.bytes).toEqual({ carve: 1024 * 1024 * 6 * 8, relief: 256 * 256 * 6 * 8, crater: 256 * 256 * 6 * 8, province: 128 * 128 * 6 * 8 });
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `attachLabBake` not exported.

- [ ] **Step 3: Implement the host** (extend, do not rewrite; the province path's structure stays):
  1. **Slots.** On attach, create any missing uniform slots the lab creates at init/route time: `uReliefBakeStrength {0}`, `uCraterBakeRestore {0}`, `uRiverCarveStrength {0}`, `uRiverCarveFloor {0}`, `uRiverCarveDepth {0}`, `uRiverCarveRough {0}`, `uRiverCarveGateHi {0.18}` (`riverOverlayState.carveGateHi`, the lab sets it ungated at `:3026`). `ensureLabSamplers` already made the three sampler slots.
  2. **Sea before bake.** If `fluvialClassOf(condition) === 'wet'`: set `uSeaLevel.value = -1` at attach (the sea arrives WITH the rivers — one fill-in instead of a shoreline jump). Record the pack's driven value first so dispose can restore it.
  3. **Request** carries `radiusEarth`. Sync path calls `buildLabBundleForBody`.
  4. **Bake frame** (inside the existing `onBeforeRender` hook, after `result` lands): province cube (unchanged) → relief cube `createHeightCube({renderer, size: RELIEF_CUBE_SIZE})` + `update(geometryFrom(relief arrays))` → crater cube same → bind `uReliefBakeCube`, `uCraterBakeCube`, `uReliefBakeStrength = strength`, `uCraterBakeRestore = restore`. If routed: carve cube `createCarveCubeMap({renderer, size: DEFAULT_PARAMS.CARVE_CUBE_SIZE})` + `update(valley geometry)` → bind `uRiverCarveMap`. If wet: build the ribbon `new THREE.Mesh(ribbonGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false }))` with `frustumCulled = false`, `renderOrder = 10` (the lab's `createRiverOverlay` :1264-1269), `geometry.computeVertexNormals()`, `ribbon.scale.setScalar(bodyRadiusOf(surface.geometry) * 1.0014)` (`riverOverlayState.ribbonLift`), `surface.add(ribbon)`; write `uSeaLevel = seaLevel`, `uCoastStrength = 1` (`riverReroute` :2990-2992), and the carve amounts `uRiverCarveStrength = 0.01, uRiverCarveFloor = 1.3, uRiverCarveDepth = 0.08, uRiverCarveRough = 0.5` (`applyCarveAmounts` :3020 with the `:392` values). Sync-path bodies build the geometries directly from the bundle; worker-path bodies from the arrays (`geometryFromArrays` variants).
  5. **A/B.** `toggleRiversAB`: ribbon `.visible = !off`; the four carve amounts ↔ 0 (keep `uRiverCarveGateHi`); `uSeaLevel`/`uCoastStrength` are NOT part of the flip (the lab's OFF leaves the sea override in place — `setRiverOverlay(false)` only zeroes gouging + hides the ribbon). `toggleReliefAB`: `uReliefBakeStrength` ↔ 0 and `uCraterBakeRestore` ↔ 1 (at strength 0 the lab's crossover hands everything to synth with the crater restore at full). Keys `KeyJ` / `KeyU` in the existing `bindKeyOnce` listener; `_labRivers` / `_labRelief` beside `_labProvince`.
  6. **Dispose.** Every cube's `dispose()` once, `ribbon.geometry.dispose()`, `ribbon.material.dispose()`, `surface.remove(ribbon)`, placeholders re-bound on all three sampler slots, `uSeaLevel`/`uCoastStrength` back to the pack's values, LIVE sets cleaned.
  7. **Record** `bytes` from the sizes (`size*size*6*8`).
  8. Rename the header: "THE LAB BAKE HOST" — province + relief + crater + carve + ribbon; update FUNCTION / INTENT / non-goals (grain cube, view-dependent patch, coverage law: not here).

- [ ] **Step 4: Call sites, line-count-neutral** — `Planet.js:4` import list `attachProvinceBake, disposeProvinceBake` → `attachLabBake, disposeLabBake` (before the trailing `// §4 Step 6a` comment); `:2076` `attachLabBake(surface, { condition, macroSeed: labMacroSeed(d), T_eq: condition.T_eq, radiusEarth: condition.radiusEarth ?? d.radiusEarth ?? 1 }); return surface;` + the existing comment; `:2001` and `Moon.js:704` `disposeLabBake(...)`. `Moon.js:3` import line likewise. Verify `wc -l` = 2309 / 706.

- [ ] **Step 5: Run** `npx vitest run --dir tests tests/river-bake-host.test.js tests/province-bake-host.test.js tests/lab-shader-samplers.test.js tests/gas-body-lab-material.test.js` → PASS (the province suite's "REAL MOUNT" tests exercise `Planet._createLabSurface` — they must stay green through the rename via the aliases and the record's unchanged top-level fields).

- [ ] **Step 6: Production build emits the worker chunk** — `npm run build 2>&1 | grep -i worker` → a `provinceWorker-*.js` chunk (name may change if the file is renamed; do NOT rename the file in this task).

- [ ] **Step 7: Commit** — `host: attachLabBake — relief + crater + carve cubes, the ribbon child, the sea override, keys J/U; province path unchanged behind aliases` + attribution.

---

### Task 6: The fences and instruments (AC-6)

**Files:** none new; possibly `tests/src-boundary-fence.test.js` (allowlist `why` text only, count unchanged)

- [ ] **Step 1: Instrument A on a clean worktree of the parent commit** — `git worktree add "$TMPDIR/wt-parent" 3dded82 && (cd "$TMPDIR/wt-parent" && npm run --silent test:baseline > "$TMPDIR/A-parent.txt" 2>&1; true)`; then on HEAD `npm run --silent test:baseline > "$TMPDIR/A-head.txt" 2>&1; true`; `diff <(grep -E '^(FAIL|✗|×)' "$TMPDIR/A-parent.txt" | sort) <(grep -E '^(FAIL|✗|×)' "$TMPDIR/A-head.txt" | sort)` → empty (adapt the grep to the baseline script's output format; read `scripts/test-baseline.mjs` first). `git worktree remove "$TMPDIR/wt-parent"`.
- [ ] **Step 2: Instrument B** — `npm run --silent test:body-identity` → 8/8 (and the RNG-order fence if separate; see `check:instruments`).
- [ ] **Step 3: Instrument C** — `node tools/port-uniform-delta.mjs --check` → exit 0, zero delta (the fluvial family is outside its basis — note it in the commit).
- [ ] **Step 4: Citation fence** — `npm run --silent port-uniform-delta:citations` → `all N symbol-anchored citations resolve`, N ≥ 850. If a citation into `planet-lod-rivers.js` / `planet-lod-tectonic.js` below the moved ranges broke (PAST-EOF or symbol not on line), re-point it POSITIONALLY (the symbol's new line in the same file) or, if the symbol moved out, to its new module — one pass over every affected doc; CHECKED must not fall.
- [ ] **Step 5: The full suite** — `npx vitest run --dir tests` → the failure set equals Instrument A's parent baseline; nothing new red.
- [ ] **Step 6: Commit** (only if anything changed) — `fences: citations re-pointed after the router move; instruments A/B/C unchanged` + attribution.

---

### Task 7: The verify workflow, then the live drive

- [ ] **Step 1: Flip the contract to `verifying`** and run the workflow from the MAIN session (not a subagent):
  `Workflow({scriptPath:"/home/ax/projects/personal-os-improvements/dev-collab/workflows/verify-workstream.mjs", args:{contractPath:"docs/WORKSTREAMS/wire-river-router-lab-into-game/contract.json", mode:"full", commit:"<sha>", liveBranch:"main"}})` → `verdict.json`. Iterate on FAIL/INSUFFICIENT.
- [ ] **Step 2: Live AC-4 / AC-5** (main session, chrome-devtools; needs Max's lane-A server on :5175 — ask him, in his words, to start it; the launch of Chrome:9223 is Claude's, sandbox OFF, per the handoff §4). Drive exactly the contract's `verifyVia.input` for AC-4 then AC-5: freeze FIRST, then frame (`_lab.frameBody`, read `resolvedBy`); wait for `surface.userData.wd.lab.bake.baked`; screenshot ON; flip; screenshot OFF; sabotage; control body. Diff with the session's own script (numbers into the PLAN addendum). Screenshots, never `readPixels`. Park the tab on `about:blank` after.
- [ ] **Step 3: Close at `VERIFIED_PENDING_MAX <sha>`** in the contract (`status: "verified"`, plus a `verified` block with the numbers) and hand Max his walk (Task 8's NOW.md block).

---

### Task 8: Docs (same session as the build; Rule 3)

**Files:** `docs/FEATURES/one-pipeline-two-frontends-PLAN.md` (rows `:75-76` re-scored: `F11 River networks | ✅ | ✅` / `F12 Deltas | ✅ | ✅` with the note "the dendritic overlay; the .00014 measured the retired worm-trail"; queue (b) at `:132` loses F11/F12 ON THE LINE; EOF addendum `## § THE RIVER ROUTER, WIRED — addendum, 2026-09-02` with the recorded numbers: corpus classes, routeMs, bytes, the strength-0 count, the live pair's pixel counts), `docs/FEATURES/mvp-spine-lab-quality-backlog.md` (two rows: **QB-21** the router's ocean fraction is `TARGET_OCEAN_FRACTION` 0.35, not a condition law; **QB-22** per-body river admission in the lab is a global toggle — the game uses the F11 existence gate), `docs/NOW.md` (top block replaced at the same line count: active workstream, Max's walk in his words: "fly toward a wet rocky world in a rocky-* system, tap J and U while moving — do the rivers sit in their own valleys and drain into a sea that looks right, with deltas at the mouths?"), `docs/WORKSTREAMS/wire-river-router-lab-into-game/` (the contract's `verified` block).

- [ ] **Step 1: Write with the Write tool** (never a Bash heredoc — the dev-server hook).
- [ ] **Step 2:** `npm run doc-rot -- --workstream wire-river-router-lab-into-game` → read the report; fix real rot in THIS workstream's scope only.
- [ ] **Step 3: Commit** — `docs: F11/F12 wired — PLAN rows + queue (b) + § THE RIVER ROUTER, WIRED; QB-21/QB-22; NOW.md` + attribution.

---

## Self-review (done while writing)

- **Spec coverage:** AC-0 → Tasks 1–3; AC-1 → Task 3; AC-2/AC-3 → Task 4; AC-4/AC-5 → Task 7; AC-6 → Task 6; AC-7 → Task 5; AC-8 → Max after Task 7; docs outputs → Task 8. Decisions 1–6 of the intent are each implemented (1: Task 5 step 3.4/3.5; 2: Task 4 strength + Task 5 binding; 3: Task 4 `TARGET_OCEAN_FRACTION` + Task 5 sea write; 4: `fluvialClassOf` gating in Tasks 4/5; 5: Task 3; 6: Task 4 worker).
- **Placeholders:** the AC-7 test block has three `/* … */` bodies — the executor writes them in the shape of the neighbouring tests in `province-bake-host.test.js:185-251`; that file is the template, named. The `scalar()` off-value question in Task 3 is a read-then-decide, not a TBD: the plan states both branches.
- **Type consistency:** `buildLabBundleForBody` (Task 4) is consumed by Task 5's host with the field names Task 4 defines; `fluvialClassOf` (Task 3) is the single class source in Tasks 4 and 5; the worker payload keys (Task 4) are what the host's `geometryFromArrays` variants read (Task 5).
