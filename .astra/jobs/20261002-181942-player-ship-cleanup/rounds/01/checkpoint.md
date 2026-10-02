# Checkpoint — after round 01

## artifact versions
- player-ship.blend SHA-256 c951368db262eb19e0dc52f19af0bb1cf5b577926418c290efa5f483b6c3777c
- report.md SHA-256 5b24ecf2db251e311bdd660c88bc413a147a3e1961e7d45a024a25baa81822a6

## invariants
- Preserve source lobes, spine and undercarriage.
- Use only the supplied pre40k source; never open the 455k original.
- Forward +Y in Blender; final length 18 m ±10%; bubble width 2.6 m ±10%.
- Final model ≤3,000 triangles with exact interface nodes and 13 specified materials.

## accepted decisions
- Earlier outputs are preserved in archive-scripted/.
- GPU_Source_40k remains unmodified in the diagnostic blend.
- Imported −Y is the cockpit end.

## rejected approaches
- Direct Blender collapse decimation with or without symmetry destroyed the silhouette.
- Welding and degenerate-edge cleanup before collapse produced the same invalid geometry.

## unresolved
- Shape-preserving source reduction and topology diagnosis.
- Colour projection, cockpit construction, complete review loop, export and acceptance validation.

## next action
In a subsequent run, repair topology or use a different simplification method on a fresh source copy, verify silhouette preservation, then continue the asset build.
