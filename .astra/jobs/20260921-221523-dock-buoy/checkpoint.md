# Checkpoint — after round 01

## artifact versions
- dock-buoy.glb SHA256 prefix 9d07665d6d61715a
- dock-buoy.blend SHA256 prefix 4e0f72646c68113c
- dock-buoy-34.png SHA256 prefix d662b8afb56fad82
- dock-buoy-top.png SHA256 prefix bf1ca666d52a8e73
- dock-buoy-side.png SHA256 prefix 34d41eff05955bb0
- dock-buoy-silhouette.png SHA256 prefix efee2e5b2d877ffb

## invariants
- 2.2 × 4.0 × 2.2 m; +Y mast; world-origin component centre of mass.
- At most 300 triangles; exactly 3 specified materials; no textures or smooth shading.
- Continuous cream ring and single blue V aimed toward Mast_MAIN.

## accepted decisions
- 266 triangles, square cap, 0.8 m ring width, camera-facing inset chevron.

## rejected approaches
- Initial clipped-face construction omitted boundary vertices; corrected clipping to preserve continuous surfaces.
- Initial chevron appeared too compressed; shifted ring forward and narrowed the V.
- Initial top framing cropped the model; increased orthographic scale to 8.2 m.

## unresolved

## next action
Review the six deliverables; apply any Round 2 feedback.
