/**
 * PlanetGenerator — produces data describing a single planet.
 *
 * This is pure data, no Three.js objects. The Planet.js renderer
 * takes this data and builds the actual 3D mesh.
 *
 * Planet types:
 * - rocky:        Barren, cratered — Mars, Mercury, Moon
 * - gas-giant:    Horizontal bands, large — Jupiter, Saturn, Neptune
 * - ice:          Pale blues/whites, cracked surface — Europa, Enceladus
 * - lava:         Dark rock with glowing cracks — Io, volcanic worlds
 * - ocean:        Deep water worlds — blue/teal, wave-like patterns
 * - terrestrial:  Life-bearing — oceans + green/brown continents, clouds
 * - hot-jupiter:  Tidally locked gas giant — glowing day/dark night side
 * - eyeball:      Tidally locked habitable — concentric climate rings
 * - venus:        Featureless thick cloud blanket — cream/yellow
 * - carbon:       Near-black with diamond glints — exotic, dark
 * - sub-neptune:  Pale hazy mini-Neptune — most common real planet type
 */
export class PlanetGenerator {
  static TYPES = [
    'rocky', 'gas-giant', 'ice', 'lava', 'ocean', 'terrestrial',
    'hot-jupiter', 'eyeball', 'venus', 'carbon', 'sub-neptune',
  ];

  static PALETTES = {
    rocky: {
      colors: [
        { base: [0.35, 0.25, 0.15], accent: [0.5, 0.4, 0.3] },     // Brown
        { base: [0.6, 0.35, 0.2], accent: [0.75, 0.55, 0.3] },      // Desert
        { base: [0.3, 0.3, 0.35], accent: [0.5, 0.4, 0.3] },        // Grey rock
        { base: [0.45, 0.3, 0.2], accent: [0.6, 0.45, 0.35] },      // Rust
        { base: [0.25, 0.2, 0.2], accent: [0.4, 0.35, 0.3] },       // Dark stone
      ],
    },
    'gas-giant': {
      colors: [
        { base: [0.7, 0.5, 0.2], accent: [0.85, 0.65, 0.3] },      // Jupiter gold
        { base: [0.3, 0.35, 0.5], accent: [0.5, 0.55, 0.7] },       // Neptune blue
        { base: [0.6, 0.3, 0.2], accent: [0.8, 0.5, 0.3] },         // Warm red
        { base: [0.55, 0.45, 0.3], accent: [0.7, 0.6, 0.4] },       // Muted tan
        { base: [0.2, 0.3, 0.35], accent: [0.35, 0.5, 0.55] },      // Blue-grey
      ],
    },
    ice: {
      colors: [
        { base: [0.7, 0.8, 0.9], accent: [0.5, 0.6, 0.8] },        // Pale blue
        { base: [0.85, 0.85, 0.9], accent: [0.6, 0.7, 0.85] },      // White-blue
        { base: [0.6, 0.7, 0.75], accent: [0.4, 0.5, 0.65] },       // Steel blue
      ],
    },
    lava: {
      colors: [
        { base: [0.15, 0.1, 0.1], accent: [0.9, 0.3, 0.05] },      // Dark + orange glow
        { base: [0.2, 0.12, 0.08], accent: [1.0, 0.5, 0.1] },       // Dark + yellow glow
        { base: [0.12, 0.08, 0.1], accent: [0.8, 0.15, 0.05] },     // Dark + red glow
      ],
    },
    ocean: {
      colors: [
        { base: [0.1, 0.2, 0.5], accent: [0.15, 0.35, 0.45] },     // Deep blue
        { base: [0.05, 0.25, 0.35], accent: [0.1, 0.4, 0.35] },     // Teal
        { base: [0.08, 0.15, 0.4], accent: [0.12, 0.3, 0.5] },      // Dark ocean
      ],
    },
    terrestrial: {
      colors: [
        { base: [0.1, 0.2, 0.5], accent: [0.2, 0.45, 0.2] },       // Blue ocean + green land
        { base: [0.08, 0.18, 0.45], accent: [0.3, 0.5, 0.15] },     // Dark ocean + lush green
        { base: [0.12, 0.25, 0.5], accent: [0.35, 0.35, 0.2] },     // Ocean + savanna
        { base: [0.05, 0.15, 0.35], accent: [0.15, 0.35, 0.15] },   // Deep ocean + dark forest
      ],
    },
    'hot-jupiter': {
      colors: [
        { base: [0.08, 0.05, 0.15], accent: [0.9, 0.4, 0.1] },     // Dark purple + orange glow
        { base: [0.05, 0.08, 0.2], accent: [0.8, 0.3, 0.05] },      // Deep blue + fiery glow
        { base: [0.03, 0.03, 0.08], accent: [0.95, 0.5, 0.15] },    // Near-black + yellow glow
        { base: [0.1, 0.05, 0.12], accent: [0.7, 0.2, 0.1] },       // Dark magenta + red glow
      ],
    },
    eyeball: {
      colors: [
        { base: [0.08, 0.15, 0.45], accent: [0.2, 0.42, 0.18] },   // Dark ocean + green habitable
        { base: [0.1, 0.2, 0.5], accent: [0.25, 0.5, 0.2] },        // Blue ocean + lush ring
        { base: [0.06, 0.12, 0.35], accent: [0.3, 0.35, 0.18] },    // Deep ocean + savanna ring
      ],
    },
    venus: {
      colors: [
        { base: [0.75, 0.65, 0.4], accent: [0.85, 0.78, 0.55] },   // Classic cream-yellow
        { base: [0.7, 0.6, 0.35], accent: [0.8, 0.7, 0.45] },       // Warm sulfur
        { base: [0.65, 0.55, 0.38], accent: [0.78, 0.68, 0.5] },    // Pale gold
      ],
    },
    carbon: {
      colors: [
        { base: [0.08, 0.07, 0.06], accent: [0.2, 0.15, 0.08] },   // Near-black + dark amber
        { base: [0.1, 0.08, 0.07], accent: [0.15, 0.12, 0.1] },     // Charcoal
        { base: [0.06, 0.05, 0.05], accent: [0.25, 0.18, 0.1] },    // Coal + amber highlights
      ],
    },
    'sub-neptune': {
      colors: [
        { base: [0.35, 0.45, 0.6], accent: [0.5, 0.6, 0.7] },      // Pale blue-gray
        { base: [0.3, 0.5, 0.55], accent: [0.45, 0.6, 0.65] },      // Blue-green haze
        { base: [0.4, 0.45, 0.55], accent: [0.55, 0.55, 0.65] },    // Lavender-gray
        { base: [0.25, 0.4, 0.5], accent: [0.4, 0.55, 0.6] },       // Teal haze
      ],
    },
  };

