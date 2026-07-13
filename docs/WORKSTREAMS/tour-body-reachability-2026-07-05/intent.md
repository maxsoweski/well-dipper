# tour-body-reachability-2026-07-05 — intent

## Why we care
(Max's motivation, captured by working-Claude — reword at greenlight if it's not how you'd say it.)

The HELM autopilot is meant to be a screensaver that flies you around the system, sightseeing.
Right now it picks a body, sits still, and jumps to another without ever going there — so it isn't
touring anything. Max noticed it directly: "an object is selected, we don't move to it, then another
object is selected." It needs to actually fly to the bodies it selects, so the screensaver reads as a
real sightseeing flight instead of a frozen carousel.

Two distinct defects produce that same symptom, and both are in scope (Max, 2026-07-05: "Both defects,
but take all due diligence to avoid the patch-loop risk"):
1. **Barrier-pin carousel** (dominant) — the pilot aims a straight line at each target and only routes
   around the *star*, so a moon on the far side of its planet is flown at *through* the planet; the
   ship pins against the planet's collision barrier at speed 0, the 12s stall-abort correctly fires,
   and the tour re-dispatches the next leg from that same pinned spot → repeats. Logged as "RC2" in the
   2026-07-01 triage, identified but never fixed on this branch.
2. **Drive-drop near big stars** — a manual-flight safety (forced proximity drop-out, gated only on
   `_scManual`, which is true for the whole HELM tour) turns the supercruise drive OFF mid-tour near
   large stars, and there is no hands-off way to turn it back on; the ship then crawls at sublight
   (~0.0015 u/s) and can't cross the legs.

## Success criteria (Max's language / observable)
- When the tour selects a body, the ship **visibly travels to it and arrives** — no more "select, sit
  still, jump to a different target."
- **Moons on the far side of their planet get reached** — the ship routes around the planet instead of
  ramming it and giving up.
- Over a full multi-body tour, the ship makes real progress on essentially every leg — **stall-aborts
  stay near zero**, not an endless carousel.
- The supercruise **drive stays engaged through the tour** (even near big stars) — the ship never
  silently drops to a sublight crawl mid-tour.
- *(Regression)* The existing **star go-around still works**; the 307 flight/auto tests stay green; the
  mode-ownership regime is untouched; **`SC_TUNING` stays byte-identical**.
- *(UAT — Max alone)* Watching a full HELM tour, it reads as a **coherent sightseeing flight** —
  purposeful travel to and around each body, moons included.

## Due-diligence note (patch-loop avoidance)
Guarded flight code + two mechanisms. Plan each fix independently and TDD-first; verify each coherent
unit (headless + live) before moving to the next; stop-and-design on any second fix attempt rather than
stacking patches. The cap-relative stall-abort itself is CORRECT and stays as a backstop — the fixes
remove the *causes* of the pin/crawl, they do not weaken the safety.
