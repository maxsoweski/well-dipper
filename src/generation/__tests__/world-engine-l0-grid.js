import { PlanetGenerator } from '../PlanetGenerator.js';
import { SeededRandom } from '../SeededRandom.js';

// ════════════════════════════════════════════════════════════════════════
// World-Engine WS1 — deterministic L0 generation harness
//
// Pure harness shared by the regression test (world-engine-l0-plumbing.test.js)
// and the fixture regen script (__fixtures__/regen-l0-baseline.mjs). Kept in a
// non-test module (no JSON import) so the regen script can call generateGrid()
// WITHOUT triggering the test file's `import baseline from '...json'` — which
// would not exist on the very first baseline capture (chicken-and-egg).
//
// Deterministic entry: PlanetGenerator.generate(rng, orbitAU, sunDir, zones,
// forceType) is a pure function of its inputs. A fresh SeededRandom(seed)
// (Alea PRNG) + fixed orbit + fixed `zones` + forced type yields byte-identical
// output every run. This is the same call StarSystemGenerator makes per planet
// (StarSystemGenerator.js:368) — we drive the REAL entry with frozen inputs,
// we do not invent a new one.
// ════════════════════════════════════════════════════════════════════════

// Frozen `zones` context — the data contract StarSystemGenerator passes to
// PlanetGenerator (StarSystemGenerator.js:285-295). Sol-like G star, solar
// metallicity, 4.5 Gyr. Fixed so generation is reproducible.
export const SOL_ZONES = {
  frostLine: 2.7,
  hzInner: 0.95,
  hzOuter: 1.37,
  starType: 'G',
  metallicity: 0.0,
  sizeBias: 'neutral',
  luminosity: 1.0,
  ageGyr: 4.5,
  starMassSolar: 1.0,
};

// Fixed, deterministic grid spanning the body variety WS1 must keep additive:
//   - hot inner worlds (lava / rocky / eyeball, tidally locked)
//   - temperate / habitable-zone worlds (terrestrial / ocean / venus)
//   - outer / cold worlds (sub-neptune)
//   - a giant (gas-giant)
//   - an icy body (ice) and an exotic cold carbon world
// Each row is [seed, orbitAU, forcedType]. forcedType pins the type so the
// grid deterministically covers every zone regardless of the rng type roll.
export const GRID = [
  ['we-hot-lava', 0.06, 'lava'],
  ['we-hot-rocky', 0.12, 'rocky'],
  ['we-locked-eyeball', 0.04, 'eyeball'],
  ['we-temperate-terra', 1.0, 'terrestrial'],
  ['we-temperate-ocean', 1.2, 'ocean'],
  ['we-temperate-venus', 0.7, 'venus'],
  ['we-outer-subnep', 2.0, 'sub-neptune'],
  ['we-giant', 5.2, 'gas-giant'],
  ['we-icy-outer', 8.0, 'ice'],
  ['we-carbon-outer', 12.0, 'carbon'],
];

/**
 * Generate a single planetData deterministically from one grid row.
 * Each call constructs a fresh SeededRandom so output depends only on inputs.
 */
export function generateBody([seed, orbitAU, forceType]) {
  const rng = new SeededRandom(seed);
  return PlanetGenerator.generate(rng, orbitAU, null, SOL_ZONES, forceType);
}

/**
 * Deterministically produce the full grid of planetData objects.
 * Same seeds → same bodies, every run.
 */
export function generateGrid() {
  return GRID.map(generateBody);
}
