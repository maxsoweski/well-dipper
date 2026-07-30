# AC-PLATESCALE item 2 — the display law, measured live BEFORE any source edit

**Date** 2026-07-29 (session C) · **Branch** `feature/world-engine-production-L1` · **HEAD at capture** `ab89388`
**Ruling being executed** Max chose **outcome B — remove the law**, over outcome A (name + derive it),
2026-07-29. This file is the BEFORE half of the evidence for that edit. **No source file was changed to
produce any capture here.**

**GPU of record** `ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 (0x00002C02) Direct3D11 vs_5_0 ps_5_0, D3D11)`,
vendor `Google Inc. (NVIDIA)`, Chrome 150, WebGL2, `highp` fragment precision 23, DPR 1.25,
drawing buffer 1750×1377. Same GPU as every prior measurement filed in this workstream.

---

## 1. What the law is, confirmed against the running renderer

`uniforms.uDispDomainScale.value = sVis` (`planet-lod-lab.html:5976`) — the single writer — feeds three
sites in the shared height GLSL:

| site | what it scales |
|---|---|
| `planet-lod-height.glsl.js:641` | `pos *= uDispDomainScale` in `computeHeight` |
| `planet-lod-height.glsl.js:765` | `freq = uNoiseScale * 0.3 * uDispDomainScale` (macro FBM base freq) |
| `planet-lod-height.glsl.js:850` | `pos *= uDispDomainScale` in `initProvinces` |

`sVis = R^VIS_SCALE_EXP` with `VIS_SCALE_EXP = 0.5` (`planet-lod-lab-core.js:45`), a **camera-framing**
constant chosen so the 0.3–16 R⊕ span fits a fixed camera (`planet-lod-lab-core.js:42-44`). Angular
feature wavelength therefore goes as **θ ∝ R^-0.5**, and since feature count over a sphere goes as
1/θ², **N ∝ R^1** — the "exponent 1". The literature ruled in `amendments[1]` gives **N ∝ R^-0.07**,
i.e. exponent 0. Nobody chose the 1; it is `VIS_SCALE_EXP` doubled by the 1/θ² relation.

**Live confirmation of the uniform chain** (Rocky (Earthlike), macroSeed 1, radiusSeed 1):

| R | sVis | `uDispDomainScale` |
|---|---|---|
| 1 | 1 | 1 |
| 4 | 2 | 2 |
| 16 | 4 | 4 |

---

## 2. The crossover hands the whole upper band to the invented body

`bakeReliefCrossover(sVis)` (`planet-lod-lab-core.js:125-131`) at `BAKE_CROSS_SPAN = 1.0` is fully faded
by `|log2 sVis| = 1`, i.e. **R = 4**. Measured on the running page, after letting `frame()` settle and
*then* re-running the router against the settled uniform:

| R | sVis | effective `uReliefBakeStrength` | `uCraterBakeRestore` | renderer draws | router `heightSource` |
|---|---|---|---|---|---|
| 1.0 | 1.000000 | **1.000000** | 0.000000 | baked×1.000 + synth×0.000 | `carrier` |
| 1.5 | 1.224745 | 0.793405 | 0.206595 | baked×0.793 + synth×0.207 | `carrier` |
| 2.0 | 1.414214 | 0.500000 | 0.500000 | baked×0.500 + synth×0.500 | `carrier` |
| 3.0 | 1.732051 | 0.111319 | 0.888681 | baked×0.111 + synth×0.889 | `carrier` |
| 4.0 | 2.000000 | **0.000000** | 1.000000 | **pure synth** (else branch, no cube fetch) | `sampler` |

`uReliefBakeStrength + uCraterBakeRestore = 1.000000` at every row — the crater-restore complement
(`planet-lod-lab.html:5998`) holds exactly, so craters are not being deleted at any radius sampled.

Two things follow, both of which matter beyond item 2:

**(a) R = 4 → 16 is governed 100% by the display law.** The baked (exponent-0, literature-correct) body
contributes exactly nothing above R = 4. Three quarters of the slider band is the invented exponent.

**(b) AC-ONEBODY is a property of the crossover band, and it is now quantified.** In `1 < R < 4` the
renderer draws a *blend* while the router must pick *one* source, and it picks `carrier` — the pure
baked body — for the whole band. The disagreement is largest at **R = 3, where the router routes rivers
onto a body contributing only 11.1% of what is drawn.** At R = 1 and R ≥ 4 the two agree. So removing
the crossover collapses this band to nothing and closes the split as a side effect rather than as a
separate fix.

> ⚠ **Correction recorded so it is not re-derived wrongly:** reading `heightSource` *before* letting
> `frame()` settle returns `carrier` at R = 4 and R = 16, which looks like a renderer/router split at the
> top of the band. It is not — it is a stale read. Settled, the router follows the uniform to `sampler`
> and the two **agree** there. The real split is the blend band above.

