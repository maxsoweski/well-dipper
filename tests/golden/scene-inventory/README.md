# Scene-inventory golden snapshots

Tier 3 of the welldipper-scene-inspection-layer (Phase 3, brief 2026-05-06).

Each `<scenario>.json` file pins the expected scene-inventory snapshot at the
entry of a lab-mode scenario. CI / Tester runs the kit's `diffInventories`
against the live snapshot to detect structural-visibility regressions
between commits.

## Generation workflow

1. Land a stable Phase 3 inspector at the workstream HEAD.
2. Drive each canonical scenario via real keypress (Shift+1, Shift+2, ...).
   At entry, capture the snapshot via `window.__wd.takeSceneInventory()`
   and stable-sort the result.
3. Save the snapshot to `tests/golden/scene-inventory/<scenario>.json`.
4. Commit. Subsequent runs assert the diff is empty.

## Stable serialization

Snapshots are serialized with:
- `meshes` / `cameras` / `lights` / `composerPasses` / `domOverlays` arrays
  sorted alphabetically by name (or id).
- UUIDs stripped (three.js generates fresh ones each load -- non-deterministic).
- WorldPos rounded to 3 decimals so micro-jitter from float math doesn't
  produce false diffs.

Use `serializeForGolden(inv)` from `src/debug/scene-inventory-golden.js`
to produce the canonical form.

## Out of scope (v1)

- Auto-generation from CI. Goldens are committed manually via lab-mode
  workflow until the Phase 4 / Tier 3 CI integration lands.
- Diff visualization. The kit's `diffInventories` returns appeared /
  disappeared / pass-enabled / draw-call-delta. Renderable diff UI is a
  follow-up.
