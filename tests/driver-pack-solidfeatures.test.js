// tests/driver-pack-solidfeatures.test.js — DRIVER PACK #7, the solid-body surface features.
// Block B3 leg 3, 2026-08-21. Six lab features that no pack wrote: F7 volcanic edifices,
// F9 chaos + F10 ridged icy (one shared master), F23 snowline/frost, F22 polar caps, F17 glacial.
//
// WHAT THIS FILE IS FOR. Every one of the fourteen uniforms below was DECLARED on the lab material
// and written by NOTHING, so a swapped solid body rendered six families at their factory default —
// one look, repainted. Nothing here is a law CHOICE: the masters already live in
// src/worldengine/base/labCore.js and the lab's own driver step forwards the identical fields. So
// every assertion is about the WIRE, and the one thing that can go wrong in a wiring commit is
// somebody re-deriving a law on the way through. §C exists to stop that.
//
// ⛔ EACH WIRED FEATURE HAS AN ASSERTION THAT REDS IF ITS WIRE IS REMOVED — §G, one block per
// feature, by NAME. A pack that quietly stopped emitting `uGlacialStrength` would otherwise leave
// every count in §D green (the other thirteen still vary) and one whole family dark.
//
// ⛔ EVERY CONTROL IN THIS FILE WAS PROVEN TO BITE by reverting the wire and confirming the SPECIFIC
// assertion reds, then restoring. The list is in the stage report. Two dead controls shipped in this
// lane before hostile review caught them, so "the test passes" is not evidence on its own.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { buildLabPlanetMaterial } from '../src/rendering/LabPlanetMaterial.js';
import { writePackUniforms, isPackDriver, PackContractError } from '../src/worldengine/port/writePackUniforms.js';
import { PACKS, gatesFor, selectPacks, applyDriverPacks } from '../src/worldengine/drivers/index.js';
import { ROCKY_SURFACE_UNIFORMS } from '../src/worldengine/drivers/rockySurface.js';
import { solidFeaturesLabState, solidFeaturesDirectDrivers, SOLID_FEATURES_LAB_BINDING } from '../src/worldengine/drivers/solidFeatures.js';
import { SOLID_OPTICS_UNIFORMS } from '../src/worldengine/drivers/solidOptics.js';
import { CRATER_DECK_UNIFORMS } from '../src/worldengine/drivers/craterDeck.js';
import { labPackCtx } from '../src/objects/Planet.js';
import {
  solidFeaturesPack, SOLID_FEATURES_ENTRY, SOLID_FEATURES_UNIFORMS,
  EDIFICE_GATE, CHAOS_GATE, FROST_GATE, GLACIAL_GATE,
} from '../src/worldengine/drivers/solidFeatures.js';
import { deriveUniforms, chasmaRiftsFor } from '../src/worldengine/base/labCore.js';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// The pack's own source, COMMENTS AND STRING INTERIORS BLANKED — the house view. The header quotes
// several shipped lines verbatim, so a raw scan would find a "law" that is only prose.
const PACK_CODE = stripCommentsPreservingOffsets(read('src/worldengine/drivers/solidFeatures.js'), {
  blankLiteralText: true,
});
// ⚠ A SECOND VIEW with comments stripped but string interiors intact: `blankLiteralText` blanks
// import specifiers and the `'gas'` in the predicate, which are two of the things §C most needs.
const PACK_CODE_STR = stripCommentsPreservingOffsets(read('src/worldengine/drivers/solidFeatures.js'));

// ─────────────────────────────────────────────────────────────────────────────
// The population. Real generated systems through the real adapter — never Sol, which renders from
// NASA textures through a different renderer and carries no world-engine condition fields.
// ⭐ MOONS ARE IN THE CORPUS ON PURPOSE. Plain moons are the population whose UAT Max passed with
// "these are all identical", and they are 632 of the 1484 bodies this leg claims.
// ─────────────────────────────────────────────────────────────────────────────
function generatedBodies(count) {
  const planets = []; const moons = [];
  for (let i = 0; i < count; i++) {
    const seed = `lab-procedural-${i}`;
    const sys = StarSystemGenerator.generate(seed, null);
    (sys.planets || []).forEach((e) => {
      planets.push({ id: `${seed}#${e.planetData._ordinal}`, d: e.planetData, cond: conditionFromBody(e.planetData) });
      (e.moons || []).forEach((m, j) => {
        if (m.planetData) return;   // planet-class moons take the planet route
        moons.push({ id: `${seed}#${e.planetData._ordinal}m${j}`, d: m, cond: conditionFromBody(m) });
      });
    });
  }
  return { planets, moons };
}
const { planets: GENERATED, moons: MOONS } = generatedBodies(24);
const GAS = GENERATED.filter((b) => compositionClass(b.cond) === 'gas');
const SOLID = GENERATED.filter((b) => compositionClass(b.cond) !== 'gas');

