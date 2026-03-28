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

#### The Player — Scion of a Breakaway Line

The player is the **scion** — possibly the last living heir — of an eccentric breakaway line of human civilization. This offshoot split from mainstream humanity roughly a millennia ago and became increasingly eclectic and divergent over the centuries: different technology, different culture, different priorities.

**Disadvantages:**
- No faction support — no one owes you anything, no one is coming to help
- No backup — you are alone in the universe
- Vulnerable — one ship, one pilot, no fleet
- Possibly hunted — people who want the tech, people who remember the breakaway line and have opinions about it

**Advantages:**
- Exceptional ship technology, particularly propulsion (see §8H)
- Personal warp capability — you carry your own fold generator when most people depend on infrastructure (stabilized warp gates)
- Exotic propulsion systems that are more efficient than modern corporate drives
- The ship is old and temperamental but fundamentally superior — like inheriting a hand-built mechanical watch in a world of digital ones

**What this means for gameplay:** The player is powerful but fragile. Capable of going anywhere, but with no safety net. The ship's superiority is real but comes with maintenance burden and the constant awareness that there are no replacement parts. This tension — extraordinary capability, total isolation — is the player's core experience.

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
- **Combat balance** — Two combat modes defined, hold-and-release input system sketched (ranged/melee/defend). Needs charge thresholds, parry mechanics, damage values, enemy AI patterns, upgrade scaling.
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
- **BPM-synced universe** — How system properties map to BPM, how animations/camera/SFX quantize to the beat grid, interaction with stem system. See §2 Sound Design.
- **Splash screen sequence** — Production company name/logo, timing, visual style, skip behavior. See §7.
- **Magnification window** — Magnification level, visual style, mobile behavior, animation timing. See §7.

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

### Vacuum-Realistic Energy Visuals [BOTH]

A distinctive visual rule that applies to all energy effects — weapons, engines, thrusters. **You see where energy is emitted and where it arrives, but NOT a visible beam or projectile traveling through the vacuum between them.**

This is what these scenarios would actually look like in space. Light doesn't scatter in a vacuum — there's no medium to make a beam visible. Games universally ignore this, which makes Well Dipper's approach visually unique.

**Weapons (lasers, particle cannons):**
- You see a cool visual effect at the **emission point** (the weapon port glowing, energy gathering, muzzle flash)
- You see a cool visual effect at the **impact point** (sparks, damage glow, shield ripple)
- You do NOT see a long glowing laser bolt traveling between them
- The connection between emission and impact is implied, not drawn

**Ship engines (thrusters, exhaust):**
- You see the **exhaust ports** — energy expanding to fill the port, glowing intensely
- You see **light bouncing** off the hull and nearby surfaces (e.g., launch pad, station dock, nearby ship)
- You do NOT see a visible thrust plume or exhaust trail extending out behind the ship
- Deceleration/maneuvering thrusters on the front/sides work the same way — ports glow, light reflects, no visible jet

**Why this works:**
- Visually distinctive — immediately sets Well Dipper apart from every other space game
- Scientifically grounded — reinforces the diegetic/realistic design philosophy
- Still readable — the emission and impact effects give the player all the information they need about what's happening
- Light reflection on nearby surfaces adds visual richness without breaking the rule

**Edge case:** Nebulae and dense particle fields COULD scatter light, making beams partially visible when fighting inside them. This would be a cool environmental variation — TBD.

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

#### BPM-Synced Universe [BOTH]

**Everything in a star system pulses to the same beat.** Each system has a unique BPM derived from its properties, and all elements sync to it:

**What syncs to the system BPM:**
- BGM tempo — the music's BPM matches the system
- Planet animations — rotations, orbital movement, atmospheric effects
- Camera movements — autopilot pans, cuts, and transitions land on beats
- Sound effects — all SFX are musical (percussive/melodic hits in key and tempo)
- Object animations — asteroid tumbles, ring rotations, moon orbits

**How BPM is determined:**
- Each star system generates a unique BPM from its properties (star type, planet count, age, etc.)
- The BGM varies per system — same underlying track structure but tempo-shifted to match
- Every system feels rhythmically distinct

**Design questions to flesh out:**
- BPM range — suggested starting point: 60-120 BPM (slower for calm/ancient systems, faster for chaotic/young ones)
- What system properties drive the BPM? Star type alone, or also planet count, hazards, exotic/civilized status?
- How does this interact with the layered stem system below? Stems would need to be tempo-flexible.
- Camera sync specifics — do autopilot cuts snap to downbeats? Do pans ease on beat boundaries?
- How are SFX made musical? Tuned to the system's key? Quantized to the beat grid?
- Warp transitions — does the BPM crossfade between the departing system's tempo and the arriving system's tempo?

**Key principle:** This is not background music with animations happening independently. The universe IS the music. A system at 72 BPM feels fundamentally different from one at 108 BPM — not just sonically, but visually and kinetically.

#### Music Architecture [GAME] (Future Direction)
The 7-track model (below) is the MVP. The long-term direction is a **layered stem system:**
- Composer creates base tracks + modular stems/layers
- System properties activate/deactivate layers in real-time
- Base exploration track gets modified by star type, age, civilization, hostility
- This replaces "7 fixed songs" with a dynamic, property-driven soundscape
- Composer (Christian) would create stems and layers, not just complete songs
- **All stems must be tempo-flexible** to support the BPM-synced universe (see above)

#### Music Tracks [BOTH] (7 total)

| Track | Context | Duration | Loop? | Priority | Vibe |
|-------|---------|----------|-------|----------|------|
| **splash-ramp** | Splash screens → title | ~6s | No | HIGH | Ramp-up intro that builds into the title theme |
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

## 4A. Physics-Driven Generation [BOTH]

### Design Principle
**Every property should have a physical cause.** Inspired by Elite Dangerous's Stellar Forge, which proved that physics-driven generation creates coherence players can *feel* even when they can't name it. The difference between a universe that impresses and one that convinces.

