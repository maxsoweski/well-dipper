# ⭐ Lab pipeline → game — THE PLAN OF RECORD

**Systems touched:** worldengine, planet-lod-lab, rendering, generation

> **This file is the plan. It is the ONE durable artifact for this program and it is updated IN
> PLACE, never stacked.** Per-session handoff briefings under `~/briefings/` are disposable, and on
> this project they have twice been *wrong* about what had already shipped. When a briefing and this
> file disagree, **this file wins; when this file and `git log` disagree, the log wins.**
>
> Strategic frame: [`planet-lod-CHARTER.md`](planet-lod-CHARTER.md). Deferred-work register and the
> full measurement tables: [`surface-variation-beyond-mvp.md`](surface-variation-beyond-mvp.md).
> The graft-vs-replace analysis this supersedes: [`lab-vs-game-renderer-divergence.md`](lab-vs-game-renderer-divergence.md) §4.1.

> **RESTRUCTURED 2026-08-01.** The six-step model this file used to carry has been replaced by a
> six-LAYER model, after a multi-agent code review found 16 defects in the previous 15 commits and a
> recon found that the plan's own line numbers were 1293 lines stale. The reason for the change is in
> §"Why layers, not steps". The old step numbering is preserved in §"Step-model history" so old
> commit messages remain readable.

## The standing constraints (Max, verbatim — these decide every design question below)

1. **"We change the rendering capabilities of the main game however we need to such that the
   features of the world engine can render in the main game."** (2026-08-01)
   → The game bends. No "which features ship" negotiation, no parity budget. If the lab's shader
   wants a vertex attribute the game's mesh lacks, the mesh grows it.

2. **"We will likely do additional development in the world engine lab, and so we need to easily be
   able to move the latest developments from that lab into the main game in the future."**
   (2026-08-01)
   → **The load-bearing one.** It rules out copying the lab's shader into the game, because a copy
   is a snapshot and the lab keeps moving. The seam must be **shared modules that the lab itself
   imports**, so "porting" a future lab change is not an action anyone has to take.

3. **REPLACE, not graft.** *"the goal here is to have the lab's rendering pipeline in the game — the
   procgen and the rendering itself."* (2026-07-31) Grafting condition-derived values onto the
   GAME's own shader is drift. Three such slices shipped as acknowledged cheap wins; see
   §"The graft cost, now measured" for why that path is closed.

4. **Finish line: FULL GALAXY PARITY, MOONS INCLUDED.** (Max, 2026-08-01, chosen against three
   narrower options.) Moons are where the crater work was always aimed — 96.8% of generated moons
   are airless with full exposure age against 0.8% of planets, and 267 of 277 moons within 25 pc
   derive a crater record while **zero** render one.

5. **Verification is FENCE-FIRST, review at seams.** (Max, 2026-08-01.) See §"Verification cadence".

6. **"Being token efficient, drive towards the MVP outcome."** If it can be decided from the above,
   decide it — do not ask.

## Why layers, not steps

The old six-step model was a *work order*. It implied you could do step 3 before step 4. What we
actually have is a **stack**: layer 3 is not merely later than layer 2, it is **meaningless** until
layer 2 is sound. That distinction is not academic — it is the direct cause of this program's three
wrong measurements:

| the claim | why it was wrong |
|---|---|
| "the lab shader renders black" (`d8faaef`) | measured through `makeUniforms()` called bare → `uLightDir = [null,null,null]` → NaN |
| "the limb changes no pixels" (`f8a0b1e`) | measured against an animating scene; 48% motion floor vs a 50% signal |
| "the undriven floor is not black" (`fc06017`) | measured through a collapsed noise domain (see LAYER 2) and a world-space light |

Every one was read as a *rendering* question. Two were world-generation problems and one was an
environment problem. **The program is not blocked on rendering capability. It is blocked on
observability.**

## The six layers

| # | layer | owns | verified by |
|---|---|---|---|
| 0 | **Condition contract** | what a body's physical description *is*, and honest reporting of what is missing | headless, no renderer |
| 1 | **World-gen physics** | producing bodies whose conditions actually *differ* | headless, calibrated to real bodies |
| 2 | **Renderer conformance** | the game environment satisfying what the lab's shader assumes | browser, fixed inputs |
| 3 | **The driver** | condition → uniforms, through shared modules | headless fence + live probe |
| 4 | **The bakes** | per-planet CPU work producing the fields the shader samples | perf budget |
| 5 | **Body-class coverage** | rocky, giants, moons | per-class fence |

