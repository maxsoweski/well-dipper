# G2 — AC-CRATERBOOT: is `planet-lod-lab.html:5146` allowed to keep reading the canonical preset radius?

**Verdict: NO PRESET FLIPS. The site stays canonical. This document is the pinned reason.**

Settled by measurement, not by design opinion, per the contract's own instruction
("THE :5146 CRATER-BOOT SITE IS SETTLED BY MEASUREMENT, NOT BY A DESIGN CALL").

- Harness: [`../calibration/craterboot-radius-sweep.mjs`](../calibration/craterboot-radius-sweep.mjs)
- Run: `node docs/WORKSTREAMS/world-engine-radius-live-feed-2026-07-25/calibration/craterboot-radius-sweep.mjs`
- Date: 2026-07-25 · branch `feature/world-engine-production-L1` · headless, pure, no server, no golden re-capture
- Exit code 0 = every control passed AND zero exceptions across 18 presets x 401 radii.

---

## 1. What was actually claimed, and what was actually tested

The site (`planet-lod-lab.html:5146`, inside `worldDefaultEnableSet`) computes the boot-time feature-enable
set with

```js
if (_fp && craterRelevanceOf(deriveConditionVector(_fp, deriveUniforms(_fp, driverUI.qualityTier), _fp.radiusEarth)) > 0) set.add('craters');
```

— the **canonical** preset radius `_fp.radiusEarth`, never `state.planetRadiusEarth` (the drawn one). Its
source comment asserts:

> Canonical radius suffices: the relevance predicate is a domain class (impact surface + schedule fired),
> R-stable within a preset.

That is a falsifiable statement about a pure function. It was tested by sweeping **only the third argument**
of `deriveConditionVector` — the exact and only thing a live rewire would change — while holding `_fp` and
`deriveUniforms(_fp, tier)` fixed, precisely as the site does.

**Radius reaches the predicate through gravity, and that channel is inside the measurement.**
`body-condition-vector.js:37` derives `condition.surfaceGravity = g_c * (R / R_c)`, so a gravity-sensitive
predicate is radius-sensitive even though it never names radius. `craterSchedule`'s size multiplier is
`(G_REF/g)^K_GS`, so it *is* gravity-sensitive. The sweep therefore covers a **53.3x gravity range per
preset** (table 3 below reports the actual g at each endpoint) — this was checked, not assumed.

`qualityTier` is irrelevant to the result: `deriveUniforms` derives `surfaceGravity` from
`massEarth/radiusEarth^2` and `tidalHeat` from the orbital fields; the `qualityTier` argument touches
neither, and those two are the only `derived` fields `deriveConditionVector` reads.

## 2. The slider range used is the real one

`planet-lod-lab-core.js:68-74`:

```js
export const RADIUS_SLIDER_MIN = 0.3;   // Moon-class draw floor (RE)
export const RADIUS_SLIDER_MAX = 16;    // Sub-Neptune ceiling (RE)
export function radiusFromT(t) { return RADIUS_SLIDER_MIN * Math.pow(RADIUS_SLIDER_MAX / RADIUS_SLIDER_MIN, t); }
```

Samples are taken at uniform slider-`t`, i.e. **log-spaced exactly the way the slider's travel is**:
401 samples over `R in [0.3, 16]`, ~1.00% multiplicative step. (Contract floor was 200.)

## 3. Pass/fail criterion, stated up front

**FAIL (site is a defect, must be rewired):** `craterRelevanceOf` returns a different value at any two
radii in `[0.3, 16]` for any preset.
**PASS (site stays canonical):** the value is constant in R for all 18 presets, *and* the harness is
proven able to detect a flip, *and* no flip is hiding between samples.

The threshold is exact equality of a 0/1 integer — there is no tolerance to choose and no "looks
reasonable" judgement in it. That is why this AC is settleable by measurement at all.

## 4. Why "no flip on a 401-point grid" is not the whole argument

A finite 0/1 grid could in principle step over a flip narrower than the sample spacing. Three separate
things close that hole, in increasing strength:

1. **Continuous margins** (table 2 below). `craterRelevanceOf` = `isImpactSurface` AND `schedule.fired` AND
   (`nStamp>0` OR `regolithRoughness>0`). It can only change value where one of four continuous quantities
   crosses a boundary: `H/L -> 1`, `H/L_trunc -> 1`, `D_FLOOR/L -> 1`, or `t_exp -> 0`. Min-over-sweep of
   each is reported. The smallest is `H/L_trunc = 18.2`, and the smallest R-dependent one is
   `D_FLOOR/L = 82.1` (Titan). Nothing is anywhere near a boundary, so no narrow flip can be hiding.
2. **`isImpactSurface` is radius-blind by construction** — it reads only `T_eq` and `atmosphere.pressure`
   (`bombardment.js:143-149`). Measured as invariant across every sample of every preset anyway (table 2,
   "R-invariant?" column), rather than asserted from the source.
3. **A domain-wide analytic bound** (section 6). Not "these 18 presets don't flip" but "**no condition the
   predicate accepts** can flip at `R >= 0.133 R_E`". That bound is derived from the predicate's own
   clamps and confirmed by bisection to 2.1e-16 relative.

   > **FLOOR CORRECTED 2026-07-25 (lens round).** This margin was originally stated as **2.26x below the
   > slider floor of 0.3** (`RADIUS_SLIDER_MIN`). That is the wrong floor. `state.planetRadiusEarth` is
   > not floored at 0.3: the lab's own draw site (`planet-lod-lab.html:3010`) passes `{ labUnlock: true }`,
   > and `LAB_UNLOCKED_RANGES['Moon/Mercury (impact-airless)'] = [0.27, 0.38]` — **27.1% of radius seeds
   > (5422 / 20000, measured) put that preset below 0.3**, i.e. outside the originally swept domain.
   > The true reachable floor is **0.27**, so the headroom is **2.03x**, not 2.26x. **The conclusion is
   > unchanged** — 0.27 > 0.133, and a re-sweep over the corrected domain `[0.27, 16]` (18 presets x 501
   > log-spaced radii) still finds **zero flips**. Only the quoted number was wrong.
   > Now enforced against the corrected domain by `tests/radius-live-feed.test.js` -> `AC-CRATERBOOT`.

## 5. Planted-defect control (mandatory) — the instrument has caught a real defect

Per `feedback_measurement-channels-need-planted-defects`: an instrument that has never caught a known
defect is unproven. Four controls, three of which are in the harness and run on every invocation.

### 5a. In-harness controls (run every time; see the "In-harness controls" table below)

| control | what it feeds the detector | why it exists | result |
|---|---|---|---|
| NEG-1 / NEG-0 | constant relevance 1, constant 0 | a detector that always prints "no flip" would be indistinguishable from the real result — this is the vacuity guard | PASS (silent) |
| POS-A / POS-B | step functions flipping at a **known** R (4.0 and 12.5) | proves the detector fires *and* localises: 64-step log bisection must return the planted radius | PASS (returned 4.0000000 and 12.500000) |
| POS-C | the **real** `craterRelevanceOf`, fed the most flip-prone condition its own input domain admits, swept over an extended range down to R=1e-3 | proves the detector fires through the real function, not just through stubs | PASS — flip found at R=0.133016, matching the analytic prediction to 2.1e-16 |
| POS-C-slider | the **same** condition, swept over the slider range only | proves the slider-range silence is a property of the *interval*, not of the harness | PASS (silent) |

An earlier version of POS-C tried to force a flip with an absurdly small `surfaceGravity` and **failed —
the harness reported no flip**. The cause was real and is now part of the finding: `craterSchedule` floors
gravity at `Math.max(1e-6, condition.surfaceGravity ?? G_REF)`, so the size multiplier has a hard ceiling
and low gravity simply cannot push the crater law past it. That clamp is what makes the section-6 bound a
bound over the whole input domain rather than over one hand-built body.

### 5b. Source-level planted defect — break the law, show FAIL, restore, show PASS