---

## 3. The law isolated — single-variable A/B, no source edit

The naive R = 1 vs R = 16 comparison confounds **two** variables: body source (baked → synth) and domain
scale (1 → 4). To isolate the law, the body was pinned constant (pure synth + craters fully restored) and
only `uDispDomainScale` varied, using the accessor-redefinition technique from session B (`get`/no-op
`set` on the uniform's `value`, so the frame loop cannot overwrite it — JS only, cannot perturb GLSL
compilation).

| file | R | `uDispDomainScale` | `uReliefBakeStrength` | md5 |
|---|---|---|---|---|
| `AB-R1-lawON-disp1.png` | 1 | 1 (= sVis) | 0 (pinned) | `074861d721028af41f874e6261b158ca` |
| `AB-R1-lawOFF-disp1.png` | 1 | 1 (forced) | 0 (pinned) | `074861d721028af41f874e6261b158ca` |
| `AB-R4-lawON-disp2.png` | 4 | 2 (= sVis) | 0 (pinned) | `75fbd6546126aade4f064f1bf4ebb348` |
| `AB-R4-lawOFF-disp1.png` | 4 | 1 (forced) | 0 (pinned) | `048d2723ba3b4e9e9f1ae409556dd702` |
| `AB-R16-lawON-disp4.png` | 16 | 4 (= sVis) | 0 (pinned) | `f03a8013c57dcbafb3b9c4848557d6ff` |
| `AB-R16-lawOFF-disp1.png` | 16 | 1 (forced) | 0 (pinned) | `4172833b1a9cfa4a20fcc638231cf682` |

Every capture: logical camera distance **3** planet-radii (so `uOctaves = 9` and `uLodRamp = 1` are
pinned across all radii and cannot confound the read), `yaw 0.6 / pitch 0.25`, `levels 6` (shipped look),
`macroSeed 1`, `radiusSeed 1`, animation frozen.

### Controls

- **NULL control — PASS.** At R = 1, `sVis = 1`, so law-ON and law-OFF are the same value. The two PNGs
  are **byte-identical**. This proves both the anchor identity *and* that the A/B mechanism does not
  itself perturb the frame.
- **LIVENESS control — PASS.** At R = 16 the two PNGs **differ**. The comparison responds to the variable.
- **FIDELITY control — PASS, and stronger than planned.** Pinning the uniforms to the values `frame()`
  was already writing reproduces the un-pinned live frame *byte-for-byte*:
  `AB-R16-lawON-disp4.png` ≡ `BEFORE-ld3-R16.png` (`f03a8013…`) and
  `AB-R4-lawON-disp2.png` ≡ `BEFORE-ld3-R4.png` (`75fbd654…`). The pins are faithful, not approximate.

### What the frames show

At R = 16, law ON: roughly 15–20 distinct small dark basins across the visible hemisphere — high count,
each small relative to the disc. Law OFF: roughly 4–5 large features — one dominant ocean, two large
basins, a broad continental mass. Count drops by about the 16× the algebra predicts for a 4× domain
scale (N ∝ disp²), and the structure reads in the same *proportion to the disc* as Earth does, which is
what radius-invariant angular plate structure means.

**This is what outcome B will look like.** It is a preview, not the edit.

### The law has a SECOND effect the frames also contain

`uFwClamp = 1` (`state.fwClamp = true`) in every capture above — the shipped default. The per-octave
band-limiter is `if (uFwClamp == 1){ float screenF = fwBase * freq; w *= 1.0 - smoothstep(0.4, 0.8, screenF); }`
(`planet-lod-height.glsl.js:772-775`, and verbatim again in `fbmdRidged` at `:1000`). It is a per-octave
**amplitude taper**, not a hard octave cutoff — an octave is untouched at `screenF <= 0.4` and fully dead
at `>= 0.8`, and the weight scales both height and the chain-rule gradient (`:780-781`).

**`freq` carries `uDispDomainScale`.** So the display law does not only move feature size — it also
multiplies `screenF` by `sVis`, which tapers trailing octaves *more aggressively* at large radius. At a
held apparent size, `fwBase` is roughly constant, so `screenF ∝ sVis`: at R = 16 the law suppresses fine
octaves 4× harder than it would at the anchor.

Removing the law therefore does two things at once: features get larger/fewer **and** more fine octaves
survive the taper. Both push the same way — a bigger planet viewed at the same apparent size shows the
same angular structure *and* the same angular detail, which is the correct behaviour. The `AB-…lawOFF`
frames already contain both effects, because only `uDispDomainScale` was changed and the clamp was left
at its shipped value. **Do not read the count change as the law's sole consequence.**

