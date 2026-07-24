# FORM-SIZE-MAP — every pathway that sets the ON-SCREEN size of a surface form

**Workstream:** world-engine-radius-display-scale-2026-07-24 · **HEAD:** `21d3e4f` (post-UAT-fail, back to `building`)
**Grounding agent, 2026-07-24.** Files: `planet-lod-lab.html` (6969 L), `planet-lod-height.glsl.js` (3081 L), `planet-lod-lab-core.js` (1056 L), `src/worldengine/base/{bombardment,baseStep,sphereField}.js`, `tests/vis-scale-fence.test.js`.

Max's ratified bar (verbatim): *"I want to be able to make the planet bigger with the radius slider. I want the forms on the surface of the planet to remain the same size while the planet itself gets bigger. That's it."*

---

## 0. The one equation everything hangs on

Relief in this lab is **shaded, not displaced**. The planet is a smooth `SphereGeometry(R,256,256)`, `R=1.0` (`planet-lod-lab.html:1451`, comment `:1534` "relief is shaded-not-displaced"). Every "form" is a **height/normal field evaluated per-fragment in object space on the unit sphere**, then the whole sphere is scaled by `planet.scale.setScalar(sVis)` (`:5656`). No vertex is moved by terrain; there is no displaced crater geometry.

For any form, at a fixed camera wheel position:

```
on-screen size  S(R)  =  θ(R) · sVis(R) / cameraDistance
```

- **θ(R)** = the form's ANGULAR size on the unit sphere = `k / freq_render(R)`. A uniform `planet.scale` does NOT change θ (a feature that spans 1/f of the circumference still spans 1/f after scaling).
- **sVis(R)** = `visScaleOf(R) = R^0.5` (`core:45-47`), applied as `planet.scale`. This is the disc-growth half — the part Max wants KEPT.
- **cameraDistance** = `state.distance * R` with `R=1.0` → **absolute** (`:5675`). It does NOT scale with sVis on the wheel path; the wheel only clamps a floor `minCameraDistance(sVis)` (`:5590`, `:5671`).

**Disc angular size ∝ sVis / dist. Form angular size = θ. Ratio form/disc = θ.**

> **Therefore, mathematically:** to make the disc grow (sVis↑) while a form's on-screen size S stays constant, θ MUST shrink as `θ ∝ 1/sVis`, i.e. **`freq_render ∝ sVis`**. There is no other lever — S, disc, and θ are algebraically bound. Max's spec is a statement about `freq_render`. **Every** pathway below is graded by whether its `freq_render` can be made ∝ sVis, and how.

At `sVis=1` (radius 1 RE) every expression below is identity → today's goldens/headless are bit-exact by construction (the golden harness `tests/golden-trajectories/run-golden.mjs` imports `canonical-scenario.js` + the pure core/GLSL and evaluates in object space; it **never imports sVis or runs the HTML frame loop** — so the byte fence is structural, not incidental).

---

## 1. MACRO height field — the noise domain, octaves, bake, stamped craters, provinces

### 1a. Analytic macro relief (default headless path, `uReliefBakeStrength=0`)
- **`computeHeight(pos)`** `glsl:629-634`: `snoise(pos*uNoiseScale*0.3)*0.5 + snoise(pos*uNoiseScale)*0.35 + snoise(pos*uNoiseScale*2)*0.2 + snoise(pos*uNoiseScale*4)*0.1`. This is the finite-diff regression path (`uNormalMode==1`, `:370`).
- **`fbmd(pos,octaves,fwBase)`** `glsl:752-773`: the analytic path's base FBM, `freq = uNoiseScale*0.3` (`:753`), 12-octave loop, `freq*=2` each octave; octaves count = `autoOctaves(lod)` (`:5690`). This is the low-freq body when the bake is off (`:385`).
- **`uNoiseScale`** default **`4.0`**, a FIXED lab constant (`planet-lod-uniforms.js:10`). **It is never assigned from radius** — grep for an `uNoiseScale.value =` write returns nothing but the frost false-match. So the continent frequency is **angular-fixed** → `θ = const` → `S ∝ sVis` → **grows with the disc.** This is the field Max's "terrain scales up with radius" complaint lands on.
- Octaves depend on `lod = lodRampOf(logicalDist)` (`:5689`) where `logicalDist = state.distance/sVis` (`:5688`). Octave count already tracks apparent size (more octaves when the disc looks nearer) — but octave COUNT changes detail depth, not the base frequency, so it does not change θ of the existing forms.

