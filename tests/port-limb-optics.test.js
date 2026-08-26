// tests/port-limb-optics.test.js — the game's atmosphere rim now reads the body's physics.
//
// WHAT THIS PROTECTS. The rim glow in src/objects/Planet.js was a hard-coded pow(fresnel, 3.0)
// tinted by the game's whole-body atmosphereColor — the identical narrow blue-line profile on
// Venus, Titan, Earth and a bare rock. It now comes from atmosphereOpticsOf(), which is the SAME
// module world-engine-lab.html imports (:177) rather than a transcription of it. That is the shape of
// this whole port: the game becomes a second consumer of what the lab already uses.
//
// The failure this exists to catch is the quiet one. If conditionFromBody ever stops forwarding
// what the optics read — pressure, T_eq, volatileFraction, surfaceGravity, radiusEarth — the call
// still succeeds, still returns a colour, and every planet quietly collapses back to ONE rim. The
// screen looks fine. Nothing throws. So distinctness is asserted here rather than trusted.
//
// ⚠ NOT tested here: that the shader consumes them correctly. That is a GLSL claim and was verified
// live in the browser instead (see the commit).

import { describe, it, expect } from 'vitest';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { atmosphereOpticsOf } from '../src/worldengine/base/atmosphereOptics.js';
import { biosphereOf } from '../src/worldengine/base/surfaceMaterial.js';

// Bodies shaped the way PlanetGenerator emits them. Values are the physically interesting corners of
// the optics law, not a random sample: a clear column, a hot thick shroud, a cold organic haze, a
// hydrogen envelope, and no atmosphere at all.
const BODIES = {
  earthlike: {
    radiusEarth: 1.0, massEarth: 1.0, T_eq: 288, age: 4.5,
    composition: { ironFraction: 0.32, density: 5510, volatileFraction: 0.15 },
    atmosphere: { retained: true, pressure: 1.0, composition: 'n2-o2' },
  },
  venuslike: {
    radiusEarth: 0.95, massEarth: 0.82, T_eq: 737, age: 4.5,
    composition: { ironFraction: 0.31, density: 5240, volatileFraction: 0.10 },
    atmosphere: { retained: true, pressure: 92, composition: 'co2' },
  },
  titanlike: {
    radiusEarth: 0.40, massEarth: 0.02, T_eq: 94, age: 4.5,
    composition: { ironFraction: 0.15, density: 1880, volatileFraction: 0.45 },
    atmosphere: { retained: true, pressure: 1.5, composition: 'n2-ch4' },
  },
  gasgiant: {
    radiusEarth: 11.2, massEarth: 318, T_eq: 165, age: 4.5,
    composition: { ironFraction: 0.05, density: 1330, volatileFraction: 0.90 },
    atmosphere: { retained: true, pressure: 1000, composition: 'h2-he' },
  },
  airless: {
    radiusEarth: 0.38, massEarth: 0.055, T_eq: 440, age: 4.5,
    composition: { ironFraction: 0.68, density: 5430, volatileFraction: 0.01 },
    atmosphere: { retained: false, pressure: 0, composition: 'none' },
  },
};

const opticsFor = (key) => atmosphereOpticsOf(conditionFromBody(BODIES[key]));

