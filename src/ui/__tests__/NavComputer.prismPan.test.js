// NavComputer — the PRISM keyboard, and what it costs to have one on the glass.
//
// ⭐ WHY THIS FILE EXISTS. Max, in UAT 2026-08-01: *"I still can't use the
// up/down controls to rise and lower below the galactic plane on the prism
// menu."* Two independent defects, and either alone is enough to produce that
// sentence:
//
//   1. THE COCKPIT'S NAV COMPUTER HAD NO KEYBOARD AT ALL. `attachKeys` lived
//      inside `activate()`, which only the DOM overlay's open path calls; on the
//      glass "open" means zooming the panel to the eye, so R, F and WASD were
//      never listened for. Split out here, with `activate()` delegating so there
//      is still exactly one place that names the listener pair.
//   2. THE PAN STEP WAS PER RENDER CALL. Fine at the overlay's 60 Hz rAF; the
//      cockpit panel repaints at the AMBIENT rate, 12.5 Hz by default, so the
//      identical code panned ~5× slower purely because of who asked it to draw.
//      Fixing (1) alone would have handed him keys that barely move.
//
// The constructor is DOM-bound (`canvas.getContext('2d')`) and this env has no
// window, so these drive an `Object.create`'d instance — the same pattern
// NavComputer.level.test.js and its siblings use.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { NavComputer } from '../NavComputer.js';
import { _advanceSimClock as advanceSimClock, _setSimClockMs, simClockMs } from '../../core/SimClock.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A bare instance carrying only the fields the two behaviours touch. */
function bare() {
  const nav = Object.create(NavComputer.prototype);
  nav._heldKeys = new Set();
  nav._lastPanMs = null;
  nav._levelIndex = 3;
  nav._localRadius = 1;
  nav._localRotY = 0;
  nav._localCenter = { x: 0, y: 0, z: 0 };
  nav._viewStack = [];
  nav._localCubeSize = null;
  return nav;
}

/**
 * Run ONLY the pan block of `render()`.
 *
 * `render()` needs a canvas, a 2D context, a galactic map and a luminosity
 * image. Reproducing that here would test a mock; what is under test is the
 * step arithmetic, so the block is driven directly through the same public
 * state it reads. The guard against this drifting from the real `render()` is
 * the source scan at the bottom of this file.
 */
function panStep(nav) {
  const before = { ...nav._localCenter };
  // The three lines the pan block runs before touching anything.
  const FRAME_MS = 1000 / 60;
  const MAX = 100;
  const now = simClockMs();
  const dt = nav._lastPanMs == null ? FRAME_MS : Math.min(now - nav._lastPanMs, MAX);
  nav._lastPanMs = now;
  const speed = nav._localRadius * 0.01 * (dt / FRAME_MS);
  if (nav._heldKeys.has('KeyR')) nav._localCenter.y += speed;
  if (nav._heldKeys.has('KeyF')) nav._localCenter.y -= speed;
  return nav._localCenter.y - before.y;
}

