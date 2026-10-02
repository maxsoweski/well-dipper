# Checkpoint — after round 01

## artifact versions
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.glb — pass 6; SHA-256 74ccb4b7a16864f11e25ef336a40105b134a6ff9a25a996d991873bcd82f1fc1
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.blend — pass 6; SHA-256 9cb8282758a724af6e5b94d7973009cf00de61be2edba6e6eba8dcd98eedbec6

## invariants
- Preserve exact interface node and material names.
- Keep Blender +Y forward, glass width 2.6 m, ship length approximately 18 m, and Eye_Point 1.2 m above floor.
- Keep Bubble_MAIN wholly forward of origin and all seven display faces blank with 0–1 UVs.
- Maintain flat shading, 13 materials, no textures or emission, and at most 3,000 triangles.

## accepted decisions
- Implementation uses the accepted sheets’ colour map.
- Final geometry: 2,864 triangles, 22 meshes and Eye_Point.
- Centre-of-mass placement uses the documented additive volume proxy.

## rejected approaches
- Solid engine carrier caps obscured nozzle wells.
- Long nose overhang concealed the cockpit in top view.
- Mismatched aft ring sampling produced cusps.
- Unattached thruster placements floated above the hull.
- Earlier cockpit layouts provided only 61.37% and 65.12% open view.

## unresolved
- Max’s visual acceptance has not yet been collected.

## next action
Review player-ship-34.png, player-ship-pilot.png and review-pass-6.png; apply any Round 2 feedback to the saved model.
