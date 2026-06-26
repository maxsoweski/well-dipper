# Fidelity Audit — world-engine generative architecture vs "PROCGEN DECIDES, RENDER EXPRESSES"

**Date:** 2026-06-25 · **Lens:** FIDELITY AUDIT (strict, code-grounded) · **Mode:** READ-ONLY, no code edited
**Branch:** `feature/world-engine-production-L1` (local-only) · **Auditor inputs:** the four `map-*.md` files in
this directory + first-hand verification of the load-bearing lines (greps + reads recorded in §6).

**North star being audited (Max's words, spine §0/§1):** "What you see when you look at a planet IS its
billions-of-years history. Procgen WRITES the body's tectonic/geological history as DATA upstream; rendering only
READS/EXPRESSES that already-generated history. PROCGEN DECIDES, RENDER EXPRESSES."

**One-line verdict:** Across the four surfaces the codebase contains exactly ONE place where relief is "structure
as data" honored end-to-end — the **relief SLICE** (Max-UAT-passed). Both surfaces a player can actually see (the
**game** and the **production LOD lab**) still **synthesize relief from in-shader noise**, i.e. RENDER DECIDES.
WS2 (`src/worldengine/base/*`) builds the real data substrate but is wired only to a viz page, never to a renderer.
**The hypothesis is CONFIRMED: WS4 carried only the thin ORIENTATION grain into the production shader; it did NOT
carry the slice's structure-as-data height substrate.** No locked decision is contradicted; one architectural fork
the locks leave implicit is flagged in §5.

---

## 1. Consolidated DATA-vs-shader/render boundary, per surface

The single most important column is "what crosses into the thing that draws pixels." A surface honors the north
star only if the relief STRUCTURE (where the mountains/basins/channels ARE, and how tall/deep) crosses as baked
DATA, and the renderer merely expresses it. A surface violates it if the renderer re-decides structure from noise.

| Surface | What is generated as DATA (upstream) | What the RENDERER actually consumes | Who decides the relief STRUCTURE | Verdict |
|---|---|---|---|---|
| **(1) GAME L0** `src/generation/*` + `src/objects/Planet.js` | D1–D16 physics SCALARS + WS1's `systemContext` flat graph + D11 3-scalar surface-history budget. **Zero spatial field.** (PlanetGenerator.js:708–742; StarSystemGenerator.js:624–679) | baseColor/accentColor, noiseScale/noiseDetail, **one `planetType` int**, + feature toggles. **No physics driver, no graph, no field** (Planet.js:1038–1078; grep for any driver in Planet.js = ZERO) | **The fragment shader**, from `snoise(pos*noiseScale)` inside `if(planetType==N)` branches; perturbStrength/seaLevel are hardcoded per-type literals (Planet.js:438–441,:474,:550–553) | **VIOLATES** (most total) |
| **(2) PROD LOD LAB** `planet-lod-lab.html` + `-core.js` + `-height.glsl.js` + WS4 (`-tectonic.js`/`-rivers.js`) | ~40 per-body relief SCALARS/gates + 6 seeded per-body ORIENTATION axes (deriveUniforms, core:496–953). WS4 adds: an **E6 orientation cube** (strike+mag+regime) and an **E9 drainage carve cube** (order-tent depth) | the ~40 scalars + 6 axes + the grain cube (orientation) + the carve cube (a subtractive depth). **No height/province field crosses** | **The fragment shader**, from ~25 `noised()` combiners (height.glsl.js); the grain only re-AIMS the noise via `mix(axis,grainStrike,strength)` (height.glsl.js:950) | **VIOLATES** (relief is noise, oriented) |
| **(3) RELIEF SLICE** repo-root `relief-*.js` + `world-engine-relief-lab.main.js` (Max-UAT-PASSED 2026-06-23) | a real `ReliefSubstrate`: 9 co-registered typed arrays (`height`, `grainAngle`, `grainMag`, `regime`, `faultDensity`, `flowAccum`, `baseLevel`, `standing`, `maturity`) — relief-substrate.js:5–19. E6 WRITES `height += …`, E9 carves `height -= dz` into the SAME array | the renderer displaces vertices DIRECTLY from `substrate.height[i]` and colors from `standing`/`flowAccum` (main.js:55–63) — "preset-blind" | **The data.** E6 (tectonic) builds it, E9 (hydrology) carves it; the renderer synthesizes nothing | **HONORS** (the only one) |
| **(4) WS2 BASE STEP** `src/worldengine/base/*` | the production PORT of the slice's BUILD side: `makeSubstrate` (same 9 arrays), `runE6` writes `height`, `makeBaseStep` derives structured fields incl. a materialized `crust.crustalThickness` Float32Array (baseStep.js:94–99). Adds a sphere carrier (`sphereField.js`) the slice lacks | **Nothing in any renderer.** `runE6`/`makeBaseStep`/`makeSubstrate` are reached only by `worldengine-fieldviz.html` (a read-only viz page) + 12 vitest files (grep §6.1) | n/a — not on a render path | **HONORS as data, but UNWIRED** to any player-facing renderer |

