// tests/worldengine-v2-4-figure.test.js — World Engine V2-4 slice-5 (E2-figure descriptor).
// Covers AC-FIGURE(a-d) + AC-0 (the §7b radius-not-shell trap grep-deny).
//
// The figure descriptor (BUILD-PLAN §5, calibration §6.4):
//   • D8 rotationHours is plumbed NESTED into the condition vector — BYTE-INERT (no write-path reader), so the
//     HASHED_FIELDS are identical with vs without it (AC-FIGURE a; the 75-golden is the canonical proof, run
//     in the gate — this suite adds the focused delete-twin proof);
//   • deriveFigureDescriptor is a PURE fn of the condition vector: f = (5/4)·ω²·a/g with a = BODY radius
//     (condition.radiusEarth, NEVER the shell-layer thickness — the §7b trap, grep-denied) and g = surface
//     gravity. Earth-like f ∈ [2e-3,6e-3] (~1/210), Jupiter-like f ∈ [0.04,0.15] (~0.11, the homogeneous
//     coefficient's deliberate ~2× overestimate of the real ~0.065 — ORDERING Earth ≪ Jupiter is the gate,
//     lens B-m5); a tidally-LOCKED body splits presentW0 ≠ fossilW0 and fPresent ≠ fFossil (the despun
//     fossil-bulge, fossil sourced from PRIMORDIAL_SPIN_HOURS) (AC-FIGURE b);
//   • the descriptor is COMPUTED, never authored: deriveFigureDescriptor takes ONE arg (the condition), NO
//     seed / NO authored-w0, and mutating rotationHours moves f. It does not touch the shell writer's random
//     spin-axis draw (AC-FIGURE c);
//   • it PERSISTS on the writeBodyRelief return (`relief.figure`) on EVERY dispatch path, and a V2-7-shaped
//     epoch stub reads it and computes a gen-2 grain offset from (fossilW0 vs presentW0) (AC-FIGURE d).
//
// The bands are OBSERVED numbers (figure-magnitudes.mjs, §6.4): Earth 4.77e-3, Jupiter 1.12e-1, ordering 23×,
// despun split (Eyeball fPresent 4.29e-3 ≠ fFossil 3.86e-2). Metered-safe: pure node/vitest, no claude -p.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import {
  deriveFigureDescriptor, omegaFromHours, flattening, PRIMORDIAL_SPIN_HOURS,
} from '../src/worldengine/base/bodyFigure.js';
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import { TARGET_N, LLOYD, QUALITY_TIER, SEEDS, HASHED_FIELDS } from './fixtures/v2-0-carrier-golden.mjs';

const MESH = buildIrregularSphere(TARGET_N, LLOYD);
const NAMES = Object.keys(DRIVER_PRESETS);            // all 17 presets ⇒ every dispatch path exercised
const FIG = readFileSync(fileURLToPath(new URL('../src/worldengine/base/bodyFigure.js', import.meta.url)), 'utf8');

