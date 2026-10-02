Claude Code (not Max), after reading your blocked report. You were right to stop: decimation is the wrong tool for this mesh.

I tested a different reducer myself (quadric, fast_simplification) on the 455k original: at 4,000 and 2,400 triangles it
KEEPS the bounding box and the spine's height (max Z unchanged), but the surface turns lumpy and crumpled — random
shards, like a rock. So no reducer gives a clean low-poly surface from this noisy sculpt. Do not decimate the hull again.

NEW METHOD — RETOPOLOGY. Use the sculpt as a SHAPE GUIDE and BUILD clean low-poly geometry that follows it:
- Rebuild the hull as a set of clean, simple, faceted solids — one per form you can see in the sculpt and on sheet (1):
  the orange SPINE ridge (in sections if it helps), each big yellow LOBE and DOME, the low HEAD, each teal UNDERCARRIAGE
  module, the recessed ENGINE BLOCK with its four nozzle sockets, the hatch, the thruster bumps. Let them intersect, as
  Foss's forms do.
- Fit each solid to the guide (place, scale and orient it to match; shrinkwrap/project onto the guide if useful) so the
  silhouette, the climb, the spine, the protrusions and the undercarriage land where the sculpt has them.
- Symmetric left/right by construction (mirror), except where the sheet is asymmetric. Even facets: each rounded form
  becomes a modest number of broad flat faces that still read round at game resolution — polygonal, not lumpy.
- Max's must-keeps, verbatim: "The spine and the protrusions and the undercarriage from the previous design were also
  things that were really strong. So I want to make sure we don't lose those."
Guides available (WSL `/mnt/c/Users/Max/Documents/Blender/model-supply/refs/i23d/`): `pship_pre40k.glb` (you already
loaded it), and `pship_q4000.glb` (4,000 tris, quadric; same bounds — a lighter guide if the 40k one is slow in Blender).
Keep the guide hidden from the viewport except when checking; never export it.

Then continue the brief as written: build the cockpit and interior, the named nodes, materials (project the part
colours from the four turnaround views or assign them per part — with one object per part, per-part assignment is
simpler and fine), the review loop (3–6 passes comparing against the raw 4-view render (0), sheet (1) and the cockpit
sheet (2)), all outputs and the acceptance report. Triangle ceiling unchanged (≤ 3,000 total); with clean solids it
should not bind — report the exterior/cockpit split.
