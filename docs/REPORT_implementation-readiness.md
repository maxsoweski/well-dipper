# Well Dipper — Implementation Readiness Report

> Audit date: 2026-03-14
> Auditor: Claude (automated analysis of game bible, research docs, and source code)
> Source files: 36 JS files across src/, ~12,000 lines total

---

## A. IMPLEMENTED (Already Working in Code)

### A1. Core Rendering Pipeline
- **Dual-resolution rendering**: Starfield at full res, scene objects at low res (pixelScale 3), composited via alpha shader
- **Per-object Bayer dithering**: Fragment shaders on each planet/moon/star, not a screen filter
- **Color palette modes**: 9 post-process palettes (Full Color, Monochrome, Amber CRT, Green Phosphor, Blue Phosphor, Game Boy, CGA, Sepia, Virtual Boy, Inverted)
- **Retro fonts**: Pixelify Sans (titles), DotGothic16 (UI)
- Files: `src/rendering/RetroRenderer.js`, `src/rendering/shaders/DitherPass.js`, `src/style.css`

### A2. Star System Generation (Complete)
- **Spectral type weights**: All 7 types (OBAFGKM) with cinematic weighting (not astronomical)
- **Binary systems**: ~35% rate, mass ratio distribution (25/40/25/10), companion type derivation, barycentric orbits
- **Orbital zones**: Scorching, Inner, Habitable, Transition, Outer — all calculated from stellar luminosity via sqrt(L)
- **Zone boundaries**: HZ inner/outer, frost line — stored as first-class data in AU, scene units, and map units
- **System-level parameters**: Metallicity (Gaussian, clamped), Age (stored but unused), System Archetype (compact-rocky 30%, mixed 45%, spread-giant 25%)
- **Orbital spacing**: Log-normal (mu=0.55, sigma=0.25), min ratio 1.2, peas-in-a-pod correlation (60/40%), archetype shifts
- **Planet count**: Star-type ranges, ~8% empty systems, Gaussian distribution with archetype modifier
- **Fischer-Valenti metallicity scaling**: Gas giant probability proportional to 10^(2*[Fe/H])
- **Census verification**: 5000-system baseline documented (commit e6587d0)
- Files: `src/generation/StarSystemGenerator.js`, `src/generation/PlanetGenerator.js`

### A3. Planet Types (All 11 Natural + 7 Exotic/Civilized)
- **Natural types**: rocky, gas-giant, ice, lava, ocean, terrestrial, hot-jupiter, eyeball, venus, carbon, sub-neptune
- **Exotic/civilized types**: hex, shattered, crystal, fungal, machine, city-lights, ecumenopolis
- All have: color palettes (4-5 per type), map radius ranges, physical radius ranges (Earth radii), atmosphere/cloud/ring chances, noise parameters, axial tilt, rotation speed
- **Science-driven type selection**: `_pickType()` uses zone + star type + metallicity to assign types. Habitable types only in HZ. M/K dwarfs get eyeball default. Hot Jupiters ~1%.
- **Shaders**: Each type has a unique procedural surface shader in Planet.js (948 lines)
- Files: `src/generation/PlanetGenerator.js`, `src/objects/Planet.js`

### A4. Exotic/Civilized Overlay System
- **Three-layer post-processing pass** after natural generation:
  1. **Civilized**: city-lights (70%) / ecumenopolis (30%) on habitable planets. Star-type weighting (F/G best, O/B zero)
  2. **Exotic**: fungal (40%), hex (30%), machine (30%) — ~0.5% of systems. Fungal bloom (10% of fungal = multi-body). Zone restrictions enforced.
  3. **Geological**: crystal (inner/transition/outer, 1% per planet) and shattered (scorching/inner, 1% per planet) — independent of exotic limit
- Max 1 exotic/civilized per system; geological is independent
- File: `src/generation/ExoticOverlay.js`

### A5. Moons
- Per-planet moon counts by type (gas-giant up to 6, hot-jupiter 0, etc.)
- 5 moon types: captured, rocky, ice, volcanic, terrestrial
- Zone-aware type selection, size/orbit generation
- File: `src/generation/MoonGenerator.js`

### A6. Asteroid Belts
- ~55% of 3+ planet systems get a belt
- Placement logic: prefers gap before gas giant (like real solar system)
- File: `src/generation/AsteroidBeltGenerator.js`, `src/objects/AsteroidBelt.js`

