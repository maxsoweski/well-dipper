// src/worldengine/drivers/giantSurface.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #8 — THE GAS-CLASS COMPLEMENT. Ledger rows P-11 (gas half), P-12 and P-13.
//
//     giantSurfacePack(condition, ctx) -> { drivers, attributes, meta }
//
// ⭐⭐ IT IS ONE PACK BECAUSE THE THREE ROWS ARE ONE DEFECT. `rockySurface` and `solidOptics` both
// register on `compositionClass(condition) !== 'gas'`, so every uniform they carry is unwritten on
// a gas-class body and answers the LAB FACTORY DEFAULT instead of the value the game already has in
// hand. Measured at 0604d13 on the gas giant *Meameinath*: `uTermStrength` reads 0 and
// `uBioGroundCover` reads 0. This pack's predicate is the exact complement of theirs, and it is the
// wire for all three families:
//
//     terminatorOpticsOf ─────────────────────> the terminator triple (P-11's gas half, 3)
//     surfacePaletteOf -> applyAlbedoTransfer ┐
//     icenessOf / biosphereOf ────────────────┴> the ground palette + 2 scalars (P-12, 7)
//     (ctx.macroOffset / detailOffset / craterOffset) ─> the three domain offsets, FORWARDED (P-13, 3)
//
// ⛔ NOTHING HERE IS DESIGNED. Every one of the thirteen is a forward of a function the GAME ALREADY
// CALLS ON THIS BODY, unconditionally and with no composition branch:
// src/generation/PlanetGenerator.js:809 `      planetData.landPalette = applyAlbedoTransfer(surfacePaletteOf(condition), {`,
// src/generation/PlanetGenerator.js:827 `      planetData.iceness = icenessOf(condition);`,
// src/objects/Planet.js:1610 `    const optics = atmosphereOpticsOf(condition); const term = terminatorOpticsOf(condition);   // ⛔ B3-1 RIDES THIS LINE (see :1403). \`term\` is the SHARED module the packs read, not a second law.`,
// src/objects/Planet.js:1684 `          uMacroOffset: { value: reliefSeed.macro },`.
// So a gas body's legacy render HAS these values today and the same body swapped onto the lab
// material LOSES them. This module is the wire, and closing the rows makes the swap match the render
// rather than making anything new.
//
// ⭐⭐ THE PIXEL CONSEQUENCE IS NOT UNIFORM ACROSS THE THREE ROWS, AND IT IS MEASURED RATHER THAN
// ASSUMED — read this before concluding that closing P-12 makes a gas giant look different.
// ---------------------------------------------------------------------------------------------
// The GLSL read sites were enumerated for all thirteen names. The dividing line is
// src/worldengine/shaders/planetShaders.glsl.js:652 `            albedoCol = mix(albedoCol, zonalBandCol(bandN, bandNraw, bandPos, vBand, vShear, vMush, vStorm), bandMask);`,
// where the deck REPLACES the whole solid-surface albedo story. On a gas body that mask is 1.0 —
// src/worldengine/shaders/planetShaders.glsl.js:634 `          float bandMask = uBandStrength * provinceWeight(PROV_BANDS);`,
// with `uBandStrength` 1.0 from giantDeck and the province weight neutral at its 1.0 floor.
//
//  · P-13, THE THREE OFFSETS — PIXEL-LIVE, and the strongest of the three. They feed the HEIGHT
//    field, which is geometry and runs before any albedo:
//    src/worldengine/shaders/heightNoise.glsl.js:128 `            vec3 off = (i < 3) ? uMacroOffset : uDetailOffset;`
//    reads them with no composition gate between the default and the pixel. Unwritten, all 343
//    gas-class bodies draw their base relief from the SAME domain — the 5d hex-collapse the row
//    names, alive on the most prominent third of the population. `zonalBandCol` reads the perturbed
//    `N` and `vPos`, so the bands themselves ride the domain the offsets choose.
//  · P-11, THE TERMINATOR TRIPLE — PIXEL-LIVE. It is a LIGHTING-stage additive term, downstream of
//    the albedo replacement and untouched by it:
//    src/worldengine/shaders/planetShaders.glsl.js:953 `          if (uTermStrength > 0.0){`
//    early-outs on the factory 0, so a swapped gas body renders NO twilight band while the same
//    body on the legacy material renders one. This is the one row whose closure removes a visible
//    regression B7 would otherwise ship.
//  · P-12, THE PALETTE — ⚠ SIX OF THE SEVEN ARE PROVABLY INERT ON A GAS BODY TODAY, AND SAYING SO
//    IS PART OF THE MEASUREMENT. `uFreshColor`, `uSedColor`, `uCratonColor`, `uBioGroundColor`,
//    `uBioGroundCover` and `uIcenessMix` are read ONLY inside the ground-albedo chain the line above
//    discards at mask 1.0. Writing them changes the uniform VALUES the ledger measures and changes
//    no pixel. ⭐ `uWeatheredColor` IS THE EXCEPTION and it is why the family is not skipped: it has
//    two read sites OUTSIDE the replacement — the Rayleigh brightening term in `litSurf`, and
//    src/worldengine/shaders/planetShaders.glsl.js:975 `          vec3 emissive = uWeatheredColor * uEmissive * (1.0 - blanketMask);`.
//    ⛔ THE SIX ARE STILL WRITTEN. B7 DELETES THE LEGACY FALLBACK, so a name left at the factory
//    default becomes permanent rather than recoverable, and a row closed by declaring the loss
//    acceptable is the "suppress rather than rule" move P-11's own cell refuses. The honest claim is
//    that P-12's gas half closes on VALUES, not on appearance — and it is written here so nobody
//    reports a look change from it, and nobody later rediscovers the inertness as a bug.
//
// ⛔⛔ WHY THIS IS NOT INSIDE `giantDeckPack`, WHICH IS WHERE THE PLAN AIMED IT. Two measured
// blockers, either one fatal:
//  1. THE LAB CALLS `giantDeckPack` DIRECTLY — planet-lod-lab.html:1765 `      const _deck = giantDeckPack(_gcond, _dctx);` — with a ctx
//     that carries no offset triple. The offsets are REQUIRED-not-defaulted (see `offsetDriverBlock`),
//     so adding them to that pack throws on every gas preset in the lab. A pack reached through
//     `applyDriverPacks` is reached only by front-ends that built a full ctx.
//  2. THE DECK'S PREDICATE IS WIDER THAN GAS. It is `bandedEnvelopeOf` — gas OR an opaque CO2
//     shroud — so it co-applies with `rockySurface` and `solidOptics` on 130 rocky venus-typed
//     bodies that ALREADY receive all thirteen of these names. src/worldengine/drivers/index.js:324 `    // ⛔ COLLISION IS AN ERROR, NOT A LAST-WRITER-WINS. Two packs claiming one body is legal by`
//     makes that a throw at a player, not a merge.
// The complement predicate has neither problem, and it is the shape this tree already uses twice:
// src/worldengine/drivers/craterDeck.js:272 `    applies: (condition) => compositionClass(condition) === 'gas',` and its solid mirror.
//
// ⛔ WHAT IS DELIBERATELY NOT HERE — read this before adding a uniform.
//  1. THE LIMB PAIR. `uLimbExponent` and `uLimbColor` are already written on every gas body by
//     `limbDeck`, which is why P-11's residual after B3 leg 1 was the three `uTerm*` names and not
//     five. Naming them here is a collision, not a closure.
//  2. THE IMPACT FAMILY. `craterDeck` already carries all ten over this exact predicate. This pack
//     writes `uCraterOffset` and craterDeck writes none of the offsets — the two sets are disjoint
//     by name and the pack suite asserts it by lookup rather than by reading these two headers.
//  3. `uLimbStrength` / `uIcenessAlbedo` / `uDispDomainScale`. Each is a lab MASTER GATE or knob with
//     no per-body producer, and each is already refused with its reasoning at
//     src/worldengine/drivers/solidOptics.js:148 `  applies: (condition) => compositionClass(condition) !== 'gas',`'s pack. Refusing them again here
//     rather than re-arguing keeps one statement of the refusal.
//  4. THE 20 REMAINING FEATURE-DOMAIN OFFSETS (dune, dust, karst, glacial, fluvial, tessera, …).
//     The legacy material writes exactly the three this pack forwards and no others, so the residue
//     is the state the game already ships — an offset-FAMILY decision with 20 producers to find, not
//     three more driver lines. Stated at
//     src/worldengine/drivers/rockySurface.js:48 `THE OFFSET FAMILY IS NOW FORWARDED — AND STILL NOT DERIVED.` and not restated here.
//
// ⭐ TWO OF THE THREE FAMILIES ARE EXPORTED AS SHARED BLOCKS AND `rockySurface` IMPORTS THEM, which
// is B3 leg 2's shape one family over: src/worldengine/drivers/craterDeck.js:272 `    applies: (condition) => compositionClass(condition) === 'gas',`'s pack holds
// `craterDriverBlock` and the solid pack imports it, so ten lines have ONE expression rather than
// two copies. The terminator triple is NOT extracted, and the asymmetry is deliberate: its LAW
// already lives in a shared module both front-ends import, the only decision in its three lines is
// where the gate sits, and that gate NAME is imported from `solidOptics` rather than retyped — so
// there is nothing left for a second copy to disagree about. A block per family regardless of what
// the family carries would be symmetry for its own sake.
//
// ⛔ THREE-FREE, AND NO ENTROPY. The closure is base/ + display/ + port/ + two sibling packs, all of
// which the shipped packs already carry; this file adds NO npm dependency and opens NO alea stream.
// ⛔ NO `Math.random`, NO `Date.now`, NO `assertMacroSeed` — every driver is a pure function of the
// condition vector and of the three offset vectors the front-end hands over, so asserting a seed
// this pack never reads would be a check that cannot fail for a reason. The suite asserts seed
// INDEPENDENCE instead, so the day a seeded term joins the pack the omission ends loudly.
// ─────────────────────────────────────────────────────────────────────────────
import { compositionClass } from '../base/e1Regime.js';
import { terminatorOpticsOf } from '../base/terminatorOptics.js';
import { surfacePaletteOf, icenessOf, biosphereOf, BIO_PIGMENT } from '../base/surfaceMaterial.js';
import { applyAlbedoTransfer } from '../display/albedoTransfer.js';
// ⭐ THE GATE NAME IS IMPORTED, NEVER RETYPED. Both packs write `uTermStrength` over complementary
// populations and both must declare the same gate string in their registry entry; a second literal
// is how one population silently stops honouring the lab's terminator checkbox.
import { TERMINATOR_GATE } from './solidOptics.js';
import { scalar, assertDisplayPolicy, assertPackResult, resolveDriver, PackContractError } from '../port/writePackUniforms.js';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED BLOCK 1 — THE GROUND PALETTE (7). Imported by `rockySurface`.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * The seven ground-palette drivers, derived from the CONDITION and from nothing else.
 *
 * ⚠ IT CANNOT BE READ OFF THE BODY RECORD. The generator bakes an equivalent palette onto
 * `d.landPalette`, but a pack receives `condition` and never `d` — that is the contract's whole
 * point. Re-deriving is byte-identical by construction because both sides call the same two shared
 * functions in the same order, which is what the generator's own line (quoted in the header) shows.
 *
 * ⭐ THE `extra: { pigment: BIO_PIGMENT }` ARGUMENT IS LOAD-BEARING, NOT DECORATION, and it is the
 * single decision this block exists to hold in ONE place. The canopy albedo must ride the SAME
 * exposure scale as the ground endmembers it is mixed into; scaling it by its own luminance drifts
 * it out of relation with the rock, which
 * src/worldengine/display/albedoTransfer.js:42 `// through the SAME scale via opts.extra, which is the only correct way to add one: a pigment scaled by`
 * states as the only correct way to add one. Two packs deriving this from two copies is how one of
 * them keeps a ~4x-dark canopy after the other is fixed.
 *
 * ⛔ EMISSION ORDER IS THE ORDER `rockySurface` ALREADY HAD, so spreading this block in place leaves
 * `uniformsWritten` unchanged and the diff is a move rather than a re-ordering.
 *
 * ⛔ `.slice()` ON EVERY COLOUR, AND IT IS NOT DEFENSIVE PROGRAMMING. The writer hands the array to a
 * settable vector — src/worldengine/port/writePackUniforms.js:280 `        if (target && typeof target.set === 'function') target.set(...v);`
 * — and handing out a live array is how one body's tint follows another's. `applyAlbedoTransfer`
 * happens to return fresh arrays today; "no caller aliases my output" is a property of a module in
 * another directory, not of this one, and the failure it prevents is invisible on a still frame.
 *
 * ⛔ UNGATED, ALL SEVEN. There is no palette checkbox in either front-end to gate on, and a colour
 * behind a gate would leave a gated-off body wearing black ground.
 *
 * @param {object} condition  a body condition vector (deriveConditionVector / conditionFromBody).
 * @returns {{drivers: object, sp: object}}  `sp` comes back out so a caller's `meta` can report the
 *          palette without a SECOND derivation of the same body.
 */
