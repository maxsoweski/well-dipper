# Round 02 feedback

Max's words, verbatim (this is the acceptance criterion for this round):

# Round 02 — fix list for variant B only (Max chose B)

Max reviewed both variants on 2026-10-03. **He chose B** as the player ship. A is kept as is for another use: do not
touch `envelope-A.*`. His words on B, verbatim:

> 
> Overall, I like this version much more. There will be things that I'll want to tweak here,  many of them similar to the caterpillar head thing that I was saying for the Shape A Model. This silhouette and overall shape work for me for now, except for the fact that it is not symmetrical when split down the middle from facing it front on.  I see the way that these polygons fit together on the left side of the ship's hull are not the same as on the right side. That's a real problem and should be relatively straightforward to fix. Same goes for the polygons of the spine. If you divide them in half along the front facing axis, then they actually don't translate very well.  They don't match each other. It's not symmetrical. The lip above the rear exhaust should be a lot more rounded in shape and shouldn't end  in a sharp angle. It should be just kind of a lip that extends out over the rear engines.  And also it's pretty clear that some polygon is clipping through the gray colored part  of the engine. It's yellow piece clipping through, so that's part of the decks. Also the cubic part that is the biggest and sticking out from the center of the underside, the underslung module.  We do want modules extending down about that far, but we want them to be split to the right and left sides to be next to those other underslung modules that are already there. I'd like all those modules to be a bit thinner so that we can fit more next to each other  on either side of the undercarriage of the ship. I don't want to have this big one right  in the center. I want the center to be empty, almost like we have these kind of two fin  shapes that are being created by these cuboid underslung modules. I think I said it about the other one, but the recessed engine ports are not in all the positions that they need to be on the different faces of the ship.  These don't need to be very deep, they just need to be slightly recessed so that I can have an animated section on the inside that gets brighter or animated to be brighter as more of the throttle is engaged.
From his note on A, which he says also applies to B's head: "The cockpit doesn't obviously hang off of the front, the
way that it does in the reference images. The portion of the ship that the bubble connects to looks like a caterpillar
head almost, especially from the front with those engines right there, recessed. The head is dangling from the bubble,
as though it's in the head's mouth. There are only the rear engines that I see on this model."

And overall: "it's good enough at this point to actually work on getting it in the game." So this round is a FIX round
on B's existing masses. Keep the silhouette and proportions he approved; change only what is listed.

## What to change (outcomes; the method is yours)
1. **Symmetry.** B must be mirror-symmetric left/right by construction: hull shells and spine, facet for facet. Seen
   front-on and split down the centreline, both halves match.
2. **Rear lip.** The deck lip over the rear engines becomes a rounded lip that overhangs the engine carrier. No sharp
   angle or pointed end; no upright slab.
3. **Clipping.** No yellow deck geometry passes through the grey engine carrier (or any other part).
4. **Undercarriage.** Remove the big central module. The centre of the belly is empty. Instead, two rows of thinner
   cuboid modules, one row each side, packed side by side next to the existing side modules. They reach down about as
   far as the big central module did, so each row reads as a fin-like keel. Still closely attached, no stalks.
5. **Thruster ports on every face r10 shows them.** Shallow round recesses (not deep) at r10's positions: on the head,
   the flanks, the rear shoulder, the modules, the belly. Each port's back face is a separate surface on its own slot
   `engine_glow`, so the game can brighten it with the throttle. The four main nozzles get the same: a shallow socket
   whose back face is `engine_glow`.
6. **Head and bubble.** The bubble should obviously hang off the front, below and ahead of the head, as in r10's side
   view. It must not read as sitting in the head's mouth. The forward-facing ports on the head must not make the head read
   as a caterpillar's face. Use r10's side and front views for where the bubble sits relative to the head.
7. **Hatch.** Add the red side hatch on a rear module (r10 side view).

## Unchanged
Overall envelope (18.0 × 10.9 × 10.4 m, within ±0.3 m), the bubble's size (2.95 m wide), the deck and spine masses
apart from the symmetry and rear-lip changes, origin, axes, `Bubble_MAIN`, and all existing slots. Tolerance: shapes Max
did not mention should look unchanged to the eye; small vertex drift is not a failure.

## New slots
- `engine_glow` — charcoal (0.03, 0.03, 0.035), no emissive in the file (the game drives brightness).
- `hatch` — red (0.8, 0.05, 0.05).
- `thrusters` — magenta (0.85, 0.0, 0.6): the rims of the manoeuvring ports.

## Budget
Triangles ≤ 2,200 for B (the cockpit interior gets the rest of the 3,000 later).

## Outputs (B only, same names, overwrite)
`envelope-B.glb`, `envelope-B-34.png`, `-side.png`, `-front.png`, `-top.png`, `-rear.png`, the three
`envelope-B-overlay-*.png`, plus NEW `envelope-B-symmetry.png`: front orthographic render with its mirror image
overlaid at 50 %, so mismatched halves show. Save `envelope.blend` with B updated and A untouched.

## Report
Keep the three statements separate: technical checks; remaining differences from r10 and from this list; no claim of
approval. Include a symmetry measure (e.g. the largest left/right vertex mismatch in metres).

---

# Checkpoint — after round 01

## artifact versions
- Final geometry: pass 6.
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-A.glb SHA-256 ad90e42a6cd50d9e452b6969bfb7485ad4d37d01faded7b7f6777b4c12c7562e
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/envelope/envelope-B.glb SHA-256 6551ef767b11560e17331a1480c9170ba03820d7a36c8f3adc8efcdf2e56ed7f
- All 32 loose artifacts verified; manifest contains hashes for the other 31 files.

## invariants
- r10 remains the shape authority; no old sculpt or earlier model was used.
- Each variant has 14 objects, 1,450 triangles, and seven exact materials.
- Blender +Y forward, glTF −Z forward, metre units.
- Only Bubble_MAIN and P05_Head differ between variants.
- Preserve flat normals, recessed engines, attached undercarriage, and continuous swept hull masses.

## accepted decisions
- Scripted modelling was explicitly authorized.
- Two cabin variants are required for Max’s visual choice.
- Hatch, thrusters, detailed modules, and interior remain deferred.

## rejected approaches
- Stacked horizontal shells and separate leg-like supports.
- Closed rear hull surfaces obscuring engine sockets.
- Low common nose volume intersecting A’s cabin.
- Color-mask silhouette metrics: cream-frame gaps produced false boundaries.
- Using imported smooth-polygon flags as the flat-shading test; exported corner normals were checked directly.

## unresolved
- Max’s A/B choice and visual approval.
- Early spine-start interpretation versus the map’s 5.3 m landmark.
- A’s raised brow and large cabin departures from side/top r10.
- Coarse shell boundaries, rear-cap curvature, and local module silhouette differences listed in report.md.
- Physical centre of mass requires an interior and mass distribution.

## next action
Review envelope-comparison.png and the registered overlays with Max; apply his feedback to the existing source and chosen variant.

---

Reply with the same JSON result contract as before (status / report / artifacts / decisions / questions / checkpoint).
