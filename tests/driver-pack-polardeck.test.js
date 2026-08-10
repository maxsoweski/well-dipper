// tests/driver-pack-polardeck.test.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #2 — THE POLAR VORTEX (F29). Carried ledger C19: "give `uPolarStrength` a producer the
// game can call." PLAN §4 "Step 5" contract, §7 storm fence, §11.3.3 evidence standard.
//
// ⭐ THE EVIDENCE STANDARD (§11.3.3). "The test passes" is not evidence that it CAN fail. Every gate
// below that could be vacuous carries an EXECUTED control marked `[CONTROL]`: the thing the gate
// guards is broken in-test, the gate is shown red, and the break is discarded.
//
// ⛔ WHAT THIS FILE DOES NOT CLAIM, each because claiming it would be false or unmeasured:
//  1. IT DOES NOT CLAIM THE GAME RENDERS A POLAR VORTEX TODAY. `polarDeck` is NOT in `PACKS`, so
//     `applyDriverPacks` never calls it and no game body's `uPolarStrength` moves. That hole is
//     ASSERTED (gate 6) rather than described, so the commit that registers the pack turns this file
//     red and makes its author read the note instead of discovering the coupling later.
//  2. It does not claim the display-policy seam is exercised. NOT ONE F29 driver is km-shaped
//     (`uPolarR0` is angular), so policy agreement is a fact about the SIZE OF THE SET. The
//     emptiness is asserted directly (gate 6) so the vacuity ends loudly.
//  3. It pins no COUNT as a proxy for a SET. Step 4's re-bless was passed byte-identically by a
//     count-preserving permutation; where this file cares about membership it asserts membership.
//  4. It does not gate presence on a single body. `uPolarStrength` is a per-seed PRESENCE coin
//     (`POLAR_PRESENCE_PRIOR`), so one gas giant reading 0 is CORRECT behaviour. Presence is gated
//     as a POPULATION fraction against the prior, plus one NAMED body that comes up present.
//  5. It claims no coverage it does not have. Over 200 generated systems the game's own generator
//     yields THREE of the five giant regimes (saturnian / neptunian / sub-neptune) and no
//     `gas-giant` or `hot-jupiter` body at all, so the 0.98 prior is NOT exercised on the game
//     population. The two missing regimes are covered through the driver presets instead, and the
//     gap is asserted so it cannot be mistaken for full coverage.
//  6. It writes no prose superlative it did not measure.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DRIVER_PRESETS } from '../driver-presets.js';
import { deriveConditionVector } from '../body-condition-vector.js';
import { deriveUniforms } from '../planet-lod-lab-core.js';
import { ASSOCIATIONS } from '../planet-feature-associations.js';
import { makeUniforms } from '../planet-lod-uniforms.js';
import { LAB_ATTRIBUTES, LAB_WORLD_LIGHT } from '../src/rendering/LabPlanetMaterial.js';
import alea from 'alea';
import { compositionClass, giantRegimeOf } from '../src/worldengine/base/e1Regime.js';
import { clamp, clamp01 } from '../src/worldengine/base/mathutil.js';
import { E5_REGIME } from '../src/worldengine/base/climate-e5.js';
import {
  STORM_PHYS, POLAR_PRESENCE_PRIOR, POLAR_CANONICAL_N, POLAR_N_DELTA_WEIGHTS,
  resolveStormE, resolvePolarVortex,
} from '../src/worldengine/base/storm-e.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromPlanet } from '../src/worldengine/port/conditionFromPlanet.js';
import { fnv1aString } from 'motion-test-kit/core/hash/fnv1a.js';
import {
  writePackUniforms, gameDisplayRadiusEarth, resolveDriver, isPackDriver, PackContractError,
} from '../src/worldengine/port/writePackUniforms.js';
import { PACKS, gatesFor } from '../src/worldengine/drivers/index.js';
import {
  polarDeckPack, polarTintFromBandTint, POLAR_TINT_LAW,
  POLAR_DRIVEN, POLAR_LAB_KNOBS, GAME_STORM_SEED,
} from '../src/worldengine/drivers/polarDeck.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const POLAR_SRC = read('src/worldengine/drivers/polarDeck.js');
const STORM_SRC = read('src/worldengine/base/storm-e.js');
const UNIFORMS_SRC = read('planet-lod-uniforms.js');
const LAB_SRC = read('planet-lod-lab.html');

// The appended wrapper's body ALONE — scanning the whole of storm-e.js for `resolveStormE` would hit
// its own definition, which is exactly the shape of vacuous scan §11.1 calls a dead gate.
const WRAPPER_SRC = STORM_SRC.slice(STORM_SRC.indexOf('export function resolvePolarVortex'));

const REGIMES = Object.values(E5_REGIME);
const MACRO_SEEDS = [1, 2, 3, 7, 11, 42, 99, 1234, 7777, 31337];
const STORM_SEEDS = [0, 1, 1234, 987654];
const GAS = 'h2-he';