### 1b. Baked relief cube (lab live default, `uReliefBakeStrength=1.0` at `:2534`)
- Height source BRANCHES at `:379-385`: `if (uReliefBakeStrength>0) hd = baked·s + synth·(1-s)`; `baked = sampleBakedRelief(vObjN)` = `textureCube(uReliefBakeCube, dir)` (`glsl:150`, decl `:148-149`). `.x`=height, `.yzw`=gradient.
- The cube is **baked by `route()`** (`:3746`) via `makeSphereField`→`writeBombardment`/`writeHeightSphere` (`sphereField.js:7,22`). Its content = the low-freq body **including the discrete stamped crater/basin population** (`craterField`, `sphereField.js:22`; `carrier.craterField` read at `:4156`). Sampled by **object-space direction** → angular-fixed on the unit sphere → **grows with the disc** under `planet.scale`.
- This is baked GEOMETRY-in-a-texture, not a live uniform. Its angular density is frozen at bake time (see §5).

### 1c. Province partition (region scale)
- `initProvinces` / the three low-freq threshold fields `glsl:838-845`: `noised(pos*0.75)`, `*1.5`, `*0.85`, `*1.7`, `*0.65`, `*1.3` — all **hardcoded fixed frequencies** on `vPos`, tied to `uMacroOffset` (seed). Sets the craton/orogen/basin region scale that every combiner reads via `provinceWeight`. Angular-fixed → region SCALE grows with the disc too.
- The **province OVERLAY mesh** (`provinceOverlayMesh`, built `:1506`, `planet.add` `:1509`, `scale 1.0015` `:1507`) and the **river ribbons** (`riverOverlay.ribbon` `planet.add:1475`; `tributaryPatch.fineRibbon:1524`) are **children of `planet`**, so `planet.scale=sVis` scales them automatically — they hug the disc for free (AC-OVERLAY). No separate work needed.

**Making the macro field's forms constant on-screen** requires `freq_render ∝ sVis` across `computeHeight`/`fbmd` base AND every combiner's hardcoded `vPos` multiplier AND the province fields. The clean single lever is a **global display domain-scale**: introduce one uniform `uDispDomainScale`, sample `pos*uDispDomainScale` once so all downstream frequencies scale together. Mechanism is a **uniform** (display-only in kind, headless-inert at =1), BUT (i) it multiplies INTO the height GLSL, changing rendered height CONTENT for non-1 radii (continents rescale — this is the desired "more, smaller continents" read), and (ii) the value written is sVis → **breaches the current fence** (§7). Verdict: **display-achievable via a display uniform, gated on a fence re-scope; not a bake/schedule edit.**

---

## 2. km-keyed texture features — every `featureFrequencyFromKm` call site + the C_* constants

**Definition** `core:989-991`: `featureFrequencyFromKm(radiusEarth, featureSizeKm, cFeature) = cFeature * (radiusEarth * 6371) / featureSizeKm`. Monotonic ↑ in radius ⇒ a fixed-km feature spans fewer cells ⇒ higher frequency ⇒ smaller + more numerous on the disc. **Base `freq_render ∝ R`** (real radius) for every fixed-`sizeKm` feature.

