/**
 * navGridPolish.design.test.js — naming-prism-segments batch 2, AC-16 (grid polish) and AC-18(d) (legends).
 *
 * Spec, Max's own words (docs/WORKSTREAMS/naming-prism-segments-2026-10-02/UAT-review-2026-10-03.md):
 *  · g-galaxy — *"little horizontal midline level dots extending from each number and letter to the nearest
 *    side to the right or the bottom respectively. And it will be okay if those are crossing over in the
 *    upper left portion of the negative space surrounding the grid."*
 *  · g-sector — *"make sure the pop-up label does not obscure the cell that is highlighted … always displays
 *    on the grid but never on the cell that is highlighted … make the highlight color and the font color of
 *    the pop-up label where the parenthetical numeric values are the same font color"*; *"What are the
 *    squares next to each of the distances in the table"*; *"looking square or looking like a screen door."*
 *  · g-drag — *"We only want to show the grid, and we want that to be aligned perfectly with the side of the
 *    visual window"*.  · g-neighbours — *"only allow you to see the galaxy through the matrix like it's a
 *    window … when you drag the view, then the boundaries of one cell and the other should be obvious …
 *    The row and column labels will follow you."*
 *
 * Each case names the sabotage that was RUN (made, watched red, reverted) in its header.
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { dequantRGBA } from '../navViewModes/lumDequant.js';
import * as navGrid from '../navGrid.js';
import { FACE, drawPixelText, measurePixelText } from '../../rendering/PixelText.js';

const W = 417, H = 240;
const RULE = '#1d3a4a', BG = '#04070c', KEY = '#d8fbff', BODY = '#7fd8e8';
const CURRENT = '#2ee6c0';
/** Is `r` the player's own cell — the CURRENT frame's TOP edge AND its LEFT edge on this rectangle? (Top alone also
 *  matches the cell under it: the frame is `w + 1, h + 1`, so its bottom edge is the next row's top.) */
const isOwnCell = (fills, r) => fills.some((f) => f.ink === CURRENT && f.x === r.x && f.y === r.y && f.h === 1 && f.w >= r.w)
  && fills.some((f) => f.ink === CURRENT && f.x === r.x && f.y === r.y + 1 && f.w === 1 && f.h >= r.h - 1);
/** The ink the LAST fill covering texel (x, y) left there — what the glass shows. */
const lastInkAt = (fills, x, y) => { let ink = null; for (const f of fills) if (x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) ink = f.ink; return ink; };

