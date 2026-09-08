/**
 * navClosePass3 — AC-2's REMAINING RECTANGLES, AC-9's COUNTER, AC-5's GALAXY HALF AND AC-6's
 * INBOUND EASE, all driven through the shipped input path.
 *
 * ── ⛔ THE STANDARD EVERY CASE HERE IS HELD TO (INTERFACE.md §8e) ────────────────────────────────
 *
 * A key goes through `nav._onKeyDown`; a click goes through `_handleMouseMove` + `clickAt` (which is
 * mousedown → mouseup → click, because `_handleClick` alone reads the press as a drag from the last
 * `_dragStart` and returns); a drag goes through `_handleMouseDown` / `_handleMouseMove` /
 * `_handleMouseUp`; time goes through `_setSimClockMs`. ⛔ A test that calls a driver method and
 * asserts the driver method ran pins nothing — all 28 view-mode tests passed while the `V` key was
 * dead code, because not one of them drove the keyboard.
 *
 * ── ⭐ AND EVERY PUBLISHED FIELD IS ASKED FOUR QUESTIONS ──────────────────────────────────────────
 *
 * (1) is it published where the design draws it, (2) is it `null` in the OTHER design and at the
 * other levels after ONE `render()` — the clear is per frame — (3) does the consumer act on it, and
 * (4) does the fix, mutated, take a NAMED case down with it. A mutant that survives means the claim
 * is false as written, not that the test is weak.
 */

import { describe, it, expect } from 'vitest';
import { makeHeadlessNav, clickAt } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { SORT_KEYS } from '../navViewModes/state.js';
import { projRect, worldAt, pickBody, pickOrbitRing } from '../navViewModes/picking.js';
import { simClockMs, _setSimClockMs } from '../../core/SimClock.js';

/** ⭐ THE LAB'S OWN INK, READ OFF THE DESIGN CODE. A pinned `'#d8fbff'` here would be a second copy
 *  of a constant the lab owns and could go stale silently — the AC-4 defect shape, in a test. */
const INK = makeDesigns({ S: { design: 1, level: 3 }, D: {} }).INK;

/** A nav with the prism loaded, which is what every design needs before it can draw anything real. */
async function loadedNav({ width = 427, height = 240, mode = 'rail', level = 3 } = {}) {
  const h = await makeHeadlessNav({ width, height });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = 3;
  h.nav.viewMode = mode;
  h.nav.render();                       // populates _localStars via _renderLocal's own loader
  if (level !== 3) { h.nav._levelIndex = level; h.nav.render(); }
  h.drv = h.nav._viewDriverInst;
  return h;
}

const press = (nav, code, over = {}) =>
  nav._onKeyDown({ code, shiftKey: false, key: '', preventDefault() {}, stopPropagation() {}, ...over });

/** A system whose ladder OVERFLOWS, so `d1Ladder` draws its `N-M OF K` counter at all. */
function crowd(nav, n = 40) {
  nav._currentSystemData = { planets: [] };
  nav._systemStar = { wx: 8, wy: 0, wz: 0, seed: 5150, spectral: 'G', name: 'Crowdy' };
  nav._systemData = {
    star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
    planets: Array.from({ length: n }, (_, i) => ({
      orbitRadiusAU: 0.2 + i * 0.9, moons: [],
      planetData: { radiusEarth: 1 + (i % 5), T_eq: 250, habitability: { score: 0.1 }, rings: false },
    })),
  };
  nav._levelIndex = 4;
  nav.render();
}

/** A WIDE BINARY, which is the only condition under which `d2System` draws the companion strip. */
function wideBinary(nav) {
  nav._currentSystemData = { planets: [] };
  nav._systemStar = { wx: 8, wy: 0, wz: 0, seed: 777, spectral: 'G', name: 'Pairy' };
  nav._systemData = {
    star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
    binarySeparationAU: 500,
    planets: [1, 4, 12, 30].map((au) => ({
      orbitRadiusAU: au, moons: [],
      planetData: { radiusEarth: 2, T_eq: 200, habitability: { score: 0.1 }, rings: false },
    })),
  };
  nav._levelIndex = 4;
  nav.render();
}

/**
 * A 2D context that remembers WHICH INK each fill was made in.
 *
 * ⛔ `makeRecordingContext` CANNOT ANSWER THAT. Its Proxy's `set` trap swallows every assignment, so
 * `fillStyle` never reaches the record and every fill looks the same colour — which is fine for the
 * y-gauge's 4x1 mark, whose GEOMETRY is its signature, and useless for AC-5, where the whole claim is
 * "a frame in INK.KEY". This is the same stub with the one trap that matters kept.
 */
function inkRecorder(width, height) {
  const canvas = { width, height };
  const fills = [];
  let fillStyle = '';
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(_t, key) {
      switch (key) {
        case 'canvas': return canvas;
        case 'fillStyle': return fillStyle;
        case 'fillRect': return (x, y, w, h) => { fills.push({ x, y, w, h, ink: fillStyle }); };
        case 'measureText': return (s) => ({ width: String(s).length * 6 });
        case 'createLinearGradient':
        case 'createRadialGradient':
        case 'createPattern': return () => gradient;
        case 'getImageData':
        case 'createImageData':
          return (a, b, w, h) => (key === 'getImageData'
            ? { width: w, height: h, data: new Uint8ClampedArray(Math.max(0, w * h * 4)) }
            : { width: a, height: b, data: new Uint8ClampedArray(Math.max(0, a * b * 4)) });
        case 'isPointInPath': return () => false;
        case 'getContextAttributes': return () => ({});
        default:
          if (typeof key === 'symbol') return undefined;
          return () => {};
      }
    },
    set(_t, key, v) { if (key === 'fillStyle') fillStyle = v; return true; },
    has() { return true; },
  });
  return { ctx, fills };
}

