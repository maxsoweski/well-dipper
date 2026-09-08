# The interface contract — three owners, disjoint files, one agreed seam

⛔ **This file is the coordination point, and it is decided BEFORE anyone writes code.** Read
`../nav-menu-elements-functional/INTERFACE.md` first — it is still accurate and this one only adds.

| owner | files it may edit | files it must NOT edit |
|---|---|---|
| **LAB** | `nav-240p-lab.html`, and `src/ui/navViewModes/designs.js` ONLY by running `node scripts/extract-nav-designs.mjs` | anything else |
| **HOST** | `src/ui/NavComputer.js`, `src/ui/__tests__/navKeys.test.js` | the lab, designs.js, index.js, state.js, picking.js |
| **DRIVER** | `src/ui/navViewModes/{index,state,picking,geometry}.js`, `src/ui/__tests__/navPicking.test.js`, `src/ui/__tests__/navViewModes.test.js` | the lab, designs.js, NavComputer.js |

---

## 1. THE ROTATION SEAM — the field names, fixed here so nobody guesses

```js
S.cam    = { x, y, z, radius, rotX, rotY };   // PRISM. DRIVER writes; LAB's projectPrism reads.
S.sysCam = { rotX, rotY };                    // SYSTEM. DRIVER writes; LAB's d2System reads.
```

⛔ **TWO PAIRS, NOT ONE.** The game keeps `_localRot*` and `_systemRot*` distinct and clamps them
differently (`[0, π/2]` at level 3, `[0.1, π/2]` at level 4). Folding them into one field would make
a prism drag turn the orrery.

### ⭐⭐ THE DEFAULTS, AND WHY THIS IS THE WHOLE RISK

The designs' fixed gains are **not** a rotation matrix. `projectPrism` scales `dx` by `0.92`, `dz` by
`0.42` and `dy` by `0.55`, and `hypot(0.42, 0.55) = 0.6920260110718384 ≠ 1`. So today's picture
factors as *elevation-only rotation × an anisotropic scale*:

```
K     = Math.hypot(0.42, 0.55)  = 0.6920260110718384
rotX₀ = Math.atan2(0.42, 0.55)  = 0.6521714117570698 rad  (37.3667°)     rotY₀ = 0
```

⚠ **AND THIS ROUND TRIP IS NOT BIT-IDENTICAL** — `K*sin(rotX₀)` is `0.42000000000000004`, `K*cos(rotX₀)`
is `0.5500000000000002`, each ~1-2 ULP off. Every consumer passes through `Math.round`, so **no texel
moves**; but the raw floats also feed the bounds culls and go unrounded into `S.prismHits`, where
`nearestHit` measures distance. ⛔ **THEREFORE: keep `0.42` and `0.55` as the two named default
constants and derive the angle from them, never the other way round.** A texel flip would need a value
sitting exactly on `.5`, which is measure-zero — but the AC says byte-identical, so do not gamble.

`d2System` is the easy one: `TILT = 0.42` is a true `sin`, `Math.sin(Math.asin(0.42)) === 0.42` is
**exactly true**, so `rotX₀ = Math.asin(0.42) = 0.43344532006988595`, `rotY₀ = 0`, bit-identical.

### ⛔ THE GAME'S LIVE VALUES DO NOT MATCH THE DESIGNS' DEFAULTS, AND A NAIVE PIPE MOVES THE PICTURE

```
NavComputer.js:159-160   _localRotX  = 0.5    _localRotY  = 0.3
NavComputer.js:188-189   _systemRotX = 0.5    _systemRotY = 0.0
```

Against `0.6522 / 0` and `0.4334 / 0`. **Worse**, the REGION→PRISM drill *animates* the tilt
(`:4685-4686`: `_localRotX = π/2` then a 600 ms `_tiltAnim` to `0.5`), so a naive pipe makes the prism
**arrive top-down and settle** — a loud change to a static entry frame Max ruled on.

