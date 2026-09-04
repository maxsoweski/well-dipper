# Does all World Engine rendering reach the game? — the BAKE-vs-PACK audit

Repo `/home/ax/projects/well-dipper`, branch `feature/world-engine-production-L1`, HEAD `c1816e3`.
READ-ONLY. Measurement scripts + raw JSON in this scratchpad
(`bake-audit.mjs` / `bake-audit.json`, `bake-phase2.mjs` / `bake-phase2.json`).

## 0. Harness validation (do not skip — this is why the numbers are trustworthy)

The measurement reproduces Max's live chrome-devtools read on `rocky-2` planet 1 to every digit
it printed:

| quantity | live read | this audit |
|---|---|---|
| `uReliefBakeStrength` | 0.857 | 0.8573491232180362 |
| `uCraterBakeRestore`  | 0.143 | 0.14265087678196375 |
| `uVolcanismStrength`  | 0.29  | 0.29 |
| `uEdificeMaxHeight`   | 1.95  | 1.9455893493957521 |
| `uAuroraIntensity`    | 0.055 | 0.05493385855037726 |
| `uMountainAmp` … `uMassWastDensity` | 0 | 0 (never written by any pack) |

Corpus: the 24 standard seeds `rocky-0`…`rocky-23`, 156 bodies, **124 solid + 32 gas**.
`LAB_GAS_BODIES_DEFAULT = true` (`src/objects/Planet.js:2158`), so `labPipelineAdmits` admits
**124 of 124 solid and 32 of 32 gas** — every body in the corpus draws with the LAB material
(`LAB_FRAGMENT_SHADER` + `HEIGHT_GLSL`), not the legacy game shader. Gate policy = the production
default `GATE_POLICY_RULED`.

---

## 1. The bake path, end to end

```
Planet._createLabSurface(…)                     src/objects/Planet.js:2016
  └─ attachLabBake(surface, {condition, macroSeed, T_eq, radiusEarth})   Planet.js:2076
       src/rendering/bake/labBakeHost.js
       · deferred to the body's FIRST DRAW (surface.onBeforeRender gives it the renderer)
       └─ provinceWorker.js  (module Worker; falls back to inline)
            └─ buildLabBundleForBody()            src/rendering/bake/provinceDispatch.js:175
                 └─ buildProvinceForBody()                              :102
                      └─ makeSphereField(sharedCarrierMesh())   40000 nodes / lloyd 4
                      └─ writeBodyRelief(carrier, {...})
                           src/worldengine/dispatch/bodyRelief.js:78
```

`writeBodyRelief` is the **5-way condition-derived dispatch**. Exactly one of five closures runs and
each one **REPLACES** `carrier.height` (`=`, never `+=`):

| closure | writer module | landforms it authors | F-rows | bodies (of 124) | of those, `uReliefBakeStrength > 0` |
|---|---|---|---|---|---|
| `plate()` | `base/plates.js` `writePlateUpliftSphere` | convergent-boundary uplift = **ranges**; divergent-boundary lows = **rift valleys**; cratonic interiors | **F1**, **F4** | **0** | 0 |
| `shell()` | `base/shellRelief.js` `writeShellReliefSphere` | despin + diurnal steered **lineaments / double-ridges** (crest, shoulder, central trough); **chaos** overlay (foundered blocks + raised matrix) | **F10**, **F9** | **83** | **47** |
| `unbrokenLid()` → `lid-weak` | `base/magmatism.js` `writeMagmatismSphere` (via `base/lidResponse.js`) | plume-top **shield/edifice** crest profile + Walcott moat; province swell dome; effusive **lava-plain** flooding; substellar **magma-ocean basin**; wrinkle ridges | **F7**, **F8**, F41 | **4** | **4** |
| `unbrokenLid()` → `lid-strong` / `stagnantLidDirect()` | `base/stagnantLid.js` `writeStagnantLidReliefSphere` | **tessera plateaus** (crossed fold+ribbon fabric), **coronae** (domed/trench/rim), young **basaltic plains** datum, **rift corridors** | **F6**, **F8**, **F4** | **10** | **10** |
| `despun()` | `base/tectonic.js` `writeGrainSphere` + `writeHeightSphere` | latitude-band stress relief + `e6plateau` blob detail | none cleanly | **27** | **22** |

Then the **post-dispatch universal writes** (`bodyRelief.js:188-195`), which run on *every* path:

| call | channel written | reaches the game? |
|---|---|---|
| `writeAccommodation` / `initSedimentHost` | host channels | indirect only |
| `writePassiveMargins` | `carrier.shelfDepth` | **plate path only ⇒ 0 of 124 bodies.** Measured: `shelfDepth` allocated on 124, **non-zero on 0** |
| `writeProvince` | `carrier.province` (Uint8) | ✅ → `uProvinceCube` → `uCratonColor/uFreshColor/uSedColor`, all 124 (shipped 2026-09-02) |
| `writeBombardment` | `carrier.craterField` (signed) | ✅ → the **crater cube**, but only where `compositeMargins` runs — measured **42 of 124** |
| `deriveReliefBudget` / `deriveSurfaceMaterial` / `deriveFigureDescriptor` | return-object fields | budget threads into `compositeMargins` |

The bundle then runs `route()`'s composite (`provinceDispatch.js:186`):
`compositeMargins(carrier, relief.reliefBudget, craterOverlay)` — `src/worldengine/rivers/router.js:178`.
**It returns `null` unless `shelfDepth` OR `craterField` has a non-zero entry.** With `shelfDepth`
zero everywhere (no plate bodies), the composite runs **only on the 42 bodies with craters**, and
`craterOverlay` — the crater cube's whole content — stays **all-zero on the other 82**.

`heightCube.js` rasterizes `marginHeight`/`marginGrad` into the 256² HalfFloat cube
(`R = height, GBA = tangent gradient`); `carveCube.js` does the same for the routed valley
geometry. `labBakeHost.js:428 bindRiverHalf` binds them with three nested gates:

* **relief + crater cubes** — every solid body that bakes (**124**).
* **carve cube (`uRiverCarveMap`)** — `routed = fluvialClassOf(cond) !== 'airless'` ⇒ wet ∪ relict = **68**.
* **ribbon mesh + histogram sea + `applyCarveAmounts` (`uRiverCarveStrength/Floor/Depth/Rough`)** —
  `wet` only ⇒ **2 of 124**.

Measured fluvial split: `relict 66 / airless 56 / wet 2`.

---

## 2. Does the baked cube MODULATE the surface? Yes — it *replaces the base field, proportionally*

`src/worldengine/shaders/planetShaders.glsl.js:261-277`:

```glsl
vec4 hd;
if (uReliefBakeStrength > 0.0) {
  vec4 baked = sampleBakedRelief(vObjN);          // textureCube(uReliefBakeCube, …)
  vec4 synth = fbmd(vPos, uOctaves, fwBase);      // the in-shader analytic body
  hd = vec4(baked.x * uReliefBakeStrength, baked.yzw * uReliefBakeStrength)
     + synth * (1.0 - uReliefBakeStrength);       // §C.3 LOCKED blend
} else {
  hd = fbmd(vPos, uOctaves, fwBase);              // VERBATIM pre-bake path, NO cube fetch
}
if (uCraterBakeRestore > 0.0) {
  vec4 cr = sampleBakedCraters(vObjN);
  hd += vec4(cr.x * uCraterBakeRestore, cr.yzw * uCraterBakeRestore);   // signed ADDITIVE
}
```

So: **the relief cube REPLACES the analytic base body at weight `s`** (it is a crossfade, not an
addition — the synth term is scaled by `1-s`). The **crater cube ADDS** at `1-s`. Every one of the
23 `*Combiner` calls then adds on top of `hd` at full amplitude — the bake does **not** feed them.

`s = bakeReliefCrossover(visScaleOf(radiusEarth))` = `1 - smoothstep(0, 1, |log2(R^0.5)|)`
(`base/labCore.js:64,144`). Measured over the 124 solid bodies:

* **`s > 0` on 83**, range 2.5e-5 … 0.99994, mean 0.458.
* **`s == 0` on 41** — every one of them a body with `R ≤ 0.219 R⊕` (small moons). On those the
  shader takes the `else` branch and **the lab's relief writer contributes literally nothing**;
  `uCraterBakeRestore` is 1.0 there, so those bodies are *analytic fbmd + full baked craters*.
* `carrier.height` carries real signal on **124 of 124** (std 0.022–0.272), so the 41 zeros are a
  *display-crossover* loss, not an empty writer.

Combined route table for the bake (measured, `bake-phase2.json`):