  /**
   * Generate planet data from a seeded random instance.
   * @param {SeededRandom} rng - seeded random generator
   * @param {number} orbitIndex - which orbit slot (0 = closest to star)
   * @returns {object} planet data
   */
  static generate(rng, orbitIndex) {
    const type = this._pickType(rng, orbitIndex);

    // Size ranges by type
    const radiusRanges = {
      'gas-giant': [1.2, 2.5],
      'hot-jupiter': [1.3, 2.2],
      'sub-neptune': [0.5, 0.9],
      'eyeball': [0.4, 0.7],
      'venus': [0.4, 0.7],
      'carbon': [0.3, 0.6],
    };
    const radiusRange = radiusRanges[type] || [0.3, 0.9];
    const radius = rng.range(...radiusRange);

    // Pick a color palette for this type
    const palettes = this.PALETTES[type].colors;
    const palette = rng.pick(palettes);

    // Noise parameters control the planet's surface pattern
    const noiseScaleRanges = {
      'gas-giant': [1.5, 3.0],
      'hot-jupiter': [1.5, 3.0],
      'sub-neptune': [1.5, 2.5],
      'venus': [1.5, 3.0],
    };
    const noiseScale = rng.range(...(noiseScaleRanges[type] || [2.0, 5.0]));

    // ── Rings ──
    const ringChance = {
      'gas-giant': 0.6, 'ice': 0.15, 'rocky': 0.03,
      'terrestrial': 0.05, 'ocean': 0.02, 'lava': 0.01,
      'hot-jupiter': 0.05, 'sub-neptune': 0.1,
      'eyeball': 0.0, 'venus': 0.0, 'carbon': 0.02,
    };
    const hasRings = rng.chance(ringChance[type] || 0.02);
    let rings = null;
    if (hasRings) {
      rings = {
        innerRadius: rng.range(1.3, 1.6),
        outerRadius: rng.range(1.8, 2.8),
        color1: palette.base.map(c => Math.min(c + 0.2, 1.0)),
        color2: palette.accent.map(c => Math.min(c + 0.1, 1.0)),
        opacity: rng.range(0.4, 0.8),
        tiltX: rng.chance(0.25) ? rng.range(-0.3, 0.3) : 0,
        tiltZ: rng.chance(0.25) ? rng.range(-0.2, 0.2) : 0,
      };
    }

    // ── Clouds ──
    const cloudChance = {
      'terrestrial': 0.85, 'ocean': 0.7, 'gas-giant': 0.0,
      'rocky': 0.1, 'ice': 0.15, 'lava': 0.2,
      'hot-jupiter': 0.0, 'sub-neptune': 0.0, 'venus': 0.0,
      'eyeball': 0.6, 'carbon': 0.3,
    };
    const hasClouds = rng.chance(cloudChance[type] || 0);
    let clouds = null;
    if (hasClouds) {
      const cloudColors = {
        'lava': [0.3, 0.2, 0.15],
        'carbon': [0.2, 0.15, 0.1],
      };
      clouds = {
        color: cloudColors[type] || [0.9, 0.9, 0.92],
        density: rng.range(0.3, 0.7),
        scale: rng.range(2.0, 4.0),
      };
    }

    // ── Atmosphere ──
    const atmosphereChance = {
      'terrestrial': 0.9, 'ocean': 0.8, 'gas-giant': 1.0,
      'rocky': 0.15, 'ice': 0.3, 'lava': 0.4,
      'hot-jupiter': 1.0, 'sub-neptune': 1.0, 'venus': 1.0,
      'eyeball': 0.8, 'carbon': 0.5,
    };
    const hasAtmosphere = rng.chance(atmosphereChance[type] || 0);
    let atmosphere = null;
    if (hasAtmosphere) {
      const atmoColors = {
        'terrestrial': [0.3, 0.5, 0.9],
        'ocean': [0.2, 0.4, 0.8],
        'gas-giant': palette.accent.map(c => Math.min(c * 1.3, 1.0)),
        'ice': [0.5, 0.6, 0.9],
        'lava': [0.9, 0.3, 0.1],
        'rocky': [0.5, 0.4, 0.3],
        'hot-jupiter': [0.8, 0.35, 0.1],
        'sub-neptune': [0.4, 0.55, 0.7],
        'venus': [0.7, 0.6, 0.3],
        'eyeball': [0.3, 0.5, 0.85],
        'carbon': [0.4, 0.3, 0.15],
      };
      const atmoStrengths = {
        'sub-neptune': [0.4, 0.8],  // Thick haze — defining feature
        'venus': [0.5, 0.7],        // Thick atmosphere
        'hot-jupiter': [0.3, 0.6],
      };
      const [sMin, sMax] = atmoStrengths[type] || [0.2, 0.6];
      atmosphere = {
        color: atmoColors[type] || [0.5, 0.5, 0.8],
        strength: rng.range(sMin, sMax),
      };
    }

    // Moons by type
    const maxMoonsByType = {
      'gas-giant': 4, 'hot-jupiter': 0, 'sub-neptune': 2,
      'venus': 0, 'eyeball': 1, 'carbon': 1,
    };
    const maxMoons = maxMoonsByType[type] ?? 2;
    const moonCount = rng.int(0, maxMoons);

    // Randomized sun direction (simulates the star's position)
    // Random point on unit sphere using spherical coordinates
    const sunTheta = rng.range(0, Math.PI * 2);
    const sunPhi = Math.acos(rng.range(-1, 1));
    const sunDirection = [
      Math.sin(sunPhi) * Math.cos(sunTheta),
      Math.sin(sunPhi) * Math.sin(sunTheta),
      Math.cos(sunPhi),
    ];

    return {
      type,
      radius,
      baseColor: palette.base,
      accentColor: palette.accent,
      rings,
      clouds,
      atmosphere,
      moonCount,
      noiseScale,
      noiseDetail: rng.range(0.3, 0.8),
      rotationSpeed: rng.range(0.1, 0.5) * (rng.chance(0.15) ? -1 : 1),
      axialTilt: rng.chance(0.1)
        ? rng.range(-1.5, 1.5)
        : rng.range(-0.5, 0.5),
      sunDirection,
    };
  }