⭐ **THE AGREED ANSWER, AND IT IS THE CONVERGENT ONE, NOT AN OFFSET HACK: HOST RE-SEEDS THE GAME'S OWN
CAMERA TO THE DESIGN'S DEFAULT WHEN A VIEW MODE IS ACTIVE.** The game's camera stays the single source
of truth — the same property that made `S.cam` safe to wire last session — and the design's picture is
reproduced because the camera is *put where the design was drawing*. Concretely, under `this.viewMode`:
`_localRotX = 0.6521714117570698`, `_localRotY = 0`, `_systemRotX = Math.asin(0.42)`, `_systemRotY = 0`,
and the `_tiltAnim` at `:4686` retargets its `to:` to the same prism value.
⛔ With `viewMode === null` **nothing changes** — today's nav keeps `0.5 / 0.3` and its 600 ms settle.

⚠ **`_localRotY` IS UNCLAMPED AND UNWRAPPED** and grows without bound across drags. DRIVER wraps it
into `[0, 2π)` when writing `S.cam.rotY`; HOST leaves the raw field alone so legacy is untouched.

### ⛔ FIVE THINGS ROTATION BREAKS, ALL IN THE LAB, ALL LAB'S TO FIX

1. **`d2System:1395`'s second hard-coded `0.42`** — `maxR = Math.min(W/2 - 8, mapH/2/0.42 - 4)`. Inert
   today (the width term wins, `205.5 < 262.7`). At `rotX = π/2` the minor axis becomes `r` itself =
   **205.5 texels against a half-pane of 112 — a 93.5-texel overflow per side**, straight through the
   topbar and off the canvas. Must become `mapH/2/Math.max(Math.sin(rotX), ε) - 4`.
2. **`rect`, `sprite` and `dottedEllipse` are UNGUARDED** — `assertFits` is reached only through `T()`
   and therefore `plated()`. So the overflow in (1) paints silently over the chrome instead of firing
   the lab's own violation counter. Rotation needs its own bound assertion.
3. **`dottedEllipse`'s sample count comes off `rx`, not the tilt** — as `rotX → 0.1` the ring flattens
   and the dots bunch at its left and right ends, so it reads as two dashes. That is precisely the
   "1-texel stroke straddling its own coordinate" failure the file exists to avoid, and it appears
   ONLY under rotation.
4. **No depth sort anywhere.** `projectPrism` publishes `depth` and nobody reads it; `d2System` draws
   in `D.bodies` order. With `rotY` free, far-side bodies draw over near ones at random. Invisible
   today only because `rotY` is pinned at 0.
5. **⛔ `projectPrism` IS SHARED BY FOUR PAINTERS, ONE OF THEM DESIGN 3** (`d1Prism:758`, `d1Prism`'s
   index tags `:780`, `d2Prism:1261`, `d2List:1308`, `d3Prism:1545`). Design 3 is dead
   (`index.js:58-61`, "all three judges killed it") but it still lives in the lab and still has to
   render. Keep it compiling; do not spend a pass making it pretty.

⚠ Three marks in `d2System` are **screen-space badges and must stay that way**: the ring bars
(`:1411`), the moon pips (`:1416`) and the habitability cross (`:1412`). Selection frames stay
axis-aligned too. That is the low-fi idiom, not a defect.
⚠ `d2System:1423`'s ship diamond is a bare `cxp + 8` offset with **no world position at all** — under
rotation it is the one mark that will visibly refuse to move. Log it; do not invent a position.

---

## 2. ⭐⭐ THE ORRERY'S ANGLES ARE A LIST INDEX, AND THAT IS A LIVE DEFECT TODAY

`d2System:1406`: `const a = (i * 1.7 + 0.6);` — `i` is the **draw-loop index**, not an angle. And
`state.js:401` re-sorts `D.bodies` on `[` / `]` (AU / NAME / TEMP). ⛔ **So pressing the sort key at
SYSTEM today teleports every planet around its ring.** This is independent of rotation and is a bug
whether or not rotation ships.

