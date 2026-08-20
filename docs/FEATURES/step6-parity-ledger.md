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
program today.** `giantDeck`'s predicate is condition-derived — src/worldengine/drivers/index.js:100
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
| LOD1 procedural colour match | Sol's Jupiter/Saturn while textures load | **0 of 341, and structurally 0.** `_applyLOD1Overrides` returns at src/rendering/objects/BodyRenderer.js:298 `if (!profileId) return;` and `worldEngineProvenance` refuses any body that HAS a `profileId`. The two guards are complements: no swapped body can ever reach that path. |
| `lodLevel` | "near-harmless — read by no shader" | **reproduces.** `lodLevel` occurs exactly twice in `src/objects/Planet.js`: the declaration src/objects/Planet.js:118 `uniform int lodLevel;` and the material entry src/objects/Planet.js:1734 `lodLevel: { value: 1 },`. No shader body reads it. The writer already announces its own no-op: src/rendering/objects/BodyRenderer.js:212 `if (!surface?.material?.uniforms?.lodLevel) return this._noteLabSkip('lodLevel', surface);` |

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
| P-05 | `hasAurora` `auroraColor` `auroraIntensity` `auroraRingLat` `auroraRingWidth` | blocking | The pure alias shape, four times over: the lab declares `uAuroraColor` `uAuroraIntensity` `uAuroraRingLat` `uAuroraRingWidth`, so a name diff sees four orphans on each side rather than one broken feature. The pack writes none, so `uAuroraIntensity` stays at its `0.0` default. 20 of 341 swapped bodies carry a live aurora today. ⭐ **INVESTIGATED 2026-08-19 — this is a WIRING row, not the law-choice it was filed as, and no ruling from Max is owed.** PLAN §2 records "two divergent aurora laws", which is true and overstates the gap: **ring latitude, ring width and colour do not differ at all.** `PlanetGenerator.js:501-502` is `0.7 + magneticField*0.2` / `0.15 - magneticField*0.08`; `planet-lod-lab.html:2613-2614` is the same two expressions, the width merely floored at 0.07 — a no-op over the field's own 0-1 range. The 5-entry composition colour table is verbatim identical and the lab's comment says so (*"the PlanetGenerator auroraColors table"*). The laws differ in exactly TWO places: (1) the game scales intensity by stellar wind, `min(1, magneticField*min(uvFlux,50)*0.15)`, where the lab uses the field alone via `labCore.js:1045`; (2) the lab floors the field at 0.6 for gas bodies >= 3.5 R⊕ (`_giantDynamo`), which the game has no equivalent of. ⛔ **And (1) is not choosable: `uvFlux` appears NOWHERE under `src/worldengine/` — it never crosses the condition seam, so the game's intensity law is not expressible by a pack at all.** With standing constraint 3 (REPLACE, not graft) deciding the rest, the lab's law wins by default and this row reduces to forwarding four values. Its visible consequence — which bodies show an aurora — is a UAT look, not a scoping decision. ⚠ Still NOT in Step 9's or Step 10's declared scope; it needs a pack that claims it. |
| P-06 | `hasClouds` `cloudColor` `cloudDensity` `cloudScale` | accepted-loss | The lab has a cloud system (`uCloudCoverage` `uCloudRegime` `uCloudRelief` `uCloudOpticsIntensity`) but **no cloud-colour uniform**, and none of the four is written by the pack. 21 of 341 swapped bodies draw clouds today. Not a mapping line: the game's `cloudDensity`/`cloudScale` do not map onto `uCloudCoverage`/`uCloudRegime` without a decision about what the lab's regime enum means for a generated body. |
| P-07 | `atmosphereStrength` `atmosphereColor` | accepted-loss | The legacy rim glow. Superseded in intent by the lab's limb optics, which P-04 and P-11 rule; recorded separately because it is a *second* atmosphere term in the legacy shader and folding it silently into the limb row would hide a decision. |
| P-08 | `baseColor` `accentColor` | accepted-loss | ⭐ **RE-RULED 2026-08-19, and the original ruling was mine to correct, not Max's to decide.** This row was `blocking` on the reasoning that "on the 114 rocky-variant swapped bodies these two uniforms ARE the surface palette". **They are not.** `PlanetGenerator.js:718-722` states it in source, directly above the world-engine palette it introduced: *"⚠ THIS IS BEDROCK, NOT A WHOLE-BODY COLOUR. It is deliberately NOT used for oceans, ice caps, clouds or gas bands — those are separate layers with their own colours, in the game as in the lab. `baseColor`/`accentColor` below are untouched and still drive them. Substituting this palette for baseColor turns every ocean brown and every gas giant tan (measured)."* So these two drive OCEAN, ICE-CAP, CLOUD and BAND colour — layers the lab parameterises separately and differently (`uCloudCoverage`/`uCloudRegime` per P-06, `uIcenessAlbedo`/`uFrostAlbedo` per P-09, `uBandTint` for gas). §2's own definition of `blocking` requires that **the lab material already declares the uniform that would carry it**; `uniforms.js:138` records the opposite — *"⛔ Do not reintroduce `uBaseColor`: the game's legacy record field `baseColor` is a DIFFERENT quantity the u-prefix rule would wrongly pair with it."* No counterpart name exists, so this row fails the `blocking` test and belongs with P-06 and P-09. ⛔ Step 9 does NOT close it and must not be read as having tried. |
| P-09 | `uIceColor` `uLavaGlow` `uLavaCrust` | accepted-loss | Per-body ice and lava tints. The lab has `uIcenessAlbedo` `uFrostAlbedo` `uLavaScale` `uLavaGlowRate` `uLavaAxis` — a different parameterisation, not a renamed one, so this is not a mapping line. |
| P-10 | `noiseScale` `noiseDetail` `uNoiseScale` | blocking | ⚠ **This row's stated mechanism is wrong in a way that matters, and the correction changes what closing it means.** It says `uNoiseScale` "diverges because nothing writes it" — true of the GAME, but `grep -c uNoiseScale planet-lod-lab.html` is **0**: the lab does not write it either. It sits at the `uniforms.js:10` factory default 4.0 on both sides, so there is no lab law to port. ⭐ **What IS true is stronger:** the two front-ends run the IDENTICAL four-octave stack — `Planet.js:340-345` and `height.glsl.js:690-693` share weights 0.5/0.35/0.2/0.1 and multipliers 0.3/1/2/4, differing only by the P-13 offsets — and `heightNoise.glsl.js:27` names the quantity as shared: *"uNoiseScale — per-planet base feature frequency (the game mirrors its own noiseScale)"*. ⛔ **AND `uNoiseScale` IS THE ONE FREQUENCY IN THE ENGINE WITH NO PHYSICAL SIZE BEHIND IT.** The lab km-keys SIXTEEN feature families through `featureFrequencyFromKm` (chaos, crack, crater, dune, ecuBlock, ecuDistrict, edifice, facet, fluvial, hex, karstDoline, lava, outflow, shat, subPit, subPoly) and `writePackUniforms.js:8` makes that the pack contract — *"Packs emit sizeKm-shaped drivers… the ONE place that turns a size in km into a shader frequency"*. A grep for `macroSizeKm`/`baseSizeKm`/`terrainSizeKm` returns nothing on either side: the BASE TERRAIN field alone still carries a raw frequency, and the game's is `rng.range(2.0,5.0)` off a type-keyed archetype table (`PlanetGenerator.js:346-356`) — a random draw unrelated to how big the body is. ⭐ **THE RULING STAYS `blocking` AND THAT IS DELIBERATE — corrected 2026-08-19 within the hour.** This row was briefly re-ruled `deferred (Max, 2026-08-19)` and `tests/material-parity-list.test.js:772` reddened on it within one run: *illegal ruling "deferred (Max, 2026-08-19)"*. ⛔ **That fence was right and the edit was wrong.** §2 defines exactly three rulings, and `blocking` is the one this row satisfies — the feature does not reach the pixel and the lab material does declare the uniform. **WHEN a blocking row gets fixed is SCHEDULING; it is not a fourth verdict**, and inventing one to record a date would have widened the legal set for every future row that found the three inconvenient. The deferral therefore lives here, in evidence, where it belongs. ⭐ Worth recording that this is the ledger's designed behaviour working on its author: this document is asserted by a test rather than read, which is the only doc-rot defence in the repo that has ever actually fired. **MAX'S SCHEDULING RULING 2026-08-19:** give the base field a characteristic wavelength in km, in the engine's own established shape — ⭐ **but AFTER moons ship.** It is not a Step 9/10 blocker, it moves the surface of ~970 bodies including ones already UAT-passed, and stacking it with the moon change would leave neither with a clean read. `uNoiseScale` stays at 4.0 through Steps 9-10, **deferred, not accepted-loss**. The wavelength comes to Max calibrated against real bodies, not chosen mid-wiring. ⚠ `noiseDetail` has no lab counterpart at all and is NOT covered by that ruling. |
| P-11 | `uLimbColor` `uLimbExponent` `uTermColor` `uTermStrength` `uTermWidth` | blocking | The air optics the game already computes per body from `atmosphereOpticsOf(condition)`. Same names on both materials; `uLimbColor`/`uTermColor`/`uTermStrength`/`uTermWidth` diverge on 103/103 bodies and `uLimbExponent` on 99/103. The values exist and are already in hand at material-creation time — the port simply does not carry them across. **⛔ `uLimbExponent` LEFT THIS ROW at the limbDeck/polarDeck registration AND CAME BACK AT STEP 10a, and the round trip is the finding.** It left because limbDeck writes it, moving from the diverged bucket into `agreeing` (20 -> 19) with the measured subject set falling 63 -> 62. Step 10a registers a fourth pack whose predicate is the COMPLEMENT of limbDeck's, so 163 solid bodies enter the ledger pass that limbDeck never claims; measured over `lab-procedural-0…59`, `uLimbExponent` diverges on **59 of those 163 and on 0 of the 103 gas ones**, and the two figures return to 20 and 63. **That is a real per-body loss on the newly-admitted half, not an instrument artefact** — the game computes an exponent for a solid body and the lab material does not receive it. ⛔ It must not be closed by scoping the ledger pass to the gas half; that would suppress the loss rather than rule it. Closing it means a pack that writes limb optics for non-gas conditions, which is not Step 9's or Step 10's declared scope. ⚠ **`uLimbColor` STAYS, and that is a measured finding rather than an oversight:** limbDeck writes it too, yet it still diverges from the game material's value on the compared bodies — so writing a uniform is not the same as agreeing with the game's own derivation of it. The three `uTerm*` names remain because nothing writes them at all. |
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
| R-05 | rocky | pt3 | `crackGlow` `crust` `h` `melt` | accepted-loss | The lava world's crust/melt split and the glow in its cracks. **Newly live at Step 10a — 52 bodies**, and live for the first time because `rockySurface`'s predicate is `compositionClass(condition) !== 'gas'`; before it, no `lava`-typed body swapped at all. Ruled by §2's own test rather than by choice: the lab HAS a lava mechanism (`uLavaScale` `uLavaGlowRate` `uLavaAxis` `uLavaCoverage`) but it is **a different parameterisation, not a renamed one** — the same reasoning under which P-09 already rules this feature's uniform half (`uLavaGlow` `uLavaCrust`) an accepted loss. `rockySurface` writes none of the four. ⚠ **The SCHEDULING of this row is still Max's, reserved 2026-08-09**; per P-10's precedent the deferral lives here in evidence, because §2 defines exactly three rulings and "deferred" is not one of them. |
| R-06 | rocky | pt4 | `deepOcean` `height` `land` `landElev` `ocean` `oceanDepth` `seaLevel` | accepted-loss | The ocean world's own continents, sea level and depth palette. **Newly live at Step 10a — 6 bodies.** Same subject family and same ruling as R-03, which rules the identical seven symbols on `pt5` and states the reason: the lab has its own continent/sea system, so this is replacement rather than deletion — but nothing `rockySurface` writes reaches any of it, so the *body's own* coastline is gone. The population is a property of the seed range, not of the code, so it is ruled in full at 6. ⚠ Scheduling reserved to Max as in R-05. |
| R-07 | rocky | pt8 | `bands` `lat` `swirl` `val` | blocking | Venus's zonal banding, the same three-symbol mechanism G-04 rules `carried` on the gas `pt6` branch. **Newly live at Step 10a — 130 bodies, the largest of the three newly-live rocky branches.** ⛔ **`blocking`, not `accepted-loss`, and the difference is §2's test rather than a preference:** the lab material declares the whole `uBand*` family and `giantDeck` demonstrably writes it — so the carrier exists and the loss is an omission in the port's mapping. It is unwritten HERE only because `giantDeck`'s predicate is `=== 'gas'` and a venus-typed body's condition is not, so a body that draws bands today swaps to a material whose band deck sits at its 0.0 default. ⚠ Scheduling reserved to Max as in R-05; `blocking` is the conservative direction and claims no closure. |
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
   tools/port-uniform-delta.mjs:1023 `const CITE_SOURCES = [`. ⚠ **Adding a source and GATING a
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

