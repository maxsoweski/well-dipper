# Planet-LOD lab GUI — provenance inventory (2026-07-15)

Honest provenance classification of every GUI folder + deviating control in `world-engine-lab.html`, to
ground the lab-UX IA reorg (Legacy quarantine, writer-driven badging, per-world-type defaults).

Classes:
- **RIG** — camera/view/LOD/env/seeds/presets: judging infrastructure, not a feature.
- **WRITER-DRIVEN** — a `src/worldengine/base/*` writer authors what this controls (via `route()` /
  `bodyDrivers` / per-vertex attrs).
- **HYBRID** — a base/ writer authors placement/physics, but the folder's other knobs are legacy-era
  display gates/strengths (+ manual `*Enabled`).
- **LEGACY** — pure in-shader synth renderer; deriveUniforms (core) may feed strengths, but NO base/
  writer authors it. Placement is in-shader noise or in-lab seed hashing.
- **DEV-DEBUG** — increment-specific UAT/debug tooling a judging user never needs.

Evidence column = symbol names (not line numbers). "JR" = judging-relevance: does Max need it
open/visible to JUDGE a world? (yes / sometimes / no).

---

## Panel A — guiLeft ("WORLD ENGINE LAB — rig"), top-level folders

| Folder | Class | Ctrls | JR | Evidence (symbols) |
|---|---|---|---|---|
| **World** | RIG | ~7 + DOM | yes | `fWorld`, `filterUI`, `driverUI.preset`, `applyArchetypeFilter`, `soloMode`, `enableAll`/`clearSolo`. Judging surface = preset picker + relevance filter. |
| **Tectonic grain & carve (WS4)** | WRITER-DRIVEN | 5 | sometimes | `fGrainCarve`, `grainCarveUI`, `uTectonicGrainStrength`, `applyReliefBake`→`uReliefBakeStrength`, `setCarveEpoch`, `riverOverlayState.carveDepthH`. Controls the shared WS4 grain the relief writers (`tectonic.js`) consume + the master baked-relief routing toggle (`heightSource=='carrier'`) + drainage carve. |
| **Plate relief (UAT)** | DEV-DEBUG | 2 | no | `fPlateRelief`, `plateReliefUI.isolate`, `isolatePlateRelief`, `_isolateCfg` (clash/obscure/clutter/drainage), `_preIsolate`. One-click AC8 view stripping legacy clash so the plate carrier authors 100% of relief. Off-guard (bound to `plateReliefUI`, not `state.*Enabled`). |
| **Substrate (V2-4)** | DEV-DEBUG (writer viz) | 1 | no | `fSubstrate`, `provinceOverlayUI.show`, `setProvinceOverlay`. Debug overlay of `substrate.js`/`province.js` writer output (craton/orogen/basin). "GROUND-OWNED debug folder". Off-guard proxy (bound to `provinceOverlayUI`). |
| **View & LOD** | RIG | ~11 | yes | `fView`: `distance`, `octaves`, `octAuto`, `fwClamp`, `pixelScale`, `normalMode`, `spinSpeed`, `lightAzimuthDeg`/`lightElevationDeg`, `☀ sun ← camera` (`toCam`), `applyLightDir`. Camera/LOD/sun = how you inspect a world. |
| **Envelope** | RIG | 6 | yes | `fEnv`: `levels` (posterize), `ditherMode`, `emissive`, `provinceWeight` (province influence), `emissiveBypass`. Spec §2.C look-decision surface. `provinceWeight` couples to the substrate/province writer (see deviations). |
| **Drivers** | WRITER-DRIVEN (parent) | 5 direct | sometimes | `fDrivers`, `applyDrivers`→`deriveUniforms(DRIVER_PRESETS[...])`, `driverUI.qualityTier`, `planetRadiusEarth`, `radiusSeed`, `rerollRadius`→`drawPresetRadius`. The physics-bundle bridge feeding the writers. Subfolders below. |
| **Seeds** | RIG | 3 | sometimes | `fSeeds`: `macroSeed`, `detailSeed`, `newPlanet`, `updateSeedUniforms`, `rebakeE5Bands`. World identity / reseed. |
| **Presets** | RIG | 2 | no | `fPresets`: `saveAll` (Copy settings JSON), `resetAll`/`rebuildTarget` (Reset). lil-gui panel save/load — NOT driver presets. |
| **Rings (F51)** | LEGACY (standalone feature) | 9 | sometimes | `fRings`, `ringsProxy.show`→`state.ringsEnabled`, `ringCloud`, `rebakeRingCloud`. Separate ring mesh, own LOD pipeline; not a base/ writer, not F1–F49 synth-surface. Off-guard proxy (see (d)). |

