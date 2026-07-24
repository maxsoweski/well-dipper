// tests/instrument-sweep.test.js
// Non-visual analysis channel — AC-CURVE (headless half).
//
// The sweep decides what a set of measurements is ALLOWED to claim, so it is tested against synthetic
// worlds whose true exponent is known before the measurement — including a world that obeys a law
// exactly, one that ignores the driver entirely, and one so noisy that the honest answer is "this
// sweep cannot tell". That last case is the whole point: an instrument that cannot say "I don't know"
// will eventually say something false with confidence.

import { describe, it, expect } from 'vitest';
import { responseCurve, planSweep, flatten } from '../src/worldengine/instrument/sweep.js';
import { lawVerdict } from '../src/worldengine/instrument/stats.js';

// A deterministic pseudo-random generator: sweeps must be reproducible, and Math.random is not.
const rng = (seed) => {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
};
// Deterministic standard normal (Box-Muller) so "noise" in these fixtures is exactly reproducible.
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

/**
 * A synthetic world: descriptor = A * value^exponent, perturbed by seed noise of the given CV.
 *
 * The noise is keyed on BOTH seed and driver value, which matters more than it looks. Keying it on
 * the seed alone makes each seed a constant multiplier across the whole sweep — that shifts the fit's
 * intercept and leaves its slope exact, so every fit returned the true exponent with zero standard
 * error no matter how large the noise was. Real procedural seed noise re-keys the field independently
 * at every point, which is what actually degrades an exponent. (The first version of this fixture had
 * the correlated form and made the noisy-sweep tests vacuous.)
 */
function makeWorld({ exponent, A = 10, noiseCV = 0 }) {
  return async ({ value, seed }) => {
    const r = rng(Math.imul(seed, 7919) ^ Math.imul(Math.round(value * 1000), 104729));
    const base = A * Math.pow(value, exponent);
    return { formWavelength: noiseCV > 0 ? base * (1 + noiseCV * gauss(r)) : base };
  };
}

const noop = async () => {};
const VALUES = [0.5, 1, 2, 4, 8, 16];
const SEEDS = (m) => Array.from({ length: m }, (_, i) => i + 1);

