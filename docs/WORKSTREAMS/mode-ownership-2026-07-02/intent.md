# mode-ownership-2026-07-02 — intent

**Orientation:** Well Dipper → SCREENSAVER heart (35%) → flight-reliability program →
this workstream unblocks Max's clean Step-0 re-UAT (his first pass was contaminated by
mode-mixing), then inc-2. PLAYER_EXPERIENCE tier: SCREENSAVER.

## Why we care

Max, 2026-07-02 (3rd articulation, standing): **"I do not want/need autopilot for
orrery. And I don't want these modes to mix."**

Max, 2026-07-01: **"HELM should be our chosen Autopilot path; the Autopilot is a HELM
feature. ORRERY is a player-driven feature."**

The felt problem: Max ran the Step-0 UAT from HELM, and HELM's inputs bled under the
autopilot — Q/E roll persisted into the tour's flight, the mouse jiggled the reticle,
the hands-on HUD claimed he was flying while the pilot flew. He saw movements "that
don't look like what the flight navigation system is capable of outputting" and
couldn't judge the tour itself. The ship needs a single owner at all times; the
motion-authority trace (`docs/FLIGHT_TOUR_MOTION_AUTHORITY_TRACE_2026-07-02.md`) mapped
every leak. Current boot mapping is also the inverse of Max's model
(`flightModes.js:201-204`: ORRERY→autopilot, HELM→manual).

## The control model (Max's words, scope session 2026-07-02)

> "let's make sure W/S only works in flight mode. Pressing F should put control back
> into the player's hands, and autopilot should only work if we toggle flight controls
> off with F. Pressing Z should toggle-off flight control if the player is in flight
> control mode when they press it."

> "Let's make sure mobile can work via Orrery, and have Helm autopilot on by default
> for mobile if they choose that mode."

Plus three confirmed picks (Max chose the recommended option in each case):
- **F = one hands-on/off toggle.** Hands-OFF absorbs today's free-look (free cursor for
  aim/select, LMB-drag to look) and is the ONLY state where autopilot may fly. F during
  a tour = take the stick (tour stops).
- **Desktop HELM boots into the tour, hands-off** (the cockpit screensaver; F grabs the
  stick). Mobile-HELM likewise, autopilot on by default.
- **ORRERY keeps its WASD camera-fly** — it's an orrery camera control, not a ship
  flight control. "W/S only works in flight mode" applies to the ship's throttle.
- **Idle → tour only from HELM** (Max picked the strict reading). ORRERY idles forever;
  it never auto-arms the tour — not at boot, not on idle.

## Success criteria (Max's language)

- The modes don't mix: during an autopilot tour, no hand input moves the ship — W/S
  only works in flight mode, Q/E roll doesn't persist into the tour, the mouse never
  steers under the pilot.
- Pressing F puts control back into the player's hands; autopilot only works with
  flight controls toggled off.
- Pressing Z toggles-off flight control if the player is in flight-control mode (and
  starts the tour); Z during the tour stops it.
- No autopilot for orrery: ORRERY never auto-arms the tour — not at boot, not on idle.
- HELM is the autopilot path: picking HELM at the title boots into the cockpit
  screensaver tour, hands-off.
- Mobile works via Orrery, and mobile-HELM has autopilot on by default.
- The HUD tells the truth: steering reticle + hidden cursor only when hands-on.
- The 2026-06-27 peer-mode design doc is reconciled — its god's-eye-tour framing,
  "tour in both modes" non-goal, and F=free-look semantics are marked stale (this is a
  deliberate, thrice-stated reversal, not drift).

## Non-goals (deliberate)

- **Assist-type legs stay as-is.** Player-directed burns (Space commit) keep today's
  semantics — W/S cancels the leg (`manualCancelsLeg`), `commitBurnSwapsToHelm`
  untouched. The hands-on/off mutual exclusion is scoped to the TOUR; extending it to
  Assist is a named follow-up for Max to call.
- No arrival-easing change (HOLD lerp vs physics decel = inc-2 taste call), no tour
  pacing work, no `SC_TUNING` touch, no DEPART phase (inc-2), no touch hand-flying on
  mobile (mobile leaves the tour via the mode-swap HUD button → ORRERY).
- Carry-in from Step-0's AC6 rescope: none (arrival-rate/keep-out clauses went to
  inc-2, not here).
