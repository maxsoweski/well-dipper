# G3 — AC-RIVERS, law-audit half: the river width law and the frame it is stated in

**Workstream:** `world-engine-radius-live-feed-2026-07-25` · **AC:** AC-RIVERS (law-audit half)
**Date:** 2026-07-25 · **Branch:** `feature/world-engine-production-L1`
**Instrument:** [`calibration/rivers-width-law-audit.mjs`](../calibration/rivers-width-law-audit.mjs)
**Run:** `node docs/WORKSTREAMS/world-engine-radius-live-feed-2026-07-25/calibration/rivers-width-law-audit.mjs` → **exit 0**, byte-identical on re-run (no RNG, no wall-clock, no network).

Evidence class for the census: this moves rivers from **SOURCE-TRACED** to **LAW-AUDITED**.
It does *not* move it to MEASURED — the field-measurement half (the instrument's response curve on
a channel observable) is the other half of AC-RIVERS and is not covered here.

---

## 1. The answer, in one line

River width is **exactly `k(R) = clamp(1/R, 0.08, 2.5)`** — a **−1 power law in radius over
0.4 ≤ R ≤ 12.5 RE** (86.56 % of slider travel), pinned flat at both ends. It is an
**on-screen-constancy law, not a physical-km law.**

---

## 2. The composed law, derived by hand and then proven by execution

### 2a. The kernel

`planet-lod-rivers.js:264`

```js
export function widthRadiusFactor(radiusEarth, params = DEFAULT_PARAMS) {
  const ref = params.REF_RADIUS_EARTH ?? 1.0;
  const f = ref / Math.max(radiusEarth || ref, 1e-6);
  return Math.min(params.WIDTH_RADIUS_CEIL ?? 2.5, Math.max(params.WIDTH_RADIUS_FLOOR ?? 0.2, f));
}
```

With the **shipped** params (`REF_RADIUS_EARTH = 1`, `WIDTH_RADIUS_FLOOR = 0.08`,
`WIDTH_RADIUS_CEIL = 2.5` — note the live floor is `0.08`; the `?? 0.2` fallback in the body is a
stale default that never fires for `DEFAULT_PARAMS`, and would only fire for a params object missing
the key, which no shipped caller constructs — `planet-lod-tributary-patch.js:372` spreads
`DEFAULT_PARAMS` in explicitly):

```
k(R) = clamp(REF/R, FLOOR, CEIL)
```

The clamp bites where `REF/R` crosses a bound, so the breakpoints are **derived, not chosen**:

| | derivation | value |
|---|---|---|
| `R_ceil`  | `REF / CEIL`  | **0.4 RE** |
| `R_floor` | `REF / FLOOR` | **12.5 RE** |

### 2b. Composition through `paramsForRadius` — why the clamp does *not* break the law

`planet-lod-rivers.js:287` multiplies **`WIDTH_SCALE`, `WIDTH_MIN` and `WIDTH_MAX` all by the same
`k`**. The three consumers of those params all evaluate the same shape,
`clamp(WIDTH_SCALE · φ(accum), WIDTH_MIN, WIDTH_MAX)`:

| | site | role |
|---|---|---|
| W1 | `planet-lod-rivers.js:828` `widthAt` | water ribbon |
| W2 | `planet-lod-rivers.js:945` `halfWidthAt` | valley carve (× `VALLEY_WIDTH_MUL`) |
| W3 | `planet-lod-tributary-patch.js:157` `widthLaw` | Fork B fine ribbon (feeds off the same `paramsForRadius`, `:372`) |

Because all three of `SCALE`, `MIN`, `MAX` carry the same factor, the clamp is **scale-covariant**:

```
clamp(k·S·φ, k·MIN, k·MAX) ≡ k · clamp(S·φ, MIN, MAX)
```

so the delivered width is **exactly `k(R) · width(REF, accum)` for every accum, including fully
saturated trunks and fully floored headwaters**. This is the load-bearing structural fact: had only
`WIDTH_SCALE` been scaled, saturated trunks would have exponent **0** and the law would silently
apply to nothing the eye actually looks at. (That is planted defect **D4**, below.)

The audit does not transcribe those three expressions — it **cuts them out of the live source files
at runtime and executes them**, so it cannot drift from the code it audits without the extraction
guard throwing.

### 2c. The measured composed exponent, per regime

