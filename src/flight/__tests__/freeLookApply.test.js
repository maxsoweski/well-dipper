// src/flight/__tests__/freeLookApply.test.js
// Task 6 (AC2/AC4): the latch↔HeadMount bridge. Drives a REAL HeadMount through
// the same frame sequence main.js's loop runs, asserting that latched free-look
// holds the head (accepts addLook, no auto-recenter) and that toggle-off eases
// the view back to center via the one-shot recenter.
import { describe, it, expect } from 'vitest';
import { HeadMount } from '../HeadMount.js';
import { createFreeLook } from '../freeLook.js';
import { syncHeadToFreeLook } from '../freeLookApply.js';

const DT = 1 / 60;

describe('syncHeadToFreeLook (latched free-look ↔ HeadMount bridge)', () => {
  it('latching holds the head so addLook is accepted and the view does not recenter', () => {
    const fl = createFreeLook();
    const h = new HeadMount();
    fl.toggle();                 // latch on (F press)
    expect(fl.latched).toBe(true);
    syncHeadToFreeLook(fl, h);   // frame: assert held
    expect(h.held).toBe(true);
    // look input now lands and PERSISTS across frames (no auto-recenter while latched)
    h.addLook(0.5, 0.2);
    for (let i = 0; i < 60; i++) { syncHeadToFreeLook(fl, h); h.update(DT); }
    expect(h.yaw).toBeCloseTo(0.5, 9);
    expect(h.pitch).toBeCloseTo(0.2, 9);
  });

  it('toggle-off fires the one-shot recenter; the view eases back to center', () => {
    const fl = createFreeLook();
    const h = new HeadMount();
    fl.toggle();                 // on
    syncHeadToFreeLook(fl, h);
    h.addLook(0.8, 0.4);
    fl.toggle();                 // off → recenter pending
    // first frame after toggle-off: bridge releases the hold
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

  it('a middle-mouse PEEK release while still latched does NOT recenter', () => {
    const fl = createFreeLook();
    const h = new HeadMount();
    fl.toggle();                 // latched on
    syncHeadToFreeLook(fl, h);
    h.addLook(0.6, 0.0);
    // simulate a peek: press (beginLook already true), release (endLook)
    h.beginLook();
    h.endLook();                 // peek release clears held...
    // ...but the next frame re-asserts it because we're still latched
    syncHeadToFreeLook(fl, h);
    expect(h.held).toBe(true);
    for (let i = 0; i < 60; i++) { syncHeadToFreeLook(fl, h); h.update(DT); }
    expect(h.yaw).toBeCloseTo(0.6, 9); // held → never decayed
  });

  it('not latched + no recenter pending leaves the head untouched (hands-on)', () => {
    const fl = createFreeLook();
    const h = new HeadMount();
    expect(fl.latched).toBe(false);
    syncHeadToFreeLook(fl, h);
    expect(h.held).toBe(false);  // hands-on: joystick drives, head not held
  });
});
