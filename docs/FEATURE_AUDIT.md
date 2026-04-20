# Well Dipper — Feature Audit

## 0. How to use this document

This audit is a map of the variety levers already available in Well Dipper's codebase, plus a list of high-leverage things you could add. It's organized top-down by scale — galactic glow at the top, crater floors at the bottom — so you can see at a glance where variety is thin.

The payload is **Section 4**. That's where every finding is consolidated into a single prioritized shortlist. Read it first, then dive back into Sections 1–3 for the reasoning.

- **Section 1** — What is rendered today, where the code lives, and what drives the variation per feature.
- **Section 2** — **Procedural data that exists but never reaches a shader.** The fastest-payoff section.
- **Section 3** — Feature library: new candidates with cost/impact estimates.
- **Section 4** — Ranked shortlist with a short implementation strategy.

All file/line references are to the current tree under `src/`.

---

## 1. Current state, by scale

### 1.1 Galactic scale

- **Galaxy glow panorama** — `rendering/sky/GalaxyGlowLayer.js` (124 lines). Pre-baked equirectangular texture made offline via `GalaxyVolumeRenderer.js` from the single master seed. Textured backside icosahedron, additive, no depth test. *Runtime driver: none.*
- **Milky Way particle cloud** — `generation/MilkyWayModel.js` (365 lines), `.generate`/`.generateDust`. Five populations (arm, inter-arm, thick disk, bulge, HII pink knots) rejection-sampled from `GalacticMap.potentialDerivedDensity` + `spiralArmStrength`, with dust-lane rejection on inner arm edges. Consumed by `objects/MilkyWay.js`.
- **Spiral arm density model** — `GalacticMap.ARM_DEFS` (lines ~74–86), `spiralArmStrength`, `potentialDerivedDensity`. 2 major + 3 minor + Orion Spur arms, per-seed jitter ±0.08 rad, Dehnen bar potential, density from MN/Hernquist/NFW mix. Feeds the pano bake, the particle cloud, and the hash-grid starfield.
- **Dust lanes** — `MilkyWayModel.generateDust`. Inner trailing edge of arms, 120 pc scale height. Separate absorbing-points pass.
- **Background starfield (visible dots)** — `HashGridStarfield.js` (700 lines). Seven spectral tiers (O/B/A/F/G/K/M) + three evolved (Kg/Gg/Mg), per-cell hashing against local density, per-type grid size tuned for visible-mag cutoffs. Deterministic, regenerated on move. **Already reads galactic position correctly.**
- **External galaxies** — `GalacticMap.getExternalGalaxies` (line ~1455). Seeded direction, angular size, type (spiral/elliptical/irregular/dwarf). Plain sprites on sky sphere.

**Observations**
- The pano texture is the only thing most trips see at galactic scale and it is single-seed and static. What varies per trip is *where the player is* within the arms, which changes the apparent glow.
- `GalacticMap.deriveGalaxyContext` (line ~771) produces a rich per-position record (`component`, `componentWeights`, `metallicity`, `age`, `totalDensity`, `spiralArmStrength`) and passes it to `StarSystemGenerator`. System generation reads `metallicity` and `age` only; everything else is discarded.

### 1.2 Large deep-sky objects

Two pathways:

**A. Distant sky billboards:** `rendering/sky/SkyFeatureLayer.js` (1305 lines). The richest feature-renderer in the codebase — one unified shader with six `uShapeMode` branches, each heavily seed-parameterized:

- **0 irregular** — FBM + domain warp + dark lanes; seed-driven noise scale, falloff radius, warp offsets, clump count (~5 hidden parameters per nebula).
- **1 ring** — distorted lumpy rim; seed-driven radius, angular lumps, variable width, gaps.
- **2 bipolar** — hourglass/butterfly; seed-driven lobe shape.
- **3 filamentary** — stretched threads with cloud interiors; seed-driven thread scale and knot frequency.
- **4 shell** — broken thicker rim; seed-driven break character.
- **5 diffuse** — soft Gaussian blob with gentle warp.

Per-feature: shape mode, asymmetry (0–0.9), dark-lane strength, primary+secondary color, color mix, Beer-Lambert absorption coefficient. Within-type variation is already excellent.

**B. Navigable interiors** (player can fly through): `NavigableNebulaGenerator`, `NavigableClusterGenerator`, `VolumetricNebula`, `Galaxy`, `GalaxyCloud`, `GalaxyNebula`, `Nebula.js`. Billboard layers + point clouds for gas, real `StarRenderer` instances for stars.

Feature coverage:

