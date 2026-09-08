/**
 * navKeys — the five view-mode key bindings, driven through the REAL `_onKeyDown`.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════════
 * ⛔⛔ WHY THIS FILE EXISTS AND WHY EVERY CASE GOES THROUGH `nav._onKeyDown`.
 *
 * On 2026-09-07 the `V` key shipped present, parsed and unreachable. `NavComputer.js` keeps its line
 * count fixed at 4711 because ~700 line-anchored citations ride it, so new statements are FOLDED onto
 * existing lines — and the V clause had been folded in after a `//` note, which comments out every
 * statement following it on that line. All 28 view-mode tests were green, because every one of them
 * set `nav.viewMode` directly or called a driver method. Not one drove the keyboard, so the suite was
 * structurally incapable of seeing it. Max found it by playing the game: "I'm still seeing the old
 * menus".
 *
 * ⭐ THE RULE THIS FILE OBEYS: assert the OBSERVABLE CONSEQUENCE of a key press, never that the code
 * exists. Ask of every green case — what input in its sample could make it fail? A case that cannot
 * fail is pinning nothing. Here the observable is "the named driver method was invoked, with the
 * right argument, and the event was stopped", because the binding is what this file owns; the
 * driver's own behaviour belongs to `navPicking.test.js` under the same contract
 * (`docs/WORKSTREAMS/nav-menu-elements-functional/INTERFACE.md` §3).
 *
 * ⚠ THE DRIVER METHODS MAY NOT EXIST YET. `navViewModes/index.js` is a separate owner, landing in
 * parallel. The clauses call them optionally so a key is an inert no-op until its method lands rather
 * than a throw — a throw out of a handler under `PanelHost` stops the uploads and freezes the glass on
 * the last good frame, which still looks alive. The spies below are installed ON the live driver
 * instance, so these cases pin the binding whether or not the implementation has landed; the one case
 * that needs the real `commit()` is `runIf`-gated and REPORTS AS SKIPPED rather than passing silently.
 * ══════════════════════════════════════════════════════════════════════════════════════════════════
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav, clickAt, tabCentre } from './helpers/headlessNav.mjs';
import { makeViewModeDriver } from '../navViewModes/index.js';
import { simClockMs, _setSimClockMs } from '../../core/SimClock.js';

/** The driver surface the KEYS clauses call, per INTERFACE.md §3. */
const DRIVER_KEYS = ['tabLevel', 'commit', 'cycleSort', 'page', 'searchOpen', 'searchActive', 'searchKey'];

/**
 * Which of the agreed §3 methods the DRIVER has actually landed, measured off a real driver rather
 * than assumed. Used only to `runIf`-gate the end-to-end cases, so a missing implementation reports
 * as SKIPPED — visible in the run — instead of as a green test that exercised nothing.
 */
const DRIVER_HAS = await (async () => {
  const { nav } = await makeHeadlessNav({ width: 427, height: 240 });
  const drv = makeViewModeDriver(nav);
  return Object.fromEntries(DRIVER_KEYS.map((k) => [k, typeof drv[k] === 'function']));
})();

/** The 240p overlay with the prism loaded — what every design needs before it draws anything real. */
async function loadedNav({ width = 427, height = 240, mode = 'rail', level = 3 } = {}) {
  const h = await makeHeadlessNav({ width, height });
  h.nav._viewModesEnabled = true;      // what activate() sets; _openCockpitNav never calls it
  h.nav._levelIndex = level;
  h.nav.viewMode = mode;
  h.nav.render();                      // builds _viewDriverInst and populates _localStars
  return h;
}

/**
 * Press a key through the handler the document listener actually calls, and report what the handler
 * did to the event.
 *
 * ⛔ `stopPropagation` is not bookkeeping here. `Tab` is bound globally at `main.js:14016`/`:14056`
 * and `BracketLeft`/`BracketRight` at `main.js:13497`/`:13510` (star-glow gradient, quantize
 * toggle), and NEITHER of those is gated on the nav being open — so a clause that forgets to stop
 * the event also pops a debug toast over the map while the pilot is sorting a list. That is a real
 * defect a test can catch and an eye on a screenshot cannot.
 */
function press(nav, code, extra = {}) {
  const seen = { prevented: 0, stopped: 0 };
  nav._onKeyDown({
    code,
    preventDefault() { seen.prevented++; },
    stopPropagation() { seen.stopped++; },
    ...extra,
  });
  return seen;
}

/**
 * Replace the driver's key-facing surface with recorders, ON THE LIVE INSTANCE the clauses reach.
 *
 * `searchActive` answers false unless a case says otherwise, because the FIRST clause on the fold
 * line offers every keystroke to the drawn search field before anything else looks at it — the order
 * INTERFACE.md §3 specifies. A case that wants the field open says so.
 */