// Production-shaped condition-BEARING bundle (mirrors the other v2-4 suites' bundle).
function bundle(name, seed) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, QUALITY_TIER);
  return {
    archetype: PRESET_ARCHETYPE[name] ?? null,
    locked: !!(fp && fp.tidalState && fp.tidalState.locked),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    macroSeed: seed, heightSeed: 'e6:' + (seed | 0),
    T_eq: (fp && fp.T_eq != null) ? fp.T_eq : 288,
  };
}
const condOf = (name) => { const fp = DRIVER_PRESETS[name]; return deriveConditionVector(fp, deriveUniforms(fp, QUALITY_TIER), fp.radiusEarth); };
const build = (name, seed) => { const carrier = makeSphereField(MESH); const relief = writeBodyRelief(carrier, bundle(name, seed)); return { carrier, relief }; };
// copy the raw bytes of any typed array (buffer.slice copies), so later mutation of the carrier can't perturb the snapshot
const bytesOf = (a) => Buffer.from(a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength));

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('V2-4 AC-FIGURE(a) — D8 rotationHours plumbed byte-inertly into the condition vector', () => {
  it('condition.rotationHours is present on the vector and defaults to 24 h when the preset omits spin', () => {
    expect(condOf('Gas giant (Jovian)').rotationHours).toBe(9.9);   // preset carries D8
    expect(condOf('Rocky (Earthlike)').rotationHours).toBe(24);      // terrestrial omits ⇒ fallback
    expect(condOf('Venus (sulfuric shroud)').rotationHours).toBe(5832);
  });

  it('adding condition.rotationHours moves NO HASHED_FIELD — carriers with vs without it are byte-identical', () => {
    // the delete-twin proof: build the real (rotationHours-bearing) carrier and a twin whose condition has
    // rotationHours DELETED (the pre-C5 vector). The write path reads only flat/named keys, so every hashed
    // carrier array must be byte-identical. (The 75-golden — tests/v2-0-byte-identity.test.js — is the
    // canonical inertness proof across all 15 mapped presets × 5 seeds; run in the AC-ZERO-CLOBBER gate.)
    for (const name of ['Rocky (Earthlike)', 'Gas giant (Jovian)', 'Mars (arid rocky)', 'Venus (sulfuric shroud)', 'Eyeball (locked temperate)']) {
      const a = makeSphereField(MESH); writeBodyRelief(a, bundle(name, 1));
      const b0 = bundle(name, 1); delete b0.bodyDrivers.condition.rotationHours;
      const b = makeSphereField(MESH); writeBodyRelief(b, b0);
      for (const f of HASHED_FIELDS) {
        expect(bytesOf(a[f]).equals(bytesOf(b[f])), `${name}: ${f} byte-identical with/without rotationHours`).toBe(true);
      }
    }
  });
});

