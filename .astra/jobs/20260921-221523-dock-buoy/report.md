# Round 01 — complete

Verified all 6 output files through WSL; all are non-empty.

- Meshes: 2 (`Buoy_Body`, `Mast_MAIN`).
- Triangles: 266 / 300, confirmed by GLB indices and re-import.
- Materials: 3, all used: `hull_orange` (1, 0.5, 0.1), `band_cream` (0.88, 0.855, 0.78), `chevron_blue` (0.05, 0.1, 0.4). Metallic 0, roughness 1, alpha 1.
- Blender dimensions: 2.200000 × 4.000000 × 2.200000 m. Bounds: X/Z ±1.1; Y −1.270632 to 2.729368 m.
- UVs: no. Textures: 0. Smooth faces: 0. Exported cameras/lights: 0.
- `Mast_MAIN` glTF Z range: −2.729368 to −0.779368 m; centre −1.754368 m.
- Cap: flat 0.5 × 0.5 m square; forward space unobstructed.
- Fresh-scene GLB re-import: dimensions matched within 0.000001 m; rendered ¾ preview from imported geometry; temporary scene deleted.
- Four PNGs: 960 × 540.

Actual ¾ render checks: (1) single isolated body and mast PASS; (2) continuous 0.8 m cream ring PASS; (3) complete blue V inside ring, pointing toward mast PASS; (4) distinct slim mast and cream cap PASS; (5) flat matte facets, no glow/glass/text PASS.

## Decisions
- Used the brief’s numeric palette over the conflicting fighter reference colours.
- Used a square 0.5 m mast cross-section and cap.
- Moved the cream ring centre 0.2 m toward the mast and narrowed the camera-facing chevron to improve its V outline; both colours use coplanar face assignments.
- Interpreted azimuth as measured from Blender +X toward +Y.
- Computed the assembly origin using uniform-density component volumes.
- Used Workbench studio illumination for previews without adding light objects.
- Saved the final Blender file with only the buoy scene; the original station file was not overwritten.

## Artifacts
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/dock-buoy/dock-buoy.glb` — Verified binary glTF asset.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/dock-buoy/dock-buoy.blend` — Standalone Blender scene with 2 mesh objects and 3 materials.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/dock-buoy/dock-buoy-34.png` — 55 mm, 20° elevation / 125° azimuth preview from re-imported GLB.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/dock-buoy/dock-buoy-top.png` — Orthographic top preview.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/dock-buoy/dock-buoy-side.png` — Orthographic side preview.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/dock-buoy/dock-buoy-silhouette.png` — Black ¾ silhouette on white.
