# supercruise-freelook-2026-06-10 — intent

## Why we care

Max (2026-06-10): "the next thing I want to fix/dev is the movement system for the
player and camera. I basically want to clone the supercruise flight system from
Elite Dangerous as a starting point and rewire the autopilot to drive that system
in place of what's there today. Along with a freelook system, again, basically
like Elite."

This is the dev arc the warp-arrival spec anticipated: "zero investment in tuning/
characterizing the current AutopilotMotion fly-in (it is slated for replacement);
`warpRevealSystem`'s nav handoff is the expected supercruise integration seam."
One movement system, two drivers — the autopilot flies it for the screensaver,
Max grabs the same controls when he wants to fly.

On the cockpit (Max, this session): "We will create a cockpit in the near future,
so we don't need to do that first but we do need whatever systems we create to
allow for that inclusion in the future. What's important is the player movement
is independent of the freelook system (again I want to start just by cloning
Elite Dangerous's systems here)."

On arrival feel (Max, this session): "today's arrival is a shaking, fast decel
(and acceleration is the inverse)... already basically an Elite clone" — those
felt beats are preserved and ported onto the new flight model, not reinvented.

**Journey context:** rebuilds the travel-loop foundation the 35% SCREENSAVER-MVP
autopilot rides, and lands the first GAME-tier (85%) capability — manual flight.

## Success criteria (Max's language)

- The supercruise flight system is cloned from Elite Dangerous as the starting
  point: throttle-controlled flight along the ship's nose, max speed scaled by
  proximity to massive bodies (slow near planets, enormous in deep space), heavy
  smooth acceleration, capped turn rate.
- The autopilot is rewired to drive that system in place of what's there today —
  the post-warp fly-in, the system-tour legs, and the nav-computer COMMIT BURN
  transit all fly via supercruise (all-in-system-motion scope, Max's pick).
- Manual piloting works: mouse as virtual joystick with an on-screen indicator,
  W/S throttle (Elite convention); fly to a body, decelerate into the drop
  window, arrive; come in too hot and you overshoot.
- A freelook system, basically like Elite: hold-to-look, view swings free while
  the ship keeps flying its line, recenters on release. Player movement is
  independent of the freelook system.
- Whatever systems we create allow for the future cockpit inclusion (ship
  transform and head/camera mount are separate from day one).
- Today's arrival beats survive: shaking fast decel on arrival, the inverse on
  acceleration.
- Minimal screen-space HUD (working-Claude recommendation, unvetoed): speed
  readout, throttle indicator, virtual-joystick reticle, target marker with drop
  window.
- The screensaver loop does not regress: title → warp → billboard-distance
  arrival → tour → auto-warp, indefinitely; Toy Box and mobile untouched.

## Out of scope

- Cockpit / ship visual (near-future follow-on; this arc only keeps the door open).
- World-origin rebasing (camera-as-ship at system scale doesn't hit the float32
  limit; rebasing remains the prerequisite for the cockpit/ship-scale arc).
- Relativistic time dilation (March design — superseded as motion model by
  supercruise; revisit separately if still wanted).
- Wide-binary arrival geometry (queued feature).
- The warp tunnel itself (FOLD/ENTER/HYPER/EXIT stays as shipped; supercruise
  takes over at the warpRevealSystem nav handoff).
