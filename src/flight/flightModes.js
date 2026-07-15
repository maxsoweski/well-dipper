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

// ---------------------------------------------------------------------------
// Orrery-coherence reducers (docs/WORKSTREAMS/orrery-coherence-2026-07-15,
// AC1). The ratified holistic read (2026-07-15): "ORRERY is a god's-eye,
// player-driven contemplation of the system — nothing flies in ORRERY; things
// only view." Max, 2026-07-02: "I do not want/need autopilot for orrery. And I
// don't want these modes to mix." Every one of Max's 2026-07-11 UAT findings is
// the same defect — ship machinery (warps, fly-ins, burns, tour arming) leaking
// into a mode that should only move a viewpoint. This layer answers, per seam,
// that no ORRERY input or timer may produce ship flight, while every HELM
// resolution byte-matches today's routing (SEAM-MAP-2026-07-15.md). Pure so each
// gate is unit-testable without three.js or the live host, and so the live call
// sites read ONE regime answer instead of each re-deriving "may this fly?".
// ---------------------------------------------------------------------------

// a. Tab / number-key body cycling (seam map §4). Max, 2026-07-11 UAT holistic:
// "nothing flies in ORRERY; things only view" — success criterion "no
// Tab/number-key flying." Today the keydown handler (main.js §4) has two live
// branches: the autopilot-active branch (~10020-10047, HELM tour) → autoNav
// .advance (tour-advance), and the normal-mode branch (~10050-10086) → focus
// Planet(i>=0) which FLIES (~6823, bypassed=true → scControls.flyTo). In ORRERY
// both must collapse to a VIEW-ONLY select (cycle _selectedTarget / scControls
// .selectTarget — eases the orbit pivot only, never flyTo). The action strings
// are deliberately non-flight-shaped so a caller can't misread 'view-select' as
// motion. Any non-HELM regime (garbage/missing) → the safe view-only default.
//   - regime 'orrery' (any tourActive) → 'view-select'
//   - regime 'helm', tour active       → 'tour-advance' (today's autopilot branch)
//   - regime 'helm', no tour           → 'focus-fly'    (today's focusPlanet fly)
export function bodyCycleAction({ regime, tourActive } = {}) {
  if (regime !== 'helm') return { action: 'view-select' };
  return tourActive ? { action: 'tour-advance' } : { action: 'focus-fly' };
}

// b. BURN commit-ACTION availability (seam map §5). Max, success criteria: "No
// 'burn for' workflow in ORRERY at all — BURN hidden entirely, no silent swap
// to HELM" (his pick over a crossover button); 2026-07-11 UAT: "I still have the
// 'burn for' workflow." This gates the two burn-ACTION seams only — "may a
// commit-burn ACTION proceed?" — namely the Space commit `commitSelection`→
// `commitBurn` (~6712) and the nav-computer burn branch in `dispatchNavAction`
// (~2865-2883):
//   - HELM  → true.  HELM commits a player-directed ASSIST burn on scPilot,
//     exactly as today (commitBurn's `commitBurnSwapsToHelm` gate returns false
//     in HELM, so no swap — it just flies the ASSIST leg). This reducer does not
//     change HELM burn behavior.
//   - ORRERY → false. Refusing the ACTION here makes commitBurnSwapsToHelm's
//     ORRERY-swap cell (flightModes.js:185) UNREACHABLE — so THAT reducer stays
//     byte-identical while its ORRERY path can never fire.
// SCOPE: this is the ACTION gate ONLY. It deliberately does NOT gate the BURN
// BUTTON's visibility — that is a SEPARATE concern, `burnButtonRegimeVisible`
// (below). The two must stay split because their HELM answers DIFFER: the burn
// ACTION is available in HELM (true), but the BURN BUTTON is already HIDDEN in
// HELM today (main.js:6736 folds `_scManual` into `burning`). Wiring the button
// to THIS true-in-HELM value would newly SHOW a BURN button in HELM on idle
// selection — a regression against the "HELM behavior unchanged" guardrail /
// AC4's "HELM still shows BURN exactly as today" (= hidden). Any non-HELM regime
// (garbage/missing) → unavailable (safe: no ship machinery).
export function burnWorkflowAvailable({ regime } = {}) {
  return regime === 'helm';
}