const numAsc = (a) => a.every((v, i) => i === 0 || a[i - 1] <= v);
const localeAsc = (a) => a.every((v, i) => i === 0 || a[i - 1].localeCompare(v) <= 0);
const keyIdx = (level, id) => SORT_KEYS[level].findIndex((k) => k.id === id);

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-2 — DESIGN 1'S PAGER ROW.  It reads `- = PAGE` and has never answered a click.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("design 1's pager row is two halves", () => {
  /** A texel inside the published band, on the given side of its published midpoint. */
  const half = (r, side) => ({ x: side < 0 ? r.x0 + 2 : r.x1 - 2, y: r.y + 2 });

  it('⭐⭐ THE RIGHT HALF PAGES FORWARD AND THE LEFT HALF PAGES BACK', async () => {
    const { nav, drv } = await loadedNav();
    const r = drv.S.pagerRect;
    expect(r, 'design 1 at PRISM must publish a pager band').toBeTruthy();
    const rows = drv.S.listGeom.rows;
    expect(drv.S.listGeom.total, 'the fixture must have more stars than one page').toBeGreaterThan(rows);

    const fwd = half(r, +1);
    nav._handleMouseMove({ clientX: fwd.x, clientY: fwd.y });
    clickAt(nav, fwd.x, fwd.y);
    expect(drv.S.listOffset, 'the right half did not page forward').toBe(rows);
    nav.render();
    // ⛔ AND THE PAINT HONOURED IT. `page()` writes the intention; the design slices by it and
    //    publishes what it SLICED. A picker reading the intention would be a page from the glass.
    expect(drv.S.listGeom.offset, 'the paint did not honour the offset the pager wrote').toBe(rows);

    const back = half(r, -1);
    nav._handleMouseMove({ clientX: back.x, clientY: back.y });
    clickAt(nav, back.x, back.y);
    expect(drv.S.listOffset, 'the left half did not page back').toBe(0);
  });

  it('⛔ AND THE CLICK IS EATEN — the pager never drills the star list underneath it', async () => {
    const { nav, drv } = await loadedNav();
    const r = drv.S.pagerRect;
    const level = nav._levelIndex, sel = nav._selectedNavStar;
    const p = half(r, +1);
    nav._handleMouseMove({ clientX: p.x, clientY: p.y });
    expect(nav._hoveredLocalStar, 'the pager row resolved to a star').toBe(null);
    clickAt(nav, p.x, p.y);
    expect(nav._levelIndex, 'a page changed the level').toBe(level);
    expect(nav._selectedNavStar, 'a page selected a star').toBe(sel);
  });

  it('⛔ DESIGN 2 PUBLISHES NO PAGER, and a design-1 band does not survive one frame of it', async () => {
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    expect(drv.S.pagerRect, 'design 2 drew a rail pager it does not have').toBe(null);

    // …and the other direction: the band published by design 1 must be gone after ONE design-2 frame,
    // or a click on empty sky pages a list that is not on the glass.
    const rail = await loadedNav();
    const r = rail.drv.S.pagerRect;
    expect(r).toBeTruthy();
    rail.nav.viewMode = 'bars';
    rail.nav.render();
    expect(rail.drv.S.pagerRect, "design 1's pager outlived the design that drew it").toBe(null);
    const off = rail.drv.S.listOffset;
    clickAt(rail.nav, r.x1 - 2, r.y + 2);
    expect(rail.drv.S.listOffset, 'a stale pager band paged design 2').toBe(off);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-2 / AC-8 — DESIGN 2'S LIST HEADERS SORT THE LIST.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("design 2's column headers sort the list", () => {
  async function listNav() {
    const h = await loadedNav({ mode: 'bars' });
    h.drv.toggleList();
    h.nav.render();
    return h;
  }
  /** The centre-ish texel of the header whose published `sortId` is `id`. */
  function headerPoint(drv, id) {
    const r = (drv.S.listHeaderRects || []).find((h) => h.sortId === id);
    return r ? { x: r.x + 1, y: r.y + 2, rect: r } : null;
  }
  function clickHeader(nav, drv, id) {
    const p = headerPoint(drv, id);
    expect(p, `no header publishes sortId ${String(id)}`).toBeTruthy();
    nav._handleMouseMove({ clientX: p.x, clientY: p.y });
    clickAt(nav, p.x, p.y);
    return p;
  }

  it('⭐⭐ CLICKING `NAME` SORTS BY NAME, AND THE ROWS THE PAINT READS ARE RE-ORDERED', async () => {
    const { nav, drv } = await listNav();
    expect(drv.S.listHeaderRects, 'design 2 in list mode must publish its headers').toHaveLength(6);
    clickHeader(nav, drv, 'name');
    expect(drv.S.sortIdx).toBe(keyIdx(3, 'name'));
    expect(drv.S.sortLabel).toBe('NAME');
    nav.render();
    expect(localeAsc(drv.D.starRows.map((s) => String(s.name || ''))),
      'the key moved and the list did not').toBe(true);
  });

  it('⭐ `PC` SORTS BY DISTANCE AND `PLANE` BY THE COLUMN IT PRINTS', async () => {
    const { nav, drv } = await listNav();
    clickHeader(nav, drv, 'name');            // move it off DIST first, or PC proves nothing
    expect(drv.S.sortIdx).not.toBe(keyIdx(3, 'dist'));
    clickHeader(nav, drv, 'dist');
    expect(drv.S.sortIdx).toBe(keyIdx(3, 'dist'));
    nav.render();
    expect(numAsc(drv.D.starRows.map((s) => s.dist ?? Infinity)), 'PC did not sort by distance').toBe(true);

    clickHeader(nav, drv, 'plane');
    expect(drv.S.sortIdx).toBe(keyIdx(3, 'plane'));
    expect(drv.S.sortLabel).toBe('PLANE');
    nav.render();
    // the column prints `(wy - player.y) * 1000`; the offset is constant, so `wy` ascending IS the
    // printed column ascending — which is the whole reason the comparator may read the raw field.
    expect(numAsc(drv.D.starRows.map((s) => s.wy ?? 0)), 'PLANE did not sort by the plane offset').toBe(true);
  });

  it('⛔ `N` IS EATEN AND DOES NOTHING — the row ordinal has no key and none was invented', async () => {
    const { nav, drv } = await listNav();
    clickHeader(nav, drv, 'name');
    press(nav, 'Equal'); nav.render();        // page off the top, so "nothing happens" can be seen
    const idx = drv.S.sortIdx, label = drv.S.sortLabel, off = drv.S.listOffset;
    expect(off, 'the fixture must be paged for the offset assertion to say anything').toBeGreaterThan(0);
    const sel = nav._selectedNavStar;
    clickHeader(nav, drv, null);              // the `N` header, published with sortId: null
    nav.render();
    expect(drv.S.sortIdx, 'N moved the sort key').toBe(idx);
    expect(drv.S.sortLabel).toBe(label);
    expect(drv.S.listOffset, 'N reset the page, which is what `sortTo` does when it FIRES').toBe(off);
    // ⚠ THE ROW ORDER IS ASSERTED AS A PROPERTY, NOT AS A LIST OF SEEDS. The prism's background
    //   loader grows `_localStars` between frames, so the ranked rows legitimately gain entries; what
    //   must not change is WHICH KEY they are in.
    expect(localeAsc(drv.D.starRows.map((s) => String(s.name || ''))),
      'N re-ordered the list under a key it does not own').toBe(true);
    expect(nav._selectedNavStar, 'a header click selected a star').toBe(sel);
  });

  it('⛔ NO HEADER CLICK EVER SELECTS A STAR — the band eats the click it answers', async () => {
    const { nav, drv } = await listNav();
    const sel = nav._selectedNavStar, level = nav._levelIndex;
    for (const id of ['name', 'class', 'dist', 'plane', 'catalog']) clickHeader(nav, drv, id);
    expect(nav._selectedNavStar, 'a header drilled the list under it').toBe(sel);
    expect(nav._levelIndex).toBe(level);
  });

  it('⛔ IN MAP MODE THERE ARE NO HEADERS — the field is null after one frame', async () => {
    const { nav, drv } = await listNav();
    expect(drv.S.listHeaderRects).toHaveLength(6);
    const r = drv.S.listHeaderRects.find((h) => h.sortId === 'name');
    drv.toggleList();                          // back to the map
    nav.render();
    expect(drv.S.listHeaderRects, 'a list header outlived the list').toBe(null);
    const before = drv.S.sortIdx;
    clickAt(nav, r.x + 1, r.y + 2);
    expect(drv.S.sortIdx, 'a stale header sorted from a picture that draws none').toBe(before);
  });

  it('⭐ AND `[` / `]` STILL WALK EVERY LEVEL-3 KEY, with DIST still first', async () => {
    // The two new keys go AFTER the existing four (INTERFACE §8a), so the default order — the
    // picture Max ruled on — and the key the first press lands on are both unchanged.
    const { nav, drv } = await loadedNav();
    const keys = SORT_KEYS[3];
    expect(keys.map((k) => k.id)).toEqual(['dist', 'name', 'class', 'mult', 'plane', 'catalog']);
    expect(drv.S.sortIdx, 'PRISM must open on its first key').toBe(0);
    expect(drv.S.sortLabel).toBe('DIST');
    const walked = [];
    for (let i = 0; i < keys.length; i++) { press(nav, 'BracketRight'); nav.render(); walked.push(drv.S.sortLabel); }
    expect(walked, 'the bracket keys skipped a key the headers can reach')
      .toEqual([...keys.slice(1), keys[0]].map((k) => k.label));
    expect(drv.S.sortIdx, 'the walk did not come back round').toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-2 — DESIGN 2'S `HERE · SECTOR` LOCATOR RE-CENTRES ON THE PLAYER (INTERFACE §8b).
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("design 2's locator centres the frame on the player", () => {
  const locPoint = (drv) => ({ x: drv.S.locatorRect.x + 2, y: drv.S.locatorRect.y + 2 });

  it('⭐⭐ AT GALAXY IT EASES THE FRAME ONTO THE PLAYER — and the ease actually lands', async () => {
    const { nav, drv } = await loadedNav({ mode: 'bars', level: 0 });
    const t0 = simClockMs();
    try {
      nav._viewCenter = { x: 17, z: -13 };     // panned well off the player
      nav.render();
      const r = drv.S.locatorRect;
      expect(r, 'design 2 must publish its locator at every level').toBeTruthy();
      const p = locPoint(drv);
      nav._handleMouseMove({ clientX: p.x, clientY: p.y });
      clickAt(nav, p.x, p.y);
      expect(nav._viewEase, 'the locator armed no ease').toBeTruthy();
      expect(nav._anim, 'it must not arm `_anim` — that eats the next click and changes level').toBeFalsy();
      expect(nav._viewEase.toCenter).toEqual({ x: nav._playerX, z: nav._playerZ });
      _setSimClockMs(t0 + 400);
      nav.render();
      expect(nav._viewCenter.x, 'the frame never arrived on the player').toBeCloseTo(nav._playerX, 9);
      expect(nav._viewCenter.z).toBeCloseTo(nav._playerZ, 9);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it("⭐ AT SECTOR IT REBUILDS THE STACK AND EASES ONTO THE PLAYER'S OWN SECTOR", async () => {
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    const t0 = simClockMs();
    try {
      nav._levelIndex = 1;
      nav._viewStack[1] = { center: { x: 20, z: -15 }, size: 2, sectorName: 'FOREIGN' };
      nav._applyLevelView();
      nav.render();
      expect(nav._viewCenter).toEqual({ x: 20, z: -15 });
      const p = locPoint(drv);
      nav._handleMouseMove({ clientX: p.x, clientY: p.y });
      clickAt(nav, p.x, p.y);
      const home = { ...nav._viewStack[1].center };
      expect(home, 'the stack was not rebuilt from the player').not.toEqual({ x: 20, z: -15 });
      expect(nav._viewEase, 'the frame cut instead of easing').toBeTruthy();
      _setSimClockMs(t0 + 400);
      nav.render();
      expect(nav._viewCenter.x).toBeCloseTo(home.x, 9);
      expect(nav._viewCenter.z).toBeCloseTo(home.z, 9);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it("⭐ AT PRISM IT PUTS THE LOADER'S BLOCK BACK ON THE PLAYER", async () => {
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    nav._localCenter = { x: 20, y: 1, z: -15 };
    nav.render();
    const p = locPoint(drv);
    nav._handleMouseMove({ clientX: p.x, clientY: p.y });
    clickAt(nav, p.x, p.y);
    expect(nav._localCenter).toEqual({ x: nav._playerX, y: nav._playerY, z: nav._playerZ });
    expect(nav._localStars, 'the prism kept the block it was loaded for').toHaveLength(0);
  });

  it('⛔ AT SYSTEM IT IS NOT EATEN AND CHANGES NOTHING — §8b leaves that one to Max', async () => {
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    wideBinary(nav);
    const p = locPoint(drv);
    const centre = { ...nav._localCenter };
    // ⛔ THE RETURN VALUE IS THE OBSERVABLE: `null` is "the mode ate it" and a point is "the handler
    //    carries on". At every other level this band answers `null`.
    expect(drv.remapClick({ x: p.x, y: p.y }, nav._canvas.width, nav._canvas.height),
      'SYSTEM ate the locator click').not.toBe(null);
    nav._handleMouseMove({ clientX: p.x, clientY: p.y });
    clickAt(nav, p.x, p.y);
    expect(nav._viewEase, 'SYSTEM armed a re-centre nobody agreed').toBeFalsy();
    expect(nav._localCenter).toEqual(centre);
  });

  it('⛔ DESIGN 1 PUBLISHES NO LOCATOR, and a design-2 band does not survive one frame of it', async () => {
    const { nav, drv } = await loadedNav();
    expect(drv.S.locatorRect, 'design 1 drew a topbar locator it does not have').toBe(null);

    const bars = await loadedNav({ mode: 'bars' });
    const r = bars.drv.S.locatorRect;
    bars.nav.viewMode = 'rail';
    bars.nav.render();
    expect(bars.drv.S.locatorRect, "design 2's locator outlived the design that drew it").toBe(null);
    const lc = { ...bars.nav._localCenter };
    clickAt(bars.nav, r.x + 2, r.y + 2);
    expect(bars.nav._localCenter, 'a stale locator re-centred design 1').toEqual(lc);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-2 — THE TWO READOUTS THAT EAT A CLICK AND DO NOTHING (the plate rule, INTERFACE §6).
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the minimap and the companion strip take the press off what is under them', () => {
  it("⭐⭐ A PRESS ON DESIGN 2'S MINIMAP SELECTS NO STAR, even with a mark inside it", async () => {
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    const r = drv.S.minimapRect;
    expect(r, 'design 2 at PRISM in map mode must publish its corner widget').toBeTruthy();
    const inside = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
    const outside = { x: r.x - 6, y: inside.y };
    // ⛔ BUILT, NOT FOUND. "A star mark happens to lie under the widget" is a real arrangement and not
    //    one this seed reliably supplies, and without a mark there the rectangle proves nothing —
    //    the click would have resolved to nothing anyway. Two marks: one under the widget, one six
    //    texels clear of it, which is the CONTROL that gives the band an edge.
    const star = nav._localStars[0];
    drv.S.prismHits.push({ x: inside.x, y: inside.y, r: 4, ref: star });
    drv.S.prismHits.push({ x: outside.x, y: outside.y, r: 4, ref: star });

    nav._handleMouseMove({ clientX: inside.x, clientY: inside.y });
    expect(nav._hoveredLocalStar, 'the fixture put no star under the widget — the case is vacuous')
      .toBeTruthy();
    nav._selectedNavStar = null;
    clickAt(nav, inside.x, inside.y);
    expect(nav._selectedNavStar, 'the widget let the press through to the star beneath it').toBe(null);

    // ⭐ THE CONTROL: the same mark six texels outside the band still selects, so what stopped the
    //    click above was the rectangle and not the absence of anything to click.
    nav._handleMouseMove({ clientX: outside.x, clientY: outside.y });
    clickAt(nav, outside.x, outside.y);
    expect(nav._selectedNavStar, 'the band has no edge — nothing near the widget can be clicked')
      .toBeTruthy();
  });

  it('⛔ THE MINIMAP IS MAP MODE ONLY — list mode publishes none', async () => {
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    expect(drv.S.minimapRect).toBeTruthy();
    drv.toggleList();
    nav.render();
    expect(drv.S.minimapRect, 'a widget that is not on the glass answered anyway').toBe(null);
  });

  it("⭐⭐ A PRESS ON THE `» STAR B` STRIP SELECTS NOTHING, even with a ring under it", async () => {
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    wideBinary(nav);
    const r = drv.S.companionRect;
    expect(r, 'a 500 AU binary must draw and publish the companion strip').toBeTruthy();
    const inside = { x: r.x + 2, y: r.y + 2 };
    // ⛔ BUILT IF THE SEED DID NOT SUPPLY IT — the strip is drawn ACROSS the outer rings, which is the
    //    arrangement the rectangle exists for, but which ring passes under which texel is the
    //    orrery's business. If no ring is already there, one is put there.
    if (!pickOrbitRing(drv.S, inside.x, inside.y)) {
      const ref = (drv.D.bodies || []).find((b) => b.kind === 'planet');
      drv.S.orbitRings = [...(drv.S.orbitRings || []),
                          { cx: inside.x, cy: inside.y + 30, rx: 30, ry: 30, ref }];
    }
    expect(pickBody(nav, drv.S, inside.x, inside.y, drv.regions().map),
      'nothing lies under the strip — the case is vacuous').toBeTruthy();
    nav._selectedBody = null;
    nav._handleMouseMove({ clientX: inside.x, clientY: inside.y });
    clickAt(nav, inside.x, inside.y);
    expect(nav._selectedBody, 'the strip let the press through to the ring beneath it').toBe(null);
  });

  it('⛔ AND NEITHER BAND OUTLIVES ITS PICTURE — design 1 at SYSTEM publishes no companion', async () => {
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    wideBinary(nav);
    expect(drv.S.companionRect).toBeTruthy();
    nav.viewMode = 'rail';
    nav.render();
    expect(drv.S.companionRect, 'the strip outlived the design that drew it').toBe(null);
    expect(drv.S.minimapRect, "design 1 published design 2's widget").toBe(null);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-9 — SYSTEM'S LADDER COUNTER IS A SCRUBBER (INTERFACE §8c, DRIVER half).
// ⛔ THE HOST'S THREE FOLDS ARE PINNED IN navKeys.test.js, NOT HERE.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("design 1's SYSTEM ladder counter is a handle", () => {
  it('⭐⭐ THE GRAB BAND IS THE READOUT, WITH ONE TEXEL OF SKIRT, AND IT HAS AN EDGE', async () => {
    const { nav, drv } = await loadedNav();
    crowd(nav, 40);
    const r = drv.S.ladderCounterRect;
    expect(r, 'an overflowing ladder must publish its counter').toBeTruthy();
    expect(drv.S.ladderMax, 'the fixture must actually overflow').toBeGreaterThan(0);
    expect(drv.counterGrab(r.x + 2, r.y + 2), 'the readout is not grabbable').toBe(true);
    expect(drv.counterGrab(r.x - 1, r.y + 2), 'the skirt is missing on the left').toBe(true);
    expect(drv.counterGrab(r.x - 2, r.y + 2), 'the band has no left edge').toBe(false);
    expect(drv.counterGrab(r.x + r.w + 1, r.y + 2), 'the band has no right edge').toBe(false);
    expect(drv.counterGrab(r.x + 2, r.y - 1), 'the band has no top edge').toBe(false);
    expect(drv.counterGrab(r.x + 2, r.y + r.h), 'the band has no bottom edge').toBe(false);
  });

  it('⭐ IT SCRUBS THE WHOLE RANGE IN TEXELS, MONOTONICALLY, CLAMPED AT BOTH ENDS', async () => {
    const { nav, drv } = await loadedNav();
    crowd(nav, 40);
    const r = drv.S.ladderCounterRect, max = drv.S.ladderMax;
    expect(drv.counterDragTo(r.x), 'the left end is not the top of the ladder').toBe(0);
    expect(drv.counterDragTo(r.x + r.w), 'the right end is not the bottom of it').toBe(max);
    // ⛔ TEXELS, NOT A FRACTION: `ladderScroll` is a continuous texel offset the paint subtracts raw.
    expect(drv.counterDragTo(r.x + r.w / 2)).toBe(Math.round(max / 2));
    const walk = [];
    for (let i = 0; i <= 10; i++) walk.push(drv.counterDragTo(r.x + (r.w * i) / 10));
    expect(numAsc(walk), `not monotonic: ${walk.join(',')}`).toBe(true);
    expect(drv.counterDragTo(r.x - 40), 'a pointer left of the band did not peg').toBe(0);
    expect(drv.counterDragTo(r.x + r.w + 40), 'a pointer right of the band did not peg').toBe(max);
  });

  it('⛔ A LADDER WITH NOTHING TO SCROLL PUBLISHES NO COUNTER, AND THE DRIVER SAYS SO', async () => {
    // The readout is drawn only when `maxScroll > 0`, and the driver must treat a missing field as
    // "no" rather than as zero — a scrubber for a range that does not exist is grabbable and inert.
    //
    // ⚠ MEASURED, AND IT IS NOT WHAT THE FIELD'S NAME IMPLIES: `d1Ladder`'s virtual axis puts the
    //   furthest body at `winW - 4` and then adds 8, so `maxScroll` is EXACTLY 4 on every system with
    //   at least one body — one planet or forty. The only system whose ladder truly fits is the EMPTY
    //   one, which is what this drives. Logged for the coordinator rather than papered over: whether
    //   a 4-texel window deserves a counter at all is the lab's arithmetic, not the driver's.
    const { nav, drv } = await loadedNav();
    nav._currentSystemData = { planets: [] };
    nav._systemStar = { wx: 8, wy: 0, wz: 0, seed: 99, spectral: 'M', name: 'Barren' };
    nav._systemData = { star: { type: 'M' }, zones: {}, asteroidBelts: [], planets: [] };
    nav._levelIndex = 4;
    nav.render();
    expect(drv.D.bodies, 'the fixture must actually be an empty system').toHaveLength(0);
    expect(drv.S.ladderMax, 'an empty ladder has nothing to scroll').toBe(0);
    expect(drv.S.ladderCounterRect, 'a ladder with no window drew a window counter').toBe(null);
    expect(drv.counterGrab(200, 160), 'a missing counter was grabbable').toBe(false);
    expect(drv.counterDragTo(200), 'a missing counter answered a drag').toBe(null);
  });

  it('⛔ DESIGN 2 PUBLISHES NO COUNTER — its SYSTEM is an orrery, not a ladder', async () => {
    const { nav, drv } = await loadedNav();
    crowd(nav, 40);
    expect(drv.S.ladderCounterRect).toBeTruthy();
    nav.viewMode = 'bars';
    nav.render();
    expect(drv.S.ladderCounterRect, 'a ladder counter outlived the ladder').toBe(null);
    expect(drv.counterGrab(200, 160)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-5 — THE GALAXY HIGHLIGHT IS THE PICKED SECTOR, NOT THE CELL UNDER THE CURSOR.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('a GALAXY click highlights the SECTOR it is about to drill', () => {
  /** The frame `d1TwoD` / `d2TwoD` must draw, through the projection THIS design published. */
  function expectedFrame(p, sec) {
    const r = projRect(p);
    const toX = (x) => (p.kind === 'wide' ? p.ox + (x - p.cx) / p.kpc
                                          : r.x + ((x - p.cx) / p.size + 0.5) * r.w);
    const toY = (z) => (p.kind === 'wide' ? p.oy + (z - p.cz) / p.kpc
                                          : r.y + ((z - p.cz) / p.size + 0.5) * r.h);
    const x0 = Math.max(r.x, Math.round(toX(sec.centerX - sec.size / 2)));
    const y0 = Math.max(r.y, Math.round(toY(sec.centerZ - sec.size / 2)));
    const x1 = Math.min(r.x + r.w, Math.round(toX(sec.centerX + sec.size / 2)));
    const y1 = Math.min(r.y + r.h, Math.round(toY(sec.centerZ + sec.size / 2)));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  for (const mode of ['rail', 'bars']) {
    it(`⭐⭐ ${mode}: the click records the SECTOR and the design frames it in INK.KEY`, async () => {
      const { nav, drv } = await loadedNav({ mode, level: 0 });
      const p = drv.S.mapProj;
      expect(p?.level, `${mode} must publish a level-0 projection`).toBe(0);
      const r = projRect(p);
      const x = r.x + r.w * 0.34, y = r.y + r.h * 0.55;
      const { wx, wz } = worldAt(p, x, y);
      const expected = nav._sectors.getSectorAt({ x: wx, z: wz });
      expect(expected, 'the fixture point must be inside the disc').toBeTruthy();

      expect(drv.S.pick, 'nothing is highlighted before a click').toBe(null);
      nav._handleMouseMove({ clientX: x, clientY: y });
      clickAt(nav, x, y);
      // ⛔ THE IDENTITY IS `pickSector`'s, WHICH IS THE SAME CALL THE DRILL CONSUMED — so what lights
      //    up and where the zoom is going cannot come apart.
      expect(drv.S.pick?.level, 'a GALAXY click recorded no highlight').toBe(0);
      expect(drv.S.pick.sector).toEqual({ centerX: expected.centerX, centerZ: expected.centerZ,
                                          size: expected.size, name: expected.name });
      expect(nav._viewStack[1].center, 'the drill went somewhere else')
        .toEqual({ x: expected.centerX, z: expected.centerZ });

      // …and the design DRAWS it, in the lab's own key ink, on the sector's own rectangle.
      const { ctx, fills } = inkRecorder(nav._canvas.width, nav._canvas.height);
      drv.render(ctx, nav._canvas.width, nav._canvas.height);
      const want = expectedFrame(drv.S.mapProj, drv.S.pick.sector);
      expect(want.w, 'the picked sector is cropped off this design entirely').toBeGreaterThan(0);
      const key = fills.filter((f) => f.ink === INK.KEY);
      const has = (q) => key.some((f) => f.x === q.x && f.y === q.y && f.w === q.w && f.h === q.h);
      expect(has({ x: want.x, y: want.y, w: want.w, h: 1 }),
        `no INK.KEY top edge at ${JSON.stringify(want)}; got ${JSON.stringify(key.slice(0, 6))}`).toBe(true);
      expect(has({ x: want.x, y: want.y + want.h - 1, w: want.w, h: 1 }), 'no INK.KEY bottom edge').toBe(true);
    }, 60000);
  }

  it('⛔ AND IT GOES OUT WHEN THE DRILL LANDS — the level change is the clear', async () => {
    const { nav, drv } = await loadedNav({ level: 0 });
    const p = drv.S.mapProj, r = projRect(p);
    const x = r.x + r.w * 0.34, y = r.y + r.h * 0.55;
    nav._handleMouseMove({ clientX: x, clientY: y });
    clickAt(nav, x, y);
    expect(drv.S.pick?.level).toBe(0);
    nav.render();
    expect(drv.S.pick, 'the highlight did not survive a frame of the zoom').toBeTruthy();
    nav._levelIndex = 1;                       // exactly what `_updateAnim` does when the drill lands
    nav.render();
    expect(drv.S.pick, 'the highlight outlived the arrival it was acknowledging').toBe(null);
  }, 60000);

  it('⛔ A DRAG ACROSS THE GALAXY LIGHTS NOTHING — a pan is not a pick', async () => {
    const { nav, drv } = await loadedNav({ level: 0 });
    const r = projRect(drv.S.mapProj);
    const x = r.x + r.w * 0.34, y = r.y + r.h * 0.55;
    nav._handleMouseDown({ clientX: x - 40, clientY: y - 40, button: 0 });
    nav._handleMouseMove({ clientX: x, clientY: y });
    nav._handleMouseUp();
    nav._handleClick({ clientX: x, clientY: y, button: 0 });
    expect(drv.S.pick, 'a pan across the map lit a sector it never drilled').toBe(null);
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-6 — THE INBOUND EASE.  Tabbing INTO PRISM or SYSTEM used to snap (INTERFACE §8d).
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-6 — tabbing INTO PRISM/SYSTEM closes the frame instead of cutting', () => {
  /** A nav at REGION with a real 2D frame under it. */
  async function atRegion(mode = 'rail') {
    const h = await loadedNav({ mode });
    h.nav._setupViewStackForPlayer();
    h.nav._levelIndex = 2;
    h.nav._applyLevelView();
    h.nav.render();
    return h;
  }

  it('⭐⭐ REGION → PRISM: THE LEVEL MOVES AT ONCE, THE PICTURE DOES NOT', async () => {
    const { nav, drv } = await atRegion();
    const t0 = simClockMs();
    try {
      _setSimClockMs(t0);
      const fromSize = drv.S.view.size;
      press(nav, 'Tab');
      // ⛔ THE INDEX IS NOT DEFERRED. Four suites read `_levelIndex` on the statement after the press;
      //    the animation lives in what the DESIGN is told, never in the instrument.
      expect(nav._levelIndex, 'the level must still move synchronously').toBe(3);
      nav.render();
      expect(drv.S.level, 'the design jumped to PRISM instead of easing into it').toBe(2);
      expect(drv.S.levelLag?.kind).toBe('map');

      const samples = [];
      for (const dt of [1, 90, 180, 260]) { _setSimClockMs(t0 + dt); nav.render(); samples.push(drv.S.view.size); }
      expect(samples.every((v, i) => i === 0 || v < samples[i - 1]),
        `the frame did not close: ${samples.join(' > ')}`).toBe(true);
      expect(samples[0]).toBeLessThanOrEqual(fromSize);
      // the mirror of `:4476`'s outbound `fromSize`: one tile of the level being left, halved
      expect(samples[samples.length - 1]).toBeGreaterThan(fromSize / (16 * 2));

      _setSimClockMs(t0 + 400);
      nav.render();
      expect(drv.S.level, 'the ease never landed').toBe(3);
      expect(drv.S.levelLag, 'a finished lag must clear itself or it holds the level forever').toBe(null);
      expect(drv.S.view.size, 'the frame is not read off the instrument again').toBe(nav._viewSize);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it('⛔ AND WHILE IT RUNS, A CLICK IS EATEN AND THE HOVER IS NULL', async () => {
    const { nav, drv } = await atRegion();
    const t0 = simClockMs();
    try {
      _setSimClockMs(t0);
      press(nav, 'Tab');
      nav.render();
      expect(drv.S.levelLag).toBeTruthy();
      _setSimClockMs(t0 + 150);
      nav.render();
      const r = projRect(drv.S.mapProj);
      const x = r.x + r.w / 2, y = r.y + r.h / 2;
      nav._handleMouseMove({ clientX: x, clientY: y });
      expect(nav._hoveredTile, 'a target the pilot can see for 350 ms and cannot act on').toBe(null);
      expect(drv.remapClick({ x, y }, nav._canvas.width, nav._canvas.height),
        'a click landed on a screen that is on its way off the glass').toBe(null);
      clickAt(nav, x, y);
      expect(nav._anim, 'the eaten click drilled anyway').toBeFalsy();
      expect(nav._levelIndex, 'the eaten click changed level').toBe(3);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it('⭐ BUT A SECOND TAB DURING THE EASE IS NOT SWALLOWED — it cancels the ease and moves on', async () => {
    // Measured on the first build: `tabLevel` synthesises its click through `remapClick`, so the
    // lag's "eat every click" guard ate the Tab too, and a quick double-Tab from REGION moved ONE
    // level instead of two — a key that does nothing where the hint row says TAB LEVEL. The strip
    // is the pilot changing level again; §8d says any other level change cancels a lag, and it does.
    const { nav, drv } = await atRegion();
    const t0 = simClockMs();
    try {
      // ⚠ THE HARNESS'S DEFAULT IS THE NO-SYSTEM STATE (part-3 trap 13), in which a Tab from PRISM
      //   skips the disabled SYSTEM and lands on GALAXY — which is not swallowed either, but it is not
      //   the 3 → 4 pair this case is about. Same fixture as the PRISM → SYSTEM case above.
      nav._currentSystemData = { planets: [] };
      nav._systemStar = { wx: 8.02, wy: 0.001, wz: 0.002, seed: 4242, spectral: 'G', name: 'Target' };
      nav._systemData = { star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 },
                          asteroidBelts: [], planets: [{ orbitRadiusAU: 1, moons: [],
                            planetData: { radiusEarth: 1, T_eq: 280, habitability: { score: 0.5 }, rings: false } }] };
      nav.render();
      _setSimClockMs(t0);
      press(nav, 'Tab');
      nav.render();
      expect(drv.S.levelLag?.kind, 'the first Tab must start the map ease for this case to mean anything').toBe('map');
      _setSimClockMs(t0 + 120);
      nav.render();
      press(nav, 'Tab');
      expect(nav._levelIndex, 'the second Tab was swallowed by the ease').toBe(4);
      nav.render();
      // the REGION picture is gone: the cancelled map ease is replaced by the PRISM → SYSTEM one,
      // which holds the prism (3) while the camera zooms — never the region (2) the first ease held
      expect(drv.S.level, 'the design is still holding the picture the first Tab left').toBe(3);
      expect(drv.S.levelLag?.kind).toBe('prism');
      expect(drv.S.levelLag?.to).toBe(4);
      _setSimClockMs(t0 + 120 + 400);
      nav.render();
      expect(drv.S.level, 'the second ease never landed').toBe(4);
      expect(drv.S.levelLag).toBe(null);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it('⭐ PRISM → SYSTEM: the prism is held while the camera zooms into the star', async () => {
    const { nav, drv } = await loadedNav();
    const t0 = simClockMs();
    try {
      nav._currentSystemData = { planets: [] };
      nav._systemStar = { wx: 8.02, wy: 0.001, wz: 0.002, seed: 4242, spectral: 'G', name: 'Target' };
      nav._systemData = { star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 },
                          asteroidBelts: [], planets: [{ orbitRadiusAU: 1, moons: [],
                            planetData: { radiusEarth: 1, T_eq: 280, habitability: { score: 0.5 }, rings: false } }] };
      nav.render();
      _setSimClockMs(t0);
      const r0 = drv.S.cam.radius;
      press(nav, 'Tab');
      expect(nav._levelIndex).toBe(4);
      nav.render();
      expect(drv.S.level, 'the orrery cut in instead of the prism zooming into it').toBe(3);
      expect(drv.S.levelLag?.kind).toBe('prism');
      const radii = [];
      for (const dt of [1, 120, 240]) { _setSimClockMs(t0 + dt); nav.render(); radii.push(drv.S.cam.radius); }
      expect(radii.every((v, i) => i === 0 || v < radii[i - 1]), `the camera did not close: ${radii.join(' > ')}`).toBe(true);
      expect(radii[radii.length - 1]).toBeGreaterThan(r0 * 0.1);
      _setSimClockMs(t0 + 400);
      nav.render();
      expect(drv.S.level).toBe(4);
      expect(drv.S.levelLag).toBe(null);
      expect(drv.S.cam.radius, 'the camera is not read off the instrument again').toBe(nav._localRadius);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it('⛔ NEGATIVE CONTROL: assigning `_levelIndex` directly never lags', async () => {
    // Every existing suite moves the level this way. An ease armed by the FIELD rather than by the
    // driver's own tab paths would hold `S.level` behind four other suites' assertions.
    const { nav, drv } = await atRegion();
    nav._levelIndex = 3;
    nav.render();
    expect(drv.S.levelLag, 'a bare assignment armed an animation').toBe(null);
    expect(drv.S.level).toBe(3);
  }, 60000);

  it('⛔ NEGATIVE CONTROL: a drill click carries its own animation and must not be lagged', async () => {
    // `_startDrillAnim` already moves `_viewCenter`/`_viewSize`, which is exactly what a map lag
    // would be interpolating. Two writers on one field is a fight, not an animation — `:1419` yields
    // to `_anim` for the same reason.
    const { nav, drv } = await atRegion();
    const r = projRect(drv.S.mapProj);
    const x = r.x + r.w * 0.3, y = r.y + r.h * 0.3;
    nav._handleMouseMove({ clientX: x, clientY: y });
    expect(nav._hoveredTile, 'the fixture point must be on a tile').toBeTruthy();
    clickAt(nav, x, y);
    expect(nav._anim, 'the drill did not start — the case is vacuous').toBeTruthy();
    nav.render();
    expect(drv.S.levelLag, 'the drill was lagged on top of its own animation').toBe(null);
    expect(drv.S.level).toBe(2);
  }, 60000);

  it('⛔ AND A TAB THAT IS NOT INTO 3 OR 4 IS UNCHANGED — those already animate', async () => {
    const { nav, drv } = await loadedNav();
    const t0 = simClockMs();
    try {
      _setSimClockMs(t0);
      press(nav, 'Tab', { shiftKey: true });         // PRISM -> REGION, the OUTBOUND half (`:4476`)
      expect(nav._levelIndex).toBe(2);
      nav.render();
      expect(drv.S.levelLag, '3 -> 2 was lagged as well as eased — two animations, one transition').toBe(null);
      expect(drv.S.level).toBe(2);
      expect(nav._viewEase, "the host's own outbound ease was displaced").toBeTruthy();
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it('⭐ A HELD LEVEL DOES NOT MISFIRE THE CLICK-HIGHLIGHT — it holds, then clears on arrival', async () => {
    // `agePick` tests `S.level`, which is the HELD level while a lag runs. So a highlight taken at the
    // level being left stays lit for the whole transition — the same behaviour a drill already has,
    // where `_updateAnim` holds `_levelIndex` until the zoom lands — and goes out on the frame the
    // new level appears. ⛔ WITHOUT THE HOLD it would clear on the first frame after the press, which
    // is the opposite of Max's *"highlight it, THEN zoom into it"*.
    const { nav, drv } = await atRegion();
    const t0 = simClockMs();
    try {
      _setSimClockMs(t0);
      const r = projRect(drv.S.mapProj);
      const x = r.x + r.w * 0.3, y = r.y + r.h * 0.3;
      // ⛔ ARM A HIGHLIGHT WITHOUT DRILLING, AND THE PRESS IS PART OF THE FIXTURE. `notePick` runs
      //    the handler's own `dx*dx + dy*dy > 25` drag test against `_dragStartX/Y`, which the
      //    constructor leaves at 0 — so without a real mousedown at the point the pick is correctly
      //    REJECTED as a pan. The full `clickAt` is deliberately not used: it would drill, and a
      //    drill carries `_anim`, which is exactly what must not be lagged.
      nav._handleMouseDown({ clientX: x, clientY: y, button: 0 });
      nav._handleMouseUp();
      drv.remapClick({ x, y }, nav._canvas.width, nav._canvas.height);
      expect(drv.S.pick?.level, 'the fixture recorded no highlight').toBe(2);
      press(nav, 'Tab');
      nav.render();
      expect(drv.S.level).toBe(2);
      expect(drv.S.pick, 'the highlight went out the moment the transition began').toBeTruthy();
      _setSimClockMs(t0 + 400);
      nav.render();
      expect(drv.S.level).toBe(3);
      expect(drv.S.pick, 'the highlight outlived the level it belonged to').toBe(null);
    } finally { _setSimClockMs(t0); }
  }, 60000);
});
