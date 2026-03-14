# Well Dipper — Game Bible

> The single source of truth for all design decisions, game systems, and aesthetic rules.
> Every feature, tweak, and system should trace back to something in this document.
> If it's not in the bible, it hasn't been decided yet.

---

## 1. Vision

### What Is Well Dipper?
A meditative retro space screensaver that doubles as an exploration game. You drift through procedurally generated star systems, warp between them, and encounter an infinite universe that feels real, varied, and occasionally surprising.

The screensaver is the MVP. The game systems grow out of it.

### Core Experience
- **Drift.** You float through space. The camera moves gently. You watch planets orbit, stars glow, nebulae swirl.
- **Discover.** Every system is different. Finding a terrestrial world or an alien megastructure is rare and meaningful.
- **Warp.** Click a star in the sky, hit spacebar, watch the fold animation, arrive somewhere new. Forever.

### Name Origin
"Well Dipper" = dipping between gravity wells.

---

## 2. Aesthetic

### Era & Vibe
Late-90s PC / PS1 / Saturn era. Low-poly geometry, posterized colors, Bayer dithering, pixelated upscaling. The feeling of early 3D space games — Frontier, Starglider, Galaxy on Fire — but meditative instead of frantic.

### What We Do
- Per-object Bayer dithering in fragment shaders (not a screen filter)
- Low render resolution (pixelScale 3 by default, configurable)
- Posterized color palettes
- Retro fonts (Pixelify Sans for titles, DotGothic16 for UI)
- Dual-resolution rendering: starfield at full res, scene objects at low res

### What We Don't Do
- **No vertex snapping/jitter.** Tried it, rejected it as annoying. Vibe without the wobble.
- **No smooth modern rendering.** No PBR, no bloom (beyond star glow), no anti-aliasing.
- **No pixel-perfect retro emulation.** We're inspired by the era, not replicating a specific console.

### Color Palette Modes
9 post-process palette options: Full Color (default), Monochrome, Amber CRT, Green Phosphor, Blue Phosphor, Game Boy, CGA, Sepia, Virtual Boy, Inverted.

### Sound
- Synthesized placeholder SFX (Web Audio API)
- Music system ready (MusicManager with crossfading, ducking)
- Waiting on real tracks from Max's brother

---

## 3. Universe Structure

### The Galaxy (future)
Not yet implemented. When implemented:
- A master seed defines the entire galaxy
- Each star's position in the galaxy derives a system seed
- Same master seed → same galaxy, every time
- Current approach (random seed per system) works identically at the system level — adding a galaxy layer on top is additive, not a rewrite

### Deep Sky Objects
15% of warps go to non-star-system destinations:
- Spiral galaxies, elliptical galaxies
- Emission nebulae, planetary nebulae
- Globular clusters, open clusters

These are scenic destinations — no planets, no zones, just beautiful objects to orbit.

---

## 4. Star Systems

### Design Principle
**Every star system should feel like a real place, not a procedural template.**

This means:
- Systems vary in how many planets they have, where those planets are, and what zones exist
- Star type, age, and luminosity determine what kinds of planets are possible
- Some systems are sparse (2 planets, all outer). Some are rich (8 planets across all zones).
- Not every star has a habitable zone with planets in it
- Zone boundaries vary naturally based on stellar properties

### Stars

#### Spectral Types
Weighted for visual variety (not astronomical accuracy):

| Type | Weight | Color | Notes |
|------|--------|-------|-------|
| M (Red dwarf) | 18% | Red-orange | Most common IRL, toned down for variety |
| K (Orange) | 20% | Orange | Warm, stable |
| G (Sun-like) | 20% | Yellow-white | Familiar |
| F (White-yellow) | 16% | White-yellow | Bright, many planets |
| A (Blue-white) | 13% | Blue-white | Dramatic |
| B (Blue) | 8% | Blue | Massive, spectacular |
| O (Blue giant) | 5% | Deep blue | Rare and stunning |

#### Binary Systems
~35% of systems are binary. Two stars orbit their barycenter, planets in circumbinary (P-type) orbits. Mass ratio distribution: 25% twins, 40% similar, 25% unequal, 10% extreme.

