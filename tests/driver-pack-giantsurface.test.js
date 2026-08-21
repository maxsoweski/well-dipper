// tests/driver-pack-giantsurface.test.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #8 — `giantSurface`. Ledger rows P-11 (gas half), P-12 and P-13.
//
// ⭐ WHAT THIS SUITE IS FOR, IN ONE LINE: the pack's whole claim is that it is a WIRE — every one of
// its thirteen drivers is a forward of a producer the game already calls on the same body — so the
// gates below are equality-against-the-producer, not equality-against-a-recorded-number. A
// transcription would satisfy a recorded number today and break the first time the law moved.
//
// ⛔ EVERY POPULATION GATE ASSERTS MEMBERSHIP, NEVER A COUNT. Step 4 measured that a
// count-preserving permutation is byte-identical to every instrument this program owns, so a
// `length === 13` gate would pass a commit that swapped `uTermWidth` for `uLimbStrength`.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { buildLabPlanetMaterial } from '../src/rendering/LabPlanetMaterial.js';
import { writePackUniforms, isPackDriver, PackContractError } from '../src/worldengine/port/writePackUniforms.js';
import { PACKS, gatesFor, selectPacks } from '../src/worldengine/drivers/index.js';
import { ROCKY_SURFACE_ENTRY, ROCKY_SURFACE_UNIFORMS } from '../src/worldengine/drivers/rockySurface.js';
import { SOLID_OPTICS_UNIFORMS, TERMINATOR_GATE } from '../src/worldengine/drivers/solidOptics.js';
import { LIMB_UNIFORMS } from '../src/worldengine/drivers/limbDeck.js';
import { CRATER_DECK_UNIFORMS } from '../src/worldengine/drivers/craterDeck.js';
import { hasKmShapedDriver } from '../src/worldengine/drivers/giantDeck.js';
import { labPackCtx } from '../src/objects/Planet.js';
import {
  giantSurfacePack, GIANT_SURFACE_ENTRY, GIANT_SURFACE_UNIFORMS,
  surfacePaletteBlock, offsetDriverBlock,
} from '../src/worldengine/drivers/giantSurface.js';
import { terminatorOpticsOf } from '../src/worldengine/base/terminatorOptics.js';
import { surfacePaletteOf, icenessOf, biosphereOf, BIO_PIGMENT } from '../src/worldengine/base/surfaceMaterial.js';
import { applyAlbedoTransfer } from '../src/worldengine/display/albedoTransfer.js';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const PACK_CODE = stripCommentsPreservingOffsets(read('src/worldengine/drivers/giantSurface.js'), {
  blankLiteralText: true,
});
// ⛔ AND A SECOND VIEW, STRINGS INTACT, FOR THE ANTI-TRANSCRIPTION FENCE ALONE — `blankLiteralText`
// is what opens that fence's hole, because `Number('0.15')` reads as `Number('    ')` and walks past.
const PACK_CODE_STR = stripCommentsPreservingOffsets(read('src/worldengine/drivers/giantSurface.js'));

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
const ctxFor = (b, gates = gatesFor(GIANT_SURFACE_ENTRY)) => ({ ...labPackCtx(b.d, b.cond), gates });
const packFor = (b, gates) => giantSurfacePack(b.cond, ctxFor(b, gates));
// ⭐ BOTH CONTAINERS, ON PURPOSE. The lab material holds a `THREE.Color` where the game holds a
// `THREE.Vector3` for the same GLSL `vec3` slot — the split that kept six colour names "diverging"
// in the parity ledger until 2026-08-21. A helper that unwrapped only one of them would compare a
// live object against an array and fail for a reason that has nothing to do with the wire.
const comps = (v) => (v && typeof v === 'object'
  ? ('x' in v ? [v.x, v.y, v.z] : ('r' in v ? [v.r, v.g, v.b] : v)) : v);