**Layers 0/1 and layer 2 are independent.** 0/1 is pure data and needs no renderer; 2 is pure
rendering and needs no real condition data. They run as parallel tracks and neither blocks the other.
Layer 3 is where they meet and is only meaningful once both are done.

### Done criteria — each is a command, not a judgement

- **0** — no field is fabricated without the vector saying so; a fence asserts every generator
  populates the fields its bodies' renderers consume.
- **1** — the population spans real physical range (airless present, thin present), calibrated
  against Earth / Venus / Mars / Titan / Mercury / Moon.
- **2** — the lab's shader on a game mesh produces the same image the lab produces for the same
  condition.
- **3** — resolved uniform set byte-identical to the lab's for the same condition, **max delta
  exactly 0** (the `albedoTransfer` / `heightNoise` precedent).
- **4** — measured cost per body inside an explicit budget.
- **5** — each body class renders through the same pipeline, with a per-class fence.

---

## LAYER 0 — the condition contract — `TODO` ⭐ NEW, AND IT IS UNDERNEATH EVERYTHING

Discovered 2026-08-01. It did not exist as a concept before the moon measurement.

`src/worldengine/port/conditionFromPlanet.js` answers every question whether or not it has the data:
`massEarth ?? 1.0`, `age ?? 4.5`, `surfaceHistory || {erosion:0, bombardmentIntensity:0,
resurfacingRate:0}`, `T_eq ?? 288`, `ironFraction ?? 0.32`. Nothing throws. So nothing upstream can
distinguish a measured world from a fabricated one.

**MEASURED, 540 generated moons:**

    airless (no atmosphere object)   540   100.0%
    carry a surfaceHistory             0     0.0%
    carry an age                       0     0.0%
    conditionFromPlanet failures       0

Zero failures is the finding, not the reassurance. For a moon of radius 0.0157 R⊕ the vector returns
**`surfaceGravity: 4042.6`** — that is `1.0 / 0.0157²`, matching to every digit, because
`massEarth` defaulted to one Earth mass. **Every moon in the game reports a 4000 g body.**
`reliefEnvelope(radiusEarth, surfaceGravity)` and every other gravity-dependent law is therefore
wrong by ~4000× on the entire moon population.

⛔ **This is the mechanism behind every "confidently wrong" result this lane has produced.**

**The fix is NOT to remove the defaults** — a body genuinely missing mass still has to render. It is
to make the vector **carry its own provenance**: which fields were measured, which were defaulted.
Consumers that care (the driver, every fence, every measurement script) can then refuse or flag;
consumers that do not can carry on. That turns the failure mode from silent into loud.

**Work:**
- `conditionFromPlanet` returns provenance alongside the vector (proposed: a `_fabricated: Set<string>`
  or a parallel `provenance` object — shape is an implementation call, not a design one).
- ⭐ **Export the fp.** `deriveUniforms(drivers)` reads six fields the condition vector does NOT
  carry: `massEarth` (lab-core:610), `surfaceHistory.*` (:598, :702, :703), `habitability` (:744),
  `seed` (:756), `starMassEarth`/`orbitRadiusEarth` (:621, :622). `conditionFromPlanet` builds an
  fp-shaped object at :119-137 carrying most of them **and then does not return it** (:138 returns
  `deriveConditionVector(fp, …)`). So `deriveUniforms(conditionFromPlanet(p))` silently yields
  erosion 0, bombardment 0.5, massEarth 1.0, habitability 0 and a fake 1 M☉ / 1 AU orbit.
  Export `fpFromPlanet(planetData)` and have `conditionFromPlanet` call it. **Two lines, and it is a
  prerequisite for any crater / relief / glint work.**
- Fill the moon contract: `massEarth` (derivable from radius × density), `age`, `surfaceHistory`.
- ⚠ **Second-order hazard, pointing the other way:** the all-zeros `surfaceHistory` default passes
  every leg of the crystal-facet gate. If anyone loosens the airless gate before this is fixed,
  **every history-less body silently becomes a crystal world.**

**Contract gaps that are cheap widenings, not research** (each de-degenerates real features):

| missing field | consequence today | cheapest probe |
|---|---|---|
| `seed` | all 7 strike/axis uniforms are global constants — **every planet rifts along identical great circles** | already known; add to fp |
| `starMassEarth` / `orbitRadiusEarth` | `tidalHeat` computed against a fake 1 M☉ / 1 AU orbit for every body | `grep -rn "orbitRadius\|semiMajor\|starMass" src/generation/PhysicsEngine.js` |
| `habitability` | zeroes `orogenyStrength`; degrades chasma/plateau/tessera/volcanism; `shieldStratoMix ≡ 0` so every world gets pure shield volcanoes | `grep -n "habitability" src/generation/PhysicsEngine.js` |
| `axialTilt` | `frostLatitudeBias ≡ 0` — polar-symmetric caps only, never Mars-style low-latitude frost | `grep -n "axialTilt\|obliquity" src/generation/PhysicsEngine.js` |

