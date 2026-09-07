# What was measured live, before any code was written

⛔ **Everything here came off the running game** at `localhost:5175`, design 1 and design 2, after a
reload (`NavComputer.js` has no HMR handler). Do not re-derive it; do not dispute it from reading.

## 0. Baselines, captured before touching anything

| | |
|---|---|
| `npx vitest run --dir tests` | **20 failed / the same 8 files**, 3939 passed ✅ matches the handoff |
| `npx vitest run --dir src/cockpit` | **698 passed** ✅ (one run reported 1 failed; green on re-run — flake) |
| `npx vitest run --dir src/ui` | **480 passed** — see the flake note below |
| `node scripts/extract-nav-designs.mjs --check` | `designs.js matches nav-240p-lab.html` ✅ |
| `wc -l src/ui/NavComputer.js` / `src/main.js` | **4711** / **15161** ✅ |

⚠ **ONE PRE-EXISTING FLAKE, AND IT IS NOT OURS.** `navViewModes.test.js > the modes are operable >
rail: every level tab changes level when clicked where it is drawn` failed once under a full
`--dir src/ui` run and passed **3/3 in isolation**. Cross-test state pollution, present before this
workstream. Re-run before believing a drift.

## 1. ⛔ THE BROWSER TRAP THAT COST LAST SESSION A SESSION DID NOT FIRE — because the tab was foregrounded

`select_page` with `bringToFront: true`, then measured: `simClockMs()` advanced **1000.000 ms in one
wall second**. So `_updateAnim` completes, `_anim` clears, and `_handleClick`'s `if (this._anim) return;`
does **not** eat clicks. ⭐ **This removes suspect #1 for the second-selection bug entirely** — the
throttled-tab artifact the handoff warned about is not what Max is seeing.

## 2. ⭐ ITEM 5 — THE ZOOM ANIMATION IS ALREADY BACK. HALF THIS ITEM IS DONE.

Drove a real GALAXY drill (mousemove → mousedown/up/click on cell `i=4, j=3`, texel `142.5, 100.5`).
`_hoveredTile` resolved to sector **`Alpha Norma-78`**, and `S.view.size` walked, sampled per rAF:

```
44 → 43.985 → 43.884 → 43.628 → 43.164 → 42.456 → 40.228 → … → 0.5
```

and landed at **`_levelIndex 1`**, `viewCenter { x: 2.75, z: -2.75 }`, `S.view` and `S.mapProj` both
following it. **So the designs' map zooms on a drill.** What is missing is only the **highlight
before the zoom** — there is no click-highlight state anywhere — and the transitions that still snap
(§4 below).

## 3. ⭐⭐ ITEM 3 — DIAGNOSED, REPRODUCED IN BOTH DESIGNS, AND IT IS NONE OF THE THREE SUSPECTS

**Design 1**, three clicks on the ladder:

| click | hovered | `_selectedBody` after | `_systemMode` after |
|---|---|---|---|
| Sol c (`pIdx 1`) | `{planet, 1}` | `{planet, planetIndex: 1}` ✅ | `system` |
| Sol e (`pIdx 3`, **has moons**) | `{planet, 3}` | `{planet, planetIndex: 3}` ✅ | **`planet`** |
| Sol c (`pIdx 1`) again | `{planet, 1}` ✅ | `{planet, planetIndex: **3**}` ⛔ | `planet` |

**Design 2**, three clicks on the orrery, entered with `_systemMode` already `'planet'`:

| click | hovered | `_selectedBody` after |
|---|---|---|
| Sol b (`pIdx 0`) | `{planet, 0}` | `{planet, planetIndex: 3}` ⛔ |
| Sol g (`pIdx 5`) | `{planet, 5}` | `{planet, planetIndex: 3}` ⛔ |
| Sol b (`pIdx 0`) | `{planet, 0}` | `{planet, planetIndex: 3}` ⛔ |

⭐ **THE HOVER IS CORRECT EVERY TIME. THE CLICK THROWS IT AWAY.** `NavComputer.js:4512-4522`:

```js
if (this._systemMode === 'planet') {
  if (isCurrent) {
    …
    if (this._hoveredBody && this._hoveredBody.type === 'planet') {
      this._selectedBody = { type: 'planet', planetIndex: this._selectedPlanetIdx };
```

It writes **`this._selectedPlanetIdx`** — the planet already selected — not `this._hoveredBody.index`.

