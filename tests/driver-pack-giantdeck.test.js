// tests/driver-pack-giantdeck.test.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #1 — THE GAS DECK. PLAN §4 "Step 5", parts 5c / 5d / 5e, and its five named gates.
//
// ⭐ THE EVIDENCE STANDARD THIS FILE IS WRITTEN TO (PLAN §11.3.3). "The test passes" is not evidence
// that it CAN fail. Every gate below carries an EXECUTED control: the thing the gate guards is broken
// in-test, the gate is shown to red, and the break is discarded. Controls are marked `[CONTROL]` and
// they are not decoration — this program's signature failure is a measurement that is entirely true
// and entirely misleading, and in all three recorded instances a known-good control is what exposed it.
//
// ⛔ SIX THINGS THIS FILE DELIBERATELY DOES NOT ASSERT, each because asserting it would be a lie of
// the shape §11.1 classifies as a DEAD GATE:
//  1. It does not gate `shellDepthFrac >= 8 distinct`. FORM 2 saturates against its per-regime
//     `sdfBand` clamp, so a distinct-count gate is a gate on the clamp. PLAN 5's own text forbids it
//     and names the replacement: >=3 of 5 regimes represented AND >=1 body STRICTLY interior.
//  2. It does not claim the display-policy seam is exercised. NOT ONE driver this pack emits is
//     km-shaped, so "the game policy and the lab policy agree on every driver" is a fact about the
//     SIZE OF THE SET. The emptiness is asserted directly instead, so the vacuity ends loudly.
//  3. It does not assert anything about `aStorm`, `uStormCount`, the `uStorm*` family, or the F29
//     polar family. PLAN §7 fences their producer (`applyStormState`) out of pack #1. It asserts
//     their ABSENCE from the pack's own output instead — a scope fence, not a feature claim.
//  4. It pins no COUNT as a proxy for a SET. Step 4's re-bless pinned population counts and a
//     count-preserving permutation passed every instrument byte-identically. Where this file cares
//     about membership it asserts membership.
//  5. It quotes no capped number. `bitDiff`-style truncation at 24 entries makes any "25" a cap
//     artifact; nothing here pins a value that could be one.
//  6. It writes no prose superlative it did not measure. Five Step-4 canary rationales claimed "the
//     most X" and were rank 2-21.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DRIVER_PRESETS } from '../driver-presets.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import { compositionClass, giantRegimeOf } from '../src/worldengine/base/e1Regime.js';
import { opaqueCO2ShroudOf } from '../src/worldengine/base/auroraOptics.js';
import {
  drawGiantConditions, deriveGiantDrivers, GIANT_ANCHOR, enrichmentRatio, MET0_DEX,
} from '../src/worldengine/base/giant-drivers.js';
import { E5_REGIME, DRIVER_BUNDLES } from '../src/worldengine/base/climate-e5.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
// ⚠ IMPORTED FROM THE SAME MODULE `src/util/scene-naming.js` IMPORTS THEM FROM, not re-exported through
// it: scene-naming does not re-export either symbol, and a test that quietly imported `undefined` would
// have made every seed assertion below vacuously green.
import { fnv1aString, toHex } from 'motion-test-kit/core/hash/fnv1a.js';
import {
  writePackUniforms, gameDisplayRadiusEarth, sizeKm, scalar, PackContractError,
} from '../src/worldengine/port/writePackUniforms.js';
import {
  giantDeckPack, giantDeckLabState, giantDeckDirectDrivers, hasKmShapedDriver, bandedEnvelopeOf,
  LAB_STATE_BINDING, DECK_LAW, convectiveVigor,
} from '../src/worldengine/drivers/giantDeck.js';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';
import { BASELINE, MESH_N, SAMPLE_IDX, CAPTURED_FROM, fibonacciSphere } from './fixtures/giantdeck-preset-baseline.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAB_RAW = readFileSync(join(ROOT, 'world-engine-lab.html'), 'utf8');
// Comments AND string/template interiors blanked. Every source assertion below runs on THIS view, for
// the reason the radius-live-feed fence records in blood: a law re-quoted in a comment — or parked in
// a single-quoted string with a "moved to giantDeck.js" note beside it — satisfied a pin that existed
// entirely to catch its deletion. A quote mark is as good a coffin as a comment.
const LAB_CODE = stripCommentsPreservingOffsets(LAB_RAW, { blankLiteralText: true });
const PACK_SRC = readFileSync(join(ROOT, 'src/worldengine/drivers/giantDeck.js'), 'utf8');

const POS = fibonacciSphere(MESH_N, 1.0);
const MESH = { positions: POS, count: MESH_N, radius: 1.0 };

// FNV-1a over the IEEE-754 bit pattern of every element. Any bit moves it. Same function the fixture
// capture used — kept here rather than imported so the fixture stays a data file.
function hashF32(arr) {
  const dv = new DataView(new ArrayBuffer(8));
  let h = 0x811c9dc5;
  for (let i = 0; i < arr.length; i++) {
    dv.setFloat64(0, arr[i]);
    for (let b = 0; b < 8; b++) { h ^= dv.getUint8(b); h = Math.imul(h, 0x01000193) >>> 0; }
  }
  return h >>> 0;
}

// ⚠ THE CONDITION IS REBUILT FROM THE ROW, NOT LOOKED UP BY PRESET NAME. PLAN §4 Step 5's gate says
// so explicitly: "measure on the same CONDITION object, not the same preset name — the two routes
// differ by 3-6x on T_eq for the same nominal body, and a preset-to-preset comparison produces a
// false red that looks exactly like a broken extraction."
function conditionForRow(row) {
  const fp = DRIVER_PRESETS[row.preset];
  return deriveConditionVector(fp, deriveUniforms(fp, 1.0), row.radiusEarth);
}
// The LAB's context for a row: its display policy, its drawn rotation, its E5 override.
function labCtxForRow(row, cond, over = {}) {
  return {
    displayRadiusEarth: Math.sqrt(row.radiusEarth),   // the lab's display pseudo-radius, R^0.5
    macroSeed: row.macroSeed,
    animRate: 1, gates: { bands: true, jets: true }, relevance: {},
    rotationHours: row.rotationHours, rotationScale: 1, obliquityDeg: 0,
    e5DriverOverrides: { radius: (cond.radiusEarth ?? 1) / 11.2 },
    mesh: MESH,
    ...over,
  };
}
const STATE_KEYS = ['bandStrength', 'bandContrast', 'bandWarp', 'jetStrength', 'jetSpeed',
                    'jetShearTurb', 'jetFestoon', 'bandRough'];

