/**
 * navRestorations3.driver — THE DRIVER'S HALF OF WAVE 2a (nav-restorations-2026-09-20).
 *
 * Four fields and two methods, all of them seams between the LAB's paint and the HOST's folds:
 *
 *   `D.bodies` belt rows' `isKuiper`  AC-8 — the generator's own flag, which `buildBodies` dropped.
 *   `S.hoverCalloutRect` default      AC-1 — the plate the wave-1b paint publishes had no default.
 *   `S.zoomGaugeRect` + its clear     AC-6 — design 2's SYSTEM zoom gauge, published by the paint.
 *   `zoomGrab` / `zoomDragTo`         AC-6 — the two halves that make that track a HANDLE.
 *
 * ── ⛔ THE STANDARD, INHERITED FROM navRestorations1.driver ──────────────────────────────────────
 *
 * Real input through the real handlers: a wheel notch is `nav._handleWheel`, a frame is
 * `nav.render()`, a state is `makeViewState()`. Every assertion is an absolute fact — a boolean, a
 * number to 1e-9, `null` — and never a restatement of a layout. Each case names the MUTANT it dies
 * against in its own comment.
 *
 * ── ⚠⚠ TWO CASES PUBLISH `S.zoomGaugeRect` THEMSELVES, AND SAY SO ───────────────────────────────
 *
 * The rect is the LAB's to publish (`d2System`, SEAM §2) and lands in the same wave as this file.
 * What the DRIVER owns is the mapping ON a published rect — so these cases assign
 * `drv.S.zoomGaugeRect` directly after a real frame and then drive the driver's own methods. That
 * is not a shortcut past the paint: it is the only way to pin the arithmetic to EXACT texels
 * (a track at a texel the paint happens to choose would make every expected number a copy of draw
 * code), and it makes the cases pass identically before and after the lab's half arrives. Where a
 * case is about the rect's LIFETIME rather than its mapping, the frame does the work and nothing is
 * assigned — see `resetPicks` below.
 *
 * ── ⚠ WHAT THIS FILE DOES NOT CLAIM ─────────────────────────────────────────────────────────────
 *
 * Nothing here says a gauge is DRAWN (the lab's half) or that a press ARMS one (the host's folds at
 * :156 / :4355 / :4405 / :4415). It says: given a published track, this is the zoom every pointer
 * on it asks for, and the number is the one the instrument's own wheel clamps to.
 */

import { describe, it, expect } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';

const W = 417, H = 240;   // ⭐ MAX'S OWN BUFFER — the size every number below is measured at.

/** A nav with the prism loaded and a design on, at `level`. (navRestorations1.driver:53) */
async function designNav({ mode = 'bars', level = 3 } = {}) {
  const h = await makeHeadlessNav({ width: W, height: H });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = 3;
  h.nav.viewMode = mode;
  h.nav.render();                       // populates _localStars via _renderLocal's own loader
  if (level !== 3) { h.nav._levelIndex = level; h.nav.render(); }
  h.drv = h.nav._viewDriverInst;
  return h;
}

/**
 * Stand the pilot ON the nearest loaded star and give it a system, so `_isCurrentSystem()` is true.
 *
 * ⛔ THE STAR IS THE NEAREST LOADED ONE, NOT A LITERAL — the host's 0.1 pc identity test, never a
 *    seed comparison. Copied from navDefects2026.design.test.js:128-150 via navRestorations1.driver.
 * ⚠ `belts` TAKES THE RAW GENERATOR SHAPE, because the AC-8 case below is precisely about which
 *   fields of that shape survive into `D.bodies`.
 */
function standOnSystem(nav, { planets = 4, moonsOn = 1,
                              belts = [{ centerRadiusAU: 3.2 }] } = {}) {
  nav._systemStar = nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
  if (nav._systemStar) {
    nav._playerX = nav._systemStar.wx; nav._playerY = nav._systemStar.wy; nav._playerZ = nav._systemStar.wz;
  }
  nav._systemData = {
    star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 },
    asteroidBelts: belts,
    planets: Array.from({ length: planets }, (_, i) => ({
      orbitRadiusAU: 0.4 + i * 0.9, orbitAngle: i * 1.1,
      moons: i === moonsOn ? [{ type: 'rock', radiusEarth: 0.2, orbitRadiusEarth: 30 }] : [],
      planetData: { radiusEarth: 1 + (i % 4), T_eq: 260, habitability: { score: 0.2 }, rings: false },
    })),
  };
  nav._currentSystemData = nav._systemData;
  nav._levelIndex = 4;
  nav.render();
}

