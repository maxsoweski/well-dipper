# Review — Well Dipper navigation menus: can a player find their way around from what's on screen?

## What this is
Well Dipper is a space-exploration game in the browser. Pressing N opens the **nav computer**: a
full-screen map with five zoom levels (GALAXY → SECTOR → REGION → PRISM → SYSTEM). The player uses it
to see where they are, inspect stars/planets/moons, pick a destination and commit a burn/warp to it.

There are three "looks" for this menu, cycled with V:
- **Design 1 ("rail")** and **Design 2 ("bars")** — the new retro-terminal looks. They are drawn into a
  small pixel buffer (572×240 texels here) that is scaled up to fill the window, so every glyph is a
  chunky pixel font. These two are what we are improving.
- **Legacy** — the older smooth-vector nav, kept as a fallback. Two captures are included only as a
  point of comparison.

## What Max wants to know (the acceptance criterion)
Max's words: *"What we care about here is whether the visual menu systems are easy to navigate/use based
on what you can see onscreen."*

So judge as a first-time player looking at these screens: can you tell where you are, what you can do,
what's selected, what a click/key will do, and read the information you came for? You are the
usability reviewer; you do not need to know the code. Judge only what is visible.

## The screenshots (attached in this order; all 2482×1041, the real game window)
1. `d1-01-system.png` — Design 1, SYSTEM level, in the Sol system, nothing selected.
2. `d1-02-system-hover.png` — same, mouse hovering the planet "Azcai" (hover callout).
3. `d1-03-system-selected.png` — Azcai clicked once = selected; bottom bar offers the burn (Enter).
4. `d1-04-planet-moons.png` — Azcai clicked again = the planet's moon sub-view.
5. `d1-05-prism.png` — Design 1, PRISM level (the local stars in 3D, seen from the side).
6. `d1-06-prism-hover.png` — same, hovering one star.
7. `d1-07-region.png` — Design 1, REGION level.
8. `d1-08-sector.png` — Design 1, SECTOR level.
9. `d1-09-galaxy.png` — Design 1, GALAXY level.
10. `d1-10-search-planet-noresult.png` — search opened with `/`, typed "azc" (a planet in this system): no results.
11. `d1-11-search-stars.png` — search, typed "ta": star results.
12. `d2-01-system.png` — Design 2, SYSTEM level, Sol.
13. `d2-02-system-hover.png` — Design 2, hovering planet "Meagis".
14. `d2-03-planet-moons.png` — Design 2, Meagis moon sub-view.
15. `d2-04-system-listtoggled.png` — Design 2 SYSTEM after pressing L (its list-mode key).
16. `d2-05-prism.png` — Design 2, PRISM.
17. `d2-06-region.png` — Design 2, REGION.
18. `d2-07-sector.png` — Design 2, SECTOR.
19. `d2-08-galaxy.png` — Design 2, GALAXY.
20. `legacy-01-galaxy.png` — Legacy look, GALAXY (comparison only).
21. `legacy-02-system.png` — Legacy look, SYSTEM in Sol (comparison only).

Things I (Claude) noticed while driving, for your context — confirm or dismiss them, don't just repeat them:
- In the Sol system, the designs show generated names (Sol-1, Cadein, Kheacel…) while legacy shows the
  real ones (Mercury… Jupiter, Saturn). Known issue already logged; mention it only if it hurts navigation.
- A Tab pressed while the level-change animation is still playing is ignored (felt as "Tab sometimes doesn't work").

## What to deliver (in `report`)
1. **Per-screen findings** — for each screenshot, the concrete problems a player would hit, each with:
   what you see (quote the on-screen text / name the region), why it hurts navigation, severity
   (`blocker` / `major` / `minor` / `polish`).
2. **Cross-cutting issues** — problems that repeat across screens or both designs (legibility, overlap,
   clipping, contradictory hints, unclear state, inconsistent key hints between designs, etc.).
3. **Design 1 vs Design 2** — which is easier to use right now, by what criteria, with the evidence.
4. **Ranked fix list** — the top 10 changes by (player impact ÷ effort). For each: the visible outcome
   after the fix ("the header row is fully visible", "the callout never covers the name it describes"),
   and whether it is an **obvious fix** (small, clearly right, no taste call) or a **judgment call** that
   Max should decide. Describe WHAT should change on screen, not how to code it.

Be specific and evidence-based: every finding must point at something visible in a named screenshot.
Say when you are unsure (e.g. a pixel-font glyph you can't read, or something that might be deliberate).
This is a read-only review: write no files; `artifacts` is an empty list.
