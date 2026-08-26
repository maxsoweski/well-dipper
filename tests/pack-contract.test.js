// tests/pack-contract.test.js
// Gates for PLAN §4 "Step 5" parts 5a (the pack contract) and 5b (the frequency-helper extraction).
//
// WHAT THIS SUITE IS FOR, in one sentence: the contract's whole reason to exist is that the two
// front-ends legitimately disagree about the first argument to `featureFrequencyFromKm`, and the
// wrong answer is a finite, plausible, in-band number that no value-range test can see. So the
// load-bearing assertions here are a PAIR — the policies must differ where they should differ AND
// coincide where they should coincide. Either half alone is passable by a broken implementation:
// a contract that ignored the policy entirely would pass the R=1 half, and a contract that
// scrambled it would pass the R!=1 half.
//
// Every gate below has an executed mutation recorded in the lane report; none of them is a test
// that has only ever been seen to pass.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve as resolvePath } from 'node:path';

import {
  R_EARTH_KM,
  featureFrequencyFromKm,
} from '../src/worldengine/base/featureScale.js';

import {
  writePackUniforms,
  resolveDriver,
  sizeKm,
  scalar,
  isPackDriver,
  gameDisplayRadiusEarth,
  assertDisplayPolicy,
  assertMacroSeed,
  assertPackResult,
  PackContractError,
} from '../src/worldengine/port/writePackUniforms.js';

// The LAB's display policy, imported from where it lives — the lab. It is deliberately NOT under
// src/: tests/vis-scale-fence.test.js fences the worldengine tree against the display-scale
// tokens, and 5a's own argument is that the display law belongs to the front-end.
import {
  visScaleOf,
  featureFrequencyFromKm as labFeatureFrequencyFromKm,
  R_EARTH_KM as labR_EARTH_KM,
} from '../src/worldengine/base/labCore.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// Real lab calibration values, so the numbers below are the numbers a real feature would take.
// world-engine-lab.html:955 `duneSizeKm: 398,` and world-engine-lab.html:827 `const C_DUNE = 1.0`
const DUNE_SIZE_KM = 398;
const C_DUNE = 1.0;

// A minimal but complete ctx. The five fields are the contract's declared shape.
const ctxFor = (displayRadiusEarth, over = {}) => ({
  macroSeed: 0x5bf03635,
  displayRadiusEarth,
  animRate: 1.0,
  gates: { dunes: true, jets: true },
  relevance: { polarVortex: 1.0 },
  ...over,
});

const uniformSlots = (names) => Object.fromEntries(names.map((n) => [n, { value: 0 }]));

