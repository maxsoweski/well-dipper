import { SeededRandom } from './SeededRandom.js';
import { PlanetGenerator } from './PlanetGenerator.js';
import { MoonGenerator } from './MoonGenerator.js';

/**
 * StarSystemGenerator — produces data for an entire star system:
 * a central star, orbital slots, and planets with moons.
 *
 * Star spectral classes (O/B/A/F/G/K/M) are weighted for visual
 * variety rather than astronomical accuracy (M-dwarfs are 76% of
 * real stars but that's visually monotonous).
 *
 * Orbital spacing follows a geometric progression inspired by
 * Titius-Bode law — each orbit is ~1.5-1.8x farther than the last.
 */
export class StarSystemGenerator {
  // Cinematic weighting — boosts rare but visually interesting star types
  static STAR_WEIGHTS = [
    { type: 'M', weight: 0.30 },
    { type: 'K', weight: 0.25 },
    { type: 'G', weight: 0.18 },
    { type: 'F', weight: 0.12 },
    { type: 'A', weight: 0.08 },
    { type: 'B', weight: 0.05 },
    { type: 'O', weight: 0.02 },
  ];

  // Visual properties per spectral class
  static STAR_PROPERTIES = {
    O: { color: [0.61, 0.69, 1.0],  radius: 2.5, temp: 40000, planetRange: [2, 5] },
    B: { color: [0.67, 0.75, 1.0],  radius: 2.0, temp: 20000, planetRange: [2, 6] },
    A: { color: [0.79, 0.84, 1.0],  radius: 1.6, temp: 8750,  planetRange: [3, 6] },
    F: { color: [0.97, 0.97, 1.0],  radius: 1.3, temp: 6750,  planetRange: [4, 8] },
    G: { color: [1.0, 0.96, 0.92],  radius: 1.1, temp: 5600,  planetRange: [4, 8] },
    K: { color: [1.0, 0.82, 0.63],  radius: 0.8, temp: 4450,  planetRange: [3, 7] },
    M: { color: [1.0, 0.80, 0.44],  radius: 0.5, temp: 3050,  planetRange: [3, 6] },
  };

  /**
   * Generate a complete star system from a seed string.
   * @param {string} seed
   * @returns {{ star, planets: Array<{ planetData, moons, orbitRadius, orbitAngle, orbitSpeed }> }}
   */
  static generate(seed) {
    const rng = new SeededRandom(seed);

    // ── Star ──
    const starType = this._pickStarType(rng);
    const props = this.STAR_PROPERTIES[starType];
    const star = {
      type: starType,
      color: [...props.color],
      radius: props.radius * rng.range(0.85, 1.15), // slight variation
      temp: props.temp,
    };

    // ── Planet count ──
    const [minPlanets, maxPlanets] = props.planetRange;
    const planetCount = rng.int(minPlanets, maxPlanets);

    // ── Orbital spacing ──
    // Geometric progression inspired by Titius-Bode law
    // Wider spacing gives a more realistic sense of emptiness between orbits
    const baseDistance = rng.range(8, 15); // innermost orbit distance
    const spacingFactor = rng.range(1.6, 2.2);

    const planets = [];
    for (let i = 0; i < planetCount; i++) {
      const planetRng = rng.child(`planet-${i}`);

      // Orbit parameters
      const orbitRadius = baseDistance * Math.pow(spacingFactor, i);
      const orbitAngle = planetRng.range(0, Math.PI * 2); // random starting position
      // Outer planets orbit slower (Kepler's 3rd law: period ∝ distance^1.5)
      const orbitSpeed = (0.06 / Math.pow(orbitRadius / baseDistance, 1.5)) * planetRng.range(0.8, 1.2);

      // Planet position in world space
      const px = Math.cos(orbitAngle) * orbitRadius;
      const pz = Math.sin(orbitAngle) * orbitRadius;

      // Sun direction: from planet toward star at origin
      const dist = Math.sqrt(px * px + pz * pz);
      const sunDirection = [-px / dist, 0, -pz / dist];

      // Generate planet data, passing the computed sun direction
      const planetData = PlanetGenerator.generate(planetRng, i, sunDirection);

      // Generate moons
      const moons = [];
      for (let m = 0; m < planetData.moonCount; m++) {
        const moonRng = planetRng.child(`moon-${m}`);
        const moonData = MoonGenerator.generate(moonRng, planetData, m, planetData.moonCount);
        moons.push(moonData);
      }

      planets.push({
        planetData,
        moons,
        orbitRadius,
        orbitAngle,
        orbitSpeed,
      });
    }

    return { star, planets, seed };
  }

  static _pickStarType(rng) {
    const roll = rng.float();
    let cumulative = 0;
    for (const { type, weight } of this.STAR_WEIGHTS) {
      cumulative += weight;
      if (roll < cumulative) return type;
    }
    return 'M'; // fallback
  }
}