| | crater cube live | crater cube zero |
|---|---|---|
| **relief cube live** (`s>0`) | 8 | 75 |
| **relief cube zero** (`s=0`) | 34 | 7 |

⇒ **lab macro relief reaches pixels on 83 of 124; baked craters on 42 of 124; 7 bodies get neither.**

---

## 3. The uniforms that read 0 — (a) never written, or (b) written but zero?

Every solid body resolves 4 packs: `rockySurface`, `solidOptics`, `solidFeatures`, `fluvialDeck`.
Across the whole registry the packs write **74 distinct names**. The following names are read by
`src/worldengine/shaders/height.glsl.js` and **appear in NO pack's `*_UNIFORMS` list and in no
pack's resolved drivers on any of the 124 bodies** — i.e. case **(a): never written**, so they hold
`makeUniforms()`'s factory `0.0` forever and their combiner early-outs on line 1:

| uniform | shader combiner | F-row | lab producer that IS NOT forwarded |
|---|---|---|---|
| `uMountainAmp` | `mountainCombiner` :1456 | F1 | `labCore.js:793 mountainAmp` |
| `uChasmaDepth` | `canyonCombiner` :2232 | F4 | `labCore.js:823 chasmaDepth` |
| `uScarpStrength` | `scarpCombiner` :2276 | F5 | `labCore.js:840 scarpStrength` |
| `uPlateauStrength` | `plateauCombiner` :2386 | F6 | `labCore.js:858 plateauStrength` |
| `uTesseraStrength` | `tesseraCombiner` :2433 | F6 | `labCore.js:864 tesseraStrength` |
| `uLavaCoverage` | `lavaCombiner` :2515 | F8 | `labCore.js:897 lavaCoverage` |
| `uDuneDensity` | `duneCombiner` :1252 | F15 | lab GUI state (`world-engine-lab.html:5113`) |
| `uDustDepth` | `dustCombiner` :1306 | F16 | lab GUI state (`:5121`) |
| `uSubStrength` (+ `uVolatileSpecies`) | `subCombiner` :3006 | F18 | `labCore.js:999 subStrength` |
| `uMassWastDensity` | `massWastCombiner` :1362 | F19 | lab GUI state (`:5127`) |
| `uKarstDensity` | `karstCombiner` :1189 | F21 | lab GUI state (`:5103`) |
| `uFacetStrength` | facet spark | F43 | — |
| `uBioCoverage` | bio mats | F46 | — |
| **`uFluvialDensity`** | **`fluvialCombiner` :1018** | **F11's in-shader half** | pinned to 0.0 in the lab too (`:5518`, the retired worm-trail) |

**This is a wiring gap, not an absent law.** `deriveUniforms` in `src/worldengine/base/labCore.js`
computes `mountainAmp`, `chasmaDepth`, `scarpStrength`, `plateauStrength`, `tesseraStrength`,
`lavaCoverage`, `subStrength` per body and the lab writes them every frame
(`world-engine-lab.html:5369, :5376, :5381, :5388, :5393, :5422, :5478`). No driver pack forwards
any of them, so the game's copy of the same shader runs those combiners at zero.

Case **(b) — written by a pack but resolving to 0 on this body**:

| uniform | pack | written on | non-zero on |
|---|---|---|---|
| `uVolcanismStrength` (F7) | `solidFeatures` | 124 | **103** |
| `uEdificeMaxHeight` (F7) | `solidFeatures` | 124 | 124 (default 1.0) |
| `uCryoActivity` (F9 + F10 gate) | `solidFeatures` | 124 | **34** |
| `uGlacialStrength` (F17) | `solidFeatures` | 124 | **28** |
| `uFrostMaxCoverage` (F22) | `solidFeatures` | 124 | **49** |
| `uCraterDensity` (F2) | `rockySurface`/`craterDeck` | 124 | **82** |
| `uRayBrightness` (F3) | `rockySurface`/`craterDeck` | 124 | **56** |
| `uDeltaDensity` (F12) | `fluvialDeck` | 124 | **68** |
| `uOutflowDensity` (F13) | `fluvialDeck` | 124 | **68** |
| `uLiquidMask` (F14) | `fluvialDeck` | 124 | **2** |
| `uCoastStrength` (F20) | `fluvialDeck` | 124 | **2** (pack) — the bake host writes 1.0 on the 2 wet bodies |
| `uStrandStrength` (F20) | `fluvialDeck` | 124 | 101 |
| `uAuroraIntensity` (F37) | `solidOptics` | 124 | **46** |
| `uTermStrength` (F35) | `solidOptics` | 124 | **0** — RULED off (`TERMINATOR_ENABLED = false`) |

