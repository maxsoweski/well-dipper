# World-Engine Body-Type Divergence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the relief-lab body presets produce **categorically different worlds** at one master seed by routing physics drivers into the FIELD generation (regime, geometry, seed, liquid gate) — not by post-scaling amplitude — proven by a held-seed, reseed-invariant divergence gate.

**Architecture:** Five strictly-sequential generative layers stacked on the existing isolated relief slice (`relief-*.js` + harness + test file), each changing ONE lever with the others held off, each with a TDD gate metric. A new `relief-divergence.js` measuring instrument is built FIRST so every layer has a numeric gate. The renderer is **untouched and preset-blind by construction**; zero production edits (formulas are copied + cited, never imported).

**Tech Stack:** ES modules, `alea` (seeded PRNG), `simplex-noise` (`createNoise2D`), `vitest`. Pure compute (no three.js in the engine modules).

## Global Constraints

- **Isolated lab only.** Edit ONLY: `relief-base-step.js`, `relief-e6-tectonic.js`, `relief-e9-hydrology.js`, `relief-presets.js`, `relief-slice.js`, new `relief-divergence.js`, `tests/world-engine-relief-slice.test.js`, `world-engine-relief-lab.main.js`. **No production edits** (`planet-lod-lab-core.js`, `src/generation/*` are READ/COPY-only — never imported, never modified). Renderer stays preset-blind.
- **Additive on `master`.** Stage EXPLICIT paths only — **NEVER `git add -A`** (tree has loose `.png/.webm/.html` + warp WIP). A file literally named `HEAD` exists in repo root → never `git show HEAD`; use `git log --oneline -1`.
- **Push is on HOLD** — never `git push` without Max's say-so.
- **record-build-intent:** every module created/edited carries/keeps a `Function: / Intent: / Deliberate non-goals:` header. Update the header when a layer changes the module's behavior.
- **TO-BE-TUNED-then-locked constants** (`REGIME_GAIN`, divergence thresholds, terrestrial-bundle numbers): gate TESTS assert **relative/ordering** behavior (divergence > null baseline), which is tuning-robust. Absolute thresholds are locked in Task 7 after observing values, validated against an identical-bundle null run (~0) and a reseed-only floor.
- **The decisive gate (spec §5 metric 4, hardened):** host-field divergence is the **reseed-invariant hypsometric (z-scored Wasserstein-1) distance at a HELD seed** (Layer-3 discriminator OFF), so Layer 1 regime + Layer 2 geometry must carry it. Corroborated by the regime-class histogram for **cross-regime pairs only**. Per-cell RMS is **diagnostic, never the gate**. Same-regime pairs (europa vs lava) are distinguished by the carve axis, not the field.
- **Commit at each task seam** with a good message; do not push.
- **Test command:** `npx vitest run tests/world-engine-relief-slice.test.js` (append `-t "<name>"` to target one test).

---

### Task 1: Divergence measuring instrument (`relief-divergence.js`)

Build the numeric gate primitives FIRST — pure functions on arrays, TDD on synthetic inputs — so Layers 1–5 each have a gate metric. Amplitude-invariant by design: each field is z-scored before distribution/per-cell comparison, so a pure amplitude rescale (the OLD coat-swap) scores ~0 while a distribution-shape change (regime/geometry) scores positive.

**Files:**
- Create: `relief-divergence.js`
- Test: `tests/world-engine-relief-slice.test.js` (append a new `describe('divergence metrics')` block)

**Interfaces:**
- Produces:
  - `zscore(arr) -> Float64Array` (mean 0, std 1; std 0 → all zeros)
  - `hypsometricDistance(hA, hB) -> number` (z-scored Wasserstein-1; reseed- & amplitude-invariant; the LOAD-BEARING component)
  - `perCellRMS(hA, hB) -> number` (z-scored per-cell RMS; reseed-SENSITIVE; diagnostic only)
  - `regimeHistogramDistance(regA, regB) -> number` (total-variation distance over REGIME classes; reseed-invariant)
  - `carveFraction(incision, eps=1e-4) -> number` (fraction of cells with incision < -eps)
  - `channelFraction(flowAccum, pct=0.9) -> number` (fraction of cells with flowAccum above its `pct` percentile)

- [ ] **Step 1: Write failing tests**

```js
// append to tests/world-engine-relief-slice.test.js
import {
  zscore, hypsometricDistance, perCellRMS, regimeHistogramDistance,
  carveFraction, channelFraction,
} from '../relief-divergence.js';

describe('divergence metrics', () => {
  it('zscore yields mean ~0 and std ~1', () => {
    const z = zscore(Float32Array.from([1, 2, 3, 4, 5]));
    const mean = z.reduce((a, b) => a + b, 0) / z.length;
    const std = Math.sqrt(z.reduce((a, b) => a + b * b, 0) / z.length);
    expect(mean).toBeCloseTo(0, 6);
    expect(std).toBeCloseTo(1, 6);
  });
  it('hypsometricDistance ~0 for a pure amplitude rescale (the OLD coat-swap reads as no divergence)', () => {
    const a = Float32Array.from({ length: 400 }, (_, i) => Math.sin(i * 0.3));
    const b = Float32Array.from(a, (v) => v * 7.5);          // same shape, 7.5x amplitude
    expect(hypsometricDistance(a, b)).toBeLessThan(1e-6);
  });
  it('hypsometricDistance > 0 when the DISTRIBUTION SHAPE differs (skewed vs symmetric)', () => {
    const sym  = Float32Array.from({ length: 400 }, (_, i) => Math.sin(i * 0.3));            // ~symmetric
    const skew = Float32Array.from({ length: 400 }, (_, i) => Math.pow(Math.abs(Math.sin(i * 0.3)), 3)); // skewed
    expect(hypsometricDistance(sym, skew)).toBeGreaterThan(0.05);
  });
  it('perCellRMS is large for a reshuffle even when the distribution is identical', () => {
    const a = Float32Array.from({ length: 400 }, (_, i) => Math.sin(i * 0.3));
    const b = Float32Array.from(a).reverse();                // same multiset, different arrangement
    expect(hypsometricDistance(a, b)).toBeLessThan(0.05);    // distribution ~unchanged
    expect(perCellRMS(a, b)).toBeGreaterThan(0.5);           // but per-cell saturates (reseed-sensitive)
  });
  it('regimeHistogramDistance is 0 for identical class mixes, positive when classes shift', () => {
    const a = Uint8Array.from([0, 0, 1, 2]);
    const b = Uint8Array.from([0, 0, 1, 2]);
    const c = Uint8Array.from([2, 2, 2, 2]);
    expect(regimeHistogramDistance(a, b)).toBeCloseTo(0, 6);
    expect(regimeHistogramDistance(a, c)).toBeGreaterThan(0.4);
  });
  it('carveFraction counts incised cells', () => {
    expect(carveFraction(Float32Array.from([0, -0.01, -1e-9, -0.5]))).toBeCloseTo(0.5, 6);
  });
  it('channelFraction is in (0,1)', () => {
    const acc = Float32Array.from({ length: 100 }, (_, i) => i);
    const f = channelFraction(acc, 0.9);
    expect(f).toBeGreaterThan(0); expect(f).toBeLessThan(0.2);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "divergence metrics"`
