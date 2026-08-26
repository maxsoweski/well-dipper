# LOD Lab Menu Declutter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Declutter the planet-LOD lab GUI — one "World" header (kill the preset-selector vs archetype-indicator duplication), self-contained bioMats/cityLights feature folders (kill the split-control duplication), and a collapsed "Not relevant to this world (N)" group for irrelevant features.

**Architecture:** Pure GUI wiring inside the inline `<script>` of `world-engine-lab.html` using lil-gui. No changes to `planet-lod-lab-core.js` (the shader/uniform code), so no planet rendering can regress. Reparenting works by moving lil-gui folders' `.domElement` between DOM containers (the controller objects stay in the lil-gui JS tree — the same trick the existing `relocateEnableToTitle()` already uses), so `syncDisplays()` keeps working.

**Tech Stack:** lil-gui (`new GUI`, `addFolder`, `add`, `addColor`, `.domElement`, `.$children`, `.$title`, `.controllers`), Three.js lab, Vite dev server (`localhost:5173`), chrome-devtools MCP on GPU Chrome `:9223`.

**Verification reality:** The lab GUI is inline HTML script — NOT importable by the vitest harness. Per [[well-dipper-testing-reference]] the project verifies the lab **live on `:9223`** via `window._lab.*` and DOM queries (`mcp__chrome-devtools__evaluate_script`), NOT Playwright, NOT image recognition. Each task below ends with concrete live checks. The only unit test touching this area is the `cityLightsEnabled`-literal regex (test #16) — it must stay green.

**Spec:** `docs/superpowers/specs/2026-06-15-lod-lab-menu-declutter-design.md`

**Standing cautions:**
- **Line numbers are HINTS** — `grep -n` every edit site before editing (line drift is a known hazard in this file).
- **Stage explicit paths only** — `git add world-engine-lab.html` (+ the doc). **NEVER `git add -A`** (shared tree has warp WIP + loose PNGs/webm/html).
- Reload `localhost:5173/well-dipper/world-engine-lab.html?fresh=1` before each verification (`:9223` may hold a stale session).
- `window._lab` exposes: `setPreset`, `applyDrivers`, `state`, `setFilter`, `featureFolders`, `filterUI`, `enableAllFeatures`, `renderDeltaSweep`.

---

## Pre-flight (once, before Task 1)

- [ ] **Step 0.1: Confirm the dev server + lab are reachable on `:9223`.**

Run (chrome-devtools MCP): `list_pages`, then `navigate_page` reload `localhost:5173/well-dipper/world-engine-lab.html?fresh=1`.
Expected: page loads, planet renders, left + right GUI panels visible.

- [ ] **Step 0.2: Snapshot the baseline GUI tree** so reparenting can be verified against it.

Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  return {
    featureKeys: Object.keys(L.featureFolders),
    filterDefault: L.filterUI.filter,
    archLabel: L.filterUI.archetypeLabel,
    bioMatsIsEnv: L.featureFolders.bioMats === L.featureFolders.cityLights, // both === fEnv today → true
  };
}
```
Expected: `filterDefault === true`; `bioMatsIsEnv === true` (both currently map to the Envelope folder — confirms duplication #2). Record `featureKeys` for later count checks.

---

## Task 1: "World" folder — consolidate preset selector + archetype indicator

Kills duplication #1. Build a new top-of-left-panel `World` folder holding the preset picker, the derived archetype label beneath it, and the filter/solo/enable-all/clear-solo controls relocated from the old `Body filter` folder. Remove the standalone read-only archetype field and the now-empty `Body filter` folder.

**Files:**
- Modify: `world-engine-lab.html` (re-grep these anchors: `const fFilter = guiLeft.addFolder('Body filter')` ~L5265; `const filterUI =` ~L5264; `fDrivers.add(driverUI, 'preset'` ~L6281; the `fFilter.add(...)` block ~L7087–7092)

- [ ] **Step 1.1: Replace the `Body filter` folder declaration with a `World` folder at the very top of `guiLeft`.**

Re-grep `guiLeft.addFolder('Body filter')`. The `World` folder must be created BEFORE `fView`/`fDebug`/etc. so it sits at top. Change:
```js
const filterUI = { filter: true, archetypeLabel: '—', soloMode: 'context' };
const fWorld = guiLeft.addFolder('World'); fWorld.open();
```
(Rename `fFilter` → `fWorld` everywhere it's referenced — re-grep `fFilter` to catch all uses, including the `fFilter.add(...)` block in Step 1.3.)

- [ ] **Step 1.2: Move the preset picker from Drivers into `World`, with the archetype label directly beneath it.**

Re-grep `fDrivers.add(driverUI, 'preset', Object.keys(DRIVER_PRESETS))`. **Cut** that line out of the Drivers block and **paste** it as the FIRST control added to `fWorld` (so it appears at top), retargeting `fDrivers` → `fWorld`:
```js
// in the World folder, FIRST control:
fWorld.add(driverUI, 'preset', Object.keys(DRIVER_PRESETS)).name('preset').onChange(applyDrivers);
fWorld.add(filterUI, 'archetypeLabel').name('archetype').disable();   // moved from old Body filter; sits right under the picker
```
Leave `fDrivers.add(driverUI, 'qualityTier', ...)` where it is. The standalone `fFilter.add(filterUI, 'archetypeLabel')...` line (old location ~L7087) is now REMOVED (it lives in `fWorld` above) — delete it.

- [ ] **Step 1.3: Relocate the remaining filter/solo controls into `World`.**

Re-grep the block `fFilter.add(filterUI, 'filter')` … through `clearSolo`. Retarget all to `fWorld` (they're already `fFilter`→`fWorld` after the rename in 1.1). Final intended order in `World`: preset, archetype, `filter to relevant`, `solo mode`, `enable all`, `clear solo (restore)`. Ensure `applyArchetypeFilter` is still bound to the `filter` toggle's `.onChange`.

- [ ] **Step 1.4: Verify live on `:9223`.**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  L.setPreset('Venus (greenhouse)');           // any non-default preset
  const lbl = L.filterUI.archetypeLabel;
  L.setPreset('Rocky (Earthlike)');
  return { afterRocky: L.filterUI.archetypeLabel, venusLbl: lbl };
}
```
Expected: labels differ per preset (the indicator tracks the picker). Then visually (`take_screenshot`): a `World` folder sits at the TOP of the left panel containing preset + archetype + filter + solo controls; the `Drivers` folder no longer shows a preset dropdown; there is exactly ONE archetype field in the whole UI.

- [ ] **Step 1.5: Commit.**
```bash
git add world-engine-lab.html
git commit -m "feat(lod-lab): consolidate preset+archetype into top World folder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Dedicated `bioMats (F46)` / `cityLights (F48)` folders

Kills duplication #2. Both features currently map to the entire Envelope folder (`featureFolders.bioMats === featureFolders.cityLights === fEnv`). Give each its own right-panel folder, move its sliders + enable toggle in from Envelope, and repoint the registry.

**Files:**
- Modify: `world-engine-lab.html` (re-grep: Envelope `bio…`/`city…` adds ~L5300–5314; `const fExoticGroup = guiRight.addFolder('Surface — Exotic')` ~L6733; `featureFolders = {` ~L6897, lines `bioMats: fEnv,` / `cityLights: fEnv,` ~L6908–6909)

- [ ] **Step 2.1: Create the two folders in the right panel, adjacent to F47/F49.**

Re-grep `fExoticGroup.addFolder('Machine surface (F47)')`. Immediately before it (or after the group is created), add:
```js
const fBioMats   = fExoticGroup.addFolder('Bioluminescent mats (F46)'); fBioMats.close();
const fCityLights = fExoticGroup.addFolder('City lights (F48)'); fCityLights.close();
```

- [ ] **Step 2.2: Move the bio sliders from Envelope into `fBioMats`.**

Re-grep the `fEnv.add(state, 'bioCoverage'…` block (~L5302–5306). **Cut** these 5 and re-add on `fBioMats` (verbatim params, retargeted):
```js
fBioMats.add(state, 'bioCoverage', 0, 1, 0.01).name('bio coverage (patch→mat)');
fBioMats.add(state, 'bioScale', 0.8, 6, 0.1).name('bio patch density');
fBioMats.add(state, 'bioIntensity', 0, 1.5, 0.01).name('bio glow');
fBioMats.addColor(state, 'bioColor').name('bio color');
fBioMats.add(state, 'bioMatsEnabled').name('✓ bio mats enabled');
```

- [ ] **Step 2.3: Move the city sliders from Envelope into `fCityLights`.**

Re-grep the `fEnv.add(state, 'cityMaturity'…` block (~L5309–5314). **Cut** these 6 and re-add on `fCityLights` — **keep the `cityLightsEnabled` literal verbatim** (test #16 regexes it):
```js
fCityLights.add(state, 'cityMaturity',   0, 1,   0.01).name('city maturity (specks→bands)');
fCityLights.add(state, 'cityIntensity',  0, 1.5, 0.01).name('city glow');
fCityLights.add(state, 'cityScale',      0.8, 6, 0.1 ).name('city density');
fCityLights.add(state, 'cityCoastBoost', 1, 3,   0.05).name('coast hugging');
fCityLights.addColor(state, 'cityColor').name('city color');
fCityLights.add(state, 'cityLightsEnabled').name('✓ city lights enabled');   // ← load-bearing literal (test:16 regex)
```

- [ ] **Step 2.4: Repoint the registry.**

Re-grep `bioMats: fEnv,` / `cityLights: fEnv,` and change to:
```js
bioMats: fBioMats,
cityLights: fCityLights,
```

- [ ] **Step 2.5: Run the unit test that pins the cityLights literal.**

Run: `npx vitest run` (or the specific suite if known — re-grep `cityLightsEnabled` under `tests/` to find it).
Expected: PASS. (This task moves the literal but preserves it verbatim, so #16 stays green.)

- [ ] **Step 2.6: Verify live on `:9223`.**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  return {
    bioMatsOwnFolder: L.featureFolders.bioMats !== L.featureFolders.cityLights, // now distinct folders → true
    bioTitle: L.featureFolders.bioMats.$title.textContent,
    cityTitle: L.featureFolders.cityLights.$title.textContent,
  };
}
```
Expected: `bioMatsOwnFolder === true`; titles contain "Bioluminescent mats (F46)" / "City lights (F48)" (enable toggle relocated into the title bar by the existing `relocateEnableToTitle()` loop, which runs over `featureFolders` AFTER this — confirm that loop still covers both keys). Screenshot: Envelope folder no longer shows any `bio…`/`city…` rows; the two new folders appear under Surface — Exotic with their sliders.

- [ ] **Step 2.7: Commit.**
```bash
git add world-engine-lab.html
git commit -m "feat(lod-lab): give bioMats(F46)/cityLights(F48) their own folders

Move bio/city sliders out of the shared Envelope folder into dedicated
right-panel feature folders; repoint featureFolders off fEnv.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: "Not relevant to this world (N)" collapsed group + reparenting filter

Replace `applyArchetypeFilter()`'s show/hide with reparenting: relevant features stay in their category groups (in original order); irrelevant ones move into one collapsed bottom group with a live count.

**Files:**
- Modify: `world-engine-lab.html` (re-grep: `function applyArchetypeFilter()` ~L7073; the `for (const [key, folder] of Object.entries(featureFolders))` loops; a good spot to create `fNotRelevant` is right after all category groups + `featureFolders` is defined, ~L6913, AFTER Task 2's new folders exist)

- [ ] **Step 3.1: Create the `Not relevant` group + capture original layout, after `featureFolders` is finalized.**

Re-grep the line right after the `featureFolders = { … }` object closes (~L6913). Add:
```js
// Collapsed home for features irrelevant to the current world (filter ON).
const fNotRelevant = guiRight.addFolder('Not relevant to this world (0)'); fNotRelevant.close();
// Capture each feature folder's ORIGINAL category parent so relevant features
// can be re-appended there in declaration order (preserves intra-category order).
const FEATURE_LAYOUT = Object.entries(featureFolders).map(([key, folder]) => ({
  key, folder, parentEl: folder.domElement.parentElement,
}));
```
**Important:** this must come AFTER Task 2 (so `featureFolders.bioMats`/`.cityLights` point at the new folders, capturing the correct `parentEl`).

- [ ] **Step 3.2: Rewrite `applyArchetypeFilter()` to reparent instead of show/hide.**

Re-grep `function applyArchetypeFilter()`. Replace its body with:
```js
function applyArchetypeFilter(){
  const { set, archs } = relevantFeatureSet();
  filterUI.archetypeLabel = archs.map(a => ARCHETYPES[a].label).join(' + ') || '(none)';
  let nIrrelevant = 0;
  for (const { key, folder, parentEl } of FEATURE_LAYOUT) {
    const relevant = !filterUI.filter || set.has(key);
    if (relevant) {
      parentEl.appendChild(folder.domElement);          // back to its category, in declaration order
    } else {
      fNotRelevant.$children.appendChild(folder.domElement);
      nIrrelevant++;
    }
  }
  // lil-gui renders the disclosure arrow as a CSS pseudo-element, so setting
  // textContent is safe (doesn't clobber it).
  fNotRelevant.$title.textContent = `Not relevant to this world (${nIrrelevant})`;
  fNotRelevant.domElement.style.display = (filterUI.filter && nIrrelevant > 0) ? '' : 'none';
  syncDisplays();
}
```

- [ ] **Step 3.3: Call `applyArchetypeFilter()` once at startup** so the initial (filter-ON) load tucks irrelevant features immediately.

Re-grep where `applyArchetypeFilter` is first invoked at init (the preset `onChange` calls it; ensure there is also a direct call after the GUI is fully built — re-grep `applyArchetypeFilter()` for an existing init call; if none runs at load, add one after `FEATURE_LAYOUT` is built, e.g. right after Step 3.1's block: `applyArchetypeFilter();`).

- [ ] **Step 3.4: Verify live on `:9223`.**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  const grp = () => document.evaluate("//*[contains(@class,'title') and contains(text(),'Not relevant')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.textContent;
  L.setPreset('Rocky (Earthlike)'); L.applyDrivers();
  const rocky = grp();
  L.setPreset('Jovian (H/He giant)'); L.applyDrivers();   // re-grep exact gas-giant preset name
  const jovian = grp();
  L.setFilter(false); const off = grp();
  L.setFilter(true);  const on  = grp();
  return { rocky, jovian, off, on };
}
```
Expected: `rocky` and `jovian` show different `(N)` counts (membership recomputes per preset); `off` → group hidden (display:none) so the helper returns the title text but the group is not shown — verify via screenshot that with filter OFF all features sit in their category groups and the Not-relevant group is gone; `on` → group reappears with a count. Screenshot (filter ON, Rocky): relevant features in Relief/Gradational/etc.; a closed `Not relevant to this world (N)` folder at the bottom of the right panel. Expand it (`click`) and confirm an irrelevant feature (e.g. `Magma ocean (F41)`) is inside and its enable toggle flips when clicked (force-enable still works).

- [ ] **Step 3.5: Commit.**
```bash
git add world-engine-lab.html
git commit -m "feat(lod-lab): collapse irrelevant features into Not-relevant group

applyArchetypeFilter now reparents feature folders between their category
group and a single collapsed 'Not relevant to this world (N)' group
(filter ON by default); relevant features restore in declaration order.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Regression sweep + close-out

- [ ] **Step 4.1: Confirm enable-all / solo / sweep paths are unaffected by reparenting.**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  L.setPreset('Rocky (Earthlike)'); L.applyDrivers();
  L.enableAllFeatures();                                  // legacy "enable all"
  const allOn = Object.keys(L.featureFolders).every(k => {
    const f = L.featureFolders[k];
    const c = f.controllers.find(c => /enabled$/i.test(c.property));
    return c ? c.getValue() === true : true;
  });
  L.setFilter(true);                                      // restore default
  return { allOn };
}
```
Expected: `allOn === true` — enable-all flips `state.*` enables regardless of which DOM group a folder currently lives in (visibility ≠ enable state). If false, investigate before proceeding.

- [ ] **Step 4.2: Full unit-test run.**

Run: `npx vitest run`
Expected: all green (GUI-only change; the only relevant pin is the `cityLightsEnabled` literal from Task 2).

- [ ] **Step 4.3: Final visual pass + record the seam.**

Screenshot the full lab. Confirm against the spec's Verification list: one World header, clean Envelope, self-contained bio/city folders, working Not-relevant group. Update `docs/NOW.md` (the ▶ SESSION 2026-06-15 block) noting the menu declutter Phase-1 landed (`VERIFIED_PENDING_MAX <sha>`), and that info-layer asks 2–4 remain.

- [ ] **Step 4.4: Commit the NOW.md update.**
```bash
git add docs/NOW.md
git commit -m "docs(now): lod-lab menu declutter Phase 1 verified-pending-Max

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (run by plan author)

**1. Spec coverage:**
- Spec "Left panel → World & rig" (consolidate selector+indicator, collapse rig folders) → **Task 1** (World folder; rig folders already default-collapsed in current code — Task 1 only adds World at top, doesn't expand others). ✔
- Spec "Right panel → dedicated bioMats/cityLights folders" → **Task 2**. ✔
- Spec "Filter behavior — collapsed Not-relevant group via reparenting" → **Task 3**. ✔
- Spec "Mechanics & risks: order preservation" → handled by re-appending in `FEATURE_LAYOUT` declaration order (Step 3.1/3.2). ✔
- Spec "filter default ON; enable-all/sweep unaffected" → **Task 4.1**. ✔
- Spec "Verification live on :9223; cityLights literal test green" → Steps 2.5, 4.2 + live checks throughout. ✔
- Spec "Out of scope: asks 2–4" → not in plan; noted in Step 4.3. ✔

**2. Placeholder scan:** No TBD/TODO/"handle edge cases". Two deliberate "re-grep the exact preset name" notes (gas-giant preset) are caution, not placeholder — the implementer reads the actual `DRIVER_PRESETS` keys. ✔

**3. Type/name consistency:** `fWorld`, `fBioMats`, `fCityLights`, `fNotRelevant`, `FEATURE_LAYOUT`, `applyArchetypeFilter`, `relevantFeatureSet`, `filterUI.filter`, `featureFolders` used consistently across tasks. `cityLightsEnabled` literal preserved verbatim (Task 2). ✔
