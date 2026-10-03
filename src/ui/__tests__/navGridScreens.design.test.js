/**
 * navGridScreens.design.test.js — naming-prism-segments Phase 2, AC-3, the DESIGNS' half.
 *
 * Max (2026-10-02): *"each cell in the galaxy should represent a single sector … Every cell in the sector
 * view should be displaying a single region. Every cell in the region view should be displaying a single
 * prism."* Plus: cells world-locked under a drag, edge labels on every grid (letters across, numbers
 * down), neighbouring parents dimmed and labelled — in designs 1 and 2.
 *
 * Every case reads what the PAINT published (`S.mapProj`, `S.mapCells`) or drew (the text the design
 * handed its glyph painter), and holds it against `GalaxyGrid.boundsOf` / `navGrid` — never against a
 * restatement of the layout.
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { worldAt } from '../navViewModes/picking.js';
import * as navGrid from '../navGrid.js';
import { boundsOf, addressOf } from '../../generation/GalaxyGrid.js';
import { FACE, measurePixelText } from '../../rendering/PixelText.js';

const W = 417, H = 240;

/** A design nav framed on the player's own parent at `level`, exactly as navGrid frames it. */
async function framed(mode, level) {
  const h = await makeHeadlessNav({ width: W, height: H });
  const nav = h.nav;
  nav._viewModesEnabled = true; nav.viewMode = mode;
  nav._levelIndex = 3; nav.render();                       // the prism loader, as every suite does
  nav._levelIndex = level;
  const a = addressOf(nav._playerX, 0, nav._playerZ), v = navGrid.viewForAddress(level, a);
  nav._viewCenter = { x: v.cx, z: v.cz }; nav._viewSize = v.size;
  // the host's view stack records the ADDRESS it framed (the HOST lane's half); a pan never moves it
  if (level > 0) nav._viewStack[level] = { center: { x: v.cx, z: v.cz }, size: v.size, address: navGrid.parentOf(level, a) };
  nav.render();
  return { nav, drv: nav._viewDriverInst };
}

/** Paint the live S/D once more through a glyph painter that records every string and where. */
function textOf(drv, design) {
  const text = [];
  const g = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? { width: W, height: H } : () => {}), set: () => true });
  const d = makeDesigns({ S: drv.S, D: drv.D, drawPixelText: (_g, s, x, y) => { text.push({ s: String(s), x, y }); } });
  d.resetRegions();
  (design === 1 ? d.drawDesign1 : d.drawDesign2)(g, W, H);
  return text;
}

const centreOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

describe('AC-3 — one drawn cell is exactly one child box', () => {
  for (const mode of ['rail', 'bars']) {
    for (const level of [0, 1, 2]) {
      it(`${mode} L${level}: every drawn cell's bounds are its child's, and its rectangle maps back to it`, async () => {
        const { drv } = await framed(mode, level);
        const p = drv.S.mapProj, cells = drv.S.mapCells;
        expect(p.kind).toBe('grid');
        expect(cells.length, 'GALAXY draws the 293 sectors that touch R <= 18; below, 16 x 16')
          .toBe(level === 0 ? 293 : 256);
        const n = navGrid.childCount(level);
        expect(p.n).toBe(n);
        const parent = level === 0 ? null : navGrid.parentOf(level, addressOf(8, 0, 0));
        expect(navGrid.sameAddress(p.parent, parent)).toBe(true);
        const seen = new Set();
        for (const c of cells) {
          expect(c.bounds, `${c.ref}`).toEqual(boundsOf(c.address));
          expect(navGrid.sameAddress(navGrid.parentOf(level, c.address), parent), `${c.ref} belongs to this screen`).toBe(true);
          const m = centreOf(c.rect), w = worldAt(p, m.x, m.y);
          expect(navGrid.sameAddress(navGrid.cellAt(level, parent, w.wx, w.wz), c.address), `${c.ref}'s rectangle is another cell`).toBe(true);
          seen.add(c.ref);
        }
        expect(seen.size, 'two drawn cells named one child').toBe(cells.length);
        // integer cells at rest: every cell the same size on the glass
        const ws = new Set(cells.map((c) => c.rect.w)), hs = new Set(cells.map((c) => c.rect.h));
        expect([...ws], 'cells are not one size across').toHaveLength(1);
        expect([...hs]).toEqual([...ws]);
      }, 60000);
    }
  }
});

