// planet-feature-associations.js
// Captures, per feature, the associations that otherwise live only in shader
// call-order + prose. Keyed by the SAME feature keys as FEATURES (planet-archetypes.js).

import { DRIVERS, PROCESSES, driversFor } from './planet-drivers.js';

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
//   processes:     [P#,...]            // the L1 processes that produce this feature
//                                      // (planet-visual-features.md F→"From" column)
//   directDrivers: [driverName,...]?   // L0 drivers read OUTSIDE a process (rare —
//                                      // e.g. carbon ← D10 carbonToOxygen directly)
//   dependsOn:     { drivers: [...], features: [featureKey,...] }
//                                      // drivers is DERIVED (driversFor) — DO NOT hand-author
//   isolationKit:  [featureKey,...]    // also-enable so this feature renders in-context
//   rendersOn:     [presetName,...]    // DRIVER_PRESETS keys it derives nonzero on
//   rendersOnDivergent?: true          // rendersOn deliberately leaves the feature's
//                                      // archetype-preset union (e.g. hexTess)
//   modifies:      [featureKey,...]    // DERIVED at module load — DO NOT hand-author
// }
// provinceGroup is DERIVED from the live PROVINCES table. rendersOn is the archetype-
// preset union pruned to where the feature ACTUALLY renders. modifies is the INVERSE of
// dependsOn.features. dependsOn.drivers is DERIVED from `processes` (+ directDrivers) via
// planet-drivers.js — re-based on the canonical L0 D1–D16 model (2026-06-14), replacing
// the prior hand-listed derived-uniform names (erosion/liquidStability/…) which were L1
// process OUTPUTS, not L0 drivers. So the driver column cannot drift from the model.
export const ASSOCIATIONS = {
  // ── relief ──
  mountains: {
    domain: 'relief', provinceGroup: 'tectonic-highlands',
    processes: ['P2','P3','P4'],   // tectonic + orogeny + effusive volcanism (F1)
    dependsOn: { features: [] },
    isolationKit: [],
    // +Lava 2026-06-15: Io (volcanic) has 17 km silicate thrust mountains (observed). Driver gates icy/exotic crust off.
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Lava (hot airless)'],
  },
  craters: {
    domain: 'relief', provinceGroup: 'old-plains',
    processes: ['P1'],
    dependsOn: { features: [] },
    isolationKit: [],
    // +Mars(prominent)/Rocky/Eyeball(faint) 2026-06-15: declared-only-Frozen was badly wrong (Mars is crater-saturated). Driver scales density by age/resurfacing → faint on eroded worlds, ~0 on Ocean/Venus.
    rendersOn: ['Frozen (airless)','Mars (arid rocky)','Rocky (Earthlike)','Eyeball (locked temperate)'],
  },
  ejecta: {
    domain: 'relief', provinceGroup: 'old-plains',
    processes: ['P1'],
    dependsOn: { features: [] },
    isolationKit: [],
    // mirrors craters (ejecta aprons inseparable from craters)
    rendersOn: ['Frozen (airless)','Mars (arid rocky)','Rocky (Earthlike)','Eyeball (locked temperate)'],
  },
  canyons: {
    domain: 'relief', provinceGroup: 'tectonic-highlands',
    processes: ['P2','P8'],   // tectonic graben + fluvial-incised gorge (F4)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  scarps: {
    domain: 'relief', provinceGroup: 'ancient-high',
    processes: ['P2'],
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Frozen (airless)','Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  plateaus: {
    domain: 'relief', provinceGroup: 'ancient-high',
    processes: ['P2','P15'],   // uplift plateau + crustal-plateau tessera (F6)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  tessera: {
    domain: 'relief', provinceGroup: 'tectonic-highlands',
    processes: ['P2','P15'],   // F6 crosscutting lattice
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  edifices: {
    domain: 'relief', provinceGroup: 'volcanic-provinces',
    processes: ['P4','P5'],   // effusive + explosive volcanism (F7)
    dependsOn: { features: [] },
    isolationKit: [],
    // +Venus 2026-06-15: Venus has constructional edifices (Maat/Sif Mons, coronae) — observed. NOT Europa (silicate; cryo only — driver gates icy crust off).
    rendersOn: ['Lava (hot airless)','Magma (K2-141b)','Venus (sulfuric shroud)'],
  },
  lava: {
    domain: 'relief', provinceGroup: 'volcanic-provinces',
    processes: ['P4'],
    dependsOn: { features: [] },
    isolationKit: [],
    // +Venus 2026-06-15: Venus basaltic plains, active (Sif Mons/Niobe Planitia) — observed. NOT Europa (silicate; cryo only — driver gates icy crust off).
    rendersOn: ['Lava (hot airless)','Magma (K2-141b)','Venus (sulfuric shroud)'],
  },
  chaos: {
    domain: 'relief', provinceGroup: 'volcanic-provinces',
    processes: ['P2','P6','P7'],   // tectonic + tidal-resurfacing + cryovolcanism (F9)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Europa (icy moon)'],
  },
  cryoRidge: {
    domain: 'relief', provinceGroup: 'anti-volcanic',
    processes: ['P2','P7'],   // F10 ridged/grooved icy terrain
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Europa (icy moon)'],
  },

  // ── cryo ──
  frost: {
    domain: 'cryo', provinceGroup: 'global',
    processes: ['P22','P10'],   // seasonal volatile cycling + glacial (F22 polar caps/frost)
    dependsOn: { features: ['lakes'] },  // reads (1−liquidMask): no frost on open sea (shader L3212)
    isolationKit: [],
    // +Europa 2026-06-15: Europa's surface IS water-ice + hydrates (observed) — icier than Titan/Frozen.
    rendersOn: ['Titan (methane seas)','Frozen (airless)','Europa (icy moon)'],
  },
  sublimation: {
    domain: 'cryo', provinceGroup: 'ancient-high',
    processes: ['P11'],
    dependsOn: { features: [] },
    isolationKit: [],
    // +Europa 2026-06-15: equatorial penitentes theorized (Hobley 2018).
    rendersOn: ['Titan (methane seas)','Frozen (airless)','Europa (icy moon)'],
  },
  glacial: {
    domain: 'cryo', provinceGroup: 'young-lowlands',
    processes: ['P10'],
    dependsOn: { features: [] },
    isolationKit: [],
    // +Europa 2026-06-15: viscous ice flow / lobate flows theorized.
    rendersOn: ['Titan (methane seas)','Frozen (airless)','Europa (icy moon)'],
  },

  // ── fluvial ──
  rivers: {
    domain: 'fluvial', provinceGroup: 'young-lowlands',
    processes: ['P8'],
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  lakes: {
    domain: 'fluvial', provinceGroup: 'global',
    // level-set cut on h at uSeaLevel (shader L3160-61) — floods wherever h<sea,
    // independent of rivers. No feature dep (the prior rivers edge was spurious).
    processes: ['P8','P13'],   // fluvial standing-liquid + coastal margin (F14)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  deltas: {
    domain: 'fluvial', provinceGroup: 'young-lowlands',
    processes: ['P8'],
    dependsOn: { features: ['rivers'] },
    isolationKit: ['rivers','lakes'],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  outflow: {
    domain: 'fluvial', provinceGroup: 'young-lowlands',
    processes: ['P8'],
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  karst: {
    domain: 'fluvial', provinceGroup: 'volcanic-provinces',
    processes: ['P14'],
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },

  // ── gradational ──
  coastlines: {
    domain: 'gradational', provinceGroup: 'global',
    processes: ['P13'],
    dependsOn: { features: ['lakes'] },
    isolationKit: ['lakes'],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  massWasting: {
    domain: 'gradational', provinceGroup: 'tectonic-highlands',
    // F19 reads gradIn − gradBase: EVERY combiner above the massWastCombiner line
    // (planet-lod-lab.html L3117–3136) feeds it — all 20 grad-writers, in call order.
    processes: ['P12'],
    dependsOn: { features: ['mountains','craters','ejecta','canyons','rivers','outflow','karst','scarps','plateaus','tessera','edifices','chaos','facets','hexTess','shatter','machine','ecumenopolis','cryoRidge','sublimation','glacial'] },
    isolationKit: ['mountains','canyons'],
    // blanket 2026-06-15: mass-wasting needs only slopes+gravity — universal on ALL solid-surface worlds (Max's call). +Carbon +Crystal. Excludes only the no-surface gas/ice giants.
    rendersOn: ['Frozen (airless)','Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Lava (hot airless)','Magma (K2-141b)','Europa (icy moon)','Titan (methane seas)','Carbon (high C/O)','Crystal (faceted)'],
  },

  // ── aeolian ──
  dunes: {
    domain: 'aeolian', provinceGroup: 'old-plains',
    processes: ['P9'],
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },
  dust: {
    domain: 'aeolian', provinceGroup: 'old-plains',
    processes: ['P9','P23'],   // aeolian transport + dust lofting (F16)
    dependsOn: { features: ['lakes'] },  // reads (1−liquidMask): dust can't mantle open sea (shader L3215)
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)'],
  },

  // ── bands ──
  bands: {
    domain: 'bands', provinceGroup: 'global',
    processes: ['P16'],   // zonal banding (F24)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  jets: {
    domain: 'bands', provinceGroup: 'global',
    processes: ['P16'],   // jets & shear ride the banding circulation (F25)
    dependsOn: { features: ['bands'] },
    isolationKit: ['bands'],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  weatherBands: {
    domain: 'bands', provinceGroup: 'global',
    processes: ['P20'],   // meridional circulation (F26 terrestrial latitude bands)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },

  // ── storms ──
  greatSpot: {
    domain: 'storms', provinceGroup: 'global',
    processes: ['P17'],   // vortex/storm formation (F27)
    dependsOn: { features: ['bands'] },
    isolationKit: ['bands'],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  stormTrain: {
    domain: 'storms', provinceGroup: 'global',
    processes: ['P17'],   // F28 oval trains
    dependsOn: { features: ['bands'] },
    isolationKit: ['bands'],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  polarVortex: {
    domain: 'storms', provinceGroup: 'global',
    processes: ['P17'],   // F29 polar vortex
    dependsOn: { features: ['bands'] },
    isolationKit: ['bands'],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  lightning: {
    domain: 'storms', provinceGroup: 'global',
    processes: ['P17'],   // F30 electrical storms in convective regions
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Hot Jupiter (locked giant)'],
  },

  // ── clouds ──
  clouds: {
    domain: 'clouds', provinceGroup: 'global',
    processes: ['P18','P19','P21'],   // condensation + haze + locked-circulation (F31 family)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Frozen (airless)','Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },

  // ── thermal ──
  daysideThermal: {
    domain: 'thermal', provinceGroup: 'global',
    processes: ['P21'],   // tidally-locked circulation / superrotation (F32)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Hot Jupiter (locked giant)'],
  },
  nightsideThermal: {
    domain: 'thermal', provinceGroup: 'global',
    processes: ['P21'],   // F33 nightside glow
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Hot Jupiter (locked giant)'],
  },

  // ── optical ──
  limb: {
    domain: 'optical', provinceGroup: 'global',
    processes: ['P26'],   // optical/atmospheric scattering (F34)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  terminator: {
    domain: 'optical', provinceGroup: 'global',
    processes: ['P26'],   // F35 terminator color gradient (scattering)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  sunglint: {
    domain: 'optical', provinceGroup: 'global',
    // spec *= liquidMask (shader L3925/3928): renders NOTHING without a live sea.
    // L4938 hard-codes "solo('sunglint') must re-enable lakes" → lakes in the kit.
    processes: ['P26'],   // F36 specular scatter off liquid (liquid via lakes dep)
    dependsOn: { features: ['lakes'] },
    isolationKit: ['lakes'],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)'],
  },
  aurora: {
    domain: 'optical', provinceGroup: 'global',
    processes: ['P24'],   // aurora & airglow — D13 magneticField hard gate (F37)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)','Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)','Hot Jupiter (locked giant)'],
  },
  airglow: {
    domain: 'optical', provinceGroup: 'global',
    processes: ['P24'],   // airglow — the non-magnetic half of P24 photochemistry; D4/D6 ATMOSPHERE gate (F38), NOT the field
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)','Titan (methane seas)'],
  },

  // ── dust ──
  dustStorm: {
    domain: 'dust', provinceGroup: 'global',
    processes: ['P23'],   // aerosol / dust lofting (F40)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Mars (arid rocky)'],
  },

  // ── exotic ──
  magma: {
    domain: 'exotic', provinceGroup: 'global',
    // F41 hemispheric magma ocean: P4/P6 (extreme heat) + D7 tidal-lock + D1 extreme T_eq
    processes: ['P4','P6'],
    directDrivers: ['tidalLock','tempEq'],
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Magma (K2-141b)','Lava (hot airless)'],
  },
  carbon: {
    domain: 'exotic', provinceGroup: 'global',
    // F42 carbon-world crust derives straight from D10 C/O ratio (no L1 process)
    processes: [],
    directDrivers: ['carbonToOxygen'],
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Carbon (high C/O)'],
  },
  facets: {
    domain: 'exotic', provinceGroup: 'global',
    processes: ['P15'],   // crustal tessellation / crystallization (F43)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Crystal (faceted)'],
  },
  hexTess: {
    domain: 'exotic', provinceGroup: 'global',
    processes: ['P15'],   // F44 hex tiling — crustal tessellation
    dependsOn: { features: [] },
    isolationKit: [],
    // DIVERGENT: member of exotic-geometric (preset 'Crystal (faceted)') but the
    // shader rides it on Frozen (planet-archetypes.js L112–117), NOT on Crystal.
    rendersOnDivergent: true,
    rendersOn: ['Frozen (airless)'],
  },
  shatter: {
    domain: 'exotic', provinceGroup: 'global',
    processes: ['P15'],   // F45 shattered crust — catastrophic fracture
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Frozen (airless)'],
  },

  // ── overlay (L1c biotic/technogenic — coats a habitable base world) ──
  bioMats: {
    domain: 'overlay', provinceGroup: 'global',
    processes: ['P27'],   // biospheric colonization → D15 habitability + D6 + D1 + D16 (F46)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  machine: {
    domain: 'overlay', provinceGroup: 'global',
    processes: ['P28'],   // technospheric development → D15 + D16 + D7 (F47)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)'],
  },
  cityLights: {
    domain: 'overlay', provinceGroup: 'global',
    processes: ['P28'],   // technosphere + nightside lights; reads liquidMask for land/coast (shader L3696)
    dependsOn: { features: ['lakes'] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
  ecumenopolis: {
    domain: 'overlay', provinceGroup: 'global',
    processes: ['P28'],   // technosphere at saturation (F49)
    dependsOn: { features: [] },
    isolationKit: [],
    rendersOn: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'],
  },
};

// `dependsOn.drivers` is DERIVED from each feature's `processes` (+ directDrivers) via the
// canonical L0/L1 model in planet-drivers.js — re-based on D1–D16 (Max, 2026-06-14). The
// manifest never hand-authors the driver list, so it cannot drift from the model.
for (const a of Object.values(ASSOCIATIONS)) {
  a.dependsOn.drivers = driversFor(a.processes, a.directDrivers);
}

// `modifies` is DERIVED, not hand-authored (audit Decision 1, 2026-06-14): X.modifies =
// every feature whose dependsOn.features lists X. dependsOn.features is the SINGLE source
// of truth for the shader-coupling relation, so the two directions cannot drift. Built in
// place at module load — keys are stable (the orphan/ref tests guarantee every dep is real).
for (const a of Object.values(ASSOCIATIONS)) a.modifies = [];
for (const [key, a] of Object.entries(ASSOCIATIONS)) {
  for (const dep of a.dependsOn.features) ASSOCIATIONS[dep].modifies.push(key);
}
