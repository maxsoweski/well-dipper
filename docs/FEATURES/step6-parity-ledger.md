# Step 6b — the FEATURE-parity ledger

**What this is.** PLAN §4 Step 6b, under Max's 2026‑08‑09 ruling: *this is a FEATURE ledger, not a
uniform‑NAME diff*, and **an accepted loss is allowed; an UNDECLARED loss is blocking.** Every row
below enumerates something the game draws today on the bodies Step 6 swaps, and rules it
**carried / accepted-loss / blocking**.

**How it was produced.** By RUNNING, never by reading. `tests/material-parity-list.test.js` builds
**both materials on the same body** — `setLabGasBodiesOverride(false)` then `(true)` on identical
`planetData` — over 200 generated systems, feeds the pair to `_lab.swapLedger()`'s decision core
(`swapLedgerOf`), and extracts the hardcoded-GLSL half straight out of the shipped legacy shader
source. The test carries the same row table this document does and **fails if the two disagree**, so
this file is machine-checked rather than transcribed. Reading is what left `uLimbMix` out of the
plan's own list (ledger C20); nothing here was typed from a document.

⛔ **Nothing in this file was measured on Sol.** Sol renders 18 NASA textures through a different
renderer with no world-engine condition fields, and PLAN §4 Step 6d excludes it in code. The corpus
is `StarSystemGenerator.generate('lab-procedural-N', null)` for **N = 0…199**.

---

## 0. The headline, before the rows

Three measured numbers say more than the forty rows below, and none of them appears in the plan.

| | measured |
|---|---|
| **How much of the game's material varies from body to body** | **37 of 71** uniforms |
| **How much of the lab material varies from body to body, after the swap** | **16 of 356** uniforms |
| **How many uniforms the pack actually writes** | **15** (11 `uBand*`, 4 `uJet*`) + the `aBand`/`aShear`/`aMush` bake |

⭐ **And the finding that a three-bucket name diff structurally cannot report.** `swapLedgerOf`
puts **28** names in **CARRIED**. Carried means *the name exists on both materials* — it does not
mean the value survives. Measured over 103 swapped bodies: **20 of those 28 carry a different value
after the swap, 17 of them on every single body**, because the pack writes none of them and the lab
material answers with `makeUniforms`' constant default. The eight that genuinely match are eight
constants (`uCraterDensity` `uCraterRelaxation` `uEjectaLump` `uEjectaRampart` `uEjectaStrength`
`uFwClamp` `uTerraceCount` `uVoroCells`) — they agree because **both sides are zero or a shared
constant**, which is agreement by absence.

**So "CARRIED: 28" reads as 28 surviving features and is 8 at most.** That is this codebase's
signature failure — a measurement entirely true and entirely misleading — and it is the reason this
ledger rules the *value*, not the *name*. The control is executed in
`tests/material-parity-list.test.js` (`the CARRIED bucket is a NAME bucket`): the same pair of
materials is fed to `swapLedgerOf`, which reports the 20 as carried, and to a value comparison,
which reports them as diverged. Two answers, one input.

---

## 1. The populations, re-measured

⚠ **Re-measured, not copied.** PLAN §4 Step 6b tabulates five rows with figures over an unnamed
corpus of "223 gas bodies". Step 4 taught that the plan's own tabulated numbers do not always
reproduce, so every figure below was taken again on the corpus named at the top of this file. **The
two sets of numbers are over different populations and must not be compared as a delta.**

| | measured on `lab-procedural-0…199` |
|---|---|
| systems | 200, of which **64** are binary |
| bodies claimed by `giantDeck`'s predicate | **343** |
| …refused by Step 6d's provenance test | **2** (both `crystal`, blockers `no _systemSeed` + `no _ordinal`) |
| **bodies that actually swap** | **341** |
| legacy program those 341 render **today** | **`gas` 227 · `rocky` 114** |
| `gas` branch census | `planetType` **1**: 53 · **6**: 5 · **7**: 3 · **10**: 166 |
| `rocky` branch census | `planetType` **0**: 21 · **2**: 66 · **5**: 1 · **9**: 26 |
| swapped bodies with ≥1 moon | **228** of 341, **456** moons |
| swapped bodies in a binary system | **125** of 341 |
| swapped bodies under a **non-white** primary | **341** of 341 |

