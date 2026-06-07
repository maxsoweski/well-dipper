# Lab Panel Split + Toggle-in-Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `planet-lod-lab.html`'s single lil-gui panel into a LEFT rig panel and a RIGHT feature panel, collapse the 14 feature folders by default, and move each feature's on/off toggle into its folder title bar.

**Architecture:** Two lil-gui instances (`guiLeft`, `guiRight`) replace the single `gui`; global iterate/save/reset calls route through `syncDisplays()`/`saveAll()`/`resetAll()` helpers. Each feature's existing boolean enable controller is *relocated* (its DOM node moved) into `folder.$title` so lil-gui's `updateDisplay()` keeps it synced for free. A standalone spike harness proves the relocation mechanism in lil-gui 0.21.0 before any production edit.

**Tech Stack:** three.js r183.1 (WebGL2), lil-gui 0.21.0, Vite dev server, vitest, chrome-devtools MCP on `:9223`.

**Verification note:** This is single-file DOM/UI wiring, not unit-testable logic. The gate is the **spike harness** + **browser verification matrix** on `:9223`; the existing vitest suite must stay green (it's untouched). Do NOT fabricate unit tests for visual behavior.

**Verified environment facts (confirmed live against the running lab, 2026-06-07 — selectors below depend on these):**
- lil-gui **0.21.0** (stock; George Michael Brower). 0.21.0 **prefixes every CSS class with `lil-`**. Structural selectors: root = `.lil-gui.lil-root`; folder = nested `.lil-gui`; **title = `.lil-title` (a `<button>`, holds a raw text node, no inner name span)**; collapsed state = the folder element gets class `.lil-closed`; child container = `.lil-children`; controller = `.lil-controller` (+ type, e.g. `.lil-boolean`); controller label = `.lil-name`; widget = `.lil-widget`.
- JS API confirmed present in the 0.21.0 dist: `folder.$title`, `folder.controllers` (array), `controller.property`, `controller.domElement`, `controller.updateDisplay()`, `gui.controllersRecursive()`.
- **This lab exposes `window._lab` (state, uniforms, …), NOT `window.__wd`.** `window.__wd` is the GAME's accessor; the lab uses `window._lab`. Read feature enables via `window._lab.state.<enableKey>` (e.g. `window._lab.state.cratersEnabled`).
- Custom classes this plan adds (`title-has-toggle` on the title button, `title-toggle` on the relocated controller) are unprefixed and ours; only lil-gui-internal selectors take the `lil-` prefix.

**Testing prerequisites (every browser step):**
- Max runs Vite — do NOT start servers. Check liveness with `mcp__chrome-devtools__list_pages`, never Bash curl (sandbox → `000`).
- Use the `:9223` GPU Chrome (`--remote-debugging-port=9223 --user-data-dir="C:\temp\chrome-mcp-filmstrip"`), not Playwright. See `memory/chrome-devtools-9223-launch.md` + `memory/well-dipper-testing-reference.md`.
- Do FULL setup in ONE `evaluate_script` immediately before each screenshot; park the tab on `about:blank` when done.
- Lab URL: `http://localhost:5173/well-dipper/planet-lod-lab.html`. Spike URL: `http://localhost:5173/well-dipper/planet-titletoggle-lab.html`.

**Git cautions (shared working tree — a warp session has uncommitted WIP):**
- NEVER `git add -A`. Stage ONLY the explicit files each task names.
- ONE `git add <paths> && git commit` per commit in a SINGLE Bash call (a hook unstages between separate calls).
- Sign-off every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Do NOT edit `docs/NOW.md` (warp WIP). Do NOT push (outward-facing; needs Max's OK + `dangerouslyDisableSandbox`).
- After editing `planet-lod-lab.html`, re-check backtick parity stays EVEN: `grep -o '`' planet-lod-lab.html | wc -l` (currently 30).

---

## Task 1: Spike harness — prove the controller-relocation mechanism

**Files:**
- Create: `planet-titletoggle-lab.html` (project root, beside `planet-lod-lab.html`)

This is the GATE. If checks 1–4 fail, fall back to mechanism (a) (hand-rolled `<input>` + explicit sync array) *in this same file* and prove it here before Task 2.

- [ ] **Step 1: Create the spike harness**

Create `planet-titletoggle-lab.html` with exactly this content:

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><title>title-toggle spike</title>
<style>
  body { margin:0; background:#111; }
  /* lil-title is a <button> holding a raw text node; space-between pushes the
     relocated checkbox to the right of the name. Name keeps the collapse click. */
  .lil-title.title-has-toggle { display:flex !important; align-items:center; justify-content:space-between; gap:6px; }
  .title-toggle { width:auto !important; min-width:0; }
  .title-toggle .lil-name { display:none; }        /* hide the boolean controller's own label */
  .title-toggle .lil-widget { min-width:0; }
</style></head>
<body>
<script type="module">
import GUI from 'lil-gui';
const state = { aEnabled:true, aFreq:3, bEnabled:false, bFreq:5 };
const gui = new GUI({ title:'title-toggle spike' });

const fA = gui.addFolder('Feature A'); fA.open();
fA.add(state,'aEnabled').name('enabled');
fA.add(state,'aFreq',1,10,1).name('freq');
const fB = gui.addFolder('Feature B'); fB.open();
fB.add(state,'bEnabled').name('enabled');
fB.add(state,'bFreq',1,10,1).name('freq');

function relocateEnableToTitle(folder, prop){
  const ctrl = folder.controllers.find(c => c.property === prop);
  const title = folder.$title;
  title.classList.add('title-has-toggle');
  ctrl.domElement.classList.add('title-toggle');
  ctrl.domElement.addEventListener('click', e => e.stopPropagation());
  title.appendChild(ctrl.domElement);   // move node out of body, into title
  return ctrl;
}
relocateEnableToTitle(fA, 'aEnabled');
relocateEnableToTitle(fB, 'bEnabled');

// Check 4 hook: flip state in code + resync display (mirrors the preset/solo path)
window.__spike = {
  state,
  flipAndSync(){ state.aEnabled = !state.aEnabled; state.bEnabled = !state.bEnabled;
    gui.controllersRecursive().forEach(c => c.updateDisplay()); },
};
</script>
</body></html>
```

- [ ] **Step 2: Confirm Vite is serving + the page loads clean**

Use `mcp__chrome-devtools__list_pages` to confirm `:9223` Chrome is up and Vite is reachable. Navigate to `http://localhost:5173/well-dipper/planet-titletoggle-lab.html`. Then:
Run (via `mcp__chrome-devtools__list_console_messages`): Expected: 0 errors.

- [ ] **Step 3: Verify checks 1–3 visually (one screenshot)**

In ONE `evaluate_script`, return the layout facts, then screenshot:
```js
() => {
  const titles = [...document.querySelectorAll('.lil-title.title-has-toggle')];
  return {
    titlesWithToggle: titles.length,                              // expect 2
    boxInTitle: titles.map(t => !!t.querySelector('.title-toggle input[type=checkbox]')), // expect [true,true]
  };
}
```
Expected: `{ titlesWithToggle: 2, boxInTitle: [true, true] }`. Screenshot shows each folder title with a checkbox to the right of the name.
- **Check 2 (manual via script):** click the relocated checkbox's input and confirm folder stays open:
```js
() => { const f = document.querySelectorAll('.lil-title.title-has-toggle')[0];
  const box = f.querySelector('input[type=checkbox]'); const openBefore = !f.parentElement.classList.contains('lil-closed');
  box.click(); const openAfter = !f.parentElement.classList.contains('lil-closed');
  return { stateAEnabled: window.__spike.state.aEnabled, folderStayedOpen: openBefore===openAfter, openAfter }; }
```
Expected: `stateAEnabled` flipped to `false`, `folderStayedOpen: true`.
- **Check 3:** click the title button itself (not the box) and confirm it DOES collapse:
```js
() => { const f = document.querySelectorAll('.lil-title.title-has-toggle')[0];
  const before = f.parentElement.classList.contains('lil-closed');
  f.click(); const after = f.parentElement.classList.contains('lil-closed');
  return { collapsedToggled: before!==after }; }
```
Expected: `{ collapsedToggled: true }`.

- [ ] **Step 4: Verify check 4 — programmatic flip resyncs the box**

```js
() => { const box = document.querySelectorAll('.lil-title.title-has-toggle')[0].querySelector('input[type=checkbox]');
  const before = box.checked; window.__spike.flipAndSync(); const after = box.checked;
  return { boxResynced: before !== after, after, stateMatches: after === window.__spike.state.aEnabled }; }
```
Expected: `boxResynced: true`, `stateMatches: true`. This proves `updateDisplay()` keeps the relocated box correct — the property Task 3 depends on. Park the tab on `about:blank`.

- [ ] **Step 5: Decision gate**

If all of 1–4 passed → mechanism (b) is GO; proceed to Task 2 with this `relocateEnableToTitle` + CSS verbatim.
If any failed → implement mechanism (a) in this file (a hand-rolled `<input type=checkbox>` appended to `folder.$title`, its `change` → `state[prop]`, plus a module-level `titleBoxes=[{prop,input}]` array and a `syncTitleBoxes()` that sets `input.checked=state[prop]`), re-verify checks 1–4 here, and carry that variant (plus its sync array) into Tasks 2–3 instead. Document which mechanism won in the commit message.

- [ ] **Step 6: Commit the spike**

```bash
git add planet-titletoggle-lab.html && git commit -m "$(cat <<'EOF'
spike(lab): prove lil-gui title-bar toggle via controller relocation

Standalone harness verifying mechanism (b): relocate a boolean controller's
DOM into folder.$title, isolate its click, and confirm updateDisplay() keeps
it synced. Gates the planet-lab panel-split work.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Split the single GUI into guiLeft + guiRight with helpers

**Files:**
- Modify: `planet-lod-lab.html` — `new GUI` at ~1978; folder `addFolder` calls at 1984/1987/2001/2008/2150/2155/2400/2406; global calls at 2147/2371/2387/2407/2408/2468.

Goal of this task: identical behavior, two panels. NO toggle relocation yet, NO collapse change yet — that's Task 3. This isolates the refactor so a regression is easy to bisect.

- [ ] **Step 1: Replace the single GUI with two positioned instances + helpers**

At line ~1978, replace:
```js
    const gui = new GUI({ title: 'PLANET LOD LAB — foundation' });
```
with:
```js
    // Two panels (design 2026-06-07): LEFT = the rig, RIGHT = the rendered features.
    const guiLeft  = new GUI({ title: 'PLANET LOD LAB — rig' });
    guiLeft.domElement.style.left = '0px';
    guiLeft.domElement.style.right = 'auto';
    const guiRight = new GUI({ title: 'Features' });   // lil-gui default: pinned top-right
    // Global panel ops must span BOTH guis (single-logical-model helpers).
    const allGuis = [guiLeft, guiRight];
    function syncDisplays(){ for (const g of allGuis) g.controllersRecursive().forEach(c => c.updateDisplay()); }
    function saveAll(){ const a = guiLeft.save(), b = guiRight.save();
      return { controllers: { ...a.controllers, ...b.controllers }, folders: { ...a.folders, ...b.folders } }; }
    function resetAll(){ guiLeft.reset(); guiRight.reset(); }
```

- [ ] **Step 2: Route folders to the correct GUI**

Change these folder-creation lines so LEFT folders use `guiLeft` and the RIGHT folder uses `guiRight`:
- Line ~1984: `const fFilter = gui.addFolder('Body filter');` → `guiLeft.addFolder('Body filter');`
- Line ~1987: `const fView = gui.addFolder('View & LOD');` → `guiLeft.addFolder('View & LOD');`
- Line ~2001: `const fDebug = gui.addFolder('Debug — voronoi3d spike');` → `guiLeft.addFolder(...)`
- Line ~2008: `const fEnv = gui.addFolder('Envelope');` → `guiLeft.addFolder('Envelope');`
- Line ~2150: `const fDrivers = gui.addFolder('Drivers');` → `guiLeft.addFolder('Drivers');`
- Line ~2155: `const fRelief = gui.addFolder('Surface — Relief');` → **`guiRight.addFolder('Surface — Relief');`**
- Line ~2400: `const fSeeds = gui.addFolder('Seeds');` → `guiLeft.addFolder('Seeds');`
- Line ~2406: `const fPresets = gui.addFolder('Presets');` → `guiLeft.addFolder('Presets');`

(The 14 feature sub-folders are added to `fRelief` via `fRelief.addFolder(...)` — they ride along to `guiRight` automatically, no change needed.)

- [ ] **Step 3: Replace the 4 global iterate calls**

At lines ~2147, ~2371, ~2387, ~2468, replace each:
```js
      gui.controllersRecursive().forEach(c => c.updateDisplay());
```
with:
```js
      syncDisplays();
```

- [ ] **Step 4: Replace save/reset in Presets**

Line ~2407: `const j = JSON.stringify(gui.save());` → `const j = JSON.stringify(saveAll());`
Line ~2408: `gui.reset(); rebuildTarget(); updateSeedUniforms();` → `resetAll(); rebuildTarget(); updateSeedUniforms();`

- [ ] **Step 5: Confirm no stray `gui.` references remain**

Run: `grep -n '\bgui\.' planet-lod-lab.html`
Expected: NO matches (every `gui.` is now `guiLeft.`, `guiRight.`, or a helper). If any remain, fix them. Also confirm the local variable names `guiLeft`/`guiRight` aren't shadowed elsewhere: `grep -n 'guiLeft\|guiRight' planet-lod-lab.html` should show only the intended sites.

- [ ] **Step 6: Browser verify — two panels, behavior intact**

Confirm `:9223` up via `mcp__chrome-devtools__list_pages`; navigate to the lab URL. In ONE `evaluate_script` before a screenshot, return:
```js
() => {
  const guis = [...document.querySelectorAll('.lil-gui.lil-root')];
  const rects = guis.map(g => ({ title: g.querySelector('.lil-title')?.textContent, left: Math.round(g.getBoundingClientRect().left) }));
  return { rootPanels: guis.length, rects };
}
```
Expected: `rootPanels: 2`; one panel titled `PLANET LOD LAB — rig` with `left ≈ 0`, one titled `Features` with `left` near the right edge. Screenshot shows two panels, no overlap. Console: 0 errors. Spot-check a preset switch (Drivers → e.g. Lava) still updates the panel (`.listen()` fields move). Park tab on `about:blank`.

- [ ] **Step 7: Backtick parity + commit**

Run: `grep -o '`' planet-lod-lab.html | wc -l` → Expected: even (30 unless a literal changed; this task adds none).
```bash
git add planet-lod-lab.html && git commit -m "$(cat <<'EOF'
refactor(lab): split panel into guiLeft (rig) + guiRight (features)

Two lil-gui roots replace the single gui; global iterate/save/reset route
through syncDisplays/saveAll/resetAll. Surface—Relief (perturb + 14 features)
moves to the right panel; everything else stays left. Behavior unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Collapse the 14 features + relocate each toggle into its title

**Files:**
- Modify: `planet-lod-lab.html` — the 14 `f<X>.open()` calls (2159–2356); add CSS to the `<style>` block (~line 89); add the relocation loop after the `featureFolders` map (~2365).

- [ ] **Step 1: Add the title-toggle CSS**

In the `<style>` block (before `</style>` at ~line 90), add:
```css
    /* title-bar feature toggle (design 2026-06-07): relocated lil-gui boolean
       controller sits inline right of the folder name. lil-title is a <button>
       holding a raw text node; space-between pushes the checkbox to the right.
       Clicking the name still collapses; the checkbox stops propagation (JS). */
    .lil-gui .lil-title.title-has-toggle { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .lil-gui .title-toggle { width: auto; min-width: 0; }
    .lil-gui .title-toggle .lil-name { display: none; }   /* hide the controller's own '✓ enabled' label */
    .lil-gui .title-toggle .lil-widget { min-width: 0; }
```
(Use the exact CSS the spike settled on if it differs.)

- [ ] **Step 2: Collapse the 14 feature folders by default**

For each of the 14 folder-creation lines, change `.open()` → `.close()`. Exact lines (the `fRelief.addFolder('…').open()` style is on the SAME line as the `const f… =`):
- 2159 `fCraters`, 2171 `fEjecta`, 2182 `fMountains`, 2194 `fCanyons`, 2209 `fScarps`, 2225 `fPlateaus`, 2237 `fTessera`, 2252 `fEdifices`, 2265 `fLava`, 2281 `fChaos`, 2292 `fCryoRidge`, 2306 `fFrost`, 2326 `fSub`, 2343 `fGlacial`.
Leave `fRelief` itself `.open()` (line 2155) so the collapsed list is visible. Use `replace_all`-safe edits: each line's `const f<Name> = fRelief.addFolder('<label>'); f<Name>.open();` → `…; f<Name>.close();`.

- [ ] **Step 3: Add the relocation loop**

After the `featureFolders` map and BEFORE/around the existing solo-button loop (~line 2389), add the relocation. Insert this block right after the `featureFolders` object literal (after line ~2365):
```js
    // Move each feature's enable controller out of the folder body and into its
    // title bar (design 2026-06-07, mechanism b). The controller stays in the
    // gui tree, so syncDisplays()/updateDisplay() keeps the title box synced when
    // presets/solo/enable-all flip enables. stopPropagation → toggling the box
    // doesn't collapse the folder.
    function relocateEnableToTitle(folder, prop){
      const ctrl = folder.controllers.find(c => c.property === prop);
      if (!ctrl) return;
      const title = folder.$title;
      title.classList.add('title-has-toggle');
      ctrl.domElement.classList.add('title-toggle');
      ctrl.domElement.addEventListener('click', e => e.stopPropagation());
      title.appendChild(ctrl.domElement);
    }
    for (const [key, folder] of Object.entries(featureFolders)) {
      relocateEnableToTitle(folder, FEATURES[key].enableKey);
    }
```
(No need to touch the `f<X>.add(state,'<x>Enabled').name('✓ enabled')` lines — the controller is created there and merely moved here. Its `.name('✓ enabled')` label is hidden by the `.title-toggle > .name { display:none }` CSS.)

- [ ] **Step 4: Browser verify — collapsed list + working title toggles + resync**

Confirm `:9223` up; navigate to the lab URL. In ONE `evaluate_script` before a screenshot:
```js
() => {
  const right = [...document.querySelectorAll('.lil-gui.lil-root')].find(g => /Features/.test(g.querySelector('.lil-title')?.textContent||''));
  const featTitles = [...right.querySelectorAll('.lil-children .lil-title.title-has-toggle')];
  const allCollapsed = featTitles.every(t => t.parentElement.classList.contains('lil-closed'));
  const allHaveBox = featTitles.every(t => !!t.querySelector('.title-toggle input[type=checkbox]'));
  return { featureFolders: featTitles.length, allCollapsed, allHaveBox };  // expect 14, true, true
}
```
Expected: `{ featureFolders: 14, allCollapsed: true, allHaveBox: true }`. Screenshot: right panel = `Surface — Relief` open, `perturb` slider, then 14 collapsed rows each with a checkbox by the name.
- **Toggle works + folder stays collapsed:**
```js
() => { const right=[...document.querySelectorAll('.lil-gui.lil-root')].find(g=>/Features/.test(g.querySelector('.lil-title')?.textContent||''));
  const t = right.querySelector('.lil-children .lil-title.title-has-toggle'); const box=t.querySelector('input[type=checkbox]');
  const wasClosed=t.parentElement.classList.contains('lil-closed'); const v0=window._lab.state.cratersEnabled;
  box.click(); return { stayedClosed: wasClosed && t.parentElement.classList.contains('lil-closed'),
    enableFlipped: window._lab.state.cratersEnabled !== v0 }; }
```
Expected: `stayedClosed: true`, `enableFlipped: true`.
- **Resync after preset+solo:** set Drivers preset to a different value and click one feature's `🔆 solo`, then read several title boxes' `.checked` and confirm they match `state[enableKey]` (only the soloed one checked). Expected: title boxes reflect the solo state (proves the `updateDisplay()` resync path). Console: 0 errors. Park tab on `about:blank`.

- [ ] **Step 5: Run the existing unit suite (must stay green)**

Run: `npm test`
Expected: full suite PASS (planet-archetypes.test.js included) — this task changed only panel DOM wiring, no logic.

- [ ] **Step 6: Backtick parity + commit**

Run: `grep -o '`' planet-lod-lab.html | wc -l` → Expected: even (still 30 — no template-literal change).
```bash
git add planet-lod-lab.html && git commit -m "$(cat <<'EOF'
feat(lab): collapse feature folders + move enable toggle into title bar

The 14 Surface—Relief feature folders default collapsed; each feature's enable
controller is relocated into its folder title (mechanism b) so you can toggle
features on/off from the collapsed list. Reuses featureFolders + FEATURES.enableKey.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Final integration pass

**Files:** none (verification only).

- [ ] **Step 1: Full verification matrix on `:9223`**

Confirm `:9223` up; navigate to the lab URL. Do one consolidated `evaluate_script` + screenshot covering the design's test matrix:
- Two panels render, left-pinned rig + right-pinned features, no overlap.
- 14 feature folders collapsed; each shows a title checkbox.
- Toggling a title checkbox enables/disables that feature (visible change via `window._lab.state`) and does not collapse the folder.
- Switch Drivers preset, then `🔆 solo` one feature → title checkboxes resync to the new enable set.
- `Body filter → filter to relevant` still shows/hides the right-column folders.
- `Presets → Reset to defaults` restores both panels (resetAll) without console errors.
- 0 console errors throughout.
Park tab on `about:blank` when done.

- [ ] **Step 2: Report results to Max**

Summarize: spike outcome (which mechanism won), the two-panel result, screenshot, and the verification matrix pass/fail. This is lab-internal tooling — Max does final UAT. Do NOT push (his call).
