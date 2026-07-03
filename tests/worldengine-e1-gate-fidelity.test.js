// tests/worldengine-e1-gate-fidelity.test.js — World Engine V2-1 AC4 (Slice B).
//
// Gate-formula fidelity: computeE1's L / Φ / n / m_hp reproduce the committed gate reference scripts EXACTLY.
// The reference formulas below are copied VERBATIM from the two design harnesses (read fp directly):
//   • L  — gate-1-L-calib.mjs / gate-1-L-lidstrength-form-DESIGN.md §Decision (constants VERBATIM).
//   • Φ,n — phi-calib.mjs (delegable-#4 size-aware vigor proxy; n = f(Φ, 1/L)).
// computeE1 reads the CONDITION VECTOR (massEarth reconstructed as surfaceGravity·radiusEarth², §4.2 named
// derivation) — the diff proves the production module matches the reference to floating-point tolerance.
// Also: the 9 gate-1 ordering asserts on computeE1's own L, R-Φsize on computeE1's Φ, and the SH-F2 grep.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { computeE1, HEATPIPE_PEG } from '../src/worldengine/base/e1Regime.js';
import { deriveConditionVector } from '../body-condition-vector.js';
import { DRIVER_PRESETS } from '../driver-presets.js';

// ── VERBATIM reference helpers (from gate-1-L-calib.mjs / phi-calib.mjs) ──────────────────────────────
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp = (lo, hi, x) => Math.max(lo, Math.min(hi, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const surfaceGravity = (fp) => (fp.massEarth ?? 1.0) / Math.pow(fp.radiusEarth ?? 1.0, 2);
const ioRef = (0.0041 * 0.0041) * (317.8 * 317.8) * Math.pow(0.286, 5) / Math.pow(66, 5);
function rawTidal(fp) {
  if (fp.tidalHeat != null) return fp.tidalHeat;
  const ecc = fp.eccentricity ?? 0, star = fp.starMassEarth ?? 332946;
  const R = fp.radiusEarth ?? 1.0, orbit = fp.orbitRadiusEarth ?? 23455;
  return orbit > 0 ? (ecc * ecc * star * star * Math.pow(R, 5) / Math.pow(orbit, 5)) / ioRef : 0;
}
const LP = { Z_BASE: 0.15, Z_COLD: 0.55, Z_AGE: 0.25, T_ZLO: 200, T_ZHI: 320, T_MELT_LO: 1100, T_MELT_HI: 1500,
  MU_DRY: 0.55, MU_HEAT: 0.65, T_ALO: 300, T_AHI: 750, V_LO: 0.05, V_HI: 0.20,
  W_Z: 0.55, W_MU: 0.75, G_EXP: 0.15, GMOD_LO: 0.90, GMOD_HI: 1.12, RHOG_REF: 5.5 * 0.9, K_L: 0.82 };
function refL(fp) {
  const T = fp.T_eq ?? 280, V = fp.composition?.volatileFraction ?? 0.15, rho = fp.composition?.density ?? 5.5;
  const g = surfaceGravity(fp), aN = clamp01((fp.age ?? 4.5) / 10);
  const meltFactor = 1 - smoothstep(LP.T_MELT_LO, LP.T_MELT_HI, T);
  const coldness = 1 - smoothstep(LP.T_ZLO, LP.T_ZHI, T);
  const z = clamp01(LP.Z_BASE + LP.Z_COLD * coldness + LP.Z_AGE * aN) * meltFactor;
  const anneal = smoothstep(LP.T_ALO, LP.T_AHI, T);
  const dryness = 1 - smoothstep(LP.V_LO, LP.V_HI, V);
  const muProxy = clamp01(LP.MU_DRY * dryness + LP.MU_HEAT * anneal) * meltFactor;
  const gMod = clamp(LP.GMOD_LO, LP.GMOD_HI, Math.pow((rho * g) / LP.RHOG_REF, LP.G_EXP));
  return clamp01(LP.K_L * (LP.W_Z * z + LP.W_MU * muProxy) * gMod);
}
const PHI = { C_MASS: 0.5, C_SIZE: 0.5, C_TIDAL: 10 };
function refPhi(fp) {
  const age = fp.age ?? 4.5, mass = fp.massEarth ?? 1.0, d = fp.radiusEarth ?? 1.0;
  const radiogenic = 1 - clamp01(age / 10);
  const vigor = radiogenic * (PHI.C_MASS * mass + PHI.C_SIZE * d * d * d);
  return { phi: Math.sqrt(Math.max(0, vigor)) + PHI.C_TIDAL * rawTidal(fp), vigor };
}
const refN = (phi, L) => clamp(3, 11, Math.round(4 + 4 * Math.min(phi, 1.2) + 2 * (1 - L)));

// computeE1 is fed the REAL condition vector (derived=null → baseStep helper fallbacks, == the calib inputs).
const vec = (name) => { const fp = DRIVER_PRESETS[name]; return deriveConditionVector(fp, null, fp.radiusEarth); };
// relative+absolute closeness (Φ spans 0.15 → 7.6e8; mass round-trip is ≤1 ULP relative).
const closeRel = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));