`rocky-2` p1 specifically: `uCraterDensity 0`, `uCryoActivity 0`, `uGlacialStrength 0`,
`uFrostMaxCoverage 0`, `uRayBrightness 0` — all case (b), zero for that body's condition (a
relict, air-bearing, warm, uncratered shell body), not case (a).

---

## 4. Aurora (F37) — resolved: it is the LAB's law

`src/worldengine/drivers/solidOptics.js:86,105` calls `auroraOpticsOf(condition)` from
`src/worldengine/base/auroraOptics.js`, whose own header settles the question explicitly:

> "Two aurora laws exist. The GAME's, at `src/generation/PlanetGenerator.js:481`
> `const auroraIntensity = Math.min(1.0, magneticField * windIntensity * 0.15);`, scales the field
> by stellar-wind flux — and `uvFlux` appears NOWHERE under `src/worldengine/`… The LAB's uses the
> field alone. The ledger row already ruled the consequence: *the lab's law wins by default and this
> row reduces to forwarding four values*… ⛔ DO NOT PORT uvFlux."

The intensity is read straight off `deriveUniforms` (labCore) — "the magnitude law has exactly one
expression and it is still labCore's". The three shape/colour values are the lab's post-process
moved verbatim from `world-engine-lab.html:2614-2630`.

Because `labPipelineAdmits` puts all 124 solid bodies on the lab material, the game's
`Planet.js:1720 auroraColor` legacy uniform is never compiled into their shader at all. Measured:
`uAuroraIntensity` non-zero on **46 of 124**, 46 distinct values.

**⇒ The plan's `F37 | ✅ | ❌ R | two divergent laws today` row is STALE, exactly like F22/F23/F29.
F37 is wired, it is the lab's law, and it renders on 46 of 124 solid bodies.** One documented
deliberate omission: the lab's `_giantDynamo` 0.6 floor for gas bodies ≥3.5 R⊕ is not in the
module, and it is unreachable from `solidOptics` (predicate `!== 'gas'`).

---

## 5. F-row verdict table

Route legend: **P** = driver-pack uniform · **B** = bake cube · **N** = neither.

