# Checkpoint — after round 02

## artifact versions
- Round 02 final geometry: review pass 3, 2,092 triangles.
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B.glb SHA-256 981f545fbe9d30d1a4e8b63c6aa95413ef8edced6fd6502c0fba31493b9b55ce
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-A.glb unchanged SHA-256 ad90e42a6cd50d9e452b6969bfb7485ad4d37d01faded7b7f6777b4c12c7562e
- 25 round-two artifacts verified; baseline and intermediate evidence are archived in round02-evidence.zip.

## invariants
- B is the selected player ship; preserve A.
- Preserve origin, metre scale, Blender +Y forward and glTF −Z forward.
- Bubble_MAIN remains 2.95 m wide at its original placement.
- Maintain exact reflected geometry and material facets.
- Maintain the open centre, attached module rows, shallow recesses and non-emissive engine_glow slot.
- Retain the approved shell and spine massing outside explicitly requested fixes.

## accepted decisions
- Max chose B and accepted its starting silhouette.
- This round implements Max’s seven requested fixes.
- A remains available unchanged for another use.

## rejected approaches
- Independent automatic triangulation on both halves: produced mismatched facets.
- Nozzle mouths standing proud of a recessed grey plate: replaced with actual openings.
- Port placement beneath overlapping yellow surfaces: moved to exposed host faces.
- A central belly pod: replaced with paired segmented keel rows.

## unresolved
- Max’s visual judgement of the revised head and rounded lip.
- Exact port-centre refinement beyond the recorded coarse-facet placements.
- Previously accepted differences between the shell profile and r10 remain intentionally unchanged.

## next action
Review B’s three-quarter, rear, symmetry and underside images with Max. Use his next feedback to revise the existing B; extract the archived baseline when rebuilding with the round-two script.