describe('NavComputer — attachKeys/detachKeys, the door the glass needed', () => {
  const listeners = [];
  beforeEach(() => {
    listeners.length = 0;
    globalThis.document = {
      addEventListener: (type, fn, capture) => listeners.push(['add', type, fn, capture]),
      removeEventListener: (type, fn, capture) => listeners.push(['remove', type, fn, capture]),
    };
  });
  afterEach(() => { delete globalThis.document; });

  it('takes BOTH keyboard events, in the capture phase', () => {
    // Capture is not incidental: the handler must run before the search input's
    // own listeners, and before main.js's flight bindings, or the six pan letters
    // are consumed by whoever registered first.
    const nav = bare();
    nav._onKeyDown = () => {};
    nav._onKeyUp = () => {};
    nav.attachKeys();

    expect(listeners.map((l) => [l[0], l[1], l[3]])).toEqual([
      ['add', 'keydown', true],
      ['add', 'keyup', true],
    ]);
    expect(listeners[0][2], 'must hand over the STORED reference, or removal cannot match it')
      .toBe(nav._onKeyDown);
    expect(listeners[1][2]).toBe(nav._onKeyUp);
  });

  it('DETACHING FORGETS WHAT WAS HELD — the drift-forever bug', () => {
    // `_heldKeys` is drained by keyup. A key still down when the listeners go
    // away never gets removed, and `render()` pans on the SET rather than on the
    // events — so the map would keep sliding, in a view nobody is looking at,
    // until that key happened to be pressed and released with the listeners back.
    const nav = bare();
    nav._onKeyDown = () => {};
    nav._onKeyUp = () => {};
    nav._heldKeys.add('KeyR');
    nav._lastPanMs = 1234;

    nav.detachKeys();

    expect(nav._heldKeys.size, 'a held key survived the detach').toBe(0);
    expect(nav._lastPanMs, 'a stale timestamp survived, so the next gesture opens with a lurch').toBeNull();
    expect(listeners.map((l) => [l[0], l[1]])).toEqual([['remove', 'keydown'], ['remove', 'keyup']]);
  });

  it('activate() still owns the whole overlay open, and the glass gets ONLY the keys', () => {
    // ⚠ THE FAILURE THIS PINS. `activate()` also calls `_resizeCanvas()`, which
    // reads `getBoundingClientRect()` — on the panel's OFFSCREEN canvas that
    // returns all zeros, so the buffer is resized to 0×0 and the NAV screen goes
    // BLACK. Wiring the cockpit to `activate()` is the obvious fix for Max's
    // report and it trades a dead keyboard for a dead panel.
    const nav = bare();
    nav._onKeyDown = () => {};
    nav._onKeyUp = () => {};
    nav._resizeCanvas = vi.fn();
    nav._showSearch = vi.fn();
    nav._hideSearch = vi.fn();
    nav._resetPrismLoad = vi.fn();

    nav.attachKeys();
    expect(nav._resizeCanvas, 'attachKeys resized a canvas it has no business touching').not.toHaveBeenCalled();
    expect(nav._showSearch, 'attachKeys revealed the overlay\'s DOM search field').not.toHaveBeenCalled();

    nav.activate();
    expect(nav._resizeCanvas, 'the overlay lost its resize').toHaveBeenCalledTimes(1);
    expect(nav._showSearch, 'the overlay lost its search field').toHaveBeenCalledTimes(1);
    // …and it went through the same door, rather than growing a second copy of
    // the listener pair that a later edit could change on one side only.
    expect(listeners.filter((l) => l[0] === 'add').length).toBe(4); // 2 from each call
  });

  it('deactivate() delegates too, so removal can never diverge from attachment', () => {
    const nav = bare();
    nav._onKeyDown = () => {};
    nav._onKeyUp = () => {};
    nav._hideSearch = vi.fn();
    nav._resetPrismLoad = vi.fn();
    nav._heldKeys.add('KeyW');
    nav._systemZoomAnim = {};
    nav._pendingComponentSelect = {};

    nav.deactivate();

    expect(listeners.map((l) => l[0])).toEqual(['remove', 'remove']);
    expect(nav._heldKeys.size).toBe(0);
    expect(nav._hideSearch).toHaveBeenCalled();
  });
});

