# warp-tunnel-pocket-traversal — intent

## Why we care

The warp is one of the signature moments of the game — it should feel like a real
jump through a hole in space, not a loading screen. Two things were wrong: the
tunnel went **black** at random during HYPER (especially on repeat warps and far
targets), and the pin-to-camera fix that stopped the black screen (`4285602`)
**broke the choreography** — wrong entry angle, looking backward inside, no sense
of emerging (Max UAT failed 2026-06-06). We want the whole journey to feel right:
approach a hole, fly into it, travel a space that feels long, emerge out the far
hole into the new system — reliably, every time.

## Max's design direction (verbatim)

> "Cheat the scale. The tunnel does not have to be as big as a system — make it
> relatively small and make the player's speed through it such that it seems long.
> I want the tunnel to appear as a hole in space on both ends, and a physical space
> you're moving into and out of."

Two sub-decisions Max made: the camera is **on-rails with slight drift** (piloted
feel, fixed forward-facing); HYPER duration is **load-adaptive** — a minimum
cruise, but emergence waits until the destination is ready so a slow load extends
the cruise instead of dumping you into a half-loaded system.

The mechanism: the tunnel stops living in microscopic system-space and becomes its
own human-scale pocket (~60u, lab-proven in `portal-traversal-lab.html`) that the
camera physically flies through — into Portal A's hole, through a real interior,
out Portal B's hole. Full design: `docs/superpowers/specs/2026-06-06-warp-tunnel-pocket-traversal-design.md`.

## Success criteria (Max's language)

- Every warp renders the tunnel during HYPER — no black screen — including repeat
  warps in the same session and warps to far targets.
- You fly **into** a hole in space (Portal A), not snap into a forced "inside".
- You travel a real interior that reads as long — moving forward, facing forward,
  never looking backward.
- You emerge **out** the far hole (Portal B) into the new system — a felt
  threshold, not a freeze-then-snap.
- A slow background load extends the cruise rather than emerging into a
  half-loaded system.
- The whole thing reads as into-hole → travel → out-of-hole. (Max's gate alone.)

## Arrival polish (2026-06-07 amendment — verbatim)

> "I want the tunnel and portal ring to be **stationary in the new system** once you
> enter it (with the plan that it would **'close' and disappear after a few seconds**,
> only visible at all if the player turns and **freelooks behind them** as they exit
> into the new system)."

Decomposed into observable success criteria (Max's language):

- When I arrive, I've **flown out through the portal** — the tunnel and portal ring are
  *behind* me, sitting still where I came out. They don't follow me or drag around the system.
- If I turn / freelook behind me during the exit, I **see** the tunnel and portal ring there.
- They **close** — shrink and fade — over a few seconds, then disappear (the tunnel stays
  visible *while* it's closing, not yanked away the instant I arrive).
- The arrival **doesn't freeze** and **doesn't teleport-snap** — one continuous flight from
  the tunnel into the new system.

### What the live diagnosis settled (so we don't over-build)

Driving a real warp Sol→Shudpis (GPU 9223, 2026-06-07) measured the three felt faults and
their causes — and ruled out the heavier "Approach C" (no-teleport rebase inversion):

- **"Freeze"** = a single **324ms frame on first-render of the spawned system** (GPU
  shader/material compile), not a coordinate jump. Fix: pre-compile during HYPER (AC9). This
  cost is identical whether the camera teleports or rebases, so the inversion buys nothing here.
- **"Teleport"** = a ~3150u camera jump that is **fully occluded** (camera INSIDE the tunnel,
  walls up, the entire swap). Never visible → no inversion needed; guarded by AC10 so a future
  camera/movement change can't silently expose it.
- **"Disappear"** = the tunnel **force-hidden** + a **forced** `INSIDE→OUTSIDE_B` flip at
  onComplete (no real crossing) + the **per-frame portal-follow** dragging the ring. Fixed by
  the real emergence crossing (AC4 / Task 4) + stationary anchor (AC7) + close-tween (AC8).
