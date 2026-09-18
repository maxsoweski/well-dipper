/**
 * navDefects2026.host — the HOST half of nav-defects-batch-2026-09-18.
 *
 * ── WHAT THIS FILE OWNS ──────────────────────────────────────────────────────────────────────────
 *
 * `src/ui/NavComputer.js` and `src/style.css` only. Six of the batch's twelve items have a host half:
 *
 *   AC-3  the 2D pan scales by the DRAWN map under a design (`drv.panKpcPerTexel()`), :4364-4365
 *   AC-4  a press only arms a gesture where the design drew a map (`drv.pressStartsGesture()`), :4398-4401
 *   AC-5  `,` / `.` are bound at SYSTEM only, :349
 *   AC-6  the legacy prism/orrery cameras survive a V cycle, :349
 *   AC-7  right-click goes back, :336
 *   AC-8  the close control is reachable in all three looks, style.css
 *
 * ── ⛔ THE STANDARD EVERY CASE IS HELD TO ────────────────────────────────────────────────────────
 *
 * Drive the REAL input. A key goes through `nav._onKeyDown`; a press/drag goes through
 * `_handleMouseDown` / `_handleMouseMove` / `_handleMouseUp`; a right-click goes through the
 * `contextmenu` listener the constructor actually registered on the canvas. On 2026-09-07 all 28
 * view-mode tests were green while the `V` key was dead code, because not one of them drove the
 * keyboard — a test that calls the method it is checking pins nothing.
 *
 * ── ⚠ THE DRIVER IS A SEPARATE OWNER, LANDING IN PARALLEL ───────────────────────────────────────
 *
 * `panKpcPerTexel()` and `pressStartsGesture()` belong to `navViewModes/index.js` (the DRIVER lane of
 * this batch). The host calls both optionally, so it is INERT until they land. These cases therefore
 * hand the host a STUB driver that answers known numbers — the same technique `navKeys.test.js` uses
 * to spy the driver — which pins the host's own arithmetic and its fallbacks whether or not the real
 * methods exist yet. The end-to-end pairing (is 0.25 kpc/texel the RIGHT number at REGION) is the
 * driver lane's to prove, and lives in its own file.
 *
 * ── ⭐ LEGACY BYTE-IDENTITY, MEASURED OUT OF BAND ────────────────────────────────────────────────
 *
 * `viewMode === null` must draw what HEAD draws. Measured 2026-09-18 by rendering a fresh legacy nav
 * at 417x240 at all five levels off two identical trees differing only in `NavComputer.js` (HEAD vs
 * this working copy) and hashing the recorded `fillText`/`strokeText` stream and the full context
 * call stream: the text hash matched at every level, and the call hash matched at 0/1/2/4 — level 3's
 * call stream is non-deterministic in HEAD ITSELF (the prism's background star load), verified by
 * running HEAD twice. A test cannot import HEAD, so that measurement stays a measurement; what IS
 * pinned here is the BEHAVIOUR each fold could have changed: the legacy pan ratio, the legacy
 * drag-from-anywhere, and the legacy silence of `,`/`.`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeHeadlessNav, makeRecordingContext } from './helpers/headlessNav.mjs';
/** ⛔ THE HOST'S OWN LEGACY PAN DENOMINATOR, IMPORTED. Restating `navMapSize`'s arithmetic here would
 *  be a second copy of the production layout that could go stale silently — the shape of the AC-3
 *  defect itself, in a test. */
import { navMapSize } from '../navLayout.js';

const W = 417, H = 240;

/**
 * A driver stub the host will accept in place of the real one.
 *
 * `hover()` must answer false or `_handleMouseMove` returns before it ever reaches the pan branch
 * (:4342); `gaugeGrab`/`counterGrab` are consulted at levels 3 and 4 on every press.
 */
function stubDriver(over = {}) {
  return {
    S: {},
    hover: () => false,
    gaugeGrab: () => false,
    counterGrab: () => false,
    remapClick: (p) => p,
    ...over,
  };
}

/** A real NavComputer with a stub driver already installed under the named look. */
async function navWithStub(over = {}, { mode = 'rail', level = 1 } = {}) {
  const h = await makeHeadlessNav({ width: W, height: H });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = level;
  h.nav.viewMode = mode;
  h.nav._viewDriverInst = stubDriver(over);
  return h;
}

