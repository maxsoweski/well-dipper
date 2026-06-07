# Canonical Uniform Registry — the cross-domain naming contract (Stage-C step 1.3)

**Date:** 2026-06-06 · **Project:** `~/projects/well-dipper` · **Lab:** `planet-lod-lab.html` + `planet-lod-lab-core.js`
**Source of truth:** integration-index §1 (`research/stage-b/RESEARCH_stage-b-00-INTEGRATION-INDEX-2026-06-06.md`).

During Stage-B, eight domain agents independently proposed the **same conceptual
quantity under different names**. This registry fixes **ONE canonical name per
shared concept** so the eight domains read a single agreed name instead of
forking parallel ones. The **owner** derives/writes it; **consumers** read it —
they never recompute.

This is a *contract*, not live wiring: a name is declared here once, and its
owner domain brings it alive (its derivation in step 2, its GLSL declaration +
read when that domain lands in step 3+). Until then a reserved uniform sits at
its default. **Before adding any new shared uniform, check this table — if the
concept is here, use the canonical name.**

---

## Status legend
- **LIVE** — built and exercised in the lab now.
- **RESERVED** — canonical name declared in the central registry (the `uniforms`
  object) at default; owner wires derivation + GLSL read when its domain lands.
- **DEFERRED** — named here, but not declared in code yet (per-domain, or needs a
  generation-side decouple / Max-decision first). The owner declares it.

## The registry

