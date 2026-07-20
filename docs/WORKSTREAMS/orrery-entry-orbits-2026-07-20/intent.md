# orrery-entry-orbits-2026-07-20 — intent

## Why we care

Max queued three ORRERY items after UAT round 2c (2026-07-20). The through-line: how you *enter*
and *read* a system in ORRERY. His words:

1. **Boot skip:** "We need a way to skip through the title screen and get to a default system
   (Sol seems the right candidate) whether we choose orrery or helm at the start; maybe holding
   D then selecting should skip to that system in the chosen mode." Interview pin: the driver is
   **dev iteration speed** — Max and agent drives re-enter the game constantly and the boot
   ceremony is friction. A blunt shortcut is fine; discoverability/polish is a non-goal.

2. **Zoom-IN arrival:** "When we warp to a new system in Orrery mode, currently we teleport in
   front of the star, then quickly zoom out to the overhead view; that overhead view is good but
   I want to arrive there via a zoom in rather than zoom out: I want to arrive in the new system
   far enough away from the star such that the star is a billboard and the planets are not
   visible yet, then quickly zoom into that overhead view so that the orbits are visible."

3. **Orbit visibility:** "We need to increase the visibility threshhold of the orbits; they
   disappear closer to the camera than I would like; I want to be able to see the orbits so long
   as I'm close enough to the system that the planets no longer overlap with the star from our
   POV."

## Success criteria (Max's language + interview pins, 2026-07-20)

- **Holding D then selecting a mode at the chooser skips to Sol in the chosen mode** — skips
  *everything* (intro logos AND title); HELM-skip lands in the **normal HELM post-boot state**
  (the skip removes ceremony, never changes mode semantics); ORRERY-skip arrives via the new
  zoom-in arrival. Without D held, the normal boot is untouched.
- **Every ORRERY system entry arrives via zoom IN, not out** — all entry paths (nav warp,
  bg-star+Space warp, instant-cut viewSystem, the new boot skip): spawn far enough that the star
  is a billboard and no planets are distinct yet, then quickly zoom in to the existing overhead
  overview so that the orbits are visible. Pacing ~quick (≈1s), tuned at Max's UAT.
- **Orbits are visible so long as planets no longer overlap the star from our POV** — pinned as
  a screen-space rule (a planet's angular offset from the star and the star's physical size both
  shrink together with distance, so the operative disc is the star's *rendered glow billboard*,
  which is clamped to a minimum screen size): all planet orbits show together as soon as the
  **outermost** planet's screen offset clears the star's rendered glow disc (the generous
  reading — orbits visible from as far away as possible), with a **short fade** band instead of
  a pop. The arrival spawn distance sits **just beyond** this threshold, so the zoom-in crosses
  it and orbits fade in on the way to the overview.

## Structure pins

- ONE workstream for all three items (Max, 2026-07-20) — items 2+3 share the screen-space
  geometry; item 1's ORRERY path composes with item 2.
- orrery-coherence close-out: B5–B7 HELM blocks run at the SAME UAT sitting as this workstream's
  UAT; both ship together — one Rule-3 pass, one real merge (master carries lane C), one
  push/deploy.
- First build step for item 3: reproduce and locate today's actual vanish mechanism (no explicit
  camera-distance fade exists in main.js orbit code — suspect raw pixel coverage of thin lines
  or the retroRenderer/downsample layer) BEFORE designing the fix.
