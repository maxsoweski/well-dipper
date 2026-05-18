# Composer Reference — Well Dipper

> Composer-facing inventory of all music slots, sound effects, and procedural
> system types that need musical/aesthetic identity. Sister doc to the
> existing `Well-Dipper-Music-Guide.docx` (in repo root) and Bible §2 *Sound
> Design / Music Tracks*.
>
> Vibe primer (from `docs/GAME_BIBLE.md` §2): late-90s retro synth — sparse
> arrangements, warm drones, FM/analog synth pads in quiet moments;
> intense, driving rhythms during combat/hazards. **Vast rather than
> frantic. Open rather than cluttered.** *Outer Wilds* (acoustic + wonder),
> *FTL* (synth exploration vs tense), *Katamari Damacy* (quirky retro),
> *No Man's Sky* (procedural ambient), *Stellaris* (grand space synths)
> are the named touchstones. Tempos: 60–90 BPM exploration, 120–140 BPM
> hyperspace/combat. **All tracks should aim for the same or related keys
> for clean crossfades; loops must trim to exactly 0 ms of silence at
> head/tail.**
>
> The autopilot tour mode is the cinematic register the music has to
> match: per `docs/FEATURES/autopilot.md`, the touchstone is the *Blue
> Danube* over 2001's station-docking — *ship as a body moving through a
> composed frame, set against a world indifferent to the drama*. 60s/70s
> space cinematography. The camera is the player's eyes; the music is
> the cabin air.

---

## 1. Music tracks

Loaded by `src/audio/MusicManager.js` from `public/assets/music/`. Crossfade
default 1.5 s; can be overridden per `play()` call. One-shot stings use
`playOnce()` and don't replace the looping bed.

### Currently on disk

| Slot | File | Where it plays | Trigger | Loop? | Mood |
|---|---|---|---|---|---|
| **`intro`** | `public/assets/music/intro.mp3` | Splash → title sequence (~8 s logo cross-fade) | Player clicks/touches the splash to dismiss it (`src/main.js:1570`) | No (one-shot) | Mysterious ramp-up that **escalates into** the title theme. The Bible calls this slot *splash-ramp*. |
| **`title`** | `public/assets/music/title.mp3` | Title screen, post-splash. Currently ~3:16 long | Loop begins after the logo overlay clears (`src/main.js:1598`); an auto-warp dismisses the title once the track ends + 3 s silence | Yes | **Mysterious, spacious, sparse — floating in void.** Drone-leaning. The longest dwell-time track for a player who pauses on the title screen. |
| **`explore`** | `public/assets/music/explore.mp3` | Star systems, between warps | Periodic one-shot in-system, scheduled by `_scheduleSystemMusic` (`src/main.js:1757`). First play 20–35 s after warp arrival; subsequent plays are spaced by `track-duration + 120 s of silence` | Plays as one-shot *with gaps*, NOT continuous loop | **Open, unhurried, vast — the sound of drifting through space.** Most-heard track. The "cabin air" of the autopilot tour. |

### Slots referenced in code but missing on disk — **NEEDS COMPOSING**

These slot names are wired into the code (`MusicManager.preloadAll`,
`SOUNDTEST_BGM` in `src/main.js:2221`, and the warp/arrival callbacks)
and will play if a file shows up at the named path. Today they fail
silently.

