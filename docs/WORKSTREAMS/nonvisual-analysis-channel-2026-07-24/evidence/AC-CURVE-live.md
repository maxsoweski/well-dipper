# AC-CURVE — live response curves, with error bars

> ## ⚠ CORRECTION (2026-07-25, adversarial review) — the significance claims below are WRONG
>
> An adversarial review workflow confirmed a defect in `fitPowerLaw`/`lawVerdict`: **z = 2 was quoted
> as ~95%, but that is only the large-sample limit.** A power-law fit over N driver values has
> dof = N − 2, so this sweep — three radii — ran at **dof = 1, where the true 95% multiplier is
> t = 12.71, not 2.** A Monte-Carlo over the module's own code showed a law that is EXACTLY TRUE
> reported FAIL 34% of the time at three values.
>
> **What that invalidates in this document:**
> - "the screen constancy is 2.8σ from exact" — **NOT significant.** At dof = 1 the interval is
>   ±0.19, which contains zero comfortably. The on-screen exponent is consistent with exactly constant.
> - "the physical exponent 0.4583 ± 0.0148 is 2.8σ below an exactly-0.5 law, so this sweep says FAIL"
>   — **withdrawn.** 0.5 sits well inside the corrected interval. There is no measured departure
>   from √R.
>
> **What survives unchanged:** the point estimates and their SEMs, the noise-floor table, the
> `radiusEarth` control at exactly 1.000, and the qualitative reading (physical form size grows,
> angular shrinks, on-screen ≈ constant). Only the *significance* statements were wrong.
>
> The bin-quantisation caveat already flagged below was correct, but it was the *second* reason the
> drift is not reportable; this is the first, and it was missed. Fixed in `stats.js` (`tCritical95`,
> `dof` returned from `fitPowerLaw`, `lawVerdict` accepting `dof`); pinned by
> `tests/instrument-review-fixes.test.js`.


**Date:** 2026-07-24 · lab `:5175`, isolated context, page closed after · Earth-like preset
· 2000 km patch at (10°, 20°) · M = 5 seeds per radius

## Verdict: PASS

The sweep returns mean ± SEM at every point and a fitted exponent with its own standard error, and it
sizes its own ensemble before running. Three instrument bugs were found and fixed in the process
(below) — each would have produced a confidently misleading report.

---

## Built-in positive control

`radiusEarth` is measured as a descriptor alongside everything else. Its fitted exponent against the
radius driver comes back **1.0000 ± 0.0000, r² = 1.000** — proof inside every sweep that the driver
actually moved and the fitting machinery is sound. A sweep where this control is not exactly 1 is
broken, whatever else it says. (This was an accident of including it; it is kept deliberately.)

## The noise floor — the retired instrument, quantified

Pilot ensemble, 8 seeds at fixed R = 4 (where the radius effect is zero by construction, so all
spread is instrument noise). Compare against the band-width instrument the read-gate used, whose
floor was **24.8–47.4%**:

| descriptor | noise floor (CV) | seeds to measure at 15% | seeds to resolve 15% at 2σ |
|---|---|---|---|
| spectral slope | **1.3%** | 1 | 1 |
| **form wavelength** | **8.8%** | **1** | **2** |
| gradient (mean) | 9.4% | 1 | 2 |
| form excess ratio | 13.7% | 1 | 4 |
| hypsometric integral | 17.5% | 2 | 6 |
| RMS relief (uncalibrated vertical) | 30.7% | 5 | 17 |
| elevation max (uncalibrated vertical) | 75.9% | 26 | 103 |

**The form-size metric's floor is 8.8% against the retired instrument's 24.8–47.4% — roughly 3–5×
tighter.** That is why a 15% bar is now measurable where it previously was not. The noisiest
descriptors are precisely the uncalibrated vertical ones (finding 1 of AC-SAMPLE).

---

## The radius response

R ∈ {4, 8, 16}, M = 5, zero failed readings.

| R (R⊕) | form size (km) | ± SEM | on-screen proxy | ± SEM |
|---|---|---|---|---|
| 4 | 50.26 | 0.26 | 0.2260 | 0.0012 |
| 8 | 67.89 | 2.35 | 0.2159 | 0.0075 |
| 16 | 96.00 | 4.00 | 0.2158 | 0.0090 |

Fitted exponents against radius:

| quantity | exponent | ± SE | r² (weighted) | reading |
|---|---|---|---|---|
| physical form wavelength | **+0.4583** | 0.0148 | 0.999 | grows with radius, close to √R |
| angular form wavelength | −0.5417 | 0.0148 | 0.999 | shrinks with radius |
| **on-screen size** | **−0.0417** | 0.0148 | 0.889 | very nearly constant |
| radiusEarth (control) | 1.0000 | 0.0000 | 1.000 | ✔ driver confirmed moving |

**What this says.** The shipped display keying is doing its job to within a few percent: on-screen
form size holds nearly flat across a 4× radius change, while physical form size grows as ≈ R^0.46.
Max's ratified sentence — "the planet gets bigger, the forms stay the same size" — is now a measured
property rather than an impression, in the frame where it is true (screen), with the frame where it
is false (physical km, forms grow ≈ √R) stated alongside.

**Two honest qualifications, neither of which the eye could have supplied:**

1. **The screen-frame constancy is not exact.** −0.0417 ± 0.0148 is 2.8σ from zero, so the residual
   drift is statistically resolvable, not noise: on-screen forms shrink ~6% across R = 4 → 16.
2. **That deviation is at the edge of the metric's own resolution.** The excess peak lands on integer
   radial FFT bins, so near k ≈ 40 the achievable wavelengths are ~2.5% apart and a 4% effect spans
   only ~1.6 bins. The drift may be bin quantisation rather than real display drift. **Distinguishing
   the two needs a finer patch or sub-bin interpolation** — flagged, not resolved, and it should not
   be reported to Max as a defect until it is.

Also measured: the physical exponent 0.4583 ± 0.0148 is 2.8σ below an exactly-0.5 law, so if the
display convention claims exactly √R, this sweep says **FAIL** rather than PASS — subject to the same
bin-quantisation caveat.

---

## Three instrument bugs found by running it

1. **Seeds swept as descriptors.** The first pilot reported that `macroSeed` had a 54% noise floor —
   true and meaningless, since the sweep is what varies it. Bookkeeping now lives under a `meta`
   namespace that the sweep excludes structurally.
2. **Coefficient of variation quoted for zero-crossing quantities.** `elevation.min` has a mean near
   zero, so CV came out at 484% and the plan demanded **1040 seeds**. That is division by
   almost-nothing, not an instrument property. Such descriptors are now marked
   `relativeNoiseUndefined` with their absolute spread, and excluded from the headline figure — which
   dropped from 1040 to 26, and now names the descriptor driving it.
3. **Unweighted r² beside a weighted fit.** The first radius sweep reported r² = −1.46 next to an
   accurate exponent, because one point with 40× the standard error counted full freight in an
   unweighted residual sum. r² is now computed with the fit's own weights; the same data reads 0.999.

A fourth was caught in test: `pilot.map(flatten)` passes the array **index** as the flatten prefix,
namespacing every sample separately and collapsing each to n = 1.
