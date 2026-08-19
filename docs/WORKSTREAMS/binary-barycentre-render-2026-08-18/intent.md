# binary-barycentre-render-2026-08-18 — intent

## Why we care

B5.0 shipped the binary-companion generation channel and it generated correctly — right rate,
right coordinates, right mass ratio. Then it failed UAT on the first pair, first look. Max, parked
in the live game on `wd-10` planet 3 with both bodies lit:

> *"planet with a big moon **because the orbit lines center one planet in orbit around the other
> rather than both around a shared empty gravitational center**."*

The bodies are in the right places relative to each other. What is missing is the reflex: the
primary does not move. It is nailed to its orbital point while the companion swings around it, and
one orbit ring is drawn centred on the primary. That is the satellite read, and it is the whole
difference between *binaries exist* and *binaries read as binaries*.

The generation half of this lane is already paid for. Without this, it buys nothing Max can see.

⭐ **The missing term was never only a binary problem.** Measured over FENCE-221 at `34b502d`:
16 non-companion moon/parent pairs already have their barycentre outside the primary's surface
(worst `wd-133/4/3`, `r1/R_p = 9.618`), and 111 more swing at least a tenth of the primary's own
radius. Every one of them is drawn today with the primary pinned in place. Max ruled the term
applies to **every moon, with no mass-ratio cutoff** — physics-honest, no special case, and no
flag on the record (which B5.0 deliberately did not ship, and which PLAN:37 forbids anyway).

## Success criteria (Max's language)

- The pair reads as a pair: **both bodies orbit a shared empty gravitational center**, rather than
  one planet centred in orbit around the other.
- **Two orbit lines around that empty point**, not one line centred on the primary.
- The primary visibly moves. On `wd-10` planet 3 it should circle a point five and a half of its
  own radii away, instead of sitting still.
- The bodies stay exactly as far apart as they are generated — the pair does not get drawn
  half-size, and nothing lands off its own orbit line.
- Everything that already worked at that planet still works: the lighting, the other moons, flying
  there, the game not looking different in ways nobody asked for.
- ⚠ It moves planets Max has already flown to. Those need their own look before this ships.

## Deliberate non-goals (recorded so they are not discovered at UAT a second time)

- No barycentre marker, glyph or label at the empty point — the two rings carry the read.
- No pair-aware naming. The companion still ships as `Meameinath I`; that question is carried and
  unruled (handoff §8 item 2) and is deliberately judged *after* this, not before.
- No nav-computer / minimap representation. Nothing on that screen moves at all yet, for planets
  or moons, and that is the nav-screen rework.
- No eccentricity. Orbits stay circular; only the **y** term (moon inclination) is newly allowed to
  move a planet off the `y = 0` plane, because the barycentre genuinely sits off it.
- No mutual-Hill SOI, no bracket-range parity, no click precedence. Those are gravity/UI seams and
  this workstream moves where a body is *drawn*.
