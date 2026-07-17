# Phase-A calibration candidates — world-engine-atmo-expression

> Produced by `tools/atmo-expression-calibrate.mjs` (BUILD-PLAN §6.0 Phase A, measure-before-pin).
> Sweep: `SWEEP_SEEDS = [1,7,13,23,42,101,256,777,1234,2718,3141,9999]` × {Jovian, Saturnian, Neptunian, Sub-Neptune}.
> **CANDIDATES, not frozen.** The final freeze happens at working-Claude's live A/B read-gate
> (BUILD-PLAN §6.0 Phase B) AFTER this workstream. The AC assertion bands in
> `tests/worldengine-base-band-flow.test.js` are keyed to these candidate values so a later amplitude
> shrink FAILS headless (fluid-lens must-fix #1). Re-run the tool any time to reproduce.

## Linchpin — bandProxy ↔ aBand parity (the re-scope gate)

`bandProxy(lat,P)` is the 6-uniform analytic reconstruction of the baked `aBand` (BUILD-PLAN §0.2 — `uPeak`
and `normDenom` cancel, leaving `clamp01(0.5 + DEFLECT_SCALE·(sEq·aEq·g + aMid·mid))`). Measured against the
real `bakeClimateE5Attributes.aBand` bake path across a 401-point latitude sweep on every preset:

| regime | max &#124;proxy − aBand&#124; |
|---|---|
| Jovian | 1.574e-5 |
| Saturnian | 1.603e-5 |
| Neptunian | 4.478e-6 |
| Sub-Neptune | 2.022e-6 |
| **GLOBAL** | **1.603e-5  (< 1e-3 ✓ — parity holds; NOT the re-scope gate)** |

The residual is float rounding only (the two forms are algebraically identical). The proxy is used render-side
ONLY to form a deflection delta `bandProxy(lat+dLat) − bandProxy(lat)` — the baked `aBand` +
`GOLDEN_BANDFIELD_HASH` are never touched.

## CANDIDATE constants (`BAND_FLOW` in `src/worldengine/base/band-flow.js`)

| const | role | candidate | pin source |
|---|---|---|---|
| `uAtmoInk` (default) | boldness dial (scales dWake + dAdvect); GUI 0..2 | **1.0** | bold read; Max tames at UAT |
| `uInkStretch` (default) | anisotropy (zonal-plane domain compression); GUI 1..6 | **3.5** | AC-ADVECT ratio band |
| `INK_FREQ` | base tendril frequency | 2.2 | anisotropy sweep |
| `INK_AMP` | base meridional displacement (rad) at ink=1 | 0.06 | perceptual floor (peak &#124;dLat&#124; / &#124;dBand&#124;) |
| `FOLD_K` / `FOLD_FREQ` | shear-interface fold gain / freq (NOT a vortex roll-up) | 0.5 / 9.0 | null-separation + live read-gate |
| `ROUGH_FREQ` | high-freq jag warp (distinct from 3.7 filament / 2.2 advection) | 7.0 | — |
| `ROUGH_AMP` | jag displacement on bandVal | 0.10 | live read-gate |
| `ROUGH_BELT` / `ROUGH_EDGE` | per-band base (cyc) / high-shear edge boost | 0.7 / 0.5 | AC-JAG belt/zone split |
| `ROUGH_MEAN` / `ROUGH_SPREAD` | per-seed global draw uBandRough mean / ± | 1.0 / 0.4 | AC-JAG per-seed set-size |
| `WAKE_LEN` / `WAKE_WID` | downstream cone scale / lateral width (× R) | 4.5 / 1.2 | wake-reach (sphere caps ds/R at 1/R) |
| `WAKE_BOW` | near-storm rotational bow amplitude (× R) | **0.34** | raised from §3.2's 0.06 → Jovian bow ≥0.25 band-width |
| `WAKE_AMP` | downstream wake ridge amplitude (× R) | **0.22** | raised from §3.2's 0.05 → band-width fraction (live px-confirm) |
| `WAKE_K` | von-Kármán meander wavenumber | 7.0 | — |

**Deviation recorded (BUILD-PLAN §9 adjudicable).** The advection domain transform compresses the equatorial
(x,z / longitude / zonal) plane by `1/uInkStretch`, keeping `y` (meridional). BUILD-PLAN §3.1's literal
local-frame pseudocode uses `e = dot(Nraw, eF)` which is ≡0 (a unit point is orthogonal to its own tangent
frame) and collapses to an isotropic warp — so this mirror realizes §3.1's stated INTENT ("long along flow,
short across") via the only mechanism point-sampled noise admits (anisotropic domain scaling), aligned with the
zonal flow globally. `WAKE_BOW`/`WAKE_AMP` were raised well above §3.2's starting estimates by the perceptual
floor (a field can satisfy the anisotropy ratio yet read as nothing — the V-α.1 trap).

## AC assertion bands (measured; keyed in the test)

### AC-ADVECT (over {Jovian, Saturnian, Neptunian} × 12 seeds; ungated ratio isolates the stretch mechanism)

| quantity | measured (J/S/N) | pinned band | test const |
|---|---|---|---|
| L_east/L_north ratio | [1.953, 2.787] mean 2.40 | **(1.6, 3.2)** every seed | `ADVECT_RATIO_LO/HI` |
| isotropic null (stretch=1) | [1.087, 1.301] mean 1.19 | **< 1.5** (clearly below 1.6) | `ADVECT_NULL_MAX` |
| peak &#124;dLat&#124; | [0.047, 0.349] band-widths | **> 0.04 band-widths** | `ADVECT_DLAT_FLOOR_BW` |
| peak &#124;dBand&#124; | [0.065, 0.186] | **> 0.05** | `ADVECT_DBAND_FLOOR` |

The null max (1.301) sits clearly below the ratio floor (1.6) — the direction mechanism is not isotropic noise.
The peak floors mean a later `INK_AMP` shrink FAILS instead of passing on the ratio alone. Sub-Neptune
(haze-muted, peak &#124;dBand&#124; ~0.02 by design) is measured in the sweep but held out of the vivid-deck
amplitude floor. Estimator: `⟨|∂n dLat|⟩ / ⟨|∂e dLat|⟩` (mean arc-length finite-difference gradients — the
pinned choice per §6.0 adjudicable).

### AC-JAG (over {Jovian, Saturnian, Neptunian} × 12 seeds; belt-CENTER vs zone-CENTER, both wShear≈0)

| quantity | measured | pinned | test const |
|---|---|---|---|
| roughness(beltCenter)/roughness(zoneCenter) | J/S/N min 233 (all-regime min 36.7) | **> 30** every seed | `JAG_RATIO_FLOOR` |
| uBandRough per-seed set-size | 12/12 every regime | **≥ ⌈0.75·12⌉ = 9** | — |

Both centers sit at `jetProfile` extrema (`wShear≈0` at BOTH) — the split is driven by `cyc = clamp((0.5−wBand)·2)`
(the belt/zone discriminator), NOT a boundary-vs-center tautology (fluid-lens must-fix). `wShear` alone gives a
zone center exactly 0 base roughness (proven in the test), so it cannot key the feature.

### Wake (headless sanity floor; AC-INTERACT itself is LIVE)

| quantity | measured | pinned | note |
|---|---|---|---|
| wake reach | [3.3, 3.9] ds/R | **> 2.6 ds/R** (past the old GRS cone) | sphere caps ds/R at 1/R for R∈[0.18,0.30] |
| &#124;dLat&#124; at ds/R=3 | ≈ 0.19·R (0.034+ rad) | **> 0.01** | `WAKE_DLAT_FLOOR` |
| Jovian bow peak | [0.267, 0.403] band-widths | ≥ 0.25 (live px-confirm) | AC-INTERACT downstream annulus ≈ [3R, ~5R] |
| count-gate | no vortices ⇒ exactly 0 | asserted | same lever `stormColTerms` uses |

Downstream direction is DERIVED from `sign(bandProxy(latC)−0.5)` = local zonal-flow sign (east in zones, west
in belts), not hard-coded west (fluid-lens must-fix #5) — asserted by the wake-asymmetry test.

### Boldness (peak dLat in band-widths, dial linear)

| uAtmoInk | peak dLat (band-widths) |
|---|---|
| 0.5 (tame) | [0.023, 0.175] mean 0.088 |
| 1.0 (bold default) | [0.047, 0.349] mean 0.176 |
| 1.5 | [0.070, 0.524] mean 0.264 |

Bold at 1.0 (~0.2–0.35 band-widths on Jovian/Saturnian), linearly tameable — Max's UAT tame-down dial.

## What Phase B (live read-gate) still owns before the freeze

- Confirm each effect READS on a pinned Jovian seed+camera at `:5178` (tendrils as directional flow not grain;
  storm bow + wake; belts rougher than zones); raise `INK_AMP`/`WAKE_*`/`FOLD_K`/`ROUGH_*` if sub-perceptual.
- The far-wake ridge px floor (≥3–4 px) — headless can only pin the band-width fraction.
- Router-compile check: `HEIGHT_FRAG = HEIGHT_GLSL + ROUTER_MAIN` compiles with zero shader errors after the
  slice-K/J/I band edits (the 9 new uniforms must be declared IN HEIGHT_GLSL).
- Then set the AC perceptual floors to the confirmed reading amplitude and freeze.
