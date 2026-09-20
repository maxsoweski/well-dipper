/**
 * navRestorations4.driver — THE DRIVER'S HALF OF WAVE 2b (nav-restorations-2026-09-20), AC-4.
 *
 * Max, page item 16, ruled 2026-09-20: *"a design-side sub-view, not a switch back to the old one."*
 * The page's own complaint under it: *"Moons cannot be seen on their orbits or chosen as burn
 * targets; a pip click selects the parent."*
 *
 * What the DRIVER owns of that, and what this file drives:
 *
 *   STATE   `S.sysView` / `S.detailPlanet`, and the three things that close the sub-view — a level
 *           change, a design change (`V`), and the nav closing.
 *   ENTER   the SECOND click on an already-selected planet that has moons.
 *   INSIDE  a moon hit selects the MOON (both indices, a `target:'moon'` commit action); the
 *           parent's hit selects the planet; an empty-map click leaves AND clears.
 *   EXIT    `onEscape()` — `true` once, `false` after.
 *   HOVER   `bodyIdentity` stops collapsing a moon onto its parent INSIDE the sub-view, and keeps
 *           collapsing outside it.
 *   ROW     design 1's rail already lists every moon; a click on one now names that moon.
 *
 * ── ⛔ THE STANDARD, INHERITED FROM navRestorations1/3.driver ────────────────────────────────────
 *
 * Real input through the real handlers — `clickAt` (a mousedown, a mouseup and a click, which is
 * what `remapClick`'s 5-texel drag guard measures against), `nav._handleMouseMove`, `nav.render()`.
 * Every assertion is an ABSOLUTE fact: a `nav._selectedBody` object, a `S.sysView` string, a
 * `_commitAction` target, a frame that is byte-identical to another. Each case names the MUTANT it
 * dies against in its own comment.
 *
 * ── ⭐⭐ AND EVERY BODY IS CLICKED WHERE THE PAINT PUT IT ─────────────────────────────────────────
 *
 * No case here pushes a hit into `S.bodyHits` by hand. The wave-2b prompt allows it while the LAB's
 * half is in flight, and it turned out not to be needed: BOTH designs already publish a pip per moon
 * at their draw sites (`d1Ladder` designs.js:1508, `d2System` :3072, `{ref: <the planet row>, moon:
 * m}`), so the INSIDE rules can be driven against the real published geometry today and will keep
 * being driven against it when the sub-view repaints those pips onto their own orbits. The one thing
 * this file therefore does NOT claim is that the sub-view LOOKS different — that is the LAB's half.
 *
 * ── ⚠ AND THE EXIT IS DRIVEN AT TWO DEPTHS, ON PURPOSE ──────────────────────────────────────────
 *
 * `onEscape()` is what the HOST's one fold calls (`NavComputer.handleEscape()` :1441,
 * `if (this.viewMode && this._viewDriverInst?.onEscape?.() === true) return true;`), so most of the
 * EXIT cases drive it by the name the fold calls it by — that is this lane's surface. The last case
 * drives `nav.handleEscape()` itself, the real class method, so the two lanes are shown MEETING on
 * a live instance rather than each passing against its own stub.
 * ⛔ AND NOT THE Esc KEY. Measured by the HOST lane this same wave and recorded there
 * (`navRestorations4.host.test.js:288-305`): `nav._onKeyDown` has no `Escape` clause at all, so the
 * key never reaches `handleEscape` — it falls through to `main.js:13557`, which closes the whole
 * overlay. `main.js` is frozen and nobody's this wave. The live route into `handleEscape` is the
 * canvas `contextmenu` listener (`NavComputer.js:336`), which no headless harness can fire, so the
 * method itself is the deepest honest entry point here.
 */

import { describe, it, expect } from 'vitest';
import { makeHeadlessNav, clickAt } from './helpers/headlessNav.mjs';

const W = 417, H = 240;   // ⭐ MAX'S OWN BUFFER — the size every number below is measured at.