const NAMES = Object.keys(DRIVER_PRESETS);

describe('V2-1 AC4 — L reproduces the gate-1 calibration table EXACTLY', () => {
  it('computeE1(cv).L === refL(fp) for all 17 presets (verbatim gate-1 form + constants)', () => {
    for (const name of NAMES) expect(computeE1(vec(name), 1).L, name).toBeCloseTo(refL(DRIVER_PRESETS[name]), 9);
  });

  it('anchors the human-readable gate-1 table (Venus 0.728, Rocky 0.250, Mars 0.551, Magma 0.000)', () => {
    expect(computeE1(vec('Venus (sulfuric shroud)'), 1).L).toBeCloseTo(0.728, 3);
    expect(computeE1(vec('Rocky (Earthlike)'), 1).L).toBeCloseTo(0.250, 3);
    expect(computeE1(vec('Mars (arid rocky)'), 1).L).toBeCloseTo(0.551, 3);
    expect(computeE1(vec('Magma (K2-141b)'), 1).L).toBeCloseTo(0.000, 3);
  });

  it('MAGMA_REF pseudo-body (documented defaults T280/V0.15/ρ5.5/g0.9/age4.5) → L ≈ 0.270', () => {
    const cv = { T_eq: 280, composition: { volatileFraction: 0.15, density: 5.5 }, density: 5.5,
                 surfaceGravity: 0.9, radiusEarth: 1.0, age: 4.5, rawTidalIoRatio: 0, atmosphere: null };
    expect(computeE1(cv, 1).L).toBeCloseTo(0.270, 3);
  });

  it('passes all 9 gate-1 ordering asserts on computeE1 L', () => {
    const L = Object.fromEntries(NAMES.map((n) => [n, computeE1(vec(n), 1).L]));
    expect(0.270).toBeLessThan(L['Venus (sulfuric shroud)']);            // L(MAGMA_REF 0.270) < L(Venus)
    expect(L['Venus (sulfuric shroud)']).toBeGreaterThan(0.6);           // Venus high
    expect(L['Rocky (Earthlike)']).toBeLessThan(0.35);                   // Earth low
    expect(L['Ocean (temperate)']).toBeLessThan(0.35);                   // Ocean low
    expect(L['Ocean (temperate)']).toBeLessThanOrEqual(L['Rocky (Earthlike)']); // wetter → more mobile
    expect(L['Mars (arid rocky)']).toBeGreaterThan(L['Rocky (Earthlike)']);     // Mars cold-thick lid
    expect(L['Mars (arid rocky)']).toBeGreaterThan(0.30);                // Mars mixed band
    expect(L['Mars (arid rocky)']).toBeLessThan(0.65);
    expect(L['Magma (K2-141b)']).toBeLessThan(0.10);                     // Magma ~0 (molten)
    // Venus strong-lid champion among rocky non-heatpipe (Lava/Magma are heat-pipe by m_hp):
    expect(L['Venus (sulfuric shroud)']).toBeGreaterThan(L['Mars (arid rocky)']);
  });
});

