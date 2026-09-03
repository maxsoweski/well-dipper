// tests/driver-pack-craterdeck.test.js — DRIVER PACK #6, the impact record's GAS half, and the
// shared driver block both halves now emit. Ledger row P-14's crater half.
//
// WHAT THIS FILE IS FOR, in the row's own terms. P-14 is "no pack writes the impact family on a
// gas-class body", so a swapped gas world took the lab material's factory schedule
// (`uCraterAmp` 0.9, `uCraterScale` 6.0, `uCraterComplexD` 0.6, `uEjectaAmp` 0.35) while the game's
// own material wrote whatever the shared producer answered. Nothing here is a law CHOICE: the fix is
// a second pack over the complement predicate emitting the SAME block. So every assertion is about
// the WIRE, plus one about the block being singular — because the obvious way to write this pack is
// ten fresh lines calling the same two producers, and that is the third-transcription failure B3
// leg 1 spent a commit deleting.
//
// ⛔ THE PROPERTY THIS PACK IS BUILT ON: its predicate is `rockySurface`'s EXACT COMPLEMENT, so every
// body in any corpus has exactly ONE writer of the ten names — never zero (which was P-14) and never
// two (which `applyDriverPacks` refuses at run time). §A and §F carry that from both sides.
//
// ⛔ EVERY CONTROL IN THIS FILE WAS PROVEN TO BITE by reverting the fix, running the SPECIFIC
// assertion and restoring. The list is in the stage report. Two dead controls shipped in this lane
// before hostile review caught them, so "the test passes" is not evidence on its own.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { buildLabPlanetMaterial } from '../src/rendering/LabPlanetMaterial.js';
import {
  resolveDriver, isPackDriver, PackContractError, gameDisplayRadiusEarth,
} from '../src/worldengine/port/writePackUniforms.js';
import { PACKS, gatesFor, selectPacks, applyDriverPacks } from '../src/worldengine/drivers/index.js';
import {
  rockySurfacePack, ROCKY_SURFACE_ENTRY, ROCKY_SURFACE_UNIFORMS,
} from '../src/worldengine/drivers/rockySurface.js';
import {
  craterDeckPack, craterDriverBlock, CRATER_DECK_ENTRY, CRATER_DECK_UNIFORMS,
  CRATER_GATE, EJECTA_GATE, C_CRATER,
} from '../src/worldengine/drivers/craterDeck.js';
import { craterUniformsFrom, CRATERS_OFF } from '../src/worldengine/port/craterUniforms.js';
import { craterRelevanceOf } from '../src/worldengine/base/bombardment.js';
import { labPackCtx } from '../src/objects/Planet.js';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
// COMMENTS AND STRING INTERIORS BLANKED — the house view. The module's header quotes shipped lines
// verbatim, so a raw scan would find a "law" that is only prose.
const PACK_CODE = stripCommentsPreservingOffsets(read('src/worldengine/drivers/craterDeck.js'), {
  blankLiteralText: true,
});
// ⚠ AND A SECOND VIEW WITH STRING INTERIORS INTACT. `blankLiteralText` blanks import specifiers and
// the `'gas'` inside the predicate — the two things §C most needs to read.
const PACK_CODE_STRINGS = stripCommentsPreservingOffsets(read('src/worldengine/drivers/craterDeck.js'));
const ROCKY_CODE = stripCommentsPreservingOffsets(read('src/worldengine/drivers/rockySurface.js'), {
  blankLiteralText: true,
});

// ── The corpus. Generated bodies, not presets: the row's populations are generated ones. ─────────
const SEEDS = Array.from({ length: 24 }, (_, i) => `cdk-${i}`);
const GENERATED = [];
for (const seed of SEEDS) {
  const sys = StarSystemGenerator.generate(seed, null);
  (sys.planets || []).forEach((e, ordinal) => {
    GENERATED.push({ id: `${seed}#${ordinal}`, d: e.planetData, cond: conditionFromBody(e.planetData) });
  });
}
const GAS = GENERATED.filter((b) => compositionClass(b.cond) === 'gas');
const SOLID = GENERATED.filter((b) => compositionClass(b.cond) !== 'gas');
const ctxFor = (b) => ({ ...labPackCtx(b.d, b.cond, undefined), gates: gatesFor(CRATER_DECK_ENTRY) });
const packFor = (b) => craterDeckPack(b.cond, ctxFor(b));
const valueOf = (b, name) => {
  const c = ctxFor(b);
  return resolveDriver(name, packFor(b).drivers[name], c);
};
// The GAME's legacy write, src/objects/Planet.js:1596 and :1688-1698 — the thing parity is against.
const gameCraters = (cond) => (craterRelevanceOf(cond) > 0 ? craterUniformsFrom(cond) : CRATERS_OFF);
const GAME_NAME = Object.freeze({
  uCraterDensity: 'density', uCraterComplexD: 'complexD', uCraterRelaxation: 'relaxation',
  uTerraceCount: 'terraceCount', uCraterScale: 'scale', uCraterAmp: 'amp',
  uEjectaStrength: 'ejectaStrength', uEjectaRampart: 'ejectaRampart',
  uEjectaAmp: 'ejectaAmp', uEjectaLump: 'ejectaLump',
});

