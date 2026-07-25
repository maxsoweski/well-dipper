# Live integration ACs — driven by working-Claude on :5175 (2026-07-25)

Isolated browser context, one page, closed after. Max's tabs untouched.
All sweeps at fixed `worldSeed`/`macroSeed` = 1, so **radius is the only input that moves**.

---

## AC-BANDS — PASS, with a distinction that nearly produced a false failure

**The visible response (Max's headline).** Jovian, jets on, seed fixed, 14 log-spaced radii over
R = 3 → 16 R⊕:

| R | 3.00 | 3.88 | 5.02 | 6.50 | 7.39 | 8.40 | 9.56 | 10.87 | 12.37 | 14.07 | 16.0 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E5 band count | 5 | 6 | 7 | 8 | 9 | 9 | 10 | 11 | 12 | 13 | 14 |
| F25 jet ladder | 4 | 5 | 6 | 8 | 9 | 10 | 12 | 13 | 15 | 16 | 16 |

Monotonic, r² = 0.991. Pre-rewire this row was **constant** — the expression did not reference the
drawn radius at all (pinned by `tests/radius-live-feed.test.js` → "PLANTED DEFECT: the frozen form
never flips"). `peakU` was measured **exactly constant** (1.35998, zero variance) across the sweep and
rotation is frozen, so radius is provably the only mover.

**THE DISTINCTION — recorded because I nearly reported a law failure on it.** The first fit gave
`N ∝ R^0.632 ± 0.018` (dof 12, 95% CI [0.594, 0.670]), which **excludes 0.5**. That looked like the
Rhines law failing. It is not. `bandCount` and the Rhines wavenumber are **different quantities**:

- `rhinesWavenumber(rotationRate, radius, uPeak)` (`climate-e5.js:121`) — **the law**. Audited
  headlessly over 40 radii: unrounded exponent **0.500000** (r² = 1, stdErr 0); as shipped, with
  the `round()` + `M_MIN` floor, **0.49647 ± 0.00925** (dof 38, 95% CI [0.478, 0.515]) — contains
  0.5. **Positive control:** an exponent-0.75 law is measured as 0.75, so the audit is not blind.
- `bandCount` (`climate-e5.js:218`) — a **diagnostic**: zero-crossings of the realized `u(φ)` profile,
  which also carries the signed equatorial jet and the Ward polar structure. It is a readout of the
  field, not proportional to `m`. Its own 0.632 exponent is a property of that readout.

**Verdict:** the law is exact and is now live-fed; the visible band structure responds. The 0.632 is
reported as a measured fact about the diagnostic, **not** as a defect — I have not established that
the diagnostic's relation to `m` is wrong, only that it is not the identity.

---

## AC-REGIME — PASS, both halves, as amended

**Cloud regime (reads DRAWN radius).** Sub-Neptune, 16 radii over R = 2 → 10:

```
2:2  2.23:2  2.48:2  2.76:2  3.07:2  3.42:2  3.81:2  4.24:2  4.72:2  5.25:2  5.85:2
  ↓ flip
6.51:0  7.25:0  8.07:0  8.98:0  10:0
```

Exactly **one** flip, bracketed [5.848, 6.510] — the source threshold is 6. No other flip anywhere.

**Giant dynamo (reads CANONICAL radius — the amended disposition).** 16 radii over R = 1 → 16:

| preset | aurora intensity across the whole sweep | flips |
|---|---|---|
| Ice giant (Neptunian) | `0.6` — constant | 0 |
| Sub-Neptune (hazy) | `0.1` — constant | 0 |

Both invariant under the slider (the classifier property) **and still separated from each other**
(0.6 vs 0.1) — which is the discrimination the 3.5 cutoff exists to make, and which a drawn-radius
gate provably cannot make at any seed. The Neptunian aurora that the pre-correction build
extinguished on 67.5% of seeds is intact at every radius.

---

## AC-RIVERS — PASS; law confirmed live, and a new radius-blindness found

**Width law, measured in the live render path** (not just in the pure function — this is the half G3
could not do). Rocky, 12 radii over R = 0.4 → 14, spanning both clamps:

- Unclamped band (10 values): exponent **−1.00003 ± 0.00058**, r² = **0.999997**, dof 8.
- `k · R` across that band: `1.000206, 1.000185, 0.999950, 0.999708, 1.000610, 1.001340, 0.999128,
  0.998111, 0.997533, 1.003216` — constant to ~3e-3, i.e. `k = 1/R` exactly.
- Clamps confirmed live: `k = 2.5` (ceiling) at R = 0.4; `k = 0.08` (floor) at R = 14.
- `widthViolations = 0` at every radius.

This confirms G3's headless audit **through the render**, and confirms the **frame**: width is an
object-space fraction of a unit sphere scaling as 1/R, so on-screen width is held constant. That is
display keying — the **opposite frame** from craters' physical `count ∝ R²`. Under Max's ratified
model it is defensible; it is now measured and named rather than assumed. Not changed.

**NEW FINDING — the river POPULATION is radius-blind.** `channelCount` over the same sweep:

| R | 0.40 | 1.05 | 2.01 | 3.84 | 5.31 | 7.33 | 10.13 | 14.0 |
|---|---|---|---|---|---|---|---|---|
| channels | 5215 | 5215 | 5215 | 5215 | 7212 | 6799 | 6518 | 6404 |
| maxStrahler | 6 | 6 | 6 | 6 | 5 | 5 | 4 | 4 |

Fit: exponent 0.084 ± 0.023, r² **0.58** — not a power law. The count is *identical* (5215) across a
9.6× radius range, then steps discontinuously as `maxStrahler` drops 6 → 5 → 4. That signature is
mesh/LOD resolution, not a radius law: **a bigger world does not get more rivers, it gets the same
drainage network drawn at coarser Strahler depth.**

This is the **same class of gap as volcanism** in the census ("scale only, not population"). Rivers
respond in *width* (display frame) and not at all in *population* (physical frame). Recorded as an
**R2 item** — the census row is updated accordingly rather than being marked plainly WIRED.
