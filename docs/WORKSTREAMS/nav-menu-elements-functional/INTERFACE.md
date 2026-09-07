# The interface contract — three owners, disjoint files, one agreed seam

⛔ **This file is the coordination point.** Three pieces of work run in parallel and they must not
touch each other's files. Everything they say to each other is written down here first.

| owner | files it may edit | files it must NOT edit |
|---|---|---|
| **LAB** | `nav-240p-lab.html`, and `src/ui/navViewModes/designs.js` ONLY by running `node scripts/extract-nav-designs.mjs` | anything else |
| **KEYS** | `src/ui/NavComputer.js`, `src/ui/__tests__/navKeys.test.js` | the lab, designs.js, index.js, state.js |
| **DRIVER** | `src/ui/navViewModes/index.js`, `src/ui/navViewModes/state.js`, `src/ui/navViewModes/geometry.js`, `src/ui/__tests__/navPicking.test.js` | the lab, designs.js, NavComputer.js |

---

## 1. WHAT THE PAINT PUBLISHES ONTO `S`  (LAB writes, DRIVER reads)

⭐ The rule these all obey: **hit-test geometry comes OUT of the paint.** The established precedent is
`d1Ladder`, which already writes `S.ladderStops` / `ladderMax` / `ladderCaps` / `ladderVisible`.
Restating a layout in a hit-test is the AC-4 defect shape — two copies of one geometry, one silently
wrong.

⛔ Every one of these is a **pure write to `S` placed after every draw call whose values it reads**.
Not one changes a pixel. Max ruled on these pictures.

⚠ **SUPERSEDED IN ONE PLACE — `S.mapProj` IS NOT ONE UNIFORM SHAPE.** This block proposed a single
`x0/y0/w/h/spanX/spanZ` rectangle for every 2D map. It was wrong, and §1d below is why: the three
maps are three genuinely different projections, and flattening them would have put a second,
lossy copy of each one here. What shipped carries a `kind` discriminator and each site's own
fields; `picking.js` branches on `kind` in exactly one place and everything above it is
kind-agnostic. Left in place rather than rewritten, because the reasoning that follows it is what
the shipped code answers to.

```js
/** The 2D map's projection — levels 0,1,2. Written by d1TwoD and d2TwoD. `null` otherwise. */
S.mapProj = {
  design, level,                          // stamps, so a stale read can be rejected
  kind: 'square' | 'wide' | 'block',      // ⛔ see §1d — three maps, three projections
  /* 'square' */ ox, oy, sq, n, cell, cx, cz, size,
  /* 'wide'   */ ox, oy, kpc, cx, cz, clip,
  /* 'block'  */ bx, by, blk, n, cell, cx, cz, size,
};
/* inverse:  wx = cx + ((x - x0)/w - 0.5)*spanX      wz = cz + ((y - y0)/h - 0.5)*spanZ
   grid:     i  = floor((x - x0) / (w/n))            j  = floor((y - y0) / (h/n))         */

/** Every star mark on the prism, in DRAW ORDER. Written by d1Prism and d2Prism at level 3. */
S.prismHits = [ { x, y, r, ref } ];   // ref = the D.starRows row; r = hit tolerance in texels

/** Every body mark at SYSTEM. Written by d1Ladder (design 1) and d2System (design 2). */
S.bodyHits  = [ { x, y, r, ref, moon, star } ];
// ref  = the D.bodies row, or null for the system star
// moon = -1 for the body itself, otherwise the moon's index within that body
// star = true only for the system star glyph

/** The ranked tiles the rail's rows are made of at levels 1-2, index-aligned with the drawn rows. */
S.railTiles = [ { i, j, id, x, z, n } ];   // d1TileRows rows, already sliced to the drawn count
```

### ⛔ Three traps the DRIVER must handle, all found by measurement

1. **`row` IS Z-FLIPPED.** The lab's `j` counts +z DOWNWARD; `NavComputer._handleClick` (:4656)
   counts +z UPWARD (`newCz = viewCenter.z + ext - (row+0.5)*tileSize`). The conversion is
   **`row = n - 1 - j`**, `col = i`. Handing raw `j` through drills into the mirrored tile.
