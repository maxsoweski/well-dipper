// tests/worldengine-v2-6-gcohere.test.js — World Engine V2-6 slice 1 (AC-GCOHERE + §1B radPerKm).
//
// The root fix: deriveConditionVector's `surfaceGravity` field derives g from the DRAWN radius via a
// normalized-at-canonical RATIO form — the only shape byte-exact at canonical while making g coherent
// with drawn R off-canonical.
//
// ⚠ THE EXPONENT MOVED (gravity-selfcompression-2026-07-28). V2-6 shipped the constant-density law
// g = g_c·(R/R_c). It is now g = g_c·f(R)/f(R_c), f piecewise in ABSOLUTE Earth radii — R^(4/3) below
// 1 R⊕ (Valencia+2006) and R^1.70 above (Zeng+2016) — applied to the ROCKY class only; gas, icy and
// carbon bodies keep the retired exponent. The RATIO FORM and every byte-identity property below are
// unchanged; only the exponent is. The assertions in this file were re-pinned rather than deleted, and
// they still discriminate: reverting the source exponents to 1 fails them.
//
// This suite pins the four properties the slice contract names:
//   1. canonical bit-identity — new expression === legacy expression (both derived-present and fallback branch),
//      for every DRIVER_PRESETS entry, when R === R_c (the golden/NAMED_BODY/headless invariant). FENCE 1/2 proof.
//   2. drawn-R sweep — g = M_derived/R² exact-as-computed (g_c·R/R_c), monotone increasing in R, per preset.
//   3. massEarthOf round-trip — g·d² reconstructs M_derived = M_c·(R/R_c)³ within float64 ulp across the sweep.
//   4. condition-vector key-set unchanged — no new fields (FENCE 2: NAMED_BODY vectors keep their exact shape;
//      iceness/crystallizationPotential/radPerKm are computed DOWNSTREAM of the vector, never stored in it).
// Plus a small radPerKm unit (the §1B shared km→angular scalar this slice adds to baseStep.js).
import { describe, it, expect } from 'vitest';

import { deriveConditionVector, gravityRadiusShape } from '../body-condition-vector.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { bodySurfaceGravity, radPerKm, KM_PER_EARTH_RADIUS } from '../src/worldengine/base/baseStep.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';

const PRESETS = Object.entries(DRIVER_PRESETS);
// R sweep spans small showcase bodies through super-Earths / giants — deliberately away from canonical.
const R_SWEEP = [0.2, 0.35, 0.5, 0.75, 1.0, 1.6, 2.7, 5.0, 11.2];

// The legacy `surfaceGravity` expression, verbatim, so the byte-identity assert compares against ground truth.
const legacyG = (fp, derived) => derived?.surfaceGravity ?? bodySurfaceGravity(fp);

// Tight relative-ULP bound: the two ways of writing M_derived (g_c·(R/R_c) then ·R² vs M_c·(R/R_c)³) are
// algebraically equal but differ in float64 operation order, so the round-trip is asserted "within ulp".
const closeRel = (a, b, relEps = 1e-12) =>
  Math.abs(a - b) <= relEps * Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);

describe('V2-6 AC-GCOHERE — canonical bit-identity (R === R_c)', () => {
  it('new surfaceGravity === legacy expression at canonical R, every preset, fallback branch (derived=null)', () => {
    for (const [name, fp] of PRESETS) {
      const cv = deriveConditionVector(fp, null, fp.radiusEarth);
      // g_c·(R/R_c) with R === R_c ⇒ ratio 1.0 exactly ⇒ bit-for-bit equal to the legacy fallback g.
      expect(cv.surfaceGravity, name).toBe(legacyG(fp, null));
    }
  });

  it('new surfaceGravity === legacy expression at canonical R, derived-present branch', () => {
    for (const [name, fp] of PRESETS) {
      // A deterministic non-canonical derived.surfaceGravity proves the ratio is EXACTLY 1.0 and the value
      // passes through untouched (not just that the fallback happens to match).
      const derived = { surfaceGravity: 0.30103 * (1 + fp.radiusEarth) };
      const cv = deriveConditionVector(fp, derived, fp.radiusEarth);
      expect(cv.surfaceGravity, name).toBe(legacyG(fp, derived));
    }
  });

  it('condition vector for archetype presets is byte-equal whether radius is passed explicitly or omitted at canonical', () => {
    for (const [name, fp] of PRESETS) {
      const gExplicit = deriveConditionVector(fp, null, fp.radiusEarth).surfaceGravity;
      const gOmitted = deriveConditionVector(fp, null, undefined).surfaceGravity; // R falls back to fp.radiusEarth = R_c
      expect(gOmitted, name).toBe(gExplicit);
    }
  });
});