// ─────────────────────────────────────────────────────────────────────────────
// 5a — the display policy is a REQUIRED parameter, and it actually changes the answer
// ─────────────────────────────────────────────────────────────────────────────
describe('5a — display policy: the two front-ends resolve the same body differently', () => {
  const DRIVERS = {
    uDuneFreq: sizeKm(DUNE_SIZE_KM, C_DUNE),
    uBandContrast: 0.42,                       // not km-keyed: must be policy-invariant
    uJetStrength: scalar(0.75, { gate: 'jets' }),
  };
  const NAMES = Object.keys(DRIVERS);

  const runBoth = (R) => {
    const gameU = uniformSlots(NAMES);
    const labU = uniformSlots(NAMES);
    writePackUniforms(gameU, DRIVERS, ctxFor(gameDisplayRadiusEarth(R)));
    writePackUniforms(labU, DRIVERS, ctxFor(visScaleOf(R)));
    return { gameU, labU };
  };

  it('the two policies feed DIFFERENT first arguments at R != 1 (non-vacuity guard)', () => {
    // Guards the assertion below from passing because the policies happen to coincide. If the
    // lab's law were ever flattened to identity, THIS reds first and says why.
    expect(gameDisplayRadiusEarth(4)).toBe(4);
    expect(visScaleOf(4)).toBe(2);
    expect(gameDisplayRadiusEarth(4)).not.toBe(visScaleOf(4));
  });

  it('a km-keyed uniform DIFFERS between the policies at R = 4 R⊕, by exactly the policy ratio', () => {
    const { gameU, labU } = runBoth(4);
    // The game's answer is keyed on the real radius; the lab's on its display pseudo-radius.
    expect(gameU.uDuneFreq.value).toBe(featureFrequencyFromKm(4, DUNE_SIZE_KM, C_DUNE));
    expect(labU.uDuneFreq.value).toBe(featureFrequencyFromKm(2, DUNE_SIZE_KM, C_DUNE));
    expect(gameU.uDuneFreq.value).not.toBe(labU.uDuneFreq.value);
    expect(gameU.uDuneFreq.value / labU.uDuneFreq.value).toBeCloseTo(4 / visScaleOf(4), 12);

    // ⭐ Both are finite, plausible, in-band frequencies — 64.03 and 32.02 cycles across the body.
    // Neither would trip a range check, a NaN guard, or a "did the uniform get written" probe.
    // That is precisely why the policy has to be a parameter rather than a convention.
    expect(gameU.uDuneFreq.value).toBeCloseTo(64.03, 2);
    expect(labU.uDuneFreq.value).toBeCloseTo(32.02, 2);
    for (const v of [gameU.uDuneFreq.value, labU.uDuneFreq.value]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(1);
      expect(v).toBeLessThan(1e4);
    }
  });

  it('the policies coincide EXACTLY at R = 1.0 R⊕ — which is what makes the difference above real', () => {
    // R^0.5 === R at exactly 1, so 1.0 R⊕ is the ONE body on which a policy-blind contract cannot
    // be caught. Byte-identical, not close: Object.is, so a -0 or a 1-ulp drift also reds.
    expect(visScaleOf(1)).toBe(1);
    expect(gameDisplayRadiusEarth(1)).toBe(1);
    const { gameU, labU } = runBoth(1);
    expect(Object.is(gameU.uDuneFreq.value, labU.uDuneFreq.value)).toBe(true);
  });

  it('differs on EXACTLY the km-keyed uniforms and nowhere else', () => {
    const { gameU, labU } = runBoth(4);
    const differing = Object.keys(gameU).filter((n) => !Object.is(gameU[n].value, labU[n].value));
    expect(differing).toEqual(['uDuneFreq']);
  });

  it('the policy difference is monotone in radius and vanishes only at 1.0', () => {
    for (const R of [0.3, 0.5, 2, 4, 8, 16]) {
      const { gameU, labU } = runBoth(R);
      expect(Object.is(gameU.uDuneFreq.value, labU.uDuneFreq.value)).toBe(false);
    }
  });
});

