/**
 * navGridHost.test.js — naming-prism-segments Phase 2, the HOST lane's own cases (AC-3, AC-5) for the
 * paths the UI lane's `navGridDrill.host.test.js` does not walk: the legacy look end to end, ESC and
 * the tab strip around PRISM, the player's sector record, and "here" in the legacy prism.
 *
 * Max's rule (2026-10-02): *"each cell in the galaxy should represent a single sector … Every cell in
 * the sector view should be displaying a single region. Every cell in the region view should be
 * displaying a single prism."* AC-5: *"'Here' is worked out from the player's own position,
 * independent of the rows being browsed; a column that is not the player's shows no here-mark."*
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav, clickAt } from './helpers/headlessNav.mjs';
import * as navGrid from '../navGrid.js';
import * as navDrill from '../navDrill.js';
import { addressOf, boundsOf } from '../../generation/GalaxyGrid.js';

const W = 427, H = 240;
const landDrill = (nav) => { if (nav._anim) { nav._anim.startTime -= nav._anim.duration + 100; nav.render(); } };
const key = (a) => navGrid.addressKey(a);

async function legacyNav(at = { x: 8, y: 0, z: 0 }) {
  const h = await makeHeadlessNav({ width: W, height: H });
  h.nav.viewMode = null;
  h.nav.setPlayerPosition(at);
  return h;
}

/** A context that remembers the stroke colour each `arc` was drawn in, and every text it printed. */
function strokeRecorder() {
  const arcs = [], text = [];
  let strokeStyle = '';
  const ctx = new Proxy({}, {
    get(_t, k) {
      if (k === 'canvas') return { width: W, height: H };
      if (k === 'strokeStyle') return strokeStyle;
      if (k === 'arc') return (x, y, r) => { arcs.push({ x, y, r, ink: strokeStyle }); };
      if (k === 'fillText') return (s, x, y) => { text.push(String(s)); };
      if (k === 'measureText') return (s) => ({ width: String(s).length * 6 });
      if (k === 'getImageData' || k === 'createImageData') return (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(0, w * h * 4)) });
      if (typeof k === 'symbol') return undefined;
      return () => ({ addColorStop() {} });
    },
    set(_t, k, v) { if (k === 'strokeStyle') strokeStyle = v; return true; },
  });
  return { ctx, arcs, text };
}

/** Render one frame into a recorder, with the player-marker and nearest-row helpers watched. */
function frame(nav) {
  const rec = strokeRecorder();
  const real = nav._ctx;
  nav._ctx = rec.ctx;
  let marker = 0, nearest = 0;
  const pm = nav._drawPlayerMarker, fn = nav._findNearestStar;
  nav._drawPlayerMarker = () => { marker++; };   // counted, not drawn: its own rings are cyan too
  nav._findNearestStar = (...a) => { nearest++; return fn.apply(nav, a); };
  try { nav.render(); } finally {
    nav._ctx = real; nav._drawPlayerMarker = pm; nav._findNearestStar = fn;
  }
  const HERE_INK = '#00d4ff';
  return { ...rec, marker, nearest, hereRings: rec.arcs.filter((a) => a.ink === HERE_INK) };
}

/** Drill (as a pilot's REGION click would) into another column of the player's region. */
function browseColumn(nav, address) {
  nav._levelIndex = 2; nav._applyLevelView();
  nav._hoveredTile = navGrid.hoverTile(2, address);
  nav._dragStartX = 0; nav._dragStartY = 0;
  nav._handleClick({ clientX: 0, clientY: 0, button: 0 });
  landDrill(nav);
  expect(key(nav._prismColumn.address)).toBe(key(address));
}

/** Legacy PRISM, standing on a loaded procedural star of the player's own column. */
async function standingOnAStar() {
  const { nav } = await legacyNav();
  nav._levelIndex = 3; nav.render();
  const s = nav._localStars.find((r) => r.key && r.key.startsWith('p:')
    && Math.hypot(r.wx - 8, r.wz) > 0.0005 && navGrid.inFootprint(nav._prismColumn.bounds, r.wx, r.wz));
  if (!s) throw new Error('fixture: no procedural row in Sol\'s column');
  nav.setPlayerPosition({ x: s.wx, y: s.wy, z: s.wz });
  nav._currentSystemName = 'HOME SYSTEM';
  nav._levelIndex = 3; nav.render();
  return { nav, star: s };
}

