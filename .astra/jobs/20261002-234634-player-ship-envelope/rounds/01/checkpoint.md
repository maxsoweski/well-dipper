# Checkpoint — after round 01

## artifact versions
- Final geometry: pass 6.
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-A.glb SHA-256 ad90e42a6cd50d9e452b6969bfb7485ad4d37d01faded7b7f6777b4c12c7562e
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B.glb SHA-256 6551ef767b11560e17331a1480c9170ba03820d7a36c8f3adc8efcdf2e56ed7f
- All 32 loose artifacts verified; manifest contains hashes for the other 31 files.

## invariants
- r10 remains the shape authority; no old sculpt or earlier model was used.
- Each variant has 14 objects, 1,450 triangles, and seven exact materials.
- Blender +Y forward, glTF −Z forward, metre units.
- Only Bubble_MAIN and P05_Head differ between variants.
- Preserve flat normals, recessed engines, attached undercarriage, and continuous swept hull masses.

## accepted decisions
- Scripted modelling was explicitly authorized.
- Two cabin variants are required for Max’s visual choice.
- Hatch, thrusters, detailed modules, and interior remain deferred.

## rejected approaches
- Stacked horizontal shells and separate leg-like supports.
- Closed rear hull surfaces obscuring engine sockets.
- Low common nose volume intersecting A’s cabin.
- Color-mask silhouette metrics: cream-frame gaps produced false boundaries.
- Using imported smooth-polygon flags as the flat-shading test; exported corner normals were checked directly.

## unresolved
- Max’s A/B choice and visual approval.
- Early spine-start interpretation versus the map’s 5.3 m landmark.
- A’s raised brow and large cabin departures from side/top r10.
- Coarse shell boundaries, rear-cap curvature, and local module silhouette differences listed in report.md.
- Physical centre of mass requires an interior and mass distribution.

## next action
Review envelope-comparison.png and the registered overlays with Max; apply his feedback to the existing source and chosen variant.
