# THE TWO CRATER FLOORS — DERIVATION AND COMMITTED CALIBRATION TABLE

**B2 leg 1**, built 2026-08-20 on `feature/world-engine-production-L1` at `e17ca25`. This is the
calibration table `docs/FEATURES/comprehensive-wiring-plan-2026-08-20.md:413` names as *"part of the
deliverable"*, for the crater half of Option C
(`docs/FEATURES/r-rows-decision-packet-2026-08-20.md:564`).

**THE CORPUS IS NAMED ON EVERY NUMBER.** Unless a row says otherwise it is `lab-procedural-0…199` =
**1517 bodies = 852 planets + 632 plain moons + 33 planet-class moons**, of which **1160 are non-gas
= 509 planets + 632 plain moons + 19 planet-class** and **357 are gas**. Re-measured at this commit,
not quoted: the census script is reproduced in §6.

⛔ **NOTHING HERE IS MEASURED ON SOL.** Sol carries real NASA textures, a different renderer and no
world-engine condition fields, and `SolarSystemData.js` contains zero `massEarth`, so every Sol moon's
`surfaceGravity` is fabricated as exactly 1/R². `docs/FEATURES/one-pipeline-two-frontends-PLAN.md:409`
fenced re-deriving `CRATER_VIS_FLOOR_RAD` behind hand-authoring those 39 masses; **Max ruled
2026-08-20 that it is re-derived FROM THE RENDERER instead, which touches Sol not at all, and that the
Sol-mass follow-on stays open and untouched.** No file under `src/generation/SolarSystemData.js` was
edited.

---

## 1. THE FLOOR — `CRATER_VIS_FLOOR_RAD`, 0.02 → 9.6e-4

### 1.1 The rule, stated so one number re-closes it

> **The smallest crater the shader ACTUALLY DRAWS must span ≥ 4 RENDER pixels at the closest measured
> approach framing, read at the disc centre, face-on, small-angle.**

Change the **4** and re-run §1.2 to re-close it.

### 1.2 The arithmetic

| term | value | where it comes from |
|---|---|---|
| smallest drawn crater | `2·R_LO` = **0.36 cell units** | `craterCombiner` hashes each crater's radius as `mix(0.18, 0.55)` cell units — `craterUniforms.js:27` |
| one cell | `D_char` km | `uCraterScale = R_km / D_char`, `craterRelief.glsl.js:39` |
| `D_char` | `sqrt(lo·H)` = `sqrt(f·C_BASIN)·R_km` | `craterUniforms.js:142`; `C_BASIN = 1.0` (`bombardment.js:54`), so `D_char/R_km = sqrt(f)` |
| ⇒ smallest drawn crater, angular | `0.36·sqrt(f)` rad | `radPerKm(RE) = 1/R_km`, so km/R_km **is** radians |
| render resolution | `ceil(width / pixelScale)`, `pixelScale = 3` | `RetroRenderer.js:811`, `src/ui/Settings.js:12` — **read in source at this commit**, not quoted |
| framing | camera **1.2 body radii**, viewport 1600×999 dpr 1 | the closest framing in the measured table below |
| disc RADIUS at that framing | **1078.23 screen px** ⇒ **359.41 render px** | measured live via `_lab.shotState` |

`0.36 · sqrt(f) · 359.41 ≥ 4` ⇒ `sqrt(f) ≥ 0.030915` ⇒ **`f ≥ 9.557e-4`**. Shipped: **`9.6e-4`**,
which gives **4.009 render px** — the rule met with 0.2% of margin rather than tuned past it.

**Why 4 and not 2.** 2 render px is the Nyquist limit: at it a feature can be *detected* but not
*reconstructed*. A crater is not a dot — `craterProfile` is a bowl for `r<1` plus a rim peaking at
`r=1`, so reading as a crater needs rim/bowl/rim resolved, i.e. ≥ 3 samples, and ≥ 4 to leave any
bowl interior. 4 is therefore the conservative end of the defensible range, which matters because the
crater field does **not** fade with `uLodRamp` (see §4).

**Why the disc centre.** That is the one place on the disc where a crater is largest; everywhere else
it is foreshortened by `cos ψ`. So the rule bounds the BEST case, and this is stated rather than
hidden: a floor that met 4 px *everywhere* on the disc would be a different and larger number.