- **Emission nebula** — 6 shape modes, 7-color palette. Rich.
- **Planetary nebula** — 4 modes, 8-color palette. Rich.
- **Supernova remnant** — 4 modes, 6-color palette. Rich.
- **Reflection nebula** — **absent from procedural `FEATURE_TYPES`.** Color palette exists in `_varyFeatureColor` (line ~1197), mode 5 handles it, but the only way it spawns is via `KnownObjectProfiles` (M45, M78). §2.10.
- **Dark nebula** — `FEATURE_TYPES['dark-nebula']`, `_createDarkNebulaBillboard`. One absorption blob variant.
- **Open cluster / OB association** — `FEATURE_TYPES` entries exist, but `SkyFeatureLayer._createFeatureMesh` returns `null` for non-known-profile matches (line ~199). Invisible except as density bumps in `HashGridStarfield`.
- **Globular cluster** — same pattern: generated into feature catalog, invisible unless matched to a `KnownObjectProfile`. §2.11.
- **Spiral galaxy (deep-sky destination)** — `GalaxyGenerator._generateSpiral` (279 lines). Log-spiral + Gaussian scatter, per-seed arm count 2–5, arm tightness, bar length, bulge size, disk thickness, per-arm length variation. Always face-on disc with scatter.
- **Elliptical galaxy** — `GalaxyGenerator._generateElliptical`. de Vaucouleurs R^1/4, single warm palette. Every elliptical looks the same.

**Observations**
- `SkyFeatureLayer` is the best variety-per-line-of-code asset in the codebase. Infrastructure vastly outruns what's hooked up to it.
- `reflection-nebula` and `globular-cluster` both have "almost shipping" states — generators set them up, shader/palette support exists, but the routing in `_createFeatureMesh` drops them. §2.10, §2.11.
- `NavigableClusterGenerator._generateGasLayers` gives flyable open clusters Pleiades-style reflection nebulosity, but the sky-billboard version doesn't pair clusters with reflection gas.

### 1.3 System scale

`StarSystemGenerator.generate` (619 lines) is where the physics pays off. Most fields are wired into generation logic. The question is whether they affect *rendered* output.

- **Main-sequence star** — `StarRenderer.MainSequenceStar` (lines 120–168). Spectral color + glow.
- **Red giant** — `RedGiantStar` (170–255). `evo.evolved` → clamped surface + huge warm glow.
- **White dwarf** — `WhiteDwarfStar` (257–332). Tight corona + Rayleigh halo.
- **Neutron star / pulsar** — `NeutronStar` (334–471). Seed-derived beam speed 4–12 rad/s, two opposing beams, tiny core. **Beam is billboarded to camera — not fixed to magnetic poles in 3D.**
- **Black hole** — `BlackHole` (477–599). Accretion disk radial gradient + simplified Doppler. No gravitational lensing.
- **Binary / dual lighting** — `StarSystemGenerator` lines 140–175. `starInfo` threaded through Planet/Moon/AsteroidBelt shaders. Working.
- **Planet orbits** — `StarSystemGenerator` lines 300–361 + `OrbitLine.js`. Log-normal spacing with peas-in-a-pod correlation (Weiss 2018).
- **Orbital resonance chain** — line ~397, `PhysicsEngine.detectResonances/snapToResonances`. Snaps ~5% of compact systems to exact ratios. No visual anchor tells the player this.
- **Migration / hot-Jupiter conversion** — lines 363–395. Functional but invisible as an *event* — no debris trail, no visible remnant of stripped planets.
- **Asteroid belts** — `AsteroidBeltGenerator.js` (179 lines), `objects/AsteroidBelt.js` (255 lines). Kirkwood gap culling, composition zones (s-type / c-type / mixed / metallic) reach per-instance colors. 4-shape InstancedMesh, power-law size distribution.
- **Kuiper belt** — same generator, flagged `isKuiper = true`. No visual divergence.
- **Trojan clusters** — `StarSystemGenerator` line ~461 generates L4/L5 cluster data; **no renderer consumes `systemData.trojanClusters`**. Wiring gap. §2.9.
- **Zones (scorching / HZ / frost)** — `systemData.zones`. Debug overlay only.

**Observations**
- `StarRenderer` branches on `evo.stage`, so some fraction of old systems reach neutron-star/black-hole states. This is already huge variety, entirely physics-gated.
- The current asteroid belt composition colors vary per asteroid instance but the *visual grouping* (s-type inner, c-type outer zones) isn't announced — you can't see the boundary where the colors transition.

### 1.4 Planetary-body scale

The feature-richest part of the project. 18 types across three shader categories in `objects/Planet.js` (1299 lines), dispatched via `Planet._typeIndex` → `planetType` int uniform → `GAS_BODY`, `ROCKY_BODY`, or `EXOTIC_BODY`.

**Palette counts** (`PlanetGenerator.PALETTES`, lines 47–284):

| Type | Palettes | Category | Extra variation |
|---|---|---|---|
| rocky | **13** | rocky | noiseScale 2.0–5.0, clouds 10%, rings 5% |
| gas-giant | **20** | gas | storms array (never read), rings 50% |
| ice | **20** | rocky | dual-scale cracks |
| lava | **20** | rocky | `1-abs(n)` squared glow cracks |
| ocean | **5** | rocky | sea level, sparse islands |
| terrestrial | **20** | rocky | elevation zones, ice caps, ITCZ bands |
| hot-jupiter | **4** | gas | dayside hotspot, night emission |
| eyeball | **5** | gas | concentric climate rings |
| venus | **5** | rocky | low-contrast banding under clouds |
| carbon | **5** | rocky | diamond glints |
| sub-neptune | **4** | gas | smooth hazy banding |
| fungal | **18** | exotic | bioluminescent clusters, 10% bloom |
| hex, shattered, crystal, machine, city-lights, ecumenopolis | **4 each** | exotic | geometric branches |

