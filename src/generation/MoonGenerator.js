/**
 * MoonGenerator — produces data describing moons orbiting a planet.
 *
 * Moon types:
 * - captured:     Tiny, dark, irregular (Phobos/Deimos). Very low albedo.
 * - rocky:        Cratered gray spheres (Earth's Moon, Callisto).
 * - ice:          White/light blue, cracked surfaces (Europa, Enceladus).
 * - volcanic:     Yellow-orange sulfur surfaces (Io). Rare, only innermost of gas giants.
 * - terrestrial:  Rare, large moons with oceans/land (like a mini-Earth). Gas giant moons only.
 */
export class MoonGenerator {
  static TYPES = ['captured', 'rocky', 'ice', 'volcanic', 'terrestrial'];

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
      { base: [0.88, 0.88, 0.92], accent: [0.6, 0.65, 0.75] },      // Brilliant white (Enceladus)
      { base: [0.6, 0.65, 0.7], accent: [0.4, 0.45, 0.55] },       // Blue-gray ice
    ],
    volcanic: [
      { base: [0.7, 0.6, 0.2], accent: [0.15, 0.12, 0.1] },       // Sulfur yellow + dark lava
      { base: [0.75, 0.55, 0.15], accent: [0.2, 0.1, 0.08] },      // Orange-yellow + black
    ],
    terrestrial: [
      { base: [0.1, 0.2, 0.5], accent: [0.2, 0.45, 0.2] },        // Blue ocean + green land
      { base: [0.08, 0.18, 0.45], accent: [0.3, 0.5, 0.15] },      // Dark ocean + lush green
      { base: [0.12, 0.25, 0.5], accent: [0.35, 0.35, 0.2] },      // Ocean + savanna
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

    // Size: depends on moon type and parent planet
    // Gas giant moons can be much larger (Ganymede is bigger than Mercury)
    // Rocky planet moons are small (Earth's Moon is unusually large)
    const radius = this._pickRadius(rng, type, planetData);

    const palette = rng.pick(this.PALETTES[type]);

    // Orbital distance: inner moons are closer, outer moons further
    const baseOrbit = planetData.radius * (2.0 + moonIndex * 1.8);
    const orbitRadius = baseOrbit + rng.range(-0.3, 0.5) * planetData.radius;

    // Orbital speed: inner moons faster
    const orbitSpeed = rng.range(1.2, 2.5) / (1.0 + moonIndex * 0.6);

    // Orbital inclination: regular moons ~0, captured moons can be tilted
    const inclination = type === 'captured'
      ? rng.range(-0.5, 0.5)
      : rng.range(-0.1, 0.1);

    // Retrograde orbit: captured moons sometimes orbit backwards
    const retrograde = type === 'captured' && rng.chance(0.4);

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

  static _pickRadius(rng, type, planetData) {
    const pType = planetData.type;
    const isGasGiant = pType === 'gas-giant' || pType === 'sub-neptune' || pType === 'hot-jupiter';

    if (type === 'terrestrial') {
      // Large habitable moons — 8-15% of gas giant parent
      return rng.range(0.08, 0.15) * planetData.radius;
    }

    if (type === 'captured') {
      // Always tiny
      return rng.range(0.02, 0.04) * planetData.radius;
    }

    if (isGasGiant) {
      // Gas giant moons have much more size variety
      // Ganymede/Titan: ~3.7% of Jupiter's radius, but we exaggerate for visibility
      if (rng.chance(0.2)) {
        // Large moon (Ganymede/Titan scale) — 10-20% of parent
        return rng.range(0.10, 0.20) * planetData.radius;
      }
      // Medium moon — 4-10% of parent
      return rng.range(0.04, 0.10) * planetData.radius;
    }

    // Rocky/terrestrial parent planets — moons are relatively smaller
    // But occasionally large (Earth's Moon is ~27% of Earth's radius — unusually big)
    if (rng.chance(0.12)) {
      // Unusually large moon — 15-25% of parent
      return rng.range(0.15, 0.25) * planetData.radius;
    }
    // Normal small moon — 3-8% of parent
    return rng.range(0.03, 0.08) * planetData.radius;
  }

  /**
   * Pick moon type based on parent planet and orbit position.
   */
  static _pickType(rng, planetData, moonIndex) {
    const pType = planetData.type;
    const roll = rng.float();

    if (pType === 'gas-giant' || pType === 'sub-neptune') {
      // Gas giants: innermost can be volcanic, rare terrestrial, then ice/rocky, outer = captured
      if (moonIndex === 0 && rng.chance(0.3)) return 'volcanic';
      if (rng.chance(0.06)) return 'terrestrial'; // Rare habitable moon
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