**The boundary in one sentence:** in (1) the data interface is *scalars + a label*; in (2) it is *scalars + axes +
two thin baked cubes (orientation, drainage-depth)*; in (3) it is *the height field itself*; in (4) it is *the
height field itself, but plugged into nothing that draws the game/lab*.

---

## 2. Where built work HONORS the north star vs where it VIOLATES it (shader-decides)

### 2.1 HONORS "procgen decides, render expresses"

- **Relief SLICE — the whole pipeline (the canonical honor case).** E6 writes `relief-e6-tectonic.js:122
  substrate.height[i] += …`; E9 carves `relief-e9-hydrology.js:139 substrate.height[i] -= dz` into the SAME object;
  the renderer reads it (`world-engine-relief-lab.main.js:55 pos.setZ(i, (h[i]-mid)*0.6)`). Body-type divergence is
  produced AS DATA (regime histogram, anisotropy, carve fraction — relief-divergence.js), gated by reseed-INVARIANT
  axes so a recolor/reseed cannot fake divergence. This is a faithful (if flat-2D) instance of the host-editor lock.
- **WS2 base step — the BUILD half, as data.** `runE6` (tectonic.js:98–124) genuinely writes a `height` DEM;
  `makeBaseStep` (baseStep.js:10–99) DERIVES structured fields from physics (radialStrainSign/Mag, liquidStability,
  rockyCrust, tidalHeat, crustalThickness array) and makes **type a derived LABEL** (`discriminator` derived from
  physics, baseStep.js:64) — exactly the locked "Option A expose+derive." This is real structure-as-data.
- **WS4's drainage NETWORK (partial honor).** The carve cube IS keyed to a genuinely routed dendritic network
  (priority-flood + D-inf + Horton-Strahler over the real readback height, planet-lod-rivers.js). The carve is a
  REAL subtractive host-edit (`h -= carveDepth*uRiverCarveDepth`, lab.html:425) that floods via the level-set —
  not cosmetic. The *network topology* is data; this part is sound and is NOT the UAT fail.
- **WS1 L0 plumbing (honor of intent, inert in practice).** WS1 surfaced D12 tidalHeating, eccentricity, D13, D16,
  metallicity and a `systemContext` graph onto `planetData`. These ARE real derived data. (But see 2.2 — nothing
  consumes them in render.)

### 2.2 VIOLATES — render (or label) decides the structure

- **GAME relief is shader noise, keyed on a type label (the most total violation).** The shader IS the terrain
  generator: per-type `snoise` branches with hardcoded perturbStrength/seaLevel (Planet.js:438–441,:474,:550–553).
  `_pickType` runs FIRST (PlanetGenerator.js:323), before any driver, then ~7 type-keyed lookup tables expand the
  label into radius/palette/noise/atmosphere/clouds/rings/moons. `computeAtmosphere` short-circuits physics for 4
  types (PhysicsEngine.js:145–153). `ExoticOverlay._swapPlanetType` re-rolls type post-hoc and **regenerates the
  body from scratch (`forceType`, `zones=null`), erasing all driver-derived history** (ExoticOverlay.js:286–323).
  This is the exact inversion the spine §4b forbids.
- **GAME reads NONE of the real physics it computes.** Grep of Planet.js for tidalHeating/eccentricity/
  magneticField/systemContext/surfaceHistory/composition/habitability/T_eq/age = ZERO hits. All real physics is
  computed-but-invisible. The render expresses a label, not a history.
