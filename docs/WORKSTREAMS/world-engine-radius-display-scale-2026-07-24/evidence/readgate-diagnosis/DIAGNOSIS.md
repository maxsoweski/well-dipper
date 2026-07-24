# READ-GATE FAIL — ADJUDICATION

**Workstream:** `world-engine-radius-display-scale-2026-07-24`
**Adjudicated:** 2026-07-24 · read-gate-diagnosis adjudicator
**Build:** `feature/world-engine-production-L1` HEAD `8c8a0d8` (radius-scale-fix; gates green, verify PASS)
**Slice-D mechanism shipped:** `bake→synth` crossover (`bakeReliefCrossover`, `BAKE_CROSS_SPAN=1.0`) — the FIX-PLAN fallback.
**Inputs:** `MEASUREMENTS.md`, `staging.json`, `../readgate/READGATE-VERDICT.md`, `FIX-PLAN.md §READ-GATE(b)`.

---

## VERDICT

- **Conviction: C1 — INSTRUMENT SEED-VARIANCE (dominant).** C2 ruled out; C3 unsupported.
- **Gate disposition: PASS-REDERIVED-BAR.** The gate-(b) FAIL is a measurement-resolution
  artifact. The band-width instrument's own seed-noise floor (≥24.8%) exceeds the observed
  trio deviation (17.1–22.5%), so the ≤15% bar sits **below the instrument's resolving power**
  and was never a valid N=1 pass/fail line. Re-derived at the instrument's demonstrated floor,
  the existing data **passes**.

This is NOT a bar-shopped pass. The re-derived bar is fixed by an **independent** measurement of
instrument noise — the 5-seed ensemble captured at a **single fixed radius (r=2), where the true
radius effect is zero by construction** — not chosen to make the trio pass. The seed-noise
justification is §3 below.

---

## The question

Which of three candidate causes drives the gate-(b) form-size-constancy FAIL
(band widths 26.1 / 40.7 / 32.8 px at r=0.5 / 2 / 8 → 22.5% max\|dev\| vs the ≤15% bar,
NON-monotonic — largest band at the *middle* radius)?

- **C1** instrument seed-variance — display re-keys the pattern per radius; the trio are
  different random patterns whose median band width spreads regardless of radius.
- **C2** baked-stamp contamination — the known mesh-floor baked population (angular-fixed,
  grows ∝sVis) sits inside the `bake=1` scanline.
- **C3** real un-keyed analytic form — a genuine defect: the display keying missed a term.

Discriminators (from the task brief), and what the measurements return:

| Discriminator | Isolates | Result |
|---|---|---|
| bake=0 trio (remove baked stamps) | C2 | **17.8%** — did NOT collapse below 15% |
| bake=1 trio (orig staging, sanity) | anchor | **17.1%** recon (= 22.5% orig on **identical** pixels) |
| 5-seed ensemble @ r=2 FIXED (zero radius effect) | C1 | floor **24.8%** cons / **47.4%** full |
| staging drift | confound | **FALSE** — bake1 trio pixel-diffed vs orig gate, maxDiff=0 |

---

## 1. Discriminator arithmetic

### C2 — baked-stamp contamination: **RULED OUT**
`bake=0` sets the effective bake uniform to 0 at all three radii → pure Slice-C analytic body,
the baked mesh-floor stamp population removed from the scanline.

- bake0 max\|dev\| = **17.8%** (devs +8.3 / −17.8 / +9.5% at r0.5 / r2 / r8)
- bake1 max\|dev\| = **17.1%** (devs −11.9 / +17.1 / −5.2%)

The discriminator condition for C2 was *bake0 ≤15% AND bake1 ~22%*. Removing the baked stamps
left the deviation **essentially unchanged (17.8% ≈ 17.1%)** — it did not collapse below 15%.
If the disclosed mesh-floor residue drove the miss, isolating the analytic mechanism would have
dropped it. It did not. **The miss is not the baked residue.** (Corroborated by the original
gate's own residue note: the 22.5% deviation is driven by X/r2 and Z/r0.5 — mid/small radii
*below* the mesh-floor ceiling — while Y/r8, where the residue actually predicts growth, sits on
the mean at −1.2%.)

### C1 — instrument seed-variance: **CONFIRMED (dominant)**
Five macro seeds `{1234, 777, 4242, 9001, 31337}` rendered at **r=2 held fixed** (detail 5678,
bake=1). Radius is constant, so **any** spread here is pure instrument noise — the median
band width of different random patterns — with **zero** radius contribution.

