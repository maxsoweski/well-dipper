# Checkpoint — after round 03

## artifact versions
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.glb — SHA-256 bac531c6ef5bbbba889d1a598a5cdf0fa4a9041b50f7e5ef7016e5f72546006d
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.blend — SHA-256 3c9d77d1724d1d079c0e6f41503eaff01617f08d10871b94b4f7017156a66bdb
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/report.md — SHA-256 439b9a7cfa68fce51c5d0534a199500619e1772e5d275b0d7c2768b6a987247f

## invariants
- Forward Blender +Y / glTF −Z; length 18.000 m; bubble width 2.600 m.
- Exact interface names, seven UV display meshes and 13 specified materials.
- Cockpit geometry and Eye_Point-relative placement preserved.
- Spine, crown, paired aft lobes and six supported undercarriage modules preserved.
- 2,898 triangles total; ceiling 3,000.
- Guide remains hidden and excluded from export.

## accepted decisions
- Round 03 implementation uses a blunt head, three flank lenses and fully recessed engines.
- Four review passes and independent export checks completed.
- Final model contains 36 meshes and Eye_Point.

## rejected approaches
- Further hull decimation remains prohibited.
- Forward-reaching lens caps buried the spine; moved layers rearward.
- Rear lens tips occluded upper nozzles; shortened their rear extent.
- Conforming hatch patches intersected the lens bevels; replaced with flat module-mounted panels.

## unresolved

## next action
Present round03-before-after.png, player-ship-34.png and review-r03-pass4.png for Max’s visual review.
