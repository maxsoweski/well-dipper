/**
 * navGridDrill.host.test.js — the HOST half of naming-prism-segments Phase 2 (AC-3), written by the
 * UI lane as the acceptance spec for NavComputer's call-site changes.
 *
 * ⚠ RED UNTIL THE HOST LANE LANDS. The UI lane (navGrid.js, the designs, the driver) publishes every
 * 2D pick as `_hoveredTile = navGrid.hoverTile(level, address)` and the parent each screen is about
 * as `_viewStack[level].address`. These cases are what NavComputer must do with them:
 *   · a SECTOR / REGION click drills to `navGrid.nextView(level, address)` — the clicked cell's exact
 *     box — and records `address` on the view-stack entry it pushes;
 *   · a REGION click enters `navGrid.enterColumn(address)` and keeps it as `_prismColumn`;
 *   · the default views come from `navGrid.viewForAddress` (GALAXY = the 19 x 19 naming area, SECTOR =
 *     the player's sector, REGION = the player's region — "the default REGION view snaps");
 *   · PRISM: WASD stops at the column edge (`navGrid.clampToColumn`) and the wheel stays inside
 *     [PRISM_ZOOM_MIN_KPC, PRISM_ZOOM_MAX_KPC].
 * Max's rule: *"each cell in the galaxy should represent a single sector … Every cell in the sector view
 * should be displaying a single region. Every cell in the region view should be displaying a single
 * prism."*
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav, clickAt } from './helpers/headlessNav.mjs';
import * as navGrid from '../navGrid.js';
import { boundsOf, addressOf } from '../../generation/GalaxyGrid.js';

async function designNav(mode = 'rail') {
  const h = await makeHeadlessNav({ width: 427, height: 240 });
  h.nav._viewModesEnabled = true;
  h.nav.viewMode = mode;
  h.nav.setPlayerPosition({ x: 8, y: 0, z: 0 });
  h.drv = h.nav._viewDriverInst || null;
  return h;
}
const centreOf = (c) => ({ x: c.rect.x + c.rect.w / 2, y: c.rect.y + c.rect.h / 2 });
const landDrill = (nav) => { if (nav._anim) { nav._anim.startTime -= nav._anim.duration + 100; nav.render(); } };

describe('HOST: every screen frames its parent exactly (default views)', () => {
  it('setPlayerPosition at Sol: GALAXY = the naming area, SECTOR = N10, REGION = the player\'s region', async () => {
    const { nav } = await designNav();
    const a = addressOf(8, 0, 0);
    expect({ cx: nav._viewStack[0].center.x, cz: nav._viewStack[0].center.z, size: nav._viewStack[0].size })
      .toEqual(navGrid.viewForAddress(0, null));
    for (const level of [1, 2]) {
      const v = navGrid.viewForAddress(level, a), st = nav._viewStack[level];
      expect({ cx: st.center.x, cz: st.center.z, size: st.size }, `level ${level} frame`).toEqual(v);
      expect(navGrid.sameAddress(st.address, navGrid.parentOf(level, a)), `level ${level} address`).toBe(true);
    }
  });
});

describe('HOST: a click drills to exactly the clicked cell', () => {
  for (const mode of ['rail', 'bars']) {
    for (const level of [1, 2]) {
      it(`${mode} L${level}: the drill lands on the clicked cell's box, also after a drag`, async () => {
        const { nav } = await designNav(mode);
        nav._levelIndex = level; nav._applyLevelView(); nav.render();
        const drv = nav._viewDriverInst;
        // drag the map by an awkward amount first: the cells must stay world-locked
        const cl = drv.S.mapProj.clip, sx = cl.x + cl.w / 2, sy = cl.y + cl.h / 2;
        nav._handleMouseDown({ clientX: sx, clientY: sy, button: 0 });
        nav._handleMouseMove({ clientX: sx + 17, clientY: sy - 9 });
        nav._handleMouseUp();
        nav.render();
        const c = drv.S.mapCells.find((k) => k.rect.w > 4 && k.rect.x > cl.x + 20 && k.rect.y > cl.y + 20);
        const { x, y } = centreOf(c);
        nav._handleMouseMove({ clientX: x, clientY: y });
        clickAt(nav, x, y);
        const nv = navGrid.nextView(level, c.address);
        if (level === 1) {
          const st = nav._viewStack[2];
          expect({ cx: st.center.x, cz: st.center.z, size: st.size }).toEqual(nv.view);
          expect(navGrid.sameAddress(st.address, c.address)).toBe(true);
          landDrill(nav);
          expect(nav._levelIndex).toBe(2);
          expect(navGrid.sameAddress(drv.S.gridParent, c.address), 'REGION is about the clicked region').toBe(true);
        } else {
          expect(navGrid.sameAddress(nav._prismColumn?.address, c.address), 'PRISM is the clicked column').toBe(true);
          expect(nav._localCenter.x).toBe(nv.column.center.x);
          expect(nav._localCenter.z).toBe(nv.column.center.z);
        }
      }, 60000);
    }
  }
});

describe('HOST: PRISM is one fixed column', () => {
  it('WASD stops at the column edge; the wheel stays inside the plan\'s zoom range', async () => {
    const { nav } = await designNav();
    const col = navGrid.enterColumn(addressOf(8, 0, 0));
    nav._levelIndex = 3; nav.render();
    nav._localCenter.x = col.bounds.max.x - 1e-6;
    nav._heldKeys.add('KeyD');
    for (let k = 0; k < 30; k++) nav.render();
    nav._heldKeys.delete('KeyD');
    expect(nav._localCenter.x, 'D walked out of the column').toBeLessThanOrEqual(col.bounds.max.x);
    for (let k = 0; k < 80; k++) nav._handleWheel({ deltaY: 1, preventDefault() {} });
    expect(nav._localRadius).toBeLessThanOrEqual(navGrid.PRISM_ZOOM_MAX_KPC);
    expect(nav._localRadius, 'zoom can pull back past the column').toBeGreaterThan(col.halfWidth);
    for (let k = 0; k < 80; k++) nav._handleWheel({ deltaY: -1, preventDefault() {} });
    expect(nav._localRadius).toBeGreaterThanOrEqual(navGrid.PRISM_ZOOM_MIN_KPC);
  }, 60000);
});

describe('HOST: the legacy look keeps one cell = one place', () => {
  it('legacy SECTOR hover names a region of the screen\'s sector, and its box holds the pointer\'s point', async () => {
    const { nav } = await designNav();
    nav.viewMode = null;
    nav._levelIndex = 1; nav._applyLevelView(); nav.render();
    nav._handleMouseMove({ clientX: nav._canvas.width / 2 + 3, clientY: nav._canvas.height / 2 - 20 });
    const hv = nav._hoveredTile;
    expect(hv?.address, 'legacy publishes the hovered cell\'s address').toBeTruthy();
    expect(hv.bounds).toEqual(boundsOf(hv.address));
    expect(navGrid.sameAddress(navGrid.parentOf(1, hv.address), nav._viewStack[1].address)).toBe(true);
  }, 60000);
});
