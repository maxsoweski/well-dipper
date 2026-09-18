/**
 * navViewModes/search.js — THE DRAWN SEARCH'S CONTROL HALF (AC-11).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════════
 * ⭐⭐ THE PIPELINE IS REUSED, NOT REBUILT. THIS FILE RESOLVES NOTHING.
 *
 * `NavComputer` has had a complete player-facing search since Increment 4, and every part of it is
 * pure logic except the presentation:
 *
 *   `_runSearch(query)`            fills `_searchResults` and sets `_searchHighlight`, by way of
 *                                  `resolveKnownObjects` (`src/generation/knownObjectSearch.js`) —
 *                                  which is itself pure and headless, and resolves FOUR sources:
 *                                  real catalog stars including their dedup aliases, the
 *                                  KnownSystems registry and ITS alias sets, named systems inside a
 *                                  player-centred box, and structures (globulars, Messier/NGC).
 *   `_moveSearchHighlight(delta)`  the wrapping cursor.
 *   `_activateSearchHighlight()`   -> `_selectSearchResult(index)`, which arms the warp through the
 *                                  SAME supported close->warp `_onCommit` contract the COMMIT button
 *                                  uses. ⛔ It never hand-sets `window._warpTarget` and never uses
 *                                  the debug teleport, which bypasses `onPrepareSystem`.
 *   `_searchKindLabel(r)`          the row's right-hand label.
 *
 * Only `_ensureSearchDom` and `_renderSearchResults` were DOM-bound, and the DOM widget they built —
 * a 320px full-resolution `<input>` at `top:12px left:12px` — had to be hidden under a view mode
 * (`style.css:1289`) because at 240p it lay across exactly the rows both designs put their chrome in.
 * Measured live, it covered "GALAXY SECTOR". So `/ SEARCH` was printed on both hint rows with nothing
 * behind it. THIS FILE IS THE REPLACEMENT FOR THOSE TWO METHODS AND NOTHING ELSE.
 *
 * ── ⭐ AND `_renderSearchResults` IS SAFE TO LEAVE IN THE PATH, WHICH IS WHY NOTHING IS FORKED ────
 *
 * `_runSearch` and `_moveSearchHighlight` both END by calling `_renderSearchResults()`, so calling
 * them from here reaches DOM code. Measured against the source rather than assumed: that method
 * opens `if (!this._searchDom) return;` — it is a NO-OP when the widget was never built, and when it
 * WAS built (the overlay's `activate()` calls `_showSearch()`, which builds it) it repaints a list
 * that CSS has already taken off the glass. Either way it cannot throw and cannot draw. So the whole
 * logic half is reachable unchanged, and `NavComputer.js` — line-count-frozen at 4711 — needs no edit
 * at all for AC-11 beyond the key clause that was already folded onto line 349.
 *
 * ── ⛔ WHAT THE DESIGNS SEE, AND WHY IT IS NOT `_searchResults` ──────────────────────────────────
 *
 * `S.search.rows` is `[{ name, kind }]` — plain data, mirrored out of `_searchResults` here. The
 * designs are `nav-240p-lab.html`'s draw code lifted verbatim, and the lab has no resolver at all;
 * handing them a `SearchResult` would tie the PICTURE to the shape of a module the lab cannot import,
 * and the lab would stop being able to draw the field it is the spec for. Four fields cross the seam
 * — `open`, `text`, `highlight`, `rows` — and that is the whole contract.
 *
 * ── ⛔ `nav._searchFocused` IS NEVER SET, AGAINST INTERFACE §3's PARENTHETICAL ───────────────────
 *
 * `_onKeyDown` opens with `if (this._searchFocused) return;` (:349) and EVERY view-mode clause,
 * including the `searchKey` routing clause, is folded onto that same line AFTER it. Setting the flag
 * would make the drawn field unreachable by the keyboard the instant it opened — Escape included, so
 * the pilot would be locked inside a field with no way out. The reason the flag existed at all was
 * to keep the six WASD/R/F pan letters out of `_heldKeys` while typing, and that is met here by a
 * shorter route: `key()` CONSUMES those letters into the query, so they never reach the pan handler.
 */

/** The longest query the field will hold. The DOM input had no cap; a 240p row does. */
export const SEARCH_TEXT_CAP = 40;

/**
 * Is this keystroke a MODIFIER CHORD — Ctrl, Meta (Cmd/Win) or Alt held?
 *
 * ⭐⭐ AC-21 (nav-defects-batch-2026-09-18), REVIEW C30. Shift is deliberately absent: Shift is how
 * a capital letter is typed and the field wants it. The other three are never text on any layout the
 * game ships to — they are the browser's and the operating system's own shortcuts.
 * ⚠ THE ONE LAYOUT THIS IS ROUGH ON IS AltGr, which Windows reports as Ctrl+Alt, so a European
 *   keyboard's `@` or `{` will no longer reach the query. That is the review's stated bound and it is
 *   the safe side of the trade: a missing character in a search box is a nuisance, a swallowed Ctrl+R
 *   / Ctrl+W / Cmd+Q is the pilot's browser refusing to answer him.
 */
