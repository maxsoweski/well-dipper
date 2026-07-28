// src/worldengine/instrument/laws.js
// Non-visual analysis channel — THE LAW REGISTRY (nonvisual-analysis-channel-2026-07-24, AC-LAWS).
//
// THREE-FREE, PURE, HEADLESS. "Does it obey the laws we claimed?" — turned from comments into
// assertions. Each entry names a scaling law the codebase STATES, points at the line that states it,
// and evaluates the real function across a driver sweep so the claimed exponent can be measured.
//
// ── WHAT THIS LAYER CAN AND CANNOT TELL YOU (stated up front, because it is easy to oversell) ──
//
// These laws are audited against the PURE FUNCTIONS that define them, so most of them are true by
// construction on the day they are written. That makes this a DRIFT GUARD, not an independent
// physical validation: it catches a law quietly changing, a constant being retuned, a coupling being
// removed — it does not prove the physics is right. The claim "this reaches the render" belongs to
// the FIELD layer (fieldSampler + sweep), which measures what actually draws. Two layers, different
// questions, and neither substitutes for the other.
//
// ── A CORRECTION THIS FILE EXISTS TO CARRY (2026-07-24) ──
//
// The workstream contract, the prior handoff, and the program memory all cite "crater count ∝ g^0.34"
// as a live law. IT IS NOT. bombardment.js's own header records that the gravity COUNT factor was
// REMOVED as unphysical — "primary impact FLUX does not depend on target surface gravity"
// (footnote 1) — and the code comments the surviving behaviour explicitly: "count is g-independent"
// (bombardment.js:170). What survives is the gravity SIZE law, D ∝ g^-K_GS with K_GS = 0.17.
//
// So the registry below asserts the CURRENT laws, read out of the source. The g-independence of
// count is itself registered as a law with a claimed exponent of ZERO — a null law is still a claim,
// and it is the sharpest positive-control target in the set: re-introducing any gravity-count
// coupling must make this audit fail by name.

import {
  craterSchedule, isImpactSurface,
  G_REF, K_GS, B_SFD, C_BASIN,
} from '../base/bombardment.js';
import { reliefEnvelope, Q_RELIEF, RELIEF_FLOOR, RELIEF_CEIL } from '../../../planet-lod-lab-core.js';
import { deriveConditionVector, GRAV_R_EXP_SUB, GRAV_R_EXP_SUPER } from '../../../body-condition-vector.js';
import { fitPowerLaw, lawVerdict, DEFAULT_Z } from './stats.js';

/**
 * A synthetic rocky preset for the gravity laws below. Deliberately NOT a real DRIVER_PRESETS entry:
 * the law under audit is the radius→gravity SHAPE, and anchoring it at R_c = 1, g_c = 1 makes the
 * measured exponent read directly off the returned value. density 5.5 with no h2-he atmosphere and
 * C:O = 0 classifies `rocky`, so the self-compression branch is the one exercised.
 */
const ROCKY_FP = Object.freeze({
  radiusEarth: 1.0,
  massEarth: 1.0,
  composition: Object.freeze({ density: 5.5 }),
  age: 4.5,
  T_eq: 288,
});

/**
 * A baseline condition that passes `isImpactSurface` — cold enough and with a thin enough atmosphere
 * to have a reachable solid surface. Overrides are shallow-merged so a law can vary one driver.
 */
export function baselineCondition(overrides = {}) {
  return {
    radiusEarth: 1.0,
    surfaceGravity: G_REF,
    age: 4.0,
    T_eq: 250,
    rawTidalIoRatio: 0,
    atmosphere: { pressure: 0 },
    ...overrides,
  };
}

/**
 * The registry. Each law is falsifiable against a measurable output of a real function.
 *
 * driver          the condition key swept
 * values          the sweep points (chosen inside each law's physical validity band)
 * claimedExponent what the codebase says the exponent is
 * nullValue       the "driver does nothing" exponent — usually 0, but for a law whose claim IS
 *                 zero the null must be something else, or PASS becomes unreachable (see below)
 * measure         (condition, deps) => number
 */
