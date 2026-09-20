# nav-restorations-2026-09-20 — SEAM (decided before code; extends `../nav-screens-close-pass/INTERFACE.md`)

Read that INTERFACE and `../nav-menu-elements-functional/INTERFACE.md` first; every rule there still holds.
This file only adds the fields and owners for the eleven restorations. **Later rows override earlier where they differ.**

## 0. Owners (disjoint files — an owner never edits another's file; report instead)

| owner | may edit | its test file |
|---|---|---|
| **LAB** | `nav-240p-lab.html`; `src/ui/navViewModes/designs.js` ONLY via `node scripts/extract-nav-designs.mjs` (then `--check` exits 0) | `src/ui/__tests__/navRestorations<wave>.design.test.js` |
| **DRIVER** | `src/ui/navViewModes/{index,state,picking,search,geometry}.js` | `src/ui/__tests__/navRestorations<wave>.driver.test.js` |
| **HOST** | `src/ui/NavComputer.js` (FOLD onto existing lines, `/* */` only; 4711 lines; poisoned lines 1, 19, 255, 586, 613, 1434, 2029, 4345, 4420, 4442) | `src/ui/__tests__/navRestorations<wave>.host.test.js` |

`src/main.js` is nobody's. Vocabulary: LEGACY = `viewMode null`; DESIGN 1 = `'rail'`; DESIGN 2 = `'bars'`; levels 0-4 = GALAXY SECTOR REGION PRISM SYSTEM; the buffer is 417×240 texels at Max's window.

## 1. Fields — wave 1

| field | published by | shape / default | read by |
|---|---|---|---|
| `S.hover` | DRIVER, at the tail of `render()` right after `resolveHover` (index.js:346/508-532), from the same pick it writes to the host's `_hoveredTile/_hoveredLocalStar/_hoveredBody` | `null` (state.js default) or `{ level, kind, sx, sy, ref }` — `kind` ∈ `'sector' \| 'tile' \| 'star' \| 'body'`; `sx, sy` the pick's texel point; `ref`: sector → the sector row (has `.name`); tile → `{ col, row, kx, kz }` with `kx, kz` the tile CENTRE in kpc (DRIVER derives from `S.mapProj`/`S.view`, the inverse of its own tile pick); star → the `D.stars` row (`name, spectral, dist, distPc, wy, isReal, seed, color`); body → `{ type: 'planet'\|'star'\|'moon'\|'belt', index, planetIndex?, moonIndex?, row }` with `row` the `D.bodies` row. NOT cleared by `resetPicks()` (it outlives the frame like `S.pick`); cleared to `null` by `onDeactivate()` and on a level change. | LAB (AC-1): the NEXT frame's paint draws the callout. Branch on `kind`, never on the shape of `ref`. |
| `S.cam.y`, `S.cam.radius`, `D.player.y` | already mirrored (state.js:394/796) | — | LAB (AC-3 HEIGHT / PLAYER Y / Y RANGE; AC-9 `VIEW <n> LY`, n = `Math.round(S.cam.radius * 3260)`) |
| `D.sys.star.type`, `D.sys.star2?.type`, `D.sys.isBinary`, `D.sys.ageGyr`, `D.bodies` (`kind:'planet'` rows carry `name, au, cls, moons`; belt rows `kind:'belt'`) | already mirrored | — | LAB (AC-7 names; AC-8 belt labels + the star line when `D.selBody == null`) |

## 2. Fields — wave 2

