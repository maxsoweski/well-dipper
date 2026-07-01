// tests/worldengine-base-climate-e5.test.js
// Increment-3a UNIT acceptance (AC1–AC9) for the SIGNED, DRIVER-ORGANIZED, PER-SEED E5 band/jet writer.
// (Supersedes the #3a-pre "lift" suite: the old SEED-INDEPENDENCE assertion is deliberately replaced by
// per-seed DISTINCT + still-byte-deterministic-per-seed — #3a adds variety. Contract:
// docs/WORKSTREAMS/world-engine-e5-bands-jets-2026-06-30/contract.json)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import {
  E5_REGIME, PHYS, DRIVER_BUNDLES,
  writeClimateE5Sphere, resolveParams, jetProfile, jetShear,
  wardS2, wardInsolation, equatorialJetSign, amplitudeLaw,
  bakeClimateE5Attributes,
} from '../src/worldengine/base/climate-e5.js';

const TARGET_N = 4000, LLOYD = 2;
const SHARED_MESH = buildIrregularSphere(TARGET_N, LLOYD);
const REGIMES = [E5_REGIME.GAS_GIANT, E5_REGIME.SATURNIAN, E5_REGIME.NEPTUNIAN, E5_REGIME.SUB_NEPTUNE];
const SEEDS = [1, 2, 7, 42];
const SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/climate-e5.js', import.meta.url)), 'utf8');
// source with comments stripped — static guards must inspect CODE, not documentation prose
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const freshCarrier = () => makeSphereField(SHARED_MESH);
const run = (regime, macroSeed, drivers = {}) => writeClimateE5Sphere(freshCarrier(), drivers, { regime, macroSeed });
const lonDegOf = (v) => Math.atan2(v[2], v[0]) * 180 / Math.PI;
// deterministic int32 hash over a Float32Array (byte-stable across runs since the field is deterministic)
const hashField = (f) => { let h = 0x811c9dc5 | 0; for (let i = 0; i < f.length; i++) h = (Math.imul(h, 31) + Math.round(f[i] * 1e6)) | 0; return h; };
// arm's-length re-derivation of u(lat) from RETURNED params only (independent of jetProfile)
const refU = (lat, P) => {
  const s = Math.sin(lat);
  const g = Math.exp(-(lat / P.phiEq) * (lat / P.phiEq));
  const eqEnv = 1 - g;
  const env = P.envBase + P.wardGain * P.s2 * 0.5 * (3 * s * s - 1);
  return P.uPeak * (P.sEq * P.aEq * g + P.aMid * Math.sin(P.m * lat + P.phaseJet) * eqEnv * env);
};

