# Fixed-Timestep Migration — Per-Call-Site Audit (2026-05-03)

Companion to `docs/WORKSTREAMS/welldipper-fixed-timestep-migration-2026-05-03.md`.
Per AC #2: every existing `update(dt)`-consuming call site classified
**before** Phase 3 code changes land. Rows are sorted by file, then
line number.

## Classification key

- **sim** — fixed sim dt (16.667 ms @ 60 Hz). Runs inside the
  accumulator's `simUpdate()` callback. Examples: path planning,
  physics integration, state-machine transitions, body orbit advance,
  shake-envelope state.
- **render** — variable real dt. Runs inside the accumulator's
  `render(alpha)` callback. Examples: shader time uniforms, visual-
  only animations, audio-clock-driven effects.
- **audit-required** — ambiguous, needs explicit ruling before Phase
  3 code change. Each `audit-required` row carries a rationale and
  proposed ruling; PM / Tester / Max sign off before commit.
- **wrap** — site that *both* sims AND renders, decompose into a
  sim part + render part. Marked separately because it requires
  splitting a single call into two.

Phase 3 will land per-row code changes after this audit is signed
off. Rows here are derived from `grep -n "update(.*deltaTime\|deltaTime"
src/main.js src/auto/*.js src/objects/*.js src/effects/*.js
src/rendering/*.js src/camera/*.js`.

