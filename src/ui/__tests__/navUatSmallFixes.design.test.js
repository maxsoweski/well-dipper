/**
 * Max's UAT walk of the nav menus, 2026-09-30 — three of the fixes it carried out, the DESIGN half.
 * Spec: docs/WORKSTREAMS/nav-restorations-2026-09-20/UAT-walk-2026-09-30.md (his words, verbatim).
 *
 *   (A) stop 2 — *"remove all of that row"*: design 1's instruction/legend row above the tab strip is
 *       gone at every level and in every state, and its six texels went to the map and the rail.
 *   (B) stop 4 — *"nothing on the SYSTEM screen says which system you are looking at"*: browsing a
 *       FOREIGN system, both designs name it (`VIEWING <NAME>` / `NOT YOUR SYSTEM`, target ink), and no
 *       ship mark, ship diamond or trajectory is drawn on it.
 *   (C) stop 4 ruling — in ORRERY the commit reads `GO TO <body>`, not `BURN TO`. The host publishes
 *       `nav.commitIsView`; the designs only change the WORD, and Enter still dispatches the same
 *       'burn' action (the host's `dispatchNavAction` decides what it does).
 *
 * Reads words off the glass the way `navDefects2026.design.test.js` does: the shipped `S` / `D`
 * repainted through a `drawPixelText` that records each string (post-`fit()`) and its ink.
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { railGeometry } from '../navViewModes/geometry.js';
import { FACE, drawPixelText, measurePixelText } from '../../rendering/PixelText.js';

const W = 417, H = 240;
const INK = { RULE: '#1d3a4a', CURRENT: '#2ee6c0', TARGET: '#ffb03a' };

/** Every phrase design 1's removed row ever printed, in any of its variants. */
const ROW_PHRASES = ['CLICK A SECTOR', 'CLICK A TILE', 'CLICK A STAR', 'OR A LIST ROW', 'TAB LEVEL', '/ SEARCH',
                     '[ ] SORT', 'R/F UP', 'SCROLL , .', 'RIGHT CLICK BACK', 'UP DOWN MOVE', 'TYPE A NAME   UP'];

