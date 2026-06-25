All load-bearing facts confirmed: the squash/age-drive formulas, the quantized grain rule (`grainAngle ∈ {0, π/2}`), the magnetic lock-predicate divergence (`magneticField` uses `isLocked` at PlanetGenerator:413 via `lockType==='synchronous'`, while computeAtmosphere uses `|rotationSpeed|<0.01` at PhysicsEngine:173), and 5 relief presets. I have what I need.

## 1. Recommended scope boundary

| Feature | Verdict | One-line reason |
|---|---|---|
| **F1** Base-step interface + substrate contract | **include** | Load-bearing foundation; every other WS2 feature writes into the interface it defines. Lowest blast (additive, new tree). |
| **F2** L0 consumption adapter | **include** | Critical path: F4/F5 cannot derive until a real bundle is fed in. The calibrated tidal driver + age-normalization are genuinely needed, not economy. |
| **F3** Sphere/cubemap field parameterization | **thin** | Production already proved seam-free spherical adjacency (`buildIrregularSphere`); reuse it, drop the cubemap-seam framing. Hard dep of F4, but far smaller than the plan budgeted. |
| **F4** Orientation field + stress tensor | **include** | The keystone WS4's E6 grain reader consumes (plan:52, :223). Oracle already pinned in passing lab tests; faithful per-texel port of a closed-form kernel. |
| **F5** Thin interior field | **thin** | Keep IN the base step (Max default 4), but cap to bounded closed-form scalars (loveK2, thermalState) + the crustal-thickness field. No full interior-structure model. |
| **F6** Field-topology maps | **defer** | No lab precedent, no first-wave consumer, scalar `magneticField` already surfaced. Pull in only when an E4 magnetosphere engine is actually ported. |
| **F7** Determinism + base-step verifier | **include** | **THE WS2 GATE.** Objective pass/fail for the whole derivation. Low blast (test code), grounded in existing lab tests. |

**Recommended WS2 = F1 + F2 + F4 + F7 (full) + F3 (thinned) + F5 (thinned). F6 deferred.** This matches the prior lean (F1–F4+F7 core, F5 thinned, F6 deferred), with the one refinement that **F3 is thinned** rather than full — the seam-free-parameterization reconciliation collapses most of its feared difficulty.

The optional **VIZ** (interim field-viz) and **ARCH** (regression map + magnetic fold decision) are not code features in the F1–F7 menu: ARCH is the regression map (Section 3) plus a deferral decision (Section 5c); VIZ is the optional interim UAT (Sections 4 and 5b).

## 2. Draft acceptance criteria (corrected, deduped)

All ACs below have the verdict corrections applied. Field-name convention resolved per F2 verdict: **the adapter (F2) emits a BUNDLE; `drivers.*` exists only after `makeBaseStep` runs** — F2 ACs assert on the bundle (unit), and any "flows into drivers" check is an explicit `makeBaseStep(adaptL0(...))` integration step.

### F1 — Base-step interface + substrate contract

