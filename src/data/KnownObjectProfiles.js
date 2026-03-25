/**
 * KnownObjectProfiles — style profiles for real Messier / NGC objects.
 *
 * Each profile stores:
 *   - Real galactic position (converted to our galactocentric coordinates
 *     where the Sun sits at roughly (8, 0.025, 0) kpc)
 *   - Visual style parameters that drive procedural rendering
 *   - Metadata (name, catalog IDs, type)
 *
 * The StyleProfileAdapter translates these into renderer-compatible data
 * (Nebula layer configs, Galaxy particle arrays, SkyFeatureLayer billboards).
 *
 * Approach C: procedural rendering with observational style profiles.
 * Instead of textures or hand-authored geometry, each object's visual
 * identity comes from tuned noise parameters, color palettes, and
 * structural hints that make it look distinct from generic procedural output.
 */

export const KNOWN_OBJECT_PROFILES = {

  // ── M42: Orion Nebula ───────────────────────────────────────────
  // The brightest nebula in the sky, visible to the naked eye.
  // A giant H II region with the Trapezium cluster at its heart.
  // Real: l=209.0°, b=-19.4°, d=0.41 kpc from Sun
  'M42': {
    name: 'Orion Nebula',
    messier: 'M42',
    ngc: 'NGC 1976',
    type: 'emission-nebula',
    galacticPos: { x: 8.35, y: -0.11, z: -0.19 },
    radius: 0.004, // ~4 pc radius
    shape: 'irregular',
    colorPrimary: [0.85, 0.25, 0.15],    // H-alpha red/pink
    colorSecondary: [0.2, 0.65, 0.55],   // OIII teal
    colorMix: 0.3,
    noiseOctaves: 5,
    noiseScale: 3.5,
    domainWarpStrength: 0.9,
    asymmetry: 0.6,
    darkLanes: true,
    darkLaneStrength: 0.4,
    embeddedStars: {
      count: 8,
      brightestColor: [0.7, 0.8, 1.0],
      concentration: 0.8,
    },
    layers: 6,
    brightnessProfile: 'center-bright',
    integratedMagnitude: 4.0,
  },

  // ── M1: Crab Nebula ─────────────────────────────────────────────
  // Supernova remnant from 1054 AD, powered by a pulsar at the center.
  // Filamentary structure, synchrotron blue + H-alpha red filaments.
  // Real: l=184.6°, b=-5.8°, d=2.0 kpc from Sun
  'M1': {
    name: 'Crab Nebula',
    messier: 'M1',
    ngc: 'NGC 1952',
    type: 'supernova-remnant',
    galacticPos: { x: 9.93, y: -0.18, z: -0.38 },
    radius: 0.0017, // ~1.7 pc radius (roughly 5.5 ly across)
    shape: 'filamentary',
    colorPrimary: [0.75, 0.3, 0.2],      // H-alpha red filaments
    colorSecondary: [0.3, 0.5, 0.9],     // Synchrotron blue
    colorMix: 0.5,
    noiseOctaves: 6,
    noiseScale: 4.0,
    domainWarpStrength: 1.2,
    asymmetry: 0.4,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 1, // the central pulsar
      brightestColor: [0.9, 0.9, 1.0],
      concentration: 1.0,
    },
    layers: 5,
    brightnessProfile: 'center-bright',
    integratedMagnitude: 8.4,
  },

  // ── M13: Great Hercules Cluster ─────────────────────────────────
  // One of the brightest globular clusters in the northern sky.
  // ~300,000 stars in a tight ball, mostly old yellow-orange Population II.
  // Real: l=59.0°, b=40.9°, d=7.1 kpc from Sun
  'M13': {
    name: 'Great Hercules Cluster',
    messier: 'M13',
    ngc: 'NGC 6205',
    type: 'globular-cluster',
    galacticPos: { x: 4.37, y: 4.54, z: 3.34 },
    radius: 0.021, // ~21 pc radius (84 ly diameter)
    shape: 'spherical',
    colorPrimary: [1.0, 0.85, 0.5],      // Warm yellow-orange (old stars)
    colorSecondary: [0.9, 0.7, 0.4],     // Deeper orange for core
    colorMix: 0.2,
    noiseOctaves: 0, // not noise-based — it's point particles
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.05, // nearly spherical
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 120,
      brightestColor: [1.0, 0.9, 0.6],
      concentration: 0.85, // King profile — concentrated toward center
    },
    layers: 0, // no nebula layers — just stars
    brightnessProfile: 'king-profile',
    integratedMagnitude: 5.8,
  },

  // ── M57: Ring Nebula ────────────────────────────────────────────
  // Classic planetary nebula — a ring of glowing gas around a dying star.
  // Blue-green ring (OIII) with faint red outer halo (H-alpha).
  // Real: l=63.2°, b=13.5°, d=0.7 kpc from Sun
  'M57': {
    name: 'Ring Nebula',
    messier: 'M57',
    ngc: 'NGC 6720',
    type: 'planetary-nebula',
    galacticPos: { x: 7.54, y: 0.19, z: 0.45 },
    radius: 0.00043, // ~0.43 pc radius (~1.4 ly diameter)
    shape: 'ring',
    colorPrimary: [0.2, 0.7, 0.6],       // OIII teal (dominant ring)
    colorSecondary: [0.8, 0.25, 0.2],    // H-alpha red (outer halo)
    colorMix: 0.25,
    noiseOctaves: 3,
    noiseScale: 2.5,
    domainWarpStrength: 0.4,
    asymmetry: 0.15, // fairly symmetric ring
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 1, // central white dwarf
      brightestColor: [0.8, 0.85, 1.0],
      concentration: 1.0,
    },
    layers: 4,
    brightnessProfile: 'ring',
    integratedMagnitude: 8.8,
    centralStar: {
      color: [0.8, 0.85, 1.0],
      luminosity: 0.5,
    },
  },

  // ── M45: Pleiades ───────────────────────────────────────────────
  // Young open cluster wrapped in blue reflection nebulosity.
  // The "Seven Sisters" — one of the closest clusters to Earth.
  // Real: l=166.6°, b=-23.5°, d=0.136 kpc from Sun
  'M45': {
    name: 'Pleiades',
    messier: 'M45',
    ngc: null, // no NGC number — it's a Messier-only object
    type: 'open-cluster',
    galacticPos: { x: 8.12, y: -0.03, z: -0.06 },
    radius: 0.005, // ~5 pc radius (cluster extent)
    shape: 'irregular',
    colorPrimary: [0.5, 0.6, 1.0],       // Blue-white young stars
    colorSecondary: [0.35, 0.5, 0.9],    // Blue reflection nebulosity
    colorMix: 0.35,
    noiseOctaves: 3,
    noiseScale: 2.0,
    domainWarpStrength: 0.5,
    asymmetry: 0.5,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 30,
      brightestColor: [0.6, 0.7, 1.0],
      concentration: 0.4, // loosely scattered
    },
    layers: 3, // faint reflection nebulosity layers
    brightnessProfile: 'scattered',
    integratedMagnitude: 1.6,
    hasReflectionNebulosity: true,
  },

  // ── M8: Lagoon Nebula ─────────────────────────────────────────────
  // Bright emission nebula in Sagittarius with a dark lane bisecting it.
  // Contains the Hourglass Nebula and open cluster NGC 6530.
  // Real: l=6.0°, b=-1.4°, d=1.25 kpc from Sun
  'M8': {
    name: 'Lagoon Nebula',
    messier: 'M8',
    ngc: 'NGC 6523',
    type: 'emission-nebula',
    galacticPos: { x: 6.76, y: -0.01, z: 0.13 },
    radius: 0.015,
    shape: 'irregular',
    colorPrimary: [0.9, 0.3, 0.25],       // H-alpha red/pink
    colorSecondary: [0.2, 0.55, 0.5],     // OIII teal pockets
    colorMix: 0.2,
    noiseOctaves: 5,
    noiseScale: 3.0,
    domainWarpStrength: 0.7,
    asymmetry: 0.5,
    darkLanes: true,
    darkLaneStrength: 0.6,
    embeddedStars: {
      count: 25,
      brightestColor: [0.7, 0.8, 1.0],
      concentration: 0.5,
    },
    layers: 5,
    brightnessProfile: 'center-bright',
    integratedMagnitude: 6.0,
  },

  // ── M17: Omega (Swan) Nebula ──────────────────────────────────────
  // Distinctive checkmark/swan shape. One of the brightest emission nebulae.
  // Real: l=15.1°, b=-0.7°, d=1.6 kpc from Sun
  'M17': {
    name: 'Omega Nebula',
    messier: 'M17',
    ngc: 'NGC 6618',
    type: 'emission-nebula',
    galacticPos: { x: 6.46, y: 0.01, z: 0.42 },
    radius: 0.007,
    shape: 'irregular',
    colorPrimary: [0.95, 0.35, 0.2],      // Vivid H-alpha red
    colorSecondary: [0.3, 0.6, 0.45],     // Green-teal OIII
    colorMix: 0.25,
    noiseOctaves: 5,
    noiseScale: 3.2,
    domainWarpStrength: 1.0,
    asymmetry: 0.7,
    darkLanes: true,
    darkLaneStrength: 0.5,
    embeddedStars: {
      count: 15,
      brightestColor: [0.8, 0.85, 1.0],
      concentration: 0.6,
    },
    layers: 5,
    brightnessProfile: 'center-bright',
    integratedMagnitude: 6.0,
  },

  // ── M20: Trifid Nebula ────────────────────────────────────────────
  // Three-lobed nebula split by dark dust lanes. Emission (red) + reflection (blue).
  // Real: l=7.0°, b=-0.2°, d=1.68 kpc from Sun
  'M20': {
    name: 'Trifid Nebula',
    messier: 'M20',
    ngc: 'NGC 6514',
    type: 'emission-nebula',
    galacticPos: { x: 6.33, y: 0.02, z: 0.20 },
    radius: 0.006,
    shape: 'irregular',
    colorPrimary: [0.85, 0.2, 0.2],       // H-alpha red emission
    colorSecondary: [0.3, 0.45, 0.9],     // Blue reflection component
    colorMix: 0.4,
    noiseOctaves: 4,
    noiseScale: 2.8,
    domainWarpStrength: 0.6,
    asymmetry: 0.45,
    darkLanes: true,
    darkLaneStrength: 0.8,
    embeddedStars: {
      count: 5,
      brightestColor: [0.75, 0.8, 1.0],
      concentration: 0.9,
    },
    layers: 5,
    brightnessProfile: 'center-bright',
    integratedMagnitude: 6.3,
  },

  // ── M16: Eagle Nebula ─────────────────────────────────────────────
  // Home of the Pillars of Creation. Star-forming H II region.
  // Real: l=17.0°, b=0.8°, d=1.74 kpc from Sun
  'M16': {
    name: 'Eagle Nebula',
    messier: 'M16',
    ngc: 'NGC 6611',
    type: 'emission-nebula',
    galacticPos: { x: 6.34, y: 0.05, z: 0.51 },
    radius: 0.010,
    shape: 'irregular',
    colorPrimary: [0.8, 0.25, 0.15],      // H-alpha red
    colorSecondary: [0.25, 0.55, 0.45],   // OIII teal
    colorMix: 0.3,
    noiseOctaves: 6,
    noiseScale: 3.5,
    domainWarpStrength: 1.1,
    asymmetry: 0.55,
    darkLanes: true,
    darkLaneStrength: 0.7,
    embeddedStars: {
      count: 20,
      brightestColor: [0.7, 0.8, 1.0],
      concentration: 0.65,
    },
    layers: 6,
    brightnessProfile: 'center-bright',
    integratedMagnitude: 6.0,
  },

  // ── NGC 2237: Rosette Nebula ──────────────────────────────────────
  // Large circular emission nebula with a central cavity blown by stellar winds.
  // Real: l=206.3°, b=-2.1°, d=1.6 kpc from Sun
  'NGC2237': {
    name: 'Rosette Nebula',
    messier: null,
    ngc: 'NGC 2237',
    type: 'emission-nebula',
    galacticPos: { x: 9.43, y: -0.03, z: -0.71 },
    radius: 0.016,
    shape: 'ring',
    colorPrimary: [0.9, 0.25, 0.2],       // H-alpha pink-red
    colorSecondary: [0.3, 0.5, 0.5],      // OIII teal-green
    colorMix: 0.2,
    noiseOctaves: 5,
    noiseScale: 2.5,
    domainWarpStrength: 0.5,
    asymmetry: 0.2,
    darkLanes: true,
    darkLaneStrength: 0.3,
    embeddedStars: {
      count: 30,
      brightestColor: [0.6, 0.7, 1.0],
      concentration: 0.7,
    },
    layers: 5,
    brightnessProfile: 'ring',
    integratedMagnitude: 6.0,
  },

  // ── NGC 7000: North America Nebula ────────────────────────────────
  // Large emission nebula in Cygnus whose shape resembles North America.
  // Real: l=85.2°, b=-0.5°, d=0.6 kpc from Sun
  'NGC7000': {
    name: 'North America Nebula',
    messier: null,
    ngc: 'NGC 7000',
    type: 'emission-nebula',
    galacticPos: { x: 7.95, y: 0.02, z: 0.60 },
    radius: 0.015,
    shape: 'irregular',
    colorPrimary: [0.85, 0.25, 0.2],      // H-alpha red
    colorSecondary: [0.15, 0.35, 0.3],    // Dark dust border
    colorMix: 0.15,
    noiseOctaves: 5,
    noiseScale: 2.2,
    domainWarpStrength: 0.8,
    asymmetry: 0.65,
    darkLanes: true,
    darkLaneStrength: 0.7,
    embeddedStars: {
      count: 10,
      brightestColor: [0.8, 0.85, 1.0],
      concentration: 0.3,
    },
    layers: 4,
    brightnessProfile: 'scattered',
    integratedMagnitude: 4.0,
  },

  // ── IC 1396: Elephant Trunk Nebula ────────────────────────────────
  // Large emission nebula in Cepheus with prominent dark globules.
  // Real: l=99.3°, b=3.7°, d=0.87 kpc from Sun
  'IC1396': {
    name: 'Elephant Trunk Nebula',
    messier: null,
    ngc: null,
    type: 'emission-nebula',
    galacticPos: { x: 8.14, y: 0.08, z: 0.86 },
    radius: 0.016,
    shape: 'irregular',
    colorPrimary: [0.9, 0.3, 0.2],        // H-alpha red
    colorSecondary: [0.4, 0.25, 0.15],    // Warm dust brown
    colorMix: 0.25,
    noiseOctaves: 5,
    noiseScale: 3.0,
    domainWarpStrength: 0.9,
    asymmetry: 0.5,
    darkLanes: true,
    darkLaneStrength: 0.6,
    embeddedStars: {
      count: 12,
      brightestColor: [0.9, 0.85, 0.7],
      concentration: 0.4,
    },
    layers: 5,
    brightnessProfile: 'scattered',
    integratedMagnitude: 3.5,
  },

  // ── NGC 6888: Crescent Nebula ─────────────────────────────────────
  // Wind-blown bubble around a Wolf-Rayet star. Distinctive crescent shape.
  // Real: l=75.5°, b=2.4°, d=1.26 kpc from Sun
  'NGC6888': {
    name: 'Crescent Nebula',
    messier: null,
    ngc: 'NGC 6888',
    type: 'emission-nebula',
    galacticPos: { x: 7.68, y: 0.08, z: 1.22 },
    radius: 0.006,
    shape: 'ring',
    colorPrimary: [0.3, 0.65, 0.55],      // OIII teal-green
    colorSecondary: [0.85, 0.3, 0.2],     // H-alpha red edges
    colorMix: 0.35,
    noiseOctaves: 4,
    noiseScale: 3.0,
    domainWarpStrength: 0.7,
    asymmetry: 0.6,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 1,
      brightestColor: [0.7, 0.8, 1.0],
      concentration: 1.0,
    },
    layers: 4,
    brightnessProfile: 'ring',
    integratedMagnitude: 7.4,
  },

  // ── IC 434: Horsehead Nebula ──────────────────────────────────────
  // Iconic dark nebula silhouetted against red emission background.
  // Real: l=206.5°, b=-16.6°, d=0.4 kpc from Sun
  'IC434': {
    name: 'Horsehead Nebula',
    messier: null,
    ngc: null,
    type: 'emission-nebula',
    galacticPos: { x: 8.34, y: -0.09, z: -0.17 },
    radius: 0.003,
    shape: 'irregular',
    colorPrimary: [0.8, 0.2, 0.15],       // H-alpha red background
    colorSecondary: [0.05, 0.03, 0.02],   // Near-black dark nebula
    colorMix: 0.5,
    noiseOctaves: 5,
    noiseScale: 4.0,
    domainWarpStrength: 1.3,
    asymmetry: 0.7,
    darkLanes: true,
    darkLaneStrength: 0.9,
    embeddedStars: {
      count: 3,
      brightestColor: [0.7, 0.75, 1.0],
      concentration: 0.3,
    },
    layers: 4,
    brightnessProfile: 'scattered',
    integratedMagnitude: 6.8,
  },

  // ── M78: Reflection Nebula ────────────────────────────────────────
  // Brightest reflection nebula in the sky. Blue light scattered by dust.
  // Real: l=205.6°, b=-17.2°, d=0.4 kpc from Sun
  'M78': {
    name: 'M78',
    messier: 'M78',
    ngc: 'NGC 2068',
    type: 'reflection-nebula',
    galacticPos: { x: 8.34, y: -0.09, z: -0.17 },
    radius: 0.002,
    shape: 'irregular',
    colorPrimary: [0.35, 0.5, 0.9],       // Blue reflection
    colorSecondary: [0.2, 0.3, 0.6],      // Deeper blue dust
    colorMix: 0.3,
    noiseOctaves: 4,
    noiseScale: 2.5,
    domainWarpStrength: 0.5,
    asymmetry: 0.4,
    darkLanes: true,
    darkLaneStrength: 0.4,
    embeddedStars: {
      count: 2,
      brightestColor: [0.7, 0.8, 1.0],
      concentration: 0.8,
    },
    layers: 3,
    brightnessProfile: 'center-bright',
    integratedMagnitude: 8.3,
    hasReflectionNebulosity: true,
  },

  // ── M27: Dumbbell Nebula ──────────────────────────────────────────
  // Brightest planetary nebula. Bilobed shape (like an apple core).
  // Real: l=60.8°, b=-3.7°, d=0.42 kpc from Sun
  'M27': {
    name: 'Dumbbell Nebula',
    messier: 'M27',
    ngc: 'NGC 6853',
    type: 'planetary-nebula',
    galacticPos: { x: 7.80, y: -0.00, z: 0.37 },
    radius: 0.0009,
    shape: 'bilobed',
    colorPrimary: [0.2, 0.7, 0.5],        // OIII green-teal
    colorSecondary: [0.8, 0.3, 0.25],     // H-alpha red outer
    colorMix: 0.35,
    noiseOctaves: 4,
    noiseScale: 2.0,
    domainWarpStrength: 0.5,
    asymmetry: 0.5,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 1,
      brightestColor: [0.8, 0.85, 1.0],
      concentration: 1.0,
    },
    layers: 4,
    brightnessProfile: 'center-bright',
    integratedMagnitude: 7.5,
    centralStar: {
      color: [0.8, 0.85, 1.0],
      luminosity: 0.7,
    },
  },

  // ── NGC 7293: Helix Nebula ────────────────────────────────────────
  // Closest large planetary nebula. "Eye of God" appearance.
  // Real: l=36.2°, b=-57.2°, d=0.22 kpc from Sun
  'NGC7293': {
    name: 'Helix Nebula',
    messier: null,
    ngc: 'NGC 7293',
    type: 'planetary-nebula',
    galacticPos: { x: 7.90, y: -0.16, z: 0.07 },
    radius: 0.0014,
    shape: 'ring',
    colorPrimary: [0.25, 0.7, 0.55],      // OIII teal inner ring
    colorSecondary: [0.85, 0.25, 0.2],    // H-alpha red outer
    colorMix: 0.4,
    noiseOctaves: 3,
    noiseScale: 2.0,
    domainWarpStrength: 0.3,
    asymmetry: 0.15,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 1,
      brightestColor: [0.9, 0.9, 1.0],
      concentration: 1.0,
    },
    layers: 4,
    brightnessProfile: 'ring',
    integratedMagnitude: 7.6,
    centralStar: {
      color: [0.9, 0.9, 1.0],
      luminosity: 0.3,
    },
  },

  // ── NGC 6543: Cat's Eye Nebula ────────────────────────────────────
  // One of the most complex planetary nebulae. Concentric shells and jets.
  // Real: l=96.5°, b=29.9°, d=1.0 kpc from Sun
  'NGC6543': {
    name: "Cat's Eye Nebula",
    messier: null,
    ngc: 'NGC 6543',
    type: 'planetary-nebula',
    galacticPos: { x: 8.10, y: 0.52, z: 0.86 },
    radius: 0.00015,
    shape: 'ring',
    colorPrimary: [0.15, 0.65, 0.6],      // Bright OIII teal
    colorSecondary: [0.7, 0.3, 0.15],     // NII orange-red
    colorMix: 0.3,
    noiseOctaves: 5,
    noiseScale: 3.5,
    domainWarpStrength: 0.8,
    asymmetry: 0.3,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 1,
      brightestColor: [0.7, 0.8, 1.0],
      concentration: 1.0,
    },
    layers: 5,
    brightnessProfile: 'center-bright',
    integratedMagnitude: 8.1,
    centralStar: {
      color: [0.7, 0.8, 1.0],
      luminosity: 0.9,
    },
  },

  // ── M97: Owl Nebula ───────────────────────────────────────────────
  // Round planetary nebula with two dark "eyes" giving it an owl face.
  // Real: l=148.5°, b=57.1°, d=0.62 kpc from Sun
  'M97': {
    name: 'Owl Nebula',
    messier: 'M97',
    ngc: 'NGC 3587',
    type: 'planetary-nebula',
    galacticPos: { x: 8.29, y: 0.55, z: 0.18 },
    radius: 0.0005,
    shape: 'irregular',
    colorPrimary: [0.3, 0.65, 0.5],       // OIII green
    colorSecondary: [0.5, 0.5, 0.55],     // Muted grey-blue
    colorMix: 0.25,
    noiseOctaves: 3,
    noiseScale: 2.0,
    domainWarpStrength: 0.4,
    asymmetry: 0.25,
    darkLanes: true,
    darkLaneStrength: 0.5,
    embeddedStars: {
      count: 1,
      brightestColor: [0.8, 0.85, 1.0],
      concentration: 1.0,
    },
    layers: 3,
    brightnessProfile: 'center-bright',
    integratedMagnitude: 9.9,
    centralStar: {
      color: [0.8, 0.85, 1.0],
      luminosity: 0.4,
    },
  },

  // ── NGC 3132: Southern Ring Nebula ────────────────────────────────
  // Bright planetary nebula with concentric ring structure. JWST famous.
  // Real: l=272.1°, b=10.4°, d=0.61 kpc from Sun
  'NGC3132': {
    name: 'Southern Ring Nebula',
    messier: null,
    ngc: 'NGC 3132',
    type: 'planetary-nebula',
    galacticPos: { x: 7.98, y: 0.14, z: -0.60 },
    radius: 0.0003,
    shape: 'ring',
    colorPrimary: [0.2, 0.6, 0.65],       // OIII teal-blue
    colorSecondary: [0.85, 0.35, 0.2],    // H-alpha red-orange outer
    colorMix: 0.35,
    noiseOctaves: 3,
    noiseScale: 2.2,
    domainWarpStrength: 0.4,
    asymmetry: 0.15,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 2,
      brightestColor: [0.85, 0.9, 1.0],
      concentration: 0.95,
    },
    layers: 4,
    brightnessProfile: 'ring',
    integratedMagnitude: 9.9,
    centralStar: {
      color: [0.85, 0.9, 1.0],
      luminosity: 0.6,
    },
  },

  // ── NGC 6960/6992: Veil Nebula ────────────────────────────────────
  // Large supernova remnant in Cygnus. Wispy, filamentary arcs.
  // Real: l=74.0°, b=-8.6°, d=0.74 kpc from Sun
  'NGC6960': {
    name: 'Veil Nebula',
    messier: null,
    ngc: 'NGC 6960',
    type: 'supernova-remnant',
    galacticPos: { x: 7.80, y: -0.09, z: 0.70 },
    radius: 0.018,
    shape: 'filamentary',
    colorPrimary: [0.2, 0.5, 0.85],       // OIII blue
    colorSecondary: [0.75, 0.25, 0.2],    // H-alpha red filaments
    colorMix: 0.45,
    noiseOctaves: 6,
    noiseScale: 4.5,
    domainWarpStrength: 1.4,
    asymmetry: 0.7,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 0,
      brightestColor: [0.0, 0.0, 0.0],
      concentration: 0,
    },
    layers: 5,
    brightnessProfile: 'ring',
    integratedMagnitude: 7.0,
  },

  // ── Cas A: Cassiopeia A ───────────────────────────────────────────
  // Youngest known supernova remnant in the Milky Way (~1680 AD).
  // Intense radio source. Expanding shell of shock-heated gas.
  // Real: l=111.7°, b=-2.1°, d=3.4 kpc from Sun
  'CasA': {
    name: 'Cassiopeia A',
    messier: null,
    ngc: null,
    type: 'supernova-remnant',
    galacticPos: { x: 9.26, y: -0.10, z: 3.16 },
    radius: 0.0025,
    shape: 'filamentary',
    colorPrimary: [0.9, 0.4, 0.15],       // Hot orange-red shock
    colorSecondary: [0.3, 0.5, 0.9],      // Synchrotron blue
    colorMix: 0.45,
    noiseOctaves: 6,
    noiseScale: 4.0,
    domainWarpStrength: 1.3,
    asymmetry: 0.35,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 0,
      brightestColor: [0.0, 0.0, 0.0],
      concentration: 0,
    },
    layers: 5,
    brightnessProfile: 'ring',
    integratedMagnitude: 6.0,
  },

  // ── M22: Sagittarius Cluster ──────────────────────────────────────
  // One of the nearest and brightest globular clusters. Old, metal-poor stars.
  // Real: l=9.9°, b=-7.6°, d=3.2 kpc from Sun
  'M22': {
    name: 'Sagittarius Cluster',
    messier: 'M22',
    ngc: 'NGC 6656',
    type: 'globular-cluster',
    galacticPos: { x: 4.88, y: -0.40, z: 0.55 },
    radius: 0.016,
    shape: 'spherical',
    colorPrimary: [1.0, 0.85, 0.45],      // Yellow-orange old stars
    colorSecondary: [0.95, 0.75, 0.4],    // Deeper gold core
    colorMix: 0.2,
    noiseOctaves: 0,
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.08,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 100,
      brightestColor: [1.0, 0.9, 0.55],
      concentration: 0.8,
    },
    layers: 0,
    brightnessProfile: 'king-profile',
    integratedMagnitude: 5.1,
  },

  // ── M3 ────────────────────────────────────────────────────────────
  // One of the brightest and best-studied globular clusters.
  // Real: l=42.2°, b=78.7°, d=10.2 kpc from Sun
  'M3': {
    name: 'M3',
    messier: 'M3',
    ngc: 'NGC 5272',
    type: 'globular-cluster',
    galacticPos: { x: 6.52, y: 10.03, z: 1.34 },
    radius: 0.022,
    shape: 'spherical',
    colorPrimary: [1.0, 0.88, 0.5],       // Warm yellow
    colorSecondary: [0.9, 0.7, 0.35],     // Orange-gold core
    colorMix: 0.2,
    noiseOctaves: 0,
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.05,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 130,
      brightestColor: [1.0, 0.85, 0.5],
      concentration: 0.85,
    },
    layers: 0,
    brightnessProfile: 'king-profile',
    integratedMagnitude: 6.2,
  },

  // ── M5 ────────────────────────────────────────────────────────────
  // Ancient globular cluster (~13 Gyr). One of the oldest known.
  // Real: l=3.9°, b=46.8°, d=7.5 kpc from Sun
  'M5': {
    name: 'M5',
    messier: 'M5',
    ngc: 'NGC 5904',
    type: 'globular-cluster',
    galacticPos: { x: 2.88, y: 5.49, z: 0.35 },
    radius: 0.020,
    shape: 'spherical',
    colorPrimary: [1.0, 0.8, 0.45],       // Yellow-gold old pop
    colorSecondary: [0.95, 0.7, 0.35],    // Deep gold
    colorMix: 0.15,
    noiseOctaves: 0,
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.06,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 110,
      brightestColor: [1.0, 0.85, 0.55],
      concentration: 0.88,
    },
    layers: 0,
    brightnessProfile: 'king-profile',
    integratedMagnitude: 5.7,
  },

  // ── M15: Great Pegasus Cluster ────────────────────────────────────
  // Very dense core, possibly containing a black hole. Old, metal-poor.
  // Real: l=65.0°, b=-27.3°, d=10.4 kpc from Sun
  'M15': {
    name: 'Great Pegasus Cluster',
    messier: 'M15',
    ngc: 'NGC 7078',
    type: 'globular-cluster',
    galacticPos: { x: 4.09, y: -4.74, z: 8.38 },
    radius: 0.022,
    shape: 'spherical',
    colorPrimary: [0.95, 0.85, 0.55],     // Yellow-white
    colorSecondary: [1.0, 0.75, 0.4],     // Warm orange core
    colorMix: 0.2,
    noiseOctaves: 0,
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.04,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 140,
      brightestColor: [1.0, 0.88, 0.55],
      concentration: 0.92,
    },
    layers: 0,
    brightnessProfile: 'king-profile',
    integratedMagnitude: 6.2,
  },

  // ── M4 ────────────────────────────────────────────────────────────
  // Closest globular cluster to Earth. Loose, easy to resolve stars.
  // Real: l=351.0°, b=15.97°, d=1.8 kpc from Sun
  'M4': {
    name: 'M4',
    messier: 'M4',
    ngc: 'NGC 6121',
    type: 'globular-cluster',
    galacticPos: { x: 6.29, y: 0.52, z: -0.27 },
    radius: 0.010,
    shape: 'spherical',
    colorPrimary: [1.0, 0.9, 0.55],       // Yellow old stars
    colorSecondary: [0.9, 0.75, 0.45],    // Orange core
    colorMix: 0.2,
    noiseOctaves: 0,
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.1,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 70,
      brightestColor: [1.0, 0.9, 0.6],
      concentration: 0.7,
    },
    layers: 0,
    brightnessProfile: 'king-profile',
    integratedMagnitude: 5.6,
  },

  // ── M92 ───────────────────────────────────────────────────────────
  // Second-brightest globular in Hercules. Very old (~14.2 Gyr).
  // Real: l=68.3°, b=34.9°, d=8.3 kpc from Sun
  'M92': {
    name: 'M92',
    messier: 'M92',
    ngc: 'NGC 6341',
    type: 'globular-cluster',
    galacticPos: { x: 5.48, y: 4.77, z: 6.32 },
    radius: 0.017,
    shape: 'spherical',
    colorPrimary: [0.95, 0.85, 0.55],     // Warm yellow
    colorSecondary: [0.85, 0.7, 0.4],     // Orange
    colorMix: 0.2,
    noiseOctaves: 0,
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.04,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 110,
      brightestColor: [1.0, 0.85, 0.5],
      concentration: 0.9,
    },
    layers: 0,
    brightnessProfile: 'king-profile',
    integratedMagnitude: 6.4,
  },

  // ── NGC 104: 47 Tucanae ───────────────────────────────────────────
  // Second-brightest globular cluster in the sky. Dense, bright core.
  // Real: l=305.9°, b=-44.9°, d=4.5 kpc from Sun
  'NGC104': {
    name: '47 Tucanae',
    messier: null,
    ngc: 'NGC 104',
    type: 'globular-cluster',
    galacticPos: { x: 6.13, y: -3.15, z: -2.58 },
    radius: 0.024,
    shape: 'spherical',
    colorPrimary: [1.0, 0.85, 0.5],       // Warm yellow
    colorSecondary: [1.0, 0.75, 0.4],     // Orange-gold
    colorMix: 0.2,
    noiseOctaves: 0,
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.05,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 150,
      brightestColor: [1.0, 0.9, 0.55],
      concentration: 0.9,
    },
    layers: 0,
    brightnessProfile: 'king-profile',
    integratedMagnitude: 4.1,
  },

  // ── NGC 5139: Omega Centauri ──────────────────────────────────────
  // Largest and brightest globular cluster in the Milky Way.
  // ~10 million stars. May be the remnant core of a dwarf galaxy.
  // Real: l=309.1°, b=14.97°, d=5.43 kpc from Sun
  'NGC5139': {
    name: 'Omega Centauri',
    messier: null,
    ngc: 'NGC 5139',
    type: 'globular-cluster',
    galacticPos: { x: 4.69, y: 1.43, z: -4.07 },
    radius: 0.043,
    shape: 'spherical',
    colorPrimary: [1.0, 0.88, 0.5],       // Mixed population yellow
    colorSecondary: [0.85, 0.7, 0.4],     // Orange sub-giants
    colorMix: 0.25,
    noiseOctaves: 0,
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.08,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 200,
      brightestColor: [1.0, 0.9, 0.55],
      concentration: 0.75,
    },
    layers: 0,
    brightnessProfile: 'king-profile',
    integratedMagnitude: 3.7,
  },

  // ── M11: Wild Duck Cluster ────────────────────────────────────────
  // One of the richest and most compact open clusters. ~2900 stars.
  // Real: l=27.3°, b=-2.8°, d=1.88 kpc from Sun
  'M11': {
    name: 'Wild Duck Cluster',
    messier: 'M11',
    ngc: 'NGC 6705',
    type: 'open-cluster',
    galacticPos: { x: 6.33, y: -0.07, z: 0.86 },
    radius: 0.005,
    shape: 'irregular',
    colorPrimary: [0.95, 0.9, 0.7],       // White-yellow (mixed ages)
    colorSecondary: [1.0, 0.8, 0.45],     // Yellow evolved members
    colorMix: 0.3,
    noiseOctaves: 0,
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.15,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 50,
      brightestColor: [0.95, 0.9, 0.7],
      concentration: 0.6,
    },
    layers: 0,
    brightnessProfile: 'king-profile',
    integratedMagnitude: 5.8,
  },

  // ── M44: Beehive Cluster (Praesepe) ───────────────────────────────
  // Large, nearby open cluster visible to naked eye. Scattered stars.
  // Real: l=205.9°, b=32.5°, d=0.187 kpc from Sun
  'M44': {
    name: 'Beehive Cluster',
    messier: 'M44',
    ngc: 'NGC 2632',
    type: 'open-cluster',
    galacticPos: { x: 8.14, y: 0.13, z: -0.07 },
    radius: 0.004,
    shape: 'irregular',
    colorPrimary: [0.95, 0.9, 0.75],      // White-yellow
    colorSecondary: [1.0, 0.85, 0.5],     // Yellow giants
    colorMix: 0.2,
    noiseOctaves: 0,
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.35,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 30,
      brightestColor: [1.0, 0.9, 0.7],
      concentration: 0.35,
    },
    layers: 0,
    brightnessProfile: 'scattered',
    integratedMagnitude: 3.7,
  },

  // ── NGC 869: Double Cluster (h Persei) ────────────────────────────
  // Half of the famous Double Cluster with NGC 884. Young, rich cluster.
  // Real: l=134.6°, b=-3.7°, d=2.3 kpc from Sun
  'NGC869': {
    name: 'Double Cluster (h Per)',
    messier: null,
    ngc: 'NGC 869',
    type: 'open-cluster',
    galacticPos: { x: 9.61, y: -0.12, z: 1.63 },
    radius: 0.008,
    shape: 'irregular',
    colorPrimary: [0.6, 0.7, 1.0],        // Blue-white young stars
    colorSecondary: [0.9, 0.5, 0.3],      // Red supergiant members
    colorMix: 0.15,
    noiseOctaves: 0,
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.2,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 45,
      brightestColor: [0.65, 0.75, 1.0],
      concentration: 0.55,
    },
    layers: 0,
    brightnessProfile: 'king-profile',
    integratedMagnitude: 4.3,
  },

  // ── M35 ───────────────────────────────────────────────────────────
  // Rich open cluster in Gemini. Easy naked-eye target.
  // Real: l=186.6°, b=2.2°, d=0.85 kpc from Sun
  'M35': {
    name: 'M35',
    messier: 'M35',
    ngc: 'NGC 2168',
    type: 'open-cluster',
    galacticPos: { x: 8.84, y: 0.06, z: -0.10 },
    radius: 0.005,
    shape: 'irregular',
    colorPrimary: [0.8, 0.85, 1.0],       // Blue-white young
    colorSecondary: [1.0, 0.9, 0.6],      // Yellow evolved
    colorMix: 0.25,
    noiseOctaves: 0,
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.3,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 35,
      brightestColor: [0.8, 0.85, 1.0],
      concentration: 0.5,
    },
    layers: 0,
    brightnessProfile: 'scattered',
    integratedMagnitude: 5.1,
  },

  // ── M7: Ptolemy's Cluster ─────────────────────────────────────────
  // One of the most prominent open clusters in Scorpius. Known since antiquity.
  // Real: l=355.8°, b=-4.5°, d=0.3 kpc from Sun
  'M7': {
    name: "Ptolemy's Cluster",
    messier: 'M7',
    ngc: 'NGC 6475',
    type: 'open-cluster',
    galacticPos: { x: 7.70, y: 0.00, z: -0.02 },
    radius: 0.004,
    shape: 'irregular',
    colorPrimary: [0.85, 0.85, 0.95],     // White-blue
    colorSecondary: [1.0, 0.85, 0.5],     // Yellow sub-giants
    colorMix: 0.2,
    noiseOctaves: 0,
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.35,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 25,
      brightestColor: [0.9, 0.9, 1.0],
      concentration: 0.4,
    },
    layers: 0,
    brightnessProfile: 'scattered',
    integratedMagnitude: 3.3,
  },

  // ── IC 2602: Southern Pleiades ────────────────────────────────────
  // Bright open cluster around Theta Carinae. Very young (~30 Myr).
  // Real: l=289.6°, b=-4.9°, d=0.149 kpc from Sun
  'IC2602': {
    name: 'Southern Pleiades',
    messier: null,
    ngc: null,
    type: 'open-cluster',
    galacticPos: { x: 7.95, y: 0.01, z: -0.14 },
    radius: 0.003,
    shape: 'irregular',
    colorPrimary: [0.6, 0.7, 1.0],        // Hot blue-white
    colorSecondary: [0.5, 0.6, 0.95],     // Blue
    colorMix: 0.2,
    noiseOctaves: 0,
    noiseScale: 0,
    domainWarpStrength: 0,
    asymmetry: 0.4,
    darkLanes: false,
    darkLaneStrength: 0,
    embeddedStars: {
      count: 20,
      brightestColor: [0.55, 0.65, 1.0],
      concentration: 0.35,
    },
    layers: 0,
    brightnessProfile: 'scattered',
    integratedMagnitude: 1.9,
  },

  // ── NGC 2264: Christmas Tree Cluster ──────────────────────────────
  // Young open cluster + Cone Nebula region. Active star formation.
  // Real: l=202.9°, b=2.2°, d=0.76 kpc from Sun
  'NGC2264': {
    name: 'Christmas Tree Cluster',
    messier: null,
    ngc: 'NGC 2264',
    type: 'open-cluster',
    galacticPos: { x: 8.70, y: 0.05, z: -0.30 },
    radius: 0.004,
    shape: 'irregular',
    colorPrimary: [0.7, 0.8, 1.0],        // Blue-white young stars
    colorSecondary: [0.85, 0.3, 0.2],     // H-alpha from surrounding nebula
    colorMix: 0.2,
    noiseOctaves: 2,
    noiseScale: 1.5,
    domainWarpStrength: 0.3,
    asymmetry: 0.5,
    darkLanes: true,
    darkLaneStrength: 0.3,
    embeddedStars: {
      count: 25,
      brightestColor: [0.65, 0.75, 1.0],
      concentration: 0.45,
    },
    layers: 2,
    brightnessProfile: 'scattered',
    integratedMagnitude: 3.9,
  },
};

/**
 * Search known objects by name, Messier number, or NGC number.
 * Returns an array of { key, profile } matches.
 *
 * @param {string} query — search string (case-insensitive, partial match)
 * @returns {Array<{ key: string, profile: object }>}
 */
export function searchKnownObjects(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results = [];
  for (const [key, profile] of Object.entries(KNOWN_OBJECT_PROFILES)) {
    const fields = [
      key.toLowerCase(),
      profile.name?.toLowerCase(),
      profile.messier?.toLowerCase(),
      profile.ngc?.toLowerCase(),
    ].filter(Boolean);

    if (fields.some(f => f.includes(q))) {
      results.push({ key, profile });
    }
  }
  return results;
}
