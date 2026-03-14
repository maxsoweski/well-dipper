# Well Dipper — Game Bible

> The single source of truth for all design decisions, game systems, and aesthetic rules.
> Every feature, tweak, and system should trace back to something in this document.
> If it's not in the bible, it hasn't been decided yet.

---

## 1. Vision

### What Is Well Dipper?
A retro space screensaver that doubles as an exploration game. In screensaver mode, you drift through vast, open, limitless space. In game mode, you pilot your ship through the same universe — discovering, scanning, trading, fighting, refueling in gravity wells. Both modes coexist: the vastness is always there, whether you're watching planets orbit or dodging pirate fire.

The screensaver is the MVP. The game systems grow out of it. (See §1A for what's built vs what's planned.)

### Player Identity [GAME]
You are a **pilot**. You pilot your ship. The ship is your home, your vehicle, your interface with the universe.

**Future:** Movement system within the ship — walk around, interact with systems. Gamified tasks like maintenance, repair, upgrades. Ship interior as a playable space between destinations.

**Full identity TBD.** Max wants something unusual for the player character — not a generic space trucker or military officer. Still thinking on this.

### Core Experience [BOTH]
- **Drift.** You float through space. The camera moves gently. You watch planets orbit, stars glow, nebulae swirl.
- **Discover.** Every system is different. Finding a terrestrial world or an alien megastructure is rare and meaningful.
- **Warp.** Click a star in the sky, hit spacebar, watch the fold animation, arrive somewhere new. Forever.

### The Warp as Sacred Experience [GAME]
The warp is not just travel. It is the **inseparability of all points in space** — a moment outside space-time. It should feel psychedelic, vast, and increasingly strange as the player gains experience.

**Progression:**
- **Early game:** Light tunnel, ship shaking, basic hyperspace visuals (what exists now). Travel is functional.
- **Mid game:** Occasional anomalies — a shape in the tunnel, a sound that shouldn't be there, a flash of something vast and incomprehensible. Brief, unsettling, unexplained.
- **Late game:** Full encounters within the warp itself. The tunnel gives way to impossible spaces — the room at the end of 2001: A Space Odyssey, psychedelic environments that don't follow physics, moments of profound strangeness. The warp becomes a *place*, not a transition.

**Connection to space anomalies:** The warp and the anomaly system are related phenomena. Both are moments where the fabric of space-time is thin. Experienced travelers learn to perceive what was always there.

**Design principle:** This is never explained. There is no lore dump about "what the warp really is." The player's understanding deepens through experience, not exposition.

### Name Origin
"Well Dipper" = dipping between gravity wells.

---

## 1A. Three Development Layers

Well Dipper exists as three layers, each building on the last. It's critical to understand which layer a feature belongs to — this prevents confusing what we HAVE with what we're PLANNING.

---

**LAYER 1: SCREENSAVER — CURRENT (Mostly Complete)**

The original product. A retro space screensaver that runs autonomously. You watch, or you lightly interact (click planets, select warp targets, adjust settings). No player character, no ship, no inventory, no combat. Just vast procedural space.

What's done and working:
- 11+ planet types with custom GLSL shaders, zone-based generation
- Binary star systems, asteroid belts, moons
- Warp transitions with fold/hyperspace/exit animations
- Deep sky objects (galaxies, nebulae, clusters)
- Autopilot touring with cinematic flythrough camera
- Background star selection and warp targeting
- Title screen, settings, body info HUD, minimap
- Sound effects (placeholder synthesized) and music system (ready, awaiting tracks)
- Exotic/civilized planet overlay system
- Science-driven planet distribution with metallicity, archetypes, log-normal spacing
- Zone-aware moon generation

What's remaining:
- Music tracks from Christian
- CRT scanline filter (optional)

**This layer is functionally complete.** Everything below is additive.

---

**LAYER 2: SCREENSAVER ENRICHED — FUTURE (Adds Visual Richness, No Gameplay)**

Enhancements to the screensaver that make it more visually rich and varied. These add new things to LOOK AT but zero gameplay mechanics. The screensaver remains passive — you watch, it plays.

What this layer adds:
- NPC ships flying routes, docking, passing through (visual only — no interaction)
- Megastructures visible in systems (Dyson swarms, ring habitats, derelicts)
- Non-main-sequence stars (white dwarfs, pulsars, red giants, black holes) with unique visuals
- Comets, interstellar objects passing through systems
- Space stations orbiting planets (visual only)
- Music tracks playing (the 7-track system)
- Environmental visual effects (radiation glow near pulsars, solar flares, nebula fog)
- Higher LOD planet detail on close approach
- Richer starfield reflecting galactic position (if galaxy layer is built)

**Key distinction:** Nothing in this layer requires player input, a save system, or game state. It's all scenery. The autopilot still tours everything. The screensaver just has more to show you.

---

**LAYER 3: GAME MODE — PLANNING PHASE (Not Yet Built)**

A fundamentally different experience built on the same universe. You are a pilot. You fly a ship. You make decisions. There is risk, reward, progression, and consequence. This is a GAME, not a screensaver.