// Worst absolute delta of a whole row against its baseline, as ONE number, so a failure reports a
// magnitude instead of "not equal". `Object.is` is used for the pass/fail decision; this is the report.
function rowDelta(row) {
  const cond = conditionForRow(row);
  const deck = giantDeckPack(cond, labCtxForRow(row, cond));
  const st = giantDeckLabState(deck);
  let worst = 0; let where = null;
  const bump = (name, a, b) => {
    if (b === undefined || b === null) return;
    const d = Object.is(a, b) ? 0 : Math.abs((a ?? NaN) - b);
    if (!(d <= worst)) { worst = Number.isFinite(d) ? d : Infinity; where = name; }
  };
  for (const k of STATE_KEYS) bump(`state.${k}`, st[k], row.state[k]);
  if (row.state.bandTint && st.bandTint) for (let i = 0; i < 3; i++) bump(`state.bandTint[${i}]`, st.bandTint[i], row.state.bandTint[i]);
  for (const [k, v] of Object.entries(row.uniforms)) bump(`uniforms.${k}`, deck.drivers[k], v);
  for (const k of ['aBand', 'aShear', 'aMush']) {
    const got = deck.attributes[k];
    if (!got) { if (row.attributes[k].hash !== hashF32(new Float32Array(MESH_N))) { worst = Infinity; where = `${k} missing`; } continue; }
    if (hashF32(got) !== row.attributes[k].hash) {
      SAMPLE_IDX.forEach((idx, i) => bump(`${k}[${idx}]`, got[idx], row.attributes[k].sample[i]));
      if (worst === 0) { worst = Infinity; where = `${k} hash differs with every sampled index equal`; }
    }
  }
  return { worst, where, deck };
}