function chord(e) {
  return !!(e && (e.ctrlKey || e.metaKey || e.altKey));
}

/**
 * Did this keystroke produce text? `e.key.length === 1` is the browser's own answer — every named
 * key ('Escape', 'ArrowDown', 'Backspace', 'Shift') is longer, and every printable one, including
 * the ones a layout puts somewhere unexpected, is exactly one code unit.
 *
 * ⛔ AND A CHORD IS NOT TEXT, WHICH `key.length === 1` ALONE CANNOT SEE: `Ctrl+R` arrives with
 * `key: 'r'` and `Ctrl+V` with `key: 'v'`, so both passed this test, were appended to the query and
 * then `preventDefault`ed by the host's fold on `NavComputer.js:349` — the reload and the paste both
 * eaten, and an `R` typed into the field for each one.
 */
function printable(e) {
  const k = e && typeof e.key === 'string' ? e.key : '';
  return k.length === 1 && !chord(e);
}

/**
 * Build the drawn search's controller for one NavComputer / `S` pair.
 *
 * ⛔ EVERY CALL INTO THE INSTRUMENT IS WRAPPED. This runs from a key handler, and a throw out of a
 * key handler under `PanelHost` stops the uploads and freezes the glass on the last good frame —
 * which still looks alive, so the failure is invisible until Max clicks something.
 */
