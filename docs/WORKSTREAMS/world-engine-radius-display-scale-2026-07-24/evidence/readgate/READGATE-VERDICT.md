# READ-GATE VERDICT — radius display-scale (post-UAT-fail rebuild)

**Workstream:** `world-engine-radius-display-scale-2026-07-24`
**Adjudicated:** 2026-07-24 · read-gate adjudicator (post-blind)
**Build under test:** `feature/world-engine-production-L1`, Slices A–D landed.
**Slice-D mechanism actually shipped:** `bake→synth` crossover
(`bakeReliefCrossover`, `BAKE_CROSS_SPAN=1.0`) — the **FIX-PLAN fallback**, NOT the
route re-bake. (Recorded here because it changes how the residue below should be read.)
**Staging (truth):** Rocky (Earthlike), seed 1234/5678, cam yaw 0.337 / pitch 0.205 /
dist 6.0, `octaves=8` frozen, `reliefBakeStrength_base=1.0`, uTime pinned 12.0,
canvas 900×900 CSS → identical centered 1100×1100 crops, GUI chrome hidden every capture.

## VERDICT: **FAIL** (1 of 4 bars missed)

The disc-ordering, slider, and bigger-vs-closer discrimination all pass cleanly. The
**form-size constancy bar fails at 22.5% vs the ≤15% bar** — the characteristic macro-relief
band width is not held constant enough across the trio. This is the core of Max's sentence
("forms remain the same size while the planet gets bigger"), so the miss is on the load-bearing
gate, not a peripheral one.

---

## Bars (from FIX-PLAN.md §READ-GATE spec)

| # | Bar | Required | Result | Pass |
|---|-----|----------|--------|------|
| a | Blind size-ordering | 3/3 scorers order small→large correctly | 3/3 (all `Z, X, Y`) | ✅ |
| b | Form-size constancy | max\|dev\| ≤ 15% on characteristic band px | **22.5%** | ❌ |
| c | Bigger-vs-closer pair | correct ID (pairB = bigger planet) | pairB = bigger, correct | ✅ |
| d | Slider monotonic (trusted drag) | radius rises monotonically across track | 0.80 → 2.10 → 5.76 RE | ✅ |

---

## Gate (a) — Blind size-ordering: **PASS (3/3)**

Truth ordering small→large: **Z (r0.5) · X (r2) · Y (r8)** (disc `sVis` = 0.707 / 1.414 / 2.83,
×2 per step).

| Scorer | Order (small→large) | Correct? | Confidence |
|--------|---------------------|----------|------------|
| 1 | Z, X, Y | ✅ | High — Z ~280px, X ~570px, Y fills frame |
| 2 | Z, X, Y | ✅ | High — Z small central, X larger w/ margins, Y overflows |
| 3 | Z, X, Y | ✅ | High — Z widest black margin, X intermediate, Y overflows edges |

All three blind scorers matched truth with high confidence. Disc-diameter measurements
corroborate: X/Z = 2.04, Y/X = 1.98 → clean ×2 disc growth per radius step, so the P6
disc-growth layer (`sVis`) is intact and did not regress. **3/3 required, 3/3 achieved.**

## Gate (b) — Form-size constancy: **FAIL (22.5% > 15%)**

Characteristic macro-relief band width (median light↔dark band on the center disc-crossing
scanline, detrended / dither-suppressed / 21-scanline + param-ensemble robust):

| Disc | Radius | Band width (px) | Dev from mean (33.2px) |
|------|--------|-----------------|------------------------|
| Z | 0.5 | 26.1 | **−21.4%** |
| X | 2 | 40.7 | **+22.6%** |
| Y | 8 | 32.8 | −1.2% |

**max\|dev\| = 22.5% — over the ≤15% bar.** If the fix fully held forms constant on screen,
these three band widths would be near-equal while the disc grows ×2 per step; instead they
span 26–41px.

Note the failure is **not** the clean "forms grow with radius" signature of an un-applied fix:
the outliers are Z (smallest planet, smallest band) and X (middle planet, largest band), with
Y (largest planet) sitting almost exactly on the mean. The cross-check **mean band spacing**
(X 59.7 / Y 64.2 / Z 42.0) does rise weakly with radius, so there is *some* residual growth,
but the primary median-band measure is non-monotonic. Read together: the macro body is
partially — not fully — decoupled from the disc, and the residual is noisy rather than a clean
large-radius drift. See the honest-residue note below for why the disclosed mesh-floor residue
does **not** fully excuse this.