Expected: FAIL — `Failed to resolve import '../relief-divergence.js'`.

- [ ] **Step 3: Implement `relief-divergence.js`**

```js
// relief-divergence.js — divergence measuring instrument for body-type divergence. Pure: no three.js.
// ── BUILD INTENT (record-build-intent) ──
// Function: numeric metrics that decide whether two body bundles produce categorically different worlds.
//   z-scoring makes every metric amplitude-invariant, so a pure amplitude rescale (the original coat-swap)
//   scores ~0; only distribution-SHAPE / arrangement / regime / carve differences score positive.
// Intent: provide the per-layer TDD gate AND the decisive §5 gate. hypsometricDistance is the LOAD-BEARING,
//   reseed-INVARIANT component (held-seed gate); perCellRMS is reseed-SENSITIVE and DIAGNOSTIC ONLY.
// Deliberate non-goals: not a renderer; not preset-aware; does not run the slice (orchestration lives in
//   relief-slice.js divergenceReport). It only measures arrays handed to it.
import { REGIME } from './relief-substrate.js';

export function zscore(arr) {
  const n = arr.length, out = new Float64Array(n);
  let mean = 0; for (let i = 0; i < n; i++) mean += arr[i]; mean /= n || 1;
  let v = 0; for (let i = 0; i < n; i++) { const d = arr[i] - mean; v += d * d; } v /= n || 1;
  const std = Math.sqrt(v);
  if (std < 1e-12) return out;                       // flat field → all zeros (no divergence by amplitude)
  for (let i = 0; i < n; i++) out[i] = (arr[i] - mean) / std;
  return out;
}

// Wasserstein-1 on z-scored 1D samples = mean |sortedA - sortedB|. Reseed- AND amplitude-invariant:
// only the SHAPE of the height distribution moves it (skew/modality), i.e. a real regime/geometry change.
export function hypsometricDistance(hA, hB) {
  const a = Array.from(zscore(hA)).sort((x, y) => x - y);
  const b = Array.from(zscore(hB)).sort((x, y) => x - y);
  const n = Math.min(a.length, b.length);
  let s = 0; for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
  return s / (n || 1);
}

// Per-cell RMS on z-scored fields. Reseed-SENSITIVE (a reshuffle/reseed saturates it). DIAGNOSTIC ONLY —
// must NOT certify the decisive gate.
export function perCellRMS(hA, hB) {
  const a = zscore(hA), b = zscore(hB);
  const n = Math.min(a.length, b.length);
  let s = 0; for (let i = 0; i < n; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s / (n || 1));
}

// Total-variation distance over the three Anderson regime classes. Reseed-invariant (regime is
// latitude+sign driven). 0 = identical class mix; up to 1 = disjoint.
export function regimeHistogramDistance(regA, regB) {
  const hist = (r) => { const h = [0, 0, 0]; for (let i = 0; i < r.length; i++) h[r[i]]++;
    for (let k = 0; k < 3; k++) h[k] /= r.length || 1; return h; };
  const a = hist(regA), b = hist(regB);
  let s = 0; for (let k = 0; k < 3; k++) s += Math.abs(a[k] - b[k]);
  return 0.5 * s;
}

export function carveFraction(incision, eps = 1e-4) {
  let c = 0; for (let i = 0; i < incision.length; i++) if (incision[i] < -eps) c++;
  return c / (incision.length || 1);
}

export function channelFraction(flowAccum, pct = 0.9) {
  const sorted = Float32Array.from(flowAccum).sort();
  const thr = sorted[Math.floor(pct * (sorted.length - 1))];
  let c = 0; for (let i = 0; i < flowAccum.length; i++) if (flowAccum[i] > thr) c++;
  return c / (flowAccum.length || 1);
}
```
(`REGIME` import is kept for readability/intent even though the histogram indexes 0–2 directly.)

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "divergence metrics"`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add relief-divergence.js tests/world-engine-relief-slice.test.js
git commit -m "feat(relief): divergence measuring instrument (held-seed gate primitives)"
```

---

### Task 2: Layer 1 — un-damp strain so the tectonic REGIME flips

One lever (strain magnitude → regime), produce-site + consume-site of the same scalar. Drop the `* 0.001` damping; re-base `eps` onto the despin span via a tunable `REGIME_GAIN` so strain SHIFTS regime bands without saturating.

**Files:**
- Modify: `relief-base-step.js:38` (un-damp `radialStrainMag`)
- Modify: `relief-e6-tectonic.js` (`stressAtLat`, currently the `eps` line :21; add `REGIME_GAIN`)
- Test: `tests/world-engine-relief-slice.test.js` (append `describe('Layer 1 — regime un-damp')`)

**Interfaces:**
- Consumes: `makeBaseStep`, `runReliefSlice` (existing), `regimeHistogramDistance` (Task 1).
- Produces: `drivers.radialStrainMag` now in 0..1 (was ≤0.001); `REGIME_GAIN` const in `relief-e6-tectonic.js`.

- [ ] **Step 1: Write the failing gate test (relative — tuning-robust)**

