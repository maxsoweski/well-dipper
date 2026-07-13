# V2-7d BUILD-NOTES — SP-LID-DISRUPTION family module (`lidDisruption.js`)

**Workstream:** `world-engine-v2-7d-lid-disruption-2026-07-12` · **Built:** 2026-07-12/13
**Built from:** the revised [`BUILD-PLAN.md`](BUILD-PLAN.md) (both adversarial must-fixes folded — see below),
`contract.json`, `GROUNDING.md`, `intent.md`. HEADLESS ONLY; COMMIT NOTHING (working-Claude serializes).

---

## Adversarial must-fixes — resolution (verified against real code first)

| MF | Verdict | Resolution (tag in plan) |
|---|---|---|
| **MF1** — AC-CONSUMER-SEAM (a2) "nodes near ring radii sit below nodes at ring-midpoints" is FALSE as a GLOBAL claim | **CONFIRMED** (computed on the §1.1 profile: `profile(0.37)=0.0735 > profile(0.77)=0.0657`; a ring-1 node 0.02 in ρ off-centre already exceeds the rings-2/3 midpoint, and the exact ring-1 minimum 0.0622 beats it by only 0.0035 — no node tolerance rescues the global form) | `[RESOLVED-BY-LENS: MF1]` in §2.1 + §4. **Dropped** the global per-node ordering clause from (a2); (a2) now asserts per-node `contrib[i] === Math.fround(profileGroovedDiapir(rho_i, P))` + cover set === {ρ ≤ support} (plumbing proof, Float32-store-aware). **Added** to (a1) the robust ADJACENT-midpoint pure-profile ordering `profileGroovedDiapir(rk) < profileGroovedDiapir(rk ± GROOVE_DR/2)` (verified margins ≥ 0.11, all 3 rings). The contract AC ("ring count + spacing asserted on the ρ profile") is fully discharged by (a1); the fragile ring-1 mesh window (~3–8 nodes at radii=0.5/N=1500) is not relied on. |
| **MF2** — comment-discipline token list vs the grep list (self-trip risk) | **VERIFIED against real code; already folded, premise partly inverted** | `[RESOLVED-BY-LENS: MF2]` in §1 + §1.6. The house grep idiom is `stripComments` — CONFIRMED in `tests/worldengine-mixed-composer.test.js:34` (defines `stripComments`), `:108`/`:133` (grep `CODE = stripComments(SRC)`, not raw). MF2 as issued asserted the opposite ("bare-substring … comments included"); the real code strips comments, so the three self-trips it enumerated (`conditional ⊃ condition`, `"regime-gate-free" ⊃ regime`, a header `while` inflating the count) DO NOT occur once greps run on stripped source. The plan's §1.6 pins the exact regexes on `stripComments(SRC)` except the quoted-namespace check (raw). Neither must-fix is contested. |

Both must-fixes verified before folding; neither routed to a Contested section (both confirmed valid against the actual sources).

---

## AC-0 conformance table

| AC-0 clause | Evidence | Result |
|---|---|---|
| (1) Driver connectivity — N/A & asserted | condition-blind greps on `stripComments(SRC)`: no `bodyDrivers`, no `\bcondition\b`, no `computeE1`, no `\be1\.`, no `\barchetype\b`; no `carrier.(height\|grainAngle\|faultDensity\|regime)` read/write. Inputs are carrier + seed + explicit `tune`/`acceptWeightAt`. | PASS (main · `reads no D-vector / E1 / taxonomy token`) |
| (2) Named consumer | Present consumer = this validation suite. FUTURE consumers named in intent.md UNLOCKS + the module header: **V2-7** (cantaloupe epoch expression via editable cell descriptors) and **V2-9a** (diapir grooved-coronae profile). | PASS |
| (3) Taxonomy registration | No new archetype/regime/`*Enabled` key anywhere; `planet-archetypes.test.js` drift guards green (21/21), zero taxonomy change. | PASS (step-8 archetypes run) |
| three-free import allowlist | exactly 3 `from '…'` specifiers, all in {`alea`, `simplex-noise`, `./mathutil.js`}. | PASS |
| zero taxonomy / zero wiring | recursive `src/**/*.js` + `planet-lod-rivers.js` walk finds NO importer of `lidDisruption.js`. | PASS (AC-ZERO-WIRING) |

