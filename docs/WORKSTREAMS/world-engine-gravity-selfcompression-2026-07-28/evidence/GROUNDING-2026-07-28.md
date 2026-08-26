# Super-Earth gravity law (`R^1.70`) — build-readiness assessment

**Target:** `/home/ax/projects/well-dipper/body-condition-vector.js:37`
**Date of assessment:** 2026-07-28 · repo state: `npm run verify-golden` → `PASS — canonical-scenario-v1 matches golden 40c18aad, samples: 1200`

---

## 1. Verdict

**NEEDS-FIX.** The exponent change is safe on goldens and cheap on tests (measured: exactly 3 test failures, all legitimate re-pins), but it is **not build-ready** because two things block it:

1. **The proposed edit as written is ungated.** `body-condition-vector.js:37` is a single expression with no composition branch and no radius branch. Zeng, Sasselov & Jacobsen 2016 is a rocky two-layer PREM fit valid over 1–8 M⊕ / CMF 0.0–0.4, which at CMF = 1/3 is **R ∈ [1.000, 1.754] R⊕** (recomputed: `8^(1/3.7) = 1.754197044080575`). The reachable radius domain is **[0.27, 16] R⊕** and includes 5 h2-he gas presets (Jovian 11.2, Hot Jupiter 13.0, Saturnian 9.4, Neptunian 3.9, Sub-Neptune 2.7) and 8 presets with R_c < 1. Shipping `^1.70` unconditionally applies a rocky self-compression law to gas giants and to sub-Earth bodies where the current `^1.0` is closer to correct. **Composition gating and the sub-Earth branch are scoping decisions that must be made before code lands** (§6).

2. **The largest visible gravity consumer does not read this field at all.** `uniforms.uPerturb.value` — the global relief-amplitude uniform — is fed `state.surfaceGravity`, whose sole writer is the *canonical, radius-blind* `u.surfaceGravity`. Changing line 37 moves nothing there. This is a pre-existing wiring defect, but it means the fix as scoped will not produce the visual outcome the brief implies (§3.1). Decide whether to fix it in the same workstream or declare it out of scope, explicitly.

Everything else is green. Goldens hold, byte-identity holds, the test cost is 3 assertions, and the physics arithmetic is correct.

---

## 2. What the change actually is

### Path correction (the brief is wrong)

The research brief `research/superearth-relief-law-2026-07-28.md` cites `src/worldengine/base/body-condition-vector.js:37`. **That path does not exist.**

```
$ ls -la body-condition-vector.js
-rw-r--r-- 1 ax ax 6276 Jul 20 00:12 body-condition-vector.js
```

The only copy is at the **repo root**. The line number 37 is correct. This matters for two reasons: (a) the root file is *not* scanned by `tests/vis-scale-fence.test.js`, and (b) it is *not* covered by `doc-rot`'s `find src -name '*.js'` scan.

### Current expression, verbatim (`body-condition-vector.js:37`)

```js
  surfaceGravity:  (derived?.surfaceGravity ?? bodySurfaceGravity(fp)) * ((radiusEarth ?? fp.radiusEarth ?? 1.0) / (fp.radiusEarth ?? 1.0)),
```

Its justifying comment (`:32–36`) derives the exponent 1.0 from constant density:

> `g = g_c·(R/R_c)` — the normalized-at-canonical ratio form of `M=(ρ/ρ⊕)·R³` per composition class (`M_derived(R) = M_c·(R/R_c)³ ⇒ g = M_derived/R² = g_c·(R/R_c)`)

### Proposed expression

```js
  surfaceGravity:  (derived?.surfaceGravity ?? bodySurfaceGravity(fp)) * Math.pow((radiusEarth ?? fp.radiusEarth ?? 1.0) / (fp.radiusEarth ?? 1.0), 1.70),
```

### The arithmetic (DERIVATION, not calibration)

Zeng+2016: `R/R⊕ = (1.07 − 0.21·CMF)·(M/M⊕)^(1/3.7)` ⇒ `M ∝ R^3.7` ⇒ `g = M/R² ∝ R^(3.7−2) = R^1.70`, **exactly**, at every R and every CMF. The coefficient `(1.07 − 0.21·CMF)` enters `g` only as a multiplicative constant `k^-3.7` and **cancels identically** in the normalized ratio form the code uses. Confirmed numerically: `Math.pow(1.6, 1.7) = 2.223330217241199`; CMF sweep 0→1 reproduces `(R/R_c)^1.7` to ≤ 2e-15.

**Consequence for AC-0:** the fix needs **no CMF / ironFraction plumbing**. `radiusEarth` is already the third argument. But the exponent `1.70` is a new literature constant, not a driver — see §7.

**Calibration status:** this is a **DERIVATION**, not a calibration. Zeng's relation is a fit to interior-structure models anchored on Earth and Solar-System rocky bodies; there is **no measured super-Earth surface gravity and no measured super-Earth topography** anywhere in the chain. The exponent is defensible for R ∈ [1.00, 1.75] R⊕ and is extrapolation everywhere else. Measured over the reachable slider, the valid band is **4.79% linear-in-radius** or **13.77% of slider travel** (`radiusFromT` is a log map, `planet-lod-lab-core.js:94`) — i.e. **~86–95% of the reachable domain is extrapolation**, depending on metric.

---

## 3. Blast radius

### 3.1 The structural finding first: the visible relief amplitude does NOT read this field

```
world-engine-lab.html:2999   const u = deriveUniforms(DRIVER_PRESETS[driverUI.preset], driverUI.qualityTier);
world-engine-lab.html:3016   state.surfaceGravity = u.surfaceGravity;
world-engine-lab.html:5903   const _RE = state.planetRadiusEarth, _gNow = state.surfaceGravity ?? 1.0;
world-engine-lab.html:5908   uniforms.uPerturb.value = state.perturb * reliefEnvelope(_RE, _gNow);
```

`grep -n "state\.surfaceGravity" world-engine-lab.html` returns exactly three hits: `:3016` (sole writer), `:4261` (disabled GUI readout), `:5903` (this read). And `deriveUniforms` computes gravity from the **canonical** radius:

