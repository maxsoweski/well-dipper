# Round 02 — complete

Completed retopology and six review passes.

- **2,850 triangles:** 2,092 exterior + 758 cockpit; 150 below ceiling.
- **34 meshes + Eye_Point**, exactly 13 materials; no textures, cameras or lights in GLB.
- **Dimensions:** 11.580 × 18.024 × 10.789 m, Blender X/Y/Z.
- **Bubble width:** 2.600 m; glTF Z range −11.788 to −8.888 m.
- **Eye_Point:** (0, 9.788, −3.805) m; 1.200 m above floor.
- **Open pilot view:** 67.316%, measured with 57,600 rays.
- Seven display UV maps verified; flat normals and exterior symmetry verified.
- Fresh re-import passed; maximum dimensional difference 0.000000477 m. Temporary scene deleted.
- All nine required PNGs verified at 960×540; game image verified as exact nearest-neighbour 3× enlargement.
- Exterior, cockpit, scale and silhouette checks: **PASS by agent inspection**. Max’s approval is not claimed.

Full part counts, material colours, decisions and loop log: [report.md](/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/report.md).

## Decisions
- Built clean intersecting forms fitted to the sculpt’s views and envelope; performed no further decimation.
- Assigned the specified colours per named part.
- Used three supported underslung modules per side, including a long aft pod.
- Mirrored exterior hatches and ports exactly; retained asymmetric cockpit screens.
- Used a uniform solid-envelope estimate on a 0.25 m voxel grid to place the centre of mass at the origin.
- Kept the numeric 2.6 m bubble width despite the larger generated cockpit region.
- Compensated the exporter’s V inversion so delivered display UVs increase upward.
- Preserved the original and guide scenes in the blend; exported only the selected active-scene asset.

## Artifacts
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.glb` — Validated ship and cockpit asset.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.blend` — Authoring model with named parts and separate hidden guide scene.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-34.png` — Re-imported GLB three-quarter render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-top.png` — Orthographic top render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-side.png` — Orthographic side render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-rear.png` — Orthographic rear render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-front.png` — Orthographic front render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-pilot.png` — Re-imported cockpit at Eye_Point, 70° vertical FOV.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-chase.png` — Chase camera render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-34-game.png` — 320×180 render enlarged exactly 3×.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-silhouette.png` — Black silhouette on white.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-r02-pass1.png` — Pass 1 comparison against references.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-r02-pass2.png` — Pass 2 comparison against references.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-r02-pass3.png` — Pass 3 comparison against references.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-r02-pass4.png` — Pass 4 comparison against references.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-r02-pass5.png` — Pass 5 comparison against references.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-r02-pass6.png` — Final re-imported model comparison.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-r02-images.zip` — 36 archived intermediate renders, including final game-resolution source.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/retopo_ship.py` — Clean geometry construction script.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/finalize_retopo.py` — Part consolidation, symmetry, centring and export script.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/render_ship.py` — Render and camera configuration.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review_ship.py` — Comparison-sheet and nearest-neighbour image assembly.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/verify_render_ship.py` — Fresh re-import validation, final rendering and temporary-scene cleanup.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/probe_ship.py` — Independent GLB validation script.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/audit.json` — Blender measurements and re-import results.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/metrics.json` — Independent GLB and image measurements.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/report.md` — Complete acceptance report and six-pass loop log.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/manifest.json` — Verified file sizes and SHA-256 hashes.
