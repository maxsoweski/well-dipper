# Design — Planet-LOD lab menu declutter (Phase 1 of the menu/info overhaul)

**Date:** 2026-06-15
**Author:** working-Claude (brainstormed with Max)
**Status:** spec — pending Max review → implementation plan
**Scope:** `planet-lod-lab.html` only — GUI wiring. **No shader/core changes** (`planet-lod-lab-core.js`
untouched), so this cannot regress any planet rendering.
**Campaign frame:** this is lab *tooling*, not a planet feature — the campaign per-feature UAT loop
does NOT govern. It's a UI refactor, verified live on `:9223`.

## Why

Max's words: the lab menus are "too complex / unwieldy / display some of the same info twice"; he
wants them "more intuitive / simple." The menu overhaul is his goal #3 and makes the per-feature
quality pass *legible*. In a brainstorm (2026-06-15) he chose to **declutter first** — build a clean
frame — and defer the information layer (asks 2–4 below) to a later phase.

Two concrete duplications were identified against the live code:
1. **Selector vs indicator** — the world is picked via the `type preset` dropdown buried in the
   **Drivers** folder, while the *derived* archetype shows as a read-only `archetype` field far away
   in **Body filter**. Same concept ("what world is this?"), two distant places; the label truncates.
2. **Split feature controls** — the `bio…` / `city…` sliders live in the left **Envelope** folder,
   but their on/off toggles and conceptual home (features F46 bioMats, F48 cityLights) are feature-side.
   In the registry, `bioMats` and `cityLights` both literally map to the *entire* Envelope folder
   (`featureFolders` ~L6908–6909) — so a single feature's controls are split across two panels and the
   relevance filter can only show/hide all of Envelope for them.

## What — the design (approach "B · Two clean panels")

### Left panel → "World & rig"
- **New top `World` folder (open).** Contains, in order:
  - the **preset picker** (moved up out of Drivers — `fDrivers.add(driverUI,'preset',…)` ~L6281),
  - the **derived `archetype` label** directly beneath it (relocated from Body filter ~L7087; stays
    read-only/disabled),
  - **`filter to relevant`** toggle — **default ON** (currently `filterUI.filter` defaults true at
    ~L5264; confirm and keep ON),
  - **solo mode** dropdown, **enable all**, **clear solo (restore)** (relocated from Body filter).
  - This collapses the old `Body filter` folder into `World`; the separate read-only archetype field
    is removed (its value now lives under the picker). → kills duplication #1.
- **Everything else collapsed by default:** View & LOD, Debug, **Envelope** (now holding ONLY the
  global look knobs: posterize levels, dither mode, emissive (lava), province influence, emissive
  bypass — the `bio…`/`city…` sliders move out, see below), Drivers (qualityTier + any derived
  readouts; preset picker removed), Seeds, Presets, Rings.

### Right panel → "Features" (the work surface)
- **New dedicated folders `bioMats (F46)` and `cityLights (F48)`** created in the overlay area
  (alongside the existing `Machine surface (F47)` / `Ecumenopolis (F49)` in `Surface — Exotic`, or a
  small `Surface — Overlays` group — implementer's call, kept adjacent to F47/F49).
  - Move into `bioMats`: `bioCoverage`, `bioScale`, `bioIntensity`, `bioColor`, `bioMatsEnabled`
    (sliders at ~L5302–5306).
  - Move into `cityLights`: `cityMaturity`, `cityIntensity`, `cityScale`, `cityCoastBoost`,
    `cityColor`, `cityLightsEnabled` (~L5309–5314). **Preserve the `cityLightsEnabled` literal** — a
    test (#16) regexes it.
  - Repoint `featureFolders.bioMats` / `.cityLights` from `fEnv` to the new folders.
  - Apply `relocateEnableToTitle()` to the new folders so their enable toggle sits in the title bar,
    matching every other feature folder. → kills duplication #2.

### Filter behavior — collapsed "Not relevant" group (Max's pick: option 3)
- **New top-level `Not relevant to this world (N)` folder (closed)** at the bottom of the right panel.
- `applyArchetypeFilter()` (~L7073) changes from `folder.show()/hide()` to **reparenting**:
  - For each feature, compute relevance via the existing `relevantFeatureSet()`.
  - **Relevant** → ensure its `folder.domElement` sits in its **category** group's children container.
  - **Irrelevant** (and `filterUI.filter` ON) → move its `folder.domElement` into the
    **Not-relevant** group's children container.
  - Update the group title with the live count `(N)` = number of irrelevant feature folders.
  - When `filterUI.filter` is OFF → all features return to their category groups (Not-relevant empty).
- Relevant features always render normally; expanding the group lets Max force-enable an irrelevant
  feature inline (the gate-testing workflow), without flipping the whole filter off.

## Mechanics & risks (on the record)
- **Reparenting** moves `folder.domElement` between DOM containers. The controller objects stay in the
  lil-gui JS tree (so `syncDisplays()` keeps working) — same trick `relocateEnableToTitle()` already
  uses for the enable controller. Verified pattern, low risk.
- **Order preservation:** returning a folder to its category appends at the end, so within-category
  order can drift after preset changes. Mitigation: store each feature's original sibling index at
  build time and re-insert at that index if cheap; otherwise accept + note (lab tool, cosmetic).
- **`filter to relevant` default ON** changes the lab's opening state. Confirm no startup code assumes
  all folders visible. `enableAllFeatures()` / sweep paths operate on `state.*` enables, not folder
  visibility, so they're unaffected — verify on `:9223`.
- **Line numbers are hints** — re-`grep -n` every edit site (line drift is a known hazard here).

## Out of scope (deferred — later phases of the overhaul)
Per "declutter first," these are NOT in this spec:
- Ask 2 — per-feature info cards (what it is / what drives it / which archetypes).
- Ask 3 — archetype info view (full feature set an archetype should exhibit + state).
- Ask 4 — auto-correct / live render-audit surfacing in the menu.
They hang on the clean frame this phase builds.

## Verification
- Live on chrome-devtools GPU `:9223` (NOT Playwright): `localhost:5173/well-dipper/planet-lod-lab.html?fresh=1`.
  - World folder: picking a preset updates the adjacent archetype label; no second archetype field remains.
  - bioMats/cityLights: their sliders live in their own right-panel folders; toggling enable from the
    title bar works; Envelope no longer shows bio/city sliders.
  - Filter ON (default): irrelevant features sit in the closed `Not relevant (N)` group; switching
    presets recomputes membership; relevant ones return to their categories. Expand → force-enable works.
  - Filter OFF: all features back in their category groups.
- Tests: `npx vitest run` for any suite touching the lab GUI/feature registry (e.g.
  `feature-associations`, `planet-archetypes`, and the test #16 that pins the `cityLightsEnabled`
  literal). Expect green; this is GUI-only.
- Commit **explicit path only** (`planet-lod-lab.html`) — never `git add -A` (shared tree litter).