## Gate (c) — Bigger-vs-closer discrimination pair: **PASS (correct ID)**

Pair present (pairA.png / pairB.png), both matched-disc at r8 (`sVis=2.83`, identical disc px).
Truth: **pairB = the bigger planet; pairA = the camera moved closer.**

Measured pair call:
- **pairB** — median band 41.9px, ~14 scanline crossings → **relatively smaller / more numerous
  forms = "a bigger planet"** cue. ✅ matches truth.
- **pairA** — median band 134.6px, ~6 crossings → few huge forms growing with the disc =
  "camera moved closer" cue.

The size-of-forms cue flipped from "closer" (pairA) to "bigger" (pairB) as intended.
**Correct call.** (Capture note: `Y.png` is byte-identical to `pairB.png` — both are the fixed
build at r8, consistent by construction.)

## Gate (d) — Trusted slider drag monotonicity: **PASS**

Real CDP pointer drags (`Input.dispatchMouseEvent`) on the lil-gui **log** slider track — the
pointer-capture profile the prior AC never exercised (it only drove `state.planetRadiusEarth` +
`applyDrivers` programmatically):

| Target track fraction | Landed t | Radius (RE) | sVis |
|-----------------------|----------|-------------|------|
| 0.25 | 0.248 | 0.804 | 0.897 |
| 0.50 | 0.489 | 2.097 | 1.448 |
| 0.75 | 0.743 | 2.400… (5.758 RE) | 2.400 |

Strictly monotonic: **0.80 → 2.10 → 5.76 RE** across the track. The real pointer drag reliably
moves radius **up** across the whole 0.3–16 span — this addresses the UAT "does not reliably go
up" complaint at the pointer-capture layer where it actually failed. **Pass.**

---

## Honest residue note — mesh-floor stamped population & the shipped fallback

FIX-PLAN §D3 disclosed one form no display transform can correct: the **discrete stamped
basin/crater population** is angular-fixed physics geometry floored at
`MESH_FLOOR_RAD = 0.055` (inc3b, `bombardment.js:86`). Beyond ~radius 8 (`sVis ≈ 2.83`),
holding it constant would require sub-mesh-floor craters, **impossible on the frozen 256²/cube
substrate Max froze.** Fine stamped craters therefore retain some growth at large radius — the
disclosed, signed residue.

Three honest caveats on how that residue interacts with this verdict:

1. **The residue does NOT excuse the gate-(b) failure.** The residue predicts growth at the
   *largest* radius (Y, r8). But Y's band width is the one sitting on the mean (−1.2%); the
   22.5% deviation is driven by **X (r2, +22.6%)** and **Z (r0.5, −21.4%)** — mid/small radii,
   below the mesh-floor ceiling. So the constancy miss is in the **continuous-body macro relief**
   the fix was supposed to fully hold, not in the un-correctable stamped-crater tail. The bar
   fails on its own terms.

2. **The shipped mechanism is the FALLBACK, not the recommended route re-bake.** Per mapping,
   Slice D landed as the `bake→synth` crossover (`bakeReliefCrossover`, `BAKE_CROSS_SPAN=1.0`),
   which swaps the body *source* (baked plate-Voronoi macro body → analytic FBM body) as `sVis`
   departs 1. FIX-PLAN §D3 flagged this exact trade: "loses stamped basins at large radius — a
   visible morph in continent character." That morph is a **content confound** in the band
   measurement: the thing being measured (continent character) changes across the trio, not just
   its size, which plausibly contributes to the noisy, non-monotonic deviation pattern above.

3. **Pair-gate caveat (D3 residue, disclosed):** pairA is a baked plate-Voronoi body and pairB
   an analytic FBM body, so the pair renders differ in continent *character* as well as size.
   The size-of-forms discrimination (few-large vs many-small) is nonetheless unambiguous and is
   what gate (c) scores — pass stands, with the character-morph residue noted.

**Bottom line for Max:** disc growth, slider reliability, and the bigger-vs-closer cue-flip are
delivered. The literal "forms stay the same size" target is close but **not** met at the ≤15%
bar (22.5%), and the miss is in the correctable macro body — not the disclosed mesh-floor tail —
under the fallback crossover mechanism rather than the recommended route re-bake. This gate is a
**FAIL**; it should not go to UAT as-is on gate (b).
