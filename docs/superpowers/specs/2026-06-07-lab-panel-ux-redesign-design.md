# Design — Planet-lab control-panel UX redesign (archetype-filtered + per-feature solo)

**Date:** 2026-06-07 · **Project:** `~/projects/well-dipper` · **Target file:** `planet-lod-lab.html` (+ a new
small data module) · **Status:** DESIGN APPROVED (Max, via brainstorming 2026-06-07). Build deferred to a
fresh session per Max's request — this spec is the blueprint that session executes.

---

## 1. Problem

`planet-lod-lab.html` drives every planet-rendering feature through ONE vertical lil-gui panel. It now holds
~16 feature sub-folders under `Surface — Relief` (Craters F2, Ejecta F3, Mountains F1, Canyons F4, Scarps F5,
Plateaus F6, Tessera F6, Edifices F7, Lava F8, Chaos F9, Ridged-icy F10, Frost F23/F22, Sublimation F18,
Glacial F17), plus View&LOD, Debug, Envelope, Drivers, Seeds, Presets. Two pains, confirmed with Max as
**equally** important:

1. **Isolation loop** — seeing ONE feature alone means manually toggling ~13 other `*Enabled` off, every time.
2. **Composition loop** — checking how a body archetype's *relevant* features look together means hunting the
   relevant 3–5 features scattered among 16 folders.

It only gets worse as the remaining 7 domains (Bands, Clouds, Fluvial, Aeolian, Optical, Exotic, …) fan out.

## 2. Goals / non-goals

**Goals**
- Pick a body archetype → panel **filters to that archetype's relevant features** (composition loop).
- Per-feature **SOLO** button → one click isolates a feature by zeroing every *other* feature's enable
  (isolation loop). One click instead of 13.