describe('A — the predicate admits exactly the gas class, and it is rockySurface\'s complement', () => {
  it('the corpus is not degenerate — both halves are real populations', () => {
    expect(GENERATED.length).toBeGreaterThan(80);
    expect(GAS.length).toBeGreaterThan(20);
    expect(SOLID.length).toBeGreaterThan(20);
  });

  it('admits EXACTLY `compositionClass === gas` — membership, not a count', () => {
    // MEMBERSHIP, because Step 4 measured that a count-preserving permutation is byte-identical to
    // every instrument this program owns, so a length gate would pass a swap of one set for another.
    const mine = GENERATED.filter((b) => CRATER_DECK_ENTRY.applies(b.cond) === true).map((b) => b.id);
    const theirs = GAS.map((b) => b.id);
    expect(mine).toEqual(theirs);
  });

  it('⭐ IT IS THE EXACT COMPLEMENT OF rockySurface — every body has exactly ONE writer of the family', () => {
    // This is the whole of P-14's closure argument and it is checked over the population rather than
    // read off two `applies` lines. Never zero (which was the row) and never two (which the collision
    // throw refuses at run time).
    let claimedByOne = 0;
    for (const b of GENERATED) {
      const mine = CRATER_DECK_ENTRY.applies(b.cond) === true;
      const rocky = ROCKY_SURFACE_ENTRY.applies(b.cond) === true;
      expect(mine === rocky, `${b.id}: both or neither claims the impact family`).toBe(false);
      claimedByOne++;
    }
    expect(claimedByOne).toBe(GENERATED.length);
  });

  it('[CONTROL] the counterfactual `!== gas` predicate claims the WRONG half, and by how much', () => {
    // The natural typo — copying rockySurface's predicate verbatim into this entry — is not a near
    // miss: it claims every solid body, collides with rockySurface on all of them, and leaves the gas
    // half exactly as unwritten as P-14 found it.
    const wrong = GENERATED.filter((b) => compositionClass(b.cond) !== 'gas').map((b) => b.id);
    const mine = GENERATED.filter((b) => CRATER_DECK_ENTRY.applies(b.cond) === true).map((b) => b.id);
    expect(wrong.filter((id) => mine.includes(id))).toEqual([]);
    expect(wrong.length).toBe(SOLID.length);
  });

  it('it returns the BOOLEAN, because both admission sites compare with === true', () => {
    for (const b of [GAS[0], SOLID[0]]) {
      expect(typeof CRATER_DECK_ENTRY.applies(b.cond)).toBe('boolean');
    }
  });
});