⭐ **THE REAL ANGLE EXISTS AND IS SIMPLY DROPPED.** `StarSystemGenerator.js:550` draws
`const orbitAngle = planetRng.range(0, Math.PI * 2)` and puts it on the planet wrapper at `:609`;
`SolarSystemData.js:723/846` does the same deterministic thing for Sol; the LEGACY orrery reads it
(`NavComputer.js:2853`, `const angle = p.orbitAngle || 0`). `buildBodies` (`state.js:265`) just never
copies it across.

**AGREED: DRIVER adds `ang: Number(p.orbitAngle) || 0` to every planet row, LAB reads `b.ang` in place
of `i * 1.7 + 0.6`, and LAB's own `buildSystem` gains the same field so the lab stays a spec.**
This fixes the sort-teleport, makes rotation mean something, and converges the designs onto the same
number the legacy orrery already draws. ⚠ **IT ALSO MOVES EVERY PLANET IN DESIGN 2's ORRERY**, which
is a change to a picture Max ruled on — so it goes to him as a rendered A/B, not as a silent fix.
Belts keep no angle; they are full rings and that is correct.

---

## 3. THE SECOND-SELECTION FIX — pin `_systemMode`, do not patch the branch

⛔ **`_systemMode = 'planet'` HAS NO PICTURE IN EITHER DESIGN.** Legacy `_renderPlanetDetail`
(`:3256-3275`) draws `planets[this._selectedPlanetIdx]` and its moons — **one planet**. The designs
draw all 15 bodies and publish all 15 as pickable, measured, in both modes. So `_handleClick`'s
`'planet'` branch (`:4512-4522`) writing `{ planetIndex: this._selectedPlanetIdx }` was *correct for
legacy* — there, the hovered planet always WAS the selected one — and is wrong the moment the picture
keeps every body on the glass.

**AGREED FIX (HOST): under `this.viewMode`, never enter `_systemMode = 'planet'`.** The two write
sites are `:4585` and `:4590`. Every click then lands in the `'system'` branch, which already reads
`this._hoveredBody.index` and is already right.
⛔ **DO NOT instead "fix" the `'planet'` branch to read `_hoveredBody.index`** — that would change
LEGACY planet-detail, where the field means the one drawn planet, and legacy must stay byte-identical.
⚠ A drill that produces no visible change is itself the "glass makes a promise nothing keeps" defect;
pinning the mode removes the promise rather than faking the picture.

**Moons follow (DRIVER):** with the mode pinned, `picking.js`'s existing moon-pip→parent mapping still
selects the parent, which is honest and works. Making a moon pip select the *moon* is AC-2 work and
needs the `'system'` branch to accept `{ type: 'moon', planetIndex, moonIndex }`; scope it separately
and do not smuggle it into this fix.

---

## 4. THE LADDER DRAG — and the gesture is NOT contended

⭐⭐ **MEASURED CORRECTION TO THE HANDOFF'S FRAMING.** The handoff said one gesture has two wanted
meanings and they must be arbitrated. In fact **the drag is already visually inert under BOTH designs
at BOTH levels 3 and 4** — the legacy renderer that reads `_localRot*`/`_systemRot*` is completely
overpainted by each design's opaque `rect(0,0,W,H,INK.BG)`. So there is nothing to arbitrate *away
from*; there is one gesture with no current visible meaning and two levels that each want one:

| level | design 1 (`rail`) | design 2 (`bars`) |
|---|---|---|
| 3 PRISM | rotate the prism (`_localRot*`) | rotate the prism (`_localRot*`) |
| 4 SYSTEM | **pan the ladder** (`S.ladderScroll`) | rotate the orrery (`_systemRot*`) |

Branch on `this.viewMode` (`'rail'` = design 1, `'bars'` = design 2) — a plain instance field, already
read this way at `:4345` and `:4420`.

⭐ **`ladderScroll` IS A CONTINUOUS TEXEL OFFSET, NOT AN INDEX** — `d1Ladder:839`'s
`sx(v) = x0 + 4 + v - scroll` subtracts it raw, and the paint only clamps and rounds it (`:831`).
The handoff's "a drag must land on a stop" is about not *recomputing the layout* in the control (that
is the AC-4 defect shape); it is not a constraint on the value. And a continuous offset **cannot**
produce an empty window: minimum neighbour separation is 8 texels (`:828`) against a `winW` of
150-200+. ⛔ So drag continuously and do NOT snap. `scrollLadder` keeps snapping for `,` / `.`.

