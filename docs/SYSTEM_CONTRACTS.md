# Well Dipper — System Contracts

How the systems work together. Every feature, review, and code change must respect these contracts.

---

## The Big Picture

Well Dipper is a procedural space screensaver and exploration game. One simulation — the galactic generation pipeline — creates everything the player sees and interacts with. The rendering pipeline visualizes it. The gameplay systems let the player explore it.

```
GALACTIC GENERATION PIPELINE
  GalacticMap (density model: arms, bar, disk, bulge, halo)
    → HashGridStarfield (deterministic stars at every galactic position)
      → StarSystemGenerator (planets, moons, rings from star seed + local context)
        → Renderers visualize everything
        → Nav computer queries the same data
        → Autopilot tours what was generated
        → Player explores what was generated
```

**The simulation is the source of truth.** If it's visible, it was generated. If it wasn't generated, it's not visible.

---

## 1. The Galaxy

`GalacticMap` defines the Milky Way: spiral arm geometry, stellar density at every point, metallicity gradients, star type distributions. It uses the same density function for everything — star generation, sky glow rendering, and nav computer sector visualization all query the same model.

`HashGridStarfield` turns the density model into discrete stars. Given any galactic coordinate, it deterministically produces stars with positions, spectral types, and seeds. The same coordinate always produces the same stars. Every star the player can see or visit exists in this grid.

`RealStarCatalog` and `RealFeatureCatalog` overlay real astronomical data (15,599 named stars, 152 globular clusters) onto the procedural model at their correct galactic positions.

**Key principle:** There is one galaxy. It's the same whether you're looking at the sky, browsing the nav computer, or warping to a new system. All views query the same underlying model.

---

## 2. Star Systems

When the player arrives at a star (via warp or the first system), `StarSystemGenerator` creates the full system from the star's seed and its galactic context (metallicity, age, density). This produces: star properties, binary companion (35% chance), planets with types/sizes/orbits, moons, rings, asteroid belts.

`KnownSystems` (Sol) overrides the generator at specific galactic positions with handcrafted data. Sol is at the correct coordinates in the galaxy model — it's a pipeline override, not a bypass.

The generated system data flows everywhere:
- **Rendering:** Planet.js, Moon.js, StarFlare.js, OrbitLine.js visualize it
- **Autopilot:** AutoNavigator builds a tour queue from it (star → planets → moons)
- **Nav computer:** Displays it in the system view, enables COMMIT BURN
- **HUD:** BodyInfo shows stats for the focused body
- **Minimap:** SystemMap renders a top-down view of it
- **Gravity wells:** GravityWell visualizes orbital mechanics from it

---

## 3. The Sky

`SkyRenderer` coordinates three layers that all derive from the galaxy model:

- **ProceduralGlowLayer:** Ray-marches through GalacticMap's density function in real-time. The Milky Way band, spiral arms, dust lanes — all computed from the same model that generates stars.
- **StarfieldLayer:** Renders the HashGridStarfield output as point sprites. Every dot is a real hash grid star at its correct position.
- **SkyFeatureLayer:** Renders nearby nebulae and clusters from GalacticMap features and RealFeatureCatalog as absorption/emission meshes in the sky.

The sky changes as the player moves through the galaxy. Warp to a different arm, and the sky structure shifts because the density model produces different results from that position.

---

## 4. Warp Destinations

Every warp must resolve to a real position in the galaxy:

- **Player clicks a star in the sky:** Resolves to the hash grid entry at that point.
- **Player selects a star in the nav computer:** Resolves to the hash grid entry the nav queried.
- **Autopilot picks the next system:** Selects a random visible hash grid star.
- **DestinationPicker rolls a category:** If it rolls "nebula" or "cluster," it searches for a real GalacticMap feature nearby and warps to the hash grid star at that position. If no feature is found, it falls back to a normal star system. It never fabricates a destination.

**One exception:** External galaxies (Andromeda, Magellanic Clouds) visible in the sky. The player can warp to these as an Easter egg. They're rendered by `GalaxyGenerator` since they're outside the Milky Way model by definition. A "you've strayed too far" message should appear.

**Safety net:** `beginWarpTurn()` always verifies a real target exists. If not, it calls `autoSelectWarpTarget()` to pick a hash grid star. If that also fails, the warp aborts rather than generating from thin air.

---

## 5. Camera and Control

