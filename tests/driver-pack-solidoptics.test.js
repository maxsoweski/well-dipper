// tests/driver-pack-solidoptics.test.js — DRIVER PACK #5, the solid-body optics. Ledger rows P-11
// (limb + terminator, non-gas half) and P-05 (aurora).
//
// WHAT THIS FILE IS FOR, in the terms the row is written in. Both rows are the same failure: a law
// the game already computes per body, and a lab material that declares the uniform and receives
// nothing. Neither is a law CHOICE — P-05's row says so outright ("no ruling from Max is owed") —
// so every assertion here is about the WIRE, and the one thing that could go wrong in a wiring
// commit is somebody re-typing the law on the way through. That is what §C exists to stop.
//
// ⛔ THE ONE PROPERTY THAT MAKES THIS PACK DIFFERENT FROM THE OTHER FOUR. Its predicate is not
// disjoint from every registered predicate — it is character-identical to `rockySurface`'s, so the
// two ALWAYS co-apply and `applyDriverPacks`' collision throw is the live guard rather than an
// inert one. §F carries that.
//
// ⛔ EVERY CONTROL IN THIS FILE WAS PROVEN TO BITE by reverting the fix and confirming the SPECIFIC
// assertion reds, then restoring. The list is in the stage report. Two dead controls shipped in
// this lane before hostile review caught them, so "the test passes" is not evidence on its own.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { buildLabPlanetMaterial } from '../src/rendering/LabPlanetMaterial.js';
import {
  writePackUniforms, isPackDriver, PackContractError,
} from '../src/worldengine/port/writePackUniforms.js';
import { PACKS, gatesFor, GATE_POLICY_ALL_ON, GATE_POLICY_RULED, GATE_RULINGS, selectPacks } from '../src/worldengine/drivers/index.js';
import { ROCKY_SURFACE_ENTRY, ROCKY_SURFACE_UNIFORMS } from '../src/worldengine/drivers/rockySurface.js'; import { SOLID_FEATURES_UNIFORMS } from '../src/worldengine/drivers/solidFeatures.js'; import { FLUVIAL_DECK_UNIFORMS } from '../src/worldengine/drivers/fluvialDeck.js';   // ⛔ RIDES THIS LINE: a new import line shifts every cited line below it.
import { LIMB_UNIFORMS } from '../src/worldengine/drivers/limbDeck.js';
import { Planet, labPackCtx, setLabGasBodiesOverride } from '../src/objects/Planet.js';
import {
  solidOpticsPack, SOLID_OPTICS_ENTRY, SOLID_OPTICS_UNIFORMS,
  TERMINATOR_GATE, AURORA_GATE,
} from '../src/worldengine/drivers/solidOptics.js';
import { atmosphereOpticsOf } from '../src/worldengine/base/atmosphereOptics.js';
import { terminatorOpticsOf, TERM_STRENGTH, termWidthFor } from '../src/worldengine/base/terminatorOptics.js';
import {
  auroraOpticsOf, auroraColorFor, auroraRingLatFor, auroraRingWidthFor,
  opaqueCO2ShroudOf, AURORA_FIELD_MIN, AURORA_COLOR_FALLBACK,
} from '../src/worldengine/base/auroraOptics.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// The pack's own source, COMMENTS AND STRING INTERIORS BLANKED — the house view. The header quotes
// several shipped lines verbatim, so a raw scan would find a "law" that is only prose.
const PACK_CODE = stripCommentsPreservingOffsets(read('src/worldengine/drivers/solidOptics.js'), {
  blankLiteralText: true,
});
const AURORA_CODE = stripCommentsPreservingOffsets(read('src/worldengine/base/auroraOptics.js'), {
  blankLiteralText: true,
});
// ⚠ AND A SECOND VIEW, COMMENTS STRIPPED BUT STRING INTERIORS INTACT. `blankLiteralText` blanks the
// inside of every string, which includes IMPORT SPECIFIERS and the `'gas'` in the predicate — so the
// blanked view cannot see the two things §C most needs to check. Comments are still stripped here,
// which is the part that matters: a law re-quoted in a comment must not satisfy a code assertion.
const PACK_CODE_STR = stripCommentsPreservingOffsets(read('src/worldengine/drivers/solidOptics.js'));
const AURORA_CODE_STR = stripCommentsPreservingOffsets(read('src/worldengine/base/auroraOptics.js'));

