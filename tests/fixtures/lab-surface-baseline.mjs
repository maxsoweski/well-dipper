// tests/fixtures/lab-surface-baseline.mjs
//
// THE SHRINK-ONLY RATCHET'S BASELINE — PLAN §4 "Step 5", part 5f.
//
// Three committed SETS, measured from world-engine-lab.html by the harness in
// tests/lab-surface-ratchet.test.js and by nothing else:
//
//   APPLY_DRIVERS_STATE_FIELDS — every `state.<field>` that `function applyDrivers(){` ASSIGNS,
//                                INCLUDING the ones it writes in bulk through
//                                `Object.assign(state, …)` — see the RE-BASELINE block below
//   FRAME_UNIFORMS            — every `<bag>.uniforms.<name>` that `function frame(){` MENTIONS
//   APPLY_DRIVERS_UNIFORMS    — the same, MENTIONED inside `function applyDrivers(){`
//
// The ratchet fails when any of the three GROWS. Shrinking is always legal and is the whole
// point: Step 5c deletes the gas-deck block out of `applyDrivers` and hands it to a pack, so
// this baseline is expected to LOSE entries as the plan lands. Adding an entry is a deliberate
// act — the fixture entry is added here in the same commit that adds the code, with a reason.
//
// ⭐ WHY THERE IS A THIRD SET, WHICH 5f's TEXT DOES NOT NAME. 5f names two regions:
// `applyDrivers`'s state writes and `frame()`'s uniforms. Measured against the file, those two
// leave a live hole: `applyDrivers` writes EIGHT uniforms directly, and SEVEN of the eight —
// uChasmaAxis, uLiquidMask, uLiquidSpecies, uLiquidStability, uScarpAxis, uTesseraAxis,
// uVoroCells — are never mentioned in `frame()` at all. So a new feature written the way seven
// existing features are already written appears in NEITHER named set. Under PLAN §11.9 that is
// the blocking kind of bypass, not the excusable kind: it is not adversarial, it is the file's
// own idiom, eight times over, inside the very function being watched. The set is pinned rather
// than the hole recorded.
//
// ⭐ WHY THESE ARE SETS AND NOT COUNTS. Step 4's re-bless pinned population COUNTS, and a
// count-preserving permutation then passed every instrument byte-identically. A rename
// (`surfaceGravity` → `gravityAtSurface`) holds the count at 147 and is exactly the authoring
// move this ratchet exists to notice, so identity is by NAME and a rename reds as an addition.
// The counts written below are consequences of the lists, never the pin.
//
// ⛔ DO NOT COPY A NUMBER FROM A DOCUMENT INTO THIS FILE. PLAN §4 5f records the measurement as
// unstable between passes — "146/147 state fields, 327/328 uniforms". Both halves were
// re-measured here, twice, over five sources (working tree, HEAD 4e864bc, 0526aad, 0af246e, and
// mutated copies):
//
//   • state fields   147 — STABLE. Identical on every source and on both passes. 146 did NOT
//     reproduce under any of six scan rules (the test's RULE VARIANTS block lists them with the
//     number each returns). `applyDrivers` contains no compound assignment and no increment, so
//     the rules that could differ by one cannot. 146 is recorded as UNEXPLAINED, and it does not
//     matter: membership is the pin and the count is printed only as a consequence of the list.
//   • frame uniforms 327 distinct NAMES / 329 bag-qualified entries. The document's 328 IS
//     reproducible and IS a scan artifact: with comments left in, the substring "uniforms.js" of
//     world-engine-lab.html:4911 `// uDispDomainScale here. It keeps its 1.0 initializer (planet-lod-uniforms.js:17) forever,`
//     matches as a uniform named `js` — a phantom named after a filename. The harness strips
//     comments and string literals before scanning. That ±1 was never a measurement.
//
// ⭐ THE ENTRY SHAPE IS `<bag-expression>.uniforms::<name>`, bag-qualified on purpose. `uTime`
// and `uLightDir` are each written to TWO different materials inside `frame()` — the planet's
// bare `uniforms` bag and `ringCloud.material.uniforms` — so a name-only set would silently
// merge two different uniforms, and a feature routed through a new material bag would be
// invisible. 329 entries = 325 bare + 4 on the ring cloud, of which 2 collide by name.
//
// ⭐⭐ RE-BASELINE 2026-08-09 — SET 1 WENT 147 → 148, AND THE INTERESTING NUMBER IS NOT THE 1
//
// The previous baseline was captured while the harness was BLIND to bulk writes. Step 5 introduced
// world-engine-lab.html:2301 `Object.assign(state, giantDeckLabState(_deck));`, and a lexical scan for
// `state.<field> =` cannot see a single field behind it. The harness now resolves that call through
// the import to src/worldengine/drivers/giantDeck.js and reads the field set out of the
// `LAB_STATE_BINDING` table it loops over. What that arm turned up, measured on the working tree:
//
//   139  state fields the harness could see WITHOUT the arm (what it was really gating, today)
//   +9   fields recovered from `Object.assign(state, giantDeckLabState(_deck))` — the VALUES of
//        `LAB_STATE_BINDING` in giantDeck.js:101: bandStrength, bandContrast, bandWarp, bandTint,
//        bandRough, jetStrength, jetSpeed, jetShearTurb, jetFestoon
//   148  the true surface
//
// Of those 9, EIGHT were already in the committed list — Step 5c deleted their direct
// `state.band*/state.jet* =` lines and moved them behind the bulk write, and the blind ratchet read
// that as a legal SHRINK. It was congratulating itself on a set that had merely walked out of shot.
// The NINTH, `bandRough`, was never in the list at all: it is new surface that arrived with the pack
// and was gated by nothing from the day it landed. That single name is the whole measured cost of
// the blind spot, and it is why 148 is a MEASUREMENT and not an adjustment. A baseline captured
// blind is a baseline calibrated on a lie; this one was re-derived by the arm, not nudged to green.
//
// Sets 2 and 3 are unchanged at 329 and 8 — the lab contains exactly one `Object.assign`, and it
// targets `state`. A bulk write into a uniform bag would be refused rather than measured; see
// `bulkStateFieldsIn` in the test.
//
// Measured at commit 4e864bc (world-engine-lab.html clean in the working tree) on 2026-08-09, with
// applyDrivers at lines 1933-2734 and frame at 4827-5520. Those extents are NOT pinned — the
// harness re-locates both functions by name on every run, because Step 5c moves them.

