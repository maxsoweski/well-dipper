# UAT — player-ship-cleanup (GPU road: Hunyuan3D sculpt → Astra retopology + cockpit build), round 02

GLB: `C:\Users\Max\Documents\Blender\astra\well-dipper-trunk\player-ship\player-ship.glb`
Comparisons: `...\player-ship\out\player-ship-model-v1-exterior.png`, `...-model-v1-cockpit.png`

## CC model review (probe = independent `glb_info.py`, agrees with Astra's report)
| check | result |
|---|---|
| Length 16–20 m (contract AC-ONE-MODEL) | PASS — 18.02 m (X 11.58 × Y 10.79 × Z 18.02 m, glTF) |
| Bubble 1.8–3.0 m wide | PASS — 2.60 m |
| Triangles ≤ 3,000 | PASS — 2,850 (2,092 exterior + 758 cockpit) |
| Materials = the 13 named slots | PASS |
| Textures 0, cameras 0, lights 0 | PASS |
| UVs only on the 7 display faces | PASS per report (probe: UVs present) |
| `Bubble_MAIN` forward, glTF z-centre negative | PASS — z −11.79 … −8.89 |
| `Eye_Point` inside the bubble | PASS — Blender (0, 9.79, −3.81); bubble spans Blender y 8.89–11.79; 1.20 m above cabin floor |
| Pilot view ≥ ~2/3 open glass | PASS — 67.3 % (Astra's ray count) |
| Exterior vs sheet r10 (simple gates) | PARTIAL — back half, spine ridge, lobes/domes, undercarriage, recessed nozzles read; FRONT drifts: the hull tapers to a long thin nose and the glass box sits ahead of it, where sheet r10 has a blunt low head with the bubble hanging beneath. The GPU sculpt's own front is low and tapered with ragged glass flaps, so the drift is inherited from the sculpt, not invented. |
| Cockpit vs cockpit sheet (simple gates) | PASS on layout (beam, wide SYSTEM, small TARGET on right pillar, gauge cutting into chevron bar, spares, post); frame reads pale grey-green through glass. |

## Max's verdict
(pending)

Max, 2026-10-02, on round 02, verbatim: "at least what I'm seeing of the outside, your call is right. That is a problem. Also, it's a bit too sleek. Like we've lost lots of the shapes of the kind of flat pancakes on the side and so on. And I'm noticing that the exhaust for the engines have protrusions when I want them to all be recessed."

## Round 03 (Max's round-2 notes) — CC review
Probe: 2,898 tris (2,140 + 758), 18.00 m, 13 materials, 0 textures/cameras/lights, `Bubble_MAIN` z −11.32 … −8.42.
Simple gates: pancake/lens layers now stack along both flanks (three per side) — PASS by eye; rear nozzles sit in dark
wells inside the grey carrier, nothing proud — PASS by eye; head: the bubble's roof now meets the underside of a flat,
blunt-ended head (overhang 1.0 → 0.0 m) — improved, but the head still reads as a long low platform ahead of the climb.
Max judges on the review page https://claude.ai/artifact/9b2gLE86hupgbSuzBiLPN3 (item "Round 2").