The in-harness controls prove the detector. This one proves the **whole pipeline**, on the **real presets**,
against a defect of exactly the class the site's claim rules out.

Defect planted: `src/worldengine/base/bombardment.js:63`, `K_GS: 0.17 -> 15`. `K_GS` is the gravity->crater-size
exponent — i.e. the single constant governing the only channel through which radius reaches this predicate.
Inflating it makes the scaled low SFD edge `L = D_LO*(G_REF/g)^K_GS` exceed the basin ceiling
`H = C_BASIN*R_km` on small (low-g) worlds, which drops them out of the impact-crater domain — a genuinely
radius-dependent relevance.

```
sha256 BEFORE  082ddc9779ed2d39bd12782945f4dc8f77336cdc36ae783af4d326b0d6525dc2
sha256 AFTER   082ddc9779ed2d39bd12782945f4dc8f77336cdc36ae783af4d326b0d6525dc2   (restored, byte-identical)
git status src/worldengine/base/bombardment.js -> clean (no working-tree modification left behind)
```

**With the defect planted, the sweep reported (preset table, defect build):**

| preset | canonical R_c | rel @ R_min | rel @ R_c | rel @ R_max | FLIPS? | flip radius |
|---|---|---|---|---|---|---|
| Rocky (Earthlike) | 1 | 0 | 1 | 1 | **YES** | 0->1 @ R=0.333364 |
| Ocean (temperate) | 1.1 | 0 | 1 | 1 | **YES** | 0->1 @ R=0.308757 |
| Titan (methane seas) | 0.4 | 0 | **0** | **1** | **YES** | 0->1 @ R=0.729032 |
| Frozen (airless) | 0.5 | 0 | **0** | **1** | **YES** | 0->1 @ R=0.520110 |
| Europa (icy moon) | 0.5 | 0 | **0** | **1** | **YES** | 0->1 @ R=0.520110 |
| Eyeball (locked temperate) | 1 | 0 | 1 | 1 | **YES** | 0->1 @ R=0.302010 |
| Mars (arid rocky) | 0.53 | 0 | 1 | 1 | **YES** | 0->1 @ R=0.411623 |
| Moon/Mercury (impact-airless) | 0.38 | 0 | **0** | **1** | **YES** | 0->1 @ R=0.406192 |
| Crystal (faceted) | 0.8 | 0 | 1 | 1 | **YES** | 0->1 @ R=0.308800 |

(the 9 non-impact presets stayed flat at 0, correctly — `isImpactSurface` is radius-blind and `K_GS` cannot
reach it.)

All 9 impact-surface presets flipped. Four rows (bolded) are the exact failure mode the site's comment
asserts is impossible: `rel @ R_c = 0` but `rel @ R_max = 1` — the canonical read would have booted craters
OFF on a world the drawn radius says is cratered. **So the harness detects precisely the class of defect
that would make :5146 wrong.** It is not a "no"-machine.

**After restore, re-run:** every preset flat, all controls PASS, exit 0.
`npx vitest run tests/worldengine-inc3b-crater-relevance.test.js tests/worldengine-inc3b-synth-law.test.js`
-> 2 files, 22 tests passed. `npm run verify-golden` -> PASS, hash `40c18aad`, 1200 samples (the pinned
baseline hash, unchanged, no re-capture).

## 6. The result is stronger than "the 18 presets don't flip"

The predicate's own clamps bound the flip radius over its **entire admissible input domain**:

```
D_LO_max    = max(D_SFD_MIN_KM=1, C_ATMO_KM=0.16 * P_SURF_MAX^P_ATMO_EXP=0.65)   = 5.00782 km
sizeMul_max = (G_REF=0.5 / gravity clamp 1e-6)^K_GS=0.17                         = 9.30733
L_max       = D_LO_max * sizeMul_max                                             = 46.6094 km
R_flip_max  = L_max / (MESH_FLOOR_RAD=0.055 * KM_PER_EARTH_RADIUS=6371)          = 0.133016 R_E
slider floor RADIUS_SLIDER_MIN                                                   = 0.3 R_E
headroom                                                                         = 2.255x
```