| Slot | Expected path | Where it plays | Trigger | Loop? | Mood note |
|---|---|---|---|---|---|
| **`hyperspace`** 🎵 NEEDS COMPOSING | `public/assets/music/hyperspace.mp3` | Inside the warp tunnel (HYPER phase) | `musicManager.play('hyperspace', 0.3)` fires the moment the ship crosses into the tunnel (`src/main.js:2613`); `explore` is hard-stopped at warp-charge initiation (`src/main.js:2396`) | Yes — loops if traversal lasts longer than the track | **Fast, intense, rhythmic — retro sci-fi energy.** 120–140 BPM. The relativistic blue-shift / red-shift register (per `docs/FEATURES/warp.md`). Player is being *pulled* by the tunnel, not thrusting. Should feel propulsive but not combat-tense — wonder, not threat. |
| **`warp-charge`** 🎵 NEEDS COMPOSING | `public/assets/music/warp-charge.mp3` | One-shot sting under the FOLD/ENTER warp portal opening (~6 s window) | Surfaced via Sound Test panel (`src/main.js:2226`); intended to fire alongside the existing `warpCharge` SFX when wired up | No (sting) | **Building tension, escalating energy.** ~6–7 s. Crescendo into the tunnel entry. Currently the SFX `warpCharge` carries this beat solo — the music sting is meant to layer over it. |
| **`arrival`** 🎵 NEEDS COMPOSING | `public/assets/music/arrival.mp3` | One-shot sting at warp exit, as the new system reveals | Surfaced via Sound Test panel (`src/main.js:2227`); intended to fire on `warpEffect.onComplete` alongside `warpExit` SFX (`src/main.js:2671`) | No (sting) | **Brief wonder — "we're here," relief.** 3–5 s. The musical comma between hyperspace and the system's `explore` bed. |
| **`deepsky`** 🎵 NEEDS COMPOSING | `public/assets/music/deepsky.mp3` | Distant deep-sky destinations — **external galaxies** (spiral / elliptical) and **distant globular clusters** the player views from outside | Surfaced via Sound Test panel (`src/main.js:2225`). Not yet wired to the deep-sky reveal path; should fire from `warpRevealSystem`'s distant-deep-sky branch (`src/main.js:5032`) instead of falling back to `explore` | Yes | **Grander, more awe-inspiring — bigger scale.** The Bible's *deepsky* slot. Not "scarier than explore," just *larger.* The camera is parked outside an entire galaxy or a 12 Gyr-old globular fossil; the music has to register that. |
| **`explore-alt`** 🎵 NEEDS COMPOSING (LOW priority per Bible) | `public/assets/music/explore-alt.mp3` | Variation on `explore` to stop the most-heard track from feeling repetitive | Not yet wired in code — would alternate with `explore` in `_scheduleSystemMusic` | Yes (one-shot with gap, like `explore`) | **Same key/mood as `explore`, different melody/instruments.** The Bible explicitly calls this LOW priority — only worth doing once `explore` is locked. |

### Bible-mandated but unwired

The Bible §2 lists 7 music slots; `intro` covers `splash-ramp`, so the
running total of distinct tracks is **7 if we count `explore-alt`,
6 without**. All slots above this header line up to that. No code-only
slots are missing from the Bible.

### Future / lore-tagged (not a composing ask today)

- **Synesthetic stem layers** — the Bible §2 *Music Architecture (Future)*
  describes a long-term direction where Christian authors stems and
  layers (not whole songs) that the engine activates per-system based on
  star type, age, civilization, hostility. Stems would need to be
  tempo-flexible to support the BPM-synced universe (Bible §2 *BPM-Synced
  Universe*). **Not the V1 ask.** The 7-track list above is the MVP.
- **Per-system theme variations** — this is the live composing direction
  for §3 below: variations of `explore` (or stems on top of `explore`)
  that match the system-type aesthetic. Mechanism TBD; Christian's
  authoring shape per §3 will help decide whether it lives as alt-tracks
  or stem layers.

---

## 2. Sound effects

All 21 SFX live in `public/assets/sfx/` as `.mp3` and are preloaded by
`src/audio/SoundEngine.js`. The bank is declared at `SoundEngine.js:14`.
The Bible §2 calls these "placeholder synthesized" — they were originally
Web-Audio-synthesized and have since been baked to MP3. Treat the current
files as the working set; Christian may revise.

### UI / shell