### 1.3 The measured disc, in full

Measured live on a **procedural** body at viewport 1600×999, dpr 1, via `_lab.shotState`. Disc
**radius**; divide by `pixelScale` 3 for render px.

| camera distance (body radii) | 1.2 | 1.5 | 2 | 3 | 6 | 10 | 20 |
|---|---|---|---|---|---|---|---|
| disc radius, SCREEN px | 1078.23 | 638.73 | 412.09 | 252.29 | 120.60 | 71.70 | 35.71 |
| disc radius, RENDER px | 359.41 | 212.91 | 137.36 | 84.10 | 40.20 | 23.90 | 11.90 |
| smallest drawn crater at **f = 0.02** (render px) | 18.30 | 10.84 | 6.99 | 4.28 | 2.05 | 1.22 | 0.61 |
| smallest drawn crater at **f = 9.6e-4** (render px) | 4.01 | 2.38 | 1.53 | 0.94 | 0.45 | 0.27 | 0.13 |

⭐ **This is what "a floor tuned for mid-distance" meant, quantified.** The shipped 0.02 put the
smallest drawn crater at **2.05 render px — Nyquist — at 6 body radii**. Below 6 radii it had headroom
it never spent; that headroom is what the re-derivation spends.

### 1.4 ⚠ The shipped comment's `K = 0.36425·disc_px`, resolved as far as source allows

The retired comment measured *"mean crater diameter in pixels on a planet drawn 400 px across:
sub-floor 0.8 px | full SFD 3.5 px | 0.02 rad 20.6 px | 0.05 rad 32.6 px"*, which implies
`px = K·sqrt(floor)` with `K = 0.36425·disc_px` — against centre-of-disc geometry's `K = disc_px/2`.

**The sqrt is fully explained and reproduces:** those numbers are the CHARACTERISTIC crater
`D_char = sqrt(lo·H)`, i.e. `sqrt(f)` rad — not the smallest drawn crater. `20.6 / 32.6 = 0.6325 =
sqrt(0.02/0.05)` to four decimal places.

**The residual factor 0.7285 is not explained by anything written in source.** The nearest documented
candidate is foreshortening: the projected-area-weighted mean of `sqrt(cos ψ)` over the visible disc
is `(2/5)/(1/2) = 0.8`, and of `cos ψ` is `2/3` — the residual sits between them and equals neither.
**It is recorded and NOT adopted.** This document's convention is stated in §1.1 and used throughout.

---

## 2. THE DENSITY FLOOR — `CRATER_MIN_DENSITY = 1e-3` RETIRED INTO `CRATER_MIN_VISIBLE = 1.0`

The retired constant's own comment said it refused bodies showing *"less than one crater on the whole
visible disc"*. **A fixed density cannot state that.** Craters are counted in CELLS, and the visible
cell count is `2·π·uCraterScale²` — a number this same file's floor moves.

- At the shipped pair: `uCraterScale` 7.0711 ⇒ **314.16 visible cells**, so `1e-3` admitted **0.31
  craters**, and **119 of the 485 cratered bodies rendered under one crater**.
- Any replacement scalar re-stales the moment the floor moves, which is exactly what §1 did. Hence
  the per-body form at `craterUniforms.js:145`:
  `density * visibleCells >= CRATER_MIN_VISIBLE`, `visibleCells = 2·π·(R_km/D_char)²`, `1.0` reading
  literally as *"at least one crater is visible on the disc."*
- **Control, both directions:** applying the honest gate at the OLD floor **removes exactly 119
  bodies** (485 → 366) — the same 119 that rendered under one crater. The two measurements are
  independent and agree exactly, which is why the substitution is a restatement and not a re-tune.

---

## 3. ⭐ THE COMMITTED CALIBRATION TABLE

Corpus `lab-procedural-0…199`, **1160 non-gas bodies** (509 planets + 632 plain moons + 19
planet-class). Gas bodies are excluded from every row; `craterRelevanceOf` and the pack predicate are
**not** applied — this is the crater law alone.