```js
// append to tests/world-engine-relief-slice.test.js
import { runReliefSlice as runRS_L1 } from '../relief-slice.js';
import { PRESETS as P_L1 } from '../relief-presets.js';
import { makeBaseStep as mkBase_L1 } from '../relief-base-step.js';
import { regimeHistogramDistance as regDist_L1 } from '../relief-divergence.js';

describe('Layer 1 — regime un-damp', () => {
  const grid = { n: 96, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'L1' };
  it('radialStrainMag is no longer damped to inertness (>> 0.001)', () => {
    const { drivers } = mkBase_L1(P_L1.rocky, grid);
    expect(Math.abs(drivers.radialStrainMag)).toBeGreaterThan(0.05);
  });
  it('a contraction body (rocky, +1) and an extension body (europa, -1) diverge in regime mix', () => {
    const rocky  = runRS_L1(P_L1.rocky,  { ...grid, epoch2: false });
    const europa = runRS_L1(P_L1.europa, { ...grid, epoch2: false });
    // GATE METRIC (relative): cross-regime pair must differ in regime-class mix...
    const cross = regDist_L1(rocky.substrate.regime, europa.substrate.regime);
    // ...far more than the null baseline (same bundle vs itself = 0).
    const nullA = regDist_L1(rocky.substrate.regime, rocky.substrate.regime);
    expect(cross).toBeGreaterThan(0.1);
    expect(cross).toBeGreaterThan(nullA + 0.1);
  });
  it('rocky leans THRUST (compression) vs europa leans NORMAL (extension)', () => {
    const rocky  = runRS_L1(P_L1.rocky,  { ...grid, epoch2: false });
    const europa = runRS_L1(P_L1.europa, { ...grid, epoch2: false });
    const frac = (reg, k) => Array.from(reg).filter((r) => r === k).length / reg.length;
    expect(frac(rocky.substrate.regime, 2)).toBeGreaterThan(frac(europa.substrate.regime, 2));  // THRUST=2
    expect(frac(europa.substrate.regime, 0)).toBeGreaterThan(frac(rocky.substrate.regime, 0));  // NORMAL=0
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "Layer 1"`
Expected: FAIL — `radialStrainMag` is `≤0.001` (damped) so the regime mix barely differs across bundles.

- [ ] **Step 3: Un-damp the magnitude in `relief-base-step.js`**

Replace the `radialStrainMag` line (currently `relief-base-step.js:38`):
```js
  // L1: un-damped strain magnitude (0..1). Was capped *0.001 (regime-inert, the coat-swap). The
  // despin-span re-basing in relief-e6-tectonic.js keeps it band-SHIFTING, not saturating.
  const radialStrainMag = clamp01(Math.abs(contractionDrive - expansionDrive));
```

- [ ] **Step 4: Re-base `eps` on the despin span in `relief-e6-tectonic.js`**

Add the constant near the top (below `const NU = 0.25;`):
```js
// L1: regime gain — eps as a fraction of the despin stress span. ≤ ~0.8 SHIFTS regime bands per body
// without collapsing all bands into one regime. TO-BE-TUNED-IN-LAB-then-locked (Task 7).
const REGIME_GAIN = 0.6;
```
Replace the `eps` line in `stressAtLat` (currently :21):
```js
  // eps bounded to a fraction of the despin span → regime-relevant by construction (biases WHICH bands
  // are scarps vs grabens, never saturates). span = despin sMer range ≈ amp*(3+NU).
  const span = amp * (3 + NU);
  const eps = (drivers.radialStrainSign ?? +1) * (drivers.radialStrainMag ?? 0) * span * REGIME_GAIN;
```

- [ ] **Step 5: Update the `relief-presets.js` BUILD-INTENT non-goal about damping**

In `relief-presets.js`, change the now-false non-goal bullet (currently ~line 20–21, "The one qualitative lever — radialStrainSign … is damped … never flips the regime"):
```js
//   • radialStrainSign (contraction→scarps vs expansion→grabens) is now UN-DAMPED (Layer 1): it flips the
//     Anderson regime per body (rocky→THRUST-leaning; icy/molten→NORMAL-leaning). Regime divergence is live.
```

- [ ] **Step 6: Run the Layer-1 gate + the full suite (no regressions)**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "Layer 1"` → Expected: PASS (3 tests).
Run: `npx vitest run tests/world-engine-relief-slice.test.js` → Expected: PASS (whole file). If the pre-existing `contraction sign biases toward thrust` E6 test now behaves differently, confirm it still passes (it uses explicit drivers, unaffected by the base-step un-damp).

- [ ] **Step 7: Commit**

```bash
git add relief-base-step.js relief-e6-tectonic.js relief-presets.js tests/world-engine-relief-slice.test.js
git commit -m "feat(relief L1): un-damp strain so tectonic regime flips per body"
```

---

### Task 3: Layer 2 — branch steered-noise FREQUENCY / ANISOTROPY by regime

One lever: the spatial geometry of the steered noise. Contraction → long, low-frequency scarp lineaments; extension → blockier, higher-frequency graben fields. This is the first lever expected to move the **held-seed hypsometric** metric off the reseed floor.

**Files:**
- Modify: `relief-e6-tectonic.js` (`steeredNoise` :61-67 and the `9.0` base freq passed at :85)
- Test: `tests/world-engine-relief-slice.test.js` (append `describe('Layer 2 — geometry branch')`)

**Interfaces:**
- Consumes: `runReliefSlice`, `hypsometricDistance`, `perCellRMS` (Task 1).
- Produces: `steeredNoise(noise, x, y, angle, regime, freq, sign)` — new `sign` arg drives freq/anisotropy branch.

- [ ] **Step 1: Write the failing gate test (held-seed hypsometric, relative)**

```js
// append to tests/world-engine-relief-slice.test.js
import { runReliefSlice as runRS_L2 } from '../relief-slice.js';
import { PRESETS as P_L2 } from '../relief-presets.js';
import { hypsometricDistance as hypso_L2, perCellRMS as rms_L2 } from '../relief-divergence.js';

