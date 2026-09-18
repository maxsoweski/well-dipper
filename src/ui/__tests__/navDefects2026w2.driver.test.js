/**
 * navDefects2026w2.driver — THE DRIVER'S HALF OF WAVE 2 (nav-defects-batch-2026-09-18).
 *
 * AC-13 (a drag release operates no control), AC-14 (`onDeactivate` — the transients die with the
 * nav), AC-17 (the row band is the DRAWN row, floor-based) and AC-21 (a modifier chord is not text).
 *
 * ── ⛔ THE STANDARD, INHERITED FROM navClosePass3 / navDefects2026.driver (INTERFACE §8e) ────────
 *
 * A key goes through `nav._onKeyDown`; a click goes through the real `mousedown → mouseup → click`
 * sequence; a DRAG goes through `mousedown → mousemove → mouseup → click` at two different points,
 * which is what a browser actually sends and is the only shape that reproduces C1/C29. Every
 * assertion is an absolute number or an identity, read off the PAINT'S OWN publications
 * (`S.pagerRect`, `S.listGeom`, `S.searchGeom`, `S.locatorRect`) rather than a second copy of the
 * layout — a restated 417x240 geometry here would go stale in exactly the silence this workstream
 * is about.
 *
 * ⚠ THE HOST'S FOLDS ARE NOT ASSUMED. AC-14's host half is one statement on the line-frozen
 *   `NavComputer.js:620` (`this._viewDriverInst?.onDeactivate?.()`), landing in the HOST lane; these
 *   cases drive the driver method the host fold calls, so they pass before and after that fold lands
 *   and they pin the half this owner is responsible for. The seam is the NAME.
 */

import { describe, it, expect } from 'vitest';
import { makeHeadlessNav, clickAt } from './helpers/headlessNav.mjs';

const W = 417, H = 240;   // ⭐ MAX'S OWN BUFFER — the size the review measured every defect at.

const press = (nav, code, over = {}) => {
  let prevented = 0;
  nav._onKeyDown({ code, shiftKey: false, key: '', preventDefault() { prevented++; },
                   stopPropagation() {}, ...over });
  return prevented;
};

/** A nav with the prism loaded and a design on, at `level`. `render()` publishes everything. */
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
 * A PAN: press at one point, move, release at another, and let the browser's `click` follow.
 *
 * ⛔ THE `click` IS PART OF IT, AND THAT IS THE WHOLE DEFECT. A browser fires `click` on the release
 * of a drag as well as on a tap — the only thing that tells them apart is the distance from
 * `mousedown`, which is why `_handleClick` measures it at all. `clickAt` in the shared helper presses
 * and releases at the SAME point, so it can only ever produce a tap.
 */
function panRelease(nav, x0, y0, x1, y1) {
  nav._handleMouseDown({ clientX: x0, clientY: y0, button: 0 });
  nav._handleMouseMove({ clientX: x1, clientY: y1 });
  nav._handleMouseUp();
  nav._handleClick({ clientX: x1, clientY: y1, button: 0 });
}