| quantity | denominator | BEFORE (0.02, `density ≥ 1e-3`) | AFTER (9.6e-4, `density·cells ≥ 1.0`) |
|---|---|---|---|
| bodies with craters ON | 1160 non-gas | **485** (41.8%) | **761** (65.6%) |
| non-gas PLANETS with craters | 509 | **12** (2.4%) | **214** (42.0%) |
| plain moons with craters | 632 | **473** (74.8%) | **547** (86.6%) |
| planet-class moons with craters | 19 | 0 | 0 |
| distinct `uCraterScale` | cratered bodies | **21** | **322** |
| distinct `uCraterDensity` | cratered bodies | **248** | **522** |
| bodies rendering UNDER ONE crater | cratered bodies | **119** | **0** |
| bodies with `density` clamped at 1.0 | cratered bodies | 238 of 485 (49.1%) | 240 of 761 (31.5%) |
| refused by the SCHEDULE not firing | 1160 non-gas | **200** | **200** (unchanged — no floor reaches them) |
| refused by the density/visibility gate | 1160 non-gas | 475 | 199 |
| smallest drawn crater at 1.2 body radii | render px | 18.30 | **4.01** |
| morphology: all-complex / mixed / all-simple | cratered bodies | 241 / 62 / 182 | 386 / 165 / 210 |

### 3.1 ⛔ TWO FIGURES IN OPTION C THAT DO NOT SURVIVE MEASUREMENT

**(a) *"roughly 490 rocky planets"* is not reachable, and not by this or any floor.** The **absolute
ceiling with both floors at zero is 321 of 509**, because **188 non-gas planets are refused by
`craterSchedule` not firing at all** (`T_eq ≥ 450 K` or `P ≥ 200 bar` — `bombardment.js:143`). Leg 1
reaches **214 of 509**, i.e. **67% of the reachable ceiling**, and the honest headline is *"12 → 214
of 509, against a ceiling of 321"*.

**(b) *"de-pins 465 of 1156"* is right about the outcome and wrong about the mechanism, and the
mechanism matters.** While the floor BINDS, `lo = f·R_km` and `H = C_BASIN·R_km` are both ∝ `R_km`, so
`D_char/R_km = sqrt(f·C_BASIN)` carries **no body term** and every floor-bound body shares one
`uCraterScale` — *changing the floor's value cannot de-pin anything.* De-pinning happens only where
the floor **stops binding** and `lo` falls back to the schedule's own low edge
`L = D_LO_KM · sizeMul`, which does carry body terms (radius, gravity, pressure). MEASURED:

| | BEFORE | AFTER |
|---|---|---|
| cratered bodies where the FLOOR binds (one shared scale) | **465 of 485** | **440 of 761** |
| cratered bodies where the SCHEDULE's `L` binds (per-body scale) | **20 of 485** | **321 of 761** |
| distinct `uCraterScale` | 21 | 322 |

So the size does un-pin — **321 bodies acquire a body-dependent crater size, not 465** — and it does
so by the floor ceasing to bind, not by the floor carrying new information.

---

## 4. ⚠ THE COST, NAMED, AND IT IS FOR MAX'S EYES

A single-octave crater field can be tuned for **one** framing. Tuning at the closest one spends the
mid-distance margin:

| | BEFORE (f = 0.02) | AFTER (f = 9.6e-4) |
|---|---|---|
| distance at which the SMALLEST drawn crater hits 2 render px | ≈ 6.1 body radii | ≈ **1.7 body radii** |
| distance at which the CHARACTERISTIC crater (`D_char`) hits 2 render px | ≈ 17 body radii | ≈ **3.9 body radii** |
| characteristic crater at 6 body radii | 5.69 render px | **1.25 render px** |

Beyond ≈ 4 body radii the whole crater field is sub-Nyquist and will alias, and **craters carry no
LOD fade** — `CRATER_RELIEF_GAIN` is a bare 1.0 and the crater slope enters
`perturbNormalAnalytic` unscaled by `uLodRamp` (pinned by `tests/crater-uniform-law.test.js`'s wiring
fence). **This is the trade Max's criterion buys** (*"detail must KEEP RESOLVING as the player flies
in, or a planet reads as a beach ball painted to look like a planet"*), and it is a UAT question, not
an agent's to close.

