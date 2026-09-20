/**
 * navRestorations3.host — the HOST half of wave 2a of nav-restorations-2026-09-20.
 *
 * ── WHAT THIS FILE OWNS ──────────────────────────────────────────────────────────────────────────
 *
 * `src/ui/NavComputer.js` only, and only the four folds AC-6 put in it — design 2's SYSTEM zoom
 * gauge, the grabbable twin of the wheel that already moves `_systemZoom` (`_handleWheel:4708`):
 *
 *   :156   `this._zoomDrag = false` declared beside `_gaugeDrag`, the value it guards
 *   :4405  the level-4 mousedown arms it: `viewMode === 'bars'` && the driver's `zoomGrab?.(x, y)`
 *   :4355  the level-4 mousemove spends it: `zoomDragTo?.(p.y)` → `_systemZoom`, then `return`
 *   :4415  mouse-up releases it with every other drag field
 *
 * Nothing else in the class is this wave's. The PAINT of the gauge is the LAB's (`d2System`
 * publishes `S.zoomGaugeRect` at its draw site) and the hit-test and the log mapping are the
 * DRIVER's (`navViewModes/index.js` `zoomGrab` / `zoomDragTo`).
 *
 * ── ⛔ THE STANDARD EVERY CASE IS HELD TO ────────────────────────────────────────────────────────
 *
 * Drive the REAL input. A drag is `_handleMouseDown` → `_handleMouseMove` × n → `_handleMouseUp` on
 * the handlers the canvas listeners are registered with, at the middle of a texel (`x + 0.5`), on a
 * REAL `NavComputer` over a REAL `navViewModes` driver. Every case then asserts an ABSOLUTE fact — a
 * number to twelve places, a boolean, a hash — never "it changed" — and every case names the mutant
 * it goes red against.
 *
 * ── ⚠ ONE FIXTURE DECLARATION, STATED OUT LOUD ──────────────────────────────────────────────────
 *
 * `S.zoomGaugeRect` IS SET BY THESE TESTS, not by the painter. The rect is published by the LAB's
 * `d2System` at its draw site, and the LAB is a parallel owner in this same wave; more to the point,
 * a HOST test that read the painter's chosen coordinates would be pinned to a picture Max is still
 * free to move. So each case renders a real design-2 SYSTEM frame and then writes
 * `drv.S.zoomGaugeRect = TRACK` onto the live `S` — which is exactly what the paint does — and does
 * NOT render again before the press (`resetPicks` clears the rect at the head of every frame,
 * index.js:201). What is pinned here is the HOST's half: which press arms, which does not, what the
 * move does with the number, and what the release drops.
 *
 * ⚠ AND WHERE A CASE PINS THE HOST'S OWN GATE rather than the pair, it forces `drv.zoomGrab` to
 * answer `true` unconditionally and says so at the line — otherwise the driver's own
 * `S.design !== 2 || S.level !== 4` refusal would carry the case and the host's gate could be
 * deleted with every test still green.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';

const W = 417, H = 240;

/** The seam's range, restated here rather than imported: [0.3, 5.0] is legacy's own clamp (:4708). */
const ZMIN = 0.3, ZMAX = 5.0;
const LN_MIN = Math.log(ZMIN), LN_MAX = Math.log(ZMAX);

/**
 * The track this file publishes: a 6-texel vertical strip at the right edge of THE PANE THAT FRAME
 * DREW — `drv.regions().map`, read off the paint, never a literal.
 *
 * ⛔ IT HAS TO BE THE PANE'S, NOT A CONSTANT, AND THAT IS A MEASUREMENT, NOT A PRECAUTION. Design 2's
 * SYSTEM pane is `{x:0, y:8, w:417, h:224}` but design 1's is `{x:0, y:6, w:252, h:216}` — a track at
 * x = 396 is OFF design 1's map, so `pressStartsGesture` answers false, `_handleMouseDown` returns at
 * :4401, and the arm at :4405 is never reached. A design-1 case pinned on a fixed track would pass
 * with the whole of the :4405 fold deleted (measured: mutant M3 below was green until this changed).
 */