| Name | File | Trigger | Semantic note |
|---|---|---|---|
| `select` | `select.mp3` | Body / warp-target selection commit (`src/main.js:5246`, etc.) | Confirmation chime — "you picked something." |
| `cycle` | `cycle.mp3` | Sound-test panel only — **trigger context: unclear, clarify with Max**. Likely intended for menu/system-cycling (Tab to cycle modes, etc.) | UI tick — "list advanced." |
| `uiClick` | `uiClick.mp3` | Generic overlay open/close (sound test, pretext lab) (`src/main.js:2053`, `2280`, `2320`) | Lightweight UI click — softer than `select`. |
| `toggleOn` / `toggleOff` | `toggleOn.mp3` / `toggleOff.mp3` | Orbits-visible toggle, gravity-well-visible toggle (`src/main.js:5605`, `5633`) | Two-tone affirm / negate pair. |
| `titleDismiss` | `titleDismiss.mp3` | Currently muted in code (`src/main.js:1701` is commented out) — **trigger context: unclear, clarify with Max** | Originally a major-chord arpeggio fired when the title screen cleared. Bible §2 *Sound Effects* describes it as "cosmic drone, major chord arpeggio dismiss." |
| `newSystem` | `newSystem.mp3` | Sound-test panel only — **trigger context: unclear, clarify with Max**. Likely intended for the moment a new procedural system spawns, but currently `warpExit` carries that beat. | "Fresh-system" stinger. |

### Nav computer (the diegetic CRT terminal — Bible §7)

| Name | File | Trigger | Semantic note |
|---|---|---|---|
| `navOpen` | `navOpen.mp3` | Player opens the nav computer (`src/main.js:1809`) | CRT power-on / interface-engage. |
| `navClose` | `navClose.mp3` | Player closes the nav computer (`src/main.js:1851`) | CRT power-off counterpart. |
| `navDrill0`–`navDrill4` | `navDrill0.mp3` … `navDrill4.mp3` | Five nav-tree drill levels — fired both by user navigation (`src/main.js:1794`) and by the autopilot's nav-drill cinematic sequence (`src/auto/AutopilotNavSequence.js:127–419`) | Five-step drill-down ladder. Each level a half-step or terraced rise — "drilling deeper into the galactic survey data." Mid-tones, processed as if heard through ship instruments (Bible §2 *Diegetic Audio Principle*). |

### Autopilot

| Name | File | Trigger | Semantic note |
|---|---|---|---|
| `autopilotOn` | `autopilotOn.mp3` | Cinematic flythrough engages (`src/main.js:4847`) | Rising two-tone — engagement. |
| `autopilotOff` | `autopilotOff.mp3` | Flythrough disengages (`src/main.js:4906`) | Falling two-tone — release. |

### Warp

| Name | File | Trigger | Semantic note |
|---|---|---|---|
| `warpTarget` | `warpTarget.mp3` | Player clicks a star in the sky and it becomes the warp target (`src/main.js:7465`) | Target-acquired chirp. Brackets appear blinking. |
| `warpLockOn` | `warpLockOn.mp3` | Player commits to the target — the camera begins the pre-warp turn toward it (`src/main.js:7573`) | Lock-on tone. Brackets go solid. |
| `warpCharge` | `warpCharge.mp3` | The 6 s portal-charging window (FOLD phase) before the ship enters the tunnel (`src/main.js:2395`) | **The signature warp sound.** Bible §2 specifies sub-bass + dissonant sawtooth + noise + high whine. ~6.5 s buildup. The future `warp-charge` music sting layers over this. |
| `warpEnter` | `warpEnter.mp3` | The instant the ship crosses into the tunnel (HYPER begins) (`src/main.js:2612`) | Threshold-cross whoosh. Hands off to `hyperspace` music. |
| `warpExit` | `warpExit.mp3` | The instant the ship crowns out of the tunnel into the new system (`src/main.js:2671`) | Threshold-cross whoosh, reverse polarity to `warpEnter`. Hands off to per-system music. |

### Aesthetic principles for SFX (Bible §2)