function recorder() {
  const fills = [], images = [];
  const base = { fillStyle: '#000', imageSmoothingEnabled: false };
  const ctx = new Proxy(base, {
    get(t, k) {
      if (k === 'fillRect') return (x, y, w, h) => fills.push({ x, y, w, h, ink: t.fillStyle });
      if (k === 'drawImage') return (...a) => images.push(a.length >= 9 ? { x: a[5], y: a[6], w: a[7], h: a[8], src: a[0] } : { x: a[1], y: a[2], w: a[3], h: a[4], src: a[0] });
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
    has() { return true; },
  });
  return { ctx, fills, images };
}

/** ⚠ A STAND-IN DENSITY IMAGE. Headless, the CPU renderer answers `null` on its first frame and the designs
 *  lay their "COMPUTING DENSITY" placeholder — a RULE checker across the whole window, which would read as
 *  leader dots and lattice to every case below. The game's GPU path is synchronous; this is that path. */
const FAKE_IMG = { width: 512, height: 512 };
function paint(nav, design, w = W, img = FAKE_IMG) {
  const { S, D } = nav._viewDriverInst;
  D.nav = { render: () => img };
  const lines = [];
  const { ctx, fills, images } = recorder();
  const d = makeDesigns({
    S, D, onViolation: null, face: FACE, measurePixelText,
    drawPixelText: (g, s, x, y, opts) => { lines.push({ s: String(s), x, y, color: opts?.color });
                                           return drawPixelText(g, s, x, y, opts); },
  });
  S.design = design;
  d.resetRegions(); d.resetViolations();
  if (design === 1) d.drawDesign1(ctx, w, H); else d.drawDesign2(ctx, w, H);
  return { fills, images, lines, S, D, regions: d.regions(), violations: d.violations(), INK: d.INK,
           clip: S.mapProj && S.mapProj.clip ? { ...S.mapProj.clip } : null, cells: (S.mapCells || []).slice() };
}

let H_;
async function at2D(mode, level) {
  if (!H_) {
    H_ = await makeHeadlessNav({ width: W, height: H });
    H_.nav._viewModesEnabled = true; H_.nav._levelIndex = 3; H_.nav.viewMode = 'rail'; H_.nav.render();
  }
  const nav = H_.nav;
  nav.viewMode = mode; nav._viewEase = null; nav._anim = null;
  nav._externalTarget = null; nav._selectedNavStar = null;
  nav._viewDriverInst.S.locate = null; nav._viewDriverInst.S.hover = null;
  nav._mouseX = -99; nav._mouseY = -99;
  nav._setupViewStackForPlayer();
  nav._levelIndex = level; nav._applyLevelView();
  nav.render();
  return nav;
}
const CASES = [['rail', 1], ['bars', 2]].flatMap(([m, d]) => [0, 1, 2].map((l) => [m, d, l]));

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-16 — dotted midline leaders from every edge label to the grid (g-galaxy)', () => {
  for (const [mode, design, level] of CASES) {
    it(`design ${design} L${level}: every row number and every column letter has dots to its nearest live cell`, async () => {
      // ⛔ SABOTAGE RUN: `gridEdgeLabels` without `dotsH` → every row case red; without `dotsV` → every
      //    column case red.
      const p = paint(await at2D(mode, level), design);
      const ax = navGrid.axisLabels(level), cl = p.clip;
      const dots = p.fills.filter((f) => f.ink === RULE && f.w === 1 && f.h === 1);
      const rows = p.lines.filter((l) => ax.rows.includes(l.s) && l.x + measurePixelText(l.s) < cl.x);
      const cols = p.lines.filter((l) => ax.cols.includes(l.s) && l.y + FACE.h <= cl.y);
      expect(rows.length, 'every row is labelled').toBe(ax.rows.length);
      expect(cols.length, 'every column is labelled').toBe(ax.cols.length);
      for (const l of rows) {
        const my = l.y + (FACE.h >> 1), x0 = l.x + measurePixelText(l.s);
        const run = dots.filter((f) => f.y === my && f.x > x0);
        expect(run.length, `row ${l.s} has no leader`).toBeGreaterThan(0);
        // ⭐ AND IT REACHES THE ROW'S FIRST LIVE CELL (at GALAXY, across the blank corner)
        const live = p.cells.filter((c) => c.rect.y <= my && my < c.rect.y + c.rect.h).map((c) => c.rect.x);
        expect(Math.max(...run.map((f) => f.x)), `row ${l.s}'s leader stops short of its first cell`).toBeGreaterThanOrEqual(Math.min(...live) - 2);
      }
      for (const l of cols) {
        const run = dots.filter((f) => f.y > l.y + FACE.h && Math.abs(f.x - (l.x + (measurePixelText(l.s) >> 1))) <= 1);
        expect(run.length, `column ${l.s} has no leader`).toBeGreaterThan(0);
      }
    }, 60000);
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-16 — the hover label is on the grid and never over the highlighted cell (g-sector)', () => {
  for (const [mode, design, level] of CASES) {
    it(`design ${design} L${level}: corners, edges and the middle — plate ∩ cell = 0, plate inside the window, numbers in the highlight's ink`, async () => {
      // ⛔ SABOTAGE RUN: `cellCalloutBox` leaving the hovered cell out of `avoid` → red (the plate lands on
      //    it); `CALLOUT_CELL_INK` set to BODY → red (the numbers are not the highlight's ink).
      const nav = await at2D(mode, level);
      const S = nav._viewDriverInst.S;
      const base = paint(nav, design);
      const n = navGrid.childCount(level), cl = base.clip;
      const probe = base.cells.filter((c) => {
        const cc = navGrid.childCell(level, c.address);
        return [0, 1, n >> 1, n - 2, n - 1].includes(cc.i) && [0, 1, n >> 1, n - 2, n - 1].includes(cc.j);
      });
      expect(probe.length, 'fixture: no probe cells').toBeGreaterThan(8);
      // the player's own cell is always probed too (the fixup's case: hover over the CURRENT outline)
      const ownCell = base.cells.find((c) => isOwnCell(base.fills, c.rect));
      if (ownCell && !probe.includes(ownCell)) probe.push(ownCell);
      let sawOwn = false;
      for (const c of probe) {
        const r = c.rect;
        S.hover = { level, kind: 'cell', sx: r.x + (r.w >> 1), sy: r.y + (r.h >> 1), ref: navGrid.hoverTile(level, c.address) };
        const p = paint(nav, design);
        const b = S.hoverCalloutRect;
        expect(b, `${c.ref}: no callout`).toBeTruthy();
        const overlap = b.x <= r.x + r.w && b.x + b.w - 1 >= r.x && b.y <= r.y + r.h && b.y + b.h - 1 >= r.y;
        expect(overlap, `${c.ref}: the label covers its cell`).toBe(false);
        expect(b.x >= cl.x && b.y >= cl.y && b.x + b.w <= cl.x + cl.w && b.y + b.h <= cl.y + cl.h,
          `${c.ref}: the label is not on the grid`).toBe(true);
        // ⭐ batch 2 fixup — ON THE PLAYER'S OWN CELL the KEY frame steps one texel inside, so the CURRENT outline
        //    is still the ink on the cell's edge (it was the same rectangle, and the hover painted over it).
        const own = isOwnCell(p.fills, r);
        const k = own ? 1 : 0;
        expect(p.fills.some((f) => f.ink === KEY && f.x === r.x + k && f.y === r.y + k && f.w >= r.w - 2 * k && f.h === 1),
          `${c.ref}: the hovered cell is not highlighted`).toBe(true);
        if (own) {
          // ⛔ SABOTAGE RUN: `keyFrame` without the inset → the last ink on the CURRENT cell's top edge is KEY, red.
          sawOwn = true;
          expect(lastInkAt(p.fills, r.x + (r.w >> 1), r.y), `${c.ref}: hovering your own cell hid its CURRENT outline`).toBe(CURRENT);
        }
        const nums = p.lines.find((l) => l.s.startsWith('('));
        expect(nums && nums.color, `${c.ref}: the parenthetical numbers are not the highlight's ink`).toBe(KEY);
      }
      S.hover = null;
      if (ownCell) expect(sawOwn, 'fixture: the player\'s own cell was not probed').toBe(true);
    }, 120000);
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-16 — the window is the grid: nothing outside it, no screen door, and a drag shows the next block (g-drag, g-neighbours)', () => {
  /** Every non-BG mark in the map pane is in the window, the label gutter left of it, the letter row above
   *  it, or (design 2) the legend rows under it — and the density image is blitted only into the window. */
  function outside(p) {
    const m = p.regions.map, cl = p.clip;
    const inside = (f) => f.x >= cl.x && f.x + f.w <= cl.x + cl.w && f.y >= cl.y && f.y + f.h <= cl.y + cl.h;
    const gutter = (f) => f.x + f.w <= cl.x && f.y >= m.y;
    const letters = (f) => f.y + f.h <= cl.y && f.x >= cl.x - 1 && f.x + f.w <= cl.x + cl.w + 1;
    const legend = (f) => f.y >= cl.y + cl.h;
    return p.fills.filter((f) => f.ink !== BG && f.x >= m.x && f.x < m.x + m.w && f.y >= m.y && f.y < m.y + m.h
      && !(f.w >= m.w && f.h >= m.h) && !inside(f) && !gutter(f) && !letters(f) && !legend(f));
  }
  for (const [mode, design, level] of CASES) {
    it(`design ${design} L${level}: at rest and mid-drag, nothing outside the window and no checker in the background`, async () => {
      // ⛔ SABOTAGE RUN: design 2's clip back to the full width → red (the image and the cells spill past
      //    the square); `dimRect` back to `checker` → red at GALAXY (1x1 BG fills in the corners).
      const nav = await at2D(mode, level);
      for (const [label, dx] of [['rest', 0], ['mid-drag', 0.4]]) {
        if (dx) { nav._viewCenter = { x: nav._viewCenter.x + nav._viewSize * dx, z: nav._viewCenter.z - nav._viewSize * 0.15 }; nav.render(); }
        const p = paint(nav, design);
        expect(p.clip.w, `${label}: the window is the square`).toBe(p.clip.h);
        expect(outside(p).slice(0, 5), `${label}: marks outside the window`).toEqual([]);
        for (const im of p.images) {
          expect(im.x >= p.clip.x && im.y >= p.clip.y && im.x + im.w <= p.clip.x + p.clip.w && im.y + im.h <= p.clip.y + p.clip.h,
            `${label}: the density image is blitted outside the window`).toBe(true);
        }
        const door = p.fills.filter((f) => f.ink === BG && f.w === 1 && f.h === 1 && f.y >= p.clip.y && f.y < p.clip.y + p.clip.h);
        expect(door.length, `${label}: a checker (screen door) is laid in the window`).toBe(0);
      }
    }, 60000);
  }

  for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
    for (const level of [1, 2]) {
      it(`design ${design} L${level}: mid-drag the next block is grid, the parent's edge is drawn, and the labels follow`, async () => {
        // ⛔ SABOTAGE RUN: `gridNeighbours` not drawing the neighbour's lattice → red; `parentEdge` not
        //    called → red; neighbours left out of `gridEdgeLabels` → red (no letter past the edge).
        const nav = await at2D(mode, level);
        nav._viewCenter = { x: nav._viewCenter.x + nav._viewSize * 0.4, z: nav._viewCenter.z };
        nav.render();
        const p = paint(nav, design);
        const own = p.cells, cl = p.clip;
        const edgeX = Math.max(...own.map((c) => c.rect.x + c.rect.w));
        expect(edgeX, 'fixture: the parent\'s east edge is not inside the window').toBeLessThan(cl.x + cl.w - 4);
        expect(p.fills.some((f) => f.ink === BODY && f.x === edgeX && f.w === 1 && f.h > 20), 'the parent\'s edge is not drawn').toBe(true);
        const nbLattice = p.fills.filter((f) => f.ink === RULE && f.w === 1 && f.h === 1 && f.x > edgeX + 2 && f.y > cl.y && f.y < cl.y + cl.h);
        expect(nbLattice.length, 'the neighbour block is not drawn as grid').toBeGreaterThan(20);
        const nbLetters = p.lines.filter((l) => l.y < cl.y && l.x > edgeX && l.color === RULE);
        expect(nbLetters.map((l) => l.s).slice(0, 2), 'the neighbour\'s columns are not labelled (A, B …)').toEqual(['A', 'B']);
        expect(p.lines.some((l) => /^[A-S]\d{1,2}( [A-P]\d{1,2})?$/.test(l.s) && l.y >= cl.y && l.y < cl.y + cl.h && l.x >= cl.x && l.x < cl.x + cl.w),
          'a block label is still drawn in the picture').toBe(false);
      }, 60000);
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-16 — the rail\'s count-and-squares column is labelled', () => {
  for (const level of [0, 1, 2]) {
    it(`design 1 L${level}: "EST SYSTEMS" heads the column, over the numbers and the squares`, async () => {
      // ⛔ SABOTAGE RUN: the `colHdr` draw removed → red.
      const p = paint(await at2D('rail', level), 1);
      const rail = p.regions.rail;
      const hdr = p.lines.find((l) => l.s === 'EST SYSTEMS');
      expect(hdr, 'no column header').toBeTruthy();
      expect(hdr.y).toBe(rail.y);
      expect(hdr.x + measurePixelText(hdr.s), 'the header is not right-aligned over the squares').toBe(rail.x + rail.w);
      const bars = p.fills.filter((f) => f.w === 4 && f.h === 4 && f.x >= rail.x);
      expect(bars.length, 'fixture: no density squares').toBeGreaterThan(0);
      expect(Math.min(...bars.map((f) => f.x)), 'the squares are not under the header').toBeGreaterThanOrEqual(hdr.x);
    }, 60000);
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-16 — the density image\'s screen door: the Bayer dither averaged out (lumDequant)', () => {
  /** The renderer's own quantiser: 12 levels through a 4x4 Bayer matrix laid on 2x2-pixel cells. */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
  function dithered(Wd, Hd, f) {
    const d = new Uint8ClampedArray(Wd * Hd * 4);
    for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
      const b = f(x, y), th = BAYER[((x >> 1) & 3) + ((y >> 1) & 3) * 4];
      const v = Math.floor(b * 12 + th) / 12 * 255;
      d.set([v, v, v, 255], (y * Wd + x) * 4);
    }
    return d;
  }
  it('⭐ a flat field comes back flat: the lattice cancels (period 8), it is not merely blurred', () => {
    // ⛔ SABOTAGE RUN: `DEQUANT_RADIUS` 3 (a 6-pixel window, not one period) → the residual lattice keeps a
    //    spread of several levels, red.
    const Wd = 64, Hd = 64, b = 0.4372;
    const out = dequantRGBA(dithered(Wd, Hd, () => b), Wd, Hd);
    const inSrc = dithered(Wd, Hd, () => b);
    // ⭐ batch 2 fixup (Astra 10) — THE WHOLE IMAGE, BORDER INCLUDED: the window slides inward at an edge, so the
    //    4-pixel border cancels like the interior. ⛔ SABOTAGE RUN: the edge window clamped (repeating the edge
    //    pixel) instead of slid → the border keeps a 106-116 spread, red.
    const vals = (a) => { const v = []; for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) v.push(a[(y * Wd + x) * 4]); return v; };
    const spread = (v) => Math.max(...v) - Math.min(...v);
    expect(spread(vals(inSrc)), 'fixture: the input must carry the dither').toBeGreaterThan(15);
    expect(spread(vals(out)), 'the dither survived the filter').toBeLessThanOrEqual(1);
    expect(Math.abs(vals(out)[0] - b * 255), 'the mean is not the encoded brightness').toBeLessThan(255 / 12 / 2);
  });
  it('a ramp stays a ramp (the filter is a mean, not a flattening)', () => {
    const Wd = 64, Hd = 16;
    const out = dequantRGBA(dithered(Wd, Hd, (x) => x / Wd), Wd, Hd);
    const row = []; for (let x = 8; x < Wd - 8; x++) row.push(out[(8 * Wd + x) * 4]);
    for (let i = 1; i < row.length; i++) expect(row[i], `x ${i + 8}`).toBeGreaterThanOrEqual(row[i - 1] - 1);
    expect(row[row.length - 1] - row[0]).toBeGreaterThan(150);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-16 — the image the grid screens BLIT is the dequantised one (the real draw path, Astra 12)', () => {
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
  const Wd = 64, Hd = 64, b = 0.4372;
  const raw = new Uint8ClampedArray(Wd * Hd * 4);
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
    const v = Math.floor(b * 12 + BAYER[((x >> 1) & 3) + ((y >> 1) & 3) * 4]) / 12 * 255;
    raw.set([v, v, v, 255], (y * Wd + x) * 4);
  }
  it('both designs, SECTOR: the blitted source is the 8x8-averaged copy, flat across a flat dithered field', async () => {
    // ⛔ SABOTAGE RUN: `lumImage` returning `D.nav.render(...)` without `dequantLum` → the raw dithered image is
    //    what gets blitted, red. (The fake image used everywhere else has no `getContext`, so `dequantLum`
    //    returned it untouched and this path was never run by a test.)
    const made = [];
    class FakeImageData { constructor(data, w, h) { this.data = data; this.width = w; this.height = h; } }
    const fakeCanvas = () => { const cv = { width: 0, height: 0, put: null,
      getContext: () => ({ putImageData: (id) => { cv.put = id; } }) }; made.push(cv); return cv; };
    const src = { width: Wd, height: Hd, getContext: () => ({ getImageData: () => ({ data: raw }) }) };
    const saved = { document: globalThis.document, ImageData: globalThis.ImageData };
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at2D(mode, 1);
      globalThis.document = { createElement: () => fakeCanvas() }; globalThis.ImageData = FakeImageData;
      let p;
      try { p = paint(nav, design, W, src); }
      finally { globalThis.document = saved.document; globalThis.ImageData = saved.ImageData; }
      const blits = p.images.filter((i) => i.src);
      expect(blits.length, `D${design}: fixture — nothing was blitted`).toBeGreaterThan(0);
      expect(blits.some((i) => i.src === src), `D${design}: the raw dithered image was blitted`).toBe(false);
      const dq = blits.find((i) => made.includes(i.src));
      expect(dq && dq.src.put, `D${design}: no dequantised image was blitted`).toBeTruthy();
      const d = dq.src.put.data; let mn = 255, mx = 0;
      for (let i = 0; i < d.length; i += 4) { mn = Math.min(mn, d[i]); mx = Math.max(mx, d[i]); }
      expect(mx - mn, `D${design}: the blitted image still carries the dither`).toBeLessThanOrEqual(1);
    }
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-18(d) — a legend loses whole clauses, never the end of a word, and stops short of the widgets', () => {
  const ALLOWED = [
    ['V LOOK', 'SHIFT+TAB BACK', 'ESC CLOSE'], ['SELECT A BODY', 'DRAG ROTATE', 'ENTER'], ['L=LIST', 'WASD PAN', 'R/F UP/DOWN'],
  ];
  const isJoin = (s) => ALLOWED.some((cl) => {
    const subsets = [];
    for (let m = 1; m < 1 << cl.length; m++) subsets.push(cl.filter((_, i) => m & (1 << i)).join('  '));
    return subsets.includes(s);
  });
  for (const w of [417, 390, 340, 300]) {
    it(`at ${w} wide, both designs, every level: each legend is whole clauses and the way out (ESC CLOSE) is never cut`, async () => {
      // ⛔ SABOTAGE RUN: design 1's tab legend back to `fit(legend, …)` → at 390 it reads `… ESC C`, red.
      for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
        for (const level of [0, 1, 2, 3]) {
          const p = paint(await at2D(mode, level), design, w);
          const legends = p.lines.filter((l) => /LOOK|SHIFT\+TAB|ESC C|DRAG ROTATE|WASD|L=LIST/.test(l.s));
          expect(legends.length, `D${design} L${level} @${w}: no legend drawn`).toBeGreaterThan(0);
          for (const l of legends) {
            expect(isJoin(l.s), `D${design} L${level} @${w}: "${l.s}" is not whole clauses`).toBe(true);
          }
          const g = legends.find((l) => /ESC|SHIFT|LOOK/.test(l.s));
          expect(g.s.endsWith('ESC CLOSE'), `D${design} L${level} @${w}: the way out lost its name: "${g.s}"`).toBe(true);
          if (design === 2 && level === 3) {
            for (const l of legends) expect(l.x + measurePixelText(l.s), `@${w}: a legend runs under the minimap`).toBeLessThanOrEqual(w - 55);
          }
        }
      }
    }, 120000);
  }
});