- **PROD LAB relief is shader noise, merely ORIENTED by the grain.** Verified directly in GLSL: every grained
  combiner does `mix(uXxxAxis, sampleGrainStrike(pos), uTectonicGrainStrength)` → `grainProvinceRotate(...)`
  (height.glsl.js:950 et al). The grain changes only the noise-domain stretch DIRECTION; the height stays
  `noised()`-derived (height.glsl.js:972 and ~24 sibling combiners). The grain itself is a PURE FUNCTION OF
  LATITUDE (`stressAtLat`, planet-lod-tectonic.js:107) → zero within-body longitudinal structure → a compass field,
  not relief. This is Max's "orientation overlay," confirmed in the shader, not inferred.
- **PROD LAB live carve depth is an order-TENT, not stream-power.** `buildValleyGeometry`'s vertex depth is
  `depthAt(strahler[idx])` (rivers.js:753, def at :663) — a lerp of VALLEY_DEPTH_LO..HI by stream order. The
  stream-power Δ=-K·A^m·S^n (`perNodeIncision`, rivers.js:790–860) that the unit ACs verified is folded only onto an
  IMMUTABLE COPY read by the `sampleRoutedHeight` PROBE (lab.html:5791–5792), whose own comment says it is "NOT a
  rendered-chain sample … deferred T12b." So the verified-physics carve does not reach the screen; the rendered cube
  carries order-keyed depth. (This is a fidelity gap inside the carve, but it is NOT why the UAT failed — the carve
  still reads as plausible valleys; the fail is the relief BODY being noise.)

---

## 3. THE KEY HYPOTHESIS TEST — did WS4 carry the slice's structure-as-data substrate, or only a thin orientation grain?

**VERDICT: WS4 carried ONLY the thin orientation grain. It did NOT carry the relief slice's structure-as-data
height substrate. Hypothesis CONFIRMED with direct code evidence.**

Three independent, code-verified facts establish this, and any one of them is sufficient:

1. **WS4 imports only the ORIENTATION half of the substrate producer.** `planet-lod-tectonic.js:28–29` imports
   exactly `writeGrainSphere, stressAtLat` (from `src/worldengine/base/tectonic.js`) and `makeSphereField`
   (sphereField.js:line). It does **not** import `runE6` (the half that writes `height`), `makeBaseStep`, or
   `makeSubstrate`. The thing it bakes is a STRIKE-ONLY cube: RG = world strike.xy, B = grainMag, A = regime
   (planet-lod-tectonic.js:187–235). There is no `height`, no province-of-relief array, no mutable substrate in the
   WS4 path.

2. **The substrate's BUILD output never reaches a renderer.** Grep for `runE6`/`makeBaseStep`/`makeSubstrate`
   outside the slice and the module itself returns ONLY `worldengine-fieldviz.html` (a read-only viz page) and
   vitest files (§6.1). `src/main.js` and `src/objects/Planet.js` contain zero references to `worldengine` or
   `substrate`. So the `height` field the base step writes is, today, drawn by nothing the player sees.

3. **In the shader the grain is consumed as a direction, not a structure.** `mix(uOrogenyAxis,
   sampleGrainStrike(pos).xz, uTectonicGrainStrength)` (height.glsl.js:950) — the grain swaps the per-feature
   seeded AXIS for the shared strike; the relief height is still `noised(q*freq+…)` (height.glsl.js:972). The
   `one-shared-grain` AC PASS ("cosToShared=1.000") proves the PLUMBING (one field → six consumers all point the
   same way) — an orientation property — not "the planet has a tectonic history as data."

**What WS4 actually delivered, precisely stated:** (i) E6's grain *projection* (a latitude-banded orientation cube
that re-aims six in-shader noise combiners) and (ii) E9's *subtraction* (a carve cube that lowers the noised
height along the routed network, live-path depth = order-tent). Both verified as mechanisms. **Neither is the
slice's `height` substrate.** The slice's defining move — E6 WRITES height and E9 CARVES the SAME height, so the
displaced surface IS the baked data — was not ported into the renderer. That omission is exactly why the mechanism
verified (the plumbing it was scoped to works) and Max's UAT failed (the relief still reads as oriented noise).

