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
  // F36 sunglint — liquid-only mirror glint. Membership = the archetypes whose
  // presets can derive an open sea (the F14 wet x coverage gate): tectonic-
  // terrestrial (Rocky/Ocean/Eyeball water) + volatile-cold (Titan methane).
  // Gas/hot-jupiter archetypes are deliberately ABSENT: an h2-he envelope has no
  // liquid SURFACE to mirror — their drivers derive specStrength 0 (the stand-in
  // whole-surface sheen, incl. the airless iron metal sheen, is retired).
  sunglint:   { label: 'Sunglint (F36)',        enableKey: 'sunglintEnabled',  archetypes: ['tectonic-terrestrial','volatile-cold'] },
  // F37 aurorae — night-side magnetic ovals (P24: D13 field is the HARD gate).
  // Registration agrees with the render set (review M1, both directions):
  // tectonic-terrestrial (Earth green O-line ovals, the richest carrier) +
  // volatile-cold (Titan derives a live 0.18 oval; Frozen airless-inert) +
  // the giants (Jupiter/Saturn UV H2 ovals — live via the applyDrivers
  // metallic-hydrogen dynamo boost, since the iron-only core D13 derivation
  // can't express a giant dynamo; Sub-Neptune keeps its faint derived 0.10).
  aurora:     { label: 'Aurorae (F37)',         enableKey: 'auroraEnabled',    archetypes: ['tectonic-terrestrial','volatile-cold','gas-giant','hot-jupiter'] },
  // F40 dust storms — aeolian atmospheric veil (P23 lofting; F-dust family sole
  // member). Carrier = the dry thin-but-present-atmosphere world (Mars preset):
  // tectonic-terrestrial only — airless worlds have no air to loft (Frozen/Lava
  // gate 0), gas worlds have no loose surface dust (the storm deck there IS the
  // F24-F29 stack), and the wet/thick presets in this same archetype (Rocky/
  // Ocean/Venus/Eyeball) derive activity 0 behind the dryness + thin-pressure
  // gates — the folder shows, the feature stays inert (the F34/F35 convention).
  dustStorm:  { label: 'Dust storms (F40)',     enableKey: 'dustStormEnabled', archetypes: ['tectonic-terrestrial'] },
  // F41 hemispheric magma ocean — Exotic substellar sea (D1 extreme T_eq + D7 lock
  // melt the permanent dayside; F-exotic-natural group). Carrier class = locked +
  // solid + substellar melt: ONLY the two volcanic presets derive a sea angle > 0
  // ('Magma (K2-141b)' wide sea ~1.52 rad; 'Lava (hot airless)' small pond ~0.42),
  // so registration agrees with the render set (review M1, both directions):
  // volcanic only — Eyeball is locked but temperate (T_ss 378 K, mask gates 0),
  // Hot Jupiter is locked + hot but GAS (no rock surface to melt — its glow is the
  // F32/F33 thermal pair), every unlocked preset derives T_ss 0 outright.
  magma:      { label: 'Magma ocean (F41)',     enableKey: 'magmaEnabled',     archetypes: ['volcanic'] },
  // F42 carbon-world crust — Exotic surface MINERALOGY, not new landforms (D10 high
  // C/O swaps the condensation sequence: graphite/SiC/diamond replace silicate rock;
  // F-exotic-natural group). Carrier class = composition.carbonToOxygen > 0.8 (the
  // Kuchner-Seager swap-point): ONLY 'Carbon (high C/O)' carries the field (ratio
  // 1.2 -> strength 1; every other preset derives ratio 0 outright), so registration
  // agrees with the render set (review M1, both directions). A NEW dedicated
  // archetype: no existing preset family is carbon-rich, and the graphite/tar/
  // diamond read shares no carrier with the volcanic HEAT class — F42 is material
  // chemistry, not melt (the 55 Cnc e hot-molten variant is the card's logged v1
  // scope cut).
  carbon:     { label: 'Carbon crust (F42)',    enableKey: 'carbonEnabled',    archetypes: ['exotic-carbon'] },
  // F43 crystalline facet field — Exotic speculative endmember (P15 crustal
  // tessellation, slow-crystallization branch): near-equilibrium crystal growth
  // tiles the crust into flat planar faces meeting at sharp ridge crests (F-exotic-
  // natural group). Carrier class = airless + PRISTINE surface-history (erosion < 0.05
  // && resurfacingRate < 0.05 && bombardmentIntensity < 0.2): ONLY 'Crystal (faceted)'
  // clears all four terms (every other preset fails at least one — atmospheric presets
  // fail airless, Lava/Magma fail resurfacingRate ~1, Frozen/Europa/Carbon fail erosion
  // ≥ 0.05), so registration agrees with the render set (review M1, both directions).
  // A NEW dedicated archetype: no existing preset family is undisturbed-airless-crystalline,
  // and the facet read shares no carrier with the volcanic HEAT class or the carbon
  // MINERALOGY class — F43 is unhurried crystallization geometry (the Pluto-blade /
  // Naica-selenite template; the Wulff-habit + blade-orientation-alignment refinements
  // are the card's logged v1 scope cuts).
  facets:     { label: 'Crystal facets (F43)',  enableKey: 'facetsEnabled',    archetypes: ['exotic-geometric'] },
  // F44 hex-tessellated crust — Exotic speculative endmember (P15 crustal tessellation,
  // cooling-contraction / convection branch): a uniform-lithology crust tiles into ~hex
  // cells (3 fractures @ 120°). REUSES the exotic-geometric archetype F43 created (no new
  // archetype, no new preset — rides 'Frozen (airless)' per the card §5 base). uHexStrength
  // is a pure ENABLE gate (no driver class), so registration is the enable flag alone.
  hexTess:    { label: 'Hex crust (F44)',       enableKey: 'hexTessEnabled',   archetypes: ['exotic-geometric'] },
  // F45 shattered / fractured crust — Exotic speculative endmember (P15 crustal tessellation,
  // CATASTROPHIC-disruption branch): an existing crust shattered into chaotic, mismatched,
  // tilted blocks (shatter-then-reaccrete; Miranda / Europa Conamara analog). Gets its OWN
  // archetype 'exotic-shattered' (NOT exotic-geometric) — F43/F44 are ORDERED tilings of a
  // PRISTINE crust; F45 is the opposite physical story (chaotic disruption), and grouping it
  // with the ordered tilings would imply a shared carrier + let the lab's solo/archetype tooling
  // group it with F44 (the "reads like paving stones" failure UAT item 3 guards against).
  // uShatStrength is a pure ENABLE gate (no driver class), so registration is the enable flag alone.
  shatter:    { label: 'Shattered crust (F45)', enableKey: 'shatterEnabled',   archetypes: ['exotic-shattered'] },
  bioMats:    { label: 'Bioluminescent mats (F46)', enableKey: 'bioMatsEnabled', archetypes: ['tectonic-terrestrial'] },
};

