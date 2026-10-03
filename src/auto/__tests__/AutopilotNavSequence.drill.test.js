/**
 * AutopilotNavSequence.drill.test.js — naming-prism-segments Phase 2, AC-4.
 *
 * AC-4: "The autopilot drills through the same cells the pilot would — its private 8×8 / 44 kpc grid
 * (AutopilotNavSequence.js:464-473) is replaced by the shared address → view and enter-column
 * functions." Observable: the sequence of cells the autopilot shows at each level equals the manual
 * drill's cell ids exactly; the hover highlight and the animation use the same grid.
 *
 * Max's rule (2026-10-02): *"each cell in the galaxy should represent a single sector … Every cell in
 * the sector view should be displaying a single region. Every cell in the region view should be
 * displaying a single prism."*
 *
 * The MANUAL drill here is a real pointer: a mouse move and a click at the texel where the destination
 * lies on the map that is actually drawn (the legacy map square, or a 240p design's published
 * `S.mapProj`), through `_handleMouseMove` / `render()` / `_handleClick`. The AUTOPILOT runs its own
 * `_runStyle('full_journey')` with its timers replaced by a queue. Each records, per level, the cell it
 * lit (`_hoveredTile`) and the box the drill landed on (`_viewStack[level + 1]` / `_prismColumn`).
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav } from '../../ui/__tests__/helpers/headlessNav.mjs';
import * as navGrid from '../../ui/navGrid.js';
import * as navDrill from '../../ui/navDrill.js';
import { boundsOf } from '../../generation/GalaxyGrid.js';
import { AutopilotNavSequence } from '../AutopilotNavSequence.js';

/** A destination in the middle of its region and its sector, so a texel's rounding at any screen
 *  cannot put the pointer on a neighbour: column H8 of region H8 of sector P8 (a live sector off
 *  Sol's own), and its centre. Plus Sol's own column, where the player's sector/region are the parents. */
const DESTS = [
  { sector: { i: 15, j: 7 }, region: { i: 7, j: 7 }, prism: { i: 7, j: 7 } },
  { sector: { i: 13, j: 9 }, region: { i: 8, j: 8 }, prism: { i: 8, j: 8 } },
].map((a) => {
  const b = boundsOf(a);
  return { address: a, x: (b.min.x + b.max.x) / 2, y: 0, z: (b.min.z + b.max.z) / 2 };
});

async function freshNav(mode) {
  const h = await makeHeadlessNav({ width: 427, height: 240 });
  h.nav._viewModesEnabled = true;
  h.nav.viewMode = mode;
  h.nav.setPlayerPosition({ x: 8, y: 0, z: 0 });
  h.nav._levelIndex = 0; h.nav._applyLevelView();
  h.nav.render();
  return h.nav;
}

const landDrill = (nav) => { if (nav._anim) { nav._anim.startTime -= nav._anim.duration + 100; nav.render(); } };
const key = (a) => navGrid.addressKey(a);
/** Where the drill's zoom animation is flying (the hover and the animation must use one grid). */
const animTarget = (nav) => nav._anim && { x: nav._anim.toCenter.x, z: nav._anim.toCenter.z, size: nav._anim.toSize, to: nav._anim.toLevel };

/** What a level's drill landed on: the next screen's parent, or the column PRISM shows. */
function landed(nav, level) {
  if (level < navGrid.REGION) {
    const st = nav._viewStack[level + 1];
    return { key: key(st.address), center: st.center, size: st.size };
  }
  return { key: key(nav._prismColumn.address), center: nav._prismColumn.center, size: 2 * nav._prismColumn.halfWidth };
}

/** The texel where world point (x, z) is drawn on the map on the glass. Independent of navDrill:
 *  the design's published `S.mapProj`, or the legacy square's own arithmetic. */