```
planet-lod-lab-core.js:609-611
  const radiusEarth = d.radiusEarth ?? 1.0;
  const massEarth = d.massEarth ?? 1.0;
  const surfaceGravity = massEarth / (radiusEarth * radiusEarth);
```

So `uPerturb` is radius-invariant twice over — `reliefEnvelope` also discards its `radiusEarth` argument entirely:

```
planet-lod-lab-core.js:1103-1105
export function reliefEnvelope(radiusEarth, surfaceGravity) {
  return Math.min(RELIEF_CEIL, Math.max(RELIEF_FLOOR, Math.pow(Math.max(surfaceGravity, 1e-3), -Q_RELIEF)));
}
```

This directly contradicts the comment at `planet-lod-lab-core.js:1090-1093` that justified dropping the explicit `1/RE` term ("g ALREADY carries the radius signal … the explicit 1/RE is DROPPED"). At the live wiring it carries nothing.

**Scope qualifier — do not overstate this.** The exponent change is *not* visually inert. `condition.surfaceGravity` reaches the rendered surface through the World Engine writer/carrier path (`bombardment.js` → `carrier.craterField`, `reliefBudget.js` → `compositeMargins` weights), and the baked carrier is blended in via `uReliefBakeStrength`. What is inert is the **global relief-amplitude uniform** specifically.

### 3.2 Consumers that CHANGE — measured at R = 1.6

Numbers below were produced by me, executing the real exported functions (`craterSchedule`, `transitionDiameterKm`, `deriveReliefBudget`, `deriveFigureDescriptor`, `reliefEnvelope`) with `condition.surfaceGravity` recomputed at each exponent. Nothing is estimated.