---

## LAYER 1 — world-gen physics — `TODO` — diagnosed, not fixed

Full diagnosis and the before-table are committed in **`5daf289`**, and the instrument is
`tools/port-atmosphere-measure.mjs`. Do not re-derive. Summary:

**Measured, 454 generated bodies:** 0 airless, 0 below 0.10 bar, minimum pressure 0.111 bar,
thin-remnant branch hit 0 times.

Three stacked defects in `PhysicsEngine.computeAtmosphere`:

1. **The thin-remnant branch is unreachable.** λ is linear in molecular mass and
   M_CO₂ > M_N₂ > M_H₂O against the same threshold, so `retainsH2O ⟹ retainsN2 ⟹ retainsCO2` for
   every body in the universe. `if (retainsCO2)` at `:229` is unconditionally true, so `:240-247` —
   the only path to a sub-0.1 bar atmosphere, i.e. the only path to a Mars — is dead code.
2. **The retention threshold is off by 6×, in the wrong place.** λ is exactly `(v_esc/v_th)²`. The
   textbook rule is `v_esc ≳ 6·v_th`, i.e. **λ ≳ 36**. The code tests λ > 6 — the 6 applied to λ
   instead of to the velocity ratio. Calibration:

       body      λ(CO₂)   shipped (>6)   reality
       Earth      371.0   retains        1.0 bar        ✓
       Venus      350.2   retains        92 bar         ✓
       Mars        90.6   retains        0.006 bar      retains, but THIN
       Titan       56.1   retains        1.5 bar        ✓
       Mercury     30.9   RETAINS        ~1e-14 bar     ✗ airless
       Moon        15.8   RETAINS        ~3e-15 bar     ✗ airless

   ⭐ The threshold is bracketed tighter than it looks: it must clear **Mercury at 30.9** while
   leaving **Titan's λ(N₂) ≈ 35.7** retained. That is a **31–35 window**, and it lands on the
   textbook value.
3. **Pressure has no physical model.** Each branch is a constant plus a mass term (floors 0.3 / 0.5 /
   0.1 bar). Mars retains CO₂ under *both* thresholds, so the threshold alone cannot make a thin
   atmosphere; Mars lands at 0.15 bar against a real 0.006 — **25× too thick**. Mars is thin because
   of outgassing budget and non-thermal loss after its dynamo died, neither of which is modelled.

⭐ **BLAST RADIUS, checked:** `computeAtmosphere` is pure and **no rng draw is conditional on its
result**, so fixing it cannot shift the generator's shared stream. The standing "one extra draw
rewrites the generated universe" rule does not bite. Orbits, masses and radii stay byte-identical;
only atmospheres and what derives from them move.

### What layer 1 unblocks — the degenerate register

Every one of these is a **correct model on a wrong population**. Driving them today looks like a
wiring bug and is not. Do not chase them as rendering defects.

- **`airlessnessOf ≡ 0` on every body** (`P_AIR_REF = 0.1 bar`, population min 0.310). The
  space-weathering stage of `surfaceAlbedoOf` is identically 0 across the entire population — no
  world will ever show lunar darkening.
- **`uFacetStrength ≡ 0`** — gated on `!cond.atmosphere`, and `conditionFromPlanet:102` only nulls
  the atmosphere when `retained === false`, which never happens. Crystal worlds never render.
- **`uRayBrightness ≡ 0`** — `(hasAtmo ? 0 : 1)`, and `hasAtmo` is true on 100% of bodies. Crater
  ray systems never render. Re-gate on *pressure* if you want them back.
- **`uTermStrength` constant** — its only condition input is `atmosphere.retained`, which carries
  zero information. (Now `0.15` after `fd2fdd4`; was `1.0`.)
- **`uLimbStrength ∈ {0.7, 0.91}` only** — the airless-silhouette branch is dead.
- **`uAirglowIntensity` never reaches 0** — at 0.310 bar the expression gives 0.298, so every planet
  has a night-limb glow with no off state.
- **`erosionOf` never returns 0** (`P_ER_REF = 0.5 bar`) — the sharp un-eroded crust branch is
  unreachable.
