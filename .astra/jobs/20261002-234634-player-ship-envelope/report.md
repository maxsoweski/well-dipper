# Round 01 — complete

Created and verified both variants after six review passes.

| Check | A | B |
|---|---:|---:|
| Objects | 14 | 14 |
| Triangles | 1,450 | 1,450 |
| Materials | 7 | 7 |
| Length × height × width | 18.025 × 10.900 × 10.400 m | 18.025 × 10.900 × 10.400 m |
| Bubble outer width | 5.100 m | 2.950 m |
| Bubble_MAIN glTF z-range | −11.155549 to −7.700549 m | −11.155549 to −7.700549 m |

Technical checks passed, including GLB re-import, flat corner normals, exact material values, and identical geometry for all 12 shared parts. All required renders and overlays exist; 36 pass overlays are archived.

Remaining differences include A’s raised brow and larger cabin, the disputed spine start, faceted shell boundaries, and local module/rear silhouette differences. The full per-part findings and six-pass loop log are in report.md. Visual approval remains with Max.

## Decisions
- Used intersecting longitudinal hull volumes and shallow overlaps for the continuous body.
- Used three paired module groups; exact individual module count remains deferred.
- Used a common structural-volume centroid as the origin proxy; physical mass distribution is unspecified.
- Registered the front centreline at crop x=145 and baseline y=307; retained each supplied uniform scale.
- Followed the visible early orange side shape with a 1.65 m spine start instead of the map’s textual 5.3 m landmark; documented the conflict.
- Made A’s cabin 5.10 m wide and approximately 4.02 m high; raised its brow to clear it.
- Made B’s cabin 2.95 m wide and approximately 2.15 m high; lowered its inner brow to meet the roof.
- Interpreted the approximate glass-width figures as opening cues rather than the bounding width of all wraparound glazing.
- Kept aft shoulder and engine surround separate; recessed four sockets within the rear envelope.
- Used packed Blender image-reference planes implemented as image empties.
- Composited blueprints at 50% and model overlays at 60% opacity for boundary inspection.
- Measured 125° azimuth from Blender +X toward +Y; used a 53 m camera distance to frame the complete ship.
- Stopped at six review passes and documented remaining differences without claiming visual approval.

## Artifacts
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope.blend` — Both variants, presentation setup, and four packed blueprint references.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-A.glb` — Variant A; 1,450 triangles.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B.glb` — Variant B; 1,450 triangles.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-A-34.png` — 960×540 re-imported A three-quarter render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-A-side.png` — 960×540 A side render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-A-front.png` — 960×540 A front render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-A-top.png` — 960×540 A top render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-A-rear.png` — Additional A rear verification render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-A-overlay-side.png` — 1600-pixel-wide registered A side overlay.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-A-overlay-front.png` — 1600-pixel-wide registered A front overlay.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-A-overlay-top.png` — 1600-pixel-wide registered A top overlay.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-34.png` — 960×540 re-imported B three-quarter render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-side.png` — 960×540 B side render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-front.png` — 960×540 B front render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-top.png` — 960×540 B top render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-rear.png` — Additional B rear verification render.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-overlay-side.png` — 1600-pixel-wide registered B side overlay.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-overlay-front.png` — 1600-pixel-wide registered B front overlay.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B-overlay-top.png` — 1600-pixel-wide registered B top overlay.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-comparison.png` — r10 beside both variant previews.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/acceptance.json` — Binary GLB audit: objects, triangles, bounds, materials, normals, and shared geometry.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-evidence.zip` — Six-pass overlays, raw renders, review sheets, logs, registration, re-import checks, and source copies.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/report.md` — Full acceptance report, loop log, remaining differences, decisions, and file inventory.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/build_envelope.py` — Final Blender geometry and export source.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/render_envelope.py` — GLB re-import and rendering source.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/composite.py` — Registered overlay composition source.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/audit.py` — Independent binary GLB validation source.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/inspect_blend.py` — Saved Blender file inspection source.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/finish.py` — Packaging, report generation, and artifact verification source.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/report.md` — Job-local acceptance report.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/out/audit-summary.json` — Job-local binary audit results.
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-234634-player-ship-envelope/out/artifact-manifest.json` — Verified absolute paths, sizes, and SHA-256 hashes.