Physics-derived properties on every planet: `estimateMassEarth`, `computeAtmosphere`, `deriveComposition`, `equilibriumTemperature`, `tidalLockTimescale`, `checkTidalLock`, `computeSurfaceHistory`, `generateRingPhysics`. Aurora is derived from iron-core × UV flux (Planet.js lines 435–484) and **is** wired — a model for how to ship the others.

**Observations**
- The big palettes (rocky=13, gas-giant=20, ice=20, lava=20, terrestrial=20, fungal=18) cover most trips well. The 4-palette types (hot-jupiter, sub-neptune, and all exotics except fungal) are the weakest.
- Rings: `generateRingPhysics` returns 16 ringlets, up to 8 resonance gaps, composition colors, ring lifetime, origin type. **`Planet.js` throws all of it away** and uses a hardcoded sine-wave shader (lines ~1188–1204) — two colors and one Cassini-style gap, regardless of moon count.
- `rendering/objects/RingRenderer.js` (312 lines) exists, consumes `physics.ringlets + gaps + composition`, supports 16 ringlets and 8 gaps as uniform arrays, and is **not instantiated anywhere** in the codebase. Dead code waiting to be wired. §2.4.

### 1.5 Surface scale

Rocky/airless bodies use Planet.js `ROCKY_BODY` plus Moon.js:

- **Base height perturbation** — `FRAG_HEADER.computeHeight` (Planet.js line 205), `perturbNormalFromNoise` (line 216). 4-octave FBM via finite differences. Strength 0.25 rocky/ice/carbon, 0.20 lava, 0.0 Venus. Masked to land on terrestrial/ocean.
- **Maria / dark plains** — Moon.js rocky branch line 338. FBM mask × accent color.
- **Bright ray craters** — Moon.js rocky branch line 345. Separate FBM, power curve.
- **Crater profile (LOD2 only)** — Moon.js `computeHeightLOD2` line 305, `cellular3D` + `craterProfile`. Three fixed scales: basins (0.4), medium (1.5), small (4.5). Bowl + rim + ejecta. **Only rocky and captured moons** (moonType 0/1) get it. Ice, volcanic, terrestrial don't.
- **Ice cracks** — Moon.js line 366, Planet.js line 430. Dual-scale fracture (pow 3 broad + pow 2.5 fine).
- **Lava glow cracks** — Planet.js line 426.
- **Volcanic caldera** — Moon.js line 378. Sulfur frost + dark caldera spots.
- **Continents (terrestrial)** — Planet.js line 435. Continent FBM with latitude ice caps and elevation zones (lowland/midland/highland/peak).
- **Rocky dust storms** — Planet.js line 615. Sparse FBM patches.

**Observations**
- **Craters are mono-distribution.** Every cratered surface uses the same three cellular3D scales and the same profile. No age-driven density, no rim degradation, no saturation, no impact rays, no secondary chains, no large basin rings.
- `surfaceHistory` (`bombardmentIntensity`, `erosionLevel`, `resurfacingRate`) is computed on every planet but never reaches a shader. **The single highest-leverage "wire the data up" win.** §2.2, §2.3.
- `composition.surfaceType` (silicate / iron-rich / carbon / ice-rock) is computed per planet but doesn't affect color or noise. §2.6.
- Perturbation strength is hand-tuned by type, not physics — a 0.5 Gyr young lava world and a 10 Gyr dead one both get 0.20.

### 1.6 Micro / ambient

| Feature | Where | Current look |
|---|---|---|
| Background starfield density | `HashGridStarfield` per-type density from `potentialDerivedDensity` × metallicity × age | Already varies by galactic position — dense bulge, sparse outer disk |
| Diffraction spikes (stars) | `Nebula.js` line ~247 (embedded stars), `StarFlare.js` full flare (8 spikes, 4 pairs, rainbow chromatic dispersion) | Excellent — lens-flare reference-based |
| Atmospheric rim glow | Planet.js (line ~389), Moon.js line ~548 | Fresnel × atmosphere strength × sunFacing |
| Aurora | Planet.js lines ~168–199, Moon.js lines ~520–532 | Physics-driven: iron-core × UV flux × rotation; green/blue/pink/red colors by atmosphere composition; ring latitude + curtain noise |
| Bayer dither + posterization | `DitherPass.js` + per-shader inline `bayerDither` | 6 levels, 4×4 pattern, edge width 0.4 |
| Retro pixel resolution | `RetroRenderer.js` | 1/3 resolution render target |

**Observations**
- Aurora is one of the few places where physics → shader is cleanly wired. It's the model to copy for future physics-derived surface features.
- `StarFlare` is used for foreground stars, but deep-sky star points in `SkyFeatureLayer` get a simpler 4-spike shader. No chromatic aberration on background stars.

### 1.7 Cross-scale systems / presentation orchestration

Systems that don't belong to a single rendering scale but instead orchestrate *how* the rendered content is presented to the player. Listed here so the audit map is complete.

