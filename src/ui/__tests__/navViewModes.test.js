/**
 * navViewModes — designs 1 and 2 as switchable modes on the full-screen nav.
 *
 * ⭐ WHAT THESE TESTS ARE ACTUALLY FOR. The designs themselves are lifted verbatim from
 * `nav-240p-lab.html`, where Max already ruled on the pictures, so re-asserting their layout here
 * would be testing the lab. What is NEW — and therefore what can be wrong — is three things: the
 * ADAPTER that feeds live instrument state into the `S` / `D` shape the lab invented, the DISPATCH
 * that decides when a mode paints, and the GATE that keeps every one of them off the cockpit glass.
 * Each case below aims at one of those.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { NAV_VIEW_MODES, nextViewMode, loadViewMode, saveViewMode, NAV_VIEW_MODE_KEY } from '../navViewModes/index.js';

/** A nav with the prism loaded, which is what every design needs before it can draw anything real. */
async function loadedNav({ width = 427, height = 240 } = {}) {
  const h = await makeHeadlessNav({ width, height });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = 3;
  h.nav.viewMode = 'rail';
  h.nav.render();                       // populates _localStars via _renderLocal's own loader
  h.star = h.nav._localStars.find((s) => s.dist > 1e-9);
  return h;
}


/**
 * A system with more bodies than the ladder can hold. ⛔ BUILT, NOT FOUND: whichever star the
 * fixture happens to load varies with the seed and the load order, and a scroll test against a
 * four-planet system asserts nothing — the ladder never overflows, so it never scrolls.
 */
async function crowdedLadder(n = 40) {
  const h = await loadedNav();
  h.nav.viewMode = 'rail';
  h.nav._systemStar = { wx: 8, wy: 0, wz: 0, seed: 4242, spectral: 'G', name: 'Crowded' };
  h.nav._systemData = {
    star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
    planets: Array.from({ length: n }, (_, i) => ({
      orbitRadiusAU: 0.2 + i * 0.9, moons: [],
      planetData: { radiusEarth: 1 + (i % 5), T_eq: 250, habitability: { score: 0.1 }, rings: false },
    })),
  };
  h.nav._levelIndex = 4;
  h.nav.render();
  return h;
}

describe('the mode cycle', () => {
  it('starts at today\'s nav and returns to it', () => {
    expect(NAV_VIEW_MODES[0]).toBe(null);
    expect(nextViewMode(null)).toBe('rail');
    expect(nextViewMode('rail')).toBe('bars');
    expect(nextViewMode('bars')).toBe(null);
  });

  it('⛔ does not offer design 3 — all three judges killed it', () => {
    expect(NAV_VIEW_MODES).toHaveLength(3);
    expect(NAV_VIEW_MODES).not.toContain('panel');
  });

  it('survives a round trip through storage, and an unreadable store', () => {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
    saveViewMode('bars'); expect(loadViewMode()).toBe('bars');
    saveViewMode(null);   expect(loadViewMode()).toBe(null);
    store.set(NAV_VIEW_MODE_KEY, 'nonsense'); expect(loadViewMode()).toBe(null);
    globalThis.localStorage = { getItem() { throw new Error('site data blocked'); }, setItem() { throw new Error('nope'); }, removeItem() {} };
    expect(loadViewMode()).toBe(null);
    expect(() => saveViewMode('rail')).not.toThrow();
  });
});

