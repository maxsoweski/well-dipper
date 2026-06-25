// Pure flight-assist mode state machine for the F-cycle.
// F rotates a 4-state ring: Manual → Align-on-select → Assist → Exit (leaves flight) → …
// `_flightMode` (in main.js) holds the in-flight sub-state; "off" is _scManual === false.
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
  exit:                { label: 'Exit flight', hint: 'back to autopilot' },
};
export function flightModeInfo(modeOrExit) {
  return INFO[modeOrExit] ?? INFO[FlightMode.MANUAL];
}

// True when the player is actively steering/throttling — cancels a Mode-B align
// and disengages a Mode-C hold. `stick` is the deadzone-shaped {x,y} (0 inside
// deadzone), `throttleDir` is -1|0|1 from W/S.
export function isManualInput(stick, throttleDir) {
  const sx = stick?.x ?? 0, sy = stick?.y ?? 0;
  return throttleDir !== 0 || (sx * sx + sy * sy) > 0;
}
