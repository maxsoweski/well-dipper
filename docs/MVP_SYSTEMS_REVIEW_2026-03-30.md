# MVP Systems Review — 2026-03-30

**Branch:** `potential-refactor`
**Reviewer:** Claude (Developer + Architect + PM perspectives)
**Goal:** Assess readiness for infinite screensaver mode MVP

---

## DEVELOPER: Bug Hunt

### 1. Autopilot Loop (startFlythrough → autoNav → warp cycle)

#### [CRITICAL] 0-planet system crash in `focusPlanet()`
**File:** `src/main.js:3431-3434`

When a system has 0 planets (e.g., Keid), pressing Escape, Backtick, or Tab crashes the app:

- **Escape/Backtick** calls `focusPlanet(-1)`. The `index < 0` condition is true, so it tries `system.planets[system.planets.length - 1].orbitRadius`. With 0 planets, `system.planets[-1]` is `undefined` → crash.
- **Tab** calls `focusPlanet((focusIndex + 1) % n)` where `n = 0`. `% 0 = NaN`. `focusPlanet(NaN)` — the NaN fails both `< 0` and `>= length` checks, falls to else branch, tries `system.planets[NaN]` → `undefined.planet` → crash.
- **Mobile prev/next** buttons have the same `% n` issue.

**Fix:** Guard `focusPlanet()` against empty planet arrays. Also guard Tab handler.

#### [CRITICAL] Title screen auto-dismiss sets `cameraController.bypassed = false` during warp
**File:** `src/main.js:383-394` (dismissTitleScreen 5s timeout) + `src/main.js:3117-3127` (startFlythrough deep sky branch)

Timeline:
1. Title auto-dismisses → `dismissTitleScreen()` at T=0
2. `beginWarpTurn()` fires at T=1500ms → warp starts, sets `bypassed = true`
3. 5000ms timeout fires at T=5000ms (during FOLD phase) → calls `startFlythrough()`
4. `startFlythrough()` for the title screen nebula (distant deep sky) calls `cameraController.restoreFromWorldState(...)` which sets `bypassed = false`
5. Camera controller now processes mouse input during active warp, conflicting with warp's camera forward movement

Additionally, `_deepSkyLingerTimer` is set to 15 during this path and NEVER cleared by the warp pipeline. After warp completes and the tour starts in the new system, the stale 15s timer ticks down and triggers a premature auto-warp, interrupting the tour ~15s into the new system.

**Fix:** Guard `startFlythrough()` against running during active warp. Reset `_deepSkyLingerTimer` in `warpSwapSystem()`.

#### [BUG] `warpTarget.navStarData` not reset in `spawnSystem()`
**File:** `src/main.js:1327-1331`

`spawnSystem()` resets `warpTarget.direction`, `warpTarget.name`, `warpTarget.starIndex`, but NOT `warpTarget.navStarData`, `warpTarget.destType`, `warpTarget.featureData`, or `warpTarget.galaxyData`. Stale nav star data could carry over to the next warp cycle, potentially routing to the wrong star.

**Fix:** Reset all warpTarget fields in `spawnSystem()`.

#### [BUG] Nav computer can be opened during warp
**File:** `src/main.js:4348`

The N key check is only `!titleScreenActive`, not `!warpEffect.isActive`. Opening the nav computer during warp and pressing COMMIT triggers `dispatchNavAction` → `beginWarpTurn()`, which silently drops the action (`warpEffect.isActive` check). No crash, but the user picks a star, commits, and nothing happens. Confusing UX.

**Fix:** Block nav computer toggle during warp.

### 2. Manual Takeover / Release

#### [BUG] WASD during autopilot stops tour but `cameraController.bypassed` stays true
**File:** `src/main.js:4571-4575`

When WASD is pressed during autopilot, `stopFlythrough()` is called. `stopFlythrough()` calls `findClosestBody()` → `restoreFromWorldState()` which sets `bypassed = false`. This actually works correctly — the closest body handoff unsets bypassed. **Not a bug after closer inspection.** (Self-correction.)