**The structural fix is already precedented in this codebase and is NOT in leg 1:** a second, finer
crater octave faded in by `uLodRamp`, the way `uFacetScale × 2.4` already is at
`src/worldengine/shaders/height.glsl.js:2772`. That is what makes the field serve a RANGE of framings
instead of a point, and it is the honest close of `RENDERED_CELL_COVERAGE`'s own recorded
single-octave limitation.

---

## 5. WHAT MOVED IN THE TESTS, AND WHY EACH MOVE IS LEGITIMATE

Every one is named in the commit report. Summary:

- **The five Sol density tripwires** (`tests/crater-uniform-law.test.js`) — **MOVED to procedural
  subjects, not re-recorded.** Re-blessing a range fitted on a fabricated 1/R² gravity is the defect
  `PLAN.md:409` exists to prevent. The replacement is stronger than the numbers it retires: with
  `lo = f·R_km` and `H = C_BASIN·R_km`, `coverageBand`'s `count · E[D²]` reduces to `2L²·ln(H/lo)`
  exactly, so moving the floor multiplies every floor-bound unclamped body's density by exactly
  `ln(1/f_new)/ln(1/f_old) = 1.7762107390117239` and by nothing else. **Verified to 1.33e-15** over
  every floor-bound body of `lab-procedural-0…24` × four floors.
- **`tests/driver-pack-rockysurface.test.js` FAMILY 27** — title and declared prior **rewritten**, not
  nudged. Its prior ("craters are a MOON phenomenon here", planets 3 of 66) was an artefact of the
  fixed density gate. Now planets 28 of 66, moons 52 of 58; `moonFrac > planetFrac` is kept because
  that half is physics.
- **`tests/driver-pack-rockysurface.test.js` FAMILY 11** — the forbidden-literal map gains `9.6e-4`
  and keeps `0.02`/`1e-3` with corrected reasons. ⚠ `CRATER_MIN_VISIBLE = 1.0` **cannot** be added:
  `1.0` is already a declared pack literal (`C_CRATER`), so the fence does not cover it, and the hole
  is written into the map rather than papered over.
- **`tests/port-condition-contract.test.js`** — `craters` was the LAST whole-corpus non-moving shipped
  law, and leg 1 consumed it. The file's own instruction was *"reshaped, not re-blessed"*, so the
  negative half was re-pointed from a NAME population to a BODY population: craters move on **72 of
  526**, bit-identical on **454**. Attribution measured: substituting the new `rawTidalIoRatio` alone
  cures 29 of the 72, the new `T_eq` alone cures 21, **both together cure all 72** — so nothing
  outside the already-declared condition-mover ledger moved.
- **`tests/material-parity-list.test.js` + ledger row P-14** — four crater uniforms leave the "agree
  by absence" bucket and join P-14: `uCraterDensity` (64 of 266), `uEjectaStrength` (64),
  `uCraterRelaxation` (56), `uEjectaRampart` (42). **The direction costs a pixel:** the GAME writes
  the live value and the LAB writes 0, because `rockySurface` multiplies by `craterRelevanceOf` and
  excludes gas-class bodies while the legacy path is keyed on the type label. P-14 predicted this in
  its own words. **`blocking` is inherited, not newly ruled**, and closing it is B3's crater half.

---

## 6. REPRODUCING EVERY NUMBER

The census and sweep scripts are pure Node over `src/`, no browser and no server:

```js
// per body: conditionFromBody(d) → compositionClass(cond) → craterSchedule(cond) → craterUniformsFrom(cond)
// visible craters = density * 2*Math.PI*(R_km/Dchar)**2
// floor binds  ⇔  CRATER_VIS_FLOOR_RAD * R_km > sch.D_LO_KM * sch.sizeMul
// morphology   ⇔  complexD <= 2*R_LO (all complex) · complexD >= 2*R_HI/0.6 (all simple)
```

Corpus enumeration is `StarSystemGenerator.generate('lab-procedural-' + i, null)` for `i` in `0…199`,
walking `sys.planets[].planetData` and `sys.planets[].moons[]`, with `m.isPlanetMoon === true`
separating planet-class from plain moons — the same shape as `census()` in
`tests/material-parity-list.test.js:157` and `tools/moon-census.mjs:171`.
