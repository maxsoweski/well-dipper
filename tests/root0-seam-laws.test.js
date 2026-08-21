// tests/root0-seam-laws.test.js — B1 (ROOT-0): the four repaired reads at the lab-side law seam.
//
// ⭐ WHAT THIS FILE IS FOR. `deriveUniforms` (labCore) and `deriveBodyScalars` (baseStep) are
// **fp-shaped** and are handed **condition-shaped** objects. Four inputs were dropped or mis-spelled
// at that one seam. Each assertion below is written so that REVERTING ITS ONE FIX turns THAT
// assertion red and no other — a fix with no failing-on-revert test is not a proven fix.
//
// ⛔ NONE OF THIS IS ON THE PLAYER PATH, and saying otherwise was the earlier draft's central error.
// `deriveUniforms` has no call site in `src/`; `deriveConditionVector` is called with `derived = null`
// on the game route (conditionFromBody.js:868 `  const condition = deriveConditionVector(fp, null, fp.radiusEarth);`).
// B1's other gate — Instrument C, the shipped-uniform delta — is byte-identical on all four packs
// BECAUSE of that, not in spite of it. What these repairs buy is that every subsequent LAB
// measurement is honest, and that the laws B3 extracts into the packs are the right laws.
//
// Movement over the full corpus: docs/FEATURES/root0-seam-delta-table.md.
import { describe, it, expect } from 'vitest';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import { deriveBodyScalars } from '../src/worldengine/base/baseStep.js';
import { AGE_NORM_DIVISOR } from '../src/worldengine/base/adaptL0.js';

// ── the corpus slice. A SLICE of `lab-procedural-0…199`, not a different corpus: same generator, same
//    seed form, first 20 systems. The delta table measures all 200; this file only needs enough
//    bodies for each property to be non-vacuous, and it asserts its own population so a generator
//    change that empties it fails loudly instead of passing vacuously. ──
const BODIES = [];
for (let i = 0; i < 20; i++) {
  const sys = StarSystemGenerator.generate(`lab-procedural-${i}`, null);
  for (const entry of (sys.planets || [])) {
    BODIES.push({ id: `S:${i}:p`, body: entry.planetData });
    for (const m of (entry.moons || [])) BODIES.push({ id: `S:${i}:m`, body: m.planetData || m });
  }
}
const CONDITIONS = BODIES.map((b) => conditionFromBody(b.body));