### Orbital Zones

Zones are defined by stellar luminosity and scale with √L:

| Zone | Boundary | What Forms Here |
|------|----------|-----------------|
| **Scorching** | < 0.4× HZ inner | Lava, rocky, carbon, hot-jupiter. Atmospheres stripped. |
| **Inner** | 0.4× HZ inner → HZ inner | Venus, rocky, carbon, sub-neptune, lava. Too hot for liquid water. |
| **Habitable (HZ)** | HZ inner → HZ outer | Rocky, sub-neptune, ocean, terrestrial, eyeball, venus, ice. Where liquid water is possible. |
| **Transition** | HZ outer → frost line | Sub-neptune, ice, rocky, gas-giant, carbon. Cooling rapidly, water freezing. |
| **Outer** | Beyond frost line | Gas-giant, ice, sub-neptune, rocky, carbon. Gas giant formation zone. |

**Zone boundaries (in AU):**
- HZ inner = 0.95 × √L
- HZ outer = 1.37 × √L
- Frost line = 4.85 × √L

**Zones are first-class data.** They are stored in system data and available for future UI (zone rings on maps, scanner readouts, etc.).

### System-Level Parameters

**Metallicity** ([Fe/H] relative to Sun):
- Gaussian centered on 0.0, stddev 0.2, clamped to [-1.0, +0.5]
- Drives gas giant probability via Fischer-Valenti: P(giant) ∝ 10^(2×[Fe/H])
- Metal-poor ([Fe/H] < -0.15): ~6% have gas giants
- Solar ([Fe/H] ≈ 0): ~19% have gas giants
- Metal-rich ([Fe/H] > +0.15): ~40% have gas giants
- Later: derived from galactic position instead of randomized

**Age** (Gyr):
- Gaussian centered on 4.5, stddev 2.5, clamped to [0.1, 12.0]
- Stored as data — not yet used in generation
- Future: M-dwarf pre-MS atmosphere stripping, HZ migration

**System Archetype** (Weiss et al. 2018 "peas in a pod"):
- `compact-rocky` (30%): tighter spacing, +1 planet, smaller sizes
- `mixed` (45%): default, no bias
- `spread-giant` (25%): wider spacing, -1 planet, larger sizes
- Drives both orbital spacing and planet type bias

### Planet Count
- Determined by star type: O/B get 2-5, F/G get 4-8, K gets 3-7, M gets 3-6
- ~8% chance of an empty system (no planets at all)
- Gaussian distribution centered on mid-range, shifted by archetype
- Result: most systems 4-6 planets, 1-2 planet systems are rare (~7%), 8 planet systems rare (~6%)

### Orbital Spacing
- Log-normal distribution per orbit (Steffen & Hwang 2015): μ=0.55, σ=0.25, median ratio ~1.73
- Hard minimum ratio: 1.2 (nothing closer in Kepler data)
- Peas-in-a-pod correlation: 60% of previous spacing + 40% fresh draw
- Archetype shifts μ by ±0.10
- Max orbit clamp at 50×√luminosity AU

### TODO: Zone Variability (needs research)
- How does star age affect zone boundaries and planet formation?
- Young systems: protoplanetary disk still settling, fewer distinct planets?
- Old M-dwarfs: HZ migrates outward over billions of years?
- Planet clustering: some systems have most planets bunched in 1-2 zones
- Empty zones: not every zone needs planets (especially scorching and HZ)
- Research: Kepler data on planet multiplicity and spacing patterns

---

## 5. Natural Planet Types

### The Decision Tree
Planet types are determined by a science-driven decision tree in `PlanetGenerator._pickType()`. Each zone has its own probability distribution. The key rules:

1. **Terrestrial and ocean planets ONLY appear in the habitable zone.** Finding one is a discovery.
2. **Sub-Neptunes are the most common planet type** (Kepler data). They appear in every zone except scorching.
3. **Gas giants concentrate at/beyond the frost line** (core accretion model).
4. **Hot Jupiters are rare** (~1% of systems) — migrated gas giants in scorching orbits.
5. **Eyeball planets** (tidally locked habitable) are the default habitable type for M/K dwarfs.

### System-Level Rarity Targets