describe('responseCurve', () => {
  it('recovers an exact power law from a noiseless world', async () => {
    const res = await responseCurve({
      values: VALUES, seeds: [1], setPoint: noop, measure: makeWorld({ exponent: 0.5 }),
    });
    expect(res.fits.formWavelength.exponent).toBeCloseTo(0.5, 6);
    expect(res.N).toBe(6);
    expect(res.M).toBe(1);
  });

  it('recovers the sqrt-R response the live lab actually shows', async () => {
    // The live single-seed reading had form size going as ~R^0.5. A sweep over a world built to
    // that law must return 0.5 — this is the fixture that says the census arithmetic is right.
    const res = await responseCurve({
      values: [2, 4, 8], seeds: SEEDS(5), setPoint: noop,
      measure: makeWorld({ exponent: 0.5, A: 24.8, noiseCV: 0.05 }),
    });
    expect(res.fits.formWavelength.exponent).toBeCloseTo(0.5, 1);
  });

  it('recovers a null response as an exponent indistinguishable from zero', async () => {
    const res = await responseCurve({
      values: VALUES, seeds: SEEDS(5), setPoint: noop,
      measure: makeWorld({ exponent: 0, noiseCV: 0.05 }),
    });
    const fit = res.fits.formWavelength;
    expect(Math.abs(fit.exponent)).toBeLessThan(0.1);
    // And the verdict layer must call a claimed 0.34 law FAILED on this world, not unresolvable:
    // the precision here is good enough to tell "no response" from "the law".
    const v = lawVerdict({ measured: fit.exponent, measuredSE: fit.exponentSE, claimed: 0.34 });
    expect(v.verdict).toBe('FAIL');
  });

  it('shrinks the standard error as seeds are added', async () => {
    const world = makeWorld({ exponent: 0.5, noiseCV: 0.3 });
    const few = await responseCurve({ values: VALUES, seeds: SEEDS(3), setPoint: noop, measure: world });
    const many = await responseCurve({ values: VALUES, seeds: SEEDS(30), setPoint: noop, measure: world });
    const semFew = few.points[3].stats.formWavelength.sem;
    const semMany = many.points[3].stats.formWavelength.sem;
    expect(semMany).toBeLessThan(semFew);
  });

  it('reports mean and SEM at every point rather than a bare number', async () => {
    const res = await responseCurve({
      values: [1, 2, 4], seeds: SEEDS(6), setPoint: noop, measure: makeWorld({ exponent: 1, noiseCV: 0.2 }),
    });
    for (const p of res.points) {
      const s = p.stats.formWavelength;
      expect(s.n).toBe(6);
      expect(Number.isFinite(s.mean)).toBe(true);
      expect(Number.isFinite(s.sem)).toBe(true);
      expect(s.sem).toBeGreaterThan(0);
    }
  });

  it('visits every (value, seed) combination exactly once, in order', async () => {
    const visited = [];
    await responseCurve({
      values: [1, 2], seeds: [7, 8, 9],
      setPoint: async ({ value, seed }) => { visited.push(`${value}:${seed}`); },
      measure: makeWorld({ exponent: 1 }),
    });
    expect(visited).toEqual(['1:7', '1:8', '1:9', '2:7', '2:8', '2:9']);
  });

  it('survives a failed reading, records it, and still fits the rest', async () => {
    let calls = 0;
    const res = await responseCurve({
      values: VALUES, seeds: SEEDS(3), setPoint: noop,
      measure: async ({ value, seed }) => {
        calls++;
        if (value === 4 && seed === 2) throw new Error('GPU hiccup');
        return { formWavelength: 10 * Math.pow(value, 0.5) };
      },
    });
    expect(res.failures.length).toBe(1);
    expect(res.failures[0]).toMatchObject({ value: 4, seed: 2 });
    expect(res.fits.formWavelength.exponent).toBeCloseTo(0.5, 6);
    expect(calls).toBe(18);
  });

  it('keeps both reporting frames through the sweep instead of dropping one', async () => {
    const res = await responseCurve({
      values: [1, 2, 4], seeds: [1],
      setPoint: noop,
      measure: async ({ value }) => ({
        physical: { formWavelength: 30 * Math.pow(value, 0.5) },
        angular: { formWavelength: 30 * Math.pow(value, -0.5) },
      }),
    });
    expect(res.descriptors).toContain('physical.formWavelength');
    expect(res.descriptors).toContain('angular.formWavelength');
    expect(res.fits['physical.formWavelength'].exponent).toBeCloseTo(0.5, 6);
    expect(res.fits['angular.formWavelength'].exponent).toBeCloseTo(-0.5, 6);
  });

  it('refuses a sweep too small to fit anything', async () => {
    await expect(responseCurve({ values: [1], seeds: [1], setPoint: noop, measure: makeWorld({ exponent: 1 }) }))
      .rejects.toThrow(/at least 2 driver values/);
  });
});

describe('planSweep — sizing the ensemble before it runs', () => {
  it('turns a measured noise floor into a required seed count', async () => {
    // Pilot at ONE driver value, so every bit of spread is instrument noise by construction —
    // the same design as the 5-seed fixed-radius ensemble that diagnosed the read-gate.
    const world = makeWorld({ exponent: 0.5, noiseCV: 0.245 });
    const pilot = [];
    for (const seed of SEEDS(40)) pilot.push(await world({ value: 2, seed }));
    const plan = planSweep(pilot, { targetFraction: 0.15 });
    const d = plan.perDescriptor.formWavelength;
    expect(d.cv).toBeGreaterThan(0.15);
    expect(d.cv).toBeLessThan(0.35);
    // Same arithmetic the diagnosis published: measuring is cheaper than resolving.
    expect(d.seedsToResolve).toBeGreaterThan(d.seedsToMeasure);
  });

  it('demands more seeds from a noisier instrument', async () => {
    const quiet = [], loud = [];
    for (const seed of SEEDS(40)) {
      quiet.push(await makeWorld({ exponent: 0, noiseCV: 0.05 })({ value: 2, seed }));
      loud.push(await makeWorld({ exponent: 0, noiseCV: 0.4 })({ value: 2, seed }));
    }
    const pq = planSweep(quiet, { targetFraction: 0.15 }).seedsToMeasureAll;
    const pl = planSweep(loud, { targetFraction: 0.15 }).seedsToMeasureAll;
    expect(pl).toBeGreaterThan(pq);
  });
});