| field | published by | shape / default | read by |
|---|---|---|---|
| `D.ship` | DRIVER, in `refresh()` | `null` unless `D.isCurrent`; else `{ planetIndex: nav._currentFocusIndex, moonIndex: nav._currentMoonIndex }` (`planetIndex < 0` → the ship is at the star) | LAB (AC-5): the diamond + `SHIP` at that body's drawn point; trajectory from it to the hovered body if `S.hover?.kind==='body'` else `D.selBody`; arrowhead. |
| `S.sysCam.zoom` | DRIVER, in `refresh()` from `nav._systemZoom` | `1` | LAB (AC-6): design 2's orrery `projScale *= S.sysCam.zoom`; the zoom gauge mark = position of zoom in [0.3, 5.0] (log scale). Design 1 ignores it. |
| `S.sysView`, `S.detailPlanet` | DRIVER owns every transition | `'system'` / `-1`. ENTER (`S.sysView='planet'`): in `remapClick` at level 4, a genuine click whose pick is the planet that is ALREADY `D.selBody` (`type:'planet'`, same `planetIndex`) and whose row has `moons > 0`. EXIT (back to `'system'`, `detailPlanet=-1`): `drv.onEscape()` returning `true` (HOST folds `if (this.viewMode && this._viewDriverInst?.onEscape?.() === true) return true;` at the head of `handleEscape()` :1441 — right-click reaches it via :4489 — after the search's own Esc, which line 349 already handles); a click on empty map (no body hit) while in the sub-view; any level change; `onDeactivate()`; V. | LAB (AC-4): design 1 `d1Ladder` draws the moon ladder (parent at the head, moons by orbit radius) and `d1Rail` lists the moons; design 2 `d2System` draws the moon orrery (rings + pips + names). |
| moon hits | LAB publishes into `S.bodyHits` at the draw site, same shape as planet hits plus `{ type:'moon', planetIndex, moonIndex }`; design 1's rail rows for moons are already rows — DRIVER resolves a moon ROW click to the moon | — | DRIVER (AC-4): a moon hit or moon row click sets `nav._selectedBody = { type:'moon', planetIndex, moonIndex }` and `nav._commitAction = nav._buildCommitAction()` and `remapClick` returns `null` (eaten — the host's level-4 branch never sees a moon). `D.selBody` then mirrors it; every painter that frames `D.selBody` handles `type:'moon'`. |
| `S.zoomGaugeRect` | LAB (design 2 SYSTEM chrome, draw site) | `null`; `{ x, y, w, h, x0, x1 }` or the y-gauge's own shape rotated — LAB says which; the DRIVER reads exactly that | DRIVER (AC-6): `zoomGrab(x,y)` → boolean; `zoomDragTo(px)` → the new zoom or `null`, mirroring `gaugeGrab/gaugeDragTo`. HOST folds: `_zoomDrag=false` default beside `_gaugeDrag` (:156); on :4405 `\|\| (this.viewMode==='bars' && drv.zoomGrab?.(p.x,p.y))` into its own flag; on :4355 `if (this._zoomDrag) { const z = drv.zoomDragTo?.(p.x); if (z != null) this._systemZoom = z; return; }`; on :4415 `this._zoomDrag = false`. |
| `S.yGaugeRect` (design 2 PRISM) | LAB, the corner widget redrawn as a gauge, published with the SAME shape design 1 publishes | as design 1's | nothing new: `gaugeGrab/gaugeDragTo` and the host's :4402 routing already accept any design. |

## 3. Painting rules (LAB)

- A callout is a PLATE: `plated()` so its box is knocked out of the map; clamped INSIDE the map pane; never over the rail, status line, tabs, commit row or hint. Strings through `fit()`. The mark guard (`assertFits`) is silent across both designs × five levels × the sub-view.
- Names on marks/stops/pips: selected > current > by distance/AU; a name that would overlap yields (letter tag stays, or the label is dropped); no two labels overlap.
- New lines (drop lines, grid, trajectory) are primitives under the marks, clipped to the pane. New inks are added to the INK table, not literals.
- Frame hashes (the fill+text stream) at every level an AC does NOT touch are byte-identical before/after — LAB proves it in its test file.
- Nothing in the lab's design 3 block is touched; keep `projectPrism` compiling.

## 4. Tests (every owner)

Drive the real input — `hoverAt` / `clickAt` from `helpers/headlessNav.mjs`, `nav._onKeyDown(new KeyboardEvent(...))` on document, `nav._handleWheel({ deltaY, preventDefault(){} })`, `_handleMouseDown/Move/Up` for a drag; read the recorded fill/text stream (the `inkRecordingContext` + `drawPixelText` wrapper pattern in `navDefects2026.design.test.js:75-116`); assert an ABSOLUTE fact (a string present, a rect's texel coordinates, a field's value); show the test RED against a named mutant. `at()` stands the pilot ON the system star (navDefects2026.design.test.js:128-150) so `D.isCurrent` is true; for a foreign system leave the player elsewhere.

Vitest ALWAYS: `npx vitest run <file> --root /home/ax/projects/well-dipper --exclude '**/.claude/**' --exclude '**/node_modules/**'`; never two runs at once; `src/ui` whole ≈ 5 min (timeout 600000).