describe('V2-4 AC-FIGURE(b) — flattening magnitudes physically ordered at Earth/Jupiter/despun references', () => {
  it('Earth-like (Rocky) f ∈ [2e-3, 6e-3] (~1/210)', () => {
    const f = deriveFigureDescriptor(condOf('Rocky (Earthlike)')).fPresent;
    expect(f, `Earth f=${f.toExponential(3)}`).toBeGreaterThanOrEqual(2e-3);
    expect(f, `Earth f=${f.toExponential(3)}`).toBeLessThanOrEqual(6e-3);
  });

  it('Jupiter-like (Jovian) f ∈ [0.04, 0.15] — band intentionally ~2× above the contract "~0.06" (ordering is the gate, lens B-m5)', () => {
    const f = deriveFigureDescriptor(condOf('Gas giant (Jovian)')).fPresent;
    expect(f, `Jupiter f=${f.toExponential(3)}`).toBeGreaterThanOrEqual(0.04);
    expect(f, `Jupiter f=${f.toExponential(3)}`).toBeLessThanOrEqual(0.15);
  });

  it('ORDERING: Earth ≪ Jupiter (the real gate — the homogeneous coefficient overestimates absolutes, but order holds)', () => {
    const earth = deriveFigureDescriptor(condOf('Rocky (Earthlike)')).fPresent;
    const jup = deriveFigureDescriptor(condOf('Gas giant (Jovian)')).fPresent;
    expect(jup, `Jupiter ${jup.toExponential(2)} ≫ Earth ${earth.toExponential(2)}`).toBeGreaterThan(earth * 5);
  });

  it('a tidally-LOCKED body is despun: presentW0 ≠ fossilW0 AND fPresent ≠ fFossil (the fossil bulge)', () => {
    const f = deriveFigureDescriptor(condOf('Eyeball (locked temperate)'));
    expect(f.despun, 'Eyeball despun').toBe(true);
    expect(f.locked, 'Eyeball locked').toBe(true);
    expect(f.presentW0, 'present spin ≠ fossil spin').not.toBe(f.fossilW0);
    expect(f.fPresent, 'present flattening ≠ fossil flattening').not.toBe(f.fFossil);
    // slow-despun (present 24 h ≫ 8 h fiducial) ⇒ the fossil bulge is LARGER than the present figure
    expect(f.fFossil, `fFossil ${f.fFossil.toExponential(2)} > fPresent ${f.fPresent.toExponential(2)}`).toBeGreaterThan(f.fPresent);
    // the fossil spin IS the PRIMORDIAL_SPIN_HOURS fiducial (a named modeling constant, not an authored w0)
    expect(f.fossilW0).toBeCloseTo(omegaFromHours(PRIMORDIAL_SPIN_HOURS), 12);
  });

  it('a NON-locked body has no despin history: fPresent ≡ fFossil, presentW0 ≡ fossilW0, despun false', () => {
    const f = deriveFigureDescriptor(condOf('Rocky (Earthlike)'));
    expect(f.despun).toBe(false);
    expect(f.fPresent).toBe(f.fFossil);
    expect(f.presentW0).toBe(f.fossilW0);
  });

  it('every one of the 17 presets yields a finite, non-negative fPresent/fFossil (no NaN/Inf on any driver set)', () => {
    for (const name of NAMES) {
      const f = deriveFigureDescriptor(condOf(name));
      for (const k of ['presentW0', 'fossilW0', 'fPresent', 'fFossil', 'aMeters', 'GM']) {
        expect(Number.isFinite(f[k]), `${name}.${k} finite`).toBe(true);
        expect(f[k], `${name}.${k} ≥ 0`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('the GM = g·a² equivalence holds: f computed the a³/GM way equals the reduced a/g way (documented reduction)', () => {
    const f = deriveFigureDescriptor(condOf('Gas giant (Jovian)'));
    const viaGM = (5 / 4) * f.presentW0 * f.presentW0 * f.aMeters * f.aMeters * f.aMeters / f.GM;
    expect(viaGM).toBeCloseTo(f.fPresent, 12);
  });
});

describe('V2-4 AC-FIGURE(c) — the descriptor is COMPUTED, never authored (no seed / no authored w0)', () => {
  it('deriveFigureDescriptor takes EXACTLY ONE argument (the condition vector) — no seed, no authored-w0 parameter', () => {
    expect(deriveFigureDescriptor.length, 'arity 1 (condition only)').toBe(1);
  });

  it('mutating rotationHours changes f — the descriptor is derived from the driver, not dialed in', () => {
    const base = condOf('Rocky (Earthlike)');
    const fast = deriveFigureDescriptor({ ...base, rotationHours: 6 });
    const slow = deriveFigureDescriptor({ ...base, rotationHours: 48 });
    expect(fast.fPresent, 'a faster spinner is more oblate').toBeGreaterThan(slow.fPresent);
    // f ∝ ω² ∝ 1/period² : halving the period quadruples f
    const one = deriveFigureDescriptor({ ...base, rotationHours: 24 });
    const half = deriveFigureDescriptor({ ...base, rotationHours: 12 });
    expect(half.fPresent / one.fPresent).toBeCloseTo(4, 3);
  });

  it('bodyFigure.js never reads the shell-layer thickness (the §7b triple-duty trap — AC-0 grep-deny)', () => {
    expect(FIG, 'bodyFigure.js must not contain the denied shell-layer identifier').not.toMatch(/shellThickness/);
  });

  it('the a term is BODY radius (condition.radiusEarth), and the file draws NO RNG / does not touch the shell spin-axis path', () => {
    expect(FIG, 'reads condition.radiusEarth').toMatch(/radiusEarth/);
    expect(FIG, "no 'shell:axis:' draw (shellRelief's random axis stays sibling-local)").not.toMatch(/shell:axis:/);
    expect(FIG, 'does not import the shell-relief writer').not.toMatch(/from\s+['"][^'"]*shellRelief/);
    expect(FIG, 'no alea RNG').not.toMatch(/\balea\b/);
    expect(FIG, 'no Math.random').not.toMatch(/Math\.random/);
    expect(FIG, 'no Date.now').not.toMatch(/Date\.now/);
  });
});

describe('V2-4 AC-FIGURE(d) — the descriptor persists on the seam + a V2-7 CYCLE-2 stub reads it', () => {
  it('relief.figure is populated on EVERY dispatch path (plate/shell/despun/volcanic/stagnant-lid)', () => {
    const seenPaths = new Set();
    for (const name of NAMES) {
      const { relief } = build(name, 1);
      seenPaths.add(relief.path);
      expect(relief.figure, `${name}: relief.figure present`).toBeTruthy();
      expect(Number.isFinite(relief.figure.fPresent), `${name}: relief.figure.fPresent finite`).toBe(true);
      expect(relief.figure.presentW0, `${name}: relief.figure.presentW0 present`).toBeGreaterThanOrEqual(0);
    }
    for (const p of ['plate', 'shell', 'despun', 'volcanic', 'stagnant-lid']) {
      expect(seenPaths.has(p), `dispatch path "${p}" exercised (and carried relief.figure)`).toBe(true);
    }
  });

  it('relief.figure equals the pure deriveFigureDescriptor(condition) — the seam attaches the computed descriptor', () => {
    const { relief } = build('Gas giant (Jovian)', 1);
    const direct = deriveFigureDescriptor(condOf('Gas giant (Jovian)'));
    expect(relief.figure.fPresent).toBe(direct.fPresent);
    expect(relief.figure.fFossil).toBe(direct.fFossil);
    expect(relief.figure.presentW0).toBe(direct.presentW0);
  });

  it('a V2-7-shaped epoch stub reads {presentW0, fossilW0, fPresent, fFossil, despun} and computes a gen-2 grain offset', () => {
    // The CYCLE-2 seam this slice must exist FOR: an epoch model re-orients gen-2 grain by the figure change
    // between the fossil and present bulge. Δgrain = K_FIG · (fFossil − fPresent), the figure→grain term. It
    // is NONZERO exactly when the body despun (fossilW0 ≠ presentW0 ⇒ fFossil ≠ fPresent), zero otherwise.
    const K_FIG = 0.5;
    const gen2GrainOffset = (fig) => K_FIG * (fig.fFossil - fig.fPresent);

    const despun = deriveFigureDescriptor(condOf('Eyeball (locked temperate)'));   // locked ⇒ despun
    const stable = deriveFigureDescriptor(condOf('Rocky (Earthlike)'));            // never despun

    // the stub reads the spin split (fossilW0 vs presentW0) — the proof the seam it depends on exists
    expect(despun.fossilW0).not.toBe(despun.presentW0);
    expect(stable.fossilW0).toBe(stable.presentW0);

    const offDespun = gen2GrainOffset(despun);
    const offStable = gen2GrainOffset(stable);
    expect(offDespun, 'despun body ⇒ nonzero gen-2 grain offset (the figure→grain reorientation)').not.toBe(0);
    expect(offStable, 'stable-spin body ⇒ zero gen-2 grain offset').toBe(0);
    // the offset tracks the spin split direction: a slow-despun body (fossil bulge larger) ⇒ positive offset
    expect(offDespun).toBeGreaterThan(0);
  });

  it('the descriptor is deterministic: relief.figure is bit-identical across two fresh runs (RNG-free)', () => {
    const a = build('Eyeball (locked temperate)', 7).relief.figure;
    const b = build('Eyeball (locked temperate)', 7).relief.figure;
    for (const k of ['presentW0', 'fossilW0', 'fPresent', 'fFossil', 'aMeters', 'GM']) {
      expect(a[k], `${k} deterministic`).toBe(b[k]);
    }
  });
});
