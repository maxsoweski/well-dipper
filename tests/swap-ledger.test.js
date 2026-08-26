// tests/swap-ledger.test.js — the gate on Instrument E row 9 (PLAN §12.3 cost table, §12.4 channel 1).
//
// WHAT THIS PROTECTS, AND WHY IT IS A TEST RATHER THAN A LIVE PROBE. `_lab.swapLedger()` runs in a
// browser on two live materials, so its OUTPUT can only be seen live. Its DECISIONS — which bucket a
// name lands in, and which zero-defaulted uniform counts as gate-shaped — are pure functions of two
// uniform maps and one GLSL string, and those are the parts that can be wrong in the way this
// program keeps being wrong: entirely true and entirely misleading. A ledger that reports `lost: []`
// because its membership test is subtly inverted is indistinguishable, in a browser, from a swap
// that lost nothing.
//
// ⛔ THE CONTROL DISCIPLINE (PLAN §11.3.3). Every claim below has an executed control that MOVED:
// the mutant is constructed in-test, run against the same input, and shown to give a DIFFERENT
// answer from the shipped function. "The assertion passes" is not evidence the assertion can fail.
//
// ⛔ WHAT THIS FILE DOES NOT AND CANNOT CHECK. Channel 1 is a uniform diff. Six features the game's
// gas branch draws (PLAN §12.4 channel 2: `stormMask`, `polarDark`, `hotspot`, `nightSide`,
// `ringNoise`, `haze`) have no uniform of their own and are invisible to any uniform diff, of any
// construction, forever. Nothing in this file should be read as "the swap loses nothing".

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeUniforms } from '../src/worldengine/shaders/uniforms.js';
import {
  LAB_SHADER_CORPUS,
  gateGuardPattern,
  bareMultiplicandPattern,
  gateShapeOf,
  isOffValue,
  zeroDefaultedUniformNames,
  rankOffByDefault,
  diffMaterialUniforms,
  swapLedgerOf,
} from '../src/rendering/LabPlanetMaterial.js';