/** The centre of the pane the design published as its map — where a pan legitimately starts. */
function mapCentre(drv) {
  const m = drv.regions().map;
  return { x: Math.floor(m.x + m.w / 2), y: Math.floor(m.y + m.h / 2) };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-13 — a control fires on a CLICK, never on the release of a drag', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  it('⭐⭐ A PAN RELEASED ON DESIGN 1\'S PAGER DOES NOT PAGE THE RAIL', async () => {
    const { nav, drv } = await designNav({ mode: 'rail', level: 3 });
    const pgr = drv.S.pagerRect;
    expect(pgr, 'design 1 at PRISM published no pager, so the case is vacuous').toBeTruthy();
    expect(drv.S.listOffset, 'the rail did not open on page 1').toBe(0);
    const fwd = { x: Math.floor(pgr.mid) + 3, y: pgr.y + 2 };   // the FORWARD half of the drawn row
    const from = mapCentre(drv);

    panRelease(nav, from.x, from.y, fwd.x, fwd.y);
    expect(drv.S.listOffset,
      'a pan that began on the map and ended over the pager PAGED the rail (review C1: 0 → 27)')
      .toBe(0);

    // ⭐ THE CONTROL, ON THE SAME TEXEL: the guard must reject the DRAG, not the pager.
    clickAt(nav, fwd.x, fwd.y);
    expect(drv.S.listOffset, 'a genuine click on the pager stopped paging').toBe(27);
  }, 60000);

  it('⭐⭐ A PAN RELEASED ON DESIGN 2\'S `HERE · SECTOR` RE-CENTRES NOTHING', async () => {
    const { nav, drv } = await designNav({ mode: 'bars', level: 0 });
    const loc = drv.S.locatorRect;
    expect(loc, 'design 2 at GALAXY published no locator band').toBeTruthy();
    const to = { x: Math.floor(loc.x + loc.w / 2), y: Math.floor(loc.y + loc.h / 2) };
    const from = mapCentre(drv);
    nav._viewEase = null;

    panRelease(nav, from.x, from.y, to.x, to.y);
    expect(nav._viewEase, 'a pan released over HERE · SECTOR threw the view back at the player')
      .toBe(null);

    clickAt(nav, to.x, to.y);
    expect(!!nav._viewEase, 'a genuine click on HERE · SECTOR stopped re-centring').toBe(true);
  }, 60000);

  it('⭐⭐ AND A PAN RELEASED ON A DRAWN SEARCH RESULT ARMS NO WARP — the C29 case', async () => {
    const { nav, drv } = await designNav({ mode: 'rail', level: 3 });
    press(nav, 'Slash');
    for (const [code, key] of [['KeyS', 's'], ['KeyO', 'o'], ['KeyL', 'l']]) press(nav, code, { key });
    nav.render();
    const g = drv.S.searchGeom;
    expect(g && g.rows, 'the drawn search resolved no rows for "sol", so the case is vacuous')
      .toBeGreaterThan(1);

    // ⭐ THE INSTRUMENT'S OWN ARMING METHOD IS THE PROBE, not a stub of anything under test: the
    //   picker's answer is the index it hands `_searchHighlight`, and `_activateSearchHighlight` is
    //   what `search.activate` calls next — the very step that reaches `_onCommit({type:'warp'})`
    //   and, through `main.js:5970`, closes the nav and starts the jump.
    const armed = [];
    nav._activateSearchHighlight = () => { armed.push(nav._searchHighlight); };
    const x = Math.floor((g.x0 + g.x1) / 2);
    const row0 = g.top + g.lead;

    panRelease(nav, mapCentre(drv).x, mapCentre(drv).y, x, row0);
    expect(armed, 'a pan released over a search result armed a warp').toEqual([]);
    expect(drv.S.search.open, 'a pan released over the field also closed it').toBe(true);

    clickAt(nav, x, row0);
    expect(armed, 'a genuine click on a search result stopped arming its warp').toEqual([0]);
  }, 60000);

  it('⛔ AND THE KEYBOARD `Tab` STILL CHANGES LEVEL AFTER A PRESS SOMEWHERE ELSE', async () => {
    // ⚠ THE REGRESSION THE GUARD ITSELF ALMOST SHIPPED. `tabLevel` synthesises its click at the
    //   centre of a tab, and the guard measures every click against the last `mousedown` — so with
    //   the pointer last pressed on the map, Tab read as the release of a 100-texel drag and did
    //   nothing. Measured while building it; `synthClick` is what makes a key a key.
    const { nav } = await designNav({ mode: 'rail', level: 2 });
    nav._handleMouseDown({ clientX: 120, clientY: 120, button: 0 });
    nav._handleMouseUp();
    press(nav, 'Tab');
    expect(nav._levelIndex, 'Tab stopped moving the level once the pointer had been pressed').toBe(3);
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-14 — closing the nav ends what the pilot was in the middle of', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  it('⭐⭐ THE DRAWN SEARCH, THE PAGE AND THE CLICK HIGHLIGHT DIE; THE SORT SURVIVES', async () => {
    const { nav, drv } = await designNav({ mode: 'rail', level: 0 });
    expect(typeof drv.onDeactivate, 'the host fold on NavComputer.js:620 has nothing to call')
      .toBe('function');

    press(nav, 'BracketRight');                    // the sort key first — `cycleSort` resets the page
    press(nav, 'Equal');                           // page 2 of the sector list
    clickAt(nav, 20, 10);                          // a real map click, which is what writes `S.pick`
    press(nav, 'Slash');
    for (const [code, key] of [['KeyS', 's'], ['KeyO', 'o'], ['KeyL', 'l']]) press(nav, code, { key });
    nav.render();

    const sortIdx = drv.S.sortIdx, sortLabel = drv.S.sortLabel;
    expect(drv.S.search.open, 'the fixture never opened the drawn search').toBe(true);
    expect(drv.S.search.text, 'the fixture typed nothing into the field').toBe('sol');
    expect(!!drv.S.searchGeom, 'the field published no grid').toBe(true);
    expect(!!drv.S.pick, 'the fixture left no click highlight').toBe(true);
    expect(drv.S.listOffset, 'the fixture never paged the list').toBe(27);
    expect(sortIdx, 'the fixture never moved the sort').toBe(1);
    drv.S.list = true; drv.S.zoomIdx = 2;          // the other two PREFERENCES, set where they are read

    drv.onDeactivate();

    expect(drv.S.search.open, 'the drawn search survived the close — reopening lands in the field')
      .toBe(false);
    expect(drv.S.search.text, 'the old query survived the close').toBe('');
    expect(drv.S.search.rows, 'the old results survived the close').toEqual([]);
    expect(drv.S.searchGeom, 'the field left a grid a click could still hit').toBe(null);
    expect(drv.S.pick, 'a click highlight from the previous session survived the close').toBe(null);
    expect(drv.S.listOffset, 'the nav reopened on page 2 of the list').toBe(0);
    expect(drv.S.sortIdx, 'the pilot\'s SORT CHOICE was thrown away by a close').toBe(sortIdx);
    expect(drv.S.sortLabel, 'the pilot\'s sort label was thrown away by a close').toBe(sortLabel);
    expect(drv.S.list, 'design 2\'s list mode was thrown away by a close').toBe(true);
    expect(drv.S.zoomIdx, 'the zoom step was thrown away by a close').toBe(2);
  }, 60000);

  it('⭐⭐ AND A LEVEL LAG DIES WITH IT — a close mid-ease reopened on a map that ate every click', async () => {
    const { nav, drv } = await designNav({ mode: 'rail', level: 2 });
    press(nav, 'Tab');                             // REGION → PRISM, the pair §8d eases
    nav.render();
    expect(drv.S.levelLag && drv.S.levelLag.kind, 'the fixture armed no lag').toBe('map');

    drv.onDeactivate();
    expect(drv.S.levelLag, 'a pending level lag survived the close — `resolveHover` and `remapClick` '
      + 'eat everything while one is set, so the reopened map is dead').toBe(null);
  }, 60000);

  it('⛔ AND SO DOES AN ARM THAT NO FRAME HAS CONSUMED YET', async () => {
    const { nav, drv } = await designNav({ mode: 'rail', level: 2 });
    press(nav, 'Tab');                             // no render: the arm is still on `S`
    expect(drv.S.levelArm && drv.S.levelArm.from, 'the fixture armed nothing').toBe(2);

    drv.onDeactivate();
    expect(drv.S.levelArm, 'a tab arm survived the close and can lag the next session\'s first move')
      .toBe(null);
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-17 — the hit band IS the drawn row', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * ⭐ THE BAND, STATED ONCE. Every publisher draws row `i` at `top + (i + 1) * lead`, so row `i`
   * owns `[top + (i+1)*lead, top + (i+2)*lead)`. These two helpers are the FIRST and LAST texel of
   * that band — the two the AC names — and nothing below restates the arithmetic.
   */
  const bandTop = (g, i) => g.top + (i + 1) * g.lead;
  const bandBot = (g, i) => g.top + (i + 2) * g.lead - 1;

  it('⭐⭐ DESIGN 1\'S RAIL: BOTH EDGE TEXELS OF EVERY DRAWN ROW RESOLVE TO THAT ROW\'S STAR', async () => {
    const { nav, drv } = await designNav({ mode: 'rail', level: 3 });
    const g = drv.S.listGeom;
    expect(g && g.rows, 'the rail drew no rows at PRISM, so the case is vacuous').toBeGreaterThan(4);
    const x = Math.floor((g.x0 + g.x1) / 2);

    for (let i = 0; i < g.rows; i++) {
      const want = drv.D.starRows[g.offset + i];
      for (const [edge, y] of [['top', bandTop(g, i)], ['bottom', bandBot(g, i)]]) {
        drv.resolveHover(x, y, W, H);
        const got = nav._hoveredLocalStar && nav._hoveredLocalStar.star;
        expect(got && got.seed,
          `the ${edge} texel (y=${y}) of drawn rail row ${i} resolved to the wrong star`)
          .toBe(want.seed);
      }
    }

    // ⛔ AND THE TWO TEXELS OUTSIDE THE LIST RESOLVE TO NOTHING — the half `Math.round` got wrong at
    //    the top edge (it rounded the header row up into row 0).
    drv.resolveHover(x, bandTop(g, 0) - 1, W, H);
    expect(nav._hoveredLocalStar, 'the texel ABOVE row 0 picked a row').toBe(null);
    drv.resolveHover(x, bandBot(g, g.rows - 1) + 1, W, H);
    expect(nav._hoveredLocalStar, 'the texel BELOW the last row picked a row').toBe(null);
  }, 60000);

  it('⭐ DESIGN 2\'S LIST: the same band, published by the other painter', async () => {
    const { nav, drv } = await designNav({ mode: 'bars', level: 3 });
    press(nav, 'KeyL');                            // the real key that puts the list on the glass
    nav.render();
    const g = drv.S.listGeom;
    expect(g && g.rows, 'design 2 drew no list after `L`, so the case is vacuous').toBeGreaterThan(4);
    const x = Math.floor((g.x0 + g.x1) / 2);

    for (let i = 0; i < g.rows; i++) {
      const want = drv.D.starRows[g.offset + i];
      if (!want) break;
      for (const [edge, y] of [['top', bandTop(g, i)], ['bottom', bandBot(g, i)]]) {
        drv.resolveHover(x, y, W, H);
        const got = nav._hoveredLocalStar && nav._hoveredLocalStar.star;
        expect(got && got.seed,
          `the ${edge} texel (y=${y}) of drawn list row ${i} resolved to the wrong star`)
          .toBe(want.seed);
      }
    }
  }, 60000);

  it('⭐⭐ AND THE DRAWN SEARCH: the bottom texel of a result warps to THAT result', async () => {
    const { nav, drv } = await designNav({ mode: 'rail', level: 3 });
    press(nav, 'Slash');
    for (const [code, key] of [['KeyS', 's'], ['KeyO', 'o'], ['KeyL', 'l']]) press(nav, code, { key });
    nav.render();
    const g = drv.S.searchGeom;
    expect(g && g.rows, 'the drawn search resolved no rows for "sol"').toBeGreaterThan(1);
    const x = Math.floor((g.x0 + g.x1) / 2);

    // ⚠ ONE ROW PER FRESH FIELD: activating a row CLOSES the search, which is the shipped behaviour.
    for (let i = 0; i < g.rows; i++) {
      for (const [edge, y] of [['top', bandTop(g, i)], ['bottom', bandBot(g, i)]]) {
        if (!drv.S.search.open) {
          press(nav, 'Slash');
          for (const [code, key] of [['KeyS', 's'], ['KeyO', 'o'], ['KeyL', 'l']]) press(nav, code, { key });
          nav.render();
        }
        const armed = [];
        nav._activateSearchHighlight = () => { armed.push(nav._searchHighlight); };
        clickAt(nav, x, y);
        expect(armed, `the ${edge} texel (y=${y}) of drawn search row ${i} warped to the wrong result`)
          .toEqual([g.offset + i]);
      }
    }
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-21 — a modifier chord is not text, and is not the field\'s to eat', () => {
// ══════════════════════════════════════════════════════════════════════════════════════════════════

  /** The field, open, with a query already in it — so "the query is unchanged" is a real assertion. */
  async function openField() {
    const h = await designNav({ mode: 'rail', level: 3 });
    press(h.nav, 'Slash');
    for (const [code, key] of [['KeyS', 's'], ['KeyO', 'o'], ['KeyL', 'l']]) press(h.nav, code, { key });
    expect(h.drv.S.search.text, 'the fixture typed nothing into the field').toBe('sol');
    return h;
  }

  it('⭐⭐ Ctrl / Meta / Alt CHORDS TYPE NOTHING AND ARE NOT CONSUMED', async () => {
    const { nav, drv } = await openField();
    const chords = [
      ['KeyR', 'r', { ctrlKey: true }],            // reload — the one the review named
      ['KeyV', 'v', { ctrlKey: true }],            // paste
      ['KeyW', 'w', { metaKey: true }],            // close tab
      ['KeyT', 't', { altKey: true }],
    ];
    for (const [code, key, mods] of chords) {
      const consumed = drv.searchKey({ code, key, ...mods,
                                       preventDefault() {}, stopPropagation() {} });
      expect(consumed, `${JSON.stringify(mods)} + ${key} was consumed by the drawn field, so the `
        + 'host fold preventDefaults it and the browser loses its shortcut').toBe(false);
      expect(drv.S.search.text, `${JSON.stringify(mods)} + ${key} typed a character into the query`)
        .toBe('sol');
    }
    expect(drv.S.search.open, 'a chord closed the field').toBe(true);
  }, 60000);

  it('⭐ AND THE SAME CHORDS THROUGH THE REAL KEY HANDLER LEAVE THE QUERY ALONE', async () => {
    const { nav, drv } = await openField();
    press(nav, 'KeyR', { key: 'r', ctrlKey: true });
    press(nav, 'KeyC', { key: 'c', ctrlKey: true });
    expect(drv.S.search.text, 'a chord reached the query through `_onKeyDown`').toBe('sol');

    // ⭐ THE CONTROL: plain typing is untouched, chord or no chord, and SHIFT is still text.
    press(nav, 'KeyA', { key: 'a' });
    press(nav, 'KeyR', { key: 'R', shiftKey: true });
    expect(drv.S.search.text, 'the fix stopped ordinary typing reaching the query').toBe('solaR');
  }, 60000);
});