These are the intended rates, verified by 5000-system census:

| Type | % of systems | Notes |
|------|-------------|-------|
| Terrestrial (life-bearing) | ~3% | Green continents + blue oceans. The holy grail. |
| Ocean (water world) | ~6% | Deep global ocean, no visible land. |
| Eyeball (tidally locked habitable) | ~2% | Concentric climate rings. M/K dwarf default. |
| Any habitable | ~8-10% | Combined terrestrial + ocean + eyeball |
| Gas giant (any system) | ~20% | Concentrated near frost line |
| Hot Jupiter | ~1% | Migrated giant in scorching zone |

### Type Catalog

| Type | Description | Zones | Visual |
|------|-------------|-------|--------|
| **rocky** | Barren, cratered — Mars, Mercury, Moon | All except scorching-rare | Brown/grey, cratered |
| **gas-giant** | Horizontal bands — Jupiter, Saturn | Transition, outer | Banded, large |
| **ice** | Pale blues/whites, cracked — Europa | HZ (edge), transition, outer | White-blue, fractured |
| **lava** | Dark rock with glowing cracks — Io | Scorching, inner | Dark + orange/red glow |
| **ocean** | Deep water worlds | HZ only | Blue/teal, no land |
| **terrestrial** | Life-bearing — oceans + green continents | HZ only | Blue + green, clouds |
| **hot-jupiter** | Tidally locked gas giant — glowing day side | Scorching only | Dark/bright hemispheres |
| **eyeball** | Tidally locked habitable — climate rings | HZ only (M/K stars mainly) | Concentric rings |
| **venus** | Thick cloud blanket — greenhouse | Inner, HZ (inner edge) | Cream/yellow uniform |
| **carbon** | Near-black with diamond glints | Scorching, inner, transition, outer | Very dark, glints |
| **sub-neptune** | Pale hazy mini-Neptune | Inner through outer | Hazy, mid-sized |

### Science Sources
- **Eta-Earth:** Bryson et al. 2020 (Kepler DR25) — 37-60% of G stars have rocky HZ planet
- **Most common planet:** Sub-Neptune (Fressin et al. 2013, Kepler)
- **Surface water fraction:** ~10-25% of HZ rocky planets (Forget 2012)
- **Gas giant occurrence:** 15-20% of FGK stars, 3-5% of M dwarfs (Cumming 2008, Mayor 2011)
- **Hot Jupiters:** ~0.5-1% of all systems
- **Tidal locking:** Expected for virtually all M-dwarf HZ planets (Barnes 2017)
- **Eyeball climate:** AAS Nova 2024 — varied outcomes for K/M dwarf HZ planets

---

## 6. Overlay Systems (Exotic, Civilized, Megastructures)

These systems run AFTER natural planet generation. They modify or add to the base system.
They are NOT part of the natural decision tree.

### 6A. Civilized Planets (Human-Like Civilization)

**Concept:** Civilization is an overlay on habitable planets. A planet must first be terrestrial, ocean, or eyeball — then a separate roll determines if civilization developed there.

**Decision chain:**
1. System generates naturally (most have no habitable planets)
2. If a habitable planet exists (terrestrial/ocean/eyeball), roll for civilization
3. Civilization probability depends on star type (stable, long-lived stars favor it)
4. If civilization hits, the planet type changes to city-lights or ecumenopolis

**Types:**
- **city-lights** — Earth-like with city lights on the night side. Same terrain as base planet, but with light clusters visible in shadow. ~70% of civilized rolls.
- **ecumenopolis** — Coruscant-like mega-city. Entire surface urbanized. ~30% of civilized rolls. Rarer because it requires far more advanced civilization.

**Rarity target:** TBD — needs to chain off the ~8% habitable rate. If 5% of habitable planets have civilization, that's ~0.4% of all systems. Feels right for a game — genuinely rare.

**Star type weighting:**
- F/G stars: best chance (stable, long-lived, right luminosity)
- K stars: good chance (very long-lived, stable)
- A stars: marginal (short-lived for complex life)
- M stars: low (habitable but harsh — flares, tidal locking)
- O/B stars: zero (too short-lived for civilization to develop)