### Drivers subfolders

| Folder | Class | Ctrls | JR | Evidence (symbols) |
|---|---|---|---|---|
| **Body drivers → plate relief (Inc.2)** | WRITER-DRIVEN | 5 | sometimes | `fBodyDrivers`, `driverOv.{gravity,volatiles,tidal}`, `buildBodyDrivers`→`route({bodyDrivers})`→`plates.js driversToTune`, `_onDriverDrag`, A/B `_driverAbMode`. |
| **Body drivers → volcanic relief (Inc.4-M)** | WRITER-DRIVEN | 2 | sometimes | `fMagmaDrivers`, `driverOv.thermal`→`thermalState`→`magmatism.js` (Lava/Magma path). |
| **Body drivers → stagnant relief (V2-2b-1)** | WRITER-DRIVEN | 2 | sometimes | `fStagnantDrivers`, `driverOv.tsurf`→nested `condition.T_eq`→`stagnantLid.js stagnantDriversToTune` (Venus path). |
| **Body drivers → shell relief (V2-5s)** | WRITER-DRIVEN | 1 (A/B only) | sometimes | `fShellDrivers`, reuses gravity/tidal/volatiles/tsurf → `shellRelief.js shellDriversToTune` (Europa/Titan/Eyeball). |
| **Drivers → mixed lid (V2-2b-2)** | DEV-DEBUG | ~14 | no | `fMixedDrivers`, `mixedOv.{L,Φ,n,tidal,effectiveL}`, `applyMixedDrivers`→`route({labLidOverride})`→`mixedInterior.js`, Pilot A/B, Venus/Tharsis controls, `focus`, `render`, A/B. LAB-ONLY novel primitive; production dispatch untouched. |
| **scale readout** | DEV-DEBUG | 6 | no | `fScaleReadout`: read-only getters `surfaceGravity`, `planetRadiusEarth`, `craterSizeKm`, `fluvialSizeKm`, `edificeSizeKm`, `mountainHeightKm`. AC7 km/g readouts. |

---

## Panel B — guiRight "Features" → `fLegacy` "Legacy synth renderer (F1–F49)" (closed)

Every feature folder: strengths are core-derived (`deriveUniforms`, `.listen()`), shape knobs are
manual, `*Enabled` defaults **false** and is manual (title-bar toggle via `relocateEnableToTitle`).
Per-frame writes gate each family in the render loop (`uX.value = state.xEnabled ? ... : 0`).

### fRelief — "Surface — Relief" (LEGACY in-shader synth)

| Folder | Class | Ctrls | JR | Evidence (symbols) |
|---|---|---|---|---|
| _(group knob)_ perturb | LEGACY | 1 | sometimes | `fRelief.add(state,'perturb')`. |
| Craters (F2) | LEGACY | 8 | sometimes | `fCraters`, `cratersEnabled`, `u.craterDensity/craterComplexD/craterRelaxation`, `craterOffset` 🎲. In `_isolateCfg.clash`. |
| Ejecta & Rays (F3) | LEGACY | 8 | sometimes | `fEjecta`, `ejectaEnabled`, reuses F2 crater uniforms. clash. |
| Mountains (F1) ⊞grain | LEGACY (grain-oriented) | 7 | sometimes | `fMountains`, `mountainsEnabled`, `orogenyAngle` strike from shared grain (🎲 gated on `uTectonicGrainStrength<=0`). clash. |
| Canyons (F4) ⊞grain | LEGACY (grain-oriented) | 5 | sometimes | `fCanyons`, `canyonsEnabled`, `uChasmaAxis` grain-gated. clash. |
| Scarps (F5) ⊞grain | LEGACY (grain-oriented) | 7 | sometimes | `fScarps`, `scarpsEnabled`, `uScarpAxis` grain-gated. clash. |
| Plateaus (F6) | LEGACY | 6 | sometimes | `fPlateaus`, `plateausEnabled`. clash. |
| Tessera (F6) ⊞grain | LEGACY (grain-oriented) | 5 | sometimes | `fTessera`, `tesseraEnabled`, `uTesseraAxis` grain-gated. clash. |
| Edifices (F7) | LEGACY | 8 | sometimes | `fEdifices`, `edificesEnabled`. clash. (volcanic RELIEF is writer-carried via `magmatism.js`; this folder is the legacy in-shader cone synth.) |
| Lava plains (F8) ⊞grain | LEGACY (grain-oriented) | ~9 | sometimes | `fLava`, `lavaEnabled`, `lavaCoverage/lavaActivity` driven, `uLavaOffset` grain. |
| Chaos (F9) | LEGACY | ~10 | sometimes | `fChaos`, `chaosEnabled`, `cryoActivity` driven (Cryo P7). |
| Ridged icy (F10) ⊞grain | LEGACY (grain-oriented) | ~13 | sometimes | `fCryoRidge`, `cryoRidgeEnabled`, `uCryoRidgeAxis` grain. |
| Cryo / Frost (F23/F22) | LEGACY | ~19 | sometimes | `fFrost`, `frostEnabled`. |
| Sublimation (F18) | LEGACY | ~16 | sometimes | `fSub`, `subEnabled`. |
| Glacial (F17) | LEGACY | ~16 | sometimes | `fGlacial`, `glacialEnabled`. |