export function surfacePaletteBlock(condition) {
  const sp = applyAlbedoTransfer(surfacePaletteOf(condition), { extra: { pigment: BIO_PIGMENT } });
  const drivers = {
    uWeatheredColor: sp.weathered.slice(),
    uFreshColor: sp.fresh.slice(),
    uSedColor: sp.sediment.slice(),
    // ⭐ `uCratonColor` IS NOT ON LEDGER ROW P-12'S LIST AND IT RIDES ALONG ON BOTH POPULATIONS — say
    // so rather than let it look like scope creep. Its producer already exists, its shader consumer
    // already reads it, and it is written by NOBODY in src/ outside this block: the ancient stable
    // shield renders at the factory tone on every body in the game.
    uCratonColor: sp.craton.slice(),
    uBioGroundColor: sp.pigment.slice(),
    // The two surface scalars. Both are modules the game already imports and already writes to its
    // LEGACY material, so the swap is what loses them; re-derived here for the same reason the
    // palette is.
    uBioGroundCover: biosphereOf(condition),
    uIcenessMix: icenessOf(condition),
  };
  return { drivers, sp };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED BLOCK 2 — THE THREE DOMAIN OFFSETS (3). Imported by `rockySurface`.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * One offset vector off the front-end's ctx, refused unless it is a 3-element array of finite
 * numbers.
 *
 * ⭐ WHY A THROW AND NOT A `?? ZERO` DEFAULT — this is the decision the block exists to single-source.
 * The uniform's factory default IS the zero vector
 * (src/worldengine/shaders/uniforms.js:158 `        uMacroOffset:  { value: new THREE.Vector3() },                // set from macroSeed`), and a zero domain offset is a
 * perfectly legal noise domain: it renders a plausible planet. It just renders the SAME planet's
 * relief as every other body on the material, which is a defect only two bodies side by side can
 * show. A default here would reproduce ledger row P-13 silently inside the very commit that closes
 * it, so the seam refuses instead.
 *
 * ⛔ THE ARRAY SHAPE IS CHECKED, NOT ASSUMED, AND `Array.isArray` IS THE POINT OF THE CHECK. A
 * `THREE.Vector3` has `.x/.y/.z` and no `.length`, so a front-end handing one over fails here loudly
 * rather than reaching the writer as a non-array and being written as a scalar. The pack tree may
 * not name a renderer type, so the guard is a positive shape assertion rather than a type test.
 */
function offsetOf(ctx, field, packName) {
  const v = ctx == null ? undefined : ctx[field];
  if (!Array.isArray(v) || v.length !== 3) {
    throw new PackContractError(
      `${packName}: ctx.${field} is REQUIRED and must be a 3-element array. It is the ` +
      'FRONT-END\'s per-body noise-domain offset, not a value this pack may derive: two divergent ' +
      'private seed-to-vector laws already exist and a third would agree with neither. Defaulting ' +
      'it to zero is legal, invisible on one body, and gives every body the same relief.',
    );
  }
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== 'number' || !Number.isFinite(v[i])) {
      throw new PackContractError(`${packName}: ctx.${field} component ${i} is not a finite number.`);
    }
  }
  return v;
}

