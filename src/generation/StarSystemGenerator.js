import { SeededRandom } from './SeededRandom.js';
import { PlanetGenerator } from './PlanetGenerator.js';
import { MoonGenerator } from './MoonGenerator.js';
import { AsteroidBeltGenerator } from './AsteroidBeltGenerator.js';

/**
 * StarSystemGenerator — produces data for an entire star system:
 * a central star (or binary pair), orbital slots, planets with moons,
 * and asteroid belts.
 *
 * Star spectral classes (O/B/A/F/G/K/M) are weighted for visual
 * variety rather than astronomical accuracy.
 *
 * Planet type distribution uses physical zones:
 * - Scorching zone: lava, rocky, hot-jupiters
 * - Inner zone: rocky, venus, terrestrial
 * - Habitable zone: terrestrial, ocean, eyeball, sub-neptune
 * - Transition zone: sub-neptune, ice, gas-giant
 * - Outer zone (beyond frost line): gas-giant, ice, sub-neptune
 *
 * Orbital spacing follows a geometric progression inspired by
 * Titius-Bode law — each orbit is ~1.6-2.2x farther than the last.
 *
 * Binary systems (~35%) have two stars orbiting their barycenter,
 * with planets in P-type (circumbinary) orbits.
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
  // luminosity is relative to Sol (G-type = 1.0)
  // Star radii: all stars must be visually larger than the biggest gas giant (3.5)
  // to correctly represent the massive density difference between stars and planets.
  // Old values (0.5-2.5) allowed gas giants to dwarf M-class stars.
  static STAR_PROPERTIES = {
    O: { color: [0.61, 0.69, 1.0],  radius: 8.0, temp: 40000, luminosity: 300000, planetRange: [2, 5] },
    B: { color: [0.67, 0.75, 1.0],  radius: 6.5, temp: 20000, luminosity: 800,    planetRange: [2, 6] },
    A: { color: [0.79, 0.84, 1.0],  radius: 5.5, temp: 8750,  luminosity: 20,     planetRange: [3, 6] },
    F: { color: [0.97, 0.97, 1.0],  radius: 5.0, temp: 6750,  luminosity: 2.5,    planetRange: [4, 8] },
    G: { color: [1.0, 0.96, 0.92],  radius: 4.5, temp: 5600,  luminosity: 1.0,    planetRange: [4, 8] },
    K: { color: [1.0, 0.82, 0.63],  radius: 4.2, temp: 4450,  luminosity: 0.3,    planetRange: [3, 7] },
    M: { color: [1.0, 0.80, 0.44],  radius: 4.0, temp: 3050,  luminosity: 0.04,   planetRange: [3, 6] },
  };

  // Spectral class sequence (hot → cool) for deriving companion types
  static SPECTRAL_SEQUENCE = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];

  /**
   * Generate a complete star system from a seed string.
   * @param {string} seed
   * @returns {object} system data
   */
  static generate(seed) {
    const rng = new SeededRandom(seed);

    // ── Primary Star ──
    const starType = this._pickStarType(rng);
    const props = this.STAR_PROPERTIES[starType];
    const star = {
      type: starType,
      color: [...props.color],
      radius: props.radius * rng.range(0.85, 1.15),
      temp: props.temp,
    };

    // ── Binary? (~35% of systems) ──
    const isBinary = rng.chance(0.35);
    let star2 = null;
    let binarySeparation = 0;
    let binaryMassRatio = 0;
    let binaryOrbitSpeed = 0;
    let binaryOrbitAngle = 0;

    if (isBinary) {
      // Mass ratio distribution: q = M2/M1 (0 < q <= 1)
      // 25% twins, 40% similar, 25% unequal, 10% extreme
      const qRoll = rng.float();
      if (qRoll < 0.25)       binaryMassRatio = rng.range(0.85, 1.0);
      else if (qRoll < 0.65)  binaryMassRatio = rng.range(0.5, 0.85);
      else if (qRoll < 0.90)  binaryMassRatio = rng.range(0.2, 0.5);
      else                     binaryMassRatio = rng.range(0.1, 0.2);

      // Derive secondary star type from mass ratio
      const secondaryType = this._deriveCompanionType(starType, binaryMassRatio, rng);
      const secondaryProps = this.STAR_PROPERTIES[secondaryType];

      star2 = {
        type: secondaryType,
        color: [...secondaryProps.color],
        radius: secondaryProps.radius * rng.range(0.85, 1.15),
        temp: secondaryProps.temp,
      };

      // Binary separation: close enough to be visually dramatic,
      // but far enough that the two stars don't overlap
      binarySeparation = rng.range(3, 8) + star.radius + star2.radius;
      // Orbit speed: closer = faster (Kepler's 3rd law)
      binaryOrbitSpeed = 0.05 / Math.pow(binarySeparation / 5, 1.5);
      binaryOrbitAngle = rng.range(0, Math.PI * 2);
    }

    // ── Physical zones (frost line, habitable zone) ──
    // Scale with the square root of stellar luminosity
    const luminosity = props.luminosity;
    const frostLineAU = 2.7 * Math.sqrt(luminosity);
    const hzInnerAU = 0.95 * Math.sqrt(luminosity);
    const hzOuterAU = 1.37 * Math.sqrt(luminosity);

    // ── Orbital spacing ──
    // Base distance scales with star radius so planets don't spawn
    // inside larger stars. Star radius offset ensures comfortable gap.
    const baseDistance = rng.range(8, 15) + star.radius * 2;
    // Binary systems: innermost planet must be outside both star orbits
    const minInnerOrbit = isBinary ? binarySeparation * 2.5 : 0;
    const adjustedBase = Math.max(baseDistance, minInnerOrbit);
    const spacingFactor = rng.range(1.6, 2.2);

    // Convert AU to scene units
    // The innermost orbit scales with sqrt(luminosity) — hotter stars have
    // planets further out in AU, but we compress to the same scene scale.
    // This makes zone boundaries proportional for all star types; the
    // per-zone probability tables handle star-type differentiation.
    const innerOrbitAU = 0.4 * Math.sqrt(Math.max(luminosity, 0.01));
    const sceneUnitsPerAU = adjustedBase / innerOrbitAU;
    const zones = {
      frostLine: frostLineAU * sceneUnitsPerAU,
      hzInner: hzInnerAU * sceneUnitsPerAU,
      hzOuter: hzOuterAU * sceneUnitsPerAU,
      starType,
    };

    // ── Star info for dual-lighting ──
    // Brightness uses compressed mass-luminosity relation: L ~ M^1.5
    // (real is M^3.5 but that makes secondary too dim for visual effect)
    const brightness2 = star2
      ? Math.max(Math.pow(binaryMassRatio, 1.5), 0.05)
      : 0.0;

    const starInfo = {
      color1: star.color,
      brightness1: 1.0,
      color2: star2 ? star2.color : [0, 0, 0],
      brightness2,
    };

    // ── Planet count ──
    const [minPlanets, maxPlanets] = props.planetRange;
    const planetCount = rng.int(minPlanets, maxPlanets);

    // ── Generate planets ──
    const planets = [];
    for (let i = 0; i < planetCount; i++) {
      const planetRng = rng.child(`planet-${i}`);

      const orbitRadius = adjustedBase * Math.pow(spacingFactor, i);
      const orbitAngle = planetRng.range(0, Math.PI * 2);
      // Kepler's 3rd law: period ∝ distance^1.5
      const orbitSpeed = (0.02 / Math.pow(orbitRadius / adjustedBase, 1.5)) * planetRng.range(0.8, 1.2);

      // Planet position in world space (initial)
      const px = Math.cos(orbitAngle) * orbitRadius;
      const pz = Math.sin(orbitAngle) * orbitRadius;
      const dist = Math.sqrt(px * px + pz * pz);
      const sunDirection = [-px / dist, 0, -pz / dist];

      // Generate planet using zone-based type selection
      const planetData = PlanetGenerator.generate(planetRng, orbitRadius, sunDirection, zones);

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

    // ── Asteroid Belts ──
    // ~55% chance, placed between two planet orbits (preferring just inside a gas giant)
    const asteroidBelts = [];
    if (planets.length >= 3 && rng.chance(0.55)) {
      const beltIndex = this._pickBeltLocation(rng, planets);
      if (beltIndex >= 0) {
        const beltRng = rng.child('main-belt');
        const innerOrbit = planets[beltIndex].orbitRadius;
        const outerOrbit = planets[beltIndex + 1].orbitRadius;
        const beltData = AsteroidBeltGenerator.generate(beltRng, innerOrbit, outerOrbit);
        asteroidBelts.push(beltData);
      }
    }

    return {
      star,
      star2,
      isBinary,
      binarySeparation,
      binaryMassRatio,
      binaryOrbitSpeed,
      binaryOrbitAngle,
      planets,
      asteroidBelts,
      starInfo,
      seed,
    };
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

  /**
   * Derive a companion star type from the primary based on mass ratio.
   * Lower mass ratio = cooler (later spectral type) companion.
   */
  static _deriveCompanionType(primaryType, massRatio, rng) {
    const seq = this.SPECTRAL_SEQUENCE;
    const primaryIndex = seq.indexOf(primaryType);

    // q=1.0 → 0 steps (same type), q=0.1 → up to 4 steps cooler
    const maxSteps = Math.round((1 - massRatio) * 5);
    const steps = rng.int(0, maxSteps);
    const companionIndex = Math.min(primaryIndex + steps, seq.length - 1);

    return seq[companionIndex];
  }

  /**
   * Find the best gap for an asteroid belt.
   * Prefers placing it just inside a gas giant's orbit (like our solar system).
   */
  static _pickBeltLocation(rng, planets) {
    const gasTypes = ['gas-giant', 'sub-neptune'];

    // First priority: gap just before a gas giant
    for (let i = 1; i < planets.length; i++) {
      if (gasTypes.includes(planets[i].planetData.type)) {
        return i - 1;
      }
    }

    // Fallback: random gap in the middle
    if (planets.length >= 3) {
      return rng.int(1, planets.length - 2);
    }

    return -1; // no suitable location
  }
}
