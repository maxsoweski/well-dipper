# Checkpoint — after round 02

## artifact versions
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.glb — SHA-256 d2e060aef42bba6d96c28c13f069d7529082e702f268794391d12f7baeedaeca
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.blend — SHA-256 7b50a02630c7e33d491444bfb438869409655319c5bec5330e944e8e7de68f25
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/report.md — SHA-256 3169b89080a5f414da5638be68a3b48f5d223c32d661229b3f34bba9349e27a7

## invariants
- Preserve the spine, lobes, protrusions, supported undercarriage and hanging cockpit.
- Forward is Blender +Y / glTF −Z.
- Maintain exact interface names and 13 specified materials.
- Remain at or below 3,000 triangles; current total 2,850.
- Keep UVs only on the seven display objects, with blank faces.
- Keep guides hidden and excluded from export.

## accepted decisions
- Round 02 authorized clean retopology from the sculpt as a shape guide.
- Final model contains 34 meshes and Eye_Point.
- Six review passes and final independent checks completed.

## rejected approaches
- Further hull decimation: prohibited by round 02 and previously destroyed or crumpled the surface.
- Conforming hatch patch: intersected the convex hull; replaced with a fitted plane.
- Independent paired port fits: introduced centimetre-scale drift; replaced with exact mirroring.

## unresolved

## next action
Present player-ship-34.png, player-ship-pilot.png and review-r02-pass6.png for Max’s visual review; preserve the validated interface during any subsequent revision.