// b2. BURN BUTTON regime visibility (seam map §5, the third burn call site,
// split out of burnWorkflowAvailable per orrery-coherence review round 1). The
// every-frame `_updateCommitBurnButton` (main.js:6736-6738) computes
// `visible = !!_selectedTarget && !burning`, where today `burning` folds in
// `_scManual` — so the BURN button is ALREADY hidden in HELM and only ever
// rendered in ORRERY (its legacy "select a body → jump to it → HELM" affordance,
// the commitBurnSwapsToHelm path). AC4 removes that affordance: in ORRERY "the
// button never renders for a selected body," and "HELM still shows BURN exactly
// as today" (= hidden, since main.js:6736 suppresses it under `_scManual`). So
// AFTER AC4 no regime renders the button — HELM was already hidden, ORRERY
// becomes hidden. This reducer pins that regime verdict (false = hidden by
// regime) so Increment-2 can REPLACE the bare `_scManual` suppressor in `burning`
// with `!burnButtonRegimeVisible(regime)`: it returns false in HELM (matching
// today's `_scManual` hide) AND false in ORRERY (AC4's new hide), so the wiring
// can never make HELM render a BURN button it never showed. The finer per-frame
// flags (flythrough / warpEffect / warpTarget.turning / scPilot) stay inline in
// main.js and are unchanged. Constant-false over regime is DELIBERATE — AC4
// collapses the ORRERY-vs-HELM difference the button used to carry, retiring the
// affordance in both regimes — and is in this file's decision-pinning idiom (cf.
// `playerBurnMode`, which likewise pins a decision as code, not behavior). The
// test pins HELM = hidden so the wiring can't regress the "HELM unchanged"
// guardrail. Any regime (garbage/missing included) → false (hidden).
export function burnButtonRegimeVisible({ regime } = {}) {
  // regime is accepted for call-site uniformity with its sibling burn gates and
  // to document that the verdict is intentionally regime-independent: no regime
  // renders the button after AC4.
  void regime;
  return false;
}

// c. NavComputer AUTOPILOT toggle (seam map §6). Max, 2026-07-02: "I do not
// want/need autopilot for orrery" — success criterion "no NavComputer AUTOPILOT
// arming a tour from ORRERY." The canvas-drawn AUTOPILOT button's callback
// (main.js ~2794-2799) is wired UNGATED as `enable ? startFlythrough() :
// stopFlythrough()`; in ORRERY startFlythrough still arms the tour and FLIES. In
// ORRERY the toggle is inert BOTH directions (there is no tour to start or stop
// there). HELM keeps start/stop as today. (Lane C's DOM search overlay is a
// distinct surface — only this callback consults the gate.) Garbage/missing
// regime → inert (safe: never arms a tour).
//   - regime 'orrery'          → 'inert'  (both enable=true and enable=false)
//   - regime 'helm', enable    → 'start'  (startFlythrough)
//   - regime 'helm', !enable   → 'stop'   (stopFlythrough)
export function navAutopilotToggleAction({ regime, enable } = {}) {
  if (regime !== 'helm') return { action: 'inert' };
  return enable ? { action: 'start' } : { action: 'stop' };
}

// d. Auto-warp timer gate (seam map §3). Success criterion: "Nothing in ORRERY
// ever flies the ship: no auto-warp timers." Three ungated warp sites consult
// this one predicate: the title-end (~3:16) `autoSelectWarpTarget()`+`beginWarp
// Turn()` (main.js ~2554), the deep-sky/nebula-linger (15s) warp-away
// (~8697-8717), and the mobile double-tap warp (touchend ~10772). In ORRERY none
// may fire — "ORRERY idles indefinitely" (the ratified 'ORRERY idles forever'
// ruling, now extended to the warp timers). HELM fires as today. Any non-HELM
// regime (garbage/missing) → no warp (safe default).
export function autoWarpTimerFires({ regime } = {}) {
  return regime === 'helm';
}

// e. System-entry resolution (AC2 substrate, seam map §2 — consumed by
// Increment 2). Max, 2026-07-11 UAT: "when I warp into a system in orrery,
// there's the whole shaking cam and unskippable auto fly-in towards the system
// star"; success criterion: entering a system from ORRERY is "an instant framed
// cut — the whole system framed in view, no cinematic, no shake, no fly-in"
// (his pick over glide/skippable-cinematic). HELM keeps today's cinematic:
// `commitSelection`→portal preview→`warpEffect.start` (~6652-6710), then reveal's
// pilot fly-in + `shipChoreographer.beginTour({fromWarp:true})` shake
// (~6347-6371). ORRERY must instead take the instant-spawn path `spawnSystem
// ({forWarp:false})` (~4227) + `cameraController.viewSystem(systemRadius)`
// framing — bypassing warpEffect entirely (not merely skipping the fly-in), with
// the pilot never leaving idle. Returns a descriptor pinning each sub-decision
// so Increment 2 wires them without re-guessing intent. Any non-HELM regime
// (garbage/missing) → instant-cut (safe: never a cinematic/fly-in).
//   - regime 'helm'   → { style:'warp-cinematic', warpEffect,cameraShake,flyIn:true, pilotIdle:false }
//   - regime 'orrery' → { style:'instant-cut',    warpEffect,cameraShake,flyIn:false, pilotIdle:true }
export function systemEntryStyle({ regime } = {}) {
  if (regime === 'helm') {
    return { style: 'warp-cinematic', warpEffect: true, cameraShake: true, flyIn: true, pilotIdle: false };
  }
  return { style: 'instant-cut', warpEffect: false, cameraShake: false, flyIn: false, pilotIdle: true };
}