**Could I refute the hypothesis?** I looked for any path by which a baked `height`/substrate value reaches vertex
displacement or the height accumulator in either renderer. There is none: the game displaces from `snoise`
(Planet.js), the lab accumulates from `noised()` combiners (height.glsl.js), and the only `setZ`-from-data renderer
is the slice's own lab page (main.js:55), which is not the game or the production lab. The hypothesis stands.

---

## 4. The three E6/substrate code surfaces — relationship, duplication, canonical

There are **three** code surfaces sharing the E6 stress/grain math; they are a documented LINEAGE, not drift. (The
brief asked which is canonical and whether any is duplicate/dead.)

| Surface | Files | Role | Live? | Canonical for… |
|---|---|---|---|---|
| **A. Relief SLICE** | repo-root `relief-substrate.js`, `relief-base-step.js`, `relief-e6-tectonic.js`, `relief-e9-hydrology.js`, `relief-divergence.js`, `relief-presets.js`, `relief-slice.js` | Max-UAT-PASSED reference: full build+carve host-editor on a FLAT 2D DEM. The proof-of-concept that structure-as-data works | Live as the lab page; FROZEN reference (do-not-import) | **E9/hydrology** (the ONLY live copy) + the validated reference for the whole pipeline |
| **B. WS2 base step** | `src/worldengine/base/{substrate,baseStep,tectonic,sphereField,adaptL0,verify,fieldViz,mathutil}.js` | Production PORT of A's BUILD side; adds the sphere carrier A lacks; `adaptL0` consumes WS1's L0 scalars | Live; build half complete; Max VIZ-UAT 2026-06-25 | **E6 stress/grain MATH** + base step + L0 adapter + sphere carrier |
| **C. WS4 baker** | `planet-lod-tectonic.js` (single file) | Net-new glue: imports B's sphere path, bakes a grain ORIENTATION cube for the production lab shader | Live; on the production-lab render path | the renderer-facing GRAIN-CUBE bake (holds no E6 math of its own) |

**Duplication, exactly:** E6 stress math exists in **2 near-byte-identical copies** — A's `relief-e6-tectonic.js`
and B's `src/worldengine/base/tectonic.js` (same Melosh despun-shell formulas, same `NU=0.25`, same
`REGIME_GAIN=0.4` lock, same `{0,π/2}` quantized grain). This is a **deliberate, flagged** duplication: B is
declared the source of truth, and `planet-lod-tectonic.js:13–15` explicitly says "the lab `relief-e6-tectonic.js`
is reference only — do NOT import it (two copies → drift)." Substrate/base-step also exists in 2 copies (A's
`relief-substrate.js`+`relief-base-step.js`, B's `substrate.js`+`baseStep.js`); B adds the materialized
`crustalThickness` array + `loveK2`/`thermalState` proxies + the `calibrateTidal` tanh-knee. **E9/hydrology exists
in exactly 1 copy (A only)** — B never ported it; the lab's carve reuses the existing production river router
(`planet-lod-rivers.js`) instead. **No dead code among the three.**

**Canonical, restated for any future work:** for the **E6 math + base step + sphere path**, `src/worldengine/base/*`
(B) is canonical; the relief slice (A) is the validated reference to READ but NOT import; `planet-lod-tectonic.js`
(C) is the renderer-facing baker on top of B. **For E9/carve, A's `relief-e9-hydrology.js` is the only reference
that exists** (the production carve is a different, order-tent implementation in the river router).

---

## 5. Lock check + the one fork to flag

**No locked decision is contradicted.** All four maps and my own reads agree the slice + base step are faithful
instances of the 2026-06-22 locks: (a) share a first-class mutable RELIEF SUBSTRATE that BUILD engines WRITE and
SCULPT engines EDIT (slice: E6 `height+=`, E9 `height-=` on one array); (b) epoch/host-editor ordering (slice
epoch 1 build → epoch 2 carve, with a `heightAfterBuild` witness proving carve post-dates relief); (c) L0-gap
"Option A expose+derive" thin base step (baseStep.js derives, never time-steps); (d) type = derived LABEL
(baseStep.js:64 derives the discriminator from physics). The slice's flat-2D DEM, CPU-bake E9, and untouched
`PlanetGenerator` D12 hard-zero are all DECLARED non-goals, not violations.