function texelOf(nav, x, z) {
  const mp = nav.viewMode && nav._viewDriverInst?.S?.mapProj;
  if (mp) {
    const k = mp.sq / mp.size;
    return { x: mp.x0 + mp.sq / 2 + (x - mp.cx) * k, y: mp.y0 + mp.sq / 2 - (z - mp.cz) * k };
  }
  const W = nav._canvas.width, H = nav._canvas.height;
  const P = navDrill.legacyProj(nav, W, H);
  return { x: P.ox + (x - nav._viewCenter.x + nav._viewSize / 2) * P.k, y: P.oy + (nav._viewSize / 2 - (z - nav._viewCenter.z)) * P.k };
}

async function manualDrill(mode, dest) {
  const nav = await freshNav(mode);
  const out = [];
  for (let level = 0; level <= 2; level++) {
    expect(nav._levelIndex, `manual: on level ${level}`).toBe(level);
    nav.render();
    const t = texelOf(nav, dest.x, dest.z);
    nav._handleMouseMove({ clientX: t.x, clientY: t.y });
    nav.render();   // the legacy GALAXY hover — and a design's — is resolved in the paint, as live
    const lit = nav._hoveredTile;
    nav._handleMouseDown({ clientX: t.x, clientY: t.y, button: 0 });
    nav._handleMouseUp();
    nav._handleClick({ clientX: t.x, clientY: t.y, button: 0 });
    const anim = animTarget(nav);
    landDrill(nav);
    out.push({ level, lit: lit && key(lit.address), anim, landed: landed(nav, level) });
  }
  return { nav, out };
}

async function autopilotDrill(mode, dest) {
  const nav = await freshNav(mode);
  const queue = [];
  const seq = new AutopilotNavSequence({
    navComputer: nav, openNavComputer: () => {}, closeNavComputer: () => {}, onWarpReady: () => {},
    onComplete: () => {}, soundEngine: null, playerPos: { x: 8, y: 0, z: 0 },
  });
  seq._delay = (_ms, fn) => queue.push(fn);
  let selected = false;
  seq._selectStar = () => { selected = true; };
  const out = [];
  const step = seq._hoverThenDrill.bind(seq);
  seq._hoverThenDrill = (d, level) => {
    step(d, level);
    const lit = nav._hoveredTile;
    out.push({ level, lit: lit && key(lit.address), cursor: nav._autoCursor && { ...nav._autoCursor } });
  };
  seq._active = true;
  seq._runStyle('full_journey', dest);
  let guard = 0;
  while (queue.length && guard++ < 50) {
    nav.render();
    queue.shift()();
    // A queued step that started a drill: land it, and record what it landed on.
    const last = out[out.length - 1];
    if (last && last.landed === undefined && nav._anim) {
      last.anim = animTarget(nav);
      landDrill(nav);
      last.landed = landed(nav, last.level);
    }
  }
  return { nav, out, selected };
}

describe('AC-4 — the autopilot drills through the cells a pilot would', () => {
  for (const mode of [null, 'rail', 'bars']) {
    for (const dest of DESTS) {
      const label = `${mode || 'legacy'} → ${key(dest.address)}`;
      it(`${label}: same cell lit and same box landed at GALAXY, SECTOR and REGION`, async () => {
        const man = await manualDrill(mode, dest);
        const ap = await autopilotDrill(mode, dest);
        expect(ap.selected, 'the autopilot reached PRISM and went on to pick a star').toBe(true);
        // The pilot's sequence is the destination's own address, level by level (Max's rule).
        const want = navGrid.drillPath(dest.x, dest.z).slice(0, 3).map((s) => key(s.child));
        expect(man.out.map((s) => s.lit), 'the manual drill lit the destination\'s cells').toEqual(want);
        expect(ap.out.map((s) => s.lit), 'the autopilot lit the same cells').toEqual(man.out.map((s) => s.lit));
        expect(ap.out.map((s) => s.landed), 'and flew to the same boxes').toEqual(man.out.map((s) => s.landed));
        expect(ap.out.map((s) => s.anim), 'and the zoom animations fly to the same places').toEqual(man.out.map((s) => s.anim));
        for (const s of man.out.slice(0, 2)) {
          expect({ x: s.anim.x, z: s.anim.z, size: s.anim.size }, 'the zoom flies to the box it lands on')
            .toEqual({ x: s.landed.center.x, z: s.landed.center.z, size: s.landed.size });
        }
        expect(key(ap.nav._prismColumn.address)).toBe(key(dest.address));
        expect(ap.nav._levelIndex).toBe(3);
        expect(ap.nav._localCenter.x).toBe(man.nav._localCenter.x);
        expect(ap.nav._localCenter.z).toBe(man.nav._localCenter.z);
      }, 120000);
    }
  }

  it('the performed cursor sits on the cell it lights (legacy map)', async () => {
    const dest = DESTS[0];
    const ap = await autopilotDrill(null, dest);
    // Re-run the steps' frames: at each level the cursor must be inside the lit cell's drawn box.
    const nav = await freshNav(null);
    for (let level = 0; level <= 2; level++) {
      const tile = navGrid.hoverTile(level, navGrid.drillPath(dest.x, dest.z)[level].child);
      const P = navDrill.legacyProj(nav);
      const c = ap.out[level].cursor;
      expect(c.x).toBeGreaterThanOrEqual(P.toX(tile.bounds.min.x));
      expect(c.x).toBeLessThanOrEqual(P.toX(tile.bounds.max.x));
      expect(c.y).toBeGreaterThanOrEqual(P.toY(tile.bounds.max.z));
      expect(c.y).toBeLessThanOrEqual(P.toY(tile.bounds.min.z));
      navDrill.drillInto(nav, level, tile.address, { sound: false });
      landDrill(nav);
    }
  }, 120000);
});