// Each ARCHETYPE carries its human metadata + which lab presets exemplify it.
// Feature membership is DERIVED by inverting FEATURES (no duplication).
export const ARCHETYPES = {
  'impact-airless':       { label: 'Impact / airless',       bodies: ['Moon','Mercury'],              presets: ['Frozen (airless)'] },
  'tectonic-terrestrial': { label: 'Tectonic / terrestrial', bodies: ['Earth','Venus','Mars'],        presets: ['Rocky (Earthlike)','Ocean (temperate)','Venus (sulfuric shroud)','Eyeball (locked temperate)','Mars (arid rocky)'] },
  'volcanic':             { label: 'Volcanic',               bodies: ['Io','Mars','K2-141b'],         presets: ['Lava (hot airless)','Magma (K2-141b)'] },
  'icy-active':           { label: 'Icy-active',             bodies: ['Europa','Ganymede'],           presets: ['Europa (icy moon)'] },
  'volatile-cold':        { label: 'Volatile / cold',        bodies: ['Pluto','Triton','Mars poles'], presets: ['Titan (methane seas)','Frozen (airless)'] },
  'gas-giant':            { label: 'Gas giant',              bodies: ['Jupiter','Saturn','Neptune'],  presets: ['Gas giant (Jovian)','Gas giant (Saturnian)','Ice giant (Neptunian)','Sub-Neptune (hazy)'] },
  'hot-jupiter':          { label: 'Hot Jupiter',            bodies: ['HD 209458 b','WASP-43 b'],     presets: ['Hot Jupiter (locked giant)'] },
  'exotic-carbon':        { label: 'Exotic / carbon',        bodies: ['55 Cnc e','PSR J1719-1438 b'], presets: ['Carbon (high C/O)'] },
  'exotic-geometric':     { label: 'Exotic / geometric',     bodies: ['Pluto bladed terrain','55 Cnc e'], presets: ['Crystal (faceted)'] },
  'exotic-shattered':     { label: 'Exotic / shattered',     bodies: ['Miranda','Europa Conamara Chaos'], presets: ['Frozen (airless)'] },
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
  sunglint:   { field: 2, polarity: +1, floor: 1.00 },  // neutral — view/illumination geometry, not geology: the mirror point follows sun + camera over the (already lakes-gated) sea (FROST-row pattern, like limb/terminator)
  aurora:     { field: 2, polarity: +1, floor: 1.00 },  // neutral — magnetospheric optics, not geology: the oval follows the dipole axis + night side, never the rock provinces (FROST-row pattern, like limb/terminator/sunglint)
  dustStorm:  { field: 2, polarity: +1, floor: 1.00 },  // neutral — weather, not geology: the airborne veil/tracks ride the wind, not the rock provinces (FROST-row pattern, like clouds F31; Hellas-style low-elevation nucleation is a logged F40 v1 scope cut)
  magma:      { field: 2, polarity: +1, floor: 1.00 },  // neutral — irradiation, not geology: the sea follows the substellar point (the light direction), never the rock provinces (FROST-row pattern, like daysideThermal F32)
  carbon:     { field: 2, polarity: +1, floor: 1.00 },  // neutral — mineralogy, not geology: the graphite/tar/diamond materials ARE the whole crust (composition-driven, planet-global), never gated by rock provinces (FROST-row pattern, like magma F41)
  facets:     { field: 2, polarity: +1, floor: 1.00 },  // neutral — crystallization, not geology: the facet field grows over the WHOLE undisturbed crust (surface-history-driven, planet-global), never gated by rock provinces (FROST-row pattern, like carbon F42)
  hexTess:    { field: 2, polarity: +1, floor: 1.00 },  // neutral — crustal tessellation, not geology: the hex tiling covers the whole uniform crust (cooling/surface-history-driven, planet-global), never gated by rock provinces (FROST-row pattern, like facets F43)
  shatter:    { field: 2, polarity: +1, floor: 1.00 },  // neutral — crustal disruption, not geology: the shattered-block field covers the whole crust (catastrophic-stress/surface-history-driven, planet-global), never gated by rock provinces (FROST-row pattern, like hexTess F44)
  bioMats:    { field: 2, polarity: +1, floor: 1.00 },  // neutral — biosphere coverage, not geology: the mat spreads over habitable terrain (life-/coverage-driven, planet-global), never gated by rock provinces (FROST-row pattern, like aurora F37)
};
