// planet-feature-associations.js
// Captures, per feature, the associations that otherwise live only in shader
// call-order + prose. Keyed by the SAME feature keys as FEATURES (planet-archetypes.js).

export const DOMAINS = [
  'relief', 'fluvial', 'cryo', 'aeolian', 'gradational',
  'bands', 'storms', 'clouds', 'thermal', 'optical', 'dust',
  'exotic', 'overlay',
];

// Named co-location groups. Each maps to a {field, polarity} tuple that mirrors
// the PROVINCES affinities in planet-archetypes.js — features sharing a tuple
// physically cluster on the planet surface. 'global' = unprovinced (floor 1.0):
// atmosphere/optics/overlays, no geologic gating.
export const PROVINCE_GROUPS = {
  'tectonic-highlands': { field: 0, polarity:  1 },
  'old-plains':         { field: 0, polarity: -1 },
  'volcanic-provinces': { field: 1, polarity:  1 },
  'anti-volcanic':      { field: 1, polarity: -1 },
  'ancient-high':       { field: 2, polarity:  1 },
  'young-lowlands':     { field: 2, polarity: -1 },
  'global':             null,
};

// ASSOCIATIONS[key] = {
//   domain:        one of DOMAINS
//   provinceGroup: one of Object.keys(PROVINCE_GROUPS)
//   dependsOn:     { drivers: [driverName,...], features: [featureKey,...] }
//   modifies:      [featureKey,...]
//   isolationKit:  [featureKey,...]   // also-enable so this feature renders in-context
//   rendersOn:     [presetName,...]   // DRIVER_PRESETS keys it derives nonzero on
// }
// provinceGroup is DERIVED from the live PROVINCES table (floor>=1.0 => 'global',
// else {field,polarity} -> the matching tuple). rendersOn is the archetype-preset
// union pruned to where the feature ACTUALLY renders (per the per-feature INERT
// comments in planet-archetypes.js); [] + `// TODO audit` where genuinely unclear.
export const ASSOCIATIONS = {
  // ── relief ──
  mountains: {
    domain: 'relief', provinceGroup: 'tectonic-highlands',
    dependsOn: { drivers: ['erosion','tidalHeat'], features: [] },
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  craters: {
    domain: 'relief', provinceGroup: 'old-plains',
    dependsOn: { drivers: ['surfaceGravity','craterDensity'], features: [] },
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Frozen (airless)'],
  },
  ejecta: {
    domain: 'relief', provinceGroup: 'old-plains',
    dependsOn: { drivers: ['craterDensity'], features: [] },
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Frozen (airless)'],
  },
  canyons: {
    domain: 'relief', provinceGroup: 'tectonic-highlands',
    dependsOn: { drivers: ['tidalHeat','erosion'], features: [] },
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  scarps: {
    domain: 'relief', provinceGroup: 'ancient-high',
    dependsOn: { drivers: ['erosion','tidalHeat'], features: [] },
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Frozen (airless)','Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  plateaus: {
    domain: 'relief', provinceGroup: 'ancient-high',
    dependsOn: { drivers: ['tidalHeat','erosion'], features: [] },
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  tessera: {
    domain: 'relief', provinceGroup: 'tectonic-highlands',
    dependsOn: { drivers: ['tidalHeat','erosion'], features: [] },
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  edifices: {
    domain: 'relief', provinceGroup: 'volcanic-provinces',
    dependsOn: { drivers: ['surfaceGravity','tidalHeat'], features: [] },
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Lava (hot airless)','Magma (K2-141b)'],
  },
  lava: {
    domain: 'relief', provinceGroup: 'volcanic-provinces',
    dependsOn: { drivers: ['tidalHeat'], features: [] },
    modifies: [], isolationKit: [],
    rendersOn: ['Lava (hot airless)','Magma (K2-141b)'],
  },
  chaos: {
    domain: 'relief', provinceGroup: 'volcanic-provinces',
    dependsOn: { drivers: ['surfaceGravity','tidalHeat'], features: [] },
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Europa (icy moon)'],
  },
  cryoRidge: {
    domain: 'relief', provinceGroup: 'anti-volcanic',
    dependsOn: { drivers: ['tidalHeat'], features: [] },
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Europa (icy moon)'],
  },

  // ── cryo ──
  frost: {
    domain: 'cryo', provinceGroup: 'global',
    dependsOn: { drivers: ['volatileSpecies','frostMaxCoverage','tempEq'], features: [] },
    modifies: [], isolationKit: [],
    rendersOn: ['Titan (methane seas)','Frozen (airless)'],
  },
  sublimation: {
    domain: 'cryo', provinceGroup: 'ancient-high',
    dependsOn: { drivers: ['volatileSpecies','frostMaxCoverage'], features: [] },
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Titan (methane seas)','Frozen (airless)'],
  },
  glacial: {
    domain: 'cryo', provinceGroup: 'young-lowlands',
    dependsOn: { drivers: ['surfaceGravity','frostMaxCoverage','tempEq'], features: [] },
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Titan (methane seas)','Frozen (airless)'],
  },

  // ── fluvial ──
  rivers: {
    domain: 'fluvial', provinceGroup: 'young-lowlands',
    dependsOn: { drivers: ['liquidStability','precipitation'], features: [] },
    modifies: ['massWasting','deltas'], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  lakes: {
    domain: 'fluvial', provinceGroup: 'global',
    dependsOn: { drivers: ['liquidStability'], features: ['rivers'] },
    modifies: ['coastlines','frost','dust','deltas'], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  deltas: {
    domain: 'fluvial', provinceGroup: 'young-lowlands',
    dependsOn: { drivers: ['liquidStability','precipitation'], features: ['rivers'] },
    modifies: [], isolationKit: ['rivers','lakes'],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  outflow: {
    domain: 'fluvial', provinceGroup: 'young-lowlands',
    dependsOn: { drivers: ['liquidStability'], features: [] },
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  karst: {
    domain: 'fluvial', provinceGroup: 'volcanic-provinces',
    dependsOn: { drivers: ['liquidStability'], features: [] },
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },

  // ── gradational ──
  coastlines: {
    domain: 'gradational', provinceGroup: 'global',
    dependsOn: { drivers: ['liquidStability'], features: ['lakes'] },
    modifies: [], isolationKit: ['lakes'],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  massWasting: {
    domain: 'gradational', provinceGroup: 'tectonic-highlands',
    dependsOn: { drivers: ['surfaceGravity'], features: ['mountains','canyons','scarps','plateaus','tessera','edifices','chaos','craters'] },
    modifies: [], isolationKit: ['mountains','canyons'],
    rendersOn: ['Frozen (airless)','Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Lava (hot airless)','Magma (K2-141b)','Europa (icy moon)','Titan (methane seas)'],
  },

  // ── aeolian ──
  dunes: {
    domain: 'aeolian', provinceGroup: 'old-plains',
    dependsOn: { drivers: ['surfaceGravity','liquidStability'], features: [] },
    modifies: [], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  dust: {
    domain: 'aeolian', provinceGroup: 'old-plains',
    dependsOn: { drivers: ['liquidStability'], features: [] },
    modifies: [], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },

  // ── bands ──
  bands: {
    domain: 'bands', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (atmosphere-dynamics drivers live in applyDrivers, not yet itemized)
    modifies: ['jets','greatSpot','stormTrain','polarVortex'], isolationKit: [],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  jets: {
    domain: 'bands', provinceGroup: 'global',
    dependsOn: { drivers: [], features: ['bands'] },  // TODO drivers (atmosphere-dynamics drivers live in applyDrivers, not yet itemized)
    modifies: [], isolationKit: ['bands'],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  weatherBands: {
    domain: 'bands', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (atmosphere-dynamics drivers live in applyDrivers, not yet itemized)
    modifies: [], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },

  // ── storms ──
  greatSpot: {
    domain: 'storms', provinceGroup: 'global',
    dependsOn: { drivers: [], features: ['bands'] },  // TODO drivers (atmosphere-dynamics drivers live in applyDrivers, not yet itemized)
    modifies: [], isolationKit: ['bands'],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  stormTrain: {
    domain: 'storms', provinceGroup: 'global',
    dependsOn: { drivers: [], features: ['bands'] },  // TODO drivers (atmosphere-dynamics drivers live in applyDrivers, not yet itemized)
    modifies: [], isolationKit: ['bands'],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  polarVortex: {
    domain: 'storms', provinceGroup: 'global',
    dependsOn: { drivers: [], features: ['bands'] },  // TODO drivers (atmosphere-dynamics drivers live in applyDrivers, not yet itemized)
    modifies: [], isolationKit: ['bands'],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  lightning: {
    domain: 'storms', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (atmosphere-dynamics drivers live in applyDrivers, not yet itemized)
    modifies: [], isolationKit: [],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Hot Jupiter (locked giant)'],
  },

  // ── clouds ──
  clouds: {
    domain: 'clouds', provinceGroup: 'global',
    dependsOn: { drivers: ['cloudCoverage'], features: [] },
    modifies: [], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)','Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },

  // ── thermal ──
  daysideThermal: {
    domain: 'thermal', provinceGroup: 'global',
    dependsOn: { drivers: ['tempEq'], features: [] },
    modifies: [], isolationKit: [],
    rendersOn: ['Hot Jupiter (locked giant)'],
  },
  nightsideThermal: {
    domain: 'thermal', provinceGroup: 'global',
    dependsOn: { drivers: ['tempEq'], features: [] },
    modifies: [], isolationKit: [],
    rendersOn: ['Hot Jupiter (locked giant)'],
  },

  // ── optical ──
  limb: {
    domain: 'optical', provinceGroup: 'global',
    dependsOn: { drivers: ['limbStrength'], features: [] },
    modifies: [], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  terminator: {
    domain: 'optical', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (atmosphere terminator gradient)
    modifies: [], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  sunglint: {
    domain: 'optical', provinceGroup: 'global',
    dependsOn: { drivers: ['specStrength','liquidStability'], features: [] },
    modifies: [], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)'],
  },
  aurora: {
    domain: 'optical', provinceGroup: 'global',
    dependsOn: { drivers: ['magneticField'], features: [] },
    modifies: [], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },

  // ── dust ──
  dustStorm: {
    domain: 'dust', provinceGroup: 'global',
    dependsOn: { drivers: ['liquidStability'], features: [] },
    modifies: [], isolationKit: [],
    rendersOn: ['Mars (arid rocky)'],
  },

  // ── exotic ──
  magma: {
    domain: 'exotic', provinceGroup: 'global',
    dependsOn: { drivers: ['tempEq'], features: [] },
    modifies: [], isolationKit: [],
    rendersOn: ['Magma (K2-141b)','Lava (hot airless)'],
  },
  carbon: {
    domain: 'exotic', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (exotic mineralogy driver lives in applyDrivers, not yet itemized)
    modifies: [], isolationKit: [],
    rendersOn: ['Carbon (high C/O)'],
  },
  facets: {
    domain: 'exotic', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (pure enable gate — no driver class)
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Crystal (faceted)'],
  },
  hexTess: {
    domain: 'exotic', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (pure enable gate — no driver class)
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Frozen (airless)'],
  },
  shatter: {
    domain: 'exotic', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (pure enable gate — no driver class)
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Frozen (airless)'],
  },

  // ── overlay ──
  bioMats: {
    domain: 'overlay', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (overlay coverage knob — no driver derivation)
    modifies: [], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  machine: {
    domain: 'overlay', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (overlay coverage knob — no driver derivation)
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)'],
  },
  cityLights: {
    domain: 'overlay', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (overlay maturity knob — no driver derivation)
    modifies: [], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  ecumenopolis: {
    domain: 'overlay', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (overlay coverage knob — no driver derivation)
    modifies: ['massWasting'], isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
};
