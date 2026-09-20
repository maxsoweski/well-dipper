/**
 * navRestorations4.host — the HOST half of wave 2b of nav-restorations-2026-09-20 (AC-4).
 *
 * ── WHAT THIS FILE OWNS ──────────────────────────────────────────────────────────────────────────
 *
 * ONE statement in `src/ui/NavComputer.js`, folded onto the head of `handleEscape()` (:1441):
 *
 *     if (this.viewMode && this._viewDriverInst?.onEscape?.() === true) return true;
 *
 * That is the whole of the host's share of AC-4. The sub-view itself — `S.sysView`, `S.detailPlanet`,
 * the enter/inside/exit routing in `remapClick`, and `onEscape()` — is the DRIVER's; the moon ladder
 * and the moon orrery are the LAB's. This file proves the fold and NOTHING else in the class moved.
 *
 * ⛔ THE FOLD IS ON :1441, THE SIGNATURE LINE, AND NOT ON :1442. Trap 11 of the wave brief asks for a
 * source scan check first: `NavComputer.prismPan.test.js:249` pins `/deactivate\(\) \{\s*this\.detachKeys\(\);/`
 * against this file's source, and `\s*` does not span a block comment — so a fold on THAT signature
 * line would redden it. Grepped 2026-09-20: no test in `src/ui/__tests__` scans `handleEscape() {`
 * (the only source scans naming `handleEscape` are `NavComputer.escape.test.js:316/322`, which read
 * `main.js` for the absence of a call and this file for the `e.button === 2` route — neither touches
 * the signature line). So :1441 is free and the seam's own line is the one used.
 *
 * ⚠ CONSEQUENCE OF :1441, STATED: the fold sits ABOVE the `if (this._anim) return true;` guard on
 * :1442, so the driver is asked during a drill animation too. That is unreachable from real input —
 * both live right-click routes carry their own `_anim` guard (the `contextmenu` listener at :336 and
 * `_handleClick` at :4419) — and the case at the bottom of the first block pins it rather than
 * leaving it as an accident.
 *
 * ── ⛔ THE STANDARD EVERY CASE IS HELD TO ────────────────────────────────────────────────────────
 *
 * Drive the REAL input on a REAL `NavComputer` over a REAL `navViewModes` driver: `_handleMouseDown`
 * → `_handleClick` for a click, the canvas's OWN registered `contextmenu` listener for a right-click,
 * `nav._onKeyDown` (the function `document.addEventListener('keydown', …, true)` was handed at :565)
 * for a key. Every case asserts an ABSOLUTE fact — a level index, a boolean, a call count, a hash —
 * and names the mutant it goes red against.
 *
 * ⚠ ONE FIXTURE DECLARATION, OUT LOUD: `drv.onEscape` IS STUBBED BY THESE TESTS, and deliberately so.
 * `onEscape()` is the parallel DRIVER lane's half of this same wave (it landed in
 * `navViewModes/index.js` mid-run on 2026-09-20), and the host's whole contract is "ask the driver,
 * believe exactly `true`" — a host case that leaned on the driver's own sub-view state would be
 * testing the driver and would go red every time the driver's picture changed. So each case installs
 * its own counted `onEscape` on the LIVE driver instance (`nav._viewDriverInst`, the one `render()`
 * built) and asserts the call count. The two cases that `delete drv.onEscape` reconstruct HEAD's own
 * shape — a driver that answers nothing — and are what keep the stub honest.
 */

import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { makeHeadlessNav, makeRecordingContext } from './helpers/headlessNav.mjs';

const W = 417, H = 240;
const noop = () => {};

const down = (nav, x, y, button = 0) => nav._handleMouseDown({ clientX: x, clientY: y, button });
const up = (nav) => nav._handleMouseUp();
const click = (nav, x, y, button = 0) => nav._handleClick({ clientX: x, clientY: y, button });
const press = (nav, code, extra = {}) =>
  nav._onKeyDown({ code, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, key: '',
    preventDefault() {}, stopPropagation() {}, ...extra });

