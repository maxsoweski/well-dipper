// src/worldengine/instrument/sweep.js
// Non-visual analysis channel — RESPONSE CURVES (nonvisual-analysis-channel-2026-07-24, AC-CURVE).
//
// THREE-FREE, PURE ORCHESTRATION. It takes two callbacks — one that puts the world into a state, one
// that measures it — and knows nothing about GPUs, uniforms or the lab. That is deliberate: it makes
// the part that decides what a measurement is ALLOWED TO CLAIM testable headlessly against synthetic
// worlds whose true exponent is known in advance.
//
// WHAT IT ANSWERS: "does system X respond to driver Y, and how?" Not by looking, and not from a
// single reading. It sweeps the driver across N values, repeats each at M seeds, and returns per
// point a mean with its standard error plus a fitted power-law exponent with ITS standard error.
//
// WHY M SEEDS IS NON-NEGOTIABLE. A procedural field re-keys completely on every reseed, so a single
// reading at each driver value measures the seed as much as the driver. On 2026-07-24 exactly this
// sank a read-gate: the band-width instrument's own seed-noise floor was ~25% while the effect under
// test was 15%, so the "failure" was a property of the ruler. The fix is not a better bar, it is an
// ensemble — and `requiredSeeds`/`seedsToResolve` compute how big it has to be BEFORE the sweep runs
// rather than after it fails. `planSweep` below does that as a first-class step.
//
// EVERY RESULT IS THREE-VALUED at the verdict layer (stats.js lawVerdict): a curve that cannot
// distinguish its own exponent from zero reports UNRESOLVABLE, never a quiet pass.

import { meanSEM, fitPowerLaw, requiredSeeds, seedsToResolve, DEFAULT_Z } from './stats.js';

/**
 * Sweep one driver and describe the response of every descriptor returned by `measure`.
 *
 * @param values    driver values to visit, e.g. [0.5, 1, 2, 4, 8, 16] for radius
 * @param seeds     array of seeds to repeat at each value (its length is M)
 * @param setPoint  async ({ value, seed, index }) => void — put the world in this state AND settle it.
 *                  Settling is the caller's job because only the caller knows the debounce.
 * @param measure   async ({ value, seed }) => object of numeric descriptors (flat or one level nested)
 * @param onProgress optional (done, total, label) => void
 *
 * Returns { points, fits, descriptors, M, N, failures } where points[i].stats[key] is
 * {mean, sd, sem, cv, n} and fits[key] is {exponent, exponentSE, r2, ...}.
 */
export async function responseCurve({ values, seeds, setPoint, measure, onProgress = null }) {
  if (!Array.isArray(values) || values.length < 2) throw new Error('responseCurve: need at least 2 driver values');
  if (!Array.isArray(seeds) || seeds.length < 1) throw new Error('responseCurve: need at least 1 seed');
  const total = values.length * seeds.length;
  let done = 0;
  const points = [];
  const failures = [];

  for (let vi = 0; vi < values.length; vi++) {
    const value = values[vi];
    const samples = [];               // one flattened descriptor object per seed
    for (let si = 0; si < seeds.length; si++) {
      const seed = seeds[si];
      try {
        await setPoint({ value, seed, index: vi * seeds.length + si });
        const m = await measure({ value, seed });
        samples.push(flatten(m));
      } catch (err) {
        // A single failed reading must not kill a long sweep — record it and carry on, so the
        // report can say "18 of 20 readings" instead of the whole run vanishing.
        failures.push({ value, seed, error: String(err && err.message ? err.message : err) });
      }
      done++;
      if (onProgress) onProgress(done, total, `value=${value} seed=${seed}`);
    }
    points.push({ value, n: samples.length, stats: aggregate(samples) });
  }

  // Descriptor key set = every numeric key that appeared at any point.
  const descriptors = [...new Set(points.flatMap((p) => Object.keys(p.stats)))].sort();

  const fits = {};
  for (const key of descriptors) {
    const pts = points
      .map((p) => ({ x: p.value, y: p.stats[key] ? p.stats[key].mean : NaN, sem: p.stats[key] ? p.stats[key].sem : NaN }))
      .filter((p) => Number.isFinite(p.y));
    fits[key] = fitPowerLaw(pts);
  }

  return { points, fits, descriptors, M: seeds.length, N: values.length, failures };
}

/**
 * How many seeds does this sweep NEED? Run a pilot ensemble at one driver value (where the driver
 * effect is zero by construction, so all spread is instrument noise), then report — per descriptor —
 * the seeds required to measure the mean to a target precision and to resolve an effect of a given
 * size. This is the read-gate's post-mortem arithmetic promoted to a pre-flight check.
 *
 * @param pilot     array of measurement objects taken at ONE fixed driver value, different seeds
 * @param targetFraction  precision wanted on the mean (e.g. 0.15 for 15%)
 * @param effectFraction  the size of effect that must be resolvable (defaults to targetFraction)
 */
