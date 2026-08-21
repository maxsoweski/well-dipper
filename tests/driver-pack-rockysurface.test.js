// tests/driver-pack-rockysurface.test.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #4 — THE ROCKY SURFACE (PLAN §4 "Step 9"). Ledger rows P-12 and P-14.
//
// ⭐ THE EVIDENCE STANDARD THIS FILE IS WRITTEN TO (PLAN §11.3.3), inherited unchanged from
// tests/driver-pack-limbdeck.test.js and tests/driver-pack-polardeck.test.js. "The test passes" is
// not evidence that it CAN fail. Every gate below that could be vacuous carries an EXECUTED
// control: the thing the gate guards is broken in-test, the gate is shown to red, and the break is
// discarded. Controls are marked `[CONTROL]`.
//
// ⛔ THE PACK IS NOT REGISTERED, AND THAT IS THE STATE THIS FILE GATES.
// src/worldengine/drivers/index.js is untouched by this commit — registration is STEP 10, where it
// inverts tests/gas-body-lab-material.test.js:258 ("a solid body: nothing applies") rather than
// merely bumping a number. So everything below composes ROCKY_SURFACE_ENTRY DIRECTLY, and §F
// carries an OPEN-HOLE FENCE that goes red the day the entry lands — deliberately, in the shape
// tests/driver-pack-polardeck.test.js:575-580 records: the fence is INVERTED at registration, never
// deleted, so "the feature silently left again" always has something that reds.
//
// ⭐ THE IDIOM THIS COMMIT INTRODUCES, AND THE GATE THAT WATCHES IT. Packs #1-#3 emit not one
// km-shaped driver, so all three assert the display-policy seam is EMPTY. `uCraterScale` is the
// first driver in the program that actually crosses
// src/worldengine/port/writePackUniforms.js:219 `    const dispR = assertDisplayPolicy(ctx);`.
// §E therefore INVERTS that assertion: the km set is non-empty, the two front-end policies
// DISAGREE on it by a stated ratio, and the game arm is byte-identical to the number Planet.js
// ships today. A seam nobody crosses is a seam nobody has tested.
//
// ⛔ SEVEN THINGS THIS FILE DELIBERATELY DOES NOT ASSERT, AND THE READER MUST NOT INFER OTHERWISE.
//  1. It does not claim a crater or a palette LOOKS right. The gate is the PIPELINE, not the
//     picture (Max's 2026-08-09 ruling, carried from the limb suite). Appearance is the world
//     engine's law to improve, in bombardment.js / surfaceMaterial.js, not here.
//  2. It does not assert byte-identity of `uCraterScale` against the LAB. That is structurally
//     impossible: planet-lod-lab.html:5358 resolves the frequency at the REAL radius and then
//     applies a further display multiply, while every other km-keyed lab uniform resolves at the
//     display pseudo-radius alone. §E asserts a stated POLICY DIFFERENCE instead and says which
//     number is being kept.
//  3. It does not claim `uCraterComplexD` agrees with the lab. It must NOT: the lab pins it high
//     to force morphology ≡ 0, and src/worldengine/port/craterUniforms.js:153 refuses that value in
//     its own words. §C carries the disagreement as a [CONTROL] rather than hiding it.
//  4. It does not claim the production swap is what makes FAMILY 9's byte-identity hold. ⭐ THE SWAP
//     HAS LANDED — src/objects/Planet.js:1596 now reads `craterRelevanceOf(condition) > 0`, and the
//     three notes in this file that said otherwise were stale as written. §C measures what the swap
//     costs the cross-material gate: on solid PLANETS the two gates disagree on 26 bodies and NOT
//     ONE carries a non-zero density; on solid MOONS 17 disagree and 14 DO. See FAMILY 9b for why
//     that second number moves no rendered value, and for the shader fact that is the actual reason.
//  5. It does not pin the moon census. tools/moon-census.mjs exits 3 today and Instruments A/B/C
//     are red by design over a moon-formation window — every moon-keyed number below is therefore
//     a FLOOR with the 2026-08-19 measurement named beside it, never an equality.
//  6. It asserts nothing about `uMacroOffset`/`uDetailOffset`/`uCraterOffset` (ledger P-13),
//     `uDispDomainScale` (P-14's fifth name), `uNoiseScale` (P-10) or `uIcenessAlbedo`. All four
//     are declared non-ports in the pack header; their absence is asserted as a SCOPE FENCE in §E,
//     which is a statement about this pack and not a claim that those rows are closed.
//  7. It writes no prose superlative it did not measure. Every number in a comment below is from a
//     run recorded 2026-08-19 against the 24 systems `rocky-0…rocky-23`.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { craterUniformsFrom, CRATERS_OFF } from '../src/worldengine/port/craterUniforms.js';
import { craterRelevanceOf } from '../src/worldengine/base/bombardment.js';
import {
  surfacePaletteOf, icenessOf, biosphereOf, BIO_PIGMENT,
} from '../src/worldengine/base/surfaceMaterial.js';
import { applyAlbedoTransfer } from '../src/worldengine/display/albedoTransfer.js';
import { reliefEnvelope } from '../src/worldengine/base/labCore.js';
import {
  buildLabPlanetMaterial, updateLabPlanetMaterial, isLabPlanetMaterial, LAB_WORLD_LIGHT,
} from '../src/rendering/LabPlanetMaterial.js';
import { makeUniforms } from '../src/worldengine/shaders/uniforms.js';
import {
  writePackUniforms, resolveDriver, isPackDriver, scalar, sizeKm,
  PackContractError, gameDisplayRadiusEarth,
} from '../src/worldengine/port/writePackUniforms.js';
import { PACKS, gatesFor, GATE_POLICY_ALL_ON } from '../src/worldengine/drivers/index.js';
import { Planet, labPackCtx, setLabGasBodiesOverride, PLANET_SHADER_VARIANTS, shaderVariantFor } from '../src/objects/Planet.js';
import {
  rockySurfacePack, ROCKY_SURFACE_ENTRY, ROCKY_SURFACE_UNIFORMS,
  CRATER_GATE, EJECTA_GATE, C_CRATER, PERTURB_BASE,
} from '../src/worldengine/drivers/rockySurface.js';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// The pack's own source, COMMENTS AND STRING INTERIORS BLANKED. Every source assertion below runs
// on THIS view, for the reason the limb suite records in blood (driver-pack-limbdeck.test.js:79-85):
// a law re-quoted in a comment satisfies a pin that existed entirely to catch its deletion. This
// pack's header quotes ~64 source lines verbatim, several of them carrying the very constants the
// fence in §C forbids, so a raw-text scan would fail on its own documentation.
const PACK_CODE = stripCommentsPreservingOffsets(read('src/worldengine/drivers/rockySurface.js'), {
  blankLiteralText: true,
});

// ⛔ AND A SECOND VIEW, COMMENTS STRIPPED BUT STRING INTERIORS INTACT, FOR THE ANTI-TRANSCRIPTION
// FENCE ALONE — because `blankLiteralText` is what opens the fence's second hole. It blanks the
// interior of every string literal, so `Number('0.1706')` reads as `Number('        ')` and a
// transcribed constant walks past BOTH the blacklist and the literal allowlist. MEASURED
// 2026-08-19: the pack names no digit inside any string literal, so this view yields the identical
// literal set to the blanked one today — the option was buying nothing for this fence and costing
// it a bypass. It is kept for every OTHER source assertion in the file, where blanking a string is
// the right default; the header's rationale for it (the pack quotes constants in prose) is served
// by the COMMENT stripping, which both views do.
const PACK_CODE_STRINGS = stripCommentsPreservingOffsets(read('src/worldengine/drivers/rockySurface.js'));

// ⛔ THE LEADING-DOT ARM IS NOT OPTIONAL, AND ITS ABSENCE WAS THE FENCE'S FIRST HOLE. A negative
// lookbehind that includes `.` makes `.1706` produce NO match at any offset — offset 1 fails the
// dot, offsets 2+ fail the digit — so a transcription one character shorter than the forbidden form
// was invisible to the allowlist AND to the blacklist (`'0.1706'` is not a substring of `.1706`).
// MEASURED on the real file: `uEjectaLump: .6,` — a verbatim transcription of a constant FAMILY 8
// proved is CONSTANT across the population, and therefore invisible to FAMILY 7 — shipped all 36
// tests green; written `0.6` it reds. One deleted zero separated a live gate from a dead one.
const NUMERIC_LITERAL = /(?<![A-Za-z0-9_$.])(?:\d[\d_]*(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/g;
const literalsIn = (src) => [...new Set(src.match(NUMERIC_LITERAL) || [])];

// ─────────────────────────────────────────────────────────────────────────────
// THE POPULATION. Real generated systems through the real adapter — never Sol, which renders from
// NASA textures through a different renderer and carries no world-engine condition fields.
//
// ⭐ TWO POPULATIONS, NOT ONE, AND THE SPLIT IS THE MEASUREMENT. MEASURED 2026-08-19 over these 24
// seeds: 98 planets (66 non-gas — 59 rocky, 7 icy — and 32 gas) and 58 moons (ALL non-gas: 36
// rocky, 22 icy, ZERO gas). Of the 66 solid PLANETS only 3 come back with a resolvable crater band;
// of the 58 solid MOONS, 50 do. So the crater half of this suite gates on the MOONS and the
// palette/iceness/biosphere/relief half gates on everything — running the crater family on planets
// alone would have been three bodies wearing the word "population".
// ⚠ The moon corpus is LIVE AND MOVING (a moon-formation program has the moon window open and
// Instruments A/B/C are red by design over it), so every moon-derived number below is a floor.
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_SEEDS = Array.from({ length: 24 }, (_, i) => `rocky-${i}`);
const { PLANETS, MOONS } = (() => {
  const planets = []; const moons = [];
  for (const seed of SYSTEM_SEEDS) {
    const sys = StarSystemGenerator.generate(seed, null);
    for (const e of (sys.planets || [])) {
      const d = e.planetData;
      planets.push({ id: `${seed}#${d._ordinal}`, d, cond: conditionFromBody(d) });
      for (const md of (e.moons || [])) {
        moons.push({ id: `${seed}@${md._ordinal}`, d: md, cond: conditionFromBody(md) });
      }
    }
  }
  return { PLANETS: planets, MOONS: moons };
})();
const SOLID = PLANETS.filter((b) => compositionClass(b.cond) !== 'gas');
const GAS = PLANETS.filter((b) => compositionClass(b.cond) === 'gas');
const ICY = PLANETS.filter((b) => compositionClass(b.cond) === 'icy');
const SOLID_MOONS = MOONS.filter((b) => compositionClass(b.cond) !== 'gas');

// The legacy game material's crater gate, transcribed here ON PURPOSE — it is the thing under
// comparison, not a law this suite may import from the module it audits. src/objects/Planet.js:1423.
const LEGACY_ROCKY_TYPES = new Set(['rocky', 'ice', 'lava', 'ocean', 'terrestrial', 'venus', 'carbon']);

// ⭐ A HAND-BUILT ctx MUST ANSWER THE THREE OFFSET FIELDS (Step 9c) — the pack refuses to default
// them, because the default is the shared zero domain that P-13 exists to end. The fixture is
// deliberately NON-ZERO so that a contract-shaped test using it cannot quietly assert the very
// state the wire was built to remove. Real bodies get `labPackCtx`'s vectors via `ctxFor`.
const CTX_OFFSETS = Object.freeze({
  macroOffset: [11.5, -3.25, 7.75],
  detailOffset: [-2.5, 9.0, -14.25],
  craterOffset: [1.5, -0.75, 2.25],
});

const ALL_ON = gatesFor(ROCKY_SURFACE_ENTRY);              // { craters: true, ejecta: true }
const ALL_OFF = { [CRATER_GATE]: false, [EJECTA_GATE]: false };
/** The full game-side pack ctx for one body, with this entry's gates resolved by the shipped policy. */
const ctxFor = (b, gates = ALL_ON) => ({ ...labPackCtx(b.d, b.cond), gates });
const packFor = (b, gates) => rockySurfacePack(b.cond, ctxFor(b, gates));
/** One driver, resolved through the writer's own path rather than read raw off the pack. */
const valueOf = (b, name, gates = ALL_ON) => {
  const ctx = ctxFor(b, gates);
  return resolveDriver(name, rockySurfacePack(b.cond, ctx).drivers[name], ctx);
};
const fires = (b) => packFor(b).meta.cratersFired === true;
const FIRED_MOONS = SOLID_MOONS.filter(fires);
const UNFIRED_MOONS = SOLID_MOONS.filter((b) => !fires(b));
const FIRED_PLANETS = SOLID.filter(fires);

/** A lab material with this pack written onto it. Returns the material and the pack result. */
function composeOnto(b, gates = ALL_ON) {
  const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius });
  const ctx = ctxFor(b, gates);
  const res = rockySurfacePack(b.cond, ctx);
  writePackUniforms(built.material.uniforms, res.drivers, ctx);
  return { material: built.material, res, ctx };
}

/** Build a real game Planet at a chosen flag value — the legacy material is the flag-OFF one. */
function planetAt(d, enabled) {
  setLabGasBodiesOverride(enabled);
  try {
    const p = new Planet({ sunDirection: [1, 0, 0], ...d }, null);
    return { surface: p.surface, material: p.surface.material };
  } finally {
    setLabGasBodiesOverride(null);
  }
}

// ⛔ COMPONENT-WISE, ALWAYS. The ledger's own `encodeValue`
// (tests/material-parity-list.test.js:265-269) branches on `'x' in v` before `'r' in v`, so a
// THREE.Vector3 (the legacy slot) and a THREE.Color (the lab slot) holding IDENTICAL components
// encode differently. Comparing by encoding reports a false divergence, and the last time that
// happened someone hunted a `uLimbColor` colour bug that did not exist.
const comps = (v) => (Array.isArray(v) ? v.slice() : ('x' in v ? [v.x, v.y, v.z] : [v.r, v.g, v.b]));

beforeEach(() => { setLabGasBodiesOverride(null); });
afterEach(() => { setLabGasBodiesOverride(null); });