/**
 * The three domain-offset drivers, FORWARDED VERBATIM off the front-end's ctx.
 *
 * ⛔ NOT ONE OF THE THREE IS COMPUTED HERE, and that refusal is older than this pack. There are TWO
 * divergent private seed-to-vec3 laws in the tree — the game's `reliefOffsets` and the lab's scalar
 * sin-hash — so SYNTHESISING a third inside a pack would be a new disagreement nothing can fail on.
 * Forwarding a front-end's own law is the opposite act.
 *
 * ⛔ UNGATED. There is no toggle over the noise domain, and a gate here would hand a gated-off body
 * the shared domain — the exact state this closes.
 * ⛔ `.slice()` because these arrays come from the CALLER's ctx, which a front-end is free to build
 * once and reuse across bodies; the suites assert that two bodies never share the array object.
 *
 * @param {object} ctx       the pack context, carrying macroOffset / detailOffset / craterOffset.
 * @param {string} packName  the calling pack, so a refusal names the front-end seam that failed.
 * @returns {{drivers: object, off: object}}
 */
export function offsetDriverBlock(ctx, packName) {
  const off = {
    macro: offsetOf(ctx, 'macroOffset', packName),
    detail: offsetOf(ctx, 'detailOffset', packName),
    crater: offsetOf(ctx, 'craterOffset', packName),
  };
  const drivers = {
    uMacroOffset: off.macro.slice(),
    uDetailOffset: off.detail.slice(),
    uCraterOffset: off.crater.slice(),
  };
  return { drivers, off };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE PACK
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} condition  a body condition vector (deriveConditionVector / conditionFromBody).
 * @param {object} ctx
 *   @param {number} ctx.displayRadiusEarth  the front-end's display policy. CARRIED, NOT CONSUMED —
 *                                           not one driver here is km-shaped, so the two policies
 *                                           agree on every driver and that agreement is a fact about
 *                                           the SIZE OF THE SET. The suite asserts the emptiness
 *                                           rather than assuming it, so the day a km-keyed uniform
 *                                           joins the pack the vacuity ends loudly.
 *   @param {object} ctx.gates               must carry the `terminator` key — an ABSENT key throws;
 *                                           an absent gate is an unanswered rendering decision.
 *   @param {number[]} ctx.macroOffset       ⭐ REQUIRED, all three, and a missing one THROWS rather
 *   @param {number[]} ctx.detailOffset      than defaulting to the zero vector — see
 *   @param {number[]} ctx.craterOffset      `offsetDriverBlock`. This is the only ctx field this
 *                                           pack needs that `giantDeck`'s lab call site does not
 *                                           build, and it is blocker 1 in the header.
 *   ⛔ `ctx.macroSeed`, `ctx.animRate` and `ctx.relevance` are NOT read. Nothing here draws entropy
 *      and nothing here animates.
 * @returns {{drivers: object, attributes: object, meta: object}}
 */