| System | Where | Feature doc | Current state |
|---|---|---|---|
| **Warp** | `src/effects/WarpEffect.js`, `src/rendering/RetroRenderer.js` `hyperspace()` | `docs/FEATURES/warp.md` | Active, V1 in flight — see feature doc §Current state snapshot. |
| **Autopilot** | `src/auto/FlythroughCamera.js`, `src/auto/AutoNavigator.js` | `docs/FEATURES/autopilot.md` | **V1 scoped 2026-04-20.** Two-axis rewrite: ship axis (ENTRY → CRUISE → APPROACH → STATION) + camera axis (ESTABLISHING V1, SHOWCASE/ROVING V-later). Retires today's `FlythroughCamera.State = { DESCEND, ORBIT, TRAVEL, APPROACH }`. Greenfield on ship-motion layer; existing flythrough code is the rewrite surface. V1 scope line: all 4 ship phases + ESTABLISHING, default-on toggle, manual-override with inertial continuity, gravity-drive shake on abrupt transitions, audio event-surface hook (no subscribers), HUD hide-during-autopilot. |
| **OOI catalog + registry** | `docs/OBJECTS_OF_INTEREST.md` (catalog) + `src/*` TBD (runtime registry) | — (infrastructure, not a feature) | v0 catalog live 2026-04-20. Runtime-registry spec scoped at `docs/WORKSTREAMS/ooi-capture-and-exposure-system-2026-04-20.md`. First consumer: autopilot V-later SHOWCASE/ROVING. |
| **Nav computer** | `src/nav/*` | — (contract at `docs/SYSTEM_CONTRACTS.md` §6) | Active. 5-level zoom into the galaxy model. |
| **Targeting + selection** | `src/ui/TargetingReticle.js`, `main.js` pointer pipeline | — (contract at `docs/SYSTEM_CONTRACTS.md` §5.4) | Active. Decoupled from travel (click ≠ go) per contract. |

**Observations**
- Autopilot is the load-bearing "see the galaxy" feature — §2 Star Systems and §3 The Sky both produce content whose *visible impact per trip* is gated by how autopilot composes the tour. A scale-rich galaxy that no autopilot tour lingers on is wasted procedural budget.
- The OOI catalog exists today but has no runtime consumer. It's V-later for autopilot; V1 autopilot ships with a stub interface ready for the registry to land underneath it.
- `AutoNavigator` today conflates cinematography (tour-queue orchestration) and navigation-subsystem (A-to-B motion execution). The autopilot V1 feature splits these into two layers; the split is a refactor requirement, not optional. See `docs/SYSTEM_CONTRACTS.md` §10.3.

---

## 2. Procedural data that isn't expressed

This is the highest-ROI section. Every entry here is "generator produces this, shader ignores it, wiring it up is mostly typing."

### 2.1 Gas giant storms — generated, never drawn

`PlanetGenerator.generate` lines 587–650 produces a `storms` object containing:
- `storms.spots[]` — 1–3 storm spots per gas giant, each with `position` (unit sphere), `size` (0.08–0.3 angular radius), `aspect` (1.2–2.5 oval elongation), `color` (dark bruise / warm red spot / bright pale — picked by a roll).
- `storms.polarStorm` — ~15% chance, `sides` (5–8), `pole` (±1), `radius` (0.12–0.22), contrasting color. Directly models Saturn's hexagon.

`Planet.js` gas-giant shader (line 287–413) reads `baseColor`, `accentColor`, `noiseScale`, `noiseDetail`, `planetType`, and that's it. The storms array never makes it to a uniform.

**Fix:** pack `storms.spots` into a fixed-size uniform array (say up to 4), pass positions + size + aspect + color. In the shader, compute `sin(angle(pos, spotPos))` and threshold with `aspect`. For the polar hex, compute distance to pole, threshold radius, then compare `atan2(x, z) * sides / 2PI` against a noise-free polygonal mask. **Cost: cheap.** **Impact: gas giants currently look procedurally indistinguishable — this reintroduces the single most iconic thing about Jupiter and Saturn on every trip.**

### 2.2 `PhysicsEngine.computeSurfaceHistory` output, never read

`PlanetGenerator.generate` line 581 stores `surfaceHistory` on every planet:
```js
{ bombardmentIntensity, erosionLevel, resurfacingRate }
```
Driven by `ageGyr`, `nearBelt`, `nearGiant`, `hasAtmosphere`, and tidal heating. `BodyRenderer.js` stores it at line 65 (`this._surfaceHistory = physicsData?.surfaceHistory`) and acknowledges in comments: *"These will drive close-up shaders when implemented."*

Neither Planet.js nor Moon.js's shaders receive it.

**Fix:** pass three uniforms to `ROCKY_BODY` and the Moon shader:
- `uBombardment` — scales crater density (see 2.3)
- `uErosion` — softens normal perturbation strength; low erosion = sharp relief, high erosion = smoother terrain with filled-in craters
- `uResurfacing` — reduces crater density further on young volcanic worlds; adds lava-flow mask for high resurfacing + lava/volcanic type

**Impact:** every rocky planet and moon would express its age + dynamical environment on its surface. A young inner-belt moon near a gas giant looks scarred; a quiet outer-system ice ball looks pristine; an Enceladus analog has resurfaced plains. **Cost: medium.** **Impact: very high — it touches every trip.**