- **Diegetic — heard through the ship.** All SFX should sound *processed*, as if filtered through a CRT-terminal or hull. No "out in space" sounds — there's no air out there.
- **Future direction: musical SFX.** Bible §2 *BPM-Synced Universe* anticipates SFX that are tuned to the active system's key and quantized to its beat grid. Not the V1 ask, but worth knowing — we may eventually want stem-style SFX that drop into a system's BPM/key.

---

## 3. System types — the procedural engine's catalog

This is the section that drives **per-system music variation**. Below is
every kind of place the player can warp into, with composer-facing notes
on what the system *feels* like (visually + atmospherically). Group these
into mood families however helps the writing — color groupings are
suggestions, not constraints.

The procedural engine is a 6-level cascade (Bible §12): galaxy → galactic
features → sectors → star systems → bodies → surfaces. The composer
mostly cares about levels 1–3.

### 3A. Hand-authored canonical systems

Sourced from `src/generation/KnownSystems.js`. **Sol is currently the
only entry.**

| Name | What makes it distinct | Where in galaxy | Music note |
|---|---|---|---|
| **Sol** | Our actual Solar System — yellow G-star (familiar warmth), 13 named bodies (Mercury → Eris) including Earth (life-bearing), Jupiter and Saturn with full named-moon entourages, an asteroid belt. Hand-authored from real data (`src/generation/SolarSystemData.js`). | Sun-position in Milky Way: ~8 kpc from galactic center, ~25 pc above plane, in the Orion Spur between Perseus and Sagittarius arms. | The "home" reference. If procedural systems are variations, **Sol is the tonic**. Familiar, warm, slightly nostalgic — the Bible's sense of *home you can never quite go back to*, given the Player's breakaway-line lore (Bible §1). |

> Future entries: Alpha Centauri, etc. — see TODO comment in
> `KnownSystems.js:67`.

### 3B. Star systems — by primary star type

Sourced from `src/generation/StarSystemGenerator.js` (`STAR_PROPERTIES`,
line 58). Star type is the single biggest mood lever — it sets color
temperature, planet count, habitability potential, and lifetime.
Cinematically weighted (Bible §4) — real M-dwarfs would be ~75% of all
systems; the engine clips them to 18 % so the player gets variety.

| Type | What makes it distinct (mood) | Galactic distribution |
|---|---|---|
| **M (red dwarf)** — *18 %* | Dim red-orange sun, intimate scale. Habitable zone is so close that any liveable planet is tidally locked (eyeball climate). Long-lived but flare-prone. **Warm, slow, small.** | All components, but dominant in disk + halo (M-dwarfs are everywhere; survive billions of years). |
| **K (orange)** — *20 %* | Orange-warm, stable, very long-lived. The Bible flags K and G as the best chances for civilization. **Settled, patient, golden-hour light.** | Disk mostly. |
| **G (sun-like)** — *20 %* | Yellow-white, familiar, the Sol register. Most likely to host an Earth-twin. **Familiar warmth, mid-day brightness.** | Disk, especially solar neighborhood. |
| **F (white-yellow)** — *16 %* | Brighter than the Sun, more planets typical (4–8). **Crisp, alert, slightly cold-tinged white.** | Thin disk, spiral arms. |
| **A (blue-white)** — *13 %* | Dramatic blue-white, short-lived, often young. **Sharp, glittering, classical.** | Thin disk, spiral arms; not in old halo. |
| **B (blue)** — *8 %* | Massive, blue, spectacular. Very short lifespan — these stars don't live long enough for civilization. **Powerful, fast, urgent.** | Spiral arms (especially major arms — Scutum-Centaurus, Perseus). Star-forming regions. |
| **O (blue giant)** — *5 %* | Deep blue, rare, stunning. Burns hot and brief. The Bible: *"vast / intense"* register. **Awe + foreboding. Operatic scale.** | Spiral arm cores almost exclusively. Inside emission nebulae and OB associations. |

### 3C. Star systems — non-main-sequence variants (Bible §4 — Layer 2)