- **`state.habGate ≡ 0` → `uBioCoverage ≡ 0`** — no bioluminescent mats on any world (independent of
  `uBioGroundCover`, which is genuinely condition-derived and works).

---

## LAYER 2 — renderer conformance — `TODO` ⛔ BLOCKS ALL MEASUREMENT

Found by the 2026-08-01 review. **Every measurement taken through `tryLabShader` before these land
is in the same epistemic class as a Sol measurement — confidently wrong.**

All four fixes belong in the **SHARED module**, not patched game-side: in the lab the divides reduce
to 1.0 and the logdepth chunks compile to nothing without the define, so the lab stays unchanged and
constraint 2 is preserved. **Patching them game-side would create exactly the snapshot copy the
program exists to avoid.**

1. ⭐ **OBJECT-SPACE RADIUS COLLAPSE — the big one.** `planet-lod-lab.html:202` is `const R = 1.0`
   and `planet-lod-shaders.glsl.js:41` is `vPos = position;` with no normalisation, feeding
   absolute-scale domains (`voronoi3d(vPos * uVoroScale)`, `fbmd(vPos, …)`, ~30 `*Combiner(vPos, …)`
   calls). The game builds `IcosahedronGeometry(radiusEarth × 0.0426)`. An Earth-sized body spans
   ±0.0426 where the lab spans ±1.0 — **the whole disc samples 1/23rd of one voronoi cell.** 23× on
   a big planet, 78× on a small one, a 53× spread *within one system* from identical uniforms.
   ⭐ **This is a fully sufficient alternative explanation for the "flat orange"** that `fc06017`
   read as the undriven floor.
   **Fix:** normalise the game's object space (`IcosahedronGeometry(1, 5)` + `scale.setScalar(radius)`),
   or interim `vPos = position / uBodyRadius` with `uBodyRadius = 1.0` in the lab.
   ⛔ **A per-body `uDispDomainScale` is NOT sufficient** — `planet-lod-height.glsl.js:970/:2393/:2427`
   explicitly exclude it from `fbmdRidged`/`fbmdHetero`/`fbmdDamped`, and it never touches
   `uVoroScale`/`uCraterScale`/`uMountainScale`/`uEdificeScale`.
2. **Light in the wrong space, and frozen.** `main.js` feeds the game's **world-space** `lightDir`
   into a uniform documented as *"object-space substellar direction"*. The surface spins and the
   parent carries axial tilt, so the terminator counter-rotates with the crust — one sweep per
   planet day. The lab does the transform the game omits (`planet-lod-lab.html:4897`:
   `invQuat.copy(planet.quaternion).invert()`). Separately `LabPlanetMaterial.js:68` copies the
   vector by value, breaking the by-reference link the game material relies on, so it is also stale.
3. **No per-frame seam at all.** `uTime` is never advanced (the game's only planet clock writer
   guards on a differently-named uniform), so cloud drift, superrotation, magma churn and aurora
   curtains evaluate at t=0 forever. `uOctaves`/`uLodRamp` likewise. **Fix as ONE seam** —
   `updateLabPlanetMaterial(material, {mesh, lightDirWorld, renderDt, octaves, lodRamp})` — not four
   patches. ⚠ This whole per-frame half of `applyDrivers` appears in **none** of the old six steps.
4. **No log-depth chunks.** `RetroRenderer` runs `logarithmicDepthBuffer: true` with `near = 1e-9`;
   `grep -c logdepthbuf planet-lod-shaders.glsl.js` → **0**. Every fragment writes `z ≈ 1.0`, so the
   disc draws (LessEqualDepth passes) while sorting against rings, moons and the ship by traversal
   order. **In-repo precedent: `tests/warp-portal-logdepth.test.js` exists because this project
   already shipped this exact bug once.**
5. **The view vector is scene-origin.** `planet-lod-shaders.glsl.js:446` assumes the planet sits at
   the origin with identity quaternion. In the game `|vPos| ≤ 0.68` while `cameraPosition` runs to
   the 100-unit rebase threshold, so `V` collapses to a constant direction. The rim glow slides
   across the disc as you orbit. The game's own shader does this correctly (`Planet.js` `vWorldPos`
   + `vViewDir`), so it is a real divergence, not a shared convention.

---

## LAYER 3 — the driver — `IN PROGRESS`

⭐ **THE PLAN'S OLD LINE NUMBERS WERE 1293 LINES STALE** (they predated Step 2's own −1299-line
extraction). Corrected and verified 2026-08-01:

    planet-lod-lab.html            6411 lines   (NOT 7554)
    applyDrivers()                 1933-2734
    ensureNetworkRouted()          2745-2880