### fGrad — "Surface — Gradational" (LEGACY)

| Folder | Class | Ctrls | JR | Evidence (symbols) |
|---|---|---|---|---|
| Rivers & valleys (F11) | LEGACY (routed-ribbon overlay) | ~16 | sometimes | `fRiversOverlay`, `riversEnabled`, `setRiverOverlay`→`ensureNetworkRouted`, `riverOverlayState`. Own ribbon/router pipeline (lab-side, not base/); carve couples to `uReliefBakeCube` carrier. |
| Lakes & seas (F14) | LEGACY | 2 | sometimes | `fLakes`, `lakesEnabled`, `seaLevel` driven. |
| Deltas & fans (F12) | LEGACY | 4 | sometimes | `fDeltas`, `deltasEnabled`, `deltaDensity` driven. |
| Coastlines (F20) | LEGACY | 6 | sometimes | `fCoast`, `coastEnabled`, `coastStrength/strandStrength` driven. |
| Outflow channels (F13) | LEGACY | ~11 | sometimes | `fOutflow`, `outflowEnabled`. |
| Karst (F21) | LEGACY | ~10 | sometimes | `fKarst`, `karstEnabled`. |
| Dunes & wind forms (F15) | LEGACY | 7 | sometimes | `fDunes`, `dunesEnabled`. |
| Dust mantles (F16) | LEGACY | 6 | sometimes | `fDust`, `dustEnabled`. |
| Mass-wasting (F19) | LEGACY | 8 | sometimes | `fMassWast`, `massWastEnabled`, parasitic on host slope. |

### fBandsGroup — "Surface — Bands"