// f. Tour-complete re-arm gate (AC7 pure half, seam map §8). intent.md non-goal:
// "The screensaver's onTourComplete re-arm loop is CORRECT behavior while
// hands-off in HELM (it IS the screensaver); this workstream only pins that it
// never runs in ORRERY and stops when the player takes the stick." The
// `autoNav.onTourComplete` handler (main.js ~2427-2468) re-warps onward + arms
// the next tour; today it's ungated (correct-by-construction in ORRERY, but not
// pinned). Re-arm fires IFF regime === 'helm' AND hands-off (handsOn === false).
// STRICT `=== false`: a missing/garbage handsOn under HELM must NOT be read as
// hands-off (only an explicit hands-off state arms the loop), so garbage/missing
// anything → no re-arm. ORRERY never; HELM hands-on never. F-takeover / Z-stop
// (main.js ~9951-9964) break the loop live by ending the tour; this pins the
// regime+hand-state boundary so lane-C's 18h-loop observation stays correct-by-
// design in HELM and impossible in ORRERY.
export function tourRearmAllowed({ regime, handsOn } = {}) {
  return regime === 'helm' && handsOn === false;
}

// ---------------------------------------------------------------------------
// Orrery-coherence Increment 3 reducers (AC5 + AC6). Same ratified read:
// "ORRERY is a god's-eye, player-driven contemplation of the system — nothing
// flies in ORRERY; things only view." These two add the click-2 VIEW glide
// (AC5) and the mid-boot nav-selection-wins WARP race (AC6) as pure decisions
// so the live call sites read ONE answer instead of re-deriving them inline.
// ---------------------------------------------------------------------------

// g. Body-CLICK action (AC5, seam map §9). Max, 2026-07-11 UAT: "click 1 selects,
// click 2 quickly moves us over to that body" (a smooth glide of the VIEW — his
// pick over an instant snap, ratified 2026-07-15). The click pipeline (trySelect's
// body-hit branch, main.js — desktop click AND mobile tap both funnel through it)
// asks this what a body-click means, given the regime and whether the clicked body
// is ALREADY the selected one:
//   - regime 'orrery', SAME body clicked again (sameAsSelected) → 'glide-view'.
//     The view-only glide (ShipCameraSystem.glideFocus): eases the vantage over to
//     frame the body (bypassed stays false, NEVER flyTo, the pilot stays idle).
//     "Nothing flies in ORRERY; things only view."
//   - regime 'orrery', a NEW/different body → 'select'. Click 1 selects only
//     (today's scControls.selectTarget — eases the orbit pivot, no vantage move).
//   - regime 'helm' (any) → 'select'. HELM click semantics are UNCHANGED — a body
//     click selects; HELM never gets the click-2 glide (its click-to-fly lives on
//     the separate burn/focus paths, out of scope here).
//   - garbage/missing regime → 'select' (safe: a plain select moves neither the
//     ship nor the vantage).
// The second click glides ONLY when it lands on the SAME body a first click already
// selected — a first click on a fresh body must select, never glide. Neither action
// is a flight routing (the ORRERY invariant holds: 'glide-view' moves the VIEW,
// 'select' moves nothing).
export function bodyClickAction({ regime, sameAsSelected } = {}) {
  if (regime === 'orrery' && sameAsSelected) return { action: 'glide-view' };
  return { action: 'select' };
}

// h. Nav-dispatch-during-warp decision (AC6, seam map §7). The coordinator-flagged
// collision from lane C's live drives: a nav-computer warp the player dispatches
// DURING the boot tour's warp must win — "the player ARRIVES at their SELECTED
// system," and the boot warp "never completes to a settled arrival at its own
// target" (player intent beats autopilot). Pending-warp state is ONE mutable
// warpTarget with NO queue; onPrepareSystem snapshots warpTarget.navStarData at
// FOLD-start (seam map §7). So WHEN the player's dispatch lands relative to that
// snapshot decides HOW it wins:
//   - no warp in flight (warpInFlight false) → 'normal'. Today's behavior, byte-
//     UNCHANGED: set warpTarget + begin the turn (or ORRERY instant-cut). This is
//     the overwhelmingly common path — HELM's normal warp is untouched, so the
//     "HELM behavior byte-equivalent" guardrail holds for every non-collision warp.
//   - warp in flight, PRE-FOLD (foldSnapshotTaken false) → 'overwrite'. The
//     player's warpTarget write lands BEFORE the FOLD snapshot reads it, so the
//     in-flight warp naturally resolves to the player's star. Make that deliberate
//     + logged (and do NOT start a second turn — one warp is already in flight).
//   - warp in flight, POST-FOLD (foldSnapshotTaken true) → 'stash'. Generation
//     already committed to the in-flight (boot) target; overwriting warpTarget is
//     too late. Stash the player's pick and consume it at the reveal seam
//     (warpRevealSystem): suppress the boot target's reveal/tour-arm and immediately
//     begin the player's warp — the boot target gets no settled arrival.
// Pure so main.js reads ONE answer instead of re-deriving the FOLD-timing race.
// Bools coerced so garbage inputs can't mis-route — a missing warpInFlight → the
// safe 'normal' (identical-to-today) default.
export function navDispatchDuringWarp({ warpInFlight, foldSnapshotTaken } = {}) {
  if (!warpInFlight) return { action: 'normal' };
  return foldSnapshotTaken ? { action: 'stash' } : { action: 'overwrite' };
}