describe('the adapter feeds the designs real instrument state', () => {
  it('ranks the loaded prism stars, names them, and knows which one you are in', async () => {
    const { nav } = await loadedNav();
    const { D } = nav._viewDriverInst;
    expect(D.stars.length, 'the prism must have loaded').toBeGreaterThan(100);
    expect(D.starRows).toHaveLength(D.stars.length);
    expect(D.starRows.every((r) => r.name), 'every ranked row carries a name').toBe(true);
    // sorted by distance, nearest first — the rail's whole premise
    for (let i = 1; i < D.starRows.length; i++) expect(D.starRows[i].dist).toBeGreaterThanOrEqual(D.starRows[i - 1].dist);
    expect(D.here?.name, 'the system you are IN').toBe(D.starRows[0].name);
    expect(D.sectorRows.length, 'all 775 sectors, ranked once').toBe(775);
  });

  it('⭐ takes the system the PILOT drilled into, not one it picked for itself', async () => {
    const { nav, star } = await loadedNav();
    nav.openToCurrentSystem(star);
    nav.render();
    const { D } = nav._viewDriverInst;
    expect(D.sysStar?.seed).toBe(star.seed);
    expect(D.bodies.length).toBeGreaterThan(0);
    expect(D.bodies.every((b) => typeof b.au === 'number')).toBe(true);
    // AU-ordered planets — what every design's SYSTEM level reads
    const planets = D.bodies.filter((b) => b.kind === 'planet');
    for (let i = 1; i < planets.length; i++) expect(planets[i].au).toBeGreaterThanOrEqual(planets[i - 1].au);
  });

  it('⛔ survives a system with no bodies at all — unreachable in the lab, reachable here', async () => {
    const { nav } = await loadedNav();
    nav._systemStar = { wx: 8, wy: 0, wz: 0, seed: 7, spectral: 'M', name: 'Empty' };
    nav._systemData = { planets: [], asteroidBelts: [] };
    nav._levelIndex = 4;
    for (const mode of ['rail', 'bars']) {
      nav.viewMode = mode;
      expect(() => nav.render(), `${mode} on an empty system`).not.toThrow();
      expect(nav._viewDriverInst.D.bodies).toEqual([]);
    }
  });
});

describe('both designs draw every level', () => {
  for (const mode of ['rail', 'bars']) {
    it(`${mode} paints all five levels with no layout overflow`, async () => {
      const { nav, rec, star } = await loadedNav();
      nav.viewMode = mode;
      for (const level of [0, 1, 2, 3, 4]) {
        if (level === 4) nav.openToCurrentSystem(star); else nav._levelIndex = level;
        rec.calls.length = 0;
        expect(() => nav.render(), `${mode} at level ${level}`).not.toThrow();
        const fills = rec.calls.filter((c) => c.op === 'fillRect').length;
        expect(fills, `${mode} level ${level} drew nothing`).toBeGreaterThan(200);
        const bad = nav._viewDriverInst.violations()
          // ⚠ THE ONE KNOWN EXCEPTION, AND IT IS THE DESIGN'S OWN DECLARED TOP RISK, not a port defect.
          // The lab says so at its own draw site: design 1's SYSTEM level is a sqrt(AU) ladder with a
          // left-to-right 8-texel minimum-separation pass, and on a system whose bodies bunch at the
          // low end that pass walks the last ones off the end of the axis. They draw in WARN at the
          // edge so the failure is VISIBLE rather than an invisible glyph outside the pane — which is
          // exactly the call Max has to make. ⛔ Do not silence it; it is the instrument reporting.
          .filter((v) => !/SYSTEM ladder/.test(v.msg));
        expect(bad, `${mode} level ${level}: ${JSON.stringify(bad)}`).toHaveLength(0);
      }
    });
  }

  it('⛔ THE GUARD IS PROVED TO FIRE, not asserted to work', async () => {
    // A layout that overflows LOOKS fine on a canvas — the canvas clips the overflow for free. So the
    // guard is the only difference between "this design fits" and "this design was cropped", and a
    // guard that has never been made to fail is not yet a guard.
    const { nav } = await loadedNav();
    for (const mode of ['rail', 'bars']) {
      nav.viewMode = mode; nav._levelIndex = 3;
      nav._viewDriverInst.S.sabotage = false;
      nav.render();
      expect(nav._viewDriverInst.violations(), `${mode} clean`).toHaveLength(0);
      nav._viewDriverInst.S.sabotage = true;
      nav.render();
      expect(nav._viewDriverInst.violations().length, `${mode} sabotaged`).toBeGreaterThan(0);
      nav._viewDriverInst.S.sabotage = false;
    }
  });
});