⛔ **AND THE REASON IT WAS RIGHT BEFORE IS THE WHOLE SEAM.** The legacy planet-detail view draws
**one** planet, so `_hoveredBody.index` and `_selectedPlanetIdx` always agreed there. The designs
**never leave the whole-system picture** — measured with `_systemMode === 'planet'`, `S.bodyHits`
still published all **15 bodies** as pickable. So `_systemMode` is a legacy *view* state that the
designs do not represent, and selecting any planet with moons arms a permanent freeze.

## 4. ITEM 5's OTHER HALF — WHICH TRANSITIONS SNAP, AND WHY

`_handleClick`'s tab-strip branch, `NavComputer.js:4450`:
`if (idx <= 2 && this._levelIndex <= 2 && target)` → `_startDrillAnim(…, 350)`; **else it jumps.**
So GALAXY↔SECTOR↔REGION animate and **everything touching PRISM (3) or SYSTEM (4) snaps.** Max's own
example is the animated case, so *"lost much of the animation"* is most likely these.

## 5. ⭐⭐ ITEMS 4+7 — THE PRISM IS ROTATION-BLIND, MEASURED WITH A LIVE CONTROL

Instrument: the published `S.prismHits` coordinates (not a pixel hash — a pixel hash of the nav canvas
is **not stable frame to frame**, measured: two consecutive frames with no input already differ, so it
cannot serve as a control here).

| step | first 3 published marks |
|---|---|
| baseline | `213.5,120 \| 331.6,92.4 \| 337.6,91.7` |
| **control** — `_localCenter.z += 0.0004` | `213.5,107.5 \| 331.6,79.9 \| 337.6,79.1` — **every mark moved** ✅ probe is live |
| **probe** — `_localRotY += 1.1`, `_localRotX = 0.15` | `213.5,120 \| 331.6,92.4 \| 337.6,91.7` — **byte-identical** ⛔ |

`S.cam` before and after the rotation: `{x: 8, y: 0.025, z: 0, radius: 0.0015}` both times — **it
carries no rotation at all.** And the drag genuinely writes the game's camera: one 10-step drag took
`_localRotX 0.5 → 0.261` and `_localRotY 0.3 → 0.940`. ⭐ **So the pilot is already rotating a camera
that the designs cannot see.** One hop is missing, and `S.cam` is already the pipe.

⚠ **ENTRY VALUES, which are what AC-11 must reproduce:** `_localRotX = 0.5`, `_localRotY = 0.3`,
`_localRadius = 0.0015`; `_systemRotX = 0.5`, `_systemRotY = 0`. Against the designs' fixed
`rx = 0.92` / `tilt = 0.42`.

## 6. ⛔ FOUND IN PASSING — EVERY BODY NAME IN BOTH DESIGNS IS A SWALLOWED ERROR

Live at SYSTEM on Sol, the published `S.bodyHits` read:

```
Sol b, Sol c, Sol d, Sol e, BELT A, Sol f, Sol g, Sol h, Sol i, Sol j, Sol k, BELT B,
Sol undefined, Sol undefined, Sol undefined
```

`state.js:109`'s `makeRng` returns `{ next, child }`. `NameGenerator.generatePlanetName` /
`generateMoonName` call **`rng.float()`** and **`rng.pick()`**. Confirmed headlessly:

```
THROWS: TypeError: rng.float is not a function
fallback for i=10: Sol undefined
```

So `state.js:258-259`'s `catch` fires on **every single body**, every name on the glass is the
fallback `(star.name || 'S') + ' ' + 'bcdefghijk'[i]`, and that alphabet **runs out at index 10**.
Sol has **13** planets.

⚠ **AND THE COMMENT IS THE TRAP.** `state.js:107` says this rng is *"`NavComputer._makeRng`
(:315-327), the same shape — the names must match the instrument's."* It is **not** the same shape:
the real one exposes `float`, `int`, `pick`, `bool`, `chance`, `child`. A reader checking the comment
instead of the code would close this as fine. Probability the 13 straight fallback-form names are
coincidence, given the generator takes that form only 55% of the time: **~0.0004**.

## 7. ⭐⭐ ITEM 1 — MEASURED LIVE AGAINST THE REAL 775 SECTORS, AND IT IS MUCH WORSE THAN "A FIFTH"

The handoff estimated *"roughly a fifth of the pane can never be clicked"* from the geometry. Driven
against the running game's own `_sectors.getSectorAt`, inverting through the design's own published
`S.mapProj`:

### Design 1 — **HALF THE MAP IS DEAD**

| | |
|---|---|
| drawn grid | 8×8 = **64 cells** over a 216-texel square at `ox=21, oy=6, cell=27` |
| cells whose CENTRE resolves to a sector | **32** |
| cells whose centre resolves to **nothing** | **32 — exactly half** |
| texels sampled across the square (every 4th) | 2916 |
| texels resolving to no sector at all | **1375 = 47.2%** |

