# nav-restorations-2026-09-20 — intent

## Why we care

Max, 2026-09-18, after tinkering with the two new 240p nav menus:

> *"1. The 3D prism appears too simplistic to read now; 2. The 2D system menu doesn't really work
> intuitively; it's hard to scroll and get info; I want you to really look at all the functions of the
> new menu, what every click and keypress does compared to the functionality that is intended in each
> screen and across the transitions between screens and see what should be updated for ease-of-use,
> visual legibility, and consistent workflows across the different screens."*

The audit that answered him (`docs/FEATURES/nav-menu-map-old-vs-new.html`, artifact
https://claude.ai/artifact/F8Ut2bLQbK4hh5V8TJ27UY) ranked what the new menus LOST against the old nav.
Its twelve defects are built (`nav-defects-batch-2026-09-18`). Its eleven restorations (page items 13-23)
waited for his review. On 2026-09-20 he ruled: *"Go with your recs on restorations."* The recommendations
on the page, now his rulings:

- 13 hover-inspect — **yes, PRISM and SYSTEM first**
- 14 the prism's depth cues — **yes, keep the low-fi marks**
- 15 names on the prism and the height numbers — **names yes; numbers into design 1's detail block and design 2's status line**
- 16 planet detail with moons — **yes** (a design-side sub-view, not a switch back to the old one)
- 17 the ship's real position and the trajectory line — **yes**
- 18 wheel zoom at SYSTEM — **design 2 yes; design 1 no** (its ladder is a scroll, not a zoom)
- 19 body names on the ladder and the orrery — **yes**
- 20 belt names and the star line — **yes; the wide-binary member list PARKED**
- 21 one zoom readout for all three looks — **yes** (the old nav's radius in light-years)
- 22 the AUTOPILOT toggle — **PARKED**
- 23 grabbable handles in design 2 — **yes**

**The through-line:** the old nav told the pilot what a thing IS before he clicked it and where HE is
in the picture; the new menus took that away while adding keys, lists and search. This workstream gives
the information back inside the new designs' own language — the rail, the status line, the ladder, the
orrery — without switching any screen back to the old renderer.

**Serves:** the 35% SCREENSAVER MVP milestone (`docs/JOURNEY.md`), SCREENSAVER tier (`docs/PLAYER_EXPERIENCE.md`) — the nav computer is the pilot's instrument for choosing where the ship goes; a menu that cannot say what a thing IS falls short of that tier's target experience.

## Success criteria (Max's language)

The page's own wording for each item, which he approved with "go with your recs":

1. **Hover-inspect on every screen:** sector name at GALAXY, coordinates at SECTOR and REGION, the star
   tooltip at PRISM, the body callout at SYSTEM. "It is the only way to learn what a thing is without
   selecting it."
2. **The prism's depth cues:** drop lines to the plane, the plane grid, far-first drawing; plus spectral
   colour and the catalogue halo in design 1. "Height above the plane is the prism's whole point."
3. **Names on the prism in design 1** (in place of the eight digits) and **the height numbers in both:**
   HEIGHT with its region, PLAYER Y, Y RANGE — in design 1's detail block and design 2's status line.
4. **Planet detail with moons, and moons as burn targets.** "Moons cannot be seen on their orbits or
   chosen as burn targets; a pip click selects the parent."
5. **The ship's real position at SYSTEM, and the trajectory line to the selected body.** "You cannot see
   where you are in the system or where a burn would take you."
6. **Wheel zoom at SYSTEM in design 2.** "The wheel still changes a value; nothing draws it."
7. **Body names on the ladder and the orrery,** placed like the prism labels, beside or in place of the
   letter and roman tags. "The name is one click away in a list, not on the thing."
8. **Belt names, and a line of facts about the star.** "Belts are anonymous dots, the star has no line
   of text."
9. **One zoom readout for all three looks,** same quantity and unit: the old nav's radius in light-years.
10. **Grabbable handles in design 2 to match design 1.** "Your ruling was look-agnostic; only design 1
    has them."
11. **The whole:** with these back, the two new menus read as one instrument that tells him what things
    are and where he is — his walk, his call.

## Non-goals

- ⛔ The wide-binary member list and its sub-orrery (item 20's third clause) — parked.
- ⛔ The AUTOPILOT toggle (item 22) — parked; inert in ORRERY anyway.
- ⛔ The off-map target arrow and the real minimap (lost #10 and #5's second clauses) — not in any item.
- ⛔ The prism's tether lines to co-members and its pulsing selection rings — not in item 14.
- ⛔ Any change to the legacy look (`viewMode === null`): it already prints every one of these; it stays
  byte-identical on a fresh open at every level.
- ⛔ Lifting the `_systemMode` pin (NavComputer.js:4585/4590). The planet detail is a DESIGN-SIDE
  sub-view on `S`; the host's legacy sub-modes stay unreachable from a design.
- ⛔ A wheel zoom for design 1's SYSTEM screen (his ruling: no).
- ⛔ Touching `src/main.js` (frozen at 15161) — its burn consumer already accepts a moon target
  (main.js:5994/5999).
