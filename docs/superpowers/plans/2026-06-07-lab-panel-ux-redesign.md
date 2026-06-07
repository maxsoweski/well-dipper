# Planet-lab control-panel UX redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `planet-lod-lab.html`'s single vertical lil-gui panel so selecting a body archetype (via the Drivers preset) filters the panel to that archetype's relevant feature folders, and each feature folder gets a SOLO button that isolates it (zeroes the other 13 enables in one click).

**Architecture:** Author the archetype→feature taxonomy ONCE as a standalone ES module `planet-archetypes.js` (FEATURES + ARCHETYPES + `featuresOf()`), shaped so a future Stage-D provinces system can read it (data-only, no Stage-D code now). The lab imports it: captures its 14 existing feature-folder refs into a `featureFolders` map, appends a shared `solo` button to each, and adds a top "Body filter" folder (archetype label + filter toggle + enable-all/clear-solo) wired into the existing `applyDrivers` preset path. Minimum change — each feature folder's existing control block stays exactly as-is.

**Tech Stack:** three.js r183.1 / WebGL2, lil-gui 0.21.0 (folders are `GUI` instances exposing `.show()/.hide()` — §7 risk resolved), Vitest (data-integrity unit tests), chrome-devtools MCP on `:9223` GPU Chrome (behaviour verification).

---

## File Structure

- **Create:** `planet-archetypes.js` (repo root, beside `planet-lod-lab-core.js`) — the shared taxonomy: `FEATURES`, `ARCHETYPES`, `featuresOf()`. Pure ESM, no DOM deps (so Vitest can import it directly).
- **Create:** `tests/planet-archetypes.test.js` — data-integrity drift guards. Imports the module; ALSO reads `planet-lod-lab.html` as text to cross-check that FEATURES enable-keys match the panel's actual `*Enabled` bindings and ARCHETYPES presets match the panel's `DRIVER_PRESETS`.
- **Modify:** `planet-lod-lab.html` — (1) add the import; (2) add a top "Body filter" folder placeholder right after the GUI is constructed; (3) after the 14 feature folders are built, add the `featureFolders` map + `solo`/filter helpers + per-folder solo buttons + header controls; (4) call the filter from `applyDrivers`; (5) extend `window._lab` with test hooks.

### Confirmed code anchors (from this session's recon — exact, no re-grep needed)
- Import block: `planet-lod-lab.html:10-12` (`import GUI from 'lil-gui';` at line 11, core module import at 12).
- `const gui = new GUI(...)` at **line 1977**.
- `applyDrivers` function body ends at **line 2140-2141** (`gui.controllersRecursive().forEach(c => c.updateDisplay());` then `}`). `const fDrivers` at 2142, preset dropdown at 2143.
- 14 feature folder refs, in build order (lines ~2151–2348): `fCraters` `fEjecta` `fMountains` `fCanyons` `fScarps` `fPlateaus` `fTessera` `fEdifices` `fLava` `fChaos` `fCryoRidge` `fFrost` `fSub` `fGlacial`. Last one (`fGlacial`) finishes at **line 2348**.
- `fSeeds` at 2351, `fPresets` at 2357, `applyDrivers()` initial call at **line 2361**.
- `window._lab = { ... }` at **lines 2673-2677**.
- **FEATURES key vs folder var mismatch to bridge:** FEATURES key `sublimation` ↔ folder var `fSub` ↔ enableKey `subEnabled`. All other keys match their folder var stem. The `featureFolders` map handles the bridge.

---

## Task 1: The shared taxonomy module + data-integrity tests (TDD)

**Files:**
- Create: `tests/planet-archetypes.test.js`
- Create: `planet-archetypes.js`

- [ ] **Step 1: Write the failing test**

Create `tests/planet-archetypes.test.js`:

```js
// Data-integrity drift guards for planet-archetypes.js — the shared archetype
// taxonomy the lab panel (and a future Stage-D provinces system) reads. These
// tests cross-check the taxonomy against the LIVE panel source (planet-lod-lab.html)
// so a feature added/renamed in the lab can't silently drift from this map.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FEATURES, ARCHETYPES, featuresOf } from '../planet-archetypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const labSrc = readFileSync(path.resolve(__dirname, '../planet-lod-lab.html'), 'utf8');

// The enable-keys the panel actually binds, e.g. `.add(state, 'cratersEnabled')`.
const panelEnableKeys = new Set(
  [...labSrc.matchAll(/\.add\(state, '(\w+Enabled)'\)/g)].map(m => m[1])
);
// The DRIVER_PRESETS keys: each preset object opens with `radiusEarth:`.
const presetBlock = labSrc.slice(
  labSrc.indexOf('const DRIVER_PRESETS = {'),
  labSrc.indexOf('const driverUI =')
);
const panelPresetKeys = new Set(
  [...presetBlock.matchAll(/'([^']+)':\s*\{\s*radiusEarth/g)].map(m => m[1])
);

describe('FEATURES ↔ panel enable-keys', () => {
  it('every FEATURES enableKey is bound in the panel', () => {
    for (const k of Object.keys(FEATURES)) {
      expect(panelEnableKeys.has(FEATURES[k].enableKey)).toBe(true);
    }
  });
  it('every panel enable-key has exactly one FEATURES entry (no orphan folders)', () => {
    const featureEnableKeys = Object.values(FEATURES).map(f => f.enableKey);
    expect(new Set(featureEnableKeys).size).toBe(featureEnableKeys.length); // no dupes
    for (const ek of panelEnableKeys) {
      expect(featureEnableKeys).toContain(ek);
    }
  });
});

describe('ARCHETYPES integrity', () => {
  it('every FEATURES.archetypes entry is a real ARCHETYPES key', () => {
    for (const k of Object.keys(FEATURES)) {
      for (const a of FEATURES[k].archetypes) {
        expect(ARCHETYPES).toHaveProperty(a);
      }
    }
  });
  it('every ARCHETYPES.presets entry is a real panel DRIVER_PRESETS key', () => {
    for (const a of Object.keys(ARCHETYPES)) {
      for (const p of ARCHETYPES[a].presets) {
        expect(panelPresetKeys.has(p)).toBe(true);
      }
    }
  });
  it('every archetype has at least one feature (featuresOf non-empty)', () => {
    for (const a of Object.keys(ARCHETYPES)) {
      expect(featuresOf(a).length).toBeGreaterThan(0);
    }
  });
  it('every feature belongs to at least one archetype (no orphans)', () => {
    for (const k of Object.keys(FEATURES)) {
      expect(FEATURES[k].archetypes.length).toBeGreaterThan(0);
    }
  });
});

describe('featuresOf inversion round-trips', () => {
  it('a feature listing archetype A appears in featuresOf(A)', () => {
    for (const k of Object.keys(FEATURES)) {
      for (const a of FEATURES[k].archetypes) {
        expect(featuresOf(a)).toContain(k);
      }
    }
  });
  it('featuresOf returns only keys that list that archetype', () => {
    for (const a of Object.keys(ARCHETYPES)) {
      for (const k of featuresOf(a)) {
        expect(FEATURES[k].archetypes).toContain(a);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/planet-archetypes.test.js`
Expected: FAIL — `Cannot find module '../planet-archetypes.js'` (module not created yet).

- [ ] **Step 3: Create the module**

Create `planet-archetypes.js` (verbatim from spec §3 — already verified against the live panel this session):