/** A moon good enough for legacy's `_renderPlanetDetail` and for `D.sys.planets[i].moons[m]`. */
const moon = (m) => ({
  name: `Moon ${m}`, orbitRadiusEarth: 20 + m * 14, startAngle: m * 1.1,
  type: 'rocky', radiusEarth: 0.27 + m * 0.05,
});

/**
 * A real NavComputer standing IN its own system, under a real driver, at SYSTEM.
 *
 * The prism loads first (every design needs it before it draws anything) and the pilot is stood ON
 * the nearest loaded star — the `at()` rule from `navDefects2026.design.test.js:128-150`, which is
 * what makes `_isCurrentSystem()` true. Planets 1 and 2 carry moons, so the planet AC-4 drills into
 * exists in the fixture rather than being assumed.
 */
async function sysNav(mode, { level = 4, planets = 4 } = {}) {
  const h = await makeHeadlessNav({ width: W, height: H });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = 3;
  h.nav.viewMode = mode;
  h.nav.render();
  h.nav._systemStar = h.nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
  if (h.nav._systemStar) {
    h.nav._playerX = h.nav._systemStar.wx; h.nav._playerY = h.nav._systemStar.wy; h.nav._playerZ = h.nav._systemStar.wz;
  }
  h.nav._systemData = {
    star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
    planets: Array.from({ length: planets }, (_, i) => ({
      orbitRadiusAU: 0.4 + i * 0.9,
      moons: (i === 1 || i === 2) ? [moon(0), moon(1), moon(2)] : [],
      planetData: { radiusEarth: 1 + (i % 4), T_eq: 260, habitability: { score: 0.2 }, rings: false },
    })),
  };
  h.nav._levelIndex = level;
  h.nav.render();
  h.drv = h.nav._viewDriverInst;
  return h;
}