| slider region | regime | k | exponent `d ln w / d ln R` | share of slider travel |
|---|---|---|---|---|
| 0.30 – 0.40 RE | CEIL plateau | 2.5 (bit-exact) | **0** | 7.23 % |
| 0.40 – 12.5 RE | live power law | 1/R | **−1.000000** (max deviation 2.22e-15) | **86.56 %** |
| 12.5 – 16 RE | FLOOR plateau | 0.08 (bit-exact) | **0** | 6.21 % |

Response table (real law, `widthSeedMul = 1`; widths are object-space fractions of a unit sphere):

```
  R=   0.3 RE   k=2.500000   CEIL-PLATEAU    trunk w=2.2500e-2   headwater w=1.1250e-3
  R=  0.35 RE   k=2.500000   CEIL-PLATEAU    trunk w=2.2500e-2   headwater w=1.1250e-3
  R=   0.4 RE   k=2.500000   CEIL-PLATEAU    trunk w=2.2500e-2   headwater w=1.1250e-3
  R=   0.5 RE   k=2.000000   power −1        trunk w=1.8000e-2   headwater w=9.0000e-4
  R=     1 RE   k=1.000000   power −1        trunk w=9.0000e-3   headwater w=4.5000e-4
  R=     2 RE   k=0.500000   power −1        trunk w=4.5000e-3   headwater w=2.2500e-4
  R=     4 RE   k=0.250000   power −1        trunk w=2.2500e-3   headwater w=1.1250e-4
  R=     8 RE   k=0.125000   power −1        trunk w=1.1250e-3   headwater w=5.6250e-5
  R=  12.5 RE   k=0.080000   FLOOR-PLATEAU   trunk w=7.2000e-4   headwater w=3.6000e-5
  R=    14 RE   k=0.080000   FLOOR-PLATEAU   trunk w=7.2000e-4   headwater w=3.6000e-5
  R=    16 RE   k=0.080000   FLOOR-PLATEAU   trunk w=7.2000e-4   headwater w=3.6000e-5
```

### 2d. Where the law stops being a power law — and a warning about single-fit exponents

A **whole-slider chord fit** returns **−0.865577**, not −1. That number is an artefact of the two
clamps, not a law: it equals `ln(FLOOR/CEIL) / ln(R_max/R_min)`, i.e. it is *entirely determined by
the clamp constants and the slider endpoints* once both plateaus are reached.

**The chord exponent is a weak statistic and must not be quoted as "the river exponent."** The audit
measures and prints the chord for every planted defect, and the result is stark: **4 of the 6
planted defects (D2, D4, D5, D6) produce the chord −0.865577 — bit-identical to the real law's.**
Most sharply, **D2 replaces the law with `R^−2`** — the crater-matching mutation — and because the
same two clamps still bracket the slider, its whole-slider chord is *exactly* the real one while its
mid-interior local slope reads −2.000000.

Consequence for the field-measurement half of AC-RIVERS: **a single power-law fit across the whole
radius slider would be blind to two-thirds of the defects this audit catches, including a complete
frame inversion.** Fit only inside **0.4 – 12.5 RE**, or fit per-regime.

---

## 3. WHICH FRAME THE LAW IS IN

> **The river width law is an ON-SCREEN-CONSTANCY law, not a physical-km law: width ∝ 1/R is
> exactly the factor that cancels the growth of the rendered disc, so a river keeps the same
> apparent thickness on screen as the planet gets bigger — the opposite frame from craters, whose
> count ∝ R² is a statement about how many real craters a real surface holds.**

Why that reading and not another:

- The width returned is an **object-space fraction of a unit sphere**, not a length in km. A body of
  radius `R` renders that fraction as an on-screen size ∝ `fraction · R`. Setting `fraction ∝ 1/R`
  makes the product **constant** — that is the definition of holding on-screen form size fixed.
- Equivalently, in physical km the law says a river's real width is **the same number of km on every
  world** (`w_km = fraction · R · 6371 km = const`). That is not a physical claim anyone derived; no
  hydraulic geometry argument says channel width is radius-invariant. It is a *rendering* choice.
- The module's own comment states the intent in exactly those terms
  (`planet-lod-rivers.js:75-77`): *"River width is a real-km footprint; on a unit sphere it occupies
  a fraction ∝ 1/radiusEarth (the inverse of `featureFrequencyFromKm`)."* Being the **inverse of the
  feature-frequency keying** is the signature of a display-keying term.

