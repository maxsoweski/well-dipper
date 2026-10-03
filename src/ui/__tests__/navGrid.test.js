/**
 * navGrid.test.js — the SEAM every nav screen, picker, drill and the autopilot share
 * (naming-prism-segments Phase 2, AC-3 / AC-4).
 *
 * Max's rule: *"each cell in the galaxy should represent a single sector … Every cell in the sector
 * view should be displaying a single region. Every cell in the region view should be displaying a
 * single prism."* These tests pin that every cell a screen can draw IS exactly one child box of the
 * frozen grid, and that the point → cell inverse lands in that same box.
 */
import { describe, it, expect } from 'vitest';
import {
  GALAXY, SECTOR, REGION, PRISM, childCount, childKpc, childGrid, childCell, cellAt, viewForAddress,
  enterColumn, clampToColumn, drillPath, hoverTile, nextView, parentAt, sameAddress, addressKey,
  axisLabels, sectorLive, PRISM_ZOOM_MAX_KPC, PRISM_ZOOM_MIN_KPC, easeSize,
} from '../navGrid.js';
import { boundsOf, addressOf, PRISM_KPC, GRID_MIN_KPC, GRID_MAX_KPC } from '../../generation/GalaxyGrid.js';

const SOL = { x: 8, z: 0 };
const mid = (b) => ({ x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2 });