⭐ **The line the plan does not contain: 114 of the 341 swapped bodies do not render the gas
program today.** `giantDeck`'s predicate is condition-derived — src/worldengine/drivers/index.js:99
`applies: (condition) => compositionClass(condition) === 'gas',` — while the legacy program is
chosen by the `type` *label*, src/objects/Planet.js:1422 `const GAS_TYPES = new Set(['gas-giant', 'hot-jupiter', 'eyeball', 'sub-neptune']);`.
The two disagree on a third of the population: bodies labelled `ice`, `carbon`, `rocky` and
`terrestrial` whose condition says gas. Step 6 is titled **SHIPS GAS GIANTS** and §6b's loss table
enumerates the gas branch only, so the features those 114 bodies draw today were outside the plan's
list by construction. §3 below rules them.

### 1.1 The plan's five tabulated rows, re-measured

| plan row | plan's figure | re-measured here |
|---|---|---|
| Moon transit + planet shadows | 177 of 223 gas bodies have moons (448 moons) | **228 of 341** swapped bodies, **456** moons |
| Second-star lighting | 79 of 223 in 72 binary systems | **125 of 341**, in **64** binary systems of 200 |
| Primary star **colour** | "**all** giants… implicit white light" | **341 of 341** — and stronger: **every** primary in the corpus is non-white, so there is no body for which the loss is invisible |
| LOD1 procedural colour match | Sol's Jupiter/Saturn while textures load | **0 of 341, and structurally 0.** `_applyLOD1Overrides` returns at src/rendering/objects/BodyRenderer.js:279 `if (!profileId) return;` and `worldEngineProvenance` refuses any body that HAS a `profileId`. The two guards are complements: no swapped body can ever reach that path. |
| `lodLevel` | "near-harmless — read by no shader" | **reproduces.** `lodLevel` occurs exactly twice in `src/objects/Planet.js`: the declaration src/objects/Planet.js:118 `uniform int lodLevel;` and the material entry src/objects/Planet.js:1734 `lodLevel: { value: 1 },`. No shader body reads it. The writer already announces its own no-op: src/rendering/objects/BodyRenderer.js:180 `if (!surface?.material?.uniforms?.lodLevel) return this._noteLabSkip('lodLevel', surface);` |

---

## 2. How each row is ruled

- **carried** — the feature still reaches the pixel after the swap. The row names the mechanism.
- **blocking** — the feature stops reaching the pixel **and the lab material already declares the
  uniform that would carry it**, so the loss is an omission in the port's uniform mapping rather
  than a missing capability. These must close before anyone is shown a parity claim.