describe('limb optics reach the game from the shared module', () => {
  it('gives every archetype a DISTINCT rim colour', () => {
    // The whole point of the port. Before it, all five of these drew the same rim.
    const seen = new Map();
    for (const key of Object.keys(BODIES)) {
      const hex = opticsFor(key).limbColor.map((c) => c.toFixed(4)).join(',');
      seen.set(hex, [...(seen.get(hex) || []), key]);
    }
    const collisions = [...seen.entries()].filter(([, keys]) => keys.length > 1);
    expect(collisions, `these bodies share a rim colour: ${JSON.stringify(collisions)}`).toEqual([]);
    expect(seen.size).toBe(Object.keys(BODIES).length);
  });

  it('varies the rim PROFILE, not just its hue', () => {
    // A thick shroud scatters into a fat detached halo; a clear column keeps a narrow line. If the
    // exponent were constant, every body would still have Earth's rim shape in a different colour.
    const exps = Object.keys(BODIES).map((k) => opticsFor(k).limbExponent);
    expect(new Set(exps.map((e) => e.toFixed(3))).size).toBeGreaterThan(1);
    // The law's documented range: 3.5 narrow line -> 1.8 broad halo.
    for (const e of exps) {
      expect(e).toBeLessThanOrEqual(3.5 + 1e-9);
      expect(e).toBeGreaterThanOrEqual(1.8 - 1e-9);
    }
  });

  it('puts the thick-shroud body on a broader halo than the clear-column body', () => {
    // Directional, not just "different" — a Venus must not come out NARROWER than an Earth. This is
    // the assertion that would catch an inverted mix() or a swapped argument, which "they differ"
    // would sail straight past.
    expect(opticsFor('venuslike').limbExponent).toBeLessThan(opticsFor('earthlike').limbExponent);
  });

  it('returns finite values for an airless body rather than NaN', () => {
    // Airless bodies still build the uniform; the rim is gated off by atmosphereStrength in the
    // shader, not by skipping the derivation. A NaN here would propagate into a uniform and, per
    // this lane's own hard-won lesson, render as an indistinguishable black frame.
    const o = opticsFor('airless');
    expect(Number.isFinite(o.limbExponent)).toBe(true);
    for (const c of o.limbColor) expect(Number.isFinite(c)).toBe(true);
  });

  it('gives every archetype a distinct TERMINATOR hue too', () => {
    // The transmitted hue, as opposed to the scattered one at the limb. Same module, and it was
    // already being computed and thrown away before this slice.
    const hexes = Object.keys(BODIES).map((k) => opticsFor(k).termColor.map((c) => c.toFixed(4)).join(','));
    expect(new Set(hexes).size).toBe(Object.keys(BODIES).length);
  });

  it('gates the terminator OFF for an airless body', () => {
    // columnFraction drives uTermStrength, and uTermStrength = 0 skips the shader block entirely.
    // A body with no atmosphere must not get a twilight band.
    expect(opticsFor('airless').columnFraction).toBe(0);
    expect(opticsFor('earthlike').columnFraction).toBeGreaterThan(0);
  });

  it('degrades to finite values on a body with no world-engine fields at all', () => {
    // Hand-authored fixtures (Sol's bodies) never pass through PlanetGenerator. conditionFromBody
    // is built to degrade rather than throw; this pins that the optics survive the degraded input.
    const o = atmosphereOpticsOf(conditionFromBody({}));
    expect(Number.isFinite(o.limbExponent)).toBe(true);
    for (const c of o.limbColor) expect(Number.isFinite(c)).toBe(true);
  });
});