export const MEASURED_AT = {
  commit: '4e864bc',
  source: 'world-engine-lab.html',
  // The bulk arm reads a SECOND file. Recorded so a reader knows the baseline has two inputs.
  bulkSource: 'src/worldengine/drivers/giantDeck.js (LAB_STATE_BINDING)',
  date: '2026-08-09',
  // Recorded for the report only. The harness never reads these.
  applyDriversExtent: [1933, 2734],
  frameExtent: [4827, 5520],
};

// ── Set 1: state.<field> written by applyDrivers() ───────────────────────────
export const APPLY_DRIVERS_STATE_FIELDS = [
  '_craterAmpBase',
  '_craterDensityBase',
  '_derived',
  '_lastPreset',
  '_radiusDirty',
  'airglowIntensity',
  'auroraColor',
  'auroraIntensity',
  'auroraRingLat',
  'auroraRingWidth',
  'bandContrast',
  'bandCount',
  'bandOffset',
  // ⭐ RE-BASELINE 2026-08-09, and the ONE genuinely new name in it. `bandRough` reaches `state`
  // ONLY through world-engine-lab.html:2301 `Object.assign(state, giantDeckLabState(_deck));`, so the
  // pre-arm harness never saw it: it landed with Step 5c and was ungated from the day it arrived.
  // Measured, not adjusted-until-green — see the RE-BASELINE block in this file's header.
  'bandRough',
  'bandStrength',
  'bandTint',
  'bandWarp',
  'carbonRatio',
  'chaosCellScale',
  'chaosMatrixRough',
  'chaosOffset',
  'chaosRaftJitter',
  'chasmaAxes',
  'chasmaCount',
  'chasmaDepth',
  'cloudCoverage',
  'cloudRegime',
  'coastStrength',
  'craterComplexD',
  'craterDensity',
  'craterOffset',
  'craterRelaxation',
  'cryoActivity',
  'cryoRidgeAxis0',
  'cryoRidgeAxis1',
  'cryoRidgeOffset',
  'cryoRidgeOffsetV',
  'cryoRidgeWidth',
  'dayTempK',
  'daysideThermalEnabled',
  'deltaDensity',
  'doubleRidgeFreq',
  'drawnPreset',
  'duneDensity',
  'duneOffset',
  'dustActivity',
  'dustColor',
  'dustDepth',
  'dustOffset',
  'edificeMaxHeight',
  'edificeOffset',
  'ejectaRampart',
  'ejectaStrength',
  'emissive',
  'facetStrength',
  'featureRelevant',
  'fluvialActivity',
  'fluvialDensity',
  'fluvialDepth',
  'fluvialMeander',
  'fluvialOffset',
  'frostAlbedo',
  'frostCondensationT',
  'frostLatitudeBias',
  'frostLocked',
  'frostMaxCoverage',
  'frostOffset',
  'glacialFlowVigor',
  'glacialOffset',
  'glacialStrength',
  'glintBaseExp',
  'glintRoughness',
  'glintTint',
  'groovedBandFreq',
  'habGate',
  'habitability',
  'hazeColor',
  'hazeMute',
  'isExoticCarbonOrGeometric',
  'jetFestoon',
  'jetOffset',
  'jetShearTurb',
  'jetSpeed',
  'jetStrength',
  'karstDensity',
  'karstMaturity',
  'karstOffset',
  'lavaActivity',
  'lavaAxis',
  'lavaCoverage',
  'lavaOffset',
  'ldaFat',
  'lightPolar',
  'lightningStrength',
  'limbColor',
  'limbExponent',
  'limbHazeShell',
  'limbStrength',
  'magAxis',
  'magmaSeaAngle',
  'magmaTemp',
  'massWastDensity',
  'massWastOffset',
  'mountainAmp',
  'mountainDomainOffset',
  'nightTempK',
  'nightsideThermalEnabled',
  'orogenyAngle',
  'orogenyStrength',
  'outflowActivity',
  'outflowDensity',
  'outflowOffset',
  'planetRadiusEarth',
  'plateauDomainOffset',
  'plateauStrength',
  'pldLevels',
  'pldStrength',
  'rayBrightness',
  'repose',
  'rotationHours',
  'scarpAxis',
  'scarpDomainOffset',
  'scarpStrength',
  'scarpStyle',
  'seaLevel',
  'shieldStratoMix',
  'specStrength',
  'strandStrength',
  'subOffset',
  'subStrength',
  'surfaceGravity',
  'tempEq',
  'termColor',
  'termStrength',
  'termWidth',
  'terraceCount',
  'tesseraAxes',
  'tesseraDomainOffset',
  'tesseraStrength',
  'thermalStrength',
  'thermalTempEq',
  'volatileSpecies',
  'volcanismStrength',
  'weatherCells',
  'weatherItczShift',
  'weatherLocked',
  'weatherOffset',
  'weatherStrength',
];

