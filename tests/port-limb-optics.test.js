// tests/port-limb-optics.test.js — the game's atmosphere rim now reads the body's physics.
//
// WHAT THIS PROTECTS. The rim glow in src/objects/Planet.js was a hard-coded pow(fresnel, 3.0)
// tinted by the game's whole-body atmosphereColor — the identical narrow blue-line profile on
// Venus, Titan, Earth and a bare rock. It now comes from atmosphereOpticsOf(), which is the SAME
// module planet-lod-lab.html imports (:177) rather than a transcription of it. That is the shape of
// this whole port: the game becomes a second consumer of what the lab already uses.
//
// The failure this exists to catch is the quiet one. If conditionFromPlanet ever stops forwarding
// what the optics read — pressure, T_eq, volatileFraction, surfaceGravity, radiusEarth — the call
// still succeeds, still returns a colour, and every planet quietly collapses back to ONE rim. The
// screen looks fine. Nothing throws. So distinctness is asserted here rather than trusted.
//
// ⚠ NOT tested here: that the shader consumes them correctly. That is a GLSL claim and was verified
// live in the browser instead (see the commit).

import { describe, it, expect } from 'vitest';
import { conditionFromPlanet } from '../src/worldengine/port/conditionFromPlanet.js';
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

const opticsFor = (key) => atmosphereOpticsOf(conditionFromPlanet(BODIES[key]));

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
    // Hand-authored fixtures (Sol's bodies) never pass through PlanetGenerator. conditionFromPlanet
    // is built to degrade rather than throw; this pins that the optics survive the degraded input.
    const o = atmosphereOpticsOf(conditionFromPlanet({}));
    expect(Number.isFinite(o.limbExponent)).toBe(true);
    for (const c of o.limbColor) expect(Number.isFinite(c)).toBe(true);
  });
});

describe('biosphere cover reaches the game from the shared module', () => {
  const bioFor = (key) => biosphereOf(conditionFromPlanet(BODIES[key]));

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
    // uBioCover = 0 skips the shader block, leaving Sol's bodies byte-identical.
    expect(biosphereOf(conditionFromPlanet({}))).toBe(0);
  });
});