export function giantSurfacePack(condition, ctx = {}) {
  if (condition == null || typeof condition !== 'object') {
    throw new PackContractError('giantSurfacePack: condition vector is missing.');
  }
  // Checked FIRST and unconditionally, as every shipped pack does and for the reason
  // src/worldengine/port/writePackUniforms.js:107 `export function assertDisplayPolicy(ctx) {` gives: a missing display
  // policy fails silently and plausibly, so it is refused eagerly even by a pack with no km-keyed
  // driver.
  assertDisplayPolicy(ctx);

  // ⭐ THE SHARED LAW, CALLED — NOT COPIED. The legacy material calls the identical function on the
  // same body (header citation), so a future change to the terminator law lands on both front-ends
  // at once. The suite pins that by asserting the swapped body's values EQUAL the legacy material's
  // on the same body — which a transcription would satisfy today and break the first time the law
  // moved. ⛔ THE MAGNITUDE MAY NOT BE RE-DERIVED HERE: `terminatorOptics.js`'s own header records
  // that a port which shipped `columnFraction` as the magnitude — saturating to exactly 1.0 above
  // 0.3 bar, 6.7x the tamed value — reproduced a heavy orange BELT on every atmospheric world.
  const term = terminatorOpticsOf(condition);
  const { drivers: paletteDrivers, sp } = surfacePaletteBlock(condition);
  const { drivers: offsetDrivers, off } = offsetDriverBlock(ctx, 'giantSurfacePack');

  const drivers = {
    // ── P-11's GAS HALF · the terminator triple (3) ───────────────────────────────────────────────
    // ⛔ THE MAGNITUDE CARRIES THE GATE AND THE OTHER TWO DO NOT, which mirrors `solidOptics` exactly
    // and reproduces the lab rather than simplifying it: the lab's per-frame writer gates ONLY
    // `uTermStrength` and writes width and hue every frame regardless of the checkbox. Gating the
    // siblings too would apply the decision twice and would leave a gated-off body carrying the
    // previous body's band width behind a zero — invisible until something reads them off-gate.
    uTermStrength: scalar(term.termStrength, { gate: TERMINATOR_GATE }),
    uTermWidth: term.termWidth,
    // `.slice()` — `terminatorOpticsOf` forwards the optics module's LIVE array, so the copy is taken
    // at the last seam before the writer rather than trusted upstream.
    uTermColor: term.termColor.slice(),

    // ── P-13 · the three domain offsets (3), from the shared block ────────────────────────────────
    ...offsetDrivers,

    // ── P-12 · the ground palette + two scalars (7), from the shared block ────────────────────────
    // ⚠ SIX OF THESE SEVEN CHANGE NO PIXEL ON A GAS BODY. That is measured, it is not a defect in
    // this pack, and the reasoning for writing them anyway is the ⭐⭐ block in the header. Do not
    // "fix" the apparent redundancy by dropping them: B7 deletes the legacy fallback, and a name
    // left at the factory default after that is a permanent loss rather than a recoverable one.
    ...paletteDrivers,
  };

  const meta = {
    // ⭐ ALWAYS `true` FOR AN ADMITTED BODY — the entry predicate is the composition class itself.
    // It is reported rather than assumed so a test reads the pack's own answer instead of re-running
    // the predicate it is trying to check.
    gas: compositionClass(condition) === 'gas',
    termStrength: term.termStrength,
    termWidth: term.termWidth,
    // ⚠ POPULATED, NOT DECORATIVE. `meta` is the only place a test can read WHY a body came out at a
    // given value — an ice-free world and a hot world both write iceness 0 and are otherwise
    // indistinguishable from outside.
    iceness: drivers.uIcenessMix,
    biosphere: drivers.uBioGroundCover,
    palette: sp,
    offsets: off,
  };

  return assertPackResult({ drivers, attributes: {}, meta }, 'giantSurfacePack');
}