describe('worldengine base — E5 signed driver-organized band/jet writer (increment 3a AC1–AC9)', () => {
  // ── AC1: DETERMINISM + NO-RNG STATIC SOURCE ────────────────────────────────────────────────────
  it('[AC1] no Math.random()/Date.now() call form anywhere in the writer (static source guard)', () => {
    expect(SRC).not.toMatch(/Math\.random\s*\(/);
    expect(SRC).not.toMatch(/Date\.now\s*\(/);
    // every rng is alea seeded from a macroSeed-derived, climateE5-namespaced string
    for (const m of SRC.matchAll(/alea\(([^)]*)\)/g)) expect(m[1]).toContain('climateE5:');
  });
  it('[AC1] byte-identical fields across two runs of the same (regime, seed) — every archetype × seed', () => {
    for (const regime of REGIMES) for (const s of SEEDS) {
      const a = run(regime, s), b = run(regime, s);
      expect(Array.from(a.bandField)).toEqual(Array.from(b.bandField));
      expect(Array.from(a.turbulence)).toEqual(Array.from(b.turbulence));
      expect(Array.from(a.mushball)).toEqual(Array.from(b.mushball));
    }
  });
  it('[AC1] per-seed DISTINCT (two different seeds ⇒ different fields) — the superseded seed-independence', () => {
    for (const regime of REGIMES) {
      const s1 = run(regime, 1), s2 = run(regime, 999);
      expect(Array.from(s1.bandField)).not.toEqual(Array.from(s2.bandField));
    }
  });
  it('[AC1] golden byte snapshot at (gas-giant, seed 1, canonical drivers)', () => {
    const out = run(E5_REGIME.GAS_GIANT, 1);
    expect(hashField(out.bandField)).toBe(GOLDEN_BANDFIELD_HASH);
  });

  // ── AC2: BOUNDEDNESS ───────────────────────────────────────────────────────────────────────────
  it('[AC2] all fields finite and within documented bounds — regimes × seeds × driver draws', () => {
    const draws = [{}, { rotationRate: 1.8 }, { obliquityDeg: 82 }, { energyInput: 3.0 }, { dissipation: 0.1 }];
    // aggregate per-node checks into one violation record per run (millions of per-node expect() calls
    // would blow the timeout without adding coverage).
    const violations = [];
    for (const regime of REGIMES) for (const s of SEEDS) for (const dr of draws) {
      const o = run(regime, s, dr);
      const uBound = o.peakU * (PHYS.A_EQ + o.params.aMid * o.envMax) + 1e-4;
      let bad = null;
      for (let i = 0; i < o.bandField.length && !bad; i++) {
        if (!Number.isFinite(o.bandField[i]) || Math.abs(o.bandField[i]) > uBound) bad = 'bandField';
        else if (o.bandNorm[i] < 0 || o.bandNorm[i] > 1) bad = 'bandNorm';
        else if (o.turbulence[i] < 0 || o.turbulence[i] > o.turbBound + 1e-4) bad = 'turbulence';
        else if (o.mushball[i] < PHYS.MUSH_M0 - PHYS.MUSH_AMP - 1e-4 || o.mushball[i] > PHYS.MUSH_M0 + PHYS.MUSH_AMP + 1e-4) bad = 'mushball';
        else if (!Number.isFinite(o.W[i])) bad = 'W';
      }
      if (bad) violations.push({ regime, s, dr, bad });
    }
    expect(violations).toEqual([]);
  }, 30000);

  // ── AC3: ZONAL STRUCTURE BAR (must PASS) — u is a pure function of latitude ─────────────────────
  it('[AC3] bandField matches an arm\'s-length u(lat) re-derivation from returned params (< 1e-4/node)', () => {
    const carrier = freshCarrier();
    for (const regime of REGIMES) {
      const o = writeClimateE5Sphere(carrier, {}, { regime, macroSeed: 1 });
      let worst = 0;
      for (let i = 0; i < carrier.N; i++) {
        const lat = Math.asin(Math.max(-1, Math.min(1, carrier.verts[i][1])));
        worst = Math.max(worst, Math.abs(o.bandField[i] - refU(lat, o.params)));
      }
      expect(worst).toBeLessThan(1e-4);
    }
  });

  // ── AC4: LONGITUDE CONTROL (must FAIL) + NOT-3-REPEATING (count varies with rotation) ────────────
  it('[AC4][required-failure] a longitude-dependent control field FAILS the zonality bar', () => {
    const carrier = freshCarrier();
    const o = writeClimateE5Sphere(carrier, {}, { regime: E5_REGIME.GAS_GIANT, macroSeed: 1 });
    const ptp = 2 * o.maxAbs;
    let worst = 0;
    for (let i = 0; i < carrier.N; i++) {
      const lat = Math.asin(Math.max(-1, Math.min(1, carrier.verts[i][1])));
      const control = o.bandField[i] + 0.5 * ptp * Math.sin(lonDegOf(carrier.verts[i]) * Math.PI / 36);
      worst = Math.max(worst, Math.abs(control - refU(lat, o.params)));
    }
    expect(worst).toBeGreaterThan(1e-4 * 100);   // provably not a function of latitude alone
  });
  it('[AC4] band count is strictly monotonic in rotation, ~a dozen at Jupiter (NOT a fixed 3-band pattern)', () => {
    const bc = (rot) => run(E5_REGIME.GAS_GIANT, 1, { rotationRate: rot }).bandCount;
    const slow = bc(0.4), mid = bc(1.0), fast = bc(1.8);
    expect(slow).toBeLessThan(mid);
    expect(mid).toBeLessThan(fast);
    expect(mid).toBeGreaterThanOrEqual(8);       // Jupiter-plausible ~dozen
    expect(mid).toBeLessThanOrEqual(16);
    expect(mid).toBeGreaterThan(3);              // not the hard-coded 3-band pattern
  });

  // ── AC5: EQUATORIAL-JET SIGN IS REGIME-CORRECT (driver-decided) ─────────────────────────────────
  it('[AC5] equatorial jet is prograde for Jovian/Saturnian, retrograde for Neptunian; driver-flippable', () => {
    expect(run(E5_REGIME.GAS_GIANT, 1).eqSign).toBeGreaterThan(0);
    expect(run(E5_REGIME.SATURNIAN, 1).eqSign).toBeGreaterThan(0);
    expect(run(E5_REGIME.NEPTUNIAN, 1).eqSign).toBeLessThan(0);
    // flipping the ice-giant shell-depth toward a Jovian config flips the sign → driver-organized
    expect(run(E5_REGIME.NEPTUNIAN, 1, { shellDepthFrac: 0.8 }).eqSign).toBeGreaterThan(0);
  });

  // ── AC6: AMPLITUDE LAW FIXES THE NEPTUNE WIND PARADOX ───────────────────────────────────────────
  it('[AC6] peak|U| highest for Neptunian despite LOWEST energy input; naive insolation control inverts', () => {
    const jov = run(E5_REGIME.GAS_GIANT, 1), nep = run(E5_REGIME.NEPTUNIAN, 1);
    expect(nep.peakU).toBeGreaterThan(jov.peakU);
    expect(DRIVER_BUNDLES[E5_REGIME.NEPTUNIAN].energyInput).toBeLessThan(DRIVER_BUNDLES[E5_REGIME.GAS_GIANT].energyInput);
    // naive control (amplitude ∝ √insolation) puts Neptunian LOWEST — the shell/dissipation term is load-bearing
    const naive = (r) => Math.sqrt(DRIVER_BUNDLES[r].energyInput);
    expect(naive(E5_REGIME.NEPTUNIAN)).toBeLessThan(naive(E5_REGIME.GAS_GIANT));
    expect(naive(E5_REGIME.NEPTUNIAN)).toBeLessThan(naive(E5_REGIME.SATURNIAN));
  });

  // ── AC7: WARD OBLIQUITY INSOLATION + >54° INVERSION ─────────────────────────────────────────────
  it('[AC7] annual-mean pole−equator insolation flips sign crossing ~54.7° (cold poles → hot poles)', () => {
    const grad = (eps) => wardInsolation(1, eps) - wardInsolation(0, eps);   // pole − equator
    expect(grad(0)).toBeLessThan(0);
    expect(grad(30)).toBeLessThan(0);
    expect(grad(54)).toBeLessThan(0);            // 54 < 54.7 crossing ⇒ still cold poles
    expect(grad(60)).toBeGreaterThan(0);         // hot poles
    expect(grad(90)).toBeGreaterThan(0);
    expect(wardS2(54)).toBeLessThan(0);
    expect(wardS2(60)).toBeGreaterThan(0);
  });
  it('[AC7] band structure inverts to pole-emphasis for a >54° obliquity world', () => {
    const polarVsEqAmp = (obl) => {
      const c = freshCarrier();
      const o = writeClimateE5Sphere(c, { obliquityDeg: obl }, { regime: E5_REGIME.GAS_GIANT, macroSeed: 3 });
      let polar = 0, eq = 0, np = 0, ne = 0;
      for (let i = 0; i < c.N; i++) {
        const la = Math.abs(Math.asin(Math.max(-1, Math.min(1, c.verts[i][1]))) * 180 / Math.PI);
        if (la > 65) { polar += Math.abs(o.bandField[i]); np++; }
        else if (la < 25) { eq += Math.abs(o.bandField[i]); ne++; }
      }
      return (polar / np) / (eq / ne);
    };
    expect(polarVsEqAmp(97.8)).toBeGreaterThan(polarVsEqAmp(3.1));   // high-obliquity emphasizes the poles
  });

  // ── AC8: DEPTH LAYERS ARE PRESENT AS DATA ──────────────────────────────────────────────────────
  it('[AC8] turbulence is shear-gated: corr(|turbulence|,|shear|) ≥ 0.5 and vanishes at zero shear', () => {
    const c = freshCarrier();
    const o = writeClimateE5Sphere(c, {}, { regime: E5_REGIME.GAS_GIANT, macroSeed: 1 });
    const n = c.N;
    let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      const x = o.shearMag[i], y = o.turbulence[i];
      sx += x; sy += y; sxy += x * y; sxx += x * x; syy += y * y;
    }
    const cov = sxy / n - (sx / n) * (sy / n);
    const corr = cov / Math.sqrt((sxx / n - (sx / n) ** 2) * (syy / n - (sy / n) ** 2));
    expect(corr).toBeGreaterThanOrEqual(0.5);
    // exact gate: turbulence ≤ |shear|·filamentMax, so it is ~0 wherever shear is ~0
    for (let i = 0; i < n; i++) {
      if (o.shearMag[i] < 1e-3) expect(o.turbulence[i]).toBeLessThan(1e-3);
      expect(o.turbulence[i]).toBeLessThanOrEqual(o.shearMag[i] * PHYS.FILAMENT_HI + 1e-6);
    }
  });
  it('[AC8] mushball is a distinct, latitude-banded, bounded NH₃ channel (not folded into u)', () => {
    const o = run(E5_REGIME.GAS_GIANT, 1);
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < o.mushball.length; i++) { mn = Math.min(mn, o.mushball[i]); mx = Math.max(mx, o.mushball[i]); }
    expect(mx - mn).toBeGreaterThan(0.1);                         // genuinely banded, not flat
    expect(Array.from(o.mushball)).not.toEqual(Array.from(o.bandField));   // its own channel
  });

  // ── AC9: GAS GIANTS HAVE NO RELIEF ─────────────────────────────────────────────────────────────
  it('[AC9] the writer never mutates carrier.height (byte-identical before/after) and writes no relief', () => {
    for (const regime of REGIMES) {
      const c = freshCarrier();
      const before = Array.from(c.height);
      writeClimateE5Sphere(c, {}, { regime, macroSeed: 1 });
      expect(Array.from(c.height)).toEqual(before);
    }
    // static guard (comments stripped): no reference to any carrier relief channel in the writer body
    expect(CODE).not.toMatch(/carrier\.height/);
    expect(CODE).not.toMatch(/\.height\s*\[/);
  });

  // ── AC10 render-seam parity: the baked render attribute IS the tested writer field ─────────────
  it('[AC10] bakeClimateE5Attributes.aBand === writeClimateE5Sphere.bandNorm at matching latitudes', () => {
    const R = 7.3;                                          // arbitrary render radius
    for (const regime of REGIMES) {
      const c = freshCarrier();
      const o = writeClimateE5Sphere(c, {}, { regime, macroSeed: 5 });
      const positions = new Float32Array(c.N * 3);          // render verts = carrier verts × R
      for (let i = 0; i < c.N; i++) { positions[3 * i] = c.verts[i][0] * R; positions[3 * i + 1] = c.verts[i][1] * R; positions[3 * i + 2] = c.verts[i][2] * R; }
      const bake = bakeClimateE5Attributes(positions, c.N, R, { regime, macroSeed: 5 });
      // agree to float32 precision (render positions are Float32 → y round-trips; the carrier is float64)
      let worst = 0;
      for (let i = 0; i < c.N; i++) worst = Math.max(worst, Math.abs(bake.aBand[i] - o.bandNorm[i]));
      expect(worst).toBeLessThan(1e-4);
      expect(bake.bandCount).toBe(o.bandCount);
      expect(Math.sign(bake.eqSign)).toBe(Math.sign(o.eqSign));
    }
  });

  // ── LEGACY shader-parity port guard (documents the original Planet.js GAS_BODY harmonic sum) ────
  it('[legacy] the resolved amplitude/sign/Ward laws are exported pure helpers (spec-checkable)', () => {
    expect(equatorialJetSign(0.8)).toBeGreaterThan(0);
    expect(equatorialJetSign(0.15)).toBeLessThan(0);
    expect(amplitudeLaw(2.6, 0.15, 0.15)).toBeGreaterThan(amplitudeLaw(1.67, 1.0, 0.8));
    const P = resolveParams(E5_REGIME.GAS_GIANT, {}, 1);
    expect(Math.sign(jetProfile(0, P))).toBe(Math.sign(P.sEq));   // equator sign robust
    expect(jetShear(0, P)).toBeCloseTo(0, 6);                      // no shear exactly at the equator
  });
});

// Golden snapshot constant — byte-stable / deterministic (alea + simplex + IEEE Float32 rounding).
const GOLDEN_BANDFIELD_HASH = -1329854088;
