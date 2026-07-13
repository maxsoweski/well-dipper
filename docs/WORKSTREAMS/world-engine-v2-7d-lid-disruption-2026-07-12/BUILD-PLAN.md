# V2-7d BUILD-PLAN — SP-LID-DISRUPTION family module (`lidDisruption.js`)

**Workstream:** `world-engine-v2-7d-lid-disruption-2026-07-12` · **Plan written:** 2026-07-12
**Binds to:** `contract.json` (every AC + designDecision) + `GROUNDING.md` §4 interface sketch + §5 AC table + `intent.md`.
**Deviations from GROUNDING §4 are enumerated in the `## Build deviations` appendix — nothing silent.**

**Concurrency fences (hard, non-negotiable during build):**
- HEADLESS ONLY (node + npx vitest). COMMIT NOTHING — working-Claude is the serialization point (V2-3 flip is in-flight in this same tree).
- NEW FILES ONLY: `src/worldengine/base/lidDisruption.js`, `tests/worldengine-lid-disruption*.test.js`, this workstream dir. NEVER modify any existing `src/` or `tests/` file.
- Test runs during build: the two new test files + `tests/planet-archetypes.test.js` ONLY. Full-suite AC-ZERO-CLOBBER gating happens at working-Claude's commit point after V2-3 lands.
- Three-free module: imports ONLY `alea`, `simplex-noise` (`createNoise3D`), `./mathutil.js`. Alea namespace `'disrupt:'` EXCLUSIVELY. No `Math.random`/`Date.now`. Bounded iteration only (one O(N) BFS queue drain). Never write any carrier channel. No relax passes.

---

## §0 — Statistic-band calibration (R2 anti-vacuous-bands discipline)

Probe: [`v2-7d-band-calibration.mjs`](v2-7d-band-calibration.mjs) (this dir) — run 2026-07-12 with
`node docs/WORKSTREAMS/world-engine-v2-7d-lid-disruption-2026-07-12/v2-7d-band-calibration.mjs`.
It drives the REAL `writeShellReliefSphere` (STEP-2 cells, regime `icy-active`) and the REAL
`writeStagnantLidReliefSphere` (corona construction) on the deterministic test mesh
(`buildIrregularSphere(N, 2)` + `makeSphereField` — the shipped structure-test harness idiom), seeds
{1,2,3,7,42}, tune-only perturbations. Interiorness is recomputed ARM'S-LENGTH from published `cellId`
(the writer does not publish `cellInteriorness`); corona field-bias uses the shipped test's unwarped
plume predictor evaluated at published `coronaCenters`.

### 0.1 Reference tables (probe output, verbatim)

```
CELLS [REFERENCE (defaults)] (N=1500, seeds 1,2,3,7,42)
  seed  K   wallFrac  spaceFill  mono  wall0  meanInt  intP90  szQ10  szQ50  szQ90  szMin
     1  11  0.365     true       true  true   0.579    0.993   0.27   0.89   1.61   0.21
     2  10  0.309     true       true  true   0.637    0.999   0.44   0.75   1.78   0.42
     3  10  0.345     true       true  true   0.594    0.993   0.60   0.96   1.50   0.52
     7  10  0.329     true       true  true   0.614    0.999   0.56   1.06   1.36   0.18
    42  17  0.431     true       true  true   0.504    0.965   0.58   0.96   1.36   0.42
  → pooled sizes (58 cells): q10 0.50  q50 0.93  q90 1.59  min 0.18

CELLS perturbed-control ranges (5 seeds each):
  {CELL_MIN:3,CELL_SPAN:1}   K=3   wallFrac [0.149,0.167]  meanInt [0.800,0.819]  pooled: q90−q10 0.63, szMin 0.63
  {CELL_MIN:36,CELL_SPAN:1}  K=36  wallFrac [0.567,0.610]  meanInt [0.332,0.371]  pooled: q90−q10 1.28, szMin 0.22
  {WARP_AMP:0.9}                   wallFrac [0.691,0.821]  meanInt [0.147,0.260]  pooled: q90−q10 1.17, szMin 0.10
  {WARP_AMP:0}                     wallFrac [0.279,0.394]  meanInt [0.542,0.671]  pooled: q90−q10 1.07, szMin 0.23
  {BELT_RADIANS:0.24}              wallFrac [0.309,0.431]  meanInt [0.268,0.394]  (partition identical to reference)

FOCI [REFERENCE (defaults)] (N=1500, seeds 1,2,3,7,42)
  seed  n(real)  coverage  uQ25   uQ50   uQ75   uQ90   biasReal  n(ctrl)  covCtrl  biasCtrl  ratio
     1    12     0.060     0.18   0.39   0.56   0.62   0.603       15     0.053    0.110     5.49
     2    10     0.042     0.01   0.12   0.49   0.73   0.548       21     0.085    0.164     3.34
     3     9     0.057     0.00   0.52   0.71   0.80   0.685       18     0.088    0.133     5.16
     7    14     0.067     0.05   0.35   0.73   0.82   0.522       17     0.059    0.323     1.61
    42    10     0.023     0.01   0.07   0.18   0.22   0.672       12     0.045    0.204     3.30
  → pooled: activeFrac 0.636 (n=55)  u-hat q50 0.215  q90 0.772  pooled coverage ≈ 0.0498

FOCI [REFERENCE (defaults)] (N=600): n [1,7]  coverage [0.022,0.098] pooled ≈ 0.0472
  biasReal > biasCtrl on every seed (ratio min 1.16); pooled u-hat q50 0.210  activeFrac 0.522 (n=23)

FOCI perturbed-control ranges (N=1500, 5 seeds each):
  {CORONA_POOL:480}        n [30,62]  coverage [0.117,0.191] pooled ≈ 0.159   activeFrac 0.668 (n=238)
  {CORONA_POOL:30}         n [0,3]    coverage [0.000,0.021] pooled ≈ 0.0122  (seed 3 → ZERO features)
  {CORONA_SIZE_SKEW:1}     pooled u-hat q50 0.540  q90 0.902 (radius law visibly de-skewed)
  {CORONA_ACTIVE_FRAC:0.35} pooled activeFrac 0.273 (n=55)
  {CORONA_POOL:20} (small) n [0,2] — seed 3 again ZERO (biased-pool shrink is NOT the Miranda route; see F6)
```

