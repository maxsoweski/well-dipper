# Research: Megastructure Visual Design & Retro CRT Navigation Computer

Two research topics for Well Dipper's future development.

---

## TOPIC 1: MEGASTRUCTURE VISUAL DESIGN

Megastructures as extremely rare discoveries — the rarest things you can find in the game. These would be encountered orbiting stars (or replacing them) as evidence of ancient or active alien civilizations far beyond anything the civilized/exotic planet overlays suggest.

### 1. Dyson Swarm (Partial Stellar Enclosure)

**What it is:** Thousands to millions of individual solar collectors orbiting a star independently, harvesting its energy. Not a solid shell — a cloud of satellites. Freeman Dyson's original concept was always a swarm, not a sphere.

**How it works:** Each collector orbits the star on its own trajectory, absorbing sunlight and beaming energy elsewhere (microwave, laser, etc.). The swarm captures a percentage of the star's total output depending on density.

**Visual appearance from distance:**
- The star looks dimmer and redder than it should — the swarm absorbs visible light and re-emits as infrared
- Irregular brightness fluctuations as gaps in the swarm rotate past the viewer
- A partial swarm (10-30% coverage) would make the star look like it's "flickering" — dimming and brightening as collector clusters transit
- At very high coverage (80%+), the star nearly vanishes in visible light — it becomes an infrared ghost

**Visual appearance up close:**
- Individual collector panels visible as flat, reflective polygons catching starlight
- Dense orbital traffic — panels at various distances, angles, overlapping
- Gaps reveal the blazing star beneath
- Energy beams (microwave/laser) visible as faint lines between collectors and distant receivers

**Retro Three.js rendering approach:**
- **Geometry:** Use `THREE.InstancedMesh` with a simple flat quad or hexagon as the collector shape. Scatter hundreds of instances in a thick shell around the star using spherical coordinates with some randomness
- **Animation:** Rotate each instance slowly on its own orbit (cheap with instanced transforms)
- **Star effect:** Reduce the star's emissive brightness proportional to swarm density. Add a slight flicker to the star's light (random small variations)
- **Dithering integration:** The collectors' reflective surfaces would posterize beautifully — bright specular highlights on sun-facing sides, dark silhouettes on the shadow side
- **LOD:** At distance, skip individual collectors — just dim the star and add a faint hazy shell (additive blended sphere slightly larger than the star)

**Rarity suggestion:** Ultra-rare. 1 in 500 systems. A partial swarm (10-30% coverage) is the "common" version; a near-complete swarm (80%+) should be 1 in 2000+.

---

### 2. Ring Worlds / Orbital Habitats

Three distinct scales worth implementing:

#### 2a. O'Neill Cylinder / Stanford Torus (Small — orbits a planet)

**What it is:** A rotating cylinder or donut-shaped habitat. The Stanford torus is 1.8 km diameter; O'Neill cylinders are 6-30 km long. These orbit planets like space stations.

**Visual appearance:** A small rotating structure near a planet. At the game's scale, these would be tiny — barely visible dots. Best represented as a special marker or icon near a planet rather than actual geometry.

**Retro rendering:** A small bright dot orbiting a planet with a label. Not worth full geometry at this scale — the game's pixelation would eat it. Could be a UI indicator on the system map instead.

**Rarity:** Rare. 1 in 50 systems. Tied to civilized planets — if a planet has city lights, there's a chance it also has orbital habitats.

#### 2b. Banks Orbital (Medium — orbits a star)

**What it is:** Iain Banks' Culture novels. A ring ~3 million km in diameter (about 10 million km circumference) orbiting a star. It spins to create gravity on its inner surface. Much smaller than a Ringworld but much larger than a Halo ring. Has a habitable inner surface with atmosphere, oceans, continents.

**Visual appearance:**
- From distance: A thin bright line/ellipse around the star, tilted at an angle to the viewer
- Catches sunlight on its inner surface — the lit side glows warmly
- From edge-on: Nearly invisible — just a hair-thin line
- From above/below: A clear ring shape with the star visible through the center

