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
import { projRect, worldAt, pickBody, pickOrbitRing, pickSector, gridNFallback } from '../navViewModes/picking.js';
import { simClockMs, _setSimClockMs } from '../../core/SimClock.js';
/** ⛔ THE HOST'S OWN PAN SCALE, IMPORTED. `_handleMouseMove`'s 2D branch converts texels to kpc with
 *  `_viewSize / navMapSize(w, h)`; a test restating that ratio would be a second copy of the
 *  production layout and would go stale silently. Only the DRAG in the design-1 clip case needs it. */
import { navMapSize } from '../navLayout.js';

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

/**
 * A THREE-BODY SYSTEM WHOSE LADDER FITS — the AC-11 exception, recorded in INTERFACE §8f.
 *
 * ⛔ THE EMPTY SYSTEM IS NOT THE CASE THIS IS FOR. Before the lab's `+8 → +4` correction the virtual
 * axis padded past the furthest body, so `maxScroll` was EXACTLY 4 on every system with any body at
 * all and only a system with NO bodies fitted — which made "a ladder with nothing to scroll" a test
 * about an empty picture rather than about a ladder. Three planets at 1, 8 and 30 AU is a REAL system
 * whose stops end inside the window (measured at 427x240: `maxScroll` 0, three bodies drawn).
 */
