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
