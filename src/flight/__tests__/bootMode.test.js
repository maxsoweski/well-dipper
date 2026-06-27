// Headless proof of #2's SPLASH MODE-PICKER (§supercruise-arrival-modes-design
// -2026-06-27, AC6): the existing title/splash screen becomes a mode picker with
// two PEER choices, ORRERY and HELM. Selecting one launches the game into that
// mode via the SAME launch flow used today.
//
// This pins the pure reducer `bootModeAction(mode)` that the live title-dismiss
// handler (main.js) reads to decide whether the first-launch boot ENTERS flight
// (HELM) or stays in the orrery (ORRERY). The concrete side-effects (which warp/
// tour path runs, whether _enterFlightInternal is called once the system is live)
// live in main.js; here we model only the DECISION so it's testable without
// three.js or the live host — same shape as modeSwapAction / nextDriveAction.
//
// The load-bearing invariant: boot-into-HELM must request enterFlight (→ the live
// host sets _scManual true); boot-into-ORRERY must NOT (→ _scManual stays false).
import { describe, it, expect } from 'vitest';
import { bootModeAction } from '../flightModes.js';

describe('bootModeAction — the splash mode-picker boot decision (pure)', () => {
  it('boot into HELM requests entering flight (live host → _scManual true)', () => {
    const a = bootModeAction('helm');
    expect(a.mode).toBe('helm');
    expect(a.enterFlight).toBe(true);
  });

  it('boot into ORRERY does NOT enter flight (live host → _scManual stays false)', () => {
    const a = bootModeAction('orrery');
    expect(a.mode).toBe('orrery');
    expect(a.enterFlight).toBe(false);
  });

  it('defaults to ORRERY for an unknown / missing choice (safe fallback)', () => {
    // A stray value (or no pick at all — "press anything to begin") must never
    // strand the player in flight; the safe boot is the contemplative orrery.
    for (const bad of [undefined, null, '', 'nonsense', 'HELM ']) {
      const a = bootModeAction(bad);
      expect(a.mode).toBe('orrery');
      expect(a.enterFlight).toBe(false);
    }
  });

  it('exactly one boot regime: enterFlight true IFF the chosen mode is HELM', () => {
    expect(bootModeAction('helm').enterFlight).toBe(true);
    expect(bootModeAction('orrery').enterFlight).toBe(false);
    // and never both modes at once
    expect(bootModeAction('helm').mode).not.toBe(bootModeAction('orrery').mode);
  });
});