/** A nav with the prism loaded and a design on, at `level`. (navRestorations3.driver:43) */
async function designNav({ mode = 'bars', level = 3 } = {}) {
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
 * Stand the pilot ON the nearest loaded star and give it a system with a KNOWN moon distribution.
 *
 * ⛔ THE STAR IS THE NEAREST LOADED ONE, NOT A LITERAL — the host's 0.1 pc identity test, never a
 *    seed comparison (navDefects2026.design.test.js:128-150, via navRestorations1/3.driver).
 * ⚠ `moonCounts` IS THE WHOLE POINT OF THE FIXTURE. AC-4 turns on the difference between a planet
 *   with moons and a planet without one, so the default gives planet 0 and planet 2 NO moons,
 *   planet 1 THREE and planet 3 ONE — enough to tell "entered the sub-view" from "picked the only
 *   moon there was" and enough for a moon index of 2 to be a number no other body carries.
 */
function standOnSystem(nav, { moonCounts = [0, 3, 0, 1] } = {}) {
  nav._systemStar = nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
  if (nav._systemStar) {
    nav._playerX = nav._systemStar.wx; nav._playerY = nav._systemStar.wy; nav._playerZ = nav._systemStar.wz;
  }
  nav._systemData = {
    star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 },
    asteroidBelts: [{ centerRadiusAU: 3.2, widthAU: 1 }],
    planets: moonCounts.map((n, i) => ({
      orbitRadiusAU: 0.4 + i * 0.9, orbitAngle: i * 1.1,
      moons: Array.from({ length: n }, (_, j) => ({
        type: 'rock', radiusEarth: 0.2 + j * 0.1, orbitRadiusEarth: 20 + j * 15,
        startAngle: j * 1.3, T_eq: 200,
      })),
      planetData: { radiusEarth: 1 + (i % 4), T_eq: 260, habitability: { score: 0.2 }, rings: false },
    })),
  };
  nav._currentSystemData = nav._systemData;
  nav._levelIndex = 4;
  nav.render();
}

/** A design at SYSTEM, standing in the fixture system, with one frame painted. */
async function atSystem(mode, opts) {
  const h = await designNav({ mode, level: 3 });
  standOnSystem(h.nav, opts);
  return h;
}

/**
 * The PAINT's own mark for one body: `moon` is `-1` for the body itself, else the moon's index.
 *
 * ⛔ OFF `S.bodyHits`, NEVER RECOMPUTED. Where a design draws a body is draw code this file is not
 *    allowed to restate (INTERFACE §1, and `picking.js`'s whole header) — and a test that predicted
 *    the position would go stale silently the moment the lab moved a pip.
 */
const markOf = (drv, planetIndex, moon = -1) => drv.S.bodyHits.find(
  (hp) => hp && !hp.star && hp.ref && hp.ref.kind === 'planet'
          && hp.ref.pIdx === planetIndex && hp.moon === moon);

/** Click the MIDDLE of the texel a mark was drawn in (`remapClick` refuses a click > 5 texels from
 *  its own mousedown, so press and release are the same point by construction). */
function clickMark(nav, mk) { clickAt(nav, mk.x + 0.5, mk.y + 0.5); }

/** A texel inside the map with nothing published under it — found by ASKING the driver, not by
 *  reasoning about the layout. Chrome rectangles are excluded because they eat the click earlier. */
function emptyMapPoint(h) {
  const { nav, drv } = h;
  const inR = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  for (let y = 16; y < H - 16; y++) {
    for (let x = 16; x < W - 16; x++) {
      if (inR(nav._commitButtonRect, x, y) || inR(drv.S.locatorRect, x, y)
          || inR(drv.S.companionRect, x, y) || inR(drv.S.zoomGaugeRect, x, y)
          || inR(drv.S.yGaugeRect, x, y)) continue;
      if (drv.resolveHover(x + 0.5, y + 0.5, W, H)) continue;
      return { x, y };
    }
  }
  return null;
}

/** The recorded text stream since `from`, as one comparable string. */
const frameSince = (h, from) =>
  h.rec.text.slice(from).map((t) => `${t.op}|${t.text}|${t.x}|${t.y}`).join('\n');

