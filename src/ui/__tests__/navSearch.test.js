/**
 * navSearch — AC-11's DRAWN SEARCH, plus the three gaps phase 2 measured on the running game.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════════
 * ⛔⛔ THE RULE EVERY CASE HERE OBEYS, AND THE ONE THIS WORKSTREAM KEEPS PAYING FOR WHEN IT DOES NOT:
 * ASK OF EVERY GREEN TEST WHAT INPUT IN ITS SAMPLE COULD MAKE IT FAIL. All 28 view-mode tests passed
 * while the `V` key was dead code, because not one drove the keyboard; the list picker's test passed
 * while the picker acted on the wrong star, because it never rendered between the mousemove and the
 * click. So:
 *
 *   · every KEY case goes through `nav._onKeyDown`, the entry a clause commented out by a mid-line
 *     fold would fail at — never through a driver method;
 *   · every SEARCH case asserts the observable consequence, `_onCommit` firing with the RIGHT star,
 *     and the discriminating case picks the SECOND result, which a hand-rolled `[0]` cannot pass;
 *   · every PAINT case reads what was actually put on the glass, through an injected
 *     `drawPixelText`, rather than asserting that the drawing code exists;
 *   · and the two measured defects (the sector bar's denominator, the tile sort) each ship with the
 *     measurement that proves the sample still contains the input that used to break them.
 *
 * ⭐ AND THE PIPELINE IS REUSED, NOT REBUILT — which is itself testable, and tested. `_runSearch`,
 * `_moveSearchHighlight` and `_activateSearchHighlight` are NavComputer's own, unmodified; the cases
 * below pin that the drawn field routes THROUGH them (the wrapping cursor is the tell — a clamped
 * cursor of my own would fail it) rather than reimplementing a resolver at 240p.
 * ══════════════════════════════════════════════════════════════════════════════════════════════════
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav, makeRecordingContext, clickAt } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { measurePixelText } from '../../rendering/PixelText.js';

/** A 240p overlay with the prism loaded — what every design needs before it draws anything real. */
async function loadedNav({ width = 427, height = 240, mode = 'rail', level = 3 } = {}) {
  const h = await makeHeadlessNav({ width, height });
  h.nav._viewModesEnabled = true;       // what activate() sets; _openCockpitNav never calls it
  h.nav._levelIndex = level;
  h.nav.viewMode = mode;
  h.nav.render();
  h.drv = h.nav._viewDriverInst;
  return h;
}

/** Press a key through the handler the document listener actually calls. */
const press = (nav, code, over = {}) =>
  nav._onKeyDown({ code, shiftKey: false, key: '', preventDefault() {}, stopPropagation() {}, ...over });

/** Type a word into the drawn field, one keystroke at a time, through the real keyboard path. */
function type(nav, word) {
  for (const ch of word) press(nav, 'Key' + ch.toUpperCase(), { key: ch });
}

/**
 * A query that resolves against the shipped known-object sources with NO catalog loaded.
 *
 * ⚠ NOT INVENTED — `resolveKnownObjects` reaches the KnownSystems registry and the named-systems
 * box without any fetch, and 'tau' hits `Alpha Centauri` (registry, via its Toliman/Rigil alias
 * set) plus eleven named systems. A query with one hit could not tell a cursor that moves from a
 * cursor that does not.
 * ⛔ AND IT CARRIES NO `L`, NO `V` AND NO `,` OR `.`, WHICH IS NOT A COINCIDENCE. Those four keys
 * are claimed by clauses folded onto `NavComputer.js:349` AHEAD of the search-routing clause, so
 * they reach the field second-hand or not at all — see the "keys the frozen clause order takes
 * first" case below, which is where that is pinned rather than dodged.
 */
const QUERY = 'tau';

/** Open the field and type `QUERY`, through the keyboard. Returns the harness. */
function openAndType(h, q = QUERY) {
  press(h.nav, 'Slash');
  type(h.nav, q);
  return h;
}

