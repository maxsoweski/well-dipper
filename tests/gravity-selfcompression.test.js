// tests/gravity-selfcompression.test.js — World Engine gravity-selfcompression-2026-07-28.
//
// The change under test: surface gravity on the drawn-radius axis moves from the CONSTANT-DENSITY
// law g = g_c·(R/R_c) to the self-compression law g = g_c·f(R)/f(R_c), with f piecewise in ABSOLUTE
// Earth radii — R^(4/3) below 1, R^1.70 above — and applied to the ROCKY class only.
//
// WHAT EACH BLOCK EXISTS TO CATCH (every assertion below has a stated criterion and, where the
// property could be satisfied vacuously, a planted-defect control — this program's standing lesson
// is that all four of its prior instrument bugs returned a PLAUSIBLE NUMBER rather than crashing):
//
//   AC-BYTE        canonical bit-identity, per preset, on both the derived-present and fallback branch
//   AC-GATE        the 10 non-rocky presets are bit-identical to the RETIRED law at every radius
//   AC-CONTINUITY  value-continuous at the R = 1 join, strictly monotone, finite across [0.27, 16]
//   AC-LAW         the exponents are what the sources say, measured off the shipped function
//
// The LAW_REGISTRY entries and their planted-defect controls live in instrument-laws.test.js; this
// file pins the derivation itself.

import { describe, it, expect } from 'vitest';

import {
  deriveConditionVector, gravityRadiusShape, gravityRadiusRatio,
  GRAV_R_EXP_SUB, GRAV_R_EXP_SUPER,
} from '../src/worldengine/base/conditionVector.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { bodySurfaceGravity } from '../src/worldengine/base/baseStep.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { deriveUniforms, RADIUS_SLIDER_MIN, RADIUS_SLIDER_MAX } from '../src/worldengine/base/labCore.js';

const PRESETS = Object.entries(DRIVER_PRESETS);
const classOf = (fp) => compositionClass(deriveConditionVector(fp, null, fp.radiusEarth ?? 1.0));

// The reachable domain floor is 0.27, not the slider's 0.30: Moon/Mercury's LAB_UNLOCKED_RANGES
// entry is [0.27, 0.38] and the lab draw site passes { labUnlock: true }.
const REACH_LO = 0.27, REACH_HI = RADIUS_SLIDER_MAX;
const SWEEP = [0.27, 0.3, 0.4, 0.5, 0.75, 0.9, 0.99, 1.0, 1.01, 1.1, 1.6, 2.0, 4.0, 8.0, 11.2, 16.0];

describe('the exponents are the cited ones, and the sources are not silently swapped', () => {
  it('GRAV_R_EXP_SUPER === 1.70 — Zeng+2016 M ∝ R^3.7 minus the R² in g = M/R²', () => {
    expect(GRAV_R_EXP_SUPER).toBe(1.70);
    expect(3.7 - 2).toBeCloseTo(GRAV_R_EXP_SUPER, 12);
  });

  it('GRAV_R_EXP_SUB === 4/3 — Valencia+2006 Table 2, β ≈ 0.3 ⇒ n = 1/β − 2', () => {
    expect(GRAV_R_EXP_SUB).toBe(4 / 3);
    expect(1 / 0.3 - 2).toBeCloseTo(GRAV_R_EXP_SUB, 12);
    // The retired law's exponent. Asserting they DIFFER is what makes every gate test below
    // non-vacuous: if the sub exponent were ever retuned to 1, the gated and rocky branches would
    // coincide below 1 R⊕ and AC-GATE could pass while doing nothing.
    expect(GRAV_R_EXP_SUB).not.toBe(1);
  });
});

