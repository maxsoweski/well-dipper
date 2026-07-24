// src/worldengine/instrument/stats.js
// Non-visual analysis channel — ENSEMBLE STATISTICS + LAW VERDICTS (nonvisual-analysis-channel-2026-07-24).
//
// THREE-FREE, PURE. The half of the instrument that decides what a set of measurements is allowed to
// claim. Every number this module returns carries its own uncertainty, and every verdict it renders can
// come back UNRESOLVABLE.
//
// WHY UNRESOLVABLE EXISTS (the load-bearing idea in this file). On 2026-07-24 a read-gate bar of 15% was
// set on an instrument whose own seed-noise floor was ~25%. The measurement then "failed", and the
// failure was a property of the ruler, not of the build. A pass/fail-only verdict system cannot express
// that; it must call something, so it calls something wrong. So the verdict set here is three-valued:
//
//   PASS          the measurement is consistent with the claimed law AND could have distinguished it
//                 from the null (no response at all). Both halves are required.
//   FAIL          the measurement is inconsistent with the claimed law, beyond its own uncertainty.
//   UNRESOLVABLE  the confidence interval contains BOTH the claimed exponent AND the null. The sweep
//                 cannot tell "obeys the law" from "ignores the driver". This is not a pass. It is a
//                 statement that the experiment was too small, and it reports the M that would fix it.
//
// See docs/WORKSTREAMS/world-engine-radius-display-scale-2026-07-24/evidence/readgate-diagnosis/DIAGNOSIS.md
// for the incident this encodes.

/** Default two-sided coverage factor. 2 sigma ~ 95%; stated explicitly in every verdict. */
export const DEFAULT_Z = 2;

/**
 * Mean, sample SD (n-1), standard error of the mean, and coefficient of variation for one ensemble
 * (typically the M seeds measured at a single driver value).
 */
export function meanSEM(values) {
  const v = Array.from(values).filter(Number.isFinite);
  const n = v.length;
  if (!n) return { mean: NaN, sd: NaN, sem: NaN, cv: NaN, n: 0 };
  const mean = v.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { mean, sd: NaN, sem: NaN, cv: NaN, n };
  const varr = v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1);
  const sd = Math.sqrt(varr);
  return { mean, sd, sem: sd / Math.sqrt(n), cv: mean !== 0 ? sd / Math.abs(mean) : NaN, n };
}

/**
 * How many seeds per driver value are needed for the MEAN's standard error to fall below a target
 * fractional precision, given a measured coefficient of variation: M >= (cv / target)^2.
 *
 * This is DIAGNOSIS.md's arithmetic promoted from a post-mortem to a planning function — the instrument
 * now computes its own required sample size BEFORE the sweep instead of discovering afterwards that the
 * bar was unmeasurable.
 */
export function requiredSeeds(cv, targetFraction) {
  if (!(cv > 0) || !(targetFraction > 0)) return NaN;
  return Math.ceil(Math.pow(cv / targetFraction, 2));
}

/**
 * Seeds needed to RESOLVE a true effect of the given size at z sigma (a strictly harder ask than merely
 * measuring the mean to that precision — resolving needs the effect to clear its own error bar).
 */
export function seedsToResolve(cv, effectFraction, z = DEFAULT_Z) {
  if (!(cv > 0) || !(effectFraction > 0)) return NaN;
  return Math.ceil(Math.pow((z * cv) / effectFraction, 2));
}

/**
 * Weighted log-log least-squares power-law fit: y = A * x^b, returning the exponent b with its standard
 * error. Points may carry their own uncertainty (per-point SEM in y), in which case they are weighted by
 * 1/sigma^2 in log space — so a noisy radius point cannot drag the exponent as hard as a clean one.
 *
 * `points` is [{ x, y, sem }] with x > 0 and y > 0. Points with non-positive x or y are dropped (a
 * log-log fit has nothing to say about them) and reported in `dropped`.
 */
