# UAT — dock buoy (first Astra lane 3D job, Well Dipper trunk)

2026-09-21. Job `20260921-221523-dock-buoy`, Codex CLI 0.155.1 / gpt-6-astra, effort medium,
one round, exit 0 (`complete`), 439 s wall (7 m 19 s).

## What was built
A navigation/docking buoy: a 4 m faceted sphere-and-mast marker a 6 m fighter parks beside.
Orange faceted body (2.2 m sphere), a slim square mast off the +Y side with a flat cream cap,
one cream band ringing the body and one blue chevron on that band pointing along the mast.
Three flat materials, no textures, no glass, no glow — the game does the dithering.

## Probe numbers (measured from the GLB, not from Astra's report)
`glb_info.py /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/dock-buoy/dock-buoy.glb`

- meshes 2 · primitives 5 · **triangles 266** (budget ≤ 300) · **materials 3** · textures 0 · UVs no
- bbox (glTF, Y up): min [-1.1, -1.1, -2.729] max [1.1, 1.1, 1.271] → size **2.2 × 2.2 × 4.0 m**
- forward: marker **`Mast_MAIN`**, glTF z -2.729..-0.779 → **-Z** (the three.js forward)
- materials: `hull_orange` (1.0, 0.5, 0.1) · `band_cream` (0.88, 0.855, 0.78) · `chevron_blue` (0.05, 0.1, 0.4)
- four PNGs present, all 960 × 540; plus the .glb and the .blend

Astra's own report agrees with the probe on every number (266 tris, 3 materials, the same
`Mast_MAIN` z-range, the same bounds). No disagreement to diagnose.

Claude's simple gate on the ¾ render only: it is not black, and there is a buoy-shaped object in
frame. Everything about how it LOOKS is Max's call.

## What Max should open
`C:\Users\Max\Documents\Blender\astra\well-dipper-trunk\dock-buoy\compare.png`
— the buoy's ¾ render beside the accepted station hub v3, labelled, so the family look can be judged
side by side. The individual renders are in the same folder (`dock-buoy-34.png`, `-top`, `-side`,
`-silhouette`).

## Open question for this gate
Astra reported the chevron check as PASS. In the ¾ render the chevron sits near the right-hand edge
of the body and the cream band reads as a cap on the far side rather than a belt across the front,
because the band is perpendicular to the mast axis and this camera looks in along that axis. Whether
that reads as "a cream band with a blue chevron" is the thing to judge.

Verdict: PASS — Max, 2026-09-22: "yes it does read" (asked: does the buoy read as Well Dipper, judged from compare.png beside station hub v3)
