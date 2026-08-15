// tests/moon-rng-stream-identity.test.js — documentation of MoonGenerator's draw-stream SHAPE.
// Build plan: docs/FEATURES/step8-build-plan-2026-08-12.md §5 G2, commit C6.
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// WHAT THIS REPLACES, AND WHY IT IS NOT A COPY OF WHAT IT REPLACES
// ════════════════════════════════════════════════════════════════════════════════════════════
// Step 8's gate G2 (`PLAN.md:395`) asked for "per-type draw count pinned to a committed number".
// §5 deletes it as unsatisfiable, and the plan's own §1 row 3 says why: `15 draws` is a count of
// `rng.` CALL SITES lexically inside `generate`, and NO MOON CONSUMES 15. Executed counts are
// ranges — measured here as 11-13 for rocky/ice/captured, 11-12 for volcanic, 17-18 for
// terrestrial, 18-29 for planet-class — so any single committed number is wrong for every body.
//
// What replaces it is the per-(parent type, moonIndex, resulting type) draw-count SET, pinned
// whole. That is a genuinely different object: it does not claim a moon draws N times, it claims
// that ACROSS 1500 SYSTEMS the generator's branch structure produces exactly this set of
// (branch → observed counts) pairs and no others. It is documentation of the stream shape, which
// is what §5 asks for — Instrument B's DRAW STREAM channel remains the gate for leaks.
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// HOW THE COUNTER WORKS, AND WHY IT IS NOT THE FENCE'S COUNTER
// ════════════════════════════════════════════════════════════════════════════════════════════
// `tests/body-identity-fence.test.js:226-244` installs an accessor on `SeededRandom.PROTOTYPE`,
// so it counts EVERY instance in the process. That is correct for the fence's purpose and wrong
// for this one: it cannot distinguish a draw off the shared generation stream from a draw off a
// dedicated sub-rng, which is exactly the confusion that made C4's prediction phase discover the
// `mooncomp:` blocker (a benign namespaced sub-rng reds the fence's channel on 197 of 221 seeds
// with zero drawn values moved — see MoonGenerator.js:506-524).
//
// This file instead patches the OWN `rng` property of the SINGLE instance handed to each call, for
// the duration of that call, and restores it in a `finally`. Consequences, all wanted:
//   · it counts the SHARED STREAM ONLY — `rng.child(...)` and `new SeededRandom('moonecc:…')`
//     draw from other objects and are correctly invisible;
//   · it touches no prototype, so nothing can leak into another test file's worker;
//   · it is the channel a spliced `rng.float()` actually perturbs.
// ⛔ It is NOT a duplicate of the fence's instrumentation and must not be "unified" with it. The
// two measure different objects on purpose.
//
// ⛔ NOTHING HERE IMPORTS `tests/body-identity-fence.test.js`. It has zero exports, and importing
// a vitest module executes its `describe`/`it` registrations inside the importer.
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// ⛔ THE CORPUS IS PART OF THE COMMITTED LITERAL, NOT A KNOB
// ════════════════════════════════════════════════════════════════════════════════════════════
// `wd-0` … `wd-1499`, galaxyContext null. The set is still GROWING at that size — measured:
//     N= 192 → 53 keys /  73 pairs        N=1000 → 63 keys /  99 pairs
//     N= 500 → 60 keys /  89 pairs        N=1500 → 64 keys / 105 pairs
//                                          N=2000 → 65 keys / 109 pairs
// so raising N "for coverage" reds this file by construction. The corpus and the set are asserted
// in the same block for that reason. 1500 seeds cost ~260 ms of generation with the counter in.

import { describe, it, expect, beforeAll } from 'vitest';

import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { MoonGenerator } from '../src/generation/MoonGenerator.js';

const STREAM_SEEDS = 1500;               // wd-0 … wd-1499
// The contract file's corpus, duplicated as a formula plus the fence's 5 PINNED seeds. Used only
// by the orphan-accounting test, so that both files report the same population arithmetic.
const CONTRACT_SEEDS = [
  ...Array.from({ length: 192 }, (_, i) => `wd-${i}`),
  'wd-356', 'wd-395', 'wd-614', 'wd-2232', 'wd-1403',
];