// ─────────────────────────────────────────────────────────────────────────────
// THE REGISTRY ENTRY
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⭐ EXPORTED AS A FROZEN ENTRY rather than assembled at the registry, so composing it is one import
 * plus one array element and the predicate cannot be retyped differently from the one this pack's
 * own test gates.
 *
 * ⛔⛔ THE PREDICATE IS THE EXACT COMPLEMENT OF `rockySurface`'s AND `solidOptics`'s,
 * src/worldengine/drivers/rockySurface.js:349 `  applies: (condition) => compositionClass(condition) !== 'gas',`, and that is the
 * whole of both its population argument and its collision argument. POPULATION: every gas-class body
 * is already claimed by `giantDeck`, `limbDeck`, `polarDeck` and `craterDeck`, so the
 * `packs.length > 0` term of the admission test cannot flip for any record and no census is
 * re-pinned — this registration moves NO body between materials. COLLISION: because the predicate is
 * the complement, no body ever runs this pack and either solid pack, so the thirteen names cannot
 * meet their solid-side twins on one body; against the three gas packs that DO co-apply, the emitted
 * sets are disjoint by name and the suite asserts it by lookup over a generated population rather
 * than by comparing headers.
 *
 * ⚠ IT MUST RETURN THE BOOLEAN. Both admission sites compare with `=== true`, so a truthy
 * non-boolean registers, reports as `skipped`, renders nothing and throws nothing. `===` already
 * yields a boolean; this is a note against a future rewrite, not a cast.
 */