describe('B1 ROOT-0 · the corpus slice is real', () => {
  it('has bodies, and every one produces a condition', () => {
    expect(BODIES.length).toBeGreaterThan(100);
    expect(CONDITIONS.length).toBe(BODIES.length);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('B1 fix 1 · erosion — the reader learns the GAME spelling without forgetting the LAB one', () => {
  // ⛔ THIS RETIRES A DEFERRAL BY NAME. tests/port-condition-contract.test.js pins that the PORT still
  // forwards the game's own key (`erosionLevel`), and that pin is still true and still wanted — the
  // rename never happened at the port. What changed is the READER: it now resolves either spelling.
  it('labCore: the game spelling resolves, and to the same value as the lab spelling', () => {
    const game = deriveUniforms({ surfaceHistory: { erosionLevel: 0.8 } }).reliefAmplitude;
    const lab  = deriveUniforms({ surfaceHistory: { erosion: 0.8 } }).reliefAmplitude;
    const none = deriveUniforms({ surfaceHistory: {} }).reliefAmplitude;
    expect(game).toBe(lab);
    expect(game).not.toBe(none);
  });

  it('labCore: the LAB spelling still wins when a bundle carries both — no preset moves', () => {
    const both = deriveUniforms({ surfaceHistory: { erosion: 0.2, erosionLevel: 0.9 } }).reliefAmplitude;
    expect(both).toBe(deriveUniforms({ surfaceHistory: { erosion: 0.2 } }).reliefAmplitude);
  });

  it('baseStep: the same two spellings at the second reader', () => {
    expect(deriveBodyScalars({ surfaceHistory: { erosionLevel: 0.8 } }).surfaceHistory).toBe(0.8);
    expect(deriveBodyScalars({ surfaceHistory: { erosion: 0.2, erosionLevel: 0.9 } }).surfaceHistory).toBe(0.2);
    expect(deriveBodyScalars({ surfaceHistory: {} }).surfaceHistory).toBe(0);
  });

  it('⭐ ON REAL BODIES: the quantity is no longer a hard 0 on the whole population', () => {
    // The measured defect: `surfaceHistory.erosion` undefined on 616/616, while `erosionLevel` runs
    // 0.0150…1.0000. Before the fix BOTH numbers below were 0.
    const vals = CONDITIONS.map((c) => deriveBodyScalars(c).surfaceHistory);
    expect(vals.every((v) => v === 0)).toBe(false);
    // ⚠ BOUND DERIVED, NOT PICKED. PhysicsEngine.js:813-815 makes erosion a function of the SYSTEM's
    // age (one draw per system) through one of TWO atmosphere branches, so 20 systems can yield at
    // most ~40 distinct values and yields 32. `> 20` is "more than one distinct value per system",
    // which is the weakest claim that still refutes the defect (which was ONE value, 0, everywhere).
    // The exact per-body identity below is the strong assertion; this one is the non-vacuity guard.
    expect(new Set(vals).size).toBeGreaterThan(20);
    for (const [i, c] of CONDITIONS.entries()) {
      expect(vals[i], BODIES[i].id).toBe(c.surfaceHistory.erosionLevel);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('B1 fix 2 · tidal precedence — the forwarded Io-ratio beats the recompute', () => {
  it('labCore takes `rawTidalIoRatio` — the name a CONDITION uses — bit-for-bit', () => {
    expect(deriveUniforms({ rawTidalIoRatio: 137.25 }).tidalHeat).toBe(137.25);
  });

  it('labCore takes `tidalHeat` — the name an FP uses — and it outranks `rawTidalIoRatio`', () => {
    expect(deriveUniforms({ tidalHeat: 5 }).tidalHeat).toBe(5);
    expect(deriveUniforms({ tidalHeat: 5, rawTidalIoRatio: 137 }).tidalHeat).toBe(5);
  });

  it('with NEITHER key present the Io-formula fallback is untouched', () => {
    // The pre-fix path, still reachable and still the same number — the repair is a precedence
    // change, not a replacement of the law.
    const viaFormula = deriveUniforms({ eccentricity: 0.02, radiusEarth: 1 }).tidalHeat;
    expect(viaFormula).toBeGreaterThan(0);
    expect(Number.isFinite(viaFormula)).toBe(true);
  });

  it('⭐ ON REAL BODIES: the moon population stops being 1-distinct / 0-nonzero', () => {
    // Max UAT'd this population with "these are all identical". `lavaActivity` measured 1 distinct
    // and 0 nonzero on 632/632 plain moons because the recompute saw eccentricity 0.
    const lava = CONDITIONS.map((c) => deriveUniforms(c).lavaActivity);
    expect(new Set(lava).size).toBeGreaterThan(1);
    expect(lava.some((v) => v > 0)).toBe(true);
    for (const [i, c] of CONDITIONS.entries()) {
      expect(deriveUniforms(c).tidalHeat, BODIES[i].id).toBe(c.rawTidalIoRatio);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('B1 fix 3 · ageNorm — Gyr is normalised by the law two other modules already express', () => {
  it('a raw-Gyr `age` is divided by AGE_NORM_DIVISOR and clamped, exactly as adaptL0 does', () => {
    expect(deriveBodyScalars({ age: 4.5 }).ageNorm).toBe(4.5 / AGE_NORM_DIVISOR);
    expect(deriveBodyScalars({ age: 42 }).ageNorm).toBe(1);      // clamp01, not 4.2
    expect(deriveBodyScalars({ age: -3 }).ageNorm).toBe(0);
  });

  it('an explicit `ageNorm` still wins, and a bundle with neither key still falls to 0.5', () => {
    expect(deriveBodyScalars({ ageNorm: 0.3, age: 9 }).ageNorm).toBe(0.3);
    expect(deriveBodyScalars({}).ageNorm).toBe(0.5);
  });

  it('⭐ ON REAL BODIES: `(1 − ageNorm)` is never negative, on any body', () => {
    // The defect in one line: `(1 - ageNorm)` ran negative for every body older than 1 Gyr — 88.3%
    // of the corpus — which pinned shellThickness at its clamp floor and despinAmp at its ceiling.
    let aboveOneGyr = 0;
    for (const [i, c] of CONDITIONS.entries()) {
      const s = deriveBodyScalars(c);
      expect(s.ageNorm, BODIES[i].id).toBeGreaterThanOrEqual(0);
      expect(s.ageNorm, BODIES[i].id).toBeLessThanOrEqual(1);
      if ((c.age ?? 0) > 1) aboveOneGyr++;
    }
    expect(aboveOneGyr).toBeGreaterThan(0);   // non-vacuity: the defective band is populated
  });

  it('⭐ ON REAL BODIES: shellThickness is no longer pinned to one clamped value', () => {
    const shell = CONDITIONS.map((c) => deriveBodyScalars(c).shellThickness);
    expect(new Set(shell).size).toBeGreaterThan(10);
    expect(shell.every((v) => v === 0)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('B1 fix 4 · surfaceGravity — the bundle\'s own g beats a recompute from a defaulted mass', () => {
  it('a supplied g is taken bit-for-bit, not round-tripped through mass', () => {
    expect(deriveUniforms({ surfaceGravity: 0.6350823343610459, radiusEarth: 0.81 }).surfaceGravity)
      .toBe(0.6350823343610459);
  });

  it('with no g the M/R² recompute is untouched', () => {
    expect(deriveUniforms({ massEarth: 2, radiusEarth: 2 }).surfaceGravity).toBe(0.5);
    expect(deriveUniforms({}).surfaceGravity).toBe(1);
  });

  it('⭐ ON REAL BODIES: g agrees with the condition instead of contradicting it', () => {
    // `conditionFromBody` omits `massEarth` on purpose (the engine reads mass only THROUGH g), so
    // every condition-shaped body was handed 1 M⊕ and got 1/R² back — 8.3× off at the median.
    for (const [i, c] of CONDITIONS.entries()) {
      expect(deriveUniforms(c).surfaceGravity, BODIES[i].id).toBe(c.surfaceGravity);
    }
    expect(CONDITIONS.every((c) => c.massEarth === undefined)).toBe(true);   // the reason the bug existed
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// ⭐⭐ A FIFTH FIX OF THE SAME SHAPE, FOUND AT B3 LEG 3 (2026-08-21) AND LANDED THERE.
// This file's four fixes were B1's. This one is not B1's, and it is filed here rather than beside
// the pack that needed it because it is the same defect class and this is where a reader looks for
// it: ONE quantity, TWO spellings, and a reader that knows only one of them.
//   lab   driver-presets.js:102 `  // zero. axialTilt 25 (real 25.2 deg) spreads seasonal frost low per D3.` — the fp key, in DEGREES
//   game  src/worldengine/base/conditionVector.js:200 `  axialTiltDeg:    fp.axialTilt,                          // D3 obliquity in DEGREES (see the block above; the fp key is degrees on both sides)` — RENAMED on the way onto the condition vector
// `deriveUniforms` read `d.axialTilt` only, so `frostLatitudeBias` — F22/F23's low-latitude frost
// spread — was a hard 0 on every condition-shaped body. ⚠ THE PORT WAS ALREADY CORRECT: the unit
// conversion and the [0,90] fold at src/worldengine/port/conditionFromBody.js:866 both shipped at
// Step 1 and both work; only the KEY the reader asks for was wrong. The value was sitting one
// rename away the whole time, which is exactly what made it invisible.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('B3 fix 5 · obliquity — the reader learns the CONDITION spelling without forgetting the LAB one', () => {
  it('labCore: the condition spelling resolves, and to the same value as the lab spelling', () => {
    expect(deriveUniforms({ axialTiltDeg: 45 }).frostLatitudeBias)
      .toBe(deriveUniforms({ axialTilt: 45 }).frostLatitudeBias);
    expect(deriveUniforms({ axialTiltDeg: 45 }).frostLatitudeBias).toBeCloseTo(0.5, 12);
  });

  it('labCore: the LAB spelling still wins when a bundle carries both — no preset moves', () => {
    expect(deriveUniforms({ axialTilt: 0, axialTiltDeg: 90 }).frostLatitudeBias).toBe(0);
    expect(deriveUniforms({ axialTilt: 90, axialTiltDeg: 0 }).frostLatitudeBias).toBe(1);
  });

  it('with NEITHER key present the 0 fallback is untouched', () => {
    expect(deriveUniforms({}).frostLatitudeBias).toBe(0);
  });

  it('⭐ ON REAL BODIES: the quantity is no longer a hard 0 on the whole planet population', () => {
    // The reason the bug existed: the condition carries the renamed key and NOT the lab one.
    const planets = CONDITIONS.filter((c) => typeof c.axialTiltDeg === 'number');
    expect(planets.length).toBeGreaterThan(50);
    expect(CONDITIONS.every((c) => c.axialTilt === undefined)).toBe(true);
    const vals = planets.map((c) => deriveUniforms(c).frostLatitudeBias);
    expect(new Set(vals).size).toBeGreaterThan(1);
    expect(vals.filter((v) => v > 0).length).toBe(planets.length);
    // ...and every one stays inside the [0,1] domain `clamp01(x/90)` assumes, which is the property
    // the port's fold is for — a raw radian or an unfolded 177.6° would leave it.
    for (const v of vals) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });

  it('⛔ AND IT DOES NOT REACH THE MOON HALF — a plain-moon record carries no tilt key at all', () => {
    // Stated as an assertion rather than left to the leg report: this fix buys the planet half and
    // nothing on the moon half, and the cause is the generator, not the reader.
    const moonConds = BODIES.map((b, i) => [b, CONDITIONS[i]])
      .filter(([b]) => b.id.endsWith(':m') && b.body.axialTilt === undefined)
      .map(([, c]) => c);
    expect(moonConds.length).toBeGreaterThan(20);
    for (const c of moonConds) expect(deriveUniforms(c).frostLatitudeBias).toBe(0);
  });
});
