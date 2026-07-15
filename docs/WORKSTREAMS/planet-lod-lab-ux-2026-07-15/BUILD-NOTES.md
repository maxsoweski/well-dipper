# planet-lod-lab-ux — build notes (record-build-intent)

## What it does (plain language)

Three slices, all GUI-layer, zero feature-code changes:

1. **Provenance badges + World Engine section** (`6175eb9`) — `FEATURES` entries gain a
   `provenance` data field (`'writer'` = a worldengine writer authors placement/physics;
   `'grain'` = legacy body whose orientation reads the WS4 tectonic grain; absent = pure
   legacy). The Features panel renders ✦/◐ badges from it and grows a top-level
   **World Engine ✦** section (open) holding the writer-fed folders (F24/F25 today);
   the legacy drawer renames to **Legacy features** (collapsed, as before).
2. **Per-world default enables** (`4390c9d`) — `applyWorldDefaults()` enables exactly the
   features whose `ASSOCIATIONS[k].rendersOn` includes the current preset. Fires on boot,
   on preset CHANGE (dropdown + `_lab.setPreset`), and via the new **reset to world
   defaults** button. Does NOT fire on driver-slider `applyDrivers` re-runs or 🎲 dice
   rerolls, so hand-toggles survive mid-session tuning.
3. **Left-pane IA** (`bd372fb`) — four ratified groups: World (open) · Seeds (open) ·
   Drivers (grain & carve folded in) · View & Light · Dev tools (plate-isolate, substrate
   overlay, mixed-lid, scale readout) · Presets · Rings. DOM-only moves (the fLegacy /
   relevance-filter precedent) — no declaration lines touched.

## Why (intent)

Max, 2026-07-15: "I can't even UAT without you driving because the UX is so cluttered,
confusing, and stuffed with legacy features." The lab is the UAT instrument for the whole
World Engine program; these slices make it solo-drivable and make new-vs-legacy legible
(the atmo-3b META-finding).

## Deliberate non-goals

- **Trusting-state** (stale overrides, same-preset re-select) — Max did not pick it as a
  friction; out of scope by contract.
- **Guided UAT mode / one-click panels** — Max ruled "decluttered lab is enough."
- **Feature-code changes** — no writer, shader, or generator edits; provenance is data + DOM.
- **Seeds folder re-nesting under World** — DEFERRED to the post-atmo-merge pass: the atmo
  branch's reseed-wiring slice edits the Seeds folder's inner lines; touching them here
  would guarantee rebase conflicts.
- **F27–F29 provenance flip** — the atmo branch flips its own FEATURES rows when #3b merges.

## Notes for the next reader

- **The per-preset default table IS `ASSOCIATIONS[k].rendersOn`** (planet-feature-associations.js)
  — the render-audit's expected side. One data source; no second table to drift.
- **localStorage restore vs boot defaults:** the lab's settings persistence (lil-gui
  save/load) can restore state over a fresh boot's `applyWorldDefaults()`, depending on
  restore timing. Fresh contexts get pure defaults (verified); a returning tab may see its
  persisted enables. If Max reports confusion here, revisit ordering — candidate for the
  trusting-state follow-up, not this workstream.
- **AC-0 nuance:** the two new World-folder buttons are action buttons, not feature
  toggles — the orphan-folder guard only scrapes `.add(state,'<x>Enabled')` literals, so
  buttons are guard-invisible by design (documented here per the manual-audit requirement).
- Evidence: `evidence/slice1-we-section-jovian.jpeg`, `evidence/slice2-jovian-boots-banded.jpeg`,
  `evidence/slice3-leftpane-4groups.jpeg`; spot-drives in the session record (distance slider,
  craters toggle, isolate roundtrip site, defaults button restore).