export const GIANT_SURFACE_ENTRY = Object.freeze({
  name: 'giantSurface',
  applies: (condition) => compositionClass(condition) === 'gas',
  gates: Object.freeze([TERMINATOR_GATE]),
  pack: giantSurfacePack,
});

/**
 * The uniform names this pack writes, as a frozen SET for the collision, scope and membership gates.
 * ⛔ EXPORTED SO THE SUITE CAN ASSERT BY MEMBERSHIP RATHER THAN BY COUNT — Step 4 measured that a
 * count-preserving permutation is byte-identical to every instrument this program owns, so a
 * `length === 13` gate would pass a commit that swapped `uTermWidth` for `uLimbStrength`.
 * ⭐ The last ten are the SAME set `rockySurface` exports, by construction: both packs spread the
 * two shared blocks, so a name added to a block reaches both populations or neither.
 */
export const GIANT_SURFACE_UNIFORMS = Object.freeze([
  'uTermStrength', 'uTermWidth', 'uTermColor',
  'uMacroOffset', 'uDetailOffset', 'uCraterOffset',
  'uWeatheredColor', 'uFreshColor', 'uSedColor', 'uCratonColor', 'uBioGroundColor',
  'uBioGroundCover', 'uIcenessMix',
]);

// ─────────────────────────────────────────────────────────────────────────────
// THE TWO FRONT-END HELPERS — the lab's import-back seam (workstream AC2/AC5, 2026-08-22)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Uniform name -> the FLAT `state` field planet-lod-lab.html's per-frame writer reads.
 *
 * ⭐ SIX, NOT THIRTEEN, AND THE SHORTFALL IS THE POINT. `giantDeck` and `solidFeatures` mirror every
 * driver through a table like this one because the lab holds each of their values in a flat field.
 * This pack cannot: five of its thirteen are components of ONE lab object, `state.surfacePalette`
 * (planet-lod-lab.html:2820), and two more are the lab's own seed wire. Forcing all thirteen into a
 * flat table would mean inventing five lab state fields that do not exist, which is authoring a lab
 * surface from inside a pack — the exact direction this program forbids.
 *
 * ⚠ `uCraterOffset` IS HERE AND ITS TWO SIBLINGS ARE NOT. It is a 🎲 transient the lab holds as
 * `state.craterOffset` and resets on preset change; the macro/detail pair are written straight to
 * the material by planet-lod-lab.html:1378 `    function updateSeedUniforms(){`. Same block in the pack, different
 * owner in the lab, so they split here.
 */