---

## 9. Channel M — the MOON class (PLAN §4 Step 10)

**Why a Step-10 channel lives in a Step-6b document.** Because the machinery is the same and a
second document would be a second version of it. PLAN §4 Step 10's **What** paragraph ends *"Produce
a moon parity list on the Step-6 pattern"*, its **Gate** bullet reads *"Moon parity-list test
green"*, and risk 4's mitigation names Steps **6b and 10** by number. Appending here rather than
forking also keeps §2's three rulings, and the "an accepted loss is allowed; an UNDECLARED loss is
blocking" ruling that produced them, as one vocabulary rather than two.

⛔ **Channel 1 has never contained a moon.** `tests/material-parity-list.test.js` walks
`sys.planets` and builds `new Planet(...)`; a PLAIN moon is a `Moon`, so it is outside that
population by construction, and P-01…P-18's evidence cells each state their own population
explicitly (`341 of 341`, `125 of 341`, `228 of 341`) — none of which is a moon count. So the moon
losses are not "already ruled one class over"; they were undeclared until this channel, and
silently so: the four frame-loop writers that would otherwise have thrown were converted to guards
at src/main.js:11436 `if (mu?.shadowPlanetPos) mu.shadowPlanetPos.value.copy(entry.planet.mesh.position);`
and src/objects/Moon.js:650 `if (mu?.time) mu.time.value += renderDt;`, so every one of these losses
is a silent no-op rather than a crash.

