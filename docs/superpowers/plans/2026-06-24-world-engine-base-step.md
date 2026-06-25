# World-Engine WS2 — Tier-1 Base Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a NEW, three-free `src/worldengine/base/` derivation layer ("base step") that consumes WS1's `planetData` and *writes* the structured fields the relief engines read — calibrated tidal heat, an Anderson stress/grain field, a thin interior field, on a seam-free sphere carrier — behind a determinism + field verifier gate, plus an interim field-viz page.

**Architecture:** WS2 **ports** (transcribes) the proven formulas from the lab reference files (`relief-substrate.js`, `relief-base-step.js`, `relief-e6-tectonic.js`) into a NEW additive `src/worldengine/base/` tree. `src/generation/` and the `relief-*.js` lab files stay **untouched references**. The base step is pure data (no three.js); it imports only `alea` + `simplex-noise` (allowed — deterministic, no `Math.random`/`Date.now`). Two new pieces that don't exist in the reference: (1) the **F2 `adaptL0(planetData)→bundle`** adapter (name/unit remapping + tidal/age calibration), and (2) the **F5 interior proxies** (`loveK2`, `thermalState`, materialized `crustalThickness`). The **F3 sphere carrier is dependency-injected**: the caller/test builds the mesh via `buildIrregularSphere` (which imports `three`), and passes plain `{verts,faces,adj}` data into a three-free `makeSphereField` — this is how F3 "reuses the router's proven seam-free mesh" without dragging `three` into the base step.

**Tech Stack:** ES modules (`"type":"module"`, explicit `.js` extensions), `vitest` (`vitest run`, `it`-blocks), `alea ^1.0.1`, `simplex-noise ^4.0.3`. Tests auto-discovered by the default glob `**/*.{test,spec}.?(c|m)[jt]s?(x)`; new test files live in `tests/` and import from repo root via `../`.

## Global Constraints

Every task's requirements implicitly include this section. Copied verbatim from the contract (`docs/WORKSTREAMS/world-engine-base-step-2026-06-24/contract.json`) `mustStayWorking` + scope decisions:

- **`src/generation/` UNTOUCHED.** WS2 is a new additive tree (Option A). Do not edit any file under `src/generation/`. The magnetic-field lock-predicate cleanup stays a separate follow-up — do NOT touch `computeAtmosphere`/`PhysicsEngine.js:173`.
- **The `relief-*.js` lab files UNTOUCHED.** They are read-only physics references being *ported*, not modified. `src/objects/Planet.js` (game shader) UNTOUCHED (lab-only lock). `planet-lod-lab-core.js` UNTOUCHED (its `deriveUniforms` self-derivation shim stays as the lab's own fallback; we do not import it).
- **No three.js in `src/worldengine/base/`.** Verified blocker: `buildIrregularSphere` imports `three` (uses `THREE.ConvexHull`). Mitigation = dependency injection (F3): the base step consumes a plain mesh object; `three` lives only at mesh-build time (caller/test). Importing `three` *in a test file* is fine.
- **No `Math.random` / `Date.now`** anywhere in `src/worldengine/base/`. Determinism comes from `alea(seedString)`. Same `(bundle, opts, seed)` → byte-identical fields (the F7 gate). Pin seed strings exactly.
- **`planetData` is never mutated** by any WS2 code (purity; preserves JSON save/share). `adaptL0` spreads/copies, never writes back.
- **The six WS1 keys stay byte-identical** — WS2 only READS `planetData`. `systemContext` stays serialization-safe; `partnerIndex` is positional-only, never persisted as an id.
- **Stage EXPLICIT paths in every commit. NEVER `git add -A`** — the working tree carries unrelated warp WIP and hundreds of loose media files. Each task's commit step lists exact paths.
- **A file literally named `HEAD` exists in repo root.** Never `git show HEAD` / rely on `HEAD`. Use `git log --oneline -1` and explicit shas.
- **Run tests SCOPED:** `npx vitest run tests/<file>.test.js` — never bare `npm test` (it carries 4 pre-existing unrelated `searchKnownObjects` failures + vendor files vitest can't load).
- **Branch:** `feature/world-engine-production-L1` (current HEAD `84890ae`). Commit at each task seam. **Do NOT push** (campaign-wide push HOLD — Max's call).
- **OPEN calibration sub-question (flagged for Max, does NOT block the build):** `TIDAL_LOG_KNEE` sets where Io-grade heating reads on the 0–1 dial. Default chosen to preserve top-end spread (Io≈0.19); the AC asserts *properties* (Earth≈0, strictly ordered, never exactly 1.0), so it passes regardless of the exact knee. Max confirms the Io-anchor at VIZ time.

## Determinism & numeric constants (authoritative — keyed on by multiple tasks)

- `clamp01(x) = Math.max(0, Math.min(1, x))`; `smoothstep(a,b,x) = { t=clamp01((x-a)/(b-a)); return t*t*(3-2*t); }`; `mix(a,b,t)=a+(b-a)*t`. (Live in `mathutil.js`, Task 1.)
- `REGIME = { NORMAL: 0, STRIKESLIP: 1, THRUST: 2 }` (Uint8 ints). Anderson `>=` ordering THRUST(2) > STRIKESLIP(1) > NORMAL(0).
- `NU = 0.25`; `DEG = Math.PI/180`; `REGIME_GAIN = 0.4` (LOCKED — do not change).
- Stress: `sMer = amp*((1+NU)-(3+NU)*s2)`, `sZon = amp*((1+NU)-(1+3*NU)*s2)`, `s2=sin(latDeg*DEG)²`, `amp=despinAmp??1`. Emergent band boundaries: `|lat|≈38.4°` (sMer flip), `|lat|≈57.3°` (sZon flip). Pattern at neutral strain: equator→THRUST, ~38–57°→STRIKESLIP, >57°→NORMAL.
- `eps = radialStrainSign * radialStrainMag * span * REGIME_GAIN`, `span = amp*(3+NU)`; `sMer+=eps; sZon+=eps`. Contraction (+1) biases THRUST; expansion (−1) biases NORMAL.
- `grainAngle = |sMer|>=|sZon| ? 0 : Math.PI/2` (quantized). `grainMag = min(1, hypot(sMer,sZon)/(1+NU))` (per-row in `writeGrain`).
- Calibration constants (`adaptL0.js`): `TIDAL_LOG_KNEE = 1.6`, `AGE_NORM_DIVISOR = 10`, `DENSITY_KGM3_TO_GCM3 = 1/1000`, `LOVE_K2_RANGE = { min: 0.02, max: 1.5 }`.
- The 5 relief presets (F7 fixtures) live in `relief-presets.js` (repo root); tests import them read-only via `../relief-presets.js`. They are in *bundle* shape (g/cm³ density, `starMassEarth`/`orbitRadiusEarth`, no `age`→defaults 0.5, no `tidalHeat`→base step recomputes via Io-formula).

## File Structure

```
src/worldengine/base/
  mathutil.js     [Task 1]  clamp01, clamp, smoothstep, mix
  substrate.js    [Task 1]  REGIME, makeSubstrate, idx, latDegOfRow, cloneHeight  (port of relief-substrate.js)
  adaptL0.js      [Task 3]  adaptL0(planetData)->bundle, calibrateTidal, TIDAL_LOG_KNEE, AGE_NORM_DIVISOR, DENSITY_KGM3_TO_GCM3, LOVE_K2_RANGE
  baseStep.js     [Task 2,8] makeBaseStep(bundle, gridOpts)->{drivers, crust, substrate}  (port of relief-base-step.js + tidal precedence/calibration + F5 interior)
  tectonic.js     [Task 5,7,8] NU, REGIME_GAIN, stressAtLat, writeGrain, writeGrainSphere, runE6  (port of relief-e6-tectonic.js stress + build half)
  sphereField.js  [Task 6]  makeSphereField(mesh)->carrier  (three-free; nodeDir/latDegOf/tangentFrameAt + field arrays)
  verify.js       [Task 9]  verify(output)->{pass, signals, detail}
  fieldViz.js     [Task 10] regimeColor, grainStreak, thicknessHeat, paintField  (pure paint fns)
worldengine-fieldviz.html  [Task 10]  interim field-viz page (reads production base-step output; for Max's UAT)
tests/
  worldengine-base-substrate.test.js   [Task 1]
  worldengine-base-interface.test.js   [Task 2]
  worldengine-base-adaptl0.test.js     [Task 3]
  worldengine-base-tidal-integration.test.js [Task 4]
  worldengine-base-tectonic.test.js    [Task 5]
  worldengine-base-sphere.test.js      [Task 6]
  worldengine-base-seam.test.js        [Task 7]
  worldengine-base-interior.test.js    [Task 8]
  worldengine-base-verify.test.js      [Task 9]
  worldengine-base-viz.test.js         [Task 10]
```

Each task owns its own test file (clean subagent isolation — no aliased-import append gymnastics). Tasks 2/8 both write `baseStep.js`; Tasks 5/7/8 both write `tectonic.js` — later tasks READ the existing file and ADD to it (the Interfaces block names what already exists).

---

## Task 1: F1 substrate + math utils

**Files:**
- Create: `src/worldengine/base/mathutil.js`
- Create: `src/worldengine/base/substrate.js`
- Test: `tests/worldengine-base-substrate.test.js`

**Interfaces:**
- Produces: `clamp01(x)`, `clamp(lo,hi,x)`, `smoothstep(a,b,x)`, `mix(a,b,t)` (mathutil.js); `REGIME`, `makeSubstrate({n,lat0Deg,lat1Deg,domainKm})→substrate`, `idx(s,ix,iy)`, `latDegOfRow(s,iy)`, `cloneHeight(s)` (substrate.js). `substrate` has scalars `n,lat0Deg,lat1Deg,domainKm,count` + typed arrays `height/grainAngle/grainMag/faultDensity/flowAccum/baseLevel/maturity` (Float32Array, len n*n) and `regime/standing` (Uint8Array, len n*n), all zero-init.

- [ ] **Step 1: Write the failing test**

```js
// tests/worldengine-base-substrate.test.js
import { describe, it, expect } from 'vitest';
import { clamp01, clamp, smoothstep, mix } from '../src/worldengine/base/mathutil.js';
import { REGIME, makeSubstrate, idx, latDegOfRow, cloneHeight } from '../src/worldengine/base/substrate.js';

describe('worldengine base — mathutil', () => {
  it('clamp01 clamps to [0,1]', () => {
    expect(clamp01(-3)).toBe(0); expect(clamp01(0.5)).toBe(0.5); expect(clamp01(9)).toBe(1);
  });
  it('smoothstep is 0 below, 1 above, 0.5 at midpoint', () => {
    expect(smoothstep(2.5, 3.9, 1)).toBe(0); expect(smoothstep(2.5, 3.9, 9)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 6);
  });
  it('mix lerps', () => { expect(mix(2, 4, 0.5)).toBe(3); });
  it('clamp clamps value to [lo,hi] (arg order lo,hi,x)', () => {
    expect(clamp(0, 10, 15)).toBe(10); expect(clamp(0, 10, -1)).toBe(0); expect(clamp(0, 10, 5)).toBe(5);
  });
});

describe('worldengine base — substrate', () => {
  it('exposes the regime enum', () => {
    expect(REGIME.NORMAL).toBe(0); expect(REGIME.STRIKESLIP).toBe(1); expect(REGIME.THRUST).toBe(2);
  });
  it('allocates co-registered typed arrays of n*n with correct dtypes, zero-init', () => {
    const s = makeSubstrate({ n: 64, lat0Deg: 0, lat1Deg: 80, domainKm: 4000 });
    expect(s.count).toBe(64 * 64);
    for (const f of ['height','grainAngle','grainMag','faultDensity','flowAccum','baseLevel','maturity']) {
      expect(s[f]).toBeInstanceOf(Float32Array); expect(s[f].length).toBe(64 * 64);
      expect(s[f].every(v => v === 0)).toBe(true);
    }
    expect(s.regime).toBeInstanceOf(Uint8Array); expect(s.standing).toBeInstanceOf(Uint8Array);
    expect(s.regime.every(v => v === 0)).toBe(true);
    expect(s.standing.every(v => v === 0)).toBe(true);
    expect(s.count).toBe(s.n * s.n);
  });
  it('indexes row-major: idx(s,ix,iy) === iy*n+ix', () => {
    const s = makeSubstrate({ n: 8, lat0Deg: 0, lat1Deg: 10, domainKm: 100 });
    expect(idx(s, 3, 2)).toBe(2 * 8 + 3);
  });
  it('maps rows to latitude linearly: row0->lat0, lastRow->lat1', () => {
    const s = makeSubstrate({ n: 11, lat0Deg: 0, lat1Deg: 80, domainKm: 100 });
    expect(latDegOfRow(s, 0)).toBeCloseTo(0); expect(latDegOfRow(s, 10)).toBeCloseTo(80);
    expect(latDegOfRow(s, 5)).toBeCloseTo(40);
  });
  it('cloneHeight returns an independent deep copy', () => {
    const s = makeSubstrate({ n: 4, lat0Deg: 0, lat1Deg: 1, domainKm: 1 });
    s.height[0] = 5; const c = cloneHeight(s); s.height[0] = 9;
    expect(c[0]).toBe(5); expect(c).toBeInstanceOf(Float32Array);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worldengine-base-substrate.test.js`
Expected: FAIL — cannot resolve `../src/worldengine/base/mathutil.js` (module not found).

- [ ] **Step 3: Write minimal implementation**

```js
// src/worldengine/base/mathutil.js
// Pure scalar helpers shared across the world-engine base step. No three.js, no rng.
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const clamp = (lo, hi, x) => Math.max(lo, Math.min(hi, x));
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;
```

```js
// src/worldengine/base/substrate.js
// Production port of relief-substrate.js — the shared mutable relief substrate (host-editor model).
// Pure: no three.js, no rng. A 2D regular-grid DEM; engines mutate `height` in place across epochs.
export const REGIME = { NORMAL: 0, STRIKESLIP: 1, THRUST: 2 };

export function makeSubstrate({ n, lat0Deg, lat1Deg, domainKm }) {
  const count = n * n;
  return {
    n, lat0Deg, lat1Deg, domainKm, count,
    height: new Float32Array(count),
    grainAngle: new Float32Array(count),   // structural-grain director, radians
    grainMag: new Float32Array(count),     // grain magnitude 0..1
    regime: new Uint8Array(count),         // Anderson regime per REGIME
    faultDensity: new Float32Array(count),
    flowAccum: new Float32Array(count),
    baseLevel: new Float32Array(count),
    standing: new Uint8Array(count),
    maturity: new Float32Array(count),
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

Run: `npx vitest run tests/worldengine-base-substrate.test.js`
Expected: PASS (all `it` blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/worldengine/base/mathutil.js src/worldengine/base/substrate.js tests/worldengine-base-substrate.test.js
git commit -m "feat(worldengine WS2-F1): substrate contract + math utils"
```

---

## Task 2: F1 makeBaseStep interface + tidal precedence/calibration

**Files:**
- Create: `src/worldengine/base/baseStep.js`
- Test: `tests/worldengine-base-interface.test.js`
- Depends on: Task 1 (substrate, mathutil), Task 3's `calibrateTidal`/`LOVE_K2_RANGE` — **build Task 3's `adaptL0.js` constants/`calibrateTidal` stub first OR define them here and Task 3 imports them.** Resolution: Task 3 creates `adaptL0.js`; to keep ordering clean, **this task creates `adaptL0.js` containing ONLY `calibrateTidal` + the four constants**, and Task 3 ADDS `adaptL0(...)` to it. (Interfaces below reflect that.)

**Interfaces:**
- Consumes: `makeSubstrate` (Task 1), `clamp01`, `smoothstep` (Task 1).
- Produces (in `adaptL0.js`): `calibrateTidal(rawIoRatio)→[0,1)`, `TIDAL_LOG_KNEE=1.6`, `AGE_NORM_DIVISOR=10`, `DENSITY_KGM3_TO_GCM3=1/1000`, `LOVE_K2_RANGE={min:0.02,max:1.5}`.
- Produces (in `baseStep.js`): `makeBaseStep(bundle, { n, lat0Deg, lat1Deg, domainKm, seed='worldengine', discriminate=true })→{drivers, crust, substrate}`. `drivers` = `{ tidalHeat, surfaceGravity, rockyCrust, surfaceHistory, age, radialStrainSign, radialStrainMag, despinAmp, discriminator, useDiscriminator, liquidStability, liquidSpecies, rainFactor }` (13 fields). `crust` = `{ shellThickness, thicknessBlob(ix,iy,gn), crustalThickness:Float32Array, loveK2, thermalState }` (the F5 fields land in Task 8; this task ships `{ shellThickness, thicknessBlob }` only — Task 8 adds the rest).

**NOTE on precedence:** `drivers.tidalHeat` is the **calibrated [0,1) value**. Raw tidal: prefer `bundle.tidalHeat` (set by `adaptL0` from `planetData.tidalHeating`); when absent, recompute via the Io-formula (the lab self-derivation fallback). Then `tidalHeat = calibrateTidal(rawTidal)`.

- [ ] **Step 1: Write the failing test**

```js
// tests/worldengine-base-interface.test.js
import { describe, it, expect } from 'vitest';
import { makeBaseStep } from '../src/worldengine/base/baseStep.js';
import { calibrateTidal } from '../src/worldengine/base/adaptL0.js';

const grid = { n: 32, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'iface-1' };
const DRIVER_KEYS = ['tidalHeat','surfaceGravity','rockyCrust','surfaceHistory','age',
  'radialStrainSign','radialStrainMag','despinAmp','discriminator','useDiscriminator',
  'liquidStability','liquidSpecies','rainFactor'];

// a WS1-shaped planetData fixture in *bundle* form (already adapted) — the base step reads these
const bundleFixture = {
  radiusEarth: 1.0, massEarth: 1.0, eccentricity: 0.05, starMassEarth: 332946,
  orbitRadiusEarth: 1200, age: 0.45, T_eq: 288,
  composition: { density: 5.5, volatileFraction: 0.15 }, surfaceHistory: { erosion: 0.4 },
};

describe('worldengine base — F1 interface', () => {
  it('downstream stub destructures every driver + crust + substrate field with no undefined', () => {
    const { drivers, crust, substrate } = makeBaseStep(bundleFixture, grid);
    for (const k of DRIVER_KEYS) expect(drivers[k]).toBeDefined();
    // types
    for (const k of ['tidalHeat','surfaceGravity','rockyCrust','surfaceHistory','age','radialStrainMag','despinAmp','liquidStability']) {
      expect(typeof drivers[k]).toBe('number'); expect(Number.isFinite(drivers[k])).toBe(true);
    }
    expect([1, -1]).toContain(drivers.radialStrainSign);
    expect(typeof drivers.discriminator).toBe('string');
    expect(typeof drivers.useDiscriminator).toBe('boolean');
    expect([0, 1]).toContain(drivers.liquidSpecies);
    // crust accessor is a FUNCTION returning [0,1]
    expect(typeof crust.shellThickness).toBe('number');
    const blob = crust.thicknessBlob(10, 12, 32);
    expect(blob).toBeGreaterThanOrEqual(0); expect(blob).toBeLessThanOrEqual(1);
    // substrate fields readable
    for (const f of ['height','grainAngle','grainMag','regime','faultDensity','flowAccum','baseLevel','standing','maturity']) {
      expect(substrate[f].length).toBe(32 * 32);
    }
  });
  it('does not throw on an empty bundle (all ?? defaults)', () => {
    expect(() => makeBaseStep({}, grid)).not.toThrow();
    expect(() => makeBaseStep(undefined, grid)).not.toThrow();
  });
  it('bounded drivers sit in [0,1]; radialStrainSign in {-1,+1}; over 5 presets + empty', async () => {
    const { PRESETS } = await import('../relief-presets.js');
    for (const b of [PRESETS.rocky, PRESETS.lava, PRESETS.magma, PRESETS.europa, PRESETS.terrestrial, {}]) {
      const { drivers } = makeBaseStep(b, grid);
      for (const k of ['tidalHeat','rockyCrust','radialStrainMag','despinAmp','liquidStability']) {
        expect(drivers[k]).toBeGreaterThanOrEqual(0); expect(drivers[k]).toBeLessThanOrEqual(1);
      }
      expect([1, -1]).toContain(drivers.radialStrainSign);
    }
  });
  it('TIDAL PRECEDENCE: present tidalHeat traces to it (calibrated), invariant to ecc/orbit', () => {
    const base = { ...bundleFixture, eccentricity: 0.3, orbitRadiusEarth: 200 }; // Io-formula would be large
    const a = makeBaseStep({ ...base, tidalHeat: 1.0 }, grid).drivers.tidalHeat;
    const b = makeBaseStep({ ...base, tidalHeat: 10.0 }, grid).drivers.tidalHeat;
    expect(a).toBeCloseTo(calibrateTidal(1.0), 10);   // traces to upstream, ignores ecc/orbit
    expect(b).toBeGreaterThan(a);                       // monotonic in upstream value
  });
  it('TIDAL FALLBACK: absent tidalHeat -> finite, >=0, no throw (Io-formula self-derivation)', () => {
    const r = makeBaseStep({ ...bundleFixture, tidalHeat: undefined }, grid).drivers.tidalHeat;
    expect(Number.isFinite(r)).toBe(true); expect(r).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worldengine-base-interface.test.js`
Expected: FAIL — `../src/worldengine/base/baseStep.js` and `adaptL0.js` not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/worldengine/base/adaptL0.js  (this task: constants + calibrateTidal only; Task 3 adds adaptL0)
import { clamp01 } from './mathutil.js';

// Tidal calibration: map the raw Io-ratio (0..∞, 1.0 = Io-grade) to a bounded [0,1) driver.
// tanh(log10(1+h)/KNEE): Earth-like (~1.7e-3) -> ~0; strictly monotone; never reaches exactly 1.0,
// so distinct heating levels never collapse to the same clamped extreme (the old clamp01(tidalHeat) bug).
// KNEE is the OPEN Io-anchor sub-question (smaller KNEE -> Io reads higher). 1.6 -> Io≈0.19 (top-end spread kept).
export const TIDAL_LOG_KNEE = 1.6;
export const AGE_NORM_DIVISOR = 10;          // Gyr -> [0,1] (~max system age; decision 5e: /~10)
export const DENSITY_KGM3_TO_GCM3 = 1 / 1000; // PhysicsEngine density is kg/m³; base step wants g/cm³
export const LOVE_K2_RANGE = { min: 0.02, max: 1.5 }; // F5 loveK2 written range (rigid small body .. fluid body)

export function calibrateTidal(rawIoRatio) {
  const h = Math.max(0, rawIoRatio || 0);
  return Math.tanh(Math.log10(1 + h) / TIDAL_LOG_KNEE);
}
```

```js
// src/worldengine/base/baseStep.js
// Production port of relief-base-step.js — the Tier-1 "expose + derive" base step.
// Pure: no three.js. Imports only alea + simplex-noise (deterministic; no Math.random/Date.now).
import { makeSubstrate } from './substrate.js';
import { clamp01, smoothstep } from './mathutil.js';
import { calibrateTidal } from './adaptL0.js';
import alea from 'alea';
import { createNoise2D } from 'simplex-noise';

export function makeBaseStep(bundle, { n, lat0Deg, lat1Deg, domainKm, seed = 'worldengine', discriminate = true }) {
  const d = bundle || {};
  const radiusEarth = d.radiusEarth ?? 1.0;
  const massEarth = d.massEarth ?? 1.0;
  const surfaceGravity = massEarth / (radiusEarth * radiusEarth);

  // ── tidal precedence + calibration (single-source) ──
  // Prefer the upstream D12 value (d.tidalHeat, from adaptL0 <- planetData.tidalHeating).
  // When absent, fall back to the lab self-derivation: the Io-normalised formula.
  const ecc = d.eccentricity ?? 0;
  const starMassEarth = d.starMassEarth ?? 332946;
  const orbitRadiusEarth = d.orbitRadiusEarth ?? 23455;
  const ioRef = (0.0041 * 0.0041) * (317.8 * 317.8) * Math.pow(0.286, 5) / Math.pow(66, 5);
  const rawTidal = (d.tidalHeat != null)
    ? d.tidalHeat
    : (orbitRadiusEarth > 0
        ? (ecc * ecc * starMassEarth * starMassEarth * Math.pow(radiusEarth, 5) / Math.pow(orbitRadiusEarth, 5)) / ioRef
        : 0);
  const tidalHeat = calibrateTidal(rawTidal);   // bounded [0,1) driver

  const density = d.composition?.density ?? 5.5;
  const rockyCrust = smoothstep(2.5, 3.9, density);
  const surfaceHistory = d.surfaceHistory?.erosion ?? 0;
  // age: prefer the normalized ageNorm (from adaptL0); fall back to d.age (relief presets omit -> 0.5)
  const ageNorm = d.ageNorm ?? (d.age ?? 0.5);

  // radial strain: contraction (+1, scarps) vs expansion (-1, grabens)
  const expansionDrive = tidalHeat;   // calibrated tidal heating pushes expansion
  const contractionDrive = clamp01(0.4 + 0.6 * ageNorm) * clamp01(surfaceGravity / 1.5);
  const radialStrainSign = contractionDrive >= expansionDrive ? +1 : -1;
  const radialStrainMag = clamp01(Math.abs(contractionDrive - expansionDrive));

  const shellThickness = clamp01(0.3 + 0.5 * smoothstep(0.5, 9, surfaceGravity) + 0.2 * (1 - ageNorm));
  const despinAmp = clamp01(0.3 + 0.7 * ageNorm);

  // ── L4 liquidStability (verbatim port of the lab gate chain) ──
  const T = d.T_eq ?? 280;
  const volatileFraction = d.composition?.volatileFraction ?? 0.15;
  const volatileGate = smoothstep(0.05, 0.2, volatileFraction);
  const waterWindow   = smoothstep(248, 273, T) * (1 - smoothstep(373, 398, T));
  const methaneWindow = smoothstep(85, 90, T)   * (1 - smoothstep(112, 120, T));
  const tempWindow = Math.max(waterWindow, methaneWindow);
  const T_exo = 3.5 * T;
  const kB = 1.380649e-23, mp = 1.6726e-27, G = 6.674e-11, Mearth = 5.972e24, Rearth = 6.371e6;
  const massKg = (d.massEarth ?? 1) * Mearth, radM = (d.radiusEarth ?? 1) * Rearth;
  const vEsc2 = 2 * G * massKg / radM;
  const jeans = (molarMass) => (molarMass * mp * vEsc2) / (2 * kB * T_exo);
  const retained = jeans(28) > 6;
  const pressure = retained ? clamp01(0.3 + 0.8 * (d.massEarth ?? 1)) : 0;
  const retentionGate = retained ? smoothstep(0.05, 0.3, pressure) : 0;
  const liquidStability = clamp01(retentionGate * volatileGate * tempWindow);
  const liquidSpecies = methaneWindow > waterWindow ? 1 : 0;   // 0 water, 1 methane
  const rainFactor = (waterWindow > 0 && retained) ? 1.0 : (retained ? 0.2 : 0);

  const discriminator = String(radialStrainSign) + ':' + (rockyCrust > 0.5 ? 'sil' : 'ice');
  const useDiscriminator = !!discriminate;

  // ── crust: shellThickness + thicknessBlob (seeded low-freq simplex) ──
  const crustSeed = String(seed) + ':crust' + (useDiscriminator ? ':' + discriminator : '');
  const rng = alea(crustSeed);
  const noise = createNoise2D(rng);
  const thicknessBlob = (ix, iy, gn) => {
    const u = ix / gn, v = iy / gn;
    const a = 0.5 + 0.5 * noise(u * 2.5, v * 2.5);
    const b = 0.5 + 0.5 * noise(u * 5.0 + 11.3, v * 5.0 - 4.1);
    return clamp01(0.65 * a + 0.35 * b);
  };

  const substrate = makeSubstrate({ n, lat0Deg, lat1Deg, domainKm });
  const drivers = { tidalHeat, surfaceGravity, rockyCrust, surfaceHistory, age: ageNorm,
                    radialStrainSign, radialStrainMag, despinAmp,
                    discriminator, useDiscriminator, liquidStability, liquidSpecies, rainFactor };
  const crust = { shellThickness, thicknessBlob };  // Task 8 adds crustalThickness, loveK2, thermalState
  return { drivers, crust, substrate };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/worldengine-base-interface.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/worldengine/base/baseStep.js src/worldengine/base/adaptL0.js tests/worldengine-base-interface.test.js
git commit -m "feat(worldengine WS2-F1): makeBaseStep interface + tidal precedence/calibration"
```

---

## Task 3: F2 adaptL0 adapter (key-mapping purity + tidal/age calibration)

**Files:**
- Modify: `src/worldengine/base/adaptL0.js` (ADD `adaptL0(...)`; constants + `calibrateTidal` already exist from Task 2)
- Test: `tests/worldengine-base-adaptl0.test.js`
- Depends on: Task 2.

**Interfaces:**
- Consumes: `calibrateTidal`, `AGE_NORM_DIVISOR`, `DENSITY_KGM3_TO_GCM3` (Task 2), `clamp01` (Task 1), `makeBaseStep` (Task 2, for the calibration pipeline test).
- Produces: `adaptL0(planetData)→bundle`. `bundle` keys: `tidalHeat` (= `planetData.tidalHeating` or undefined), `ageNorm` (= `clamp01(age/AGE_NORM_DIVISOR)` or undefined), `magneticField`, `metallicity`, `eccentricity`, `systemContext`, `radiusEarth`, `massEarth`, `T_eq`, `composition:{...,density(g/cm³)}`, `surfaceHistory:{...}`.

- [ ] **Step 1: Write the failing test**

```js
// tests/worldengine-base-adaptl0.test.js
import { describe, it, expect } from 'vitest';
import { adaptL0, AGE_NORM_DIVISOR } from '../src/worldengine/base/adaptL0.js';
import { makeBaseStep } from '../src/worldengine/base/baseStep.js';

const grid = { n: 16, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'ad-1' };

// WS1 planetData (PhysicsEngine shape): density in kg/m³, age in Gyr, the six WS1 keys present.
const planetData = Object.freeze({
  radiusEarth: 1.0, massEarth: 1.0, T_eq: 288,
  composition: Object.freeze({ ironFraction: 0.32, density: 5500, volatileFraction: 0.15 }), // kg/m³!
  surfaceHistory: Object.freeze({ erosion: 0.4, resurfacing: 0.1, bombardment: 0.5 }),
  age: 4.5, metallicity: 0.0, magneticField: 0.32, eccentricity: 0.05, tidalHeating: 0.7,
  systemContext: Object.freeze({ siblings: [], moons: [],
    resonancePartners: [Object.freeze({ partnerIndex: 2, ratio: '2:1' })], companionClass: null }),
});

describe('worldengine base — F2 adaptL0', () => {
  it('maps all six WS1 keys with the right role; drops none', () => {
    const b = adaptL0(planetData);
    expect(b.tidalHeat).toBe(0.7);                          // <- tidalHeating
    expect(b.ageNorm).toBeCloseTo(4.5 / AGE_NORM_DIVISOR);  // <- age (Gyr) normalized
    expect(b.magneticField).toBe(planetData.magneticField); // === (single source)
    expect(b.metallicity).toBe(0.0);
    expect(b.eccentricity).toBe(0.05);                      // present (unused by heat)
    expect(b.systemContext).toBeDefined();
  });
  it('converts density kg/m³ -> g/cm³ so rockyCrust gates correctly', () => {
    const b = adaptL0(planetData);
    expect(b.composition.density).toBeCloseTo(5.5, 6);      // 5500/1000
    // and it actually flows: a silicate body reads rockyCrust ~1
    expect(makeBaseStep(b, grid).drivers.rockyCrust).toBeGreaterThan(0.9);
  });
  it('is pure/deterministic: two runs deep-equal; input not mutated; new nested objects', () => {
    const b1 = adaptL0(planetData); const b2 = adaptL0(planetData);
    expect(b1).toEqual(b2);
    expect(b1.composition).not.toBe(planetData.composition);   // new object -> bundle writes can't reach input
    expect(b1.surfaceHistory).not.toBe(planetData.surfaceHistory);
    expect(() => adaptL0(planetData)).not.toThrow();
  });
  it('systemContext round-trips through JSON; partnerIndex stays positional (number)', () => {
    const b = adaptL0(planetData);
    const round = JSON.parse(JSON.stringify(b.systemContext));
    expect(round).toEqual(b.systemContext);
    expect(typeof b.systemContext.resonancePartners[0].partnerIndex).toBe('number');
  });
  it('CALIBRATION: Earth~=0; all tidal in [0,1); strictly ordered Earth<Io<inner-moon<lava; no collapse', () => {
    const probes = { Earth: 1.74e-3, Io: 1.0, innerMoon: 249, lava: 7.82e5 };
    const cal = (h) => makeBaseStep(adaptL0({ ...planetData, tidalHeating: h }), grid).drivers.tidalHeat;
    const e = cal(probes.Earth), io = cal(probes.Io), im = cal(probes.innerMoon), lv = cal(probes.lava);
    expect(e).toBeLessThan(0.05);                 // Earth ~ 0
    for (const v of [e, io, im, lv]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); } // never exactly 1
    expect(e).toBeLessThan(io); expect(io).toBeLessThan(im); expect(im).toBeLessThan(lv); // strictly ordered
    expect(lv).not.toBe(im); expect(lv).not.toBe(1);          // no collapse to the same clamped extreme
  });
  it('AGE: young vs old differ (not both clamped); ageNorm in [0,1]', () => {
    const young = adaptL0({ ...planetData, age: 0.5 });
    const old = adaptL0({ ...planetData, age: 13.0 });
    expect(young.ageNorm).toBeGreaterThanOrEqual(0); expect(old.ageNorm).toBeLessThanOrEqual(1);
    expect(young.ageNorm).toBeLessThan(old.ageNorm);
    const dy = makeBaseStep(young, grid).drivers.despinAmp;
    const doo = makeBaseStep(old, grid).drivers.despinAmp;
    expect(dy).not.toBeCloseTo(doo, 3);          // despinAmp tracks age, not both saturated
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worldengine-base-adaptl0.test.js`
Expected: FAIL — `adaptL0` is not exported.

- [ ] **Step 3: Write minimal implementation** (append to `src/worldengine/base/adaptL0.js`)

```js
// ── F2 adapter: WS1 planetData -> base-step bundle (pure; never mutates planetData) ──
export function adaptL0(planetData) {
  const p = planetData || {};
  const comp = p.composition || {};
  // density: PhysicsEngine emits kg/m³ (1000..8000); the base step's smoothstep(2.5,3.9,density)
  // expects g/cm³. Convert when it looks like kg/m³ (>100); pass through g/cm³ / default otherwise.
  const rawDensity = comp.density;
  const density = (rawDensity != null && rawDensity > 100)
    ? rawDensity * DENSITY_KGM3_TO_GCM3
    : (rawDensity ?? 5.5);
  return {
    // tidal: PREFER upstream D12 (single-source). undefined => base step recomputes via Io-formula.
    tidalHeat: (p.tidalHeating != null) ? p.tidalHeating : undefined,
    // age (Gyr) -> ageNorm [0,1]
    ageNorm: (p.age != null) ? clamp01(p.age / AGE_NORM_DIVISOR) : undefined,
    // data-only pass-throughs (eccentricity present but UNUSED by heat on the precedence path)
    magneticField: p.magneticField,
    metallicity: p.metallicity,
    eccentricity: p.eccentricity,
    systemContext: p.systemContext,
    // physical fields the base-step derivation reads
    radiusEarth: p.radiusEarth,
    massEarth: p.massEarth,
    T_eq: p.T_eq,
    composition: { ...comp, density },
    surfaceHistory: p.surfaceHistory ? { ...p.surfaceHistory } : undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/worldengine-base-adaptl0.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/worldengine/base/adaptL0.js tests/worldengine-base-adaptl0.test.js
git commit -m "feat(worldengine WS2-F2): adaptL0 key-mapping + tidal/age calibration"
```

---

## Task 4: F2 tidal integration through the real generator

**Files:**
- Test: `tests/worldengine-base-tidal-integration.test.js`
- Depends on: Tasks 2, 3. Uses the REAL `src/generation/` D12 path (three-free, headless-safe).

**Interfaces:**
- Consumes: `adaptL0` (Task 3), `makeBaseStep` (Task 2), real `PlanetGenerator.generate` (static), real `tidalHeatingPlanet` (PhysicsEngine), `SeededRandom`.

**Why this shape:** `PlanetGenerator.generate` computes eccentricity by internal circularization, so reliably producing a *heated* body via the full generator is seed-search-dependent. The faithful + robust test uses the **real full generator** for the temperate control (proving D12 reads ~0 for a distant near-circular body) and the **real D12 kernel** `tidalHeatingPlanet` (the exact function `generate()` calls at PlanetGenerator.js:402) for the heated body. Both are real-generator code paths.

- [ ] **Step 1: Write the failing test**

```js
// tests/worldengine-base-tidal-integration.test.js
import { describe, it, expect } from 'vitest';
import { adaptL0 } from '../src/worldengine/base/adaptL0.js';
import { makeBaseStep } from '../src/worldengine/base/baseStep.js';
import { PlanetGenerator } from '../src/generation/PlanetGenerator.js';
import { tidalHeatingPlanet } from '../src/generation/PhysicsEngine.js';
import { SeededRandom } from '../src/generation/SeededRandom.js';

const grid = { n: 16, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'ti-1' };
const zones = { frostLine: 4.85, hzInner: 0.95, hzOuter: 1.67, starType: 'G',
                metallicity: 0.0, luminosity: 1.0, starMassSolar: 1.0, ageGyr: 4.5,
                hasExotic: false, sizeBias: 0 };

describe('worldengine base — F2 tidal integration (real generator)', () => {
  it('a tidally-heated body produces a larger tidal driver than a near-circular control; control ~= 0', () => {
    // CONTROL: real full generator, distant near-circular orbit -> D12 reads ~0
    const control = PlanetGenerator.generate(new SeededRandom('wd-ctl'), 5.0, null, zones);
    const controlDrive = makeBaseStep(adaptL0(control), grid).drivers.tidalHeat;

    // HEATED: real D12 kernel (the fn generate() calls), retained ecc + close orbit
    const heatedTidal = tidalHeatingPlanet(0.2, zones.starMassSolar, control.radiusEarth, 0.3);
    const heated = { ...control, tidalHeating: heatedTidal };
    const heatedDrive = makeBaseStep(adaptL0(heated), grid).drivers.tidalHeat;

    expect(heatedTidal).toBeGreaterThan(0);
    expect(controlDrive).toBeLessThan(0.05);          // control ~= 0
    expect(heatedDrive).toBeGreaterThan(controlDrive); // heated > control
    expect(heatedDrive).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worldengine-base-tidal-integration.test.js`
Expected: **PASS on first run** — this is a characterization test over already-built Tasks 2+3 (Step 3 adds no new `src/`). To prove the test is load-bearing, transiently negate one assertion (e.g. `toBeLessThan(0.05)` → `toBeGreaterThan(0.05)`), confirm it FAILS, then restore. If it errors on a missing `PlanetGenerator.generate` arg, extend the `zones` fixture (the digest lists every `zones.*` read: `frostLine, metallicity, luminosity, starMassSolar, ageGyr, starType, hzInner, hzOuter, hasExotic, sizeBias`) — do NOT edit `src/generation/`.

- [ ] **Step 3: (no new implementation)** — this AC exercises Tasks 2+3 against the real generator; no `src/worldengine/base/` change. If the test fails on a missing `zones` field, add it to the fixture (do NOT edit `src/generation/`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/worldengine-base-tidal-integration.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/worldengine-base-tidal-integration.test.js
git commit -m "test(worldengine WS2-F2): tidal integration through real generator"
```

---

## Task 5: F4 stress/grain field (oracle + grain determinism)

**Files:**
- Create: `src/worldengine/base/tectonic.js`
- Test: `tests/worldengine-base-tectonic.test.js`
- Depends on: Task 1 (substrate, REGIME, idx, latDegOfRow), Task 2 (makeBaseStep for drivers).

**Interfaces:**
- Consumes: `REGIME`, `idx`, `latDegOfRow` (Task 1), `clamp01` (Task 1).
- Produces: `NU=0.25`, `REGIME_GAIN=0.4`, `REGIME_BAND_DEG=[~38.33,~57.69]`, `GRAIN_BAND_DEG=45`, `SEAM_LAT_TOL_DEG=1.5`, `stressAtLat(latDeg, drivers)→{sMer,sZon,regime,grainAngle}`, `writeGrain(substrate, drivers, rotatePoleDeg=0)→void`. (Task 7 adds `writeGrainSphere`; Task 8 adds `runE6`.)

- [ ] **Step 1: Write the failing test**

```js
// tests/worldengine-base-tectonic.test.js
import { describe, it, expect } from 'vitest';
import { stressAtLat, writeGrain, NU } from '../src/worldengine/base/tectonic.js';
import { makeSubstrate, REGIME, idx } from '../src/worldengine/base/substrate.js';

const neutral = { despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0 };

describe('worldengine base — F4 stress/regime oracle', () => {
  it('regime follows the latitude band oracle at neutral strain', () => {
    expect(stressAtLat(0, neutral).regime).toBe(REGIME.THRUST);     // equator
    expect(stressAtLat(48, neutral).regime).toBe(REGIME.STRIKESLIP);// mid-lat (between 38.4 and 57.3)
    expect(stressAtLat(85, neutral).regime).toBe(REGIME.NORMAL);    // pole
  });
  it('contraction (+1) biases THRUST vs expansion (-1) at fixed latitude', () => {
    const c = stressAtLat(50, { despinAmp: 1, radialStrainSign: +1, radialStrainMag: 0.3 });
    const e = stressAtLat(50, { despinAmp: 1, radialStrainSign: -1, radialStrainMag: 0.3 });
    expect(c.regime).toBeGreaterThanOrEqual(e.regime); // THRUST(2) >= ... toward thrust under contraction
    // whole-field fractions
    const sC = makeSubstrate({ n: 64, lat0Deg: 0, lat1Deg: 90, domainKm: 1 });
    const sE = makeSubstrate({ n: 64, lat0Deg: 0, lat1Deg: 90, domainKm: 1 });
    writeGrain(sC, { despinAmp: 1, radialStrainSign: +1, radialStrainMag: 0.3 });
    writeGrain(sE, { despinAmp: 1, radialStrainSign: -1, radialStrainMag: 0.3 });
    const frac = (s, r) => Array.from(s.regime).filter(v => v === r).length / s.regime.length;
    expect(frac(sC, REGIME.THRUST)).toBeGreaterThan(frac(sE, REGIME.THRUST));
    expect(frac(sE, REGIME.NORMAL)).toBeGreaterThan(frac(sC, REGIME.NORMAL));
  });
});

describe('worldengine base — F4 grain', () => {
  it('grainAngle is quantized 0 / pi/2 per the |sMer|>=|sZon| rule (flips at 45deg)', () => {
    const a = stressAtLat(10, neutral);
    expect(a.grainAngle).toBe(Math.abs(a.sMer) >= Math.abs(a.sZon) ? 0 : Math.PI / 2);
    expect(stressAtLat(30, neutral).grainAngle).toBe(Math.PI / 2); // below 45deg: |sZon| dominates
    expect(stressAtLat(60, neutral).grainAngle).toBe(0);           // above 45deg: |sMer| dominates
  });
  it('grainMag in [0,1] tracking hypot(sMer,sZon)/(1+NU); >=2 distinct regimes per field', () => {
    const s = makeSubstrate({ n: 48, lat0Deg: 0, lat1Deg: 90, domainKm: 1 });
    writeGrain(s, neutral);
    for (let i = 0; i < s.grainMag.length; i++) {
      expect(s.grainMag[i]).toBeGreaterThanOrEqual(0); expect(s.grainMag[i]).toBeLessThanOrEqual(1);
    }
    const distinct = new Set(Array.from(s.regime));
    expect(distinct.size).toBeGreaterThanOrEqual(2);
    // spot-check the formula at one row
    const { sMer, sZon } = stressAtLat(0, neutral);
    expect(s.grainMag[idx(s, 0, 0)]).toBeCloseTo(Math.min(1, Math.hypot(sMer, sZon) / (1 + NU)), 5);
  });
  it('is deterministic: writeGrain twice -> byte-identical arrays', () => {
    const mk = () => { const s = makeSubstrate({ n: 40, lat0Deg: 0, lat1Deg: 80, domainKm: 1 }); writeGrain(s, neutral); return s; };
    const a = mk(), b = mk();
    expect(Array.from(a.grainAngle)).toEqual(Array.from(b.grainAngle));
    expect(Array.from(a.grainMag)).toEqual(Array.from(b.grainMag));
    expect(Array.from(a.regime)).toEqual(Array.from(b.regime));
  });
  it('builds >=2 regimes, quantized grain, bounded grainMag, byte-identical for the 5 presets', async () => {
    const { makeBaseStep } = await import('../src/worldengine/base/baseStep.js');
    const { PRESETS } = await import('../relief-presets.js');
    const grid = { n: 40, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'tec-presets' };
    for (const name of ['rocky', 'lava', 'magma', 'europa', 'terrestrial']) {
      const mk = () => { const o = makeBaseStep(PRESETS[name], grid); writeGrain(o.substrate, o.drivers); return o.substrate; };
      const s1 = mk(), s2 = mk();
      expect(new Set(Array.from(s1.regime)).size).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < s1.grainAngle.length; i++) expect([0, Math.fround(Math.PI / 2)]).toContain(s1.grainAngle[i]); // grainAngle is read back from a Float32Array, so compare against the fround'd pi/2
      for (let i = 0; i < s1.grainMag.length; i++) { expect(s1.grainMag[i]).toBeGreaterThanOrEqual(0); expect(s1.grainMag[i]).toBeLessThanOrEqual(1); }
      expect(Array.from(s1.regime)).toEqual(Array.from(s2.regime));
      expect(Array.from(s1.grainAngle)).toEqual(Array.from(s2.grainAngle));
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worldengine-base-tectonic.test.js`
Expected: FAIL — `tectonic.js` not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/worldengine/base/tectonic.js
// Production port of relief-e6-tectonic.js (stress + build half). Pure stress (stressAtLat/writeGrain);
// runE6 (Task 8) adds seeded simplex. No three.js. nu=0.25, REGIME_GAIN=0.4 LOCKED.
import { REGIME, idx, latDegOfRow } from './substrate.js';

export const NU = 0.25;
const DEG = Math.PI / 180;
export const REGIME_GAIN = 0.4;

// Emergent stress-band boundaries (deg): sMer flips sign at asin(sqrt(1.25/3.25)), sZon at
// asin(sqrt(1.25/1.75)) (the two REGIME boundaries); |sMer|=|sZon| at asin(sqrt(0.5))=45 (grainAngle flip).
export const REGIME_BAND_DEG = [Math.asin(Math.sqrt(1.25 / 3.25)) * 180 / Math.PI,
                                Math.asin(Math.sqrt(1.25 / 1.75)) * 180 / Math.PI];  // ≈ [38.33, 57.69]
export const GRAIN_BAND_DEG = Math.asin(Math.sqrt(0.5)) * 180 / Math.PI;             // 45
export const SEAM_LAT_TOL_DEG = 1.5;  // "same latitude" tol for seam checks (mesh min adj Δlat ≈ 0.63°)

export function stressAtLat(latDeg, drivers) {
  const s2 = Math.sin(latDeg * DEG) ** 2;
  const amp = (drivers.despinAmp ?? 1);
  let sMer = amp * ((1 + NU) - (3 + NU) * s2);
  let sZon = amp * ((1 + NU) - (1 + 3 * NU) * s2);
  const span = amp * (3 + NU);
  const eps = (drivers.radialStrainSign ?? +1) * (drivers.radialStrainMag ?? 0) * span * REGIME_GAIN;
  sMer += eps; sZon += eps;
  let regime;
  if (sMer > 0 && sZon > 0) regime = REGIME.THRUST;
  else if (sMer < 0 && sZon < 0) regime = REGIME.NORMAL;
  else regime = REGIME.STRIKESLIP;
  const grainAngle = Math.abs(sMer) >= Math.abs(sZon) ? 0 : Math.PI / 2;
  return { sMer, sZon, regime, grainAngle };
}

export function writeGrain(substrate, drivers, rotatePoleDeg = 0) {
  const { n } = substrate;
  for (let iy = 0; iy < n; iy++) {
    const lat = latDegOfRow(substrate, iy) + rotatePoleDeg;
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

Run: `npx vitest run tests/worldengine-base-tectonic.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/worldengine/base/tectonic.js tests/worldengine-base-tectonic.test.js
git commit -m "feat(worldengine WS2-F4): stress/grain/regime field (oracle + determinism)"
```

---

## Task 6: F3 sphere field carrier (dependency-injected, three-free)

**Files:**
- Create: `src/worldengine/base/sphereField.js`
- Test: `tests/worldengine-base-sphere.test.js`
- Depends on: Task 1 (REGIME). Test imports `buildIrregularSphere` from `../planet-lod-rivers.js` (three allowed in tests).

**Interfaces:**
- Consumes: a plain `mesh = {verts:[[x,y,z]…], faces:[[a,b,c]…], adj:[[…]…]}` (verts are unit dirs, y-up).
- Produces: `makeSphereField(mesh)→carrier`. `carrier` = `{ N, verts, faces, adj, count, height, grainAngle, grainMag, regime, faultDensity, flowAccum, baseLevel, standing, maturity, nodeDir(i), latDegOf(i), tangentFrameAt(i) }`. Field arrays are typed (same dtypes as substrate), length N, zero-init. `nodeDir(i)→[x,y,z]`; `latDegOf(i)→degrees = asin(clamp(y,-1,1))·180/π`; `tangentFrameAt(i)→{east:[x,y,z], north:[x,y,z]}` (orthonormal off-pole; documented pole fallback east=(1,0,0)).

- [ ] **Step 1: Write the failing test**

```js
// tests/worldengine-base-sphere.test.js
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js'; // three lives here, not in sphereField.js

const TARGET_N = 600, LLOYD = 2;

function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }

describe('worldengine base — F3 sphere carrier', () => {
  it('carrier mesh === the router mesh for matched (targetN, lloydIters)', () => {
    const mesh = buildIrregularSphere(TARGET_N, LLOYD);
    const c = makeSphereField(mesh);
    expect(c.N).toBe(mesh.verts.length);
    expect(c.verts).toBe(mesh.verts);  // same reference -> identical parameterization (no second mesh)
    expect(c.adj.length).toBe(mesh.verts.length);
  });
  it('adjacency is reciprocal, degree ~5-8, zero edge-truncation (seam-free)', () => {
    const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
    let minDeg = 99, maxDeg = 0;
    for (let i = 0; i < c.N; i++) {
      const deg = c.adj[i].length; minDeg = Math.min(minDeg, deg); maxDeg = Math.max(maxDeg, deg);
      expect(deg).toBeGreaterThanOrEqual(4);   // no truncated node
      for (const j of c.adj[i]) expect(c.adj[j].includes(i)).toBe(true); // reciprocal
    }
    expect(minDeg).toBeGreaterThanOrEqual(4); expect(maxDeg).toBeLessThanOrEqual(9);
  });
  it('verts are unit length; latDegOf === asin(y); poles finite', () => {
    const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
    for (let i = 0; i < c.N; i++) {
      expect(len(c.verts[i])).toBeCloseTo(1, 4);
      expect(c.latDegOf(i)).toBeCloseTo(Math.asin(Math.max(-1, Math.min(1, c.verts[i][1]))) * 180 / Math.PI, 4);
      expect(Number.isFinite(c.latDegOf(i))).toBe(true);
    }
  });
  it('tangent frames are orthonormal & tangent off-pole; pole returns a finite fallback', () => {
    const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
    // pick a near-equator node
    let eq = 0; for (let i = 0; i < c.N; i++) if (Math.abs(c.verts[i][1]) < Math.abs(c.verts[eq][1])) eq = i;
    const { east, north } = c.tangentFrameAt(eq);
    expect(len(east)).toBeCloseTo(1, 4); expect(len(north)).toBeCloseTo(1, 4);
    expect(dot(east, north)).toBeCloseTo(0, 4);
    expect(dot(east, c.verts[eq])).toBeCloseTo(0, 4); // tangent
    expect(dot(north, c.verts[eq])).toBeCloseTo(0, 4);
    // pole-most node: frame finite (fallback)
    let pole = 0; for (let i = 0; i < c.N; i++) if (Math.abs(c.verts[i][1]) > Math.abs(c.verts[pole][1])) pole = i;
    const pf = c.tangentFrameAt(pole);
    expect(pf.east.every(Number.isFinite)).toBe(true); expect(pf.north.every(Number.isFinite)).toBe(true);
  });
  it('tangent-frame pole fallback: an exact pole dir [0,1,0] -> east=[1,0,0], finite north', () => {
    const c = makeSphereField({ verts: [[0, 1, 0], [1, 0, 0], [0, 0, 1]], faces: [], adj: [[1, 2], [0, 2], [0, 1]] });
    const f = c.tangentFrameAt(0);
    expect(f.east).toEqual([1, 0, 0]); expect(f.north.every(Number.isFinite)).toBe(true);
  });
  it('two carriers from matched params are byte-identical (deterministic, within engine)', () => {
    const a = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
    const b = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
    expect(a.verts).toEqual(b.verts);
    const sortAdj = (adj) => adj.map(x => [...x].sort((p, q) => p - q));
    expect(sortAdj(a.adj)).toEqual(sortAdj(b.adj));
  });
  it('SEAM CONTINUITY: a smooth global scalar reads continuous across every seam', () => {
    const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
    // f(d) = d.x (Lipschitz constant 1 on the unit sphere w.r.t. chord; per-edge |df|/arc <= 1)
    const f = (d) => d[0];
    let maxRatio = 0;
    for (let i = 0; i < c.N; i++) {
      for (const j of c.adj[i]) {
        const di = c.verts[i], dj = c.verts[j];
        const chord = Math.hypot(di[0]-dj[0], di[1]-dj[1], di[2]-dj[2]);
        const arc = 2 * Math.asin(Math.min(1, chord / 2));
        if (arc > 1e-9) maxRatio = Math.max(maxRatio, Math.abs(f(di) - f(dj)) / arc);
      }
    }
    expect(maxRatio).toBeLessThan(1.05);  // below f's Lipschitz bound (1), small tolerance for discretization
    // all field arrays finite & zero-init
    for (const fld of ['height','grainAngle','grainMag','regime']) expect(c[fld].every(Number.isFinite)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worldengine-base-sphere.test.js`
Expected: FAIL — `sphereField.js` not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/worldengine/base/sphereField.js
// F3: seam-free sphere field carrier. THREE-FREE BY CONSTRUCTION — it consumes a PLAIN mesh
// {verts:[[x,y,z]], faces, adj} built elsewhere (the caller uses buildIrregularSphere, which imports
// three; this module never does). verts are unit dirs, y-up (+y north pole).
const RAD2DEG = 180 / Math.PI;

export function makeSphereField(mesh) {
  const { verts, faces, adj } = mesh;
  const N = verts.length;
  const count = N;
  return {
    N, verts, faces, adj, count,
    height: new Float32Array(count),
    grainAngle: new Float32Array(count),
    grainMag: new Float32Array(count),
    regime: new Uint8Array(count),
    faultDensity: new Float32Array(count),
    flowAccum: new Float32Array(count),
    baseLevel: new Float32Array(count),
    standing: new Uint8Array(count),
    maturity: new Float32Array(count),
    nodeDir(i) { return verts[i]; },
    latDegOf(i) {
      const y = Math.max(-1, Math.min(1, verts[i][1]));
      return Math.asin(y) * RAD2DEG;
    },
    tangentFrameAt(i) {
      const d = verts[i];
      // east = normalize((0,1,0) x d) = normalize((d.z, 0, -d.x))
      let ex = d[2], ey = 0, ez = -d[0];
      const el = Math.hypot(ex, ey, ez);
      if (el < 1e-8) { ex = 1; ey = 0; ez = 0; }       // pole fallback (documented): world-x as east
      else { ex /= el; ey /= el; ez /= el; }
      // north = d x east (orthonormal, toward +y)
      const nx = d[1] * ez - d[2] * ey;
      const ny = d[2] * ex - d[0] * ez;
      const nz = d[0] * ey - d[1] * ex;
      return { east: [ex, ey, ez], north: [nx, ny, nz] };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/worldengine-base-sphere.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/worldengine/base/sphereField.js tests/worldengine-base-sphere.test.js
git commit -m "feat(worldengine WS2-F3): three-free sphere field carrier (DI mesh) + seam continuity"
```

---

## Task 7: F4 seam continuity on the sphere (writeGrainSphere)

**Files:**
- Modify: `src/worldengine/base/tectonic.js` (ADD `writeGrainSphere`)
- Test: `tests/worldengine-base-seam.test.js`
- Depends on: Task 5 (stressAtLat), Task 6 (carrier).

**Interfaces:**
- Consumes: `stressAtLat`, `NU` (Task 5), carrier (Task 6), `buildIrregularSphere` (test only).
- Produces: `writeGrainSphere(carrier, drivers)→void` — writes `carrier.grainAngle/grainMag/regime` per node using `carrier.latDegOf(i)`.

- [ ] **Step 1: Write the failing test**

```js
// tests/worldengine-base-seam.test.js
import { describe, it, expect } from 'vitest';
import { writeGrainSphere, REGIME_BAND_DEG, GRAIN_BAND_DEG, SEAM_LAT_TOL_DEG } from '../src/worldengine/base/tectonic.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { REGIME } from '../src/worldengine/base/substrate.js';

const neutral = { despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0 };
// a band lies strictly between the two |latitudes| -> the field legitimately changes across the pair
const between = (bands, la, lb) => bands.some(b => (Math.abs(la) - b) * (Math.abs(lb) - b) < 0);

describe('worldengine base — F4 seam continuity on sphere', () => {
  it('regime+grainAngle equal for same-latitude seam neighbours, except across a band boundary', () => {
    const c = makeSphereField(buildIrregularSphere(800, 2));
    writeGrainSphere(c, neutral);
    let checked = 0;
    for (let i = 0; i < c.N; i++) {
      const li = c.latDegOf(i);
      for (const j of c.adj[i]) {
        const lj = c.latDegOf(j);
        if (Math.abs(li - lj) >= SEAM_LAT_TOL_DEG) continue;   // only ~equal-latitude seam pairs
        if (!between(REGIME_BAND_DEG, li, lj)) { checked++; expect(c.regime[i]).toBe(c.regime[j]); }
        if (!between([GRAIN_BAND_DEG], li, lj)) { expect(c.grainAngle[i]).toBe(c.grainAngle[j]); }
      }
    }
    expect(checked).toBeGreaterThan(0);   // we actually exercised same-latitude off-band seam pairs
  });
  it('produces >=2 regimes across the full sphere and bounded grainMag', () => {
    const c = makeSphereField(buildIrregularSphere(800, 2));
    writeGrainSphere(c, neutral);
    expect(new Set(Array.from(c.regime)).size).toBeGreaterThanOrEqual(2);
    expect(c.regime[0] === REGIME.THRUST || true).toBe(true); // sanity: enum used
    for (let i = 0; i < c.grainMag.length; i++) {
      expect(c.grainMag[i]).toBeGreaterThanOrEqual(0); expect(c.grainMag[i]).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worldengine-base-seam.test.js`
Expected: FAIL — `writeGrainSphere` not exported.

- [ ] **Step 3: Write minimal implementation** (append to `src/worldengine/base/tectonic.js`)

```js
// sphere-native grain: per-node latitude from the F3 carrier replaces latDegOfRow.
// Because regime/grain are a pure function of latitude, same-latitude seam neighbours agree
// (continuity across the antimeridian + poles holds by construction).
export function writeGrainSphere(carrier, drivers) {
  const N = carrier.N;
  for (let i = 0; i < N; i++) {
    const lat = carrier.latDegOf(i);
    const { sMer, sZon, regime, grainAngle } = stressAtLat(lat, drivers);
    const mag = Math.min(1, Math.hypot(sMer, sZon) / (1 + NU));
    carrier.grainAngle[i] = grainAngle;
    carrier.grainMag[i] = mag;
    carrier.regime[i] = regime;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/worldengine-base-seam.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/worldengine/base/tectonic.js tests/worldengine-base-seam.test.js
git commit -m "feat(worldengine WS2-F4): sphere-native writeGrainSphere + seam continuity"
```

---

## Task 8: F5 interior fields + crust-drives-E6

**Files:**
- Modify: `src/worldengine/base/baseStep.js` (ADD `crustalThickness`, `loveK2`, `thermalState` to `crust`)
- Modify: `src/worldengine/base/tectonic.js` (ADD `runE6` + private helpers)
- Test: `tests/worldengine-base-interior.test.js`
- Depends on: Tasks 2, 5.

**Interfaces:**
- Consumes: `makeBaseStep` crust internals (Task 2), `LOVE_K2_RANGE` (Task 2/3), `clamp01` (Task 1), `REGIME`/`idx` (Task 1).
- Produces: `crust = { shellThickness, thicknessBlob, crustalThickness:Float32Array(n*n), loveK2:number, thermalState:number }`; `runE6(substrate, crust, drivers, epoch={name:'tectonic-build'}, seed='e6')→substrate` (mutates `height`/`faultDensity`; calls `crust.thicknessBlob(ix,iy,n)` — plateau term `Math.max(0, blob-0.55)*1.6`).

- [ ] **Step 1: Write the failing test**

```js
// tests/worldengine-base-interior.test.js
import { describe, it, expect } from 'vitest';
import { makeBaseStep } from '../src/worldengine/base/baseStep.js';
import { runE6 } from '../src/worldengine/base/tectonic.js';
import { makeSubstrate, idx } from '../src/worldengine/base/substrate.js';
import { LOVE_K2_RANGE } from '../src/worldengine/base/adaptL0.js';

const grid = { n: 32, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'f5-1' };

describe('worldengine base — F5 interior fields', () => {
  it('crustalThickness field is finite, in [0,1], and low-frequency for all 5 presets', async () => {
    const { PRESETS } = await import('../relief-presets.js');
    for (const name of ['rocky','lava','magma','europa','terrestrial']) {
      const { crust } = makeBaseStep(PRESETS[name], grid);
      const ct = crust.crustalThickness;
      expect(ct).toBeInstanceOf(Float32Array); expect(ct.length).toBe(32 * 32);
      let maxNeighborDelta = 0;
      for (let iy = 0; iy < 32; iy++) for (let ix = 0; ix < 32; ix++) {
        const v = ct[iy * 32 + ix];
        expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
        if (ix < 31) maxNeighborDelta = Math.max(maxNeighborDelta, Math.abs(v - ct[iy * 32 + ix + 1]));   // horizontal
        if (iy < 31) maxNeighborDelta = Math.max(maxNeighborDelta, Math.abs(v - ct[(iy + 1) * 32 + ix])); // vertical
      }
      expect(maxNeighborDelta).toBeLessThan(0.35); // low-freq: no high-frequency jumps in either axis
    }
  });
  it('interior scalars are bounded against written ranges and physically ordered', () => {
    const young = makeBaseStep({ radiusEarth: 1.2, massEarth: 1.5, ageNorm: 0.05, tidalHeat: 1.0, composition: { density: 5.5 } }, grid);
    const old = makeBaseStep({ radiusEarth: 0.6, massEarth: 0.3, ageNorm: 0.95, tidalHeat: 0, composition: { density: 2.0 } }, grid);
    // shellThickness rises with gravity, falls with age
    expect(young.crust.shellThickness).toBeGreaterThan(old.crust.shellThickness);
    // thermalState(young+heated) > thermalState(old+cold)
    expect(young.crust.thermalState).toBeGreaterThan(old.crust.thermalState);
    expect(young.crust.thermalState).toBeGreaterThanOrEqual(0); expect(young.crust.thermalState).toBeLessThanOrEqual(1);
    // loveK2 within declared [min,max]
    for (const r of [young, old]) {
      expect(r.crust.loveK2).toBeGreaterThanOrEqual(LOVE_K2_RANGE.min);
      expect(r.crust.loveK2).toBeLessThanOrEqual(LOVE_K2_RANGE.max);
    }
    // shellThickness gravity dependence isolated (hold age fixed, vary gravity strongly)
    const hiG = makeBaseStep({ radiusEarth: 1, massEarth: 8, ageNorm: 0.5, composition: { density: 5.5 } }, grid);
    const loG = makeBaseStep({ radiusEarth: 1, massEarth: 0.3, ageNorm: 0.5, composition: { density: 5.5 } }, grid);
    expect(hiG.crust.shellThickness).toBeGreaterThan(loG.crust.shellThickness);
  });
  it('interior fields are deterministic (byte-identical across two builds)', () => {
    const a = makeBaseStep({ radiusEarth: 1, massEarth: 1, ageNorm: 0.4, tidalHeat: 0.3, composition: { density: 5.5 } }, grid);
    const b = makeBaseStep({ radiusEarth: 1, massEarth: 1, ageNorm: 0.4, tidalHeat: 0.3, composition: { density: 5.5 } }, grid);
    expect(Array.from(a.crust.crustalThickness)).toEqual(Array.from(b.crust.crustalThickness));
    expect(a.crust.loveK2).toBe(b.crust.loveK2); expect(a.crust.thermalState).toBe(b.crust.thermalState);
  });
});

describe('worldengine base — F5 crust drives E6 (integration)', () => {
  it('higher crustalThickness -> higher post-E6 plateau height, all else equal', () => {
    const drivers = { despinAmp: 1, radialStrainSign: +1, radialStrainMag: 0, surfaceGravity: 1, rockyCrust: 1,
                      useDiscriminator: false, discriminator: '1:sil' };
    const mk = (thick) => {
      const s = makeSubstrate({ n: 32, lat0Deg: 0, lat1Deg: 10, domainKm: 1 });
      const crust = { shellThickness: 0.5, thicknessBlob: () => thick };  // constant high vs low thickness
      runE6(s, crust, drivers, { name: 'tectonic-build' }, 'e6-fixed');
      let sum = 0; for (let i = 0; i < s.height.length; i++) sum += s.height[i];
      return sum / s.height.length;
    };
    expect(mk(0.95)).toBeGreaterThan(mk(0.40)); // thick crust uplifts (plateau term), thin does not
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worldengine-base-interior.test.js`
Expected: FAIL — `crust.crustalThickness`/`loveK2`/`thermalState` undefined; `runE6` not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/worldengine/base/baseStep.js`: **(a)** EDIT the existing Task-2 import line `import { calibrateTidal } from './adaptL0.js';` → `import { calibrateTidal, LOVE_K2_RANGE } from './adaptL0.js';` (do NOT add a second import line — a duplicate `calibrateTidal` import is a hard ESM SyntaxError that breaks the whole module load). **(b)** Delete the FOUR trailing lines from Task 2 — `const substrate = makeSubstrate(...)` through `return { drivers, crust, substrate };` — and replace them in full with the F5 block below (do NOT keep the Task-2 `const substrate`/`const drivers`/`const crust` lines, or you get duplicate-`const` SyntaxErrors):

```js
  // ── F5 interior proxies (bounded, ordered, written ranges) ──
  const thermalState = clamp01(0.5 * tidalHeat + 0.5 * (1 - ageNorm));   // young+heated high, old+cold low
  const loveK2 = LOVE_K2_RANGE.min + (LOVE_K2_RANGE.max - LOVE_K2_RANGE.min)
    * clamp01(0.25 + 0.55 * thermalState + 0.30 * (1 - rockyCrust) - 0.25 * shellThickness);
  // materialized crustalThickness field (per-texel, [0,1], low-freq) over the flat grid
  const crustalThickness = new Float32Array(n * n);
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
    crustalThickness[iy * n + ix] = thicknessBlob(ix, iy, n);
  }

  const substrate = makeSubstrate({ n, lat0Deg, lat1Deg, domainKm });
  const drivers = { tidalHeat, surfaceGravity, rockyCrust, surfaceHistory, age: ageNorm,
                    radialStrainSign, radialStrainMag, despinAmp,
                    discriminator, useDiscriminator, liquidStability, liquidSpecies, rainFactor };
  const crust = { shellThickness, thicknessBlob, crustalThickness, loveK2, thermalState };
  return { drivers, crust, substrate };
```

In `src/worldengine/base/tectonic.js`, add the import line at top `import { clamp01 } from './mathutil.js';` and `import alea from 'alea'; import { createNoise2D } from 'simplex-noise';`, then append `runE6` + private helpers:

```js
function reliefGravityFactor(g) {
  const f = Math.pow(Math.max(g, 1e-3), -0.5);
  return Math.min(2.5, Math.max(0.4, f));
}
function steeredNoise(noise, x, y, angle, regime, freq, sign = +1) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const contraction = sign >= 0;
  const fScale = contraction ? 0.7 : 1.5;
  const along  = contraction ? 0.25 : 0.55;
  const across = contraction ? 1.9 : 1.2;
  const u = (x * ca + y * sa) * freq * fScale * along;
  const v = (-x * sa + y * ca) * freq * fScale * across;
  const nVal = noise(u, v);
  return regime === REGIME.NORMAL ? Math.abs(nVal) - 0.5 : 0.5 - Math.abs(nVal);
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
      buf[i] = h[i] * 0.5 + (sum / cnt) * 0.5;
    }
    h.set(buf);
  }
}

export function runE6(substrate, crust, drivers, epoch = { name: 'tectonic-build' }, seed = 'e6') {
  const { n } = substrate;
  writeGrain(substrate, drivers, epoch.rotatePoleDeg || 0);
  const disc = (drivers.useDiscriminator && drivers.discriminator) ? ':' + drivers.discriminator : '';
  const rng = alea(String(seed) + ':e6:' + (epoch.name || '') + disc);
  const noise = createNoise2D(rng);
  const noisePlateau = createNoise2D(alea(String(seed) + ':e6plateau' + disc));
  const gCap = reliefGravityFactor(drivers.surfaceGravity ?? 1);
  const silicate = drivers.rockyCrust ?? 1;
  const blend = epoch.blend ?? 1;
  const baseAmp = 0.6 * gCap * (0.3 + 0.7 * silicate);
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const i = iy * n + ix;
      const x = ix / n, y = iy / n;
      let h = steeredNoise(noise, x, y, substrate.grainAngle[i], substrate.regime[i], 9.0,
                           drivers.radialStrainSign ?? +1) * substrate.grainMag[i];
      const blob = crust.thicknessBlob(ix, iy, n);
      const plateau = Math.max(0, blob - 0.55) * 1.6;
      h += plateau * (0.4 + 0.3 * (0.5 + 0.5 * noisePlateau(x * 6, y * 6)));
      substrate.height[i] += baseAmp * h * blend;
      substrate.faultDensity[i] = Math.max(substrate.faultDensity[i], substrate.grainMag[i]);
    }
  }
  jacobiSmooth(substrate, 10);
  return substrate;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/worldengine-base-interior.test.js`
Expected: PASS. Also re-run Task 2's suite to confirm no regression: `npx vitest run tests/worldengine-base-interface.test.js`.

- [ ] **Step 5: Commit**

```bash
git add src/worldengine/base/baseStep.js src/worldengine/base/tectonic.js tests/worldengine-base-interior.test.js
git commit -m "feat(worldengine WS2-F5): interior proxies (crustalThickness/loveK2/thermalState) + runE6 plateau"
```

---

## Task 9: F7 determinism + field verifier gate (THE WS2 GATE)

**Files:**
- Create: `src/worldengine/base/verify.js`
- Test: `tests/worldengine-base-verify.test.js`
- Depends on: Tasks 1–8.

**Interfaces:**
- Consumes: `REGIME` (Task 1).
- Produces: `verify(output)→{ pass, signals:{ finite, bounded, seamConsistent, physicallyOrdered }, detail:string[] }`. `output` is `{drivers, crust, substrate}` (flat) OR a sphere carrier (with `adj`+`latDegOf`). `seamConsistent` is a defined no-op-pass when there is no `adj` (flat first-wave). `detail` names field/index on any failure.

- [ ] **Step 1: Write the failing test**

```js
// tests/worldengine-base-verify.test.js
import { describe, it, expect } from 'vitest';
import { verify } from '../src/worldengine/base/verify.js';
import { makeBaseStep } from '../src/worldengine/base/baseStep.js';
import { writeGrain, writeGrainSphere, runE6, REGIME_BAND_DEG, SEAM_LAT_TOL_DEG } from '../src/worldengine/base/tectonic.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { REGIME } from '../src/worldengine/base/substrate.js';
import { adaptL0 } from '../src/worldengine/base/adaptL0.js';

const grid = { n: 32, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'v-1' };
const neutral = { despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0 };
const between = (bands, la, lb) => bands.some(b => (Math.abs(la) - b) * (Math.abs(lb) - b) < 0);

// WS1 planetData (PhysicsEngine shape: density kg/m³, age Gyr). Its F2-adapter output is a contract-
// named F7 fixture per AC-F7-determinism-gate ("the F2-adapter output PLUS the 5 relief presets").
const adapterPlanetData = Object.freeze({
  radiusEarth: 1.0, massEarth: 1.0, T_eq: 288,
  composition: Object.freeze({ ironFraction: 0.32, density: 5500, volatileFraction: 0.15 }),
  surfaceHistory: Object.freeze({ erosion: 0.4, resurfacing: 0.1, bombardment: 0.5 }),
  age: 4.5, metallicity: 0.0, magneticField: 0.32, eccentricity: 0.05, tidalHeating: 0.7,
  systemContext: Object.freeze({ siblings: [], moons: [], resonancePartners: [], companionClass: null }),
});

async function standardBundles() {
  const { PRESETS } = await import('../relief-presets.js');
  return [
    ...['rocky', 'lava', 'magma', 'europa', 'terrestrial'].map(n => PRESETS[n]),
    adaptL0(adapterPlanetData),   // F2-adapter output — contract-named F7 fixture
  ];
}
function flatOutput(bundle) {
  const o = makeBaseStep(bundle, grid);
  writeGrain(o.substrate, o.drivers);   // populate grain/regime so physicallyOrdered has data
  return o;
}
function sphereOutput() {
  const c = makeSphereField(buildIrregularSphere(800, 2));
  writeGrainSphere(c, neutral);
  return { carrier: c, substrate: c, drivers: neutral, crust: {} };
}

describe('worldengine base — F7 determinism gate', () => {
  it('production base step is byte-identical across two runs for every standard bundle', async () => {
    const run = (bundle) => {
      const o = makeBaseStep(bundle, grid);
      runE6(o.substrate, o.crust, o.drivers, { name: 'tectonic-build' }, grid.seed); // populate the seeded fields
      return o;
    };
    for (const b of await standardBundles()) {
      const a = run(b), c = run(b);
      for (const f of ['height', 'grainAngle', 'grainMag', 'regime', 'faultDensity']) {
        expect(Array.from(a.substrate[f])).toEqual(Array.from(c.substrate[f]));
      }
      expect(Array.from(a.crust.crustalThickness)).toEqual(Array.from(c.crust.crustalThickness));
      for (const k of Object.keys(a.drivers)) expect(a.drivers[k]).toBe(c.drivers[k]);
      expect(a.crust.loveK2).toBe(c.crust.loveK2); expect(a.crust.thermalState).toBe(c.crust.thermalState);
    }
  });
});

describe('worldengine base — F7 verifier gate', () => {
  it('PASSES every standard bundle (flat first-wave): seamConsistent is no-op-pass', async () => {
    for (const b of await standardBundles()) {
      const v = verify(flatOutput(b));
      expect(v.signals.finite).toBe(true); expect(v.signals.bounded).toBe(true);
      expect(v.signals.seamConsistent).toBe(true);   // no adj -> defined no-op pass
      expect(v.signals.physicallyOrdered).toBe(true);
      expect(v.pass).toBe(true);
    }
  });
  it('PASSES a sphere carrier and flags each corruption with the matching signal + detail', () => {
    const good = sphereOutput();
    expect(verify(good).pass).toBe(true);
    // finite: NaN
    const c1 = sphereOutput(); c1.carrier.height[5] = NaN;
    let v = verify(c1); expect(v.signals.finite).toBe(false); expect(v.pass).toBe(false);
    expect(v.detail.join(' ')).toMatch(/finite/);
    // bounded: grainMag out of range
    const c2 = sphereOutput(); c2.carrier.grainMag[7] = 5;
    v = verify(c2); expect(v.signals.bounded).toBe(false); expect(v.pass).toBe(false); expect(v.detail.join(' ')).toMatch(/grainMag/);
    // physicallyOrdered: force poles to THRUST
    const c3 = sphereOutput();
    for (let i = 0; i < c3.carrier.N; i++) if (Math.abs(c3.carrier.latDegOf(i)) > 70) c3.carrier.regime[i] = REGIME.THRUST;
    v = verify(c3); expect(v.signals.physicallyOrdered).toBe(false); expect(v.pass).toBe(false);
    // seamConsistent: inject a regime discontinuity at an OFF-BAND same-latitude seam pair (one the verifier scans)
    const c4 = sphereOutput();
    outer4: for (let i = 0; i < c4.carrier.N; i++) {
      const li = c4.carrier.latDegOf(i);
      for (const j of c4.carrier.adj[i]) {
        const lj = c4.carrier.latDegOf(j);
        if (Math.abs(li - lj) < SEAM_LAT_TOL_DEG && !between(REGIME_BAND_DEG, li, lj)) {
          c4.carrier.regime[j] = (c4.carrier.regime[i] + 1) % 3; break outer4;
        }
      }
    }
    v = verify(c4); expect(v.signals.seamConsistent).toBe(false); expect(v.pass).toBe(false);
    // control still passes after each corruption is its own object
    expect(verify(sphereOutput()).pass).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worldengine-base-verify.test.js`
Expected: FAIL — `verify.js` not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/worldengine/base/verify.js
// F7 GATE: field-level verifier. Pure, no three.js. Accepts {drivers,crust,substrate} (flat) or a
// sphere carrier (with adj + latDegOf). seamConsistent is a defined no-op-pass when there is no adj.
import { REGIME } from './substrate.js';
import { REGIME_BAND_DEG, GRAIN_BAND_DEG, SEAM_LAT_TOL_DEG } from './tectonic.js';

const between = (bands, la, lb) => bands.some(b => (Math.abs(la) - b) * (Math.abs(lb) - b) < 0);

function latOfIndex(sub, i) {
  if (typeof sub.latDegOf === 'function') return sub.latDegOf(i);
  // flat band: row -> latitude
  const n = sub.n; if (!n) return 0;
  const row = Math.floor(i / n);
  const t = n <= 1 ? 0 : row / (n - 1);
  return sub.lat0Deg + (sub.lat1Deg - sub.lat0Deg) * t;
}

export function verify(output) {
  const detail = [];
  const sub = output.carrier || output.substrate || output;
  const drivers = output.drivers || {};
  const crust = output.crust || {};
  const len = sub.regime ? sub.regime.length : (sub.height ? sub.height.length : 0);

  // ── finite ──
  let finite = true;
  for (const name of ['height','grainAngle','grainMag','regime','faultDensity','flowAccum','baseLevel','standing','maturity']) {
    const a = sub[name]; if (!a) continue;
    for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) { finite = false; detail.push(`finite: ${name}[${i}]=${a[i]}`); break; }
  }
  if (crust.crustalThickness) for (let i = 0; i < crust.crustalThickness.length; i++)
    if (!Number.isFinite(crust.crustalThickness[i])) { finite = false; detail.push(`finite: crustalThickness[${i}]`); break; }
  for (const [k, v] of Object.entries(drivers)) if (typeof v === 'number' && !Number.isFinite(v)) { finite = false; detail.push(`finite: drivers.${k}`); }
  for (const k of ['loveK2', 'thermalState', 'shellThickness']) if (typeof crust[k] === 'number' && !Number.isFinite(crust[k])) { finite = false; detail.push(`finite: crust.${k}`); }

  // ── bounded ──
  let bounded = true;
  if (sub.grainMag) for (let i = 0; i < sub.grainMag.length; i++) if (sub.grainMag[i] < 0 || sub.grainMag[i] > 1) { bounded = false; detail.push(`bounded: grainMag[${i}]=${sub.grainMag[i]}`); break; }
  if (sub.regime) for (let i = 0; i < sub.regime.length; i++) { const r = sub.regime[i]; if (r !== 0 && r !== 1 && r !== 2) { bounded = false; detail.push(`bounded: regime[${i}]=${r}`); break; } }
  if (crust.crustalThickness) for (let i = 0; i < crust.crustalThickness.length; i++) { const v = crust.crustalThickness[i]; if (v < 0 || v > 1) { bounded = false; detail.push(`bounded: crustalThickness[${i}]=${v}`); break; } }
  for (const k of ['rockyCrust','radialStrainMag','despinAmp','liquidStability','tidalHeat']) if (drivers[k] != null && (drivers[k] < 0 || drivers[k] > 1)) { bounded = false; detail.push(`bounded: drivers.${k}=${drivers[k]}`); }
  if (drivers.radialStrainSign != null && drivers.radialStrainSign !== 1 && drivers.radialStrainSign !== -1) { bounded = false; detail.push('bounded: radialStrainSign'); }
  if (crust.thermalState != null && (crust.thermalState < 0 || crust.thermalState > 1)) { bounded = false; detail.push('bounded: thermalState'); }

  // ── physicallyOrdered: compression concentrates toward the equator. Equator is THRUST-dominant;
  //    poles are NOT THRUST-dominant. (Contraction-biased fields make poles strike-slip, not normal,
  //    so we check "poles not thrust" rather than "poles normal".) ──
  let physicallyOrdered = true;
  if (sub.regime && len > 0) {
    let eqT = 0, eqC = 0, poT = 0, poC = 0;
    for (let i = 0; i < len; i++) {
      const al = Math.abs(latOfIndex(sub, i));
      if (al < 20) { eqC++; if (sub.regime[i] === REGIME.THRUST) eqT++; }
      else if (al > 70) { poC++; if (sub.regime[i] === REGIME.THRUST) poT++; }
    }
    if (eqC > 0 && poC > 0) {
      const eqFrac = eqT / eqC, poThrustFrac = poT / poC;
      if (!(eqFrac > 0.5 && poThrustFrac < 0.5)) { physicallyOrdered = false; detail.push(`physicallyOrdered: eqThrust=${eqFrac.toFixed(2)} poleThrust=${poThrustFrac.toFixed(2)}`); }
    }
  }

  // ── seamConsistent: same-latitude seam neighbours agree on regime (off REGIME_BAND_DEG) and on
  //    grainAngle (off the 45° GRAIN_BAND_DEG flip). No-op pass when there is no adjacency (flat). ──
  let seamConsistent = true;
  if (sub.adj && sub.regime) {
    outer:
    for (let i = 0; i < len; i++) {
      const li = latOfIndex(sub, i);
      for (const j of sub.adj[i]) {
        const lj = latOfIndex(sub, j);
        if (Math.abs(li - lj) >= SEAM_LAT_TOL_DEG) continue;
        if (!between(REGIME_BAND_DEG, li, lj) && sub.regime[i] !== sub.regime[j]) {
          seamConsistent = false; detail.push(`seamConsistent: regime ${i},${j} at lat~${li.toFixed(1)}`); break outer;
        }
        if (sub.grainAngle && !between([GRAIN_BAND_DEG], li, lj) && sub.grainAngle[i] !== sub.grainAngle[j]) {
          seamConsistent = false; detail.push(`seamConsistent: grain ${i},${j} at lat~${li.toFixed(1)}`); break outer;
        }
      }
    }
  }

  const pass = finite && bounded && seamConsistent && physicallyOrdered;
  return { pass, signals: { finite, bounded, seamConsistent, physicallyOrdered }, detail };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/worldengine-base-verify.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/worldengine/base/verify.js tests/worldengine-base-verify.test.js
git commit -m "feat(worldengine WS2-F7): determinism + field verifier gate"
```

---

## Task 10: VIZ — faithful field paint + interim field-viz page

**Files:**
- Create: `src/worldengine/base/fieldViz.js` (pure paint functions — headless-testable)
- Create: `worldengine-fieldviz.html` (the interim page; reads the production base step; for Max's UAT)
- Test: `tests/worldengine-base-viz.test.js`
- Depends on: Tasks 1–8.

**Interfaces:**
- Consumes: `REGIME` (Task 1), `makeBaseStep`/`writeGrain` (Tasks 2/5), `adaptL0` (Task 3).
- Produces: `REGIME_LEGEND` (regime→[r,g,b]), `regimeColor(regime)→[r,g,b]`, `grainStreak(grainAngle)→{dx,dy}` (unit streak direction), `thicknessHeat(t)→[r,g,b]` (t∈[0,1]), `paintField(output)→{ regimeColors:[[r,g,b]…], streaks:[{dx,dy}…], thicknessColors:[[r,g,b]…] }`. All pure; `paintField` does NOT mutate `output`.

- [ ] **Step 1: Write the failing test**

```js
// tests/worldengine-base-viz.test.js
import { describe, it, expect } from 'vitest';
import { REGIME_LEGEND, regimeColor, grainStreak, thicknessHeat, paintField } from '../src/worldengine/base/fieldViz.js';
import { makeBaseStep } from '../src/worldengine/base/baseStep.js';
import { writeGrain } from '../src/worldengine/base/tectonic.js';
import { REGIME, makeSubstrate, idx } from '../src/worldengine/base/substrate.js';

const grid = { n: 16, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'viz-1' };

describe('worldengine base — VIZ faithful paint', () => {
  it('regime color === the legend color for each regime', () => {
    for (const r of [REGIME.NORMAL, REGIME.STRIKESLIP, REGIME.THRUST]) {
      expect(regimeColor(r)).toEqual(REGIME_LEGEND[r]);
    }
  });
  it('grain streak orientation === grainAngle (validated on a SYNTHETIC continuous-grain substrate)', () => {
    // real E6 grain is quantized {0, pi/2}; test the paint mapping on continuous angles
    for (const ang of [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2]) {
      const { dx, dy } = grainStreak(ang);
      expect(Math.atan2(dy, dx)).toBeCloseTo(ang, 6);
      expect(Math.hypot(dx, dy)).toBeCloseTo(1, 6);
    }
  });
  it('thickness heatmap is bounded and monotone in [0,1]', () => {
    const c0 = thicknessHeat(0), c1 = thicknessHeat(1);
    for (const c of [c0, c1, thicknessHeat(0.5)]) for (const ch of c) { expect(ch).toBeGreaterThanOrEqual(0); expect(ch).toBeLessThanOrEqual(255); }
    expect(c0).not.toEqual(c1);
    expect(thicknessHeat(1)[0]).toBeGreaterThan(thicknessHeat(0)[0]); // brighter red channel with thickness
  });
  it('paintField paints from source fields and is read-only (no perturbation)', () => {
    const out = makeBaseStep({ radiusEarth: 1, massEarth: 1, composition: { density: 5.5 } }, grid);
    writeGrain(out.substrate, out.drivers);
    const before = Array.from(out.substrate.regime);
    const painted = paintField(out);
    expect(painted.regimeColors.length).toBe(out.substrate.regime.length);
    // per-node fidelity: painted regime color === legend[regime[i]]
    for (let i = 0; i < out.substrate.regime.length; i++) {
      expect(painted.regimeColors[i]).toEqual(REGIME_LEGEND[out.substrate.regime[i]]);
    }
    // thickness colors === thicknessHeat(crustalThickness[i])
    for (let i = 0; i < out.crust.crustalThickness.length; i++) {
      expect(painted.thicknessColors[i]).toEqual(thicknessHeat(out.crust.crustalThickness[i]));
    }
    expect(Array.from(out.substrate.regime)).toEqual(before); // read-only
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worldengine-base-viz.test.js`
Expected: FAIL — `fieldViz.js` not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/worldengine/base/fieldViz.js
// Interim field-viz paint functions (pure; headless-testable). The page (worldengine-fieldviz.html)
// renders these onto a 2D canvas; this module decides nothing about the base step (read-only).
import { REGIME } from './substrate.js';

// regime legend: NORMAL=blue (extension), STRIKESLIP=green (shear), THRUST=red (compression)
export const REGIME_LEGEND = {
  [REGIME.NORMAL]: [60, 120, 220],
  [REGIME.STRIKESLIP]: [60, 190, 90],
  [REGIME.THRUST]: [210, 70, 60],
};
export function regimeColor(regime) { return REGIME_LEGEND[regime] || [128, 128, 128]; }

// grain streak: unit direction at the grain angle (radians). atan2(dy,dx) === angle.
export function grainStreak(grainAngle) { return { dx: Math.cos(grainAngle), dy: Math.sin(grainAngle) }; }

// thickness heatmap: dark (thin) -> bright warm (thick), bounded 0..255 per channel.
export function thicknessHeat(t) {
  const x = Math.max(0, Math.min(1, t));
  return [Math.round(40 + 215 * x), Math.round(30 + 160 * x), Math.round(60 * (1 - x))];
}

export function paintField(output) {
  const sub = output.carrier || output.substrate;
  const crust = output.crust || {};
  const N = sub.regime.length;
  const regimeColors = new Array(N), streaks = new Array(N), thicknessColors = new Array(N);
  const ct = crust.crustalThickness;
  for (let i = 0; i < N; i++) {
    regimeColors[i] = regimeColor(sub.regime[i]);
    streaks[i] = grainStreak(sub.grainAngle[i]);
    thicknessColors[i] = thicknessHeat(ct ? ct[i] : 0);
  }
  return { regimeColors, streaks, thicknessColors };
}
```

```html
<!-- worldengine-fieldviz.html — interim field-viz: SEE the L0->L1 layer (Max UAT). Read-only. -->
<!-- Run via the existing vite dev server at base /well-dipper/ on :5173; open /worldengine-fieldviz.html -->
<!doctype html><html><head><meta charset="utf-8"><title>World-Engine — field viz (WS2)</title>
<style>body{background:#111;color:#ddd;font:13px system-ui;margin:0;padding:12px}
canvas{image-rendering:pixelated;border:1px solid #333;margin-right:8px}
select,label{font:13px system-ui} .row{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}
.legend span{display:inline-block;width:12px;height:12px;margin:0 4px -2px 8px}</style></head>
<body>
<h3>World-Engine WS2 — derived field viz <small>(read-only; reads <code>src/worldengine/base</code> production output)</small></h3>
<div>
  <label>Preset:
    <select id="preset">
      <option>rocky</option><option>lava</option><option>magma</option>
      <option>europa</option><option>terrestrial</option>
    </select>
  </label>
  <span class="legend">regime:<span style="background:#d2463c"></span>thrust
    <span style="background:#3cbe5a"></span>strike-slip<span style="background:#3c78dc"></span>normal</span>
</div>
<div class="row" style="margin-top:10px">
  <div><div>regime + grain</div><canvas id="cRegime" width="256" height="256"></canvas></div>
  <div><div>crustal thickness</div><canvas id="cThick" width="256" height="256"></canvas></div>
</div>
<script type="module">
import { makeBaseStep } from './src/worldengine/base/baseStep.js';
import { writeGrain } from './src/worldengine/base/tectonic.js';
import { paintField, REGIME_LEGEND } from './src/worldengine/base/fieldViz.js';
import { PRESETS } from './relief-presets.js';
const N = 128, grid = { n: N, lat0Deg: -80, lat1Deg: 80, domainKm: 8000, seed: 'fieldviz' };
const cR = document.getElementById('cRegime'), cT = document.getElementById('cThick');
const xR = cR.getContext('2d'), xT = cT.getContext('2d');
function draw(name) {
  const out = makeBaseStep(PRESETS[name], grid);
  writeGrain(out.substrate, out.drivers);
  const p = paintField(out);
  const sc = 256 / N;
  // regime field
  const img = xR.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { const c = p.regimeColors[i]; img.data[i*4]=c[0]; img.data[i*4+1]=c[1]; img.data[i*4+2]=c[2]; img.data[i*4+3]=255; }
  // upscale via temp canvas
  const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; tmp.getContext('2d').putImageData(img, 0, 0);
  xR.imageSmoothingEnabled = false; xR.clearRect(0,0,256,256); xR.drawImage(tmp, 0, 0, 256, 256);
  // grain streaks (subsample)
  xR.strokeStyle = 'rgba(255,255,255,0.5)';
  for (let iy = 2; iy < N; iy += 6) for (let ix = 2; ix < N; ix += 6) {
    const s = p.streaks[iy*N+ix], cx = (ix+0.5)*sc, cy = (iy+0.5)*sc, L = 4;
    xR.beginPath(); xR.moveTo(cx - s.dx*L, cy - s.dy*L); xR.lineTo(cx + s.dx*L, cy + s.dy*L); xR.stroke();
  }
  // thickness
  const it = xT.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { const c = p.thicknessColors[i]; it.data[i*4]=c[0]; it.data[i*4+1]=c[1]; it.data[i*4+2]=c[2]; it.data[i*4+3]=255; }
  const tt = document.createElement('canvas'); tt.width=N; tt.height=N; tt.getContext('2d').putImageData(it,0,0);
  xT.imageSmoothingEnabled = false; xT.clearRect(0,0,256,256); xT.drawImage(tt, 0, 0, 256, 256);
  window.__wefv = { out, painted: p };  // for live verification
}
document.getElementById('preset').addEventListener('change', e => draw(e.target.value));
draw('rocky');
</script>
</body></html>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/worldengine-base-viz.test.js`
Expected: PASS. (The HTML page is verified live by Max at UAT — `AC-VIZ-distinct` is `deferred-to-max`, never agent-PASSed.)

- [ ] **Step 5: Commit**

```bash
git add src/worldengine/base/fieldViz.js worldengine-fieldviz.html tests/worldengine-base-viz.test.js
git commit -m "feat(worldengine WS2-VIZ): faithful field paint + interim field-viz page"
```

---

## Final verification (after all tasks)

- [ ] Run the whole WS2 suite scoped: `npx vitest run tests/worldengine-base-*.test.js` — all green.
- [ ] Confirm the lab reference suite is untouched/green: `npx vitest run tests/world-engine-relief-slice.test.js`.
- [ ] Confirm no edits leaked into `src/generation/` or `relief-*.js`: `git diff --stat 84890ae -- src/generation relief-substrate.js relief-base-step.js relief-e6-tectonic.js relief-presets.js relief-slice.js planet-lod-rivers.js planet-lod-lab-core.js` → empty.
- [ ] Run the `verify-workstream` workflow against the contract (see handoff invocation; `diffRef:"84890ae"`, `mode:"full"`).

## Self-Review (run by the author before execution)

**Spec coverage (16 ACs → tasks):**
- AC-F1-base-step-interface → Task 1 (substrate) + Task 2 (drivers/crust stub) ✓
- AC-F1-tidal-precedence → Task 2 ✓
- AC-F2-key-mapping-pure → Task 3 ✓
- AC-F2-tidal-age-calibration → Task 3 ✓
- AC-F2-tidal-integration → Task 4 ✓
- AC-F3-sphere-carrier → Task 6 ✓
- AC-F3-seam-continuity → Task 6 ✓
- AC-F4-stress-regime-oracle → Task 5 ✓
- AC-F4-grain-deterministic → Task 5 ✓
- AC-F4-seam-continuity → Task 7 ✓
- AC-F5-interior-fields → Task 8 ✓
- AC-F5-crust-drives-e6 → Task 8 ✓
- AC-F7-determinism-gate → Task 9 ✓
- AC-F7-verifier-gate → Task 9 ✓
- AC-VIZ-faithful → Task 10 ✓
- AC-VIZ-distinct → Task 10 page (UAT, deferred-to-max — never agent-PASSed) ✓

**Type consistency:** `drivers` field set identical in Tasks 2 & 8 (Task 8 re-emits the same 13-key object verbatim plus the F5 crust additions). `crust` shape: Task 2 ships `{shellThickness, thicknessBlob}`, Task 8 extends to `{…, crustalThickness, loveK2, thermalState}` — the interface block flags this. `writeGrain`/`writeGrainSphere`/`runE6` signatures consistent across Tasks 5/7/8. `verify` accepts both flat `substrate` and sphere `carrier` via `output.carrier || output.substrate`.

**Known risks flagged inline:** (1) F3 three-purity → DI mesh (Global Constraints + Task 6). (2) Tidal Io-anchor knee → tunable constant, AC asserts properties only (Task 3 + Global Constraints). (3) AC-F2-tidal-integration uses the real D12 kernel for the heated case (documented why in Task 4). (4) E9/divergence files are NOT needed by any WS2 AC (no carve AC) — confirmed out of scope.