const down = (nav, x, y, over = {}) => nav._handleMouseDown({ clientX: x, clientY: y, button: 0, ...over });
const move = (nav, x, y) => nav._handleMouseMove({ clientX: x, clientY: y });

/** Press a key through the handler the document listener actually calls, and report what it did. */
function press(nav, code, over = {}) {
  const seen = { prevented: 0, stopped: 0 };
  nav._onKeyDown({
    code, shiftKey: false, key: '',
    preventDefault() { seen.prevented++; },
    stopPropagation() { seen.stopped++; },
    ...over,
  });
  return seen;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-3 — the 2D pan is scaled by the map that is actually drawn
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-3 — under a design the pan asks the driver how many kpc a texel is worth', () => {
  it('⭐⭐ A 60-TEXEL DRAG MOVES `_viewCenter` BY 60 x THE DRIVER\'S NUMBER, NOT BY THE LEGACY RATIO', async () => {
    const { nav } = await navWithStub({ panKpcPerTexel: () => 0.25, pressStartsGesture: () => true });
    nav._viewCenter = { x: 8, y: 0, z: 0 };
    nav._viewSize = 4;
    down(nav, 100, 100);
    move(nav, 160, 130);

    // 60 texels right, 30 down, at 0.25 kpc/texel.
    expect(nav._viewCenter.x).toBeCloseTo(8 - 60 * 0.25, 10);
    expect(nav._viewCenter.z).toBeCloseTo(0 + 30 * 0.25, 10);

    // ⛔ AND THE LEGACY RATIO IS NOT WHAT MOVED IT. At 417x240 `navMapSize` is 160, so the shipped
    // expression would have moved x by 60 * 4/160 = 1.5 kpc — the 15 kpc above is a different number
    // by a factor of ten, which is what makes this case fail on the unfixed host.
    expect(nav._viewCenter.x).not.toBeCloseTo(8 - 60 * (4 / navMapSize(W, H)), 6);
  });

  it('⛔ A `null` FROM THE DRIVER FALLS BACK TO THE LEGACY RATIO — a frame with no projection published', async () => {
    const { nav } = await navWithStub({ panKpcPerTexel: () => null, pressStartsGesture: () => true });
    nav._viewCenter = { x: 8, y: 0, z: 0 };
    nav._viewSize = 4;
    down(nav, 100, 100);
    move(nav, 160, 100);
    expect(nav._viewCenter.x).toBeCloseTo(8 - 60 * (4 / navMapSize(W, H)), 10);
  });

  it('⛔ A DRIVER WITHOUT THE METHOD FALLS BACK TOO — the host is inert until the driver lane lands', async () => {
    const { nav } = await navWithStub({ pressStartsGesture: () => true });   // no panKpcPerTexel at all
    nav._viewCenter = { x: 8, y: 0, z: 0 };
    nav._viewSize = 4;
    down(nav, 100, 100);
    move(nav, 160, 100);
    expect(nav._viewCenter.x).toBeCloseTo(8 - 60 * (4 / navMapSize(W, H)), 10);
  });

  it('⛔ LEGACY IS UNTOUCHED — `viewMode === null` never asks, even with a driver instance sitting there', async () => {
    const { nav } = await navWithStub({ panKpcPerTexel: () => 0.25, pressStartsGesture: () => true });
    nav.viewMode = null;
    nav._viewCenter = { x: 8, y: 0, z: 0 };
    nav._viewSize = 4;
    down(nav, 100, 100);
    move(nav, 160, 100);
    expect(nav._viewCenter.x).toBeCloseTo(8 - 60 * (4 / navMapSize(W, H)), 10);
  });

  it('⭐ THE NUMBER IS ASKED FOR PER MOVE, NOT CACHED FROM THE PRESS — a re-laid-out frame re-scales', async () => {
    let kpt = 0.25;
    const { nav } = await navWithStub({ panKpcPerTexel: () => kpt, pressStartsGesture: () => true });
    nav._viewCenter = { x: 8, y: 0, z: 0 };
    nav._viewSize = 4;
    down(nav, 100, 100);
    move(nav, 110, 100);
    expect(nav._viewCenter.x).toBeCloseTo(8 - 10 * 0.25, 10);
    kpt = 0.5;
    move(nav, 110, 100);
    expect(nav._viewCenter.x).toBeCloseTo(8 - 10 * 0.5, 10);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-4 — only a press where the design drew a map arms a gesture
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-4 — a press on chrome arms nothing', () => {
  it('⭐⭐ A REFUSED PRESS AT A 2D LEVEL LEAVES `_dragging` FALSE AND MOVES THE MAP NOT AT ALL', async () => {
    const { nav } = await navWithStub({ pressStartsGesture: () => false });
    nav._viewCenter = { x: 8, y: 0, z: 0 };
    nav._viewSize = 4;
    down(nav, 10, 236);          // the commit row / tab band, in design 1's geometry
    expect(nav._dragging).toBe(false);
    expect(nav._panStartCenter).toBe(null);
    move(nav, 200, 120);
    expect(nav._viewCenter.x).toBe(8);
    expect(nav._viewCenter.z).toBe(0);
  });

  it('⭐⭐ AND THE DRAG-START POINT IS STILL RECORDED — the click threshold reads it', async () => {
    const { nav } = await navWithStub({ pressStartsGesture: () => false });
    nav._dragStartX = -999; nav._dragStartY = -999;
    down(nav, 41, 233);
    // ⛔ Without these two the press would leave the PREVIOUS gesture's start point in place, and
    // `_handleClick`'s 5-texel threshold (:4494) would read a plain click on the rail as a drag of
    // hundreds of texels and discard it — the chrome would go from "does the wrong thing" to "does
    // nothing at all", which is not what AC-4 asks for.
    expect(nav._dragStartX).toBe(41);
    expect(nav._dragStartY).toBe(233);
  });

  it('⭐⭐ AT PRISM A REFUSED PRESS DOES NOT SNAPSHOT THE ROTATION AND THE DRAG DOES NOT SPIN IT', async () => {
    const { nav } = await navWithStub({ pressStartsGesture: () => false }, { level: 3 });
    nav._localRotX = 0.5; nav._localRotY = 0.3;
    nav._dragStartRotX = 999; nav._dragStartRotY = 999;
    down(nav, 8, 120);           // design 1's rail column
    expect(nav._dragStartRotX).toBe(999);
    expect(nav._dragStartRotY).toBe(999);
    expect(nav._gaugeDrag).toBe(false);
    move(nav, 200, 60);
    expect(nav._localRotX).toBe(0.5);
    expect(nav._localRotY).toBe(0.3);
  });

  it('⭐⭐ AT SYSTEM A REFUSED PRESS TAKES NO LADDER SNAPSHOT AND SPINS NOTHING', async () => {
    const { nav } = await navWithStub({ pressStartsGesture: () => false, S: { ladderScroll: 7 } }, { level: 4 });
    nav._systemRotX = 0.5; nav._systemRotY = 0;
    nav._dragStartLadder = null;
    down(nav, 8, 6);             // design 1's status line
    expect(nav._dragStartLadder).toBe(null);
    expect(nav._counterDrag).toBe(false);
    move(nav, 200, 60);
    expect(nav._systemRotX).toBe(0.5);
    expect(nav._systemRotY).toBe(0);
  });

  it('⭐ A PRESS THE DRIVER ACCEPTS STILL ARMS EVERYTHING — the map is not broken by the guard', async () => {
    const { nav } = await navWithStub({ pressStartsGesture: () => true, panKpcPerTexel: () => null });
    nav._viewCenter = { x: 8, y: 0, z: 0 };
    nav._viewSize = 4;
    down(nav, 200, 120);
    expect(nav._dragging).toBe(true);
    expect(nav._panStartCenter).toEqual({ x: 8, y: 0, z: 0 });
    move(nav, 260, 120);
    expect(nav._viewCenter.x).toBeCloseTo(8 - 60 * (4 / navMapSize(W, H)), 10);
  });

  it('⛔ A DRIVER WITHOUT THE METHOD ARMS AS BEFORE — inert until the driver lane lands', async () => {
    const { nav } = await navWithStub({});    // no pressStartsGesture at all
    down(nav, 10, 236);
    expect(nav._dragging).toBe(true);
    expect(nav._panStartCenter).not.toBe(null);
  });

  it('⛔ LEGACY STILL DRAGS FROM ANYWHERE — `viewMode === null` never asks the question', async () => {
    const { nav } = await navWithStub({ pressStartsGesture: () => false });
    nav.viewMode = null;
    nav._viewCenter = { x: 8, y: 0, z: 0 };
    nav._viewSize = 4;
    down(nav, 10, 236);
    expect(nav._dragging).toBe(true);
    move(nav, 70, 236);
    expect(nav._viewCenter.x).toBeCloseTo(8 - 60 * (4 / navMapSize(W, H)), 10);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-5 (host half) — `,` and `.` are bound where design 1 draws a ladder, and nowhere else
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-5 — the ladder keys answer at SYSTEM only', () => {
  /** A real driver, built by a real frame, with `scrollLadder` counted. */
  async function railNav(level) {
    const h = await makeHeadlessNav({ width: W, height: H });
    h.nav._viewModesEnabled = true;
    h.nav._levelIndex = 3;
    h.nav.viewMode = 'rail';
    h.nav.render();                       // builds the real driver and loads the prism
    h.nav._levelIndex = level;
    const calls = [];
    h.nav._viewDriverInst.scrollLadder = (d) => { calls.push(d); };
    return { nav: h.nav, calls };
  }

  for (const [level, name] of [[0, 'GALAXY'], [1, 'SECTOR'], [2, 'REGION'], [3, 'PRISM']]) {
    it(`⭐⭐ AT ${name} \`,\` AND \`.\` REACH NOTHING AND ARE NOT SWALLOWED`, async () => {
      const { nav, calls } = await railNav(level);
      const a = press(nav, 'Period');
      const b = press(nav, 'Comma');
      expect(calls).toEqual([]);
      // ⛔ NOT SWALLOWED EITHER. A clause that returns early still calls preventDefault/stopPropagation;
      // a key that does nothing on this screen must leave the event alone so nothing downstream is
      // silently starved of it.
      expect(a.stopped + b.stopped).toBe(0);
      expect(a.prevented + b.prevented).toBe(0);
    });
  }

  it('⭐⭐ AT SYSTEM THEY STILL WALK THE LADDER, BOTH DIRECTIONS, AND ARE STOPPED', async () => {
    const { nav, calls } = await railNav(4);
    const a = press(nav, 'Period');
    const b = press(nav, 'Comma');
    expect(calls).toEqual([1, -1]);
    expect(a.stopped).toBe(1);
    expect(b.stopped).toBe(1);
  });

  it('⛔ AND DESIGN 2 NEVER GETS THEM AT ALL, AT SYSTEM OR ANYWHERE', async () => {
    const { nav, calls } = await railNav(4);
    nav.viewMode = 'bars';
    press(nav, 'Period');
    nav._levelIndex = 3;
    press(nav, 'Comma');
    expect(calls).toEqual([]);
  });

  it('⛔ AND LEGACY NEVER GETS THEM — `viewMode === null` at SYSTEM is silent', async () => {
    const { nav, calls } = await railNav(4);
    nav.viewMode = null;
    press(nav, 'Period');
    expect(calls).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-6 — the legacy prism and orrery cameras survive a V cycle
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-6 — V saves the legacy cameras on the way out and puts them back on the way in', () => {
  async function vNav(mode = null) {
    const h = await makeHeadlessNav({ width: W, height: H });
    h.nav._viewModesEnabled = true;
    h.nav.viewMode = mode;
    return h.nav;
  }

  it('⭐⭐ THREE PRESSES OF V AND THE FOUR ANGLES READ EXACTLY WHAT THEY READ BEFORE THE FIRST ONE', async () => {
    const nav = await vNav(null);
    // Deliberately NOT the constructor defaults: a restore that merely reset to 0.5/0.3/0.5/0 would
    // pass against the defaults and lose the pilot's own camera, which is the thing being protected.
    nav._localRotX = 0.91; nav._localRotY = 0.77;
    nav._systemRotX = 1.11; nav._systemRotY = 0.22;

    press(nav, 'KeyV');                       // CURRENT -> RAIL
    expect(nav.viewMode).toBe('rail');
    // ⭐ THE SEED STILL RUNS. `_seedViewModeCam` is what puts the GAME's camera where the design was
    // drawing (INTERFACE §1); if this assertion ever goes green-by-accident the save/restore has
    // eaten the seed instead of surviving it.
    expect(nav._localRotX).not.toBe(0.91);
    expect(nav._systemRotX).not.toBe(1.11);

    press(nav, 'KeyV');                       // RAIL -> BARS
    expect(nav.viewMode).toBe('bars');
    press(nav, 'KeyV');                       // BARS -> CURRENT
    expect(nav.viewMode).toBe(null);

    expect(nav._localRotX).toBe(0.91);
    expect(nav._localRotY).toBe(0.77);
    expect(nav._systemRotX).toBe(1.11);
    expect(nav._systemRotY).toBe(0.22);
  });

  it('⭐⭐ AND A SECOND LAP SAVES THE CAMERA AS IT STANDS THEN, not the first lap\'s', async () => {
    const nav = await vNav(null);
    nav._localRotX = 0.91; nav._localRotY = 0.77;
    press(nav, 'KeyV'); press(nav, 'KeyV'); press(nav, 'KeyV');
    expect(nav._localRotX).toBe(0.91);
    nav._localRotX = 0.42; nav._localRotY = 0.13;     // the pilot drags the prism in legacy
    press(nav, 'KeyV'); press(nav, 'KeyV'); press(nav, 'KeyV');
    expect(nav._localRotX).toBe(0.42);
    expect(nav._localRotY).toBe(0.13);
  });

  it('⭐ AN OVERLAY THAT OPENED STRAIGHT INTO A DESIGN LANDS ON THE FRESH-OPEN DEFAULTS', async () => {
    // `loadViewMode()` (:587) can open the nav already in a design, so the first arrival at CURRENT
    // has nothing saved. The literals are the constructor's own (:159, :160, :188, :189).
    const nav = await vNav('rail');
    nav._localRotX = 0.6521714117570698; nav._localRotY = 0;
    nav._systemRotX = 0.43344532006988595; nav._systemRotY = 0;
    press(nav, 'KeyV');                       // RAIL -> BARS
    press(nav, 'KeyV');                       // BARS -> CURRENT
    expect(nav.viewMode).toBe(null);
    expect(nav._localRotX).toBe(0.5);
    expect(nav._localRotY).toBe(0.3);
    expect(nav._systemRotX).toBe(0.5);
    expect(nav._systemRotY).toBe(0);
  });

  it('⛔ AN IN-FLIGHT REGION→PRISM SETTLE IS RETARGETED BACK, not left aiming at the design angle', async () => {
    const nav = await vNav(null);
    nav._localRotX = 0.91;
    nav._tiltAnim = { from: 0.2, to: 0.91, start: 0, dur: 600 };
    press(nav, 'KeyV');
    const seeded = nav._tiltAnim.to;           // `_seedViewModeCam` aims it at the design's angle
    expect(seeded).not.toBe(0.91);
    press(nav, 'KeyV'); press(nav, 'KeyV');
    expect(nav._tiltAnim.to).toBe(0.91);
  });

  it('⛔ WITH VIEW MODES DISABLED V DOES NOTHING AT ALL — the cockpit panel is not in this batch', async () => {
    const nav = await vNav(null);
    nav._viewModesEnabled = false;
    nav._localRotX = 0.91;
    press(nav, 'KeyV');
    expect(nav.viewMode).toBe(null);
    expect(nav._localRotX).toBe(0.91);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-7 — right-click goes back
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-7 — the contextmenu listener the constructor registers is the one that goes back', () => {
  /**
   * A real NavComputer over a canvas that KEEPS the listeners it is handed.
   *
   * ⛔ `makeHeadlessNav`'s canvas has a `noop` `addEventListener`, so the listener under test is
   * thrown away there and cannot be driven — and calling `handleEscape()` directly would prove
   * nothing, since that is exactly what the DEAD branch at :4488 already does. This builds the class
   * with a recording canvas instead, so the case drives the event a real secondary click fires.
   * The first `makeHeadlessNav` call is what installs the `document`/`window` globals the
   * constructor reaches for.
   */
  async function navWithListeners({ width = W, height = H } = {}) {
    await makeHeadlessNav({ width, height });
    const listeners = new Map();
    const canvas = {
      width, height, style: {}, parentElement: null,
      addEventListener: (type, fn) => { listeners.set(type, [...(listeners.get(type) || []), fn]); },
      removeEventListener: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width, height, right: width, bottom: height }),
    };
    const { ctx } = makeRecordingContext(canvas);
    canvas.getContext = () => ctx;
    const { NavComputer } = await import('../NavComputer.js');
    const { GalacticMap } = await import('../../generation/GalacticMap.js');
    const nav = new NavComputer(canvas, new GalacticMap(), null);
    const fire = (type, ev) => { for (const fn of listeners.get(type) || []) fn(ev); };
    return { nav, fire, listeners };
  }

  /** A real secondary click: mousedown(button 2) → contextmenu, which is the order browsers fire. */
  function rightClick(nav, fire, x, y, { moveTo = null } = {}) {
    const seen = { prevented: 0 };
    nav._handleMouseDown({ clientX: x, clientY: y, button: 2 });
    const at = moveTo || { x, y };
    fire('contextmenu', { clientX: at.x, clientY: at.y, button: 2, preventDefault() { seen.prevented++; } });
    return seen;
  }

  it('⭐⭐ A RIGHT-CLICK AT PRISM POPS TO REGION — the one event the secondary button actually fires', async () => {
    const { nav, fire } = await navWithListeners();
    nav._levelIndex = 3;
    const seen = rightClick(nav, fire, 200, 120);
    expect(nav._levelIndex).toBe(2);
    // ⛔ And the browser menu is still suppressed, which is what the listener was originally for.
    expect(seen.prevented).toBe(1);
  });

  it('⭐⭐ IT POPS AT SYSTEM TOO, and it pops the planet sub-view first exactly as ESC does', async () => {
    const { nav, fire } = await navWithListeners();
    nav._levelIndex = 4;
    nav._systemMode = 'planet';
    nav._selectedPlanetIdx = 2;
    rightClick(nav, fire, 200, 120);
    expect(nav._systemMode).toBe('system');
    expect(nav._levelIndex).toBe(4);            // the sub-view popped, the level did not
    rightClick(nav, fire, 200, 120);
    expect(nav._levelIndex).toBe(3);
  });

  it('⭐⭐ IT WORKS UNDER BOTH DESIGNS TOO — the route is the canvas listener, not a look', async () => {
    for (const mode of ['rail', 'bars']) {
      const { nav, fire } = await navWithListeners();
      nav._viewModesEnabled = true;
      nav.viewMode = mode;
      nav._levelIndex = 3;
      rightClick(nav, fire, 200, 120);
      expect(nav._levelIndex, `mode ${mode}`).toBe(2);
    }
  });

  it('⛔ A RIGHT-BUTTON DRAG PAST THE 5-TEXEL THRESHOLD DOES NOT POP', async () => {
    const { nav, fire } = await navWithListeners();
    nav._levelIndex = 3;
    const seen = rightClick(nav, fire, 200, 120, { moveTo: { x: 240, y: 120 } });
    expect(nav._levelIndex).toBe(3);
    expect(seen.prevented).toBe(1);             // the menu is still suppressed on a drag
  });

  it('⭐ AND THE THRESHOLD IS THE CLICK PATH\'S OWN 5 TEXELS — 2,2 pops, 4,4 does not', async () => {
    const a = await navWithListeners();
    a.nav._levelIndex = 3;
    rightClick(a.nav, a.fire, 200, 120, { moveTo: { x: 202, y: 122 } });   // 8 <= 25
    expect(a.nav._levelIndex).toBe(2);

    const b = await navWithListeners();
    b.nav._levelIndex = 3;
    rightClick(b.nav, b.fire, 200, 120, { moveTo: { x: 204, y: 124 } });   // 32 > 25
    expect(b.nav._levelIndex).toBe(3);
  });

  it('⛔ A RIGHT-CLICK DURING A DRILL ANIMATION IS SWALLOWED, exactly as a left one is', async () => {
    const { nav, fire } = await navWithListeners();
    nav._levelIndex = 3;
    nav._anim = { t: 0 };
    const seen = rightClick(nav, fire, 200, 120);
    expect(nav._levelIndex).toBe(3);
    expect(seen.prevented).toBe(1);
  });

  it('⛔ AT GALAXY IT POPS NOTHING — `handleEscape` has nowhere above level 0 to go', async () => {
    const { nav, fire } = await navWithListeners();
    nav._levelIndex = 0;
    rightClick(nav, fire, 200, 120);
    expect(nav._levelIndex).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-8 — the close control is reachable in all three looks
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-8 — the × is inside the viewport in legacy and stands down under the designs', () => {
  const CSS = readFileSync(fileURLToPath(new URL('../../style.css', import.meta.url)), 'utf8');

  /** The declarations of one rule, by exact selector, as a { prop: value } map. */
  function rule(selector) {
    const i = CSS.indexOf(`\n${selector} {`);
    expect(i, `rule \`${selector}\` is not in style.css`).toBeGreaterThan(-1);
    const body = CSS.slice(i + selector.length + 3, CSS.indexOf('}', i));
    const out = {};
    for (const decl of body.split(';')) {
      const [k, ...v] = decl.split(':');
      if (v.length) out[k.trim()] = v.join(':').split('/*')[0].trim();
    }
    return out;
  }

  const px = (v) => { expect(v, 'a px length').toMatch(/^-?\d+(\.\d+)?px$/); return parseFloat(v); };

  it('⭐⭐ THE BUTTON IS WHOLLY INSIDE THE VIEWPORT AND WHOLLY OUTSIDE THE GLASS', () => {
    const base = rule('.overlay-close');
    const nav = rule('.nav-computer-panel .overlay-close');
    const panel = rule('.nav-computer-panel');

    // `.nav-computer-overlay` is `inset: 0` + flex centring, so a panel of `calc(100vh - Npx)` sits
    // N/2 px below the viewport top. Read N off the rule rather than restating the 20.
    const m = panel.height.match(/^calc\(100vh - (\d+)px\)$/);
    expect(m, '.nav-computer-panel height is a calc(100vh - Npx)').not.toBe(null);
    const panelTop = parseFloat(m[1]) / 2;

    const top = px(nav.top);
    const height = px(nav.height ?? base.height);
    const btnTop = panelTop + top;
    const btnBottom = btnTop + height;

    // (1) fully on screen — this is the half that was broken: -40 put the top edge at y = -20.
    expect(btnTop).toBeGreaterThanOrEqual(0);
    // (2) and clear of the canvas, so it covers none of the readouts legacy draws in its corners
    //     (CURRENT SYSTEM at 16,24; the level name + stack right-aligned at w-16; AUTOPILOT
    //     bottom-left; the full-width tab strip; the prism minimap at w-80, h-220).
    expect(btnBottom).toBeLessThanOrEqual(panelTop);
  });

  it('⭐⭐ AND UNDER A DESIGN IT STANDS DOWN — 40px of DOM chrome cannot sit on a 240p glass', () => {
    const lowres = rule('.nav-computer-panel.nav-lowres .overlay-close');
    expect(lowres.display).toBe('none');
    // ⛔ Because full bleed deletes the band the legacy button lives in: with the panel at 100vh
    // there is no letterbox left, so `top: -20px` would be off-screen again.
    const panel = rule('.nav-computer-panel.nav-lowres');
    expect(panel.height).toBe('100vh');
    expect(panel.width).toBe('100vw');
  });

  it('⛔ THE TOUCH PLACEMENT IS UNTOUCHED — a 20px target is not a touch target', () => {
    // The mobile program owns this rule (shipped 2026-08-31); this batch changes desktop only.
    const i = CSS.indexOf('\n  .nav-computer-panel .overlay-close {');   // the nested, indented copy
    expect(i, 'the coarse-pointer override is still in style.css').toBeGreaterThan(-1);
    expect(CSS.slice(0, i)).toContain('@media (pointer: coarse)');
    const body = CSS.slice(i, CSS.indexOf('}', i));
    expect(body).toContain('top: 8px');
    expect(body).toContain('right: 8px');
  });
});