- **accepted-loss** — the feature stops reaching the pixel and closing it is real work (no lab
  mechanism, or a producer the plan has already fenced out of pack #1). Declared here, in front of
  Max, on this step — which is the whole of what Max's ruling requires of a loss.

⛔ **This ledger cannot mark anything `carried` on the strength of a name.** Every `carried` row
below names either a uniform the pack demonstrably writes, or a per-frame seam that demonstrably
writes it. The 20 name-carried/value-diverged rows are ruled `blocking`, not `carried`.

---

## 3. Channel 1 — the uniform-shaped features

Union of `swapLedgerOf`'s `lost` and `lostAtZero` buckets over the corpus: **43 names**, which with
the 28 name-carried ones accounts for all 71 uniforms the game material declares.

⚠ **`lostAtZero` is not "lost but it was off anyway".** The diff runs at material-creation time, so
every uniform the game writes *per frame* reads zero there — `shadowMoonCount`, `shadowPlanetCount`,
`starPos1/2`, `time`, and `lightDir2` (bound **by reference** to the vector src/main.js:11027
`entry.planet._lightDir2.copy(_sunDir2);` mutates). A ledger that ruled only the `lost` bucket would
declare the transit-shadow and second-star features unaffected. Both buckets are ruled below.

<!-- LEDGER-CH1 -->
| id | uniforms | ruling | evidence |
|---|---|---|---|
| P-01 | `starColor1` `starBrightness1` | accepted-loss | The lab material declares **no star-colour uniform of any kind** — zero of its 356 names contain `star` or `Star`. Every one of the 341 swapped bodies renders under implicit white light; measured, every primary in the corpus is non-white, so this is visible on 341/341. No lab mechanism exists: closing it is a shader change, not a mapping line. |
| P-02 | `lightDir2` `starColor2` `starBrightness2` | accepted-loss | `uLightDir2` does not occur anywhere in `LAB_SHADER_CORPUS`. 125 of 341 swapped bodies sit in a binary; they lose the second star's diffuse term outright. `starColor2`/`starBrightness2` land in `lost` (non-zero) on exactly those 125 and in `lostAtZero` on the other 216 — the split IS the binary population, which is the control that the bucket assignment is reading real values. |
| P-03 | `shadowMoonCount` `shadowMoonPos` `shadowMoonRadius` `shadowPlanetCount` `shadowPlanetPos` `shadowPlanetRadius` `starPos1` `starPos2` | accepted-loss | No lab uniform name contains `hadow`; `uShadow` does not occur in the corpus. 228 of 341 swapped bodies carry 456 moons between them, and every writer of these is guarded (`main.js:9865`/`:9847`) so the loss throws nothing. Transits and planet shadows stop being drawn on swapped bodies. |
| P-04 | `uLimbMix` | carried | **Ledger C20, and it is a real loss as shipped, not a resolved one.** src/objects/Planet.js:1642 `uLimbMix: { value: LIMB_MIX },` with src/objects/Planet.js:1401 `const LIMB_MIX = 1.0;` — the game draws the limb ON, on every body. The lab's master gate is the differently-named planet-lod-uniforms.js:40 `uLimbStrength:   { value: 0.0 },` and the pack does not write it. §12.4 speculated that ruling 4 (`gates = ALL_ON`) might open it; measured, ALL_ON resolves only the pack's own declared gate names — `{bands, jets}` — and touches no uniform default. One mapping line. **⭐ CLOSED at the limbDeck/polarDeck registration commit:** `LIMB_DECK_ENTRY` is in the runtime `PACKS` array, so `uLimbStrength` is written on every admitted gas body and is no longer a loss. Verified by inversion — tests/material-parity-list.test.js now asserts `LEDGER.written` CONTAINS it, so un-registering the pack turns this row red instead of letting the feature leave silently. |
| P-05 | `hasAurora` `auroraColor` `auroraIntensity` `auroraRingLat` `auroraRingWidth` | blocking | The pure alias shape again, four times over: the lab declares `uAuroraColor` `uAuroraIntensity` `uAuroraRingLat` `uAuroraRingWidth`, and a name diff sees four orphans on each side rather than one broken feature. The pack writes none of them, so `uAuroraIntensity` stays at its `0.0` default. 20 of 341 swapped bodies carry a live aurora today. |
| P-06 | `hasClouds` `cloudColor` `cloudDensity` `cloudScale` | accepted-loss | The lab has a cloud system (`uCloudCoverage` `uCloudRegime` `uCloudRelief` `uCloudOpticsIntensity`) but **no cloud-colour uniform**, and none of the four is written by the pack. 21 of 341 swapped bodies draw clouds today. Not a mapping line: the game's `cloudDensity`/`cloudScale` do not map onto `uCloudCoverage`/`uCloudRegime` without a decision about what the lab's regime enum means for a generated body. |
| P-07 | `atmosphereStrength` `atmosphereColor` | accepted-loss | The legacy rim glow. Superseded in intent by the lab's limb optics, which P-04 and P-11 rule; recorded separately because it is a *second* atmosphere term in the legacy shader and folding it silently into the limb row would hide a decision. |
| P-08 | `baseColor` `accentColor` | blocking | The body's own two colours. On the 227 gas-variant bodies the pack's `uBandTint` supplies a tint, but on the **114 rocky-variant** swapped bodies these two uniforms ARE the surface palette, and the lab's palette uniforms (`uCratonColor` `uDustColor` `uDustTint` …) are constants the pack never writes — so those 114 bodies land on one shared palette. |
| P-09 | `uIceColor` `uLavaGlow` `uLavaCrust` | accepted-loss | Per-body ice and lava tints. The lab has `uIcenessAlbedo` `uFrostAlbedo` `uLavaScale` `uLavaGlowRate` `uLavaAxis` — a different parameterisation, not a renamed one, so this is not a mapping line. |
| P-10 | `noiseScale` `noiseDetail` `uNoiseScale` | blocking | `noiseScale` has an exact lab counterpart, `uNoiseScale`, which lands in the **CARRIED** bucket and then diverges in value on **103 of 103** bodies because nothing writes it. This row is the §0 finding in its purest form: name-carried, value-defaulted, invisible to a three-bucket diff. |
| P-11 | `uLimbColor` `uTermColor` `uTermStrength` `uTermWidth` | blocking | The air optics the game already computes per body from `atmosphereOpticsOf(condition)`. Same names on both materials; `uLimbColor`/`uTermColor`/`uTermStrength`/`uTermWidth` diverge on 103/103 bodies and `uLimbExponent` on 99/103. The values exist and are already in hand at material-creation time — the port simply does not carry them across. **⭐ `uLimbExponent` LEFT THIS ROW at the registration commit** — limbDeck writes it, it moved from the diverged bucket into `agreeing` (20 -> 19), and the measured subject set fell 63 -> 62. ⚠ **`uLimbColor` STAYS, and that is a measured finding rather than an oversight:** limbDeck writes it too, yet it still diverges from the game material's value on the compared bodies — so writing a uniform is not the same as agreeing with the game's own derivation of it. The three `uTerm*` names remain because nothing writes them at all. |
| P-12 | `uFreshColor` `uWeatheredColor` `uSedColor` `uBioGroundColor` `uBioGroundCover` `uIcenessMix` | blocking | The world-engine land palette and biosphere cover, all name-carried, all value-defaulted (the four colours on 103/103, `uIcenessMix` on 56/103, `uBioGroundCover` on 7/103). Same shape as P-11 and same cost to close. |
| P-13 | `uMacroOffset` `uDetailOffset` `uCraterOffset` | blocking | The per-body noise seeds, name-carried and value-defaulted on 103/103. ⛔ This is a **distinctness** failure, not a shading one: with the seeds defaulted, every swapped body's surface field is drawn from the same offsets, and the per-body variation left on the whole lab material is **16 uniforms of 356**, measured and pinned by name: 13 band/jet drivers, `uBodyRadius`, `uLightDir` and `uThermalDir`. It is the 5d hex-collapse defect in a different uniform, and no algebraic gate on the pack sees it. |
| P-14 | `uCraterAmp` `uCraterComplexD` `uCraterScale` `uEjectaAmp` `uDispDomainScale` | blocking | The impact record's per-body terms, name-carried and value-defaulted on 103/103. The remaining crater names (`uCraterDensity` `uCraterRelaxation` `uEjectaLump` `uEjectaRampart` `uEjectaStrength` `uTerraceCount` `uVoroCells` `uFwClamp`) agree on every body — because both sides are zero or the same constant, which is agreement by absence and is recorded as such rather than as parity. |
| P-15 | `uReliefMix` `uReliefOctaves` `uReliefGain` `uReliefGainCont` `uReliefNormalGain` `uCraterReliefGain` | accepted-loss | The game's fbmd relief calibration. The lab has its own displacement stack (`uOctaves` `uRedistribution` `uRidgeGain` `uPerturb` …) and replaces this wholesale rather than renaming it, so the game's calibrated gains have nowhere to go. Declared because "the lab does its own relief" is a decision, and an undeclared one would read as an oversight later. |
| P-16 | `planetType` | carried | The legacy branch selector. `carried` here means **the mechanism is replaced by design** — the lab draws from the condition, not from a type label, which is the port's whole thesis — and it must not be read as "nothing was lost at this row". What each branch actually DREW through this switch is ruled loss-by-loss in §4; this row rules only the switch. |
| P-17 | `lodLevel` | accepted-loss | Read by no shader (§1.1). The writer already reports its own skip. Nothing reaches a pixel through this uniform on either side. |
| P-18 | `lightDir` `planetRadius` `time` | carried | The three that genuinely survive, each by a named mechanism and each verified to VARY across bodies on the post-swap material: `lightDir`→`uLightDir` and `planetRadius`→`uBodyRadius` are written by `buildLabPlanetMaterial`, and `time`→`uTime` by the per-frame seam `updateLabPlanetMaterial`. |
<!-- /LEDGER-CH1 -->

---

## 4. Channel 2 — the features drawn in hardcoded GLSL, per `planetType` branch

⚠ **§12.4 channel 3: the branches are mutually exclusive, so no single body witnesses more than
one.** The rows below are therefore per branch, and only branches with **≥1 swapped body on the
measured corpus** are ruled. The live set is derived from the population at test time, so a body
class that becomes swappable in an unruled branch fails the test rather than passing silently.

**How the subject set is derived.** `tests/material-parity-list.test.js` strips comments from the
shipped `PLANET_SHADER_VARIANTS[key].fragmentShader`, isolates `getSurfacePattern` and `main`,
brace-matches every `planetType == N` block, and collects every `float`/`vec2`/`vec3`/`vec4`/`mat3`
local declared inside it. The extraction reproduces all six lines PLAN §6b names by hand —
src/objects/Planet.js:434 `float stormMask = smoothstep(0.78, 0.88, bandVal);`, :437
`float polarDark = smoothstep(0.6, 1.0, abs(vPosition.y) / planetRadius);`, :446
`float hotspot = pow(starFacing, 3.0);`, :451
`float nightSide = max(-dot(normalize(vWorldPos), lightDir), 0.0);`, :407
`float ringNoise = snoise(pos * noiseScale * 2.0) * 0.15;`, :413
`float haze = snoise(pos * noiseScale * 0.7) * 0.08;` — **and 93 more**. Every extracted symbol must
be claimed by exactly one row below; an unclaimed symbol fails the test, which is what makes a new
hardcoded effect in the legacy shader an undeclared loss the build catches.

<!-- LEDGER-CH2 -->
| id | variant | branch | symbols | ruling | evidence |
|---|---|---|---|---|---|
| G-01 | gas | pt1 | `bands` `lat` `turb` `bandVal` `zoneMask` | carried | Zonal banding and its zone/belt split — the one feature the pack genuinely replaces. 11 `uBand*` uniforms written per body plus the `aBand` bake, and 10 of the 16 uniforms that vary across swapped bodies are these. |
| G-02 | gas | pt1 | `storm` `stormColor` `stormMask` | accepted-loss | The great spot. The lab declares the mechanism — planet-lod-uniforms.js:417 `uStormPosSize:    { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },  // xyz center, w angular radius (rad)` and `uStormParams` `uStormColor` `uStormAux` `uStormCount` — but PLAN §5 fences the storm producer out of pack #1 **by name**, and `aStorm` is the one attribute `_createLabSurface` deliberately zero-fills. Declared here rather than left to be discovered on 53 gas giants. |
| G-03 | gas | pt1 | `polarDark` | carried | **Ledger C19.** planet-lod-uniforms.js:425 `uPolarStrength:   { value: 0.0 },` is the lab's gate and it is not written. §12.4 measured that `state.polarStrength`'s only producer lives inside the fenced `applyStormState`, so ALL_ON would open a gate onto a value the game cannot compute — C19 survives ruling 4, and this row is that finding on the game side. **⭐ CLOSED at the registration commit:** `POLAR_DECK_ENTRY` is in `PACKS` and polarDeck writes the eight-name `uPolar*` family from `resolvePolarVortex`, which is shared, three-free, ported code — so the game CAN compute the value §12.4 said it could not. ⚠ `uPolarStrength` is the per-seed PRESENCE coin, not a master gate: it is 0 on roughly 40% of gas bodies BY DESIGN, so a capless giant is not a failed wire. |
| G-04 | gas | pt6 | `bands` `lat` `swirl` | carried | Hot-Jupiter banding, same mechanism as G-01. |
| G-05 | gas | pt6 | `starFacing` `hotspot` `glowColor` `nightSide` | accepted-loss | Day-side thermal hotspot and night-side thermal glow. Neither `uHotspot` nor `uNightSide` occurs in the corpus, and the lab has no substellar-anchored emission term. Population 5 of 341 — measured, the second-rarest of the eight live branches after `rocky pt5`'s single body — and the reason it is ruled anyway is that "rare" is not "declared". |
| G-06 | gas | pt7 | `angDist` `ringNoise` `oceanColor` `oceanMask` `landColor` `landMask` `iceColor` `iceMask` `frozenColor` `frozenMask` | accepted-loss | The eyeball's concentric climate rings, centred on the substellar point, and the four-way ocean/land/ice/frozen palette they drive. No lab counterpart: the lab's climate is latitudinal, not substellar. Population 3 of 341. ⚠ PLAN §12.4's committed seed for this branch, `lab-procedural-20`, carries an eyeball that the predicate does **not** claim — see §6. |
| G-07 | gas | pt10 | `bands` `lat` | carried | Sub-Neptune's subtle banding, same mechanism as G-01. This is the **largest** swapped branch, 166 of 341. |
| G-08 | gas | pt10 | `haze` | accepted-loss | The sub-Neptune haze term. `uHazeColor` and `uHazeMute` exist on the lab material and are not written, so the lab draws its own default haze rather than this one; ruled a loss rather than a mapping line because the game's `haze` is a *pattern* contribution and the lab's is a *tint*. |
| R-01 | rocky | pt0 | `dust` `dustPos` `dustMask` `dustLight` | accepted-loss | The rocky dust mantle. `uDustColor` `uDustTint` `uDustFlatK` `uDustRegionFreq` exist and are unwritten. Population 21 of 341 — one of the 114 the plan's §6b table does not cover. |
| R-02 | rocky | pt2 | `cracks` `h` `ground` `rock` | accepted-loss | Ice cracking and the ground/rock mix. `uCrackScale` `uCrackWidth` `uFrostAlbedo` exist and are unwritten. Population **66 of 341** — the second-largest swapped branch in the whole corpus, and entirely absent from the plan's list. |
| R-03 | rocky | pt5 | `cOld` `terrainNoise` `warpX` `warpZ` `warpedPos` `height` `seaLevel` `landMask` `landElev` `deepOcean` `shallowOcean` `ocean` `oceanDepth` `land` `lowland` `midland` `highland` `peak` `vegElev` `iceNoise` `iceColor` `iceMask` `polar` `lat` `latitude` `latBias` `itcz` `stormTrack` `cloudPos` `cloudMask` `cloudLight` `cn` | accepted-loss | The whole terrestrial world: continents, sea level, the elevation palette, polar caps, the ITCZ and storm-track cloud bands. The lab has its own continent/sea system, so this is replacement rather than deletion — but nothing the pack writes reaches any of it, so the *body's own* continents are gone. Population 1 of 341 on this corpus; ruled in full because the population is a property of the seed range, not of the code. |
| R-04 | rocky | pt9 | `base` `crystal` `glint` `val` | accepted-loss | Carbon-world crystalline facets and their glint. `uFacetAmp` `uFacetCoverage` `uGlintDensity` `uGlintExp` `uGlintTint` exist and are unwritten. Population 26 of 341. |
| S-01 | both | shared | `diff1` `diff2` `diffuse` `shadow1` `shadow2` `starLight` `ambient` | accepted-loss | The two-star diffuse and shadow accumulation every legacy body runs, whatever its branch. Rolls up P-01, P-02 and P-03: the second light, the star colours and the transit shadow terms all enter the pixel here. |
| S-02 | both | shared | `cloudPos` `cloudMask` `cloudLight` `cloudSpeed` `cn` | accepted-loss | The shared cloud layer. Rolls up P-06. |
| S-03 | both | shared | `fresnel` `muTerm` `viewDir` `sunFacing` | accepted-loss | The rim/fresnel term and the terminator band. Rolls up P-07 and P-11. |
| S-04 | both | shared | `pattern` `n` `nOld` `mixFactor` `finalColor` `tt` `val` `shadingNormal` `perturbStrength` `terrainLandMask` | carried | Composition plumbing, not features: the pattern hand-off, the relief mix, the normal perturbation and the final write. The lab performs the equivalent composition in its own shader; there is no per-body quantity here that the other rows do not already carry. |
<!-- /LEDGER-CH2 -->

---

## 5. Named limits — what this ledger does NOT see

⛔ **Recorded with the construct that produced each one.** A false claim of closure is worse than an
open hole, because it tells the next reader not to look.

1. **The diff runs at material-creation time.** Any per-frame divergence is invisible to it. The
   consequence is already visible inside the data: `shadowMoonCount` reads 0 at creation on every
   body and lands in `lostAtZero`, when the live game writes it every frame. §3 rules both buckets
   for exactly this reason, but a future uniform that only ever differs *mid-flight* is not seen at
   all.
2. **`swapLedgerOf`'s CARRIED bucket is a NAME bucket.** Measured: 20 of 28 carried names diverge in
   value. This ledger closes that by ruling value, and the test pins the divergent set. ⚠ **The
   expensive pass runs over the 60-system prefix, not all 200** — building two `Planet`s per body
   costs a subdivision-5 icosahedron each. Measured, not assumed: the same pass over the full 200
   systems returns the identical bucket membership (37 `lost`, 13 `lostAtZero`), so the prefix is
   not lossy today. It could become lossy for a uniform that only ever takes a non-zero value on a
   body in systems 60–199, and that is the limit.
3. **Channel 2 extracts *declared locals*, not features.** A hardcoded effect written without a
   named local — `surfaceColor *= 1.0 - smoothstep(...)` inline — declares no symbol and is
   invisible to the extraction. The six the plan names all happen to be declarations, which is why
   the extraction reproduces them; that is a property of this shader's style, not a guarantee.
4. **Channel 2 covers `getSurfacePattern` and `main` only.** Locals inside the header's helper
   functions (`snoise`, `fbmd`, `craterEjectaCombiner`, the noise scaffolding) are excluded
   deliberately: over the whole fragment source the extraction returns 102 (gas) / 138 (rocky)
   symbols, almost all of them noise-math scratch (`a0` `b1` `gf` `x_`), and a ledger of those would
   be an unranked list of the kind Max's ruling was issued against. The limit is real: a feature
   implemented inside a helper is not ruled here.
5. **The `exotic` variant is unruled, and it is one field away from being live.** Zero of its 20
   branch blocks have a swapped body — but only because the **2** `crystal` bodies the predicate
   claims both lack `_systemSeed` and `_ordinal`, so Step 6d's provenance test refuses them. Scanned
   over 500 systems: 6 exotic-variant bodies claimed, **0** provenanced. If a `crystal`, `hex`,
   `fungal`, `machine` or `ecumenopolis` body ever carries provenance, its branch swaps with no
   ruling. The test derives its live-branch set from the population, so that day is a red build
   rather than a silent loss — and that is not a promise: the situation is **constructed and
   executed** in `⭐⭐ CONTROL THAT MOVED — a newly swappable branch DEMANDS rows`, which re-runs the
   census with the provenance refusal ignored, shows `exotic:13` entering the live set, shows no row
   exists for it, and counts the 9 symbols that would arrive unruled.
6. **Nothing here is a picture.** Every row is a uniform value or a GLSL symbol. Whether the swap
   *looks* acceptable is Instrument E's job and Max's call; this ledger only guarantees that no loss
   reaches him undeclared.

---

## 6. Two corrections the plan needs, which this lane may not make

⛔ Lane C's file set is `tests/material-parity-list.test.js` and this document. Both items below are
edits to `docs/FEATURES/one-pipeline-two-frontends-PLAN.md`, which the orchestrator owns.

1. **§12.4's committed seed for the `planetType == 7` eyeball branch does not swap.**
   `lab-procedural-20`'s eyeball is not claimed by `giantDeck`'s predicate, so at Step 6 it renders
   the legacy program in both frames and the branch's declared losses (G-06) go unwitnessed. The
   LOSS triptych for that branch needs a seed whose eyeball is *claimed*; the corpus contains 3 such
   bodies in 200 systems. ⚠ §12.4 also states the seeds were chosen so the rare branches are
   reachable — this one is reachable and not admissible, which is a different property and the one
   the shot needs.
2. **§6b's five-row loss table is scoped to the gas branch and the swap is not.** 114 of 341 swapped
   bodies render the `rocky` program today (§1). Rows R-01 through R-04 are that gap. The plan's
   "SHIPS GAS GIANTS" heading is accurate about intent and inaccurate about population.
3. **§11.3.4 wants every file a step edited inside `CITE_SOURCES`, and this step's two are not in
   it.** `tools/port-uniform-delta.mjs` is outside lane C's file set, so this is reported rather
   than done. The addition is `'docs/FEATURES/step6-parity-ledger.md'` and
   `'tests/material-parity-list.test.js'` appended to the array at
   tools/port-uniform-delta.mjs:1010 `const CITE_SOURCES = [`. ⚠ **Adding a source and GATING a
   source are different acts** (the comment already in that array says so). All 14 `line + symbol`
   citations in this lane's two files were verified against their target lines by hand before this
   was written — 14 hold, 0 broken — so the addition lands them in the checked column rather than
   the unchecked pile. ⛔ The instrument is **already red** at 27 broken citations, all in
   `PLAN.md` and `port-uniform-delta.mjs` and all pre-existing; none is this lane's.

---

## 7. What is open for Max

Everything ruled **blocking** above is an omission in the port's uniform mapping, not a missing
capability — P-04, P-05, P-08, P-10, P-11, P-12, P-13, P-14. They share one cause: the pack writes
15 uniforms and the game's own material already holds the other values, derived, at the moment the
lab material is built. Closing them is a mapping pass in the lane that owns
`src/rendering/LabPlanetMaterial.js` and `src/objects/Planet.js`, not a shader change.

Everything ruled **accepted-loss** is declared, here, on this step, which is what Max's ruling
requires — but the declaration is not the decision. The ones with a population large enough to
notice are **P-01** (star colour, 341/341), **P-03** (transit shadows, 228 bodies / 456 moons),
**P-02** (second star, 125 bodies), **R-02** (ice cracking, 66 bodies) and **G-02** (the great spot,
53 gas giants).

---

## 8. The controls — every claim above has one that MOVED

§11.3.3 is the clause with no cheap exit: a zero with no control that moved is not evidence of
anything. Each row below is executed, not described. Six live inside
`tests/material-parity-list.test.js`; four were run against the shipped document and are recorded
here because a document mutation cannot live in the file it mutates.

| claim | the control | it moved |
|---|---|---|
| 341 bodies swap | re-run the census with Step 6d's provenance refusal ignored | **343** vs 341, and the two extra are `crystal` — the unruled `exotic` variant |
| `CARRIED: 28` is not 28 surviving features | feed the identical material pair to `swapLedgerOf` and to a value comparison | carried **28**, value-diverged **20** — two answers, one input |
| `lostAtZero` is a real per-body value split | re-run the whole pass with `starInfo = null`, which is what a headless probe reaches for | `starColor2`/`starBrightness2` collapse to `lostAtZero` on every body; with the real `starInfo` they split **125 / 216**, and 125 is exactly the binary population |
| a new hardcoded effect is caught | inject `float wdNewEffect = …` into a copy of the shipped gas source, in the branch the plan's own six live in | the extractor returns it and the partition rejects it |
| the extractor is brace-matched | a branch containing a nested block, read both ways | the naive "up to the next `}`" reader loses the declaration after the nested block |
| a newly swappable branch demands rows | the provenance-ignoring census, re-run against the live-branch check | `exotic:13` enters the live set, **0** rows exist for it, **9** symbols would arrive unruled |
| `lodLevel` is read by no shader | count `lodLevel` in `Planet.js`, then count it again in a copy with one read added | **2** vs **3** |
| the doc's rows are load-bearing | delete `` `uLimbMix` `` from row P-04, run | 3 assertions red, incl. the partition |
| the rulings vocabulary is load-bearing | change P-01's ruling to `fine`, run | 2 assertions red |
| a live branch cannot go unruled | delete row R-02 (`rocky pt2`, 66 bodies), run | `every LIVE branch has rows` red |
| a dead branch cannot be ruled | add a row for `rocky pt3` (lava, 0 swapped bodies), run | `no row rules a branch that has no swapped body` red |

**Instrument status at the end of this lane.** C zero delta (55 uniforms × 526 bodies). B green.
A: one newly-red, `driver-pack-giantdeck 5e`, which is the metallicity lane's and predates this
work; this lane's file enters as NEW with 27 tests and reds nothing. Citations: 27 broken,
pre-existing, none in this lane's files (§6 item 3).

⛔ **What no part of this lane can establish.** Whether the swap LOOKS acceptable. Every row here is
a uniform value or a GLSL symbol; not one pixel was rendered, because this lane may not start a dev
server or drive a browser. Instrument E's DRIVE pair and the per-branch LOSS triptych are the
missing half, and the ledger's job was to make sure that when those shots are taken, **the caption
names losses the machine printed** rather than losses a document remembered.
