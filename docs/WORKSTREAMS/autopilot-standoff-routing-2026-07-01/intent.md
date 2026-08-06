# autopilot-standoff-routing-2026-07-01 — intent

## Why we care

Max started the autopilot (Z) and watched it **"get stuck close to the sun, keeps
trying to select a new planet."** He wants it reworked so it can't happen. His own fix
idea: **"force the autopilot to never get close enough to a star where its movement
will be restricted."**

The unattended Orrery tour *is* the screensaver (the 35% SCREENSAVER milestone) — its
job is to run indefinitely and showcase the system. WS-1 stopped the *permanent*
freeze, but the ship still livelocks at the star: pinned at the collision barrier while
the tour index cycles. This increment is the reliable kill — keep the tour out of the
star's restricted zone, and route *around* the star when a target sits on its far side.
It's the fast, low-risk win; the deeper "orbit-to-horizon intelligence" is a later
increment built on top of this.

## Success criteria (Max's language)

- **The autopilot never gets stuck at the sun** — it can't sit pinned at the star
  cycling target selections.
- **It never gets close enough to a star that its movement gets restricted** — the tour
  never enters the deep gravity well where speed collapses / the ship pins.
- **When the next planet is on the far side of the star, the ship goes around the star**
  instead of wedging into it.
- **The star is still shown off** — visited from a comfortable distance, not skipped.
- **Normal legs that already work are unchanged** — no regression to legs that don't go
  near the star.
