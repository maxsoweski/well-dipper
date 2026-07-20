# Live integration-AC results — world-engine-atmo-deck-spiral-rhines-2026-07-19

**Driven by:** working-Claude, 2026-07-20, fresh isolated CDP context on `:5178`
(`http://localhost:5178/well-dipper/planet-lod-lab.html`), atmo worktree on
`feature/world-engine-atmo-3b` (HEAD `64ce6a9`). Puppeteer-core over the existing Chrome
(`:9223`); one new page opened, reused for every probe, closed at the end. Max's three other
pages (`:5173/:5175/:5176`) left untouched.

**Numeric method:** screenshots captured via `page.screenshot` (composited blit output — reliable
regardless of the WebGL renderer's non-preserved drawing buffer), decoded with `pngjs`, sampled at
storm-frame ring/interior coordinates. Storm centres projected object→screen via the live camera
(`Vector3.project`); spin frozen (`spinSpeed=0`, `planet.rotation.y=0`); camera oriented so the
probed storm sits at screen centre with `sunToCamera()` lighting it. All ring samples are in units
of the drawn storm radius (`state.spotRadius`). **Screenshots this run are 2225×1060** (dpr 1.25);
the prior workstream's evidence is 2230×1062 — dimensions differ, so no byte-aligned pre-change
pixel diff was possible (bears on AC-ADVECT-REGRESS below).

**Console:** captured across every drive (`error`/`warning`/`pageerror`). **Zero console
errors/warnings** the entire session.

**These are OBJECTIVE integration probes, not UAT.** AC-UAT (holistic acceptance) remains Max's
alone and is not touched here.

---

## AC-DECK — **PASS**

**Method:** fixed seeds. Mode-0 = aged Jovian great spot (seed 1, ageScalar 0.978, mode 0,
`uStormCount` 1). Mode-1 = Neptunian dark spots at a mature (seed 42, age 0.928) AND a
young/precursor (seed 7, age 0.025) lifecycle phase — the F-deep young-spot case. Rings sampled at
0.85R (rim/emboss), 1.05R (collar), 1.6R (surroundings); interior disk <0.35R for mode-1.

**Mode-0 tower (Jovian seed 1) — emboss + cold annulus:**
- **Emboss luminance asymmetry across the shading axis:** the rim ring carries a strong
  wavenumber-1 luminance modulation — amplitude **46.5 % of the ring mean**, rim max/min ratio
  **3.18×**. A one-cycle bright/shaded axis, exactly the per-storm emboss shading. Visually: a
  shaded-relief oval with a serrated comb along the shaded edge (`ac-deck-mode0-jovian-seed1.png`).
- **Cold annulus collar (desaturated + blue-shifted):** collar saturation **0.175 vs surroundings
  0.312** (desaturated), collar blue-ratio **0.298 vs 0.268** (blue-shifted). Both match the
  cold-annulus recast (not a bright luminance collar).

**Mode-1 reveal (Neptunian) — interior in the belt-derived deep-deck family, NOT `uStormColor`:**
measured as chroma (RGB normalised by sum) distance of the sampled interior to `deepBase =
bandTint·(0.62,0.52,0.42)·(0.72,0.60,0.52)` vs to `uStormColor`.

| spot | age | interior→deepBase | interior→stormColor | verdict |
|---|---|---|---|---|
| mature (seed 42) | 0.928 | **0.057** | 0.094 | interior in deep-deck family |
| young (seed 7)   | 0.025 | **0.020** | 0.151 | interior in deep-deck family (F-deep clamp holds) |

Interior is closer to the belt-derived deep deck than to the storm hue on BOTH ages; the young
precursor is the cleanest (0.020 vs 0.151 — the 1.5 luminance-donor clamp keeps it in family).
Visually the dark spot reads as a hole you look into with a grey-green deep-deck floor, not the
blue band hue (`ac-deck-mode1-neptunian-young-seed7.png`, `…-mature-seed42.png`).
- **Band-frequency rim wisps:** detectable but subtle — rim-ring luminance modulation 3–8 % at
  k4–k6 (`WISP_K` = 0.10 is a deliberately low Phase-A candidate weight). Present, weak.

**Evidence:** `ac-deck-mode0-jovian-seed1.png`, `ac-deck-mode1-neptunian-mature-seed42.png`,
`ac-deck-mode1-neptunian-young-seed7.png`.
**Deviation:** hood interaction NOT probed (F16-hood — unreachable on the drawn population, per
BUILD-NOTES; unfalsifiable, correctly excluded from the recipe).

---

## AC-SPIRAL — **PASS** (mechanism live + age-scaled; exact wrap-turn count carried by headless S4)

**Method (per the BUILD-NOTES F9 deviation — radial/annular read, NOT a fixed-rr ring):** aged
Jovian great spot (seed 1, age 0.978) vs young (seed 123, age 0.08). Storm-ON vs storm-OFF A/B at
identical camera (`greatSpotEnabled` toggled; `uStormCount` 1⇄0) so the static band field cancels
and the storm's own contribution is isolated; collar/annulus rings DFT'd for the KH wavenumber;
arm colour sampled at 1.5R.

**Measured:**
- **Arms carry entrained band colour (clean):** aged arm chroma distance **0.049 to bandTint vs
  0.193 to stormColor** — the spiral arms carry band pigment, not the red storm hue.
- **KH scallop at the predicted wavenumber, age-scaled:** on the storm ON−OFF collar diff-ring
  (band field cancelled), the amplitude at **wavenumber 42** (the `SPIRAL_NB` formula value) is
  **2.02 for the aged storm vs 1.09 for the young** — ~1.9× stronger on the aged storm, at exactly
  the predicted lobe count. Visually the aged storm shows an unmistakable regular serrated comb
  around its collar (`ac-spiral-jovian-aged-seed1.png`).
- **Winding present and age-directional:** annulus low-azimuthal-wavenumber (k1–4) RMS/mean =
  **0.451 aged vs 0.332 young** — more band-bending around the older storm, consistent with
  `W ∝ ageScalar`.

**Method limitation (honest):** the *exact* `wrap_visible` turn count (BUILD-NOTES calibration
≈0.54 turns at age 1) is NOT separately pixel-measured — at the live screenshot's effective
resolution the sub-turn winding is confounded by the storm body, dWake, and the band field. That
quantitative claim, plus the literal 42-lobe count, rests on the **green headless S4 unit proofs**
(radial-Δψ wrap ∝ ageScalar, 42-lobe count, GLSL↔`BAND_SPIRAL` constant parity, envelope bound —
all passing at seam 4). The live probe confirms the mechanism READS on screen: entrained band
colour in the arms, a 42-wavenumber scallop whose amplitude scales with age, and age-directional
winding. Full PASS on the integration intent; no wrap-turn number is claimed from pixels that the
pixels cannot support.

**Evidence:** `ac-spiral-jovian-aged-seed1.png`, `ac-spiral-jovian-young-seed123.png`,
`ac-spiral-ab-aged-ON/OFF.png`, `ac-spiral-ab-young-ON/OFF.png`.

---

## AC-POP — **PASS**

**Method:** storms disabled; equatorial full-disk view (distance 2.6R, pitch 0, `sunToCamera`);
band count read three ways — (1) `uBandM`, the derived Rhines count that literally sets the
jet/stripe frequency in the shader; (2) a fine-striping spectral metric = summed DFT amplitude of
the central-meridian luminance profile over spatial wavenumbers k4–k10; (3) visual contact sheet.
Drawn presets plus two explicit pinned extremes (large fast gas: R14/8 h; small slow ice: R3/20 h).

| world | `uBandM` | fine-striping energy (k4–10) | read |
|---|---|---|---|
| ice giant, small+slow (R3/20 h) | **2** | 5.6 | few broad bands |
| Neptunian (drawn R3.4/17.5 h) | **2** | 5.6 | few broad bands |
| Saturnian (drawn R9.4/10.7 h) | 10 | 34.1 | fine striping |
| Jovian (drawn R11/13.4 h) | **11** | 64.2 | fine striping |
| gas giant, large+fast (R14/8 h) | **16** | 78.3 | finest striping |

**Spread:** derived band count spans **2 → 16 (8×)**; drawn Jovian 11 vs drawn Neptunian 2 = **5.5×**
— both well over the required ×2. The visible fine-striping spectral energy tracks it monotonically
(5.6 → 78.3, ~14×). The contact sheet (`ac-pop-contact-sheet.png`) shows the two ice giants as
smooth featureless blue disks (few broad bands) beside three visibly belted gas giants.

**Evidence:** `ac-pop-contact-sheet.png` + the five per-world captures (`ac-pop-*.png`).
**Note:** the automated pixel band-count is unreliable for the *complex* gas-giant profiles (Rhines
m counts jets; visible belts add harmonics), so `uBandM` (the count that drives the striping) plus
the fine-striping spectral discriminator are used as the authoritative count; the ×2+ spread is
decisive on all three measures.

---

## AC-ADVECT-REGRESS — **PASS** (honest fallback — no dimension-matched pre-change reference)

**Method:** stormless Jovian seed 1234 (`greatSpot`/`stormTrain`/`polarVortex` all off), captured
BOTH with radius+rotation pinned canonical (R11.2/9.9 h) AND at the drawn values (R11.0/13.4 h).

**Measured:**
- `uStormCount` = **0** in both captures ⇒ `dSpiralVec` branches to identity (**dSpiral identically
  0**) and every deck term is inert (all inside the count gate) — structurally guaranteed and
  live-confirmed.
- Canonical-pinned band count `uBandM` = **13**; drawn `uBandM` = **11**. The gas band count changes
  BY DESIGN on drawn worlds (S1 Rhines-radius wire + rotation draw) — this is why the AC requires
  pinning radius+rotation canonical (per AC-OFFGATE's build-time clarification). At canonical
  pinning the count matches the pre-change preset-constant path.
- Whispiness present: the stormless canonical render shows the dAdvect turbulent/feathered band
  texture intact (`ac-advect-stormless-canonical-pinned.png`).

**Method limitation (explicit, no overclaim):** there is NO pre-change screenshot in this workstream,
and the prior workstream's stormless captures are 2230×1062 vs this run's 2225×1060 — the ~5×2 px
mismatch makes a byte-aligned pixel diff meaningless (sub-pixel misregistration against the retro
dither would manufacture false diffs). So NO pixel diff was run. AC-ADVECT-REGRESS is closed via the
strongest honest method available: (a) live confirmation `uStormCount` = 0 ⇒ dSpiral/deck inert;
(b) canonical pinning reproduces the pre-change band count; (c) whispiness visibly intact; (d) the
already-proven **code-level byte-identity of dAdvect** — the band-flow `[parity]` dAdvect pins are
green (per the BUILD-NOTES fast-fence at every seam), i.e. dAdvect's source is provably untouched.

**Evidence:** `ac-advect-stormless-canonical-pinned.png`, `ac-advect-stormless-drawn-unpinned.png`.

---

## Summary

| AC | Verdict | One-line method |
|---|---|---|
| AC-DECK | **PASS** | fixed-seed pixel probes: mode-0 emboss wave-1 46.5 %/collar desat 0.175<0.312+blue-shift; mode-1 interior chroma closer to deepBase than stormColor on mature+young |
| AC-SPIRAL | **PASS** | ON/OFF A/B: arms carry band colour (0.049 vs 0.193), k=42 scallop age-scaled (2.02 vs 1.09), winding age-directional (0.451 vs 0.332); exact wrap-turn count carried by green headless S4 |
| AC-POP | **PASS** | storms-off contact sheet: uBandM 2→16 (8×), drawn 11 vs 2 (5.5×), fine-striping energy 5.6→78.3 |
| AC-ADVECT-REGRESS | **PASS** | stormless canonical-pinned: uStormCount 0 (dSpiral≡0), band count matches pre-change, whispiness intact + dAdvect byte-identity green; no dim-matched reference for a pixel diff (documented) |

No new console errors. dAdvect (Max-LIKED taste fence) provably untouched. UAT (AC-UAT) remains
Max's gate alone.