export const LAW_REGISTRY = [
  {
    id: 'crater-size-vs-gravity',
    claim: 'crater size multiplier scales as g^-0.17 (pi-group size scaling)',
    source: 'src/worldengine/base/bombardment.js:170 — sizeMul = (G_REF/g)^K_GS, K_GS = 0.17',
    driver: 'surfaceGravity',
    values: [0.1, 0.2, 0.35, 0.5, 1.0, 2.0, 4.0],
    claimedExponent: -K_GS,
    nullValue: 0,
    measure: (c, deps) => deps.craterSchedule(c).sizeMul,
  },
  {
    id: 'crater-count-independent-of-gravity',
    claim: 'primary impact flux does NOT depend on target surface gravity — count is g-independent',
    source: 'src/worldengine/base/bombardment.js:13-14 (footnote 1, count factor removed) and :170',
    driver: 'surfaceGravity',
    values: [0.1, 0.2, 0.35, 0.5, 1.0, 2.0, 4.0],
    claimedExponent: 0,
    // A NULL LAW inverts the usual test. Ordinarily PASS requires "consistent with the claim AND
    // distinguishable from the null"; when the CLAIM IS the null those two collide and PASS becomes
    // unreachable. So the alternative this law must be distinguishable from is a real coupling — the
    // g^0.34 count factor that was removed as unphysical, i.e. the exact regression being guarded.
    nullValue: 0.34,
    nullMeaning: 'the removed, unphysical gravity-count coupling (g^0.34)',
    measure: (c, deps) => deps.craterSchedule(c).nAnalytic,
  },
  {
    id: 'crater-count-vs-radius',
    claim: 'analytic crater count scales as R^2 (count is areal — F_REF * R * R * chronN * screen)',
    source: 'src/worldengine/base/bombardment.js:181 — nAnalytic = F_REF*R*R*chronN(tExp)*screen',
    driver: 'radiusEarth',
    values: [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0],
    claimedExponent: 2,
    nullValue: 0,
    measure: (c, deps) => deps.craterSchedule(c).nAnalytic,
  },
  {
    id: 'mesh-floor-vs-radius',
    claim: 'the angular mesh floor expressed in km scales as R^1 — the R-invariance of on-screen '
         + 'crater size that Max hit at the inc3b UAT, registered so it can never be silently lost',
    source: 'src/worldengine/base/bombardment.js:176 — D_FLOOR_KM = MESH_FLOOR_RAD / radPerKm(R)',
    driver: 'radiusEarth',
    values: [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0],
    claimedExponent: 1,
    nullValue: 0,
    measure: (c, deps) => deps.craterSchedule(c).D_FLOOR_KM,
  },
  {
    id: 'basin-cap-vs-radius',
    claim: 'the upper crater edge is the disruption limit, H = C_BASIN * R_km, so H scales as R^1',
    source: `src/worldengine/base/bombardment.js:172 — H = C_BASIN * R_km (C_BASIN = ${C_BASIN})`,
    driver: 'radiusEarth',
    values: [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0],
    claimedExponent: 1,
    nullValue: 0,
    measure: (c, deps) => deps.craterSchedule(c).D_HI_KM,
  },
  {
    id: 'relief-envelope-vs-gravity',
    claim: `relief/R scales as g^-Q_RELIEF (Q_RELIEF = ${Q_RELIEF}), clamped to [${RELIEF_FLOOR}, ${RELIEF_CEIL}]`,
    source: 'planet-lod-lab-core.js — reliefEnvelope(R, g) = clamp(g^-Q_RELIEF, FLOOR, CEIL)',
    driver: 'surfaceGravity',
    // Swept strictly INSIDE the clamp band: the floor binds at g >~ 4.85, and a law audit that
    // sweeps across its own clamp measures the clamp, not the law.
    values: [0.15, 0.25, 0.4, 0.6, 1.0, 1.6, 2.5],
    claimedExponent: -Q_RELIEF,
    nullValue: 0,
    measure: (c, deps) => deps.reliefEnvelope(c.radiusEarth, c.surfaceGravity),
  },

  // ── The two gravity-vs-radius laws (gravity-selfcompression-2026-07-28). ──────────────────────
  //
  // Every law above pins something gravity DRIVES. Nothing pinned what drives GRAVITY, so the
  // mass-radius relation underneath the whole registry was unguarded and could be retuned silently.
  // These two close that.
  //
  // WHY TWO ENTRIES AND NOT ONE. The law is piecewise in ABSOLUTE radius, so a single entry would
  // have a hidden breakpoint and any sweep spanning it would measure the blend rather than either
  // branch. (Measured: a [0.5 … 4.0] sweep returns 1.507 ± 0.070, which FAILS a claim of 1.70 —
  // the law is fine, the sweep is wrong.) Each entry therefore sweeps strictly inside its own
  // branch, the same discipline relief-envelope-vs-gravity uses to stay inside its clamp.
  //
  // WHY nullValue IS 1.0 AND NOT 0. "gravity ignores radius" is not a state this code can reach —
  // g = M/R² is radius-driven under any mass law — so a null of 0 guards nothing and a
  // resolution-poor sweep would return a false PASS. The alternative each law must be separable
  // FROM is the law it replaced: the constant-density g ∝ R^1. Same construction as
  // crater-count-independent-of-gravity, whose null is the removed g^0.34 coupling rather than 0.
  //
  // CALIBRATION vs DERIVATION: there is no measured super-Earth gravity and no measured
  // super-Earth topography anywhere in this chain. Both exponents come from interior-structure
  // MODELS. The high branch is derivation; the low branch is derivation plus an acknowledged
  // extrapolation off an iron-rich family (see body-condition-vector.js for the full account).
  {
    id: 'gravity-vs-radius-selfcompression-super',
    claim: `above 1 R⊕ surface gravity scales as R^${GRAV_R_EXP_SUPER} on the drawn-radius axis — `
         + 'the rocky mass-radius relation M ∝ R^3.7 (self-compression at fixed composition) '
         + 'divided by the R² in g = M/R², replacing the constant-density M ∝ R³ form that gave R^1',
    source: 'body-condition-vector.js (REPO ROOT, not src/worldengine/base/) — gravityRadiusShape(R) '
          + `= R^${GRAV_R_EXP_SUPER} for R > 1; Zeng, Sasselov & Jacobsen 2016, ApJ 819:127 `
          + '(arXiv:1512.08827), R/R⊕ = (1.07 − 0.21·CMF)·(M/M⊕)^(1/3.7), applicable 1–8 M⊕ and '
          + 'CMF 0.0–0.4. The CMF prefactor cancels in the normalized-at-canonical ratio form, so '
          + 'the exponent is composition-blind WITHIN the rocky class.',
    driver: 'radiusEarth',
    // Strictly inside Zeng's own validity band: 1–8 M⊕ maps to R ∈ [1.000, 1.754] at CMF = 1/3
    // (8^(1/3.7) = 1.7542). Sweeping past 1.754 would audit the law against an extrapolation of
    // the fit it cites.
    values: [1.05, 1.15, 1.25, 1.35, 1.45, 1.60, 1.75],
    // ⚠ LITERAL, deliberately NOT GRAV_R_EXP_SUPER. If the claim is read from the same constant
    // production uses, a silent retune of that constant moves the claim and the measurement
    // together and this audit degrades to UNRESOLVABLE instead of FAIL — it stops being a guard.
    // Verified: with the constants zeroed to 1.0 and claimedExponent bound to them, the audit
    // reported UNRESOLVABLE. Same defect class as a test that re-derives its expected value
    // from the function under test; it bit this workstream twice before this line was written.
    claimedExponent: 1.70,
    nullValue: 1.0,
    nullMeaning: 'the retired constant-density law g = g_c·(R/R_c)^1 (M ∝ R³, density held fixed)',
    measure: (c, deps) => deps.deriveConditionVector(ROCKY_FP, null, c.radiusEarth).surfaceGravity,
  },
  {
    id: 'gravity-vs-radius-selfcompression-sub',
    claim: `below 1 R⊕ surface gravity scales as R^${GRAV_R_EXP_SUB.toFixed(4)} — self-compression `
         + 'weakens as mass falls, so the exponent drops TOWARD the incompressible value of 1 '
         + 'without reaching it',
    source: 'body-condition-vector.js — gravityRadiusShape(R) = R^(4/3) for R ≤ 1; Valencia, '
          + "O'Connell & Sasselov 2006 (arXiv:astro-ph/0511150, Icarus 181:545) Table 2, five "
          + 'fitted β = 0.2991–0.3094 ⇒ n = 1/β − 2 = 1.23–1.34. INFERENCE FLAG: that family is '
          + 'Super-MERCURIES (CMF 50/65/80%); extrapolating to Earth-like CMF is ours, not theirs. '
          + '4/3 is the top of the defensible bracket, chosen for being exact and rational.',
    driver: 'radiusEarth',
    // Strictly below the R = 1 branch join. 0.98 rather than 1.0 as the top point so the sweep
    // never touches the breakpoint itself.
    values: [0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 0.98],
    claimedExponent: 4 / 3,   // LITERAL, not GRAV_R_EXP_SUB — see the note on the super branch
    nullValue: 1.0,
    nullMeaning: 'the retired constant-density law g = g_c·(R/R_c)^1 (M ∝ R³, density held fixed)',
    measure: (c, deps) => deps.deriveConditionVector(ROCKY_FP, null, c.radiusEarth).surfaceGravity,
  },
];

