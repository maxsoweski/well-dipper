# Round 01 — blocked

Three decimation attempts destroyed the source silhouette; stopped at the brief’s three-failure limit.

- Source measured: **19,231 vertices, 39,041 triangles**.
- Each rejected reduction: **840 vertices, 2,232 faces**; the spine and upper lobes collapsed into spanning triangles.
- Source contains **880 edges with more than two incident faces**; causality remains unproven.
- **28 earlier output entries archived**.
- Diagnostic Blender checkpoint and four inspection images saved and verified.
- **0 complete review passes**. Cockpit construction, export and acceptance checks remain incomplete. **No release GLB exists**.

Full findings and measurements are in report.md.

## Decisions
- Preserved the original open scene and edited a separate cleanup scene.
- Identified imported −Y as the nose and rotated working geometry to +Y forward.
- Tried symmetry-enabled reduction, reduction without symmetry, then welding and degenerate-edge cleanup before reduction.
- Retained the rejected geometry only for diagnosis and stopped after three failed reductions.

## Artifacts
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.blend` — Diagnostic checkpoint containing preserved source and hidden rejected reduction; not a release model.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/source-side.png` — Source side inspection.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/source-front.png` — Imported +Y inspection, established to be the rear.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/source-nose.png` — Source cockpit-end inspection.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/cleanup-diagnostic.png` — Rejected reduction showing silhouette collapse.
- `/mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/report.md` — Measurements, failed attempts, acceptance status and continuation checkpoint.

**Blocked:** Geometry validation failed three times: Blender decimation collapsed the upper hull and spine. Maximum source Z fell from 0.587618 to 0.400235 normalized units. No Python exception occurred; the resulting geometry violates the required shape preservation.