2. **`_viewCenter`/`_viewSize` ARE NOT `levelView()`.** The designs are anchored to the PLAYER
   (`levelView`, lab :480-484); the game's frame follows the drill stack and diverges after any
   sector drill, tile drill or drag-pan. The DRIVER resolves this by making the mode's view THE view
   — writing `nav._viewCenter` / `nav._viewSize` from `S.mapProj` before it writes `_hoveredTile` —
   so that what Max sees and what he drills into are the same rectangle. The legacy 2D frame is
   fully overpainted by the design's opaque background fill, so nothing visible moves.
3. **`_renderSectorOverlay` (:1851) OVERWRITES `_hoveredTile` EVERY FRAME AT LEVEL 0**, from
   `_mouseX`/`_mouseY` against the LEGACY projection, with no `else` clause — so it clobbers only
   when the cursor happens to fall in a legacy sector rect. Stochastic, and it already affects the
   shipped rail picker. It must stand down under a view mode.

### The shapes `_handleClick` actually reads — measured, not assumed
| level | field | shape | discriminator |
|---|---|---|---|
| 0 | `_hoveredTile` | `{ sector }` — needs `centerX`, `centerZ`, `size`, `name`, `id` | `.sector` |
| 1,2 | `_hoveredTile` | `{ col, row }`, both in `[0, gn)` | `.col !== undefined` |
| 3 | `_hoveredLocalStar` | `{ star, sx, sy }` — `star` must be the live `nav._localStars` entry, matched **by seed** | — |
| 4 | `_hoveredBody` | `{ type: 'planet'\|'moon'\|'star', index }` | — |

⚠ Level 0's map draws an 8x8 GALAXY grid, not sectors — sectors are density-adaptive and there are
775. So the level-0 identity is `D.sectors.getSectorAt({ x: wx, z: wz })`, the same call the adapter
already makes for `D.playerSector`. It returns `null` outside the disc; do not write on `null`.

---

## 1b. ⛔⛔ WHERE THE PICKER LIVES — MEASURED, AND IT OVERTURNS A "VERIFIED" ROW

**The legacy painters rewrite all three hover fields every frame, and they run FIRST.**
`render()` paints legacy, then the mode paints over it (deliberately — the legacy painters are also
the lazy loaders). But `_renderLocal` nulls `_hoveredLocalStar` at :2037 and re-derives it from
`_mouseX`/`_mouseY` against the LEGACY projection at :2164-2167 (hitDist 12); `_renderSystem` does
the same for `_hoveredBody` at :2751/:2836; `_renderSectorOverlay` writes `_hoveredTile` at :1851.

Measured live on the running game, design 1 at PRISM, hovering rail row 2:

| step | `_hoveredLocalStar.star.name` |
|---|---|
| after the driver's `hover()` | `XND J3DK8MQE-RLZ16U6` — correct, it is `D.starRows[2]` |
| **after one `render()`** | `XND J3DJFN6W+A2AFBIA` — **a different star** |

⛔ So **the shipped list picker acts on the wrong star in the running game**, and the suite cannot
see it: `navViewModes.test.js:260-280` renders BEFORE the mousemove and never renders between the
mousemove and the click. Same shape as the dead `V` key — a green test whose sample contains no input
that could fail it.

⭐ **THEREFORE HOVER RESOLVES AT THE TAIL OF THE DRIVER'S `render()`, NOT IN `_handleMouseMove`.**
After the design has painted and published its candidates, the driver re-resolves from
`nav._mouseX` / `nav._mouseY`. That wins by construction — it is the last writer every frame — it
always reads THIS frame's candidates, and it needs no gating edits scattered through a line-frozen
file. `_handleMouseMove` keeps recording the pointer and nothing else.
⛔ **DO NOT EDIT `NavComputer.js:4345`** to remove its `hover()` call — that line ends in a `//`
comment and is a poisoned fold target. Leaving it is harmless: it writes the same fields from the
same candidates, and the render tail re-resolves anyway.

---

## 1c. ⭐ THE DESIGNS ARE PLAYER-ANCHORED AND THE DRILL DOES NOT MOVE THEM

`levelView` (lab :480-484) returns the PLAYER's sector and a PLAYER-centred region, always. The
game's frame is `_viewCenter`/`_viewSize` off the drill stack. So today, clicking a sector at GALAXY
drills the game into that sector while both designs keep drawing the player's — the picture does not
follow the pilot, which is "CLICK A SECTOR" being false in the way that matters.