### 0.2 PINNED BANDS (asserted in the module's structure tests exactly as written)

Bands are derived from the reference ranges (with margin for the module's own independent draws — same
distribution family, different rng stream) and each band **demonstrably excludes a named perturbed
control**. The module tests re-run the perturbed configs THROUGH THE MODULE and assert exclusion
(the both-directions gate-3 validation), so no band can silently go vacuous.

**CELLS** — `makeCellDisruption` at N=1500, seeds {1,2,3,7,42}, `tune = null` (defaults ≡ shell values):

| # | Statistic | Pinned band | Reference | Excluded perturbed control (probe value) |
|---|---|---|---|---|
| C1 | `cellCount` per seed | `[CELL_MIN, CELL_MIN+CELL_SPAN)` = [9,18) at defaults | 10–17 | `{CELL_MIN:3,CELL_SPAN:1}` → 3; `{CELL_MIN:36,CELL_SPAN:1}` → 36 |
| C2 | wall-node fraction per seed (nodes with a differing-`cellId` neighbor / N) | **[0.25, 0.50]** | 0.309–0.431 | K=3 → 0.149–0.167 (below); K=36 → 0.567–0.610 (above); WARP_AMP 0.9 → 0.691–0.821 (above) |
| C3 | mean `interiorness` per seed | **[0.45, 0.70]** | 0.504–0.637 | BELT×4 → 0.268–0.394; K=3 → 0.800–0.819; K=36 → 0.332–0.371; WARP 0.9 → 0.147–0.260 |
| C4 | pooled normalized-cell-size spread `q90 − q10` (sizes × K/N, pooled across the 5 seeds) | **[0.70, 1.80]** | 1.09 | K=3 → 0.63 (below) |
| C5 | pooled normalized-cell-size minimum | **≤ 0.55** | 0.18 | K=3 → 0.63 (above) |
| C-inv | invariants (exact, not bands): partition space-filling (every node assigned; all K cells non-empty); `interiorness ∈ [0,1]`, **exactly 0** on wall nodes; monotone-nondecreasing in `wallDist` (constant per distance value) | must hold | held on all 5 reference seeds | — (invariants, falsified by construction bugs, not by tuning) |

**FOCI** — `makeFociDisruption` with the TEST-OWNED synthetic field (8 seeded centers, squared-Gaussian
belt 0.35 — same functional form as the stagnant plume proximity, similar acceptance statistics),
seeds {1,2,3,7,42}, `tune = null`:

| # | Statistic | Pinned band | Reference | Excluded perturbed control (probe value) |
|---|---|---|---|---|
| F1 | accepted count per seed @ N=1500 | **[5, 28]** | 9–14 | `{POOL:480}` → 30–62; `{POOL:30}` → 0–3 |
| F2 | pooled coverage fraction (mean over seeds of `coverMask` fraction) at **both** N=1500 and N=600, + cross-density pooled ratio | **[0.02, 0.12]** at each density; ratio **∈ [0.5, 2.0]** | 0.0498 / 0.0472; ratio 1.05 | `{POOL:480}` → 0.159 (above); `{POOL:30}` → 0.0122 (below) |
| F3 | pooled radius-law û median, û = ((R_c/meanEdgeAngle) − RC_MIN_NODES)/RC_SPAN_NODES (= u^SIZE_SKEW; theory median 0.5^2.5 ≈ 0.177) | **[0.08, 0.35]** | 0.215 (1500) / 0.210 (600) | `{SIZE_SKEW:1}` → 0.540 (above) |
| F4 | pooled type split (typeId=1 fraction) @ N=1500 (n≈55; ±2σ ≈ ±0.13) | **[0.50, 0.80]** | 0.636 | `{TYPE_FRAC:0.35}` → 0.273 (below) |
| F5 | field bias: mean `acceptWeightAt` over accepted centers — real vs `acceptWeightAt=null` constant-accept control | real **>** control strictly, **every seed, both densities**; AND per-seed ratio **≥ 1.3** @1500; AND pooled ratio **≥ 2.0** @1500 | per-seed ratio 1.61–5.49 @1500 (pooled ≈ 3.2); strict > held 10/10 incl. N=600 | the null control IS the excluded control (the stagnant AC4 decoupling pattern) |
| F6 | small-pool grace (the V2-9a Miranda seam): `tune {POOL:3, POOL_REF_N:1500}` + `acceptWeightAt = () => 1` | count **=== 3** every seed; eval renders 3 features with nonzero cover; same code path (no special case) | — (module-defined config) | **calibration finding:** the biased-pool-shrink route is NOT graceful — stagnant `{CORONA_POOL:20}` and `{:30}` both produce **0 features on seed 3**; GROUNDING 3b's "small pool **or high floor**" resolves to the floor route, pinned here |

