# world-engine-atmo-derive-not-freeze-2026-07-15 — intent

## Why we care

Max's UAT on atmo #3b (2026-07-15): "these are generally good, and I'm glad to hear they're
being driven by the new system" — but the worlds don't re-roll. "The spots/storms appear in
the same place every seed"; polar vortices "always appear" and don't change shape/size/position
across seeds; the bands are "very regular, very much like belts." A procgen atmosphere that
lands the same layout every seed defeats the point of driving it from the World Engine.

This increment discharges the variety carve-out #3b declared (AC-0's frozen constants:
shellDepthFrac / internalHeat / dissipation become derived D-slots per ATMOSPHERE-PLAN §(e)),
and fixes the confirmed reseed-wiring gap: the New-planet button and macro-seed slider never
re-run the storm writer at all today.

Ruled at scope (Max, 2026-07-15): SPLIT — this variety increment first; ink-in-water
expression + phenomenon interaction (findings 2/3 + smooth-vs-jagged) is a separate follow-on
increment; lab legibility/provenance is the separate simultaneous `planet-lod-lab-ux` workstream
on L1. Canonical-N rider re-ruled: demoted from pin to regime-conditioned prior.

## Success criteria (Max's language)

- Storms stop appearing "in the same place every seed" — different seeds place them at
  different latitudes AND longitudes, including via the New-planet button and the macro-seed
  slider (today those reseed paths never re-place storms at all).
- Bands get "much more variety in placement, direction of movement" — not "very much like
  belts" every time. (Smooth-vs-jagged edge character belongs to the expression increment.)
- Polar vortices "change shape/size/position across seeds" and don't "always appear" —
  presence is per-seed, N varies around the regime prior (Saturn-likes stay hexagon-likely).
- The gate: "every re-roll seriously different."