### 2.3 Crater distribution is hardcoded

Moon.js line 316 uses three fixed cellular3D frequencies (0.4, 1.5, 4.5) and three fixed amplitudes (0.6, 0.3, 0.12) for LOD2 crater relief. Every cratered body has the same density and distribution. No way to get:
- Old surface densely saturated (Callisto ~1 crater/km²)
- Young surface with ~zero craters (Io)
- Mid-aged with a few large basins but no saturation (Mars)

**Fix:** multiply crater amplitudes by `uBombardment` from 2.2. Optionally, add a "basin mask" that overrides a hemisphere with a large smoothed bowl (Hellas / South Pole–Aitken analog) via a single low-frequency cellular lookup. Already only a few lines because the cellular noise is already in the shader.

**Cost: cheap once 2.2 is in.** **Impact: high.**

### 2.4 Ring physics → renderer pipeline is severed

`PlanetGenerator.generate` lines 519–555 calls `generateRingPhysics` which returns a full ring description:
- `ringlets[]` — up to 16 bands with `innerR`, `outerR`, `opacity`, `composition`
- `gaps[]` — up to 8 resonance gaps with `radius`, `width`, `moonIndex`, `resonance` (2:1 or 3:1)
- `composition` string — drives color palette
- `density` — age-dependent opacity (0.2 tenuous to 0.8 fresh)
- `origin` — `'roche' | 'accretion' | 'collision' | 'captured'`

**`Planet.js` `_createRing` reads only `color1`, `color2`, `opacity`, `innerRadius`, `outerRadius`, `tiltX`, `tiltZ`.** The ring shader then draws two sine-wave bands (`sin(t*30)` + `sin(t*12)`) plus a single hardcoded Cassini-like gap at `t ≈ 0.45`. Everything that would make a ring system feel different from another ring system is thrown away.

`rendering/objects/RingRenderer.js` (312 lines) exists, reads all of the physics ringlets, supports up to 16 ringlets and 8 gaps as uniform arrays, looks up composition colors from a lookup, and has never been instantiated anywhere in the codebase.

**Fix:** in `BodyRenderer.createPlanet`, instantiate `RingRenderer(planetData, planetData.rings?.physics, lightDir)` and add its `.mesh` to the planet group instead of the current `Planet._createRing`. Remove the legacy ring code from Planet.js once confident.

**Cost: cheap.** **Impact: high. Every ringed planet currently looks like a minor variation of Saturn's two-band look. Unlocking physics rings gives you shepherd-moon gaps, age-varying opacity, and proper ice/rock/dust color palettes.**

### 2.5 Palette variety is type-asymmetric

`PlanetGenerator.PALETTES`:
- `rocky` — 13 entries
- `gas-giant` — 20 entries
- `ice` — 20 entries
- `lava` — 20 entries
- `terrestrial` — 20 entries
- `fungal` — 18 entries
- **`hot-jupiter` — 4**
- **`eyeball` — 5**
- **`venus` — 5**
- **`carbon` — 5**
- **`sub-neptune` — 4**
- **`hex` — 4**
- **`shattered` — 4**
- **`crystal` — 4**
- **`machine` — 4**
- **`city-lights` — 4**
- **`ecumenopolis` — 4**

**Fix:** bring the thin-palette types up to the same 15–20 range as rocky/gas-giant. This is pure data entry in `PlanetGenerator.PALETTES`. The shaders already blend between `baseColor` and `accentColor`, so nothing else changes.

**Cost: trivial.** **Impact: medium — only when those types roll.** The exotic types are rare so the impact per trip is low, but hot-jupiter is ~1% of systems (close-in rare) and currently every hot Jupiter looks like one of 4 near-identical palettes.

### 2.6 `composition.surfaceType` is computed but invisible

`PhysicsEngine.deriveComposition` (line 341) returns `{ carbonToOxygen, ironFraction, volatileFraction, surfaceType, density }`. Planet.js ignores all of it. `BodyRenderer._composition` stores it but the shaders never see it.

Specific wins:
- `surfaceType === 'iron-rich'` could desaturate the base color 20% and boost a metallic specular term.
- `surfaceType === 'carbon'` could force a warm-to-cool black gradient regardless of palette roll. (Today `carbon` is its own planet type with only 5 palettes — composition-driven tint would also apply to *non*-carbon planets that happened to have high C/O.)
- `surfaceType === 'ice-rock'` for rocky/carbon bodies that formed beyond the frost line → subtle bluish tint to the palette.
- `ironFraction` directly drives magnetic field (already) and could drive an albedo reduction (iron-rich cores = darker overall).

**Fix:** add `uSurfaceType` int + `uIronFraction` float to the rocky shader, apply a multiplicative tint after surface color compute.

**Cost: cheap.** **Impact: medium-high — touches every rocky planet.**

### 2.7 `tidalState.lockType` partial use

`PlanetGenerator.generate` line 387 computes `{ locked, lockType }`. Line 659 uses it to set `rotationSpeed = 0` or 0.02. Shader never sees it — the terminator always behaves the same way.