// ─────────────────────────────────────────────────────────────────────────────
// GATE 1 — THE EXTRACTION IS AN EXTRACTION, NOT A REWRITE
// ─────────────────────────────────────────────────────────────────────────────
describe('GATE 1 · resolvePolarVortex reproduces resolveStormE().pole exactly', () => {
  // The grid: 5 regimes x 10 macroSeeds x 4 stormSeeds x 2 obliquities = 400 triples, INCLUDING the
  // Uranian branch (NEPTUNIAN + obliquity >= URANIAN_OBLIQUITY forces mode 0) and hot-Jupiter
  // (stormsOn false). The non-gas case is added separately below.
  const grid = [];
  for (const regime of REGIMES) {
    for (const macroSeed of MACRO_SEEDS) {
      for (const stormSeed of STORM_SEEDS) {
        for (const obliquityDeg of [0, STORM_PHYS.URANIAN_OBLIQUITY + 5]) {
          grid.push({ regime, macroSeed, stormSeed, drivers: { composition: GAS, T_eq: 124, obliquityDeg } });
        }
      }
    }
  }

  it('the grid is big enough to mean anything AND covers the two branch cases by name', () => {
    expect(grid.length).toBe(400);
    expect(grid.some((g) => g.regime === E5_REGIME.HOT_JUPITER)).toBe(true);
    const uranian = grid.filter((g) => g.regime === E5_REGIME.NEPTUNIAN
      && g.drivers.obliquityDeg >= STORM_PHYS.URANIAN_OBLIQUITY);
    expect(uranian.length).toBe(MACRO_SEEDS.length * STORM_SEEDS.length);
    // ⚠ The Uranian override is only OBSERVABLE where it changes something. Assert that at least one
    // grid point would have had a non-zero mode without it, so the branch is not silently no-op.
    const wouldDiffer = uranian.some((g) => {
      const raw = resolvePolarVortex(g.regime, { ...g.drivers, obliquityDeg: 0 }, g.macroSeed, g.stormSeed);
      return raw.mode !== 0;
    });
    expect(wouldDiffer, 'the uranian mode-0 override changes mode on at least one grid point').toBe(true);
  });

  it('every triple deep-equals, on gas AND on non-gas', () => {
    for (const g of grid) {
      expect(resolvePolarVortex(g.regime, g.drivers, g.macroSeed, g.stormSeed))
        .toEqual(resolveStormE(g.regime, g.drivers, g.macroSeed, g.stormSeed).pole);
    }
    for (const regime of REGIMES) {
      const solid = { composition: 'co2', T_eq: 210 };
      expect(resolvePolarVortex(regime, solid, 5, 1))
        .toEqual(resolveStormE(regime, solid, 5, 1).pole);
      expect(resolvePolarVortex(regime, solid, 5, 1).strength).toBe(0);
    }
  });

  // [CONTROL] Four single-line breaks, each a mistake an extractor could plausibly make.
  //
  // ⛔ THE CONTROL IS AN ARM'S-LENGTH RE-IMPLEMENTATION, AND THE FIRST VERSION WAS NOT. That version
  // built its "variant" by CALLING `resolvePolarVortex` and then perturbing the result, which made
  // three of the four mutations inexpressible: the real function had already applied the gas gate,
  // so a variant that "dropped" it could only ever zero a strength, never raise one, and the gate
  // reported 0 disagreements while testing nothing. A control that routes through the thing it is
  // controlling is not a control. This one re-derives `resolvePole` from its EXPORTED constants and
  // its own `alea`, so every mutation is a real change to a real derivation.
  //
  // ⚠ IT COVERS THE PASSED-`T_eq` PATH ONLY. `DEFAULT_T_EQ` is module-private, so the fallback ramp
  // is not reproduced here; every grid point supplies `T_eq` explicitly and that is asserted below,
  // rather than left as a silent hole in the re-derivation.
  const armsLengthPole = ({ stream = 'stormE:polar', uranianOverride = true, applyGasGate = true,
    presenceGate = true } = {}) => (regime, drivers, macroSeed, stormSeed) => {
    const TWO_PI = Math.PI * 2;
    const smooth01 = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
    const pickNDelta = (u) => {
      const wLo = POLAR_N_DELTA_WEIGHTS['-1'];
      if (u < wLo) return -1;
      if (u < wLo + POLAR_N_DELTA_WEIGHTS['0']) return 0;
      return 1;
    };
    const gas = applyGasGate ? drivers.composition === 'h2-he' : true;
    const stormsOn = gas && regime !== E5_REGIME.HOT_JUPITER;
    const id = (Math.imul(macroSeed | 0, 2654435761) ^ (stormSeed | 0)) >>> 0;
    const rng = alea(stream + ':' + regime + ':' + id);
    const vigor = smooth01(STORM_PHYS.VIGOR_LO, STORM_PHYS.VIGOR_HI, drivers.T_eq);
    // the five original draws, in their frozen order, then the three appended ones
    const r0 = STORM_PHYS.POLAR_R0_MIN + STORM_PHYS.POLAR_R0_SPAN * rng();
    const poleSign = rng() > 0.5 ? 1 : -1;
    const phase = rng() * TWO_PI;
    const ageScalar = rng();
    const phaseScalar = rng() * TWO_PI;
    const presenceRoll = rng();
    const dSides = pickNDelta(rng());
    const dRing = pickNDelta(rng());
    const mode0 = vigor >= STORM_PHYS.LATTICE_VIGOR ? 2 : (vigor >= STORM_PHYS.DARK_VIGOR ? 1 : 0);
    const canon = POLAR_CANONICAL_N[regime] || { sides: 6, ring: 6 };
    const lo = STORM_PHYS.POLAR_N_MIN, hi = STORM_PHYS.POLAR_N_MIN + STORM_PHYS.POLAR_N_SPAN;
    const prior = POLAR_PRESENCE_PRIOR[regime] ?? 0;
    const present = presenceGate ? (stormsOn && presenceRoll < prior) : stormsOn;
    const uran = regime === E5_REGIME.NEPTUNIAN
      && (drivers.obliquityDeg ?? 0) >= STORM_PHYS.URANIAN_OBLIQUITY;
    return {
      strength: present ? 1 : 0,
      mode: (uranianOverride && uran) ? 0 : mode0,
      sides: clamp(lo, hi, canon.sides + dSides),
      r0, ring: clamp(lo, hi, canon.ring + dRing),
      pole: poleSign, phase, ageScalar, phaseScalar,
    };
  };

  const KEYS = ['strength', 'mode', 'sides', 'r0', 'ring', 'pole', 'phase', 'ageScalar', 'phaseScalar'];
  const same = (a, b) => KEYS.every((k) => Object.is(a[k], b[k]));

  it('[CONTROL] a faithful arm\'s-length re-derivation agrees; four mutations each go RED', () => {
    const solidGrid = [];
    for (const regime of REGIMES) {
      for (const macroSeed of MACRO_SEEDS) {
        solidGrid.push({ regime, macroSeed, stormSeed: 0, drivers: { composition: 'co2', T_eq: 210 } });
      }
    }
    // the coverage caveat above, asserted rather than trusted
    expect(grid.every((g) => typeof g.drivers.T_eq === 'number')).toBe(true);
    expect(solidGrid.every((g) => typeof g.drivers.T_eq === 'number')).toBe(true);

    const truth = (g) => resolveStormE(g.regime, g.drivers, g.macroSeed, g.stormSeed).pole;
    const disagreements = (fn, over) => over.filter((g) =>
      !same(fn(g.regime, g.drivers, g.macroSeed, g.stormSeed), truth(g))).length;

    // FAITHFUL: the unmutated re-derivation matches the writer on both grids. Without this the four
    // numbers below would measure the re-implementation's own infidelity.
    expect(disagreements(armsLengthPole(), grid), 'faithful on the gas grid').toBe(0);
    expect(disagreements(armsLengthPole(), solidGrid), 'faithful on the solid grid').toBe(0);
    // …and it matches the WRAPPER too, which is the C19 claim stated a second, independent way.
    for (const g of [...grid, ...solidGrid]) {
      expect(same(armsLengthPole()(g.regime, g.drivers, g.macroSeed, g.stormSeed),
        resolvePolarVortex(g.regime, g.drivers, g.macroSeed, g.stormSeed))).toBe(true);
    }

    // MUTATED: each break is visible, and each is checked on a grid where it CAN be visible.
    expect(disagreements(armsLengthPole({ stream: 'stormE:place' }), grid),
      'a renamed alea stream').toBeGreaterThan(0);
    expect(disagreements(armsLengthPole({ uranianOverride: false }), grid),
      'a dropped uranian mode-0 override').toBeGreaterThan(0);
    expect(disagreements(armsLengthPole({ presenceGate: false }), grid),
      'a dropped per-seed presence coin').toBeGreaterThan(0);
    // ⭐ THE GAS-GATE MUTATION IS ONLY VISIBLE ON A NON-GAS GRID, and pinning that asymmetry is the
    // point: on `grid` every point already satisfies the gate, so the mutation is inert there. A
    // control run only on `grid` would have reported this gate green while measuring nothing.
    expect(disagreements(armsLengthPole({ applyGasGate: false }), solidGrid),
      'a dropped gas gate, on solids').toBeGreaterThan(0);
    expect(disagreements(armsLengthPole({ applyGasGate: false }), grid),
      'the same mutation is inert on an all-gas grid — by construction, not by luck').toBe(0);
  });

  it('the wrapper reaches NOTHING in the storm slice', () => {
    // A source scan over the wrapper's own text — the whole point of the C19 boundary is that the
    // polar draw does not pay for storm placement.
    for (const forbidden of ['resolveStormE', 'writeStormESphere', 'bakeStormEAttributes',
      'resolveStormPlacement', 'resolveParams', 'stormMaskAt']) {
      expect(WRAPPER_SRC, `wrapper must not name ${forbidden}`).not.toContain(forbidden);
    }
    // …and the positive half: it DOES reach the shared producer.
    expect(WRAPPER_SRC).toContain('resolvePole(regime, stormsOn, vigor, rngPolar)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GATE 2 — THE STORM SLICE STAYS FENCED (PLAN §7)
// ─────────────────────────────────────────────────────────────────────────────
describe('GATE 2 · the storm slice is not reopened', () => {
  const cond = gasCondition('Gas giant (Jovian)');
  const deck = polarDeckPack(cond, packCtx(cond, 4242));

  it('the pack module names no storm producer', () => {
    for (const forbidden of ['resolveStormE', 'writeStormESphere', 'bakeStormEAttributes']) {
      // ⚠ SCANNED AS CODE, NOT AS PROSE: this module's header discusses the fence by name, so an
      // un-stripped scan would fail on its own documentation. Only the import + statement text is
      // checked, which is where a breach would actually live.
      const code = POLAR_SRC.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
      expect(code, `polarDeck.js code must not call ${forbidden}`).not.toContain(forbidden);
    }
    // The ONE symbol it may take from the storm module.
    expect(POLAR_SRC).toContain("import { resolvePolarVortex } from '../base/storm-e.js';");
  });

  it('the pack emits no uStorm* driver and no attribute at all', () => {
    expect(Object.keys(deck.drivers).filter((n) => n.startsWith('uStorm'))).toEqual([]);
    expect(Object.keys(deck.attributes)).toEqual([]);
  });

  it('uStormCount stays at its declared default after BOTH packs write the material', () => {
    const uniforms = makeUniforms(LAB_WORLD_LIGHT);
    const before = uniforms.uStormCount.value;
    writePackUniforms(uniforms, deck.drivers, packCtx(cond, 4242));
    expect(uniforms.uStormCount.value).toBe(before);
    expect(before).toBe(0);
  });

  it('aStorm is still a zero-fill member and is not baked by this pack', () => {
    // The order rule at Planet.js:2017 `const zeroFilled = ensureLabAttributes(geometry);` supplies
    // aStorm precisely because no pack bakes it. Assert the membership, not the rule.
    expect(LAB_ATTRIBUTES).toContain('aStorm');
    expect(Object.keys(deck.attributes)).not.toContain('aStorm');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GATE 3 — THE PRODUCER REACHES THE UNIFORMS
// ─────────────────────────────────────────────────────────────────────────────
describe('GATE 3 · the eight driven uniforms land on a real material', () => {
  const cond = gasCondition('Gas giant (Jovian)');

  it('the emitted set is exactly POLAR_DRIVEN, by MEMBERSHIP', () => {
    const deck = polarDeckPack(cond, packCtx(cond, 4242));
    expect(new Set(Object.keys(deck.drivers))).toEqual(new Set(POLAR_DRIVEN));
  });

  it('every name exists on the lab material — writePackUniforms throws on one that does not', () => {
    const uniforms = makeUniforms(LAB_WORLD_LIGHT);
    const deck = polarDeckPack(cond, packCtx(cond, 4242));
    expect(() => writePackUniforms(uniforms, deck.drivers, packCtx(cond, 4242))).not.toThrow();
    // [CONTROL] the writer's missing-uniform throw is what makes the line above evidence.
    expect(() => writePackUniforms(uniforms, { uPolarStrenght: 1 }, packCtx(cond, 4242)))
      .toThrow(PackContractError);
  });

  it('uPolarTint reaches the THREE.Color slot as three components, not as a hex', () => {
    const uniforms = makeUniforms(LAB_WORLD_LIGHT);
    const deck = polarDeckPack(cond, packCtx(cond, 4242));
    writePackUniforms(uniforms, deck.drivers, packCtx(cond, 4242));
    const expected = polarTintFromBandTint(cond.atmosphere.color);
    const got = uniforms.uPolarTint.value;
    expect([got.r, got.g, got.b]).toEqual(expected);
    // The law is the lab's, verbatim — asserted against the lab's own source text so a retune there
    // shows up here instead of drifting silently.
    expect(LAB_SRC).toContain('[_bt[0] * 0.45, _bt[1] * 0.62, Math.min(1, _bt[2] * 0.85 + 0.25)]');
    expect([POLAR_TINT_LAW.R, POLAR_TINT_LAW.G, POLAR_TINT_LAW.B_MUL, POLAR_TINT_LAW.B_ADD])
      .toEqual([0.45, 0.62, 0.85, 0.25]);
  });

  it('the gate zeroes uPolarStrength ALONE, reproducing the lab idiom', () => {
    const deck = polarDeckPack(cond, packCtx(cond, 4242));
    const on = packCtx(cond, 4242);
    const off = { ...on, gates: { polarVortex: false } };
    expect(resolveDriver('uPolarStrength', deck.drivers.uPolarStrength, off)).toBe(0);
    expect(Object.is(resolveDriver('uPolarStrength', deck.drivers.uPolarStrength, off), 0)).toBe(true);
    // the other seven are plain numbers and pass through untouched under either gate
    for (const name of POLAR_DRIVEN) {
      if (name === 'uPolarStrength') continue;
      expect(isPackDriver(deck.drivers[name]), `${name} must be an ungated plain value`).toBe(false);
      expect(resolveDriver(name, deck.drivers[name], off))
        .toEqual(resolveDriver(name, deck.drivers[name], on));
    }
    // [CONTROL] an absent gate key is an unanswered decision, not an off gate.
    expect(() => resolveDriver('uPolarStrength', deck.drivers.uPolarStrength, { ...on, gates: {} }))
      .toThrow(PackContractError);
  });

  it('a NAMED generated body comes up present with a non-zero uPolarStrength', () => {
    const b = POPULATION.find((x) => x.id === PRESENT_EXAMPLE_ID);
    expect(b, `the named body ${PRESENT_EXAMPLE_ID} is in the population`).toBeTruthy();
    const deck = polarDeckPack(b.cond, packCtx(b.cond, fnv1aString(b.id)));
    const ctx = packCtx(b.cond, fnv1aString(b.id));
    expect(resolveDriver('uPolarStrength', deck.drivers.uPolarStrength, ctx)).toBe(1);
    // and it is a real structure, not a strength floating on defaults
    expect(deck.drivers.uPolarR0).toBeGreaterThan(STORM_PHYS.POLAR_R0_MIN - 1e-12);
    expect(deck.drivers.uPolarR0).toBeLessThan(STORM_PHYS.POLAR_R0_MIN + STORM_PHYS.POLAR_R0_SPAN);
    expect([5, 6, 7, 8]).toContain(deck.drivers.uPolarSides);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GATE 4 — PRESENCE IS A POPULATION PROPERTY, NOT A PER-BODY ONE
// ─────────────────────────────────────────────────────────────────────────────
describe('GATE 4 · observed present-fraction tracks POLAR_PRESENCE_PRIOR', () => {
  it('the population is named and big enough', () => {
    expect(SYSTEM_SEEDS.length).toBe(200);
    expect(POPULATION.length).toBeGreaterThanOrEqual(300);
    expect(POPULATION[0].id).toMatch(/^pdk-\d+#\d+$/);
  });

  it('the game generator yields THREE of five regimes — the gap is asserted, not glossed', () => {
    // ⛔ NOT a coverage claim. Measured over these 200 systems: no `gas-giant` and no `hot-jupiter`
    // body exists, so the 0.98 prior is untested HERE. The two missing regimes are covered through
    // the driver presets in the next test instead. If the generator ever starts producing them this
    // assertion goes red and the population gate below gains two rows on purpose.
    expect([...new Set(POPULATION.map((b) => b.regime))].sort())
      .toEqual([E5_REGIME.NEPTUNIAN, E5_REGIME.SATURNIAN, E5_REGIME.SUB_NEPTUNE].sort());
  });

  it('each regime present-fraction lies within 3 binomial sigma of its prior', () => {
    const byRegime = new Map();
    for (const b of POPULATION) {
      const deck = polarDeckPack(b.cond, packCtx(b.cond, fnv1aString(b.id)));
      const s = resolveDriver('uPolarStrength', deck.drivers.uPolarStrength, packCtx(b.cond, fnv1aString(b.id)));
      const row = byRegime.get(b.regime) || { n: 0, k: 0 };
      row.n++; row.k += s;
      byRegime.set(b.regime, row);
    }
    for (const [regime, { n, k }] of byRegime) {
      const p = POLAR_PRESENCE_PRIOR[regime];
      const sigma = Math.sqrt((p * (1 - p)) / n);
      const observed = k / n;
      expect(n, `${regime} sample size`).toBeGreaterThanOrEqual(30);
      expect(Math.abs(observed - p), `${regime}: observed ${observed.toFixed(3)} vs prior ${p} (n=${n})`)
        .toBeLessThanOrEqual(3 * sigma);
      // and the coin is a coin: neither pinned on nor pinned off within a regime
      if (p < 0.9) { expect(k).toBeGreaterThan(0); expect(k).toBeLessThan(n); }
    }
  });

  it('[CONTROL] a single-body read cannot distinguish "absent" from "dead wire"', () => {
    // The whole reason gate 4 is a population gate. Both of these are CORRECT outputs of a working
    // pack, and a live look at either one alone would license the opposite conclusion.
    const absent = POPULATION.filter((b) => polarDeckPack(b.cond, packCtx(b.cond, fnv1aString(b.id)))
      .meta.present === false);
    const present = POPULATION.filter((b) => polarDeckPack(b.cond, packCtx(b.cond, fnv1aString(b.id)))
      .meta.present === true);
    expect(absent.length).toBeGreaterThan(0);
    expect(present.length).toBeGreaterThan(0);
  });

  it('the two regimes the generator never makes are covered through the presets', () => {
    for (const [preset, regime] of [['Gas giant (Jovian)', E5_REGIME.GAS_GIANT],
      ['Hot Jupiter (locked giant)', E5_REGIME.HOT_JUPITER]]) {
      const cond = gasCondition(preset);
      expect(giantRegimeOf(cond)).toBe(regime);
      const strengths = MACRO_SEEDS.map((s) => polarDeckPack(cond, packCtx(cond, s)).meta.present);
      if (regime === E5_REGIME.HOT_JUPITER) {
        // regime-suppressed: storms defer to #4, so the pole is absent on every seed
        expect(strengths.every((x) => x === false)).toBe(true);
        expect(POLAR_PRESENCE_PRIOR[regime]).toBeUndefined();
      } else {
        // 0.98 prior: present on every one of these ten seeds is the expected read, not a pin
        expect(strengths.filter(Boolean).length).toBeGreaterThanOrEqual(9);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GATE 5 — THE LAB'S RELEVANCE HARD-GATE SURVIVES AS THE ADMISSION PREDICATE
// ─────────────────────────────────────────────────────────────────────────────
describe('GATE 5 · the Mars leak stays shut', () => {
  it('condition-derived `gas` and the lab preset-name table agree on all 18 presets', () => {
    // The lab zeroes the vortex on terrestrial worlds with `state.featureRelevant.polarVortex`,
    // whose signal is preset membership in ASSOCIATIONS.polarVortex.rendersOn. The game has no
    // preset names, so the equivalent must be condition-derived. This is the measurement that says
    // the substitution is legitimate rather than merely convenient.
    const rendersOn = ASSOCIATIONS.polarVortex.rendersOn;
    const names = Object.keys(DRIVER_PRESETS);
    expect(names.length).toBe(18);
    const disagreements = names.filter((n) => {
      const cond = conditionOf(n);
      return (compositionClass(cond) === 'gas') !== rendersOn.includes(n);
    });
    expect(disagreements).toEqual([]);
  });

  it('the pack emits nothing on a Mars-like body, and the registry predicate refuses it', () => {
    const mars = conditionOf('Mars (arid rocky)');
    expect(compositionClass(mars)).not.toBe('gas');
    const deck = polarDeckPack(mars, packCtx(mars, 4242));
    expect(Object.keys(deck.drivers)).toEqual([]);
    expect(deck.meta.gas).toBe(false);
    // the same predicate the registry entry must carry
    expect(compositionClass(mars) === 'gas').toBe(false);
  });

  it('[CONTROL] a predicate that admitted Mars would move the bank while strength stayed 0', () => {
    // ⭐ THIS IS THE FAILURE THE LAB MEASURED — planet-lod-lab.html:1852 `which moves the polar bank this function writes (state.polarSides / state.polarR0) on 52/52 (preset, seed) pairs tried`
    // — and the reason the gas gate
    // cannot be left to `uPolarStrength`. Running the producer on a Mars-like body yields strength 0
    // — so every check keyed on the master strength reads clean — while `sides` / `r0` / `phase`
    // take gas-giant values and overwrite the material's declared defaults.
    const mars = conditionOf('Mars (arid rocky)');
    const leaked = resolvePolarVortex(giantRegimeOf(mars), {
      composition: mars.atmosphere && mars.atmosphere.composition, T_eq: mars.T_eq,
    }, 4242, GAME_STORM_SEED);
    expect(leaked.strength, 'the master strength stays 0 — which is why it cannot be the gate').toBe(0);
    const uniforms = makeUniforms(LAB_WORLD_LIGHT);
    const defaults = { sides: uniforms.uPolarSides.value, r0: uniforms.uPolarR0.value };
    expect(leaked.sides !== defaults.sides || Math.abs(leaked.r0 - defaults.r0) > 1e-9,
      'the leaked bank differs from the material defaults on at least one field').toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GATE 6 — THE SCOPE FENCES, AND THE HOLE THIS LANE DID NOT CLOSE
// ─────────────────────────────────────────────────────────────────────────────
describe('GATE 6 · fences and the open registration hole', () => {
  it('⛔ polarDeck is NOT registered in PACKS — read this before making it green', () => {
    // ⭐ THIS ASSERTION IS THE OPEN HOLE, WRITTEN SO IT ANNOUNCES ITSELF. The producer exists and is
    // callable, but `applyDriverPacks` iterates PACKS and PACKS has one entry, so NOT ONE game body's
    // `uPolarStrength` moves as of this commit. Registration is a THREE-FILE edit that this lane's
    // file set does not include:
    //   1. src/worldengine/drivers/index.js — a PACKS entry
    //      { name: 'polarDeck', applies: (c) => compositionClass(c) === 'gas',
    //        gates: Object.freeze(['polarVortex']), pack: polarDeckPack }
    //   2. tests/gas-body-lab-material.test.js:108 `expect(PACKS.map((e) => e.name)).toEqual(['giantDeck']);` — the
    //      membership fence, pinned as a SET OF NAMES, which must gain 'polarDeck'.
    //   3. tools/port-uniform-delta.mjs `CITE_SOURCES` — polarDeck.js and this file, per §11.3.4.
    // When entry 1 lands, THIS test goes red. That is the intended behaviour: the author deletes it
    // and enables the registered-path assertions immediately below it.
    //
    // ⚠ SCOPED TO `polarDeck` ALONE, NOT `toEqual(['giantDeck'])`, and the difference matters while
    // lanes run concurrently: a sibling lane is adding its own pack, and an equality here would go
    // red on SOMEONE ELSE'S registration — a false red that teaches people to edit this line
    // without reading it. The set-equality version of this fence already exists, once, at
    // tests/gas-body-lab-material.test.js:108 `expect(PACKS.map((e) => e.name)).toEqual(['giantDeck']);`.
    expect(PACKS.map((e) => e.name)).not.toContain('polarDeck');
    // …and the pack is genuinely absent from composition, not merely absent from the name list
    expect(PACKS.some((e) => e.pack === polarDeckPack)).toBe(false);
  });

  it('the gate name the registry entry will have to declare is `polarVortex`', () => {
    const cond = gasCondition('Gas giant (Jovian)');
    const deck = polarDeckPack(cond, packCtx(cond, 4242));
    expect(deck.drivers.uPolarStrength.gate).toBe('polarVortex');
    // `gatesFor` builds ALL_ON from the entry's own declared names, so the future entry resolves.
    expect(gatesFor({ gates: ['polarVortex'] })).toEqual({ polarVortex: true });
    // and the name matches the lab's enable key, so the two front-ends gate the same feature
    expect(LAB_SRC).toContain('state.polarVortexEnabled');
  });

  it('the two packs cannot collide: their uniform-name sets are disjoint', () => {
    const cond = gasCondition('Gas giant (Jovian)');
    const polar = new Set(Object.keys(polarDeckPack(cond, packCtx(cond, 4242)).drivers));
    const giant = new Set(Object.keys(PACKS[0].pack(cond, {
      ...packCtx(cond, 4242), gates: { bands: true, jets: true },
    }).drivers));
    const overlap = [...polar].filter((n) => giant.has(n));
    expect(overlap).toEqual([]);
  });

  it('the lab knobs stay unwritten AND are provably equal to the lab, not merely absent', () => {
    const cond = gasCondition('Gas giant (Jovian)');
    const deck = polarDeckPack(cond, packCtx(cond, 4242));
    for (const knob of POLAR_LAB_KNOBS) expect(Object.keys(deck.drivers)).not.toContain(knob);
    // ⭐ "unwritten" only means "same as the lab" if the material's default equals the lab's slider
    // default. Both are asserted from source so a retune on either side ends the equality loudly.
    expect(UNIFORMS_SRC).toContain('uPolarAmp:        { value: 0.12 },');
    expect(UNIFORMS_SRC).toContain('uPolarW:          { value: 0.025 },');
    expect(LAB_SRC).toContain('polarAmp: 0.12,');
    expect(LAB_SRC).toContain('polarW: 0.025,');
    // and the family really is 10 declared / 8 driven
    expect(POLAR_DRIVEN.length + POLAR_LAB_KNOBS.length).toBe(10);
    const declared = [...UNIFORMS_SRC.matchAll(/^\s{6}(uPolar\w+):/gm)].map((m) => m[1]);
    expect(new Set(declared)).toEqual(new Set([...POLAR_DRIVEN, ...POLAR_LAB_KNOBS]));
  });

  it('not one driver is km-shaped — the display-policy vacuity is asserted, not assumed', () => {
    const cond = gasCondition('Gas giant (Jovian)');
    const deck = polarDeckPack(cond, packCtx(cond, 4242));
    const km = Object.entries(deck.drivers)
      .filter(([, d]) => isPackDriver(d) && d.featureSizeKm !== undefined).map(([n]) => n);
    expect(km).toEqual([]);
    // therefore the two front-end display policies agree on every driver — a fact about set size
    const asLab = polarDeckPack(cond, { ...packCtx(cond, 4242), displayRadiusEarth: Math.sqrt(cond.radiusEarth) });
    expect(asLab.drivers).toEqual(deck.drivers);
  });

  it('the contract preconditions are enforced', () => {
    const cond = gasCondition('Gas giant (Jovian)');
    expect(() => polarDeckPack(cond, { ...packCtx(cond, 4242), displayRadiusEarth: undefined }))
      .toThrow(PackContractError);
    expect(() => polarDeckPack(cond, { ...packCtx(cond, 4242), macroSeed: 0 })).toThrow(PackContractError);
    expect(() => polarDeckPack(null, packCtx(cond, 4242))).toThrow(PackContractError);
  });

  it('GAME_STORM_SEED is a DECLARED law, and it is not the lab GUI default', () => {
    expect(GAME_STORM_SEED).toBe(0);
    expect(Number.isInteger(GAME_STORM_SEED)).toBe(true);
    expect(LAB_SRC).toContain('stormSeed: 1234,');
    expect(GAME_STORM_SEED).not.toBe(1234);
    // it is what the pack actually uses when the ctx declares none…
    const cond = gasCondition('Gas giant (Jovian)');
    expect(polarDeckPack(cond, packCtx(cond, 4242)).meta.stormSeed).toBe(GAME_STORM_SEED);
    // …and it is genuinely load-bearing: a different storm seed gives a different pole bank.
    const withOther = polarDeckPack(cond, { ...packCtx(cond, 4242), stormSeed: 1234 });
    const withGame = polarDeckPack(cond, packCtx(cond, 4242));
    expect(withOther.meta.pole).not.toEqual(withGame.meta.pole);
  });

  it('the canonical-N prior is what the wire delivers (a modal read over 200 seeds, not a pin)', () => {
    // Saturn stays hexagon-LIKELY, never hexagon-PINNED: POLAR_N_DELTA_WEIGHTS spreads N over
    // {5, 6, 7} at {.25, .50, .25} and the MODE is the claim.
    //
    // ⚠ THE SAMPLE SIZE IS THE MEASUREMENT, NOT A DETAIL. The first version of this test took the
    // mode over the 10 seeds in MACRO_SEEDS and read 5, not 6 — a correct pack failing a gate that
    // was really asserting that a 10-draw sample lands on its own mode. Measured across sample
    // sizes: N=10 gave 5:3 6:5 7:2 on one seed list and a modal 5 on another; N=200 gives
    // 5:59 6:91 7:50; N=1000 gives 5:265 6:484 7:251 against the exact .25/.50/.25 expectation.
    // 200 is used because it separates the bins and still costs ~200 pack calls.
    const cond = gasCondition('Gas giant (Saturnian)');
    const counts = new Map();
    for (let s = 1; s <= 200; s++) {
      const v = polarDeckPack(cond, packCtx(cond, s)).drivers.uPolarSides;
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    const modal = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    expect(modal).toBe(POLAR_CANONICAL_N[E5_REGIME.SATURNIAN].sides);
    // the spread is real — a pinned hexagon would be the wrong answer too
    expect([...counts.keys()].sort()).toEqual([5, 6, 7]);
    expect(counts.get(6)).toBeGreaterThan(counts.get(5));
    expect(counts.get(6)).toBeGreaterThan(counts.get(7));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────
function conditionOf(preset) {
  const fp = DRIVER_PRESETS[preset];
  return deriveConditionVector(fp, deriveUniforms(fp, 'high'), 1);
}
function gasCondition(preset) {
  const cond = conditionOf(preset);
  if (compositionClass(cond) !== 'gas') throw new Error(`${preset} is not a gas condition`);
  return cond;
}
function packCtx(cond, macroSeed) {
  return {
    displayRadiusEarth: gameDisplayRadiusEarth(cond.radiusEarth ?? 1),
    macroSeed, animRate: 1, gates: { polarVortex: true }, relevance: {},
  };
}

const SYSTEM_SEEDS = Array.from({ length: 200 }, (_, i) => `pdk-${i}`);
const POPULATION = (() => {
  const out = [];
  for (const seed of SYSTEM_SEEDS) {
    const s = StarSystemGenerator.generate(seed, null);
    (s.planets || []).forEach((e, ordinal) => {
      const cond = conditionFromPlanet(e.planetData);
      if (compositionClass(cond) !== 'gas') return;
      out.push({ id: `${seed}#${ordinal}`, cond, regime: giantRegimeOf(cond) });
    });
  }
  return out;
})();
// A body that comes up PRESENT, named so the gate cannot be satisfied by "some body somewhere".
const PRESENT_EXAMPLE_ID = 'pdk-0#5';