#### [POLISH] No visual/audio feedback when idle timer restarts autopilot
**File:** `src/main.js:4161-4164`

When the player goes idle and the timer fires, `startFlythrough()` plays `autopilotOn` sound. But there's no HUD indication that autopilot has re-engaged. The transition is abrupt if the player was manually orbiting.

### 3. Warp Cycle

#### [BUG] Auto-warp from navigable deep sky tour loop is impossible
**File:** `src/main.js:232-245`

The `onTourComplete` callback returns early for `_navigable` systems without selecting a warp target. This is intentional ("user can manually warp with Space"), but it means navigable deep sky (nebulae, open clusters) will loop the tour FOREVER in screensaver mode. The player must press Space manually.

For true screensaver mode, navigable systems should auto-warp after N tour cycles (or after a configurable timeout).

**Current behavior:** Navigable deep sky loops infinitely → screensaver gets stuck.
**Expected:** After 1-2 full tour cycles, auto-select a warp target and leave.

#### [BUG] `autoSelectWarpTarget()` can fail silently on first system
**File:** `src/main.js:4830-4873`

`autoSelectWarpTarget()` calls `starfield.getRandomVisibleStar(dir)` which delegates to `skyRenderer.getRandomVisibleStar()`. This returns null if the starfield layer hasn't been built yet. After the first warp from the title screen, the starfield SHOULD exist (SkyRenderer.activate was called during warp). But if it returns null, `autoSelectWarpTarget` returns without setting `warpTarget.navStarData` or any direction. The `onTourComplete` handler at line 239 checks `warpTarget.navStarData || warpTarget.featureData || warpTarget.galaxyData` — all null — and logs a warning but doesn't retry. The screensaver loop stalls.

**Fix:** Add a retry mechanism or fallback random direction warp.

### 4. Edge Cases

#### [BUG] 0-planet systems: autopilot tour is just the star
**Not a crash, but odd behavior.** With 0 planets, the autopilot queue has 1 stop (the star). The camera orbits the star for ~35s, then `onTourComplete` fires immediately (1 stop visited >= 1 queue length). Auto-warp fires. The screensaver barely spends time in 0-planet systems.

This is arguably correct behavior (nothing else to see), but the linger time should perhaps be extended for these sparse systems.

#### [BUG] Deep sky systems: `system.star` is null for distant deep sky
**File:** `src/main.js:1915`

For non-navigable deep sky (galaxy/cluster distant view), `system.star = null`. The `isWarpTargetOccluded()` function at line 3593 does `if (system.star) bodies.push(...)` — safe. The `findClosestBody()` at line 3374 returns a position at origin — safe. But `updateFocusFromStop` for star stops tries to access the star object and would crash if autopilot somehow ran for deep sky. Since autopilot is not started for non-navigable deep sky, this path isn't reached. **Not a crash, but fragile.**

### 5. Memory Leaks

#### [POLISH] Disposal coverage is thorough
`spawnSystem()` properly disposes the previous system:
- Stars: `star.dispose()` (geometry + material)
- Planets: `planet.dispose()` + `billboard.dispose()` + ring disposal
- Moons: `moon.dispose()` + click proxy geometry/material disposal
- Orbit lines: `line.dispose()`
- Asteroid belts: `belt.removeFrom(scene)` — but `dispose()` not called explicitly

For deep sky: `destination.dispose()`, `gasCloud.dispose()`, `_deepSkyGas.dispose()`, `_deepSkyStars[].dispose()`, `extraStars[].dispose()`.

The `lodManager.clear()` is called. `systemMap.dispose()` is called. `gravityWell.dispose()` is called.

#### [BUG] Asteroid belts not explicitly disposed
**File:** `src/main.js:1391`

