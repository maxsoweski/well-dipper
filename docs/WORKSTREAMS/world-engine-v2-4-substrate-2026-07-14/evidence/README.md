# AC-LAB live-drive evidence — 2026-07-14, tree `393e1af`

Driver: working-Claude via chrome-devtools MCP on 127.0.0.1:9223 (isolated context `lane-a-aclab`,
pages closed after the drive). "After" server: `:5175` (main checkout, post-C5 `393e1af`).
"Before" server: `:5178` (atmo worktree — `git diff --stat 69f4ae9..HEAD -- src/ *.js planet-lod-lab.html`
is EMPTY, so its lab serves code byte-identical to pre-C1 `69f4ae9`). Viewport 1783×848 @dpr 1.25
(canvas crops exclude the left GUI panel: `-crop 1879x1060+350+0`).

## (a) Coastline before/after — pinned camera/seed

Preset **Ocean (temperate)**, seeds macro/radius/detail = 1/1/1, camera distance 1.7 / yaw 0.55 /
pitch 0.18, `sunToCamera()` (derived az 31.51° / el 10.31° — matched to the decimal on both servers),
pixelScale 1 (identical on both sides).

- `aclab-a-ocean-strait-BEFORE-69f4ae9.png` / `aclab-a-ocean-strait-AFTER-393e1af.png` — the pinned pair.
- `aclab-a-ocean-strait-DIFF.png` — `compare -fuzz 5%`: **44,151 / ~1.99M canvas px differ (~2.2%)**,
  concentrated along the strait coastline corridor + the SE coastal patch. Land interiors and open
  ocean untouched — the margins signature, not a global re-render.
- `aclab-a-ocean-strait-CLOSEUP-pair.png` — labeled side-by-side: BEFORE = flat channel tone with an
  abrupt land→deep edge; AFTER = coast-parallel graded shelf band hugging the shores (incl. a graded
  rim around the small island) deepening mid-channel. Reads as the contracted smooth coast→abyss
  apron (shelf/break/slope sub-node at practical mesh — caveat pre-surfaced to Max).

## (b) Province overlay + probe cross-check (stable-carrier values)

Overlay driven via `_lab.provinceOverlay()` (the same `setProvinceOverlay` path the GUI checkbox
binds). GUI folder `Substrate (V2-4)` present; checkbox **default-off**. Probe = `_lab.provinceProbe()`
(NPERM 200) read ≥2.5s after each REAL preset change (see instrument note below).

| Preset (path) | proportions c/o/b | orogen fault vs craton fault | η² real | null p99 | pass |
|---|---|---|---|---|---|
| Ocean/Rocky @1 (plate) | .669/.076/.255 | 0.361 vs 0.000 | 0.525 | 0.033 | ✓ |
| Europa @1 (shell) | .642/.140/.218 | 0.586 vs 0.277 | 0.486 | 0.038 | ✓ |
| Venus @1 (stagnant) | .643/.104/.254 | 0.164 vs 0.000 | 0.395 | 0.014 | ✓ |
| Mars @1 (despun) | .733/.000/.267 | — (0 orogens) | 0.227 | 0.028 | ✓ |

- Accommodation means order craton < orogen < basin on every preset (e.g. Ocean .116/.209/.391).
- Screenshots: `aclab-b-{ocean,rocky,europa,venus,mars}-overlay-ON.png`. Ocean/Rocky show red orogen
  belts as connected elongated chains along the fault corridors; Europa's orogen mass is a polar cap
  (shot rotated to show it); Venus shows thinner belts; Mars shows craton+basin only.
- **Mars zero-orogens is DESIGNED path degeneracy, not a defect:** on grain-path worlds
  `tectonic.js:160` parity-fills `faultDensity = max(faultDensity, grainMag)` (fd ≡ gm exactly when
  plate faults are absent); high-grain nodes are speckle, so the 3 bounded relax passes dissolve the
  orogen speckle. `province.js:17` carries the flagged caveat; the universal-seam test requires only
  cratons+basins per path; Mars@1/@42 pass the association tests headlessly.
- grainMag = exactly 0 in all classes on PLATE worlds = the flagged R-grainMag-degenerate caveat
  (plates.js never runs writeGrainSphere; rank-normalization drops degenerate fields).
- **Default-off byte-identity (live):** overlay on→off round-trip vs the never-toggled AFTER shot:
  `compare -metric AE` = **0 differing px** over the full 2229×1060 viewport.

## (c) Non-plate presets byte-identical to pre-C1 (overlay off)

Pinned view (distance 2.4 / yaw 0.337 / pitch 0.205 / sunToCamera / pixelScale 1), canvas crops:

| Preset | :5175 (393e1af) vs :5178 (≡69f4ae9) |
|---|---|
| Europa (icy moon) | **0 px differ** |
| Lava (hot airless) | **0 px differ** |
| Mars (arid rocky) | **0 px differ** |

## (d) Console

Errors/warnings after the full drive (preset sweeps, overlay toggles, probes) on BOTH pages:
exactly one identical pre-existing `favicon.ico` 404 (present on the pre-C1 build too). **Zero new
errors from V2-4.**

## Instrument note (for future drives)

`provinceProbe` reads `riverOverlay.reliefCarrier` — "the last carrier writeBodyRelief built" — which
lags a REAL preset change by ~500ms (debounced route). Probing too early returns the PREVIOUS
preset's carrier (this drive initially mis-attributed Europa's values to Mars that way). Wait ≥1s
after `setPreset` before probing, and remember same-preset re-select does NOT re-route
(`_presetChanged` gate).
