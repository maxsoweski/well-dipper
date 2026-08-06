# cockpit-screen-content-2026-07-28 — intent

## Why we care

Max, this session:

> "this is going to be the default autopilot/screensaver aesthetic."

> "I want the monitors to display stuff in a default helm view, but then be able to select them with my cursor/a hotkey and have that screen move towards the camera's POV to center it/zoom it in."

> "click and hold in free look makes the cursor disappear and looks around; otherwise the cursor is on and you can use it to interact with the screens. We still need hotkeys for the screens though."

> "one thing that always needs to display on one of the screens is the nav computer."

The through-line: the four screens are not decoration bolted onto a HUD — they **replace** it. DIEGETIC-ONLY means the DOM/canvas overlays retire in HELM and everything a pilot glances at lives inside the glass. That is why scope discipline here is narrow and unusually strict: this lane owns **what the four panels say and how the nav computer is hosted on one of them**, and nothing else. No geometry, no invented instruments, no second HUD for ORRERY.

## Journey context

`docs/FEATURES.md` carries the Cockpit row as **F&F-MVP / proposed** ("visual frame + reactive HUD readouts + status lights pulsing w/ engine state"). `docs/PLAYER_EXPERIENCE.md` puts us in the **SCREENSAVER tier (F&F MVP target)** — "Viewer, not player. Passive observation... running this on a second monitor or as a contemplative background." That is exactly the frame Max invoked when he said this is the default autopilot/screensaver aesthetic, which is why the hands-off tour is a first-class case here and not an afterthought.

⚠ **No milestone percentage is cited.** `docs/JOURNEY.md` was last committed 2026-05-19 — roughly ten weeks stale as of today — and its "35% — SCREENSAVER MVP shipped (CURRENT)" block predates the entire supercruise/free-look ship, the naming work, and both cockpit lanes. Quoting a number off it would be quoting a number nobody has re-derived. Tier is safe; percentage is not.

## Success criteria (Max's language)

- The four screens show what they're supposed to show and it's **live, not a mock-up** — speed in the tiers it already uses, the throttle, the drive, the target and its ETA, SAFE TO DROP / SLOW DOWN, the body dossier that today only exists in the debug HUD.
- **The nav computer is on one of the screens, always** — from the first frame after boot, with nobody having pressed anything.
- Boot into HELM, take your hands off the stick, and **the cockpit is around you for the whole tour** — every leg, the warp, the arrival. Boot into ORRERY and it's never there.
- When the tour hands over to the nav computer to pick the next star, **that whole performance plays on the NAV screen** — the drill-down, the blinking cursor, the pick — and the ship still actually warps, so the screensaver loop closes.
- **Default glanceable, zoomed operable.** The screen comes to the eye, not the camera to the screen.
- **One ink inside the glass.** A warning has to shout using words and a blink, because it can't use colour.
- **Press M and ORRERY is exactly as it is today.** Retiring the HUD is a HELM decision; it must not take ORRERY's instruments with it.
- The nav computer **doesn't eat my flight keys** while it's sitting in its socket. W/S still move the throttle, R still toggles the drive, F still gives me the stick back.
- **Nothing I had got lost** — everything I used to glance at is still somewhere I can glance at, and the ship still feels like it flies the way it flew.

## Lane boundary

Lane E owns the cockpit's geometry and its tooling: `scripts/cockpit-gen.py`, `cockpit-lab.html`, `tests/cockpit-geometry.test.js`, and everything under `public/assets/cockpit/`. **Lane F treats all four as READ-ONLY** — it writes its own test files, its own runtime modules, and never edits lane E's to make something pass.

**Lane F binds to the SURFACE, never the POSE.** Panel size, aspect, position and existence are measured off whatever cockpit GLB is loaded, at load. Nothing about 0.45 × 0.30 or 3:2 gets written down in lane F's code — not directly, and not by reading it back out of the sidecar, which is the same hard-coding one indirection out. Lane E is actively re-fitting screens onto a rebuilt hull (`cockpit-tub.glb` currently ships with zero `Screen_*` nodes); any lane-F assumption about where a panel *is* will break.