// ─────────────────────────────────────────────────────────────────────────────
// The population. Real generated systems through the real adapter — never Sol, which renders from
// NASA textures through a different renderer and carries no world-engine condition fields.
// ─────────────────────────────────────────────────────────────────────────────
function generatedPlanets(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const seed = `lab-procedural-${i}`;
    const sys = StarSystemGenerator.generate(seed, null);
    (sys.planets || []).forEach((e) => {
      out.push({ id: `${seed}#${e.planetData._ordinal}`, d: e.planetData, cond: conditionFromBody(e.planetData) });
    });
  }
  return out;
}
const GENERATED = generatedPlanets(24);
const GAS = GENERATED.filter((b) => compositionClass(b.cond) === 'gas');
const SOLID = GENERATED.filter((b) => compositionClass(b.cond) !== 'gas');

const ctxFor = (b, gates = gatesFor(SOLID_OPTICS_ENTRY, GATE_POLICY_ALL_ON)) => ({ ...labPackCtx(b.d, b.cond), gates });   // ⛔ THE DEFAULT NAMES ALL_ON, 2026-09-03 (F35). This file's subject is the pack's LAW FORWARDING — does the swapped material carry the same limb/terminator values the legacy game material does — and that question is only askable with the gate OPEN. `gatesFor`'s DEFAULT moved to GATE_POLICY_RULED, under which uTermStrength is +0 (Max 2026-07-16: "We need to disable terminator gradient totally"), so leaving the default here would have turned four law assertions into assertions about a gate. The ruled value has its own arms at :159 and :496.
const packFor = (b, gates) => solidOpticsPack(b.cond, ctxFor(b, gates));

function composeOnto(b, gates = gatesFor(SOLID_OPTICS_ENTRY, GATE_POLICY_ALL_ON)) {   // ⛔ ALL_ON for the reason `ctxFor` states three lines up.
  const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius });
  const ctx = ctxFor(b, gates);
  const res = solidOpticsPack(b.cond, ctx);
  writePackUniforms(built.material.uniforms, res.drivers, ctx);
  return { material: built.material, res, ctx };
}

function planetAt(d, enabled) {
  setLabGasBodiesOverride(enabled);
  try {
    const p = new Planet({ sunDirection: [1, 0, 0], ...d }, null);
    return { surface: p.surface, material: p.surface.material };
  } finally {
    setLabGasBodiesOverride(null);
  }
}

const vec = (v) => (v && v.isColor ? [v.r, v.g, v.b] : v && v.isVector3 ? [v.x, v.y, v.z] : v);

beforeEach(() => { setLabGasBodiesOverride(null); });
afterEach(() => { setLabGasBodiesOverride(null); });