What this layer adds:
- Player ship with manual flight (two models: all-range + on-rails)
- Combat (two modes tied to velocity: Star Fox all-range + Panzer Dragoon on-rails)
- Scanner as universal interaction verb (4 layers: galactic survey → star-wave → direct → codex)
- Nav computer (diegetic CRT terminal replacing current minimap)
- Fuel/energy system (rotor + gravity well minigame)
- Ship upgrades and progression (rotor, shields, scanner, weapons, engines, hull, cargo)
- Factions controlling galaxy regions (lawful vs hostile, expandable)
- NPC ships with behavior, hailing, combat AI
- Space stations with docking and interior exploration
- Persistent save system (localStorage / IndexedDB)
- Galaxy-scale procedural generation with regional variation
- Narrative framework (environmental storytelling, unexpected scan results, mystery)
- Evolving warp experiences (early: tunnel, mid: anomalies, late: impossible spaces)
- NPC communications (text-based, faction-varied, AI-generated variety)
- Economy (scan data trading, upgrade purchasing)

**Key distinction:** Everything in this layer requires a player making choices. The screensaver mode still exists alongside it — think of the screensaver as "attract mode" or a separate menu option.

---

Throughout this bible, features are tagged:
- **[SCREENSAVER]** — Layer 1, exists now
- **[ENRICHED]** — Layer 2, visual additions to screensaver, no gameplay
- **[GAME]** — Layer 3, full game systems
- **[BOTH]** — Applies across all layers (e.g., planet generation, aesthetic rules)

---

## 1B. Areas That Need Fleshing Out

> **Note:** All items in this section are GAME MODE features. Screensaver mode is functionally complete pending music tracks.

This is a living TODO — areas of the bible that are sketched but need deeper design work.

- **Player identity** — Who are you? What's unusual about your character?
- **Main game aesthetic** — The 9 palette modes aren't working cohesively. Need one strong visual language for the main view.
- **Combat balance** — Two combat modes defined, but no specifics on weapons, damage, health, difficulty.
- **Faction depth** — Two factions minimum, but what are their identities, territories, economies?
- **Fuel/energy system** — Rotor system designed (see §9), but balance/math for energy yield vs escape cost still TBD.
- **Rotor minigame balance** — Math for energy yield vs escape cost, difficulty curves per gravity well type.
- **Economy/trading** — Scan data is tradeable, but what else? Currency? Markets?
- **Ship upgrades** — Upgrade paths defined (see §9), but costs, tiers, and acquisition methods not designed.
- **Codex/discovery log** — What does the persistent record actually look like?
- **Narrative framework depth** — What specific stories/mysteries exist in the universe?
- **NPC dialogue templates** — What do people actually say? Dialect/personality variations.
- **Interstellar objects** — Gameplay mechanics for comets, rogue planets, and hyperbolic visitors.
- **Landing sequence design** — Atmospheric entry, belly-first transition to surface, fire/plasma effects.
- **Performance profiling** — Establish budgets for draw calls, memory, max objects in scene.

---

## 2. Aesthetic [BOTH]

### Era & Vibe
Late-90s PC / PS1 / Saturn era. Low-poly geometry, posterized colors, Bayer dithering, pixelated upscaling. The feeling of early 3D space games — Frontier, Starglider, Galaxy on Fire. Vast rather than frantic. Open rather than cluttered.

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

**Status: likely getting scrapped.** The 9 modes don't work cohesively — they feel like a grab bag rather than a unified aesthetic. Keep them in options for now, but the direction is: **one strong cohesive aesthetic for the main view.** The main view and nav computer should complement each other as two distinct visual languages. What that main aesthetic actually *is* needs further work.

### Dual Visual Languages
The game has two visual modes that work as a pair:
1. **Main view** — The "real" 3D world. Aesthetic TBD (see above).
2. **Nav computer** — Wireframe, vector-line CRT terminal. Representations of objects, not the objects themselves. (See §7 for details.)

### Sound Design [BOTH]

#### Diegetic Audio Principle [GAME]

**No sound in space.** Everything the player hears originates from inside the ship. This is scientifically accurate and reinforces the diegetic design approach.

Sources of sound:
- **Ship internals:** Engine rumble, rotor whir during energy harvesting, hull stress groans under gravity, weapons cycling, mechanical systems
- **Nav computer:** Notification pings, scan results, proximity alerts, communication chatter — all with that processed, CRT-terminal quality
- **Warning systems:** Geiger-counter-like clicks near radiation, proximity alarms, shield impact feedback
- **Other ships/explosions:** You don't hear them directly. Your ship's sensors detect them and the nav computer translates them into audio. External events sound filtered and processed — heard through the ship's instruments, not through vacuum.
- **Music:** The one open question — is the soundtrack diegetic (playing from ship systems, like a radio) or non-diegetic (exists for the player, not the character)? TBD. Both approaches have merit.

This constraint makes sound design MORE interesting, not less. Everything is mediated through the ship. The ship becomes a character through its sounds.

#### Musical Vision [BOTH]
Late-90s retro synth. Sparse arrangements, warm drones, FM/analog synth pads in quiet moments. Intense, driving rhythms during combat and hazards. The music matches the texture of the experience — vast and open in empty space, tense near hostiles, strange near anomalies. Think Katamari Damacy meets planetarium screensaver for the low end, FTL combat intensity for the high end. Tempos: 60-90 BPM for exploration, 120-140 BPM for hyperspace and combat.

**Reference soundtracks:** Outer Wilds (acoustic + wonder), FTL (synth exploration vs tense), Katamari Damacy (quirky retro), No Man's Sky (procedural ambient), Stellaris (grand space synths).

#### Synesthetic Audio System [GAME] (Future Direction)
Audio is **driven by system properties**, not fixed tracks. Audio and visual information are **synesthetic** — one does not cause the other. They arise together as aspects of the same experience.