⭐⭐ **THE BIG VISUAL UNIFORMS ARE NOT IN `applyDrivers`.** They are in `ensureNetworkRouted`, and
that code is already written in the exact idiom the game needs — every derive reads
`_bodyDrivers.condition`, which is the same object shape `conditionFromPlanet` returns. **Zero
adapter, zero bake.**

### Slice 1 worklist — the next 10 uniforms, ranked by visual payoff per unit of work

Let `cond = conditionFromPlanet(p)`. Full catalogue: 77 uniform writes, recon 2026-08-01.

1. ⭐ **`uBaseColor` + `uFreshColor` + `uSedColor` + `uCratonColor` + `uBioGroundColor`** — THE
   flat-orange fix, **one module call for five uniforms, no shader change**. All four factory-default
   to the *identical* `THREE.Color(0.46, 0.40, 0.34)`, and `uTerrainAlbedoMix` already defaults 1.0,
   so the palette path is live and simply has four copies of one brown to blend.
   `applyAlbedoTransfer(surfacePaletteOf(cond), {extra:{pigment:BIO_PIGMENT}})`.
   ⚠ **`applyAlbedoTransfer` is REQUIRED** — raw `surfacePaletteOf` emits true physical albedos
   (Earthlike land 0.165) and renders Earthlike worlds nearly black. ONE scale solved from
   `weathered` and applied to every endmember; per-endmember scaling is a documented regression.
2. **`uIcenessMix`** — `icenessOf(cond)` (`surfaceMaterial.js:52`). Icy worlds go white. Default 0.
3. **`uPerturb`** — `0.55 × reliefEnvelope(cond.radiusEarth, cond.surfaceGravity)` (`lab-core:1167`).
   Master relief amplitude. The `0.55` is a hand knob; only the envelope is physical. ⚠ Applying the
   envelope twice squares it.
4. **`uCraterDensity` + `uCraterScale` + `uCraterAmp` + `uCraterComplexD` + `uCraterRelaxation`** —
   `craterSchedule(cond)` + `craterRelevanceOf(cond)`, analytic, **no bake**. Port the route-time
   block at `:2803-2856`, **not** the `applyDrivers` lines — see ordering hazard A.
5. **`uSeaLevel` + `uLiquidMask`** — ocean or no ocean, the biggest silhouette change after the
   palette. Prefer `bodyLiquidStability(cond)` (`baseStep.js:51-66`) over the fp path. Default
   `uSeaLevel = -1.0` means **every game planet is currently bone dry**.
6. **`uBioGroundCover`** — `biosphereOf(cond)`. ✅ *Shipped `9a17098`, including the display transfer
   and the rename off the lab's `uBioColor` collision.*
7. **Frost caps** — `uFrostMaxCoverage`, `uFrostCondensationT`, `uFrostAlbedo`, `uFrostLocked`,
   `uPlanetTempEq` from `deriveUniforms(fp)`. ⚠ needs the fp export (layer 0) and `axialTilt`.
8. **`uLimbColor` + `uTermColor` + `uLimbExponent`** — ✅ *limb shipped `f8a0b1e`, terminator
   `fd2fdd4`.* ⭐ Still open: the lab **overrides the module it imports** at `:2452`, branching
   `_thickHaze ? 1.8 : 3.5` and discarding the module's continuous `limbExponent`. The game takes
   the module's value; reconciling the lab changes the lab's look and must be byte-gated.
9. **`uLiquidSpecies` + `uGlintExp` + `uGlintTint` + `uSpecStrength`** — water-blue vs Titan-amber
   seas. Only pays off after (5). ⚠ three ordered writes to `uSpecStrength`.
10. **`uEmissive`** — `clamp01((T_eq-400)/600) × 0.25`, **plus three zeroing gates** (hot-Jupiter,
    magma, carbon). Porting fewer than four writes glows the wrong bodies.

⛔ **Do NOT wire `uLiquidStability`** — the uniform exists in the factory but **no shader reads it**
(0 consumers across every `.glsl.js`).

### Ordering hazards — a naive extraction that reorders these produces plausible-but-wrong output

- **A. ⭐ The crater uniforms are written TWICE.** `applyDrivers:2024-2027` sets them from
  `deriveUniforms` (the *retired* preset-age law); `ensureNetworkRouted:2828-2856` **overwrites**
  them from `craterSchedule(cond)`. The route-time values ship. They disagree **by design**: the
  route block forces `craterComplexD = 2×0.55/0.6 = 1.8333` specifically so `morphology ≡ 0` for the
  analytic sub-floor band. Port the `applyDrivers` line and every synthetic crater grows a spurious
  central peak.
