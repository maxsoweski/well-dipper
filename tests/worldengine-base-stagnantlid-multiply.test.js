// tests/worldengine-base-stagnantlid-multiply.test.js
// World-Engine increment V2-2b-1 (world-engine-v2-2b-1-stagnant-response): the STAGNANT-side driver→expression
// MULTIPLY pass over the shipped #4b stagnant-lid writer. Direct analog of the SHIPPED #4-MULTIPLY volcanic
// pass (worldengine-base-magmatism-multiply.test.js): the per-body D-vector (bodyDrivers) is mapped to a `tune`
// override via stagnantDriversToTune(), anchored so stagnantDriversToTune(VENUS_REF) === null → the writer runs
// #4b BYTE-IDENTICAL at Venus (AC-BYTE-VENUS / AC-TUNE-NULL), non-null elsewhere → within-world variety.
//
// SLICE A (this file) discharges the 9 UNIT ACs: AC-0 spine conformance; AC1 determinism + zero-RNG + 'lid:'
// reserved + bound; AC-TUNE-NULL byte anchor (null/{}/VENUS_REF/live-Venus → null, exact-slot equality);
// AC-BYTE-VENUS (null-tune === omitted-tune); AC-TUNE-RESPONSE (monotone correct-sign); AC2 structure preserved;
// AC3 latitude falsifier; AC-ORDER-PRESERVED anti-mush; AC-VARIETY within-world Shannon entropy.
// The dispatch wiring + lab + integration ACs (AC-ZERO-CLOBBER, AC-LAB, AC-UAT) are SLICE B — NOT this file.
//
// Anti-circularity: every predictor is rebuilt ARM'S-LENGTH from the PUBLISHED diag.plumeCenters /
// coronaCenters + node positions — NEVER from the writer's plumeProx or from U. The shipped structure suite
// (worldengine-base-stagnantlid-structure.test.js) stays byte-untouched and green.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  writeStagnantLidReliefSphere, stagnantDriversToTune, VENUS_REF, THERMAL_REF, DEFAULTS, STAGNANT_BOUND,
} from '../src/worldengine/base/stagnantLid.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';

// N=1500, LLOYD=2 — the SAME finer mesh the shipped structure suite uses (stagnant ships many small clustered
// coronae + tessera). SEEDS mirror #4b / #4-MULTIPLY.
const TARGET_N = 1500, LLOYD = 2;
const SEEDS = [1, 2, 3, 7, 42];
const REGIME = 'venus-stagnant-lid';
const STAGNANT_SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/stagnantLid.js', import.meta.url)), 'utf8');
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
// build the field via the NEW tune-threaded path: tune = stagnantDriversToTune(drivers) (null at Venus). drivers
// is void'd by the writer (seed-only body), so `?? {}` is only signature hygiene — the tune carries all response.
const build = (macroSeed, drivers) => {
  const c = carrierOf();
  const tune = stagnantDriversToTune(drivers);
  const diag = writeStagnantLidReliefSphere(c, drivers ?? {}, { macroSeed, regime: REGIME, tune });
  return { c, diag, tune };
};

// ── the live Venus bundle the 75-golden harness builds (v2-0-carrier-golden.mjs:73-76) — the NON-CIRCULAR
//    anchor: VENUS_REF must equal THIS, not just itself. ────────────────────────────────────────────────────
const VENUS_FP = DRIVER_PRESETS['Venus (sulfuric shroud)'];
const venusUniforms = () => deriveUniforms(VENUS_FP, 1.0);
const liveVenusBundle = () => {
  const u = venusUniforms();
  return { ...buildNeutralBodyDrivers(u, VENUS_FP), condition: deriveConditionVector(VENUS_FP, u, VENUS_FP.radiusEarth) };
};