describe('AC-5 (legacy prism) — here is the player, never the nearest browsed row', () => {
  it('own column: the cyan ring is on the player\'s own star, no stand-in marker, nearest-row never asked', async () => {
    const { nav, star } = await standingOnAStar();
    expect(navDrill.onPlayerColumn(nav)).toBe(true);
    expect(navDrill.hereStar(nav, nav._localStars)?.key).toBe(star.key);
    const f = frame(nav);
    expect(f.hereRings.length, 'no here ring drawn').toBeGreaterThan(0);
    expect(f.marker, 'the player marker is the stand-in for a missing here-star').toBe(0);
    expect(f.nearest, 'the nearest-row fallback is back').toBe(0);
    expect(f.text).toContain('HOME SYSTEM');
  }, 60000);

  it('a neighbouring column: no here ring, no player marker — even with a row there carrying home\'s name', async () => {
    const { nav } = await standingOnAStar();
    const mine = navGrid.parentAt(3, nav._playerX, nav._playerZ);
    const other = { ...mine, prism: { i: (mine.prism.i + 1) % 16, j: mine.prism.j } };
    browseColumn(nav, other);
    nav.render();
    expect(nav._localStars.length, 'the browsed column loaded nothing — the case is vacuous').toBeGreaterThan(0);
    nav._localStars[0].name = 'HOME SYSTEM';             // a decoy: the old name match would take it
    expect(navDrill.onPlayerColumn(nav)).toBe(false);
    expect(navDrill.hereStar(nav, nav._localStars)).toBe(null);
    const f = frame(nav);
    expect(f.hereRings.length, 'a here ring on a column that is not the player\'s').toBe(0);
    expect(f.marker, 'a player marker on a column that is not the player\'s').toBe(0);
    expect(f.nearest).toBe(0);
    // ⭐ and the where-am-I text still names the player's system and sector, not a browsed row
    expect(f.text).toContain('HOME SYSTEM');
    expect(f.text).toContain(navGrid.childRef(0, navGrid.parentAt(1, nav._playerX, nav._playerZ)));
  }, 60000);

  it('own column, the player\'s star NOT among the loaded rows: no ring on a neighbour; the marker stands in', async () => {
    const { nav } = await standingOnAStar();
    // Step 0.6 pc off the star (well past the 0.1 pc identity radius), inside the same column.
    const col = nav._prismColumn;
    const x = Math.min(col.bounds.max.x - 1e-5, nav._playerX + 0.0006);
    nav._playerX = x;
    expect(navDrill.onPlayerColumn(nav)).toBe(true);
    const near = nav._localStars.filter((r) => Math.hypot(r.wx - nav._playerX, r.wy - nav._playerY, r.wz - nav._playerZ) < 0.0001);
    expect(near.length, 'fixture: a row sits on the new point').toBe(0);
    const f = frame(nav);
    expect(f.hereRings.length, 'the here ring went to the nearest row').toBe(0);
    expect(f.marker, 'with no here-star the player marker must stand in').toBe(1);
    expect(f.text).toContain('HOME SYSTEM');
  }, 60000);

  it('list distances are measured from the player, not from the query centre', async () => {
    const { nav } = await standingOnAStar();
    const mine = navGrid.parentAt(3, nav._playerX, nav._playerZ);
    browseColumn(nav, { ...mine, prism: { i: (mine.prism.i + 1) % 16, j: mine.prism.j } });
    nav.render();
    for (const r of nav._localStars.slice(0, 20)) {
      const d = Math.hypot(r.wx - nav._playerX, r.wy - nav._playerY, r.wz - nav._playerZ);
      expect(r.dist).toBeCloseTo(d, 12);
    }
  }, 60000);
});