Note also that `uOctaves` is itself camera-driven and independent of this:
`autoOctaves(lodRampOf(distance/sVis))` with `lodRampOf = smoothstep(20, 6, d)` and
`autoOctaves = mix(4, 9, ramp)` (`planet-lod-lab-core.js:20,25`) — a 32× swing in top frequency on camera
distance alone. Holding logical distance at 3 pins it at 9 for every capture here, which is why that
framing was used.

---

## 4. Whole-disc context captures

`BEFORE-fixed-R{1,4,16}.png` (fixed camera distance 20, what dragging the radius slider actually does)
and `BEFORE-held-R{4,16}.png` (logical distance held at 20). These are context only — at whole-disc
distance the Rocky Earthlike preset reads as a small mottled dot and no plate structure is legible,
which is itself the AC-HYPSO / AC-PROVINCE gap already filed. The fixed-camera set additionally
confounds LOD: at distance 20 with `planetScale` 2 and 4, `uOctaves` moves 4 → 8.01 → 9 and `uLodRamp`
0 → 0.80 → 1, because distance-in-radii crosses the `lodHysteresis` threshold. **Do not read structure
off the fixed-camera set.** The `ld3` and `AB` sets exist because of this.

---

## 4b. THE EDIT, AND ITS VERIFICATION (added after the edit landed)

The edit: `planet-lod-lab.html` — the frame-loop write `uniforms.uDispDomainScale.value = sVis` is
deleted, replaced by a comment recording why and what it deliberately does not do. The uniform keeps
its `1.0` initializer (`planet-lod-uniforms.js:17`) at every radius. **The GLSL string is untouched**,
so the compiled shader program is bit-for-bit the same binary and no FMA/reassociation decision can
shift. Test: `tests/vis-scale-fence.test.js` — the Slice C block is INVERTED (it used to *require* the
`sVis` write, i.e. the fence was pinning the invented law in place) and now asserts zero writers by any
spelling, plus that the two GLSL divisions are retained as no-ops.

### ⚠ A FAILED VERIFICATION, AND THE METHODOLOGY ERROR BEHIND IT

The first AFTER pass compared post-edit screenshots against the §3/§4 BEFORE PNGs. **All three byte
predictions failed, including the anchor identity that must hold by construction.** Every fingerprint
field matched, so the cause was outside the fingerprint. It was `uTime`:

`freezeAnimation(true)` stops the clock ADVANCING but leaves it at whatever value it had reached —
here `18.2175` — which depends on how long the page sat open before freezing. `cloudsEnabled` is true
on this preset, and F31 clouds read `uTime`. So across a page reload the clock differed and every
pixel differed. **A cross-session byte comparison of this lab is invalid unless the clock is pinned to
a fixed value, not merely frozen.** `_lab.setAnimationClock(0)` does that; with it pinned, three
consecutive GPU readbacks of the same state hash identically (`169fe9e9`), so the frame is
deterministic given state + clock.

### The valid comparison — the handoff's two-page recipe

`git show HEAD:planet-lod-lab.html > planet-lod-lab.BEFORE.html`, served from the same origin, both
pages driven to the same state with the clock pinned to 0, compared by a **GPU readback hash** of the
centre 256×256 (`gl.readPixels` + FNV-1a, plus a pixel sum) rather than a screenshot, so GUI chrome
cannot confound it. Both canvases forced to **1750×1375** — an initial 2 px width mismatch (1752 vs
1750) changed the aspect ratio *and* shifted the centred readback window, which alone made the hashes
differ; that had to be equalised before any comparison meant anything.

| R | BEFORE `uDispDomainScale` | BEFORE hash / sum | AFTER `uDispDomainScale` | AFTER hash / sum | result |
|---|---|---|---|---|---|
| 1 | 1 | `4d76e86e` / 33185803 | 1 | `4d76e86e` / 33185803 | **BYTE-IDENTICAL ✓** |
| 4 | 2 | `ff195d2a` / 24755837 | 1 | `b3de3e3d` / 33933144 | differs ✓ |
| 16 | 4 | `c13e0bc0` / 26807601 | 1 | `4a58a92c` / 33929991 | differs ✓ |

Two different HTML files, two isolated pages, matched canvas, pinned clock — **bit-identical at the
anchor.** That is the byte-identity claim actually verified rather than derived.

**A quantitative signature of radius-invariance, beyond eyeballing the frames:** AFTER's pixel sums at
R = 4 and R = 16 agree to **0.01%** (33933144 vs 33929991), where BEFORE's differed by **8%**
(24755837 vs 26807601). The rendered macro structure is now near-invariant across a 4× radius span,
which is what the literature's exponent-0 predicts. Screenshots of the same three states are filed as
`AFTER-ld3-R{1,4,16}.png` — note those were taken in the *first*, unpinned-clock pass, so they are
illustrative only; **the load-bearing AFTER numbers are the hashes in this table.**