export function makeSearch(nav, S) {
  /** The row's right-hand label, from the instrument's own labeller. */
  function kindOf(r) {
    try {
      if (typeof nav._searchKindLabel === 'function') return String(nav._searchKindLabel(r) ?? '');
    } catch (e) { /* an unrecognised result kind is a blank label, never a frozen instrument */ }
    return String((r && r.kind) || '');
  }

  /**
   * Copy the instrument's live results onto `S` in the shape the designs read.
   *
   * ⭐ IT READS `_searchResults` / `_searchHighlight` RATHER THAN KEEPING ITS OWN COPY, so the
   * cursor the pilot sees is the cursor `_activateSearchHighlight` will act on. A private highlight
   * here would be a second copy of one piece of state, with the click and the picture disagreeing
   * exactly when a wrapping cursor crossed the end of the list.
   */
  function mirror() {
    const res = Array.isArray(nav._searchResults) ? nav._searchResults : [];
    S.search.rows = res.map((r) => ({ name: String((r && r.name) ?? ''), kind: kindOf(r) }));
    S.search.highlight = Number.isFinite(nav._searchHighlight) ? nav._searchHighlight : -1;
  }

  /** Type the current query into the instrument's own resolver, then mirror what it found. */
  function run() {
    try {
      if (typeof nav._runSearch === 'function') nav._runSearch(S.search.text);
    } catch (e) { /* a resolver fault is an empty result list, never a frozen instrument */ }
    mirror();
  }

  function open() {
    S.search.open = true;
    S.search.text = '';
    run();                       // clears `_searchResults` too, so the field opens on nothing
    return true;
  }

  function close() {
    S.search.open = false;
    S.search.text = '';
    run();                       // `_runSearch('')` is the instrument's own reset path
    S.search.rows = [];
    S.search.highlight = -1;
    S.searchGeom = null;
    return true;
  }

  /**
   * ENTER, or a click on a row: arm the warp the instrument's own way and close.
   *
   * ⛔ THE RANGE TEST IS HERE AS WELL AS INSIDE `_activateSearchHighlight`, because the caller needs
   * to know whether anything fired — a mouse pick that lands on an empty row must not report a
   * selection that did not happen. The ARMING itself is entirely `_selectSearchResult`'s, which is
   * the supported close->warp `_onCommit` contract.
   */
  function activate(index) {
    const res = Array.isArray(nav._searchResults) ? nav._searchResults : [];
    if (Number.isFinite(index)) nav._searchHighlight = index;
    const i = nav._searchHighlight;
    const ok = Number.isFinite(i) && i >= 0 && i < res.length;
    if (ok) {
      try { nav._activateSearchHighlight(); }
      catch (e) { /* the warp did not arm; the field still closes rather than trapping the pilot */ }
    }
    close();
    return ok;
  }

  /** UP / DOWN — the instrument's own wrapping cursor, mirrored back out. */
  function move(delta) {
    try { if (typeof nav._moveSearchHighlight === 'function') nav._moveSearchHighlight(delta); }
    catch (e) { /* see the file header */ }
    mirror();
  }

  /**
   * One keystroke into the drawn field.
   *
   * ⛔ IT RETURNS `true` FOR EVERYTHING WHILE THE FIELD IS OPEN, and that is the contract the key
   * clause on `NavComputer.js:349` was written against: the field consumes the keyboard FIRST, and
   * anything it does not consume would fall through to Tab / Enter / `[` / `]` / `-` / `=` and act on
   * the map behind the field. A `D` typed into a search box must not also pan the prism.
   *
   * @returns {boolean} true if the key was consumed.
   */
  function key(e) {
    if (!S.search.open) return false;
    // ⛔⛔ AC-21 — A MODIFIER CHORD IS NOT THE FIELD'S, AND SAYING SO IS THE WHOLE FIX. `false` is the
    //    only way to leave a key ALONE: the host's fold routes here first and `preventDefault`s +
    //    `stopPropagation`s whatever this answers `true` to (`NavComputer.js:349`), so "consume it but
    //    let the browser keep it" is not expressible — and consuming it is what ate `Ctrl+R`,
    //    `Ctrl+W` and `Cmd+Q` while the drawn field was open, and made `Ctrl+V` type a `V` into the
    //    query instead of pasting. `printable()` refusing the chord is only half: without this line
    //    the key fell through to the catch-all `return true` at the bottom and was eaten anyway,
    //    silently, which is worse than typing the letter.
    // ⚠ IT IS AHEAD OF Escape/Enter/Arrow/Backspace ON PURPOSE. None of those is a chord the field
    //   defines a meaning for, and a `Ctrl+Backspace` handled here would be the field claiming the
    //   platform's delete-word. The field's own keys are the unmodified ones.
    // ⚠⚠ AND IT HANDS THE CHORD TO THE CLAUSES BEHIND IT ON `:349` — which is where `Ctrl+V` now
    //   reaches the `KeyV` clause and cycles the look, because that clause tests `e.code` with no
    //   modifier test of its own. That is the HOST's line and its own defect (it is already true with
    //   the field closed); flagged to the coordinator rather than worked around here, because the
    //   alternative is this file keeping `Ctrl+V` away from the browser to hide it.
    if (chord(e)) return false;
    const code = e && e.code;
    // ⛔ ESCAPE CLOSES AND ONLY CLOSES. The DOM widget got this right — its Escape stopped at
    //    `input.blur()` and never reached `handleEscape` — and losing it here would mean the pilot
    //    who abandons a search also loses a level of the drill he did not ask to leave.
    if (code === 'Escape') { close(); return true; }
    if (code === 'Enter' || code === 'NumpadEnter') { activate(); return true; }
    if (code === 'ArrowDown') { move(1); return true; }
    if (code === 'ArrowUp') { move(-1); return true; }
    if (code === 'Backspace') { S.search.text = S.search.text.slice(0, -1); run(); return true; }
    if (printable(e)) {
      S.search.text = (S.search.text + e.key).slice(0, SEARCH_TEXT_CAP);
      run();
      return true;
    }
    return true;
  }

  /**
   * Which DRAWN result row is under this point? `-1` for none.
   *
   * ⭐ THE GRID COMES OUT OF THE PAINT (`S.searchGeom`), the same way `S.listGeom` does and for the
   * same reason: the two designs lay the field out differently — design 1 in the rail, design 2
   * full-width over the map — and a hit-test that restated either would be a second copy of a
   * layout this workstream is contractually not allowed to edit at its source.
   */
  function rowAt(x, y) {
    const g = S.searchGeom;
    if (!g || !(g.lead > 0) || !(g.rows > 0)) return -1;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return -1;
    if (x < g.x0 || x > g.x1) return -1;
    // ⭐⭐ AC-17 (nav-defects-batch-2026-09-18), REVIEW C16 — THE BAND IS THE DRAWN ROW. Both fields
    // draw result row `i` at `top + (i + 1) * lead` (`designs.js:1415` and `:1837`, the lines that
    // publish this very grid), so row `i` owns `[top + (i+1)*lead, top + (i+2)*lead)`. `Math.round`
    // asked about the band CENTRED on the row — half a row high — so the lower half of every result
    // resolved to the result BELOW it, and clicking it warped to the wrong star. Identical change and
    // identical reasoning to `listRowAt`'s in `index.js`; one arithmetic, stated in both pickers
    // because the two grids are published by different painters.
    const i = Math.floor((y - g.top - g.lead) / g.lead);
    return i >= 0 && i < g.rows ? i : -1;
  }

  /** The index into `_searchResults` that a drawn row names — the paged window comes from the paint. */
  function resultIndexOf(row) {
    const g = S.searchGeom;
    return (Number.isFinite(g && g.offset) ? g.offset : 0) + row;
  }

  return {
    open, close, key, activate, move, run, mirror, rowAt, resultIndexOf,
    active: () => !!S.search.open,
  };
}