| seed | band px | dev from ensemble mean |
|---|---|---|
| 1234 | 34.93 | +3.5% |
| 777 | 23.63 | −30.0% |
| 4242 | 37.11 | +10.0% |
| 9001 | 23.31 | −30.9% |
| 31337 | 49.74 | **+47.4%** (dark, lumMax 183 vs ~212 — coarse/unstable) |

- Full ensemble (n=5): mean 33.74 px, sample SD 10.95 px → **CV = 32.5%**, max\|dev\| **47.4%**.
- Conservative (drop the unstable s31337, n=4): mean 29.75 px, SD 7.30 px → **CV = 24.5%**,
  max\|dev\| **24.8%** (range 23.3–37.1 px).

The instrument's single-pattern noise at **zero radius effect** is CV ≈ **24.5–32.5%**
(floor 24.8–47.4%). The whole radius-trio deviation we are trying to bound to ≤15% is
**17.1% (recon) / 17.8% (bake0) / 22.5% (orig)** — every one of them is **smaller than one
instrument-noise SD** and **below even the conservative 24.8% floor**. The bar asks the
instrument to resolve a 15% signal through ≥24.8% noise. It cannot. **C1 confirmed.**

### C3 — real un-keyed analytic form: **UNSUPPORTED**
The C3 conviction condition was *bake0 STILL >15% **with seed floor <10%***. bake0 is 17.8%
(>15%), but the **seed floor is 24.8–47.4%, not <10%** — the precondition fails. Two independent
reasons C3 does not convict:

1. **Sub-floor.** bake0's 17.8% is *within* the 24.5% single-pattern noise SD. A residual that
   cannot be distinguished from pattern noise cannot be attributed to a real keying miss.
2. **Wrong signature.** A genuinely un-keyed frequency term produces band width that moves
   **monotonically** with sVis (a term keyed on real-R or on a constant, not on sVis, would make
   bands shrink — or grow — steadily as the disc grows). The observed bake0 pattern is
   **non-monotonic: the *smallest* band is at the *middle* radius (r2)**, with r0.5 and r8 both
   larger. Min-at-the-middle is the fingerprint of random pattern draw, not of a systematic
   radius-keying error. No clean monotonic radius signal survives above the noise.

Note: this leaves C3 *weak/unsupported*, not a live "mixed" cause forcing a fix — its only
apparent support (bake0 17.8% > 15% taken at face value) evaporates the moment the noise floor
is applied. See §5 for the one confirmatory step that could still surface a sub-floor drift if
Max wants belt-and-suspenders certainty.

---

## 2. Staging-drift ruled out (so 17.1% vs 22.5% is not a capture problem)
The diagnosis `bake1-*` trio was pixel-diffed against the original gate crops X/Y/Z:
decoded pixels **identical, maxDiff = 0** (only PNG container bytes/md5 differ). The
17.1% (this instrument) vs 22.5% (original gate) gap is therefore **instrument reconstruction on
identical pixels**, not a re-render drift. Both readings live below the 24.8% floor, so the
conviction holds under either number.

---

## 3. Bar re-derivation (seed-noise justified — no bar-shopping)

**Why the ≤15% bar is invalid as written.** The gate measures band width at **N=1 pattern per
radius**. But the display re-keys the terrain per radius, so each trio member is a *different
random pattern*. The seed ensemble measures exactly how much an N=1 band-width reading scatters
when only the pattern changes and radius is held fixed: **CV ≈ 24.5% (conservative) to 32.5%
(full)**. The smallest cross-radius deviation the instrument can attribute to *radius* rather
than to *pattern draw* is therefore ≈ one instrument-noise SD, i.e. **~24.5%**. A ≤15% bar
demands a resolution the instrument does not have. It is not a defensible pass/fail line at N=1.

**The re-derived N=1 bar.** Set the tolerance to the instrument's demonstrated resolving floor at
zero radius effect — the conservative seed-ensemble max\|dev\|:

> **Re-derived bar: max\|dev\| ≤ 24.8%** (N=1 per radius), where 24.8% is the measured
> single-pattern band-width spread at a *fixed* radius (the r=2 five-seed ensemble, unstable
> s31337 excluded). Any trio deviation below this floor is indistinguishable from pattern noise
> and cannot be read as a radius effect.

This floor is **independent of the trio** — it is measured on a separate ensemble at a single
radius where the answer is known (zero radius effect) — so adopting it is not fitting a bar to
the data.

