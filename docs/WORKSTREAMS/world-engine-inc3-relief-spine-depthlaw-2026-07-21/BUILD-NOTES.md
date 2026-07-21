# Inc-3 BUILD-NOTES — relief-scale spine + crater depth-law correction

Companion record to `contract.json` (ACs), `BUILD-PLAN.md` (the spec),
`MATH-CHECK-2026-07-21.md` (the convicting numbers). Sections are filled
per-slice; S1 landed the envelope law + single-carrier rewire + this Derivation
Note. **S2/S3 sections below are stubs to be filled by those slices.**

---

## DOES / UNLOCKS (Rule 15 card)

**DOES:** bounds vertical relief into the real-body envelope via a *derived*
strength-cap law applied at the composite/bake seam through the ONE universal
`uPerturb` carrier (render-side, carrier bytes untouched), resolving the audit
footnote-14 exponent double-dip in ONE derivation note; (S2) corrects crater
depth/diameter to physical d/D.
**UNLOCKS:** radius visibly expressed in ALL height-bearing families at once
(through the single universal envelope); a single exponent-governance note that
Inc-4 (figure render) and Inc-5 (angular widths) size against; closes the v2-6
UAT "wavey-magma" finding.

---

## (1) THE DERIVATION NOTE — radius/gravity exponents across height families (AC-0 record)

> **Governing rule (one sentence): express radius through g, ONCE.** Post-v2-6
> `deriveConditionVector` sets `surfaceGravity = g_c·(R/R_c)`, so g is monotonic
> in the drawn radius at fixed composition — any `g^-q` factor already carries the
> radius signal. No height-bearing family may apply BOTH an explicit `1/R`/`rF`
> term AND a g-derived factor for the same physical effect (audit footnote 14).
> The shipped exponent is **anchor-fit, not `1/g²`-derived** (a naive
> strength-limited `h_max/R ∝ 1/g²` would put Mimas ~2.4e4× Earth — absurd);
> `Q_RELIEF = 0.58` is a least-squares fit through the real-body relief/R anchors,
> forced Earth = 1.

### 1.1 The one envelope application (the named consumer — AC-0)

**`reliefEnvelope(radiusEarth, surfaceGravity) → uPerturb`.** The derived
strength cap
`reliefEnvelope = clamp(g^-Q_RELIEF, RELIEF_FLOOR, RELIEF_CEIL)`
(`planet-lod-lab-core.js`, new export; constants `Q_RELIEF=0.58`,
`RELIEF_FLOOR=0.40`, `RELIEF_CEIL=133`) is applied **exactly once**, on
`uPerturb` (`planet-lod-lab.html`, per-frame uniform block). `uPerturb` is the
**universal `perturbAnalytic` strength** that scales the *entire accumulated
gradient* (base FBM + every combiner) — so every height-bearing family is
enveloped once through it. `reliefEnvelope` reads **only `surfaceGravity`** (a
derived condition scalar) — no label / archetype / regime-string read (AC-0
driver-connectivity satisfied structurally). `radiusEarth` is accepted for
call-site symmetry with the retired `reliefNorm` signature but is **unused in the
return** (radius flows via g) — pinned by a unit test.

### 1.2 Exponent ledger (every height-bearing family)

