# Round 01 — complete

Created and verified all outputs after **6 geometry review passes**.

- **2,864 triangles:** 2,034 exterior + 830 cockpit.
- **22 meshes**, Eye_Point, **13 materials**; seven UV-mapped display faces.
- **18.060 m long**; glass width **2.600 m**; eye height **1.200 m**.
- Pilot view **66.29% open**, 0.38 percentage points below exactly two-thirds, accepted under the brief’s approximate threshold.
- Fresh GLB re-import dimensions match; required nodes present.
- Nine **960×540** renders; game preview verified as exact 3× nearest-neighbour pixels.

Full measurements, material colours, visible checks, decisions and loop log: [report.md](/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/report.md).

## Decisions
- Accepted sheets and 13 specified materials override the older canon’s material budget.
- Used 7.9 m width and 9.8 m height to reconcile inconsistent reference projections while preserving fixed length and glass width.
- Used two broad intersecting yellow lobes and one orange dorsal lobe with flat facets.
- Placed the single hatch on the port side, visible in the required review views.
- Centred the origin using an additive equal-density closed-part volume proxy; intersecting component volumes are counted additively.
- Eye_Point uses camera convention: local -Z points along Blender +Y.
- Accepted 66.29% open view under the approximate two-thirds requirement, with the exact difference disclosed.
- Kept all seven displays blank and without textures or emission.
- Used scene-linear background values with Standard colour management; all final renders use the re-imported GLB.
- Combined exterior cream rails and glass in Bubble_MAIN; retained interior pillars and beam in Cockpit_Frame.

## Artifacts
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.glb` — Unified exterior and cockpit GLB
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.blend` — Editable named-part Blender model
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-34.png` — Three-quarter render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-top.png` — Top render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-side.png` — Side render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-rear.png` — Rear render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-front.png` — Front render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-pilot.png` — Pilot view at Eye_Point
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-chase.png` — Chase view
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-34-game.png` — 320×180 render upscaled 3× with nearest-neighbour
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship-silhouette.png` — Black silhouette on white
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-pass-1.png` — Pass 1 reference comparison
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-pass-2.png` — Pass 2 reference comparison
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-pass-3.png` — Pass 3 reference comparison
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-pass-4.png` — Pass 4 reference comparison
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-pass-5.png` — Pass 5 reference comparison
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-pass-6.png` — Final reference comparison
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-pass-1/metrics.json` — Pass 1 measurements
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-pass-2/metrics.json` — Pass 2 measurements
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-pass-3/metrics.json` — Pass 3 measurements
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-pass-4/metrics.json` — Pass 4 measurements
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review-pass-5/metrics.json` — Pass 5 measurements
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/metrics.json` — Final Blender and re-import measurements
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/audit.json` — GLB, material, UV and image audit
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/build_ship.py` — Model and render script
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/review_images.py` — Nearest-neighbour upscale and comparison script
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/finalize_ship.py` — Audit and temporary-file cleanup script
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/report.md` — Acceptance report and six-pass loop log