The camera has **two modes** (Toy Box / Flight) that are orthogonal to the **drive states** (Manual / Autopilot / Warp). Mode = how the camera feels. Drive state = who is writing to it this frame.

### 5.1 Camera Modes

| Mode | What drives the camera | Intended feel |
|------|------------------------|---------------|
| **TOY_BOX** | `ShipCameraSystem._applyOrbit()` — yaw/pitch/distance around a focus point | Spin a body around like a model in your hands. Default for screensaver MVP. |
| **FLIGHT** | `FlightDynamics` drives ship position, `CinematicDirector` composes framing, player adds a decaying look offset | Piloting a ship through a gravity field. Director picks the shot, player nudges it. |

`ShipCameraSystem.cameraMode` is the single source of truth. `setCameraMode(mode)` handles smooth handoff — it snapshots the world position/quaternion, switches the path, and re-derives the target mode's state so the visual is continuous.

**Mode invariants:**
- TOY_BOX is the default at boot.
- FLIGHT requires a gravity field. `clearGravity()` forces mode back to TOY_BOX.
- Deep sky scenes (no star system) are TOY_BOX only — F key is ignored there.
- Mobile devices are TOY_BOX only — F key is not bound.
- In TOY_BOX, `flight` and `director` do not tick (CPU savings, no state drift).
- Mode persists across warps and system loads. Only `setCameraMode` (F key, or localStorage on boot) changes it.

### 5.2 Input Routing

|                     | TOY_BOX                           | FLIGHT                                             |
|---------------------|-----------------------------------|----------------------------------------------------|
| Mouse drag (left)   | Rotate orbit (`yaw`, `pitch`)     | Add decaying look offset (±90° yaw / ±60° pitch)   |
| Scroll wheel        | Zoom (`distance`)                 | Change chase distance (director offset length)     |
| WASD                | Ignored                           | Thrust the ship via `flight.thrustVector`          |
| Free-look (middle)  | Available                         | Unavailable (director owns orientation)            |
| Click body          | Focus and orbit it                | Focus it; camera follows ship through approach     |

**Look offset decay (FLIGHT only):** When the player stops dragging, `_lookOffsetYaw/Pitch` exponentially decay to zero over ~2s (`offset *= exp(-dt / 2.0)` each frame, snap to 0 under 0.001 rad). Applied *after* the director writes its transform — rotates the look vector around the current camera position. Director remains unaware of player input; contract clean.

### 5.3 Drive States

The drive state determines who owns the camera *this frame*:

| Drive State | What writes the camera |
|-------------|------------------------|
| **Manual**  | `ShipCameraSystem.update()` (respects mode) |
| **Autopilot** | `FlythroughCamera` takes over during system tours and BURN arrivals |
| **Warp**    | `WarpEffect` drives the camera through the turn + tunnel sequence |

**Manual → Autopilot:** idle timer expires (30s default) or player presses the autopilot key.
**Autopilot → Manual:** depends on mode. In TOY_BOX, any mouse/scroll/WASD input stops autopilot. In FLIGHT, only WASD thrust or explicit autopilot-off kills it — mouse drag just layers a look offset on top of the flythrough.
**Any → Warp:** Space key, COMMIT WARP, or autopilot tour completion.
**Warp → Autopilot:** warp exit completes, new system loaded, tour begins.

Mode is preserved across all drive-state transitions (including warp in/out).

**COMMIT BURN** (fly to a body in the current system) uses FlythroughCamera for smooth cinematic travel, then hands back to manual on arrival. It calls the same `focusPlanet()`/`focusStar()`/`focusMoon()` functions as the Tab/1-9 keyboard shortcuts. Arrival mode matches the player's current mode.

### 5.4 In-System Targeting and Selection

Selecting a body inside a system is **decoupled from travel**. Click ≠ go.
This matches Elite Dangerous and gives the player a moment to confirm intent
before committing to a burn.

**Selection has three states:**

| State       | What it means                              | Visual                                                  |
|-------------|--------------------------------------------|---------------------------------------------------------|
| None        | Nothing under the mouse, nothing committed | No reticle drawn                                        |
| Tentative   | Mouse hover over a clickable body          | Dim, semi-transparent green corner brackets + name      |
| Selected    | Player clicked a body — soft-locked        | Bright opaque green brackets + info block + BURN button |

**Click pipeline (`pointerdown` → `pointerup` in `main.js`):**