### A7. Deep Sky Objects (Distant + Navigable)
- **DestinationPicker**: 85% star-system, 15% deep sky (spiral galaxy, elliptical galaxy, emission nebula, planetary nebula, globular cluster, open cluster)
- **Distant deep sky**: Spiral galaxies (logarithmic arms + scatter), elliptical galaxies (de Vaucouleurs profile), globular clusters (Plummer model)
- **Navigable deep sky**: Emission nebulae (volumetric gas + hot stars), planetary nebulae (shell + white dwarf), open clusters (flyable star groups)
- Files: `src/generation/GalaxyGenerator.js`, `src/generation/NebulaGenerator.js`, `src/generation/ClusterGenerator.js`, `src/generation/NavigableNebulaGenerator.js`, `src/generation/NavigableClusterGenerator.js`, `src/objects/Galaxy.js`, `src/objects/Nebula.js`, `src/objects/VolumetricNebula.js`

### A8. Warp Transition
- Four-phase system: FOLD (4s) -> ENTER (1.5s) -> HYPER (3s) -> EXIT (2s)
- Fold portal with star pinching, 3D geometric tunnel (ray-cylinder intersection), fizzing exit reveal
- System swap during HYPER phase (pre-generated during FOLD)
- File: `src/effects/WarpEffect.js`

### A9. Navigation & UI
- **System map minimap**: Top-down radar-style, 192px HUD overlay, rotates with camera yaw
- **Gravity well map**: 3D vertex-displaced contour, toggled with G key
- **Body info HUD**: Top-left popup with typewriter effect on body selection
- **Orbital overlay**: O key toggle for orbit lines
- **Settings panel**: Persistent localStorage, full configurable options
- Files: `src/ui/SystemMap.js`, `src/ui/GravityWellMap.js`, `src/ui/BodyInfo.js`, `src/ui/Settings.js`, `src/objects/OrbitLine.js`, `src/objects/GravityWell.js`

### A10. Camera & Autopilot
- **Camera controller**: Free-look orbit with body focus
- **Autopilot**: Cinematic flythrough tour of system bodies, auto-warp on tour completion
- **Idle timer**: Triggers autopilot after configurable timeout (default 5 min)
- **Deep sky linger**: Timer-based contemplation mode for distant objects (no orbit, just drift)
- Files: `src/camera/CameraController.js`, `src/auto/AutoNavigator.js`, `src/auto/FlythroughCamera.js`

### A11. Audio System
- **SoundEngine**: Web Audio API synthesized SFX (14 placeholder sounds — UI, autopilot, warp, title)
- **MusicManager**: Track loading, looping, crossfading, ducking. Expects OGG/MP3 at `/public/assets/music/`
- **Sound test panel**: Press T to preview all effects and tracks
- Files: `src/audio/SoundEngine.js`, `src/audio/MusicManager.js`

### A12. Title Screen
- Full title screen with auto-dismiss timer (configurable, default 30s)
- Dismiss SFX on interaction
- File: `src/main.js`

### A13. Procedural Names
- **System names**: ~30% catalog (HD, GJ, Kepler, etc.) + ~70% pronounceable (syllable-based + space-y suffixes)
- **Star names**: System name + A/B suffix for binaries
- **Planet names**: 55% letter suffix (IAU), 25% unique, 10% numeral, 10% descriptive
- **Moon names**: 40% Roman numeral, 35% mythological pool, 25% generated
- All deterministic from seed
- File: `src/generation/NameGenerator.js`

### A14. Ship Model Pipeline (Loader Only)
- GLTFLoader with manifest.json, caching, archetype-based loading
- Manifest exists but is empty (all archetypes have 0 models)
- Directory structure ready: `public/assets/ships/{fighters,shuttles,freighters,cruisers,capitals,explorers}/`
- File: `src/objects/ShipLoader.js`

### A15. Scale System
- Dual-scale architecture: physical AU-based units for generation, exaggerated map units for display
- Conversion constants: AU_TO_SCENE, solarRadiiToScene, earthRadiiToScene, auToScene
- File: `src/core/ScaleConstants.js`

### A16. Seeded Random
- Alea-based PRNG with `.child()` for independent sub-streams
- Supports: float, int, range, chance, pick, gaussian, gaussianClamped, logNormal
- File: `src/generation/SeededRandom.js`

---

## B. READY TO IMPLEMENT (Research Done, Approach Clear)