describe('B — the declared gate names are the ones the drivers key on', () => {
  it('the entry declares exactly the two names, and they are the shared constants', () => {
    expect(CRATER_DECK_ENTRY.gates).toEqual([CRATER_GATE, EJECTA_GATE]);
    expect(CRATER_GATE).toBe('craters');
    expect(EJECTA_GATE).toBe('ejecta');
    expect(gatesFor(CRATER_DECK_ENTRY)).toEqual({ craters: true, ejecta: true });
    // ⭐ AND rockySurface DECLARES THE IDENTICAL PAIR, from the identical constants — the two entries
    // cannot disagree about a gate name because there is one spelling of each in `src/`.
    expect(ROCKY_SURFACE_ENTRY.gates).toEqual(CRATER_DECK_ENTRY.gates);
  });

  it('ONLY the two master gates carry a gate, and the other eight are ungated', () => {
    // Reproduces the lab exactly rather than simplifying it: the GLSL keys the whole crater pass on
    // the density and the whole apron on the strength, so one zero deletes each pass byte-identically.
    const d = packFor(GAS[0]).drivers;
    expect(isPackDriver(d.uCraterDensity)).toBe(true);
    expect(d.uCraterDensity.gate).toBe(CRATER_GATE);
    expect(isPackDriver(d.uEjectaStrength)).toBe(true);
    expect(d.uEjectaStrength.gate).toBe(EJECTA_GATE);
    for (const n of ['uCraterAmp', 'uCraterComplexD', 'uCraterRelaxation', 'uTerraceCount',
                     'uEjectaRampart', 'uEjectaAmp', 'uEjectaLump']) {
      const v = d[n];
      expect(isPackDriver(v) && v.gate !== undefined, `${n} must be ungated`).toBe(false);
    }
  });

  it('an ABSENT gate key THROWS — it is not silently "off"', () => {
    const b = GAS[0];
    const ctx = { ...labPackCtx(b.d, b.cond, undefined), gates: { ejecta: true } };
    expect(() => resolveDriver('uCraterDensity', craterDeckPack(b.cond, ctx).drivers.uCraterDensity, ctx))
      .toThrow();
  });

  it('a gate at false zeroes its master and leaves the morphology terms alone', () => {
    const b = GAS.find((x) => packFor(x).meta.cratersFired) || GAS[0];
    const ctx = { ...labPackCtx(b.d, b.cond, undefined), gates: { craters: false, ejecta: false } };
    const d = craterDeckPack(b.cond, ctx).drivers;
    expect(resolveDriver('uCraterDensity', d.uCraterDensity, ctx)).toBe(0);
    expect(resolveDriver('uEjectaStrength', d.uEjectaStrength, ctx)).toBe(0);
    // …and the morphology is untouched, which is the STATE difference the pack header names.
    expect(resolveDriver('uTerraceCount', d.uTerraceCount, ctx)).toBe(CRATERS_OFF.terraceCount);
  });
});

