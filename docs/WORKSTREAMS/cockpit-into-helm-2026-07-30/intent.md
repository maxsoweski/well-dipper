# cockpit-into-helm-2026-07-30 — intent

Increment 7 of the HELM cockpit program. The first increment that puts the cockpit in
the game.

## Why we care

Max, 2026-07-30: *"I want to move asap to getting this wired up and working in-game."*

Six increments have built a cockpit that only exists in a lab. The geometry, the four
Phosphor screens, the live data feed, and the zoom-to-panel rig are all done and Max
likes them — and none of it has ever been on screen while he was flying. Every clause
increment 6 could not verify failed for the same reason: **nothing in `src/` builds a
`PanelHost`.** The autopilot toggle, the COMMIT action, the far-companion chip and the
component sub-view are not hard, they are *hostless*.

This is also where the program's founding ruling comes due. Max chose **DIEGETIC-ONLY**
at scoping — the four in-world screens *replace* the DOM/canvas HUD overlays, they do
not coexist — and on 2026-07-30 he chose to do that retirement **in this increment**
rather than after first light. That was against the recommendation to split it; the
concern was stated (first light and demolition in one increment, and it forces the
ORRERY answer immediately) and he confirmed. So this increment carries both.

The through-line for scope discipline: **flying the game from inside the cockpit.** Not
"the cockpit renders" — the screens have to be the instruments he actually reads and
operates while flying, and the overlays they replace have to be gone.

## Success criteria (Max's language)

- **I fly the game in HELM and the cockpit is there** — looking through the canopy, four
  screens at the corners showing real data about the flight I am actually in.
- **The screens replaced the overlays, they don't sit alongside them.** In HELM the DOM
  flight readouts are gone, not hidden behind them.
- **ORRERY still works.** Max, 2026-07-30: ORRERY keeps the nav computer and body info —
  the things you *operate* — and loses the flight readouts, which were HELM concepts
  anyway. ORRERY has no cockpit to host anything, and it must not become a mode you
  can look at but cannot steer.
- **I zoom the upper-left monitor in the game and work the full menu** — Max at increment
  6 scoping: *"a system by which the screen will move up to fill the player's view,
  centered, so we can interact with the full menu."* Tabs, drill into a star, planet
  detail, all on the glass, in the game.
- **The autopilot button on the panel actually toggles autopilot** — and the label reaches
  `AUTOPILOT ON`, which it has never been able to do in the lab.
- **COMMIT fires the warp** — pressing `[ WARP ]` on the glass does what pressing it in the
  overlay did.
- **A quick click works. I don't have to press and hold.** The defect he found at
  increment 6 UAT was a missing hover channel in the lab's pointer routing; the game
  writes its own routing from scratch and must not reproduce it.
- **Autopilot always has a cockpit.** Max, 2026-07-30: the four paths that reach the
  cinematic flythrough with `_scManual === false` get routed through the hands-off tour,
  so pressing autopilot from inside the cockpit does not eject him from it.
- **The screensaver still loops.** `AutopilotNavSequence` is act two of the screensaver
  and it performs the nav computer to pick the next star — in HELM it has to perform the
  *cockpit's* NAV panel, not open a DOM overlay on top of the cockpit.
- **Flight keys still fly the ship while a panel is zoomed.**
- **Nothing I had got lost** — warp, the tour, save/load, the mobile controls, ORRERY.

## Deliberately NOT in this increment

- **Head decoupling** (head trails the hull, positional sway). Max, 2026-07-30: its own
  step right after. It is a feel knob that wants lab sliders and his eye, and bundling it
  means neither first light nor the decoupling can be judged cleanly.
- **Glass refraction.** Increment 3's screen-space refraction was never built; the lab's
  canopy is a plain mesh with a visibility toggle. Max, 2026-07-30: carry it as-is. The
  cockpit still renders as its own pass (precision and the resolution knob), but sampling
  the composited world is separate work and does not block flying.
- **The articulated arm.** Max, 2026-07-30, on the empty stub left behind by a travelling
  monitor: *"the arm should travel with the monitor (or rather it should realistically
  bend/extend along with the monitor moving)."* That is generator geometry — the arm is
  one baked mesh with world-space vertices and no transform, so bending means
  re-authoring it as segments in `cockpit-gen.py` plus a mover that drives them. Its own
  workstream, explicitly not folded in here.
- **The 1-px letterbox `y` divergence** is settled *inside* this increment rather than
  before it: the game installs a fresh `PanelPicker` against the game's camera and
  letterbox, which is the surface the convention has to be decided against.