⭐ **`_handleClick`'s `dx*dx + dy*dy > 25` drag-rejection (`:4496`) already works for a ladder pan
unchanged** — `_handleMouseUp` (`:4413-4416`) never resets `_dragStartX/Y`, so the test still sees the
drag's start point. A pan >5 px bails before body-picking; jitter still resolves as a click. A ladder
drag needs only its own start snapshot, mirroring `_panStartCenter` at `:4409`.

### ⛔ FOLD TARGETS, RE-SURVEYED — AND ONE MORE POISONED LINE THAN THE HANDOFF KNEW

**Clean (no trailing `//`):** `4348`, `4349`, `4355`, `4361`, `4373`, and the WHOLE of
`_handleMouseDown`/`_handleMouseUp` (`4396`-`4416`).
**Poisoned:** `586`, `4345`, `4420`, `4442` (known) — **plus `4370`** (`this._densityCacheKey = ''; // invalidate`)
and **`4496`** (`// was a drag, not a click`), neither of which was on the handoff's list.
`4350` and `4356` are whole-line comments — there is nothing to fold onto; they would have to be
replaced, and a replacement must not lose what they say.

---

## 5. THE CLICK-HIGHLIGHT — a new field, because none exists

```js
S.pick = { level, i, j, tMs } | null;   // DRIVER writes on a committed map click; LAB draws it.
```
`i`/`j` are the design's OWN grid coordinates (⛔ NOT the game's `col`/`row` — `row = n - 1 - j`, the
Z-flip from the last INTERFACE §1). LAB draws a `frame()` on that cell in `INK.KEY` while `S.pick` is
set and its level matches. DRIVER clears it when the drill lands.
⛔ It needs a default of `null` in `state.js` — a missing field a painter reads freezes the glass.

---

## 6. AC-2's PUBLISHED RECTANGLES — the agreed names

LAB publishes; DRIVER hit-tests. All are `{ x, y, w, h }` unless noted, written at the draw site,
after every call whose values they read, and **none of them changes a pixel**.

| field | what | design / level |
|---|---|---|
| `S.pagerRect` | `{ x0, mid, x1, y, h }` — left half pages back, right half forward | 1, all |
| `S.yGaugeRect` | the prism's Y-gauge strip; drag sets the camera's Y | 1, PRISM |
| `S.minimapRect` | design 2's 24×24 corner inset + its own projection | 2, PRISM |
| `S.orbitRings` | `[{ cx, cy, rx, ry, ref }]` — click an orbit to select its body | 2, SYSTEM |
| `S.labelHits` | `[{ x, y, w, h, ref, kind }]` — every `plated()` label, at its DRAWN position | 1+2, PRISM/SYSTEM |
| `S.locatorRect` | design 2's topbar `HERE · SECTOR` | 2, all |
| `S.listHeaderRects` | `[{ x, w, sortId }]` — click a column header to sort by it | 2, PRISM list |
| `S.companionRect` | the `» STAR B nnAU` strip — the companion is unreachable today | 2, SYSTEM |

⛔ **THE PLATE AMBIGUITY IS REAL AND IT IS DECIDED HERE: A CLICK ON A PLATE BELONGS TO THE LABEL'S OWN
OBJECT.** `plated()` (`:309-313`) knocks out a BG rect before drawing, so those texels are the label's
by construction — nothing underneath is visible there to click. `S.labelHits` is therefore tested
BEFORE `S.prismHits`/`S.bodyHits`, not after.
⚠ **And that ordering is what makes the labels correct rather than merely reachable.** Measured by the
inventory: `placeLabel` (`:296-306`) walks 7 offsets up to 18 texels from its star and checks
candidates only against **other labels**, never against star dots — so today a label can sit squarely
on an unrelated star's mark, and a click there selects **the wrong star**. The prism's index tags have
the same drift at a fixed `+3,-6`. Testing `S.labelHits` first fixes a live mis-selection, not just an
inert region.
⚠ Tile-ID plates are the one unambiguous case — drawn inside their own cell and guarded — so they
already resolve correctly through `S.mapProj`; they need no entry.