describe('A — the registration: a complement predicate, and what that buys', () => {
  it('the population is non-trivial in BOTH directions, or every gate below is vacuous', () => {
    expect(GAS.length).toBeGreaterThan(20);
    expect(SOLID.length).toBeGreaterThan(20);
  });

  it('⭐ the predicate is the EXACT COMPLEMENT of rockySurface\'s, by MEMBERSHIP over a real population', () => {
    // ⛔ NOT BY COMPARING THE TWO `applies` SOURCE LINES. A different non-gas predicate —
    // `!!condition.atmosphere`, say — reads correct and silently leaves a subset unclaimed. Set
    // membership over generated bodies is the only check that sees that.
    const mine = new Set(GENERATED.filter((b) => GIANT_SURFACE_ENTRY.applies(b.cond) === true).map((b) => b.id));
    const theirs = new Set(GENERATED.filter((b) => ROCKY_SURFACE_ENTRY.applies(b.cond) === true).map((b) => b.id));
    for (const b of GENERATED) {
      expect(mine.has(b.id) !== theirs.has(b.id), `${b.id} is claimed by both or by neither`).toBe(true);
    }
    expect([...mine].sort()).toEqual(GAS.map((b) => b.id).sort());
  });

  it('⚠ it must return the BOOLEAN — a truthy non-boolean registers and renders nothing', () => {
    // Both admission sites compare with `=== true`, so a truthy non-boolean reports as `skipped`,
    // renders nothing and throws nothing. This is a gate against a future rewrite, not a cast.
    for (const b of GENERATED.slice(0, 40)) {
      expect(typeof GIANT_SURFACE_ENTRY.applies(b.cond)).toBe('boolean');
    }
  });

  it('⭐⭐ REGISTRATION IS POPULATION-NEUTRAL: it moves no body between materials', () => {
    // Admission runs through `packs.length > 0`, so the only way a registration moves a body is by
    // being the FIRST pack to claim it. Every gas body is already claimed by giantDeck/limbDeck/
    // polarDeck/craterDeck, measured here rather than argued from the four `applies` lines.
    for (const b of GAS) {
      const without = selectPacks(b.cond).map((e) => e.name).filter((n) => n !== 'giantSurface');
      expect(without.length, `${b.id} would be newly admitted by this pack`).toBeGreaterThan(0);
    }
  });

  it('it IS the exported entry in PACKS, not a retyped copy', () => {
    const entry = PACKS.find((e) => e.name === 'giantSurface');
    expect(entry).toBe(GIANT_SURFACE_ENTRY);
    expect(entry.gates).toEqual([TERMINATOR_GATE]);
  });

  it('⛔ the emitted set is EXACTLY GIANT_SURFACE_UNIFORMS, by membership, on every gas body', () => {
    for (const b of GAS) {
      expect(Object.keys(packFor(b).drivers).sort(), b.id).toEqual([...GIANT_SURFACE_UNIFORMS].sort());
    }
  });

  it('⛔ COLLISION: disjoint by NAME from every pack that co-applies on a gas body', () => {
    const mine = new Set(GIANT_SURFACE_UNIFORMS);
    for (const other of [LIMB_UNIFORMS, CRATER_DECK_UNIFORMS]) {
      for (const n of other) expect(mine.has(n), `${n} collides`).toBe(false);
    }
    // …and the runtime guard is what actually protects a player, so it is exercised rather than
    // trusted: composing the whole array on a real gas body must not throw.
    for (const b of GAS.slice(0, 12)) {
      const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius });
      expect(() => {
        for (const e of selectPacks(b.cond)) {
          const ctx = { ...labPackCtx(b.d, b.cond), gates: gatesFor(e) };
          writePackUniforms(built.material.uniforms, e.pack(b.cond, ctx).drivers, ctx);
        }
      }, b.id).not.toThrow();
    }
  });

  it('⚠ the two SOLID packs share ten names with this pack, and the complement is what keeps that legal', () => {
    // ⭐ THE SHARED NAMES ARE THE POINT, NOT AN ACCIDENT: both packs spread the same two blocks, so a
    // name added to a block reaches both populations or neither. It is only safe because no body
    // ever runs both packs — asserted above by membership, not by reading predicates.
    const solidSide = new Set([...ROCKY_SURFACE_UNIFORMS, ...SOLID_OPTICS_UNIFORMS]);
    const shared = GIANT_SURFACE_UNIFORMS.filter((n) => solidSide.has(n));
    expect(shared.sort()).toEqual([
      'uBioGroundColor', 'uBioGroundCover', 'uCraterOffset', 'uCratonColor', 'uDetailOffset',
      'uFreshColor', 'uIcenessMix', 'uMacroOffset', 'uSedColor', 'uTermColor',
      'uTermStrength', 'uTermWidth', 'uWeatheredColor',
    ].sort());
  });
});