| id | statement | input | observable | layer | live |
|---|---|---|---|---|---|
| **F1-AC1** | A downstream-engine stub reads every declared output field of `makeBaseStep(planetData, gridOpts)` without an interface change. | vitest: construct a WS1 `planetData` fixture (**5 keys from `generate()`; `systemContext` present only if routed through StarSystemGenerator**) + gridOpts; run a stub that destructures every documented driver (`tidalHeat,surfaceGravity,rockyCrust,surfaceHistory,age,radialStrainSign,radialStrainMag,despinAmp,discriminator,useDiscriminator,liquidStability,liquidSpecies,rainFactor`), calls `crust.thicknessBlob(0,0,n)`/`shellThickness`, reads every substrate field. | Zero ReferenceError/undefined; every field present with correct type. | unit | false |
| **F1-AC2a** | When `planetData.tidalHeating` is absent, the base step falls back to lab self-derivation without throwing. | vitest: call `makeBaseStep` with `tidalHeating` omitted; read the bundle/driver tidal slot. | Finite, ≥0; no throw. | unit | false |
| **F1-AC2b** *(contingent on Max's precedence ruling — open decision 5e)* | When `planetData.tidalHeating` is present, the base step prefers the upstream value over recomputing. | vitest: set `tidalHeating` to a sentinel; read the tidal slot. | Tidal slot traces to `planetData.tidalHeating` (single-source). | unit | false |
| **F1-AC3** | `makeSubstrate(gridOpts)` returns a grid with correct shape/dtype/bounds and working access helpers. | vitest: `makeSubstrate({n:64,...})`; assert each field length `n*n`, `regime`/`standing` Uint8, rest Float32, all-zero init; `idx(s,3,5)===5*64+3`; `latDegOfRow(s,0)===0` & `latDegOfRow(s,63)===80`; `cloneHeight` independent. | All asserts pass; cloneHeight is a deep copy. | unit | false |
| **F1-AC4** | Every drivers scalar is finite, and bounded ones sit in declared ranges, for all 5 presets + empty bundle. | vitest: for each preset + `makeBaseStep({})` assert `Number.isFinite` + range membership. **Exclude** `discriminator`(string)/`useDiscriminator`(bool) from the finite sweep; assert `liquidSpecies ∈ {0,1}` (not `[0,1]`). | No NaN/Inf; bounded drivers in `[0,1]`; `radialStrainSign ∈ {-1,+1}`. | unit | false |

### F2 — L0 consumption adapter

| id | statement | input | observable | layer | live |
|---|---|---|---|---|---|
| **F2-AC1** | The adapter's bundle tidal slot derives from `planetData.tidalHeating`, not recomputed from orbital params. | vitest: build `planetData` with `tidalHeating=X` vs `10X` (else identical); read the bundle's tidal slot. | Tidal slot monotonic in `tidalHeating`; invariant to non-tidal fields; no Io-formula recompute. | unit | false |
| **F2-AC2** | The tidal consumption is calibrated and bounded — Io-like→documented anchor A, Earth-like→~0, no two presets collapse to the same clamped extreme. | vitest: feed `{Io=1.0, Earth=1.74e-3, lava=7.82e5, inner-moon≈249}`; read the tidal driver. *(Example curve struck — `log10(1+h)/2` saturates lava AND inner-moon to 1.0, violating non-collapse; curve is the open design call in 5e.)* | Earth≈0; all in `[0,1]`; strictly ordered Earth<Io<inner-moon<lava; no collapse. | unit | false |
| **F2-AC3** | Plan F2 done-criterion: a tidally-heated body's tidal driver exceeds a near-circular control. | vitest: generate (fixed seed) a close-eccentric body + a distant near-circular body via real generators; run each through `adaptL0`; compare on the field that feeds `expansionDrive`/`radialStrain`. | heated > control > 0; control ≈ 0. | integration | false |
| **F2-AC4** | `planetData.age` (Gyr) is normalized to `[0,1]` so old bodies don't saturate `despinAmp`/`radialStrain`. | vitest: `adaptL0` on age=0.5 vs 13.0; run `makeBaseStep`; read **`despinAmp`** and `radialStrainMag/Sign` (NOT `contractionDrive` — not exposed). | `ageNorm ∈ [0,1]`; young vs old differ (not both clamped); ordering preserved. | unit | false |
| **F2-AC5** | All six WS1 keys reach the bundle with the right role; none silently dropped. | vitest: `planetData` with all six keys as sentinels; assert `bundle.tidalHeat`←tidalHeating, `bundle.ageNorm`←age, `bundle.magneticField===planetData.magneticField`, metallicity present, eccentricity present-but-unused-by-heat, systemContext present. | Each field traces to its source; fail if any unmapped. | unit | false |
| **F2-AC6** | systemContext is serialization-safe and `partnerIndex` is never persisted as an id. | vitest: `JSON.stringify(systemContext)` round-trip leaves adapter behavior unchanged; assert no persistent map keyed on `partnerIndex`. *(Cross-system-collision clause demoted to mustStayWorking — pure pass-through has no partner-resolution to positively test.)* | Round-trip stable; no `partnerIndex`-keyed persistence. | unit | false |
| **F2-AC7** | The adapter is pure/deterministic: same input → byte-identical bundle, input unmutated. | vitest: `adaptL0` twice on a deep-frozen `planetData`; deep-equal outputs; confirm no mutation. | Two runs deep-equal; frozen input not violated; no rng. | unit | false |

### F3 — Sphere/cubemap field parameterization *(thinned)*

| id | statement | input | observable | layer | live |
|---|---|---|---|---|---|
| **F3-AC1** | The carrier exposes node-indexed adjacency continuous across antimeridian + both poles (no grid-edge guards). | Build via `makeSphereField` (reusing `buildIrregularSphere`); sample pole/antimeridian nodes; assert non-empty, reciprocal adjacency, no edge-truncation. | All sampled nodes reciprocal, degree in range (~5–8); zero edge-truncated. | unit | false |
| **F3-AC2** | A smooth global scalar reads continuous across every seam (per-edge gradient below the analytic Lipschitz bound). | Assign `field[i]=f(nodeDir(i))`; for each edge compute `|Δfield|/arcDist`; take max. | Max per-edge gradient below `f`'s Lipschitz bound; no spikes at antimeridian/poles. | unit | false |
| **F3-AC3** | Per-node tangent frame `(east,north)` + latitude replace `latDegOfRow`, well-defined except a documented pole fallback. | Sample nodes: `tangentFrameAt(i)`, `latDegOf(i)`; assert orthonormal, tangent, `latDegOf==asin(y)`; pole nodes return documented fallback. | Non-pole frames orthonormal/tangent; latitude matches; poles finite-fallback (no NaN). | unit | false |
| **F3-AC4** | Same `(targetN, lloydIters)` → byte-identical mesh/topology **within the same JS engine/build**. *(Mesh builder takes NO seed and uses NO RNG — seed only folds in for any seeded field-fill.)* | Build twice with identical `(targetN,lloydIters)`; compare verts/faces/adj exactly. | Two builds byte-identical (mesh/topology). | unit | false |
| **F3-AC5** | All carrier fields finite/bounded: verts unit-length, no NaN/Inf; populated-field bounds checked only with a stub fill. | Build carrier (optional stub F4 fill); scan arrays; assert finiteness + `|verts|≈1`; bounds checks marked anticipatory (empty carrier is zero-init). | No NaN/Inf; verts unit; bounded fields in range when populated. | unit | false |
| **F3-AC6** | The carrier reuses the SAME mesh the river router consumes (no second, seam-different parameterization). *(Verdict relabel: **unit**, was integration — two in-memory builds, no live app.)* | Build via carrier and via `buildIrregularSphere` with matched `(targetN,lloydIters)`; assert identical verts/faces/adj. | Carrier mesh ≡ router mesh. | unit | false |
| **F3-AC7** *(see Section 2 UAT note)* | A known smooth debug scalar reads seam-continuous in the running renderer — no antimeridian seam line / pole-pinch. *(Visualizes a KNOWN smooth scalar, NOT the F4 field, so it doesn't pull F4 into F3's gate. Requires the sphere-field harness — a **required F3 deliverable**.)* | In the sphere-field harness, render the debug scalar on the globe; rotate across antimeridian + over a pole. | No seam line, no pole-pinch, no banding discontinuity. | uat | true |

### F4 — Orientation field + stress tensor

*(Q2 quantized-vs-continuous grain must be locked before finalizing — recommend faithful quantized port; ACs below assume it.)*

| id | statement | input | observable | layer | live |
|---|---|---|---|---|---|
| **F4-AC1** | Per-texel regime follows the latitude band oracle. | Build F4 field, neutral radial strain; sample regime at true-lat ≈0°/48°/85° (sample away from the 38°/57° boundaries). | `regime(0°)===THRUST`, `regime(85°)===NORMAL`, `regime(48°)===STRIKESLIP`. | unit | false |
| **F4-AC2** | Contraction (sign +1) biases toward THRUST vs expansion (−1) at fixed latitude. | Build two fields differing only in `radialStrainSign`, `mag≈0.3`; compare regime at ~50° + whole-field THRUST/NORMAL fractions. | `contraction.regime ≥ expansion.regime`; contraction has higher THRUST fraction, expansion higher NORMAL. | unit | false |
| **F4-AC3** | Grain ⟂ dominant principal stress; `grainMag` is normalized stress in `[0,1]`. | Build field; read `{sMer,sZon}`, `grainAngle`, `grainMag` for a texel set. | `grainAngle = 0` when `|sMer|≥|sZon|` else `π/2`; `grainMag ∈ [0,1]`, tracks `hypot/(1+ν)`; all finite. | unit | false |
| **F4-AC4** | Field finite/bounded/banded — never collapses to one regime. *(Scope the no-collapse guard to the driver bundles F4 ships first wave, OR run the banding sweep over the production range — the ≥2-regime guarantee is proven only for the 5 presets at REGIME_GAIN=0.4.)* | Build fields for several driver bundles; inspect full `grainMag`/`regime` arrays. | All `grainMag ∈ [0,1]`, `sMer/sZon` finite; ≥2 distinct regime values per field. | unit | false |
| **F4-AC5** | Field is deterministic: same `(drivers, params, seed)` → byte-identical arrays. | Build twice; compare `grainAngle/grainMag/regime/sMer/sZon` element-wise. | Arrays exactly equal across builds. | unit | false |
| **F4-AC6** *(deferred / blocked on F3)* | Regime/grain continuous across sphere seams — no chart-edge discontinuity not corresponding to a real band boundary. *(Verifier must implement the band-boundary tolerance: a change is allowed iff a band boundary (~38°/57°) lies between the two latitudes — NOT naive equality.)* | For seam-neighbor texel pairs at ~equal true latitude (via F3 adjacency), compare regime + grainAngle. | Equal regime/grainAngle for same-band seam-neighbors; any change coincides with a true band boundary. | integration | false |

### F5 — Thin interior field *(thinned; in base step)*

| id | statement | input | observable | layer | live |
|---|---|---|---|---|---|
| **F5-AC1** | Per-texel `crustalThickness` field is finite, in `[0,1]`, and low-frequency. | vitest: build base step for each of the 5 presets; read `crustalThickness`; assert finite, in-range, low-pass (windowed gradient-energy metric, not a single max-neighbor-delta). | All finite, in `[0,1]`; local variation below the low-freq threshold for all presets. | unit | false |
| **F5-AC2** | Interior body-scalars present, bounded (against **written** range constants), physically ordered. | vitest: derive interior scalars for old/cold/small vs young/heated/large + the 5 presets. | `shellThickness` ↑gravity ↓age (matches base-step:44); `thermalState(young+heat) > thermalState(old+cold)`; `loveK2` non-null, within its declared `[min,max]` constant. | unit | false |
| **F5-AC3** | Interior field + scalars deterministic. | vitest: build twice with identical `(bundle,opts,seed)`; compare. | `crustalThickness` byte-identical; all scalars exactly equal. | unit | false |
| **F5-AC4** | The crustal field drives E6 plateau uplift (headless): higher thickness → higher post-E6 plateau height. *(`runE6` is a pure fn — verified headless. **Interface obligation:** E6 calls `crust.thicknessBlob(ix,iy,n)` as a FUNCTION; F5 must expose the field via an accessor wrapper or WS4 adapts the call site.)* | vitest: feed `runE6` two crust fields differing only in `crustalThickness` over a patch; compare `substrate.height`. | High-thickness patch height > low-thickness patch, all else equal. | integration | false |
| **F5-AC5** | Interior field lives in the base step (default 4) with a written E0-extraction criterion. *(Structural/review-presence check — input is a module-header read, NOT a vitest run; the verify workflow should not expect a passing test file.)* | Read the new interior module header / build-intent note. | Derivation in base-step module; extraction criterion + rationale present. | unit (review) | false |

### F7 — Determinism + base-step verifier — **THE WS2 GATE**

| id | statement | input | observable | layer | live |
|---|---|---|---|---|---|
| **F7-AC1** *(GATE)* | Running the production base step twice with identical `(bundle,opts,seed)` → byte-identical derived fields, for every standard bundle. *(Runnable only after F1–F5 land — F7 runs last.)* | vitest: per bundle, derive twice; deep-equal each typed array + `toBe` each driver scalar. | Every field element-identical across runs; one differing element fails. | unit | false |
| **F7-AC2** *(GATE)* | The verifier PASSES on every standard bundle: `pass:true`, all signals true. *(`seamConsistent` must be a defined no-op-pass if F3 is flat first-wave — tie to AC4.)* | vitest: derive each bundle; `verify()`; assert `pass===true` and each `signals.*===true`. | `{pass:true, signals:{finite,bounded,seamConsistent,physicallyOrdered}}` for all bundles. | unit | false |
| **F7-AC3** *(GATE)* | The verifier FLAGS deliberately corrupted fields (the falsifiability half). | vitest: clone a valid output; corrupt one field per case (`height[k]=NaN`; `grainMag[k]=5`; force pole→THRUST); call `verify()`. | Each corruption → `pass:false` with the matching signal false + detail naming field/index; control still passes. | unit | false |
| **F7-AC4** *(GATE)* | Seam-consistency check: smooth field continuous across seams; injected discontinuity flagged. *(Headless field-level check for F7; the LIVE cross-seam check is F3's done-criterion, not F7's. Narrows to neighbor-index-continuity/no-op if F3 slips.)* | vitest: build on F3 parameterization; eval a known smooth function across seam neighbors; assert agreement; inject discontinuity. | Cross-seam samples agree within tol; injected discontinuity → `seamConsistent:false`. | unit | false |

**The F7 gate = AC1–AC4 green → `VERIFIED_PENDING_MAX`.** Bundle set the verifier runs on is an open decision (5e).

### Single optional UAT AC (Max-gated)

The recommended **one** holistic gate is the **optional interim field-viz** (replaces the F3-AC7 / F5-AC6 / F7-AC5 candidate UATs, which all defer to WS4 wiring and should not be agent-PASSed). If Max greenlights the interim viz (Section 4):

| id | statement | input | observable | layer | live |
|---|---|---|---|---|---|
| **VIZ-AC5** *(OPTIONAL — Max-gated; deferred-to-max)* | Switching the preset bundle in the live harness produces visibly distinct grain/regime/thickness maps — categorically different, not recolored noise. *(Live hook depends on the chosen harness: `window._relief.setPreset` for the relief-lab, or the new-page equivalent if a separate production harness is built — reconcile before freezing.)* | chrome-devtools: in the field-viz harness, switch e.g. `lava` → `terrestrial` with viz mode on; observe regime/grain/thickness. | Max judges the two presets read as categorically distinct fields. Never agent-PASSed. | uat | true |

If the interim viz is deferred, **WS2 ships with zero UAT ACs** (pure headless derivation) and the visible payload lands entirely in WS4. The headless VIZ checks (VIZ-AC1–4: regime-map-correct, grain-streaks-track-angle/mag, thickness-heatmap-bounded, viz-generation-blind-additive) come only if the interim viz is included.

## 3. Architectural connections

### inputs[] (merged)
- **WS1 `planetData`** from `PlanetGenerator.generate()` return (`src/generation/PlanetGenerator.js`, verified at the return block): **FIVE keys in the return** — `age`(Gyr), `metallicity`(dex), `magneticField`(D13 dynamo, single source), `eccentricity`([0,1), data-only), `tidalHeating`(D12 real, Io-scale, UNCALIBRATED). **`systemContext` is NOT in `generate()`'s return** — it is attached by a post-pass in `StarSystemGenerator.js:673` (present iff the body routed through StarSystemGenerator). Plus pre-existing fields the base step reads: `composition.{ironFraction,density,volatileFraction}`, `surfaceHistory.{erosion,resurfacing,bombardment}`, `radiusEarth`, `massEarth`, `T_eq`, `atmosphere`, `tidalState.{locked,lockType}`.
- **Moon objects** (`MoonGenerator.js:329`) surface `tidalHeating` on the WRAPPER, not on `moon.planetData` — the adapter must know which contract it's handed (open call, 5e).
- **`gridOpts`** — `{n, lat0Deg, lat1Deg, domainKm, seed, discriminate}` (F1 flat-band v1), extended by F3 to sphere params `{targetN, lloydIters, seed}`.
- **Lab references generalized (read-only, NOT modified):** `relief-base-step.js` `makeBaseStep`, `relief-substrate.js` `makeSubstrate`/`idx`/`latDegOfRow`/`cloneHeight`, `relief-e6-tectonic.js` `stressAtLat`/`writeGrain`/`runE6` (physics reference), `relief-slice.js` orchestration, `relief-presets.js` 5 bundles (rocky/lava/magma/europa/terrestrial).
- **`planet-lod-rivers.js` `buildIrregularSphere(targetN, lloydIters)`** (Fibonacci → Lloyd → spherical-Delaunay → `buildAdjacency`) — the proven seam-free mesh F3 reuses; `routeAndOrder` operates purely over `adj[]` + 3D verts.
- **Derivation templates (read-only):** `PhysicsEngine.deriveComposition` (driver-based clamped/bounded template), `tidalHeating()` (function body at `:301`; `:295` is JSDoc), `tidalHeatingPlanet()` (`:342`), `checkTidalLock → {locked,lockType}` (`:282-288`), the Jeans/retention chain.
- **The lab self-derivation shim** `deriveUniforms` (`planet-lod-lab-core.js:496`; tidal math `:516-527`) — the F2 FALLBACK path that must keep working until the adapter lands.
- **Locked physics constants:** `ν=0.25`, `REGIME_GAIN=0.4` (LOCKED), the Melosh despun coefficients, determinism primitives (alea + simplex seeded from `(bundle,opts,seed)`).
- **vitest** (`package.json` `test = vitest run`).

### outputs[] (merged)
- **NEW `src/worldengine/base/` tree** (does not exist yet — confirmed) exporting `makeBaseStep(planetData, gridOpts) → {drivers, crust, substrate}` (pure, no three.js).
- **`drivers`** scalar bundle: `tidalHeat, surfaceGravity, rockyCrust, surfaceHistory(erosion), age, radialStrainSign(±1), radialStrainMag([0,1]), despinAmp([0,1]), discriminator(string), useDiscriminator(bool), liquidStability, liquidSpecies(0|1), rainFactor`. *(Note: `contractionDrive`/`expansionDrive` are internal, NOT exposed in the return.)*
- **`crust`**: `{ shellThickness, thicknessBlob(ix,iy,n) }` + F5's `crustalThickness` field, `loveK2`, `thermalState`. **`thicknessBlob` is consumed by E6 as a FUNCTION** — F5's field must be exposed via an accessor wrapper.
- **`substrate`** typed-array grid: `height/grainAngle/grainMag/regime(Uint8)/faultDensity/flowAccum/baseLevel/standing/maturity` + `idx/latDegOfRow/cloneHeight` (or sphere analogues `nodeDir/latDegOf/tangentFrameAt`).
- **The F4 orientation field**: per-texel `{sMer, sZon, grainAngle, grainMag, regime}` co-registered — the keystone WS4's E6 grain reader consumes (replaces per-feature hashed strike axes `uOrogenyAxis/uScarpAxis/uTesseraAxis/uLavaAxis/uChasmaAxis/uCryoRidgeAxis` in `planet-lod-height.glsl.js`). `grainMag` is computed in `writeGrain`, not `stressAtLat`.
- **The F3 sphere field-carrier**: `{N, verts(unit dirs), faces, adj(seam-continuous)}` + per-node field arrays + documented degenerate-pole convention + a **required sphere-field harness**.
- **The F7 verifier** `verify(baseStepOutput) → {pass, signals:{finite,bounded,seamConsistent,physicallyOrdered}, detail}` — the WS2 acceptance gate.
- **A declared INPUT-precedence rule** (prefer upstream `tidalHeating` — contingent on 5e) and a documented calibration spec (Io-anchor + age divisor).
- **WS3 F1 relevance:** WS3's E1-composition label reads the SAME `drivers` (`deriveComposition` shared kernel) — input to WS3 F1, but parallelizable, not a hard dep of WS2.

### mustStayWorking[] (merged)
- **`src/generation/` UNTOUCHED** — WS2 is a new additive tree (Option A). This is the defining invariant AND the load-bearing reason the magnetic-field fold stays separate.
- **The six WS1 keys stay byte-identical** — WS2 only READS them; must not perturb the WS1 additive gate.
- **`planetData` not mutated** by any WS2 code (purity; preserves JSON save/share).
- **`systemContext` serialization-safe** — `JSON.stringify(systemData)` must not throw; no re-introduced circular reference; `partnerIndex` never persisted as an id (positional only, valid within one in-memory snapshot).
- **The lab relief slice + harness UNCHANGED** — `relief-*.js`, `planet-lod-*`, and the existing **world-engine-relief-slice suite stays green** (use "suite stays green," not a pinned 61/63 count — in-file comments say 61, NOW.md says 63).
- **The lab self-derivation shim (`deriveUniforms`) keeps working** as the F2 fallback; its vitest pins (surfaceGravity, tidalHeat monotonicity) stay green.
- **`src/objects/Planet.js` (shipped game shader) UNTOUCHED** — LAB-ONLY lock; separate deferred port.
- **`computeAtmosphere`'s 3:2-resonance retention stays as-is** — the lock-predicate proxy (`PhysicsEngine.js:173`, `|rotationSpeed|<0.01`) is NOT changed by WS2 (keep-separate decision, 5c).
- **The river router's sphere-native seam-free behavior stays the reference** for F3 adjacency — F3 must reconcile with it, not reintroduce an equirect seam; the router-lab zero-drift regression stays green.
- **Determinism:** same `(bundle,opts,seed)` → byte-identical fields (the F7 gate), no `Date.now`/`Math.random` in base step or verifier.

## 4. Roadmap to a full-planet UAT

**The honest sequence has two distinct gates that must not be conflated:**

1. **End of WS2 (headless):** F7's verifier proves the derived fields are *correct, bounded, deterministic, seam-consistent, physically-ordered*. This is an objective pass/fail — it does NOT show a planet. Nothing is wired into any renderer yet.

2. **Interim visible payload (OPTIONAL — the VIZ feature):** A **Tier-A field-viz** painting the WS2 fields (regime as 3-color map, grain as oriented streaks, crustal thickness as heatmap) onto the **existing flat relief-lab 2D harness**. Feasibility verdict: **genuinely cheap (~hours), worth including.** The relief-lab harness already IS a field-viz — `buildMesh`, `drawMini` (canvas `putImageData`), and `divergenceDrivers` (HUD) exist, and the exact fields to paint (`regime`/`grainAngle`/`grainMag`/`thickness`) are already allocated and populated on the substrate. So a regime-color mode + grain-quiver overlay + thickness heatmap are each a near-copy of `drawMini`, headless-verifiable per pixel (VIZ-AC1–4), with one optional live distinctness gate (VIZ-AC5). **Caveat to flag:** real E6 `grainAngle ∈ {0, π/2}` (quantized) — verified — so the grain-gradient test must inject a synthetic substrate, not rely on live E6 output. **Tier B (painting on the actual lab sphere) is deferred** — it's gated on F3 + shader-uniform plumbing into the 5695-line lab shader, a real lift belonging with F3 or WS4.

   **Value:** gives Max an eyeball-checkable "is the field banded/bounded/bundle-distinct?" UAT *months earlier than WS4*, de-risking F4 (stress) and F5 (interior). Cost is genuinely small. Recommendation: **include Tier-A as one thin optional WS2 feature.**

3. **The full "planet reads as a landscape with a history" UAT is WS4's gate** (plan:246) — it requires WS4 wiring the WS2 fields into the relief engines and renderer. WS2's viz shows correct/bounded/banded *fields*; only WS4 shows a finished *landscape*. The F5/F7 cohesive-divergence UAT ACs ("worlds read as categorically different") are real but **deferred-to-WS4-wiring AND deferred-to-Max** — they ride on WS2 but cannot be exercised until WS4 renders the fields.

**Net:** end of WS2, Max can SEE the derivation *if* the interim Tier-A viz is included (flat 2D field maps); otherwise WS2 is a fully headless workstream and the first visible payload is WS4.

## 5. Open decisions for Max

**(a) Scope breadth — which features.**
*Recommendation:* **WS2 = F1 + F2 + F4 + F7 (full) + F3 (thinned) + F5 (thinned); defer F6.** Reasoning: F1/F2/F4/F7 are the critical path the WS4 E6 grain reader depends on; F3 thins because production already proved seam-free spherical adjacency (`buildIrregularSphere`) so it reuses rather than invents; F5 thins to bounded closed-form scalars (no full interior model); F6 has no lab precedent and no first-wave consumer.

**(b) Include the interim field-viz / UAT gate in WS2, or defer the visible payload to WS4.**
*Recommendation:* **Include Tier-A interim viz as a thin optional feature.** Reasoning: it's genuinely a few hours (the harness + fields already exist), it's headless-verifiable per pixel, and it gives Max a real visible UAT of the derivation months before WS4 — de-risking F4/F5. Defer Tier-B (sphere viz) behind F3. Sub-question to settle: **build the viz on the existing relief-lab harness (cheapest, but reads the lab relief-slice) or a new page reading the production `src/worldengine/base/` output (cleaner, reads what WS2 actually produces).** I lean new-page-thin so the viz exercises production code — but this changes VIZ-AC5's live hook (`_relief.setPreset` won't exist on a new page), so decide before freezing the contract.