export const GIANT_SURFACE_LAB_BINDING = Object.freeze({
  uTermStrength: 'termStrength',
  uTermWidth: 'termWidth',
  uTermColor: 'termColor',
  uIcenessMix: 'iceness',
  uBioGroundCover: 'biosphere',
  uCraterOffset: 'craterOffset',
});

/**
 * The five palette drivers that reach `state` as components of ONE object rather than as fields.
 *
 * ⛔ DECLARED AS A NAMED GROUP RATHER THAN LEFT IMPLICIT, because the complement below is derived by
 * SUBTRACTION and an undeclared name would fall through into the direct set. A palette colour
 * written straight to the material would then be overwritten by the lab's frame loop from a stale
 * `state.surfacePalette` on the very next frame — a uniform that flickers between two owners, which
 * is invisible on a still and unbisectable in motion.
 */
export const GIANT_SURFACE_PALETTE_MIRRORED = Object.freeze([
  'uWeatheredColor', 'uFreshColor', 'uSedColor', 'uCratonColor', 'uBioGroundColor',
]);

/**
 * ⛔⛔ EVERY GATE ON, AND THAT IS THE LOAD-BEARING PART OF THIS SEAM.
 *
 * The lab re-applies its OWN ✓ checkbox at the per-frame writer —
 * planet-lod-lab.html:5044 `      uniforms.uTermStrength.value = state.terminatorEnabled ? state.termStrength : 0.0;   // ✓ enable gate`
 * — so the value this mirror puts into `state` must be the UNGATED one. A mirror that resolved the
 * gate too would apply the decision twice: a body whose band is enabled would still read zero the
 * moment the pack's gate map disagreed with the checkbox, and nothing would throw, because zero is
 * a legal value for this master. planet-lod-lab.html:1749 names this hazard for pack #1.
 */
