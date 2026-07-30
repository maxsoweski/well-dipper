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

// Where pointer MOTION goes, by free-look latch + left-mouse-button (§free-look
// -interaction-redesign-2026-06-27, Part 2). The redesign DECOUPLES looking from
// the latch: in free-look (latched), the head looks ONLY while the LEFT button is
// held; a bare cursor (LMB up) is a FREE pointer that neither steers the ship nor
// moves the camera (for aiming/selecting). Hands-on (NOT latched) keeps the
// absolute-position virtual joystick on every move.
//   - latched && lmbHeld  → 'look'  (HeadMount.addLook — drag to look around)
//   - latched && !lmbHeld → 'idle'  (free cursor — gate BOTH the look and the
//                                    joystick off; pointing/selecting only)
//   - !latched            → 'steer' (hands-on virtual joystick, LMB irrelevant)
// Pure so the routing is unit-testable without the live host. The mousemove
// handler maps 'look'→scHead.addLook, 'steer'→scControls.steer, 'idle'→nothing.
export function freeLookPointerRoute({ latched, lmbHeld } = {}) {
  if (!latched) return 'steer';
  return lmbHeld ? 'look' : 'idle';
}

// Hold-vs-recenter when a look-input is RELEASED (§free-look-interaction-redesign
// -2026-06-27, Part 2 step 4). Two release paths, two behaviours:
//   - in free-look (latched)   → 'hold'     — releasing the LMB after a look-drag
//     HOLDS the view where you dragged it; the head only recenters when free-look
//     is EXITED (F off, via freeLook.exit()→consumeRecenter()→head.beginRecenter()).
//   - hands-on (not latched)   → 'recenter' — the middle-mouse PEEK keeps its
//     Elite-style snap-back: release returns the view to nose-forward.
// Pure so the mouseup handlers can ask "what should release do?" without branching
// logic inline. Returns 'hold' | 'recenter'.
export function headReleaseAction({ freeLookLatched } = {}) {
  return freeLookLatched ? 'hold' : 'recenter';
}

