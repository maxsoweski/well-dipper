# warp-tunnel-frame-reanchor — intent

## Why we care

When you warp, sometimes the screen goes black during the HYPER phase instead of
showing the warp tunnel. It's intermittent — repeat warps in a session and warps
to far-away targets are the ones that break — which makes it feel unreliable and
unpredictable, the opposite of what a jump should feel like. The warp is one of
the signature moments of the game; it going dark at random undercuts trust in the
whole travel loop. We want warping to render the tunnel **every time**.

## What's actually wrong (one defect, two faces)

The warp tunnel is anchored to the camera **once** (at `open()` / re-anchor), in
whatever coordinate frame exists at that instant. The frame then shifts *under* it
during HYPER from three sources, and the tunnel tracks none of them, so it orphans
(left ~teleport-distance behind the camera) → black:

- **Face A (swap teleport):** the system-swap teleports the camera ~2800u. Was only
  re-anchored on the geometric portal-crossing path, not the 0.15s HYPER fallback
  timer path. **Fix already applied in the working tree** (re-anchor moved into
  `onSwapSystem` so every swap path re-anchors) — this workstream *keeps* it, does
  not re-litigate it.
- **Face B (rebase / reset):** a per-frame `maybeRebase` (far targets → intermittent)
  or `resetWorldOrigin()` (which cc917c2 now calls on swap, and which does **not**
  even notify `onRebase` listeners) shifts the render frame mid-HYPER. The tunnel,
  anchored once, doesn't move with it. **Not yet fixed** — this is the deeper, RNG-
  intermittent half.

Unifying description: **the warp tunnel is not re-anchored when the coordinate frame
changes under it.** Face A's fix is one special case of that.

## Entanglement (made explicit)

The Face-B fix touches the world-origin system whose most recent change `cc917c2`
(`fix(world-origin): wire resetWorldOrigin() into spawnSystem`) is in master but
**pending Max's UAT**. cc917c2 is linear in `master` history (not a side branch), so
there's no branching decision — this workstream extends master as it stands, and
verifying it also exercises cc917c2's reset-on-swap. Max greenlit deciding the exact
re-anchor mechanism (continuous re-anchor vs. listener vs. body-rewrite) at
implementation time; working-Claude reports which and why.

## Success criteria (plain user-experience terms)

- Warping never shows a black screen during HYPER — the tunnel mesh is visibly
  rendering on every warp, including repeat warps in the same session and warps to
  far-away targets.
- The clean single warp from Sol still renders the tunnel (no regression on the path
  that already worked).
- Because the bug is intermittent, "fixed" means the repeat-warp regression suite
  passes **reliably across many consecutive runs**, not green once.
- The post-arrival fly-back portal and the warp-landing-strip still behave.