describe('NavComputer — the PRISM pan step is per unit of TIME, not per call', () => {
  beforeEach(() => { _setSimClockMs(0); });

  it('at 60 Hz it moves exactly what the old fixed step moved', () => {
    // The normalisation constant is 1000/60 precisely so the overlay's feel is
    // unchanged to the millisecond. If this drifts, Max's muscle memory for the
    // DOM overlay is what pays for the cockpit's fix.
    const nav = bare();
    nav._heldKeys.add('KeyR');

    panStep(nav);                       // first step: one nominal frame
    const OLD_FIXED_STEP = nav._localRadius * 0.01;
    expect(nav._localCenter.y).toBeCloseTo(OLD_FIXED_STEP, 12);

    // …and every 60 Hz frame after it is the same step, four in a row, so this
    // cannot pass off the `_lastPanMs == null` opening case alone.
    for (let i = 0; i < 4; i++) {
      advanceSimClock(1000 / 60);
      expect(panStep(nav), 'a 60 Hz step is the old step').toBeCloseTo(OLD_FIXED_STEP, 12);
    }
  });

  it('A SLOWER REPAINT MOVES THE SAME DISTANCE — the whole point on the glass', () => {
    // The cockpit NAV panel repaints at 12.5 Hz by default (`window._panelHz`),
    // so one of its frames is 4.8 of the overlay's. Before this it moved one
    // fixed step per repaint and panned ~5× slower for no reason a pilot could
    // see. Asserted as a RATIO against the 60 Hz case rather than an absolute,
    // so retuning the base speed does not make this go red for nothing.
    const fast = bare(); fast._heldKeys.add('KeyR');
    const slow = bare(); slow._heldKeys.add('KeyR');
    panStep(fast); panStep(slow);       // both open on one nominal frame

    // 240 ms of gesture: 14.4 overlay frames, 3 panel frames.
    for (let i = 0; i < 14; i++) { advanceSimClock(1000 / 60); panStep(fast); }
    _setSimClockMs(0); slow._lastPanMs = 0;
    for (let i = 0; i < 3; i++) { advanceSimClock(80); panStep(slow); }

    const fastY = fast._localCenter.y;
    const slowY = slow._localCenter.y;
    expect(slowY / fastY, 'the two repaint rates disagree about how far 240 ms is')
      .toBeCloseTo(1, 1);
  });

  it('CLAMPS a long gap instead of teleporting across the prism', () => {
    // A backgrounded tab, a warp stall or a GC pause arrives as one enormous dt.
    // A pan is a held-key gesture and no single frame of it should ever cover
    // more than a few frames' worth, however long the host was away.
    const nav = bare();
    nav._heldKeys.add('KeyR');
    panStep(nav);
    const oneFrame = nav._localCenter.y;

    advanceSimClock(30_000);            // thirty seconds away
    const jump = panStep(nav);

    const MAX_PAN_STEP_MS = 100;
    expect(jump / oneFrame, 'the clamp is not applied — a stall teleports the view')
      .toBeCloseTo(MAX_PAN_STEP_MS / (1000 / 60), 6);
    expect(jump, 'thirty seconds arrived as thirty seconds of pan')
      .toBeLessThan(oneFrame * 10);
  });

  it('CONTROL: the block under test is still the block that ships', () => {
    // `panStep` above re-states the pan arithmetic so it can run without a
    // canvas, a galactic map and a luminosity image. That is a second copy, and
    // this is what stops it becoming a test of itself. Comment-stripped, because
    // the shipping block's rationale quotes the constants it explains.
    const RAW = readFileSync(resolve(HERE, '../NavComputer.js'), 'utf8');
    const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    expect(SRC, 'the normalisation constant moved or was inlined').toMatch(/const FRAME_MS = 1000 \/ 60;/);
    expect(SRC, 'the clamp moved or was inlined').toMatch(/const MAX_PAN_STEP_MS = 100;/);
    expect(SRC, 'the step is no longer scaled by elapsed time')
      .toMatch(/this\._localRadius \* 0\.01 \* \(dtMs \/ FRAME_MS\)/);
    expect(SRC, 'R and F no longer move the view through the galactic plane')
      .toMatch(/has\('KeyR'\)\) \{ this\._localCenter\.y \+= panSpeed; \}/);
    expect(SRC, 'the idle reset is gone — the next gesture will open with a lurch')
      .toMatch(/this\._lastPanMs = null;/);

    // ⭐ THE TWO BELOW WERE ADDED BECAUSE THEY WERE MISSED, and the miss is the
    // instructive part. Ten defects were planted at this fix; eight died and
    // these two lived, for the SAME reason: `panStep` and the fake `document`
    // above are copies, so a behavioural assertion cannot see the shipping file
    // change under it. Declaring a constant is not using it, and counting
    // addEventListener calls cannot tell delegation from a second inlined pair.
    expect(SRC, 'MAX_PAN_STEP_MS is declared and never applied — a stall teleports the view')
      .toMatch(/Math\.min\(nowPanMs - this\._lastPanMs, MAX_PAN_STEP_MS\)/);
    expect(SRC, 'activate() grew its own copy of the listener pair — removal can now diverge')
      .toMatch(/activate\(\) \{\s*this\.attachKeys\(\);/);
    expect(SRC, 'deactivate() grew its own copy — a held key can now survive a close')
      .toMatch(/deactivate\(\) \{\s*this\.detachKeys\(\);/);
  });
});
