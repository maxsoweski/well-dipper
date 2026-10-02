# Round 02 feedback

Max's words, verbatim (this is the acceptance criterion for this round):

Claude Code's review (not Max), against the accepted sheet (Image 2) and Max's earlier ruling, verbatim: "I want the engines to be fully recessed. I don't want them to extend out from their chassis."

Edit the previous turnaround (Image 1). Change only these things:
1. ENGINES RECESSED: in the LEFT and RIGHT side views, nothing sticks out of the back of the ship. The grey engine block and its four nozzles sit INSIDE the hull's rear, behind a rear face that is flush with the yellow hull — as on the accepted sheet's side view (Image 2), where the rear outline is the rounded yellow hull. The BACK view still looks straight into the four recessed nozzles.
2. MATCH THE SHEET'S HULL: in all four views, follow Image 2's hull build more closely — a few big intersecting yellow lobes and domes rising from the low head to the high back, the orange spine lobe along the top — rather than a smooth single shell.

KEEP: the four views FRONT, LEFT (nose pointing right), BACK, RIGHT (nose pointing left) in one row at one scale on one baseline with white space between; the cockpit bubble, teal modules, red hatch, magenta thruster sockets; pure white background; flat fills with thin dark outlines; no text, labels, legend, lines, figure or silhouette. Add nothing not listed above.

Tolerance: a few pixels' drift is not a failure. Report the brief's checks plus (6) nothing protrudes past the hull's rear in the side views.

---

# Checkpoint — after round 01

## artifact versions
- out/player-ship-turnaround.png SHA256 36b036a2e20e52deebe44787e31f27b2d98f966d4e87d6443b926fe7124d57ea

## invariants
- FRONT, LEFT, BACK, RIGHT in one row.
- Accepted exterior sheet governs geometry and colours.
- Copy image-tool output without modification.

## accepted decisions

## rejected approaches
- First output rejected for added mechanical details and muted shading.

## unresolved
- Unequal side-view lengths.
- Geometry differs from accepted reference.
- Background is not exactly white.
- Fills retain shading.

## next action
Await round feedback; the permitted generation and single edit are finished.

---

Reply with the same JSON result contract as before (status / report / artifacts / decisions / questions / checkpoint).