**System properties that shape audio:**
- **Star type:** M-dwarf → warm/intimate; O-star → vast/intense
- **System age:** Young → dynamic/chaotic; ancient → quiet/haunted
- **Civilization presence:** Radio chatter, beacon pings, industrial hum
- **Hostility:** Tense undertones accompany hostile indicators on scan
- **Exotic phenomena:** Unique audio signatures for fungal blooms, megastructures, anomalies
- **Environmental hazards:** Radiation, asteroid density, nebula interference shape the soundscape

**Key principle:** Audio and visual cues are **simultaneous, not sequential.** The moment hostiles appear on your scan display is the same moment the music shifts. The scan indicator and the audio are two aspects of one event — synesthetic, not cause-and-effect.

**Exception:** Space anomalies can manifest in audio BEFORE any visual or scan data. Very rare, deliberately unsettling. Something feels wrong before you know why. This is the only case where audio leads.

#### Music Architecture [GAME] (Future Direction)
The 7-track model (below) is the MVP. The long-term direction is a **layered stem system:**
- Composer creates base tracks + modular stems/layers
- System properties activate/deactivate layers in real-time
- Base exploration track gets modified by star type, age, civilization, hostility
- This replaces "7 fixed songs" with a dynamic, property-driven soundscape
- Composer (Christian) would create stems and layers, not just complete songs

#### Music Tracks [BOTH] (7 total)

| Track | Context | Duration | Loop? | Priority | Vibe |
|-------|---------|----------|-------|----------|------|
| **title** | Title screen | 60-90s | Yes | HIGH | Mysterious, spacious, sparse — floating in void |
| **explore** | Main gameplay (star systems) | 90-120s | Yes | HIGH | Open, unhurried, vast. The sound of drifting through space. Most-heard track. |
| **explore-alt** | Variation on explore | 90-120s | Yes | LOW | Same key, different melody/instruments |
| **deepsky** | Galaxies, nebulae, clusters | 60-90s | Yes | MEDIUM | Grander, more awe-inspiring — bigger scale |
| **warp-charge** | Portal opens (6s visual) | 6-7s | No | HIGH | Building tension, escalating energy |
| **hyperspace** | Inside warp tunnel | 60s | Yes | HIGH | Fast, intense, rhythmic — retro sci-fi energy |
| **arrival** | Exiting warp into new system | 3-5s | No | MEDIUM | Brief wonder — "we're here," relief |

**Key compatibility:** All tracks in same or related keys for smooth crossfades (nice-to-have, not mandatory).

#### Looping Requirements (Critical)
- Zero silence before/after music — trim to exactly 0ms
- Even 10ms of silence causes an audible hiccup
- Avoid hard transients at start/end
- Reverb/delay tails must decay cleanly before loop point
- Test loops by repeating 3-4 times in Audacity

#### File Format
- OGG Vorbis primary, MP3 fallback (Safari/iOS)
- 128-192 kbps, 44.1 kHz stereo
- Optional: 22 kHz for extra lo-fi crunch
- Deliver to `/public/assets/music/` directory

#### Sound Effects [SCREENSAVER] (Placeholder — Web Audio API synthesized)
14 SFX in `SoundEngine.js`, all placeholder:
- **UI:** select (blip), cycle (tick), toggleOn/Off, uiClick
- **Autopilot:** rising/falling two-tone
- **Warp:** target chirp, lock-on tone, 6.5s charge buildup (THE signature sound — sub-bass + dissonant sawtooth + noise + high whine), exit reverse
- **Title:** cosmic drone, major chord arpeggio dismiss

#### Audio Architecture [BOTH]
- `SoundEngine.js` — Web Audio API synthesized SFX
- `MusicManager.js` — track loading, looping, crossfading, ducking
- Music transitions: title dismiss → explore, warp fold → duck, hyper start → hyperspace, warp complete → explore/deepsky
- Sound Test panel: press T to preview all effects and tracks
- Composer: Max's brother Christian. Guide doc: `Well-Dipper-Music-Guide.docx` in project root.

---

## 3. Universe Structure [BOTH]

### The Galaxy [GAME] (future)
Not yet implemented. When implemented:
- A master seed defines the entire galaxy
- Each star's position in the galaxy derives a system seed
- Same master seed → same galaxy, every time
- Current approach (random seed per system) works identically at the system level — adding a galaxy layer on top is additive, not a rewrite

### Deep Sky Objects [BOTH]
15% of warps go to non-star-system destinations:
- Spiral galaxies, elliptical galaxies
- Emission nebulae, planetary nebulae
- Globular clusters, open clusters

These are scenic destinations — no planets, no zones, just beautiful objects to orbit.

### Deep Sky Objects and Galaxy Relationship

**Nebulae, open clusters, and globular clusters are WITHIN galaxies.** They have spatial relationships with nearby star systems and influence local properties. Only other galaxies are truly external deep sky objects.

**In-galaxy deep sky objects influence nearby systems:**
- Near an emission/planetary nebula → nearby star systems are younger, more chaotic, active star formation
- Near a globular cluster → nearby systems are ancient, metal-poor
- Nebulae and clusters serve as regional signposts within the galaxy

**For the game:**
- In-galaxy deep sky objects influence nearby system generation (once galaxy layer exists)
- Other galaxies are a separate scale — possibly late-game intergalactic travel, or screensaver-mode only
- The starfield should eventually reflect galactic position (dense band along disk plane, sparse perpendicular, distant galaxies as dim points beyond)

---

## 4. Star Systems [BOTH]

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

#### Non-Main-Sequence Stars (To Be Implemented)
Stars that have evolved off the main sequence or never made it. These connect to the **age parameter** — old systems may have evolved stars, young systems may still be forming.