**The fix is the same shape as the camera fix: feed the design the game's real view instead of a
self-supplied one.**
```js
S.view = { cx, cz, size };   // the 2D frame; DRIVER writes it from nav._viewCenter / _viewSize
```
`levelView` reads `S.view` at levels 1-2 (level 0 stays the whole 44 kpc disc). The LAB defaults
`S.view` to the player-anchored values it computes today, so the lab's picture is unchanged.

⭐ **AND THE GAME'S PICTURE DOES NOT MOVE AT ENTRY EITHER — verified against the code, not assumed.**
`_setupViewStackForPlayer` (:1200-1225) builds `[1] = { center: currentSector.centerX/Z, size:
currentSector.size }` and `[2] = { center: player, size: _computeTileSize(playerX, playerZ, 10000) *
16 }` — which is exactly what `levelView(1)` and `levelView(2)` compute today. Identical at entry,
live thereafter. Same property the camera has.

With `S.view` in place the tile conversion is exact and needs no forcing and no refusal:
**`col = i`, `row = n - 1 - j`.**

---

## 1d. THE THREE MAP PROJECTIONS ARE GENUINELY DIFFERENT — publish a `kind`, do not unify

| site | kind | shape |
|---|---|---|
| `d1TwoD` (design 1, levels 0-2) | `'square'` | a centred square inset: `ox`, `oy`, `sq`, grid `n`, world `cx/cz/size`. Isotropic. ⚠ The map REGION is 258 wide but the square is 216 at `ox=21` — columns outside it are inside the region and outside the picture. **Reject, never clamp.** |
| `d2TwoD` level 0 | `'wide'` | the square rendered at the WIDE extent and cropped to the middle band: `ox = W/2`, `oy = mapY + mapH/2`, `kpc = v.size / W`. Isotropic, so the vertical field is only ±`(mapH/2)·kpc` — about half the disc is off the glass by construction. |
| `d2TwoD` levels 1-2 | `'block'` | a centred `blk = mapH` square: `bx`, `by`, `blk`, `n`, `cell`. ⛔ **NOT `toX`/`toY`** — those are the wide projection this branch never calls. The block is `blk` texels for `v.size` kpc while the density behind it is `W` texels for the same `v.size`, so a picker built on `toX` drills a tile roughly twice the size it clicked. |

---

## 1e. LEVEL 4 — TWO RULINGS THAT COME OUT OF THE DOWNSTREAM CODE

- **A moon pip maps to its PARENT PLANET, not to `{type:'moon'}`.** `_handleClick` consumes a moon
  pick only when `_systemMode === 'planet'` (:4512-4520); in `'system'` mode — the mode the orrery is
  drawn in — a moon hover falls through to `_clearCommitSelection()` (:4594). So publishing moon pips
  as moons makes clicking one CLEAR the selection. Mapping to the parent drills into planet detail,
  where the moons become individually pickable by the same mechanism. That is a walk; the other is a
  dead click.
- **A belt has no downstream identity** in either build. Publish it as a candidate so the picker
  knows what it is, and return "no pick" for it rather than leaving a stale `_hoveredBody`.
- ⛔ **NEVER use the draw loop's index as the downstream index — use `ref.pIdx`.** `state.js:134`
  skips a planet with no `planetData`, after which the filtered index and `_systemData.planets`'
  index diverge; sorting `D.bodies` (AC-8) breaks the correspondence outright.

## 1f. TWO DEFECTS FOUND IN PASSING, BOTH IN SCOPE BECAUSE THE PICKER TRIPS ON THEM

1. **`state.js:237` indexes a flat array with a planet index.**
   `D.selBody = (pick.type === 'planet' && D.bodies[pick.index]) ? D.bodies[pick.index] : …` —
   `pick.index` indexes `_systemData.planets`, `D.bodies` is the FLAT list with moons interleaved and
   belts appended. Correct lookup: `D.bodies.find((b) => b.kind === 'planet' && b.pIdx === pick.index)`.
   This is the round trip of the orrery picker: click planet 2, and next frame the selection frame is
   drawn on planet 0's first moon.
2. **`_handleWheel`'s lower clamp is ABOVE the entry value.** `_localRadius = Math.max(0.002, …)`
   (:4705) against an entry value of `0.0015` (:1189, :4680). Once the camera is wired, the FIRST
   wheel event in either direction snaps the zoom out by 33%. Fix the clamp to `0.0015`.