**Zero taxonomy:** no regime/archetype/`*Enabled` constant introduced; no dispatch edge; the whole diff = 1 new module + 2 new test files + workstream docs.

---

## Final export list (`src/worldengine/base/lidDisruption.js`)

| Export | Kind | Role |
|---|---|---|
| `PROFILE_DEFAULTS` | frozen object | corona amplitudes (value-identical to both shipped seed writers) + grooved-diapir shape params |
| `profileActiveCorona(rho, P)` | pure fn | ρ→Δh, ≡ stagnantLid STEP-3 active ≡ mixedInterior STEP-7 active (exact FP) |
| `profileInactiveCorona(rho, P)` | pure fn | ρ→Δh, ≡ both shipped inactive copies (exact FP) |
| `profileGroovedDiapir(rho, P)` | pure fn | NEW central dome + `GROOVE_RINGS` Gaussian ring troughs (the V2-9a diapir capability proof) |
| `DISRUPT_PROFILES` | frozen array | default per-type registry: `[{inactive,1.3},{active,1.6}]` (grooved NOT registered by default) |
| `CELL_DEFAULTS` | frozen object | K band + warp + belt (value-identical to the shell seed) |
| `makeCellDisruption(carrier, opts)` | constructor | space-filling warped-Voronoi partition + BFS-from-walls interiorness |
| `FOCI_DEFAULTS` | frozen object | pool-∝-N + bias + type split + heavy-tailed radius law |
| `makeFociDisruption(carrier, opts)` | constructor | sparse field-biased rejection sampling, typed features, editable descriptors |
| `evalFociDeformation(carrier, foci, profiles, P)` | evaluator | placement/eval split: zero-draw additive contribution + cover mask |

---

## Build intent (record-build-intent)

**What it does, plainly.** One owned module that expresses the two shipped "basal upwelling → circular lid
deformation" patterns as a FAMILY: `makeCellDisruption` carves the sphere into space-filling warped-Voronoi
cells and computes a per-node "how deep inside a cell am I" field (BFS distance from cell walls, decaying
inward); `makeFociDisruption` scatters a sparse set of typed circular features, field-biased toward a
caller-supplied proximity field, each with a heavy-tailed radius; `evalFociDeformation` turns those features
into an additive Δh field using a pluggable per-type analytic profile. A shared pure profile library
(`profileActiveCorona`/`profileInactiveCorona`/`profileGroovedDiapir`) supplies the ρ→Δh shapes.

**Why (intent).** V2-7d is funded-but-cuttable infrastructure that keeps two later payoffs reachable
(V2-7 cantaloupe-silicate epochs; V2-9a diapir-grooved coronae) by building the shared machinery NOW, while
the two seeds are still fresh — without rewiring the shipped writers. It serves the JOURNEY world-engine
objective (history-coherent variety) as enabling infrastructure; no player-visible surface this increment.

**Deliberate non-goals (fences held).** No rewiring / byte-touch of shellRelief.js / stagnantLid.js /
mixedInterior.js (verified: their inline profile copies still present, unedited). No stress coupling inside
the module (coupling enters only via `acceptWeightAt` + caller amplitude scaling). No carrier writes; no relax
passes. No absorption of mixedInterior's duplicate profile (post-V2-7 candidate). No #4.5 geometry decision —
the grooved profile is a synthetic capability proof (not registered in `DISRUPT_PROFILES` defaults; no preset,
writer, or lab surface). No production wiring (interpenetration.js precedent). No UAT gate.

---

## Test-name → AC mapping

