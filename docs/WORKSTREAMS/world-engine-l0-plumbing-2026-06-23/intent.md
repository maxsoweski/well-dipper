# world-engine-l0-plumbing-2026-06-23 — intent

WS1 of the production-L1 port (lab-only; see `docs/FEATURES/world-engine-production-L1-plan.md`).
Branch: `feature/world-engine-production-L1`.

## Why we care

> The boundary between L0 (the galaxy generator) and the world-engine is *broken*, not just thin.
> The drivers that would let the engines write a body's history are dead or thrown away before
> anything can use them — tidal heating is hard-zeroed, eccentricity is never computed, the system
> graph (siblings, moons, resonances) is hidden from the body. So the engine stack is starved before
> it starts. WS1 lays the foundation so the categorical divergence we proved in the lab can be driven
> by *real physics*, not stubs. Nothing downstream is real until this is.

(Max confirmed this as his felt motivation, 2026-06-23.)

WS1's job is to make the drivers **real** (computed from physics, exposed, tested correct). WS2's base
step makes them **load-bearing** (consumes them to drive relief, lab-side). Splitting it this way keeps
the foundation zero-regression: re-wiring tidal heating into the legacy `computeSurfaceHistory` now
would change the *deferred game renderer*, not feed the L1 engines — so WS1 stays strictly additive.
(Max delegated the D12 call with the criterion "whatever most straightforwardly makes this truly
programmatic"; additive + WS2-consumes is that path under the lab-only decision.)

## Success criteria (Max's language)

- **Tidal heating is a real number, not zero.** A moon or planet that should be cooked by tides
  actually reports it; a cold, lonely world reports basically none — and that's true for *moons* too,
  which were just as dead.
- **Every world has a real orbital eccentricity.** It never did before. Same seed always gives the same
  number. We're only computing and exposing it for now — orbits don't visibly change yet.
- **A world's magnetic field is available on the world**, and it's the *same* number the aurora already
  uses — computed once, not twice and thrown away.
- **A world's age and its system's metallicity are available on the world** (they were computed and dropped).
- **From any world you can see its place in the system** — its siblings, its own moons, who it's in
  resonance with, its companion star — and reading that doesn't break saving/loading.
- **Nothing that renders today looks any different.** Same seed, same picture — we only *added*
  information, we didn't change behavior.