/** Install a counted `onEscape` on the live driver instance and hand back the spy. */
function stubOnEscape(h, answer) {
  const spy = vi.fn(() => answer);
  h.drv.onEscape = spy;
  return spy;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-4 — the fold: the host asks the driver, and believes exactly `true`
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-4 — `handleEscape()` asks the driver first under a design', () => {
  for (const mode of ['rail', 'bars']) {
    it(`⭐⭐ ${mode.toUpperCase()}: the driver answering \`true\` EATS the escape — level 4 and the selection stay`, async () => {
      const h = await sysNav(mode);
      const { nav } = h;
      const spy = stubOnEscape(h, true);
      nav._selectedBody = { type: 'planet', planetIndex: 1 };
      nav._commitAction = { type: 'burn', target: 'planet', planetIndex: 1 };

      expect(nav._levelIndex).toBe(4);
      // MUTANT: delete the :1441 fold. `handleEscape` then falls through to the level-4 arm,
      //         `_clearCommitSelection()` runs and the level drops to 3 — every line below goes red.
      expect(nav.handleEscape()).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(nav._levelIndex, 'the sub-view exit must not leave SYSTEM').toBe(4);
      expect(nav._selectedBody, 'the seam: EXIT keeps the selection').toEqual({ type: 'planet', planetIndex: 1 });
      expect(nav._commitAction).toEqual({ type: 'burn', target: 'planet', planetIndex: 1 });
      expect(nav._systemStar, 'the system is still loaded — the nav did not pop out of it').not.toBe(null);
      expect(nav._systemData).not.toBe(null);
      expect(nav._systemMode, 'nothing here touches the host\'s legacy sub-modes').toBe('system');
    }, 30000);
  }

  it('⭐⭐ THE DRIVER ANSWERING `false` LEAVES TODAY\'S ESCAPE EXACTLY AS IT IS', async () => {
    // The control is HEAD's own shape: a driver with NO `onEscape` at all, which is what the class
    // met before this wave. The two runs must land on the same state, field for field.
    const control = await sysNav('rail');
    delete control.drv.onEscape;   // ⚠ HEAD'S SHAPE, RECONSTRUCTED: the DRIVER lane landed `onEscape`
    expect(control.drv.onEscape, 'the control driver answers nothing at all — this IS HEAD').toBe(undefined);
    const headRet = control.nav.handleEscape();
    const headState = {
      ret: headRet, level: control.nav._levelIndex, mode: control.nav._systemMode,
      star: control.nav._systemStar, data: control.nav._systemData,
      sel: control.nav._selectedBody, act: control.nav._commitAction,
    };

    const h = await sysNav('rail');
    const spy = stubOnEscape(h, false);
    const ret = h.nav.handleEscape();
    expect(spy).toHaveBeenCalledTimes(1);
    // MUTANT: `=== true` relaxed to truthy, or the fold written without the `return` — `false` would
    //         then either eat the escape or double-run the level pop, and this equality breaks.
    expect({
      ret, level: h.nav._levelIndex, mode: h.nav._systemMode,
      star: h.nav._systemStar, data: h.nav._systemData,
      sel: h.nav._selectedBody, act: h.nav._commitAction,
    }).toEqual(headState);
    expect(headState.ret, 'HEAD pops SYSTEM → PRISM and says so').toBe(true);
    expect(headState.level, 'HEAD leaves level 4').toBe(3);
    expect(headState.star, 'HEAD drops the system on the way out').toBe(null);
  }, 30000);

  it('⛔ ONLY THE BOOLEAN `true` IS BELIEVED — a truthy answer is NOT an exit', async () => {
    for (const answer of [1, 'yes', {}]) {
      const h = await sysNav('bars');
      stubOnEscape(h, answer);
      // MUTANT: drop `=== true` from the fold. Each of these three would eat the escape and the
      //         pilot's right-click would stop popping the level — level stays 4 and this goes red.
      expect(h.nav.handleEscape(), `answer ${JSON.stringify(answer)}`).toBe(true);
      expect(h.nav._levelIndex, `answer ${JSON.stringify(answer)} must not eat the escape`).toBe(3);
    }
  }, 60000);

  it('⛔ LEGACY NEVER ASKS — with `viewMode` null the driver is not consulted', async () => {
    const h = await sysNav('rail');
    const spy = stubOnEscape(h, true);
    h.nav.viewMode = null;
    // MUTANT: drop `this.viewMode &&` from the fold. The driver instance survives a V into legacy
    //         (it is built once, NavComputer.js:621's note), so legacy's escape would start being
    //         eaten by a design-side sub-view nobody can see.
    expect(h.nav.handleEscape()).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    expect(h.nav._levelIndex, 'legacy popped SYSTEM → PRISM as it always has').toBe(3);
  }, 30000);

  it('⛔ AND IT NEVER BUILDS A DRIVER: `viewMode` set, no instance yet, no throw and none created', async () => {
    const h = await makeHeadlessNav({ width: W, height: H });
    h.nav._viewModesEnabled = true;
    h.nav.viewMode = 'bars';
    h.nav._levelIndex = 2;
    expect(h.nav._viewDriverInst, 'nothing has rendered, so nothing has built one').toBe(null);
    // MUTANT: write the fold as `(this._viewDriverInst ||= makeViewModeDriver(this)).onEscape?.()`.
    //         A legacy-only session that never pressed V would pay for a driver on every escape, and
    //         `onDeactivate`'s note at :621 says that is exactly what must not happen.
    expect(h.nav.handleEscape()).toBe(true);
    expect(h.nav._viewDriverInst).toBe(null);
    expect(h.nav._levelIndex).toBe(1);
  }, 30000);

  it('⛔ A REAL DRIVER WITH NO `onEscape` IS INERT, NOT A THROW', async () => {
    // This is the case that keeps the stub above honest: until the DRIVER lane lands `onEscape`, the
    // shipped driver has none, and a throw out of `handleEscape` under PanelHost freezes the glass.
    const h = await sysNav('bars');
    delete h.drv.onEscape;   // the driver this wave's parallel lane had not written yet, reconstructed
    expect(h.drv.onEscape).toBe(undefined);
    // MUTANT: drop the `?.` after `onEscape` — this throws TypeError and the right-click route dies.
    expect(() => h.nav.handleEscape()).not.toThrow();
    expect(h.nav._levelIndex, 'and it falls through to today\'s behaviour').toBe(3);
  }, 30000);

  it('⚠ THE FOLD SITS ABOVE THE `_anim` GUARD — measured, and unreachable from real input', async () => {
    const h = await sysNav('rail');
    const spy = stubOnEscape(h, true);
    h.nav._anim = { t: 0 };
    // The seam put the statement on :1441, the signature line, so it runs before :1442's guard.
    // Named rather than discovered later: both live right-click routes refuse during `_anim`
    // (the contextmenu listener at :336, `_handleClick` at :4419), so nothing can drive this.
    expect(h.nav.handleEscape()).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    // MUTANT: fold onto :1442 BELOW the guard instead — the spy is never called here.
  }, 30000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-4 — the routes in: right-click reaches the fold, the Escape KEY does not
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** A nav whose canvas RECORDS its listeners, so the live `contextmenu` route can be driven. */
async function navWithCanvasListeners() {
  await makeHeadlessNav({ width: W, height: H });     // installs the DOM globals NavComputer reaches for
  const listeners = new Map();
  const canvas = {
    width: W, height: H, style: {}, parentElement: null,
    addEventListener: (type, fn) => { listeners.set(type, fn); },
    removeEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H }),
  };
  const { ctx, rec } = makeRecordingContext(canvas);
  canvas.getContext = () => ctx;
  const { NavComputer } = await import('../NavComputer.js');
  const { GalacticMap } = await import('../../generation/GalacticMap.js');
  const nav = new NavComputer(canvas, new GalacticMap(), null);
  return { nav, rec, listeners };
}