/**
 * Runs `StarSystemGenerator.generate` over a seed list with every `MoonGenerator.generate` call
 * instrumented, and returns the observed stream shape.
 *
 * @param {string[]} seeds
 * @param {boolean} plainPlusOne - simulate the `extradraw` mutant faithfully. See the mutant note
 *        on the pinned-set test for why +1 on the plain path is an EXACT simulation of a splice at
 *        MoonGenerator.js:157 rather than an approximation of one.
 */
function captureStream(seeds, plainPlusOne = false) {
  const original = MoonGenerator.generate;
  const counts = new Map();          // `parentType|moonIndex|resultType` -> Set<drawCount>
  let calls = 0;
  let plainCalls = 0;
  let planetClassCalls = 0;

  MoonGenerator.generate = function instrumented(rng, planetData, moonIndex, totalMoons, ...rest) {
    const realRng = rng.rng;
    let drawn = 0;
    rng.rng = function counted(...args) { drawn++; return realRng.apply(this, args); };
    let out;
    try {
      out = original.call(this, rng, planetData, moonIndex, totalMoons, ...rest);
    } finally {
      rng.rng = realRng;
    }
    const isPlanetClass = !!(out && out.planetData);
    if (plainPlusOne && !isPlanetClass) drawn += 1;
    calls++;
    if (isPlanetClass) planetClassCalls++; else plainCalls++;
    const key = `${planetData.type}|${moonIndex}|${isPlanetClass ? 'PLANET-CLASS' : out.type}`;
    if (!counts.has(key)) counts.set(key, new Set());
    counts.get(key).add(drawn);
    return out;
  };
  try {
    for (const seed of seeds) StarSystemGenerator.generate(seed, null);
  } finally {
    MoonGenerator.generate = original;
  }

  const lines = [...counts.entries()]
    .map(([k, v]) => `${k}=[${[...v].sort((a, b) => a - b).join(',')}]`)
    .sort();
  return {
    lines,
    calls,
    plainCalls,
    planetClassCalls,
    keys: counts.size,
    pairs: [...counts.values()].reduce((n, s) => n + s.size, 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE COMMITTED SET — 64 lines, measured at ea8afca over `wd-0` … `wd-1499`, galaxyContext null.
// Read a line as: <parent planet type>|<moon index>|<what generate returned> = [observed counts].
//
// Shape facts worth having in front of you, all measured:
//   · moonIndex spans 0-5; counts-per-key min 1, max 5, mean 1.56 (was max 6 / 1.64 before 8b).
//   · The PLAIN keys are tight — most carry a single count, none more than three.
//   · The FIVE widest keys are PLANET-CLASS, which is expected: `_generatePlanetMoon` generates a
//     whole planet (MoonGenerator.js:320), so it inherits every branch of PlanetGenerator's stream.
//   · `sub-neptune|0|terrestrial=[18]` is the rarest line in the file — the ~3% terrestrial branch
//     at MoonGenerator.js:459 plus its seven clouds/atmosphere/aurora draws at :186-201.
// ⛔ Do NOT drop `moonIndex` from the key to shrink this. Measured: it collapses to 32 keys / 54
// pairs, and it takes the `moonIndex === 0` volcanic branch (:437) and the orbitZone ternary
// (:139-147) out of the fence with it.
// ─────────────────────────────────────────────────────────────────────────────────────────────
const PINNED_STREAM_SET = [
  'carbon|0|captured=[11]',
  'carbon|0|ice=[11]',
  'carbon|0|rocky=[11]',
  'eyeball|0|captured=[11]',
  'eyeball|0|ice=[11]',
  'eyeball|0|rocky=[11]',
  'gas-giant|0|captured=[12]',
  'gas-giant|0|ice=[12]',
  'gas-giant|0|rocky=[12]',
  'gas-giant|0|volcanic=[12]',
  'gas-giant|1|PLANET-CLASS=[19,21,23,27]',
  'gas-giant|1|captured=[11,12]',
  'gas-giant|1|ice=[11,12]',
  'gas-giant|1|rocky=[11,12]',
  'gas-giant|2|PLANET-CLASS=[19,21,23,27]',
  'gas-giant|2|captured=[12]',
  'gas-giant|2|ice=[12]',
  'gas-giant|2|rocky=[12]',
  'gas-giant|3|PLANET-CLASS=[21,23,27,29]',
  'gas-giant|3|captured=[12]',
  'gas-giant|3|ice=[12]',
  'gas-giant|3|rocky=[12]',
  'gas-giant|4|PLANET-CLASS=[21,23]',
  'gas-giant|4|captured=[12]',
  'gas-giant|4|ice=[12]',
  'gas-giant|4|rocky=[12]',
  'gas-giant|5|PLANET-CLASS=[21,27]',
  'gas-giant|5|captured=[12]',
  'gas-giant|5|ice=[12]',
  'gas-giant|5|rocky=[12]',
  'ice|0|captured=[11]',
  'ice|0|ice=[11]',
  'ice|0|rocky=[11]',
  'lava|0|captured=[11]',
  'lava|0|ice=[11]',
  'lava|0|rocky=[11]',
  'ocean|0|captured=[11]',
  'ocean|0|ice=[11]',
  'ocean|0|rocky=[11]',
  'rocky|0|captured=[11]',
  'rocky|0|ice=[11]',
  'rocky|0|rocky=[11]',
  'sub-neptune|0|captured=[12,13]',
  'sub-neptune|0|ice=[12,13]',
  'sub-neptune|0|rocky=[12,13]',
  'sub-neptune|0|terrestrial=[18]',
  'sub-neptune|0|volcanic=[12]',
  'sub-neptune|1|PLANET-CLASS=[19,21,23,25,27]',
  'sub-neptune|1|captured=[11,12,13]',
  'sub-neptune|1|ice=[11,12,13]',
  'sub-neptune|1|rocky=[11,12,13]',
  'sub-neptune|1|terrestrial=[17,18]',
  'sub-neptune|1|volcanic=[11,12]',
  'sub-neptune|2|PLANET-CLASS=[19,21,23,27,29]',
  'sub-neptune|2|captured=[12,13]',
  'sub-neptune|2|ice=[12,13]',
  'sub-neptune|2|rocky=[12,13]',
  'sub-neptune|2|volcanic=[12]',
  'terrestrial|0|captured=[11]',
  'terrestrial|0|ice=[11]',
  'terrestrial|0|rocky=[11]',
  'terrestrial|1|captured=[11]',
  'terrestrial|1|ice=[11]',
  'terrestrial|1|rocky=[11]',
];

describe('moon rng stream identity — the shape of MoonGenerator\'s draws off the shared stream', () => {
  let stream;
  beforeAll(() => {
    stream = captureStream(Array.from({ length: STREAM_SEEDS }, (_, i) => `wd-${i}`));
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // POPULATION GUARD — declared first, so no assertion below can pass by measuring nothing.
  //
  // ⛔ THIS GUARD COUNTS **CALLS**, NOT RECORDS, AND THE DISTINCTION IS FATAL IF GOT WRONG.
  // Draw counts are only observable at call time; a walk of the finished system has no access to
  // them, and it is also a SMALLER population, because migration-scatter and binary culling
  // discard whole planets after their moons are built. C4's own message warns about this: "an
  // implementer who predicts +770 draws and measures +798 would read a correct commit as a leak".
  // ⚠ Note also that C4's 798 is the PLAIN-returning count on the fence's 221 seeds; the TOTAL
  // call count there is higher. Neither number belongs in this file — this corpus is `wd-0…1499`.
  //
  // MUTANT: `shortcorpus` — set STREAM_SEEDS to 1000. calls 5207 -> 3643, and this reds before
  // the set assertion can quietly pass on a smaller sample.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('POPULATION: the corpus is 1500 seeds and 5207 generate calls, not 4861 surviving records', () => {
    expect(STREAM_SEEDS).toBe(1500);
    expect({
      calls: stream.calls,
      plainCalls: stream.plainCalls,
      planetClassCalls: stream.planetClassCalls,
    }).toEqual({ calls: 5207, plainCalls: 5038, planetClassCalls: 169 });
    // The counter has to have seen something on every call, or every count below is a zero.
    expect(stream.lines.every((l) => !l.includes('=[]'))).toBe(true);
    expect(stream.lines.some((l) => l.includes('=[0]'))).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // THE PINNED SET — §5 G2's replacement, asserted whole rather than by shape.
  //
  // ⛔ MUTANT: `extradraw` — insert `rng.float();` immediately before MoonGenerator.js:157
  // (`const startAngle = rng.range(0, Math.PI * 2);`). MEASURED, and the measurement is exact
  // rather than approximate: a draw at :157 lands after every branch-deciding draw on the plain
  // path (`_pickType`'s roll, the volcanic/planet-class chances, the captured retrograde chance at
  // :155) and before only value draws, so it adds exactly +1 to the plain count and changes no
  // branch. Result: all 57 PLAIN lines shift, and the 7 PLANET-CLASS lines stay BYTE-IDENTICAL —
  // because `_generatePlanetMoon` returns at MoonGenerator.js:100, before :157 exists. 0 of the 64
  // baseline lines survive in the plain partition; this assertion reds on every one of them.
  // That asymmetry is asserted separately below, because it is what proves the mutant is localised
  // to the plain path rather than merely "something moved".
  //
  // MUTANT: `namespaceleak` — swap `namespacedFloat(compSeed)` at MoonGenerator.js:245 back to
  // `new SeededRandom(compSeed).float()`. This file stays GREEN (a sub-rng is a different object
  // and the shared stream is untouched) while Instrument B's DRAW STREAM channel goes red on
  // 197/221 seeds. That contrast is the reason this file instruments the instance and not the
  // prototype: the two channels are supposed to disagree there, and C4 spent a whole prediction
  // phase discovering it.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('the per-(parentType, moonIndex, resultType) draw-count set over wd-0…wd-1499 is exactly this', () => {
    // Corpus and set asserted together — the set is only meaningful at this N (see header).
    expect(STREAM_SEEDS).toBe(1500);
    expect(stream.lines).toEqual(PINNED_STREAM_SET);
    expect(stream.keys).toBe(64);
    expect(stream.pairs).toBe(100);
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // THE PARTITION — the plain path and the planet-class path are different literals in the same
  // function, and they must be separable. `_generatePlanetMoon` returns at MoonGenerator.js:100;
  // everything the plain path draws happens after it. Pinning the split means a change confined to
  // one path is reported as confined, which is what makes `extradraw` diagnosable rather than
  // merely detectable.
  //
  // MUTANT: `extradraw` (above) — the 57 plain lines all move, the 7 planet-class lines do not.
  // MUTANT: `pcextradraw` — insert `rng.float();` before MoonGenerator.js:346. Mirror image: the 7
  // planet-class lines all move, the 57 plain lines do not.
  // ⭐ MUTANT `postmigration` — substitute the wrapper's POST-migration orbitRadiusAU (mutated at
  // StarSystemGenerator.js:655 / :682) at MoonGenerator.js:378 instead of the generation-time one.
  // ⛔ `Math.min(...nums(planetClass))` BELOW IS THE ONLY ASSERTION IN THE TREE THAT SEPARATES THE
  // TWO CONVENTIONS. Measured over this file's own 1500 seeds: shipped min 19 / pairs 100, mutant
  // min 18 / pairs 102, and only 2 of the 7 PLANET-CLASS lines differ at all (gas-giant|3 gains an
  // 18, gas-giant|5 gains a 19). Every other channel — Instrument B's seed list and {0,7,0,24}
  // partition, every geometry column — is bit-identical between the two, so a wrong-AU
  // implementation passes almost the whole re-bless. ⛔ Do not relax this to a range.
  it('the plain path and the planet-class path partition the set 57 / 7', () => {
    const planetClass = stream.lines.filter((l) => l.includes('|PLANET-CLASS='));
    const plain = stream.lines.filter((l) => !l.includes('|PLANET-CLASS='));
    expect({ plain: plain.length, planetClass: planetClass.length }).toEqual({ plain: 57, planetClass: 7 });
    // Every planet-class count is above every plain count — the planet-class path generates a
    // whole planet, so it cannot be cheaper. Spans: plain 11-18, planet-class 19-29 — DISJOINT
    // only since 8b; they touched at 18 before, so "above" was false at the boundary.
    const nums = (ls) => ls.flatMap((l) => l.slice(l.indexOf('[') + 1, -1).split(',').map(Number));
    expect(Math.max(...nums(plain))).toBe(18);
    expect(Math.min(...nums(planetClass))).toBe(19);
    expect(Math.max(...nums(planetClass))).toBe(29);
    expect(Math.min(...nums(plain))).toBe(11);

    // The faithful `extradraw` simulation, run as a live control rather than asserted from a
    // comment: +1 on the plain path only. If this ever fails to separate, the mutant note above is
    // wrong and the gate below it is not doing what it claims.
    const mutated = captureStream(Array.from({ length: STREAM_SEEDS }, (_, i) => `wd-${i}`), true);
    const survived = mutated.lines.filter((l) => stream.lines.includes(l));
    expect(survived.length).toBe(7);
    expect(survived.every((l) => l.includes('|PLANET-CLASS='))).toBe(true);
    expect(mutated.lines).not.toEqual(PINNED_STREAM_SET);
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // ORPHAN ACCOUNTING — build-plan §8 item 1's documentation, on the contract file's corpus
  // (197 seeds: wd-0…wd-191 + the 5 PINNED, galaxyContext null) so the two C6 files report one
  // arithmetic between them.
  //
  // Measured at ea8afca:
  //     758 calls  =  733 plain-returning  +  25 planet-class-returning
  //     728 records survive into `planets[].moons`  =  705 plain  +  23 planet-class
  //      30 orphans  =  28 plain  +  2 planet-class
  // An orphan is a moon whose parent planet was discarded AFTER the moon was generated — by
  // migration-scatter or by the binary-stability cull. It cost draws off the shared stream and
  // moved the universe; it just is not in the finished system.
  //
  // ⛔ THIS IS THE NUMBER A FUTURE IMPLEMENTER GETS WRONG. Any per-plain-moon side effect on this
  // corpus costs 733, not 705. Predicting 705 and measuring 733 reads as a leak that is not there.
  //
  // MUTANT: `keeporphans` — remove the binary-stability cull. `orphans` goes to 0 and this reds,
  // naming the population change instead of letting it hide inside a moved hash.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  it('ORPHANS: 758 generate calls yield 728 surviving records on the contract corpus', () => {
    const original = MoonGenerator.generate;
    let calls = 0;
    let plainCalls = 0;
    let planetClassCalls = 0;
    MoonGenerator.generate = function counting(...args) {
      const out = original.apply(this, args);
      calls++;
      if (out && out.planetData) planetClassCalls++; else plainCalls++;
      return out;
    };
    let survivors = 0;
    let survivingPlain = 0;
    let survivingPlanetClass = 0;
    try {
      for (const seed of CONTRACT_SEEDS) {
        const sys = StarSystemGenerator.generate(seed, null);
        for (const entry of sys.planets) {
          for (const m of (entry.moons || [])) {
            survivors++;
            if (m.planetData) survivingPlanetClass++; else survivingPlain++;
          }
        }
      }
    } finally {
      MoonGenerator.generate = original;
    }
    expect(CONTRACT_SEEDS.length).toBe(197);
    expect({ calls, plainCalls, planetClassCalls }).toEqual({ calls: 758, plainCalls: 733, planetClassCalls: 25 });
    expect({ survivors, survivingPlain, survivingPlanetClass })
      .toEqual({ survivors: 728, survivingPlain: 705, survivingPlanetClass: 23 });
    expect({
      orphans: calls - survivors,
      orphanPlain: plainCalls - survivingPlain,
      orphanPlanetClass: planetClassCalls - survivingPlanetClass,
    }).toEqual({ orphans: 30, orphanPlain: 28, orphanPlanetClass: 2 });
  });
});
