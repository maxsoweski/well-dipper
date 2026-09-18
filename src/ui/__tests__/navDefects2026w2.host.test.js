/**
 * navDefects2026w2.host — the HOST half of wave 2 of nav-defects-batch-2026-09-18.
 *
 * ── WHAT THIS FILE OWNS ──────────────────────────────────────────────────────────────────────────
 *
 * `src/ui/NavComputer.js` only, and only the four folds wave 2 put in it:
 *
 *   AC-14  closing the nav tells the driver, so the drawn search / level lag / pick / page do not
 *          survive a close-and-reopen on a driver instance that is never rebuilt   :620
 *   AC-15  the ladder snapshot is released on mouse-up like every other drag field  :4415
 *   AC-16  `V` into a design unpins `_systemMode`, which neither design draws       :349
 *   AC-22  `V` ends any gesture in flight, whose origin is in the old buffer's space :349
 *
 * ── ⛔ THE STANDARD EVERY CASE IS HELD TO ────────────────────────────────────────────────────────
 *
 * Drive the REAL input. A key goes through `nav._onKeyDown` (the function the document listener is
 * registered with); a press/drag/release goes through `_handleMouseDown` / `_handleMouseMove` /
 * `_handleMouseUp`; a click goes through `_handleClick`; a close goes through `deactivate()`. Every
 * case then asserts an ABSOLUTE fact — a number, a null, a hash — never "it changed".
 *
 * On 2026-09-07 all 28 view-mode tests were green while the `V` key was dead code, because not one
 * of them drove the keyboard. A test that calls the method it is checking pins nothing.
 *
 * ── ⚠ THE DRIVER IS A SEPARATE OWNER, LANDING IN PARALLEL ───────────────────────────────────────
 *
 * `onDeactivate()` belongs to `navViewModes/index.js` (the DRIVER lane of this wave). The host calls
 * it doubly optionally — `this._viewDriverInst?.onDeactivate?.()` — so it is inert until that lands.
 * These cases therefore hand the host a STUB driver, the technique `navKeys.test.js` and wave 1's
 * `navDefects2026.host.test.js` both use. What is pinned here is the HOST's half: that the call is
 * made, that it is made exactly once, that it never CONSTRUCTS a driver, and that a driver without
 * the method does not throw out of `deactivate()` and strand the overlay open. Whether the driver's
 * own `onDeactivate` clears the right fields is the driver lane's to prove, in its own file — except
 * for one case here that hands the host a stub implementing the agreed seam, so the two halves are
 * pinned to meet.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { makeHeadlessNav, makeRecordingContext } from './helpers/headlessNav.mjs';

const W = 417, H = 240;

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// The harness
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * A driver stub the host will accept in place of the real one.
 *
 * `hover()` must answer false or `_handleMouseMove` returns before the drag branches (:4344);
 * `gaugeGrab`/`counterGrab` are consulted at levels 3 and 4 on every press; `remapClick` is the
 * first thing `_handleClick` does under a design and identity is the honest no-op.
 *
 * ⛔ `pressStartsGesture` IS DELIBERATELY ABSENT: the host's AC-4 guard treats "no method" as
 * "arm the gesture", which is the pre-design behaviour these cases want.
 */