const LIGHT = new THREE.Vector3(0.6, 0.35, 0.7).normalize();
const labUniforms = () => makeUniforms(LIGHT);

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 1. THE CORPUS THE GREP RUNS OVER — asserted, not assumed.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('LAB_SHADER_CORPUS', () => {
  it('already contains the height GLSL, so the two-file grep §12.4 asks for is one string', () => {
    // `LAB_FRAGMENT_SHADER` interpolates `${HEIGHT_GLSL}` at module-eval time. If that ever stopped
    // being true the rank would silently start reading half the corpus, and every "neither" row
    // would be a uniform whose only gate lives in the half that went missing.
    expect(LAB_SHADER_CORPUS.length).toBeGreaterThan(300000);
    expect(LAB_SHADER_CORPUS).toContain('uCraterDensity');
    // A token that lives ONLY in planet-lod-height.glsl.js.
    expect(LAB_SHADER_CORPUS).toContain('uDispDomainScale');
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 2. THE TWO REGEXES. Each is exercised on a synthetic corpus with the answer hand-known, and each
//    has a mutant showing the discrimination it makes is real.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('the gate-shape filter', () => {
  it('finds a bare multiplicand on either side of the star', () => {
    expect(gateShapeOf('uFoo', 'c = base * uFoo;').multiplicand).toBe(true);
    expect(gateShapeOf('uFoo', 'c = uFoo * base;').multiplicand).toBe(true);
    expect(gateShapeOf('uFoo', 'c = mix(a, b, uFoo);').multiplicand).toBe(false);
  });

  it('finds a `> 0` guard, including inside a compound condition', () => {
    expect(gateShapeOf('uFoo', 'if (uFoo > 0.0) { x(); }').guarded).toBe(true);
    expect(gateShapeOf('uFoo', 'if (uBar > 0.0 && uFoo > 0.0) { x(); }').guarded).toBe(true);
    expect(gateShapeOf('uFoo', 'if (uFoo < 1.0) { x(); }').guarded).toBe(false);
  });

  it('⭐ CONTROL THAT MOVED — the word boundary is load-bearing, not decoration', () => {
    const corpus = 'c = base * uFooBar;\nif (myuFoo > 0.0) {}';
    // Shipped: `uFoo` is NOT gate-shaped here. Both hits are on other identifiers.
    expect(gateShapeOf('uFoo', corpus).gateShaped).toBe(false);

    // The mutant: the same two patterns with `\b` deleted — the version anyone would write first.
    const mutantMult = new RegExp('(\\*\\s*uFoo)|(uFoo\\s*\\*)');
    const mutantGuard = new RegExp('if\\s*\\([^)]*uFoo\\s*>\\s*0');
    expect(mutantMult.test(corpus)).toBe(true);   // ← the mutant reports a gate
    expect(mutantGuard.test(corpus)).toBe(true);  // ← and a guard
    // …and the shipped patterns do not. The two answers differ on one input; that is the control.
    expect(bareMultiplicandPattern('uFoo').test(corpus)).toBe(false);
    expect(gateGuardPattern('uFoo').test(corpus)).toBe(false);
  });

  it('⭐ CONTROL THAT MOVED — "inside any if(…)" overshoots, which is why it was rejected', () => {
    // PLAN §12.4's target split needs 48 guarded of 87. The loose "appears anywhere in an if"
    // reading reaches 63 gate-shaped over the real corpus, i.e. it is not the missing expression.
    const names = zeroDefaultedUniformNames(labUniforms());
    const overshoot = names.filter((n) => new RegExp('if\\s*\\([^;{]*\\b' + n + '\\b').test(LAB_SHADER_CORPUS)
      || bareMultiplicandPattern(n).test(LAB_SHADER_CORPUS)).length;
    const shipped = rankOffByDefault(names, LAB_SHADER_CORPUS).gateShaped;
    expect(overshoot).toBeGreaterThan(shipped);
    expect(overshoot).toBe(66);   // ⭐⭐ 64 -> 66 AT B4-2, AND THIS CONTROL IS THE ONE THAT CORROBORATES THE `neither` ROW ABOVE RATHER THAN CONTRADICTING IT. The narrow shipped filter put uShadowMoonCount and uShadowPlanetCount in `neither` — read by no guard it recognises. This LOOSE reading — the name appearing anywhere inside an if(…) — picks up exactly those same two, from `if (i >= uShadowMoonCount) break;` and its planet twin. So the two filters disagree about these two names in the direction the loose one is known to overshoot, which is the behaviour this control exists to demonstrate. MEASURED, not predicted: the first run of this line came back 66 against an expected 64 and the two names were then read out of the corpus by hand.   // ⭐ +1 AT B4-1 (uStarBrightness2). The whole +1 is that ONE new uniform: of the five the star set adds, it is the only scalar-zero default, and the fragment spends it as a bare multiplicand (`uStarColor2 * diff2 * uStarBrightness2`). MEASURED this session.
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 3. THE MEASURED PINS. These are the numbers a caption may quote.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('the measurement §12.4 states, reproduced', () => {
  const u = labUniforms();

  it('reproduces 364 declared and 90 scalar-zero-defaulted EXACTLY', () => {
    // PLAN §12.4 measured these at `9b33264`; `git diff 9b33264 HEAD` over planet-lod-uniforms.js,
    // planet-lod-shaders.glsl.js and planet-lod-height.glsl.js is empty, so they must still hold.
    expect(Object.keys(u).length).toBe(365);   // ⭐⭐ 356 -> 364 AT B4-2: uStarPos1, uStarPos2, uShadowMoonCount, uShadowMoonPos, uShadowMoonRadius, uShadowPlanetCount, uShadowPlanetPos, uShadowPlanetRadius — the caster set closing ledger P-03. MEASURED by importing makeUniforms in this session.   // ⭐ 351 -> 356 AT B4-1: uLightDir2, uStarColor1, uStarColor2, uStarBrightness1, uStarBrightness2 — the star set closing ledger P-01 / P-02. MEASURED by importing makeUniforms in this session, not derived from the old number.   // +1 2026-08-26: uCoarseCut, the tidal process term moved off the FREQUENCY and onto the AMPLITUDE (rockySurface pack; src/worldengine/base/macroWavelength.js coarseReliefCut). A DECLARED addition, not drift.
    expect(zeroDefaultedUniformNames(u).length).toBe(91);   // ⭐⭐ 88 -> 90 AT B4-2, and the +2 is enumerable and is the WHOLE scalar-zero contribution of the eight: uShadowMoonCount and uShadowPlanetCount. The other six are two zero VECTORS (uStarPos1/2) and four ARRAYS, none of which is a scalar. MEASURED this session.   // ⭐ +1 AT B4-1 (uStarBrightness2). The whole +1 is that ONE new uniform: of the five the star set adds, it is the only scalar-zero default, and the fragment spends it as a bare multiplicand (`uStarColor2 * diff2 * uStarBrightness2`). MEASURED this session.   // +1 2026-08-26: uCoarseCut, the tidal process term moved off the FREQUENCY and onto the AMPLITUDE (rockySurface pack; src/worldengine/base/macroWavelength.js coarseReliefCut). A DECLARED addition, not drift.
  });

  it('names the wider off-value population separately rather than conflating the two', () => {
    // ⭐ 114 AT B4-1, and the breakdown was MEASURED not inferred: 88 scalar zeros + 24 all-zero vectors + 1 all-zero COLOUR + the one null sampler slot. Was 111 = 87 + 23 + 0 + 1. Three of B4-1's five land here (uStarBrightness2 scalar, uLightDir2 vector, uStarColor2 colour); uStarColor1 (1,1,1) and uStarBrightness1 (1.0) are NOT off-valued, which is the point — their defaults ARE the pre-B4 implicit white light. ⚠ uStarColor2 is the FIRST all-zero THREE.Color in this population; isOffValue reaches it through `toArray`, not through a vector branch.
    const off = Object.keys(u).filter((n) => isOffValue(u[n].value));
    expect(off.length).toBe(124);   // ⭐⭐ 114 -> 123 AT B4-2, and the +9 DOES NOT EQUAL the 8 uniforms added — that gap is the finding, not a rounding. MEASURED breakdown at HEAD: 90 scalar zeros + 26 all-zero vectors + 1 all-zero COLOUR + 1 null sampler slot + 5 all-zero ARRAYS = 123. Eight of the nine are the new caster names, every one of which is off at its default. ⛔ THE NINTH IS uStormColor, WHICH IS NOT NEW AND DID NOT CHANGE VALUE. isOffValue's array branch was `v.every((c) => c === 0)`, which is correct for a flat float array and wrong for an array of Vector3/Color: uStormColor is eight all-zero colours and reported NOT off. B4-2 made that branch recurse, which is why it now reports off. Every off-value figure published for this bag before B4-2 — 111 and 114 — counted uStormColor on the wrong side of this line.   // +1 2026-08-26: uCoarseCut, the tidal process term moved off the FREQUENCY and onto the AMPLITUDE (rockySurface pack; src/worldengine/base/macroWavelength.js coarseReliefCut). A DECLARED addition, not drift.
    // Every scalar-zero is also off-valued; the reverse is not true, and the gap is the point.
    for (const n of zeroDefaultedUniformNames(u)) expect(off).toContain(n);
  });

  it('⛔ pins THIS filter\'s split, and records that §12.4\'s 58 does not reproduce', () => {
    const rank = rankOffByDefault(zeroDefaultedUniformNames(u), LAB_SHADER_CORPUS);
    // ⚠ PLAN §12.4 records 58 gate-shaped — 38 both / 10 guard-only / 10 multiplicand-only / 29
    // neither — and does NOT record the expression that produced them. This filter measures the
    // MULTIPLICAND TOTAL identically (17+31 = 48 = 38+10) and diverges entirely on the guard arm
    // (24 vs 48). Five guard readings were tried; none reaches 48. The number below is this file's,
    // and a caption must quote it rather than §12.4's.
    expect(rank).toMatchObject({
      total: 91, gateShaped: 56, both: 17, guardOnly: 7, multiplicandOnly: 32, neither: 35,   // ⭐⭐ B4-2 moved exactly two of these six, by exactly one each, and BOTH LANDED IN `neither`: total 88->90 and neither 32->34. gateShaped, both, guardOnly and multiplicandOnly are ALL UNCHANGED, which is this row's control — the caster set adds no new multiplicand and no new `if`-read that this filter recognises. ⚠ AND THAT LAST CLAUSE IS A STATEMENT ABOUT THE FILTER, NOT ABOUT THE SHADER. The two counts ARE read as guards in the GLSL — `if (i >= uShadowMoonCount) break;` — but rankOffByDefault's guard pattern does not match the break-out-of-loop shape, so it classifies them `neither`. Recorded here rather than silently absorbed, because a future reader comparing this table against the shader would otherwise find a contradiction and have to re-derive which side was wrong.   // ⭐ B4-1 moved exactly two of these six, by exactly one each: total 87->88 and multiplicandOnly 31->32, which carries gateShaped 55->56. `both`, `guardOnly` and `neither` are UNCHANGED. That shape is the control: uStarBrightness2 enters as a pure multiplicand and is read by no `if`, so a move in `guardOnly` here would mean something other than the star set moved.   // +1 2026-08-26: uCoarseCut, the tidal process term moved off the FREQUENCY and onto the AMPLITUDE (rockySurface pack; src/worldengine/base/macroWavelength.js coarseReliefCut). A DECLARED addition, not drift.   // +1 2026-08-26: uCoarseCut lands in `neither` — it is a plain scalar, not gate-shaped and not a multiplicand. Declared addition, ledger row P-19.
    });
    expect(rank.both + rank.guardOnly + rank.multiplicandOnly + rank.neither).toBe(91);   // +1 2026-08-26: uCoarseCut, the tidal process term moved off the FREQUENCY and onto the AMPLITUDE (rockySurface pack; src/worldengine/base/macroWavelength.js coarseReliefCut). A DECLARED addition, not drift.
    expect(rank.both + rank.multiplicandOnly).toBe(49);   // ⭐ UNCHANGED ACROSS B4-2 — the caster set contributes no multiplicand.   // ⛔ WAS 48, AND THE COMMENT THAT SAID "agrees with §12.4's 38 + 10" IS WITHDRAWN RATHER THAN RE-FITTED. §12.4's 48 was measured on a 351-uniform material that no longer exists; B4-1 added a 49th multiplicand. The agreement was real and is now historical — it is not evidence about this tree.
  });

  it('puts §12.4\'s two named subjects inside the ranked set — the thing the rank is FOR', () => {
    const rank = rankOffByDefault(zeroDefaultedUniformNames(u), LAB_SHADER_CORPUS);
    const byName = Object.fromEntries(rank.rows.map((r) => [r.name, r]));
    // "so `uLimbStrength` and `uPolarStrength` are both inside the ranked set rather than depending
    // on someone remembering them" — §12.4.
    expect(byName.uLimbStrength?.gateShaped).toBe(true);
    expect(byName.uPolarStrength?.gateShaped).toBe(true);
    // …and the rank puts the doubly-shaped rows first, so the reading order IS the rank.
    const firstNeither = rank.rows.findIndex((r) => !r.gateShaped);
    const lastShaped = rank.rows.map((r) => r.gateShaped).lastIndexOf(true);
    expect(lastShaped).toBeLessThan(firstNeither);
  });

  it('⭐ CONTROL THAT MOVED — the pin above tracks the corpus, it is not a constant', () => {
    const names = zeroDefaultedUniformNames(u);
    const base = rankOffByDefault(names, LAB_SHADER_CORPUS);
    // Give one currently-unshaped uniform a guard, in a synthetic corpus, and the split must move.
    const victim = base.rows.find((r) => !r.gateShaped).name;
    const perturbed = rankOffByDefault(names, LAB_SHADER_CORPUS + `\nif (${victim} > 0.0) { x(); }\n`);
    expect(perturbed.gateShaped).toBe(base.gateShaped + 1);
    expect(perturbed.neither).toBe(base.neither - 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 4. THE DIFF. Five buckets, and the partition is the reason to believe the three §12.4 names.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('diffMaterialUniforms', () => {
  const prev = {
    uLimbMix:    { value: 1.0 },                       // present, non-zero, gone after  → LOST
    uSleeping:   { value: 0.0 },                       // present at zero, gone after    → LOST_AT_ZERO
    uShared:     { value: 3.0 },                       // in both                        → CARRIED
    uVecGone:    { value: new THREE.Vector3(1, 0, 0) },// non-zero vector, gone after    → LOST
    uVecZeroGone:{ value: new THREE.Vector3(0, 0, 0) },// zero vector, gone after        → LOST_AT_ZERO
  };
  const next = {
    uShared:      { value: 9.0 },
    uBandStrength:{ value: 0.0 },                      // new at zero                    → OFF_BY_DEFAULT
    uNoiseScale:  { value: 4.0 },                      // new, non-zero                  → ADDED_NON_ZERO
  };
  const d = diffMaterialUniforms(prev, next);

  it('sorts each name into exactly the bucket its VALUE earns', () => {
    expect(d.lost.sort()).toEqual(['uLimbMix', 'uVecGone']);
    expect(d.lostAtZero.sort()).toEqual(['uSleeping', 'uVecZeroGone']);
    expect(d.carried).toEqual(['uShared']);
    expect(d.offByDefault).toEqual(['uBandStrength']);
    expect(d.addedNonZero).toEqual(['uNoiseScale']);
  });

  it('⛔ PARTITIONS the name union — no name in two buckets, no name in none', () => {
    // This is the clause §12.4's three-bucket wording cannot satisfy, and the reason two extra
    // buckets exist: a silent drop is the shape of every defect this instrument exists to catch.
    const all = [...d.lost, ...d.lostAtZero, ...d.carried, ...d.offByDefault, ...d.addedNonZero];
    const union = new Set([...Object.keys(prev), ...Object.keys(next)]);
    expect(all.length).toBe(union.size);
    expect(new Set(all).size).toBe(all.length);
    for (const n of union) expect(all).toContain(n);
  });

  it('⭐ CONTROL THAT MOVED — a membership-only diff over-reports LOST, this one does not', () => {
    // The mutant is the obvious first implementation: "in prev, not in next".
    const membershipOnly = Object.keys(prev).filter((n) => !(n in next));
    expect(membershipOnly.sort()).toEqual(['uLimbMix', 'uSleeping', 'uVecGone', 'uVecZeroGone']);
    expect(membershipOnly).toContain('uSleeping');   // ← the mutant calls a zero-valued drop a LOSS
    expect(d.lost).not.toContain('uSleeping');       // ← the shipped code does not
    expect(d.lost.length).toBe(2);
    expect(membershipOnly.length).toBe(4);
  });

  it('⭐ CONTROL THAT MOVED — `isOffValue` is not a truthiness check', () => {
    // The mutant a reader would reach for: `!value`. It agrees on the scalar and disagrees on both
    // vectors, in opposite directions — an all-zero Vector3 is truthy, a non-zero one likewise.
    expect(isOffValue(0)).toBe(true);
    expect(isOffValue(new THREE.Vector3(0, 0, 0))).toBe(true);
    expect(!new THREE.Vector3(0, 0, 0)).toBe(false);          // ← the mutant's answer, wrong
    expect(isOffValue(new THREE.Vector3(1, 0, 0))).toBe(false);
    expect(isOffValue([0, 0, 0])).toBe(true);
    expect(isOffValue(null)).toBe(true);
    expect(isOffValue(false)).toBe(true);
    expect(isOffValue({ isTexture: true })).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 5. THE LEDGER ITSELF — and the case §12.4 warns about hardest: an UNPAIRABLE swap.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('swapLedgerOf', () => {
  it('ranks the off-by-default bucket it produced, not some other list', () => {
    const led = swapLedgerOf({ prevUniforms: { uLimbMix: { value: 1 } }, nextUniforms: labUniforms() });
    expect(led.ok).toBe(true);
    expect(led.pairable).toBe(true);
    expect(led.buckets.lost).toContain('uLimbMix');
    expect(led.rank.total).toBe(led.buckets.offByDefault.length);
    // The lab material carries 364 names and the fake prev carries one, so nothing is CARRIED and
    // the off-by-default bucket is the wider `isOffValue` population, not the scalar-only 88.
    expect(led.counts.next).toBe(365);   // ⭐⭐ 356 -> 364 AT B4-2: uStarPos1, uStarPos2, uShadowMoonCount, uShadowMoonPos, uShadowMoonRadius, uShadowPlanetCount, uShadowPlanetPos, uShadowPlanetRadius — the caster set closing ledger P-03. MEASURED by importing makeUniforms in this session.   // ⭐ 351 -> 356 AT B4-1 — the star set. Same +5 as the makeUniforms pin above; this one reads it through swapLedgerOf instead of directly, which is why both exist.   // +1 2026-08-26: uCoarseCut, the tidal process term moved off the FREQUENCY and onto the AMPLITUDE (rockySurface pack; src/worldengine/base/macroWavelength.js coarseReliefCut). A DECLARED addition, not drift.
    expect(led.buckets.offByDefault.length).toBe(124);   // +1 2026-08-26: uCoarseCut, the tidal process term moved off the FREQUENCY and onto the AMPLITUDE (rockySurface pack; src/worldengine/base/macroWavelength.js coarseReliefCut). A DECLARED addition, not drift.
  });

  it('⛔ refuses to report an EMPTY loss set when the pre-swap material never existed', () => {
    // Step 6e's automatic path constructs no legacy material, so LOST is UNMEASURABLE. "Nothing was
    // lost" and "we cannot see what was lost" are opposite findings and must not share an output.
    const led = swapLedgerOf({ nextUniforms: labUniforms() });
    expect(led.ok).toBe(true);
    expect(led.pairable).toBe(false);
    expect(led.buckets.lost).toBeNull();          // ← NOT `[]`
    expect(led.reason).toMatch(/it is not empty/);
    // The rank still works, because it reads the lab material alone.
    expect(led.rank.total).toBe(91);   // +1 2026-08-26: uCoarseCut, the tidal process term moved off the FREQUENCY and onto the AMPLITUDE (rockySurface pack; src/worldengine/base/macroWavelength.js coarseReliefCut). A DECLARED addition, not drift.
    expect(led.rank.gateShaped).toBe(56);   // ⭐ +1 AT B4-1 (uStarBrightness2). The whole +1 is that ONE new uniform: of the five the star set adds, it is the only scalar-zero default, and the fragment spends it as a bare multiplicand (`uStarColor2 * diff2 * uStarBrightness2`). MEASURED this session.
  });

  it('⭐ CONTROL THAT MOVED — an empty-array unpairable ledger reads as a clean bill', () => {
    const honest = swapLedgerOf({ nextUniforms: labUniforms() });
    const paired = swapLedgerOf({ prevUniforms: {}, nextUniforms: labUniforms() });
    // The mutant is `buckets.lost = []` on the unpairable path. Under it these two are identical…
    expect(paired.buckets.lost).toEqual([]);
    expect(paired.pairable).toBe(true);
    // …and under the shipped code they are distinguishable, which is the whole assertion.
    expect(honest.buckets.lost).not.toEqual(paired.buckets.lost);
    expect(honest.pairable).not.toBe(paired.pairable);
  });

  it('refuses a missing post-swap map rather than diffing against nothing', () => {
    expect(swapLedgerOf({}).ok).toBe(false);
    expect(swapLedgerOf({ prevUniforms: {} }).ok).toBe(false);
  });
});