```js
// Shared archetype taxonomy for the planet lab panel — and the source of truth a
// future Stage-D geologic-provinces system will read (DATA ONLY here; no Stage-D
// spatial/combiner code). Each FEATURE declares its identity + archetype membership
// (single source per feature); archetype→feature subsets fall out by inversion via
// featuresOf() — no second place to drift.
export const FEATURES = {
  craters:    { label: 'Craters (F2)',          enableKey: 'cratersEnabled',   archetypes: ['impact-airless'] },
  ejecta:     { label: 'Ejecta & Rays (F3)',    enableKey: 'ejectaEnabled',    archetypes: ['impact-airless'] },
  scarps:     { label: 'Scarps (F5)',           enableKey: 'scarpsEnabled',    archetypes: ['impact-airless','tectonic-terrestrial'] },
  mountains:  { label: 'Mountains (F1)',        enableKey: 'mountainsEnabled', archetypes: ['tectonic-terrestrial'] },
  canyons:    { label: 'Canyons (F4)',          enableKey: 'canyonsEnabled',   archetypes: ['tectonic-terrestrial'] },
  plateaus:   { label: 'Plateaus (F6)',         enableKey: 'plateausEnabled',  archetypes: ['tectonic-terrestrial'] },
  tessera:    { label: 'Tessera (F6)',          enableKey: 'tesseraEnabled',   archetypes: ['tectonic-terrestrial'] },
  edifices:   { label: 'Edifices (F7)',         enableKey: 'edificesEnabled',  archetypes: ['volcanic'] },
  lava:       { label: 'Lava plains (F8)',      enableKey: 'lavaEnabled',      archetypes: ['volcanic'] },
  chaos:      { label: 'Chaos (F9)',            enableKey: 'chaosEnabled',     archetypes: ['icy-active'] },
  cryoRidge:  { label: 'Ridged icy (F10)',      enableKey: 'cryoRidgeEnabled', archetypes: ['icy-active'] },
  frost:      { label: 'Cryo / Frost (F23/F22)',enableKey: 'frostEnabled',     archetypes: ['volatile-cold'] },
  sublimation:{ label: 'Sublimation (F18)',     enableKey: 'subEnabled',       archetypes: ['volatile-cold'] },
  glacial:    { label: 'Glacial (F17)',         enableKey: 'glacialEnabled',   archetypes: ['volatile-cold'] },
};

// Each ARCHETYPE carries its human metadata + which lab presets exemplify it.
// Feature membership is DERIVED by inverting FEATURES (no duplication).
export const ARCHETYPES = {
  'impact-airless':       { label: 'Impact / airless',       bodies: ['Moon','Mercury'],              presets: ['Frozen (airless)'] },
  'tectonic-terrestrial': { label: 'Tectonic / terrestrial', bodies: ['Earth','Venus'],               presets: ['Rocky (Earthlike)','Ocean (temperate)'] },
  'volcanic':             { label: 'Volcanic',               bodies: ['Io','Mars'],                   presets: ['Lava (hot airless)'] },
  'icy-active':           { label: 'Icy-active',             bodies: ['Europa','Ganymede'],           presets: ['Europa (icy moon)'] },
  'volatile-cold':        { label: 'Volatile / cold',        bodies: ['Pluto','Triton','Mars poles'], presets: ['Titan (methane seas)','Frozen (airless)'] },
};

// Derived helper (also what Stage-D will call): the archetype→feature-subset map.
export const featuresOf = (archKey) =>
  Object.entries(FEATURES).filter(([, f]) => f.archetypes.includes(archKey)).map(([k]) => k);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/planet-archetypes.test.js`
Expected: PASS — all describe blocks green (cross-checks against the live panel succeed).

- [ ] **Step 5: Commit**

```bash
git add planet-archetypes.js tests/planet-archetypes.test.js && git commit -m "$(cat <<'EOF'
feat(lab): add planet-archetypes taxonomy + data-integrity tests

Shared FEATURES/ARCHETYPES/featuresOf() source of truth for the lab
panel filter (and future Stage-D provinces). Tests cross-check the
taxonomy against the live panel's enable-keys + DRIVER_PRESETS to
guard drift.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire the panel — filter + solo (no shader/generator change)

**Files:**
- Modify: `planet-lod-lab.html:12` (add import)
- Modify: `planet-lod-lab.html:1977` (top "Body filter" folder placeholder)
- Modify: `planet-lod-lab.html:2140` (call filter from `applyDrivers`)
- Modify: `planet-lod-lab.html:2348` (wiring block after the feature folders)
- Modify: `planet-lod-lab.html:2673` (`window._lab` test hooks)

> No Vitest unit covers this (the `state` object lives in the HTML, not importable). Correctness is verified by the existing 205 tests staying green (Step 6) + chrome-devtools behaviour (Task 3). The data-integrity test from Task 1 already guards the map this wiring depends on.

- [ ] **Step 1: Add the import**

After `planet-lod-lab.html:12` (`import { ... deriveUniforms } from './planet-lod-lab-core.js';`), add:

```js
    import { FEATURES, ARCHETYPES, featuresOf } from './planet-archetypes.js';
```

- [ ] **Step 2: Add the top "Body filter" folder placeholder**

Immediately after `const gui = new GUI({ title: 'PLANET LOD LAB — foundation' });` (line 1977), insert:

```js

    // ▸ Body filter — archetype-driven panel filtering + per-feature solo
    // (planet-archetypes.js). Created here so it sits at the TOP of the panel;
    // its controls are added below, once the feature folders exist.
    const filterUI = { filter: true, archetypeLabel: '—' };
    const fFilter = gui.addFolder('Body filter'); fFilter.open();
```

- [ ] **Step 3: Add the wiring block after the feature folders**

Immediately after `fGlacial` folder construction finishes (after line 2348, before the `// ▸ Seeds` comment at 2350), insert:

```js

    // ── Archetype filter + per-feature solo ──────────────────────────────────
    // Bridge FEATURES keys → existing folder refs (note: sublimation ↔ fSub).
    const featureFolders = {
      craters: fCraters, ejecta: fEjecta, mountains: fMountains, canyons: fCanyons,
      scarps: fScarps, plateaus: fPlateaus, tessera: fTessera, edifices: fEdifices,
      lava: fLava, chaos: fChaos, cryoRidge: fCryoRidge, frost: fFrost,
      sublimation: fSub, glacial: fGlacial,
    };
    // soloKey=null → enable ALL features; otherwise enable ONLY that feature.
    function setFeatureEnables(soloKey){
      for (const k of Object.keys(FEATURES)) {
        state[FEATURES[k].enableKey] = (soloKey === null) || (k === soloKey);
      }
      gui.controllersRecursive().forEach(c => c.updateDisplay());
    }
    // The relevant feature set = UNION of featuresOf() over every archetype whose
    // presets include the current Drivers preset (Frozen maps to two → union).
    function relevantFeatureSet(){
      const archs = Object.keys(ARCHETYPES).filter(a => ARCHETYPES[a].presets.includes(driverUI.preset));
      const set = new Set();
      for (const a of archs) for (const k of featuresOf(a)) set.add(k);
      return { set, archs };
    }
    function applyArchetypeFilter(){
      const { set, archs } = relevantFeatureSet();
      filterUI.archetypeLabel = archs.map(a => ARCHETYPES[a].label).join(' + ') || '(none)';
      for (const [key, folder] of Object.entries(featureFolders)) {
        if (!filterUI.filter || set.has(key)) folder.show(); else folder.hide();
      }
      gui.controllersRecursive().forEach(c => c.updateDisplay());
    }
    // One 🔆 solo button per feature folder (appended below its existing controls).
    for (const [key, folder] of Object.entries(featureFolders)) {
      folder.add({ solo(){ setFeatureEnables(key); } }, 'solo').name('🔆 solo (isolate)');
    }
    // Header controls live in the top fFilter folder.
    fFilter.add(filterUI, 'archetypeLabel').name('archetype').disable();
    fFilter.add(filterUI, 'filter').name('filter to relevant').onChange(applyArchetypeFilter);
    fFilter.add({ enableAll(){ setFeatureEnables(null); } }, 'enableAll').name('enable all');
    fFilter.add({ clearSolo(){ setFeatureEnables(null); } }, 'clearSolo').name('clear solo');
```

- [ ] **Step 4: Call the filter from `applyDrivers`**

In `applyDrivers` (ends line 2140), change the final line from:

```js
      gui.controllersRecursive().forEach(c => c.updateDisplay());
    }
```

to:

```js
      gui.controllersRecursive().forEach(c => c.updateDisplay());
      applyArchetypeFilter();   // preset changed → re-derive relevant archetype + re-filter
    }
```