**FLAG (sharpens a lock, does not break it):** the locks say "share a first-class mutable RELIEF SUBSTRATE … BUILD
write / SCULPT edit," but they leave implicit *which channel of that substrate the renderer expresses.* WS4-as-built
made a defensible reading — push the substrate's ORIENTATION (grain cube) to the shader and let the shader keep
synthesizing AMPLITUDE/height from noise (low blast radius, gated by `uTectonicGrainStrength`; this is Max decision
#6 in the production-L1 plan). That reading passed mechanism-verify and failed UAT. The other reading — the one the
slice demonstrates and the one Max's UAT verdict implies — is to bake and sample the substrate's **height** itself
(or a province amplitude derived from it) so the displaced surface IS the generated history. **The machinery to do
the second reading already exists** (B's `runE6` writes height; B's `sphereField` + C's `buildGrainCubeGeometry`/
`createGrainCube` already rasterize a per-node field into a seam-free cube — WS4 used that exact machinery to carry
orientation; it could carry height). So the gap is **not missing architecture** — it is a one-channel decision:
the renderer currently expresses the grain's *orientation* channel; closing the UAT means expressing the
substrate's *height* channel. That is a scope question for Max, flagged because the brief asked findings that touch
a lock be surfaced; here the lock is intact and this only sharpens it.

---

## 6. Evidence index (verified first-hand this session)

### 6.1 Grep results (run this session)
- `runE6`/`makeBaseStep`/`makeSubstrate` outside slice+module → **only** `worldengine-fieldviz.html:33` +
  `tests/*`. Game (`src/main.js`, `src/objects/Planet.js`) = **zero** worldengine/substrate refs.
- `planet-lod-tectonic.js:28–29` imports **only** `writeGrainSphere, stressAtLat` + `makeSphereField` from
  `src/worldengine/base/` — never `runE6`/`makeBaseStep`/`makeSubstrate`.
- `planet-lod-rivers.js:22` imports `bakeTectonicGrain, buildGrainCubeGeometry, createGrainCube` (orientation
  baker); `planet-lod-lab.html:159` imports `bakeTectonicGrain` as a read-back probe.
- `perNodeIncision`/`applyIncision` consumers outside the module = `tests/ws4-*` + `planet-lod-lab.html:5791–5792`
  (the `sampleRoutedHeight` PROBE) — **never** `buildValleyGeometry`/the live cube.
- Planet.js grep for tidalHeating|eccentricity|magneticField|systemContext|surfaceHistory|composition|
  habitability|T_eq|age = **zero**.

### 6.2 Load-bearing lines read first-hand
- LIVE carve subtraction: `planet-lod-lab.html:425 h -= carveDepth * uRiverCarveDepth`.
- LIVE carve depth source = order-tent: `planet-lod-rivers.js:753 d: depthAt(strahler[idx]…)`; def `:663–666`
  (`VALLEY_DEPTH_LO + (HI-LO)*t`, `t` from stream order).
- Stream-power Δ default law present but probe-only: `planet-lod-rivers.js:783,:845 r = CARVE_K*pow(A,M)*pow(S,N)`.
- Grain consumed as orientation: `planet-lod-height.glsl.js:950 grainProvinceRotate2(normalize(mix(uOrogenyAxis,
  …sampleGrainStrike(pos).xz, uTectonicGrainStrength)),…)`; relief still `noised()` `:972` (+ ~24 combiners).
- Slice host-editor: `relief-e6-tectonic.js:122 substrate.height[i] += …`; `relief-e9-hydrology.js:139
  substrate.height[i] -= dz`.
- Slice renderer reads data: `world-engine-relief-lab.main.js:55 pos.setZ(i, (h[i]-mid)*0.6)`.
- E6 math source-of-truth / do-not-import: `planet-lod-tectonic.js:13–15`.

### 6.3 Corrections to the brief / spine (carried from the maps, confirmed)
- **Stale line cite:** D12 hard-zero is `PlanetGenerator.js:613` (literal `0` as `tidalHeatingRate` to
  `computeSurfaceHistory`), NOT `:565` (a ring rngFloat). Spine §4 `:54`/`:130` and the brief both cite the wrong
  line. Any plumbing spec editing `:565` edits the wrong line.
- **Brief partially outdated:** eccentricity/D13/D16/metallicity and a `systemContext` graph ARE now surfaced
  (WS1, PG:737–741, SSG:624–679). The defect is now CONSUMPTION (surfaced-but-inert), not surfacing.
