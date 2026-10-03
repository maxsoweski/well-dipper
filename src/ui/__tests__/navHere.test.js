/**
 * navHere.test.js — naming-prism-segments Phase 2, AC-5: "here" is the PLAYER, not a browsed row.
 *
 * AC-5: *"'Here' is worked out from the player's own position, independent of the rows being browsed;
 * a column that is not the player's shows no here-mark."* Before this, `state.js` made "here" the row
 * with the game's system name, else the NEAREST loaded row — so on another column the YOU mark sat on a
 * stranger and its name replaced the real system's in the where-am-I label.
 *
 * Also pinned here (plan §6, same resolver): PRISM shows ONE column — every row is inside it — and the
 * list's distances are measured from the player, not from the query's centre.
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import * as navGrid from '../navGrid.js';
import { PRISM_KPC } from '../../generation/GalaxyGrid.js';

const W = 417, H = 240;
const INK = makeDesigns({ S: { design: 1, level: 3 }, D: {} }).INK;

/** A design nav at PRISM with the prism loaded, standing ON a loaded star of its own column. */
async function standingOnAStar(mode = 'rail') {
  const h = await makeHeadlessNav({ width: W, height: H });
  const nav = h.nav;
  nav._viewModesEnabled = true; nav.viewMode = mode;
  nav._levelIndex = 3; nav.render();
  const drv = nav._viewDriverInst;
  const s = drv.D.starRows.find((r) => r.key && r.key.startsWith('p:') && r.dist > 0.0005);
  if (!s) throw new Error('fixture: no procedural row in the column');
  nav._playerX = s.wx; nav._playerY = s.wy; nav._playerZ = s.wz;
  nav._currentSystemName = 'HOME SYSTEM';
  nav._localCenter = { x: s.wx, y: s.wy, z: s.wz };      // the camera on it: same column, mark on the glass
  nav.render();
  return { nav, drv, star: s };
}

/** Every fill a render made, with its ink. */
function inkRecorder() {
  const fills = [];
  let fillStyle = '';
  const ctx = new Proxy({}, {
    get(_t, k) {
      if (k === 'canvas') return { width: W, height: H };
      if (k === 'fillStyle') return fillStyle;
      if (k === 'fillRect') return (x, y, w, h) => { fills.push({ x, y, w, h, ink: fillStyle }); };
      if (k === 'measureText') return (s) => ({ width: String(s).length * 6 });
      if (k === 'getImageData' || k === 'createImageData') return (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(0, w * h * 4)) });
      return () => ({ addColorStop() {} });
    },
    set(_t, k, v) { if (k === 'fillStyle') fillStyle = v; return true; },
  });
  return { ctx, fills };
}
/** The here-mark's top edge in each design: design 1 a 5x5 YOU frame, design 2 four YOU corner ticks. */
function hereMarks(drv, nav) {
  const { ctx, fills } = inkRecorder();
  drv.render(ctx, W, H);
  const m = drv.regions().map;
  return fills.filter((f) => f.ink === INK.YOU && f.h === 1 && f.w >= 3 && f.w <= 5
    && f.x >= m.x && f.x < m.x + m.w && f.y >= m.y && f.y < m.y + m.h
    // ⚠ the y-gauge's own player tick (`yGauge`, 3x1 YOU) sits inside design 2's map pane: not a star mark
    && !(drv.S.yGaugeRect && f.x >= drv.S.yGaugeRect.x - 1 && f.x <= drv.S.yGaugeRect.x + drv.S.yGaugeRect.w + 1));
}