(`applyArchetypeFilter` is a hoisted function declaration, so this forward reference is fine; the initial `applyDrivers()` at line 2361 runs after the wiring block defines it, so the panel loads already filtered to the default Rocky preset's tectonic features.)

- [ ] **Step 5: Extend `window._lab` with behaviour-test hooks**

In `window._lab = { ... }` (lines 2673-2677), add these members (e.g. after `setQuality`):

```js
                    solo(key){ setFeatureEnables(key); }, enableAllFeatures(){ setFeatureEnables(null); },
                    setFilter(on){ filterUI.filter = on; applyArchetypeFilter(); },
                    featureVisible(key){ return !featureFolders[key]._hidden; },
                    featureEnabled(key){ return !!state[FEATURES[key].enableKey]; },
                    featureFolders, filterUI,
```

- [ ] **Step 6: Run the existing lab tests — must stay green**

Run: `npx vitest run tests/planet-lod-*.test.js tests/planet-archetypes.test.js`
Expected: PASS — the 205 existing lab tests unchanged (no shader/generator touched) + the new data-integrity suite. Note the new suite reads `planet-lod-lab.html`, so if a typo broke an enable-key binding, it fails here.

- [ ] **Step 7: Backtick parity sanity check (shader region untouched, but cheap to confirm)**

Run: `grep -o '`' planet-lod-lab.html | wc -l`
Expected: `30` (even — unchanged; this task adds no shader-string backticks).

- [ ] **Step 8: Commit**

```bash
git add planet-lod-lab.html && git commit -m "$(cat <<'EOF'
feat(lab): archetype-filtered panel + per-feature solo buttons

Selecting a Drivers preset now filters the feature folders to that
body archetype's relevant features (union over archetypes sharing the
preset). Each feature folder gets a 🔆 solo button that isolates it by
zeroing the other 13 enables. Top "Body filter" folder holds the
archetype label + filter toggle + enable-all/clear-solo. Panel-only —
no shader/generator change. Reads planet-archetypes.js.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Behaviour verification on :9223 GPU Chrome

**Files:** none (verification only). Per the testing-harness gotcha, do FULL setup in ONE `evaluate_script` immediately before each screenshot; park the tab on `about:blank` when done. Lab at `http://localhost:5173/well-dipper/planet-lod-lab.html`. Max runs Vite — do NOT start a server. Confirm `:9223` liveness with `mcp__chrome-devtools__list_pages` (NOT Bash curl → 000 in sandbox). See `memory/well-dipper-testing-reference.md` + `chrome-devtools-9223-launch.md` first.

- [ ] **Step 1: Confirm :9223 is live and load the lab**

Use `mcp__chrome-devtools__list_pages`. If no `:9223` Chrome, ask Max to launch it (`--remote-debugging-port=9223 --user-data-dir="C:\temp\chrome-mcp-filmstrip"`). Navigate a page to the lab URL.

- [ ] **Step 2: Filter behaviour — assert via `window._lab`, not pixels**

Run one `evaluate_script` that exercises each preset and returns the visible/enabled sets:

```js
const L = window._lab;
const out = {};
for (const p of ['Rocky (Earthlike)','Lava (hot airless)','Europa (icy moon)','Frozen (airless)']) {
  L.setPreset(p);                       // triggers applyDrivers → applyArchetypeFilter
  out[p] = {
    archetype: L.filterUI.archetypeLabel,
    visible: Object.keys(L.featureFolders).filter(k => L.featureVisible(k)),
  };
}
return out;
```

Expected (the drift check, by archetype membership in the spec):
- `Rocky (Earthlike)` → archetype "Tectonic / terrestrial"; visible = `[scarps, mountains, canyons, plateaus, tessera]`.
- `Lava (hot airless)` → "Volcanic"; visible = `[edifices, lava]`.
- `Europa (icy moon)` → "Icy-active"; visible = `[chaos, cryoRidge]`.
- `Frozen (airless)` → "Impact / airless + Volatile / cold" (UNION); visible = `[craters, ejecta, scarps, frost, sublimation, glacial]`.

- [ ] **Step 3: Filter OFF reveals all 14**

```js
const L = window._lab;
L.setPreset('Europa (icy moon)'); L.setFilter(false);
return Object.keys(L.featureFolders).filter(k => L.featureVisible(k)).length; // expect 14
L.setFilter(true);
```

Expected: `14`.

- [ ] **Step 4: SOLO isolates — enables + visual**

```js
const L = window._lab;
L.setPreset('Rocky (Earthlike)'); L.setFilter(false); L.solo('mountains');
return Object.keys(L.featureFolders).map(k => [k, L.featureEnabled(k)]);
```

Expected: only `mountains` → `true`; the other 13 → `false`. Then take a screenshot (full setup + `state.distance` set close in the SAME script as the prior gotcha requires) and confirm the render shows mountains alone. `L.enableAllFeatures()` restores all → confirm all 14 enables `true` again.

- [ ] **Step 5: Park the tab + report**

Navigate the `:9223` tab to `about:blank` (Max's GPU). Summarize the four-preset filter table + solo result to Max.

---

## Self-Review (run after writing — done)

**Spec coverage:** §3 data artifact → Task 1. §4 filter toggle + solo + manual-override (filter OFF reveals all) → Task 2 Steps 2-4 + Task 3 Steps 3-4. §4 union rule (Frozen → two archetypes) → `relevantFeatureSet` + Task 3 Step 2 Frozen case. §5 minimum-change registry (capture refs + append solo, no control rebuild) → Task 2 Step 3. §6 data-integrity tests → Task 1; behaviour tests → Task 3; existing 205 green → Task 2 Step 6. §7 lil-gui `.show()/.hide()` → resolved (0.21 folders are GUI instances with these methods; no fallback needed). §7 don't-wire-Stage-D → module is data-only, no province fields.

**Placeholder scan:** none — every code step shows complete content.

**Type consistency:** `setFeatureEnables(soloKey|null)` used consistently for solo + enable-all + clear-solo. `applyArchetypeFilter` / `relevantFeatureSet` / `featureFolders` / `filterUI` names consistent across Task 2 + Task 3 + `window._lab`. FEATURES key `sublimation` ↔ `fSub` bridged only in the `featureFolders` map (the one place it must be).