function threeBody(nav) {
  nav._currentSystemData = { planets: [] };
  nav._systemStar = { wx: 8, wy: 0, wz: 0, seed: 3003, spectral: 'K', name: 'Triple' };
  nav._systemData = {
    star: { type: 'K' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
    planets: [1, 8, 30].map((au) => ({
      orbitRadiusAU: au, moons: [],
      planetData: { radiusEarth: 2, T_eq: 250, habitability: { score: 0.1 }, rings: false },
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

/**
 * A nav at GALAXY **on the entry frame**, which since 2026-09-08 is a thing a fixture has to ASK FOR.
 *
 * ⛔ `levelView(0)` NOW READS `S.view` (INTERFACE §8f), so the GALAXY picture follows
 * `nav._viewCenter` / `_viewSize` exactly as levels 1-2 always have. `loadedNav` builds its nav at
 * PRISM and then assigns `_levelIndex`, which never touches the view — so it arrives at GALAXY on
 * whatever frame the constructor left (`{ x: 8, z: 0 }`, measured), not on the `{ 0, 0, 44 }` the
 * running game enters with. `_setupViewStackForPlayer` + `_applyLevelView` is the pair the game runs
 * on every entry (`:1196`, `:1227`); calling it here is what makes the fixture the entry picture.
 */
async function galaxyNav(mode = 'rail') {
  const h = await loadedNav({ mode, level: 0 });
  h.nav._setupViewStackForPlayer();
  h.nav._applyLevelView();
  h.nav.render();
  return h;
}

/**
 * Commit a map click at `(x, y)` WITHOUT drilling it.
 *
 * ⛔ THE PRESS IS PART OF THE FIXTURE, NOT DECORATION. `notePick` runs the handler's own
 * `dx*dx + dy*dy > 25` drag test against `_dragStartX/Y`, which the constructor leaves at 0 — so
 * without a real mousedown at the point the pick is correctly REJECTED as a pan. And `_handleClick`
 * is deliberately not called: it would drill, and a drill moves the frame this is about to measure.
 */
function armPick(nav, drv, x, y) {
  nav._handleMouseDown({ clientX: x, clientY: y, button: 0 });
  nav._handleMouseUp();
  return drv.remapClick({ x, y }, nav._canvas.width, nav._canvas.height);
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
  }, 60000);

  it('⛔ AND THE CLICK IS EATEN — the pager never drills the star list underneath it', async () => {
    const { nav, drv } = await loadedNav();
    const r = drv.S.pagerRect;
    const level = nav._levelIndex, sel = nav._selectedNavStar;
    const p = half(r, +1);
    nav._handleMouseMove({ clientX: p.x, clientY: p.y });
    expect(nav._hoveredLocalStar, 'the pager row resolved to a star').toBe(null);
    // ⛔ THE EAT ITSELF, ASSERTED DIRECTLY. `_levelIndex` and `_selectedNavStar` unchanged is what the
    //    case used to say, and with nothing under the row to drill both were unchanged whether the
    //    click was eaten or not — the assertion could not fail. `null` from `remapClick` IS the eat:
    //    `_handleClick` opens `if (!p) return;` on it.
    expect(drv.remapClick({ x: p.x, y: p.y }, nav._canvas.width, nav._canvas.height),
      'the pager row let the click through to the handler').toBe(null);
    clickAt(nav, p.x, p.y);
    expect(nav._levelIndex, 'a page changed the level').toBe(level);
    expect(nav._selectedNavStar, 'a page selected a star').toBe(sel);
  }, 60000);

  it("⭐ BOTH EDGES ARE THE PAINT'S OWN: `x0` PAGES BACK, `x1 - 1` PAGES FORWARD, `x1` IS OUTSIDE", async () => {
    // Absolute, against the published band rather than against a texel "somewhere inside it": the
    // clause is `p.x >= x0 && p.x < x1`, so the two edges that can be off by one are these three.
    const { nav, drv } = await loadedNav();
    const r = drv.S.pagerRect, rows = drv.S.listGeom.rows;
    expect(drv.S.listGeom.total).toBeGreaterThan(rows * 2);

    press(nav, 'Equal'); nav.render();          // the shipped PAGE key, so the fixture is a gesture
    expect(drv.S.listOffset, 'the fixture must be paged off the top').toBe(rows);
    nav._handleMouseMove({ clientX: r.x0, clientY: r.y });
    clickAt(nav, r.x0, r.y);
    expect(drv.S.listOffset, 'the band\'s own left edge did not page back').toBe(0);

    nav._handleMouseMove({ clientX: r.x1 - 1, clientY: r.y });
    clickAt(nav, r.x1 - 1, r.y);
    expect(drv.S.listOffset, 'the last texel inside the band did not page forward').toBe(rows);

    const off = drv.S.listOffset;
    expect(drv.remapClick({ x: r.x1, y: r.y }, nav._canvas.width, nav._canvas.height),
      'the band ate a click one texel past its right edge').not.toBe(null);
    nav._handleMouseMove({ clientX: r.x1, clientY: r.y });
    clickAt(nav, r.x1, r.y);
    expect(drv.S.listOffset, 'one texel past the right edge still paged').toBe(off);
  }, 60000);

  it("⭐ THE SPLIT IS AT THE PUBLISHED `mid`, AND BOTH SIDES OF IT ARE TESTED", async () => {
    // `mid` is fractional at most buffers (347.5 at 427x240), which is the whole reason the paint
    // publishes it instead of leaving `(x0 + x1) / 2` to the picker. `floor(mid)` must be the LEFT
    // half and `ceil(mid)` the RIGHT one; a picker rounding the midpoint the other way fails here.
    const { nav, drv } = await loadedNav();
    const r = drv.S.pagerRect, rows = drv.S.listGeom.rows;
    expect(r.mid, 'the midpoint must lie strictly inside the band').toBeGreaterThan(r.x0);
    expect(r.mid).toBeLessThan(r.x1);

    press(nav, 'Equal'); nav.render();
    expect(drv.S.listOffset, 'the fixture must be paged off the top').toBe(rows);
    nav._handleMouseMove({ clientX: Math.floor(r.mid), clientY: r.y });
    clickAt(nav, Math.floor(r.mid), r.y);
    expect(drv.S.listOffset, 'the texel below `mid` paged forward').toBe(0);

    nav._handleMouseMove({ clientX: Math.ceil(r.mid), clientY: r.y });
    clickAt(nav, Math.ceil(r.mid), r.y);
    expect(drv.S.listOffset, 'the texel at or above `mid` paged back').toBe(rows);
  }, 60000);

  it('⛔ ONE TEXEL BELOW THE ROW IS NOT THE ROW — the band has a bottom edge', async () => {
    const { nav, drv } = await loadedNav();
    const r = drv.S.pagerRect;
    const off = drv.S.listOffset;
    expect(drv.remapClick({ x: r.x1 - 2, y: r.y + r.h }, nav._canvas.width, nav._canvas.height),
      'the band ate a click one texel below it').not.toBe(null);
    nav._handleMouseMove({ clientX: r.x1 - 2, clientY: r.y + r.h });
    clickAt(nav, r.x1 - 2, r.y + r.h);
    expect(drv.S.listOffset, 'a click below the row paged the list').toBe(off);
  }, 60000);

  it("⭐ AND THE PAGER IS EVERY LEVEL WITH A RAIL, NOT PRISM'S ALONE — it pages at GALAXY too", async () => {
    // The rail is drawn at all five levels and the pager with it; a case only ever driven at PRISM
    // would pass against a picker gated to level 3. GALAXY's rail lists 775 sectors, so there is a
    // second page to reach.
    const { nav, drv } = await galaxyNav();
    const r = drv.S.pagerRect;
    expect(r, 'design 1 at GALAXY must publish a pager band').toBeTruthy();
    const rows = drv.S.listGeom.rows;
    expect(drv.S.listGeom.total, 'GALAXY must have more sectors than one page').toBeGreaterThan(rows);
    nav._handleMouseMove({ clientX: r.x1 - 2, clientY: r.y + 2 });
    clickAt(nav, r.x1 - 2, r.y + 2);
    expect(drv.S.listOffset, 'the pager is dead at GALAXY').toBe(rows);
    expect(nav._levelIndex, 'the page drilled a sector').toBe(0);
  }, 60000);

  it('⛔ WITH THE DRAWN SEARCH OPEN THERE IS NO PAGER, AND THE ROW PAGES NOTHING', async () => {
    // `d1Rail` returns into `d1Search` before the line that publishes the band, so "the pager is not
    // on the glass" and "the pager is not on offer" are one fact. The click still has to go somewhere:
    // the field takes every click, and one that misses a result row closes it.
    const { nav, drv } = await loadedNav();
    const r = { ...drv.S.pagerRect };
    drv.searchOpen();
    nav.render();
    expect(drv.S.pagerRect, 'the field is over the rail and the pager was still on offer').toBe(null);
    const off = drv.S.listOffset;
    nav._handleMouseMove({ clientX: r.x1 - 2, clientY: r.y + 2 });
    clickAt(nav, r.x1 - 2, r.y + 2);
    expect(drv.S.listOffset, 'a band under the drawn field paged the list').toBe(off);
    expect(drv.S.search.open, 'a click off the rows must close the field').toBe(false);
  }, 60000);

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
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-2 / AC-8 — DESIGN 2'S LIST HEADERS SORT THE LIST.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("design 2's column headers sort the list", () => {
  async function listNav() {
    const h = await loadedNav({ mode: 'bars' });
    // ⭐ THE KEY, NOT THE DRIVER METHOD (INTERFACE §8e). `drv.toggleList()` asserts that the driver
    //    method the driver exposes does what the driver does; `L` is what the pilot presses, and the
    //    28 view-mode cases that passed while `V` was dead code are why that distinction is a rule.
    press(h.nav, 'KeyL');
    h.nav.render();
    expect(h.drv.S.listHeaderRects, 'KeyL did not put design 2 into list mode').toBeTruthy();
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

  it('⭐⭐ EVERY BAND IS THE HEADER ROW THE PAINT ACTUALLY DREW — INK INSIDE, NONE ONE TEXEL LEFT', async () => {
    // ⛔ THE STANDARD §8f SETS: validate the band against the PAINT, not against itself. `d2List`
    //    draws its headers at `mapY + 4`, and `mapY` is the topbar's own height — so the row is
    //    `BAR + 4` at every buffer and reading it off `regions().topbar.h` is reading the design's
    //    own declaration. A rect translated anywhere fails the ink test below.
    const { nav, drv } = await listNav();
    const BAR = drv.regions().topbar.h;
    const rects = drv.S.listHeaderRects;
    expect(rects).toHaveLength(6);
    expect(rects.map((r) => r.y), 'a header band left the row the paint drew it on')
      .toEqual(rects.map(() => BAR + 4));
    expect(rects.every((r, i) => i === 0 || rects[i - 1].x < r.x),
      `the columns are not left to right: ${rects.map((r) => r.x).join(',')}`).toBe(true);

    // …and the ink. Glyphs are 1x1 `fillRect`s in the header's own INK.DIM, so "there is a header
    // here" and "there is nothing one texel left of it" are both answerable off the recorder.
    const { ctx, fills } = inkRecorder(nav._canvas.width, nav._canvas.height);
    drv.render(ctx, nav._canvas.width, nav._canvas.height);
    const dim = fills.filter((f) => f.ink === INK.DIM && f.w === 1 && f.h === 1);
    for (const r of rects) {
      const onRow = (f) => f.y >= r.y && f.y < r.y + r.h;
      expect(dim.some((f) => onRow(f) && f.x >= r.x && f.x < r.x + r.w),
        `no header ink inside the band published for ${String(r.sortId)}`).toBe(true);
      expect(dim.some((f) => onRow(f) && (f.x === r.x - 2 || f.x === r.x - 1)),
        `ink two texels left of ${String(r.sortId)}'s band — the band is not on its own glyphs`).toBe(false);
    }
  }, 60000);

  it('⭐ `SYSTEM` SORTS BY CATALOG (REAL FIRST, THEN DISTANCE) AND `SP` BY CLASS', async () => {
    // The two keys §8a ADDS and the one the middle column names. `catalog` is a two-term comparator,
    // so asserting only "isReal first" would pass on a key that shuffled the rest.
    const { nav, drv } = await listNav();
    clickHeader(nav, drv, 'catalog');
    expect(drv.S.sortIdx).toBe(keyIdx(3, 'catalog'));
    expect(drv.S.sortLabel).toBe('CATALOG');
    nav.render();
    const rows = drv.D.starRows;
    const flags = rows.map((s) => (s.isReal ? 1 : 0));
    expect(flags.every((v, i) => i === 0 || flags[i - 1] >= v),
      'a catalogued star sorted below an uncatalogued one').toBe(true);
    const real = rows.filter((s) => s.isReal).map((s) => s.dist ?? 0);
    const rest = rows.filter((s) => !s.isReal).map((s) => s.dist ?? 0);
    expect(numAsc(real), 'the catalogued half is not in distance order').toBe(true);
    expect(numAsc(rest), 'the uncatalogued half is not in distance order').toBe(true);

    clickHeader(nav, drv, 'class');
    expect(drv.S.sortIdx).toBe(keyIdx(3, 'class'));
    nav.render();
    expect(localeAsc(drv.D.starRows.map((s) => String(s.spectral || ''))),
      'SP did not sort by the class it prints').toBe(true);
  }, 60000);

  it('⭐ A HEADER CLICK RESETS THE PAGE — a page 4 of a list you just re-ordered names nothing', async () => {
    const { nav, drv } = await listNav();
    drv.page(1);
    nav.render();
    expect(drv.S.listOffset, 'the fixture must be paged for the reset to say anything').toBeGreaterThan(0);
    clickHeader(nav, drv, 'name');
    expect(drv.S.listOffset, 'the sort left the reader on a page of the old order').toBe(0);
  }, 60000);

  it('⛔ DESIGN 1 AT PRISM PUBLISHES NO HEADERS — one frame of the rail and the field is null', async () => {
    const { nav, drv } = await listNav();
    expect(drv.S.listHeaderRects).toHaveLength(6);
    const r = drv.S.listHeaderRects.find((h) => h.sortId === 'name');
    nav.viewMode = 'rail';
    nav.render();
    expect(drv.S.listHeaderRects, "design 2's headers outlived the design that drew them").toBe(null);
    const before = drv.S.sortIdx;
    clickAt(nav, r.x + 1, r.y + 2);
    expect(drv.S.sortIdx, 'a stale header sorted a picture that draws none').toBe(before);
  }, 60000);

  it('⭐⭐ CLICKING `NAME` SORTS BY NAME, AND THE ROWS THE PAINT READS ARE RE-ORDERED', async () => {
    const { nav, drv } = await listNav();
    expect(drv.S.listHeaderRects, 'design 2 in list mode must publish its headers').toHaveLength(6);
    clickHeader(nav, drv, 'name');
    expect(drv.S.sortIdx).toBe(keyIdx(3, 'name'));
    expect(drv.S.sortLabel).toBe('NAME');
    nav.render();
    expect(localeAsc(drv.D.starRows.map((s) => String(s.name || ''))),
      'the key moved and the list did not').toBe(true);
  }, 60000);

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
  }, 60000);

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
  }, 60000);

  it('⛔ NO HEADER CLICK EVER SELECTS A STAR — the band eats the click it answers', async () => {
    const { nav, drv } = await listNav();
    const sel = nav._selectedNavStar, level = nav._levelIndex;
    for (const id of ['name', 'class', 'dist', 'plane', 'catalog']) clickHeader(nav, drv, id);
    expect(nav._selectedNavStar, 'a header drilled the list under it').toBe(sel);
    expect(nav._levelIndex).toBe(level);
  }, 60000);

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
  }, 60000);

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
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-2 — DESIGN 2'S `HERE · SECTOR` LOCATOR RE-CENTRES ON THE PLAYER (INTERFACE §8b).
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("design 2's locator centres the frame on the player", () => {
  const locPoint = (drv) => ({ x: drv.S.locatorRect.x + 2, y: drv.S.locatorRect.y + 2 });

  it('⭐⭐ THE BAND IS THE FITTED STRING THE TOPBAR RIGHT-ALIGNED, AT EVERY LEVEL, AND IT IS EATEN', async () => {
    // Absolute against the paint: `drawDesign2` aligns the locator's right edge at `W - 4` and draws
    // it on row 1 of the topbar. Both are the design's own literals, so a band that drifted anywhere
    // fails here rather than passing on "a texel two inside it hit something".
    // ⛔ AND THE EAT IS THE RETURN VALUE, AT ALL FOUR LEVELS THAT HAVE ONE. `null` is "the mode took
    //    it"; SYSTEM answers a POINT, which is §8b's open item and not an omission.
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    const W = nav._canvas.width, H = nav._canvas.height;
    for (const level of [0, 1, 2, 3]) {
      nav._levelIndex = level;
      nav.render();
      const r = drv.S.locatorRect;
      expect(r, `design 2 published no locator at level ${level}`).toBeTruthy();
      expect(r.x + r.w, `the locator is not right-aligned at W - 4 at level ${level}`).toBe(W - 4);
      expect(r.y, `the locator left the topbar's own row at level ${level}`).toBe(1);
      const p = locPoint(drv);
      expect(drv.remapClick({ x: p.x, y: p.y }, W, H),
        `level ${level} let the locator click through to the handler`).toBe(null);
    }
    wideBinary(nav);
    const p4 = locPoint(drv);
    expect(drv.remapClick({ x: p4.x, y: p4.y }, W, H), 'SYSTEM ate the locator click').not.toBe(null);
  }, 60000);

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
      // ⛔ AT THE SIZE ON THE GLASS (§8b). "Centre on the player" is a translation at GALAXY, not a
      //    zoom: a `toSize` computed from anything but `fromSize` moves the picture as well as the
      //    frame, and at level 0 there is no level below to take a size from.
      expect(nav._viewEase.toSize, 'the re-centre also changed the zoom')
        .toBe(nav._viewEase.fromSize);
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

  it("⭐ AT REGION IT REBUILDS THE STACK AND EASES ONTO THE PLAYER'S OWN REGION", async () => {
    // The third of §8b's four answers, and the one no case drove: level 2's frame is rebuilt from
    // `_computeTileSize(...) * 16`, not from the sector, so a `recentreOnPlayer` gated to level 1
    // would leave REGION dead and every other case here green.
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    const t0 = simClockMs();
    try {
      nav._levelIndex = 2;
      nav._viewStack[2] = { center: { x: 20, z: -15 }, size: 0.5 };
      nav._applyLevelView();
      nav.render();
      expect(nav._viewCenter).toEqual({ x: 20, z: -15 });
      const p = locPoint(drv);
      nav._handleMouseMove({ clientX: p.x, clientY: p.y });
      clickAt(nav, p.x, p.y);
      const home = { ...nav._viewStack[2].center };
      expect(home, 'the region frame was not rebuilt from the player').not.toEqual({ x: 20, z: -15 });
      expect(nav._viewEase, 'the frame cut instead of easing').toBeTruthy();
      expect(nav._densityCacheKey, 'the density cache was not busted for the new frame').toBe('');
      _setSimClockMs(t0 + 400);
      nav.render();
      expect(nav._viewCenter.x).toBeCloseTo(home.x, 9);
      expect(nav._viewCenter.z).toBeCloseTo(home.z, 9);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it("⭐ AT PRISM IT PUTS THE LOADER'S BLOCK BACK ON THE PLAYER", async () => {
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    // ⚠ THE HARNESS NEVER CALLS `setPlayerPosition`, so `_currentSector` is null and the stack
    //   rebuild has no sector to name. The running game always has one; this is that fixture, taken
    //   from the same `getSectorAt` call `:1183` makes.
    nav._currentSector = nav._sectors.getSectorAt({ x: nav._playerX, z: nav._playerZ });
    expect(nav._currentSector, 'the player must be inside the disc for this fixture').toBeTruthy();
    nav._localCenter = { x: 20, y: 1, z: -15 };
    nav._viewStack[1] = { center: { x: 20, z: -15 }, size: 2, sectorName: 'FOREIGN' };
    nav.render();
    const p = locPoint(drv);
    nav._handleMouseMove({ clientX: p.x, clientY: p.y });
    clickAt(nav, p.x, p.y);
    expect(nav._localCenter).toEqual({ x: nav._playerX, y: nav._playerY, z: nav._playerZ });
    expect(nav._localStars, 'the prism kept the block it was loaded for').toHaveLength(0);
    // ⛔ ALL THREE OF `:4481`'s RESETS, NOT JUST THE CENTRE. `_setupViewStackForPlayer` is what makes
    //    the LOADER's block the player's, and `_resetPrismLoad` is what makes the loader forget the
    //    band it already fetched — without either, the centre moves and the same foreign stars come
    //    straight back on the next frame.
    expect(nav._viewStack[1].sectorName, 'the view stack still names the foreign sector')
      .toBe(nav._currentSector.name);
    expect(nav._loadedYMin, 'the prism loader kept the band it had already fetched').toBe(null);
  }, 60000);

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
  }, 60000);

  it("⛔ AND `recentreOnPlayer()` REFUSES SYSTEM ON ITS OWN — the exported contract, not remapClick's", async () => {
    // ⚠ THE FUNCTION'S GUARD IS SHADOWED BY THE PICKER'S, WHICH IS WHY IT NEEDS ITS OWN CASE.
    //   `remapClick` never calls this at level 4 (`S.level !== 4` is on the clause), so deleting the
    //   `if (S.level === 4) return false;` inside `recentreOnPlayer` changed nothing any case could
    //   see — an unkillable gate. It is the EXPORTED method's own refusal: the host's folds and any
    //   later caller reach it directly, and §8b's answer at SYSTEM is "no action", not "unreachable".
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    wideBinary(nav);
    const centre = { ...nav._localCenter }, stars = nav._localStars.length;
    expect(drv.recentreOnPlayer(), 'SYSTEM claimed to have consumed a re-centre').toBe(false);
    expect(nav._viewEase, 'the refusal still armed an ease').toBeFalsy();
    expect(nav._localCenter, 'the refusal still moved the camera').toEqual(centre);
    expect(nav._localStars, 'the refusal still reset the loader').toHaveLength(stars);
  }, 60000);

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
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-2 — THE TWO READOUTS THAT EAT A CLICK AND DO NOTHING (the plate rule, INTERFACE §6).
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the corner widget lets its starfield through; the companion strip does not', () => {
  it("⭐⭐ A STAR MARK INSIDE DESIGN 2'S CORNER WIDGET STILL HOVERS AND STILL SELECTS", async () => {
    // ⛔ THE OPPOSITE ASSERTION FROM THE ONE THIS FILE SHIPPED THIS MORNING, AND THE REASON IS
    //    MEASURED (INTERFACE §8f). `S.minimapRect` published the widget's box and the driver ate every
    //    press inside it on the plate rule. The plate rule earns its name from `plated()`, which knocks
    //    out a BG rect before drawing so nothing under a label is visible; this widget is four corner
    //    brackets, a dot, a scale column and a 5-texel mark — ~49 texels of ink in a 720-texel box —
    //    over a starfield drawn BEFORE it and showing straight through. So a star in that box is on
    //    the glass and the pilot can see it, and eating the press traded AC-2's mis-selection for a
    //    LOST pick. The field is withdrawn, and this is the case that keeps it withdrawn.
    // ⚠ THE BOX COMES OUT OF THE PAINT TWICE OVER: computed from `d2Prism`'s own three expressions
    //   against the design's published map region, and then CROSS-CHECKED against the recorder — the
    //   top-left bracket is a 3x1 DIM fill at exactly `(mx, my)`, so if either the region or the
    //   widget moved, the fixture fails instead of testing the wrong 24 texels.
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    const W = nav._canvas.width, H = nav._canvas.height;
    const m = drv.regions().map;
    const box = { x: W - 44, y: m.y + m.h - 24 - 5, w: 24, h: 24 };
    const { ctx, fills } = inkRecorder(W, H);
    drv.render(ctx, W, H);
    expect(fills.some((f) => f.ink === INK.DIM && f.x === box.x && f.y === box.y && f.w === 3 && f.h === 1),
      `no corner bracket at ${JSON.stringify(box)} — the widget is not where the fixture looks`).toBe(true);

    // ⛔ BUILT, NOT FOUND: "a star mark happens to lie under the widget" is a real arrangement and not
    //    one this seed reliably supplies, and with nothing there the case would pass on an empty box.
    const inside = { x: box.x + 12, y: box.y + 12 };
    const star = nav._localStars[0];
    expect(star, 'the prism must have loaded a star to plant').toBeTruthy();
    drv.S.prismHits.push({ x: inside.x, y: inside.y, r: 4, ref: star });

    nav._handleMouseMove({ clientX: inside.x, clientY: inside.y });
    expect(nav._hoveredLocalStar, 'the widget went back to eating the hover under it').toBeTruthy();
    nav._selectedNavStar = null;
    expect(drv.remapClick({ x: inside.x, y: inside.y }, W, H),
      'the widget ate a press on a star the pilot can see').not.toBe(null);
    clickAt(nav, inside.x, inside.y);
    expect(nav._selectedNavStar, 'a star inside the corner widget is unclickable again').toBeTruthy();
  }, 60000);

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
  }, 60000);

  it('⛔ AND THE STRIP HAS A BOTTOM EDGE — one texel below it the orrery answers again', async () => {
    // ⚠ THE CONTROL THE EAT HAS NEVER HAD. The case above asserts a press ON the strip selects
    //   nothing — which is also what a press on empty sky does, so on its own it cannot tell a band
    //   with an edge from a band that swallowed the whole screen. This is the half that can fail: one
    //   texel under the published band the click is NOT eaten. What it then resolves to is the
    //   orrery's business and may well be nothing; `remapClick` answering a POINT is the claim.
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    wideBinary(nav);
    const r = drv.S.companionRect;
    expect(r, 'a 500 AU binary must draw and publish the companion strip').toBeTruthy();
    const below = { x: r.x + 2, y: r.y + r.h };
    expect(drv.remapClick(below, nav._canvas.width, nav._canvas.height),
      'the strip ate a press one texel below the band it published').not.toBe(null);
  }, 60000);

  it('⛔ AND THE BAND DOES NOT OUTLIVE ITS PICTURE — design 1 at SYSTEM publishes no companion', async () => {
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    wideBinary(nav);
    expect(drv.S.companionRect).toBeTruthy();
    nav.viewMode = 'rail';
    nav.render();
    expect(drv.S.companionRect, 'the strip outlived the design that drew it').toBe(null);
  }, 60000);
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
  }, 60000);

  it("⭐ THE BAND IS WHERE `d1Ladder` DREW THE READOUT — RIGHT-ALIGNED AT `x1 - 4`, `axisY + 16`", async () => {
    // Absolute against the paint's own two anchors, out of `S.ladderCaps`, which the same function
    // publishes from the same `x1` / `axisY` it drew with. A counter that drifted anywhere fails here
    // rather than passing on "a texel two inside it is grabbable".
    const { nav, drv } = await loadedNav();
    crowd(nav, 40);
    const r = drv.S.ladderCounterRect, caps = drv.S.ladderCaps;
    expect(r && caps, 'an overflowing ladder must publish both the counter and the caps').toBeTruthy();
    expect(r.x + r.w, "the readout is not right-aligned on the axis's own right end").toBe(caps.x1 - 4);
    expect(r.y, "the readout is not on the axis's own row + 16").toBe(caps.axisY + 16);
  }, 60000);

  it('⭐ IT SCRUBS THE WHOLE RANGE IN TEXELS, MONOTONICALLY, CLAMPED AT BOTH ENDS', async () => {
    const { nav, drv } = await loadedNav();
    crowd(nav, 40);
    const r = drv.S.ladderCounterRect, max = drv.S.ladderMax;
    expect(drv.counterDragTo(r.x), 'the left end is not the top of the ladder').toBe(0);
    expect(drv.counterDragTo(r.x + r.w), 'the right end is not the bottom of it').toBe(max);
    const walk = [];
    for (let i = 0; i <= 10; i++) walk.push(drv.counterDragTo(r.x + (r.w * i) / 10));
    expect(numAsc(walk), `not monotonic: ${walk.join(',')}`).toBe(true);
    expect(drv.counterDragTo(r.x - 40), 'a pointer left of the band did not peg').toBe(0);
    expect(drv.counterDragTo(r.x + r.w + 40), 'a pointer right of the band did not peg').toBe(max);
  }, 60000);

  it('⭐ AND THE MIDPOINT ROUNDS, ON A RANGE WHERE ROUNDING AND TRUNCATING DIFFER', async () => {
    // ⛔ AN EVEN `ladderMax` CANNOT TELL `Math.round` FROM `Math.floor` — 130/2 is 65 either way, and
    //    crowd(40) is 130. Twenty planets give 11 (measured), where round is 6 and floor is 5, so the
    //    assertion discriminates the two implementations instead of agreeing with both.
    const { nav, drv } = await loadedNav();
    crowd(nav, 20);
    const r = drv.S.ladderCounterRect, max = drv.S.ladderMax;
    expect(r, 'twenty planets must still overflow the window').toBeTruthy();
    expect(max % 2, 'the fixture must have an ODD range or this case proves nothing').toBe(1);
    expect(drv.counterDragTo(r.x + r.w / 2),
      `the midpoint truncated instead of rounding: max ${max}`).toBe(Math.round(max / 2));
    expect(Math.round(max / 2)).not.toBe(Math.floor(max / 2));
  }, 60000);

  it('⭐⭐ A REAL SCRUB MOVES THE WINDOW THE READOUT REPORTS — through the shipped handlers', async () => {
    // ⛔ THE COUNTER'S OWN TEXELS DO NOT MOVE (§8c: it is a READOUT), so "the indicator moves under
    //    the pointer" is met by the WINDOW moving. `S.ladderVisible` is what `d1Ladder` publishes as
    //    the first and last body it actually drew, and it is the honest observable: the tags are
    //    fillRects, so scraping the context for text finds nothing and passes vacuously.
    const { nav, drv } = await loadedNav();
    crowd(nav, 40);
    const r = drv.S.ladderCounterRect;
    const before = [...drv.S.ladderVisible];
    nav._handleMouseDown({ clientX: r.x + r.w / 2, clientY: r.y + 2, button: 0 });
    nav._handleMouseMove({ clientX: r.x + r.w, clientY: r.y + 2 });
    nav._handleMouseUp();
    nav.render();
    expect(drv.S.ladderScroll, 'the scrub did not reach the right end').toBe(drv.S.ladderMax);
    expect(drv.S.ladderVisible, `the window the readout reports did not move: ${before.join('-')}`)
      .not.toEqual(before);
  }, 60000);

  it('⛔ A LADDER WITH NOTHING TO SCROLL PUBLISHES NO COUNTER AND NO CAP MARKS', async () => {
    // The readout is drawn only when `maxScroll > 0`, and the driver must treat a missing field as
    // "no" rather than as zero — a scrubber for a range that does not exist is grabbable and inert.
    //
    // ⚠ THE FIXTURE IS A REAL SYSTEM NOW, WHICH IT COULD NOT BE THIS MORNING. `d1Ladder`'s virtual
    //   axis used to pad `+8` past the furthest body, so `maxScroll` was EXACTLY 4 on every system
    //   with any body at all and only the EMPTY one fitted — a case about an empty picture, not about
    //   a ladder. With the lab's `+4` correction three planets at 1, 8 and 30 AU fit, which is the
    //   AC-11 exception §8f records: no cap, no counter, and the hint row drops its SCROLL clause.
    const { nav, drv } = await loadedNav();
    threeBody(nav);
    expect(drv.D.bodies, 'the fixture must be a real system with bodies on the axis').toHaveLength(3);
    expect(drv.S.ladderMax, 'a ladder that fits has nothing to scroll').toBe(0);
    expect(drv.S.ladderCounterRect, 'a ladder with no window drew a window counter').toBe(null);
    expect(drv.counterGrab(200, 160), 'a missing counter was grabbable').toBe(false);
    expect(drv.counterDragTo(200), 'a missing counter answered a drag').toBe(null);

    // ⛔ AND NO `...` CAP EITHER, ASSERTED AGAINST THE PAINT. `d1Ladder` draws each cap as three 1x1
    //    KEY texels at `x1-5, x1-3, x1-1` and `x0, x0+2, x0+4` on the axis row; a cap on a ladder
    //    that fits is the glass saying "there is more this way" where there is not.
    const caps = drv.S.ladderCaps;
    expect(caps, 'the caps GEOMETRY is published regardless — the driver gates on ladderMax').toBeTruthy();
    const { ctx, fills } = inkRecorder(nav._canvas.width, nav._canvas.height);
    drv.render(ctx, nav._canvas.width, nav._canvas.height);
    const capXs = [caps.x1 - 5, caps.x1 - 3, caps.x1 - 1, caps.x0, caps.x0 + 2, caps.x0 + 4];
    const marks = fills.filter((f) => f.ink === INK.KEY && f.w === 1 && f.h === 1
                                      && f.y === caps.axisY && capXs.includes(f.x));
    expect(marks, `cap marks drawn on a ladder that fits: ${JSON.stringify(marks)}`).toHaveLength(0);
  }, 60000);

  it('⛔ DESIGN 2 PUBLISHES NO COUNTER — its SYSTEM is an orrery, not a ladder', async () => {
    const { nav, drv } = await loadedNav();
    crowd(nav, 40);
    expect(drv.S.ladderCounterRect).toBeTruthy();
    nav.viewMode = 'bars';
    nav.render();
    expect(drv.S.ladderCounterRect, 'a ladder counter outlived the ladder').toBe(null);
    expect(drv.counterGrab(200, 160)).toBe(false);
  }, 60000);
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

  /** Every INK.KEY fill this render put INSIDE the picture — chrome in the same ink is not the map's. */
  const keyIn = (fills, r) => fills.filter((f) => f.ink === INK.KEY
    && f.x >= r.x && f.x < r.x + r.w && f.y >= r.y && f.y < r.y + r.h);

  for (const mode of ['rail', 'bars']) {
    it(`⛔ ${mode}: NOTHING IS FRAMED UNTIL A CLICK COMMITS ONE — and the frame goes with the pick`, async () => {
      // ⛔ THE DEFAULT PICTURE MAX RULED ON CANNOT MOVE, so "the highlight is drawn" needs a case that
      //    fails if it were drawn ALWAYS. Counting the key ink inside the picture with `S.pick` null,
      //    then with it set, then with it forced null again is that: the first and third must agree.
      const { nav, drv } = await galaxyNav(mode);
      const W = nav._canvas.width, H = nav._canvas.height;
      const r0 = projRect(drv.S.mapProj);
      expect(drv.S.pick, 'nothing may be picked before the click').toBe(null);
      const a = inkRecorder(W, H); drv.render(a.ctx, W, H);
      const before = keyIn(a.fills, r0).length;

      const p = drv.S.mapProj, rr = projRect(p);
      const x = rr.x + rr.w * 0.34, y = rr.y + rr.h * 0.55;
      expect(armPick(nav, drv, x, y), 'the fixture point was eaten').not.toBe(null);
      expect(drv.S.pick?.level, 'the fixture recorded no highlight').toBe(0);
      const b = inkRecorder(W, H); drv.render(b.ctx, W, H);
      const lit = keyIn(b.fills, projRect(drv.S.mapProj)).length;

      drv.S.pick = null;
      const c = inkRecorder(W, H); drv.render(c.ctx, W, H);
      const after = keyIn(c.fills, projRect(drv.S.mapProj)).length;

      expect(lit, `the click added no key ink to the picture (${before} -> ${lit})`).toBeGreaterThan(before);
      expect(after, 'the picture is not the same with the pick taken away again').toBe(before);
    }, 60000);
  }

  it('⛔ A RIM SECTOR IS CLIPPED TO THE PAINTED BAND — design 2 crops half the disc by construction', async () => {
    // ⛔ THE WIDE FIELD IS ±(mapH/2)·kpc AND ABOUT HALF THE DISC IS OFF THE GLASS. A sector picked at
    //    the top of the band has world bounds that reach ABOVE it (measured: raw y0 = -26 against a
    //    band starting at 8), so an unclipped frame would paint over the topbar's rule — chrome that
    //    is not the map's to write on. The band is the design's own `clip`, out of `projRect`.
    const { nav, drv } = await galaxyNav('bars');
    const W = nav._canvas.width, H = nav._canvas.height;
    const p = drv.S.mapProj, r = projRect(p);
    const toX = (X) => p.ox + (X - p.cx) / p.kpc, toY = (Z) => p.oy + (Z - p.cz) / p.kpc;
    // walk the band's top row inward until a pick's own rect leaves the band
    let hit = null;
    for (let yy = r.y + 1; yy < r.y + r.h && !hit; yy += 2) {
      for (let xx = r.x + 4; xx < r.x + r.w && !hit; xx += 7) {
        const s = pickSector(nav, drv.S, xx, yy);
        if (!s) continue;
        const raw = { x0: Math.round(toX(s.sector.centerX - s.sector.size / 2)),
                      y0: Math.round(toY(s.sector.centerZ - s.sector.size / 2)),
                      x1: Math.round(toX(s.sector.centerX + s.sector.size / 2)),
                      y1: Math.round(toY(s.sector.centerZ + s.sector.size / 2)) };
        if (raw.x0 < r.x || raw.y0 < r.y || raw.x1 > r.x + r.w || raw.y1 > r.y + r.h) hit = { xx, yy, raw };
      }
    }
    expect(hit, 'no sector on this band reaches past it — the case would be vacuous').toBeTruthy();

    expect(armPick(nav, drv, hit.xx, hit.yy), 'the rim point was eaten').not.toBe(null);
    expect(drv.S.pick?.level).toBe(0);
    const { ctx, fills } = inkRecorder(W, H);
    drv.render(ctx, W, H);
    const key = keyIn(fills, projRect(drv.S.mapProj));
    expect(key.length, 'nothing was framed at the rim at all').toBeGreaterThan(0);
    const band = projRect(drv.S.mapProj);
    for (const f of key) {
      expect(f.x >= band.x && f.x + f.w <= band.x + band.w
             && f.y >= band.y && f.y + f.h <= band.y + band.h,
        `a frame edge escaped the painted band: ${JSON.stringify(f)} vs ${JSON.stringify(band)}`).toBe(true);
    }
    // …and it IS the clamped rectangle, not a smaller one that happens to fit
    const want = expectedFrame(drv.S.mapProj, drv.S.pick.sector);
    expect(key.some((f) => f.x === want.x && f.y === want.y && f.w === want.w && f.h === 1),
      `no clamped top edge at ${JSON.stringify(want)}; got ${JSON.stringify(key.slice(0, 6))}`).toBe(true);
  }, 60000);

  it('⛔ AND THE SAME CLIP IN DESIGN 1, WHERE IT TAKES A PAN TO REACH — the square is the picture', async () => {
    // ⚠ MEASURED, AND THE COMMENT SAYS SO: on the ENTRY frame design 1's re-fitted square is exactly
    //   the reachable disc, and no sector a click can resolve reaches past it — the rim sweep finds
    //   nothing. What produces the case is the gesture the `levelView(0)` fix made real: a 2D PAN at
    //   GALAXY, through the host's own `_panStartCenter` branch. A lit sector then walks toward the
    //   square's edge under the pilot's hand, and the frame must stop at the edge, not draw past it.
    const { nav, drv } = await galaxyNav();
    const W = nav._canvas.width, H = nav._canvas.height;
    const p = drv.S.mapProj, r = projRect(p);
    const x = r.x + 2.5 * p.cell, y = r.y + 3.5 * p.cell;
    expect(armPick(nav, drv, x, y), 'the fixture point was eaten').not.toBe(null);
    const sec = drv.S.pick?.sector;
    expect(sec, 'the fixture recorded no highlight').toBeTruthy();

    // The pan that puts the sector's left edge TWO TEXELS outside the square while its right edge
    // stays inside — derived from the published projection, `toX(left) = ox - 2`. It has to STRADDLE:
    // pan far enough and the intersection is empty and the design correctly draws nothing, which
    // would make the clip assertion below vacuous.
    const overshootKpc = (p.size * 2) / r.w;
    const targetCx = sec.centerX - sec.size / 2 + p.size / 2 + overshootKpc;
    const scale = nav._viewSize / navMapSize(W, H);
    const dxTexels = -(targetCx - nav._viewCenter.x) / scale;      // `_viewCenter.x = start.x - dx`
    nav._handleMouseDown({ clientX: 300, clientY: y, button: 0 });
    nav._handleMouseMove({ clientX: 300 + dxTexels, clientY: y });
    nav._handleMouseUp();
    nav.render();
    expect(nav._viewCenter.x, 'the pan did not move the frame where the derivation said')
      .toBeCloseTo(targetCx, 6);
    expect(drv.S.pick?.sector?.name, 'the pan cleared the highlight').toBe(sec.name);

    const p2 = drv.S.mapProj, r2 = projRect(p2);
    const rawLeft = Math.round(r2.x + ((sec.centerX - sec.size / 2 - p2.cx) / p2.size + 0.5) * r2.w);
    expect(rawLeft, 'the pan did not put the sector past the square — the case is vacuous')
      .toBeLessThan(r2.x);
    const { ctx, fills } = inkRecorder(W, H);
    drv.render(ctx, W, H);
    const key = keyIn(fills, projRect(drv.S.mapProj));
    expect(key.length, 'nothing was framed after the pan').toBeGreaterThan(0);
    for (const f of key) {
      expect(f.x >= r2.x && f.x + f.w <= r2.x + r2.w && f.y >= r2.y && f.y + f.h <= r2.y + r2.h,
        `a frame edge escaped the square: ${JSON.stringify(f)} vs ${JSON.stringify(r2)}`).toBe(true);
    }
    const want = expectedFrame(drv.S.mapProj, drv.S.pick.sector);
    expect(want.x, "the clamped frame does not start on the square's own left edge").toBe(r2.x);
    expect(key.some((f) => f.x === want.x && f.y === want.y && f.w === want.w && f.h === 1),
      `no clamped top edge at ${JSON.stringify(want)}`).toBe(true);
  }, 60000);

  it('⭐ THE FRAME IS DRAWN AFTER THE YOU MARKER — an acknowledgement a rule can cross is not one', async () => {
    // `d1TwoD` draws the player's 3x3 block in INK.YOU and the picked sector LAST, over the grid, the
    // tile ids and that block. Order is a fact about `rec.calls`, so it is asserted there.
    const { nav, drv } = await galaxyNav();
    const W = nav._canvas.width, H = nav._canvas.height;
    const p = drv.S.mapProj, r = projRect(p);
    const x = r.x + r.w * 0.34, y = r.y + r.h * 0.55;
    expect(armPick(nav, drv, x, y), 'the fixture point was eaten').not.toBe(null);
    const { ctx, fills } = inkRecorder(W, H);
    drv.render(ctx, W, H);
    const youAt = fills.findIndex((f) => f.ink === INK.YOU && f.w === 3 && f.h === 3);
    expect(youAt, "design 1's 3x3 YOU block was not drawn — the case is vacuous").toBeGreaterThanOrEqual(0);
    const want = expectedFrame(drv.S.mapProj, drv.S.pick.sector);
    const frameAt = fills.findIndex((f) => f.ink === INK.KEY
      && f.x === want.x && f.y === want.y && f.w === want.w && f.h === 1);
    expect(frameAt, 'the picked sector was not framed at all').toBeGreaterThanOrEqual(0);
    expect(frameAt, 'the YOU marker was painted over the acknowledgement').toBeGreaterThan(youAt);
  }, 60000);

  for (const mode of ['rail', 'bars']) {
    it(`⭐⭐ ${mode}: THE GALAXY PICTURE FOLLOWS THE GAME'S OWN FRAME — a pan moves it`, async () => {
      // ⛔ `levelView(0)` READS `S.view` SINCE 2026-09-08 (INTERFACE §8f). It used to return the fixed
      //    `{ 0, 0, 44 }`, and measured live the host's 2D pan moved `_viewCenter.x` 0 → -16.5 kpc
      //    without changing one bit of the canvas — a gesture live at every 2D level moving a frame
      //    nothing drew. This is that line, in both designs.
      // ⛔ AND THE ENTRY FRAME IS UNMOVED, which is the half that keeps the picture Max ruled on:
      //    `_viewStack[0]` is `{ 0, 0, 44 }`, so at entry `cx` is 0 and design 1's square is still
      //    re-fitted to `min(44, 2R)` = 36 kpc.
      const { nav, drv } = await galaxyNav(mode);
      const entry = drv.S.mapProj;
      expect(entry.cx, 'the entry frame is not the stack\'s own galaxy view').toBe(0);
      expect(entry.cz).toBe(0);
      if (mode === 'rail') expect(entry.size, "design 1's re-fit moved at entry").toBe(36);

      nav._viewCenter.x = -5;
      nav.render();
      expect(drv.S.mapProj.cx, 'the GALAXY picture ignored the frame the game panned').toBe(-5);
      if (mode === 'rail') expect(drv.S.mapProj.size, 'a pan also changed the re-fit').toBe(36);
    }, 60000);
  }

  for (const mode of ['rail', 'bars']) {
    it(`⭐⭐ ${mode}: THE DRILL ZOOMS AT GALAXY — the level is still 0 while the frame closes`, async () => {
      // Max: *"clicking on a cell from the grid should highlight it, then zoom into it"*. `_updateAnim`
      // walks `_viewCenter`/`_viewSize` for 500 ms and only THEN moves `_levelIndex`, so a design
      // reading a fixed disc CUT to SECTOR after half a second. The zoom is the frame closing.
      const { nav, drv } = await galaxyNav(mode);
      const t0 = simClockMs();
      try {
        _setSimClockMs(t0);
        const p = drv.S.mapProj, r = projRect(p);
        const size0 = mode === 'rail' ? p.size : p.kpc;
        const x = r.x + r.w * 0.34, y = r.y + r.h * 0.55;
        nav._handleMouseMove({ clientX: x, clientY: y });
        clickAt(nav, x, y);
        expect(nav._anim, 'the drill did not start — the case is vacuous').toBeTruthy();
        _setSimClockMs(t0 + 250);
        nav.render();
        expect(nav._levelIndex, 'the drill landed early and this is no longer a GALAXY frame').toBe(0);
        const size1 = mode === 'rail' ? drv.S.mapProj.size : drv.S.mapProj.kpc;
        expect(size1, `the GALAXY frame did not close during the drill: ${size0} -> ${size1}`)
          .toBeLessThan(size0);
      } finally { _setSimClockMs(t0); }
    }, 60000);
  }

  it('⭐⭐ A TAP WITH NO POINTER MOVE DRILLS WHAT IT FRAMES — AC-5 identity, the touch case', async () => {
    // ⛔ THE GESTURE THE OLD BUILD GOT WRONG. `clickAt` is mousedown → mouseup → click with NO
    //    `_handleMouseMove` — a tap, and the shipped panel path. Before §8f's fix the hover field was
    //    whatever the last RENDER's `resolveHover(_mouseX, _mouseY)` left, so the click lit the sector
    //    under the pointer and drilled the previous frame's one — or, with no pointer move at all,
    //    drilled NOTHING while lighting a sector. `remapClick` now resolves hover at the click point.
    const { nav, drv } = await galaxyNav();
    const p = drv.S.mapProj, r = projRect(p);
    const x = r.x + (2 + 0.5) * p.cell, y = r.y + (3 + 0.5) * p.cell;
    clickAt(nav, x, y);
    expect(nav._anim, 'a tap with no preceding pointer move drilled nothing').toBeTruthy();
    expect(drv.S.pick?.level, 'a tap recorded no highlight').toBe(0);
    expect(drv.S.pick.sector.name, 'the tap framed one sector and flew to another')
      .toBe(nav._viewStack[1].sectorName);
  }, 60000);

  it('⭐⭐ AND THE HIGHLIGHT AND THE DRILL ARE ONE OBJECT, NOT TWO CALLS THAT AGREE', async () => {
    // ⛔ HOW IDENTITY IS PINNED WHEN THE FIELD IS A COPY. `S.pick.sector` is four numbers and a name
    //    (the designs read it unguarded, so it cannot be a live quadtree node), so `toBe` on the
    //    object is not available. What IS available is a liveness probe: stamp every `getSectorAt`
    //    answer with the call number that produced it. If `notePick` asked `pickSector` a second time
    //    the two stamps differ, and the case goes red — which is exactly the mutant §8f names.
    const { nav, drv } = await galaxyNav();
    const p = drv.S.mapProj, r = projRect(p);
    const x = r.x + r.w * 0.34, y = r.y + r.h * 0.55;
    const real = nav._sectors.getSectorAt.bind(nav._sectors);
    let n = 0;
    nav._sectors.getSectorAt = (q) => {
      const s = real(q);
      return s ? { ...s, name: `${s.name}#${++n}` } : s;
    };
    try {
      nav._handleMouseDown({ clientX: x, clientY: y, button: 0 });
      nav._handleMouseUp();
      drv.remapClick({ x, y }, nav._canvas.width, nav._canvas.height);
      const hovered = nav._hoveredTile && nav._hoveredTile.sector;
      expect(hovered, 'the click resolved no hover at its own point').toBeTruthy();
      expect(drv.S.pick?.sector?.name, 'the highlight came from a second call, not from the drill\'s object')
        .toBe(hovered.name);
    } finally { nav._sectors.getSectorAt = real; }
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

  /** A nav at PRISM with a real system under it, which is what a 3 → 4 tab needs to be legal. */
  function giveSystem(nav) {
    nav._currentSystemData = { planets: [] };
    nav._systemStar = { wx: 8.02, wy: 0.001, wz: 0.002, seed: 4242, spectral: 'G', name: 'Target' };
    nav._systemData = { star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 },
                        asteroidBelts: [], planets: [{ orbitRadiusAU: 1, moons: [],
                          planetData: { radiusEarth: 1, T_eq: 280, habitability: { score: 0.5 }, rings: false } }] };
    nav.render();
  }

  it('⭐⭐ REGION → PRISM LANDS ON THE EXACT VALUES §8d NAMES, not merely somewhere smaller', async () => {
    // ⛔ THE MONOTONIC SAMPLES ABOVE CANNOT TELL A CORRECT TARGET FROM A WRONG ONE — any shrinking
    //    curve passes them. These are the END values, to 1e-9: the centre is the prism's own
    //    `_localCenter` and the window is the mirror of `:4476`'s outbound `fromSize`,
    //    `_viewSize / (gridNForLevel(from) * 2)`, read through the driver's own `gridNFallback`.
    // ⚠ AND THE PRISM IS MOVED OFF THE PLAYER FIRST, WHICH IS WHAT MAKES THE CENTRE ASSERTION SAY
    //   ANYTHING. At REGION `_viewStack[2].center` IS `{ _playerX, _playerZ }` and `_localCenter` is
    //   the same point, so on the stock fixture "the frame arrived on `_localCenter`" is true whether
    //   the ease wrote the centre or never touched it — the mutant that deletes both centre writes
    //   survives. A prism loaded 12 kpc away is an ordinary state (pan at PRISM, or a drill from
    //   another sector) and it separates the two.
    const { nav, drv } = await atRegion();
    const t0 = simClockMs();
    try {
      nav._localCenter = { x: 20, y: 1, z: -15 };
      nav.render();
      _setSimClockMs(t0);
      const fromCx = drv.S.view.cx, fromCz = drv.S.view.cz, fromSize = drv.S.view.size;
      expect(fromCx, 'the fixture must start away from the prism centre').not.toBeCloseTo(20, 3);
      press(nav, 'Tab');
      nav.render();
      const lag = drv.S.levelLag;
      expect(lag?.kind, 'the first Tab must start the map ease').toBe('map');
      expect(lag.toView.size, 'the target window is not the outbound ease mirrored')
        .toBeCloseTo(fromSize / (gridNFallback(2) * 2), 12);
      expect(lag.toView.cx, "the target centre is not the prism's own").toBe(nav._localCenter.x);
      expect(lag.toView.cz).toBe(nav._localCenter.z);

      // half way: the centre is strictly between the two ends, so a lag that never writes it fails
      _setSimClockMs(t0 + 175);
      nav.render();
      expect(drv.S.view.cx, 'the frame did not travel at all').toBeGreaterThan(Math.min(fromCx, 20));
      expect(drv.S.view.cx).toBeLessThan(Math.max(fromCx, 20));
      expect(drv.S.view.cz).toBeLessThan(Math.max(fromCz, -15));

      _setSimClockMs(t0 + 349.9999);          // still inside the lag: t < 1, so the curve is applied
      nav.render();
      expect(drv.S.levelLag, 'the lag ended a texel early').toBeTruthy();
      expect(drv.S.view.cx, 'the frame did not arrive on the prism centre').toBeCloseTo(nav._localCenter.x, 9);
      expect(drv.S.view.cz).toBeCloseTo(nav._localCenter.z, 9);
      expect(drv.S.view.size, 'the frame did not close to one tile of the level being left')
        .toBeCloseTo(fromSize / (gridNFallback(2) * 2), 9);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it('⭐⭐ PRISM → SYSTEM LANDS ON THE STAR AND ON A TENTH OF THE RADIUS', async () => {
    const { nav, drv } = await loadedNav();
    const t0 = simClockMs();
    try {
      giveSystem(nav);
      _setSimClockMs(t0);
      const r0 = nav._localRadius;
      press(nav, 'Tab');
      nav.render();
      expect(drv.S.levelLag?.kind).toBe('prism');
      _setSimClockMs(t0 + 349.9999);
      nav.render();
      expect(drv.S.levelLag, 'the lag ended early').toBeTruthy();
      expect(drv.S.cam.x, 'the camera did not arrive on the star it is entering')
        .toBeCloseTo(nav._systemStar.wx, 9);
      expect(drv.S.cam.y).toBeCloseTo(nav._systemStar.wy, 9);
      expect(drv.S.cam.z).toBeCloseTo(nav._systemStar.wz, 9);
      expect(drv.S.cam.radius, "the radius is not `_systemZoomAnim`'s own tenth")
        .toBeCloseTo(r0 * 0.1, 12);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it('⭐ A TAB-STRIP CLICK EASES TOO, AND ≤2 → SYSTEM TARGETS THE PLAYER', async () => {
    // ⛔ TWO ENTRANCES TO ONE TRANSITION. `tabLevel` arms the lag for the Tab KEY; the strip's own
    //    branch of `remapClick` arms it for the CLICK, and an ease only the keyboard got would be the
    //    divergence AC-4 keeps finding. §8d's target for `≤2 → 4` is the PLAYER — there is no
    //    `_localCenter` worth flying to when the destination is a system, and this is the only pair
    //    that takes that arm of `startLevelLag`.
    const { nav, drv } = await atRegion('bars');
    const t0 = simClockMs();
    try {
      giveSystem(nav);
      nav._levelIndex = 2; nav._applyLevelView(); nav.render();
      const tabs = drv.S.tabRects;
      expect(tabs, "design 2 must publish the strip's own rectangles").toHaveLength(5);
      const t = tabs[4], cx = t.x + t.w / 2, cy = t.y + t.h / 2;
      _setSimClockMs(t0);
      nav._handleMouseMove({ clientX: cx, clientY: cy });
      clickAt(nav, cx, cy);
      expect(nav._levelIndex, 'the strip click did not reach SYSTEM').toBe(4);
      nav.render();
      expect(drv.S.level, 'the orrery cut in instead of the region closing on it').toBe(2);
      const lag = drv.S.levelLag;
      expect(lag?.kind, 'a strip click got no ease where the key gets one').toBe('map');
      expect(lag.to).toBe(4);
      expect(lag.toView.cx, '≤2 → SYSTEM must close on the player').toBe(nav._playerX);
      expect(lag.toView.cz).toBe(nav._playerZ);
      _setSimClockMs(t0 + 400);
      nav.render();
      expect(drv.S.level, 'the ease never landed').toBe(4);
      expect(drv.S.levelLag).toBe(null);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it('⭐ SYSTEM → PRISM ARRIVES BY ZOOMING OUT — Shift+Tab, radius rising from the tenth', async () => {
    const { nav, drv } = await loadedNav();
    const t0 = simClockMs();
    try {
      giveSystem(nav);
      nav._levelIndex = 4; nav.render();
      _setSimClockMs(t0);
      const r0 = nav._localRadius;
      press(nav, 'Tab', { shiftKey: true });
      expect(nav._levelIndex, 'Shift+Tab did not come back to PRISM').toBe(3);
      nav.render();
      // ⛔ THE HELD LEVEL IS 3 AT ONCE HERE, unlike every other pair: the picture being entered is the
      //    prism, and what lags is the CAMERA. `hold: 3` and `to: 3` are the same level by design.
      expect(drv.S.level, 'the prism did not appear at once').toBe(3);
      expect(drv.S.levelLag?.kind).toBe('prism');
      const radii = [];
      for (const dt of [1, 120, 240]) { _setSimClockMs(t0 + dt); nav.render(); radii.push(drv.S.cam.radius); }
      expect(radii[0], 'the camera did not start from the tenth it entered on').toBeCloseTo(r0 * 0.1, 6);
      expect(radii.every((v, i) => i === 0 || v > radii[i - 1]),
        `the camera did not open out: ${radii.join(' < ')}`).toBe(true);
      _setSimClockMs(t0 + 400);
      nav.render();
      expect(drv.S.levelLag, 'a finished lag must clear itself').toBe(null);
      expect(drv.S.cam.radius, 'the camera is not read off the instrument again').toBe(nav._localRadius);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it("⭐ AND DESIGN 2 EASES THE SAME WAY — the lag is the DRIVER's, not a design's", async () => {
    const { nav, drv } = await atRegion('bars');
    const t0 = simClockMs();
    try {
      _setSimClockMs(t0);
      const fromSize = drv.S.view.size;
      press(nav, 'Tab');
      expect(nav._levelIndex).toBe(3);
      nav.render();
      expect(drv.S.level, 'design 2 jumped to PRISM instead of easing into it').toBe(2);
      expect(drv.S.levelLag?.kind).toBe('map');
      _setSimClockMs(t0 + 349.9999);
      nav.render();
      expect(drv.S.view.size).toBeCloseTo(fromSize / (gridNFallback(2) * 2), 9);
      _setSimClockMs(t0 + 400);
      nav.render();
      expect(drv.S.level).toBe(3);
      expect(drv.S.levelLag).toBe(null);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it('⛔ A HOVER ARMED BEFORE THE TAB IS TAKEN DOWN BY THE EASE, AND THE TAIL WOULD PUT IT BACK', async () => {
    // ⚠ THE CONTROL COMES FIRST, because without it this case is vacuous: the tab branch itself nulls
    //   `_hoveredTile` (`:4478`), so "null after the press" proves nothing on its own. What matters is
    //   that `_mouseX`/`_mouseY` still sit on the tile, and the render TAIL re-resolves the hover from
    //   them every frame — the control below shows it does. During the lag it must not: the candidates
    //   published this frame belong to the screen being left, and `remapClick` eats the click on them.
    const { nav, drv } = await atRegion();
    const t0 = simClockMs();
    try {
      _setSimClockMs(t0);
      const r = projRect(drv.S.mapProj);
      const x = r.x + r.w * 0.3, y = r.y + r.h * 0.3;
      nav._handleMouseMove({ clientX: x, clientY: y });
      expect(nav._hoveredTile, 'the fixture point must be on a tile').toBeTruthy();
      nav._hoveredTile = null;
      nav.render();
      expect(nav._hoveredTile, 'the render tail does not re-arm the hover — the case below is vacuous')
        .toBeTruthy();

      press(nav, 'Tab');
      nav.render();
      expect(drv.S.levelLag, 'no ease is running, so there is nothing to take the hover down').toBeTruthy();
      expect(nav._hoveredTile, 'a target the pilot can see for 350 ms and cannot act on').toBe(null);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it('⛔ A CLICK ON THE TAB ALREADY ON THE GLASS ARMS NOTHING — and nothing later inherits it', async () => {
    // ⛔ §8f, DEFECT 3. `tabLevel` already refuses `idx === cur`, so a click on the current level's tab
    //    changes nothing — and arming there left a token behind for whatever moved the level NEXT.
    //    The arm is also consumed on the very next refresh now, so both halves are asserted: no token,
    //    and a bare `_levelIndex` assignment after it still does not lag.
    const { nav, drv } = await atRegion('bars');
    const tabs = drv.S.tabRects;
    const t = tabs[2], cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    nav._handleMouseMove({ clientX: cx, clientY: cy });
    clickAt(nav, cx, cy);
    expect(nav._levelIndex, 'the current tab moved the level').toBe(2);
    expect(drv.S.levelArm, 'a tab that changes nothing armed an ease').toBe(null);

    nav._levelIndex = 3;
    nav.render();
    expect(drv.S.levelLag, 'a stale arm lagged a level change it had nothing to do with').toBe(null);
    expect(drv.S.level).toBe(3);
  }, 60000);

  it('⛔ AND AN ARM WHOSE CLICK WAS EATEN DOWNSTREAM IS GONE BY THE NEXT FRAME', async () => {
    // ⛔ §8f: THE ARM IS CONSUMED ON THE VERY NEXT `refresh()`, MOVED OR NOT — it used to live for a
    //    second. The difference is only observable when the arm is written and the level does NOT
    //    move, and the BARE frame is what produces that: `_handleClick`'s strip branch opens with
    //    `!this._bare` (the cockpit panel withdraws the strip and paints the orrery through it), so
    //    `remapClick` arms and the handler then declines to act. With a one-second window that token
    //    sat waiting for the next level change from ANYWHERE — including a bare `_levelIndex`
    //    assignment, which §8d says must never lag, and which is how four other suites move levels.
    // ⚠ `_bare` IS A GETTER, NOT A FLAG: it is `chromeless && level === 'system'` (`:413`), so the
    //   only level that can produce this state is SYSTEM — which is also the one the cockpit panel
    //   actually draws bare. The design still paints its own strip and publishes `S.tabRects`, which
    //   is exactly the trap: the tab is on the glass, the press arms, and the handler declines.
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    giveSystem(nav);
    nav._levelIndex = 4;
    nav.chromeless = true;
    nav.render();
    expect(nav._bare, 'the fixture must actually be drawing bare').toBe(true);
    const t = drv.S.tabRects[3];
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    nav._handleMouseMove({ clientX: cx, clientY: cy });
    clickAt(nav, cx, cy);
    expect(nav._levelIndex, 'the bare frame took the tab after all — the case is vacuous').toBe(4);
    expect(drv.S.levelArm, 'the strip branch armed nothing — the case is vacuous').toBeTruthy();

    nav.render();
    expect(drv.S.levelArm, 'the arm outlived the one frame that could have used it').toBe(null);
    nav._levelIndex = 3;
    nav.render();
    expect(drv.S.levelLag, 'a stale arm lagged a level change it had nothing to do with').toBe(null);
    expect(drv.S.level).toBe(3);
  }, 60000);

  it('⛔ THE STRIP BAND PAST THE LAST TAB DOES NOT CANCEL THE EASE — only a REAL tab does', async () => {
    // ⛔ §8f, DEFECT 2. The first build cancelled on the strip's BAND, so a press on the empty run
    //    past the last drawn tab killed the transition and then did nothing — the ease abandoned
    //    halfway with no level change to show for it. The cancel needs a tab that will MOVE the level.
    const { nav, drv } = await atRegion('bars');
    const t0 = simClockMs();
    try {
      _setSimClockMs(t0);
      press(nav, 'Tab');
      nav.render();
      expect(drv.S.levelLag, 'the fixture must have an ease running').toBeTruthy();
      const tabs = drv.S.tabRects;
      const past = tabs[4].x + tabs[4].w + 6;
      expect(past, 'the fixture point must still be on the glass').toBeLessThan(nav._canvas.width);
      expect(drv.S.tabRects.some((r) => past >= r.x && past < r.x + r.w),
        'the fixture point is on a tab — it must be past the last one').toBe(false);
      _setSimClockMs(t0 + 120);
      nav.render();
      expect(drv.remapClick({ x: past, y: 3 }, nav._canvas.width, nav._canvas.height),
        'a press in the strip band past the last tab was not eaten').toBe(null);
      expect(drv.S.levelLag, 'a press that moves no level killed the ease').toBeTruthy();
      _setSimClockMs(t0 + 400);
      nav.render();
      expect(drv.S.level, 'the ease never landed').toBe(3);
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it('⛔ AND NEITHER DOES THE DISABLED SYSTEM TAB — a tab that answers nothing cancels nothing', async () => {
    const { nav, drv } = await atRegion('bars');
    const t0 = simClockMs();
    try {
      expect(nav._currentSystemData, 'the fixture must be the no-system state').toBeFalsy();
      _setSimClockMs(t0);
      press(nav, 'Tab');
      nav.render();
      expect(drv.S.levelLag, 'the fixture must have an ease running').toBeTruthy();
      const t = drv.S.tabRects[4];
      _setSimClockMs(t0 + 120);
      nav.render();
      expect(drv.remapClick({ x: t.x + t.w / 2, y: t.y + t.h / 2 }, nav._canvas.width, nav._canvas.height),
        'the disabled SYSTEM tab answered a press').toBe(null);
      expect(drv.S.levelLag, 'a disabled tab killed the ease it cannot replace').toBeTruthy();
    } finally { _setSimClockMs(t0); }
  }, 60000);

  it("⛔ AND THE HOST'S OWN DRILL CANCELS IT — two writers on one field is a fight, not an animation", async () => {
    // §8d: `_anim` and `_systemZoomAnim` move the very fields the lag interpolates, and a real
    // transition always wins. `_startDrillAnim` is the host's own arming path, so the shape is right
    // by construction rather than by a hand-built literal that could drift from it.
    const { nav, drv } = await atRegion();
    const t0 = simClockMs();
    try {
      _setSimClockMs(t0);
      press(nav, 'Tab');
      nav.render();
      expect(drv.S.levelLag, 'the fixture must have an ease running').toBeTruthy();
      nav._startDrillAnim({ x: 0, z: 0 }, nav._viewSize, { x: 0, z: 0 }, nav._viewSize, 3, 500);
      nav.render();
      expect(drv.S.levelLag, "the lag went on interpolating under the host's own animation").toBe(null);
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