- The archetype→features grouping is authored ONCE as a **shared, standalone data artifact** shaped so the
  planned Stage-D geologic-provinces system can consume it later (Max's call: shared source of truth, DRY).

**Non-goals (YAGNI — explicitly out of scope for this build)**
- **No Stage-D spatial/province code.** We author the *taxonomy data* only; no `provinceWeight()` field, no
  spatial mask, no combiner retrofits. (Stage-D stays a separate `dev-collab-scope` job.)
- **No Tweakpane swap.** Stay in lil-gui (Max chose Option 1). Reuse all ~60 existing controls untouched.
- **No new save/load scenarios** beyond the existing lil-gui Presets folder. (Handoff "direction E" extras —
  named test scenarios, A/B screenshot mode — deferred.)
- No change to any shader, generator (`deriveUniforms`), or feature behavior. This is panel-only.

## 3. The shared data artifact — `planet-archetypes.js`

A new standalone ES module (lab-adjacent, e.g. `planet-archetypes.js` beside `planet-lod-lab-core.js`),
imported by the lab. Two exports, deliberately non-redundant:

```js
// Each FEATURE declares its identity + archetype membership (the single source per feature).
export const FEATURES = {
  craters:   { label: 'Craters (F2)',        enableKey: 'cratersEnabled',  archetypes: ['impact-airless'] },
  ejecta:    { label: 'Ejecta & Rays (F3)',  enableKey: 'ejectaEnabled',   archetypes: ['impact-airless'] },
  scarps:    { label: 'Scarps (F5)',         enableKey: 'scarpsEnabled',   archetypes: ['impact-airless','tectonic-terrestrial'] },
  mountains: { label: 'Mountains (F1)',      enableKey: 'mountainsEnabled',archetypes: ['tectonic-terrestrial'] },
  canyons:   { label: 'Canyons (F4)',        enableKey: 'canyonsEnabled',  archetypes: ['tectonic-terrestrial'] },
  plateaus:  { label: 'Plateaus (F6)',       enableKey: 'plateausEnabled', archetypes: ['tectonic-terrestrial'] },
  tessera:   { label: 'Tessera (F6)',        enableKey: 'tesseraEnabled',  archetypes: ['tectonic-terrestrial'] },
  edifices:  { label: 'Edifices (F7)',       enableKey: 'edificesEnabled', archetypes: ['volcanic'] },
  lava:      { label: 'Lava plains (F8)',    enableKey: 'lavaEnabled',     archetypes: ['volcanic'] },
  chaos:     { label: 'Chaos (F9)',          enableKey: 'chaosEnabled',    archetypes: ['icy-active'] },
  cryoRidge: { label: 'Ridged icy (F10)',    enableKey: 'cryoRidgeEnabled',archetypes: ['icy-active'] },
  frost:     { label: 'Cryo / Frost (F23/F22)', enableKey: 'frostEnabled', archetypes: ['volatile-cold'] },
  sublimation:{ label: 'Sublimation (F18)',  enableKey: 'subEnabled',      archetypes: ['volatile-cold'] },
  glacial:   { label: 'Glacial (F17)',       enableKey: 'glacialEnabled',  archetypes: ['volatile-cold'] },
};

// Each ARCHETYPE carries its human metadata + which lab presets exemplify it.
// Feature membership is DERIVED by inverting FEATURES (no duplication).
export const ARCHETYPES = {
  'impact-airless':       { label: 'Impact / airless',       bodies: ['Moon','Mercury'],        presets: ['Frozen (airless)'] },
  'tectonic-terrestrial': { label: 'Tectonic / terrestrial', bodies: ['Earth','Venus'],         presets: ['Rocky (Earthlike)','Ocean (temperate)'] },
  'volcanic':             { label: 'Volcanic',               bodies: ['Io','Mars'],             presets: ['Lava (hot airless)'] },
  'icy-active':           { label: 'Icy-active',             bodies: ['Europa','Ganymede'],     presets: ['Europa (icy moon)'] },
  'volatile-cold':        { label: 'Volatile / cold',        bodies: ['Pluto','Triton','Mars poles'], presets: ['Titan (methane seas)','Frozen (airless)'] },
};

// Derived helper (also what Stage-D will call):
export const featuresOf = (archKey) =>
  Object.entries(FEATURES).filter(([, f]) => f.archetypes.includes(archKey)).map(([k]) => k);
```

**Why this shape:** each feature declares its archetypes once (source of truth); `featuresOf(archetype)` —
the exact archetype→feature-subset map Stage-D provinces need — falls out by inversion, no second place to
drift. `ARCHETYPES.presets` lets the panel map the currently-selected Drivers preset → its archetype →
relevant features. A preset may appear in two archetypes (Frozen is both impact-airless and volatile-cold,
matching a real cratered ice world); the panel shows the UNION of those archetypes' features (see §4).

## 4. Panel behaviour (lil-gui restructure)

```
PLANET LOD LAB
┌──────────────────────────────────┐
│ Body: [ Europa (icy moon) ▾] 🎲   │  ← existing Drivers preset dropdown
│ archetype: Icy-active              │  ← derived label (read-only)
│ [✓ filter to relevant features]    │  ← NEW toggle (default ON)
│ [ enable all ] [ clear solo ]      │  ← NEW restore buttons
├──────────────────────────────────┤
│ ▾ Chaos (F9)        [solo][✓][🎲] │  ← only this archetype's
│ ▾ Ridged icy (F10)  [solo][✓][🎲] │     features shown when filtered
│ ▾ Frost (F23/F22)   [solo][✓][🎲] │
│ ▾ Glacial (F17)     [solo][✓][🎲] │
├──────────────────────────────────┤
│ ▸ View & LOD ▸ Envelope ▸ Drivers │  ← non-feature folders always shown
│ ▸ Seeds ▸ Presets                  │
└──────────────────────────────────┘
```

- **Archetype-of-current-preset:** when the Drivers preset changes (existing `applyDrivers` path), compute
  the set of archetypes whose `presets` include it, take the UNION of their `featuresOf(...)`, and that's
  the "relevant" feature set.
- **Filter toggle (default ON):** when ON, `featureFolders[k].show()` for relevant keys, `.hide()` for the
  rest. When OFF, show all 14 (the full library — today's behaviour). Non-feature folders (View&LOD,
  Envelope, Drivers, Seeds, Presets, Debug) are never hidden.
- **SOLO button per feature folder:** `solo(key)` sets `state[FEATURES[k].enableKey] = (k === key)` for every
  feature, then refreshes controller displays. `clear solo` / `enable all` restores every enable to true.
- **Manual override:** the filter is a *view*, not a lock — toggling it OFF always reveals everything, so a
  feature is never unreachable (e.g. forcing lava plains onto a Frozen body, as done when testing F8).

## 5. Implementation approach

1. **Add `planet-archetypes.js`** (§3) and import it in `planet-lod-lab.html`.
2. **Refactor feature-folder construction into a registry-driven loop.** Today each of the 14 folders is
   built ad-hoc (lines ~2151–2350). Keep each folder's *controls* exactly as-is, but:
   - hold folder refs in a `featureFolders = { craters: fCraters, … }` map (keyed by FEATURES key);
   - append a `solo` button to each feature folder via a shared helper.
   (A full data-driven rebuild of every control is NOT required and is higher-risk — minimum change: keep the
   per-folder control code, just capture refs + add the solo button + the filter wiring.)
3. **Add the header controls** (archetype label, filter toggle, enable-all/clear-solo) near the Drivers folder.
4. **Wire `applyDrivers`** to also recompute the relevant-archetype set and re-run the filter when a preset
   changes.

## 6. Testing

- **Data-integrity unit tests** (new, `tests/planet-archetypes.test.js`) — guard drift:
  - every `FEATURES[k].enableKey` exists on the lab `state` object (import the keys or assert against a known
    list);
  - every `FEATURES[k].archetypes` entry is a real `ARCHETYPES` key;
  - every `ARCHETYPES[a].presets` entry is a real `DRIVER_PRESETS` key;
  - every archetype has ≥1 feature (`featuresOf` non-empty); every feature belongs to ≥1 archetype (no orphans);
  - `featuresOf` inversion round-trips (a feature listing archetype A appears in `featuresOf(A)`).
- **Behaviour** (visual, on `:9223` GPU Chrome): select each preset → only its archetype's features visible;
  toggle filter OFF → all 14 reappear; SOLO on one feature → others' enables go false and the render shows
  that feature alone; clear-solo → all return. Per the handoff testing-harness gotcha, do FULL setup
  (`setPreset` + toggles + distance) in ONE `evaluate_script` immediately before each screenshot; park the
  tab on `about:blank` when done.
- Existing 205 lab tests must stay green (no shader/generator change → they should be untouched).

## 7. Risks / watch-items

- **lil-gui `.show()/.hide()` on folders** — confirm the installed lil-gui version exposes these on folder
  objects (it does on controllers; folders expose `.show()/.hide()` in recent lil-gui). If a version gap
  exists, fall back to `folder.domElement.style.display`. Verify first thing.
- **Preset↔archetype is many-to-one-or-two** — Frozen maps to two archetypes by design; the UNION rule (§4)
  handles it. Don't assume one preset = one archetype.
- **Don't over-engineer the registry refactor** — keep each folder's existing control block; only capture
  refs + add the solo button. A from-scratch data-driven control rebuild is out of scope and risk-positive.
- **Province coupling is data-only** — resist wiring anything Stage-D (spatial weights, combiner multiplies)
  while here; the artifact is authored to be *readable* by Stage-D, not *used* by it yet.

## 8. Out-of-scope follow-ups (park, don't build)
- Dynamic "active right now" highlight from nonzero derived strength (a secondary marker on top of archetype
  membership). Nice, not needed for v1.
- Named test-scenario save/load; stable A/B screenshot/compare mode (handoff direction E).
- The testing-harness reload flakiness on `:9223` (page reset between calls) — worth diagnosing separately;
  the per-screenshot full-setup workaround holds for now.
