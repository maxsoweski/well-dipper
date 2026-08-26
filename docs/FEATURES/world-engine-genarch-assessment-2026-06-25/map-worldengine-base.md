# Map of `src/worldengine/base/*` and reconciliation of the three E6 implementations

Assessment task (read-only), 2026-06-25. Repo: `well-dipper`, branch
`feature/world-engine-production-L1`. No code changed.

This document answers the four sub-questions of the task:
(a) what the `src/worldengine/base/*` layer is and what it generates as data;
(b) whether `sphereField.js` is the sphere/cubemap bridge the flat-DEM relief slice lacks;
(c) how `adaptL0.js` bridges the game L0 drivers into this layer;
(d) **CRUCIAL** — how `src/worldengine/base/*` relates to the repo-root `relief-*.js` slice
and to `planet-lod-tectonic.js`: duplicate, evolution, port-in-progress, or dead code; and
how many live E6/substrate codebases there are and which is canonical.

All cites are `file:line`.

---

## TL;DR

There are **THREE codebases** that share the same E6 stress/grain math, and they form a
deliberate, documented chain — NOT accidental drift:

1. **`relief-*.js` (repo root)** — the **Max-UAT-PASSED relief SLICE** (2026-06-23). The
   complete write-side reference pipeline: base step → E6 build (writes `height`) → E9 carve
   (subtracts from the SAME `height`) over a shared mutable substrate (host-editor model).
   FLAT 2D latitude-band DEM. Explicitly labelled "math/reference" by the plan.
2. **`src/worldengine/base/*` (WS2)** — the **production PORT** of the relief slice's *build
   side only*. It is the canonical SOURCE OF TRUTH for the E6 stress/grain math (`tectonic.js`),
   the base step (`baseStep.js`), the L0 adapter (`adaptL0.js`), and adds the **sphere carrier**
   (`sphereField.js`) the slice lacks. It has **NO E9/hydrology/carve** — that half was not
   ported. Verified by Max's VIZ UAT 2026-06-25.
3. **`planet-lod-tectonic.js` (WS4)** — the **net-new glue/baker** that consumes #2's sphere
   path (`writeGrainSphere`, `stressAtLat`, `makeSphereField`) to bake a per-node **grain
   ORIENTATION cube** for the production lab renderer (`world-engine-lab.html` /
   `planet-lod-rivers.js`).

**Canonical for the E6 *math*: `src/worldengine/base/tectonic.js`** — declared the source of
truth by `planet-lod-tectonic.js:13-15` (D10) and by the production-L1 plan. `relief-e6-tectonic.js`
is "reference only — do NOT import" (`planet-lod-tectonic.js:14`). The two E6 copies are a
near-verbatim duplicate today (see §4.3) — an intentional, flagged duplication, not drift.