### Tests

`vis-scale-fence` + `instrument-tap-fence` + `relief-router-repoint` + `planet-vis-scale`: **80/80 pass.**
Full suite: 20661 passed, 4 failed, 32 skipped across 1308 files. **The 4 failures are pre-existing and
unrelated** — verified by stashing the edit and re-running the same 3 files, which fail identically at
HEAD: `src/generation/__tests__/KnownObjects.test.js` (×3) and `GalacticFeatures.test.js` (×1), plus 13
`vendor/motion-test-kit/tests/*` files that error with "No test suite found in file". Nothing in those
files references anything this edit touches.

### What this edit does NOT close

- **AC-PLATESCALE observable (1)** — the registry entry pinning plate-count radius-invariance. Not
  written here, deliberately. Plate count is a seeded draw with no radius term
  (`src/worldengine/base/plates.js:227`, `PLATE_COUNT_MIN + floor(rng·PLATE_COUNT_SPAN)`), so a
  radius-only entry would either measure a CPU function that ignores radius — a tautology, the same
  objection that ruled out outcome A — or require standing up a mesh-building harness inside the
  THREE-free laws registry. The entry belongs with **AC-PLATECOMP**, where count becomes *derived*
  from core mass fraction and radius-invariance is the co-claim with real content. The actual
  regression guard for item 2 is the inverted fence test (zero writers), which is in and green.
  Note also that `src/worldengine/**` is token-banned from `visScaleOf` / `sVis` / `VIS_SCALE_EXP`
  (`tests/vis-scale-fence.test.js:64-69`), so any such entry's prose must avoid those spellings.
- **AC-PLATESCALE observable (3)** — the Nyquist gate / retiring `bakeReliefCrossover`. Item 3, kept
  separate on purpose: retiring the crossover with `base = 1` makes `bake == 1` at every radius, which
  silently widens `fieldSampler.js:764`'s `l2AnchorGate` from "opens at R = 1 only" to "opens across
  the whole band" **with no test turning red**. Also corrected: the AC's `meshPitch = 1.90463e-2` is
  the *idealized* value and equals the measured MEAN (1.93776e-2), but the measured WORST-CASE local
  edge angle on the real carrier mesh is **2.53520e-2**, 33% coarser. For a Nyquist floor the worst
  case governs — a feature sitting exactly on the AC's Shannon floor of 2 is delivered at n_s ≈ 1.50
  in the coarsest patches while the gate would report PASS. The closed form `sqrt(4π/N)` is worse
  still (1.77245e-2), so there is no cheap formula fix; the honest move is a measured constant with
  the measurement recorded.
- **The display path is NOT sVis-free.** 18 of the 19 sVis-carrying planet-uniform writes survive
  (`uCraterScale`, `uMountainScale`, `uMachDistrictScale`, `uCityScale`, `uScarpFreq`, …). This
  retires the MACRO BODY's law only.

### Wider footprint than continents, disclosed

Six animated decks call `fbmd` and inherit its internal `uDispDomainScale` factor, so their **cell
sizes** revert too: F31 clouds (`planet-lod-lab.html:869`), F33 silicate night deck (`:1131`), F40 dust
shreds (`:825-830`), F24 band warp, F25 jet turbulence, F26 weather warp. An earlier claim that their
DRIFT SPEEDS also change was **refuted** on verification: the `uTime` term sits inside the `fbmd`
argument and is multiplied by `freq` along with the spatial term, so object-space advection velocity is
scale-invariant; only cell size moves. The F47/F49 coverage masks are net-unchanged in frequency (the
`/uDispDomainScale` division cancels the internal factor exactly) but their `uMacroOffset` seed-phase
term stops being scaled.

---

## 5. Known limitations of this evidence

- `levels = 6` throughout (the shipped look). Correct for visual judgement; **not** valid for any
  sub-1e-5 numeric comparison — that needs `levels = 255` per session B's sensitivity finding.
- Feature counts in §3 are read off the frames by eye, not segmented. They are stated as approximate
  and are not load-bearing; the load-bearing facts are the uniform values and the hashes.
- One preset only (Rocky (Earthlike)), one seed pair (1, 1), one camera orientation. The law is
  preset-agnostic by construction (every preset shares the same `fbmd` body, `planet-lod-lab-core.js:111`)
  but that is an argument, not a measurement.
- The on-screen "✦ current: relief:" summary line lags the uniforms — it refreshes on GUI events, not per
  frame, so in several captures it reads `LEGACY synth (carrier off)` while the uniforms say otherwise.
  **Read the fingerprints, not the panel text.** `carrierOn` is computed at `planet-lod-lab.html:4377`
  from `grainCarveUI.reliefBakeStrength` (the GUI *base*) and `riverOverlay.heightSource`, neither of
  which is the effective uniform.