describe('C — every driver is a forward of the shared producer, and the block is SINGULAR', () => {
  it('⭐⭐ THE TWO PACKS EMIT THE IDENTICAL MAP FOR THE SAME CONDITION — one block, not two copies', () => {
    // ⛔ THE ASSERTION THIS FILE EXISTS FOR. `rockySurfacePack` refuses gas by predicate but not by
    // code, so it can be CALLED on a gas condition — which is what makes this comparison possible and
    // what makes "one expression" a measurement instead of an import-graph reading.
    let compared = 0;
    for (const b of GAS.slice(0, 12)) {
      const ctx = { ...labPackCtx(b.d, b.cond, undefined), gates: { craters: true, ejecta: true } };
      const mine = craterDeckPack(b.cond, ctx).drivers;
      const theirs = rockySurfacePack(b.cond, ctx).drivers;
      for (const n of CRATER_DECK_UNIFORMS) {
        expect(resolveDriver(n, mine[n], ctx), `${b.id}/${n}`)
          .toBe(resolveDriver(n, theirs[n], ctx));
        compared++;
      }
    }
    expect(compared).toBe(12 * CRATER_DECK_UNIFORMS.length);
  });

  it('⭐ AND THE SINGULARITY IS PINNED IN SOURCE, because a copy would pass the test above on day one', () => {
    // Two identical copies agree until one is edited. So the structural claim gets a structural pin:
    // the producers are called in the shared block and NOWHERE ELSE under drivers/.
    expect(PACK_CODE).toContain('const rel = craterRelevanceOf(condition);');
    expect(PACK_CODE).toContain('const cu = craterUniformsFrom(condition);');
    expect(ROCKY_CODE).toContain('craterDriverBlock(condition)');
    expect(ROCKY_CODE).not.toContain('craterUniformsFrom(');
    expect(ROCKY_CODE).not.toContain('craterRelevanceOf(');
    // …and this file imports the producers rather than re-deriving them.
    expect(PACK_CODE_STRINGS).toContain("from '../port/craterUniforms.js'");
    expect(PACK_CODE_STRINGS).toContain("from '../base/bombardment.js'");
  });

  it('every emitted value equals the shared producer, name by name, on the whole gas half', () => {
    let checked = 0;
    for (const b of GAS) {
      const cu = craterUniformsFrom(b.cond);
      const rel = craterRelevanceOf(b.cond);
      expect(valueOf(b, 'uCraterAmp'), b.id).toBe(cu.amp);
      expect(valueOf(b, 'uCraterComplexD'), b.id).toBe(cu.complexD);
      expect(valueOf(b, 'uEjectaAmp'), b.id).toBe(cu.ejectaAmp);
      expect(valueOf(b, 'uCraterDensity'), b.id).toBe(cu.density * rel);
      expect(valueOf(b, 'uEjectaStrength'), b.id).toBe(cu.ejectaStrength * rel);
      checked++;
    }
    expect(checked).toBe(GAS.length);
  });

  it('⭐ THE CLOSURE IS NOT "CRATERS OFF ON GAS WORLDS" — a real slice of the gas half FIRES', () => {
    // ⛔ THE ASSERTION AGAINST THE WRONG MENTAL MODEL. The row's cell describes the gas half as the
    // game holding craters OFF, which was true of the corpus it was measured on and is NOT true after
    // B2 leg 1 re-derived the visibility floor. If someone "simplifies" this pack to emit CRATERS_OFF
    // on gas bodies, every ledger count stays green and this reds.
    const fired = GAS.filter((b) => packFor(b).meta.cratersFired);
    expect(fired.length, 'a real slice of the gas half must have a live crater record').toBeGreaterThan(0);
    expect(fired.length).toBeLessThan(GAS.length);      // …and not all of it, or the gate is vacuous
    const amps = new Set(GAS.map((b) => valueOf(b, 'uCraterAmp')));
    expect(amps.size, 'uCraterAmp must VARY across the gas half').toBeGreaterThan(2);
  });

  it('no calibration constant is typed here — the numeric-literal set is pinned', () => {
    // Same anti-transcription fence rockySurface carries, inherited with the block. `C_CRATER` is a
    // NAMED FORWARD of the lab's own declaration (world-engine-lab.html:821), not a chosen number.
    const literals = [...PACK_CODE_STRINGS.matchAll(/(?<![\w.])\d+(?:\.\d+)?/g)].map((m) => m[0]);
    expect([...new Set(literals)].sort()).toEqual(['0', '1.0']);
    expect(C_CRATER).toBe(1.0);
    expect(PACK_CODE_STRINGS).not.toMatch(/Number\(|parseFloat\(|parseInt\(/);
  });
});

describe('D — the wire reaches a real lab material', () => {
  it('every name it emits EXISTS on the lab material, and the write does not throw', () => {
    const u = buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms;
    for (const n of CRATER_DECK_UNIFORMS) {
      expect(u[n], n).toBeTruthy();
      expect('value' in u[n], n).toBe(true);
    }
    for (const b of GAS.slice(0, 8)) {
      const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius });
      expect(() => applyDriverPacks(built.material, b.cond, labPackCtx(b.d, b.cond, undefined)), b.id)
        .not.toThrow();
    }
  });

  it('⭐⭐ THE ROW ITSELF — the lab material stops answering the factory schedule and starts answering the game', () => {
    // ⛔ P-14's closure, measured through the SHIPPED composition point on a REAL material rather
    // than off the pack's return value. The factory values are the row's own exhibit
    // (`uCraterAmp` 0.9, `uCraterScale` 6.0, `uCraterComplexD` 0.6, `uEjectaAmp` 0.35).
    let moved = 0;
    let agreed = 0;
    for (const b of GAS) {
      const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius });
      const before = Object.fromEntries(CRATER_DECK_UNIFORMS.map((n) => [n, built.material.uniforms[n].value]));
      applyDriverPacks(built.material, b.cond, labPackCtx(b.d, b.cond, undefined));
      const g = gameCraters(b.cond);
      for (const n of CRATER_DECK_UNIFORMS) {   // ⭐ 2026-09-03 — the guard below, not the list, is what excludes F3's three ray names (workstream wire-ejecta-rays-lab-into-game, AC-0)
        if (!(n in GAME_NAME)) continue;   // ⛔ `uRayBrightness`/`uRayCount`/`uRaySharp` are read off the CONDITION, not off `craterUniformsFrom`, so this row's producer has NO counterpart key for them — `g[undefined]` is not a value to compare against. That is the design, not a gap: `CRATERS_OFF` (craterUniforms.js:88-97) is frozen and has no ray key, and four AIRLESS corpus moons return it. Their assertions live in tests/driver-pack-ejectarays.test.js, which pins gas at exactly 0 through THIS pack.
        const after = built.material.uniforms[n].value;
        expect(after, `${b.id}/${n}: the lab material must agree with the game`).toBe(g[GAME_NAME[n]]);
        if (after !== before[n]) moved++;
        agreed++;
      }
    }
    expect(agreed).toBe(GAS.length * Object.keys(GAME_NAME).length);   // ⭐ 2026-09-03 — was `CRATER_DECK_UNIFORMS.length`; the two were the same number until F3's ray half joined the block. The count that belongs here is the number of names this row's producer ANSWERS (10), which is exactly `GAME_NAME`'s size.
    // …and it really MOVED the material rather than agreeing by luck with the defaults.
    expect(moved, 'the factory schedule must actually be displaced on the gas half').toBeGreaterThan(GAS.length);
  });

  it('[CONTROL] with the entry un-registered the SAME material keeps the factory schedule', () => {
    // The counterfactual, run rather than asserted: compose only the packs that are NOT this one and
    // show the four loud defaults survive. This is what P-14 measured before the closure.
    const b = GAS[0];
    const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius });
    const ctx = labPackCtx(b.d, b.cond, undefined);
    for (const e of selectPacks(b.cond, ctx)) {
      if (e.name === 'craterDeck') continue;
      const r = e.pack(b.cond, { ...ctx, gates: gatesFor(e) });
      for (const [n, d] of Object.entries(r.drivers)) {
        if (built.material.uniforms[n]) built.material.uniforms[n].value = resolveDriver(n, d, { ...ctx, gates: gatesFor(e) });
      }
    }
    expect(built.material.uniforms.uCraterAmp.value).toBe(0.9);
    expect(built.material.uniforms.uCraterScale.value).toBe(6.0);
    expect(built.material.uniforms.uCraterComplexD.value).toBe(0.6);
    expect(built.material.uniforms.uEjectaAmp.value).toBe(0.35);
  });
});