---

## 7. WHAT MUST STAY TRUE, FOR ALL THREE OWNERS

- `wc -l src/ui/NavComputer.js` == **4711**; `wc -l src/main.js` == **15161**.
- `node scripts/extract-nav-designs.mjs --check` exits 0.
- `viewMode === null` is today's nav, byte for byte — including `_localRotX = 0.5 / _localRotY = 0.3`
  and the 600 ms tilt settle.
- Suites: `tests/` 20 failed / the same 8 files; `src/cockpit` 698; `src/ui` 480 + new.
- Every new key or pointer behaviour is covered by a test that drives `nav._onKeyDown` or dispatches a
  real event — **not** one that calls a driver method. All 28 view-mode tests passed while the `V` key
  was dead code, because not one drove the keyboard.
- Every new field a design reads has a default in `state.js`. A painter throw freezes the glass:
  `PanelHost` catches once, then stops uploading, and the screen keeps showing the last good frame.
- `S` and `D` are MUTATED, never replaced.
- The cockpit panel cannot acquire a mode — the gate is `activate()`, never `_bare`.

---

## 8. THE REMAINING RECTANGLES, THE COUNTER, THE GALAXY HIGHLIGHT AND THE INBOUND EASE — agreed 2026-09-08 (part 3)

Same three owners, same disjoint files (§0). LAB publishes at the draw site; DRIVER consumes; HOST folds.
Every field below is cleared by the DRIVER's `resetPicks()` each frame and has a default in `state.js`.
None of them moves a pixel of any entry frame Max ruled on.

| field | shape | who writes · where | who reads |
|---|---|---|---|
| `S.pagerRect` | `{ x0, mid, x1, y, h }` | LAB · `d1Rail`, right after the pager `T()` | DRIVER `remapClick`: `x < mid` → `page(-1)`, else `page(1)`; eaten (`return null`). Design 1, every level with a rail; absent while the drawn search is open (d1Rail returns early). `mid = (x0 + x1) / 2`. |
| `S.listHeaderRects` | `[{ x, y, w, h, sortId }]` | LAB · `d2List`, one per DRAWN header (`cols[i] < W - 8`) | DRIVER `remapClick`: inside a header → `sortTo(sortId)`; eaten. `sortId` map: `N→null, NAME→'name', SP→'class', PC→'dist', PLANE→'plane', SYSTEM→'catalog'`. Design 2, PRISM in list mode only. |
| `S.locatorRect` | `{ x, y, w, h }` | LAB · `drawDesign2`, from the same `fit(loc)`/`locW` the text was drawn with (right-aligned at `W - 4`) | DRIVER `remapClick`: `recentreOnPlayer()`; eaten. Design 2, every level. |
| `S.minimapRect` | `{ x, y, w, h }` | LAB · `d2Prism`, the 24x24 widget's own `mx, my, mw, mh` | DRIVER `remapClick`: eaten, no action — a click on the widget must not resolve to the star mark UNDER it (the plate-ambiguity rule, §6). Design 2, PRISM map mode. |
| `S.companionRect` | `{ x, y, w, h }` | LAB · `d2System`, only when the `» STAR B nnAU` strip is drawn (`far.length`), from the fitted string's own width | DRIVER `remapClick`: eaten, no action — a click on the strip must not select the ring under it. Design 2, SYSTEM. |
| `S.ladderCounterRect` | `{ x, y, w, h }` | LAB · `d1Ladder`, where `N-M OF K` is drawn (only when `maxScroll > 0`), from `measurePixelText` of the string it drew, right-aligned at `x1 - 4` | DRIVER `counterGrab(x, y)` / `counterDragTo(px)`; HOST folds (below). Design 1, SYSTEM. |
| `S.pick` (level 0) | `{ level: 0, sector: { centerX, centerZ, size, name }, tMs }` | DRIVER `notePick` at level 0, via `pickSector` (the SAME call the drill uses) | LAB `d1TwoD` / `d2TwoD` at level 0: `frame()` the sector's rect in `INK.KEY`, through the design's OWN `toX`/`toY`, intersected with `REGIONS.map` (design 1) / the painted band (design 2) so nothing paints over chrome. Drawn LAST. Levels 1-2 keep `{ level, i, j, tMs }` unchanged. |
| `S.levelLag` | `{ from, to, kind:'map'|'prism', t0, dur, fromView, toView, fromRadius, toRadius, fromCam, toCam }` \| `null` | DRIVER only (`state.js` refresh + `index.js`) | DRIVER only. The designs never read it; they read `S.level`, `S.view`, `S.cam` as always. |