const ctxFor = (b, gates = gatesFor(SOLID_FEATURES_ENTRY)) => ({ ...labPackCtx(b.d, b.cond), gates });
const packFor = (b, gates) => solidFeaturesPack(b.cond, ctxFor(b, gates));

function composeOnto(b, gates = gatesFor(SOLID_FEATURES_ENTRY)) {
  const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius ?? 1 });
  const ctx = ctxFor(b, gates);
  const res = solidFeaturesPack(b.cond, ctx);
  writePackUniforms(built.material.uniforms, res.drivers, ctx);
  return { material: built.material, res, ctx };
}

const readU = (u, n) => {
  const v = u[n].value;
  if (v && v.isColor) return [v.r, v.g, v.b];
  if (v && v.isVector3) return [v.x, v.y, v.z];
  return v;
};
const distinct = (arr) => new Set(arr.map((v) => JSON.stringify(v))).size;

// ═════════════════════════════════════════════════════════════════════════════
// A — the predicate admits exactly the non-gas class
// ═════════════════════════════════════════════════════════════════════════════
describe('A — the predicate admits exactly the non-gas class', () => {
  it('⭐ SET MEMBERSHIP over the generated population, not a reading of two source lines', () => {
    for (const b of SOLID) expect(SOLID_FEATURES_ENTRY.applies(b.cond), b.id).toBe(true);
    for (const b of GAS) expect(SOLID_FEATURES_ENTRY.applies(b.cond), b.id).toBe(false);
    expect(SOLID.length).toBeGreaterThan(20);
    expect(GAS.length).toBeGreaterThan(20);
  });

  it('⭐ every plain moon is claimed — the population this leg exists to differentiate', () => {
    expect(MOONS.length).toBeGreaterThan(50);
    for (const b of MOONS) expect(SOLID_FEATURES_ENTRY.applies(b.cond), b.id).toBe(true);
  });

  it('⛔ it moves NO body between materials: the claimed set is rockySurface’s, exactly', () => {
    // The population argument, measured. `selectPacks` already returns a non-empty list for every
    // body this claims, so `packs.length > 0` cannot flip and no census is re-pinned.
    for (const b of [...SOLID, ...MOONS, ...GAS]) {
      const names = selectPacks(b.cond).map((e) => e.name);
      const without = names.filter((n) => n !== 'solidFeatures');
      expect(without.length, `${b.id}: registration must not be what admits this body`).toBeGreaterThan(0);
      if (names.includes('solidFeatures')) expect(without).toContain('rockySurface');
    }
  });

  it('⛔ the predicate is DERIVED FROM THE CONDITION, never from a type label', () => {
    expect(PACK_CODE_STR).toMatch(/applies:\s*\(condition\)\s*=>\s*compositionClass\(condition\)\s*!==\s*'gas'/);
    expect(PACK_CODE).not.toMatch(/\bd\.type\b|planetType|preset/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B — the declared gate names are the ones the drivers key on
// ═════════════════════════════════════════════════════════════════════════════
describe('B — the declared gate names resolve under the ALL_ON policy', () => {
  it('⭐ four names, and the ALL_ON map answers all four', () => {
    expect(SOLID_FEATURES_ENTRY.gates).toEqual([EDIFICE_GATE, CHAOS_GATE, FROST_GATE, GLACIAL_GATE]);
    expect(gatesFor(SOLID_FEATURES_ENTRY)).toEqual({ edifices: true, chaos: true, frost: true, glacial: true });
  });

  it('⛔ every gated driver keys on a DECLARED name — an undeclared one throws at the writer', () => {
    const declared = new Set(SOLID_FEATURES_ENTRY.gates);
    const { drivers } = packFor(SOLID[0]);
    let gated = 0;
    for (const [name, d] of Object.entries(drivers)) {
      if (isPackDriver(d) && d.gate != null) { gated++; expect(declared.has(d.gate), `${name} -> ${d.gate}`).toBe(true); }
    }
    expect(gated).toBe(5);   // the four masters + uChaosRaftJitter, which is the LAB's own placement
  });

  it('⭐ each gate really zeroes its own master and nothing else — one gate off at a time', () => {
    const b = SOLID.find((x) => {
      const u = deriveUniforms(x.cond);
      return u.volcanismStrength > 0 && u.frostMaxCoverage > 0 && u.glacialStrength > 0 && u.chaosRaftJitter > 0;
    });
    expect(b, 'the corpus must contain a body with all four families live').toBeTruthy();
    const all = gatesFor(SOLID_FEATURES_ENTRY);
    const on = composeOnto(b, all).material.uniforms;
    const cases = [
      [EDIFICE_GATE, ['uVolcanismStrength']],
      [CHAOS_GATE, ['uChaosRaftJitter']],
      [FROST_GATE, ['uFrostMaxCoverage', 'uPldStrength']],
      [GLACIAL_GATE, ['uGlacialStrength']],
    ];
    for (const [gate, zeroed] of cases) {
      const off = composeOnto(b, { ...all, [gate]: false }).material.uniforms;
      for (const n of SOLID_FEATURES_UNIFORMS) {
        if (zeroed.includes(n)) expect(readU(off, n), `${gate} must zero ${n}`).toBe(0);
        else expect(readU(off, n), `${gate} must not touch ${n}`).toEqual(readU(on, n));
      }
    }
  });

  it('⛔ an ABSENT gate key throws rather than rendering the feature ON', () => {
    expect(() => solidFeaturesPack(SOLID[0].cond, { ...labPackCtx(SOLID[0].d, SOLID[0].cond), gates: { edifices: true } }))
      .not.toThrow();   // the pack itself does not resolve; the WRITER does
    const ctx = { ...labPackCtx(SOLID[0].d, SOLID[0].cond), gates: { edifices: true } };
    const { drivers } = solidFeaturesPack(SOLID[0].cond, ctx);
    const built = buildLabPlanetMaterial({ bodyRadius: SOLID[0].d.radius ?? 1 });
    expect(() => writePackUniforms(built.material.uniforms, drivers, ctx)).toThrow(PackContractError);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C — every driver is a FORWARD of the shared producer, never a re-derivation
// ═════════════════════════════════════════════════════════════════════════════
describe('C — every driver is a forward of labCore, not a second law', () => {
  it('⭐⭐ every emitted value EQUALS the shared bundle’s field, on every body in the corpus', () => {
    // A transcription would satisfy this today and break the first time the law moved — which is
    // why the identity is checked against `deriveUniforms` rather than against a literal.
    const MAP = {
      uVolcanismStrength: 'volcanismStrength', uEdificeMaxHeight: 'edificeMaxHeight',
      uShieldStratoMix: 'shieldStratoMix', uCryoActivity: 'cryoActivity',
      uChaosRaftJitter: 'chaosRaftJitter', uFrostMaxCoverage: 'frostMaxCoverage',
      uFrostCondensationT: 'frostCondensationT', uFrostLatitudeBias: 'frostLatitudeBias',
      uFrostAlbedo: 'frostAlbedo', uPlanetTempEq: 'tempEq', uFrostLocked: 'frostLocked',
      uPldStrength: 'pldStrength', uGlacialStrength: 'glacialStrength',
      uGlacialFlowVigor: 'glacialFlowVigor',
    };
    expect(Object.keys(MAP).sort()).toEqual([...SOLID_FEATURES_UNIFORMS].sort());
    for (const b of [...SOLID.slice(0, 60), ...MOONS.slice(0, 120)]) {
      const u = deriveUniforms(b.cond);
      const uni = composeOnto(b).material.uniforms;
      for (const [name, field] of Object.entries(MAP)) {
        const want = Array.isArray(u[field]) ? u[field] : u[field];
        expect(readU(uni, name), `${b.id} ${name}`).toEqual(want);
      }
    }
  });

  it('⛔ the pack DERIVES nothing — no arithmetic on the bundle, no numeric literal in the map', () => {
    // Every magnitude comes off `deriveUniforms`. The one call is the only law expression here.
    expect((PACK_CODE.match(/deriveUniforms\s*\(/g) || []).length).toBe(1);
    const body = PACK_CODE.slice(PACK_CODE.indexOf('const drivers = {'), PACK_CODE.indexOf('const meta = {'));
    // ⛔ NUMERIC-LITERAL FENCE over the driver map: there must be none at all.
    expect(body.match(/(?<![\w.$])\d[\d.eE+-]*/g)).toBeNull();
    // ...and no operator that could shape a value on the way out.
    expect(body).not.toMatch(/[*/+]|Math\./);
  });

  it('⛔ it emits the colour through `.slice()` — and the hazard that guards is NOT reachable today', () => {
    // ⚠⚠ THIS ASSERTION IS A SOURCE-TEXT ONE ON PURPOSE, AND THE FIRST VERSION OF IT WAS DEAD.
    // The value form — `expect(drivers.uFrostAlbedo).not.toBe(deriveUniforms(cond).frostAlbedo)` —
    // PASSES WHETHER OR NOT THE `.slice()` IS THERE, because the test's own `deriveUniforms` call
    // builds a second bundle with a second array, so the two objects were never going to be
    // identical. EXECUTED: removing the `.slice()` from the pack reddened NOTHING. Measured, not
    // reasoned — `frostAlbedo` is a fresh array literal per call
    // (src/worldengine/base/labCore.js builds it inside `deriveUniforms`), so no two bodies can
    // share one today and there is no value-level control to write.
    // ⛔ THE GUARD IS KEPT ANYWAY and this is what fences it: the array's provenance is the
    // BUNDLE's to change, not this pack's, and the day `deriveUniforms` returns a frozen module
    // constant instead, `target.set(...v)` at
    // src/worldengine/port/writePackUniforms.js:280 `      if (target && typeof target.set === 'function') target.set(...v);` would be reading a shared
    // object. Stating the reachability honestly beats shipping a green assertion that tests nothing.
    expect(PACK_CODE).toMatch(/uFrostAlbedo:\s*u\.frostAlbedo\.slice\(\)/);
    // ...and the VALUE is still the bundle's, which is the part that is testable.
    const b = SOLID[0];
    expect(packFor(b).drivers.uFrostAlbedo).toEqual(deriveUniforms(b.cond).frostAlbedo);
  });

  it('⛔ three-free, entropy-free: no renderer, no clock, no random in the closure', () => {
    expect(PACK_CODE_STR).not.toMatch(/from\s+'three'|Math\.random|Date\.now|performance\.now/);
    for (const m of PACK_CODE_STR.matchAll(/from\s+'([^']+)'/g)) {
      expect(m[1], 'the import closure is base/ + port/ only').toMatch(/^\.\.\/(base|port)\//);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D — the wire reaches a real lab material, and it DIFFERENTIATES
// ═════════════════════════════════════════════════════════════════════════════
describe('D — the wire reaches a real lab material and the bodies stop being identical', () => {
  it('⭐⭐ all fourteen leave the factory default behind — measured over the corpus', () => {
    const factory = buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms;
    const before = {}; for (const n of SOLID_FEATURES_UNIFORMS) before[n] = readU(factory, n);
    const cols = {}; for (const n of SOLID_FEATURES_UNIFORMS) cols[n] = [];
    for (const b of [...SOLID, ...MOONS]) {
      const uni = composeOnto(b).material.uniforms;
      for (const n of SOLID_FEATURES_UNIFORMS) cols[n].push(readU(uni, n));
    }
    // ⛔ EVERY name must reach at least two values across the pooled corpus. Before this pack every
    // one of them was 1 distinct on every body, because nothing wrote any of them.
    for (const n of SOLID_FEATURES_UNIFORMS) {
      expect(distinct(cols[n]), `${n} must vary across the corpus`).toBeGreaterThan(1);
    }
    // ...and it is not one body doing all the work: at least one name must be near-per-body.
    expect(Math.max(...SOLID_FEATURES_UNIFORMS.map((n) => distinct(cols[n]))))
      .toBeGreaterThan(cols.uVolcanismStrength.length * 0.5);
  });

  it('⭐ THE MOON HALF, SEPARATELY — and the three that stay flat there are named, not hidden', () => {
    const cols = {}; for (const n of SOLID_FEATURES_UNIFORMS) cols[n] = [];
    for (const b of MOONS) {
      const uni = composeOnto(b).material.uniforms;
      for (const n of SOLID_FEATURES_UNIFORMS) cols[n].push(readU(uni, n));
    }
    // ⛔ THE THREE THAT ARE FLAT ON MOONS AND WHY — asserted so the leg report's caption cannot
    // drift from the code. `condition.habitability` is undefined on every plain moon;
    // every plain moon reads tidally locked; a plain-moon record carries no tilt key at all.
    const FLAT_ON_MOONS = ['uShieldStratoMix', 'uFrostLocked', 'uFrostLatitudeBias'];
    for (const n of FLAT_ON_MOONS) expect(distinct(cols[n]), `${n} is flat on the moon half`).toBe(1);
    for (const n of SOLID_FEATURES_UNIFORMS) {
      if (FLAT_ON_MOONS.includes(n)) continue;
      expect(distinct(cols[n]), `${n} must differentiate the moon half`).toBeGreaterThan(1);
    }
    // ⭐ AND THE HEADLINE: two of them are near-per-moon, which is what ends "these are all identical".
    expect(distinct(cols.uChaosRaftJitter)).toBeGreaterThan(MOONS.length * 0.9);
    expect(distinct(cols.uGlacialFlowVigor)).toBeGreaterThan(MOONS.length * 0.9);
  });

  it('⛔ F37 AURORAE CONTRIBUTES NOTHING ON ANY MOON — and that is not this pack’s to fix', () => {
    // Already wired at B3 leg 1 by `solidOptics`, whose predicate claims every plain moon. The zero
    // is upstream of every wire: labCore multiplies the field by `hasAtmo`, and a plain moon's
    // condition carries a null atmosphere. Asserted here so a future reader does not read the moon
    // UAT as evidence that the aurora wire is broken.
    const vals = MOONS.map((b) => deriveUniforms(b.cond).auroraIntensity);
    expect(distinct(vals)).toBe(1);
    expect(vals.filter((v) => v !== 0).length).toBe(0);
    expect(MOONS.filter((b) => b.cond.atmosphere == null).length).toBe(MOONS.length);
    // ...and it is NOT flat on planets, so the assertion above is about the population and not a
    // dead wire: this is the control that separates the two readings.
    expect(distinct(SOLID.map((b) => deriveUniforms(b.cond).auroraIntensity))).toBeGreaterThan(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E — the pack obeys the Step-5a contract and stays inside its scope
// ═════════════════════════════════════════════════════════════════════════════
describe('E — the Step-5a contract, and the scope', () => {
  it('⭐ the emitted name set is EXACTLY the published contract set, by MEMBERSHIP', () => {
    for (const b of [...SOLID.slice(0, 30), ...MOONS.slice(0, 30)]) {
      expect(Object.keys(packFor(b).drivers).sort()).toEqual([...SOLID_FEATURES_UNIFORMS].sort());
    }
    expect(Object.isFrozen(SOLID_FEATURES_UNIFORMS)).toBe(true);
  });

  it('⛔ it returns an explicit empty attributes map, and a populated meta', () => {
    const res = packFor(SOLID[0]);
    expect(res.attributes).toEqual({});
    expect(Object.keys(res.meta).length).toBeGreaterThan(5);
    expect(res.meta.compositionClass).toBe(compositionClass(SOLID[0].cond));
  });

  it('⛔ a missing display policy is refused eagerly, even though no driver is km-shaped', () => {
    expect(() => solidFeaturesPack(SOLID[0].cond, { gates: gatesFor(SOLID_FEATURES_ENTRY) })).toThrow(PackContractError);
    expect(() => solidFeaturesPack(null, ctxFor(SOLID[0]))).toThrow(PackContractError);
  });

  it('⛔ NO km-shaped driver — the policy seam is vacuous here and says so', () => {
    for (const d of Object.values(packFor(SOLID[0]).drivers)) {
      if (isPackDriver(d)) expect(d.featureSizeKm).toBeUndefined();
    }
    expect(PACK_CODE).not.toMatch(/sizeKm\s*\(/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F — the entry is registry-ready and collision-free
// ═════════════════════════════════════════════════════════════════════════════
describe('F — the entry is registered, and its collision guard is LIVE', () => {
  it('⭐ it IS registered, and it is THE EXPORTED ENTRY rather than a retyped copy', () => {
    const entry = PACKS.find((e) => e.name === 'solidFeatures');
    expect(entry, 'solidFeatures must be registered').toBeTruthy();
    expect(entry).toBe(SOLID_FEATURES_ENTRY);
    expect(entry.pack).toBe(solidFeaturesPack);
    expect(Object.isFrozen(SOLID_FEATURES_ENTRY)).toBe(true);
    expect(PACKS[0].name).toBe('giantDeck');   // index 0 is what four positional assertions read
    expect(PACKS.indexOf(SOLID_FEATURES_ENTRY)).toBeGreaterThan(PACKS.findIndex((e) => e.name === 'rockySurface'));
  });

  it('⛔ its name set is disjoint from every pack that can co-apply — BY LOOKUP', () => {
    const mine = new Set(SOLID_FEATURES_UNIFORMS);
    for (const [label, other] of [['rockySurface', ROCKY_SURFACE_UNIFORMS], ['solidOptics', SOLID_OPTICS_UNIFORMS], ['craterDeck', CRATER_DECK_UNIFORMS]]) {
      expect([...mine].filter((n) => other.includes(n)), `overlap with ${label}`).toEqual([]);
    }
  });

  it('⭐ applyDriverPacks composes all three non-gas packs onto one body without throwing', () => {
    const b = SOLID[0];
    const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius ?? 1 });
    const res = applyDriverPacks(built.material, b.cond, labPackCtx(b.d, b.cond, undefined));
    expect(res.applied).toContain('solidFeatures');
    for (const n of SOLID_FEATURES_UNIFORMS) expect(res.uniformsWritten, n).toContain(n);
  });

  it('⭐ and on a VENUS body, where giantDeck co-applies too since leg 2', () => {
    const venus = [...SOLID, ...MOONS].find((x) => selectPacks(x.cond).some((e) => e.name === 'giantDeck'));
    expect(venus, 'the corpus must contain a body claimed by both the band deck and this one').toBeTruthy();
    const built = buildLabPlanetMaterial({ bodyRadius: venus.d.radius ?? 1 });
    const res = applyDriverPacks(built.material, venus.cond, labPackCtx(venus.d, venus.cond, undefined));
    expect(res.applied).toEqual(expect.arrayContaining(['giantDeck', 'rockySurface', 'solidOptics', 'solidFeatures']));
  });

  it('⛔ a gas body is refused by the entry and by the real registry alike', () => {
    for (const b of GAS.slice(0, 20)) {
      expect(SOLID_FEATURES_ENTRY.applies(b.cond)).toBe(false);
      expect(selectPacks(b.cond).map((e) => e.name)).not.toContain('solidFeatures');
    }
    expect(GAS.length).toBeGreaterThan(20);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G — PER-FEATURE WIRES. One block each: remove the wire, THIS block reds.
// ═════════════════════════════════════════════════════════════════════════════
describe('G — per-feature wires, each with its own fence', () => {
  const liveBody = (field) => [...SOLID, ...MOONS].find((b) => deriveUniforms(b.cond)[field] > 0);

  const featureCase = (label, names, master, gate) => {
    it(`⭐ ${label} — the pack writes ${names.join(', ')} and the master reaches the material`, () => {
      // 1. the contract set names them (an omission from the SET reds here)
      for (const n of names) expect(SOLID_FEATURES_UNIFORMS, n).toContain(n);
      // 2. the pack really emits them (an omission from the driver map reds here)
      const drivers = packFor(SOLID[0]).drivers;
      for (const n of names) expect(Object.keys(drivers), n).toContain(n);
      // 3. and the master carries a NON-ZERO value onto a real material on a body where the law
      //    fires — which is the assertion a deleted wire cannot satisfy.
      const b = liveBody(master.field);
      expect(b, `${label}: the corpus must contain a body whose ${master.field} fires`).toBeTruthy();
      const uni = composeOnto(b).material.uniforms;
      expect(readU(uni, master.name), `${label}: ${master.name} must reach the material`)
        .toBe(deriveUniforms(b.cond)[master.field]);
      expect(readU(uni, master.name)).toBeGreaterThan(0);
      // 4. and its gate is the lab's, not an invented one
      if (gate) expect(drivers[master.name].gate).toBe(gate);
    });
  };

  featureCase('F7 volcanic edifices', ['uVolcanismStrength', 'uEdificeMaxHeight', 'uShieldStratoMix'],
    { name: 'uVolcanismStrength', field: 'volcanismStrength' }, EDIFICE_GATE);
  featureCase('F9 chaos + F10 ridged icy (ONE shared master)', ['uCryoActivity', 'uChaosRaftJitter'],
    { name: 'uCryoActivity', field: 'cryoActivity' }, null);
  featureCase('F23 snowline / frost', ['uFrostMaxCoverage', 'uFrostCondensationT', 'uFrostLatitudeBias', 'uFrostAlbedo', 'uPlanetTempEq', 'uFrostLocked'],
    { name: 'uFrostMaxCoverage', field: 'frostMaxCoverage' }, FROST_GATE);
  featureCase('F22 polar caps (PLD)', ['uPldStrength'],
    { name: 'uPldStrength', field: 'pldStrength' }, FROST_GATE);
  featureCase('F17 glacial landforms', ['uGlacialStrength', 'uGlacialFlowVigor'],
    { name: 'uGlacialStrength', field: 'glacialStrength' }, GLACIAL_GATE);

  it('⛔ F9 and F10 share ONE master and this pack writes it once — not two spellings', () => {
    // The lab says so at src/worldengine/shaders/uniforms.js's F9 and F10 headers. Two writers of
    // one gate would be a collision; two SPELLINGS of one gate would be a silent second law.
    expect(SOLID_FEATURES_UNIFORMS.filter((n) => /Cryo(Activity)?$/.test(n))).toEqual(['uCryoActivity']);
    expect(Object.keys(packFor(SOLID[0]).drivers).filter((n) => n === 'uCryoActivity').length).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H — ROOT-0 fix 5 (the obliquity rename) and the F4 rift forward
// ═════════════════════════════════════════════════════════════════════════════
describe('H — the two seam repairs this leg needed', () => {
  it('⭐⭐ ROOT-0 fix 5 — the reader learns the CONDITION spelling without forgetting the LAB one', () => {
    // The lab preset spelling still WINS where both exist, so no lab preset moves.
    expect(deriveUniforms({ axialTilt: 45, axialTiltDeg: 90 }).frostLatitudeBias).toBeCloseTo(0.5, 12);
    // The condition spelling is read when the lab one is absent — this is the whole fix.
    expect(deriveUniforms({ axialTiltDeg: 45 }).frostLatitudeBias).toBeCloseTo(0.5, 12);
    // Neither present ⇒ 0, unchanged.
    expect(deriveUniforms({}).frostLatitudeBias).toBe(0);
    // ⛔ AND IT IS NOT VACUOUS ON THE REAL CORPUS: every generated planet carries `axialTiltDeg`
    // and NO generated planet carries `axialTilt`, so before the fix this law was hard 0 on all of
    // them. That is the measurement, made against the shipped adapter rather than a fixture.
    expect(SOLID.every((b) => typeof b.cond.axialTiltDeg === 'number')).toBe(true);
    expect(SOLID.every((b) => b.cond.axialTilt === undefined)).toBe(true);
    expect(distinct(SOLID.map((b) => deriveUniforms(b.cond).frostLatitudeBias))).toBeGreaterThan(1);
  });

  it('⭐ F4’s rift pair is FORWARDED ON ctx from the front-end seed, and it is per-body', () => {
    // Forwarded only — no pack consumes it yet. The point is that the game answers the SEED, which
    // a condition vector cannot: `condition.seed` is undefined on every body.
    for (const b of [...SOLID.slice(0, 20), ...MOONS.slice(0, 20)]) expect(b.cond.seed).toBeUndefined();
    const ctxs = [...SOLID.slice(0, 40)].map((b) => labPackCtx(b.d, b.cond, undefined));
    for (const c of ctxs) {
      expect(c.chasmaCount).toBeGreaterThanOrEqual(1);
      expect(c.chasmaCount).toBeLessThanOrEqual(3);
      expect(c.chasmaAxes).toHaveLength(3);
    }
    // ⛔ THE CONTROL: per-body, not one galaxy-wide rift system. Deriving from the condition instead
    // would give every body the seed-0 answer, which this asserts against directly.
    expect(distinct(ctxs.map((c) => c.chasmaAxes))).toBeGreaterThan(ctxs.length * 0.9);
    expect(distinct(ctxs.map((c) => c.chasmaAxes))).not.toBe(1);
    expect(JSON.stringify(ctxs[0].chasmaAxes)).not.toBe(JSON.stringify(chasmaRiftsFor(0).chasmaAxes));
  });

  it('⭐ chasmaRiftsFor is the ONE expression: deriveUniforms returns exactly what it returns', () => {
    for (const s of [0, 1, 7, 42, -13, 1234567]) {
      const u = deriveUniforms({ seed: s });
      const r = chasmaRiftsFor(s);
      expect(u.chasmaCount).toBe(r.chasmaCount);
      expect(u.chasmaAxes).toEqual(r.chasmaAxes);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// §H — THE TWO FRONT-END HELPERS. Added 2026-08-22 for the lab's import-back (workstream AC5).
//
// ⭐ WHY A PACK NEEDS TWO HELPERS AND NOT ONE CALL, read off the only import-back that has ever
// worked (`giantDeck`, world-engine-lab.html:188): the lab's per-frame writer reads `state`, and every
// one of those fields is a live lil-gui slider. Writing pack output STRAIGHT to uniforms would take
// the lab's authoring surface out of its own loop. So the pack result is MIRRORED into `state`, and
// only the drivers the frame loop does not own go direct.
//
// ⛔⛔ THE MIRROR MUST BE UNGATED, AND THIS IS THE ASSERTION THAT MATTERS. The lab re-applies its own
// ✓ checkbox at the per-frame writer (`state.edificesEnabled ? state.volcanismStrength : 0.0`). If
// the mirror ALSO resolved the gate, the decision would be applied twice — a body whose feature is
// enabled would still read zero the moment the pack's gate map disagreed, and nothing would throw.
// world-engine-lab.html:1749 names this hazard by name for pack #1.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('§H — the lab mirror and its complement', () => {
  const B = SOLID[0];

  it('mirrors EVERY emitted driver into a lab state field — none is silently dropped', () => {
    const mirrored = solidFeaturesLabState(packFor(B));
    const missing = SOLID_FEATURES_UNIFORMS.filter((u) => !(SOLID_FEATURES_LAB_BINDING[u] in mirrored));
    expect(missing, `these drivers reach no lab state field: ${missing.join(', ')}`).toEqual([]);
  });

  it('the mirror is UNGATED — a gated-OFF pack result still mirrors the live value', () => {
    // The whole point. Build the pack with every gate SHUT, mirror it, and demand the masters still
    // carry their real values — because the lab's own checkbox, not the pack's gate map, is what
    // switches these features in the lab.
    const SHUT = Object.freeze({ edifices: false, chaos: false, frost: false, glacial: false });
    const open = solidFeaturesLabState(packFor(B));
    const closed = solidFeaturesLabState(packFor(B, SHUT));
    expect(closed).toEqual(open);
    expect(closed.volcanismStrength).toBe(open.volcanismStrength);
  });

  it('the direct complement is EMPTY — all fourteen mirror, and that is a result, not a gap', () => {
    // Derived by SUBTRACTION from the binding, exactly as giantDeckDirectDrivers is, so a driver
    // added to the pack and forgotten here defaults to being WRITTEN rather than silently skipped.
    // Today the answer is {}, and asserting it keeps the day it stops being {} loud.
    expect(solidFeaturesDirectDrivers(packFor(B))).toEqual({});
  });

  it('the binding covers the emitted set EXACTLY — no stale key, no missing one', () => {
    expect(Object.keys(SOLID_FEATURES_LAB_BINDING).sort()).toEqual([...SOLID_FEATURES_UNIFORMS].sort());
  });

  it('CONTROL: the mirror is non-vacuous — it carries REAL numbers, not a shape of zeros', () => {
    // A mirror that returned every field as 0 would satisfy every assertion above. This demands the
    // masters actually vary across the population, which is the only thing that proves the wire.
    const seen = new Map();
    for (const b of SOLID) {
      const m = solidFeaturesLabState(packFor(b));
      for (const [k, v] of Object.entries(m)) {
        if (Array.isArray(v)) continue;
        if (!seen.has(k)) seen.set(k, new Set());
        seen.get(k).add(v);
      }
    }
    const constant = [...seen.entries()].filter(([, s]) => s.size < 2).map(([k]) => k);
    expect(seen.size).toBeGreaterThan(8);
    expect(constant.length, `these mirrored fields never vary across the population: ${constant.join(', ')}`)
      .toBeLessThan(seen.size);
  });
});