- **B. `uEmissive` — four writes over 705 lines** (:2001 base, then zeroed at :2432 `_hotJup`,
  :2687 `_magmaClass`, :2706 `_carbonClass`).
- **C. `uSpecStrength` — three writes, order-critical.** Zeroing must precede the scale; lifting
  either gate alone yields `undefined`.
- **D. `_atmoOptics` is one local consumed by two writes 30 lines apart** (:2456, :2485).
- **E. `uAuroraIntensity` — derive then clobber.** :2587 derives, :2611 unconditionally zeroes it for
  `_cloudRegime === 3` (Venus).
- **F. ⭐ Half of every uniform's value lives in the per-frame writer** (`:4940-5430`), not in
  `applyDrivers` — it applies `state.<feature>Enabled`, `state.featureRelevant.<key>`,
  `state.craterRelevance` and the `sVis` visual-scale factor on the way. **Extracting one half gives
  derivation without gating, or gating without source.**
- **G. `applyDrivers` is re-entrant from the GUI** — `outflowSizeKm`, `karstDolineSizeKm`,
  `duneSizeKm`, `bandLatPow` and three storm-reseed buttons call it from `onChange`. Those fields are
  **inputs**, not outputs; any extraction must take them as parameters.
- **H. Drop entirely:** the 🎲 handlers (they clobber seeded axes with `Math.random()`),
  `drawPresetConditions` (the lab's stand-in for `conditionFromPlanet`), `drawPresetRadius`,
  `relevantFeatureSet()`, and the tail plumbing `resetDriverOverrides`/`syncDisplays`.

### The knob list — the game must hardcode these, and a naive extraction will call them condition-derived

⚠ These are emitted **by `deriveUniforms` as bare literals**, so they arrive in the same `u.*` bundle
as the real derives: **`uTerraceCount` 4, `uChaosMatrixRough` 0.5, `uDoubleRidgeFreq` 3.0,
`uCryoRidgeOffset` 0.45, `uCryoRidgeWidth` 0.18, `uGroovedBandFreq` 14.0.** Plus `state.perturb`
0.55, `uVoroCells` 27 (a device-perf tier, not physics), `uRiverCarvePatchStrength` 0.0,
`glintRoughness` 0.15, `uTerrainAlbedoMix` 1.0, `uProvinceWeight` 1.0, `limbStrength ×1.3`,
`nightTempK` 1100 K, `MG_LIQUIDUS` 1300 K, and the authored relief heights (crater depth 2.0 km,
mountain 9.0, edifice 22.0, canyon 6.0).

`TERM_STRENGTH` 0.15 and the `termWidthFor` log-pressure ramp are **no longer provisional** — both
were ported from the lab and fenced at max delta 0 in `fd2fdd4`.

---

## LAYER 4 — the bakes — `TODO` ⚠ **THE ONE UNPRICED RISK — MEASURE THIS FIRST**

⭐ **THE BAKE WALL RUNS THROUGH THE MIDDLE OF ONE FUNCTION**, which is why it is easy to miss:

    ensureNetworkRouted()  :2758-2857   FREE   pure CPU condition scalars (iceness, biosphere,
                                               surfacePalette, the whole craterSchedule block)
                           :2858+       WALL   riverOverlay.route() — router graph + RGB carve cube

Four bakes, in payoff order: (1) river router + carve cube → rivers, coastlines, deltas,
strandlines; (2) the WS4 tectonic-grain cube → `sampleGrainStrike`, the only non-constant source for
**every** strike uniform; (3) the province partition behind `uProvinceWeight`; (4) the four vertex
attributes `aBand`/`aShear`/`aMush`/`aStorm` (gas giants only, correctly zero-filled today by
`LabPlanetMaterial.js:43`).

⭐ **Correction worth keeping:** the axis family is **seed-dependent, not bake-dependent**.
`deriveUniforms` computes it from `d.seed`, nothing supplies one, so `seed === 0` and every planet
rifts along identical great circles. **Adding `seed` to the fp de-constants seven uniforms with no
bake at all**, and should precede any grain-cube work.

**Approach A pulls this forward:** price ONE bake (`performance.now()` around `riverOverlay.route()`
for a few radii) before layers 0–2 work begins. If a carve costs 500 ms on a game-sized body,
streaming has to be *designed in*, not retrofitted. It is a day, and it is the only unknown that can
invalidate the architecture.

---

## LAYER 5 — body-class coverage — `TODO`

`src/objects/Moon.js` is a **third renderer with none of the port** — no palette, no relief, no
craters, still the March-2026 `snoise` shader.

⚠ **Moons are not the easy first slice they look like.** They have the *varied population*
(100% airless) but a *fabricated contract* (0% carry age or surface history, and every one reports
4000 g). Rocky planets are the inverse: real contract, degenerate population. **Layer 0 must land
before moons are worth touching.**

---

## Verification cadence — FENCE-FIRST, REVIEW AT SEAMS (Max, 2026-08-01)

Chosen because of the 7 must-fix defects the 2026-08-01 review found, **a fence would have caught
the two worst** — cheaply, permanently, and at write time.

**PER LAW (near-free, runs forever).** Write the fence *before* the port lands. Three assertions:
1. **Byte-identity** — extract BOTH the lab's expression and the game's *from source* and compare
   numerically over a sweep. **Max delta exactly 0.** (`tests/port-terminator-law.test.js` is the
   worked example: it pulls `state.termWidth` out of `planet-lod-lab.html` and `termWidthFor` out of
   `Planet.js` and evaluates them against each other.)
2. ⭐ **Distinctness** — is the value constant across the population? *This program's characteristic
   failure mode is a correctly-wired law that is degenerate.* `uTermStrength` measured `[1,1]` on
   36 bodies and was reported as shipped.
3. **GLSL text** — if the law lives in a shader, assert the shader text. A JS-side measurement
   cannot see a GLSL shape bug. The terminator flood is the proof: "36 of 36 bodies tinted, 16
   distinct hues" was **entirely true** and entirely compatible with the shader flooding the whole
   night hemisphere.

**PER SLICE (cheap).** Live probe through `window._lab` on a **generated** system. Report numbers,
not screenshots. ⚠ **Check rAF fps first** — a throttled window reports `hidden:false` and lies.

**PER SUBSYSTEM (expensive, ~1 per layer).** Multi-agent review with adversarial refutation. Roughly
1.8 M tokens; budget it deliberately.

⛔ **Keep the broken form as an instrument.** A pass with no failing control is worthless — the
terminator fence retains the clamped profile as a live test showing every `mu ≤ 0` collapses to 1.0.

---

## The graft cost, now measured

Three slices shipped condition-derived values onto the game's OWN shader (limb `f8a0b1e`, biosphere +
terminator `66cc231`). They were taken as cheap wins off a module-gap audit and explicitly were not
the target. **Two of the three shipped with real defects, and both defects exist *because* the graft
re-implements a law whose correct version was sitting unused in a module the game already imports:**

