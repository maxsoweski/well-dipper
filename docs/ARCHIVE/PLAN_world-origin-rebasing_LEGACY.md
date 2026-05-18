# World-Origin Rebasing — Deferred Plan

**Status:** Deferred. Not needed for current game state (screensaver + basic warp). Becomes **required** before ship combat, docking, or landing work starts.

**Root cause this addresses:** Float32 precision (~7 significant digits) can't simultaneously represent world coordinates in the tens-to-thousands-of-scene-units range AND ship-scale offsets (10⁻⁶ scene = meters). At realistic ship scale, any position-relative math loses precision as the camera drifts from the scene origin.

Concrete symptom observed 2026-04-16: Portal B target 100 m behind camera (6.685×10⁻⁷ scene) gets absorbed into world-coordinate noise once the camera moves past ~10 scene units from origin. Observed drift: Portal B ends up 1,000–1,000,000× farther than target.

This is a known large-world problem. Standard solution: periodically shift the world origin to the camera, keeping local coordinates small.

---

## When to implement

Implement **before** any of these features ships:

- Multi-ship combat at realistic ranges
- Docking at space stations
- On-foot exploration (§8G)
- High-LOD planetary surface / landing mechanics

Not needed for:
- Current screensaver
- Current warp sequence (mechanical correctness works at today's scales)
- Galactic map / nav computer (already in a separate coordinate frame)
- HUD, billboards, periscope magnifier (camera-relative or synthetic rendering)

Reasonable sequencing: rebasing lands as a standalone pass once we start needing sub-meter precision anywhere in the game.

---

## What rebasing does (mechanical summary)

Every frame (or past a threshold like `camera.position.lengthSq() > 100²`), subtract the camera's world position from every position-tracked object in the scene, and reset the camera to `(0, 0, 0)`. Accumulate the offset in `worldOrigin` (a Vector3 tracking the "real" world position of the current rendering origin).

Visually identical every frame. Numerically, all nearby objects live at small coordinates, and ship-scale precision is preserved.

Pseudocode:

```js
const REBASE_THRESHOLD_SQ = 100 * 100;  // 100 scene units ≈ 15 M km
const worldOrigin = new THREE.Vector3();  // accumulated offset

function maybeRebase() {
  if (camera.position.lengthSq() < REBASE_THRESHOLD_SQ) return;

  const offset = camera.position.clone();
  worldOrigin.add(offset);
  camera.position.set(0, 0, 0);

  for (const child of scene.children) {
    child.position.sub(offset);
  }
  // Also: any cached target/start/look-at Vector3s in controllers.
  // See "Touch list" below for the full set.
}
```

Any code that needs "true" world position reads `worldOrigin + object.position`. Most code doesn't need to know about the rebase at all — it operates on relative positions.

---

## Touch list (files/systems that need review)

Estimated ~10–20 files. Not a rewrite — a targeted pass.

### Definitely affected

- **Scene-graph objects** — anything whose `position` is world-space: star, planets, moons, asteroid belt, ship meshes, nav lines, orbit lines, gravity wells, the warp portal group. Top-level children of the scene get the rebase offset subtracted. Descendants inherit.
- **Camera controllers** — `ShipCameraSystem`, `AutoNavigator`, `FlythroughCamera`, `AutopilotNavSequence`. Each caches target positions, look-at vectors, tour stops. Rebase must apply the offset to these caches, OR switch to storing targets as references-to-objects instead of captured Vector3s.
- **Shader uniforms carrying world positions** — body shader `_sunDir` / sun-position, StarFlare orientation references, light directions. Uniforms computed per-frame from object positions rebase for free; uniforms set once at spawn need recomputation at rebase.
- **HashGridStarfield + GalacticMap seam** — galactic-scale coords are already in a separate (kpc) frame. Conversion from galactic → scene is per-frame from the camera's galactic position. Needs to include the accumulated rebase offset in that conversion. Small, localized fix.
- **Warp portal** — `warpPortal.group` lives in the scene and gets rebased like any other object. The portal traversal logic (`updateTraversal`) uses world dot products and remains correct as long as BOTH portal and camera are rebased consistently.

### Potentially affected (verify during implementation)

- **Raycasting / click-selection** — operates on `mesh.matrixWorld`, which reflects the rebased positions. Should be free.
- **Orbit physics / gravity field** — if relative to `star.position`, free. If using absolute positions, fix.
- **SkyRenderer, billboards, screen-space HUDs** — already camera-relative. Free.
- **Post-warp camera placement** (`main.js` `onSwapSystem`) — uses `starPos + travelDist + orbitDist + coastDist`. Still works; the star is at a rebased position.
- **Nav computer, minimap** — use either galactic coords (separate frame) or compressed map units (independent of scene coords). Free.

### Not affected

- Particle systems with local positions
- Texture baking
- Ship .glb models
- Material shaders that don't reference world positions

---

## Risks / gotchas

1. **Missing a cached world-position** — one forgotten spot produces a visible teleport at rebase. Mitigation: grep for `.position.copy(`, `.position.set(`, `new Vector3(` assigned to state; audit each.
2. **Timing** — rebase must happen before any per-frame logic that uses world positions that frame. Wrong order → one-frame inconsistencies.
3. **Shader uniforms** — any uniform holding a world position not derived from an object's `.position` is a landmine. Audit shader uniform setters.
4. **Save-game state** — if we ever add persistence, saved positions need to account for the accumulated rebase offset.
5. **Debug HUDs** — any UI showing "camera at (x, y, z)" will always show `(0, 0, 0)` or near-zero. Display `camera.position.clone().add(worldOrigin)` to show the "true" position.
6. **Networking** — if multiplayer is ever added, world coordinates in protocol need the rebase offset canonicalized (pick one player's frame).

---

## Effect on the feature set

| Feature | Needs ship-scale precision? | Rebasing status |
|---|---|---|
| Current screensaver | no (current scales fine) | not needed |
| Current warp | no (current scales fine) | not needed |
| Multi-ship combat (realistic ranges) | yes | **required** |
| Docking at stations | yes (sub-meter) | **required** |
| On-foot exploration (§8G) | yes (sub-meter) | **required** |
| High-LOD surface / landing | yes (sub-meter) | **required** |
| Periscope / gravitational-lens magnifier (§7) | no (synthetic) | neutral |
| Nav computer / galactic map | no (separate frame) | neutral |
| Fuel / upgrade / combat systems | no | neutral |

---

## What rebasing doesn't fix

- **Sub-object detail relative to its parent** — a 0.5 m hull detail on a 20 m ship still needs ~10⁻⁷ scene precision. Even with camera at origin, float precision is at its edge. For very fine work (cockpit geometry, surface detail), a **ship-local coordinate frame** nested inside the world frame is the cleaner fix. Not needed until on-foot / cockpit-interior features.
- **Very large destinations rendered near origin** — if a 10 km station is at origin and we fly to a 1 km detail on it, still need to think about precision. Usually handled by LOD swap.
- **Z-fighting at very small depth ranges** — already handled by the log-depth buffer.

---

## Interim workarounds until rebasing lands

For Portal B post-warp visibility specifically:

1. **Accept imperfect placement** — current state. Portal B is 100 m behind camera when near scene origin; drifts to km+ when camera is far. The warp *mechanically* works (speeds, phase transitions, system swap); only the post-arrival Portal B landmark is unreliable.
2. **Camera-child Portal B** — make Portal B's disc + rim children of the camera with local position `(0, 0, -postExitDistance)`. Always visible at target offset regardless of world coords. Breaks Portal B's "fixed world-space landmark" property (turns with the camera), but satisfies the "turn around and see it" UX. Small change.
3. **Scale-up Portal B post-warp** — swell its aperture to km-scale post-arrival so it's visible at km-scale distances. Visually wrong (giant portal) but trivial to ship.

Max flagged the portal/tunnel assets as placeholders slated for redesign. The right place to address Portal B post-warp behavior is in that redesign, which will likely coincide with or follow rebasing.

---

## Implementation effort (rough estimate)

- **Core rebase loop + audit of known touch points**: 1 day
- **Shader uniform audit + fixes**: 0.5–1 day
- **Camera controller state audits**: 0.5 day
- **Testing across all scales (close moon, deep sky, full warp, autopilot tour)**: 1 day
- **Bug-fixing edge cases surfaced during testing**: 0.5–1 day

**Total: 2–4 focused days + testing.**

Not urgent. Not optional once ship combat starts.
