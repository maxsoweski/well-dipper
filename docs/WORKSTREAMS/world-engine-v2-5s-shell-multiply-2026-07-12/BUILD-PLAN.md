# V2-5s (shell-MULTIPLY) — BUILD-PLAN
2026-07-13 · repo `~/projects/well-dipper` @ `feature/world-engine-production-L1` · status `building`

The fourth instance of the shipped MULTIPLY template (#2 plates, #4-M magmatism, V2-2b-1 stagnant).
A pure `shellDriversToTune(drivers, regime)` builder + frozen per-regime `SHELL_REFS`, threaded at the
two shell dispatch call sites, so within-regime icy driver differences (low-g vs high-g, tidal, vigor,
warmth) reshape the shipped stress relief while the three shipped icy presets stay byte-identical.

**Traceability to the driving outcome (feature→outcome):** closes the D2-MF5 north-star gap for the icy
sibling (JOURNEY world-engine objective — distinct history-coherent worlds per minute). Lab-only per the
planet-lod charter; seeded icy archetype worlds inherit the response for free at V2-10.

Every number below is produced by a runnable calibration script under `calibration/` (run FROM REPO ROOT).
Nothing is estimated.

---

## 0. Baseline the build must not move (measured 2026-07-13)

- **Guardrail quartet + shell suites GREEN now:** `npx vitest run tests/v2-0-byte-identity.test.js
  tests/worldengine-lid-byte-anchors.test.js tests/worldengine-e1-shadow-audit.test.js
  tests/planet-archetypes.test.js tests/worldengine-base-shell-structure.test.js
  tests/worldengine-shell-regime-gate.test.js` → **6 files / 199 tests passed**.
- **Byte-identity:** `tests/v2-0-byte-identity.test.js` = **83/83** (70 strict golden + Frozen-5
  assert-equal-despun + meta/anchor). NEVER re-capture `v2-0-carrier-goldens.json`.
- **Full-suite baseline (must NOT grow):** `Tests 4 failed` (KnownObjects ×3 + GalacticFeatures ×1) +
  `Test Files 17 failed` (those 2 + 15 vendor/motion-test-kit collection failures). Our new test file must
  ADD only passing tests and collect nonzero (MF#3).

---

## 1. Calibration results (all from `calibration/*.mjs`)

### 1a. REF slots — byte-exact (`calibration/ref-slots.mjs`)

Every slot the builder reads, constructed from the LIVE bundle
`{...buildNeutralBodyDrivers(deriveUniforms(fp),fp), condition: deriveConditionVector(fp,u,fp.radiusEarth)}`,
and the derivation EXPRESSION each frozen literal will encode. `Object.is(live, expr)` = **true** for
every slot; `live === deriveUniforms.surfaceGravity/tidalHeat` = **true**.

| regime | preset | massGravity (flat) | volatileFraction (flat) | tidalHeating (flat) | condition.T_eq (nested) |
|---|---|---|---|---|---|
| `icy-active` | Europa | `0.07/(0.5*0.5)` = **0.28** | **0.5** | expr = **136.74504375182553** | **110** |
| `volatile-cold` | Titan | `0.025/(0.4*0.4)` = **0.15624999999999997** | **0.4** | expr = **1.582697265646129e-8** | **94** |
| `eyeball-despun` | Eyeball | `1/(1*1)` = **1** | **0.25** | expr = **0.0006019832811570482** | **270** |

`tidalHeating` derivation (the plates `EARTH_TIDAL_HEATING` pattern, planet-lod-lab-core.js:526-528):
`tid(ecc,star,R,orbit) = (ecc²·star²·R⁵ / orbit⁵) / IO_TIDAL_REF`, with
`IO_TIDAL_REF = (0.0041*0.0041)*(317.8*317.8)*Math.pow(0.286,5)/Math.pow(66,5)` (= 2.594095660059083e-12).
Preset orbital constants: Europa `(0.1, 332946, 0.5, 2500)`, Titan `(0.03, 332946, 0.4, 120000)`,
Eyeball `(0.01, 332946, 1, 23455)`. **No hand-typed long decimals; no cross-import from driver-presets.js.**

**Seed-stability rule verified:** `condition.radiusEarth` = 0.5 / 0.4 / 1 (the DRAWN radius) — the builder
must NEVER read it (grep-denied in AC-0). `thermalState` is `undefined` on every live bundle — the shell
builder never reads it (unlike magma), so it is irrelevant.

### 1b. Locked gains / clamps (`calibration/gain-probes.mjs`, confirmed across 5 seeds)

```
A1 gravity   gFactor = clamp(0.4, 2.5, (massGravity / REF.massGravity) ** -0.5)   // house convention
             RIDGE_AMP  = 1.4  * gFactor ;  CHAOS_AMP = 0.12 * gFactor ;  CHAOS_BASE = -0.04 * gFactor
A2 tidal     tidalDev = clamp(-1, 1, log10(max(tidalHeating,1e-30) / REF.tidalHeating) / SPAN_DECADES)
             SPAN_DECADES = 6
             CREST_THRESH   = clamp(0.82,  0.985, 0.94 - 0.09 * tidalDev)
             TENSILE_THRESH = clamp(0.01,  0.12,  0.05 - 0.03 * tidalDev)
A3 vigor     vigor = (T_eq - REF.T_eq)/120 + (volatileFraction - REF.volatileFraction)
             CELL_MIN = clamp(4, 22, round(9 + 7 * vigor))
A4 warmth    warmDev = (T_eq - REF.T_eq)/120
             CHAOS_THRESH = clamp(0.30, 0.80, 0.6 - 0.28 * warmDev)
```

Named calibration constants for the builder: `SPAN_DECADES=6`, `K_CREST=0.09` `CREST_LO=0.82`
`CREST_HI=0.985`, `K_TENSILE=0.03` `TENSILE_LO=0.01` `TENSILE_HI=0.12`, `K_CELL=7` `T_VIGOR_SPAN=120`
`CELL_LO=4` `CELL_HI=22`, `K_CHAOSTHRESH=0.28` `T_WARM_SPAN=120` `CHAOS_LO=0.30` `CHAOS_HI=0.80`. These are
first-cut, **UAT-tunable** (the ACs assert sign + measurability, not magnitudes — the V2-2b-1 discipline).

**Clamp reachability (lens minor #f, verified in `gain-probes.mjs`):** across the tidal axis `tidalDev ∈ [−1,1]`,
`CREST_THRESH = 0.94 − 0.09·tidalDev ∈ [0.85, 0.985]`. So **`CREST_LO=0.82` is a DEAD defensive bound** (never
reached via tidal — the min is 0.85 at `tidalDev=+1`); **`CREST_HI=0.985` IS reached at `tidalDev=−1`** (the tidal-
DOWN extreme, e.g. Europa driven below its REF). Kept as a guard for forward axes / future gains, not a live clamp
on the shipped tidal transfer. `TENSILE_THRESH` similarly floors near `TENSILE_LO`. A2 monotonicity note: because
`CREST_THRESH` saturates on the `CREST_LO` plateau past `tidalDev=+1`, adjacent sweep points there return EQUAL
`lineamentNodeCount` — the A2 monotonicity gate is therefore **non-strict** (see §5, MF#1).

**Margin honesty (lens minor #g):** A3 `cellCount` endpoint Δ is **8 vs floor 7** on both icy (T_eq 110→250) and
Titan (T_eq 94→230) — a thin margin. `K_CELL=7` is **UAT-tunable up** if the built test proves marginal at any
seed; the per-seed check (`gain-probes.mjs`, §MF2) currently shows Δ=8>7 on all five seeds {1,2,3,7,42}.

**Exact collapse verified** (`gain-probes.mjs`): `shellDriversToTune(SHELL_REFS[r], r) === null` and
`shellDriversToTune(liveREF, r) === null` for all three regimes; `shellDriversToTune(null,·)===null`,
`shellDriversToTune({},·)===null`. All 7 knobs === their DEFAULT at REF because `pow(1,-0.5)===1`,
`log10(1)===0`, and both deviation numerators are exactly 0 → IEEE-exact identity → null.

**Blast-radius verified** (`gain-probes.mjs`, strongest tune): `carrier.grainAngle` + `carrier.faultDensity`
**byte-identical** under drive (they are STEP-1 `thetaTraj`/`|stressTensile|`, which no allowed knob touches);
`carrier.height` changed. Two of the five hashed golden fields are provably drive-invariant.

### 1c. Noise floors — 5-seed spread {1,2,3,7,42} at REF drivers (`gain-probes.mjs`)

| regime | linN floor | std(U) floor | chaosFrac floor | cellCount floor |
|---|---|---|---|---|
| `icy-active` | 23 | 0.0467 | 0.0350 | 7 |
| `volatile-cold` | 39 | 0.0205 | 0.0933 | 7 |
| `eyeball-despun` | 14 | 0.0158 | 0 (CHAOS_W=0 → no chaos) | 0 (CHAOS_W=0 → no cells) |

`eyeball-despun` structurally has no convection cells / no chaos — A3/A4 are correctly inert there.

### 1d. AC-ORDER falsifier under tune (`calibration/order-probe.mjs`)

Across every sweep point × 5 seeds, using the **arm's-length** predictor (rebuilt from PUBLISHED
`thetaTraj` + `stressTensile` with the applied-tune `CREST_THRESH`; never reads U/lineamentNode):
- `varExplainedByStress > max(varExplainedByLatitudeY, varExplainedByLatitudeW0)` at every point —
  **worst margin +0.587**, no failures.
- `lineamentInteriorRatio > 1` — **min 1.398** across all points/seeds.

Note (drives the AC-ORDER predictor choice): the writer's own `reliefStress` diag (what the LAB shellProbe
uses) is PRE-relax, so `corr(U, reliefStress)²≈0.37` and dips **below latitude** at the volatile-cold
hi-tidal extreme (worst margin −0.058). The arm's-length predictor applies the same 4 relax passes → tracks
U and dominates latitude robustly. **Headless AC-ORDER uses the arm's-length predictor** (structure-suite
discipline, CREST parameterized by the tune); the lab's reliefStress-based `varExplainedByStress` is
diagnostic-only and is NOT a gate in AC-LAB.

### 1e. Final measurability designs (`calibration/variety-probe.mjs`)

Learnings that shaped the AC tests:
- **A1 is multiplicative** — `std(U)` scales with `gFactor`. Its absolute Δ-vs-floor is marginal at the
  lowest-relief seed (0.051 vs 0.047), but the **ratio** `std(U)@min-g / std(U)@max-g ≈ 6.2×` is
  **seed-independent** (6.12–6.27). → **A1 asserts the RATIO (>3), not an absolute floor.**
- **A3 must be driven IN-DOMAIN (lens MF#2)** — `volatileFraction` is physically bounded ≤1.0 (lab slider max
  0.6). An in-domain vf sweep (0.1→1.0) moves `cellCount` by only Δ=7 = the floor **exactly** (every seed) — it
  does NOT clear `> floor`. The earlier probe cleared only by reaching out-of-domain **vf=1.4**. → **A3-icy is
  driven by `T_eq` instead** (lab `tsurf` slider [230,760] overlays `condition.T_eq`): `T_eq 110→250` gives
  Δ cellCount **8 > floor 7 on EVERY seed** {1,2,3,7,42} (CELL_MIN 9→17), matching the Titan `T_eq 94→230` A3
  driver. Any `volatileFraction` sweep in the tests is **capped ≤1.0**; vf remains a secondary vigor input inside
  the composite, never the sole A3 endpoint driver.
- **A4 chaos is seed-fragile** — seed 42's stress field never coincides with cell interiors, so chaos
  barely turns on even when warm (Δ 0.007). → **A4 asserts the CHAOS_THRESH knob strictly decreasing
  (every seed) + chaos-area non-decreasing/no-inversion (every seed) + measurable in AGGREGATE**
  (mean warm − mean REF = 0.088 > floor 0.035). Max may strike A4 at UAT (per contract dd#4).
- **AC-VARIETY reconciled to the contract's PER-OBSERVABLE wording (lens minor #e).** The contract says two
  worlds "differ by more than a per-observable noise floor"; `variety-probe.mjs` originally only reported a
  composite floor-normalized distance. Extended + re-run, the LOW↔HIGH corner pair (floor = each observable's
  5-seed spread at REF) clears per-observable, **every seed**, as follows:
  - **icy-active:** `linFrac` normΔ **2.83**, `stdU` **2.10**, `cellCount` **2.57** CLEAR; **`chaosFrac` normΔ
    0.19 does NOT clear** at this corner pair (seed-fragile chaos) → **not-claimed** here (A4's own aggregate+knob
    criterion covers chaos, not AC-VARIETY).
  - **volatile-cold:** `stdU` normΔ **4.65**, `chaosFrac` **1.14**, `cellCount` **2.43** CLEAR; **`linFrac` normΔ
    0.36 does NOT clear** (both corners sit in the tidal-saturated CREST band → sub-floor separation) →
    **not-claimed** here.
  → **AC-VARIETY's PASS criterion = per-observable Δ > that observable's own 5-seed floor for the CLEARING
  observables above (every seed), PLUS the seed-only baseline within floor** (= 1.000 by construction — the floor
  IS the 5-seed max-min spread, so no reroll pair exceeds it). The **composite distance stays a REPORTED summary**
  (min driver-dist **4.94** icy / **5.49** volatile-cold vs max seed-only-reroll **1.86 / 1.58** — driver ≫ seed
  at every seed), **not the pass gate**. Plus the headline `low-g/high-g std(U) ratio > 3` per seed.

Per-axis response deltas (`gain-probes.mjs`, seed 7; multi-seed confirmed): A1 stdU Δ0.070>floor0.047;
A2 linN Δ64>23 (icy), Δ82>39 (Titan, **interior** sweep `tidalDev∈(0,0.97)` — no CREST plateau); A3 cellCount
Δ8>7 (icy, `T_eq 110→250`, every seed — MF#2), Δ8>7 (Titan, `T_eq 94→230`); A4 chaosFrac Δ0.090>0.035. All
**non-strict** monotone correct-sign (no downward inversion) inside the clamped domain; `|U| < SHELL_BOUND(4)` at
every point (max 0.52).

---

## 2. The frozen exports (Slice A) — code to ship in `src/worldengine/base/shellRelief.js`

Add AFTER `SHELL_DEFAULTS` (mirrors the VENUS_REF / stagnantDriversToTune block, read-surface-matched):

```js
// ── V2-5s (shell driver-response): per-regime REFs + the driver→tune seam ──────────────────────────────
// The per-body D-vector re-tunes population/threshold/amplitude knobs via the EXISTING
// `tune ? { ...SHELL_DEFAULTS, ...tune } : SHELL_DEFAULTS` seam (:167) — no new writer machinery. Anchored
// PER REGIME so shellDriversToTune(SHELL_REFS[r], r) === null → each shipped icy preset renders BYTE-IDENTICAL
// (the three golden-pinned presets occupy three DISJOINT regimes — one per regime — so per-regime anchoring
// nulls all three exactly; the plates single-REF path is CLOSED because the shell goldens are pinned tune-less).
// PURE: zero alea / Math.random / Date.now. READ-SURFACE-MATCHED (the VENUS_REF discipline): frozen literals
// via derivation EXPRESSIONS (mass/R²; tidal via the plates EARTH_TIDAL_HEATING ioRef formula) — NO hand-typed
// decimals, NO cross-import from driver-presets.js. NEVER reads condition.radiusEarth (drawn radius — seed-varying).
const IO_TIDAL_REF = (0.0041 * 0.0041) * (317.8 * 317.8) * Math.pow(0.286, 5) / Math.pow(66, 5);
const shellTidal = (ecc, star, R, orbit) =>
  (ecc * ecc * star * star * Math.pow(R, 5) / Math.pow(orbit, 5)) / IO_TIDAL_REF;

export const SHELL_REFS = Object.freeze({
  'icy-active':     Object.freeze({ massGravity: 0.07 / (0.5 * 0.5),  volatileFraction: 0.5,  tidalHeating: shellTidal(0.1,  332946, 0.5, 2500),   condition: Object.freeze({ T_eq: 110 }) }),   // Europa
  'volatile-cold':  Object.freeze({ massGravity: 0.025 / (0.4 * 0.4), volatileFraction: 0.4,  tidalHeating: shellTidal(0.03, 332946, 0.4, 120000), condition: Object.freeze({ T_eq: 94 }) }),    // Titan
  'eyeball-despun': Object.freeze({ massGravity: 1 / (1 * 1),         volatileFraction: 0.25, tidalHeating: shellTidal(0.01, 332946, 1,   23455),  condition: Object.freeze({ T_eq: 270 }) }),   // Eyeball
});

// First-cut transfer gains (UAT-tunable; the ACs assert sign + measurability, not magnitudes).
const SPAN_DECADES = 6, K_CREST = 0.09, CREST_LO = 0.82, CREST_HI = 0.985,
      K_TENSILE = 0.03, TENSILE_LO = 0.01, TENSILE_HI = 0.12,
      K_CELL = 7, T_VIGOR_SPAN = 120, CELL_LO = 4, CELL_HI = 22,
      K_CHAOSTHRESH = 0.28, T_WARM_SPAN = 120, CHAOS_LO = 0.30, CHAOS_HI = 0.80;

// Map the body's D-vector → a population/threshold/amplitude `tune` override, anchored per regime so
// shellDriversToTune(SHELL_REFS[regime], regime) === null. `regime` is dispatch-provided derived context
// (the same tuple REGIME_WEIGHTS[regime] consumes) used ONLY to select the REF. Population/amplitude knobs
// ONLY — never DESPIN_REF/DIUR_REF/DIUR_PEAK/SHOULDER_HT/TROUGH_DEPTH/SHELL_BASE/RELAX_PASSES/REGIME_WEIGHTS.
export function shellDriversToTune(drivers, regime) {
  if (drivers == null) return null;                                   // (i) NULL-GUARD FIRST (dispatch bridge + shipped tests reach null)
  const D = SHELL_DEFAULTS;
  const REF = SHELL_REFS[regime] || SHELL_REFS['icy-active'];         // unknown regime → icy-active (writer REGIME_WEIGHTS fallback parity)
  // read surface: flat massGravity/volatileFraction/tidalHeating + NESTED condition.T_eq (optional-chained, never-throw)
  const g   = drivers.massGravity      ?? REF.massGravity;
  const vf  = drivers.volatileFraction ?? REF.volatileFraction;
  const th  = drivers.tidalHeating     ?? REF.tidalHeating;
  const Teq = drivers.condition?.T_eq  ?? REF.condition.T_eq;         // NESTED (never re-drives anything; shell reads no thermalState)

  // A1 gravity → ONE common gFactor onto RIDGE_AMP + CHAOS_AMP + CHAOS_BASE (relief ∝ 1/g). 1 at REF → byte-safe.
  const gFactor = clamp(0.4, 2.5, Math.pow(g / REF.massGravity, -0.5));
  const RIDGE_AMP  = D.RIDGE_AMP  * gFactor;
  const CHAOS_AMP  = D.CHAOS_AMP  * gFactor;
  const CHAOS_BASE = D.CHAOS_BASE * gFactor;
  // A2 tidal → CREST_THRESH (+ TENSILE_THRESH) down as tidal rises (denser cracks). log-ratio: 0 at REF (10-decade span).
  const tidalDev = clamp(-1, 1, Math.log10(Math.max(th, 1e-30) / REF.tidalHeating) / SPAN_DECADES);
  const CREST_THRESH   = clamp(CREST_LO,   CREST_HI,   D.CREST_THRESH   - K_CREST   * tidalDev);
  const TENSILE_THRESH = clamp(TENSILE_LO, TENSILE_HI, D.TENSILE_THRESH - K_TENSILE * tidalDev);
  // A3 thermal vigor (T_eq + vf) → CELL_MIN (finer convection planform). 0 at REF.
  const vigor = (Teq - REF.condition.T_eq) / T_VIGOR_SPAN + (vf - REF.volatileFraction);
  const CELL_MIN = clamp(CELL_LO, CELL_HI, Math.round(D.CELL_MIN + K_CELL * vigor));
  // A4 T_eq → CHAOS_THRESH down on warm shells (more melt-through chaos). 0 at REF.
  const warmDev = (Teq - REF.condition.T_eq) / T_WARM_SPAN;
  const CHAOS_THRESH = clamp(CHAOS_LO, CHAOS_HI, D.CHAOS_THRESH - K_CHAOSTHRESH * warmDev);

  // (ii) EXACT-ONLY IDENTITY GUARD: at REF every knob === its DEFAULT → null → the writer takes the untouched branch.
  if (CELL_MIN === D.CELL_MIN && CREST_THRESH === D.CREST_THRESH && TENSILE_THRESH === D.TENSILE_THRESH &&
      CHAOS_THRESH === D.CHAOS_THRESH && RIDGE_AMP === D.RIDGE_AMP && CHAOS_AMP === D.CHAOS_AMP && CHAOS_BASE === D.CHAOS_BASE) {
    return null;
  }
  return { CELL_MIN, CREST_THRESH, TENSILE_THRESH, CHAOS_THRESH, RIDGE_AMP, CHAOS_AMP, CHAOS_BASE };
}
```

Note: `clamp` is already imported in shellRelief.js (`./mathutil.js`). `SHELL_DEFAULTS` is `Object.freeze`d;
its 7 read keys are all present. `CHAOS_BASE` is negative (−0.04); scaling by `gFactor` deepens chaos lows
proportionally with the whole relief profile (correct — A1 scales the profile wholesale).

**Known non-issues (lens-verified — DO NOT add code to "fix" these; stay idiom-matched to the siblings):**
- **(minor #b) The `SHELL_REFS[regime] || SHELL_REFS['icy-active']` fallback is DEAD CODE for all shipped
  routing.** `e1Regime.js` guarantees `regime ∈ {icy-active, volatile-cold, eyeball-despun}` at both dispatch
  call sites (the shell path only runs on a routed shell regime), so the `||` branch is **currently unreachable**.
  It is a **defensive-only** parity with the writer's `REGIME_WEIGHTS[regime]` fallback; a future routing break
  would be caught by the 83-golden before it reached this line. Keep it (idiom-matched), do not remove.
- **(minor #d) NaN inputs propagate NaN knobs — house-consistent, unreachable.** A `NaN` in a driver slot passes
  the `?? REF` guard (only `null`/`undefined` trigger the coalesce, not `NaN`) and would flow into the knobs.
  This is **unreachable through the real `deriveUniforms → buildNeutralBodyDrivers → deriveConditionVector`
  pipeline** (it never emits NaN) and is **consistent with the sibling builders' house behavior**
  (`driversToTune`/`magmaDriversToTune`/`stagnantDriversToTune` do not `Number.isFinite`-guard either). Documented
  as a known, house-consistent limitation — **do NOT add `Number.isFinite` guards** (would diverge from the family).

---

## 3. Slice decomposition + exact commit boundaries

**Slice A — the builder + REFs + ALL writer/builder-level unit ACs.** ONE commit.
- `src/worldengine/base/shellRelief.js`: add the §2 block (`IO_TIDAL_REF`, `shellTidal`, `SHELL_REFS`,
  gains, `shellDriversToTune`). NOTHING else in the file changes (the writer's null-tune path is untouched).
- `tests/worldengine-base-shell-multiply.test.js` (NEW): AC-0, AC1, AC-TUNE-NULL, AC-BYTE-SHELL,
  AC-TUNE-RESPONSE, AC-VARIETY, AC-ORDER (all runnable on the writer + builder directly, no dispatch).
- Gate: `npx vitest run tests/worldengine-base-shell-multiply.test.js
  tests/worldengine-base-shell-structure.test.js tests/planet-archetypes.test.js` green; the new file
  collects nonzero. Commit `feat(worldengine): V2-5s Slice A — shellDriversToTune + SHELL_REFS + unit ACs`.

> **Deviation from the suggested split, justified:** the prompt suggested AC-BYTE-SHELL in Slice B. It is a
> **writer-level** dual-carrier test (`writeShellReliefSphere` direct — shipped `grainDrivers` call vs new
> `bodyDrivers`+null-tune call), needing NO dispatch — exactly the placement of V2-2b-1's AC-BYTE-VENUS in
> its Slice-A multiply file. Keeping it in Slice A makes Slice A an independently-verifiable builder unit.
> The byte-inertness of the ACTUAL dispatch threading is separately proven end-to-end by AC-ZERO-CLOBBER(a)
> (75-golden) in Slice B — nothing is lost.

**Slice B — dispatch threading + lab + integration ACs.** ONE commit.
- `planet-lod-rivers.js`: import `shellDriversToTune` (:31); thread BOTH call sites (§4).
- `planet-lod-lab.html`: `shellProbe()` returns `appliedTune`; new `fShellDrivers` folder (shell A/B, mirror
  `fStagnantDrivers`); update the stale `:2682` + `:3831-3833` comments (the gravity/tidal/volatiles/tsurf
  sliders now also drive the shell path on icy presets).
- `tests/worldengine-base-shell-multiply.test.js`: append the AC-ZERO-CLOBBER dispatch-level assertions
  (or a small `worldengine-shell-multiply-dispatch` describe) — but the heavy lifting of AC-ZERO-CLOBBER is
  the EXISTING gates (75-golden, dispatch-oracle, quartet) staying green, run in the gate below.
- Gate: `npx vitest run tests/v2-0-byte-identity.test.js tests/worldengine-v2-3-dispatch-oracle.test.js
  tests/worldengine-shell-regime-gate.test.js tests/worldengine-base-shell-structure.test.js
  tests/worldengine-base-stagnantlid-structure.test.js` + the quartet, all green; then the FULL suite at
  baseline (4 failed / 17 files failed, unchanged). Commit
  `feat(worldengine): V2-5s Slice B — thread shell tune at both dispatch sites + lab + AC-ZERO-CLOBBER`.
- AC-LAB (live, agent-driven) + AC-UAT (Max) run AFTER Slice B on the running lab (§8), no commit.

---

## 4. The two dispatch edits (Slice B) — riskiest seam first

**Import (planet-lod-rivers.js:31):**
```js
import { writeShellReliefSphere, shellRegimeOf, shellDriversToTune } from './src/worldengine/base/shellRelief.js';
```

**Call site 1 — the V2-3 derived `shell()` helper (planet-lod-rivers.js:490-493):**
```js
    const shell = (regime) => {
      const shellTune = shellDriversToTune(bodyDrivers, regime);
      const shellDiag = writeShellReliefSphere(carrier, bodyDrivers, { macroSeed, regime, tune: shellTune });
      shellDiag.appliedTune = shellTune;
      return { path: 'shell', plateDiag: null, shellDiag, magmaDiag: null, stagnantDiag: null };
    };
```
> ⚠ **RISKIEST LINE IN THE WHOLE INCREMENT.** This lands INSIDE the `if (bodyDrivers?.condition)` block that
> `tests/worldengine-v2-3-dispatch-oracle.test.js` (AC-0 check 1, :263-275) slices and asserts contains **no**
> `PRESET_ARCHETYPE`, no `.label`, no `stagnantLidRegimeOf(`, no `isVolcanicPath(`, no `isEarthlikePlatePath(`,
> **no `shellRegimeOf(`**, and **no `archetype` identifier at all**. `shellDriversToTune` matches NONE of those
> regexes (verified) and `regime` is already the helper's parameter — safe. Do NOT reintroduce `shellRegimeOf`
> or the word `archetype` here.

**Call site 2 — the migration bridge (planet-lod-rivers.js:569-573):**
```js
  const regime = shellRegimeOf(archetype, locked);
  if (regime) {
    const shellTune = shellDriversToTune(bodyDrivers, regime);
    const shellDiag = writeShellReliefSphere(carrier, bodyDrivers, { macroSeed, regime, tune: shellTune });
    shellDiag.appliedTune = shellTune;
    return { path: 'shell', plateDiag: null, shellDiag, magmaDiag: null, stagnantDiag: null };
  }
```
Here `bodyDrivers` is `null` for the ~8 legacy condition-less callers → `shellDriversToTune(null,·)===null` →
writer voids `drivers` → byte-identical.
> **Migration-bridge assumption (lens minor #a):** this byte-safety rests on `bodyDrivers === null` at every
> legacy bridge caller (they are condition-less). A hypothetical **non-null bodyDrivers WITHOUT a `condition`**
> reaching this bridge would still yield a **non-null** tune (g/vf/th slots read from the drivers about the REF,
> `T_eq` falling back to REF) — a behavior change vs today's tune-less bridge. **No current caller does this**
> (verified: the bridge's non-null-drivers path only fires on the condition-bearing V2-3 route at call site 1,
> not here). Acknowledged, not guarded — if a future caller feeds partial drivers here, AC-BYTE-SHELL / the
> 83-golden would surface the shift.

**Why the `grainDrivers → bodyDrivers` swap is byte-safe (both sites):** the writer's first line is
`void drivers;` (shellRelief.js:166) — the drivers arg is read by NOTHING. Swapping `grainDrivers`
(`DEFAULT_GRAIN_DRIVERS`) for `bodyDrivers` (or `null`) changes nothing in the output. The ONLY behavioral
change is `tune`, which is `null` at every shipped preset's REF and at `null` drivers. Mirrors #4-M
(magma) / V2-2b-1 (stagnant) verbatim.

---

## 5. Per-AC → per-test-file mapping (+ MF#3 counting rule)

New file `tests/worldengine-base-shell-multiply.test.js` (template:
`tests/worldengine-base-stagnantlid-multiply.test.js`). Mesh `TARGET_N=600, LLOYD=2`, `SEEDS=[1,2,3,7,42]`,
regimes `['icy-active','volatile-cold','eyeball-despun']`. Builds the LIVE bundles for Europa/Titan/Eyeball
via `{...buildNeutralBodyDrivers(deriveUniforms(fp),fp), condition: deriveConditionVector(fp,u,fp.radiusEarth)}`.

| AC | where | what it asserts |
|---|---|---|
| **AC-0** | new file (`funcBody`-scoped grep on `shellDriversToTune`) + `tests/planet-archetypes.test.js` | body reads ONLY `massGravity`/`volatileFraction`/`tidalHeating`/`condition?.T_eq`; **denylist**: no archetype string, no `e1.label`, no `shellRegimeOf(`, **no `condition.radiusEarth`**; the 4 knob→observable named consumers; drift guards green |
| **AC1** | new file | `String(shellDriversToTune)` has no `Math.random`/`Date.now`; SHELL_SRC no `alea('lid:`; double-build byte-equal (null + non-null tune); `\|U\| < SHELL_BOUND` across sweep; named non-issue: `shell:cells:` draw count moves with CELL_MIN (deterministic per seed) |
| **AC-TUNE-NULL** | new file | (a0) `null`/`{}`→null ×3 regimes; (a) `SHELL_REFS[r]`→null; (b) LIVE Europa/Titan/Eyeball bundle→null; (c) every REF slot `===` its live-derived slot (incl. `SHELL_REFS[r].massGravity === deriveUniforms.surfaceGravity`, tidal `===` u.tidalHeat, `Object.isFrozen`); (d) perturbed → non-null ⊆ 7 keys |
| **AC-BYTE-SHELL** | new file (Slice A) | 3 presets × 5 seeds: `writeShellReliefSphere(c, grainDrivers, {macroSeed,regime})` (shipped) === `writeShellReliefSphere(c, liveBundle, {macroSeed,regime,tune:shellDriversToTune(SHELL_REFS[r],r)/*null*/})` on height + every shell diag array + cellCount + lineamentNodeCount |
| **AC-TUNE-RESPONSE** | new file | A1: `std(U)` monotone ↑ as g↓ every seed + ratio(min-g/max-g) > 3; **A2 (MF#1):** `lineamentNodeCount` **NON-STRICT monotone** in tidal (`v[i] ≥ v[i-1]`, no downward inversion — `CREST_THRESH` saturates on the `CREST_LO` plateau so a STRICT adjacent-pair read would falsely fail), **endpoint Δ > linN-floor** as the measurability gate (icy Δ64>23; Titan **interior** sweep Δ82>39, `tidalDev∈(0,0.97)`); **A3 (MF#2):** `cellCount` **NON-STRICT monotone** (integer `round(CELL_MIN)` plateaus), driven by **`T_eq` on BOTH icy + Titan** (in-domain; any `volatileFraction` sweep capped ≤1.0), **endpoint Δ > cellCount-floor every seed** (icy `T_eq 110→250` Δ8>7 all 5 seeds; Titan `T_eq 94→230` Δ8>7); A4 (icy): `CHAOS_THRESH` knob strictly ↓ in T_eq every seed + chaos-area non-decreasing/no-inversion + aggregate mean(warm−REF)>floor; REF-collapse: field === shipped at each REF. "Non-strict, no downward inversion" = the contract's "no sign inversion inside the domain" phrasing |
| **AC-VARIETY** | new file | **(MF minor #e) PER-OBSERVABLE, matching the contract wording:** at fixed seed, LOW↔HIGH corner Δ > that observable's own 5-seed floor, **every seed**, for the observables the corners MOVE — **icy-active: `linFrac`/`stdU`/`cellCount`** (normΔ 2.83/2.10/2.57); **volatile-cold: `stdU`/`chaosFrac`/`cellCount`** (4.65/1.14/2.43). NOT-CLAIMED (documented, not folded in): icy `chaosFrac` (normΔ 0.19, seed-fragile — A4 owns chaos), volatile-cold `linFrac` (normΔ 0.36, both corners tidal-saturated). PLUS seed-only baseline within floor (=1.0 by construction). Composite floor-normalized distance (4.94 icy / 5.49 vc vs seed-only 1.86/1.58) kept as a **reported summary metric, NOT the pass gate**. Headline low-g/high-g `std(U)` ratio > 3 per seed (icy) |
| **AC-ORDER** | new file | every sweep point × 5 seeds: `varExplainedByStress > varExplainedByLatitudeY` AND `> varExplainedByLatitudeW0` (arm's-length predictor w/ tuned CREST); `lineamentInteriorRatio > 1`; key-set ⊆ 7 (never DESPIN_REF/DIUR_REF/DIUR_PEAK/SHOULDER_HT/TROUGH_DEPTH/SHELL_BASE/RELAX_PASSES/REGIME_WEIGHTS); grainAngle+faultDensity byte-identical across the sweep |
| **AC-ZERO-CLOBBER** | EXISTING gates (Slice B) | (a) `v2-0-byte-identity` 83/83; (b) `worldengine-base-shell-structure`, `worldengine-shell-regime-gate`, `worldengine-v2-3-dispatch-oracle`, `worldengine-base-stagnantlid-structure` (its `shellReference` null-tune helper :301) green; (c) plate/volcanic/stagnant/despun byte-identical; (d) diff fence (§6); (e) `lid:`/`disrupt:` untouched; (f) 4-known-failures don't grow, new file collects nonzero |
| **AC-LAB** | live (§8) | chrome-devtools drive recipe |
| **AC-UAT** | Max | deferred-to-max; never agent-PASSed |

**MF#3 counting rule:** the new `tests/worldengine-base-shell-multiply.test.js` MUST collect and run a
nonzero test count (verify `Tests N passed`, N>0, in its own run). The full-suite `Tests 4 failed` /
`Test Files 17 failed` baseline must be **identical** after both slices (our file adds only passing tests).
Every `describe` must contain at least one `it` that actually executes (no empty/skipped blocks).

---

## 6. The diff fence (verbatim, AC-ZERO-CLOBBER(d))

> ONLY `src/worldengine/base/shellRelief.js`, `planet-lod-rivers.js`, `planet-lod-lab.html`, new/updated
> shell tests, workstream docs — NOT plates/magmatism/stagnantLid/mixedInterior/lidResponse/e1Regime/
> body-condition-vector/driver-presets, and NOT V2-7d's lidDisruption module.

Enforcement each commit: `git show --stat <sha>` shows exactly that set. **Stage only files we touch** — the
untracked png/qa-results pile, `src/auto/CameraChoreographer.js`, and `src/debug/LabMode.js` (not-ours lane-B,
modified in the tree) stay OUT of every commit. `'lid:'`/`'disrupt:'` namespaces untouched (shell stays in
`'shell:'`).

---

## 7. Riskiest seams, ranked (attack first)

1. **The dispatch-oracle grep (§4, call site 1).** The derived-block AC-0 grep forbids `shellRegimeOf(` /
   `archetype`. Use `shellDriversToTune(bodyDrivers, regime)` with the in-scope `regime` param only. Run
   `worldengine-v2-3-dispatch-oracle.test.js` immediately after the edit.
2. **Exact-null-at-REF discipline.** The 75-golden holds ONLY IF `shellDriversToTune(liveEuropa/Titan/Eyeball,
   r) === null`. It does BECAUSE the REF slots are byte-exact (§1a: `Object.is` true, incl.
   `0.15624999999999997` for Titan g) AND `pow(1,-0.5)/log10(1)/zero-numerator` are IEEE-exact. AC-TUNE-NULL(c)
   pins every REF slot === live to full float precision so a rounded literal is caught in Slice A, long before
   it surfaces as an unexplained golden break.
3. **The `grainDrivers → bodyDrivers` swap.** Byte-safe only because `void drivers;` (shellRelief.js:166).
   AC-BYTE-SHELL proves it at the writer; AC-ZERO-CLOBBER(a) proves it end-to-end. If either reddens, the
   writer has started reading `drivers` — STOP.
4. **AC-TUNE-NULL(c) non-circularity.** The REF must equal the ACTUALLY-CONSTRUCTED live bundle, not just
   itself. Build it via the real `deriveUniforms → buildNeutralBodyDrivers + deriveConditionVector` pipeline
   (never re-import the frozen literal into the "live" side).
5. **AC-ORDER predictor choice.** Use the arm's-length rebuilt predictor (tuned CREST), NOT `reliefStress` —
   the latter dips below latitude at the volatile-cold hi-tidal extreme (§1d).
6. **Measurability at the tail seeds.** A1 must be RATIO-based (multiplicative), A4 knob+aggregate (seed 42
   is chaos-resistant), AC-VARIETY composite-distance (single axes don't move all observables). Do NOT write
   per-observable-per-seed floor assertions for A1/A4/VARIETY — they fail at the tail seed (§1e).

---

## 8. AC-LAB drive recipe (deferred to working-Claude, after Slice B)

Preconditions (Max provides): dev server `npm run dev -- --port 5175`; debug Chrome on `127.0.0.1:9223`.
Liveness via `mcp__chrome-devtools__list_pages` (**never** sandbox-curl a localhost port — returns 000).
Poll `state._lastBodyDrivers` object identity after each slider change (~500ms settle).
**Window hygiene:** reuse ONE isolated page for the whole recipe; `close_page` every agent page at the end.

1. Fresh tab → the lab. Select **Europa (icy moon)** (routes shell `icy-active`), fixed seed, reliefBakeStrength 1.
2. **TRUE baseline first** — `fShellDrivers` A/B in `preset` mode: `_lab.shellProbe().appliedTune === null`,
   record `{lineamentNodeCount, cellCount, std(U), varExplainedByStress}`. Screenshot.
3. **A1 gravity — BOTH directions** (slider `gravity (g)` range [0.1, 3.0], Europa REF g=0.28, both reachable):
   drag to **0.1** (low-g) → `appliedTune` non-null, `std(U)`/relief UP, screenshot; drag to **~1.5** (high-g) →
   relief DOWN, screenshot.
4. **A2 tidal — DOWN on Europa** (slider `tidal heat` range [0.0, 1.0]; Europa REF tidal=136.7 ≫ slider max, so
   only the DECREASE direction is reachable on Europa): drag DOWN → `lineamentNodeCount` DOWN. Screenshot.
   > ⚠ **Slider-range flag:** tidal↑ is NOT reachable on Europa (REF 136.7 > slider max 1.0). Show the tidal↑
   > direction on **Titan** in step 6. (Do NOT widen the slider — that breaks the "zero new plumbing / free
   > lever" promise; surface to Max at UAT if he wants Europa tidal-up live.)
5. **A3/A4 warmth (optional)** — `surface temp (T_surf K)` slider (range [230,760]) overlays `condition.T_eq`;
   Europa REF T_eq=110 < 230, so any drag jumps warmer → `cellCount` UP (+ chaos area on icy-active). Screenshot.
6. **Second regime — Titan (volatile-cold):** select Titan (routes `volatile-cold`), fixed seed. Drag `tidal
   heat` UP from ~0 (Titan REF 1.6e-8 ≪ slider) → `appliedTune` non-null about Titan's own REF,
   `lineamentNodeCount` UP. Screenshot both ends. Proves the second regime responds about its own REF.
7. Console clean of NEW errors (`list_console_messages`). Archive screenshots in `evidence/`. Close all pages.

**AC-UAT (Max's gate, deferred-to-max, never agent-PASSed):** Max drives low-g vs high-g at the same seed on
an icy preset and judges it reads as a genuinely different icy world (honesty flag: the three shipped presets
stay byte-identical — the judgment is that the response SPACE exists along the driver axes, not that Titan/
Europa/Eyeball changed). Deferred past Max's usage-window reset.

---

## 9. Calibration evidence (reproducible, FROM REPO ROOT)

- `calibration/ref-slots.mjs` — REF slots byte-exact vs live/deriveUniforms (§1a).
- `calibration/gain-probes.mjs` — noise floors, exact collapse, blast-radius, per-axis monotone sweeps (§1b/1c).
- `calibration/order-probe.mjs` — AC-ORDER falsifier under tune; arm's-length vs reliefStress (§1d).
- `calibration/variety-probe.mjs` — A1-ratio / A4-aggregate / composite-distance + PER-OBSERVABLE clears (§1e).

---

## Lens log (V2-3 in-file pattern)

Two adversarial lenses reviewed BUILD-PLAN `6f1852d`. **Byte lens verdict: BUILD-READY (0 must-fixes).**
**Mechanism lens verdict: NEEDS-FIX (2 must-fixes).** Both must-fixes + all seven minors folded IN PLACE below;
every refreshed number is the real output of the re-run calibration script cited.

| # | Lens | Finding | RESOLVED-BY |
|---|---|---|---|
| **MF1** | mechanism (byte concurred, its minor #1) | AC-TUNE-RESPONSE A2/A3 monotonicity under-specified as "monotone ↑"; a STRICT adjacent-pair read fails at the plan's own sweep points — Titan `tidal=1.0` & `100` both saturate `CREST=0.85` → identical `linN=162`; `round(CELL_MIN)` plateaus similarly | §5 AC-TUNE-RESPONSE row + §1b + §1e restated A2/A3 as **NON-STRICT** (`v[i] ≥ v[i-1]`, no downward inversion; endpoint Δ>floor is the measurability gate), matching the contract's "no sign inversion inside the domain". **Trimmed the Titan A2 sweep into the interior** `tidalDev∈(0,0.97)` (REF, 1e-6, 1e-4, 1e-2) in `gain-probes.mjs`, re-ran: **linN 76→101→129→158, Δ82 vs floor 39, no plateau, monotone-up true** |
| **MF2** | mechanism | AC-TUNE-RESPONSE A3-icy proved measurability with OUT-OF-DOMAIN `volatileFraction=1.4` (physical ≤1.0, slider max 0.6); in-domain vf sweep gives Δ cellCount = 7 = floor exactly | Re-drove A3-icy via **`T_eq`** in `gain-probes.mjs` (added a per-seed block), re-ran: **`T_eq 110→250` → cellCount Δ8 > floor 7 on EVERY seed** {1,2,3,7,42} (CELL_MIN 9→17). Capped vf ≤1.0. Updated §1e + §5 |
| a | byte | Migration bridge assumes `bodyDrivers===null`; a non-null-without-`condition` bodyDrivers would produce a non-null tune (behavior change) — no current caller does | §4 Slice-B migration-bridge note added (acknowledged, not guarded; 83-golden/AC-BYTE-SHELL would surface a future regression) |
| b | byte | `SHELL_REFS[regime] \|\| SHELL_REFS['icy-active']` fallback is DEAD CODE (e1Regime.js guarantees the invariant) | §2 "Known non-issues" note: defensive-only, currently unreachable, keep idiom-matched |
| c | byte | `gain-probes.mjs` labeled `tidalHeating=136.745` "REF" but exact REF = `136.74504375182553` → spurious non-null tune at that row | Fixed the script to reference the **exact** `SHELL_REFS['icy-active'].tidalHeating` (no hand-typed decimal), re-ran: **the REF row now prints `[null]`**; icy A2 Δ64>23 unchanged |
| d | mechanism | NaN inputs pass the `?? REF` guard → NaN knobs (unreachable via `deriveUniforms`; sibling builders don't guard either) | §2 "Known non-issues" note: documented as house-consistent; **no `Number.isFinite` guard added** (stays idiom-matched) |
| e | mechanism | AC-VARIETY wording (contract: per-observable floor) vs `variety-probe.mjs` (composite Euclidean > 1.5) | Extended + re-ran `variety-probe.mjs` to print PER-OBSERVABLE floor-normalized LOW↔HIGH deltas both regimes. §5 AC-VARIETY now asserts **per-observable Δ>floor for the CLEARING observables** (icy: linFrac/stdU/cellCount 2.83/2.10/2.57; vc: stdU/chaosFrac/cellCount 4.65/1.14/2.43), documents **not-claimed** (icy chaosFrac 0.19, vc linFrac 0.36), keeps composite as reported summary only; seed-only baseline within floor |
| f | mechanism | `CREST_LO=0.82` unreachable via tidal (`CREST∈[0.85,0.985]`); `CREST_HI` reached at `tidalDev=−1` | §1b clamp-reachability note added (dead defensive bound; CREST_HI reached at the tidal-DOWN extreme) |
| g | mechanism | A3-Titan margin thin (Δ8 vs floor 7) | §1b margin-honesty note: `K_CELL` UAT-tunable up; per-seed check shows Δ8>7 on all 5 seeds (icy + Titan) |

All four are `.mjs` (NOT `*.test.js`) so vitest never collects them.