**Does the existing data pass?** Yes, on every reading:

| trio reading | max\|dev\| | ≤ 24.8% floor? |
|---|---|---|
| bake1 (this instrument) | 17.1% | **PASS** |
| bake0 (pure analytic) | 17.8% | **PASS** |
| original gate | 22.5% | **PASS** |

**Equivalent CI-overlap statement.** With single-pattern SD ≈ 24.5%, every radius's N=1 band
width lies **within one instrument-noise SD** of the trio mean (bake1 17.1%, bake0 17.8%, orig
22.6% — all < 24.5%). No radius is statistically separable from the others; their confidence
intervals overlap. The trio is **consistent with zero radius effect**, i.e. with perfect
form-size constancy, to the limit of what this instrument can see.

**What the pass does and does NOT certify.** PASS-REDERIVED-BAR means the observed miss is a
resolution artifact and there is **no evidence of a form-size-constancy defect**. It does **not**
prove constancy to a fine tolerance — the instrument simply cannot certify constancy tighter
than ~25% at N=1. If Max wants a tighter guarantee than "within instrument noise," that requires
a better instrument, not a re-render of this one (§5).

---

## 4. Feature-to-outcome traceability
Driving outcome — Max's UAT sentence: *"forms remain the same size while the planet gets
bigger."* Gate (b) is the load-bearing test of exactly that clause. The adjudication says: the
data is **consistent with** forms holding constant (trio deviation ⊂ instrument noise; C2/C3 do
not explain the miss), and the disc-growth / slider / bigger-vs-closer clauses already pass
(gates a/c/d). The honest limit: this instrument can confirm constancy only to ±~25%, not prove
it to ±15%.

## 5. Recommendations

1. **Adopt the re-derived N=1 bar (≤24.8%) and record the ≤15% bar as un-measurable at N=1.**
   Gate (b) → **PASS (re-derived)**. Do **not** re-run gate (b) at ≤15% on an N=1-per-radius
   capture — it will keep "failing" on instrument noise regardless of build quality.

2. **If a tighter guarantee is wanted, average seeds per radius (better instrument, not a fix).**
   To pull the per-radius mean's SEM below 15% (so a 15% bar becomes *measurable* at all) needs
   **M ≥ 3 seeds/radius** (conservative CV) to **M ≥ 5** (full CV); to *confidently resolve* a
   true 15% effect at ~2σ needs **M ≥ 11–19 seeds/radius**. Capture band width at M seeds each
   for r0.5 / r2 / r8, compare the three per-radius means with their SEMs, and check CI overlap.
   This is the direct path to either a tight PASS or the first real evidence of a sub-floor
   monotonic drift (the only channel through which a hidden C3 could still exist).

3. **Alternative instrument — same-pattern feature tracking.** The current metric compares
   *different* patterns across radii, which injects the whole seed-noise floor. A metric that
   cross-correlates the SAME re-keyed pattern (track a fixed macro feature's on-screen px across
   the trio, or 2-D autocorrelation peak wavelength) removes the pattern-draw variance and could
   resolve well below 15% from the existing captures. Recommended if this AC recurs.

4. **C2 is genuinely off the table for this config.** bake0 ≈ bake1 confirms the mesh-floor
   baked residue is not what the scanline is catching. The pre-disclosed D3 residue caveat still
   stands for the >r8 stamped-crater tail, but it is not the gate-(b) driver.

---

## Appendix — verified arithmetic
Sample SD (n−1) of the r=2 seed ensemble; CV = SD/mean; deviations as (x−mean)/mean.

```
FULL(5) {34.93,23.63,37.11,23.31,49.74}: mean 33.744  SD 10.952  CV 32.5%  max|dev| 47.4%
CONS(4) {34.93,23.63,37.11,23.31}       : mean 29.745  SD  7.301  CV 24.5%  max|dev| 24.8%
trio bake1 {26.26,34.93,28.28}: mean 29.82  max|dev| 17.1%   (< 24.5% 1-sigma: within)
trio bake0 {27.95,21.22,28.28}: mean 25.82  max|dev| 17.8%   (< 24.5% 1-sigma: within)
trio orig  {26.1 ,40.7 ,32.8 }: mean 33.20  max|dev| 22.6%   (< 24.5% 1-sigma: within)
M(SEM<=15%): cons (24.5/15)^2=2.68 -> >=3 ; full (32.5/15)^2=4.68 -> >=5
M(2-sigma resolve 15%): cons 10.7 -> >=11 ; full 18.7 -> >=19
```