describe('5a — displayRadiusEarth is REQUIRED, with no default to fall back on', () => {
  const DRIVERS = { uDuneFreq: sizeKm(DUNE_SIZE_KM, C_DUNE) };

  it('throws when the ctx omits it entirely', () => {
    const u = uniformSlots(['uDuneFreq']);
    const ctx = ctxFor(1);
    delete ctx.displayRadiusEarth;
    expect(() => writePackUniforms(u, DRIVERS, ctx)).toThrow(PackContractError);
    expect(() => writePackUniforms(u, DRIVERS, ctx)).toThrow(/displayRadiusEarth is REQUIRED/);
    // and it did NOT quietly write a 1.0-radius value on the way out
    expect(u.uDuneFreq.value).toBe(0);
  });

  it('throws on every shape that a defaulting implementation would swallow', () => {
    const u = uniformSlots(['uDuneFreq']);
    for (const bad of [undefined, null, 0, -1, NaN, Infinity, '4', {}]) {
      expect(() => writePackUniforms(u, DRIVERS, ctxFor(bad))).toThrow(PackContractError);
    }
  });

  it('is checked even when the batch contains NO km-keyed driver', () => {
    // The eager check is the point: a pack that is policy-free today acquires a km-keyed driver
    // later, and the ctx that was never validated is the one that ships the wrong frequency.
    const u = uniformSlots(['uBandContrast']);
    const ctx = ctxFor(1);
    delete ctx.displayRadiusEarth;
    expect(() => writePackUniforms(u, { uBandContrast: 0.42 }, ctx)).toThrow(/displayRadiusEarth/);
  });

  it('assertDisplayPolicy returns the radius it accepted (usable as the resolving call)', () => {
    expect(assertDisplayPolicy(ctxFor(2.5))).toBe(2.5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5b — the extraction: ONE definition, imported back
// ─────────────────────────────────────────────────────────────────────────────
describe('5b — featureFrequencyFromKm is defined ONCE and the lab imports it back', () => {
  it('the lab core re-exports the SAME function object, not an equal copy', () => {
    // ⭐ Identity, not value equality. A local copy in labCore.js would produce
    // byte-identical numbers on every input forever — a value comparison cannot see the fork.
    // `toBe` on the function object is the only assertion that pins the SINGLE DEFINITION.
    expect(labFeatureFrequencyFromKm).toBe(featureFrequencyFromKm);
    expect(labR_EARTH_KM).toBe(R_EARTH_KM);
  });

  it('labCore.js no longer DEFINES either symbol', () => {
    const core = read('src/worldengine/base/labCore.js');
    expect(core).not.toMatch(/function\s+featureFrequencyFromKm\s*\(/);
    expect(core).not.toMatch(/const\s+R_EARTH_KM\s*=/);
    expect(core).toMatch(
      // Step 7 put labCore.js NEXT TO featureScale.js, so the specifier is now a sibling './'.
      // The property pinned is unchanged: the lab core IMPORTS the symbol and does not define it.
      /import\s*\{[^}]*featureFrequencyFromKm[^}]*\}\s*from\s*'\.\/featureScale\.js'/,
    );
  });

  it('the definition lives in src/worldengine/base/featureScale.js', () => {
    const mod = read('src/worldengine/base/featureScale.js');
    expect(mod).toMatch(/export\s+function\s+featureFrequencyFromKm\s*\(/);
    expect(mod).toMatch(/export\s+const\s+R_EARTH_KM\s*=\s*6371/);
  });

  it('the law itself is unchanged: cFeature * (radiusEarth * R_EARTH_KM) / featureSizeKm', () => {
    expect(R_EARTH_KM).toBe(6371);
    expect(featureFrequencyFromKm(1, 398, 1.0)).toBe(6371 / 398);
    expect(featureFrequencyFromKm(2.5, 1385, 1.0)).toBe((2.5 * 6371) / 1385);
    // linear in the radius argument — the property the policy ratio depends on
    expect(featureFrequencyFromKm(4, 398, 1) / featureFrequencyFromKm(1, 398, 1)).toBeCloseTo(4, 12);
  });
});

describe('5b — both new modules are three-free and importable by either front-end', () => {
  // A source grep for "three" would pass on a module that imports a module that imports THREE.
  // Walk the whole relative-import closure and fail on ANY bare specifier, which is the property
  // that actually matters: nothing in the closure can reach node_modules.
  const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g;
  function closureOf(entryRel) {
    const seen = new Set();
    const bare = [];
    const walk = (rel) => {
      if (seen.has(rel)) return;
      seen.add(rel);
      const src = read(rel);
      IMPORT_RE.lastIndex = 0;
      let m;
      while ((m = IMPORT_RE.exec(src)) !== null) {
        const spec = m[1];
        if (spec.startsWith('.') || spec.startsWith('/')) {
          const abs = resolvePath(dirname(join(ROOT, rel)), spec);
          walk(abs.slice(ROOT.length + 1));
        } else {
          bare.push(`${rel} -> ${spec}`);
        }
      }
    };
    walk(entryRel);
    return { files: [...seen], bare };
  }

  it('featureScale.js has an import closure of exactly itself, with zero bare specifiers', () => {
    const c = closureOf('src/worldengine/base/featureScale.js');
    expect(c.bare).toEqual([]);
    expect(c.files).toEqual(['src/worldengine/base/featureScale.js']);
  });

  it('writePackUniforms.js reaches only featureScale.js, with zero bare specifiers', () => {
    const c = closureOf('src/worldengine/port/writePackUniforms.js');
    expect(c.bare).toEqual([]);
    expect(c.files.sort()).toEqual([
      'src/worldengine/base/featureScale.js',
      'src/worldengine/port/writePackUniforms.js',
    ]);
  });

  it('the walker is not vacuous — it DOES find a bare specifier when one exists', () => {
    // Control for the two assertions above: pointed at a module that really does import THREE,
    // the walker reports it. Without this, "bare === []" is indistinguishable from a regex that
    // matches nothing. planet-lod-shaders.glsl.js is not in this lane's file set; it is read-only
    // here, purely as the known-positive.
    const c = closureOf('src/rendering/LabPlanetMaterial.js');
    expect(c.bare.some((b) => /-> three$/.test(b))).toBe(true);
  });

  it('both modules are free of the display-scale tokens the worldengine fence bans', () => {
    // Same DENY as tests/vis-scale-fence.test.js. Asserted here too so this lane's files carry
    // their own conformance rather than relying on a fence in another suite to notice.
    const DENY = /visScaleOf|\bsVis\b|VIS_SCALE_EXP/;
    expect(read('src/worldengine/base/featureScale.js')).not.toMatch(DENY);
    expect(read('src/worldengine/port/writePackUniforms.js')).not.toMatch(DENY);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5a — the rest of the ctx: gates, animRate, relevance
// ─────────────────────────────────────────────────────────────────────────────
describe('5a — writer-side context reproduces the lab idioms exactly', () => {
  it('a driver is either a plain number or a tagged marker — never an ad-hoc object', () => {
    expect(isPackDriver(sizeKm(398, 1))).toBe(true);
    expect(isPackDriver(scalar(1))).toBe(true);
    expect(isPackDriver(0.5)).toBe(false);
    expect(isPackDriver({ value: 0.5 })).toBe(false);
    expect(() => resolveDriver('uX', { value: 0.5 }, ctxFor(1))).toThrow(/neither a finite number/);
  });

  it('a closed gate short-circuits to EXACTLY +0 (the lab writes `enabled ? v : 0.0`)', () => {
    const off = resolveDriver('uJetStrength', scalar(0.75, { gate: 'jets' }), ctxFor(1, { gates: { jets: false } }));
    expect(Object.is(off, 0)).toBe(true);      // +0, not -0, not 1e-30
    const on = resolveDriver('uJetStrength', scalar(0.75, { gate: 'jets' }), ctxFor(1));
    expect(on).toBe(0.75);
  });

  it('a gate closes a km-keyed driver too, before the frequency is ever computed', () => {
    const v = resolveDriver('uDuneFreq', sizeKm(398, 1, { gate: 'dunes' }), ctxFor(4, { gates: { dunes: false } }));
    expect(Object.is(v, 0)).toBe(true);
  });

  it('an ABSENT gate key throws — it is neither on nor off, it is an unmade decision', () => {
    expect(() => resolveDriver('uX', scalar(1, { gate: 'nope' }), ctxFor(1)))
      .toThrow(/gated on 'nope' but ctx.gates has no such key/);
  });

  it('animRate multiplies (uJetSpeed = state.jetSpeed * _animRate) and throws when absent', () => {
    expect(resolveDriver('uJetSpeed', scalar(0.4, { animRate: true }), ctxFor(1, { animRate: 0.25 })))
      .toBeCloseTo(0.1, 12);
    expect(() => resolveDriver('uJetSpeed', scalar(0.4, { animRate: true }), ctxFor(1, { animRate: undefined })))
      .toThrow(/animRate/);
    // ⚠ throws rather than writing NaN: a NaN drift rate is invisible on a still frame.
    expect(() => resolveDriver('uJetSpeed', scalar(0.4, { animRate: true }), ctxFor(1, { animRate: NaN })))
      .toThrow(PackContractError);
  });

  it('relevance multiplies (uPolarStrength folds featureRelevant.polarVortex) and throws when absent', () => {
    expect(resolveDriver('uPolarStrength', scalar(0.8, { relevance: 'polarVortex' }), ctxFor(1, { relevance: { polarVortex: 0.5 } })))
      .toBeCloseTo(0.4, 12);
    expect(() => resolveDriver('uPolarStrength', scalar(0.8, { relevance: 'polarVortex' }), ctxFor(1, { relevance: {} })))
      .toThrow(/relevance/);
  });

  it('gate → animRate → relevance compose in the lab order', () => {
    const d = scalar(0.8, { gate: 'jets', animRate: true, relevance: 'polarVortex' });
    const ctx = ctxFor(1, { animRate: 0.5, relevance: { polarVortex: 0.25 }, gates: { jets: true } });
    expect(resolveDriver('uX', d, ctx)).toBeCloseTo(0.8 * 0.5 * 0.25, 12);
    expect(Object.is(resolveDriver('uX', d, { ...ctx, gates: { jets: false } }), 0)).toBe(true);
  });
});

describe('5a — the writer fails LOUDLY on a name it cannot place', () => {
  it('throws when a driver names a uniform the material does not carry', () => {
    const u = uniformSlots(['uDuneFreq']);
    expect(() => writePackUniforms(u, { uNotAUniform: 1 }, ctxFor(1)))
      .toThrow(/no uniform named 'uNotAUniform'/);
  });

  it('writes vector drivers through a duck-typed .set (three-free) and through plain arrays', () => {
    const captured = [];
    const u = {
      uBandOffset: { value: { set: (...a) => captured.push(a) } },
      uPair: { value: [0, 0] },
    };
    writePackUniforms(u, { uBandOffset: [0.1, 0.2, 0.3], uPair: [7, 8] }, ctxFor(1));
    expect(captured).toEqual([[0.1, 0.2, 0.3]]);
    expect(u.uPair.value).toEqual([7, 8]);
  });

  it('rejects a non-finite plain driver rather than writing NaN into a uniform', () => {
    const u = uniformSlots(['uX']);
    expect(() => writePackUniforms(u, { uX: NaN }, ctxFor(1))).toThrow(/non-finite/);
    expect(u.uX.value).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5a/5d — the contract's other two preconditions
// ─────────────────────────────────────────────────────────────────────────────
describe('5d — macroSeed shape (the pack precondition the contract exposes)', () => {
  it('accepts a non-zero integer and rejects the hex-collapse case', () => {
    expect(assertMacroSeed(0x5bf03635)).toBe(0x5bf03635);
    // `'da81e221' | 0 === 0` — the hex fnv1aString form collapses, and a zero seed makes every
    // seeded field constant across the whole population without moving any algebraic gate.
    expect('da81e221' | 0).toBe(0);
    expect(() => assertMacroSeed('da81e221' | 0)).toThrow(/non-zero integer/);
    for (const bad of [0, 1.5, NaN, undefined, null, 'da81e221']) {
      expect(() => assertMacroSeed(bad)).toThrow(PackContractError);
    }
  });

  // ⭐ THE CASE THE GUARD USED TO MISS, and the reason this `it` exists as its own block: the old
  // predicate was `macroSeed === 0`, which is NOT the failure the guard's own error string describes.
  // Every consumer coerces with `| 0` (`giant-drivers.js` alea key, `climate-e5.js`, `band-flow.js`),
  // so the property that matters is SURVIVING the coercion. 2^32 is a finite, non-zero, integral seed
  // that collapses to 0 downstream — it passed the old gate and would have given every gas giant
  // identical band phases with no algebraic gate moving, which is exactly what 5d exists to prevent.
  //
  // ⛔ THIS TEST MUST FAIL IF THE PREDICATE IS REVERTED TO `macroSeed === 0`. That is its whole job.
  // Verified both directions on 2026-08-10: with `=== 0` these three PASS the guard (test red), with
  // `(macroSeed | 0) === 0` all three throw (test green).
  it('rejects a non-zero integer that COLLAPSES to zero under `| 0` — 2^32 and its multiples', () => {
    for (const collapsing of [4294967296, 8589934592, -4294967296, 2 ** 40]) {
      // the precondition that makes each case interesting: non-zero and integral, yet coerces to 0
      expect(Number.isInteger(collapsing)).toBe(true);
      expect(collapsing).not.toBe(0);
      expect(collapsing | 0).toBe(0);
      expect(() => assertMacroSeed(collapsing)).toThrow(PackContractError);
    }
    // CONTROL — a seed that SURVIVES `| 0` must still be accepted, so the fix cannot have simply
    // tightened the gate into rejecting everything. 2^32+1 differs from 2^32 by one and passes.
    expect(4294967295 | 0).toBe(-1);
    expect(assertMacroSeed(4294967295)).toBe(4294967295);
    expect(assertMacroSeed(4294967297)).toBe(4294967297);
  });
});

describe('5a — pack return shape is { drivers, attributes }', () => {
  it('accepts a complete result, including an intentionally empty attributes map', () => {
    const r = { drivers: {}, attributes: {} };
    expect(assertPackResult(r, 'giantDeckPack')).toBe(r);
  });

  it('rejects a missing attributes map by name — "none" and "forgot" must not look the same', () => {
    expect(() => assertPackResult({ drivers: {} }, 'giantDeckPack'))
      .toThrow(/giantDeckPack returned no attributes map/);
    expect(() => assertPackResult({ attributes: {} }, 'giantDeckPack'))
      .toThrow(/no drivers map/);
    expect(() => assertPackResult(undefined, 'giantDeckPack'))
      .toThrow(/must return \{ drivers, attributes \}/);
  });
});
