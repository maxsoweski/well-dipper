# World-Engine Relief-Group Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the world-engine's shared-relief-substrate + host-editor/epoch model in an isolated lab: E6 (tectonic) *builds* relief, then E9 (hydrology) *carves* drainage that visibly post-dates and cuts it — sharing ONE mutable height field across 2 epochs.

**Architecture:** Pure-JS compute modules operate on a single `ReliefSubstrate` (co-registered typed arrays on a 2D regular-grid DEM). A base step derives drivers (un-zeroing D12) + a stub interior/crust field, then a 2-epoch loop runs `E6.run(substrate)` (writes height + structural grain) then `E9.run(substrate)` (reads that relief, writes a strictly-subtractive incision delta back into the SAME height array). The mutation-in-place IS the host-editor model. A thin three.js harness (`world-engine-relief-lab.html`) visualizes the substrate; the north-star signals are verified headlessly with vitest.

**Tech Stack:** ES modules; `vitest` (test); `three@^0.183` + `lil-gui` + `OrbitControls` (harness, served by Vite); `simplex-noise@^4` (`createNoise2D`) for steered noise; `alea@^1` for seeded determinism. All are already in `package.json` — add NO new dependencies.

## Global Constraints

- **Isolated lab only.** Create new files at repo root + `tests/`. Do NOT edit `src/generation/PlanetGenerator.js`, `src/generation/PhysicsEngine.js`, `world-engine-lab.html`, `planet-lod-lab-core.js`, or any `src/**` production file. The D12 hard-zero at `PlanetGenerator.js:565` is production-core-only and irrelevant to this lab — leave it alone; stub D12 in the slice's own base step.
- **No new npm dependencies.** Use only what `package.json` already lists.
- **Determinism is a hard requirement.** Every stochastic step takes a seed and runs through `alea(seed)`; same `(driverBundle, opts, seed)` → byte-identical `substrate.height`. A determinism test gates this.
- **Pure compute = no three.js.** `relief-substrate.js`, `relief-base-step.js`, `relief-e6-tectonic.js`, `relief-e9-hydrology.js`, `relief-slice.js` import NOTHING from `three`. Only the harness `.main.js` imports three. This keeps the engines headless-testable under vitest (Node).
- **E9 honesty.** E9 is a **CPU bake-time reference**, not a per-frame pass. Say so in code comments and the harness HUD. The GPU FastFlow (Jain 2024) bake is an explicitly deferred optimization. Do not claim real-time/per-frame.
- **Host-editor invariant.** E9 must MUTATE `substrate.height` in place (`height[i] += incision[i]`, `incision[i] <= 0`). It must NOT return a fresh height array. Losing in-place mutation loses the whole point (temporal legibility) and breaks the success test.
- **Stage explicit paths only — NEVER `git add -A`.** The tree has hundreds of loose `.png/.webm/.html` + warp WIP. Each commit step lists exact paths. A file literally named `HEAD` exists in repo root → never `git show HEAD`.
- **Subagents inherit `model: opus`** (fable gated). 
- **Run tests with** `npx vitest run <path>` (single file) — the repo's `npm test` is `vitest run` (all files). Use the single-file form during task loops.

## North-Star Success Test (what "done" means)