// ═════════════════════════════════════════════════════════════════════════════
// §A — THE PREDICATE. It decides the POPULATION rather than a pixel, and its wrong answer is
// silent — no throw, no red test, just a class of body that quietly changed material.
// ═════════════════════════════════════════════════════════════════════════════
describe('A — the predicate admits exactly the non-gas class', () => {
  it('FAMILY 1 · admits EXACTLY the set `compositionClass !== gas` admits — membership, not a count', () => {
    // Membership, because Step 4 measured that a count-preserving permutation is byte-identical to
    // every instrument this program owns. MEASURED 2026-08-19: 66 of 98 planets and 58 of 58 moons.
    const all = [...PLANETS, ...MOONS];
    const mine = all.filter((b) => ROCKY_SURFACE_ENTRY.applies(b.cond) === true).map((b) => b.id);
    const theirs = all.filter((b) => compositionClass(b.cond) !== 'gas').map((b) => b.id);
    expect(mine).toEqual(theirs);
    expect(mine.length).toBe(SOLID.length + SOLID_MOONS.length);
    expect(SOLID.length).toBeGreaterThan(30);            // measured 66 — a real population, not 1
    expect(SOLID_MOONS.length).toBeGreaterThan(20);      // measured 58

    // ...and it is the EXACT COMPLEMENT of the three shipped predicates, which is what makes
    // "registering this entry cannot move a body off the pack that already claims it" a measured
    // statement rather than a reading of four source lines.
    const giant = PACKS.find((e) => e.name === 'giantDeck');
    expect(giant, 'the shipped gas pack must exist to compare against').toBeTruthy();
    const theirGas = PLANETS.filter((b) => giant.applies(b.cond) === true).map((b) => b.id);
    const myPlanets = PLANETS.filter((b) => ROCKY_SURFACE_ENTRY.applies(b.cond) === true).map((b) => b.id);
    expect(theirGas.length).toBe(GAS.length);
    expect(myPlanets.filter((id) => theirGas.includes(id))).toEqual([]);
    expect(myPlanets.length + theirGas.length).toBe(PLANETS.length);

    // It must return the BOOLEAN. src/worldengine/drivers/index.js:159 and :203 both compare with
    // `=== true`, so a truthy non-boolean registers, reports as `skipped`, renders nothing, and
    // throws nothing.
    for (const b of [SOLID[0], GAS[0], SOLID_MOONS[0]]) {
      expect(typeof ROCKY_SURFACE_ENTRY.applies(b.cond)).toBe('boolean');
    }
  });

  it('FAMILY 2 · [CONTROL] the counterfactual `=== rocky` predicate UNDER-admits, and by how much', () => {
    // ⭐ THIS IS THE CONTROL THAT MAKES THE GATE ABOVE MEAN SOMETHING, and it is the blueprint's
    // ranked risk 4: the pack is NAMED for rock and every uniform in it is a rocky-surface uniform,
    // so `=== 'rocky'` is the natural predicate to write. It is also the one that caps Step 10's own
    // ">= 95% of plain moons render a non-zero crater density" gate at a number it cannot reach —
    // TWO COMMITS LATER, with every test in this file green.
    // MEASURED 2026-08-19: 7 of 66 solid planets and 22 of 58 moons are `icy`, so `=== 'rocky'`
    // claims 89.4% of solid planets and 62.1% of moons. Not a near miss.
    const all = [...PLANETS, ...MOONS];
    const right = all.filter((b) => ROCKY_SURFACE_ENTRY.applies(b.cond) === true);
    const wrong = all.filter((b) => compositionClass(b.cond) === 'rocky');
    expect(wrong.length).toBeLessThan(right.length);
    const lostMoons = SOLID_MOONS.filter((b) => compositionClass(b.cond) !== 'rocky');
    expect(lostMoons.length).toBeGreaterThan(10);        // measured 22 of 58 — a third of the class
    expect(lostMoons.length / SOLID_MOONS.length).toBeGreaterThan(0.25);
    // ...and the loss is not harmless: those bodies DO derive a crater band and a palette, so the
    // wrong predicate drops a rendering answer the pack already has.
    const icyFiring = lostMoons.filter(fires);
    expect(icyFiring.length, 'the under-admitted class really does have craters to draw').toBeGreaterThan(5);
  });

  it('FAMILY 2b · [CONTROL] the counterfactual `type`-label predicate OVER-admits, quantified', () => {
    // The other natural mistake, and the one the game's legacy material made at
    // src/objects/Planet.js:1596 until the Step 9b swap replaced it. MEASURED 2026-08-19: `ROCKY_TYPES.has(d.type)` admits 77 planets
    // where the condition admits 66 — 11 bodies admitted by the label and refused by the condition,
    // 0 the other way. src/worldengine/drivers/index.js:20-31 records the same disagreement on Sol,
    // where the two sets are DISJOINT.
    const byLabel = PLANETS.filter((b) => LEGACY_ROCKY_TYPES.has(b.d.type)).map((b) => b.id);
    const byCondition = PLANETS.filter((b) => ROCKY_SURFACE_ENTRY.applies(b.cond) === true).map((b) => b.id);
    const onlyLabel = byLabel.filter((id) => !byCondition.includes(id));
    const onlyCondition = byCondition.filter((id) => !byLabel.includes(id));
    expect(onlyLabel.length).toBeGreaterThan(5);         // measured 11
    expect(onlyCondition.length).toBe(0);                // measured 0 — one-sided on THIS corpus
    expect(byLabel.length).toBeGreaterThan(byCondition.length);
  });

  it('FAMILY 3 · reads the CONDITION, never a `type` label — the predicate moves with composition', () => {
    // src/worldengine/drivers/index.js:19 forbids a type-keyed predicate. The positive half of that
    // rule is asserted here: the predicate is driven by the field it claims, and the pack's whole
    // code view never names `.type` at all.
    expect(PACK_CODE).not.toMatch(/\.type\b/);
    const solid = SOLID[0];
    expect(ROCKY_SURFACE_ENTRY.applies(solid.cond)).toBe(true);
    // Give the same body an h2-he envelope and e1Regime.js:67 makes it gas — the predicate flips
    // with the composition channel and with nothing else.
    const envelope = { ...solid.cond, atmosphere: { ...(solid.cond.atmosphere || {}), composition: 'h2-he' } };
    expect(compositionClass(envelope)).toBe('gas');
    expect(ROCKY_SURFACE_ENTRY.applies(envelope)).toBe(false);
    // ...and the reverse, from a real gas body.
    const gas = GAS[0].cond;
    expect(ROCKY_SURFACE_ENTRY.applies(gas)).toBe(false);
    expect(ROCKY_SURFACE_ENTRY.applies({ ...gas, atmosphere: null })).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §B — THE GATES. TWO declared NAMES, not one and not a hardcoded 1.0.
// ═════════════════════════════════════════════════════════════════════════════
describe('B — two declared gate names that the ALL_ON policy resolves', () => {
  it('FAMILY 4 · both names are declared, `gatesFor` resolves both, and an unknown policy throws', () => {
    // TWO gates rather than one because the lab carries two independent toggles over this family
    // (planet-lod-lab.html:5354 state.cratersEnabled, :5361 state.ejectaEnabled). Ejecta-off with
    // craters-on is a real lab state; one gate would delete a rendering decision rather than express it.
    expect(ROCKY_SURFACE_ENTRY.gates).toEqual([CRATER_GATE, EJECTA_GATE]);
    expect(Object.isFrozen(ROCKY_SURFACE_ENTRY.gates)).toBe(true);
    expect(CRATER_GATE).not.toBe(EJECTA_GATE);
    expect(gatesFor(ROCKY_SURFACE_ENTRY)).toEqual({ [CRATER_GATE]: true, [EJECTA_GATE]: true });
    expect(gatesFor(ROCKY_SURFACE_ENTRY, GATE_POLICY_ALL_ON)).toEqual({ craters: true, ejecta: true });
    expect(() => gatesFor(ROCKY_SURFACE_ENTRY, 'everything')).toThrow(PackContractError);

    // Exactly the two gated drivers, and exactly those two. The morphology terms are ungated on
    // purpose: the GLSL keys the whole crater pass on the density and the whole apron on the
    // strength, so one zero deletes each pass byte-identically (see FAMILY 25).
    const { drivers } = packFor(FIRED_MOONS[0]);
    const gated = Object.entries(drivers)
      .filter(([, d]) => isPackDriver(d) && d.gate != null).map(([n, d]) => [n, d.gate]);
    expect(new Map(gated)).toEqual(new Map([['uCraterDensity', CRATER_GATE], ['uEjectaStrength', EJECTA_GATE]]));
  });

  it('FAMILY 4b · a driver gated on an UNDECLARED name still throws under the ALL_ON policy', () => {
    // src/worldengine/port/writePackUniforms.js:180 treats an absent gate as an unanswered
    // rendering decision. That throw is the entire reason these are names instead of literals, and
    // `gatesFor` builds ALL_ON from the entry's OWN declared list rather than from a blanket yes —
    // so a gate nobody ruled on is still an error even with "everything on".
    const b = FIRED_MOONS[0];
    const ctx = ctxFor(b);
    expect(() => resolveDriver('uEjectaStrength', scalar(1, { gate: 'ejectaa' }), ctx))
      .toThrow(/gated on 'ejectaa' but ctx.gates has no such key/);
    // ...and dropping a real name from the declared list has the same effect, which is what makes
    // the `gates` array load-bearing rather than documentation.
    const partial = gatesFor({ gates: [CRATER_GATE] });
    expect(partial).toEqual({ craters: true });
    const res = rockySurfacePack(b.cond, { ...ctx, gates: partial });
    expect(() => writePackUniforms(buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms,
      res.drivers, { ...ctx, gates: partial })).toThrow(/gated on 'ejecta'/);
  });

  it('FAMILY 5 · [CONTROL] a HARDCODED value makes that throw unreachable — which is why it is a name', () => {
    // The mutant is exactly the shortcut this lane was told not to take: a plain number instead of
    // a gated driver. Under the same empty gates map it writes silently, so the absent-gate throw
    // above is a property of the NAME and not of the writer.
    const mat = buildLabPlanetMaterial({ bodyRadius: 1 }).material;
    const ctx = { displayRadiusEarth: 1, gates: {} };
    expect(() => writePackUniforms(mat.uniforms, { uCraterDensity: 0.5 }, ctx)).not.toThrow();
    expect(mat.uniforms.uCraterDensity.value).toBe(0.5);
    // ...while the pack's real driver on the same empty map is an error.
    const b = FIRED_MOONS[0];
    const real = packFor(b).drivers.uCraterDensity;
    expect(() => resolveDriver('uCraterDensity', real, { ...ctxFor(b), gates: {} })).toThrow(PackContractError);
  });

  it('FAMILY 6 · a gated-OFF driver resolves to exactly +0, on a FULL ctx with the gate false', () => {
    // ⛔ THE ctx IS FULL AND ONLY THE GATE IS FALSE. A bare `{ gates: { craters: false } }` throws
    // at assertDisplayPolicy BEFORE the gate is ever read, so the test would pass for the wrong
    // reason and would keep passing if the short-circuit were deleted. This is the
    // tests/driver-pack-polardeck.test.js:316-318 shape.
    for (const b of FIRED_MOONS.slice(0, 12)) {
      const off = ctxFor(b, ALL_OFF);
      expect(off.displayRadiusEarth, 'the off-ctx must be a REAL ctx').toBeGreaterThan(0);
      const res = rockySurfacePack(b.cond, off);
      for (const n of ['uCraterDensity', 'uEjectaStrength']) {
        const v = resolveDriver(n, res.drivers[n], off);
        expect(v, `${b.id} ${n}`).toBe(0);
        expect(Object.is(v, -0), `${b.id} ${n} must be +0, not -0`).toBe(false);
        expect(Object.is(v, 0)).toBe(true);
      }
      // and ON, the same two are non-zero on a fired body — so the +0 is the GATE, not the body
      expect(valueOf(b, 'uCraterDensity')).toBeGreaterThan(0);
      expect(valueOf(b, 'uEjectaStrength')).toBeGreaterThan(0);
    }
    expect(FIRED_MOONS.length, 'the loop must have had subjects').toBeGreaterThan(20);
  });

  it('FAMILY 6b · GATE SCOPE: the two gates move those two names and NOTHING else', () => {
    // The failure this catches is gating a palette driver by accident — a gated-off body wearing
    // black ground, which renders plausibly and is invisible until someone toggles the flag.
    const b = FIRED_MOONS[0];
    const on = ctxFor(b); const off = ctxFor(b, ALL_OFF);
    const rOn = rockySurfacePack(b.cond, on); const rOff = rockySurfacePack(b.cond, off);
    const moved = ROCKY_SURFACE_UNIFORMS.filter((n) => JSON.stringify(resolveDriver(n, rOn.drivers[n], on))
      !== JSON.stringify(resolveDriver(n, rOff.drivers[n], off)));
    expect([...moved].sort()).toEqual(['uCraterDensity', 'uEjectaStrength']);
    // ...and the 16 that did not move include every colour, so a gated-off body keeps its ground.
    for (const n of ['uWeatheredColor', 'uFreshColor', 'uSedColor', 'uCratonColor', 'uBioGroundColor']) {
      expect(isPackDriver(rOff.drivers[n]), `${n} must be an ungated plain value`).toBe(false);
      expect(resolveDriver(n, rOff.drivers[n], off)).toEqual(resolveDriver(n, rOn.drivers[n], on));
    }
    // Ejecta-off-with-craters-on is a real state and the two gates are genuinely independent.
    const half = ctxFor(b, { [CRATER_GATE]: true, [EJECTA_GATE]: false });
    const rHalf = rockySurfacePack(b.cond, half);
    expect(resolveDriver('uCraterDensity', rHalf.drivers.uCraterDensity, half)).toBeGreaterThan(0);
    expect(resolveDriver('uEjectaStrength', rHalf.drivers.uEjectaStrength, half)).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §C — THE VALUES ARE THE GAME'S OWN LAWS, FORWARDED, NOT TRANSCRIBED.
// ═════════════════════════════════════════════════════════════════════════════
describe('C — every driver is a forward of a shared producer', () => {
  it('FAMILY 7 · every crater driver EQUALS craterUniformsFrom on that body, exactly', () => {
    let checked = 0;
    for (const b of SOLID_MOONS) {
      const ctx = ctxFor(b);
      const { drivers } = rockySurfacePack(b.cond, ctx);
      const cu = craterUniformsFrom(b.cond);
      const rel = craterRelevanceOf(b.cond);
      expect(resolveDriver('uCraterDensity', drivers.uCraterDensity, ctx), b.id).toBe(cu.density * rel);
      expect(resolveDriver('uEjectaStrength', drivers.uEjectaStrength, ctx), b.id).toBe(cu.ejectaStrength * rel);
      expect(drivers.uCraterAmp, b.id).toBe(cu.amp);
      expect(drivers.uCraterComplexD, b.id).toBe(cu.complexD);
      expect(drivers.uCraterRelaxation, b.id).toBe(cu.relaxation);
      expect(drivers.uTerraceCount, b.id).toBe(cu.terraceCount);
      expect(drivers.uEjectaRampart, b.id).toBe(cu.ejectaRampart);
      expect(drivers.uEjectaAmp, b.id).toBe(cu.ejectaAmp);
      expect(drivers.uEjectaLump, b.id).toBe(cu.ejectaLump);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
    // The relevance fold is CPU-side and it is FORCED, not chosen: src/objects/Planet.js:2204's
    // GAME_RELEVANCE is frozen-empty, so `scalar(v, { relevance: 'craters' })` would throw on every
    // body at writePackUniforms.js:240. The channel is therefore left empty — asserted, not assumed.
    const { drivers } = packFor(SOLID_MOONS[0]);
    for (const d of Object.values(drivers)) {
      if (isPackDriver(d)) expect(d.relevance == null).toBe(true);
    }
    expect(ctxFor(SOLID_MOONS[0]).relevance).toEqual({});
  });

  it('FAMILY 7b · every palette / scalar driver EQUALS its shared producer, and is a FRESH array', () => {
    const pop = [...SOLID.slice(0, 30), ...SOLID_MOONS.slice(0, 30)];
    for (const b of pop) {
      const { drivers } = packFor(b);
      const sp = applyAlbedoTransfer(surfacePaletteOf(b.cond), { extra: { pigment: BIO_PIGMENT } });
      expect(drivers.uWeatheredColor, b.id).toEqual(sp.weathered);
      expect(drivers.uFreshColor, b.id).toEqual(sp.fresh);
      expect(drivers.uSedColor, b.id).toEqual(sp.sediment);
      expect(drivers.uCratonColor, b.id).toEqual(sp.craton);
      expect(drivers.uBioGroundColor, b.id).toEqual(sp.pigment);
      expect(drivers.uBioGroundCover, b.id).toBe(biosphereOf(b.cond));
      expect(drivers.uIcenessMix, b.id).toBe(icenessOf(b.cond));
      expect(drivers.uPerturb, b.id)
        .toBe(PERTURB_BASE * reliefEnvelope(b.cond.radiusEarth, b.cond.surfaceGravity ?? 1.0));
    }
    // ⛔ THE `.slice()` GATE, AND WHAT IT CAN AND CANNOT SEE — CORRECTED 2026-08-19 AFTER THE CLAIM
    // BELOW WAS MEASURED AND FOUND FALSE. This block used to say the property that fails on the
    // slice-deleting mutant is NON-IDENTITY ACROSS TWO PACK CALLS. IT IS NOT.
    // src/worldengine/display/albedoTransfer.js:44 `export function applyAlbedoTransfer(palette, opts) {`
    // allocates a fresh result object with fresh arrays on EVERY call, so `one.drivers[n] !==
    // two.drivers[n]` holds identically with and without the slices — the loop below and the poison
    // test after it BOTH PASS on the mutant (measured: delete all five `.slice()` calls and this
    // test reds on exactly ONE line, the `meta.palette` identity).
    //
    // ⚠ That one line IS the aliasing property — `meta.palette` is the pack's internal `sp`, so a
    // driver being a different object from it is exactly what `.slice()` establishes. But its
    // non-vacuity rests on an UNDECLARED coupling, and a maintainer reshaping `meta` deletes the
    // suite's only gate on the copies without anything announcing it (measured: deep-copy
    // `meta.palette` alone and all 36 tests stay green; do BOTH and the mutant ships).
    //
    // ⭐ SO THE BEHAVIOURAL HALF IS UNREACHABLE TODAY AND THE SOURCE PIN IS WHAT CARRIES IT — the
    // same shape FAMILY 7c uses out loud for the relevance fold, and for the same reason: the
    // failure `.slice()` prevents (one body's tint following another's, via
    // src/worldengine/port/writePackUniforms.js:280 `if (target && typeof target.set === 'function') target.set(...v);`)
    // is a property of a module in another directory, so no assertion over THIS pack's output can
    // see it until that module changes.
    for (const [n, k] of [['uWeatheredColor', 'weathered'], ['uFreshColor', 'fresh'],
      ['uSedColor', 'sediment'], ['uCratonColor', 'craton'], ['uBioGroundColor', 'pigment']]) {
      expect(PACK_CODE, `${n} must take a COPY — the writer hands the array to target.set(...)`)
        .toMatch(new RegExp(`${n}:\\s*sp\\.${k}\\.slice\\(\\)`));
    }
    // ...and the coupling the behavioural line below depends on is pinned rather than assumed, so
    // reshaping `meta` reds HERE instead of silently disarming it.
    expect(PACK_CODE, 'meta.palette must remain the pack\'s own `sp` for the identity check below')
      .toMatch(/palette:\s*sp,/);
    const b = SOLID[0];
    const one = packFor(b); const two = packFor(b);
    for (const n of ['uWeatheredColor', 'uFreshColor', 'uSedColor', 'uCratonColor', 'uBioGroundColor']) {
      expect(one.drivers[n]).toEqual(two.drivers[n]);
      expect(one.drivers[n], `${n} must not be shared between two pack results`).not.toBe(two.drivers[n]);
    }
    expect(one.drivers.uWeatheredColor).not.toBe(one.meta.palette.weathered);
    // ...and a mutation of one result's array cannot reach the other's. The failure this prevents —
    // one body's tint following another's — is invisible on a still frame.
    one.drivers.uWeatheredColor[0] = -99;
    expect(two.drivers.uWeatheredColor[0]).not.toBe(-99);
    expect(packFor(b).drivers.uWeatheredColor[0]).not.toBe(-99);
  });

  it('FAMILY 7c · ⚠ THE RELEVANCE FOLD IS UNREACHABLE TODAY, and the emptiness is asserted LOUDLY', () => {
    // ⛔ THE ONE GATE IN THIS FILE THAT CANNOT SEE ITS OWN SUBJECT, said out loud rather than left
    // for someone to discover. The pack multiplies `craterRelevanceOf(condition)` into the two
    // gated values CPU-side, reproducing planet-lod-lab.html:5354/:5361. MEASURED 2026-08-19:
    // deleting that multiply changes NOT ONE number, because no body exists on which
    // `craterUniformsFrom` returns a non-zero density AND `craterRelevanceOf` returns 0 —
    // 0 of 1183 real bodies over 200 systems, and 0 of a 1680-point synthetic sweep of
    // (radius x gravity x age x pressure x temperature). Both functions bottom out in
    // `craterSchedule`, and a schedule that fires has always satisfied the relevance leaf too.
    //
    // So the ONLY gate that can see the fold is a SOURCE PIN, and here it is. If someone deletes
    // the multiply the behavioural half of this suite stays green and this line does not.
    // ⚠ PINNED ON THE DRIVER LINES THEMSELVES, not on the substring. `meta` carries the same two
    // products, so a bare `toContain('cu.density * rel')` stays green with the fold deleted from
    // the drivers and surviving in the report — measured, on the mutant, before this was tightened.
    expect(PACK_CODE).toMatch(/uCraterDensity:\s*scalar\(\s*cu\.density\s*\*\s*rel\s*,/);
    expect(PACK_CODE).toMatch(/uEjectaStrength:\s*scalar\(\s*cu\.ejectaStrength\s*\*\s*rel\s*,/);
    expect(PACK_CODE).toContain('const rel = craterRelevanceOf(condition);');
    // …and `meta` must agree with what the drivers resolve to, so the report and the wire cannot
    // drift apart and leave the pin above reading a line nobody renders from.
    for (const b of FIRED_MOONS.slice(0, 8)) {
      const r = packFor(b);
      expect(r.meta.craterDensity, b.id).toBe(valueOf(b, 'uCraterDensity'));
      expect(r.meta.ejectaStrength, b.id).toBe(valueOf(b, 'uEjectaStrength'));
    }
    // …and the emptiness itself is re-measured rather than quoted, so the day the two laws diverge
    // this assertion goes red and the fold becomes load-bearing with something announcing it.
    let contradictions = 0;
    for (const b of [...SOLID, ...SOLID_MOONS]) {
      if (craterUniformsFrom(b.cond).density > 0 && craterRelevanceOf(b.cond) === 0) contradictions++;
    }
    expect(contradictions,
      'the fold has become observable — FAMILY 7 can now gate it behaviourally, so promote it').toBe(0);
    // The fold is kept anyway, and the reason is not caution: it is what the lab computes, and
    // src/objects/Planet.js:2204's GAME_RELEVANCE is frozen-empty, so the `relevance` channel is
    // not available to express it. A pack that dropped it would be a port of a DIFFERENT line.
    for (const b of FIRED_MOONS.slice(0, 5)) expect(craterRelevanceOf(b.cond)).toBe(1);
  });

  it('FAMILY 8 · those values VARY across the population — a constant would collapse them', () => {
    // MEASURED 2026-08-19. Floors, not equalities: the claim is distinctness, and pinning the exact
    // counts would pin the generator (and the moon census is live).
    //   58 solid moons -> 58 distinct uPerturb, 57 distinct weathered/craton/sediment colours,
    //   51 distinct uCraterComplexD, 21 distinct uIcenessMix, 15 distinct crater densities.
    const distinct = (pop, f) => new Set(pop.map(f)).size;
    const col = (b, n) => packFor(b).drivers[n].map((x) => x.toFixed(9)).join(',');
    const num = (b, n) => valueOf(b, n).toFixed(9);
    expect(distinct(SOLID_MOONS, (b) => num(b, 'uPerturb'))).toBeGreaterThan(20);
    expect(distinct(SOLID_MOONS, (b) => col(b, 'uWeatheredColor'))).toBeGreaterThan(20);
    expect(distinct(SOLID_MOONS, (b) => col(b, 'uCratonColor'))).toBeGreaterThan(20);
    expect(distinct(SOLID_MOONS, (b) => col(b, 'uSedColor'))).toBeGreaterThan(20);
    expect(distinct(SOLID_MOONS, (b) => num(b, 'uIcenessMix'))).toBeGreaterThan(8);
    expect(distinct(FIRED_MOONS, (b) => num(b, 'uCraterComplexD'))).toBeGreaterThan(20);
    expect(distinct(FIRED_MOONS, (b) => num(b, 'uCraterDensity'))).toBeGreaterThan(8);
    expect(distinct(SOLID, (b) => num(b, 'uPerturb'))).toBeGreaterThan(20);
    // ⚠ AND THE ONES THAT DO NOT VARY, NAMED RATHER THAN QUIETLY OMITTED. `uTerraceCount` and
    // `uEjectaLump` are lab knobs carried across as constants (craterUniforms.js:82-83), so the
    // equality gate above CANNOT see a transcription of either. The source fence in FAMILY 11 is
    // what covers them, which is why the two gates are written as partners.
    expect(distinct(FIRED_MOONS, (b) => num(b, 'uTerraceCount'))).toBe(1);
    expect(distinct(FIRED_MOONS, (b) => num(b, 'uEjectaLump'))).toBe(1);
  });

  it('FAMILY 9 · CROSS-MATERIAL AGREEMENT: the swapped body carries what the legacy one did', () => {
    // ⭐ THE GATE THAT SAYS WHAT THIS PORT IS. src/objects/Planet.js:1628-1695 already writes the
    // palette, the biosphere cover, the iceness and the whole crater family onto the LEGACY
    // material from the same producers. If the pack forwards the same laws, then on a given body
    // the swap moves ONLY the names the legacy material never carried — which is what makes the
    // result readable as "the wire arrived" instead of "the new renderer looks different".
    // Colours go through `comps` — see the note on that helper for why an encoding comparison lies.
    let checked = 0;
    for (const b of SOLID.slice(0, 40)) {
      const legacy = planetAt(b.d, false).material;
      expect(isLabPlanetMaterial(legacy), b.id).toBe(false);
      const u = legacy.uniforms;
      const ctx = ctxFor(b);
      const { drivers } = rockySurfacePack(b.cond, ctx);
      for (const n of ['uCraterAmp', 'uCraterComplexD', 'uCraterRelaxation', 'uTerraceCount',
        'uEjectaRampart', 'uEjectaAmp', 'uEjectaLump', 'uBioGroundCover', 'uIcenessMix',
        'uCraterDensity', 'uEjectaStrength', 'uCraterScale']) {
        expect(u[n], `${b.id} legacy must carry ${n}`).toBeTruthy();
        expect(resolveDriver(n, drivers[n], ctx), `${b.id} ${n}`).toBe(u[n].value);
      }
      for (const n of ['uWeatheredColor', 'uFreshColor', 'uSedColor', 'uBioGroundColor']) {
        expect(comps(u[n].value), `${b.id} ${n}`).toEqual(drivers[n]);
      }
      // ⭐ AND THE THREE DOMAIN OFFSETS, WHICH ARE THE SHARPEST FORM OF THIS FAMILY'S CLAIM (P-13,
      // Step 9c). Every other name here agrees because both sides call the same PRODUCER; these
      // three agree because the pack calls no producer at all — `labPackCtx` hands it the very
      // vectors the legacy material writes at src/objects/Planet.js:1684. Byte-identical BY
      // CONSTRUCTION, which is the only version of this that is provable rather than measured.
      for (const n of ['uMacroOffset', 'uDetailOffset', 'uCraterOffset']) {
        expect(u[n], `${b.id} legacy must carry ${n}`).toBeTruthy();
        expect(comps(u[n].value), `${b.id} ${n}`).toEqual(drivers[n]);
      }
      checked++;
    }
    expect(checked, 'an empty loop is a green gate about nothing').toBeGreaterThan(30);
  });

  it('FAMILY 9b · the two crater gates disagree on a real set; ZERO rendered values move on FAMILY 9\u2019s population, and the moons that DO move are named', () => {
    // ⭐ THE PRODUCTION SWAP HAS LANDED — src/objects/Planet.js:1596 is `craterRelevanceOf(condition) > 0`.
    // FAMILY 9 above compares the pack against the legacy material on SOLID PLANETS, so the question
    // this gate answers is whether the swap could have moved a value underneath that comparison.
    // ⛔ AND THE ANSWER IS POPULATION-SCOPED, WHICH AN EARLIER DRAFT OF THIS GATE STATED AS GLOBAL.
    // On FAMILY 9's own population — solid PLANETS — the answer is a clean zero. On solid MOONS it is
    // not, and saying "the swap moves the SET and moves no rendered number" while looping only over
    // planets was measuring the half where the answer is structurally 0.
    let disagree = 0; let disagreeWithDensity = 0;
    for (const b of SOLID) {
      const byLabel = LEGACY_ROCKY_TYPES.has(b.d.type);
      const byRelevance = craterRelevanceOf(b.cond) > 0;
      if (byLabel === byRelevance) continue;
      disagree++;
      if (craterUniformsFrom(b.cond).density > 0) disagreeWithDensity++;
    }
    expect(disagree, 'the two gates really do disagree \u2014 otherwise this gate is vacuous').toBeGreaterThan(0);
    expect(disagreeWithDensity,
      'a body where the gates disagree AND the density is non-zero would break FAMILY 9').toBe(0);

    // ⚠ THE MOON HALF, STATED AS A FLOOR (header rule 5 \u2014 the moon window is open). MEASURED
    // 2026-08-19 on these 24 seeds: 58 solid moons, the gates disagree on 17, and 14 of those DO
    // carry a non-zero density. Over `lab-procedural-0\u20261999`'s first 200 systems the swap turns a
    // live crater derivation ON for 156 bodies and OFF for 0 \u2014 every one of them a moon.
    const movedMoons = SOLID_MOONS.filter((b) => {
      const byLabel = LEGACY_ROCKY_TYPES.has(b.d.type);
      const byRelevance = craterRelevanceOf(b.cond) > 0;
      return byLabel !== byRelevance && craterUniformsFrom(b.cond).density > 0;
    });
    expect(movedMoons.length, 'the moon half is NOT the planet half \u2014 floor, measured 14').toBeGreaterThan(9);
    // ⭐ AND THIS IS WHY IT MOVES NO RENDERED NUMBER: not one of them renders a program that reads a
    // crater uniform. `shaderVariantFor` puts every one on the EXOTIC branch (measured: `captured`
    // and `volcanic`), and ROCKY_BODY is the only branch the crater relief is spliced into.
    for (const b of movedMoons) {
      expect(shaderVariantFor(b.d.type), `${b.id} must not render ROCKY_BODY`).not.toBe('rocky');
    }
    // ⛔ THE SHADER FACT, DERIVED RATHER THAN TRANSCRIBED, because the whole paragraph above rests on
    // it and nothing else in this commit pins it. The three variants share a byte-identical header
    // (measured 20253 chars) and differ only in the body spliced after it; a naive pin on
    // `PLANET_SHADER_VARIANTS.exotic.fragmentShader` is USELESS here \u2014 the shared header declares
    // `uCraterDensity` and reads it inside `perturbNormalAnalytic`, so that string contains the token
    // on every variant. The claim is about the BODY.
    const rockyFrag = PLANET_SHADER_VARIANTS.rocky.fragmentShader;
    const exoticFrag = PLANET_SHADER_VARIANTS.exotic.fragmentShader;
    const gasFrag = PLANET_SHADER_VARIANTS.gas.fragmentShader;
    let cut = 0;
    while (cut < rockyFrag.length && cut < exoticFrag.length && rockyFrag[cut] === exoticFrag[cut]) cut++;
    expect(cut, 'the variants must actually share a header, or this slice means nothing').toBeGreaterThan(1000);
    expect(gasFrag.slice(0, cut)).toBe(rockyFrag.slice(0, cut));   // …and all three share the SAME one
    expect(rockyFrag.slice(cut)).toMatch(/uCraterDensity/);        // ROCKY_BODY reads it
    expect(exoticFrag.slice(cut)).not.toMatch(/uCrater|uEjecta/);  // EXOTIC_BODY names no crater uniform
    expect(gasFrag.slice(cut)).not.toMatch(/uCrater|uEjecta/);     // …nor does GAS_BODY
    expect(exoticFrag.slice(cut)).not.toMatch(/perturbNormalAnalytic/);

    // ...and the legacy material carries NEITHER of the two names this pack adds outright.
    const legacy = planetAt(SOLID[0].d, false).material;
    expect(legacy.uniforms.uCratonColor).toBeUndefined();
    expect(legacy.uniforms.uPerturb).toBeUndefined();
  });

  it('FAMILY 10 · [CONTROL] a transcribed constant REDS the equality gate on the real population', () => {
    // The mutant is the declared non-port, by number: the lab pins `craterComplexD` at
    // `_HASH_TAIL_MAX / 0.6` (planet-lod-lab.html:2841, :2870) to force morphology ≡ 0, because
    // every crater IT draws is a sub-floor simple bowl. Porting that number would flatten every
    // complex crater in the game while every other gate in this file stayed green — which is
    // exactly why craterUniforms.js:153-156 refuses it in its own words.
    const LAB_PINNED_COMPLEX_D = (2.0 * 0.55) / 0.6;
    const disagree = FIRED_MOONS.filter((b) => craterUniformsFrom(b.cond).complexD !== LAB_PINNED_COMPLEX_D);
    expect(disagree.length).toBeGreaterThan(20);          // measured: all 50 fired moons disagree
    expect(() => {
      for (const b of FIRED_MOONS) expect(LAB_PINNED_COMPLEX_D).toBe(craterUniformsFrom(b.cond).complexD);
    }).toThrow();
    // ...and the value the pack actually forwards is the GAME's, on every one of them.
    for (const b of FIRED_MOONS) {
      expect(packFor(b).drivers.uCraterComplexD, b.id).toBe(craterUniformsFrom(b.cond).complexD);
    }
    // The same control for the palette: the material's own factory tone is the plausible constant.
    const FACTORY_TONE = [0.46, 0.40, 0.34];
    const paletteDisagree = SOLID_MOONS.filter((b) => packFor(b).drivers.uWeatheredColor
      .some((c, i) => c !== FACTORY_TONE[i]));
    expect(paletteDisagree.length).toBeGreaterThan(20);
  });

  it('FAMILY 11 · ANTI-TRANSCRIPTION FENCE: the pack owns no number of the crater or palette law', () => {
    // ⭐ THE PARTNER OF FAMILY 7. A forward is only a forward if the pack cannot have retyped the
    // law, and FAMILY 8 measured that two of the nine crater drivers are CONSTANT across the whole
    // population, so the equality gate is structurally blind to a transcription of either. This
    // fence is what covers them.
    // ⚠ IT RUNS ON THE COMMENT-STRIPPED, STRINGS-INTACT VIEW — corrected 2026-08-19. This note used
    // to say STRING-BLANKED and to claim the blanking was what stopped a transcription hidden in a
    // string literal. It is the exact opposite: blanking is what HIDES one, because `Number('0.1706')`
    // reads as `Number('        ')` and walks past both arms below. Comment stripping is what the
    // pack's header needs (it quotes several of these constants verbatim in prose, which is the
    // citation standard this program runs on), and comment stripping is all it needs — measured, the
    // two views yield the identical literal set on this file today.
    const FORBIDDEN = {
      '0.1706': 'RENDERED_CELL_COVERAGE — the density normaliser (craterUniforms.js:56)',
      '0.05': 'EJECTA_RIM_FRACTION (craterUniforms.js:63)',
      '9.6e-4': 'CRATER_VIS_FLOOR_RAD — the resolvable-band floor (craterUniforms.js:71)',
      '0.02': 'the PRE-B2 CRATER_VIS_FLOOR_RAD, retired 2026-08-20 — kept forbidden because a pack that re-typed the OLD floor is exactly the regression this fence is for',
      '1e-3': 'the retired CRATER_MIN_DENSITY (craterUniforms.js:79 now carries CRATER_MIN_VISIBLE), kept for the same reason. ⚠ AND THE HOLE IS NAMED RATHER THAN PAPERED OVER: the successor value 1.0 CANNOT be listed here, because `1.0` is already a DECLARED pack literal (C_CRATER, asserted below), so this fence does not cover CRATER_MIN_VISIBLE at all — the per-body form at craterUniforms.js:145 is what makes a re-typing visible instead',
      '4.0': 'TERRACE_COUNT — constant across the population, so FAMILY 7 cannot see it',
      '0.6': 'EJECTA_LUMP — likewise constant, likewise invisible to FAMILY 7',
      '0.2': 'D_D_SIMPLE / CRATER_DEPTH — the depth/diameter law (bombardment.js:99)',
      '3.1': 'K_DT — the simple→complex transition (bombardment.js:100)',
      '2.0': 'B_SFD — the size-frequency exponent (bombardment.js:58)',
      '4.176': 'ALBEDO_TONE_K — the display transfer (albedoTransfer.js:28)',
      '0.16': "BIO_PIGMENT's green channel (surfaceMaterial.js:155)",
      '0.58': 'Q_RELIEF — the relief calibration exponent (labCore.js)',
      '1.678235294117647': 'Q_RELIEF_DERIVED — the super-Earth branch (labCore.js)',
      '133': 'RELIEF_CEIL (labCore.js)',
      '1.8333': "the lab's pinned craterComplexD, declared non-port 1",
    };
    for (const [n, why] of Object.entries(FORBIDDEN)) {
      expect(PACK_CODE_STRINGS.includes(n), `rockySurface.js code names ${n} — ${why}`).toBe(false);
    }
    // ⛔ AND THE STRING ROUTE IS CLOSED BY NAME AS WELL AS BY VIEW. Both arms above now read the
    // strings-intact view, so `Number('0.1706')` is caught on its digits; this closes the same door
    // from the other side, because a constant reaching the pack through a string parse is not a
    // forward of anything and there is no legitimate use of either call in a pack.
    expect(PACK_CODE_STRINGS).not.toMatch(/Number\(|parseFloat\(|parseInt\(/);
    // ⭐ AND THE FENCE IS CLOSED FROM THE OTHER SIDE: rather than a blacklist a new constant could
    // walk past, the code view is asserted to contain NO numeric literal outside the three this
    // pack declares it owns. MEASURED 2026-08-19: exactly `1.0`, `0.55`, `0`, `3` and nothing else.
    const literals = literalsIn(PACK_CODE_STRINGS);
    expect(literals.sort()).toEqual(['0', '0.55', '1.0', '3']);
    //   · 1.0 twice: C_CRATER (planet-lod-lab.html:821) and the lab's surfaceGravity fallback
    //     (planet-lod-lab.html:4996 — NOT craterUniforms.js:157's 0.5, which would raise the relief
    //     envelope ~1.5x on any body missing the field and look exactly like a working wire).
    expect(C_CRATER).toBe(1.0);
    //   · 0.55: PERTURB_BASE, pinned to the factory default rather than transcribed — see FAMILY 28.
    expect(PERTURB_BASE).toBe(makeUniforms(LAB_WORLD_LIGHT).uPerturb.value);
    //   · 0: the `Dchar === 0` divide-by-zero guard, not a null check. craterUniforms.js:96 says
    //     Dchar 0 means "no characteristic diameter", and writePackUniforms.js:191 refuses it.
    expect(CRATERS_OFF.Dchar).toBe(0);
    //   · 3: the LENGTH of a domain-offset vector in `offsetOf`'s shape guard (Step 9c), and the
    //     only member of this list that is not a law constant at all — it is a dimension. It earns
    //     its place rather than being waved through: the guard is what stops a `THREE.Vector3` (no
    //     `.length`) and a truncated array from reaching the writer, where the first would be
    //     written as a scalar and the second would set a component to undefined.
    expect(packFor(FIRED_MOONS[0]).drivers.uMacroOffset).toHaveLength(3);
  });

  it('FAMILY 11b · [CONTROL] the fence REDS on a source that does name one of the constants', () => {
    // A fence whose subject cannot be broken in-test is decoration. Both halves are exercised:
    // the blacklist and the literal-allowlist.
    const mutant = 'const amp = 0.2 / 0.2 * rpk * Dchar;   // transcribed D_D_SIMPLE';
    expect(mutant.includes('0.2')).toBe(true);
    expect(() => expect(mutant.includes('0.2')).toBe(false)).toThrow();
    const lits = literalsIn(stripCommentsPreservingOffsets(mutant));
    expect(lits).toContain('0.2');
    expect(() => expect(lits.sort()).toEqual(['0', '0.55', '1.0', '3'])).toThrow();

    // ⭐ AND THE TWO FORMS THAT USED TO WALK PAST BOTH ARMS, EXERCISED RATHER THAN ASSERTED. Each
    // is the SAME transcription as above in a shape the old fence could not see.
    //  (i) leading-dot: no `0` before the point. Reported as `.2`, not `0.2` — so the control
    //      asserts the form the regex actually yields rather than the one a reader expects.
    const dotMutant = 'const amp = .2 / .2 * rpk * Dchar;';
    const dotLits = literalsIn(stripCommentsPreservingOffsets(dotMutant));
    expect(dotLits).toContain('.2');
    expect(() => expect(dotLits.sort()).toEqual(['0', '0.55', '1.0', '3'])).toThrow();
    //  (ii) string-parsed: `blankLiteralText` blanks the interior, so the STRINGS-INTACT view is
    //       what sees it. Both arms are shown to red on it, and the blanked view to stay green —
    //       which is the whole reason FAMILY 11 no longer reads PACK_CODE.
    const strMutant = "const amp = cu.amp * Number('0.1706');";
    const strStripped = stripCommentsPreservingOffsets(strMutant);
    expect(strStripped.includes('0.1706')).toBe(true);
    expect(literalsIn(strStripped)).toContain('0.1706');
    expect(strStripped).toMatch(/Number\(/);
    const blanked = stripCommentsPreservingOffsets(strMutant, { blankLiteralText: true });
    expect(blanked.includes('0.1706'), 'the blanked view is BLIND to this — that is the hole').toBe(false);
    expect(literalsIn(blanked)).not.toContain('0.1706');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §D — THE WIRE, ON A REAL MATERIAL. Non-zero where it must be, zero where it must be.
// ═════════════════════════════════════════════════════════════════════════════
describe('D — the wire reaches a real lab material', () => {
  it('FAMILY 12 · NON-ZERO on a pack-composed body, including a name the game has NEVER written', () => {
    // `uCratonColor` is written by NOBODY in src/ today — the ancient stable shield renders at the
    // factory tone on every body in the game. It is not even on ledger row P-12's list, which is
    // why it is named here rather than left to look like scope creep.
    // ⛔ PINNED ON THE READ, NOT ON THE NAME — CORRECTED 2026-08-19. This block used to assert
    // `read(rel).includes('uCratonColor')` over four files, and `read()` returns RAW source, so a
    // COMMENT satisfied it. Measured occurrences: planetShaders.glsl.js carries TWO, of which :556
    // is prose and :573 is the ONLY read of this uniform in any shader in the repo; rockySurface.js
    // carries FOUR, of which only ONE is the driver line. So the one arm that constitutes
    // this family's entire end-to-end evidence — that the value the pack writes is CONSUMED —
    // survived the deletion of its own subject. Measured on the mutant: point the shader's read at
    // `uWeatheredColor` instead, so no shader anywhere reads the name, and the old fence stayed
    // green (nothing else in this repo compiles GLSL or detects an unread uniform).
    // The shape below is FAMILY 25's, which this file already gets right: pin the exact code string.
    expect(read('src/worldengine/shaders/planetShaders.glsl.js'),
      'the ONLY shader read of uCratonColor — this family claims nothing without it')
      .toContain('pw.r * uCratonColor + pw.g * uFreshColor + pw.b * uSedColor');
    expect(read('src/worldengine/shaders/height.glsl.js')).toContain('uniform vec3  uCratonColor;');
    expect(read('src/worldengine/shaders/uniforms.js')).toMatch(/uCratonColor:\s*\{\s*value:/);
    // ...and the pack's own end on the COMMENT-STRIPPED view, not on `read()`, which is what every
    // other source assertion in this file already does (the header at the top says so).
    expect(PACK_CODE).toContain('uCratonColor: sp.craton.slice()');

    let checked = 0;
    for (const b of FIRED_MOONS.slice(0, 12)) {
      const fresh = buildLabPlanetMaterial({ bodyRadius: b.d.radius }).material;
      expect(fresh.uniforms.uCraterDensity.value, 'the default really is off').toBe(0.0);
      expect(fresh.uniforms.uEjectaStrength.value).toBe(0.0);
      expect(comps(fresh.uniforms.uCratonColor.value)).toEqual([0.46, 0.40, 0.34]);

      const { material } = composeOnto(b);
      expect(material.uniforms.uCraterDensity.value, b.id).toBeGreaterThan(0);
      expect(material.uniforms.uEjectaStrength.value, b.id).toBeGreaterThan(0);
      expect(comps(material.uniforms.uCratonColor.value), b.id).not.toEqual([0.46, 0.40, 0.34]);
      // ⚠ The lab slot is a THREE.Color and the driver is a plain array, so the round-trip through
      // `target.set(...v)` is MEASURED here rather than reasoned — `Color.set` dispatches to
      // `setRGB`, which under colour management can transform its inputs.
      expect(material.uniforms.uCratonColor.value.constructor.name).toBe('Color');
      expect(comps(material.uniforms.uCratonColor.value)).toEqual(packFor(b).drivers.uCratonColor);
      checked++;
    }
    expect(checked).toBeGreaterThan(8);
  });

  it('FAMILY 12b · ZERO on a body the predicate refuses, and the legacy material has no slot at all', () => {
    // (1) A body the predicate REFUSES never runs the pack, so its lab-material default stands and
    //     NOT ONE uniform moves. Step 6's "Instrument C on the still-legacy bodies" made local.
    const gas = GAS[0];
    expect(ROCKY_SURFACE_ENTRY.applies(gas.cond)).toBe(false);
    const untouched = buildLabPlanetMaterial({ bodyRadius: gas.d.radius }).material;
    const factory = makeUniforms(LAB_WORLD_LIGHT);
    for (const n of ROCKY_SURFACE_UNIFORMS) {
      const v = untouched.uniforms[n].value;
      if (typeof v === 'number') expect(v, n).toBe(factory[n].value);
      else expect(comps(v), n).toEqual(comps(factory[n].value));
    }
    // (2) The LEGACY GAME material carries NEITHER `uCratonColor` NOR `uPerturb`. That is the shape
    //     of ledger rows P-12/P-14 for those two names — the value has no slot to arrive in — and
    //     it is the mirror of the limb suite's `uLimbStrength` argument.
    const legacy = planetAt(SOLID[0].d, false).material;
    expect(isLabPlanetMaterial(legacy)).toBe(false);
    expect(legacy.uniforms.uCratonColor).toBeUndefined();
    expect(legacy.uniforms.uPerturb).toBeUndefined();
    const lab = buildLabPlanetMaterial({ bodyRadius: 1 }).material;
    expect(lab.uniforms.uCratonColor).toBeTruthy();
    expect(lab.uniforms.uPerturb).toBeTruthy();
  });

  it('FAMILY 13 · [CONTROL] BREAK THE WIRE — dropping the write leaves the crater pass off', () => {
    // ⭐ A WIRE WITH NO FAILING STATE IS DECORATION. The mutant is the pack result with the density
    // driver deleted — the exact shape of "someone removed the mapping line".
    const b = FIRED_MOONS[0];
    const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius });
    const ctx = ctxFor(b);
    const res = rockySurfacePack(b.cond, ctx);
    const mutant = { ...res.drivers };
    delete mutant.uCraterDensity;
    writePackUniforms(built.material.uniforms, mutant, ctx);
    expect(built.material.uniforms.uCraterDensity.value).toBe(0.0);
    expect(() => expect(built.material.uniforms.uCraterDensity.value)
      .toBe(resolveDriver('uCraterDensity', res.drivers.uCraterDensity, ctx))).toThrow();
    // ...while the OTHER 20 still landed, so the control isolates the density rather than the write.
    expect(built.material.uniforms.uEjectaStrength.value).toBeGreaterThan(0);
    expect(comps(built.material.uniforms.uWeatheredColor.value)).toEqual(res.drivers.uWeatheredColor);

    // ...and the second half of the break: a MISSPELT name is a throw, never a silent skip.
    expect(() => writePackUniforms(buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms,
      { uCratonColour: [0.1, 0.2, 0.3] }, ctx)).toThrow(/no uniform named 'uCratonColour'/);
  });

  it('FAMILY 14 · the per-frame writer does not clobber any of the 21', () => {
    // ⭐ THE HAZARD giantDeck's LAB_STATE_BINDING EXISTS FOR, asked of THIS pack. The game's lab
    // material is written every frame by `updateLabPlanetMaterial`. If that seam touched any of
    // these names the pack's write would survive exactly one frame and the wire would be decoration.
    // Measured on a live material rather than read off the source.
    const b = FIRED_MOONS[0];
    const { material } = composeOnto(b);
    const snap = () => ROCKY_SURFACE_UNIFORMS.map((n) => {
      const v = material.uniforms[n].value;
      return typeof v === 'number' ? v : comps(v).join(',');
    });
    const before = snap();
    const t = material.uniforms.uTime.value; const o = material.uniforms.uOctaves.value;
    const diag = updateLabPlanetMaterial(material, { renderDt: 0.016, distanceRadii: 3.0 });
    expect(diag, 'the seam must have recognised the material — a null here makes this gate vacuous').toBeTruthy();
    // [CONTROL] the same call MOVED two other uniforms, so "nothing changed" is not the explanation.
    expect(material.uniforms.uTime.value).not.toBe(t);
    expect(material.uniforms.uOctaves.value).not.toBe(o);
    expect(snap()).toEqual(before);
  });

  it('FAMILY 29 · ⭐ P-13 — THE THREE DOMAIN OFFSETS ARE PER-BODY, FORWARDED, AND UNSHARED', () => {
    // ⭐ WHAT THIS FAMILY IS FOR, IN MAX'S WORDS: a planet must not read as "a beach ball painted to
    // look like a planet". `uMacroOffset` / `uDetailOffset` / `uCraterOffset` are the noise-domain
    // origins of the whole surface field, and they default to (0,0,0) — so before Step 9c every
    // body swapped onto the lab material wore the SAME relief under a different paint job. That is
    // the one defect in this pack's family that a single still frame CANNOT show, which is why the
    // gate below is a population gate and a pairwise gate rather than a value assertion.

    // (a) FORWARDED VERBATIM. Not "agrees with a producer" — there is no producer on this side. The
    //     driver must be the ctx array's own contents, and the ctx must be the game's own law.
    for (const b of SOLID_MOONS.slice(0, 12).concat(SOLID.slice(0, 12))) {
      const ctx = ctxFor(b);
      const { drivers } = rockySurfacePack(b.cond, ctx);
      expect(drivers.uMacroOffset, b.id).toEqual(ctx.macroOffset);
      expect(drivers.uDetailOffset, b.id).toEqual(ctx.detailOffset);
      expect(drivers.uCraterOffset, b.id).toEqual(ctx.craterOffset);
      // ...and the ctx really is `labPackCtx`'s, i.e. the game's `reliefOffsets`, not a test fixture.
      expect(ctx.macroOffset, b.id).toEqual(labPackCtx(b.d, b.cond).macroOffset);
    }

    // (b) DISTINCT ACROSS THE POPULATION. A forward of a constant would satisfy (a) exactly.
    const triple = (b) => {
      const { drivers } = packFor(b);
      return [...drivers.uMacroOffset, ...drivers.uDetailOffset, ...drivers.uCraterOffset]
        .map((x) => x.toFixed(9)).join(',');
    };
    expect(new Set(SOLID_MOONS.map(triple)).size, 'moons must not share a noise domain')
      .toBe(SOLID_MOONS.length);
    expect(new Set(SOLID.map(triple)).size, 'planets must not share a noise domain')
      .toBe(SOLID.length);
    // ...and the ONE number that says the wire changed something: the default is a single shared
    // triple, so a dead wire collapses the two counts above to 1.
    const factoryTriple = ['uMacroOffset', 'uDetailOffset', 'uCraterOffset']
      .flatMap((n) => comps(makeUniforms(LAB_WORLD_LIGHT)[n].value));
    expect(factoryTriple.every((c) => c === 0), 'the default really is the shared zero domain').toBe(true);
    expect(new Set([triple(SOLID_MOONS[0]), factoryTriple.map((x) => x.toFixed(9)).join(',')]).size).toBe(2);

    // (c) ⛔ NO TWO BODIES SHARE AN ARRAY OBJECT, and no body shares one with its own ctx. A live
    //     array is how one body's relief follows another's — the failure `.slice()` on the palette
    //     already exists for, one seam further out, because a front-end is free to build a ctx once
    //     and reuse it. Identity, not equality: `toEqual` cannot see this.
    const b0 = SOLID_MOONS[0]; const b1 = SOLID_MOONS[1];
    const c0 = ctxFor(b0); const c1 = ctxFor(b1);
    const d0 = rockySurfacePack(b0.cond, c0).drivers;
    const d1 = rockySurfacePack(b1.cond, c1).drivers;
    const CTX_FIELD_OF = { uMacroOffset: 'macroOffset', uDetailOffset: 'detailOffset', uCraterOffset: 'craterOffset' };
    for (const [n, f] of Object.entries(CTX_FIELD_OF)) {
      expect(d0[n], n).not.toBe(d1[n]);
      expect(d0[n], `${n} must be a copy, never the ctx's own array`).not.toBe(c0[f]);
      expect(d0[n], `${n} must still hold the ctx's VALUES`).toEqual(c0[f]);
    }
    // ...proved by mutation rather than by reading `.slice()` in the source: writing through the
    // driver must not reach the ctx, and a SHARED ctx must not let one body's pack move another's.
    const before0 = c0.macroOffset.slice();
    d0.uMacroOffset[0] = 12345;
    expect(c0.macroOffset).toEqual(before0);
    const shared = { ...c0 };
    const s1 = rockySurfacePack(b0.cond, shared).drivers.uMacroOffset;
    const s2 = rockySurfacePack(b1.cond, shared).drivers.uMacroOffset;
    expect(s1).not.toBe(s2);
    s1[0] = -999;
    expect(s2[0]).not.toBe(-999);

    // (d) [CONTROL] THE VARIATION COMES FROM THE OFFSETS AND FROM NOTHING ELSE. Two DIFFERENT bodies
    //     handed the SAME offsets emit the same three vectors — so (b)'s distinctness is a fact
    //     about the ctx the game builds, not an accident of the condition vector.
    const forced = { ...ctxFor(b1), macroOffset: c0.macroOffset.slice(),
      detailOffset: c0.detailOffset.slice(), craterOffset: c0.craterOffset.slice() };
    const dF = rockySurfacePack(b1.cond, forced).drivers;
    expect(dF.uMacroOffset).toEqual(c0.macroOffset);
    expect(dF.uDetailOffset).toEqual(c0.detailOffset);
    expect(dF.uCraterOffset).toEqual(c0.craterOffset);

    // (e) THE WIRE REACHES A REAL MATERIAL, and two bodies' materials disagree there.
    const m0 = composeOnto(b0).material; const m1 = composeOnto(b1).material;
    for (const n of ['uMacroOffset', 'uDetailOffset', 'uCraterOffset']) {
      expect(comps(m0.uniforms[n].value), n).toEqual(packFor(b0).drivers[n]);
      expect(comps(m0.uniforms[n].value), `${n} must not be the shared default`).not.toEqual([0, 0, 0]);
      expect(comps(m0.uniforms[n].value), `${n} must differ between two bodies`)
        .not.toEqual(comps(m1.uniforms[n].value));
    }

    // (f) SHADER FACTS — the three are READ, so a per-body value changes output rather than sitting
    //     in a slot. Pinned as source, the shape FAMILY 25 uses, because this suite runs no GLSL.
    const h = read('src/worldengine/shaders/height.glsl.js');
    expect(h).toContain('float h  = snoise(pos * uNoiseScale * 0.3 + uMacroOffset)  * 0.5;');
    expect(h).toContain('h += snoise(pos * uNoiseScale * 2.0 + uDetailOffset) * 0.2;');
    expect(read('src/worldengine/shaders/craterRelief.glsl.js'))
      .toContain('voronoi3d(dir * uCraterScale + uCraterOffset, uVoroCells, cellId, voroGrad)');

    // (g) ⚠ THE MOON MEASUREMENT, PINNED RATHER THAN ASSUMED — Step 10 swaps moons, and the game's
    //     `reliefOffsets` keys on EIGHT `d` scalars that a moon record was never promised to carry.
    //     Measured over `lab-procedural-0…199` (852 planets, 665 moons): a moon carries `noiseScale`
    //     and `radiusEarth` always and `massEarth`/`T_eq` on 632 of 665, and carries `noiseDetail`,
    //     `axialTilt`, `metallicity` and `eccentricity` on NONE. The absent four fold in as 0, so
    //     there is no NaN and no shared constant — (b) above already showed every moon distinct,
    //     and `noiseScale` alone is why. Re-measured here on this file's own corpus so it is a
    //     measurement rather than a quotation.
    const MISSING_ON_MOONS = ['noiseDetail', 'axialTilt', 'metallicity', 'eccentricity'];
    for (const f of MISSING_ON_MOONS) {
      expect(MOONS.every((b) => b.d[f] === undefined), `${f} — if moons GAIN this the fold changes`).toBe(true);
    }
    for (const f of ['noiseScale', 'radiusEarth']) {
      expect(MOONS.every((b) => Number.isFinite(b.d[f])), `${f} is what keeps moon offsets distinct`).toBe(true);
    }
    for (const b of MOONS.slice(0, 20)) {
      for (const v of [...ctxFor(b).macroOffset, ...ctxFor(b).craterOffset]) {
        expect(Number.isFinite(v), `${b.id} — a missing field must fold to 0, never to NaN`).toBe(true);
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §E — THE STEP-5a CONTRACT, THE SCOPE FENCE, AND THE DISPLAY SEAM THIS PACK OPENS.
// ═════════════════════════════════════════════════════════════════════════════
describe('E — the pack obeys the Step-5a contract and stays inside its scope', () => {
  it('FAMILY 15 · requires the front-end display policy and a condition — it invents neither', () => {
    const b = FIRED_MOONS[0];
    expect(() => rockySurfacePack(b.cond, { gates: ALL_ON })).toThrow(/displayRadiusEarth is REQUIRED/);
    expect(() => rockySurfacePack(b.cond, { displayRadiusEarth: 0, gates: ALL_ON })).toThrow(PackContractError);
    expect(() => rockySurfacePack(b.cond, { displayRadiusEarth: -4, gates: ALL_ON })).toThrow(PackContractError);
    expect(() => rockySurfacePack(null, ctxFor(b))).toThrow(/condition vector is missing/);
    expect(() => rockySurfacePack(undefined, ctxFor(b))).toThrow(PackContractError);
    // The game's policy is the identity, and it is passed by name rather than as a literal.
    expect(gameDisplayRadiusEarth(b.cond.radiusEarth)).toBe(b.cond.radiusEarth);
    // ⛔ AND IT DOES **NOT** ASSERT A macroSeed — deliberately, because it reads none. Asserting a
    // seed this pack never uses would be a check that cannot fail for a reason. FAMILY 18 is the
    // honest stand-in, and it ends loudly the day a seeded term joins the deck.
    expect(() => rockySurfacePack(b.cond, { ...ctxFor(b), macroSeed: 0 })).not.toThrow();
    expect(() => rockySurfacePack(b.cond, { ...ctxFor(b), macroSeed: undefined })).not.toThrow();
    expect(() => rockySurfacePack(b.cond, { ...ctxFor(b), animRate: undefined })).not.toThrow();
    // ⭐ AND IT DOES ASSERT THE THREE OFFSETS (Step 9c), which is the OPPOSITE ruling to the seed
    // one line above and for a stated reason: the pack READS these, so the check can fail for a
    // reason. Each is refused independently — a front-end that answered two of three has answered
    // none of the question this uniform family asks.
    for (const f of ['macroOffset', 'detailOffset', 'craterOffset']) {
      expect(() => rockySurfacePack(b.cond, { ...ctxFor(b), [f]: undefined }), f)
        .toThrow(new RegExp(`ctx\\.${f} is REQUIRED`));
      expect(() => rockySurfacePack(b.cond, { ...ctxFor(b), [f]: [0, 0] }), `${f} short`)
        .toThrow(PackContractError);
      expect(() => rockySurfacePack(b.cond, { ...ctxFor(b), [f]: [0, 0, NaN] }), `${f} NaN`)
        .toThrow(/is not a finite number/);
      // ⛔ THE SHAPE A CARELESS FRONT-END ACTUALLY PRODUCES: a renderer vector, which has x/y/z and
      // no length. It must be refused HERE rather than reach the writer and be stored as a scalar.
      expect(() => rockySurfacePack(b.cond, { ...ctxFor(b), [f]: { x: 1, y: 2, z: 3 } }), `${f} vec`)
        .toThrow(PackContractError);
    }
  });

  it('FAMILY 16 · returns { drivers, attributes, meta } with attributes EMPTY, not undefined', () => {
    const r = packFor(FIRED_MOONS[0]);
    expect(r.attributes).toEqual({});
    expect(r.attributes).not.toBeUndefined();
    expect(Object.keys(r.drivers).sort()).toEqual([...ROCKY_SURFACE_UNIFORMS].sort());
    expect(ROCKY_SURFACE_UNIFORMS.length).toBe(22);   // 18 + the three domain offsets (P-13) + `uNoiseScale` (B2 leg 3, ledger P-10/M-09). ⛔ A COUNT IS NOT THE GATE HERE and never was — the line above pins the SET by membership, and this one only catches a driver added to the object and forgotten in the frozen list.
    expect(Object.isFrozen(ROCKY_SURFACE_UNIFORMS)).toBe(true);
    // `meta` is the pack's own report and the only place a test can read WHY a body came out zero.
    expect(r.meta.compositionClass).toBe(compositionClass(FIRED_MOONS[0].cond));
    expect(r.meta.craterRelevance).toBe(craterRelevanceOf(FIRED_MOONS[0].cond));
    expect(r.meta.cratersFired).toBe(true);
    expect(r.meta.Dchar).toBeGreaterThan(0);
    expect(r.meta.reliefEnvelope).toBeGreaterThan(0);
    expect(Object.keys(r.meta.palette).sort()).toEqual(['craton', 'fresh', 'pigment', 'sediment', 'weathered']);
    // `cratersFired` reads Dchar, NOT density, and the two are different questions: a density of 0
    // also covers a body with a real band whose coverage rounded away under CRATER_MIN_VISIBLE (that
    // a crater-IRRELEVANT body whose relevance zeroed a real density. Three worlds, one number.
    const off = packFor(UNFIRED_MOONS[0]);
    expect(off.meta.cratersFired).toBe(false);
    expect(off.meta.Dchar).toBe(0);
    expect(off.meta.craterDensity).toBe(0);
  });

  it('FAMILY 17 · ⭐ INVERTS: the km-shaped set is NON-EMPTY and the display seam is live', () => {
    // ⭐ THE ASSERTION EVERY EARLIER PACK SUITE MADE THE OTHER WAY ROUND. giantDeck, limbDeck and
    // polarDeck all assert "not one driver is km-shaped", which makes their "the two front-end
    // policies agree on every driver" a fact about the SIZE OF THE SET. This is the first pack in
    // the program where that set has a member, so it is the first real exercise of
    // src/worldengine/port/writePackUniforms.js:219.
    const km = FIRED_MOONS.filter((b) => {
      const d = packFor(b).drivers.uCraterScale;
      return isPackDriver(d) && d.featureSizeKm !== undefined;
    });
    expect(km.length, 'the km set must NOT be empty — that is this pack\'s whole point').toBeGreaterThan(20);
    expect(km.length).toBe(FIRED_MOONS.length);          // every fired body; measured 50 of 50

    // (a) THE GAME ARM IS BYTE-IDENTICAL TO WHAT SHIPS TODAY. `craterUniformsFrom` also returns the
    //     already-resolved `scale` (R_km / Dchar) and src/objects/Planet.js:1692 writes exactly
    //     that onto the legacy material. Under the game policy `gameDisplayRadiusEarth(R) === R`,
    //     so featureFrequencyFromKm(R, Dchar, 1.0) = 1.0 * R*6371 / Dchar — the same number, now
    //     routed through the seam instead of around it.
    for (const b of km) {
      const ctx = ctxFor(b);
      const got = resolveDriver('uCraterScale', packFor(b).drivers.uCraterScale, ctx);
      expect(got, b.id).toBe(craterUniformsFrom(b.cond).scale);
    }
    // ⚠ WITH ITS STATED BOUND: craterUniformsFrom floors radiusEarth at 1e-6 (craterUniforms.js:131)
    //   while labPackCtx passes it raw (Planet.js:2251), so the two arms agree at or above that
    //   floor AND ONLY THERE. Below it the display policy is refused outright, so there is no
    //   silent band — asserted, not reasoned.
    expect(() => rockySurfacePack(FIRED_MOONS[0].cond,
      { displayRadiusEarth: gameDisplayRadiusEarth(0), gates: ALL_ON })).toThrow(PackContractError);

    // (a2) ⭐ THE RECIPROCAL HALF OF THE PAIR, GATED ON THE EMITTED PRODUCT — ADDED 2026-08-19.
    //      `uCraterAmp` and `uCraterScale` are an EXACT reciprocal pair by law
    //      (src/worldengine/shaders/craterRelief.glsl.js:29, src/worldengine/port/craterUniforms.js:150),
    //      and both analytic-normal call sites skip a divide they would otherwise owe BECAUSE of it
    //      (src/objects/Planet.js:312, src/objects/Planet.js:1385). The pack routes ONE half through
    //      the display seam and forwards the other raw, so the pair is now two different kinds of
    //      number and the shipped invariant test is structurally blind to that: it asserts
    //      tests/crater-uniform-law.test.js:74 `      expect(u.amp * u.scale).toBeCloseTo(1, 12);` on `craterUniformsFrom`'s OWN fields,
    //      which is no longer what the pack emits. MEASURED: double `uCraterAmp` in the pack and
    //      crater-uniform-law.test.js stays fully green. So the product is re-gated HERE, on what
    //      actually leaves the pack, under the game policy.
    // ⚠ `toBeCloseTo(1, 12)` AND NOT `=== 1`, and that is measured rather than cautious: the
    //   emitted product is EXACTLY 1 on only 38 of the 53 fired bodies (max |p-1| = 1.11e-16), the
    //   two arms rounding in a different order. The shipped gate cited above uses the same idiom for
    //   the same reason. An `=== 1` here would red on today's correct pack.
    // ⛔ THIS GATE IS THE GAME ARM ONLY, and the limitation is the finding rather than an omission:
    //   under any NON-identity display policy the emitted product is `dispR / R`, not 1 — measured
    //   at a pseudo-radius of the square root of R it reaches 10.77 on the smallest moon in this
    //   corpus. A second front-end must resolve `uCraterAmp` itself; see DECISION 1's second half in
    //   the pack for why the fix needs an inverse-km driver shape at the PORT layer and so is not
    //   available in the pack. What this gate buys is that the day either half moves, this reds.
    for (const x of km) {
      const ctx = ctxFor(x);
      const { drivers } = packFor(x);
      const resolvedScale = resolveDriver('uCraterScale', drivers.uCraterScale, ctx);
      expect(drivers.uCraterAmp * resolvedScale,
        `${x.id}: uCraterAmp must be the reciprocal of the RESOLVED uCraterScale`).toBeCloseTo(1, 12);
    }

    // (b) AND THE TWO POLICIES DISAGREE, WITH THE RATIO PRINTED. The blueprint's own arithmetic:
    //     at a display radius of 4 (the game's answer for a 4 R⊕ body) against 2 (the lab's R^0.5),
    //     the frequency is exactly 2x, because featureFrequencyFromKm is exactly linear in it.
    const b = km[0];
    const base = ctxFor(b);
    const driver = packFor(b).drivers.uCraterScale;
    const atGame = resolveDriver('uCraterScale', driver, { ...base, displayRadiusEarth: 4 });
    const atLab = resolveDriver('uCraterScale', driver, { ...base, displayRadiusEarth: 2 });
    expect(atGame / atLab).toBe(2);
    expect(atGame).not.toBe(atLab);
    // ...and per body, at the body's own two policy answers.
    for (const x of km.slice(0, 10)) {
      const ctx = ctxFor(x);
      const R = x.cond.radiusEarth;
      const d = packFor(x).drivers.uCraterScale;
      const g = resolveDriver('uCraterScale', d, ctx);
      const l = resolveDriver('uCraterScale', d, { ...ctx, displayRadiusEarth: Math.sqrt(R) });
      expect(g / l, `${x.id} R=${R}`).toBeCloseTo(Math.sqrt(R), 9);
      if (R !== 1) expect(g).not.toBe(l);
    }
    // ⛔ AND THE BYTE-IDENTITY ARM AGAINST THE LAB IS NOT ATTEMPTED, because it is structurally
    //    impossible: planet-lod-lab.html:5358 resolves at the REAL radius and then applies a
    //    further display multiply (R^1.5), while every other km-keyed lab uniform resolves at the
    //    display pseudo-radius alone (R^0.5). The pack may not carry that trailing multiply — it is
    //    the front-end's — so what is gated here is the stated POLICY DIFFERENCE, and the number
    //    being kept is the game's.

    // (c) THE SHIPPED TEMPLATE'S SECOND HALF, RESTORED — REPLACING A [CONTROL] THAT COULD NOT FAIL
    //     FOR ANYTHING THIS FILE IS ABOUT (corrected 2026-08-19). The old line resolved the plain
    //     `cu.scale` under two display radii and asserted the two agreed. But `resolveDriver`'s
    //     FIRST branch returns a finite number unchanged BEFORE `ctx` is read at all
    //     (src/worldengine/port/writePackUniforms.js:156 `  if (typeof d === 'number') {`), so both sides evaluated to the same
    //     variable. MEASURED with six mutants — the pack emitting `cu.scale`, `sizeKm` resolving
    //     eagerly, the seam hardcoding its radius, `C_CRATER` doubled, `uCraterAmp` accidentally
    //     km-shaped — every one of them reds the km-set gate or arm (a) or arm (b), and NOT ONE
    //     reds that line. The only mutant that could was one to the port's own number passthrough,
    //     which is tests/pack-contract.test.js's property and not a pack suite's.
    //
    // ⭐ WHAT THE SHIPPED PACKS ASSERT IN THIS ROW IS THE OTHER HALF, and this pack had dropped it:
    //     tests/driver-pack-limbdeck.test.js:473 and tests/driver-pack-polardeck.test.js:665 both
    //     state that EVERY driver is identical under the two display policies. This pack inverts
    //     that for its km-shaped names — which is the whole point — so the honest form is the same
    //     assertion with exactly the stated exceptions. It is falsifiable by a PACK mutant, which is
    //     what the line it replaces was not: making a THIRD driver km-shaped by accident (the
    //     natural mistake, `uCraterAmp` being the reciprocal) reds it immediately.
    // ⭐⭐ ONE -> TWO AT B2 LEG 3, 2026-08-20, AND THE SECOND NAME IS THE WHOLE OF THAT LEG.
    //     `uNoiseScale` is now emitted as `sizeKm(macroWavelengthKm(condition), C_MACRO)`, so it
    //     crosses the SAME policy seam `uCraterScale` does. ⛔ The list is ORDERED, not a set: the
    //     filter walks `ROCKY_SURFACE_UNIFORMS`, so the order here is that array's order and a name
    //     appended in the wrong place reds this rather than passing silently.
    //     ⚠ AND THIS IS THE GATE THAT SAYS THE NEW DRIVER REALLY IS km-SHAPED. A `scalar(...)` or a
    //     plain number would be policy-invariant and would DROP OUT of `moved` — the exact silent
    //     regression this row exists for, one name over.
    for (const x of km.slice(0, 12)) {
      const gameCtx = ctxFor(x);
      const otherPolicy = { ...gameCtx, displayRadiusEarth: gameCtx.displayRadiusEarth * 2 };
      const { drivers } = packFor(x);
      const moved = ROCKY_SURFACE_UNIFORMS.filter((n) => JSON.stringify(resolveDriver(n, drivers[n], gameCtx))
        !== JSON.stringify(resolveDriver(n, drivers[n], otherPolicy)));
      expect(moved, `${x.id}: exactly TWO drivers may move with the display policy`)
        .toEqual(['uCraterScale', 'uNoiseScale']);
    }

    // (d) The un-fired branch forwards `scale` VERBATIM and is therefore policy-invariant — a
    //     divide-by-zero guard, not a null check, and stated rather than discovered.
    const u = UNFIRED_MOONS[0];
    const uDriver = packFor(u).drivers.uCraterScale;
    expect(isPackDriver(uDriver)).toBe(false);
    expect(uDriver).toBe(CRATERS_OFF.scale);
    expect(sizeKm(1, C_CRATER).featureSizeKm).toBe(1);   // the shape the fired branch emits
  });

  it('FAMILY 18 · draws NO entropy — two macroSeeds give byte-identical drivers', () => {
    // Non-port 6: this pack asserts no `macroSeed` because it reads none. That omission is only
    // honest if the pack really is seed-free, so seed-independence is the gate that stands in for
    // the assertion.
    for (const b of [FIRED_MOONS[0], SOLID[0], ICY[0] || SOLID[1]]) {
      const a = rockySurfacePack(b.cond, { ...ctxFor(b), macroSeed: 1 });
      const c = rockySurfacePack(b.cond, { ...ctxFor(b), macroSeed: 0x7fffffff });
      expect(JSON.stringify(a.drivers), b.id).toBe(JSON.stringify(c.drivers));
    }
    expect(PACK_CODE).not.toMatch(/Math\.random|Date\.now|macroSeed|alea|animRate|ctx\.relevance/);
    // ...and it is a pure function of the condition: two calls on the same body agree exactly.
    const b = FIRED_MOONS[1];
    expect(JSON.stringify(packFor(b).drivers)).toBe(JSON.stringify(packFor(b).drivers));
  });

  it('FAMILY 19 · SCOPE FENCE: it names no out-of-family uniform and bakes no attribute', () => {
    // The declared non-ports, asserted as ABSENCES from the pack's own output rather than as
    // feature claims. A reader must be able to SEE that this pack never touched them.
    const names = Object.keys(packFor(FIRED_MOONS[0]).drivers);
    expect(new Set(names)).toEqual(new Set(ROCKY_SURFACE_UNIFORMS));
    // ⭐ THE THREE OFFSET NAMES LEFT THIS LIST IN STEP 9c, AND THE MOVE IS THE POINT. They are
    // still not DERIVED here — non-port 3 — but they are now EMITTED, forwarded verbatim off the
    // front-end's ctx. FAMILY 29 is the gate that says so; leaving them here would have made this
    // family assert the opposite of what the pack now does.
    // ⭐ `uNoiseScale` LEFT THIS LIST AT B2 LEG 3, 2026-08-20, and it is the same move the three
    // offset names made at Step 9c one comment up: it is EMITTED now (ledger P-10 / M-09), so
    // leaving it here would have made this family assert the opposite of what the pack does. The
    // arm that matters is not this list at all — FAMILY 17 gates that it is km-SHAPED, and
    // FAMILY 11's literal allowlist gates that its constants were forwarded rather than typed here.
    // ⛔ `uDispDomainScale` STAYS, and the two must not be confused: it is the OTHER half of P-14's
    // split, ruled `accepted-loss` at P-15, and it has no producer on either side. Same neighbourhood
    // in the GLSL, different question.
    const FORBIDDEN_NAMES = [
      'uDispDomainScale', 'uIcenessAlbedo', 'uIceColor', 'uBaseColor', 'accentColor'];
    for (const n of FORBIDDEN_NAMES) {
      expect(names, `${n} is outside this pack's declared family`).not.toContain(n);
      expect(PACK_CODE.includes(n), `rockySurface.js code names ${n}`).toBe(false);
    }
    expect(packFor(FIRED_MOONS[0]).attributes).toEqual({});
    // ...and every emitted name really is on the lab material (FAMILY 23 does the throw half).
    const u = buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms;
    for (const n of ROCKY_SURFACE_UNIFORMS) expect(u[n], n).toBeTruthy();
  });

  it('FAMILY 28 · [CONTROL] uPerturb is NOT the factory default — the coincidence that fools instruments', () => {
    // ⚠ THE TRAP, NAMED. `state.perturb` is the lab GUI default 0.55 (planet-lod-lab.html:902) and
    // the material factory default is ALSO 0.55 (src/worldengine/shaders/uniforms.js:33). So on a
    // body at g = 1 the relief envelope is ~1 and the product is the default again — a two-frame
    // before/after comparison CANNOT distinguish "the pack wrote the relief envelope" from "the
    // material already had the factory value". Three assertions close that:
    //   (i) the constant is a PINNED REFERENCE, not a transcribed literal;
    expect(PERTURB_BASE).toBe(makeUniforms(LAB_WORLD_LIGHT).uPerturb.value);
    expect(buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms.uPerturb.value).toBe(PERTURB_BASE);
    //   (ii) on the real population the written value is NOT the default — measured 2026-08-19:
    //        0 of 66 solid planets and 0 of 58 solid moons land on exactly 0.55;
    const same = [...SOLID, ...SOLID_MOONS].filter((b) => packFor(b).drivers.uPerturb === PERTURB_BASE);
    expect(same.length, 'a body at exactly the default is indistinguishable from an unwritten one').toBe(0);
    //   (iii) and the written value is the pack's, on a real material, not a leftover.
    for (const b of [...SOLID.slice(0, 6), ...SOLID_MOONS.slice(0, 6)]) {
      const { material } = composeOnto(b);
      expect(material.uniforms.uPerturb.value, b.id).toBe(packFor(b).drivers.uPerturb);
      expect(material.uniforms.uPerturb.value, b.id).not.toBe(PERTURB_BASE);
    }
    // ⚠ CARRIED DEFECT, NOT FIXED HERE: `reliefEnvelope`'s first parameter is dead (labCore.js:1140
    // says so; the finding is filed under docs/WORKSTREAMS/world-engine-gravity-selfcompression-
    // 2026-07-28/evidence/FINDING-uperturb-radius-blind.md). The pack passes the radius anyway for
    // call-site symmetry with the lab's own call, and the deadness is asserted here so the day it
    // stops being dead this line goes red instead of the port silently changing meaning.
    expect(reliefEnvelope(1, 1.0)).toBe(reliefEnvelope(1000, 1.0));
    // ...and the gravity fallback is the LAB's 1.0, not craterUniforms.js:157's 0.5. Taking the
    // crater law's would raise the envelope on any body missing the field.
    const noG = { ...SOLID[0].cond, surfaceGravity: undefined };
    const r = rockySurfacePack(noG, { displayRadiusEarth: 1, gates: ALL_ON, ...CTX_OFFSETS });
    expect(r.drivers.uPerturb).toBe(PERTURB_BASE * reliefEnvelope(noG.radiusEarth, 1.0));
    expect(r.drivers.uPerturb).not.toBe(PERTURB_BASE * reliefEnvelope(noG.radiusEarth, 0.5));
    expect(Number.isFinite(r.drivers.uPerturb), 'the ?? is load-bearing: Math.max(undefined, 1e-3) is NaN').toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §F — REGISTRY-READY, THE CLOSURE, THE SHADER FACTS, AND THE POPULATION.
// ═════════════════════════════════════════════════════════════════════════════
describe('F — the entry is registry-ready and collision-free', () => {
  it('FAMILY 20 · carries the four contract fields, frozen, in the shape PACKS entries have', () => {
    expect(Object.isFrozen(ROCKY_SURFACE_ENTRY)).toBe(true);
    expect(ROCKY_SURFACE_ENTRY.name).toBe('rockySurface');
    expect(typeof ROCKY_SURFACE_ENTRY.applies).toBe('function');
    expect(typeof ROCKY_SURFACE_ENTRY.pack).toBe('function');
    expect(ROCKY_SURFACE_ENTRY.pack).toBe(rockySurfacePack);
    expect(Array.isArray(ROCKY_SURFACE_ENTRY.gates)).toBe(true);
    expect(ROCKY_SURFACE_ENTRY.applies.length).toBeLessThanOrEqual(2);
    expect(Object.keys(ROCKY_SURFACE_ENTRY).sort()).toEqual(['applies', 'gates', 'name', 'pack']);
  });

  it('FAMILY 21 + 26 · ⭐ REGISTERED AT STEP 10a — the inverted fence, and the identity gate', () => {
    // ⛔ INVERTED, NOT DELETED — the shape tests/driver-pack-polardeck.test.js:575-580 records. Until
    // Step 10a this read `not.toContain('rockySurface')` and existed to announce the open hole. A
    // deleted fence leaves nothing behind that reds if someone later drops the entry, and "the
    // feature silently leaves" is the failure the whole registration sequence is built against.
    //
    // ⚠ THE OLD COMMENT SAID "FIVE EXISTING ASSERTIONS". MEASURED AT REGISTRATION: EIGHT in the pack
    // suites, plus eleven in tests/material-parity-list.test.js. The three the count missed are this
    // fence itself, gas-body-lab-material.test.js's npm-surface walker (which read English prose in
    // rockySurface.js as a third npm dependency), and 6e's two solid-planet mount assertions, whose
    // premise — "no solid body swaps" — inverts for the same reason this one does.
    const names = PACKS.map((e) => e.name);
    expect(names, 'Step 10a registers the pack — see the entry appended after POLAR_DECK_ENTRY')
      .toContain('rockySurface');
    // NAME UNIQUENESS, unchanged and still passing in both states.
    expect(names.filter((n) => n === 'rockySurface').length).toBe(1);
    expect(new Set(names).size).toBe(names.length);
    // THE IDENTITY GATE: the array must hold the FROZEN ENTRY THIS MODULE EXPORTS, never a
    // hand-retyped copy at the composition point. A retyped predicate would satisfy a shape check
    // and then drift from the one gated in §A.
    const entry = PACKS.find((e) => e.name === 'rockySurface');
    expect(entry).toBe(ROCKY_SURFACE_ENTRY);
    expect(entry.pack).toBe(rockySurfacePack);
    expect(names.indexOf('rockySurface')).toBe(names.length - 1);   // APPENDED, never prepended
    // …and the predicate that composes is the complement one, not `=== 'rocky'`: the ≥95%-of-moons
    // bar Step 10 has to clear is decided on this line and nowhere else.
    expect(entry.gates).toEqual(['craters', 'ejecta']);
  });

  it('FAMILY 22 · names NO uniform any shipped pack names — by NAME LOOKUP, never by index', () => {
    // src/worldengine/drivers/index.js:213 makes two packs naming one uniform an ERROR rather than
    // a last-writer-wins, because array order would otherwise decide what renders. The predicates
    // are disjoint TODAY, so the collision throw is inert — but inert is not the same as
    // impossible, and index.js:104-110 records that Step 10 appends an entry, which is one prepend
    // away from a positional read comparing against the WRONG pack and passing green.
    const gas = GAS[0];
    const mine = new Set(ROCKY_SURFACE_UNIFORMS);
    let compared = 0;
    for (const name of ['giantDeck', 'limbDeck', 'polarDeck']) {
      const e = PACKS.find((x) => x.name === name);
      expect(e, `${name} must be registered to compare against`).toBeTruthy();
      const ctx = { ...labPackCtx(gas.d, gas.cond), gates: gatesFor(e) };
      const theirs = new Set(Object.keys(e.pack(gas.cond, ctx).drivers));
      expect(theirs.size, `${name} must emit something`).toBeGreaterThan(2);
      const overlap = [...mine].filter((n) => theirs.has(n));
      expect(overlap, `${name} collides with rockySurface`).toEqual([]);
      compared++;
    }
    expect(compared).toBe(3);
    // ...and the predicates really are complementary on the whole population, so the collision
    // throw stays inert by construction rather than by luck.
    for (const b of PLANETS) {
      const mineApplies = ROCKY_SURFACE_ENTRY.applies(b.cond) === true;
      for (const name of ['giantDeck', 'limbDeck', 'polarDeck']) {
        const e = PACKS.find((x) => x.name === name);
        expect(mineApplies && e.applies(b.cond) === true, `${b.id} / ${name}`).toBe(false);
      }
    }
  });

  it('FAMILY 23 · every uniform it names EXISTS on the lab material, and a typo THROWS', () => {
    const u = buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms;
    for (const n of ROCKY_SURFACE_UNIFORMS) {
      expect(u[n], n).toBeTruthy();
      expect('value' in u[n], n).toBe(true);
    }
    // writePackUniforms throws on a name the material does not carry, which is the mechanism; this
    // asserts the precondition directly so a typo is a red test rather than a red game.
    expect(() => writePackUniforms(buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms,
      { uCraterDensty: scalar(0.5, { gate: CRATER_GATE }) }, { displayRadiusEarth: 1, gates: ALL_ON }))
      .toThrow(/no uniform named 'uCraterDensty'/);
    // ...and the whole pack writes onto a real material without a throw, on every admitted body.
    for (const b of [...SOLID.slice(0, 10), ...SOLID_MOONS.slice(0, 10)]) {
      expect(() => composeOnto(b), b.id).not.toThrow();
    }
  });

  it('FAMILY 24 · NO RENDERER IN THE IMPORT CLOSURE, and no npm dep giantDeck did not carry', () => {
    // ⭐ A PROPERTY NEITHER MY OTHER GATES NOR THE SHIPPED FENCE CAN SEE. tests/pack-contract.test.js
    // walks only `featureScale.js` and `writePackUniforms.js`; it never walks a pack, so a pack that
    // reached a renderer would pass it. ⚠ NOT "zero bare specifiers": `alea` and `simplex-noise` are
    // genuinely reachable through the base tree and giantDeck already carries both. The gate is
    // therefore SET CONTAINMENT against the shipped pack's closure, so a NEW dependency is a
    // deliberate edit.
    //
    // ⛔ THE WALKER RUNS ON COMMENT-STRIPPED SOURCE, AND THAT IS A MEASURED FIX, NOT TIDINESS —
    // see the [CONTROL] at the bottom of this test.
    const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g;
    const closureOf = (entryRel, strip = true) => {
      const seen = new Set(); const bare = new Set();
      const walk = (rel) => {
        if (seen.has(rel)) return;
        seen.add(rel);
        const raw = read(rel);
        const src = strip ? stripCommentsPreservingOffsets(raw) : raw;
        IMPORT_RE.lastIndex = 0;
        let m;
        while ((m = IMPORT_RE.exec(src)) !== null) {
          const spec = m[1];
          if (spec.startsWith('.') || spec.startsWith('/')) {
            walk(join(dirname(join(ROOT, rel)), spec).slice(ROOT.length + 1));
          } else bare.add(spec);
        }
      };
      walk(entryRel);
      return { files: [...seen].sort(), bare: [...bare].sort() };
    };
    const mine = closureOf('src/worldengine/drivers/rockySurface.js');
    const giant = closureOf('src/worldengine/drivers/giantDeck.js');
    expect(mine.bare).not.toContain('three');
    expect(mine.files.some((f) => /rendering|shaders|glsl|\.html$/.test(f))).toBe(false);
    // [CONTROL] the walker is not vacuous — it really does find the bare specifiers that ARE there.
    expect(giant.bare.length).toBeGreaterThan(0);
    expect(mine.bare.length).toBeGreaterThan(0);
    expect(mine.bare.every((b) => giant.bare.includes(b)), `new deps: ${JSON.stringify(mine.bare)}`).toBe(true);
    // ⚠ THE labCore.js DECISION, MEASURED RATHER THAN ASSERTED AS TASTE. `reliefEnvelope` lives in a
    // 1200-line module, and the alternative weighed before writing was to extract it to a leaf. The
    // measurement is what decided it: labCore.js has exactly ONE import and it is to a module that
    // imports nothing, so the whole file costs the closure ZERO npm deps and ZERO renderer surface.
    expect(mine.files).toContain('src/worldengine/base/labCore.js');
    expect(mine.files).toContain('src/worldengine/base/featureScale.js');
    expect(closureOf('src/worldengine/base/featureScale.js').bare).toEqual([]);
    expect(closureOf('src/worldengine/base/featureScale.js').files)
      .toEqual(['src/worldengine/base/featureScale.js']);

    // [CONTROL] THE RAW-TEXT WALKER, WHICH THE SHIPPED SUITES USE, IS DEFEATED BY THIS FILE.
    // rockySurface.js's header contains prose of the form `… "…" from "…"`, and the regex is
    // comment-blind: it reports a bare specifier that is an English sentence. Measured 2026-08-19 —
    // this is the first pack whose documentation broke the walker, and asserting it here is what
    // keeps the comment-stripping above from later being deleted as noise.
    const raw = closureOf('src/worldengine/drivers/rockySurface.js', false);
    const phantom = raw.bare.filter((s) => !mine.bare.includes(s));
    expect(phantom.length, 'the raw walker must produce the phantom this fix removes').toBeGreaterThan(0);
    expect(phantom.some((s) => /\s/.test(s)), 'and the phantom is prose, not a package name').toBe(true);
  });

  it('FAMILY 25 · SHADER FACTS: each gated uniform is a bare early-out gate in the GLSL', () => {
    // The pack's whole claim — "0 deletes the pass exactly, a real density restores it" — is a
    // claim about GLSL this suite cannot execute. It is pinned as source instead of assumed.
    const h = read('src/worldengine/shaders/height.glsl.js');
    expect(h).toContain('if (uCraterDensity <= 0.0) return;');
    const cr = read('src/worldengine/shaders/craterRelief.glsl.js');
    expect(cr).toContain('if (uEjectaStrength <= 0.0) return;');
    // …and the ejecta amplitude really is the product of the gate and the amplitude, so the gate is
    // a bare multiplicand there too rather than a second, differently-shaped switch.
    expect(cr).toContain('uEjectaStrength * uEjectaAmp');
    // uPerturb is a bare multiplicand on the relief amplitude — which is why it rides ONCE, and why
    // `uCraterAmp` is the raw crater law's value, unmultiplied.
    const s = read('src/worldengine/shaders/planetShaders.glsl.js');
    expect(s).toContain('float reliefAmp = uPerturb * mix(0.7, 1.0, uLodRamp);');
    // Every one of the 21 is DECLARED in the shared uniform factory — the names are not invented here.
    const uSrc = read('src/worldengine/shaders/uniforms.js');
    for (const n of ROCKY_SURFACE_UNIFORMS) {
      expect(new RegExp(`\\b${n}\\s*:`).test(uSrc), `${n} must be declared in uniforms.js`).toBe(true);
    }
  });

  it('FAMILY 27 · POPULATION STATISTICS vs a RE-DECLARED prior — craters are moon-LED, no longer moon-ONLY', () => {
    // ⭐⭐ THE PRIOR WAS RE-DECLARED 2026-08-20 (B2 leg 1), AND THE MOVE IS THE LEG'S POINT, NOT A NUDGE.
    // THE OLD PRIOR, kept verbatim as the thing corrected: "`craterUniforms.js:79 CRATER_MIN_DENSITY` is
    // a COST floor: a body showing less than one crater on the whole visible disc gets none. Big
    // atmosphere-bearing planets are exactly the bodies that fail it; small airless moons are exactly
    // the bodies that pass. So the prior is 'a small minority of solid PLANETS and a large majority of
    // solid MOONS'." It measured planets 3 of 66 (4.5%), moons 50 of 58 (86.2%), 15 distinct densities.
    // ⛔ THAT PRIOR'S SECOND HALF WAS AN ARTEFACT OF THE GATE, NOT A FACT ABOUT PLANETS. The 4.5% came
    // from a FIXED DENSITY floor standing in for "one crater on the visible disc" — a substitution that
    // is only valid at one uCraterScale, and B2 leg 1 moved the scale. With the honest per-body form
    // (`density * visibleCells >= CRATER_MIN_VISIBLE`, craterUniforms.js:145) and the re-derived
    // visibility floor, a big planet's craters are small and numerous rather than absent.
    // ⭐ THE NEW PRIOR, declared before the numbers: small airless bodies still pass far more often than
    // big atmosphere-bearing ones — that is physics (t_exp erosion + atmospheric screening) and it must
    // survive — so `moonFrac > planetFrac` stands. What must NOT stand is the planet share being a
    // rounding error. MEASURED 2026-08-20 on this file's own 24 seeds: planets 28 of 66 (42.4%), moons
    // 52 of 58 (89.7%), 17 distinct moon densities, 41 distinct uCraterScale across the fired set.
    // ⚠ FLOORS, NOT EQUALITIES, for the same reason as before: the moon-formation window is open, so
    // the moon census is live and moving, and pinning 52 would red this file for a reason that has
    // nothing to do with the pack.
    const planetFrac = FIRED_PLANETS.length / SOLID.length;
    const moonFrac = FIRED_MOONS.length / SOLID_MOONS.length;
    expect(planetFrac, 'measured 0.424 — a collapse back toward 0.045 means the gate re-fixed itself')
      .toBeGreaterThan(0.20);
    expect(moonFrac).toBeGreaterThan(0.5);
    expect(moonFrac).toBeGreaterThan(planetFrac);
    expect(FIRED_MOONS.length).toBeGreaterThan(20);
    const densities = new Set(FIRED_MOONS.map((b) => valueOf(b, 'uCraterDensity').toFixed(9)));
    expect(densities.size, 'a dead wire would give one repeated value').toBeGreaterThan(8);
    for (const b of FIRED_MOONS) expect(valueOf(b, 'uCraterDensity'), b.id).toBeGreaterThan(0);
    // ⭐ AND THE SIZE UN-PINS, which the old prior could not have seen because it did not look:
    // uCraterScale was one value on every body whose visibility floor bound, and 21 across all 485
    // cratered bodies of `lab-procedural-0…199`. It is 41 across this file's fired set now.
    const scales = new Set([...FIRED_PLANETS, ...FIRED_MOONS].map((b) => valueOf(b, 'uCraterScale').toFixed(9)));
    expect(scales.size, 'measured 41 — one value would mean the floor still binds on everything').toBeGreaterThan(5);

    // ⛔ AND THE STEP-10 GATE IS **NOT** CLAIMED HERE — nor, any longer, is it the ≥95% bar.
    // docs/FEATURES/one-pipeline-two-frontends-PLAN.md:460 used to want ">=95% of plain moons resolve
    // a non-zero uCraterDensity with >=20 distinct values"; that clause was WITHDRAWN 2026-08-19 as
    // unreachable and is now a distinctness gate. ⭐ RE-MEASURED 2026-08-20 over `lab-procedural-0…199`
    // after B2 leg 1: **547 of 632 plain moons = 86.6%** non-zero, up from 473 = 74.8%. The 20-point
    // shortfall the old text blamed on `CRATER_MIN_DENSITY` is now 8.4 points, and the remaining 85
    // refusals split **8 by the schedule not firing** (T_eq ≥ 450 K or P ≥ 200 bar — no floor reaches
    // those) and **77 by `CRATER_MIN_VISIBLE`**, which is still a CRATER-LAW question and still not a
    // predicate one. This corpus measures 89.7% on the pack's own 24 seeds; the difference between the
    // two figures is the moon POPULATION and the BodyRenderer branch, neither of which is in this
    // commit. Saying so is part of the measurement. (That plan line's "today: 0 of ~571" was also a
    // population figure the blueprint could not reproduce — 632 over the ledger's corpus, 770 over
    // FENCE-221 — which is the second reason this file pins no moon count.)
    expect(moonFrac).toBeLessThan(1.0);
  });

  it('FAMILY 27b · [CONTROL] a single-body read cannot distinguish "absent" from "dead wire"', () => {
    // The whole reason FAMILY 27 is a population gate. BOTH of these are CORRECT outputs of a
    // working pack, and a live look at either one alone would license the opposite conclusion.
    expect(UNFIRED_MOONS.length, 'the corpus must contain both outcomes').toBeGreaterThan(0);
    expect(FIRED_MOONS.length).toBeGreaterThan(0);
    const dead = packFor(UNFIRED_MOONS[0]);
    expect(dead.meta.cratersFired).toBe(false);
    expect(valueOf(UNFIRED_MOONS[0], 'uCraterDensity')).toBe(0);
    // …and on that same body every OTHER driver is live, which is the only thing that tells the two
    // apart from outside: an un-cratered world still has a palette, an iceness and a relief.
    expect(dead.drivers.uWeatheredColor.some((c) => c > 0)).toBe(true);
    expect(dead.drivers.uPerturb).toBeGreaterThan(0);
    const alive = packFor(FIRED_MOONS[0]);
    expect(alive.meta.cratersFired).toBe(true);
    expect(valueOf(FIRED_MOONS[0], 'uCraterDensity')).toBeGreaterThan(0);
    // …and the two bodies are the same class, so the difference is the BODY and not the pack.
    expect(ROCKY_SURFACE_ENTRY.applies(UNFIRED_MOONS[0].cond)).toBe(true);
    expect(ROCKY_SURFACE_ENTRY.applies(FIRED_MOONS[0].cond)).toBe(true);
  });
});