// ── Set 2: <bag>.uniforms.<name> touched by frame() ──────────────────────────
export const FRAME_UNIFORMS = [
  'ringCloud.material.uniforms::uDCull',
  'ringCloud.material.uniforms::uDResolve',
  'ringCloud.material.uniforms::uLightDir',
  'ringCloud.material.uniforms::uTime',
  'uniforms::uAirglowColor',
  'uniforms::uAirglowIntensity',
  'uniforms::uAtmoInk',
  'uniforms::uAuroraColor',
  'uniforms::uAuroraIntensity',
  'uniforms::uAuroraRingLat',
  'uniforms::uAuroraRingWidth',
  'uniforms::uBandContrast',
  'uniforms::uBandLatPow',
  'uniforms::uBandOffset',
  'uniforms::uBandRough',
  'uniforms::uBandStrength',
  'uniforms::uBandStretch',
  'uniforms::uBandTint',
  'uniforms::uBandWarp',
  'uniforms::uBeachWidth',
  'uniforms::uBioColor',
  'uniforms::uBioCoverage',
  'uniforms::uBioGroundColor',
  'uniforms::uBioGroundCover',
  'uniforms::uBioIntensity',
  'uniforms::uBioScale',
  'uniforms::uBladeFreq',
  'uniforms::uBladeSharp',
  'uniforms::uBodyRadius',
  'uniforms::uCameraPosObj',
  'uniforms::uCarbonStrength',
  'uniforms::uChaosCellScale',
  'uniforms::uChaosMaskScale',
  'uniforms::uChaosMatrixRough',
  'uniforms::uChaosOffset',
  'uniforms::uChaosRaftJitter',
  'uniforms::uChasmaCount',
  'uniforms::uChasmaDepth',
  'uniforms::uChasmaFloor',
  'uniforms::uChasmaWidth',
  'uniforms::uChevronStrength',
  'uniforms::uCityCoastBoost',
  'uniforms::uCityColor',
  'uniforms::uCityIntensity',
  'uniforms::uCityMaturity',
  'uniforms::uCityScale',
  'uniforms::uCloudCoverage',
  'uniforms::uCloudOpticsIntensity',
  'uniforms::uCloudRegime',
  'uniforms::uCloudRelief',
  'uniforms::uCoastCliffSlope',
  'uniforms::uCoastStrength',
  'uniforms::uCrackScale',
  'uniforms::uCrackWidth',
  'uniforms::uCraterAmp',
  'uniforms::uCraterBakeRestore',
  'uniforms::uCraterComplexD',
  'uniforms::uCraterDensity',
  'uniforms::uCraterOffset',
  'uniforms::uCraterRelaxation',
  // ⭐ ADDED 2026-08-25, AND IT IS A GROWTH RATHER THAN A SHRINK, WHICH THIS FIXTURE TREATS AS A
  // DELIBERATE ACT. `uNoiseScale` had NO writer anywhere in world-engine-lab.html — the material's
  // declaration (src/worldengine/shaders/uniforms.js:10) is a factory 4.0 and nothing ever touched it,
  // so every lab world rendered its base field at one shared frequency. frame() now writes it for the
  // [N] bare-key A/B: arm A restates that factory 4.0, arm B is the shared physical wavelength law
  // resolved at this front-end's display policy.
  // ⚠ THE RATCHET'S OWN OBJECTION IS ANSWERED RATHER THAN OVERRIDDEN. Its message says a new frame()
  // uniform means a feature was authored inside frame() instead of in a pack. The VALUE here is NOT
  // authored in the lab: it comes from `rockySurfacePack`'s one ungated km-shaped driver, resolved
  // through `resolveDriver`. What frame() authors is the CHOICE between two arms, which is an
  // instrument for Max, not a law — and `uNoiseScale` is exclusion 5 in ROCKY_SURFACE_LAB_BINDING
  // (src/worldengine/drivers/rockySurface.js:441) precisely because the lab has no state field to
  // mirror it into. If Max adopts arm B, the honest end state is a lab state field and a normal
  // mirror entry, and this line goes back to being ordinary.
  'uniforms::uNoiseScale',
  'uniforms::uCraterScale',
  'uniforms::uCratonColor',
  'uniforms::uCryoActivity',
  'uniforms::uCryoRidgeAmp',
  'uniforms::uCryoRidgeAxis0',
  'uniforms::uCryoRidgeAxis1',
  'uniforms::uCryoRidgeOffset',
  'uniforms::uCryoRidgeOffsetV',
  'uniforms::uCryoRidgeWarp',
  'uniforms::uCryoRidgeWidth',
  'uniforms::uDayTempK',
  'uniforms::uDeltaAmp',
  'uniforms::uDeltaApronH',
  'uniforms::uDeltaDensity',
  'uniforms::uDitherMode',
  'uniforms::uDoubleRidgeFreq',
  'uniforms::uDuneAmp',
  'uniforms::uDuneBelt',
  'uniforms::uDuneDensity',
  'uniforms::uDuneFreq',
  'uniforms::uDuneOffset',
  'uniforms::uDuneWarp',
  'uniforms::uDustActivity',
  'uniforms::uDustColor',
  'uniforms::uDustDepth',
  'uniforms::uDustFlatK',
  'uniforms::uDustOffset',
  'uniforms::uDustRegionFreq',
  'uniforms::uDustTint',
  'uniforms::uEcuBlockScale',
  'uniforms::uEcuCanyonDepth',
  'uniforms::uEcuConcreteColor',
  'uniforms::uEcuCoverage',
  'uniforms::uEcuDistrictScale',
  'uniforms::uEcuGlowColor',
  'uniforms::uEcuGlowIntensity',
  'uniforms::uEcuSeamWidth',
  'uniforms::uEcuWarpAmt',
  'uniforms::uEdificeAmp',
  'uniforms::uEdificeCaldera',
  'uniforms::uEdificeMaxHeight',
  'uniforms::uEdificeOffset',
  'uniforms::uEdificeScale',
  'uniforms::uEjectaAmp',
  'uniforms::uEjectaLump',
  'uniforms::uEjectaRampart',
  'uniforms::uEjectaStrength',
  'uniforms::uEmissive',
  'uniforms::uEmissiveBypass',
  'uniforms::uFacetAmp',
  'uniforms::uFacetCoverage',
  'uniforms::uFacetScale',
  'uniforms::uFacetStrength',
  'uniforms::uFluvialActivity',
  'uniforms::uFluvialDensity',
  'uniforms::uFluvialDepth',
  'uniforms::uFluvialFreq',
  'uniforms::uFluvialLowBias',
  'uniforms::uFluvialMeander',
  'uniforms::uFluvialOffset',
  'uniforms::uFluvialWarpAmt',
  'uniforms::uFluvialWidth',
  'uniforms::uFreshColor',
  'uniforms::uFrostAlbedo',
  'uniforms::uFrostCondensationT',
  'uniforms::uFrostEdgeSoftness',
  'uniforms::uFrostLapseRate',
  'uniforms::uFrostLatChill',
  'uniforms::uFrostLatitudeBias',
  'uniforms::uFrostLocked',
  'uniforms::uFrostMaxCoverage',
  'uniforms::uFrostNoiseAmp',
  'uniforms::uFrostNoiseScale',
  'uniforms::uFrostOffset',
  'uniforms::uFwClamp',
  'uniforms::uCoarseCut',   // ⭐ ADDED 2026-08-26 IN THE SAME COMMIT THAT WRITES IT, per this file's own rule. The tidal process term moved off the FREQUENCY (macroShortening, retired) and onto the AMPLITUDE: how many octaves of LARGE-SCALE relief resurfacing has erased. Ledger row P-19; law in src/worldengine/base/macroWavelength.js coarseReliefCut.
  'uniforms::uGlacialAmp',
  'uniforms::uGlacialBasinThresh',
  'uniforms::uGlacialColdGate',
  'uniforms::uGlacialFlowVigor',
  'uniforms::uGlacialOffset',
  'uniforms::uGlacialScale',
  'uniforms::uGlacialSlopeDamp',
  'uniforms::uGlacialStrength',
  'uniforms::uGlintDensity',
  'uniforms::uGlintExp',
  'uniforms::uGlintTint',
  'uniforms::uGloryRadius',
  'uniforms::uGroovedBandFreq',
  'uniforms::uHazeColor',
  'uniforms::uHazeMute',
  'uniforms::uHexBorderDepth',
  'uniforms::uHexBorderWidth',
  'uniforms::uHexDome',
  'uniforms::uHexRegularity',
  'uniforms::uHexScale',
  'uniforms::uHexStrength',
  'uniforms::uIcenessMix',
  'uniforms::uInkStretch',
  'uniforms::uJetEqWidth',
  'uniforms::uJetFestoon',
  'uniforms::uJetOffset',
  'uniforms::uJetShearTurb',
  'uniforms::uJetSpeed',
  'uniforms::uJetStrength',
  'uniforms::uJetTurbFreq',
  'uniforms::uKarstDensity',
  'uniforms::uKarstDolineDepth',
  'uniforms::uKarstDolineFreq',
  'uniforms::uKarstDolineR',
  'uniforms::uKarstMaturity',
  'uniforms::uKarstMazeDepth',
  'uniforms::uKarstMazeFreq',
  'uniforms::uKarstOffset',
  'uniforms::uKarstPlateauLvl',
  'uniforms::uLavaActivity',
  'uniforms::uLavaAxis',
  'uniforms::uLavaCoverage',
  'uniforms::uLavaGlowRate',
  'uniforms::uLavaOffset',
  'uniforms::uLavaScale',
  'uniforms::uLdaFat',
  'uniforms::uLevels',
  'uniforms::uLightBlobR',
  'uniforms::uLightCellFreq',
  'uniforms::uLightDir',
  'uniforms::uLightDur',
  'uniforms::uLightPolar',
  'uniforms::uLightRate',
  'uniforms::uLightningStrength',
  'uniforms::uLimbBypass',
  'uniforms::uLimbColor',
  'uniforms::uLimbExponent',
  'uniforms::uLimbStrength',
  'uniforms::uLineationAmp',
  'uniforms::uLineationFreq',
  'uniforms::uLineationWarp',
  'uniforms::uLineationWarpFreq',
  'uniforms::uLobeAmp',
  'uniforms::uLobeFreq',
  'uniforms::uLodRamp',
  'uniforms::uMachBevel',
  'uniforms::uMachBlockScale',
  'uniforms::uMachCoverage',
  'uniforms::uMachDistrictScale',
  'uniforms::uMachGlowColor',
  'uniforms::uMachGlowIntensity',
  'uniforms::uMachMetalColor',
  'uniforms::uMachSeamWidth',
  'uniforms::uMachWindowDensity',
  'uniforms::uMagAxis',
  'uniforms::uMagmaChurnSpeed',
  'uniforms::uMagmaSeaAngle',
  'uniforms::uMagmaTemp',
  'uniforms::uMassWastDensity',
  'uniforms::uMassWastOffset',
  'uniforms::uMountainAmp',
  'uniforms::uMountainDomainOffset',
  'uniforms::uMountainScale',
  'uniforms::uNightTempK',
  'uniforms::uNormalMode',
  'uniforms::uOctaves',
  'uniforms::uOrogenyAxis',
  'uniforms::uOrogenyStrength',
  'uniforms::uOutflowActivity',
  'uniforms::uOutflowDensity',
  'uniforms::uOutflowDepth',
  'uniforms::uOutflowFreq',
  'uniforms::uOutflowGrooveFreq',
  'uniforms::uOutflowGrooves',
  'uniforms::uOutflowIslands',
  'uniforms::uOutflowOffset',
  'uniforms::uOutflowWarpAmt',
  'uniforms::uOutflowWidth',
  'uniforms::uPerturb',
  'uniforms::uPlanetTempEq',
  'uniforms::uPlateauDomainOffset',
  'uniforms::uPlateauLevels',
  'uniforms::uPlateauOffset',
  'uniforms::uPlateauScale',
  'uniforms::uPlateauSoftness',
  'uniforms::uPlateauStrength',
  'uniforms::uPldLevels',
  'uniforms::uPldSoftness',
  'uniforms::uPldStrength',
  'uniforms::uPolarAmp',
  'uniforms::uPolarMode',
  'uniforms::uPolarPhase',
  'uniforms::uPolarPole',
  'uniforms::uPolarR0',
  'uniforms::uPolarRing',
  'uniforms::uPolarSides',
  'uniforms::uPolarStrength',
  'uniforms::uPolarTint',
  'uniforms::uPolarW',
  'uniforms::uProvinceWeight',
  'uniforms::uPupilR',
  'uniforms::uRayBrightness',
  'uniforms::uRayCount',
  'uniforms::uRaySharp',
  'uniforms::uRedistribution',
  'uniforms::uReliefBakeStrength',
  'uniforms::uRepose',
  'uniforms::uRidgeGain',
  'uniforms::uRidgeOffset',
  'uniforms::uScarpDomainOffset',
  'uniforms::uScarpFreq',
  'uniforms::uScarpStrength',
  'uniforms::uScarpStyle',
  'uniforms::uScarpWarp',
  'uniforms::uScarpWarpFreq',
  'uniforms::uScarpWidth',
  'uniforms::uSeaLevel',
  'uniforms::uSedColor',
  'uniforms::uShatBlockJitter',
  'uniforms::uShatBorderDepth',
  'uniforms::uShatBorderWidth',
  'uniforms::uShatMaskCover',
  'uniforms::uShatMaskScale',
  'uniforms::uShatScale',
  'uniforms::uShatStrength',
  'uniforms::uShatSubAmt',
  'uniforms::uShatSubFreq',
  'uniforms::uShieldStratoMix',
  'uniforms::uSpecBypass',
  'uniforms::uSpecStrength',
  'uniforms::uStormAux',
  'uniforms::uStormColor',
  'uniforms::uStormCount',
  'uniforms::uStormParams',
  'uniforms::uStormPosSize',
  'uniforms::uStrandStrength',
  'uniforms::uSubAmp',
  'uniforms::uSubColdGate',
  'uniforms::uSubFloorFrac',
  'uniforms::uSubOffset',
  'uniforms::uSubPitDensity',
  'uniforms::uSubPitScale',
  'uniforms::uSubPolyScale',
  'uniforms::uSubStrength',
  'uniforms::uTalusAmp',
  'uniforms::uTarCoverage',
  'uniforms::uTermBypass',
  'uniforms::uTermColor',
  'uniforms::uTermStrength',
  'uniforms::uTermWidth',
  'uniforms::uTerraceCount',
  'uniforms::uTerraceStep',
  'uniforms::uTesseraDomainOffset',
  'uniforms::uTesseraFreq',
  'uniforms::uTesseraStrength',
  'uniforms::uTesseraWarp',
  'uniforms::uTesseraWarpFreq',
  'uniforms::uThermalDir',
  'uniforms::uThermalOcclusion',
  'uniforms::uThermalStrength',
  'uniforms::uTime',
  'uniforms::uVolatileSpecies',
  'uniforms::uVolcanismStrength',
  'uniforms::uWeatherCells',
  'uniforms::uWeatherDry',
  'uniforms::uWeatherItczShift',
  'uniforms::uWeatherLocked',
  'uniforms::uWeatherOffset',
  'uniforms::uWeatherStrength',
  'uniforms::uWeatherWarp',
  'uniforms::uWeatheredColor',
  'uniforms::uWrinkleAmp',
  'uniforms::uWrinkleFreq',
  'uniforms::uWrinkleWarp',
];