describe('biosphere cover reaches the game from the shared module', () => {
  const bioFor = (key) => biosphereOf(conditionFromBody(BODIES[key]));

  it('puts cover on the temperate wet world and nowhere else', () => {
    // The defect this replaces: the game's terrestrial branch hard-coded "green vegetation" as
    // accentColor — a per-planet RANDOM colour — on every terrestrial world, habitable or not.
    expect(bioFor('earthlike')).toBeGreaterThan(0);
    expect(bioFor('venuslike')).toBe(0);   // 737 K is far past the temperature limit
    expect(bioFor('titanlike')).toBe(0);   // 94 K, frozen
    expect(bioFor('airless')).toBe(0);     // no air, no volatiles
  });

  it('returns a bounded fraction, never a colour or a NaN', () => {
    for (const k of Object.keys(BODIES)) {
      const v = bioFor(k);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is zero for a body with no world-engine fields, so hand-authored fixtures are inert', () => {
    // uBioGroundCover = 0 skips the shader block, leaving Sol's bodies byte-identical.
    expect(biosphereOf(conditionFromBody({}))).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// LEDGER C20 — THE SAME LIMB, ON THE MATERIAL THE GAME SWAPS TO.
//
// Everything above measures the optics reaching the game's LEGACY material. Step 6 moves every
// world-engine gas body onto the LAB material, where the rim has a different master gate — and
// nothing wrote it. That is C20: `grep -rn uLimbStrength src/` returned ZERO hits, measured
// 2026-08-09, so on a swapped body F34 rendered nothing at all while every gate above stayed green.
// This block is the other half of the same subject, in the file whose subject it is.
//
// ⛔ WHY THE IMPORTS ARE DOWN HERE AND NOT AT THE TOP. Two live `line + symbol` refs resolve INTO
// this file at lines 47-49 (the `airless` fixture) — from
// src/worldengine/port/conditionFromPlanet.js:369 `four-key literal` and from the port contract
// test, both naming lines 47-49 of this file by number. An import block at the top shifts both and
// `npm run check:instruments` reports them BROKEN, which is the instrument working; the answer is
// not to bump the integers. `import` is hoisted, so a declaration here binds identically. The same
// rule is already recorded at src/worldengine/base/e1Regime.js:122 `Three files this lane may not edit cite this module by LINE`.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { buildLabPlanetMaterial } from '../src/rendering/LabPlanetMaterial.js';
import { writePackUniforms } from '../src/worldengine/port/writePackUniforms.js';
import { gatesFor } from '../src/worldengine/drivers/index.js';
import {
  limbDeckPack, LIMB_DECK_ENTRY, LIMB_STRENGTH_WITH_AIR, LIMB_STRENGTH_AIRLESS,
} from '../src/worldengine/drivers/limbDeck.js';

describe('C20 — the limb gate reaches the LAB material the game swaps to', () => {
  const condFor = (key) => conditionFromBody(BODIES[key]);
  const GATES = gatesFor(LIMB_DECK_ENTRY);
  /** Run the pack onto a fresh lab material and hand back the uniforms map. */
  function composed(key) {
    const cond = condFor(key);
    const ctx = { displayRadiusEarth: cond.radiusEarth ?? 1, gates: GATES };
    const u = buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms;
    writePackUniforms(u, limbDeckPack(cond, ctx).drivers, ctx);
    return u;
  }

  it('the two front-ends spell the master gate differently — which IS the defect', () => {
    // The lab declares `uLimbStrength` and not `uLimbMix`; the game's legacy material declares
    // `uLimbMix` and not `uLimbStrength`. Both directions, because a one-directional check passes
    // on a superset — and this pair of absences is the whole of C20.
    const lab = buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms;
    expect(lab.uLimbStrength).toBeTruthy();
    expect(lab.uLimbMix).toBeUndefined();
    expect(lab.uLimbStrength.value).toBe(0.0);   // ...and its default is OFF, which is the loss
  });

  it('the gas archetype now gets a NON-ZERO rim on the lab material', () => {
    // `gasgiant` is the only fixture above whose condition reads compositionClass 'gas', so it is
    // the only one this pack's predicate claims. Asserted rather than assumed.
    expect(compositionClass(condFor('gasgiant'))).toBe('gas');
    expect(LIMB_DECK_ENTRY.applies(condFor('gasgiant'))).toBe(true);
    expect(composed('gasgiant').uLimbStrength.value).toBe(LIMB_STRENGTH_WITH_AIR);
    expect(composed('gasgiant').uLimbStrength.value).toBeGreaterThan(0);
  });

  it('and the predicate refuses every solid archetype, so none of them is swapped at all', () => {
    for (const key of ['earthlike', 'venuslike', 'titanlike', 'airless']) {
      expect(LIMB_DECK_ENTRY.applies(condFor(key)), key).toBe(false);
    }
  });

  it('the width and hue written to the lab material are the SAME law the legacy path reads', () => {
    // The gate that says this is a wiring and not a second implementation: the pack forwards
    // atmosphereOpticsOf's answer, so the swap opens the strength gate and moves nothing else in
    // this family. A transcribed constant would break here the first time the law moved.
    const o = opticsFor('gasgiant');
    const u = composed('gasgiant');
    expect(u.uLimbExponent.value).toBe(o.limbExponent);
    expect([u.uLimbColor.value.r, u.uLimbColor.value.g, u.uLimbColor.value.b]).toEqual(o.limbColor);
  });

  it('an airless body still derives a finite rim at strength ZERO, never a NaN', () => {
    // The airless branch of the lab's producer, reached by feeding the pack directly rather than
    // through its predicate (no airless body is gas-class, so the predicate never routes one here
    // today — Step 9 is when it will). A NaN uniform renders as an indistinguishable black frame,
    // which is this lane's own hard-won lesson, so finiteness is asserted alongside the zero.
    const cond = { ...condFor('gasgiant'), atmosphere: null };
    const r = limbDeckPack(cond, { displayRadiusEarth: 1, gates: GATES });
    expect(r.drivers.uLimbStrength.value).toBe(LIMB_STRENGTH_AIRLESS);
    expect(Number.isFinite(r.drivers.uLimbExponent)).toBe(true);
    for (const c of r.drivers.uLimbColor) expect(Number.isFinite(c)).toBe(true);
  });
});
