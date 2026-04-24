# Workstream: Autopilot APPROACH → ORBIT velocity continuity (2026-04-22) — SUPERSEDED

## Status

`Superseded 2026-04-23 — see docs/WORKSTREAMS/autopilot-phase-transition-velocity-continuity-2026-04-23.md`.

## Why superseded

Director's diagnosis during WS 3 camera-axis retirement Shipped review
(2026-04-23, WS 3 Shipped at `b7699de`) found that the residual
departure + arrival jerks Max reported are pre-existing nav-layer
velocity-direction flips at **three seams**, not one:

1. **STATION → CRUISE** — orbit pull-out's final-25% radial growth vs
   Hermite's flat-tangent start (`NavigationSubsystem.js` line 606–607
   vs `_beginTravel` line 336+; crosses into `main.js` line 5934).
2. **TRAVEL → APPROACH** — Hermite's terminal tangent vs
   `_approachInitialDir` radial-in (`_updateTravel` line 813 /
   `_beginApproach` line 428+).
3. **APPROACH → ORBIT** — approach's near-zero radial terminal velocity
   vs orbit's frame-1 tangential velocity (`_updateApproach` line
   665–670 / `_beginOrbit` line 454+). **This brief's original scope.**

They share one class of bug (phase-transition velocity hand-off) and
one solution shape (velocity-blend-at-seam-boundaries). Fixing one
without the others is whack-a-mole.

Max greenlit the expansion 2026-04-23. The new brief at the path
below carries forward this brief's Candidate A / B / C articulation
for Seam 3 alongside the two new seams' candidates under a unified
fix pattern.

## Redirect

See **`docs/WORKSTREAMS/autopilot-phase-transition-velocity-continuity-2026-04-23.md`**
for:

- The three-seam scope statement.
- The unified velocity-blend fix pattern (helper + three seam
  consumers).
- Per-seam ACs (#1 / #2 / #3) and invariant ACs (shake no-regression,
  WS 3 camera-axis no-regression, telemetry-invariant coverage).
- The full revision history (including the 2026-04-22 → 2026-04-23
  expansion).

## Revision history

- **2026-04-22 — Drafted** by working-Claude in degraded PM-proxy
  mode (PM agent stream timeout). Single-seam scope (APPROACH →
  ORBIT only). Status `Drafted — pending Director audit`.
- **2026-04-23 — Superseded** by
  `autopilot-phase-transition-velocity-continuity-2026-04-23.md` per
  Director's three-seam diagnosis. Max greenlit.
