# Player ship — parts map (r02, 2026-10-02)

Authority: concept sheet r10 (`.astra/jobs/20261002-151739-player-ship-ext-v3/out/player-ship-ext-sheet.png`).
Pictures: `parts-map-r10.png` (numbered parts; `python3 draw_markers.py`), `regions-r10.png` (every area enclosed by
the sheet's black lines, numbered; `python3 regions.py` → `regions.json`), `bubble-options-c1.png`.
Purpose: step 1 of the panel-by-panel build Max approved 2026-10-02 (quotes in
`.astra/jobs/20261002-181942-player-ship-cleanup/UAT.md`).
History: r01 drafted by CC → checked by Astra (`astra-check-r01.md`) → r02 applies its four required changes
(spine markers swapped; parts tied to traced regions; landmark table; cabin proportion carried as two variants) and
records the rear construction and the disputed flank line as open alternatives.

## Status of this map
This is a **provisional** reading. It is good enough to build a coarse whole-ship envelope (step 2), and that envelope
is where Max judges it. Exact module count, hatch details and thruster placement are settled later, at the part-group
reviews (step 3), not here.

## Registration (candidate, not final)

Each view gets its own uniform scale; no axis is stretched to force agreement. Drawn ship length (not the dimension
bar) is set to 18 m — a choice, recorded as such.

| view | crop on the sheet (px) | scale | owns |
|---|---|---|---|
| Side | x 105–700, y 60–400; ship spans x 115–644, ground y 396 | 529 px = 18 m → 29.4 px/m | length, top-line climb, head height, rear curve, undercarriage depth |
| Front | x 745–1060, y 85–400 | ×1.09 so its height equals the side's → 27.0 px/m on the sheet | cross-section: arches, shoulders, head bar, bubble |
| Rear | x 1065–1365, y 85–400 | same as front | engine block size and placement |
| Top | x 1390–1890, y 110–400 | ×1.12 so its length equals the side's → 26.3 px/m on the sheet | plan shape: snout, mid-ship bulges, rear rounding |

Landmarks (metres; length measured from the bubble's front, height from the lowest module):

| landmark | value | from |
|---|---|---|
| Crest (top of rear spine crown) | 10.9 m high, 11.8–14.5 m back | side region 1 |
| Spine starts | 5.3 m back (side) / 3.4 m back (top) | side 2, top 70 — **mismatch 1.9 m, open** |
| Spine ends | 16.0 m back | top 69 |
| Yellow body underside at the head | 2.7 m high | side 3 |
| Bubble (side) | 0–3.4 m back, 0.5–2.6 m high | side 15/16 |
| Bubble glass width (front) | 3.5 m; with frame 5.1 m | front 29/40 |
| Module tops / lowest point | 4.1 m / 0 m | side 4, 19 |
| Mid-ship side bulges | 8.4–12.7 m back | top 62, 76 |
| Engine carrier width (rear) | ~6.7 m incl. surround | rear 45 |
| Overall envelope | 18.0 L × ~11.0 H × ~10.4 W (front 10.25, top 10.59) | — |

Front and top widths agree within 4 %; that is agreement on overall width only, not on proportion everywhere (the
bubble disagrees, C1; the spine start disagrees, above).

## What the traced regions show (new evidence)
In the **side and top views the deck lines are open strokes**: the whole yellow body is one connected area, even with
every line widened by 2 px (side: one 34–40 k px region plus the rear lobe; top: one 41–51 k px region). The lines end
inside the body instead of enclosing separate plates. In the **front view the same lines close into arches**
(nine yellow regions). Reading: the decks are one continuous body whose shells overlap and then merge back into it,
like overlapping lens forms fading into each other, **not separate plates stacked on each other**. This is the
evidence against round 03's stacked pancakes.

## Parts

Line labels: **E** outer edge · **O** overlap · **S** seam between flush surfaces · **C** curvature only ·
**?** unresolved. Region numbers refer to `regions-r10.png`.

| # | part (slot) | 3D reading | regions | lines |
|---|---|---|---|---|
| 1 | Spine, front segment (orange) | Raised rounded ridge on the centreline, low at the head, climbing back; blunt rounded front end (top view). | side 2 (front part), front 24, top 70 | E on the silhouette; orange/yellow boundary elsewhere = **? (C8)** |
| 2 | Spine, rear segment (orange) | The same ridge, larger and higher, ending before the rear; carries a small **crown** at its summit (part of #2, not a separate object). | side 1–2, front 20–21, top 69 | joint with #1 = candidate O, **?** |
| 3 | Upper deck shell (yellow) | Rounded shell over the rear two-thirds, either side of the spine, like a beetle's wing case; its edges overlap the flank and fade into it. Extent provisional. | side 3 (upper), front 26/27, top 65 (inner U) | lower edge = O fading out (open stroke) |
| 4 | Flank / main body (yellow) | The ship's main volume from head to rear; bottom broadly level with curves near head and rear. Outer shoulder arch in the front view. | side 3 (lower), front 22/23/25 | the long line through it in the side view = **? seam vs shallow overlap (C4)** |
| 5 | Head / brow (yellow) | Low rounded brow above the bubble, ~60 % of the ship's width, two large forward ports. The narrow lip directly above the glass = **? part of the brow or a lower collar**. | front 28, side 3 (front tip), top 65 (front) | E |
| 6a | Aft shoulder (yellow) | Rounded volume at the back, the highest rounded mass at the rear. | side (rear lobe), top 65 (rear) | relation to the shells' ends **? (C6)** |
| 6b | Engine surround (yellow) | Frame around the engine carrier; may share an object with 6a. | rear 43/44/46 | **? (C6)** |
| 7 | Mid-ship side bulges (yellow) | Paired rounded volumes, mostly buried in the flank, emerging only at the widest point. Hidden in side/front by occlusion, not absent. | top 62, 76 | E where visible; emergence boundary kept |
| 8 | Bubble + frame (bubble, cockpit frame) | Rounded-cube glazing under the brow. Two near-vertical cream members cross the front glass and continue over the cabin roof (top 71/72 are split by them), plus a perimeter frame. Size: **C1**. | side 15/16, front 29/40, top 71/72 | E |
| 9 | Underslung modules (teal) | Rounded boxes of mixed height AND depth, closely attached to the belly with their roots hidden in or intersecting it. **No stalks or legs.** Built first as a few grouped masses matching the combined outline; count settled at the group review. | side 4–14, front 30–39, rear 51–61, top 63–67/73–75 | E |
| 10 | Belly pod (teal) | Stepped lower assembly: an attachment mass and a rounded lower pod with a downward thruster. No stalk. | side 17–19 | E |
| 11a / 11b | Side hatch / aft panel (red) | Red panel on a module in the side view (11a) and at the bottom of the rear view (11b). One assembly or two: **C5**, settled later. | side 12, rear 58 | E |
| 12 | Engine carrier + 4 nozzles (engine block, nozzles) | Rounded-rectangle carrier with four round sockets in a 2×2 grid. Everything goes **inward**: the carrier perimeter is an opening, the circles are socket mouths, the inner circles are recessed interiors. | rear 45/47–50/53, top 68 | opening edges, inward |
| 13 | Manoeuvring thrusters (pink) | Small round ports. Each port gets a location and facing direction at the part-group stage (C7). | all | E |

## Conflicts

| # | conflict | handling |
|---|---|---|
| C1 | **Bubble size.** Front view: glass 3.5 m wide, 5.1 m with frame; side view: 3.4 m long, 2.1 m tall glass. Contract: 1.8–3.0 m outer width, from Max's "helicopter-cabin scale". | **Max decides, by looking at two whole-ship envelopes** (A: as drawn in the front view; B: within the contract), not from cabin sizes alone. A needs a contract change. |
| C2 | Absolute scale between views | Registration above; candidate. |
| C3 | Side bulges | #7 as buried paired volumes; whether they merge into the flank is judged on the envelope. |
| C4 | Long line through the flank (side view) | Open: seam vs shallow overlap. The region evidence (open stroke) favours a shallow overlap fading out. Not a third plate. |
| C5 | Side hatch vs aft panel | Deferred to the undercarriage group. |
| C6 | Aft shoulder vs engine surround vs shell ends | Envelope carries 6a/6b as separate masses; overlap direction judged on the envelope. |
| C7 | Thruster positions across views | Deferred to the part groups. |
| C8 | Orange/yellow boundaries: raised, flush, or colour only | The spine is raised on the silhouette; elsewhere decided at the hull-shells group. |
| C9 | Spine start: 5.3 m back (side) vs 3.4 m (top) | Envelope uses the side view (it owns length); flagged on the review. |

## Not decided here
Exact curves, the triangle split, the cockpit interior layout (Max directs the interior separately; its components
can be rescaled and moved).
