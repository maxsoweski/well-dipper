import { describe, it, expect } from 'vitest';
import { createFreeLook } from '../freeLook.js';

describe('createFreeLook — pure latched free-look state', () => {
  it('starts unlatched and routes motion to the joystick', () => {
    const fl = createFreeLook();
    expect(fl.latched).toBe(false);
    expect(fl.route(2, 3)).toEqual({ target: 'joystick', dx: 2, dy: 3 });
  });

  it('toggle latches and routes motion to the head', () => {
    const fl = createFreeLook();
    fl.toggle();
    expect(fl.latched).toBe(true);
    expect(fl.route(2, 3)).toEqual({ target: 'head', dx: 2, dy: 3 });
  });

  it('toggle off unlatches and arms a one-shot recenter', () => {
    const fl = createFreeLook();
    fl.toggle();           // on
    fl.toggle();           // off
    expect(fl.latched).toBe(false);
    expect(fl.consumeRecenter()).toBe(true);
    expect(fl.consumeRecenter()).toBe(false); // one-shot
  });

  it('enter() and exit() drive the same latch + recenter', () => {
    const fl = createFreeLook();
    fl.enter();
    expect(fl.latched).toBe(true);
    fl.exit();
    expect(fl.latched).toBe(false);
    expect(fl.consumeRecenter()).toBe(true);
  });

  it('exit() while already unlatched does NOT arm a recenter', () => {
    const fl = createFreeLook();
    fl.exit(); // no-op: was never latched
    expect(fl.latched).toBe(false);
    expect(fl.consumeRecenter()).toBe(false);
  });

  it('enter() twice stays latched and arms no recenter', () => {
    const fl = createFreeLook();
    fl.enter();
    fl.enter();
    expect(fl.latched).toBe(true);
    expect(fl.consumeRecenter()).toBe(false);
  });

  it('route passes dx/dy through unchanged in both states', () => {
    const fl = createFreeLook();
    expect(fl.route(-5, 0.25)).toEqual({ target: 'joystick', dx: -5, dy: 0.25 });
    fl.enter();
    expect(fl.route(-5, 0.25)).toEqual({ target: 'head', dx: -5, dy: 0.25 });
  });
});
