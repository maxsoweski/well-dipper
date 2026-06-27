import { describe, it, expect } from 'vitest';
import { FlightMode, advanceFlightMode, flightModeInfo, isManualInput, nextDriveAction, autopilotSourceInfo, freeLookPointerRoute, headReleaseAction } from '../flightModes.js';

describe('advanceFlightMode — the 4-state ring', () => {
  it('enters at Manual from not-in-flight', () => {
    expect(advanceFlightMode(FlightMode.ASSIST, false)).toEqual({ mode: FlightMode.MANUAL, inFlight: true, exit: false });
    expect(advanceFlightMode(null, false)).toEqual({ mode: FlightMode.MANUAL, inFlight: true, exit: false });
  });
  it('cycles Manual → Align → Assist → Exit while in flight', () => {
    expect(advanceFlightMode(FlightMode.MANUAL, true)).toEqual({ mode: FlightMode.ALIGN, inFlight: true, exit: false });
    expect(advanceFlightMode(FlightMode.ALIGN, true)).toEqual({ mode: FlightMode.ASSIST, inFlight: true, exit: false });
    expect(advanceFlightMode(FlightMode.ASSIST, true)).toEqual({ mode: null, inFlight: false, exit: true });
  });
  it('a full cycle returns to entering at Manual', () => {
    let mode = null, inFlight = false;
    const seen = [];
    for (let i = 0; i < 4; i++) { const n = advanceFlightMode(mode, inFlight); seen.push(n.exit ? 'exit' : n.mode); mode = n.mode; inFlight = n.inFlight; }
    expect(seen).toEqual([FlightMode.MANUAL, FlightMode.ALIGN, FlightMode.ASSIST, 'exit']);
    expect(advanceFlightMode(mode, inFlight).mode).toBe(FlightMode.MANUAL); // next press re-enters
  });
});

describe('flightModeInfo', () => {
  it('gives a label + hint for each mode and for exit', () => {
    expect(flightModeInfo(FlightMode.MANUAL).label).toBe('Manual');
    expect(flightModeInfo(FlightMode.ALIGN).label).toBe('Align-on-select');
    expect(flightModeInfo(FlightMode.ASSIST).label).toBe('Assist');
    // User-facing label renamed for the ORRERY/HELM restructure (§supercruise
    // -arrival-modes-design-2026-06-27, #2): the old "Exit flight / back to Toy
    // Box" is now the swap-to-orrery wording. (INFO.exit is retained-but-unused
    // by the live F path; this pins the renamed string.)
    expect(flightModeInfo('exit').label).toBe('Swap to ORRERY');
    for (const m of [FlightMode.MANUAL, FlightMode.ALIGN, FlightMode.ASSIST, 'exit']) {
      expect(typeof flightModeInfo(m).hint).toBe('string');
    }
  });
});

describe('nextDriveAction — the E key transition table', () => {
  it('engages (enter In-Flight + drive) from Toybox, regardless of stale driveOn', () => {
    expect(nextDriveAction(false, false)).toBe('engage');
    expect(nextDriveAction(false, true)).toBe('engage');
  });
  it('drops out when In-Flight with the drive ON (stay In-Flight, coast)', () => {
    expect(nextDriveAction(true, true)).toBe('dropout');
  });
  it('re-engages when In-Flight with the drive OFF (parked / dropped)', () => {
    expect(nextDriveAction(true, false)).toBe('reengage');
  });
});

describe('autopilotSourceInfo — Q-tour vs Assist as one autopilot concept', () => {
  // §supercruise-arrival-modes-design-2026-06-27 Feature 4 / plan Task 8:
  // the Q autopilot tour and player-directed Assist are ONE autopilot concept
  // (the same SupercruisePilot via scControls.flyTo) differing only in WHO picks
  // the target — the system (tour) vs you (assist). This descriptor pins that
  // framing as code, not just prose, so the consolidation can't silently drift.
  it('describes the tour source as system-picked', () => {
    const tour = autopilotSourceInfo('tour');
    expect(tour.picks).toBe('system');
    expect(typeof tour.label).toBe('string');
    expect(typeof tour.hint).toBe('string');
  });
  it('describes the assist source as player-picked', () => {
    const assist = autopilotSourceInfo('assist');
    expect(assist.picks).toBe('you');
    expect(typeof assist.label).toBe('string');
    expect(typeof assist.hint).toBe('string');
  });
  it('both sources drive the same pilot door (flyTo) — invariant flag', () => {
    expect(autopilotSourceInfo('tour').door).toBe('scControls.flyTo');
    expect(autopilotSourceInfo('assist').door).toBe('scControls.flyTo');
  });
  it('falls back to the tour descriptor for an unknown source', () => {
    expect(autopilotSourceInfo('nope')).toEqual(autopilotSourceInfo('tour'));
  });
});

describe('isManualInput', () => {
  it('is true on any throttle or any non-zero stick, false at rest', () => {
    expect(isManualInput({ x: 0, y: 0 }, 0)).toBe(false);
    expect(isManualInput(null, 0)).toBe(false);
    expect(isManualInput({ x: 0, y: 0 }, -1)).toBe(true);
    expect(isManualInput({ x: 0.0001, y: 0 }, 0)).toBe(true);
    expect(isManualInput({ x: 0, y: -0.2 }, 0)).toBe(true);
  });
});

describe('freeLookPointerRoute — where pointer MOTION goes, by free-look + LMB', () => {
  // §free-look-interaction-redesign-2026-06-27, Part 2. Free-look DECOUPLES the
  // look from the latch: in free-look (latched) the head only LOOKS while the
  // LEFT button is held; a bare cursor (LMB up) neither steers nor moves the
  // camera. Hands-on (NOT latched) keeps the absolute-position virtual joystick.
  it('looks only when free-look is latched AND the LMB is held', () => {
    expect(freeLookPointerRoute({ latched: true, lmbHeld: true })).toBe('look');
  });
  it('is idle (free cursor — no steer, no camera move) when latched but LMB up', () => {
    expect(freeLookPointerRoute({ latched: true, lmbHeld: false })).toBe('idle');
  });
  it('steers the virtual joystick ONLY in hands-on (not latched), LMB irrelevant', () => {
    expect(freeLookPointerRoute({ latched: false, lmbHeld: false })).toBe('steer');
    expect(freeLookPointerRoute({ latched: false, lmbHeld: true })).toBe('steer');
  });
});

describe('headReleaseAction — hold vs recenter when look-input is released', () => {
  // §free-look-interaction-redesign-2026-06-27, Part 2 step 4. Releasing the LMB
  // after a look-drag in free-look must HOLD the view where you dragged it (no
  // recenter) — the head only recenters when free-look is EXITED (F off). The
  // hands-on middle-mouse PEEK keeps its Elite-style recenter-on-release.
  it('HOLDS the view on release while free-look is latched (no recenter)', () => {
    expect(headReleaseAction({ freeLookLatched: true })).toBe('hold');
  });
  it('RECENTERS on release in hands-on (peek release returns to nose-forward)', () => {
    expect(headReleaseAction({ freeLookLatched: false })).toBe('recenter');
  });
});