describe('E — the pack obeys the Step-5a contract and stays inside its scope', () => {
  it('it refuses a missing condition and a missing display policy', () => {
    expect(() => craterDeckPack(null, ctxFor(GAS[0]))).toThrow(PackContractError);
    expect(() => craterDeckPack(GAS[0].cond, { gates: { craters: true, ejecta: true } })).toThrow();
  });

  it('it bakes nothing and returns an EXPLICIT empty attributes object', () => {
    const r = packFor(GAS[0]);
    expect(r.attributes).toEqual({});
    expect(r.attributes).not.toBeUndefined();
  });

  it('it emits EXACTLY the ten names it declares — no more, no fewer', () => {
    for (const b of GAS.slice(0, 10)) {
      expect(Object.keys(packFor(b).drivers).sort()).toEqual([...CRATER_DECK_UNIFORMS].sort());
    }
    // …and the declared set is a SUBSET of rockySurface's, which is what "the same family" means.
    expect(CRATER_DECK_UNIFORMS.filter((n) => !ROCKY_SURFACE_UNIFORMS.includes(n))).toEqual([]);
  });

  it('⭐ THE DISPLAY-POLICY SEAM IS NOT VACUOUS HERE — uCraterScale is km-shaped', () => {
    // Unlike the gas deck (whose km-keyed set is empty), this pack really does cross
    // `assertDisplayPolicy`, so the two policies differ on exactly one name and nowhere else.
    const b = GAS.find((x) => packFor(x).meta.cratersFired);
    expect(b, 'a fired gas body is needed or this gate is vacuous').toBeTruthy();
    const d = packFor(b).drivers;
    expect(isPackDriver(d.uCraterScale) && d.uCraterScale.featureSizeKm !== undefined).toBe(true);
    const game = { ...labPackCtx(b.d, b.cond, undefined), gates: { craters: true, ejecta: true } };
    const other = { ...game, displayRadiusEarth: Math.sqrt(b.cond.radiusEarth ?? 1) };
    expect(resolveDriver('uCraterScale', d.uCraterScale, game))
      .not.toBe(resolveDriver('uCraterScale', d.uCraterScale, other));
    // …and no OTHER name moves with the policy, which is the contract's own claim.
    for (const n of CRATER_DECK_UNIFORMS) {
      if (n === 'uCraterScale') continue;
      expect(resolveDriver(n, d[n], game), n).toBe(resolveDriver(n, d[n], other));
    }
    // …and the game's policy is the identity, so nothing ships different today.
    expect(gameDisplayRadiusEarth(b.cond.radiusEarth)).toBe(b.cond.radiusEarth);
  });

  it('meta reports WHY a body came out zero — three different worlds, one number', () => {
    const r = packFor(GAS[0]);
    expect(r.meta.compositionClass).toBe('gas');
    expect(typeof r.meta.craterRelevance).toBe('number');
    expect(typeof r.meta.cratersFired).toBe('boolean');
    // …and meta agrees with what the drivers resolve to, so the report and the wire cannot drift.
    for (const b of GAS.slice(0, 8)) {
      expect(packFor(b).meta.craterDensity, b.id).toBe(valueOf(b, 'uCraterDensity'));
      expect(packFor(b).meta.ejectaStrength, b.id).toBe(valueOf(b, 'uEjectaStrength'));
    }
  });
});