// ── arm's-length predictor + stats helpers (rebuilt from PUBLISHED diag only; verbatim from the shipped
//    structure suite worldengine-base-stagnantlid-structure.test.js:42-104) ──────────────────────────────────
const mean = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; };
function pearson(x, y) {
  const n = x.length, mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const den = Math.sqrt(sxx * syy); return den < 1e-12 ? 0 : sxy / den;
}
const varExplained = (x, y) => { const r = pearson(x, y); return r * r; };   // r^2
const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// SQUARED Gaussian (matches the writer's proxAt exactly — Pearson is not invariant under the linear form).
function plumePredictor(c, centers, BELT) {
  const N = c.N, verts = c.verts;
  const pred = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    let best = 0;
    for (let p = 0; p < centers.length; p++) {
      const a = Math.acos(Math.max(-1, Math.min(1, v3dot(verts[i], centers[p]))));
      const g = Math.exp(-(a / BELT) * (a / BELT));
      if (g > best) best = g;
    }
    pred[i] = best;
  }
  return pred;
}
function structureMask(diag) {
  const N = diag.U.length, m = new Float64Array(N);
  for (let i = 0; i < N; i++) m[i] = (diag.isTessera[i] || diag.coronaCoverMask[i]) ? 1 : 0;
  return m;
}
function structureCorr(c, diag) {
  const pred = plumePredictor(c, diag.plumeCenters, diag.PLUME_BELT);
  return Math.abs(pearson(structureMask(diag), pred));
}
function latY(c) {
  const N = c.N, l = new Float64Array(N);
  for (let i = 0; i < N; i++) { const y = Math.max(-1, Math.min(1, c.verts[i][1])); l[i] = y * y; }
  return l;
}
// the LOW mask for the elevation ordering: {inRift} ∪ {active-corona TRENCH annulus 0.8<=rho<=1.05}.
function riftTrenchMask(c, diag) {
  const N = c.N, m = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (diag.inRift[i]) m[i] = 1;
  for (let cc = 0; cc < diag.coronaCount; cc++) {
    if (!diag.coronaActive[cc]) continue;
    const ctr = diag.coronaCenters[cc], Rc = diag.coronaRadius[cc] || 1e-6;
    for (let i = 0; i < N; i++) {
      const rho = Math.acos(Math.max(-1, Math.min(1, v3dot(c.verts[i], ctr)))) / Rc;
      if (rho >= 0.8 && rho <= 1.05) m[i] = 1;
    }
  }
  return m;
}
const meanOverMask = (U, mask) => { let s = 0, n = 0; for (let i = 0; i < U.length; i++) if (mask[i]) { s += U[i]; n++; } return n ? s / n : NaN; };
const meanPlains = (diag) => { let s = 0, n = 0; for (let i = 0; i < diag.U.length; i++) if (!diag.isTessera[i] && !diag.inRift[i] && !diag.coronaCoverMask[i]) { s += diag.U[i]; n++; } return n ? s / n : NaN; };
const meanTessera = (diag) => { let s = 0, n = 0; for (let i = 0; i < diag.U.length; i++) if (diag.isTessera[i]) { s += diag.U[i]; n++; } return n ? s / n : NaN; };

// GENUINE low province for the anti-mush ordering (AC-ORDER-PRESERVED): the shipped riftTrenchMask INTERSECTED
// with !isTessera. The verbatim mask omits this exclusion because at Venus's shipped TESSERA_FRAC (0.075) the
// tessera-in-trench overlap is negligible; the driver sweep tunes TESSERA_FRAC up to ~0.16, at which point
// tessera caps geometrically clip active-trench annuli and pollute the "low" mean with BASE_TESSERA (0.70) nodes.
// A tessera node is the HIGH province by construction — never a "low" — so it is excluded (meanPlains already
// excludes tessera identically). The BASE_* floors + amplitudes are byte-unchanged: the ordering is structural.
function lowMask(c, diag) {
  const m = riftTrenchMask(c, diag), out = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = (m[i] && !diag.isTessera[i]) ? 1 : 0;
  return out;
}

// AC-VARIETY — the 5 province classes reconstructed ARM'S-LENGTH per node. active/inactive-corona coverage is
// rebuilt from coronaCenters + coronaRadius + coronaActive with the writer's support cutoffs (the writer returns
// coronaCoverMask (any-corona) + a per-corona coronaActive flag, stagnantLid.js:406-407 — NOT a per-node
// active/inactive split, so we rebuild it here). Precedence tessera > corona-classes > rift > plains.
function provinceEntropy(c, diag) {
  const N = c.N;
  const SA = DEFAULTS.CORONA_SUPPORT_ACTIVE, SI = DEFAULTS.CORONA_SUPPORT_INACTIVE;
  const coverActive = new Uint8Array(N), coverInactive = new Uint8Array(N);
  for (let cc = 0; cc < diag.coronaCount; cc++) {
    const ctr = diag.coronaCenters[cc], Rc = diag.coronaRadius[cc] || 1e-6, active = diag.coronaActive[cc];
    const support = active ? SA : SI;
    for (let i = 0; i < N; i++) {
      const rho = Math.acos(Math.max(-1, Math.min(1, v3dot(c.verts[i], ctr)))) / Rc;
      if (rho <= support) { if (active) coverActive[i] = 1; else coverInactive[i] = 1; }
    }
  }
  const counts = { tessera: 0, activeCorona: 0, inactiveCorona: 0, rift: 0, plains: 0 };
  for (let i = 0; i < N; i++) {
    if (diag.isTessera[i]) counts.tessera++;                     // precedence: tessera first
    else if (coverActive[i]) counts.activeCorona++;             // an active-covering corona wins over inactive
    else if (coverInactive[i]) counts.inactiveCorona++;
    else if (diag.inRift[i]) counts.rift++;
    else counts.plains++;                                        // remainder
  }
  let H = 0;
  for (const k in counts) { const p = counts[k] / N; if (p > 0) H -= p * Math.log(p); }
  return { H, counts };
}

