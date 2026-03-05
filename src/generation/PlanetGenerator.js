import { earthRadiiToScene } from '../core/ScaleConstants.js';

/**
 * PlanetGenerator — produces data describing a single planet.
 *
 * This is pure data, no Three.js objects. The Planet.js renderer
 * takes this data and builds the actual 3D mesh.
 *
 * Radius ranges are in Earth radii (physical units).
 * Output includes radiusEarth, radiusScene, and radius (map/backward-compat).
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

  // Exaggerated radius ranges for the map (old visual values).
  // Gas giants 1.8-3.5, rocky 0.2-0.5, etc. — these control what the
  // planet looks like on the system map HUD and in the current renderer.
  static MAP_RADIUS_RANGES = {
    'rocky':        [0.2, 0.5],
    'terrestrial':  [0.4, 0.8],
    'ocean':        [0.4, 0.9],
    'eyeball':      [0.4, 0.7],
    'venus':        [0.4, 0.7],
    'carbon':       [0.2, 0.5],
    'lava':         [0.2, 0.6],
    'ice':          [0.3, 0.7],
    'sub-neptune':  [0.7, 1.3],
    'gas-giant':    [1.8, 3.5],
    'hot-jupiter':  [1.5, 3.0],
  };

  /**
   * Generate planet data from a seeded random instance.
   * @param {SeededRandom} rng - seeded random generator
   * @param {number} orbitRadiusAU - orbital distance from star in AU
   * @param {number[]|null} sunDirection - [x,y,z] direction toward the star, or null for random
   * @param {object|null} zones - { frostLine, hzInner, hzOuter, starType } in AU for realistic distribution
   * @returns {object} planet data
   */
  static generate(rng, orbitRadiusAU, sunDirection = null, zones = null, forceType = null) {
    const type = forceType || this._pickType(rng, orbitRadiusAU, zones);

    // Size ranges in Earth radii — based on real exoplanet science.
    // These are realistic physical sizes used for scene-scale rendering.
    const radiusRangesEarth = {
      'rocky':        [0.3, 0.8],    // Mercury (0.38) to Mars (0.53)
      'terrestrial':  [0.8, 1.5],    // Venus (0.95) to super-Earth
      'ocean':        [0.8, 1.8],    // Earth-like to large water worlds
      'eyeball':      [0.8, 1.3],    // Tidally locked terrestrial
      'venus':        [0.8, 1.2],    // Venus-like (0.95 real)
      'carbon':       [0.4, 0.9],    // Small, dense worlds
      'lava':         [0.3, 1.0],    // Small hot worlds
      'ice':          [0.4, 1.2],    // Icy bodies
      'sub-neptune':  [2.5, 4.0],    // Mini-Neptunes (Neptune = 3.88)
      'gas-giant':    [6.0, 14.0],   // Jupiter (11.2) / Saturn (9.4)
      'hot-jupiter':  [8.0, 16.0],   // Inflated close-in giants
    };
    const radiusRangeEarth = radiusRangesEarth[type] || [0.5, 1.5];
    const radiusEarth = rng.range(...radiusRangeEarth);
    const radiusScene = earthRadiiToScene(radiusEarth);

    // Map radius: exaggerated for the system map HUD (old visual scale)
    const mapRange = this.MAP_RADIUS_RANGES[type] || [0.3, 0.9];
    // Map radius is a fraction between the mapRange, same as radiusEarth
    // is within its range — this keeps them correlated.
    const t = (radiusEarth - radiusRangeEarth[0]) / (radiusRangeEarth[1] - radiusRangeEarth[0]);
    const radius = mapRange[0] + t * (mapRange[1] - mapRange[0]);

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

    // Moons by type — gas giants can have many (Jupiter has 95!)
    const maxMoonsByType = {
      'gas-giant': 6, 'hot-jupiter': 0, 'sub-neptune': 3,
      'venus': 0, 'eyeball': 1, 'carbon': 1,
      'terrestrial': 2, 'ocean': 1, 'rocky': 1,
    };
    const maxMoons = maxMoonsByType[type] ?? 1;
    const moonCount = rng.int(0, maxMoons);

    // Sun direction: use provided direction (from system generator) or random fallback
    if (!sunDirection) {
      const sunTheta = rng.range(0, Math.PI * 2);
      const sunPhi = Math.acos(rng.range(-1, 1));
      sunDirection = [
        Math.sin(sunPhi) * Math.cos(sunTheta),
        Math.sin(sunPhi) * Math.sin(sunTheta),
        Math.cos(sunPhi),
      ];
    }

    return {
      type,
      // Physical unit — radius in Earth radii
      radiusEarth,
      // Scene unit — for realistic 3D rendering
      radiusScene,
      // Map unit — exaggerated (old visual values, backward compat)
      radius,
      baseColor: palette.base,
      accentColor: palette.accent,
      rings,
      clouds,
      atmosphere,
      moonCount,
      noiseScale,
      noiseDetail: rng.range(0.3, 0.8),
      // Eyeball planets are tidally locked — no rotation
      // Hot Jupiters are also tidally locked
      rotationSpeed: (type === 'eyeball' || type === 'hot-jupiter')
        ? 0
        : rng.range(0.033, 0.167) * (rng.chance(0.15) ? -1 : 1),
      axialTilt: rng.chance(0.1)
        ? rng.range(-1.5, 1.5)
        : rng.range(-0.5, 0.5),
      sunDirection,
    };
  }

  /**
   * Pick planet type based on orbital distance relative to physical zones.
   *
   * Zones (from star outward):
   * - Scorching: inside 0.3x habitable zone inner edge → lava, rocky, hot-jupiter
   * - Inner: between scorching and habitable zone → rocky, venus, terrestrial
   * - Habitable zone: → terrestrial, ocean, eyeball, sub-neptune
   * - Transition: between habitable zone and frost line → sub-neptune, ice, gas-giant
   * - Outer: beyond frost line → gas-giant, ice, sub-neptune
   *
   * M-dwarfs rarely have gas giants (~3% real rate). Eyeball planets
   * are boosted around M/K stars (tidal locking in the close habitable zone).
   */
  static _pickType(rng, orbitRadius, zones) {
    const roll = rng.float();

    // Fallback for standalone use without zones
    if (!zones) {
      if (roll < 0.2) return 'rocky';
      if (roll < 0.4) return 'gas-giant';
      if (roll < 0.55) return 'terrestrial';
      if (roll < 0.65) return 'sub-neptune';
      if (roll < 0.75) return 'ice';
      if (roll < 0.85) return 'ocean';
      return 'venus';
    }

    const { frostLine, hzInner, hzOuter, starType } = zones;

    // ── Scorching zone: inside 0.3x habitable zone inner edge ──
    // Boosted hot-jupiters & carbon for more visual variety
    if (orbitRadius < hzInner * 0.3) {
      if (starType !== 'M' && rng.chance(0.15)) return 'hot-jupiter';
      if (roll < 0.28) return 'lava';
      if (roll < 0.46) return 'rocky';
      if (roll < 0.58) return 'venus';
      if (roll < 0.76) return 'carbon';
      return 'rocky';
    }

    // ── Inner zone: between scorching and habitable zone ──
    // More venus, lava, carbon for exotic variety
    if (orbitRadius < hzInner) {
      if (roll < 0.18) return 'rocky';
      if (roll < 0.34) return 'venus';
      if (roll < 0.46) return 'terrestrial';
      if (roll < 0.58) return 'lava';
      if (roll < 0.68) return 'sub-neptune';
      if (roll < 0.80) return 'carbon';
      return 'ocean';
    }

    // ── Habitable zone ──
    // Boosted eyeball, ocean, and terrestrial for visual interest
    if (orbitRadius < hzOuter) {
      // Eyeball planets: boosted for ALL star types, extra for M/K (tidal locking)
      const eyeballBoost = (starType === 'M' || starType === 'K') ? 0.18 : 0.10;
      if (roll < 0.20) return 'terrestrial';
      if (roll < 0.38) return 'ocean';
      if (roll < 0.38 + eyeballBoost) return 'eyeball';
      if (roll < 0.55) return 'sub-neptune';
      if (roll < 0.65) return 'rocky';
      if (roll < 0.75) return 'venus';
      return 'ice';
    }

    // ── Transition zone: between habitable zone and frost line ──
    // More gas giants and carbon for striking visuals
    if (orbitRadius < frostLine) {
      if (roll < 0.18) return 'sub-neptune';
      if (roll < 0.32) return 'ice';
      if (roll < 0.40) return 'rocky';
      if (roll < 0.58) return 'gas-giant';
      if (roll < 0.70) return 'ocean';
      if (roll < 0.82) return 'terrestrial';
      return 'carbon';
    }

    // ── Outer system: beyond frost line ──
    // Boosted gas giants for all star types (visually spectacular)
    const frostRatio = orbitRadius / frostLine;
    const gasBase = (starType === 'M') ? 0.15 : 0.32;
    const gasBoost = (frostRatio < 3.0 && starType !== 'M') ? 0.12 : 0.0;
    if (roll < gasBase + gasBoost) return 'gas-giant';
    if (roll < 0.48) return 'ice';
    if (roll < 0.60) return 'sub-neptune';
    if (roll < 0.70) return 'rocky';
    if (roll < 0.82) return 'ocean';
    return 'carbon';
  }
}
