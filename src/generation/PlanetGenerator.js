import { earthRadiiToScene } from '../core/ScaleConstants.js';
import {
  estimateMassEarth, computeAtmosphere, deriveComposition,
  equilibriumTemperature, tidalLockTimescale, checkTidalLock,
  habitabilityScore, computeSurfaceHistory, generateRingPhysics,
} from './PhysicsEngine.js';

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
        { base: [0.5, 0.4, 0.25], accent: [0.65, 0.5, 0.3] },       // Sandstone
        { base: [0.2, 0.18, 0.25], accent: [0.35, 0.3, 0.4] },      // Slate purple
        { base: [0.4, 0.2, 0.15], accent: [0.55, 0.35, 0.2] },      // Red sandstone
        { base: [0.3, 0.25, 0.3], accent: [0.45, 0.4, 0.45] },      // Mauve rock
        { base: [0.15, 0.15, 0.18], accent: [0.3, 0.28, 0.35] },    // Basalt
        { base: [0.55, 0.5, 0.35], accent: [0.7, 0.65, 0.45] },     // Ochre
        { base: [0.22, 0.28, 0.22], accent: [0.35, 0.42, 0.32] },   // Green-grey rock
        { base: [0.4, 0.35, 0.4], accent: [0.55, 0.5, 0.55] },      // Granite pink
      ],
    },
    'gas-giant': {
      colors: [
        { base: [0.7, 0.5, 0.2], accent: [0.85, 0.65, 0.3] },      // Jupiter gold
        { base: [0.3, 0.35, 0.5], accent: [0.5, 0.55, 0.7] },       // Neptune blue
        { base: [0.6, 0.3, 0.2], accent: [0.8, 0.5, 0.3] },         // Warm red
        { base: [0.55, 0.45, 0.3], accent: [0.7, 0.6, 0.4] },       // Muted tan
        { base: [0.2, 0.3, 0.35], accent: [0.35, 0.5, 0.55] },      // Blue-grey
        { base: [0.75, 0.6, 0.35], accent: [0.9, 0.75, 0.45] },     // Saturn pale gold
        { base: [0.45, 0.35, 0.55], accent: [0.6, 0.5, 0.7] },      // Lavender bands
        { base: [0.15, 0.25, 0.45], accent: [0.3, 0.45, 0.65] },    // Deep ocean blue
        { base: [0.65, 0.4, 0.15], accent: [0.8, 0.55, 0.2] },      // Amber storm
        { base: [0.35, 0.45, 0.35], accent: [0.5, 0.6, 0.45] },     // Olive green
        { base: [0.5, 0.3, 0.4], accent: [0.7, 0.45, 0.55] },       // Rose bands
        { base: [0.25, 0.2, 0.4], accent: [0.4, 0.35, 0.6] },       // Indigo
        { base: [0.4, 0.5, 0.5], accent: [0.55, 0.65, 0.6] },       // Turquoise haze
        { base: [0.7, 0.55, 0.4], accent: [0.85, 0.7, 0.5] },       // Peach cream
        { base: [0.3, 0.4, 0.25], accent: [0.45, 0.55, 0.35] },     // Jade green
        { base: [0.55, 0.35, 0.25], accent: [0.75, 0.5, 0.35] },    // Copper bands
        { base: [0.18, 0.22, 0.3], accent: [0.3, 0.38, 0.5] },      // Dark steel blue
        { base: [0.6, 0.55, 0.45], accent: [0.75, 0.7, 0.55] },     // Pale butter
        { base: [0.45, 0.25, 0.3], accent: [0.65, 0.4, 0.45] },     // Burgundy bands
        { base: [0.35, 0.3, 0.2], accent: [0.5, 0.45, 0.3] },       // Khaki brown
      ],
    },
    ice: {
      colors: [
        { base: [0.7, 0.8, 0.9], accent: [0.5, 0.6, 0.8] },        // Pale blue
        { base: [0.85, 0.85, 0.9], accent: [0.6, 0.7, 0.85] },      // White-blue
        { base: [0.6, 0.7, 0.75], accent: [0.4, 0.5, 0.65] },       // Steel blue
        { base: [0.75, 0.85, 0.8], accent: [0.5, 0.7, 0.6] },       // Mint frost
        { base: [0.65, 0.65, 0.8], accent: [0.45, 0.45, 0.7] },     // Lavender ice
        { base: [0.8, 0.9, 0.95], accent: [0.55, 0.7, 0.85] },      // Bright arctic
        { base: [0.55, 0.6, 0.7], accent: [0.35, 0.4, 0.55] },      // Dark glacier
        { base: [0.7, 0.75, 0.85], accent: [0.5, 0.55, 0.75] },     // Periwinkle ice
        { base: [0.8, 0.8, 0.75], accent: [0.6, 0.6, 0.55] },       // Dirty ice
        { base: [0.6, 0.75, 0.85], accent: [0.4, 0.55, 0.7] },      // Europa blue
        { base: [0.9, 0.88, 0.85], accent: [0.7, 0.65, 0.6] },      // Warm white ice
        { base: [0.5, 0.55, 0.65], accent: [0.3, 0.35, 0.5] },      // Titan grey
        { base: [0.65, 0.8, 0.75], accent: [0.45, 0.6, 0.55] },     // Jade ice
        { base: [0.72, 0.68, 0.82], accent: [0.52, 0.48, 0.68] },   // Amethyst frost
        { base: [0.78, 0.82, 0.78], accent: [0.55, 0.6, 0.55] },    // Green-grey frost
        { base: [0.6, 0.65, 0.55], accent: [0.4, 0.45, 0.35] },     // Methane haze ice
        { base: [0.85, 0.8, 0.9], accent: [0.65, 0.6, 0.75] },      // Pink frost
        { base: [0.55, 0.7, 0.8], accent: [0.35, 0.5, 0.65] },      // Deep frozen ocean
        { base: [0.75, 0.7, 0.65], accent: [0.55, 0.5, 0.45] },     // Io-like sulfur ice
        { base: [0.68, 0.78, 0.88], accent: [0.48, 0.58, 0.72] },   // Enceladus
      ],
    },
    lava: {
      colors: [
        { base: [0.15, 0.1, 0.1], accent: [0.9, 0.3, 0.05] },      // Dark + orange glow
        { base: [0.2, 0.12, 0.08], accent: [1.0, 0.5, 0.1] },       // Dark + yellow glow
        { base: [0.12, 0.08, 0.1], accent: [0.8, 0.15, 0.05] },     // Dark + red glow
        { base: [0.1, 0.1, 0.15], accent: [0.6, 0.2, 0.8] },        // Dark + violet glow
        { base: [0.18, 0.15, 0.08], accent: [0.95, 0.8, 0.2] },     // Dark + bright gold glow
        { base: [0.08, 0.05, 0.05], accent: [1.0, 0.2, 0.0] },      // Obsidian + pure red lava
        { base: [0.12, 0.1, 0.12], accent: [0.85, 0.4, 0.6] },      // Dark + magenta cracks
        { base: [0.14, 0.08, 0.05], accent: [0.9, 0.6, 0.1] },      // Dark brown + amber rivers
        { base: [0.06, 0.06, 0.08], accent: [0.5, 0.8, 0.9] },      // Near-black + cyan hot cracks
        { base: [0.1, 0.07, 0.05], accent: [0.95, 0.35, 0.0] },     // Charcoal + neon orange
        { base: [0.08, 0.08, 0.12], accent: [0.7, 0.3, 0.9] },      // Dark + purple-white glow
        { base: [0.16, 0.12, 0.06], accent: [0.85, 0.7, 0.1] },     // Brown crust + gold veins
        { base: [0.05, 0.03, 0.06], accent: [0.4, 0.9, 0.3] },      // Obsidian + green plasma
        { base: [0.12, 0.06, 0.02], accent: [0.95, 0.45, 0.0] },    // Dark rust + bright orange
        { base: [0.1, 0.1, 0.08], accent: [0.9, 0.9, 0.4] },        // Grey + white-hot cracks
        { base: [0.07, 0.05, 0.1], accent: [0.6, 0.1, 0.3] },       // Deep purple + blood red
        { base: [0.15, 0.08, 0.04], accent: [1.0, 0.65, 0.0] },     // Sienna + solar gold
        { base: [0.04, 0.04, 0.06], accent: [0.3, 0.5, 1.0] },      // Near-black + electric blue
        { base: [0.1, 0.12, 0.08], accent: [0.8, 0.55, 0.15] },     // Greenish crust + amber
        { base: [0.08, 0.04, 0.08], accent: [0.9, 0.2, 0.5] },      // Dark + hot pink fissures
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
        { base: [0.15, 0.22, 0.45], accent: [0.4, 0.3, 0.15] },     // Ocean + desert continent
        { base: [0.06, 0.12, 0.3], accent: [0.25, 0.55, 0.3] },     // Dark ocean + emerald
        { base: [0.1, 0.18, 0.4], accent: [0.45, 0.4, 0.25] },      // Ocean + autumn land
        { base: [0.08, 0.2, 0.42], accent: [0.5, 0.45, 0.35] },     // Ocean + rocky coast
        { base: [0.05, 0.1, 0.3], accent: [0.35, 0.25, 0.15] },     // Deep ocean + arid land
        { base: [0.12, 0.22, 0.48], accent: [0.2, 0.4, 0.25] },     // Bright ocean + olive land
        { base: [0.1, 0.15, 0.38], accent: [0.55, 0.5, 0.3] },      // Ocean + golden plains
        { base: [0.06, 0.16, 0.32], accent: [0.3, 0.5, 0.4] },      // Teal ocean + moss
        { base: [0.15, 0.2, 0.35], accent: [0.4, 0.35, 0.3] },      // Warm ocean + brown land
        { base: [0.08, 0.2, 0.5], accent: [0.15, 0.3, 0.18] },      // Vivid ocean + dark green
        { base: [0.1, 0.16, 0.42], accent: [0.5, 0.3, 0.2] },       // Ocean + red soil
        { base: [0.07, 0.14, 0.28], accent: [0.4, 0.45, 0.2] },     // Dark ocean + grassland
        { base: [0.12, 0.18, 0.35], accent: [0.3, 0.45, 0.35] },    // Ocean + tundra green
        { base: [0.05, 0.12, 0.25], accent: [0.45, 0.35, 0.25] },   // Deep ocean + sandstone
        { base: [0.1, 0.2, 0.45], accent: [0.2, 0.35, 0.2] },       // Clear ocean + pine
        { base: [0.08, 0.15, 0.38], accent: [0.55, 0.45, 0.15] },   // Ocean + wheat fields
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
        { base: [0.08, 0.15, 0.1], accent: [0.1, 0.8, 0.7] },       // Dark green + cyan glow
        { base: [0.06, 0.12, 0.12], accent: [0.8, 0.2, 0.6] },       // Dark teal + pink glow
        { base: [0.1, 0.1, 0.06], accent: [0.2, 0.9, 0.4] },         // Brown-green + green glow
        { base: [0.05, 0.1, 0.1], accent: [0.3, 0.7, 0.9] },         // Dark teal + blue glow
        { base: [0.12, 0.05, 0.12], accent: [0.7, 0.1, 0.9] },       // Deep purple + violet biolum
        { base: [0.06, 0.08, 0.05], accent: [0.4, 0.95, 0.3] },      // Near-black + neon green
        { base: [0.1, 0.08, 0.04], accent: [0.9, 0.5, 0.1] },        // Dark soil + orange fruiting
        { base: [0.04, 0.04, 0.06], accent: [0.2, 0.4, 0.95] },      // Dark void + electric blue
        { base: [0.08, 0.06, 0.1], accent: [0.9, 0.3, 0.8] },        // Dark purple + magenta glow
        { base: [0.12, 0.12, 0.08], accent: [0.8, 0.8, 0.2] },       // Brown + yellow-green biolum
        { base: [0.03, 0.06, 0.08], accent: [0.15, 0.85, 0.85] },    // Abyssal dark + aqua glow
        { base: [0.1, 0.04, 0.06], accent: [0.95, 0.2, 0.3] },       // Dark red + crimson fruiting
        { base: [0.06, 0.1, 0.06], accent: [0.5, 0.9, 0.6] },        // Forest floor + pale green
        { base: [0.08, 0.05, 0.08], accent: [0.6, 0.3, 0.95] },      // Dark + deep purple mycelium
        { base: [0.05, 0.05, 0.03], accent: [0.85, 0.75, 0.4] },     // Ghostly white-gold (spectral)
        { base: [0.04, 0.08, 0.12], accent: [0.3, 0.6, 0.85] },      // Deep sea + bioluminescent blue
        { base: [0.1, 0.06, 0.02], accent: [0.7, 0.4, 0.1] },        // Dark amber + warm orange
        { base: [0.02, 0.06, 0.04], accent: [0.1, 0.95, 0.5] },      // Near-black + emerald glow
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
      'fungal': [1.5, 6.0], // Wide range: low = large sprawling networks, high = dense fine clusters
    };
    const noiseScale = rng.range(...(noiseScaleRanges[type] || [2.0, 5.0]));

    // ── Physics-driven properties ──
    // Mass estimate from radius + type (PhysicsEngine §1)
    const massEarth = estimateMassEarth(radiusEarth, type);

    // Composition from star chemistry (PhysicsEngine §3)
    // zones carries metallicity and frostLine from the system generator
    const composition = zones
      ? deriveComposition(zones.metallicity || 0, orbitRadiusAU, zones.frostLine || 4.85, rng.float())
      : deriveComposition(0, orbitRadiusAU, 4.85, rng.float());

    // Equilibrium temperature
    const luminosityRel = zones?.luminosity || 1.0;
    const T_eq = equilibriumTemperature(luminosityRel, Math.max(orbitRadiusAU, 0.01));

    // Tidal locking (PhysicsEngine §2)
    const starMassSolar = zones?.starMassSolar || 1.0;
    const ageGyr = zones?.ageGyr || 4.5;
    const lockTimescale = tidalLockTimescale(starMassSolar, massEarth, radiusEarth, Math.max(orbitRadiusAU, 0.01));
    const tidalState = checkTidalLock(lockTimescale, ageGyr);

    // Atmosphere — physics-driven (PhysicsEngine §1)
    const atmoPhysics = computeAtmosphere({
      radiusEarth, massEarth, orbitAU: orbitRadiusAU,
      luminosityRel, ageGyr,
      ironFraction: composition.ironFraction,
      rotationSpeed: tidalState.locked ? 0 : 0.1,
      type,
    });

    // Convert physics atmosphere to visual format (preserving renderer compatibility)
    const atmoColors = {
      'h2-he': [0.4, 0.55, 0.7],
      'n2-o2': [0.3, 0.5, 0.9],
      'co2-n2': [0.7, 0.6, 0.3],
      'co2': [0.75, 0.55, 0.25],
      'methane': [0.3, 0.4, 0.6],
      'none': null,
    };
    // Type-specific color overrides for visual quality
    const typeAtmoColors = {
      'gas-giant': palette.accent.map(c => Math.min(c * 1.3, 1.0)),
      'hot-jupiter': [0.8, 0.35, 0.1],
      'lava': [0.9, 0.3, 0.1],
      'hex': [0.1, 0.6, 0.7],
      'shattered': [0.3, 0.3, 0.8],
      'crystal': [0.5, 0.2, 0.6],
      'fungal': [0.15, 0.5, 0.4],
      'ecumenopolis': [0.5, 0.45, 0.35],
    };
    let atmosphere = null;
    if (atmoPhysics.retained) {
      const atmoStrengths = {
        'sub-neptune': [0.4, 0.8], 'venus': [0.5, 0.7], 'hot-jupiter': [0.3, 0.6],
      };
      const [sMin, sMax] = atmoStrengths[type] || [0.15, 0.55];
      // Scale strength by pressure (clamped)
      const pressureStrength = Math.min(1.0, atmoPhysics.pressure / 10);
      atmosphere = {
        color: typeAtmoColors[type] || atmoColors[atmoPhysics.composition] || [0.5, 0.5, 0.8],
        strength: Math.max(sMin, Math.min(sMax, pressureStrength)),
        // Physics data (for future use by scanner, HUD, etc.)
        physics: atmoPhysics,
      };
    }

    // ── Aurora ── (physics-driven: magnetic field + atmosphere + stellar wind)
    let aurora = null;
    if (atmoPhysics.retained) {
      // Magnetic field strength: iron core fraction × rotation factor
      const isLocked = tidalState.locked && tidalState.lockType === 'synchronous';
      const fieldStrength = composition.ironFraction * (isLocked ? 0.2 : 1.0);

      // UV/stellar wind flux (1/r² from star)
      const uvFlux = luminosityRel / Math.max(orbitRadiusAU * orbitRadiusAU, 0.001);

      // Aurora requires magnetic field AND stellar wind interaction
      // Strong field + moderate UV = clear auroral ovals (Earth, Jupiter)
      // Weak field = no aurora (Venus, Mars)
      // Very strong UV can overwhelm even weak fields (close-in planets around M-dwarfs)
      if (fieldStrength > 0.05) {
        // Aurora intensity: stronger stellar wind + stronger field = brighter
        // But very close planets get overwhelmed (field compressed, aurora everywhere)
        const windIntensity = Math.min(uvFlux, 50); // cap extreme cases
        const auroraIntensity = Math.min(1.0, fieldStrength * windIntensity * 0.15);

        // Only visible auroras above a threshold
        if (auroraIntensity > 0.05) {
          // Aurora color depends on atmospheric composition
          // N2/O2: green (557.7nm oxygen) + red (630nm oxygen) — Earth
          // H2/He: blue/purple (Balmer series hydrogen) — Jupiter, Saturn
          // CO2: pink/red (CO2 dissociation → O emissions)
          // Methane: blue-green
          const auroraColors = {
            'n2-o2': [0.3, 0.9, 0.4],    // Green (oxygen line)
            'h2-he': [0.3, 0.2, 0.8],     // Blue-purple (hydrogen)
            'co2-n2': [0.8, 0.3, 0.4],    // Pink-red
            'co2': [0.9, 0.35, 0.5],      // Pink
            'methane': [0.2, 0.6, 0.7],   // Blue-green
          };
          const color = auroraColors[atmoPhysics.composition] || [0.3, 0.8, 0.4];

          // Aurora ring latitude: typically 60-75° from equator (15-30° from pole)
          // Stronger field → narrower ring closer to pole
          // Weaker field → wider, more diffuse ring, closer to equator
          const ringLatitude = 0.7 + fieldStrength * 0.2; // 0.7 to 0.9 (in normalized Y)
          const ringWidth = 0.15 - fieldStrength * 0.08;  // 0.07 to 0.15

          aurora = {
            color,
            intensity: auroraIntensity,
            ringLatitude,
            ringWidth,
          };
        }
      }
    }

    // ── Clouds ── (physics-informed: need atmosphere + right temperature)
    const cloudChance = {
      'terrestrial': 0.85, 'ocean': 0.7, 'gas-giant': 0.0,
      'rocky': 0.1, 'ice': 0.15, 'lava': 0.2,
      'hot-jupiter': 0.0, 'sub-neptune': 0.0, 'venus': 0.0,
      'eyeball': 0.6, 'carbon': 0.3,
      'hex': 0.0, 'shattered': 0.0, 'crystal': 0.0,
      'fungal': 0.0, 'machine': 0.0,
      'city-lights': 0.75, 'ecumenopolis': 0.15,
    };
    // Clouds require an atmosphere
    const hasClouds = atmoPhysics.retained && rng.chance(cloudChance[type] || 0);
    let clouds = null;
    if (hasClouds) {
      const cloudColors = { 'lava': [0.3, 0.2, 0.15], 'carbon': [0.2, 0.15, 0.1] };
      clouds = {
        color: cloudColors[type] || [0.9, 0.9, 0.92],
        density: rng.range(0.3, 0.7),
        scale: rng.range(2.0, 4.0),
      };
    }

    // ── Rings — physics-driven (PhysicsEngine §11) ──
    // Ring probability now depends on physical conditions, not flat chance
    const ringChance = {
      'gas-giant': 0.5, 'ice': 0.2, 'rocky': 0.05,
      'terrestrial': 0.1, 'ocean': 0.03, 'lava': 0.02,
      'hot-jupiter': 0.05, 'sub-neptune': 0.12,
      'eyeball': 0.0, 'venus': 0.0, 'carbon': 0.03,
      'hex': 0.0, 'shattered': 0.0, 'crystal': 0.0,
      'fungal': 0.0, 'machine': 0.0,
      'city-lights': 0.08, 'ecumenopolis': 0.03,
    };
    const hasRings = rng.chance(ringChance[type] || 0.02);
    let rings = null;
    if (hasRings) {
      // Pick ring origin based on type
      const originRoll = rng.float();
      let ringOrigin;
      if (type === 'gas-giant' || type === 'sub-neptune') {
        ringOrigin = originRoll < 0.5 ? 'roche' : originRoll < 0.8 ? 'accretion' : 'collision';
      } else {
        ringOrigin = originRoll < 0.6 ? 'collision' : 'roche';
      }

      const axialTilt = rng.chance(0.1) ? rng.range(-1.5, 1.5) : rng.range(-0.5, 0.5);
      const ringPhysics = generateRingPhysics({
        origin: ringOrigin,
        planetRadiusEarth: radiusEarth,
        planetDensity: composition.density,
        ageGyr,
        axialTilt,
        moons: [], // moons not generated yet at this point
        rngFloat1: rng.float(), rngFloat2: rng.float(),
        rngFloat3: rng.float(), rngFloat4: rng.float(), rngFloat5: rng.float(),
      });

      // Convert to renderer-compatible format (preserving old field names)
      rings = {
        innerRadius: ringPhysics.innerRadius,
        outerRadius: ringPhysics.outerRadius,
        color1: ringPhysics.color1,
        color2: ringPhysics.color2,
        opacity: ringPhysics.density,
        tiltX: ringPhysics.tiltX,
        tiltZ: ringPhysics.tiltZ,
        // Physics data
        physics: ringPhysics,
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

    // Habitability scoring (PhysicsEngine §7)
    const habScore = habitabilityScore({
      atmosphereRetained: atmoPhysics.retained,
      T_eq,
      ageGyr,
      ironFraction: composition.ironFraction,
      massEarth,
      tidalState,
      orbitStable: true, // refined by system generator later
    });

    // Surface history (PhysicsEngine §10)
    const surfaceHistory = computeSurfaceHistory(
      ageGyr, false, false, // nearBelt/nearGiant refined by system generator later
      atmoPhysics.retained, 0, // tidalHeatingRate for planets is ~0 (moons get tidal heating)
    );

    // ── Gas giant storms ── (deterministic from seed)
    let storms = null;
    if (type === 'gas-giant') {
      const stormSpots = [];
      // ~40% of gas giants have at least one visible storm
      if (rng.chance(0.4)) {
        const count = rng.int(1, 3);
        for (let i = 0; i < count; i++) {
          // Position on sphere — avoid extreme poles for storm spots
          const theta = rng.range(0, Math.PI * 2);
          const phi = Math.acos(rng.range(-0.7, 0.7));
          // Size: angular radius (0.1 = small storm, 0.3 = massive Great Red Spot)
          const size = rng.range(0.08, 0.3);
          // Aspect ratio for oval shape (1.2-2.5, elongated along latitude)
          const aspect = rng.range(1.2, 2.5);
          // Storm color: contrasting — darken or shift from base/accent
          const colorChoice = rng.float();
          let color;
          if (colorChoice < 0.4) {
            // Dark bruise (like Neptune's Great Dark Spot)
            color = palette.base.map(c => c * 0.4);
          } else if (colorChoice < 0.7) {
            // Warm contrasting (like Jupiter's Great Red Spot)
            color = [
              Math.min(palette.accent[0] * 1.3 + 0.1, 1.0),
              palette.accent[1] * 0.6,
              palette.accent[2] * 0.4,
            ];
          } else {
            // Bright pale spot (like Saturn's white storms)
            color = palette.accent.map(c => Math.min(c * 1.5 + 0.15, 1.0));
          }
          stormSpots.push({
            position: [
              Math.sin(phi) * Math.cos(theta),
              Math.cos(phi), // Y is up in the shader
              Math.sin(phi) * Math.sin(theta),
            ],
            size,
            aspect,
            color,
          });
        }
      }
      // Polar geometric storm (~15% chance, like Saturn's hexagon)
      let polarStorm = null;
      if (rng.chance(0.15)) {
        polarStorm = {
          sides: rng.int(5, 8),
          // Which pole (north or south)
          pole: rng.chance(0.5) ? 1.0 : -1.0,
          // Angular radius of the polygon
          radius: rng.range(0.12, 0.22),
          // Contrasting color
          color: [
            Math.min(palette.base[0] * 0.7 + 0.15, 1.0),
            Math.min(palette.base[1] * 0.7 + 0.1, 1.0),
            Math.min(palette.base[2] * 0.7 + 0.2, 1.0),
          ],
        };
      }
      if (stormSpots.length > 0 || polarStorm) {
        storms = { spots: stormSpots, polarStorm };
      }
    }

    // Axial tilt — use ring tilt if rings exist, otherwise random
    const axialTilt = rings ? rings.tiltX : (rng.chance(0.1)
      ? rng.range(-1.5, 1.5)
      : rng.range(-0.5, 0.5));

    // Rotation — physics-driven tidal locking replaces hardcoded check
    let rotationSpeed;
    if (tidalState.locked && tidalState.lockType === 'synchronous') {
      rotationSpeed = 0;
    } else if (tidalState.locked && tidalState.lockType === '3:2-resonance') {
      rotationSpeed = 0.02; // slow spin, not zero
    } else {
      rotationSpeed = rng.range(0.033, 0.167) * (rng.chance(0.15) ? -1 : 1);
    }

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
      aurora,
      storms,
      moonCount,
      noiseScale,
      noiseDetail: rng.range(0.3, 0.8),
      rotationSpeed,
      axialTilt,
      sunDirection,
      // Physics data (new — used by HUD, scanner, gameplay)
      massEarth,
      composition,
      T_eq,
      tidalState,
      habitability: habScore,
      surfaceHistory,
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
    // Metallicity and archetype size bias (optional — fallback for standalone use)
    const metallicity = zones.metallicity ?? 0.0;
    const sizeBias = zones.sizeBias ?? 'neutral';

    // Fischer-Valenti scaling: gas giant probability ∝ 10^(2×[Fe/H]).
    // At solar metallicity (0.0): factor = 1.0
    // At [Fe/H] = +0.3: factor ≈ 4.0 (metal-rich → many gas giants)
    // At [Fe/H] = -0.5: factor ≈ 0.1 (metal-poor → almost no gas giants)
    const metalFactor = Math.pow(10, 2 * metallicity);

    // Archetype size bias: shifts probability slightly toward smaller or
    // larger planet types. Compact-rocky → more rocky, less gas.
    // Spread-giant → more gas/sub-neptune, less rocky.
    const sizeMod = sizeBias === 'small' ? -0.05 : sizeBias === 'large' ? 0.05 : 0;

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
      if (starType !== 'M' && rng.chance(Math.min(0.04 * metalFactor, 0.15))) return 'hot-jupiter';
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
    // Gas giants starting to appear near frost line, scaled by metallicity.
    // No liquid water on surfaces — too cold.
    if (orbitRadius < frostLine) {
      const transGasProb = Math.min(0.08 * metalFactor + sizeMod, 0.25);
      if (roll < 0.30) return 'sub-neptune';
      if (roll < 0.55) return 'ice';
      if (roll < 0.72) return 'rocky';
      if (roll < 0.72 + transGasProb) return 'gas-giant';
      return 'carbon';
    }

    // ── Outer system: beyond frost line ──
    // Gas giant formation zone (core accretion peaks at snow line).
    // Fischer-Valenti: P(giant) ∝ 10^(2×[Fe/H]).
    // Metal-rich systems → many gas giants. Metal-poor → almost none.
    // Archetype sizeBias also shifts probability.
    const frostRatio = orbitRadius / frostLine;
    const gasBase = ((starType === 'M') ? 0.03 : 0.10) * metalFactor + sizeMod;
    const gasBoost = (frostRatio < 3.0 && starType !== 'M') ? 0.08 * metalFactor : 0.0;
    const gasProb = Math.min(gasBase + gasBoost, 0.40);
    if (roll < gasProb) return 'gas-giant';
    if (roll < 0.48) return 'ice';
    if (roll < 0.68) return 'sub-neptune';
    if (roll < 0.85) return 'rocky';
    return 'carbon';
  }
}