| Concept | Canonical name | Kind | Default | Owner (derives) | Consumers (read) | Status | Where |
|---|---|---|---|---|---|---|---|
| 3D cellular primitive | `voronoi3d()` + `uVoroCells` | shader helper + uniform | 27 | Relief (canonical impl) | Cryo (pits/polygons), Exotic (hex/crystal/shatter) | **LIVE** | step 1.1 `262f63a`; **first consumer = F2 craters, step 3** — `uVoroCells` now driver-wired from `deriveUniforms.craterCells` (qualityTier 27↔9) |
| Blackbody emissive color | `emissiveBlackbody(tempK)` | shader helper (+ CPU mirror) | — | shared lib | Bands (F32/F33 thermal), Exotic (F41 magma) | **LIVE** | step 1.2, `304f998` |
| Substellar angle (tidally-locked) | `vSubstellarAngle` | vertex **varying**, computed once | — | shared vertex calc | Bands (thermal), Clouds (F31f pupil/ring), Cryo (nightside cap), Optical (limb/terminator) | **LIVE** | step 1.4 |
| Canyon/chasma depth accumulator | `canyonHeight` | fragment-local **accumulator** | 0.0 | Relief (tectonic graben) | Fluvial (incised gorge **adds in**), Cryo (cryo-chasma **adds in**) | **LIVE** — **WRITTEN by F4** `canyonCombiner` (tectonic graben), step 3; Fluvial/Cryo add in when they land | step 1.5 (declared) · step 3 F4 (written) |
| Liquid on/off gate | `uLiquidStability` (0..1) | uniform float | 0.0 | Fluvial | Aeolian (`dryness = 1-liquidStability`), Cryo (freeze boundary), Optical (glint presence) | **LIVE** (derivation) | step 2 #3 |
| Liquid body mask | `uLiquidMask` | uniform float | 0.0 | Fluvial | Optical (sunglint F36) | **RESERVED** | step 1.3 (shader-computed at `seaLevel`; lands with Fluvial step 3) |
| Liquid material kind | `uLiquidSpecies` (enum: 0=water, 1=methane/ethane) | uniform int | 0 | Fluvial | Optical (glint IOR/tint) | **LIVE** (derivation) | step 2 #3 |
| Icy-resurfacing activity | `uCryoActivity` (0..1) | uniform float | 0.0 | Cryo (D2/D12→P7) | Relief (F9/F10 chaos/ridged rendering) | **LIVE** — Cryo wired the derivation 2026-06-07 (`deriveUniforms` → `cryoActivity = clamp01(tidalProxy × volatileGate × coldGate)`, D12 tidal × D2 volatiles × D1 cold; flows preset→`state`→uniform). Option-A lab-knob stub RETIRED → the ◀ ICY ACTIVITY slider is now a manual override. "Europa (icy moon)" preset exercises it. Consumers F9 `chaosCombiner` + F10 `cryoRidgeCombiner`. | step 1.3 (declared) · step 3 F9/F10 (read) · Cryo step 1 (derived) |
| Province weight (Stage-D) | `uProvinceWeight` (multiplier) | uniform float | **1.0** (no-op) | Stage-D provinces (PLANNED) | **ALL combiners** (F1–F10 + the 8 domains) — each multiplies its contribution by `provinceWeight(FEATURE_ID)` | **RESERVED 2026-06-07** (index §4 #8 / §8) — name + JS-uniform + GLSL decl reserved BEFORE the fan-out so domains author province-aware combiners (multiply by the no-op 1.0 now). Global uniform ⇒ no combiner *signature* changes when Stage-D swaps the scalar for the spatial field. NB default is **1.0** not 0.0 (a multiplier, not a gate). Flip to LIVE when Stage-D wires the spatial weight field + retrofits F1–F10's multiplies (a `dev-collab-scope` job). | declared `planet-lod-lab.html` (uniforms + GLSL); convention = index §8 |
| Dry-region dressing | `dryness = 1 - uLiquidStability` + Fluvial `playaMask` | derived / uniform | — | Fluvial emits `playaMask` | Aeolian dresses it with dunes | **DEFERRED** (Fluvial) | — |
| Terrestrial circulation bias | `latBias(lat)` | shader function | — | Bands | Clouds (F26/F31a placement) | **DEFERRED** (Bands) — NB currently coupled in `Planet.js:587-616`; **decouple** when Bands lands | — |
| Storm array carriage | `uStormPosSize[8]` / `uStormParams[8]` / `uStormColor[8]` / `uStormCount` | uniform flat arrays (cap 8) | — | Bands (consumes existing `storms.spots`/`polarStorm`; mirrors `shadowMoonPos[6]`) | — | **DEFERRED** (Bands, per-domain) | — |

---

## Generation-side surfacings (step 2 — feeds the RESERVED uniforms above)

The RESERVED uniforms wait on these `PlanetGenerator` derivations (index §2). They
are NOT built in step 1 — listed here so the owner wires name→derivation together.

| New field | Feeds | Notes |
|---|---|---|
| `surfaceGravity` (g = M/R²) | Relief (crater simple→complex F2, edifice height F7), Aeolian (dune scale F15) | **DONE** — computed in `deriveUniforms` from bundle `massEarth`/`radiusEarth`; 4 TDD tests (`tests/planet-lod-generation.test.js`); presets carry illustrative mass/radius. **First consumer LIVE: F2 craters (step 3)** — `craterComplexD = k/g` gates the simple→complex transition (low-g Titan/Frozen → big transition → simple bowls; high-g → central peaks). |
| planet-level `tidalHeat` | Relief (F8 lava, F7 edifices), Cryo (P7 cryovolcanism) | **DONE** — `deriveUniforms` mirrors PhysicsEngine.tidalHeating()'s Io-normalized physics, star-parameterized (planet self-heating); raw scalar (huge range), consumers map to 0..1. 5 TDD tests. **Production TODO:** confirm eccentricity/starMass/orbit reach `planetData` (Relief §F8 flag). |
| `magneticField` (D13) | Optical (aurora F37) | **DONE** — Q6 RESOLVED (Max 2026-06-06: generation derives, Optical reads). `deriveUniforms` = `iron × lock-factor`, mirrors `PhysicsEngine.js:168` fieldStrength; `auroraIntensity` refactored to `magneticField × hasAtmo`. 5 TDD tests. `_derived`-only (Optical declares the uniform in step 3+); also drives atmosphere stripping. |
| `precipitation` (D4) | Fluvial (channel activity F11) | **DONE** — `deriveUniforms` = `liquidStability` × rain-cycle composition factor (n2-o2 1.0/co2-n2 0.5/co2 0.2/h2-he·none 0); 7 TDD tests. `_derived`-only (Fluvial reads in step 3). Presets carry atmosphere `composition`. |
| `atmosphere.physics.pressure` → shader | Aeolian (grain transport) | **DONE** — pure passthrough of the bundle's atmosphere `pressure` in `deriveUniforms`; 4 TDD tests. `_derived`-only (Aeolian F15 reads in step 3). |
| `volatileSpecies` classifier (N₂/CO₂/CH₄/H₂O) | Cryo (sublimation morphology + frost color) | **DONE** — `deriveUniforms` JS selector (enum 0=none/1=H₂O/2=CO₂/3=CH₄/4=N₂) from `composition.volatileFraction` + `T_eq` condensation bands; 8 TDD tests. `_derived`-only (per-domain — Cryo declares `uVolatileSpecies` when it lands in step 3). Composition refinement within a band is a Cryo TODO. |
| `liquidStability` + `liquidSpecies` | Fluvial (gates the whole fluvial/coastal/karst stack), Optical, Aeolian, Cryo | **DONE** — `deriveUniforms` AND's three gates (D6 retention via `atmosphere.retained`/`pressure` · D2 `composition.volatileFraction` bone-dry floor 0.05 · D1 soft T-windows: water ~273–373 K, methane ~90–112 K). `liquidSpecies` = which window T_eq fell in (0=water, 1=methane). 8 TDD tests; presets carry `volatileFraction`+`retained`/`pressure`; "Titan" preset exercises methane. Promoted the old `liquidWater` proto (now drives `specStrength` continuously). |

---

## Rule of use
1. Adding a shared quantity? Find its row here and use the canonical name.
2. New cross-domain concept not listed? Add a row here FIRST (canonical name +
   owner + consumers), then declare it — so the next domain can't collide.
3. RESERVED → LIVE when the owner wires its derivation and a consumer reads it.
   Update the Status column in the same commit.