For a synchronously locked rocky/ocean/terrestrial planet, the day side should have permanent conditions that look different: a wide cloud disk centered on the subsolar point (convergence), a water ice ring on the terminator, and a frozen night side. Eyeball planets have all this hardcoded (`planetType == 7`) but a locked regular terrestrial does not.

**Fix:** when `lockType === 'synchronous'` for terrestrial/ocean/rocky, route them through the eyeball shader path instead.

**Cost: cheap.** **Impact: low-medium — ~1–5% of close-in rocky planets get locked.**

### 2.8 Nebula generator extras not used downstream

`NebulaGenerator._generateEmission` lines 77–81 set `domainWarpStrength`, `darkLaneStrength`, `asymmetry`, `brightnessShape` on each layer. `Nebula.js` reads all of them — so the navigable version is fine. But `SkyFeatureLayer.js` sets its own per-feature `_asymmetry`, `_darkLaneStrength`, and `_shapeMode` from the seed hash, not from the generator. The two code paths don't share state, which means a given nebula's distant appearance (billboard) and close appearance (navigable flythrough) can disagree about shape.

**Cost: medium (unify the seeds).** **Impact: low — affects consistency, not variety.** Leaving this for now is fine.

### 2.9 Trojan clusters never rendered

`StarSystemGenerator` line 461 populates `systemData.trojanClusters` with L4/L5 positions, counts, spread angles. No renderer consumes it. A grep for `trojanClusters` outside the generator finds no calls.

**Fix:** render trojans as two dim asteroid-style clusters at Lagrange points when a system has gas giants. Reuse the `AsteroidBelt` shader with smaller radius bounds.

**Cost: medium (new spawn path).** **Impact: low — noticed only in systems with gas giants + close inspection.**

### 2.10 `reflection-nebula` missing from `FEATURE_TYPES`

Discussed in 1.2. The color palette is in `_varyFeatureColor`, the `SkyFeatureLayer` shader mode 5 (diffuse) handles it, the billboard routing handles it — but `GalacticMap.FEATURE_TYPES` has no entry, so procedurally-placed reflection nebulae never exist. Add one with `conditions: (ctx) => ctx.component === 'thin' && ctx.spiralArmStrength > 0.25` and a `probability` tuned to hit ~1000 galaxy-wide (real count is ~500).

**Cost: cheap (one dict entry).** **Impact: high — a whole new deep-sky object class appears on trips.**

### 2.11 Procedural globular clusters are invisible

Also discussed in 1.2. `FEATURE_TYPES['globular-cluster']` is generated but `SkyFeatureLayer._createFeatureMesh` lines 193–199 returns `null` for clusters unless they carry a `knownProfile`. So procedural globulars exist in the catalog but have no visual.

**Fix:** procedural globulars should spawn a compact warm-glow billboard (reuse mode 5 diffuse with a tight Gaussian). Even a single uniform color glow ball sells it at distance.

**Cost: cheap.** **Impact: medium — trips near the galactic halo/bulge gain visible warm orange glows.**

### 2.12 Galaxy context metadata unused for system visuals

`StarSystemGenerator` receives `galaxyContext` with `component`, `componentWeights`, `spiralArmStrength`, `metallicity`, `age`, `totalDensity`. It uses `metallicity` (drives Fischer-Valenti giant probability, composition) and `age` (stellar evolution, surface history), but:

- Spiral-arm strength doesn't affect visual: dust-lane proximity could dim the ambient scattered light in the system's sky.
- Component (thin / thick / bulge / halo) doesn't affect the system's sky. A halo system should have very few nearby stars and an obvious galactic plane as a bright band. A bulge system should be saturated with warm K/M stars on every sightline.
- Total local density could gate background star count.

Note that **`HashGridStarfield` already reads density from `GalacticMap.potentialDerivedDensity`**, so the starfield already varies correctly. What's missing is system-level cues — the player can't tell from one system to the next that they're in the bulge vs the thin disk. The star count does the work passively but no strong visual anchor (a big bright bulge in one direction, an obvious disc band in another) announces it.

**Fix:** expose `galaxyContext.component` to the sky glow layer as a directional tint boost, so bulge-system skies are warmer and halo-system skies are darker.

**Cost: medium.** **Impact: medium-high per trip — it's the single cue that makes a trip "feel" like it's somewhere specific.**

---

## 3. Feature library

Each entry: one-line description, real-world or precedent basis, approach, inputs, cost/impact. Cost = cheap/medium/expensive. Impact = low/medium/high (how often a casual viewer would notice per trip).

### 3.1 Galactic / deep-sky

