# Checkpoint — after round 01

## artifact versions

## invariants
- Read-only review; no files written.
- Lab and game must exercise the same production rendering path.
- Inside, edge, and exterior galaxy views remain required.
- History drives appearance; sky and navigation share spatial data and medium definitions.

## accepted decisions

## rejected approaches
- Treating 0.4 light-years as a universal handoff distance.
- Treating inside rendering as a uniform tint.
- Scanning every catalog feature at every ray sample.
- Assuming the active warp path crossfades endpoint skies.
- Using shared GLSL imports alone as proof of lab/game parity.

## unresolved
- Measured GPU budgets on Max's hardware.
- Final L/T storage and distance-aware star-extinction implementation.
- Catalog completeness and deterministic candidate overflow policy.
- History units and known-object override precedence.
- Bake timeout and fallback behavior at portal emergence.

## next action
Revise the plan around the five ranked changes, then scope S1a with the proposed numerical and lifecycle gates.
