/**
 * navDefects2026.driver — THE DRIVER'S HALF OF nav-defects-batch-2026-09-18.
 *
 * AC-1 (the drawn commit answers at every level), AC-2's STATE half (a real no-selection state and a
 * star row), AC-3's `panKpcPerTexel`, AC-4's `pressStartsGesture`, AC-5's driver gates, AC-9 (the
 * locator is eaten at SYSTEM) and AC-10 (`mult` on every star row).
 *
 * ── ⛔ THE STANDARD, INHERITED FROM navClosePass3 (INTERFACE §8e) ────────────────────────────────
 *
 * A key goes through `nav._onKeyDown`; a click goes through `clickAt` (mousedown → mouseup → click,
 * because `_handleClick` alone reads the press as a drag from the last `_dragStart` and returns); a
 * selection is made by the SHIPPED level-4 click branch writing `nav._selectedBody`, not by a test
 * assigning it. Every assertion below is an ABSOLUTE number or an identity, taken from the paint's own
 * publications rather than from a second copy of the layout.
 *
 * ── ⚠ AND AC-2'S CASES STOP AT `D`, ON PURPOSE ──────────────────────────────────────────────────
 *
 * Making `D.selBody` null is half of one AC; the other half — every painter tolerating null — is a
 * different owner's file landing in parallel, and until it does a level-4 design frame may throw on
 * the null this file now publishes. So the pick is driven through the real handler, and then read off a
 * FRESH `makeViewState()` refreshed against that nav: the adapter under test, the real input, and no
 * painter. ⛔ Not a workaround to be tidied away later — the adapter's contract IS `D`, and a case that
 * needed a design's cooperation to see a null would be testing two owners at once.
 */

import { describe, it, expect } from 'vitest';
import { makeHeadlessNav, clickAt } from './helpers/headlessNav.mjs';
import { makeViewState } from '../navViewModes/state.js';
import { projRect, worldAt } from '../navViewModes/picking.js';
/** ⛔ THE HOST'S OWN LEGACY PAN SCALE, IMPORTED. AC-3's whole claim is a RATIO against
 *  `_viewSize / navMapSize(w, h)`; a test restating 160 would be a second copy of the production
 *  layout and would go stale in silence — which is the defect class this workstream closes. */
import { navMapSize } from '../navLayout.js';

const W = 417, H = 240;   // ⭐ MAX'S OWN BUFFER. Every texel number below is true at this size and the
                          //   audit measured its ratios here; the geometry is read off the paint anyway.

const press = (nav, code, over = {}) =>
  nav._onKeyDown({ code, shiftKey: false, key: '', preventDefault() {}, stopPropagation() {}, ...over });

/** A nav with the prism loaded and a design on, at `level`. `render()` is what publishes everything. */
async function designNav({ mode = 'rail', level = 3 } = {}) {
  const h = await makeHeadlessNav({ width: W, height: H });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = 3;
  h.nav.viewMode = mode;
  h.nav.render();                       // populates _localStars via _renderLocal's own loader
  if (level !== 3) { h.nav._levelIndex = level; h.nav.render(); }
  h.drv = h.nav._viewDriverInst;
  return h;
}

/**
 * A system standing at the PLAYER'S OWN POSITION, so `_isCurrentSystem()` is true and the shipped
 * level-4 branch actually writes `_selectedBody` — the `else` half of that branch (a foreign system)
 * writes only a view and would leave every AC-2 case asserting about a pick nothing made.
 *
 * ⚠ PLANET 1 HAS NO MOONS DELIBERATELY: a planet WITH moons sends the legacy handler into
 *   `_systemMode = 'planet'`, which is a different picture and a different later click.
 */
function currentSystem(nav) {
  const star = { wx: nav._playerX, wy: nav._playerY, wz: nav._playerZ, seed: 5150, spectral: 'G', name: 'Trappy' };
  nav._currentSystemData = { planets: [] };
  nav._systemStar = star;
  nav._systemData = {
    star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
    planets: [
      { orbitRadiusAU: 1.0, moons: [],
        planetData: { radiusEarth: 1, T_eq: 280, habitability: { score: 0.8 }, rings: false } },
      { orbitRadiusAU: 8.0, moons: [],
        planetData: { radiusEarth: 3, T_eq: 120, habitability: { score: 0 }, rings: false } },
    ],
  };
  nav._levelIndex = 4;
  return star;
}