---

## 2. THE CAMERA  (LAB + DRIVER, agreed shape)

⛔ MEASURED WITH A LIVENESS CONTROL: rotating, zooming and panning the legacy camera leaves the
designs' prism BYTE-IDENTICAL, while moving the ship changes it. `projectPrism` anchors to
`D.player` and scales by `ZOOM_STOPS[S.zoomIdx|0]`, and nothing writes `S.zoomIdx`.

```js
S.cam = { x, y, z, radius };   // the prism's anchor and half-extent, in kpc
```
- **LAB**: adds `cam` to its own `S` literal (the extractor strips that literal, so this is free),
  defaults it to the player position and `ZOOM_STOPS[0]`, and binds its own keys to it so the lab
  stays a living spec rather than a frozen artifact. `projectPrism` takes `S.cam.x/y/z` in place of
  `D.player.*` and `S.cam.radius` in place of the `radius` argument's ZOOM_STOPS source.
- **DRIVER**: `refresh()` writes `S.cam` from `nav._localCenter` and `nav._localRadius`.

⭐ **THE DEFAULT PICTURE DOES NOT MOVE.** On entering PRISM the game sets `_localCenter` to the
player position and `_localRadius` to `0.0015`, which IS `ZOOM_STOPS[0]` — so the frame Max ruled on
is reproduced byte-for-byte at the camera's own entry state.

⛔ **ROTATION IS NOT WIRED, DELIBERATELY.** Neither prism hint advertises it, and replacing the
designs' fixed shallow tilt (`rx = 0.92, tilt = 0.42`) with the legacy's full 3D rotation would
change the picture Max ruled on. Design 1's SYSTEM hint wrongly says `DRAG TO ROTATE` over a LADDER;
that string is corrected in the lab, not honoured.

---

## 3. THE KEYS  (KEYS calls, DRIVER implements)

⛔ **EVERY CLAUSE FOLDS ONTO `NavComputer.js:349`, AFTER THE CLOSING `*/`.** That file keeps its line
count fixed at 4711 because ~700 line-anchored citations ride it. **A `//` comment folded mid-line
comments out every statement after it** — that is exactly how the `V` key shipped as dead code.
⚠ Four otherwise-natural anchors (586, 4345, 4420, 4442) already end in `//` and are poisoned.

Every clause matches the existing shape exactly: gated on `this._viewModesEnabled`, self-contained,
`e.preventDefault(); e.stopPropagation(); return;`.

| key | driver call | why `stopPropagation()` is load-bearing |
|---|---|---|
| `Tab` / `Shift+Tab` | `drv.tabLevel(shift ? -1 : 1)` | `Tab` is bound globally in `main.js:14016` and `:14056` |
| `Enter` | `drv.commit()` | free, but consistency |
| `[` / `]` | `drv.cycleSort(dir)` | `BracketLeft`/`BracketRight` are bound globally (`main.js:13497`, `:13510`) — without it, `[` also cycles the star-glow gradient and pops a toast over the map |
| `-` / `=` | `drv.page(dir)` | free |
| `/` | `drv.searchOpen()` | free, but Firefox opens quick-find on `/` |
| any key while `drv.searchActive()` | `drv.searchKey(e)` | the drawn field consumes the keyboard first |

### Driver methods KEYS may call — the agreed signatures
```js
drv.tabLevel(dir)      // ±1. Returns void. Synthesises the click through the DESIGN's own tab strip.
drv.commit()           // fires the same _onCommit the [WARP]/[BURN] button fires. No-op if unarmed.
drv.cycleSort(dir)     // ±1 through the active level's sort keys.
drv.page(dir)          // ±1 page of the ranked list, clamped at both ends.
drv.searchOpen()       // opens the DRAWN search.
/* ⛔ CORRECTED: it must NOT set `nav._searchFocused`. `_onKeyDown` opens with
   `if (this._searchFocused) return;` and every view-mode clause — the searchKey routing included —
   is folded onto that same line AFTER it, so setting the flag makes the drawn field unreachable the
   instant it opens, Escape included. WASD is kept out of `_heldKeys` by `searchKey` consuming the
   pan letters instead, which is the same outcome by a route that works. */
drv.searchActive()     // boolean.
drv.searchKey(e)       // one keystroke into the drawn field. Returns true if it consumed the key.
```