function stubDriver(over = {}) {
  return {
    S: {},
    hover: () => false,
    gaugeGrab: () => false,
    counterGrab: () => false,
    remapClick: (p) => p,
    /* ⛔ `_resizeCanvas` asks the driver for the buffer on every `V` into a design (:613). A stub
       without it throws out of the key handler, which is a fixture gap reading as a defect. */
    bufferFor: () => ({ width: W, height: H }),
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

/** A real NavComputer in TODAY'S nav — no driver instance at all, which is the legacy-only session. */
async function legacyNav({ level = 1 } = {}) {
  const h = await makeHeadlessNav({ width: W, height: H });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = level;
  h.nav.viewMode = null;
  return h.nav;
}

const down = (nav, x, y, over = {}) => nav._handleMouseDown({ clientX: x, clientY: y, button: 0, ...over });
const move = (nav, x, y) => nav._handleMouseMove({ clientX: x, clientY: y });
const up = (nav) => nav._handleMouseUp();

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
// AC-14 — closing the nav tells the driver
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-14 — deactivate() hands the close down to the driver', () => {
  it('⭐⭐ A CLOSE CALLS `onDeactivate()` ON THE INSTANCE THAT IS ALREADY THERE, EXACTLY ONCE', async () => {
    let calls = 0;
    const { nav } = await navWithStub({ onDeactivate: () => { calls++; } });
    nav.deactivate();
    expect(calls).toBe(1);
    nav.deactivate();
    expect(calls).toBe(2);   // ⭐ once PER close, not once ever — the overlay opens and closes all session
  });

  it('⛔ AND IT NEVER BUILDS A DRIVER TO TELL — a legacy-only session closes without paying for one', async () => {
    const nav = await legacyNav();
    expect(nav._viewDriverInst).toBe(null);
    nav.deactivate();
    // ⛔ `(this._viewDriverInst ||= makeViewModeDriver(this)).onDeactivate?.()` would pass the case
    // above and fail here — and worse, it would CREATE the state the fold exists to clear.
    expect(nav._viewDriverInst).toBe(null);
  });

  it('⛔ A DRIVER WITHOUT THE METHOD IS INERT — the host does not throw the overlay open', async () => {
    const { nav } = await navWithStub();                  // no onDeactivate on the stub
    expect(nav._viewDriverInst.onDeactivate).toBeUndefined();
    expect(() => nav.deactivate()).not.toThrow();
  });

  it('⛔ AND SO IS A DRIVER WHOSE `onDeactivate` IS NOT A FUNCTION', async () => {
    const { nav } = await navWithStub({ onDeactivate: null });
    expect(() => nav.deactivate()).not.toThrow();
  });

  it('⭐⭐ THE SEAM MEETS: a driver that clears what the contract names ends the close with a clean S', async () => {
    // The driver lane's own `onDeactivate` is modelled here so the two halves are pinned to MEET.
    // The field list is the contract's, verbatim: the drawn search, `S.levelLag`, `S.levelArm`,
    // `S.pick` and `S.listOffset` are SESSION state and go; `S.sortIdx`, `S.list` and `S.zoomIdx`
    // are PREFERENCES and stay.
    const S = {
      search: { open: true, text: 'sol', sel: 2 },
      levelLag: 1758224000123, levelArm: 4, pick: { type: 'planet', index: 3 },
      listOffset: 27, sortIdx: 2, list: true, zoomIdx: 1,
    };
    const { nav } = await navWithStub({
      S,
      onDeactivate() {
        S.search.open = false; S.search.text = ''; S.search.sel = 0;
        S.levelLag = null; S.levelArm = null; S.pick = null; S.listOffset = 0;
      },
    });

    nav.deactivate();

    expect(S.search.open).toBe(false);
    expect(S.search.text).toBe('');
    expect(S.levelLag).toBe(null);
    expect(S.levelArm).toBe(null);
    expect(S.pick).toBe(null);
    expect(S.listOffset).toBe(0);
    // ⭐ AND THE PREFERENCES SURVIVE. A close that reset the sort and the list mode would be a
    // different defect wearing this fix's clothes.
    expect(S.sortIdx).toBe(2);
    expect(S.list).toBe(true);
    expect(S.zoomIdx).toBe(1);
  });

  it('⭐ THE REST OF `deactivate()` STILL RUNS — the fold is a prefix, not a replacement', async () => {
    const { nav } = await navWithStub({ onDeactivate: () => {} }, { level: 4 });
    nav._systemZoomAnim = { t: 0.4 };
    nav._pendingComponentSelect = 3;
    nav.deactivate();
    expect(nav._systemZoomAnim).toBe(null);
    expect(nav._pendingComponentSelect).toBe(null);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-15 — the ladder snapshot is released with every other drag field
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-15 — mouse-up drops `_dragStartLadder`', () => {
  const ladderS = () => ({ ladderScroll: 40, ladderMax: 100 });

  it('⭐⭐ THE PRESS TAKES THE SNAPSHOT AND THE RELEASE DROPS IT', async () => {
    const S = ladderS();
    const { nav } = await navWithStub({ S }, { mode: 'rail', level: 4 });
    down(nav, 200, 120);
    expect(nav._dragStartLadder).toBe(40);      // the press armed it (:4405)
    up(nav);
    expect(nav._dragStartLadder).toBe(null);    // and the release gave it back
  });

  it('⭐⭐ SO A GESTURE THAT ARRIVES AT SYSTEM LATER CANNOT SCRUB FROM THE OLD ONE', async () => {
    // REVIEW C8's sequence, driven: take a press at SYSTEM (arms 40), release it, leave for PRISM,
    // press there (level 3 never touches the field), then let the level become 4 while the button is
    // still held — Tab, or simply holding through the 400 ms PRISM→SYSTEM zoom, which sets
    // `_levelIndex = 4` mid-frame at :1336-1338 with nothing in the mouse path gating it.
    const S = ladderS();
    const { nav } = await navWithStub({ S }, { mode: 'rail', level: 4 });
    down(nav, 200, 120);
    up(nav);

    nav._levelIndex = 3;
    down(nav, 100, 120);                        // a PRISM press: `_dragStartX` becomes 100
    nav._levelIndex = 4;                        // …and the drill lands mid-gesture
    move(nav, 150, 120);

    // Unfixed, :4355 computes clamp(40 - (150 - 100)) = 0 and the ladder jumps to the start.
    expect(S.ladderScroll).toBe(40);
  });

  it('⭐ AND A FRESH PRESS ON THE LADDER STILL PANS IT — the guard is a release, not a disable', async () => {
    const S = ladderS();
    const { nav } = await navWithStub({ S }, { mode: 'rail', level: 4 });
    down(nav, 200, 120);
    up(nav);
    down(nav, 100, 120);                        // a real new gesture at SYSTEM: snapshot 40, origin 100
    move(nav, 60, 120);                         // dragged 40 texels left
    expect(S.ladderScroll).toBe(80);            // clamp(40 - (60 - 100)) = 80
  });

  it('⛔ AND `mouseleave` DROPS IT TOO — the constructor binds it to this same handler', async () => {
    // Driven through the listener the CONSTRUCTOR registered, not through the method, because
    // "mouseleave releases the gesture" is a fact about the wiring.
    await makeHeadlessNav({ width: W, height: H });          // installs the globals
    const listeners = new Map();
    const canvas = {
      width: W, height: H, style: {}, parentElement: null,
      addEventListener: (t, fn) => { listeners.set(t, [...(listeners.get(t) || []), fn]); },
      removeEventListener: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H }),
    };
    const { ctx } = makeRecordingContext(canvas);
    canvas.getContext = () => ctx;
    const { NavComputer } = await import('../NavComputer.js');
    const { GalacticMap } = await import('../../generation/GalacticMap.js');
    const nav = new NavComputer(canvas, new GalacticMap(), null);
    nav._viewModesEnabled = true;
    nav.viewMode = 'rail';
    nav._levelIndex = 4;
    nav._viewDriverInst = stubDriver({ S: ladderS() });

    for (const fn of listeners.get('mousedown') || []) fn({ clientX: 200, clientY: 120, button: 0 });
    expect(nav._dragStartLadder).toBe(40);
    expect((listeners.get('mouseleave') || []).length).toBe(1);
    for (const fn of listeners.get('mouseleave')) fn({ clientX: -5, clientY: 120 });
    expect(nav._dragStartLadder).toBe(null);
  });

  it('⛔ THE OTHER RELEASES ARE UNCHANGED — the fold sits beside them, it does not replace them', async () => {
    const { nav } = await navWithStub({ S: ladderS(), counterGrab: () => true }, { mode: 'rail', level: 4 });
    down(nav, 200, 120);
    expect(nav._dragging).toBe(true);
    expect(nav._counterDrag).toBe(true);
    up(nav);
    expect(nav._dragging).toBe(false);
    expect(nav._counterDrag).toBe(false);
    expect(nav._gaugeDrag).toBe(false);
    expect(nav._panStartCenter).toBe(null);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-16 — V into a design unpins `_systemMode`
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-16 — entering a design drops the legacy sub-view the design cannot draw', () => {
  it('⭐⭐ A PLANET DETAIL OPENED IN LEGACY IS GONE THE INSTANT `V` LANDS ON DESIGN 1', async () => {
    const nav = await legacyNav({ level: 4 });
    nav._systemMode = 'planet';
    nav._selectedPlanetIdx = 2;
    press(nav, 'KeyV');
    expect(nav.viewMode).toBe('rail');
    expect(nav._systemMode).toBe('system');
  });

  it('⭐⭐ AND SO IS A COMPONENT DRILL, CACHE AND ALL', async () => {
    const nav = await legacyNav({ level: 4 });
    nav._systemMode = 'component';
    nav._selectedComponentIdx = 3;
    nav._componentView = { star: 'B', bodies: [] };
    press(nav, 'KeyV');
    expect(nav._systemMode).toBe('system');
    expect(nav._selectedComponentIdx).toBe(-1);
    expect(nav._componentView).toBe(null);
    // ⛔ THE CLEARS ARE THE COMPONENT-RETURN BRANCH'S OWN (:4542-4544), not a new invention.
  });

  it('⭐⭐ SO THE FIRST CLICK UNDER THE DESIGN SELECTS THE BODY THE POINTER IS ON, not the legacy one', async () => {
    // The consequence REVIEW C9 measured: with `_systemMode` still 'planet', `_handleClick`'s
    // level-4 branch takes the planet arm at :4512 and writes `planetIndex: this._selectedPlanetIdx`
    // — the planet picked in legacy — for EVERY body click, ignoring `_hoveredBody.index`.
    const nav = await legacyNav({ level: 4 });
    nav._systemMode = 'planet';
    nav._selectedPlanetIdx = 2;
    press(nav, 'KeyV');
    nav._viewDriverInst = stubDriver();
    nav._commitButtonRect = null;
    nav._farChipRects = null;
    nav._systemData = { planets: [{}, {}, {}, {}, {}, { moons: [] }] };
    nav._hoveredBody = { type: 'planet', index: 5 };
    /* The CURRENT system is where the freeze bites: `_isCurrentSystem()` is a position test, so it
       is made true by standing where the star is, not by overriding the method. */
    nav._systemStar = { wx: nav._playerX, wy: nav._playerY, wz: nav._playerZ, name: 'Sol', seed: 1 };
    expect(nav._isCurrentSystem()).toBe(true);

    down(nav, 200, 110);
    up(nav);
    nav._handleClick({ clientX: 200, clientY: 110, button: 0 });

    /* Unfixed: `_systemMode` is still 'planet', :4522-4526 fires and writes `planetIndex: 2` —
       the planet picked in legacy — for this and every later body click. */
    expect(nav._selectedBody).toEqual({ type: 'planet', planetIndex: 5 });
  });

  it('⛔ `V` BACK TO LEGACY LEAVES LEGACY\'S OWN MODE ALONE — the gate is the NEW look', async () => {
    const h = await makeHeadlessNav({ width: W, height: H });
    const nav = h.nav;
    nav._viewModesEnabled = true;
    nav._levelIndex = 4;
    nav.viewMode = 'bars';
    nav._systemMode = 'planet';
    nav._selectedComponentIdx = 3;
    press(nav, 'KeyV');
    expect(nav.viewMode).toBe(null);
    // Dropping the `if (this.viewMode)` gate passes every case above and fails exactly here.
    expect(nav._systemMode).toBe('planet');
    expect(nav._selectedComponentIdx).toBe(3);
  });

  it('⛔ AND WITH VIEW MODES DISABLED `V` TOUCHES NOTHING — the cockpit panel is not in this batch', async () => {
    const nav = await legacyNav({ level: 4 });
    nav._viewModesEnabled = false;
    nav._systemMode = 'planet';
    press(nav, 'KeyV');
    expect(nav.viewMode).toBe(null);
    expect(nav._systemMode).toBe('planet');
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-22 — V ends any gesture in flight
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-22 — `V` pressed mid-drag ends the gesture instead of carrying it into the new buffer', () => {
  it('⭐⭐ EVERY GESTURE FIELD READS EXACTLY WHAT IT READS AFTER A RELEASE', async () => {
    const nav = await legacyNav({ level: 2 });
    down(nav, 200, 120);
    expect(nav._dragging).toBe(true);
    expect(nav._panStartCenter).not.toBe(null);

    press(nav, 'KeyV');

    expect(nav._dragging).toBe(false);
    expect(nav._panStartCenter).toBe(null);
    expect(nav._gaugeDrag).toBe(false);
    expect(nav._counterDrag).toBe(false);
    expect(nav._dragStartLadder).toBe(null);
  });

  it('⭐⭐ AND THE 2D MAP DOES NOT MOVE ONE UNIT ON THE NEXT POINTER MOVE', async () => {
    const nav = await legacyNav({ level: 2 });
    down(nav, 200, 120);
    press(nav, 'KeyV');
    const before = { ...nav._viewCenter };
    move(nav, 60, 200);      // the same pointer motion the pilot's hand was already making
    expect(nav._viewCenter.x).toBe(before.x);
    expect(nav._viewCenter.z).toBe(before.z);
  });

  it('⭐⭐ AT PRISM THE PRISM DOES NOT SPIN — REVIEW C7 measured 1.4 revolutions from a STATIONARY pointer', async () => {
    const nav = await legacyNav({ level: 3 });
    down(nav, 200, 120);
    press(nav, 'KeyV');
    // Read the angles AFTER the seed: `_seedViewModeCam` moves them on purpose (INTERFACE §1) and
    // that is not the damage. The damage is what the next MOVE does on top of it.
    const rotX = nav._localRotX, rotY = nav._localRotY;
    move(nav, 200, 120);     // the pointer has not moved at all
    expect(nav._localRotY).toBe(rotY);
    expect(nav._localRotX).toBe(rotX);
    move(nav, 214, 132);     // and a small real move does not apply the old origin either
    expect(nav._localRotY).toBe(rotY);
    expect(nav._localRotX).toBe(rotX);
  });

  it('⭐⭐ AT SYSTEM THE ORRERY DOES NOT SPIN EITHER, going the other way — BARS → CURRENT', async () => {
    const h = await makeHeadlessNav({ width: W, height: H });
    const nav = h.nav;
    nav._viewModesEnabled = true;
    nav._levelIndex = 4;
    nav.viewMode = 'bars';
    nav._viewDriverInst = stubDriver();
    down(nav, 300, 120);
    press(nav, 'KeyV');
    expect(nav.viewMode).toBe(null);
    const rotX = nav._systemRotX, rotY = nav._systemRotY;
    move(nav, 300, 120);                 // stationary
    move(nav, 340, 140);                 // and a real move, which is what an unfixed `_dragging` acts on
    expect(nav._systemRotY).toBe(rotY);
    expect(nav._systemRotX).toBe(rotX);
  });

  it('⭐⭐ ON A REAL CSS BOX THE STALE ORIGIN IS THE REVIEW\'S OWN ~8.9 RAD — and it does not happen', async () => {
    /* ⛔ THE BOX MUST NOT BE THE BUFFER OR THIS CASE IS VACUOUS. Every other case here runs on a
       417x240 canvas whose layout box is also 417x240, so `V` changes no coordinate space and the
       only thing on trial is whether the gesture continues. REVIEW C7 measured the real damage on a
       2021x1162 CSS box: `getBoundingClientRect` closes over the CONSTRUCTION-time size while
       `_resizeCanvas` swaps `canvas.width/height` to the driver's 417x240 — exactly what a browser
       does (CSS box fixed, backing store swapped) — so `_getCanvasPos` starts scaling by 417/2021
       and the held `_dragStartX` is in the OLD space. Unfixed, a COMPLETELY STATIONARY pointer at
       clientX 1400 moved `_localRotY` from 0.3 to -8.589, about 1.4 revolutions. */
    const h = await makeHeadlessNav({ width: 2021, height: 1162 });
    const nav = h.nav;
    nav._viewModesEnabled = true;
    nav.viewMode = null;
    nav._levelIndex = 3;
    nav._localRotY = 0.3;

    down(nav, 1400, 500);
    expect(nav._dragStartX).toBe(1400);            // the legacy box's own pixels
    press(nav, 'KeyV');
    expect(nav.viewMode).toBe('rail');
    expect(nav._canvas.width).toBe(W);             // the store really did swap under the gesture
    expect(nav._canvas.height).toBe(H);

    const rotY = nav._localRotY;
    move(nav, 1400, 500);                          // the pointer has not moved one CSS pixel
    expect(nav._localRotY).toBe(rotY);
  });

  it('⭐ AND THE NEXT PRESS IS A CLEAN GESTURE IN THE NEW SPACE', async () => {
    const nav = await legacyNav({ level: 2 });
    down(nav, 200, 120);
    press(nav, 'KeyV');
    nav._viewDriverInst = stubDriver();
    down(nav, 50, 60);
    expect(nav._dragging).toBe(true);
    expect(nav._dragStartX).toBe(50);
    expect(nav._dragStartY).toBe(60);
    expect(nav._panStartCenter).not.toBe(null);
    const before = { ...nav._viewCenter };
    move(nav, 70, 60);
    expect(nav._viewCenter.x).not.toBe(before.x);   // the new gesture pans, as it should
  });

  it('⛔ A HELD LADDER SCRUB DIES ON `V` TOO — the same five fields, from the design side', async () => {
    const S = { ladderScroll: 40, ladderMax: 100 };
    const { nav } = await navWithStub({ S }, { mode: 'rail', level: 4 });
    down(nav, 200, 120);
    expect(nav._dragStartLadder).toBe(40);
    press(nav, 'KeyV');
    expect(nav.viewMode).toBe('bars');
    expect(nav._dragStartLadder).toBe(null);
    expect(nav._dragging).toBe(false);
  });

  it('⛔ `V` WITH NO GESTURE RUNNING IS STILL JUST A LOOK CHANGE', async () => {
    const nav = await legacyNav({ level: 2 });
    const before = { ...nav._viewCenter };
    const seen = press(nav, 'KeyV');
    expect(nav.viewMode).toBe('rail');
    expect(nav._dragging).toBe(false);
    expect(nav._viewCenter.x).toBe(before.x);
    expect(seen.prevented).toBe(1);
    expect(seen.stopped).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-21 (host half) — a CHORD is never a look or list change. REVIEW C30 measured Ctrl+V cycling
// CURRENT → RAIL in every look; the driver half already keeps chords out of the drawn search's query.
// The WASDRF clause is deliberately NOT gated (Ctrl+W would close the tab, Ctrl+R would reload the game).
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-21 — the V/L clause ignores Ctrl, Meta and Alt chords', () => {
  it('⭐⭐ Ctrl+V IN LEGACY CHANGES NOTHING AND IS NOT EATEN — the browser keeps its paste', async () => {
    const nav = await legacyNav({ level: 2 });
    const seen = press(nav, 'KeyV', { ctrlKey: true });
    expect(nav.viewMode).toBe(null);
    expect(seen.prevented).toBe(0);
    expect(seen.stopped).toBe(0);
  });
  it('⭐⭐ Meta+V UNDER A DESIGN LEAVES THE LOOK WHERE IT IS', async () => {
    const { nav } = await navWithStub({}, { mode: 'rail', level: 1 });
    press(nav, 'KeyV', { metaKey: true });
    expect(nav.viewMode).toBe('rail');
  });
  it('⭐⭐ Alt+L UNDER DESIGN 2 DOES NOT TOGGLE THE LIST', async () => {
    let toggles = 0;
    const { nav } = await navWithStub({ toggleList() { toggles++; } }, { mode: 'bars', level: 3 });
    const seen = press(nav, 'KeyL', { altKey: true });
    expect(toggles).toBe(0);
    expect(seen.prevented).toBe(0);
  });
  it('⛔ THE CONTROL — a plain V still cycles, a plain L still toggles', async () => {
    let toggles = 0;
    const { nav } = await navWithStub({ toggleList() { toggles++; } }, { mode: 'bars', level: 3 });
    press(nav, 'KeyL');
    expect(toggles).toBe(1);
    const legacy = await legacyNav({ level: 2 });
    press(legacy, 'KeyV');
    expect(legacy.viewMode).toBe('rail');
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LEGACY BYTE-IDENTITY — `viewMode === null` on a fresh open, hashed at every level
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⭐⭐ THESE HASHES ARE A MEASUREMENT, NOT A GUESS.
 *
 * Taken 2026-09-18 by importing HEAD's `src/ui/NavComputer.js` (via `git show HEAD:…` into a
 * throwaway sibling module, so its relative imports resolved identically) ALONGSIDE this working
 * copy in one vitest run, building a fresh 417x240 legacy nav per level off both, calling `render()`
 * once, and hashing the recording context's streams. The replica is BYTE-FOR-BYTE `makeHeadlessNav`'s
 * body, DOM stub included — `installDom` points `createElement('canvas')` at the SAME recording
 * context, so the class's offscreen draws land in the same stream and a measurement taken without it
 * is a measurement of a different render (that mistake cost one run here) — and it sets
 * `_viewModesEnabled = true` with `viewMode = null`, exactly as the cases below do. The `fillText`/`strokeText` stream matched HEAD
 * at all five levels; the FULL call stream matched at 0/1/2/4.
 *
 * ⛔ LEVEL 3's CALL STREAM IS OMITTED BECAUSE IT IS NON-DETERMINISTIC IN HEAD ITSELF — two runs of
 * the SAME module produced two different hashes (1c7942016fc10af1, b5a289c9dd2b6e05), the prism's
 * background star load. Its TEXT stream is deterministic and is pinned below with the rest. Pinning
 * a hash that flickers would be a test that has to be ignored, which is worse than no test.
 *
 * ⚠ WHAT A FAILURE HERE MEANS. Not "the picture is wrong" — this harness draws nothing (its 2D
 * context is a Proxy that swallows every call). It means the legacy render path started ISSUING
 * different instructions, which is the one thing wave 2's four folds must never do: all four sit
 * inside `deactivate()`, `_handleMouseUp()` and the `V` clause, none of which a fresh open runs.
 */
const LEGACY_TEXT = {
  0: '47d6cec9a9b899c1',
  1: 'e63f073b4e55394d',
  2: '9790b13f56eb7849',
  3: 'e0159ebab2298b53',
  4: 'd9934e059a736f56',
};
const LEGACY_CALLS = {
  0: 'df3025c11613b1b5',
  1: '875c015b0dad36e1',
  2: '90ecebeb47aa76ca',
  4: '5542b2f88f086705',
};

const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

describe('LEGACY BYTE-IDENTITY — a fresh open at every level draws what HEAD drew', () => {
  for (const L of [0, 1, 2, 3, 4]) {
    const name = ['GALAXY', 'SECTOR', 'REGION', 'PRISM', 'SYSTEM'][L];
    it(`⭐⭐ ${name}: the emitted text stream hashes to HEAD's`, async () => {
      const h = await makeHeadlessNav({ width: W, height: H });
      h.nav._viewModesEnabled = true;
      h.nav.viewMode = null;
      h.nav._levelIndex = L;
      h.nav.render();
      expect(sha(h.rec.text)).toBe(LEGACY_TEXT[L]);
      if (LEGACY_CALLS[L]) expect(sha(h.rec.calls)).toBe(LEGACY_CALLS[L]);
    }, 30000);
  }

  it('⛔ AND NO DRIVER IS BUILT ON THE WAY — a legacy frame never reaches navViewModes', async () => {
    const h = await makeHeadlessNav({ width: W, height: H });
    h.nav._viewModesEnabled = true;
    h.nav.viewMode = null;
    for (const L of [0, 1, 2, 3, 4]) { h.nav._levelIndex = L; h.nav.render(); }
    expect(h.nav._viewDriverInst).toBe(null);
  }, 30000);
});
