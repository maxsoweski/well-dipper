# AC4 zoom-in arrival — ratified mechanism design (2026-07-20, pre-build)

From the opus entry-paths/carrier exploration (this session). Line numbers point-in-time 2026-07-20.

## Carrier: seed the existing smoothedDistance log-lerp (candidate b)

- All four ORRERY entries converge on `_enterSystemInstantOrrery` (main.js:6452) →
  `_frameSystemForOrrery` (:6481): nav warp :3007, bg-star+Space :6967, mobile double-tap :11218,
  mobile speed-dial :11283; boot-skip joins via its ORRERY tail. HELM warp reveal's ORRERY safety
  net :6633 also frames.
- The ShipCameraSystem smoothedDistance log-lerp (ShipCameraSystem.js:1216-1218, smoothing 0.08,
  τ≈0.2s ⇒ ~1s to close ANY log gap) runs in the TOY_BOX non-glide path — inert only under
  `bypassed`/`_gliding`/`_returningToOrbit`, all of which `_frameSystemForOrrery` clears.
- TODAY the arrival lerps OUTWARD because `restoreFromWorldState` seeds smoothedDistance near
  (the teleport-then-zoom-out AC4 kills). THE FIX: after the frame (:6433-6435 sets
  distance=1.8×outer, pitch 0.7, target=star), seed `smoothedDistance = arrivalSpawnDistance(...)`
  (AC3 module) — the existing lerp then zooms IN and lands EXACTLY at the shipped overview by
  construction. Interruption-safe for free (drag=yaw/pitch, wheel retargets distance, select arms
  glide and supersedes).

## Placement trap (working-Claude addition)

Seed at the SYSTEM-ENTRY seam (`_enterSystemInstantOrrery` + warp-reveal ORRERY net + boot-skip
tail) — NEVER inside `_frameSystemForOrrery`/`viewSystem`: `viewSystem` is also the Esc de-focus
overview primitive (focusPlanet(-1)), and Esc-to-overview must not far-spawn.

## Far plane (mandatory, not optional)

At spawn ~4.5M with far=200000, ONLY the camera-locked sky renders (StarFlare billboard is
GPU-far-clipped despite frustumCulled=false; planets/orbits clipped) — violates "star as
billboard" at spawn. Strategy: RAISE camera.far ≳5M at seed time, restore at settle. Precedent:
navigable-nebulae far-extension exists; spawnSystem RESETS far to 200000 at main.js:4391 BEFORE
framing (so set far AFTER); `logarithmicDepthBuffer:true` (RetroRenderer.js:49) makes big far
z-safe; near re-pinned 1e-9 per frame (:7875, :9243). Clamping spawn under far instead is REJECTED:
200k ≈ Sol maxDistance ≈ inside the planets-distinct zone — the honest spawn can't fit.

## Settle signal

No distance-settle flag exists. Add an explicit arrival flag (e.g. `_arrivalSettled`) flipped when
`|ln(smoothedDistance) − ln(distance)| < ε` with distance at overview value — the AC4 probe and the
far-restore hook. Convergence-polling alone is asymptotic; don't.

## Additional traps (agent-verified)

- Seed `smoothedDistance`, NOT `distance` — the wheel branch clamps `distance` to maxDistance
  (~203k Sol) and would snap a 4.5M value; the log-lerp reads distance as its target. maxDistance
  never clamps smoothedDistance or viewSystem's assignment (confirmed from code).
- `smoothing=0.08` is GLOBAL orbit smoothing — do not retune for arrival pacing; if UAT wants a
  different feel, escalate to a dedicated scripted mode (candidate c), don't touch the constant.
- glideFocus (candidate a) REJECTED: doesn't pin pitch 0.7 (back-solves at _endGlideToOrbit) and
  shares the click-2 GLIDE_APPROACH_DURATION const (802cceb guardrail).
- Non-production entries (_lab.enterSol, raw viewSystem) skip framing — the zoom fires only on the
  production paths by construction.