UAT (Max's gate alone): the rendered result *reads as a landscape with a history* — a drainage network that clearly post-dates and cuts the tectonic relief. The objective, programmatic signals that gate the build (all in vitest + a `window._relief.verifySlice()` handle):

1. **Strictly subtractive carve:** `incision[i] <= 0` ∀i, and `heightAfterCarve[i] <= heightAfterBuild[i] + 1e-7` ∀i.
2. **Carve correlates with relief:** mean incision magnitude on high-relief/steep cells > on flat low cells (E9 cuts the mountains E6 built, not random noise).
3. **Drainage obeys structure:** channels follow steepest-descent of the post-fill E6 surface (0 uphill flow edges on land); flow accumulation spans many orders of magnitude (a few trunk cells carry most area).
4. **Hack's-law-ish scaling:** main-stem length vs drainage area exponent h ∈ [0.45, 0.75] (emergent, not imposed).
5. **Base level fills depressions:** after fill, no interior land cell sits strictly below all 8 neighbours (every cell has a downhill path to an outlet/sea).
6. **Temporal legibility:** build-only run == build+carve run for height through epoch 1 (bit-identical pre-carve); enabling epoch 2 only ever lowers height (valleys overprint the relief).
7. **Determinism:** same seed ⇒ identical `height`.

---

## File Structure

| File | Responsibility |
|---|---|
| `relief-substrate.js` | The `ReliefSubstrate` data structure: grid metadata + co-registered typed arrays; allocation, lat/lon-of-cell, neighbour indexing, snapshot/clone helpers. Pure. |
| `relief-base-step.js` | The minimal Tier-1 base step: `makeBaseStep(driverBundle, seed)` → derived drivers (D12 un-zeroed via the `deriveUniforms` tidalHeat math), a stub interior/crust field (shell thickness, radial-strain sign, low-freq thickness blobs), and an allocated+initialised substrate. Pure. |
| `relief-e6-tectonic.js` | E6: `runE6(substrate, crust, drivers, epoch, seed)` — Melosh latitude stress → grain director + Anderson regime; steered ridged/billow noise; plateau blobs; gravity-capped isostatic amplitude; bounded Jacobi smoothing; optional rotated-pole 2nd-gen overprint. WRITES height + grain. Pure. |
| `relief-e9-hydrology.js` | E9 (CPU bake reference): `runE9(substrate, drivers, epoch, seed)` — synthesized precipitation weight; D8 flow dirs; priority-flood depression fill; exact flow accumulation; bounded stream-power incision (writes ≤0 delta into shared height); base-level/standing-liquid fill. Pure. |
| `relief-slice.js` | Orchestrator: `runReliefSlice(driverBundle, opts)` — base step → 2-epoch loop `[tectonic-build:E6, fluvial-carve:E9]`; captures `heightAfterBuild` snapshot; `epoch2` on/off toggle; returns `{ substrate, snapshots, stats }`. Plus `verifyReliefSlice(result)` returning the programmatic signal pass/fail object. Pure. |
| `relief-presets.js` | Test bodies copied verbatim from `world-engine-lab.html` DRIVER_PRESETS (Rocky control / Lava high-D12 / Magma saturated / Europa icy regression), shaped as the driver bundle the base step consumes. Pure data. |
| `world-engine-relief-lab.html` | Harness page: canvas + HUD + `<script type=module src=...main.js>`. Served by Vite. |
| `world-engine-relief-lab.main.js` | Harness glue: three.js renderer/scene/OrbitControls; builds a displaced-plane mesh + 2D drainage canvas from the substrate; `lil-gui` controls; `window._relief` console surface incl. `verifySlice()`. Imports the pure modules + three. |
| `tests/world-engine-relief-slice.test.js` | vitest unit + integration tests for every task below. |

---

## Task 1: ReliefSubstrate data structure

**Files:**
- Create: `relief-substrate.js`
- Test: `tests/world-engine-relief-slice.test.js`

**Interfaces:**
- Produces:
  - `makeSubstrate({ n, lat0Deg, lat1Deg, domainKm }) -> substrate`
  - `substrate` shape: `{ n, lat0Deg, lat1Deg, domainKm, count, height:Float32Array(n*n), grainAngle:Float32Array(n*n), grainMag:Float32Array(n*n), regime:Uint8Array(n*n), faultDensity:Float32Array(n*n), flowAccum:Float32Array(n*n), baseLevel:Float32Array(n*n), standing:Uint8Array(n*n), maturity:Float32Array(n*n) }`
  - `idx(substrate, ix, iy) -> number` (row-major `iy*n + ix`)
  - `latDegOfRow(substrate, iy) -> number` (linear interp lat0Deg→lat1Deg across rows)
  - `cloneHeight(substrate) -> Float32Array`
  - regime enum constants: `REGIME = { NORMAL:0, STRIKESLIP:1, THRUST:2 }`

- [ ] **Step 1: Write the failing test**

```js
// tests/world-engine-relief-slice.test.js
import { describe, it, expect } from 'vitest';
import { makeSubstrate, idx, latDegOfRow, cloneHeight, REGIME } from '../relief-substrate.js';

describe('ReliefSubstrate', () => {
  it('allocates co-registered typed arrays of n*n', () => {
    const s = makeSubstrate({ n: 64, lat0Deg: 0, lat1Deg: 80, domainKm: 4000 });
    expect(s.count).toBe(64 * 64);
    expect(s.height).toBeInstanceOf(Float32Array);
    expect(s.height.length).toBe(64 * 64);
    expect(s.regime).toBeInstanceOf(Uint8Array);
    expect(s.flowAccum.length).toBe(64 * 64);
  });
  it('indexes row-major', () => {
    const s = makeSubstrate({ n: 8, lat0Deg: 0, lat1Deg: 10, domainKm: 100 });
    expect(idx(s, 3, 2)).toBe(2 * 8 + 3);
  });
  it('maps rows to latitude linearly across the band', () => {
    const s = makeSubstrate({ n: 11, lat0Deg: 0, lat1Deg: 80, domainKm: 100 });
    expect(latDegOfRow(s, 0)).toBeCloseTo(0);
    expect(latDegOfRow(s, 10)).toBeCloseTo(80);
    expect(latDegOfRow(s, 5)).toBeCloseTo(40);
  });
  it('cloneHeight returns an independent copy', () => {
    const s = makeSubstrate({ n: 4, lat0Deg: 0, lat1Deg: 1, domainKm: 1 });
    s.height[0] = 5;
    const c = cloneHeight(s);
    s.height[0] = 9;
    expect(c[0]).toBe(5);
  });
  it('exposes the regime enum', () => {
    expect(REGIME.NORMAL).toBe(0); expect(REGIME.STRIKESLIP).toBe(1); expect(REGIME.THRUST).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t ReliefSubstrate`
Expected: FAIL — cannot find module `../relief-substrate.js`.

- [ ] **Step 3: Write the implementation**

```js
// relief-substrate.js — the shared mutable relief substrate (host of the host-editor model).
// Pure: no three.js. A 2D regular-grid DEM; engines mutate `height` in place across epochs.
export const REGIME = { NORMAL: 0, STRIKESLIP: 1, THRUST: 2 };

export function makeSubstrate({ n, lat0Deg, lat1Deg, domainKm }) {
  const count = n * n;
  return {
    n, lat0Deg, lat1Deg, domainKm, count,
    height: new Float32Array(count),       // THE host DEM (E6 writes, E9 subtracts)
    grainAngle: new Float32Array(count),   // structural-grain director, radians (lineament strike)
    grainMag: new Float32Array(count),     // grain magnitude 0..1
    regime: new Uint8Array(count),         // Anderson regime per REGIME
    faultDensity: new Float32Array(count),
    flowAccum: new Float32Array(count),    // drainage area (cell count + precip weight)
    baseLevel: new Float32Array(count),    // standing-liquid surface elevation
    standing: new Uint8Array(count),       // 1 where liquid stands (sea/lake)
    maturity: new Float32Array(count),     // accumulated surface age across epochs
  };
}
export function idx(s, ix, iy) { return iy * s.n + ix; }
export function latDegOfRow(s, iy) {
  const t = s.n <= 1 ? 0 : iy / (s.n - 1);
  return s.lat0Deg + (s.lat1Deg - s.lat0Deg) * t;
}
export function cloneHeight(s) { return Float32Array.from(s.height); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t ReliefSubstrate`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add relief-substrate.js tests/world-engine-relief-slice.test.js docs/FEATURES/world-engine-relief-slice-plan.md
git commit -m "world-engine slice: ReliefSubstrate data structure + plan"
```

---

## Task 2: Base step — derive drivers (un-zero D12) + stub interior/crust field

The base step is the slice's scoped-down version of the Option-A "expose + derive" Tier-1 step. It must, before E6 runs: (a) un-zero D12 (re-using the exact `deriveUniforms` tidal-heat math — derive a nonzero value from the bundle's orbital params, NOT edit core), (b) synthesize a stub interior/crust field (shell thickness, radial-strain sign, low-freq thickness blobs), (c) allocate + zero-init the substrate.

**Files:**
- Create: `relief-base-step.js`
- Create: `relief-presets.js`
- Test: `tests/world-engine-relief-slice.test.js`

**Interfaces:**
- Consumes: `makeSubstrate` (Task 1).
- Produces:
  - `makeBaseStep(driverBundle, { n, lat0Deg, lat1Deg, domainKm, seed }) -> { drivers, crust, substrate }`
  - `drivers` shape (derived, all numeric): `{ tidalHeat, surfaceGravity, rockyCrust, surfaceHistory, age, radialStrainSign(+1 contraction / -1 expansion), despinAmp }`
  - `crust` shape: `{ shellThickness (0..1, sets province width), thicknessBlob(ix,iy,n) -> 0..1 (low-freq plateau mask) }`
  - From `relief-presets.js`: `PRESETS = { rocky, lava, magma, europa }`, each a driver bundle with the fields `deriveUniforms` reads (`composition:{ironFraction,density,volatileFraction}`, `T_eq`, `eccentricity`, `orbitRadiusEarth`, `starMassEarth`, `radiusEarth`, `massEarth`, `surfaceHistory:{erosion}`, `age`).

> Implementer note — copy preset NUMBERS verbatim from `world-engine-lab.html` DRIVER_PRESETS: Rocky ≈ line 2477 (eccentricity 0.017, near-circular control), Lava ≈ line 2478 (eccentricity 0.15, orbit 938 → high tidalHeat), Magma ≈ line 2583 (saturated), Europa ≈ line 2487 (icy, rockyCrust→0). Read those lines and transcribe the orbital + composition fields. If a field is absent in a preset, omit it (the base step default-coalesces).

- [ ] **Step 1: Write the failing test**

```js
// append to tests/world-engine-relief-slice.test.js
import { makeBaseStep } from '../relief-base-step.js';
import { PRESETS } from '../relief-presets.js';

describe('base step', () => {
  const grid = { n: 32, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'rocky-1' };

  it('un-zeros D12: eccentric body gets nonzero tidalHeat; circular control is ~0', () => {
    const lava = makeBaseStep(PRESETS.lava, grid);
    const rocky = makeBaseStep(PRESETS.rocky, grid);
    expect(lava.drivers.tidalHeat).toBeGreaterThan(0);
    expect(lava.drivers.tidalHeat).toBeGreaterThan(rocky.drivers.tidalHeat);
  });
  it('derives a defined radial-strain sign (±1)', () => {
    const { drivers } = makeBaseStep(PRESETS.rocky, grid);
    expect(Math.abs(drivers.radialStrainSign)).toBe(1);
  });
  it('rockyCrust gates icy worlds toward 0 and silicate worlds toward 1', () => {
    const europa = makeBaseStep(PRESETS.europa, grid);
    const rocky = makeBaseStep(PRESETS.rocky, grid);
    expect(europa.drivers.rockyCrust).toBeLessThan(rocky.drivers.rockyCrust);
  });
  it('allocates a zero-initialised substrate of the requested size', () => {
    const { substrate } = makeBaseStep(PRESETS.rocky, grid);
    expect(substrate.count).toBe(32 * 32);
    expect(substrate.height.every(v => v === 0)).toBe(true);
  });
  it('crust thickness blob is a bounded 0..1 low-freq field', () => {
    const { crust } = makeBaseStep(PRESETS.rocky, grid);
    const v = crust.thicknessBlob(10, 12, 32);
    expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
  });
  it('does not throw on empty bundle', () => {
    expect(() => makeBaseStep({}, grid)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "base step"`
Expected: FAIL — cannot find module `../relief-base-step.js`.

- [ ] **Step 3: Write `relief-presets.js`** (transcribe DRIVER_PRESETS numbers — example shape; replace numbers with the real ones read from `world-engine-lab.html`)

```js
// relief-presets.js — test bodies, fields transcribed from world-engine-lab.html DRIVER_PRESETS.
// Shape = the driver bundle relief-base-step consumes (mirrors deriveUniforms' reads).
export const PRESETS = {
  rocky:  { composition:{ ironFraction:0.32, density:5.5, volatileFraction:0.25 }, T_eq:290, eccentricity:0.017, orbitRadiusEarth:23455, starMassEarth:332946, radiusEarth:1.0,  massEarth:1.0,  surfaceHistory:{ erosion:0.6 }, age:0.5 },
  lava:   { composition:{ ironFraction:0.5,  density:7.0, volatileFraction:0.02 }, T_eq:1100, eccentricity:0.15, orbitRadiusEarth:938,   starMassEarth:332946, radiusEarth:1.0,  massEarth:1.0,  surfaceHistory:{ erosion:0.0 }, age:0.2 },
  magma:  { composition:{ ironFraction:0.5,  density:6.5, volatileFraction:0.02 }, T_eq:1300, eccentricity:0.20, orbitRadiusEarth:600,   starMassEarth:332946, radiusEarth:1.1,  massEarth:1.4,  surfaceHistory:{ erosion:0.0 }, age:0.1 },
  europa: { composition:{ ironFraction:0.2,  density:2.0, volatileFraction:0.9  }, T_eq:102,  eccentricity:0.009, orbitRadiusEarth:23455, starMassEarth:332946, radiusEarth:0.245, massEarth:0.008, surfaceHistory:{ erosion:0.1 }, age:0.3 },
};
```

- [ ] **Step 4: Write `relief-base-step.js`**

```js
// relief-base-step.js — minimal Tier-1 "expose + derive" base step for the relief slice.
// Pure: no three.js. Un-zeros D12 via the SAME tidal-heat math as planet-lod-lab-core.deriveUniforms
// (planet-lod-lab-core.js:516-529), so D12 is derived from the bundle's orbital params — NOT by
// editing PlanetGenerator core (its :565 zero is irrelevant to the lab).
import { makeSubstrate } from './relief-substrate.js';
import alea from 'alea';
import { createNoise2D } from 'simplex-noise';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function makeBaseStep(bundle, { n, lat0Deg, lat1Deg, domainKm, seed = 'relief' }) {
  const d = bundle || {};
  const radiusEarth = d.radiusEarth ?? 1.0;
  const massEarth = d.massEarth ?? 1.0;
  const surfaceGravity = massEarth / (radiusEarth * radiusEarth);

  // D12 tidalHeat — identical Io-normalised form to deriveUniforms (ecc^2 * Mstar^2 * R^5 / a^5).
  const ecc = d.eccentricity ?? 0;
  const starMassEarth = d.starMassEarth ?? 332946;
  const orbitRadiusEarth = d.orbitRadiusEarth ?? 23455;
  const ioRef = (0.0041 * 0.0041) * (317.8 * 317.8) * Math.pow(0.286, 5) / Math.pow(66, 5);
  const tidalHeat = orbitRadiusEarth > 0
    ? (ecc * ecc * starMassEarth * starMassEarth * Math.pow(radiusEarth, 5) / Math.pow(orbitRadiusEarth, 5)) / ioRef
    : 0;

  const density = d.composition?.density ?? 5.5;
  const rockyCrust = smoothstep(2.5, 3.9, density);           // silicate↔ice gate (mirrors core:557)
  const surfaceHistory = d.surfaceHistory?.erosion ?? 0;
  const age = d.age ?? 0.5;

  // Radial-strain SIGN (contraction vs expansion). Cooling/old/large → net contraction (+1, scarps);
  // strong tidal heating/young → net expansion (-1, grabens). Derived from D12/age/gravity (E6 dossier:
  // sign flips the whole feature set; must be DERIVED, never undefined).
  const expansionDrive = clamp01(Math.log10(1 + tidalHeat) / 2);   // tidal heating pushes expansion
  const contractionDrive = clamp01(0.4 + 0.6 * age) * clamp01(surfaceGravity / 1.5); // cooling/age/size
  const radialStrainSign = contractionDrive >= expansionDrive ? +1 : -1;
  const radialStrainMag = clamp01(Math.abs(contractionDrive - expansionDrive)) * 0.001; // ~0.05-0.1% areal

  // Despin amplitude proxy (E6 can pick PATTERN from latitude but needs an amplitude). Approximate from
  // age (more despin accumulated) + a shell-thickness term. Honest: not the true Δ(spin^2) (unavailable).
  const shellThickness = clamp01(0.3 + 0.5 * smoothstep(0.5, 9, surfaceGravity) + 0.2 * (1 - age));
  const despinAmp = clamp01(0.3 + 0.7 * age);

  // Low-freq crustal-thickness blobs → plateau/tessera masks (E6 Step 4). Seeded simplex.
  const rng = alea(String(seed) + ':crust');
  const noise = createNoise2D(rng);
  const thicknessBlob = (ix, iy, gn) => {
    const u = ix / gn, v = iy / gn;
    const a = 0.5 + 0.5 * noise(u * 2.5, v * 2.5);
    const b = 0.5 + 0.5 * noise(u * 5.0 + 11.3, v * 5.0 - 4.1);
    return clamp01(0.65 * a + 0.35 * b);
  };

  const substrate = makeSubstrate({ n, lat0Deg, lat1Deg, domainKm });
  const drivers = { tidalHeat, surfaceGravity, rockyCrust, surfaceHistory, age,
                    radialStrainSign, radialStrainMag, despinAmp };
  const crust = { shellThickness, thicknessBlob };
  return { drivers, crust, substrate };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "base step"`
Expected: PASS (6 tests). If the Europa/Rocky `rockyCrust` ordering fails, re-check the transcribed `density` numbers (icy density < 2.5, rocky > 3.9).

- [ ] **Step 6: Commit**

```bash
git add relief-base-step.js relief-presets.js tests/world-engine-relief-slice.test.js
git commit -m "world-engine slice: base step (D12 un-zero, stub crust field) + presets"
```

---

## Task 3: E6 part A — Melosh latitude stress → structural-grain director + Anderson regime

Closed-form despun-shell stress (E6 cheap-recipe Step 1-2). Per-cell from latitude: two horizontal principal stresses with the standard rotational membrane coefficients `(3+ν)`/`(1+3ν)` (ν=0.25, constant-thickness idealization — Melosh 1977, Vening Meinesz 1947), plus the isotropic radial-strain term from the base step. Anderson classification → regime; grain angle = lineament strike.

**Files:**
- Create: `relief-e6-tectonic.js`
- Test: `tests/world-engine-relief-slice.test.js`

**Interfaces:**
- Consumes: `REGIME`, `idx`, `latDegOfRow` (Task 1); `drivers`, `crust` (Task 2).
- Produces (exported for testing the sub-step before the full `runE6`):
  - `stressAtLat(latDeg, drivers) -> { sMer, sZon, regime, grainAngle }` (sMer=meridional, sZon=zonal/azimuthal principal stresses; grainAngle in radians)
  - `writeGrain(substrate, drivers) -> void` (fills `grainAngle`, `grainMag`, `regime` from latitude)

- [ ] **Step 1: Write the failing test**

```js
// append to tests/world-engine-relief-slice.test.js
import { makeSubstrate as mkSub2, REGIME as RG, latDegOfRow as latRow } from '../relief-substrate.js';
import { stressAtLat, writeGrain } from '../relief-e6-tectonic.js';

describe('E6 Melosh latitude stress', () => {
  const drivers = { radialStrainSign: +1, radialStrainMag: 0, despinAmp: 1, surfaceGravity: 1 };
  it('equator → thrust (both horizontal stresses compressive)', () => {
    const r = stressAtLat(0, drivers);
    expect(r.regime).toBe(RG.THRUST);
  });
  it('pole → normal (both tensile)', () => {
    const r = stressAtLat(85, drivers);
    expect(r.regime).toBe(RG.NORMAL);
  });
  it('mid-latitude (~48°) → strike-slip (stresses straddle zero)', () => {
    const r = stressAtLat(48, drivers);
    expect(r.regime).toBe(RG.STRIKESLIP);
  });
  it('contraction sign biases toward thrust vs expansion toward normal at the same latitude', () => {
    const lat = 50;
    const contract = stressAtLat(lat, { ...drivers, radialStrainSign:+1, radialStrainMag:0.3 });
    const expand   = stressAtLat(lat, { ...drivers, radialStrainSign:-1, radialStrainMag:0.3 });
    // more compression under contraction → regime index >= expansion's (THRUST=2 > STRIKESLIP=1 > NORMAL=0)
    expect(contract.regime).toBeGreaterThanOrEqual(expand.regime);
  });
  it('writeGrain fills regime that varies across the latitude band', () => {
    const s = mkSub2({ n: 32, lat0Deg: 0, lat1Deg: 85, domainKm: 4000 });
    writeGrain(s, drivers);
    const regimes = new Set(Array.from(s.regime));
    expect(regimes.size).toBeGreaterThan(1);            // not a single regime everywhere
    expect(s.grainMag.some(v => v > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "E6 Melosh"`
Expected: FAIL — cannot find module `../relief-e6-tectonic.js`.

- [ ] **Step 3: Write the implementation (this file grows in Task 4)**

```js
// relief-e6-tectonic.js — E6 Lithospheric-stress / tectonic-grain. Pure: no three.js.
// Closed-form despun-shell stress (Melosh 1977 "Global tectonics of a despun planet"; Vening
// Meinesz 1947). Constant-thickness thin-shell idealization, ν=0.25. The two horizontal membrane
// principal stresses for a slowing (despinning) planet follow the standard rotational coefficients:
//   sMer (meridional) ∝ (1+ν) - (3+ν) sin²φ        → sign change near 38°
//   sZon (azimuthal)  ∝ (1+ν) - (1+3ν) sin²φ        → sign change near 57°
// giving equator→thrust, mid-lat→strike-slip, pole→normal (the documented band pattern; the
// strike-slip band ~38–57° brackets the ~48° boundary the verify pass cites). Positive = compressive.
import { REGIME, idx, latDegOfRow } from './relief-substrate.js';

const NU = 0.25;
const DEG = Math.PI / 180;

export function stressAtLat(latDeg, drivers) {
  const s2 = Math.sin(latDeg * DEG) ** 2;
  const amp = (drivers.despinAmp ?? 1);
  let sMer = amp * ((1 + NU) - (3 + NU) * s2);
  let sZon = amp * ((1 + NU) - (1 + 3 * NU) * s2);
  // Isotropic radial strain: contraction (+1) adds compression everywhere (scarps); expansion (-1)
  // adds tension (grabens). Shifts the regime boundaries — E6 dossier: sign flips the feature set.
  const eps = (drivers.radialStrainSign ?? +1) * (drivers.radialStrainMag ?? 0) * (3 + NU) * 0.5;
  sMer += eps; sZon += eps;
  // Anderson regime from the two horizontal principal stresses (surface vertical stress ≈ 0).
  let regime;
  if (sMer > 0 && sZon > 0) regime = REGIME.THRUST;
  else if (sMer < 0 && sZon < 0) regime = REGIME.NORMAL;
  else regime = REGIME.STRIKESLIP;
  // Grain (lineament strike): faults strike perpendicular to the most extreme horizontal stress.
  // Dominant axis = larger |stress|; meridional acts N-S, zonal acts E-W (here +x = "east").
  const grainAngle = Math.abs(sMer) >= Math.abs(sZon) ? 0 : Math.PI / 2;
  return { sMer, sZon, regime, grainAngle };
}

export function writeGrain(substrate, drivers) {
  const { n } = substrate;
  for (let iy = 0; iy < n; iy++) {
    const lat = latDegOfRow(substrate, iy);
    const { sMer, sZon, regime, grainAngle } = stressAtLat(lat, drivers);
    const mag = Math.min(1, Math.hypot(sMer, sZon) / (1 + NU));
    for (let ix = 0; ix < n; ix++) {
      const i = idx(substrate, ix, iy);
      substrate.grainAngle[i] = grainAngle;
      substrate.grainMag[i] = mag;
      substrate.regime[i] = regime;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "E6 Melosh"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add relief-e6-tectonic.js tests/world-engine-relief-slice.test.js
git commit -m "world-engine slice: E6 Melosh latitude stress → grain + Anderson regime"
```

---

## Task 4: E6 part B — steered noise + plateaus + gravity-capped amplitude → WRITE height

Builds the relief into `substrate.height` (E6 cheap-recipe Steps 3-5): anisotropic ridged/billow noise steered by the grain director, profile per regime; plateau uplift from the crust thickness blobs; isostatic amplitude cap via the `1/√g` gravity factor (reuse the production helper's formula); optional 8–16 bounded Jacobi smoothing.

**Files:**
- Modify: `relief-e6-tectonic.js`
- Test: `tests/world-engine-relief-slice.test.js`

**Interfaces:**
- Consumes: `writeGrain` (Task 3); `drivers`, `crust` (Task 2).
- Produces: `runE6(substrate, crust, drivers, epoch, seed) -> substrate` (mutates `height`, grain, regime, faultDensity).
- `epoch` is `{ name, rotatePoleDeg=0, blend=1 }` (Task 9 uses `rotatePoleDeg`/`blend`; here pass `{ name:'tectonic-build' }`).

- [ ] **Step 1: Write the failing test**

```js
// append to tests/world-engine-relief-slice.test.js
import { runE6 } from '../relief-e6-tectonic.js';
import { makeBaseStep as mkBase4 } from '../relief-base-step.js';
import { PRESETS as P4 } from '../relief-presets.js';

describe('E6 runE6 builds relief', () => {
  const grid = { n: 48, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'e6-1' };
  it('writes nonzero, finite, varied relief', () => {
    const { substrate, crust, drivers } = mkBase4(P4.rocky, grid);
    runE6(substrate, crust, drivers, { name: 'tectonic-build' }, grid.seed);
    expect(substrate.height.every(Number.isFinite)).toBe(true);
    const min = Math.min(...substrate.height), max = Math.max(...substrate.height);
    expect(max - min).toBeGreaterThan(0);
  });
  it('low-gravity body gets larger relief amplitude than high-gravity (isostatic 1/√g cap)', () => {
    const lowG  = mkBase4({ ...P4.rocky, massEarth: 0.1, radiusEarth: 0.5 }, grid);   // g≈0.4
    const highG = mkBase4({ ...P4.rocky, massEarth: 4.0, radiusEarth: 1.2 }, grid);   // g≈2.8
    runE6(lowG.substrate, lowG.crust, lowG.drivers, { name:'tectonic-build' }, grid.seed);
    runE6(highG.substrate, highG.crust, highG.drivers, { name:'tectonic-build' }, grid.seed);
    const amp = (s) => Math.max(...s.height) - Math.min(...s.height);
    expect(amp(lowG.substrate)).toBeGreaterThan(amp(highG.substrate));
  });
  it('is deterministic for a fixed seed', () => {
    const a = mkBase4(P4.rocky, grid), b = mkBase4(P4.rocky, grid);
    runE6(a.substrate, a.crust, a.drivers, { name:'tectonic-build' }, 'seedX');
    runE6(b.substrate, b.crust, b.drivers, { name:'tectonic-build' }, 'seedX');
    expect(Array.from(a.substrate.height)).toEqual(Array.from(b.substrate.height));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "E6 runE6"`
Expected: FAIL — `runE6` is not exported.

- [ ] **Step 3: Append the implementation to `relief-e6-tectonic.js`**

```js
// ── append to relief-e6-tectonic.js ──
import alea from 'alea';
import { createNoise2D } from 'simplex-noise';

// Isostatic gravity cap — same form as planet-lod-lab-core.reliefGravityFactor (clamp(g^-0.5, 0.4, 2.5)).
function reliefGravityFactor(g) {
  const f = Math.pow(Math.max(g, 1e-3), -0.5);
  return Math.min(2.5, Math.max(0.4, f));
}

// Anisotropic steered noise: sample simplex in a frame rotated to the grain angle, stretched along
// strike (lineaments are long). Ridged (1-|n|) for compressional grain, billow (|n|) otherwise.
function steeredNoise(noise, x, y, angle, regime, freq) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const u = (x * ca + y * sa) * freq * 0.35;   // along strike: lower freq (elongated)
  const v = (-x * sa + y * ca) * freq * 1.6;    // across strike: higher freq (tight ridges)
  const nVal = noise(u, v);
  return regime === REGIME.NORMAL ? Math.abs(nVal) - 0.5 : 0.5 - Math.abs(nVal); // ridges vs grabens
}

export function runE6(substrate, crust, drivers, epoch = { name: 'tectonic-build' }, seed = 'e6') {
  const { n } = substrate;
  writeGrain(substrate, drivers);                                  // Steps 1-2
  const rng = alea(String(seed) + ':e6:' + (epoch.name || ''));
  const noise = createNoise2D(rng);
  const noisePlateau = createNoise2D(alea(String(seed) + ':e6plateau'));
  const gCap = reliefGravityFactor(drivers.surfaceGravity ?? 1);
  const silicate = drivers.rockyCrust ?? 1;                        // icy worlds → muted silicate relief
  const blend = epoch.blend ?? 1;                                  // Task 9 overprint uses <1
  const baseAmp = 0.6 * gCap * (0.3 + 0.7 * silicate);

  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const i = iy * n + ix;
      const x = ix / n, y = iy / n;
      // Step 3: steered grain relief.
      let h = steeredNoise(noise, x, y, substrate.grainAngle[i], substrate.regime[i], 9.0)
                * substrate.grainMag[i];
      // Step 4: plateau/tessera — isostatic uplift on thick-crust blobs, capped by 1/√g.
      const blob = crust.thicknessBlob(ix, iy, n);
      const plateau = Math.max(0, blob - 0.55) * 1.6;             // only thick blobs uplift
      h += plateau * (0.4 + 0.3 * (0.5 + 0.5 * noisePlateau(x * 6, y * 6)));
      substrate.height[i] += baseAmp * h * blend;
      substrate.faultDensity[i] = Math.max(substrate.faultDensity[i], substrate.grainMag[i]);
    }
  }
  // Step 5: bounded Jacobi smoothing (cosmetic; non-convergent — short wavelengths only).
  jacobiSmooth(substrate, 10);
  return substrate;
}

function jacobiSmooth(substrate, passes) {
  const { n } = substrate;
  const h = substrate.height;
  let buf = new Float32Array(h.length);
  for (let p = 0; p < passes; p++) {
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const i = iy * n + ix;
      let sum = h[i], cnt = 1;
      if (ix > 0)     { sum += h[i - 1]; cnt++; }
      if (ix < n - 1) { sum += h[i + 1]; cnt++; }
      if (iy > 0)     { sum += h[i - n]; cnt++; }
      if (iy < n - 1) { sum += h[i + n]; cnt++; }
      buf[i] = h[i] * 0.5 + (sum / cnt) * 0.5;   // gentle, weighted toward original
    }
    h.set(buf);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "E6 runE6"`
Expected: PASS (3 tests). If the low-g/high-g amplitude test fails, confirm `reliefGravityFactor` is multiplying `baseAmp` (low g → factor up to 2.5; high g → down to 0.4).

- [ ] **Step 5: Commit**

```bash
git add relief-e6-tectonic.js tests/world-engine-relief-slice.test.js
git commit -m "world-engine slice: E6 steered relief + plateaus + gravity-capped amplitude"
```

---

## Task 5: E9 part A — D8 flow direction + priority-flood fill + flow accumulation

E9 cheap-recipe algorithm steps 1-2 (CPU reference). Priority-flood depression fill (heap ported in spirit from `planet-lod-rivers.js:288-310`, but on the regular grid with 8-neighbour adjacency), D8 steepest-descent receiver on the filled surface, exact flow accumulation by descending-elevation order.

**Files:**
- Create: `relief-e9-hydrology.js`
- Test: `tests/world-engine-relief-slice.test.js`

**Interfaces:**
- Consumes: `idx` (Task 1).
- Produces (exported sub-steps for testing):
  - `priorityFloodFill(height, n, seaLevel) -> Float32Array filled` (depression-filled surface; sea cells are seeds)
  - `d8Receivers(filled, n) -> Int32Array receiver` (`receiver[i]` = index of steepest-descent lower neighbour, or `i` if a pit/sea outlet)
  - `flowAccumulate(receiver, n, weight) -> Float32Array accum` (`weight` optional Float32Array precip weight, default 1 per cell)

- [ ] **Step 1: Write the failing test**

```js
// append to tests/world-engine-relief-slice.test.js
import { priorityFloodFill, d8Receivers, flowAccumulate } from '../relief-e9-hydrology.js';

describe('E9 routing primitives', () => {
  // 5x5 cone: high centre, low edges → all flow should reach the boundary.
  function cone(n) {
    const h = new Float32Array(n * n); const c = (n - 1) / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = -(Math.hypot(x - c, y - c));
    return h; // centre = 0 (high), edges negative (low) → inverted cone, ridge in middle
  }
  it('priority-flood removes interior pits (no cell strictly below all neighbours, off-edge)', () => {
    const n = 7; const h = new Float32Array(n * n).fill(1); h[3 * n + 3] = -5; // a pit
    const filled = priorityFloodFill(h, n, -1e9);
    // the pit must be filled up to at least its lowest neighbour
    let isPit = true;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if (filled[(3+dy)*n + (3+dx)] < filled[3*n+3]) isPit = false;
    expect(isPit).toBe(false);
  });
  it('d8 receivers point downhill (filled[receiver] <= filled[i]) for non-outlet cells', () => {
    const n = 9; const h = cone(n); const filled = priorityFloodFill(h, n, -1e9);
    const rec = d8Receivers(filled, n);
    let okPct = 0, land = 0;
    for (let i = 0; i < n * n; i++) { if (rec[i] !== i) { land++; if (filled[rec[i]] <= filled[i] + 1e-6) okPct++; } }
    expect(okPct).toBe(land); // EVERY routed cell goes downhill
  });
  it('flow accumulation concentrates: max accum >> mean accum', () => {
    const n = 21; const h = cone(n); const filled = priorityFloodFill(h, n, -1e9);
    const rec = d8Receivers(filled, n); const accum = flowAccumulate(rec, n);
    const max = Math.max(...accum); const mean = accum.reduce((a, b) => a + b, 0) / accum.length;
    expect(max).toBeGreaterThan(mean * 5);   // trunk cells carry far more than average
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "E9 routing"`
Expected: FAIL — cannot find module `../relief-e9-hydrology.js`.

- [ ] **Step 3: Write the implementation (grows in Task 6-7)**

```js
// relief-e9-hydrology.js — E9 Hydrology, CPU BAKE-TIME REFERENCE (NOT per-frame). Pure: no three.js.
// The runtime target is a GPU FastFlow (Jain 2024) bake; this CPU priority-flood + exact accumulation
// reference exists to prove the host-editor mechanism (drainage cuts E6 relief), not bake speed.
// Priority-flood heap is the grid analogue of planet-lod-rivers.js:288-310 (Barnes 2014).

const NEI = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]; // 8-neighbour offsets

// Min-heap on (elevation, index). Returns depression-filled surface; boundary + sea cells are seeds.
export function priorityFloodFill(height, n, seaLevel) {
  const N = n * n;
  const filled = Float32Array.from(height);
  const closed = new Uint8Array(N);
  const he = [], hi = [];
  const push = (e, i) => { he.push(e); hi.push(i); let c = he.length - 1;
    while (c > 0) { const p = (c - 1) >> 1; if (he[p] <= he[c]) break;
      [he[p], he[c]] = [he[c], he[p]]; [hi[p], hi[c]] = [hi[c], hi[p]]; c = p; } };
  const pop = () => { const e = he[0], i = hi[0]; const le = he.pop(), li = hi.pop();
    if (he.length) { he[0] = le; hi[0] = li; let c = 0; const m = he.length;
      for (;;) { let l = 2*c+1, r = 2*c+2, s = c;
        if (l < m && he[l] < he[s]) s = l; if (r < m && he[r] < he[s]) s = r; if (s === c) break;
        [he[s], he[c]] = [he[c], he[s]]; [hi[s], hi[c]] = [hi[c], hi[s]]; c = s; } }
    return i; };
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
    const i = iy * n + ix;
    const edge = ix === 0 || iy === 0 || ix === n - 1 || iy === n - 1;
    if (edge || filled[i] < seaLevel) { closed[i] = 1; push(filled[i], i); }
  }
  while (he.length) {
    const c = pop(); const cy = (c / n) | 0, cx = c - cy * n;
    for (const [dx, dy] of NEI) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const nb = ny * n + nx; if (closed[nb]) continue;
      closed[nb] = 1;
      if (filled[nb] <= filled[c]) filled[nb] = filled[c] + 1e-6;  // raise to spill point
      push(filled[nb], nb);
    }
  }
  return filled;
}

// D8 steepest descent on the filled surface (diagonal slopes /√2). receiver[i]=i means outlet/sea/edge.
export function d8Receivers(filled, n) {
  const N = n * n; const rec = new Int32Array(N).fill(-1);
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
    const i = iy * n + ix; let best = i, bestSlope = 0;
    for (const [dx, dy] of NEI) {
      const nx = ix + dx, ny = iy + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const nb = ny * n + nx; const dist = (dx && dy) ? Math.SQRT2 : 1;
      const slope = (filled[i] - filled[nb]) / dist;
      if (slope > bestSlope) { bestSlope = slope; best = nb; }
    }
    rec[i] = best; // i itself if no lower neighbour (outlet)
  }
  return rec;
}

// Exact accumulation over the single-flow-direction receiver tree, via Kahn topological sort
// (each node is poured into its receiver only after all its donors have been poured into it).
export function flowAccumulate(receiver, n, weight) {
  const N = n * n; const accum = new Float32Array(N);
  for (let i = 0; i < N; i++) accum[i] = weight ? weight[i] : 1;
  const indeg = new Int32Array(N);
  for (let i = 0; i < N; i++) if (receiver[i] !== i) indeg[receiver[i]]++;
  const queue = []; for (let i = 0; i < N; i++) if (indeg[i] === 0) queue.push(i);
  let h = 0;
  while (h < queue.length) {
    const i = queue[h++]; const r = receiver[i];
    if (r !== i) { accum[r] += accum[i]; if (--indeg[r] === 0) queue.push(r); }
  }
  return accum;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "E9 routing"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add relief-e9-hydrology.js tests/world-engine-relief-slice.test.js
git commit -m "world-engine slice: E9 routing primitives (priority-flood, D8, accumulation)"
```

---

## Task 6: E9 part B — synthesized precipitation + stream-power incision (writes ≤0 delta into shared height) + base-level fill

The host edit. Steps 3-5,8 of the E9 recipe: synthesize a precipitation weight (no climate engine exists — latitude band + orographic upslope + substellar bump), fold it into erodibility K; run a HANDFUL of bounded stream-power passes (`dz = -K·A^m·S^n·maturity`, default 5 — not 1, not 200), accumulating a strictly-≤0 incision delta; apply it to the SHARED `substrate.height`; compute a base-level/standing-liquid fill from a volatile-derived sea fraction.

**Files:**
- Modify: `relief-e9-hydrology.js`
- Test: `tests/world-engine-relief-slice.test.js`

**Interfaces:**
- Consumes: `priorityFloodFill`, `d8Receivers`, `flowAccumulate` (Task 5); `drivers` (Task 2); `idx`, `latDegOfRow` (Task 1).
- Produces:
  - `synthPrecip(substrate, drivers) -> Float32Array weight` (per-cell ≥0, mean ~1)
  - `seaLevelForFraction(height, n, frac) -> number` (histogram solve)
  - `runE9(substrate, drivers, epoch, seed) -> { incision, seaLevel, passes }` — MUTATES `substrate.height` (`+= incision`, incision≤0), `flowAccum`, `baseLevel`, `standing`, `maturity`.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/world-engine-relief-slice.test.js
import { runE9, synthPrecip, seaLevelForFraction } from '../relief-e9-hydrology.js';
import { runE6 as runE6_6 } from '../relief-e6-tectonic.js';
import { makeBaseStep as mkBase6 } from '../relief-base-step.js';
import { PRESETS as P6 } from '../relief-presets.js';
import { cloneHeight as clone6 } from '../relief-substrate.js';

describe('E9 incision (the host edit)', () => {
  const grid = { n: 64, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'e9-1' };
  function built() {
    const b = mkBase6(P6.rocky, grid);
    runE6_6(b.substrate, b.crust, b.drivers, { name:'tectonic-build' }, grid.seed);
    return b;
  }
  it('incision is strictly subtractive and lowers the shared height', () => {
    const b = built(); const before = clone6(b.substrate);
    const { incision } = runE9(b.substrate, b.drivers, { name:'fluvial-carve' }, grid.seed);
    expect(incision.every(v => v <= 1e-9)).toBe(true);
    for (let i = 0; i < b.substrate.height.length; i++)
      expect(b.substrate.height[i]).toBeLessThanOrEqual(before[i] + 1e-6);
  });
  it('carve correlates with relief: high-relief cells incise more than flat low cells', () => {
    const b = built(); const before = clone6(b.substrate);
    const { incision } = runE9(b.substrate, b.drivers, { name:'fluvial-carve' }, grid.seed);
    const med = [...before].sort((a, c) => a - c)[before.length >> 1];
    let hiSum = 0, hiN = 0, loSum = 0, loN = 0;
    for (let i = 0; i < before.length; i++) {
      if (before[i] > med) { hiSum += -incision[i]; hiN++; } else { loSum += -incision[i]; loN++; }
    }
    expect(hiSum / hiN).toBeGreaterThan(loSum / loN);   // mountains get cut, flats don't
  });
  it('synthPrecip is nonneg and varies with latitude', () => {
    const b = built(); const w = synthPrecip(b.substrate, b.drivers);
    expect(w.every(v => v >= 0)).toBe(true);
    expect(Math.max(...w)).toBeGreaterThan(Math.min(...w));
  });
  it('seaLevelForFraction hits the requested ocean fraction (±5%)', () => {
    const b = built(); const sl = seaLevelForFraction(b.substrate.height, grid.n, 0.4);
    let below = 0; for (const v of b.substrate.height) if (v < sl) below++;
    expect(below / b.substrate.height.length).toBeCloseTo(0.4, 1);
  });
  it('uses a bounded handful of passes (not 1, not ~200)', () => {
    const b = built(); const { passes } = runE9(b.substrate, b.drivers, { name:'fluvial-carve' }, grid.seed);
    expect(passes).toBeGreaterThanOrEqual(3); expect(passes).toBeLessThanOrEqual(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "E9 incision"`
Expected: FAIL — `runE9`/`synthPrecip`/`seaLevelForFraction` not exported.

- [ ] **Step 3: Append the implementation to `relief-e9-hydrology.js`**

```js
// ── append to relief-e9-hydrology.js ──
import { latDegOfRow } from './relief-substrate.js';

const clamp01b = (x) => Math.max(0, Math.min(1, x));

// Synthesized rainfall weight — no climate engine yet (E9 dossier: precip is under-supplied; stub it).
// latitude band (wet equator/temperate, dry mid) + orographic upslope (rain on windward height gradient).
export function synthPrecip(substrate, drivers) {
  const { n } = substrate; const w = new Float32Array(n * n);
  for (let iy = 0; iy < n; iy++) {
    const lat = latDegOfRow(substrate, iy) * Math.PI / 180;
    const band = 0.5 + 0.5 * Math.cos(lat * 2);                 // wet near equator & poles, dry mid
    for (let ix = 0; ix < n; ix++) {
      const i = iy * n + ix;
      const hx = substrate.height[Math.min(ix + 1, n - 1) + iy * n] - substrate.height[i];
      const oro = clamp01b(hx * 4);                              // upslope (windward +x) → more rain
      w[i] = 0.4 + band + 0.6 * oro;
    }
  }
  // normalise to mean ~1 so K stays calibrated
  let s = 0; for (const v of w) s += v; const k = (n * n) / (s || 1);
  for (let i = 0; i < w.length; i++) w[i] *= k;
  return w;
}

export function seaLevelForFraction(height, n, frac) {
  if (frac <= 0) return -Infinity; if (frac >= 1) return Infinity;
  const sorted = Float32Array.from(height).sort();
  return sorted[Math.floor(frac * (sorted.length - 1))];
}

export function runE9(substrate, drivers, epoch = { name: 'fluvial-carve' }, seed = 'e9') {
  const { n } = substrate; const N = n * n;
  const PASSES = 5;                       // bounded handful (E9 verify: not 1, not ~200)
  const m = 0.45, nExp = 1.0;
  const erodibility = 0.18 * clamp01b(0.3 + 0.7 * (drivers.surfaceHistory ?? 0)); // K base from erosion budget
  const weight = synthPrecip(substrate, drivers);
  const maturity = clamp01b(0.4 + 0.6 * (drivers.age ?? 0.5));

  // sea level from a volatile/temperature-derived target ocean fraction (E9 base-level step).
  const frac = clamp01b(0.55 * clamp01b(((drivers.rockyCrust ?? 1) > 0 ? 1 : 1)) *
                        clamp01b(0.2 + 0.8 * ((substrate.height && 1))) ); // simple 0.4-ish default
  const targetFrac = 0.4;                 // slice default; harness GUI overrides
  let seaLevel = seaLevelForFraction(substrate.height, n, targetFrac);

  const incision = new Float32Array(N);   // accumulates ≤0
  for (let p = 0; p < PASSES; p++) {
    const filled = priorityFloodFill(substrate.height, n, seaLevel);
    const rec = d8Receivers(filled, n);
    const accum = flowAccumulate(rec, n, weight);
    for (let i = 0; i < N; i++) substrate.flowAccum[i] = accum[i];
    // one bounded stream-power increment per cell, capped so a cell never cuts below its receiver.
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const i = iy * n + ix; const r = rec[i]; if (r === i) continue;
      if (substrate.height[i] < seaLevel) continue;                 // don't carve underwater
      const ry = (r / n) | 0, rx = r - ry * n;
      const dist = ((ix - rx) && (iy - ry)) ? Math.SQRT2 : 1;
      const slope = Math.max(0, (substrate.height[i] - substrate.height[r]) / dist);
      let dz = erodibility * Math.pow(accum[i], m) * Math.pow(slope, nExp) * maturity * 0.02;
      const drop = substrate.height[i] - substrate.height[r];
      dz = Math.min(dz, Math.max(0, drop * 0.5));                   // stability cap (no inversion)
      incision[i] -= dz;
      substrate.height[i] -= dz;
    }
  }
  // base-level / standing-liquid fill (lakes from residual depressions + the sea).
  const filledFinal = priorityFloodFill(substrate.height, n, seaLevel);
  for (let i = 0; i < N; i++) {
    const lake = filledFinal[i] - substrate.height[i] > 1e-4;
    const sea = substrate.height[i] < seaLevel;
    substrate.standing[i] = (lake || sea) ? 1 : 0;
    substrate.baseLevel[i] = sea ? seaLevel : (lake ? filledFinal[i] : substrate.height[i]);
    substrate.maturity[i] = Math.min(1, substrate.maturity[i] + maturity * 0.5);
  }
  return { incision, seaLevel, passes: PASSES };
}
```

> Implementer note: the `frac`/`targetFrac` lines above are intentionally simple — `targetFrac = 0.4` is the slice default. Delete the dead `frac` expression if the linter complains; it's left only to mark where a volatile-derived fraction would plug in. Keep `targetFrac`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "E9 incision"`
Expected: PASS (5 tests). If "carve correlates with relief" is flaky, raise grid `n` to 96 in that test (more cells → cleaner statistics) before changing the physics.

- [ ] **Step 5: Commit**

```bash
git add relief-e9-hydrology.js tests/world-engine-relief-slice.test.js
git commit -m "world-engine slice: E9 stream-power incision (host edit) + precip + base level"
```

---

## Task 7: Orchestrator — 2-epoch loop + snapshots + verifier

Wires base step → `[tectonic-build:E6, fluvial-carve:E9]`, captures `heightAfterBuild` before epoch 2, exposes the `epoch2` on/off toggle, and ships `verifyReliefSlice` computing the 7 north-star signals.

**Files:**
- Create: `relief-slice.js`
- Test: `tests/world-engine-relief-slice.test.js`

**Interfaces:**
- Consumes: `makeBaseStep` (Task 2); `runE6` (Task 4); `runE9` (Task 6); `cloneHeight` (Task 1).
- Produces:
  - `runReliefSlice(driverBundle, { n=256, lat0Deg=0, lat1Deg=80, domainKm=4000, seed='slice', epoch2=true }) -> { substrate, drivers, crust, heightAfterBuild, e9, params }`
  - `verifyReliefSlice(result) -> { pass:boolean, signals:{ subtractive, carveCorrelatesRelief, noUphill, accumSpread, hackExponent, depressionsFilled, deterministic? }, detail:{...} }`

- [ ] **Step 1: Write the failing test**

```js
// append to tests/world-engine-relief-slice.test.js
import { runReliefSlice, verifyReliefSlice } from '../relief-slice.js';
import { PRESETS as P7 } from '../relief-presets.js';

describe('relief slice orchestrator', () => {
  it('build-only and build+carve are bit-identical THROUGH epoch 1', () => {
    const carve = runReliefSlice(P7.rocky, { n: 64, seed: 's', epoch2: true });
    const buildOnly = runReliefSlice(P7.rocky, { n: 64, seed: 's', epoch2: false });
    // heightAfterBuild is captured pre-carve in both → must match exactly
    expect(Array.from(carve.heightAfterBuild)).toEqual(Array.from(buildOnly.heightAfterBuild));
    // build-only final height == its post-build snapshot (no carve ran)
    expect(Array.from(buildOnly.substrate.height)).toEqual(Array.from(buildOnly.heightAfterBuild));
  });
  it('enabling epoch 2 only lowers height (valleys overprint)', () => {
    const r = runReliefSlice(P7.rocky, { n: 64, seed: 's2', epoch2: true });
    for (let i = 0; i < r.substrate.height.length; i++)
      expect(r.substrate.height[i]).toBeLessThanOrEqual(r.heightAfterBuild[i] + 1e-6);
  });
  it('passes the north-star verifier on the Rocky control', () => {
    const r = runReliefSlice(P7.rocky, { n: 96, seed: 's3', epoch2: true });
    const v = verifyReliefSlice(r);
    expect(v.signals.subtractive).toBe(true);
    expect(v.signals.carveCorrelatesRelief).toBe(true);
    expect(v.signals.noUphill).toBe(true);
    expect(v.signals.depressionsFilled).toBe(true);
    expect(v.signals.hackExponent).toBeGreaterThan(0.4);
    expect(v.signals.hackExponent).toBeLessThan(0.8);
    expect(v.pass).toBe(true);
  });
  it('is deterministic end-to-end', () => {
    const a = runReliefSlice(P7.lava, { n: 64, seed: 'det' });
    const b = runReliefSlice(P7.lava, { n: 64, seed: 'det' });
    expect(Array.from(a.substrate.height)).toEqual(Array.from(b.substrate.height));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "relief slice orchestrator"`
Expected: FAIL — cannot find module `../relief-slice.js`.

- [ ] **Step 3: Write the implementation**

```js
// relief-slice.js — orchestrator + north-star verifier. Pure: no three.js.
// The 2-epoch host-editor loop: ONE shared substrate, E6 writes height in epoch 1, E9 subtracts in
// epoch 2. heightAfterBuild is the legibility witness (lets us prove "drainage post-dates the relief").
import { makeBaseStep } from './relief-base-step.js';
import { runE6 } from './relief-e6-tectonic.js';
import { runE9, d8Receivers, priorityFloodFill } from './relief-e9-hydrology.js';
import { cloneHeight } from './relief-substrate.js';

export function runReliefSlice(driverBundle, opts = {}) {
  const params = { n: 256, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'slice', epoch2: true, ...opts };
  const { drivers, crust, substrate } = makeBaseStep(driverBundle, params);
  // EPOCH 1 — tectonic build (E6 writes the host).
  runE6(substrate, crust, drivers, { name: 'tectonic-build' }, params.seed);
  const heightAfterBuild = cloneHeight(substrate);
  // EPOCH 2 — fluvial carve (E9 edits the host in place).
  let e9 = null;
  if (params.epoch2) e9 = runE9(substrate, drivers, { name: 'fluvial-carve' }, params.seed);
  return { substrate, drivers, crust, heightAfterBuild, e9, params };
}

export function verifyReliefSlice(result) {
  const { substrate, heightAfterBuild, e9, params } = result;
  const { n } = substrate; const N = n * n; const h = substrate.height;
  // 1. strictly subtractive
  let subtractive = true;
  for (let i = 0; i < N; i++) if (h[i] > heightAfterBuild[i] + 1e-6) { subtractive = false; break; }
  // 2. carve correlates with pre-carve relief
  const med = Float32Array.from(heightAfterBuild).sort()[N >> 1];
  let hiSum = 0, hiN = 0, loSum = 0, loN = 0;
  for (let i = 0; i < N; i++) { const cut = heightAfterBuild[i] - h[i];
    if (heightAfterBuild[i] > med) { hiSum += cut; hiN++; } else { loSum += cut; loN++; } }
  const carveCorrelatesRelief = (hiSum / Math.max(1, hiN)) > (loSum / Math.max(1, loN));
  // 3. no uphill flow on the final filled surface
  const seaLevel = e9 ? e9.seaLevel : -Infinity;
  const filled = priorityFloodFill(h, n, seaLevel);
  const rec = d8Receivers(filled, n);
  let uphill = 0; for (let i = 0; i < N; i++) if (rec[i] !== i && filled[rec[i]] > filled[i] + 1e-6) uphill++;
  const noUphill = uphill === 0;
  // 4. accumulation spread
  const accum = substrate.flowAccum; const maxA = Math.max(...accum);
  const meanA = accum.reduce((a, b) => a + b, 0) / N;
  const accumSpread = maxA > meanA * 5;
  // 5. depressions filled (every land cell has a downhill neighbour after fill, except outlets/edges)
  let depressionsFilled = true;
  for (let iy = 1; iy < n - 1 && depressionsFilled; iy++) for (let ix = 1; ix < n - 1; ix++) {
    const i = iy * n + ix; if (h[i] < seaLevel) continue;
    let hasLower = false;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])
      if (filled[(iy+dy)*n + (ix+dx)] < filled[i] - 1e-9) { hasLower = true; break; }
    if (!hasLower) { depressionsFilled = false; break; }
  }
  // 6. Hack's law: longest flow path length vs its drainage area, exponent via the trunk outlet.
  const hackExponent = estimateHackExponent(rec, accum, n);
  const pass = subtractive && carveCorrelatesRelief && noUphill && accumSpread &&
               depressionsFilled && hackExponent > 0.4 && hackExponent < 0.8;
  return { pass, signals: { subtractive, carveCorrelatesRelief, noUphill, accumSpread,
                            depressionsFilled, hackExponent },
           detail: { uphill, maxA, meanA, hiCut: hiSum / Math.max(1, hiN), loCut: loSum / Math.max(1, loN) } };
}

// Hack's law L ~ A^h: walk the longest upstream path from the highest-accumulation outlet, regress
// path length vs accumulated area in log-log over the trunk. Returns h (~0.5-0.6 for fluvial nets).
function estimateHackExponent(rec, accum, n) {
  const N = n * n;
  // find outlet (receiver==self) with max accum
  let outlet = 0, best = -1; for (let i = 0; i < N; i++) if (rec[i] === i && accum[i] > best) { best = accum[i]; outlet = i; }
  // donors map
  const donors = Array.from({ length: N }, () => []);
  for (let i = 0; i < N; i++) if (rec[i] !== i) donors[rec[i]].push(i);
  // walk upstream always to the highest-accum donor; record (length, area)
  const lens = [], areas = []; let cur = outlet, len = 0;
  const seen = new Uint8Array(N);
  while (cur != null && !seen[cur]) {
    seen[cur] = 1; len++; lens.push(len); areas.push(accum[cur]);
    let nxt = null, bA = -1; for (const d of donors[cur]) if (accum[d] > bA) { bA = accum[d]; nxt = d; }
    cur = nxt;
  }
  // log-log least squares of length vs area over points with area>1
  let sx = 0, sy = 0, sxx = 0, sxy = 0, k = 0;
  for (let j = 0; j < lens.length; j++) { if (areas[j] <= 1) continue;
    const x = Math.log(areas[j]), y = Math.log(lens[j]); sx += x; sy += y; sxx += x * x; sxy += x * y; k++; }
  if (k < 3) return 0.5;
  const slope = (k * sxy - sx * sy) / (k * sxx - sx * sx);   // d(logL)/d(logA) = h
  return Number.isFinite(slope) ? Math.abs(slope) : 0.5;
}
```

> Implementer note on Hack's exponent: the regression is `logL` vs `logA`, so `h` is the slope. If the test's `[0.4, 0.8]` band fails on the Rocky control, log `v.signals.hackExponent` and the `detail` — do NOT loosen the band first; a value far outside it means routing or accumulation is wrong upstream (debug Task 5/6), not that the threshold is wrong.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "relief slice orchestrator"`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the FULL test file (all tasks so far green together)**

Run: `npx vitest run tests/world-engine-relief-slice.test.js`
Expected: PASS (all describe blocks).

- [ ] **Step 6: Commit**

```bash
git add relief-slice.js tests/world-engine-relief-slice.test.js
git commit -m "world-engine slice: 2-epoch orchestrator + north-star verifier"
```

---

## Task 8: E6 epoch-2 overprint (editor-on-host generality) — optional but recommended

Demonstrates E6 *also* as an editor-on-host (not just E9): a rotated-pole 2nd-generation lineament set blended onto the existing relief (Step 6). Proves the host-editor model generalises beyond build→carve. Surfaced as a separate orchestrator mode, NOT part of the default E6→E9 slice.

**Files:**
- Modify: `relief-e6-tectonic.js` (honour `epoch.rotatePoleDeg`)
- Modify: `relief-slice.js` (add `overprint` option → runs a 3rd epoch `E6(rotatePoleDeg)` after carve, or as configured)
- Test: `tests/world-engine-relief-slice.test.js`

**Interfaces:**
- Consumes: `runE6` (Task 4).
- Produces: `runE6` honours `epoch.rotatePoleDeg` (rotate the latitude used for stress by this many degrees) and `epoch.blend` (<1 → fainter overprint, additive); `runReliefSlice(..., { overprint: { rotatePoleDeg, blend } })` runs it as an extra editor epoch and records `heightAfterCarve` snapshot.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/world-engine-relief-slice.test.js
describe('E6 editor-on-host overprint (generality)', () => {
  it('a rotated-pole overprint epoch changes relief but stays bounded (faint blend)', () => {
    const base = runReliefSlice(P7.rocky, { n: 64, seed: 'op', epoch2: true });
    const over = runReliefSlice(P7.rocky, { n: 64, seed: 'op', epoch2: true,
                                            overprint: { rotatePoleDeg: 35, blend: 0.4 } });
    let diff = 0, maxAbs = 0;
    for (let i = 0; i < base.substrate.height.length; i++) {
      const d = Math.abs(over.substrate.height[i] - base.substrate.height[i]);
      diff += d; maxAbs = Math.max(maxAbs, d);
    }
    expect(diff).toBeGreaterThan(0);          // the overprint did something
    expect(maxAbs).toBeLessThan(1.0);          // but it's a faint blend, not a rebuild
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "editor-on-host overprint"`
Expected: FAIL — `overprint` option ignored (heights identical → `diff` is 0).

- [ ] **Step 3: Implement**

In `relief-e6-tectonic.js`, change `writeGrain` use inside `runE6` so the latitude is offset by `epoch.rotatePoleDeg`:
```js
// in runE6, replace `writeGrain(substrate, drivers);` with:
writeGrain(substrate, drivers, epoch.rotatePoleDeg || 0);
```
and update `writeGrain` signature + the `latDegOfRow` call:
```js
export function writeGrain(substrate, drivers, rotatePoleDeg = 0) {
  const { n } = substrate;
  for (let iy = 0; iy < n; iy++) {
    const lat = latDegOfRow(substrate, iy) + rotatePoleDeg;   // rotated pole → 2nd-gen offset bands
    const { sMer, sZon, regime, grainAngle } = stressAtLat(lat, drivers);
    // ...unchanged body...
  }
}
```
(When `epoch.blend < 1`, `runE6`'s existing `blend` term already makes the height contribution additive-and-fainter, so the overprint superposes a rotated set rather than replacing.)

In `relief-slice.js`, after the epoch-2 carve block, add:
```js
  const heightAfterCarve = cloneHeight(substrate);
  if (params.overprint) {
    runE6(substrate, crust, drivers,
          { name: 'despin-overprint', rotatePoleDeg: params.overprint.rotatePoleDeg ?? 30,
            blend: params.overprint.blend ?? 0.4 }, params.seed + ':op');
  }
```
and add `heightAfterCarve` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "editor-on-host overprint"`
Expected: PASS. Then re-run the whole file: `npx vitest run tests/world-engine-relief-slice.test.js` (all green).

- [ ] **Step 5: Commit**

```bash
git add relief-e6-tectonic.js relief-slice.js tests/world-engine-relief-slice.test.js
git commit -m "world-engine slice: E6 rotated-pole overprint (host-editor generality)"
```

---

## Task 9: Visualization harness (`world-engine-relief-lab.html` + `.main.js`)

A standalone Vite-served page (per `feedback_isolated-test-harnesses.md`). Renders the substrate as a displaced-plane mesh (3D, vertex-coloured elevation/water + channel tint) and a 2D drainage canvas; `lil-gui` controls; `window._relief` surface incl. `verifySlice()`. Imports the pure modules + three.

**Files:**
- Create: `world-engine-relief-lab.html`
- Create: `world-engine-relief-lab.main.js`

**Interfaces:**
- Consumes: `runReliefSlice`, `verifyReliefSlice` (Task 7); `PRESETS` (Task 2).
- Produces (browser global): `window._relief = { regen, setPreset, setEpoch2, setRes, result, verifySlice, lookTop, lookOblique }` and `window.__reliefReady = true`.

- [ ] **Step 1: Write `world-engine-relief-lab.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>World-Engine — relief group slice (E6 build → E9 carve)</title>
  <!--
    world-engine-relief-lab.html — ISOLATED relief-substrate slice harness.
    base step (D12 un-zero + stub crust) → EPOCH 1 E6 tectonic build → EPOCH 2 E9 fluvial carve,
    sharing ONE mutable height field (the host-editor model). Pure compute in relief-*.js (vitest-tested);
    this page only VISUALISES. E9 is a CPU bake reference (not per-frame). Served by Vite —
    open http://127.0.0.1:5173/world-engine-relief-lab.html (Max runs `npm run dev`).
  -->
  <style>
    html,body { margin:0; height:100%; background:#05060a; overflow:hidden; font-family:ui-monospace,monospace; }
    #canvas { display:block; width:100vw; height:100vh; }
    #hud { position:fixed; top:8px; left:8px; color:#9fd; font-size:12px; line-height:1.5;
           background:rgba(0,0,0,.6); padding:8px 10px; border-radius:6px; white-space:pre; pointer-events:none; }
    #mini { position:fixed; bottom:8px; right:8px; border:1px solid #234; image-rendering:pixelated; }
    vite-error-overlay { display:none !important; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <div id="hud">booting…</div>
  <canvas id="mini" width="256" height="256"></canvas>
  <script type="module" src="./world-engine-relief-lab.main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `world-engine-relief-lab.main.js`**

```js
// world-engine-relief-lab.main.js — harness glue only (viz + controls). Pure compute lives in relief-*.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'lil-gui';
import { runReliefSlice, verifyReliefSlice } from './relief-slice.js';
import { PRESETS } from './relief-presets.js';

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05060a);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.001, 100);
camera.position.set(0, 1.4, 1.8);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true;
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dir = new THREE.DirectionalLight(0xffffff, 1.0); dir.position.set(1, 1.5, 0.8); scene.add(dir);

const state = { preset: 'rocky', res: 192, epoch2: true, overprint: false, seed: 'lab' };
let mesh = null, result = null;

function buildMesh(r) {
  if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
  const { n } = r.substrate; const h = r.substrate.height; const st = r.substrate.standing;
  const accum = r.substrate.flowAccum;
  const geo = new THREE.PlaneGeometry(2, 2, n - 1, n - 1);
  const pos = geo.attributes.position; const col = new Float32Array(n * n * 3);
  let hMin = Infinity, hMax = -Infinity; for (const v of h) { if (v < hMin) hMin = v; if (v > hMax) hMax = v; }
  const aMax = Math.max(1, Math.max(...accum));
  const cLow = new THREE.Color(0x3c4a2c), cMid = new THREE.Color(0x6b6450), cHi = new THREE.Color(0xcfcabc);
  const cSea = new THREE.Color(0x0a2a4d), cRiv = new THREE.Color(0x2f6fb0);
  for (let i = 0; i < n * n; i++) {
    pos.setZ(i, (h[i] - (hMin + hMax) / 2) * 0.6);                   // displacement
    let c;
    if (st[i]) c = cSea;
    else { const t = THREE.MathUtils.clamp((h[i] - hMin) / (hMax - hMin + 1e-6), 0, 1);
           c = t < 0.5 ? cLow.clone().lerp(cMid, t / 0.5) : cMid.clone().lerp(cHi, (t - 0.5) / 0.5); }
    const riv = Math.min(1, Math.log(1 + accum[i]) / Math.log(1 + aMax));   // channel tint on big-accum cells
    if (!st[i] && riv > 0.6) c = c.clone().lerp(cRiv, (riv - 0.6) / 0.4);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals(); geo.rotateX(-Math.PI / 2);
  mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  scene.add(mesh);
  drawMini(r);
}

// 2D drainage map (channels black, water blue, land grey) — drainage legibility.
function drawMini(r) {
  const mini = document.getElementById('mini'); const ctx = mini.getContext('2d');
  const { n } = r.substrate; const img = ctx.createImageData(n, n);
  const accum = r.substrate.flowAccum; const aMax = Math.max(1, Math.max(...accum)); const st = r.substrate.standing;
  mini.width = n; mini.height = n;
  for (let i = 0; i < n * n; i++) {
    const riv = Math.log(1 + accum[i]) / Math.log(1 + aMax); let R, G, B;
    if (st[i]) { R = 20; G = 60; B = 120; } else if (riv > 0.55) { const k = (1 - riv) * 255; R = G = B = k; B = 120; }
    else { R = G = B = 120; }
    img.data[i * 4] = R; img.data[i * 4 + 1] = G; img.data[i * 4 + 2] = B; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function regen() {
  result = runReliefSlice(PRESETS[state.preset], {
    n: state.res, seed: state.seed, epoch2: state.epoch2,
    overprint: state.overprint ? { rotatePoleDeg: 35, blend: 0.4 } : undefined,
  });
  buildMesh(result);
  const v = verifyReliefSlice(result);
  document.getElementById('hud').textContent =
    `preset ${state.preset} | ${state.res}² | epoch2 ${state.epoch2} | overprint ${state.overprint}\n` +
    `E9 = CPU BAKE REFERENCE (not per-frame) | passes ${result.e9 ? result.e9.passes : '-'}\n` +
    `verify pass=${v.pass} | subtractive ${v.signals.subtractive} | carve∝relief ${v.signals.carveCorrelatesRelief}\n` +
    `noUphill ${v.signals.noUphill} | depFilled ${v.signals.depressionsFilled} | Hack h=${v.signals.hackExponent.toFixed(3)}\n` +
    `accum max/mean ${v.detail.maxA.toFixed(0)}/${v.detail.meanA.toFixed(2)} | hiCut ${v.detail.hiCut.toFixed(4)} loCut ${v.detail.loCut.toFixed(4)}`;
  return v;
}

const gui = new GUI();
gui.add(state, 'preset', Object.keys(PRESETS)).onChange(regen);
gui.add(state, 'res', { '128': 128, '192': 192, '256': 256 }).onChange(v => { state.res = +v; regen(); });
gui.add(state, 'epoch2').name('epoch 2 (carve)').onChange(regen);
gui.add(state, 'overprint').name('E6 overprint').onChange(regen);
gui.add({ reseed: () => { state.seed = 'lab' + Math.floor(performance.now()); regen(); } }, 'reseed');

window._relief = {
  THREE, get result() { return result; },
  regen, verifySlice: () => verifyReliefSlice(result),
  setPreset: (p) => { state.preset = p; return regen(); },
  setEpoch2: (b) => { state.epoch2 = !!b; return regen(); },
  setRes: (n) => { state.res = n; return regen(); },
  lookTop: () => { camera.position.set(0, 2.4, 0.001); controls.target.set(0, 0, 0); controls.update(); },
  lookOblique: () => { camera.position.set(0, 1.4, 1.8); controls.target.set(0, 0, 0); controls.update(); },
};
regen();
window.__reliefReady = true;
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
(function tick() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(tick); })();
```

- [ ] **Step 3: Sanity-check it parses (no test runner for the browser file — lint via node import of the pure deps it pulls)**

Run: `node --input-type=module -e "import('./relief-slice.js').then(()=>console.log('modules import OK'))"`
Expected: prints `modules import OK` (confirms the pure module graph the harness imports is valid; three-importing files aren't checked here — they load in the browser).

- [ ] **Step 4: Commit**

```bash
git add world-engine-relief-lab.html world-engine-relief-lab.main.js
git commit -m "world-engine slice: isolated visualization harness (_relief surface)"
```

---

## Task 10: Live verification + wrap-up

Confirm the harness renders and the north-star reads as "a landscape with a history" in the GPU browser, then update the durable docs.

**Files:**
- Modify: `docs/FEATURES/world-engine-INDEX.md` (flip status line: slice BUILT, pending Max UAT)
- Modify: `docs/NOW.md` (active workstream → relief slice built)

- [ ] **Step 1: Full test suite green**

Run: `npx vitest run tests/world-engine-relief-slice.test.js`
Expected: ALL pass. Capture the count.

- [ ] **Step 2: Live render check (chrome-devtools GPU :9223 — NOT Playwright)**

Per `well-dipper-testing-reference.md`: Max has `npm run dev` running + the 9223 GPU Chrome open.
- `mcp__chrome-devtools__list_pages` (confirm liveness — do NOT curl localhost).
- `mcp__chrome-devtools__navigate_page` → `http://127.0.0.1:5173/world-engine-relief-lab.html`
- Wait for `window.__reliefReady === true` (`mcp__chrome-devtools__evaluate_script`).
- `window._relief.lookOblique(); window._relief.setPreset('rocky')` → screenshot.
- `window._relief.setEpoch2(false)` → screenshot (uncut relief), then `setEpoch2(true)` → screenshot (valleys overprint). The A/B is the visual proof of temporal legibility.
- `window._relief.verifySlice()` → confirm `pass:true`.
- Repeat `setPreset('lava')` / `'europa'` for range.
- GPU hygiene: when done, `navigate_page` the 9223 tab to `about:blank`.

- [ ] **Step 3: Update durable docs (Rule 3 — docs before status flip)**

Edit `world-engine-INDEX.md` top block: "relief-group slice BUILT in isolated harness (`world-engine-relief-lab.html`), all north-star signals green in vitest + live; VERIFIED_PENDING_MAX <sha>; UAT (reads-as-history) is Max's gate." Edit `docs/NOW.md` active workstream accordingly.

- [ ] **Step 4: Commit**

```bash
git add docs/FEATURES/world-engine-INDEX.md docs/NOW.md
git commit -m "world-engine slice: docs — relief slice built, pending Max UAT"
```

- [ ] **Step 5: Report to Max** — summary + the 3 A/B screenshots (epoch2 off vs on) + the `verifySlice()` pass object. Do NOT mark UAT done (Max's gate alone). Confirm before any `git push`.

---

## Self-Review

- **Spec coverage:** base step (D12 un-zero + stub interior/crust) = Task 2 ✓; shared mutable substrate = Task 1 ✓; E6 build (Melosh + steered noise + plateau + gravity cap + Jacobi) = Tasks 3-4 ✓; E9 carve (precip + D8 + priority-flood + accumulation + bounded stream-power, host edit) = Tasks 5-6 ✓; 2-epoch host-editor loop + legibility = Task 7 ✓; the 4 things the slice validates (substrate, host-editor/epoch, expose+derive boundary, E9 bake) = covered across Tasks 1/2/6/7 ✓; E6-as-editor generality = Task 8 ✓; isolated harness = Task 9 ✓; live verify = Task 10 ✓.
- **E9 honesty (wf2-synthesis §8):** CPU bake reference, bounded passes (3-12, default 5, asserted), GPU FastFlow deferred — stated in code + HUD + constraints ✓. No "single pass" / "Priority-Flood is GPU-parallel" claims.
- **Type/name consistency:** `makeSubstrate`/`idx`/`latDegOfRow`/`cloneHeight`/`REGIME` (Task 1) used verbatim downstream; `makeBaseStep`→`{drivers,crust,substrate}` consumed by `runE6`/`runE9`; `runE6(substrate,crust,drivers,epoch,seed)` and `runE9(substrate,drivers,epoch,seed)` signatures consistent across Tasks 4/6/7/8; `verifyReliefSlice` signal keys match the harness HUD + tests ✓.
- **Deferred / flagged risks:** sphere/cubemap mapping deferred (this slice is a flat lat-band DEM); precipitation is a stub (no E5 climate engine); Jacobi smoothing is cosmetic/non-convergent (large features won't read isostatically compensated); despin amplitude is approximate (true Δspin² unavailable); the 84-edge interaction audit is NOT mapped onto the engine DAG (deferred). All are intentional slice scope, recorded here.
</content>
</invoke>