| F | feature | route | live on N of 124 solid | verdict |
|---|---|---|---|---|
| F1 | mountains / ranges | B only (`plates.js` in the bake) — `uMountainAmp` never written | **0** (no body takes the plate path) | **CANNOT** today |
| F2 | craters | P (`uCraterDensity` 82) **+** B (crater cube 42) | 82 via pack, 42 via bake | REACHES |
| F3 | ejecta & rays | P (`uRayBrightness`) | 56 | REACHES |
| F4 | canyons / rifts | B only (rift corridors in `stagnantLid`, rifts in `plates`) — `uChasmaDepth` never written | 10 (stagnant-lid, all `s>0`) | **CONDITIONAL** — bake only, no combiner |
| F5 | scarps & faults | **N** — `uScarpStrength` never written; no bake writer authors scarps | **0** | **CANNOT** |
| F6 | plateaus / tessera | B only (`stagnantLid` tessera fold+ribbon) — `uPlateauStrength`/`uTesseraStrength` never written | 10 | **CONDITIONAL** — bake only |
| F7 | volcanic edifices | P (`uVolcanismStrength` 103 / `uEdificeMaxHeight`) **+** B (`magmatism` shields, 4) | **103** | REACHES |
| F8 | lava plains & flows | B only (`magmatism` flooding 4, `stagnantLid` plains 10) — `uLavaCoverage` never written | 14 | **CONDITIONAL** — bake only |
| F9 | chaos / disrupted | P (`uCryoActivity` 34) **+** B (`shellRelief` chaos overlay, 47 live) | 34 in-shader, 47 in bake | REACHES |
| F10 | ridged / grooved icy | P (`uCryoActivity` 34) **+** B (`shellRelief` lineaments/double-ridges, 47 live) | 34 / 47 | REACHES |
| F11 | river networks | B (ribbon mesh + carve cube). **`uFluvialDensity` ≡ 0 ⇒ `fluvialCombiner` is dead in-shader** | ribbon **2**, carve cube 68 | **CONDITIONAL** (2 wet bodies) |
| F12 | deltas & fans | P (`uDeltaDensity` 68) + carve cube G channel | 68 | REACHES |
| F13 | outflow channels | P (`uOutflowDensity` 68) + carve cube B channel | 68 | REACHES |
| F14 | lakes & seas | P (`uLiquidMask`) + host sea override | **2** | CONDITIONAL |
| F15 | dunes & wind forms | **N** — `uDuneDensity` never written | **0** | **CANNOT** |
| F16 | dust mantles | **N** — `uDustDepth` never written | **0** | **CANNOT** |
| F17 | glacial landforms | P (`uGlacialStrength`) | **28** | REACHES |
| F18 | sublimation | **N** — `uSubStrength` + `uVolatileSpecies` never written | **0** | **CANNOT** |
| F19 | mass-wasting | **N** — `uMassWastDensity` never written | **0** | **CANNOT** (matches "inert") |
| F20 | coastlines | P (`uCoastStrength` 2 / `uStrandStrength` 101) + host | 2 coast / 101 strand | CONDITIONAL |
| F21 | karst | **N** — `uKarstDensity` never written | **0** | **CANNOT** |
| F22 | polar caps & frost | P (`uFrostMaxCoverage`) | 49 | REACHES (plan correct) |
| F37 | aurorae | P (`uAuroraIntensity`, the **lab's** law) | **46** | **REACHES — plan row stale** |
| F41 | hemispheric magma ocean | B only (`magmatism` substellar basin) | ≤4 | CONDITIONAL |
| F43 | crystalline facets | **N** — `uFacetStrength` never written | 0 | CANNOT |
| F46 | bioluminescent mats | **N** — `uBioCoverage` never written | 0 | CANNOT |
| — | province ground palette | B (`uProvinceCube`) + P (`uCratonColor/uFreshColor/uSedColor`) | 124 | REACHES (shipped) |
| — | passive margins / shelves | B — `writePassiveMargins`, plate path only | **0** | CANNOT today |

---

## 6. Answer

**Six lab relief features reach game pixels through the bake cube that the plan's F-spine scores
`❌`, and five more genuinely cannot render at all.** The bake is a real second route and the
plan's table does not model it. `writeBodyRelief`'s 5-way dispatch runs the lab's own generative
writers over the lab's own 40 000-node mesh in a Worker and the result is crossfaded into the
surface at `uReliefBakeStrength` — so `shellRelief`'s lineaments/double-ridges and chaos (F10/F9,
83 bodies, 47 with a non-zero crossover), `stagnantLid`'s tessera plateaus, coronae, rift corridors
and basaltic plains (F6/F4/F8, 10 bodies, all live), `magmatism`'s shields, moats, lava flooding and
substellar magma basin (F7/F8/F41, 4 bodies, all live) and `bombardment`'s craters (F2, 42 bodies)
**are all already in the game**, at low/mid frequency, on 83 of 124 solid bodies. What does **not**
reach the game is the *other* half of each of those features — the in-shader analytic combiner. Thirteen
master gates (`uMountainAmp`, `uChasmaDepth`, `uScarpStrength`, `uPlateauStrength`,
`uTesseraStrength`, `uLavaCoverage`, `uDuneDensity`, `uDustDepth`, `uSubStrength`,
`uMassWastDensity`, `uKarstDensity`, `uFacetStrength`, `uBioCoverage`) are computed per body by
`labCore.deriveUniforms` and written every frame by the lab, and **no driver pack forwards a single
one**, so those combiners early-out on line 1 in the game on every body. F5 scarps, F15 dunes, F16
dust, F18 sublimation, F19 mass-wasting and F21 karst have neither route and are flatly absent —
the honest `CANNOT`. F1 mountains is the sharpest finding: its bake route exists (`plates.js`) but
**zero of the 124 corpus bodies take the plate path**, so the one feature the table calls out first
renders through neither road. And three further gaps the table does not name at all: the display
crossover is exactly 0 on the 41 bodies under 0.22 R⊕, so every small moon draws the pre-bake
analytic body; `writePassiveMargins` never fires (plate-only); and the crater cube is all-zero on 82
of 124 because `compositeMargins` returns `null` without a non-zero `shelfDepth` or `craterField`.
