# multistar-component-travel-2026-07-21 — intent

Increment B of the multi-star program (feasibility report §3.2/§6; successor to
`multistar-components-2026-07-19`, whose substrate + drill-in view this builds on).
JOURNEY: real-universe navigability. PLAYER_EXPERIENCE: exploration/flight tier.

## Why we care

Max, 2026-07-21, verbatim:

> "I want the triple traversable without having to warp. I want to be able to
> warp-arrive at any one of the triple, but because they all share a center, I
> want to, from there, be able to navigate to any of the three in-system."

## Success criteria (Max's language)

- "I select Proxima in PRISM, this transitions to Proxima's SYSTEM nav screen.
  I select WARP, and end up in front of PROXIMA." *(Interview ruling 2026-07-21:
  component-addressable warp arrival — supersedes D2's "warp always lands at the
  primary" clause; identity stays ONE system.)*
- "I hit O, toggling on the orbits. I see not only the orbits of the planets
  circling Proxima, but I see Proxima itself is strung on its own orbit. That
  orbit is so huge, it will probably seem like just a straight line."
- "I check the nav SYSTEM screen and see Proxima is part of a larger system.
  I select one of the other two stars, hit BURN, and begin travelling toward
  the binary pair Proxima orbits."
- Supercruise leg time: "more like... 3 minutes to get from one star to the
  other" *(ruled: raise the fixed deep-space ceiling CAP_MAX ~20,000 → ~75,000
  u/s; α Cen ≈ 3 min, other authored multiples ≈ 1 min)*.
- ORRERY: "I can just keep scrolling out instead once I see Proxima is itself
  in orbit around another gravity well: I scroll out (logarithmically, I guess)
  until I see the whole orbit, and the open brackets representing the binary
  pair at the center of that orbit. From there, I can just click on one of
  those in the pair (whichever is closer will assert itself, I assume), and
  the camera flies over to it like any other object in ORRERY."
- "Both ORRERY and HELM should be navigable via the system nav screen … for now
  it's enough if there's a path to select the far-away star or planet in the
  system nav screen and select 'burn', then have us go there in either autopilot
  via HELM or the regular quick fly-to in ORRERY."
- "We need to make sure that everything we're doing is being accurately
  reflected in the starfield of nearby systems. Dunno if we've checked on that
  function at any point while doing this nav system rework." *(→ audit-first AC.)*

## Interview rulings (2026-07-21)

- **Warp arrival = component-addressable** (supersedes D2's primary-only clause;
  amends NAMING_AND_REAL_OBJECTS.md §6 wording + the AC7/grammar test pins that
  hard-coded primary arrival). One-system IDENTITY invariant unchanged.
- **D3 = real supercruise** (not the pocket fold). Mechanism consequence: mid-leg
  scene handover between component neighborhoods, visually free by construction
  (at the midpoint every body in both neighborhoods is sub-pixel).
- **Throttle = fixed-ceiling raise** (CAP_MAX ~75,000 u/s; exact value lane-B
  live tuning). In-system feel untouched (distance-proportional cap governs
  below ~225 AU).
- **Procgen wide binaries OUT** — later workstream riding this architecture
  (standing 2026-06-04 intent).
- **Size-limit finding (for the record):** component separation ceiling ≈ 0.1 pc
  ≈ 20,000 AU — the F1 seed-bin identity limit, not a rendering limit.

## Build gates

Scoped joint-lane (B+C surfaces both in scope). Build starts only after:
(1) Max greenlights this contract; (2) lane B's in-flight branch lands
(orrery follow-up; DEPART is `building` and its radial-climb departure +
ETA-decel arrival are the BURN leg's two endpoint behaviors).