These are stars that have evolved off the main sequence, and they're
mostly **not yet rendered with unique visuals** ("Not built yet" per
Bible §12). But the data already drives generation, and Christian's
work can anticipate them — they're *very* different from main-sequence
stars in mood.

| Type | What makes it distinct | Where it appears |
|---|---|---|
| **White dwarf** | Dead star core. Tiny, dense, often ringed by a planetary nebula. Disrupted close-in orbits, weird remnant planets. **Quiet, ghostly, post-mortem.** | Old stellar populations. Centers of planetary nebulae. |
| **Neutron star / Pulsar** | Extreme radiation, millisecond rotation, lethal. **Tense, mechanical, radioactive.** | Centers of supernova remnants. Old populations. |
| **Red giant** | Bloated dying star, swallowed inner planets, habitable zone pushed way out. **Slow, swollen, copper-orange, end-of-an-era.** | Old populations across all components. Hash-grid types `Kg`, `Gg`, `Mg` flag evolved giants in the procedural system. |
| **Brown dwarf** | Failed star, very dim. Tiny system, extremely close-in habitable zone. **Cool, withdrawn, twilight always.** | All components — ubiquitous but easily missed. |
| **Wolf-Rayet star** | Massive, dying, violently shedding mass. Surrounded by glowing nebulae from its own ejecta. **Violent, beautiful, doomed.** | Spiral arm cores. Hash-grid type `W`. |
| **Protostar** | Still forming, debris disk instead of mature planets. **Embryonic, churning, undifferentiated.** | Inside emission nebulae and dark nebulae (active star formation). |
| **Black hole** | Collapsed star or primordial. Accretion disk, extreme gravity, lensing distortion of background stars. **Inevitable, indifferent, gravitational.** | Old populations. Sometimes inside supernova remnants. |
| **Carbon star** | Red giant where carbon outshines oxygen — *very* red, dust-shrouded. Hash-grid type `C`. | Old populations. |
| **S-type star** | Cool giant intermediate between M and carbon. Hash-grid type `S`. | Old populations. |

### 3D. Star systems — by **galactic region** the player is in

Sourced from `src/generation/GalacticMap.js` (`deriveGalaxyContext`,
line 935). Even when the star type is the same, *where* in the galaxy
the system sits changes the population, age, and metallicity — and
therefore mood.

| Component | What makes it distinct | Composer hook |
|---|---|---|
| **Thin disk** | Where most "live" stars live — young to middle-aged, metal-rich, planet-rich. Default mood: the open exploration register. | The base `explore` track. |
| **Thick disk** | Older, metal-poor, fewer planets. Calmer, less active. **Vintage, dusty, Sunday-afternoon.** | `explore`, slightly more weathered/dustier mix. |
| **Bulge (galactic core)** | Dense, old (mostly), bimodal metallicity, packed starfield. The galactic-center vibe. **Crowded, ancient, gold-and-amber, hum of countless old suns.** | `explore` with a denser/older mix — fewer modern instruments, more ancient drone. |
| **Halo** | Sparse, very old (10+ Gyr), metal-poor, almost no planets. Where the globular clusters live. **Empty, archaic, monastic, the deep-time register.** | Sparser instrumentation. Very long pads. |
| **Spiral arm cores** (Scutum-Centaurus, Perseus — major; Sagittarius, Norma, Outer, Orion Spur — minor) | **Star-forming regions.** Boosted O/B stars (massive, hot, blue). Often inside or near nebulae. **Bright, urgent, explosive — birth.** | `explore` with O/B-star mood: more high-end, more urgency. |
| **Inter-arm gaps** | Between the arms — quieter, older, fewer features. **Liminal, expansive, in-between.** | `explore` at its sparsest. |

### 3E. Galactic features — **navigable** deep-sky destinations (`isNavigable`)

Sourced from `src/generation/DestinationPicker.js:61` and
`src/generation/GalacticMap.js` (`FEATURE_TYPES`, line 1229). These are
deep-sky objects you actually fly *into* — the camera tours stars and
features inside them, like a normal star system but with extreme
ambient context.

