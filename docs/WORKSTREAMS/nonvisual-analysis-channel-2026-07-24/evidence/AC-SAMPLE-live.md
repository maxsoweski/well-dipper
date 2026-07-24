# AC-SAMPLE — live verification + two findings

**Date:** 2026-07-24 · lab on `:5175`, isolated browser context, page closed after · Earth-like preset

## Verdict

**AC-SAMPLE PASS**, with the vertical axis explicitly reported as uncalibrated (finding 1).
Determinism confirmed byte-exact; the physical-unit claim is upheld for horizontal distance and
withdrawn for vertical height.

| Check | Result |
|---|---|
| Same seed + drivers → identical sample | **PASS** — FNV hash `f94f59f4` on both reads |
| Changed seed → sample differs | PASS |
| Earth-preset relief in a sane physical range | **withdrawn, see finding 1** — the vertical axis has no km calibration to be sane in |
| Horizontal distances in real km | PASS — sphere geometry; patch spacing verified to 1% corner-to-centre headlessly |

---

## Finding 1 — the lab's height field has no vertical km calibration

The first live run reported **488 km RMS relief** and a **±1700 km elevation range** for an
Earth-like world. Earth's RMS relief is ~2–3 km, so this was wrong by a factor of ~200. Root cause,
traced through the source rather than guessed:

- **Relief is shaded, not displaced** (`planet-lod-lab.html:1544`). The height field drives a normal
  perturbation for shading; it never becomes geometry. There is no displacement to calibrate against.
- **Amplitudes are dimensionless artistic values.** `deriveUniforms` sets
  `mountainAmp = clamp01(mix(0.25, 0.6, 1 - erosion)) * rockyCrust` — no km anywhere.
- **The km-named knobs are not what drive it.** `mountainHeightKm = 9` exists, and a comment at
  `planet-lod-lab.html:2251` describes an intended `reliefAmplitudeFromKm(heightKm, RE) * K` path,
  but the live write at `:6127` uses `state.mountainAmp` directly.
- **The relief envelope is applied downstream of the sample.** `uPerturb = perturb *
  reliefEnvelope(R, g)` lands at shading time, after the field this instrument reads.

So `h * radiusEarth * 6371` was an unfounded conversion. The instrument now reports vertical
quantities in **height-units**, labelled, with an opt-in `kmPerUnit` if a calibration is ever
established. **A fake physical number is worse than no number** — it is the exact failure mode this
instrument exists to prevent, and it would have been believed.

**What survives uncalibrated — most of the census, as it happens:**

| Still valid | Why |
|---|---|
| every wavelength, crater SFD, drainage & boundary density | horizontal only; sphere geometry |
| hypsometric integral | a ratio — scale-invariant |
| band count | a count |
| spectral slope | vertical scaling moves the intercept, not the slope |

| Affected | New treatment |
|---|---|
| RMS relief, elevation range | height-units, labelled |
| slope in degrees | reported as gradient (units per horizontal unit) — an angle needs both axes in one unit |

---

## Finding 2 — "most energetic bin" is a dead metric on terrain; excess-over-background is not

The first form-size metric returned `dominantWavelength = 2000 km` — **exactly the patch span, at
every radius tested**. Cause: terrain spectra are scale-free red noise (measured slope ≈ −3.9 to
−5.2), so the largest resolvable wavelength always holds the most power. The metric would never
have moved, for any change, while looking like a working measurement. It would have "confirmed"
form-size constancy under literally any build.

Replaced with `spectralExcessPeak`: fit the power-law background in log-log, subtract it, report the
wavelength of peak **excess**. A band-limited feature population (craters of a characteristic
diameter, ridges at a spacing) is a bump above the trend; scale-free roughness is not. It also
returns `excessRatio`, so "there is no form population here" is a reportable answer rather than a
silently-returned window size.

Pinned by three fixtures: it finds a form buried in red noise, it tracks the form as the form
changes size, and it declines to report one for a synthetic pure power law (built in the frequency
domain so it is scale-free by construction).

---

## First radius signal (single seed, no error bars — a preview of AC-CENSUS, not the census)

Earth-like preset, 2000 km patch at (10°, 20°), one seed per radius:

| R (R⊕) | form size (km) | form size (deg) | excess ratio | naive dominant (km) | spectral slope |
|---|---|---|---|---|---|
| 0.5 | 1000 | 17.99 | 1.94 | 2000 | −3.98 |
| 1 | 1000 | 8.99 | 2.39 | 2000 | −3.98 |
| 2 | 35.1 | 0.158 | 1.86 | 2000 | −4.04 |
| 4 | 51.3 | 0.115 | 3.63 | 2000 | −4.47 |
| 8 | 71.4 | 0.080 | 7.69 | 2000 | −5.17 |

**Reading it (R ≥ 2, where a feature population is actually resolved):**

- Physical form size grows **35 → 51 → 71 km** as R doubles twice: ratios 1.46 and 1.39, i.e. **≈ √2
  per doubling — form size ∝ R^0.5**.
- Angular form size falls as **R^−0.5** (0.158 → 0.115 → 0.080).
- On-screen size = angular × disc scale = R^−0.5 × R^0.5 = **constant**.

That is the shipped display keying doing exactly what it was built to do (`_dispR = sVis = R^0.5`),
now measured rather than eyeballed. It also makes the frame question concrete: **forms hold constant
on screen, and therefore grow as √R in physical kilometres.** Whether that is what Max means by
"forms stay the same size" is his call, not a measurement question — but it is now a stated,
quantified property instead of an ambiguity.

**Honest limits of this table:** single seed, so no error bars and no significance — the
`responseCurve` layer (M seeds, mean ± SEM, fitted exponent) is not built yet, and until it is these
numbers are suggestive, not established. R = 0.5 and R = 1 did not resolve a feature population at
all (excess ≈ 2, peak still at the window scale), so the low-radius end of this table is not a
measurement of form size — it is the metric declining, correctly.