export function planSweep(pilot, { targetFraction = 0.15, effectFraction = null, z = DEFAULT_Z } = {}) {
  const effect = effectFraction == null ? targetFraction : effectFraction;
  // NB: `pilot.map(flatten)` would pass the array INDEX as flatten's `prefix`, namespacing every
  // sample under a different key and collapsing each to n=1 (cv NaN). Wrap it.
  const flat = pilot.map((p) => flatten(p));
  const stats = aggregate(flat);
  const plan = {};
  const unusable = [];
  let worstMeasure = 0, worstResolve = 0, worstKey = null, worstResolveKey = null;
  for (const [key, s] of Object.entries(stats)) {
    if (!cvIsMeaningful(s)) {
      // Reported, not hidden — a descriptor whose relative noise is undefined is a fact about the
      // descriptor, and silently dropping it would misrepresent the coverage of the plan.
      plan[key] = {
        cv: NaN, sd: s.sd, mean: s.mean, relativeNoiseUndefined: true,
        seedsToMeasure: NaN, seedsToResolve: NaN,
        reason: 'mean sits within one standard deviation of zero — a relative (CV-based) seed count is '
              + 'not defined for this quantity; use its absolute spread instead',
      };
      unusable.push(key);
      continue;
    }
    const toMeasure = requiredSeeds(s.cv, targetFraction);
    const toResolve = seedsToResolve(s.cv, effect, z);
    plan[key] = { cv: s.cv, sd: s.sd, mean: s.mean, noiseFloorFraction: s.cv, seedsToMeasure: toMeasure, seedsToResolve: toResolve };
    if (Number.isFinite(toMeasure) && toMeasure > worstMeasure) { worstMeasure = toMeasure; worstKey = key; }
    if (Number.isFinite(toResolve) && toResolve > worstResolve) { worstResolve = toResolve; worstResolveKey = key; }
  }
  return {
    perDescriptor: plan,
    // Named, not bare: "you need N seeds" is unusable advice without knowing WHICH descriptor is
    // driving it — one demanding descriptor should not be read as a verdict on the whole sweep.
    seedsToMeasureAll: worstMeasure || NaN,
    seedsToMeasureDrivenBy: worstKey,
    seedsToResolveAll: worstResolve || NaN,
    seedsToResolveDrivenBy: worstResolveKey,
    descriptorsWithUndefinedRelativeNoise: unusable,
    targetFraction, effectFraction: effect, z, pilotN: pilot.length,
    note: 'Seeds required so the MEAN is precise to targetFraction, and so an effect of effectFraction '
        + 'clears its own error bar at z sigma. A bar tighter than the instrument can measure is not a '
        + 'bar — it is the read-gate failure (DIAGNOSIS.md, 2026-07-24).',
  };
}

/**
 * Flatten a measurement object one level, keeping only finite numbers. Frame-nested descriptors
 * (physical/angular) become "physical.formWavelength" style keys so both frames survive the sweep
 * and neither can be quietly dropped.
 */
export function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    // METADATA IS NOT A MEASUREMENT. A probe result carries bookkeeping alongside its descriptors —
    // the seed used, the sample location, the display scale. Swept naively, those become "descriptors"
    // with their own noise floors and fitted exponents: the first live pilot dutifully reported that
    // `macroSeed` had a 54% coefficient of variation, which is true and meaningless (it varies because
    // we vary it). Anything under `meta` is excluded from statistics and fits.
    if (!prefix && META_NAMESPACES.has(k)) continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    else if (typeof v === 'boolean') out[key] = v ? 1 : 0;
    else if (v && typeof v === 'object' && !Array.isArray(v) && !prefix) Object.assign(out, flatten(v, key));
  }
  return out;
}

/** Top-level keys on a probe result that are bookkeeping, never measurements. */
export const META_NAMESPACES = new Set(['meta', 'sampledAt', 'grids', 'dirs']);

/**
 * Is a coefficient of variation meaningful for this quantity?
 *
 * CV = sd/|mean| is a RELATIVE noise measure, and it only means anything for a quantity that stays
 * away from zero. An elevation field centred near zero has a mean of ~0.006 against a spread of
 * ~0.03, so its CV comes out at 484% and `requiredSeeds` politely demands 1040 seeds — an artifact of
 * dividing by almost nothing, not a property of the instrument. For those quantities the honest
 * report is the ABSOLUTE spread, and the relative figure is marked unavailable rather than quoted.
 */
export function cvIsMeaningful(stats) {
  return Number.isFinite(stats.cv) && Number.isFinite(stats.sd) && Math.abs(stats.mean) > stats.sd;
}

/** Per-key ensemble statistics across the seed samples at one driver value. */
function aggregate(samples) {
  const keys = [...new Set(samples.flatMap((s) => Object.keys(s)))];
  const out = {};
  for (const key of keys) {
    const vals = samples.map((s) => s[key]).filter(Number.isFinite);
    if (vals.length) out[key] = meanSEM(vals);
  }
  return out;
}