/** What the ADAPTER makes of this nav right now, with no painter anywhere near it. */
function adapt(nav) {
  const vs = makeViewState();
  vs.refresh(nav, { width: W, height: H, lines: H });
  return vs.D;
}

/** The centre of a published `{x,y,w,h}`, in whole texels — a point a pointer can actually be at. */
const mid = (r) => ({ x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) });

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-1 — the drawn commit answers a click at every level', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  it('⭐⭐ GALAXY: a click on the drawn commit row fires the SAME payload Enter fires', async () => {
    const { nav, drv } = await designNav({ mode: 'rail', level: 0 });
    // The armed target. `commit()`'s 0-3 branch sources it from `_selectedNavStar`, which is what
    // `_selectSearchResult`'s tail and the PRISM click both write — not a field invented here.
    nav._selectedNavStar = { wx: 9.5, wy: 0.125, wz: -2.25, seed: 777, name: 'TARGETY', spectral: 'K' };
    nav.render();
    const r = nav._commitButtonRect;
    expect(r, 'render() published no commit rectangle at GALAXY').toBeTruthy();

    const byKey = [];
    nav._onCommit = (a) => byKey.push(a);
    nav._onSound = () => {};
    press(nav, 'Enter');
    expect(byKey, 'Enter did not commit at GALAXY').toHaveLength(1);

    const byClick = [];
    const sounds = [];
    nav._onCommit = (a) => byClick.push(a);
    nav._onSound = (s) => sounds.push(s);
    const c = mid(r);
    clickAt(nav, c.x, c.y);

    // ⭐ THE ABSOLUTE FACT: one commit, the same payload Enter produced, and the same sound name.
    expect(byClick, 'the click on the drawn commit row committed nothing').toHaveLength(1);
    expect(byClick[0]).toEqual(byKey[0]);
    expect(byClick[0]).toEqual({
      type: 'warp', target: 'star',
      star: { wx: 9.5, wy: 0.125, wz: -2.25, seed: 777, name: 'TARGETY', spectral: 'K' },
    });
    expect(sounds).toEqual(['warpTarget']);
    expect(drv.S.level, 'the click changed level instead of committing').toBe(0);
  }, 60000);

  it('⛔ AND ONE TEXEL BELOW THE RECTANGLE COMMITS NOTHING — the band is the published one', async () => {
    const { nav } = await designNav({ mode: 'rail', level: 0 });
    nav._selectedNavStar = { wx: 9.5, wy: 0, wz: 0, seed: 777, name: 'TARGETY', spectral: 'K' };
    nav.render();
    const r = nav._commitButtonRect;
    const fired = [];
    nav._onCommit = (a) => fired.push(a);
    nav._onSound = () => {};
    clickAt(nav, mid(r).x, r.y + r.h);           // the first row OUTSIDE, by the paint's own height
    expect(fired, 'a press one texel below the commit row still committed').toHaveLength(0);
  }, 60000);

  it('⭐ SECTOR, REGION and PRISM answer it too — the rect is published at every level', async () => {
    for (const level of [1, 2, 3]) {
      const { nav } = await designNav({ mode: 'bars', level });
      nav._selectedNavStar = { wx: 9.5, wy: 0, wz: 0, seed: 42, name: 'ELSEWHERE', spectral: 'M' };
      nav.render();
      const r = nav._commitButtonRect;
      expect(r, `no commit rectangle at level ${level}`).toBeTruthy();
      const fired = [];
      nav._onCommit = (a) => fired.push(a);
      nav._onSound = () => {};
      const c = mid(r);
      clickAt(nav, c.x, c.y);
      expect(fired.length, `the chip at level ${level} did not commit`).toBe(1);
      expect(fired[0].star.seed, `level ${level} committed the wrong star`).toBe(42);
    }
  }, 60000);

  it('⭐⭐ SYSTEM: the click hands the handler the SAME object Enter does — one path', async () => {
    const { nav } = await designNav({ mode: 'rail', level: 3 });
    currentSystem(nav);
    nav.viewMode = null;                                  // arm the selection through the legacy branch
    nav._hoveredBody = { type: 'planet', index: 1 };
    clickAt(nav, 10, 10);
    expect(nav._selectedBody, 'the shipped handler armed no selection').toEqual({ type: 'planet', planetIndex: 1 });
    expect(nav._commitAction, 'the shipped handler armed no commit action').toBeTruthy();

    nav.viewMode = 'rail';
    nav.render();
    const armed = nav._commitAction;
    const byKey = [];
    const keySounds = [];
    nav._onCommit = (a) => byKey.push(a);
    nav._onSound = (s) => keySounds.push(s);
    press(nav, 'Enter');

    const byClick = [];
    const clickSounds = [];
    nav._onCommit = (a) => byClick.push(a);
    nav._onSound = (s) => clickSounds.push(s);
    const c = mid(nav._commitButtonRect);
    clickAt(nav, c.x, c.y);

    expect(byClick).toHaveLength(1);
    expect(byClick[0], 'the click did not fire the armed action itself').toBe(armed);
    expect(byClick[0], 'the click and the key fired different objects').toBe(byKey[0]);
    expect(clickSounds, 'the click and the key played different sounds').toEqual(keySounds);
    expect(clickSounds).toEqual(['warpLockOn']);          // the system IS the player's — `_isCurrentSystem`
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-2 — a real no-selection state, and a star selection the frame can follow', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  it('⭐⭐ WITH NOTHING PICKED, `D.selBody` IS NULL — not the most habitable planet', async () => {
    const { nav } = await designNav({ mode: 'rail', level: 3 });
    currentSystem(nav);
    expect(nav._selectedBody, 'the fixture arrived with a selection').toBeFalsy();
    const D = adapt(nav);
    expect(D.bodies.length, 'the fixture published no bodies, so the case is vacuous').toBeGreaterThan(1);
    expect(D.bodies.some((b) => b.hab > 0.5), 'no habitable planet, so the old fallback had nothing to pick')
      .toBe(true);
    expect(D.selBody, 'an unmade choice still resolved to a body').toBe(null);
  }, 60000);

  it('⭐⭐ AND A CLICK ON EMPTY SPACE PUTS IT BACK TO NULL, through the shipped clear', async () => {
    const { nav } = await designNav({ mode: 'rail', level: 3 });
    currentSystem(nav);
    nav.viewMode = null;
    nav._hoveredBody = { type: 'planet', index: 1 };
    clickAt(nav, 10, 10);
    expect(adapt(nav).selBody.pIdx, 'the pick did not resolve to the planet that was clicked').toBe(1);

    nav._hoveredBody = null;                              // empty space — `_clearCommitSelection`
    clickAt(nav, 10, 10);
    expect(nav._selectedBody, 'the shipped clear did not fire').toBe(null);
    expect(adapt(nav).selBody, 'the cleared selection came back as a guess').toBe(null);
  }, 60000);

  it('⭐⭐ PICKING THE STAR PUBLISHES A STAR ROW — kind, name and class from the system star', async () => {
    const { nav } = await designNav({ mode: 'rail', level: 3 });
    currentSystem(nav);
    nav.viewMode = null;
    nav._hoveredBody = { type: 'star', index: 0 };
    clickAt(nav, 10, 10);
    expect(nav._selectedBody, 'the shipped star branch armed nothing').toEqual({ type: 'star', starIndex: 0 });

    const b = adapt(nav).selBody;
    expect(b, 'a star selection resolved to nothing').toBeTruthy();
    expect(b.kind).toBe('star');
    expect(b.name).toBe('Trappy');
    expect(b.cls).toBe('G');
    expect(b.au).toBe(0);
    expect([b.rE, b.T, b.hab, b.rings, b.moons]).toEqual([null, null, null, false, 0]);
    expect(b.starIndex).toBe(0);
  }, 60000);

  it('⛔ A PICK THAT MATCHES NO ROW IS NULL TOO — a disagreement is not a default', async () => {
    const { nav } = await designNav({ mode: 'rail', level: 3 });
    currentSystem(nav);
    nav._selectedBody = { type: 'planet', planetIndex: 99 };
    expect(adapt(nav).selBody, 'an unresolvable pick still drew a frame on something').toBe(null);
  }, 60000);

  it('⭐ AND A REAL PLANET PICK STILL RESOLVES BY `pIdx`, exactly as before', async () => {
    const { nav } = await designNav({ mode: 'rail', level: 3 });
    currentSystem(nav);
    nav._selectedBody = { type: 'planet', planetIndex: 0 };
    const b = adapt(nav).selBody;
    expect(b.kind).toBe('planet');
    expect(b.pIdx).toBe(0);
    expect(b.au).toBe(1);
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-3 — the pan scale is the DRAWN map, not the legacy square', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * ⭐⭐ THE DEFINITION, NOT A RESTATEMENT: one texel of pointer must be one texel of picture, so the
   * scale the host pans by has to equal the world distance between two ADJACENT TEXELS of the drawn
   * map — which `worldAt` answers by inverting the published projection. Any second copy of `sq` /
   * `blk` / `kpc` in this file would be exactly the defect the AC found.
   */
  const casesA = [['rail', 0], ['rail', 1], ['rail', 2], ['bars', 0], ['bars', 1], ['bars', 2]];
  for (const [mode, level] of casesA) {
    it(`⭐ ${mode} L${level}: one texel of drag is one texel of map`, async () => {
      const { nav, drv } = await designNav({ mode, level });
      const p = drv.S.mapProj;
      expect(p, `${mode} L${level} published no projection`).toBeTruthy();
      const r = projRect(p);
      const a = worldAt(p, r.x + 10, r.y + 10), b = worldAt(p, r.x + 11, r.y + 10);
      const k = drv.panKpcPerTexel();
      expect(k, 'the driver published no pan scale where the paint published a map').toBeTruthy();
      expect(k).toBeCloseTo(b.wx - a.wx, 12);
      // …and in the other axis too, which is what makes it ONE scale rather than two that agree here.
      const c = worldAt(p, r.x + 10, r.y + 11);
      expect(k).toBeCloseTo(c.wz - a.wz, 12);
      expect(nav._canvas.width).toBe(W);
    }, 60000);
  }

  it('⭐⭐ AND THE AUDIT\'S THREE MEASURED OVERSHOOTS ARE EXACTLY WHAT IT REMOVES', async () => {
    // 1.35x (design 1's 216-texel square), 1.4x (design 2's 224-texel block) and 2.6x (design 2's
    // 417-wide band) — the three numbers Max was given. `navMapSize` is imported, so the legacy side
    // of each ratio is the host's own arithmetic and not a pinned 160.
    const want = [['rail', 1, 1.35], ['bars', 1, 1.40], ['bars', 0, 2.606]];
    for (const [mode, level, ratio] of want) {
      const { nav, drv } = await designNav({ mode, level });
      const legacy = nav._viewSize / navMapSize(W, H);
      expect(legacy / drv.panKpcPerTexel(), `${mode} L${level} overshoot`).toBeCloseTo(ratio, 2);
    }
  }, 60000);

  it('⛔ AND NO PUBLISHED PROJECTION IS `null`, SO THE HOST KEEPS THE LEGACY EXPRESSION', async () => {
    const { drv } = await designNav({ mode: 'rail', level: 3 });   // PRISM draws no 2D projection
    expect(drv.S.mapProj, 'PRISM published a 2D projection').toBeFalsy();
    expect(drv.panKpcPerTexel()).toBe(null);
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-4 — only a press on the map (or on a drawn handle) starts a gesture', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  it('⭐⭐ DESIGN 1: the map answers, and the rail, status, hint, tabs and commit rows do not', async () => {
    for (const level of [0, 1, 2, 3, 4]) {
      const { nav, drv } = await designNav({ mode: 'rail', level });
      if (level === 4) { currentSystem(nav); nav.render(); }
      const R = drv.regions();
      const m = mid(R.map);
      expect(drv.pressStartsGesture(m.x, m.y), `rail L${level}: the map refused a press`).toBe(true);
      for (const name of ['rail', 'status', 'hint', 'tabs', 'commit']) {
        const c = mid(R[name]);
        expect(drv.pressStartsGesture(c.x, c.y), `rail L${level}: a press on ${name} armed a gesture`).toBe(false);
      }
    }
  }, 120000);

  it('⭐⭐ DESIGN 2: the map answers, and the two bars do not', async () => {
    for (const level of [0, 1, 2, 3, 4]) {
      const { nav, drv } = await designNav({ mode: 'bars', level });
      if (level === 4) { currentSystem(nav); nav.render(); }
      const R = drv.regions();
      const m = mid(R.map);
      expect(drv.pressStartsGesture(m.x, m.y), `bars L${level}: the map refused a press`).toBe(true);
      for (const name of ['topbar', 'botbar']) {
        const c = mid(R[name]);
        expect(drv.pressStartsGesture(c.x, c.y), `bars L${level}: a press on ${name} armed a gesture`).toBe(false);
      }
    }
  }, 120000);

  it('⭐ AND THE TWO DRAWN HANDLES STILL GRAB, though neither is inside the map pane', async () => {
    const prism = await designNav({ mode: 'rail', level: 3 });
    const gauge = prism.drv.S.yGaugeRect;
    expect(gauge, 'design 1 at PRISM published no y-gauge').toBeTruthy();
    const g = mid(gauge);
    expect(prism.drv.regions().map.x + prism.drv.regions().map.w,
      'the gauge is inside the map pane, so this case proves nothing').toBeLessThanOrEqual(gauge.x);
    expect(prism.drv.pressStartsGesture(g.x, g.y), 'the y-gauge refused a press').toBe(true);
    expect(prism.drv.gaugeGrab(g.x, g.y), 'the gauge grab and the gesture test disagree').toBe(true);

    // The SYSTEM counter needs a ladder that overflows, which a crowded system is and Sol is not.
    const sys = await designNav({ mode: 'rail', level: 3 });
    sys.nav._currentSystemData = { planets: [] };
    sys.nav._systemStar = { wx: sys.nav._playerX, wy: sys.nav._playerY, wz: sys.nav._playerZ,
                            seed: 5150, spectral: 'G', name: 'Crowdy' };
    sys.nav._systemData = {
      star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
      planets: Array.from({ length: 40 }, (_, i) => ({
        orbitRadiusAU: 0.2 + i * 0.9, moons: [],
        planetData: { radiusEarth: 1 + (i % 5), T_eq: 250, habitability: { score: 0.1 }, rings: false },
      })),
    };
    sys.nav._levelIndex = 4;
    sys.nav.render();
    const counter = sys.drv.S.ladderCounterRect;
    expect(counter, 'the crowded ladder published no counter').toBeTruthy();
    const c = mid(counter);
    expect(sys.drv.pressStartsGesture(c.x, c.y), 'the ladder counter refused a press').toBe(true);
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-5 — a key acts only where it draws something', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  it('⭐⭐ DESIGN 2: [ ] and - = do nothing at GALAXY, SECTOR, REGION and SYSTEM', async () => {
    for (const level of [0, 1, 2, 4]) {
      const { nav, drv } = await designNav({ mode: 'bars', level });
      if (level === 4) { currentSystem(nav); nav.render(); }
      const before = { sortIdx: drv.S.sortIdx, listOffset: drv.S.listOffset, label: drv.S.sortLabel };
      // ⛔ ONE DIRECTION EACH, AND THE MUTANT IS WHY. Pressing `]` then `[` (and `=` then `-`) NETS TO
      //    ZERO under a working `cycleSort`/`page`, so the round trip was green on the unfixed code —
      //    a case that could not fail, which is the shape this whole workstream exists to delete.
      press(nav, 'BracketRight');
      press(nav, 'Equal');
      expect(drv.S.sortIdx, `bars L${level}: [ ] re-ranked a list nobody drew`).toBe(before.sortIdx);
      expect(drv.S.listOffset, `bars L${level}: - = paged a list nobody drew`).toBe(before.listOffset);
      expect(drv.S.sortLabel, `bars L${level}: the sort label moved`).toBe(before.label);
    }
  }, 120000);

  it('⭐ …AND AT PRISM IN LIST MODE THEY STILL WORK, which is where design 2 draws one', async () => {
    const { nav, drv } = await designNav({ mode: 'bars', level: 3 });
    press(nav, 'KeyL');
    expect(drv.S.list, 'L did not open the list at PRISM').toBe(true);
    nav.render();
    const sort0 = drv.S.sortIdx;
    press(nav, 'BracketRight');
    expect(drv.S.sortIdx, '[ ] is dead in the one place design 2 draws a list').not.toBe(sort0);
    nav.render();
    press(nav, 'Equal');
    expect(drv.S.listOffset, '- = is dead in the one place design 2 draws a list').toBeGreaterThan(0);
  }, 60000);

  it('⛔ DESIGN 1 KEEPS ALL FIVE LEVELS — its rail is a list everywhere', async () => {
    for (const level of [0, 1, 2, 3]) {
      const { nav, drv } = await designNav({ mode: 'rail', level });
      const sort0 = drv.S.sortIdx;
      press(nav, 'BracketRight');
      expect(drv.S.sortIdx, `rail L${level}: [ ] stopped working where the rail still ranks`)
        .not.toBe(sort0);
    }
  }, 120000);

  it('⭐⭐ L DOES NOT ARM A LIST ON A 2D SCREEN, so a map click still drills the map', async () => {
    const { nav, drv } = await designNav({ mode: 'bars', level: 0 });
    press(nav, 'KeyL');
    expect(drv.S.list, 'L armed list mode at GALAXY, where design 2 draws no list').toBe(false);

    // …and the picker refuses it even if the flag is forced, which is the half that ate map clicks.
    drv.S.list = true;
    nav.render();
    expect(drv.S.listGeom, 'GALAXY published a list grid').toBeFalsy();
    const R = drv.regions();
    const x = Math.floor(R.map.x + R.map.w / 2), y = R.map.y + 40;
    nav._handleMouseMove({ clientX: x, clientY: y });
    nav.render();
    const hit = nav._hoveredTile;
    // ⭐ THE ABSOLUTE FACT: what is hovered is the sector the MAP resolves at that point — the shape
    //   `pickSector` publishes ({sector, ...}) carrying the sector under the pointer — and not
    //   `pickFromRow`'s `{ sector: D.sectorRows[i].s }`, which is ranked by the sort and is a
    //   different sector entirely.
    if (hit) {
      const p = drv.S.mapProj, wp = worldAt(p, x, y);
      const s = hit.sector;
      expect(s, 'the hover carried no sector').toBeTruthy();
      expect(Math.abs(s.centerX - wp.wx) <= s.size, 'the hovered sector is not the one under the pointer')
        .toBe(true);
      expect(Math.abs(s.centerZ - wp.wz) <= s.size, 'the hovered sector is not the one under the pointer')
        .toBe(true);
    }
  }, 60000);

  it('⛔ AND `scrollLadder` CARRIES ITS OWN LEVEL GATE — belt and braces with the host clause', async () => {
    for (const level of [0, 1, 2, 3]) {
      const { drv } = await designNav({ mode: 'rail', level });
      drv.S.ladderStops = [0, 20, 40]; drv.S.ladderMax = 40; drv.S.ladderScroll = 0;
      drv.scrollLadder(1);
      expect(drv.S.ladderScroll, `rail L${level}: , . scrolled a ladder that is not on the glass`).toBe(0);
    }
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-9 — HERE · SECTOR is eaten at SYSTEM, and clears nothing', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  it('⭐⭐ THE SELECTION SURVIVES A CLICK ON THE LOCATOR AT SYSTEM', async () => {
    const { nav, drv } = await designNav({ mode: 'bars', level: 3 });
    currentSystem(nav);
    nav.viewMode = null;
    nav._hoveredBody = { type: 'planet', index: 1 };
    clickAt(nav, 10, 10);
    expect(nav._selectedBody, 'the fixture armed no selection').toEqual({ type: 'planet', planetIndex: 1 });
    const armed = nav._commitAction;

    nav.viewMode = 'bars';
    nav.render();
    const loc = drv.S.locatorRect;
    expect(loc, 'design 2 at SYSTEM published no locator band').toBeTruthy();
    const ease0 = nav._viewEase;
    const c = mid(loc);
    clickAt(nav, c.x, c.y);

    expect(nav._selectedBody, 'clicking HERE · SECTOR threw the body selection away')
      .toEqual({ type: 'planet', planetIndex: 1 });
    expect(nav._commitAction, 'clicking HERE · SECTOR disarmed the commit').toBe(armed);
    expect(nav._viewEase, 'clicking HERE · SECTOR re-centred something at SYSTEM').toBe(ease0);
  }, 60000);

  it('⭐ AND AT GALAXY IT STILL RE-CENTRES, exactly as before', async () => {
    const { nav, drv } = await designNav({ mode: 'bars', level: 0 });
    const loc = drv.S.locatorRect;
    expect(loc, 'design 2 at GALAXY published no locator band').toBeTruthy();
    nav._viewEase = null;
    const c = mid(loc);
    clickAt(nav, c.x, c.y);
    expect(nav._viewEase, 'the locator stopped re-centring at GALAXY').toBeTruthy();
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-10 — every star row carries its multiplicity, and COMPS orders by it', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /** The prism loader runs in chunks; this drives it to the end so the case is about a real catalogue. */
  async function fullPrism() {
    const h = await designNav({ mode: 'rail', level: 3 });
    for (let i = 0; i < 80; i++) { h.nav.render(); await new Promise((r) => setTimeout(r, 0)); }
    return h;
  }

  it('⭐⭐ EVERY DRAWN ROW HAS A FINITE `mult`, AND SOME OF THEM ARE MULTIPLE', async () => {
    const { drv } = await fullPrism();
    const rows = drv.D.starRows;
    expect(rows.length, 'the prism loaded nothing, so the case is vacuous').toBeGreaterThan(1000);
    expect(rows.filter((r) => !Number.isFinite(r.mult)).length, 'rows reached the painters with no `mult`')
      .toBe(0);
    expect(rows.every((r) => r.mult >= 1), 'a row reported fewer than one star').toBe(true);
    expect(rows.filter((r) => r.mult > 1).length,
      'no row is multiple, so the pips and the COMPS column have nothing to show').toBeGreaterThan(0);
  }, 120000);

  it('⭐⭐ AND THE COMPS SORT ACTUALLY RE-ORDERS — driven by the real `[` `]` key', async () => {
    const { nav, drv } = await fullPrism();
    const before = drv.D.starRows.slice(0, 40).map((r) => r.seed);
    let guard = 0;
    while (drv.S.sortLabel !== 'COMPS' && guard++ < 12) { press(nav, 'BracketRight'); nav.render(); }
    expect(drv.S.sortLabel, '`]` never reached the COMPS key').toBe('COMPS');

    const rows = drv.D.starRows;
    expect(rows[0].mult, 'the top of a COMPS sort is a single star').toBeGreaterThan(1);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].mult > rows[i - 1].mult) {
        throw new Error(`COMPS is not ordered by multiplicity at row ${i}: ${rows[i - 1].mult} then ${rows[i].mult}`);
      }
    }
    expect(drv.D.starRows.slice(0, 40).map((r) => r.seed), 'COMPS changed nothing about the order')
      .not.toEqual(before);
  }, 120000);

  it('⛔ AND THE FILL IS MEMOISED BY SEED — a second refresh recomputes nothing', async () => {
    const { nav, drv } = await fullPrism();
    const seen = new Map();
    for (const r of drv.D.starRows) seen.set(r.seed, r.mult);
    // Force the base to be rebuilt the way the loader does (a new array of the same stars), and
    // assert every seed comes back with the SAME answer — which a per-call roll could not guarantee
    // to be free and a per-frame recomputation would make visible as a frame-time regression.
    nav._localStars = nav._localStars.slice();
    nav.render();
    let checked = 0;
    for (const r of drv.D.starRows) {
      // ⛔ `toBe` ALONE WOULD PASS ON `undefined === undefined` — measured, against the mutant that
      //    stops filling — so the finiteness is asserted here too and the coherence check cannot be
      //    satisfied by two gaps agreeing with each other.
      expect(Number.isFinite(r.mult), `seed ${r.seed} came back from a rebuild with no multiplicity`).toBe(true);
      expect(r.mult, `seed ${r.seed} changed multiplicity across a rebuild`).toBe(seen.get(r.seed));
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);

    const t0 = performance.now();
    nav._localStars = nav._localStars.slice();
    nav.render();
    const ms = performance.now() - t0;
    expect(ms, `a cached rebuild of ${drv.D.starRows.length} rows took ${ms.toFixed(1)} ms`).toBeLessThan(200);
  }, 120000);
});
