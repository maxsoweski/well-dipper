# Warp Arrival at Billboard Distance — Design

**Date:** 2026-06-10
**Workstream:** `warp-tunnel-pocket-traversal-2026-06-06` (continuation)
**Journey context:** Travel-loop signature moment (35% SCREENSAVER-MVP), F&F tier.

## Goal (Max's words, 2026-06-10)

> "adjust the distance from the system center we arrive at after a warp; i'd like
> it to be a bit farther away so the star(s) show as billboards upon exit, will be
> more consistent with the verison of the star we see in the starfield in the
> previous system"

Acceptance criterion: on emergence from Portal B, the destination star(s) render
in their **billboard** LOD (StarFlare's distance dot), not the flare disc —
visually continuous with the starfield dot the player targeted from the origin
system.

## Decisions (Max, this session)

- **Same arrival distance for both warp paths** (starfield-targeted and
  nav-computer). One rule, no path branching.
- **Keep the existing fly-in** after emergence. No behavior change beyond the
  start distance.
- **Supercruise context:** the next dev arc replaces the movement system with an
  Elite-Dangerous-style supercruise + freelook, with autopilot rewired on top.
  Therefore: zero investment in tuning/characterizing the current
  AutopilotMotion fly-in (it is slated for replacement); `warpRevealSystem`'s
  nav handoff (main.js ~5510) is the expected supercruise integration seam.
  The arrival-distance computation itself is the part that survives the rework
  — Elite's pattern is "drop out near the star at long range, fly in."

## Why derived, not tuned

The flare→billboard switch (StarFlare.js `update()`) is **screen-space**: it
fires when the flare's visible glow (R×6 world units) projects below a
luminosity-dependent 16–22 px target. The switch distance therefore depends on
window height, FOV, and star class (~R×400–550 typically). A fixed multiplier
(today's `radius × 100`) cannot guarantee billboard rendering on every display;
computing the arrival distance from the same formula can, by construction. It
also stays correct through the supercruise rework, being anchored to the
renderer rather than to flight feel.

## Changes

1. **`src/objects/StarFlare.js`** — extract the inline switch-distance math into
   `billboardSwitchDistance(fovDegrees, screenHeightPx)` → camera distance at
   which the flare yields to the billboard. `update()` calls it (single source
   of truth). Pure math on `_renderRadius` + `_lumFactor`.
2. **`src/main.js` `warpSwapSystem`** (star-system branch, ~5445) — replace
   `orbitDist = star.data.radius * 100` with
   `orbitDist = max(star, star2?) .billboardSwitchDistance(camera.fov, innerHeight) × margin`.
   - `margin` default **1.3**, overridable live via `window._warpArrivalMargin`
     (UAT knob, `_warpPreviewDist` pattern from `ec47b84`).
   - Binary: max over both stars so both render as billboards; position still
     measured from the primary (generator emits close binaries only — see
     `memory/well-dipper-binary-wide-separation.md` for the queued wide-binary
     feature this does not block).
   - Everything else unchanged: camera placement/lookAt, `cameraInterp.resync`,
     Portal-B re-anchor, deep-sky branch.

## Sequencing check (why margin 1.3 suffices)

At the emergence crossing the camera is ≈ `orbitDist + coastDist(60)` from the
star; the 3s coast brings it to ≈ `orbitDist`, still ≥ switch distance × 1.3 →
billboard guaranteed at emergence and through the coast. The nav leg then flies
in and the star grows billboard → flare → disc naturally. Flight time bounded
by the cruise ceiling (12s + 1.8s approach, AutopilotMotion.js) regardless of
the longer leg.

## Out of scope

- Any change to the fly-in feel, AutopilotMotion constants, or autopilot
  behavior (supercruise rework owns those).
- Wide-binary arrival geometry (queued feature).
- The starfield-vs-navcomp path discriminator (decision: same distance).

## Testing

- **Unit (Vitest):** `billboardSwitchDistance` — parity with the previous
  inline math (characterization); monotonic in radius and luminosity;
  targetPx clamps hold at the 16 px floor (dim stars) and 22 px ceiling
  (high-luminosity stars).
- **Live (GPU 9223, chrome-devtools, per `memory/well-dipper-testing-reference.md`):**
  after warp, assert `system.star._billboard.visible === true` at the emergence
  crossing and post-coast; no AC4/AC5 warnings; approach leg completes.
  Eyeball: far-plane/fog behavior at R×550+ arrival distances, destination
  through the tunnel's far opening, supergiant case (large R).
- **UAT (Max's gate):** ride a starfield-targeted warp and a nav-comp warp;
  tune `window._warpArrivalMargin` if the felt distance is off; confirmed
  margin gets baked.

## Risks

- AC5 emergence gate + `parkBackDepth` key off Portal-B distance, not star
  distance — believed orthogonal; verified live anyway.
- Supergiants put arrival in the thousands of units; verify nothing at that
  range misbehaves (far plane, fog, planet billboard rendering).
