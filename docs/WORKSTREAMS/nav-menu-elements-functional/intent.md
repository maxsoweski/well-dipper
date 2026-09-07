# nav-menu-elements-functional — intent

## Why we care

Max, 2026-09-07, opening this session:

> *"use workflows/subagents to continue implementation of this new menu system, beginning by
> identifying every single element you've created and scoping/planning how that functionality should
> work (every single thing needs to be functional and navigable by the player), reusing systems from
> the old design where feasible, and continue until all are functionally implemented. You should be
> able to test the basic functionality since these are all menu systems. Then you'll let me know when
> all systems are functional."*

And earlier the same day, on keeping both designs:

> *"I like both versions you've made for the new 240p menus, let's keep both"*

The previous workstream made the two designs **EXIST**. It shipped two menus that draw a great deal
of chrome telling the player what they can do — `CLICK A SECTOR`, `[ ] SORT`, `/ SEARCH`,
`TAB LEVEL`, `ENTER`, `WASD PAN`, `R/F UP`, `DRAG TO ROTATE`, `[ ] PAGE`, `CLICK TO ENTER` — and
almost none of it is bound to anything. **Every one of those strings is a promise the instrument
makes to the pilot and does not keep.** This workstream is about the menus doing what they say.

The scope discipline is Max's own second clause: **"reusing systems from the old design where
feasible."** Nearly every capability the new menus advertise already exists and runs, correctly,
underneath them — the drill, the zoom animation, the view-stack push, the drill sound, the WASD/R/F
camera pan, the wheel zoom, the whole search pipeline. What is missing is almost never the mechanism;
it is the wire from the new glass to the mechanism that is already there.

## Success criteria (Max's language)

- **"Every single thing needs to be functional and navigable by the player."** If the menu draws it,
  it does something. Nothing on the glass advertises a control that does not exist.
- **Clicking the map picks what is under the pointer.** The map pane says `CLICK A SECTOR`,
  `CLICK A TILE`, `CLICK A STAR`, `CLICK TO ENTER` — at every level, in both designs, that is true.
- **The star map moves when I move the camera.** `WASD PAN` and `R/F UP` are printed on the glass;
  pressing them moves the picture, and the "VIEW n PC ACROSS" readout tells the truth.
- **The keys the glass names do what the glass says.** `TAB` changes level. `ENTER` commits the warp
  or the burn. `[` `]` sort. The pager pages. `/` opens a search.
- **"Reusing systems from the old design where feasible."** Nothing that already works downstream
  gets a second implementation.
- **"You should be able to test the basic functionality since these are all menu systems."** Max is
  not handed a walk to perform to find out whether it works.

## What is deliberately NOT in scope

- The diegetic cockpit panel. Both designs ship, so the panel eventually has two sources to
  represent — that is a later workstream and this one must not change the panel.
- Design 3. Killed by all three judges; do not add it.
- Any change to what the legacy `viewMode === null` nav draws.
