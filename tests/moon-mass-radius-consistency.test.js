// tests/moon-mass-radius-consistency.test.js — a planet-class moon must not carry a planet's mass
// inside a moon's volume.
//
// WHAT THIS PROTECTS. MoonGenerator._generatePlanetMoon builds a planet-class moon by generating a
// FULL PLANET (PlanetGenerator.generate at 1 AU) and then shrinking it — overriding radiusEarth with
// 10-25% of the parent's radius. Mass was not overridden with it, so the body kept a planet's mass
// in a moon's volume. Measured worst case before the fix: 27.6 M-earth at 0.89 R-earth, about
// 213 g/cc, roughly 20x denser than osmium, reported as ~35 g of surface gravity.
//
// WHY IT MATTERS BEYOND ABSURDITY. These 14-in-1120 bodies are the ONLY moons that render through
// src/objects/Planet.js and therefore the only ones that reach conditionFromBody today. Their
// surfaceGravity (M/R^2) drives reliefEnvelope and every other gravity-dependent law in the world
// engine port. Plain moons go through Moon.js, which has zero worldengine imports.
//
// THE INVARIANT: shrinking a body preserves its DENSITY. It is the same material, less of it. That
// also keeps composition.density valid, because that value describes the material and not the size.

import { describe, it, expect } from 'vitest';
import { PlanetGenerator } from '../src/generation/PlanetGenerator.js';
import { MoonGenerator } from '../src/generation/MoonGenerator.js';
import { SeededRandom } from '../src/generation/SeededRandom.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';

const TYPES = ['rocky', 'terrestrial', 'ocean', 'ice', 'lava', 'carbon', 'gas-giant'];
const SEEDS = [12345, 777, 90210, 31337, 8675309, 5150, 4242, 99991];

function planetClassMoons() {
  const out = [];
  for (const seed of SEEDS) {
    const rng = new SeededRandom(seed);
    for (const t of TYPES) {
      for (const au of [0.4, 1.0, 3.0, 8.0, 20.0]) {
        let p;
        try { p = PlanetGenerator.generate(rng, au, null, null, t); } catch { continue; }
        for (let i = 0; i < 4; i++) {
          try {
            const m = MoonGenerator.generate(rng, p, i, 4);
            if (m && m.isPlanetMoon) out.push(m);
          } catch { /* generation refusal is not this test's concern */ }
        }
      }
    }
  }
  return out;
}

// Earth's mean density, the unit conditionFromBody's surfaceGravity is implicitly relative to.
const EARTH_DENSITY_GCC = 5.51;

describe('planet-class moons: mass and radius describe the same body', () => {
  const moons = planetClassMoons();

  it('generates a population to assert over at all', () => {
    // Guard against the whole suite silently passing because generation changed shape. A test that
    // asserts over an empty array is the "0 blinks with no control" failure in another costume.
    expect(moons.length).toBeGreaterThan(5);
  });

  it('never packs a body denser than any real solid', () => {
    // Osmium, the densest stable element, is 22.6 g/cc. Nothing assembled by planet formation gets
    // near it. 15 g/cc leaves generous headroom for an iron-rich core while still catching the
    // planet-mass-in-a-moon bug, which produced 213 g/cc.
    const worst = moons
      .map((m) => {
        const d = m.planetData;
        const rel = (d.massEarth ?? 1) / (d.radiusEarth ** 3);
        return { rel, gcc: rel * EARTH_DENSITY_GCC, r: d.radiusEarth, mass: d.massEarth };
      })
      .sort((a, b) => b.gcc - a.gcc)[0];
    expect(worst.gcc).toBeLessThan(15);
  });

  it('keeps surface gravity in a band a body that size could actually have', () => {
    const gs = moons.map((m) => conditionFromBody(m.planetData).surfaceGravity);
    // Pre-fix this reached 35 g. A large icy/rocky moon or captured sub-Neptune tops out a few g.
    expect(Math.max(...gs)).toBeLessThan(5);
    expect(Math.min(...gs)).toBeGreaterThanOrEqual(0);
    expect(gs.every((g) => Number.isFinite(g))).toBe(true);
  });

  it('actually rescaled the mass rather than leaving the planet-scale value', () => {
    // The regression this file exists for: radius was overridden, mass was not. If mass is ever
    // left unscaled again, the moon's implied density leaves the parent's by the cube of the
    // shrink factor, which is 60-1000x.
    const densities = moons.map((m) => (m.planetData.massEarth ?? 1) / (m.planetData.radiusEarth ** 3));
    // Real generated bodies span a range of densities, but all of them plausible.
    expect(Math.max(...densities) * EARTH_DENSITY_GCC).toBeLessThan(15);
    expect(Math.min(...densities) * EARTH_DENSITY_GCC).toBeGreaterThan(0.3); // lighter than water is fine (Saturn is 0.69)
  });

  it('DISTINCTNESS: gravity is not one constant across the population', () => {
    // Cadence rule for this program: a correctly-wired law that is degenerate across the population
    // is this lane's characteristic failure. Assert the spread, not just the bound.
    const gs = moons.map((m) => +conditionFromBody(m.planetData).surfaceGravity.toFixed(4));
    expect(new Set(gs).size).toBeGreaterThan(3);
  });
});