Our approach: not literal simulation (we're indie, and we compress distances/scales for visual drama), but physics-*driven* — every planet, ring, belt, and moon exists for a reason traceable to formation physics. Placeholder visuals are fine; the generation math comes first and assets catch up later.

### 4A.1 Atmospheric Retention Model

**Why:** Currently atmospheres are assigned by random chance per planet type. A rocky planet at 0.5 AU around an F-star should NOT have a thick atmosphere — UV flux would strip it. Physics should decide.

**Inputs:** Planet mass (escape velocity), stellar luminosity (UV flux at orbital distance), system age (time for atmospheric loss), magnetic field likelihood (mass + rotation + iron core fraction).

**Calculation:**
- Jeans escape parameter: λ = (G × M_planet × m_molecule) / (k_B × T_exosphere × R_planet)
- If λ < 6 for a given molecular species, that species escapes over geological time
- Lighter molecules (H₂, He) escape first → small hot planets lose primordial atmospheres → left with CO₂/N₂ or nothing
- Magnetic field modulates: strong field reduces atmospheric sputtering by stellar wind by ~10×
- Age factor: young planets may still retain primordial H/He even close-in; old planets have had time to lose them

**Outputs on planet data:**
```
atmosphere: {
  retained: true/false,
  type: 'primordial' | 'secondary' | 'remnant' | 'none',
  composition: 'h2-he' | 'co2-n2' | 'n2-o2' | 'co2' | 'methane' | 'none',
  pressure: 0-100 (relative to Earth = 1),
  color: [r,g,b] (derived from composition),
  strength: 0-1 (visual thickness, derived from pressure)
}
```

**Replaces:** Current random `atmosphere: { color, strength }` assignment.

### 4A.2 Tidal Effects

**Why:** Volcanic moons should emerge from physics (tidal heating from orbital resonance with parent), not dice rolls. Tidal locking should be calculated, not hardcoded for two planet types.

**Tidal locking:** Any body close enough to its parent for long enough becomes tidally locked. Timescale depends on mass ratio, separation, and rigidity. Most rocky planets inside ~0.1 AU around M-dwarfs are locked. Most close-in moons are locked.

**Tidal heating:** Moon experiences flexing from eccentric orbit + gravitational pull from parent + resonance with sibling moons. Heat output ∝ (eccentricity² × parent_mass² × moon_radius⁵) / (orbit_radius⁵). High heating → volcanism (Io), moderate → subsurface ocean (Europa), low → frozen.

**Orbit circularization:** Tidal dissipation circularizes orbits over time. Old close-in planets have circular orbits. Young or recently captured bodies may have eccentric orbits.

**Outputs:**
```
tidalState: {
  locked: true/false,
  lockType: 'synchronous' | '3:2-resonance' | 'none',  // Mercury is 3:2
  heating: 0-1,  // drives volcanism
  eccentricity: 0-1,  // circularized over time
}
```

**Effect on moons:** Volcanic moon type is assigned when `tidalState.heating > threshold`, not from a random type table.

### 4A.3 Planetary Composition from Star Chemistry

**Why:** A planet's composition should derive from what was available in the protoplanetary disk, which comes from the star's chemistry.

**Key ratio: Carbon-to-Oxygen (C/O):**
- C/O < 0.8 (most stars): Silicate-dominated planets (Earth-like). Oxygen bonds with Si, Mg, Fe → rocks. Leftover O → water.
- C/O > 0.8 (carbon stars): Carbon planets — graphite/diamond crusts, tar oceans, CO atmospheres. Silicon carbide instead of silicates.
- Derived from metallicity with scatter: C/O ≈ 0.55 + 0.3×[Fe/H] + gaussian noise

**Iron fraction:** Higher metallicity → more iron in protoplanetary disk → denser planet cores → stronger magnetic fields → better atmospheric retention (feeds into §4A.1).

**Volatile budget:** Distance from star during formation determines how much water/ice was incorporated. Beyond the frost line: volatile-rich (icy). Inside: dry (rocky). Migration can create "wet" planets at dry orbits (water worlds from migrated ice bodies).

**Outputs on planet data:**
```
composition: {
  carbonToOxygen: 0.3-1.2,
  ironFraction: 0.1-0.5,    // Earth is ~0.32
  volatileFraction: 0-0.7,  // 0 = bone dry, 0.5+ = water world
  surfaceType: 'silicate' | 'carbon' | 'iron-rich' | 'ice-rock',
  density: kg/m³ (derived),
}
```

### 4A.4 Orbital Resonance Chains

**Why:** Real compact systems (TRAPPIST-1, Galilean moons) show integer-ratio orbital periods. This is a signature of gentle migration through a gas disk. Currently we have peas-in-a-pod spacing but no resonances.

**When they form:** Compact systems (≥4 planets, small spacing ratios < 2.0) that didn't experience violent scattering. ~20% of compact systems should show resonance chains.

**Implementation:** Post-placement pass in StarSystemGenerator. If conditions met, snap orbital periods to nearest integer ratios (2:1, 3:2, 4:3, 5:4). Adjust semi-major axes to match (Kepler's 3rd law). Flag `resonanceChain: true` on system data.

**Player impact:** Resonant systems have eerily regular orbital patterns visible in the system map. Future: scanner detects resonance, worth bonus scan data.

### 4A.5 Planetary Migration

**Why:** Hot Jupiters exist because gas giants form beyond the frost line then migrate inward. This explains why some systems have giants in the scorching zone and why those systems have fewer inner planets (the giant scattered or consumed them).

**Migration pass (runs after initial planet placement):**
1. If a gas giant formed in outer zone AND disk mass was high AND rng roll succeeds (~15% of eligible systems):
2. Pick migration target orbit (inner zone or scorching zone)
3. Remove or scatter planets the giant passes through (removed with ~70% probability per planet crossed)
4. Place giant at target orbit → becomes hot jupiter
5. Result: hot jupiter systems have gaps, fewer small planets, disturbed spacing

**Non-migrated hot jupiters:** Current 0.5-1% in-situ placement removed. All hot jupiters come from migration. This means they're more common in metal-rich systems (more gas giants to migrate) and always leave signatures (missing inner planets, wide gaps).

**Outputs:**
```
migrationHistory: {
  occurred: true/false,
  migrantIndex: number,       // which planet migrated
  originalOrbitAU: number,    // where it formed
  finalOrbitAU: number,       // where it ended up
  scatteredCount: number,     // how many planets were destroyed
}
```

### 4A.6 System Formation History

**Why:** Currently archetype (compact-rocky, mixed, spread-giant) is a coin flip. It should derive from formation physics.

**Protoplanetary disk model:**
- `diskMass`: star_mass × (0.01 + 0.04 × 10^metallicity) — metal-rich stars have more solid material
- `dissipationTime`: 1-10 Myr (log-normal). Short → disk evaporated before giants could form → compact rocky. Long → giants had time to form and clear gaps → spread giant.
- `snowLineMigration`: In young systems, the snow line moves outward as the star contracts onto the main sequence. Early-formed planets may have captured volatiles at different distances than the current frost line suggests.

**Replaces:** Current archetype random selection. Archetype becomes an *output* of formation physics, not an input.

### 4A.7 Habitability Scoring

**Why:** Beyond "is it in the HZ" — model whether a planet could support biology. Drives ExoticOverlay decisions (fungal, civilized) and future scanner/exploration gameplay.

**Checklist (each contributes to score 0-1):**
- Atmosphere retained? (§4A.1)
- Liquid water possible? (temperature from stellar flux + greenhouse effect from atmosphere)
- Magnetic field likely? (§4A.3 iron fraction + rotation rate)
- Stable orbit? (not chaotic from nearby giant perturbation)
- Age sufficient? (>0.5 Gyr for simple life, >2 Gyr for complex, >4 Gyr for civilization potential)
- Tidal heating in range? (too much = Io hellscape, too little = frozen, moderate = subsurface ocean)

**Output:** `habitabilityScore: 0-1` on planet data. ExoticOverlay uses this instead of simple "is it terrestrial + in HZ?" check.

### 4A.8 Stellar Evolution

**Why:** The galaxy has `ageGyr` per position. Old regions should have evolved stars. Currently all stars are main-sequence.

**Main-sequence lifetime by mass:**
- O: ~3-10 Myr, B: ~10-100 Myr, A: ~0.4-2 Gyr, F: ~2-7 Gyr
- G: ~7-15 Gyr, K: ~15-30 Gyr, M: ~50+ Gyr (longer than universe age)

**If system age > main-sequence lifetime:**
- Massive stars (O/B/A) → white dwarf (most common), neutron star (if M > 8 M☉), black hole (if M > 25 M☉)
- Generation path branches: remnant star + disrupted planetary system (inner planets gone, outer orbits perturbed, possible planetary nebula shell)

**Young stars (age < 10 Myr):** May still have protoplanetary disk remnants — debris rings instead of mature planets.

### 4A.9 Binary Star Effects

**Why:** Binary stars currently don't affect planets beyond a minimum orbit distance. They should shape the entire system.

**Stability limits:** Planets inside ~3× binary separation are unstable over geological time. Remove any that end up there during generation.

**Circumbinary HZ:** Wider and shifted outward compared to single-star HZ. HZ calculation uses combined luminosity but accounts for orbital variation (planet receives varying flux as binary orbits).

**S-type vs P-type orbits:** Current implementation is P-type only (planets orbit both stars). Future: tight binaries get P-type, wide binaries can have S-type (planet orbits one star, other star is distant companion).

### 4A.10 Impact History

**Why:** Planetary surfaces should record their history. Young systems → heavy bombardment → cratered. Old systems → weathered/eroded. Proximity to belts → more impacts.

**Inputs:** System age, proximity to asteroid belt, nearby giant (gravitational stirring), number of other bodies in zone (collision probability).

**Output:**
```
surfaceHistory: {
  bombardmentIntensity: 0-1,  // drives crater density in future LOD shaders
  erosionLevel: 0-1,          // atmosphere + water + time → surface smoothing
  resurfacingRate: 0-1,       // volcanism/tectonics cover old craters
}
```

**Shader impact (future):** Crater density, erosion smoothing, and volcanic resurfacing become shader parameters when higher-LOD planet surfaces are built.

---

## 4B. Rings — Physics-Driven [BOTH]

### Design Principle
**Rings form for specific physical reasons.** Each origin produces a distinct ring type with different composition, density, structure, and age. No more flat probability rolls with random radii.

### Ring Formation Origins

| Origin | Cause | Composition | Structure | Probability Driver |
|--------|-------|-------------|-----------|-------------------|
| **Roche disruption** | Moon wandered inside Roche limit, torn apart by tidal forces | Matches destroyed moon: icy moon → bright ice rings (Saturn-like), rocky moon → dark dusty rings (Uranus-like) | Dense, well-defined edges, multiple ringlets | Planet has moons + system is old enough for orbital decay |
| **Accretion remnant** | Leftover protoplanetary material that never coalesced | Dusty, mixed composition | Broad, diffuse, no sharp edges | Young systems, gas giants |
| **Collision debris** | Two moons collided | Heterogeneous, clumpy | Asymmetric, concentrated in one orbital band, possible "missing moon" gap | Systems with multiple moons on crossing orbits |
| **Outgassing capture** | Material from volcanic moon (like Jupiter's ring from Io) | Thin dust/sulfur | Tenuous, aligned with source moon's orbit | Volcanic moon exists (tidal heating > threshold) |

### Ring Physics Properties

**Inner edge:** Roche limit calculation: `R_roche = R_planet × 2.44 × (ρ_planet / ρ_ring)^(1/3)`. For fluid bodies (ice) this is ~2.44× planet radius. For rigid bodies (rock) it's ~1.26×. The inner edge of the ring IS the Roche limit — this is non-negotiable physics.

**Outer edge:** Limited by nearest moon's orbit. Shepherd moons define ring edges (as Prometheus/Pandora do for Saturn's F ring). If no nearby moon, ring spreads until gravitational perturbation from more distant moons clears it.

**Gaps:** Orbital resonances with moons clear lanes in the ring. Each moon with an orbit period that's an integer ratio of a ring particle's period creates a gap at that radius. The Cassini Division is a 2:1 resonance with Mimas. Implementation: for each moon, calculate resonance radii within the ring and clear gaps there.

**Density vs age:** Rings are not permanent. Icy rings darken and thin over ~100 Myr as micrometeorite bombardment and Poynting-Robertson drag remove material. Ancient rings are tenuous ghosts. Young rings (from recent disruption/collision) are dense and bright.

**Tilt:** Rings lie in the planet's equatorial plane. Ring tilt = planet's axial tilt. Not random.

### Ring Data Structure
```
rings: {
  origin: 'roche' | 'accretion' | 'collision' | 'captured',
  composition: 'ice' | 'rock' | 'dust' | 'mixed',
  innerRadius: <Roche limit>,
  outerRadius: <shepherd moon orbit or stability limit>,
  mass: <derived from origin event>,
  ageMyrs: <time since formation event>,
  density: <function of mass, spread, and age>,
  ringlets: [
    { innerR, outerR, opacity, composition },  // distinct bands
  ],
  gaps: [
    { radius, width, causingMoonIndex },  // resonance-cleared lanes
  ],
  tiltX: <planet axialTilt>,
  tiltZ: <planet axialTilt Z component>,
  color1: <derived from composition>,
  color2: <derived from composition>,
}
```

### Ring LOD (Visual Scaling)

**Distance:** Thin line with color/opacity variation (current approach, but driven by ringlet data).

**Medium:** Individual ringlets become visible as concentric bands. Gaps appear. Composition-driven color differences between inner (possibly rockier) and outer (icier) ringlets.

**Close-up (inside or skimming the ring plane):** Ring resolves into individual bodies — ice chunks, rock fragments, dust. Low-poly geometry with Bayer dithering matching the retro aesthetic. Particle sizes follow power law (many dust-grain, few house-sized). Tumbling, catching starlight, casting shadows on each other.

**At speed:** See §4C (Traversal Hazards).

---

## 4C. Asteroid Belts — Physics-Driven [BOTH]

### Design Principle
**Belts exist where planets couldn't form.** A belt is the absence of a planet, caused by gravitational interference from a nearby giant. No flat probability rolls — belt existence, location, and properties emerge from the system's formation history.

### When Belts Form

A belt forms when ALL of these conditions are met:
1. **A gas giant exists** in the system (its gravity prevents accretion in the resonance zone)
2. **Sufficient disk mass** remained in the resonance region (metallicity-driven)
3. **The giant did NOT migrate through the region** (migration scatters belt material — §4A.5)

If no gas giant exists, there is no dynamical mechanism to prevent accretion → no belt (material would have formed a planet). This alone makes belts emergent rather than random.

### Belt Types

| Type | Location | Composition | Cause |
|------|----------|-------------|-------|
| **Main belt** | Between inner rocky planets and first gas giant | Silicate → carbonaceous gradient (inner to outer) | Giant's 2:1 and 3:1 resonances prevent planet formation |
| **Outer/Kuiper belt** | Beyond outermost gas giant | Icy (water ice, CO₂ ice, ammonia ice), very dark | Giant cleared inner material, leftover icy planetesimals remain |
| **Trojan clusters** | At L4/L5 Lagrange points of gas giants | Matches belt composition at that orbital distance | Gravitational trapping in co-orbital resonance |
| **Debris disk** | Young systems (< 100 Myr) | Dust, ice, rock mixture | Protoplanetary disk hasn't fully cleared yet |

### Belt Internal Structure

**Kirkwood gaps:** The nearby giant's orbital resonances (3:1, 5:2, 7:3, 2:1) clear specific radii within the belt. These are calculated from the giant's orbital period using Kepler's 3rd law. The belt is not uniform — it has density peaks and valleys that are a direct fingerprint of the giant's influence.

**Compositional gradient:** Real belts show a gradient driven by distance from the star:
- Inner belt (closer to star): S-type asteroids — silicate/stony, lighter color, higher albedo
- Mid belt: mixed
- Outer belt (closer to frost line): C-type asteroids — carbonaceous, very dark (albedo 0.03-0.10), contain water-bearing minerals
- Scattered: M-type asteroids — metallic (exposed iron-nickel cores of shattered differentiated bodies), bright, specular reflections

**Families:** 2-5 collision families per belt. Each family is a cluster of asteroids on similar orbits with similar composition — the fragments of a single parent body that was shattered. Families are identified by tight orbital parameter clustering and shared color/albedo.

### Belt Data Structure
```
asteroidBelt: {
  type: 'main' | 'kuiper' | 'debris',
  formationCause: {
    giantIndex: number,           // which giant created this belt
    resonanceType: '3:1' | '2:1', // dominant clearing resonance
  },
  innerRadiusAU, outerRadiusAU,
  totalMass: <fraction of Earth mass>,
  age: <system age>,
  kirkwoodGaps: [
    { radiusAU, width, resonanceRatio },
  ],
  compositionZones: [
    { innerAU, outerAU, type: 's-type' | 'c-type' | 'm-type', albedo, color },
  ],
  families: [
    { centerRadiusAU, spread, count, color, parentBodyRadius },
  ],
  asteroids: [ ... ],  // individual bodies with positions, sizes, colors
}

trojanCluster: {
  giantIndex: number,
  lagrangePoint: 'L4' | 'L5',
  count: number,
  spreadAngle: degrees,  // how widely distributed around the L-point
  composition: <matches belt at that orbital distance>,
  asteroids: [ ... ],
}
```

### Belt LOD (Visual Scaling)

**System view (distant):** Belt rendered as a torus of point sprites — same as current, but with visible density variation (gaps appear as dark lanes), color gradient from inner to outer, and family clumps as brighter concentrations.

**Approaching:** Individual rocks start resolving. Families become visible as color-coherent clusters. The largest asteroids (>100 km equivalent) get names/types on the body info HUD.

**Inside the belt:** Field of tumbling rocks at varying distances. Composition visible — dark C-types vs lighter S-types vs metallic M-type glints. Parallax from different orbital velocities (inner rocks move faster). Collision family members travel on near-parallel paths.

### Traversal Hazards [GAME]

**The physics-honest model:** Real belts are absurdly sparse. Average spacing between main belt asteroids is ~1-3 million km. You could cross our belt blindfolded at walking speed and never hit anything.

**But at relativistic in-system speeds:** Your collision cross-section expands enormously. Even sparse debris becomes dangerous when you're crossing millions of km per second. The hazard is not dodging rocks — it's that kinetic energy scales with v².

**Hazard model (A+C hybrid):**

**Baseline belt traversal at speed:**
- Continuous micro-damage proportional to: `beltDensity × shipSpeed² × crossSection`
- Denser belts (metal-rich systems, young systems) = more damage
- Shields/deflector absorb micro-impacts but drain energy
- Player choice: slow down (time cost) or punch through (energy/hull cost)
- Visually: occasional spark/flash on the hull, increasing in frequency with speed and density

**Dense pockets (the Option C layer):**
- **Collision families** are localized dense regions — a recent breakup hasn't had time to spread
- **Resonance pile-ups** where Kirkwood gap edges concentrate material
- **Trojan clusters** around gas giant L-points
- These regions are 10-100× denser than the belt average
- Flying through at speed: visible rocks streaking past, proximity alerts, shield impacts, potential hull damage
- Flying through slowly: navigable, visually dramatic (rocks all around you, tumbling, catching light)
- Nav computer highlights dense regions so you can route around them or through them

**Rings as barriers:**
- Planetary rings are orders of magnitude denser than belts
- At high speed, traversing a ring's equatorial plane = hitting a wall of material
- Effectively solid at relativistic speed — treat as collision with planet
- Forces approach vectors from above/below the ring plane
- Creates real navigation topology around ringed planets: equatorial exclusion zone
- At low speed: navigable but hazardous. Dense ringlets are impassable, gaps between ringlets are safe corridors. Shepherd moon positions mark the edges of safe passages.

### Trojan Asteroids

**Formation:** Bodies trapped at the L4 and L5 Lagrange points of gas giants — 60° ahead and 60° behind in the giant's orbit. Gravitationally stable (tadpole orbits around the L-point).

**When they exist:** Any gas giant can have Trojans. More massive giants trap more. Jupiter has more Trojans than the entire main belt. Implementation: for each gas giant, ~60% chance of L4 cluster, ~60% chance of L5 cluster (independent rolls). Count scales with giant mass.

**Spread:** Trojans don't sit at a point — they librate (oscillate) around the L-point in tadpole-shaped orbits. Spread angle ~20-40° in longitude, ~15° in inclination. Renders as an elongated cloud leading/trailing the giant.

**Composition:** Matches whatever's expected at that orbital distance. Inner system Trojans: rocky. Outer system Trojans: icy/dark.

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

### Splash Screen Sequence [BOTH]

The app requires a click to enter — this is both a design choice (dramatic ramp-up) and a technical requirement (browsers require user interaction before playing audio).

**Sequence (~6 seconds total):**
1. **Click to enter** — black screen with minimal prompt
2. **Splash 1:** Production company logo (fade in/out)
3. **Splash 2:** Composer credit (Christian) (fade in/out)
4. **Fade into title screen** — BGM is already playing by this point

**Audio:** The `splash-ramp` track begins on click and builds over ~6 seconds, seamlessly transitioning into the `title` track as the title screen appears. The player never experiences silence after clicking — the music starts immediately and grows.

**Design questions to flesh out:**
- Production company name/logo design
- Timing split between the two splash screens (e.g., 2.5s + 2.5s + 1s fade to title?)
- Visual style of splash screens — minimal text on black? Animated? Match the retro CRT aesthetic?
- Skip behavior — can the player click through splashes, or are they unskippable on first launch?

### Current State [SCREENSAVER]
- **System map minimap** (top-down radar, 192px HUD overlay)
- **Gravity well map** (3D vertex-displaced contour, toggled with G)
- **Body info HUD** (top-left popup on selection)
- **Orbital overlay** (O key, orbit lines)

### Click-and-Hold Magnification Window [BOTH]

A targeting loupe for selecting background stars. Bridges to macOS and mobile where precise clicking on tiny stars is difficult.

**How it works:**
- Click and hold anywhere on screen → a magnification circle expands outward from the click point
- The circle shows a zoomed-in view of the background starfield around the cursor
- While holding, the user can see individual stars clearly within the magnified area
- On release → the star closest to the center of the magnification window is selected as the warp target
- If no star is near center on release → no selection (cancels)

**Design questions to flesh out:**
- Magnification level — 2x? 4x? Adjustable?
- Circle size — fixed max size or grows until release?
- Visual style — lens distortion at edges? CRT-style magnification? Clean circle with border?
- Does the magnified view show star names/types or just the visual?
- Mobile: does this replace tap-to-select entirely, or augment it?
- Animation: how fast does the circle expand? Instant or ~200-300ms ease-out?

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
- **Freighters** (1-2 on long routes, 5 subtypes: spine hauler, catamaran, box hauler, disc, tanker tug)
- **Cruisers** (1-2 patrol)
- **Capitals** (0-1, 20% of systems, deep space)
- **Explorers** (0-1, outer system)

**Ship population reflects system properties:**
- Compact-rocky systems → mining ships, surveyors
- Civilized systems → shuttles, fighters, patrols
- Metal-rich industrial → freighter convoys, construction vessels
- Empty/frontier → lone explorer or nothing at all

#### Ship Generation Pipeline (Decided 2026-03-15)

**Architecture: Composable GeoNodes + Procedural Shader + Python Batch Export**

Three layers:
1. **Geometry Nodes** — Shape generation. A library of reusable component sub-groups (Hull_Cylinder, Hull_Slab, Wing_Pair, Engine_Pod, Engine_Bank, Cockpit, Cargo_Pod, Bridge_Tower, Greeble_Strip, Sensor_Dish) wired together inside archetype-specific assembler node groups. Each component handles its own geometry + UV computation. Assemblers position components relative to hull dimensions via math-driven Transform nodes — fully interactive in the Blender viewport.
2. **Shader Nodes** — Chris Foss-inspired paint patterns (stripes, chevrons, bands). Procedural, reads shared "UVMap" attribute. Different UV scales per component = distinct panel-paint effect across hull, wings, pods.
3. **Python** — Batch orchestration. Manages 10-15 Foss color palettes as data, loops over seeds, sets modifier/shader values, bakes shader to 128×128 image texture, exports .glb. Each archetype × N seeds = fleet.

**Seed system:** One master Seed integer per assembler. Derived sub-seeds (Seed+N) feed Random Value nodes that offset slider base values within defined ranges. One seed = one unique ship variant.

**Complex archetypes:** Freighter uses an integer Subtype input (0-4) with Switch geometry nodes to select between 5 configurations. Capital Ship composes many Greeble_Strip instances across its hull surface.

**Working file:** `C:\Users\Max\Documents\Blender\procedural_ships.blend`

#### Concept Design Workflow

Max sketches archetypes in **Procreate on iPad**, exports to Google Drive "Claude Inbox" folder, Claude reads via MCP.

**Per-archetype sketch convention:**
- 3 orthographic views (side, top, front) with depth-coded flat colors (bright = near camera, dark = far)
- Annotated distinct volumes ("hull," "wing," "engine pod," "cargo bay")
- Modular parts noted ("repeats ×4-8")
- Optional: skeleton axis line, relative size callouts

**Per-archetype build cycle:** Concept sketch → Claude reviews → build GeoNodes → Max tunes in viewport → seed sweep test (5-10 seeds) → approve → batch export.

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

### 8H. Propulsion & Travel Landscape [GAME] (Lore Seeds)

The universe has a layered travel infrastructure. Most people rely on built infrastructure for long-distance travel. The player's ship is the exception.

#### Laser Highways (Civilized Systems)

Infrastructure-dependent **laser sail corridors** for relativistic in-system travel (~0.1c–0.5c). Think interstate highways in space — massive laser arrays at one end, sail ships glinting as they accelerate along fixed routes. NPCs and commerce use these. They connect planets, stations, and resource nodes within a system.

**Gameplay texture:** The player sees these but doesn't use them. Fly past the traffic, the infrastructure, the signs of civilization. Laser highways are **scenic features** — evidence of the living universe, not something you depend on.

#### Stabilized Warp Gates (Civilized Systems)

Fixed installations that create stable fold points for long-distance interstellar travel. Where NPCs congregate, trade happens, stories unfold. These are the on-ramps and truck stops of the galaxy — social hubs, chokepoints, places where factions project power.

**Gameplay texture:** The player CAN use them but doesn't NEED to. Gates are **social/trade hubs** — visit them for commerce, information, NPC encounters, and faction interactions. But the player's personal fold capability means they're never stuck waiting for a gate or limited to gate-connected routes.

#### Standard High-End Drives

**Antimatter-catalyzed fusion** drives are the best that modern corporate and military ships run — capable of 0.3c to 0.9c in-system. Expensive antimatter fuel creates a political and economic layer: who controls the fuel, who can afford it, who gets stranded when supply lines break.

#### The Player's Drive — Pre-Collapse Exotic Tech

The player's ship runs on something different. Not antimatter fusion, not a bigger version of what everyone else has — a **different principle entirely.** Pre-collapse technology from the breakaway line's centuries of independent development. More elegant, more efficient, less dependent on rare fuel. The specifics are deliberately vague (this is lore seed territory, not hard spec), but the key properties are:

- **Personal warp/fold capability** — the ship carries its own fold generator. Gates are infrastructure; the player's ship IS its own gate. This is what most people outside the larger corporate fleets don't have access to.
- **Superior efficiency** — goes farther on less, whatever "less" means for its exotic fuel source
- **Old and temperamental** — generational wealth in hardware form. It works beautifully when it works. Maintenance is part of the experience.

#### Time Debt

Relativistic travel creates time debt — the faster you go, the more time passes for the rest of the universe relative to you. This hits differently depending on who you are:

- **NPCs** accept time debt as commute cost. Take the laser highway, lose a few hours of external time, arrive at your destination. It's baked into civilization.
- **The player** chooses time debt deliberately — pushing into frontier space at high fractions of c, accepting that the universe ages around them. This reinforces the isolation theme: every deep exploration run costs you time with the civilized world.

#### Frontier Space — Where the Ship Shines

Beyond the laser highways, beyond the warp gates, there is nothing but empty space and whatever you brought with you. No infrastructure, no commerce lanes, no rescue. This is where the player's ship is in its element — where personal warp capability and exotic efficiency aren't luxuries but survival necessities. The frontier is the player's domain.

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

#### Combat Input System

Applies to both ship-to-ship combat modes AND on-foot combat (Doom/early PC FPS style with basic mobility). The same core input system works across all combat contexts — only the visual presentation changes.

**Not a rhythm game.** Player inputs are not mechanically tied to the BPM. However, like everything else in the universe, combat **animations and sound effects sync to the system's BPM** (see §2 BPM-Synced Universe). The audiovisual layer is musical; the player's actions are pure action-game.

**Three actions: Ranged Attack, Melee/Ram, and Defend.** Each uses hold-and-release mechanics:

**Rule of Three — Pick Any Two:**

Three chargeable actions, but you can only hold/charge **two at a time**, never all three. This creates meaningful tactical choices in every moment:

| Combo | What It Looks Like (Ship) | What It Looks Like (On-Foot) |
|-------|--------------------------|------------------------------|
| **Boost + Ranged** | Jet backward/sideways while unleashing charged laser beam — kiting, retreating fire | Jetpack dodge while firing precision ray |
| **Boost + Melee** | Charge forward into a ram with charged laser weapon leading — aggressive rush | Jet forward into charged sword lunge — closing distance fast |
| **Boost + Shield** | Shield bash (boost into enemy with shield up) or serious retreat with shield absorbing fire | Jetpack retreat under cover of shield, or shield-charge forward to close gap safely |
| **Shield + Melee** | Hold shield while charging sword, waiting for counter-attack as enemy advances — defensive patience | Same — turtle up, wait for opening, unleash melee strike |
| **Shield + Ranged** | Hold shield while charging beam — drop shield and fire the moment the opening appears | Same — defensive sniper posture |
| **Melee + Ranged** | Charge both weapons simultaneously — aggressive all-in with no defense | Sword in one hand charging, ray in the other — maximum offense, maximum risk |

**What you CAN'T do:** All three at once. No boosting while shielded while charging a weapon. You always have one system offline, which means you're always making a trade-off.

**Precedent:** Star Fox boost/brake + shoot + bomb system. The key insight is that limiting to two creates constant decision-making without overwhelming the player with inputs.

##### Newtonian Combat Physics

Every attack produces equal and opposite reaction forces on both combatants. This is the spatial backbone of the combat system.

**How it works:**
- **Melee/ram:** You lunge forward and connect → both you and the enemy are pushed apart. A charged ram hit sends both parties flying backward from the impact point.
- **Ranged beam:** Firing a charged beam produces recoil — a pinpoint long-charge shot pushes you backward noticeably. A quick-tap scatter shot has minimal recoil.
- **Shield bash (boost + shield):** Ramming with shield up pushes the enemy back hard but you absorb the counter-force through the shield rather than taking damage.

**Why this matters:**
- **Prevents stun-locking.** Every hit creates separation, giving both sides a moment to reposition and decide their next move. You can't just mash attack and pin someone in a corner.
- **Enables combos through physics.** A skilled player can chain: ram enemy into an asteroid → boost backward → charge pinpoint beam while they're recovering → fire. Or: shield bash to close distance → immediately charge melee while they're reeling from the push → release sword strike before they recover.
- **Creates spatial flow.** Fights naturally move through space. Two ships dueling will drift across the system. On foot, fights move down corridors and through rooms. The environment becomes part of the fight — getting pushed into a wall, using a boost to arrest your knockback, ramming someone toward a hazard.
- **Boost becomes defensive AND offensive.** Use boost to arrest your knockback after getting hit. Use boost to chase an enemy you just knocked away. Use boost to deliberately create distance after a melee exchange.

**Design questions to flesh out:**
- Force scaling — does a longer charge produce more knockback?
- Mass differences — does a bigger ship/enemy get pushed less? Does the player's ship mass change with upgrades?
- Environmental collisions — what happens when knockback pushes you into a wall, asteroid, or structure? Damage? Stun?
- On-foot gravity — do planetary interiors have gravity that dampens vertical knockback, or is it all zero-g?
- Recovery time — how quickly can you act after being knocked back? Is there a brief stagger window?

##### Attack (Fire Button)

Simple, Star Fox / Panzer Dragoon style:

| Input | What It Does |
|-------|-------------|
| **Rapid press** | Particle cannon — fires as fast as you can mash the button. Quick shots, lower damage per hit. |
| **Hold and release** | Charged laser cannon — hold to gather energy, release to fire a powerful charged shot. |

That's it for attacking. Simple, intuitive, skill ceiling comes from combining with boost and shield.

##### Boost / Movement (Boost Button)

| Input | What It Does |
|-------|-------------|
| **Quick tap** | Quick dodge/juke — short burst in a direction |
| **Hold and release** | Charged boost — powerful thrust, covers real distance. Direction set by your input at release. |

Works as ship thrusters or on-foot jetpack. Forward, backward, lateral, up, down.

##### Defense (Shield Button)

**Shield (hold):**
- Press and hold the defend button
- ~0.5-1 second charge-up animation as the shield powers on (vulnerable during ramp-up)
- Shield stays active while held — absorbs incoming damage
- Release to drop shield — weapon systems come back online

**Parry (tap):**
- Quick tap at the right moment — timing-based
- Tighter window than shield but more rewarding (deflect? stagger? bonus opening?)
- Exact parry mechanics TBD

##### Combat Flow Example

1. Enemy winds up attack (telegraphed visually)
2. You hold defend → shield charges up → shield absorbs the hit
3. You release defend → shield drops, weapon comes back online
4. You immediately begin holding attack → beam gathers from diffuse to focused
5. You release attack → pinpoint shot hits enemy
6. Enemy begins next attack cycle → you decide: shield up again, or charge a ram?

##### On-Foot Combat Context

First-person, Doom-style. Corridors in stations, derelicts, planetary structures. Same three-action system:
- Attack: rapid-press particle weapon + hold-to-charge laser
- Defend: personal shield (hold to maintain, tap to parry)
- Boost: jetpack (hold to charge, release to thrust in any direction)
- Same rule of three applies — pick any two, never all three.

**Design questions to flesh out:**
- Exact charge thresholds — what counts as quick tap vs short hold vs long hold?
- Parry mechanics — cursor-position-dependent? Timing-only? What's the reward?
- Shield charge-up time — 0.5s or 1s? Does this scale with upgrades?
- Can you cancel a charge (attack or defend) mid-hold?
- Ram attack — how far does the dash carry you? Collision physics?
- On-foot: separate game mode or seamless transition from ship?
- Weapon upgrades — do they affect charge speed, max focus, shield strength?

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
**Current:** Vite + Three.js (vanilla JS, no framework)
**Future (game mode):** Godot (under evaluation for engine migration)

### Engine Migration Strategy

**Decision (2026-03-15):** Three.js remains the engine for the screensaver (Layer 1 + Layer 2). When game mode development begins in earnest (ship movement, combat), evaluate building it in **Godot** instead.

**Why migrate for game mode:**
- Browser GPU crashes can silently drop to software rendering (experienced 2026-03-14 — Chrome GPU process crash caused full software fallback, player wouldn't know why it's slow)
- Steam/app store distribution requires native executable — browser-wrapped games (Electron/Tauri) feel second-class
- No successful paid games on Steam are browser-based
- Performance ceiling: WebGL is a subset of full GPU capability
- Audio limitations (browser autoplay policies, Web Audio API quirks)
- Can't control the player's browser environment

**Why Godot specifically:**
- Open source, no royalties
- Lightweight, good for indie scale
- Exports to Steam, Windows, Mac, Linux, mobile
- GDScript is beginner-friendly
- Can import .glb models directly (existing ship pipeline works)
- Retro shaders are very doable (custom shader language similar to GLSL)

**What ports cleanly:**
- All procedural generation code (GalacticMap, StarSystemGenerator, PlanetGenerator, etc.) is pure math with no Three.js dependency — ports to any language
- GLSL shaders port to Godot's shader language with minor syntax changes
- Game bible, design decisions, audio assets, music — all engine-independent
- Blender model pipeline (.glb export) works with Godot directly

**What doesn't port:**
- Three.js-specific rendering code (RetroRenderer, Starfield, Galaxy, Planet mesh construction)
- Scene management and camera code
- UI code (settings panel, body info, etc.)

**Timeline:** Keep building in Three.js for now — it's fast to iterate. Begin Godot evaluation when the first game-mode prototype is needed (ship movement + combat).

### Key Architecture Decisions
- **Data-first generation:** Generators produce plain JS objects, no Three.js dependency. Meshes built separately. **This is intentional for engine portability.**
- **Deterministic seeds:** Same seed → identical system. `.child()` creates independent sub-streams.
- **Per-object dithering:** Bayer dithering in each object's fragment shader, not a screen filter.
- **Dual-resolution rendering:** Scene at low res, starfield at full res, composited with alpha-based shader.

### Development Philosophy [BOTH]

These principles govern all development decisions. They emerged from hard-won lessons during the project and must be followed at every stage.

#### 1. Hash Grid Authority
The hash grid IS the galaxy. Every star the player can see, visit, or interact with comes from `HashGridStarfield`. There is no parallel star system. The nav computer, the sky renderer, the warp system, and all future features read from the same source. If a feature needs star data, it queries the hash grid — never a separate list, cache, or approximation.

**Why:** The original sector-based system produced different stars than the sky renderer, causing bugs where warping to a star in the nav computer resolved to the wrong star. Unifying on the hash grid eliminated an entire class of consistency bugs.

#### 2. No Tack-On Systems
Every feature must flow naturally from the generation pipeline. If rendering needs data that generation doesn't provide, the fix is ALWAYS in generation — never in rendering.

**The test:** If you removed the feature code, would the generation pipeline still produce correct data that the feature could use? If the pipeline doesn't produce the right data, fix the pipeline — don't add a post-process that papers over it.

**Why:** Multiple times, features were built by hacking visual output (recoloring background stars to fake cluster membership, adding screen-wide filters). These looked like filters, not like authentic world properties. The pipeline must produce truth; rendering just displays it.

#### 3. Per-Object Retro Aesthetic
Dithering, posterization, and resolution reduction happen per-object in fragment shaders — not as a screen-wide post-process filter. Each visual layer (stars, planets, nebulae, galaxy glow, HUD) may render at its own resolution.

**Why:** A screen-wide retro filter looks like a filter applied to a modern game. Per-object retro rendering looks like an authentic retro game. The difference is immediately visible and fundamental to the aesthetic.

#### 4. BPM-Synced Animation
All camera movements, autopilot transitions, and sound effects synchronize to a master BPM clock. The screensaver is a musical experience — everything happens in time.

**Why:** The screensaver is Max's brother's musical showcase. Random timing looks random; beat-synced timing looks intentional and cinematic. BPM sync is what makes the screensaver feel designed rather than procedural.

#### 5. Model Produces → Pipeline Carries → Renderer Consumes
Data flows one direction through the system:
- **Model** (GalacticMap, hash grid, generators) produces raw data
- **Pipeline** (star data objects, system data objects) carries it
- **Renderer** (Three.js meshes, shaders, HUD) consumes and displays it

Never go backward. The renderer never writes data that the model reads. The pipeline never modifies what the model produced. If the renderer needs different data, change the model.

**Why:** Bidirectional data flow creates circular dependencies and makes bugs impossible to trace. One-directional flow means every bug has a clear origin: either the model produced wrong data, the pipeline lost it, or the renderer displayed it incorrectly.

#### 6. First Principles Over Patches
If a system needs more than 2-3 patches to achieve a goal, the architecture is wrong. Stop patching, step back, and ask whether the underlying design supports what you're trying to do. Redesign the piece, don't keep adding tape.

**Why:** The original sector system (12 stars per sector) was patched repeatedly to produce more stars. Each patch created new bugs. Stepping back and rebuilding on a hash grid (200+ billion stars) solved everything the patches were trying to fix — and opened capabilities that patches never could have.

### Runtime GPU Detection [BOTH]

The game should check the WebGL renderer at startup. If it detects software rendering ("Basic Render Driver", "SwiftShader", "llvmpipe"), display a warning: **"Performance warning: GPU not detected. Restart your browser for the best experience."**

This addresses a known Chrome issue where a GPU process crash silently falls back to CPU rendering for the rest of the session. A browser restart fixes it, but the player needs to know.

### Performance / Optimization Strategy

**Measured performance (2026-03-14):**
- Starfield generation (18K stars, ray-marched density): ~13-20ms per warp (budget: 3000ms tunnel)
- Sector generation + nearest star search: ~2ms
- Galaxy context derivation: <1ms
- GalacticMap sector cache: 64 sectors max, LRU eviction

**Known performance issue:**
- **Galaxy glow (diffuse band):** FBM noise billboard layers (nebula-style) cause severe frame drops from overdraw. 6-12 overlapping full-res fragment shader passes is too expensive for continuous display. **Fix needed:** pre-bake the FBM to a texture during warp (compute once, not per-frame), then display on a simple textured sphere at near-zero cost.

**Three.js limitations tracked:**
- No compute shaders (WebGL2) — all generation is CPU-side, which is fine
- No built-in text rendering — solved by 2D canvas approach for nav computer
- Full-res FBM shader overdraw is the main GPU bottleneck encountered so far
- Starfield at full resolution (not pixelScale-reduced) is necessary for crisp star points but means any background effects also run at full res
- Dynamic buffer updates fine up to ~20K points; beyond that needs profiling
- 4 render passes at 1080p is comfortable; 5th pass (future CRT shader) should be fine
- **Verdict so far: Three.js is sufficient. The overdraw issue is a design problem (too many overlapping FBM layers), not an engine limitation.**

**General rules:**
- **LOD budget:** Billboard system handles sub-pixel objects. High-LOD tier needs testing.
- **Draw call budget:** Needs profiling — establish target and monitor.
- **Instancing:** Already used for asteroids. Extend to repeated geometry.
- **Memory:** Galaxy sectors cached with LRU. Only nearby sectors live in memory.
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

## 12. Galaxy-Scale Generation (Partially Implemented)

### Design Principle: Top-Down Cascade
**All information flows downward. No entity needs knowledge of its siblings or children to generate itself.** This is what makes deterministic seed-based generation possible — you can generate any star system in the galaxy without generating any other.

Each level only needs: (1) its parent's context, (2) its own position within the parent, and (3) its own seed derived deterministically from parent seed + position.

Cases that *appear* bottom-up are handled as statistical proxies at the parent level. Example: an emission nebula's appearance doesn't depend on the specific stars inside it — it's computed from the expectation of what a spiral-arm star-forming region contains. The specific stars inherit the nebula's context, not the other way around.

### Generation Hierarchy (6 Levels)

```
LEVEL 0: GALAXY
  Input:  Master seed
  Output: Structure (arms, bulge, disk, halo density model),
          arm positions, global parameters
  Lives:  GalacticMap constructor (computed once)

LEVEL 1: GALACTIC FEATURES (not yet built)
  Input:  Galaxy structure + density model
  Output: Positioned large-scale features (nebulae, clusters, OB associations)
          Each has: position, radius, type, seed, properties
  Lives:  GalacticMap.generateFeatures() (computed once or lazily by region)
  Stored: Feature list on GalacticMap, spatial index for lookup

LEVEL 2: SECTOR (0.5 kpc cube)
  Input:  Grid position + galaxy density at that position
  Output: Stars (count, positions, seeds) + local features
          Checks "which Level 1 features overlap this sector?"
          Stars inside a feature inherit its context
  Lives:  GalacticMap._generateSector() (cached, LRU)
  Stored: Sector cache with stars[] and features[]

LEVEL 3: STAR SYSTEM
  Input:  Star seed + galaxyContext (from Level 2) + featureContext (if in a feature)
  Output: Complete system: star(s), formation, planets, belts, moons
  Lives:  StarSystemGenerator.generate(seed, galaxyContext)

LEVEL 4: BODY (planet/moon)
  Input:  Parent system context (zones, metallicity, age, star mass)
  Output: Type, composition, atmosphere, tidal state, habitability, rings
  Lives:  PlanetGenerator.generate(), MoonGenerator.generate()

LEVEL 5: SURFACE (future)
  Input:  Body context (composition, age, bombardment, erosion, tidal heating)
  Output: Terrain heightmap, crater density, biome distribution
  Lives:  Not built yet — placeholder data in surfaceHistory
```

### Data Flow Diagram

```
Master Seed
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ LEVEL 0: GALAXY                                      │
│ Arms, bulge, disk, halo density model                │
│ f(seed) → structure                                  │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│ LEVEL 1: GALACTIC FEATURES                           │
│ f(galaxy structure) → positioned nebulae, clusters   │
│ Spiral arm core → emission nebula                    │
│ Halo/bulge → globular cluster                        │
│ Each feature: { pos, radius, type, seed, context }   │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│ LEVEL 2: SECTOR                                      │
│ f(grid pos, galaxy density, overlapping features)    │
│ → stars[] with seeds                                 │
│ → small features (individual remnants, PN)           │
│ Stars inside a Level 1 feature inherit its context   │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│ LEVEL 3: STAR SYSTEM                                 │
│ f(star seed, galaxyContext, featureContext)           │
│ → star type, formation history, planets, belts       │
│ → stellarEvolution: main-seq / red-giant / remnant   │
│ → PhysicsEngine: atmosphere, tides, composition      │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│ LEVEL 4: BODY (planet/moon)                          │
│ f(parent system zones, metallicity, age)             │
│ → composition, atmosphere, tidal state               │
│ → habitability, surface history, rings               │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│ LEVEL 5: SURFACE (future)                            │
│ f(body composition, age, bombardment, erosion)       │
│ → terrain, craters, biomes                           │
└──────────────────────────────────────────────────────┘
```

### Level 1: Galactic Features — Design

Large-scale features that span multiple sectors. Generated from the galaxy's density/age model — they exist at specific positions for specific physical reasons.

**Feature Types:**

| Feature | Where It Forms | Why | Size | Navigable? |
|---------|---------------|-----|------|------------|
| **Emission nebula** (H II region) | Spiral arm cores, armStrength > 0.7 | Active star formation, ionized gas from young O/B stars | 30-100 pc | Yes — gas clouds, embedded young stars |
| **Dark nebula** | Spiral arm edges, high dust density | Cold molecular cloud, pre-star-formation | 5-50 pc | Yes — visibility drops, scanner impaired |
| **Planetary nebula** | Near white dwarfs (evolved stars) | Dying AGB star shed envelope, <30 kyr ago | 0.1-1 pc | Yes — small shell, central white dwarf |
| **Supernova remnant** | Near neutron stars / black holes | Expanding shock shell from massive star death | 1-30 pc | Yes — shock front, central remnant |
| **Open cluster** | Spiral arms, age < 1 Gyr | Stars born together, not yet dispersed | 2-20 pc | Yes — dense star field, shared properties |
| **Globular cluster** | Halo + bulge, age > 10 Gyr | Ancient gravitationally bound cluster | 10-100 pc | Yes — extremely dense core |
| **OB association** | Spiral arm cores | Loose grouping of young massive stars | 50-300 pc | Yes — scattered hot stars, surrounding nebulosity |

**Generation logic (per region of galaxy):**
- Query galaxy density model at candidate positions
- Spiral arm core (armStrength > 0.7, thin disk) → roll for emission nebula, open cluster, OB association
- High |z| or large R (halo component > 30%) → roll for globular cluster
- No features in inter-arm gaps or low-density regions (by construction)
- Feature count scales with local star density

**Feature context (passed to systems inside the feature):**
```javascript
featureContext: {
  type: 'emission-nebula',
  age: 2.5,           // Myr — young for star-forming region
  metallicity: 0.1,   // slightly enriched
  starWeightOverrides: { O: 0.15, B: 0.20, ... },  // boosted massive stars
  visualDensity: 0.7, // for sky rendering from inside
  nebulaColor: [0.8, 0.2, 0.1],  // H-alpha red
}
```

### Stellar Remnants: Not a Separate Feature Type

Black holes, neutron stars, and white dwarfs are **star systems whose star has evolved**, not separate galactic features. The `stellarEvolution` data in PhysicsEngine §4A.8 handles this:

- GalacticMap generates sector with appropriate age + star type weights
- StarSystemGenerator receives context, rolls an O-type star in an old region
- `stellarEvolution()` determines: this O-star died → remnant type = black hole
- System generates as a black hole system (accretion disk, disrupted orbits, no habitable planets)

**Visibility from nearby systems:** Neighboring sector stars are known. Any that would be remnants (based on context age vs star type lifetime) get special sky rendering — accretion disk glow, pulsar beam, lensing distortion. This is computed per-star without actually generating the full system.

### Rendering Pipeline (Sky Features)

When you're in a star system, the sky shows nearby galactic features. All top-down from your position:

```
StarfieldGenerator receives:
  1. Player galactic position
  2. GalacticMap density model → background stars (existing)
  3. GalacticMap nearby features → sky feature overlays (new)
     For each feature within ~2 kpc:
       - Angular size = feature.radius / distance
       - Brightness = feature.luminosity / distance²
       - Render as appropriate sky element:
         - Emission nebula: colored glow patch (H-alpha red/OIII teal)
         - Open cluster: concentrated star knot
         - Globular cluster: dense fuzzy sphere
         - Supernova remnant: ring/shell glow
         - Dark nebula: absorption patch (dims stars behind it)
```

**Inside a feature:** When you warp to a star that's inside a nebula, the nebula is visible in ALL directions (you're embedded in it). Sky brightness, color, and dust effects modulate based on the feature's visual density. This replaces the current random deep-sky-object system with physically positioned, galaxy-consistent features.

### What's Built

**Fully working:**
- GalacticMap: structural galaxy, sector generation, context derivation, star placement, nearest-star search, LRU cache
- StarfieldGenerator: galaxy-aware starfield with density-weighted placement, real GalacticMap stars as warp targets, dual projection modes (in-disk ray-march / above-disk face-on)
- GalaxyGlow: analytical density model in GLSL (thin/thick disk + bulge + 4 spiral arms), Bayer dithered, dual rendering (band from inside / spiral from above)
- StarSystemGenerator: accepts galaxyContext for all generation parameters
- PhysicsEngine: 12 physics domains integrated into generation (§4A-4C)
- Warp flow: player position tracked, click resolves to GalacticMap star, context passed through

**Built (2026-03-17):**
- Level 1 feature generation (galactic features layer) ✅
- Feature-aware system generation (featureContext modulating star weights, age, metallicity) ✅
- Sector → feature overlap detection (stars inside features inherit context) ✅
- Galaxy visualization scripts (overview + sector deep-dive) ✅

**Not built yet:**
- Feature visibility in starfield (sky overlays for nearby nebulae/clusters)
- Non-main-sequence star rendering (visual assets for white dwarfs, neutron stars, red giants, black holes)
- Warp-to-feature navigation (clicking a nebula marker in the sky)
- Nav computer galaxy view (features as landmarks)
- Civilization regions (galaxy-scale faction overlay)

### Seed Architecture
```
Master seed
  → Galaxy structure (arm positions, bulge, halo)
    → Galactic features (positioned nebulae, clusters, OB associations)
      → Sector generation (stars + local features, conditioned on overlapping galactic features)
        → Star system (seed + galaxyContext + featureContext)
          → Bodies (planets, moons — physics-driven from parent context)
            → Surfaces (future — terrain from body context)
```

### Civilization Regions
At the galaxy scale, civilization forms **regions**, not isolated dots:
- Clusters of civilized systems with shared trade routes and patrols
- Industrial/mining colonies spread outward from civilized cores into metal-rich neighbors
- Pirate/hostile factions fill the gaps between civilized regions
- Frontier zones at the edges where civilization thins out
- This is an overlay on the galaxy structure — computed after star placement, based on metallicity clusters + age constraints (civilization needs >2 Gyr)

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

### Completed Research
- [x] Zone variability by star type and age → see `docs/RESEARCH_zone-variability.md`
- [x] Planet clustering patterns → implemented via peas-in-a-pod archetype system
- [x] Stellar metallicity effects → implemented via Fischer-Valenti scaling
- [x] Space Engine's approach → documented in research file
- [x] Galactic regional variation → IMPLEMENTED in GalacticMap (component densities, metallicity gradients, age distributions, star-type weights, binary modifiers all vary by position)
- [x] Star age effects on generation → IMPLEMENTED via PhysicsEngine (stellar evolution, atmospheric stripping, tidal locking, surface history all use ageGyr)
- [x] Physics-driven generation (Stellar Forge analysis) → IMPLEMENTED 14 features in PhysicsEngine.js

### Active Research — COMPLETED (2026-03-17)
All four rendering research topics completed. Full results in `docs/RESEARCH_rendering-physics-data.md`.

- [x] Non-main-sequence star visual design — 6 star types designed (white dwarf, neutron star/pulsar, red giant, black hole, Wolf-Rayet, protostar). Red giant: clamped surface + real-size glow. Black hole: accretion disk + UV displacement lensing. Pulsar: rotating billboard cone.
- [x] Ring LOD rendering — 3-tier LOD (distant quad → medium ringlet/gap shader → close-up InstancedMesh particles). Medium LOD: replace hardcoded bands with uniform arrays for physics ringlets/gaps.
- [x] Belt compositional rendering — per-instance color from composition zones (already supported by InstancedBufferAttribute). Kirkwood gaps via generation-time culling. New TrojanCluster.js for L4/L5. ~260 lines total.
- [x] Sky feature overlays — new full-res skyScene pass in RetroRenderer between starfield and scene. Per-feature billboard/point renderers. "Inside feature" ambient tint at 15% blend. Max 8-10 features visible, <1ms each.

### Implementation Priority (from research)
See `docs/RESEARCH_rendering-physics-data.md` for full details. Estimated ~2,200 lines across ~19 files. Priority order:
1. Belt composition + gaps (lowest effort, immediate visual payoff)
2. Trojan clusters (new visible objects)
3. Ring medium LOD (ringlets + gaps in shader)
4. Non-MS star basics (white dwarf, red giant)
5. Sky feature overlays (emission nebula first)
6. Black hole + accretion disk + lensing
7. Ring close-up LOD (particles)
8. Pulsar beam
9. Ring distant LOD
10. Protostar + Wolf-Rayet (rare types, lower priority)

### Design Decided & Implemented (2026-03-17)

**Physics-driven generation overhaul — IMPLEMENTED.** 14 features across planetary physics, rings, belts, and traversal hazards. PhysicsEngine.js (550+ lines), integrated into PlanetGenerator, StarSystemGenerator, MoonGenerator. 110 tests passing.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Atmospheric retention (§4A.1) | ✅ Built | Jeans escape + UV stripping + magnetic fields |
| 2 | Tidal effects (§4A.2) | ✅ Built | Locking timescale + heating + circularization |
| 3 | Composition from star chemistry (§4A.3) | ✅ Built | C/O ratio, iron fraction, volatile budget |
| 4 | Orbital resonance chains (§4A.4) | ✅ Built | Detection + snapping in compact systems |
| 5 | Planetary migration (§4A.5) | ✅ Built | Hot Jupiters from outer zone, scattering |
| 6 | Habitability scoring (§4A.7) | ✅ Built | Multi-factor 0-1 score |
| 7 | Formation history (§4A.6) | ✅ Built | Disk mass + dissipation replaces archetype coin-flip |
| 8 | Binary star effects (§4A.9) | ✅ Built | Stability limits, planet removal |
| 9 | Stellar evolution (§4A.8) | ✅ Built | MS lifetime, remnant type — **needs visual assets** |
| 10 | Impact history (§4A.10) | ✅ Built | Bombardment + erosion + resurfacing — **needs surface LOD** |
| 11 | Ring physics (§4B) | ✅ Built | Roche limit, composition, gaps, age-dependent density |
| 12 | Belt resonance + composition (§4C) | ✅ Built | Kirkwood gaps, S/C/M-type zones |
| 13 | Trojan asteroids (§4C) | ✅ Built | L4/L5 clusters per gas giant |
| 14 | Outer/Kuiper belts (§4C) | ✅ Built | Icy belt beyond outermost giant |

### Gravity-First Generation Principle (2026-03-19)

**Gravity is the unifying principle of Well Dipper.** The gravitational potential field Φ(x,y,z) is the primary data structure. Everything derives from it:

- **Star density** = f(Φ) — more stars where the potential is deep
- **Star types** = from component weights (disk/bulge/halo) at each position
- **Features** = local potential perturbations (Plummer wells for clusters)
- **Brightness** = spectral type + distance → apparent magnitude
- **Gameplay** = energy harvesting, warp cost, escape velocity — all from Φ

**Standard galactic potential components (established astrophysics):**
- Disk: Miyamoto-Nagai potential (a=3.0, b=0.28 kpc)
- Bulge: Hernquist potential (a=0.6 kpc)
- Halo: NFW profile (rs=12 kpc)

**Realistic-scale galaxy:** ~200 billion stars via 7-tier hash grid (one per spectral type, O through M, plus evolved giant tiers Kg/Gg/Mg). ~7,300 visible from the solar neighborhood. Every visible point is a real deterministic star.

**Real astronomical data overlay:** HYG v4.0 catalog (15,598 real stars with names — Sirius, Betelgeuse, etc.) merged with procedural stars. Harris globular cluster catalog (152 real clusters). Real data sits in the same potential field as procedural data.

**Feature counts calibrated to real Milky Way:**
- Emission nebulae: ~2,000 (real: 1,500-3,000)
- Open clusters: ~1,700 (real: 1,000-3,000)
- Globular clusters: ~150 (real: 150-180)
- Dark nebulae: ~190 (real: 500-1,000)
- Supernova remnants: ~120 (real: 300-1,000)

**No game has done this before.** First game to unify procedural generation AND gameplay through gravitational potential.

**Galactic feature layer — IMPLEMENTED.** Features generated from density-integrated expected counts matching real Milky Way populations. Feature Plummer wells raise local density in the hash grid, naturally producing dense star regions (globular clusters, etc.).

### Three-Layer Data Architecture (2026-03-20)

The galaxy has three data layers, each building on the one below:

**Layer 1: Procedural Generation (gravitational potential)**
- The gravitational potential field Φ(x,y,z) determines everything
- ~200 billion stars from 7-tier hash grid
- ~4,100 features from density-integrated expected counts
- Works everywhere, fills the entire galaxy, fully deterministic
- This is the FOUNDATION — it runs even with no real data

**Layer 2: Real Data Overlay (astronomical catalogs)**
- HYG v4.0: 15,598 real named stars at correct positions
- Harris catalog: 152 real globular clusters (to be integrated)
- Future: NGC/Messier nebulae, Gaia open clusters, Green's SNRs
- Real data OVERRIDES procedural at specific positions
- Same pipeline — real stars render identically to procedural ones
- Gameplay mechanics (gravity, warp cost) work the same for both

**Layer 3: Visual Override (observational appearances)**
- For ~50-80 famous objects (Messier catalog, notable NGC objects)
- Stylized visual representations based on real observations
- NOT procedural — this is an intentional, designed layer
- The pipeline CAN'T produce the specific appearance of the Orion Nebula from physics alone
- Applies at medium-to-close range; distant rendering is procedural
- Must match retro aesthetic (posterized, dithered, stylized)
- The Solar System is the extreme case (handcrafted planets)

**Why Layer 3 is not a tack-on:** It's grounded in real observations applied to objects with real identities. The procedural system puts the RIGHT KIND of object at the RIGHT PLACE with the RIGHT PHYSICAL PROPERTIES. Layer 3 provides visual specificity that physics alone cannot generate. It's designed, intentional, and clearly bounded to cataloged objects.

**Galaxy visualization scripts — BUILT.** `scripts/galaxy-viz.mjs` generates HTML maps (galaxy overview with features, sector deep-dives with full physics data per system).

Belt/ring traversal hazard model: A+C hybrid (physics-honest sparse baseline + localized dense pockets at families/resonance pile-ups/Trojans). Rings effectively solid at speed. See §4C.

### Technical Debt from 2026-03-17 Implementation

Items discovered during code audit. These work correctly today but should be addressed before building on top of them:

| Priority | Item | Why It Matters | When to Fix |
|----------|------|---------------|-------------|
| HIGH | ExoticOverlay uses simple HZ check, not habitabilityScore | Fungal/civilized placement ignores atmosphere, magnetic field, age | Next time ExoticOverlay is touched |
| HIGH | AsteroidBeltGenerator doesn't know about physics data | Physics attached after generation (monkey-patched). Fragile. | When belt rendering gets compositional zones or Kirkwood gap visuals |
| HIGH | Ring `ringlets` and `gaps` generated but not rendered | Data exists, renderer doesn't consume it. Becomes visible when ring LOD is built | Ring LOD implementation |
| MEDIUM | Trojan clusters generated but not rendered | Data in `system.trojanClusters` but no Three.js objects created | When asteroid rendering is expanded |
| MEDIUM | Kuiper belts generated but visually identical to main belts | Same AsteroidBeltGenerator, no icy composition coloring | Belt rendering refactor |
| MEDIUM | Stellar evolution computed but no visual difference | `stellarEvolution.evolved` flag exists, but Star.js always renders main-sequence | Non-main-sequence star visual assets |
| MEDIUM | Feature context modulates generation but isn't visible in sky | Stars inside nebulae generate differently, but the nebula itself isn't visible from inside or outside | StarfieldGenerator sky overlay integration |
| LOW | `surfaceHistory` (bombardment, erosion, resurfacing) has no visual consumer | Pure data, waiting for surface LOD shaders | Planet close-up rendering |
| LOW | `composition.density` computed but not used by gravity/physics gameplay | Available for future fuel/rotor system calculations | Game mode implementation |

### Design Needed — Rendering (connects today's generation to visuals)
These are the **immediate next steps** to make today's physics data visible to the player:
- [ ] **ExoticOverlay → habitabilityScore migration** — replace simple HZ check with physics-driven score. Fungal/civilized placement becomes more nuanced.
- [ ] **Non-main-sequence star rendering** — visual assets for remnant types (white dwarf, neutron star, black hole, red giant). Generation logic done, need mesh/shader/glow per type.
- [ ] **Ring LOD + gap rendering** — consume `rings.ringlets[]` and `rings.gaps[]` data. Distant: color bands. Medium: visible Cassini-like divisions. Close: individual rocks.
- [ ] **Belt compositional rendering** — use `belt.physics.compositionZones[]` to color asteroids by S/C/M-type. Kirkwood gaps as visible density variation.
- [ ] **Trojan cluster rendering** — consume `system.trojanClusters[]`, place asteroid groups at L4/L5.
- [ ] **Kuiper belt visual distinction** — darker, icier coloring from `belt.physics.composition`.
- [ ] **Sky feature overlays** — nearby galactic features visible in starfield (nebula glow, cluster knots, dark patches). Connects Level 1 features to player experience.
- [ ] **Body info HUD physics data** — show composition, atmosphere type, habitability score, tidal state in body info popup.

### Design Needed — Game Systems
- [x] Exotic spawning implementation — `ExoticOverlay.js` post-generation pass
- [x] Gap-giant association — now physics-driven (belts only form near giants)
- [ ] Civilized planet spawning rates — finalize decision chain percentages (should use habitabilityScore)
- [ ] Civilization as galaxy layer — regional spread logic, proximity influence, metal-rich outpost rules
- [ ] Navigation computer UI design — layout, interaction, aesthetic details (wireframe CRT direction decided). Should show galactic features as landmarks.
- [ ] Scanner system implementation — four layers (galactic survey, star-wave, direct, codex). Physics data (composition, habitability, atmosphere type) feeds directly into scan results.
- [ ] Combat system design — weapons, damage, health, difficulty for both modes, charge thresholds, parry mechanics, on-foot variant scope
- [ ] Faction system design — territory generation, reputation, encounter rules
- [ ] Environmental hazard implementation — damage model, fuel costs, scanner integration. Belt/ring traversal hazards designed (§4C), need damage numbers.
- [ ] In-system travel loop — acceleration/deceleration mechanics, transit timing. Belt traversal speed vs damage trade-off lives here.
- [ ] Main game aesthetic — replace 9 palette modes with one cohesive visual language
- [ ] Reactive audio system — stem/layer architecture, property-to-audio mappings
- [ ] BPM-synced universe — property-to-BPM mapping, animation quantization, musical SFX design
- [ ] Splash screen sequence — production logo, composer credit, ramp-up audio, timing
- [ ] Magnification targeting window — zoom level, visual style, mobile/macOS support
- [ ] Player identity — who are you? What's unusual about the character?
- [ ] Megastructure visual design — how to render Dyson swarms, ring habitats
- [ ] On-foot exploration scope — what's the MVP interior?

### Waiting On
- [ ] Music tracks — Max's brother Christian (future: layered stem system)
- [ ] CRT scanline filter — Phase 11 remaining item

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
