// Headless proof of #2 "ORRERY <-> HELM peer-mode swap" (§supercruise-arrival
// -modes-design-2026-06-27). M toggles the two PEER stations both directions:
//   - in HELM (scManual === true)  -> swap to ORRERY (pose-preserving exit)
//   - in ORRERY (scManual === false) -> swap to HELM (enter flight, drive UNTOUCHED)
//
// This file pins the pure reducer `modeSwapAction` that the live M-key handler
// (main.js) reads, so the toggle direction + the "M never lights the drive"
// invariant can't silently regress. The concrete side-effects (which internal
// _exitFlightInternal / _enterFlightInternal to call, whether to setDrive) live
// in main.js; here we model only the DECISION so it's testable without three.js
// or the live host — same shape as escCascadeAction / nextDriveAction.
import { describe, it, expect } from 'vitest';
import { modeSwapAction } from '../flightModes.js';

describe('modeSwapAction — the M-key ORRERY<->HELM toggle (pure)', () => {
  it('swaps HELM -> ORRERY when in HELM (scManual true)', () => {
    const a = modeSwapAction({ scManual: true });
    expect(a.target).toBe('orrery');
    expect(a.enterFlight).toBe(false);
    expect(a.exitFlight).toBe(true);
  });

  it('swaps ORRERY -> HELM when in ORRERY (scManual false)', () => {
    const a = modeSwapAction({ scManual: false });
    expect(a.target).toBe('helm');
    expect(a.enterFlight).toBe(true);
    expect(a.exitFlight).toBe(false);
  });

  it('NEVER lights the drive — M swaps stations only (E-from-ORRERY lights the drive, not M)', () => {
    // The core distinction from E: M = swap stations, drive untouched; E-from-
    // ORRERY = swap + drive ON. So no swap direction may request a drive-on.
    for (const scManual of [false, true]) {
      expect(modeSwapAction({ scManual }).lightDrive).toBe(false);
    }
  });

  it('is its own inverse — two M presses return to the starting station', () => {
    // ORRERY -> HELM -> ORRERY and HELM -> ORRERY -> HELM.
    const first = modeSwapAction({ scManual: false });   // -> helm
    expect(first.target).toBe('helm');
    const second = modeSwapAction({ scManual: true });   // now in helm -> orrery
    expect(second.target).toBe('orrery');

    const a = modeSwapAction({ scManual: true });        // -> orrery
    expect(a.target).toBe('orrery');
    const b = modeSwapAction({ scManual: false });       // now in orrery -> helm
    expect(b.target).toBe('helm');
  });

  it('exactly one of enterFlight / exitFlight is true for each direction', () => {
    for (const scManual of [false, true]) {
      const a = modeSwapAction({ scManual });
      expect(a.enterFlight !== a.exitFlight).toBe(true); // XOR: never both, never neither
    }
  });
});