**How it was produced.** Channel 1's derivation, one class over and by the same decision core: BOTH
materials built on the SAME moon record — `setLabGasBodiesOverride(false)` then `(true)` through
`new Moon(...)` with identical `lightDir`, `lightDir2` and `starInfo` — and the pair fed to
`swapLedgerOf`. `tests/moon-lab-mount.test.js` carries the same row table this section does and
**fails when the two disagree**, so this is machine-checked rather than transcribed. Corpus is the
one at the top of this file; nothing here was measured on Sol, which is structurally refused.

### 9.1 The moon populations, measured

| | measured on `lab-procedural-0…199` |
|---|---|
| plain moons — the class Step 10 ships | **632** |
| …that admit with the 6e flag forced ON | **632 of 632 (100%)** — the pack registered at index.js:167 `ROCKY_SURFACE_ENTRY,` applies on `compositionClass(condition) !== 'gas'`, the complement of `giantDeck`'s predicate at §1, and it claims every one; measured types `captured` 139 · `ice` 219 · `volcanic` 67 · `rocky` 207, and **no `gas` moon exists** |
| swapped moons in a binary system | **197** of 632, in **64** binary systems of 200 |
| swapped moons under a **non-white** primary | **632** of 632 — as at P-01, there is no body on which the star-colour loss is invisible |
| swapped moons carrying clouds / atmosphere / aurora | **0 / 0 / 0.** One gate produces all three: src/generation/MoonGenerator.js:211 `clouds: type === 'terrestrial' ? {` and the two literals under it, and **the corpus contains no terrestrial plain moon** |
| uniforms the legacy `Moon.js` material declares | **29** |
| uniforms the lab material declares | **356** |
| …of the 29 in `swapLedgerOf`'s CARRIED bucket | **0** |