- **Reflection nebula (procedural)** — dusty blue diffuse glow around open clusters. Basis: M45, NGC 1977. Add entry to `FEATURE_TYPES` with thin-disk + arm + cluster-proximity conditions; shader path already exists (mode 5). Inputs: component, arm strength. **Cheap / high.**
- **Bok globules** — compact dark knots silhouetted against emission nebulae. Basis: Barnard 68, IC 1396. New `bok-globule` tier with `sizeRange: [0.0005, 0.003]`, sharper absorption coefficient. **Cheap / medium.**
- **Herbig–Haro jets** — pencil-thin bipolar jets from protostars. Basis: HH 47. New shape mode 6: two narrow stretched gradients along seeded axis, H-alpha red with SII knots. **Medium / low-medium** (small, rare).
- **Wolf–Rayet shells** — bright blue-white expanding bubble. Basis: NGC 6888 (already in `KnownObjectProfiles`). New `FEATURE_TYPES['wolf-rayet-shell']` using mode 4 shell + OIII/H-alpha palette. Conditions: near high-`obBoost` regions. **Cheap / medium.**
- **Halo glow** — faint warm diffuse halo outside the disk near globulars. Basis: `COMPONENT_STAR_WEIGHTS.halo` exists but `MilkyWayModel` has no halo budget. Add halo population with wide vertical spread. **Medium / medium** (outside-disk trips only).
- **Tidally distorted galaxy pairs** — Antennae-like interacting galaxies with tidal bridges. Extend `GalaxyGenerator._generateSpiral` with ~10% pair chance. **Medium-expensive / high per roll** but rare.
- **HII arm-knot concentration** — bright pink knots along arm spines. Currently `MilkyWayModel` has HII at 3% but spread across whole arms. Tighten sampling to arm spines + bigger particle size. **Cheap / medium** (mostly nav images).
- **SNR age → shape** — young Crab-like filamentary → old Cygnus Loop diffuse. Add `ageGyr` context to SNR and wire into `_assignProceduralShapeMode` weighting. **Cheap / medium.**

### 3.2 System scale

- **Gravitational lensing around black holes** — warp disk image behind shadow. Basis: *Interstellar*, EHT imagery. Add screen-space radial distortion pass to `BlackHole` class. **Medium-expensive / very high per roll**, rare.
- **Pulsar jets fixed in 3D** — two oriented cones along a magnetic axis offset 10–30° from spin axis, replacing the current billboard beam. Basis: Crab, Vela. **Medium / medium** (rare but striking).
- **Protoplanetary disks** — dusty infalling disk with ring gaps around very young stars (`ageGyr < 0.1`). Basis: HL Tau. Reuse `AsteroidBelt` with concentric rings and orange-dust palette. **Medium / medium** (rare).
- **Comet tails** — straight ion tail (sun line) + curved dust tail (velocity). New `objects/Comet.js`, sprite-chain tails. **Medium / medium.**
- **Debris disks** — thin dust ring beyond Kuiper belt. Basis: Fomalhaut, Beta Pic. Third belt in `StarSystemGenerator` when `formation.diskMass` is high. **Cheap / low-medium.**
- **Gas giant aurorae** — currently gated on iron-core check which is 0 for gas giants. Give gas giants an explicit high-intensity polar aurora entry. **Cheap / medium.**
- **Visual asteroid belt composition zones** — colors already per-instance, but boundaries aren't announced. Apply a subtle band darkening between zones in the AsteroidBelt shader so s-type → c-type transitions are visible. **Cheap / low-medium.**

### 3.3 Planetary

- **Weather bands on non-terrestrial rockies** — ITCZ + storm track + polar already exists for terrestrial (Planet.js line 587). Extend to rocky/ocean/venus/eyeball. **Cheap / low-medium.**
- **Seasonal polar caps by axial tilt** — scale terrestrial ice cap threshold by `axialTilt` magnitude and `T_eq - 273`. Both inputs already on the planet data. **Cheap / low-medium.**
- **Canyon / rift valleys** — long directional noise for tectonically active rocky worlds (young + iron-rich). Add to `computeHeightLOD2` with direction seed. **Medium / medium.**
- **Eyeball variation** — vary ring width by `T_eq` offset and lock strength. Currently every eyeball has the same ring profile. **Cheap / low.**
- **Shattered planet geometry** — replace sphere with hemisphere + crescent debris for `shattered` type. **Expensive / high per roll** but rare.
- **Io-class volcanism variety** — expand `volcanic` moon palette from 5 to 15, add 1–3 bright plume sprite clusters anchored to seeded volcano positions. **Medium / medium.**

### 3.4 Surface (highest Max interest)

- **Tycho-style impact rays** — at LOD2 rocky path, add a very-low-frequency cellular pass picking 1–3 fresh impacts. For each, `pow(cos(angleFromImpact), 4)` ray term. **Medium / high** (very noticeable close-up).
- **Overlapping craters** — two cellular passes in `computeHeightLOD2` with the small attenuated inside big-basin bowls, amplified outside. A few lines in Moon.js. **Cheap / medium.**
- **Rim degradation with erosion** — multiply `rim` term in `craterProfile` (Moon.js line 299) by `(1 - erosionLevel)`. **Cheap / medium** (after §2.2).
- **Basalt flood patterns** — long-wavelength FBM mask → dark flat mare patches under which fresh craters can still appear. **Medium / medium.**
- **Scarring from old lava flows (rocky, not lava type)** — mix rocky palette toward a darker variant inside low-freq noise when `resurfacingRate` is moderate. Works on "old rocky" planets regardless of type. **Cheap / medium-high.**
- **Hemispheric continental bias** — skew continent FBM on terrestrial planets by a seeded `hemisphereBias * sign(pos.y)` term. Pangaea / Earth-north pattern. **Cheap / low-medium.**
- **Ancient ocean basins** — on dry rockies with `volatileFraction > 0.1`, apply hemispheric darkening with low-freq FBM edge. Basis: Martian northern lowlands. **Medium / medium-high.**
- **Extended city-lights variation** — seed-driven development level (rural to dense urban), plus highway lines between city-cluster hash centers. **Medium / medium.**
- **Europa lineae** — replace ice branch's dual-scale fractal cracks with a third long-wavelength directional pass for geometric lineae. **Cheap / medium.**

