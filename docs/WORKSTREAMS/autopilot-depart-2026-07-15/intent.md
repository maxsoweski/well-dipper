# autopilot-depart-2026-07-15 — intent

**Orientation:** Well Dipper → SCREENSAVER heart (35%) → flight-reliability program →
inc-2 of the approved intelligent-tour spec; sibling B of the post-ship pair (sibling A =
orrery-coherence-2026-07-15). Roadmap sequence: Step 0 ✅ → mode-ownership ✅ →
**inc-2 DEPART ◀ this** → tangent-graph → inc-3.

## Why we care

Max's verbatim vision (the north star, quoted not paraphrased):

> "I want autopilot to become intelligent — understanding the mechanics such that it can
> give a dynamic tour of any given system; that will mean deciding how to get away from
> any body we're currently close to, then how to go toward the next body in the tour,
> until the whole system has been toured. And usually 'how to get away from' will mean
> orbiting the current body until the nose is pointed 'over the horizon' of the object
> and towards the next object."

The 2026-07-01 research pass confirmed this is the time-optimal policy, not just
aesthetics (Zermelo/Fermat speed-field geodesics bend away from slow regions; Elite's
two-phase mass-lock/escape-vector doctrine). The measured residuals all live exactly
where DEPART operates: the post-arrival crawl labyrinth, barrier pins, the boundary-start
keep-out dip, the tightest-moon-0 skip.

And the arrival complaint, twice on record — 2026-07-11: **"I'm noticing the 'tractor
beam' thing is still happening at the final approach to a system body; i thought we
fixed that."** At scope Max picked **physics deceleration** (ETA-scheduled braking that
culminates at the capture window) over keeping a masked lerp.

## Success criteria (Max's language + scope-session picks)

- Getting away from a body looks like his vision: the ship orbits the current body until
  the nose is pointed over the horizon toward the next object, then flies there.
- No more "tractor beam" at final approach — the ship brakes like a ship; no
  position-lerp arrivals anywhere (tour AND Assist).
- The tour actually arrives: ≥90% of legs end in an arrival (the carried-in Step-0 gate),
  zero livelock, measured by the same telemetry sampler that caught the original misses.
- A wedged/pinned ship never dwells long — bounded, visible recovery instead of the
  minutes-long carousel.

## Deliberate non-goals

- Tangent-graph transit routing over all keep-out spheres = the NEXT roadmap step, not
  this contract. DEPART + transit handoff only.
- The terminal crawl near the body being VISITED is the cinematic point — it stays.
- SC_TUNING is never touched; all speed shaping is pilot-layer throttle policy.
- Regime/UI/station work is sibling A's territory.
