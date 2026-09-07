# nav-screens-close-pass — intent

## Why we care

Max walked both new 240p nav menus end to end and ruled:

> *"overall, very good, but we need to look at each screen closely. For example: on the galaxy screen
> there are many sectors in the grid that are not accessible, so there's wasted space. Also, anything
> on screen should be clickable, and selecting one thing should not prevent a second selection, as is
> currently the case on the system screen. The prism screen will need the most work--I like this
> low-fi way of rendering the star column but it's important to be able to rotate it in 3D. The
> previous system for the prism view was more functional in that sense. We have also lost much of the
> animation between screens (e.g., on the galaxy to region screens, clicking on a cell from the grid
> should highlight it, then zoom into it, resulting in the next screen (galaxy > sector > region). The
> indicators on the prism and system screens should be grabbable. I want to be able to grab and drag
> the system line view to look at the further planets from the star, rather than having to press a
> button exclusively. On the orbits view of the system screen, I want to be able to rotate the view in
> 3D like I could with the previous one."*

**The through-line is one sentence: the previous nav did these things and the new designs lost them.**
Rotation, drag and the drill animation all already exist and already run in the legacy renderer that
still paints underneath every mode frame. This is a **wiring** session, not a building one, and
`converge-dont-declare-divergence` governs: a difference between what the design draws and what the
game can already do is debt until proven otherwise.

⛔ This **overturns a deliberate non-goal** taken last session. `nav-menu-elements-functional`'s AC-5
says *"ROTATION IS NOT WIRED AND THAT IS DELIBERATE — ... replacing the designs' fixed shallow tilt
with the legacy's full 3D rotation would change the picture Max ruled on."* He has ruled the other
way. The reasoning was about not changing a picture he ruled on; he is the one who rules.

⛔ And one thing is explicitly **kept**: *"I like this low-fi way of rendering the star column."* The
rotation applies to the existing texel-quantised marks. It is not a switch back to the legacy
renderer's arcs and strokes.

## Success criteria (Max's language)

1. **"on the galaxy screen there are many sectors in the grid that are not accessible, so there's
   wasted space"** — every part of the galaxy pane that looks like it can be clicked, can be; and the
   part of the galaxy that exists is on the glass.
2. **"anything on screen should be clickable"** — nothing is drawn that does not answer a click.
3. **"selecting one thing should not prevent a second selection, as is currently the case on the
   system screen"** — click one body, then another, and the selection moves to the second one. Every
   time, in both designs.
4. **"it's important to be able to rotate it in 3D. The previous system for the prism view was more
   functional in that sense"** — grab the prism and turn the star column in 3D, in both designs,
   without losing the low-fi look.
5. **"clicking on a cell from the grid should highlight it, then zoom into it, resulting in the next
   screen (galaxy > sector > region)"** — the cell lights up first, then the map flies into it.
6. **"I want to be able to grab and drag the system line view to look at the further planets from the
   star, rather than having to press a button exclusively"** — drag the ladder sideways instead of
   tapping a key.
7. **"On the orbits view of the system screen, I want to be able to rotate the view in 3D like I
   could with the previous one"** — grab design 2's orrery and turn it.
8. **"The indicators on the prism and system screens should be grabbable"** — the readouts that show
   a position along a range are handles, not decoration.

## The whole thing, as he'd judge it

Walk both menus again, screen by screen, and have each one hold up close.