---

## 4. Prioritization shortlist

Top 15 highest-leverage wins, ranked by cost-adjusted variety impact. "Plumbing wins" (Section 2) cluster at the top because they're cheap and touch every trip.

| Rank | Feature | Scale | Cost | Variety Impact | Procedural Inputs | Dependencies | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Wire up gas giant `storms.spots` + `polarStorm` to the gas-giant shader | planetary | cheap | high | seeded storm array from PlanetGenerator | — | §2.1. Two days of work. Every gas giant immediately reads as distinct. |
| 2 | Wire `RingRenderer` into `BodyRenderer.createPlanet` — use physics ringlets + gaps | planetary | cheap | high | ring physics from `generateRingPhysics` | — | §2.4. Dead code is already written. Just swap the instantiation site. |
| 3 | Add `reflection-nebula` entry to `GalacticMap.FEATURE_TYPES` | deep-sky | cheap | high | component + arm strength + cluster proximity | — | §2.10 + §3.1. One dict entry. |
| 4 | Wire `surfaceHistory` (bombardment, erosion, resurfacing) to rocky/moon shaders | surface | medium | very high | `ageGyr`, `nearBelt`, `nearGiant`, atmosphere | — | §2.2. Touches every rocky planet and moon. Pairs naturally with #5. |
| 5 | Crater density and rim degradation from `bombardmentIntensity` + `erosionLevel` | surface | cheap | high | from #4 | #4 | §2.3 + §3.4. Old surfaces get saturated; young ones stay pristine. |
| 6 | Expand thin palettes (hot-jupiter, exotic types) from 4–5 entries to 15–20 | planetary | trivial | medium | — | — | §2.5. Pure data entry in `PlanetGenerator.PALETTES`. |
| 7 | Procedural globular cluster billboard (use mode 5 diffuse) | deep-sky | cheap | medium | existing `FEATURE_TYPES['globular-cluster']` | — | §2.11. Remove the `return null` in `SkyFeatureLayer._createFeatureMesh`. |
| 8 | Use `composition.surfaceType` + `ironFraction` for rocky palette tinting | planetary | cheap | medium-high | composition data | — | §2.6. Iron-rich planets get visibly darker and slightly metallic. |
| 9 | Impact ray craters (Tycho-style) at LOD2 | surface | medium | high | new seeded fresh-impact count | #4, #5 | §3.4. Very noticeable at close range. |
| 10 | Procedural basaltic maria / dark plains on rocky planets | surface | cheap | medium | `volumeFraction`, `ageGyr` | #4 | §3.4. |
| 11 | Route tidally-locked non-eyeball habitable planets through the eyeball shader path | planetary | cheap | low-medium | `tidalState.lockType` | — | §2.7. |
| 12 | Age-to-shape mapping for supernova remnants | deep-sky | cheap | medium | feature `ageGyr` context | — | §3.1. Young SNRs become filamentary, old become diffuse shells. |
| 13 | Hemispheric component tint on sky glow from `galaxyContext.component` | galactic | medium | medium-high | galaxy context component weights | — | §2.12. Makes bulge vs disk vs halo feel distinct per trip. |
| 14 | Canyon / rift valleys on tectonically active rocky worlds | surface | medium | medium | `ageGyr`, `ironFraction` | #4 | §3.3. Feeds into variable-terrain signature. |
| 15 | Europa-style lineae / ice fracture networks on ice bodies | surface | cheap | medium | existing ice shader | — | §3.3. Replace fractal cracks with directional lineae. |

### Implementation strategy

The top six items are cheap wiring wins that should probably ship before any new feature work. Of those, #1 (gas giant storms) and #2 (ring physics) are the highest-leverage per hour — both are cases where the generator already makes the data and the renderer is blind to it. Shipping both gives the screensaver a visibly richer gas-giant system on every trip where one rolls, and those are common. #3 (reflection nebulae) is the cheapest deep-sky win — a single dict entry unlocks a whole new object class in `SkyFeatureLayer`.

After those, the natural direction is into surface variety, which Max prioritized explicitly. #4 + #5 are a paired investment: wiring `surfaceHistory` only pays off if the crater path reads it, so do them in the same session. Once those are in, #9 (impact rays) and #10 (maria) plug into the same uniforms and extend the surface dimension further with small per-feature additions. #8 is an independent parallel track that touches every rocky planet's base palette.

The remaining items are good second-session priorities. #13 in particular is worth tackling once the generator → sky wiring for component is established — it's the one entry that most clearly anchors "where am I in the galaxy" for a viewer who doesn't know the game. Skip hand-authoring known objects until procedural variety is maxed out; the 33 existing `KnownObjectProfiles` already cover the most photogenic deep-sky objects, and spending shader time on procedural variety has better variety-per-hour economics than hand-tuning one-off nebulae.
