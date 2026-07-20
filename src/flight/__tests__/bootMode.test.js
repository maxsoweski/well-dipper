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
//
// FLIPPED (docs/WORKSTREAMS/mode-ownership-2026-07-02, per Max's standing model,
// thrice-stated 2026-07-01/02): HELM is now ALSO the autopilot path — booting HELM
// starts the screensaver tour hands-off; ORRERY arms nothing, ever. `startAutopilot`
// pins that second bit alongside `enterFlight`.
import { describe, it, expect } from 'vitest';
import { bootModeAction, bootSkipDecision } from '../flightModes.js';

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

  it('boot into HELM also starts the autopilot tour, hands-off (the cockpit screensaver)', () => {
    expect(bootModeAction('helm').startAutopilot).toBe(true);
  });

  it('boot into ORRERY arms nothing — no tour, no autopilot flag', () => {
    expect(bootModeAction('orrery').startAutopilot).toBe(false);
  });

  it('a garbage/missing choice never starts the autopilot either (falls back to ORRERY)', () => {
    for (const bad of [undefined, null, '', 'nonsense', 'HELM ']) {
      expect(bootModeAction(bad).startAutopilot).toBe(false);
    }
  });
});

// The D-HOLD BOOT-SKIP decision (docs/WORKSTREAMS/orrery-entry-orbits-2026-07-20,
// AC1/AC2). Holding D while clicking a chooser button skips the intro logos +
// title ceremony and boots STRAIGHT into Sol in the chosen mode; without D the
// boot is byte-for-byte today's. This pure reducer pins the DECISION only —
// "does this click skip, and into which mode?" — so the live _pickBootMode
// handler (main.js) reads ONE answer instead of re-deriving the D-held + valid-
// mode branching inline. The skip removes CEREMONY, never mode SEMANTICS: the
// returned `mode` is the same normalized value bootModeAction uses (helm→helm,
// orrery→orrery, anything else→orrery), so the chosen-mode boot tail is picked
// by exactly the same key bootModeAction keys on. `skip` is true IFF D is held
// AND the pick is a real chooser mode; a garbage/missing pick can never skip.
describe('bootSkipDecision — the D-hold boot-skip decision (pure)', () => {
  it('D held + HELM → skips, into HELM', () => {
    expect(bootSkipDecision({ dHeld: true, mode: 'helm' })).toEqual({ skip: true, mode: 'helm' });
  });

  it('D held + ORRERY → skips, into ORRERY', () => {
    expect(bootSkipDecision({ dHeld: true, mode: 'orrery' })).toEqual({ skip: true, mode: 'orrery' });
  });

  it('D NOT held → never skips (normal ceremony), mode still normalized passthrough', () => {
    // Without D the boot must be untouched, so skip is false for BOTH valid
    // modes; the mode field is still the normalized passthrough (unused by the
    // non-skip branch, but kept honest so the field never lies).
    expect(bootSkipDecision({ dHeld: false, mode: 'helm' })).toEqual({ skip: false, mode: 'helm' });
    expect(bootSkipDecision({ dHeld: false, mode: 'orrery' })).toEqual({ skip: false, mode: 'orrery' });
  });

  it('invalid / undefined / missing mode → never skips, never throws (safe fallback to ORRERY)', () => {
    // A stray value, or D held with no real pick, must never boot-skip; and it
    // must fall back to the safe ORRERY mode exactly as bootModeAction does.
    for (const bad of [undefined, null, '', 'nonsense', 'HELM ']) {
      expect(() => bootSkipDecision({ dHeld: true, mode: bad })).not.toThrow();
      expect(bootSkipDecision({ dHeld: true, mode: bad })).toEqual({ skip: false, mode: 'orrery' });
    }
    // robust to a missing args object entirely (never throws)
    expect(() => bootSkipDecision()).not.toThrow();
    expect(bootSkipDecision().skip).toBe(false);
  });

  it('result mode is NEVER a value bootModeAction would reject (fixed point under its normalization)', () => {
    // "The skip removes ceremony, never mode semantics": the returned mode must
    // always be one bootModeAction accepts as-is (helm|orrery) — feeding it back
    // through bootModeAction is a fixed point — so the chosen-mode tail keys on
    // exactly the same normalized value, never a garbage mode.
    const inputs = [
      { dHeld: true, mode: 'helm' },
      { dHeld: true, mode: 'orrery' },
      { dHeld: false, mode: 'helm' },
      { dHeld: false, mode: 'orrery' },
      { dHeld: true, mode: 'nonsense' },
      { dHeld: true, mode: undefined },
      { dHeld: false, mode: null },
    ];
    for (const inp of inputs) {
      const r = bootSkipDecision(inp);
      expect(['helm', 'orrery']).toContain(r.mode);
      expect(bootModeAction(r.mode).mode).toBe(r.mode);
    }
  });
});
