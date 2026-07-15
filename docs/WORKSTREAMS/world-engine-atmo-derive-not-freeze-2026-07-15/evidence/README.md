# derive-not-freeze — live evidence (working-Claude drive, 2026-07-15, :5178 @ c0cef9a)

All drives in a fresh isolated context; pinned view (distance 3.0, yaw 0.6, pitch 0.25,
sun-to-camera); jets OFF for pixel stability; settle ≥0.9–1.6 s per reseed.

## AC-WIRING — writer bit-match through the real reseed path (Jovian)

At each of seeds 301/302/303 (`_lab.setSeed`, which routes through `reseedGiant()` since
slice 1): the page state was compared against an INDEPENDENT in-page reconstruction of the
full pipeline — fresh `deriveConditionVector(fp, state._derived, radius)` →
`drawGiantConditions` → `deriveGiantDrivers` → `resolveStormE(regime, drivers, macroSeed,
stormSeed)` with the lab's exact drivers assembly.

| seed | spot lat | spot lon | trainCount | polar N | spotCenter bit-match | spotRadius | polar N match |
|---|---|---|---|---|---|---|---|
| 301 | +29.75° | −31.9° | 4 | 8 | ✓ | ✓ | ✓ |
| 302 | −31.75° | +75.2° | 4 | 8 | ✓ | ✓ | ✓ |
| 303 | −36.50° | −22.8° | 4 | 8 | ✓ | ✓ | ✓ |

Return to 301: spot lat/trainCount/polar N bit-identical to the first visit (deterministic).
Latitudes move across seeds INCLUDING a hemisphere flip — the frozen-shear lat-sharing is gone.

## AC-LIVE-VARIETY — pixel evidence (Jovian, disc crop 1100×1000)

| pair | AE (pixels differing) |
|---|---|
| 301 vs 302 | 361,768 |
| 301 vs 303 | 349,017 |
| 302 vs 303 | 320,849 |
| 301 vs 301 (repeat) | **0** |

Crops: `crop-dnf-seed301a/302/303.png`; side-by-side: `three-seeds-montage.png`.

## AC-POLAR live — ice-giant presence flips + N morphing (Neptunian, 8-seed sweep)

Seeds 401–408: polar vortex PRESENT 5/8, ABSENT 3/8 (seeds 402/403/405) — prior 0.55;
N varies {5,6,7} across present seeds; spot latitudes span −35.7° … +23.7°.
"They always appear" is dead on ice giants; Jovian stays ~always-present by ratified
prior 0.98 (the physically honest call Max ratified with the forms table).

## LITERAL-UI close (second drive, fresh context, post-verify-workstream)

The verify run correctly noted the first drive used `_lab.setSeed` (the JS API). A second
drive used the REAL UI controls via chrome-devtools a11y-tree interaction:

- **'New planet (re-roll both)' BUTTON click:** macroSeed 1 → 7848 (Math.random path),
  spot lat −23.50° → +27.75°, trainCount 4 → 6, polar N 7 → 8 — and state at the clicked
  seed bit-matches the independent writer re-call. Console clean.
- **Macro-seed GUI number input** (fires the slider's `.onChange(reseedGiant)`): typed
  777 → spot −26.25°, N=8, writer bit-match ✓; typed 900 → spot −36.75°; re-typed 777 →
  identical state + writer bit-match ✓. Pixel AE (disc crop): 777 vs 900 = **345,476**;
  777 vs 777 repeat = **0**. Crops: `crop-dnf-ui-777a/900/777b.png`.

## Honest notes

- `state.bandCount` read 3 at all Neptunian seeds: that key is the F24 legacy display knob,
  not the E5 writer's band count — writer band-count variety (rhinesWavenumber m ∈ {2,3}
  Neptunian, {12,13} Jovian) is proven in the headless finisher sweep + pinned floors
  (worldengine-base-giant-drivers.test.js). The visual band difference is nonetheless
  evident in the montage (the E5 bake drives the render).
- Sole console error during the drive: a 404 on `src/worldengine/base/body-condition-vector.js`
  — working-Claude's own first mistyped dynamic-import in the cross-check script (the module
  lives at repo root). Probe artifact; the lab's own import is correct; console otherwise clean.
- Screenshots taken at 2229×1060 @1.25dpr; crop excludes both GUI panels.
