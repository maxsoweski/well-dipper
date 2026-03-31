/**
 * KnownBodyProfiles — texture and parameter overrides for recognizable bodies.
 *
 * Each profile can specify:
 *   - textures: { diffuse, heightmap } paths (loaded async at LOD 2)
 *   - colorOverrides: { baseColor, accentColor } (applied at LOD 1+)
 *   - shaderParams: additional shader tweaks
 *
 * Profiles are matched by a `profileId` field on moon/planet data.
 * For the Solar System (Shift+0), SolarSystemData attaches these IDs.
 * For procedural systems, no profiles are used (pure procedural).
 *
 * Texture paths are relative to the public/ directory (Vite serves them).
 * Textures should be equirectangular projection, power-of-2 dimensions.
 *
 * Phase 1: Earth's Moon (test case for high-LOD textured rendering)
 */

export const KNOWN_BODY_PROFILES = {

  // ── Earth's Moon ──────────────────────────────────────────────────
  'sol-moon': {
    name: 'The Moon',
    textures: {
      diffuse: 'assets/textures/bodies/moon_diffuse.jpg',
      heightmap: 'assets/textures/bodies/moon_heightmap.jpg',
    },
    // Heightmap → normal perturbation strength
    heightScale: 0.04,
    // Override posterization levels for textured mode
    // (fewer levels = more retro, more levels = more detail visible)
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,

    // LOD1 overrides — derived from sampling the NASA textures above.
    // These replace the procedural shader's default colors so LOD1 (orbital)
    // approximates what LOD2 (textured) looks like, reducing the pop on transition.
    // Values computed via LODColorExtractor.extract() and baked here.
    lod1Overrides: {
      // Highlands average (bright anorthosite — the light areas of the Moon)
      baseColor: [0.58, 0.55, 0.50],
      // Maria average (dark basaltic plains — the dark "seas")
      accentColor: [0.35, 0.33, 0.30],
      // Noise frequency from heightmap gradient analysis
      noiseScale: 4.2,
    },
  },

  // ── Mercury ──────────────────────────────────────────────────
  'sol-mercury': {
    name: 'Mercury',
    textures: {
      diffuse: 'assets/textures/bodies/mercury_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
  },

  // ── Venus (surface beneath clouds) ────────────────────────
  'sol-venus': {
    name: 'Venus',
    textures: {
      diffuse: 'assets/textures/bodies/venus_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
    cloudStyle: 3, // thick Venus clouds
  },

  // ── Earth ──────────────────────────────────────────────────
  'sol-earth': {
    name: 'Earth',
    textures: {
      diffuse: 'assets/textures/bodies/earth_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
    cloudStyle: 1, // terrestrial weather system
  },

  // ── Mars ───────────────────────────────────────────────────
  'sol-mars': {
    name: 'Mars',
    textures: {
      diffuse: 'assets/textures/bodies/mars_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
    cloudStyle: 2, // dust storms
  },

  // ── Jupiter ────────────────────────────────────────────────
  'sol-jupiter': {
    name: 'Jupiter',
    textures: {
      diffuse: 'assets/textures/bodies/jupiter_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
  },

  // ── Saturn ─────────────────────────────────────────────────
  'sol-saturn': {
    name: 'Saturn',
    textures: {
      diffuse: 'assets/textures/bodies/saturn_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
  },

  // ── Uranus ─────────────────────────────────────────────────
  'sol-uranus': {
    name: 'Uranus',
    textures: {
      diffuse: 'assets/textures/bodies/uranus_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
  },

  // ── Neptune ────────────────────────────────────────────────
  'sol-neptune': {
    name: 'Neptune',
    textures: {
      diffuse: 'assets/textures/bodies/neptune_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
  },

  // ── Pluto ──────────────────────────────────────────────────
  'sol-pluto': {
    name: 'Pluto',
    textures: {
      diffuse: 'assets/textures/bodies/pluto_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
  },

  // ── Io (volcanic, Jupiter moon) ────────────────────────────
  'sol-io': {
    name: 'Io',
    textures: {
      diffuse: 'assets/textures/bodies/io_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
  },

  // ── Europa (icy, Jupiter moon) ─────────────────────────────
  'sol-europa': {
    name: 'Europa',
    textures: {
      diffuse: 'assets/textures/bodies/europa_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
  },

  // ── Ganymede (largest moon, Jupiter) ───────────────────────
  'sol-ganymede': {
    name: 'Ganymede',
    textures: {
      diffuse: 'assets/textures/bodies/ganymede_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
  },

  // ── Callisto (cratered, Jupiter moon) ──────────────────────
  'sol-callisto': {
    name: 'Callisto',
    textures: {
      diffuse: 'assets/textures/bodies/callisto_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
  },

  // ── Titan (thick atmosphere, Saturn moon) ──────────────────
  'sol-titan': {
    name: 'Titan',
    textures: {
      diffuse: 'assets/textures/bodies/titan_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
  },

  // ── Triton (retrograde, Neptune moon) ──────────────────────
  'sol-triton': {
    name: 'Triton',
    textures: {
      diffuse: 'assets/textures/bodies/triton_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
  },

  // ── Charon (Pluto's binary companion) ──────────────────────
  'sol-charon': {
    name: 'Charon',
    textures: {
      diffuse: 'assets/textures/bodies/charon_diffuse.jpg',
    },
    heightScale: 0.0,
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
  },
};