describe('B — every driver is a forward of a shared producer', () => {
  it('the terminator triple EQUALS terminatorOpticsOf on every gas body', () => {
    for (const b of GAS) {
      const { drivers } = packFor(b);
      const term = terminatorOpticsOf(b.cond);
      expect(drivers.uTermStrength.value, b.id).toBe(term.termStrength);
      expect(drivers.uTermWidth, b.id).toBe(term.termWidth);
      expect(drivers.uTermColor, b.id).toEqual(term.termColor);
    }
  });

  it('the palette and the two scalars EQUAL their shared producers, and every colour is a FRESH array', () => {
    for (const b of GAS) {
      const { drivers } = packFor(b);
      const sp = applyAlbedoTransfer(surfacePaletteOf(b.cond), { extra: { pigment: BIO_PIGMENT } });
      expect(drivers.uWeatheredColor, b.id).toEqual(sp.weathered);
      expect(drivers.uFreshColor, b.id).toEqual(sp.fresh);
      expect(drivers.uSedColor, b.id).toEqual(sp.sediment);
      expect(drivers.uCratonColor, b.id).toEqual(sp.craton);
      expect(drivers.uBioGroundColor, b.id).toEqual(sp.pigment);
      expect(drivers.uBioGroundCover, b.id).toBe(biosphereOf(b.cond));
      expect(drivers.uIcenessMix, b.id).toBe(icenessOf(b.cond));
    }
    // ⛔ THE `.slice()` GATE IS A SOURCE PIN, and it is here for the reason the rocky suite records
    // at length: `applyAlbedoTransfer` allocates fresh arrays on every call, so no assertion over
    // this pack's OUTPUT can see a deleted `.slice()`. The failure it prevents (one body's tint
    // following another's, through the writer's `target.set(...v)`) lives in another directory.
    for (const [n, k] of [['uWeatheredColor', 'weathered'], ['uFreshColor', 'fresh'],
      ['uSedColor', 'sediment'], ['uCratonColor', 'craton'], ['uBioGroundColor', 'pigment']]) {
      expect(PACK_CODE).toMatch(new RegExp(`${n}:\\s*sp\\.${k}\\.slice\\(\\)`));
    }
    expect(PACK_CODE).toMatch(/uTermColor:\s*term\.termColor\.slice\(\)/);
  });

  it('⭐⭐ the three offsets are FORWARDED VERBATIM and are NOT the caller\'s array object', () => {
    for (const b of GAS) {
      const ctx = ctxFor(b);
      const { drivers } = packFor(b);
      for (const [u, f] of [['uMacroOffset', 'macroOffset'], ['uDetailOffset', 'detailOffset'], ['uCraterOffset', 'craterOffset']]) {
        expect(drivers[u], `${b.id} ${u}`).toEqual(ctx[f]);
        // ⛔ EQUAL BUT NOT IDENTICAL. A front-end is free to build one offset object and reuse it
        // across bodies; handing the live array through is how one body's relief follows another's.
        expect(drivers[u], `${b.id} ${u} must be a copy`).not.toBe(ctx[f]);
      }
    }
  });

  it('⛔⛔ THE ROW\'S OWN DEFECT: two different bodies must NOT share a noise domain', () => {
    // P-13 is "every swapped gas body draws its base height field from the SAME three offsets". A
    // zero triple is a legal noise domain that renders a plausible planet, so this failure is
    // invisible on any single frame and on every algebraic gate — it needs two bodies side by side,
    // which is exactly what this assertion is.
    // ⛔ PER NAME, NEVER ON A COMPOSITE KEY — CORRECTED 2026-08-21 AFTER A MUTANT WALKED PAST IT.
    // This first checked one JSON key over all three offsets together, and a mutant that pinned
    // `uMacroOffset` to a constant while leaving the other two per-body STILL produced a distinct
    // composite on every body: the tuple varies, the macro domain does not. That is the collapse
    // this row names, surviving the assertion written to catch it. Each name is now its own bucket.
    for (const u of ['uMacroOffset', 'uDetailOffset', 'uCraterOffset']) {
      const seen = new Map();
      for (const b of GAS) {
        const v = packFor(b).drivers[u];
        const key = JSON.stringify(v);
        expect(seen.has(key), `${b.id} shares its ${u} domain with ${seen.get(key)}`).toBe(false);
        expect(v.some((q) => q !== 0), `${b.id} took the zero ${u} domain`).toBe(true);
        seen.set(key, b.id);
      }
      expect(seen.size, u).toBe(GAS.length);
    }
  });
});