**C_\* constants** `:1956-1962`: **all `= 1.0`** today (`C_CRATER, C_LAVA, C_CRACK, C_EDIFICE, C_CHAOS, C_FACET, C_HEX, C_SHAT, C_KARST, C_ECUD, C_ECUB, C_SUBPIT, C_SUBPOLY, C_DUNE, C_OUTFLOW, C_FLUVIAL`). They are the **per-feature calibration constant = "the desired look at the reference radius"** (`core:987-988`). C=1 ⇒ `freq = radius_km / sizeKm`, i.e. sizeKm is literally the feature footprint in km (`:1954`). `sizeKm` values are FIXED lab knobs (e.g. `duneSizeKm:398` `:2052`, `facetSizeKm:1593` `:2188`, `hexSizeKm:3982` `:2193`, `chaosSizeKm:1274` `:2335`), each with a GUI slider (`:4190,4324,4500,4711…`).

**The 18 call sites (all pass `state.planetRadiusEarth` = real R):**

| line | uniform | C_ | sizeKm source |
|---|---|---|---|
| 5804 | `uOutflowFreq` | C_OUTFLOW | `outflowSizeKm` |
| 5813 | `uKarstDolineFreq` | C_KARST | `karstDolineSizeKm` |
| 5823 | `uDuneFreq` | C_DUNE | `duneSizeKm` |
| 5974 | `uFacetScale` | C_FACET | `facetSizeKm` |
| 5983 | `uHexScale` | C_HEX | `hexSizeKm` |
| 5991 | `uShatScale` | C_SHAT | `shatSizeKm` |
| 6021/6022 | `uEcuDistrictScale`/`uEcuBlockScale` | C_ECUD/C_ECUB | `ecu*SizeKm` |
| **6059** | **`uCraterScale`** | **C_CRATER** | **`craterSizeKm` (= inc3b D_char, §5)** |
| 6102 | `uEdificeScale` | C_EDIFICE | `edificeSizeKm` |
| 6111 | `uLavaScale` | C_LAVA | `lavaSizeKm` |
| 6115 | `uCrackScale` | C_CRACK | `crackSizeKm` |
| 6122 | `uChaosCellScale` | C_CHAOS | `chaosSizeKm` |
| 6155/6156 | `uSubPitScale`/`uSubPolyScale` | C_SUBPIT/C_SUBPOLY | `sub*SizeKm` |
| 6197 | `uFluvialFreq` | C_FLUVIAL | `fluvialSizeKm` |