| Type | Description | Planet Implications |
|------|-------------|---------------------|
| **White dwarf** | Dead star, remnant core | Weird close-in remnant planets, disrupted orbits |
| **Neutron star / Pulsar** | Extreme radiation, millisecond rotation | Lethal radiation zones, exotic physics |
| **Red giant** | Bloated dying star | Inner planets swallowed, HZ pushed way out |
| **Brown dwarf** | Failed star, very dim | Small planetary systems, extremely close-in HZ |
| **Wolf-Rayet star** | Massive, dying, violently shedding mass | Glowing nebulae, extreme stellar winds |
| **Protostar** | Still forming | Debris disks instead of mature planets, no settled orbits |
| **Black hole** | Collapsed star or primordial | Accretion disk, extreme gravity, lensing effects |

**Design note:** These types create unique visual and gameplay experiences. A black hole system looks and feels completely different from a G-star system. Implementation should treat each as a distinct generation path, not just a reskinned main-sequence star.

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
- **Age drives everything:** Whether civilization is possible (<2 Gyr = no), whether exotic life exists (older = more likely), visual identity of the system (young = debris disks, old = evolved stars), what hazards exist, and what non-main-sequence star types are present

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

## 5. Natural Planet Types [BOTH]

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

### Comets and Interstellar Objects

Missing from the main type catalog but important for variety and encounters:

| Type | Description | Where | Rarity |
|------|-------------|-------|--------|
| **Comets** | Icy bodies with tails catching starlight. Visual spectacle. | Passing through systems on eccentric orbits | Occasional — visual treat |
| **Dwarf planets** | Small, round bodies in outer system or scattered disk | Outer system, scattered disk | Common in outer zones |
| **Rogue planets** | Ejected from systems, drifting through interstellar space | Interstellar space encounters | Rare |
| **Interstellar objects** | Like 'Oumuamua — hyperbolic orbits passing through systems briefly | Transiting through systems | Extremely rare, mysterious, potential anomaly triggers |

These add variety and encounter opportunities without being full planets. Comets are primarily visual. Rogue planets and interstellar objects are discovery-tier encounters — scanning one could be a significant find.

### Science Sources
- **Eta-Earth:** Bryson et al. 2020 (Kepler DR25) — 37-60% of G stars have rocky HZ planet
- **Most common planet:** Sub-Neptune (Fressin et al. 2013, Kepler)
- **Surface water fraction:** ~10-25% of HZ rocky planets (Forget 2012)
- **Gas giant occurrence:** 15-20% of FGK stars, 3-5% of M dwarfs (Cumming 2008, Mayor 2011)
- **Hot Jupiters:** ~0.5-1% of all systems
- **Tidal locking:** Expected for virtually all M-dwarf HZ planets (Barnes 2017)
- **Eyeball climate:** AAS Nova 2024 — varied outcomes for K/M dwarf HZ planets

---

## 6. Overlay Systems (Exotic, Civilized, Megastructures) [BOTH]

These systems run AFTER natural planet generation. They modify or add to the base system.
They are NOT part of the natural decision tree.

### 6A. Civilized Planets [BOTH] (Human-Like Civilization)

**Concept:** Civilization is an overlay on habitable planets — but also a **regional phenomenon** at the galaxy scale. A planet must first be terrestrial, ocean, or eyeball — then a separate roll determines if civilization developed there. But civilization also spreads influence to neighboring systems.

**Decision chain:**
1. System generates naturally (most have no habitable planets)
2. If a habitable planet exists (terrestrial/ocean/eyeball), roll for civilization
3. Civilization probability depends on star type (stable, long-lived stars favor it)
4. If civilization hits, the planet type changes to city-lights or ecumenopolis

**Civilization as a Galaxy Layer:**
Civilization isn't just a per-system overlay — it's regional:
- Civilized systems influence their neighbors
- Metal-rich systems near civilized ones → industrial colonies, mining stations
- Even systems with **no habitable zone** can have humanoid presence if metal-rich (stations, mining outposts, megastructures)
- Presence driven by: **metallicity + proximity to civilized systems + system age**
- Two branches:
  - Habitable + metal-rich → colonized planets (city-lights, ecumenopolis)
  - No habitable + metal-rich → artificial structures (stations, mining outposts, orbital habitats)

**Metallicity × Civilization:** Metal-rich systems → more civilized presence. Metal-poor → less. This applies to both colonized planets AND industrial outposts.

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

### 6B. Exotic Planets [BOTH] (Alien Anomalies)

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

### 6C. Megastructures [BOTH] (Future)

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

## 6D. Environmental Hazards [BOTH]

Hazards make certain systems dangerous to enter or navigate. Visually present in both modes; gameplay effects (damage, fuel cost, scanner interference) are [GAME] only. They create risk/reward decisions — dangerous systems may have valuable scan data or rare resources.

| Hazard | Source | Effect |
|--------|--------|--------|
| **Radiation zones** | Pulsars, magnetars, active stars | Damage over time, scanner interference |
| **Solar flares** | Active M-dwarfs, young stars | Periodic bursts of damage, shield drain |
| **Dense asteroid fields** | Young systems, disrupted orbits | Collision risk, reduced maneuverability |
| **Nebula interference** | Emission/planetary nebulae | Scanner static, reduced visibility, navigation difficulty |
| **Extreme gravity** | Black holes, neutron stars, white dwarfs | Fuel drain, trajectory distortion, tidal effects |

**Ties into fuel/energy system:** Approaching heavy or dangerous objects costs more energy. Risk/reward — the most dangerous systems may contain the most valuable discoveries.