/** One wheel notch, through the real handler, then a real frame. */
function wheel(h, deltaY) { h.nav._handleWheel({ deltaY, preventDefault() {} }); h.nav.render(); }

/** A track the cases below publish themselves — see the header. Chosen so every edge is an integer. */
const TRACK = { x: 300, y: 40, w: 4, h: 100 };

/** The seam's own mapping, forwards: where the PAINT would put the mark for `z`. t=0 at the bottom. */
const markY = (r, z) =>
  r.y + r.h - ((Math.log(z) - Math.log(0.3)) / (Math.log(5) - Math.log(0.3))) * r.h;

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-8 — a belt row carries the generator\'s own Kuiper flag', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * ⛔ MUTANTS: `buildBodies-drop-isKuiper` (delete the new field — both rows report `undefined`,
   *    and the outer belt's `toBe(true)` goes red) and `buildBodies-raw-copy` (`isKuiper: b.isKuiper`
   *    without the coercion — the inner belt reports `undefined`, and the `toBe(false)` goes red).
   *    The second mutant is the one that matters downstream: `beltLabel` (designs.js:1901) branches
   *    on `b.isKuiper != null` to tell the builder's answer from the builder's silence, so an
   *    `undefined` inner belt falls back to geometry and the flag path is never exercised at all.
   */
  it('⭐ the Kuiper belt arrives true and the asteroid belt arrives FALSE, not undefined', async () => {
    const h = await designNav({ mode: 'bars', level: 3 });
    standOnSystem(h.nav, {
      // The generator's own shape: `isKuiper` is SET on the outer belt and ABSENT on the inner one
      // (StarSystemGenerator.js:769, SolarSystemData.js:875 — it is never written as `false`).
      belts: [{ centerRadiusAU: 2.7, widthAU: 1.2 }, { centerRadiusAU: 44, widthAU: 20, isKuiper: true }],
    });

    const rows = h.drv.D.bodies.filter((b) => b.kind === 'belt');
    expect(rows.length, 'the fixture\'s two belts did not reach D.bodies').toBe(2);
    const inner = rows.find((b) => b.au < 10), outer = rows.find((b) => b.au > 10);
    expect(inner, 'no inner belt row').toBeTruthy();
    expect(outer, 'no outer belt row').toBeTruthy();

    expect(outer.isKuiper, 'the generator said KUIPER and the body list dropped it').toBe(true);
    // ⭐ STRICTLY `false`. `toBeFalsy()` would pass on the `undefined` the raw-copy mutant produces,
    //    which is the exact value `beltLabel` reads as "the builder is silent".
    expect(inner.isKuiper, 'the inner belt\'s flag is not an explicit false').toBe(false);
    expect(typeof inner.isKuiper).toBe('boolean');
  }, 120000);

  /**
   * ⛔ MUTANT: `buildBodies-isKuiper-by-index` (set the flag from the belt's POSITION in the array,
   *    `i === belts.length - 1`) — a plausible stand-in for the generator's answer that this case
   *    kills, because the generator is free to emit the Kuiper belt first.
   */
  it('⛔ and it is the FLAG that travels, not the belt\'s position in the list', async () => {
    const h = await designNav({ mode: 'bars', level: 3 });
    standOnSystem(h.nav, {
      belts: [{ centerRadiusAU: 44, widthAU: 20, isKuiper: true }, { centerRadiusAU: 2.7, widthAU: 1.2 }],
    });
    const rows = h.drv.D.bodies.filter((b) => b.kind === 'belt');
    expect(rows.length).toBe(2);
    expect(rows.find((b) => b.au > 10).isKuiper, 'the flag followed the index instead of the belt').toBe(true);
    expect(rows.find((b) => b.au < 10).isKuiper).toBe(false);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('Defaults — every field a painter reads has one before the first frame', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * ⛔ MUTANTS: `state-drop-zoomGaugeRect-default` and `state-drop-hoverCalloutRect-default` — each
   *    leaves its field `undefined`, and `toBe(null)` is what tells the two apart.
   * ⚠ `hoverCalloutRect` IS NOT IN `resetPicks()` AND MUST NOT BE. The paint clears it itself, at
   *   the head of both designs (designs.js:796 / :2149) and again at the head of `hoverCallout`
   *   (:1999). What the default buys is the only window those three clears cannot cover: the frames
   *   between `makeViewState()` and the first paint, where `PanelHost` freezes the glass on the
   *   first painter throw. That window is what this case stands in.
   */
  it('⛔ S.zoomGaugeRect and S.hoverCalloutRect are declared null, not left undefined', async () => {
    const { makeViewState } = await import('../navViewModes/state.js');
    const { S } = makeViewState();
    expect(S.zoomGaugeRect, 'S.zoomGaugeRect has no declared default').toBe(null);
    expect(S.hoverCalloutRect, 'S.hoverCalloutRect has no declared default').toBe(null);
  });

  /** ⛔ MUTANT: rename either method — the HOST calls both with `?.()`, so a rename is a gauge that
   *  is drawn and inert rather than a throw. The names ARE the contract (index.js's export note). */
  it('⛔ the driver exports zoomGrab and zoomDragTo under exactly those names', async () => {
    const h = await designNav({ mode: 'bars', level: 3 });
    expect(typeof h.drv.zoomGrab, 'NavComputer.js:4405 calls zoomGrab?.() — nothing answers').toBe('function');
    expect(typeof h.drv.zoomDragTo, 'NavComputer.js:4355 calls zoomDragTo?.() — nothing answers').toBe('function');
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-6 — zoomGrab: is the pointer on design 2\'s SYSTEM zoom gauge?', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * ⛔ MUTANTS: `zoomGrab-no-skirt` (`x >= r.x && x < r.x + r.w`) — the two skirt texels go red;
   *    `zoomGrab-y-skirt` (the same ±1 applied to y) — `r.y - 1` goes red. The shape is `gaugeGrab`'s
   *    exactly (index.js:1010): one texel either side on x, the track's own bounds on y, because the
   *    track's LENGTH is the range it reads and a skirt there would report a zoom past both clamps.
   * ⚠ THE RECT IS PUBLISHED BY THIS CASE — see the file header.
   */
  it('⭐ inside answers true, with gaugeGrab\'s own one-texel skirt on x and none on y', async () => {
    const h = await designNav({ mode: 'bars', level: 3 });
    standOnSystem(h.nav);
    h.drv.S.zoomGaugeRect = { ...TRACK };             // published by this test, not by the paint
    const g = (x, y) => h.drv.zoomGrab(x, y);
    const r = TRACK, midY = r.y + r.h / 2;

    expect(g(r.x + r.w / 2, midY), 'the middle of the track refused the pointer').toBe(true);
    // x: one texel of skirt either side, and the second texel out is a miss.
    expect(g(r.x - 1, midY), 'the left skirt is missing').toBe(true);
    expect(g(r.x + r.w, midY), 'the right skirt is missing').toBe(true);
    expect(g(r.x - 2, midY), 'the grab reaches two texels left of the track').toBe(false);
    expect(g(r.x + r.w + 1, midY), 'the grab reaches two texels right of the track').toBe(false);
    // y: the track's own bounds, closed at the top and open at the bottom.
    expect(g(r.x + 1, r.y), 'the top texel of the track is not grabbable').toBe(true);
    expect(g(r.x + 1, r.y + r.h - 1), 'the bottom texel of the track is not grabbable').toBe(true);
    expect(g(r.x + 1, r.y - 1), 'the grab reaches above the track, where there is no zoom to read').toBe(false);
    expect(g(r.x + 1, r.y + r.h), 'the grab reaches below the track').toBe(false);
  }, 120000);

  /**
   * ⛔ MUTANT: `zoomGrab-publication-only` (drop `S.design !== 2 || S.level !== 4`) — the design-1
   *    and the PRISM cases both go red. The clause is belt-and-braces today (only `d2System`
   *    publishes and `resetPicks` clears every frame), and it is written because the failure it
   *    guards is asymmetric: a stale track answering a press would arm a ZOOM drag over design 1's
   *    ladder, where the identical gesture is a SCRUB.
   */
  it('⛔ no rect, design 1, or any level but SYSTEM all answer false', async () => {
    const h = await designNav({ mode: 'bars', level: 3 });
    standOnSystem(h.nav);
    const r = TRACK, p = [r.x + r.w / 2, r.y + r.h / 2];

    // ⚠ CLEARED BY HAND, because the lab's `d2System` publishes a real track here. This clause is
    //   about the `!r` branch — the frames before the first paint of a design — so the rect has to
    //   be absent for it to say anything.
    h.drv.S.zoomGaugeRect = null;
    expect(h.drv.zoomGrab(...p), 'a grab answered with no track on the glass').toBe(false);

    // Design 2, but at PRISM: the gauge does not draw at any level but SYSTEM (SEAM §2).
    h.nav._levelIndex = 3; h.nav.render();
    h.drv.S.zoomGaugeRect = { ...TRACK };             // published by this test
    expect(h.drv.S.level).toBe(3);
    expect(h.drv.zoomGrab(...p), 'PRISM answered for a SYSTEM gauge').toBe(false);

    // Design 1 at SYSTEM: Max's ruling is that the ladder has no wheel zoom and no gauge.
    h.nav._levelIndex = 4; h.nav.viewMode = 'rail'; h.nav.render();
    h.drv.S.zoomGaugeRect = { ...TRACK };             // published by this test
    expect(h.drv.S.design).toBe(1);
    expect(h.drv.zoomGrab(...p), 'design 1 offered a zoom handle over its ladder').toBe(false);
  }, 120000);

  /**
   * ⛔ MUTANT: `resetPicks-keeps-zoomGaugeRect` (drop the new clear at index.js:201) — the stale
   *    track survives into design 1's frame and this case goes red. NOTHING IS PUBLISHED BY HAND
   *    HERE except the stale value being tested: the frame is what has to clear it.
   * ⚠ THE FRAME IS DESIGN 1's ON PURPOSE. Design 2's SYSTEM frame republishes the rect once the
   *   lab's half lands, which would make the case agree with itself; design 1 never draws a gauge
   *   at any level, so a rect after its frame can only be a stale one.
   */
  it('⛔ resetPicks clears it — a track cannot outlive the frame that drew it', async () => {
    const h = await designNav({ mode: 'rail', level: 3 });
    standOnSystem(h.nav);
    expect(h.drv.S.design).toBe(1);
    h.drv.S.zoomGaugeRect = { ...TRACK };             // the stale value under test
    h.nav.render();                                   // one real frame, design 1 at SYSTEM
    expect(h.drv.S.zoomGaugeRect, 'design 1\'s frame left design 2\'s track live').toBe(null);
  }, 120000);

  /**
   * ⭐⭐ THE SEAM ITSELF — THE TRACK THE LAB ACTUALLY DREW IS ONE A PRESS CAN REACH.
   *
   * ⛔ THE GAUGE HAS TO LIE INSIDE THE MAP PANE OR IT IS DECORATION. `NavComputer._handleMouseDown`
   *    runs `if (!onMap) return;` at :4401 and arms `_zoomDrag` at :4405 — AFTER it — and `onMap` is
   *    THIS DRIVER'S `pressStartsGesture`. So a track published one texel outside `regions().map`
   *    would draw, publish, answer `zoomGrab` happily, and never once be pressed. Nothing in
   *    `zoomGrab` can detect that; only this pairing can.
   * ⚠ NOTHING IS PUBLISHED BY HAND HERE — the rect under test is the lab's own, off a real frame.
   * ⛔ ITS OWN NEGATIVE CONTROL rather than a mutant in another lane's generated file: the same
   *    rect moved off the pane is refused by `pressStartsGesture`, which is the failure this case
   *    exists to catch.
   */
  it('⭐⭐ the published track is inside the map pane, so the host\'s press reaches the grab', async () => {
    const h = await designNav({ mode: 'bars', level: 3 });
    standOnSystem(h.nav);
    const r = h.drv.S.zoomGaugeRect;
    expect(r, 'design 2\'s SYSTEM frame published no zoom track at all').toBeTruthy();
    expect(r.h, 'the track has no length, so it reads no range').toBeGreaterThan(0);

    const map = h.drv.regions().map;
    expect(r.x >= map.x && r.x + r.w <= map.x + map.w,
      'the track hangs off the side of the map pane — :4401 returns before :4405 can arm it').toBe(true);
    expect(r.y >= map.y && r.y + r.h <= map.y + map.h,
      'the track hangs off the top or bottom of the map pane').toBe(true);

    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    expect(h.drv.pressStartsGesture(cx, cy),
      'a press on the drawn gauge is not a map press — the host returns at :4401').not.toBe(false);
    expect(h.drv.zoomGrab(cx, cy), 'the drawn gauge refuses a press at its own centre').toBe(true);

    // The track spans exactly the instrument's range, end to end.
    expect(h.drv.zoomDragTo(r.y + r.h)).toBeCloseTo(0.3, 9);
    expect(h.drv.zoomDragTo(r.y)).toBeCloseTo(5, 9);

    // ⛔ THE NEGATIVE CONTROL: the same track, moved off the pane, is not a press the host reaches.
    h.drv.S.zoomGaugeRect = { ...r, x: map.x + map.w + 4 };
    expect(h.drv.pressStartsGesture(map.x + map.w + 4 + r.w / 2, cy),
      'the control is vacuous — a rect outside the pane still counts as a map press').toBe(false);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-6 — zoomDragTo: the zoom a pointer on the track is asking for', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * ⛔ MUTANTS: `zoomDragTo-linear` (`0.3 + t * (5 - 0.3)`) — the middle reads 2.65 instead of
   *    1.2247 and goes red; `zoomDragTo-inverted-t` (`(py - r.y) / r.h`) — the bottom reads 5.
   * ⭐⭐ THE TWO ENDS ARE CHECKED AGAINST THE INSTRUMENT, NOT AGAINST LITERALS. `LN_ZOOM_MIN/MAX`
   *    restate `NavComputer._handleWheel:4708`'s own clamps, which is a second copy — so this case
   *    drives the REAL WHEEL past both clamps and asserts the gauge's ends equal the number
   *    `nav._systemZoom` actually holds there. A drift between the two copies fails here.
   */
  it('⭐⭐ the ends are the wheel\'s own clamps and the middle is sqrt(1.5)', async () => {
    const h = await designNav({ mode: 'bars', level: 3 });
    standOnSystem(h.nav);
    h.drv.S.zoomGaugeRect = { ...TRACK };             // published by this test, not by the paint
    const r = TRACK;

    // What the instrument itself clamps to, reached through the real wheel handler.
    for (let i = 0; i < 40; i++) wheel(h, -100);
    const hostMax = h.nav._systemZoom;
    for (let i = 0; i < 60; i++) wheel(h, 100);
    const hostMin = h.nav._systemZoom;
    expect(hostMax, 'the fixture never reached the instrument\'s upper clamp').toBeGreaterThan(1);
    h.drv.S.zoomGaugeRect = { ...TRACK };             // the frames above ran resetPicks; republish

    expect(h.drv.zoomDragTo(r.y + r.h), 'the bottom of the track is not the wheel\'s floor')
      .toBeCloseTo(hostMin, 9);
    expect(h.drv.zoomDragTo(r.y), 'the top of the track is not the wheel\'s ceiling')
      .toBeCloseTo(hostMax, 9);
    // ⭐ THE MIDDLE IS THE GEOMETRIC MEAN, WHICH IS WHAT "LOGARITHMIC" MEANS HERE: sqrt(0.3 * 5).
    expect(h.drv.zoomDragTo(r.y + r.h / 2), 'the track is linear — every zoom under 1 is crowded '
      + 'into its bottom seventh').toBeCloseTo(Math.sqrt(1.5), 9);
  }, 120000);

  /**
   * ⛔ MUTANT: `zoomDragTo-unclamped-t` (drop the `Math.max(0, Math.min(1, ...))`) — the pointer
   *    30 texels above the track reads 8.3 and the one below reads 0.18, both outside the range the
   *    instrument accepts, and the host's fold writes them straight into `_systemZoom`.
   */
  it('⛔ past either end it pegs, and with no track it answers null', async () => {
    const h = await designNav({ mode: 'bars', level: 3 });
    standOnSystem(h.nav);
    const r = TRACK;

    h.drv.S.zoomGaugeRect = null;                     // cleared by hand — the lab publishes one here
    expect(h.drv.zoomDragTo(r.y + 10), 'a drag answered with no track on the glass').toBe(null);

    h.drv.S.zoomGaugeRect = { ...TRACK };             // published by this test
    expect(h.drv.zoomDragTo(r.y - 30), 'the drag ran past the top of the track').toBeCloseTo(5, 9);
    expect(h.drv.zoomDragTo(r.y + r.h + 30), 'the drag ran past the bottom').toBeCloseTo(0.3, 9);
    expect(h.drv.zoomDragTo(NaN), 'a non-finite pointer produced a zoom').toBe(null);
    expect(h.drv.zoomDragTo(undefined)).toBe(null);

    // A zero-length track is a division by zero, i.e. NaN into `_systemZoom`.
    h.drv.S.zoomGaugeRect = { x: r.x, y: r.y, w: r.w, h: 0 };
    expect(h.drv.zoomDragTo(r.y), 'a zero-length track answered').toBe(null);
  }, 120000);

  /**
   * ⭐⭐ THE ROUND TRIP — the mark the paint draws for `z` is the pointer that asks for `z` back.
   *
   * This is the property the whole handle rests on: the mark lands under the pointer by
   * construction rather than by two pieces of arithmetic happening to agree (the AC-4 defect shape,
   * and the reason the y-gauge publishes its own mapping). `markY` here is the seam's FORWARD
   * mapping, written once; `zoomDragTo` is the driver's inverse of it.
   * ⛔ MUTANT: `zoomDragTo-linear` — z = 1 comes back as 1.94, and the mark the pilot grabbed jumps
   *    out from under the pointer on the first texel of the drag.
   * ⭐ TWO OF THE SAMPLES COME FROM THE REAL WHEEL rather than from this file, so the round trip is
   *    closed over a zoom the instrument actually produced.
   */
  it('⭐⭐ round trip: the mark drawn for a zoom is the pointer that asks for that zoom', async () => {
    const h = await designNav({ mode: 'bars', level: 3 });
    standOnSystem(h.nav);
    const r = TRACK;

    wheel(h, -100); wheel(h, -100);                   // two notches in, through the real handler
    const zIn = h.drv.S.sysCam.zoom;
    wheel(h, 100); wheel(h, 100); wheel(h, 100);      // and three out, past where it started
    const zOut = h.drv.S.sysCam.zoom;
    expect(zIn, 'the wheel did not move the design\'s zoom').toBeGreaterThan(1);
    expect(zOut, 'the wheel did not move the design\'s zoom back down').toBeLessThan(1);

    h.drv.S.zoomGaugeRect = { ...TRACK };             // published by this test, not by the paint
    for (const z of [0.3, 0.5, zOut, 1, Math.sqrt(1.5), zIn, 3, 5]) {
      const py = markY(r, z);
      expect(py, `the mark for ${z} fell off the track`).toBeGreaterThanOrEqual(r.y - 1e-9);
      expect(py).toBeLessThanOrEqual(r.y + r.h + 1e-9);
      expect(h.drv.zoomDragTo(py), `the pointer on the mark for ${z} asked for a different zoom`)
        .toBeCloseTo(z, 9);
    }
  }, 120000);
});