**(c) Fold the magnetic-field lock-predicate cleanup into WS2, or keep separate.**
*Recommendation:* **Keep separate — a tiny dedicated follow-up after WS2.** Reasoning (all verified): the unification lives entirely in `src/generation/` (the tree WS2 must not touch); it's a non-additive behavior change — a 3:2-resonance body has `tidalState.locked===true` so `computeAtmosphere` strips its atmosphere at ×0.2 (`|rotationSpeed|<0.01`, PhysicsEngine:173) while its `magneticField` is ×1.0 (`lockType==='synchronous'`, PlanetGenerator:413) — so unifying *changes rendered atmosphere retention* and needs its own regression-pin + UAT; nothing couples it to WS2 (WS2 reads the clean surfaced `magneticField` regardless); and Max already deferred it in WS1 contract AC3 (commit `317072a`, 2026-06-24). Plan:278 leaves "fold OR follow-up" open — this resolves it to follow-up. *Direction when it lands:* make the stripping proxy MATCH the dynamo test so 3:2 bodies retain MORE atmosphere (plan calls the dynamo test "more physically correct") — confirm so the follow-up doesn't unify in the wrong direction.

**(d) Interior field in base-step vs E0 engine.**
*Recommendation:* **Keep in the base step for the first wave (your default 4).** Reasoning: one consumer today (E6 plateau), small surface (one per-texel field + ~4 scalars), shares `makeBaseStep`'s already-coalesced inputs, simpler F7 determinism gate. F5-AC5 records the explicit extraction criterion (when Love/thermal grows past closed-form scalars or gains a 2nd consumer) so the boundary is documented, not lost.