| Family / seam | radius channel BEFORE | issue | resolution (S1) |
|---|---|---|---|
| **`uPerturb`** (universal envelope carrier) | explicit `1/RE` × `g^-0.5` in `reliefNorm` | **convicted defect** (uncapped `1/RE`, 7× at worked pt, → ∞ as R→0) | **drop `1/RE`**; `uPerturb = state.perturb · reliefEnvelope(_RE,_gNow)`. Radius via g, once. THE one envelope application. |
| `uMountainAmp`, `uCraterAmp`, `uEcuCanyonDepth` | own amp × `reliefNorm`, then × `uPerturb` ⇒ `reliefNorm²` | **double-application** (each adds `amp·…` to `grad`, then the sum is `uPerturb`-scaled again) | **removed `reliefNorm` from the amp** (kept state amp × existing enable/exotic/relevance gates). Envelope now reaches them once via `uPerturb`. Byte-safe at Earth (`reliefNorm=1`). |
| `uEdificeAmp` | `(1/RE)` (g=1 passed) × `uPerturb` ⇒ `(1/RE)²` radius | double-application + unimplementable pre-lens instruction | **dropped the `(1/RE)` factor** entirely. Edifice radius now flows via **two DISTINCT laws, each once**: the global `uPerturb` envelope (`g^-0.58`, bulk strength cap) × `uEdificeMaxHeight = clamp(1/g, 0.2, 2.0)` (core, volcano-buoyancy ∝ 1/g). **Composed edifice g-exponent = `g^-1.58`, ACCEPTED as a distinct-effect composition** (strength-cap × buoyancy — like count ∝ R² vs size ∝ 1/R for craters), NOT the footnote-14 same-effect double-dip. Intentional edifice-amplitude behavior change. |
| **carrier height** (`tectonic`, `magmatism`, `relief-e6-tectonic`, `plates`, `shellRelief`, `stagnantLid`, `mixedInterior`) | `gCap`/`gFactor` ≈ `g^-0.5` only (stagnantLid `K_G=0` ⇒ ≡ 1), **no `1/R`** | write-side clean | **documented, NOT edited.** Grep-verified 2026-07-21: all seven apply a `reliefGravityFactor`-form gravity cap and none read `radiusEarth` for a relief term (`shellRelief.js` is explicit — "NEVER reads condition.radiusEarth … grep-denied in AC-0"). Golden-baked ⇒ no re-capture. |
| **bake seam** (baked carrier × `uPerturb`, live `reliefBakeStrength=1`) | carrier `gCap`(`g^-0.5`) × envelope(`g^-0.58`) ⇒ composed **`g^-1.08`** | render-side composition of two g-signals for the same effect | **accept-and-document, bounded**: both factors are clamped, so composed apparent is bounded; the **live AC-LAB-READ is the in-band gate** (coordinator's, later — the linear sizing model does not see this path). One-line fallback if live reads hot: exclude the baked branch from the `uPerturb` multiply. |
| Crater **depth** (`craterAmplitude`) | angular δ; g enters only at the transition | none (S2 scope) | new law reads g once (transition), δ for size — **S2**. Rendered apparent = carrier d/D × `uPerturb` envelope (bounded). |
| Crater **count/size** (`craterSchedule`) | `R²` (count), `radPerKm ∝ 1/R` (size), `g^-K_GS` (size) | none (distinct laws) | **untouched** — separate physical laws, not a relief double-dip. |
| atmo `uPolarAmp` (F29 polar-vortex MEANDER, "ALBEDO/LUMINANCE ONLY") | none (raw) | misclassified pre-lens | **OUT** — not km-relief AND atmo-lane fenced. Not wired, not touched. |
| Crystal `uFacetAmp` (F43 facet relief) | none (raw) | deferred wholesale | **OUT** — Crystal/exotics deferred (Max ruling 2026-07-21). Not wired. |
| Ejecta `uEjectaAmp` | none (raw) | fenced channel | **OUT** — ejecta fenced pending Max's product call (audit Q1). Not wired. |
| micro-texture (`uDuneAmp`, `uDustDepth`, `uFrostNoiseAmp`, `uTalusAmp`, `uLobeAmp`) | none (raw) | n/a | **out of the km-relief family** — surface textures. Already single-normalized via `uPerturb`; no second factor added. |
| raw macro-relief pass-throughs (`uChasmaDepth`, `uWrinkleAmp`, `uHexBorderDepth`, `uShatBorderDepth`, `uCryoRidgeAmp`, `uGlacialAmp`, `uLineationAmp`, `uSubAmp`, `uFluvialDepth`, `uOutflowDepth`, `uKarstDolineDepth`, `uKarstMazeDepth`, `uDeltaAmp`) | none (raw) | n/a | **already enveloped once via `uPerturb`.** Deliberately **NOT wired** — a per-amp `reliefEnvelope` would make them `envelope²`. |

**Sign discipline (all families):** lower g ⇒ higher relief/R (correct, kept).
**Magnitude discipline:** `reliefEnvelope = clamp(g^-0.58, 0.40, 133)`; the `133`
CEIL **never binds** — the internal `max(g, 1e-3)` g-floor caps the multiplier at
`(1e-3)^-0.58 ≈ 55` (≤ the Phobos strength extreme), so the "apparent ≤ 0.40 at
any degenerate draw" guarantee is delivered by the **g-floor**, not the CEIL.
`RELIEF_FLOOR = 0.40` is **inherited** from the current `gCap` floor (no fit body
exercises it; binds only above g ≈ 4.85). CEIL/FLOOR resize is non-blocking
calibration hygiene, flagged not silent (see §2.1 caveats — S3).

### 1.3 AC-0 conformance

- **No new `*Enabled` key** — S1 removed a multiplier and added a core export; no
  new state key or enable flag introduced.
- **Taxonomy / drift guards green** — `worldengine-v2-3-taxonomy`,
  `worldengine-v2-3-dispatch-oracle`, `worldengine-e1-shadow-audit`,
  `worldengine-e1-conformance-oracle`, `ws4-router-zero-drift` all pass post-edit
  (219 tests green together with the byte-fence + core regressions).
- **Named consumer documented:** `reliefEnvelope → uPerturb` (§1.1).

---

## (2) CALIBRATION RECORDS — *(S3: envelope band table caveats, Vesta under-band note, apparent-model-is-illustrative caveat, Copernicus residual, CEIL-never-binds / FLOOR-inherited note)*

## (3) DEPTH-LAW RECORD (AC-DEPTHLAW + AC-FENCE — S2)

> **DOES (S2):** replaces the inverted crater depth/diameter law in
> `src/worldengine/base/bombardment.js` with Pike-1977 physics. **INTENT:** kill
> the "wavey magma" read's second convicted cause (math-check #2) — near-
> hemispherical over-deep bowls whose over-steep field merged into molten waves.
> **NON-GOALS:** count/placement/coverage (untouched — the population is the S1/v2-6
> draw, proven invariant); the legacy F2/F3 in-shader crater synth (separate path);
> ice-relaxation numerics (S3); the render-side envelope (S1).

### 3.1 The law change (file : symbol)

`bombardment.js` → **`craterAmplitude(D, D_km, g)`** (was `craterAmplitude(D)`):
- SIMPLE band: `A = CRATER_DEPTH_N·(δ/D_REF_RAD)^DEPTH_POW = D_D_SIMPLE·δ` ⇒
  **d/D = 0.20 CONSTANT** (Pike 1977 fresh-simple). Preserves the `A(D_REF)=CRATER_DEPTH_N` invariant.
- COMPLEX roll-off: when the REAL diameter `D_km > D_t(g)`, `A ×= (D_t/D_km)^P_COMPLEX`
  ⇒ **d/D falls with size** (`transitionDiameterKm(g) = K_DT/g`, new export).
- Angular-only callers (`D_km`/`g` omitted) ⇒ the simple branch — the single-arg
  V2-5/V2-6 callers and the ε=0 bit-identity are preserved.

**Constants** (calibration/crater-depth-law.mjs step-0 solution, reproduces):
`CRATER_DEPTH_N 0.18→0.10`, `DEPTH_POW 0.5→1.0`, new `D_D_SIMPLE=0.20`,
`K_DT=3.1` (LS-fit Earth 3.5 / Mercury 10 / Moon 18 km), `P_COMPLEX=0.66`
(SPA d/D=0.008 anchor; Pike complex d∝D^0.3).

Pass-through: **`craterProfile(s, D, D_km, g)`** and
**`relaxedCraterProfile(s, D, epsBowl, epsRim, D_km, g)`** forward `(D_km, g)` to
`craterAmplitude`; **`writeBombardment`** derives `gStamp` once and passes the
yielded `D_km` + `gStamp` into every stamp; `collectDiag` per-crater record adds
`D_km` and stores `A` as the **actually-stamped** amplitude
`craterAmplitude(delta, D_km, gStamp)`.

### 3.2 Verified numbers (reproduce: `node calibration/crater-depth-law.mjs`)

- OLD d/D `0.36 → 1.085` across the rendered Moon range (inverted, hemispherical
  at the floor). NEW d/D **`0.068 → 0.015`**, monotone non-increasing, **max 0.068 ≤
  0.25**; simple-basin legibility `A(D_REF)=0.10 ≥ MIN_BASIN 0.08`. A tiny low-g body
  (g=0.0065 ⇒ `D_t=477 km`) keeps rendered craters SIMPLE bowls (d/D=0.20) — the
  Mimas/Vesta lumpy-but-cratered read, not molten.
- **Known residual (flagged, not silent — BUILD-PLAN §2.2/risk 3):** Copernicus
  cross-check reads d/D ≈ **0.070 vs literature 0.040** (single-SPA-anchor fit
  under-shallows the mid-complex range ~1.7×). Shape, extremes, and monotonicity are
  correct and the render goal (kill the inversion + hemispherical pits) is met;
  tightening `P_COMPLEX` against a second anchor is deferred.

### 3.3 Fence proof (AC-FENCE — the depth edit cannot move the population)

- **Structural** (unit test): `craterSchedule` / `forEachCrater` bodies contain **no
  `craterAmplitude` reference** (brace-scoped grep assert) — the draw stream is
  amplitude-free by construction.
- **Empirical** (`calibration/fence-population-invariance.mjs` + committed
  `fence-baseline.json`, captured at the **pre-edit S1 head**): at a fixed
  worldSeed + Moon-class condition the population is **byte-identical pre/post** —
  `nStamp 147`, `coverage 0.428556`, all 147 sorted `{centre, D_km, tI}` tuples, and
  the 3154-node nonzero **footprint** (crater geometry is amplitude-free). Only the
  craterField **amplitudes changed**: full-array hash `794774e4 → 24a929a6`,
  exemplar[0] `0.01697 → 0.00041` (≈41× shallower), every exemplar `|new| ≤ |old|`.
- **Golden byte-identity:** `tests/v2-0-byte-identity.test.js` green, **no re-capture**
  (the edit is `craterField`-only, unhashed; carrier bytes untouched).

## (4) FROZEN-ICE TRACE (AC-FROZEN-TRACE) — *(S3)*

## (5) SUITE BASELINE AT THE SEAM

Full `npx vitest run` from the repo dir after S1 = **4 known failures**
(KnownObjects ×3, GalacticFeatures ×1) + 15 vendor/motion-test-kit collection
files (load-time noise) — **baseline not grown**. New file
`tests/worldengine-inc3-relief-envelope.test.js` = 10/10 green.

**After S2:** full `npx vitest run` from the repo dir = **the SAME 4 known
failures + the SAME 15 vendor/motion-test-kit collection files — baseline not
grown**; 2228 passed. Targeted: `worldengine-inc3-depth-law` (new) +
`worldengine-v2-5-bombardment` (edited) + `worldengine-v2-6-craters` (edited) +
`worldengine-v2-6-ice` + `v2-0-byte-identity` = **130/130 green**; AC-0 guards
(`e1-shadow-audit`, `e1-conformance-oracle`, `v2-3-dispatch-oracle`,
`v2-3-taxonomy`, `ws4-router-zero-drift`, `v2-6-crystal`) = **90/90 green**.

## (6) DEVIATIONS FROM PLAN

- **Comment-only, additive to plan step 4:** the plan named the stale comment
  block at the retired `reliefNorm` (fixed) but the frame-loop comment at
  (formerly) `planet-lod-lab.html:5604` also referenced `reliefNorm()` by name.
  Updated it to `reliefEnvelope()` so no comment dangles a retired symbol
  (same rationale as byte-fence MINOR-5). No code effect.
- **Import line:** `reliefAmplitudeFromKm` / `reliefGravityFactor` are now only
  comment-referenced in `planet-lod-lab.html` (their sole live consumer,
  `reliefNorm`, was retired) but were **left in the import** per plan step 1 ("do
  NOT edit `reliefGravityFactor` / `reliefAmplitudeFromKm`"). Harmless unused
  imports in an inline ES module; removing them was not in scope.
- Test cross-check tolerance: the anchor-column cross-check compares to the
  calibration's published 5-sig-fig multipliers with a **0.1% relative** tolerance
  (an absolute `toBeCloseTo(_,2)` is too tight at ~18.6/~55). Still catches any
  real drift (a `Q_RELIEF` change moves anchors by whole percents).

### S2 deviations

- **AC-DISTINCT metric (plan §4 offered "normalized OR law-derived threshold" — chose
  normalized):** the two AC-DISTINCT asserts (`worldengine-v2-5-bombardment.test.js`
  :253/:264) were re-based onto an amplitude-INVARIANT relative distance
  `relL2 = ‖a−b‖ / rms(a,b)` at threshold **0.9** (with the required churn comment).
  The plan's predicted raw collapse reproduced exactly (inter-seed min `2.68→0.075`,
  grid min `1.20→0.023`); observed post-edit `relL2` min ≈ **1.35** (inter-seed) /
  **1.26** (grid), both ≫ the 0 same-seed repeat floor. Intent preserved and now
  immune to any future amplitude retune.
- **`transitionDiameterKm(g)` extra export (additive to plan §S2.1):** the plan named
  `K_DT`/`P_COMPLEX`/`D_D_SIMPLE` as new exports and wrote `D_t=K_DT/g` inline. I
  factored `D_t` into an exported helper `transitionDiameterKm(g)` so AC-DEPTHLAW's
  "D_t(g) at the three anchors" is asserted directly. Pure additive; no behavior change.
- **Fence harness gated in CI (additive to plan §5.2):** `fence-population-invariance.mjs`
  also exports `runVerify()`, which the new `worldengine-inc3-depth-law` test calls, so
  the empirical population-invariance proof runs in vitest (not only standalone). The
  committed `fence-baseline.json` was captured at the pre-edit S1 head per §5.2 —
  **do NOT re-capture post-edit**.
- **Unused import left in place:** `craterAmplitude` is no longer referenced in
  `worldengine-v2-6-craters.test.js` (the clean-floor assert switched to the diag's
  stamped `cr.A`) but was **left in the import** — harmless in ESM, and removing it was
  not in the plan's edit (smallest-edit discipline).
- **`bombardment.js` S3 header note updated (comment-only):** the S3-era "the vertical
  amplitude of craterProfile is unchanged" line would now mislead; appended a one-line
  "INC-3 S2 supersedes that amplitude law" pointer (same rationale as byte-fence
  MINOR-5). No code effect.
