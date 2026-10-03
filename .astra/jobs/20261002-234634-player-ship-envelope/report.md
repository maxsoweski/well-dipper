# Round 02 — complete

**Technical checks passed.** B has 2,092 triangles, 17 objects and 10 materials. Bounds remain 18.025 × 10.900 × 10.400 m; bubble width remains 2.950 m. Largest mirrored vertex mismatch: **0.000000 m**; unmatched mirrored material triangles: **0**.

Delivered the rounded rear lip, clear carrier opening, two six-module keel rows, hanging cockpit, mirrored red hatches, and 20 shallow recesses with non-emissive `engine_glow` backs. All 20 backs passed visibility checks; rear-opening probes found 0 yellow obstructions in 353 samples. All nine A files and A’s geometry signature remain unchanged.

**Remaining differences:** ports and rounded surfaces remain faceted; port centres were adjusted locally to exposed hull faces. Previously accepted shell-profile differences from r10 remain. Details and three review passes are documented in report.md.

**Approval:** ready for Max’s visual review; no new approval is claimed.

## Decisions
- Triangulated one half and explicitly mirrored material-tagged triangles, including ports, hatches and cockpit facets.
- Used six thinner modules per side, leaving a 5.15 m minimum centre gap and retaining the previous lowest height.
- Kept the bubble’s dimensions and placement; shortened the head so the cabin projects 1.625 m ahead.
- Placed smaller oblique head ports to reduce the face-like reading; fitted port centres to exposed facets in the mapped regions.
- Used one engine_glow material across 20 separate recessed back surfaces, with no emission in the file.
- Rebuilt main nozzle openings into the grey carrier plane with 0.10 m recess depth.
- Mirrored the red side hatch to retain complete material symmetry.
- Removed three fully buried end caps to fund added geometry without altering the visible shell silhouette.
- Preserved intentional buried shell overlaps; corrected visible carrier and port obstruction.
- Used symmetric preview lighting for the mirrored-front comparison.

## Artifacts
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope.blend` — Updated B and preserved A, with packed blueprints.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B.glb` — Verified B export; 2,092 triangles.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-34.png` — Re-imported GLB three-quarter render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-side.png` — Side orthographic render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-front.png` — Front orthographic render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-top.png` — Top orthographic render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-rear.png` — Rear carrier and lip verification render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-underside.png` — Additional centre-gap and belly-port verification render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-symmetry.png` — Front render blended with its mirror at 50%.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-overlay-side.png` — Registered side overlay, 1600 pixels wide.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-overlay-front.png` — Registered front overlay, 1600 pixels wide.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-overlay-top.png` — Registered top overlay, 1600 pixels wide.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/report.md` — Acceptance report, object counts, port coordinates, review log and remaining differences.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/round02-acceptance.json` — Independent GLB geometry, symmetry and material audit.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/round02-evidence.zip` — Baseline blend, three-pass review evidence, probes, logs and source copies.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/fix_b_round02.py` — B-only geometry modification and export source.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/prepare_b_round02.py` — Canonical GLB naming and binary validation source.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/render_b_round02.py` — B-only re-import and rendering source.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/compose_b_round02.py` — Registered overlay composition source.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/inspect_b_round02.py` — Geometry retention, centre clearance and port visibility probes.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/finish_b_round02.py` — Packaging, acceptance reporting and artifact verification source.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/report.md` — Job-local round-two report.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/out/round02/A-before.json` — Protected A file hashes.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/out/round02/acceptance.json` — Job-local GLB audit results.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/out/round02/artifact-manifest.json` — Verified paths, sizes and SHA-256 hashes.