1. `hitTestBodies(clientX, clientY)` projects every star/planet/moon in the
   current system to screen-space and picks the closest body within an adaptive
   threshold (`max(24px, projectedRadius + 12px)`). When two bodies are within
   3 px of each other, the larger kind wins (star > planet > moon).
2. If hit found → `selectTarget(target)`. The camera's orbit target transitions
   to the body, the BURN button appears in the HUD, the reticle goes Selected.
   No travel yet.
3. If no in-system hit, fall through to `trySelectWarpTarget` (sky stars). The
   in-system path always runs first, so an in-system body shadows a behind-it
   star.

**Commit pipeline (BURN button or Space key):**

- `commitSelection()` is the universal commit entry point.
- If an in-system body is soft-selected → `commitBurn()` → routes to
  `focusPlanet/Star/Moon`, which kicks off `flythrough.beginTravelFrom`. This
  is the moment the cinematic burn animation starts.
- Else if a sky warp target is set → `beginWarpTurn()`.
- Else → no-op.

The Space key is bound to `commitSelection()` (replacing the older
"Space always warps" binding). This unifies all "go to thing" intent under
one keystroke regardless of whether the target is in-system or out-of-system.

**The reticle is a pure view.** `src/ui/TargetingReticle.js` draws what main.js
tells it to draw. It doesn't know about input, hit testing, or the burn
state — main.js owns `_hoverTarget` and `_selectedTarget` and calls
`reticle.update({ hoverTarget, selectedTarget })` once per frame. This keeps
the reticle's contract trivial: project two world positions to screen space,
draw brackets and an info block.

**Stale-target invariants:**
- `warpSwapSystem` clears `_hoverTarget` and `_selectedTarget` so meshes from
  the disposed system can never leak into the new system's reticle draw.
- The hit test uses live `mesh.position`, not cached values, so bodies that
  orbit during a paused or stalled frame don't desync.

---

## 6. Nav Computer

The nav computer is a 5-level zoom interface into the galaxy model:

| Level | View | Data Source |
|-------|------|-------------|
| 0 | Galaxy | GalacticMap density rendering |
| 1 | Sector | GalacticMap sector grid |
| 2 | Region | GalacticMap tile subdivision |
| 3 | Column | HashGridStarfield.findStarsInColumn() — real stars in 3D |
| 4 | System | StarSystemGenerator from star seed (or actual spawned data for current system) |

**The nav computer is scene-agnostic.** It knows galactic coordinates, star seeds, planet indices. It does NOT know about Three.js meshes, cameras, or scene state. It communicates with the game through an action contract:

```
NavAction: { type: 'burn' | 'warp', target, starIndex, planetIndex, moonIndex, star }
```

The nav computer builds the action. main.js dispatches it. Clean boundary.

---

## 7. Audio

