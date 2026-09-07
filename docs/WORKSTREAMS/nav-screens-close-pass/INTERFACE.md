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
