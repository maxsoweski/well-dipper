# Round 03 — complete

Round 03 completed with four review passes.

- **Head:** bubble overhang reduced from 1.000 m to 0.000 m; roof meets the blunt head’s underside.
- **Layers:** three broad flank lenses added; spine, aft lobes and six undercarriage modules preserved.
- **Engines:** projecting rims removed; carrier recessed 0.200 m, nozzle interiors recessed another 0.180–0.400 m.
- **Budget:** 2,898 triangles — 2,140 exterior + 758 cockpit; 36 meshes plus Eye_Point; 13 materials.
- **Scale:** 18.000 m length; 2.600 m bubble width; eye 1.200 m above floor.
- **Preservation:** cockpit geometry relative to Eye_Point unchanged within 0.000001 m; pilot view remains 67.316% open.
- **Validation:** GLB re-import dimensions match exactly; required nodes and seven UV faces pass. All nine required renders exist. All 28 listed artifacts verified.

Full acceptance measurements, object/material tables and per-pass differences are in report.md. Before/after comparison places Round 02 left and Round 03 right.

## Decisions
- Used three symmetric intersecting lens layers and paired shoulder domes.
- Moved the complete cockpit 0.100 m aft before recentering; preserved every cockpit mesh relative to Eye_Point.
- Extended the blunt head over the bubble, keeping the overall length exactly 18 m.
- Built coplanar engine mouths with inward bevels and recessed dark wells.
- Mounted the red hatches on the flat rear undercarriage modules, following the exterior concept, after conforming flank patches intersected the new lenses.
- Retained the uniform-density, 0.25 m voxel-union estimate for centre of mass.
- Archived Round 02 deliverables and this round’s intermediate renders while retaining directly accessible comparison sheets.

## Artifacts
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.glb` — Final validated model
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.blend` — Editable Blender model with preserved scenes and hidden guide
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-34.png` — ¾ render from re-imported GLB
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-top.png` — Top render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-side.png` — Side render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-rear.png` — Rear render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-front.png` — Front render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-pilot.png` — Pilot render from re-imported GLB
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-chase.png` — Chase render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-34-game.png` — 320×180 render enlarged exactly 3×
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-silhouette.png` — Black silhouette on white
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/report.md` — Acceptance report and four-pass Loop log
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/audit.json` — Blender geometry and re-import audit
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/metrics.json` — Independent GLB probe and preservation measurements
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/manifest.json` — Artifact sizes and SHA-256 hashes
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-r03-pass1.png` — First reference comparison
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-r03-pass2.png` — Second reference comparison
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-r03-pass3.png` — Third reference comparison
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-r03-pass4.png` — Final reference comparison
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/round03-before-after.png` — Before/after side, rear and ¾ comparison
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-r03-images.zip` — 25 intermediate and baseline review images
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/round02-baseline.zip` — 15 preserved Round 02 files
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/round03-baseline.json` — Baseline geometry and transforms
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/revise_round03.py` — Exterior revision script
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/finalize_round03.py` — Consolidation, audit and export script
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review_round03.py` — Comparison-sheet and image utilities
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/verify_render_round03.py` — Re-import and final rendering script
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/probe_round03.py` — Independent GLB validation script