describe('AC-4 — right-click reaches the fold; the Escape key does not reach the class at all', () => {
  it('⭐⭐ THE CANVAS\'S OWN `contextmenu` LISTENER — the live right-click route — asks the driver', async () => {
    const h = await navWithCanvasListeners();
    const { nav, listeners } = h;
    expect(listeners.has('contextmenu'), 'NavComputer.js:336 registers it on the canvas').toBe(true);
    nav._viewModesEnabled = true;
    nav._levelIndex = 3;
    nav.viewMode = 'rail';
    nav.render();
    nav._levelIndex = 4;
    nav.render();
    const drv = nav._viewDriverInst;
    const spy = vi.fn(() => true);
    drv.onEscape = spy;

    // A right-click is mousedown THEN contextmenu at the same point: the listener rejects a press
    // that moved more than 5 texels (its own 25 = 5², against `_dragStartX/Y`).
    down(nav, 120.5, 110.5, 2);
    let prevented = 0;
    listeners.get('contextmenu')({ clientX: 120.5, clientY: 110.5, preventDefault() { prevented++; } });
    expect(prevented, 'the browser menu is always suppressed first').toBe(1);
    // MUTANT: delete the :1441 fold — the spy is never called and the level drops to 3.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(nav._levelIndex, 'the sub-view exit ate the right-click').toBe(4);
    up(nav);
  }, 30000);

  it('⭐ AND SO DOES `_handleClick` WITH `e.button === 2`, the rect-published twin at :4488', async () => {
    const h = await sysNav('rail');
    const { nav, drv } = h;
    const spy = stubOnEscape(h, true);
    // A right-click with its own mousedown at the same texel centre, well inside the map pane.
    down(nav, 120.5, 110.5, 2);
    click(nav, 120.5, 110.5, 2);
    // MUTANT: delete the fold — `handleEscape` pops the level and `_levelIndex` reads 3.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(nav._levelIndex).toBe(4);
    expect(drv.S.level, 'and the driver was never told to change level either').toBe(4);
    up(nav);
  }, 30000);

  it('⛔ MEASURED BLOCKER — a real `Escape` keydown never reaches `handleEscape` in the first place', async () => {
    // ⚠ THIS IS A FINDING, NOT A DESIGN. AC-4's observable says "Esc … returns to the whole-system
    // picture without closing the nav", and the seam routes that through `drv.onEscape()`. But
    // NavComputer's own document-capture keydown handler (:344-360, attached at :565) has NO
    // `Escape` clause — grepped: the only `Escape` literals in the file are the search input's own
    // listener (:716) and comments. So the key falls through to main.js:13557, which sees
    // `_navComputerOpen` and calls `toggleNavComputer()` (main.js:13598): the whole overlay closes.
    // `main.js` is FROZEN at 15161 and is nobody's this wave, and the host's share of AC-4 is ONE
    // fold — so this is reported, not fixed. The right-click route above is the one that works today.
    const h = await sysNav('rail');
    const { nav } = h;
    const spy = stubOnEscape(h, true);
    let prevented = 0, stopped = 0;
    press(nav, 'Escape', { preventDefault() { prevented++; }, stopPropagation() { stopped++; } });
    expect(spy, 'the class never asks the driver about Escape').not.toHaveBeenCalled();
    expect(prevented, 'and it does not claim the key…').toBe(0);
    expect(stopped, '…so main.js\'s window listener still gets it and closes the nav').toBe(0);
    expect(nav._levelIndex, 'nothing in the class moved').toBe(4);
    // MUTANT / LIVENESS: when the gap is closed (an `Escape` clause folded into `_onKeyDown`), this
    // case goes red and whoever closed it must come back here and to AC-4's note.
  }, 30000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LEGACY BYTE-IDENTITY — the fold changes nothing with `viewMode` null
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⛔ THESE HASHES ARE HEAD'S, MEASURED BEFORE THE FOLD WAS WRITTEN, on this same 417×240 harness.
 * The five level hashes are the same numbers `navRestorations3.host.test.js:364-376` pins for wave
 * 2a's four folds — two independent wave files agreeing on the same frames is the point, not a
 * duplication: a fold that moved legacy would have to move both.
 *
 * ⛔ LEVEL 3's CALL STREAM IS NOT PINNED — the prism's background star load makes it
 * non-deterministic in HEAD itself (re-measured there, four renders, four hashes, one text hash).
 */
const LEGACY_TEXT = {
  0: '47d6cec9a9b899c1',
  1: 'e63f073b4e55394d',
  2: '9790b13f56eb7849',
  3: 'e0159ebab2298b53',
  4: 'd9934e059a736f56',
};
const LEGACY_CALLS = {
  0: 'df3025c11613b1b5',
  1: '875c015b0dad36e1',
  2: '90ecebeb47aa76ca',
  4: '5542b2f88f086705',
};

/** Legacy's OWN planet detail (`_systemMode === 'planet'`), on the fixture above. Measured at HEAD. */
const LEGACY_PLANET_DETAIL = { text: '7441dd9b2559e6be', calls: 'fb16daa3b7a37fd2' };

const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

/** Hash exactly one frame: clear the recorder, render, hash what that render emitted. */
function frame(h) {
  h.rec.text.length = 0; h.rec.calls.length = 0;
  h.nav.render();
  return { text: sha(h.rec.text), calls: sha(h.rec.calls) };
}

describe('LEGACY BYTE-IDENTITY — AC-4\'s fold changes nothing with `viewMode` null', () => {
  for (const L of [0, 1, 2, 3, 4]) {
    const name = ['GALAXY', 'SECTOR', 'REGION', 'PRISM', 'SYSTEM'][L];
    it(`⭐⭐ ${name} on a fresh open: the emitted text stream hashes to HEAD's`, async () => {
      const h = await makeHeadlessNav({ width: W, height: H });
      h.nav._viewModesEnabled = true;
      h.nav.viewMode = null;
      h.nav._levelIndex = L;
      const f = frame(h);
      expect(f.text).toBe(LEGACY_TEXT[L]);
      if (LEGACY_CALLS[L]) expect(f.calls).toBe(LEGACY_CALLS[L]);
    }, 30000);
  }

  it('⭐⭐ AND AFTER A FULL `V` CYCLE BACK TO LEGACY, EVERY LEVEL HASHES TO THE SAME FRAME', async () => {
    const h = await makeHeadlessNav({ width: W, height: H });
    h.nav._viewModesEnabled = true;
    h.nav.viewMode = null;

    const before = {};
    for (const L of [0, 1, 2, 3, 4]) { h.nav._levelIndex = L; frame(h); before[L] = frame(h); }

    let hops = 0;
    do { press(h.nav, 'KeyV'); hops++; } while (h.nav.viewMode !== null && hops < 8);
    expect(h.nav.viewMode, `V came back to legacy in ${hops} hops`).toBe(null);
    expect(hops).toBeGreaterThan(1);
    expect([h.nav._canvas.width, h.nav._canvas.height], 'the buffer came back too').toEqual([W, H]);

    for (const L of [0, 1, 2, 3, 4]) {
      h.nav._levelIndex = L; frame(h);
      const after = frame(h);
      expect(after.text, `level ${L} text after the V cycle`).toBe(before[L].text);
      expect(after.text, `level ${L} text is still HEAD's`).toBe(LEGACY_TEXT[L]);
      if (LEGACY_CALLS[L]) expect(after.calls, `level ${L} calls after the V cycle`).toBe(before[L].calls);
    }
  }, 60000);

  it('⭐⭐ LEGACY\'S OWN PLANET DETAIL, OPENED BY A REAL PLANET CLICK, IS UNCHANGED — AND ITS ESCAPE STILL POPS IT', async () => {
    const h = await sysNav(null);
    const { nav } = h;
    expect(nav.viewMode).toBe(null);
    expect(nav._viewDriverInst, 'legacy built no driver').toBe(null);
    expect(nav._isCurrentSystem(), 'the pilot stands on this star, so the click takes the current-system arm').toBe(true);

    // A REAL click on a planet that has moons: sweep for the hover, then click where it lit up.
    let hit = null;
    const tabH = 32;
    outer:
    for (let y = 16; y < H - tabH - 16; y += 6) {
      for (let x = 16; x < W - 16; x += 6) {
        nav._handleMouseMove({ clientX: x, clientY: y });
        nav.render();
        const hb = nav._hoveredBody;
        if (hb && hb.type === 'planet' && nav._systemData.planets[hb.index]?.moons?.length > 0) {
          hit = { x, y, index: hb.index }; break outer;
        }
      }
    }
    expect(hit, 'the fixture draws a planet with moons somewhere on the glass').not.toBe(null);
    down(nav, hit.x, hit.y); up(nav); click(nav, hit.x, hit.y);
    expect(nav._systemMode, 'legacy\'s pin at :4585 still fires — this wave did not lift it').toBe('planet');
    expect(nav._selectedPlanetIdx).toBe(hit.index);

    const f = frame(h);
    expect(f.text, 'legacy\'s planet-detail text stream').toBe(LEGACY_PLANET_DETAIL.text);
    expect(f.calls, 'legacy\'s planet-detail call stream').toBe(LEGACY_PLANET_DETAIL.calls);

    // …and legacy's own escape out of it: a right-click pops the sub-view, not the level.
    down(nav, hit.x, hit.y, 2); click(nav, hit.x, hit.y, 2); up(nav);
    // MUTANT: drop `this.viewMode &&` from the fold — with a driver present legacy's escape would be
    //         eaten here and `_systemMode` would stay 'planet'.
    expect(nav._systemMode).toBe('system');
    expect(nav._selectedPlanetIdx).toBe(-1);
    expect(nav._levelIndex, 'and the first escape did not also leave SYSTEM').toBe(4);
  }, 60000);
});