**Retro rendering:**
- `THREE.TorusGeometry` with very small tube radius relative to the ring radius (a very thin donut)
- Or a `THREE.RingGeometry` extruded slightly for thickness
- Apply a simple gradient material: bright warm color on the inner face (sunlit habitable surface), dark on the outer face
- At distance, could simplify to a `THREE.LineLoop` circle
- Tilt the ring's plane relative to the orbital plane for visual interest

**Rarity:** Very rare. 1 in 200 systems.

#### 2c. Niven Ringworld (Large — replaces planetary orbits)

**What it is:** Larry Niven's concept. A ring with the radius of Earth's orbit (~1 AU / 150 million km) around a star. 1.6 million km wide. Spins at 770 km/s for 1g gravity. Surface area = 3 million Earths.

**Visual appearance:**
- Dominates the entire system — it IS the system's habitable zone
- From distance: A bright band across the star, like Saturn's ring but thinner and at 1 AU
- Shadow squares (separate inner ring of panels) create a day/night cycle — visible as dark spots transiting the star
- From edge-on: Two thin bright lines extending from the star in opposite directions

**Retro rendering:**
- `THREE.RingGeometry` at the habitable zone distance
- Very wide compared to the Banks Orbital — this thing has noticeable width
- Inner surface has a terrain-like texture (procedural noise for continents/oceans at this scale)
- Raised rim walls at the edges (1000 km high walls to hold atmosphere) — visible as bright edge highlights
- The ring should cast a shadow on itself where shadow squares block the star

**Rarity:** Legendary. 1 in 1000+ systems. The rarest orbital habitat.

---

### 3. Halo Ring

**What it is:** Inspired by the Halo games (themselves inspired by Banks Orbitals). 10,000 km diameter — much smaller than a Banks Orbital but much more visually dramatic because of its proportions. Thick, with visible terrain, atmosphere, and a metallic outer hull.

**Visual appearance:**
- From distance: A bright ring tilted at an angle, with visible blue-green inner surface and grey metallic outer surface
- The ring's width-to-diameter ratio is much larger than a Banks Orbital — it looks chunky, substantial
- Atmosphere visible as a thin blue haze on the inner surface
- At certain angles, you can see terrain features (mountains, water) on the inner surface

**Retro rendering:**
- `THREE.TorusGeometry` with a larger tube radius relative to ring radius than the Banks Orbital
- Two-tone material: metallic grey outside, blue-green (habitable) inside
- At low poly counts, the torus segments are visible — this actually helps the retro aesthetic
- Add a subtle glow/haze on the inner surface (additive blended inner ring)
- 8-12 segments on the torus is plenty for the retro look

**Rarity:** Very rare. 1 in 300 systems. Slightly more common than Banks Orbitals because they're smaller and "easier" to build.

---

### 4. Matrioshka Brain

**What it is:** A computing megastructure made of nested Dyson spheres. The innermost sphere captures the star's energy for computation; waste heat radiates outward to the next sphere, which uses that lower-energy heat for more computation, and so on. ~11 layers for 99.9% energy capture. The entire star is converted into a computer.

**How it works:** Each layer runs at a progressively lower temperature. Inner layers run near stellar temperature (thousands of K), outer layers near interstellar temperature (~3K). Each layer is optimized for computation at its operating temperature.

**Visual appearance:**
- The star effectively vanishes — all energy is captured
- From outside: A warm infrared glow, like a dim ember — visible in the game as a very faint, reddish-brown sphere much larger than a normal star
- The outer shell might be barely above cosmic background temperature
- Occasionally, venting ports or maintenance gaps reveal brighter inner layers — like cracks of light in a dark shell
- The whole thing has an ominous, dead-star quality

**Retro rendering:**
- Multiple concentric `THREE.SphereGeometry` shells with decreasing opacity from inside out
- Innermost shell: bright orange/white (star temperature)
- Middle shells: red/infrared tones
- Outermost shell: very dark, almost black, with a faint warm glow
- Use low segment count (8-12 segments) so the nested spheres look faceted and retro
- Add small bright spots on the outer shell (venting/gaps) using emissive point lights or bright vertex colors
- The low-poly faceting of nested spheres would look incredible with Bayer dithering

