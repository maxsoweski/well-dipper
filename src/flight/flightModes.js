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
  exit:                { label: 'Swap to ORRERY', hint: 'leave the Helm for the orrery' },
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

// The in-flight mode a PLAYER-DIRECTED burn runs under (§supercruise-arrival-modes
// -design-2026-06-27, #1 takeover fix). A commit-burn (Space → commitBurn →
// focusPlanet/Star/Moon → scControls.flyTo) — and an in-flight reselect via the
// same focus* door — activates scPilot. Pre-fix it left _flightMode at MANUAL, so
// the manual-cancel gates (manualCancelsLeg) could never fire and the burn was
// uncancellable. Running the leg under ASSIST makes the existing gates satisfy.
// This is the player-directed source ONLY — the Q autopilot TOUR keeps MANUAL and
// its own separate W/S takeover (main.js ~8918), so the gate stays targeted.
export function playerBurnMode() {
  return FlightMode.ASSIST;
}

// The live takeover-gate predicate (main.js W/S ~7933, stick ~9305/~9308),
// extracted pure: manual input cancels the leg IFF an ASSIST leg is actively
// flying. Deliberately NOT broadened to "any pilotActive" — that would also catch
// the system-picked autopilot TOUR (which runs at MANUAL with its own takeover).
export function manualCancelsLeg(flightMode, pilotActive) {
  return flightMode === FlightMode.ASSIST && !!pilotActive;
}

// The Esc cascade, extracted pure (§supercruise-arrival-modes-design-2026-06-27,
// #2 "Esc de-mode"). Esc must NEVER switch modes (ORRERY <-> HELM). The OLD
// cascade ended with an exit-flight-to-Toybox step (main.js: if (_scManual) {
// freeLook.exit(); scModel.setDrive(false); _exitFlightInternal(); return }) —
// that step is REMOVED. Leaving HELM is now ONLY via the swap key / HUD button /
// Options item, never Esc. New order, highest priority first:
//   1. an open overlay (debug/pretext/sound/nav/settings/keybinds) → close it
//   2. a selected body                                             → deselect it
//   3. otherwise                                                   → NOTHING
// Crucially the regime (`scManual` — HELM vs ORRERY) is NOT an input to the
// decision: mashing Esc can at most drop your selection, never strand you in or
// out of a mode. The live handler keeps its richer per-overlay branching (which
// overlay, handleEscape levels); this reducer pins the ORDER + the no-mode-switch
// invariant so it can't silently regress. The late ORRERY focusPlanet(-1) reset
// (a focus reset WITHIN ORRERY, not a mode switch) is a separate, lower path and
// is intentionally not modelled here.
export function escCascadeAction({ overlayOpen, hasSelection } = {}) {
  if (overlayOpen) return 'dismiss-overlay';
  if (hasSelection) return 'deselect';
  return 'none';
}

// The M-key ORRERY<->HELM peer-mode toggle, extracted pure (§supercruise
// -arrival-modes-design-2026-06-27, #2 "two peer modes"). M swaps the two
// stations BOTH directions; it NEVER lights the drive (that distinction is E's:
// E-from-ORRERY = swap + drive ON; M = swap stations only, drive untouched).
//   - in HELM   (scManual === true)  → swap to ORRERY via the pose-preserving
//     exit (_exitFlightInternal — the SAME no-snap path the old Esc-exit used).
//   - in ORRERY (scManual === false) → swap to HELM via _enterFlightInternal,
//     WITHOUT forcing the drive on (drive state preserved).
// Returns a descriptor the live handler maps to side-effects:
//   { target: 'orrery'|'helm', enterFlight, exitFlight, lightDrive:false }.
// `enterFlight`/`exitFlight` are mutually exclusive (XOR); `lightDrive` is
// always false so the swap can never silently engage the drive.
export function modeSwapAction({ scManual } = {}) {
  if (scManual) {
    // HELM → ORRERY
    return { target: 'orrery', enterFlight: false, exitFlight: true, lightDrive: false };
  }
  // ORRERY → HELM (drive untouched)
  return { target: 'helm', enterFlight: true, exitFlight: false, lightDrive: false };
}

