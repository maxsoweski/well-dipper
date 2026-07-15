# orrery-coherence-2026-07-15 — intent

**Orientation:** Well Dipper → SCREENSAVER heart (35%) → flight-reliability program →
sibling A of the post-ship pair (sibling B = autopilot-depart-2026-07-15). Mode-ownership
shipped the regime model; this workstream finishes the ORRERY half of it.

## Why we care

Max's standing principle (3rd articulation, 2026-07-02): **"I do not want/need autopilot
for orrery. And I don't want these modes to mix."** — and 2026-07-01: **"ORRERY is a
player-driven feature."**

His 2026-07-11 UAT findings, verbatim:

> "when I enter the Orrery mode, I get stalled at the title page (because that's how the
> title page works; not an issue inherently, but how am I supposed to get into a system
> other than by...). Two: when I warp into a system in orrery, there's the whole shaking
> cam and unskippable auto fly-in towards the system star. 3. Again, in Orrery mode, I
> still have the "burn for" workflow and when I click on a system body, I do not
> automatically fly to it (should work like: click 1 selects, click 2 quickly moves us
> over to that body). Think about this holistically. Look at the code. Look at the UI.
> Consider the whole point of Orrery and what does/doesn't fit."

The holistic read Max ratified at scope (2026-07-15): **ORRERY is a god's-eye,
player-driven contemplation of the system — nothing flies in ORRERY; things only view.**
Every finding is the same defect: ship machinery (warps, fly-ins, burns, tour arming)
leaking into a mode that should only move a viewpoint.

## Success criteria (Max's language + scope-session picks)

- Entering a system from ORRERY is an **instant framed cut** — the whole system framed
  in view, no cinematic, no shake, no fly-in (his pick over glide/skippable-cinematic).
- **No "burn for" workflow in ORRERY at all** — BURN hidden entirely, no silent swap to
  HELM (his pick over an explicit crossover button).
- **Click 1 selects, click 2 quickly moves us over to that body** — as a smooth glide of
  the view (his pick over instant snap).
- Nothing in ORRERY ever flies the ship: no auto-warp timers, no Tab/number-key flying,
  no NavComputer AUTOPILOT arming a tour from ORRERY.
- A nav selection the player makes mid-boot wins over the boot tour's own warp
  (coordinator-flagged collision, folded here — player intent beats autopilot).

## Deliberate non-goals

- No change to HELM: the boot screensaver tour, F/Z semantics, and the warp cinematic in
  HELM stay exactly as shipped (mode-ownership AC12).
- The screensaver's onTourComplete re-arm loop is CORRECT behavior while hands-off in
  HELM (it IS the screensaver); this workstream only pins that it never runs in ORRERY
  and stops when the player takes the stick.
- Pilot motion code (SupercruisePilot / AutoNavigator / tourStandoff / SC_TUNING) is
  untouched — that's sibling B's territory.
