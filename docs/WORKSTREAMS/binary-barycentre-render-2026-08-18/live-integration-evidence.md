# Live integration evidence — `52031fd`, wd-10, 2026-08-18

Driven by working-Claude via chrome-devtools against the running game. **Integration, not UAT** —
these are objective assertions with right answers. The holistic "does it read as a pair" judgment
is Max's alone and is not recorded here.

## AC-SEPARATION — PASS

Drawn separation `|moon mesh − planet mesh|` against each record's `orbitRadiusScene`, all five
planets of wd-10:

| planet | moons | max error |
|---|---:|---:|
| 1, 2, 3, 4 | 6 total | **0** |

The companion at planet 3 measures **1.151999** scene units — the full `a`, 25.1 primary radii.
Not `a/(1+q)` = 0.898. Scoping §3's Convention-B trap is not present.

## AC-WOBBLE — PASS, on §9's prediction

Barycentre recovered from the live meshes (`B = P + (q/(1+q))·(M − P)`), not from the code under test:

| | predicted §9 | **measured live** |
|---|---:|---:|
| primary about the empty point `r1/R_p` | 5.53 | **5.5332** |
| companion `r2/R_p` | 19.55 | **19.5492** |
| sum (= `a/R_p`) | 25.1 | 25.08 |

wd-10's other planets wobble 0.011 / 0.0026 / 0.007 R_p — present, and invisible, as intended.

## AC-PAIR-RINGS — PASS, both branches

All 16 ring proxies on layer 10 enumerated and accounted for, by distance to each planet:

| rings | where | reading |
|---:|---|---|
| 7 | at the star | heliocentric planet + belt rings, unchanged |
| 2 | planet 1's barycentre (0.011 R_p off the planet) | dominated → barycentric |
| 2 | planet 2's barycentre (0.003 R_p) | dominated → barycentric |
| **2** | **planet 3's barycentre (5.533 R_p off the planet)** | **the pair** |
| 3 | glued to planet 4 (0.000 R_p) | 3 moons, undominated → planet-following |

⭐ Zero unaccounted proxies, so the extra ring is not leaking a ring per spawn.

**Screen check** (working-Claude's gate only — two rings vs one, not whether it *reads* right):
two concentric circles about a point with **no body at it**, `MEAMEINATH` sitting on the inner
one. The satellite read — one ring centred on the primary — is gone.

## AC-FLIGHT-STILL-WORKS — PARTIAL

Verified: both bodies resolve and select, every drawn coordinate is finite, the primary sits off
the `y = 0` plane, and the console holds **zero errors or warnings** since navigation.
⛔ **NOT verified live:** an autopilot run to each member, and `dominantBodyAt` near the companion.

## AC-LIGHTING-AND-MOONS-FOLLOW — PARTIAL

Verified: moons follow the moved primary exactly (AC-SEPARATION), and the primary renders lit.
⛔ **NOT verified live: the binary-STAR arm.** wd-10 is single-star, so `_lightDir2` and the
two-star terminator were never exercised. That arm needs a binary-star seed before this closes.