describe('AC-3 (legacy look) — one cell = one place, end to end', () => {
  it('GALAXY: hovering Sol names sector N10, and the click lands on N10\'s exact square', async () => {
    const { nav } = await legacyNav();
    nav._levelIndex = 0; nav._applyLevelView(); nav.render();
    const P = navDrill.legacyProj(nav);
    nav._handleMouseMove({ clientX: P.toX(8), clientY: P.toY(0) });
    nav.render();
    const hv = nav._hoveredTile;
    expect(hv?.ref).toBe('N10');
    expect(hv.sector).toMatchObject({ centerX: hv.center.x, centerZ: hv.center.z, size: 2 });
    clickAt(nav, P.toX(8), P.toY(0));
    const v = navGrid.viewForAddress(1, addressOf(8, 0, 0));
    // ⭐ the ANIMATION flies to the same square the stack records — not only the landing snap
    expect({ cx: nav._anim.toCenter.x, cz: nav._anim.toCenter.z, size: nav._anim.toSize }, 'the zoom flies somewhere else').toEqual(v);
    landDrill(nav);
    expect(nav._levelIndex).toBe(1);
    expect({ cx: nav._viewCenter.x, cz: nav._viewCenter.z, size: nav._viewSize }).toEqual(v);
    expect(key(nav._viewStack[1].address)).toBe('N10');
  }, 60000);

  it('GALAXY: an undrawn corner sector cannot be hovered', async () => {
    const { nav } = await legacyNav();
    nav._levelIndex = 0; nav._applyLevelView(); nav.render();
    const b = boundsOf({ sector: { i: 0, j: 0 } });           // A1, a corner beyond R = 18 kpc
    const P = navDrill.legacyProj(nav);
    nav._hoveredTile = null;
    nav._handleMouseMove({ clientX: P.toX((b.min.x + b.max.x) / 2), clientY: P.toY((b.min.z + b.max.z) / 2) });
    nav.render();
    expect(nav._hoveredTile).toBe(null);
  }, 60000);

  it('SECTOR after a drag: the cells are world-locked, and the neighbouring sector is not a cell here', async () => {
    const { nav } = await legacyNav();
    nav._levelIndex = 1; nav._applyLevelView(); nav.render();
    const sb = nav._viewStack[1];
    // a world point near N10's east edge: the region H… column at 0.3 of the way in from the edge
    const w = { x: sb.center.x + sb.size / 2 - 0.3 * 0.125, z: sb.center.z + 0.2 };
    let P = navDrill.legacyProj(nav);
    nav._handleMouseMove({ clientX: P.toX(w.x), clientY: P.toY(w.z) });
    const before = key(nav._hoveredTile?.address);
    expect(before.startsWith('N10 ')).toBe(true);
    // drag the map 100 texels left — the frame's centre moves EAST, PAST N10's edge into O10 — and 23
    // up, through the real handlers. The screen is still about N10: a pan never re-cuts the cells.
    const cx = P.ox + P.drawSize / 2, cy = P.oy + P.drawSize / 2;
    nav._handleMouseDown({ clientX: cx, clientY: cy, button: 0 });
    nav._handleMouseMove({ clientX: cx - 100, clientY: cy - 23 });
    nav._handleMouseUp();
    nav.render();
    P = navDrill.legacyProj(nav);
    expect(nav._viewCenter.x, 'fixture: the frame centre must leave N10').toBeGreaterThan(sb.center.x + sb.size / 2);
    nav._handleMouseMove({ clientX: P.toX(w.x), clientY: P.toY(w.z) });
    expect(key(nav._hoveredTile?.address), 'the same world point is under a different cell after a drag').toBe(before);
    // past the east edge is O10 — on the glass now, but not one of this screen's cells
    const e = { x: sb.center.x + sb.size / 2 + 0.05, z: sb.center.z };
    const ex = P.toX(e.x), ey = P.toY(e.z);
    expect(ex < P.ox + P.drawSize, 'fixture: the neighbour is not on the glass').toBe(true);
    nav._handleMouseMove({ clientX: ex, clientY: ey });
    expect(nav._hoveredTile, 'a neighbouring sector\'s region answered as this screen\'s cell').toBe(null);
    clickAt(nav, ex, ey);
    expect(nav._anim, 'a click on the neighbour drilled').toBeFalsy();
  }, 60000);

  it('a hover payload left over from another level is not drilled', async () => {
    // e.g. a REGION pick still in the field when the tab strip moves the screen to SECTOR: its address
    // names a prism, and truncated to a region it would fly somewhere this screen never framed.
    const { nav } = await legacyNav();
    nav._levelIndex = 1; nav._applyLevelView(); nav.render();
    const far = addressOf(8 + 0.6, 0, 0.45);                  // another region of N10
    nav._hoveredTile = navGrid.hoverTile(2, far);
    nav._dragStartX = 0; nav._dragStartY = 0;
    nav._handleClick({ clientX: 0, clientY: 0, button: 0 });
    expect(nav._anim, 'a stale REGION payload drilled at SECTOR').toBeFalsy();
    expect(nav._levelIndex).toBe(1);
  }, 60000);

  it('REGION → PRISM → ESC: PRISM is the clicked column; ESC lands on the REGION frame, not a tile', async () => {
    const { nav } = await legacyNav();
    nav._levelIndex = 2; nav._applyLevelView(); nav.render();
    const region = nav._viewStack[2];
    const P = navDrill.legacyProj(nav);
    // another prism of the player's region (two cells across), through the pointer
    const mine = navGrid.parentAt(3, 8, 0);
    const target = { ...mine, prism: { i: (mine.prism.i + 2) % 16, j: mine.prism.j } };
    const tb = boundsOf(target);
    const px = P.toX((tb.min.x + tb.max.x) / 2), py = P.toY((tb.min.z + tb.max.z) / 2);
    nav._handleMouseMove({ clientX: px, clientY: py });
    expect(key(nav._hoveredTile?.address)).toBe(key(target));
    clickAt(nav, px, py);
    landDrill(nav);
    expect(nav._levelIndex).toBe(3);
    expect(key(nav._prismColumn.address)).toBe(key(target));
    nav.render();
    for (const s of nav._localStars) {
      // no `|| s.isReal` exemption: catalogue rows are held to the column's half-open footprint too (Phase 2 fixup, Astra finding 7)
      expect(navGrid.inFootprint(tb, s.wx, s.wz), `${s.key} is outside the column`).toBe(true);
    }
    nav.handleEscape();
    expect(nav._levelIndex).toBe(2);
    expect({ c: nav._viewCenter, size: nav._viewSize }).toEqual({ c: region.center, size: region.size });
    expect(nav._viewStack[2].size, 'the REGION entry is the region, 125 pc').toBe(0.125);
  }, 60000);

  it('the player\'s sector is a grid record, and the HUD prints its grid reference', async () => {
    const { nav } = await legacyNav();
    expect(nav._currentSector).toMatchObject({ id: 'N10', name: 'N10', size: 2 });
    expect(key(nav._currentSector.address)).toBe('N10');
    nav._levelIndex = 1; nav._applyLevelView();
    const f = frame(nav);
    expect(f.text).toContain('N10');
  }, 60000);
});