**Ties into scanner:** Hazards are revealed (or hinted at) through the scanning system. Galactic survey data may flag known-dangerous systems. Star-wave scan on arrival reveals local hazard levels.

---

## 7. Navigation & UI

### Current State [SCREENSAVER]
- **System map minimap** (top-down radar, 192px HUD overlay)
- **Gravity well map** (3D vertex-displaced contour, toggled with G)
- **Body info HUD** (top-left popup on selection)
- **Orbital overlay** (O key, orbit lines)

### Future Vision: Navigation Computer [GAME]

**Replace all current map overlays** with a single toggleable screen that looks like a retro CRT navigation computer. Think: the ship's onboard computer displaying a schematic of the star system.

**Aesthetic:** Wireframe, vector-line style, 80s sci-fi CRT terminal. Representations of objects, not the objects themselves. Own phosphor color independent of main view. **Diegetic** — it's a real device in your ship, not a game UI overlay.

**References:** Alien MU-TH-UR 6000, WarGames WOPR terminal, 80s vector displays.

**Features (planned):**
- Interactive system map (zoom, pan, click to select bodies)
- Zone visualization (concentric rings showing scorching/inner/HZ/transition/outer)
- Body information panels (type, radius, features)
- Warp target selection from the map
- Toggle on/off as a full overlay or separate screen
- Codex / discovery log (persistent record of everything scanned)

**Replaces:** GravityWell minimap, orbital minimap, orbital overlay. The real-time 3D view IS the "real thing" — the navigation computer is the abstraction layer.

### Scanner System [GAME]

The scanner is the **universal interaction verb**. Everything you learn about the universe comes through scanning. Four layers, from coarsest to finest:

#### Layer 1: Galactic Survey Data (Before Arrival)
Available from the galaxy map before you warp. Pre-existing data from galactic surveys.
- Star type, estimated planet count, age estimate
- Danger rating (known hazards)
- Known vs unknown status
- **Civilized systems** are fully mapped in the survey. Frontier/unexplored systems have only basic star type data. Young/chaotic systems flagged as high danger.

#### Layer 2: Star-Wave Scan (On Arrival, Player-Triggered)
You arrive in a system and bounce a scan wave off the star. Reveals the full system layout.
- Planet positions, orbital radii, basic types
- Confirms or contradicts survey data
- **"Expected" vs "unexpected" results** drive emergent gameplay:
  - Expected colonized planet is destroyed → story hook
  - Unknown system has unexpected civilization → discovery
  - Survey said 4 planets, scan finds 5 → hidden body
  - Survey said safe, scan reveals hostiles → ambush

#### Layer 3: Direct Scan (Fly Close)
Approach an object and scan it directly. Richer detail than star-wave.
- Material composition, surface features, higher LOD visual
- Works on: planets, moons, ships, stations, anomalies
- **On ships:** Identifies type, faction, combat capability, cargo hints
- **Scan data is tradeable** at civilized systems — exploration has economic value

#### Layer 4: Codex (Persistent Record)
Part of the nav computer. Tracks everything you've ever scanned.
- Discovery log — what you've found, where, when
- Categorized by type (stars, planets, exotics, ships, stations)
- Completion tracking (how many planet types discovered, etc.)

### In-System Travel [GAME]

The travel loop within a system:

1. **Select destination** on nav computer
2. **Accelerate** to relativistic speed
3. **Brief high-speed transit** — on-rails segment, combat possible (see §9 Combat)
4. **Decelerate** with cinematic approach — tension builds, destination grows ahead
5. **Arrive** at low speed — all-range combat possible (see §9 Combat)
6. **Interact** with POI — dock, scan, orbit, engage

---

## 8. Technology (Structures, Vehicles, Habitation) [BOTH]

Everything built by intelligent beings — human or alien. Ships, stations, bases, megastructures.

### 8A. Ships [BOTH] (Pipeline Ready, Not Active)

#### Ship Archetypes
6 types exported from Blender as .glb:
- **Fighters** (2-6 near planets)
- **Shuttles** (1-3 between planets)
- **Freighters** (1-2 on long routes)
- **Cruisers** (1-2 patrol)
- **Capitals** (0-1, 20% of systems, deep space)
- **Explorers** (0-1, outer system)

**Ship population reflects system properties:**
- Compact-rocky systems → mining ships, surveyors
- Civilized systems → shuttles, fighters, patrols
- Metal-rich industrial → freighter convoys, construction vessels
- Empty/frontier → lone explorer or nothing at all

#### Ship Behavior [GAME] (ShipManager — not started)
State machine: CRUISING → APPROACH → ESCORT → DEPART → CRUISING
Encounters: ~1 in 3 systems has a ship visit you during orbit.

### 8B. Space Stations [GAME] (Future)
Orbital structures around planets or at Lagrange points. Could range from small outposts to large rotating habitats. Docking possible for on-foot exploration (see §8E).

### 8C. Bases [GAME] (Future)
Surface installations on moons or planets. Landing pads, habitation domes, mining facilities. Tied to civilized planet overlay — a city-lights world might have visible bases from orbit.

### 8D. Anomalous Structures [BOTH] (Future)
Objects that don't fit neatly into natural or civilized categories:
- Derelict megaships (see §6C)
- Ancient alien ruins on moons/planets
- Signal sources (beacons, probes)
- Unidentified objects in unusual orbits

### 8E. Planetary Surface Detail / LOD Tiers [BOTH]

Three LOD tiers for celestial bodies:

1. **Billboard** — Already implemented. Fixed screen-size pixel dot when body is sub-pixel.
2. **Current model** — The sphere with procedural shader. What we have now.
3. **High-LOD / showcase** — Close-up detail. Surface features, continent shapes, mountain ranges (bump mapping), city grids on city-lights worlds. For when you're very close — showcase mode or pre-landing approach.

**Critical aesthetic constraint:** Adding too much detail risks breaking the retro aesthetic. The high-LOD tier must still feel retro — more detail within the low-res, dithered rendering, not a jump to modern graphics. Test with a single planet type first to see how LOD transitions feel.

**The aesthetic relies on NOT having immersive LOD.** So this is enhancement within the existing visual language, not a departure from it.

### 8F. Landing Mechanics [GAME] (Future)

If landing is ever implemented:
- Ship enters **belly-first** (heat shield on bottom)
- Nose of ship is NOT exposed to reentry friction
- This hides the transition — you're looking at fire effects on the belly, not the terrain resolving
- Fire/plasma effects during atmospheric entry — could be visually striking in the retro aesthetic
- Landing sequence could be automated or semi-manual (skill element)
- Surface transition TBD — this is far-future but the belly-first entry design decision is recorded here

### 8G. On-Foot Exploration [GAME] (Future — Long-term)
**Minimum viable version:** Land at a space station, exit ship, walk around a basic interior environment. First-person movement in a small man-made space.

