# Increment 4 (AC2) — build design

> Written 2026-07-13 by working-Claude before the build. Function + intent
> record per `record-build-intent`. Contract: `contract.json` AC2 (+ AC8
> guardrail). Do not widen scope. Ground truth from two read-only exploration
> passes over `18c6c02` (facts below are code-verified; line refs are
> point-in-time — the symbols are the durable anchors).

## What Increment 4 is (and is not)

A **player-facing search inside the nav computer** (opened with `N` in normal
play — no debug panel) that resolves three classes of thing the player knows
about and travels there:

- **(a) Real star systems** by proper name or designation (`Sirius`,
  `Rigil Kentaurus`, `TRAPPIST-1`) — plus registry names the debug panel can't
  see (`Alpha Centauri`, `Sol`).
- **(b) Named settled/notable catalog systems** via `enumerateNamedSystems`
  (this is where the AC5 "settled-catalog UI ask" folds in, per contract).
- **(c) Deep-sky structures** — `KnownObjectProfiles` (37) + `RealFeatureCatalog`
  Harris globulars (152).

Selecting a result **arms a genuine warp** to the object and travel proceeds.

**Not** in Increment 4: the neighborhood reference table or the structures audit
(AC1/AC6 = Increment 5); the snum single-pin and Alpha-Cen fill policy (both
ride Increment 5); any change to the debug panel (it stays exactly as-is —
we *port* its resolution logic, we don't touch it); any new curated data;
system-tags/save-search revival (its designated future home is this search
surface, but it stays parked — 2026-07-12 ruling).

## The ratified NavComputer seam (record for lane D)

> **Coordinator-ratified by Max 2026-07-13.** AC2's search UI lives inside
> `NavComputer` (canvas-2D, lane-D-owned rendering internals). Lane D is
> unopened, so lane C gets a **scoped** seam. This section is the durable record
> lane D inherits at its scoping — exactly what lane C touched and why.

Lane C touches, in `NavComputer`/its DOM host, ONLY:

1. A **DOM `<input>` search overlay** mounted as a sibling of the nav canvas
   inside `.nav-computer-panel` (`index.html:307`), absolutely positioned over
   the canvas. No change to the `render()` fillText loop.
2. A **`_searchFocused` boolean** consulted as the first line of the
   capture-phase keydown handler `_onKeyDown` (`NavComputer.js:168`), set from
   the input's `focus`/`blur`. This is the keyboard-capture reconciliation.
3. A **result list + selection → warp** wiring: a new entry point that builds a
   nav-star object from a search hit (mirroring `openToCurrentSystem(starData)`,
   `NavComputer.js:199-213`) and arms the warp via the supported main.js path.
4. The **cosmetic 'D' spectral swatch** folded into
   `NavComputer._SPECTRAL_COLORS` (`:2303-2307`) — a lane-D-owned static, added
   here by prior coordination agreement.

Everything else in NavComputer's rendering internals is untouched. If lane D
opens and reworks the render loop, the search overlay (DOM) and the
`_searchFocused` guard (one early-return) are the only integration points to
preserve.

## Code-verified facts the build MUST honor

1. **The keyboard trap is the sharp edge.** `NavComputer`'s capture-phase
   `document` keydown listener (`addEventListener('keydown', this._onKeyDown,
   true)`, registered in `activate()` `NavComputer.js:190`, removed in
   `deactivate()` `:224`; handler defined `:168-179`) `preventDefault`s +
   `stopPropagation`s **W/A/S/D/R/F** (`:169-172`) with **no target/focus guard
   today**. Typing any of those six letters into a search field would pan/zoom
   the map. Fix = `if (this._searchFocused) return;` as `_onKeyDown`'s first
   line. Additionally the *global* main.js keydown binds `N` (`:9616`), `T`
   (`:9622`), `X` (`:9628`), Escape (`:9634`/`:9647`) — a focused DOM `<input>`
   naturally swallows these (that's a reason to prefer DOM over a canvas widget),
   but the build must confirm Escape-while-search-focused clears/closes search
   rather than drilling the nav level (`handleEscape`, `:9647-9651`).

2. **DOM `<input>` overlay, not a canvas widget.** The nav overlay is already a
   DOM tree `#nav-computer-overlay > .nav-computer-panel > canvas#nav-computer-canvas`
   (`index.html:306-310`); a sibling `<input>` is trivially placeable. Precedent
   for JS-built positioned UI: `TargetingReticle` (`position:fixed` canvas,
   `TargetingReticle.js:103-113`), `BodyInfo` (DOM text w/ blinking cursor,
   `BodyInfo.js:51,131,150-158`). There is **no existing `<input>` HUD** in
   `src/` — this is the first. DOM wins because real `focus`/`blur` drive the
   `_searchFocused` flag for free and the browser handles caret/backspace/IME/
   clipboard/repeat (a canvas widget would reimplement all of it *and* fight the
   capture-phase handler for the very WASDRF keys being typed).

3. **Reachable in normal play via `N`.** `main.js:9616-9619`
   (`KeyN && !shift && !title && !warp → toggleNavComputer()`); mobile FAB
   `data-action="nav"` (`:10871-10873`). Neither path involves the debug panel,
   satisfying AC2's "without the debug panel" clause. Lifecycle:
   `toggleNavComputer()` (`:2899`) → `openNavComputer()` (`:2802`, shows overlay,
   `activate()` `:2840`, starts `_navRenderLoop()` `:2841`) → `closeNavComputer()`
   (`:2844`, `deactivate()` `:2854`). `getSelectedStar()` (`:256-266`) is the
   outward contract main.js reads **on close** to arm the warp.

4. **Resolution logic ports from `DebugPanel.doSearch`, not
   `searchKnownObjects`.** `searchKnownObjects(query)`
   (`KnownObjectProfiles.js:1173-1191`) covers ONLY structures (class c). The
   real multi-source resolver is the `doSearch` closure
   (`DebugPanel.js:582-711`): real-star `_stars` `.name` substring scan cap 10
   (`:595-600`), globular `name`/`harrisId` scan (`:604-615`), structures via
   `searchKnownObjects` deduped + wrapped (`:619-634`). **GAP: class (b) — the
   named-systems catalog is searched NOWHERE today** and must be added. **GAP:
   registry names** — the debug panel scans HYG `_stars.name` only, so
   `Alpha Centauri`/`Sol` (KnownSystems registry display names, never HYG
   `star.name`) are invisible; AC2 must also consult `KnownSystems.getAll()`
   names + `_aliasIndex`.

5. **`enumerateNamedSystems(bounds, maxResults=20000)` is bounds-driven and
   O(N).** `NameGenerator.js:487-499`: iterates the whole cached
   `getNamedSystemsMap()` (`namedSystemsCatalog.js:43-55`), decodes
   `positionForKey` per entry, rejects outside `bounds`; returns
   `{position, name, region, key}`. It does **not** name-match — enumerate a
   **player-centered bounds box** (not a galaxy-wide scan) then filter
   `entry.name` by substring. `maxResults` caps output, not iteration.

6. **Structures resolve name → position by direct field read.**
   `KnownObjectProfiles` carry `galacticPos:{x,y,z}` (`KnownObjectProfiles.js`
   entry, e.g. `:1143`); globulars carry `position:{x,y,z}`
   (`RealFeatureCatalog.js:48`, name/harrisId `:54-55`). No index needed.

7. **Arm a genuine WARP — never the debug teleport, never hand-set
   `_warpTarget`.** The debug "GO TO OBJECT" is a **teleport**
   (`teleportToPosition`, `DebugPanel.js:683-684` → `main.js:4993-5081` →
   `spawnSystem({forWarp:false})`), which **bypasses** `onPrepareSystem` and
   carries its OWN duplicate merge block (`main.js:5039-5059`). The supported
   warp entry is `dispatchNavAction({type:'warp', star:{wx,wy,wz,seed,name,
   spectral}})` (`main.js:2884-2894`) → `_setWarpTargetFromNavStar(navStar)`
   (`:2939-2979`, sets `warpTarget.navStarData` + `.name` + `.direction`,
   clears `starIndex`/feature/galaxy) → `beginWarpTurn()` (`:10395-10432`).
   The **trap** is hand-setting `window._warpTarget` fields directly
   (`main.js:2423`): arrival needs a correct `navStarData` (Priority 1,
   `:3515-3518`) or valid `starIndex` (Priority 2), else it logs "No star
   resolved" or resolves the wrong star. Build the navStar and route through
   `_setWarpTargetFromNavStar` + `beginWarpTurn` (mirror the `dispatchNavAction`
   warp branch).

8. **Selection reuses the tail, needs a new head.** Existing star selection is
   gated on `_hoveredLocalStar`/`_localStars` (the lazily-loaded prism set,
   `NavComputer.js:3115,1264`) — a catalog hit outside the loaded prism is not
   in `_localStars`. Reuse the tail (`_systemStar` + `_selectedNavStar` +
   `_externalTarget` as `:3119-3122`, exposed via `getSelectedStar()`), but
   build the star object from the search hit (mirror
   `openToCurrentSystem(starData)` `:199-213`), not from `_hoveredLocalStar`.

## Design decisions

- **D1 — Search resolver is a new pure module, ported from `doSearch`.** Lift
  the three-source merge out of `DebugPanel.doSearch` into a
  reusable resolver (e.g. `src/generation/knownObjectSearch.js` or a NavComputer
  method) that takes `(query, {realStarCatalog, realFeatureCatalog, knownSystems,
  playerPos})` and returns a unified `Array<SearchResult>`. The debug panel is
  NOT refactored to consume it in this increment (avoid touching working code);
  the port is a copy-with-additions. Rationale: AC2 needs the same logic in a
  non-debug surface; a shared pure resolver is unit-testable headless.

- **D2 — Unified `SearchResult` shape → navStar adapter.** Every result class
  maps to `{name, worldPos:{x,y,z}, seed?, type?, kind:'star'|'named'|'structure'}`.
  Sources: star hit → `{x,y,z}` + `spect`; named-system → `position` + `key`
  (seed basis); structure → `galacticPos`/`position`. A single adapter converts
  a `SearchResult` to the `navStar` shape `_setWarpTargetFromNavStar` expects
  (`{worldX,worldY,worldZ,seed,name,type}`). One arming path for all three
  classes.

- **D3 — Class (b) coverage: player-centered bounds.** Query
  `enumerateNamedSystems` with a box around `playerGalacticPos` (start ±[TBD in
  build] kpc — size chosen so a normal-play search returns the systems a player
  would plausibly reach; NOT galaxy-wide, per fact 5's O(N) cost) then substring
  filter `entry.name`. If a query matches nothing nearby, the search simply
  returns no named-system rows (real stars + structures still resolve
  galaxy-wide by their catalogs). Document the bounds choice in the build.

- **D4 — Registry-name bridge.** Also match `query` against
  `KnownSystems.getAll()` names + `_aliasIndex` (`KnownSystems.js:137-178`) so
  `Alpha Centauri`/`Sol` resolve. A registry hit resolves to the registry
  entry's position/primary; travel then arrives at the authored/merged system
  (the AC5 alias path already lands `Rigil Kentaurus` → Alpha Cen — this makes
  the *registry display name itself* searchable, closing the debug-panel gap).

- **D5 — Warp, armed on selection, executed on close.** Selecting a result sets
  `_selectedNavStar` (+ `_systemStar`/`_externalTarget`) via the D2 adapter, so
  the existing `getSelectedStar()`-on-close contract (`main.js` reads it in
  `closeNavComputer`) arms the warp through `_setWarpTargetFromNavStar` +
  `beginWarpTurn`. Reuse the existing close→warp contract rather than firing a
  warp mid-nav; confirm during the build that the close path routes a
  search-selected star identically to a hover-selected one. (If the close
  contract can't carry a catalog-only star cleanly, fall back to an explicit
  `dispatchNavAction({type:'warp', star})` on result-activate — decide in build
  from the code, not here.)

- **D6 — `_searchFocused` guard + Escape semantics.** `_onKeyDown` early-returns
  when `_searchFocused`. On `focus` set true; on `blur` set false; guarantee
  blur fires (DOM input gives it natively). Escape while search-focused =
  clear+blur the search (do NOT also drill the nav level); Escape when search is
  empty/blurred keeps today's `handleEscape` behavior.

- **D7 — 'D' swatch (cosmetic).** Add `D: '#e8f0ff'` to
  `NavComputer._SPECTRAL_COLORS`. Pure lookup; all consumers fall back
  gracefully, so nothing else changes.

## Merged-star nav-warp closure (Gate 4)

A search-driven **warp** to a merged real star (Sirius) routes through the SAME
Increment-3 warp-arrival code — code-verified: `_setWarpTargetFromNavStar` sets
`navStarData` + `name='Sirius'`; at arrival Priority 1 resolves it and sets
`starTypeOverride` (`main.js:3537-3549`); `findByAlias('Sirius', pos)` returns
null (Sirius is neither a registry entry nor within `MATCH_RADIUS` of one) → the
ELSE branch is the flagged "Real-universe overlay merge (AC3/AC4)" block
(`main.js:3591-3614`); Sirius has a companion so `companionSpec` is truthy and
`deriveMergedNames`/`spectFull` fire. **Driving search → warp → Sirius live in
Inc-4 verification closes the owed check** (`verdict-live-drives-c68c1fb.json` →
`notDriven`). This holds ONLY for the warp path — the debug teleport has its own
merge block and does NOT touch `onPrepareSystem`, so a teleport would NOT close
it. This is another reason D5 arms a genuine warp.

## Test plan

**Unit (headless, from repo dir):**
- The ported resolver: `Sirius`/`Rigil Kentaurus`/`TRAPPIST-1` → real-star hits;
  `Alpha Centauri`/`Sol` → registry hits (the debug-panel gap); `M42`/a globular
  name → structure hits; a settled-catalog name within bounds → named-system hit.
- The `SearchResult` → navStar adapter: each of the three kinds produces a
  navStar with correct `worldX/Y/Z` + `name` (+ `seed`/`type` where applicable).
- The `_searchFocused` guard: with the flag true, `_onKeyDown` does not add to
  `_heldKeys` / does not preventDefault (assert on a synthetic W/A/S/D/R/F event).
- `_SPECTRAL_COLORS.D` present.

**Integration (headless + live):**
- Headless: a search-selected star flows through the close→warp contract and
  arms `warpTarget.navStarData` correctly (no hand-set `_warpTarget`).
- **Live (working-Claude, chrome-devtools on `:5176`):** open nav with `N` (not
  the debug panel); type each AC2 query; typing `Sirius` etc. must NOT pan the
  map (the WASDRF-in-query check); select each result; warp; confirm arrival name
  matches the query. Drive **`Sirius` specifically** to close Gate 4. Structures:
  confirm nav/travel points at the structure's true position. Per lane rule,
  close leftover chrome-devtools pages after; leave Max's window at Sol, panel
  closed.

**AC8 guardrail (every increment):** full vitest from the repo dir grows from
**1,321** green (0 new failures); `ProcgenSnapshot` deep-equal (AC2 is UI/search
only — it must not perturb generation); live `enterSol` 19/19 during the live
pass.

## Files (anchors, not line numbers)

- `src/ui/NavComputer.js` — `_onKeyDown` guard, DOM search overlay lifecycle,
  result-list render + hit-test, search-hit → nav-star head, `_SPECTRAL_COLORS.D`.
- `index.html` — the `<input>` overlay markup inside `.nav-computer-panel`
  (+ minimal CSS), if not created imperatively in NavComputer.
- New `src/generation/knownObjectSearch.js` (or equivalent) — the ported
  three-source resolver + named-systems + registry bridge + adapter.
- `src/ui/DebugPanel.js` — **read-only reference** (`doSearch` `:582-711`); NOT
  modified.
- `src/generation/NameGenerator.js` (`enumerateNamedSystems` `:487`),
  `src/generation/KnownSystems.js` (`getAll`/`_aliasIndex` `:137-232`),
  `src/generation/RealFeatureCatalog.js`, `src/data/KnownObjectProfiles.js`,
  `src/generation/RealStarCatalog.js` — resolver inputs (read).
- `src/main.js` — warp-arm (`_setWarpTargetFromNavStar` `:2939`, `beginWarpTurn`
  `:10395`, `dispatchNavAction` `:2884`) and close→warp contract; **at most a
  thin edit** if the close contract needs to carry a catalog-only star (flag any
  main.js line touched for lane B's next merge, per campaign convention).
- New `src/generation/__tests__/knownObjectSearch.test.js` (+ any NavComputer
  guard test) — unit coverage.
