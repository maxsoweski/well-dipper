# Round 02 feedback

Max's words, verbatim (this is the acceptance criterion for this round):

Max, verbatim: "I like this a lot, esp the version on the right; I want the "fat rolls" to be more pronounced, and I want all the thrusters to be recessed"

Edit turn on the previous sheet (out/r01/player-ship-ext-sheet.png, attached). Make ONE edit, then check and report.

Change only these two things, in every view (side, front, top, three-quarter, silhouette):
1. FAT ROLLS: make the stacked hull layers (the spine and the deck layers) fatter and more rounded, bulging outward like thick rolls stacked on top of each other, the way Image 1 (Chris Foss's liner) bulges. Each layer's edge should read as a big rounded roll, not a flat slab with a soft corner.
2. RECESSED THRUSTERS: every engine nozzle sits sunk inside the hull in its own socket, its mouth flush with or behind the hull's rear face, nothing protruding past the hull. Dark inside, no flame or exhaust.

KEEP: side, front and top views, orthographic, same scale, one baseline, small three-quarter view; the 1.8 m human figure; the labels "LENGTH 18 m" and "BUBBLE 2.6 m" and the part names BUBBLE, SPINE, DECKS, ENGINES, HATCH; the heavy layered Foss-style hull (raised spine, stepped decks, underslung hardware) with wrap-around stripes; the ship about ten figure-heights long; the helicopter-style glass bubble at the nose with two thick pillars; the orange, navy and cream colours; flat fills with dark outlines; the small black silhouette; no numbers, insignia, flames or exhaust. Add nothing not listed above.

Tolerance: everything else unchanged to the eye. A few pixels' drift is not a failure; the overall layout, the bubble, the band colours, the labels and the silhouette are what must hold. Report the visible-outcome checks from the brief plus: (10) the layers read as fat rounded rolls, (11) no nozzle protrudes past the hull.

---

# Checkpoint — after round 01

## artifact versions
- out/player-ship-ext-sheet.png: edited generation; SHA256 db09d4ede8a8f72f4a9a3e38048e13842ffb177eeb912b8325b65120ca398022

## invariants
- LENGTH 18 m and BUBBLE 2.6 m are authoritative.
- Preserve layered hull, wraparound palette, bubble cockpit, five part labels, human and black silhouette.

## accepted decisions
- Selected second image after the single permitted arrangement edit.

## rejected approaches
- No proportion correction edit, per brief.
- No code-based image modification or API fallback.

## unresolved
- Orthographic views differ in scale.
- Drawn ship is approximately 12.5 human heights long.
- Bubble is visually too tall relative to human.
- Some shading remains.

## next action
Reviewer evaluates the selected sheet and reported failures.

---

Reply with the same JSON result contract as before (status / report / artifacts / decisions / questions / checkpoint).
