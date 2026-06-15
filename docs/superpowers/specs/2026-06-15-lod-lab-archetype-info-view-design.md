# Design — Planet-LOD lab archetype info view (Ask 3 of the menu/info overhaul)

**Date:** 2026-06-15
**Author:** working-Claude (brainstormed with Max)
**Status:** spec — pending Max review → implementation plan
**Scope:** `planet-lod-lab.html` (GUI only). **No shader/core changes**
(`planet-lod-lab-core.js` untouched), **no generator, no new data file, no drift guard** — all
content is derived at runtime from modules that are *already* authoritative. This cannot regress any
planet rendering.
**Campaign frame:** this is lab *tooling*, not a planet feature — the campaign per-feature UAT loop
does NOT govern. It's a pure GUI/derivation addition, verified live on `:9223`. Single-system (GUI
only) → `dev-collab-scope` is NOT invoked (same call as the Phase-1 declutter and Ask 2).
**Sibling:** This is the info-layer twin of **Ask 2** (per-feature info cards, spec'd not yet built —
`docs/superpowers/specs/2026-06-15-lod-lab-feature-info-cards-design.md`). Ask 2 answers "what is
*this feature*?"; Ask 3 answers "why is this feature relevant to *THIS world*?". They share the
inline-ⓘ DOM mechanism; the key contrast is that **Ask 3 has no prose to author**, so no generator
and no drift guard are needed.

## Why

The menu overhaul is Max's goal #3; it makes the per-feature quality pass *legible*. Phase 1
(declutter, `fc30eb1`) already shows a **joined archetype label** in the World folder (e.g.
`Tectonic / terrestrial + Volcanic`). That label is a *fact* with no explanation. **Ask 3** expands
it into an explanatory view: it makes the **derived-archetype → relevant-feature-set logic legible**,
so that during the per-feature quality pass Max can answer "why is this feature in this world's
roster?" without reading the source. In a brainstorm (2026-06-15) Max approved an **archetype info
block behind an ⓘ toggle next to the World folder's `archetype` field**, with **all content derived at
runtime** from `ARCHETYPES` / `FEATURES` / `featuresOf()` / live enable state.

## What — the design

### Data flow (fully derived; nothing authored)

```
planet-archetypes.js  ──import (already)──▶  planet-lod-lab.html
  ARCHETYPES[key] = { label, bodies, presets }       inline ⓘ archetype info block
  FEATURES[key]   = { label, enableKey, archetypes }  (re-derived on preset/toggle change)
  featuresOf(archKey) → [featureKey, …]
       +
runtime state.* enable flags + relevantFeatureSet()
```

Unlike Ask 2, **there is no `.md` source, no generated module, and no `package.json` script**. Every
line in the view is computed at render time from data the lab already imports. This is the
derive-don't-author culture taken to its limit: because the archetype→feature mapping *is* code, the
view simply renders that code. No second copy can drift, so no drift guard is required.

### Placement

An **ⓘ toggle button next to the World folder's `archetype` field** (the disabled
`filterUI.archetypeLabel` controller added ~line 7116). Toggling ⓘ shows/hides an **archetype info
block** injected directly **under the archetype label row**, inside the World folder. This reuses the
**same inline-ⓘ DOM pattern Ask 2 establishes**, which itself extends the title-bar DOM injection
already proven by `relocateEnableToTitle()` in Phase 1. (Ask 2's ⓘ lives in each *feature folder's
title bar*; Ask 3's single ⓘ lives on the *archetype field row* in the World folder — same mechanism,
one instance.)

### View content & sources

All derived at runtime from existing modules; nothing hand-authored.

| Line | Example | Source |
|---|---|---|
| Header | `Venus (sulfuric shroud) → 2 archetypes · 30 relevant features · K enabled` | `driverUI.preset` + `relevantFeatureSet().archs` + **de-duplicated** `set` size + live enable count |
| Per-archetype heading | `Tectonic / terrestrial` | `ARCHETYPES[archKey].label` |
| …its bodies | `like Earth, Venus, Mars` | `ARCHETYPES[archKey].bodies` joined |
| …its feature roster | `● Mountains  ○ Canyons  ● Craters …` | `featuresOf(archKey)`, each with live state |

**Header counts (precise definitions):**
- `N archetypes` = `relevantFeatureSet().archs.length` (archetypes whose `presets` include the current
  preset).
- `M relevant features` = the **DE-DUPLICATED** count, i.e. `relevantFeatureSet().set.size` (a feature
  in two of the world's archetypes is counted **once** here).
- `K enabled` = of those `M` features, how many have their `state.*` enable flag true right now.

**Per-archetype rosters are NOT de-duplicated.** A feature belonging to **multiple** of the world's
archetypes (e.g. `frost` ∈ `volatile-cold` + `icy-active`; `mountains` ∈ `tectonic-terrestrial` +
`volcanic`) is shown under **EACH** archetype it belongs to — membership-under-each-archetype is the
whole point of the view (it shows *why* the feature is in the roster, which can be more than one
reason). The single de-duplicated total lives only in the header's `M` count. **(Max explicitly
approved this — do NOT dedup the per-archetype rosters.)**

**Enable-state dots** mirror Ask 2's convention: `●` enabled / `○` off, per feature, read from
runtime `state.*` at render time.

**Read-only roster in v1.** Each feature in a roster is plain text + dot; it is **not** a link. A
"click a feature → jump to / open its folder" affordance is an explicit **FUTURE** add — noted here as
out-of-scope / YAGNI, **not built** in Ask 3.

### Seam with Ask 4 (state this clearly)

Ask 3 shows the **expected** roster + each feature's **enable state**. It does **NOT** assert whether
each feature **actually fires** (renders correctly), is **dead**, or **false-renders**. That live
render-audit is **Ask 4**, layered on top later. In one line:

> **Ask 3 = expected roster + enable state. Ask 4 = does each feature actually render.**

A feature can read `● enabled` in Ask 3 and still be a dead/false-render under Ask 4; surfacing that
gap is deliberately deferred.

### Live-update behavior (mirrors Ask 2's state refresh)

The view re-derives:
- **On preset change** — new archetypes, new rosters, new header counts. The existing
  `applyArchetypeFilter()` already fires on preset change (`onChange(applyDrivers)` →
  re-derive at ~line 6266 / 7115); the info-block re-render hooks the same path so the block stays in
  sync with the `archetype` label it sits under.
- **On any feature enable-toggle** — the dots flip and the `K enabled` header count updates. (The
  `N`/`M` counts and the rosters themselves do **not** change on a mere toggle — only on preset
  change.)

This matches Ask 2's approach: the structured/state-bearing parts re-render on the same events Ask 2's
**State** line does.

### GUI rendering (inline; mirrors Ask 2's card mechanism)

- The info block is **plain DOM** (a styled `<div>`), **NOT** lil-gui controllers — so it never
  perturbs `syncDisplays()`, the enable controllers, or the reparenting relevance filter
  (`applyArchetypeFilter()` moves *feature folders* between parents; the World folder and this block
  are untouched by that loop). Same rationale as Ask 2's card.
- The ⓘ button is injected onto the `archetype` field row using the title-bar/inline injection pattern
  (`relocateEnableToTitle()` is the reference; Ask 2's per-feature ⓘ is the closest sibling). It must
  not collide with the existing disabled controller's DOM.
- **Collapsed by default** (ⓘ off) so the menu stays lean; the per-view ⓘ open/closed is the only new
  UI state.
- The renderer is one function — e.g. `buildArchetypeInfo() → HTMLElement` — that reads `driverUI.preset`,
  `relevantFeatureSet()`, `ARCHETYPES`, `featuresOf()`, `FEATURES`, and live `state.*`, and is called
  (or its content rebuilt in place) on the preset/toggle events above.

## Mechanics & risks (on the record)

- **Line-number drift** in `planet-lod-lab.html` is real — all line numbers in this spec are **HINTS**.
  Re-`grep -n` every edit site (`relevantFeatureSet`, `applyArchetypeFilter`, `fWorld`,
  `archetypeLabel`, `relocateEnableToTitle`); do **NOT** trust line numbers from this spec.
- **Header `M` vs. per-archetype roster sums will differ by design** (the rosters double-count
  multi-archetype features; `M` does not). This is intended, not a bug — call it out in the view's
  layout so it doesn't read as an arithmetic error (e.g. for Venus the header counts 30 unique
  relevant features while the two rosters list 32 rows — `tectonic-terrestrial` 27 + `volcanic` 5,
  with multi-archetype features like `mountains` double-listed). The implementer should make the
  distinction legible (header = unique total; rosters = membership view).
- **DOM injection on the archetype field row** must not clobber lil-gui's disabled-controller markup
  or collide with the Phase-1 / Ask-2 title-bar injections; verify live.
- **Re-render timing:** the block must rebuild *after* `applyArchetypeFilter()` updates
  `filterUI.archetypeLabel`, so its header preset/counts match the label it sits beneath. Hook the
  re-render at the tail of the existing preset-change path rather than racing it.
- **No generator / no drift guard / no unit test of parsed prose** — there is nothing to parse and no
  second copy of the mapping, so (unlike Ask 2) those mechanisms are intentionally absent. Verification
  is live + keeping existing suites green.

## Out of scope (later asks)

- **Future (Ask 3.x):** clickable roster features → jump to / open the feature's folder (YAGNI for v1).
- **Ask 4 — live render-audit** surfacing (which features actually fire vs. dead / false-render),
  layered on Ask 3's expected-roster view.
- **Ask 2** — per-feature info cards (sibling, spec'd separately).
- **Thread B** — render-correctness residuals (Carbon/Crystal mountains, faint craters, shatter/hexTess).

## Verification

- **Live on chrome-devtools GPU `:9223`** (NOT Playwright):
  `localhost:5173/well-dipper/planet-lod-lab.html?fresh=1`. **Reload `?fresh=1` before each check.**
  Verify via `window._lab.*` helpers + `evaluate_script` **DOM queries** — NOT image recognition.
  - **Venus (sulfuric shroud)** → the view shows **BOTH** archetypes
    (`Tectonic / terrestrial` *and* `Volcanic`) with their `bodies` ("like Earth, Venus, Mars" /
    "like Io, Mars, Venus, K2-141b") and each archetype's roster with correct `●`/`○` dots; a
    multi-archetype feature (`mountains`) appears under **both** archetypes; header `M` counts it once.
  - **Gas giant (Jovian)** → the **gas-giant roster only** (one archetype), correct dots.
  - **Toggle a feature** → its dot flips `○`↔`●` and the `K enabled` header count updates; `N`/`M`
    unchanged.
  - **Switch preset** → the whole view re-derives (archetypes, rosters, all header counts) and matches
    the `archetype` label above it.
  - View **collapsed by default**; toggling ⓘ shows/hides it.
- **No unit test for this feature** — the GUI is an inline `<script>` (not vitest-importable), and there
  is no generator to test (the contrast with Ask 2). Verification is **live** plus the existing suites
  staying green.
- **Existing suites** (`feature-associations`, `planet-archetypes`, the `cityLightsEnabled` pin #16,
  the Stage-D GLSL drift-guard) stay green — this is a purely **additive** GUI change.
- **Commit explicit paths only** (`planet-lod-lab.html`) — never `git add -A` (shared-tree litter:
  warp WIP + loose `.png`/`.webm`/`.html`).
