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
 *
 * Exotic types (gallery/debug only for now):
 * - hex:          Tessellated hexagonal plates — synthetic, alien construct
 * - shattered:    Dark rock with wide blue-white fracture lines — breaking apart
 * - crystal:      Angular Voronoi facets — gemstone colors, refractive highlights
 * - fungal:       Dark surface with bioluminescent glow-spot clusters
 * - machine:      Rigid rectangular grid — dark metal with glowing circuit traces
 * - city-lights:  Earth-like terrestrial with city lights visible on night side
 * - ecumenopolis: Coruscant-like mega-city — entire surface covered in urban sprawl
 */
export class PlanetGenerator {
  static TYPES = [
    'rocky', 'gas-giant', 'ice', 'lava', 'ocean', 'terrestrial',
    'hot-jupiter', 'eyeball', 'venus', 'carbon', 'sub-neptune',
    'hex', 'shattered', 'crystal', 'fungal', 'machine',
    'city-lights', 'ecumenopolis',
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
        { base: [0.75, 0.85, 0.8], accent: [0.5, 0.7, 0.6] },       // Mint frost
        { base: [0.65, 0.65, 0.8], accent: [0.45, 0.45, 0.7] },     // Lavender ice
      ],
    },
    lava: {
      colors: [
        { base: [0.15, 0.1, 0.1], accent: [0.9, 0.3, 0.05] },      // Dark + orange glow
        { base: [0.2, 0.12, 0.08], accent: [1.0, 0.5, 0.1] },       // Dark + yellow glow
        { base: [0.12, 0.08, 0.1], accent: [0.8, 0.15, 0.05] },     // Dark + red glow
        { base: [0.1, 0.1, 0.15], accent: [0.6, 0.2, 0.8] },        // Dark + violet glow
        { base: [0.18, 0.15, 0.08], accent: [0.95, 0.8, 0.2] },     // Dark + bright gold glow
      ],
    },
    ocean: {
      colors: [
        { base: [0.1, 0.2, 0.5], accent: [0.15, 0.35, 0.45] },     // Deep blue
        { base: [0.05, 0.25, 0.35], accent: [0.1, 0.4, 0.35] },     // Teal
        { base: [0.08, 0.15, 0.4], accent: [0.12, 0.3, 0.5] },      // Dark ocean
        { base: [0.15, 0.1, 0.35], accent: [0.2, 0.15, 0.45] },     // Purple deep
        { base: [0.05, 0.3, 0.25], accent: [0.08, 0.45, 0.3] },     // Emerald sea
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
        { base: [0.12, 0.08, 0.3], accent: [0.35, 0.2, 0.15] },     // Purple ocean + desert ring
        { base: [0.05, 0.2, 0.3], accent: [0.15, 0.45, 0.35] },     // Teal ocean + moss ring
      ],
    },
    venus: {
      colors: [
        { base: [0.75, 0.65, 0.4], accent: [0.85, 0.78, 0.55] },   // Classic cream-yellow
        { base: [0.7, 0.6, 0.35], accent: [0.8, 0.7, 0.45] },       // Warm sulfur
        { base: [0.65, 0.55, 0.38], accent: [0.78, 0.68, 0.5] },    // Pale gold
        { base: [0.6, 0.5, 0.45], accent: [0.75, 0.65, 0.55] },     // Dusty rose
        { base: [0.72, 0.58, 0.3], accent: [0.82, 0.72, 0.4] },     // Amber haze
      ],
    },
    carbon: {
      colors: [
        { base: [0.08, 0.07, 0.06], accent: [0.2, 0.15, 0.08] },   // Near-black + dark amber
        { base: [0.1, 0.08, 0.07], accent: [0.15, 0.12, 0.1] },     // Charcoal
        { base: [0.06, 0.05, 0.05], accent: [0.25, 0.18, 0.1] },    // Coal + amber highlights
        { base: [0.05, 0.06, 0.08], accent: [0.12, 0.18, 0.25] },   // Dark steel + blue glint
        { base: [0.09, 0.06, 0.1], accent: [0.2, 0.1, 0.22] },      // Carbon + violet shimmer
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
    hex: {
      colors: [
        { base: [0.05, 0.15, 0.25], accent: [0.2, 0.7, 0.8] },      // Dark teal + bright cyan
        { base: [0.08, 0.12, 0.2], accent: [0.3, 0.6, 0.9] },       // Navy + electric blue
        { base: [0.06, 0.18, 0.22], accent: [0.1, 0.8, 0.7] },      // Deep teal + aqua
        { base: [0.1, 0.1, 0.2], accent: [0.4, 0.5, 0.9] },         // Indigo + periwinkle
      ],
    },
    shattered: {
      colors: [
        { base: [0.08, 0.06, 0.1], accent: [0.4, 0.5, 0.95] },      // Dark + blue-white cracks
        { base: [0.1, 0.07, 0.12], accent: [0.5, 0.3, 0.9] },       // Dark + violet cracks
        { base: [0.06, 0.06, 0.08], accent: [0.3, 0.6, 0.85] },     // Near-black + cyan cracks
        { base: [0.07, 0.05, 0.1], accent: [0.6, 0.4, 0.95] },      // Dark + lavender cracks
      ],
    },
    crystal: {
      colors: [
        { base: [0.25, 0.1, 0.3], accent: [0.7, 0.3, 0.8] },       // Deep purple + magenta
        { base: [0.15, 0.08, 0.25], accent: [0.8, 0.4, 0.9] },      // Violet + bright pink
        { base: [0.2, 0.12, 0.28], accent: [0.6, 0.2, 0.7] },       // Plum + amethyst
        { base: [0.18, 0.1, 0.22], accent: [0.9, 0.6, 0.95] },      // Dark + light pink crystal
      ],
    },
    fungal: {
      colors: [
        { base: [0.08, 0.15, 0.1], accent: [0.1, 0.8, 0.7] },      // Dark green + cyan glow
        { base: [0.06, 0.12, 0.12], accent: [0.8, 0.2, 0.6] },      // Dark teal + pink glow
        { base: [0.1, 0.1, 0.06], accent: [0.2, 0.9, 0.4] },        // Brown-green + green glow
        { base: [0.05, 0.1, 0.1], accent: [0.3, 0.7, 0.9] },        // Dark teal + blue glow
      ],
    },
    machine: {
      colors: [
        { base: [0.1, 0.1, 0.12], accent: [0.8, 0.6, 0.1] },       // Dark metal + amber glow
        { base: [0.08, 0.1, 0.08], accent: [0.2, 0.8, 0.3] },       // Dark metal + green glow
        { base: [0.12, 0.1, 0.1], accent: [0.9, 0.5, 0.15] },       // Gunmetal + orange glow
        { base: [0.08, 0.08, 0.1], accent: [0.3, 0.7, 0.9] },       // Dark steel + cyan glow
      ],
    },
    'city-lights': {
      // Same as terrestrial — ocean + land — but accent is city-light color for night side
      colors: [
        { base: [0.1, 0.2, 0.5], accent: [0.2, 0.45, 0.2] },       // Blue ocean + green land
        { base: [0.08, 0.18, 0.45], accent: [0.3, 0.5, 0.15] },     // Dark ocean + lush green
        { base: [0.12, 0.25, 0.5], accent: [0.35, 0.35, 0.2] },     // Ocean + savanna
        { base: [0.05, 0.15, 0.35], accent: [0.15, 0.35, 0.15] },   // Deep ocean + dark forest
      ],
    },
    ecumenopolis: {
      // Gray/steel urban surface — accent is the warm city glow
      colors: [
        { base: [0.18, 0.17, 0.2], accent: [0.9, 0.7, 0.3] },      // Steel gray + warm amber
        { base: [0.15, 0.15, 0.18], accent: [0.95, 0.8, 0.4] },     // Dark gray + golden light
        { base: [0.2, 0.18, 0.16], accent: [0.85, 0.6, 0.25] },     // Warm gray + orange glow
        { base: [0.12, 0.13, 0.17], accent: [0.8, 0.75, 0.5] },     // Blue-gray + pale gold
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
    'hex':          [0.2, 0.5],
    'shattered':    [0.3, 0.7],
    'crystal':      [0.15, 0.45],
    'fungal':       [0.3, 0.8],
    'machine':      [0.4, 0.9],
    'city-lights':  [0.4, 0.8],
    'ecumenopolis': [0.4, 0.8],
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
      'hex':          [0.4, 0.9],    // Small artificial construct
      'shattered':    [0.5, 1.2],    // Medium fractured world
      'crystal':      [0.3, 0.8],    // Small crystalline body
      'fungal':       [0.6, 1.3],    // Medium bio world
      'machine':      [0.8, 1.5],    // Medium artificial world
      'city-lights':  [0.8, 1.5],    // Earth-like with civilization
      'ecumenopolis': [0.9, 1.8],    // Mega-city, often super-Earth sized
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
      'gas-giant': 0.5, 'ice': 0.25, 'rocky': 0.08,
      'terrestrial': 0.18, 'ocean': 0.05, 'lava': 0.03,
      'hot-jupiter': 0.08, 'sub-neptune': 0.15,
      'eyeball': 0.0, 'venus': 0.0, 'carbon': 0.05,
      'hex': 0.0, 'shattered': 0.0, 'crystal': 0.0,
      'fungal': 0.0, 'machine': 0.0,
      'city-lights': 0.1, 'ecumenopolis': 0.05,
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
      'hex': 0.0, 'shattered': 0.0, 'crystal': 0.0,
      'fungal': 0.0, 'machine': 0.0,
      'city-lights': 0.75, 'ecumenopolis': 0.15,
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
      'hex': 0.5, 'shattered': 0.3, 'crystal': 0.2,
      'fungal': 0.7, 'machine': 0.0,
      'city-lights': 0.9, 'ecumenopolis': 0.7,
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
        'hex': [0.1, 0.6, 0.7],
        'shattered': [0.3, 0.3, 0.8],
        'crystal': [0.5, 0.2, 0.6],
        'fungal': [0.15, 0.5, 0.4],
        'city-lights': [0.3, 0.5, 0.9],
        'ecumenopolis': [0.5, 0.45, 0.35],
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
      'hex': 0, 'shattered': 1, 'crystal': 0,
      'fungal': 2, 'machine': 0,
      'city-lights': 2, 'ecumenopolis': 2,
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
   * Exotic/civilized types (NMS-inspired):
   * - Exotic roll happens first, weighted by star type (M > K > O/B > F/G)
   * - Max 1 exotic per system (zones.hasExotic flag)
   * - Civilized types (city-lights, ecumenopolis) only in HZ around F/G/K/A stars
   * - Zone restrictions filter which exotic subtypes can appear where
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
      if (roll < 0.55) return 'sub-neptune';
      if (roll < 0.7) return 'ice';
      if (roll < 0.85) return 'venus';
      return 'carbon';
    }

    const { frostLine, hzInner, hzOuter, starType } = zones;

    // NOTE: Exotic and civilized planet types (hex, machine, crystal, shattered,
    // fungal, city-lights, ecumenopolis) are NOT handled here. They are applied
    // as overlay systems AFTER natural generation. See docs/GAME_BIBLE.md §6.
    //
    // This function only picks natural planet types based on zone and science.

    // ════════════════════════════════════════════════════════════
    // SCIENCE-DRIVEN TYPE SELECTION
    //
    // Based on Kepler/TESS data and exoplanet formation science:
    //
    // Decision chain for habitable worlds (terrestrial/ocean/eyeball):
    //   1. Must be in the habitable zone
    //   2. Must be rocky (not sub-neptune/gas) — Kepler: ~30-40% of HZ planets
    //      are sub-Neptune sized, leaving ~60-70% as rocky candidates
    //   3. Must have surface liquid water — only ~10-25% of HZ rocky planets
    //      (Forget 2012, Tian & Matsui)
    //   4. Must have life (terrestrial only) — fraction of water worlds that
    //      develop visible biosphere is unknown, but very small
    //
    // Result: ~40% of stars have HZ rocky planet × ~15% have water = ~6%
    // of systems have an ocean world. Terrestrial (with life) ~2-3%.
    //
    // Eyeball planets: default habitable type for M/late-K dwarfs (tidally
    // locked in close HZ). NOT rare — they're more common than terrestrial.
    //
    // Gas giants: ~15-20% of FGK systems, ~3-5% of M systems (Cumming 2008,
    // Mayor 2011). Concentrated at/beyond frost line. Hot Jupiters ~0.5-1%.
    //
    // Most common planet type: sub-Neptune (Fressin 2013, Kepler).
    // Super-Earths and sub-Neptunes dominate everywhere inside the frost line.
    // ════════════════════════════════════════════════════════════

    // ── Scorching zone: inside 0.4x habitable zone inner edge ──
    // Extreme radiation strips atmospheres. Lava worlds from tidal heating,
    // bare rocky cores, carbon worlds. Hot Jupiters are migrated gas giants
    // (~0.5-1% of all systems, only around FGK stars).
    if (orbitRadius < hzInner * 0.4) {
      if (starType !== 'M' && rng.chance(0.04)) return 'hot-jupiter';
      if (roll < 0.30) return 'lava';
      if (roll < 0.55) return 'rocky';
      if (roll < 0.75) return 'carbon';
      if (roll < 0.90) return 'venus';
      return 'lava';
    }

    // ── Inner zone: scorching edge to HZ inner edge ──
    // Too hot for liquid water. Venus-like greenhouse runaway dominates.
    // Sub-Neptunes are the most common Kepler planet type at all distances.
    // No terrestrial, no ocean — surface water boils off.
    if (orbitRadius < hzInner) {
      if (roll < 0.30) return 'venus';
      if (roll < 0.50) return 'rocky';
      if (roll < 0.65) return 'sub-neptune';
      if (roll < 0.80) return 'carbon';
      if (roll < 0.92) return 'lava';
      return 'venus';
    }

    // ── Habitable zone ──
    // Science-grounded but tuned for fun. Real rates are ~1-5% of systems
    // having habitable worlds; we target ~8% (any habitable) to keep
    // exploration rewarding without making life common.
    //
    // System-level targets (per 5000-system census):
    //   ~3% of systems have terrestrial (life-bearing)
    //   ~6% of systems have ocean (water world)
    //   ~8% of systems have any habitable (terrestrial/ocean/eyeball)
    //
    // M/K dwarfs: HZ is close-in → tidal locking → eyeball is the default
    // habitable type. Terrestrial (non-locked) is rare around these stars.
    if (orbitRadius < hzOuter) {
      const isCoolStar = (starType === 'M' || starType === 'K');
      const terrestrialChance = isCoolStar ? 0.04 : 0.10;
      const oceanChance = 0.13;
      const eyeballChance = isCoolStar ? 0.06 : 0.02;

      let threshold = 0;
      threshold += terrestrialChance;
      if (roll < threshold) return 'terrestrial';
      threshold += oceanChance;
      if (roll < threshold) return 'ocean';
      threshold += eyeballChance;
      if (roll < threshold) return 'eyeball';
      if (roll < 0.48) return 'sub-neptune';
      if (roll < 0.72) return 'rocky';
      if (roll < 0.86) return 'venus';
      return 'ice';
    }

    // ── Transition zone: HZ outer edge to frost line ──
    // Water freezes on surfaces. Sub-Neptunes and ice worlds dominate.
    // Gas giants rare here — they form AT the frost line, not before it.
    // No liquid water on surfaces — too cold.
    if (orbitRadius < frostLine) {
      if (roll < 0.30) return 'sub-neptune';
      if (roll < 0.55) return 'ice';
      if (roll < 0.72) return 'rocky';
      if (roll < 0.80) return 'gas-giant';
      return 'carbon';
    }

    // ── Outer system: beyond frost line ──
    // Gas giant formation zone (core accretion peaks at snow line).
    // ~15-20% of FGK stars have gas giants (Cumming 2008), ~3-5% of M dwarfs.
    // But each individual outer planet has a LOW chance of being a gas giant —
    // systems have multiple outer planets, so per-planet rate must be modest
    // to hit 15-20% at the system level.
    const frostRatio = orbitRadius / frostLine;
    // Gas giants peak near frost line (1-3x), decline further out
    const gasBase = (starType === 'M') ? 0.03 : 0.10;
    const gasBoost = (frostRatio < 3.0 && starType !== 'M') ? 0.08 : 0.0;
    if (roll < gasBase + gasBoost) return 'gas-giant';
    if (roll < 0.48) return 'ice';
    if (roll < 0.68) return 'sub-neptune';
    if (roll < 0.85) return 'rocky';
    return 'carbon';
  }
}
