# Round 03 — complete

Generated the new sheet and used one edit for arrangement and labels. Rear-facing sockets, a hanging cockpit and the eight-colour part legend are present. Remaining failures are listed below.

Provenance: output_hint source `/home/ax/.codex/generated_images/01a0fdae-12f7-7da1-a242-86bcea6d477c/exec-e380a8f3-cf6f-4cf3-87e3-3b47368d3f16.png` → `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-133357-player-ship-ext-v2/out/player-ship-ext-sheet.png`; 1,254,264 bytes; 1944 × 809 pixels; SHA256 `4b7462bd3220ebe73fd6f9c8fe43604e7f314134fc110b841c1ed66694cb7eac`. Copy verified byte-identical. Calls: 2 this round (generation + edit), 5 cumulative. Generation prompt was rewritten for round 03's new requirements.

1. **FAIL** — Four principal views share a baseline, with a corner three-quarter view. Common scale remains inconsistent: side length approximately 590 px, top approximately 505 px.
2. **PASS** — Plain black human beside side view represents 1.8 m.
3. **PASS** — Exact LENGTH 18 m and BUBBLE 2.6 m labels; BUBBLE, SPINE, DECKS, ENGINES and HATCH callouts present.
4. **PASS** — Raised orange spine, stacked yellow rolls and chunky teal underslung modules remain distinct.
5. **PASS** — Approximately 590 px length / 52 px human height = 11.3 figure-heights, within the revised ±20% tolerance.
6. **FAIL** — Hanging glass bubble and cream framing are present, but two distinct thick pillars are not consistently legible across views; bubble height remains about twice the human's height.
7. **FAIL** — All eight part colours match the legend and paint bands are removed. Subtle tonal variation remains, so fills are not strictly flat.
8. **PASS** — Small solid black side silhouette retained, including the hanging bubble.
9. **PASS** — No insignia, flames, exhaust, scene or cast shadows; text consists of dimension, view, part and legend labels.
10. **PASS** — Rear view present with four dark nozzle sockets visible face-on.
11. **PASS** — No face-on nozzle mouths in side or top views; engine block appears in profile, consistent with backward-facing nozzles.
12. **FAIL** — Bubble clearly hangs beneath the forward hull. In the side view, the central teal module extends approximately 7 px below the bubble, so the bubble is not consistently the lowest point.
13. **PASS** — Legend contains all eight requested swatches and names.

Visual measurements are approximate image inspection, not a geometry probe. The sheet retains the rounded layered massing, but adds more underslung modules than round 02.

Edit prompt, verbatim:

Change only the arrangement and labels: uniformly resize and reposition the four orthographic views to one common scale on their shared baseline, so the 18 m side and top views have equal nose-to-tail length. Preserve each drawing's proportions. Add a HATCH callout pointing to the red hatch in the side view. Retain the full eight-entry colour legend, rear view, small three-quarter view and black silhouette.

KEEP: side, front, rear and top orthographic views on one baseline at one scale; small three-quarter view; small black silhouette; the 1.8 m human figure beside the side view; the labels "LENGTH 18 m" and "BUBBLE 2.6 m" and the part names BUBBLE, SPINE, DECKS, ENGINES, HATCH; the ship about ten figure-heights long; the stacked fat rounded rolls, raised spine, chunky underslung hardware and overall massing; the hanging pale blue bubble cockpit with two thick cream frame pillars; recessed rear-facing nozzle sockets visible face-on only in the rear view, not sideways in side or top views; the eight part colours and their complete legend: BUBBLE pale blue, COCKPIT FRAME cream, SPINE orange, DECKS yellow, UNDERSLUNG MODULES teal, ENGINE BLOCK mid grey, NOZZLES near-black, HATCH red; no paint stripes or bands; flat colour fills with dark outlines on a plain off-white background; no numbers, insignia, flames or exhaust, no scene, no cast shadows. Add nothing not listed above.

## Decisions
- Round 03's part colours supersede the previous orange/navy/cream paint bands.
- Added view labels to distinguish the new rear view.
- Used four recessed nozzle sockets; nozzle count was unspecified.
- Spent the single edit on common-scale arrangement and a direct HATCH callout.

## Artifacts
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-133357-player-ship-ext-v2/out/player-ship-ext-sheet.png` — Round 03 selected concept sheet, copied unmodified from the edit result.
