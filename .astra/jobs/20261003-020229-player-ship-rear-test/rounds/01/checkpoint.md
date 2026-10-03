# Checkpoint — after round 01

## artifact versions
- rear-test.glb pass 6; SHA-256 512e5eeb8909c8df99a9d138f0657700e7a280064d8ecaf8670448fc4d9f747e
- rear-test.blend pass 6; SHA-256 84dd724db38536a907ddaa9875090df4144cb5da42443b7182af1fdb501f8b09
- Absolute paths and remaining hashes are recorded in artifact-manifest.json.

## invariants
- Rear-only scope; original B coordinate frame; Blender +Y forward.
- RearHull_MAIN connected; mirror symmetry; eight required material names.
- Triangle ceiling 800; flat shading; no module thrusters.
- Do not modify the envelope directory or supplied references.

## accepted decisions
- Scripted construction was explicitly authorized in the brief.
- Six required geometry/render review passes are complete.

## rejected approaches
- Intersecting hull volumes: replaced with shared mesh edges.
- Pointed crown: replaced with a flat plateau.
- Warped port-neighbor facets: adjusted geometry onto planes.
- Narrow carrier webs: widened by reducing socket radius.

## unresolved
- Top-view L10 maximum registration error remains 1.523 m.
- Rear shoulder arch is flatter/narrower and sockets smaller than r10.
- Visual approval remains pending.

## next action
Review the final sheet and overlays with Max. For further geometry changes, extract rear-test-source.zip and continue from PASS=6 using his feedback.
