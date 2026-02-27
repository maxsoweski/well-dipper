/**
 * MoonGenerator — produces data describing moons orbiting a planet.
 *
 * Moon types:
 * - captured:  Tiny, dark, irregular (Phobos/Deimos). Very low albedo.
 * - rocky:     Cratered gray spheres (Earth's Moon, Callisto).
 * - ice:       White/light blue, cracked surfaces (Europa, Enceladus).
 * - volcanic:  Yellow-orange sulfur surfaces (Io). Rare, only innermost of gas giants.
 */
export class MoonGenerator {
  static TYPES = ['captured', 'rocky', 'ice', 'volcanic'];

  static PALETTES = {
    captured: [
      { base: [0.2, 0.18, 0.16], accent: [0.3, 0.28, 0.25] },     // Dark gray-brown
      { base: [0.15, 0.14, 0.13], accent: [0.25, 0.22, 0.2] },     // Charcoal
    ],
    rocky: [
      { base: [0.45, 0.43, 0.42], accent: [0.6, 0.58, 0.55] },     // Moon-gray (light highlands)
      { base: [0.3, 0.28, 0.27], accent: [0.5, 0.48, 0.45] },      // Darker rocky
      { base: [0.25, 0.22, 0.2], accent: [0.42, 0.4, 0.38] },      // Brown-gray (Callisto)
    ],
    ice: [
      { base: [0.75, 0.78, 0.82], accent: [0.5, 0.55, 0.65] },     // White-blue (Europa)
      { base: [0.88, 0.88, 0.92], accent: [0.6, 0.65, 0.75] },     // Brilliant white (Enceladus)
      { base: [0.6, 0.65, 0.7], accent: [0.4, 0.45, 0.55] },       // Blue-gray ice
    ],
    volcanic: [
      { base: [0.7, 0.6, 0.2], accent: [0.15, 0.12, 0.1] },       // Sulfur yellow + dark lava
      { base: [0.75, 0.55, 0.15], accent: [0.2, 0.1, 0.08] },      // Orange-yellow + black
    ],
  };

  /**
   * Generate moon data for a planet.
   * @param {SeededRandom} rng
   * @param {object} planetData - parent planet's data
   * @param {number} moonIndex - 0 = closest moon, higher = further out
   * @param {number} totalMoons - how many moons this planet has
   * @returns {object} moon data
   */
  static generate(rng, planetData, moonIndex, totalMoons) {
    const type = this._pickType(rng, planetData, moonIndex);

    // Size: moons are much smaller than their parent planet
    // Slightly exaggerated for visibility but still clearly subordinate
    const sizeRanges = {
      captured: [0.02, 0.04],
      rocky: [0.03, 0.07],
      ice: [0.03, 0.06],
      volcanic: [0.03, 0.06],
    };
    const [sMin, sMax] = sizeRanges[type];
    const radius = rng.range(sMin, sMax) * planetData.radius;

    const palette = rng.pick(this.PALETTES[type]);

    // Orbital distance: inner moons are closer, outer moons further
    // Distance in units of planet radii
    const baseOrbit = planetData.radius * (2.0 + moonIndex * 1.8);
    const orbitRadius = baseOrbit + rng.range(-0.3, 0.5) * planetData.radius;

    // Orbital speed: slow, stately orbits. Inner moons slightly faster.
    const orbitSpeed = rng.range(1.2, 2.5) / (1.0 + moonIndex * 0.6);

    // Orbital inclination: regular moons ~0, captured moons can be tilted
    const inclination = type === 'captured'
      ? rng.range(-0.5, 0.5)
      : rng.range(-0.1, 0.1);

    // Retrograde orbit: captured moons sometimes orbit backwards
    const retrograde = type === 'captured' && rng.chance(0.4);

    // Starting angle (randomize so moons aren't all aligned)
    const startAngle = rng.range(0, Math.PI * 2);

    return {
      type,
      radius,
      baseColor: palette.base,
      accentColor: palette.accent,
      orbitRadius,
      orbitSpeed: retrograde ? -orbitSpeed : orbitSpeed,
      inclination,
      startAngle,
      noiseScale: rng.range(3.0, 6.0),
    };
  }

  /**
   * Pick moon type based on parent planet and orbit position.
   */
  static _pickType(rng, planetData, moonIndex) {
    const pType = planetData.type;
    const roll = rng.float();

    if (pType === 'gas-giant' || pType === 'sub-neptune') {
      // Gas giants: innermost can be volcanic, then ice/rocky, outer = captured
      if (moonIndex === 0 && rng.chance(0.3)) return 'volcanic';
      if (roll < 0.35) return 'ice';
      if (roll < 0.65) return 'rocky';
      if (roll < 0.85) return 'captured';
      return 'ice';
    } else if (pType === 'ice') {
      if (roll < 0.5) return 'ice';
      if (roll < 0.8) return 'captured';
      return 'rocky';
    } else {
      // Rocky, terrestrial, etc: mostly rocky or captured
      if (roll < 0.5) return 'rocky';
      if (roll < 0.85) return 'captured';
      return 'ice';
    }
  }
}
