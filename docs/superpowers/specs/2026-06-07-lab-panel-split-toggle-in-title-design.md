# Design — planet-lab: split panel into two sides + toggle-in-title

**Date:** 2026-06-07 · **File:** `world-engine-lab.html` (three.js r183.1 / lil-gui 0.21.0) · **Branch:** `master`
**Predecessor:** `2026-06-07-lab-panel-ux-redesign-design.md` (shipped archetype filter + per-feature solo).

## Goal (Max's words)
> "Separate the UI panels … lab controls on one side of the screen, everything related to the specific
> features being rendered on the other. Each category of feature collapsed by default, and the on/off
> toggle next to the name of each feature in the list rather than as a separate line item."

## Decisions (locked in brainstorming)
- **Layout B.** LEFT = the rig; RIGHT = `Surface — Relief` only (perturb + the 14 features, nested).
  `Body filter` stays LEFT with the rig (it's a rig tool, not a feature).
- **Toggle mechanism = (b) relocate the real controller**, not a hand-rolled `<input>` (option a).
- In-body `✓ enabled` line is **removed as a body line** — its DOM moves to the title (single source).
- `perturb` rides along inside `fRelief` on the right.

## Current structure (ground truth, as of this spec)
Single `const gui = new GUI(...)` (line ~1978). Top-level folders, in order:
`Body filter` (fFilter), `View & LOD` (fView), `Debug — voronoi3d spike` (fDebug), `Envelope` (fEnv),
`Drivers` (fDrivers), `Surface — Relief` (fRelief), `Seeds` (fSeeds), `Presets` (fPresets).
The **14 feature folders are children of `fRelief`** (which also holds the `perturb` slider):
fCraters, fEjecta, fMountains, fCanyons, fScarps, fPlateaus, fTessera, fEdifices, fLava, fChaos,
fCryoRidge, fFrost, fSub, fGlacial — each currently `.open()`, each ending in
`f.add(state,'<x>Enabled').name('✓ enabled')` plus an appended `🔆 solo` and (most) a `🎲 randomize`.

Global `gui.*` calls = the refactor blast radius:
- `gui.controllersRecursive().forEach(c=>c.updateDisplay())` at lines **2147, 2371, 2387, 2468**
- `gui.save()` at **2407** (Presets → Copy settings JSON)
- `gui.reset()` at **2408** (Presets → Reset to defaults)

The `featureFolders` map (key→folder, incl. the `sublimation`↔`fSub` bridge) and `FEATURES[k].enableKey`
already exist (planet-archetypes.js + line ~2360). Reuse them; do NOT re-list the 14.

## Architecture

### 1. Two GUI instances, helper-routed globals
Replace the single `gui` with `guiLeft` + `guiRight`.
- `guiLeft`  = rig: pinned left (`guiLeft.domElement.style.left='0px'`, `right='auto'`).
  Title e.g. `PLANET LOD LAB — rig`.
- `guiRight` = features: lil-gui's default top-right. Title e.g. `Features`.
- Folder assignment:
  - LEFT  ← `Body filter`, `View & LOD`, `Debug`, `Envelope`, `Drivers`, `Seeds`, `Presets`
  - RIGHT ← `Surface — Relief` (unchanged internals: `perturb` + 14 nested folders)

Add helpers right after both GUIs exist:
```js
const allGuis = [guiLeft, guiRight];
function syncDisplays(){ for (const g of allGuis) g.controllersRecursive().forEach(c=>c.updateDisplay()); }
function saveAll(){ const a=guiLeft.save(), b=guiRight.save();
  return { controllers:{...a.controllers,...b.controllers}, folders:{...a.folders,...b.folders} }; }
function resetAll(){ guiLeft.reset(); guiRight.reset(); }
```
Replace: the 4 `gui.controllersRecursive()...` sites → `syncDisplays()`; `gui.save()` → `saveAll()`;
`gui.reset()` → `resetAll()`. Folder titles are unique across the two GUIs, so merging `.folders` is safe.
`saveAll()` only needs to produce a reasonable exported JSON (Copy is export-only; load is never called).

### 2. Title-bar toggle — relocate the real boolean controller (mechanism b)
Each feature folder keeps its existing `f.add(state,'<x>Enabled')` controller (so it stays in
`controllersRecursive()` and `updateDisplay()` keeps it synced when presets/solo/enable-all flip enables).
After folders + `featureFolders` exist, relocate each enable controller into its folder's title:
```js
function relocateEnableToTitle(folder, ctrl){
  const title = folder.$title;                 // lil-gui 0.21 folder title <button>
  title.classList.add('title-has-toggle');     // flex row via injected CSS
  ctrl.domElement.classList.add('title-toggle');
  ctrl.domElement.addEventListener('click', e => e.stopPropagation());  // don't collapse the folder
  title.appendChild(ctrl.domElement);          // move the node out of the body, into the title
}
for (const [key, folder] of Object.entries(featureFolders)){
  const ctrl = folder.controllers.find(c => c.property === FEATURES[key].enableKey);
  relocateEnableToTitle(folder, ctrl);
}
```
Drop the `.name('✓ enabled')` widget label (the title already names the feature); a small injected
`<style>` lays the title out as `flex` so the checkbox sits right of the name and the name keeps the
folder's click-to-collapse. Exact CSS settled during the spike.

### 3. Collapse defaults
`fRelief` stays `.open()`. Flip the 14 `f<X>.open()` → `.close()`. Result: right column = 14 collapsed
rows, each `▸ <name>  ☑/☐`.

## Spike — gate before production (isolated-harness rule)
Build standalone `planet-titletoggle-lab.html` (~40 lines; lil-gui 0.21.0 from the same source the lab
uses; 2 folders, each with a boolean `enabled` + a dummy slider). Prove, with a `:9223` screenshot:
1. A boolean controller's `domElement` relocates into `folder.$title` and renders inline beside the name.
2. Clicking the checkbox toggles the bound state but does NOT collapse/expand the folder (stopPropagation).
3. Clicking the title name (not the box) still collapses/expands.
4. Programmatically flipping the bound state + calling `controllersRecursive().forEach(c=>c.updateDisplay())`
   re-ticks the relocated box (proves the preset/solo resync path will keep title boxes correct).
If any of 1–4 fails in isolation, fall back to mechanism (a) (hand-rolled `<input>` + explicit sync list)
**in the harness** and prove it there before touching production. Production integration cannot rescue a
mechanism that doesn't work in isolation.

## Testing
- Spike harness green in `:9223` (4 checks above) BEFORE production edits.
- Production, `:9223` GPU Chrome (full lab setup in one `evaluate_script` immediately before each shot):
  - Two panels render, left-pinned rig + right-pinned features, no overlap.
  - 14 feature folders collapsed; each shows a title-row checkbox.
  - Toggling a title checkbox enables/disables that feature (verify via `window.__wd` / visible change),
    and does not collapse the folder.
  - Switch Drivers preset, then `🔆 solo` one feature → title checkboxes resync to the new enable set.
  - `Body filter → filter to relevant` still shows/hides the right-column folders.
  - 0 console errors.
- `npm test` (planet-archetypes.test.js + suite) stays green — logic untouched, this is panel wiring only.

## Out of scope (YAGNI)
- No Tweakpane / framework swap (option c). No promotion of the 14 to top-level (Layout A/C rejected).
- No mobile/responsive treatment of the two panels (lab is desktop `:9223`).
- No change to feature shaders, drivers, archetype logic, or the `featureFolders`/`FEATURES` model.

## Risk notes
- `folder.$title` is the documented lil-gui 0.21 handle; the spike confirms it before reliance.
- Two-GUI `save()` merge is export-only; if a future load path is added it must read both GUIs.
- Backtick parity in `world-engine-lab.html` must stay EVEN (currently 30) — this touches panel JS, not the
  shader template literal, so re-check after edits.