| Type | What makes it distinct | Where it forms |
|---|---|---|
| **Emission nebula** (H II region) | You're embedded inside a glowing red/pink/teal cloud lit by hot young stars. Density is high in every direction; the sky is the nebula. Color palettes: H-alpha red, OIII teal, NII deeper red, dusty mauve. **Womb-like, pulsing, biological warmth despite being plasma.** | Spiral arm cores with `armStrength > 0.2`. 30–100 pc across. ~7,000 in the galaxy. |
| **Planetary nebula** | A small (0.1–1 pc), bright, *intricately shaped* shell around a dying white dwarf. Most varied colors of any nebula type — OIII green, blue-violet, magenta, teal, deep blue, warm orange Helix-shells. **Brief, exquisite, precise — a star's elegant goodbye.** Lifespan only ~30 kyr. | Around white dwarfs (evolved stars). Old stellar populations. |
| **Open cluster** | Dense scattered field of *young, blue-white* stars born together. They share age and metallicity. Stars are loose-knit, will dissolve in <1 Gyr. Famous: Pleiades, Hyades. **Bright, jeweled, tribal — siblings together.** | Spiral arms with `armStrength > 0.1`. 2–20 pc across. ~100,000 in the galaxy. |
| **OB association** | A loose grouping of young massive stars across 50–300 pc, often with surrounding nebulosity. Sparse compared to a cluster but each star is enormous. **Cathedral-scale, hot, scattered, blue-violet.** | Spiral arm cores with `armStrength > 0.35`. ~300 in the galaxy. |
| **Dark nebula** | Cold molecular cloud, *pre*-star-formation. Stars behind it are dimmed or hidden. Few stars inside. **Hidden, withholding, anticipatory — gestating.** | Spiral arm edges, high dust density. 5–50 pc. ~1,500 in the galaxy. |
| **Supernova remnant** | Expanding shock shell from a massive star's death. Often green (oxygen emission), Crab-blue (synchrotron), Veil-red (shock-heated). Has a neutron star or black hole at the center. **Aftermath, recent violence, ghosts.** | Thin or thick disk. 1–30 pc. ~1,000 in the galaxy. |
| **Globular cluster** *(navigable interior)* | Extremely dense, ancient (12+ Gyr) ball of yellow-orange stars. Going inside one is going *back in time* — these stars are older than the disk. **Ancient, dense, monastic, geological-time-scale gold.** | Halo + bulge regions. 10–100 pc. ~50–160 in the galaxy. |
| **Reflection nebula** | Scattered starlight off dust — always blue-tinged. Pleiades-like. **Cool, blue, indirect — light remembered, not produced.** | Near hot stars (e.g. Pleiades). Less common as a navigable destination. |

> A subset of these have **hand-authored profiles** in
> `src/data/KnownObjectProfiles.js` (37 real Messier/NGC objects: M42
> Orion, M1 Crab, M13 Hercules, M57 Ring, M45 Pleiades, M8 Lagoon, M17
> Omega, M20 Trifid, M16 Eagle, NGC 2237 Rosette, NGC 7000 North America,
> IC 1396 Elephant Trunk, NGC 6888 Crescent, IC 434 Horsehead, M78,
> M27 Dumbbell, NGC 7293 Helix, NGC 6543 Cat's Eye, M97 Owl, NGC 3132
> Southern Ring, NGC 6960 Veil, Cas A, M22 Sagittarius, M3, M5, M15
> Pegasus, M4, M92, 47 Tucanae, ω Centauri, M11 Wild Duck, M44 Beehive,
> Double Cluster, M35, M7 Ptolemy's, IC 2602 Southern Pleiades, NGC
> 2264 Christmas Tree). These appear in **Debug Gallery Mode** (D key).
> **Composer ask:** if you want named-feature musical leitmotifs for
> any specific famous nebula/cluster, this is the list.