describe('AC-CONTINUITY — the piecewise shape joins exactly at R = 1', () => {
  it('both branches evaluate to exactly 1 at R = 1 (no value discontinuity)', () => {
    // Measured the RIGHT way: compare the two BRANCH FORMULAS at the join. Sampling at 1 ± ε
    // instead measures the function's own slope across the interval and reports ~3e-9, which is
    // the derivative kink, not a jump — a real distinction this test exists to keep straight.
    expect(Math.pow(1, GRAV_R_EXP_SUB)).toBe(1);
    expect(Math.pow(1, GRAV_R_EXP_SUPER)).toBe(1);
    expect(gravityRadiusShape(1)).toBe(1);
  });

  it('the one-sided limits agree to float noise', () => {
    for (const eps of [1e-6, 1e-9, 1e-12]) {
      const lo = gravityRadiusShape(1 - eps), hi = gravityRadiusShape(1 + eps);
      expect(Math.abs(hi - lo), `join at ±${eps}`).toBeLessThan(4 * eps);
    }
  });

  it('the DERIVATIVE kink is real and is not smoothed away — slope 4/3 below, 1.70 above', () => {
    const slope = (a, b) => Math.log(gravityRadiusShape(b) / gravityRadiusShape(a)) / Math.log(b / a);
    expect(slope(0.5, 0.9)).toBeCloseTo(GRAV_R_EXP_SUB, 12);
    expect(slope(1.1, 1.7)).toBeCloseTo(GRAV_R_EXP_SUPER, 12);
    expect(slope(1.1, 1.7)).toBeGreaterThan(slope(0.5, 0.9));
  });

  it('gravity is finite, positive and strictly monotone across the whole reachable domain', () => {
    for (const [name, fp] of PRESETS) {
      let prev = -Infinity;
      for (const R of SWEEP) {
        const g = deriveConditionVector(fp, null, R).surfaceGravity;
        expect(Number.isFinite(g), `${name} @R=${R} finite`).toBe(true);
        expect(g, `${name} @R=${R} positive`).toBeGreaterThan(0);
        expect(g, `${name} @R=${R} monotone`).toBeGreaterThan(prev);
        prev = g;
      }
    }
  });

  it('a degenerate near-zero radius cannot produce a non-finite gravity', () => {
    for (const R of [0, 1e-30, -0]) {
      const g = deriveConditionVector(DRIVER_PRESETS['Rocky (Earthlike)'], null, R).surfaceGravity;
      expect(Number.isFinite(g), `R=${R}`).toBe(true);
    }
  });
});

describe('AC-BYTE — the change is bit-for-bit invisible at the canonical radius', () => {
  it('every preset returns exactly its canonical g when R === R_c, on the fallback branch', () => {
    for (const [name, fp] of PRESETS) {
      const cv = deriveConditionVector(fp, null, fp.radiusEarth);
      expect(Object.is(cv.surfaceGravity, bodySurfaceGravity(fp)), name).toBe(true);
    }
  });

  it('...and on the derived-present branch, which is the one the lab actually takes', () => {
    for (const [name, fp] of PRESETS) {
      const d = deriveUniforms(fp, 'high');
      const cv = deriveConditionVector(fp, d, fp.radiusEarth);
      expect(Object.is(cv.surfaceGravity, d.surfaceGravity), name).toBe(true);
    }
  });

  it('the ratio is exactly 1.0 at canonical for every class — x/x on the identical float', () => {
    for (const [name, fp] of PRESETS) {
      const R_c = fp.radiusEarth ?? 1.0;
      expect(gravityRadiusRatio(R_c, R_c, classOf(fp)), name).toBe(1);
    }
    // The property this rests on, asserted directly rather than assumed: pow(1, y) is exactly 1.
    // (Engine behaviour, NOT spec-mandated for general y — ECMA-262 mandates exactness for base 1
    // only when the exponent is ±0 — so it is pinned here rather than trusted.)
    for (const y of [GRAV_R_EXP_SUB, GRAV_R_EXP_SUPER, 1, 3.7, 0.5]) {
      expect(Math.pow(1, y), `pow(1,${y})`).toBe(1);
    }
  });
});

