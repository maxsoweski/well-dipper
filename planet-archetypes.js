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
  lakes:      { label: 'Lakes & seas (F14)',    enableKey: 'lakesEnabled',     archetypes: ['tectonic-terrestrial','volatile-cold'] },
  deltas:     { label: 'Deltas & fans (F12)',   enableKey: 'deltasEnabled',    archetypes: ['tectonic-terrestrial','volatile-cold'] },
  coastlines: { label: 'Coastlines (F20)',      enableKey: 'coastEnabled',     archetypes: ['tectonic-terrestrial','volatile-cold'] },
  outflow:    { label: 'Outflow channels (F13)',enableKey: 'outflowEnabled',   archetypes: ['tectonic-terrestrial','volatile-cold'] },
  karst:      { label: 'Karst (F21)',           enableKey: 'karstEnabled',     archetypes: ['tectonic-terrestrial','volatile-cold'] },
  dunes:      { label: 'Dunes & wind forms (F15)', enableKey: 'dunesEnabled',  archetypes: ['tectonic-terrestrial','volatile-cold'] },
  dust:       { label: 'Dust mantles (F16)',    enableKey: 'dustEnabled',      archetypes: ['tectonic-terrestrial','volatile-cold'] },
  massWasting:{ label: 'Mass-wasting (F19)',    enableKey: 'massWastEnabled',  archetypes: ['impact-airless','tectonic-terrestrial','volcanic','icy-active','volatile-cold'] },
  bands:      { label: 'Zonal belts (F24)',     enableKey: 'bandsEnabled',     archetypes: ['gas-giant','hot-jupiter'] },
  jets:       { label: 'Jets & shear (F25)',    enableKey: 'jetsEnabled',      archetypes: ['gas-giant','hot-jupiter'] },
  weatherBands:{ label: 'Weather bands (F26)',  enableKey: 'weatherBandsEnabled', archetypes: ['tectonic-terrestrial'] },
  greatSpot:  { label: 'Great spot (F27)',      enableKey: 'greatSpotEnabled', archetypes: ['gas-giant','hot-jupiter'] },
  stormTrain: { label: 'Storm clusters (F28)',  enableKey: 'stormTrainEnabled', archetypes: ['gas-giant','hot-jupiter'] },
  polarVortex:{ label: 'Polar vortex (F29)',    enableKey: 'polarVortexEnabled', archetypes: ['gas-giant','hot-jupiter'] },
  lightning:  { label: 'Lightning (F30)',       enableKey: 'lightningEnabled', archetypes: ['gas-giant','tectonic-terrestrial','hot-jupiter'] },
  clouds:     { label: 'Clouds & haze (F31)',   enableKey: 'cloudsEnabled',    archetypes: ['tectonic-terrestrial','volatile-cold','gas-giant','hot-jupiter'] },
  // F32/F33 thermal pair — ONE temperature curve, two ownable consumers (built
  // together; soloed separately). hot-jupiter-only: the locked h2-he envelope is
  // the one preset family whose drivers derive thermalStrength > 0. The whole
  // F24-F31 gas stack above also lists 'hot-jupiter' — the thermal glow rides
  // OVER the band/storm/cloud deck, so those folders must stay visible (and the
  // archetype filter feature-set complete) on the new preset.
  daysideThermal:  { label: 'Dayside thermal (F32)', enableKey: 'daysideThermalEnabled',  archetypes: ['hot-jupiter'] },
  nightsideThermal:{ label: 'Nightside glow (F33)',  enableKey: 'nightsideThermalEnabled', archetypes: ['hot-jupiter'] },
  // F34 limb glow — a GLOBAL optical edge phenomenon on every retained-atmosphere
  // archetype (the F31 clouds membership set): the airless archetypes derive
  // limbStrength 0 in core, so listing them would only show a dead folder.
  limb:       { label: 'Limb glow (F34)',       enableKey: 'limbEnabled',      archetypes: ['tectonic-terrestrial','volatile-cold','gas-giant','hot-jupiter'] },
  // F35 terminator gradient — review M1: registration must agree with the render
  // set. Drivers light the band on EVERY retained-atmosphere preset (a terminator
  // is physically real on the giants too), so membership matches F34's set; the
  // card's narrower terrestrial/rocky/venus doc scope is logged in its §7.
  terminator: { label: 'Terminator gradient (F35)', enableKey: 'terminatorEnabled', archetypes: ['tectonic-terrestrial','volatile-cold','gas-giant','hot-jupiter'] },
};

// Each ARCHETYPE carries its human metadata + which lab presets exemplify it.
// Feature membership is DERIVED by inverting FEATURES (no duplication).
export const ARCHETYPES = {
  'impact-airless':       { label: 'Impact / airless',       bodies: ['Moon','Mercury'],              presets: ['Frozen (airless)'] },
  'tectonic-terrestrial': { label: 'Tectonic / terrestrial', bodies: ['Earth','Venus'],               presets: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)'] },
  'volcanic':             { label: 'Volcanic',               bodies: ['Io','Mars'],                   presets: ['Lava (hot airless)'] },
  'icy-active':           { label: 'Icy-active',             bodies: ['Europa','Ganymede'],           presets: ['Europa (icy moon)'] },
  'volatile-cold':        { label: 'Volatile / cold',        bodies: ['Pluto','Triton','Mars poles'], presets: ['Titan (methane seas)','Frozen (airless)'] },
  'gas-giant':            { label: 'Gas giant',              bodies: ['Jupiter','Saturn','Neptune'],  presets: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)'] },
  'hot-jupiter':          { label: 'Hot Jupiter',            bodies: ['HD 209458 b','WASP-43 b'],     presets: ['Hot Jupiter (locked giant)'] },
};