describe('V2-6 AC-GCOHERE — drawn-R sweep g = g_c·f(R)/f(R_c)', () => {
  // RE-PINNED 2026-07-28 (gravity-selfcompression). This assertion previously read
  //   expect(cv.surfaceGravity).toBe(g_c * (R / R_c))
  // which pinned the CONSTANT-DENSITY law (M ∝ R³ ⇒ g ∝ R¹). That law is false above 1 R⊕ —
  // self-compression makes larger rocky planets denser — so the assertion is rewritten onto the
  // shipped law rather than deleted. It still discriminates: reverting the source exponents to 1
  // makes every rocky preset fail here.
  it('surfaceGravity equals the coherence law as computed, exactly, across the R sweep', () => {
    for (const [name, fp] of PRESETS) {
      const R_c = fp.radiusEarth ?? 1.0;
      const g_c = bodySurfaceGravity(fp);
      const cls = compositionClass(deriveConditionVector(fp, null, R_c));
      for (const R of R_SWEEP) {
        const cv = deriveConditionVector(fp, null, R);
        // Non-rocky classes are gated OUT of the self-compression law and keep the plain ratio,
        // byte-for-byte. Asserting both branches here is what makes the gate falsifiable.
        const expected = cls === 'rocky'
          ? g_c * (gravityRadiusShape(R) / gravityRadiusShape(R_c))
          : g_c * (R / R_c);
        expect(cv.surfaceGravity, `${name} [${cls}] @R=${R}`).toBe(expected);
        expect(cv.radiusEarth, `${name} @R=${R}`).toBe(R); // the drawn radius is carried on the vector
      }
    }
  });

  it('surfaceGravity is strictly monotone increasing in drawn R (g_c > 0)', () => {
    for (const [name, fp] of PRESETS) {
      let prev = -Infinity;
      for (const R of R_SWEEP) {
        const g = deriveConditionVector(fp, null, R).surfaceGravity;
        expect(g, `${name} @R=${R}`).toBeGreaterThan(prev);
        prev = g;
      }
    }
  });
});

