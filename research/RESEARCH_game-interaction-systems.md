# Research: Game Interaction Systems for Well Dipper

> How to evolve a meditative space screensaver into a game.
> Each system is assessed for fit, MVP scope, complexity, and dependencies.

---

## Table of Contents
1. [Ship Movement & Flight Model](#1-ship-movement--flight-model)
2. [Combat Systems](#2-combat-systems)
3. [Scanning & Discovery](#3-scanning--discovery)
4. [Docking & Landing](#4-docking--landing)
5. [Inventory & Trading](#5-inventory--trading)
6. [NPC Interaction](#6-npc-interaction)
7. [Progression Systems](#7-progression-systems)
8. [Save System](#8-save-system)
9. [System Dependency Map](#9-system-dependency-map)
10. [Recommended Build Order](#10-recommended-build-order)

---

## 1. Ship Movement & Flight Model

### How Space Games Handle Movement

There are three main approaches to spaceship movement in games, each with very different feel:

**Newtonian (realistic physics)**
- Thrust adds velocity in a direction; the ship keeps moving when thrust stops.
- Turning does NOT change your direction of travel — you must thrust to change velocity.
- Used by: Frontier: Elite II, Outer Wilds, KSP, Asteroids (the original!).
- Feel: Slippery, momentum-heavy. Rewarding when mastered, but frustrating for new players. Docking and precision maneuvering are hard.
- Why it works in Outer Wilds: the entire game is about learning to navigate with physics. Mastering the ship IS the game. But Outer Wilds also gives you generous auto-dampening thrusters and a "match velocity" button to reduce frustration.

**Arcade (simplified)**
- Ship goes where you point it. Turning instantly changes direction of travel.
- Often has a speed cap and instant deceleration when you let go.
- Used by: No Man's Sky (in atmosphere), most mobile space games, Star Fox.
- Feel: Responsive, accessible, but doesn't feel like "space." More like flying a plane.
- Why NMS uses it: accessibility is king for a mass-market game. NMS pulse drive in space is closer to hybrid.

**Hybrid (the sweet spot for most games)**
- Ship has momentum and drift, but with dampeners/flight-assist that slow you down when you stop thrusting.
- Turning changes your facing, and thrust is always applied in the facing direction, but existing velocity bleeds off over time.
- You feel the weight without the frustration.
- Used by: Elite Dangerous (flight assist ON), Everspace, Freelancer, No Man's Sky (in space).
- Feel: Weighty but controllable. The most popular approach for exploration games.

### What Works for Well Dipper?

**Recommendation: Hybrid model with strong dampening.**

Why:
- Well Dipper is meditative. Fighting the controls breaks the vibe.
- Players should feel like they're gliding through space, not wrestling a Newtonian simulation.
- Some drift/momentum gives the feeling of mass and space, but strong auto-dampening means you stop when you want to stop.
- Think "canoe on a still lake" — gentle momentum, easy to control.

Key parameters to tune:
- `thrustForce`: how fast you accelerate
- `maxSpeed`: hard cap (prevent flying through planets)
- `dampening`: how quickly you slow down when not thrusting (0.95-0.98 per frame feels right)
- `turnSpeed`: how fast the ship rotates
- `turnDampening`: how quickly rotation stops

### Three.js Implementation

The core pattern is a velocity-based movement system updated every frame:

```javascript
// Ship state
const ship = {
  mesh: shipMesh,           // Three.js Object3D
  velocity: new THREE.Vector3(),
  angularVelocity: new THREE.Vector3(),
  thrustForce: 50,          // units/sec^2
  maxSpeed: 100,            // units/sec
  dampening: 0.97,          // velocity multiplier per frame (at 60fps)
  turnSpeed: 2.0,           // radians/sec
  turnDampening: 0.92,
};

function updateShip(dt) {
  // 1. Apply thrust in ship's forward direction
  if (input.forward) {
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(ship.mesh.quaternion);
    ship.velocity.addScaledVector(forward, ship.thrustForce * dt);
  }

  // 2. Clamp to max speed
  if (ship.velocity.length() > ship.maxSpeed) {
    ship.velocity.setLength(ship.maxSpeed);
  }

  // 3. Apply dampening (frame-rate independent)
  const damp = Math.pow(ship.dampening, dt * 60);
  ship.velocity.multiplyScalar(damp);

  // 4. Apply rotation
  if (input.pitchUp) ship.angularVelocity.x -= ship.turnSpeed * dt;
  if (input.yawLeft) ship.angularVelocity.y += ship.turnSpeed * dt;
  // ... etc for all axes

  // 5. Dampen rotation
  const rotDamp = Math.pow(ship.turnDampening, dt * 60);
  ship.angularVelocity.multiplyScalar(rotDamp);

  // 6. Apply angular velocity to mesh rotation
  const euler = new THREE.Euler(
    ship.angularVelocity.x * dt,
    ship.angularVelocity.y * dt,
    ship.angularVelocity.z * dt,
    'YXZ'
  );
  ship.mesh.quaternion.multiply(
    new THREE.Quaternion().setFromEuler(euler)
  );

  // 7. Move the ship
  ship.mesh.position.addScaledVector(ship.velocity, dt);
}
```

Key notes:
- Use `dt` (delta time) everywhere for frame-rate independence.
- Use quaternions (not Euler angles) for rotation to avoid gimbal lock.
- `Math.pow(dampening, dt * 60)` makes dampening consistent regardless of framerate.
- THREE.ObjectControls (GitHub library) provides a ready-made 6DOF helper if you want a head start.

### Camera Modes

**Chase cam (recommended default)**

Camera follows behind and above the ship, looking at or past it. The most intuitive for 3rd-person space games.

```javascript
function updateChaseCamera(ship, camera, dt) {
  // Desired camera position: behind and above the ship
  const offset = new THREE.Vector3(0, 3, 12); // up 3, back 12
  offset.applyQuaternion(ship.mesh.quaternion);
  const desiredPos = ship.mesh.position.clone().add(offset);

  // Smooth follow (lerp)
  const lerpFactor = 1 - Math.pow(0.05, dt); // ~0.05 = tightness
  camera.position.lerp(desiredPos, lerpFactor);

  // Look at a point ahead of the ship (not the ship itself)
  const lookTarget = ship.mesh.position.clone();
  const ahead = new THREE.Vector3(0, 0, -10);
  ahead.applyQuaternion(ship.mesh.quaternion);
  lookTarget.add(ahead);
  camera.lookAt(lookTarget);
}
```

The lerp factor controls how tightly the camera follows. Lower = more cinematic drift. Higher = more responsive. For meditative feel, keep it loose (0.02-0.06).

**Cockpit view**

Camera is parented to the ship mesh. Add a slight lag on rotation for comfort:

```javascript
// Parent camera to ship
ship.mesh.add(camera);
camera.position.set(0, 1.2, 0.5); // pilot's eye position
camera.rotation.set(0, Math.PI, 0); // look forward
```

For retro aesthetic: overlay a cockpit frame as a 2D HUD element (HTML/CSS or a screen-space quad). Think Wing Commander.

**Orbit cam (what you already have)**

The existing CameraController already handles orbit mode. This becomes the "photo mode" or "system overview" when you're not actively flying.

### Transitioning from Floating Camera to Ship

This is the critical design question. Currently Well Dipper is a disembodied camera drifting through space. Adding a ship means the player needs to shift from "I am a ghost floating through space" to "I am piloting a ship."

**Approach: The ship was always there.**

1. Add a ship mesh to the scene, positioned where the camera is.
2. The current orbit/flythrough camera becomes "external view" — you're looking at your own ship.
3. When the player presses a key (e.g., F to toggle flight mode), the camera transitions to chase cam, and WASD/arrow controls start moving the ship.
4. The transition: animate the camera from its current position to the chase-cam position behind the ship over ~1-2 seconds using lerp. During the transition, fade in the ship mesh (it was invisible in "screensaver mode").

**Screensaver mode = autopilot.** The flythrough camera is just the ship flying itself. When you take control, it's the same ship, same trajectory — you're just grabbing the stick.

This preserves the meditative feel: you can always let go and return to screensaver/autopilot mode.

### How Outer Wilds and NMS Handle It

**Outer Wilds:**
- Full Newtonian with generous helpers (auto-dampening, match-velocity button).
- Six degrees of freedom: thrust in any direction.
- Landing is manual and physics-based (which is terrifying and fun).
- The ship has visible thrusters that fire based on input — great for feedback.
- Cockpit view is primary, with instruments that show velocity, fuel, etc.
- Lock-on autopilot to planets (sets course, you can override).

**No Man's Sky:**
- Arcade in atmosphere (can't crash, auto-levels).
- Hybrid in space (some momentum, speed tiers: normal, boost, pulse drive).
- Landing is fully automated — press a button near a surface and it lands itself.
- Third-person is the default camera.
- Speed tiers create distinct "modes" of travel: normal flight (maneuvering), boost (fast travel within a planet), pulse drive (system travel), warp (between systems).

**What to borrow:**
- From Outer Wilds: visible thruster feedback, lock-on autopilot to planets, the feel of momentum.
- From NMS: automated landing, speed tiers (especially since Well Dipper already has warp), third-person default.

### Assessment

| Criteria | Rating |
|----------|--------|
| **Fit for Well Dipper** | Essential — this is the foundation for every other system |
| **MVP version** | Hybrid flight model + chase cam + WASD controls + autopilot toggle |
| **Complexity** | Medium — the physics are simple, but camera transitions and input handling need care |
| **Estimated effort** | 2-3 days for basic flight, +1-2 days for camera modes and autopilot integration |
| **Dependencies** | None — this is the foundation |

---

## 2. Combat Systems

### Should Well Dipper Have Combat?

This is the most important question in this section. Let's look at how other exploration games handle it:

**Games without combat:**
- **Outer Wilds:** Zero combat. The universe is dangerous (sun explodes, anglerfish eat you) but you never fight. One of the highest-rated games ever. Proves you don't need combat for a compelling space game.
- **Journey:** No combat. Other players are companions, not enemies. Universally praised for its meditative quality.

**Games with optional/minimal combat:**
- **Subnautica:** You have a knife and that's basically it. Most threats are avoided, not fought. ~70% peaceful exploration, ~20% isolation/tension, ~10% sheer terror. Combat being weak makes the world feel dangerous.
- **No Man's Sky:** Has combat (space pirates, sentinels) but it's widely considered the weakest part of the game. Players who love NMS love the exploration, not the fighting.

**Games with integrated combat:**
- **Elite Dangerous:** Combat is deep and satisfying but also complex. Different game entirely from Well Dipper's vibe.
- **FTL:** Combat IS the game, with exploration as the wrapper.

**Recommendation for Well Dipper: No combat in the MVP. Possibly never.**

Reasons:
1. Combat requires enemy AI, weapons, health systems, balancing — massive scope increase.
2. It changes the emotional register. "Meditative drift" and "dodge lasers" are opposing vibes.
3. The most beloved exploration games (Outer Wilds, Journey) prove combat isn't needed.
4. If danger is desired later, environmental hazards (radiation, gravity wells, unstable systems) achieve tension without combat.

**If combat is added later (Phase 2+):**

### Minimum Viable Combat

Keep it simple. Think early PS1 space games, not Elite Dangerous.

**Weapons that fit retro aesthetic:**
- **Lasers:** `THREE.Line` or `THREE.BufferGeometry` with a simple line from ship to target. Glow via additive blending. Very retro, very cheap to render.
- **Missiles:** Billboard sprites (already in Well Dipper's toolkit). A small bright sprite that tracks toward a target. Explosion = expanding sprite that fades.
- **Beam weapons:** Sustained line between ship and target, with screen-shake. Think Wing Commander.

**Target locking:**
- Raycaster from camera center, find nearest ship in a cone.
- UI: bracket/reticle around the locked target (HTML overlay or screen-space quad).
- Lock-on sound effect (Well Dipper already has a "lock-on" sound!).

**Health/shields/damage:**
- Keep it minimal: a single health bar. Shield recharges over time.
- Damage = screen flash + shake + health decrease.
- Death = fade to black, respawn in same system (or warp to a random one).

**Enemy AI (if needed):**

Simple finite state machine with 3-4 states:

```
PATROL → (player detected) → CHASE → (in range) → ATTACK → (player escapes) → PATROL
                                                    ↓
                                              (health low) → FLEE
```

Each state has simple behavior:
- PATROL: fly between random waypoints near a planet.
- CHASE: turn toward player, thrust.
- ATTACK: fire weapons when facing player and in range.
- FLEE: turn away, thrust at max speed.

This is dead simple to implement and looks convincing at PS1 fidelity.

### Assessment

| Criteria | Rating |
|----------|--------|
| **Fit for Well Dipper** | Poor — actively conflicts with meditative vibe |
| **MVP version** | Skip entirely. If forced: lasers + 3-state AI + health bar |
| **Complexity** | High — AI, weapons, balancing, UI all needed simultaneously |
| **Estimated effort** | 5-7 days minimum for anything that feels good |
| **Dependencies** | Ship movement (must exist first), save system (need to save health/loadout) |

---

## 3. Scanning & Discovery

### How Exploration Games Handle Scanning

This is where Well Dipper can really shine. Scanning is the mechanic that turns "looking at things" into "discovering things," and Well Dipper already has the "looking at things" part nailed.

**Elite Dangerous — Discovery Scanner:**
- Honk the system scanner: reveals all bodies in the system on the map.
- Detailed Surface Scanner: fly to each body, launch probes to map the surface.
- First discovery bonus: your name permanently attached to what you found.
- Multiple tiers create a loop: quick scan → interesting? → detailed scan → reward.

**No Man's Sky — Analysis Visor:**
- Point at any object, hold scan.
- Progress bar fills, info is revealed.
- Different categories: flora, fauna, minerals, buildings.
- Completion bonuses: scan all fauna on a planet = big reward.
- Visual: scan lines sweep across the object, data populates on screen.

**Outer Wilds — Ship Log:**
- No explicit scanner — you discover by exploring and reading.
- The ship log tracks what you've found and connects related discoveries.
- "There's more to explore here" indicators on the log.
- Extremely satisfying because discovery is knowledge-based, not button-pressing.

### Proposed Scanning System for Well Dipper

**Design philosophy:** Scanning should feel like using a real ship instrument. A retro CRT readout that populates with data as you look at things. Fits perfectly with the planned Navigation Computer aesthetic.

**Progressive disclosure (3 tiers):**

| Tier | How | What It Reveals | Visual Feedback |
|------|-----|-----------------|-----------------|
| **Passive scan** | Automatic when body is in view | Type icon, rough size, zone | Faint bracket around body |
| **Active scan** | Hold scan key while looking at body (2-3 sec) | Full type name, radius, features, atmosphere | Scan lines sweep across body, CRT readout populates |
| **Deep scan** | Orbit close + hold scan key (5-8 sec) | Composition, habitability, anomalies, lore text | Detailed readout fills in, discovery chime |

The passive scan is free — it's what makes the universe feel alive as you look around. Active and deep scans require intent and time, making discoveries feel earned.

**What makes scanning feel rewarding:**
1. **Sound design.** A distinct chime/tone when a scan completes. Different tone for rare finds. Well Dipper's SoundEngine can synthesize these.
2. **Visual feedback.** Scan lines sweeping across the object (shader effect). Data appearing character by character on the CRT readout (typewriter effect).
3. **Rarity callouts.** When you scan a terrestrial planet (~3% of systems), the UI should react — different color, special sound, "ANOMALY DETECTED" text.
4. **Discovery log.** Persistent record of everything you've scanned. "You've discovered 47 of 11 planet types" gives completionist pull.

### Three.js Implementation

**Raycasting for scan targets:**

Well Dipper already uses raycasting for body selection (clicking planets). Extend this:

```javascript
function updateScanning(camera, bodies, dt) {
  // Cast ray from screen center
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  // Check intersections with body meshes
  const hits = raycaster.intersectObjects(bodies.map(b => b.mesh));

  if (hits.length > 0 && input.scanning) {
    const target = hits[0].object.userData.bodyData;
    target.scanProgress += dt / target.scanTime; // scanTime varies by tier

    if (target.scanProgress >= 1.0) {
      completeScan(target);
    }
  }
}
```

**UI overlay for scan data:**

Two approaches:
1. **HTML overlay (recommended for retro text).** Use a `<div>` positioned over the canvas with retro font styling. Easier to style, supports the CRT aesthetic. Already used for BodyInfo HUD.
2. **Screen-space quad.** Render scan data onto a texture, display as a billboard. More immersive but harder to update text.

The HTML approach is simpler and fits Well Dipper's existing UI pattern (BodyInfo already shows planet data in HTML overlays).

**Scan line shader effect:**

Add a scan effect to the planet's material when being scanned:

```glsl
// In planet fragment shader, add:
uniform float scanProgress; // 0.0 to 1.0
uniform float scanTime;     // current time

if (scanProgress > 0.0) {
  // Horizontal scan line sweeping down the planet
  float scanLine = step(scanProgress, uv.y);
  // Brighten scanned area slightly
  color.rgb = mix(color.rgb, color.rgb * 1.3, scanLine * 0.3);
  // Add thin bright line at scan edge
  float lineWidth = 0.005;
  float edge = smoothstep(scanProgress - lineWidth, scanProgress, uv.y)
             - smoothstep(scanProgress, scanProgress + lineWidth, uv.y);
  color.rgb += vec3(0.0, 1.0, 0.5) * edge; // green scan line
}
```

### Assessment

| Criteria | Rating |
|----------|--------|
| **Fit for Well Dipper** | Excellent — this is the most natural game mechanic for the existing experience |
| **MVP version** | Passive labels on bodies + active scan (hold key for 2 sec) = type + features revealed |
| **Complexity** | Low-Medium — raycasting exists, UI exists, just need to connect them with a progress system |
| **Estimated effort** | 2-3 days for basic scanning, +2 days for visual effects and discovery log |
| **Dependencies** | Ship movement (need to point at things), save system (persist discoveries) |

---

## 4. Docking & Landing

### How Space Games Handle Docking

**Elite Dangerous — The Gold Standard:**
- Request docking permission from station (comms menu).
- Navigate through the mail slot (rotating station entrance).
- Find your assigned landing pad.
- Lower landing gear, align with pad markers, touch down.
- Optional: buy a docking computer that automates the whole thing (plays Blue Danube waltz while it works).
- Manual docking is one of the most memorable experiences in the game — terrifying at first, satisfying once mastered.

**No Man's Sky — Fully Automated:**
- Fly near a landing pad or flat surface.
- Press land button.
- Ship auto-lands with a canned animation.
- Zero skill involved. Gets you to the content faster.

**Outer Wilds — Manual and Terrifying:**
- No docking. You land on surfaces with physics.
- Landing is Newtonian: brake too late and you crash. Turn wrong and you bounce off a moon.
- Some of the most memorable moments come from botched landings.

### What Works for Well Dipper?

**Recommendation: Automated docking with a cinematic approach sequence.**

Why:
- Manual docking at PS1 resolution with dithering would be frustrating (hard to judge distances with low visual fidelity).
- The meditative vibe is better served by watching a beautiful approach sequence than wrestling with alignment.
- An automated docking sequence can be a mini-cutscene — camera angles, music shift, the station growing in the viewport. Very cinematic.

**The approach sequence (design concept):**

1. Player targets a station and initiates docking (key press or menu).
2. Ship automatically aligns with approach vector.
3. Camera cuts to a cinematic angle: side view showing ship and station, or over-the-shoulder.
4. Distance indicator counts down (retro numerical display).
5. Ship slides into dock. Brief fade or transition.
6. Interior loads (if on-foot exploration exists) or station menu appears.

### Three.js Implementation

**Camera animation for approach:**

Use lerp/slerp to smoothly move the camera through waypoints:

```javascript
class DockingSequence {
  constructor(ship, station, camera) {
    this.waypoints = this._generateWaypoints(ship, station);
    this.progress = 0;
    this.duration = 8; // seconds
    this.camera = camera;
    this.ship = ship;
  }

  _generateWaypoints(ship, station) {
    const dockPos = station.dockingPort.getWorldPosition(new THREE.Vector3());
    const approachDir = dockPos.clone().sub(ship.position).normalize();
    const approachStart = dockPos.clone().addScaledVector(approachDir, -50);

    return [
      { shipPos: ship.position.clone(), camOffset: new THREE.Vector3(5, 3, 10) },
      { shipPos: approachStart, camOffset: new THREE.Vector3(8, 2, 5) },
      { shipPos: dockPos, camOffset: new THREE.Vector3(3, 1, 2) },
    ];
  }

  update(dt) {
    this.progress += dt / this.duration;
    if (this.progress >= 1) return true; // done

    // Interpolate ship position along path
    // Interpolate camera to offset position
    // ... (cubic bezier or catmull-rom for smooth path)

    return false;
  }
}
```

**Scene transition (space to interior):**

If on-foot exploration exists, the transition from space to interior is a scene swap:

1. Fade to black (or a retro "DOCKING COMPLETE" screen).
2. Swap the scene: hide space objects, load interior objects.
3. Switch camera to first-person.
4. Fade in.

This is simpler than trying to have space and interior in the same scene. Three.js supports multiple scenes — render the active one.

Alternatively, use the Game Bible's planned Navigation Computer as the docking interface: the CRT screen shows "DOCKING IN PROGRESS" with retro graphics, then "DOCKED" with a station menu. No 3D interior needed for MVP.

### Assessment

| Criteria | Rating |
|----------|--------|
| **Fit for Well Dipper** | Good — but only after stations/structures exist in the world |
| **MVP version** | Auto-dock cutscene + station menu (no 3D interior). Text-based station interaction. |
| **Complexity** | Medium — camera animation is straightforward, but station generation is a separate project |
| **Estimated effort** | 3-4 days for docking sequence + menu, but stations themselves are a prerequisite |
| **Dependencies** | Ship movement, station generation (not yet built), possibly inventory/trading |

---

## 5. Inventory & Trading

### What Makes Sense for a Meditative Exploration Game?

Heavy inventory management (Diablo grids, Resident Evil tetris) would kill the vibe. But a lightweight system where you collect things and they mean something? That can enhance exploration.

**Reference games:**
- **Outer Wilds:** No inventory at all. Pure knowledge progression. You're collecting understanding, not items.
- **Subnautica:** Moderate inventory. Resources for crafting. Necessary for survival but not the focus.
- **No Man's Sky:** Heavy inventory. Lots of resources, crafting, refining. Often criticized as tedious.
- **FTL:** Light inventory. A few weapons, augments, crew. Simple and meaningful — every item matters.

**Recommendation: Ultra-light inventory, or none at all.**

For Well Dipper, the most fitting approach is one of these:

**Option A: No inventory (Outer Wilds model)**
- Progress through discovery alone.
- Ship upgrades are earned through milestones, not resource gathering.
- Simplest to implement. Purest exploration experience.

**Option B: Collectible samples (curated inventory)**
- When you deep-scan a planet, you get a "sample" (data entry, not a physical item).
- Samples are organized in a codex/journal.
- No weight limits, no juggling. Just a record of what you've found.
- Ship upgrades could require certain samples ("Scan 5 gas giants to unlock long-range scanner").

**Option C: Light trading (FTL model)**
- Small cargo hold (5-10 slots).
- Pick up resources from asteroids or planet scans.
- Trade at stations for ship upgrades or fuel.
- Keep it simple: buy low, sell high based on system economy type.
- Risk: trading loops can become the game instead of exploration.

### If Trading Is Implemented

**Simple economy model:**

```javascript
const GOODS = {
  minerals:   { basePrice: 10, category: 'raw' },
  ice:        { basePrice: 8,  category: 'raw' },
  fuel:       { basePrice: 25, category: 'refined' },
  electronics:{ basePrice: 50, category: 'manufactured' },
  artifacts:  { basePrice: 200,category: 'rare' },
};

// Station prices vary by star type / economy
function stationPrice(good, stationType) {
  const modifier = ECONOMY_MODIFIERS[stationType][good.category];
  return Math.round(good.basePrice * modifier * (0.8 + Math.random() * 0.4));
}
```

**Retro UI for inventory:**

A simple list-based display fits the CRT aesthetic better than a grid. Think: green text on black background, monospaced font.

```
╔══════════════════════════╗
║  CARGO MANIFEST          ║
║  ────────────────────    ║
║  Minerals ........ x12   ║
║  Ice ............. x5    ║
║  Artifacts ....... x1    ║
║  ────────────────────    ║
║  Capacity: 18/25         ║
╚══════════════════════════╝
```

### Assessment

| Criteria | Rating |
|----------|--------|
| **Fit for Well Dipper** | Optional — exploration works without it. Option B (samples/codex) fits best. |
| **MVP version** | Option B: scan data auto-collected into a codex. No physical inventory. |
| **Complexity** | Low for codex, Medium for trading, High for full economy |
| **Estimated effort** | 1 day for codex, 3-4 days for trading system, 5+ days for economy balancing |
| **Dependencies** | Scanning (for codex), docking/stations (for trading), save system |

---

## 6. NPC Interaction

### How to Make the Universe Feel Alive

Right now Well Dipper's universe is beautiful but empty. Adding NPCs (even very simple ones) dramatically changes the feel. A single ship flying past you in deep space makes the universe feel inhabited.

Well Dipper already has a ship pipeline planned (6 archetypes in the Game Bible) and a ShipManager design with states (CRUISING, APPROACH, ESCORT, DEPART). This is a great foundation.

### Encounter Types

**Passive encounters (easiest, highest impact):**
- Ships flying on set routes between planets.
- A freighter convoy passing through the system.
- A fighter patrol near a civilized planet.
- No interaction needed — just seeing them is enough.
- Impact: massive. A single NPC ship transforms an empty system into a living one.

**Hailing / communication (medium):**
- Target a ship, press a key to hail.
- Text-based dialogue appears on the CRT display.
- Simple responses: "Welcome, traveler" / "Move along" / "Need assistance?"
- Faction-colored text (green = friendly, yellow = neutral, red = hostile).

**Dialogue system (for stations/NPCs):**

For retro aesthetic, text-based dialogue is perfect. Think classic RPGs, Starflight, or the original Elite.

```
╔══════════════════════════════════╗
║  COMM CHANNEL — TRADER VESSEL    ║
║  ────────────────────────────    ║
║  "Greetings, explorer. I have   ║
║   surplus fuel cells if you're   ║
║   looking to trade."             ║
║                                  ║
║  [1] Trade                       ║
║  [2] Ask about this system       ║
║  [3] End transmission            ║
╚══════════════════════════════════╝
```

Implementation: HTML overlay with retro font. Dialogue trees stored as JSON data. No voice acting needed — text fits the aesthetic perfectly.

### Faction System

Keep it simple. Three tiers:

| Faction | Attitude | Behavior |
|---------|----------|----------|
| **Friendly** | Green brackets | Approach, offer trade/info, escort |
| **Neutral** | Yellow brackets | Ignore you, respond if hailed |
| **Hostile** | Red brackets | Avoid or attack (if combat exists) |

Faction can be derived from system data:
- Civilized planets = friendly ships in system.
- Empty systems = occasional neutral traders/explorers.
- Near exotic/machine planets = hostile (alien) ships (very rare).

No need for a reputation system in MVP. Faction is property of the NPC, not a player stat.

### Assessment

| Criteria | Rating |
|----------|--------|
| **Fit for Well Dipper** | Good — passive encounters add life without breaking meditation. Active dialogue is optional. |
| **MVP version** | Passive NPC ships on routes (no interaction). The ShipManager design in the Game Bible covers this. |
| **Complexity** | Low for passive ships, Medium for hailing/dialogue, High for faction reputation |
| **Estimated effort** | 2-3 days for passive ships (with existing ship pipeline), +3-4 days for dialogue system |
| **Dependencies** | Ship models (.glb assets), ship movement system for NPC pathfinding |

---

## 7. Progression Systems

### What Keeps Players Coming Back?

Exploration games have a unique challenge: if the universe is infinite and procedural, what motivates continued play? There's no "ending" to reach.

**What works in exploration games:**

1. **Completionism / Collection.** "I've seen 7 of 11 planet types." Humans love filling in checklists. Well Dipper has 11 planet types, exotic types, megastructures — that's a built-in checklist.

2. **First discovery.** Elite Dangerous tags your commander name on first discoveries. Even in a game with millions of players, finding something no one else has seen feels amazing. In a single-player game, every discovery is "first."

3. **Ship upgrades that expand capability.** Longer warp range = access to more systems. Better scanner = more information per scan. Bigger cargo = more trading options. Each upgrade opens new gameplay.

4. **Rarity chasing.** Well Dipper already has this built into its generation. Terrestrial planets are ~3% of systems. Exotics are 0.5%. Megastructures will be even rarer. Players will warp hundreds of times to find an ecumenopolis.

5. **Milestone rewards.** "You've warped 100 times" → unlock a new ship paint job. "You've found all planet types" → unlock a special scanner mode.

### Proposed Progression for Well Dipper

**Discovery Codex (core progression):**

A persistent record of everything you've found. This is the beating heart of progression.

```
╔══════════════════════════════════╗
║  DISCOVERY CODEX                 ║
║  ────────────────────────────    ║
║  Planet Types:  8 / 11  [▓▓▓▓▓▓▓▓░░░]  ║
║  Star Types:   5 / 7   [▓▓▓▓▓░░]       ║
║  Exotics:      1 / 6   [▓░░░░░]        ║
║  Deep Sky:     3 / 6   [▓▓▓░░░]        ║
║  Systems:      47                ║
║  Warps:        52                ║
║                                  ║
║  RAREST FIND: Ecumenopolis       ║
║  (System: Keth-447, Warp #31)    ║
╚══════════════════════════════════╝
```

This is cheap to implement and extremely motivating. Every warp has a chance to add to the codex.

**Ship Upgrades (tied to milestones, not grinding):**

| Upgrade | Unlocked By | Effect |
|---------|-------------|--------|
| Scanner Mk.II | Scan 20 bodies | Passive scan shows more info |
| Scanner Mk.III | Find all natural planet types | Deep scan reveals lore/history |
| Warp Range+ | Warp 50 times | Can target more distant stars |
| Zoom Lens | Find an exotic | See more detail at distance |
| Auto-pilot+ | Visit 3 deep sky objects | Autopilot visits points of interest |

Milestone-based progression means you don't grind for resources — you progress by doing what the game wants you to do: explore.

**Ship Types (cosmetic + minor stat differences):**

| Ship | Unlock | Flavor |
|------|--------|--------|
| **Scout** | Default | Balanced |
| **Explorer** | 100 warps | Better scanner, slower |
| **Courier** | Find a civilized planet | Faster, less cargo |
| **Surveyor** | Scan 50 bodies | Best scanner, slowest |
| **Pioneer** | Find all exotics | Longest warp range |

Ships are cosmetic differentiators with slight stat tweaks, not dramatically different playstyles. This avoids balance problems.

### Assessment

| Criteria | Rating |
|----------|--------|
| **Fit for Well Dipper** | Excellent — the procedural generation already creates natural rarity tiers |
| **MVP version** | Discovery codex (planet types seen, warp count, rarest find). Just a persistent checklist. |
| **Complexity** | Low for codex, Medium for upgrades, Medium for ship unlocks |
| **Estimated effort** | 1-2 days for codex, +2-3 days for milestone system, +2 days for ship unlocks |
| **Dependencies** | Save system (must persist progress), scanning (feeds the codex) |

---

## 8. Save System

### Browser Storage Options

**localStorage:**
- Simple key-value store.
- Synchronous (blocks the main thread, but fast for small data).
- ~5-10 MB limit per origin.
- Data persists until explicitly cleared.
- Perfect for: player state, settings, discovery log.
- Limitation: serializes everything as strings (JSON.stringify/parse).

**IndexedDB:**
- Structured database with indexes and queries.
- Asynchronous (non-blocking).
- ~1 GB+ capacity.
- Perfect for: large datasets, screenshots, detailed exploration history.
- More complex API (or use a wrapper like `idb`).

**Recommendation: localStorage for MVP, IndexedDB if data grows.**

Well Dipper's save data will be small — player state, codex, settings. localStorage handles this easily. Move to IndexedDB only if you start storing things like system screenshots or detailed exploration history.

### What Needs to Be Saved?

**Procedural games have an advantage: you don't need to save the world, just the seed + what the player has done.**

The universe is deterministic from the seed. Any system can be regenerated. You only need to save:

```javascript
const saveData = {
  version: 1,                    // for migration if format changes
  timestamp: Date.now(),

  // Player position
  currentSeed: 'keth-447',       // which system you're in
  shipPosition: [x, y, z],      // where in the system
  shipRotation: [x, y, z, w],   // quaternion

  // Discovery
  codex: {
    planetTypesSeen: ['rocky', 'gas-giant', 'terrestrial', ...],
    starTypesSeen: ['G', 'M', 'K', ...],
    exoticsSeen: ['fungal'],
    deepSkySeen: ['spiral-galaxy'],
    totalWarps: 52,
    totalScans: 147,
    systemsVisited: ['seed1', 'seed2', ...], // or just a count
    rarestFind: { type: 'ecumenopolis', seed: 'keth-447', warp: 31 },
  },

  // Ship state
  ship: {
    type: 'scout',
    upgrades: ['scanner-mk2', 'warp-range-plus'],
  },

  // Inventory (if applicable)
  cargo: [
    { item: 'minerals', quantity: 12 },
  ],

  // Settings (already saved separately)
  // settings: { ... }
};
```

### Implementation

```javascript
class SaveManager {
  constructor(key = 'well-dipper-save') {
    this.key = key;
  }

  save(data) {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(this.key, json);
      return true;
    } catch (e) {
      console.warn('Save failed:', e);
      return false;
    }
  }

  load() {
    try {
      const json = localStorage.getItem(this.key);
      if (!json) return null;
      const data = JSON.parse(json);
      return this._migrate(data); // handle version changes
    } catch (e) {
      console.warn('Load failed:', e);
      return null;
    }
  }

  _migrate(data) {
    // Handle save format changes between versions
    if (!data.version) data.version = 1;
    // if (data.version === 1) { migrate to v2; data.version = 2; }
    return data;
  }

  // Auto-save on warp, scan completion, docking, or timer
  startAutoSave(getState, intervalMs = 60000) {
    setInterval(() => this.save(getState()), intervalMs);
  }

  // Export save as JSON for sharing/backup
  exportSave() {
    return localStorage.getItem(this.key);
  }

  importSave(json) {
    const data = JSON.parse(json); // will throw if invalid
    this.save(data);
  }
}
```

**When to save:**
- On every warp (system transition).
- On scan completion (discovery).
- On settings change.
- Periodic auto-save (every 60 seconds).
- On page unload (`beforeunload` event).

**Seed-based save sharing:**
A cool feature: export your save seed + codex state. Someone else can import it to visit the same systems you've been to. Or just share a system seed: "Visit system `keth-447` — there's a terrestrial planet with city lights!"

### Assessment

| Criteria | Rating |
|----------|--------|
| **Fit for Well Dipper** | Essential — without saves, all exploration is lost on page close |
| **MVP version** | localStorage with current seed + codex (planet types seen, warp count) |
| **Complexity** | Low — localStorage is dead simple. Migration logic is the only tricky part. |
| **Estimated effort** | 1 day for basic save/load, +0.5 day for auto-save and page-unload handling |
| **Dependencies** | None — can be built first and everything else hooks into it |

---

## 9. System Dependency Map

Which systems depend on which? This determines build order.

```
Save System ─────────────────────────────────┐
  (no dependencies, everything needs it)      │
                                              │
Ship Movement ───────────────────────────┐    │
  (foundation for everything else)       │    │
                                         │    │
Scanning & Discovery ←── Ship Movement   │    │
  (need to point at things)         ←── Save System
                                         │    │
Progression / Codex ←── Scanning         │    │
  (codex tracks scan results)       ←── Save System
                                         │    │
NPC Ships (passive) ←── Ship Movement    │    │
  (need ship pipeline + pathing)         │    │
                                         │    │
NPC Dialogue ←── NPC Ships               │    │
  (need NPCs before you can talk to them)│    │
                                         │    │
Docking ←── Ship Movement + Stations     │    │
  (need to fly + need something to dock with) │
                                         │    │
Trading ←── Docking + Inventory          │    │
  (need stations + cargo system)         │    │
                                         │    │
Combat ←── Ship Movement + AI + Weapons  │    │
  (most dependencies, least fit)         │    │
```

---

## 10. Recommended Build Order

Based on dependencies, fit for the meditative vibe, and impact-per-effort:

### Phase A: Foundation (do first)
1. **Save System** — 1 day. Everything else needs persistence.
2. **Ship Movement** — 3 days. Hybrid flight model + chase cam. The transition from screensaver to game.

### Phase B: Core Game Loop (the "you're playing a game now" moment)
3. **Scanning & Discovery** — 3 days. This is what makes it a game. Point at things, learn about them.
4. **Discovery Codex** — 1 day. Track what you've found. The progression hook.
5. **Progression Milestones** — 2 days. Unlock upgrades by exploring. Rewards the loop.

### Phase C: Living Universe
6. **Passive NPC Ships** — 3 days. Ships flying through systems. No interaction, just presence.
7. **NPC Hailing / Dialogue** — 3 days. Text-based communication. Retro CRT aesthetic.

### Phase D: Destinations
8. **Station Generation** — 4 days. Create dockable structures in systems.
9. **Docking Sequence** — 3 days. Auto-dock with cinematic approach.
10. **Station Menu / Interior** — 3 days. What happens when you dock.

### Phase E: Economy (optional)
11. **Light Trading** — 3 days. Only if it serves exploration, not as its own loop.
12. **Ship Types** — 2 days. Cosmetic + minor stat differences.

### Probably Never
13. **Combat** — Skip unless the game's identity changes. Environmental hazards serve the same narrative purpose without the complexity.

---

## Sources

### Flight Models & Movement
- [Three.js ObjectControls (6DOF)](https://github.com/squarefeet/THREE.ObjectControls)
- [Simplified Flight Model (Three.js Forum)](https://discourse.threejs.org/t/simplified-flight-model/15058)
- [Modeling Newtonian Physics in Space](https://jmpdrv.com/2015/04/10/modeling-newtonian-physics-in-space/)
- [Space Flight Models (GameDev.net)](https://www.gamedev.net/forums/topic/483515-space-flight-models/)
- [Newtonian Flight (Giant Bomb)](https://www.giantbomb.com/newtonian-flight/3015-8649/games/)
- [Outer Wilds Ship Wiki](https://outerwilds.fandom.com/wiki/Spaceship)

### Camera Systems
- [Chase Camera Demo (Three.js)](https://stemkoski.github.io/Three.js/Chase-Camera.html)
- [THREE.TargetCamera](https://github.com/squarefeet/THREE.TargetCamera)
- [Follow Cam Tutorial (sbcode.net)](https://sbcode.net/threejs/follow-cam/)
- [Smooth Chase Camera (Three.js Forum)](https://discourse.threejs.org/t/solved-smooth-chase-camera-for-an-object/3216)

### Combat & AI
- [Spaceship Combat AI (GameDev.net)](https://www.gamedev.net/forums/topic/677818-advice-on-spaceship-combat-ai-3d/)
- [FSM for Enemy AI (LinkedIn)](https://www.linkedin.com/advice/3/how-do-you-use-finite-state-machines-game-ai-programming)
- [Colony Wars (Wikipedia)](https://en.wikipedia.org/wiki/Colony_Wars)

### Scanning & Discovery
- [Elite Dangerous Exploration Loop (Frontier Forums)](https://forums.frontier.co.uk/threads/exploration-action-reward-loop.513806/)
- [Exploration Ship Builds (Elite Dangerous)](https://steamsolo.com/guide/exploration-ship-builds-progression-elite-dangerous/)

### Docking
- [Docking (Elite Wiki)](https://wiki.alioth.net/index.php/Docking)
- [SpaceX ISS Docking Simulator](https://iss-sim.spacex.com/)

### Save Systems
- [Browser Storage for Games (W3C)](https://w3c.github.io/web-roadmaps/games/storage.html)
- [localStorage Guide (Meticulous)](https://www.meticulous.ai/blog/localstorage-complete-guide)
- [Saving Game State with localStorage](https://liza.io/saving-game-state-with-html5-localstorage-and-json-a-rough-working-draft/)

### Exploration Design
- [Outer Wilds, Subnautica & Existential Dread (Film Crit Hulk)](https://www.patreon.com/posts/outer-wilds-of-54284948)
- [Open-World Games Without Violence (Game Rant)](https://gamerant.com/best-open-world-games-dont-focus-on-violence/)

### Camera Animation
- [Animating Camera in Three.js (DEV)](https://dev.to/pahund/animating-camera-movement-in-three-js-17e9)
- [Three.js Raycaster Docs](https://threejs.org/docs/pages/Raycaster.html)

### Trading & Inventory
- [Inventory UI Design for Indie Games (Zalance)](https://zalance.net/articles/inventory-ui-design-for-indie-games/)
- [Starflight (Wikipedia)](https://en.wikipedia.org/wiki/Starflight)

### NPC & Faction Systems
- [Star Citizen Reputation Guide](https://space-vendor.com/blogs/insight/star-citizen-reputation-system-guide-factions-missions-and-rewards)

---

*Research compiled: 2026-03-14*
*For Well Dipper — a meditative retro space screensaver becoming a game.*
