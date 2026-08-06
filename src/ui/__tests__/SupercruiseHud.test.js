// Headless proof of the CONTEXTUAL ETA gate (§targeting-brackets-contextual-eta
// -design-2026-06-28, Unit 3). The "M:SS" ETA counter is glanceable, so it should
// appear ONLY when the player's aim point is over the body they are travelling
// toward (the selected/autopilot destination) AND they are moving with a known
// distance. Aim away → it hides. (The SAFE TO DROP / SLOW DOWN drop labels are an
// approach-SAFETY cue, NOT this counter — they stay on `hasTarget` and are not
// gated here.)
//
// `etaVisible({ speed, targetDistance, aimOnTarget })` is the pure gate, extracted
// so it's tested without a canvas.
import { describe, it, expect } from 'vitest';
import { etaVisible } from '../SupercruiseHud.js';

describe('etaVisible — contextual ETA gate (pure)', () => {
  it('shows ONLY when moving, distance known, AND aim is on the destination', () => {
    expect(etaVisible({ speed: 1, targetDistance: 100, aimOnTarget: true })).toBe(true);
  });

  it('hides when the aim is NOT on the travelled-toward body (the new contextual rule)', () => {
    expect(etaVisible({ speed: 1, targetDistance: 100, aimOnTarget: false })).toBe(false);
  });

  it('hides when stationary (speed 0 or negative) even if aim is on target', () => {
    expect(etaVisible({ speed: 0, targetDistance: 100, aimOnTarget: true })).toBe(false);
    expect(etaVisible({ speed: -2, targetDistance: 100, aimOnTarget: true })).toBe(false);
  });

  it('hides when the distance is unknown (null) even if aiming + moving', () => {
    expect(etaVisible({ speed: 1, targetDistance: null, aimOnTarget: true })).toBe(false);
    expect(etaVisible({ speed: 1, targetDistance: undefined, aimOnTarget: true })).toBe(false);
  });

  it('all three conditions are required (truth table)', () => {
    for (const moving of [false, true]) {
      for (const hasDist of [false, true]) {
        for (const aimOnTarget of [false, true]) {
          const speed = moving ? 2 : 0;
          const targetDistance = hasDist ? 50 : null;
          expect(etaVisible({ speed, targetDistance, aimOnTarget }))
            .toBe(moving && hasDist && aimOnTarget);
        }
      }
    }
  });
});
