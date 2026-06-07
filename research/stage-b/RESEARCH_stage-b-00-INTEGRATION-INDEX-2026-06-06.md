# Stage-B Integration Index — cross-domain deconfliction for the planet rendering system

**Date:** 2026-06-06
**Project:** `~/projects/well-dipper` (three.js r183.1 / WebGL2).
**Status:** Stage-B research COMPLETE — 8 per-domain docs landed. This index is the **orchestrator's
synthesis**: it deconflicts the shared uniforms, names the generation-side surfacings, fixes the shader
pipeline order, and aggregates the Max-decisions + technical risks. **Stage C reads THIS first**, then the
per-domain docs for detail.

> Frame is unchanged from the Stage-A spec (`docs/superpowers/specs/2026-06-06-planet-rendering-foundation-design.md`):
> ground-up NEW system, builds up from the 1-LOD retro/dithered/posterized base, **no parity-with-old goal**,
> **no `planetType` branch** (types = driver-bundle presets), single shader behind `qualityTier` + `lodRamp`,
> emissive terms bypass the posterize quantizer.

---

## The 8 domain docs

| Domain | File | Scope (F#) | Lab folder |
|---|---|---|---|
| Relief | `RESEARCH_stage-b-relief-2026-06-06.md` | F1–F10 (mountains, craters, ejecta, canyons, scarps, plateaus, edifices, lava, chaos, ridged-icy) | `▸ Surface — Relief` |
| Fluvial | `RESEARCH_stage-b-fluvial-2026-06-06.md` | F11–F14, F20, F21 (rivers, deltas, outflow, lakes/seas, coastlines, karst) | `▸ Fluvial` |
| Aeolian | `RESEARCH_stage-b-aeolian-2026-06-06.md` | F15, F16, F40 (dunes, dust mantles, dust storms) | `▸ Aeolian` |
| Cryo | `RESEARCH_stage-b-cryo-2026-06-06.md` | F17, F18, F22, F23 (glacial, sublimation, caps, snowline) | `▸ Cryo / Sublimation` |
| Bands & Storms | `RESEARCH_stage-b-bands-storms-2026-06-06.md` | F24–F30, F32, F33 (bands, jets, weather bands, spots, storm clusters, polar vortex, lightning, thermal) | `▸ Bands & Storms` |
| Clouds & Haze | `RESEARCH_stage-b-clouds-haze-2026-06-06.md` | F31a–f (the cloud/haze family) | `▸ Clouds & Haze` |
| Optical | `RESEARCH_stage-b-optical-2026-06-06.md` | F34–F39 (limb, terminator, glint, aurora, airglow, cloud optics) | `▸ Optical / Atmosphere` |
| Exotic / Overlay | `RESEARCH_stage-b-exotic-overlay-2026-06-06.md` | F41–F49 (magma, carbon, crystal, hex, shatter + biotic/tech overlays) | `▸ Exotic / Overlay` |

---

## 1. Shared-uniform deconfliction (DO THIS BEFORE WRITING STAGE-C UNIFORMS)

Multiple agents independently proposed the **same conceptual uniform under different names**. Stage C must
declare ONE canonical name per row in the central uniform registry. The "owner" derives/writes it; the
"consumers" read it — never recompute.

| Concept | Proposed names (by domain) | **Canonical** | Owner (derives) | Consumers (read) |
|---|---|---|---|---|
| Liquid on/off gate | `liquidStability` (Fluvial) / `1-uDryness` (Aeolian) | **`liquidStability`** (0..1) | Fluvial | Aeolian (`dryness = 1-liquidStability`), Cryo (freeze boundary), Optical (glint presence) |
| Liquid body mask | `liquidMask` (Fluvial) / `uLiquidMask` (Optical) | **`liquidMask`** | Fluvial | Optical (sunglint F36) |
| Liquid material kind | `liquidSpecies` (Fluvial) / `uLiquidType` (Optical) | **`liquidSpecies`** (enum: water / methane-ethane) | Fluvial | Optical (glint IOR/tint) |
| Icy-resurfacing activity | `uIceShellActivity` (Relief) / `cryoActive` (Cryo) | **`cryoActivity`** (0..1) | Cryo (D2/D12→P7) | Relief (F9/F10 chaos/ridged rendering) |
| Canyon/chasma depth accumulator | `canyonHeight` (Relief) | **`canyonHeight`** (shared accumulator) | Relief (tectonic graben) | Fluvial (incised gorge **adds in**), Cryo (cryo-chasma **adds in**) |
| Dry-region dressing | `uDryness` (Aeolian) / playa-evaporite mask (Fluvial) | **`dryness = 1-liquidStability`** + Fluvial's `playaMask` | Fluvial emits playaMask | Aeolian dresses it with dunes |
| Substellar angle (tidally-locked) | `vSubstellarAngle` (Bands) | **`vSubstellarAngle`** (varying, computed ONCE) | shared vertex calc | Bands (thermal), Clouds (F31f pupil/ring), Cryo (nightside cap), Optical (limb/terminator) |
| Terrestrial circulation bias | `latBias` (Bands) | **`latBias`** (function) | Bands | Clouds (F26/F31a placement). NB currently coupled in `Planet.js:587-616` — decouple. |
| Blackbody emissive color | `emissiveBlackbody(tempK)` (Bands) | **shared GLSL helper** | shared lib | Bands (F32/F33 thermal), Exotic (F41 magma) |
| 3D Voronoi primitive | 27/9-cell + F2−F1 + analytic normals (Relief, Cryo, Exotic all need it) | **ONE shared `voronoi3d()` lib + `voronoiCellCount` knob** | Relief (canonical impl) | Cryo (pits/polygons), Exotic (hex/crystal/shatter). **Do NOT fork parallel primitives.** |
| Storm array carriage | `uStormPosSize[8]`/`uStormParams[8]`/`uStormColor[8]`/`uStormCount` (Bands) | **flat arrays cap 8** (mirrors existing `shadowMoonPos[6]`/`shadowPlanetPos[2]`) | Bands (consumes existing `storms.spots`/`polarStorm`) | — |

**The single highest-leverage shared asset is `voronoi3d()`** — three domains (relief craters, cryo
sublimation pits/convection polygons, exotic hex/crystal/shatter) all depend on the same seam-free 3D 27-cell
(desktop) / 9-cell (mobile) Voronoi with F2−F1 borders and analytic-derivative normals. Build it once, in the
relief work, behind the `qualityTier`/`voronoiCellCount` scalar. Every cellular feature in the system routes
through it.

---

## 2. Generation-side surfacings (NEW first-class fields — the Phase-2 data work, per-feature)

These drivers are computed but **not exposed** to the renderer today. Each is a small `PlanetGenerator`
derivation extending the aurora/atmosphere precedent (`Planet.js:1051, 1070-1076`). Surface them as
semantic uniforms.

| # | New field | Derivation | Needed by | Notes |
|---|---|---|---|---|
| 1 | **`surfaceGravity`** (g) | `M/R²` (M from `estimateMassEarth`, R known) — derivable, not returned | Relief (crater simple→complex transition F2, edifice height F7), Aeolian (dune repose/scale F15) | Highest-value single addition; gates two domains. |
| 2 | **planet-level `tidalHeat`** | existing `tidalHeating()` is **moon-parameterized** — add a planet-level value | Relief (F8 lava, F7 edifices), Cryo (P7 cryovolcanism) | Don't reuse the moon function as-is. |
| 3 | **`magneticField`** (D13) | currently inline-computed TWICE (`PhysicsEngine.js:168`, `PlanetGenerator.js:440`); return it once | Optical (aurora F37 — sole visual consumer) | **Cross-cutting GATE**: also drives atmosphere stripping (P25) → the D6 retention that Fluvial/Aeolian gate on. Optical is the natural owner of the refactor (see Max-decision Q below). |
| 4 | **`precipitation`** (D4 rain) | surface from `computeAtmosphere` | Fluvial (channel activity F11) | Not first-class today. |
| 5 | **`atmosphere.physics.pressure` → shader** | computed, not passed | Aeolian (grain transport threshold) | Plumbing only. |
| 6 | **`volatileSpecies`** classifier | `deriveComposition` returns scalar `volatileFraction` only — add a species classifier (N₂/CO₂/CH₄/H₂O) | Cryo (sublimation morphology + frost color) | Parallels Clouds' `cloudSpeciesFor(composition, T_eq)` JS selector (the only allowed branch — in JS, not shader). |
| 7 | **`liquidStability` + `liquidSpecies`** | new derivations from D1+D2+D6 | Fluvial (gates the whole fluvial/coastal/karst stack), Optical, Aeolian, Cryo | The master gate of §1 row 1. |

---

## 3. Shader pipeline ORDER (the compositing contract)

Several seams are really one constraint: **a fixed order of operations** in the fragment shader. Stage C
builds the mega-shader in this sequence; emissive terms (★) are added AFTER the posterize split per the
Stage-A envelope.

```
1. noised() height/derivative base                 (Stage-A foundation)
2. RELIEF combiner   — mountains, craters, scarps, canyonHeight accumulator
3. CRYO              — frost-mask + sublimation pits  (reads cryoActivity; writes into canyonHeight)
4. FLUVIAL incision  — channels/karst carve height    (adds into canyonHeight)  ; liquidMask cut at seaLevel
5. AEOLIAN dunes     — anisotropic relief modulation
   AEOLIAN dust mantle — relief-SMOOTHING  ← MUST run AFTER the relief combiner (attenuates trailing octaves)
6. surface albedo/material  (relief + cryo frost tint + liquid material)
7. EXOTIC overlay    — base-type + overlay-layer composite  ← consumes the FULL natural-base lit color +
                       landMask + diffuse; renders LAST among surface terms, before the envelope split
8. CLOUDS & HAZE     — cloud-as-relief deck + shell + haze muting (muting runs BEFORE final posterize)
   AEOLIAN F40 storm veil — surface-veiling term; lofts ABOVE weather → wins the upper veil slot when both active
9. OPTICAL           — limb/terminator scattering (additive-tint ONLY — must not double-darken with cloud ring)
   ── posterize(surface, posterizeLevels) ──        (Stage-A envelope split)
   ★ thermal emission (Bands F32/F33), magma glow (Exotic F41), city lights (Exotic F48/49),
     bioluminescence (Exotic F46), aurora (Optical F37), sunglint (Optical F36)  — all bypass the quantizer
```

**Order-driven seams the agents flagged, resolved by the above:**
- Dust mantle smooths relief → step 5 after step 2. ✔
- Exotic overlay reads natural-base output → step 7 after steps 2–6. ✔ Dropping `maturity→0` must reveal the bare base (the overlay-correctness test).
- F40 storm veil vs clouds → step 8, storm wins upper slot. ✔
- Cloud F31f ring vs optical F35 twilight band co-locate at `s≈0` → cloud ring (step 8) UNDER optical tint (step 9); optical stays additive-tint-only. ✔
- Magma terminator (Exotic F41) vs optical F35 reddening → **gate F35 off where `magmaFraction` is high** (avoid double-reddening). ✔
- Gas-giant final albedo: **who writes it, Bands base or Clouds species-tint?** → unresolved integration decision (Max Q4 below); provisional: Bands writes banded base, Clouds multiplies a species tint in.

---

## 4. Max-facing decisions (taste/scope — aggregated, none invented)

1. **Envelope settled per body-type** — the Stage-A TRACKED-OPEN goal (spec §4). Downstream playtesting via the lab sliders; stays open.
2. **Venus UV Y-markings** (F31d `[subtle]`) — keep / stylize / drop. *Clouds rec: stylize-as-albedo-step (3-cycle cap).*
3. **Sub-neptune featureless-ness** (F31c) — scientifically-flat vs reads-as-a-planet. *Clouds flags as a taste call.*
4. **Gas-giant final albedo ownership** — Bands banded-base vs Clouds species-tint (the §3 step-8 seam).
5. **Sunglint build timing** (F36) — build now behind a Fluvial `liquidMask` stub, or wait for Fluvial to land? *Optical asks.*
6. **`magneticField` surfacing ownership** — is the D13 generation-side refactor Optical's job (sole visual consumer) or a separate generation workstream? It touches `PhysicsEngine.js` + `PlanetGenerator.js` + the stripping path.
7. **Exotic/overlay taste latitude** — F41–F49 are speculative game-constructs; the most taste-laden domain. Expect heavier lab iteration.
8. **Province-weight hook — ✅ RESERVED 2026-06-07** (Max chose: reserve before the fan-out). `uProvinceWeight` is declared as a no-op multiplier (default **1.0**) in the central `uniforms` object + a GLSL uniform decl + a registry row (RESERVED). The Stage-D province system multiplies each combiner's contribution by a shared per-region weight field; because it's a **global uniform read internally**, no combiner *signature* changes when Stage-D wires the spatial field. **Convention the fan-out adopts:** see §8 "What does NOT wait." (Original framing kept for history: cheapest insurance point is BEFORE the 8-domain fan-out, since each domain adds combiners. Done now.)

---

## 5. Aggregated 3-cycle-cap risks (harness-first spikes for Stage C)

Ranked by how many domains they block. Per MEMORY rule: isolated `*-lab.html` harness first; 3 failed
research→implement→test cycles → switch technique.

1. **Sphere Voronoi seam / pole-pinch** (Q3) — blocks Relief craters, Cryo pits/polygons, Exotic hex/crystal/shatter. **ONE 27-cell 3D Voronoi spike resolves all three.** Fallback ladder: desktop-only 27-cell → drop mobile cellular → albedo-only facets. *This is the highest-priority spike — gate it before any cellular feature.*
   **✅ CLEARED 2026-06-06 (cycle 1, commit `262f63a`).** `voronoi3d()` built once (CPU oracle + GLSL + 8 TDD tests), live-verified seam-free at pole/meridians with correct analytic normals. 9-cell mobile center-slab is lossy/anisotropic → fallback ladder confirms "drop mobile cellular" (see `research/stage-c/STATUS-stage-c-2026-06-06.md` §Max-decision A). Cellular features now unblocked.
2. **Sphere flow-frame / pole-pinch for advection** (Q2 — the spec's named "single biggest technical risk"). **Narrowed by Bands' finding:** band drift is latitude-organized → pure azimuthal rotation has NO pole singularity, so banding likely sidesteps it entirely. The risk survives only for **curl-advected weather** (lava/ocean/gas churn) — and Q4 makes weather non-deterministic, so it can be deferred or faked. Re-scope: not as scary as Stage-A feared for the structural layer.
3. **Lague raymarch banding under posterize** (Optical) — two quantizers fight. Fallback: blue-noise/IGN ray-start jitter (reuse lab `ign()`) + optical-depth LUT → drop to fresnel.
4. **Dendritic rivers reaching the sea on a sphere** (Fluvial) — in-shader inverted-ridged (Strategy A) may read as "noise scratches." Fallback: CPU-baked distance-field (Strategy B, Red Blob Games).
5. **Overlay coverage reads as "pasted-on decals"** (Exotic) — fallback: feathered/clustered mask biased by base relief; accept stylized if it caps.
6. **Anisotropic dunes don't read as dunes under posterize** (Aeolian) — fallback: deliberately stylized two-tone transverse ridge (may look better given no-parity).
7. **Cloud-shell parallax z-fighting / limb mismatch** (Clouds) — pre-committed fallback: limb-only fresnel fake; build it FIRST, don't death-spiral.
8. **Gerstner per-fragment tangent frame near poles** (Fluvial) — fallback: 3D curl-noise ripple.
9. **Reaction-diffusion fungal mats in a single pass / no FBO** (Exotic) — fallback: thresholded domain-warped FBM fake-Turing (IQ).

---

## 6. Source-integrity flags (re-verify before Stage C copies constants)

Several load-bearing technique sources were **blocked** (Shadertoy/Anubis return 403/walls to headless fetch).
Cited from search snippets only — confirm in a browser before lifting exact constants:
- **Sebastian Lague atmosphere** Shadertoy `ssXSWs` (Optical) — 403; title/author from search.
- *Procedural Riverscapes* PDF, hal.science (Fluvial) — Anubis wall; Red Blob Games is the actually-fetched fallback.
- Shadertoy "Desert Sand" (Aeolian) — 403, marked UNVERIFIED.
- Shadertoy "Multiscale Turing Patterns" `MdGGzR` (Exotic) — 403; IQ domain-warp is the verified primary.

---

## 7. Recommended Stage-C sequence

Driven by the dependency graph above, not by domain glamour:

1. **Foundation shared libs first** — `voronoi3d()` + `voronoiCellCount`/`qualityTier` knob (risk #1 spike), the
   `emissiveBlackbody()` helper, the §1 canonical uniform registry, and the §3 pipeline-order skeleton in the lab.
2. **Generation-side surfacings** (§2) — small, unblock everything: `surfaceGravity`, planet-`tidalHeat`,
   `volatileSpecies`, `liquidStability`/`liquidSpecies`, `precipitation`, pressure plumbing, `magneticField`
   (pending Max Q6).
3. **Relief** — the widest gap (dead-`lodLevel`), and it lands the shared Voronoi + canyon accumulator others build on.
4. **Then fan domains in parallel** (worktree-isolated per spec §6) once the shared libs + registry are locked:
   Cryo / Fluvial / Aeolian (surface), Bands / Clouds / Optical (atmosphere), Exotic (overlay, consumes all).
   Each still wants the live chrome-devtools `:9223` visual loop.

Each domain implements **directly from its per-domain doc**; this index is the contract that keeps the 8 from
colliding.

---

## 8. Stage-D — geologic provinces / terranes (PLANNED, not scoped) — Max greenlit 2026-06-07

**The problem (Max's observation, 2026-06-07).** Every relief/domain feature is **evenly distributed
across the whole sphere**, gated only by a global strength scalar; the only spatial variation is each
feature's own noise/Voronoi placement. There is **no shared large-scale partition**, so the surface reads
as "every feature smeared everywhere" — slop laid over slop — instead of the **distinct areas** real bodies
show (Moon maria-vs-highlands, Mars hemispheric dichotomy + Tharsis). This is an **architecture limitation,
not a tuning problem** — no amount of per-feature parameter work fixes it, because the missing thing is a
layer ABOVE the features.

**Mechanism — soft province-weight field (splat-mapping generalized to a sphere).** A low-frequency
partition of the sphere (large-scale Voronoi cells, or overlapping low-freq FBM thresholds) yields a
per-feature **weight field**; each combiner multiplies its strength by that region's weight. Provinces are
feature-*poor* (each shows a subset), not feature-complete.

**Load-bearing constraint — provinces must be SOFT weight fields, NOT hard type-switches.** Stage-A's
governing principle is "no `planetType` branch — one continuous shader, blend not branch." Hard province
boundaries would reintroduce the spatial discreteness that frame forbids. Resolve provinces as continuous
weight fields (smooth blends between regions) so the continuous-blend ethos holds. **This is a deliberate
frame decision, not an accidental violation** — it must be made consciously when scoped.

**Timing & sequencing.**
- The per-feature work (F1–F10 + the 8 domains) builds the **vocabulary** (each combiner = a word); the
  province system is the **grammar** (which features cluster where). You can't write the grammar until the
  words exist → provinces are a **Stage D, after the 8 domains land**, and a PM-scope (`dev-collab-scope`)
  job because they touch every combiner.
- **What does NOT wait: the contract hook** (§4 decision #8) — ✅ **RESERVED 2026-06-07.** `uProvinceWeight`
  is declared as a no-op multiplier (default uniform 1.0) in the central `uniforms` object + a GLSL uniform
  decl + a RESERVED registry row — same cheap-insurance pattern as the RESERVED `cryoActivity`. Reserved
  BEFORE the 8-domain fan-out so no combiner signature changes when provinces land (bolted on at the end →
  every combiner gets re-touched).
  - **CONVENTION every fan-out combiner adopts (author province-aware from day 1):** where a combiner today
    adds its contribution as `h += delta; grad += dgrad;`, write it as `h += delta * provinceWeight(FEATURE_ID);
    grad += dgrad * provinceWeight(FEATURE_ID);`. `provinceWeight(int feature)` is a GLSL accessor that
    **Stage-D will define** — until then the convention is satisfied by multiplying by the no-op `uProvinceWeight`
    (1.0), or simply by NOT regressing the readiness (the uniform name is reserved so nothing collides). The
    `FEATURE_ID` arg exists because provinces are feature-*poor* (each region shows a subset), so weight is
    per-feature, not one global scalar. Stage-D swaps the accessor body for the spatial field — combiner bodies
    don't change.
  - **NOT done now (rides with the Stage-D `dev-collab-scope` job):** the spatial weight field itself, the
    `provinceWeight()` accessor definition, and retrofitting the F1–F10 relief combiners' multiplies (those
    exist + are tested; mechanical retrofit + re-verify belongs to the scoped Stage-D unit). Only the NAME +
    CONVENTION are locked now.
- **Cheap falsifiable spike (~30 min, doesn't wait):** in the lab, multiply 2–3 existing combiners'
  strengths by a single shared low-freq mask and A/B it vs the current uniform soup. Validates the
  direction before committing to the full system. This is the right first move if Max wants to de-risk
  early; the full system is still Stage-D.

**Status: PLANNED — in the plan, not scoped, not started.** Do not build inline during F9/F10 or the domain
fan-out. Full scope is a Stage-D `dev-collab-scope` job.