describe('AC-4 — the autopilot\'s direct entries frame the same boxes as the drill', () => {
  const stackKeys = (nav) => nav._viewStack.map((e) => e && { key: key(e.address), cx: e.center.x, cz: e.center.z, size: e.size });

  it('sector_hop / region_browse start on the destination\'s own sector / region, stack included', async () => {
    const dest = DESTS[0];
    for (const level of [1, 2]) {
      const nav = await freshNav(null);
      const seq = new AutopilotNavSequence({ navComputer: nav, openNavComputer() {}, closeNavComputer() {} });
      seq._delay = () => {};
      seq._runStyle(level === 1 ? 'sector_hop' : 'region_browse', dest);
      expect(nav._levelIndex).toBe(level);
      const want = navDrill.stackFor(dest.x, dest.z).slice(0, level + 1);
      expect(stackKeys(nav)).toEqual(want.map((e) => ({ key: key(e.address), cx: e.center.x, cz: e.center.z, size: e.size })));
      const v = navGrid.viewForAddress(level, dest.address);
      expect({ cx: nav._viewCenter.x, cz: nav._viewCenter.z, size: nav._viewSize }).toEqual(v);
    }
  }, 120000);

  it('prism_scroll / nearby_pick enter the destination\'s fixed column — not a density box around it', async () => {
    const nav = await freshNav(null);
    const seq = new AutopilotNavSequence({ navComputer: nav, openNavComputer() {}, closeNavComputer() {} });
    seq._delay = () => {};
    const dest = { x: DESTS[0].x + 0.0021, y: 0.01, z: DESTS[0].z - 0.0017 };   // off the column's centre
    seq._setupPrismView(dest);
    const col = navGrid.enterColumn(navGrid.parentAt(3, dest.x, dest.z));
    expect(nav._levelIndex).toBe(3);
    expect(key(nav._prismColumn.address)).toBe(key(col.address));
    expect(nav._localCubeSize, 'the loader\'s half-width is the column\'s').toBe(col.halfWidth);
    expect(nav._localCenter).toEqual({ x: col.center.x, y: 0.01, z: col.center.z });
    // ESC from here goes to the destination's REGION frame, not a synthetic 0.01 kpc one.
    expect(nav._viewStack[2].size).toBe(navGrid.viewForAddress(2, col.address).size);
    nav.render();
    for (const s of nav._localStars) {
      // no `|| s.isReal` exemption: catalogue rows are held to the column's half-open footprint too (Phase 2 fixup, Astra finding 7)
      expect(navGrid.inFootprint(col.bounds, s.wx, s.wz), `${s.key} is outside the column`).toBe(true);
    }
  }, 120000);
});