function instrument(nav, { searchActive = false, searchKey = false } = {}) {
  const drv = (nav._viewDriverInst ||= makeViewModeDriver(nav));
  const calls = [];
  const rec = (name, impl) => (...args) => { calls.push({ name, args }); return impl ? impl(...args) : undefined; };
  for (const k of DRIVER_KEYS) drv[k] = rec(k);
  drv.searchActive = rec('searchActive', () => searchActive);
  drv.searchKey = rec('searchKey', () => searchKey);
  calls.of = (name) => calls.filter((c) => c.name === name);
  /** Just the method names, in order — the shape the "nothing fired" controls assert against. */
  calls.names = () => calls.map((c) => c.name);
  return calls;
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('AC-6 — Tab and Shift+Tab change level', () => {
  it('⛔ Tab reaches drv.tabLevel(+1) THROUGH THE KEYDOWN PATH, and Shift+Tab reaches -1', async () => {
    const { nav } = await loadedNav();
    const calls = instrument(nav);

    press(nav, 'Tab');
    expect(calls.of('tabLevel').map((c) => c.args), 'plain Tab advances a level').toEqual([[1]]);

    press(nav, 'Tab', { shiftKey: true });
    expect(calls.of('tabLevel').map((c) => c.args), 'Shift+Tab retreats').toEqual([[1], [-1]]);
  });

  it('⛔ Tab is STOPPED and DEFAULT-PREVENTED — main.js:14016/:14056 bind it globally', async () => {
    const { nav } = await loadedNav();
    instrument(nav);
    const seen = press(nav, 'Tab');
    expect(seen.stopped, 'without this the global Tab binding also fires').toBe(1);
    expect(seen.prevented, 'without this the browser moves DOM focus off the canvas').toBe(1);
  });

  it('works in design 2 as well as design 1', async () => {
    const { nav } = await loadedNav({ mode: 'bars' });
    const calls = instrument(nav);
    press(nav, 'Tab');
    expect(calls.of('tabLevel')).toHaveLength(1);
  });
});

describe('AC-7 — Enter commits', () => {
  it('⛔ Enter reaches drv.commit() through the keydown path', async () => {
    const { nav } = await loadedNav();
    const calls = instrument(nav);
    const seen = press(nav, 'Enter');
    expect(calls.of('commit').map((c) => c.args)).toEqual([[]]);
    expect(seen.prevented).toBe(1);
    expect(seen.stopped).toBe(1);
  });

  it('⛔ ENTER STILL BELONGS TO THE SEARCH FIELD WHILE IT HOLDS FOCUS', async () => {
    // The DOM search input has its own Enter binding at NavComputer.js:715, and `_searchFocused`
    // guards the whole handler on line 349 BEFORE any of these clauses. Committing a warp because the
    // pilot pressed Enter to run a search is the defect.
    const { nav } = await loadedNav();
    const calls = instrument(nav);
    nav._searchFocused = true;
    press(nav, 'Enter');
    expect(calls.of('commit'), 'Enter typed into the search box must stay the search box\'s').toHaveLength(0);
    nav._searchFocused = false;
  });

  /**
   * ⚠ SKIPPED, NOT PASSED, until the DRIVER lands `commit()`. This is the end-to-end that AC-7 is
   * actually about — `_onCommit(this._commitAction)` firing, the same call the `[ WARP ]` / `[ BURN ]`
   * button makes through `_commitButtonRect`, so warp and burn cannot diverge. It arms itself the
   * moment the method exists; it never reports green while doing nothing.
   */
  it.runIf(DRIVER_HAS.commit)('⭐ AC-7 END TO END: Enter fires _onCommit with the armed action', async () => {
    const { nav } = await loadedNav();
    const armed = { type: 'warp', target: 'Test Star', star: { name: 'Test Star', seed: 1 } };
    nav._commitAction = armed;
    const fired = [];
    nav.setCommitCallback((a) => fired.push(a));
    press(nav, 'Enter');
    expect(fired, 'the same _onCommit the commit button fires').toEqual([armed]);
  });
});

describe('AC-8 — [ and ] cycle the sort key', () => {
  it('⛔ ] reaches drv.cycleSort(+1) and [ reaches -1, through the keydown path', async () => {
    const { nav } = await loadedNav();
    const calls = instrument(nav);
    press(nav, 'BracketRight');
    press(nav, 'BracketLeft');
    expect(calls.of('cycleSort').map((c) => c.args)).toEqual([[1], [-1]]);
  });

  it('⛔ BOTH BRACKETS ARE STOPPED — main.js:13497/:13510 bind them and neither checks the nav', async () => {
    // `[` cycles the star-glow gradient and `]` toggles quantize, both ungated. Without
    // stopPropagation, sorting the list also pops a debug toast over the map Max is reading.
    const { nav } = await loadedNav();
    instrument(nav);
    for (const code of ['BracketLeft', 'BracketRight']) {
      const seen = press(nav, code);
      expect(seen.stopped, `${code} must not reach the global binding`).toBe(1);
      expect(seen.prevented, `${code} must be consumed`).toBe(1);
    }
  });
});

describe('AC-9 — - and = page the ranked list', () => {
  it('⛔ = reaches drv.page(+1) and - reaches -1, through the keydown path', async () => {
    const { nav } = await loadedNav();
    const calls = instrument(nav);
    press(nav, 'Equal');
    press(nav, 'Minus');
    expect(calls.of('page').map((c) => c.args)).toEqual([[1], [-1]]);
  });

  it('⛔ the pager keys are NOT the sort keys — one screen cannot spell two controls "[ ]"', async () => {
    const { nav } = await loadedNav();
    const calls = instrument(nav);
    press(nav, 'Equal');
    press(nav, 'Minus');
    expect(calls.of('cycleSort'), 'paging must not also sort').toHaveLength(0);
    const pagedSoFar = calls.of('page').length;
    press(nav, 'BracketLeft');
    expect(calls.of('page').length, 'sorting must not also page').toBe(pagedSoFar);
    expect(calls.of('cycleSort'), 'and the bracket still sorts').toHaveLength(1);
  });
});

describe('AC-11 groundwork — / opens the drawn search', () => {
  it('⛔ / reaches drv.searchOpen() and is default-prevented (Firefox opens quick-find on /)', async () => {
    const { nav } = await loadedNav();
    const calls = instrument(nav);
    const seen = press(nav, 'Slash');
    expect(calls.of('searchOpen').map((c) => c.args)).toEqual([[]]);
    expect(seen.prevented).toBe(1);
  });

  it('⭐ the drawn field consumes the keyboard FIRST, and only when searchKey() says it did', async () => {
    // INTERFACE.md §3's last row. The routing must not be a blanket swallow: a key the field declines
    // has to fall through to the level/sort/page clauses, or opening the search kills the instrument.
    const consuming = await loadedNav();
    const consumed = instrument(consuming.nav, { searchActive: true, searchKey: true });
    press(consuming.nav, 'Tab');
    expect(consumed.of('searchKey'), 'the open field is offered the key').toHaveLength(1);
    expect(consumed.of('tabLevel'), 'and having taken it, Tab must not also change level').toHaveLength(0);

    const declining = await loadedNav();
    const declined = instrument(declining.nav, { searchActive: true, searchKey: false });
    press(declining.nav, 'Tab');
    expect(declined.of('searchKey')).toHaveLength(1);
    expect(declined.of('tabLevel'), 'a declined key still reaches its own clause').toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────
// THE THREE CONTROLS. Each one is a gate that, if dropped, breaks something already shipped.
// ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('⛔ the controls — where these keys must NOT fire', () => {
  const NEW_KEYS = ['Tab', 'Enter', 'BracketLeft', 'BracketRight', 'Minus', 'Equal', 'Slash'];

  it('⛔ NONE of them fire while the search field has focus', async () => {
    const { nav } = await loadedNav();
    const calls = instrument(nav);
    nav._searchFocused = true;
    for (const code of NEW_KEYS) press(nav, code);
    expect(calls.names(), 'the guard at the head of line 349 covers every clause after it').toEqual([]);
    nav._searchFocused = false;
  });

  it('⛔ NONE of them fire on the COCKPIT PANEL — the gate is _viewModesEnabled', async () => {
    // Two separate NavComputer instances (main.js:4700 vs :5895). The gate is `activate()`, which
    // `_openCockpitNav` never calls — NOT `_bare`, which is permanently false on the panel.
    // ⭐ viewMode is FORCED here on purpose: pressing keys on a panel that has no mode would pass
    // even with the gate deleted, which is a case that pins nothing. This one fails without the gate.
    const { nav } = await makeHeadlessNav({ width: 52, height: 43 });
    expect(nav._viewModesEnabled, 'a panel instance is never activated').toBe(false);
    nav.viewMode = 'rail';
    const calls = instrument(nav);
    for (const code of NEW_KEYS) press(nav, code);
    expect(calls.names(), 'nothing the panel is handed may reach a driver method').toEqual([]);
  });

  it('⛔ NONE of them fire with viewMode === null — today\'s nav is untouched', async () => {
    // `_viewModesEnabled` alone is true for the WHOLE overlay, today's nav included, so the clauses
    // test `this.viewMode` as well. Without that second test, Tab and Enter would change today's nav
    // and "viewMode === null is today's nav byte for byte" would stop being true.
    const { nav } = await loadedNav();
    const calls = instrument(nav);
    nav.viewMode = null;
    for (const code of NEW_KEYS) press(nav, code);
    expect(calls.names(), 'today\'s nav has no Tab, Enter, bracket, pager or slash binding').toEqual([]);
  });

  it('the keys the file already had are unharmed — V, L, comma and period still work', async () => {
    // A regression control on the fold itself: the new clauses were appended AFTER the existing ones
    // on line 349, so if the append had truncated or shadowed them this fails.
    const { nav } = await loadedNav();
    nav.viewMode = null;
    press(nav, 'KeyV'); expect(nav.viewMode, 'first V').toBe('rail');
    press(nav, 'KeyV'); expect(nav.viewMode, 'second V').toBe('bars');
    press(nav, 'KeyV'); expect(nav.viewMode, 'third V returns to today\'s nav').toBe(null);
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('AC-5 — the wheel clamp no longer sits above the zoom the prism opens at', () => {
  /** Turn the wheel the way the canvas listener does. */
  const wheel = (nav, deltaY) => nav._handleWheel({ deltaY, preventDefault() {} });

  /**
   * ⭐ THE ENTRY RADIUS IS TAKEN FROM THE CLASS, NOT COPIED FROM IT. `setPlayerPosition` is the
   * public method that sets the prism's opening zoom (`:1189`, matched by the level-2 drill at
   * `:4680`), so reading it back is a live derivation that cannot go stale the way a pasted `0.0015`
   * would.
   */
  async function atEntryZoom() {
    const { nav } = await loadedNav();
    nav.setPlayerPosition({ x: 8.0, y: 0, z: 0 });
    nav._levelIndex = 3;
    return { nav, entry: nav._localRadius };
  }

  it('⛔ the FIRST wheel-out from the entry zoom moves by the zoom factor, not by the clamp', async () => {
    // Measured defect: the lower clamp was 0.002 against an entry radius of 0.0015, so the first
    // notch outward computed 0.001725 and the clamp raised it to 0.002 — the picture snapped out 33%
    // before it had moved at all. This case reads 0.002 on the old code.
    const { nav, entry } = await atEntryZoom();
    wheel(nav, 1);
    expect(nav._localRadius).toBeCloseTo(entry * 1.15, 12);
  });

  it('⛔ the FIRST wheel-in from the entry zoom stops AT the entry zoom, not above it', async () => {
    // Inward from the floor must clamp to the floor, and the floor must BE the entry value. On the
    // old code this read 0.002 — a zoom-IN that zoomed OUT.
    const { nav, entry } = await atEntryZoom();
    wheel(nav, -1);
    expect(nav._localRadius).toBe(entry);
  });

  it('the floor is reachable by zooming in repeatedly, and nothing goes under it', async () => {
    const { nav, entry } = await atEntryZoom();
    nav._localRadius = entry * 4;
    for (let i = 0; i < 40; i++) wheel(nav, -1);
    expect(nav._localRadius).toBe(entry);
  });

  it('⛔ THE SYSTEM BRANCH IS UNTOUCHED — _systemZoom keeps its own 0.3 floor and 5.0 ceiling', async () => {
    // `_systemZoom` is a multiplier that enters at 1.0, so its 0.3 floor is genuinely below its entry
    // value and is not the same defect. Changing it was never in scope.
    const { nav } = await loadedNav({ level: 4 });
    nav._levelIndex = 4;
    nav._systemZoom = 0.3;
    wheel(nav, 1);
    expect(nav._systemZoom, 'the floor still holds').toBe(0.3);
    nav._systemZoom = 5.0;
    wheel(nav, -1);
    expect(nav._systemZoom, 'the ceiling still holds').toBe(5.0);
    nav._systemZoom = 1.0;
    wheel(nav, -1);
    expect(nav._systemZoom, 'and it still zooms in between them').toBeCloseTo(1.15, 12);
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('⛔ the fold budget — the structural condition every clause above depends on', () => {
  const SRC = readFileSync(new URL('../NavComputer.js', import.meta.url), 'utf8');

  /**
   * ⭐ WHY A LINE COUNT IS A LEGITIMATE ASSERTION HERE, AND ONLY HERE. `NavComputer.js` carries ~700
   * line-anchored citations across the repo's docs and tests, so it is held at 4711 lines and new
   * statements are FOLDED onto existing ones. The moment that stops being true the citations rot
   * silently, and — worse — the pressure to fold is what produced the dead `V` key. Cheap to check,
   * and it fails loudly the first time someone adds a line instead of folding.
   */
  it('NavComputer.js is still 4711 lines', () => {
    expect(SRC.split('\n').length - 1).toBe(4711);
  });

  /**
   * ⛔ THE ACTUAL TRAP, CHECKED DIRECTLY. A `//` comment folded into the middle of the keyboard line
   * comments out every statement after it — the handler stays present, parsed and unreachable. So on
   * that one line, after block comments are removed, there must be NO `//` at all: everything on it
   * is either code or a terminated block comment.
   *
   * ⚠ The scanner ignores string literals, which is safe for this line (it contains no slashes inside
   * quotes) and is why it is pointed at this line rather than run over the file.
   */
  it('the keyboard fold line carries no double-slash comment outside a block comment', () => {
    const line = SRC.split('\n').find((l) => l.includes('if (this._searchFocused) return;'));
    expect(line, 'the keyboard fold line must still be findable').toBeTruthy();
    let out = '';
    for (let i = 0; i < line.length; i++) {
      if (line.startsWith('/*', i)) {
        const end = line.indexOf('*/', i + 2);
        expect(end, 'an unterminated block comment swallows the rest of the line').toBeGreaterThan(-1);
        i = end + 1;
        continue;
      }
      out += line[i];
    }
    expect(out.includes('//'), 'a // here would silently kill every clause after it').toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────
// nav-screens-close-pass — AC-3, the rotation re-seed, AC-7's ladder drag and AC-6's zoom-out.
//
// ⛔⛔ EVERY CASE BELOW DRIVES A REAL ENTRY POINT — `nav._onKeyDown`, `nav._handleMouseDown` /
// `_handleMouseMove`, or a dispatched click through `clickAt` — for the reason this file's header
// gives. The `V` key shipped dead because all 28 view-mode tests set state directly. Ask of every
// green case here: what input in its sample could make it fail?
// ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The designs' own gains, restated ONCE and only as the two numbers the lab actually writes.
 *
 * ⭐ `projectPrism` scales dz by 0.42 and dy by 0.55; `hypot` of those is not 1, so the picture
 * factors as an elevation-only rotation times an anisotropic scale. Every assertion below therefore
 * checks the ROUND TRIP — `K·sin(rotX) === 0.42`, `K·cos(rotX) === 0.55` — rather than comparing the
 * angle to a pasted 0.6521714117570698. A pasted angle would pass against a copy of itself; this
 * fails the moment the seed stops reproducing the picture the lab draws.
 */
const D_DZ = 0.42, D_DY = 0.55, D_K = Math.hypot(D_DZ, D_DY);

/** A current 3-planet system whose FIRST planet carries moons — the shape that armed the freeze. */
async function moonySystem(mode = 'rail') {
  const h = await loadedNav({ mode, level: 4 });
  h.nav._systemStar = { wx: 8, wy: 0, wz: 0, seed: 5150, spectral: 'G', name: 'Moony' };
  h.nav._systemData = {
    star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
    planets: [
      { orbitRadiusAU: 1.0, planetData: { radiusEarth: 1, T_eq: 280, habitability: { score: 0.8 }, rings: false },
        moons: [{ type: 'rock', radiusEarth: 0.2, T_eq: 250, orbitRadiusAU: 0.01 }] },
      { orbitRadiusAU: 8, planetData: { radiusEarth: 3, T_eq: 120, habitability: { score: 0 }, rings: false }, moons: [] },
      { orbitRadiusAU: 30, planetData: { radiusEarth: 9, T_eq: 60, habitability: { score: 0 }, rings: true }, moons: [] },
    ],
  };
  h.nav._levelIndex = 4;
  h.nav.render();
  h.drv = h.nav._viewDriverInst;
  return h;
}

/** More bodies than the ladder can hold, so `S.ladderMax` is real and a pan has somewhere to go. */
async function crowdedLadder(mode = 'rail', n = 40) {
  const h = await loadedNav({ mode, level: 4 });
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
  h.drv = h.nav._viewDriverInst;
  return h;
}

/** The mark the PAINT published for planet `pIdx` itself — never one of its moon pips. */
const planetMark = (drv, pIdx) =>
  drv.S.bodyHits.find((x) => x.moon < 0 && x.ref && x.ref.kind === 'planet' && x.ref.pIdx === pIdx);

/** Press the button and move — the two real handlers the canvas listeners call, in order. */
function dragBy(nav, x0, y0, dx, dy = 0) {
  nav._handleMouseDown({ clientX: x0, clientY: y0, button: 0 });
  nav._handleMouseMove({ clientX: x0 + dx, clientY: y0 + dy });
}

describe('AC-3 — the second selection, and it is the MODE that is pinned', () => {
  it('⛔ a planet WITH MOONS no longer arms an invisible mode change, and the next planet still selects', async () => {
    // Measured live, both designs: clicking a moon-bearing planet set `_systemMode = 'planet'`, after
    // which `:4512-4523` wrote `{ planetIndex: this._selectedPlanetIdx }` — the planet already
    // selected — for every later click. Three clicks on three different planets all read
    // `planetIndex: 3`. On the old code the last expectation here reads 0.
    const { nav, drv } = await moonySystem('rail');
    const withMoons = planetMark(drv, 0), other = planetMark(drv, 2);
    expect(withMoons && other, 'the fixture published no pickable planets').toBeTruthy();
    expect(nav._systemData.planets[0].moons, 'the fixture must arm the trap').toHaveLength(1);

    nav._handleMouseMove({ clientX: withMoons.x, clientY: withMoons.y });
    expect(nav._hoveredBody, 'the hover was already correct in the measurement').toEqual({ type: 'planet', index: 0 });
    clickAt(nav, withMoons.x, withMoons.y);
    expect(nav._systemMode, 'a mode with no picture in either design must never be entered').toBe('system');
    expect(nav._selectedBody).toEqual({ type: 'planet', planetIndex: 0 });

    nav._handleMouseMove({ clientX: other.x, clientY: other.y });
    expect(nav._hoveredBody).toEqual({ type: 'planet', index: 2 });
    clickAt(nav, other.x, other.y);
    expect(nav._selectedBody, 'the second selection was frozen at the first').toEqual({ type: 'planet', planetIndex: 2 });
  });

  it('works in design 2 as well — the freeze was reproduced in both', async () => {
    const { nav, drv } = await moonySystem('bars');
    const a = planetMark(drv, 0), b = planetMark(drv, 1);
    nav._handleMouseMove({ clientX: a.x, clientY: a.y });
    clickAt(nav, a.x, a.y);
    nav._handleMouseMove({ clientX: b.x, clientY: b.y });
    clickAt(nav, b.x, b.y);
    expect(nav._systemMode).toBe('system');
    expect(nav._selectedBody).toEqual({ type: 'planet', planetIndex: 1 });
  });

  it('⛔ THE CONTROL — with no mode, the LEGACY drill into planet detail is untouched', async () => {
    // `_renderPlanetDetail` draws ONE planet, so there `_hoveredBody.index` and `_selectedPlanetIdx`
    // always agree and the 'planet' branch is correct. Legacy must stay byte-identical, which is why
    // the fix pins the mode instead of rewriting that branch.
    const { nav, drv } = await moonySystem('rail');
    const withMoons = planetMark(drv, 0);
    nav._handleMouseMove({ clientX: withMoons.x, clientY: withMoons.y });
    nav.viewMode = null;
    clickAt(nav, withMoons.x, withMoons.y);
    expect(nav._systemMode, 'today\'s nav lost its planet-detail drill').toBe('planet');
    expect(nav._selectedPlanetIdx).toBe(0);
  });
});

describe('AC-11 — the camera is re-seeded onto the design\'s own default', () => {
  it('⭐ V puts the game\'s rotation where the design was drawing, THROUGH THE KEYDOWN PATH', async () => {
    const { nav } = await loadedNav({ mode: null, level: 3 });
    nav.viewMode = null;
    nav._localRotX = 0.5; nav._localRotY = 0.3; nav._systemRotX = 0.5; nav._systemRotY = 0.9;

    press(nav, 'KeyV');
    expect(nav.viewMode).toBe('rail');
    // The round trip, not a pasted angle: this is the picture `projectPrism` draws.
    expect(D_K * Math.sin(nav._localRotX), 'the prism\'s dz gain').toBeCloseTo(D_DZ, 12);
    expect(D_K * Math.cos(nav._localRotX), 'the prism\'s dy gain').toBeCloseTo(D_DY, 12);
    expect(nav._localRotY, 'the designs draw the prism at rotY 0').toBe(0);
    // `d2System`'s TILT is a true sine and round-trips exactly, so this one is an equality.
    expect(Math.sin(nav._systemRotX), 'the orrery\'s tilt').toBe(0.42);
    expect(nav._systemRotY).toBe(0);
  });

  it('⛔ THE CONTROL — cycling back to today\'s nav re-seeds NOTHING', async () => {
    // The seed is guarded on `this.viewMode`. Without that guard the third press would overwrite
    // these two sentinels with the designs' angles, and "viewMode === null is today's nav byte for
    // byte" would stop being true.
    const { nav } = await loadedNav({ mode: null, level: 3 });
    nav.viewMode = null;
    press(nav, 'KeyV');                       // -> rail
    press(nav, 'KeyV');                       // -> bars
    nav._localRotX = 1.234; nav._systemRotX = 1.111; nav._localRotY = 0.777;
    press(nav, 'KeyV');                       // -> today's nav
    expect(nav.viewMode).toBe(null);
    expect(nav._localRotX).toBe(1.234);
    expect(nav._systemRotX).toBe(1.111);
    expect(nav._localRotY).toBe(0.777);
  });

  it('⛔ AND THE COCKPIT PANEL IS STILL OUT — the gate is _viewModesEnabled', async () => {
    const { nav } = await makeHeadlessNav({ width: 52, height: 43 });
    nav._localRotX = 0.5; nav._localRotY = 0.3;
    press(nav, 'KeyV');
    expect(nav.viewMode, 'a panel instance is never activated').toBe(null);
    expect(nav._localRotX).toBe(0.5);
    expect(nav._localRotY).toBe(0.3);
  });

  it('⭐ activate() seeds too — opening the overlay on a STORED mode is the other entry', async () => {
    // `loadViewMode()` can hand `activate()` a mode chosen in a previous session, so the first frame
    // the pilot sees is drawn from whatever rotation the constructor left. That frame is the one Max
    // ruled on.
    const { nav } = await makeHeadlessNav({ width: 427, height: 240 });
    const prev = globalThis.localStorage;
    globalThis.localStorage = { getItem: () => 'bars', setItem() {}, removeItem() {} };
    try {
      nav._localRotX = 0.5; nav._localRotY = 0.3;
      nav.activate();
      expect(nav.viewMode, 'the stored mode did not load').toBe('bars');
      expect(D_K * Math.sin(nav._localRotX)).toBeCloseTo(D_DZ, 12);
      expect(nav._localRotY).toBe(0);
      expect(Math.sin(nav._systemRotX)).toBe(0.42);
    } finally { globalThis.localStorage = prev; }
  });

  it('⭐ the REGION→PRISM drill settles on the design\'s angle, not on 0.5', async () => {
    // `:4685-4686` starts the prism top-down and tweens 600 ms to a literal 0.5. With the designs
    // reading the game's rotation, that lands the prism ~8° off the frame the lab draws and leaves it
    // there — a settle that ends in the wrong place is worse than no settle.
    const { nav } = await loadedNav({ mode: 'rail', level: 2 });
    nav._levelIndex = 2;
    nav._localRotY = 0.3;
    nav._hoveredTile = { col: 3, row: 4 };
    clickAt(nav, 200, 100);
    expect(nav._tiltAnim, 'the level-2 tile drill did not fire').toBeTruthy();
    expect(D_K * Math.sin(nav._tiltAnim.to)).toBeCloseTo(D_DZ, 12);
    expect(nav._localRotY, 'the designs draw the prism at rotY 0').toBe(0);
  });

  it('⛔ THE CONTROL — with no mode the same drill still tweens to the literal 0.5 and leaves rotY alone', async () => {
    const { nav } = await loadedNav({ mode: null, level: 2 });
    nav.viewMode = null;
    nav._levelIndex = 2;
    nav._localRotY = 0.3;
    nav._hoveredTile = { col: 3, row: 4 };
    clickAt(nav, 200, 100);
    expect(nav._tiltAnim.to).toBe(0.5);
    expect(nav._localRotY).toBe(0.3);
  });
});

describe('AC-7 — at SYSTEM in design 1 the drag PANS THE LADDER', () => {
  it('⭐ a pull left moves `S.ladderScroll` by the pixels dragged, THROUGH THE REAL HANDLERS', async () => {
    const { nav, drv } = await crowdedLadder('rail');
    expect(drv.S.ladderMax, 'the fixture must overflow or a pan means nothing').toBeGreaterThan(60);
    drv.S.ladderScroll = 0;
    dragBy(nav, 200, 120, -37);
    expect(drv.S.ladderScroll).toBe(37);
  });

  it('⛔ IT IS CONTINUOUS, NOT SNAPPED — the value is the gesture, not the nearest stop', async () => {
    // `d1Ladder` subtracts `ladderScroll` raw and only clamps and rounds it, and minimum neighbour
    // separation is 8 texels against a window of 150+, so a continuous offset cannot open an empty
    // window. `,` / `.` keep snapping through `scrollLadder`; the drag must not.
    const { nav, drv } = await crowdedLadder('rail');
    drv.S.ladderScroll = 0;
    dragBy(nav, 200, 120, -3);
    expect(drv.S.ladderScroll, 'a 3-texel pull moved to a stop instead of moving 3 texels').toBe(3);
    expect(drv.S.ladderStops, 'no stop sits at 3, so a snapping control could not produce it').not.toContain(3);
    dragBy(nav, 200, 120, -5);
    expect(drv.S.ladderScroll, 'the next gesture must start from where the last one left it').toBe(8);
  });

  it('the pan is clamped to the window the paint published, at both ends', async () => {
    const { nav, drv } = await crowdedLadder('rail');
    drv.S.ladderScroll = 0;
    dragBy(nav, 200, 120, 500);
    expect(drv.S.ladderScroll, 'dragged past the left edge').toBe(0);
    drv.S.ladderScroll = 0;
    dragBy(nav, 200, 120, -100000);
    expect(drv.S.ladderScroll, 'dragged past the right edge').toBe(drv.S.ladderMax);
  });

  it('⛔ THE CONTROL — design 2 draws an ORRERY at SYSTEM, so its drag still turns it', async () => {
    const { nav, drv } = await crowdedLadder('bars');
    const scroll = drv.S.ladderScroll, rotY = nav._systemRotY;
    dragBy(nav, 200, 120, -37, 10);
    expect(drv.S.ladderScroll, 'design 2 has no ladder to pan').toBe(scroll);
    expect(nav._systemRotY, 'the orrery stopped rotating').toBeCloseTo(rotY - 37 * 0.008, 12);
  });

  it('⛔ THE CONTROL — with no mode the drag is today\'s orbit, untouched', async () => {
    const { nav, drv } = await crowdedLadder('rail');
    const scroll = drv.S.ladderScroll;
    nav.viewMode = null;
    const rotY = nav._systemRotY;
    dragBy(nav, 200, 120, -37, 10);
    expect(drv.S.ladderScroll).toBe(scroll);
    expect(nav._systemRotY).toBeCloseTo(rotY - 37 * 0.008, 12);
  });

  it('⛔ THE CONTROL — at PRISM the same mode still rotates the prism; only level 4 pans', async () => {
    const { nav } = await loadedNav({ mode: 'rail', level: 3 });
    const drv = nav._viewDriverInst;
    const scroll = drv.S.ladderScroll, rotY = nav._localRotY;
    dragBy(nav, 200, 120, -37, 10);
    expect(nav._localRotY, 'the prism drag is not contended and must be left alone').toBeCloseTo(rotY - 37 * 0.008, 12);
    expect(drv.S.ladderScroll).toBe(scroll);
  });

  it('⛔ a pan still bails out of the click, so it cannot also select a body', async () => {
    // `_handleClick`'s `dx*dx + dy*dy > 25` test (:4496) reads `_dragStartX/Y`, which `_handleMouseUp`
    // never resets — so it still sees the gesture's start point. Jitter under 5 px stays a click.
    const { nav, drv } = await crowdedLadder('rail');
    const sel = nav._selectedBody;
    dragBy(nav, 200, 120, -37);
    nav._handleMouseUp();
    nav._handleClick({ clientX: 163, clientY: 120, button: 0 });
    expect(nav._selectedBody, 'the pan committed a selection on release').toBe(sel);
  });
});

describe('AC-6 — tabbing OUT of PRISM/SYSTEM eases the 2D frame open instead of snapping', () => {
  it('⭐ Shift+Tab out of PRISM moves the level on the same press AND arms a zoom-out', async () => {
    const { nav } = await loadedNav({ mode: 'rail', level: 3 });
    press(nav, 'Tab', { shiftKey: true });
    expect(nav._levelIndex, 'the level must still move synchronously').toBe(2);
    expect(nav._viewEase, 'the transition still snapped').toBeTruthy();
    expect(nav._viewEase.fromSize, 'a zoom-OUT opens from a tighter frame').toBeLessThan(nav._viewEase.toSize);
  });

  it('⭐ AND IT REALLY ANIMATES — the frame walks open and the ease clears itself', async () => {
    const { nav } = await loadedNav({ mode: 'rail', level: 3 });
    const t0 = simClockMs();
    press(nav, 'Tab', { shiftKey: true });
    const target = nav._viewEase.toSize;
    try {
      _setSimClockMs(t0 + 1);   nav.render();
      const early = nav._viewSize;
      _setSimClockMs(t0 + 175); nav.render();
      const mid = nav._viewSize;
      expect(early, 'the frame did not open').toBeLessThan(mid);
      expect(mid, 'it arrived before the animation did').toBeLessThan(target);
      _setSimClockMs(t0 + 400); nav.render();
      expect(nav._viewSize).toBe(target);
      expect(nav._viewEase, 'a completed ease must clear itself or it re-runs every frame').toBe(null);
    } finally { _setSimClockMs(t0); }
  }, 30000);   // three full 2D frames: the ease moves `_viewSize` every frame, which invalidates the
               // density cache every frame — the same cost the shipped `_anim` drill already pays.

  it('⛔ THE WHOLE REASON IT IS NOT `_anim` — three presses with no frame still walk three levels', async () => {
    // `_handleClick` returns early on `_anim` (:4419), so an ease carried on that field would have
    // eaten the second and third press. This is navSearch.test.js:438-448's shape, and it is the case
    // that made a separate field non-negotiable.
    const { nav } = await loadedNav({ mode: 'rail', level: 3 });
    press(nav, 'Tab', { shiftKey: true });
    press(nav, 'Tab', { shiftKey: true });
    press(nav, 'Tab', { shiftKey: true });
    expect(nav._levelIndex, 'the ease swallowed a keypress').toBe(0);
  });

  it('⛔ a real drill animation wins — the ease yields rather than racing it', async () => {
    const { nav } = await loadedNav({ mode: 'rail', level: 3 });
    press(nav, 'Tab', { shiftKey: true });
    expect(nav._viewEase).toBeTruthy();
    nav._anim = { startTime: simClockMs(), duration: 350, fromCenter: { x: 8, z: 0 }, fromSize: 4,
                  toCenter: { x: 8, z: 0 }, toSize: 8, toLevel: 2 };
    nav.render();
    expect(nav._viewEase, 'two writers on _viewCenter/_viewSize is a fight, not an animation').toBe(null);
  });

  it('⛔ THE CONTROL — with no mode the tab still jumps, with no animation it never had', async () => {
    const { nav } = await loadedNav({ mode: 'rail', level: 3 });
    nav.viewMode = null;
    const t = tabCentre(nav, 2);
    clickAt(nav, t.x, t.y);
    expect(nav._levelIndex).toBe(2);
    expect(nav._viewEase, 'today\'s nav gained an animation it never had').toBe(null);
  });

  it('⛔ AND A 2D-TO-2D TAB IS UNCHANGED — that one already animated, through `_anim`', async () => {
    const { nav } = await loadedNav({ mode: 'rail', level: 1 });
    nav.setPlayerPosition({ x: 8, y: 0, z: 0 });
    nav._levelIndex = 1;
    nav.render();
    press(nav, 'Tab');
    expect(nav._anim, 'the shipped 2D drill animation was displaced').toBeTruthy();
    expect(nav._anim.toLevel).toBe(2);
    expect(nav._viewEase, 'the ease is for the transitions that had none').toBe(null);
  }, 30000);   // `setPlayerPosition` regenerates the sector tree and the first level-1 frame builds a
               // density field; both are the fixture, not the assertion.
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────
// nav-screens-close-pass part 3 — AC-9's SECOND half: SYSTEM's ladder counter is a handle.
//
// ⛔ THE HOST OWNS THREE FOLDS AND NOTHING ELSE (INTERFACE.md §8c): arm at mousedown (:4405), own the
// move (:4355), release at mouseup (:4415). `counterGrab` / `counterDragTo` are the DRIVER's, landing
// in parallel, so every clause calls them OPTIONALLY and the end-to-end case is `runIf`-gated —
// a missing implementation must report as SKIPPED, never as a green test that exercised nothing.
// ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Whether the DRIVER's counter scrubber has actually landed, measured off a real driver. */
const DRIVER_HAS_COUNTER = await (async () => {
  const { nav } = await makeHeadlessNav({ width: 427, height: 240 });
  const drv = makeViewModeDriver(nav);
  return typeof drv.counterGrab === 'function' && typeof drv.counterDragTo === 'function';
})();

/**
 * Install recorders for the counter surface ON THE LIVE DRIVER INSTANCE the folds reach, so these
 * cases pin the HOST's three clauses whether or not the DRIVER's implementation has landed.
 */
function instrumentCounter(nav, { grab = true, value = 7 } = {}) {
  const drv = (nav._viewDriverInst ||= makeViewModeDriver(nav));
  const calls = { grab: [], dragTo: [] };
  drv.counterGrab = (x, y) => { calls.grab.push({ x, y }); return grab; };
  drv.counterDragTo = (px) => { calls.dragTo.push(px); return value; };
  return calls;
}

describe('AC-9 — at SYSTEM in design 1 a press on the ladder COUNTER scrubs the window', () => {
  it('⭐ the held counter writes `S.ladderScroll` from the driver, THROUGH THE REAL HANDLERS', async () => {
    const { nav, drv } = await crowdedLadder('rail');
    const calls = instrumentCounter(nav, { grab: true, value: 7 });
    drv.S.ladderScroll = 0;
    const rotX = nav._systemRotX, rotY = nav._systemRotY;

    dragBy(nav, 200, 120, 40);

    expect(calls.grab, 'the grab must be decided once, at the press, with the press point')
      .toEqual([{ x: 200, y: 120 }]);
    expect(calls.dragTo, 'the move must hand the driver the pointer x it is inverting').toEqual([240]);
    expect(drv.S.ladderScroll, 'the scrub did not reach the ladder').toBe(7);
    // ⚠ HONEST ABOUT WHAT THIS PAIR PINS. At level 4 in `rail` the AC-7 pan clause also returns, so
    // the rotation is doubly guarded here and this assertion alone cannot kill the missing-`return`
    // mutant — `ladderScroll` above does that (a fall-through pans to 0). The rotation assertion that
    // discriminates is design 2's below, where a fold ignoring `viewMode` really would steal the turn.
    expect(nav._systemRotX, 'the scrub also spun the orrery').toBe(rotX);
    expect(nav._systemRotY, 'the scrub also spun the orrery').toBe(rotY);
  });

  it('⛔ a press that MISSES the counter still pans the ladder, and never asks the driver to scrub', async () => {
    const { nav, drv } = await crowdedLadder('rail');
    const calls = instrumentCounter(nav, { grab: false, value: 7 });
    expect(drv.S.ladderMax, 'the fixture must overflow or a pan means nothing').toBeGreaterThan(60);
    drv.S.ladderScroll = 0;

    dragBy(nav, 200, 120, -37);

    expect(calls.grab, 'the press must still be offered to the counter first').toHaveLength(1);
    expect(calls.dragTo, 'a press that took no handle must not scrub').toEqual([]);
    expect(drv.S.ladderScroll, 'AC-7\'s pan is what an unclaimed level-4 drag still does').toBe(37);
  });

  it('a move after the release changes nothing — the gesture ended with the button', async () => {
    // ⚠ WHAT THIS ACTUALLY PINS IS `_dragging`, NOT THE RELEASE. `_handleMouseMove` never reaches the
    // drag branch with the button up, so this case survives deleting `_counterDrag = false` at :4415.
    // The path the release really guards is the next case; this one is the plain user-visible claim.
    const { nav, drv } = await crowdedLadder('rail');
    const calls = instrumentCounter(nav, { grab: true, value: 7 });
    drv.S.ladderScroll = 0;
    dragBy(nav, 200, 120, 40);
    expect(drv.S.ladderScroll).toBe(7);

    nav._handleMouseUp();
    nav._handleMouseMove({ clientX: 60, clientY: 120 });

    expect(calls.dragTo, 'a move with the button up scrubbed the ladder').toEqual([240]);
    expect(drv.S.ladderScroll, 'releasing must leave the window where it was dropped').toBe(7);
  });

  it('⛔ THE RELEASE, PINNED: a grab taken at SYSTEM must not scrub a drag that began at PRISM', async () => {
    // The level-4 mousedown reassigns `_counterDrag` on every press, so an ordinary press-release-press
    // cycle needs nothing from :4415. The path that does is the one the y-gauge's fifth mutant found:
    // armed at SYSTEM, RELEASED, the next press taken at PRISM (whose branch never writes the flag),
    // then back to SYSTEM under the held button. A stale `true` there turns a pan into a scrub.
    // ⚠ `_levelIndex` is assigned directly here as FIXTURE — `crowdedLadder` and `trappySystem` both
    // do the same (part 3 trap 13); the behaviour under test is driven through the real handlers.
    const { nav, drv } = await crowdedLadder('rail');
    const calls = instrumentCounter(nav, { grab: true, value: 7 });
    drv.S.ladderScroll = 0;

    nav._handleMouseDown({ clientX: 200, clientY: 120, button: 0 });   // armed at SYSTEM
    nav._handleMouseUp();
    nav._levelIndex = 3;
    nav._handleMouseDown({ clientX: 200, clientY: 120, button: 0 });   // PRISM: this branch never writes _counterDrag
    nav._levelIndex = 4;
    nav._handleMouseMove({ clientX: 240, clientY: 120 });

    expect(calls.dragTo, 'a released grab survived into a drag that never took it').toEqual([]);
    expect(drv.S.ladderScroll, 'the stale grab scrubbed the ladder').toBe(0);
  });

  it('⛔ THE CONTROL — design 2 draws an orrery at SYSTEM, so the counter is never consulted', async () => {
    const { nav, drv } = await crowdedLadder('bars');
    const calls = instrumentCounter(nav, { grab: true, value: 7 });
    const scroll = drv.S.ladderScroll, rotY = nav._systemRotY;

    dragBy(nav, 200, 120, -37, 10);

    expect(calls.grab, 'design 2 publishes no counter; the press must not even ask').toEqual([]);
    expect(calls.dragTo).toEqual([]);
    expect(drv.S.ladderScroll).toBe(scroll);
    expect(nav._systemRotY, 'the scrub stole design 2\'s rotation').toBeCloseTo(rotY - 37 * 0.008, 12);
  });

  it('⛔ THE CONTROL — with no mode today\'s nav is untouched: no ask, and the orbit still turns', async () => {
    const { nav, drv } = await crowdedLadder('rail');
    const calls = instrumentCounter(nav, { grab: true, value: 7 });
    nav.viewMode = null;
    const scroll = drv.S.ladderScroll, rotY = nav._systemRotY;

    dragBy(nav, 200, 120, -37, 10);

    expect(calls.grab, 'today\'s nav publishes no counter and must not be asked').toEqual([]);
    expect(calls.dragTo).toEqual([]);
    expect(drv.S.ladderScroll).toBe(scroll);
    expect(nav._systemRotY).toBeCloseTo(rotY - 37 * 0.008, 12);
  });

  it.runIf(DRIVER_HAS_COUNTER)('⭐ AC-9 END TO END: a real drag across the counter walks the window edge to edge', async () => {
    const { nav, drv } = await crowdedLadder('rail');
    const r = drv.S.ladderCounterRect;
    expect(r, 'the LAB must publish the counter\'s own rect or there is nothing to grab').toBeTruthy();
    expect(drv.S.ladderMax, 'the counter is drawn only when there is a window to report').toBeGreaterThan(0);

    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    nav._handleMouseDown({ clientX: cx, clientY: cy, button: 0 });
    nav._handleMouseMove({ clientX: r.x + r.w, clientY: cy });
    expect(drv.S.ladderScroll, 'dragged to the counter\'s right edge').toBe(drv.S.ladderMax);
    nav._handleMouseMove({ clientX: r.x, clientY: cy });
    expect(drv.S.ladderScroll, 'dragged back to the counter\'s left edge').toBe(0);

    nav._handleMouseUp();
    nav._handleMouseMove({ clientX: r.x + r.w, clientY: cy });
    expect(drv.S.ladderScroll, 'a move after the release moved the window').toBe(0);
  });
});