/** The real implementations. The positive control replaces one of these to plant a defect. */
export function defaultDeps() {
  return { craterSchedule, reliefEnvelope, isImpactSurface, deriveConditionVector };
}

/**
 * Audit one law: sweep its driver, fit the exponent, render a three-valued verdict.
 * No seeds and no ensemble — these are deterministic pure functions, so a single evaluation per
 * point IS the measurement. (The FIELD layer is where seeds matter.)
 */
export function auditLaw(law, { deps = defaultDeps(), condition = {}, z = DEFAULT_Z } = {}) {
  const points = [];
  for (const value of law.values) {
    const c = baselineCondition({ ...condition, [law.driver]: value });
    let y;
    try {
      y = law.measure(c, deps);
    } catch (err) {
      return {
        id: law.id, claim: law.claim, source: law.source, driver: law.driver,
        verdict: 'UNRESOLVABLE', reason: `measurement threw: ${err && err.message ? err.message : err}`,
      };
    }
    if (Number.isFinite(y)) points.push({ x: value, y });
  }
  const fit = fitPowerLaw(points, { z });
  const v = lawVerdict({
    measured: fit.exponent, measuredSE: fit.exponentSE,
    claimed: law.claimedExponent, nullValue: law.nullValue, z, label: law.id,
  });
  return {
    id: law.id, claim: law.claim, source: law.source, driver: law.driver,
    claimedExponent: law.claimedExponent, nullValue: law.nullValue,
    nullMeaning: law.nullMeaning || 'no response to this driver',
    measuredExponent: fit.exponent, measuredSE: fit.exponentSE, r2: fit.r2, points: points.length,
    verdict: v.verdict, reason: v.reason,
    seedMultiplierNeeded: v.seedMultiplierNeeded,
  };
}

/** Audit every registered law. Returns results plus a summary that leads with what failed. */
export function auditLaws({ registry = LAW_REGISTRY, deps = defaultDeps(), condition = {}, z = DEFAULT_Z } = {}) {
  const results = registry.map((law) => auditLaw(law, { deps, condition, z }));
  const by = (v) => results.filter((r) => r.verdict === v).map((r) => r.id);
  return {
    results,
    summary: {
      total: results.length,
      pass: by('PASS'), fail: by('FAIL'), unresolvable: by('UNRESOLVABLE'),
      allPass: by('FAIL').length === 0 && by('UNRESOLVABLE').length === 0,
    },
    layerNote: 'These audit the PURE FUNCTIONS that state each law — a drift guard, not an '
             + 'independent physical validation, and not evidence that the law reaches the render. '
             + 'That claim belongs to the field layer (fieldSampler + sweep).',
  };
}
