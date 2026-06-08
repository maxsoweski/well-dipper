// Shared archetype taxonomy for the planet lab panel — and the source of truth a
// future Stage-D geologic-provinces system will read (DATA ONLY here; no Stage-D
// spatial/combiner code). Each FEATURE declares its identity + archetype membership
// (single source per feature); archetype→feature subsets fall out by inversion via
// featuresOf() — no second place to drift.
export const FEATURES = {
  craters:    { label: 'Craters (F2)',          enableKey: 'cratersEnabled',   archetypes: ['impact-airless'] },
  ejecta:     { label: 'Ejecta & Rays (F3)',    enableKey: 'ejectaEnabled',    archetypes: ['impact-airless'] },
  scarps:     { label: 'Scarps (F5)',           enableKey: 'scarpsEnabled',    archetypes: ['impact-airless','tectonic-terrestrial'] },
  mountains:  { label: 'Mountains (F1)',        enableKey: 'mountainsEnabled', archetypes: ['tectonic-terrestrial'] },
  canyons:    { label: 'Canyons (F4)',          enableKey: 'canyonsEnabled',   archetypes: ['tectonic-terrestrial'] },
  plateaus:   { label: 'Plateaus (F6)',         enableKey: 'plateausEnabled',  archetypes: ['tectonic-terrestrial'] },
  tessera:    { label: 'Tessera (F6)',          enableKey: 'tesseraEnabled',   archetypes: ['tectonic-terrestrial'] },
  edifices:   { label: 'Edifices (F7)',         enableKey: 'edificesEnabled',  archetypes: ['volcanic'] },
  lava:       { label: 'Lava plains (F8)',      enableKey: 'lavaEnabled',      archetypes: ['volcanic'] },
  chaos:      { label: 'Chaos (F9)',            enableKey: 'chaosEnabled',     archetypes: ['icy-active'] },
  cryoRidge:  { label: 'Ridged icy (F10)',      enableKey: 'cryoRidgeEnabled', archetypes: ['icy-active'] },
  frost:      { label: 'Cryo / Frost (F23/F22)',enableKey: 'frostEnabled',     archetypes: ['volatile-cold'] },
  sublimation:{ label: 'Sublimation (F18)',     enableKey: 'subEnabled',       archetypes: ['volatile-cold'] },
  glacial:    { label: 'Glacial (F17)',         enableKey: 'glacialEnabled',   archetypes: ['volatile-cold'] },
  rivers:     { label: 'Rivers & valleys (F11)',enableKey: 'riversEnabled',    archetypes: ['tectonic-terrestrial','volatile-cold'] },
};

// Each ARCHETYPE carries its human metadata + which lab presets exemplify it.
// Feature membership is DERIVED by inverting FEATURES (no duplication).
export const ARCHETYPES = {
  'impact-airless':       { label: 'Impact / airless',       bodies: ['Moon','Mercury'],              presets: ['Frozen (airless)'] },
  'tectonic-terrestrial': { label: 'Tectonic / terrestrial', bodies: ['Earth','Venus'],               presets: ['Rocky (Earthlike)','Ocean (temperate)'] },
  'volcanic':             { label: 'Volcanic',               bodies: ['Io','Mars'],                   presets: ['Lava (hot airless)'] },
  'icy-active':           { label: 'Icy-active',             bodies: ['Europa','Ganymede'],           presets: ['Europa (icy moon)'] },
  'volatile-cold':        { label: 'Volatile / cold',        bodies: ['Pluto','Triton','Mars poles'], presets: ['Titan (methane seas)','Frozen (airless)'] },
};

// Derived helper (also what Stage-D will call): the archetype→feature-subset map.
export const featuresOf = (archKey) =>
  Object.entries(FEATURES).filter(([, f]) => f.archetypes.includes(archKey)).map(([k]) => k);
