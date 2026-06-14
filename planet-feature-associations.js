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
// Entries are authored in a later task; the drift-guard test fails until then.
export const ASSOCIATIONS = {};