**(e) Surfaced sub-decisions that must be locked before the contract:**
- **Tidal precedence (F1-AC2b / F2):** confirm the base step PREFERS upstream `planetData.tidalHeating` over re-deriving (my default — single-source, no drift). This gates whether F1-AC2b is asserted as written.
- **Tidal calibration curve (F2-AC2):** the lab's `log10(1+h)/2` saturates BOTH lava (7.82e5) and a close inner-moon (~1.4e5) to exactly 1.0 — verified — so it *fails* the non-collapse requirement. A log/atan/tanh compression with a tunable knee is needed. Which reference frame anchors it: **moon-Io=1.0 as reference, or planet-star-tidal as reference?** (Affects whether Io reads "weak" or "mid.") *Recommendation:* tanh/atan knee anchored so Io→~0.5 and the four presets stay strictly ordered and non-collapsed.
- **Age normalization divisor:** `/13.8 Gyr` (universe age) vs `/~10 Gyr` (typical max system age). *Recommendation:* `/~10` so a 10 Gyr body reads fully cooled/contracted.
- **F4 grain fidelity (Q2):** quantized `{0, π/2}` faithful port vs continuous angle from the full tensor. *Recommendation:* faithful quantized port for first wave (keeps F4-AC3/AC6 valid against the pinned lab oracle); continuous is a divergence with no first-wave consumer.
- **F7 bundle set:** which bundles the verifier gates on — original 4 / current 5 relief presets / 17 renderer presets / whatever F2's L0 adapter emits. *Recommendation:* run on whatever the production F2 adapter emits, AND pin the 5 relief presets as named regression fixtures (they carry the physics-divergence intent). Keep this an explicit OPEN in the contract, not a silent assumption — the pass-set is load-bearing for the gate.
- **`loveK2` first-wave inclusion (F5):** rough physically-ordered proxy now (no first-wave consumer reads it) vs leave it out until E3 exists. *Recommendation:* include as a bounded ordered proxy with a WRITTEN range constant (so F5-AC2's "within range" is falsifiable), surfaced ahead of need like WS1's data-only keys.