// ⛔ IT CARRIES THE GATE MAP AND NOTHING ELSE, AND THE OMISSIONS ARE DELIBERATE. `resolveDriver`
// reads `ctx.displayRadiusEarth` ONLY for a km-shaped driver and `ctx.animRate` ONLY for an
// animRate-scaled one (src/worldengine/port/writePackUniforms.js:219 `    const dispR = assertDisplayPolicy(ctx);`), and this
// pack emits neither — the suite asserts both, at `NO driver is km-shaped` and at the seed-
// independence gate. Adding a placeholder `displayRadiusEarth: 1` for symmetry with the other packs'
// mirrors would put a numeric literal in a file whose whole anti-transcription fence is that it owns
// no number, and it would answer a question nothing here asks. ⭐ If a km-keyed driver ever joins
// this pack, the mirror THROWS at `assertDisplayPolicy` rather than resolving a wrong number — the
// loud failure, and the reason this omission is safe rather than merely tidy.
const LAB_MIRROR_CTX = Object.freeze({
  gates: Object.freeze({ [TERMINATOR_GATE]: true }),
});

/**
 * The subset of a pack result the LAB mirrors into `state`, resolved with every gate ON.
 * @param {{drivers: object, meta: object}} pack  a `giantSurfacePack` result
 * @returns {object} `state` field name -> value
 */
export function giantSurfaceLabState(pack) {
  const out = {};
  for (const [uName, stateField] of Object.entries(GIANT_SURFACE_LAB_BINDING)) {
    if (!(uName in pack.drivers)) continue;
    out[stateField] = resolveDriver(uName, pack.drivers[uName], LAB_MIRROR_CTX);
  }
  // ⭐ THE PALETTE ARRIVES AS THE PACK'S OWN `meta.palette` — the SAME object `surfacePaletteBlock`
  // returned on the way in — so the lab stops calling `applyAlbedoTransfer(surfacePaletteOf(...))`
  // itself. Re-deriving it here from `pack.drivers` would rebuild the object the pack already has
  // and would drop `pigment`, which is not a driver name.
  out.surfacePalette = pack.meta.palette;
  return out;
}

/**
 * The complement: drivers the lab writes STRAIGHT to uniforms because its frame loop does not own
 * them. Derived by SUBTRACTION from the binding AND the palette group rather than listed, so a
 * driver added to the pack and forgotten in both defaults to being WRITTEN — a forgotten entry shows
 * up as a uniform that moves, not as one that silently never does.
 *
 * ⚠ TODAY IT IS `uMacroOffset` + `uDetailOffset`, AND THE LAB DOES NOT WRITE THEM EITHER. They are
 * forwarded verbatim off the caller's own ctx, so what comes back is what the lab put in, and
 * planet-lod-lab.html:1378 `    function updateSeedUniforms(){` already writes them to the material on every seed
 * change. The complement is computed and asserted so the day a THIRD name joins it — one the lab
 * does not already own — the addition is loud instead of silent.
 */
export function giantSurfaceDirectDrivers(pack) {
  const out = {};
  for (const [uName, d] of Object.entries(pack.drivers)) {
    if (uName in GIANT_SURFACE_LAB_BINDING) continue;
    if (GIANT_SURFACE_PALETTE_MIRRORED.includes(uName)) continue;
    out[uName] = d;
  }
  return out;
}
