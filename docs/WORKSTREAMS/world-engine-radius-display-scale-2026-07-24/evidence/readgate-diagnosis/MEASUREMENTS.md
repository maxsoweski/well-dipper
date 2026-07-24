# READ-GATE DIAGNOSIS — band-width measurements

**Workstream:** `world-engine-radius-display-scale-2026-07-24`
**Measured:** 2026-07-24 · measurement agent
**Build:** `feature/world-engine-production-L1` HEAD `8c8a0d8` (radius-scale-fix; gates green, verify PASS)
**Captures:** `evidence/readgate-diagnosis/` per `staging.json`
**Question:** which of C1 (instrument seed-variance) / C2 (baked-stamp contamination) /
C3 (real un-keyed analytic form) drives the gate-(b) form-size-constancy FAIL
(band widths 26.1/40.7/32.8 px, 22.5% max deviation vs ≤15% bar).

---

## Instrument (reconstruction of the original gate's band-width measure)

Per READGATE-VERDICT.md / FIX-PLAN §READ-GATE(b): *"median light↔dark relief-band width
on the center disc-crossing scanline, detrended, dither-suppressed, 21-scanline +
param-ensemble robust."* The original code was not archived, so the instrument was
**rebuilt from the prose and locked against the known anchor** (below).

Per image: luminance (Rec.601) → locate disc center + per-row inside-disc span (mask
lum>12) → 21 disc-crossing scanlines (±10 rows about center) → per scanline, on the
edge-trimmed inside-disc segment: **detrend** (subtract a Gaussian of σ = frac·span,
removing the sphere-shading gradient) → **dither-suppress** (Gaussian σ≈6 px, merges
fine relief into the *macro* light/dark bands the gate names) → **zero-crossing spacings**
(each crossing = one light↔dark boundary; spacing = one band width). **Param-ensemble:**
sweep detrend_frac∈{0.18,0.22,0.26} × dither_σ∈{5,6,7} × edge_trim∈{0.08,0.10,0.12}; POOL
every spacing across all 21 scanlines and all 27 param sets → **median = band width**
(pooling out-votes near-instability param sets, which yield few, wide crossings).

**Anchor validation (instrument run on the ORIGINAL gate crops X/Y/Z):**
Z(r0.5)=26.26, X(r2)=34.93, Y(r8)=28.28 px → max|dev| **17.1%**.
Original gate reported 26.1 / 40.7 / 32.8 → 22.5%. Same non-monotonic signature
(r2 largest, r0.5 smallest, r8 middle); Z matches to 0.2 px. The 17.1% vs 22.5% gap is
the reconstruction reading the r2/r8 peak lower (my median metric compresses the peak);
it is **instrument-reconstruction difference, not staging drift** — proven below.

---

## Staging-drift check (definitive)

The diagnosis `bake1-*` trio was pixel-diffed against the original gate crops:

| pair | decoded pixels identical? | max abs channel diff |
|------|---------------------------|----------------------|
| bake1-r0.5 vs readgate/Z | **YES** | 0 |
| bake1-r2 vs readgate/X | **YES** | 0 |
| bake1-r8 vs readgate/Y | **YES** | 0 |

The re-render reproduced the original gate's exact pixels (only PNG container bytes/md5
differ). **`stagingDrift = false`.** Any band-width difference from the original 22.5%
is the reconstructed instrument, not the captures.

---

## (1) BAKE0 trio — C2/C3 discriminator (pure analytic body, effective bake=0 at all r)

| disc | radius | sVis | band width (px) | dev from mean (25.82) | disc diam (px) |
|------|--------|------|-----------------|-----------------------|----------------|
| bake0-r0.5 | 0.5 | 0.707 | 27.95 | +8.3% | 277 |
| bake0-r2   | 2.0 | 1.414 | 21.22 | **−17.8%** | 585 |
| bake0-r8   | 8.0 | 2.828 | 28.28 | +9.5% | 1078 (clipped) |

**bake0 max|dev| = 17.8%.** Removing the baked stamp population does **not** collapse the
deviation — it is ~equal to (marginally above) the bake1 17.1%. Pattern is non-monotonic
(smallest band at the *middle* radius), not a systematic radius drift.

