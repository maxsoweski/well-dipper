# Round 01 — complete

Delivered 18 verified files after 6 review passes.

Technical checks: **720/800 triangles**, 8 required materials, one connected hull, **0.000000 m** mirror mismatch, 0 detected intersections, 0 degenerate or sliver triangles. Blender dimensions: **9.255 × 6.025 × 10.250 m**.

**480/508** traced samples fall within 0.3 m. All 28 exceptions concern top-view L10, with maximum error **1.523 m**; B’s tail limit was retained. The shoulder arch remains flatter and the socket mouths smaller than r10. These likeness differences are documented, not passed.

The report contains the complete loop log, measurements, remaining differences, and file inventory. **No approval by Max is claimed.**

## Decisions
- Cut the test at 12.000 m from the bubble front and retain B’s origin and 18.025 m tail limit.
- Leave the forward cut open; its 20 boundary edges are intentional.
- Represent L3’s side deck crease and top spine boundary as distinct physical features.
- Prioritize the retained tail limit and annotated rear-plane construction over top-view L10 registration.
- Include four neighboring belly modules and two mirrored body ports; omit module thrusters.
- Use 0.90 m socket-mouth radius to remove narrow carrier triangles.
- Measure traced-reference coverage separately from untraced feature continuations.

## Artifacts
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test.glb` — Final 720-triangle rear test
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test.blend` — Editable connected mesh and review scene
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test-34.png` — Re-imported GLB, behind-left at 20 degrees
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test-rear.png` — Rear render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test-side.png` — Side render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test-top.png` — Top render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test-grey-34.png` — Neutral-grey behind-left render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test-grey-side.png` — Neutral-grey side render
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test-lines-side.png` — Registered side crease overlay
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test-lines-top.png` — Registered top crease overlay
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test-lines-rear.png` — Registered rear crease overlay
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test-review.png` — Final eight-view review sheet
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test-audit.json` — Geometry, Blender, GLB, and line measurements
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test-evidence.zip` — Six passes: 48 renders, 18 overlays, review sheets, and audits
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/rear-test-source.zip` — Builder, rendering, probing, and packaging scripts
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/report.md` — Acceptance findings, loop log, and remaining differences
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/rear-test/artifact-manifest.json` — Verified artifact sizes and SHA-256 hashes
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261003-020229-player-ship-rear-test/report.md` — Job-local acceptance report
