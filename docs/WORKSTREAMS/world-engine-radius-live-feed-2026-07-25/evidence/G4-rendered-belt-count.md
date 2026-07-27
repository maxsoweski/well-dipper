# G4 — Rendered belt count vs radius: the 2026-07-27 prime suspect is KILLED

**Question (from `handoff-lane-A-radius-r1-uat-fail-2026-07-27.md`):** Max UAT-failed R1 with
*"it increases the roughness of bands edges but does not increase the number of bands."*
The prime suspect was the e5-bands **smoothstep 0.34/0.66 dead-zone** — the theory that the field
gains bands but the display threshold throttles how many clear it into visible belts.

**Verdict: the suspect is KILLED.** The rendered belt count *does* increase with radius, and the
smoothstep threshold is not the limiting factor. The real mechanism is an **exponent collision
between the Rhines band law and the lab's radius display scale.**

---

## The measurement

Measured the **rendered** quantity — post-smoothstep, screen-space — not `state.e5BandCount`
(the zero-crossing diagnostic that wrongly closed AC-BANDS).

Method: read the live baked `geometry.attributes.aBand` + `position` off the lab mesh (66 049 verts),
bin by `sin(lat)` (= screen row on an equator-on disc, 400 rows), apply the shader's own
`zone = smoothstep(0.34, 0.66, clamp(aBand,0,1))` (`planet-lod-height.glsl.js:1892`) and polar-hood
multiply (`:1919`), then count bright/dark runs ≥ 6 px of a 500 px disc.
Preset Jovian + Saturnian, jets ON, macroSeed 1, 600 ms settle per step (> the 220 ms debounce).

### Jovian

| R (RE) | sVis | e5BandCount (diagnostic) | uBandCount (jets) | **RENDERED belts** | bands / screen | roughness / screen |
|---|---|---|---|---|---|---|
| 2    | 1.414 | 4  | 3  | 4  | 2.83 | 2.12 |
| 4    | 2.000 | 6  | 5  | 6  | 3.00 | 2.50 |
| 6    | 2.449 | 8  | 7  | 7  | 2.86 | 2.86 |
| 8    | 2.828 | 9  | 10 | 8  | 2.83 | 3.54 |
| 11.2 | 3.347 | 11 | 14 | 11 | 3.29 | 4.18 |
| 14   | 3.742 | 13 | 16 | 11 | 2.94 | 4.28 |
| 16   | 4.000 | 14 | 16 | 12 | 3.00 | 4.00 |

Saturnian is the same shape: rendered belts 5 → 9, **bands/screen 3.54 → 2.25** (declining),
roughness/screen 2.12 → 4.28.

## The mechanism

Over an 8× radius range:

- **bands per unit screen height is INVARIANT** — 2.83 → 3.00 on Jovian (±8% across the whole
  sweep), and actually *declines* on Saturnian.
- **roughness per unit screen height DOUBLES** — 2.12 → 4.28 (+102%) on both presets.

Those two ratios are precisely the two halves of Max's sentence.

Why the invariance — two exponents that cancel exactly:

| Quantity | Law | Scales as |
|---|---|---|
| Rhines band count `m` | `RHINES_K·√(a·Ω/U)` (`climate-e5.js:121`); `uPeak` measured **constant** (1.3600) across the whole sweep, `rotationRate` is a preset constant | **R^0.5** |
| Lab visual scale `sVis` | `visScaleOf(R) = pow(R, VIS_SCALE_EXP)`, `VIS_SCALE_EXP = 0.5` (`planet-lod-lab-core.js:45`) | **R^0.5** |

The disc grows on screen at exactly the rate the band count grows, so on-screen band *thickness*
is constant. Dragging the radius slider produces a bigger ball wearing the same stripe texture.

Meanwhile the roughness Max *did* see rides a different exponent: `uBandCount = min(16, max(3,
round(12·R/rotationHours)))` (`planet-lod-lab.html:3314`) ∝ **R^1.0** (clamped at 16), feeding
`jetU` / `jetShearGate` / the festoon window (`planet-lod-height.glsl.js:1518/1530/1570`). Growing
∝R against a disc growing ∝√R means visibly finer edge turbulence — the one change that reads.

## Corroboration in pixels

Screenshots at **fixed camera** (Max's UAT condition), R=4 vs R=16: disc grows, stripe texture
scale looks unchanged. Screenshots **size-normalized** (camera distance ∝ sVis, so both discs
subtend the same angle), R=4 vs R=16: R=16 plainly carries more, thinner bands. The bands are
there; the display scale hides them.

## Limitations — stated, not buried

- The band count is measured off the **baked attribute + the shader's own smoothstep/hood**, not
  off framebuffer pixels. It therefore ignores the clouds/haze dressing (F31), limb glow (F34),
  lighting, and the 6-level Bayer posterize. The screenshots corroborate it qualitatively only.
- The fixed-camera R=4 screenshot is notably washed out — **F31 clouds & haze visibly mute the band
  read** at small disc sizes. That is a secondary contributor, unquantified here.
- "This invariance is *why* Max perceived no increase" is an inference. The two measured ratios
  match both halves of his sentence, but perception itself was not measured.

## Process note — a measurement channel that failed silently

The first pass of this probe used derivative-sign-change peak detection, which returns **zero**
extrema on the saturated plateaus a band field produces. It reported a flat, non-monotonic count
(4,2,4,3,4,6,6) and appeared to *confirm* the dead-zone suspect. The error surfaced only because a
threshold sweep produced a physically backwards result (narrowing the dead zone *lowering* the
count). Plateau-aware peak detection plus an independent run-counting method — which now agree with
each other and with the raw ASCII profiles — gave the monotonic answer above.

This is exactly the failure `feedback_measurement-channels-need-planted-defects` exists to catch:
the instrument had no planted-defect control, so a broken counter read as a finding.

## What this means for R1

R1's remaining work is **not** a display-threshold tweak in charted territory. The band read is
correct; the radius→band-count response is live and measurable. What is in question is whether the
lab's `VIS_SCALE_EXP = 0.5` display compression should be allowed to cancel a physical law it was
never scoped against. Note this may be **lab-only**: in-game, where a body renders at its true
size (∝R), the exponents do not cancel and the band-count change should be visible. Not verified
in-game — that check is unrun.

Scope decision is Max's.