⭐ **CARRIED IS EMPTY, and that is the structural difference from Channel 1.** There, 28 names sat
on both materials and §0's whole finding was that a name bucket reads as 28 surviving features and
is 8 at most. Here the two materials share **no name at all** — every legacy moon uniform is
lowercase and every lab uniform is `u`-prefixed — so `lost ∪ lostAtZero` is the complete 29 and
there is no name-carried/value-diverged class to mis-read. The three features that DO survive
(M-11) survive by a **rename plus a named mechanism**, and each is asserted live in
`tests/moon-lab-mount.test.js` rather than inferred from a name.

⚠ **`lostAtZero` is not "lost but it was off anyway"** — the same caveat §3 records, and on moons it
has two clean controls. `starColor2`/`starBrightness2` split **197 lost / 435 lostAtZero**, and 197
is exactly the binary population. `moonType` splits **493 lost / 139 lostAtZero**, and 139 is
exactly the `captured` population, whose type index is 0. Both buckets are ruled below.

### 9.2 The rows

<!-- LEDGER-MOON -->
| id | uniforms | ruling | evidence |
|---|---|---|---|
| M-01 | `starColor1` `starBrightness1` | accepted-loss | P-01's mechanism on the moon population. **No lab uniform name contains `star` or `Star`** — measured over all 356. The legacy moon shader spends both in one expression, src/objects/Moon.js:541 `vec3 starLight = starColor1 * diff1 * starBrightness1 * shadow1`, so a swapped moon is lit implicit white. **632 of 632** sit under a non-white primary, so as at P-01 there is no body on which the loss is invisible: a red dwarf's moon and a B-star's moon become indistinguishable. Closing it is a shader change, not a mapping line. |
| M-02 | `lightDir2` `starColor2` `starBrightness2` | accepted-loss | P-02's mechanism on the moon population. `uLightDir2` occurs nowhere in `LAB_SHADER_CORPUS`; the lab has one light. **197 of 632** sit in a binary and lose the second star's diffuse term outright — src/objects/Moon.js:513 `float diff2 = max(dot(shadingNormal, lightDir2), 0.0);` and three further sites. `starColor2`/`starBrightness2` land in `lost` on exactly those 197 and in `lostAtZero` on the other 435; **the split IS the binary population**, which is the control that the bucket assignment is reading real values rather than defaults. |
| M-03 | `shadowPlanetPos` `shadowPlanetRadius` `starPos1` `starPos2` | accepted-loss | P-03's mechanism on the moon population, and the one loss whose *writers* had to be neutered for Step 10 to ship at all. **No lab uniform name contains `hadow`.** The parent planet eclipsing its own moon is src/objects/Moon.js:536 `shadow1 = sphereShadow(vWorldPos, starPos1, shadowPlanetPos, shadowPlanetRadius);` and it stops on **632 of 632**. All four writers are guarded — src/main.js:11437 `if (mu?.shadowPlanetRadius) mu.shadowPlanetRadius.value = entry.planet.data.radius;`, src/main.js:11438 `if (mu?.starPos1) mu.starPos1.value.copy(_star1Pos);`, src/main.js:11439 `if (mu?.starPos2) mu.starPos2.value.copy(_star2Pos);` and the `shadowPlanetPos` sibling above them — so the loss throws nothing and reports nothing. ⚠ This is the row a transit UAT will find first: a swapped moon no longer darkens when its parent passes in front of the star. |
| M-04 | `moonType` | accepted-loss | ⛔ **MOON-NATIVE — no planet row covers it and none can, because the quantity does not exist on the planet material.** P-16 rules `planetType` `carried` on the ground that the branches it selects are ruled loss-by-loss in Channel 2; **there is no Channel 2 for moons**, so the same ruling here would claim a coverage that does not exist. `moonType` is not only a branch selector: it drives the per-type surface pattern, the per-type `perturbStrength` and the per-type diffuse ramp across roughly forty lines of src/objects/Moon.js:133 `uniform int moonType;`. Neither `moonType` nor `uMoonType` occurs anywhere in the lab corpus — the lab draws from the CONDITION, not from a type label, which is the port's thesis — so §2's `blocking` test (the lab already declares the carrier) is not met and this is replacement rather than a mapping line. Population **632 of 632**, split 493 `lost` / 139 `lostAtZero` on the `captured` index-0 population. |
| M-05 | `hasClouds` `cloudColor` `cloudDensity` `cloudScale` | accepted-loss | P-06's mechanism on the moon population: the lab has a cloud system (`uCloudCoverage` `uCloudRegime` `uCloudRelief` `uCloudOpticsIntensity`) and **no cloud-colour uniform**, and `rockySurface` writes none of the four. ⚠ **MEASURED POPULATION: 0 of 632.** Clouds are terrestrial-only and the corpus carries no terrestrial plain moon, so this loss has no witness here — it is DECLARED rather than discovered, which is the point of the row. Across 2000 seeds a cloudy plain moon runs 8 in 6295 (0.13%). |
| M-06 | `hasAtmosphere` `atmosphereColor` `atmosphereStrength` | accepted-loss | P-07's mechanism on the moon population: the legacy rim glow, superseded in intent by the lab's limb optics. **No lab uniform name contains `Atmos`.** ⚠ **MEASURED POPULATION: 0 of 632**, same terrestrial-only gate as M-05. |
| M-07 | `hasAurora` `auroraColor` `auroraIntensity` `auroraRingLat` `auroraRingWidth` | accepted-loss | P-05's subject family, one class over, and the ruling differs from P-05's **because the population does**. The lab DOES declare the carriers (`uAuroraColor` `uAuroraIntensity` `uAuroraRingLat` `uAuroraRingWidth`, all unwritten by `rockySurface`), which is why P-05 is `blocking` at 20 of 341 live planets. ⚠ **MEASURED POPULATION HERE: 0 of 632** — same terrestrial-only gate as M-05 — so §2's `blocking` first conjunct ("the feature stops reaching the pixel") is not satisfied on any moon, and ruling it `blocking` would invent an obligation over an empty set. ⛔ **If `MoonGenerator` ever gives a non-terrestrial moon an aurora, §2's test moves this row to `blocking` on the same day**; that is a consequence of the test, not a fourth verdict, and it is recorded here for the same reason P-10 records its scheduling in evidence. |
| M-08 | `baseColor` `accentColor` | accepted-loss | P-08's mechanism on the moon population, and P-08's re-ruling applies verbatim: these are palette endmembers for layers the lab parameterises separately, and **no counterpart name exists** — src/worldengine/shaders/uniforms.js:138 `uWeatheredColor:    { value: new THREE.Color(0.46, 0.40, 0.34) },` carries the standing instruction not to reintroduce `uBaseColor`, because the game's record field is a different quantity. §2's `blocking` test therefore fails and this belongs with M-05. Population **632 of 632**. |
| M-09 | `noiseScale` | blocking | P-10's row, on the moon population, and it is the one row here that meets §2's `blocking` test: **the lab material already declares the carrier.** `uNoiseScale` sits at its factory default `4.0` on every swapped moon while the game draws a real per-moon value — measured range **4.83 … 510.6** over the 632, with **0 of 632** equal to 4.0, and the scene record rescales it further. ⛔ **`blocking` is the ruling; the SCHEDULING is Max's and already given at P-10 — the base field gets a characteristic wavelength in km AFTER moons ship.** So this row is expected to be open at Step 10's gate and is not a Step-10 blocker; per P-10's own precedent the deferral lives in evidence, because §2 defines exactly three rulings and "deferred" is not one of them. ⚠ `noiseDetail` has no moon-side equivalent — the legacy moon material never declared one — so P-10's uncovered half does not recur here. |
| M-10 | `lodLevel` | accepted-loss | P-17's row, on the moon population: read by no shader on either side, and the writer already announces its own no-op at src/rendering/objects/BodyRenderer.js:212 `if (!surface?.material?.uniforms?.lodLevel) return this._noteLabSkip('lodLevel', surface);`. This is the **one** loss in the whole channel that is WITNESSED at runtime rather than merely declared — `labSkips.lodLevel` counts it, and `tests/moon-lab-mount.test.js` asserts the counter moves on a swapped moon. ⚠ The other ten rows have no such counter: `_noteLabSkip` has exactly two call sites in the whole tree, `lodLevel` and `baseColor`. |
| M-11 | `lightDir` `moonRadius` `time` | carried | P-18's three, moon-side, each by a rename plus a named mechanism and each asserted LIVE rather than by name — which matters more here than at P-18 because the CARRIED bucket is empty, so a name argument was never available. `lightDir`→`uLightDir` and `moonRadius`→`uBodyRadius` are written by `buildLabPlanetMaterial`; `time`→`uTime` by the per-frame seam `updateLabPlanetMaterial`, which **Step 10 had to add to `Moon.updateRender` for this row to be true at all** — before it the clock stayed at 0 forever on every swapped moon. ⛔ `uLightDir` is OBJECT-space where the legacy `lightDir` was world-space and bound by reference, so "carried" here means re-derived every render tick, not shared. All three are fenced in `tests/moon-lab-mount.test.js` (uTime advances, uLightDir changes under rotation, uBodyRadius equals the geometry's radius) with a committed mutant on the seam. |
<!-- /LEDGER-MOON -->