- the terminator used clamped `diffuse` where the lab uses signed `mu`, at 6.7× the strength the lab
  had already reduced after Max reported that exact artifact (`fd2fdd4`);
- the biosphere pushed raw `BIO_PIGMENT` where the lab's own uniform comment specifies the display
  transfer, rendering the canopy 2.5× too dark (`9a17098`).

The graft also collided with the lab's namespace: the game's `uBioColor` was a daylight canopy
albedo, the lab's `uBioColor` is F46 bioluminescent emissive. **The graft path is closed.** Further
condition-derived work goes through layers 0–3.

## Architecture verdict (2026-08-01 review)

**Constraint 2 holds for exactly one artifact — the shader TEXT — and nothing else.** That one is
real and verified: the lab imports `LAB_VERTEX_SHADER`/`LAB_FRAGMENT_SHADER` back from
`planet-lod-shaders.glsl.js`, so a lab GLSL edit reaches the game with zero port action.

Remaining human port actions, exhaustively:
1. `LAB_ATTRIBUTES` (`LabPlanetMaterial.js:32`) hand-lists the four attribute names — a fifth baked
   attribute in layer 4 needs a game-side edit, with no test and no runtime signal;
2. `LAB_WORLD_LIGHT` (`:35`) hand-copies `planet-lod-lab.html:203`;
3. ⭐ **nothing asserts the import edge itself** — the lab could re-inline its shader and all six
   re-pointed fences would stay green over an orphaned module (reproduced in node);
4. no per-frame uniform seam exists (layer 2, item 3);
5. the shader hard-assumes R=1.0, origin, identity quaternion and no logdepth — all layer 2.

---

## Step-model history (so old commit messages stay readable)