describe('AC-5 — here is the player, worked out from the player', () => {
  for (const mode of ['rail', 'bars']) {
    it(`${mode}: on the player's own column the here-row IS the player's star, and its mark is drawn`, async () => {
      const { nav, drv, star } = await standingOnAStar(mode);
      expect(drv.D.hereColumn, 'the column on the glass is the player\'s').toBe(true);
      expect(drv.D.here?.key, 'here is not the star the player stands on').toBe(star.key);
      expect(drv.D.hereName).toBe('HOME SYSTEM');
      const mark = (drv.S.prismHits || []).find((h) => h.ref === drv.D.here);
      expect(mark, 'the player\'s star is not on the glass — the case is vacuous').toBeTruthy();
      const marks = hereMarks(drv, nav);
      expect(marks.some((f) => Math.abs(f.x - mark.x) <= 4 && Math.abs(f.y - mark.y) <= 4),
        'no here-mark on the player\'s star').toBe(true);
    }, 60000);

    it(`${mode}: on a NEIGHBOURING column there is no here-row, no here-mark, and the label still names home`, async () => {
      const { nav, drv } = await standingOnAStar(mode);
      expect(hereMarks(drv, nav).length, 'control: the own column draws a here-mark').toBeGreaterThan(0);
      nav._localCenter = { ...nav._localCenter, x: nav._localCenter.x + PRISM_KPC };   // the next column east
      nav.render();
      expect(drv.D.hereColumn).toBe(false);
      expect(drv.D.here, 'a browsed column grew a here-row').toBe(null);
      expect(drv.D.hereName, 'the where-am-I label named a browsed row').toBe('HOME SYSTEM');
      expect(hereMarks(drv, nav), 'a column that is not the player\'s drew a here-mark').toHaveLength(0);
    }, 60000);
  }

  it('on the player\'s own column with the player\'s star NOT loaded: no here-row, and the label names home', async () => {
    const { nav, drv } = await standingOnAStar();
    const col = drv.D.column.bounds;
    // a point in the same column far (> 0.1 pc) from every loaded row
    let spot = null;
    for (let i = 1; i < 8 && !spot; i++) for (let j = 1; j < 8 && !spot; j++) {
      const x = col.min.x + (i / 8) * PRISM_KPC, z = col.min.z + (j / 8) * PRISM_KPC;
      if (drv.D.starRows.every((r) => Math.hypot(r.wx - x, r.wy - nav._playerY, r.wz - z) > 0.0002)) spot = { x, z };
    }
    expect(spot, 'fixture: no empty spot in the column').toBeTruthy();
    nav._playerX = spot.x; nav._playerZ = spot.z;
    nav.render();
    expect(drv.D.hereColumn).toBe(true);
    expect(drv.D.here, 'a neighbour was promoted to "here"').toBe(null);
    expect(drv.D.hereName).toBe('HOME SYSTEM');
  }, 60000);

  it('PRISM shows ONE column, and every list distance is measured from the player', async () => {
    const { nav, drv } = await standingOnAStar();
    const b = drv.D.column.bounds;
    // ⚠ the player moves to another corner of the SAME column, away from where the loader queried:
    //   a distance taken from the query's centre now differs from one taken from the player
    nav._playerX = b.min.x + 0.0005; nav._playerZ = b.max.z - 0.0005; nav._playerY += 0.002;
    nav.render();
    expect(b.max.x - b.min.x).toBe(PRISM_KPC);
    expect(navGrid.sameAddress(drv.S.prismColumn, navGrid.parentAt(3, nav._localCenter.x, nav._localCenter.z))).toBe(true);
    expect(drv.D.starRows.length, 'the column is empty — the case is vacuous').toBeGreaterThan(3);
    // ⭐ naming-prism-segments Phase 3 (AC-6): the slab loader now applies the half-open ownership rule
    //   AT SOURCE (prismLoader.js: a slab's rows are exactly the stars its column and slab own), so the
    //   loaded rows themselves are all inside — the old control (the loader over-fetched and the glass
    //   filtered) no longer has an over-fetch to find. The per-row checks below still hold the glass.
    const outside = nav._localStars.filter((s) => !navGrid.inFootprint(b, s.wx, s.wz));
    expect(outside.length, 'the loader published stars outside the column').toBe(0);
    expect(nav._localStars.length, 'the loader published nothing — the case is vacuous').toBeGreaterThan(3);
    for (const r of drv.D.starRows) {
      expect(navGrid.inFootprint(b, r.wx, r.wz), `${r.key} is outside the column on the glass`).toBe(true);
      const d = Math.hypot(r.wx - nav._playerX, r.wy - nav._playerY, r.wz - nav._playerZ);
      expect(r.dist, `${r.key}: dist is not from the player`).toBeCloseTo(d, 12);
      expect(r.pc).toBeCloseTo(d * 1000, 9);
    }
  }, 60000);
});