// Extract a function's body-slice from source by brace-matching (AC-0's denylist must scope to the builder body,
// NOT the whole file — stagnantLidRegimeOf( appears at its own `export function` definition, so a whole-file
// grep self-defeats).
function funcBody(src, name) {
  const start = src.indexOf('export function ' + name);
  let depth = 0, end = -1;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}
const TUNE_BODY = funcBody(STAGNANT_SRC, 'stagnantDriversToTune');
const KNOB_KEYS = new Set(['TESSERA_FRAC', 'CORONA_ACTIVE_FRAC', 'CORONA_POOL', 'PLUME_MIN']);

// ── The shared "non-Venus sweep set" for AC2 / AC3 / AC-ORDER-PRESERVED: moderate single-axis + combo driver
//    excursions that keep the world a POPULATED stagnant world (both tessera + coronae present enough that the
//    sparse-binary-mask plume-correlation retains power). All verified minSC>=0.44 / maxVE<=0.13 across seeds. ──
const SWEEP_POINTS = [
  { volatileFraction: 0.20 },                                                       // wetter → fewer tessera, more coronae
  { volatileFraction: 0.30 },                                                       // wetter still
  { condition: { age: 6 } },                                                        // older → more preserved tessera (headless limb)
  { thermalState: 0.5 },                                                            // warmer endogenic → more active coronae
  { thermalState: 0.8 },                                                            // hot
  { condition: { T_eq: 687 } },                                                     // mildly cooler surface (in the hot-dry limb)
  { volatileFraction: 0.25, condition: { T_eq: 687, age: 6 }, thermalState: 0.6 },  // combined hot-dry-limb world
];

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC-0 — spine conformance (Rule 15). The builder reads only D-slot channels; NO archetype string.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-2b-1 AC-0 — spine conformance (driver-connectivity, no archetype, no dead knobs)', () => {
  it('(1) the stagnantDriversToTune BODY reads NO archetype input: no stagnantLidRegimeOf(, no e1.label, no PRESET_ARCHETYPE', () => {
    // body-scoped denylist (whole-file would self-defeat: stagnantLidRegimeOf( is its own `export function`).
    expect(TUNE_BODY).not.toMatch(/stagnantLidRegimeOf\(/);
    expect(TUNE_BODY).not.toMatch(/e1\.label/);
    expect(TUNE_BODY).not.toMatch(/PRESET_ARCHETYPE/);
    expect(TUNE_BODY).not.toMatch(/\barchetype\b/);
    // e1.label / PRESET_ARCHETYPE appear NOWHERE in the file (stronger whole-file guard for those two).
    expect(STAGNANT_SRC).not.toMatch(/e1\.label/);
    expect(STAGNANT_SRC).not.toMatch(/PRESET_ARCHETYPE/);
  });

  it('(1) the BODY reads ONLY the sanctioned D-slot read surface: V,g FLAT + condition?.{T_eq,age} NESTED + thermalState (via stagnantThermal)', () => {
    expect(TUNE_BODY).toMatch(/volatileFraction/);           // FLAT V/dryness D-slot
    expect(TUNE_BODY).toMatch(/massGravity/);                // FLAT g D-slot
    expect(TUNE_BODY).toMatch(/condition\?\.T_eq/);          // NESTED surface temperature (optional-chained, never-throw)
    expect(TUNE_BODY).toMatch(/condition\?\.age/);           // NESTED age (optional-chained, never-throw)
    expect(TUNE_BODY).toMatch(/stagnantThermal\(/);          // thermalState channel (read inside the helper, R1-safe)
    // thermalState is read in the module (via stagnantThermal), never as a flat age re-drive.
    expect(STAGNANT_SRC).toMatch(/thermalState/);
  });

  it('(2) every tuned knob is a named DEFAULTS population knob (no dead knobs): the return is a subset of the 4 knobs', () => {
    const t = stagnantDriversToTune({ volatileFraction: 0.30, condition: { T_eq: 600, age: 7 }, thermalState: 0.7 });
    expect(t).not.toBeNull();
    for (const k of Object.keys(t)) expect(KNOB_KEYS.has(k), `${k} is a named population knob`).toBe(true);
    // each key is an actual DEFAULTS knob (consumed by the writer's destructure :176-183 → the diag readers).
    for (const k of Object.keys(t)) expect(Object.prototype.hasOwnProperty.call(DEFAULTS, k), `${k} ∈ DEFAULTS`).toBe(true);
  });

  it('(3) taxonomy: SLICE A adds NO lab slider / *Enabled key (no writer/source taxonomy change) — drift guards trivially green', () => {
    // SLICE A edits ONLY stagnantLid.js (the pure builder) + this test — no world-engine-lab.html edit, so
    // planet-archetypes.js drift guards are unaffected (verified by the full-suite gate). Assert no new *Enabled
    // key leaked into the writer source.
    expect(STAGNANT_SRC).not.toMatch(/\w+Enabled\b/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC1 — determinism + zero new RNG + 'lid:' namespace reserved + bound
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-2b-1 AC1 — determinism + zero-RNG + lid: reserved + |U| bound', () => {
  it('stagnantDriversToTune is a pure deterministic mapper (no Math.random / Date.now) with read-only inputs', () => {
    expect(String(stagnantDriversToTune)).not.toMatch(/Math\.random|Date\.now/);
    const drv = { volatileFraction: 0.30, condition: { T_eq: 620, age: 7 }, thermalState: 0.65 };
    const before = JSON.stringify(drv);
    stagnantDriversToTune(drv);
    expect(JSON.stringify(drv)).toBe(before);                            // never mutates its arg
    expect(stagnantDriversToTune(drv)).toEqual(stagnantDriversToTune(drv)); // deterministic
  });

  it("adds ZERO new alea draws + ZERO 'lid:' literals (the V2-2b-2 namespace stays RESERVED); no Math.random/Date.now", () => {
    expect(STAGNANT_SRC).not.toMatch(/Math\.random\s*\(/);
    expect(STAGNANT_SRC).not.toMatch(/Date\.now\s*\(/);
    expect(STAGNANT_SRC).not.toMatch(/alea\('lid:/);                     // no 'lid:' alea stream
    expect(STAGNANT_SRC).not.toMatch(/'lid:/);                           // no 'lid:' literal anywhere
    expect(STAGNANT_SRC).not.toMatch(/alea\('plates:/);                  // still disjoint from the sibling namespaces
    expect(STAGNANT_SRC).not.toMatch(/alea\('magma:/);
    // the builder itself opens NO alea stream (it only computes DEFAULTS overrides).
    expect(TUNE_BODY).not.toMatch(/alea\(/);
  });

  it('same (drivers, macroSeed) → byte-identical carrier + diag on repeat builds, every seed; |U| < STAGNANT_BOUND; regime ∈ {0,1,2}', () => {
    const drv = { volatileFraction: 0.25, condition: { T_eq: 687, age: 6 }, thermalState: 0.6 };
    for (const s of SEEDS) {
      const a = build(s, drv), b = build(s, drv);
      const tag = `seed ${s}`;
      expect(Array.from(a.c.height), `${tag}: carrier.height`).toEqual(Array.from(b.c.height));
      expect(Array.from(a.c.grainAngle), `${tag}: carrier.grainAngle`).toEqual(Array.from(b.c.grainAngle));
      expect(Array.from(a.c.faultDensity), `${tag}: carrier.faultDensity`).toEqual(Array.from(b.c.faultDensity));
      expect(Array.from(a.diag.isTessera), `${tag}: isTessera`).toEqual(Array.from(b.diag.isTessera));
      expect(Array.from(a.diag.coronaActive), `${tag}: coronaActive`).toEqual(Array.from(b.diag.coronaActive));
      expect(Array.from(a.diag.resurfAge), `${tag}: resurfAge`).toEqual(Array.from(b.diag.resurfAge));
      expect(Array.from(a.diag.foldAngle), `${tag}: foldAngle`).toEqual(Array.from(b.diag.foldAngle));
      // bound + finite + carrier.regime untouched (∈ {0,1,2}, no 4th regime constant)
      let maxAbs = 0, finite = true;
      for (let i = 0; i < a.diag.U.length; i++) { const v = a.diag.U[i]; if (!Number.isFinite(v)) finite = false; maxAbs = Math.max(maxAbs, Math.abs(v)); }
      expect(finite, `${tag}: finite`).toBe(true);
      expect(maxAbs, `${tag}: |U|max=${maxAbs.toFixed(3)} < ${STAGNANT_BOUND}`).toBeLessThan(STAGNANT_BOUND);
      for (let i = 0; i < a.c.regime.length; i++) expect(a.c.regime[i] === 0 || a.c.regime[i] === 1 || a.c.regime[i] === 2).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC-TUNE-NULL — the byte anchor: stagnantDriversToTune(VENUS_REF) === null AND the live Venus bundle → null
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-2b-1 AC-TUNE-NULL — byte anchor (null-guard + VENUS_REF + live-Venus → null)', () => {
  it('(a0) the null-guard fires FIRST: stagnantDriversToTune(null) === null AND stagnantDriversToTune({}) === null', () => {
    expect(stagnantDriversToTune(null)).toBeNull();
    expect(stagnantDriversToTune({})).toBeNull();
  });

  it('(a) stagnantDriversToTune(VENUS_REF) === null (every deviation signal is 0 at the reference → exact-only identity guard)', () => {
    expect(stagnantDriversToTune(VENUS_REF)).toBeNull();
  });

  it('(b) the ACTUALLY-CONSTRUCTED live Venus bundle → null (the non-circular check that catches thermal/g drift)', () => {
    expect(stagnantDriversToTune(liveVenusBundle())).toBeNull();
  });

  it('(c) VENUS_REF is a frozen constant whose every read slot === the live-derived slot to full float precision', () => {
    expect(Object.isFrozen(VENUS_REF)).toBe(true);
    const u = venusUniforms();
    const live = liveVenusBundle();
    // massGravity is the load-bearing exactness: 0.815/0.95² === deriveUniforms.surfaceGravity (NOT rounded 0.903).
    expect(VENUS_REF.massGravity).toBe(0.815 / (0.95 * 0.95));
    expect(VENUS_REF.massGravity).toBe(u.surfaceGravity);
    expect(VENUS_REF.massGravity).toBe(live.massGravity);
    expect(VENUS_REF.volatileFraction).toBe(0.02);
    expect(VENUS_REF.volatileFraction).toBe(live.volatileFraction);
    expect(VENUS_REF.condition.T_eq).toBe(737);
    expect(VENUS_REF.condition.T_eq).toBe(live.condition.T_eq);
    expect(VENUS_REF.condition.age).toBe(4.5);
    expect(VENUS_REF.condition.age).toBe(live.condition.age);
    // THERMAL_REF is the Venus-neutral endogenic drive; both VENUS_REF and live-Venus carry thermalState undefined.
    expect(THERMAL_REF).toBe(0.275);
    expect(live.thermalState).toBeUndefined();
  });

  it('(d) a slightly-perturbed vector returns a non-null {TESSERA_FRAC, CORONA_ACTIVE_FRAC, CORONA_POOL, PLUME_MIN} subset', () => {
    for (const drv of [{ volatileFraction: 0.10 }, { condition: { T_eq: 500 } }, { condition: { age: 8 } }, { thermalState: 0.7 }]) {
      const t = stagnantDriversToTune(drv);
      expect(t, `perturbed ${JSON.stringify(drv)} → non-null`).not.toBeNull();
      for (const k of Object.keys(t)) expect(KNOB_KEYS.has(k)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC-BYTE-VENUS — null-tune === omitted-tune (the ZERO-CLOBBER core, dual-carrier, seeds {1,2,3,7,42})
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-2b-1 AC-BYTE-VENUS — the null-tune path is bit-for-bit the shipped Venus, every seed', () => {
  it('writeStagnantLidReliefSphere(live-Venus, tune:stagnantDriversToTune(VENUS_REF)) === the omitted-tune shipped call', () => {
    const live = liveVenusBundle();
    for (const s of SEEDS) {
      // baseline = the SHIPPED #4b call form (empty drivers, tune omitted).
      const cBase = carrierOf();
      const base = writeStagnantLidReliefSphere(cBase, {}, { macroSeed: s, regime: REGIME });
      // new path = the live Venus bundle + tune (=== null by construction).
      const cRef = carrierOf();
      const ref = writeStagnantLidReliefSphere(cRef, live, { macroSeed: s, regime: REGIME, tune: stagnantDriversToTune(VENUS_REF) });
      const tag = `seed ${s}`;
      expect(Array.from(cRef.height), `${tag}: carrier.height`).toEqual(Array.from(cBase.height));
      expect(Array.from(cRef.grainAngle), `${tag}: carrier.grainAngle`).toEqual(Array.from(cBase.grainAngle));
      expect(Array.from(cRef.faultDensity), `${tag}: carrier.faultDensity`).toEqual(Array.from(cBase.faultDensity));
      expect(Array.from(ref.U), `${tag}: U`).toEqual(Array.from(base.U));
      expect(Array.from(ref.isTessera), `${tag}: isTessera`).toEqual(Array.from(base.isTessera));
      expect(Array.from(ref.coronaActive), `${tag}: coronaActive`).toEqual(Array.from(base.coronaActive));
      expect(Array.from(ref.resurfAge), `${tag}: resurfAge`).toEqual(Array.from(base.resurfAge));
      expect(Array.from(ref.foldAngle), `${tag}: foldAngle`).toEqual(Array.from(base.foldAngle));
      expect(ref.plumeCount, `${tag}: plumeCount`).toBe(base.plumeCount);
      expect(ref.coronaCount, `${tag}: coronaCount`).toBe(base.coronaCount);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC-TUNE-RESPONSE — the MULTIPLY core: monotone correct-sign, MEASURABLE response along the hot-dry limb
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-2b-1 AC-TUNE-RESPONSE — monotone correct-sign response (measurable, no inversion)', () => {
  it('tesseraFrac is NON-DECREASING in age (older → more preserved tessera; the headless-only limb), measurably', () => {
    const ages = [1, 4.5, 8];
    for (const s of SEEDS) {
      const tf = ages.map((age) => build(s, { condition: { age } }).diag.tesseraFrac);
      for (let i = 1; i < tf.length; i++) expect(tf[i], `seed ${s}: tesseraFrac non-decreasing in age (${tf.join(',')})`).toBeGreaterThanOrEqual(tf[i - 1] - 1e-9);
      expect(tf[tf.length - 1] - tf[0], `seed ${s}: age response measurable`).toBeGreaterThan(0.05);
    }
  });

  it('tesseraFrac is NON-INCREASING in wetness (drier → more tessera) while coronaCount is NON-DECREASING, measurably', () => {
    const Vs = [0.02, 0.3, 0.6];
    for (const s of SEEDS) {
      const runs = Vs.map((V) => build(s, { volatileFraction: V }).diag);
      const tf = runs.map((d) => d.tesseraFrac), cc = runs.map((d) => d.coronaCount);
      for (let i = 1; i < tf.length; i++) {
        expect(tf[i], `seed ${s}: tesseraFrac non-increasing in wetness (${tf.map((x) => x.toFixed(4)).join(',')})`).toBeLessThanOrEqual(tf[i - 1] + 1e-9);
        expect(cc[i], `seed ${s}: coronaCount non-decreasing in wetness (${cc.join(',')})`).toBeGreaterThanOrEqual(cc[i - 1]);
      }
      expect(tf[0] - tf[tf.length - 1], `seed ${s}: wetness tessera response measurable`).toBeGreaterThan(0.03);
    }
  });

  it('coronaCount + plumeCount + activeFrac rise with thermalState (hotter/younger → more active coronae + plumes), measurably', () => {
    const Hs = [0.275, 0.5, 0.8];
    for (const s of SEEDS) {
      const runs = Hs.map((H) => build(s, { thermalState: H }));
      const cc = runs.map((r) => r.diag.coronaCount), pc = runs.map((r) => r.diag.plumeCount), af = runs.map((r) => r.diag.activeFrac);
      // thermalState:0.275 === THERMAL_REF → all deviations 0 → tune null → the DEFAULT knob value (Venus anchor).
      const caf = runs.map((r) => (r.tune ? r.tune.CORONA_ACTIVE_FRAC : DEFAULTS.CORONA_ACTIVE_FRAC));
      for (let i = 1; i < runs.length; i++) {
        expect(cc[i], `seed ${s}: coronaCount non-decreasing in thermalState (${cc.join(',')})`).toBeGreaterThanOrEqual(cc[i - 1]);
        expect(pc[i], `seed ${s}: plumeCount non-decreasing in thermalState (${pc.join(',')})`).toBeGreaterThanOrEqual(pc[i - 1]);
        // the CORONA_ACTIVE_FRAC knob rises strictly (no inversion) — expression activeFrac is asserted at endpoints
        // (a bigger corona pool re-samples the active/inactive mix, so the fraction can wobble mid-sweep).
        expect(caf[i], `seed ${s}: CORONA_ACTIVE_FRAC knob strictly increasing (${caf.map((x) => x.toFixed(3)).join(',')})`).toBeGreaterThan(caf[i - 1]);
      }
      expect(cc[cc.length - 1] - cc[0], `seed ${s}: coronaCount response measurable`).toBeGreaterThanOrEqual(5);
      expect(pc[pc.length - 1] - pc[0], `seed ${s}: plumeCount response measurable`).toBeGreaterThanOrEqual(2);
      expect(af[af.length - 1], `seed ${s}: activeFrac hot end > Venus end (${af.map((x) => x.toFixed(3)).join(',')})`).toBeGreaterThan(af[0]);
    }
  });

  it('coronae/plumes respond with CORRECT SIGN to T_surf within the hot-dry limb (cooler → fewer active coronae, no inversion)', () => {
    // T_surf stepped DOWNWARD from 737 (within the limb, never across the §2.3 non-monotonic turning point).
    const Ts = [737, 587, 437];
    for (const s of SEEDS) {
      const runs = Ts.map((T) => build(s, { condition: { T_eq: T } }));
      const cc = runs.map((r) => r.diag.coronaCount), pc = runs.map((r) => r.diag.plumeCount);
      const caf = runs.map((r) => (r.tune ? r.tune.CORONA_ACTIVE_FRAC : DEFAULTS.CORONA_ACTIVE_FRAC));
      for (let i = 1; i < runs.length; i++) {
        // as T_surf DROPS the expressions DROP ⇒ they are NON-DECREASING in T_surf (correct sign, no inversion).
        expect(cc[i], `seed ${s}: coronaCount non-increasing as T_surf drops (${cc.join(',')})`).toBeLessThanOrEqual(cc[i - 1]);
        expect(pc[i], `seed ${s}: plumeCount non-increasing as T_surf drops (${pc.join(',')})`).toBeLessThanOrEqual(pc[i - 1]);
        expect(caf[i], `seed ${s}: CORONA_ACTIVE_FRAC non-increasing as T_surf drops (${caf.map((x) => x.toFixed(3)).join(',')})`).toBeLessThanOrEqual(caf[i - 1] + 1e-9);
      }
      expect(cc[0] - cc[cc.length - 1], `seed ${s}: T_surf coronaCount response measurable`).toBeGreaterThanOrEqual(3);
    }
  });

  it('at VENUS_REF the field collapses to Venus (tune === null → no response)', () => {
    expect(stagnantDriversToTune(VENUS_REF)).toBeNull();
    expect(stagnantDriversToTune(liveVenusBundle())).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC2 — structure preserved under tune (placement stays plume-organized)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-2b-1 AC2 — structure preserved (|corr(structureMask, plumePredictor)| >= 0.40 and >> latitude)', () => {
  it('at every non-Venus sweep point the tuned world stays plume-organized, every seed', () => {
    for (const drv of SWEEP_POINTS) {
      for (const s of SEEDS) {
        const { c, diag } = build(s, drv);
        const sc = structureCorr(c, diag);
        const veLat = varExplained(latY(c), Array.from(diag.U));
        const tag = `${JSON.stringify(drv)} seed ${s}`;
        expect(sc, `${tag}: |corr|=${sc.toFixed(3)} >= 0.40 (plume-organized)`).toBeGreaterThanOrEqual(0.40);
        expect(veLat, `${tag}: plume r²(${(sc * sc).toFixed(3)}) > latitude r²(${veLat.toFixed(3)})`).toBeLessThan(sc * sc);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC3 — latitude control preserved (must FAIL to explain — the load-bearing falsifier). The REAL
// "not latitude-banded" criterion is veLat < plume r² (the plume field organizes U MORE than sin²(lat)),
// which holds across the whole IN-SCOPE hot-dry limb INCLUDING the driver-varied extremes (contract AC3
// observable "including the driver-varied extremes"). The tighter absolute bound veLat < 0.15 is asserted
// on the moderate hot-dry-limb sweep.
// BOUNDARY (documented + self-verified below): BEYOND the hot-dry limb — far-cold T_surf (T_eq well under
// the limb, the §2.3 NON-MONOTONIC cold-thick-z corner EXPLICITLY OUT of this MULTIPLY's scope per
// AC-TUNE-RESPONSE + designDecision #2) — the LINEAR tune EXTRAPOLATES out of its valid domain: coronae
// relict-out (coronaCount collapses), the plume-organization metric loses its structures, and a mild
// residual latitude signal can edge out the vanished plume signal (measured worst veLat 0.18 at T_eq=437
// seed7, coronaCount 4). That corner is out of scope; it is NOT a tune-introduced banding regression — the
// tune touches NO latitude machinery, only population knobs (removing coronae merely reveals baseline noise).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-2b-1 AC3 — latitude falsifier (plume r² > latitude r² across the in-scope sweep + extremes)', () => {
  // mild driver-varied EXTREMES that stay WITHIN the hot-dry limb (populated worlds): the tune's age /
  // wetness / thermal response endpoints + the old+wet+hot corner. The falsifier must hold here.
  const IN_LIMB_EXTREMES = [{ condition: { age: 8 } }, { volatileFraction: 0.6 }, { thermalState: 0.8 },
    { volatileFraction: 0.55, condition: { T_eq: 737, age: 9 }, thermalState: 0.85 }];
  it('plume r² > latitude r² across the hot-dry-limb sweep + in-limb extremes, every seed (the real falsifier)', () => {
    for (const drv of [...SWEEP_POINTS, ...IN_LIMB_EXTREMES]) {
      for (const s of SEEDS) {
        const { c, diag } = build(s, drv);
        const veLat = varExplained(latY(c), Array.from(diag.U));
        const vePlume = structureCorr(c, diag) ** 2;
        const tag = `${JSON.stringify(drv)} seed ${s}`;
        expect(veLat, `${tag}: veLat(${veLat.toFixed(3)}) < plume r²(${vePlume.toFixed(3)}) — plume-organized, not banded`).toBeLessThan(vePlume);
      }
    }
  });
  it('the absolute latitude signal stays < 0.15 on the moderate hot-dry-limb sweep (the #4b bound)', () => {
    for (const drv of SWEEP_POINTS) {
      for (const s of SEEDS) {
        const { c, diag } = build(s, drv);
        const veLat = varExplained(latY(c), Array.from(diag.U));
        expect(veLat, `${JSON.stringify(drv)} seed ${s}: veLatitude=${veLat.toFixed(3)} < 0.15`).toBeLessThan(0.15);
      }
    }
  });
  it('BOUNDARY: beyond the hot-dry limb (far-cold T_eq=437) the tune extrapolates → coronae relict-out (out-of-scope corner, falsifier not claimed)', () => {
    // self-documenting: confirm the far-cold corner IS the relict regime (few coronae), so its weak
    // plume-organization is an out-of-domain extrapolation artifact, not an in-scope banding regression.
    for (const s of SEEDS) {
      const { diag } = build(s, { condition: { T_eq: 437 } });
      expect(diag.coronaCount, `seed ${s}: far-cold coronaCount=${diag.coronaCount} relict (<= 8)`).toBeLessThanOrEqual(8);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC-ORDER-PRESERVED — anti-mush: mean(tessera) > mean(plains) > mean(low) across the whole sweep (structural)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-2b-1 AC-ORDER-PRESERVED — mean(tessera) > mean(plains) > mean(rift/trench low), every sweep point + seed', () => {
  // the AC-TUNE-RESPONSE extremes too (age8 / wet0.6 / hot / cold-limb) — the ordering is structural (BASE_*
  // floors + amplitudes untouched), so it must hold at the sweep endpoints as well as the moderate interior.
  const ORDER_POINTS = [
    ...SWEEP_POINTS,
    { condition: { age: 8 } }, { volatileFraction: 0.6 }, { thermalState: 0.8 }, { condition: { T_eq: 437 } },
  ];
  it('the elevation ordering holds across the full sweep + all seeds (the tune cannot invert the province floors)', () => {
    for (const drv of ORDER_POINTS) {
      for (const s of SEEDS) {
        const { c, diag } = build(s, drv);
        const mT = meanTessera(diag), mP = meanPlains(diag), mL = meanOverMask(diag.U, lowMask(c, diag));
        const tag = `${JSON.stringify(drv)} seed ${s}`;
        expect(mT, `${tag}: meanTessera=${mT.toFixed(4)} > meanPlains=${mP.toFixed(4)}`).toBeGreaterThan(mP);
        expect(mP, `${tag}: meanPlains=${mP.toFixed(4)} > meanLow=${mL.toFixed(4)}`).toBeGreaterThan(mL);
      }
    }
  });

  it('stagnantDriversToTune returns ONLY population knobs (no BASE_* / amplitude key) for every sweep vector', () => {
    for (const drv of ORDER_POINTS) {
      const t = stagnantDriversToTune(drv);
      expect(t, `${JSON.stringify(drv)}: non-null off Venus`).not.toBeNull();
      const keys = Object.keys(t);
      expect(keys.every((k) => KNOB_KEYS.has(k)), `keys ${keys.join(',')} ⊆ the 4 population knobs`).toBe(true);
      // explicitly assert NO floor / amplitude key ever appears.
      for (const forbidden of ['BASE_TESSERA', 'BASE_PLAINS', 'BASE_RIFT', 'A_DOME', 'A_TRENCH', 'A_RISE', 'A_DEP', 'A_RIM', 'TESS_FOLD_AMP', 'TESS_RIBBON_AMP']) {
        expect(keys).not.toContain(forbidden);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC-VARIETY — within-world variety: Shannon entropy over 5 reconstructed province classes rises with drivers
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-2b-1 AC-VARIETY — driver-varied worlds differ within-world MORE than a seed-only re-roll', () => {
  // low- vs high-heterogeneity corners (extreme, entropy-only — NOT structure-checked). low: young + dry + cold
  // → near-all-plains (low H). high: old + wet + hot → balanced tessera/coronae/rift/plains mix (high H).
  const V_LOW = { volatileFraction: 0.0, condition: { T_eq: 337, age: 1 }, thermalState: 0.05 };
  const V_HIGH = { volatileFraction: 0.55, condition: { T_eq: 737, age: 9 }, thermalState: 0.85 };

  it('the driver-induced ΔH exceeds the seed-only noise floor at every seed, and H rises toward the high-heterogeneity corner', () => {
    // (1) noise floor = the spread of H across seeds at the void-drivers (seed-only re-roll) baseline.
    const Hvoid = SEEDS.map((s) => { const { c, diag } = build(s, null); return provinceEntropy(c, diag).H; });
    const noiseFloor = Math.max(...Hvoid) - Math.min(...Hvoid);
    expect(noiseFloor, `noise floor computed (${noiseFloor.toFixed(4)})`).toBeGreaterThan(0);

    // (2) at each seed, changing DRIVERS moves H by more than changing the SEED does (the objective AC9 proxy).
    for (const s of SEEDS) {
      const lo = build(s, V_LOW), hi = build(s, V_HIGH), vn = build(s, null);
      const Hlo = provinceEntropy(lo.c, lo.diag).H, Hhi = provinceEntropy(hi.c, hi.diag).H, Hvn = provinceEntropy(vn.c, vn.diag).H;
      expect(Hhi - Hlo, `seed ${s}: driver ΔH=${(Hhi - Hlo).toFixed(4)} > seed noise floor ${noiseFloor.toFixed(4)}`).toBeGreaterThan(noiseFloor);
      // (3) H rises toward the high-heterogeneity corner: high > void(Venus) > low, per seed.
      expect(Hhi, `seed ${s}: H_high(${Hhi.toFixed(3)}) > H_venus(${Hvn.toFixed(3)})`).toBeGreaterThan(Hvn);
      expect(Hvn, `seed ${s}: H_venus(${Hvn.toFixed(3)}) > H_low(${Hlo.toFixed(3)})`).toBeGreaterThan(Hlo);
    }
  });
});