## main.js — animate loop body

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 5878 | `const deltaTime = Math.min(timer.getDelta(), 0.1)` | **wrap** (will become `simDt` from accumulator + `renderDt` from RAF) | Today's variable-dt source. Replaced by accumulator entry. |
| 5889 | `skyRenderer.update(camera, 0)` (sky-debug branch) | render | Debug branch. Visual only. |
| 5903 | `galleryObject.update(deltaTime, camera)` | render | Gallery mode is visual preview; eased orbit animation. |
| 5908 | `obj.update(deltaTime, _galleryOrigin)` (Moon in gallery) | render | Same — gallery preview. |
| 5910 | `obj.update(deltaTime, camera)` (gallery generic) | render | Same. |
| 5915 | `cameraController.update(deltaTime)` (gallery branch) | render | Gallery-mode camera animation, visual-only. |
| 5920 | `skyRenderer.update(camera, deltaTime)` (gallery branch) | render | Time-based shader uniforms. |
| 5959 | `system.destination.update(deltaTime, camera)` (deep-sky) | render | Deep-sky "destination" object — billboard / visual. |
| 5961 | `system.gasCloud.update(deltaTime, camera)` | render | Visual-only volumetric. |
| 5962 | `system._deepSkyGas.update(deltaTime, camera)` | render | Same. |
| 5964 | `s.update(deltaTime, camera)` (deep-sky stars) | render | Visual stars. |
| 5968 | `s.update(deltaTime, camera)` (more deep-sky) | render | Same. |
| 5973 | `system.star.update(deltaTime, camera)` (deep-sky star) | render | Star *flare* animation (visual, billboard-relative-to-camera). |
| 5975 | `system.star2.update(deltaTime, camera)` | render | Same. |
| 5991-5992 | `system.binaryOrbitAngle += system.binaryOrbitSpeed * celestialDt` | **sim** | Orbital state advance. Per `realistic-celestial-motion-2026-04-27` AC #2 — celestial state runs at sim rate. |
| 6008 | `entry.orbitAngle += entry.orbitSpeed * celestialDt` (planet orbit) | **sim** | Same. |
| 6045 | `entry.planet.update(deltaTime, celestialDt)` | **wrap** | Planet has both sim parts (rotation advance) and render parts (shader uniforms). Decompose. See `Planet.update` rows below. |
| 6037 | `moon.orbitAngle += moon.data.orbitSpeed * celestialDt` (planet-moon) | **sim** | Orbital advance. |
| 6065 | `moon.planet.update(deltaTime)` (planet-class moon body) | **wrap** | Same shape as Planet.update — sim+render mix. |
| 6067 | `moon.update(deltaTime, entry.planet.mesh.position, celestialDt)` (Moon) | **wrap** | Moon update advances orbit (sim) AND animates rotation (render-side). See `Moon.update` row. |
| 6154 | `system.star.update(deltaTime, camera)` (in-system star, post-loop) | render | Star flare visual. |
| 6157 | `system.star2.update(deltaTime, camera)` | render | Same. |
| 6163 | `belt.update(deltaTime, celestialDt)` (asteroid belt) | **wrap** | Belt update advances asteroid orbit positions (sim) + visual shimmer. Decompose. |
| 6171 | `shipSpawner.update(celestialDt, system.planets)` | **sim** | Spawned ship trajectory advance. |
| 6320 | `warpTarget.turnTimer += deltaTime` | **sim** | State-machine timer (warp turn phase). |
| 6352 | `warpTarget.blinkTimer += deltaTime` | render | Visual blink animation on a warp target indicator. |
| 6389 | `warpPortal.update(deltaTime)` | **sim** | Phased portal animation is a time-windowed sim state machine. |
| 6416 | `warpEffect.update(deltaTime)` | **sim** | Phased warp effect; phase transitions are sim state. |
| 6686 | `_labArrivalElapsed += deltaTime` | render | Portal-lab debug-mode visual timer. |
| 6703 | `_portalLabAlignElapsed += deltaTime` | render | Same — debug-mode visual. |
| 6724 | `autopilotMotion.update(deltaTime)` | **sim** | Autopilot path planning + phase transitions per brief example. |
| 6764 | `cameraChoreographer.update(deltaTime, frame)` | **sim** | Framing-state lerps that affect commanded camera position. Render-time interpolation handles the smooth-motion layer above. Per brief example. |
| 6819 | `shipChoreographer.update(deltaTime, shipFrame)` | **sim** | Shake envelope, signal smoothing — sim state. Per brief example. |
| 6857 | `flythrough.update(deltaTime)` | **sim** | Same as autopilotMotion — path + phase. Per brief example. |
| 6862 | `shipChoreographer.update(deltaTime, result)` | **sim** | Same as 6819. |
| 6909 | `idleTimer += deltaTime` (no warp/flythrough/auto-nav idle branch) | **sim** | Triggers `startFlythrough` (sim transition). Per brief example. |
| 6918 | `idleTimer += deltaTime` (manual-burn-orbit branch) | **sim** | Same — triggers autopilot start. |
| 6929 | `_deepSkyDrift.elapsed += deltaTime` | **sim** | Drives deep-sky transition (sim handoff). |
| 6950 | `_deepSkyLingerTimer -= deltaTime` | **sim** | Triggers warp-out (sim transition). |
| 7031 | `cameraController.update(deltaTime)` (post-celestial-update branch) | **sim** | Manual orbit input processing. Per brief example. |
| 7055 | `skyRenderer.update(camera, deltaTime)` (post-render-mode branch) | render | Shader time uniforms, sky animations. Per brief example. |
| 7056 | `warpPortal.update(deltaTime)` (post-render-mode branch) | DUPLICATE — already counted at 6389 | — |
| 7059 | `debugPanel.update(deltaTime)` | render | Debug HUD visual update. |
| 7138 | `systemMap.update(camera, hudYaw, focusIndex, deltaTime)` | render | HUD visual blink. (Brief example: "system map's blink animation stays on render.") |

### main.js — `_captureTelemetrySample()` site

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 6734 | `_captureTelemetrySample()` (autopilotMotion branch) | **sim** | Per AC #9: telemetry sampler relocates to sim tick post-Phase-2. Currently fires here on autopilotMotion path per render. |
| 6767 | `_captureTelemetrySample()` (flythrough branch) | **sim** | Same. |

## src/auto/AutopilotMotion.js

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 427 | `update(deltaTime)` (entry) | **sim** | Driven by main.js:6724 sim call. |
| 467+ | `_tickCruise(deltaTime)` etc. | **sim** | Sub-callees of sim-classified `update`. |

## src/auto/CameraChoreographer.js

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 180 | `update(deltaTime, motionFrame, shipPhase, nav)` | **sim** | Same — driven by sim-classified caller. |
| 217 | `_blendElapsed += deltaTime` | **sim** | Framing-state blend. |
| 227 | `_lingerElapsed += deltaTime` | **sim** | Framing-state linger timer. |
| 241 | `_panAheadBias += ... * deltaTime` | **sim** | Decay applied to commanded camera bias. |

