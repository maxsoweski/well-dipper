/**
 * navSlabBar.test.js — naming-prism-segments Phase 3, the UI lane: AC-7 (the segment bar, the fine gauge
 * that follows the view, the neighbouring prisms' boundaries and the grid-aligned plane lattice) and the
 * designs' half of AC-6 (rows re-read only on a new `_rowsRev`, big sorts sliced, no per-row copies).
 *
 * Max (2026-10-02): "you could see the un-highlighted segments in the nav bar and click or drag to a new
 * one quickly, or use existing R and F controls to slowly pan up or down". (2026-10-03): "I still want to
 * build in the capability to be able to jump between the different slices of the prism … I also want to
 * somehow be able to visualize the other prisms that are around us without actually rendering the stars
 * that are inside of them."
 *
 * Every case drives the REAL host handlers (`_handleMouseDown` / `_handleMouseMove` / `_handleMouseUp` /
 * `_handleClick`) and paints through the extracted designs; the geometry under test is read back out of
 * the paint (`S.slabBarRect`, `S.yGaugeRect`) and through `slabBar.js`, the module both sides share.
 * Each case names the mutant it was proved against (see the sabotage table in the lane report).
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav, clickAt } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { FACE, drawPixelText, measurePixelText } from '../../rendering/PixelText.js';
import * as G from '../navViewModes/slabBar.js';
import { SYNC_SORT_MAX_ROWS } from '../navViewModes/state.js';
import * as navGrid from '../navGrid.js';

const W = 417, H = 240;

function inkRecordingContext() {
  const fills = [];
  const base = { fillStyle: '#000', imageSmoothingEnabled: false };
  const ctx = new Proxy(base, {
    get(t, k) {
      if (k === 'fillRect') return (x, y, w, h) => fills.push({ x, y, w, h, ink: t.fillStyle });
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
    has() { return true; },
  });
  return { ctx, fills };
}

/** Repaint this frame's S / D through a recording context. */
function paint(nav, design) {
  const { S, D } = nav._viewDriverInst;
  const lines = [], viol = [];
  const { ctx, fills } = inkRecordingContext();
  const d = makeDesigns({
    S, D, onViolation: (l) => viol.push(l), face: FACE, measurePixelText,
    drawPixelText: (g, s, x, y, o) => { lines.push({ s: String(s), x, y }); return drawPixelText(g, s, x, y, o); },
  });
  S.design = design;
  d.resetRegions(); d.resetViolations();
  if (design === 1) d.drawDesign1(ctx, W, H); else d.drawDesign2(ctx, W, H);
  return { fills, lines, viol, violations: d.violations(), regions: d.regions(), d, S, D,
           text: lines.map((l) => l.s).join('\n') };
}

async function prismNav(mode = 'rail') {
  const h = await makeHeadlessNav({ width: W, height: H });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = 3;
  h.nav.viewMode = mode;
  h.nav.render();
  return h.nav;
}

/** The texel row in the middle of slab k's bar cell, off the PUBLISHED rect. */
function rowOf(rect, k) {
  const [top, span] = G.barSpan(rect);
  const [y0, y1] = G.barRow(G.rowOfIndex(k), top, span);
  return Math.floor((y0 + y1 - 1) / 2);
}
const kOfY = (y) => G.slabIndexOfY(y);
const inSlab = (y, k) => { const [a, b] = G.slabYRange(k); return y >= a && y < b; };