export function fitPowerLaw(points, { z = DEFAULT_Z } = {}) {
  const usable = [], dropped = [];
  for (const p of points) {
    if (p.x > 0 && p.y > 0 && Number.isFinite(p.x) && Number.isFinite(p.y)) usable.push(p);
    else dropped.push(p);
  }
  const n = usable.length;
  if (n < 2) return { exponent: NaN, exponentSE: NaN, coefficient: NaN, r2: NaN, n, dropped: dropped.length, z };
  const X = usable.map((p) => Math.log(p.x));
  const Y = usable.map((p) => Math.log(p.y));
  // Propagate a linear SEM into log space: d(ln y) = sem / y.
  const W = usable.map((p) => {
    const s = Number.isFinite(p.sem) && p.sem > 0 ? p.sem / p.y : 0;
    return s > 0 ? 1 / (s * s) : 1;
  });
  let sw = 0, swx = 0, swy = 0, swxx = 0, swxy = 0;
  for (let i = 0; i < n; i++) {
    sw += W[i]; swx += W[i] * X[i]; swy += W[i] * Y[i];
    swxx += W[i] * X[i] * X[i]; swxy += W[i] * X[i] * Y[i];
  }
  const denom = sw * swxx - swx * swx;
  if (Math.abs(denom) < 1e-15) return { exponent: NaN, exponentSE: NaN, coefficient: NaN, r2: NaN, n, dropped: dropped.length, z };
  const b = (sw * swxy - swx * swy) / denom;
  const a = (swy - b * swx) / sw;
  // Residual-based SE, scaled by the reduced chi-square so that under-estimated input errors inflate
  // the reported uncertainty rather than hiding in it.
  let chi2 = 0;
  for (let i = 0; i < n; i++) { const r = Y[i] - (a + b * X[i]); chi2 += W[i] * r * r; }
  const dof = Math.max(n - 2, 1);
  const seB = Math.sqrt((sw / denom) * (chi2 / dof));
  // r^2 must use the SAME weights as the fit. Computed unweighted it can come back strongly negative
  // for a perfectly good weighted fit — one noisy point that the fit correctly ignores still counts
  // full freight in an unweighted residual sum, and the reader sees "r2 = -1.46" beside an exponent
  // that is in fact accurate. (Observed on the first live radius sweep, where the R=2 point had 40x
  // the standard error of the others.)
  let wMeanY = 0;
  for (let i = 0; i < n; i++) wMeanY += W[i] * Y[i];
  wMeanY /= sw;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += W[i] * (Y[i] - wMeanY) ** 2;
    ssRes += W[i] * (Y[i] - (a + b * X[i])) ** 2;
  }
  return {
    exponent: b, exponentSE: seB, coefficient: Math.exp(a),
    r2: ssTot > 0 ? 1 - ssRes / ssTot : NaN,
    n, dropped: dropped.length, z,
  };
}

/**
 * Three-valued verdict on a claimed scaling exponent.
 *
 * @param measured    fitted exponent
 * @param measuredSE  its standard error
 * @param claimed     the exponent the codebase claims (e.g. 0.34 for crater count vs gravity)
 * @param nullValue   the "driver does nothing" exponent — 0 unless a system has a different null
 *
 * PASS         |measured - claimed| <= z*SE  AND  |measured - nullValue| > z*SE
 *              (consistent with the claim, and able to tell the claim from no-response-at-all)
 * FAIL         |measured - claimed| > z*SE
 * UNRESOLVABLE |measured - claimed| <= z*SE  AND  |measured - nullValue| <= z*SE
 *              (the interval swallows both — the sweep proves nothing either way)
 */
export function lawVerdict({ measured, measuredSE, claimed, nullValue = 0, z = DEFAULT_Z, label = '' }) {
  const base = { label, measured, measuredSE, claimed, nullValue, z, resolvingPower: z * measuredSE };
  if (!Number.isFinite(measured) || !Number.isFinite(measuredSE)) {
    return { ...base, verdict: 'UNRESOLVABLE', reason: 'fit did not converge to a finite exponent and uncertainty' };
  }
  const dClaim = Math.abs(measured - claimed);
  const dNull = Math.abs(measured - nullValue);
  const tol = z * measuredSE;
  if (dClaim > tol) {
    return {
      ...base, verdict: 'FAIL',
      reason: `measured ${measured.toFixed(3)} differs from claimed ${claimed} by ${dClaim.toFixed(3)}, beyond ${z}x its standard error (${tol.toFixed(3)})`,
    };
  }
  if (dNull <= tol) {
    const needed = Number.isFinite(measuredSE) && Math.abs(claimed - nullValue) > 0
      ? Math.ceil(Math.pow((z * measuredSE) / Math.abs(claimed - nullValue), 2))
      : NaN;
    return {
      ...base, verdict: 'UNRESOLVABLE',
      reason: `the ${z}-sigma interval (+/-${tol.toFixed(3)}) contains BOTH the claimed exponent ${claimed} and the null ${nullValue} — this sweep cannot tell the law from no response at all`,
      seedMultiplierNeeded: needed,
    };
  }
  return {
    ...base, verdict: 'PASS',
    reason: `measured ${measured.toFixed(3)} +/- ${measuredSE.toFixed(3)} is consistent with claimed ${claimed} and distinguishable from the null ${nullValue}`,
  };
}

/**
 * Did a descriptor move between two ensembles by more than their combined noise? The regression
 * channel's decision rule. Returns the shift in units of the combined standard error so a report can
 * rank what moved most, not merely list what tripped a threshold.
 */
export function shiftSignificance(baseline, current, { z = DEFAULT_Z } = {}) {
  const a = meanSEM(baseline), b = meanSEM(current);
  const combined = Math.sqrt((a.sem || 0) ** 2 + (b.sem || 0) ** 2);
  const delta = b.mean - a.mean;
  if (!Number.isFinite(delta)) return { moved: false, delta: NaN, sigma: NaN, baseline: a, current: b, z };
  if (!(combined > 0)) {
    return { moved: delta !== 0, delta, sigma: delta === 0 ? 0 : Infinity, baseline: a, current: b, z };
  }
  const sigma = delta / combined;
  return {
    moved: Math.abs(sigma) > z, delta, sigma,
    fractionalDelta: a.mean !== 0 ? delta / Math.abs(a.mean) : NaN,
    baseline: a, current: b, z,
  };
}