## (3) BAKE1 trio — original-gate sanity anchor (effective bake = crossover)

| disc | radius | sVis | band width (px) | dev from mean (29.82) | disc diam (px) |
|------|--------|------|-----------------|-----------------------|----------------|
| bake1-r0.5 | 0.5 | 0.707 | 26.26 | −11.9% | 285 |
| bake1-r2   | 2.0 | 1.414 | 34.93 | **+17.1%** | 577 |
| bake1-r8   | 8.0 | 2.828 | 28.28 | −5.2% | 1078 (clipped) |

**bake1 max|dev| = 17.1%** (reconstruction; original gate = 22.5% on these *identical*
pixels). Reproduces the original non-monotonic signature. Not wildly different → no drift.

## (2) SEED ensemble — C1 discriminator (5 seeds, r=2 FIXED, bake=1: pure instrument seed-noise, ZERO radius effect)

| seed (macro) | band width (px) | dev from mean (33.74) | disc diam (px) |
|--------------|-----------------|-----------------------|----------------|
| 1234  | 34.93 | +3.5%  | 577 |
| 777   | 23.63 | −30.0% | 581 |
| 4242  | 37.11 | +10.0% | 581 |
| 9001  | 23.31 | −30.9% | 570 |
| 31337 | 49.74 | **+47.4%** | 581 |

**seedNoiseFloorPct (max|dev| across all 5) = 47.4%.** s31337 is darker (lumMax 183 vs
~212) and reads coarse/less-stable; **excluding it the floor is still 24.8%** (range
23.3–37.1 px). Either way the instrument's inherent spread across different random
patterns at ONE fixed radius (**24.8–47.4%**) is **≥ the whole radius-trio deviation**
(bake1 17.1%, bake0 17.8%, original 22.5%).

## (4) Disc diameters (sanity — P6 disc-growth layer)

r0.5→r2 grows **×2.02 (bake1) / ×2.11 (bake0)** — clean ×2 per radius step, confirming the
disc-growth (sVis) layer is intact and did not regress (consistent with gate (a) PASS).
r8 discs are **frame-clipped** (true ~1170 px → measured 1078 on the center row). Seed
ensemble discs are all r=2, 570–581 px (identical size by construction; only pattern varies).

---

## Verdict on the three candidate causes

**Dominant cause: C1 — INSTRUMENT SEED-VARIANCE.** The band-width instrument's seed-noise
floor at a single fixed radius (24.8% conservative / 47.4% full) **exceeds** the radius
trio's deviation (17.1% reconstructed, 22.5% original). Because the display re-keys the
terrain per radius, the three trio members are *different random patterns*, and the median
band width of different patterns spreads by more than the ≤15% bar with **zero** radius
effect. The gate's ≤15% bar sits **below the instrument's resolving power** — the "miss" is
within instrument noise.

**C2 — BAKED-STAMP CONTAMINATION: ruled out as the driver.** At bake=0 the deviation is
17.8%, essentially unchanged from bake1's 17.1% (not collapsed below 15%). If the baked
mesh-floor residue drove the miss, isolating the analytic mechanism would have dropped it;
it did not. The miss is not the documented residue.

**C3 — REAL UN-KEYED ANALYTIC FORM: weak / unsupported.** The bake0 trio does still exceed
15% (17.8%), but (a) that is within the seed-noise floor, so it is not distinguishable from
pattern noise, and (b) it is **non-monotonic** (smallest band at the middle radius r2),
whereas a genuine un-keyed form would grow monotonically with sVis. No clean systematic
radius signal survives.

**Bottom line:** the gate-(b) FAIL is a measurement-resolution artifact (C1), not a display
defect. The band-width instrument cannot certify form-size constancy to ≤15% because its own
seed-noise floor is ~25–47%. Removing the baked stamps (C2) does not help, and no
systematic analytic drift (C3) is present. Conclusion holds whether the trio reads 17.1%
(this reconstruction) or 22.5% (original) — both are below even the conservative 24.8% floor.