### 3F. Galactic features — **distant** deep-sky destinations (`isDistant`)

Sourced from `src/generation/DestinationPicker.js`. These are deep-sky
objects you view from *outside* — the camera coasts in with momentum,
parks at a contemplation distance, and free-orbits. **No planets, no
zones — pure scenic destination.** This is the slot the unwired
**`deepsky`** music track is meant for (§1).

| Type | What makes it distinct | Generated by |
|---|---|---|
| **Spiral galaxy** (external) | An entire other galaxy, viewed from outside. Particle cloud with arm structure, dust lanes, central bulge glow. **Vast, slow, alien — civilizations you'll never reach.** | `src/generation/GalaxyGenerator.js`. |
| **Elliptical galaxy** (external) | An entire other galaxy with no spiral structure — old, smooth, yellow-red. **Ancient, massive, monolithic.** | `src/generation/GalaxyGenerator.js`. |
| **Globular cluster** *(viewed from outside)* | Same object family as §3E but the camera doesn't go in. You see it as a tight, fuzzy yellow-orange ball against starfield. **Distant relic, untouchable.** | `src/generation/ClusterGenerator.js` + StyleProfileAdapter. |

### 3G. Procedural-engine modes for star-system mood (forward-looking)

Per Bible §4A *Physics-Driven Generation* and §2 *Synesthetic Audio
System (Future Direction)*, every star system carries data the audio
engine will eventually use to shape mood:

- **Star type** — handled in §3B above.
- **System age** (Gyr, 0.1–12.0) — *young* (< 2 Gyr): no civilization possible, possibly debris disks, dynamic / chaotic feel. *Ancient* (> 10 Gyr): quiet, evolved stars common, haunted register.
- **Metallicity** ([Fe/H], -1.0 to +0.5) — high metallicity → planet-rich, gas-giant-likely, civilization-likely. Low metallicity → sparse, ancient, halo/thick-disk register.
- **Civilization presence** — *city-lights* and *ecumenopolis* planets exist (Bible §6A). Radio chatter, beacon pings, industrial hum overlay (Bible §2 *Synesthetic*).
- **Hostility** — tense undertones; not yet implemented.
- **Exotic phenomena** — fungal blooms (bioluminescent alien life), crystal/shattered/hex/machine planets, megastructures (Dyson swarm, ring habitat, derelict megaship). Each has a mood signature: fungal = subsurface-organic; crystal = tonal/resonant; hex/machine = mechanical-rhythmic; megastructures = monumental.
- **Hazards** — radiation zones, solar flares, dense asteroid fields, nebula interference, extreme gravity (black holes, neutron stars). Bible §6D.
- **System BPM** — Bible §2 *BPM-Synced Universe*: every star system gets a unique BPM derived from its properties (60–120 BPM range proposed). Suggested mapping: slower for calm/ancient, faster for chaotic/young. **Christian's stems will need to be tempo-flexible.**

These are levers the engine has (or will have) for the synesthetic /
stem direction. Not all of them affect V1, but they're worth knowing
exists when shaping the `explore` family.

### 3H. Aesthetic states with no procedural geometry — UI surfaces

These are scored backdrops, not destinations. Listed for completeness
and because the music slots already cover them (§1).

| State | Visual | Music slot |
|---|---|---|
| **Splash screen** | Two studio logos cross-fade over ~8 s (`src/main.js:1572` timeline) | `intro` |
| **Title screen** | Pixelify-Sans title typography over a starfield + galaxy backdrop | `title` |
| **Warp tunnel interior (HYPER)** | Stars shaped into a cylinder, blue-shift ahead, red-shift behind. Per `docs/FEATURES/warp.md` — exotic, continuous, no-cut, **non-Euclidean** (the tunnel is a 2D hole into a 3D cylinder). | `hyperspace` |
| **Warp opening (FOLD/ENTER)** | Gravitational lens dilates open ~500 m ahead of the ship, tunnel visible through it. | `warp-charge` sting (over `warpCharge` SFX). |
| **Warp arrival (EXIT)** | Ship crowns out into destination space, autopilot reveal begins. | `arrival` sting. |

