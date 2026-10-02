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