function inkRecordingContext() {
  const fills = [];
  const base = { fillStyle: '#000', imageSmoothingEnabled: false };
  const ctx = new Proxy(base, {
    get(t, k) {
      if (k === 'fillRect') return (x, y, w, h) => fills.push({ x, y, w, h, ink: t.fillStyle });
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
    has() { return true; },
  });
  return { ctx, fills };
}

async function loadedNav() {
  const h = await makeHeadlessNav({ width: W, height: H });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = 3;
  h.nav.viewMode = 'rail';
  h.nav.render();
  return h;
}

const press = (nav, code, extra = {}) =>
  nav._onKeyDown({ code, preventDefault() {}, stopPropagation() {}, ...extra });

function paint(nav, design) {
  const { S, D } = nav._viewDriverInst;
  const lines = [];
  const { ctx, fills } = inkRecordingContext();
  const d = makeDesigns({
    S, D, onViolation: null, face: FACE, measurePixelText,
    drawPixelText: (g, s, x, y, opts) => { lines.push({ s: String(s), x, y, color: opts?.color });
                                           return drawPixelText(g, s, x, y, opts); },
  });
  S.design = design;
  d.resetRegions(); d.resetViolations();
  if (design === 1) d.drawDesign1(ctx, W, H); else d.drawDesign2(ctx, W, H);
  return { fills, lines, regions: d.regions(), violations: d.violations(), text: lines.map((l) => l.s).join('\n') };
}

/** Put the nav at a level; at SYSTEM, drill the nearest star and stand the pilot ON it (home) or 10 pc off it (foreign). */
async function at(h, mode, level, { foreign = false, moons = 0 } = {}) {
  const nav = h.nav;
  nav.viewMode = mode;
  if (level === 4) {
    nav._systemStar = nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
    nav._playerX = nav._systemStar.wx + (foreign ? 0.01 : 0);
    nav._playerY = nav._systemStar.wy; nav._playerZ = nav._systemStar.wz;
    nav._systemData = {
      star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
      planets: Array.from({ length: 4 }, (_, i) => ({
        orbitRadiusAU: 0.4 + i * 0.9,
        moons: i === 1 ? Array.from({ length: moons }, (_, m) => ({ orbitRadiusEarth: 20 + m * 15, type: 'rocky', radiusEarth: 0.2 })) : [],
        planetData: { radiusEarth: 1 + (i % 4), T_eq: 260, habitability: { score: 0.2 }, rings: false },
      })),
    };
    nav._levelIndex = 4;
  } else nav._levelIndex = level;
  nav.render();
  return nav;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('(A) design 1 draws no instruction row above the tab strip — "remove all of that row"', () => {
  it('⛔ NO HINT REGION AND NONE OF THE ROW\'S PHRASES, AT EVERY LEVEL, UNDER EVERY STATE THAT HAD A VARIANT', async () => {
    const h = await loadedNav();
    const states = [];
    for (const level of [0, 1, 2, 3, 4]) {
      const nav = await at(h, 'rail', level);
      states.push([`L${level}`, paint(nav, 1)]);
      press(nav, 'BracketRight'); nav.render();                  // a sort key, which the row used to name
      states.push([`L${level} sorted`, paint(nav, 1)]);
    }
    const nav = await at(h, 'rail', 3);
    press(nav, 'Slash'); nav.render();                            // the search variant of the row
    expect(nav._viewDriverInst.S.search.open, 'the fixture must open the drawn search').toBe(true);
    states.push(['search', paint(nav, 1)]);
    press(nav, 'Escape'); nav.render();
    for (const [name, p] of states) {
      expect(p.regions.hint, `${name}: design 1 still declares a hint region`).toBeUndefined();
      for (const phrase of ROW_PHRASES) expect(p.text, `${name}: "${phrase}" is still on the glass`).not.toContain(phrase);
      expect(p.violations, `${name}: layout guard`).toBe(0);
    }
  }, 120000);

  it('⭐ THE SIX TEXELS WENT TO THE MAP AND THE RAIL — both now end at the rule over the tabs', async () => {
    const h = await loadedNav();
    for (const level of [0, 1, 2, 3, 4]) {
      const nav = await at(h, 'rail', level);
      const p = paint(nav, 1);
      const tabsY = p.regions.tabs.y;
      expect(p.regions.map.y + p.regions.map.h, `L${level}: the map stops at the tab strip`).toBe(tabsY);
      expect(p.regions.rail.y + p.regions.rail.h, `L${level}: the rail stops at the tab strip`).toBe(tabsY);
      // the one rule between the panes and the tabs, and no second rule a row higher
      const rules = p.fills.filter((f) => f.x === 0 && f.w === W && f.h === 1 && f.ink === INK.RULE && f.y > 6);
      expect(rules.map((f) => f.y), `L${level}: full-width rules below the status row`).toEqual([tabsY - 1]);
      // ⛔ AND THE HOST-SIDE FALLBACK GEOMETRY AGREES WITH THE PAINT (geometry.js restates it)
      const g = railGeometry(W, H, FACE);
      expect([g.mapY, g.mapH], `L${level}: geometry.js's map band`).toEqual([p.regions.map.y, p.regions.map.h]);
    }
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('(B) SYSTEM says WHICH system it shows, and draws no ship on a foreign one', () => {
  const viewing = (p) => p.lines.filter((l) => l.s.startsWith('VIEWING '));
  const youOnStar = (p, nav) => {
    const star = (nav._viewDriverInst.S.bodyHits || []).find((b) => b.star);
    return p.fills.filter((f) => star && f.ink === INK.CURRENT && f.w === 3 && f.h === 3 && f.x === star.x - 1 && f.y === star.y - 1);
  };
  // ⚠ batch 2 (AC-15): the ship is CURRENT ink, and so is the top bar's CURRENT chip — the ship's ink is the map's.
  const shipInk = (p) => { const m = p.regions.map; return p.fills.filter((f) => f.ink === INK.CURRENT && f.x >= m.x && f.x < m.x + m.w && f.y >= m.y && f.y < m.y + m.h); };

  for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
    it(`design ${design}: a FOREIGN system is named in target ink on the map, and no ship mark is drawn`, async () => {
      const h = await loadedNav();
      const nav = await at(h, mode, 4, { foreign: true });
      const { D } = nav._viewDriverInst;
      expect(D.isCurrent, 'the fixture must be browsing a system the ship is not in').toBe(false);
      // ⛔ FORCE A SHIP INTO D, so the paint's OWN gate is what is tested (state.js already nulls it abroad)
      D.ship = { planetIndex: 0, moonIndex: -1 };
      nav._selectedBody = { type: 'planet', planetIndex: 2 }; nav.render(); D.ship = { planetIndex: 0, moonIndex: -1 };
      const p = paint(nav, design);
      const v = viewing(p);
      expect(v, 'exactly one VIEWING line').toHaveLength(1);
      // ⛔ THE WHOLE NAME, UNCLIPPED — `fit()` eating it would be a line that names nothing
      expect(v[0].s).toBe(`VIEWING ${String(D.sysStar.name).toUpperCase()}`);
      const why = p.lines.filter((l) => l.s === 'NOT CURRENT SYSTEM');   // batch 2: no YOU word anywhere
      expect(why, 'and the line under it says why').toHaveLength(1);
      expect(why[0].y, 'directly under the VIEWING line').toBe(v[0].y + FACE.h + 2);
      // ⭐ batch 2 (AC-15) — TARGET ink ONLY when the system on the glass IS the target (`foreignSysInk`, by
      //    position); browsing one that is not, the lines are BODY. Both halves, on the same frame.
      const tg = nav._viewDriverInst.D.target, ss = nav._systemStar;
      const isTgt = !!(tg && Number.isFinite(tg.wx) && Math.hypot(tg.wx - ss.wx, tg.wz - ss.wz) < 1e-4);
      for (const l of [v[0], why[0]]) expect(l.color, 'the VIEWING lines follow the target rule').toBe(isTgt ? INK.TARGET : '#7fd8e8');
      const sel0 = nav._selectedNavStar, ext0 = nav._externalTarget;
      nav._selectedNavStar = null;
      nav._externalTarget = { name: 'SOMEWHERE ELSE', x: ss.wx + 0.3, y: ss.wy, z: ss.wz };
      nav.render(); D.ship = { planetIndex: 0, moonIndex: -1 };
      for (const l of paint(nav, design).lines.filter((q) => q.s.startsWith('VIEWING ') || q.s === 'NOT CURRENT SYSTEM')) {
        expect(l.color, 'the target is elsewhere: the browsed system is not TARGET ink').toBe('#7fd8e8');
      }
      nav._externalTarget = { name: 'HERE', x: ss.wx, y: ss.wy, z: ss.wz };
      nav.render(); D.ship = { planetIndex: 0, moonIndex: -1 };
      for (const l of paint(nav, design).lines.filter((q) => q.s.startsWith('VIEWING ') || q.s === 'NOT CURRENT SYSTEM')) {
        expect(l.color, 'the shown system IS the target: TARGET ink').toBe(INK.TARGET);
      }
      nav._selectedNavStar = sel0; nav._externalTarget = ext0; nav.render(); D.ship = { planetIndex: 0, moonIndex: -1 };
      for (const l of [v[0], why[0]]) {
        const m = p.regions.map;
        expect(l.x >= m.x && l.y >= m.y && l.y < m.y + m.h, 'on the map, not the header').toBe(true);
      }
      expect(shipInk(p), 'no ship diamond / word / trajectory on a foreign system').toEqual([]);
      if (design === 1) expect(youOnStar(p, nav), 'no YOU mark on a foreign system\'s star').toEqual([]);
      expect(p.violations, 'layout guard').toBe(0);
    }, 60000);

    it(`design ${design}: AT HOME there is no VIEWING line, and the ship IS drawn (the control)`, async () => {
      const h = await loadedNav();
      const nav = await at(h, mode, 4);
      nav._currentFocusIndex = 0; nav._currentMoonIndex = -1;
      nav._selectedBody = { type: 'planet', planetIndex: 2 };
      nav.render();
      expect(nav._viewDriverInst.D.isCurrent, 'the fixture must be at home').toBe(true);
      const p = paint(nav, design);
      expect(viewing(p), 'no VIEWING line in your own system').toEqual([]);
      expect(shipInk(p).length, 'the ship is drawn at home — else the foreign case proves nothing').toBeGreaterThan(0);
      if (design === 1) expect(youOnStar(p, nav), 'the YOU mark sits on your own star').toHaveLength(1);
    }, 60000);
  }

  it('design 2: the companion strip steps down under the VIEWING line instead of colliding with it', async () => {
    const h = await loadedNav();
    const nav = await at(h, 'bars', 4, { foreign: true });
    nav._systemData.binarySeparationAU = 400; nav._systemData.isBinary = true; nav._systemData.star2 = { type: 'M' };
    nav.render();
    const p = paint(nav, 2);
    const v = viewing(p)[0];
    const c = nav._viewDriverInst.S.companionRect;
    expect(v && c, 'both the VIEWING line and the companion strip are drawn').toBeTruthy();
    expect(c.y, 'the strip sits below both VIEWING lines').toBeGreaterThanOrEqual(v.y + 2 * (FACE.h + 2));
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('(C) in ORRERY (nav.commitIsView) the commit reads GO TO, and Enter dispatches the same action', () => {
  async function home(mode, isView) {
    const h = await loadedNav();
    const nav = await at(h, mode, 4);
    nav.commitIsView = isView;
    nav._selectedBody = { type: 'planet', planetIndex: 1 };
    nav._commitAction = nav._buildCommitAction();
    nav.render();
    return nav;
  }
  const commitRow = (p) => p.lines.filter((l) => l.y === 234).map((l) => l.s).join(' ');

  it('design 1: GO TO <body> under commitIsView, BURN TO <body> without it', async () => {
    for (const [isView, want, not] of [[true, 'GO TO ', 'BURN TO'], [false, 'BURN TO ', 'GO TO']]) {
      const nav = await home('rail', isView);
      expect(nav._viewDriverInst.D.commitIsView).toBe(isView);
      const name = String(nav._viewDriverInst.D.selBody.name).toUpperCase();
      const row = commitRow(paint(nav, 1));
      expect(row, `commitIsView ${isView}`).toContain(want + name);
      expect(row).not.toContain(not);
    }
    // and the unarmed prompt follows the same word
    const nav = await home('rail', true);
    nav._selectedBody = null; nav.render();
    expect(commitRow(paint(nav, 1))).toBe('SELECT A BODY TO GO TO');
  }, 60000);

  it('design 2: the chip reads [GO TO] under commitIsView, fits its own rectangle, and stays armed', async () => {
    for (const [isView, chip] of [[true, '[GO TO]'], [false, '[BURN]']]) {
      const nav = await home('bars', isView);
      const p = paint(nav, 2);
      const r = nav._viewDriverInst.S.chipRect;
      const drawn = p.lines.find((l) => l.s === chip);
      expect(drawn, `commitIsView ${isView}: chip ${chip}`).toBeTruthy();
      expect(r.armed).toBe(true);
      expect(drawn.x + measurePixelText(chip) <= r.x + r.w, 'the word fits the chip').toBe(true);
      expect(p.violations, 'layout guard').toBe(0);
    }
  }, 60000);

  it('⛔ ENTER DISPATCHES THE SAME ACTION OBJECT EITHER WAY — only the word changed', async () => {
    const got = {};
    for (const isView of [false, true]) {
      const nav = await home('rail', isView);
      let fired = null;
      nav._onCommit = (a) => { fired = a; };
      press(nav, 'Enter');
      expect(fired, `commitIsView ${isView}: Enter committed nothing`).toBeTruthy();
      got[isView] = fired;
    }
    expect(got[true].type).toBe('burn');
    expect(got[true]).toEqual(got[false]);
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('(D) fixup — at home on SYSTEM with no body picked, a live star target IS the commit (Astra 2026-10-02)', () => {
  /** Home SYSTEM, nothing picked, and the selection set to a star that is NOT here (an adopted sky click). */
  async function homeWithTarget(mode, { target = true } = {}) {
    const h = await loadedNav();
    const nav = await at(h, mode, 4);
    nav._currentSystemName = nav._systemStar.name;
    nav._selectedBody = null; nav._commitAction = null;
    const far = nav._localStars.filter((s) => s !== nav._systemStar && s.name).reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
    nav._selectedNavStar = target ? far : nav._systemStar;
    nav.render();
    nav.farName = String(far.name).toUpperCase();
    return nav;
  }
  const commitRow = (p) => p.lines.filter((l) => l.y === 234);

  it('design 1: the row reads WARP TO <star> in target ink — not "SELECT A BODY TO …" under a TGT naming it', async () => {
    const nav = await homeWithTarget('rail');
    expect(nav._viewDriverInst.D.isCurrent, 'the fixture must be at home').toBe(true);
    const p = paint(nav, 1);
    const row = commitRow(p);
    expect(row.map((l) => l.s).join(' ').startsWith(`WARP TO ${nav.farName} · `), 'WARP TO <the target>').toBe(true);
    expect(p.fills.find((f) => f.x === 0 && f.y === 234 && f.w === W)?.ink, 'the bar is lit, in target ink').toBe(INK.TARGET);
    expect(p.violations).toBe(0);
  }, 60000);

  it('design 2: the chip reads [WARP] and is armed', async () => {
    const nav = await homeWithTarget('bars');
    const p = paint(nav, 2);
    expect(p.lines.find((l) => l.s === '[WARP]'), 'chip [WARP]').toBeTruthy();
    expect(nav._viewDriverInst.S.chipRect.armed).toBe(true);
  }, 60000);

  it('⛔ controls: home selected → the prompt and an unarmed chip; a picked body still wins over the star', async () => {
    let nav = await homeWithTarget('rail', { target: false });
    expect(commitRow(paint(nav, 1)).map((l) => l.s).join(' ')).toBe('SELECT A BODY TO BURN');
    nav = await homeWithTarget('bars', { target: false });
    paint(nav, 2);
    expect(nav._viewDriverInst.S.chipRect.armed).toBe(false);
    nav = await homeWithTarget('rail');
    nav._selectedBody = { type: 'planet', planetIndex: 1 }; nav._commitAction = nav._buildCommitAction(); nav.render();
    expect(commitRow(paint(nav, 1)).map((l) => l.s).join(' ')).toMatch(/^BURN TO /);
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('(C) fixup — the LEGACY nav\'s commit button follows nav.commitIsView too (Astra 2026-10-02)', () => {
  /** Today's nav (no view mode) at home on SYSTEM with a planet armed; optionally in its planet close-up. */
  async function legacy(isView, { detail = false, foreign = false } = {}) {
    const h = await makeHeadlessNav({ width: 614, height: 512 });
    const { nav, rec } = h;
    nav._levelIndex = 3; nav.render();
    await at(h, null, 4, { foreign });
    nav.commitIsView = isView;
    nav._selectedBody = { type: 'planet', planetIndex: 1 };
    nav._commitAction = nav._buildCommitAction();
    if (detail) { nav._systemMode = 'planet'; nav._selectedPlanetIdx = 1; }
    rec.text.length = 0;
    nav.render();
    return rec.text.map((t) => t.text);
  }

  for (const detail of [false, true]) {
    it(`${detail ? 'planet close-up' : 'SYSTEM'}: [ GO TO ] in ORRERY, [ BURN ] in HELM`, async () => {
      const orrery = await legacy(true, { detail });
      expect(orrery, 'ORRERY: the button still says BURN while it glides the view').toContain('[ GO TO ]');
      expect(orrery).not.toContain('[ BURN ]');
      const helm = await legacy(false, { detail });
      expect(helm).toContain('[ BURN ]');
      expect(helm).not.toContain('[ GO TO ]');
    }, 60000);
  }

  it('a FOREIGN system still reads [ WARP ] in either regime', async () => {
    for (const isView of [true, false]) expect(await legacy(isView, { foreign: true })).toContain('[ WARP ]');
  }, 60000);
});