describe('F — the entry is registry-ready and collision-free', () => {
  it('⭐ it IS registered, and it is THE EXPORTED ENTRY rather than a retyped copy', () => {
    const entry = PACKS.find((e) => e.name === 'craterDeck');
    expect(entry, 'craterDeck must be registered').toBeTruthy();
    expect(entry).toBe(CRATER_DECK_ENTRY);      // IDENTITY, so the predicate under test is the one that composes
    expect(entry.pack).toBe(craterDeckPack);
    expect(Object.isFrozen(CRATER_DECK_ENTRY)).toBe(true);
    // APPENDED, never prepended: four assertions in this repo index PACKS positionally, and the
    // dangerous one reads `PACKS[0]`. ⭐ RE-AIMED AT B3 LEG 3, and re-aimed rather than deleted: it
    // WAS `PACKS[PACKS.length - 1]`, which stops meaning "appended" the moment a LATER leg appends
    // its own entry — `solidFeatures` did, and the assertion then reads as a craterDeck regression.
    // What it was actually protecting is stated directly instead: index 0 is untouched, and this
    // entry sits after every entry that predates it.
    expect(PACKS[0].name).toBe('giantDeck');
    expect(PACKS.indexOf(CRATER_DECK_ENTRY)).toBeGreaterThan(PACKS.findIndex((e) => e.name === 'solidOptics'));
  });

  it('⛔ it collides with NOTHING on any body it claims — by NAME LOOKUP, over the population', () => {
    const mine = new Set(CRATER_DECK_UNIFORMS);
    let coApplied = 0;
    for (const b of GAS) {
      const ctx = labPackCtx(b.d, b.cond, undefined);
      for (const e of selectPacks(b.cond, ctx)) {
        if (e.name === 'craterDeck') continue;
        coApplied++;
        const theirs = Object.keys(e.pack(b.cond, { ...ctx, gates: gatesFor(e) }).drivers);
        expect(theirs.filter((n) => mine.has(n)), `${b.id}: ${e.name} collides with craterDeck`).toEqual([]);
      }
    }
    expect(coApplied, 'it must really co-apply with other packs, or this is a claim about the empty set')
      .toBeGreaterThan(GAS.length);
  });

  it('⭐ REGISTRATION MOVES NO BODY BETWEEN MATERIALS — measured, not read off the predicate', () => {
    // Every gas body was already claimed by `giantDeck`, so the `packs.length > 0` term of the
    // admission test cannot flip. This is Step 10a's entry inverted, and Step 10a said so about
    // itself; saying nothing here would leave the two indistinguishable.
    for (const b of GENERATED) {
      const withMe = selectPacks(b.cond, ctxFor(b)).map((e) => e.name);
      const withoutMe = withMe.filter((n) => n !== 'craterDeck');
      expect(withoutMe.length, `${b.id} was already claimed before this entry existed`).toBeGreaterThan(0);
    }
  });

  it('the composed write log is the UNION of the applicable contract sets and nothing outside them', () => {
    const b = GAS[0];
    const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius });
    const res = applyDriverPacks(built.material, b.cond, labPackCtx(b.d, b.cond, undefined));
    expect(res.applied).toContain('craterDeck');
    for (const n of CRATER_DECK_UNIFORMS) expect(res.uniformsWritten, n).toContain(n);
    expect(res.gates.craters).toBe(true);
    expect(res.gates.ejecta).toBe(true);
  });
});