describe('navGrid — one cell is exactly one child box', () => {
  it('GALAXY: 19 × 19 cells, each exactly one sector; 293 drawn (touch R ≤ 18 kpc), 68 corners not', () => {
    const g = childGrid(GALAXY, null);
    expect(g.length).toBe(361);
    expect(g.filter((c) => c.live).length).toBe(293);
    for (const c of g) {
      expect(c.bounds).toEqual(boundsOf({ sector: { i: c.i, j: c.j } }));
      expect(c.bounds.max.x - c.bounds.min.x).toBe(2);
    }
    // the four extreme corners are not drawn; the centre is
    expect(sectorLive({ sector: { i: 0, j: 0 } })).toBe(false);
    expect(sectorLive({ sector: { i: 9, j: 9 } })).toBe(true);
  });

  it('SECTOR and REGION: 16 × 16 cells that tile their parent with no gap and no overlap', () => {
    for (const [level, parent] of [[SECTOR, parentAt(SECTOR, SOL.x, SOL.z)], [REGION, parentAt(REGION, SOL.x, SOL.z)],
                                   [SECTOR, parentAt(SECTOR, 0, 0)], [REGION, parentAt(REGION, -17.3, 5.2)]]) {
      const g = childGrid(level, parent);
      const pb = boundsOf(parent);
      expect(g.length).toBe(256);
      for (const c of g) {
        expect(c.bounds).toEqual(boundsOf(c.address));
        expect(c.bounds.max.x - c.bounds.min.x).toBe(childKpc(level));
        // column i starts where column i-1 ended; row 1 is at the TOP (largest z)
        expect(c.bounds.min.x).toBe(pb.min.x + c.i * childKpc(level));
        expect(c.bounds.max.z).toBe(pb.max.z - c.j * childKpc(level));
      }
    }
  });

  it('Sol is in sector N10 and the galactic centre in J10 (row 1 at the top)', () => {
    expect(hoverTile(GALAXY, { sector: addressOf(8, 0, 0).sector }).ref).toBe('N10');
    expect(hoverTile(GALAXY, { sector: addressOf(0, 0, 0).sector }).ref).toBe('J10');
    // a point at large z is in a LOW row number: row 1 is the top of the screen
    expect(cellAt(GALAXY, null, 0, 15).sector.j).toBeLessThan(cellAt(GALAXY, null, 0, -15).sector.j);
  });

  it('cellAt inverts childGrid at every cell: centre, inside lower corner, and the excluded upper corner', () => {
    for (const [level, parent] of [[GALAXY, null], [SECTOR, parentAt(SECTOR, SOL.x, SOL.z)], [REGION, parentAt(REGION, SOL.x, SOL.z)]]) {
      for (const c of childGrid(level, parent)) {
        if (!c.live) { expect(cellAt(level, parent, mid(c.bounds).x, mid(c.bounds).z)).toBeNull(); continue; }
        const m = mid(c.bounds);
        expect(sameAddress(cellAt(level, parent, m.x, m.z), c.address)).toBe(true);
        // half-open on both axes: the min corner is inside, the max corner belongs to the next cell
        expect(sameAddress(cellAt(level, parent, c.bounds.min.x, c.bounds.min.z), c.address)).toBe(true);
        const up = cellAt(level, parent, c.bounds.max.x, c.bounds.max.z);
        expect(up === null || !sameAddress(up, c.address)).toBe(true);
      }
    }
  });

  it('a point in a neighbouring parent is not a cell of this screen', () => {
    const n10 = parentAt(SECTOR, SOL.x, SOL.z);
    const b = boundsOf(n10);
    expect(cellAt(SECTOR, n10, b.max.x + 0.1, (b.min.z + b.max.z) / 2)).toBeNull();
    expect(cellAt(SECTOR, n10, b.min.x - 1e-9, (b.min.z + b.max.z) / 2)).toBeNull();
    expect(cellAt(SECTOR, n10, b.min.x, (b.min.z + b.max.z) / 2)).not.toBeNull();
  });

  it('viewForAddress frames the parent exactly; GALAXY frames the whole naming area', () => {
    expect(viewForAddress(GALAXY, null)).toEqual({ cx: (GRID_MIN_KPC + GRID_MAX_KPC) / 2, cz: (GRID_MIN_KPC + GRID_MAX_KPC) / 2, size: 38 });
    const a = addressOf(SOL.x, 0, SOL.z);
    for (const level of [SECTOR, REGION, PRISM]) {
      const v = viewForAddress(level, a), b = boundsOf(parentAt(level, SOL.x, SOL.z));
      expect(v.cx - v.size / 2).toBe(b.min.x);
      expect(v.cz + v.size / 2).toBe(b.max.z);
      expect(v.size).toBe(b.max.x - b.min.x);
    }
    expect(viewForAddress(PRISM, a).size).toBe(PRISM_KPC);
  });

  it('enterColumn is one fixed 7.8125 pc column; clampToColumn stops at its edge', () => {
    const col = enterColumn(addressOf(SOL.x, 0, SOL.z));
    expect(col.halfWidth).toBe(0.00390625);
    expect(col.bounds.max.x - col.bounds.min.x).toBe(PRISM_KPC);
    expect(col.center.x).toBe((col.bounds.min.x + col.bounds.max.x) / 2);
    expect(PRISM_ZOOM_MAX_KPC).toBe(0.015625);
    expect(PRISM_ZOOM_MIN_KPC).toBe(0.0015);
    const c = clampToColumn(col, col.center.x + 1, col.center.z - 1);
    expect(c).toEqual({ x: col.bounds.max.x, z: col.bounds.min.z });
    expect(clampToColumn(col, col.center.x, col.center.z)).toEqual(col.center);
  });

  it('drillPath: each step\'s highlighted cell is the cell cellAt finds there, ending in the column', () => {
    for (const [x, z] of [[8, 0], [0, 0], [-12.345, 7.89], [1.00390625, -0.99609375]]) {
      const path = drillPath(x, z);
      expect(path.map((s) => s.level)).toEqual([0, 1, 2, 3]);
      for (const s of path.slice(0, 3)) {
        expect(sameAddress(cellAt(s.level, s.parent, x, z), s.child)).toBe(true);
        const nv = nextView(s.level, s.child);
        if (s.level < 2) expect(nv.view).toEqual(viewForAddress(s.level + 1, s.child));
        else expect(nv.column).toEqual(path[3].column);
      }
      expect(sameAddress(path[3].column.address, addressOf(x, 0, z))).toBe(true);
    }
    expect(drillPath(18.5, 18.5)).toBeNull();   // an undrawn corner
  });

  it('hoverTile at GALAXY carries the sector square the shipped drill reads', () => {
    const h = hoverTile(GALAXY, { sector: addressOf(8, 0, 0).sector });
    const b = boundsOf(h.address);
    expect(h.sector).toMatchObject({ centerX: (b.min.x + b.max.x) / 2, centerZ: (b.min.z + b.max.z) / 2, size: 2, name: 'N10' });
    expect(hoverTile(GALAXY, { sector: { i: 0, j: 0 } })).toBeNull();
  });

  it('labels: letters across, numbers down; keys are unique and readable', () => {
    expect(axisLabels(GALAXY).cols.join('')).toBe('ABCDEFGHIJKLMNOPQRS');
    expect(axisLabels(SECTOR).rows[15]).toBe('16');
    expect(childCount(GALAXY)).toBe(19);
    expect(addressKey(addressOf(8, 0, 0))).toMatch(/^N10 [A-P]\d+ [A-P]\d+$/);
    expect(childCell(REGION, addressOf(8, 0, 0)).ref).toBe(addressKey(addressOf(8, 0, 0)).split(' ')[2]);
    expect(easeSize(SECTOR, 2)).toBe(2 / 32);
  });
});