**Rarity:** Legendary. 1 in 2000 systems. This represents a civilization so advanced it has converted its entire star into a computer. The rarest megastructure.

---

### 5. Shkadov Thruster (Stellar Engine)

**What it is:** A giant mirror parked on one side of a star, reflecting its radiation back. The asymmetric radiation pressure creates net thrust, slowly accelerating the entire star (and its solar system) through space. The mirror "hovers" via radiation pressure balancing gravity (a statite).

**How it works:** The mirror doesn't orbit — it sits stationary relative to the star, held up by radiation pressure. By reflecting starlight back at the star on one side, the star pushes itself in the opposite direction. Extremely slow but works over millions of years.

**Visual appearance:**
- A massive curved mirror on one side of the star — like a satellite dish or half-eggshell
- The mirror side reflects the star's light, creating a brilliant secondary light source
- From the mirror side: blinding reflection, almost like a second star
- From behind the mirror: a dark curved silhouette against the starfield
- The star appears offset from the center of the mirror's curvature

**Retro rendering:**
- Half of a `THREE.SphereGeometry` (use theta/phi limits to create a hemisphere or spherical cap)
- Highly reflective material on the concave (star-facing) side — bright white/yellow emissive
- Dark material on the convex (space-facing) side
- Position it offset from the star, facing the star
- The concave surface catches and reflects starlight — make it very bright
- Low-poly hemisphere with visible facets = great retro look
- Could add a faint "thrust beam" effect on the open side (the direction the star is being pushed)

**Rarity:** Very rare. 1 in 400 systems. Implies a civilization that wants to move its entire star somewhere.

---

### 6. Alderson Disk

**What it is:** An enormous flat disk with the star sitting in a hole at the center. The disk extends outward to roughly Mars or Jupiter orbital distance. Thousands of km thick. The habitable zone is an annular band at Earth-orbit distance from the center hole. Surface area = millions of Earths.

**Visual appearance:**
- From distance: Looks like an enormous accretion disk or protoplanetary disk, but clearly artificial — too flat, too uniform, too sharp-edged
- The star peeks through the central hole
- A 1000 km high wall surrounds the central hole (to keep atmosphere from falling into the star)
- From edge-on: A razor-thin line extending far from the star in both directions
- From above/below: A massive flat disk with concentric zone rings (like a vinyl record)

**Retro rendering:**
- `THREE.RingGeometry` with inner radius (central hole) and outer radius (edge of disk)
- Give it slight thickness with extrusion or a second offset ring
- Concentric color bands on the surface: inner hot zone (red/orange), habitable band (blue-green), outer cold zone (white/grey)
- Central hole wall: a bright ring around the inner edge
- Low-poly with visible polygon edges on the flat surface
- From edge-on, the disk nearly vanishes — just a line. This is a cool reveal moment as you approach

**Rarity:** Legendary. 1 in 1500 systems. Requires dismantling multiple planets for raw material.

---

### 7. Additional Megastructures Worth Considering

#### 7a. Topopolis (Cosmic Spaghetti)

**What it is:** An extremely long O'Neill cylinder that loops around a star, potentially multiple times, forming a torus knot. Like a piece of spaghetti wrapped around a ball.

**Visual appearance:** A thin tube looping around the star in a complex spiral/knot pattern. The tube itself is a habitat (spinning for gravity).

**Retro rendering:**
- `THREE.TubeGeometry` following a `THREE.TorusKnotGeometry` path
- Very thin tube, complex looping path
- The knot pattern looks organic and strange — unlike any natural formation
- Low segment count makes the tube look angular and retro

**Rarity:** Very rare. 1 in 500 systems.

#### 7b. Nicoll-Dyson Beam

**What it is:** A weaponized Dyson swarm. Instead of collecting energy for local use, the entire output of a star is focused into a single devastating beam aimed at a distant target. A star turned into a laser cannon.