| Folder | Class | Ctrls | JR | Evidence (symbols) |
|---|---|---|---|---|
| **Zonal belts (F24)** | **HYBRID** | ~11 | sometimes | `fBands`, `bandsEnabled`. `climate-e5.js bakeClimateE5Attributes`→`aBand` per-vertex authors band PLACEMENT; `e5RotationScale`/`e5Obliquity`→`rebakeE5Bands` feed the writer (Rhines count / Ward obliquity). `bandStrength/Count/Contrast/Warp/Tint` core-derived displays; `bandStretch`/`bandLatPow` manual; enable manual. |
| **Jets & shear (F25)** | **HYBRID** | 8 | sometimes | `fJets`, `jetsEnabled`. `climate-e5.js`→`aShear` per-vertex gates shader filament turbulence. `jetStrength/Speed/ShearTurb/Festoon` derived; `jetTurbFreq`/`jetEqWidth` manual. |
| Weather bands (F26) | LEGACY | 8 | sometimes | `fWeather`, `weatherBandsEnabled`. **NO base/ writer** — in-shader Stage-8 threshold bias; `weatherStrength/Cells/ItczShift/Locked` core-derived. |
| Great spot (F27) | LEGACY | 5 | sometimes | `fSpot`, `greatSpotEnabled`. **NO base/ writer** — placement derived IN-LAB via `(macroSeed,stormSeed)` hash in `applyDrivers`→`spotCenter`, composed to `uStormPosSize`/`uStormParams` per-frame. 🎲 rerolls `stormSeed`. |
| Storm clusters (F28) | LEGACY | 4 | sometimes | `fTrain`, `stormTrainEnabled`, `trainSpots` (in-lab seed hash), shared `stormSeed`. NO base/ writer. |
| Polar vortex (F29) | LEGACY | 7 | sometimes | `fPolar`, `polarVortexEnabled`, `uPolarStrength` × `featureRelevant.polarVortex`. In-lab seed hash; NO base/ writer. |
| Lightning (F30) | LEGACY | 6 | sometimes | `fLightning`, `lightningEnabled`, `uTime`-driven in-shader. (#4 writer unbuilt.) |
| Clouds & haze (F31) | LEGACY | 5 | sometimes | `fClouds`, `cloudsEnabled`, `cloudCoverage` derived; in-shader regime combiner. |
| Dust storms (F40) | LEGACY | 3 | sometimes | `fDustStorm`, `dustStormEnabled`, `dustActivity` derived. |
| Thermal day/night (F32/F33) | LEGACY | ~8 | sometimes | `fThermal`/`fThermalNight`, `daysideThermalEnabled`/`nightsideThermalEnabled`. In-shader emissive; core-derived. **Only auto-enabled features** — `applyDrivers` flips both on the `_hotJup` gate (see (b)). |

### fExoticGroup — "Surface — Exotic" (LEGACY)

| Folder | Class | Ctrls | JR | Evidence (symbols) |
|---|---|---|---|---|
| Magma ocean (F41) | LEGACY | 4 | sometimes | `fMagma`, `magmaEnabled`, `magmaSeaAngle` derived; in-shader emissive sea (magmatism.js authors volcanic RELIEF, not this ocean). |
| Carbon crust (F42) | LEGACY | 4 | sometimes | `fCarbon`, `carbonEnabled`, `carbonRatio` derived. |
| Crystal facets (F43) | LEGACY | 5 | sometimes | `fFacets`, `facetsEnabled`, `facetStrength` derived. |
| Hex crust (F44) | LEGACY | 6 | sometimes | `fHex`, `hexTessEnabled`, `uHexStrength` pure enable gate × `featureRelevant.hexTess`. No driver. |
| Shattered crust (F45) | LEGACY | 9 | sometimes | `fShat`, `shatterEnabled`, `uShatStrength` pure gate × `featureRelevant.shatter`. No driver. |
| Bioluminescent mats (F46) | LEGACY | 5 | sometimes | `fBioMats`, `bioMatsEnabled`, pure lab knobs (hab-gated coverage). |
| City lights (F48) | LEGACY | 6 | sometimes | `fCityLights`, `cityLightsEnabled` (test:16 literal), pure lab knobs. |
| Machine surface (F47) | LEGACY | 10 | sometimes | `fMachine`, `machineEnabled`, `machCoverage`×`featureRelevant.machine`, pure lab knobs. |
| Ecumenopolis (F49) | LEGACY | 10 | sometimes | `fEcu`, `ecumenopolisEnabled`, `uEcuCoverage` pure lab knob. |

### fOpticalGroup — "Surface — Optical" (LEGACY)

| Folder | Class | Ctrls | JR | Evidence (symbols) |
|---|---|---|---|---|
| Limb glow (F34) | LEGACY | 6 | sometimes | `fLimb`, `limbEnabled`, `limbStrength` derived (hasAtmo gate, per-preset `LIMB_COLOR_BY_PRESET`); geometry-placed. |
| Terminator gradient (F35) | LEGACY | 5 | no | `fTerm`, `terminatorEnabled`, `termStrength` derived, `TERM_COLOR_BY_PRESET`. **Max ruling 2026-07-16: disabled totally — removed from all `DEFAULT_DRESSING` entries; doesn't work, and day/night shading belongs to the main game's lighting engine. Manual toggle retained (reversible-first).** |
| Sunglint (F36) | LEGACY | 6 | sometimes | `fGlint`, `sunglintEnabled`, `specStrength` derived (F14 sea gate). |
| Aurorae (F37) | LEGACY | 5 | sometimes | `fAurora`, `auroraEnabled`, `auroraIntensity` derived (D13 field gate). |
| Airglow (F38) | LEGACY | 3 | sometimes | `fAirglow`, `airglowEnabled`, `airglowIntensity`×`featureRelevant.airglow`. |
| Cloud optics (F39) | LEGACY | 3 | sometimes | `fCloudOptics`, `cloudOpticsEnabled`, coupled to F31 cloud-presence. |

### fNotRelevant — "Not relevant to this world (N)"

| Folder | Class | Ctrls | JR | Evidence (symbols) |
|---|---|---|---|---|
| Not relevant to this world | RIG/DEV (filter bin) | 0 | no | `fNotRelevant`, `applyArchetypeFilter` re-parents irrelevant feature folders here when `filterUI.filter` on. UI mechanism, auto-populated. |

---

## Deviating controls (differ from their folder's class) — own rows

| Control | Folder | Class | Evidence |
|---|---|---|---|
| `preset` picker | World | WRITER-DRIVEN (input) | `fWorld.add(driverUI,'preset').onChange(applyDrivers)` — selects the physics bundle → `deriveUniforms` + `route()` writers. |
| `Audit this world` | World | DEV-DEBUG | `auditCtrl`→`runAudit`→`renderDeltaSweep` render-delta classifier. |
| archetype ⓘ info / `archetypeLabel` | World | DEV/RIG (read-only) | `archetypeInfoHtml`, `relevantFeatureSet`. |
| `e5RotationScale`, `e5Obliquity` | Zonal belts (F24) | WRITER-DRIVEN | `.onChange(rebakeE5Bands)`→`bakeClimateE5Attributes` (feed the E5 writer, unlike the folder's legacy display knobs). |
| `daysideThermalEnabled`, `nightsideThermalEnabled` | Thermal (F32/F33) | (auto-set) | `applyDrivers`: `state.daysideThermalEnabled = _hotJup` — the ONLY `*Enabled` flags any code flips. |
| `reliefBakeStrength`, `carveEpoch`, `carveDepthH` | Grain & carve | WRITER-DRIVEN (routing) | `applyReliefBake`→`uReliefBakeStrength` is the master carrier-routing toggle (`heightSource=='carrier'`); carve feeds `uRiverCarveDepth`. |
| `provinceWeight` (province influence) | Envelope | WRITER-coupled | `uProvinceWeight` scales the `substrate.js`/`province.js` geologic-province field over the legacy relief. |
| carve controls (`carve`, `carveStrength`, `carveDepthH`…) | Rivers (F11) | WRITER-coupled | gouge the `uReliefBakeCube` writer carrier, not just the ribbon overlay. |
| `show rings` | Rings (F51) | LEGACY (feature toggle) | `ringsProxy.show` — JR sometimes; the LOD/rebake knobs below it are DEV-DEBUG. |

---

## Direct answers

**(a) Reseed/reroll controls & where.**
- **Seeds** folder: `macroSeed`, `detailSeed` sliders + **"New planet (re-roll both)"** (`newPlanet`).
- **Drivers** folder: `radiusSeed` slider + **"🎲 reroll radius"** (`rerollRadius`, bumps `radiusSeed`).
- **Storm dice** (shared `stormSeed`, applied through `applyDrivers`): **Great spot (F27)** "🎲 reroll storm",
  **Storm clusters (F28)** & **Polar vortex (F29)** "🎲 reroll storms (shared seed)" — one `(macroSeed,stormSeed)`
  pair owns ALL storm/vortex placement.
- **Drivers → mixed lid**: "re-seed mixed world" field (`mixedSeedUI`→`_mixedSeed`).
- Per-feature **"🎲 randomize"** buttons (craters/mountains/scarps/…): these roll transient `*Offset` domain
  warps, NOT seeds (and the ⊞grain ones no-op their strike reroll while grain is on).

**(b) Do setPreset/applyDrivers set `*Enabled` flags?** There is NO `setPreset` — the preset dropdown calls
`applyDrivers`. All 47 `*Enabled` default **false** and stay false; `applyDrivers` sets exactly TWO —
`daysideThermalEnabled`/`nightsideThermalEnabled = _hotJup` (F32/F33, the "renders-cold fix"). Everything else
is **render-incomplete on fresh load**: nothing draws until Max ticks an enable, uses 🔆 solo, or "enable all".
(`setRiverOverlay`/`riverReroute` and the Plate-relief isolate also flip enables, but those are user-triggered,
not preset-driven.)

**(c) relevantFeatureSet()/filter default on fresh load.** `filterUI = { filter: true, ... }` — the "filter to
relevant" toggle is **ON** by default. `relevantFeatureSet()` returns the UNION of `featuresOf()` over every
archetype whose `presets` include the current preset (default preset "Rocky (Earthlike)" → `tectonic-terrestrial`
[+`technogenic`]). `applyArchetypeFilter` re-parents non-member feature folders into "Not relevant to this world"
on load. (`soloMode` default = `'context'`.)

**(d) `*Enabled` keys the orphan-folder guard scrapes + off-guard proxies.** `tests/planet-archetypes.test.js`
scrapes `labSrc.matchAll(/\.add\(state, '(\w+Enabled)'\)/g)` → `panelEnableKeys`, and asserts a 1:1 bijection with
`FEATURES[*].enableKey` (every FEATURES key bound in the panel; every scraped key has exactly one FEATURES entry —
"no orphan folders"). So it scrapes all 47 literal `.add(state,'…Enabled')` toggles (cratersEnabled … ecumenopolisEnabled,
incl. daysideThermalEnabled/nightsideThermalEnabled). **Off-guard proxy patterns** (deliberately evade the scrape by
binding to a local object, NOT `state.*Enabled`): (1) **Rings** — `ringsProxy.show`→`state.ringsEnabled`; (2)
**Substrate province overlay** — `provinceOverlayUI.show` (comment cites "planet-archetypes.test.js stays green");
(3) **Plate relief isolate** — `plateReliefUI.isolate`. All three are real toggles kept off the FEATURES taxonomy.

---

## Surprises / flags for the IA design

1. **No `#3b` storm writer exists.** The task hypothesized F26–F29 as HYBRID via `#3b` storm/polar writers, but
   `src/worldengine/base/` has NO storm/spot/polar/weather writer. F27/F28/F29 placement is derived IN-LAB
   (`(macroSeed,stormSeed)` hash inside `applyDrivers`) and composed to `uStorm*` per-frame; F26 is in-shader
   Stage-8. Only `#3a` (`climate-e5.js`) is a genuine base/ writer → **only F24/F25 are true HYBRIDs.** Everything
   else in the Bands group is LEGACY-with-core-derived-strengths.
2. **The writer-authored relief is the CARRIER, not the F1–F8 folders.** The base/ relief writers (plates / lidResponse
   / mixedInterior / shellRelief / stagnantLid / magmatism) author a SEPARATE `carrier.height` reached only when
   `reliefBakeStrength>0` routes it. The F1–F8 "Surface — Relief" folders are the legacy in-shader synth that
   `_isolateCfg.clash` STRIPS because it competes with the carrier. So "writer-driven relief" lives in the **Drivers
   folders + Grain-&-carve routing toggle**, not in the relief feature folders.
3. **Grain coupling blurs LEGACY vs WRITER for 6 relief folders.** Mountains/Canyons/Scarps/Tessera/Lava/Ridged-icy
   carry a `⊞grain` badge — their strike/orientation is governed by the shared WS4 grain field (their 🎲 no-ops the
   strike reroll while grain is on). Body = legacy synth; orientation = writer-era coupling. Badge accordingly.
4. **Only 2 features auto-enable; 45 need manual action.** On fresh load the panel renders essentially nothing.
   The IA's "per-world-type defaults" will need to SET `*Enabled` per preset (there's currently no such mechanism
   besides the `_hotJup` special-case) — this is net-new behavior, and it must respect the orphan-guard scrape
   (any new `.add(state,'…Enabled')` must be a FEATURES key).
5. **Three real toggles are already off-guard** (rings, substrate overlay, plate isolate) — a precedent for how
   Legacy-quarantine/DEV controls can exist without registering in the FEATURES taxonomy.
6. **`filter:true` already quarantines by relevance.** The existing archetype filter + "Not relevant to this world"
   bin is a working prototype of the reorg's intent; the Legacy drawer (`fLegacy.close()`) is a second, orthogonal
   quarantine axis (provenance vs relevance). The IA should reconcile these two axes rather than add a third.