// ── Set 3: <bag>.uniforms.<name> touched by applyDrivers() ───────────────────
// Seven of these eight never appear in Set 2. See the third-set note in the header.
export const APPLY_DRIVERS_UNIFORMS = [
  'uniforms::uChasmaAxis',
  'uniforms::uEmissive',
  'uniforms::uLiquidMask',
  'uniforms::uLiquidSpecies',
  'uniforms::uLiquidStability',
  'uniforms::uScarpAxis',
  'uniforms::uTesseraAxis',
  'uniforms::uVoroCells',
];

// ── Liveness sentinels ───────────────────────────────────────────────────────
// A shrink-only ratchet is TRIVIALLY GREEN against an empty measurement: the empty set is a
// subset of everything. A harness that silently stops finding anything — a renamed function, an
// over-blanking stripper, a regex that stops matching — therefore reports SUCCESS while gating
// nothing, forever. This is checked with sentinels and floors rather than with a total, because
// a total is exactly what a permutation preserves.
//
// Every sentinel is chosen because Step 5 does NOT touch it. Deliberately NOT sentinels:
// bandStrength / bandContrast / bandWarp / bandTint / jetStrength and the uBand*/uJet* uniforms —
// 5c deletes those writes from applyDrivers, and a sentinel the next step legitimately removes is
// a gate that gets relaxed the first time it fires.
export const STATE_SENTINELS = [
  'planetRadiusEarth',   // the radius draw — LOD/display plumbing, no pack owns it
  'surfaceGravity',      // sole writer; read by the uPerturb envelope
  'habitability',        // D15 habitability gate
  'habGate',             // its smoothstepped form
  'featureRelevant',     // the per-feature relevance hard-gate object
];
export const UNIFORM_SENTINELS = [
  'uniforms::uOctaves',                    // LOD plumbing
  'uniforms::uLodRamp',                    // LOD plumbing
  'uniforms::uLevels',                     // terrain quantisation
  'ringCloud.material.uniforms::uDCull',   // proves the qualified-bag arm is alive
];
export const APPLY_DRIVERS_UNIFORM_SENTINELS = [
  'uniforms::uVoroCells',   // crater cell count — written in applyDrivers, absent from frame()
];