### B1. Galaxy-Scale Seed Architecture
**Complexity: Large**
**Dependencies: None (additive layer on top of existing system generation)**

The research is thorough and code-ready:
- `RESEARCH_galaxy-generation.md` has complete implementations for: logarithmic spiral arms, density wave approach (Beltoforion), exponential disk + de Vaucouleurs bulge + power-law halo, seed hierarchy (galaxy -> sector -> system -> planet), spatial hashing for nearby star lookup, LRU sector cache
- `RESEARCH_star-population-synthesis.md` has: Kroupa IMF sampling code, spectral type by region tables, metallicity gradients by galactic position, age distributions per component, binary frequency by type and region, component density model with spiral arm detection
- Hash function (splitmix64-based) and sector coordinate system are provided with working JavaScript
- Current system generation works unchanged at bottom of seed chain

What remains is assembling these pieces into a `GalaxyMap` class and wiring it into the warp system so that system seeds derive from galactic coordinates instead of random strings.

### B2. Metallicity/Age from Galactic Position
**Complexity: Small** (once B1 exists)
**Dependencies: B1 (Galaxy seed architecture)**

The bible notes metallicity is currently randomized but should later derive from galactic position. The research provides exact formulas:
- Disk gradient: `[Fe/H](R) = -0.06 * (R_kpc - 8.0)`
- Vertical gradient: `[Fe/H](z) -= 0.3 * |z_kpc|`
- Bulge: bimodal (60% at +0.3, 40% at -0.3)
- Halo: `[Fe/H] = -1.2 - 0.02 * max(0, R - 15)`

Currently `StarSystemGenerator` takes metallicity from a Gaussian draw. Replacing that with a position-based calculation is a small change once galactic coordinates exist.

### B3. Star Age Effects on Generation
**Complexity: Medium**
**Dependencies: None**

`RESEARCH_zone-variability.md` Section 4 provides clear age-effect rules:
- < 100 Myr: no mature planets (debris disk / forming state)
- 100-500 Myr: M-dwarf HZ planets desiccated (pre-MS luminosity)
- 1-5 Gyr: peak habitability
- 5-10 Gyr: G-star HZ migrating outward
- > 10 Gyr: only M/K dwarfs on main sequence

`ageGyr` is already generated and stored in system data. Implementation means adding age checks to `_pickType()` and potentially adjusting zone boundaries based on age. The research gives specific rules; the code changes are moderate.

### B4. Geological Exotics in Zone-Based Generation
**Complexity: Small**
**Dependencies: None**

The bible says crystal and shattered are "natural geological anomalies... a natural outcome of the system, not bolted on." Currently they're handled in `ExoticOverlay._applyGeological()` as a post-processing pass at ~1% per planet in the right zone. This already works correctly per the bible's spec. The bible's phrasing about "part of normal zone generation" may just be a design note about their lore, not a request to move them to `_pickType()`. Current implementation matches the stated zone restrictions and rarity. **No change needed unless Max wants them moved.**

### B5. Fungal Bloom on Moons
**Complexity: Medium**
**Dependencies: Moon overlay system (not yet designed)**

The bible says fungal can "also appear on gas giant moons (subsurface ocean heating, Europa-style)." The current `ExoticOverlay._applyFungal()` only operates on planets. Extending to moons requires modifying the overlay to also inspect `planet.moons[]` and swap moon types. The moon data structure supports type swapping. Needs a `MoonGenerator.generate()` call with a forced type, similar to how `_swapPlanetType` works.

### B6. Machine Planet Exotic Orbit
**Complexity: Small**
**Dependencies: None**

The bible specifies machine planets should have "long elliptical, inclined relative to planetary plane" orbits. Currently `_applyMachine()` just swaps a planet's type without changing its orbit. Adding orbital eccentricity and inclination to the planet data (and rendering the orbit line accordingly) would be a small addition.

### B7. CRT Scanline Filter
**Complexity: Small**
**Dependencies: None**

Listed in the bible as "Phase 11 remaining item." The research doc (`RESEARCH_megastructures-and-nav-computer.md`) provides a complete CRT shader outline with GLSL pseudocode for scan lines, barrel distortion, phosphor glow, flicker, vignette, and chromatic aberration. Multiple Three.js CRT shader libraries are referenced. This could be added as a post-processing pass in `RetroRenderer.js`.

### B8. Body Info HUD for Exotic/Civilized Types
**Complexity: Small**
**Dependencies: None**

