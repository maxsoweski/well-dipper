// src/flight/__tests__/freeLookApply.test.js
// §free-look-interaction-redesign-2026-06-27, Part 2: the latch↔HeadMount bridge,
// REDESIGNED. `held` is now DECOUPLED from the latch — it follows the LEFT mouse
// button (LMB-down → beginLook, LMB-up → endLook), driven by the live mouse
// handlers, NOT re-asserted here every frame. The bridge's only job is the
// one-shot recenter on F-exit: consumeRecenter() → head.beginRecenter() so
// update() eases the view back to nose-forward. While latched + LMB released the
// head HOLDS (no recenter) — that is HeadMount's new default (!held & !recentering).
import { describe, it, expect } from 'vitest';
import { HeadMount } from '../HeadMount.js';
import { createFreeLook } from '../freeLook.js';
import { syncHeadToFreeLook } from '../freeLookApply.js';

const DT = 1 / 60;

describe('syncHeadToFreeLook (latched free-look ↔ HeadMount bridge, redesigned)', () => {
  it('does NOT assert held from the latch — held follows the LMB, not the latch', () => {
    const fl = createFreeLook();
    const h = new HeadMount();
    fl.toggle();                 // latch on (F press) — but LMB is up
    expect(fl.latched).toBe(true);
    syncHeadToFreeLook(fl, h);
    expect(h.held).toBe(false);  // KEY CHANGE: the latch no longer holds the head
  });

  it('a look-drag (LMB held) lands and PERSISTS on release (no recenter while latched)', () => {
    const fl = createFreeLook();
    const h = new HeadMount();
    fl.toggle();                 // latch on
    h.beginLook();               // LMB down (live mousedown handler)
    h.addLook(0.5, 0.2);
    h.endLook();                 // LMB up — view must HOLD, not recenter
    for (let i = 0; i < 60; i++) { syncHeadToFreeLook(fl, h); h.update(DT); }
    expect(h.yaw).toBeCloseTo(0.5, 9);
    expect(h.pitch).toBeCloseTo(0.2, 9);
  });

  it('toggle-off fires the one-shot recenter; the view eases back to center', () => {
    const fl = createFreeLook();
    const h = new HeadMount();
    fl.toggle();                 // on
    h.beginLook();
    h.addLook(0.8, 0.4);
    h.endLook();
    fl.toggle();                 // off → recenter pending
    // first frame after toggle-off: bridge requests the recenter
    syncHeadToFreeLook(fl, h); h.update(DT);
    expect(h.held).toBe(false);
    // monotonic ease toward center
    let prev = Math.hypot(h.yaw, h.pitch);
    for (let i = 0; i < 120; i++) {
      syncHeadToFreeLook(fl, h); h.update(DT);
      const mag = Math.hypot(h.yaw, h.pitch);
      expect(mag).toBeLessThanOrEqual(prev + 1e-12);
      prev = mag;
    }
    expect(h.centered).toBe(true);
  });

  it('not latched + no recenter pending leaves the head untouched (hands-on)', () => {
    const fl = createFreeLook();
    const h = new HeadMount();
    expect(fl.latched).toBe(false);
    syncHeadToFreeLook(fl, h);
    expect(h.held).toBe(false);  // hands-on: joystick drives, head not held
  });
});