describe('C — the refusals, each of which is a decision rather than a guard', () => {
  it('⭐ a MISSING offset throws rather than defaulting to the zero vector', () => {
    const b = GAS[0];
    for (const field of ['macroOffset', 'detailOffset', 'craterOffset']) {
      const ctx = ctxFor(b);
      delete ctx[field];
      expect(() => giantSurfacePack(b.cond, ctx), field).toThrow(PackContractError);
      // …and the message names the CALLING pack, not the shared block, so a front-end failure points
      // at the seam that failed rather than at the file both packs happen to import.
      expect(() => giantSurfacePack(b.cond, ctx)).toThrow(/giantSurfacePack: ctx\./);
    }
  });

  it('a THREE.Vector3-shaped offset is refused, because the pack tree may not name a renderer type', () => {
    const b = GAS[0];
    const ctx = { ...ctxFor(b), macroOffset: { x: 1, y: 2, z: 3 } };
    expect(() => giantSurfacePack(b.cond, ctx)).toThrow(/must be a 3-element array/);
  });

  it('a non-finite offset component is refused', () => {
    const b = GAS[0];
    for (const bad of [NaN, Infinity, '0']) {
      const ctx = { ...ctxFor(b), detailOffset: [0, bad, 0] };
      expect(() => giantSurfacePack(b.cond, ctx), String(bad)).toThrow(/is not a finite number/);
    }
  });

  it('a missing display policy is refused FIRST, even though no driver here is km-shaped', () => {
    const b = GAS[0];
    const ctx = ctxFor(b);
    delete ctx.displayRadiusEarth;
    expect(() => giantSurfacePack(b.cond, ctx)).toThrow(PackContractError);
  });

  it('a missing condition is refused', () => {
    expect(() => giantSurfacePack(null, ctxFor(GAS[0]))).toThrow(/condition vector is missing/);
  });
});

describe('D — scope: what this pack does NOT do, asserted rather than assumed', () => {
  it('⛔ EXACTLY ONE driver carries a gate, and it is the terminator MAGNITUDE', () => {
    // The lab's per-frame writer gates only `uTermStrength` and writes width and hue every frame
    // regardless of the checkbox. Gating the siblings would apply the decision twice and leave a
    // gated-off body carrying the previous body's band width behind a zero.
    for (const b of GAS.slice(0, 20)) {
      const gated = Object.entries(packFor(b).drivers)
        .filter(([, d]) => isPackDriver(d) && d.gate !== undefined).map(([n]) => n);
      expect(gated.sort(), b.id).toEqual(['uTermStrength']);
    }
  });

  it('the gate really switches, and it switches NOTHING ELSE', () => {
    const b = GAS[0];
    const on = packFor(b, { [TERMINATOR_GATE]: true }).drivers;
    const off = packFor(b, { [TERMINATOR_GATE]: false }).drivers;
    const resolve = (d) => (isPackDriver(d) ? d.value : d);
    for (const n of GIANT_SURFACE_UNIFORMS) {
      if (n === 'uTermStrength') continue;
      expect(JSON.stringify(resolve(off[n])), n).toBe(JSON.stringify(resolve(on[n])));
    }
    expect(resolve(on.uTermStrength)).toBeGreaterThan(0);
  });

  it('⚠ NO driver is km-shaped, so the display-policy seam is VACUOUS here — asserted, not assumed', () => {
    // The day a km-keyed uniform joins this pack the vacuity ends loudly instead of silently.
    for (const b of GAS.slice(0, 20)) expect(hasKmShapedDriver(packFor(b).drivers), b.id).toBe(false);
  });

  it('⛔ SEED-INDEPENDENT: this pack draws no entropy, which is why it asserts no macroSeed', () => {
    const b = GAS[0];
    const a1 = giantSurfacePack(b.cond, { ...ctxFor(b), macroSeed: 1 }).drivers;
    const a2 = giantSurfacePack(b.cond, { ...ctxFor(b), macroSeed: 987654 }).drivers;
    expect(JSON.stringify(a2)).toBe(JSON.stringify(a1));
  });

  it('⛔ THREE-FREE AND CALIBRATION-FREE: the pack owns no number of any law it forwards', () => {
    // The partner of B. A forward is only a forward if the pack cannot have retyped the law, and
    // several of these drivers are near-constant across the population, so the equality gates in B
    // are structurally blind to a transcription of them. This fence is what covers those.
    expect(PACK_CODE_STR).not.toMatch(/\bfrom\s+'three'/);
    expect(PACK_CODE_STR).not.toMatch(/Math\.random|Date\.now/);
    const literals = [...PACK_CODE_STR.matchAll(/(?<![\w.$])\d+(?:\.\d+)?/g)].map((m) => m[0]);
    // `3` is the offset triple's array-length guard and `0` its component index — the two numbers
    // this file genuinely owns. ⛔ 0.15 (TERM_STRENGTH), the palette endmembers and the crater
    // constants must NEVER appear: each is a forwarded law, and typing one here is the transcription
    // this fence exists to catch. `'3'` arrived from rockySurface with `offsetDriverBlock`.
    expect([...new Set(literals)].sort()).toEqual(['0', '3']);
  });
});