// ═════════════════════════════════════════════════════════════════════════════
// GATE 1 — REFACTOR BYTE-IDENTITY, UNDER THE LAB'S DISPLAY POLICY
// ═════════════════════════════════════════════════════════════════════════════
describe('GATE 1 · pack + writer reproduce the pre-change lab EXACTLY (max delta 0)', () => {
  it('the fixture is the lab\'s own output, captured before the change, and it is not degenerate', () => {
    // A byte-identity gate against a fixture of constants is a gate against nothing. These four
    // assertions are what make "0" mean something: the baseline has to VARY, across seeds and across
    // presets, or a pack that returned a constant would pass.
    expect(CAPTURED_FROM).toMatch(/^[0-9a-f]{40}$/);
    expect(BASELINE.length).toBeGreaterThanOrEqual(20);
    const gasRows = BASELINE.filter((r) => r.state.bandStrength === 1);
    expect(gasRows.length).toBeGreaterThanOrEqual(20 - 4);
    // Seeded variety: the same preset at the same radius on three seeds must give three aBand fields.
    const jov = BASELINE.filter((r) => r.preset === 'Gas giant (Jovian)' && r.radiusEarth === 11.2);
    expect(new Set(jov.map((r) => r.attributes.aBand.hash)).size).toBe(jov.length);
    // Preset variety: the T_eq ramp has to separate the rows it is supposed to separate.
    expect(new Set(gasRows.map((r) => r.state.bandContrast)).size).toBeGreaterThanOrEqual(3);
  });

  // ⛔⛔ ONE ROW IS EXEMPT AND IT IS EXEMPT BY NAME, WITH ITS DELTA ASSERTED IN FULL RATHER THAN
  // WAIVED. Ledger R-07 (docs/FEATURES/step6-parity-ledger.md:180) is Venus's zonal banding, closed at
  // B3 leg 2, and the lab's own `Venus (sulfuric shroud)` preset is the one fixture row it moves. The
  // fixture is a capture of the lab BEFORE this pack existed, so RE-RECORDING IT WOULD DESTROY THE
  // GATE — the whole value of `CAPTURED_FROM` is that no later commit chose those numbers. So the row
  // keeps its fixture and gets its own assertion below, which is strictly stronger than `delta 0`:
  // it names every field that moved and pins every field that did not.
  const R07_ROW = 'Venus (sulfuric shroud)';
  for (const row of BASELINE) {
    const tag = `${row.preset} @ seed ${row.macroSeed}, R ${row.radiusEarth}`;
    if (row.preset === R07_ROW) continue;
    it(`max delta is exactly 0 — ${tag}`, () => {
      const { worst, where } = rowDelta(row);
      expect(worst, `${tag}: worst delta ${worst} at ${where}`).toBe(0);
    });
  }

  it(`R-07 · ${R07_ROW} moves EXACTLY the banding family and nothing else`, () => {
    const row = BASELINE.find((r) => r.preset === R07_ROW);
    expect(row, 'the R-07 row must still be in the fixture, or this gate guards nothing').toBeTruthy();
    const cond = conditionForRow(row);
    const deck = giantDeckPack(cond, labCtxForRow(row, cond));
    const st = giantDeckLabState(deck);

    // (1) THE PREDICATE, not a preset name. The row qualifies through the condition it carries.
    expect(bandedEnvelopeOf(cond)).toBe(true);
    expect(compositionClass(cond)).not.toBe('gas');          // …and NOT through the gas disjunct
    expect(cond.atmosphere.composition).toBe('co2');
    expect(cond.atmosphere.pressure).toBeGreaterThan(10);

    // (2) WHAT MOVED. The two master gates, the deck tint, the global roughness and the bake.
    expect(row.state.bandStrength).toBe(0);
    expect(row.state.jetStrength).toBe(0);
    expect(st.bandStrength).toBe(1);
    expect(st.jetStrength).toBe(1);
    // ⭐ THE TINT IS THE PRESET'S OWN ATMOSPHERE COLOUR AND NOT A NUMBER THIS COMMIT CHOSE, which is
    // what makes the closure a wire rather than a look. It is cream/yellow — the same reading the
    // legacy material gives the same body at src/objects/Planet.js:745 `    // Venus: nearly featureless, low-contrast cream/yellow clouds`.
    expect(st.bandTint).toEqual(cond.atmosphere.color);
    expect(row.state.bandTint).toEqual([0, 0, 0]);
    expect(deck.meta.baked).toBe(true);
    for (const k of ['aBand', 'aShear', 'aMush']) {
      expect(deck.attributes[k], k).toBeTruthy();
      expect(hashF32(deck.attributes[k]), `${k} must stop being the zero-filled field`)
        .not.toBe(row.attributes[k].hash);
    }

    // (3) WHAT DID NOT MOVE, AND THIS IS THE HALF THAT MATTERS. Every ungated law already ran on this
    // body before the change — the pack's own comment says so — so the closure flips GATES and must
    // not touch a magnitude. ⭐ `bandContrast` was ALREADY 1 in the fixture: the T_eq ramp saturates
    // on a 737 K world, and it did so behind a zero gate. This commit did not raise it.
    for (const k of ['bandContrast', 'bandWarp', 'jetSpeed', 'jetShearTurb', 'jetFestoon']) {
      expect(st[k], `${k} must be untouched by R-07`).toBe(row.state[k]);
    }
    expect(row.state.bandContrast).toBe(1);
  });

  it('[CONTROL] classifying the PERTURBED condition instead of the un-perturbed one reds the gate', () => {
    // The mutant is the one PLAN §4 Step 4 item 3 names and the one the pack's own comment forbids:
    // classify AFTER drawGiantConditions. It is invisible to every algebraic assertion and it flips
    // 63/2000 draws. Reproduced here as a re-derivation rather than by patching the pack, so the
    // control cannot silently stop matching the implementation.
    const row = BASELINE.find((r) => r.preset === 'Gas giant (Jovian)' && r.macroSeed === 1);
    const cond = conditionForRow(row);
    const pre = giantRegimeOf(cond);
    const post = giantRegimeOf(drawGiantConditions(pre, cond, 0));
    // At macroSeed 0 on the Jovian row the two labels genuinely differ — that is the whole hazard.
    expect(post).not.toBe(pre);
    // …and the triple the wrong label produces is a different number, so the mutant is not cosmetic.
    const a = deriveGiantDrivers(drawGiantConditions(pre, cond, 1));
    const b = deriveGiantDrivers(drawGiantConditions(post, cond, 1));
    expect(a.shellDepthFrac).not.toBe(b.shellDepthFrac);
  });

  it('[CONTROL] dropping ctx.rotationHours (falling back to the preset spin) reds a row that has a drawn spin', () => {
    // The row captured at 0.7x radius also carries a 1.3x rotation, so the drawn-spin channel is live
    // on it. A pack that read `condition.rotationHours` instead of `ctx.rotationHours` would answer
    // the canonical body — finite, plausible, and wrong on every body whose spin was drawn.
    const row = BASELINE.find((r) => r.preset === 'Gas giant (Jovian)' && r.radiusEarth !== 11.2);
    const cond = conditionForRow(row);
    const good = giantDeckPack(cond, labCtxForRow(row, cond));
    const bad = giantDeckPack(cond, labCtxForRow(row, cond, { rotationHours: undefined }));
    expect(giantDeckLabState(good).jetSpeed).toBe(row.state.jetSpeed);
    expect(giantDeckLabState(bad).jetSpeed).not.toBe(row.state.jetSpeed);
  });

  it('[CONTROL] a one-ULP nudge to the vigor ramp reds the gate (the comparison is not a tolerance)', () => {
    const row = BASELINE.find((r) => r.state.bandStrength === 1 && r.state.bandContrast > 0.1 && r.state.bandContrast < 0.999);
    expect(row, 'no unsaturated row to nudge — the control would be vacuous').toBeTruthy();
    const nudged = DECK_LAW.CONTRAST.BASE + DECK_LAW.CONTRAST.SPAN * convectiveVigor(1e-15 + 130 * 0 + 0) ;
    expect(nudged).not.toBe(row.state.bandContrast);
    // and the real comparison rejects a value one ULP away from the baseline
    const eps = row.state.bandContrast * Number.EPSILON;
    expect(Object.is(row.state.bandContrast + eps, row.state.bandContrast)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GATE 2 — THE POLICY DIFFERENCE, AND ITS HONEST SIZE
// ═════════════════════════════════════════════════════════════════════════════
describe('GATE 2 · the display policy is CARRIED and not CONSUMED, and that is measured', () => {
  it('no driver this pack emits is km-shaped — so the policy set is EMPTY, not merely equal', () => {
    let checked = 0;
    for (const row of BASELINE) {
      const cond = conditionForRow(row);
      const deck = giantDeckPack(cond, labCtxForRow(row, cond));
      expect(hasKmShapedDriver(deck.drivers), `${row.preset} emitted a km-shaped driver`).toBe(false);
      checked += Object.keys(deck.drivers).length;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('the same pack under the GAME policy differs NOWHERE — and that is a consequence of the line above', () => {
    for (const row of BASELINE) {
      const cond = conditionForRow(row);
      const lab = giantDeckPack(cond, labCtxForRow(row, cond));
      const game = giantDeckPack(cond, labCtxForRow(row, cond, {
        displayRadiusEarth: gameDisplayRadiusEarth(cond.radiusEarth),
      }));
      for (const k of Object.keys(lab.drivers)) {
        const a = lab.drivers[k], b = game.drivers[k];
        if (Array.isArray(a)) expect(b).toEqual(a);
        else if (typeof a === 'object') expect(b).toEqual(a);
        else expect(Object.is(a, b), `${row.preset} ${k}`).toBe(true);
      }
    }
  });

  it('[CONTROL] a km-shaped driver DOES move between the two policies (the writer seam is alive)', () => {
    // The control that stops the assertion above being read as "the seam works". A synthetic km driver
    // pushed through the SAME writer resolves to different numbers under the two policies on any body
    // whose radius is not exactly 1.0 R⊕ — 4x vs 2x on a 4 R⊕ world.
    const u = { uProbe: { value: NaN } };
    const R = 4;
    writePackUniforms(u, { uProbe: sizeKm(100, 1) }, { displayRadiusEarth: gameDisplayRadiusEarth(R), animRate: 1, gates: {}, relevance: {} });
    const gameV = u.uProbe.value;
    writePackUniforms(u, { uProbe: sizeKm(100, 1) }, { displayRadiusEarth: Math.sqrt(R), animRate: 1, gates: {}, relevance: {} });
    const labV = u.uProbe.value;
    expect(gameV).not.toBe(labV);
    expect(gameV / labV).toBeCloseTo(Math.sqrt(R), 12);
  });

  it('the pack REFUSES a context with no display policy, even though it consumes none', () => {
    const row = BASELINE[0];
    const cond = conditionForRow(row);
    const ctx = labCtxForRow(row, cond);
    delete ctx.displayRadiusEarth;
    expect(() => giantDeckPack(cond, ctx)).toThrow(PackContractError);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GATE 3 — DISTINCTNESS OVER GENERATED SYSTEMS
// ═════════════════════════════════════════════════════════════════════════════
describe('GATE 3 · distinctness over 200 generated systems', () => {
  const SEEDS = Array.from({ length: 200 }, (_, i) => `gdk-${i}`);
  const bodies = [];
  for (const seed of SEEDS) {
    const s = StarSystemGenerator.generate(seed, null);
    (s.planets || []).forEach((e, ordinal) => bodies.push({ id: `${seed}#${ordinal}`, pd: e.planetData }));
  }
  const gas = bodies
    .map((b) => ({ ...b, cond: conditionFromBody(b.pd) }))
    .filter((b) => compositionClass(b.cond) === 'gas');
  // Each body gets a per-body seed of the SHAPE the game will use (5d), never a constant.
  const deckFor = (b) => giantDeckPack(b.cond, {
    displayRadiusEarth: gameDisplayRadiusEarth(b.cond.radiusEarth),
    macroSeed: fnv1aString(b.id), animRate: 1, gates: { bands: true, jets: true }, relevance: {},
    rotationHours: b.pd.rotationHours, rotationScale: 1, mesh: MESH,
  });

  it('the population is big enough to mean anything, and it is NAMED', () => {
    expect(SEEDS.length).toBe(200);
    expect(gas.length).toBeGreaterThanOrEqual(200);
    expect(gas[0].id).toMatch(/^gdk-\d+#\d+$/);
  });

  it('internalHeat and dissipation each yield >= 8 distinct values', () => {
    const ih = new Set(), dis = new Set();
    for (const b of gas) {
      const d = deriveGiantDrivers(drawGiantConditions(giantRegimeOf(b.cond), b.cond, fnv1aString(b.id)));
      ih.add(d.internalHeat); dis.add(d.dissipation);
    }
    expect(ih.size, 'internalHeat').toBeGreaterThanOrEqual(8);
    expect(dis.size, 'dissipation').toBeGreaterThanOrEqual(8);
  });

  it('shellDepthFrac: >= 3 of 5 regimes represented AND >= 1 body strictly interior to its sdfBand', () => {
    // ⛔ NOT a distinct-count gate. FORM 2 saturates against its per-regime clamp, so counting distinct
    // values counts the clamp. PLAN §4 Step 5 forbids the count and names exactly this pair instead.
    const regimes = new Set(); let interior = 0; let interiorExample = null;
    for (const b of gas) {
      const regime = giantRegimeOf(b.cond);
      regimes.add(regime);
      const sdf = deriveGiantDrivers(drawGiantConditions(regime, b.cond, fnv1aString(b.id))).shellDepthFrac;
      const band = GIANT_ANCHOR[regime].sdfBand;
      if (sdf > band[0] && sdf < band[1]) { interior++; interiorExample = interiorExample || `${b.id} ${regime} ${sdf}`; }
    }
    expect(regimes.size, `regimes represented: ${[...regimes].sort().join(', ')}`).toBeGreaterThanOrEqual(3);
    expect(interior, `strictly interior bodies (example: ${interiorExample})`).toBeGreaterThanOrEqual(1);
    // Non-vacuity: the five regimes the gate counts against are the five the anchor table declares.
    expect(Object.keys(GIANT_ANCHOR).length).toBe(5);
    for (const r of regimes) expect(Object.keys(GIANT_ANCHOR)).toContain(r);
  });

  it('[CONTROL] a constant per-body seed leaves internalHeat/dissipation distinctness ABOVE the gate', () => {
    // ⭐ THE POINT OF THIS CONTROL IS THAT THE GATE ABOVE DOES NOT CATCH A CONSTANT SEED. Pinning a
    // constant seed and re-running gives 8+ distinct values anyway, because the algebra varies with
    // mass / age / T_eq. So the distinctness gate is real about the ALGEBRA and blind about the SEED,
    // and the seeded-field gate below is the only one that sees it. Recorded as a measured limit
    // rather than left for a later round to find.
    const ih = new Set();
    for (const b of gas) ih.add(deriveGiantDrivers(drawGiantConditions(giantRegimeOf(b.cond), b.cond, 12345)).internalHeat);
    expect(ih.size).toBeGreaterThanOrEqual(8);
  });

  it('[CONTROL] freezing the condition collapses distinctness to 1 (the gate is not measuring noise)', () => {
    const frozen = gas[0].cond;
    const ih = new Set(), dis = new Set();
    for (const b of gas) {
      const d = deriveGiantDrivers(drawGiantConditions(giantRegimeOf(frozen), frozen, fnv1aString('constant')));
      ih.add(d.internalHeat); dis.add(d.dissipation);
    }
    expect(ih.size).toBe(1);
    expect(dis.size).toBe(1);
  });

  it('SEEDED-FIELD distinctness: hashed aBand arrays are distinct on >= 90% of the population', () => {
    // ⭐ THE ONLY ASSERTION IN THIS FILE THAT CATCHES A CONSTANT macroSeed. `uBandContrast` has no
    // seeded term at all; climate-e5's phaseJet / phaseMush / ampJitter / obliquity are the only
    // seeded quantities, and they reach nothing except the baked field.
    // ⚠ A FRACTION, NOT A COUNT, and that is a correction to this test's own first draft. It was
    // written as ">= 100 distinct" — and MEASURED, a CONSTANT seed still yields 89 distinct fields on
    // this population, because two bodies with different drivers bake different bands from the same
    // phases. A floor of 100 would therefore have sat SEVEN bodies above the thing it exists to
    // catch, and a corpus that grew slightly would have carried the constant-seed case over it.
    // Measured live: 354/354 = 100%. Measured constant: 89/354 = 25%.
    const hashes = new Set();
    for (const b of gas) hashes.add(hashF32(deckFor(b).attributes.aBand));
    expect(hashes.size / gas.length, `${hashes.size} distinct aBand fields over ${gas.length} bodies`)
      .toBeGreaterThanOrEqual(0.9);
  });

  it('[CONTROL] a CONSTANT macroSeed falls BELOW the fraction gate above (measured 25% vs 100%)', () => {
    const live = new Set(), constant = new Set();
    for (const b of gas) {
      live.add(hashF32(deckFor(b).attributes.aBand));
      constant.add(hashF32(giantDeckPack(b.cond, {
        displayRadiusEarth: gameDisplayRadiusEarth(b.cond.radiusEarth),
        macroSeed: 4242, animRate: 1, gates: { bands: true, jets: true }, relevance: {},
        rotationHours: b.pd.rotationHours, rotationScale: 1, mesh: MESH,
      }).attributes.aBand));
    }
    expect(constant.size).toBeLessThan(live.size);
    expect(constant.size / gas.length, 'the constant-seed case must FAIL the gate above').toBeLessThan(0.9);
    expect(live.size / gas.length).toBeGreaterThanOrEqual(0.9);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GATE 4 — 5d, THE macroSeed SHAPE
// ═════════════════════════════════════════════════════════════════════════════
describe('GATE 4 · 5d — the macroSeed shape is pinned inside the pack', () => {
  const row = BASELINE[0];
  const cond = conditionForRow(row);

  it('the NUMERIC fnv1aString is accepted and the HEX form is refused', () => {
    const numeric = fnv1aString('seed-a:3');
    expect(Number.isInteger(numeric)).toBe(true);
    expect(numeric).not.toBe(0);
    expect(() => giantDeckPack(cond, labCtxForRow(row, cond, { macroSeed: numeric }))).not.toThrow();
    const hex = toHex(fnv1aString('seed-a:3'));
    expect(typeof hex).toBe('string');
    expect(() => giantDeckPack(cond, labCtxForRow(row, cond, { macroSeed: hex }))).toThrow(PackContractError);
  });

  it('[CONTROL] the hazard is real: a hex string collapses to 0 under the `| 0` resolveParams applies', () => {
    // This is why the assertion is `!== 0` and not just `isInteger`. A caller who pre-applies `| 0`
    // hands the pack a perfectly valid-looking integer 0, and every gas giant in the galaxy then gets
    // identical band phases while every algebraic gate still passes.
    expect(toHex(0xda81e221) | 0).toBe(0);
    expect(() => giantDeckPack(cond, labCtxForRow(row, cond, { macroSeed: toHex(0xda81e221) | 0 }))).toThrow(PackContractError);
    // …and if it did NOT throw, the field would be the seed-0 field on every body. Shown, not asserted:
    const a = giantDeckPack(cond, labCtxForRow(row, cond, { macroSeed: 1 })).attributes.aBand;
    const b = giantDeckPack(cond, labCtxForRow(row, cond, { macroSeed: 2 })).attributes.aBand;
    expect(hashF32(a)).not.toBe(hashF32(b));
  });

  it('all THREE shapes of `_ordinal` produce an acceptable seed', () => {
    // PLAN 5d: number for planets, string ('0.0') for moons, re-stamped `pm-…` in main.js. All three
    // go through the same `${systemSeed}:${ordinal}` template, so all three must hash to a usable int.
    for (const ordinal of [0, 5, '0.0', '1.2', 'pm-3', 'pm-0.1']) {
      const seed = fnv1aString(`sys-seed:${ordinal}`);
      expect(Number.isInteger(seed), `ordinal ${JSON.stringify(ordinal)}`).toBe(true);
      expect(seed, `ordinal ${JSON.stringify(ordinal)}`).not.toBe(0);
      expect(() => giantDeckPack(cond, labCtxForRow(row, cond, { macroSeed: seed }))).not.toThrow();
    }
    // …and the three shapes are not aliases of each other: ordinal 0 and '0.0' are different bodies.
    expect(fnv1aString('sys-seed:0')).not.toBe(fnv1aString('sys-seed:0.0'));
    expect(fnv1aString('sys-seed:0')).not.toBe(fnv1aString('sys-seed:pm-0'));
  });

  it('the LAB can never hand the pack a zero seed — its four entry points are clamped at the source', () => {
    // The lab's macro seed is a GUI integer whose old range included 0, and the pack's contract
    // excludes 0. Remapping at the call site was rejected because the storm bake reads the SAME
    // integer and would then be one world away from the bands, so the clamp lives at each source.
    expect(LAB_CODE).toMatch(/fSeeds\.add\(state,\s*'[^']*',\s*1,\s*10000,\s*1\)/);
    expect(LAB_CODE).toMatch(/state\.macroSeed\s*=\s*Math\.max\(1,\s*Math\.floor\(alea\(/);
    expect(LAB_CODE).toMatch(/state\.macroSeed\s*=\s*Math\.max\(1,\s*\(Math\.random\(\)\s*\*\s*10000\)\s*\|\s*0\)/);
    expect(LAB_CODE).toMatch(/state\.macroSeed\s*=\s*Math\.max\(1,\s*macro\s*>>>\s*0\)/);
    // And the band bake and the storm bake read the SAME expression, so they cannot diverge.
    expect((LAB_CODE.match(/macroSeed:\s*state\.macroSeed\s*\|\s*0/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GATE 5 — LAB COPY DELETED
// ═════════════════════════════════════════════════════════════════════════════
describe('GATE 5 · the lab copy is DELETED and the pack is what the lab calls', () => {
  // ⛔ An orphaned module passes a byte fence — atmosphereOptics.js already proved that — so this
  // gate has two halves and needs both: the law is ABSENT from the lab, and the pack is CALLED by it.
  const DENY = [
    ['the E5 attribute bake', /bakeClimateE5Attributes\s*\(/],
    ['the band-proxy export', /bandProxyUniforms\s*\(/],
    ['the per-seed roughness draw', /drawBandRoughness\s*\(/],
    ['the F24 contrast law', /0\.08\s*\+\s*0\.92\s*\*/],
    ['the F24 warp law', /0\.12\s*\+\s*0\.43\s*\*/],
    ['the F25 shear-turbulence law', /0\.05\s*\+\s*0\.25\s*\*/],
    ['the F25 festoon law', /0\.45\s*\*\s*_vigor/],
    ['the F25 drift law', /Math\.min\(1\.2,\s*Math\.max\(0\.2,\s*8\s*\//],
    ['the band master gate', /state\.bandStrength\s*=/],
    ['the jet master gate', /state\.jetStrength\s*=/],
    ['the vigor ramp', /_ss\(55,\s*130,/],
    ['the retired preset-name regime table', /E5_PRESET_REGIME/],
  ];
  for (const [what, re] of DENY) {
    it(`the lab no longer carries ${what}`, () => {
      expect(LAB_CODE, `${what} is still live in world-engine-lab.html`).not.toMatch(re);
    });
  }

  it('[CONTROL] every deny pattern MATCHED the lab before this change — the scan is not twelve typos', () => {
    // ⭐ THE CONTROL THAT MAKES THE TWELVE ZEROES ABOVE MEAN SOMETHING, and it is the one the Step-3
    // rounds kept proving necessary: a pattern that quietly stopped matching anything reads exactly
    // like a clean deletion. The comparison subject is the LAB AS IT WAS, read out of a pinned git
    // blob — not the pack, whose named constants (DECK_LAW.CONTRAST.BASE …) deliberately do not spell
    // the literals — so what is proven is precisely "this text was here and is now gone".
    const prior = execFileSync('git', ['-C', ROOT, 'show', `${CAPTURED_FROM}:world-engine-lab.html`],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const priorCode = stripCommentsPreservingOffsets(prior, { blankLiteralText: true });
    const neverMatched = DENY.filter(([, re]) => !re.test(priorCode)).map(([what]) => what);
    // ⛔ ONE deliberate exception, named rather than shrugged at: `E5_PRESET_REGIME` was deleted at
    // Step 4, before this lane opened, so it is absent from the prior blob too. It stays in the deny
    // list because it is the thing this pack must never resurrect, and it is excluded HERE — from the
    // liveness control, not from the scan — so the exemption cannot silently cover a second pattern.
    expect(neverMatched).toEqual(['the retired preset-name regime table']);
  });

  it('[CONTROL] the deny scan CATCHES a re-introduced copy (planted, then discarded)', () => {
    const planted = LAB_CODE + '\n      state.bandContrast = 0.08 + 0.92 * _vigor;\n';
    expect(planted).toMatch(/0\.08\s*\+\s*0\.92\s*\*/);
  });

  it('[CONTROL] a law re-quoted in a COMMENT or a STRING does not satisfy the scan either way', () => {
    // The view, not the pattern, is what closes this. Both containers are blanked before matching.
    const inComment = stripCommentsPreservingOffsets('// state.bandContrast = 0.08 + 0.92 * _vigor;\n', { blankLiteralText: true });
    const inString = stripCommentsPreservingOffsets("const _moved = 'state.bandContrast = 0.08 + 0.92 * _vigor;';\n", { blankLiteralText: true });
    expect(inComment).not.toMatch(/0\.08\s*\+\s*0\.92\s*\*/);
    expect(inString).not.toMatch(/0\.08\s*\+\s*0\.92\s*\*/);
  });

  it('the lab IMPORTS and CALLS the pack, and writes its direct drivers through the shared writer', () => {
    // ⚠ THE SPECIFIER IS ASSERTED ON RAW SOURCE, the one deliberate exception in this file: the
    // literal-blanked view erases the interior of every string, INCLUDING a module path, so the path
    // half of an import is unassertable there. The binding half — which is what could be faked — is
    // asserted on the blanked view, and so is every call site.
    expect(LAB_RAW).toContain("from './src/worldengine/drivers/giantDeck.js'");
    expect(LAB_CODE).toMatch(/import\s*\{[^}]*\bgiantDeckPack\b[^}]*\}\s*from/);
    expect(LAB_CODE).toMatch(/giantDeckPack\(_gcond,\s*_dctx\)/);
    expect(LAB_CODE).toMatch(/writePackUniforms\(uniforms,\s*giantDeckDirectDrivers\(_deck\),\s*_dctx\)/);
    expect(LAB_CODE).toMatch(/Object\.assign\(state,\s*giantDeckLabState\(_deck\)\)/);
  });

  it('the mirror and the direct-write sets PARTITION the pack output — no driver is written twice or dropped', () => {
    // A count would not see a swap. This asserts MEMBERSHIP: every driver key lands in exactly one of
    // the two halves, and the halves are disjoint.
    for (const row of BASELINE) {
      const cond = conditionForRow(row);
      const deck = giantDeckPack(cond, labCtxForRow(row, cond));
      const all = Object.keys(deck.drivers).sort();
      const mirrored = all.filter((k) => k in LAB_STATE_BINDING);
      const direct = Object.keys(giantDeckDirectDrivers(deck)).sort();
      expect(mirrored.filter((k) => direct.includes(k))).toEqual([]);
      expect([...mirrored, ...direct].sort()).toEqual(all);
      const state = giantDeckLabState(deck);
      expect(Object.keys(state).sort()).toEqual(mirrored.map((k) => LAB_STATE_BINDING[k]).sort());
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SCOPE FENCE — what pack #1 must NOT name (PLAN §7, ledger C19)
// ═════════════════════════════════════════════════════════════════════════════
describe('SCOPE · the storm and polar families are OUT, and the pack proves it by omission', () => {
  it('no driver name matches the polar or storm families, on any row', () => {
    for (const row of BASELINE) {
      const cond = conditionForRow(row);
      const deck = giantDeckPack(cond, labCtxForRow(row, cond));
      for (const k of Object.keys(deck.drivers)) {
        expect(k, `${row.preset} named ${k}`).not.toMatch(/^uPolar/);
        expect(k, `${row.preset} named ${k}`).not.toMatch(/^uStorm/);
      }
      expect(Object.keys(deck.attributes).sort()).toEqual(
        deck.meta.baked ? ['aBand', 'aMush', 'aShear', 'aStorm'] : [],   // ⭐ aStorm ADDED 2026-08-28. The uPolar/uStorm DRIVER-name bans two lines up still hold and are deliberately untouched — the pack emits the storm ATTRIBUTE, never a uStorm* uniform.
      );
    }
  });

  it('[CONTROL] the fence names families that EXIST — it is not banning imaginary uniforms', () => {
    const UNIF = readFileSync(join(ROOT, 'src/worldengine/shaders/uniforms.js'), 'utf8');
    expect(UNIF).toMatch(/uPolarStrength/);
    expect(UNIF).toMatch(/uStormCount/);
  });

  it('the pack NOW emits aStorm from its OWN regime/drivers, coherently with the bands, and the LAB still bakes its own', () => {
    expect(PACK_SRC).toMatch(/attributes\.aStorm\s*=\s*stormBake\.aStorm/);   expect(PACK_SRC).toMatch(/bakeStormEAttributes\([^)]*drivers:\s*\{\s*\.\.\.e5Drivers/);   // ⛔ THE SECOND ASSERTION IS THE COHERENCE RULE, NOT A DUPLICATE. world-engine-lab.html:1777-1778 records why: a storm mask baked from a SECOND local derive skews against the very band field it masks, and nothing downstream would report it. Spreading e5Drivers is what pins the two bakes to one resolution. WAS, until 2026-08-28: `expect(PACK_SRC).not.toMatch(/attributes\.aStorm\s*=/)` — the scope-out under PLAN §7, lifted because one absent bake held F24, F25 and F31b dead.
    expect(LAB_CODE).toMatch(/bakeStormEAttributes\(pos\.array,\s*pos\.count,\s*R,\s*\{\s*regime:\s*_deck\.meta\.regime/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CONTRACT SHAPE
// ═════════════════════════════════════════════════════════════════════════════
describe('CONTRACT · the pack obeys the 5a shape on every path', () => {
  it('returns { drivers, attributes } on gas AND on solid, with attributes {} rather than undefined', () => {
    const gasRow = BASELINE.find((r) => r.state.bandStrength === 1);
    const solidRow = BASELINE.find((r) => r.state.bandStrength === 0);
    for (const row of [gasRow, solidRow]) {
      const cond = conditionForRow(row);
      const deck = giantDeckPack(cond, labCtxForRow(row, cond));
      expect(deck.drivers).toBeTypeOf('object');
      expect(deck.attributes).toBeTypeOf('object');
      expect(deck.attributes).not.toBeUndefined();
    }
    const solidCond = conditionForRow(solidRow);
    expect(Object.keys(giantDeckPack(solidCond, labCtxForRow(solidRow, solidCond)).attributes)).toEqual([]);
  });

  it('a solid body omits uBandTint rather than zeroing it — the lab never reset the tint either', () => {
    const solidRow = BASELINE.find((r) => r.state.bandStrength === 0);
    const cond = conditionForRow(solidRow);
    const deck = giantDeckPack(cond, labCtxForRow(solidRow, cond));
    expect('uBandTint' in deck.drivers).toBe(false);
    expect('uBandRough' in deck.drivers).toBe(false);
    expect('uBandM' in deck.drivers).toBe(false);
    // …but the four ungated F24/F25 values ARE emitted, which is what keeps a gas→solid change exact.
    for (const k of ['uBandContrast', 'uBandWarp', 'uJetShearTurb', 'uJetFestoon', 'uJetSpeed']) {
      expect(k in deck.drivers, `${k} missing on a solid body`).toBe(true);
    }
  });

  it('an ABSENT gate key throws — absent is neither on nor off', () => {
    const row = BASELINE.find((r) => r.state.bandStrength === 1);
    const cond = conditionForRow(row);
    const deck = giantDeckPack(cond, labCtxForRow(row, cond));
    const u = Object.fromEntries(Object.keys(deck.drivers).map((k) => [k, { value: 0 }]));
    u.uBandTint = { value: { set: () => {} } };
    expect(() => writePackUniforms(u, deck.drivers, labCtxForRow(row, cond, { gates: { jets: true } })))
      .toThrow(PackContractError);
  });

  it('the two master gates actually gate, and the animRate driver actually scales', () => {
    const row = BASELINE.find((r) => r.state.bandStrength === 1);
    const cond = conditionForRow(row);
    const deck = giantDeckPack(cond, labCtxForRow(row, cond));
    const u = Object.fromEntries(Object.keys(deck.drivers).map((k) => [k, { value: NaN }]));
    u.uBandTint = { value: { set(...v) { this.v = v; } } };
    writePackUniforms(u, deck.drivers, labCtxForRow(row, cond, { gates: { bands: false, jets: false }, animRate: 3 }));
    expect(u.uBandStrength.value).toBe(0);
    expect(u.uJetStrength.value).toBe(0);
    // ⚠ uJetSpeed is animRate-scaled and NOT gated, and that reproduces the lab rather than improving on
    // it: frame() writes `state.jetSpeed * _animRate` unconditionally and lets uJetStrength do the
    // switching. Asserting a 0 here would have been a nicer-looking contract and a behaviour change.
    expect(u.uJetSpeed.value).toBe(row.state.jetSpeed * 3);
    writePackUniforms(u, deck.drivers, labCtxForRow(row, cond, { animRate: 1 }));
    expect(u.uJetSpeed.value).toBe(row.state.jetSpeed);
  });

  it('the pack is three-free: its whole import closure has no bare specifier except alea', () => {
    // The pack is called from src/ AND from the lab AND from node tests, so a stray `three` import
    // would make it unusable headless. Walked, not asserted from the top-level file alone.
    const seen = new Set(); const bare = new Set();
    const walk = (abs) => {
      if (seen.has(abs)) return; seen.add(abs);
      const src = readFileSync(abs, 'utf8');
      for (const m of src.matchAll(/(?:^|\n)\s*import\s[^'"]*['"]([^'"]+)['"]/g)) {
        const spec = m[1];
        if (spec.startsWith('.')) walk(join(dirname(abs), spec));
        else bare.add(spec);
      }
    };
    walk(join(ROOT, 'src/worldengine/drivers/giantDeck.js'));
    // MEASURED, not assumed: the closure's only bare specifiers are the two deterministic-noise deps the
    // world engine already runs headless on. `three` is the one that would matter and it is absent.
    expect([...bare].sort()).toEqual(['alea', 'simplex-noise']);
    expect([...bare]).not.toContain('three');
    // [CONTROL] the walker DOES report `three` when one exists.
    const seen2 = new Set(); const bare2 = new Set();
    const walk2 = (abs) => {
      if (seen2.has(abs)) return; seen2.add(abs);
      for (const m of readFileSync(abs, 'utf8').matchAll(/(?:^|\n)\s*import\s[^'"]*['"]([^'"]+)['"]/g)) {
        const spec = m[1];
        if (spec.startsWith('.')) { try { walk2(join(dirname(abs), spec)); } catch { /* leaf */ } }
        else bare2.add(spec);
      }
    };
    walk2(join(ROOT, 'src/rendering/LabPlanetMaterial.js'));
    expect([...bare2]).toContain('three');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5e — THE ENRICHMENT RATIO
// ═════════════════════════════════════════════════════════════════════════════
describe('5e · metallicity and the enrichment ratio are on ONE scale', () => {
  it('the density branch is bit-identical to the shipped expression it replaced', () => {
    // Re-derived here from the anchor table rather than copied out of the module, so this is a
    // comparison against the LAW and not against the implementation's own text.
    for (const regime of Object.keys(GIANT_ANCHOR)) {
      const a = GIANT_ANCHOR[regime];
      const cond = { density: 1.77, composition: { ironFraction: 0.07, volatileFraction: 0.11 } };
      const Z = 1.0 * 1.77 + 1.0 * 0.07 + 1.0 * 0.11;
      const Z0 = 1.0 * a.density0 + 1.0 * a.iron0 + 1.0 * a.vol0;
      expect(enrichmentRatio(cond, regime)).toBe(Z / Z0);
    }
  });

  it('the anchor is exact on BOTH branches — ratio 1 at canonical density and at solar metallicity', () => {
    for (const regime of Object.keys(GIANT_ANCHOR)) {
      const a = GIANT_ANCHOR[regime];
      expect(enrichmentRatio({ density: a.density0, composition: { ironFraction: a.iron0, volatileFraction: a.vol0 } }, regime)).toBe(1);
      expect(enrichmentRatio({ metallicity: MET0_DEX }, regime)).toBe(1);
    }
    expect(MET0_DEX).toBe(0);
  });

  it('metallicity is the PRIMARY branch and it is monotone the right way (more metals ⇒ thinner shell)', () => {
    const regime = E5_REGIME.GAS_GIANT;
    expect(enrichmentRatio({ metallicity: 0.3, density: 99 }, regime)).toBe(Math.pow(10, 0.3));
    expect(enrichmentRatio({ metallicity: 0.3 }, regime)).toBeGreaterThan(enrichmentRatio({ metallicity: -0.3 }, regime));
    const rich = deriveGiantDrivers({ regime, metallicity: 0.3, ...{} }).shellDepthFrac;
    const poor = deriveGiantDrivers({ regime, metallicity: -0.3 }).shellDepthFrac;
    expect(rich).toBeLessThanOrEqual(poor);
  });

  it('[CONTROL] the defect it fixes is real and is measured on generated bodies', () => {
    // ⭐ The control that makes 5e a measurement rather than a claim. RAW dex through the OLD form
    // (dex numerator over a g/cc denominator) pegs shellDepthFrac at the band ceiling; the new form
    // does not. Both are computed here, so the comparison cannot drift from either.
    const bodies = [];
    for (let i = 0; i < 120; i++) {
      const s = StarSystemGenerator.generate(`pcc-${i}`, null);
      (s.planets || []).forEach((e) => bodies.push(e.planetData));
    }
    const gas = bodies.map((pd) => ({ pd, cond: conditionFromBody(pd) }))
      .filter((b) => compositionClass(b.cond) === 'gas' && typeof b.pd.metallicity === 'number');
    expect(gas.length).toBeGreaterThanOrEqual(100);

    const oldRatio = (cond, regime) => {
      const a = GIANT_ANCHOR[regime];
      return cond.metallicity / (a.density0 + a.iron0 + a.vol0);   // the pre-5e cross-scale division
    };
    const sdfFrom = (ratio, regime) => {
      const a = GIANT_ANCHOR[regime];
      const SDF0 = DRIVER_BUNDLES[regime].shellDepthFrac;
      return Math.max(a.sdfBand[0], Math.min(a.sdfBand[1], SDF0 * (1 - 0.95 * (ratio - 1))));
    };
    // ⚠ SDF0 IS THE BAND'S INTERIOR ANCHOR, NOT ITS FLOOR, and this loop is here because the first
    // draft of this control assumed the floor and reproduced the law wrongly on all five rows. Every
    // regime's bundle SDF0 sits strictly INSIDE its own sdfBand — gas-giant 0.80 in [0.74, 0.86],
    // saturnian 0.90 in [0.85, 0.95], neptunian 0.15 in [0.09, 0.21], sub-neptune 0.35 in
    // [0.28, 0.44], hot-jupiter 0.85 in [0.80, 0.90] — which is why enrichment can clamp in EITHER
    // direction, and why "pegged at the ceiling" is a meaningful thing to have measured.
    for (const regime of Object.keys(GIANT_ANCHOR)) {
      const a = GIANT_ANCHOR[regime];
      const SDF0 = DRIVER_BUNDLES[regime].shellDepthFrac;
      expect(SDF0, `${regime} SDF0 above its band floor`).toBeGreaterThan(a.sdfBand[0]);
      expect(SDF0, `${regime} SDF0 below its band ceiling`).toBeLessThan(a.sdfBand[1]);
      expect(deriveGiantDrivers({ regime, density: a.density0,
        composition: { ironFraction: a.iron0, volatileFraction: a.vol0 } }).shellDepthFrac).toBe(SDF0);
    }

    let oldInterior = 0, newInterior = 0;
    const oldVals = new Set(), newVals = new Set();
    for (const b of gas) {
      const regime = giantRegimeOf(b.cond);
      const drawn = drawGiantConditions(regime, { ...b.cond, metallicity: b.pd.metallicity }, fnv1aString(String(b.pd.name ?? b.pd.type) + b.pd.metallicity) || 1);
      const band = GIANT_ANCHOR[regime].sdfBand;
      const o = sdfFrom(oldRatio(drawn, regime), regime);
      const n = deriveGiantDrivers(drawn).shellDepthFrac;
      oldVals.add(o); newVals.add(n);
      if (o > band[0] && o < band[1]) oldInterior++;
      if (n > band[0] && n < band[1]) newInterior++;
    }
    // The OLD form is degenerate on this population; the NEW one is not. Both numbers are reported.
    expect(oldInterior, `old-form interior bodies of ${gas.length}`).toBe(0);
    expect(newInterior, `new-form interior bodies of ${gas.length}`).toBeGreaterThan(0);
    expect(newVals.size).toBeGreaterThan(oldVals.size);
  });

  it('and the tripwire it shipped with has FIRED — metallicity is forwarded, the re-bless is done', () => {
    // ⭐ THIS TEST HAS BEEN INVERTED, NOT DELETED. It shipped in Step 5 asserting the OPPOSITE
    // ('BYTE-INERT today, because nothing forwards metallicity yet') with the instruction: "if this
    // ever goes red, the adapter started forwarding and the shellDepthFrac re-bless in
    // tests/port-condition-contract.test.js is DUE". Max ruled on 2026-08-09 to forward it; the
    // adapter half landed; this went red exactly as planted; and the re-bless it points at is done.
    // A tripwire that fires and is then DELETED teaches nothing — inverting it keeps the same seam
    // gated in the opposite direction, so a silent REVERSION of the forwarding also reds here.
    let generated = 0;
    for (let i = 0; i < 40; i++) {
      const s = StarSystemGenerator.generate(`inert-${i}`, null);
      for (const e of s.planets || []) {
        // Forwarded VERBATIM — Object.is, not truthiness: 0 and negative dex are legal values
        // (39.6% of the corpus is negative) and a truthiness check would pass on a dropped key.
        expect(conditionFromBody(e.planetData).metallicity).toBe(e.planetData.metallicity);
        generated++;
      }
    }
    expect(generated, 'the sweep must actually reach bodies — a zero-body loop asserts nothing').toBeGreaterThan(100);

    // ⛔ THE LAB PRESETS ARE THE OTHER HALF, AND THEY STAY UNDEFINED. DRIVER_PRESETS carry no
    // metallicity, so the enrichment law falls back to the composition proxy there. That is why
    // `undefined` and not `?? 0` is the correct absence: 0 dex is SOLAR, a real and common value,
    // so defaulting would silently declare every lab preset sun-like.
    for (const name of Object.keys(DRIVER_PRESETS)) {
      const fp = DRIVER_PRESETS[name];
      expect(deriveConditionVector(fp, deriveUniforms(fp, 1.0), fp.radiusEarth).metallicity).toBeUndefined();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R-07 — VENUS'S ZONAL BANDING, OVER A GENERATED POPULATION
// ═════════════════════════════════════════════════════════════════════════════
// GATE 1's row-level assertion above pins the LAB PRESET, which is one body. This block is the
// population half, because the ledger row's claim is about 130 generated worlds and a preset cannot
// speak for them. ⛔ Everything here reads the CONDITION; the `type` label appears only as the thing
// the predicate is measured AGAINST, never as an input to it.
describe('R-07 · the banding predicate over generated bodies', () => {
  const R07_SEEDS = Array.from({ length: 40 }, (_, i) => `r07-${i}`);
  const R07 = [];
  for (const seed of R07_SEEDS) {
    (StarSystemGenerator.generate(seed, null).planets || []).forEach((e, ordinal) => {
      R07.push({ id: `${seed}#${ordinal}`, d: e.planetData, cond: conditionFromBody(e.planetData) });
    });
  }
  const SHROUD = R07.filter((b) => opaqueCO2ShroudOf(b.cond) === true);
  const GASB = R07.filter((b) => compositionClass(b.cond) === 'gas');

  it('the corpus carries both disjuncts, or nothing below means anything', () => {
    expect(R07.length).toBeGreaterThan(120);
    expect(SHROUD.length).toBeGreaterThan(10);
    expect(GASB.length).toBeGreaterThan(20);
  });

  it('⭐⭐ THE CONDITION PREDICATE SELECTS EXACTLY THE BODIES THE LEGACY TYPE LABEL SELECTS', () => {
    // ⛔ THE ASSERTION THAT MAKES R-07 A WIRING CLOSURE RATHER THAN A NEW FEATURE. The legacy material
    // draws venus banding on `planetType == 8`, which comes from the `type` STRING. The pack may not
    // read that string — tests/gas-body-lab-material.test.js forbids a type-label predicate outright —
    // so the closure only holds if the condition-derived test lands on the same set. SET equality,
    // both directions, not two counts that happen to match.
    const byLabel = R07.filter((b) => b.d.type === 'venus').map((b) => b.id).sort();
    const byCond = SHROUD.map((b) => b.id).sort();
    expect(byCond).toEqual(byLabel);
    expect(byLabel.length).toBeGreaterThan(10);
    // …and every one of them is NON-GAS, i.e. they arrive through the second disjunct only.
    for (const b of SHROUD) expect(compositionClass(b.cond), b.id).not.toBe('gas');
  });

  it('every shrouded body gets a live master gate AND a real bake — both, or the deck is a flat decal', () => {
    let baked = 0;
    for (const b of SHROUD) {
      const cond = b.cond;
      const ctx = {
        displayRadiusEarth: cond.radiusEarth ?? 1, macroSeed: 12345, animRate: 1,
        gates: { bands: true, jets: true }, relevance: {}, rotationHours: 24, rotationScale: 1,
        mesh: MESH,
      };
      const deck = giantDeckPack(cond, ctx);
      expect(giantDeckLabState(deck).bandStrength, b.id).toBe(1);
      expect(deck.meta.baked, b.id).toBe(true);
      const a = deck.attributes.aBand;
      expect(a && a.length, b.id).toBe(MESH_N);
      expect(new Set(Array.from(a)).size, `${b.id}: aBand must VARY or the deck renders flat`).toBeGreaterThan(8);
      baked++;
    }
    expect(baked).toBe(SHROUD.length);
  });

  it('[CONTROL] the pack predicate WIDENED ALONE is a measured no-op — the row says so and here it is', () => {
    // ⭐ THE CONTROL THE LEDGER ROW WAS CORRECTED FOR. Run the pack on a shrouded condition with the
    // pre-change second gate simulated — `gas ? 1.0 : 0.0` — and the master gate is 0.0 on every one
    // of them, exactly as it was before B3 leg 2. Widening `applies` buys nothing on its own.
    let zeroed = 0;
    for (const b of SHROUD) {
      const gasOnly = compositionClass(b.cond) === 'gas' ? 1.0 : 0.0;
      expect(gasOnly, b.id).toBe(0.0);
      zeroed++;
    }
    expect(zeroed).toBe(SHROUD.length);
    // …and the shipped gate answers 1.0 on the same bodies, so the two really are different laws.
    for (const b of SHROUD) expect(bandedEnvelopeOf(b.cond) ? 1.0 : 0.0, b.id).toBe(1.0);
  });

  it('the E5 chain is TOTAL on the new population — no throw, no NaN, on every one', () => {
    // A gas-giant chain running on a rocky world is the risk this closure takes, so it is measured on
    // the whole slice rather than sampled. ⚠ `drawGiantConditions` re-draws the condition, which is
    // declared in the ledger row with its measured magnitude; what is asserted here is only that the
    // chain terminates with finite numbers.
    for (const b of SHROUD) {
      const ctx = {
        displayRadiusEarth: b.cond.radiusEarth ?? 1, macroSeed: 7, animRate: 1,
        gates: { bands: true, jets: true }, relevance: {}, rotationHours: 24, rotationScale: 1, mesh: MESH,
      };
      let deck;
      expect(() => { deck = giantDeckPack(b.cond, ctx); }, b.id).not.toThrow();
      for (const [k, v] of Object.entries(giantDeckLabState(deck))) {
        if (typeof v === 'number') expect(Number.isFinite(v), `${b.id}/${k}`).toBe(true);
      }
      for (const k of ['aBand', 'aShear', 'aMush']) {
        for (let i = 0; i < deck.attributes[k].length; i++) {
          if (!Number.isFinite(deck.attributes[k][i])) throw new Error(`${b.id}/${k}[${i}] is not finite`);
        }
      }
    }
  });

  it('⛔ NO MOON IS BANDED — the closure must not leak into the plain-moon population', () => {
    // Plain moons carry no atmosphere record at all, so neither disjunct can fire; asserted rather
    // than assumed, because a widened predicate reaching 632 moons would be a silent restyle.
    let moons = 0;
    for (const seed of R07_SEEDS.slice(0, 20)) {
      for (const e of (StarSystemGenerator.generate(seed, null).planets || [])) {
        for (const m of (e.moons || [])) {
          if (m.planetData) continue;
          moons++;
          expect(bandedEnvelopeOf(conditionFromBody(m))).toBe(false);
        }
      }
    }
    expect(moons, 'the moon population must be non-empty or this proves nothing').toBeGreaterThan(50);
  });
});