`BodyInfo.js` has `PLANET_TYPE_NAMES` mapping, but only includes 11 natural types. Missing: hex, shattered, crystal, fungal, machine, city-lights, ecumenopolis. Simple dictionary addition.

---

## C. NEEDS MORE RESEARCH (Approach Not Clear Enough to Code)

### C1. Megastructure Rendering
**Research needed:**
- How to render a Dyson swarm efficiently in Three.js with InstancedMesh while maintaining retro aesthetic at multiple LOD levels?
- What's the performance budget for hundreds of instanced collectors around a star, given the existing dithering pipeline?
- How should Dyson swarm affect the star shader (dimming, flickering)? Need to prototype the star shader modification.
- Ring habitats (Banks Orbital, Halo, Niven Ringworld): what segment count / tube ratio looks good at the game's pixel resolution? Need visual testing.
- Matrioshka Brain nested shells: how many concentric spheres can render without z-fighting at low poly counts?
- Shkadov Thruster mirror: hemisphere geometry with reflective material — how to fake "second light source" from reflection?

The research doc (`RESEARCH_megastructures-and-nav-computer.md`) provides excellent conceptual design and Three.js geometry suggestions, but no prototype code has been tested. Each megastructure type needs a rendering prototype to validate the visual approach before committing to implementation.

### C2. Megastructure Spawning System
**Research needed:**
- How should megastructures interact with the existing ExoticOverlay system? They are rarer than exotics (1 in 200-3000) — should they be a Layer 0 (checked before civilization) or Layer 4 (checked after)?
- Should a system with a megastructure also have normal planets? (Dyson swarm: yes. Alderson disk: replaces all planets. Ringworld: replaces HZ.)
- The rarity table in the research doc lists 13 megastructure types with frequencies from 1-in-50 to 1-in-3000. Which subset to implement first?
- How should megastructures affect the system map, body info HUD, and warp target selection?

### C3. Navigation Computer Implementation
**Research needed:**
- The research doc recommends Option B (render-to-texture via 2D canvas + CRT shader). Before implementing:
  - What's the minimum viable feature set for v1? (System map view only? Or also body info panels and warp target selection?)
  - How does keyboard-only interaction work with the existing control scheme? The Tab key is suggested but needs to not conflict.
  - Text layout on 2D canvas: what library or approach for the dense text panels? Manual `fillText()` calls, or a simple text layout engine?
  - Boot sequence animation: how long, how complex?
- The research provides visual references (Alien, Duskers, Obra Dinn) and color schemes (green/amber/blue phosphor) but no wireframes or layout mockups.

### C4. Gap-Giant Association (Two-Pass Generation)
**Research needed:**
- The bible lists this as "deferred Phase 6." The concept: outer giant planets sculpt inner system architecture (create gaps). This requires generating outer planets first, then filling inner orbits around the gaps.
- Current generation is single-pass (inner to outer). Switching to two-pass requires architectural changes to `StarSystemGenerator.generate()`.
- How significant is the visual/gameplay impact? Would players notice the difference vs. the current peas-in-a-pod approach?

---

## D. NEEDS DESIGN DECISIONS FROM MAX (Blocked on Human Input)

### D1. Civilized Planet Spawning Rates
**Status: Bible says "TBD"**
The current `ExoticOverlay._applyCivilized()` uses per-planet chances of 2-6% depending on star type, applied to each habitable planet. The bible estimates ~0.4% of all systems should have civilization. Current rates need census verification. **Max needs to confirm:** Are current rates producing the right "feel"? Should civilization be rarer or more common?

### D2. Navigation Computer UI Layout
**Status: Bible says "Design Needed"**
Research provides references, color schemes, interaction model, and implementation approach. But no layout has been designed. **Max needs to decide:**
- Full-screen overlay or windowed panel?
- Green, amber, or blue phosphor? (Or player-selectable?)
- What info is essential for v1 vs. nice-to-have?
- Should it replace all current map overlays (SystemMap, GravityWellMap, orbital overlay) or coexist?

### D3. Megastructure Visual Design Selection
**Status: Research complete, selection needed**
The research doc describes 13 megastructure types with visual concepts and Three.js approaches. **Max needs to pick:**
- Which 3-5 megastructures to implement first?
- Rarity tier preferences (the research suggests specific frequencies — are they right?)
- Should O'Neill cylinders (1-in-50, tied to civilized planets) be implemented as visible geometry or just a UI indicator?