| old step | now |
|---|---|
| Step 0 — async compile + swap-on-ready | ✅ `9da286b`, `d87a8fe`. 5424 ms → 58.7 ms worst frame. |
| Step 1 — extract the applyDrivers core | → **layer 3**. Three graft slices shipped; path now closed. |
| Step 2 — extract the shaders | ✅ `6f9d3f4`. Vertex 1655 B / fragment 363 566 B byte-identical. |
| Step 3 — one land type end-to-end | → **layers 2+3**. `fc06017` put the lab's shader on a game planet; that milestone's *look* reading is void pending layer 2. |
| Step 4 — the bakes | → **layer 4**, pulled forward as a probe. |
| Step 5 — moons | → **layer 5**, now gated behind layer 0. |

## Traps that have each cost real time (do not re-learn these)

- ⛔ **A black frame is indistinguishable from a clean negative control.** Assert a lit-pixel floor
  and force a constant fragment output before diagnosing anything.
- ⛔ **A byte-identical string does not prove the page still runs.** Step 2's gate needed the
  pre-change HTML served side by side; both gave 0.375% lit / 1.86 luma / 367 uniforms. **0.375%
  looks exactly like a black frame** without that control.
- ⛔ **A frame diff cannot detect a small change while the scene animates.** A 500 ms settle gave a
  48% motion floor against a 50% signal. Back-to-back rAF grabs drop it to 1.6%, but planets are a
  few pixels at spawn distance.
- ⛔ **`gl.useProgram` + `getUniformLocation` is not a reliable "is this uniform used" probe** — it
  reported shipped, working uniforms (`uReliefMix`, `uCraterDensity`) as absent.
- ⛔ **Check whether a seam already exists before extracting anything.** Five recon agents designed
  an air-optics extraction that was unnecessary — `atmosphereOptics.js` was already shared and the
  game simply never called it.
- ⛔ **Chrome's shader DISK cache fakes compile measurements.** Cache-bust the shader SOURCE via
  `window.__shaderCacheBust`.
- ⛔ **The program cache key bakes in `toneMapping` + `outputColorSpace`, read from the BOUND render
  target.** Compiling against the canvas warms a program the game never draws.
- ⛔ **`import()` from an evaluated page script resolves to a DIFFERENT module instance.**
- ⛔ **`makeUniforms(WORLD_LIGHT)` takes the LIGHT VECTOR**, not `THREE`.
- ⛔ **Backticks inside the GLSL template literals in `src/objects/Planet.js` break the module.**
  `grep -c` for backtick LINES → **must stay 14**. Prose backticks in comments count.
- ⛔ **Do NOT add `rng` draws to `PlanetGenerator`'s shared stream** — one extra draw rewrites the
  generated universe. (Does not apply to `computeAtmosphere`; see layer 1.)
- ⚠ **`ss`/`curl` in the sandbox cannot see the dev server or Chrome** — use
  `mcp__chrome-devtools__list_pages`. `ss` reports no listener on a port that provably has one.
- ⚠ **Stage explicit paths in `git add`** — the tree carries standing NOT-OURS mods
  (`src/auto/CameraChoreographer.js`, `src/debug/LabMode.js`). Never `git add -A`.
- ⚠ Suite baseline **2026-08-01: 20832 passed / 4 failed** (`KnownObjects` ×3, `GalacticFeatures` ×1)
  + 13 `vendor/motion-test-kit` "no test suite" = **17 failed FILES**. Check before blaming yourself.

## ⭐⭐ SOL CANNOT VALIDATE ANY OF THIS WORK

Max, having had to say it more than once: *"the rendering process for Sol is unique in the galaxy
because we've got actual textures from NASA images."*

`public/assets/textures/bodies/` holds **18 NASA image assets**. Bodies with a `KNOWN_BODY_PROFILES`
entry load them through `BodyRenderer`'s **textured** path, which by standing rule never swaps back
to procedural. Sol's bodies also carry **no world-engine condition fields**. A measurement taken in
Sol is not merely unrepresentative, it is **confidently wrong** — the code path under test may not
execute at all. Use **`window._lab.spawnProceduralSystem(seed)`**, or Caph / Dalim / Larawag from
`node tools/find-test-systems.mjs 25`.

Sol *is* valid for **system-independent** work (shader compile cost — the GPU program is chosen by
body TYPE). Say which class the measurement is in whenever Sol is used at all.
⛔ Sol is **permanent**. Do not propose unifying them.

## How to pick this up in a fresh session

1. Read this file.
2. `git log --oneline -15` on `feature/world-engine-production-L1` — **the log outranks this file.**
3. Find the lowest-numbered layer that is not `DONE`. Layers 0/1 and 2 can run in parallel.
4. Before building on layer 4, run the bake probe — it is the only unpriced risk.

Do **not** read `~/briefings/*.md` for status. They are per-session and they go stale.