### 3I. Late-game warp aesthetic (Bible §1, future)

The Bible flags the warp as a *progression* experience: early-game is
the tunnel; mid-game introduces brief, unsettling anomalies; late-game
becomes "impossible spaces — the room at the end of 2001: A Space
Odyssey, psychedelic environments that don't follow physics." **Not a
V1 ask** — but worth knowing the warp track will eventually need
weirder cousins. The slot for this work doesn't exist yet.

---

## Mapping summary — where each music slot lives in the experience

```
SPLASH ──────────► intro                (one-shot, 8s logo sequence)
   │
   ▼
TITLE ────────────► title               (loop, ~3:16, mysterious/sparse)
   │
   ▼ (auto-warp)
FOLD/ENTER ──────► warp-charge sting    🎵 NEEDS COMPOSING
   │              + warpCharge SFX (signature sub-bass + sawtooth)
   ▼
HYPER ───────────► hyperspace           🎵 NEEDS COMPOSING (loop, 60s, 120-140 BPM)
   │
   ▼
EXIT ────────────► arrival sting        🎵 NEEDS COMPOSING (3-5s)
   │
   ▼
IN-SYSTEM ───────► explore               (one-shot with 2min gaps, 90-120s)
   │              [explore-alt 🎵 LATER, alternates with explore]
   │              [system-theme variations 🎵 the §3 work]
   │
   └─► (deep-sky distant) ──► deepsky   🎵 NEEDS COMPOSING (loop, 60-90s, grand)
```

---

## Key files for the composer to bookmark

- **Bible** — `docs/GAME_BIBLE.md` §2 *Aesthetic / Sound Design* and §8H *Propulsion & Travel Landscape* (lore for the cinematic flight register).
- **Existing music guide** — `Well-Dipper-Music-Guide.docx` in repo root.
- **Audio engines** — `src/audio/MusicManager.js`, `src/audio/SoundEngine.js`.
- **Music + SFX assets on disk** — `public/assets/music/`, `public/assets/sfx/`.
- **Procedural engine entry points** — `src/generation/StarSystemGenerator.js` (per-star-type), `src/generation/GalacticMap.js` (galactic regions + features), `src/generation/KnownSystems.js` (canonical Sol), `src/data/KnownObjectProfiles.js` (37 real Messier/NGC profiles).
- **Autopilot tour mode (cinematic register)** — `docs/FEATURES/autopilot.md` (Blue-Danube-over-2001 vibe).
- **Warp tunnel** — `docs/FEATURES/warp.md`.

## Questions to resolve with Max before final mix

1. **`titleDismiss` SFX** — currently muted in code (`main.js:1701`). Keep it muted, or wire it back in once Christian delivers a final?
2. **`cycle` SFX** — only fires from the sound-test panel today. Is there an intended in-game trigger we haven't wired up (e.g., palette-mode cycling, page-flip in nav-computer column view)?
3. **`newSystem` SFX vs `warpExit`** — both could plausibly own the "you've arrived" beat. Confirm the split: is `newSystem` for non-warp arrivals (debug spawn, splash-D-hold)?
4. **`deepsky` track wiring** — should this fire for *all* distant deep-sky destinations (external galaxies + distant globulars), or only external galaxies? Code path is `warpRevealSystem` (`main.js:5032`), and currently nothing plays — `explore` is also not scheduled for deep-sky reveals.
5. **`warp-charge` and `arrival` stings** — confirm they should layer over their corresponding SFX (`warpCharge`, `warpExit`), not replace them.
6. **Per-system theme variations** — does Christian want to deliver as *whole alternate tracks* (`explore-K-star`, `explore-bulge`, etc.) or *stems that the engine layers* per Bible §2 *Music Architecture (Future Direction)*? The stem direction is forward-looking; the alt-track direction is what the V1 mechanism supports today.