/** Every string the designs put on the glass this frame, through an injected text driver. */
function drawnStrings(drv, { design = 1, W = 427, H = 240 } = {}) {
  const seen = [];
  const painters = makeDesigns({
    S: drv.S, D: drv.D,
    drawPixelText: (_g, s) => { seen.push(String(s)); },
    measurePixelText,
  });
  const { ctx } = makeRecordingContext({ width: W, height: H });
  painters.resetRegions(); painters.resetViolations();
  drv.S.design = design;
  if (design === 1) painters.drawDesign1(ctx, W, H);
  else painters.drawDesign2(ctx, W, H);
  return seen;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 1.  AC-11 END TO END — `/`, TYPE, ARROW, ENTER, AND A REAL WARP IS ARMED.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-11 — / opens a search that actually warps', () => {
  it('⭐⭐ / then a name then ENTER fires _onCommit with THAT star, through _onKeyDown', async () => {
    const { nav, drv } = await loadedNav();
    openAndType({ nav, drv });
    expect(drv.searchActive(), '/ must open the field both hint rows advertise').toBe(true);
    expect(nav._searchResults.length, 'the sample must contain something to pick').toBeGreaterThan(1);

    const want = nav._searchResults[0];
    const fired = [];
    nav._onCommit = (a) => fired.push(a);
    press(nav, 'Enter');

    expect(fired, 'ENTER must arm exactly one warp').toHaveLength(1);
    expect(fired[0].type).toBe('warp');
    expect(fired[0].target).toBe('star');
    expect(fired[0].star.name, 'the wrong result was armed').toBe(want.name);
    expect([fired[0].star.wx, fired[0].star.wy, fired[0].star.wz])
      .toEqual([want.worldPos.x, want.worldPos.y, want.worldPos.z]);
    expect(drv.searchActive(), 'the field must close behind the commit').toBe(false);
  });

  it('⛔ THE DISCRIMINATOR: after one ArrowDown it arms the SECOND result, not the first', async () => {
    // A field that always warped to `_searchResults[0]` passes the case above and fails this one.
    // The arrows are the whole reason a drawn list beats a single "go to the best match" button.
    const { nav, drv } = await loadedNav();
    openAndType({ nav, drv });
    const second = nav._searchResults[1];
    expect(second, 'the query must resolve at least two objects or this pins nothing').toBeTruthy();

    press(nav, 'ArrowDown');
    expect(drv.S.search.highlight, 'the drawn highlight must follow the cursor').toBe(1);

    const fired = [];
    nav._onCommit = (a) => fired.push(a);
    press(nav, 'Enter');
    expect(fired).toHaveLength(1);
    expect(fired[0].star.name).toBe(second.name);
  });

  it('⛔ THE CURSOR IS `_moveSearchHighlight`, WHICH WRAPS — a clamped one of my own would fail here',
    async () => {
      const { nav, drv } = await loadedNav();
      openAndType({ nav, drv });
      const n = nav._searchResults.length;
      expect(drv.S.search.highlight).toBe(0);
      press(nav, 'ArrowUp');
      expect(nav._searchHighlight, 'UP from row 0 wraps to the last row').toBe(n - 1);
      expect(drv.S.search.highlight, 'and the drawn field shows the same row').toBe(n - 1);
      press(nav, 'ArrowDown');
      expect(drv.S.search.highlight, 'DOWN from the last row wraps back to 0').toBe(0);
    });

  it('a query that resolves nothing arms nothing, and the field still closes', async () => {
    const { nav, drv } = await loadedNav();
    openAndType({ nav, drv }, 'zzqqxx');
    expect(nav._searchResults).toHaveLength(0);
    expect(drv.S.search.rows).toHaveLength(0);
    const fired = [];
    nav._onCommit = (a) => fired.push(a);
    press(nav, 'Enter');
    expect(fired, 'an empty search must not warp somewhere').toHaveLength(0);
    expect(drv.searchActive(), 'and must not trap the pilot inside the field').toBe(false);
  });

  it('⛔ ESCAPE CLOSES AND ONLY CLOSES — it never drills a level and never commits', async () => {
    // The DOM widget got this right: its Escape stopped at `input.blur()` and never reached
    // `handleEscape`. A pilot who abandons a search must not also lose a level of the drill.
    const { nav, drv } = await loadedNav({ level: 3 });
    openAndType({ nav, drv });
    const fired = [];
    nav._onCommit = (a) => fired.push(a);
    press(nav, 'Escape');
    expect(drv.searchActive()).toBe(false);
    expect(nav._levelIndex, 'Escape drilled a level it was not asked to').toBe(3);
    expect(fired).toHaveLength(0);
    expect(drv.S.search.text).toBe('');
    expect(drv.S.search.rows).toHaveLength(0);
  });

  it('BACKSPACE narrows back out, and the result list follows the query both ways', async () => {
    const { nav, drv } = await loadedNav();
    openAndType({ nav, drv }, 'tauge');
    const narrow = nav._searchResults.length;
    for (let i = 0; i < 2; i++) press(nav, 'Backspace');
    expect(drv.S.search.text).toBe('tau');
    expect(nav._searchResults.length, 'deleting characters must widen the result set')
      .toBeGreaterThan(narrow);
  });

  /**
   * ⛔⛔ THE FOUR KEYS THE FROZEN CLAUSE ORDER TAKES BEFORE THE FIELD SEES THEM.
   *
   * `NavComputer.js:349` runs its clauses in written order, and the `,` / `.` ladder clause and the
   * `V` / `L` mode clause are both AHEAD of the search-routing clause. Measured: typing `alph`
   * produced `aph` and flipped design 2 into list mode. `SOL`, `ALPHA`, `POLARIS`, `VOLANS` — an `L`
   * is unavoidable in real use, so this is not a corner.
   *
   * ⭐ THREE OF THE FOUR ARE RECOVERED IN THE DRIVER, because those clauses call driver methods:
   * `toggleList` and `scrollLadder` type their key into the field instead of acting. This case is
   * what proves that recovery is real rather than a comment.
   */
  it('⛔ L and , and . reach the field as TEXT, and do not act on the design behind it', async () => {
    const { nav, drv } = await loadedNav({ mode: 'bars' });
    press(nav, 'Slash');
    press(nav, 'KeyL', { key: 'l' });
    expect(drv.S.list, 'typing an L flipped design 2 into list mode').toBe(false);
    expect(drv.S.search.text, 'and the letter was dropped on the floor').toBe('l');

    const { nav: nav2, drv: drv2 } = await loadedNav({ mode: 'rail', level: 4 });
    press(nav2, 'Slash');
    press(nav2, 'Period', { key: '.' });
    press(nav2, 'Comma', { key: ',' });
    expect(drv2.S.ladderScroll, 'a full stop typed into the field scrolled the SYSTEM ladder').toBe(0);
    expect(drv2.S.search.text).toBe('.,');
  });

  /**
   * ⭐ V WAS THE ONE KEY THAT COULD NOT BE RECOVERED FROM THE DRIVER, AND THE REORDER RECOVERED IT.
   *
   * Its clause sets `this.viewMode` inline and calls no driver method, so no amount of work in this
   * file could reach it — typing "SOL", "POLARIS" or "VOLANS" flipped the design out from under the
   * pilot mid-query. The fix was not here at all: it was moving the searchKey clause ahead of the
   * ladder and mode clauses inside `NavComputer.js:349`, which costs no line and no behaviour change
   * when the field is closed. This case is what proves the order, so it fails if anyone re-folds
   * that line in the old sequence.
   */
  it('⭐ V TYPES INTO THE FIELD INSTEAD OF CYCLING THE DESIGN, and cycles again once it is closed', async () => {
    const { nav, drv } = await loadedNav({ mode: 'rail' });
    openAndType({ nav, drv });
    press(nav, 'KeyV', { key: 'v' });
    expect(nav.viewMode, 'a V typed into the query changed the design under it').toBe('rail');
    expect(drv.S.search.text, 'and the letter was dropped on the floor').toBe(QUERY + 'v');

    press(nav, 'Escape');
    expect(drv.searchActive()).toBe(false);
    press(nav, 'KeyV', { key: 'v' });
    expect(nav.viewMode, 'V stopped cycling once the field was closed').toBe('bars');
  });

  it('⛔ the six pan letters go INTO the field, not into _heldKeys', async () => {
    const { nav, drv } = await loadedNav();
    press(nav, 'Slash');
    for (const [code, key] of [['KeyW', 'w'], ['KeyA', 'a'], ['KeyS', 's'],
                               ['KeyD', 'd'], ['KeyR', 'r'], ['KeyF', 'f']]) press(nav, code, { key });
    expect(drv.S.search.text, 'the field did not receive what was typed').toBe('wasdrf');
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF']) {
      expect(nav._heldKeys.has(code), `${code} panned the camera while typing`).toBe(false);
    }
  });

  it('⛔ and `_searchFocused` is never set — it would make the field unreachable, Escape included',
    async () => {
      const { nav, drv } = await loadedNav();
      openAndType({ nav, drv });
      expect(nav._searchFocused, 'the guard on line 349 would swallow every following clause')
        .toBe(false);
      press(nav, 'Escape');
      expect(drv.searchActive()).toBe(false);
    });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 2.  ⭐ THE PIPELINE IS REUSED, NOT REBUILT.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the drawn field is a presentation over NavComputer\'s own search', () => {
  it('types the query into `_runSearch`, character by character', async () => {
    const { nav, drv } = await loadedNav();
    const seen = [];
    const real = nav._runSearch.bind(nav);
    nav._runSearch = (q) => { seen.push(q); return real(q); };
    press(nav, 'Slash');
    type(nav, 'sol');
    expect(seen, 'the resolver must see the growing query, not a finished one')
      .toEqual(['', 's', 'so', 'sol']);
    expect(drv.S.search.text).toBe('sol');
  });

  it('⛔ `S.search.rows` MIRRORS `_searchResults` THROUGH `_searchKindLabel`, and invents neither',
    async () => {
      const { nav, drv } = await loadedNav();
      press(nav, 'Slash');
      // Replace the resolver with a known answer: if the mirror read anything else, or labelled the
      // rows itself, these two names could not both come out the other side.
      nav._runSearch = (q) => {
        nav._searchResults = q ? [{ name: 'PROBE ONE', kind: 'named', region: 'ARM' },
                                  { name: 'PROBE TWO', kind: 'registry' }] : [];
        nav._searchHighlight = q ? 0 : -1;
      };
      type(nav, 'x');
      expect(drv.S.search.rows).toEqual([
        { name: 'PROBE ONE', kind: 'ARM' },        // `_searchKindLabel` returns r.region for 'named'
        { name: 'PROBE TWO', kind: 'SYSTEM' },     // …and the literal 'SYSTEM' for 'registry'
      ]);
      expect(drv.S.search.highlight).toBe(0);
    });

  it('⛔ never touches window._warpTarget — the commit goes through the supported callback', async () => {
    const { nav, drv } = await loadedNav();
    openAndType({ nav, drv });
    nav._onCommit = () => {};
    const before = globalThis.window._warpTarget;
    press(nav, 'Enter');
    expect(globalThis.window._warpTarget).toBe(before);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 3.  ⭐ IT IS DRAWN — IN THE MENU'S OWN INK, IN BOTH DESIGNS.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the field is on the canvas, in each design\'s own face', () => {
  for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
    it(`design ${design}: the query line and the result names are actually painted`, async () => {
      const { nav, drv } = await loadedNav({ mode });
      openAndType({ nav, drv });
      const strings = drawnStrings(drv, { design });
      const first = drv.S.search.rows[0].name.toUpperCase();

      expect(strings.some((s) => s.includes('>' + QUERY.toUpperCase())),
        `design ${design} drew no query line: ${JSON.stringify(strings.slice(0, 12))}`).toBe(true);
      expect(strings.some((s) => s.includes(first)),
        `design ${design} drew no result row for ${first}`).toBe(true);
      expect(strings.some((s) => s.includes('ESC CLOSE')),
        `design ${design} advertises no way out of the field`).toBe(true);
    });

    it(`design ${design}: with the field CLOSED not one of those strings is on the glass`, async () => {
      // The control for the case above. Without it, a test that only ever looks at an open field
      // cannot tell "the search is drawn" from "the design always draws these words".
      const { nav, drv } = await loadedNav({ mode });
      nav.render();
      const strings = drawnStrings(drv, { design });
      expect(strings.some((s) => s.includes('>' + QUERY.toUpperCase()))).toBe(false);
      expect(strings.some((s) => s.includes('ESC CLOSE'))).toBe(false);
    });
  }

  it('⛔ design 1 publishes NO `listGeom` while the field holds the rail', async () => {
    // The rail's rows are not on the glass, so a picker resolving against last frame's grid would
    // drill a sector the pilot cannot see. The field publishes `searchGeom` instead.
    const { nav, drv } = await loadedNav({ level: 0 });
    nav.render();
    expect(drv.S.listGeom, 'the rail must publish its grid when it is drawing rows').toBeTruthy();
    press(nav, 'Slash');
    type(nav, QUERY);
    nav.render();
    expect(drv.S.listGeom, 'the rail\'s grid outlived the rows it describes').toBe(null);
    expect(drv.S.searchGeom.rows).toBeGreaterThan(0);
  });

  it('⛔ THE LAYOUT GUARD STAYS CLEAN with the field open, every level, both designs, three buffers',
    async () => {
      // `assertFits` / `assertClear` are the only thing between "this fits" and "the canvas clipped
      // the overflow for free". A new element that overflows must SHRINK; a region may never widen.
      const { nav, drv } = await loadedNav();
      openAndType({ nav, drv });
      const bad = [];
      for (const [W, H] of [[427, 240], [320, 180], [256, 144]]) {
        const { ctx } = makeRecordingContext({ width: W, height: H });
        for (const mode of ['rail', 'bars']) {
          nav.viewMode = mode;
          for (let level = 0; level < 5; level++) {
            nav._levelIndex = level;
            drv.render(ctx, W, H);
            for (const v of drv.violations()) bad.push({ W, H, mode, level, msg: v.msg });
          }
        }
      }
      expect(bad, JSON.stringify(bad.slice(0, 6), null, 1)).toHaveLength(0);
    });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 4.  ⭐ AND A MOUSE CAN PICK A ROW — the DOM widget could, and losing that would be a regression.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the drawn rows are clickable, off the geometry the paint published', () => {
  for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
    it(`design ${design}: clicking result row 2 arms result 2`, async () => {
      const { nav, drv } = await loadedNav({ mode });
      openAndType({ nav, drv });
      nav.render();
      const g = drv.S.searchGeom;
      expect(g && g.design, `design ${design} published no row grid`).toBe(design);
      expect(g.rows, 'the sample needs a third row to be able to fail on the first').toBeGreaterThan(2);

      const want = nav._searchResults[(g.offset | 0) + 2];
      const fired = [];
      nav._onCommit = (a) => fired.push(a);
      clickAt(nav, g.x0 + 4, g.top + 3 * g.lead);

      expect(fired, 'the click did not reach the row').toHaveLength(1);
      expect(fired[0].star.name).toBe(want.name);
      expect(drv.searchActive()).toBe(false);
    });
  }

  it('⛔ a click OFF the rows closes the field and does NOT drill the map underneath', async () => {
    // In design 2 the rows ARE the map. A click falling through would drill a tile behind a field
    // drawn over it — the "invisible live button" defect, arriving for a third time.
    const { nav, drv } = await loadedNav({ mode: 'bars', level: 1 });
    openAndType({ nav, drv });
    nav.render();
    const fired = [];
    nav._onCommit = (a) => fired.push(a);
    const before = nav._levelIndex;
    clickAt(nav, 4, nav._canvas.height - 2);          // the bottom bar, below every drawn row
    expect(drv.searchActive(), 'a click outside the field must dismiss it, as blur did').toBe(false);
    expect(nav._levelIndex, 'the click drilled through the overlay').toBe(before);
    expect(fired).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 5.  AC-6 — TAB WRAPS.  Measured `[3, 4, 4, 4]` on the running game: dead at SYSTEM.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('TAB is a ring, not a clamp', () => {
  it('⛔ Tab at SYSTEM wraps to GALAXY, through `_onKeyDown`', async () => {
    const { nav } = await loadedNav({ level: 3 });
    nav._currentSystemData = { planets: [] };   // in a system — with none, SYSTEM is skipped by design
    press(nav, 'Tab');
    expect(nav._levelIndex, 'Tab did not reach SYSTEM').toBe(4);
    press(nav, 'Tab');
    expect(nav._levelIndex, 'Tab is a dead key at SYSTEM — the hint row still says TAB LEVEL').toBe(0);
  });

  it('⛔ Shift+Tab at GALAXY wraps to SYSTEM', async () => {
    const { nav } = await loadedNav({ level: 3 });
    nav._currentSystemData = { planets: [] };   // in a system — with none, SYSTEM is skipped by design
    nav._levelIndex = 0;
    nav.render();
    press(nav, 'Tab', { shiftKey: true });
    expect(nav._levelIndex, 'Shift+Tab is a dead key at GALAXY').toBe(4);
  });

  /**
   * ⚠⚠ AND HERE IS THE ONE PLACE THE WRAP DOES NOT LAND, MEASURED — IT IS INHERITED, NOT INTRODUCED.
   *
   * `tabLevel` is contractually required to go through `_handleClick`'s tab branch, because that is
   * what carries the drill animation, the `_viewStack` push, the drill sound and the level-4
   * auto-select-nearest-star. That branch refuses a jump to SYSTEM when `_findNearestStar()` returns
   * null (`:4459-4461`), and it CLEARS `_localStars` on every drill to a level that is not PRISM or
   * SYSTEM (`:4482-4485`) — so arriving at GALAXY by tabbing is precisely the state in which nothing
   * can be auto-selected, and Shift+Tab out of it is a no-op.
   *
   * ⛔ THIS IS THE SHIPPED TAB STRIP'S BEHAVIOUR AND IT PREDATES THIS WORKSTREAM: clicking the SYSTEM
   * tab from GALAXY in today's nav does exactly the same nothing. The fix is a load, and
   * `NavComputer.js:1434` has already ruled on where a load may be called from ("⛔ AND THE FIX IS
   * NOT TO CALL THE LOADERS FROM THE DRIVER"), so it is not this owner's to make. Pinned rather than
   * hidden, so the next reader finds the measurement instead of re-discovering the symptom.
   */
  it('⚠ INHERITED: the backward wrap cannot land while `_localStars` is empty', async () => {
    const { nav } = await loadedNav({ level: 3 });
    nav._currentSystemData = { planets: [] };   // in a system — with none, the back-wrap goes to PRISM and lands
    press(nav, 'Tab', { shiftKey: true });        // PRISM -> REGION, which clears _localStars
    press(nav, 'Tab', { shiftKey: true });        // REGION -> SECTOR
    press(nav, 'Tab', { shiftKey: true });        // SECTOR -> GALAXY
    expect(nav._levelIndex).toBe(0);
    expect(nav._localStars, 'the shipped tab branch clears the prism on the way out').toHaveLength(0);
    press(nav, 'Tab', { shiftKey: true });
    expect(nav._levelIndex, 'if this is 4, the dead end above has been fixed — delete this case')
      .toBe(0);
  });

  it('⭐ and the forward wrap still goes through the shipped drill path, not a level-setter', async () => {
    // `_handleClick`'s tab branch carries the drill animation, the `_viewStack` push, the drill
    // sound, the level-4 auto-select-nearest-star and the `_localStars` reset. A level-setter
    // reimplements none of that and looks like it works until the first drill lands empty.
    const { nav } = await loadedNav({ level: 4 });
    const drills = [];
    nav._onDrillSound = (i) => drills.push(i);
    press(nav, 'Tab');
    expect(nav._levelIndex).toBe(0);
    expect(drills, 'the wrap bypassed the drill path').toContain(0);
    expect(nav._modeTabIdx, 'the synthetic point landed in the LEGACY strip and was eaten')
      .toBeGreaterThanOrEqual(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 6.  THE TWO MEASURED PAINT DEFECTS.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the level-0 density bar normalises against the whole ranking', () => {
  it('⛔ under the NAME key no bar runs off the glass — measured at 475 stray fills before', async () => {
    const { nav, drv } = await loadedNav({ level: 0 });
    const W = nav._canvas.width, H = nav._canvas.height;

    // ⭐ THE SAMPLE'S OWN LIVENESS CHECK: `D.sectorRows[0].n` was the denominator, and under NAME it
    // is not the maximum. Without this the case could pass on a galaxy where the two agree.
    press(nav, 'BracketRight');
    nav.render();
    expect(drv.S.sortLabel).toBe('NAME');
    const rows = drv.D.sectorRows;
    const trueMax = rows.reduce((m, r) => Math.max(m, r.n), 0);
    expect(rows[0].n, 'row 0 IS the maximum here, so this case cannot fail').toBeLessThan(trueMax);

    const { ctx, rec } = makeRecordingContext({ width: W, height: H });
    drv.render(ctx, W, H);
    const fills = rec.calls.filter((c) => c.op === 'fillRect');
    const stray = fills.filter((c) => c.args[0] < 0 || c.args[1] < 0
      || c.args[0] + c.args[2] > W || c.args[1] + c.args[3] > H);
    expect(stray.length, `${stray.length} fills off a ${W}x${H} buffer, e.g. ` +
      JSON.stringify(stray.slice(0, 3).map((c) => c.args))).toBe(0);

    // …and the bar itself is back inside its four squares: the worst row asked for 90.
    const squares = fills.filter((c) => c.args[2] === 4 && c.args[3] === 4);
    expect(squares.length, 'the bar is drawn 4 squares to a row at most')
      .toBeLessThanOrEqual(4 * (drv.S.listGeom ? drv.S.listGeom.rows : 27));
  });
});

describe('the tiles at SECTOR and REGION honour the sort key', () => {
  it('⛔ `]` re-orders the rail\'s tiles by ID, and the default order is unchanged', async () => {
    const { nav, drv } = await loadedNav({ level: 1 });
    nav.render();
    const byCount = (drv.S.railTiles || []).map((t) => t.id);
    expect(byCount.length, 'the rail draws rows at SECTOR').toBeGreaterThan(4);
    expect(drv.S.sortLabel).toBe('STARS');

    press(nav, 'BracketRight');
    nav.render();
    expect(drv.S.sortLabel).toBe('ID');
    const byId = (drv.S.railTiles || []).map((t) => t.id);
    expect(byId, 'the key moved and the list did not — which is what shipped').not.toEqual(byCount);
    const ij = (drv.S.railTiles || []).map((t) => t.i * 100 + t.j);
    expect(ij.every((v, i) => i === 0 || ij[i - 1] < v), `not in (i,j) order: ${byId.join(',')}`).toBe(true);

    press(nav, 'BracketLeft');
    nav.render();
    expect((drv.S.railTiles || []).map((t) => t.id), 'the default order must come back')
      .toEqual(byCount);
  });

  it('⛔ AND THE PICKER STILL NAMES THE TILE THE ROW SHOWS after the re-order', async () => {
    // If the map's tags or the picker kept the count ranking while the rail drew the ID order, the
    // pilot would click "A1" and drill whatever tile used to sit in that slot.
    const { nav, drv } = await loadedNav({ level: 1 });
    press(nav, 'BracketRight');
    nav.render();
    const lg = drv.S.listGeom;
    const row0 = drv.S.railTiles[0];
    nav._handleMouseMove({ clientX: lg.x0 + 4, clientY: lg.top + lg.lead });
    nav.render();
    const n = drv.S.mapProj ? drv.S.mapProj.n : 8;
    expect(nav._hoveredTile, `rail row 0 names ${row0.id}`)
      .toEqual({ col: row0.i, row: n - 1 - row0.j });
  });

  it('⛔ the ID order is (i, j) and not a string sort — A10 does not belong between A1 and A2',
    async () => {
      const { nav, drv } = await loadedNav({ level: 2 });   // 16x16, so the ids reach A10..A16
      press(nav, 'BracketRight');
      nav.render();
      const ids = (drv.S.railTiles || []).map((t) => t.id);
      expect(ids.slice(0, 3)).toEqual(['A1', 'A2', 'A3']);
    });
});