describe('V2-6 AC-GCOHERE — massEarthOf round-trip (g·d² === M_derived)', () => {
  // massEarthOf(cv) = cv.surfaceGravity · cv.radiusEarth² (e1Regime.js). It must reconstruct the
  // IMPLIED mass law, with M_c = g_c·R_c² the preset's canonical mass, within float64 ulp.
  //
  // RE-PINNED 2026-07-28 (gravity-selfcompression) — and this is the physically load-bearing one.
  // massEarthOf is g·R², so it carries the gravity exponent plus 2. When g moved from R^1 to the
  // piecewise (4/3, 1.70), the mass law these consumers see moved from a flat M ∝ R³ to
  // M ∝ R^(10/3) below 1 R⊕ and M ∝ R^3.7 above it. Nothing in e1Regime or giant-drivers was
  // edited — they reconstruct mass from a gravity that changed underneath them — so if this
  // assertion is not updated it silently certifies a mass law production no longer implements.
  it('reconstructs the implied mass law across the R sweep for every preset', () => {
    for (const [name, fp] of PRESETS) {
      const R_c = fp.radiusEarth ?? 1.0;
      const g_c = bodySurfaceGravity(fp);
      const M_c = g_c * R_c * R_c; // === fp.massEarth up to float round-trip; g_c already = massEarth/R_c²
      const cls = compositionClass(deriveConditionVector(fp, null, R_c));
      for (const R of R_SWEEP) {
        const cv = deriveConditionVector(fp, null, R);
        const massEarthOf = cv.surfaceGravity * cv.radiusEarth * cv.radiusEarth;
        // M = g·R² = M_c · [f(R)/f(R_c)] · (R/R_c)²  — the gravity shape times the areal term.
        const shapeRatio = cls === 'rocky'
          ? gravityRadiusShape(R) / gravityRadiusShape(R_c)
          : R / R_c;
        const M_derived = M_c * shapeRatio * (R / R_c) ** 2;
        expect(closeRel(massEarthOf, M_derived), `${name} [${cls}] @R=${R}`).toBe(true);
      }
    }
  });

  // The exponent stated in prose above, asserted numerically so the prose cannot rot. On the rocky
  // branch, well inside each domain, d(ln M)/d(ln R) must be 3+4/3 = 10/3 below 1 and 3.7 above it.
  it('the implied rocky mass exponent is 10/3 below 1 R⊕ and 3.7 above it', () => {
    const rocky = PRESETS.filter(([, fp]) =>
      compositionClass(deriveConditionVector(fp, null, fp.radiusEarth ?? 1.0)) === 'rocky');
    expect(rocky.length).toBe(8);
    const massAt = (fp, R) => {
      const cv = deriveConditionVector(fp, null, R);
      return cv.surfaceGravity * cv.radiusEarth * cv.radiusEarth;
    };
    for (const [name, fp] of rocky) {
      for (const [lo, hi, want] of [[0.5, 0.9, 10 / 3], [1.1, 1.7, 3.7]]) {
        const slope = Math.log(massAt(fp, hi) / massAt(fp, lo)) / Math.log(hi / lo);
        expect(Math.abs(slope - want), `${name} on [${lo},${hi}]`).toBeLessThan(1e-9);
      }
    }
  });

  it('at canonical R the round-trip mass equals the preset canonical mass (within ulp)', () => {
    for (const [name, fp] of PRESETS) {
      const cv = deriveConditionVector(fp, null, fp.radiusEarth);
      const massEarthOf = cv.surfaceGravity * cv.radiusEarth * cv.radiusEarth;
      const M_c = bodySurfaceGravity(fp) * fp.radiusEarth * fp.radiusEarth;
      expect(closeRel(massEarthOf, M_c), name).toBe(true);
    }
  });
});

describe('V2-6 FENCE 2 — condition-vector key-set unchanged', () => {
  const EXPECTED_KEYS = [
    'density', 'composition', 'age', 'radiusEarth', 'eccentricity', 'T_eq', 'surfaceGravity',
    'atmosphere', 'tidalState', 'rotationHours', 'rawTidalIoRatio', 'shellThickness',
    'magneticField', 'metallicity',
  ].sort();

  it('deriveConditionVector returns exactly the 14 legacy keys (no new fields), every preset × drawn/canonical R', () => {
    for (const [name, fp] of PRESETS) {
      for (const R of [fp.radiusEarth, 3.3]) {
        const keys = Object.keys(deriveConditionVector(fp, null, R)).sort();
        expect(keys, `${name} @R=${R}`).toEqual(EXPECTED_KEYS);
      }
    }
  });
});

describe('V2-6 §1B — radPerKm shared km→angular scalar', () => {
  it('KM_PER_EARTH_RADIUS is 6371 and radPerKm(1) = 1/6371', () => {
    expect(KM_PER_EARTH_RADIUS).toBe(6371);
    expect(radPerKm(1.0)).toBe(1 / 6371);
    expect(radPerKm(1.0)).toBe(1 / (6371 * 1.0));
  });

  it('is ∝ 1/R: radPerKm(2R) === radPerKm(R)/2 pattern holds across radii', () => {
    for (const R of R_SWEEP) {
      expect(radPerKm(R)).toBe(1 / (6371 * R));
      expect(closeRel(radPerKm(2 * R), radPerKm(R) / 2)).toBe(true);
    }
  });

  it('floors tiny/zero/nullish radius at 1e-6 (guards 1/0) and treats nullish as canonical 1.0', () => {
    expect(radPerKm(0)).toBe(1 / (6371 * 1e-6));
    expect(radPerKm(1e-12)).toBe(1 / (6371 * 1e-6));
    expect(radPerKm(undefined)).toBe(1 / 6371);
    expect(radPerKm(null)).toBe(1 / 6371);
    expect(Number.isFinite(radPerKm(0))).toBe(true);
  });
});