**Under this project's ratified model this is arguably CORRECT.** Max's ruling composes as
*"physics responds in the physical km frame; the display keying holds on-screen form size
constant"* — and *"planet bigger, forms same size, that's it."* A 1/R width law is precisely the
display half of that ruling. The defect, if there is one, is **architectural, not numerical**: the
display keying is expressed **inside the river module** rather than in the display layer where
`visScaleOf` and the rest of the keying live, so it is invisible to anyone auditing the display
layer and it is easy to mistake for physics.

**Explicitly out of scope here, and deliberately not done:** this audit does **not** change the law
to a physical `R^n` form to match craters. Rivers and craters being in opposite frames is the
*expected* outcome of the ratified model, not a discrepancy to be reconciled. The recommendation is
to **record the frame** (this document, plus the census row) — not to touch the exponent.

What is *not* established: whether the delivered on-screen constancy actually holds end-to-end. That
requires the display-scale term (`sVis`) and the ribbon's geometric radius to compose with `k` as
predicted, which is a render-path question this law audit cannot answer. See §6.

---

## 4. Clamp behaviour, stated honestly

- **The plateaus are hard, not soft.** `k` is **bit-identical** to `CEIL` for every sample below
  0.4 RE and **bit-identical** to `FLOOR` for every sample above 12.5 RE (15 samples each,
  `Object.is`). Inside those regions, moving the radius slider changes river width **not at all**.
- **13.4 % of slider travel is dead** to this law (7.23 % ceil + 6.21 % floor). A user dragging from
  0.30 to 0.40 RE, or from 12.5 to 16 RE, sees zero width response. That is by design (the module
  comment: *"so a giant world's rivers don't vanish and a tiny world's don't bloat"*), and the floor
  was already loosened once — `0.2 → 0.08` under UAT item-1 — precisely to push the dead zone out.
- **Both breakpoints are continuous.** Max relative jump across a breakpoint = **1.0e-9** measured
  at ±1e-9 relative offsets, i.e. pure slope, no step. Sliding across 0.4 or 12.5 RE produces no
  visible discontinuity in river width.
- **`k` is monotone non-increasing across all 2001 samples of the real slider parameterisation**
  (`radiusFromT`), so a bigger world never grows thicker rivers.
- **Degenerate radius inputs are all safe, and one is a quirk worth naming.**
  `null → 1`, `NaN → 1`, `−1 → CEIL`, `1e-9 → CEIL`, and — the quirk — **`radiusEarth = 0` returns
  `1`, not the CEIL**, because `radiusEarth || ref` catches falsy `0` *before* the `1e-6` divide
  guard can see it. So a zero radius is treated as *"unspecified, use reference"*, not as *"an
  infinitely small world."* Harmless today (no caller passes 0), but it means the documented
  `Math.max(…, 1e-6)` guard only ever fires for radii in `(0, 1e-6)`.
- **The canonical-radius seam is byte-safe.** `paramsForRadius(params, 1, 1)` returns the **same
  object** (`===`), not a copy — which is what AC-BYTE's golden identity rests on.
- **The per-planet seed draw does not bend the radius exponent.** Measured exponent is
  `−1.000000` at `widthSeedMul` = 0.6 / 1 / 1.5 (the shipped `WIDTH_SEED_LO/HI` band), **spread
  0.000e+0**. The field-measurement half can therefore fit at a single fixed seed without the number
  being seed-specific.

---

## 5. Planted-defect control (the instrument is proven)

Per `feedback_measurement-channels-need-planted-defects`: an instrument that has never caught a
known defect is unproven. Six defects were injected **by dependency injection into a harness copy of
`paramsForRadius`** — `planet-lod-rivers.js` was never edited, written or staged (confirmed:
`git status` shows only the two pre-existing NOT-OURS modifications).

**Injection fidelity first.** Before any defect run, the harness copy is proved to be the shipped
arithmetic: real `paramsForRadius` ≡ harness shadow, **bit-exact over 3 × 75 × 3 cells**
(3 consumers × [71 radii + 4 degenerate inputs] × 3 seed draws). Without that, a defect run
would be perturbing a law that is not the shipped one and the control would prove nothing.

Each defect names, in advance, the check that must catch it — a defect caught only by an unrelated
check is weak evidence.