Sound effects are sample-based (extracted from the game's music tracks for a unified sonic palette). Music plays during the title screen (intro + looping title theme). Gameplay music tracks are not yet produced.

The audio system responds to game state — warp charge/enter/exit SFX, autopilot on/off, body selection, nav computer drill sounds pitched by zoom level. It does not generate spatial content.

---

## 8. The Screensaver Loop

The infinite screensaver mode that runs when the player isn't interacting:

```
Title Screen (nebula backdrop + music)
  → Auto-dismiss after N loops of title theme
    → First warp (autoSelectWarpTarget picks a real hash grid star)
      → System tour (AutoNavigator visits star → planets → moons)
        → Tour complete → autoSelectWarpTarget → warp to next system
          → Repeat forever
```

At any point, the player can take control. When they go idle again, the loop resumes from wherever they are.

---

## 9. Warp

Warp is the only drive state that teleports the camera across thousands of scene units mid-sequence. That teleport is the contract's center of gravity — every invariant below exists because something in the pipeline assumes the camera is where it was last frame, and warp is the one place that assumption breaks.

Target resolution is §4. UX and phase feel are `docs/FEATURES/warp.md`. This section is invariants only.

### 9.1 Phase state machine

Warp runs a fixed ordered sequence. No phase is skipped, no phase repeats:

```
FOLD → ENTER → HYPER → EXIT
```

- **FOLD** — portal opens ~500m ahead of the camera in origin-system world space. Portal A is anchored in the origin system's scene graph.
- **ENTER** — camera accelerates through Portal A's threshold. The INSIDE traversal event fires when the camera crosses the portal plane.
- **HYPER** — camera traverses the tunnel interior. The system swap happens during this phase.
- **EXIT** — camera emerges through Portal B in the destination system; warp drive state hands back to Autopilot or Manual.

### 9.2 Callback contract

`WarpEffect` exposes three callbacks that `main.js` wires up. Each owns a specific concern:

| Callback | Phase | Owns |
|----------|-------|------|
| `onPrepareSystem` | FOLD | Kick off destination-system generation; cache the in-flight promise in `pendingSystemDataPromise`. Non-blocking. |
| `onSwapSystem` | HYPER (inside-traversal) | `await pendingSystemDataPromise`, then call `warpSwapSystem(destSystem)` which disposes the origin scene, spawns the destination, and **teleports the camera** to post-swap coordinates. Async. |
| `onTraversal('INSIDE' \| 'OUTSIDE')` | HYPER | Fire once when the camera crosses Portal A's plane (INSIDE) or Portal B's plane (OUTSIDE). Drives the scene swap and the Portal A re-anchor. |

### 9.3 Async-ordering invariant (load-bearing)

**Portal A must not be re-anchored until `onSwapSystem` has resolved and the camera has been teleported to post-swap coordinates.**

`onTraversal` is `async`. On `mode === 'INSIDE'` it **must `await warpEffect.onSwapSystem()` before re-anchoring Portal A**. `onSwapSystem` internally awaits `warpSwapSystem(destSystem)` in `main.js`, which calls `camera.position.set(...)` to teleport the camera into the destination system's coordinate frame. Only after that resolves can Portal A be re-anchored against the camera's new world position.

Any future edit that converts `onTraversal` back to synchronous fire-and-forget, or that re-anchors Portal A before the teleport resolves, is a contract violation. The failure mode is concrete: the tunnel mesh orphans at pre-teleport coordinates while the camera sits thousands of scene units away in post-swap space, and HYPER renders ~40 black frames (measured: 10,499 scene units offset vs 200-unit tunnel length).

See `src/main.js:447` for the canonical `async onTraversal` + `await onSwapSystem` wiring. Three prior sessions patched this same orphan-bug shape before the invariant was named; do not regress it. (Commit `10642b2`, 2026-04-18.)

### 9.4 Portal scene-anchoring

Two portals exist; they live in different scene graphs at different phases:

- **Portal A** (origin-side) — anchored in the origin system's scene graph during FOLD and ENTER. On INSIDE traversal, after the async swap resolves, Portal A is re-anchored at the post-teleport camera position in the destination scene graph for the remainder of HYPER.
- **Portal B** (destination-side) — anchored in the destination system's scene graph. Positioned `tunnelLength` ahead of the post-swap camera along the arrival forward direction. Camera exits through Portal B during EXIT.

Portal B's world position is held in a **fixed arrival-forward direction** captured at warp `onComplete`, not "behind whatever the camera is currently facing" — the player can rotate freely during HYPER/EXIT without dragging Portal B around the sky.

**Floating-point precision note:** Portal B exhibits FP drift at large destination-system coordinates. The fix is blocked on world-origin rebasing; see `docs/PLAN_world-origin-rebasing.md`. Do not attempt a local patch — the precision limit is structural.

### 9.5 Non-Euclidean tunnel visibility

Per `docs/FEATURES/warp.md`: the tunnel is a 2D hole into a 3D tunnel. The tunnel exists only through its portal opening. It is **not** an object observable from the side.

Any rendering path that allows the tunnel mesh to be seen from outside the portal volume is a contract violation. Stencil-masked portal rendering, render-to-texture, or fullscreen screen-space composition (during HYPER when the portal fills the view) are the compatible approaches. A future feature that attaches the tunnel to the world as a visible 3D cylinder is wrong by spec, not by taste.

### 9.6 Uniform-input parity invariant

`starfield-cylinder-lab.html` is the canonical visual reference for the HYPER tunnel. If a change to the shader, the uniform surface, or the pipeline feeding the uniforms causes the production HYPER tunnel to visibly diverge from the lab rendering the same inputs, that is a regression — not a tuning choice. The lab↔prod comparison at matched seeds, matched camera-to-wall distance, and matched scroll phase is the ground-truth check. "Looks fine in production" does not close the check.

The uniform surface is the declared contract: `uScroll`, `uHashSeed`, `uDestHashSeed`, plus the tunnel mesh's geometry parameters. Adding brightness multipliers, exposure knobs, or `uDimnessCompensator`-style hacks to paper over a divergence is a Principle 2 tack-on and a Principle 6 patch — find the actually-divergent input instead.

---

## 10. Autopilot

Autopilot is the game's cinematic tour mode: the drive state that writes to the camera during system tours. Feel, phases, and felt-experience criteria are `docs/FEATURES/autopilot.md`. This section is invariants only — the structural rules the implementation cannot violate.

### 10.1 Two-axis state machine

Autopilot's state is two orthogonal axes. The state machine that today lives in `src/auto/FlythroughCamera.js` (`State = { DESCEND, ORBIT, TRAVEL, APPROACH }`) is retired by the autopilot feature and replaced by this structure.

**Ship axis** (4 phases — what the ship is doing):

```
ENTRY → CRUISE → APPROACH → STATION
```

- `ENTRY` — arrival along the warp-exit vector. Replaces `DESCEND`.
- `CRUISE` — sustained travel between bodies.
- `APPROACH` — deceleration + attitude change as target fills frame.
- `STATION` — holding-orbit near a body. Ship remains in motion. Replaces the ship-holding half of the retired `ORBIT`.

Ship phases progress linearly per tour stop. Within a tour, the sequence is `ENTRY` once (on warp-exit), then `CRUISE → APPROACH → STATION` per body in the queue, then tour-complete → warp.

**Camera axis** (3 modes — what the player's eyes are doing):

```
ESTABLISHING | SHOWCASE | ROVING
```

- `ESTABLISHING` — wide/slow framing that follows ship phases but paces independently. V1.
- `SHOWCASE` — framed compositional beats (crescent, eclipse, ring-shadow). V-later.
- `ROVING` — player-eye freedom, 360° turn-head-toward-OOI. V-later.

Camera mode is selected per-moment, orthogonal to ship phase. Any state encoding that forces camera mode to be a function of ship phase is a contract violation.

### 10.2 `ORBIT` retirement (migration-load-bearing)

The current `FlythroughCamera.State.ORBIT` conflated two concerns: ship holding-orbit (ship axis) + camera framing (camera axis). Autopilot's feature doc retires this single state.

**Migration invariant:** any replacement code must not reintroduce a single combined state. `STATION` lives on the ship axis; `SHOWCASE` lives on the camera axis. A future refactor that folds them back together for "simplicity" forecloses `V-later` `SHOWCASE` and `ROVING` — that's a rewrite cost, not a cosmetic choice.

### 10.3 Two-layer architecture (cinematography + navigation subsystem)

Autopilot has two layers. The toggle controls one of them.

| Layer | Scope | Toggleable? |
|---|---|---|
| Cinematography | Tour orchestration — queue building, camera choreography, ship-phase selection, per-body framing composition. | Yes. This is what the autopilot toggle switches. |
| Navigation subsystem | Motion execution — accelerate from A to B, arrive in stable orbit around B, honor safe-distance rules. | **No. Always available.** |

**Invariant:** manual-mode "burn to body" uses the **same navigation subsystem** autopilot uses. Autopilot-off does not kill the navigation subsystem; it swaps the caller from cinematography-orchestrator to direct-user-command.

**Today's entanglement (2026-04-20 correction):** the two layers are tangled inside `FlythroughCamera.js`, not inside `AutoNavigator.js`. `AutoNavigator.js` is already cinematography-only (queue building, queue-index state, linger heuristics, `onTourComplete` callback — zero motion execution). `FlythroughCamera.beginDescend` / `beginOrbit` / `beginTravel` / `beginTravelFrom` / `beginApproach` co-mingle **motion execution** (position/velocity integration, Hermite curves, orbit arc math, approach close-in, descend path) with **camera state** (yaw/pitch, quaternion slerp, free-look offset, lookAt blending, FOV framing). Splitting them cleanly is a refactor requirement, not optional: motion execution lifts into a new navigation-subsystem module that produces motion plans; camera state stays in the camera module and consumes the plans. Any V1 autopilot implementation must surface the split explicitly — workstream ACs are expected to include "motion-execution remains functional with cinematography layer disabled" as a verification, and "manual-mode burn path reaches the subsystem without touching the cinematography layer" as a second.

*Earlier versions of this §10.3 named `AutoNavigator` as the monolith. That was wrong — the monolith is `FlythroughCamera`. Corrected 2026-04-20 after working-Claude's pre-execution read of the code surfaced the inversion.*

### 10.4 Drive-state transitions (extends §5.3)

Autopilot-drive-state transitions extend §5.3's table with the feature-doc toggle rules:

| Transition | Trigger |
|---|---|
| System-load → Autopilot | Default. Autopilot is **on at system-load**, not opt-in. |
| Autopilot → Manual | Player input (any of): click upper-left status indicator, press autopilot-toggle key (`Tab`, **provisional** — see §10.4.1), WASD thrust input, target-click + `commitSelection()`. |
| Manual → Autopilot | **Explicit only** — click status indicator or press toggle key (`Tab`, **provisional** — see §10.4.1). **No auto-resume from idle.** This is a change from the previous "30s idle → autopilot resumes" pattern. |
| Autopilot → Warp | Tour-complete → warp-select. See Warp §9. |
| Warp → Autopilot | Warp exit. `ENTRY` ship-axis phase. The warp-exit forward vector is the continuity anchor — see §10.5. |

**Idle-resume retired.** The "30s idle → autopilot resumes" path in today's `ShipCameraSystem` is retired by this feature. Re-engagement requires explicit input. This is a load-bearing UX decision — any reintroduction of auto-resume violates the feature's "no auto-resume after toggle-off" criterion.

### 10.4.1 Autopilot-toggle keybinding (provisional)

**Current binding:** `Tab`. **Provisional** — there is a real conflict with the existing next-planet cycler at `src/main.js:6076` / `:6120` (control docstring `src/main.js:6806`: *"Tab=next planet, 1-9=planet#"*). The Director's first candidate `P` is taken (settings-panel toggle at `src/main.js:5738`).

Max's call (2026-04-20): accept the `Tab` conflict as a temporary measure; the full keyboard-shortcut redesign is a separate tracked GTD task and is the right place to settle autopilot-toggle + next-planet cycling + any other accreted overlaps in one pass. Until the redesign lands, `Tab` = autopilot toggle and next-planet-cycling is temporarily displaced.

**Contract note:** because this binding is provisional, a future edit that *changes* `Tab`'s autopilot role is NOT a contract violation — it's the expected resolution of the redesign. What IS a contract violation: silently reintroducing idle-auto-resume (§10.4 rule) or removing the autopilot-toggle key entirely without an equivalent affordance. See `docs/FEATURES/autopilot.md` §Keybinding for the feature-side narrative.

### 10.5 Warp-exit handoff (continuity-critical)

`ENTRY` is the warp → autopilot handoff boundary. Three invariants govern it:

1. **Velocity preservation.** The camera's velocity at the end of warp `EXIT` is the starting velocity of autopilot `ENTRY`. No snap-to-zero. No pop-to-a-new-speed.
2. **Start-pose derivation.** The arrival pose is derived from the **warp-exit forward vector**, not a fixed above-the-plane origin. Today's `DESCEND` hard-codes "from above"; this is a contract violation in the new model.
3. **Cinematography handoff happens within a frame.** Warp `EXIT` and autopilot `ENTRY` are two adjacent contracts, but the visual is one motion. No black frame, no reload stutter, no pose-jump between them. This extends the warp feature's seamlessness criterion past `EXIT` into `ENTRY`.

A regression here looks like: player arrives at a new system, warp ends, ship snaps to "above the plane" and begins a fresh descend animation with its own velocity profile. This is the failure mode the rename and start-pose rule are written against.

### 10.6 HUD visibility during autopilot

- HUD hides during autopilot.
- HUD reappears on player interaction (cursor motion to an object, keyboard input, commit-selection event).
- **Exception:** the upper-left autopilot-status indicator remains visible — it's the toggle affordance.

If HUD elements need to appear during autopilot (e.g. warp-select menu after tour-complete), the feature doc §End-state describes the three valid resolutions. Any implementation that makes generic HUD visible during autopilot is a contract violation; that's a surface the feature doc explicitly hides.

### 10.7 Audio event-surface hook

Autopilot emits state-transition events on an event-surface so a future BGM layer can subscribe. **V1 ships the emitter with zero subscribers.**

**Event shape** (pending implementation review — feature-doc open question logged):

```
autopilotEvents.on('phase-change', ({ from, to, shipPhase|cameraMode }) => …)
autopilotEvents.on('camera-mode-change', ({ from, to }) => …)
autopilotEvents.on('toggle', ({ state: 'on' | 'off' }) => …)
```

Three typed events, not one event with an enum, because the three axes (ship-phase / camera-mode / toggle) are three signals a subscriber would crossfade against differently. If an implementation-time discovery argues for a single event, the Director revisits.

**Invariant:** a V1 change that adds a *subscriber* inside this codebase is scope creep. V1 emits; V-later (separate workstream) subscribes.

### 10.8 Gravity-drive shake invariant

The ship uses a gravity drive (Bible §8H). The drive maintains inertial neutrality during smooth motion; shake is the cinematic tell that the compensation envelope was exceeded.

**Invariant:** shake fires **only** when the ship motion is **genuinely abrupt** — exceeding a smoothing threshold the drive can't absorb. Shake as a frame-punch effect without an underlying abrupt motion is a contract violation. It breaks the inertial-neutrality contract and makes future abruptness-triggered shake meaningless.

**Implementation shape:** camera / ship-mesh accepts an **additive shake input**. The shake magnitude is computed from motion discontinuity, not authored per-phase-transition. Two specifics:

- **Trigger signal is the scalar speed-magnitude derivative `d|v|/dt`** — NOT vector acceleration magnitude `‖d²x/dt²‖`. Centripetal acceleration — direction change at constant `|v|` — does NOT fire shake by design. This follows from the Bible §8H ether metaphor: the shake renders friction against the medium during *speed* changes; pure direction change is the ship redirecting through the medium without changing its density relationship, so no friction pileup, no shake.
- **Magnitude envelope is a logarithmic-spaced discrete impulse train with logarithmically-decaying amplitudes** — 3–5 countable bounces per event, not continuous high-frequency noise. Accel and decel produce temporally mirrored envelopes discriminated by `sign(d|v|/dt)`: accel is crescendo-then-fade (ship pushing INTO the medium, waves building then releasing); decel is impact-then-decay (ship slamming into the wall of medium, ringout). The two shapes must be visibly distinct in playback.

V1 ships the mechanism. V1 flight is smooth enough that shake rarely fires — but the mechanism exists for manual-override hand-back (player grabs control at speed), unexpected avoidance, and warp-exit velocity mismatches.

### 10.9 OOI query interface (stub in V1, implementation V-later)

Autopilot queries `docs/OBJECTS_OF_INTEREST.md` through a lookup interface. V1 implements the interface as a stub; V-later (the OOI capture-and-exposure-system workstream) lights it up.

```
getNearbyOOIs(camera, radius) → []             // V1 returns [] (stub)
getActiveEvents(now, horizon)  → []            // V1 returns [] (stub)
```

**Invariant:** autopilot's `SHOWCASE` / `ROVING` code paths read through the interface, not from scene globals. V-later implementation of the OOI runtime registry does not require autopilot-side changes.

V1 exercises neither `SHOWCASE` nor `ROVING`, so the stub interface has no effective call sites in V1. But the interface must exist at V1, and the dispatch from camera mode to interface-query must exist at V1, so V-later is a wire-up and not a restructure.

### 10.10 Contract precedence

When an autopilot invariant and a §5 Camera and Control invariant appear to conflict, §5 governs the **mode/drive-state orthogonality** (Toy-Box/Flight × Manual/Autopilot/Warp); §10 governs the **autopilot drive-state internal structure**. The intersection is the autopilot column of §5.3 Drive States — this section refines it, does not override it.

§10 also does not override §9 Warp; the warp → autopilot handoff contract at §10.5 is written to be compatible with §9's phase sequence and callback contract. If a future implementation reveals a genuine conflict between §9 and §10.5, escalate to the Director before resolving; this boundary is load-bearing for warp seamlessness.

---

## Approved Exceptions

These are the only places where content is NOT derived from the galactic pipeline:

| Exception | What | Why it's OK |
|-----------|------|-------------|
| Title screen nebula | `NebulaGenerator` billboard | Cosmetic backdrop, not a gameplay destination |
| External galaxy Easter egg | `GalaxyGenerator` particle cloud | Definitionally outside the Milky Way |
| Sol system | `SolarSystemData` hardcoded | Intentional override at correct galactic position |
| Debug/gallery mode | Various legacy generators | Developer tools, not gameplay paths |

**No other exceptions are permitted.** If a warp destination can't resolve to a hash grid star, it falls back to star-system or aborts. Legacy generators (NavigableNebulaGenerator, NavigableClusterGenerator) must never be reachable from the warp/screensaver loop.
