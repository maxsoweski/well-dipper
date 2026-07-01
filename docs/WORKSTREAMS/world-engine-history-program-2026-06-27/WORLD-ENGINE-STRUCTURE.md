# Well Dipper — World Engine Structure Report

The World Engine is a **generative** (not simulative) procedural-planet system: it places the *determined end-state* of a world as closed-form / seeded fields over an F3 sphere carrier — functions of latitude, longitude, and per-body driver scalars — never time-stepped simulation. Base writers live in `src/worldengine/base/` (three-free: `alea` + `simplex-noise` + `mathutil` only) and are byte-deterministic. The engine is **LAB-ONLY today** (`planet-lod-lab.html`); the game `Planet.js` renderer port is **ROADMAP increment 9 — the 11th/last program item** (later).

---

## Legend — three buckets

| Glyph | Bucket | Meaning |
|---|---|---|
| ✅ | **in-place** | Built + verified (may be UAT-pending-Max, but the code exists and passes ACs) |
| 📐 | **planned** | Roadmapped with a formal spec/design; not yet built |
| 💡 | **scoped-not-planned** | Researched / flagged / designed-in-part, but NOT assigned to any increment (backlog, gaps, open decisions) |

---

## Summary

### North-star tracker — of the 11 canonical planet archetypes, how many have a REAL history writer?

The 11 canonical archetypes are the `ARCHETYPES` taxonomy in `planet-archetypes.js:168-180`: **impact-airless, tectonic-terrestrial, volcanic, icy-active, volatile-cold, gas-giant, hot-jupiter, exotic-carbon, exotic-geometric, exotic-shattered, technogenic**. There is **no separate `ocean` or `eyeball-despun` member** — ocean is a tectonic-terrestrial sub-row (same plate writer), eyeball-despun is a shell regime; both ride existing writers. `technogenic` and `exotic-shattered` **are** core canonical members. `sub-neptune` and `Mars` are **not** canonical members (scoped outside the 11).