⛔ **`tabLevel` MUST GO THROUGH `_handleClick`, NOT SET `_levelIndex`.** The tab-strip branch
(:4440-4485) is inline and carries the drill animation, the `_viewStack` push, `_onDrillSound`, the
level-4 auto-select-nearest-star and the `_localStars` reset. Setting the index directly reimplements
none of that and looks like it works.
⛔ AND THE SYNTHESISED POINT MUST BE IN THE **DESIGN'S** STRIP, not the legacy one: `remapClick`
resets `_modeTabIdx = -1` on entry and only sets it inside the design's own strip, so a legacy-strip
point is silently eaten. Take the coordinates from `drv.geo(w, h)`.

⛔ **SET-AND-COMMIT MUST BE SYNCHRONOUS.** `_hoveredTile` / `_hoveredLocalStar` / `_hoveredBody` are
wiped by the legacy painters EVERY frame — they still run under a view mode. No `requestAnimationFrame`,
no `setTimeout`, no "set the cursor now, commit on a later Enter". A persistent keyboard cursor needs
its own field.

### ⚠ ENTER has two different mechanisms and only one of them exists today
- **Level 4:** `_commitAction` is the armed test; fire `_onCommit(this._commitAction)` exactly as
  `_handleClick`:4503-4510 does, including the `_onSound(isCurrent ? 'warpLockOn' : 'warpTarget')`.
- **Levels 0-3:** `_selectedBody` is never written outside level-4 paths, so `_commitAction` is
  permanently `null` and there is no commit path at all — yet both designs draw a `WARP TO … ENTER`
  row at every level. The mechanism to reuse is `_selectSearchResult`'s tail (:866-876), which arms a
  warp from a star object with no `_selectedBody`. Source the star from `_selectedNavStar`, falling
  back to `_externalTarget`.
  ⛔ Never hand-set `window._warpTarget`; never use the debug teleport.

---

## 4. SORT AND PAGE  (DRIVER owns the state, LAB owns the labels)

```js
S.sortIdx    = 0;   // index into the ACTIVE LEVEL's sort-key list
S.listOffset = 0;   // first row of the ranked list that is drawn
S.sortLabel  = '';  // DRIVER writes; LAB draws it. Max never uses a console — the key must be visible.
```

⛔ **THE TWO CONTROLS CANNOT BOTH BE SPELLED `[ ]`.** The hint row says `[ ] SORT` and the pager says
`[ ] PAGE`; one of them has to name different keys. SORT keeps `[` `]` because its hint is the one
repeated at every level. PAGE takes `-` `=` and the pager label is corrected in the lab to say so.

⚠ **The sort must re-order the array the PAINT reads** (`D.sectorRows` / `D.starRows` / `D.bodies`),
not a private copy — otherwise rail row N and map glyph N become different objects.
⚠ **Three caches will defeat a naive sort.** `state.js` caches `sectorRows` **forever** (galaxy-only),
`starRows` on `(array identity, length)`, and `bodies` on the system object's identity. The sort key
must be part of every one of those keys, or nothing re-sorts.
⚠ **`buildBodies` does NOT sort**, despite its "AU-ordered" comment: belts are appended last, so a
belt at 3 AU lands after a planet at 30 AU. Do not assume AU order is the baseline.

---

## 5. WHAT MUST STAY TRUE, FOR ALL THREE OWNERS

- `node scripts/extract-nav-designs.mjs --check` exits 0.
- `wc -l src/ui/NavComputer.js` == **4711**. `wc -l src/main.js` == **15161**.
- The three suites: `tests/` 20 failed / the same 8 files; `src/cockpit` 698; `src/ui` 339 + new.
- `viewMode === null` is today's nav, byte for byte.
- The cockpit panel cannot acquire a mode — the gate is `activate()`, never `_bare`.
- Every new key is covered by a test that goes **through `nav._onKeyDown`**, not through a driver
  method. All 28 view-mode tests passed while the `V` key was dead code, because not one drove the
  keyboard. The idiom is `navViewModes.test.js:422`:
  `const press = (nav, code) => nav._onKeyDown({ code, preventDefault() {}, stopPropagation() {} });`
- A painter throw freezes the glass: `PanelHost` catches it ONCE, then stops uploading, and the
  screen keeps showing the last good frame and looks alive. Every new field the designs read needs a
  default in `state.js`.