  /**
   * Pick planet type based on orbit position.
   * Inner orbits favor rocky/lava/hot-jupiter, outer favor gas/ice/sub-neptune.
   */
  static _pickType(rng, orbitIndex) {
    const roll = rng.float();
    if (orbitIndex <= 1) {
      // Inner orbits: rocky, lava, hot-jupiter, venus, terrestrial
      if (roll < 0.18) return 'rocky';
      if (roll < 0.32) return 'lava';
      if (roll < 0.46) return 'terrestrial';
      if (roll < 0.56) return 'hot-jupiter';
      if (roll < 0.66) return 'venus';
      if (roll < 0.76) return 'eyeball';
      if (roll < 0.84) return 'ocean';
      if (roll < 0.90) return 'carbon';
      if (roll < 0.95) return 'gas-giant';
      return 'sub-neptune';
    } else if (orbitIndex <= 3) {
      // Middle orbits: mixed — everything possible
      if (roll < 0.14) return 'rocky';
      if (roll < 0.28) return 'gas-giant';
      if (roll < 0.40) return 'terrestrial';
      if (roll < 0.50) return 'sub-neptune';
      if (roll < 0.58) return 'ocean';
      if (roll < 0.66) return 'ice';
      if (roll < 0.74) return 'venus';
      if (roll < 0.80) return 'eyeball';
      if (roll < 0.86) return 'lava';
      if (roll < 0.92) return 'carbon';
      return 'hot-jupiter';
    } else {
      // Outer orbits: gas giants, ice, sub-neptune
      if (roll < 0.28) return 'gas-giant';
      if (roll < 0.48) return 'ice';
      if (roll < 0.62) return 'sub-neptune';
      if (roll < 0.74) return 'rocky';
      if (roll < 0.82) return 'ocean';
      if (roll < 0.88) return 'carbon';
      if (roll < 0.94) return 'terrestrial';
      return 'venus';
    }
  }
}
