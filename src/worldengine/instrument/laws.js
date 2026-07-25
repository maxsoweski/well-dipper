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
import { fitPowerLaw, lawVerdict, DEFAULT_Z } from './stats.js';

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
];

/** The real implementations. The positive control replaces one of these to plant a defect. */
export function defaultDeps() {
  return { craterSchedule, reliefEnvelope, isImpactSurface };
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