// ⭐ THE HANDS-ON HEAD LOCK. Max, 2026-07-30, on flying with a cockpit around
// you: *"when we have the 'stick' our view should be locked to the center of the
// cockpit"* — and, on the peek surviving, *"so long as middle mouse release =
// snap back to central view angle."*
//
// ⚠ WHY THIS EXISTS WHEN `headReleaseAction` ALREADY SAYS 'recenter'. That one
// answers a QUESTION the mouseup handler asks; this asserts an INVARIANT the
// frame loop enforces. The difference matters because "recenter on release" only
// holds for the one path that remembers to ask. The head can be left parked
// off-centre by any route that never sees a middle-mouse release — exiting
// free-look while still dragging, a mode flip mid-peek, a flythrough clearing
// its own look state, or any future caller of `beginLook`. Each of those is a
// silent failure: the cockpit is posed FROM the head, so it simply renders at
// the wrong angle with nothing anywhere to say why, and "locked" quietly means
// "usually centred".
//
// So the lock is stated positively and checked every frame: in hands-on, either
// you are actively peeking, or you are on your way home, or you are home.
//
// ⚠ `centered` IS PASSED IN, NOT COMPUTED FROM AN ANGLE THRESHOLD HERE. The head
// snaps exactly to 0 at `SNAP_EPS`, so `HeadMount.centered` is the authority;
// re-deriving it against a second epsilon is how the ease and the lock end up
// disagreeing about whether the return has finished and the recenter re-arms
// forever, one frame on, one frame off.
//
// Pure so the invariant is testable without a camera, a canvas, or a ship.
// Returns true when the caller should fire `beginRecenter()`.
export function needsHandsOnRecenter({ handsOn, held, recentering, centered } = {}) {
  if (!handsOn) return false;   // free-look is SUPPOSED to leave centre — that is how you aim at a panel
  if (held) return false;       // the peek is the one sanctioned way off-centre
  if (recentering) return false; // already on the way home; re-requesting would restart the ease
  return !centered;
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

// The SPLASH MODE-PICKER boot decision, extracted pure. The existing title/
// splash screen presents two PEER choices — ORRERY and HELM — and selecting one
// launches the game into that mode via the SAME launch flow used today (we extend
// the existing boot, we do NOT invent a parallel one). This reducer maps the
// chosen mode to the two bits the live title-dismiss handler needs: whether boot
// should ENTER flight (HELM → _enterFlightInternal once the system is live, so
// _scManual becomes true) and whether it should START the autopilot tour. Any
// unknown/missing pick (including the legacy "press anything to begin" with no
// explicit choice) falls back to ORRERY with BOTH bits false — so a stray value
// can never strand the player in flight or auto-arm a tour.
//
// FLIPPED (docs/WORKSTREAMS/mode-ownership-2026-07-02, Max's standing model,
// thrice-stated 2026-07-01/02: "HELM should be our chosen Autopilot path; the
// Autopilot is a HELM feature. ORRERY is a player-driven feature" / "I do not
// want/need autopilot for orrery"): this SUPERSEDES the 2026-06-27 splash-picker
// semantics, where ORRERY carried the autopilot-tour reveal and HELM was
// manual-only. Now HELM boots the cockpit screensaver tour hands-off (F grabs
// the stick), and ORRERY arms nothing — ever, not at boot, not on idle.
// `enterFlight` is true IFF the chosen mode is HELM; `startAutopilot` moves in
// lockstep with it (both bits are the same "helm" bit — kept as two named fields
// because the live host consumes them as two separate side-effects).
export function bootModeAction(mode) {
  const helm = mode === 'helm';
  return { mode: helm ? 'helm' : 'orrery', enterFlight: helm, startAutopilot: helm };
}

// ---------------------------------------------------------------------------
// Mode-ownership reducers (docs/WORKSTREAMS/mode-ownership-2026-07-02). Max,
// 2026-07-02 (3rd articulation, standing): "I do not want/need autopilot for
// orrery. And I don't want these modes to mix." The felt problem: running the
// tour from HELM let hand inputs (Q/E roll, mouse, W/S) bleed into the pilot's
// flight and the HUD lied about who was flying (full leak table:
// docs/FLIGHT_TOUR_MOTION_AUTHORITY_TRACE_2026-07-02.md). These reducers give
// the ship ONE owner at a time via a single hand-state bit: hands-ON (the
// player flies) or hands-OFF (the autopilot may fly; free-look absorbed).
// ---------------------------------------------------------------------------

// Where every ship hand-input goes, and whether the autopilot is legal to fly,
// given the hand-state. Hands-ON: the player owns throttle (W/S), roll (Q/E),
// the mouse virtual-joystick steer, and the drive toggle (R) — and the
// autopilot may NOT fly. Hands-OFF: none of those hand-inputs reach the ship
// (free-look's bare-cursor-aim/LMB-drag-look behaviors live on top, routed
// separately by freeLookPointerRoute) — and the autopilot IS legal to fly.
// The two states are exact complements by construction: this is the single
// source of truth the ship-input block (main.js W/S ~8457-8464, Q/E roll
// ~8468), the mouse-steer gate (~10008), and the R drive toggle all read
// instead of each re-deriving "am I allowed to move the ship" independently.
export function handRouting(handsOn) {
  const on = !!handsOn;
  return {
    throttle: on,
    roll: on,
    mouseSteer: on,
    driveToggle: on,
    autopilotLegal: !on,
  };
}

// The Z key: "toggle-off flight control if the player is in flight control
// mode when they press it" (Max, scope session 2026-07-02) — and start the
// tour in that same press. Four situations, checked in order:
//   - regime 'orrery'        → 'hint'. ORRERY never auto-arms the tour — Z has
//     nothing to toggle there (no ship hand-state to turn off).
//   - a tour is ACTIVE       → 'stop-tour-coast'. Z during the tour stops it;
//     the ship stays hands-off, coasting (F is what grabs the stick back).
//   - HELM, hands-ON         → 'hands-off-start-tour'. One press does both:
//     turns flight control off AND starts the autopilot tour.
//   - HELM, hands-OFF        → 'start-tour'. Already hands-off; Z just arms
//     the tour (e.g. after an F-driven hands-off with no tour running yet).
// Pure so the key handler (main.js Z toggle, ~9582) can ask "what should this
// press do?" without re-deriving the regime/tour/hand-state branching inline.
export function zKeyAction({ regime, handsOn, tourActive } = {}) {
  if (regime === 'orrery') return { action: 'hint' };
  if (tourActive) return { action: 'stop-tour-coast' };
  return handsOn ? { action: 'hands-off-start-tour' } : { action: 'start-tour' };
}

// The F key: "Pressing F should put control back into the player's hands"
// (Max, scope session 2026-07-02). F is the ONE hands-on/off toggle; hands-off
// absorbs the free-look behaviors. Three situations, checked in order:
//   - regime 'orrery'  → 'none'. There is no ship hand-state to toggle in the
//     orrery (an orrery-camera regime, not a flight regime).
//   - a tour is ACTIVE → 'takeover'. F mid-tour always stops the pilot and
//     tour and lands hands-on, regardless of the stale pre-tour hand-state bit
//     — "F puts control back into the player's hands."
//   - otherwise (HELM, no tour) → flips hands-on <-> hands-off.
// Pure so the key handler (main.js F toggle, ~9550) can ask "what should this
// press do?" without re-deriving the regime/tour/hand-state branching inline.
export function fKeyAction({ regime, tourActive, handsOn } = {}) {
  if (regime === 'orrery') return { action: 'none' };
  if (tourActive) return { action: 'takeover' };
  return handsOn ? { action: 'hands-off' } : { action: 'hands-on' };
}

// The idle-timeout gate: the autopilot tour may auto-arm ONLY from HELM — "No
// autopilot for orrery... ORRERY never auto-arms the tour — not at boot, not
// on idle" (intent.md, success criteria). ORRERY idles forever; the live idle
// loop (main.js:8331-8357) must gate BOTH its branches on this predicate
// instead of calling startFlythrough() unconditionally on timeout. Any
// non-HELM regime (including garbage/missing) is a safe no-arm default.
export function idleFiresTour({ regime } = {}) {
  return regime === 'helm';
}

// The forced proximity drop-out (main.js:8333) is a HANDS-ON affordance: near a
// star the supercruise drive drops so the player coasts into sublight. But there
// is NO hands-off drive re-arm (R is inert hands-off, main.js:9780), so firing it
// while the AUTOPILOT owns the throttle strands the ship at throttle*SUBLIGHT_CAP
// (~0.0015 u/s) and the tour dies. The autopilot owns the throttle whenever a
// pilot leg OR a tour is active AND we are not in player-directed ASSIST (ASSIST
// is player-chosen and keeps its own graceful stall-dropout). Pure so main.js can
// ask "may the forced drop fire?" without re-deriving the regime inline.
// (tour-body-reachability-2026-07-05, Defect 2.)
export function forcedProximityDropAllowed({ scManual, pilotActive, tourActive, flightMode } = {}) {
  const autopilotOwns = (!!pilotActive || !!tourActive) && flightMode !== FlightMode.ASSIST;
  return !!scManual && !autopilotOwns;
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

// Where the TARGETING hover is sampled — the AIM POINT — by whether the OS cursor
// is hidden (§targeting-brackets-contextual-eta-design-2026-06-28, Unit 1). Pairs
// with pointerHudState by construction: `cursorHidden` is exactly
// `pointerHudState(...).cursor === 'none'` (desktop HELM hands-on flight).
//   - cursorHidden true  → aim = the fixed CENTER reticle {centerX, centerY}. In
//     hands-on flight the mouse is the virtual-joystick deflection, not an aim, and
//     the cursor is hidden — so you aim by FLYING a body across screen-center.
//   - cursorHidden false → aim = the MOUSE position {mouseX, mouseY}. ORRERY, HELM
//     free-look, and mobile keep a visible pointer; hover follows it as today.
// Pure so the render loop can pick the hit-test point without the live host.
export function aimPoint({ cursorHidden, mouseX, mouseY, centerX, centerY } = {}) {
  return cursorHidden ? { x: centerX, y: centerY } : { x: mouseX, y: mouseY };
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