const trackIn = (map) => ({ x: map.x + map.w - 21, y: map.y + 52, w: 6, h: 120 });
/** What `trackIn` yields on design 2's SYSTEM pane — the geometry the absolute numbers below assume. */
const TRACK = { x: 396, y: 60, w: 6, h: 120 };

/** The seam's mapping, written out: t = 0 at the BOTTOM (y+h), t = 1 at the TOP (y). */
const zoomAt = (py, r = TRACK) => {
  const t = Math.max(0, Math.min(1, (r.y + r.h - py) / r.h));
  return Math.exp(LN_MIN + t * (LN_MAX - LN_MIN));
};

const down = (nav, x, y) => nav._handleMouseDown({ clientX: x, clientY: y, button: 0 });
const move = (nav, x, y) => nav._handleMouseMove({ clientX: x, clientY: y });
const up = (nav) => nav._handleMouseUp();
const press = (nav, code, extra = {}) =>
  nav._onKeyDown({ code, shiftKey: false, key: '', preventDefault() {}, stopPropagation() {}, ...extra });

/**
 * A real NavComputer standing in a real system, under a real driver.
 *
 * The prism is loaded first because every design needs it before it can draw anything, and the
 * SYSTEM star is the NEAREST LOADED one with the pilot standing ON it — the `at()` helper's rule
 * from `navDefects2026.design.test.js:128-150`, which is what makes `_isCurrentSystem()` true.
 */
async function sysNav(mode = 'bars', { level = 4, planets = 4 } = {}) {
  const h = await makeHeadlessNav({ width: W, height: H });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = 3;
  h.nav.viewMode = mode;
  h.nav.render();
  h.nav._systemStar = h.nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
  if (h.nav._systemStar) {
    h.nav._playerX = h.nav._systemStar.wx; h.nav._playerY = h.nav._systemStar.wy; h.nav._playerZ = h.nav._systemStar.wz;
  }
  h.nav._systemData = {
    star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
    planets: Array.from({ length: planets }, (_, i) => ({
      orbitRadiusAU: 0.4 + i * 0.9, moons: [],
      planetData: { radiusEarth: 1 + (i % 4), T_eq: 260, habitability: { score: 0.2 }, rings: false },
    })),
  };
  h.nav._levelIndex = level;
  h.nav.render();
  h.drv = h.nav._viewDriverInst;
  return h;
}

/**
 * Render a frame, then publish a track at the right edge of the pane THAT frame drew (see the header).
 *
 * Returns the rect and the middle of its centre texel, so every case presses where the gauge is
 * rather than where design 2 happens to put it.
 */