describe('AC-3 — the cells are world-locked: a drag slides them, it never re-cuts them', () => {
  for (const mode of ['rail', 'bars']) {
    for (const level of [1, 2]) {
      it(`${mode} L${level}: after a pan the same world point is under the same cell`, async () => {
        const { nav, drv } = await framed(mode, level);
        const before = new Map(drv.S.mapCells.map((c) => [c.ref, c.rect]));
        const p0 = drv.S.mapProj;
        const probe = before.get(level === 1 ? 'F7' : 'K12');
        const pt = centreOf(probe), w0 = worldAt(p0, pt.x, pt.y);
        // an awkward pan: a third of a cell right, a fifth down — through the host's own drag
        const k = drv.panKpcPerTexel(), cell = navGrid.childKpc(level);
        const cl = p0.clip, sx = cl.x + cl.w / 2, sy = cl.y + cl.h / 2;
        const dx = Math.round(cell / 3 / k) + 7, dy = Math.round(cell / 5 / k) + 3;
        nav._handleMouseDown({ clientX: sx, clientY: sy, button: 0 });
        nav._handleMouseMove({ clientX: sx + dx, clientY: sy + dy });
        nav._handleMouseUp();
        nav.render();
        const p1 = drv.S.mapProj;
        expect(p1.cx, 'the pan did not move the frame').not.toBe(p0.cx);
        expect(navGrid.sameAddress(p1.parent, p0.parent), 'a pan changed which parent the screen is about').toBe(true);
        // the picture moved WITH the pointer in both axes (+z up on the glass)
        const after = new Map(drv.S.mapCells.map((c) => [c.ref, c.rect]));
        const moved = after.get(level === 1 ? 'F7' : 'K12');
        expect(moved.x - probe.x, 'the cell did not follow the pointer across').toBe(dx);
        expect(moved.y - probe.y, 'the cell did not follow the pointer down').toBe(dy);
        // …and the world point that was under the probe is still in the same named cell
        const w = worldAt(p1, pt.x + dx, pt.y + dy);
        expect(w.wx).toBeCloseTo(w0.wx, 9); expect(w.wz).toBeCloseTo(w0.wz, 9);
        const c = navGrid.cellAt(level, p1.parent, w.wx, w.wz);
        expect(navGrid.childRef(level, c)).toBe(level === 1 ? 'F7' : 'K12');
      }, 60000);
    }
  }
});

describe('AC-3 — every grid can be read: letters across the top, numbers down the side', () => {
  for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
    for (const level of [0, 1, 2]) {
      it(`design ${design} L${level}: every column and every row carries its own label, on its own cell`, async () => {
        const { drv } = await framed(mode, level);
        const text = textOf(drv, design);
        const p = drv.S.mapProj, cells = navGrid.childGrid(level, p.parent), n = navGrid.childCount(level);
        const lab = navGrid.axisLabels(level);
        const proj = (b) => ({
          x0: p.x0 + ((b.min.x - p.cx) / p.size + 0.5) * p.sq, x1: p.x0 + ((b.max.x - p.cx) / p.size + 0.5) * p.sq,
          y0: p.y0 + (0.5 - (b.max.z - p.cz) / p.size) * p.sq, y1: p.y0 + (0.5 - (b.min.z - p.cz) / p.size) * p.sq,
        });
        for (let i = 0; i < n; i++) {
          const r = proj(cells[i].bounds);
          const hit = text.find((t) => t.s === lab.cols[i] && t.y < p.y0
            && t.x + measurePixelText(t.s) / 2 >= r.x0 && t.x + measurePixelText(t.s) / 2 < r.x1);
          expect(hit, `column ${lab.cols[i]} has no label above it`).toBeTruthy();
        }
        for (let j = 0; j < n; j++) {
          const r = proj(cells[j * n].bounds);
          const hit = text.find((t) => t.s === lab.rows[j] && t.x + measurePixelText(t.s) <= p.x0
            && t.y + FACE.h / 2 >= r.y0 && t.y + FACE.h / 2 < r.y1);
          expect(hit, `row ${lab.rows[j]} has no label beside it`).toBeTruthy();
        }
        // ⛔ the eight densest-tile ids design 1 used to print inside its cells are gone
        const inside = text.filter((t) => /^[A-P]\d{1,2}$/.test(t.s) && t.x >= p.x0 && t.x < p.x0 + p.sq && t.y >= p.y0 && t.y < p.y0 + p.sq);
        expect(inside, 'cell ids are still printed inside the grid').toHaveLength(0);
      }, 60000);
    }
  }
});

describe('AC-3 — neighbouring parents are dimmed and labelled, and never picked', () => {
  for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
    it(`design ${design} SECTOR: panned half a sector east, the eastern neighbour shows its own reference`, async () => {
      const { nav, drv } = await framed(mode, 1);
      nav._viewCenter.x += 1;                          // half a 2 kpc sector
      nav.render();
      const text = textOf(drv, design);
      const own = navGrid.parentOf(1, addressOf(8, 0, 0)).sector;
      const east = navGrid.childRef(0, { sector: { i: own.i + 1, j: own.j } });
      expect(east).toBe('O10');
      expect(text.some((t) => t.s === east), `the neighbour ${east} is not labelled`).toBe(true);
      // a click on it is a miss: the cell picker answers only inside the screen's own sector
      const p = drv.S.mapProj;
      const b = boundsOf({ sector: { i: own.i + 1, j: own.j } });
      const x = p.x0 + ((b.min.x + 0.3 - p.cx) / p.size + 0.5) * p.sq;
      const y = p.y0 + (0.5 - ((b.min.z + b.max.z) / 2 - p.cz) / p.size) * p.sq;
      nav._handleMouseMove({ clientX: x, clientY: y });
      nav.render();
      expect(nav._hoveredTile, 'a dimmed neighbour took the pick').toBe(null);
    }, 60000);
  }
});