| Contract AC | File · describe · it |
|---|---|
| **AC-0** | main · `AC-0 spine conformance` · `imports only alea / simplex-noise / ./mathutil.js …`; `reads no D-vector / E1 / taxonomy token …`; `DEFAULTS objects are frozen and match the seed writers' values` + step-8 `planet-archetypes.test.js` (21/21) |
| **AC-DET** | main · `AC-DET …` · `byte-identical cells outputs`; `byte-identical foci + eval outputs`; `static greps: no Math.random / Date.now / convergence while; exactly one bounded BFS drain`; `draws only in 'disrupt:'; no shipped namespace literal; seedKey guard throws`; `never writes any carrier channel` · drawcount · all 4 its |
| **AC-STRUCT-CELLS** | main · `AC-STRUCT-CELLS …` · `space-filling partition + count band + interiorness invariants`; `C2/C3 …`; `C4/C5 …`; `anti-vacuous …` |
| **AC-STRUCT-FOCI** | main · `AC-STRUCT-FOCI …` · `F1`; `F2`; `F3`; `F4`; `F5`; `F6`; `anti-vacuous …` |
| **AC-PROFILE-EQ** | main · `AC-PROFILE-EQ …` · `profileActiveCorona === … dense rho grid`; `profileInactiveCorona === … dense rho grid`; `PROFILE_DEFAULTS amplitudes === … shipped sources still contain the inline formulas` |
| **AC-CONSUMER-SEAM** | main · `AC-CONSUMER-SEAM …` · `(a) grooved profile: ring count + spacing + trough<flanks ordering …`; `(a) grooved profile renders through evalFociDeformation — per-node exact-equality + cover set …`; `(b) deactivate one focus …`; `(b) retype one focus to grooved …` · drawcount · `evalFociDeformation performs zero draws` |
| **AC-ZERO-WIRING** | main · `AC-ZERO-WIRING` · `no src/ file (nor planet-lod-rivers.js) imports lidDisruption.js` |
| **AC-ZERO-CLOBBER** | integration — NOT run this workflow (V2-3 flip is in-flight; full baseline runs at working-Claude's commit point). This build touched only the archetypes drift guard. |

---

## Gate output summary

`npx vitest run tests/worldengine-lid-disruption.test.js tests/worldengine-lid-disruption-drawcount.test.js tests/planet-archetypes.test.js`

```
Test Files  3 passed (3)
     Tests  52 passed (52)
```

| File | Tests | Result |
|---|---|---|
| `tests/worldengine-lid-disruption.test.js` | 27 | all green |
| `tests/worldengine-lid-disruption-drawcount.test.js` | 4 | all green |
| `tests/planet-archetypes.test.js` (drift guard) | 21 | all green, untouched |

All discipline greps green on the module: no `Math.random`/`Date.now`; exactly one `while` (the BFS drain);
no relax pass; no carrier channel; no `bodyDrivers`/`condition`/`computeE1`/`e1.`/`archetype`; no quoted
shipped-namespace literal (raw); all 3 `alea(` calls seedKey-derived.

Statistic-band transfer (module's independent draws, verified): CELLS C1 K∈{9,15,13,14,11}; C2 wallFrac
0.318–0.393; C3 meanInt 0.544–0.626; C4 pooled spread 1.195; C5 min 0.190. FOCI F1 count 7–17; F2 cover
0.0497 (N=1500) / ≈0.056 (N=600); F4 pooled type1 ≈0.62; F5 bias ratios 2.4–4.5; F6 exactly 3 features/seed.
Every perturbed control lands outside its band. No band required widening (no `## Build deviations` entry).

---

## Exact new-file list for working-Claude's commit

**New files (this increment's ENTIRE diff surface):**
- `src/worldengine/base/lidDisruption.js`
- `tests/worldengine-lid-disruption.test.js`
- `tests/worldengine-lid-disruption-drawcount.test.js`
- `docs/WORKSTREAMS/world-engine-v2-7d-lid-disruption-2026-07-12/BUILD-PLAN.md` (revised: MF1 folded)
- `docs/WORKSTREAMS/world-engine-v2-7d-lid-disruption-2026-07-12/BUILD-NOTES.md` (this file)

**Zero existing `src/` or `tests/` file modified.** Do NOT stage `src/auto/CameraChoreographer.js`,
`src/debug/LabMode.js`, `planet-lod-rivers.js`, or `tests/fixtures/**` (untouched here; some are the
concurrent V2-3 flip's / a dirty pile). At the commit point: run the full `npx vitest run` baseline
(expect the 4 standing known failures unchanged + both new files collecting nonzero counts, 27 + 4), the
guardrail quartet, and `git show --stat` = exactly the five new files above.