**Transfer-risk note (stated up front, per R2):** bands are calibrated on the reference writers and
asserted on the module — same construction family, independent draws, and (foci) a synthetic rather
than plume field. Band edges carry margin for that. If a band fails at build time, that is **evidence,
not a knob**: stop, re-run the probe against the module itself, and log the resolution (band-bug vs
module-bug) in `## Build deviations` — never silently widen.

---

## §1 — Module spec: `src/worldengine/base/lidDisruption.js`

One owned module expressing BOTH seed patterns as a **FAMILY** (contract designDecision #1): two
constructors + a shared pure profile library + one discipline. Placement algorithms, count semantics,
radial coordinates, and deformation semantics stay distinct BY DESIGN — no mode flag, no shared
"placement strategy" parameter.

**Imports (complete list):** `alea` (default), `createNoise3D` from `simplex-noise`, `clamp, clamp01`
from `./mathutil.js`. Nothing else — no cross-imports from sibling writers (the profile formulas are
re-stated, provably identical via AC-PROFILE-EQ, not imported).

**Module-private helpers (verbatim plates/shell idiom):** `dot`, `norm`, `randDir` (2 draws/call,
draw order load-bearing), the STEP-0 `meanEdgeAngle` scan.

**Comment discipline [RESOLVED-BY-LENS: MF2]:** all discipline greps EXCEPT ONE run on
**comment-stripped source** (the house idiom is `stripComments` — verified against real code:
`worldengine-mixed-composer.test.js:34` defines it and `:108`/`:133` grep `CODE = stripComments(SRC)`,
NOT the raw source; this plan's earlier "comments included" phrasing contradicted both that precedent
and its own token list — the three self-trips MF2 enumerates: `conditional` ⊃ `condition`,
"regime-gate-free" ⊃ `regime`, a header comment quoting the BFS `while` making whileCount=2). The
exact regexes are pinned in §1.6; with stripped-source greps, comment wording is free EXCEPT for the
one raw-source pin: comments must never contain a quoted shipped-namespace literal (never write a
quote character followed by a shipped namespace-with-colon token; phrase it as "the shell cells
stream"). Code identifiers must still avoid the §1.6 banned tokens (`condition`, `bodyDrivers`,
`archetype`, carrier channel names as `carrier.` writes) — those greps see code, not comments.

### 1.1 Shared profile library (pure, alea-free)

```js
export const PROFILE_DEFAULTS = Object.freeze({
  // corona amplitudes — VALUE-IDENTICAL to stagnantLid DEFAULTS and MIXED_DEFAULTS (AC-PROFILE-EQ pins this)
  A_DOME: 0.35, A_TRENCH: 0.30, A_RISE: 0.12,   // active profile
  A_DEP: 0.18, A_RIM: 0.22,                     // inactive profile
  // grooved-diapir capability profile (NEW — synthetic capability proof, NOT the #4.5 decision)
  A_GROOVE_DOME: 0.25,   // central diapir dome amplitude
  A_GROOVE: 0.15,        // per-ring trough depth
  GROOVE_R0: 0.35,       // first ring radius (in ρ)
  GROOVE_DR: 0.28,       // ring spacing (in ρ)
  GROOVE_SIGMA: 0.06,    // ring trough half-width
  GROOVE_RINGS: 3,       // ring count (bounded fixed loop)
  GROOVE_SUPPORT: 1.2,   // hard support cutoff for the grooved type (≥ R0 + (RINGS−1)·DR + 3σ ≈ 1.09)
});

export function profileActiveCorona(rho, P = PROFILE_DEFAULTS)    // → Δh
export function profileInactiveCorona(rho, P = PROFILE_DEFAULTS)  // → Δh
export function profileGroovedDiapir(rho, P = PROFILE_DEFAULTS)   // → Δh
```

Bodies — the shape constants stay **literal** (they are the profile's identity; keeping them literal
makes formula-identity with the shipped inline copies self-evident), amplitudes come from `P`:

```js
// ≡ stagnantLid.js STEP-3 active branch ≡ mixedInterior.js STEP-7 active branch (exact FP arithmetic)
profileActiveCorona:
  const dome   = P.A_DOME   * Math.max(0, 1 - (rho / 0.75) * (rho / 0.75));
  const trench = P.A_TRENCH * Math.exp(-((rho - 0.95) / 0.12) * ((rho - 0.95) / 0.12));
  const rise   = P.A_RISE   * Math.exp(-((rho - 1.25) / 0.18) * ((rho - 1.25) / 0.18));
  return dome - trench + rise;

// ≡ both shipped inactive branches
profileInactiveCorona:
  const dep = P.A_DEP * Math.max(0, 1 - (rho / 0.85) * (rho / 0.85));
  const rim = P.A_RIM * Math.exp(-((rho - 0.95) / 0.10) * ((rho - 0.95) / 0.10));
  return -dep + rim;

// NEW: central dome + GROOVE_RINGS concentric Gaussian ring troughs at rk = R0 + k·DR
profileGroovedDiapir:
  const dome = P.A_GROOVE_DOME * Math.max(0, 1 - (rho / 0.9) * (rho / 0.9));
  let grooves = 0;
  for (let k = 0; k < P.GROOVE_RINGS; k++) {
    const rk = P.GROOVE_R0 + k * P.GROOVE_DR;
    grooves += Math.exp(-((rho - rk) / P.GROOVE_SIGMA) * ((rho - rk) / P.GROOVE_SIGMA));
  }
  return dome - P.A_GROOVE * grooves;
```

FP-equality note: the shipped writers compute `coronaContrib[i] += dome - trench + rise` — the added
operand is the identical `(dome - trench) + rise` expression our function returns, so
`contrib[i] += profileActiveCorona(rho, P)` performs the byte-same accumulation sequence.

**Default type registry** — support is a property of the profile shape, so it lives WITH the profile
(deviation D1 from GROUNDING §4, see appendix):

```js
export const DISRUPT_PROFILES = Object.freeze([
  Object.freeze({ fn: profileInactiveCorona, support: 1.3 }),  // typeId 0 (≡ stagnant SUPPORT_INACTIVE)
  Object.freeze({ fn: profileActiveCorona,  support: 1.6 }),   // typeId 1 (≡ stagnant SUPPORT_ACTIVE)
]);
// grooved is NOT registered by default — registering it is the consumer's act (the AC-CONSUMER-SEAM
// test registers { fn: profileGroovedDiapir, support: PROFILE_DEFAULTS.GROOVE_SUPPORT } as typeId 2).
```

### 1.2 Constructor 1 — `makeCellDisruption` (generalizes shellRelief STEP-2)

```js
export const CELL_DEFAULTS = Object.freeze({
  CELL_MIN: 9, CELL_SPAN: 9,        // K ∈ [9,18) — value-identical to the shell seed
  WARP_FREQ: 1.6, WARP_AMP: 0.18,   // domain-warp of cell walls (the shared three-tap idiom)
  BELT_RADIANS: 0.06,               // interiorness geodesic falloff half-width
});

export function makeCellDisruption(carrier, { macroSeed = 0, seedKey = 'disrupt:cells:', tune = null } = {})
// → { mode:'cells', cellId:Int32Array(N), cellCount, interiorness:Float32Array(N),
//     wallDist:Int32Array(N), centers:[[x,y,z]×K], meanEdgeAngle }
```

Algorithm (each step mirrors the shell seed; regime-gate-free — the shell `CHAOS_W>0` gate is the
consumer's physics and is NOT baked in):
1. Guard: `if (!seedKey.startsWith('disrupt:')) throw` (namespace exclusivity is structural, deviation D4).
2. `T = tune ? { ...CELL_DEFAULTS, ...tune } : CELL_DEFAULTS` (the sibling-writer seam).
3. STEP-0 `meanEdgeAngle` scan (verbatim idiom).
4. **Stream A** `alea(seedKey + seed)`: draw 1 = `cellCount = T.CELL_MIN + floor(u·T.CELL_SPAN)`;
   then per cell: `randDir` (2 draws) + **2 RESERVED draws** (vigor/polarity — read and discarded,
   kept deliberately so a future consumer can consume them without a draw-order break; mirrors shell
   SLICE-B intent, R6).
5. **Stream B** `alea(seedKey + 'warp:' + seed)` → `createNoise3D` (separate stream so the pinned
   Stream-A count stays free of simplex's construction draws; deviation D5).
6. Space-filling warped nearest-centroid assignment: three-tap domain warp (offsets
   `+19.1/−7.3/+3.7`, `−5.2/+11.9/−2.4` — the shared idiom, verbatim), max-dot with strict `>`
   tie-break (lowest index wins).
7. Multi-source BFS from wall nodes (differing-`cellId` neighbor) — `wallDist`, the O(N) queue drain
   (the plates/shell idiom, the module's ONLY `while`); `qt === 0 → fill(0)` guard kept.
8. `interiorness[i] = clamp01(1 − exp(−(wallDist[i]·meanEdgeAngle) / T.BELT_RADIANS))` — 0 exactly on
   walls, →1 inward.

Returns raw fields only — no stress coupling, no texture, no carrier write (consumers gate/modulate;
designDecision #4).

### 1.3 Constructor 2 — `makeFociDisruption` (generalizes stagnantLid coronae)

```js
export const FOCI_DEFAULTS = Object.freeze({
  POOL: 120, POOL_REF_N: 1500,       // pool ∝ N ⇒ resolution-invariant coverage (the stagnant law)
  BIAS: 2.0,                         // accept ∝ acceptWeightAt(site)^BIAS
  CTRL_ACCEPT: 0.13,                 // constant accept when acceptWeightAt=null (the decoupled control)
  TYPE_FRAC: 0.65,                   // typeId 1 : 0 split (≡ stagnant CORONA_ACTIVE_FRAC)
  RC_MIN_NODES: 0.5, RC_SPAN_NODES: 1.1, SIZE_SKEW: 2.5,   // R_c = (MIN + u^SKEW·SPAN)·meanEdgeAngle
});

export function makeFociDisruption(carrier, { macroSeed = 0, seedKey = 'disrupt:foci:', tune = null,
  acceptWeightAt = null /* (dir)→[0,1]; null ⇒ CTRL_ACCEPT constant */ } = {})
// → { mode:'foci', centers:[[x,y,z]…], radii:Float32Array(count), typeIds:Uint8Array(count),
//     alive:Uint8Array(count) /* all 1; the editor's deactivation switch */, count, meanEdgeAngle }
```

Algorithm:
1. seedKey guard + `T` seam + STEP-0 `meanEdgeAngle` (as above).
2. `pool = max(1, round(T.POOL · N / T.POOL_REF_N))`.
3. **Stream C** `alea(seedKey + seed)`, the stagnant conditional-draw pattern (FROZEN): per candidate —
   `randDir` (2 draws) + accept draw (1); `pAccept = acceptWeightAt ? Math.pow(clamp01(acceptWeightAt(site)), T.BIAS) : T.CTRL_ACCEPT`;
   **on accept only** — radius draw `u` (1) → `R_c = (T.RC_MIN_NODES + Math.pow(u, T.SIZE_SKEW) · T.RC_SPAN_NODES) · meanEdgeAngle`,
   then type draw (1) → `typeId = tv < T.TYPE_FRAC ? 1 : 0`. (5 draws accepted / 3 rejected.)
4. Count is EMERGENT (never unified with the cells band — designDecision #1). Field coupling enters
   ONLY via the caller-supplied `acceptWeightAt` (designDecision #4/R3); the module never reads
   stress/L/Φ itself.

### 1.4 Evaluation, split from placement — `evalFociDeformation` (the V2-7 editor seam)

```js
export function evalFociDeformation(carrier, foci, profiles = DISRUPT_PROFILES, P = PROFILE_DEFAULTS)
// → { contrib:Float32Array(N), coverMask:Uint8Array(N) }
```

- ZERO draws, ZERO alea calls (pinned by the drawcount test) — an editor mutates descriptors
  (`alive[c] = 0`, `typeIds[c] = k`, `radii[c] = r`) and re-evaluates without touching any stream.
- Per focus `c` (placement order): skip if `foci.alive && !foci.alive[c]`; `prof = profiles[typeIds[c]]`
  — **throws** on a missing registry entry (loud contract, no silent skip); `Rc = radii[c] || 1e-6`;
  per node: `rho = acos(clamp(−1,1,dot(vert,ctr))) / Rc`; `rho > prof.support → continue`;
  `coverMask[i] = 1; contrib[i] += prof.fn(rho, P)` (additive — overlaps sum, the stagnant semantics).
- Allocates its own output arrays; writes NO carrier channel (module-wide rule).

### 1.5 Frozen draw-order spec (documented in the module header; pinned by the drawcount test)

| Stream | Key (defaults) | Order | Total |
|---|---|---|---|
| A — cells | `'disrupt:cells:' + seed` | draw 1: count; per cell p: z, azimuth, RESERVED vigor, RESERVED polarity | `1 + 4·cellCount` |
| B — cell warp | `'disrupt:cells:warp:' + seed` | consumed only by `createNoise3D` construction (simplex-internal count, deliberately un-pinned) | — |
| C — foci | `'disrupt:foci:' + seed` | per candidate: z, azimuth, accept; on accept: radius, type | `3·pool + 2·accepted` |
| eval | — | none | `0` |

### 1.6 Module-wide discipline pins (grep-enforced) — exact regexes [RESOLVED-BY-LENS: MF2]

Every grep below runs on `CODE = stripComments(SRC)` (the mixed-composer house idiom) **except** the
quoted-namespace check, which runs on the RAW source (a quoted shipped-namespace literal is banned
even in a comment — the contract AC-DET wording):

| Pin | Regex | Source | Expect |
|---|---|---|---|
| no Math.random | `/Math\.random\s*\(/` | stripped | absent |
| no Date.now | `/Date\.now\s*\(/` | stripped | absent |
| exactly ONE `while` (the BFS drain) | `/while\s*\(/g` | stripped | match count === 1 |
| no relax/Jacobi pass | `/for\s*\(\s*let\s+pass/` | stripped | absent |
| no carrier channel write/read | `/carrier\.(height|grainAngle|faultDensity|regime)/` | stripped | absent (reads only `carrier.N/verts/adj`) |
| no D-vector/E1 read (AC-0) | `/\bbodyDrivers\b/`, `/\bcondition\b/` (word-boundary — does NOT match `conditional`), `/computeE1/`, `/\be1\./`, `/\barchetype\b/` | stripped | all absent |
| no quoted shipped-namespace literal | `/['"´\`](magma:|stagnant:|shell:|plates:|lid:|e1:)/` | **raw** | absent |
| every alea call is seedKey-derived | `/alea\(/g` count === `/alea\(\s*seedKey/g` count | stripped | equal (static half; the dynamic half is the drawcount test's key bookkeeping + the D4 `startsWith('disrupt:')` throw) |

Plus (non-grep): `tune ? { ...DEFAULTS, ...tune } : DEFAULTS` seam on both constructors; all three
DEFAULTS objects + the registry frozen. Zero production wiring (interpenetration.js precedent) — no
`src/` importer.

---

## §2 — Test-file layout

**Two files** (both match the mandated `tests/worldengine-lid-disruption*.test.js` pattern):

### 2.1 `tests/worldengine-lid-disruption.test.js` — the main suite (one file per the stagnant-structure precedent: all non-mock ACs in one place, one shared mesh build)

Harness idiom copied from `tests/worldengine-base-stagnantlid-structure.test.js`: module-scope
`MESH_1500 = buildIrregularSphere(1500, 2)` / `MESH_600 = buildIrregularSphere(600, 2)` (built once —
deterministic; carriers re-wrapped per run via `makeSphereField`), `SEEDS = [1,2,3,7,42]`,
`readFileSync` source greps. Arm's-length helpers local to the test (own `randDir`, own quantile/mean).
Test-owned synthetic field: `makeSyntheticField(seed)` = 8 centers drawn from `alea('test:fociField:'+seed)`
(a TEST namespace — the module never sees it), `field(dir) = max_p exp(−(ang/0.35)²)` — the same
squared-Gaussian form as the stagnant plume proximity, so the §0 foci bands transfer.

Describe blocks (exact names used in the §4 mapping):
- `lid-disruption — AC-0 spine conformance (condition-blind, three-free)`
- `lid-disruption — AC-DET determinism + namespace isolation`
- `lid-disruption — AC-STRUCT-CELLS (pinned bands, gate-3 discipline)`
- `lid-disruption — AC-STRUCT-FOCI (pinned bands, synthetic field)`
- `lid-disruption — AC-PROFILE-EQ (the one legitimate 1:1 extraction)`
- `lid-disruption — AC-CONSUMER-SEAM (V2-9a pluggability + V2-7 editor split)`
- `lid-disruption — AC-ZERO-WIRING`

AC-PROFILE-EQ mechanics: the test **re-inlines locally** both shipped expressions (copied character-
for-character from `stagnantLid.js` STEP-3 and `mixedInterior.js` STEP-7) as local functions; evaluates
the extracted exports against BOTH over a dense ρ grid (0 → 1.7 step 0.005, plus the exact boundary/
segment points {0, 0.75, 0.85, 0.95, 1.25, 1.3, 1.6}) with `toBe` (exact ===) at shipped default
amplitudes; asserts `PROFILE_DEFAULTS` amplitude values `===` `STAG_DEFAULTS` and `MIXED_DEFAULTS`
counterparts (both imported READ-ONLY); and greps the two shipped sources for the inline formula
signature (`(rho / 0.75)` etc.) so the premise "the copies still exist unmodified" fails loudly if a
future edit moves them. (Byte-untouchedness of the shipped files is the commit-point `git diff` gate,
not an in-test assertion.)

AC-CONSUMER-SEAM mechanics:
- (a) grooved [RESOLVED-BY-LENS: MF1]: (a1) pure-profile ring structure + trough-vs-flank ordering —
  over the ρ grid, exactly `GROOVE_RINGS` local minima with prominence ≥ 0.05 in (0.05, GROOVE_SUPPORT),
  minima within GROOVE_DR/4 of `R0 + k·DR`, consecutive-minima spacing = GROOVE_DR ± GROOVE_DR/4; AND for
  each ring k, `profileGroovedDiapir(rk) < profileGroovedDiapir(rk − GROOVE_DR/2)` AND
  `< profileGroovedDiapir(rk + GROOVE_DR/2)` — an ADJACENT-midpoint comparison (robust; verified margins
  ≥ 0.11). The earlier GLOBAL "ring troughs sit below ALL ring-midpoints" claim is FALSE on the §1.1
  profile: the dome slope lifts inner-ring troughs above outer midpoints — `profile(0.37) = 0.0735 >
  profile(0.77) = 0.0657` (a ring-1 node 0.02 in ρ off-centre already exceeds the rings-2/3 midpoint), and
  even the exact ring-1 minimum 0.0622 beats that midpoint by only 0.0035, so no node tolerance rescues the
  global form. (a2) plumbing — register `{ fn: profileGroovedDiapir, support: PROFILE_DEFAULTS.GROOVE_SUPPORT }`
  as typeId 2, take one focus, set `radii[c] = 0.5` (rad; ~130 covered nodes at N=1500) and `typeIds[c] = 2`,
  others `alive = 0`; eval; assert per-node `contrib[i] === Math.fround(profileGroovedDiapir(rho_i, P))`
  recomputed arm's-length (Float32Array store ⇒ fround the Float64 recompute; `rho_i` reconstructed with the
  identical `acos(clamp(−1,1,dot))/Rc`) and cover set === {ρ ≤ support}. The GLOBAL per-node ring/midpoint
  ordering clause is DROPPED (MF1): the per-node exact-equality proves the grooved profile renders through
  `evalFociDeformation`, (a1) discharges the contract's "ring count + spacing asserted on the ρ profile",
  and the fragile ring-1 mesh window (~3–8 nodes at radii=0.5/N=1500) is not relied on.
- (b) editor split: eval → base snapshot; `alive[j] = 0` → re-eval: bytes identical at every node
  outside focus j's support, changed inside (and = 0 where no other focus covers); then `typeIds[k] = 2`
  → re-eval: change confined to k's old∪new support. Zero draws during eval is pinned in the drawcount
  file (the streams cannot move because eval takes no rng at all).

### 2.2 `tests/worldengine-lid-disruption-drawcount.test.js` — the instrumented-alea draw-order pins

**Chosen mechanism: `vi.mock('alea')` counting wrapper** (isolated in its own file so the main suite
runs against the unmocked package):

```js
vi.mock('alea', async (importOriginal) => {
  const real = (await importOriginal()).default;
  const counts = (globalThis.__aleaDrawCounts = new Map());
  return { default: (seedStr) => {
    const rng = real(seedStr);
    counts.set(seedStr, counts.get(seedStr) ?? 0);
    return () => { counts.set(seedStr, counts.get(seedStr) + 1); return rng(); };
  } };
});
```

The wrapper delegates to the real alea in order (outputs stay byte-identical); the module is imported
normally (vi.mock hoists above imports). Assertions per seed {1,7,42} at N=1500:
- cells stream total `=== 1 + 4·out.cellCount` (pins the 2 reserved draws — any drop/add breaks it);
- foci stream total `=== 3·pool + 2·out.count` (pins the conditional-draw pattern; pool recomputed
  arm's-length from FOCI_DEFAULTS);
- every key the module created starts with `'disrupt:'` (dynamic namespace proof, complementing the
  static grep — test-owned keys are excluded by prefix bookkeeping);
- snapshot counts → run `evalFociDeformation` (+ a descriptor mutation + re-eval) → counts unchanged
  (**zero draws in eval**, the placement/eval split's determinism half).

---

## §3 — Build order

**Module-first with interleaved verification** (not strict red-green TDD). Justification: the
design-discovery benefit TDD buys is already banked — the bands (§0), draw orders (§1.5), and
signatures (§1) are fixed by calibration + this plan, so tests written first would just restate this
document; interleaving instead catches extraction/determinism bugs at the earliest seam while each
piece is still isolated. This matches the V2-2a/4b sibling build shape.

1. `lidDisruption.js` — profile library only (`PROFILE_DEFAULTS`, three profile fns, `DISRUPT_PROFILES`).
2. Main test file — AC-PROFILE-EQ block; run it (`npx vitest run tests/worldengine-lid-disruption.test.js`).
   The 1:1 extraction is locked before anything depends on it.
3. `lidDisruption.js` — `makeCellDisruption`, `makeFociDisruption`, `evalFociDeformation` + header docs.
4. Main test file — AC-0 + AC-DET + AC-ZERO-WIRING blocks; run.
5. Main test file — AC-STRUCT-CELLS + AC-STRUCT-FOCI with the §0.2 bands verbatim (including the
   perturbed-exclusion tests); run. A band failure here = STOP + re-probe (see §0 transfer-risk note).
6. Main test file — AC-CONSUMER-SEAM block; run.
7. `tests/worldengine-lid-disruption-drawcount.test.js`; run.
8. Final build-scope run: `npx vitest run tests/worldengine-lid-disruption.test.js tests/worldengine-lid-disruption-drawcount.test.js tests/planet-archetypes.test.js`
   — all green, archetypes drift guards untouched. **Nothing else is run** (V2-3 owns the repurposed
   guardrails mid-flight); write BUILD-NOTES.md (AC-0 conformance table + intent/non-goals record).

---

## §4 — Per-AC verification mapping (contract AC → exact tests)

| Contract AC | Test(s) (file · it-name) | Notes |
|---|---|---|
| **AC-0** | main · `imports only alea / simplex-noise / ./mathutil.js (three-free import allowlist)`; `reads no D-vector / E1 / taxonomy token (condition-blind grep)`; `DEFAULTS objects are frozen and match the seed writers' values` + step-8 `planet-archetypes.test.js` run | Named-consumer + DOES/UNLOCKS live in intent.md; BUILD-NOTES carries the conformance table |
| **AC-DET** | main · `same macroSeed ⇒ byte-identical cells outputs (two fresh runs, seeds 1/7/42)`; `same macroSeed ⇒ byte-identical foci + eval outputs (two fresh runs, seeds 1/7/42)`; `static greps: no Math.random / Date.now / convergence while; exactly one bounded BFS drain`; `draws only in 'disrupt:'; no shipped namespace literal; seedKey guard throws on foreign prefix`; `never writes any carrier channel` · drawcount · all four its | Byte equality via `Array.from(...).toEqual` on every returned typed array |
| **AC-STRUCT-CELLS** | main · `space-filling partition + count band + interiorness invariants, every seed` (C1, C-inv); `C2/C3: wall-node fraction and mean interiorness within pinned bands, every seed`; `C4/C5: pooled cell-size spread and min within pinned bands`; `anti-vacuous: every perturbed control falls OUTSIDE its band (K down/K up/warp up/belt x4)` | Bands §0.2 verbatim |
| **AC-STRUCT-FOCI** | main · `F1: accepted count within band at N=1500, every seed`; `F2: pooled coverage in band at BOTH densities; cross-density ratio in band (resolution invariance)`; `F3: radius law heavy-tailed — pooled u-hat median in band`; `F4: type split ~= TYPE_FRAC — pooled activeFrac in band`; `F5: field bias real — biased mean > null-control mean every seed/density, margins at N=1500`; `F6: small-pool grace — POOL:3 + accept-floor yields exactly 3 features, cleanly evaluated`; `anti-vacuous: every perturbed control falls OUTSIDE its band (pool x4 / pool /4 / skew=1 / typeFrac)` | Bands §0.2 verbatim; synthetic field per §2.1 |
| **AC-PROFILE-EQ** | main · `profileActiveCorona === stagnantLid STEP-3 arithmetic AND mixedInterior STEP-7 duplicate, exact FP, dense rho grid`; `profileInactiveCorona === both shipped copies, exact FP, dense rho grid`; `PROFILE_DEFAULTS amplitudes === STAG_DEFAULTS === MIXED_DEFAULTS values; shipped sources still contain the inline formulas` | Shipped files byte-untouched = commit-point `git diff` gate |
| **AC-CONSUMER-SEAM** | main · `(a) grooved profile: ring count + spacing + trough<flanks ordering on the rho profile (pure) [MF1]`; `(a) grooved profile renders through evalFociDeformation — per-node exact-equality (fround) + cover set (big-radius focus) [MF1]`; `(b) deactivate one focus + re-eval: change localized to its support, bytes elsewhere identical`; `(b) retype one focus to grooved + re-eval: change localized, draw streams untouched` · drawcount · `evalFociDeformation performs zero draws (placement/eval split)` | MF1: global ring/midpoint ordering dropped (false on the dome-sloped profile); replaced by adjacent-midpoint pure ordering + per-node plumbing |
| **AC-ZERO-WIRING** | main · `no src/ file (nor planet-lod-rivers.js) imports lidDisruption.js` (recursive walk over `src/**/*.js`, module itself exempt) | Diff-surface half = commit-point `git diff --stat` gate |
| **AC-ZERO-CLOBBER** | **NOT run during this build** (integration layer) — working-Claude's commit point: full `npx vitest run` at baseline (4 known failures: KnownObjects ×3, GalacticFeatures ×1; new files collected + nonzero counts per MF#3), guardrail quartet green, per-commit file lists = new module + tests + docs only | The build-scope archetypes run (step 8) is the only guardrail this workflow touches |

---

## §5 — Risks

| # | Risk | Disposition |
|---|---|---|
| 1 | **Band transfer** (R2): §0 bands calibrated on reference writers, asserted on the module's independent draws + synthetic field. | Margins built into every edge (§0.2); on failure STOP + re-probe against the module, deviation-log the resolution — never silently widen. Widest exposure: F1/F2 (field-dependent); mitigated by using the same squared-Gaussian field form. |
| 2 | **Draw-count fragility via simplex construction**: `createNoise3D` consumes draws at construction. | Isolated on Stream B (`…warp:`) so the pinned Stream-A/C totals are exact regardless of simplex internals. |
| 3 | **Concurrent V2-3 flip** editing guardrail/test files in-tree. | File-disjoint by contract; this build never runs or reads the repurposed guardrails; only archetypes (untouched by V2-3's flip scope) is run. Commit serialization is working-Claude's. |
| 4 | **Grooved profile ≠ #4.5 decision** (OQ-MAX-1, confirmed at greenlight): ships as synthetic capability proof. | No preset, no writer, no lab surface, not in DISRUPT_PROFILES defaults — registration is the test's act. |
| 5 | **Speculative-generality** (R1): interface may need revision at V2-7 scoping. | Zero wiring keeps revision non-breaking; no knobs beyond what the two seeds + two consumer seams need (the `alive` array is the minimal editor affordance, not a feature). |
| 6 | **mixedInterior third copy drift** (R4). | Untouched this increment; AC-PROFILE-EQ's source-grep pins fail loudly if the copies move; dedup recorded as post-V2-7 candidate. |

## Build deviations (vs GROUNDING §4 sketch — reviewed against contract designDecisions; none contradict)

| # | Deviation | Why |
|---|---|---|
| D1 | `SUPPORT:[1.6,1.3]` moved OUT of `FOCI_DEFAULTS` into the per-type registry entries (`DISRUPT_PROFILES[i].support`) + `PROFILE_DEFAULTS.GROOVE_SUPPORT`. | Support is a property of the profile shape (grooved needs its own); placement owns pool/radius, evaluation owns shape — cleaner family seam. |
| D2 | Foci descriptor gains `alive: Uint8Array(count)` (all 1). | AC-CONSUMER-SEAM(b) "deactivate a focus" needs a first-class switch; splicing arrays would shift indices and corrupt descriptor identity. |
| D3 | `CTRL_ACCEPT: 0.13` added to `FOCI_DEFAULTS`. | The `acceptWeightAt=null` control needs a defined constant (mirrors stagnant `CORONA_CTRL_ACCEPT`, matched to the real accept rate so the control is comparable). |
| D4 | Constructors THROW if `seedKey` doesn't start with `'disrupt:'`. | Makes namespace exclusivity structural, not merely a default — a caller can't accidentally draw in a shipped namespace. |
| D5 | Cell warp noise on a separate derived stream `seedKey + 'warp:' + seed` (sketch implied one stream). | Mirrors the shell seed's separate warp stream AND keeps the pinned Stream-A draw total exact (simplex construction draws land on Stream B). |
| D6 | Grooved profile parameterization finalized (`A_GROOVE_DOME/A_GROOVE/GROOVE_R0/GROOVE_DR/GROOVE_SIGMA/GROOVE_RINGS/GROOVE_SUPPORT`; dome + Gaussian ring troughs). | Sketch had no shape; this one makes ring count/spacing directly assertable (AC-CONSUMER-SEAM a). |
| D7 | AC-STRUCT-FOCI(e) small-pool config realized as `{POOL:3, POOL_REF_N:1500}` + `acceptWeightAt ≡ 1` (floor route), not a shrunk biased pool. | Calibration evidence (§0.1): stagnant `{CORONA_POOL:20}`/`{:30}` produce **0 features on seed 3** — the biased shrink is not graceful; GROUNDING 3b explicitly allows "small pool **or high floor**". |
