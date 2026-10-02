# Round 05 feedback

Max's words, verbatim (this is the acceptance criterion for this round):

Max, verbatim: "The forward-facing maneuvering thrusters don't appear in the front view on the concept sheet. Also, I like the new shape of the bubble. It's kind of like a spherical cube sort of shape. Anyway, this works really well. The only thing that I have to say here is that the pylons supporting it, or ribs or whatever they're called, have been moved, and I need them to be in roughly that position that they were in before to in the front of the canopy from which we can have hud elements extending and so on."

Edit the previous sheet (Image 1 = the latest sheet). Image 2 is the sheet from one round earlier: it shows where the canopy pillars used to be.

Change only these two things:
1. FRONT VIEW THRUSTERS: in the front view, show the forward-facing manoeuvring thrusters face-on — the magenta recessed ports at the nose (the pair visible at the nose in the side view) appear in the front view as dark recessed sockets ringed in magenta, at the matching height and spacing. Add any other forward-facing ports the side and top views imply.
2. CANOPY PILLARS: move the cockpit frame's two thick pillars back to roughly where they were in Image 2: two cream pillars running vertically up the FRONT face of the glass, in front of the pilot, dividing the front glass into a centre pane and two side panes, meeting the frame at the top and bottom. In the front view they cross the glass face-on; in the side and three-quarter views they show at the front of the canopy. Max needs them there to mount instruments and HUD elements off them.

KEEP: the bubble's new shape exactly ("a spherical cube" — Max likes it); everything else on the sheet unchanged — side, front, rear and top views with view names, one baseline, same scale; three-quarter view; black silhouette; 1.8 m figure; labels "LENGTH 18 m", "BUBBLE 2.6 m" and the part callouts; massing; part colours and the nine-entry legend; flat fills, dark outlines, plain off-white; no numbers, insignia, flames, exhaust, scene or shadows. Add nothing not listed above.

Tolerance: unchanged to the eye apart from the two changes; a few pixels' drift is not a failure. Report the previous checks plus (16) front view shows forward-facing thruster sockets, (17) two cream pillars cross the front face of the glass in the front view, and show at the canopy front in side and three-quarter views, (18) bubble shape unchanged.

---

# Checkpoint — after round 04

## artifact versions
- out/player-ship-ext-sheet.png: round 04; SHA256 94d8c08c5d82ab88db8230d795983261323f979ca6df68a877c8d361c4c69f74

## invariants
- LENGTH 18 m and BUBBLE 2.6 m remain authoritative.
- Preserve rounded layered massing, four rear main nozzles, hatch, modules and sheet layout.
- Hanging cockpit now uses a rounded-block shape.
- Nine-colour part map includes magenta MANOEUVRING THRUSTERS.

## accepted decisions
- One edit performed for round 04.

## rejected approaches
- No unrelated proportion corrections.
- No code-based image modification.

## unresolved
- Some manoeuvring ports lack clearly dark recessed interiors and appear smaller than 30 cm.
- Existing view-scale mismatch remains.
- Central module remains lower than cockpit in side view.
- Two cockpit pillars are not consistently clear; subtle shading remains.

## next action
Reviewer evaluates the rounded-block cockpit and manoeuvring-thruster treatment.

---

Reply with the same JSON result contract as before (status / report / artifacts / decisions / questions / checkpoint).
