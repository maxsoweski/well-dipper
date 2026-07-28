# V2-6 BUILD-PLAN — Radius / Craters / Ice / Crystal (gravity-coherence root increment)

> ⚠ **SUPERSEDED IN PART (gravity-selfcompression-2026-07-28).** Passages below describing `g = g_c·(R/R_c)` record the CONSTANT-DENSITY law that was live when this document was written. Gravity is now `g = g_c·f(R)/f(R_c)` with `f` piecewise in absolute Earth radii (`R^(4/3)` below 1 R⊕, `R^1.70` above), applied to the **rocky class only**; gas, icy and carbon presets are unchanged. Byte-exactness at canonical is unchanged. Kept as written for audit trail — do not read it as current behaviour.


**Workstream:** `world-engine-v2-6-radius-craters-ice-crystal-2026-07-19` · **Plan written:** 2026-07-19
**Branch:** `feature/world-engine-production-L1` @ `3c9fd1c` · **Builds in the MAIN checkout** (`~/projects/well-dipper`, L1), concurrent with the atmo lane's Increment 2 in the sibling `well-dipper-atmo` tree (atmo owns F24–F31 GLSL sections + `climateE5:*`/`stormE:*` writers — symbol-disjoint from everything here; same-mega-file merge risk flagged in §9 risks).
**Binds to:** `contract.json` (13 ACs + 11 designDecisions BINDING; Max's three product rulings in `statusNote` are SETTLED) + `intent.md` + audit `~/briefings/driver-wiring-audit-2026-07-19.md` §3 Increment 1 + §2 footnotes 1–6, 13 + §5 appendix. Session-verified physics facts (`~/briefings/handoff-lane-A-overnight-ultracode-2026-07-19.md`) are TRUSTED, not re-derived.
**Mold:** `world-engine-v2-5-bombardment-2026-07-17/BUILD-PLAN.md` (own-channel byte discipline, calibration-first, MULTIPLY/normalize-at-reference house style).
**Anchoring convention:** SYMBOLS, never line numbers. Every anchor verified against live source 2026-07-19.
**Deviations from this plan are recorded in `§8 Build deviations`, never silent.**

---

## §0 — Global invariants (apply to EVERY slice)

**Byte regime (FENCE 1).** `HASHED_FIELDS = ['height','grainAngle','grainMag','regime','faultDensity']`. The 75-golden (`tests/v2-0-byte-identity.test.js`, fixtures `tests/fixtures/v2-0-carrier-goldens.json`) iterates `Object.keys(PRESET_ARCHETYPE)` × seeds `[1,2,3,7,42]`, hashes only those five fields, calls `writeBodyRelief` directly, and — CRITICALLY — its harness (`v2-0-carrier-golden.mjs`) builds the condition vector as `deriveConditionVector(fp, u, fp.radiusEarth)` — **canonical radius, always**. So the whole increment is byte-inert IF AND ONLY IF: (a) the new g-derivation is **bit-identical at canonical radius** (§1A ratio form guarantees it algebraically), (b) all crater work stays on the unhashed `craterField`, (c) no alea stream **consumed by any HASHED_FIELD writer** is reordered (the `'bombard:'` stream feeds only the unhashed `craterField`; its per-crater draw order changes 2→3 draws — declared churn per §1C(iv), byte-SAFE because no hashed consumer reads it; all other NEW draws open NEW namespaces). *(Lens L24: the earlier "no existing alea stream is reordered" wording was false as stated.)* Fixtures + byte anchors are **NEVER re-captured**; golden RED ⇒ fix the code; irreconcilable ⇒ ABORT.

**NAMED_BODY canonical vectors (FENCE 2).** `deriveConditionVector` keeps its EXACT return shape — **no new fields** (a widened vector would break the byte-identical-condition-vector clause). Only the `surfaceGravity` expression changes, and only off-canonical. `icenessOf` / `crystallizationPotential` / `radPerKm` are computed DOWNSTREAM of the vector, never stored in it.

**Guardrail quartet + oracle — ZERO test-table edits this increment.** Unlike V2-5 (18th preset), this increment adds **no preset, no dispatch rule, no `*Enabled` key, no `FEATURES` entry**. `worldengine-v2-3-dispatch-oracle.test.js`, `v2-0-slice-a-byte-safety.test.js`, `worldengine-e1-shadow-audit.test.js`, `worldengine-lid-router-audit.test.js`, `planet-archetypes.test.js` must all stay green **with zero edits**. The one new base module (`surfaceMaterial.js`, §1F) is auto-enumerated by the shadow-audit and passes by construction (it must contain ZERO `computeE1`/`e1Regime` substrings **including comments** — the V2-5 BS-m1 raw-`includes` trap).

**Declared legitimate churn (contract + hard-fence rule 9) — FULL inventory (Lens L18: the constants-only list was too narrow; enumerate by describe block).** ALL churn lives in ONE file, `tests/worldengine-v2-5-bombardment.test.js`, and every restated assertion carries the **replacing physics derivation in a test comment** (§1C laws):
- constants: `K_GD` (import + asserts deleted), `N_CRATERS_REF`, `D_MIN_RAD`/`D_MAX_RAD` as draw bounds → km-law asserts;
- **gate semantics** (these are FLIPS, not restatements): "non-target worlds get an all-zero craterField" uses Rocky (T_eq 288, P 1 bar) — under the continuous exposure-age physics Rocky legitimately schedules a small nonzero population (t_exp ≈ 0.1 Ga); restated to a Jovian/deep-envelope non-target + a Rocky "sparse-by-erosion" assert. Likewise "a non-target condition schedules nothing" (P=1.0 bar, T_eq 288 fixture) — restated with a deep-envelope fixture (P > P_SURF_MAX);
- **fixture widening**: `moonCond` gains `radiusEarth: 0.38` (the km-space schedule reads `cond.radiusEarth`; without it R_km is NaN) — canonical Moon/Mercury value, derivation in the fixture comment;
- `forEachCrater` stream contract: 2 draws/crater → 3 draws/stamped-crater, oldest-first yield (§1C(iv));
- import-allowlist: "ONLY ./mathutil.js and alea" → `['./baseStep.js','./mathutil.js','./surfaceMaterial.js','alea']` (§1B, Lens L2);
- AC-POWERLAW `fitDiff` bins over `D_MIN_RAD`/`D_MAX_RAD` (test :`fitDiff`) → re-binned over the km-band converted at the fixture's R.

`craterField` is unhashed by design. **Nothing else in the test tree is churn — named explicitly NOT-churn and gated green with ZERO edits: `tests/worldengine-v2-5-preset-composite.test.js`** (Jovian craterField-all-zero + composites-null — protected by the §1C(iii) deep-envelope clause, Lens L1) **and `tests/worldengine-base-storm-e.test.js`** (its `toContain('mulberry32')` envelope pin — protected by the §1H retention rule, Lens L4).

**Atmo fence (FENCE 4).** No edit to F24–F31 GLSL sections (lab GLSL `── F24 zonal belts` … `── F31 REGIME DISPATCH` block and the writer block starting `── F24 zonal belts — gas-giant banding`), `climate-e5.js`, `storm-e.js`, `emission-e.js`, or any `climateE5:*`/`stormE:*` stream. Our lab edits (Stage-6 albedo, `_facetClass` site, `newPlanet`, `drawPresetRadius`) all sit OUTSIDE those sections — verify by symbol before every commit. The storm-placement mulberry32 closures near `resolveStormE` are atmo-owned: mulberry32 is retired ONLY at `drawPresetRadius`.

**Other standing fences.** `shellRelief.js` AC-0 radius grep-ban untouched (FENCE 5 — lift protocol is Increment 5's). Legacy F2/F3 `craterCombiner`/`ejectaCombiner`/`uCrater*`/`uEjecta*` + lab `craterDensity`/`cratersEnabled` keys untouched. Ejecta stays height-only (Max ruling #1). NOT-OURS dirty files (`src/auto/CameraChoreographer.js`, `src/debug/LabMode.js`, loose `*.png`/qa strays) never committed/stashed/cleaned — `git add` EXPLICIT paths only; verify `git show --stat` per commit.

**Test discipline.** `npx vitest run` FROM `/home/ax/projects/well-dipper` ONLY. Pre-existing baseline (NOT ours): 4 failed (KnownObjects ×3 + GalacticFeatures ×1) + ~5–7 collection-error files. Anything beyond baseline is ours. Calibration is pure `node` `.mjs` (no `claude -p`, no dev servers, no localhost probes). Live ACs (`AC-LAB-LEGIBLE`, `AC-RADIUS-AB`, `AC-REROLL`) get **code-side enablement only** here — the browser drive is working-Claude's, post-build.

**RNG discipline.** All new entropy = `alea` with fresh namespaces (`'bombard:'` extended draws; `'draw:radius:'`, `'draw:macro:'`, `'draw:detail:'`). No `Math.random`/`Date.now` in any writer (lab UI button entropy for `worldSeed` itself follows the existing `rerollRadius()` idiom). `rivers-terrain-lab.html`'s condition-less caller is pre-existing backlog — touched ONLY if a slice edits that caller anyway (none plans to).

---

## §1 — Per-AC design: the laws, in implementation form

### 1A — Gravity coherence (AC-GCOHERE; root fix)

**Site:** `body-condition-vector.js deriveConditionVector`, the `surfaceGravity:` field. Today: `derived?.surfaceGravity ?? bodySurfaceGravity(fp)` — canonical-preset g, drawn-radius-blind (session-verified).

**Law (normalized-at-canonical ratio form — the ONLY form that satisfies both AC-GCOHERE clauses at once):**

```
R_c   = fp.radiusEarth ?? 1.0                                  // canonical preset radius
g_c   = derived?.surfaceGravity ?? bodySurfaceGravity(fp)      // today's expression, unchanged
R     = radiusEarth ?? R_c                                     // the drawn radius (3rd arg, already plumbed)
surfaceGravity = g_c * (R / R_c)
```

**Why this IS "M = (ρ/ρ⊕)·R³ per composition class":** the preset's implied mean density ρ/ρ⊕ = M_c/R_c³ is the composition-class density the preset embodies. M_derived(R) = M_c·(R/R_c)³ = (ρ/ρ⊕)·R³, and g = M_derived/R² = g_c·(R/R_c) — algebraically identical. (The declarative `composition.density` scalar is NOT the mass source — it is inconsistent with M_c/R_c³ on several presets, e.g. Moon/Mercury declares 4.5 while M/R³ implies ≈4.0 relative-Earth-normalized; the calibrator prints the cross-check table, documented, not "fixed".)

**Byte-stability proof:** every golden/NAMED_BODY/headless path passes `R === R_c` (harness passes `fp.radiusEarth`; `drawPresetRadius` returns canonical for NAMED_BODY). `R/R_c = 1.0` exactly in float64 (x/x for finite nonzero x), and `g_c * 1.0 === g_c` bit-exact. No fixture, no snapshot capture — the test asserts the NEW expression `===` the LEGACY expression at canonical R for all `Object.keys(DRIVER_PRESETS)`.

**`e1Regime.js massEarthOf` resolves automatically:** `massEarthOf(cv) = g·d²` = g_c·(R/R_c)·R² = M_c·(R/R_c)³ = M_derived — exact round-trip, zero edit to `e1Regime.js`. Test asserts `cv.surfaceGravity * R * R === M_c * (R/R_c)**3` within float64 ulp across an R sweep × all presets.

**Known consequence (expected physics, surfaced not suppressed):** for DRAWN (non-canonical) radii, `computeE1` routing can shift (L via `gMod`, Φ via mass) — that is the point of coherence. Goldens (canonical) unaffected. `rawTidalIoRatio`'s R⁵ fallback formula still reads the preset radius inside `deriveBodyScalars` — a declared NON-GOAL this increment (audit's cross-cutting table names only g; recorded in BUILD-NOTES).

### 1B — `radPerKm` (shared km→angular derivation)

**Site:** `src/worldengine/base/baseStep.js`, beside `deriveBodyScalars` / the thin-helper block:

```
export const KM_PER_EARTH_RADIUS = 6371;
export function radPerKm(radiusEarth) { return 1 / (KM_PER_EARTH_RADIUS * Math.max(radiusEarth ?? 1.0, 1e-6)); }
```

Angular size of a D_km feature: `δ = D_km * radPerKm(R)` ⇒ ∝ 1/R at fixed D_km. Pure, byte-inert (new export, nothing existing reads it). Consumed by `bombardment.js` (which gains `import { radPerKm } from './baseStep.js'`).

**Import-allowlist restatement (Lens L2 — the S2 slice itself adds TWO imports, so restating "+baseStep only" would go RED in the slice that writes it).** The v2-5 allowlist assert is restated ONCE, in S2, as exactly `['./baseStep.js','./mathutil.js','./surfaceMaterial.js','alea']` with a derivation note per addition: `baseStep` = pure scalar `radPerKm` (not dispatch); `surfaceMaterial` = condition-pure erosion/iceness scalars (not dispatch — §1E; imports NOTHING itself, so no transitive smuggling). Neither is a dispatch/regime module, so shadow-audit is untouched.

### 1C — Bombardment rewrite (AC-GCOUNT, AC-RADIUS-LAW, AC-EQUILIB; audit footnotes 1–3, 5–6)

All in `src/worldengine/base/bombardment.js`. Constants below are **calibration-priors**; `calibration/crater-sfd-km.mjs` + `crater-obliteration.mjs` pin final values BEFORE the writer is finalized (adjudicable per §6).

**(i) K_GD REMOVED (footnote 1, AC-GCOUNT).** The constant, its factor in `craterSchedule`, and its test import all deleted — count is g-independent by physics (primary impact flux does not depend on target surface gravity). `K_GS = 0.17` and the form `sizeMul = (G_REF/g)^K_GS` are kept EXACTLY (correct π-group scaling; grep-verifiable). Grep gate: zero `K_GD` occurrences in `src/`.

**(ii) km-space SFD (footnote 2, AC-RADIUS-LAW).** Diameters drawn in **km**, converted at stamp time:

```
R_km      = KM_PER_EARTH_RADIUS * cond.radiusEarth
D_HI_KM   = C_BASIN * R_km                        // C_BASIN ∈ [0.7,1.4], prior 1.0 — SPA/disruption limit
D_ATMO_KM = C_ATMO_KM * P^P_ATMO_EXP              // graded atmo floor; P = atmosphere?.pressure ?? 0 (bar)
            // C_ATMO_KM ≈ 0.16, P_ATMO_EXP = 0.65 — anchored: Venus 92 bar → ≈3 km; Mars 0.01 bar → ≈8 m
D_LO_KM   = max(D_SFD_MIN_KM, D_ATMO_KM)          // D_SFD_MIN_KM: prior 1 km (Lens L13 — a SCREENING anchor,
            // not a stamp floor: the mesh floor governs stamping; 4 km made the graded atmo floor inert on
            // every atmospheric preset since 0.16·P^0.65 > 4 only above ~142 bar. At 1 km: Venus D_LO=3 km
            // ⇒ screen≈0.11 (LIVE wiring); Mars 8 m ⇒ screen=1. Calibrator prints screen per preset and the
            // km-space tests assert screen<1 for a Venus-class fixture, ≈1 for Mars-class — pressure provably
            // drives, closing the feedback_wire-relevant-drivers-before-uat failure mode.)
D_km      = boundedPareto(u; D_LO_KM*sizeMul, min(D_HI_KM*sizeMul, C_BASIN*R_km), B_SFD=2.0)
            // Lens L14. B_SFD kept exactly. sizeMul applied to the EDGES before the inverse-CDF draw, upper edge
            // capped at C_BASIN·R_km (the disruption limit is a property of the TARGET, not the impactor
            // SFD; π-group scaling shifts the crater band, the physical ceiling stays — derivation recorded
            // in the test comment). This also makes "km median anchored at the low edge" exact as written.
δ         = D_km * radPerKm(cond.radiusEarth)     // angular size ∝ 1/R at fixed D_km
```

`CRATER_ATMO_MAX` (binary) is **retired**; the graded floor replaces it. Mesh stamp floor `MESH_FLOOR_RAD = 3·meanEdgeAngle(lab N)` (≈0.053–0.058 rad; calibrator pins the exact number and prints node spans): craters with `δ < MESH_FLOOR_RAD` are **never stamped discretely** — their SFD mass folds into `regolithRoughness` analytically (restructured in (iii), Lens L5/L11/L20).

**(iii) Count law + chronology (footnotes 2–3).**

```
chron(t)   = A_NEU·(exp(LAMBDA_NEU·t) − 1) + B_NEU·t      // published Neukum lunar chronology SHAPE
             A_NEU = 5.44e-14, LAMBDA_NEU = 6.93 /Ga, B_NEU = 8.38e-4  (t in Ga)
chronN(t)  = chron(t)/chron(AGE_REF)                       // normalized at AGE_REF = 4.0 (reproduces the
                                                           // audit's ~30× production 4.0→4.5 Ga: ratio ≈ 31)
t_exp      = min(age, T_RESURF_TIDAL/max(td, EPS_TD), T_RESURF_ERODE/max(erosion, EPS_ER))
             // footnote 5: binary tidal gate → continuous exposure age, t_resurf ∝ 1/tidalHeat
             // (prior T_RESURF_TIDAL = 0.7 Ga·Io-ratio: td=0.15 → 4.7 Ga full exposure; Europa td≈137 →
             //  ~5 Myr → ≈0 craters BY PHYSICS, not gate)
             // erosion term: consumes the SAME condition-derived erosion scalar 1F builds (§1F) —
             // required completion once the binary airless gate is retired, else Rocky/Ocean/Titan boot
             // cratered like the Moon (real Earth: crater retention age ~0.1 Ga). ADJUDICABLE, surfaced
             // in BUILD-NOTES with this derivation; the audit's own footnote-13 erosion scalar is the input.
N_analytic = F_REF · R² · chronN(t_exp) · screen           // CLOSED-FORM drawn-population count — never looped
screen     = (D_SFD_MIN_KM / D_LO_KM)^B_SFD                // atmo screening: fewer craters exist above a
                                                           // raised floor; = 1 exactly when floor = anchor
D_FLOOR_KM = MESH_FLOOR_RAD / radPerKm(R)                  // the angular mesh floor in km (∝ R)
P_STAMP    = min(1, (D_LO_KM·sizeMul / D_FLOOR_KM)^B_SFD)  // bounded-Pareto tail fraction above the mesh floor
N_stamp    = round(N_analytic · P_STAMP)                   // the ONLY loop count — stamps drawn from the SFD
                                                           // TRUNCATED to [max(D_LO·sizeMul, D_FLOOR), D_HI]
assert N_stamp ≤ N_STAMP_SAFETY (prior 5000)               // a SAFETY assert, never a binding min()
```

**Restructure (Lens L5/L11/L20 — the v1 plan's `min(N_DRAW_CAP, …)` loop was mutually inconsistent with the AC-POPSWEEP [10%,80%] coverage gate: at the stated priors the drawn coverage capped out near ~5% with the cap saturated, the cap flattened the AC-RADIUS-LAW sweep, and stamped fractions were ~1e-3 of draws).** Discrete stamps are drawn ONLY above the mesh floor; the sub-floor SFD mass (closed-form bounded-Pareto integral over [D_LO·sizeMul, D_FLOOR]) folds into `regolithRoughness` analytically. Consequences, all load-bearing: (1) `N_analytic` is exact and un-capped ⇒ the R² count law is asserted strictly and analytically; (2) `N_stamp` is R-invariant by the scale-free theorem (R² · (1/R)² tail) — tens-to-hundreds by construction, so the stamping loop is bounded without any behavior-bending cap; (3) coverage is computed **closed-form on the drawn population** (`coverage = N_analytic · E[(δ/2)²]/4`, `E[D²] = 2L²ln(H/L)/(1−(L/H)²)` for B=2) and `F_REF` is calibrated against the [10,80]% gate as an EXPLICIT constraint — `crater-sfd-km.mjs` runs this closed-form pre-check for Moon/Mercury + the R sweep **BEFORE the writer is built** (S2 step 0). Stamped-bowl coverage may legitimately exceed 100% at old ages (equilibrium palimpsest) — that is AC-EQUILIB's obliteration domain, not a gate violation.

`isImpactSurface` reduces to the **cold clause** (`T_eq < CRATER_T_MAX = 450` — molten worlds are not impact surfaces) **+ a deep-envelope surface-existence clause** (Lens L1/L17 — BLOCKER fold: cold alone makes Jovian/Saturnian/Neptunian impact surfaces, craters gas giants live, and REDs `worldengine-v2-5-preset-composite.test.js`'s Jovian null-composite pins, which are outside declared churn): `P < P_SURF_MAX` (prior **200 bar** — pure condition scalar, above Venus's 92 bar, far below the giants' 1000-bar H2-He envelopes; physics: impactors ablate/airburst in a deep envelope and there is no reachable solid surface — the preset comments' own "the envelope IS the surface"). Chosen over an `atmosphere.composition === 'h2-he'` string read to keep the module purely scalar under the AC-0 grep discipline; recorded as an adjudicable prior in §4. + degeneracy guards (`D_LO_KM·sizeMul < D_HI_KM`, `t_exp > 0`). `CRATER_TIDAL_MAX`/`CRATER_ATMO_MAX` retired with their physics now continuous. **Gate: `worldengine-v2-5-preset-composite.test.js` stays green with ZERO edits — named in the S2 gate list.**

**AC-RADIUS-LAW metrics are measured on the DRAWN population** (analytic + the stamped stream): median angular size = median(D_km)·radPerKm ∝ 1/R exactly (the km median is anchored at the low band edge on airless worlds); count = `N_analytic` ∝ R² — asserted on the **pre-round analytic value** (strict, no round() ties, no cap flattening; Lens L6/L15); bowl-coverage fraction ∝ ln(D_HI/D_LO) — invariant up to the log drift, which IS the contract's "within tolerance" band (the closed-form pre-check pins the band; the test asserts inside it).

**Honesty note (feeds §9 risk + the live A/B protocol — REVISED at fold; the v1 "matched features shrink" escape is gone under the L5 restructure and was replaced with the physically true protocol):** for a B=2 scale-free SFD, the stamped ensemble above a fixed angular mesh floor is angular-scale-invariant, and under the truncated draw BOTH stamped band edges scale ∝ R — so at matched GLOBAL view the two bodies of an A/B pair look statistically alike **by real physics** (crater-equilibrium self-similarity: a bigger planet has more craters of each km size, each angularly smaller — the effects cancel above any fixed angular resolution). The 1/R + R² relationship is REAL and shows in exactly two honest places: (1) the harness-printed drawn metrics (analytic count ∝ R², km-median at the fixed low edge ⇒ angular median ∝ 1/R), and (2) live screenshots at **matched SURFACE-KM footprint** — zoom both bodies to the same km field of view and the large body shows proportionally smaller, more numerous craters, exactly as reality does. The AC-RADIUS-AB evidence protocol is therefore: paired same-worldSeed, harness metrics + matched-km-footprint screenshots; a global-disk comparison is EXPECTED to read scale-invariant and must not be scored as a wiring failure.

**(iv) Per-crater age + obliteration stamping (footnote 3, AC-EQUILIB).** Fixed per-STAMPED-crater draw order inside `alea('bombard:'+macroSeed)`: `u_centre, u_size, u_age` (the restated `forEachCrater` contract — 3 draws per stamped crater from the truncated band; sub-floor mass never draws, it is analytic — recorded in the test with this derivation). Formation time distributed ∝ production: solve `chron(t_i) = u_age · chron(t_exp)` by deterministic bisection (fixed 48 iterations — pure, convergent, no tolerance branch; N_stamp is now tens–hundreds so cost is trivial). `forEachCrater` collects `(centre, D_km, t_i)` triples then yields them **oldest-first** (sort by `t_i` desc, stable tie-break on draw index) — the restated stream contract.

Stamping per crater (in `writeBombardment`, same BFS idiom as today):
- **bowl interior** (`s < 0.5·δ`, floor+wall zones): `cf[j] = profile(s, δ, ε_i)` — **RESET** (obliterates all older topography at that node, including older rims);
- **rim/ejecta** (`s ≥ 0.5·δ`): `cf[j] += profile(s, δ, ε_i)` — accumulate.

This IS N_ret = N_eq·(1−exp(−N_prod/N_eq)) as an emergent property (verified statistically by the age sweep, never coded as a formula): old surfaces plateau, young are visibly sparse — obliteration does the capping, not tanh. `CRATER_SAT_N` tanh survives ONLY as the final safety clamp (unchanged line).

**"Thresholdable" defined operationally (Lens L12 — the v1 claim "every retained floor stays EXACTLY at −A(δ)·(1−ε)+dome" was false two ways: the surviving tanh clamp `0.5·tanh(cf/0.5)` is strictly contracting on every nonzero value (a −0.18 floor reads −0.1727 post-clamp), and younger rims/ejecta legitimately `+=` onto older floors they don't obliterate — real palimpsest physics, not a bug):**
- the float-EXACT floor assert runs on the **pre-clamp field** (`writeBombardment` exposes it — threshold before the tanh pass, or export the pre-clamp accessor for tests) and ONLY for retained craters the age-ordered stamp loop tags as **zero-younger-overlap** (the loop knows every younger stamp's footprint — tagging is free);
- overlapped retained floors get a **band/ordering claim** (tanh is monotone, so ordering and band membership survive the clamp; younger-rim overprint deviates the value, never the ordering);
- the epoch-editor guarantee the AC protects is exactly this pair: clean floors exact pre-clamp, all floors order-thresholdable post-clamp.

### 1D — Ice relaxation (AC-RELAX; footnote 4)

In `bombardment.js`: `craterProfile` splits into its existing zone arithmetic + a relaxation transform (exported for unit tests):

```
eta(T)     = ETA_M · exp((QSTAR/RGAS)·(1/T − 1/T_MELT))    // Arrhenius: ETA_M = 1e14 Pa·s @ 273 K,
                                                            // QSTAR = 60e3 J/mol, RGAS = 8.314, T_MELT = 273
T_rel      = T_eq + DT_TIDAL · td/(1+td)                    // bounded tidal warming (prior DT_TIDAL = 120 K)
tau_Ga(D)  = 4π·eta(T_rel) / (RHO_ICE·g_SI·D_m) / SEC_PER_GA   // RHO_ICE = 917, g_SI = 9.81·g, D_m = D_km·1e3
eps_bowl   = iceness · (1 − exp(−t_i / tau_Ga(D)))          // per-crater, its own drawn age t_i
eps_rim    = iceness · (1 − exp(−t_i / (tau_Ga(D) · (1/RIM_W)^P_RIM)))   // P_RIM = 2 — short-λ rims persist
            // (palimpsest: dome floors, crisp rims). Lens L16: P_RIM=2 is the CONTRACT-PINNED phenomenological
            // exponent, NOT derived from τ∝1/λ (which gives only p=1 = the bowl law itself); the ×100 rim
            // persistence is motivated by elastic/lithospheric support steepening the effective exponent at
            // short wavelength — the exported transform's derivation comment says exactly this, no false cite.
relaxed profile: floor/wall zones × (1−eps_bowl)  +  dome term eps_bowl·A·DOME_FRAC·(1−(s/floorEdge)²)
                 rim/ejecta zones × (1−eps_rim)
```

**Required properties, all provable in float64:** at (T_eq=60 K, td≈0): the Arrhenius exponent ≈ +93.9 ⇒ t/τ < 1e-30 ⇒ `1−exp(−x) === 0.0` exactly ⇒ the relaxed profile is **bit-identical** to the unrelaxed one — "Frozen profile bytes unchanged by relaxation at 60 K" (the AC's literal observable; note Frozen's craterField still changes vs TODAY from the schedule rewrite — unhashed, declared churn). Enceladus-class (T_eq ~75–110 K + large td ⇒ T_rel warm): ε large. ∂ε/∂D > 0 (τ ∝ 1/D). Dome-floor + P_RIM=2 rim-persistence terms present by construction. `iceness` gating (from §1E) keeps rock honest: iceness=0 ⇒ ε≡0 exactly (granite does not flow at these temps/timescales).

### 1E — Iceness material scalar + albedo uniform (the Frozen pairing)

**New module `src/worldengine/base/surfaceMaterial.js`** (pure, condition-scalars-only, THREE-free, zero `computeE1`/`e1Regime` substrings incl. comments):

```
icenessOf(cond) = clamp01( 1 − smoothstep(DENS_ICE_HI, DENS_ROCK_LO, density) )      // low mean density ⇒ icy
                  · max(smoothstep(VOL_LO, VOL_HI, volatileFraction), ICE_VOL_FLOOR)  // volatile budget
                  · (1 − smoothstep(T_ICE_LO, T_ICE_HI, T_eq))                        // cold gate (~200→273 K)
```

Priors: DENS_ICE_HI≈2.0, DENS_ROCK_LO≈3.5, VOL_LO≈0.1, VOL_HI≈0.5, ICE_VOL_FLOOR≈0.25, T_ICE_LO≈200, T_ICE_HI≈273 — `calibration/surface-material.mjs` prints the 18-preset table and pins them so **Frozen/Europa read high, Moon/Mercury/Mars ≈0, Crystal reads nonzero-LOW** (Lens L7: Crystal's density 3.0 ⇒ density term ≈0.26 and vf 0.02 caps the volatile term at ICE_VOL_FLOOR ⇒ iceness ≈0.065; no prior movement makes it "high" without breaking Moon/Mars≈0 or gutting the volatile term. Correct by design — Crystal's Frozen-pairing driver is `crystallizationPotential`, not iceness; reasoning recorded in the calibrator table).

**Module purity (Lens L3/L10 — the v1 plan created an ESM cycle `bombardment ⇄ surfaceMaterial`):** `surfaceMaterial.js` **imports NOTHING** (condition-pure scalars only). The dependency is strictly one-way: `bombardment.js` imports `erosionOf`/`icenessOf` FROM `surfaceMaterial.js`; anything in `surfaceMaterial.js` that needs schedule output takes it as an **explicit parameter** (§1F `crystallizationPotential(cond, schedule)`; `deriveSurfaceMaterial(cond, schedule)`) — the composition site computes `craterSchedule(cond)` once and passes it. No cycle, no TDZ hazard, no top-level cross-module reads to police.

**Consumers (AC-0 ch.2 named-consumer law, documented in BUILD-NOTES + seam comments):**
1. `bombardment.js` relaxation gate (ε × iceness, §1D) — imports `icenessOf` from `./surfaceMaterial.js`.
2. **Render-side albedo uniform** `uIcenessMix` (+ `uIcenessAlbedo` color) added in `planet-lod-uniforms.js` beside the F22/F23 frost block (`uFrostAlbedo` is the exact driven-albedo precedent); consumed in the lab fragment **Stage 6 surface albedo** (`── Stage 6: surface albedo / material` — ground-owned, BEFORE the F24 gas sections): base rock ramp mixed toward the ice ramp by `uIcenessMix`, pre-posterize (the F22/F23 mixing idiom). Driven per-preset in `applyDrivers` from `icenessOf(_cond)` — this is the material answer to "Frozen reads rock-brown".
3. `writeBodyRelief` gains `relief.surfaceMaterial = deriveSurfaceMaterial(cond, schedule)` — a **return-object field** (the `relief.figure`/`deriveFigureDescriptor` precedent: pure fn, no carrier array, no RNG, populated on every path, byte-inert). **Phased shape (Lens L8 — v1 pinned a 3-key shape in S3 that S4 would silently change):** S3 ships `{ iceness, regolithRoughness }` and the S3 test asserts exactly those keys; `crystallizationPotential` **joins the channel in S4** and S4 restates the shape assert — declared here in-plan, NOT a deviation. The "own NEW unhashed channel" for downstream/headless consumers.

### 1F — Crystal carve-out (AC-CRYSTAL; footnote 13) — **PARTIALLY CARVED TO ADJUDICATION (Lens L9, BLOCKER)**

Also in `surfaceMaterial.js` (schedule passed as a PARAMETER — one-way imports per §1E; still "downstream driver like fungal"):

```
airlessness      = 1 − smoothstep(0, P_AIR_REF, pressure)                   // P_AIR_REF ≈ 0.1 bar; null atmo ⇒ 1
erosion          = clamp01( smoothstep(0, P_ER_REF, pressure) · max(waterWindow(T_eq), DRY_ER_FLOOR) )
                   // waterWindow = smoothstep(248,273,T)·(1−smoothstep(373,398,T)) — the deriveBodyScalars
                   // constants, restated here from cond scalars only (cited, not imported — keeps the module
                   // condition-pure); rain+pressure work the surface (footnote 13: erosion ← pressure+rainFactor)
resurfacingRate  = clamp01( K_RES_TD · td/(1+td) + K_RES_TH · clamp01(1 − age/AGE_RES_REF) )   // tidal/thermal
bombardmentIntensity = clamp01( schedule.nAnalytic / N_BOMB_REF )           // schedule = craterSchedule(cond),
                                                                            // passed in by the composition site
crystallizationPotential(cond, schedule) = airlessness · (1−erosion) · (1−resurfacingRate) · (1−bombardmentIntensity)
```

Continuous on [0,1]; pure function of condition scalars + the passed schedule — grep-clean of `.label`/archetype/`geodynamicRegime`/`PRESET_ARCHETYPE` (AC-CRYSTAL grep audit).

**THE CONTRADICTION (verified against live preset data, not calibratable away):** the presets are condition-scalar DEGENERATE where the old boolean discriminated. Crystal (R 0.8, airless, td≈0, T_eq 150, age default 4.5) vs Moon/Mercury (R 0.38, airless, td≈0, T_eq 235, age 4.5) vs Frozen (R 0.5, same class): all derive airlessness=1, erosion=0 (pressure-gated), identical resurfacingRate — the ONLY discriminator is (1−bombardmentIntensity), and the new count law N ∝ R²·chronN(age) gives Crystal **4.4× MORE** craters than Moon/Mercury (R² 0.64 vs 0.144) and ~2.6× Frozen. clamp01 preserves order ⇒ `crystallizationPotential(Crystal) ≤ Moon/Mercury/Frozen` for EVERY `N_BOMB_REF` — Crystal cannot read ≥ CRYSTAL_HI while they read ≤ CRYSTAL_LO. Second counterexample: Carbon (airless, T_eq 600 ⇒ not an impact surface ⇒ bombardmentIntensity 0, td≈0, derived erosion 0) derives potential ≈ max but is old-boolean-false. The old boolean read STIPULATED `surfaceHistory` data (Crystal bombardment 0.1 vs Frozen 0.85 vs Moon 0.9) with NO basis in the condition scalars; honest derivation INVERTS the ranking. The obvious repair — give Crystal distinguishing canonical data (e.g. young age) — is FENCE-1/2-adjacent: Crystal is in `PRESET_ARCHETYPE`, its vector feeds hashed goldens. **This is a contract-AC vs physics contradiction; per Lens L9 it is surfaced for adjudication, NOT built around.**

**What S4 BUILDS (all still contract work):** the scalar + its sub-scalars in `surfaceMaterial.js`; `calibration/crystal-scalar.mjs` printing the full 18-preset table (the DECISION ARTIFACT — old-boolean column beside the derived column, flips highlighted); purity grep; continuity-on-[0,1] tests; wiring proof (explicit-parameter construction + a radiusEarth-perturbation spy, §2 S4); the S4 channel-shape restatement (§1E); the default-bake facet-weight-0 check (Max ruling #2 — asserted regardless).

**What S4 does NOT do (adjudication gate — Max, morning report):** (1) does NOT pin CRYSTAL_HI/CRYSTAL_LO extreme-agreement thresholds — mathematically unsatisfiable; (2) does NOT flip the lab `_facetClass` block to `crystallizationPotential` — with the honest scalar Crystal's facets would turn OFF live (the one archetype whose identity IS facets): a product regression Max hasn't ruled on. The boolean `_facetClass` path stays live and untouched this build. **AC-CRYSTAL closes its purity/continuity/wiring/default-bake clauses; its extreme-agreement clause is `deferred-to-adjudication`** with three recorded options: (a) restate extreme agreement as an ordering/threshold claim the derived scalars can satisfy, recording which presets flip vs the old boolean; (b) add a physically-motivated discriminating term (none found — T_eq/density/volatileFraction all fail the Moon/Mercury/Frozen/Carbon split; candidates welcome at adjudication); (c) amend Crystal's canonical data with a golden-byte impact proof (ABORT-adjacent under FENCE 1/2; not recommended). Recorded in §8 + BUILD-NOTES + the morning report.

### 1G — Population calibration harness (AC-POPSWEEP)

`docs/WORKSTREAMS/world-engine-v2-6-radius-craters-ice-crystal-2026-07-19/calibration/population-sweep.mjs`, extending the committed `crater-*.mjs` pattern (v2-5 calibration dir). Per archetype preset × N≈64 seeds: draw R **via the SHARED importable draw law** (Lens L21: `drawPresetRadius`'s formula + the `NAMED_BODY` set are extracted in S5 into `driver-presets.js` exports consumed by BOTH the lab and this harness — restating them here would drift silently; the harness grep-asserts the lab imports the shared symbols) → `deriveConditionVector(fp, u, R_drawn)` → schedule; **full stamped carriers (resolving N≈10k) ONLY for crater-relevant archetypes — schedule-only for gas/ice-giant/deep-envelope rows** (Lens L22: they contribute nothing to crater gates and were ~⅓ of runtime). Gates:
- **physics invariants every seed:** `surfaceGravity === g_c·(R/R_c)` bit-check; massEarthOf round-trip; no NaN/flat/degenerate fields;
- **bowl coverage ∈ [10%, 80%] for ≥90% of MATURE impact-surface seeds** — metric and denominator PINNED (Lens L5/L20): the metric is the **closed-form drawn-population coverage** of §1C(iii) (`N_analytic·E[(δ/2)²]/4`, the quantity `F_REF` is calibrated against); the gate denominator "impact-surface seed" means `isImpactSurface(cond) && screen ≥ SCREEN_MATURE && t_exp ≥ K_EXP_MATURE·age` (priors 0.9 and 0.25 — airless, substantially-exposed surfaces; Rocky/Ocean/Titan/Eyeball-class seeds with erosion-shortened t_exp have coverage ≈0 BY the exposure physics and are reported in a separate "erosion-suppressed" row, not counted against the band). This operational definition is recorded here + BUILD-NOTES + §8 (the contract phrase needed one; without it the ≥90% clause fails structurally);
- **nonzero metric variance + ≥k distinct E1 regimes per archetype** — `k` and the per-archetype allow-list are PINNED from the first calibration run (Lens L23: printed table committed with the JSON summary, values recorded in BUILD-NOTES, then **hard-coded in population-sweep.mjs** so reruns are falsifiable — no unpinned "where physics allows" escape hatch). The harness MAY import `computeE1` (outside `src/worldengine/base`, invisible to the shadow-audit);
- **goldens stable** (vitest byte suite green at the same commit);
- **runtime budget: < 10 min single-threaded** (Lens L22), per-preset wall time printed in the JSON summary — a blowup is a detectable deviation;
- machine-readable JSON summary + nonzero exit on any gate failure. Acceptance judges the N-seed population, never a boot state (INTENT FRAME "no defaults"). The Moon/Mercury boot's retained count + the calibrated envelope for AC-LAB-LEGIBLE are printed here and recorded in BUILD-NOTES.

### 1H — No-default reseed (AC-REROLL enablement)

`planet-lod-lab.html` (+ the S5 draw-law extraction into `driver-presets.js`):
- **`newPlanet` is a NEW GUI control, not an existing function** (Lens L19: zero occurrences in the lab today). It is a new button **placed beside the existing 🎲 reroll-radius button in the `fDrivers` folder** (symbol anchors: `rerollRadius` / the `radius seed` controller / the `'🎲 reroll radius'` row), calling the existing `rerollRadius`-idiom → `reseedGiant()` → `applyDrivers()` chain — **nowhere near the `resolveStormE` / storm-derivation hunks** (the naively-adjacent graft point `reseedGiant` sits directly against atmo-owned territory; the button lands in the GUI-wiring section instead).
- `state.worldSeed` (int) joins state; `newPlanet()` re-rolls it (`(Math.random()*2**32)>>>0` — UI-button entropy, the `rerollRadius()` idiom) then derives EVERY sub-seed through alea namespaces with an **explicit float→uint32 mapping** (Lens L26): `radiusSeed = Math.floor(alea('draw:radius:'+worldSeed)()*2**32)>>>0` (fits the existing 0–4294967295 GUI field), `macroSeed` likewise via `'draw:macro:'` scaled into the existing 0–9999 range, `detailSeed` via `'draw:detail:'`; sets `_radiusDirty = true`; then `reseedGiant()` + `applyDrivers()`. One worldSeed ⇒ the whole world re-rolls, radius included.
- **AC-RADIUS-AB enablement documented** (Lens L26): the surviving manual `radiusSeed` field and the `planetRadiusEarth` slider ARE the A/B toggle at fixed `worldSeed` — the contract's "same worldSeed, small vs large drawn R" protocol overrides the derived radiusSeed via those controls (paired-by-seed per the §1C honesty note). Recorded in the AC map for working-Claude's drive.
- **`drawPresetRadius`** swaps `mulberry32(seed)()` for `alea('draw:radius:'+(seed>>>0))()` — mulberry32 retired **for new draws only**. **The `mulberry32` function DEFINITION STAYS in the lab as dead code** (Lens L4, blocker-adjacent: `worldengine-base-storm-e.test.js` pins `expect(LAB).toContain('mulberry32')`; deleting the helper would leave that pin resting solely on an atmo-owned comment the concurrent lane may rewrite tonight — a cross-lane silent RED). It gains the one-line comment `// retired for new draws 2026-07-19 — kept for the storm-e envelope guard`; byte-inert, zero test edits, storm-e test NOT touched this increment. `grep -c mulberry32 planet-lod-lab.html ≥ 1` joins the S5 gate greps.
- **Draw-law extraction (Lens L21):** the range lookup + draw formula + `NAMED_BODY` set move to exported symbols in `driver-presets.js` (data module, unhashed, already imported by the lab); the lab's `drawPresetRadius` and `population-sweep.mjs` BOTH consume them. `NAMED_BODY` early-return (canonical lock) untouched semantically — that IS the AC-REROLL named-body clause. `rerollRadius()`/the seed field keep working unchanged (they feed the same draw).
- Byte-safety: headless/golden paths never call `drawPresetRadius`; no test pins its outputs (verified `ws4-reroll-gate.test.js` has no such pin); the storm-e pin is satisfied by the retained definition. Live-only distribution change on archetype presets — expected, it's the feature.

---

## §2 — Slice decomposition (each independently buildable + testable + committable; fences provable at every seam)

**SLICE 1 — Gravity coherence root + radPerKm (1A + 1B).**
- Files: `body-condition-vector.js` (the one-expression change), `src/worldengine/base/baseStep.js` (`radPerKm` + `KM_PER_EARTH_RADIUS` exports), NEW `tests/worldengine-v2-6-gcohere.test.js`.
- Tests: canonical bit-identity (new expression `===` legacy expression, all `DRIVER_PRESETS`, seeds moot — pure fn); drawn-R sweep g = M_derived/R² float64-exact + monotone in R; massEarthOf round-trip (g·R² === M_c·(R/R_c)³); condition-vector SHAPE unchanged (key-set equality vs today's 14 keys).
- Gate: full suite at baseline + 75-golden + anchors green with ZERO fixture diffs (`git diff --stat tests/fixtures/` empty). **→ COMMIT 1** `V2-6 slice-1: gravity coherence at the condition-vector root (g = g_c·R/R_c, byte-exact at canonical) + radPerKm derived scalar`.

**SLICE 2 — Bombardment km-space rewrite + obliteration equilibrium (1C).**
- **Step 0 (BEFORE any writer code):** `calibration/crater-sfd-km.mjs` runs the **closed-form pre-check** (Lens L5/L11/L20): coverage(F_REF, D_LO, D_HI, B) + N_stamp + screen-per-preset for Moon/Mercury + the R sweep, asserting the [10,80]% analytic-coverage band is reachable and `N_stamp ≤ N_STAMP_SAFETY` — priors adjusted HERE (recorded), never after tests are written.
- Files: `src/worldengine/base/bombardment.js` (analytic count + above-floor truncated stamping per §1C(iii) restructure + deep-envelope `P_SURF_MAX` clause + chron + exposure age + graded floors + analytic sub-floor `regolithRoughness` + age-ordered obliteration stamping with zero-overlap tagging + pre-clamp floor accessor; profile zones unchanged this slice), `tests/worldengine-v2-5-bombardment.test.js` (RESTATED per the §0 FULL churn inventory — **checklist enumerates every describe block of the file**, not just constants: K_GD import removed, band constants → km-law asserts, gate-semantics flips (Rocky/non-target fixtures), `moonCond` widened with `radiusEarth: 0.38`, AC-POWERLAW re-binned in km, forEachCrater 3-draw oldest-first contract, import-allowlist → the 4-module list), NEW `tests/worldengine-v2-6-craters.test.js` (AC-GCOUNT g-sweep dN/dg=0 + K_GD grep-absent + K_GS===0.17; AC-RADIUS-LAW on the ANALYTIC count — strict ∝R² pre-round, no cap — + median-angular ↓ + closed-form coverage in the pinned band; AC-EQUILIB age sweep **averaged over a small seed batch** (Lens L15 — single-seed adjacent-age monotonicity flakes when a late basin resets dozens of craters; monotone-plateau holds in expectation): retained density non-decreasing with plateau on the batch mean, floors per the §1C(iv) operational definition — exact pre-clamp on zero-overlap craters, order-thresholdable post-clamp on all), calibration `crater-obliteration.mjs` (run + committed BEFORE constants finalize).
- The erosion term of `t_exp` needs `erosionOf` — factored into `surfaceMaterial.js` in THIS slice (module created here with `erosionOf` only, **importing nothing**; iceness joins S3, crystal S4) so S2 is self-contained and the restated 4-module allowlist is green in the same commit that writes it (Lens L2).
- Gate: full suite; goldens byte-green (craterField unhashed; no hashed-stream reorder); **`tests/worldengine-v2-5-preset-composite.test.js` green with ZERO edits** (the Jovian null-composite pin — Lens L1 gate); `git show --stat` fence. **→ COMMIT 2** `V2-6 slice-2: bombardment km-space SFD (analytic count ∝ R², size ∝ 1/R, K_GD removed, deep-envelope gate) + Neukum chron + continuous tidal/atmo/erosion exposure + obliteration-stamping equilibrium`.

**SLICE 3 — Ice relaxation + iceness material pair (1D + 1E).**
- Files: `bombardment.js` (relaxation transform + per-crater ε), `surfaceMaterial.js` (`icenessOf` + `deriveSurfaceMaterial`), `planet-lod-rivers.js` (`relief.surfaceMaterial` return field beside `relief.figure`), `planet-lod-uniforms.js` (`uIcenessMix`/`uIcenessAlbedo` beside the frost block), `planet-lod-lab.html` (Stage-6 albedo mix + `applyDrivers` drive — OUTSIDE F24–F31), calibration `ice-relax.mjs` + `surface-material.mjs`.
- Tests (NEW `tests/worldengine-v2-6-ice.test.js`): AC-RELAX grid over (T_eq, td, D) — ε(60 K, td≈0) === 0 exactly + relaxed-profile bit-identity at ε=0; Enceladus-class ε large; ∂ε/∂D > 0; dome + P_RIM=2 terms present; iceness 18-preset targets **per the L7 table (Frozen/Europa high, Crystal nonzero-LOW, Moon/Mars ≈0)**; `relief.surfaceMaterial` populated on every dispatch path **with exactly the S3 keys `{ iceness, regolithRoughness }`** (crystallizationPotential joins + the shape assert restates in S4 — declared, Lens L8).
- Gate: full suite + goldens + atmo-section untouched check (grep the F24 markers' hunks absent from the diff). **→ COMMIT 3** `V2-6 slice-3: Arrhenius ice relaxation (crisp-cold Frozen, relaxed warm/tidal) + condition-derived iceness albedo pair`.

**SLICE 4 — Crystal carve-out (1F) — SCALAR + DECISION ARTIFACT ONLY (Lens L9 carve).**
- Files: `surfaceMaterial.js` (`crystallizationPotential(cond, schedule)` + resurfacing/bombardmentIntensity scalars — schedule as explicit parameter, no bombardment import), `planet-lod-rivers.js` (channel gains `crystallizationPotential`; shape assert restated), NEW `tests/worldengine-v2-6-crystal.test.js`, calibration `crystal-scalar.mjs` (the 18-preset decision-artifact table, old-boolean column beside derived, flips highlighted). **`planet-lod-lab.html` `_facetClass` block NOT touched — the wiring flip + extreme thresholds are adjudication-gated (§1F); no workaround built.**
- Tests: purity grep (no label/archetype/regime reads); continuity on [0,1]; wiring proof — the explicit-parameter construction + **a `radiusEarth` perturbation spy** (Lens L10: R is the one crystal input that moves ONLY bombardmentIntensity; **gravity deleted from the spy** — post-K_GD the count path is g-independent BY DESIGN, dN/dg=0, so a gravity spy could only pass against wrong physics; AC-GCOUNT cited in the test comment); channel shape `{ iceness, crystallizationPotential, regolithRoughness }`; default-bake facet-weight-0 unchanged. **NO CRYSTAL_HI/CRYSTAL_LO extreme assert** — the calibrator table is committed as the adjudication artifact instead; §8 row + BUILD-NOTES + morning-report flag recorded in this slice.
- Gate: full suite + drift guards green with zero edits (no `*Enabled`, no FEATURES entry). **→ COMMIT 4** `V2-6 slice-4: crystallizationPotential scalar + decision artifact — extreme-agreement + lab wiring deferred to adjudication (preset degeneracy vs AC-CRYSTAL, recorded)`.

**SLICE 5 — worldSeed reseed (1H) — AC-REROLL code-side enablement.**
- Files: `planet-lod-lab.html` (NEW `newPlanet` button beside the reroll-radius row in `fDrivers` — NOT near `reseedGiant`/storm hunks; `drawPresetRadius` alea swap; `state.worldSeed`; **mulberry32 definition RETAINED as dead code with the retention comment** — Lens L4) + `driver-presets.js` (draw-law + `NAMED_BODY` extraction as exports — Lens L21).
- Tests: none headless-new beyond a tiny unit on the extracted draw law's determinism (now importable — no `:9223` dependence); `planet-archetypes.test.js` green untouched; **`worldengine-base-storm-e.test.js` green with ZERO edits**.
- Gate: full suite + goldens (headless never touches the lab paths) + gate greps: `grep -c mulberry32 planet-lod-lab.html ≥ 1`, F24–F31 hunks absent from the diff. **→ COMMIT 5** `V2-6 slice-5: one worldSeed, alea sub-namespaces (draw:radius/macro/detail); newPlanet button re-rolls radius; mulberry32 retired for new draws (definition retained for the storm-e envelope guard); draw law extracted for the population harness`.

**SLICE 6 — population-sweep.mjs + docs close-out (1G + AC-0 documentation).**
- Files: calibration `population-sweep.mjs` (+ its committed JSON summary + the first-run table pinning `k`/per-archetype allow-list, then hard-coded — Lens L23), `BUILD-NOTES.md` (named consumers: iceness uniform, crystal channel, regolith→Increment-8 deferral, radPerKm; the AC-LAB-LEGIBLE envelope; the pinned "MATURE impact-surface seed" gate-denominator definition — Lens L20; the AC-CRYSTAL adjudication flag — Lens L9; record-build-intent note), NOW.md untouched (working-Claude's seam job).
- Tests: the harness run IS the test (`node docs/WORKSTREAMS/world-engine-v2-6-radius-craters-ice-crystal-2026-07-19/calibration/population-sweep.mjs` exits 0 with all gates green, < 10 min, per-preset timings in the JSON); full vitest at baseline one final time.
- Gate: everything above + AC-0 grep sweep of all new/modified writers' reads. **→ COMMIT 6** `V2-6 slice-6: population-sweep acceptance harness (64-seed × archetype gates, pinned k + denominator) + spine-conformance docs`.

---

## §3 — AC map (every contract AC → its concrete closer)

| AC | Layer | Closed by |
|---|---|---|
| **AC-0** | unit | Guard suites green with ZERO edits (§0); grep audit of `bombardment.js`/`surfaceMaterial.js` reads (condition scalars + `radPerKm` only — no label/archetype/regime); named consumers documented in BUILD-NOTES (S6); no new `*Enabled` key anywhere. |
| **AC-GCOHERE** | unit | S1 `worldengine-v2-6-gcohere.test.js`: canonical bit-identity vs legacy expression (the NAMED_BODY byte-equality proof, no fixture), drawn sweep g=M/R² float64-exact, massEarthOf round-trip. |
| **AC-FENCE** | unit | 75-golden + anchors at EVERY slice commit; `git diff` on all fixture files empty; carrier.height never written (own-channel discipline unchanged). |
| **AC-RADIUS-LAW** | unit | S2 R sweep: count asserted STRICTLY on the pre-round analytic law (∝R², no cap — L5/L6/L11); median angular ↓ closed-form; coverage within the pinned log-drift band (`crater-sfd-km.mjs` step-0 pre-check pins it). |
| **AC-EQUILIB** | unit | S2 age sweep, seed-batch-averaged (L15): plateau present, density-below-plateau at young ages, floors per the §1C(iv) operational definition (exact pre-clamp on zero-overlap retained craters; order-thresholdable post-clamp on all — L12), coverage ≤ cap. |
| **AC-GCOUNT** | unit | S2: g sweep at fixed (R, age, seed) ⇒ `N_analytic` invariant (dN/dg = 0 — the population count IS the contract's count); the STAMPED count may shift with g solely through sizeMul's band shift vs the fixed mesh floor — that is the K_GS size law acting, asserted as such in the test comment; `K_GD` grep-absent from src; `K_GS === 0.17` asserted. |
| **AC-RELAX** | unit | S3 (T_eq, td, D) grid: the four properties + ε(60 K)≡0 bit-identity of the relaxed profile. |
| **AC-CRYSTAL** | unit | S4: purity grep + continuity + wiring proof (explicit schedule parameter + radiusEarth spy; gravity spy deleted per AC-GCOUNT — L10) + default-bake unchanged check + channel shape. **Extreme-agreement clause `deferred-to-adjudication`** (L9 — preset degeneracy makes it mathematically unsatisfiable; decision artifact committed; lab `_facetClass` flip NOT built). |
| **AC-POPSWEEP** | integration (headless) | S6 `population-sweep.mjs` all gates green (metric = closed-form drawn coverage; denominator = pinned MATURE impact-surface definition — L5/L20; k pinned — L23), machine-readable summary committed, < 10 min. |
| **AC-LAB-LEGIBLE** | integration (live) | Code-side enablement: S2 calibration pins the Moon/Mercury boot envelope (recorded in BUILD-NOTES). Browser drive on `:5175` is working-Claude's, post-build — NOT build-workflow work. |
| **AC-RADIUS-AB** | integration (live) | Enablement: S1 (coherent g) + S2 (km SFD) + S5 (radius re-roll). Evidence protocol documented (§1C honesty note, REVISED): paired same-worldSeed, harness drawn metrics + **matched-surface-km-footprint screenshots** (global-disk views are scale-invariant by real physics — expected, not a failure); **the R toggle at fixed worldSeed = the manual `radiusSeed` field / `planetRadiusEarth` slider** (L26). Working-Claude drives. |
| **AC-REROLL** | integration (live) | Enablement: S5. Working-Claude drives (successive `newPlanet` rolls vary; NAMED_BODY pins canonical). |
| **AC-UAT** | uat | Max solo on `:5175` + the S6 population contact sheet — `deferred-to-max`; never PASSed by any agent. |

---

## §4 — Deviation triggers

**HARD STOPS (the plan is wrong — STOP, return ABORT rather than work around):**
- Any byte diff in `tests/fixtures/v2-0-carrier-goldens.json` / any HASHED_FIELDS change / any byte-anchor RED on any golden preset. Fixtures NEVER re-captured.
- The canonical-radius bit-identity of §1A failing (i.e., the ratio form NOT reproducing today's g exactly at R===R_c) — that invalidates the whole byte-stability argument; re-derive, don't fudge with tolerances.
- Any `deriveConditionVector` return-shape change (new/removed keys).
- Any edit to F24–F31 sections, `climate-e5.js`, `storm-e.js`, `emission-e.js`, `climateE5:*`/`stormE:*` streams, `shellRelief.js` (the AC-0 radius ban), or legacy F2/F3 crater/ejecta symbols.
- Any `.label`/archetype/`geodynamicRegime`/`PRESET_ARCHETYPE` read in `bombardment.js`/`surfaceMaterial.js`, or a `computeE1`/`e1Regime` substring (incl. comments) in either.
- Any new `*Enabled` key / FEATURES entry; any guard-table edit (this increment adds no preset — if a guard demands an edit, the plan mis-modeled something: STOP).
- Any commit touching `src/auto/CameraChoreographer.js`, `src/debug/LabMode.js`, or the loose png/qa strays; any `git add -A`/`git stash`/`git push`.
- Suite failures beyond the documented pre-existing baseline that resist a slice-local fix.

**ADJUDICATION GATE (stronger than adjudicable — do NOT close, do NOT build around):**
- AC-CRYSTAL extreme-agreement + the lab `_facetClass` wiring flip (§1F, Lens L9): S4 commits the decision artifact and stops there; Max rules in the morning. Building any workaround (threshold gymnastics, preset-data edits, label reads) is a HARD STOP.

**ADJUDICABLE (record in §8; surface in BUILD-NOTES / the morning report if it touches an AC mechanism):**
- Calibration moving any prior named in §1 (C_BASIN, C_ATMO_KM, D_SFD_MIN_KM, F_REF, N_STAMP_SAFETY, P_SURF_MAX, SCREEN_MATURE, K_EXP_MATURE, T_RESURF_*, DT_TIDAL, DOME_FRAC, iceness thresholds, MESH_FLOOR_RAD exact value) — calibration output IS the source of truth; record the observed number + rerun the committed calibrator. The step-0 closed-form pre-check (S2) is the ONLY sanctioned place to move the SFD/coverage priors.
- The deep-envelope clause form (`P_SURF_MAX` scalar ceiling vs an `atmosphere.composition` read — L1/L17; the scalar form shipped, the alternative recorded).
- **The erosion term in t_exp** (§1C iii): a principled completion beyond footnote 5's literal tidal-only wording, grounded in footnote 13's own derived erosion scalar. Ship it, record it, flag it for Max — without it Rocky/Ocean/Titan boot Moon-cratered (a live regression the audit did not intend).
- Keeping `craterAmplitude` keyed on ANGULAR size (A ∝ δ^0.5) vs restating in km — normalized height is planet-relative, so the angular form is defensible; if calibration shows big-world craters reading too shallow, restate with the derivation.
- The v2-5 test-file restatements (each carries its derivation comment — declared churn, but every individual restated constant is recorded).
- `state.facetStrength` becoming continuous (display semantics change on a driven readout).
- The AC-RADIUS-AB paired-seed evidence protocol (vs unpaired ensembles) — documented for working-Claude's drive.
- Where exactly the Stage-6 iceness mix sits relative to the frost overlay (before/after) — a look call, byte-inert; pick before-posterize beside frost, flag if moved.

---

## §5 — Lens log

**Folded 2026-07-19 (overnight). 27 findings from three lenses (bytes-fence ×9, physics ×9, population-integration ×9). ALL ACCEPTED — zero rejections; three cross-lens duplicates merged; two accepted with a modified fix (noted). Every load-bearing claim was verified against live source before acceptance (preset-composite Jovian pins :132-136, allowlist pin :258-260, moonCond :42-45, non-target fixtures :133/:205, storm-e mulberry32 pin :396 vs lab :1981-1993 + atmo-owned :2883, `newPlanet` zero occurrences, fDrivers/rerollRadius :3866-3870, tanh clamp `0.5·tanh(cf/0.5)` :177, AC-POWERLAW fitDiff binning :67-68, preset table incl. Crystal/Moon/Frozen/Carbon degeneracy).**

| # | Lens · sev · section | Disposition |
|---|---|---|
| L1 | bytes-fence · BLOCKER · §1C(iii) gas giants | **ACCEPT.** Cold-only gate craters Jovian/Saturnian/Neptunian and REDs preset-composite (outside churn). Fix: deep-envelope surface-existence clause `P < P_SURF_MAX` (prior 200 bar, pure scalar). Preset-composite named NOT-churn + added to S2 gate. Merges L17. |
| L2 | bytes-fence · major · §1B allowlist | **ACCEPT.** v1 restated "+baseStep only" while S2 itself imports surfaceMaterial — RED in its own slice. Restated once, in S2, as the 4-module list with per-addition derivations. Merges the physics-lens allowlist half of its cycle finding. |
| L3 | bytes-fence · major · module topology | **ACCEPT.** ESM cycle bombardment⇄surfaceMaterial eliminated: surfaceMaterial imports NOTHING; `crystallizationPotential(cond, schedule)` / `deriveSurfaceMaterial(cond, schedule)` take the schedule as an explicit parameter. Merges the physics-lens cycle finding (its "one-way + parameter" option adopted verbatim). |
| L4 | bytes-fence · major · §1H mulberry32 | **ACCEPT.** storm-e `toContain('mulberry32')` pin would rest on an atmo-owned comment the concurrent lane may rewrite tonight. Fix: definition retained as dead code + retention comment; storm-e test untouched; `grep -c mulberry32 ≥ 1` in S5 gates. Merges L25 (pop-int duplicate). |
| L5 | bytes-fence · major · §1G coverage arithmetic | **ACCEPT.** Verified: drawn coverage ~5% at cap with v1 priors, stamped ~2.4% — [10,80]% unreachable; cap flattens the R sweep. Fix: §1C(iii) RESTRUCTURE — analytic un-capped count, stamps drawn only above the mesh floor from the truncated SFD, sub-floor mass analytic → regolithRoughness, closed-form step-0 pre-check with the coverage gate as an explicit constraint. Merges L11 + the arithmetic half of L20. |
| L6 | bytes-fence · minor · strict count monotonicity | **ACCEPT.** Cap eliminated by the L5 restructure ⇒ assert strictly on the pre-round analytic value. |
| L7 | bytes-fence · minor · §1E iceness Crystal target | **ACCEPT.** Verified iceness(Crystal) ≈ 0.065 — "high" unreachable without breaking Moon/Mars≈0. Crystal dropped from the high set → nonzero-LOW gate; its pairing driver is crystallizationPotential. Reasoning in the calibrator table. |
| L8 | bytes-fence · minor · S3/S4 channel shape | **ACCEPT.** S3 ships `{iceness, regolithRoughness}`; crystallizationPotential joins in S4 with a declared shape-assert restatement — in-plan, not a deviation. |
| L9 | physics · BLOCKER · §1F AC-CRYSTAL | **ACCEPT — ADJUDICATION CARVE, no workaround.** Verified: presets condition-degenerate; N ∝ R² gives Crystal 4.4× Moon's craters ⇒ derived potential INVERTS the old-boolean ranking for every N_BOMB_REF; Carbon derives ≈max while boolean-false. S4 rescoped: scalar + purity/continuity/wiring/default-bake + 18-preset decision artifact; NO extreme thresholds, NO lab `_facetClass` flip (would kill Crystal's facets live). Extreme-agreement clause `deferred-to-adjudication` (Max, morning report; options a/b/c recorded, (a) recommended, (c) ABORT-adjacent). Increment stays buildable — 12 of 13 ACs close fully; AC-CRYSTAL closes 4 of 5 clauses. |
| L10 | physics · major · S4 gravity spy | **ACCEPT (modified fix).** Gravity deleted from the spy — dN/dg=0 by design (AC-GCOUNT cited in test comment). Modified: spy = explicit-parameter construction + radiusEarth perturbation (R is the ONE crystal input moving only bombardmentIntensity; the lens's age/pressure/tidal candidates confound through resurfacing/airlessness/erosion terms). |
| L11 | physics · major · prior constellation | **ACCEPT — merged into L5.** Its "draw discrete stamps only above the mesh floor + analytic sub-floor mass" alternative IS the adopted restructure. |
| L12 | physics · major · AC-EQUILIB floor exactness | **ACCEPT.** Verified the tanh clamp contracts every nonzero value (−0.18 → −0.1727) and younger-rim `+=` overprint is real physics. "Thresholdable" defined operationally in §1C(iv): float-exact PRE-clamp on zero-younger-overlap retained craters (age-ordered loop tags free); band/ordering post-clamp for all (tanh monotone). |
| L13 | physics · major · graded atmo floor inert | **ACCEPT.** Verified 0.16·P^0.65 > 4 km only above ~142 bar ⇒ the "replacement" for CRATER_ATMO_MAX was inert on every atmospheric preset (the exact wire-relevant-drivers-before-UAT failure mode). D_SFD_MIN_KM prior 4→1 km (screening anchor, not a stamp floor); calibrator prints screen per preset; tests assert screen<1 Venus-class, ≈1 Mars-class. |
| L14 | physics · minor · sizeMul vs band | **ACCEPT.** Band edges scaled by sizeMul BEFORE the inverse-CDF draw; upper edge capped at C_BASIN·R_km (disruption limit is target physics); π-group derivation in the test comment; makes the km-median anchor exact. |
| L15 | physics · minor · monotonicity flakes | **ACCEPT.** Count: analytic pre-round assert (with L6). AC-EQUILIB: age sweep averaged over a small seed batch — single-seed adjacent-age monotonicity is false realization-by-realization (late basin resets). |
| L16 | physics · minor · rim exponent derivation | **ACCEPT.** τ∝1/λ yields p=1, not the pinned p=2. Derivation comment relabeled: contract-pinned phenomenological exponent, motivated by elastic/lithospheric short-λ support — no false cite. |
| L17 | pop-int · BLOCKER · gas giants + churn boundary | **ACCEPT — merged into L1.** Chose the pure-scalar `P_SURF_MAX` ceiling over its `atmosphere.composition === 'h2-he'` read (cleaner under the AC-0 scalar-grep discipline); the alternative recorded as adjudicable in §4. |
| L18 | pop-int · major · churn inventory too narrow | **ACCEPT.** §0 churn inventory extended to enumerate every describe block: gate-semantics FLIPS (Rocky non-target :133; non-target fixture :205), `moonCond` widened with `radiusEarth: 0.38` (verified absent — km schedule would NaN), AC-POWERLAW re-binned in km, each with its replacing derivation per hard-fence rule 9. |
| L19 | bytes-fence · minor · newPlanet nonexistent | **ACCEPT.** Verified zero occurrences. Specified as a NEW button beside the 🎲 reroll-radius row in `fDrivers` (:3866-3870 zone, symbol-anchored), calling the existing chain — away from the `reseedGiant`/storm hunks. |
| L20 | pop-int · BLOCKER · POPSWEEP gate metric + denominator | **ACCEPT.** (a) arithmetic half merged into L5. (b) denominator pinned: MATURE impact-surface seed = `isImpactSurface && screen ≥ SCREEN_MATURE(0.9) && t_exp ≥ K_EXP_MATURE(0.25)·age`; erosion-suppressed seeds (Rocky/Ocean/Titan/Eyeball-class) reported in a separate row, not counted against the band. Definition recorded in §1G + BUILD-NOTES + §8 (the contract phrase required an operational definition; this is it, with the trade-off surfaced). |
| L21 | pop-int · minor · draw-law drift | **ACCEPT.** Draw formula + NAMED_BODY set extracted in S5 to `driver-presets.js` exports; lab + harness both import; harness grep-asserts the lab consumes the shared symbols. |
| L22 | pop-int · minor · sweep runtime | **ACCEPT.** Schedule-only for gas/ice-giant/deep-envelope rows; per-preset wall time in the JSON; < 10 min budget stated in §1G. |
| L23 | pop-int · major · E1-regime k unpinned | **ACCEPT.** k + per-archetype allow-list pinned from the first calibration run (committed table), then hard-coded in population-sweep.mjs — reruns falsifiable, no "where physics allows" escape hatch. |
| L24 | pop-int · minor · §0 alea invariant wording | **ACCEPT.** Reworded to the true invariant: no stream consumed by any HASHED_FIELD writer is reordered; the `'bombard:'` draw-order change (2→3 per stamped crater) is declared churn. |
| L25 | pop-int · major · mulberry32 duplicate | **Merged into L4** (same fix, same gates). |
| L26 | pop-int · minor · AC-RADIUS-AB enablement | **ACCEPT.** §1H + AC map document the manual `radiusSeed` field / `planetRadiusEarth` slider as the A/B toggle at fixed worldSeed; explicit `Math.floor(alea('draw:radius:'+worldSeed)()*2**32)>>>0` mapping specified. |

**L27 — fold-discovered consequence (folder's own, not a lens finding):** the L5 restructure makes the stamped angular ensemble R-invariant even PAIRED (both truncated band edges ∝ R), killing v1's "matched features shrink" A/B escape. Resolved honestly rather than papered over: the §1C honesty note + AC-RADIUS-AB row now specify harness drawn metrics + matched-surface-km-footprint screenshots as the evidence (which is also how real planets behave — global views are self-similar); §9 risk 2 flags the residual product question for Max's UAT.

**Slice-ordering re-verification after fold:** S1 (root, golden-gated) → S2 (bombardment + surfaceMaterial-with-erosionOf created together so the restated 4-module allowlist is green in its own commit; preset-composite zero-edit gate at this seam; step-0 pre-check precedes the writer) → S3 (iceness + channel S3-shape; atmo-section grep at the lab seam) → S4 (scalar + artifact only; no lab edit ⇒ no new fence surface) → S5 (lab + draw-law extraction; storm-e zero-edit + mulberry32-grep gates at this seam) → S6 (harness + docs). Every seam's fence set is named in its own gate line; goldens gate every commit. No slice depends on an adjudication outcome — the S4 carve removes the only such dependency.

---

## §8 — Build deviations

*(Empty at plan time. Build agents append `{slice, planned, actual, reason, AC-impact}` rows — nothing silent.)*

| Slice | Planned | Actual | Reason | AC-impact |
|---|---|---|---|---|
| S2 | Exposure age `t_exp = min(age, T_RESURF_TIDAL/td, T_RESURF_ERODE/erosion)` with `age` unbounded above | Added a physical cap `age = min(AGE_MAX=4.6, age)` (Deviation #1) | The published Neukum chronology `chron(t)` diverges exponentially; an out-of-range `age` (e.g. 8 Ga — older than the ~4.567 Ga solar system) drives `N_stamp` to ~1e15, an unbounded stamp loop. A surface cannot predate the solar system, so `AGE_MAX` is a physically-correct bound, not a behavior-bending cap. Inert on every preset (max preset age 4.5); bounds `N_stamp ≤ ~300 ≪ N_STAMP_SAFETY` at every physical input. | None negative — AC-EQUILIB's plateau at old ages now lands exactly at the `AGE_MAX` cap (age 4.6=6.0=8.0), which reads as the equilibrium plateau; the emergent obliteration signature (retention fraction falling 1.0→0.35 across [3.9,4.6]) is unaffected. Adjudicable prior for Max. |
| S2 | §1C(iii) `t_exp` erosion term ("a principled completion... ship it, record it, flag it" — §4 adjudicable) | Pinned the erosion-completion priors `P_ER_REF=0.5`, `DRY_ER_FLOOR=0.1` (in `surfaceMaterial.erosionOf`) and `T_RESURF_ERODE=0.1 Ga` (Deviation #2) | The plan gave the erosion FORM (footnote-13 `smoothstep(0,P_ER_REF,P)·max(waterWindow,DRY_ER_FLOOR)`) but not `P_ER_REF`/`DRY_ER_FLOOR` values. Chosen so Rocky/Ocean (P≈1 bar, liquid-water T) reach erosion≈1 ⇒ `t_exp ≈ T_RESURF_ERODE = 0.1 Ga` (real Earth crater-retention age) ⇒ essentially zero stamped craters, while airless worlds (P=0) get erosion=0 ⇒ full-age exposure. | Closes the "Rocky/Ocean/Titan boot Moon-cratered" live regression the audit did not intend. Surfaced for Max (§4-adjudicable erosion completion). AC-GCOUNT/RADIUS-LAW/EQUILIB unaffected (all measured on airless fixtures where erosion=0). |
| S2 | F_REF unspecified (calibration prior) | Step-0 `crater-sfd-km.mjs` solved `F_REF=488000` against the [10,80]% coverage gate BEFORE the writer (sanctioned §4 place to move SFD/coverage priors) | Coverage-gate constraint: geo-mean coverage of the MATURE airless set (Moon 42.9%, Frozen 44.2%, Crystal 33.7%) centred in-band. | Not a plan-deviation — the sanctioned calibration output. Recorded for traceability; the writer's `F_REF` comment cites it. |

---

## §9 — Risks (named at plan time)

1. **Concurrent atmo lane, same mega-files:** the sibling tree edits `planet-lod-lab.html` F24–F31 sections tonight. Our lab edits are symbol-disjoint (Stage-6, `_facetClass`, `newPlanet`, `drawPresetRadius`), but the eventual merge is a same-file merge — keep each lab edit small and section-local; never touch the storm/band hunks.
2. **Scale-free ensemble invariance** (§1C honesty note, REVISED at fold): under the L5 restructure the stamped ensemble is R-invariant even paired — the same theorem real planets obey. The live A/B evidences the law via harness drawn metrics + matched-surface-km-footprint screenshots; a global-view comparison reading "alike" is expected physics. If Max's UAT wants a stronger global-view signature, that is a product call to surface, not a wiring bug to fix silently.
3. **Exposure-age erosion term** is an extension (adjudicable, surfaced) — omitting it is a worse deviation (live regression on atmospheric worlds).
4. **Drawn-radius E1 rerouting:** coherent g means archetype worlds at drawn radii can flip regimes live (expected physics; goldens canonical ⇒ safe). Surfaced for UAT so Max isn't surprised.
5. **Performance (softened by the L5 restructure):** the loop count is `N_stamp` — R-invariant, tens–hundreds — with `N_STAMP_SAFETY` as a hard assert; the analytic count never loops. Calibrator still prints timing at the worst corner (old-age chron spike raises N_stamp via chronN).
6. **Bisection chron-inverse** per stamped crater: 48 iterations × hundreds — trivial; lookup-table fallback retained as a recorded deviation if calibration surprises.
7. **AC-CRYSTAL adjudication pending (L9):** the increment ships with the boolean `_facetClass` path live and the extreme clause open — Max's morning ruling closes or re-scopes it; the decision artifact is committed in S4.
8. **Stamped-coverage saturation at old ages** (>100% pre-obliteration) is expected equilibrium palimpsest, not a gate breach — the [10,80]% gate reads the closed-form drawn metric (L5/L20 pinning).
