# Code Review: Binary Stars, Ship Position, Moon Orbits, Naming

**Branch:** `potential-refactor`
**Date:** 2026-03-30
**Files changed:** `src/ui/NavComputer.js`, `src/main.js`

**Summary of changes:**
- Binary star rendering in system view (two offset stars, orbit rings, companion glow)
- Binary star double-dot indicator in column view
- Binary info in hover tooltips (column + system)
- Ship position diamond indicator + trajectory line (system view + planet detail)
- Moon orbit rendering changed from screen-space circles to 3D-projected orbits
- Planet labels changed from type name to designation (e.g. "Vega-3")
- Moon tooltip names changed to designation (e.g. "Vega-3a")
- `setCurrentBody()` API added to pass focus index from main.js

---

## 1. DEVELOPER PERSPECTIVE

### [BUG] Ship moon position uses old orbit formula (system view)
**File:** `src/ui/NavComputer.js:1588-1592`
The ship indicator in system view computes the moon position using the OLD screen-space formula (`baseR + 4 + index * 3.5`) then divides by `projScale`. But the actual moon rendering (lines 1465-1474) was changed to use the NEW formula: `Math.sqrt(moon.orbitRadiusEarth) * moonOrbitScale`. This means the ship diamond will NOT align with the moon it claims to be at. The two formulas produce completely different positions.

### [BUG] Stray `fillText` call renders header text mid-frame in wrong context
**File:** `src/ui/NavComputer.js:1829`
After the moon-rendering loop ends (`}` at line 1828), there is a bare `ctx.fillText(starName + '-' + (idx+1), 16, 24)` call. At this point:
- `ctx.textAlign` is `'center'` (set at line 1820 for moon labels)
- `ctx.fillStyle` is `'rgba(255,255,255,0.4)'` (moon label color)
- `ctx.font` is `'8px "DotGothic16"'` (moon label font)

This draws the planet designation at (16, 24) with center-alignment and moon-label styling, then the actual header at line 1932 draws the same text AGAIN with proper styling. The first draw is a visual artifact (faint, small, centered text at the wrong position).

### [CLEANUP] Duplicated binary orbit math
**File:** `src/ui/NavComputer.js:1359-1370` and `1405-1422`
The binary star positions (mass ratio, separation, offsets) are computed twice: once for star placement (lines 1359-1370) and again for orbit ring rendering (lines 1405-1409). The variables `q`, `sepAU`, `sep` are recomputed identically. Should extract to shared variables.

### [CLEANUP] Unused variable `arrowLen` and `arrowW` assigned but could be inline
**File:** `src/ui/NavComputer.js:1656-1657`
Minor -- `arrowLen = 8` and `arrowW = 4` are used once. Not harmful but adds visual clutter.

### [CLEANUP] Ship position diamond code is duplicated
**File:** `src/ui/NavComputer.js:1600-1620` (system view) and `1858-1877` (planet detail)
The diamond-drawing code (moveTo/lineTo pattern, "SHIP" label) is copy-pasted between the two rendering methods. Should be a helper function like `_drawShipDiamond(ctx, x, y)`.

### [CLEANUP] Trajectory line code is duplicated
**File:** `src/ui/NavComputer.js:1637-1669` (system view) and `1894-1921` (planet detail)
Same dashed-line + arrowhead code is copy-pasted. Should be a helper like `_drawTrajectoryLine(ctx, fromP, toP, color)`.

---

## 2. ARCHITECT PERSPECTIVE

### [BUG] NavComputer does not reference THREE.js -- PASS
The `setCurrentBody()` API receives plain integers (`focusIndex`, `focusMoonIndex`). No THREE.js objects, scene references, or mesh handles cross the boundary. The callback pattern (`_onCommit`, `_onDrillSound`, `_onSound`) remains clean. This is good architecture.