function press(nav, x, y) { nav._handleMouseDown({ clientX: x + 0.5, clientY: y + 0.5, button: 0 }); }
function move(nav, x, y) { nav._handleMouseMove({ clientX: x + 0.5, clientY: y + 0.5 }); }
function release(nav, x, y) { nav._handleMouseUp({ clientX: x + 0.5, clientY: y + 0.5, button: 0 }); }

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('slabBar.js — one geometry and one layer function', () => {
  it('60 rows tile the bar exactly, N30 at the top to S30 at the bottom, and the hit-test inverts them', () => {
    // MUTANT `barRow-ceil` (round instead of floor) and `barIndexAt-off-by-one` both go red here.
    for (const span of [216, 218, 220, 222]) {
      let prevEnd = 10;
      for (let i = 0; i < G.BAR_CELLS; i++) {
        const [a, b] = G.barRow(i, 10, span);
        expect(a, `row ${i} starts where row ${i - 1} ended`).toBe(prevEnd);
        expect(b - a, `row ${i} is 3 or 4 texels`).toBeGreaterThanOrEqual(3);
        prevEnd = b;
      }
      expect(prevEnd).toBe(10 + span);
      const rect = { x: 0, y: 10 - G.BAR_INSET, w: G.BAR_W, h: span + 2 * G.BAR_INSET };
      for (let py = 10; py < 10 + span; py++) {
        const k = G.barIndexAt(rect, py);
        const [a, b] = G.barRow(G.rowOfIndex(k), 10, span);
        expect(py >= a && py < b, `texel row ${py} answers the cell drawn there`).toBe(true);
      }
    }
    expect(G.refOfIndex(G.indexOfRow(0))).toBe('N30');
    expect(G.refOfIndex(G.indexOfRow(29))).toBe('N1');
    expect(G.refOfIndex(G.indexOfRow(30))).toBe('S1');
    expect(G.refOfIndex(G.indexOfRow(59))).toBe('S30');
  });

  it('the layer is the slab\'s: N1–N3 thin, N4–N10 thick, N11+ halo, and the same south — faces included', () => {
    // MUTANT `layer-by-|y|` (prismNumbers' old `|y| < 0.3`) calls y = −0.3 THICK and goes red.
    for (let n = 1; n <= 30; n++) {
      const want = n <= 3 ? 'thin' : n <= 10 ? 'thick' : 'halo';
      expect(G.layerOfIndex(G.indexOfRef(`N${n}`)), `N${n}`).toBe(want);
      expect(G.layerOfIndex(G.indexOfRef(`S${n}`)), `S${n}`).toBe(want);
    }
    // ⚠ FLOORS ARE GALAXYGRID'S DOUBLES (k × 0.1 — N4's is 0.30000000000000004), read off `slabYRange`.
    const floor = (ref) => G.slabYRange(G.indexOfRef(ref))[0];
    expect(G.layerOfY(0)).toBe('thin');                     // N1
    expect(G.layerOfY(floor('S3'))).toBe('thin');           // S3's floor belongs to S3 — |y| = 0.3
    expect(Math.abs(floor('S3') + 0.3)).toBeLessThan(1e-12);
    expect(G.layerOfY(floor('N4'))).toBe('thick');          // N4's floor
    expect(G.layerOfY(floor('S10'))).toBe('thick');         // S10's floor, |y| = 1.0
    expect(G.layerOfY(floor('N11'))).toBe('halo');          // N11's floor
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-7 — the segment bar', () => {
  it('⭐ ONE CLICK ON EVERY CELL MOVES THE VIEW INTO THAT SLAB AND LIGHTS THAT CELL — both designs', async () => {
    // MUTANT `click-falls-through` (remove the bar branch in remapClick): no jump, every cell red.
    // MUTANT `paint-row-skew` (draw cells one row lower than barRow says): the lit-cell check goes red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await prismNav(mode);
      let p = paint(nav, design);
      const bar = p.S.slabBarRect;
      expect(bar, `design ${design}: no bar published`).toBeTruthy();
      for (let k = -30; k <= 29; k++) {
        clickAt(nav, bar.x + 2, rowOf(bar, k));
        nav.render();
        const y = nav._localCenter.y;
        expect(inSlab(y, k), `design ${design}: clicked ${G.refOfIndex(k)}, camera at y = ${y}`).toBe(true);
        expect(G.indexOfRef(nav.slab)).toBe(k);
      }
      // the lit cell is the clicked one: KEY fills in the bar column, inside that row only
      clickAt(nav, bar.x + 2, rowOf(bar, 19));     // N20, a far segment from mid-plane
      nav.render();
      p = paint(nav, design);
      const key = p.fills.filter((f) => f.ink === p.d.INK.KEY && f.x >= bar.x && f.x < bar.x + bar.w);
      expect(key.length, `design ${design}: nothing lit on the bar`).toBeGreaterThan(0);
      const [top, span] = G.barSpan(bar);
      const [a, b] = G.barRow(G.rowOfIndex(19), top, span);
      expect(key.every((f) => f.y >= a && f.y + f.h <= b), `design ${design}: the lit cell is not N20's`).toBe(true);
      expect(p.violations, `design ${design}: the mark guard fired`).toBe(0);
    }
  }, 240000);

  it('⭐ DRAGGING ALONG THE BAR STEPS SLAB BY SLAB, AND R/F STILL MOVE CONTINUOUSLY INSIDE THE SLAB', async () => {
    // MUTANT `drag-ignores-bar` (gaugeDragTo always fine): the steps are ±2 pc moves, not slabs — red.
    const nav = await prismNav('rail');
    const bar = paint(nav, 1).S.slabBarRect;
    const x = bar.x + 2;
    press(nav, x, rowOf(bar, 0));
    const seen = [];
    for (let k = 0; k <= 6; k++) {                 // N1 … N7, one cell at a time
      move(nav, x, rowOf(bar, k));
      seen.push(G.slabIndexOfY(nav._localCenter.y));
      nav.render();
    }
    release(nav, x, rowOf(bar, 6));
    nav.render();
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(nav._viewDriverInst.S.gaugeHold, 'the press is over, the hold is not').toBe(null);
    // a move inside one cell keeps the fine height (no re-centring)
    press(nav, x, rowOf(bar, 6));
    nav._localCenter.y += 0.003; const keep = nav._localCenter.y;
    const [c0] = G.barRow(G.rowOfIndex(6), ...G.barSpan(bar));
    move(nav, x, c0);                              // another texel row of the same cell
    expect(nav._localCenter.y, 'a move inside the same cell moved the view').toBe(keep);
    release(nav, x, rowOf(bar, 6)); nav.render();
    // R: continuous, small, and inside the slab
    const y0 = nav._localCenter.y;
    nav._heldKeys.add('KeyR');
    nav.render(); nav.render(); nav.render();
    nav._heldKeys.delete('KeyR');
    const dy = nav._localCenter.y - y0;
    expect(dy, 'R did not move the view up').toBeGreaterThan(0);
    expect(dy, 'R jumped instead of panning').toBeLessThan(0.001);
    expect(G.slabIndexOfY(nav._localCenter.y)).toBe(6);
  }, 120000);

  it('⛔ A DRAG THAT OUTLIVES ITS SCREEN DOES NOTHING: a Tab mid-drag withdraws the bar; V mid-drag keeps it', async () => {
    // MUTANT `bar-rect-not-cleared` (drop S.slabBarRect from resetPicks): the drag keeps stepping slabs
    // at REGION off a stale rect — red.
    const nav = await prismNav('rail');
    const bar = paint(nav, 1).S.slabBarRect;
    press(nav, bar.x + 2, rowOf(bar, 0));
    move(nav, bar.x + 2, rowOf(bar, 3));
    expect(G.slabIndexOfY(nav._localCenter.y)).toBe(3);
    // V: design 2 republishes its own bar at its own x, and the drag carries on against it
    nav.viewMode = 'bars'; nav.render();
    const bar2 = nav._viewDriverInst.S.slabBarRect;
    expect(bar2.x).not.toBe(bar.x);
    move(nav, bar2.x + 2, rowOf(bar2, 8));
    expect(G.slabIndexOfY(nav._localCenter.y)).toBe(8);
    // a level change: no bar on the glass, so the same held drag moves nothing
    nav._levelIndex = 2; nav.render();
    expect(nav._viewDriverInst.S.slabBarRect).toBe(null);
    const yHeld = nav._localCenter.y;
    nav._levelIndex = 3;                           // the host would orbit at 2; the driver must answer null
    expect(nav._viewDriverInst.gaugeDragTo(rowOf(bar2, 20))).toBe(null);
    expect(nav._localCenter.y).toBe(yHeld);
    release(nav, bar2.x + 2, rowOf(bar2, 20));
  }, 120000);

  it('⭐ DESIGN 2: BAR, GAUGE AND MINIMAP SHARE NO TEXEL AND NO CLICK — and the bar is in list mode too', async () => {
    // MUTANT `minimap-unmoved` (mx back to W − 44): the paint overlap below goes red.
    // MUTANT `gauge-skirt-wins` (test the gauge before the bar in gaugeGrab): the click partition goes red.
    for (const w of [417, 427, 360]) {
      const h = await makeHeadlessNav({ width: w, height: H });
      const nav = h.nav;
      nav._viewModesEnabled = true; nav._levelIndex = 3; nav.viewMode = 'bars'; nav.render();
      const { S, D } = nav._viewDriverInst;
      const { ctx, fills } = inkRecordingContext();
      const d = makeDesigns({ S, D, face: FACE, measurePixelText, drawPixelText });
      S.design = 2; d.resetRegions(); d.resetViolations(); d.drawDesign2(ctx, w, H);
      const bar = S.slabBarRect, gauge = S.yGaugeRect;
      // the minimap's four brackets are DIM 3x1 / 1x3 fills in the pane's bottom-right
      const mm = fills.filter((f) => f.ink === d.INK.DIM && ((f.w === 3 && f.h === 1) || (f.w === 1 && f.h === 3))
                                     && f.x > w - 80 && f.y > H - 60);
      expect(mm.length, `w=${w}: minimap brackets not found`).toBeGreaterThanOrEqual(8);
      const mmX1 = Math.max(...mm.map((f) => f.x + f.w));
      const barFills = fills.filter((f) => f.x >= bar.x - 1 && f.x < bar.x + bar.w + 1 && f.y >= bar.y && f.y < bar.y + bar.h
                                     && f.w <= bar.w);
      expect(mmX1 <= bar.x - 1, `w=${w}: the minimap (ends ${mmX1}) reaches the bar's click area (${bar.x - 1})`).toBe(true);
      expect(bar.x + bar.w <= gauge.x, `w=${w}: bar paint meets the gauge's`).toBe(true);
      expect(barFills.length).toBeGreaterThan(60);
      // every texel column from the bar's skirt to the gauge's answers exactly one widget
      const drv = nav._viewDriverInst;
      const y = Math.round(gauge.cy);
      for (let x = bar.x - 1; x < gauge.x + gauge.w + 1; x++) {
        S.gaugeHold = null;
        const took = drv.gaugeGrab(x, y) ? S.gaugeHold.widget : null;
        const onB = x >= bar.x - 1 && x < bar.x + bar.w + 1;
        expect(took, `w=${w} x=${x}`).toBe(onB ? 'bar' : 'gauge');
      }
      S.gaugeHold = null;
      expect(d.violations(), `w=${w}: the mark guard fired`).toBe(0);
      // list mode: the bar is there and clickable, the fine gauge is not
      S.list = true; nav.render();
      expect(S.slabBarRect, `w=${w}: no bar in list mode`).toBeTruthy();
      expect(S.yGaugeRect, `w=${w}: the fine gauge is map-only`).toBe(null);
      const lb = S.slabBarRect;
      clickAt(nav, lb.x + 2, rowOf(lb, -5)); nav.render();
      expect(G.slabIndexOfY(nav._localCenter.y), `w=${w}: a list-mode click did not jump`).toBe(-5);
      S.list = false;
    }
  }, 240000);

  it('⭐ DESIGN 1: THE BAR STANDS BESIDE THE GAUGE AND EVERY TEXEL BETWEEN THEM ANSWERS ONE OF THEM', async () => {
    // MUTANT `gauge-skirt-wins` goes red here too, on design 1's shared boundary.
    const nav = await prismNav('rail');
    const p = paint(nav, 1);
    const bar = p.S.slabBarRect, gauge = p.S.yGaugeRect, map = p.regions.map;
    expect(gauge.x + gauge.w).toBe(bar.x);                     // map | gauge | bar
    expect(map.x + map.w).toBe(gauge.x);
    expect(bar.h).toBe(gauge.h);
    const drv = nav._viewDriverInst;
    for (let x = gauge.x - 1; x < bar.x + bar.w + 1; x++) {
      p.S.gaugeHold = null;
      drv.gaugeGrab(x, Math.round(gauge.cy));
      expect(p.S.gaugeHold?.widget, `x=${x}`).toBe(x >= bar.x - 1 ? 'bar' : 'gauge');
    }
    p.S.gaugeHold = null;
    // and the rail names the lit cell: "N1 · THIN DISK"
    expect(p.lines.map((l) => l.s)).toContain('       N1 · THIN DISK');
    // y = −0.3 is S3's floor — the shared layer function calls it thin (the old |y| test said THICK)
    nav._localCenter.y = -0.3; nav.render();
    expect(paint(nav, 1).lines.map((l) => l.s)).toContain('       S3 · THIN DISK');
  }, 120000);

  it('⭐ LOAD STATE IS ON THE BAR AND NOWHERE ELSE: loaded solid, not-yet checkered, empty hollow', async () => {
    // MUTANT `ignore-load` (every cell solid): the checker count goes red.
    const nav = await prismNav('rail');
    const p = paint(nav, 1);
    const bar = p.S.slabBarRect;
    const L = p.D.slabLoad;
    expect(L && L.loadedSlabs instanceof Set).toBe(true);
    const [top, span] = G.barSpan(bar);
    const fillsIn = (k) => { const [a, b] = G.barRow(G.rowOfIndex(k), top, span);
      return p.fills.filter((f) => f.x > bar.x && f.x < bar.x + 5 && f.y >= a && f.y < b); };
    const unloaded = [];
    for (let k = -30; k <= 29; k++) {
      const ref = G.refOfIndex(k), fs = fillsIn(k);
      if (!L.loadedSlabs.has(ref)) { unloaded.push(ref); expect(fs.every((f) => f.w === 1 && f.h === 1), `${ref} is not checkered`).toBe(true); }
      else expect(fs.some((f) => f.w === 4), `${ref} loaded but not solid`).toBe(true);
    }
    expect(unloaded.length, 'the harness loads only the slabs on screen').toBeGreaterThan(50);
    // an EMPTY loaded slab is hollow — forge one in the status
    const fake = { ...L, loadedSlabs: new Set([...L.loadedSlabs, 'N25']), emptySlabs: new Set(['N25']) };
    p.D.slabLoad = fake;
    const { ctx, fills } = inkRecordingContext();
    p.d.resetRegions(); p.d.drawDesign1(ctx, W, H);
    const [a, b] = G.barRow(G.rowOfIndex(24), top, span);
    const hollow = fills.filter((f) => f.y >= a && f.y < b && f.x > bar.x && f.x < bar.x + 5);
    expect(hollow.length).toBe(2);
    expect(hollow.map((f) => f.x).sort()).toEqual([bar.x + 1, bar.x + 4]);
    // and there is no loading screen: the map still draws its stars this same frame
    expect(p.S.prismHits.length, 'the map drew nothing').toBeGreaterThan(0);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-7, decision 7 = A — the fine gauge follows the view', () => {
  it('⭐ AFTER A JUMP, GRABBING THE GAUGE NEVER THROWS THE VIEW BACK TO THE SHIP, AND THE SHIP IS AN EDGE ARROW', async () => {
    // MUTANT `gauge-base-is-ship` (yGauge centred on D.player.y, the old picture): the drag lands within
    // 2 pc of the SHIP, 1.5 kpc away — red.
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await prismNav(mode);
      const ship = nav._playerY;
      const bar = paint(nav, design).S.slabBarRect;
      clickAt(nav, bar.x + 2, rowOf(bar, 15)); nav.render();        // N16
      const jumped = nav._localCenter.y;
      expect(inSlab(jumped, 15)).toBe(true);
      let p = paint(nav, design);
      const g = p.S.yGaugeRect;
      expect(g.base, `design ${design}: the gauge is not centred on the view`).toBe(jumped);
      // the ship is 1.5 kpc below: an arrow (1x1 + 3x1 YOU fills) at the strip's bottom end, nowhere else
      const you = p.fills.filter((f) => f.ink === p.d.INK.YOU && f.x >= g.x && f.x < g.x + g.w);
      expect(you.length, `design ${design}: no ship mark on the strip`).toBe(2);
      expect(you.every((f) => f.y >= g.y + g.h - 3), `design ${design}: the ship arrow is not at the bottom end`).toBe(true);
      // grab the strip a quarter up and drag a little: the view moves a little, from where it is
      press(nav, g.x + 3, Math.round(g.cy - g.span / 4));
      move(nav, g.x + 3, Math.round(g.cy - g.span / 4) - 3);
      const during = nav._localCenter.y;
      release(nav, g.x + 3, Math.round(g.cy - g.span / 4) - 3);
      nav.render();
      expect(Math.abs(during - jumped), `design ${design}: the grab moved the view more than the strip's ±2 pc`)
        .toBeLessThanOrEqual(0.002 + 1e-12);
      expect(Math.abs(during - ship), `design ${design}: the grab threw the view back toward the ship`).toBeGreaterThan(1);
      expect(during).toBeGreaterThan(jumped);
      // ⛔ AND IT STANDS STILL UNDER THE HAND: a second frame of the same held pointer moves nothing
      press(nav, g.x + 3, Math.round(g.cy));
      move(nav, g.x + 3, Math.round(g.cy) - 5);
      const y1 = nav._localCenter.y; nav.render();
      move(nav, g.x + 3, Math.round(g.cy) - 5);
      expect(nav._localCenter.y, `design ${design}: the held mapping drifted`).toBe(y1);
      release(nav, g.x + 3, Math.round(g.cy) - 5); nav.render();
      // a plain CLICK on the strip is a drag of no length: the view goes to the height under it, and
      // the click is EATEN — it selects no star painted under the strip (MUTANT `gauge-click-falls-through`)
      p = paint(nav, design);
      const g2 = p.S.yGaugeRect, before = nav._localCenter.y, sel = nav._selectedNavStar;
      clickAt(nav, g2.x + 3, Math.round(g2.cy - 20)); nav.render();
      expect(nav._localCenter.y).toBeCloseTo(g2.base + ((g2.cy - Math.round(g2.cy - 20)) / g2.span) * g2.halfKpc, 6);
      expect(nav._localCenter.y).not.toBe(before);
      expect(nav._selectedNavStar, 'the click fell through to the starfield').toBe(sel);
      p = paint(nav, design);
      expect(p.violations).toBe(0);
    }
  }, 180000);

  it('⛔ AT ENTRY THE GAUGE IS THE PICTURE IT WAS: the ship\'s line at the centre and no view mark', async () => {
    // MUTANT `always-draw-view-mark`: a KEY 4x1 fill appears at entry — red.
    const nav = await prismNav('rail');
    const p = paint(nav, 1);
    const g = p.S.yGaugeRect;
    const on = p.fills.filter((f) => f.x >= g.x && f.x < g.x + g.w && f.y >= g.y && f.y < g.y + g.h);
    expect(on.filter((f) => f.ink === p.d.INK.YOU)).toEqual([{ x: g.x + 1, y: g.cy, w: 3, h: 1, ink: p.d.INK.YOU }]);
    expect(on.filter((f) => f.ink === p.d.INK.KEY)).toEqual([]);
    expect(g.base).toBe(nav._playerY);
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-7 — the neighbouring prisms, boundaries only, on the real grid', () => {
  it('⭐ EVERY EIGHTH LATTICE LINE IS A PRISM BOUNDARY OF THE FIXED GRID — not a texture counted from x = 0', async () => {
    // MUTANT `anchor-at-camera` (lattice anchored at cam.x instead of the column's corner): the
    // boundary lines miss the projected grid lines — red. MUTANT `no-major` (all lines GRID): red.
    const nav = await prismNav('rail');
    nav._seedViewModeCam();
    nav._localCenter.x += 0.0021; nav._localCenter.z -= 0.0013;        // off-centre, inside the column
    nav._localRadius = navGrid.PRISM_ZOOM_MAX_KPC; nav.render();
    const p = paint(nav, 1);
    const map = p.regions.map, P = navGrid.childKpc(2);
    const col = p.D.column.bounds;
    const proj = (wx) => p.d.projectPrism({ wx, wy: p.S.cam.y, wz: p.S.cam.z }, map.x + map.w / 2, map.y + map.h / 2, map.w / 2, map.h / 2).x;
    const latticeX = new Map();
    for (const f of p.fills) if (f.ink === p.d.INK.LATTICE && f.w === 1 && f.h === 1 && f.x < map.x + map.w && f.y >= map.y && f.y < map.y + map.h)
      latticeX.set(f.x, (latticeX.get(f.x) || 0) + 1);
    const cols = [...latticeX.entries()].filter(([, n]) => n >= map.h / 8).map(([x]) => x);
    expect(cols.length, 'no prism-boundary lines at the widest zoom').toBeGreaterThanOrEqual(3);
    const want = [];
    for (let a = -3; a <= 4; a++) { const x = proj(col.min.x + a * P); if (x >= 0 && x < map.w) want.push(x); }
    for (const x of want) expect(cols.some((c) => Math.abs(c - x) <= 1), `no boundary line at projected x ${x.toFixed(1)}`).toBe(true);
    for (const c of cols) expect(want.some((x) => Math.abs(c - x) <= 1), `a LATTICE line at ${c} is no prism boundary`).toBe(true);
    expect(p.violations).toBe(0);
  }, 120000);

  it('⭐ THE SHIP\'S COLUMN IS OUTLINED IN CURRENT INK WHEN IT IS A NEIGHBOUR, AND THE SLAB\'S FACE SHOWS NEAR IT', async () => {
    // MUTANT `no-neighbour-outline`: no YOU fills in the map — red. MUTANT `no-faces`: equal counts — red.
    const nav = await prismNav('rail');
    nav._seedViewModeCam();
    const col = navGrid.enterColumn(navGrid.parentAt(3, nav._playerX + navGrid.childKpc(2), nav._playerZ));   // the next column east
    nav._prismColumn = col;
    nav._localCenter = { x: col.bounds.min.x + 0.0005, y: 0.05, z: col.center.z };
    nav._localRadius = navGrid.PRISM_ZOOM_MAX_KPC; nav.render();
    let p = paint(nav, 1);
    const map = p.regions.map;
    const youInMap = p.fills.filter((f) => f.ink === p.d.INK.YOU && f.x < map.x + map.w && f.y >= map.y && f.y < map.y + map.h);
    expect(youInMap.length, 'the ship\'s neighbouring column is not outlined in CURRENT ink').toBeGreaterThan(20);
    const lat = (pp) => pp.fills.filter((f) => f.ink === pp.d.INK.LATTICE && f.x < map.x + map.w).length;
    const mid = lat(p);
    nav._localCenter.y = 0.0995; nav.render();                      // 0.5 pc under N1's ceiling
    p = paint(nav, 1);
    expect(lat(p), 'the slab\'s ceiling did not appear as the camera came up to it').toBeGreaterThan(mid);
    expect(p.violations).toBe(0);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-6 (designs\' half) — rows re-read only on a new revision, and no per-row copies', () => {
  it('⭐ THE PAINT\'S ROWS ARE THE LOADER\'S OWN OBJECTS AND THEY CHANGE ONLY WHEN _rowsRev DOES', async () => {
    // MUTANT `copy-rows` (the old `{...s, pc, ly}` map on loader rows): identity check red.
    // MUTANT `rebuild-every-frame` (drop the rev key): the identity across renders goes red.
    const nav = await prismNav('rail');
    const { D } = nav._viewDriverInst;
    const rows = D.starRows, rev = nav._rowsRev;
    expect(rows.length).toBeGreaterThan(10);
    const pub = new Set(nav._localStars);
    expect(rows.every((r) => pub.has(r)), 'the adapter copied the loader\'s rows').toBe(true);
    nav.render(); nav.render();
    expect(nav._rowsRev).toBe(rev);
    expect(D.starRows, 'rebuilt with no new revision').toBe(rows);
    nav._localStars = nav._localStars.slice();                         // a publish: the setter bumps the revision
    nav.render();
    expect(nav._rowsRev).toBe(rev + 1);
    expect(D.starRows, 'a new revision was not picked up').not.toBe(rows);
  }, 60000);

  it('⭐ THE PER-FRAME IDENTITY SCANS ARE MEMOISED, AND THE MEMO STILL HEARS THE ARRIVAL IDENTITY CHANGE', async () => {
    // MUTANT `here-memo-stale` (drop `hereKey` from the memo): `D.here` stays on the first star — red.
    // MUTANT `sel-memo-stale` (drop the selection from the memo): the new selection is not found — red.
    const nav = await prismNav('rail');
    const P = { x: nav._playerX, y: nav._playerY, z: nav._playerZ };
    const row = (key, dx) => ({ wx: P.x + dx, wy: P.y, wz: P.z, name: key, spectral: 'G', seed: 1, key, ident: null,
                                dist: Math.abs(dx), distPc: '0', mult: 1, slab: 'N1' });
    const a = row('p:here-a', 0.00002), b = row('p:here-b', -0.00002);
    nav._localStars = [a, b, ...nav._localStars];
    nav._hereStarId = { key: a.key, wx: P.x, wy: P.y, wz: P.z };
    nav.render();
    const { D } = nav._viewDriverInst;
    expect(D.hereColumn).toBe(true);
    expect(D.here).toBe(a);
    const rows = D.starRows;
    nav._hereStarId = { key: b.key, wx: P.x, wy: P.y, wz: P.z };
    nav.render();
    expect(D.starRows, 'the rows were rebuilt — the case would not reach the memo').toBe(rows);
    expect(D.here, 'the arrival identity changed and "here" did not').toBe(b);
    nav._selectedNavStar = a; nav.render();
    expect(D.selStar).toBe(a);
    nav._selectedNavStar = { ...b }; nav.render();
    expect(D.selStar, 'a new selection was answered from the old one').toBe(b);
  }, 60000);

  it('⛔ THE CHEAP REJECT NEVER DROPS A MARK THE REAL CULL KEEPS — any camera, both designs', async () => {
    // MUTANT `cull-margin-negative` (prismCull's 4-texel margin → −6): marks near the edge vanish — red.
    const nav = await prismNav('rail');
    nav._seedViewModeCam();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      nav.viewMode = mode;
      for (const cam of [{ r: 0.0015 }, { r: navGrid.PRISM_ZOOM_MAX_KPC }, { r: 0.006, rotX: 0.2, rotY: 1.1 },
                         { r: 0.004, rotX: Math.PI / 2, rotY: 2.5 }, { r: 0.01, rotX: 1.2, rotY: -0.7, dy: 0.0012 }]) {
        nav._localRadius = cam.r;
        if (cam.rotX !== undefined) { nav._localRotX = cam.rotX; nav._localRotY = cam.rotY; } else nav._seedViewModeCam();
        nav._localCenter.y = nav._playerY + (cam.dy || 0);
        nav.render();
        const p = paint(nav, design);
        const map = p.regions.map;
        const [cx, cy, hw, hh] = [map.x + map.w / 2, map.y + map.h / 2, map.w / 2, map.h / 2];
        const ref = [];
        const cap = design === 1 ? 240 : Math.max(200, Math.round(W * map.h / 160));
        for (const s of p.D.starRows) {
          const q = p.d.projectPrism(s, cx, cy, hw, hh);
          const ok = design === 1 ? !(q.x < 0 || q.x >= map.w || q.y < map.y || q.y >= map.y + map.h)
                                  : !(q.x < -2 || q.x > W + 2 || q.y < map.y - 2 || q.y > map.y + map.h + 2);
          if (ok) { ref.push(s); if (ref.length >= cap) break; }
        }
        const got = new Set(p.S.prismHits.map((m) => m.ref));
        expect(got.size, `design ${design} ${JSON.stringify(cam)}: different mark count`).toBe(ref.length);
        expect(ref.every((s) => got.has(s)), `design ${design} ${JSON.stringify(cam)}: a mark was dropped`).toBe(true);
      }
    }
  }, 120000);

  it('⭐ A BIG COLUMN IS NOT SORTED INSIDE THE FRAME — its order arrives from the sliced sort', async () => {
    // MUTANT `sync-sort-everything` (SYNC_SORT_MAX_ROWS = Infinity): the first frame is already sorted — red.
    const nav = await prismNav('rail');
    const n = SYNC_SORT_MAX_ROWS + 904;
    const fake = [];
    for (let i = 0; i < n; i++) {
      const d = ((i * 7919) % n) / n * 0.05;                           // a scrambled distance order
      fake.push({ wx: 8, wy: 0, wz: 0, name: `R${i}`, spectral: 'M', seed: i, key: `p:fake:${i}`, ident: null,
                  dist: d, distPc: (d * 1000).toFixed(0), mult: 1, slab: 'N1' });
    }
    nav._localStars = fake;
    nav.render();
    const { D } = nav._viewDriverInst;
    const sorted = (a) => a.every((r, i) => i === 0 || a[i - 1].dist <= r.dist);
    expect(D.starRows.length).toBe(n);
    expect(sorted(D.starRows), 'a column over the sync limit was sorted in the frame').toBe(false);
    (await import('../prismLoader.js')).prismLoadScheduler.drain();
    nav.render();
    expect(D.starRows.length).toBe(n);
    expect(sorted(D.starRows), 'the sliced sort never arrived').toBe(true);
    // and the printed distance is derived from `dist` (no `pc` on loader rows)
    nav.viewMode = 'bars'; nav._viewDriverInst.S.list = true; nav.render();
    const p = paint(nav, 2);
    expect(p.text).toContain((D.starRows[0].dist * 1000).toFixed(2));
  }, 120000);
});
