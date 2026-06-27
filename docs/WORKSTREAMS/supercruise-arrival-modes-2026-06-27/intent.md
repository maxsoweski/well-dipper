# Intent — Supercruise Arrival + Mode Restructure

## What we're building (Max's words, 2026-06-27)

"The next thing to develop will be what happens when we actually reach the planet."
Supercruise auto-propels you forward; you have to drop out to stop, and you can be
forced out by getting too close to a planet. Reuse the camera-shake system for FX on
entering/leaving supercruise. Restructure the modes:

- **Two separate buttons:** one to **start/end supercruise** (the drive), and one to
  **enter/exit the flight controls** (take the stick vs free-look). These are different
  buttons — that's the key realization.
- **Free-look = "let go of the flight controls":** you keep your speed/momentum, and if
  assist/autopilot is flying, it keeps flying — you just look around (click+drag). F
  again eases the camera back to center-on-nose.
- **Toybox mode** (separate, via menu/hotkey) = today's non-flight view: click+drag
  orbits the selected planet/moon, selecting another jumps you to it.
- **Autopilot = a subset of flight:** the system uses the flight controls to showcase
  the planets/moons — the default screensaver. The player can take a more active role
  via an **Assist** that lets you pick a destination (by aiming at it in free-look, or
  via the nav computer) and does all the throttle + piloting to get you there.
- Drop out at any time with the supercruise button. We already have the "safe to drop"
  indicator — make it act as guidance.

## Why we care

This finishes the supercruise *experience*. The flight system already moves the ship
(autopilot + manual, both shipped). What's missing is the **feel of arriving** and a
**mode model** that lets one flight system be both the screensaver (autopilot showcasing
bodies — the 35% milestone) and the player's craft (drop in/out, fly, look around — the
GAME-tier capability). It's the difference between "the ship moves" and "flying feels
like something."

## Success (Max's gate)

Max rides it and it reads right: E drops you in/out of supercruise cleanly (no snap),
F free-look feels good and keeps your momentum, reaching a planet feels like an arrival
(a jolt + you park), Assist takes you where you point/select, the autopilot still
showcases the system, and Toybox still lets you orbit-and-examine. Holistic — Max only.

## Deliberate non-goals

No blue-streak/whoosh/FOV render FX (camera-shake jolt only). No normal-space flight
model, combat, docking, or stations. No hull/damage/cooldown penalties (the gravity
well is the anti-clip wall). No min-speed floor. No world-origin rebasing. No
re-enabling NPC ships. Do not re-tune the scale-bug `SC_TUNING` floors.

## Design

Full design + acceptance criteria + file anchors:
`docs/superpowers/specs/2026-06-27-supercruise-arrival-modes-design.md`.
Supersedes the 2026-06-25 `F = ON/OFF` decision by splitting F into two toggles
(E = supercruise drive, F = free-look). Builds on `feature/supercruise-freelook`.
