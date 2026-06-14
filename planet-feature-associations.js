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

// Inverts a {field,polarity} affinity back to its group name. Defaults to
// 'global' when no provinced tuple matches (i.e. unprovinced features).
export function provinceGroupOf(field, polarity) {
  for (const [name, t] of Object.entries(PROVINCE_GROUPS)) {
    if (t && t.field === field && t.polarity === polarity) return name;
  }
  return 'global';
}

// ASSOCIATIONS[key] = {
//   domain:        one of DOMAINS
//   provinceGroup: one of Object.keys(PROVINCE_GROUPS)
//   dependsOn:     { drivers: [driverName,...], features: [featureKey,...] }
//   isolationKit:  [featureKey,...]   // also-enable so this feature renders in-context
//   rendersOn:     [presetName,...]   // DRIVER_PRESETS keys it derives nonzero on
//   rendersOnDivergent?: true         // rendersOn deliberately leaves the feature's
//                                     // archetype-preset union (e.g. hexTess)
//   modifies:      [featureKey,...]   // DERIVED at module load — DO NOT hand-author
// }
// provinceGroup is DERIVED from the live PROVINCES table (floor>=1.0 => 'global',
// else {field,polarity} -> the matching tuple). rendersOn is the archetype-preset
// union pruned to where the feature ACTUALLY renders (per the per-feature INERT
// comments in planet-archetypes.js); [] + `// TODO audit` where genuinely unclear.
// modifies is the INVERSE of dependsOn.features, computed below — dependsOn.features
// is the single source of truth for the shader-coupling relation (audit Decision 1).
export const ASSOCIATIONS = {
  // ── relief ──
  mountains: {
    domain: 'relief', provinceGroup: 'tectonic-highlands',
    dependsOn: { drivers: ['erosion','tidalHeat'], features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  craters: {
    domain: 'relief', provinceGroup: 'old-plains',
    dependsOn: { drivers: ['surfaceGravity','craterDensity'], features: [] },
    isolationKit: [],
    rendersOn: ['Frozen (airless)'],
  },
  ejecta: {
    domain: 'relief', provinceGroup: 'old-plains',
    dependsOn: { drivers: ['craterDensity'], features: [] },
    isolationKit: [],
    rendersOn: ['Frozen (airless)'],
  },
  canyons: {
    domain: 'relief', provinceGroup: 'tectonic-highlands',
    dependsOn: { drivers: ['tidalHeat','erosion'], features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  scarps: {
    domain: 'relief', provinceGroup: 'ancient-high',
    dependsOn: { drivers: ['erosion','tidalHeat'], features: [] },
    isolationKit: [],
    rendersOn: ['Frozen (airless)','Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  plateaus: {
    domain: 'relief', provinceGroup: 'ancient-high',
    dependsOn: { drivers: ['tidalHeat','erosion'], features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  tessera: {
    domain: 'relief', provinceGroup: 'tectonic-highlands',
    dependsOn: { drivers: ['tidalHeat','erosion'], features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  edifices: {
    domain: 'relief', provinceGroup: 'volcanic-provinces',
    dependsOn: { drivers: ['surfaceGravity','tidalHeat'], features: [] },
    isolationKit: [],
    rendersOn: ['Lava (hot airless)','Magma (K2-141b)'],
  },
  lava: {
    domain: 'relief', provinceGroup: 'volcanic-provinces',
    dependsOn: { drivers: ['tidalHeat'], features: [] },
    isolationKit: [],
    rendersOn: ['Lava (hot airless)','Magma (K2-141b)'],
  },
  chaos: {
    domain: 'relief', provinceGroup: 'volcanic-provinces',
    dependsOn: { drivers: ['surfaceGravity','tidalHeat'], features: [] },
    isolationKit: [],
    rendersOn: ['Europa (icy moon)'],
  },
  cryoRidge: {
    domain: 'relief', provinceGroup: 'anti-volcanic',
    dependsOn: { drivers: ['tidalHeat'], features: [] },
    isolationKit: [],
    rendersOn: ['Europa (icy moon)'],
  },

  // ── cryo ──
  frost: {
    domain: 'cryo', provinceGroup: 'global',
    dependsOn: { drivers: ['volatileSpecies','frostMaxCoverage','tempEq'], features: ['lakes'] },  // reads (1−liquidMask): no frost on open sea (shader L3212)
    isolationKit: [],
    rendersOn: ['Titan (methane seas)','Frozen (airless)'],
  },
  sublimation: {
    domain: 'cryo', provinceGroup: 'ancient-high',
    dependsOn: { drivers: ['volatileSpecies','frostMaxCoverage'], features: [] },
    isolationKit: [],
    rendersOn: ['Titan (methane seas)','Frozen (airless)'],
  },
  glacial: {
    domain: 'cryo', provinceGroup: 'young-lowlands',
    dependsOn: { drivers: ['surfaceGravity','frostMaxCoverage','tempEq'], features: [] },
    isolationKit: [],
    rendersOn: ['Titan (methane seas)','Frozen (airless)'],
  },

  // ── fluvial ──
  rivers: {
    domain: 'fluvial', provinceGroup: 'young-lowlands',
    dependsOn: { drivers: ['liquidStability','precipitation'], features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  lakes: {
    domain: 'fluvial', provinceGroup: 'global',
    // level-set cut on h at uSeaLevel (shader L3160-61) — floods wherever h<sea,
    // independent of rivers. No feature dep (the prior rivers edge was spurious).
    dependsOn: { drivers: ['liquidStability'], features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  deltas: {
    domain: 'fluvial', provinceGroup: 'young-lowlands',
    dependsOn: { drivers: ['liquidStability','precipitation'], features: ['rivers'] },
    isolationKit: ['rivers','lakes'],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  outflow: {
    domain: 'fluvial', provinceGroup: 'young-lowlands',
    dependsOn: { drivers: ['liquidStability'], features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  karst: {
    domain: 'fluvial', provinceGroup: 'volcanic-provinces',
    dependsOn: { drivers: ['liquidStability'], features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },

  // ── gradational ──
  coastlines: {
    domain: 'gradational', provinceGroup: 'global',
    dependsOn: { drivers: ['liquidStability'], features: ['lakes'] },
    isolationKit: ['lakes'],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  massWasting: {
    domain: 'gradational', provinceGroup: 'tectonic-highlands',
    // F19 reads gradIn − gradBase: EVERY combiner above the massWastCombiner line
    // (planet-lod-lab.html L3117–3136) feeds it — all 20 grad-writers, in call order.
    dependsOn: { drivers: ['surfaceGravity'], features: ['mountains','craters','ejecta','canyons','rivers','outflow','karst','scarps','plateaus','tessera','edifices','chaos','facets','hexTess','shatter','machine','ecumenopolis','cryoRidge','sublimation','glacial'] },
    isolationKit: ['mountains','canyons'],
    rendersOn: ['Frozen (airless)','Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Lava (hot airless)','Magma (K2-141b)','Europa (icy moon)','Titan (methane seas)'],
  },

  // ── aeolian ──
  dunes: {
    domain: 'aeolian', provinceGroup: 'old-plains',
    dependsOn: { drivers: ['surfaceGravity','liquidStability'], features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  dust: {
    domain: 'aeolian', provinceGroup: 'old-plains',
    dependsOn: { drivers: ['liquidStability'], features: ['lakes'] },  // reads (1−liquidMask): dust can't mantle open sea (shader L3215)
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },

  // ── bands ──
  bands: {
    domain: 'bands', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (atmosphere-dynamics drivers live in applyDrivers, not yet itemized)
    isolationKit: [],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  jets: {
    domain: 'bands', provinceGroup: 'global',
    dependsOn: { drivers: [], features: ['bands'] },  // TODO drivers (atmosphere-dynamics drivers live in applyDrivers, not yet itemized)
    isolationKit: ['bands'],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  weatherBands: {
    domain: 'bands', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (atmosphere-dynamics drivers live in applyDrivers, not yet itemized)
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },

  // ── storms ──
  greatSpot: {
    domain: 'storms', provinceGroup: 'global',
    dependsOn: { drivers: [], features: ['bands'] },  // TODO drivers (atmosphere-dynamics drivers live in applyDrivers, not yet itemized)
    isolationKit: ['bands'],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  stormTrain: {
    domain: 'storms', provinceGroup: 'global',
    dependsOn: { drivers: [], features: ['bands'] },  // TODO drivers (atmosphere-dynamics drivers live in applyDrivers, not yet itemized)
    isolationKit: ['bands'],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  polarVortex: {
    domain: 'storms', provinceGroup: 'global',
    dependsOn: { drivers: [], features: ['bands'] },  // TODO drivers (atmosphere-dynamics drivers live in applyDrivers, not yet itemized)
    isolationKit: ['bands'],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  lightning: {
    domain: 'storms', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (atmosphere-dynamics drivers live in applyDrivers, not yet itemized)
    isolationKit: [],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Hot Jupiter (locked giant)'],
  },

  // ── clouds ──
  clouds: {
    domain: 'clouds', provinceGroup: 'global',
    dependsOn: { drivers: ['cloudCoverage'], features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)','Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },

  // ── thermal ──
  daysideThermal: {
    domain: 'thermal', provinceGroup: 'global',
    dependsOn: { drivers: ['tempEq'], features: [] },
    isolationKit: [],
    rendersOn: ['Hot Jupiter (locked giant)'],
  },
  nightsideThermal: {
    domain: 'thermal', provinceGroup: 'global',
    dependsOn: { drivers: ['tempEq'], features: [] },
    isolationKit: [],
    rendersOn: ['Hot Jupiter (locked giant)'],
  },

  // ── optical ──
  limb: {
    domain: 'optical', provinceGroup: 'global',
    dependsOn: { drivers: ['limbStrength'], features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  terminator: {
    domain: 'optical', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (atmosphere terminator gradient)
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  sunglint: {
    domain: 'optical', provinceGroup: 'global',
    // spec *= liquidMask (shader L3925/3928): renders NOTHING without a live sea.
    // L4938 hard-codes "solo('sunglint') must re-enable lakes" → lakes in the kit.
    dependsOn: { drivers: ['specStrength','liquidStability'], features: ['lakes'] },
    isolationKit: ['lakes'],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)'],
  },
  aurora: {
    domain: 'optical', provinceGroup: 'global',
    dependsOn: { drivers: ['magneticField'], features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },

  // ── dust ──
  dustStorm: {
    domain: 'dust', provinceGroup: 'global',
    dependsOn: { drivers: ['liquidStability'], features: [] },
    isolationKit: [],
    rendersOn: ['Mars (arid rocky)'],
  },

  // ── exotic ──
  magma: {
    domain: 'exotic', provinceGroup: 'global',
    dependsOn: { drivers: ['tempEq'], features: [] },
    isolationKit: [],
    rendersOn: ['Magma (K2-141b)','Lava (hot airless)'],
  },
  carbon: {
    domain: 'exotic', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (exotic mineralogy driver lives in applyDrivers, not yet itemized)
    isolationKit: [],
    rendersOn: ['Carbon (high C/O)'],
  },
  facets: {
    domain: 'exotic', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (pure enable gate — no driver class)
    isolationKit: [],
    rendersOn: ['Crystal (faceted)'],
  },
  hexTess: {
    domain: 'exotic', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (pure enable gate — no driver class)
    isolationKit: [],
    // DIVERGENT: member of exotic-geometric (preset 'Crystal (faceted)') but the
    // shader rides it on Frozen (planet-archetypes.js L112–117), NOT on Crystal.
    rendersOnDivergent: true,
    rendersOn: ['Frozen (airless)'],
  },
  shatter: {
    domain: 'exotic', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (pure enable gate — no driver class)
    isolationKit: [],
    rendersOn: ['Frozen (airless)'],
  },

  // ── overlay ──
  bioMats: {
    domain: 'overlay', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (overlay coverage knob — no driver derivation)
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  machine: {
    domain: 'overlay', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (overlay coverage knob — no driver derivation)
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)'],
  },
  cityLights: {
    domain: 'overlay', provinceGroup: 'global',
    dependsOn: { drivers: [], features: ['lakes'] },  // reads liquidMask for land/coast mask (shader L3696); TODO drivers (overlay maturity knob — no driver derivation)
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  ecumenopolis: {
    domain: 'overlay', provinceGroup: 'global',
    dependsOn: { drivers: [], features: [] },  // TODO drivers (overlay coverage knob — no driver derivation)
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
};

// `modifies` is DERIVED, not hand-authored (audit Decision 1, 2026-06-14): X.modifies =
// every feature whose dependsOn.features lists X. dependsOn.features is the SINGLE source
// of truth for the shader-coupling relation, so the two directions cannot drift. Built in
// place at module load — keys are stable (the orphan/ref tests guarantee every dep is real).
for (const a of Object.values(ASSOCIATIONS)) a.modifies = [];
for (const [key, a] of Object.entries(ASSOCIATIONS)) {
  for (const dep of a.dependsOn.features) ASSOCIATIONS[dep].modifies.push(key);
}