describe('AC-GATE — the rocky law reaches the rocky class and nothing else', () => {
  const RETIRED = (g_c, R, R_c) => g_c * (R / R_c);   // the constant-density law, verbatim

  it('the class census is the expected 8 rocky / 5 gas / 4 icy / 1 carbon', () => {
    const counts = {};
    for (const [, fp] of PRESETS) { const c = classOf(fp); counts[c] = (counts[c] || 0) + 1; }
    expect(counts).toEqual({ rocky: 8, gas: 5, icy: 4, carbon: 1 });
    expect(PRESETS.length).toBe(18);
  });

  it('all 10 non-rocky presets are BIT-IDENTICAL to the retired law at every reachable radius', () => {
    let checked = 0;
    for (const [name, fp] of PRESETS) {
      const cls = classOf(fp);
      if (cls === 'rocky') continue;
      const R_c = fp.radiusEarth ?? 1.0, g_c = bodySurfaceGravity(fp);
      for (const R of SWEEP) {
        const g = deriveConditionVector(fp, null, R).surfaceGravity;
        expect(Object.is(g, RETIRED(g_c, R, R_c)), `${name} [${cls}] @R=${R}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBe(10 * SWEEP.length);   // non-vacuity: the loop really ran
  });

  it('all 8 rocky presets DIFFER from the retired law everywhere off-canonical', () => {
    // The mirror of the test above. Without it, a gate that accidentally excluded everything would
    // pass the non-rocky assertion perfectly.
    let moved = 0;
    for (const [name, fp] of PRESETS) {
      if (classOf(fp) !== 'rocky') continue;
      const R_c = fp.radiusEarth ?? 1.0, g_c = bodySurfaceGravity(fp);
      for (const R of SWEEP) {
        if (R === R_c) continue;
        const g = deriveConditionVector(fp, null, R).surfaceGravity;
        expect(Object.is(g, RETIRED(g_c, R, R_c)), `${name} @R=${R} should have moved`).toBe(false);
        moved++;
      }
    }
    expect(moved).toBeGreaterThan(100);
  });

  it('the gate reads compositionClass, so an h2-he envelope alone is enough to exclude a body', () => {
    // Behavioural, not a grep: take a rocky-density body and give it an h2-he atmosphere. If the
    // gate were keyed on density instead, this would still take the rocky branch.
    const rockyish = { radiusEarth: 1.0, massEarth: 1.0, composition: { density: 5.5 } };
    const gassy = { ...rockyish, atmosphere: { composition: 'h2-he' } };
    expect(compositionClass(deriveConditionVector(rockyish, null, 1))).toBe('rocky');
    expect(compositionClass(deriveConditionVector(gassy, null, 1))).toBe('gas');
    expect(deriveConditionVector(gassy, null, 2).surfaceGravity).toBe(2);          // retired law
    expect(deriveConditionVector(rockyish, null, 2).surfaceGravity).toBeCloseTo(Math.pow(2, 1.70), 12);
  });

  it('carbon and icy are excluded too — not only the gas giants', () => {
    const base = { radiusEarth: 1.0, massEarth: 1.0 };
    const carbon = { ...base, composition: { density: 6.0, carbonToOxygen: 1.2 } };
    const icy = { ...base, composition: { density: 2.0 } };
    expect(compositionClass(deriveConditionVector(carbon, null, 1))).toBe('carbon');
    expect(compositionClass(deriveConditionVector(icy, null, 1))).toBe('icy');
    expect(deriveConditionVector(carbon, null, 2).surfaceGravity).toBe(2);
    expect(deriveConditionVector(icy, null, 2).surfaceGravity).toBe(2);
  });
});

describe('AC-LAW — the shipped exponents measured off the shipped function', () => {
  const fpFor = (density) => ({ radiusEarth: 1.0, massEarth: 1.0, composition: { density } });
  const gAt = (fp, R) => deriveConditionVector(fp, null, R).surfaceGravity;

  it('a rocky body measures 1.70 inside Zeng’s validity band R ∈ [1.000, 1.754]', () => {
    const fp = fpFor(5.5);
    const slope = Math.log(gAt(fp, 1.75) / gAt(fp, 1.05)) / Math.log(1.75 / 1.05);
    expect(slope).toBeCloseTo(1.70, 10);
  });

  it('a rocky body measures 4/3 below 1 R⊕', () => {
    const fp = fpFor(5.5);
    const slope = Math.log(gAt(fp, 0.98) / gAt(fp, 0.40)) / Math.log(0.98 / 0.40);
    expect(slope).toBeCloseTo(4 / 3, 10);
  });

  it('a sweep ACROSS the join measures neither branch — the reason the registry has two entries', () => {
    // Documented so nobody "simplifies" the two registry entries into one and then reads the blend
    // as a law failure. This is the measured value quoted in laws.js.
    const fp = fpFor(5.5);
    const slope = Math.log(gAt(fp, 4.0) / gAt(fp, 0.5)) / Math.log(4.0 / 0.5);
    expect(slope).toBeGreaterThan(GRAV_R_EXP_SUB);
    expect(slope).toBeLessThan(GRAV_R_EXP_SUPER);
  });

  it('the exponent is composition-BLIND within rocky — Zeng’s CMF prefactor cancels in the ratio', () => {
    // Why no CMF / iron-fraction plumbing is needed. Densities spanning the rocky band must give
    // the identical shape ratio.
    const ref = gravityRadiusRatio(1.6, 1.0, 'rocky');
    for (const density of [4.0, 5.5, 7.0, 8.0]) {
      expect(gAt(fpFor(density), 1.6), `density ${density}`).toBeCloseTo(ref, 14);
    }
  });

  it('the headline number: a 1.6 R⊕ Earth-composition world reads 2.223 g, not 1.600', () => {
    const g = gAt(fpFor(5.5), 1.6);
    expect(g).toBeCloseTo(2.2233302, 6);
    expect(g / 1.6).toBeCloseTo(1.390, 3);      // the 39% under-read the fix removes
  });

  it('the rocky gravity span across the slider is 554.9×, NOT 53.3× and NOT (span)^1.70', () => {
    // ⚠ THE RATIO-FORM TRAP, caught by this test on its first run and kept as the demonstration.
    //
    // The slider range [0.3, 16] CROSSES the R = 1 join, so the span is the piecewise composition
    //     16^1.70 / 0.3^(4/3) = 554.85
    // and NOT the pure ratio power (16/0.3)^1.70 = 862.78. The grounding's §5 quotes 862.78, which
    // is correct for the UNGATED PURE-POWER mutation it measured and wrong for the piecewise law
    // that shipped. An assertion written from that number fails here — which is the point: any
    // expression that treats this law as a single power over a range spanning R = 1 is wrong, and
    // that is precisely why 8 of the 13 rocky/icy presets (R_c < 1) could not have been served by
    // a single ratio power.
    const fp = fpFor(5.5);
    const span = gAt(fp, RADIUS_SLIDER_MAX) / gAt(fp, RADIUS_SLIDER_MIN);
    const piecewise = Math.pow(RADIUS_SLIDER_MAX, GRAV_R_EXP_SUPER) / Math.pow(RADIUS_SLIDER_MIN, GRAV_R_EXP_SUB);
    expect(span).toBeCloseTo(piecewise, 9);
    expect(span).toBeCloseTo(554.85, 2);
    expect(span).not.toBeCloseTo(Math.pow(RADIUS_SLIDER_MAX / RADIUS_SLIDER_MIN, GRAV_R_EXP_SUPER), 0);
    expect(REACH_LO).toBeLessThan(RADIUS_SLIDER_MIN);   // the lab-unlocked floor really is lower
    expect(REACH_HI).toBe(16);
  });
});

describe('the retired law is gone from behaviour, not merely from the comments', () => {
  it('no rocky preset reproduces g_c·(R/R_c) at R = 2× canonical', () => {
    for (const [name, fp] of PRESETS) {
      if (classOf(fp) !== 'rocky') continue;
      const R_c = fp.radiusEarth ?? 1.0, g_c = bodySurfaceGravity(fp);
      const g = deriveConditionVector(fp, null, 2 * R_c).surfaceGravity;
      expect(Math.abs(g - g_c * 2) / (g_c * 2), name).toBeGreaterThan(0.05);
    }
  });
});