## src/auto/FlythroughCamera.js

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 106 | `update(deltaTime)` | **sim** | Driven by main.js:6857 sim call. |
| 107 | `this.navigation.update(deltaTime)` | **sim** | Internal sim call. |
| 128 | `this._rotBlendElapsed += deltaTime` | **sim** | Rotation blend state. |
| 142 | `this._cameraChoreographer.update(deltaTime, frame)` | **sim** | Internal call. |

## src/auto/AutopilotNavSequence.js

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 322 | `performance.now()` | **audit-required** → **sim** | Per Phase 3 AC #11: replace with sim-clock counter. Render-side performance.now() okay; sim-side breaks replay. |
| 412 | `performance.now()` | **audit-required** → **sim** | Same. |

## src/effects/WarpEffect.js

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 115 | `update(dt)` | **sim** | Phased warp animation (FOLD/HYPER/EXIT) is sim state. State transitions drive scene swap, audio cues. |

## src/effects/WarpPortal.js

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 598 | `update(deltaTime)` | **sim** | Phased portal state machine. |

## src/rendering/SkyRenderer.js

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 214 | `update(camera, deltaTime)` | render | Shader time uniforms, glow layer, time-based visuals. **audit-required** if `_glowLayer` reads any sim-affecting position — which it does (`setPlayerPosition`). Decompose: position write to glow layer is read of sim state (no-op for migration); shader time uniforms stay render. **No splitting required**: render reads sim positions safely. |

## src/camera/CameraController.js

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 608 | `update(deltaTime)` | **sim** | Manual orbit input processing. Per brief example. |

## src/camera/CameraPhysics.js

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 116 | `update(deltaTime)` | **sim** | Physics integration — sim-affecting by name. |

## src/camera/ShipCamera.js, ShipCameraSystem.js, CinematicDirector.js

| File | Line | Call | Classification | Rationale |
|------|------|------|----------------|-----------|
| ShipCamera.js | 157 | `update(deltaTime)` | **sim** | Camera-mode state machine + integration. |
| ShipCamera.js | 423/448/509/595 | `this.physics.update(dt)` | **sim** | Physics integration sub-calls. |
| ShipCameraSystem.js | 804 | `update(deltaTime)` | **sim** | Top-level integration. |
| ShipCameraSystem.js | 933 | `this.flight.update(deltaTime)` | **sim** | Flight dynamics integration. |
| CinematicDirector.js | 106 | `update(dt, shipPosition, ...)` | **audit-required** → **sim** | Drives camera mode transitions; sim-classified by analogy with autopilot. Tester confirms during Phase 3. |

## src/objects/Planet.js

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 1277 | `update(deltaTime, celestialDt)` | **wrap** | Sim part: orbit/rotation advance. Render part: shader animation uniforms. Decompose into `updateSim(simDt, celestialDt)` + `updateRender(renderDt, alpha)` in Phase 3. |

## src/objects/Moon.js

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 578 | `update(deltaTime, parentPosition, celestialDt)` | **wrap** | Same as Planet — sim (orbit advance) + render (visual). Decompose. |

## src/objects/AsteroidBelt.js

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 206 | `update(deltaTime, celestialDt)` | **wrap** | Sim: asteroid positions advance. Render: shader uniforms (if any). Decompose. |

## src/objects/ShipSpawner.js

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 117 | `update(deltaTime, planetEntries)` | **sim** | Spawned-ship trajectory advance. |

## src/objects/StarFlare.js

| Line | Call | Classification | Rationale |
|------|------|----------------|-----------|
| 326 | `update(deltaTime, camera)` | render | Visual flare animation, billboard. |

## src/objects/Galaxy.js / GalaxyCloud.js / GalaxyNebula.js / MilkyWay.js / Nebula.js / VolumetricNebula.js