`system.asteroidBelts` are only removed from scene (`belt.removeFrom(scene)` in `_hideCurrentSystem`), not `belt.dispose()`. The geometry and material leak.

#### [POLISH] ShipSpawner ships — disposed via `shipSpawner.clear(scene)`
Ships are cleaned up. No leak there.

---

## ARCHITECT: Systems Integration

### Camera Ownership

#### [BUG] Three camera drivers with no formal ownership protocol
The camera is driven by:
1. **ShipCameraSystem** (manual orbit, WASD flight, gyro)
2. **FlythroughCamera** (autopilot cinematic)
3. **Warp turn + warp forward movement** (direct camera manipulation in animation loop)

The `cameraController.bypassed` flag is the only coordination mechanism. When bypassed, ShipCameraSystem's `update()` bails. But multiple places set/unset bypassed without checking the current state. The title screen auto-dismiss bug (CRITICAL above) is a direct consequence.

**Architectural recommendation:** Formalize camera ownership with an enum state (`MANUAL | FLYTHROUGH | WARP | DRIFT`) and a single `transferCamera(newOwner)` function that handles cleanup.

### AutoNavigator vs FlythroughCamera State Sync

#### [POLISH] `autoNav.isActive` and `flythrough.active` can disagree
During `beginWarpTurn()`, `flythrough.stop()` is called but `autoNav` stays active. The animation loop has a gap: if `flythrough.active = false` and `autoNav.isActive = true`, no branch handles it. Not a crash (resolves when warp completes), but a transient "neither system drives the camera" window.

### SkyRenderer + RetroRenderer

#### [POLISH] SkyRenderer lifecycle is well-managed
`prepareForPosition()` during FOLD (CPU work), `activate()` during HYPER (GPU resources). `update()` every frame. Galaxy glow hidden for title, restored in `onSwapSystem`. Clean.

### NavComputer + Main.js State Sync

#### [BUG] Nav computer state sync is one-way
The nav computer receives state (player position, current body, system data) when opened. But if the system changes while the nav computer is open (unlikely but possible during debug), the nav computer shows stale data. Low priority since in practice the nav computer is closed before warping.

### SoundEngine + MusicManager + Game State

#### [MISSING] Music tracks for gameplay are missing
Only `intro.mp3` and `title.mp3` exist in `/public/assets/music/`. The code references:
- `explore` — played after warp exit for star systems
- `hyperspace` — played during warp tunnel
- `deepsky` — played after warp exit for deep sky
- `warp-charge` — sting
- `arrival` — sting

None of these files exist. `MusicManager.preload()` silently fails (returns without error). **Result: the screensaver has NO music after the title screen.** The warp charge/enter/exit SFX still play, but there's no background music during exploration, warp, or deep sky viewing.

### Idle Timer Reset Coverage

#### [BUG] Idle timer doesn't reset on some input paths
Input paths that reset `idleTimer = 0`:
- Mouse move (only when `!autoNav.isActive`)
- Mouse click (only when `!autoNav.isActive`)
- Scroll wheel (only when `!autoNav.isActive`)
- Keyboard (line 4613, in normal mode — but NOT during autopilot)
- Touch start (only when `!autoNav.isActive`)

Input paths that DON'T reset idle timer:
- N key (nav computer) — opens but doesn't reset timer
- P key (settings) — opens but doesn't reset timer

These overlays block the keyboard input from reaching the idle timer reset at line 4613 because they return early. But the idle timer still ticks. If the user is in the settings panel for longer than `idleTimeout`, autopilot starts while settings is open. Minor since overlays are rarely open that long.

---

## PM/PO: Feature Completeness for MVP Screensaver