describe('the case the read-gate got wrong', () => {
  it('reports UNRESOLVABLE when the sweep is too small to tell the law from no response', async () => {
    // A real 0.34 response measured through an instrument far noisier than the effect. The honest
    // answer is not "pass" and not "fail" — it is that this experiment cannot decide, plus how many
    // more seeds would. A two-valued system would have had to call it something.
    const res = await responseCurve({
      values: [1, 2, 4], seeds: SEEDS(3), setPoint: noop,
      measure: makeWorld({ exponent: 0.34, noiseCV: 1.2 }),
    });
    const fit = res.fits.formWavelength;
    const v = lawVerdict({ measured: fit.exponent, measuredSE: fit.exponentSE, claimed: 0.34 });
    expect(v.verdict).toBe('UNRESOLVABLE');
    expect(v.seedMultiplierNeeded).toBeGreaterThan(1);
  });

  it('resolves that same law once the ensemble is large enough', async () => {
    const res = await responseCurve({
      values: [0.5, 1, 2, 4, 8, 16], seeds: SEEDS(60), setPoint: noop,
      measure: makeWorld({ exponent: 0.34, noiseCV: 0.25 }),
    });
    const fit = res.fits.formWavelength;
    const v = lawVerdict({ measured: fit.exponent, measuredSE: fit.exponentSE, claimed: 0.34 });
    expect(v.verdict).toBe('PASS');
    expect(fit.exponent).toBeCloseTo(0.34, 1);
  });
});

describe('flatten', () => {
  it('keeps finite numbers, drops nulls and strings, and namespaces one level', () => {
    const f = flatten({ a: 1, b: null, c: 'x', d: NaN, e: true, nest: { p: 2, q: 'y' } });
    expect(f).toEqual({ a: 1, e: 1, 'nest.p': 2 });
  });

  it('excludes bookkeeping namespaces so a seed is never swept as a descriptor', () => {
    // The live pilot swept macroSeed and reported its noise floor. It varies because we vary it.
    const f = flatten({
      meta: { macroSeed: 1234, visScale: 2, radiusEarth: 4 },
      sampledAt: { latDeg: 10 },
      physical: { formWavelength: 51 },
    });
    expect(f).toEqual({ 'physical.formWavelength': 51 });
  });
});

describe('relative noise is refused where it is undefined', () => {
  it('marks a zero-crossing quantity rather than demanding a thousand seeds for it', () => {
    // An elevation field centred near zero: mean ~0.006 against a spread of ~0.03. CV = 484%, and a
    // naive plan asks for 1040 seeds. That is division by almost-nothing, not an instrument property.
    const pilot = [-0.03, 0.02, -0.01, 0.04, 0.005, -0.02].map((v) => ({ elevationMean: v, formWavelength: 50 + v }));
    const plan = planSweep(pilot, { targetFraction: 0.15 });
    expect(plan.perDescriptor.elevationMean.relativeNoiseUndefined).toBe(true);
    expect(Number.isNaN(plan.perDescriptor.elevationMean.seedsToMeasure)).toBe(true);
    expect(plan.descriptorsWithUndefinedRelativeNoise).toContain('elevationMean');
    // ...and it must not contaminate the headline figure for the descriptors that ARE well-defined.
    expect(plan.seedsToMeasureAll).toBeLessThan(10);
    expect(plan.seedsToMeasureDrivenBy).toBe('formWavelength');
  });

  it('names the descriptor driving the headline seed count', () => {
    const pilot = [];
    for (let i = 0; i < 12; i++) {
      pilot.push({ quiet: 100 + (i % 3), noisy: 100 + (i % 3) * 40 });
    }
    const plan = planSweep(pilot, { targetFraction: 0.05 });
    expect(plan.seedsToMeasureDrivenBy).toBe('noisy');
    expect(plan.perDescriptor.noisy.seedsToMeasure)
      .toBeGreaterThan(plan.perDescriptor.quiet.seedsToMeasure);
  });
});
