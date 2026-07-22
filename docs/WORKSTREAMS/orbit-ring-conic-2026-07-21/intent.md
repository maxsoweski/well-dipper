# orbit-ring-conic-2026-07-21 — intent

## Why we care

Max, at orrery-entry-orbits UAT round 3: **"This fix reeks of a patch on top of an
unresolved issue. Let's handoff to a fresh session, where I want you to dig in and
look at the code critically."** Plus the new finding: **"I'm seeing some flickering
happen on far-away orbits when we are close to the orbit's plane."**

The dig (2026-07-21, `orrery-entry-orbits-2026-07-20/evidence/dig-record.md`)
confirmed the suspicion: the proximity fade is regime-avoidance, and the shipped
plane-domain band math has a dead zone — within ~3–6° of the orbit plane at
mid-range, rings render zero pixels where the old LineLoop drew a solid line.
Max's flicker is the dead-zone boundary crossing under camera drift.

Orbit rings are the ORRERY's primary nav read (flight-reliability / ORRERY-coherence
arc). A ring render that silently vanishes near the plane breaks the read the mode
exists to give. Max greenlit the structural fix over another patch: **"okay, let's
go with your rec for next action"** — the rec being the screen-space conic +
Sampson-distance render, proven in the 4-mode lab.

## Success criteria (Max's language)

- The flickering on far-away orbits when we are close to the orbit's plane is gone.
- No dead zone: wherever the old LineLoop drew a solid line, the ring renders.
- Standing at or near a ring (fade off) shows a clean stable line — no tearing or
  blotches. The proximity fade stays as shipped UX.
- The chunky retro overview look is preserved (ratified pin; Max's eye at UAT —
  expectation pre-set: gentle-angle band paints slightly wider, overview center
  cluster reads as a dot rather than a square).
- Nothing that renders today vanishes (zero anti-vanish regressions on the ladder).
- Ring-vs-planet occlusion keeps working (shipped round-2 win).
- Every ring behavior works exactly as today: hover picking + highlight, per-ring
  colors, visibility fade, prox fade, moon-ring motion, dispose.
- At extreme range, rings fade by angular size — no persistent sub-pixel dots
  (Max ratified 2026-07-21, over AC3-fade-only and keep-the-dots).
- One fullscreen pass replaces the 39 per-ring quads; performance not worse.