### Checklist

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | **Title screen → intro → first warp** | WORKS | Splash → intro logos → title screen → auto-dismiss → warp to first system |
| 2 | **Autopilot tour** | WORKS | Visits star, all planets, all moons with cinematic orbits and Hermite travel |
| 3 | **Auto-warp after tour** | PARTIAL | Works for star systems. **Broken for navigable deep sky** (loops forever). Stale `_deepSkyLingerTimer` bug can cause premature warp. |
| 4 | **Variety** | WORKS | Galaxy-aware generation. Different star types, binary systems, evolved stars, varied galactic positions. |
| 5 | **Deep sky visits** | PARTIAL | Distant galaxies/clusters work (drift + contemplate + auto-warp). Navigable nebulae/clusters work visually but **tour loops forever** — no auto-warp. |
| 6 | **Music during gameplay** | [MISSING] | **Only title + intro tracks exist.** No explore, hyperspace, deepsky, or sting tracks. Silent screensaver after title screen (except SFX). |
| 7 | **Sound effects** | WORKS | All SFX files present. Warp charge/enter/exit, autopilot on/off, select, cycle, UI click, nav computer. |
| 8 | **Visual polish** | WORKS | Starfield, galaxy glow, star flares, orbit lines, planet rendering with LOD, billboards for distant objects, dithered retro aesthetic. |
| 9 | **Manual override** | WORKS (with caveats) | Left-click stops autopilot. WASD stops autopilot. Tab/number keys redirect tour. **Crashes on 0-planet systems** (Escape, Tab). |
| 10 | **Release control → autopilot resumes** | WORKS | Idle timer (default 30s) restarts `startFlythrough()`. Mouse/key/touch input resets timer. |

### MVP Blockers (must fix before shipping)

1. **[CRITICAL] 0-planet crash** — Escape/Tab/mobile nav crash on 0-planet systems. These systems exist in the galaxy and will be visited.
2. **[CRITICAL] Title auto-dismiss bypassed bug** — Camera controller unset during warp causes visual glitch; stale linger timer causes premature warp.
3. **[MISSING] Navigable deep sky auto-warp** — Screensaver gets stuck forever in nebulae/clusters. Need auto-warp after N tour cycles.
4. **[MISSING] Gameplay music** — Silent screensaver after title is not shippable. Need at least `explore.mp3` and `hyperspace.mp3`.

### Nice-to-Have (post-MVP)

- Formal camera ownership state machine
- Asteroid belt explicit disposal
- Extended linger for 0-planet systems
- Visual indicator when idle timer re-engages autopilot
- Nav computer blocked during warp
- `warpTarget` full field reset in `spawnSystem()`
- Auto-warp retry when `autoSelectWarpTarget` fails to find a star

---

## Fixes Applied (all in `src/main.js`)

### FIX 1: 0-planet crash in `focusPlanet()` and Tab handler
- `focusPlanet()`: Added `|| system.planets.length === 0` to the overview guard. When 0 planets, orbits the star at 10x radius instead of crashing on `system.planets[-1]`.
- Tab handler: Added `if (n === 0) return;` before `% n` division.
- Mobile prev/next: Added same `if (n === 0) return;` guard.

### FIX 2: Title auto-dismiss bypassed + stale linger timer
- `startFlythrough()`: Added `if (warpEffect.isActive) return;` at top. Prevents the title screen's 5s timeout from calling `restoreFromWorldState` (which unsets `bypassed`) during an active warp.
- `warpSwapSystem()`: Added `_deepSkyLingerTimer = -1;` to cancel any stale timer from the previous system.

### FIX 3: Navigable deep sky auto-warp
- Added `_tourCycleCount` counter, incremented in `onTourComplete`.
- Navigable deep sky now auto-warps after 2 full tour cycles instead of looping forever.
- Counter reset to 0 in `spawnSystem()`.

### FIX 4: warpTarget fields fully reset
- `spawnSystem()`: Now resets `navStarData`, `destType`, `featureData`, and `galaxyData` alongside the existing `direction`/`name`/`starIndex` resets.

### FIX 5: Nav computer blocked during warp
- N key handler: Added `&& !warpEffect.isActive` to prevent opening nav computer during warp transition.

### Build verification
All fixes pass `vite build` with no errors.
