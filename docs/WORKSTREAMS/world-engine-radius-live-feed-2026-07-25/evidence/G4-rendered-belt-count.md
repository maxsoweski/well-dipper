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

## Fitted exponents (added at close-out, 2026-07-28)

The table above, run through the instrument's own `fitPowerLaw` / `lawVerdict`
(`src/worldengine/instrument/stats.js`, uniform weighting, n=7, **dof=5 ⇒ t95 = 2.571** — not z=2,
per the 2026-07-25 review correction):

| Quantity | Fitted exponent | r² | Verdict |
|---|---|---|---|
| **RENDERED belt count vs R** | **+0.532 ± 0.029** | 0.986 | **PASS** vs the Rhines claim 0.5 — consistent with √R *and* distinguishable from the null 0 (resolving power 0.073) |
| bands per screen height vs R | **+0.031 ± 0.029** | 0.20 | consistent with **ZERO** — the invariance, quantified. |0.031| < t95·SE = 0.073 |
| roughness per screen height vs R | **+0.361 ± 0.040** | 0.943 | significantly **non-zero** (0.361 ≫ 0.102) — the change Max *did* see |

That is Max's UAT sentence in three numbers: the belt count obeys the physical law (0.532 ≈ 0.5),
the on-screen belt *density* he was looking at does not move (0.031 ≈ 0), and the edge roughness
does (0.361). Fit script: `scratchpad/g4fit.mjs` pattern — inputs are the seven rows above verbatim.

Caveat carried: the belt counts are the rendered post-smoothstep quantity but derived from the baked
attribute, not from framebuffer pixels (see Limitations). The exponent therefore certifies the
*field-through-shader* count, and the size-normalized screenshots corroborate it qualitatively.

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
correct; the radius→band-count response is live and measurable.

### The lab-only question — resolved at source (2026-07-27), no in-game run needed

Both halves of the collision are **lab-only**, and the game has no stake in it at all:

- `visScaleOf` / `VIS_SCALE_EXP` appear **only** in `planet-lod-lab-core.js`, `planet-lod-lab.html`
  and `tests/` — **zero occurrences in `src/`**.
- The E5 band deck is equally lab-only: nothing in `src/` consumes `aBand`, `zonalBandCol` or
  `HEIGHT_GLSL` (the sole `src/` hit is a comment in `emission-e.js:251`). `climate-e5.js` and
  `storm-e.js` are *writers*; the only render seam is the lab.
- The game still bands planets from **hard-coded literal frequencies** in `src/objects/Planet.js`
  — `sin(lat * 3.5)` (gas giant, :256), `sin(lat*2.5) + sin(lat*5.0)` (hot Jupiter, :268),
  `sin(lat*3.0) + sin(lat*6.0)` (sub-Neptune, :280). **No Rhines law, no radius term whatsoever.**

So the exponent collision cannot reach the game, and there is no in-game radius→band-count
behaviour to compare against. This is the charter's deliberate lab≠game split
(`docs/FEATURES/planet-lod-CHARTER.md`), not a regression.

**Consequence:** the R1 UAT failure has zero shipped-game impact today. It is a lab-viewing
artifact of a knob whose own source comment calls it "the ONE UAT-tunable knob"
(`planet-lod-lab-core.js:44`).

### Close-out read-gate — framebuffer pixels, at pinned angular size (2026-07-28)

The Limitations section above says this probe measured the baked attribute through the shader's
smoothstep, **not framebuffer pixels**. That gap is now closed, at two radii.

Working-Claude, isolated browser context on :5175 (page closed after; Max's own tab untouched),
Jovian / macroSeed 1 / jets ON, with the angular-size pin installed
(`state.distance = 3.0 * sVis` re-applied every frame):

| | R = 4 | R = 16 | Δ |
|---|---|---|---|
| disc size on screen | 807 × 804 px | 807 × 804 px | **0 px — the pin holds exactly** |
| dark/light runs, detrended central strip | 11 | 15 | **+36%** |
| detrended contrast RMS | 23.1 | 40.4 | **+75%** |

Images: `evidence/G4-pinned/pinned-R4-jovian.png`, `pinned-R16-jovian.png` (disc crops, same scale).

Method: luminance of a ±3%-width vertical strip through the disc centre, detrended against a
22%-height moving average (removes the limb/lighting gradient), runs counted with the same ≥6/500
of disc height minimum as the attribute probe.

**Standing:** corroboration, not a competing measurement — two radii, one strip, with the F31
clouds/haze/great-spot dressing in frame. It agrees in sign and magnitude-direction with the 7-point
attribute fit and it is measured on the pixels Max actually looks at. The contrast rise (+75%) says
part of what reads at the large-R end is *legibility*, not only *count* — the F31 muting flagged in
Limitations, seen from the other side.

### Recommended disposition (Max's call)

Do **not** change `VIS_SCALE_EXP` to chase this. Instead re-spec AC-BANDS to judge band count at
**pinned angular size** (camera distance ∝ sVis — the discipline `renderDeltaSweep` already
applies via `SWEEP_DISTANCE * sVis`, `planet-lod-lab.html:5370`). At pinned angular size the
radius→band response is plainly visible, as the size-normalized screenshots above show. The
alternative — retuning the display scale so the exponents stop cancelling — trades a physical
law's legibility against every other radius-scaled read in the lab, which is a much larger blast
radius for a lab-only viewing convenience.