### 6B. Exotic Planets (Alien Anomalies)

**Concept:** Rare alien phenomena that don't follow normal planetary science. Three subcategories with different spawning logic.

**Overall rarity target:** ~1 in 200 systems (0.5%) contains any exotic. Max 1 exotic per system.

#### Biological Exotic: Fungal
- **What:** Dark surface with bioluminescent glow-spot clusters. Alien life, but not intelligent.
- **Where:** Primarily HZ planets (overlay on rocky/sub-neptune). Can also appear on gas giant moons (subsurface ocean heating, Europa-style).
- **Fungal bloom (10% of fungal systems):** Hyper-virulent strain colonizes multiple bodies. Any planet with an atmosphere OR any rocky body that could be terraformed by panspermia gets fungal overlay. 2-4 bodies affected.
- **Normal fungal (90%):** Single planet or moon.

#### Geological Exotic: Crystal, Shattered
These are natural geological anomalies — not alien, just weird geology. They appear as part of normal zone generation at very low rates, not as a separate overlay. They're a natural outcome of the system, not bolted on.

- **crystal** — Angular Voronoi facets, gemstone colors. Extreme mineral formation under pressure or slow crystallization. Appears in inner, transition, and outer zones.
- **shattered** — Dark rock with wide fracture lines, breaking apart. Tidal/thermal stress near stars or past collisions. Appears in scorching and inner zones.

#### Artificial Exotic: Hex, Machine, Megastructures
Alien-built objects. Not natural planets. Multiple placement strategies depending on type.

- **hex** — Tessellated hexagonal megastructure. Replaces a planet in inner/scorching zone (energy harvesting near star). Could also appear as a standalone object.
- **machine** — Rigid grid, dark metal with circuit traces. Von Neumann probe grown to planet size. Exotic orbit: long elliptical, inclined relative to planetary plane. Crosses multiple zones.
- **artificial moon** — Small construct orbiting a gas giant or large planet. Hidden/sheltered. (Future — needs moon overlay system.)

### 6C. Megastructures (Future)

Large-scale alien constructs that aren't planets. These are their own object types, not planet overlays.

| Type | Description | Placement | Visual Concept |
|------|-------------|-----------|---------------|
| **Dyson swarm** | Partial shell/swarm around star | Envelops star, affects star brightness/appearance | Flickering star, visible structure on approach |
| **Ring habitat** | Halo/Banks orbital — massive ring | Specific orbital radius, like an asteroid belt but artificial | Thin bright ring with structure |
| **Derelict megaship** | Enormous abandoned vessel | Unusual orbit (inclined, eccentric), not in a planet slot | Geometric object, dark, occasional lights |

**Rarity:** Even rarer than exotics. Maybe 1 in 500-1000 systems. These are the ultimate discoveries.

**Implementation notes:**
- Dyson swarm affects the star shader (dimming, flickering, partial occlusion)
- Ring habitats could reuse asteroid belt rendering with different geometry
- Derelict ships could reuse the ship pipeline with massive scale

---

## 7. Navigation & UI

### Current State
- **System map minimap** (top-down radar, 192px HUD overlay)
- **Gravity well map** (3D vertex-displaced contour, toggled with G)
- **Body info HUD** (top-left popup on selection)
- **Orbital overlay** (O key, orbit lines)

### Future Vision: Navigation Computer

**Replace all current map overlays** with a single toggleable screen that looks like a retro CRT navigation computer. Think: the ship's onboard computer displaying a schematic of the star system.

**Aesthetic:** Old-school computer simulation on a CRT display. Green/amber phosphor lines, scanlines, vector-drawn orbits. Like looking at a navigation terminal from the 80s.

**Features (planned):**
- Interactive system map (zoom, pan, click to select bodies)
- Zone visualization (concentric rings showing scorching/inner/HZ/transition/outer)
- Body information panels (type, radius, features)
- Warp target selection from the map
- Toggle on/off as a full overlay or separate screen

**Replaces:** GravityWell minimap, orbital minimap, orbital overlay. The real-time 3D view IS the "real thing" — the navigation computer is the abstraction layer.

---

## 8. Technology (Structures, Vehicles, Habitation)