/** Walk into the sub-view the way the pilot does: select the planet, then click it again. */
function enterDetail(h, planetIndex = 1) {
  clickMark(h.nav, markOf(h.drv, planetIndex));
  clickMark(h.nav, markOf(h.drv, planetIndex));
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-4 ENTER — the SECOND click on a selected planet with moons opens the sub-view', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * ⛔ MUTANT: `enter-on-first-click` — drop the `sel.type === 'planet' && sel.planetIndex ===
   *    ref.planetIndex` test from `routeSystem`'s ENTER branch. The first click then opens the
   *    sub-view AND eats itself, so nothing is ever selected: the `'system'` assertion after click 1
   *    goes red, and so does the selection under it.
   */
  it.each(['rail', 'bars'])('⭐ %s: click one selects, click two drills — and the selection survives',
    async (mode) => {
      const h = await atSystem(mode);
      expect(h.drv.D.isCurrent, 'the fixture must be the CURRENT system, or no planet click arms anything').toBe(true);
      expect(h.drv.S.sysView, 'a fresh SYSTEM screen is the whole-system picture').toBe('system');
      expect(h.drv.S.detailPlanet).toBe(-1);

      clickMark(h.nav, markOf(h.drv, 1));
      expect(h.nav._selectedBody, 'the first click did not select the planet').toEqual({ type: 'planet', planetIndex: 1 });
      expect(h.drv.S.sysView, 'the FIRST click drilled — the pilot never got to see what he picked').toBe('system');
      expect(h.drv.S.detailPlanet).toBe(-1);

      clickMark(h.nav, markOf(h.drv, 1));
      expect(h.drv.S.sysView, 'the second click on the selected planet did not open the sub-view').toBe('planet');
      expect(h.drv.S.detailPlanet, 'the sub-view opened on the wrong planet').toBe(1);
      // ⭐ THE SELECTION IS UNTOUCHED BY THE DRILL — the click was EATEN, so the host's planet branch
      //   never re-ran and there is exactly one writer of the armed target.
      expect(h.nav._selectedBody, 'drilling changed the selection').toEqual({ type: 'planet', planetIndex: 1 });
    }, 120000);

  /**
   * ⛔ MUTANT: `enter-ignores-moons` — drop `moons > 0`. Planet 0 then opens a sub-view with nothing
   *    in it, and both `'system'` assertions below go red. This is the one that matters live: an
   *    empty sub-view is a screen that answers nothing, which is the defect class this workstream
   *    is named for.
   */
  it.each(['rail', 'bars'])('⛔ %s: a planet with NO moons never drills, however many times it is clicked',
    async (mode) => {
      const h = await atSystem(mode);
      expect(h.drv.D.bodies.find((b) => b.kind === 'planet' && b.pIdx === 0).moons,
        'the fixture\'s planet 0 must be moonless or this case proves nothing').toBe(0);

      clickMark(h.nav, markOf(h.drv, 0));
      clickMark(h.nav, markOf(h.drv, 0));
      expect(h.drv.S.sysView, 'a moonless planet opened an empty sub-view').toBe('system');
      expect(h.drv.S.detailPlanet).toBe(-1);
      expect(h.nav._selectedBody, 'and it must still be selectable, twice over').toEqual({ type: 'planet', planetIndex: 0 });
    }, 120000);

  /**
   * ⛔ MUTANT: `enter-ignores-the-selection` — compare only the TYPE (`sel.type === 'planet'`) and
   *    not the index. A click on planet 3 while planet 1 is selected then drills into planet 3
   *    without ever selecting it, and the `'system'` assertion goes red — the pilot would lose the
   *    ability to change his mind about which planet he wanted.
   */
  it('⛔ a click on a DIFFERENT planet selects it, it does not drill it', async () => {
    const h = await atSystem('bars');
    clickMark(h.nav, markOf(h.drv, 1));
    clickMark(h.nav, markOf(h.drv, 3));
    expect(h.nav._selectedBody, 'the second planet was not selected').toEqual({ type: 'planet', planetIndex: 3 });
    expect(h.drv.S.sysView, 'a first click on another planet drilled straight into it').toBe('system');
    expect(h.drv.S.detailPlanet).toBe(-1);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-4 INSIDE — in the sub-view a moon IS the pick', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * ⭐⭐ THE ACCEPTANCE CRITERION'S OWN SENTENCE: *"A moon click selects it: the commit row / chip
   *    arms for the MOON and Enter fires `_onCommit` with target 'moon', planetIndex and moonIndex,
   *    which the running game turns into a burn."* `main.js:5994/5999` (frozen) is the consumer.
   *
   * ⛔ MUTANTS, all red here:
   *    · `bodyIdentity-always-collapses` — delete the `S.sysView === 'planet'` clause in
   *      `picking.js`. The pip resolves to the PARENT again, `routeSystem`'s planet branch selects
   *      planet 1, and `type: 'moon'` goes red. This is the shipped behaviour the AC is about.
   *    · `inside-moon-falls-through` — `return false` instead of consuming. The host's level-4
   *      branch then sees a `_hoveredBody` of type 'moon' in `_systemMode === 'system'`, falls to
   *      `_clearCommitSelection()` (NavComputer.js:4592), and the selection goes NULL.
   *    · `selectMoon-drops-moonIndex` — omit `moonIndex`. `_buildCommitAction` then emits
   *      `moonIndex: null` and the commit-action assertion goes red while the selection still looks
   *      right, which is exactly how this would ship broken.
   */
  it.each(['rail', 'bars'])('⭐ %s: a moon pip arms a MOON burn with both indices, and D.selBody mirrors it',
    async (mode) => {
      const h = await atSystem(mode);
      enterDetail(h, 1);
      expect(h.drv.S.sysView).toBe('planet');

      const pip = markOf(h.drv, 1, 2);
      expect(pip, 'the paint published no pip for planet 1\'s third moon').toBeTruthy();
      clickMark(h.nav, pip);

      expect(h.nav._selectedBody, 'the moon pip did not select the moon')
        .toEqual({ type: 'moon', planetIndex: 1, moonIndex: 2 });
      expect(h.drv.S.sysView, 'picking a moon must not close the sub-view').toBe('planet');
      expect(h.drv.S.detailPlanet).toBe(1);

      // ⭐ THE PAYLOAD IS LEGACY'S OWN, BUILT BY LEGACY'S OWN METHOD — which is what makes the frozen
      //   consumer in main.js work with nothing to change.
      const act = h.nav._commitAction;
      expect(act, 'no commit action was armed for the moon').toBeTruthy();
      expect(act.target).toBe('moon');
      expect(act.planetIndex).toBe(1);
      expect(act.moonIndex).toBe(2);
      expect(act.type, 'the pilot is IN this system, so it is a burn').toBe('burn');

      // ⭐ AND THE MIRROR CARRIES IT THROUGH UNCHANGED (SEAM §2): `D.selBody` is the row every
      //   painter frames and names, so a moon that does not arrive here is a moon no design can draw.
      h.nav.render();
      expect(h.drv.D.selBody, 'D.selBody lost the moon').toBeTruthy();
      expect(h.drv.D.selBody.kind).toBe('moon');
      expect(h.drv.D.selBody.pIdx).toBe(1);
      expect(h.drv.D.selBody.mIdx).toBe(2);
      expect(typeof h.drv.D.selBody.name, 'a painter calls .toUpperCase() on this unguarded').toBe('string');
      expect(typeof h.drv.D.selBody.cls).toBe('string');
    }, 120000);

  /**
   * ⛔ MUTANT: `inside-parent-exits` — make the parent branch close the sub-view. The `'planet'`
   *    assertion goes red: clicking the planet you are looking at would throw you out of its moons.
   */
  it.each(['rail', 'bars'])('⭐ %s: the parent\'s own mark re-selects the planet and the sub-view STAYS',
    async (mode) => {
      const h = await atSystem(mode);
      enterDetail(h, 1);
      clickMark(h.nav, markOf(h.drv, 1, 2));           // pick a moon first, so the change is visible
      expect(h.nav._selectedBody.type).toBe('moon');

      clickMark(h.nav, markOf(h.drv, 1));
      expect(h.nav._selectedBody, 'the parent mark did not re-select the planet')
        .toEqual({ type: 'planet', planetIndex: 1 });
      expect(h.nav._commitAction.target, 'the commit row did not re-arm for the planet').toBe('planet');
      expect(h.drv.S.sysView, 'selecting the parent threw the pilot out of the sub-view').toBe('planet');
      expect(h.drv.S.detailPlanet).toBe(1);
    }, 120000);

  /**
   * ⭐ AC-2 OF THE DEFECTS BATCH, HONOURED INSIDE THE NEW PICTURE: an empty-map click clears the
   *    selection. Here it also leaves the sub-view, and it must do BOTH — a gesture half-obeyed is
   *    the shape this workstream keeps finding.
   *
   * ⛔ MUTANTS: `empty-keeps-subview` (drop the two assignments — `'system'` goes red) and
   *    `empty-does-not-clear` (drop the `_clearCommitSelection()` call — the selection survives and
   *    `toBe(null)` goes red, which is the worse half: an armed burn to a body that is no longer on
   *    the glass).
   */
  it.each(['rail', 'bars'])('⭐ %s: a click on empty map leaves the sub-view AND clears the selection',
    async (mode) => {
      const h = await atSystem(mode);
      enterDetail(h, 1);
      clickMark(h.nav, markOf(h.drv, 1, 0));
      expect(h.nav._selectedBody.type).toBe('moon');

      const pt = emptyMapPoint(h);
      expect(pt, 'no empty texel in the map pane — the sweep found a body everywhere').toBeTruthy();
      clickAt(h.nav, pt.x + 0.5, pt.y + 0.5);

      expect(h.drv.S.sysView, 'the empty click did not leave the sub-view').toBe('system');
      expect(h.drv.S.detailPlanet).toBe(-1);
      expect(h.nav._selectedBody, 'the empty click did not clear the selection').toBe(null);
      expect(h.nav._commitAction, 'a commit action outlived the selection it was built from').toBe(null);
    }, 120000);

  /**
   * ⛔⛔ THE CONTROL — THE WHOLE-SYSTEM PICTURE IS UNCHANGED. `bodyIdentity`'s collapse is right
   *    there and says so in its own note: a moon click in the whole-system picture would fall
   *    through to `_clearCommitSelection()`, so it maps to the parent and the click drills instead.
   *    MUTANT: `bodyIdentity-always-moon` (drop the `S.detailPlanet === pIdx` guard, or hoist the
   *    new clause above the `sysView` test) — the pip then selects the moon with no sub-view open
   *    and this goes red.
   */
  it.each(['rail', 'bars'])('⛔ %s: OUTSIDE the sub-view a moon pip still selects the PARENT',
    async (mode) => {
      const h = await atSystem(mode);
      expect(h.drv.S.sysView).toBe('system');
      clickMark(h.nav, markOf(h.drv, 1, 2));
      expect(h.nav._selectedBody, 'the whole-system picture changed what a pip means')
        .toEqual({ type: 'planet', planetIndex: 1 });
      expect(h.drv.S.sysView, 'a pip click opened a sub-view it was never meant to').toBe('system');
    }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-4 ROW — design 1\'s rail already lists every moon; now a click on one names it', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * The rail has listed the moons since `buildBodies` was written (`kind:'moon'` rows, state.js) and
   * a click on one has always selected the PARENT — so the one place in the new nav that names every
   * moon in words could not choose one.
   *
   * ⛔ MUTANT: `row-collapses-to-parent` — delete `routeSystem`'s `listRow >= 0 && row.kind ===
   *    'moon'` branch. The row falls through to the host, which reads the collapsed `_hoveredBody`
   *    and selects planet 1: `type: 'moon'` goes red.
   * ⛔ MUTANT: `row-enters-the-subview` — have the branch set `S.sysView` too. The `'system'`
   *    assertion goes red; Max's walk is that a LIST row names a body, it does not change screens.
   */
  it('⭐ a moon\'s rail row selects the moon, and does NOT open the sub-view', async () => {
    const h = await atSystem('rail');
    const lg = h.drv.S.listGeom;
    expect(lg, 'design 1 published no rail grid at SYSTEM').toBeTruthy();

    // The row index of the first moon, read off the body list the rail is drawn FROM (not guessed).
    const idx = h.drv.D.bodies.findIndex((b) => b.kind === 'moon' && b.pIdx === 1 && b.mIdx === 0);
    expect(idx, 'the fixture has no moon row to click').toBeGreaterThanOrEqual(0);
    const row = idx - lg.offset;
    expect(row, 'that moon is not on the drawn page').toBeLessThan(lg.rows);

    // `d1Rail` draws row i at `top + (i+1)*lead`, so the middle of its band is +lead/2 (designs.js:1362).
    clickAt(h.nav, lg.x0 + 20.5, lg.top + (row + 1) * lg.lead + lg.lead / 2);

    expect(h.nav._selectedBody, 'the moon row still selected its parent')
      .toEqual({ type: 'moon', planetIndex: 1, moonIndex: 0 });
    expect(h.nav._commitAction.target).toBe('moon');
    expect(h.nav._commitAction.moonIndex).toBe(0);
    expect(h.drv.S.sysView, 'a list row changed which picture is on the glass').toBe('system');
    expect(h.drv.S.detailPlanet).toBe(-1);
  }, 120000);

  /**
   * ⛔ MUTANT: `bodyIdentity-always-collapses` — delete the `S.sysView === 'planet'` clause in
   *    `picking.js`. Inside the sub-view the row then resolves to the parent again and `type:
   *    'moon'` goes red.
   * ⚠⚠ AND A MUTANT THAT SURVIVED, MEASURED, SO THE CLAIM HERE IS THE ONE THE CASE CAN MAKE:
   *    `row-only-outside-subview` (gate `routeSystem`'s row branch on `S.sysView === 'system'`) is
   *    GREEN across all 26 cases. It is EQUIVALENT, not a missed defect — inside the sub-view
   *    `bodyIdentity` already stops collapsing, so the row resolves as a moon and the INSIDE rule
   *    two branches down selects exactly the same moon by exactly the same call. The row branch is
   *    therefore load-bearing only in the WHOLE-SYSTEM picture (the case above, where
   *    `row-collapses-to-parent` is red); this case pins the OUTCOME — a rail row still names its
   *    moon once the sub-view is open — and not which of the two paths answered it.
   */
  it('⭐ and it names the moon inside the sub-view too', async () => {
    const h = await atSystem('rail');
    enterDetail(h, 1);
    const lg = h.drv.S.listGeom;
    const idx = h.drv.D.bodies.findIndex((b) => b.kind === 'moon' && b.pIdx === 1 && b.mIdx === 1);
    const row = idx - lg.offset;
    clickAt(h.nav, lg.x0 + 20.5, lg.top + (row + 1) * lg.lead + lg.lead / 2);

    expect(h.nav._selectedBody).toEqual({ type: 'moon', planetIndex: 1, moonIndex: 1 });
    expect(h.drv.S.sysView, 'a row click closed the sub-view').toBe('planet');
    expect(h.drv.S.detailPlanet).toBe(1);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-4 EXIT — onEscape(), the entry point the host\'s fold calls', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * The AC: *"Esc, right-click and an empty-map click each return to the whole-system picture
   * without closing the nav or changing level; a second Esc then behaves as before."*
   *
   * ⛔ MUTANTS: `onEscape-always-false` (the host's fold never fires, Esc closes the whole nav —
   *    `toBe(true)` red); `onEscape-does-not-exit` (`'system'` red); `onEscape-clears-selection`
   *    (the seam says exit and KEEP — the selection assertion red); `onEscape-always-true` (the
   *    second Esc would stop walking back a level, and the `false` assertion below is red).
   */
  it.each(['rail', 'bars'])('⭐ %s: one Esc leaves the sub-view and KEEPS the target; the next answers false',
    async (mode) => {
      const h = await atSystem(mode);
      enterDetail(h, 1);
      clickMark(h.nav, markOf(h.drv, 1, 2));
      const armed = h.nav._selectedBody;
      expect(armed).toEqual({ type: 'moon', planetIndex: 1, moonIndex: 2 });

      expect(h.drv.onEscape(), 'the driver did not claim the Esc').toBe(true);
      expect(h.drv.S.sysView, 'Esc did not leave the sub-view').toBe('system');
      expect(h.drv.S.detailPlanet).toBe(-1);
      expect(h.nav._selectedBody, 'Esc threw the pilot\'s target away').toEqual(armed);
      expect(h.nav._commitAction.target, 'and the commit row must still be armed for it').toBe('moon');
      expect(h.nav._levelIndex, 'Esc must not change level — the host decides that').toBe(4);

      expect(h.drv.onEscape(), 'the second Esc claimed a sub-view that was not open').toBe(false);
      expect(h.drv.S.sysView).toBe('system');
    }, 120000);

  /** ⛔ MUTANT: `onEscape-always-true` — with nothing open it must answer false at EVERY level, or
   *  the host's fold swallows every Esc in the nav. */
  it('⛔ with no sub-view open it answers false at every level', async () => {
    const h = await atSystem('bars');
    for (const level of [0, 1, 2, 3, 4]) {
      h.nav._levelIndex = level;
      h.nav.render();
      expect(h.drv.onEscape(), `level ${level} claimed an Esc it had nothing to spend it on`).toBe(false);
    }
  }, 120000);

  /**
   * ⭐⭐ THE TWO LANES MEETING ON ONE LIVE INSTANCE — `handleEscape()` is the real class method the
   *    canvas's `contextmenu` listener calls (`NavComputer.js:336`), with the HOST's fold at its
   *    head and this lane's `onEscape` behind the fold. No stub on either side.
   *
   * ⛔ MUTANTS: `onEscape-always-false` (the fold falls through, `handleEscape` runs its level-4 arm
   *    — `_clearCommitSelection()` then `_levelIndex = 3`, so BOTH the level and the selection
   *    assertions go red); and, on the host's side, deleting the :1441 fold, which is the same
   *    failure from the other direction.
   */
  it('⭐ handleEscape() itself pops the sub-view and leaves the nav where it was', async () => {
    const h = await atSystem('bars');
    enterDetail(h, 1);
    clickMark(h.nav, markOf(h.drv, 1, 2));
    const armed = h.nav._selectedBody;

    expect(h.nav.handleEscape(), 'the class did not report the Esc as handled').toBe(true);
    expect(h.drv.S.sysView, 'handleEscape did not reach the driver\'s sub-view').toBe('system');
    expect(h.drv.S.detailPlanet).toBe(-1);
    expect(h.nav._levelIndex, 'the first Esc walked back a level as well').toBe(4);
    expect(h.nav._selectedBody, 'the first Esc threw the target away').toEqual(armed);

    // ⭐ AND THE SECOND ONE BEHAVES AS BEFORE — the sub-view is closed, so the fold stands down and
    //   the class's own level-4 arm runs: clear the selection, drop to PRISM.
    expect(h.nav.handleEscape()).toBe(true);
    expect(h.nav._levelIndex, 'the second Esc did not walk back a level').toBe(3);
    expect(h.nav._selectedBody).toBe(null);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-4 STATE — the sub-view dies with the picture it is drawn in', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * ⛔ MUTANT: `no-level-invariant` — drop the `S.level !== 4` reset in `refresh()`. SYSTEM then
   *    reopens already inside a planet's moons, with a commit row armed for a body the pilot cannot
   *    see. Both assertions after the tab go red.
   */
  it.each(['rail', 'bars'])('⭐ %s: leaving SYSTEM closes it, and coming back opens the whole system',
    async (mode) => {
      const h = await atSystem(mode);
      enterDetail(h, 1);
      expect(h.drv.S.sysView).toBe('planet');

      h.nav._levelIndex = 3; h.nav.render();
      expect(h.drv.S.sysView, 'the sub-view survived the level change').toBe('system');
      expect(h.drv.S.detailPlanet).toBe(-1);

      h.nav._levelIndex = 4; h.nav.render();
      expect(h.drv.S.sysView, 'SYSTEM reopened inside a planet').toBe('system');
      expect(h.drv.S.detailPlanet).toBe(-1);
    }, 120000);

  /**
   * ⛔ MUTANT: `no-design-reset` — drop the `cache.design !== S.design` clause in `refresh()`.
   *    Design 2 then opens holding a sub-view design 1 entered, which is a picture it was never
   *    asked to draw.
   * ⚠ THE CONTROL IS THE DESIGN NUMBER ITSELF: if `S.design` did not move, this case would pass for
   *   the wrong reason.
   */
  it('⭐ V to the other design closes it', async () => {
    const h = await atSystem('rail');
    enterDetail(h, 1);
    expect(h.drv.S.design, 'the fixture is not in design 1').toBe(1);
    expect(h.drv.S.sysView).toBe('planet');

    h.nav.viewMode = 'bars';            // what `NavComputer.js:349`'s V clause assigns
    h.nav.render();
    expect(h.drv.S.design, 'V did not reach the driver at all').toBe(2);
    expect(h.drv.S.sysView, 'design 2 inherited design 1\'s sub-view').toBe('system');
    expect(h.drv.S.detailPlanet).toBe(-1);
  }, 120000);

  /**
   * ⛔ MUTANT: `onDeactivate-keeps-subview` — drop the two assignments. `_viewDriverInst` is built
   *    once and never rebuilt (NavComputer.js:255), so the nav reopens at SYSTEM inside whichever
   *    planet was last drilled — of whichever system the pilot was in minutes ago.
   * ⭐ AND THE SELECTION IS NOT CLEARED HERE, which is the line `onDeactivate` already draws between
   *    a transient and a choice.
   */
  it('⭐ closing the nav closes it, and does not throw the target away', async () => {
    const h = await atSystem('bars');
    enterDetail(h, 1);
    const armed = h.nav._selectedBody;

    h.drv.onDeactivate();
    expect(h.drv.S.sysView, 'the sub-view survived the nav closing').toBe('system');
    expect(h.drv.S.detailPlanet).toBe(-1);
    expect(h.nav._selectedBody, 'onDeactivate cleared a selection it has never cleared').toEqual(armed);
  }, 120000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-4 — what this wave must NOT have touched', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * ⭐⭐ THE LEGACY FRAME IS BYTE-IDENTICAL WITH A SUB-VIEW OPEN ON `S` (intent.md's first non-goal:
   *    *"Any change to the legacy look — it stays byte-identical at every level"*).
   *
   * ⚠ THE CONTROL COMES FIRST AND IS THE HALF THAT COULD LIE. Two consecutive legacy frames of the
   *   same screen have to hash the same before "the third one hashes the same too" means anything;
   *   without it an animation would make every comparison pass or fail for its own reasons.
   * ⛔ MUTANT: any write from the driver into the legacy path — e.g. having `onEscape` or
   *    `routeSystem` touch `nav._systemMode` — shows up as a different legacy frame.
   */
  it('⭐ a sub-view left open on S cannot change one texel of the legacy look', async () => {
    const h = await atSystem('bars');
    enterDetail(h, 1);
    expect(h.drv.S.sysView).toBe('planet');

    h.nav.viewMode = null;                       // V back to CURRENT
    let from = h.rec.text.length; h.nav.render(); const a = frameSince(h, from);
    from = h.rec.text.length; h.nav.render();    const b = frameSince(h, from);
    expect(a.length, 'the legacy frame recorded nothing — the comparison would be vacuous').toBeGreaterThan(100);
    expect(b, 'CONTROL: two identical legacy frames already differ, so nothing below is measurable').toBe(a);

    h.drv.S.sysView = 'planet'; h.drv.S.detailPlanet = 1;
    from = h.rec.text.length; h.nav.render();    const c = frameSince(h, from);
    expect(c, 'the design-side sub-view reached the legacy renderer').toBe(b);
  }, 120000);

  /**
   * ⛔ LEGACY'S OWN PLANET DETAIL STILL ANSWERS ON `_systemMode`, and the new clause is an ADDITION
   *    rather than a replacement. MUTANT: `bodyIdentity-replace-legacy-clause` (swap the
   *    `_systemMode` test for the `S.sysView` one) — this goes red while every case above still
   *    passes, which is how that mutation would ship.
   * ⚠ Driven through `_handleMouseMove`, which is the entry `navPicking.test.js:552` uses for the
   *   same clause.
   */
  it('⛔ legacy\'s own `_systemMode === \'planet\'` clause is untouched', async () => {
    const h = await atSystem('bars');
    h.nav._systemMode = 'planet';
    h.nav._selectedPlanetIdx = 1;
    expect(h.drv.S.sysView, 'the design-side sub-view must be CLOSED, or the case proves nothing').toBe('system');

    const pip = markOf(h.drv, 1, 1);
    h.nav._handleMouseMove({ clientX: pip.x + 0.5, clientY: pip.y + 0.5 });
    expect(h.nav._hoveredBody, 'the legacy planet-detail clause stopped resolving a moon')
      .toEqual({ type: 'moon', index: 1 });
  }, 120000);

  /**
   * ⛔ THE PIN STAYS (intent.md: *"Lifting the `_systemMode` pin (NavComputer.js:4585/4590)"* is a
   *    non-goal). The designs' sub-view is on `S` and nothing in this lane may write the host's
   *    legacy sub-mode — a design that set it would hand the screen to `_renderPlanetDetail`.
   *    MUTANT: `routeSystem-sets-systemMode` — red here and invisible everywhere else.
   */
  it.each(['rail', 'bars'])('⛔ %s: nothing in the walk sets nav._systemMode', async (mode) => {
    const h = await atSystem(mode);
    expect(h.nav._systemMode).toBe('system');
    enterDetail(h, 1);
    clickMark(h.nav, markOf(h.drv, 1, 2));
    h.nav.render();
    expect(h.nav._systemMode, 'a design armed the legacy sub-mode').toBe('system');
    h.drv.onEscape();
    expect(h.nav._systemMode).toBe('system');
  }, 120000);
});