describe('the buffer, and what must not move', () => {
  it('a mode takes the world\'s low-res buffer; today\'s nav keeps its CSS box', async () => {
    const { nav, canvas } = await loadedNav({ width: 1560, height: 860 });
    nav.viewMode = null;
    nav._resizeCanvas();
    expect([canvas.width, canvas.height], 'legacy keeps the layout box').toEqual([1560, 860]);
    nav.viewMode = 'rail';
    nav._resizeCanvas();
    expect(canvas.height, 'a mode drops to the world\'s line count').toBe(240);
    expect(canvas.width, 'width follows the box aspect at that line count')
      .toBe(Math.round((1560 / 860) * 240));
  });

  it('⛔ THE COCKPIT PANEL CAN NEVER ACQUIRE A MODE — the gate is activate(), not _bare', async () => {
    // `_openCockpitNav` never calls activate() (attachKeys' own note in NavComputer records why), so
    // a panel instance never has _viewModesEnabled set and its V key is inert. ⛔ NOT keyed off
    // `_bare`: NavPanel writes chromeless = false every paint, so _bare is permanently FALSE there
    // and a mode keyed off it would be a no-op that looks exactly like a wiring failure.
    const { nav, canvas } = await makeHeadlessNav({ width: 52, height: 43 });
    expect(nav._viewModesEnabled, 'a fresh instance is not a mode host').toBe(false);
    nav.viewMode = null;
    nav._resizeCanvas();
    expect([canvas.width, canvas.height], 'the panel keeps its own buffer').toEqual([52, 43]);
  });

  it('with no mode set, render() never touches the view-mode driver at all', async () => {
    const { nav } = await makeHeadlessNav({ width: 614, height: 512 });
    nav._levelIndex = 3;
    nav.render();
    // `null` is today's nav BY CONSTRUCTION: the driver is never even built, the way pixelType: null
    // never enters navPixelType.js. This is the assertion that keeps that true as the file changes.
    expect(nav._viewDriverInst).toBe(null);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// OPERABILITY. ⭐ THE DEFECT THESE GUARD AGAINST HAS A NAME AND A PRICE: AC-4 of the previous
// workstream shipped five level tabs DRAWN WHERE THEY COULD NOT BE PRESSED, because the strip's
// height moved in the renderer and not in the hit-test. Every case below asserts an OBSERVABLE
// CONSEQUENCE of a click — the level changed, the commit fired, the star was drilled — never that a
// rectangle has the coordinates I think it has.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the modes are operable', () => {
  for (const mode of ['rail', 'bars']) {
    it(`${mode}: every level tab changes level when clicked where it is drawn`, async () => {
      const { nav } = await loadedNav();
      nav.viewMode = mode;
      nav._levelIndex = 3;
      nav.render();
      const g = nav._viewDriverInst.geo(nav._canvas.width, nav._canvas.height);
      for (const i of [0, 1, 2, 3]) {                 // 4 = SYSTEM needs a star and is covered below
        const x = mode === 'bars' ? g.tabs[i].x + g.tabs[i].w / 2 : (i + 0.5) * g.tabW;
        const y = mode === 'bars' ? g.BAR / 2 : g.tabY + g.LEAD / 2;
        nav._handleMouseDown({ clientX: x, clientY: y, button: 0 });
        nav._handleMouseUp();
        nav._handleClick({ clientX: x, clientY: y, button: 0 });
        // A 2D->2D tab starts a drill ANIMATION rather than snapping, so accept either.
        const landed = nav._anim ? nav._anim.toLevel ?? nav._levelIndex : nav._levelIndex;
        expect(landed, `${mode} tab ${i} did not reach level ${i}`).toBe(i);
        nav._anim = null; nav._levelIndex = i;
        nav.render();
      }
      // ⚠ 30 s, AND IT IS NOT A LOOSENING. This case renders FIVE full frames across four levels
      // after a prism load, and under a full `--dir src/ui` run it has been the suite's one flake
      // since before this workstream — recorded in the close-pass MEASUREMENTS §0, where it failed
      // once under the directory run and passed 3/3 in isolation. It presents as a 5000 ms TIMEOUT,
      // never as a wrong answer, so the default budget was measuring the box's contention rather
      // than the tab strip. Re-verified 3/3 in isolation on 2026-09-08 before this was raised.
    }, 30000);

    it(`${mode}: the tab band the hit-test derives contains the highlight the design paints`, async () => {
      // ⭐ THE AGREEMENT TEST. `geometry.js` restates the horizontal subdivision of the tab strip —
      // the one thing it cannot take from `regions()` — so it is a second copy of numbers that live
      // inside verbatim draw code. This finds the rectangle the design actually fills under the
      // ACTIVE tab and asserts the derived band contains it. Drift in either copy fails here.
      const { nav, rec } = await loadedNav();
      nav.viewMode = mode;
      for (const level of [0, 1, 2, 3]) {
        nav._levelIndex = level;
        rec.calls.length = 0;
        nav.render();
        const g = nav._viewDriverInst.geo(nav._canvas.width, nav._canvas.height);
        const band = mode === 'bars'
          ? { x: g.tabs[level].x, w: g.tabs[level].w, y: 0, h: g.BAR }
          : { x: level * g.tabW, w: g.tabW, y: g.tabY - 1, h: g.LEAD };
        // the active-tab mark: design 1 fills the whole cell, design 2 underlines it
        const marks = rec.calls.filter((c) => c.op === 'fillRect')
          .map((c) => c.args)
          .filter(([x, y, w2, h2]) => w2 > 2 && h2 >= 1
            && y >= band.y - 2 && y <= band.y + band.h
            && x >= band.x - 3 && x + w2 <= band.x + band.w + 3);
        expect(marks.length, `${mode} level ${level}: no active-tab mark inside the derived band`)
          .toBeGreaterThan(0);
      }
    });

    it(`${mode}: the commit button the design draws is the one the click handler tests`, async () => {
      const { nav, star } = await loadedNav();
      nav.viewMode = mode;
      nav.openToCurrentSystem(star);
      let fired = null;
      nav._onCommit = (a) => { fired = a; };
      nav.render();
      const r = nav._commitButtonRect;
      expect(r, 'render() must publish a commit rect').toBeTruthy();
      expect(nav._commitAction, 'a drilled system arms a commit').toBeTruthy();
      nav._handleMouseDown({ clientX: r.x + r.w / 2, clientY: r.y + r.h / 2, button: 0 });
      nav._handleMouseUp();
      nav._handleClick({ clientX: r.x + r.w / 2, clientY: r.y + r.h / 2, button: 0 });
      expect(fired, `${mode}: clicking the drawn commit button did not fire`).toBeTruthy();
    });

    it(`${mode}: picking a star from the list drills into its system`, async () => {
      const { nav } = await loadedNav();
      nav.viewMode = mode;
      nav._levelIndex = 3;
      if (mode === 'bars') nav._viewDriverInst.toggleList();   // design 2's picker is its 'L' mode
      nav.render();
      const g = nav._viewDriverInst.geo(nav._canvas.width, nav._canvas.height);
      const row = 1;                                            // row 0 is the system you are in
      const x = mode === 'bars' ? 20 : g.railX + 4;
      const y = mode === 'bars' ? g.listTop + (row + 1) * g.LEAD : g.rowY(row);
      nav._handleMouseMove({ clientX: x, clientY: y });
      expect(nav._hoveredLocalStar, `${mode}: the list row did not resolve to a star`).toBeTruthy();
      const picked = nav._hoveredLocalStar.star;
      expect(nav._localStars, 'the star handed on must be the LIVE one, not the ranked copy')
        .toContain(picked);
      nav._handleMouseDown({ clientX: x, clientY: y, button: 0 });
      nav._handleMouseUp();
      nav._handleClick({ clientX: x, clientY: y, button: 0 });
      expect(nav._selectedNavStar?.seed, `${mode}: the click did not select the listed star`)
        .toBe(picked.seed);
    });
  }

  it('rail: a body row at SYSTEM selects that body, moons included', async () => {
    const { nav, star } = await loadedNav();
    nav.viewMode = 'rail';
    nav.openToCurrentSystem(star);
    nav.render();
    const { D } = nav._viewDriverInst;
    const g = nav._viewDriverInst.geo(nav._canvas.width, nav._canvas.height);
    const idx = D.bodies.findIndex((b) => b.kind === 'planet');
    expect(idx, 'the fixture system must have a planet').toBeGreaterThanOrEqual(0);
    nav._handleMouseMove({ clientX: g.railX + 4, clientY: g.rowY(idx) });
    expect(nav._hoveredBody).toEqual({ type: 'planet', index: D.bodies[idx].pIdx });
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE SCROLLABLE SYSTEM LADDER. Max, 2026-09-07, ruling on the "+3 OFF AXIS" pile-up:
// *"Let's make it scrollable; rather than 'off axis' have the line end in a '...' that we can scroll
// toward horizontally, revealing the other bodies in that direction."*
//
// ⭐ THE ASSERTION THAT MATTERS IS "REVEALING". A test that only checks the scroll VALUE moves would
// pass on a ladder that scrolls a window over nothing. Each case below either names a body that was
// not drawn before and is drawn after, or counts tags.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the SYSTEM ladder scrolls', () => {
  /** The window `d1Ladder` published this frame: [firstVisibleIndex, lastVisibleIndex]. */
  const windowOf = (nav) => nav._viewDriverInst.S.ladderVisible;

  it('⛔ NO BODY IS PILED UP AT THE END ANY MORE — the guard that used to fire is gone', async () => {
    const { nav } = await crowdedLadder();
    const msgs = nav._viewDriverInst.violations().map((v) => v.msg);
    expect(msgs.filter((m) => /OFF AXIS|ran past the end/.test(m)),
      'the overflow the ruling removed').toHaveLength(0);
  });

  it('⭐ SCROLLING RIGHT REVEALS BODIES THAT WERE NOT ON THE GLASS BEFORE', async () => {
    const { nav } = await crowdedLadder();
    const { S } = nav._viewDriverInst;
    expect(S.ladderMax, 'a 40-planet ladder must need far more axis than the pane has').toBeGreaterThan(0);
    const before = windowOf(nav).slice();
    for (let i = 0; i < 60 && S.ladderScroll < S.ladderMax; i++) { nav._viewDriverInst.scrollLadder(1); nav.render(); }
    const after = windowOf(nav);
    expect(after[1], 'the far end shows a later body than the near end did').toBeGreaterThan(before[1]);
    expect(after[0], 'and the window really moved, rather than just growing').toBeGreaterThan(before[0]);
  });

  it('clamps at both ends and comes back to where it started', async () => {
    const { nav } = await crowdedLadder();
    const { S } = nav._viewDriverInst;
    for (let i = 0; i < 80; i++) { nav._viewDriverInst.scrollLadder(1); nav.render(); }
    expect(S.ladderScroll).toBe(S.ladderMax);
    for (let i = 0; i < 80; i++) { nav._viewDriverInst.scrollLadder(-1); nav.render(); }
    expect(S.ladderScroll).toBe(0);
  });

  it('⭐ EVERY BODY IS REACHABLE — the ruling was "revealing", not "hiding instead of piling up"', async () => {
    const { nav } = await crowdedLadder();
    const { S, D } = nav._viewDriverInst;
    const laddered = D.bodies.filter((b) => b.kind !== 'moon').length;
    const seen = new Set();
    for (let i = 0; i < 80; i++) {
      const [f, l] = windowOf(nav);
      for (let k = f; k <= l; k++) seen.add(k);
      if (S.ladderScroll >= S.ladderMax) break;
      nav._viewDriverInst.scrollLadder(1);
      nav.render();
    }
    expect(seen.size, `only ${seen.size} of ${laddered} laddered bodies could ever be brought on screen`)
      .toBe(laddered);
  });

  it('⭐ THE "..." IS ON THE GLASS, AND ONLY AT AN END THAT HAS SOMETHING BEYOND IT', async () => {
    // Max asked for the LINE TO END IN "...", so the mark itself is the deliverable, not the scroll
    // state behind it. `d1Ladder` draws it as three 1x1 texels ON the axis row at the end that
    // continues — so this counts them at each end, at the y the paint published.
    const { nav, rec } = await crowdedLadder();
    const { S } = nav._viewDriverInst;
    const dotsAt = (side) => {
      const c = S.ladderCaps;
      rec.calls.length = 0;
      nav.render();
      const xs = side === 'left' ? [c.x0, c.x0 + 2, c.x0 + 4] : [c.x1 - 5, c.x1 - 3, c.x1 - 1];
      return rec.calls.filter((k) => k.op === 'fillRect')
        .filter((k) => { const [x, y, w, h] = k.args; return w === 1 && h === 1 && y === c.axisY && xs.includes(x); }).length;
    };
    expect(S.ladderMax, 'the fixture must overflow or the caps mean nothing').toBeGreaterThan(0);
    expect(S.ladderScroll).toBe(0);
    expect(dotsAt('right'), 'at the near end the line must continue to the right').toBe(3);
    expect(dotsAt('left'), 'and must NOT advertise a left it does not have').toBe(0);

    for (let i = 0; i < 80 && S.ladderScroll < S.ladderMax; i++) { nav._viewDriverInst.scrollLadder(1); nav.render(); }
    expect(dotsAt('left'), 'at the far end the line continues to the left').toBe(3);
    expect(dotsAt('right'), 'and no longer to the right').toBe(0);
    expect(windowOf(nav)[1], 'the far end shows the last body').toBe(
      nav._viewDriverInst.D.bodies.filter((x) => x.kind !== 'moon').length - 1);
  });

  it('a click on the right "..." scrolls, and does NOT also fall through to the body picker', async () => {
    const { nav } = await crowdedLadder();
    const { S } = nav._viewDriverInst;
    const caps = S.ladderCaps;
    expect(caps, 'd1Ladder must publish where it drew its caps').toBeTruthy();
    const before = S.ladderScroll;
    const selBefore = nav._selectedBody;
    const x = caps.x1 - 2, y = caps.axisY;
    nav._handleMouseDown({ clientX: x, clientY: y, button: 0 });
    nav._handleMouseUp();
    nav._handleClick({ clientX: x, clientY: y, button: 0 });
    expect(S.ladderScroll, 'the cap click did not scroll').toBeGreaterThan(before);
    expect(nav._selectedBody, 'the cap click also reached the picker underneath').toBe(selBefore);
  });

  it('a new system opens at the left of its own ladder', async () => {
    const { nav } = await crowdedLadder();
    const { S } = nav._viewDriverInst;
    for (let i = 0; i < 10; i++) { nav._viewDriverInst.scrollLadder(1); nav.render(); }
    expect(S.ladderScroll).toBeGreaterThan(0);
    nav._systemStar = { wx: 8, wy: 0, wz: 0, seed: 99, spectral: 'M', name: 'Elsewhere' };
    nav._systemData = { planets: [], asteroidBelts: [] };
    nav.render();
    // ⛔ inheriting the previous system's offset opens a one-planet system scrolled past its planet
    expect(S.ladderScroll).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ⛔⛔ THE KEYBOARD, DRIVEN THROUGH THE REAL HANDLER — THE COVERAGE GAP THAT LET A DEAD MODE KEY SHIP.
//
// On 2026-09-07 `V` did nothing in the running game and Max found it: "I'm still seeing the old
// menus". The cause was not logic. `NavComputer.js` keeps its line count fixed so its ~700
// line-anchored citations stay valid, so new statements are FOLDED onto existing lines — and the V
// clause had been folded in AFTER a `//` note about the ladder keys, which commented out every
// statement following it on that line. The handler was there, parsed, unreachable.
//
// ⭐ AND EVERY TEST ABOVE PASSED, because every one of them sets `nav.viewMode` directly or calls a
// driver method. Not one drove the keyboard, so the suite was structurally incapable of seeing it.
// These cases exist to make that impossible again: they go through `_onKeyDown`, the same entry the
// document listener calls, and assert the observable each key is supposed to produce.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the keys reach the handler', () => {
  const press = (nav, code) => nav._onKeyDown({ code, preventDefault() {}, stopPropagation() {} });

  it('⛔ V CYCLES THE MODE THROUGH THE REAL KEYDOWN PATH', async () => {
    const { nav } = await loadedNav();
    nav._viewModesEnabled = true;
    nav.viewMode = null;
    press(nav, 'KeyV'); expect(nav.viewMode, 'first V').toBe('rail');
    press(nav, 'KeyV'); expect(nav.viewMode, 'second V').toBe('bars');
    press(nav, 'KeyV'); expect(nav.viewMode, 'third V returns to today\'s nav').toBe(null);
  });

  it('L toggles design 2\'s list, and only in design 2', async () => {
    const { nav } = await loadedNav();
    nav._viewModesEnabled = true;
    nav.viewMode = 'bars';
    nav.render();
    const before = nav._viewDriverInst.S.list;
    press(nav, 'KeyL');
    expect(nav._viewDriverInst.S.list, 'L in design 2').toBe(!before);
    nav.viewMode = 'rail';
    const railBefore = nav._viewDriverInst.S.list;
    press(nav, 'KeyL');
    expect(nav._viewDriverInst.S.list, 'L must not toggle a list design 1 does not have').toBe(railBefore);
  });

  it(', and . walk the ladder through the real keydown path', async () => {
    const { nav } = await crowdedLadder();
    nav._viewModesEnabled = true;
    const { S } = nav._viewDriverInst;
    expect(S.ladderScroll).toBe(0);
    press(nav, 'Period'); nav.render();
    expect(S.ladderScroll, '. steps right').toBeGreaterThan(0);
    press(nav, 'Comma'); nav.render();
    expect(S.ladderScroll, ', steps back').toBe(0);
  });

  it('⛔ none of the mode keys fire while the search field has focus', async () => {
    // The guard this file's handler opens with — the six pan letters must not be eaten out of the
    // text field, and neither must V.
    const { nav } = await loadedNav();
    nav._viewModesEnabled = true;
    nav.viewMode = null;
    nav._searchFocused = true;
    press(nav, 'KeyV');
    expect(nav.viewMode, 'V typed into the search box must stay text').toBe(null);
    nav._searchFocused = false;
  });

  it('⛔ AND NONE OF THEM FIRE ON THE COCKPIT PANEL, whatever is pressed there', async () => {
    const { nav } = await makeHeadlessNav({ width: 52, height: 43 });
    expect(nav._viewModesEnabled).toBe(false);
    for (const code of ['KeyV', 'KeyL', 'Comma', 'Period']) press(nav, code);
    expect(nav.viewMode).toBe(null);
  });
});