| defect | what it does | predicted catcher | caught? | all checks that failed | whole-slider chord |
|---|---|---|---|---|---|
| **D1 EXPONENT-HALF** | width ∝ R^−0.5 | K-INTERIOR-IDENTITY | ✅ | K-INTERIOR-IDENTITY, K-SLOPE, K-CEIL-PLATEAU, K-FLOOR-PLATEAU, K-BREAK-CONTINUITY, K-CHORD | −0.500000 |
| **D2 CRATER-FRAME** | width ∝ R^−2 (the "make rivers match craters" mutation) | K-SLOPE | ✅ | K-INTERIOR-IDENTITY, K-SLOPE | **−0.865577 (identical)** |
| **D3 NO-CLAMP** | FLOOR/CEIL clamp removed | K-CEIL-PLATEAU | ✅ | K-CEIL-PLATEAU, K-FLOOR-PLATEAU, K-CHORD, P-DEGENERATE | −1.000000 |
| **D4 SCALE-ONLY** | `WIDTH_SCALE` scaled, `WIDTH_MIN/MAX` left at reference | W-COVARIANCE | ✅ | W-COVARIANCE, W-SEED-SEPARABLE | **−0.865577 (identical)** |
| **D5 SEED-BENDS-R** | radius exponent bends with the seed draw (identity at seedMul 1) | W-SEED-SEPARABLE | ✅ | W-SEED-SEPARABLE | **−0.865577 (identical)** |
| **D6 GUARDS-REMOVED** | `\|\| ref` and `1e-6` divide guards deleted | P-DEGENERATE | ✅ | P-DEGENERATE | **−0.865577 (identical)** |

**6 / 6 caught by their predicted check. Every defect failed at least one check — the instrument is
blind to none of them.** The rightmost column is the warning of §2d, measured: **4 of the 6 defects
are invisible to a whole-slider power-law fit.**

Verbatim failure lines from the control run:

```
  D1 EXPONENT-HALF — width ∝ R^−0.5 instead of R^−1
    predicted catcher: K-INTERIOR-IDENTITY  →  CAUGHT ✓
    whole-slider chord = -0.500000  (real law: -0.865577);  mid-interior local slope = -0.500000
    all checks failed: K-INTERIOR-IDENTITY, K-SLOPE, K-CEIL-PLATEAU, K-FLOOR-PLATEAU, K-BREAK-CONTINUITY, K-CHORD
      · K-INTERIOR-IDENTITY: max |k·R/REF − 1| = 2.534e+0 at R=12.4875
      · K-SLOPE: max |slope − (−1)| = 5.000e-1 (slope -0.500000 near R=0.6155)
      · K-CEIL-PLATEAU: k(0.3000) = 1.8257418583505538 ≠ 2.5 (bit)
      · K-FLOOR-PLATEAU: k(12.5125) = 0.2827013970960878 ≠ 0.08 (bit)
      · K-BREAK-CONTINUITY: max relative jump = 3.536e-9 at R=12.5
      · K-CHORD: whole-slider chord = -0.500000, clamp-derived prediction = -0.865577 (rel 4.224e-1)

  D2 CRATER-FRAME — width ∝ R^−2 — the "make rivers match craters" mutation
    predicted catcher: K-SLOPE  →  CAUGHT ✓
    whole-slider chord = -0.865577  (real law: -0.865577  ← IDENTICAL: invisible to a whole-range fit);  mid-interior local slope = -2.000000
    all checks failed: K-INTERIOR-IDENTITY, K-SLOPE
      · K-INTERIOR-IDENTITY: max |k·R/REF − 1| = 7.091e-1 at R=3.4374
      · K-SLOPE: max |slope − (−1)| = 1.000e+0 (slope -2.000000 near R=0.6708)

  D3 NO-CLAMP — the FLOOR/CEIL clamp removed (pure 1/R everywhere)
    predicted catcher: K-CEIL-PLATEAU  →  CAUGHT ✓
    whole-slider chord = -1.000000  (real law: -0.865577);  mid-interior local slope = -1.000000
    all checks failed: K-CEIL-PLATEAU, K-FLOOR-PLATEAU, K-CHORD, P-DEGENERATE
      · K-CEIL-PLATEAU: k(0.3000) = 3.3333333333333335 ≠ 2.5 (bit)
      · K-FLOOR-PLATEAU: k(12.5125) = 0.07992007992007992 ≠ 0.08 (bit)
      · K-CHORD: whole-slider chord = -1.000000, clamp-derived prediction = -0.865577 (rel 1.344e-1)
      · P-DEGENERATE: −1 (negative → 1e-6 floor → ceil): kR = 1000000, expected 2.5

  D4 SCALE-ONLY — WIDTH_SCALE scaled by k but WIDTH_MIN/MAX left at reference
    predicted catcher: W-COVARIANCE  →  CAUGHT ✓
    whole-slider chord = -0.865577  (real law: -0.865577  ← IDENTICAL: invisible to a whole-range fit);  mid-interior local slope = -1.000000
    all checks failed: W-COVARIANCE, W-SEED-SEPARABLE
      · W-COVARIANCE: max rel dev = 9.200e-1 — W1 widthAt (planet-lod-rivers.js:828)
        R=12.5125 accum=1.00 got 4.500000e-4 want 3.600000e-5
      · W-SEED-SEPARABLE: exponent at seedMul 0.6/1/1.5 = -0.628421 / -0.874076 / -1.000000 (spread 3.716e-1)

  D5 SEED-BENDS-R — the radius exponent bends with the per-planet seed draw (identity at seedMul 1)
    predicted catcher: W-SEED-SEPARABLE  →  CAUGHT ✓
    whole-slider chord = -0.865577  (real law: -0.865577  ← IDENTICAL: invisible to a whole-range fit);  mid-interior local slope = -1.000000
    all checks failed: W-SEED-SEPARABLE
      · W-SEED-SEPARABLE: exponent at seedMul 0.6/1/1.5 = -0.960000 / -1.000000 / -1.050000 (spread 9.000e-2)

  D6 GUARDS-REMOVED — the `|| ref` and 1e-6 divide-by-zero guards deleted
    predicted catcher: P-DEGENERATE  →  CAUGHT ✓
    whole-slider chord = -0.865577  (real law: -0.865577  ← IDENTICAL: invisible to a whole-range fit);  mid-interior local slope = -1.000000
    all checks failed: P-DEGENERATE
      · P-DEGENERATE: 0 (falsy → treated as unspecified, NOT as the ceil): kR = 2.5, expected 1
```

