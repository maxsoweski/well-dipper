// Pure reducers for the mode-ownership workstream (docs/WORKSTREAMS/
// mode-ownership-2026-07-02/intent.md + contract.json, AC1 + AC2). Max,
// 2026-07-02: "I do not want/need autopilot for orrery. And I don't want
// these modes to mix." Max, 2026-07-01: "HELM should be our chosen Autopilot
// path; the Autopilot is a HELM feature. ORRERY is a player-driven feature."
//
// ONE hand-state governs every ship hand-input (W/S throttle, Q/E roll,
// mouse-steer, R drive) and whether the autopilot may fly: hands-ON means the
// player flies; hands-OFF is the ONLY state the autopilot may fly in, and it
// absorbs the free-look behaviors (bare cursor aims/selects, LMB-drag looks).
// These tests pin the DECISIONS as hand-built expectations, independent of
// the implementation formula, so a routing regression fails loudly.
import { describe, it, expect } from 'vitest';
import { handRouting, zKeyAction, fKeyAction, idleFiresTour } from '../flightModes.js';

describe('handRouting — hand-state governs every ship hand-input + autopilot legality', () => {
  it('hands-ON: player owns throttle/roll/mouse-steer/drive-toggle, autopilot is illegal', () => {
    expect(handRouting(true)).toEqual({
      throttle: true,
      roll: true,
      mouseSteer: true,
      driveToggle: true,
      autopilotLegal: false,
    });
  });

  it('hands-OFF: no hand input reaches the ship, autopilot is legal', () => {
    expect(handRouting(false)).toEqual({
      throttle: false,
      roll: false,
      mouseSteer: false,
      driveToggle: false,
      autopilotLegal: true,
    });
  });

  it('exactly one regime at a time: every routed input flips together with hands-on', () => {
    const on = handRouting(true);
    const off = handRouting(false);
    // every hand-input channel disagrees between the two states...
    expect(on.throttle).not.toBe(off.throttle);
    expect(on.roll).not.toBe(off.roll);
    expect(on.mouseSteer).not.toBe(off.mouseSteer);
    expect(on.driveToggle).not.toBe(off.driveToggle);
    // ...and autopilot legality is the exact inverse of hands-on
    expect(on.autopilotLegal).toBe(false);
    expect(off.autopilotLegal).toBe(true);
  });
});

describe('zKeyAction — Z toggles flight control off + starts/stops the tour', () => {
  it('ORRERY never arms the tour — Z is a no-op hint regardless of hand-state or tour', () => {
    expect(zKeyAction({ regime: 'orrery', handsOn: true, tourActive: true })).toEqual({ action: 'hint' });
    expect(zKeyAction({ regime: 'orrery', handsOn: true, tourActive: false })).toEqual({ action: 'hint' });
    expect(zKeyAction({ regime: 'orrery', handsOn: false, tourActive: true })).toEqual({ action: 'hint' });
    expect(zKeyAction({ regime: 'orrery', handsOn: false, tourActive: false })).toEqual({ action: 'hint' });
  });

  it('HELM mid-tour: Z stops the tour and leaves the ship coasting hands-off', () => {
    expect(zKeyAction({ regime: 'helm', handsOn: true, tourActive: true })).toEqual({ action: 'stop-tour-coast' });
    expect(zKeyAction({ regime: 'helm', handsOn: false, tourActive: true })).toEqual({ action: 'stop-tour-coast' });
  });

  it('HELM hands-on, no tour: one Z press turns controls off AND starts the tour', () => {
    expect(zKeyAction({ regime: 'helm', handsOn: true, tourActive: false })).toEqual({ action: 'hands-off-start-tour' });
  });

  it('HELM hands-off, no tour: Z just starts the tour (already hands-off)', () => {
    expect(zKeyAction({ regime: 'helm', handsOn: false, tourActive: false })).toEqual({ action: 'start-tour' });
  });
});

describe('fKeyAction — F puts control back into the player\'s hands (or toggles it)', () => {
  it('ORRERY: F does nothing — there is no ship hand-state to toggle there', () => {
    expect(fKeyAction({ regime: 'orrery', tourActive: true, handsOn: true })).toEqual({ action: 'none' });
    expect(fKeyAction({ regime: 'orrery', tourActive: false, handsOn: false })).toEqual({ action: 'none' });
  });

  it('HELM mid-tour: F is always a takeover, no matter the stale hand-state bit', () => {
    expect(fKeyAction({ regime: 'helm', tourActive: true, handsOn: true })).toEqual({ action: 'takeover' });
    expect(fKeyAction({ regime: 'helm', tourActive: true, handsOn: false })).toEqual({ action: 'takeover' });
  });

  it('HELM outside a tour: F flips hands-on <-> hands-off', () => {
    expect(fKeyAction({ regime: 'helm', tourActive: false, handsOn: true })).toEqual({ action: 'hands-off' });
    expect(fKeyAction({ regime: 'helm', tourActive: false, handsOn: false })).toEqual({ action: 'hands-on' });
  });
});

describe('idleFiresTour — idle timeout only arms the autopilot from HELM', () => {
  it('fires in HELM', () => {
    expect(idleFiresTour({ regime: 'helm' })).toBe(true);
  });
  it('never fires in ORRERY — it idles forever', () => {
    expect(idleFiresTour({ regime: 'orrery' })).toBe(false);
  });
  it('never fires for a garbage/missing regime (safe default: no auto-arm)', () => {
    for (const bad of [undefined, null, '', 'nonsense', 'HELM', 'Orrery']) {
      expect(idleFiresTour({ regime: bad })).toBe(false);
    }
  });
});