describe('E — the wire reaches a real lab material', () => {
  it('⭐ on a composed gas body the terminator lights and the noise domain is per-body', () => {
    let checked = 0;
    for (const b of GAS.slice(0, 12)) {
      const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius });
      // The factory defaults this pack exists to displace — asserted so the after-state means something.
      expect(built.material.uniforms.uTermStrength.value, 'the default really is off').toBe(0.0);
      expect(comps(built.material.uniforms.uMacroOffset.value)).toEqual([0, 0, 0]);
      const ctx = ctxFor(b);
      const res = giantSurfacePack(b.cond, ctx);
      writePackUniforms(built.material.uniforms, res.drivers, ctx);
      expect(built.material.uniforms.uTermStrength.value, b.id).toBeGreaterThan(0);
      expect(comps(built.material.uniforms.uMacroOffset.value), b.id).not.toEqual([0, 0, 0]);
      expect(comps(built.material.uniforms.uFreshColor.value), b.id).toEqual(res.drivers.uFreshColor);
      checked++;
    }
    expect(checked).toBeGreaterThan(8);
  });

  it('the two shared blocks are the SAME expression rockySurface spreads', () => {
    // ⛔ THE ANTI-SECOND-COPY GATE. Both packs import these; a re-typed copy in either would drift
    // silently because the two apply to disjoint populations and no single body can compare them.
    const rocky = stripCommentsPreservingOffsets(read('src/worldengine/drivers/rockySurface.js'));
    expect(rocky).toMatch(/import \{ surfacePaletteBlock, offsetDriverBlock \} from '\.\/giantSurface\.js'/);
    expect(rocky).toMatch(/\.\.\.paletteDrivers,/);
    expect(rocky).toMatch(/\.\.\.offsetDrivers,/);
    expect(rocky).not.toMatch(/applyAlbedoTransfer\(surfacePaletteOf/);
    // …and the blocks answer identically when called directly on the same body, which is the
    // property the two spreads inherit.
    const b = SOLID[0];
    const viaBlock = surfacePaletteBlock(b.cond).drivers;
    const direct = applyAlbedoTransfer(surfacePaletteOf(b.cond), { extra: { pigment: BIO_PIGMENT } });
    expect(viaBlock.uFreshColor).toEqual(direct.fresh);
    expect(offsetDriverBlock({ macroOffset: [1, 2, 3], detailOffset: [4, 5, 6], craterOffset: [7, 8, 9] }, 'x')
      .drivers.uMacroOffset).toEqual([1, 2, 3]);
  });
});