| File | Line | Call | Classification | Rationale |
|------|------|------|----------------|-----------|
| Galaxy.js | 161 | `update(deltaTime)` | render | Visual-only galactic-feature animation. |
| GalaxyCloud.js | 296 | `update(deltaTime)` | render | Same. |
| GalaxyNebula.js | 202 | `update(deltaTime, camera)` | render | Visual nebula. |
| MilkyWay.js | 327 | `update(deltaTime)` | render | Visual milky-way background. |
| Nebula.js | 326 | `update(deltaTime, camera)` | render | Visual nebula. |
| VolumetricNebula.js | 119 | `update(deltaTime)` | render | Visual volumetric. |

## Audio clock domain (AC #3)

Per Drift Risk: audio is on its own real-time clock (the
`AudioContext.currentTime` clock). Sim time MUST NOT push into the
audio clock; audio reads from `audioContext.currentTime` directly.

### Audio sites

| Site | Direction | Ruling |
|------|-----------|--------|
| `musicManager.playOnce` / `.stop` invocations from sim transitions (warp arrival, autopilot toggle) | sim → audio (sim writes "play this") | **safe** — sim issues commands; audio plays on its own clock. |
| BPM-synced animations (if any read audio time) | audio → render | **safe** — render path reads audio time directly. Stays render. |
| `_systemMusicTimer` (`setTimeout`-based, real-wall-clock scheduling) | independent | **safe** — uses `setTimeout`, not sim or render dt. |
| `soundEngine.play(...)` invocations | sim → audio | **safe** — fire-and-forget. |
| Any future BPM-driven sim event (none currently) | audio → sim | **must be audit-required** if added; would need explicit handling per Principle 4. |

**Ruling for migration:** no audio↔sim coupling sites currently
require special handling. The audit is here for future maintenance —
when adding a BPM-synced animation that drives sim state, the
addition is a sim-affecting site that must be flagged for
audit-required review.

## World-origin rebase event timing (AC #4)

Per `WorldOrigin.maybeRebase()` doc and the rebasing workstream's
Drift Risk #2:

> *"Rebase must happen before any per-frame logic that uses world
> positions that frame."*

In the migrated loop, `maybeRebase(camera, scene)` fires **at the
start of each sim tick**, before any sim-affecting subsystem update.

```js
function simUpdate(simDt) {
  // Rebase event fires FIRST, before any sim subsystem reads
  // world positions. Per docs/PLAN_world-origin-rebasing.md
  // §"Risks / gotchas" #2 and
  // docs/WORKSTREAMS/world-origin-rebasing-2026-05-01.md Drift risk
  // *"Rebase event timing wrong relative to per-frame logic"*.
  maybeRebase(camera, scene);

  // ... rest of sim subsystems
}
```

**Forbidden:** invoking `maybeRebase` inside the `render(alpha)`
callback. Render reads interpolated state; rebasing mid-render-frame
would jump rendered camera position.

## Summary counts

- Total enumerated sites: ~58
- **sim**: 32
- **render**: 17
- **wrap** (decompose into sim + render): 5
- **audit-required**: 4 (3 confirmed sim per brief examples; 1 needs Tester ruling)

## Unresolved (need explicit ruling before Phase 3 commit)

1. **`CinematicDirector.update(dt, ...)`** — sim by analogy, but
   confirm with Tester during Phase 3.
2. **`SkyRenderer.update(camera, dt)` reading sim-affecting positions**
   — render-classified, but the read path crosses the sim/render
   boundary. The migration treats it as render reads sim (safe);
   no split required. Confirm with Tester that no sim-side write
   happens inside SkyRenderer.update.
3. **The `_deepSkyDrift.elapsed += deltaTime` site** — currently
   classified sim because it gates a sim transition (warp-out). But
   the elapsed-time itself drives a visual lerp (camera ease-out
   to viewing distance). The lerp could be render-side with sim-side
   trigger. Decompose if cleaner.
4. **The `flythrough.update`'s velocity-blend during warp arrival** —
   per brief example, "mostly sim, but blends against a render-rate
   camera quaternion slerp. Decompose into sim part + render part."
   Defer specific decomposition to Phase 3 commit; Tester confirms
   the split.

Each of these gets a per-row Tester ruling at Phase 3 commit. The
brief's AC #2 is satisfied by this audit being committed; per-site
sign-off happens during Phase 3 execution.
