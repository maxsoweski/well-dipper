// planet-lod-uniforms.js — SINGLE SOURCE of the planet shader uniform defaults.
// AC1 (rivers-dendritic-drainage): the lab's inline `const uniforms = {...}` block,
// wrapped in a factory so each consumer (lab planet shader, river router) gets its OWN
// mutable instance (THREE mutates uniform .value). Edit HERE, not copies.
// WORLD_LIGHT (the static light direction) is the lab's own constant — passed in so this
// module stays the single source of the *defaults* without owning lab scene state.
import * as THREE from 'three';
export function makeUniforms(WORLD_LIGHT) {
  return {
      uNoiseScale: { value: 4.0 },
      uOctaves:    { value: 4.0 },
      uLodRamp:    { value: 0.0 },
      uLevels:     { value: 6.0 },
      uPerturb:    { value: 0.55 },
      uNormalMode: { value: 0 },
      uFwClamp:    { value: 1 },
      // ── Envelope composite-split (spec §2.C) — the A/B/C tunable surface ──
      uDitherMode:     { value: 0 },     // 0 = Bayer, 1 = IGN/triangular
      uEmissive:       { value: 0.0 },   // emissive glow strength (lava/hot bodies)
      uSpecStrength:   { value: 0.0 },   // specular glint (ocean/ice)
      uLimbStrength:   { value: 0.0 },   // limb/atmosphere rim glow
      uEmissiveBypass: { value: 0 },     // 1 = term skips the quantizer (smooth glow)
      uSpecBypass:     { value: 0 },
      uLimbBypass:     { value: 0 },
      // ── F34 limb glow (driver-true rim — card §6.5 step 2) ──
      uLimbColor:      { value: new THREE.Color(0.45, 0.65, 1.0) },  // F34 rim tint (driven: per-preset map, fallback uBaseColor)
      uLimbExponent:   { value: 3.5 },   // F34 fresnel width (driven: thin clear ~3.5 / thick-haze ~1.8)
      // ── F35 terminator color gradient (driver-true twilight band — card §6.5 step 2) ──
      uTermColor:      { value: new THREE.Color(1.0, 0.45, 0.18) }, // F35 band tint (driven: per-preset map, fallback warm orange)
      uTermStrength:   { value: 0.0 },   // F35 band strength (driven: ~0.5 retained atmosphere / 0 airless)
      uTermWidth:      { value: 0.12 },  // F35 gaussian half-width (driven: pressure log ramp 0.06..0.30)
      uTermBypass:     { value: 0 },     // 1 = band skips the quantizer (smooth twilight)
      // ── F36 sunglint (driver-true liquid glint — card §6.5 steps 3-4) ──
      uGlintTint:      { value: new THREE.Color(0.95, 0.97, 1.0) },  // F36 species tint (driven: water cold-white / methane warm tholin)
      uGlintExp:       { value: 200.0 }, // F36 Blinn-Phong exponent (driven: species base x Cox-Munk broadening at the writer)
      uCloudCoverage:  { value: 0.0 },   // weather-layer density (driven by deriveUniforms)
      // ── F37 aurorae (driver-true magnetic ovals — card §6.5 steps 2-4) ──
      uAuroraIntensity:{ value: 0.0 },   // F37 ring strength (driven: core field x atmosphere, hard-gated field > 0.05; Venus regime-3 override)
      uAuroraColor:    { value: new THREE.Color(0.3, 0.9, 0.5) },  // F37 emission color (driven: D4 composition map, fallback green)
      uAuroraRingLat:  { value: 0.7 },   // F37 oval magnetic latitude (driven: 0.7 + field x 0.2)
      uAuroraRingWidth:{ value: 0.12 },  // F37 oval gaussian half-width (driven: 0.15 - field x 0.08, floored)
      uMagAxis:        { value: new THREE.Vector3(0, 1, 0) },      // F37 dipole axis (driven: spin axis tilted ~11 deg, azimuth hashed from macroSeed)
      // ── F38 airglow (driver-true thin night-limb shell — card §6.5 steps 4-6) ──
      uAirglowIntensity:{ value: 0.0 },   // F38 band strength (driven: atmosphere density gate; 0 airless ⇒ airglowC vec3(0) exactly)
      uAirglowColor:    { value: new THREE.Color(0.35, 0.95, 0.55) },  // F38 airglow-green default (OI 557.7 nm; uniform, no composition map)
      // ── F39 cloud optics (driver-true antisolar glory — card §6.5 steps 4-6) ──
      uCloudOpticsIntensity:{ value: 0.0 },   // F39 glory strength (driven: cloudsEnabled × cloud presence at the writer; 0 cloudless ⇒ cloudOpticsC vec3(0) exactly)
      uGloryRadius:         { value: 0.06 },  // F39 stylized-large ring-stack angular radius (rad) — inflated past the sub-degree real glory so the bands read at d15/d4
      uBioCoverage:  { value: 0.0 },                               // F46 inert behind uBioCoverage 0
      uBioColor:     { value: new THREE.Color(0.30, 0.95, 0.55) }, // F46 inert behind uBioCoverage 0
      uBioScale:     { value: 2.4 },                               // F46 inert behind uBioCoverage 0
      uBioIntensity: { value: 0.7 },                               // F46 inert behind uBioCoverage 0
      // ── F40 dust storms (driver-true aeolian storm veil — card §6.5 steps 3-6) ──
      uDustActivity:   { value: 0.0 },   // F40 storm activity (driven: retained AND pressure <= 0.5 AND dry AND not gas -> 0.55 Mars-like carrier, else 0)
      uDustColor:      { value: new THREE.Color(0.78, 0.55, 0.32) },  // F40 lofted-dust tint (driven: preset atmosphere butterscotch, fallback warm ochre)
      // ── F41 hemispheric magma ocean (driver-true exotic sea — card §6.5 steps 3-7) ──
      // uMagmaSeaAngle 0 ⇒ every F41 GLSL block is skipped entirely (byte-identical pre-F41 render).
      uMagmaSeaAngle:  { value: 0.0 },   // F41 liquidus iso-angle rad (driven: acos((1300/T_ss)^4) on the locked-solid-melt class — K2-141b ~1.52 / Lava ~0.42 / else 0, the master gate)
      uMagmaTemp:      { value: 0.0 },   // F41 substellar surface temp T_ss K (driven: T_eq x 1.4 on locked worlds, 0 unlocked)
      uMagmaChurnSpeed:{ value: 0.02 },  // F41 crust-plate churn phase rate — lab knob (bounded two-phase fract crossfade)
      // ── F42 carbon-world crust (driver-true exotic mineralogy — card §6.5 steps 3-7) ──
      // uCarbonStrength 0 ⇒ every F42 GLSL block is skipped entirely (byte-identical pre-F42 render).
      uCarbonStrength: { value: 0.0 },   // F42 master gate (driven: clamp((C/O - 0.8) x 2.5) — 'Carbon (high C/O)' 1.2 -> 1; every other preset derives 0)
      uTarCoverage:    { value: 0.35 },  // F42 tar-flat coverage fraction — lab knob (F8 region-extent semantics; inert behind strength 0)
      uGlintDensity:   { value: 0.5 },   // F42 diamond-glint sparse-cell density — lab knob (inert behind strength 0)
      // ── F43 crystalline facet field (driver-true exotic crystallization — card §6.5 steps 3-7) ──
      // uFacetStrength 0 ⇒ every F43 GLSL block is skipped entirely (byte-identical pre-F43 render).
      uFacetStrength:  { value: 0.0 },   // F43 master gate (driven: 1 on airless+pristine crystal class — 'Crystal (faceted)'; every other preset 0)
      uFacetCoverage:  { value: 0.45 },  // F43 facet coverage fraction — lab knob (scattered → continuous; F7 region-extent semantics; inert behind strength 0)
      uFacetScale:     { value: 9.0 },   // F43 facet cell density — lab knob (voronoi3d frequency; inert behind strength 0)
      uFacetAmp:       { value: 0.5 },   // F43 facet relief amplitude — lab knob (per-cell height + tilt scale; inert behind strength 0)
      // ── F44 hex-tessellated crust (pure enable gate — card §6.5; no preset, no driver) ──
      // uHexStrength 0 ⇒ every F44 GLSL block is skipped entirely (byte-identical pre-F44 render).
      uHexStrength:    { value: 0.0 },   // F44 master gate (pure enable: 1 when hexTessEnabled, else 0)
      uHexRegularity:  { value: 0.85 },  // F44 jitter knob — 0=random Voronoi, 1=regular hex (inert behind strength 0)
      uHexScale:       { value: 4.0 },   // F44 hex cell density — lab knob (voronoi3d frequency; inert behind strength 0)
      uHexBorderDepth: { value: 0.5 },   // F44 trough carve depth — lab knob (inert behind strength 0)
      uHexBorderWidth: { value: 0.08 },  // F44 border band width — lab knob (inert behind strength 0)
      uHexDome:        { value: 0.4 },   // F44 per-cell domed-center amount — lab knob (inert behind strength 0)
      // ── F45 shattered crust (pure enable gate — card §6.5; no preset, no driver) ──
      // uShatStrength 0 ⇒ every F45 GLSL block is skipped entirely (byte-identical pre-F45 render).
      uShatStrength:    { value: 0.0 },  // F45 master gate (pure enable: 1 when shatterEnabled, else 0)
      uShatScale:       { value: 1.6 },  // F45 mega-block density — lab knob (voronoi3d frequency; inert behind strength 0)
      uShatBlockJitter: { value: 0.6 },  // F45 per-block flat+tilt displacement — lab knob (THE grad driver; inert behind strength 0)
      uShatBorderDepth: { value: 1.0 },  // F45 crevasse carve-down depth — lab knob (inert behind strength 0)
      uShatBorderWidth: { value: 0.10 }, // F45 F2−F1 border band width — lab knob (inert behind strength 0)
      uShatMaskScale:   { value: 1.1 },  // F45 region-mask frequency — lab knob (inert behind strength 0)
      uShatMaskCover:   { value: 1.0 },  // F45 region coverage = intensity axis (1=global shattered) — lab knob (inert behind strength 0)
      uShatSubFreq:     { value: 5.0 },  // F45 sub-fracture lattice frequency — lab knob (inert behind strength 0; walked 3.5→5.0, overwritten per-frame from state)
      uShatSubAmt:      { value: 0.7 },  // F45 sub-fracture relief amount — lab knob (inert behind strength 0; walked 0.4→0.7, overwritten per-frame from state)
      // F47 machine surface (Stage-7 EXOTIC overlay, dual-channel) — uMachCoverage is the master gate (pure lab knob: state.machCoverage when machineEnabled, else 0); all others inert behind coverage 0
      uMachCoverage:      { value: 0.0 },                                  // F47 master gate (0 ⇒ bare base — combiner early-outs, composite + glow guarded)
      uMachDistrictScale: { value: 2.2 },                                  // F47 low-freq district grid frequency
      uMachBlockScale:    { value: 9.0 },                                  // F47 high-freq block grid frequency (scale-hierarchy 2nd tier)
      uMachSeamWidth:     { value: 0.06 },                                 // F47 grid-line / panel-seam half-width
      uMachBevel:         { value: 0.5 },                                  // F47 bevel amount fed onto grad (normal channel)
      uMachMetalColor:    { value: new THREE.Color(0.10, 0.11, 0.13) },    // F47 near-flat dark-metal plate albedo
      uMachGlowColor:     { value: new THREE.Color(0.45, 0.85, 1.0) },     // F47 circuit-trace / window emissive color (cyan)
      uMachGlowIntensity: { value: 0.8 },                                  // F47 trace+window glow brightness (emissive-bypass)
      uMachWindowDensity: { value: 0.5 },                                  // F47 per-cell-hash fraction of lit cells
      uCityMaturity:      { value: 0.0 },                                  // F48 master gate (writer: enabled ? cityMaturity : 0) — 0 ⇒ bare Stage-6 base
      uCityIntensity:     { value: 0.9 },                                  // F48 warm glow brightness (emissive-bypass)
      uCityScale:         { value: 2.8 },                                  // F48 settlement noise frequency (cluster density)
      uCityCoastBoost:    { value: 1.6 },                                  // F48 coast-hugging brightness multiplier
      uCityColor:         { value: new THREE.Color(0.95, 0.75, 0.3) },     // F48 warm sodium-amber night-city color (legacy Planet.js:920)
      // F49 ecumenopolis (Overlay/EXOTIC tri-part SATURATION overlay) — uEcuCoverage is the master gate
      // (pure lab knob: state.ecuCoverage when ecumenopolisEnabled, else 0); all others inert behind coverage 0
      uEcuCoverage:       { value: 0.0 },                                  // F49 master gate (0 ⇒ bare base — relief early-outs, albedo + glow guarded)
      uEcuConcreteColor:  { value: new THREE.Color(0.34, 0.34, 0.36) },    // F49 flat steel-concrete day-albedo target (legacy Planet.js:843-849 intent)
      uEcuGlowColor:      { value: new THREE.Color(0.95, 0.78, 0.45) },    // F49 warm-sodium whole-surface night glow color
      uEcuGlowIntensity:  { value: 1.0 },                                  // F49 night-glow brightness (emissive-bypass)
      uEcuDistrictScale:  { value: 2.4 },                                  // F49 low-freq district/coverage frequency
      uEcuBlockScale:     { value: 8.0 },                                  // F49 high-freq block/canyon frequency (lodRamp-ramped)
      uEcuCanyonDepth:    { value: 0.45 },                                 // F49 street-canyon relief depth banked onto grad
      uEcuSeamWidth:      { value: 0.07 },                                 // F49 Voronoi-border canyon half-width
      uEcuWarpAmt:        { value: 0.30 },                                 // F49 domain-warp amount (organic block network)
      uTime:           { value: 0.0 },   // animation clock (driven from frame())
      uLightDir:     { value: new THREE.Vector3().copy(WORLD_LIGHT) },
      uBaseColor:    { value: new THREE.Color(0.46, 0.40, 0.34) },  // rocky tone
      uMacroOffset:  { value: new THREE.Vector3() },                // set from macroSeed
      uDetailOffset: { value: new THREE.Vector3() },                // set from detailSeed
      // ── voronoi3d spike debug (risk #1 seam gate) ──
      uDebugMode:    { value: 0 },                                  // 0 off, 1 F1, 2 border, 3 cell-color, 4 relief, 5 blackbody, 6 substellar
      uVoroScale:    { value: 5.0 },                                // cell density
      uVoroCells:    { value: 27 },                                 // 27 desktop | 9 mobile (shared cellular knob, set by qualityTier)
      // ── F2 craters (Stage-C step 3, Relief) — first voronoi3d consumer ──
      uCraterDensity:    { value: 0.0 },   // cell-fill fraction (driven by deriveUniforms surface age)
      uCraterComplexD:   { value: 0.6 },   // simple→complex transition diameter (g⁻¹, driven)
      uCraterRelaxation: { value: 0.0 },   // icy/warm palimpsest flatten (driven)
      uTerraceCount:     { value: 4.0 },   // inner-wall terrace rings
      uCraterScale:      { value: 6.0 },   // crater cell density (lab-tunable)
      uCraterAmp:        { value: 0.9 },   // overall crater relief amplitude (lab-tunable)
      uCraterOffset:     { value: new THREE.Vector3() },   // 🎲 domain offset (default 0 = unchanged)
      // ── F3 ejecta & rays (Stage-C step 3, Relief) — wraps the F2 craters ──
      uEjectaStrength:   { value: 0.0 },   // apron gate (driven; tracks craterDensity; ≤0 early-outs)
      uEjectaRampart:    { value: 0.0 },   // 0=dry skirt ↔ 1=fluidized rampart (driven)
      uEjectaAmp:        { value: 0.35 },  // apron relief amplitude (lab-tunable)
      uEjectaLump:       { value: 0.6 },   // FBM lumpiness 0..1 (lab-tunable)
      uRayBrightness:    { value: 0.0 },   // bright-ray albedo gate (driven; airless × young)
      uRayCount:         { value: 6.0 },   // radial ray streak count (lab-tunable)
      uRaySharp:         { value: 8.0 },   // ray streak sharpness (lab-tunable)
      // ── F1 mountains (Stage-C step 3, Relief) — ridged base relief ──
      uMountainAmp:      { value: 0.0 },   // ridged amplitude (driven by deriveUniforms, erosion-softened)
      uRidgeOffset:      { value: 1.0 },   // fold offset (lab-tunable)
      uRidgeGain:        { value: 2.0 },   // multifractal weight gain (lab-tunable)
      uOrogenyStrength:  { value: 0.0 },   // isotropic ridged ↔ fold-belt (driven)
      uOrogenyAxis:      { value: new THREE.Vector2(1, 0) },  // strike direction (driven from angle)
      // ── WS4 tectonic grain fallback scaffolding (T3 / D6) ──
      // The shared-grain consumption path (T5/T13) wraps each grained `normalize(uXxxAxis)` in a
      // branch-guarded `mix(oldAxis, sampleGrainStrike(vPos), uTectonicGrainStrength)`. At strength 0
      // the ORIGINAL axis instruction stream runs verbatim (no cube fetch, no mix) → byte-identical
      // pre-WS4 render (grain-zero-identical). These defaults make that fallback the boot state:
      uTectonicGrainStrength: { value: 0.0 },   // 0 = grain OFF, byte-identical fallback (the gate)
      uTectonicGrainCube:     { value: null },  // baked strike-only HalfFloat cube (T7/T8); null until baked.
                                                // NEVER sampled at strength 0 — the combiner branch (D6)
                                                // short-circuits before any textureCube on the null cube.
      uMountainScale:    { value: 1.6 },   // mountain domain frequency (lab-tunable)
      uMountainDomainOffset: { value: new THREE.Vector3() },   // 🎲 domain offset (default 0 = unchanged)
      // ── F4 canyons / rifts (Stage-C step 3, Relief) — tectonic graben → canyonHeight ──
      uChasmaDepth:      { value: 0.0 },   // rift relief amplitude (driven; ≤0 early-outs)
      uChasmaCount:      { value: 1 },     // 1..3 rifts (driven from seed)
      uChasmaAxis:       { value: [new THREE.Vector3(1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,1)] },  // rift plane normals (driven from seed)
      uChasmaWidth:      { value: 0.12 },  // trench half-width (unit-sphere units, lab-tunable)
      uChasmaFloor:      { value: 0.4 },   // flat-floor fraction of half-width (lab-tunable)
      // ── F5 scarps / fault systems (Stage-C step 3, Relief) — warped soft-step cliffs ──
      uScarpStrength:    { value: 0.0 },   // fault-scarp relief amplitude (driven; ≤0 early-outs)
      uScarpStyle:       { value: 0.0 },   // 0=thrust(up)↔1=normal(down) (driven)
      uScarpAxis:        { value: new THREE.Vector3(0, 1, 0) },  // scarp-front axis (driven from seed)
      uScarpWidth:       { value: 0.3 },   // cliff-face softness (field units, lab-tunable)
      uScarpFreq:        { value: 6.0 },   // parallel-scarp train frequency (lab-tunable)
      uScarpWarp:        { value: 0.5 },   // front sinuosity (lab-tunable)
      uScarpWarpFreq:    { value: 2.0 },   // warp-noise domain frequency (lab-tunable)
      uScarpDomainOffset: { value: new THREE.Vector3() },   // 🎲 domain offset (default 0 = unchanged)
      // ── F6 plateaus / highlands (Stage-C step 3, Relief) — HeteroTerrain + mesa terrace ──
      uPlateauStrength:  { value: 0.0 },   // flat-topped highland amplitude (driven; ≤0 early-outs)
      uPlateauScale:     { value: 1.2 },   // HeteroTerrain domain frequency (lab-tunable)
      uPlateauOffset:    { value: 0.5 },   // ground-level stratification bias (lab-tunable)
      uPlateauLevels:    { value: 4.0 },   // mesa terrace count (lab-tunable)
      uPlateauSoftness:  { value: 0.4 },   // terrace riser softness (lab-tunable)
      uPlateauDomainOffset: { value: new THREE.Vector3() },   // 🎲 domain offset (default 0 = unchanged)
      uTesseraStrength:  { value: 0.0 },   // crosscutting-lattice amplitude (driven; ≤0 early-outs)
      uTesseraAxis:      { value: [new THREE.Vector3(1,0,0), new THREE.Vector3(0,1,0)] },  // 2 lattice orientations (driven from seed)
      uTesseraFreq:      { value: 5.0 },   // groove-train frequency / lattice density (lab-tunable)
      uTesseraWarp:      { value: 0.5 },   // groove-line sinuosity (lab-tunable)
      uTesseraWarpFreq:  { value: 2.0 },   // warp-noise domain frequency (lab-tunable)
      uTesseraDomainOffset: { value: new THREE.Vector3() },   // 🎲 domain offset (default 0 = unchanged)
      // ── F7 volcanic edifices (Stage-C step 3, Relief) — shield/strato cones + caldera ──
      uVolcanismStrength: { value: 0.0 },  // edifice density gate (driven; ≤0 early-outs)
      uEdificeMaxHeight:  { value: 1.0 },  // height scale ∝ 1/g (driven, 0.2..2.0)
      uShieldStratoMix:   { value: 0.0 },  // 0=shield ↔ 1=strato (driven, viscosity)
      uEdificeScale:      { value: 3.0 },  // edifice cell density — lab-tunable (sparser than craters)
      uEdificeAmp:        { value: 0.2 },  // overall edifice relief amplitude (lab-tunable)
      uEdificeCaldera:    { value: 0.12 }, // summit caldera radius fraction (lab-tunable)
      uEdificeOffset:     { value: new THREE.Vector3() },   // 🎲 domain offset (default 0 = unchanged)
      // ── F8 lava plains & flows (Stage-C step 3, Relief) ──
      uLavaCoverage:   { value: 0.0 },   // flood-basalt resurfacing fraction (driven; ≤0 early-outs)
      uLavaActivity:   { value: 0.0 },   // emissive-crack glow intensity (driven, D12 tidal)
      uLavaAxis:       { value: new THREE.Vector3(0, 1, 0) },  // wrinkle-ridge strike (driven, seed-derived)
      uLavaScale:      { value: 1.4 },   // flow-region noise scale — lab-tunable
      uLavaOffset:     { value: new THREE.Vector3() },        // 🎲 domain offset (default 0 = unchanged)
      uWrinkleAmp:     { value: 0.06 },  // wrinkle-ridge relief amplitude — lab-tunable
      uWrinkleFreq:    { value: 14.0 },  // wrinkle-ridge spatial frequency — lab-tunable
      uWrinkleWarp:    { value: 0.4 },   // wrinkle-ridge sinuosity (domain warp) — lab-tunable
      uCrackScale:     { value: 9.0 },   // emissive-crack Voronoi cell density — lab-tunable
      uCrackWidth:     { value: 0.08 },  // emissive-crack mask width — lab-tunable
      uLavaGlowRate:   { value: 1.5 },   // emissive-crack pulse rate (× uTime) — lab-tunable
      // ── F9 chaos / disrupted terrain (Stage-C step 3, Relief) — reads shared uCryoActivity ──
      uChaosCellScale:   { value: 5.0 },   // raft size (voronoi3d frequency, driven)
      uChaosRaftJitter:  { value: 0.5 },   // raft height/tilt displacement (driven, ∝ 1/g)
      uChaosMatrixRough: { value: 0.5 },   // refrozen inter-raft matrix roughness (driven)
      uChaosMaskScale:   { value: 1.1 },   // low-freq chaos-region mask scale — lab-tunable
      uChaosOffset:      { value: new THREE.Vector3() },   // 🎲 domain offset
      // ── F10 ridged / grooved icy terrain (Stage-C step 3, Relief) — reads shared uCryoActivity ──
      uDoubleRidgeFreq:  { value: 3.0 },   // double-ridge line frequency (driven)
      uCryoRidgeOffset:  { value: 0.45 },  // double-ridge flank position → doubleRidgeProfile (driven)
      uCryoRidgeWidth:   { value: 0.18 },  // double-ridge crest sharpness → doubleRidgeProfile (driven)
      uGroovedBandFreq:  { value: 14.0 },  // fine grooved-band ridge frequency (driven, Ganymede)
      uCryoRidgeAmp:     { value: 0.12 },  // overall icy-ridge relief amplitude — lab-tunable
      uCryoRidgeWarp:    { value: 0.3 },   // ridge-line sinuosity (domain warp) — lab-tunable
      uCryoRidgeAxis0:   { value: new THREE.Vector3(1, 0, 0) },   // double-ridge line direction (driven)
      uCryoRidgeAxis1:   { value: new THREE.Vector3(0, 1, 0) },   // grooved-band direction (driven)
      uCryoRidgeOffsetV: { value: new THREE.Vector3() },   // 🎲 domain offset
      // ── Cryo step 2: frost-coverage mask (F23/F22) — albedo overlay, not relief ──
      uFrostMaxCoverage: { value: 0.0 },   // frost budget (driven, D2; ≤0 early-outs)
      uFrostCondensationT: { value: 0.0 }, // per-species freeze point K (driven; 0=no frost)
      uFrostLatitudeBias:{ value: 0.0 },   // axial-tilt low-latitude spread (driven, D3)
      uFrostAlbedo:      { value: new THREE.Color(0.93, 0.94, 0.96) },  // frost tint (driven by species)
      uPlanetTempEq:     { value: 280.0 }, // T_eq baseline for localT (driven)
      uFrostLocked:      { value: 0 },     // 1 = tidally-locked eyeball cap (driven)
      uFrostLatChill:    { value: 0.35 },  // equator→pole temp falloff fraction — lab knob
      uFrostLapseRate:   { value: 0.3 },   // altitude snowline weight — lab knob
      uFrostEdgeSoftness:{ value: 0.08 },  // sharp↔diffuse snowline (× T_eq = K band) — lab knob
      uFrostNoiseAmp:    { value: 0.06 },  // boundary breakup amplitude (× T_eq, K) — lab knob
      uFrostNoiseScale:  { value: 3.0 },   // boundary breakup noise frequency — lab knob
      uFrostOffset:      { value: new THREE.Vector3() },   // 🎲 domain offset
      // ── Cryo step 3: F22 polar-layered-deposit strata (cap banding) ──
      uPldStrength:      { value: 0.0 },   // dark-band luminance dip (driven; ≤0 ⇒ no banding)
      uPldLevels:        { value: 6.0 },   // annular strata band count (driven constant; lab-tunable)
      uPldSoftness:      { value: 0.4 },   // riser softness between layers — lab knob

      // ── Cryo step 4: F18 sublimation landscapes (RELIEF, species-switched) ──
      uSubStrength:      { value: 0.0 },   // sublimation-relief gate (driven; ≤0 ⇒ early-out)
      uVolatileSpecies:  { value: 0 },     // morphology switch (driven int: 0 none/1 H₂O/2 CO₂/3 CH₄/4 N₂)
      uSubAmp:           { value: 0.10 },  // sublimation relief amplitude — lab knob
      uSubPitScale:      { value: 8.0 },   // swiss-cheese / hollow pit voronoi freq — lab knob
      uSubPolyScale:     { value: 4.0 },   // N₂ convection-polygon cell freq — lab knob
      uSubFloorFrac:     { value: 0.45 },  // flat-floor fraction of the pit radius — lab knob
      uSubPitDensity:    { value: 0.7 },   // fraction of cells hosting a pit — lab knob
      uBladeFreq:        { value: 18.0 },  // CH₄ penitente blade freq (anisotropic) — lab knob
      uBladeSharp:       { value: 3.0 },   // CH₄ penitente blade sharpness (pow) — lab knob
      uSubColdGate:      { value: 0.15 },  // cold-cap confinement threshold — lab knob
      uSubOffset:        { value: new THREE.Vector3() },   // 🎲 domain offset
      // ── Cryo step 5: F17 glacial relief — ice mantle + flow lineations ──
      uGlacialStrength:  { value: 0.0 },   // glacial-relief gate (driven; ≤0 ⇒ early-out)
      uGlacialFlowVigor: { value: 0.5 },   // flow-lineation amplitude scale ∝ 1/g (driven)
      uGlacialAmp:       { value: 0.06 },  // ice-mantle height amplitude — lab knob
      uGlacialScale:     { value: 1.6 },   // ice-mantle slope-damped FBM freq — lab knob
      uGlacialSlopeDamp: { value: 8.0 },   // slope-damping strength — lab knob
      uGlacialBasinThresh:{ value: 0.15 }, // surface-slope basin gate (ice flows off steeper) — lab knob
      uLineationAmp:     { value: 0.05 },  // moraine/esker lineation amplitude — lab knob
      uLineationFreq:    { value: 30.0 },  // lineation ridge spacing (flow-aligned) — lab knob
      uLineationWarp:    { value: 0.25 },  // lineation directional-field warp — lab knob
      uLineationWarpFreq:{ value: 2.5 },   // lineation warp frequency — lab knob
      uGlacialColdGate:  { value: 0.15 },  // cold-cap confinement threshold (like uSubColdGate) — lab knob
      uGlacialOffset:    { value: new THREE.Vector3() },   // 🎲 domain offset
      // ── F11 fluvial drainage — shape defaults proven in fluvial-drainage-lab.html ──
      uFluvialActivity: { value: 1.0 },
      uFluvialDensity:  { value: 0.0 },   // off until applyDrivers/state drives it
      uFluvialDepth:    { value: 0.12 },
      uFluvialMeander:  { value: 0.5 },
      uFluvialWidth:    { value: 0.10 },  // proven spike defaults ↓
      uFluvialFreq:     { value: 2.3 },
      uFluvialWarpAmt:  { value: 0.4 },
      uFluvialWarpFreq: { value: 1.5 },
      uFluvialTribLac:  { value: 2.6 },
      uFluvialTribGate: { value: 0.35 },  // apron half-width (> uFluvialWidth)
      uFluvialLowBias:  { value: 0.5 },
      uFluvialHiGround: { value: 0.15 },
      uFluvialOffset:   { value: new THREE.Vector3() },
      // ── Canonical shared registry (integration-index §1) — RESERVED NAMES ──
      // The cross-domain shared semantic uniforms. Declared here (the central
      // registry) at default-off so the 8 Stage-C domains read ONE agreed name
      // instead of inventing their own. The OWNER domain wires its derivation
      // (step 2, generation-side surfacings) + GLSL declaration when it lands;
      // until then they sit at default. Full contract: research/stage-c/
      // REGISTRY-canonical-uniforms.md. (vSubstellarAngle = varying, above;
      // emissiveBlackbody/voronoi3d = shader helpers; latBias/storm arrays =
      // per-domain, declared by their owner — see the registry doc.)
      uLiquidStability: { value: 0.0 },   // 0..1 liquid on/off gate    — owner Fluvial; read by Aeolian/Cryo/Optical
      uLiquidMask:      { value: 0.0 },   // liquid-body coverage scalar — owner Fluvial (F14 applyDrivers writes seaCoverage). NOTE (F36, 2026-06-10): the sunglint consumes the SPATIAL Stage-4 liquidMask in-shader (the same sea cut F14 renders), not this whole-planet scalar — the Fluvial-to-Optical contract is fulfilled per-fragment; this registry scalar stays value-only.
      uSeaLevel:        { value: -1.0 },  // F14 standing-liquid level-set threshold; -1 = no liquid (driven: stability gate + coverage)
      uDeltaDensity:    { value: 0.0 },   // F12 deposition gate (driven: fluvialDensity × activity); <= 0 early-outs
      uDeltaAmp:        { value: 0.06 },  // F12 apron amplitude — lab knob
      uDeltaApronH:     { value: 0.12 },  // F12 apron band height above base level — lab knob
      uCoastStrength:   { value: 0.0 },   // F20 master gate (driven: 1 when a sea exists); <= 0 ⇒ early-out
      uBeachWidth:      { value: 0.04 },  // F20 beach band width in shore-distance units — lab knob
      uCoastCliffSlope: { value: 1.2 },   // F20 |grad| above which the shore reads as cliff — lab knob
      uTerraceStep:     { value: 0.06 },  // F20 strandline spacing in shore-distance units — lab knob
      uStrandStrength:  { value: 0.0 },   // F20 paleo-strandline visibility (driven: erosion history)
      uOutflowDensity:  { value: 0.0 },   // F13 master gate (driven: fluvial history × erosion threshold); <= 0 early-outs
      uOutflowActivity: { value: 1.0 },   // F13 relict↔active (driven; relict = shallower + degraded banks)
      uOutflowWidth:    { value: 0.35 },  // F13 trunk band half-width (field units; w/ freq 0.7 ≈ 10× F11 spatial width) — lab knob
      uOutflowDepth:    { value: 0.18 },  // F13 scour carve depth — lab knob
      uOutflowFreq:     { value: 0.7 },   // F13 trunk frequency (continental: well below F11's 2.3) — lab knob
      uOutflowWarpAmt:  { value: 0.15 },  // F13 warp displacement (low — floods run straight) — lab knob
      uOutflowIslands:  { value: 0.7 },   // F13 streamlined-island strength — lab knob
      uOutflowGrooveFreq:{ value: 24.0 }, // F13 longitudinal groove frequency — lab knob
      uOutflowGrooves:  { value: 0.10 },  // F13 groove amplitude (fraction of carve depth; capped 0.15) — lab knob
      uOutflowOffset:   { value: new THREE.Vector3() },   // 🎲 domain offset (GLSL adds a constant decorrelation vec)
      uKarstDensity:    { value: 0.0 },   // F21 master gate (driven: F11 solvent gate, erosion-weighted); <= 0 early-outs
      uKarstMaturity:   { value: 0.5 },   // F21 dissection maturity (driven ∝ surfaceHistory.erosion)
      uKarstDolineFreq: { value: 9.0 },   // F21 doline Worley-cell frequency — lab knob
      uKarstDolineR:    { value: 0.28 },  // F21 pit radius in F1 units (well under cell size 1.0 ⇒ discrete pits) — lab knob
      uKarstDolineDepth:{ value: 0.12 },  // F21 doline carve depth — lab knob
      uKarstMazeFreq:   { value: 6.0 },   // F21 labyrinth slot frequency (own, NOT F1's) — lab knob
      uKarstMazeDepth:  { value: 0.18 },  // F21 labyrinth slot carve depth — lab knob
      uKarstPlateauLvl: { value: 0.22 },  // F21 plateau mask threshold on accumulated h — lab knob
      uKarstOffset:     { value: new THREE.Vector3() },   // 🎲 domain offset (GLSL adds a constant decorrelation vec)
      uDuneDensity:     { value: 0.0 },   // F15 master gate (driven: D6/D5 wind gate × dryness); <= 0 early-outs
      uDuneAmp:         { value: 0.06 },  // F15 ridge amplitude (deposit; well under fluvialDepth ~0.12) — lab knob
      uDuneFreq:        { value: 16.0 },  // F15 ridge frequency (wavelength 1/16 pos.y ≈ 6 buffer px at d4, pixelScale 3) — lab knob
      uDuneWarp:        { value: 2.0 },   // F15 phase-warp amplitude (ridge threading) — lab knob
      uDuneBelt:        { value: 0.5 },   // F15 equatorial-belt confinement — lab knob
      uDuneOffset:      { value: new THREE.Vector3() },   // 🎲 domain offset (GLSL adds a constant decorrelation vec)
      uDustDepth:       { value: 0.0 },   // F16 master continuum (driven: press ramp × dryness × erosion); <= 0 early-outs
      uDustRegionFreq:  { value: 1.3 },   // F16 settling-region noise scale (lava's 1.4-class continental patches) — lab knob
      uDustFlatK:       { value: 1.0 },   // F16 slope-damp k (the research doc's literal 1/(1+|grad|²) trick) — lab knob
      uDustTint:        { value: 0.35 },  // F16 butterscotch veil strength (Stage-8 muting) — lab knob
      uDustOffset:      { value: new THREE.Vector3() },   // 🎲 domain offset (GLSL adds a constant decorrelation vec)
      uMassWastDensity: { value: 0.0 },   // F19 master gate (driven: 1.0 on every solid world, airless included); <= 0 early-outs
      uRepose:          { value: 0.95 },  // F19 angle-of-repose threshold in |grad| units (driven ∝ g^-0.4)
      uTalusAmp:        { value: 0.08 },  // F19 talus-apron fill amplitude — lab knob
      uLdaFat:          { value: 0.0 },   // F19 lobate-debris-apron fattening (driven: ground ice = volatiles × cold)
      uLobeAmp:         { value: 0.06 },  // F19 landslide-tongue amplitude — lab knob
      uLobeFreq:        { value: 6.0 },   // F19 tongue seed frequency — lab knob
      uMassWastOffset:  { value: new THREE.Vector3() },   // 🎲 domain offset (GLSL adds a constant decorrelation vec)
      uBandStrength:    { value: 0.0 },   // F24 master gate (driven: 1 on h2-he gas worlds, 0 on solid); <= 0 ⇒ no-op
      uBandCount:       { value: 8.0 },   // F24 visible stripe count (driven: 12·R/rotationHours, clamped 3..16)
      uBandContrast:    { value: 0.6 },   // F24 zone↔belt luminance separation (driven: T_eq convective-vigor ramp)
      uBandWarp:        { value: 1.8 },   // F24 festoon displacement in stripe units (driven: same vigor ramp)
      uBandTint:        { value: new THREE.Color(0.78, 0.62, 0.44) },  // F24 deck base color (driven: atmosphere.color)
      uBandStretch:     { value: 2.5 },   // F24 vertical domain compression (streaks the warp along latitude) — lab knob
      uBandLatPow:      { value: 1.3 },   // F24 latitude remap exponent (wide equatorial, narrow polar bands) — lab knob
      uBandOffset:      { value: new THREE.Vector3() },   // 🎲 domain offset (GLSL adds it to the warp domain)
      uBandRough:       { value: 1.0 },   // atmo-expression slice J: per-seed global band-edge roughness (drawBandRoughness/bandFlow:rough; GUI 0..2, touched-flag override) — CANDIDATE default 1.0 (ROUGH_MEAN)
      uJetStrength:     { value: 0.0 },   // F25 master gate (driven: 1 on h2-he gas worlds, 0 on solid); 0 ⇒ byte-identical F24
      uJetSpeed:        { value: 0.8 },   // F25 drift amplitude, rad per flow phase (driven: 8/rotationHours, clamped 0.2..1.2)
      uJetShearTurb:    { value: 0.25 },  // F25 boundary-turbulence amplitude in stripe units (driven: T_eq vigor ramp)
      uJetFestoon:      { value: 0.3 },   // F25 one-sided equatorial hook amplitude in stripe units (driven: same ramp)
      uJetTurbFreq:     { value: 3.0 },   // F25 turbulence fbm frequency multiplier vs the band warp — lab knob
      uJetEqWidth:      { value: 0.25 },  // F25 equatorial superrotation Gaussian half-width (trueLat units) — lab knob
      uJetOffset:       { value: new THREE.Vector3() },   // 🎲 domain offset (GLSL adds it to the turbulence domain)
      uWeatherStrength: { value: 0.0 },   // F26 master gate (driven: not-gas AND retained, x rain factor); 0 ⇒ byte-identical clouds
      uWeatherCells:    { value: 3.0 },   // F26 circulation cell count (driven: 72/rotationHours, clamped 1..6; Earth 24 h = 3)
      uWeatherItczShift:{ value: 0.0 },   // F26 ITCZ equator shift in |lat| units (driven: frostLatitudeBias x 0.25)
      uWeatherLocked:   { value: 0.0 },   // F26 eyeball coordinate switch (driven: tidally locked AND retained)
      uWeatherWarp:     { value: 0.3 },   // F26 front-shredding latitude-warp amplitude — lab knob
      uWeatherDry:      { value: 0.15 },  // F26 subtropical-trough drying inside the cloud threshold — lab knob
      uWeatherOffset:   { value: new THREE.Vector3() },   // 🎲 domain offset (GLSL adds it to the warp domain)
      // ── F27 storm carriage (registry REGISTRY-canonical-uniforms.md storm row, lab-sized) ──
      // Flat arrays cap 8 (the shadowMoonPos pattern); F27 drives index 0, F28 extends
      // the count. uStormCount 0 ⇒ every storm term no-ops (byte-identical F25 render).
      uStormPosSize:    { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },  // xyz center, w angular radius (rad)
      uStormParams:     { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },  // x rotStrength, y aspect, z mode, w companion
      uStormColor:      { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },  // core color (driven: bandTint warmed/bruised)
      uStormCount:      { value: 0 },     // live storm count (driven: gas gate x greatSpotEnabled)
      // ── F29 polar vortex (card F29 §6.5) — analytic pole combiner, NO carriage slots ──
      // Lattice centers derive in-shader from angle rounding (zero arrays). uPolarStrength
      // 0 ⇒ the GLSL call is skipped entirely (byte-identical F28 render).
      uPolarStrength:   { value: 0.0 },   // F29 master gate (driven: 1 on h2-he gas presets, 0 on solid); 0 ⇒ combiner skipped
      uPolarMode:       { value: 0.0 },   // F29 variant: 0 single cap / 1 polygon jet / 2 cyclone lattice (driven: T_eq vigor)
      uPolarSides:      { value: 6.0 },   // F29 polygon wavenumber N (driven: 5..8 hash, re-draw biased toward Saturn's 6)
      uPolarR0:         { value: 0.22 },  // F29 jet / lattice-ring angular radius rad (driven: 0.18 + 0.08 x hash)
      uPolarAmp:        { value: 0.12 },  // F29 polygon meander amplitude — lab knob (0.26 x 1.12 = 0.29 stays inside the 0.38 gate)
      uPolarPole:       { value: 1.0 },   // F29 active pole sign +1 north / -1 south (driven: hash)
      uPolarRing:       { value: 5.0 },   // F29 lattice ring cyclone count M (driven: 5..8 hash)
      uPolarPhase:      { value: 0.0 },   // F29 single-cap S-lobe orientation rad (driven: hash)
      uPolarW:          { value: 0.025 }, // F29 polygon collar half-width rad — lab knob
      uPolarTint:       { value: new THREE.Color(0.35, 0.45, 0.65) },  // F29 cap tint (driven: bandTint shifted cool/teal)
      // ── F30 lightning (card F30 §6.5) — ★ emissive-channel point process ──
      // uLightningStrength 0 ⇒ the GLSL call is skipped entirely (byte-identical F29 render).
      uLightningStrength:{ value: 0.0 },  // F30 master gate (driven: 1 on gas, rain factor on solid wet worlds); 0 ⇒ term skipped
      uLightPolar:      { value: 0.0 },   // F30 latitude regime 0 equatorial ITCZ / 1 Juno polar (driven: gas gate)
      uLightRate:       { value: 0.5 },   // F30 base flash rate cycles/s before per-cell jitter — lab knob
      uLightDur:        { value: 0.18 },  // F30 flash window fraction of the cell cycle — lab knob
      uLightCellFreq:   { value: 14.0 },  // F30 flash cell grid frequency — lab knob
      uLightBlobR:      { value: 0.022 }, // F30 flash blob angular radius rad — lab knob (≤ half-cell at freq 14 so the Gaussian, not the cell window, shapes the blob)
      // ── F31 clouds family (card F31 §6.5) — regime-dispatched Stage-8 combiner ──
      // uCloudCoverage (declared above, Task 7) is the family MASTER GATE: the
      // per-frame writer forces it 0 when cloudsEnabled is off ⇒ deck + every
      // regime term fully absent (the always-on Task-7 deck is now ownable).
      uCloudRegime:     { value: 0 },     // F31 regime 0 weather / 2 haze mute / 3 venus blanket / 4 eyeball (driven; 1 reserved — gas tops ARE F24-F29)
      uCloudRelief:     { value: 0.35 },  // F31a clouds-as-relief self-shade strength — lab knob (tilts the cloud term's diffuse with the fbmd gradient)
      uHazeMute:        { value: 0.0 },   // F31c pre-posterize contrast kill toward uHazeColor (driven: 0.85 on sub-neptune haze, else 0)
      uHazeColor:       { value: new THREE.Color(0.70, 0.65, 0.58) },  // F31 haze/blanket tone (driven: preset atmosphere color)
      uChevronStrength: { value: 0.18 },  // F31d Y/V chevron darkening — lab knob (~0.17 = one 6-level posterize bucket)
      uPupilR:          { value: 0.6 },   // F31f substellar cap half-angle rad — lab knob
      // ── F32/F33 thermal day/night (cards §6.5 — ONE temperature curve, two consumers) ──
      // uThermalStrength 0 ⇒ the GLSL block is skipped entirely (byte-identical F31 render).
      uThermalStrength: { value: 0.0 },   // F32/F33 master gate (driven: 1 on hot-jupiter, else 0 — the regression contract)
      uThermalDir:      { value: new THREE.Vector3().copy(WORLD_LIGHT) },  // uLightDir rotated east by the hotspot offset (per-frame writer)
      uDayTempK:        { value: 0.0 },   // F32 dayside peak K (driven: T_eq x 1.15; writer collapses it to the floor when F32 off)
      uNightTempK:      { value: 0.0 },   // F33 nightside floor K (driven: 1100 on hot-jupiter; writer zeroes it when F33 off)
      uRedistribution:  { value: 3.0 },   // F32 day-to-night falloff exponent — lab knob (3 = legacy pow(starFacing,3) heritage)
      uThermalOcclusion:{ value: 0.6 },   // F33 silicate-cloud occlusion strength — lab knob (writer zeroes it when F33 off)
      uLiquidSpecies:   { value: 0 },     // enum 0=water 1=methane/ethane — owner Fluvial; read by Optical (glint IOR/tint)
      uCryoActivity:    { value: 0.0 },   // 0..1 icy-resurfacing activity — owner Cryo; read by Relief (F9/F10 chaos/ridged)
      // ── Stage-D provinces (index §4 #8 / §8) — LIVE 2026-06-10 (workstream stage-d-provinces) ──
      // The spatial weight field landed: provinceWeight(FEATURE_ID) reads 3 low-freq fields
      // (gProvince) against per-feature affinities mirrored from planet-archetypes.js PROVINCES.
      // uProvinceWeight is the global influence dial (multiplier, NOT a 0.0 gate): 0 restores the
      // legacy uniform look (regression escape hatch), 1 = full provinces. Combiner signatures
      // unchanged — exactly the swap the 2026-06-07 reservation was bought for.
      uProvinceWeight:  { value: 1.0 },   // Stage-D LIVE 2026-06-10: global province-influence dial (0=legacy uniform look, 1=full provinces); read by ALL combiners via provinceWeight(FEATURE_ID)
  };
}