**The WS4 UAT failure is explained by an asymmetry, not by these three codebases conflicting:**
the production renderer only consumes the **orientation half** of `src/worldengine/base/*`
(`writeGrainSphere` → grain cube). It never calls `runE6` (the half that writes `height` as
data), `makeBaseStep`, or any substrate. So the "structure as data" architecture that exists and
passed in the **relief slice** (#1) and the **base step** (#2) does NOT reach the renderer. The
renderer still synthesizes relief from noise and merely re-orients it by the grain — exactly Max's
"orientation overlay, not a planet with a tectonic history as data" complaint. See §5.

---

## 1. What `src/worldengine/base/*` is and what it generates as data

This is **WS2** of the production-L1 port — "the new thin L1 derivation layer (the base step)".
Per its intent (`docs/WORKSTREAMS/world-engine-base-step-2026-06-24/intent.md:14-21`): the
**write-side / read-side split** — the world-engine *writes* a planet's history; the renderer
*reads* it. WS2 takes WS1's now-real L0 drivers (tidal heat, age, etc.) and derives the
structured fields a relief engine reads. The plan (`world-engine-production-L1-plan.md:117-147`)
scopes WS2 as F1 (base-step interface) + F2 (L0 adapter) + F4 (orientation/stress field) + F7
(determinism + verifier), with F3 (sphere carrier) and F5 (interior) THINNED, F6 DEFERRED.

Eight files (all PURE — no three.js, no `Math.random`, no `Date.now`):

| file | role | data it generates |
|---|---|---|
| `mathutil.js` | scalar helpers | `clamp01`, `clamp`, `smoothstep`, `mix` (pure functions) |
| `substrate.js` | the shared mutable DEM (host of host-editor) | `makeSubstrate({n,lat0Deg,lat1Deg,domainKm})` → typed arrays: `height`, `grainAngle`, `grainMag`, `regime`(Uint8), `faultDensity`, `flowAccum`, `baseLevel`, `standing`(Uint8), `maturity` (`substrate.js:6-20`) |
| `adaptL0.js` | L0→base-step adapter + tidal calibration | `adaptL0(planetData)`→bundle; `calibrateTidal()`; constants `TIDAL_LOG_KNEE`, `AGE_NORM_DIVISOR`, `LOVE_K2_RANGE` (`adaptL0.js:12-49`) |
| `baseStep.js` | the Tier-1 "expose + derive" base step | `makeBaseStep(bundle, grid)` → `{drivers, crust, substrate}`. Derives `radialStrainSign/Mag`, `despinAmp`, `liquidStability`, `rockyCrust`, `tidalHeat`, plus a materialized `crust.crustalThickness` Float32Array and `loveK2`/`thermalState` interior proxies (`baseStep.js:10-99`) |
| `tectonic.js` | **E6** stress/grain math (the canonical E6) | `stressAtLat()`, `writeGrain()` (flat), `writeGrainSphere()` (sphere), `runE6()` (the BUILD half — writes `height`), exported band constants `REGIME_BAND_DEG`/`GRAIN_BAND_DEG`/`SEAM_LAT_TOL_DEG`, `NU`, `REGIME_GAIN` (`tectonic.js`) |
| `sphereField.js` | **F3** seam-free sphere carrier | `makeSphereField(mesh)` → same field arrays as substrate but per-NODE on an irregular sphere mesh, plus `latDegOf(i)`, `nodeDir(i)`, `tangentFrameAt(i)` (`sphereField.js:7-41`) |
| `verify.js` | **F7** field-level verifier gate | `verify(output)` → `{pass, signals:{finite,bounded,seamConsistent,physicallyOrdered}, detail}` (`verify.js:18-84`) |
| `fieldViz.js` | interim viz paint (read-only) | `regimeColor()`, `grainStreak()`, `thicknessHeat()`, `paintField()` for `worldengine-fieldviz.html` (`fieldViz.js`) |

**What it generates as DATA:** structured per-cell/per-node fields — a real `ReliefSubstrate`-shaped
structure. `runE6` (`tectonic.js:98-124`) is a genuine BUILD: it writes `substrate.height` via
grain-steered anisotropic noise + plateau uplift + Jacobi smoothing, identical in form to the
slice's `relief-e6-tectonic.js:97-129`. So WS2 *does* produce "structure as data" — height,
grain, regime, fault density, crustal thickness, interior proxies — for the build half.

**What it does NOT contain:** any E9/hydrology/carve. `ls -R src/worldengine/` confirms only the
8 files above; there is no `hydrology.js`/`e9`/`carve`. The carve half of the host-editor model
lives only in the root slice (`relief-e9-hydrology.js`) and (for the renderer) in the existing
production river router (`planet-lod-rivers.js`).

---

## 2. (b) Is `sphereField.js` the sphere/cubemap bridge the flat-DEM slice lacks?

**Yes — it is the sphere carrier (WS2 F3), and it is the one new capability `src/worldengine/base`
has that the root slice does not.** It is NOT itself a cubemap, but it is the prerequisite bridge
toward the seam-free cubemap consumption.

- The root slice's documented #1 NON-GOAL is exactly this: "Flat 2D latitude-band DEM, not
  sphere/cubemap (sphere mapping deferred)" (`relief-slice.js:22`). `makeSubstrate` there is a flat
  `n×n` grid indexed by `iy*n+ix` (`relief-substrate.js:5-20`).
- `sphereField.js` replaces that flat grid with a per-NODE carrier over an irregular sphere mesh
  `{verts:[[x,y,z]], faces, adj}` (`sphereField.js:7-9`). It provides:
  - `latDegOf(i)` = `asin(verts[i].y)` — per-node latitude from the 3D direction
    (`sphereField.js:23-26`), replacing the flat slice's `latDegOfRow` (row→latitude).
  - `tangentFrameAt(i)` — an orthonormal east/north frame at each node, with a documented pole
    fallback (`sphereField.js:27-39`). This is what lets a 2-value director be turned into a
    world-space strike vector.
  - the same field arrays (`height`, `grainAngle`, `grainMag`, `regime`, …) as the flat substrate.
- The matching sphere-native E6 writer is `writeGrainSphere(carrier, drivers)`
  (`tectonic.js:53-63`). Its seam-continuity argument is explicit: because regime/grain are a
  **pure function of latitude**, same-latitude seam neighbours agree by construction — continuity
  across the antimeridian and poles holds (`tectonic.js:50-52`). `verify.js`'s `seamConsistent`
  check (`verify.js:64-80`) gates this; there are dedicated seam tests
  (`tests/worldengine-base-seam.test.js`).
- **Three-free by design:** `sphereField.js` consumes a PLAIN mesh built elsewhere; the actual
  mesh builder `buildIrregularSphere` (which imports three) lives in `planet-lod-rivers.js:246`
  (`sphereField.js:3-4`). So the carrier stays pure/headless-testable while real meshes come from
  the production router.

**Cubemap step:** the carrier is the data bridge; the actual cubemap rasterization happens one
layer UP, in `planet-lod-tectonic.js` (`buildGrainCubeGeometry:145`, `createGrainCube:187`), which
rasterizes the per-node strike field into a HalfFloat CubeCamera texture the planet shader samples
by direction (`textureCube(uTectonicGrainCube, normalize(vPos))`). That is the seam-free,
pole-distortion-free contract that solves the slice's "cubemap-seam lake breakage" hazard — but it
is currently used **only to carry orientation** (see §5).

---

## 3. (c) How `adaptL0.js` bridges the game L0 drivers into this layer

`adaptL0.js` is the **F2 L0-consumption adapter** — the "Option A expose + derive" bridge. Two
parts:

1. **`adaptL0(planetData)`** (`adaptL0.js:23-49`) — pure; never mutates `planetData`. It maps a
   WS1 `planetData` object (the game's L0 driver bundle) into the base-step's input "bundle":
   - **Tidal precedence (single-source):** prefers the upstream D12 value
     `planetData.tidalHeating` if present; otherwise leaves it undefined so the base step recomputes
     via the Io-formula (`adaptL0.js:34`, consumed at `baseStep.js:23-28`).
   - **Age normalization:** `age` (Gyr) → `ageNorm` ∈ [0,1] via `/AGE_NORM_DIVISOR` (=10)
     (`adaptL0.js:36`).
   - **Unit fix:** `composition.density` from `kg/m³` → `g/cm³` when it looks like kg/m³ (>100),
     because the base step's `smoothstep(2.5,3.9,density)` rocky-crust gate expects g/cm³
     (`adaptL0.js:28-31`).
   - **Pass-throughs:** `magneticField`, `metallicity`, `eccentricity`, `systemContext`,
     `radiusEarth`, `massEarth`, `T_eq`, `surfaceHistory` (`adaptL0.js:38-47`).
2. **`calibrateTidal(rawIoRatio)`** (`adaptL0.js:17-20`) — `tanh(log10(1+h)/KNEE)`, KNEE=1.6.
   Maps the raw Io-ratio to a bounded `[0,1)` driver that never saturates to exactly 1.0 (so
   distinct heating levels never collapse). Io-grade anchored at ≈0.19 deliberately low to keep
   top-end spread (Max-confirmed; `adaptL0.js:6-12` + `KNOWN-BEHAVIORS.md` §2).

**The "expose + derive" base step itself is `baseStep.js`** (`makeBaseStep`). It is the thin
Tier-1 layer the locked design calls for: it consumes the adapted bundle and DERIVES structured
fields rather than time-stepping. Per the intent (`base-step-2026-06-24/intent.md:34-46`), the
success criterion is "switch to a different kind of world and you get categorically different
fields — not recolored noise," and "nothing in `src/generation/` changes" (Option A — derive
alongside, don't edit the generator core). `baseStep.js` derives `radialStrainSign/Mag`,
`despinAmp`, `shellThickness`, `liquidStability` (verbatim port of the production liquid-gate
chain, `baseStep.js:45-62`), `rockyCrust`, and the interior proxies `loveK2`/`thermalState`
(`baseStep.js:84-92`). **Type becomes a derived label, not a load-bearing input** — consistent
with the locked design: `discriminator = radialStrainSign + ':' + (rockyCrust>0.5?'sil':'ice')`
is derived from physics, never passed in (`baseStep.js:64`).

The full L0→L1 chain is therefore: `planetData` → `adaptL0()` → bundle → `makeBaseStep()` →
`{drivers, crust, substrate}` → `runE6()`/`writeGrainSphere()` writes the fields → `verify()` gates
them. The integration test `tests/worldengine-base-tidal-integration.test.js` exercises
`adaptL0` → `makeBaseStep` end to end.

---

## 4. (d) CRUCIAL — relationship of the three surfaces; how many live E6 codebases; which is canonical

### 4.1 The three surfaces and their wiring (grep-verified)

| surface | files | imported / wired by | nature |
|---|---|---|---|
| **A. Relief SLICE (root)** | `relief-substrate.js`, `relief-base-step.js`, `relief-e6-tectonic.js`, `relief-e9-hydrology.js`, `relief-divergence.js`, `relief-presets.js`, `relief-slice.js` | `world-engine-relief-lab.main.js` (the lab page) + `worldengine-fieldviz.html` imports `relief-presets.js` only | Max-UAT-PASSED reference pipeline (build+carve), FLAT DEM |
| **B. `src/worldengine/base/*` (WS2)** | the 8 files in §1 | `worldengine-fieldviz.html` (`makeBaseStep`) + `planet-lod-tectonic.js` (sphere path) + 12 vitest files | Production PORT of A's BUILD side, + sphere carrier; canonical E6 math |
| **C. `planet-lod-tectonic.js` (WS4)** | single file | `planet-lod-rivers.js:22` + `world-engine-lab.html:159` + WS4 tests | Net-new baker; consumes B; bakes a grain ORIENTATION cube for the renderer |

Key grep findings:
- **A (slice) is self-contained.** Every `relief-*.js` imports only other `relief-*.js`. It is the
  lab's reference impl, reached only through `world-engine-relief-lab.main.js`. It is NOT imported
  by any production renderer file.
- **B is imported by exactly two non-test consumers:** `worldengine-fieldviz.html` (the interim
  read-only viz page, uses `makeBaseStep`) and `planet-lod-tectonic.js` (uses
  `writeGrainSphere`, `stressAtLat`, `makeSphereField`). Everything else importing B is a vitest
  file (`tests/worldengine-base-*.test.js`, `tests/ws4-*.test.js`).
- **B's BUILD half (`runE6`) and base step (`makeBaseStep`) are NEVER called by the renderer.**
  Grep for `runE6`/`makeBaseStep` outside `relief-*` and the module itself returns only test files
  and `worldengine-fieldviz.html`. The production planet renderer path
  (`planet-lod-tectonic.js` → `planet-lod-rivers.js` → `world-engine-lab.html`) calls ONLY
  `writeGrainSphere`/`stressAtLat`/`makeSphereField` — the orientation/grain channels.
- **C is wired into the production lab renderer.** `planet-lod-rivers.js:22` imports
  `bakeTectonicGrain, buildGrainCubeGeometry, createGrainCube`; `world-engine-lab.html:159` imports
  `bakeTectonicGrain` as a re-readback probe.

### 4.2 What each is: duplicate / evolution / port-in-progress / dead?

- **A (relief slice): live, frozen reference.** Not dead — it is the Max-UAT-PASSED proof
  (2026-06-23) and is still the lab page `world-engine-relief-lab.html`. But it is a *reference*,
  not on the production renderer path. Plan repeatedly calls `relief-e6-tectonic.js` the "math
  reference" (`world-engine-production-L1-plan.md:136, 220`). `planet-lod-tectonic.js:14-15` says
  "The lab `relief-e6-tectonic.js` is reference only — do NOT import it (two copies → drift)."
- **B (`src/worldengine/base`): a production-port-in-progress that is COMPLETE for the build side.**
  It is the WS2 deliverable. Its own files' headers declare it a "Production port of
  relief-*.js" (`tectonic.js:2`, `baseStep.js:2`, `substrate.js:2`). It adds the sphere carrier
  the slice lacked. Its E9/carve half is intentionally NOT ported (the plan reframes WS4 to reuse
  production's existing sphere river router instead — `world-engine-production-L1-plan.md:43-49`).
- **C (`planet-lod-tectonic.js`): live, net-new, the actual renderer glue.** Its header
  (`planet-lod-tectonic.js:1-7`) calls itself "the net-new glue (dossier risk #1) that builds a
  grain carrier, runs the prod E6 writer, and produces the per-node STRIKE-ONLY field the renderer
  will consume. Nothing else in the codebase does this." It is partially built per its own scope
  notes (T4 scaffold → T7 cube → "T8 calls update() inside route()").
- **No dead code among the three.** (A's `relief-divergence.js`/`relief-presets.js` are still used
  by the slice + viz.)

### 4.3 How many live E6/substrate codebases — and which is canonical

**There are TWO live substrate/base-step codebases (A and B) and TWO copies of the E6 stress math
(in A's `relief-e6-tectonic.js` and B's `tectonic.js`); C holds NO E6 math of its own — it imports
B's.** So:

- **E6 stress/grain MATH: 2 copies, canonical = `src/worldengine/base/tectonic.js` (B).**
  `stressAtLat`, `writeGrain`, the NU/REGIME_GAIN constants, and the band geometry are near
  byte-identical between `relief-e6-tectonic.js:24-60` and `tectonic.js:19-48` — the same
  Melosh despun-shell formulas, same `REGIME_GAIN=0.4` lock, same `{0, π/2}` quantized grain. B
  ADDS the sphere-native `writeGrainSphere` (`tectonic.js:53-63`) and the exported band constants
  `REGIME_BAND_DEG`/`GRAIN_BAND_DEG`/`SEAM_LAT_TOL_DEG` (`tectonic.js:14-17`) that A lacks. The
  D10 decision (`planet-lod-tectonic.js:13-15`) names B the source of truth precisely to avoid
  drift; C imports B, never A.
- **Substrate/base-step: 2 copies (A's `relief-substrate.js`+`relief-base-step.js`, B's
  `substrate.js`+`baseStep.js`).** B is the production-port and the forward path; A is the frozen
  reference. The two base steps differ in small, documented ways: B prefers upstream
  `d.tidalHeat`/`d.ageNorm` and routes tidal through `calibrateTidal` (the tanh knee), and B
  materializes a `crustalThickness` array + `loveK2`/`thermalState` proxies that A computes more
  thinly (A's `crust` is just `{shellThickness, thicknessBlob}`, `relief-base-step.js:90`).
- **E9/hydrology: ONE live copy (A's `relief-e9-hydrology.js`).** B has none. The renderer's carve
  reuses the *existing* production river router (`planet-lod-rivers.js`), per the WS4 reframe — not
  a port of A's E9.

**Bottom line on canonicity:** for any future E6/base-step work, `src/worldengine/base/*` (B) is
canonical; `relief-*.js` (A) is the validated reference to read but not import; `planet-lod-tectonic.js`
(C) is the renderer-facing baker on top of B.

---

## 5. Why this matters for the WS4 UAT failure (synthesis)

The apparent tension in the task brief — "the relief slice LOOKS like the structure-as-data
architecture WS4 was missing" — resolves cleanly once the wiring asymmetry is seen:

- **The structure-as-data architecture genuinely EXISTS and PASSED** in two places: the relief
  slice (A, Max-UAT 2026-06-23) and the WS2 base step build half (B, Max VIZ-UAT 2026-06-25).
  Both produce a real mutable `height` DEM that E6 BUILDS and (in A / the river router) gets
  CARVED. That is "procgen decides, data upstream."
- **But the renderer never consumes that data.** WS4 (C) bakes only the grain **orientation**
  channels (`writeGrainSphere` → strike/grainMag/regime cube). By Max decision #6
  (`world-engine-production-L1-plan.md:264`) and the WS4 contract restatement
  (`relief-wiring-2026-06-25/notes.md:24-62`), the grain **AUGMENTS** `gProvince` —
  it replaces the SIX in-shader strike/orientation hash sites, while amplitude (`gProvince`) and
  the relief height itself stay **synthesized in the fragment shader**. The shader still generates
  the mountains/scarps/canyons from noise; the grain only tells them which way to point.
- **That is precisely Max's UAT verdict:** "an orientation overlay, not a planet with a tectonic
  history / structure as data." The data that exists upstream (B's `runE6` `height`, A's full
  carved DEM) is not the thing the shader reads; the shader reads a thin orientation field and
  re-synthesizes relief.

### FLAG — a real architectural fork, surfaced for Max (does NOT contradict a lock; sharpens one)

This is not a contradiction of the locked design, but it sharpens a decision the locks leave
implicit. The locked design (`world-engine-wf2-synthesis.md` §2) is "share a first-class mutable
RELIEF SUBSTRATE that BUILD engines WRITE and SCULPT engines EDIT." The relief slice (A) and WS2
build step (B) implement that substrate as **DATA**. **WS4-as-built does not push that substrate's
`height` to the renderer** — it pushes orientation only and lets the shader keep synthesizing
amplitude. So there are two readings of "wire E6→E9 into the renderer":

1. **Orientation-augment reading (what WS4 built):** the substrate stays a CPU/data concept; the
   shader expresses it via a thin grain cube (orientation) + the existing province amplitude. Low
   blast radius; gated by `uTectonicGrainStrength`. This passed mechanism-verify but failed Max's
   UAT because the relief still reads as shader-noise oriented by an overlay.
2. **Substrate-as-data reading (what the slice/base-step demonstrate and what Max's UAT seems to
   want):** the baked-once `height`/substrate field itself drives displacement, so "what you see
   IS the generated history." This is closer to the relief slice's host-editor result and to the
   north-star "PROCGEN DECIDES, RENDER EXPRESSES."

The relief slice (A) proves reading #2 is achievable as DATA on a flat DEM; the WS2 sphere carrier
(B, `sphereField.js` + `writeGrainSphere`) plus the WS4 cube machinery (C,
`buildGrainCubeGeometry`/`createGrainCube`) are exactly the parts needed to carry a baked sphere
**height/substrate** field — not just orientation — into the renderer as a sampled texture. WS4
used that machinery to carry orientation; the same machinery could carry the substrate height the
base step already writes. **Recommendation to surface:** the gap is not missing architecture — it
is that the renderer reads the grain's *orientation* channel and not the substrate's *height*
channel. Closing the UAT likely means baking and sampling the WS2/slice `height` (or a province
amplitude derived from it) as data, rather than (or in addition to) re-synthesizing it in-shader.
This is a scope question for Max, flagged per the locked-design "if findings challenge a lock,
FLAG it" instruction — here the locks are intact; the open question is *which channel of the
already-built substrate the renderer expresses.*

---

## Appendix — evidence index (file:line)

- 3 surfaces' files: `ls -R src/worldengine/base` (8 files, no E9); root `relief-*.js` (7 files);
  `planet-lod-tectonic.js`.
- D10 source-of-truth / "do NOT import the lab E6": `planet-lod-tectonic.js:13-15`.
- WS4 consumes only orientation: `planet-lod-tectonic.js:28-29, 81-127`;
  `planet-lod-rivers.js:22`.
- `runE6`/`makeBaseStep` are test+viz only (never renderer): grep results in §4.1.
- Sphere carrier: `sphereField.js:7-41`; sphere E6 writer + seam argument: `tectonic.js:50-63`;
  seam gate: `verify.js:64-80`.
- Adapter / expose+derive: `adaptL0.js:17-49`, `baseStep.js:10-99`.
- Relief slice host-editor build+carve: `relief-slice.js:34-51`; E6 build: `relief-e6-tectonic.js:97-129`;
  E9 carve: `relief-e9-hydrology.js:104-152`; flat-DEM/sphere non-goal: `relief-slice.js:22`.
- E6 math duplication (A vs B): `relief-e6-tectonic.js:24-60` ≈ `tectonic.js:19-48`.
- WS4 grain augments gProvince (orientation only): `world-engine-production-L1-plan.md:264`
  (decision #6); `relief-wiring-2026-06-25/notes.md:24-62` (six orientation sites replaced,
  amplitude preserved).
- Locked design (shared mutable substrate, host-editor): `world-engine-wf2-synthesis.md` §2
  (per task brief); WS sequencing WS1→WS2→WS4: `world-engine-production-L1-plan.md:64-76`.
- Known-behavior UAT notes (WS2): `world-engine-base-step-2026-06-24/KNOWN-BEHAVIORS.md`.