// ═════════════════════════════════════════════════════════════════════════════
// §A — THE PREDICATE. It decides the POPULATION rather than a pixel, and its wrong answer is
// silent — no throw, no red test, just a class of body that quietly changed material.
// ═════════════════════════════════════════════════════════════════════════════
describe('A — the predicate admits exactly the non-gas class, and moves no body', () => {
  it('admits EXACTLY the set rockySurface admits — membership, not a count', () => {
    const mine = GENERATED.filter((b) => SOLID_OPTICS_ENTRY.applies(b.cond) === true).map((b) => b.id);
    const theirs = GENERATED.filter((b) => ROCKY_SURFACE_ENTRY.applies(b.cond) === true).map((b) => b.id);
    expect(mine).toEqual(theirs);
    expect(mine.length).toBe(SOLID.length);
    // Non-vacuous in both directions: a real solid population AND a real gas population it refuses.
    expect(SOLID.length).toBeGreaterThan(40);
    expect(GAS.length).toBeGreaterThan(20);
  });

  it('⭐ REGISTRATION MOVES NO BODY — the admitted set is identical with and without this entry', () => {
    // THE POINT OF THE IDENTICAL PREDICATE, asserted rather than argued. Step 10a's entry DID move
    // bodies (341 -> 846 swapped) because it claimed a population nothing else claimed. This one
    // cannot, because `selectPacks` already returned a non-empty list for every body it claims —
    // and `packs.length > 0` is the term that decides admission.
    let claimedBefore = 0, claimedAfter = 0, both = 0;
    for (const b of GENERATED) {
      const names = selectPacks(b.cond).map((e) => e.name);
      const without = names.filter((n) => n !== 'solidOptics');
      if (without.length > 0) claimedBefore++;
      if (names.length > 0) claimedAfter++;
      if (names.includes('solidOptics')) {
        both++;
        // …and every body it claims was ALREADY claimed, by rockySurface, so nothing arrives new.
        expect(without, `${b.id} would be a newly-claimed body`).toContain('rockySurface');
      }
    }
    expect(claimedAfter).toBe(claimedBefore);
    expect(both).toBe(SOLID.length);
  });

  it('the predicate is CONDITION-DERIVED, never a type label', () => {
    expect(PACK_CODE_STR).toMatch(/applies:\s*\(condition\)\s*=>\s*compositionClass\(condition\)\s*!==\s*'gas'/);
    expect(PACK_CODE, 'no pack may branch on d.type').not.toMatch(/\.type\b/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §B — THE DECLARED GATES. An absent gate key THROWS at the writer, so a pack that keys a driver
// on a name it did not declare is a runtime failure rather than a silent render decision.
// ═════════════════════════════════════════════════════════════════════════════
describe('B — the declared gate names are the ones the ALL_ON policy resolves', () => {
  it('declares exactly the two gates its drivers key on', () => {
    expect(SOLID_OPTICS_ENTRY.gates).toEqual([TERMINATOR_GATE, AURORA_GATE]);
    expect(gatesFor(SOLID_OPTICS_ENTRY, GATE_POLICY_ALL_ON)).toEqual({ terminator: true, aurora: true });
    expect(gatesFor(SOLID_OPTICS_ENTRY, GATE_POLICY_RULED)).toEqual({ terminator: false, aurora: true });   // ⭐ 2026-09-03 RE-POINTED — Max 2026-07-16: "We need to disable terminator gradient totally; it doesn't work but also this is ultimately something that will need to be rendered in the lighting engine of the main game anyway." RULED is now `gatesFor`'s DEFAULT, so the bare call below is the GAME's answer; ALL_ON above is kept and still means all-on, which is what keeps his ruling #4 truthful.
    expect(gatesFor(SOLID_OPTICS_ENTRY)).toEqual({ terminator: false, aurora: true });
    expect(GATE_RULINGS.terminator).toBe(false);
  });

  it('every gated driver keys on a DECLARED name — checked by walking the emitted drivers', () => {
    const declared = new Set(SOLID_OPTICS_ENTRY.gates);
    let gated = 0;
    for (const b of SOLID) {
      for (const [name, d] of Object.entries(packFor(b).drivers)) {
        if (isPackDriver(d) && d.gate != null) {
          expect(declared.has(d.gate), `${name} keys on undeclared gate '${d.gate}'`).toBe(true);
          gated++;
        }
      }
    }
    // Non-vacuous — there really are gated drivers, two per body.
    expect(gated).toBe(SOLID.length * 2);
  });

  it('a gate OFF zeroes exactly its own magnitude and leaves the siblings written', () => {
    // The lab's own shape: the enable checkbox zeroes the MAGNITUDE and the writer keeps pushing
    // the width/hue every frame. Gating the siblings too would apply the decision twice.
    const b = SOLID.find((x) => packFor(x).meta.auroraLive) || SOLID[0];
    const off = composeOnto(b, { terminator: false, aurora: false });
    expect(off.material.uniforms.uTermStrength.value).toBe(0);
    expect(off.material.uniforms.uAuroraIntensity.value).toBe(0);
    // …and the siblings still carry this body's real values, not the factory defaults.
    const on = composeOnto(b, { terminator: true, aurora: true });
    expect(off.material.uniforms.uTermWidth.value).toBe(on.material.uniforms.uTermWidth.value);
    expect(vec(off.material.uniforms.uAuroraColor.value)).toEqual(vec(on.material.uniforms.uAuroraColor.value));
    expect(off.material.uniforms.uAuroraRingLat.value).toBe(on.material.uniforms.uAuroraRingLat.value);
    // Non-vacuous: with the gate ON this body's magnitudes are NOT zero, so the assertion above is
    // a real switch rather than two zeros compared.
    expect(on.material.uniforms.uAuroraIntensity.value).toBeGreaterThan(0);
  });

  it('a driver gated on an UNDECLARED name throws at the writer', () => {
    const b = SOLID[0];
    const ctx = { ...labPackCtx(b.d, b.cond), gates: { terminator: true } };   // `aurora` missing
    expect(() => writePackUniforms(
      buildLabPlanetMaterial({ bodyRadius: b.d.radius }).material.uniforms,
      solidOpticsPack(b.cond, ctx).drivers, ctx,
    )).toThrow(PackContractError);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §C — EVERY DRIVER IS A FORWARD OF A SHARED PRODUCER. This is route (iii)'s own gate and the
// reason this pack is allowed to exist at all: a transcription would satisfy every value check in
// this file TODAY and break the first time either law moved.
// ═════════════════════════════════════════════════════════════════════════════
describe('C — every driver is a forward of a shared producer, never a re-typed law', () => {
  it('the pack IMPORTS the three law modules and declares no law of its own', () => {
    expect(PACK_CODE_STR).toMatch(/import \{ atmosphereOpticsOf \} from '\.\.\/base\/atmosphereOptics\.js'/);
    expect(PACK_CODE_STR).toMatch(/import \{ terminatorOpticsOf \} from '\.\.\/base\/terminatorOptics\.js'/);
    expect(PACK_CODE_STR).toMatch(/import \{ auroraOpticsOf \} from '\.\.\/base\/auroraOptics\.js'/);
    // ⛔ NO NUMERIC LAW MAY BE TYPED IN THIS FILE. These are the four coefficients that would have to
    // appear if somebody re-authored either band here instead of forwarding it.
    for (const lit of ['0.15', '0.09', '0.12', '0.08', '0.7', '0.05']) {
      expect(PACK_CODE, `the pack re-types the coefficient ${lit}`).not.toContain(lit);
    }
    expect(PACK_CODE, 'the pack re-derives a log ramp').not.toContain('Math.log10');
  });

  it('⭐ every emitted value EQUALS the shared module’s, body by body, at max delta 0', () => {
    let maxD = 0, n = 0;
    for (const b of SOLID) {
      const o = atmosphereOpticsOf(b.cond);
      const t = terminatorOpticsOf(b.cond);
      const a = auroraOpticsOf(b.cond);
      const dr = packFor(b).drivers;
      const d = (x, y) => Math.abs(x - y);
      maxD = Math.max(maxD,
        d(dr.uLimbExponent, o.limbExponent),
        d(dr.uTermWidth, t.termWidth),
        d(dr.uTermStrength.value, t.termStrength),
        d(dr.uAuroraIntensity.value, a.auroraIntensity),
        d(dr.uAuroraRingLat, a.auroraRingLat),
        d(dr.uAuroraRingWidth, a.auroraRingWidth),
        ...dr.uLimbColor.map((v, i) => d(v, o.limbColor[i])),
        ...dr.uTermColor.map((v, i) => d(v, t.termColor[i])),
        ...dr.uAuroraColor.map((v, i) => d(v, a.auroraColor[i])),
      );
      n++;
    }
    expect(n).toBeGreaterThan(40);
    expect(maxD).toBe(0);
  });

  it('⭐⭐ P-11: the swapped material’s limb + terminator EQUAL the LEGACY GAME material’s', () => {
    // THE ROW'S ACTUAL CLAIM, measured on two real materials built from one body — which is what a
    // transcription check cannot fake, because the game material reads the module through
    // src/objects/Planet.js and this pack reads it through the drivers layer.
    let compared = 0;
    for (const b of SOLID.slice(0, 30)) {
      const legacy = planetAt(b.d, false).material.uniforms;
      const { material } = composeOnto(b);
      const swapped = material.uniforms;
      for (const n of ['uLimbExponent', 'uTermStrength', 'uTermWidth']) {
        expect(swapped[n].value, `${b.id} ${n}`).toBe(legacy[n].value);
      }
      // The two colours agree COMPONENTWISE; they differ only in container (game Vector3, lab
      // Color), which is the `encodeValue` split the ledger records — an instrument fact, and the
      // reason those two names stay in P-11's subject cell while the exponent leaves it.
      for (const n of ['uLimbColor', 'uTermColor']) {
        expect(vec(swapped[n].value), `${b.id} ${n}`).toEqual(vec(legacy[n].value));
      }
      compared++;
    }
    expect(compared).toBe(30);
  });

  it('⭐ P-05: the aurora four are the LAB’s law — labCore’s field, not condition.magneticField', () => {
    // The row's ruling is that the lab's law wins, because the game's scales by a `uvFlux` that
    // never crosses the condition seam. The two fields are NOT the same number, so reading the
    // wrong one is a live wrong answer rather than a stylistic difference.
    let differed = 0, checked = 0;
    for (const b of SOLID) {
      const u = deriveUniforms(b.cond);
      const a = auroraOpticsOf(b.cond);
      expect(a.auroraRingLat).toBe(auroraRingLatFor(u.magneticField));
      expect(a.auroraRingWidth).toBe(auroraRingWidthFor(u.magneticField));
      expect(a.auroraColor).toEqual(auroraColorFor(b.cond.atmosphere?.composition));
      if (b.cond.magneticField !== u.magneticField) differed++;
      checked++;
    }
    expect(checked).toBeGreaterThan(40);
    // Non-vacuous: the passthrough field really does disagree with labCore's on part of the corpus,
    // so "reads the bundle" is a distinguishable claim rather than two names for one number.
    expect(differed).toBeGreaterThan(0);
  });

  it('the aurora module carries the lab’s gate AND the Venus override, both live on this corpus', () => {
    let gatedOff = 0, shrouded = 0, live = 0;
    for (const b of SOLID) {
      const u = deriveUniforms(b.cond);
      const a = auroraOpticsOf(b.cond);
      const shroud = opaqueCO2ShroudOf(b.cond);
      if (shroud) shrouded++;
      if (u.magneticField <= AURORA_FIELD_MIN) gatedOff++;
      if (a.auroraIntensity > 0) live++;
      // The composite is exactly: labCore's intensity, unless the field gate or the shroud fires.
      expect(a.auroraIntensity, b.id)
        .toBe(u.magneticField > AURORA_FIELD_MIN && !shroud ? u.auroraIntensity : 0.0);
    }
    // ⛔ ALL THREE BRANCHES MUST BE EXERCISED, or this test is three tautologies. The Venus shroud
    // in particular is the piece the ledger row's prose does not name, and it is worth 130 of 852
    // planets over the full corpus.
    expect(live, 'some body must actually light an aurora').toBeGreaterThan(0);
    expect(gatedOff, 'the 0.05 field gate must fire on this corpus').toBeGreaterThan(0);
    expect(shrouded, 'the Venus CO2 shroud must fire on this corpus').toBeGreaterThan(0);
  });

  it('the colour table is the lab’s, with the lab’s fallback and not the material default', () => {
    expect(auroraColorFor('n2-o2')).toEqual([0.3, 0.9, 0.4]);
    expect(auroraColorFor('h2-he')).toEqual([0.3, 0.2, 0.8]);
    expect(auroraColorFor('co2-n2')).toEqual([0.8, 0.3, 0.4]);
    expect(auroraColorFor('co2')).toEqual([0.9, 0.35, 0.5]);
    expect(auroraColorFor('methane')).toEqual([0.2, 0.6, 0.7]);
    // ⛔ THE FALLBACK IS THE LAB'S [0.3, 0.8, 0.4] AND NOT THE MATERIAL DEFAULT [0.3, 0.9, 0.5].
    // Both literals exist in this codebase a hair apart; this is the assertion that tells them apart.
    expect(auroraColorFor(undefined)).toEqual([...AURORA_COLOR_FALLBACK]);
    expect(auroraColorFor('unknown-gas')).toEqual([0.3, 0.8, 0.4]);
    expect(auroraColorFor('n2-o2')).not.toEqual([0.3, 0.9, 0.5]);
    // …and each call returns a FRESH array, so one body's hue cannot follow another's.
    const a = auroraColorFor('co2'); a[0] = 99;
    expect(auroraColorFor('co2')[0]).toBe(0.9);
  });

  it('the ring laws are pinned as LAWS, including the floor the corpus never reaches', () => {
    // ⚠ WRITTEN BECAUSE THE OBVIOUS CONTROL WAS DEAD. Deleting the `Math.max(0.07, …)` floor from
    // `auroraRingWidthFor` does NOT red anything measured over the corpus, and that is not a gap in
    // the corpus — it is arithmetic: `magneticField` is `ironFraction x lock-factor` and stays in
    // 0..1, where `0.15 - 0.08f` never drops below 0.07. So the floor is pinned HERE, at a
    // synthetic field the population does not produce, rather than left as an untested branch that
    // a reader would assume the corpus covers.
    expect(auroraRingWidthFor(0)).toBe(0.15);
    expect(auroraRingWidthFor(1)).toBeCloseTo(0.07, 12);
    expect(auroraRingWidthFor(2)).toBe(0.07);       // the floor, and only a field > 1 reaches it
    expect(auroraRingWidthFor(50)).toBe(0.07);
    expect(auroraRingLatFor(0)).toBe(0.7);
    expect(auroraRingLatFor(1)).toBeCloseTo(0.9, 12);
    // …and the ring really does narrow as the dynamo strengthens, which is the law's whole content.
    expect(auroraRingWidthFor(0.9)).toBeLessThan(auroraRingWidthFor(0.1));
    expect(auroraRingLatFor(0.9)).toBeGreaterThan(auroraRingLatFor(0.1));
  });

  it('the aurora module reaches labCore for the intensity rather than re-typing it', () => {
    expect(AURORA_CODE_STR).toMatch(/import \{ deriveUniforms \} from '\.\/labCore\.js'/);
    expect(AURORA_CODE, 'the intensity law must not be re-typed here').not.toMatch(/hasAtmo/);
    // ⛔ AND IT MUST NOT REACH FOR e1Regime — tests/worldengine-e1-shadow-audit.test.js forbids it
    // for every file in base/, and it is the reason the gas-only `_giantDynamo` floor lives one
    // layer up rather than in this module.
    expect(AURORA_CODE_STR).not.toMatch(/e1Regime/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §D — THE WIRE REACHES A REAL LAB MATERIAL. Values that are right in a returned object and never
// arrive at a uniform are the failure both rows describe.
// ═════════════════════════════════════════════════════════════════════════════
describe('D — the wire reaches a real lab material', () => {
  it('all nine names land on the material and none of them stays at the factory default set', () => {
    const factory = buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms;
    const before = Object.fromEntries(SOLID_OPTICS_UNIFORMS.map((n) => [n, JSON.stringify(vec(factory[n].value))]));
    const movedAnywhere = new Set();
    for (const b of SOLID) {
      const { material } = composeOnto(b);
      for (const n of SOLID_OPTICS_UNIFORMS) {
        expect(material.uniforms[n], `${n} must exist on the lab material`).toBeTruthy();
        if (JSON.stringify(vec(material.uniforms[n].value)) !== before[n]) movedAnywhere.add(n);
      }
    }
    // ⛔ EVERY declared name must move on SOME body. A name that never moves is a wire that landed
    // on the default — which is exactly the shape ledger row P-05 was filed as.
    expect([...movedAnywhere].sort()).toEqual([...SOLID_OPTICS_UNIFORMS].sort());
  });

  it('a typo’d uniform name throws rather than being silently skipped', () => {
    const b = SOLID[0];
    const ctx = ctxFor(b);
    expect(() => writePackUniforms(
      buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms,
      { uAuroraRingLatt: 0.7 }, ctx,
    )).toThrow(/no uniform named/);
  });

  it('a missing display policy is refused eagerly, even though no driver is km-keyed', () => {
    expect(() => solidOpticsPack(SOLID[0].cond, { gates: gatesFor(SOLID_OPTICS_ENTRY) }))
      .toThrow(PackContractError);
    expect(() => solidOpticsPack(null, ctxFor(SOLID[0]))).toThrow(/condition vector is missing/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §E — SCOPE. The pack may write what it declared and nothing else, and it must refuse the class
// it does not own.
// ═════════════════════════════════════════════════════════════════════════════
describe('E — the pack obeys the Step-5a contract and stays inside its scope', () => {
  it('emits EXACTLY its published family, on every body, by membership', () => {
    for (const b of SOLID) {
      expect(Object.keys(packFor(b).drivers).sort(), b.id).toEqual([...SOLID_OPTICS_UNIFORMS].sort());
    }
  });

  it('⛔ does NOT claim uLimbStrength — the rim master gate is not in P-11 and stays at its default', () => {
    // The pack forwards the rim's WIDTH and HUE and deliberately not its master gate. That leaves
    // the limb inert on pixels for solid bodies, which is recorded in the pack header and in the
    // ledger row rather than fixed inside a wiring commit. This assertion is what stops the fix
    // arriving quietly later.
    expect(SOLID_OPTICS_UNIFORMS).not.toContain('uLimbStrength');
    for (const b of SOLID.slice(0, 10)) {
      const { material } = composeOnto(b);
      expect(material.uniforms.uLimbStrength.value, `${b.id} rim gate must stay at the default`).toBe(0);
    }
    // …and the two names it DOES share with limbDeck are exactly the two the gas pack also forwards.
    expect([...SOLID_OPTICS_UNIFORMS].filter((n) => LIMB_UNIFORMS.includes(n)).sort())
      .toEqual(['uLimbColor', 'uLimbExponent']);
  });

  it('returns the Step-5a shape and bakes no attribute', () => {
    const res = packFor(SOLID[0]);
    expect(Object.keys(res)).toEqual(expect.arrayContaining(['drivers', 'attributes', 'meta']));
    expect(res.attributes).toEqual({});
  });

  it('every declared name exists on the lab material — a typo in the SET is caught here', () => {
    const u = buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms;
    for (const n of SOLID_OPTICS_UNIFORMS) {
      expect(u[n], n).toBeTruthy();
      expect('value' in u[n], n).toBe(true);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §F — REGISTRY. The entry is the exported object, appended, and collision-free BY NAME — which
// here is load-bearing rather than inert, because the predicates always co-apply.
// ═════════════════════════════════════════════════════════════════════════════
describe('F — the entry is registry-ready and its collision guard is LIVE', () => {
  it('is registered, is THE EXPORTED ENTRY, and is appended rather than prepended', () => {
    const names = PACKS.map((e) => e.name);
    expect(names).toContain('solidOptics');
    expect(names.filter((n) => n === 'solidOptics').length).toBe(1);
    expect(new Set(names).size).toBe(names.length);
    const entry = PACKS.find((e) => e.name === 'solidOptics');
    expect(entry, 'a hand-retyped copy would drift from the predicate gated in §A').toBe(SOLID_OPTICS_ENTRY);
    expect(entry.pack).toBe(solidOpticsPack);
    expect(names.indexOf('solidOptics')).toBeGreaterThan(names.indexOf('rockySurface'));
  });

  it('⛔ co-applies with rockySurface on EVERY body it claims, and collides with nothing', () => {
    const mine = new Set(SOLID_OPTICS_UNIFORMS);
    // The two gas-only packs: disjoint by PREDICATE, so the throw is inert against them.
    for (const name of ['limbDeck', 'polarDeck']) {
      const e = PACKS.find((x) => x.name === name);
      expect(e, `${name} must be registered`).toBeTruthy();
      for (const b of SOLID) expect(e.applies(b.cond) === true, `${b.id} / ${name}`).toBe(false);
    }
    // ⭐⭐ `giantDeck` LEFT THAT LOOP AT B3 LEG 2 AND IS CHECKED BY NAME INSTEAD. Ledger R-07 widened
    // its predicate to src/worldengine/drivers/giantDeck.js:59 `export function bandedEnvelopeOf(condition) {`
    // — gas OR an opaque CO2 shroud — and an opaque-CO2 body is `rocky`, so it co-applies with THIS
    // pack on that slice and the collision throw is live rather than inert for the pair. The two
    // families are disjoint by construction (the deck writes `uBand*`/`uJet*`, this writes the air
    // optics) and that is what is asserted, over a real co-applied population rather than one body.
    const gdeck = PACKS.find((x) => x.name === 'giantDeck');
    expect(gdeck, 'giantDeck must be registered').toBeTruthy();
    let deckCo = 0;
    for (const b of SOLID) if (gdeck.applies(b.cond) === true) deckCo++;
    expect(deckCo, 'R-07: the deck must co-apply with solidOptics somewhere, or the name check below is vacuous').toBeGreaterThan(0);
    const deckNames = new Set(Object.keys(gdeck.pack(
      SOLID.find((b) => gdeck.applies(b.cond) === true).cond,
      { ...labPackCtx(SOLID.find((b) => gdeck.applies(b.cond) === true).d,
                      SOLID.find((b) => gdeck.applies(b.cond) === true).cond),
        gates: { bands: true, jets: true } },
    ).drivers));
    expect(deckNames.size).toBeGreaterThan(2);
    expect([...mine].filter((n) => deckNames.has(n)), 'solidOptics collides with giantDeck').toEqual([]);
    // rockySurface: NOT disjoint by predicate — identical, in fact — so name-disjointness is the
    // only thing holding the collision throw off, and it is checked over the whole population.
    let co = 0;
    for (const b of GENERATED) {
      expect(SOLID_OPTICS_ENTRY.applies(b.cond)).toBe(ROCKY_SURFACE_ENTRY.applies(b.cond));
      if (SOLID_OPTICS_ENTRY.applies(b.cond) === true) co++;
    }
    expect(co).toBe(SOLID.length);
    expect([...mine].filter((n) => ROCKY_SURFACE_UNIFORMS.includes(n)),
      'solidOptics collides with rockySurface').toEqual([]);
    // …and the gas half's names, which it must also never touch.
    expect([...mine].filter((n) => n === 'uLimbStrength')).toEqual([]);
  });

  it('applyDriverPacks composes both non-gas packs onto one body without throwing', async () => {
    const { applyDriverPacks } = await import('../src/worldengine/drivers/index.js');
    const b = SOLID[0];
    const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius });
    const res = applyDriverPacks(built.material, b.cond, labPackCtx(b.d, b.cond, undefined));
    expect(res.applied).toEqual(['rockySurface', 'solidOptics', 'solidFeatures', 'fluvialDeck']);   // ⭐ FOUR SINCE 2026-09-02 — `fluvialDeck` carries the same `!== 'gas'` predicate.
    expect(res.gates).toEqual({ craters: true, ejecta: true, terminator: false, aurora: true, edifices: true, chaos: true, frost: true, glacial: true, deltas: true, coast: true, outflow: true });   // ⭐ 2026-09-03 `terminator` RE-POINTED true -> false — Max 2026-07-16: "We need to disable terminator gradient totally; it doesn't work but also this is ultimately something that will need to be rendered in the lighting engine of the main game anyway." This is applyDriverPacks, i.e. the GAME's own composition point, so it takes `gatesFor`'s default (RULED) and this row is what the game now writes. Every OTHER gate is still true: the ruling answers one name, it does not weaken the policy.
    // The write log is the UNION of both contract sets and nothing outside them.
    // ⭐ THREE PACKS SINCE B3 LEG 3: `solidFeatures` shares this predicate, so the union it is
    // compared against has to include its contract set or the assertion reds on a declared write.
    const declared = new Set([...ROCKY_SURFACE_UNIFORMS, ...SOLID_OPTICS_UNIFORMS, ...SOLID_FEATURES_UNIFORMS, ...FLUVIAL_DECK_UNIFORMS]);   // ⭐ and a FOURTH contract set, 2026-09-02, for the reason the line above states.
    expect(res.uniformsWritten.filter((n) => !declared.has(n))).toEqual([]);
    for (const n of SOLID_OPTICS_UNIFORMS) expect(res.uniformsWritten, n).toContain(n);
  });

  it('a gas body is refused by the entry and by the real registry alike', () => {
    for (const b of GAS.slice(0, 20)) {
      expect(SOLID_OPTICS_ENTRY.applies(b.cond)).toBe(false);
      expect(selectPacks(b.cond).map((e) => e.name)).not.toContain('solidOptics');
    }
    expect(GAS.length).toBeGreaterThan(20);
  });
});