### 8a. The sort keys DRIVER adds at level 3 (for the headers)

`SORT_KEYS[3]` gains, AFTER the existing four so index 0 (DIST, today's order) is untouched:
`{ id:'plane', label:'PLANE', cmp: (a,b) => (a.wy ?? 0) - (b.wy ?? 0) }` — monotonic in the column's own
`(wy - player.y)` since the offset is constant — and
`{ id:'catalog', label:'CATALOG', cmp: (a,b) => (b.isReal?1:0) - (a.isReal?1:0) || ((a.dist ?? 0) - (b.dist ?? 0)) }`.
`sortTo(id)`: sets `S.sortIdx` to that key's index at the ACTIVE level, `S.sortLabel`, `S.listOffset = 0`;
returns `false` (and changes nothing) for an id the level has no key for. ⚠ The `N` header is the row
ordinal — sorting by it is the identity — so it publishes `sortId: null` and its click is eaten and does
nothing. Log it in the contract; do not invent a key for it.

### 8b. `recentreOnPlayer()` — what "centre on the player" MEANS at each level (DRIVER)

- **Level 0** — ease the frame's centre to `(player.x, player.z)` at the current size, through the HOST's
  existing `nav._viewEase` (the outbound AC-6 tween at `:1419`, `{ startTime, duration: 350, fromCenter,
  fromSize, toCenter, toSize }`), NOT through `_startDrillAnim` (which arms `_anim` and eats clicks).
  Design 2's wide band is the reason this is worth anything: half the disc is off the band by
  construction, and the player's own sector can be one of the 20 sectors off it.
- **Levels 1-2** — the player's sector / region: snapshot `_viewCenter`/`_viewSize`, call
  `nav._setupViewStackForPlayer()` (rebuilds stack[1..2] from the player and snaps), then set
  `nav._viewEase` from the snapshot to the new `_viewCenter`/`_viewSize` so the frame eases instead of
  cutting. `_densityCacheKey = ''`.
- **Level 3** — `nav._setupViewStackForPlayer()` (so the loader's block is the player's), then
  `nav._localCenter = { x: player.x, y: player.y, z: player.z }`, `nav._localStars = []`,
  `nav._resetPrismLoad()` — the tab-into-PRISM path at `:4481` does the same reset. Rotation untouched.
- **Level 4** — NOT eaten, no action: the current system is the one on the glass unless a foreign one was
  drilled, and re-entering the current system from a foreign one is `resolveArrivalSystem` territory
  nobody has agreed. The contract carries it as an open item for Max.

### 8c. The counter scrubber — DRIVER methods + HOST folds

DRIVER: `counterGrab(x, y)` → true iff `S.ladderCounterRect` is published and contains the point (one texel
of skirt each side, like `gaugeGrab`). `counterDragTo(px)` → `Math.round(ladderMax * clamp((px - r.x) / r.w,
0, 1))`, or `null` when no counter was drawn this frame.
HOST, three folds mirroring the y-gauge exactly, all on CLEAN lines (§4's survey):
- `:4405` (mousedown, level 4): `this._counterDrag = !!(this.viewMode === 'rail' && this._viewDriverInst && this._viewDriverInst.counterGrab?.(p.x, p.y));` — folded BEFORE the existing `_dragStartLadder` statement so a press on the counter is decided first.
- `:4355` (mousemove, level 4): `if (this._counterDrag) { const cv = this._viewDriverInst.counterDragTo?.(p.x); if (cv != null) this._viewDriverInst.S.ladderScroll = cv; return; }` — folded BEFORE the ladder-pan clause; the `return` is load-bearing (one hand, one control).
- `:4415` (mouseup): `this._counterDrag = false;`.
⚠ The counter's own pixels do not move — it is a READOUT, `N-M OF K`, and the AC's "indicator moves under
the pointer" is met by the readout changing as the window it reports moves. A drawn thumb would be a new
element on the SYSTEM picture and goes to Max as a picture question, not into this pass.

### 8d. The inbound ease (AC-6, second half) — DRIVER only, armed only by the DRIVER's own tab paths

⛔ MEASURED FIRST, SO THE SCOPE IS RIGHT: the drill click REGION→PRISM already animates (`_startDrillAnim`
to level 3 moves `_viewCenter`/`_viewSize`, which `S.view` reads) and the star click PRISM→SYSTEM already
animates (`_systemZoomAnim` moves `_localRadius`/`_localCenter`, which `S.cam` reads). What still SNAPS is
the TAB STRIP and the Tab KEY into PRISM or SYSTEM (`:4475` sets `_levelIndex` synchronously; `:4476`'s
`_viewEase` covers only the way OUT). So:
- `tabLevel()` and the tab branch of `remapClick()` set `S.levelArm = { from: nav._levelIndex, tMs: simClockMs() }`
  immediately before handing the click to `_handleClick`. Nothing else arms it — a test that assigns
  `_levelIndex` directly, and the drill-click paths (which carry their own `_anim`), never lag.
- In `refresh()`: when `nav._levelIndex !== S.level`, `S.levelArm` matches (`from === S.level`, within
  one second), `!nav._anim` and `!nav._systemZoomAnim`, start `S.levelLag` for the pair:
  · `from ≤ 2, to ∈ {3,4}` → `kind:'map'`: hold `S.level = from` and ease `S.view` from the current frame
    to `{ cx, cz }` = `nav._localCenter` (to 3) or the player (to 4), `size = fromSize / (gridN(from) * 2)`
    — the exact mirror of `:4476`'s outbound `fromSize`. 350 ms, smootherstep, sim clock.
  · `3 → 4` → `kind:'prism'`: hold `S.level = 3` and ease `S.cam.radius` to `× 0.1` and `S.cam.{x,y,z}`
    toward `nav._systemStar` (fall back to the player) — the mirror of `_systemZoomAnim`. 350 ms.
  · `4 → 3` → `kind:'prism'` reversed: `S.level = 3` at once, `S.cam.radius` eases from `× 0.1` up to the
    live radius (arrive by zooming out).
  · every other pair: no lag (0-2 ↔ 0-2 are the host's own drills/eases; 3/4 → 0-2 is `:4476`).
  While a lag runs `S.level` is the HELD level, so the designs keep drawing the picture that is leaving.
- While `S.levelLag` is set, `remapClick` returns `null` (a click during the ease is eaten, exactly as
  `_handleClick`'s `if (this._anim) return;` eats one during a drill) and `resolveHover` writes `null`.
- The lag ends when `t ≥ 1`: `S.levelLag = null`, `S.level = nav._levelIndex`, and `S.view`/`S.cam` go back
  to being read straight off the instrument. A level change from anywhere else during a lag cancels it.

### 8e. What every owner's tests must drive (§2 of the last INTERFACE still governs)

A key through `nav._onKeyDown`; a click through `clickAt`/`_handleMouseMove` + `_handleClick`; a drag
through `_handleMouseDown`/`_handleMouseMove`/`_handleMouseUp`; the clock through `_setSimClockMs`.
Every new field: (1) published where the design draws it, (2) `null`/`[]` in the other design and at the
other levels after ONE `render()` (the clear is per frame), (3) the consumer acts on it, (4) mutate the
fix — drop the publication, stop eating the click, flip the half, skip the clear — and name the test that
goes red. A survived mutant means the claim is false as written (part 3 trap 19), not that the test is weak.

### 8f. Corrections after the adversarial pass and the live walk (2026-09-08, later) — these override the rows above where they differ

- **`S.minimapRect` is WITHDRAWN.** The widget is four brackets, a dot, a scale column and a 5-texel mark — ~49 texels of ink in a 720-texel box over a starfield drawn BEFORE it. It is not a plate (`plated()` knocks out a BG rect; this does not), so a star inside the box is visible and hoverable, and eating the press turned a live pick into nothing. The lab publishes nothing and the driver eats nothing there; the starfield under the widget answers as it did before part 3. Marking the widget visibly as a readout is a picture question for Max.
- **`S.companionRect` stays, with a true comment:** the strip is glyph rows at `mapY + 1` and no orbit ring can reach above y ≈ 21 at any tilt (measured), so today the eat guards nothing the paint can produce. Kept as the plate rule stated where a taller orrery would need it, not because a test holds it.
- **`S.levelLag` and `S.levelArm` are NOT cleared by `resetPicks()`** (the §8 preamble said every row was): they outlive frames by design, like `S.pick`. Their defaults are in the S literal.
- **The arm is consumed on the very next `refresh()`, not after one second**, and the tab-strip branch of `remapClick` arms ONLY when the tab is not the level already on the glass (`tabLevel` already refused that). A stale arm can therefore never attach to a later, unrelated level change.
- **The ease is cancelled only by a REAL tab** — `tabIndexAt(...) >= 0`, not the disabled SYSTEM tab, not the current level's tab — never by a press in the strip's band past the last drawn tab. Any other press during a lag is eaten, map and chrome alike.
- **AC-5's identity is ONE object:** `remapClick` resolves hover at the click point before `notePick` runs, and `notePick` at level 0 takes the sector off `nav._hoveredTile.sector` (the very object `_handleClick` drills), falling back to `pickSector` only when no hover resolved. A tap with no preceding pointer move now drills what it frames.
- **`levelView(0)` reads `S.view`** (LAB, measured live: the fixed disc was hiding the host's own 2D pan, the locator's level-0 ease, and the GALAXY drill's zoom). The entry frame is unchanged because `_viewStack[0]` is the same `{0, 0, 44}`; the lab page's stand-in returns the same literal. Design 1's re-fit and cull compose with it; a pan at GALAXY moves the picture in BOTH designs, as it does in today's nav.
- **`LAG_GRID_N` is gone** — `state.js` imports `gridNFallback` from `picking.js` (the second copy the driver already had) instead of adding a third.
- **AC-11 exception, recorded:** design 1 at SYSTEM on a ladder that FITS (Sol at Max's 417x240 is one) no longer draws the right `...` cap, the `N-M OF K` readout, or the hint's `SCROLL , . OR CLICK ...` clause — all three were artifacts of the `+8` padding and promised a scroll that did not exist. Every other entry frame is byte-identical (LAB op-stream diff, 20 frames; live check H).
- **The tests validate every band against the PAINT, not against themselves:** absolute assertions per rectangle (pager: both x edges and a texel each side of `mid`, one texel below the row, the search-open null, a non-PRISM level; headers: ink inside every published rect and none one texel left of it, `y === BAR + 4`, the `catalog` order, the offset reset; locator: `x + w === W - 4`, `y === 1`, the eaten return at levels 0-3, REGION, the unchanged `toSize`; counter: `x + w === caps.x1 - 4`, `y === caps.axisY + 16`, a 3-body ladder publishing `maxScroll` 0 with no cap marks, `S.ladderVisible` moving under a scrub, the host's `cv == null` branch; galaxy highlight: zero KEY frames with `S.pick` null, a rim sector's frame clipped to the square/band, the picture panning with `_viewCenter` in both designs and closing on the sector during the drill; ease: the end values of `S.view` and `S.cam`, `≤2 → 4`, `4 → 3`, design 2, the strip CLICK path, hover null with a hover armed beforehand, the same-tab no-arm, the band-past-last-tab no-cancel).