Everything built by intelligent beings — human or alien. Ships, stations, bases, megastructures.

### 8A. Ships (Pipeline Ready, Not Active)

#### Ship Archetypes
6 types exported from Blender as .glb:
- **Fighters** (2-6 near planets)
- **Shuttles** (1-3 between planets)
- **Freighters** (1-2 on long routes)
- **Cruisers** (1-2 patrol)
- **Capitals** (0-1, 20% of systems, deep space)
- **Explorers** (0-1, outer system)

#### Ship Behavior (ShipManager — not started)
State machine: CRUISING → APPROACH → ESCORT → DEPART → CRUISING
Encounters: ~1 in 3 systems has a ship visit you during orbit.

### 8B. Space Stations (Future)
Orbital structures around planets or at Lagrange points. Could range from small outposts to large rotating habitats. Docking possible for on-foot exploration (see §8E).

### 8C. Bases (Future)
Surface installations on moons or planets. Landing pads, habitation domes, mining facilities. Tied to civilized planet overlay — a city-lights world might have visible bases from orbit.

### 8D. Anomalous Structures (Future)
Objects that don't fit neatly into natural or civilized categories:
- Derelict megaships (see §6C)
- Ancient alien ruins on moons/planets
- Signal sources (beacons, probes)
- Unidentified objects in unusual orbits

### 8E. On-Foot Exploration (Future — Long-term)
**Minimum viable version:** Land at a space station, exit ship, walk around a basic interior environment. First-person movement in a small man-made space.