**Column A — `Eyeball (locked temperate)`** (R_c = 1.0, g_c = 1.0; the brief's exact case).
**Column B — `Moon/Mercury (impact-airless)`** (R_c = 0.38, g_c = 0.277008; the only preset family with a live stamped crater population).

| # | quantity | site | A: p=1.0 | A: p=1.70 | B: p=1.0 | B: p=1.70 |
|---|---|---|---|---|---|---|
| 1 | `condition.surfaceGravity` | `body-condition-vector.js:37` | 1.60000 | **2.22333** (+39.0%) | 1.16635 | **3.19054** (+173.6%) |
| 2 | `transitionDiameterKm = 3.1/g` (km) | `bombardment.js:235` | 1.93750 | **1.39430** (−28.0%) | 2.65786 | **0.97162** (−63.4%) |
| 3 | `craterSchedule.sizeMul` | `bombardment.js:162` | 0.820587 | 0.775951 (−5.4%) | 0.865892 | 0.729740 (−15.7%) |
| 4 | `craterSchedule.nStamp` | `bombardment.js:162` | 0 | 0 (no stamps) | **90** | **64** (−28.9%) |
| 5 | `craterSchedule.regolithRoughness` | `bombardment.js:162` | 9.176e-6 | 8.275e-6 (−9.8%) | 2.212e-1 | 1.613e-1 (−27.1%) |
| 6 | `deriveReliefBudget` f_I → `compositeMargins` w_e/w_i | `reliefBudget.js:143` | 0 (out of domain) | 0 | **0.365218** | **0.233428** (−36.1%) |
| 7 | `deriveFigureDescriptor.fPresent` (∝1/g) | `bodyFigure.js:56` | 4.2932e-3 | 3.0896e-3 (−28.0%) | 5.8894e-3 | 2.1530e-3 (−63.4%) |
| 8 | `reliefEnvelope(R,g)` **as a function** | `planet-lod-lab-core.js:1103` | 0.761396 | 0.629126 (−17.4%) | 0.914617 | 0.510221 (−44.2%) |

Row 8 carries an asterisk: it changes as a function but **not at the render**, per §3.1. It changes only in calibration `.mjs` scripts and in the instrument sweep.

Also affected (not re-measured here, but same channel): `iceRelaxation.tauGa ∝ 1/g` (`bombardment.js:281`), `sigmaImpOverR` (`reliefBudget.js:69`), `sigmaEndoRelicOverR ∝ g^-0.58` (`reliefBudget.js:89`), `phiPeakOf` (`reliefBudget.js:103`), `lidStrength` gMod (`e1Regime.js:84`), `massEarthOf = g·R²` (`e1Regime.js:90-92`) — which silently becomes `M_c·(R/R_c)^3.7`.

**The change is not confined to R > 1.** At R = 0.5 with R_c = 1: g goes 0.500 → 0.3078 (−38.4%). Sub-canonical bodies get *lighter*.

### 3.3 Consumers that are GATED or INERT

| site | why inert |
|---|---|
| `world-engine-lab.html:5908` `uPerturb` | reads `state.surfaceGravity` = canonical g_c, not the condition vector (§3.1) |
| `giant-drivers.js:176` → E5 bands/storms | `drawGiantConditions` **overwrites** gravity by back-solving from the pinned M0: `giant-drivers.js:234 const surfaceGravity = drawnMass / (R * R);` (spread `...b` comes first, so the back-solve wins). Both lab call sites (`:2853`, `:2939`) go through it. Incoming g is discarded. |
| `tectonic.js:137, :207` `reliefGravityFactor(drivers.surfaceGravity ?? 1)` | `drivers` is `grainDrivers` = `DEFAULT_GRAIN_DRIVERS` (`planet-lod-rivers.js:113` — `{despinAmp, radialStrainSign, radialStrainMag}`, no gravity key) ⇒ `reliefGravityFactor(1) === 1.0` exactly. Dormant. |
| `instrument/laws.js:130` `relief-envelope-vs-gravity` | sweeps a synthetic `baselineCondition()` literal, never calls `deriveConditionVector` |
| `magmatism.js:118`, `stagnantLid.js:95` | read the **flat** `massGravity` D-slot, not the nested condition vector |
| all 5 h2-he presets on the relief route | `planet-lod-rivers.js:569 if (cls === 'gas' \|\| cls === 'carbon') return despun();` fires before any gravity branch; `isImpactSurface` is false for all giants (P = 1000 bar ≥ `P_SURF_MAX` = 200), so bombardment/craterSchedule/reliefBudget all self-gate off |
| `world-engine-lab.html:2812` | `if (useOv('gravity')) _cond.surfaceGravity = driverOv.gravity;` — the gravity slider in override mode bypasses the exponent entirely |

**Correction to a lens claim:** `deriveSurfaceMaterial` does **not** self-gate off for giants — `surfaceMaterial.js:125-131` computes `iceness` unconditionally and it *is* a live giant render channel (`world-engine-lab.html:3796` → `uIcenessMix`). It carries no gravity only because `icenessOf` reads density/volatileFraction/T_eq, never g.

---

## 4. Byte-identity and goldens — MEASURED, not argued

### Mechanism

At R === R_c the ratio is `x/x` on the identical float = exactly `1.0`, and `Math.pow(1, 1.7) === 1` → `true` (verified). So `g_c * 1.0 === g_c` bit-for-bit for any finite exponent.

### Direct measurement

I built a matched control/mutation pair (identical copies of `body-condition-vector.js`, one patched to `Math.pow(ratio, 1.70)`), aliased via a scratchpad vitest config, repo untouched.

```
$ npm run verify-golden
[golden] PASS — canonical-scenario-v1 matches golden 40c18aad
  samples: 1200 (golden: 1200)
```

Structurally immune anyway: `tests/golden-trajectories/run-golden.mjs` and `canonical-scenario.js` contain no `deriveConditionVector`, no `radiusEarth`, no `surfaceGravity`.

```
$ npx vitest run --config <mut-config> tests/v2-0-byte-identity.test.js
 Test Files  1 passed (1)
      Tests  83 passed (83)
```

**Under the exponent-1.70 mutation, all 83 byte-identity tests pass.** No fixture recapture required, none permitted.

**Count correction:** the fixture holds **75** `(preset, seed)` hash rows (`tests/v2-0-byte-identity.test.js:64 expect(count).toBe(75);`), asserted by **83 test cases**. The brief's "83 byte-identity rows" conflates the two. The carrier fixture passes canonical radius: `tests/fixtures/v2-0-carrier-golden.mjs:75 condition: deriveConditionVector(fp, u, fp.radiusEarth),`.

**The condition on this verdict:** byte-identity holds **only if the fix keeps the normalized-at-canonical ratio form**. If it instead re-derives g absolutely from a Zeng M(R), byte-identity is gone — Zeng's fit gives `g(1 R⊕) = 0.99355`, not 1.000, and `tests/worldengine-base-condition-vector.test.js:141` pins `expect(v.surfaceGravity).toBe(fp.massEarth / (fp.radiusEarth * fp.radiusEarth))`. Any absolute re-derivation moves all 75 carrier rows.

---

## 5. Tests that move — MEASURED

Matched control (identical pass-through shim): `Test Files 4 failed | 135 passed (139)` / `Tests 2201 passed (2201)` — 0 test failures; the 4 file-level failures are vendor `motion-test-kit` resolution artifacts of my scratchpad config, present identically in both runs.

Mutation (`^1.70`): `Test Files 6 failed | 133 passed (139)` / `Tests 3 failed | 2198 passed (2201)`.

**Exactly three test failures, in two files:**

| # | file:test | failure | classification |
|---|---|---|---|
| 1 | `tests/worldengine-v2-6-gcohere.test.js:66` — "surfaceGravity equals the coherence law as computed, exactly, across the R sweep" | `Rocky (Earthlike) @R=0.2: expected 0.05834363748093946 to be 0.18000000000000002` | **legitimate re-pin.** `expect(cv.surfaceGravity).toBe(g_c * (R / R_c))` — bit-exact `toBe`, exponent 1.0 hard-coded. 18 presets × 9 radii (`R_SWEEP` at `:21`); 156 of 162 cases discriminate (6 have R === R_c). Rewrite as `g_c * (R / R_c) ** p`. |
| 2 | `tests/worldengine-v2-6-gcohere.test.js:96` — "reconstructs M_c·(R/R_c)³ across the R sweep for every preset" | `Rocky (Earthlike) @R=0.2: expected false to be true` | **legitimate re-pin, and the physically load-bearing one.** `massEarthOf = g·R² = M_c·(R/R_c)^(p+2)`, so the implied mass law moves from constant-density `M ∝ R³` to `M ∝ R^3.7`. Rewrite `** 3` → `** 3.7`. **This one was omitted from one lens's finding — do not lose it.** |
| 3 | `tests/radius-live-feed.test.js:834` — "the gravity channel IS exercised — this is not a sweep over a dead input" | `AssertionError: expected 15.177041870149276 to be less than 1e-9` | **legitimate re-pin, different reason.** This is a non-vacuity/instrument-liveness guard, not a physics pin. It asserts `gHi/gLo === span = RADIUS_SLIDER_MAX/RADIUS_SLIDER_MIN = 53.333`; under p=1.70 the ratio is `span^1.7 = 862.7755664079616` (independently verified). Rewrite as `span ** p`. |

**No red flags.** Specifically **not** failing under the mutation, contrary to one verifier's claim: `tests/worldengine-inc3b-composite-budget.test.js` (AC-BUDGET) — it passes. Also passing: `tests/v2-0-byte-identity.test.js` (83), `tests/worldengine-base-condition-vector.test.js`, the gcohere monotonicity test (`:72` — `R^1.7` is still monotone), the gcohere FENCE-2 key-set test (`:118` — stays green *only if no new field is added to the vector*), and the AC-CRATERBOOT no-flip sweep at `tests/radius-live-feed.test.js:816` (zero flipping presets under both exponents, over 18 presets × the reachable range).

**Latent measurement defect (not a failure):** `tests/worldengine-v2-6-craters.test.js:70` re-implements `g_c * (R / R_c)` harness-side (`const schedFor = (R) => craterSchedule(cond({ g: g_c * (R / R_c), R }));`) instead of importing `deriveConditionVector`. It will keep passing while silently measuring a law production no longer implements. Rewire it.

**Non-CI harnesses that hard-assert exponent 1.0** (will fail if re-run, not in the suite): `docs/WORKSTREAMS/world-engine-inc3-relief-spine-depthlaw-2026-07-21/calibration/population-sweep.mjs:136-140` and `.../world-engine-v2-6-radius-craters-ice-crystal-2026-07-19/calibration/population-sweep.mjs` — both `const gExpected = gCanon * (R / R_c); if (cond.surfaceGravity !== gExpected) failures.push(...)`.

---

## 6. The two design questions the physics does NOT settle

These are scoping decisions. They must be made before code lands, because they determine whether the edit is one expression or a branch.

### 6.1 Composition gating — does the rocky exponent apply to the 5 h2-he presets?

**Physics says no.** Zeng is a rocky two-layer PREM fit; giants are outside it in kind, not just in degree.

The gate is already available with zero new plumbing. `body-condition-vector.js:42` already reads the datum:

```js
  atmosphere:      fp.atmosphere ?? null,   // composition read by compositionClass
```

and `src/worldengine/base/e1Regime.js:67` is the canonical terminal:

```js
  if (cv.atmosphere && cv.atmosphere.composition === 'h2-he') return 'gas';   // h2-he envelope terminal (fires first)
```

Census (executed): 18 presets; exactly 5 h2-he — `Gas giant (Jovian)` 11.2, `Gas giant (Saturnian)` 9.4, `Ice giant (Neptunian)` 3.9, `Sub-Neptune (hazy)` 2.7, `Hot Jupiter (locked giant)` 13.0.

**Options:**

| option | consequence |
|---|---|
| **(A) Gate on `fp.atmosphere?.composition === 'h2-he'`, leave giants on `^1.0`** | Physically honest about domain. Cost: one branch. Note the blast radius on giants is *already* near-nil (the E5 path back-solves g away; the relief route terminates at `despun()` before any gravity branch), so this is mostly hygiene — but it prevents `deriveFigureDescriptor` computing gas-giant oblateness off a rocky law. |
| **(B) Import `compositionClass` and gate three-way (gas / icy / rocky)** | Single source of truth for the boundary constants (2.5 / 3.9 / `'h2-he'` / C/O > 1). No import cycle: `e1Regime.js` imports only `alea` + `mathutil` and never reads `surfaceGravity`. Also excludes the 4 icy presets (Titan 0.4, Frozen 0.5, Europa 0.5, Crystal 0.8), for which Zeng's rocky EOS has no validity. Cost: one import from `src/worldengine/**` → triggers Rule 15. |
| **(C) Apply `^1.70` unconditionally** | Simplest diff. Applies a rocky self-compression law to bodies whose real `dg/dR` is flat-to-negative. Measured in-repo evidence against it: fitting `dln g/dln R` between preset pairs gives Sub-Neptune→Neptunian **−0.001**, Neptunian→Saturnian **−0.048**, Jovian→Hot Jupiter **−0.456**. **Not recommended.** |

**Refuted framing worth naming:** it is *not* true that "R is nearly independent of M" for all five. By Chen & Kipping 2017 the Neptunian/Jovian break is ~0.414 M_J ≈ 132 M⊕. Jovian (317.8 M⊕) and Hot Jupiter (400 M⊕) are degenerate — there a radius-keyed g law is genuinely **ill-posed**. Saturnian (95.2), Neptunian (17.1) and Sub-Neptune (8.2) sit below the break where R is strongly monotone in M — there the law is merely **wrong-exponent**, not ill-posed.

### 6.2 The sub-Earth domain — what exponent below 1 R⊕?

**The brief's implicit `^1.0` below 1 R⊕ is an over-correction.** `n = 1.0` is the **M → 0 incompressible asymptote**, not the sub-Earth value.

Valencia, O'Connell & Sasselov 2006 (arXiv:astro-ph/0511150, Icarus 181:545) — retrieved. Abstract verbatim: *"The scaling law obtained for the Super-Mercuries is R∝M^∼0.3."* Converting `β = dlnR/dlnM` to `n = 1/β − 2`:

| source | band | β | **n = dln g/dln R** | status |
|---|---|---|---|---|
| Valencia 2006 Super-Earths | 1–10 M⊕ | 0.263–0.272 (Table 1) | **1.677 – 1.802** | brackets Zeng's 1.700 |
| Zeng 2016 | 1–8 M⊕ | 1/3.7 | **1.700** | the proposal |
| Valencia 2006 Super-Mercuries | 0.055–0.553 M⊕ | ~0.30 (Table 2: 0.2991–0.3094) | **~1.23 – 1.34**, central ~1.30 | iron-rich (CMF 50/65/80%), **not Earth composition** |
| incompressible limit | M → 0 | 1/3 | **1.000** | asymptote only |

**Caveat, stated because it matters:** Valencia's Super-Mercury family is explicitly *"similar composition to the Earth's but larger core mass fraction"* — no Earth-composition sub-Earth-mass run exists in that paper. Extrapolating its CMF trend down to Earth's 32.6% gives β ≈ 0.299 → n ≈ 1.34, but that extrapolation is ours, not the paper's. Treat ~1.3 as an **inference from** Valencia, not a **result of** Valencia.

Also note Valencia's own framing (§4): the sub-Earth exponent moves **toward** the constant-density value, it does not reach it. Do not restate this as "it is NOT 1.0" — the honest summary is "it falls from ~1.70 to ~1.30, not to 1.00."

**Options:**

| option | consequence |
|---|---|
| **(A) Piecewise absolute-R with `n_lo = 4/3`, `n_hi = 1.70`, continuous at R=1** | Best physical fidelity of the cheap options. Derivative kink at R=1 (slope jumps 1.333 → 1.700, a 1.275× change) — continuous in g, discontinuous in dg/dR; visible only as a slope change while dragging. Byte-exact at R === R_c. Two `Math.pow`, one branch. |
| **(B) Piecewise with `n_lo = 1.0`** (the brief's implicit form) | Wrong by ~33% in the exponent across the band where 8 of 13 rocky/icy presets live. Not recommended. |
| **(C) Smooth blend**, `ln f(R) = n_lo·lnR + ((n_hi−n_lo)/s)·ln(1+R^s)` | No kink, C^∞, correct asymptotes. Introduces a sharpness parameter `s` that **nothing constrains** — pure taste. Within ~5% of (A) everywhere. |
| **(D) Pure ratio power `^1.70` everywhere** (the brief as literally written) | Correct for exactly 2 presets over part of their range. Wrong for the 8 presets with R_c < 1 at **every** off-canonical radius. At Mars (R_c=0.53): at R=4 it is 56% above the piecewise form; at R=0.27, 38% below. **Fixes super-Earths by breaking Mars, Mercury, Europa and Titan.** Do not ship. |

### 6.3 The ratio-form trap (why 6.2 is not a corner case)

The code is `g = g_c · f(R)/f(R_c)`, an **anchored ratio**. A piecewise-in-absolute-R law and a pure ratio power agree **iff R and R_c sit on the same branch**. Since **8 of 13** rocky/icy presets have R_c < 1 (`Moon/Mercury 0.38, Titan 0.40, Frozen 0.50, Europa 0.50, Mars 0.53, Crystal 0.80, Lava 0.90, Venus 0.95`), those never agree at any off-canonical radius. The remaining 5 diverge across all of R < 1 — which every preset can reach (slider `[0.3, 16]`, `planet-lod-lab-core.js:91-92`) and which is `Carbon (high C/O)`'s **entire** draw band (`'carbon': [0.4, 0.9]`, `src/core/ScaleConstants.js`, despite R_c = 1.1).

If the implementation is piecewise, **that is a second law** and should be registered as such (§7.3), not hidden inside a single-exponent claim.

---

## 7. Fence and rule hazards

### 7.1 `tests/vis-scale-fence.test.js` — wording traps

Deny pattern, verbatim (`:28`):

```js
const DENY = /visScaleOf|\bsVis\b|VIS_SCALE_EXP/;
```

Applied to **raw file text, comments included** (`read()` is a bare `readFileSync(..., 'utf8')`, no stripping). Scope: every `.js` under `src/worldengine/` recursively (35 files today, 0 offenders), plus 5 named procgen surfaces (`planet-lod-height.glsl.js`, `planet-lod-river-amplifier.glsl.js`, `planet-lod-rivers.js`, `tests/golden-trajectories/run-golden.mjs`, `canonical-scenario.js`), plus every `/* glsl */` template body in `world-engine-lab.html`.

**`body-condition-vector.js` is at repo root and is NOT scanned.** The edit itself cannot trip this fence.

**Where it bites:** any comment added to `src/worldengine/base/{reliefBudget,bombardment,e1Regime,bodyFigure,giant-drivers}.js`. Verified against the live regex:

| wording | verdict |
|---|---|
| `// g keys on the DRAWN radius, never the display scale sVis.` | **TRIP** |
| `// NOT the display scale (visScaleOf) — this is physics radius.` | **TRIP** |
| `export const G_VIS_SCALE_EXP = 1.7;` | **TRIP** (`VIS_SCALE_EXP` has no `\b` anchors) |
| `// sVis-free by construction` | **TRIP** |
| `export const GRAV_R_EXP = 1.7;` | safe |
| `export const MASS_RADIUS_EXP = 3.7;` | safe |
| `// the physics radius, not the visual disc factor` | safe |

The most natural sentence to write in a gravity fix — "this is the *physical* radius, not `sVis`" — is exactly what the fence bans. **Rule: inside `src/worldengine/**`, refer to the display layer only by description.** No allowlist entry is proposed.

### 7.2 `tests/radius-live-feed-fence.test.js` — lab-only, comment-inclusive

Scope is `world-engine-lab.html` only (`:30-31`). Deny (`:50`):

```js
const DENY_SRC = String.raw`(?:\b_fp\b|\bfp\b|DRIVER_PRESETS\s*\[[^\]]*\])\s*\??\.\s*radiusEarth`;
```

Exactly two allowlisted sites (`:64-113`): `craterboot-worldDefaultEnableSet`, `giantDynamo-compositionClassifier`. A lab comment writing `// R_c = fp.radiusEarth (the canonical radius the Zeng ratio normalizes at)` **FAILS**; `// R_c is the canonical preset radius (the frozen preset constant)` is safe.

### 7.3 Law-registry gap and the drafted entry

`LAW_REGISTRY` (`src/worldengine/instrument/laws.js`) holds **six** entries (grep of `id: '`): `crater-size-vs-gravity` (:65), `crater-count-independent-of-gravity` (:75), `crater-count-vs-radius` (:90), `mesh-floor-vs-radius` (:100), `basin-cap-vs-radius` (:111), `relief-envelope-vs-gravity` (:121). *(One lens said five — it missed `basin-cap-vs-radius`.)*

**There is no law for g itself as a function of R.** The registry pins everything gravity *drives* and nothing that drives gravity. Close it in this workstream — and land it **before** the code change, so the registry is the falsification instrument rather than a rubber stamp. Verified: the drafted `measure` against current code returns exponent **1.000** against a claimed **1.700** — a genuine red-then-green.

```js
  {
    id: 'gravity-vs-radius-selfcompression',
    claim: 'surface gravity on the drawn-radius axis scales as R^1.70 — the rocky mass-radius '
         + 'relation M ∝ R^3.7 (self-compression at fixed composition) divided by the R^2 in '
         + 'g = M/R², replacing the constant-density M ∝ R^3 form that gave R^1.0',
    source: 'body-condition-vector.js:37 (REPO ROOT, not src/worldengine/base/) — '
          + 'surfaceGravity = g_c * (R/R_c)^G_R_EXP, G_R_EXP = 3.7 - 2 = 1.70; '
          + 'Zeng, Sasselov & Jacobsen 2016, ApJ 819:127 (arXiv:1512.08827), '
          + 'R/R⊕ = (1.07 - 0.21·CMF)·(M/M⊕)^(1/3.7), applicable 1–8 M⊕ and CMF 0.0–0.4. '
          + 'The CMF prefactor cancels in the normalized-at-canonical ratio form, so the '
          + 'exponent is composition-blind. NO measured super-Earth gravity exists; this is '
          + 'a DERIVATION from interior-structure models, not a calibration.',
    driver: 'radiusEarth',
    // Swept strictly INSIDE the cited validity band (R ∈ [1.000, 1.754] at CMF = 1/3), same
    // discipline as relief-envelope-vs-gravity sweeping inside its clamp. A sweep on the house
    // radius values [0.5 … 4.0] would cross the R = 1 breakpoint and measure the BLEND, not the
    // law: measured 1.507 ± 0.070, which FAILS a claim of 1.70 (|Δ| = 0.193 > 2·SE = 0.141).
    values: [1.05, 1.15, 1.25, 1.35, 1.45, 1.55, 1.70],
    claimedExponent: G_R_EXP,
    // NOT 0. "g ignores radius" is not a state this code can reach — g = M/R² is radius-driven
    // under any mass law — so a null of 0 guards nothing and a resolution-poor sweep would return
    // a false PASS. The alternative this law must be separable FROM is the law it replaces.
    // Same construction as crater-count-independent-of-gravity, whose null is the removed g^0.34
    // coupling rather than 0.
    nullValue: 1.0,
    nullMeaning: 'the retired constant-density law g = g_c·(R/R_c)^1 (M ∝ R^3, density held fixed)',
    measure: (c, deps) => deps.deriveConditionVector(
      { radiusEarth: 1.0, massEarth: 1.0, composition: { ironFraction: 0.32, density: 5.5 } },
      null,
      c.radiusEarth,
    ).surfaceGravity,
  },
```

Requires: (a) `defaultDeps()` (`laws.js:135-137`, currently `{ craterSchedule, reliefEnvelope, isImpactSurface }`) gains `deriveConditionVector` imported from `'../../../body-condition-vector.js'` — root imports are precedented at `laws.js:34`; (b) `tests/instrument-laws.test.js:27-32` gains `expect(deps.deriveConditionVector).toBe(deriveConditionVector)`; (c) a positive control mirroring `:94-106` — inject a `^1.0` `deriveConditionVector`, assert `audit.summary.fail` `toEqual(['gravity-vs-radius-selfcompression'])`. Adding the entry is regression-safe: the id assertions use `toContain`, and the exact-fail-list assertions stay green because no planted defect touches `deriveConditionVector`.

**If the implementation is piecewise or composition-gated, register two laws**, not one with a hidden breakpoint.

### 7.4 Rules 14 / 15 and doc-rot

- **Rule 14 — not triggered** by an in-place edit to `body-condition-vector.js` (repo root, not `src/`). `doc-rot`'s unclaimed-src scan is `find src -name '*.js'` (`scripts/doc-rot-check.sh:178`), so the root file is structurally invisible. Baseline: `npm run doc-rot` → **163 flagged** at commit `169e8e1` (134 `[unclaimed-src]`, 28 `[stale-deep-dive]`, 1 `[orphan-systems-touched]`, 1 `[broken-link]`). Any **new** `src/` file → 164 unless added as a bare path to `docs/SYSTEMS/worldengine/README.md` `Module(s)`. Adding a law to the existing `laws.js` adds nothing (already registered at `docs/SYSTEMS/worldengine/README.md:56`).
- **Pre-existing gap, not this workstream's job:** `grep -rn "body-condition-vector" docs/SYSTEMS/` returns **nothing**. One of the most-imported modules in the engine is registered in no SYSTEMS README.
- **Rule 15 (AC-0) — triggered.** Verifying requires touching `src/worldengine/**`: the law tests pin `baseStep.js`'s `bodySurfaceGravity`, the registry entry lands in `instrument/laws.js`, and option 6.1(B) imports `compositionClass` from `e1Regime.js`. AC-0 breakdown: **check 1 (driver connectivity)** — `radiusEarth` is already D-slot-backed; `g_c` comes from `deriveBodyScalars` (`baseStep.js:20`); the exponent `1.70` is the one new scalar and is a *literature constant*, which is why it needs the registry entry plus an explicit archetype-constant declaration naming its future owner. **Check 2 (named consumer)** — no new emitted field; but the AC must state honestly that `e1Regime.js:90-92` and `giant-drivers.js:176` reconstruct `M = g·R²`, so the mass law they see silently becomes `M_c·(R/R_c)^3.7`. **Check 3 (taxonomy)** — N/A unless the exponent becomes a GUI knob or a composition gate becomes a selectable regime; declare it so.

### 7.5 Prose that will go stale (doc-rot cannot catch — untracked references)

All of these cite `g = g_c·(R/R_c)` by name and become wrong:

- `body-condition-vector.js:32-36` — **the justifying comment; most damaging, it becomes an in-source assertion of the wrong law**
- `planet-lod-lab-core.js:1088-1099` — doubly wrong (the exponent, and the `uPerturb` wiring gap)
- `world-engine-lab.html:2863`, `:3602`
- `tests/radius-live-feed.test.js:826`
- `docs/WORKSTREAMS/world-engine-radius-live-feed-2026-07-25/BUILD-NOTES.md:666`
- `docs/WORKSTREAMS/world-engine-inc3b-relief-budget-2026-07-21/BUILD-PLAN.md:144`

---

## 8. Still UNVERIFIED

| # | open question | what would settle it |
|---|---|---|
| 1 | **Whether the `uPerturb` wiring gap (§3.1) is a known/accepted state or a live defect.** `planet-lod-lab-core.js:1090-1093` reads as though it is not intentional, but no workstream note flips it. | Read `docs/WORKSTREAMS/world-engine-inc3-relief-spine-depthlaw-2026-07-21/BUILD-NOTES.md` and `world-engine-radius-live-feed-2026-07-25/intent.md`; or a live lab A/B dragging the radius slider while watching `uniforms.uPerturb.value`. **Then ask Max whether fixing it is in scope.** |
| 2 | **Visual magnitude of the f_I → `compositeMargins` w_e/w_i change.** f_I is measured (−36.1% at R=1.6 on Moon/Mercury) but not the realized-array norms `V_cf`/`V_h` that set absolute weights (`planet-lod-rivers.js:220-226`). | Run `writeBodyRelief` + `compositeMargins` on a real 40k carrier under both exponents and diff composited height RMS. Minutes-scale headless job. |
| 3 | **The correct exponent for the ICY branch** (Titan, Frozen, Europa, Crystal — densities 1.9–3.0, all classified `icy`, all R_c < 1). Zeng is silicate/iron; the ice EOS is a different family. Frozen carries the single largest ungated error (+84.6% at R=1.2). | Zeng & Sasselov 2013 (PASP 125:227, arXiv:1301.0818) tabulated pure-H₂O curves — **note: retrieved, and it contains NO fitting formula, only a numeric grid**, so someone must fit a local slope. Or Fortney/Marley/Barnes 2007. |
| 4 | **The correct exponent for the sub-Neptune / envelope branch** (Neptunian, Sub-Neptune). Gating them out is not the same as being right about them — `^1.0` has no more support there than `^1.70`. | Lopez & Fortney / Wolfgang & Lopez envelope-fraction M–R relations, or an explicit decision that this branch is out of scope with the debt declared. |
| 5 | **Whether any consumer classified inert becomes live on a path not exercised.** Specifically: whether `relief-slice.js` (which imports `relief-e6-tectonic.js` despite `planet-lod-tectonic.js:15` saying not to) is on a production route, and whether `stagnantLid`'s `K_G` opt-in is ever enabled. | Trace `relief-slice.js` callers; grep for a non-zero `K_G` assignment. |
| 6 | **Seager+2007's EOS-specific scale constants `m₁`/`r₁` for MgSiO₃.** One lens calibrated `m₁ = 4.3913 M⊕` by bisection to match Zeng's chord; Seager Table 4 gives `m₁ = 6.41 M⊕` for the near-Earth-CMF differentiated mix. That shifts the "n = 1.70 crossover" from 3.04 M⊕ to 4.43 M⊕. | Read Seager+2007 (ApJ 669:1279, arXiv:0707.2895) Tables 3–4 directly. Qualitative shape (n rising monotonically 1.0 → >2) is unaffected either way. |
| 7 | **Full-suite baseline in the repo's own config.** My matched control/mutation ran under a scratchpad vitest config (139 files, 2201 tests, 0 control failures). The stated repo baseline is 4 test failures (GalacticFeatures ×1, KnownObjects ×3) + 17 vendor file-level. The **delta** (+3) is measured and reliable; the absolute baseline is not re-confirmed here. | `npx vitest run` in the repo config before and after on a scratch branch. |

---

## 9. Corrections to the record

An adversarial verifier attacked every lens finding. Where it won, I took the verifier; where I could settle the dispute by execution, I did and say so.

### 9.1 Path and citation drift — fix these before they propagate

| wrong | right |
|---|---|
| `src/worldengine/base/body-condition-vector.js:37` (in `research/superearth-relief-law-2026-07-28.md:64`, and repeated by three lenses) | **`/home/ax/projects/well-dipper/body-condition-vector.js:37`** — repo root. `ls src/worldengine/base/` has 29 files, none of them this. Line number is correct. |
| `world-engine-lab.html:3005` (`u = deriveUniforms(...)`) | **`:2999`**. `:3005` is a comment. |
| `world-engine-lab.html:2830` (bodyDrivers `condition:` attachment) | **`:2826`**. `:2830` is a comment. |
| `world-engine-lab.html:2854` / `:2940` (`drawGiantConditions` call sites) | **`:2853`** / **`:2939`**. |
| `world-engine-lab.html:5907` (`uPerturb` write) | **`:5908`**. |
| `tests/radius-live-feed.test.js:836` / `:826-835` (the span assertion) | **`:834`**. `:836` is `});`. |
| `e1Regime.js:70` (`compositionClass` h2-he terminal) | **`:67`**. |
| `e1Regime.js:107` (`inSeededBand`) | **`:115-118`**. `:107` is the `centerCount` comment. |
| `e1Regime.js:91` (`massEarthOf`) | spans **`:90-92`**, return on `:92`. |
| `tests/radius-slider-map.test.js:22,26` (slider min/max) | **`:19`, `:23`**. Source of truth is `planet-lod-lab-core.js:91-92`. |
| `tests/fixtures/v2-0-carrier-golden.mjs` line 59 (`fp = DRIVER_PRESETS[name]`) | **`:60`**. |

### 9.2 Substantive corrections — verifier taken

**(a) "~97% of the reachable domain is extrapolation" — WRONG NUMBER.** No metric yields 97%. Measured: **4.79% valid linear-in-radius** over [0.27, 16] ⇒ 95.2% extrapolation; **13.77% valid in slider travel** ⇒ 86.2% extrapolation. Slider travel is the design-native metric (`radiusFromT(t) = MIN·(MAX/MIN)^t`, `planet-lod-lab-core.js:94`). *Verifier taken — I recomputed and got the same.*

**(b) Reachable floor is 0.27 R⊕, not 0.30.** `driver-presets.js:254 'Moon/Mercury (impact-airless)': [0.27, 0.38]` in `LAB_UNLOCKED_RANGES`, reached via `{ labUnlock: true }` at the lab draw site. Documented in-repo at `world-engine-lab.html:5268-5271` ("27.1% of seeds land below 0.3"). *Verifier taken.*

**(c) "The change adds exactly 2 test failures" — WRONG COUNT. It adds 3.** I settled this by running the mutation myself: `Tests 3 failed | 2198 passed (2201)`. The missed one is `tests/worldengine-v2-6-gcohere.test.js:96`, the `massEarthOf` round-trip — the physically load-bearing assertion, since it encodes the mass law `M ∝ R³ → R^3.7`. *Byte-identity verifier taken over consumers lens, and independently confirmed by execution.*

**(d) "The change adds 3 failing FILES including `tests/worldengine-inc3b-composite-budget.test.js`" — WRONG.** My matched control/mutation run shows that file **passes** under `^1.70`. Only 2 files move. *I take my own execution over the fences verifier here; its control and mutation runs may have differed in shim construction.*

**(e) `Math.pow(1.0, y) === 1.0` is engine behaviour, NOT spec-mandated for general y.** ECMA-262 §6.1.6.1.3 mandates an exact `1𝔽` for base 1 only when the exponent is `±0𝔽`; every other finite exponent falls to "implementation-approximated." §21.3.2 explicitly allows latitude. The property holds universally in practice (C99 `pow(+1,y)=1`, and 1.0 is exactly representable), and I verified it in V8/node — but **do not write "spec-mandated" in a comment.** *Verifier taken; its reasoning cited the retrieved spec text.*

**(f) "The e1Regime seeded-band gate crosses, so real seeded draws will flip regime routing" — the arithmetic holds, the routing consequence does NOT.** The in-band radius windows do narrow 17.6–19.5% (Rocky `[0.8736,1.2114]→[0.8962,1.1682]`; Eyeball `[0.8434,1.1696]→[0.8710,1.1354]`; Ocean `[0.8501,1.1788]→[0.8926,1.1635]`), flipping band membership for ~5.8–12.4% of draws. But the writer route never changes: Eyeball is `locked` so rule (3b) short-circuits before the band gate; Rocky/Ocean reach `plate()` both in-band (via seed-free `modalRegime`) and out-of-band (L ≈ 0.24 / 0.13, both below `MOBILE_L` 0.35), and `plate()` passes no `e1` to the writer. What changes is the emitted `e1.geodynamicRegime` label — shadow/diagnostic on these routes. *Verifier taken; it ran the real dispatch chain over 2000 matched samples per preset.*

**(g) "The lidStrength gMod ceiling moves inside Rocky's draw range" — FALSE for Rocky.** New Rocky ceiling is R = 1.5596, **above** the top of `terrestrial [0.8, 1.5]`; at R = 1.5 raw gMod = 1.10893, still 0.011 below `GMOD_HI` = 1.12. All three presets cited as evidence are non-examples (Eyeball ceiling 1.4659 > range top 1.3; Moon/Mercury is NAMED_BODY where R ≡ R_c makes the change a mathematical no-op). The one preset where the high clamp newly binds is **Ocean** `['ocean' 0.8–1.8]`, crossing 2.1577 → 1.6350 — top ~16.5% of its range newly saturates. And the effect is not one-directional: Frozen `['ice' 0.4–1.2]` goes LO → free at the top; Carbon `['carbon' 0.4–0.9]` newly LOW-clamps at the bottom. *Verifier taken; it swept all 18 presets over their real draw ranges.*

**(h) "There are THREE distinct surface gravities live simultaneously" — at most TWO.** The three *channels* are real (`state.surfaceGravity` → uPerturb; flat `massGravity` D-slot → plates/magmatism/stagnantLid/shellRelief; nested `condition.surfaceGravity` → e1Regime/bombardment), but `useOv('gravity')` gates the latter two together, so: slider untouched ⇒ `{g_c, g_c·(R/R_c)}`; slider dragged ⇒ `{g_c, g_ov}`. On the six canonical-locked NAMED_BODY presets there is exactly **one**. Also: `DRIVER_PRESETS` is not `Object.freeze`d — say "unmutated", not "frozen". *Verifier taken.*

**(i) "For all five h2-he presets, line-37 gravity reaches no visible render channel" — conclusion holds, mechanism partly wrong.** `deriveSurfaceMaterial` does **not** self-gate (`surfaceMaterial.js:125-131` computes `iceness` unconditionally; iceness = 0.250 on Jovian/Saturnian/Neptunian and *is* a live render channel via `world-engine-lab.html:3796` → `uIcenessMix`). It carries no gravity only because `icenessOf` reads density/volatileFraction/T_eq. And there are **two** live consumers of line-37 gravity on the giant path, not one: `computeE1` (runs at `planet-lod-rivers.js:508`, before the `:569` gas terminal; L/Φ move with g but the outputs are render-inert) plus `deriveFigureDescriptor`. *Verifier taken.*

**(j) "constant to 3 decimals over R = 1.0–2.0" (`research/superearth-relief-law-2026-07-28.md:58`) — the hedge is not wrong, but the window is.** Within Zeng's pure power law the exponent is exactly 1.7 at all R and all CMF; the hedge is merely weak. The real defect on that line is that **R = 2.0 implies M = 12.9 M⊕, above Zeng's own stated 8 M⊕ ceiling** — the window over-extrapolates the fit it cites. A second defect: the brief omits Zeng's CMF bound (0.0–0.4). *Verifier taken; one lens's "wrong in both directions" framing was itself overstated, because it asserted an unretrieved claim about local slope variation inside the fit.*

**(k) Valencia 2006 sub-Earth exponent is ~1.30, not 1.3333.** The 1.3333 comes from the abstract's rounded `~0.3`. Table 2's five fitted β are 0.3058, 0.2991, 0.3000, 0.3032, 0.3094 → n = 1.2701, 1.3434, 1.3333, 1.2982, 1.2321 (mean 1.295). The Mercury-realistic baseline (T_surf = 440 K, CMF = 65%) gives **1.2701**. Since `d(n)/dβ = −11.1` at β = 0.3, no more than two significant figures are defensible. Also: Table 1's Super-Earth β floor is 0.263 (below the abstract's stated 0.267), so the Super-Earth band is n ∈ [1.677, 1.802], not [1.677, 1.745]. *Verifier taken; it opened the PDF.*