// Whether a commit-burn (Space on a selected target) should auto-swap ORRERY→HELM
// (§supercruise-arrival-modes-design-2026-06-27, #2 "select-and-jump → HELM"). The
// swap runs the burn as a player-directed ASSIST leg on the SUPERCRUISE mover, so
// it must apply ONLY to targets that fly on scPilot — celestial bodies (planet/
// star/moon). SHIP targets keep the QUARANTINED-LEGACY navSubsystem ship-lock path
// (focusShip), which only advances in the non-_scManual (ORRERY) regime via
// flythrough.update; swapping a ship-burn into HELM routes the sim into the
// supercruise branch (scActive = scPilot.isActive || _scManual) and STARVES that
// motion — the ship is never approached and the player is stranded parked in HELM.
// So: swap IFF launching from ORRERY (!scManual), not mobile (ORRERY-only), and the
// target is NOT a ship. Pure so the gate is unit-testable without the live host.
export function commitBurnSwapsToHelm(targetKind, scManual, isMobile) {
  return !scManual && !isMobile && targetKind !== 'ship';
}

// The SPLASH MODE-PICKER boot decision, extracted pure (§supercruise-arrival
// -modes-design-2026-06-27, #2 "splash = mode picker", AC6). The existing title/
// splash screen presents two PEER choices — ORRERY and HELM — and selecting one
// launches the game into that mode via the SAME launch flow used today (we extend
// the existing boot, we do NOT invent a parallel one). This reducer maps the
// chosen mode to the one bit the live title-dismiss handler needs: whether boot
// should ENTER flight (HELM → _enterFlightInternal once the system is live, so
// _scManual becomes true) or stay in the orrery (ORRERY → _scManual stays false,
// today's autopilot-tour reveal). Any unknown/missing pick (including the legacy
// "press anything to begin" with no explicit choice) falls back to ORRERY — the
// safe, contemplative boot — so a stray value can never strand the player in
// flight. `enterFlight` is true IFF the chosen mode is HELM.
export function bootModeAction(mode) {
  const helm = mode === 'helm';
  return { mode: helm ? 'helm' : 'orrery', enterFlight: helm };
}

// The OS-cursor + flight-HUD-steering-reticle visibility decision, BY SUB-MODE,
// extracted pure (§free-look-interaction-redesign-2026-06-27, Part 1). One source
// of truth the live host (_applyPointerHud) applies on every transition that
// changes regime or free-look (enter/exit flight, ORRERY<->HELM swap, F toggle).
//   - HELM hands-on (regime 'helm', !freeLook) → cursor 'none', showReticle true.
//     The virtual joystick steers from the absolute cursor position, and the HUD's
//     center cross + deflection dot ARE the steering indicators — so we hide the OS
//     cursor (CSS cursor:none, NOT Pointer Lock — the joystick reads absolute mouse
//     position from canvas-center, which Pointer Lock would break, and Pointer Lock
//     hijacks Esc) and show the reticle.
//   - HELM free-look (regime 'helm', freeLook) → cursor 'auto', showReticle false.
//     In free-look the bare cursor is a FREE pointer for aiming/selecting bodies, so
//     it's shown; the steering cross + deflection dot don't belong here, so hidden.
//   - ORRERY (regime 'orrery')                 → cursor 'auto', showReticle false.
//     ORRERY is cursor-driven orbit/select; no flight steering reticle.
//   - mobile (isMobile)                        → cursor 'auto' ALWAYS. Touch has no
//     OS cursor to hide; never hide it on mobile regardless of regime / free-look.
// This SUPERSEDES the 2026-06-25 "cursor stays visible in flight" decision —
// selection now happens in free-look, where the cursor IS shown. Returns
// { cursor: 'none'|'auto', showReticle: boolean }. cursor 'none' (hidden) IFF
// desktop HELM hands-on flight; showReticle true under the same condition.
export function pointerHudState({ regime, freeLook, isMobile } = {}) {
  const helmHandsOn = regime === 'helm' && !freeLook;
  return {
    cursor: (!isMobile && helmHandsOn) ? 'none' : 'auto',
    showReticle: helmHandsOn,
  };
}

// The late, normal-mode (autopilot-off) Esc/Backquote fall-through (main.js
// ~8979). #2 "Esc de-mode": with the early-cascade exit-flight step removed, a
// quiet-HUD Esc now falls through to the ORRERY "system overview" focus reset
// (focusPlanet(-1)). That reset is an ORRERY-camera op, so it must fire ONLY in
// ORRERY (_scManual === false) — in HELM Esc does NOTHING (no camera disturbance,
// no mode change). Backquote is the dev shortcut and keeps its prior
// unconditional reach (it never went through the Escape branch). This predicate
// pins that gate so the HELM-no-op invariant can't regress. It is NOT a mode
// switch either way: focusPlanet(-1) never touches _scManual / _exitFlightInternal.
export function escFocusResetFires({ code, scManual } = {}) {
  return code === 'Backquote' || !scManual;
}
