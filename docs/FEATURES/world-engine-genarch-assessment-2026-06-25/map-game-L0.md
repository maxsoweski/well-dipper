# L0 (game) pipeline map — world-engine generative-architecture assessment

**Date:** 2026-06-25 · **Mode:** read-only assessment (no code edited) · **Branch:** `feature/world-engine-production-L1`

**Scope of this artifact:** map the GAME (L0) generation→render pipeline that every L1 effort consumes as its
input boundary. Files audited: `src/generation/PlanetGenerator.js`, `src/generation/PhysicsEngine.js`,
`src/generation/MoonGenerator.js`, `src/generation/StarSystemGenerator.js`, `src/generation/ExoticOverlay.js`,
`planet-drivers.js` (D1–D16/P1–P28 vocab — at repo root, NOT `src/generation/`), and the game renderer
`src/objects/Planet.js`. Cross-referenced against the north star (`docs/FEATURES/world-engine-architecture-spine.md`
§0/§1/§4) and the third surface `src/worldengine/base/*`.

**North star (the audit criterion):** "PROCGEN DECIDES, RENDER EXPRESSES. What you see IS the body's
billions-of-years history, written as DATA upstream; rendering only reads/expresses it." This file answers: does
the L0 game pipeline write any tectonic/geological *history as data*, or does it hand the renderer scalars + a
type label and let the fragment shader synthesize structure from noise?

**Headline verdict:** The game L0 pipeline writes a rich PHYSICS scalar vector per body (D1–D16, mostly real) plus
a flat system graph, but it writes **NO structural/relief field as data** — no heightfield, no orientation/grain
field, no stress tensor, no resurfacing-event sequence. The renderer (`Planet.js`) consumes a *strict subset* of
even the scalars it's handed: color, two noise scalars, a handful of feature toggles, and **one integer type
index**. All relief is synthesized in the fragment shader from `snoise(pos * noiseScale)` inside a per-type
`if (planetType == N)` branch. **This is exactly the "bag of toggled effects, oriented-overlay" failure the spine
§0 names, and it is the same gap WS4's UAT failed on — except in the game it is more total: the game shader doesn't
even read the thin grain WS4 added.** Procgen decides a *label*; render *invents* the structure.

---

## 1. (a) What per-body structure is generated AS DATA

### 1.1 The driver vector that EXISTS as data (D1–D16)

`PlanetGenerator.generate()` returns a flat object (PlanetGenerator.js:708–742). The D1–D16 vocabulary is defined
canonically in `planet-drivers.js:19–36` (repo root). Mapping each driver to its real status in the *game*
generation output:

| D | key | computed by | surfaced on planetData? | status |
|---|-----|-------------|--------------------------|--------|
| D1 | tempEq (`T_eq`) | `equilibriumTemperature` (PhysicsEngine.js:121) | yes (`T_eq`, PG:732) | **REAL scalar** |
| D2 | volatileFraction | `deriveComposition` (PhysicsEngine.js:380) | yes (inside `composition`, PG:731) | **REAL scalar** |
| D3 | axialTilt | PG:683–685 | yes (`axialTilt`, PG:727) | **REAL scalar** |
| D4 | atmoComposition | `computeAtmosphere` (PhysicsEngine.js:140) | yes (`atmosphere.physics.composition`) | **REAL scalar** |
| D5 | atmoDensity (pressure) | `computeAtmosphere` | yes (`atmosphere.physics.pressure`) | **REAL scalar** |
| D6 | atmoRetention | `computeAtmosphere` (`retained`) | yes (`atmosphere.physics.retained`) | **REAL boolean** |
| D7 | tidalLock | `checkTidalLock` (PhysicsEngine.js:280) | yes (`tidalState`, PG:733) | **REAL scalar/enum** |
| D8 | rotation | PG:688–695 | yes (`rotationSpeed`, PG:726) | **REAL scalar** |
| D9 | ironFraction | `deriveComposition` | yes (`composition.ironFraction`) | **REAL scalar** |
| D10 | carbonToOxygen | `deriveComposition` | yes (`composition.carbonToOxygen`) | **REAL scalar** |
| D11 | surfaceHistory | `computeSurfaceHistory` (PhysicsEngine.js:772) | yes (`surfaceHistory`, PG:734) | **REAL, but starved** (see §1.3) |
| D12 | tidalHeating | `tidalHeatingPlanet` (PhysicsEngine.js:342) | yes (`tidalHeating`, PG:741) | **REAL value, but DEAD-ENDED** (see §1.2) |
| D13 | magneticField | inline `ironFraction × rotationFactor` (PG:413) | yes (`magneticField`, PG:739) | **REAL scalar** (was double-computed; now single-source) |
| D14 | massGravity (`massEarth`) | `estimateMassEarth` (PhysicsEngine.js:61) | yes (`massEarth`, PG:730) | **REAL scalar** |
| D15 | habitability | `habitabilityScore` (PhysicsEngine.js:615) | yes (`habitability`, PG:734) | **REAL composite** |
| D16 | age (`age`) | passed `zones.ageGyr` | yes (`age`, PG:737) | **REAL scalar** |
| — | eccentricity | `circularize` of dedicated sub-rng (PG:387–392) | yes (`eccentricity`, PG:740) | **REAL value, but DATA-ONLY** (see §1.2) |
| — | metallicity | from `zones.metallicity` | yes (`metallicity`, PG:738) | **REAL scalar** |