Note **D4** in particular: it is *only* caught by the composed-law checks. Every kernel-level check
(`K-*`) passes cleanly for D4, because its kernel `k(R)` is the real one — the defect lives in how
`paramsForRadius` composes it. A law audit that stopped at `widthRadiusFactor` would have declared
D4 healthy while saturated trunk rivers had exponent 0.

And the same battery on the **real** law:

```
── REAL LAW ────────────────────────────────────────────────────────────
      ✓ K-INTERIOR-IDENTITY  max |k·R/REF − 1| = 1.110e-16
      ✓ K-SLOPE              max |slope − (−1)| = 2.220e-15
      ✓ K-CEIL-PLATEAU k ≡ 2.5 across 15 samples
      ✓ K-FLOOR-PLATEAU k ≡ 0.08 across 15 samples
      ✓ K-BREAK-CONTINUITY   max relative jump across breakpoints = 1.000e-9
      ✓ K-MONOTONE           non-increasing over 2001 slider samples
      ✓ K-CHORD              whole-slider chord = -0.865577 = ln(FLOOR/CEIL)/ln(Rmax/Rmin)
      ✓ W-COVARIANCE         max rel |w(R,a) − k(R)·w(REF,a)| = 2.189e-16 over 3×71×12 cells
      ✓ W-SEED-SEPARABLE     exponent ≡ -1.000000 at seedMul 0.6/1/1.5 (spread 0.000e+0)
      ✓ P-IDENTITY           paramsForRadius(params, REF, 1) === params (same object)
      ✓ P-DEGENERATE         all 5 guard cases exact
  ⇒ ALL CHECKS PASS
```

### Thresholds and why each is the right one

Abbreviated; the full reasons print with every run.