describe('Layer 2 — geometry branch', () => {
  const grid = { n: 96, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'L2' };
  it('held-seed hypsometric divergence of a cross-regime pair clears the reseed floor', () => {
    // E9 OFF, SAME seed for both → only L1 regime + L2 geometry can move the field.
    const rocky  = runRS_L2(P_L2.rocky,  { ...grid, epoch2: false });
    const europa = runRS_L2(P_L2.europa, { ...grid, epoch2: false });
    const cross = hypso_L2(rocky.substrate.height, europa.substrate.height);
    // reseed floor: SAME bundle, DIFFERENT seed (a reshuffle of the same world).
    const a1 = runRS_L2(P_L2.rocky, { ...grid, seed: 'L2a', epoch2: false });
    const a2 = runRS_L2(P_L2.rocky, { ...grid, seed: 'L2b', epoch2: false });
    const floor = hypso_L2(a1.substrate.height, a2.substrate.height);
    expect(cross).toBeGreaterThan(floor);                  // physics beats a mere reseed
    expect(cross).toBeGreaterThan(0.02);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "Layer 2"`
Expected: FAIL — pre-L2 the steered geometry is regime-blind, so the cross-regime hypsometric distance does not reliably beat the reseed floor.

- [ ] **Step 3: Branch `steeredNoise` geometry by sign/regime in `relief-e6-tectonic.js`**

Replace `steeredNoise` (currently :61-67):
```js
// Anisotropic steered noise. L2: regime/sign branches the spatial GEOMETRY —
//   contraction (sign +1): LOW base freq + HIGH along-strike elongation → long parallel scarp ridges (F5).
//   extension  (sign -1): HIGHER base freq + blockier aspect → graben spacing / horst-and-graben (F4/F5).
// All ratio constants TO-BE-TUNED-IN-LAB-then-locked (Task 7).
function steeredNoise(noise, x, y, angle, regime, freq, sign = +1) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const contraction = sign >= 0;
  const fScale  = contraction ? 0.7 : 1.5;          // contraction = lower freq (longer lineaments)
  const along   = contraction ? 0.25 : 0.55;        // contraction = more elongated along strike
  const across  = contraction ? 1.9 : 1.2;          // contraction = tighter across strike (sharp ridges)
  const u = (x * ca + y * sa) * freq * fScale * along;
  const v = (-x * sa + y * ca) * freq * fScale * across;
  const nVal = noise(u, v);
  return regime === REGIME.NORMAL ? Math.abs(nVal) - 0.5 : 0.5 - Math.abs(nVal); // ridges vs grabens
}
```

- [ ] **Step 4: Pass `sign` into `steeredNoise` from `runE6`**

In `runE6`, update the call (currently :85):
```js
      let h = steeredNoise(noise, x, y, substrate.grainAngle[i], substrate.regime[i], 9.0,
                           drivers.radialStrainSign ?? +1)
                * substrate.grainMag[i];
```

- [ ] **Step 5: Run the Layer-2 gate + full suite**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "Layer 2"` → Expected: PASS.
Run: `npx vitest run tests/world-engine-relief-slice.test.js` → Expected: PASS (whole file; determinism + north-star core gate tests still green).
> If the cross-regime hypsometric does not beat the floor even after tuning `fScale/along/across` and `REGIME_GAIN`, this is an early-warning toward the **Task 5.5 early-exit** — note the values, do not over-tune.

- [ ] **Step 6: Commit**

```bash
git add relief-e6-tectonic.js tests/world-engine-relief-slice.test.js
git commit -m "feat(relief L2): branch steered-noise frequency/anisotropy by regime"
```

---

### Task 4: Layer 3 — re-key the field SEED with a physics discriminator (TOGGLEABLE)

One lever: the master-seed inputs to the field, so the host DEM **layout** itself differs per body — composition-keyed. **Critical (hardened-spec build requirement):** the discriminator must be **TOGGLEABLE** so the verifier can measure the held-seed baseline (OFF) vs the secondary reseed lift (ON). Default ON in normal runs; the decisive gate runs it OFF.

**Files:**
- Modify: `relief-base-step.js` (compute `drivers.discriminator`; conditionally append to the `:crust` seed at :46; read `params.discriminate`)
- Modify: `relief-e6-tectonic.js` (`runE6` :72-74 — conditionally append `drivers.discriminator` to the `:e6`/`:e6plateau` seeds)
- Modify: `relief-slice.js` (`runReliefSlice` — thread `discriminate` option, default `true`)
- Test: `tests/world-engine-relief-slice.test.js` (append `describe('Layer 3 — toggleable seed discriminator')`)

**Interfaces:**
- Consumes: `hypsometricDistance`, `perCellRMS` (Task 1).
- Produces: `runReliefSlice(bundle, { discriminate: true|false, ... })`; `drivers.discriminator` (string) and `drivers.useDiscriminator` (bool).

- [ ] **Step 1: Write the failing tests**

```js
// append to tests/world-engine-relief-slice.test.js
import { runReliefSlice as runRS_L3 } from '../relief-slice.js';
import { PRESETS as P_L3 } from '../relief-presets.js';
import { hypsometricDistance as hypso_L3, perCellRMS as rms_L3 } from '../relief-divergence.js';

describe('Layer 3 — toggleable seed discriminator', () => {
  const grid = { n: 96, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'L3' };
  it('discriminator ON changes the field layout vs OFF for the same bundle+seed', () => {
    const on  = runRS_L3(P_L3.rocky, { ...grid, epoch2: false, discriminate: true });
    const off = runRS_L3(P_L3.rocky, { ...grid, epoch2: false, discriminate: false });
    expect(rms_L3(on.substrate.height, off.substrate.height)).toBeGreaterThan(0.3); // layout reshuffled
  });
  it('discriminator OFF is reproducible (held-seed baseline is stable)', () => {
    const a = runRS_L3(P_L3.rocky, { ...grid, epoch2: false, discriminate: false });
    const b = runRS_L3(P_L3.rocky, { ...grid, epoch2: false, discriminate: false });
    expect(Array.from(a.substrate.height)).toEqual(Array.from(b.substrate.height));
  });
  it('two different bundles draw different streams when ON (composition-keyed layout)', () => {
    const rocky  = runRS_L3(P_L3.rocky,  { ...grid, epoch2: false, discriminate: true });
    const europa = runRS_L3(P_L3.europa, { ...grid, epoch2: false, discriminate: true });
    expect(rms_L3(rocky.substrate.height, europa.substrate.height)).toBeGreaterThan(0.3);
  });
  it('GUARD: a reseed alone (discriminator) must NOT be what carries the held-seed hypsometric gate', () => {
    // Same bundle, discriminator ON vs OFF = pure reshuffle of ONE world → hypsometric ~ floor, not a pass.
    const on  = runRS_L3(P_L3.rocky, { ...grid, epoch2: false, discriminate: true });
    const off = runRS_L3(P_L3.rocky, { ...grid, epoch2: false, discriminate: false });
    expect(hypso_L3(on.substrate.height, off.substrate.height)).toBeLessThan(0.05); // reshuffle ≈ no shape change
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "Layer 3"`
Expected: FAIL — `discriminate` is not yet an option; ON and OFF are identical.

- [ ] **Step 3: Compute the discriminator + thread the toggle in `relief-base-step.js`**

In `makeBaseStep`, accept `discriminate` from the grid/opts object and build the discriminator after `radialStrainSign`/`rockyCrust` exist:
```js
export function makeBaseStep(bundle, { n, lat0Deg, lat1Deg, domainKm, seed = 'relief', discriminate = true }) {
```
After `radialStrainMag` is computed, add:
```js
  // L3: physics discriminator — folds composition/regime into the seed so the LAYOUT is composition-keyed.
  // Derived from already-computed geophysics (never invented). TOGGLEABLE: the verifier runs it OFF to
  // measure the held-seed (L1+L2) baseline; ON adds the secondary reseed lift. NOT the decisive gate.
  const discriminator = String(radialStrainSign) + ':' + (rockyCrust > 0.5 ? 'sil' : 'ice');
  const useDiscriminator = !!discriminate;
```
Change the `:crust` seed (currently :46) to append the discriminator when on:
```js
  const crustSeed = String(seed) + ':crust' + (useDiscriminator ? ':' + discriminator : '');
  const rng = alea(crustSeed);
```
Add `discriminator` and `useDiscriminator` to the returned `drivers`:
```js
  const drivers = { tidalHeat, surfaceGravity, rockyCrust, surfaceHistory, age,
                    radialStrainSign, radialStrainMag, despinAmp, discriminator, useDiscriminator };
```

- [ ] **Step 4: Append the discriminator to the E6 noise seeds in `relief-e6-tectonic.js`**

In `runE6`, change the seed strings (currently :72-74):
```js
  const disc = (drivers.useDiscriminator && drivers.discriminator) ? ':' + drivers.discriminator : '';
  const rng = alea(String(seed) + ':e6:' + (epoch.name || '') + disc);
  const noise = createNoise2D(rng);
  const noisePlateau = createNoise2D(alea(String(seed) + ':e6plateau' + disc));
```

- [ ] **Step 5: Thread `discriminate` through `runReliefSlice` in `relief-slice.js`**

In `runReliefSlice`, add `discriminate: true` to the params default so it reaches `makeBaseStep`:
```js
  const params = { n: 256, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'slice',
                   epoch2: true, discriminate: true, ...opts };
```
(`makeBaseStep(driverBundle, params)` already passes the whole `params`; no further change needed.)

- [ ] **Step 6: Run the Layer-3 gate + full suite**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "Layer 3"` → Expected: PASS (4 tests).
Run: `npx vitest run tests/world-engine-relief-slice.test.js` → Expected: PASS. (Determinism tests use default `discriminate:true` consistently, so they remain bit-stable.)

- [ ] **Step 7: Commit**

```bash
git add relief-base-step.js relief-e6-tectonic.js relief-slice.js tests/world-engine-relief-slice.test.js
git commit -m "feat(relief L3): toggleable physics-discriminator seed re-key"
```

---

### Task 5.5: EARLY-EXIT CHECKPOINT (decision gate — not code)

**This is a STOP-or-GO decision, performed by the driver (working-Claude / reviewer), not a subagent.** After Layers 1–3, evaluate the hardened early-exit rule (spec §3/§5):

- [ ] **Step 1: Build the decision evidence**

Run a held-seed divergence read across the cross-regime pairs (E9 OFF, `discriminate:false`) at `n=160+`:
- `hypsometricDistance(rocky, europa)` and `hypsometricDistance(rocky, lava)` vs the reseed floor (`hypsometricDistance(rocky@seedA, rocky@seedB)`).
- `regimeHistogramDistance(rocky, europa)`.

- [ ] **Step 2: Apply the rule**

**STOP** if, with seeds held constant, Layers 1–2 cannot move the held-seed hypsometric above the reseed floor for the cross-regime pairs **AND** Layer 1 shows no real regime-class shift — *even if the Layer-3 reseed would clear a raw threshold* (a reseed-only pass is a reshuffle, not re-physics, and does NOT satisfy the gate). On STOP: do not death-spiral on re-keying; record the values and escalate to **breadth** (a new process — E8a bombardment / E10 aeolian / E11 cryosphere) as a separate scoped effort. **GO** otherwise. Record the decision + numbers in `docs/NOW.md` and the INDEX.

---

### Task 5: Layer 4 — add the `liquidStability` gate to E9 (mirror production)

One conceptual lever (whether/how-strongly E9 carves), **three edit sites** in `runE9` — the TDD must cover all three so the carve gate isn't satisfiable by wiring only one. Copy the canonical production formula verbatim; do NOT invent physics; do NOT import production (copy + cite).

**Files:**
- Modify: `relief-base-step.js` (derive `liquidStability`, `liquidSpecies`, `rainFactor` beside the existing derivations; add `clamp01`/`smoothstep` already present)
- Modify: `relief-e9-hydrology.js` (`runE9`: erodibility scale :108, `targetFrac` from liquidStability :115, early-return when gated off :119+)
- Test: `tests/world-engine-relief-slice.test.js` (append `describe('Layer 4 — liquid-stability gate')`)

**Interfaces:**
- Consumes: `runReliefSlice`, `carveFraction`, `channelFraction` (Task 1).
- Produces: `drivers.liquidStability` (0..1), `drivers.liquidSpecies` (0=water,1=methane), `drivers.rainFactor` (0..1).

- [ ] **Step 1: Write the failing gate test**

```js
// append to tests/world-engine-relief-slice.test.js
import { runReliefSlice as runRS_L4 } from '../relief-slice.js';
import { PRESETS as P_L4 } from '../relief-presets.js';
import { makeBaseStep as mkBase_L4 } from '../relief-base-step.js';
import { carveFraction as carveFrac_L4 } from '../relief-divergence.js';

describe('Layer 4 — liquid-stability gate', () => {
  const grid = { n: 96, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'L4' };
  it('derives liquidStability: temperate-wet rocky high, hot-airless lava ~0', () => {
    const rocky = mkBase_L4(P_L4.rocky, grid);
    const lava  = mkBase_L4(P_L4.lava, grid);
    expect(rocky.drivers.liquidStability).toBeGreaterThan(0.3);
    expect(lava.drivers.liquidStability).toBeLessThan(0.05);
  });
  it('wet rocky carves a real network; airless lava/magma carve ~nothing', () => {
    const rocky = runRS_L4(P_L4.rocky, { ...grid, epoch2: true });
    const lava  = runRS_L4(P_L4.lava,  { ...grid, epoch2: true });
    const magma = runRS_L4(P_L4.magma, { ...grid, epoch2: true });
    expect(carveFrac_L4(rocky.e9.incision)).toBeGreaterThan(0.05);
    expect(carveFrac_L4(lava.e9.incision)).toBeLessThan(0.005);
    expect(carveFrac_L4(magma.e9.incision)).toBeLessThan(0.005);
  });
  it('kills the hardcoded 0.4 ocean: gated-off body has ~no standing sea', () => {
    const lava = runRS_L4(P_L4.lava, { ...grid, epoch2: true });
    const standingFrac = Array.from(lava.substrate.standing).filter((v) => v === 1).length
      / lava.substrate.standing.length;
    expect(standingFrac).toBeLessThan(0.1);   // no forced 40% ocean on an airless world
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "Layer 4"`
Expected: FAIL — `liquidStability` undefined; lava carves like rocky; `targetFrac` hardcoded 0.4 forces an ocean.

- [ ] **Step 3: Derive `liquidStability` in `relief-base-step.js` (copy production verbatim + Jeans reconstruction)**

After the `rockyCrust`/`tidalHeat` derivations, add (mirrors `planet-lod-lab-core.js:546-562` + `PhysicsEngine.js` Jeans chain; `clamp01`/`smoothstep` already defined at top of file):
```js
  // L4: liquidStability — canonical production gate, copied verbatim (NOT invented).
  //   temp + volatile gates: EXACT copy of planet-lod-lab-core.js:558-560 / :548.
  const T = d.T_eq ?? 280;
  const volatileFraction = d.composition?.volatileFraction ?? 0.15;
  const volatileGate = smoothstep(0.05, 0.2, volatileFraction);                       // D2
  const waterWindow   = smoothstep(248, 273, T) * (1 - smoothstep(373, 398, T));
  const methaneWindow = smoothstep(85, 90, T)   * (1 - smoothstep(112, 120, T));
  const tempWindow = Math.max(waterWindow, methaneWindow);                            // D1
  //   retention gate (D6): reconstruct retained/pressure via the Jeans chain (PhysicsEngine.js:96-100,
  //   :111, :184-187, :218-239). uvStripFactor DROPPED (documented, spec §6 — no luminosityRel/orbitAU).
  const T_exo = 3.5 * T;                                                              // PhysicsEngine.js:111
  const kB = 1.380649e-23, mp = 1.6726e-27, G = 6.674e-11, Mearth = 5.972e24, Rearth = 6.371e6;
  const massKg = (d.massEarth ?? 1) * Mearth, radM = (d.radiusEarth ?? 1) * Rearth;
  const vEsc2 = 2 * G * massKg / radM;
  const jeans = (molarMass) => (molarMass * mp * vEsc2) / (2 * kB * T_exo);           // λ for a species
  const retained = jeans(28) > 6;                                                     // N2, λ>6 (PE:184-187)
  const pressure = retained ? clamp01(0.3 + 0.8 * (d.massEarth ?? 1)) : 0;            // PE:218 secondary-atmo
  const retentionGate = retained ? smoothstep(0.05, 0.3, pressure) : 0;              // planet-lod-lab-core:546
  const liquidStability = clamp01(retentionGate * volatileGate * tempWindow);        // :561
  const liquidSpecies = methaneWindow > waterWindow ? 1 : 0;                          // :562 (0 water,1 methane)
  const rainFactor = (waterWindow > 0 && retained) ? 1.0 : (retained ? 0.2 : 0);      // proxy (spec §3 L4)
```
Add to the returned `drivers`:
```js
                    discriminator, useDiscriminator, liquidStability, liquidSpecies, rainFactor };
```

- [ ] **Step 4: Wire the gate into all THREE E9 sites in `relief-e9-hydrology.js`**

In `runE9`: (a) early-return when gated off — add right after `const N = n*n;`:
```js
  const liquidStability = drivers.liquidStability ?? 1;
  if (liquidStability <= 1e-3) {
    return { incision: new Float32Array(N), seaLevel: -Infinity, passes: 0 };  // airless/frozen: no carve
  }
```
(b) scale erodibility by liquidStability and rainFactor (replace the `erodibility` line :108):
```js
  const erodibility = 0.18 * clamp01b(0.3 + 0.7 * (drivers.surfaceHistory ?? 0))
                      * liquidStability * (drivers.rainFactor ?? 1);   // L4: gate carve strength
```
(c) derive `targetFrac` from liquidStability (replace the hardcoded line :115 and the dead `frac` block :113-114):
```js
  const targetFrac = clamp01b(0.5 * liquidStability);   // L4: ocean fraction from liquid stability (was 0.4)
```

- [ ] **Step 5: Update BUILD-INTENT non-goals in `relief-presets.js` and `relief-e9-hydrology.js`**

In `relief-presets.js`, replace the "Ocean fraction is hardcoded 0.4" non-goal bullet with:
```js
//   • Ocean fraction + carve are now GATED by liquidStability (Layer 4): airless/hot bodies carve ~nothing
//     and have no forced ocean; temperate-wet bodies carve a full network. The hardcoded 0.4 is gone.
```

- [ ] **Step 6: Run the Layer-4 gate + full suite**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "Layer 4"` → Expected: PASS (3 tests).
Run: `npx vitest run tests/world-engine-relief-slice.test.js` → Expected: PASS. **Watch the pre-existing `seaLevelForFraction hits 0.4` test** — it calls `seaLevelForFraction` directly (unchanged) so it stays green; the change is only to `runE9`'s `targetFrac`. Confirm the `relief slice orchestrator` north-star gate still passes for rocky (rocky is wet → still carves).

- [ ] **Step 7: Commit**

```bash
git add relief-base-step.js relief-e9-hydrology.js relief-presets.js tests/world-engine-relief-slice.test.js
git commit -m "feat(relief L4): liquidStability gate on E9 (mirror production; kill hardcoded ocean)"
```

---

### Task 6: Layer 5 — add the temperate "terrestrial" bundle

One lever: a temperate liquid-water body, so a clean three-way wet/frozen/airless trio exists. Numbers TO-BE-TUNED-then-locked.

**Files:**
- Modify: `relief-presets.js` (add `terrestrial` entry)
- Test: `tests/world-engine-relief-slice.test.js` (append `describe('Layer 5 — terrestrial bundle')`)

**Interfaces:**
- Consumes: `makeBaseStep`, `runReliefSlice`, `carveFraction` (Task 1).
- Produces: `PRESETS.terrestrial`.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/world-engine-relief-slice.test.js
import { PRESETS as P_L5 } from '../relief-presets.js';
import { makeBaseStep as mkBase_L5 } from '../relief-base-step.js';
import { runReliefSlice as runRS_L5 } from '../relief-slice.js';
import { carveFraction as carveFrac_L5 } from '../relief-divergence.js';

describe('Layer 5 — terrestrial bundle', () => {
  const grid = { n: 96, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'L5' };
  it('terrestrial exists, is silicate, and is fully liquid-stable', () => {
    expect(P_L5.terrestrial).toBeDefined();
    const t = mkBase_L5(P_L5.terrestrial, grid);
    expect(t.drivers.rockyCrust).toBeGreaterThan(0.9);          // density 5.5 → silicate
    expect(t.drivers.liquidStability).toBeGreaterThan(0.5);     // temperate + volatile-rich + retained
  });
  it('the wet/frozen/airless trio is categorically separated by carve', () => {
    const terr = runRS_L5(P_L5.terrestrial, { ...grid, epoch2: true });
    const euro = runRS_L5(P_L5.europa,      { ...grid, epoch2: true });
    const lava = runRS_L5(P_L5.lava,        { ...grid, epoch2: true });
    expect(carveFrac_L5(terr.e9.incision)).toBeGreaterThan(0.05);   // wet carves
    expect(carveFrac_L5(lava.e9.incision)).toBeLessThan(0.005);     // airless bare
    // europa frozen-water but methane-window cold: carves little-to-nothing vs terrestrial
    expect(carveFrac_L5(terr.e9.incision)).toBeGreaterThan(carveFrac_L5(euro.e9.incision));
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "Layer 5"`
Expected: FAIL — `PRESETS.terrestrial` is undefined.

- [ ] **Step 3: Add the bundle to `relief-presets.js`**

Add inside the `PRESETS` object (after `europa`):
```js
  terrestrial: { composition:{ ironFraction:0.33, density:5.5, volatileFraction:0.4 }, T_eq:290, eccentricity:0.01, orbitRadiusEarth:23455, starMassEarth:332946, radiusEarth:1.0, massEarth:1.0, surfaceHistory:{ erosion:0.6 } },
```

- [ ] **Step 4: Run the Layer-5 gate + full suite**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "Layer 5"` → Expected: PASS (2 tests).
Run: `npx vitest run tests/world-engine-relief-slice.test.js` → Expected: PASS (whole file).

- [ ] **Step 5: Commit**

```bash
git add relief-presets.js tests/world-engine-relief-slice.test.js
git commit -m "feat(relief L5): add temperate terrestrial bundle (wet/frozen/airless trio)"
```

---

### Task 7: Lock thresholds + the decisive divergence gate (`divergenceReport` + §9 success gate)

Add the orchestrating verifier and the locked, validated decisive gate as an automated test (objective half of the §9 success gate). UAT remains Max's alone.

**Files:**
- Modify: `relief-slice.js` (add + export `divergenceReport(bundleA, bundleB, opts)`)
- Modify: `relief-e6-tectonic.js` / `relief-divergence.js` (lock `REGIME_GAIN` + the `DIVERGENCE_THRESHOLD`)
- Test: `tests/world-engine-relief-slice.test.js` (append `describe('§9 decisive divergence gate')`)

**Interfaces:**
- Consumes: all prior. Produces: `divergenceReport(a, b, { n, seed }) -> { heldSeedHypso, reseedFloor, regimeDist, perCellRMS, secondaryHypso, carveA, carveB, pass }`.

- [ ] **Step 1: Add `divergenceReport` to `relief-slice.js`**

```js
import { hypsometricDistance, perCellRMS, regimeHistogramDistance, carveFraction }
  from './relief-divergence.js';

// Decisive §5/§9 gate orchestrator. Held-seed (discriminator OFF) hypsometric is load-bearing; per-cell
// RMS + secondary (discriminator ON) divergence are reported, not gated. Regime corroborates cross-regime.
export function divergenceReport(bundleA, bundleB, { n = 160, seed = 'gate' } = {}) {
  const held = (b, s) => runReliefSlice(b, { n, seed: s, epoch2: false, discriminate: false });
  const on   = (b)    => runReliefSlice(b, { n, seed,     epoch2: false, discriminate: true });
  const carve = (b)   => runReliefSlice(b, { n, seed,     epoch2: true,  discriminate: true });
  const a0 = held(bundleA, seed), b0 = held(bundleB, seed);
  const aR1 = held(bundleA, seed + 'A'), aR2 = held(bundleA, seed + 'B');  // reseed floor (same bundle)
  const heldSeedHypso = hypsometricDistance(a0.substrate.height, b0.substrate.height);
  const reseedFloor   = hypsometricDistance(aR1.substrate.height, aR2.substrate.height);
  const regimeDist    = regimeHistogramDistance(a0.substrate.regime, b0.substrate.regime);
  const rms           = perCellRMS(on(bundleA).substrate.height, on(bundleB).substrate.height);
  const carveA = carveFraction(carve(bundleA).e9?.incision ?? new Float32Array(n * n));
  const carveB = carveFraction(carve(bundleB).e9?.incision ?? new Float32Array(n * n));
  // PASS = field shape diverges by physics (held-seed beats reseed floor by a margin) AND a real regime
  // shift, OR (same-regime pair) the carve axis separates them. Reseed alone NEVER passes.
  const fieldPass  = heldSeedHypso > reseedFloor * 1.5 && regimeDist > 0.1;
  const carvePass  = Math.abs(carveA - carveB) > 0.05;
  return { heldSeedHypso, reseedFloor, regimeDist, perCellRMS: rms,
           carveA, carveB, pass: fieldPass || carvePass };
}
```

- [ ] **Step 2: Write the decisive gate test**

```js
// append to tests/world-engine-relief-slice.test.js
import { divergenceReport } from '../relief-slice.js';
import { PRESETS as P_G } from '../relief-presets.js';

describe('§9 decisive divergence gate', () => {
  it('cross-regime pair (terrestrial vs europa) passes via field physics, not reseed', () => {
    const r = divergenceReport(P_G.terrestrial, P_G.europa, { n: 160, seed: 'gate1' });
    expect(r.heldSeedHypso).toBeGreaterThan(r.reseedFloor * 1.5);   // physics beats reshuffle
    expect(r.regimeDist).toBeGreaterThan(0.1);
    expect(r.pass).toBe(true);
  });
  it('same-regime pair (europa vs lava) passes via the carve axis, not the field', () => {
    const r = divergenceReport(P_G.europa, P_G.lava, { n: 160, seed: 'gate2' });
    expect(Math.abs(r.carveA - r.carveB)).toBeGreaterThan(0.05);
    expect(r.pass).toBe(true);
  });
  it('NULL: identical bundle never passes (no reseed-only pass)', () => {
    const r = divergenceReport(P_G.rocky, P_G.rocky, { n: 160, seed: 'gate3' });
    expect(r.heldSeedHypso).toBeLessThan(r.reseedFloor * 1.5);      // no physics divergence
    expect(Math.abs(r.carveA - r.carveB)).toBeLessThan(0.05);
    expect(r.pass).toBe(false);
  });
});
```

- [ ] **Step 3: Run, tune, lock**

Run: `npx vitest run tests/world-engine-relief-slice.test.js -t "decisive divergence gate"`.
If a relative assertion is marginal, tune `REGIME_GAIN` (Layer 1) and the L2 `fScale/along/across` constants in the harness/test until separation is clean, then **lock** them with a `// LOCKED <date>: <value>, validated vs null(~0)+reseed-floor` comment. The `* 1.5` margin and `0.05`/`0.1` constants are the locked thresholds — adjust once, comment, freeze. **Honor the early-exit (Task 5.5): if the cross-regime field pass cannot be achieved without the carve axis, STOP and report.**

- [ ] **Step 4: Full suite green**

Run: `npx vitest run tests/world-engine-relief-slice.test.js` → Expected: PASS (whole file).

- [ ] **Step 5: Commit**

```bash
git add relief-slice.js relief-e6-tectonic.js relief-divergence.js tests/world-engine-relief-slice.test.js
git commit -m "feat(relief): decisive held-seed divergence gate + locked tuning"
```

---

### Task 8: Harness wiring + build-intent + UAT handoff

Surface the trio + the divergence report in the lab harness so Max can do UAT; finalize record-build-intent; update pickup docs.

**Files:**
- Modify: `world-engine-relief-lab.main.js` (add `terrestrial` to the preset selector; print `divergenceReport` to the on-page panel — display only, renderer stays preset-blind)
- Modify: `relief-slice.js` build-intent header (note the divergence layers + the held-seed gate)
- Modify: `docs/FEATURES/world-engine-INDEX.md` (status: divergence build done, pending Max UAT) and `docs/NOW.md`

- [ ] **Step 1: Read the harness to find the preset selector + panel**

Read `world-engine-relief-lab.main.js`; locate the preset `<select>` population and the metrics/info panel render. (Do not change `buildMesh`/displacement/coloring — it must stay preset-blind.)

- [ ] **Step 2: Add `terrestrial` to the selector + a divergence readout**

Add `terrestrial` to the preset option list. Add a panel line that calls `divergenceReport(currentBundle, comparisonBundle)` and prints `heldSeedHypso / reseedFloor / regimeDist / carveA-carveB / pass`. Display only.

- [ ] **Step 3: Live verification (chrome-devtools GPU :5173, NOT Playwright)**

Per `[[well-dipper-testing-reference]]`: serve is already running on `:5173` (Vite base `/well-dipper/`); use chrome-devtools (`mcp__chrome-devtools__*`), lab entry `window._relief`. Confirm the three bundles (terrestrial / europa / lava) render as visibly different worlds at one seed; screenshot each. This is the OBJECTIVE live integration check — NOT UAT.

- [ ] **Step 4: Finalize record-build-intent**

Ensure `relief-divergence.js` header is complete (Task 1) and update the `relief-slice.js` BUILD-INTENT header to record: "presets now diverge STRUCTURALLY via L1 regime / L2 geometry / L3 seed / L4 carve / L5 terrestrial; decisive gate = held-seed hypsometric + regime, divergenceReport()." Flip the former "per-body structural divergence is a non-goal" line to "now realized (this build)."

- [ ] **Step 5: Update pickup docs + commit**

Update `world-engine-INDEX.md` §1 (slice now does body-type divergence; objective gate green; `VERIFIED_PENDING_MAX <sha>`) and `docs/NOW.md`. Commit:
```bash
git add world-engine-relief-lab.main.js relief-slice.js docs/FEATURES/world-engine-INDEX.md docs/NOW.md
git commit -m "feat(relief): harness divergence readout + terrestrial; build-intent + pickup docs"
```

- [ ] **Step 6: Hand off to Max for UAT**

Report `VERIFIED_PENDING_MAX <sha>`. **UAT — "three categorically different worlds at one seed" — is Max's gate alone.** No agent closes it. Push remains on HOLD.

---

## Self-Review

**1. Spec coverage:**
- §3 Layer 1 → Task 2 ✅ · Layer 2 → Task 3 ✅ · Layer 3 (toggleable) → Task 4 ✅ · Layer 4 (3 sites) → Task 5 ✅ · Layer 5 → Task 6 ✅
- §5 verifier (4 metrics) → Task 1 primitives + Task 7 `divergenceReport` ✅ (carveFraction=metric1, channelFraction=metric2, regimeHistogramDistance=metric3, hypsometricDistance=metric4 load-bearing) ✅
- §5/§9 hardened decisive gate (held-seed, reseed-invariant, regime-corroborated, same-regime→carve) → Task 7 ✅
- Early-exit rule (hardened) → Task 5.5 ✅
- §3 build-requirement: toggleable discriminator → Task 4 ✅
- §7 input gap (Jeans reconstruction, uvStripFactor dropped) → Task 5 Step 3 ✅
- record-build-intent on every module → folded into Tasks 1/2/5/8 ✅
- Renderer untouched / no production imports → Global Constraints + Task 8 display-only ✅

**2. Placeholder scan:** No TBD/TODO; every code step has real code; every test step has real assertions; every run step has the exact command + expected result. ✅

**3. Type consistency:** `drivers.{radialStrainSign, radialStrainMag, discriminator, useDiscriminator, liquidStability, liquidSpecies, rainFactor}` defined in Tasks 2/4/5 and consumed consistently. `steeredNoise(...sign)` signature added Task 3 used in same task. `runReliefSlice(b, { discriminate })` added Task 4 used in Tasks 4/7. `divergenceReport` fields match between Task 7 Step 1 and its tests. Metric function names (`hypsometricDistance`, `perCellRMS`, `regimeHistogramDistance`, `carveFraction`, `channelFraction`, `zscore`) consistent across Tasks 1–8. ✅

> Two same-named files note: gate tests import with suffixed aliases (`runRS_L1`, `hypso_L2`, etc.) to avoid redeclaration collisions in the single growing test file — matches the existing file's `mkSub2`/`mkBase4`/`P6` aliasing convention.