| Status | Count | Archetypes |
|---|---|---|
| ✅ **in-place** (real history writer) | **3 canonical + 2 sub-rows = 5 writers** | tectonic-terrestrial (+ ocean sub-row, same plate writer), icy-active, volatile-cold (+ eyeball-despun shell regime) |
| 📐 **planned** (roadmapped writer) | **8 canonical** | impact-airless (#5), volcanic (#4 +#4b Venus), gas-giant (#3), hot-jupiter (#3), exotic-carbon (#8), exotic-geometric (#8), exotic-shattered (#4.5, blocked), technogenic (#8) |
| 💡 **scoped-not-planned** (no increment home) | — | sub-neptune (homeless, non-canonical) + **Mars gap** (mis-assigned to plate writer; needs dedicated stagnant-lid-rocky treatment; non-canonical) |

> 3 canonical in-place + 8 canonical planned = the full 11. The 8 planned archetypes span increments #3/#4/#4.5/#5/#8. Program status: 5 writers in place today → **reaches 11-of-11 by program end if #8 ships; ~8-of-11 if #8 slips (back-loaded risk).** sub-neptune + Mars remain scoped outside the canonical 11.

### Element counts by bucket (approximate, de-duplicated across surveyors)

| Bucket | Base writers / dispatch / lab-render | Hydrology / LOD | Game-render / archetypes | Atmosphere substrate | Roadmap / docs / tests | Total |
|---|---|---|---|---|---|---|
| ✅ in-place | ~28 | ~30 | ~14 | 2 | ~18 | **~92** |
| 📐 planned | ~9 | 1 | ~13 | 11 | ~14 | **~48** |
| 💡 scoped-not-planned | ~7 | 3 | ~16 | ~30 | ~9 | **~65** |

### Deployment tiers of the relief writers

| Writer | File | Coverage | Status |
|---|---|---|---|
| `writePlateUpliftSphere` | `plates.js` | Earth-like / ocean | ✅ **SHIPPED** (inc #1 plate-uplift 2026-06-26; inc #2 driver-response `45cca44` 2026-06-28, Max UAT-passed; byte-identical Earth @ D_EARTH) |
| `writeShellReliefSphere` | `shellRelief.js` | icy / despun / volatile | ✅ **BUILT, AC11 UAT = Max's open gate** (`54ea74d`) |
| `writeHeightSphere` | `tectonic.js` | 3D-simplex tectonic height | ✅ in-place (additive height fallback when no plate/shell path) |
| `writeGrainSphere` / `stressAtLat` | `tectonic.js` | LEGACY sin²(lat) latitude-band grain | ✅ in-place (shared grain baseline + despun-fallback latitude-band function) |
| `writeClimateE5Sphere` | `climate-e5.js` | gas-giant zonal bands | ✅ LIFTED from GLSL, **headless-only, not wired** (inc #3a) |

---

## Layer 1 — Base relief writers (`src/worldengine/base/`)

| Element | Kind | Bucket | Detail | Evidence |
|---|---|---|---|---|
| `writePlateUpliftSphere` | writer | ✅ | One-pass plate/uplift field (Option-C). REPLACE sole low/mid `carrier.height=U`. Voronoi plates → Euler-pole motion → boundary stress → uplift+BFS → Jacobi relax. Earth-like & ocean. Shipped inc 1+2. | `plates.js:1-374`, `:155-269` |
| `writeShellReliefSphere` | writer | ✅ | Despun/ice-shell relief. Despin-tensor + diurnal A=2 → double-ridge lineaments + chaos. Writes height/grainAngle/faultDensity. Regime-gated. AC1-10 PASS, AC11 UAT=Max. | `shellRelief.js:1-375` |
| `writeHeightSphere` | writer | ✅ | E6 tectonic height (grain+relief), seam-free 3D simplex domain (NOT lat/long). Additive fallback when plate/shell not taken. Gravity-scaling + crust coupling. | `tectonic.js:87-187` |
| `writeGrainSphere` | writer | ✅ | E6 per-node grain (orientation). Writes grainAngle/grainMag/regime{0,1,2}. Precondition for writeHeightSphere. Shared baseline across all paths; sin²(lat) latitude-band function (via `stressAtLat`). | `tectonic.js:50-63` |
| `writeClimateE5Sphere` | writer | ✅ | E5 zonal band/jet, LIFTED from GAS_BODY shader. Pure fn of (regime, sin lat, bandFreq), NO RNG. Writes bandField/bandNorm. **Not wired to render (inc 3a).** No relief. | `climate-e5.js:1-173` |
| `stressAtLat` | field-fn | ✅ | Legacy latitude-band stress (sin²lat→regime). NU=0.25, REGIME_GAIN=0.4 LOCKED. Used by grain writer + despun fallback. | `tectonic.js:8-33` |
| `plate relief driver-response tuning` | writer | ✅ | Inc-2 SLICE B: gravity→UPLIFT/RIFT_GAIN, volatiles→CONTINENTAL_FRACTION, tidal→PLATE_COUNT. Anchored D_EARTH identity. | `plates.js:128-152` |
| `reliefStress diagnostic field` | field | ✅ | Additive stress-geom relief (lineament+chaos, pre-relax). AC10 live probe. Zero latitude term, zero read of U (anti-circularity). | `shellRelief.js:328-342` |
| `zonalBandProfile` | field-fn | ✅ | E5 core b(y) harmonic sum (shader port). Pure, deterministic. Used by climate writer + sampleJetProfile. | `climate-e5.js:102-109` |
| `sampleJetProfile` | test-harness | ✅ | E5 diagnostic: jetCount via band-extrema sign-changes (AC3 zonal structure). | `climate-e5.js:120-141` |
| `shell relief SLICE B (stress math)` | writer | 💡 | Despin+diurnal tensor derivation (Melosh/Beuthe). SLICE A shipped; math stubbed to deterministic placeholders. | `shellRelief.js:14-20, 350-end` |
| `E5 vortex/storm placement` | writer | 💡 | Inc 3b. Vortex PLACEMENT (great-spot/storm-train/polar) by argmax anticyclonic shear. Open: equatorial-jet SIGN, aspect ratio. | ROADMAP `:49-50` |
| `E7 volcanic/endogenic writer` | writer | 📐 | Inc 4 (L). Hotspot/edifice + lava-plain + magma-ocean. + explicit Venus stagnant-lid #4b (tessera/coronae). | ROADMAP `:32-33` |
| `E8a bombardment/crater writer` | writer | 📐 | Inc 5 (M). Crater-population (size-freq by gravity+age) → basins/rims/ejecta HOST for epoch editing. Cleanest editor-on-host. | ROADMAP `:34-35` |
| `E4.5 exotic-shattered writer` | writer | 📐 | Inc 4.5 (L). Miranda-class tilted-block-jumble. Roadmapped w/ formal spec + UAT rubric but **BLOCKED on Max geometry decision** (block vs diapir). Don't add 4th regime constant. | ROADMAP `:33-34` |
| `increment 5.5 shared-field pass` | field-collection | 📐 | Inc 5.5 (M). Cross-cutting substrate: stress/orientation, continental margins, sediment, E12-province, E2-figure. Roadmapped but **sound=false** (channel conflicts) — planned-but-blocked. Hard pre-#6 gate. | ROADMAP `:35-36` |
| `increment 6 epoch/host-editor model` | archetype | 📐 | Inc 6 (XL). Wraps stack in 2-4 epochs w/ persistent host. **CRITICAL BLOCKER: fixed-point solver UNMECHANIZED** (research returned placeholder). | ROADMAP `:36-37` |

---

## Layer 2 — Driver / L0 adapters + verification gates

| Element | Kind | Bucket | Detail | Evidence |
|---|---|---|---|---|
| `makeSphereField` | driver | ✅ | F3 carrier factory. Channels: height/grainAngle/grainMag/regime/faultDensity/flowAccum/baseLevel/standing/maturity. latDegOf + pole-safe tangentFrameAt. | `sphereField.js:1-41` |
| `makeBaseStep` | driver | ✅ | F2 adapter: galaxy planetData → {drivers, crust, substrate}. Computes tidalHeat, gravity, ageNorm, despinAmp, liquidStability. Non-mutating. | `baseStep.js:1-101` |
| `adaptL0` | driver | ✅ | galaxy→world input bundle. tidalHeating↔tidalHeat, age→ageNorm, density conversion. Prefers upstream D12, Io-fallback. | `adaptL0.js:1-49` |
| `calibrateTidal` | field-fn | ✅ | Io-ratio → bounded [0,1) via tanh(log10). KNEE=1.6. Earth→~0, Io→~0.19. Strictly monotone. | `adaptL0.js:1-20` |
| `driversToTune` | dispatch-gate | ✅ | Inc-2: D-vector (D14/D2/D12; D16 age descoped) → tune override. driversToTune(D_EARTH)→null→Earth byte-identical. | `plates.js:79-163` |
| `shellRegimeOf` | dispatch-gate | ✅ | Resolves (archetype, locked) → {icy-active, volatile-cold, eyeball-despun, null}. SHELL_EXCLUDE guards terrestrial/ocean/gas/lava/carbon/crystal. | `shellRelief.js:26-53` |
| `verify` | test-harness | ✅ | F7 gate: finite / bounded / physicallyOrdered / seamConsistent. Runs AC1-AC4 on every structure test. | `verify.js:1-80` |
| `mathutil` scalar helpers | driver | ✅ | clamp01/clamp/smoothstep/mix. Three-free, no RNG. Used by every writer. | `mathutil.js:1-7` |
| `determinism AC1 no-RNG guard` | test-harness | ✅ | Static gate: zero Math.random/Date.now; alea(seedString) namespaces ('plates:','shell:','e6:'); byte-identical Earth regression. | `plates.js:30-38` |

---

## Layer 3 — Dispatch + lab-render pipeline (`planet-lod-rivers.js`, `planet-lod-tectonic.js`)

| Element | Kind | Bucket | Detail | Evidence |
|---|---|---|---|---|
| `writeBodyRelief` | dispatch-gate | ✅ | Gated orchestrator: plate → shell → despun-fallback. Returns {path, plateDiag, shellDiag}. Byte-identical by construction. Height source gated by uReliefBakeStrength. | `planet-lod-rivers.js:424-452` |
| `isEarthlikePlatePath` | dispatch-gate | ✅ | Route terrestrial/ocean unlocked → plate writer. Checked FIRST (blocks shell). | `planet-lod-rivers.js:408-411` |
| `isShellReliefPath` | dispatch-gate | ✅ | Returns shell regime tag or null after plate check. | `planet-lod-rivers.js:420-422` |
| `bakeTectonicGrain` | render-stage | ✅ | WS4 T4 grain derivation → smooth director + world strike vectors. Pure. | `planet-lod-tectonic.js:76-127` |
| `buildGrainCubeGeometry` / `createGrainCube` / `bakeGrainCube` | render-stage | ✅ | T7/T8 grain cube: watertight mesh → CubeCamera → HalfFloat RGBA (strike.xy/mag/regime). Bake-once per route. | `planet-lod-tectonic.js:145-234`; `rivers.js:108-121` |
| `buildHeightCubeGeometry` / `createHeightCube` / `bakeHeightCube` | render-stage | ✅ | Phase-B height cube: carrier.height → CubeCamera → HalfFloat (height + gradient). RELIEF_CUBE_SIZE=256. SPLIT-TRAP #3 guard. | `planet-lod-tectonic.js:266-357` |
| `createHeightSampler` | render-stage | ✅ | RTT readback: point-cloud → FloatType → readPixels. Pins uOctaves=9 for deterministic routing. | `planet-lod-rivers.js:334-387` |
| `createCarveCubeMap` | render-stage | ✅ | Valley carve cube (1024 HalfFloat). R=depth, G=mouth, B=order. MAX blend. | `planet-lod-rivers.js:999-1046` |
| `smoothStrikeAngle` / `macroSeedRotateDeg` | field | ✅ | T6 continuous director (avoids {0,π/2} hardflip) + D9 seed→lat offset ±45° (sin-hash, no RNG). | `planet-lod-tectonic.js:44-64` |
| `PRESET_ARCHETYPE mapping` | dispatch-gate | ✅ | Lab UI preset→archetype keys. 13 presets → 11 keys. Mars/Venus/HotJupiter/Magma **have NO entry (inert sliders)**; Neptunian+Sub-Neptune collide on 'sub-neptune'. | `planet-lod-lab.html:1901-1921` |
| `ensureNetworkRouted` / `riverReroute` / `applyDrivers` / `buildBodyDrivers` | render-stage | ✅ | Lab route orchestration + inc-2 driver-vector build (mass/volatile/tidal harvest, opt-in slider override). | `planet-lod-lab.html:2818-3838` |
| `applyReliefBake` / `setRiverOverlay` | render-stage | ✅ | A/B relief visibility toggle + ribbon visibility gating (routes even when hidden). | `planet-lod-lab.html:2487-3839` |
| `HEIGHT_GLSL` / `ROUTER_MAIN` / `HEIGHT_VERT` | shader | ✅ | AC1 single-source h(pos) GLSL shared by lab planet + router; RTT main/vertex. | `planet-lod-height.glsl.js`; `rivers.js:212-269` |
| `relief-gate (UAT item 3)` | dispatch-gate | ✅ | smoothstep carve-aliasing guard where relief > mesh resolution. | `planet-lod-lab.html:427-437` |
| `TextureBaker` | render-stage | 💡 | Standalone equirect MRT baker (diffuse+heightmap). NOT integrated into route() pipeline. | `src/rendering/TextureBaker.js` |
| `rivers band-fallback` | dispatch-gate | 💡 | Rivers below ~140km mesh res auto-vanish; no fine-LOD fallback wired (patchStrength=0 default). | `planet-lod-lab.html:3732-3778` |

---

## Layer 4 — Hydrology (E9) + River-LOD (view-dependent tributaries)

| Element | Kind | Bucket | Detail | Evidence |
|---|---|---|---|---|
| `relief-e9-hydrology.js` (runE9) | writer | ✅ | E9 CPU bake-time reference. Priority-flood + exact accumulation → flowAccum/standing/baseLevel/maturity/incision/seaLevel. | `relief-e9-hydrology.js:1-152` |
| `routeAndOrder` | writer | ✅ | AC4 priority-flood + D-inf + Horton-Strahler on 40k-vert sphere. Orphan/uphill/cycle diagnostics. precipWeight seeding ready. | `planet-lod-rivers.js:454-645` |
| `planet-lod-sealevel.js` (solveSeaLevel) | field | ✅ | AC3 inverse-CDF sea-level solver from live histogram → target ocean fraction. Replaces FBM-era formula. | `planet-lod-sealevel.js:1-55` |
| `buildRibbonGeometry` | render-stage | ✅ | Trunk water-line: Dunne-Leopold widths, Chaikin-smoothed. AC6 radius-coupling, UAT seeded width variation. | `planet-lod-rivers.js:646-767` |
| `buildValleyGeometry` | field | ✅ | 3-rail valley footprint, order-graded DRY→FLOOD depth. Feeds carve cube. Radius-invariant. | `planet-lod-rivers.js:768-906` |
| `perNodeIncision` (WS4 T10) | field | ✅ | Stream-power Δ=-K·A^m·S^n (m=0.5,n=1). Normalized to [VALLEY_DEPTH_LO..HI]. LEGACY_DEPTH tent A/B. | `planet-lod-rivers.js:907-987` |
| `applyIncision` (T11) | field | ✅ | Immutable-copy carve: carved = authored + Δ (Δ≤0). Epoch-build-identical. | `planet-lod-rivers.js:988-993` |
| `buildStats` | field | ✅ | C1 height-sanity + C2/AC5 network-metrics bundle, returned by route(). Diagnostic aggregate for createRiverOverlay/route(). | `planet-lod-rivers.js:1049-1069` |
| `createRiverOverlay` | dispatch-gate | ✅ | High-level consumer API. Lazy mesh, once-per-(preset,seed,sea). Returns ribbon/route/textures/graph/diag/heightSource. | `planet-lod-rivers.js:1080-1221` |
| `computeOcean` / `computeAdjGradient` | field | ✅ | Ocean mask (per-node baseLevel optional) + shading-only tangent gradient (least-squares, seam-free). | `planet-lod-rivers.js:133-171, 394-407` |
| `buildIrregularSphere` | field | ✅ | Fibonacci + Lloyd + ConvexHull mesh. Lazy-once, AC7 no-rebuild. | `planet-lod-rivers.js:306-325` |
| `widthRadiusFactor` / `widthSeedFactor` / `paramsForRadius` | field | ✅ | AC6 width∝1/radius + UAT per-planet seeded width. Identity-safe. | `planet-lod-rivers.js:176-207` |
| `DEFAULT_PARAMS` / `RELIEF_CUBE_SIZE` / `DEFAULT_GRAIN_DRIVERS` | field | ✅ | Locked routing params (TARGET_N=40k, LLOYD=4, CARVE_*, TARGET_OCEAN=0.35, cube sizes). | `planet-lod-rivers.js:35-90` |
| `planet-lod-tributaries.js` (growTributaries) | writer | ✅ | Option-B STEP 1: CPU tributary topology. **PROVEN 332-test green (`31dacc8`)**. Pure, no three.js. Priority-flood-from-outlets convergence proof. | `planet-lod-tributaries.js:1-508` |
| `buildFineGrid` / `priorityFloodFromOutlets` / `steepestReceiver` / `strahlerOrder` (fine) | field | ✅ | Fine tri-lattice + O(1) lattice inverse + fine-grid flood/route/order. Deterministic. | `planet-lod-tributaries.js:116-318` |
| `planet-lod-river-amplifier.js` + `.glsl.js` | writer/field | ✅ | JS reference port of Dendry-style sub-tributary SDF (authoritative for tests). Shared GLSL/scalar constants (MAXGEN=4) so JS/GLSL can't drift. | `planet-lod-river-amplifier.js:1-213` |
| `planet-lod-tributary-patch.js` (createTributaryPatch) | dispatch-gate | ✅ | Option-B STEP 2: GPU patch bake+blend. 8° cap ≈1km/texel. fineRibbon co-rotates. Static camera v1. | `planet-lod-tributary-patch.js:1-413` |
| `projectToPatch` / `buildFineValleyGeometry` / `buildFineRibbonGeometry` | field/render | ✅ | Gnomonic inverse (GLSL-aligned) + fine depth-rails + fine water-line (Fork A/B/C/E, taper into trunk). | `planet-lod-tributary-patch.js:23-260` |
| `sampleCarve` (shader blend) | render-stage | ✅ | Blends global carve cube + fine ortho patch under angular falloff across 5 taps (bends walls). Regression-safe patch=0. | `planet-lod-tributary-patch.js:8` |
| Fields: `flowAccum` / `baseLevel` / `standing` / `maturity` / `incision` / `isChannel` / `isOcean` / `isOutlet` | field | ✅ | E9 substrate channels (sphereField.js). maturity scaled by drivers.age; baseLevel spatially-varying-ready. | `relief-e9-hydrology.js:116-151` |
| `writeBodyRelief` (baked relief orchestrator) | dispatch-gate | ✅ | Phase-D: uReliefBakeStrength>0 ⇒ carrier.height (same as height cube); =0 ⇒ legacy RTT fallback. | `planet-lod-rivers.js:424-452` |
| `view-dependent LOD framework` | dispatch-gate | 📐 | YAGNI general "reveal finer generation" system; rivers = instance #1. Toroidal windowing, re-bake-on-move DEFERRED. | river-lod-design.md §3,§10 |
| `atmosphere/precip branch (E5 climate)` | field | 💡 | synthPrecip STUBBED (precip under-supplied). E5 temp+precip+orographic → baseLevel/precipWeight. No increment. | `relief-e9-hydrology.js:78` |
| `provinces (gProvince)` | field | 💡 | Referenced in grain-bake macroSeed context; scope unclear, likely tectonic layer. | `planet-lod-rivers.js:1177-1179` |
| Tests: sealevel / amplifier / tributaries / tributary-patch / lattice-inverse / carve-channels / discharge / fine-ribbon / fieldreads | test-harness | ✅ | Full E9/LOD unit suite; tributary topology 332-test cluster green. | `tests/planet-lod-*.test.js` |
| Docs: `river-lod-design.md`, `river-lod-port-contract.md` | doc | ✅ | Option-B spec (locked 2026-06-19) + mechanical game-port contract (PORTABLE-CORE + shader graft + radius params). | `docs/superpowers/specs/...`, `docs/FEATURES/...` |

---

## Layer 5 — Game-render + archetype taxonomy (`src/objects/Planet.js`, `planet-archetypes.js`)

| Element | Kind | Bucket | Detail | Evidence |
|---|---|---|---|---|
| Planet type dispatch (18 types) | dispatch-gate | ✅ | GAS/ROCKY/EXOTIC type sets → 3 shader bodies. All 18 have shader bodies; relief writers are a separate program. | `Planet.js:985-1036, 1263-1270` |
| `GAS_BODY` shader | shader | ✅ | gas-giant/hot-jupiter/eyeball/sub-neptune. Bands, thermal glow, eyeball rings, aurora rim. | `Planet.js:248-415` |
| `ROCKY_BODY` shader | shader | ✅ | rocky/ice/lava/ocean/terrestrial/venus/carbon. Terrain relief, ice caps, ITCZ weather, carbon glints. | `Planet.js:422-664` |
| `EXOTIC_BODY` shader | shader | ✅ | hex/shattered/crystal/fungal/machine/city-lights/ecumenopolis. TODO@857 crystal-facet relief unimplemented. | `Planet.js:671-982` |
| `PlanetGenerator.js` type generation | driver | ✅ | 18-type canon + Kepler-calibrated natural distribution (_pickType). PALETTES/RADIUS ranges per type. | `PlanetGenerator.js:20-905` |
| FEATURES registry (49 features) | archetype-coverage | ✅ | F1–F49 registry → archetype membership. Drift-guarded. (The `D1–D16 → P1–P28 → F1–F53` feature MODEL lives in `planet-visual-features.md`, a different doc — do not conflate the 49-entry registry with the F53 model.) | `planet-archetypes.js:6-164` |
| ARCHETYPES taxonomy (11) | archetype-coverage | ✅ | 11 canonical archetypes + bodies + lab presets: impact-airless, tectonic-terrestrial, volcanic, icy-active, volatile-cold, gas-giant, hot-jupiter, exotic-carbon, exotic-geometric, exotic-shattered, technogenic. | `planet-archetypes.js:168-180` |
| PROVINCES geologic affinity | archetype-coverage | ✅ | Stage-D: tectonic/volcanic/ancient fields × polarity × floor. Neutral (floor=1) for gas/optical/weather. | `planet-archetypes.js:195-245` |
| `planet-lod-lab-core.js` deriveUniforms | dispatch-gate | ✅ | Maps DRIVER_PRESETS → 100+ shader uniforms (physics→shader). Central preset dispatch. | `planet-lod-lab-core.js:562-900` |
| Test harnesses (archetypes / feature-associations) | test-harness | ✅ | Drift guards: panel↔FEATURES↔ARCHETYPES↔PROVINCES↔GLSL provinceWeight. | `tests/planet-archetypes.test.js` |
| World-engine history writers (#3-#11) | writer | 📐 | 11-increment program; #1-2 built, #3-11 roadmapped. | ROADMAP.md |
| Game-port integration (ROADMAP inc 9, 11th/last item) | dispatch-gate | 📐 | Wire ~10 writers into game Planet.js. Lab-only today. Lowest priority. Numbered ROADMAP increment 9; it is the 11th and last program item. | ROADMAP increment 9 |
| Exotic relief perturbation (TODO) | shader | 💡 | Planet.js:857 hex/crystal tessella height mapping unimplemented. | `Planet.js:857` |
| Crystal facets F43 / Carbon F42 / Hex F44 | writer/shader | 💡 | Aspirational card-only; nearest machinery = F9 chaosCombiner. No increment. | `docs/FEATURES/cards/F42-F45` |
| Gas-giant storm data F28 | writer | 💡 | PlanetGenerator generates 8 storm spots, `uStorm[8]` reserved but **NEVER consumed** (grep=0). Contingent on inc 3b. | `PlanetGenerator.js:587-649` |
| Gas-giant palette expansion | shader | 💡 | Only 4 colors each (weakest coverage) vs rocky 13-20. Scoped 4→15/20, unplanned. | `PlanetGenerator.js:68-148` |
| Venus stagnant-lid rendering | shader | 💡 | Built shader-only (bands+clouds); no history writer. Thin-spot 5. | thin-spots-COMPLETENESS-REVIEW.md |
| Super-Earth family (>1.6 R⊕) | archetype-coverage | 💡 | Conflated into rocky+sub-neptune; NO dedicated archetype. Unscoped. | thin-spot 6 |
| Clouds F31 registration | archetype-coverage | ✅ | F31 clouds **registered LIVE** 2026-06-15 (always-on uniform). | `planet-archetypes.js:38` |
| Lightning F30 registration | archetype-coverage | 💡 | F30 unregistered — no enable-key / GUI folder. | `docs/FEATURES/cards/F30` |

---

## Layer 6 — Atmosphere substrate (L0→L5 field stack) + research gaps

### Built / planned atmosphere elements

| Element | Kind / Layer | Bucket | Detail | Evidence |
|---|---|---|---|---|
| `climate-e5.js` u(lat) profile | writer / L2 | ✅ | Headless three-free u(lat) port (AC1-3 pass). NOT wired to shader (inc 3a). Amplitude only, not signed wind. | `climate-e5.js:1-172` |
| Aurora ring F37 | render / L5 | ✅ | Lab stand-in (fixed green ring) + production field-driven version (`Planet.js:169-200`). Gated on D13+atmosphere. | `cards/F37-aurorae.md` |
| Aurora F37 upgrade (composition color) | render / L5 | 📐 | Phase 4c: field-driven latitude/width, D4 color, tilted axis. | `F37 §6.5` |
| Zonal belts F24 | render / L5 | 📐 | Phase 4b: latitude FBM + recursive warp, luminance-only, D8+D5+D1. 3 presets. | `cards/F24` |
| Jets & shear F25 | render / L3 | 📐 | Phase 4b: analytic u(φ) + counter-rotating drift + festoons. | `cards/F25` |
| Weather bands F26 | render / L5 | 📐 | Phase 4b: 3-lobe latBias (ITCZ/storm-track/polar). **Depends on surface-relief writers F01-F20 for h,∇h.** | `cards/F26` |
| Lightning F30 | render / L5 | 📐 | Phase 4b: Poisson point-process, convective mask, emissive-bypass. | `cards/F30 §6.5` |
| Clouds family F31a-f | render / L5 | 📐 | Phase 4b: regime-dispatched (weather/bands/blanket/pupil/ring/haze). | `cards/F31 §6.5-7` |
| Dayside hotspot F32 / Nightside glow F33 | render / L5 | 📐 | Phase 4b: one tempK curve, two consumers. ~1100K silicate floor. | `cards/F32 §6.5` |
| Airglow F38 / Cloud optics F39 | render / L5 | 📐 | Phase 4c: night-limb emissive band / glory rings at antisolar. Emissive-bypass. | `cards/F38,F39 §6.5` |

### Atmosphere research gaps (all 💡 scoped-not-planned — see backlog below)

| Gap | Priority | One-line |
|---|---|---|
| Self-luminous EMISSION render register | HIGH | Missing 2nd render register (aurora/lightning/blackbody-glow) parallel to reflectance |
| Mars thin dusty CO₂ archetype (H1) | HIGH | Zero coverage; dust-τ, global-storm oscillator, frost caps, thermal tide |
| Lava/magma rock-vapour atmosphere (H2) | HIGH | Zero coverage; SiO/Na envelope, supersonic wind, terminator rock-rain |
| Pluto/Triton sublimation atmosphere (H3) | HIGH | Zero coverage; layered haze comb, sublimation wind, global p_s on/off (Pluto/Triton bodies only — NOT Titan) |
| Brown-dwarf self-luminous giant (H4) | HIGH | S≈0, L/T cloud-clearing patchiness |
| Visible auroral oval (H5) / nightside lightning (H6) / blackbody channel (H7) | HIGH | New emissive render layers |
| Turbulent filaments (H8) / chromophore aging (H9) / ice-giant clouds (H10) / mushball banding (H11) | HIGH | Recycle u(lat)+L3 sign map / storm mask |
| High-obliquity insolation inversion (H12) | HIGH | Ward W(φ,obliquity) — solves Uranus uniform-T puzzle |
| **Unified jet-AMPLITUDE law (M8)** | MEDIUM | **Marked #3a CORRECTNESS FIX** — solves Neptune wind paradox |
| Place-once PHASE selector (M2) / stellar UV-SED driver (M5) / seasonal-phase input (M9) | MEDIUM | Infrastructure for per-body variety + stellar-driven haze |
| Ring-shadow (M1) / noctilucent (M4) / eccentricity forcing (M6) / monsoon (M7) | MEDIUM | New drivers / surface reads |
| QQO/SAO oscillation (L1) / spin-orbit resonance (L2) | LOW | Rare temporal effects |
| L1-L5 field stack (T, u(lat), shear/PV, structures, clouds) | mixed | Well-specified but scattered across cards — NOT yet a coherent writer module |
| 4 catalog corrections | — | UV-vs-T_eq conflation, aurora fluid-vs-render scope, Uranus-as-output, patchy-cloud raw-t violation |

---

## Archetype Coverage Matrix — the highest-value tracker

Rows **1–11** are the canonical `ARCHETYPES` taxonomy verbatim (`planet-archetypes.js:168-180`). Rows below the divider (**+** / ⚠) are documented **sub-rows / non-canonical bodies** (ocean, eyeball-despun, sub-neptune, Mars) that ride existing writers or are scoped outside the 11.

| # | Archetype | Real relief writer? | Atmosphere field? | Bucket | Increment | Notes |
|---|---|---|---|---|---|---|
| 1 | impact-airless (Moon/Mercury) | 📐 E8a bombardment | — | 📐 **planned** | #5 | ⚠ **No preset routes to it** — UAT-untestable until Moon/Mercury preset added. |
| 2 | tectonic-terrestrial | ✅ plates.js | 📐 F26 weather bands | ✅ **in-place** | #1-2 | Byte-identical Earth. **Mars mis-mapped here (wrong).** |
| 3 | volcanic (Io/lava) | 📐 E7 magmatism | 💡 rock-vapour (H2) | 📐 **planned** | #4 (+#4b Venus) | Size L. In SHELL_EXCLUDE. |
| 4 | icy-active (Europa) | ✅ shellRelief.js | — | ✅ **in-place** | #1 | AC11 UAT = Max's open gate. |
| 5 | volatile-cold (Titan) | ✅ shellRelief.js | 💡 methane-seas (terrestrial-catalog Titan section) | ✅ **in-place** | #1 | Single-covered — deleting preset line silently regresses to bands. Titan atmosphere = methane-seas Titan section, NOT the Pluto/Triton H3 sublimation gap. |
| 6 | gas-giant (Jovian/Saturnian) | ❌ never (bands ARE the world) | ✅ climate-e5 (headless) / 📐 F24/F25 | 📐 **planned** | #3 (+#3b vortex) | Storm placement undesigned. |
| 7 | hot-jupiter | ❌ never | 📐 F24/F32/F33 | 📐 **planned** | #3 | Whole identity in one E5 sub-field. |
| 8 | exotic-carbon | 📐 carbon writer | — | 📐 **planned** | #8 (XL, most-cuttable) | Only vestigial glints today. |
| 9 | exotic-geometric (crystal) | 📐 crystal-facet writer | — | 📐 **planned** | #8 (XL) | F43 aspirational. |
| 10 | exotic-shattered (Miranda) | 📐 block-jumble writer | — | 📐 **blocked** | #4.5 | Roadmapped w/ spec + UAT rubric; **BLOCKED on Max geometry decision** (block vs diapir). F45 shader shipped. |
| 11 | technogenic (city/machine) | 📐 overlay writer | — | 📐 **planned** | #8 (XL) | Rides Rocky/Ocean/Eyeball presets. |
| + | ocean *(tectonic-terrestrial sub-row)* | ✅ plates.js | 📐 F26 | ✅ **in-place** (sub-row) | #1-2 | Same writer as tectonic-terrestrial; not a separate canonical member. |
| + | eyeball-despun *(shell regime)* | ✅ shellRelief.js | 📐 F26 eyeball variant | ✅ **in-place** (shell regime) | #1 | AC4 tilted-axis control guards latitude masquerade. Shell regime, not a canonical member. |
| + | sub-neptune (hazy) *(non-canonical)* | ❌ **homeless** | 💡 haze branch (undesigned) | 💡 **scoped-not-planned** | none | Split carrier across #1/#3/#5.5; collides with Neptunian on short key. Not a canonical member. |
| ⚠ | **Mars** (stagnant-lid-rocky) *(non-canonical)* | 💡 **needs dedicated writer** | 💡 dust CO₂ (H1) | 💡 **scoped-not-planned** | none | Currently routes to despun fallback (inert sliders). Real Mars = #4 volcanism + #5 craters + #7 aeolian + #6 epoch. **Different from Venus #4b.** Not a canonical member. |

---

## Scoped-but-not-planned backlog (nothing researched is lost)

### Open decisions requiring Max
1. **AC11 UAT — shell relief** (icy presets Europa/Frozen/Eyeball/Titan): step through lab :5173, accept only if each reads as distinct icy/despun world (cracks, cycloids, chaos), not latitude smear.
2. **Increment 4.5 geometry choice**: block-jumble (deprecated 2011, instantly readable) vs diapir-grooved coronae (favored science, different geometry). Roadmapped but blocks the contract.
3. **Cross-tier-cycles solver (inc 6)**: research returned placeholder — re-run or declare unmechanized gap? Fixed-point solver must own convergence/order-independence (Jacobi not Gauss-Seidel)/volumetric budget.
4. **JOURNEY-vs-NOW drift**: JOURNEY reads "35% SCREENSAVER-MVP" while active campaign is "60% ENRICHED history program" — reconcile.
5. **Increment 8 split?**: archetype-completers (load-bearing for 11-of-11 claim) share slip-risk with optional Tier-5 overlays. If #8 slips, program silently ships at ~8-of-11.
6. **Inc 5 bombardment preset**: add Moon/Mercury preset or edit Frozen? (else UAT-untestable)
7. **Inc 5.5 channels**: maturity/baseLevel/standing collide with E9 — add new (accommodation, sediment), reconcile, or defer? (roadmapped but sound=false)
8. **Sub-Neptune home**: haze treatment in E5 #3, or own thin writer? Reconcile short-key vs canonical-tag collision (Neptunian reroll → Jupiter-sized).

### Roadmap thin-spots (researched, no increment)
- **Mars stagnant-lid-rocky** — dedicated treatment (distinct from Venus #4b silicate).
- **Venus stagnant-lid** — tessera+coronae vs hotspot; CORONA_ACTIVE_FRAC likely too low (~0.35 vs lit ~0.70).
- **Super-Earth / mini-Neptune family gap** — completely unscoped.
- **Shared stress/orientation field** — CYCLE-2 needs persistent gen-1 lineament field; intended in #5.5 (roadmapped, sound=false).
- **Gas-giant vortex placement** — now folded into #3b, but storm carriage `uStorm[8]` unverified (grep=0).

### Atmosphere gaps (23 research-confirmed: 12 HIGH / 9 MEDIUM / 2 LOW)
- **HIGH**: self-luminous emission register; 4 missing archetypes (Mars CO₂, lava rock-vapour, Pluto/Triton sublimation, brown-dwarf); visible aurora oval; nightside lightning; blackbody channel; high-obliquity inversion (Uranus); turbulent filaments; chromophore aging; ice-giant clouds; mushball banding.
- **MEDIUM**: **unified jet-amplitude law (M8 — flagged #3a correctness-fix, not a later add)**; place-once phase selector; stellar UV-SED driver; ring-shadow; noctilucent clouds; eccentricity forcing; monsoon; seasonal-phase input.
- **LOW**: QQO/SAO stratospheric oscillation; spin-orbit resonance smear.
- **4 catalog corrections**: stellar-UV vs T_eq conflation; aurora fluid-vs-render scope; Uranus-as-driver-output; patchy-cloud raw-t contract violation.

### Deferred / design debt
- River ribbon unlit-decal appearance in AC8 isolated view (cosmetic).
- Orogeny F1/F4/F5 re-seating into plate boundaries (#2 follow-on).
- View-dependent LOD generalization (toroidal windowing, re-bake-on-move) — YAGNI, rivers = only instance.
- World-origin rebasing (float32 at ship scale) — flagged dependency for game-port (ROADMAP inc 9).
- FEATURES.md row + doc-rot skipped at inc-2 ship.