**(l) The law registry holds SIX entries, not five.** One lens missed `basin-cap-vs-radius` (`laws.js:111`). *Corrected by my own grep.*

**(m) "83 byte-identity rows" — it is 75 rows asserted by 83 test cases.** `tests/v2-0-byte-identity.test.js:64 expect(count).toBe(75);` *Two lenses caught this independently.*

**(n) `tests/worldengine-v2-6-craters.test.js:70` is NOT a second blocker.** It is a test-input helper (`const schedFor = (R) => craterSchedule(cond({ g: g_c * (R / R_c), R }));`) in a file that never imports `deriveConditionVector`. It will not fail. It is a *latent measurement defect*, which is worse in a quiet way. Likewise `craterboot-radius-sweep.mjs:159` is a documentation string emitted into a markdown report, not a check — only the two `population-sweep.mjs` files genuinely assert the law.

### 9.3 One lens claim I did NOT take the verifier on

The consumers lens claimed the change adds 2 failures; the byte-identity verifier said 3; the fences verifier said 3 files including `inc3b-composite-budget`. **I ran the experiment myself and the answer is 3 failures in 2 files** (`gcohere:66`, `gcohere:96`, `radius-live-feed:834`); `inc3b-composite-budget` passes. Execution beats all three. Command and output are in §5.