**Visual appearance:** A Dyson swarm (see #1) with a visible beam of light emanating from one point on the swarm's surface, shooting off into deep space. The beam itself could be visible as a faint line extending to infinity.

**Retro rendering:**
- Dyson swarm geometry (see #1) plus a bright line (`THREE.Line` or cylinder) extending from one point outward
- The beam should be bright white/blue with a glow effect
- The beam direction should point toward a distant star (implying a target)

**Rarity:** Legendary. 1 in 3000 systems. Terrifying implications.

#### 7c. Stellar Engine (Caplan Thruster)

**What it is:** A more advanced stellar engine than the Shkadov thruster. Uses a Dyson swarm to collect energy, then fires two jets: one into the star (to push it) and one away from it (for additional thrust via reaction mass harvested from the star itself).

**Visual appearance:** A Dyson swarm with two visible jets — one aimed at the star, one aimed away. Like a star with rocket exhaust.

**Retro rendering:**
- Combine Dyson swarm geometry with two cone/cylinder jet effects
- Jets should glow bright blue/white
- The star appears to be "rocketing" through space

**Rarity:** Legendary. 1 in 2500 systems.

#### 7d. Penrose Sphere (Black Hole Computer)

**What it is:** A structure built around a rotating black hole to harvest energy from its ergosphere via the Penrose process. Essentially a Dyson sphere for a black hole.

**Visual appearance:** A shell of structures orbiting a black hole. The black hole's accretion disk and gravitational lensing are visible through gaps. Light bends strangely near the structure.

**Retro rendering:**
- Small dark sphere (black hole) with a bright accretion disk (`THREE.RingGeometry` with emissive orange/white)
- Surrounding shell of collector structures (instanced quads, like Dyson swarm but smaller scale)
- Gravitational lensing is hard to fake cheaply — could skip it or do a simple distortion in the dither shader
- The accretion disk is the visual star of this one

**Rarity:** Legendary. 1 in 3000 systems. Requires a black hole in the system.

---

### Megastructure Rarity Summary

| Structure | Rarity | Frequency | Notes |
|-----------|--------|-----------|-------|
| O'Neill/Stanford (orbital) | Rare | 1 in 50 | Tied to civilized planets |
| Dyson Swarm (partial) | Ultra-rare | 1 in 500 | 10-30% star coverage |
| Topopolis | Very rare | 1 in 500 | Cosmic spaghetti loop |
| Banks Orbital | Very rare | 1 in 200 | Thin ring, star-orbiting |
| Halo Ring | Very rare | 1 in 300 | Chunky ring, dramatic |
| Shkadov Thruster | Very rare | 1 in 400 | Half-mirror, moving star |
| Niven Ringworld | Legendary | 1 in 1000 | AU-scale ring |
| Alderson Disk | Legendary | 1 in 1500 | Flat disk, star in center |
| Dyson Swarm (complete) | Legendary | 1 in 2000 | 80%+ star coverage |
| Matrioshka Brain | Legendary | 1 in 2000 | Nested computing shells |
| Caplan Thruster | Legendary | 1 in 2500 | Star with jet engines |
| Nicoll-Dyson Beam | Legendary | 1 in 3000 | Star turned into laser |
| Penrose Sphere | Legendary | 1 in 3000 | Black hole harvester |

---

## TOPIC 2: RETRO CRT NAVIGATION COMPUTER

### Design Vision

Replace the current tilted-orthographic minimap (`SystemMap.js`) with a full-screen toggleable navigation computer. When activated (Tab key?), the game view fades and a CRT terminal fills the screen — an in-universe computer aboard the ship. Think: the MU-TH-UR 6000 terminal from Alien, crossed with an 80s radar display.

### Real-World Visual References

#### Early Radar Displays
- Plan Position Indicator (PPI) scopes: circular display with a rotating sweep line, bright blips for contacts
- Green phosphor on black, bright center fading to dim edges
- Range rings (concentric circles at known distances)
- This is the strongest reference for the system map view — the current minimap already has orbital rings

#### Vector Displays (Vectrex, Oscilloscopes)
- Sharp bright lines on black — no raster, no pixels, just pure geometry
- Lines glow with phosphor bloom — bright core with soft falloff
- Asteroids, Tempest, Battlezone used this look
- Perfect for orbit lines, zone boundaries, wireframe planet markers

#### Early Flight Simulators / Avionics
- Attitude indicators, heading tapes, altitude ladders
- Dense information in small spaces using abbreviations and symbols
- Numeric readouts with fixed-width fonts
- Status indicators: small squares that light up green/amber/red

### Sci-Fi Interface References

#### Alien (1979) — MU-TH-UR 6000 / Nostromo Terminals
- **Font:** Stretched serif font (City Light) — unusual for sci-fi but distinctive
- **Color:** Green phosphor on black (P1 phosphor simulation)
- **Layout:** Dense text blocks, left-aligned, no graphics — pure text interface
- **Interaction:** Keyboard only, command-line style, deliberate clunkiness
- **Key detail:** The terminals feel like tools, not entertainment — utilitarian, not pretty
- **Takeaway for Well Dipper:** The nav computer should feel like a tool the ship actually has. Clunky is OK. Information density is good.

#### 2001: A Space Odyssey — HAL 9000 Displays
- Clean, sparse layouts with lots of negative space
- Red accent color (HAL's eye)
- Simple geometric shapes — circles, lines, grids
- Status readouts in clean sans-serif type

#### Star Trek TOS/TNG
- TOS: Colored blocks, simple geometric shapes, very 60s
- TNG: LCARS — rounded rectangles, pastel color blocks, horizontal layout
- Both use color-coding extensively for different data types

#### Blade Runner Terminals
- Esper machine: photo enhancement with zoom/pan
- Dense, layered UI with multiple data windows
- Amber/orange phosphor look

#### WarGames — WOPR
- Green vector graphics on black
- Map projections with trajectory lines
- Blinking cursor, command-line interaction
- Military aesthetic — terse, abbreviated labels

### Game UI References

#### FTL: Faster Than Light
- Top-down ship view with room-by-room detail
- System map: node graph with connections (not spatial)
- Clean, readable, minimal — information over aesthetics
- Color-coded system status (green/yellow/red)

#### Duskers
- **The gold standard for this aesthetic.** Command-line interface IS the game
- Glitching CRT overlay, scan lines, phosphor glow
- Top-down drone view through "cameras" with noise and static
- Interface feels like peering through a broken terminal at a dangerous world
- **Key takeaway:** The imperfection IS the atmosphere. Static, glitches, scan line flicker — these aren't bugs, they're the experience.

#### Hacknet
- Full terminal interface — command line, file browser, network map
- Green-on-black with occasional color highlights
- Network visualization as node graph with connecting lines

#### Return of the Obra Dinn
- 1-bit dithered rendering (Bayer-like)
- Extremely limited palette (black + one color)
- Proves that heavy visual constraints create atmosphere, not limit it
- **Relevant to Well Dipper:** The game already uses Bayer dithering — the nav computer could go even more extreme (1-bit on the CRT screen)

#### Alien: Isolation
- Perfectly recreated 1979-era terminal interfaces as in-game interactable objects
- Deliberate clunkiness — slow text rendering, scan lines, screen curvature
- Green phosphor CRT with visible pixel grid
- Diegetic: the interface exists in the game world, not as a HUD overlay
- **Key design principle:** "The clumsiness of interactions was appropriate rather than jarring"

### Information to Display

The nav computer should show everything the player needs to understand the current system and plan their next move:

#### Primary View: System Map (Radar Mode)
- **Center:** Star (or binary stars) as a bright pulsing dot
- **Orbital rings:** Concentric circles for each planet's orbit (like radar range rings)
- **Planet markers:** Small labeled dots on their orbital rings, positioned at current orbital angle
- **Moon indicators:** Tiny dots near planet markers (maybe just a count: "3 MOONS")
- **Asteroid belt:** Dashed or dotted ring at the belt's orbital distance
- **Zone indicators:** Habitable zone shown as a shaded/hatched band between the inner and outer HZ boundaries
- **Player position:** Bright blinking crosshair or chevron showing the ship's location
- **Warp target:** Highlighted destination with estimated distance
- **Heading indicator:** Line from player position showing current heading

#### Secondary Panels (Text Readouts)
- **Star data:** Type, class, temperature, luminosity
- **Selected body info:** Name, type, radius, orbital distance, composition notes
- **System summary:** Planet count, asteroid belt presence, anomalies detected
- **Navigation data:** Current coordinates, velocity, heading, distance to target
- **Scanner results:** "ANOMALY DETECTED — SECTOR 4" for exotic planets, megastructures, etc.
- **Warp status:** Fuel/energy, destination system name, ETA

#### Tertiary: Galaxy/Cluster View (Zoom Out)
- Show the broader neighborhood — nearby star systems as dots
- Current system highlighted
- Lines connecting systems you've visited (breadcrumb trail)
- Destination system indicator

### Interaction Design

How the player uses the nav computer:

- **Toggle:** Single key (Tab?) opens/closes the full-screen computer
- **No mouse cursor** on the CRT — use keyboard only for authenticity, OR use mouse but render a blocky crosshair cursor that moves in discrete steps
- **Zoom levels:** Cycle through system view → cluster view → galaxy view with +/- keys or scroll
- **Select body:** Arrow keys or click to cycle through / select planets. Selected body gets a highlight ring and its info populates the text panel
- **Set warp target:** Select a planet or distant star and press Enter/Space to mark as warp target
- **Scan mode:** Press S to "scan" — text types out scanner results with a typing animation

### Animation and Effects

These effects sell the CRT illusion:

- **Scan lines:** Horizontal lines across the entire screen, subtle but visible. Slight brightness variation between even/odd lines
- **Phosphor glow:** Bright elements bleed light into surrounding pixels. Bright text/lines have a soft halo
- **Screen curvature:** Slight barrel distortion at screen edges (pincushion/barrel shader)
- **Flicker:** Very subtle brightness oscillation (50/60 Hz simulation — just a tiny sine wave on overall brightness)
- **Text typing animation:** When new info appears, it types out character by character with a cursor
- **Boot sequence:** When opening the nav computer, show a brief boot-up sequence: "INITIALIZING NAV SYSTEM...", "SCANNING LOCAL SPACE...", "SYSTEM: [name]", then the map appears
- **Static/noise:** Occasional brief static bursts, especially when scanning or receiving new data
- **Interlacing artifacts:** Slight horizontal offset on alternating frames

### Color Schemes

Three phosphor options — could be player-selectable or system-dependent:

#### Green Phosphor (P1) — Classic
- **Background:** `#000000` (pure black)
- **Primary text/lines:** `#33ff33` (bright green)
- **Dim text/secondary:** `#0a660a` (dark green)
- **Highlight/alert:** `#66ff66` (light green, brighter)
- **Glow color:** `#00ff00` with additive blending
- **Feel:** Alien, Matrix, classic terminal. The default choice.

#### Amber Phosphor — Warm
- **Background:** `#000000`
- **Primary:** `#ffaa00` (warm amber/orange)
- **Dim:** `#664400` (dark amber)
- **Highlight:** `#ffcc33` (bright yellow-amber)
- **Glow color:** `#ff8800` with additive blending
- **Feel:** IBM PC, warm, easier on eyes. More "analog instrument" feeling.

#### Blue Phosphor — Cold/Military
- **Background:** `#000000`
- **Primary:** `#3399ff` (medium blue)
- **Dim:** `#0a3366` (dark blue)
- **Highlight:** `#66ccff` (light blue)
- **Glow color:** `#0066ff` with additive blending
- **Feel:** Military radar, cold, precise. Good for the "deep space" vibe.

### Typography

- **Current font:** DotGothic16 (already in the game — a pixel/dot-matrix style font)
- **DotGothic16 is a good fit** for the CRT aesthetic — it's a Japanese dot-matrix font that reads as "retro computer"
- **Additional options to consider:**
  - **IBM Plex Mono** — modern but has that IBM terminal feel
  - **VT323** — Google Font, designed to look like a VT320 terminal
  - **Press Start 2P** — very pixelated, more "game" than "terminal"
  - **Share Tech Mono** — clean monospace with a technical feel
- **Recommendation:** Stick with DotGothic16 for consistency with the rest of the game UI. If you want a second font specifically for the nav computer (to make it feel like a different system), VT323 is the strongest choice — it's literally named after a real terminal.

### Implementation Approaches (Three.js)

Three viable approaches, from simplest to most immersive:

#### Option A: HTML/CSS Overlay (Simplest)
- Render the CRT computer as an HTML overlay on top of the Three.js canvas
- Use CSS for scan lines (repeating-linear-gradient), screen curvature (border-radius + overflow), phosphor glow (text-shadow, box-shadow)
- Draw the system map on a 2D `<canvas>` element
- **Pros:** Easy text rendering, easy interaction, easy to iterate
- **Cons:** Doesn't integrate with the Bayer dithering pipeline, feels separate from the game

#### Option B: Render-to-Texture (Recommended)
- Render the nav computer UI to an offscreen `<canvas>` (2D context)
- Use that canvas as a `THREE.CanvasTexture` on a full-screen quad
- Apply CRT effects (scan lines, curvature, glow) as a custom shader on that quad
- The shader runs through the same dithering pipeline as the rest of the game
- **Pros:** Integrates with existing post-processing, CRT effects in GLSL are powerful and cheap, the computer screen "exists" in the game's visual world
- **Cons:** Text rendering on 2D canvas requires manual layout, slightly more complex setup

#### Option C: Separate Three.js Scene (Most Immersive)
- Render the nav computer as a second Three.js scene (like the current SystemMap)
- All UI elements are 3D objects: text as sprite/billboard, orbits as line geometry, planets as points
- Apply CRT shader as a post-processing pass on this scene only
- Could even render the computer as a physical CRT monitor in 3D space that the camera flies into
- **Pros:** Full 3D control, could do cool transitions (zoom into the screen), everything is geometry
- **Cons:** Most complex, text rendering in Three.js is painful

**Recommendation:** Option B (render-to-texture). It gives you the CRT shader flexibility of Option C with the easy text rendering of Option A. The existing `SystemMap.js` already renders to a separate scene — this would replace it with a canvas-based approach fed through a CRT shader.

### CRT Shader Outline (GLSL)

Key uniforms and effects for the CRT post-processing shader:

```
uniform sampler2D tScreen;      // the nav computer canvas texture
uniform float time;             // for animation
uniform vec2 resolution;        // screen size
uniform float scanLineIntensity; // 0.0-1.0
uniform float curvature;        // barrel distortion amount
uniform float glowStrength;     // phosphor bloom amount
uniform float flickerAmount;    // brightness oscillation

// Effects to apply in order:
// 1. Barrel distortion (curve the UV coordinates)
// 2. Sample the screen texture
// 3. Apply scan lines (darken every other horizontal line)
// 4. Add phosphor glow (blur + additive blend)
// 5. Add flicker (multiply by sin(time * 60.0) * flickerAmount)
// 6. Vignette (darken edges)
// 7. Color fringing / chromatic aberration (offset R/G/B channels slightly)
```

### Existing Three.js CRT Resources
- [threejs-crt-shader](https://github.com/unframework/threejs-crt-shader) — renders canvas to simulated 3D CRT
- [CRT Shader Effect demo](https://daenavan.github.io/crt-threejs/) — scanlines, barrel distortion, chromatic aberration
- [RetroZone](https://phaser.io/news/2026/03/retrozone-open-source-retro-display-engine-phaser) — open source display engine with phosphor glow, scanlines, vector display effects (works with Three.js)

---

## Sources

### Megastructures
- [Dyson sphere — Wikipedia](https://en.wikipedia.org/wiki/Dyson_sphere)
- [Dyson Swarm Visualization](https://dysonswarm.com/)
- [Dyson Sphere Concept Explained](https://techlifeinsights.com/2025/05/05/dyson-sphere-concept-explained/)
- [Banks Orbital — Culture Wiki](https://theculture.fandom.com/wiki/Orbital_(Wikipedia_version))
- [Banks Orbital — Orion's Arm](https://www.orionsarm.com/eg-article/4845ef5c4ca7c)
- [Halo Array — Halopedia](https://www.halopedia.org/Halo_Array)
- [Matrioshka Brain — Wikipedia](https://en.wikipedia.org/wiki/Matrioshka_brain)
- [Matrioshka Brain — Big Think](https://bigthink.com/hard-science/are-we-living-inside-a-matrioshka-brain-how-advanced-civilizations-could-reshape-reality/)
- [Neil Blevins Megastructures Art](http://neilblevins.com/projects/megastructures/megastructures.htm)
- [Shkadov Thruster — Centauri Dreams](https://www.centauri-dreams.org/2013/11/26/moving-stars-the-shkadov-thruster/)
- [Stellar Engine — Wikipedia](https://en.wikipedia.org/wiki/Stellar_engine)
- [Alderson Disk — Wikipedia](https://en.wikipedia.org/wiki/Alderson_disk)
- [Stanford Torus — Wikipedia](https://en.wikipedia.org/wiki/Stanford_torus)
- [Stanford Torus — NSS](https://nss.org/stanford-torus-space-settlement/)
- [Megastructure Compendium — Isaac Arthur Wiki](https://isaacarthur.fandom.com/wiki/The_Megastructure_Compendium)
- [Megastructures — Discover Sci-Fi](https://discoverscifi.com/megastructures/)
- [Top 10 Theoretical Megastructures — Listverse](https://listverse.com/2010/03/07/top-10-theoretical-megastructures/)
- [Megastructure — Wikipedia](https://en.wikipedia.org/wiki/Megastructure)
- [Stellaris Megastructures Wiki](https://stellaris.paradoxwikis.com/Megastructures)

### CRT / Interface Design
- [Alien Typography — Typeset In The Future](https://typesetinthefuture.com/2014/12/01/alien/)
- [Alien: Isolation UI Analysis — Medium](https://goukigod.medium.com/the-incredible-user-interface-design-of-alien-isolation-game-gui-analysis-cb7cd0e1f6e)
- [Alien: Isolation — HUDS+GUIS](https://www.hudsandguis.com/home/2014/06/04/alien-isolation)
- [Duskers UI — Interface In Game](https://interfaceingame.com/games/duskers/)
- [Duskers UX Design Analysis](https://www.feedme.design/duskers-a-gaming-masterclass-in-immersive-storytelling/)
- [FTL UI — Interface In Game](https://interfaceingame.com/games/ftl-faster-than-light/)
- [Obra Dinn UI — Game UI Database](https://www.gameuidatabase.com/gameData.php?id=1460)
- [Alien: Isolation UI — Game UI Database](https://www.gameuidatabase.com/gameData.php?id=381)
- [CRT Phosphor Colors — Hacker News](https://news.ycombinator.com/item?id=33486902)
- [Monochrome Monitor — Wikipedia](https://en.wikipedia.org/wiki/Monochrome_monitor)
- [Simulating CRT Monitors — int10h](https://int10h.org/blog/2021/02/simulating-crt-monitors-ffmpeg-pt-2-monochrome/)
- [Vector Monitor — Wikipedia](https://en.wikipedia.org/wiki/Vector_monitor)
- [Three.js CRT Shader — GitHub](https://github.com/unframework/threejs-crt-shader)
- [CRT Shader Effect Demo](https://daenavan.github.io/crt-threejs/)
- [RetroZone CRT Engine](https://phaser.io/news/2026/03/retrozone-open-source-retro-display-engine-phaser)
- [Retro CRT Terminal with WebGL](https://dev.to/remojansen/building-a-retro-crt-terminal-website-with-webgl-and-github-copilot-claude-opus-35-3jfd)
