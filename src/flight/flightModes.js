// Pure flight-assist mode definitions + state machine.
// As of §supercruise-flight-toggle-settings-design-2026-06-25, F is a 2-state
// ON/OFF toggle (flight on / flight off → Toy Box), and the flight TYPE
// (Manual / Align / Assist) is chosen in Settings, not by cycling F. The enum,
// flightModeInfo, and isManualInput are all still in live use.
// `advanceFlightMode` (the old 4-state ring helper) and `INFO.exit` are
// RETAINED-BUT-UNUSED-BY-F — kept importable for the deferred control-harness
// arc; see the matching note at main.js ~line 45. Do not delete them.
// `_flightMode` (in main.js) holds the in-flight type; "off" is _scManual === false.
export const FlightMode = Object.freeze({
  MANUAL: 'manual',
  ALIGN: 'align',
  ASSIST: 'assist',
});

// One F press. Returns the NEXT state:
//  - not in flight  → enter at MANUAL.
//  - MANUAL→ALIGN, ALIGN→ASSIST (stay in flight).
//  - ASSIST→exit:true (leave flight; mode null).
export function advanceFlightMode(current, inFlight) {
  if (!inFlight) return { mode: FlightMode.MANUAL, inFlight: true, exit: false };
  switch (current) {
    case FlightMode.MANUAL: return { mode: FlightMode.ALIGN, inFlight: true, exit: false };
    case FlightMode.ALIGN:  return { mode: FlightMode.ASSIST, inFlight: true, exit: false };
    case FlightMode.ASSIST: return { mode: null, inFlight: false, exit: true };
    default:                return { mode: FlightMode.MANUAL, inFlight: true, exit: false };
  }
}

const INFO = {
  [FlightMode.MANUAL]: { label: 'Manual', hint: 'you fly' },
  [FlightMode.ALIGN]:  { label: 'Align-on-select', hint: 'nose centers on your target' },
  [FlightMode.ASSIST]: { label: 'Assist', hint: 'auto-flies to target — steer to take over' },
  exit:                { label: 'Exit flight', hint: 'back to Toy Box' },
};
export function flightModeInfo(modeOrExit) {
  return INFO[modeOrExit] ?? INFO[FlightMode.MANUAL];
}

// Pure transition table for the E key (supercruise DRIVE toggle), per
// §supercruise-arrival-modes-design-2026-06-27. E is orthogonal to F (free-look)
// and Esc (regime). Three player-facing situations map to three actions:
//   - not In-Flight (Toybox)        → 'engage'   (enter In-Flight + drive ON)
//   - In-Flight, drive ON           → 'dropout'  (drive OFF, STAY In-Flight, coast)
//   - In-Flight, drive OFF (parked) → 'reengage' (drive ON again, anti-clip via cap)
// The caller (main.js) maps each action to the concrete side-effects (scControls
// .engage / model.setDrive / enter|dropImpulse). Pure so the transition is unit-
// testable without three.js or the live host.
export function nextDriveAction(inFlight, driveOn) {
  if (!inFlight) return 'engage';
  return driveOn ? 'dropout' : 'reengage';
}

// Autopilot is ONE concept with two target SOURCES (§supercruise-arrival-modes
// -design-2026-06-27, Feature 4 / plan Task 8). Both drive the SAME pilot
// (SupercruisePilot) through the SAME door (scControls.flyTo) — they differ only
// in WHO picks the target:
//   - 'tour'   (Q autopilot / screensaver): the SYSTEM picks (AutoNavigator tours
//              every body). startFlythrough/_beginTourLegMotion → scControls.flyTo.
//   - 'assist' (player-directed):          YOU pick (aim+select in free-look, OR
//              the nav computer), then commit. _engageAssist / commitBurn → focus*
//              → scControls.flyTo.
// This descriptor pins the framing as code so the consolidation can't silently
// drift; it carries no behavior (the live paths already converge on flyTo).
const AUTOPILOT_SOURCES = {
  tour:   { label: 'Autopilot tour', picks: 'system', door: 'scControls.flyTo', hint: 'system tours every body (screensaver)' },
  assist: { label: 'Assist',         picks: 'you',     door: 'scControls.flyTo', hint: 'flies to the body you picked (aim+select or nav), steer to take over' },
};
export function autopilotSourceInfo(source) {
  return AUTOPILOT_SOURCES[source] ?? AUTOPILOT_SOURCES.tour;
}

// True when the player is actively steering/throttling — cancels a Mode-B align
// and disengages a Mode-C hold. `stick` is the deadzone-shaped {x,y} (0 inside
// deadzone), `throttleDir` is -1|0|1 from W/S.
export function isManualInput(stick, throttleDir) {
  const sx = stick?.x ?? 0, sy = stick?.y ?? 0;
  return throttleDir !== 0 || (sx * sx + sy * sy) > 0;
}
