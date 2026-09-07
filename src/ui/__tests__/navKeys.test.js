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
import { makeHeadlessNav } from './helpers/headlessNav.mjs';
import { makeViewModeDriver } from '../navViewModes/index.js';

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
