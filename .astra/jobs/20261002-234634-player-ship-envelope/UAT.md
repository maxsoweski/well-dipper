# UAT — player-ship-envelope (coarse volume study, variants A/B), round 01

Review page: https://claude.ai/artifact/9b2gLE86hupgbSuzBiLPN3 (items "Rough shape A" / "Rough shape B").
Files: `C:\Users\Max\Documents\Blender\astra\well-dipper-trunk\player-ship\envelope\`

## CC review (probe = independent `glb_info.py`, agrees with Astra's report)
| check | A | B |
|---|---|---|
| Envelope ~18.0 × ~11.0 H × ~10.4 W m | PASS 18.03 × 10.90 × 10.40 | PASS same |
| Triangles ≤ 1,500 | PASS 1,450 | PASS 1,450 |
| Materials = 7 named slots, 0 textures/cameras/lights | PASS | PASS |
| Bubble outer width | 5.10 m (needs contract change) | 2.95 m (inside 1.8–3.0) |
| Outline overlap with r10 (IoU, same method as rounds 02/03) | side 0.87, front 0.91 | side 0.88, front 0.91 |
| — for comparison: round 02 / round 03 | side 0.75 / 0.76, front 0.73 / 0.77 | |
| Simple gates by eye | no stacked discs; modules tucked, no stalks; engines inside the rear outline | same |
| Seen and flagged | a flat vertical slab at the rear (engine surround) stands proud of r10's rounded rear lobe in the side overlay; the ¾ view still reads as a faceted wedge — shell overlaps are not yet visible at this coarseness | same |
Outline overlap measures the outline only, not the internal lines; it is a guide, not a pass gate. Max judges.

## Max's verdict
(pending)