**What this enables:**
- Sense of scale (you're a person in this universe, not just a camera)
- Narrative hooks (logs, terminals, environmental storytelling)
- Break from the vastness of space — moments of intimate scale

**Design constraints:**
- Must work with the retro aesthetic (low-poly interiors, dithered)
- Should feel like a natural extension, not a different game
- Start extremely small — one room, one station type

---

## 9. Game Systems [GAME] (Future)

These are placeholder sections for systems that will be designed and implemented later.

### Fuel/Energy System — The Rotor [GAME]

The core energy loop of the game. The ship has a **rotor** — a mysterious device that interacts with gravity wells directly.

**How it works:**
1. Fly close to a massive object (star, gas giant, neutron star, etc.) — within significant interaction range of its gravity well
2. Engage the rotor → energy harvesting begins
3. Keep the ship's trajectory in the right spot while the rotor harvests (minigame — see below)
4. Disengage and escape the gravity well with net positive energy

**Critical rule:** Energy gained from dipping into a gravity well must be MORE than the energy required to escape it. Every dip is net positive — that's the core promise. The skill element determines *how much* net positive.

**The Rotor Minigame:**
- The rotor disrupts autopilot — requires manual piloting while engaged
- Skill-based: too deep into the well = danger (ship damage, capture), too shallow = low yield
- Sweet spot shifts based on the object type and mass
- Exotic structures in systems add variables (fungal interference, debris fields, radiation bursts) keeping the minigame fresh across different systems
- This is the game's core verb — you will do this hundreds of times, so it must have depth

**Balance (TBD):** The math for energy yield vs escape cost per gravity well type needs design work. Bigger/denser objects = more energy but harder minigame and higher escape cost.

### Ship Upgrade System [GAME]

Upgrade paths tied to the fuel/rotor loop and progression:

| Category | What it does | Examples |
|----------|-------------|---------|
| **Rotor modules** | Harvest speed, efficiency | Faster energy gain per second in the well |
| **Autopilot assist** | Help with rotor alignment | Tiered: basic alignment help → advanced auto-harvesting (expensive) |
| **Shields** | Survive more dangerous environments | Dip into neutron stars, black hole accretion disks |
| **Scanners** | More detail from scans, longer range | Tier 1 = basic type, Tier 3 = full composition + history |
| **Weapons** | Combat capability | For combat modes (see below) |
| **Engines** | Acceleration, max transit speed, maneuverability | Faster in-system travel, better dodging |
| **Hull** | Damage resistance | Survive collisions, environmental hazards |
| **Cargo/data storage** | Capacity for tradeable scan data | More scans stored = more income at civilized systems |

**Acquisition:** Upgrades purchased or found. Economy TBD, but scan data trading at civilized systems is one confirmed income source.

### NPC Communications [GAME]

Ships can hail you and you can hail ships. Interaction with space stations from outside (comms) and inside (on-foot, future).

**Aesthetic:** Text-based, retro terminal style — fits the nav computer visual language. Communications appear on the nav computer screen, not as floating UI.

**Communication types:** Greeting, warning, trade offer, distress signal, hostile challenge. Limited base types, but each has many dialect/personality variations so players rarely see the same line twice.

**AI-generated variety:** Different factions have different communication styles. Civilized faction ships are formal/professional. Hostile faction ships are aggressive/taunting. Frontier independents are terse/pragmatic.

**Scanning → identification → communication flow:** Scanning a ship initiates the identification process — this is how you learn what you're dealing with before deciding to hail or avoid.

### Combat System [GAME]

Two modes, both tied to velocity:

#### All-Range Mode (Star Fox style)
Triggered at **low speed near POIs** — when you decelerate to approach stations, planets, or other objects.
- Full 3D movement, enemies from all directions
- Ambushes, pirate encounters, defensive installations
- Dogfighting around structures and asteroid fields

#### On-Rails Mode (Panzer Dragoon style)
Triggered at **relativistic transit speed** — during high-speed travel between destinations.
- Fixed trajectory, 360-degree targeting reticle
- Limited lateral dodge movement
- Enemies matching velocity alongside you
- Could also trigger during warp sequences

**Mode transitions follow the in-system travel loop (see §7):** Accelerate → on-rails combat possible → decelerate → all-range combat possible → interact with POI.

### Faction System [GAME]

Minimum viable: **two factions.**

| Faction | Territory | Behavior |
|---------|-----------|----------|
| **Lawful** | Civilized regions, industrial systems | Patrols, trade routes, protection. Hostile to pirates. |
| **Hostile** | Gaps between civilized regions, frontier | Piracy, ambushes, unregulated salvage. Hostile to lawful. |

- Factions control **regions** of the galaxy, not individual systems
- Pirates operate in the gaps between civilized regions
- System expandable to more factions later — design needs slots for faction data per system
- Player reputation with factions (future) — your actions affect how factions treat you

### Discovery Log [GAME]
Track what you've found: planet types seen, star types visited, exotics discovered. Persistent across sessions (localStorage).

### Exploration Score [GAME]
Points for variety: new planet types, rare finds (terrestrial, exotic, megastructure), deep sky visits.

### Procedural Names [GAME]
Star systems and planets get generated names. Style TBD — scientific catalog numbers? Fantasy names? Mix?

### Seed Sharing [BOTH]
Share a seed string so others can visit the same system. Screenshot mode with seed overlay.

### Galaxy Map [GAME]
Higher-level navigation. See your position in the galaxy, pick destinations, see explored vs unexplored regions.

---

## 10. Technical Foundation [BOTH]

### Team
- **Max** — Game Director, Art Designer
- **Claude + sub-agents** — Development team
- **Christian** (Max's brother) — Sound Designer, Music Composer

### Stack
Vite + Three.js (vanilla JS, no framework)

### Key Architecture Decisions
- **Data-first generation:** Generators produce plain JS objects, no Three.js dependency. Meshes built separately.
- **Deterministic seeds:** Same seed → identical system. `.child()` creates independent sub-streams.
- **Per-object dithering:** Bayer dithering in each object's fragment shader, not a screen filter.
- **Dual-resolution rendering:** Scene at low res, starfield at full res, composited with alpha-based shader.

### Performance / Optimization Strategy

Not yet profiled, but needs concrete limits as the game grows:

- **LOD budget:** When many objects are in scene (8 planets, 20 moons, asteroid belt, ships), LOD tiers must aggressively cull detail. Billboard system already handles sub-pixel objects.
- **Draw call budget:** Needs profiling — establish a target (e.g., <200 draw calls) and monitor.
- **Instancing:** Already used for asteroids. Extend to other repeated geometry (station modules, ship swarms, particle effects).
- **Memory management:** Galaxy-scale data requires sector caching with LRU eviction. Only nearby sectors live in memory.
- **Shader complexity:** Per-object dithering is cheap but stacks up. Monitor fragment shader cost as planet count grows.
- **Critical path:** This becomes urgent as ship population, station rendering, and galaxy map are added. Profile early, set budgets, enforce them.

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
| **Star Fox 64** | All-range mode — full 3D dogfighting near POIs. Combat triggered by proximity. |
| **Panzer Dragoon** | On-rails mode — fixed trajectory, 360-degree targeting. Combat during transit. |

### Science
| Source | What it informs |
|--------|----------------|
| **Kepler/TESS missions** | Planet occurrence rates by type and orbital distance. Sub-Neptune dominance. Eta-Earth estimates. |
| **Bryson et al. 2020** | ~37-60% of Sun-like stars have rocky HZ planet |
| **Fressin et al. 2013** | Planet size distribution — sub-Neptunes most common |
| **Cumming et al. 2008 / Mayor et al. 2011** | Gas giant occurrence: 15-20% of FGK, 3-5% of M |
| **Fischer & Valenti 2005** | Giant planet metallicity correlation: P(giant) ∝ 10^(2×[Fe/H]) |
| **Buchhave et al. 2014** | Three regimes: terrestrial (<1.7R⊕), gas dwarf, giant — metallicity thresholds |
| **Weiss et al. 2018** | "Peas in a pod" — intra-system size and spacing correlation |
| **Steffen & Hwang 2015** | Period ratio distribution — log-normal, min 1.2, median ~1.73 |
| **Zhu & Dong 2021** | Planet count distribution — ~1.2 planets/star inner system |
| **Forget 2012** | ~10-25% of HZ rocky planets have surface liquid water |
| **Barnes 2017** | Tidal locking for M-dwarf HZ planets → eyeball worlds |
| **Luger & Barnes 2015** | M-dwarf pre-MS water loss on HZ planets |
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
| **Alien (MU-TH-UR 6000)** | Nav computer aesthetic — CRT terminal, phosphor glow, diegetic computer interface |
| **WarGames (WOPR)** | Nav computer aesthetic — vector displays, wireframe representations, cold machine logic |

---

## 12. Galaxy-Scale Generation [GAME] (Research Phase)

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

### Civilization Regions
At the galaxy scale, civilization forms **regions**, not isolated dots:
- Clusters of civilized systems with shared trade routes and patrols
- Industrial/mining colonies spread outward from civilized cores into metal-rich neighbors
- Pirate/hostile factions fill the gaps between civilized regions
- Frontier zones at the edges where civilization thins out
- This is an overlay on the galaxy structure — computed after star placement, based on metallicity clusters + age constraints (civilization needs >2 Gyr)

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

## 13. Generation Verification Log [BOTH]

Census results to compare against when debugging. Run `node /tmp/census-script.mjs` pattern to regenerate.

### Baseline Census (2026-03-13, commit e6587d0, 5000 systems)

**System-level rates:**
| Metric | Target | Actual | Notes |
|---|---|---|---|
| Terrestrial | ~3% | 3.9% | Slightly high but acceptable |
| Ocean | ~6% | 6.6% | Close |
| Eyeball | ~2% | 1.9% | On target |
| Any habitable | ~8-10% | 12.4% | High — driven by planet count changes |
| Gas giant | ~20% | 20.9% | On target |
| Hot Jupiter | ~1% | 1.5% | Slightly high |

**Metallicity → gas giant correlation (Fischer-Valenti):**
| Metallicity | Systems | With gas giant | Rate |
|---|---|---|---|
| Low ([Fe/H] < -0.15) | 1129 | 64 | 5.7% |
| Mid (-0.15 to +0.15) | 2755 | 531 | 19.3% |
| High ([Fe/H] > +0.15) | 1116 | 448 | 40.1% |

**Archetype distribution:** compact-rocky 30.6%, mixed 45.2%, spread-giant 24.3%

**Planet count:** avg 4.6/system, 7.5% empty, bell curve peaking at 5-6

**Spacing ratios:** median 1.728, min 1.200, 25th pct 1.540, 75th pct 1.948

**If rates seem off after future changes, check:**
1. Did `_pickType()` thresholds change? (per-planet HZ chances)
2. Did planet count distribution change? (more planets = more chances to hit HZ)
3. Did spacing change? (wider spacing = fewer planets in HZ)
4. Did metallicity distribution change? (affects gas giant rates)
5. Did archetype weights change? (30/45/25 split)

### How to Run a Census
Generate N systems, count types. Pattern:
```javascript
import { StarSystemGenerator } from './src/generation/StarSystemGenerator.js';
for (let i = 0; i < N; i++) {
  const data = StarSystemGenerator.generate('census-' + i);
  // count data.planets[].planetData.type
  // check data.metallicity, data.archetype, data.ageGyr
}
```

---

## 14. Open Questions & Research Needed

### Completed Research
- [x] Zone variability by star type and age → see `docs/RESEARCH_zone-variability.md`
- [x] Planet clustering patterns → implemented via peas-in-a-pod archetype system
- [x] Stellar metallicity effects → implemented via Fischer-Valenti scaling
- [x] Space Engine's approach → documented in research file

### Active Research
- [ ] Galactic regional variation — how metallicity/age/density vary across a galaxy
- [ ] Star age effects on generation — when to start using `ageGyr` parameter
- [ ] Non-main-sequence star generation — white dwarfs, neutron stars, red giants, brown dwarfs, Wolf-Rayet, protostars, black holes

### Design Needed
- [x] Exotic spawning implementation — `ExoticOverlay.js` post-generation pass
- [ ] Civilized planet spawning rates — finalize decision chain percentages
- [ ] Civilization as galaxy layer — regional spread logic, proximity influence, metal-rich outpost rules
- [ ] Navigation computer UI design — layout, interaction, aesthetic details (wireframe CRT direction decided)
- [ ] Scanner system implementation — four layers (galactic survey, star-wave, direct, codex)
- [ ] Combat system design — weapons, damage, health, difficulty for both modes
- [ ] Faction system design — territory generation, reputation, encounter rules
- [ ] Environmental hazard implementation — damage model, fuel costs, scanner integration
- [ ] In-system travel loop — acceleration/deceleration mechanics, transit timing
- [ ] Main game aesthetic — replace 9 palette modes with one cohesive visual language
- [ ] Reactive audio system — stem/layer architecture, property-to-audio mappings
- [ ] Player identity — who are you? What's unusual about the character?
- [ ] Megastructure visual design — how to render Dyson swarms, ring habitats
- [ ] On-foot exploration scope — what's the MVP interior?
- [ ] Gap-giant association — two-pass generation (deferred Phase 6)

### Waiting On
- [ ] Music tracks — Max's brother Christian (future: layered stem system)
- [ ] CRT scanline filter — Phase 11 remaining item
- [ ] Galaxy-level seed structure — design after regional variation research

---

## 15. Narrative Framework [GAME]

### Philosophy
The universe has **history** — megastructures were built by someone, fungal blooms spread, civilizations rose and fell. But it is **not over-explained.** Mysterious. Some things are never addressed directly. The player pieces things together.

**There is no narrator, no cutscenes, no exposition dumps.**

### How Narrative Emerges
- **Environmental storytelling:** What you see in a system tells a story. A destroyed colony near a fungal bloom. A derelict megaship in an empty system. An ancient civilization's hex structure orbiting a dying star.
- **Unexpected scan results:** Expected colony is destroyed — what happened? Unknown system has unexpected civilization. Survey said 4 planets, scan finds 5. These gaps between expectation and reality are the story hooks.
- **Ship communications / NPC dialogue:** Fragments of information from other pilots. Warnings, rumors, distress calls that reference events you haven't witnessed.
- **Space anomalies:** A collection/discovery system (TBD) — finding and cataloging unexplained phenomena.
- **Logs/terminals on stations:** Future, ties to on-foot exploration. Found text that fills in pieces of the universe's history.

### Tone
Mysterious, sometimes haunting, occasionally wondrous. The universe is vast and mostly indifferent. But there are pockets of beauty, strangeness, and implied history that reward attention.

### What the Narrative is NOT
- Not a main quest or storyline
- Not a mystery with a single answer
- Not lore dumps in codex entries
- Not something you can "complete"

---

*Last updated: 2026-03-14*
*This document is the authority. If code disagrees with the bible, the bible wins.*