### 9.3 Named limits — what Channel M does not see

⛔ Recorded with the construct that produced each one, on §5's pattern.

1. **§5's limits 1-4 all recur unchanged.** The diff still runs at material-creation time, so a
   per-frame divergence is invisible; a feature implemented inside a GLSL helper or inline with no
   named local is still unclaimable.
2. **THERE IS NO CHANNEL-2 EQUIVALENT FOR MOONS.** Channel 2 brace-matches `planetType == N`
   branches out of the shipped planet shader and demands a row per symbol. The moon shader
   branches on `moonType` in a different shape and no extractor was written for it, so a new
   hardcoded effect in `Moon.js`'s GLSL is **not** caught the way a new one in `Planet.js`'s is.
   M-04 rules the switch and the per-type look together, which is coarser than Channel 2's
   per-symbol partition and is stated as coarser rather than presented as equivalent.
3. **The pass builds from the RAW generator record, not the scene record.** `src/main.js` rescales
   `radius`, `noiseScale` and `clouds` when it builds a moon's scene record, so the *values* here
   are one transform away from the shipped body. That does not move any name into or out of a
   bucket — which is what this channel rules — but no value quoted here should be read as the
   number a frame contains.
4. **Ten of the eleven rows are declared, not witnessed.** Only M-10 has a runtime counter. Nothing
   in the tree reports at run time that a swapped moon stopped drawing its eclipse or its second
   star; those losses are visible only in this document and in the test that re-derives it.