**Correction to the assessment brief / spine §4a:** the brief said eccentricity/metallicity/D13/D16 were
"computed-then-dropped." That was true PRE-WS1. As of the **WS1 L0-plumbing workstream** (`docs/WORKSTREAMS/
world-engine-l0-plumbing-2026-06-23/`, committed on this branch) those five primitives ARE now surfaced on
`planetData` (PG:737–741). The remaining defect is **consumption**, not surfacing — see §1.2/§3.

### 1.2 D12 tidalHeating is REAL but DEAD-ENDED — and the cited line is stale

- **Stale line cite (FLAG):** the brief and `world-engine-architecture-spine.md:54`/`:130` both cite the D12
  hard-zero at `PlanetGenerator.js:565`. **That is wrong.** Line 565 is a ring `rngFloat3/4/5` call. The actual
  hard-zero is **PlanetGenerator.js:613** — the literal `0` passed as the fifth argument (`tidalHeatingRate`) to
  `computeSurfaceHistory(...)` (call spans PG:606–614). Any L1 plumbing spec that edits "PlanetGenerator.js:565"
  will edit the wrong line. Correct target = **PG:613**.
- **Nuance the brief got half-right:** D12 is no longer "hard-zeroed" in the sense of never being computed. WS1
  computes a REAL `tidalHeating = tidalHeatingPlanet(eccentricity, starMassSolar, radiusEarth, orbitRadiusAU)`
  (PG:402) and surfaces it (PG:741). What is STILL hard-zeroed is its **consumption**: it is *deliberately not* fed
  into `computeSurfaceHistory` (the literal `0` at PG:613, documented PG:608–613 as "WS1 is additive; consumption
  deferred to WS2"). So D12 exists as data but drives **nothing** downstream in the game. `eccentricity` is
  likewise explicitly "DATA-ONLY — never feeds px/pz" (PG:376–392).
- **Net:** D12 and eccentricity are surfaced-but-inert. The tidal/cryo/endogenic spine (E3/E6/E7/E11) the spine §4a
  flags as "starved" is starved because of this dead-end, not because the value is missing. It's one wiring step
  from live — but nothing in the game consumes it.

### 1.3 D11 surfaceHistory: real, but a 3-scalar summary, not a history record

`computeSurfaceHistory` (PhysicsEngine.js:772–801) returns exactly three scalars: `bombardmentIntensity`,
`erosionLevel`, `resurfacingRate`. This is the *closest thing in the game to "history as data,"* and it confirms
the spine's diagnosis: it is an aggregate budget (how cratered / how eroded / how resurfaced *on average*), NOT a
spatial field and NOT an ordered event sequence. There is no record of *where* a basin is, *which* epoch a crater
formed in, or what later edited it. It also receives `nearBelt=false, nearGiant=false` as literals (PG:606–607,
"refined by system generator later" — but they never are), so even the aggregate is partly inert.

### 1.4 The system graph: now EXPOSED (correction to the brief)

**Correction to the brief / spine §4a item 2 ("No per-body system context"):** this is now OUTDATED. The same WS1
workstream added a `systemContext` post-pass at the END of `StarSystemGenerator.generate()`
(StarSystemGenerator.js:624–679). After overlays run, each body's `planetData.systemContext` is populated with FLAT
primitives:
- `siblings: [{ type, orbitAU }]` — every other planet (SSG:638–645)
- `moons: [{ type, radiusEarth, orbitRadiusEarth, tidalHeating }]` — this body's own moons (SSG:648–653)
- `resonancePartners: [{ partnerIndex, ratio }]` — resolved by object identity against captured pairs (SSG:662–671)
- `companionClass` — binary companion star type or null (SSG:635, :677)

It is deliberately primitives-only (no cycles, JSON-serializable for save/share, SSG:631–634). So the spine's
"L0 computes the graph one level up; it just isn't exposed" is **half-resolved**: the graph is now exposed as a
flat summary. The remaining gap is again **consumption** — nothing in the game render path reads `systemContext`
(see §3), and it is a flat summary, not the live object graph E15/E4/E3 would want.

### 1.5 What is genuinely NOT generated as data (the real gap)

No spatial/structural field of any kind is produced by the game L0 pipeline:
- **No heightfield / DEM.** No per-texel or per-vertex elevation array anywhere in `PlanetGenerator` output.
- **No tectonic-grain / orientation field** (the E6 deliverable).
- **No stress tensor field** (E3).
- **No drainage / flow-accumulation / base-level field** (E9).
- **No field-topology / magnetosphere map** (E4).
- **No resurfacing-event sequence / epoch record** (the host-editor model).

The only spatially-resolved data the game generates per body are **discrete decorations**: gas-giant `storms.spots`
(positions + size + color, PG:617–680), `polarStorm`, ring `gaps`/`ringlets`, and `aurora` ring latitude. These are
sprite-like overlays, not a surface history. **Confirmed: the game produces zero tectonic structure as data.**

---

## 2. (b) Where "type" is picked FIRST and hard-codes outcomes (the over-supply problem)

The spine §4b "type is load-bearing at the input boundary, against co-genesis" is **fully confirmed in code.** Type
is the FIRST decision and it gates almost everything downstream:

### 2.1 `_pickType` runs before any driver (PlanetGenerator.js:322–323, :764–910)
`generate()`'s very first line is `const type = forceType || this._pickType(...)` (PG:323). `_pickType`
(PG:764–910) picks a discrete type from `rng.float()` against zone-banded thresholds (scorching/inner/HZ/
transition/outer). It reads orbit + zone params + metallicity, but it produces a **label first**, and that label
then *pre-decides* the rest of the body. This is the inversion the north star forbids: type should be an OUTPUT
label read off the drivers (spine §4b "demote type to a derived LABEL"), not the input that selects the drivers.

### 2.2 Type → hard-coded lookup tables (the over-supply)
After type is fixed, these are pure type-keyed dictionary lookups inside `generate()`:
- **Radius range** — `RADIUS_RANGES_EARTH[type]` + `MAP_RADIUS_RANGES[type]` (PG:293–312, :328–333).
- **Palette** — `PALETTES[type].colors` then `rng.pick` (PG:50–288, :340–341). 18 hand-authored palette tables.
- **Noise scale** — `noiseScaleRanges[type]` (PG:344–351).
- **Atmosphere** — `computeAtmosphere` *hard-codes D4/D5/D6 by type* for the big four: gas-giant/hot-jupiter/
  sub-neptune/venus return a fixed composition+pressure with an early `return` (PhysicsEngine.js:145–153) — the
  physics (Jeans escape) is bypassed entirely for those types. Also `typeAtmoColors[type]` override (PG:434–443).
- **Clouds / rings / moons** — `cloudChance[type]`, `ringChance[type]`, `maxMoonsByType[type]` (PG:512–591). Type
  sets the probability of each feature *category existing*.
- **Storms** — gated by `if (type === 'gas-giant')` (PG:618).

So the body's identity is established by a name, and ~7 independent lookup tables expand that name into features.
Drivers (which ARE computed) decorate the type, rather than the type being derived from the drivers.

### 2.3 `computeAtmosphere` type short-circuit (PhysicsEngine.js:145–153)
Worth isolating because it is the clearest "type overrides physics" instance: for the four primordial-atmosphere
types the function returns a canned `{retained:true, composition, pressure}` *before any escape calculation*. A
gas-giant is a gas-giant because it was *labeled* one, not because its mass/temp retain H2-He.

### 2.4 `ExoticOverlay` re-rolls type post-hoc and ERASES derived history (ExoticOverlay.js)
This is the most destructive over-supply mechanism for the north star. `ExoticOverlay.apply` (EO:26–57) runs AFTER
the system is generated and *swaps* planet types in place: civilized (city-lights/ecumenopolis, EO:70–106), exotic
(fungal/hex/machine, EO:118–235), geological (crystal/shattered, EO:247–275). The swap is done by
`_swapPlanetType` (EO:286–323), which calls `PlanetGenerator.generate(swapRng, orbit, sunDir, null, newType)` —
i.e. it **regenerates the body from scratch with `forceType` and `zones=null`**, discarding the original
driver-derived `planetData` entirely. Whatever physics history the body had (its real composition, atmosphere,
tidalState) is overwritten. The exotic type's features come from `rendersOn`-style allowlists keyed on the *name*,
not from drivers — exactly the spine §4b complaint ("chaos/cryoRidge fire because a body *is* 'Europa'").

### 2.5 D13/D15 layering inversion (spine §4b, confirmed)
`magneticField` (D13) and `habitability` (D15) are derived *composites* (D13 = ironFraction × rotation factor,
PG:413; D15 = composite of atmosphere/T_eq/age/iron/mass, PhysicsEngine.js:615–665). The spine flags these as
"computed at L0 then discarded (layering inversion)." Surfacing now happens (WS1), but they are still consumed by
nothing in render (§3) — so functionally the inversion stands: a derived RESULT is computed at the input boundary
and then thrown away rather than driving an L1 engine.

---

## 3. (c) How the GAME renders — and confirmation it reads NO structure, only scalars + a label

The game renderer is `src/objects/Planet.js` (the March-2026 type-branch shader). Confirmed: it generates no
tectonic structure as data; it synthesizes ALL relief in-shader from noise, branched on a single type integer.

### 3.1 planetData → uniforms (Planet.js:1038–1078)
The ShaderMaterial is built from a *strict subset* of `planetData`:
- `baseColor`, `accentColor` (vec3) — the palette.
- `noiseScale`, `noiseDetail` (float) — the two noise scalars.
- `planetType` (**int**) — `this._typeIndex()` (PL:1051).
- Feature toggles/params: `hasClouds`/`cloudColor`/`cloudDensity`/`cloudScale`, `atmosphereStrength`/
  `atmosphereColor`, `hasAurora`/`auroraColor`/`auroraIntensity`/`auroraRingLat`/`auroraRingWidth` (PL:1054–1066),
  plus shadow-caster arrays and `lodLevel`.

**That is the entire data interface.** Grepping `Planet.js` for `tidalHeating | eccentricity | magneticField |
systemContext | surfaceHistory | composition | habitability | T_eq | age` returns **zero hits.** The renderer
does not read a single one of the D1–D16 physics drivers, the system graph, or the surface-history budget. The
real physics the generator computes is *invisible* to what you actually see.

### 3.2 `_typeIndex()` — the label IS the load-bearing render input (Planet.js:1262–1270)
`_typeIndex()` returns `types.indexOf(this.data.type)` against the same 18-entry array as
`PlanetGenerator.TYPES`. This integer is the sole switch that drives the shader. Category routing
(`GAS_TYPES`/`ROCKY_TYPES`/else→EXOTIC, PL:984–1036) picks one of three fragment-shader bodies.

### 3.3 Relief is `snoise(pos * noiseScale)` inside `if (planetType == N)` branches
The fragment shader (`GAS_BODY`/`ROCKY_BODY`/`EXOTIC_BODY`) computes surface color and a "height" with a long
per-type branch chain — e.g. `ROCKY_BODY`: `if (planetType == 3)` lava cracks, `== 4` ocean continents from
`snoise(pos*noiseScale*0.7) + ...` octaves (PL:438–441), `== 5` terrestrial, etc. Relief perturbation is a
hardcoded per-type constant: `if (planetType == 3) perturbStrength = 0.20` (lava), `== 5` terrestrial,
`== 8` venus = 0.0 (PL:550–553); exotic side `== 12` shattered 0.20, `== 14` fungal 0.15 (PL:860–862). `seaLevel`
is a hardcoded literal per branch (e.g. `0.45`, `0.55`, PL:474, :516, :834). **There is no sampled heightfield, no
generated grain, no carved drainage** — the shader *is* the terrain generator, re-deciding structure from noise at
draw time, keyed on the type label. This is the literal opposite of "render expresses already-generated history."

So in north-star terms: **the game's PROCGEN decides a type-label + a palette + a noise frequency; the RENDER
DECIDES the structure** (from noise) rather than expressing it. The render is doing the generation.

---

## 4. How the three surfaces relate (untangling the apparent tension)

The brief flagged an apparent contradiction between WS4 (failed UAT) and the relief slice (passed UAT). There are
**three distinct surfaces**, at three maturity levels, none of which is yet the game:

1. **GAME L0 (this file's subject)** — `src/generation/*` + `src/objects/Planet.js`. PRODUCTION, shipped, what the
   player sees. Writes scalars + a type label; renders relief from in-shader noise. **No structure as data.** This
   is the input boundary every L1 effort consumes.

2. **The relief SLICE** — repo-root `relief-*.js` + `world-engine-relief-lab.html` (Max-UAT-PASSED 2026-06-23).
   Standalone lab. Builds a REAL `ReliefSubstrate` DATA structure (typed arrays: height, grainAngle, grainMag,
   regime, faultDensity, flowAccum, baseLevel) where E6 BUILDS and E9 CARVES into the SAME array over epochs. This
   is the *proof-of-concept* that "structure as data" works in isolation. Flat 2D latitude-band DEM (not sphere);
   E9 is a CPU bake-time reference. It is NOT wired to the game.

3. **The L1 BASE STEP** — `src/worldengine/base/*` (`adaptL0.js`, `baseStep.js`, `substrate.js`, `tectonic.js`,
   `sphereField.js`, `verify.js`). This is the **production port** of the relief slice's Tier-1 base step (the
   `world-engine-base-step-2026-06-24` workstream), i.e. the spine §4c "Option A expose+derive" layer. `adaptL0`
   (adaptL0.js:23–48) takes the WS1-surfaced game `planetData` and adapts it into a base-step bundle (it is the
   ONLY production consumer of WS1's tidalHeating/age/eccentricity/magneticField/systemContext). `makeBaseStep`
   (baseStep.js:10–100) then DERIVES a structured substrate (crustalThickness Float32Array, radialStrainSign/Mag,
   despinAmp, loveK2, liquidStability, regime discriminator).

**The relationship:** (2) proved the data-substrate mechanism; (3) is porting that mechanism into a production L1
layer that reads (1)'s newly-plumbed L0 scalars. **Critically, (3) is wired ONLY into the lab harness
(`worldengine-fieldviz.html`) and tests** — `grep makeBaseStep|adaptL0|worldengine/base` over `src/main.js` and
`src/objects/Planet.js` returns ZERO hits. So the base step does not touch the game render path yet, and the game
(1) still renders from noise. **There is no contradiction:** WS4 failed because it injected only a thin grain into
the game shader without a real substrate; the slice/base-step *have* the real substrate but are not yet connected
to the game renderer. The work that remains is to make the game's `Planet.js` (1) CONSUME a derived substrate
field from (3) instead of synthesizing relief from `snoise` — which is the L1 production-integration goal.

> Note on `adaptL0` passing `systemContext` through (adaptL0.js:41): it is forwarded into the bundle but
> `baseStep.js` does not read it. So even on the maturing L1 surface, the system graph is plumbed-but-unconsumed —
> the same pattern as the game.

---

## 5. Summary for the L1 input boundary

- **Generated as data (real):** D1–D16 physics scalars (PG:708–742), now incl. WS1's eccentricity/metallicity/
  D13/D16 and the `systemContext` flat graph (SSG:624–679). D12 tidalHeating + eccentricity are surfaced but
  **inert** (D12 consumption hard-zeroed at PG:613, not :565 as docs claim).
- **NOT generated as data:** any spatial field — heightfield, tectonic grain, stress tensor, drainage, field
  topology, epoch/event sequence. D11 is a 3-scalar budget, not a history record.
- **Type is picked first** (PG:323) and hard-codes radius/palette/noise/atmosphere/clouds/rings/moons/storms via
  ~7 type-keyed lookup tables; `computeAtmosphere` bypasses physics for 4 types; `ExoticOverlay` re-rolls type and
  *regenerates from scratch*, erasing driver history.
- **The game renderer reads NO structure** — only baseColor/accentColor/noiseScale/noiseDetail + feature toggles +
  one `planetType` int (PL:1038–1078). Relief is `snoise()` in a per-type shader branch. The render generates the
  structure; procgen only labels it. **This is the L0→L1 boundary as it stands: scalars + a label in, with all
  real physics computed-but-unread, and zero structural field for L1 to express.**