describe('V2-1 AC4 — Φ reproduces phi-calib + honors R-Φsize (delegable #4)', () => {
  it('computeE1(cv).Φ === refPhi(fp) for all 17 presets (mass reconstructed g·R², ≤1 ULP)', () => {
    for (const name of NAMES) {
      const got = computeE1(vec(name), 1).Φ, exp = refPhi(DRIVER_PRESETS[name]).phi;
      expect(closeRel(got, exp), `${name}: ${got} vs ${exp}`).toBe(true);
    }
  });

  it('anchors phi-calib rocky/icy values (Venus 0.690, Mars 0.268, Earth 0.740, Ocean 0.998)', () => {
    expect(computeE1(vec('Venus (sulfuric shroud)'), 1).Φ).toBeCloseTo(0.690, 3);
    expect(computeE1(vec('Mars (arid rocky)'), 1).Φ).toBeCloseTo(0.268, 3);
    expect(computeE1(vec('Rocky (Earthlike)'), 1).Φ).toBeCloseTo(0.740, 3);
    expect(computeE1(vec('Ocean (temperate)'), 1).Φ).toBeCloseTo(0.998, 3);
  });

  it('R-Φsize: Φ(Mars) < Φ(Venus), ratio ∈ [2,3] (PG-2 compression), Φ(Mars) < Φ(Ocean)', () => {
    const phiMars = computeE1(vec('Mars (arid rocky)'), 1).Φ;
    const phiVenus = computeE1(vec('Venus (sulfuric shroud)'), 1).Φ;
    const phiOcean = computeE1(vec('Ocean (temperate)'), 1).Φ;
    expect(phiMars).toBeLessThan(phiVenus);
    const ratio = phiVenus / phiMars;
    expect(ratio).toBeGreaterThanOrEqual(2);
    expect(ratio).toBeLessThanOrEqual(3);
    expect(phiMars).toBeLessThan(phiOcean);
    // raw-vigor ratio > 5 confirms sqrt compresses ~6.5× → ~2.5× (Venus/Mars).
    expect(refPhi(DRIVER_PRESETS['Venus (sulfuric shroud)']).vigor / refPhi(DRIVER_PRESETS['Mars (arid rocky)']).vigor).toBeGreaterThan(5);
  });
});

describe('V2-1 AC4 — n (gate-2) + m_hp (delegable #6)', () => {
  it('computeE1(cv).n === refN(Φ, L) for all 17 presets (compressed Φ)', () => {
    for (const name of NAMES) {
      const e = computeE1(vec(name), 1);
      expect(e.n, name).toBe(refN(refPhi(DRIVER_PRESETS[name]).phi, refL(DRIVER_PRESETS[name])));
    }
  });

  it('n anchors: Venus 7, Rocky 8, Mars 6, Magma 11 (phi-calib)', () => {
    expect(computeE1(vec('Venus (sulfuric shroud)'), 1).n).toBe(7);
    expect(computeE1(vec('Rocky (Earthlike)'), 1).n).toBe(8);
    expect(computeE1(vec('Mars (arid rocky)'), 1).n).toBe(6);
    expect(computeE1(vec('Magma (K2-141b)'), 1).n).toBe(11);
  });

  it('m_hp = rawTidalIoRatio − 0.45 (exported peg); heat-pipe margin +ve only for Lava/Magma/Europa', () => {
    expect(HEATPIPE_PEG).toBe(0.45);
    for (const name of NAMES) {
      expect(computeE1(vec(name), 1).m_hp, name).toBeCloseTo(rawTidal(DRIVER_PRESETS[name]) - 0.45, 9);
    }
    for (const hot of ['Lava (hot airless)', 'Magma (K2-141b)', 'Europa (icy moon)'])
      expect(computeE1(vec(hot), 1).m_hp, hot).toBeGreaterThan(0);
    for (const cold of ['Venus (sulfuric shroud)', 'Rocky (Earthlike)', 'Mars (arid rocky)', 'Titan (methane seas)'])
      expect(computeE1(vec(cold), 1).m_hp, cold).toBeLessThan(0);
  });
});

describe('V2-1 AC4 — SH-F2: L/Φ never read shellThickness', () => {
  it('the module CODE never references condition.shellThickness (z/D/d kept distinct)', () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(path.resolve(__dirname, '../src/worldengine/base/e1Regime.js'), 'utf8');
    // strip comments — the SH-F2 rationale legitimately NAMES shellThickness as the thing NOT read.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code.includes('shellThickness')).toBe(false);
  });
});