| check | threshold | why that threshold |
|---|---|---|
| K-INTERIOR-IDENTITY | 1e-12 | `k` is one IEEE division ⇒ `k·R/REF−1` ≲ 2 ulp ≈ 4.4e-16. 1e-12 = 3 orders of round-off headroom, still ~1e9× tighter than a −1 → −0.999 change (2.5e-3 at R=12). |
| K-SLOPE | 1e-9 | log-ratio ≥ 0.08 per sample pair ⇒ double-log noise ~1e-14. 1e-9 is 5 orders above noise, 6 below the smallest meaningful exponent change (1e-3). |
| K-CEIL / K-FLOOR-PLATEAU | **exact (bit)** | `Math.min`/`Math.max` return the bound *operand*. "Close" would mean the clamp was replaced (soft-min, lerp) — a tolerance would hide the defect the check exists for. |
| K-BREAK-CONTINUITY | 3e-9 | jump measured at ±1e-9 relative; a continuous law with \|slope\| ≤ 1 moves ≲2δ. A real discontinuity jumps by a fraction of the clamp gap (≥1e-2), ~7 orders over. |
| K-MONOTONE | **exact** | any increase at all contradicts the law's intent; zero tolerance by construction. |
| K-CHORD | 1e-12 | non-circular: chord must equal `ln(FLOOR/CEIL)/ln(Rmax/Rmin)` from the **imported** constants, proving both plateaus are reached inside the slider domain. |
| W-COVARIANCE | 1e-12 | the identity is exact algebra; only ≤3 double ops of re-association (~5e-16) are admissible. 1e10× tighter than D4's failure (0.92). |
| W-SEED-SEPARABLE | 1e-12 | same round-off budget; guards the field half's right to fit at one seed. |
| P-IDENTITY | **exact (`===`)** | AC-BYTE rests on the same object flowing through, not an equal copy. |
| P-DEGENERATE | **exact** | a NaN here makes `WIDTH_SCALE` NaN and every river vanishes silently. |
| H-SHADOW-FIDELITY | **exact (bit)** | if the injection target differed from the shipped law, the control would prove nothing. |
| X-PATCH-GRIDRES-BREAK | bracket | see §6 — `Math.ceil` makes the breakpoint a bracket, not a point. |

---

## 6. Secondary finding — the *other* river radius law, and what this audit does not cover

`widthRadiusFactor` is not the only place radius reaches rivers. Reported because "do rivers answer
radius" is a question about the **system**, not one function.

**`deriveTributaryGridRes` (`planet-lod-lab.html:3815`)** sets the Fork B fine-lattice density
∝ R, clamped `[56, 560]`. Extracted from the lab source and executed the same way:

```
  gridRes: R=0.3 → 134,  R=1 → 444,  R=1.26 → 559,  R=4 → 560,  R=16 → 560
  closed-form saturation bracket = [1.260895, 1.263151] RE ; first saturating sample = 1.261074 RE
  FINDING: the fine-lattice density is CEIL-PINNED for R ≳ 1.263 RE, i.e. over 63.8% of slider travel.
```

**The tributary-patch density stops answering radius above ~1.26 RE — for roughly two-thirds of the
slider.** Flagged, not fixed, and **dormant**: `patchStrength` defaults to `0.0`
(`planet-lod-lab.html:1541`), so the patch is off unless deliberately enabled. Candidate for R2.

*Audit self-correction, recorded rather than quietly retuned:* the first version of this check
asserted a point saturation radius of `R(560)` and **FAILED** by 8 sample steps, because the
extracted function takes a `Math.ceil` — `ceil(x) ≥ 560 ⟺ x > 559`, so the honest criterion is the
bracket `[R(559), R(560)]`, not a point. The threshold was wrong, not the code.

**Not covered by this audit** (stated so the census row does not over-claim):

1. **Field measurement.** This is a law audit. It proves the pure functions deliver
   `k(R) = clamp(1/R, 0.08, 2.5)` and that all three width consumers carry it exactly. It does
   **not** prove that number reaches pixels — a routed network, a render and an observable are the
   other half of AC-RIVERS.
2. **End-to-end on-screen constancy.** §3 names the *frame the law is written in*. Whether apparent
   width is actually held constant depends on how `k` composes with the display-scale term and the
   ribbon's geometric radius in the render path. Unverified here.
3. **Network topology.** Only *width* was audited. Channel count, spacing and drainage density are
   set by the terrain and the fixed 40 k mesh, not by `widthRadiusFactor`; the known consequence
   (a single global mesh cannot resolve a big world's thread-thin rivers) is the long-deferred
   view-dependent river-LOD workstream, not this one.

---

## 7. Census row this evidence supports

| System | Radius reaches it? | Evidence | Detail |
|---|---|---|---|
| **Rivers** | ✅ **WIRED** | **LAW-AUDITED** | Width `k(R) = clamp(REF/R, 0.08, 2.5)` — exponent **−1.000000** on 0.4–12.5 RE (86.56 % of slider travel), flat plateaus outside; all 3 width consumers exactly k-covariant. **Frame: ON-SCREEN CONSTANCY (display keying), not physical km** — the opposite frame from craters' physical count ∝ R², and correct under the ratified model. 6 planted defects, 6 caught. Not yet field-measured. Secondary: the dormant tributary-patch density law is ceil-pinned above ~1.26 RE (R2). |