⛔ **The dead cells are a complete RING, not just the corners.** The whole top row (`j=0`), the whole
bottom row (`j=7`), both full side columns (`i=0` and `i=7`), and the corners of the next ring in:

```
0,0 1,0 2,0 3,0 4,0 5,0 6,0 7,0      ← entire top row
0,1 1,1                 6,1 7,1
0,2                         7,2
0,3                         7,3
0,4                         7,4
0,5                         7,5
0,6 1,6                 6,6 7,6
0,7 1,7 2,7 3,7 4,7 5,7 6,7 7,7      ← entire bottom row
```

⭐ **AND THE PICTURE ALREADY ADMITS IT.** In the shot `shots/galaxy-design1-today.png` only **eight**
tile-ID plates are drawn — `E3 D4 E4 F4 D5 E5 F5 E6` — and every one of them is in the middle two
columns. The ranked tiles the design chooses to name are all central because that is where the
galaxy is; the grid keeps being drawn over the black anyway.

### Design 2 — the opposite failure, and it is small but it is a CORRECTNESS gap

| | |
|---|---|
| projection | `kind: 'wide'`, `kpc = 0.103` per texel, clip `{x:0, y:8, w:427, h:224}` |
| visible vertical band | **±11.54 kpc** |
| sectors on the glass | **755 / 775** |
| sectors **off the glass, unreachable by any click** | **20** |
| furthest sector \|z\| | 15.00 kpc · furthest R | 21.21 kpc |

⭐ **So the two failures are not the same size and should not get the same answer.** Design 1 draws a
grid over ground that is 47% nothing — an **affordance** lie, since `pickSector` already returns
`null` there correctly. Design 2 draws an honest picture that is **missing 20 real sectors** — a
correctness gap, small in count only because 73% of all sectors sit inside R < 4 kpc.

## 8. ⛔ A CORRECTION TO §7, AND IT IS MY NUMBER THAT WAS INCOMPLETE

§7 says design 1 has **"32 dead cells — exactly half"** and calls them *"a complete RING"*. That is a
**CELL-CENTRE** measurement, and sampling the cells properly (42×42 points each) says something
different:

| | |
|---|---|
| cells whose CENTRE resolves to nothing | 32 |
| cells with **no live texel anywhere in them** | **12** |
| cells that are centre-dead but hold live ground **in the corner nearest the galaxy** | **20** |

⭐ **SO THE CENTRE TEST WOULD HAVE HIDDEN CLICKABLE GROUND IN 20 CELLS ON THE OLD 44 kpc SQUARE.**
It is only safe *because* the view was re-fitted first: on the 36 kpc square the 8 remaining disputed
boundary cells are each ~16% live and together **2.55% of all live ground**, and — the check that
actually decides it — **zero sectors are reachable only through a culled cell.**

⚠ **AND §7's "furthest sector R = 21.21 kpc" IS NOT REACHABLE AT ANY EXTENT.** `Alpha Ophiuchus-28`
(centre 15.00, 15.00) sits past `getSectorAt`'s own `R > GALAXY_RADIUS * 1.2 = 18` cutoff
(`GalacticSectors.js:44-46`) and is never returned for any point in the square, before or after this
change. That is the **775 vs 774** gap, and it is a `GalacticSectors` fact, not a projection one.

⭐ **THE LESSON, AND IT IS THE ONE THIS FILE KEEPS RE-LEARNING:** a summary statistic sampled at one
point per cell reads as a fact about the cell. The ring was real; "half the map is dead" was the
right alarm and the wrong shape. The re-fit is what made the cheap test honest.

### What the re-fit actually did

| | before | after |
|---|---|---|
| drawn extent at GALAXY (design 1 only) | 44 kpc | **36 kpc** (`min(44, 2·Rf)`, `Rf = 18.000` measured by bisecting 32 rays through `getSectorAt` itself) |
| cells drawn | 64 | **52** — the four 3-cell corners culled |
| cell size | 27 texels | **27 texels — unchanged.** `sq` is still 216 and `n` is still 8, so the chunk Max asked for by name is untouched; only kpc-per-cell moved, 5.5 → 4.5 |
| drawn cells resolving to nothing | 32 | **0** |
| dead ground inside the drawn square | 47.5% | **21.5%** |
| of the ground the drawn cells cover, live | 52.5% | **94.2%** |
| sectors lost | — | **0** |

⛔ `levelView` itself is untouched. Design 2 renders the square at the WIDE extent and crops, so
shrinking it there would have narrowed its band from ±11.54 to ±9.4 kpc and made its own
(out-of-scope) defect worse.