// ⛔ THERE IS DELIBERATELY NO `BULK_STATE_SENTINELS` LIST, and the reason was MEASURED rather than
// reasoned. The bulk arm's failure mode is not "throws" — it is "resolves to the empty set", which
// SHRINKS set 1, and a shrink-only ratchet calls a shrink GREEN. So it needs its own liveness. The
// first draft gave it named sentinels, `bandRough` and `jetFestoon`. Then the shrink control ran for
// real — one row deleted from `LAB_STATE_BINDING` — and this file went RED on a legal shrink:
// `giantDeckDirectDrivers` is DEFINED as that table's complement, so a row leaving is a supported
// refactor, not an authoring event. A sentinel that reds on a supported refactor is the freeze
// behaviour the whole file argues against, and it is how a gate gets deleted the first time it
// fires wrongly. The liveness is structural instead, in the test: the arm must contribute at least
// one field the LEXICAL scan could not have found. That names nothing and rots on nothing.
//
// Floors. Held below the measured sizes so ordinary shrink never trips them, and well above zero
// so a dead harness cannot pass. Raise only with a measurement.
export const MIN_STATE_FIELDS = 100;        // measured 148
export const MIN_FRAME_UNIFORMS = 250;      // measured 329
export const MIN_APPLY_DRIVERS_UNIFORMS = 4; // measured 8
// ⚠ Deliberately NOT 9. Step 5's later slices may legitimately move a row OUT of
// `LAB_STATE_BINDING` (a driver the lab stops mirroring becomes a direct uniform write via
// `giantDeckDirectDrivers`, which is the complement of this table). A floor of 9 would red on that
// legal shrink; a floor of 4 still refuses the arm silently resolving to nothing.
export const MIN_BULK_STATE_FIELDS = 4;     // measured 9