async function gaugeUp(mode = 'bars', opts = {}) {
  const h = await sysNav(mode, opts);
  h.track = trackIn(h.drv.regions().map);
  h.drv.S.zoomGaugeRect = { ...h.track };
  h.at = { x: h.track.x + 3.5, y: h.track.y + 60.5 };
  return h;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-6 — the flag exists before anything can arm it
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-6 — `_zoomDrag` is a declared field of the class', () => {
  it('⭐ A FRESH NavComputer OWNS `_zoomDrag` AND IT IS `false`', async () => {
    const h = await makeHeadlessNav({ width: W, height: H });
    // MUTANT: delete the :156 fold. `undefined` is falsy and every drag case below still passes —
    // this is the one case that goes red, which is the whole reason the default is declared.
    expect(Object.prototype.hasOwnProperty.call(h.nav, '_zoomDrag')).toBe(true);
    expect(h.nav._zoomDrag).toBe(false);
  }, 30000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-6 — the press inside the track takes the gauge, and the drag spends it on the zoom
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-6 — design 2 at SYSTEM: a press inside the published track drags the zoom', () => {
  it('⭐⭐ THE PRESS ARMS AND THE MOVE SETS `_systemZoom` TO THE TRACK\'S OWN NUMBER', async () => {
    const h = await gaugeUp('bars');
    const { nav, drv } = h;
    expect(drv.S.design, 'the frame that published the track was design 2').toBe(2);
    expect(drv.S.level).toBe(4);
    expect(h.track, 'design 2\'s SYSTEM pane puts the track here').toEqual(TRACK);
    expect(h.at).toEqual({ x: 399.5, y: 120.5 });
    expect(nav._systemZoom).toBe(1.0);
    const rot0 = { x: nav._systemRotX, y: nav._systemRotY };

    down(nav, 399.5, 120.5);                       // the middle of a texel, inside the track
    expect(nav._zoomDrag, 'the press took the gauge').toBe(true);
    expect(nav._dragging).toBe(true);
    // ⛔ and it took ONLY the gauge — the ladder's two fields are `rail`-gated and stay clear
    expect(nav._counterDrag).toBe(false);
    expect(nav._dragStartLadder).toBe(null);

    move(nav, 411.5, 70.5);                        // 12 texels right, 50 texels up the track
    // MUTANT: drop `zoomDragTo` from the :4355 fold (or point it at `p.x`) — the number lands elsewhere.
    expect(nav._systemZoom).toBeCloseTo(zoomAt(70.5), 12);
    expect(nav._systemZoom).toBeCloseTo(3.908933109400, 9);   // the absolute value, measured

    // ⛔ MUTANT: delete the `return` at the end of the :4355 fold. dx = 12 would then also spin the
    //    orrery to rotY = 0.096 and rotX = 0.5 + 50*0.008, and the pilot drags two controls at once.
    expect(nav._systemRotX).toBe(rot0.x);
    expect(nav._systemRotY).toBe(rot0.y);

    up(nav);
    nav.render();
    expect(drv.S.sysCam.rotX).toBe(rot0.x);
    expect(drv.S.sysCam.rotY).toBe(rot0.y);
    expect(drv.S.sysCam.zoom).toBeCloseTo(zoomAt(70.5), 12);
  }, 30000);

  it('⭐ THE TRACK\'S TWO ENDS ARE THE CLAMPS — top is 5.0, bottom is 0.3, and past them it pegs', async () => {
    const h = await gaugeUp('bars');
    const { nav } = h;
    down(nav, 399.5, 120.5);
    move(nav, 399.5, TRACK.y + 0.5);               // the top row of the track
    expect(nav._systemZoom).toBeCloseTo(4.941729483384, 9);
    move(nav, 399.5, TRACK.y);                     // t = 1 exactly
    expect(nav._systemZoom).toBeCloseTo(5.0, 12);
    move(nav, 399.5, TRACK.y - 40);                // above the track: pegged, never past the clamp
    expect(nav._systemZoom).toBeCloseTo(5.0, 12);
    move(nav, 399.5, TRACK.y + TRACK.h);           // t = 0 exactly
    expect(nav._systemZoom).toBeCloseTo(0.3, 12);
    move(nav, 399.5, TRACK.y + TRACK.h + 40);      // below it: pegged
    expect(nav._systemZoom).toBeCloseTo(0.3, 12);
    // MUTANT: pass `p.x` instead of `p.y` at :4355 — every one of these six readings moves off the
    //         track's own mapping, and the pegs stop being the wheel's [0.3, 5.0] at :4708.
    up(nav);
  }, 30000);

  it('⛔ A PRESS ONE TEXEL PAST THE TRACK\'S SKIRT ROTATES THE ORRERY AND LEAVES THE ZOOM AT 1.0', async () => {
    const h = await gaugeUp('bars');
    const { nav } = h;
    // the driver allows one texel either side (`x >= r.x - 1 && x < r.x + r.w + 1`); 403.5 is past it
    expect(h.drv.zoomGrab(403.5, 120.5)).toBe(false);
    down(nav, 403.5, 120.5);
    expect(nav._zoomDrag).toBe(false);
    move(nav, 415.5, 70.5);
    // MUTANT: arm unconditionally at :4405 (`this._zoomDrag = true`) — the orrery stops rotating.
    expect(nav._systemRotY).toBeCloseTo(0 + 12 * 0.008, 12);
    expect(nav._systemRotX).toBeCloseTo(0.5 - (-50) * 0.008, 12);
    expect(nav._systemZoom).toBe(1.0);
    up(nav);
  }, 30000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-6 — the two gates the HOST owns: the look, and the level
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-6 — design 1 never arms it, and no level but SYSTEM does', () => {
  it('⭐⭐ DESIGN 1 AT SYSTEM: a press on the same track arms nothing and the zoom stays 1.0', async () => {
    const h = await gaugeUp('rail');
    const { nav } = h;
    expect(nav.viewMode).toBe('rail');
    expect(h.track, 'design 1\'s SYSTEM pane is narrower, so its track is elsewhere').toEqual({ x: 231, y: 58, w: 6, h: 120 });
    expect(h.drv.pressStartsGesture(h.at.x, h.at.y), 'and the press DOES reach :4405').toBe(true);
    down(nav, h.at.x, h.at.y);
    expect(nav._zoomDrag).toBe(false);
    move(nav, h.at.x + 12, h.at.y - 50);
    // Max's ruling on item 18: "design 2 yes; design 1 no — its ladder is a scroll, not a zoom".
    expect(nav._systemZoom).toBe(1.0);
    up(nav);
  }, 30000);

  it('⛔ AND THE LOOK GATE IS THE HOST\'S OWN — a driver that says `true` is still refused under `rail`', async () => {
    const h = await gaugeUp('rail');
    const { nav, drv } = h;
    // ⚠ FORCED: the real `zoomGrab` refuses on `S.design !== 2` all by itself, so without this the
    //   driver would carry the case and `viewMode === 'bars'` could be deleted from :4405 unnoticed.
    drv.zoomGrab = () => true;
    expect(drv.pressStartsGesture(h.at.x, h.at.y), 'the press is on design 1\'s map, not its rail').toBe(true);
    down(nav, h.at.x, h.at.y);
    // MUTANT: drop `this.viewMode === 'bars'` from the :4405 fold — this flips to true.
    expect(nav._zoomDrag).toBe(false);
    move(nav, h.at.x + 12, h.at.y - 50);
    expect(nav._systemZoom).toBe(1.0);
    up(nav);
  }, 30000);

  it('⛔ PRISM IN DESIGN 2: the arm lives in the level-4 branch, so a press at level 3 takes the Y-GAUGE only', async () => {
    const h = await gaugeUp('bars', { level: 3 });
    const { nav, drv } = h;
    expect(nav._levelIndex).toBe(3);
    drv.zoomGrab = () => true;                     // ⚠ FORCED, same reason as above
    expect(drv.pressStartsGesture(h.at.x, h.at.y)).toBe(true);
    down(nav, h.at.x, h.at.y);
    // MUTANT: hoist the :4405 fold above `if (this._levelIndex === 3)` — this flips to true and a
    //         press meant for the prism's rotation would scrub a zoom the prism does not have.
    expect(nav._zoomDrag).toBe(false);
    move(nav, h.at.x + 12, h.at.y - 50);
    expect(nav._systemZoom).toBe(1.0);
    up(nav);
  }, 30000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-6 — the release
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-6 — mouse-up drops the grab, and the grab does not survive the press that follows it', () => {
  it('⭐ THE RELEASE CLEARS `_zoomDrag` AND LEAVES THE ZOOM WHERE THE MARK WAS DROPPED', async () => {
    const h = await gaugeUp('bars');
    const { nav } = h;
    down(nav, 399.5, 120.5);
    move(nav, 399.5, 90.5);
    const landed = nav._systemZoom;
    expect(landed).toBeCloseTo(zoomAt(90.5), 12);
    up(nav);
    expect(nav._zoomDrag).toBe(false);
    expect(nav._dragging).toBe(false);
    expect(nav._systemZoom).toBe(landed);          // releasing writes nothing back
  }, 30000);

  it('⭐⭐ A STALE GRAB CANNOT REACH A LATER GESTURE THAT ARRIVES AT SYSTEM MID-DRAG', async () => {
    const h = await gaugeUp('bars');
    const { nav } = h;
    down(nav, 399.5, 120.5);
    up(nav);                                        // the gauge press ends here

    // Now the hazard the :4415 fold exists for: the NEXT press is taken at another level, so the
    // level-4 branch at :4405 never runs and nothing rewrites the flag — and the level then BECOMES
    // 4 under the held pointer (`_systemZoomAnim` sets `_levelIndex = 4` mid-frame at :1336-1338).
    nav._levelIndex = 3;
    down(nav, 200.5, 120.5);
    nav._levelIndex = 4;
    move(nav, 399.5, 70.5);
    // MUTANT: delete `this._zoomDrag = false;` from the :4415 fold — the stale grab eats this move
    //         and slams the zoom to 3.908… on a gesture that never touched the gauge.
    expect(nav._systemZoom).toBe(1.0);
    up(nav);
  }, 30000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-6 — the seam is called OPTIONALLY, and with exactly the coordinates the contract names
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-6 — the host calls the driver optionally, and passes it the press point', () => {
  it('⛔ A DRIVER WITHOUT `zoomGrab` / `zoomDragTo` IS INERT — the drag rotates and nothing throws', async () => {
    const h = await gaugeUp('bars');
    const { nav, drv } = h;
    delete drv.zoomGrab; delete drv.zoomDragTo;     // a tree where the DRIVER half has not landed
    expect(() => { down(nav, 399.5, 120.5); move(nav, 411.5, 70.5); up(nav); }).not.toThrow();
    expect(nav._zoomDrag).toBe(false);
    expect(nav._systemZoom).toBe(1.0);
    expect(nav._systemRotY).toBeCloseTo(12 * 0.008, 12);   // exactly the pre-fold behaviour
  }, 30000);

  it('⭐ `zoomGrab` GETS (p.x, p.y) AND `zoomDragTo` GETS p.y — the press point, not the client point', async () => {
    const h = await gaugeUp('bars');
    const { nav, drv } = h;
    const grabs = [], drags = [];
    const realGrab = drv.zoomGrab, realDrag = drv.zoomDragTo;
    drv.zoomGrab = (...a) => { grabs.push(a.slice()); return realGrab(...a); };
    drv.zoomDragTo = (...a) => { drags.push(a.slice()); return realDrag(...a); };
    down(nav, 399.5, 120.5);
    move(nav, 411.5, 70.5);
    up(nav);
    expect(grabs).toEqual([[399.5, 120.5]]);
    // MUTANT: pass `p.x` at :4355 — this becomes [[411.5]] and the zoom tracks the wrong axis.
    expect(drags).toEqual([[70.5]]);
  }, 30000);

  it('⛔ AND A LEGACY PRESS NEVER BUILDS A DRIVER TO ASK — today\'s nav pays nothing for the gauge', async () => {
    const h = await makeHeadlessNav({ width: W, height: H });
    h.nav._viewModesEnabled = true;
    h.nav.viewMode = null;
    h.nav._levelIndex = 4;
    down(h.nav, 399.5, 120.5);
    move(h.nav, 411.5, 70.5);
    up(h.nav);
    // MUTANT: write `(this._viewDriverInst ||= makeViewModeDriver(this))` into the :4405 fold, as the
    //         y-gauge's own arm at :4402 does — legacy would start constructing a driver per press.
    expect(h.nav._viewDriverInst).toBe(null);
    expect(h.nav._zoomDrag).toBe(false);
    expect(h.nav._systemZoom).toBe(1.0);
  }, 30000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LEGACY BYTE-IDENTITY — the four folds are viewMode-gated, so today's nav draws what HEAD drew
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * The hashes `navDefects2026w2.host.test.js:537-551` measured against HEAD, carried here.
 *
 * ⛔ THEY ARE THAT FILE'S MEASUREMENT, NOT A SECOND ONE: taken 2026-09-18 by importing
 * `git show HEAD:src/ui/NavComputer.js` into a throwaway sibling module alongside the working copy
 * in one vitest run. Two files asserting the same numbers is not duplication — that list is the
 * defects batch's guarantee about ITS four folds, this one is this workstream's about ITS four, and
 * a fold that moved legacy would have to move both.
 *
 * ⛔ LEVEL 3's CALL STREAM IS NOT PINNED, THERE OR HERE, BECAUSE IT IS NON-DETERMINISTIC IN HEAD
 * ITSELF — the prism's background star load. Re-measured here on the current tree: four consecutive
 * legacy renders of the SAME nav at PRISM gave four different call hashes (1d1527fd85b910ef,
 * fb4b390037416bb9, a0873cf70df1d362, b357161394bff25b) and ONE text hash. So the V-cycle case below
 * compares `text` at all five levels and `calls` only where a hash exists to compare.
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

/** Hash exactly one frame: clear the recorder, render, hash what that render emitted. */
function frame(h) {
  h.rec.text.length = 0; h.rec.calls.length = 0;
  h.nav.render();
  return { text: sha(h.rec.text), calls: sha(h.rec.calls) };
}

describe('LEGACY BYTE-IDENTITY — AC-6\'s folds change nothing with `viewMode` null', () => {
  for (const L of [0, 1, 2, 3, 4]) {
    const name = ['GALAXY', 'SECTOR', 'REGION', 'PRISM', 'SYSTEM'][L];
    it(`⭐⭐ ${name} on a fresh open: the emitted text stream hashes to HEAD's`, async () => {
      const h = await makeHeadlessNav({ width: W, height: H });
      h.nav._viewModesEnabled = true;
      h.nav.viewMode = null;
      h.nav._levelIndex = L;
      const f = frame(h);
      expect(f.text).toBe(LEGACY_TEXT[L]);
      if (LEGACY_CALLS[L]) expect(f.calls).toBe(LEGACY_CALLS[L]);
    }, 30000);
  }

  it('⭐⭐ AND AFTER A FULL `V` CYCLE BACK TO LEGACY, EVERY LEVEL HASHES TO THE SAME FRAME', async () => {
    const h = await makeHeadlessNav({ width: W, height: H });
    h.nav._viewModesEnabled = true;
    h.nav.viewMode = null;

    const before = {};
    for (const L of [0, 1, 2, 3, 4]) { h.nav._levelIndex = L; frame(h); before[L] = frame(h); }

    // V until the look comes back round to legacy — the cycle's length is the driver's, not ours.
    let hops = 0;
    do { press(h.nav, 'KeyV'); hops++; } while (h.nav.viewMode !== null && hops < 8);
    expect(h.nav.viewMode, `V came back to legacy in ${hops} hops`).toBe(null);
    expect(hops).toBeGreaterThan(1);
    expect([h.nav._canvas.width, h.nav._canvas.height], 'the buffer came back too').toEqual([W, H]);

    for (const L of [0, 1, 2, 3, 4]) {
      h.nav._levelIndex = L; frame(h);
      const after = frame(h);
      // MUTANT: fold the :4355 or :4405 statement in WITHOUT its `viewMode` gate — a V cycle leaves
      //         `_zoomDrag`/`_systemZoom` touched and legacy's SYSTEM frame stops matching.
      expect(after.text, `level ${L} text after the V cycle`).toBe(before[L].text);
      expect(after.text, `level ${L} text is still HEAD's`).toBe(LEGACY_TEXT[L]);
      if (LEGACY_CALLS[L]) expect(after.calls, `level ${L} calls after the V cycle`).toBe(before[L].calls);
    }
  }, 60000);
});