### [CLEANUP] `_selectedBody` schema is inconsistent for stars
**File:** `src/ui/NavComputer.js:2814`
When a star is clicked, `_selectedBody = { type: 'star' }` (no index). But `_hoveredBody` for stars includes `{ type: 'star', index: 0 }` or `{ type: 'star', index: 1 }`. The trajectory line code at line 1626 checks `target.type === 'star'` and always targets `starP` (primary). If the user clicks the binary companion, the trajectory still points to the primary. The `_selectedBody` should store which star was selected (primary vs companion).

### [CLEANUP] Binary stash not triggered on tab switch
**File:** `src/ui/NavComputer.js:2743-2750`
When the user clicks the COLUMN tab to leave system view (instead of pressing ESC), the binary stash code (lines 526-532) does not execute. The `_systemStar` and `_systemData` are not cleared either. This means the column view won't show the binary double-dot indicator for that star if the user navigated away via tab.

### State management for `_selectedBody`/`_commitAction` -- MOSTLY CLEAN
- Cleared on ESC (line 519)
- Cleared on click-empty-space (line 2832)
- Cleared on entering new system (line 2849)
- Cleared on planet detail exit (line 2801)
- **Not cleared when tab-switching away from system view** -- but this is benign because the commit button only renders when `_levelIndex === 4`.

### Callback patterns -- CLEAN
- `_onCommit`, `_onDrillSound`, `_onSound` are all simple function references set once
- No risk of stale callbacks since they're set fresh each time the nav computer opens
- No circular dependencies introduced

---

## 3. PM PERSPECTIVE

### [UX] No persistent highlight on selected body
When the user clicks a planet to select it as a burn/warp target, there is hover highlighting (blue ring at line 1545) but no persistent selection highlight. If the user moves the mouse away after selecting, the only visual indicator that something is selected is the COMMIT button at the bottom. The selected body should have a persistent glow or ring.

### [UX] Ship indicator overlaps with planet body when at that planet
**File:** `src/ui/NavComputer.js:1594-1597`
When the ship is at a planet, `shipP` is placed at the exact planet position. The green diamond draws on top of the planet dot, partially obscuring it. Should offset the ship indicator slightly (e.g., above or to the side of the planet).

### [UX] Trajectory line to self (ship at same body it's targeting)
If the user is at Planet 3 and selects Planet 3 as a burn target, the trajectory line has zero length (ship and destination are the same point). The arrowhead won't draw (guarded by `len > 20` at line 1654), but the dashed line still draws as a zero-length stroke. Not harmful but slightly confusing -- should either suppress the line or show "ALREADY HERE" feedback.

### [UX] Planet detail: clicking empty space returns to system view even if the user just wanted to deselect
**File:** `src/ui/NavComputer.js:2800-2803`
In the current system's planet detail view, clicking empty space both clears the selection AND returns to system view. There's no way to just deselect a moon without leaving the planet detail. Users might want to deselect and browse other moons.

### [UX] "SHIP" label may overlap with moon labels in planet detail view
**File:** `src/ui/NavComputer.js:1873-1877`
The "SHIP" label is placed 10px below the diamond. If the ship is at a moon, this label can overlap with the moon's type label (placed at `moonP.y + moonR + 10` at line 1821). No z-ordering or collision avoidance between them.

### [UX] Binary companion star click triggers warp to the system, not to the companion specifically
Clicking either the primary or companion star in a foreign system creates the same commit action (`target: 'star'`). The user has no way to specify "I want to orbit the companion, not the primary." This might be fine if the game doesn't distinguish, but could be confusing for users who expect to navigate to the companion star specifically.

---

## Fixes Applied

The two [BUG] items were fixed directly in the code (not committed):

1. **Ship moon position formula** (`src/ui/NavComputer.js:1585-1596`): Replaced the old screen-space formula (`baseR + 4 + index * 3.5` / `projScale`) with the same 3D-projected formula used by actual moon rendering: `Math.sqrt(orbitRadiusEarth) * moonOrbitScale`. Ship diamond now aligns with the rendered moon position.

2. **Stray `fillText` call** (`src/ui/NavComputer.js:1829`): Removed the orphaned `ctx.fillText(starName-idx, 16, 24)` line that was drawing a ghost header with wrong font/alignment/color before the real header.
