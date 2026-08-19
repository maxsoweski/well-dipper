# orbit-line-local-system-occlusion-2026-08-18 — intent

## Why we care

The barycentre render shipped and the pair reads as a pair. Max's UAT, same breath:

> *"the two concentric orbit lines intersect with the larger orbit line they ride around the star;
> I'd like the larger orbit line to not cut into the binary planets' orbits; I'd like it to be kind
> of like how orbit lines do not go inside of planets/moons; I'm not sure what the word is here when
> a line does not intersect with another, but treats it like a solid object."*

The word is **occlusion**. In draughting the crossing convention is a *line hop* or *bridge* — but
what he asked for is not a hop. He asked for the local system to be **solid**: the star-orbit line
goes behind it and does not reappear until it is past.

⛔ **The thing he is comparing it to is not the same mechanism.** Orbit lines already stop at planets
and moons because the depth buffer hides them behind solid geometry — that is free. A ring has no
solid geometry to hide behind. Line-on-line occlusion has to be authored, in the shader, and there
is exactly one place ring pixels come from.

The problem is not cosmetic at the pair specifically: a planet's heliocentric ring passes straight
through its own local system by construction, so the line cuts every moon system in the game. The
binary pair is simply the first place the crossing became legible, because it is the first place
there are two concentric local rings for it to cut across.

## Success criteria (Max's language)

- The larger orbit line **does not cut into** the binary planets' orbits. It stops at the edge of
  their local system and resumes on the other side — **one clean gap the full width of the disc**,
  not four small nicks at the crossing points (ruled 2026-08-18 against a side-by-side preview).
- It reads like the line is **going behind a solid object**, not like the line is broken or missing.
- Applies to **every** planet's local system, not just the pairs — Max's standing preference for the
  general answer over a special case, same as his no-mass-ratio-cutoff ruling on the wobble.
- Nothing that is currently visible stops being visible. In particular the pair's own **inner ring
  lies entirely inside its outer ring**, and it must survive.

## Deliberate non-goals

- No hop/bridge arc. He chose the solid read; an arc is a different convention and would look busy
  where a heliocentric ring grazes a local system tangentially.
- No change to which rings exist, their radii, or their centres. This workstream draws less, never
  differently.
- No revival of the camera-proximity fade, retired by Max's own UAT ruling 2026-08-01.
- No change to hover, click targets or hit-testing. A masked pixel is still a clickable ring.

## The constraint that makes this its own workstream

⛔ `docs/PARKING_LOT.md:239-241` — *"Do NOT touch `OrbitConicField.js` before then — it is the
renderer under UAT"* (Max, 2026-08-01, deferred until lane B's UAT shipped and the merge arc landed).
Both preconditions are now met and **Max lifted the hold explicitly on 2026-08-18**. The same entry
records that this area carries a real perf-architecture decision and *"warrants `dev-collab-scope`
before code"* — which is why this file exists.