### D4. Ship Models and Behavior
**Status: Pipeline ready, no assets or behavior code**
- ShipLoader.js works, manifest structure exists, directories exist — but 0 models
- ShipManager (state machine: CRUISING -> APPROACH -> ESCORT -> DEPART) not started
- **Max needs to decide:**
  - Are ship models coming from Blender MCP? When?
  - What's the priority for ship encounters vs. other features?
  - The ~1 in 3 systems encounter rate — is that still the target?

### D5. Music Tracks
**Status: Waiting on Max's brother Christian**
- MusicManager.js is fully implemented (loading, looping, crossfading, ducking)
- Music guide doc exists (`Well-Dipper-Music-Guide.docx`)
- `/public/assets/music/` directory exists with only a `.gitkeep`
- 7 tracks defined (title, explore, explore-alt, deepsky, warp-charge, hyperspace, arrival)
- **Blocked on:** Christian delivering the tracks

### D6. Seed Sharing & Screenshot Mode
**Status: Bible mentions it, no design**
- "Share a seed string so others can visit the same system. Screenshot mode with seed overlay."
- **Max needs to decide:** What format? Copy-to-clipboard? URL parameter? QR code? What info appears in the screenshot overlay?

### D7. Discovery Log / Exploration Score
**Status: Bible placeholder, no design**
- "Track what you've found" + "Points for variety" — localStorage-based persistence
- **Max needs to decide:** What data to track? What UI to show it? Is this a priority?

### D8. On-Foot Exploration MVP Scope
**Status: Bible says "Design Needed"**
- What's the MVP interior? One room? One station type?
- First-person controls within the retro aesthetic
- **Max needs to decide:** Is this worth scoping now, or is it truly far-future?

---

## E. FAR FUTURE / ASPIRATIONAL

### E1. Galaxy Map (Higher-Level Navigation)
Full galaxy visualization where you see your position, explored vs. unexplored regions, and pick destinations at the galactic scale. Depends on B1 (galaxy seed architecture) being built first, plus significant UI/rendering work for the galaxy view itself.

### E2. Space Stations
Orbital structures around planets or at Lagrange points. No design, no assets. Depends on ship pipeline and potentially on-foot exploration.

### E3. Surface Bases
Ground installations on moons/planets. Tied to civilized planet overlay. No design, no assets.

### E4. Anomalous Structures
Derelict megaships, ancient ruins, signal sources, unidentified objects. Loosely described in the bible. Depends on megastructure rendering pipeline and potentially the ship pipeline for derelicts.

### E5. On-Foot Exploration
Landing at stations, first-person movement in small interiors. The bible explicitly calls this "Long-term." Requires first-person controls, interior modeling, narrative systems. Massive scope expansion.

### E6. Artificial Moon (Exotic Subtype)
"Small construct orbiting a gas giant or large planet." The bible notes this "needs moon overlay system." Depends on extending the exotic overlay to operate on moons, not just planets.

### E7. Real Music Replacement of Placeholder SFX
All 14 SFX in SoundEngine.js are Web Audio API placeholders. Eventually these should be replaced with designed sound effects. Lower priority than music tracks.

### E8. Explore-Alt Track
The alternate exploration music track is marked LOW priority in the bible. Depends on Christian's work and is not needed for MVP.

---

## Summary Statistics

| Category | Count |
|----------|-------|
| A. Implemented | 16 major systems |
| B. Ready to implement | 8 features |
| C. Needs more research | 4 topics |
| D. Needs Max's decisions | 8 items |
| E. Far future | 8 items |

### Biggest Wins Available (Ready to implement, high impact)
1. **B7 — CRT Scanline Filter** (Small, no dependencies) — Phase 11 item, research complete
2. **B8 — Body Info for exotic types** (Small, no dependencies) — Missing dictionary entries
3. **B3 — Star age effects** (Medium, no dependencies) — Age data already generated, just not used
4. **B1 — Galaxy seed architecture** (Large, but research is thorough) — The foundation for galactic-scale play

### Biggest Blockers
1. **D5 — Music tracks** — Waiting on Christian. MusicManager is ready.
2. **D2/C3 — Navigation computer** — Both design decisions AND research needed
3. **D3/C1 — Megastructures** — Design selection needed, then rendering prototypes

---

*Generated 2026-03-14 from analysis of game bible, 4 research docs, and 36 source files.*
