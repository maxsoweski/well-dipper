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