// Derived helper (also what Stage-D will call): the archetype→feature-subset map.
export const featuresOf = (archKey) =>
  Object.entries(FEATURES).filter(([, f]) => f.archetypes.includes(archKey)).map(([k]) => k);

// ── Stage-D geologic provinces (LIVE 2026-06-10, workstream stage-d-provinces-2026-06-10) ──
// The per-feature affinity data the shader's provinceWeight() accessor MIRRORS (GLSL if-chain
// in planet-lod-lab.html — edit BOTH; the vitest drift-guard parses the GLSL and cross-checks
// it against this table). Three decorrelated low-frequency fields partition the sphere; each
// feature declares the field it clusters into (polarity +1) or avoids (-1), plus a floor that
// keeps it faintly present outside its province (feature-POOR provinces, not feature-absent).
// floor 1.0 = NEUTRAL: climate-driven features (frost F22/F23) stay unprovinced — geology
// must not gate latitude/temperature behavior.
export const PROVINCE_FIELDS = ['tectonic', 'volcanic', 'ancient'];
export const PROVINCES = {
  mountains:  { field: 0, polarity: +1, floor: 0.15 },
  craters:    { field: 0, polarity: -1, floor: 0.25 },
  ejecta:     { field: 0, polarity: -1, floor: 0.25 },  // wraps F2 — MUST equal craters (vitest-pinned)
  canyons:    { field: 0, polarity: +1, floor: 0.20 },
  scarps:     { field: 2, polarity: +1, floor: 0.30 },
  plateaus:   { field: 2, polarity: +1, floor: 0.20 },
  tessera:    { field: 0, polarity: +1, floor: 0.20 },
  edifices:   { field: 1, polarity: +1, floor: 0.15 },
  lava:       { field: 1, polarity: +1, floor: 0.10 },
  chaos:      { field: 1, polarity: +1, floor: 0.25 },
  cryoRidge:  { field: 1, polarity: -1, floor: 0.30 },
  rivers:     { field: 2, polarity: -1, floor: 0.30 },
  sublimation:{ field: 2, polarity: +1, floor: 0.40 },
  glacial:    { field: 2, polarity: -1, floor: 0.40 },
  frost:      { field: 2, polarity: +1, floor: 1.00 },  // neutral — climate, not geology
  lakes:      { field: 2, polarity: +1, floor: 1.00 },  // neutral — hydrology (level-set), not geology
  deltas:     { field: 2, polarity: -1, floor: 0.30 },  // river products — same lowlands affinity as rivers
  coastlines: { field: 2, polarity: +1, floor: 1.00 },  // neutral — margins live wherever the sea is, like lakes/frost
  outflow:    { field: 2, polarity: -1, floor: 0.30 },  // flood products — young lowlands, floods empty into the same basins as rivers
  karst:      { field: 1, polarity: +1, floor: 0.25 },  // soluble lithology — decorrelated from the fluvial z-field (CHAOS-row pattern)
  dunes:      { field: 0, polarity: -1, floor: 0.30 },  // sand seas on old stable plains — the CRATER-row polarity (Mars barchans live among craters)
  dust:       { field: 0, polarity: -1, floor: 0.50 },  // fallout is near-global — dunes' old-plains polarity but a HIGHER floor (mantles thin, never vanish)
  massWasting:{ field: 0, polarity: +1, floor: 0.30 },  // deposits live where steeps live — the MOUNTAIN-field polarity (talus needs walls to fail)
  bands:      { field: 2, polarity: +1, floor: 1.00 },  // neutral — atmosphere, not geology (FROST-row pattern: a gas deck must not be gated by rock provinces)
  jets:       { field: 2, polarity: +1, floor: 1.00 },  // neutral — the shear dynamics ride the same unprovinced gas deck as bands (F24)
  weatherBands:{ field: 2, polarity: +1, floor: 1.00 }, // neutral — climate, not geology (FROST-row pattern: latitude circulation must not be gated by rock provinces)
  greatSpot:  { field: 2, polarity: +1, floor: 1.00 },  // neutral — the vortex rides the same unprovinced gas deck as bands/jets (F24/F25)
  stormTrain: { field: 2, polarity: +1, floor: 1.00 },  // neutral — the train rides the same unprovinced gas deck as the great spot (F27)
  polarVortex:{ field: 2, polarity: +1, floor: 1.00 },  // neutral — the pole structure rides the same unprovinced gas deck as the storm family (F27/F28)
  lightning:  { field: 2, polarity: +1, floor: 1.00 },  // neutral — weather, not geology: flashes follow the convective cloud deck (FROST-row pattern)
  clouds:     { field: 2, polarity: +1, floor: 1.00 },  // neutral — atmosphere, not geology: the deck/haze/blanket rides ABOVE the rock provinces (FROST-row pattern)
  daysideThermal:  { field: 2, polarity: +1, floor: 1.00 },  // neutral — irradiation, not geology: the dayside lobe follows the star, not the rock provinces (FROST-row pattern)
  nightsideThermal:{ field: 2, polarity: +1, floor: 1.00 },  // neutral — atmospheric emission, not geology: the night floor + silicate deck ride ABOVE the rock provinces (FROST-row pattern)
  limb:       { field: 2, polarity: +1, floor: 1.00 },  // neutral — global optics, not geology: the rim hugs the whole silhouette regardless of provinces (FROST-row pattern, like clouds F31)
  terminator: { field: 2, polarity: +1, floor: 1.00 },  // neutral — global optics, not geology: the twilight band follows the light, not the rock provinces (FROST-row pattern, like limb F34)
};