Reading: `craterRelevanceOf` reduces, on the whole slider interval, to `isImpactSurface(c) && t_exp > 0` —
**both radius-blind**. Once `D_FLOOR_KM > L` (guaranteed for `R > 0.133`), `regolithRoughness > 0` follows
algebraically whenever the schedule fires, so the relevance is pinned at 1 regardless of R. The
`nStamp` rounding branch, which is the only thing that could go to zero, is never load-bearing above that
radius.

POS-C confirms the bound empirically: bisection on the real predicate located the flip at
**0.13301570** against the predicted **0.13301570**.

## 7. Disposition

- `planet-lod-lab.html:5146` **keeps `_fp.radiusEarth`**. It is not a defect.
- It is not in the same class as the frozen `_fp = DRIVER_PRESETS[preset]` atmosphere feed (the "right law /
  broken feed" finding): there the drawn radius changes the answer and is being ignored. Here the drawn
  radius provably cannot change the answer anywhere the slider can go.
- The vis-scale-style fence allowlist entry for this site (AC-FENCE) is therefore justified by **proven**
  canonical-radius behaviour, which is what AC-FENCE's own observable demands ("the allowlist is non-empty
  only for sites whose canonical-radius behaviour was PROVEN (AC-CRATERBOOT) rather than assumed").
- Recommended pin: a unit test that re-runs the sweep (or asserts the section-6 margins) so the table is a
  live regression guard rather than a dated document. Any future change to `K_GS`, `MESH_FLOOR_RAD`,
  `C_BASIN`, `D_SFD_MIN_KM`, `G_REF`, the gravity clamp, or `RADIUS_SLIDER_MIN` can move `R_flip_max`; the
  planted-defect run above shows a `K_GS` change alone is enough to invalidate the site.

---

## Raw harness output (verbatim, clean build)

## AC-CRATERBOOT — craterRelevanceOf vs drawn radius, all presets

- slider law: `radiusFromT(t) = 0.3 * (16/0.3)^t`, t in [0,1] (planet-lod-lab-core.js:68-71)
- swept range: R in [0.3000, 16.0000] Earth radii, **401 log-spaced samples** (~1.00% multiplicative step)
- held fixed per preset: `fp` and `deriveUniforms(fp, 1)` — only deriveConditionVector's 3rd argument moves (the exact rewire target)
- gravity DOES move: `condition.surfaceGravity = g_c*(R/R_c)` (body-condition-vector.js:37), so the swept range covers a 53.3x gravity range per preset
- predicate: `craterRelevanceOf` = isImpactSurface AND schedule.fired AND (nStamp>0 OR regolithRoughness>0) (bombardment.js:220-224)

| preset | canonical R_c | rel @ R_min | rel @ R_c | rel @ R_max | FLIPS? | flip radius |
|---|---|---|---|---|---|---|
| Rocky (Earthlike) | 1 | 1 | 1 | 1 | no | — |
| Lava (hot airless) | 0.9 | 0 | 0 | 0 | no | — |
| Ocean (temperate) | 1.1 | 1 | 1 | 1 | no | — |
| Titan (methane seas) | 0.4 | 1 | 1 | 1 | no | — |
| Frozen (airless) | 0.5 | 1 | 1 | 1 | no | — |
| Europa (icy moon) | 0.5 | 1 | 1 | 1 | no | — |
| Gas giant (Jovian) | 11.2 | 0 | 0 | 0 | no | — |
| Gas giant (Saturnian) | 9.4 | 0 | 0 | 0 | no | — |
| Ice giant (Neptunian) | 3.9 | 0 | 0 | 0 | no | — |
| Venus (sulfuric shroud) | 0.95 | 0 | 0 | 0 | no | — |
| Sub-Neptune (hazy) | 2.7 | 0 | 0 | 0 | no | — |
| Eyeball (locked temperate) | 1 | 1 | 1 | 1 | no | — |
| Hot Jupiter (locked giant) | 13 | 0 | 0 | 0 | no | — |
| Mars (arid rocky) | 0.53 | 1 | 1 | 1 | no | — |
| Moon/Mercury (impact-airless) | 0.38 | 1 | 1 | 1 | no | — |
| Magma (K2-141b) | 1.5 | 0 | 0 | 0 | no | — |
| Carbon (high C/O) | 1.1 | 0 | 0 | 0 | no | — |
| Crystal (faceted) | 0.8 | 1 | 1 | 1 | no | — |

### Why no flip is reachable BETWEEN samples — continuous margins over the same sweep

`craterRelevanceOf` can only change value where one of these crosses its boundary: H/L -> 1, H/L_trunc -> 1,
D_FLOOR/L -> 1, or t_exp -> 0 (or the R-blind isImpactSurface gate flips). Min-over-sweep of each:

| preset | impact surface (R-invariant?) | min H/L | min H/L_trunc | min D_FLOOR/L | min t_exp (Ga) | min regolithRoughness | min nAnalytic |
|---|---|---|---|---|---|---|---|
| Rocky (Earthlike) | true (yes) | 1.72e+3 | 18.2 | 94.7 | 0.100 | 0.00000589 | 58.6 |
| Lava (hot airless) | false (yes) | 1.72e+3 | 18.2 | 94.5 | 8.95e-7 | 0 | 0 |
| Ocean (temperate) | true (yes) | 1.75e+3 | 18.2 | 96.0 | 0.100 | 0.00000573 | 58.6 |
| Titan (methane seas) | true (yes) | 1.49e+3 | 18.2 | 82.1 | 1.00 | 0.0000770 | 586 |
| Frozen (airless) | true (yes) | 1.59e+3 | 18.2 | 87.3 | 4.50 | 0.156 | 1.33e+6 |
| Europa (icy moon) | true (yes) | 1.59e+3 | 18.2 | 87.3 | 0.00512 | 3.51e-7 | 3.00 |
| Gas giant (Jovian) | false (yes) | 95.4 | 18.2 | 5.25 | 1.00 | 0 | 0 |
| Gas giant (Saturnian) | false (yes) | 85.0 | 18.2 | 4.68 | 1.00 | 0 | 0 |
| Ice giant (Neptunian) | false (yes) | 99.5 | 18.2 | 5.47 | 1.00 | 0 | 0 |
| Venus (sulfuric shroud) | false (yes) | 575 | 18.2 | 31.6 | 1.00 | 0 | 0 |
| Sub-Neptune (hazy) | false (yes) | 106 | 18.2 | 5.82 | 1.00 | 0 | 0 |
| Eyeball (locked temperate) | true (yes) | 1.75e+3 | 18.2 | 96.4 | 0.104 | 0.00000593 | 61.0 |
| Hot Jupiter (locked giant) | false (yes) | 92.0 | 18.2 | 5.06 | 1.00 | 0 | 0 |
| Mars (arid rocky) | true (yes) | 1.66e+3 | 18.2 | 91.1 | 4.50 | 0.144 | 1.33e+6 |
| Moon/Mercury (impact-airless) | true (yes) | 1.66e+3 | 18.2 | 91.3 | 4.50 | 0.143 | 1.33e+6 |
| Magma (K2-141b) | false (yes) | 1.87e+3 | 18.2 | 103 | 9.24e-9 | 0 | 0 |
| Carbon (high C/O) | false (yes) | 1.77e+3 | 18.2 | 97.2 | 4.50 | 0 | 0 |
| Crystal (faceted) | true (yes) | 1.75e+3 | 18.2 | 96.0 | 4.50 | 0.130 | 1.33e+6 |

### Gravity actually swept (proof the g-channel is inside the measurement)

| preset | g @ R_min | g @ R_c | g @ R_max | g range |
|---|---|---|---|---|
| Rocky (Earthlike) | 0.270 | 0.900 | 14.4 | 53.3x |
| Lava (hot airless) | 0.267 | 0.802 | 14.3 | 53.3x |
| Ocean (temperate) | 0.293 | 1.07 | 15.6 | 53.3x |
| Titan (methane seas) | 0.117 | 0.156 | 6.25 | 53.3x |
| Frozen (airless) | 0.168 | 0.280 | 8.96 | 53.3x |
| Europa (icy moon) | 0.168 | 0.280 | 8.96 | 53.3x |
| Gas giant (Jovian) | 0.0679 | 2.53 | 3.62 | 53.3x |
| Gas giant (Saturnian) | 0.0344 | 1.08 | 1.83 | 53.3x |
| Ice giant (Neptunian) | 0.0865 | 1.12 | 4.61 | 53.3x |
| Venus (sulfuric shroud) | 0.285 | 0.903 | 15.2 | 53.3x |
| Sub-Neptune (hazy) | 0.125 | 1.12 | 6.67 | 53.3x |
| Eyeball (locked temperate) | 0.300 | 1.00 | 16.0 | 53.3x |
| Hot Jupiter (locked giant) | 0.0546 | 2.37 | 2.91 | 53.3x |
| Mars (arid rocky) | 0.216 | 0.381 | 11.5 | 53.3x |
| Moon/Mercury (impact-airless) | 0.219 | 0.277 | 11.7 | 53.3x |
| Magma (K2-141b) | 0.444 | 2.22 | 23.7 | 53.3x |
| Carbon (high C/O) | 0.316 | 1.16 | 16.8 | 53.3x |
| Crystal (faceted) | 0.293 | 0.781 | 15.6 | 53.3x |

### In-harness controls (the detector is proven, not assumed)

| control | relevance fed to the detector | expected | FLIPS? | flip radius reported | verdict |
|---|---|---|---|---|---|
| NEG-1 | constant 1 | FLIPS=false | no | — | PASS |
| NEG-0 | constant 0 | FLIPS=false | no | — | PASS |
| POS-A | step 0->1 at R=4 | FLIPS=true @ 4 | YES | 4.0000000 | PASS |
| POS-B | step 1->0 at R=12.5 | FLIPS=true @ 12.5 | YES | 12.500000 | PASS |
| POS-C | **real craterRelevanceOf**, extremal admissible condition, swept R in [0.001, 16] | FLIPS=true @ predicted R=0.133016 | YES | 0->1 @ 0.133016 | PASS |
| POS-C-slider | the SAME extremal condition, swept over the SLIDER range only | FLIPS=false | no | — | PASS |

**Domain-wide bound (not just the 18 presets).** The flip POS-C localises is not an accident of one hand-built body —
it sits exactly at the analytic boundary that bounds EVERY condition the predicate accepts:

```
D_LO_max    = max(D_SFD_MIN_KM=1, C_ATMO_KM=0.16 * P_SURF_MAX^P_ATMO_EXP=0.65)   = 5.00782 km
sizeMul_max = (G_REF=0.5 / gravity clamp 1e-6)^K_GS=0.17                = 9.30733
L_max       = D_LO_max * sizeMul_max                              = 46.6094 km
R_flip_max  = L_max / (MESH_FLOOR_RAD=0.055 * KM_PER_EARTH_RADIUS=6371)  = 0.133016 R_E
slider floor RADIUS_SLIDER_MIN                                    = 0.3 R_E
headroom                                                          = 2.255x below the slider floor
```

Measured flip radius (POS-C, 64-step log bisection on the real predicate): **0.13301570** vs predicted **0.13301570** (relative difference 2.1e-16).
So no condition the predicate accepts can flip at R >= 0.1330 R_E, and the slider never goes below 0.3 R_E.

### VERDICT

- controls: **ALL PASS** — the detector fires on known flips, localises them exactly, and stays silent on constants.
- exceptions thrown by craterRelevanceOf across 18 presets x 401 radii: **0**
- **NO PRESET FLIPS.** craterRelevanceOf is constant in R over the entire slider range [0.300, 16.000] for all 18 presets.
- The :5146 site may keep reading the canonical preset radius. This table is the pinned reason.