**What this enables:**
- Sense of scale (you're a person in this universe, not just a camera)
- Narrative hooks (logs, terminals, environmental storytelling)
- Break from the meditative drift — moments of intimate scale

**Design constraints:**
- Must work with the retro aesthetic (low-poly interiors, dithered)
- Should feel like a natural extension, not a different game
- Start extremely small — one room, one station type

---

## 9. Game Systems (Future)

These are placeholder sections for systems that will be designed and implemented later.

### Discovery Log
Track what you've found: planet types seen, star types visited, exotics discovered. Persistent across sessions (localStorage).

### Exploration Score
Points for variety: new planet types, rare finds (terrestrial, exotic, megastructure), deep sky visits.

### Procedural Names
Star systems and planets get generated names. Style TBD — scientific catalog numbers? Fantasy names? Mix?

### Seed Sharing
Share a seed string so others can visit the same system. Screenshot mode with seed overlay.

### Galaxy Map
Higher-level navigation. See your position in the galaxy, pick destinations, see explored vs unexplored regions.

---

## 10. Technical Foundation

### Stack
Vite + Three.js (vanilla JS, no framework)

### Key Architecture Decisions
- **Data-first generation:** Generators produce plain JS objects, no Three.js dependency. Meshes built separately.
- **Deterministic seeds:** Same seed → identical system. `.child()` creates independent sub-streams.
- **Per-object dithering:** Bayer dithering in each object's fragment shader, not a screen filter.
- **Dual-resolution rendering:** Scene at low res, starfield at full res, composited with alpha-based shader.

### File Structure
```
src/
  main.js                    — Entry point, scene, animation loop
  objects/                   — Three.js renderers (Planet, Moon, Star, etc.)
  generation/                — Data generators (PlanetGenerator, StarSystemGenerator, etc.)
  auto/                      — Autopilot and flythrough camera
  effects/                   — Warp transition
  audio/                     — Sound engine and music manager
  camera/                    — Camera controller
  rendering/                 — RetroRenderer and shaders
  ui/                        — Settings, BodyInfo
```

---

## 11. Inspirations

### Game Systems
| Source | What we draw from it |
|--------|---------------------|
| **No Man's Sky** | Exotic biome rarity system, star-type weighting for rare planets, the feeling of discovery when you find something unusual. Fungal bloom concept inspired by NMS exotic biomes. |
| **Elite Dangerous** | Realistic planet distribution (~1-5% habitable systems). Stellar forge procedural generation. The sense that space is mostly empty and finding life matters. |
| **Space Engine** | Scientific accuracy for star/planet distribution. Galaxy-scale procedural generation with regional variation (spiral arms, bulge, halo). Zone variability research. |
| **Minecraft** | Seed-based determinism. The entire world exists implicitly in the seed — you're discovering it, not generating it. Chunk/region loading model. |
| **Frontier: Elite II** | Newtonian flight, realistic scale, the loneliness of deep space. 1990s aesthetic inspiration. |

### Science
| Source | What it informs |
|--------|----------------|
| **Kepler/TESS missions** | Planet occurrence rates by type and orbital distance. Sub-Neptune dominance. Eta-Earth estimates. |
| **Bryson et al. 2020** | ~37-60% of Sun-like stars have rocky HZ planet |
| **Fressin et al. 2013** | Planet size distribution — sub-Neptunes most common |
| **Cumming et al. 2008 / Mayor et al. 2011** | Gas giant occurrence: 15-20% of FGK, 3-5% of M |
| **Forget 2012** | ~10-25% of HZ rocky planets have surface liquid water |
| **Barnes 2017** | Tidal locking for M-dwarf HZ planets → eyeball worlds |
| **Hertzsprung-Russell diagram** | Star classification, luminosity-temperature relationship, stellar evolution |
| **Core accretion model** | Gas giants form at/beyond frost line |

### Aesthetic
| Source | What it informs |
|--------|----------------|
| **PS1 / Saturn / N64 era** | Low-poly geometry, posterized colors, the feeling of early 3D |
| **Bayer dithering** | Per-object dithering pattern, retro rendering |
| **CRT displays** | Navigation computer UI concept, phosphor glow, scanlines |
| **80s sci-fi computer interfaces** | System map aesthetic — vector lines, amber/green text, radar-style displays |
| **Star Trek LCARS** | Inspiration for information layout (not the specific aesthetic) |

---

## 12. Galaxy-Scale Generation (Research Phase)

### Concept
When implemented, the galaxy is a deterministic structure derived from a master seed. Your position in the galaxy affects what kinds of systems you encounter.

### Regional Variation (needs research)
| Region | Expected characteristics |
|--------|------------------------|
| **Spiral arm** | Higher star density, more young stars (O/B/A), more nebulae, active star formation |
| **Inter-arm gap** | Lower density, older stars (K/M dominant), fewer nebulae |
| **Galactic bulge** | Very high density, old metal-rich stars, more close binaries |
| **Galactic halo** | Very low density, ancient metal-poor stars, globular clusters |
| **Near nebulae** | Young systems, protoplanetary disks, fewer mature planetary systems |
| **Galactic fringe** | Low metallicity, fewer rocky planets (less heavy elements to form them) |

### Key Variables for System Generation
Star type, age, metallicity, binary frequency, planet count, and planet composition should all vary based on galactic position. Space Engine has already modeled this — their approach is a primary research target.

### Seed Architecture
```
Master seed
  → Galaxy structure (arm positions, bulge, halo)
    → Region seeds (sectors/chunks of space)
      → Star position + system seed per star
        → System generation (what we have now)
```

Current system generation works unchanged at the bottom of this chain. Galaxy is an additive layer.

---

## 13. Open Questions & Research Needed

### Active Research
- [ ] Zone variability by star type and age — how to make systems feel less template-stamped
- [ ] Planet clustering patterns — Kepler data on how planets bunch up in real systems
- [ ] Galactic regional variation — how star/planet populations differ across a galaxy
- [ ] Space Engine's procedural generation approach — what variables drive their galaxy model
- [ ] Stellar metallicity effects on planet formation — metal-poor stars → fewer rocky planets

### Design Needed
- [ ] Exotic spawning implementation — build overlay systems per §6
- [ ] Civilized planet spawning rates — finalize decision chain percentages
- [ ] Navigation computer UI design — layout, interaction, aesthetic details
- [ ] Megastructure visual design — how to render Dyson swarms, ring habitats
- [ ] On-foot exploration scope — what's the MVP interior?

### Waiting On
- [ ] Music tracks — Max's brother
- [ ] CRT scanline filter — Phase 11 remaining item
- [ ] Galaxy-level seed structure — design after regional variation research

---

*Last updated: 2026-03-13*
*This document is the authority. If code disagrees with the bible, the bible wins.*