**On-screen behavior today (fixed-sizeKm sites, 5cef327):** `freq ∝ R` ⇒ `θ ∝ 1/R` ⇒ `S ∝ (1/R)·sVis = R^-0.5` → these **SHRINK on screen** as R grows (the diagnosis's "already honor the relative proportion" — physically, bigger world → relatively smaller km-features). They do NOT "scale up," so they are not what Max saw growing.

**Making them constant on-screen** = force `freq_render ∝ sVis` instead of `∝ R`. Two identical-result idioms at the live write:
- pass a **display radius** into the call: `featureFrequencyFromKm(sVis, sizeKm, C)` (treat the scale factor as a pseudo-radius; `freq = C·sVis·6371/sizeKm ∝ sVis`), or
- **multiply by `sVis/R = R^-0.5`** after the physics call.

Mechanism = **uniform-value change at the frame/applyDrivers write** (physics/headless keeps real R; identity at sVis=1). **Display-achievable, gated on the fence re-scope** — the fence test explicitly bans `featureFrequencyFromKm(...sVis...)` (§7). **Spec fork for Max:** do we override their correct physical ∝R shrink to hold them exactly constant, or leave them on physics (they shrink, reading as "a bigger world just has finer texture") and only fix the MACRO growth? "The same size" reads literal → override; but this is the one place the ratified spec fights the inc3b realism Max previously accepted.

---

## 3. The sVis application points (from 5cef327, the shipped disc-growth layer)

- `sVis = visScaleOf(state.planetRadiusEarth)` `:5655` (AC-0: single input).
- `planet.scale.setScalar(sVis)` `:5656`; `hazeShell.scale` `:5657`; `ring.scale` `:5658`; `ringCloud.scale` `:5660`.
- ring-cloud distance-LOD re-key: `uDResolve = state.ringDResolve*sVis`, `uDCull = …*sVis` `:5665-5666` (the missed-consumer fold from the build).
- camera floor: `minCameraDistance(sVis) = sVis*1.1` (`core:55-56`), enforced at wheel `:5590` and authoritatively per-frame `:5671-5672` (AC-CLAMP).
- camera position from **absolute** `dist = state.distance*R`, R=1 `:5675-5681`.
- LOD keying on **logical** distance: `logicalDist = state.distance/sVis` `:5688` → `lodRampOf(logicalDist)` `:5689`, `autoOctaves(lod)` `:5690`, `lodHysteresis(logicalDist,…)` `:5692` (AC-LOD-KEY, pinned in `vis-scale-fence.test.js`).
- sweep/feature-badge distance pin: `state.distance = SWEEP_DISTANCE*sVis` `:5216` (live-only Ask-4 path, not a golden path).

This layer is correct and is the half Max wants KEPT. It grows the disc; it does nothing to θ, which is exactly why forms currently track (or over/under-track) the disc.

---

## 4. Per-pathway verdict — what makes each form CONSTANT on-screen, and can it be display-only?

| # | Pathway | freq_render(R) today | S(R) today | change for S=const | mechanism | verdict |
|---|---|---|---|---|---|---|
| **P1** | Macro FBM `computeHeight`/`fbmd` (`uNoiseScale`) + combiners | const | **∝ sVis (grows)** | domain·sVis | display uniform `uDispDomainScale` (into GLSL) | **display-achievable\*** |
| **P2** | Baked relief cube `uReliefBakeCube` (route bake, stamped basins/craters) | const (baked angular) | **∝ sVis (grows)** | re-bake at ·sVis angular density | `route()` re-run / cube re-render | **PROCGEN-FORCED** |
| **P3** | Province partition fields `glsl:838-845` (region scale) | const | ∝ sVis (grows) | same domain·sVis lever as P1 | display uniform | **display-achievable\*** |
| **P4** | Synth sub-floor craters `uCraterScale` (inc3b) | ≈const (∝R/R, §5) | ∝ sVis (grows) | uCraterScale·sVis at write | uniform-value multiply | **display-achievable\*** |
| **P5** | km-keyed texture (17 fixed-sizeKm sites, §2) | ∝ R | ∝ R^-0.5 (shrinks) | swap displayRadius=sVis / ×(sVis/R) | uniform-value at write | **display-achievable\*** (spec fork) |
| **P6** | sVis application layer §3 (disc growth + LOD + clamp) | — (sets sVis) | provides the ·sVis factor | none — keep as-is | already shipped | **display-only (done)** |

`*` = mechanism is a display uniform / route-time param and is headless-inert (identity at sVis=1, real-R physics untouched), **but requires the AC-ZERO-CLOBBER fence to be re-scoped (§7)** because carrying sVis into any planet uniform / GLSL / `featureFrequencyFromKm` arg is exactly what the current denylist forbids.

**Counts:** 6 pathways · 5 display-achievable (P1,P3,P4,P5,P6) · 1 procgen-forced (P2).

---

## 5. inc3b interplay — D_FLOOR_KM ∝ R, uCraterScale = RE·6371/D_char, the "stamps"

These are **PHYSICS** (do not touch the derivations; only how display converts km/angular for rendering):

- **`D_FLOOR_KM = MESH_FLOOR_RAD / rpk`** `bombardment.js:178`, where `rpk = radPerKm(R) = 1/(R·6371)` (`baseStep.js:95`) and **`MESH_FLOOR_RAD = 0.055`** (fixed angular floor = 3× mean edge angle at ~12k nodes, `bombardment.js:86`). So `D_FLOOR_KM ∝ R` in KM, but its **ANGULAR size is FIXED** at `MESH_FLOOR_RAD`. The stamped band `[D_FLOOR_KM, D_HI_KM=C_BASIN·R_km]` (`:178-179,54`) is therefore **angular-scale-invariant** (test `worldengine-v2-6-craters.test.js:86`).
  - **Under display scaling:** a fixed-angular stamped crater renders at `MESH_FLOOR_RAD·sVis` on the scaled disc → **grows on screen ∝ sVis.** To hold it constant you would bake at angular size `MESH_FLOOR_RAD/sVis` — i.e. **smaller than the mesh/cube floor** as sVis>1. The stamped population is floored by resolution; you cannot render finer stamps without a re-bake at higher angular density (cube face resolution permitting) and, past a point, sub-mesh-floor craters are simply impossible on the fixed 256²/cube substrate Max froze. **This is the one form no display uniform can correct.**
- **`uCraterScale = featureFrequencyFromKm(RE, D_char, C_CRATER=1) = RE·6371/D_char`** `:6059`, `:3705`. Because **`D_char ∝ R`** (geometric mean of the sub-floor band `[L, D_FLOOR_KM]`, both ∝R — `:3702-3704`), `uCraterScale ∝ R/R ≈ const`. So the synth sub-floor craters are ALSO angular-fixed and **grow ∝ sVis** on screen.
  - **Under display scaling (P4):** multiply `uCraterScale` by `sVis` at the `:6059` write. This is a **display multiply that never touches the schedule** — `D_char`, `craterSchedule`, `bombardment.js` derivations are all upstream and unchanged; goldens (headless, real R, no sVis) stay byte-identical. Achievable, gated on fence.
- **`uCraterAmp = (D_D_SIMPLE/CRATER_DEPTH)·radPerKm(RE)·D_char`** `:3726` sets crater DEPTH (Pike simple-bowl law, PHYSICS). If P4 shrinks synth craters ∝1/sVis for display, their DEPTH still rides `uPerturb·reliefEnvelope` (`:5709`); to keep depth/diameter aspect on the shrunken craters the amp may need a matching ·(1/sVis) display factor — a second display term, still no schedule edit. Flag, don't bake.
- **"Crater stamps in the mesh":** there are none — relief is shaded-not-displaced (§0). The stamped population lives in `uReliefBakeCube` (§1b) and the synth band is analytic (`craterCombiner` `:400`, `glsl:1959-2036`). "Re-key the stamps" = **re-bake the cube** (P2, procgen), not move any vertex.
- **Goldens:** unaffected by any of the above IF the sVis factors live only at the live uniform write / a display uniform. `run-golden.mjs` + `canonical-scenario.js` are on the denylist and never see sVis; `MESH_FLOOR_RAD`, `D_FLOOR_KM`, `D_char`, `uCraterScale`'s physics value are all computed real-R. No re-capture needed **unless** P2's re-bake changes the baked cube content at canonical radii (it must not — keep the bake real-R, apply display density only at sample/re-key time, or gate the re-bake off the golden path).

---

## 6. Slider ergonomics — current control + log/split idioms

**Current** `:3902`: `fDrivers.add(state, 'planetRadiusEarth', 0.3, 16, 0.01).name('planet radius (RE)').listen().onChange(()=>applyDrivers())`. Linear 0.3–16 over a ~79px lil-gui track ⇒ **0.199 RE/px**. The 0.3–2 band (every canonical world) is the leftmost ~8.5px (violent: +29% disc per pixel at the low end); 8–16 is a ~40px dead zone (~0.9% disc/px under √). Plus `onChange` fires `applyDrivers()` every tick (~100–170ms route + ~500ms terrain re-derive) → late terrain pop. This IS the "does not reliably go up" read (DIAGNOSIS Finding 1).

**lil-gui has no native log slider.** Idioms:
- **Log-mapped proxy (recommended — perceptually uniform, constant %/px):** a proxy object with a getter/setter that exp-maps a `[0,1]` (or log-RE) control onto `planetRadiusEarth`:
  ```js
  const radiusProxy = {
    get t(){ return Math.log(state.planetRadiusEarth/0.3) / Math.log(16/0.3); },
    set t(v){ state.planetRadiusEarth = 0.3 * Math.pow(16/0.3, v); }
  };
  fDrivers.add(radiusProxy, 't', 0, 1, 0.001).name('planet radius (log)')
    .onChange(()=>applyDrivers()).listen();
  ```
  Every pixel = a constant *ratio* step (~+0.7%/px across the whole 53× range), killing both the left-edge violence and the right-edge dead zone. Keep the km readout (`:3903`) and the disabled numeric RE readout for legibility.
- **Split-range (two controllers):** a fine `0.3–2` slider + a coarse `2–16` slider, both writing `planetRadiusEarth`. Simpler math, clunkier UX; useful only if Max wants a hard "canonical band vs giants" separation.
- **Debounce the re-derive:** move `applyDrivers()` off the raw `onChange` onto a trailing debounce (the `riverRerouteDebounced` idiom at `:3890-3896`, 220ms) so a drag re-derives once on settle, not per tick — removes the terrain-pop lag independent of the mapping.
- Width: the 79px is the lil-gui panel width; a log map fixes the *response*, but widening the panel (CSS on `.lil-gui`) buys more pixels if Max wants finer control.

---

## 7. The fence collision (the load-bearing finding)

`AC-ZERO-CLOBBER` (`tests/vis-scale-fence.test.js`) codifies the denylist `/visScaleOf|\bsVis\b|VIS_SCALE_EXP/` over: `planet-lod-height.glsl.js`, `planet-lod-river-amplifier.glsl.js`, `run-golden.mjs`, `canonical-scenario.js`, **all `src/worldengine/**`**, **all `/* glsl */` regions in the lab**, any `featureFrequencyFromKm(...sVis...)` call, and **any planet `uniforms.X.value = …sVis…` write** (only `ringCloud.material` is exempt).

§0 proved the spec is satisfiable ONLY by `freq_render ∝ sVis`. Every §4 display mechanism (P1 domain-scale uniform, P4 `uCraterScale·sVis`, P5 `featureFrequencyFromKm(sVis,…)`) puts sVis into exactly the surfaces this test bans. **The current fence forbids the only mechanism that meets the ratified bar.** This is not a bug to code around; it is a scope decision for Max: re-scope AC-ZERO-CLOBBER from *"sVis touches no frequency anywhere"* to *"sVis MAY set a display-frequency term at the live uniform write / one display domain-scale uniform, provided the worldengine / schedule / bake / run-golden / canonical-scenario surfaces stay sVis-free and sVis=1 remains bit-identical."* The byte-golden guarantee survives (harness separation, §0); what changes is that the height CONTENT rendered at non-1 radii now depends on sVis — which is the whole point of the spec.

---

## 8. Summary for the return JSON

- **6 pathways** determine on-screen form size (P1 macro FBM, P2 baked cube, P3 provinces, P4 synth craters, P5 km-keyed texture, P6 sVis layer).
- **5 display-achievable** (P1,P3,P4,P5,P6) — via display uniforms / uniform-value swaps at the live write, headless-inert at sVis=1, physics untouched — **but all 5 require the AC-ZERO-CLOBBER re-scope (§7).**
- **1 procgen-forced** (P2 baked relief cube — stamped basins/craters — needs a `route()` re-bake at ·sVis angular density; mesh/cube-floor-bounded).
- **Hardest problem:** the ratified spec is geometrically achievable only by `freq_render ∝ sVis`, which (a) directly violates the current display-only fence (forcing a deliberate re-scope) and (b) is impossible for the inc3b **baked stamped-crater population**, which is angular-scale-invariant geometry floored at `MESH_FLOOR_RAD=0.055` on the frozen 256²/cube substrate — holding those constant on-screen would demand sub-mesh-floor craters and a per-tick re-bake, so the stamped craters are the one form no display transform can correct without procgen and without touching the mesh resolution Max froze.
