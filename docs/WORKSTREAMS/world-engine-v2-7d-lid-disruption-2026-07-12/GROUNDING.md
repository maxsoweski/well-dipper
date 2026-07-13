# V2-7d GROUNDING BRIEF — SP-LID-DISRUPTION shared abstraction

**Prepared:** 2026-07-12 · read-only survey of `feature/world-engine-production-L1`
**Sources read in full:** `ROADMAP-v2-condition-first.md` (§2.2 SP-LID-DISRUPTION bullet, §3.1 V2-7d row, §3.2 #1/#4.5 dispositions, §6 R-disrupt, §7a decision record), `src/worldengine/base/shellRelief.js`, `src/worldengine/base/stagnantLid.js`; targeted reads of `mixedInterior.js`, `lidResponse.js`, `interpenetration.js`, the V2-3 contract (AC/carve-out conventions), and the full alea-namespace inventory of `src/worldengine/base/*.js`.
**Anchoring convention:** grep-anchored symbols, not line numbers (e.g. `grep -n "CORONA_POOL" stagnantLid.js`).

**What V2-7d is (ROADMAP §3.1 V2-7d row, verbatim intent):** generalize *basal upwelling → quasi-circular lid deformation* from its two structurally different seeds into **one owned module**. It is a **BUILD, not a reuse** (§2.2 SP-LID-DISRUPTION bullet: "FUTURE shared abstraction to be BUILT, not existing shared machinery"). The shipped writers are **not rewired** — consumers arrive later (V2-7 cantaloupe-silicate, V2-9a diapir). **CUTTABLE:** cutting strikes the cantaloupe unlock (V2-7 depends "V2-7d (cantaloupe only)") and forces #4.5 to block-jumble; the #4.5 pick itself stays Max's (§7a "#4.5 residual geometry" row).

---

## 1. Side-by-side structural analysis of the two seeds

### 1a. `shellRelief.js` STEP-2 — space-filling spherical-Voronoi convection tessellation

Anchors: `// ── STEP 2 — convection-cell partition`, `SHELL_DEFAULTS`, `REGIME_WEIGHTS`, `cellId`, `cellInteriorness`, `falloffAng`, `chaosMask`.

| Aspect | Implementation |
|---|---|
| **Gate** | Only runs when `W.CHAOS_W > 0` (regime-selected via `REGIME_WEIGHTS[regime]`; `eyeball-despun` has `CHAOS_W: 0` → no cells at all) |
| **Alea namespace + draw order** | Single interleaved stream `alea('shell:cells:' + seed)`: **draw 1** = `cellCount = CELL_MIN + floor(rng()·CELL_SPAN)` → K ∈ [9,18); then **per cell: 4 draws** — `randDir(rngCells)` (2 draws: z, azimuth) + 2 reserved draws (comment: "polarity/vigor draws (consumed in SLICE B)" — still unconsumed, draw-order placeholders). Separate stream `alea('shell:warp:' + seed)` → `createNoise3D` for domain warp |
| **Placement strategy** | **Uniform random centroids, SPACE-FILLING assignment**: every node gets a `cellId` by nearest-centroid max-dot over the **domain-warped** node position (`WARP_FREQ 1.6`, `WARP_AMP 0.18`; the three offset warp taps `+19.1/−7.3/+3.7` etc. are the same idiom as stagnantLid's `proxAt`). Strict `>` tie-break, lowest index wins (== plates) |
| **Data structures** | `cellId: Int32Array(N)` (partition), `cellInteriorness: Float32Array(N)`, `cellCount: int`. Centers themselves are NOT returned in diagnostics (only `cellId`/`cellCount` are) |
| **Radial coordinate** | **Topological, from walls inward**: multi-source BFS seeded at all nodes with a differing-cellId neighbor (`cellDist`, O(N) queue drain — the only iteration besides relax), then `cellInteriorness = clamp01(1 − exp(−cellDist·meanEdgeAngle / BELT_RADIANS))` (`falloffAng`, `BELT_RADIANS 0.06`). Interior→1, walls→0. No per-cell radius exists — cells are Voronoi-sized |
| **Deformation shape** | **Indirect + stochastic**: STEP-2 writes no relief. `cellInteriorness` gates the STEP-4 chaos overlay: `drive = cellInteriorness · max(0, stressTensile − CHAOS_THRESH)/(1−CHAOS_THRESH)`; `chaosMask = CHAOS_W·smoothstep(drive)`; `chaosRelief = chaosMask·(CHAOS_BASE + CHAOS_AMP·noise3(d·CHAOS_FREQ))` — foundered blocks below datum + raised matrix. The "cantaloupe" read (increment-1 DESIGN: "Cell-interior chaos reads as cantaloupe / diapir terrain") is cell-interior noise texture, **modulated by an INDEPENDENT field** (the STEP-1 stress tensor) that is not part of the cell construction |
| **What it parameterizes** | `CELL_MIN/CELL_SPAN` (count band), `WARP_FREQ/WARP_AMP` (wall irregularity), `BELT_RADIANS` (interiorness falloff), `CHAOS_BASE/CHAOS_AMP/CHAOS_FREQ/CHAOS_THRESH` (texture), `CHAOS_W` (regime weight) |

### 1b. `stagnantLid.js` coronae — sparse rejection-sampled centers with analytic radial profiles

Anchors: `// ── 3. coronae:`, `DEFAULTS` (`CORONA_POOL`, `CORONA_POOL_REF_N`, `CORONA_BIAS`, `CORONA_ACTIVE_FRAC`, `CORONA_RC_MIN_NODES`, `CORONA_SIZE_SKEW`), `proxAt`, `coronaContrib`, `coronaCoverMask`, `A_DOME/A_TRENCH/A_RISE/A_DEP/A_RIM`.

| Aspect | Implementation |
|---|---|
| **Gate** | Always runs (Venus writer); count is emergent, never zero-gated |
| **Alea namespace + draw order** | Single stream `alea('stagnant:corona:' + seed)` with **CONDITIONAL draw count** (load-bearing for byte-identity): per candidate — `randDir` (2 draws) + accept draw (1); **on accept only** + radius draw `u` + active draw = 5 draws accepted / 3 rejected. Upstream dependency: the accept weight reads `proxAt(site).any` built from the **separate** `'stagnant:plumes:'`/`'stagnant:ptype:'`/`'stagnant:warp:'` streams |
| **Placement strategy** | **Sparse rejection sampling, FIELD-BIASED**: pool = `round(CORONA_POOL · N / CORONA_POOL_REF_N)` (∝ N ⇒ resolution-invariant *coverage*); accept probability `pAccept = proxAt(site).any ^ CORONA_BIAS` (tight clustering over the plume field), or the constant `CORONA_CTRL_ACCEPT` under `randomPlacementControl` (the AC4 decoupling control) |
| **Data structures** | Per-feature lists: `coronaCenters[]`, `coronaRadiusArr[]`, `coronaActiveArr[]` (+ diagnostics `coronaCount`, `activeFrac`); per-node `coronaContrib: Float32Array(N)` (**additive `+=`** — overlaps sum), `coronaCoverMask: Uint8Array(N)` |
| **Radial coordinate** | **Metric, per-feature**: `ρ = geodesicDist(vert, center) / R_c`, with a heavy-tailed per-feature radius `R_c = (CORONA_RC_MIN_NODES + u^CORONA_SIZE_SKEW · CORONA_RC_SPAN_NODES) · meanEdgeAngle` and a hard support cutoff `ρ > support → skip` (`CORONA_SUPPORT_ACTIVE 1.6` / `CORONA_SUPPORT_INACTIVE 1.3`) |
| **Deformation shape** | **Direct + analytic, typed per feature**: active = `A_DOME·max(0, 1−(ρ/0.75)²)` − `A_TRENCH·exp(−((ρ−0.95)/0.12)²)` + `A_RISE·exp(−((ρ−1.25)/0.18)²)`; inactive = `−A_DEP·max(0, 1−(ρ/0.85)²)` + `A_RIM·exp(−((ρ−0.95)/0.10)²)`. Type drawn per feature (`CORONA_ACTIVE_FRAC 0.65`, calibrated to 2025 gravity-resolved 52/75). All amplitudes < the `BASE_*` gaps (anti-mush invariant) |
| **What it parameterizes** | Pool/coverage law, bias exponent, radius law (min/span/skew), active fraction, support cutoffs, five profile amplitudes + the fixed profile shape constants (0.75, 0.95, 0.12, 1.25, 0.18, 0.85, 0.10) |

### 1c. The delta in one view

| Axis | shell STEP-2 (cells) | stagnant coronae (foci) |
|---|---|---|
| Coverage | **space-filling partition** — every node owned | **sparse overlay** — most nodes untouched (`coronaCoverMask`) |
| Count | drawn in a fixed band [9,18) | **emergent** from pool × field-biased accept |
| Center placement | uniform on sphere | rejection-sampled ∝ external-field^bias |
| Feature size | implicit (Voronoi tessellation) | explicit per-feature heavy-tailed `R_c` |
| Radial coordinate | BFS hop-distance from **walls**, inward | analytic geodesic ρ from **center**, outward, hard support |
| Deformation | indirect — interiorness **gates noise texture**, modulated by an unrelated stress field | direct — **typed analytic profile** added to relief |
| Per-feature state | none consumed (2 reserved draws/cell) | active/inactive morphology selector |
| Output write | none (STEP-4/5 assemble) | additive `coronaContrib` composed at STEP-6 |
| External coupling | none at construction (stress coupling is downstream) | accept-weight reads the seeded plume field at construction |

**A third, partial implementation exists and matters:** `mixedInterior.js` STEP-7 (anchors: `ID_CORONA`, `CORONA_RC_NODES`, `BREACH_ANNULUS_SCALE`) **re-implements the corona analytic profiles inline** — same dome/trench/rise + rim/depression formulas and support constants, but a *third* placement strategy (coronae grow on shared SP-CENTERS `'lid:'` TENT centers; fixed `Rc = CORONA_RC_NODES·meanEdgeAngle`, no pool, no size skew, no field-biased accept). So the profile *formulas* are already duplicated twice in the repo while the *constructions* differ three ways — direct evidence for §2's split: the profile library is the genuinely shareable 1:1 piece; the placement/tessellation is not.

---

## 2. What the shared module must parameterize — and what it must NOT unify

**R-disrupt's metasystematicity warning (§6):** the two seeds are "Voronoi cells vs sparse corona pool — structurally different"; collapsing them into a fake 1:1 mapping is the named failure mode. Precedent inside the program: SP-CENTERS was resolved as **"a dispatcher over two byte-preserved center constructions, NOT a single unified primitive"** (§2.2 D2-MF6). SP-LID-DISRUPTION should take the same shape one level up: **a FAMILY — two constructors sharing a vocabulary, a profile library, and a discipline — not one function with a mode flag that pretends cells and foci are the same knob.**

**Legitimately shared (unify these):**
1. **The descriptor vocabulary** — both constructions emit "seeded centers + a per-node radial coordinate + per-node deformation channels." A common return shape lets V2-7's editor treat either as an editable `coronaState`-like host channel.
2. **The analytic radial-profile library** — pure functions `ρ → Δh` (dome/trench/rise, rim/depression, and future grooved) parameterized by amplitudes. Already copy-duplicated between `stagnantLid.js` and `mixedInterior.js`; extraction is 1:1 by construction (formula equality is provable, see AC-PROFILE-EQ).
3. **The determinism discipline** — alea-only, one new namespace, fixed documented draw order, `randDir` idiom, no `Math.random`/`Date.now`, bounded iteration only (BFS queue drain / fixed passes).
4. **The resolution-invariance idioms** — pool ∝ N (`CORONA_POOL_REF_N` pattern), sizes × `meanEdgeAngle`, belts in geodesic radians.
5. **The domain-warp idiom** — the identical three-tap warp (`+19.1/−7.3/+3.7`, `−5.2/+11.9/−2.4`) appears verbatim in both seeds; one shared helper is honest reuse.

**Must NOT unify (keep distinct by design):**
1. **Placement**: uniform-then-partition (cells) vs rejection-sampled-field-biased (foci). No shared "placement strategy" parameter — they are different algorithms with different draw orders.
2. **Count semantics**: fixed band vs emergent-from-pool. Do not fabricate a common `n`.
3. **Radial coordinate**: BFS-from-walls-inward vs analytic-ρ-from-center-outward. These are *duals* (wall-referenced vs center-referenced), not the same field with different signs. Expose both; never convert one into the other.
4. **Deformation semantics**: partition + interiorness (a *gate* for consumer-owned texture) vs additive typed profiles (a *relief contribution*). The module returns fields; consumers decide composition.
5. **The stress coupling**: shell's `chaosRelief` is gated by `stressTensile` — that is shellRelief's *physics*, not the disruption construction's. The abstraction must NOT absorb a stress input; consumers multiply/gate externally. (Technical default; recorded as OQ-3.)
6. **The shipped writers' draw streams**: `'shell:cells:'` and `'stagnant:corona:'` stay byte-frozen in their writers. The module draws in its own namespace and will therefore NEVER byte-match shipped worlds — by design (see AC framing: structure-reproduction, not byte-match).

---

## 3. What the two future consumers need

### 3a. V2-7 cantaloupe-silicate (ROADMAP §3.1 V2-7 row + §2.2 bullet + §3.2 #1 disposition)

V2-7 is the epoch/host-editor: "editor-on-host over `plumeField/provinceMap/datumStack/coronaState`," dependency list names "**V2-7d (cantaloupe only)**," unlocks "Frozen-then-pierced; cantaloupe-silicate payoff (requires V2-7d)." §3.2 #1: shellRelief's "convection-cell disruption is the *seed* for SP-LID-DISRUPTION (V2-7d — to be built, not reused)." The cantaloupe-silicate payoff = painting a cell-tessellation disruption epoch onto a **silicate** lid (the look `REGIME_WEIGHTS['volatile-cold']` produces on ice — "cantaloupe cells dominate" — as an epoch expression on a rocky host). What V2-7 therefore needs from V2-7d:
- The **cell constructor runnable on any carrier** independent of shell regime gating (shell's `CHAOS_W>0` gate must not be baked in), in a namespace an epoch layer can key per-epoch (seedKey parameter).
- **Editable persistent descriptors**: center/cell lists + per-node channels the editor can read, modify (e.g. deactivate/age features per epoch), and re-evaluate — i.e. *placement separated from evaluation* (see interface: `evalFoci` split from `makeFoci`).
- **Deformation channels that compose into `datumStack`** rather than writing `carrier.height` — the module must never own composition (V2-7's Jacobi/mass-budget rules live in V2-7, per its row).

### 3b. #4.5 / V2-9a diapir-grooved-coronae (ROADMAP §3.2 #4.5 disposition + §3.3 exotic-shattered row + §7a)

§3.2 #4.5: "Diapir-grooved-coronae branch → covered by the future SP-LID-DISRUPTION family; Miranda block-jumble → small V2-9a primitive." ROADMAP.md #4.5 note pins the science: the favored model is "Uranian-tidal-flexing diapir upwelling… concentric ovoid grooved 'racetrack' coronae (Arden/Inverness) at diapir tops." What the diapir option needs:
- The **foci constructor with a PLUGGABLE profile**: a grooved/racetrack profile (concentric oscillation in ρ) registered alongside dome/trench/rise — so profiles must be data/function-parameterized per feature type, not a hardcoded active/inactive binary.
- **Low-count configurability**: Miranda has ~3 large coronae — the pool/accept law must degrade gracefully to few features (small pool or high floor), without a special case.
- Keeping the option **alive without deciding it**: V2-7d demonstrates a grooved profile on synthetic inputs only; the block-jumble-vs-diapir *geometry pick stays Max's* (§7a). V2-7d must not ship anything that presupposes the answer.

---

## 4. Proposed module interface sketch — `src/worldengine/base/lidDisruption.js`

New file; three-free (imports only `alea`, `simplex-noise` `createNoise3D`, `./mathutil.js`); **new alea namespace `'disrupt:'`** — verified absent from the current inventory (existing namespaces: `climateE5:`, `e1:`, `emissionE:`, `lid:`, `magma:`, `plates:`, `shell:`, `stagnant:`; note `'lid:'` is ALREADY TAKEN by the shipped V2-2 pilot — the §2.2 phrase "new `'lid:'` namespace" was consumed by V2-2/SP-CENTERS, so V2-7d needs its own).

```js
// ── shared profile library (pure, alea-free; extracted formula-identical from stagnantLid STEP-3) ──
export const PROFILE_DEFAULTS = Object.freeze({ /* A_DOME:0.35, A_TRENCH:0.30, A_RISE:0.12, A_DEP:0.18, A_RIM:0.22 + shape consts */ });
export function profileActiveCorona(rho, P)   // dome − trench + rise   (≡ stagnantLid active branch)
export function profileInactiveCorona(rho, P) // −depression + rim      (≡ stagnantLid inactive branch)
export function profileGroovedDiapir(rho, P)  // NEW: concentric ovoid grooves (the #4.5 diapir option; synthetic-only this increment)

// ── constructor 1: space-filling cell disruption (generalizes shellRelief STEP-2) ──
export const CELL_DEFAULTS = Object.freeze({ CELL_MIN:9, CELL_SPAN:9, WARP_FREQ:1.6, WARP_AMP:0.18, BELT_RADIANS:0.06 });
export function makeCellDisruption(carrier, { macroSeed=0, seedKey='disrupt:cells:', tune=null } = {})
// → { mode:'cells', cellId:Int32Array(N), cellCount, interiorness:Float32Array(N), wallDist:Int32Array(N),
//     centers:[[x,y,z]...], meanEdgeAngle }
//   Draw order (documented, frozen): 1 count draw, then 4/cell (randDir 2 + 2 reserved vigor/polarity —
//   kept so a future consumer can consume them without a draw-order break, mirroring shell SLICE-B intent).

// ── constructor 2: sparse foci disruption (generalizes stagnantLid coronae) ──
export const FOCI_DEFAULTS = Object.freeze({ POOL:120, POOL_REF_N:1500, BIAS:2.0, TYPE_FRAC:0.65,
  RC_MIN_NODES:0.5, RC_SPAN_NODES:1.1, SIZE_SKEW:2.5, SUPPORT:[1.6,1.3] });
export function makeFociDisruption(carrier, { macroSeed=0, seedKey='disrupt:foci:', tune=null,
  acceptWeightAt=null /* (dir)→[0,1]; null ⇒ constant accept (the decoupled control) */ } = {})
// → { mode:'foci', centers, radii:Float32Array, typeIds:Uint8Array, count, meanEdgeAngle }
//   Draw order (documented, frozen): per candidate randDir(2) + accept(1); on accept + radius(1) + type(1).

// ── evaluation, split from placement (the V2-7 editor seam) ──
export function evalFociDeformation(carrier, foci, profiles /* typeId → (rho,P)→Δh */, P = PROFILE_DEFAULTS)
// → { contrib:Float32Array(N), coverMask:Uint8Array(N) }  — additive, hard support cutoff per type
```

**Discipline pins:** alea-only in `'disrupt:'`; no `Math.random`/`Date.now`; the ONLY iteration is the O(N) BFS queue drain in `makeCellDisruption` (copied plates/shell pattern) — **no relax inside the module** (relax passes belong to writers/composers, per SP-RELAX); **never writes any carrier channel** (`carrier.height`/`grainAngle`/`faultDensity`/`regime` untouched — consumers compose); `tune ? {...DEFAULTS, ...tune} : DEFAULTS` seam mirrors every sibling writer; **lid-strength coupling enters only as caller-supplied inputs** (`acceptWeightAt` for placement bias; amplitude scaling done by the caller on `P`) — the module never reads L/Φ/stress itself. Precedent for a base/ module with zero production wiring: `interpenetration.js` (test/lab-only instrument; `lidResponse.js` documents "the router itself never imports interpenetration.js").

---

## 5. Proposed AC surface (process/tooling carve-out — infrastructure; NO UAT gate)

Shape per the dev-collab convention (contract ACs carry `layer: unit|integration`; the deliverable is an interface + verifiable observations). **Validation is that the module reproduces the STRUCTURE of each seed pattern on synthetic inputs — explicitly NOT byte-matching shipped worlds** (impossible and undesired: new namespace ⇒ different bytes by design; the shipped writers are untouched).

| AC | Statement (verifiable observation) | Layer |
|---|---|---|
| **AC-0 spine** | Rule 15 card: named consumers = V2-7 (cantaloupe epoch expression) + V2-9a (diapir profile), both FUTURE — this increment's consumer is its own test suite; no driver connectivity claimed (module takes no D-vector); no taxonomy registration (no new regime/archetype) | unit |
| **AC-DET determinism** | Same `macroSeed` ⇒ byte-identical outputs (two independent runs, both constructors + eval); grep: zero `Math.random`/`Date.now`/`while`-to-convergence in the module; all draws in `'disrupt:'`; grep proves no `'magma:'/'stagnant:'/'shell:'/'plates:'/'lid:'/'e1:'` literal inside `lidDisruption.js` | unit |
| **AC-STRUCT-CELLS** | With `tune` matched to `SHELL_DEFAULTS` values on a test mesh: partition is space-filling (every node assigned), `cellCount ∈ [CELL_MIN, CELL_MIN+CELL_SPAN)`, `interiorness ∈ [0,1]` with 0 exactly on wall nodes and monotone-nondecreasing in `wallDist`; wall-node fraction and cell-size distribution within pinned bands across ≥5 seeds (enumerated statistics, gate-3 discipline) | unit |
| **AC-STRUCT-FOCI** | With `tune` matched to stagnant `DEFAULTS` and a SYNTHETIC proximity field: (a) coverage resolution-invariant (two mesh densities, pool ∝ N, coverage fraction within band); (b) field-bias real — mean `acceptWeightAt` over accepted centers exceeds the `acceptWeightAt=null` control (the stagnant AC4 pattern); (c) radius distribution heavy-tailed within the configured band; (d) type split ≈ `TYPE_FRAC` across seeds | unit |
| **AC-PROFILE-EQ** | The extracted profile functions are FORMULA-IDENTICAL to the shipped inline expressions: for sampled ρ grids, `profileActiveCorona/profileInactiveCorona` === the `stagnantLid.js` STEP-3 arithmetic (and the `mixedInterior.js` STEP-7 duplicate) to exact FP equality — pure-function equality, NOT writer-output equality | unit |
| **AC-CONSUMER-SEAM** | The two consumer obligations are demonstrated on synthetic inputs: (a) a test registers `profileGroovedDiapir` for a type and `evalFociDeformation` renders concentric grooves (ring count/spacing asserted) — the #4.5 diapir option is mechanically alive without deciding the geometry pick; (b) placement/eval split: mutate a descriptor (deactivate a focus, change a type) and re-eval WITHOUT redrawing — the V2-7 editor seam | unit |
| **AC-ZERO-WIRING** | No file under `src/` imports `lidDisruption.js` except itself (grep; tests exempt). Diff surface of the increment = new module + new tests ONLY | unit |
| **AC-ZERO-CLOBBER (trivial)** | `npx vitest run` full suite green unchanged; `git diff --stat` vs base shows zero modifications to any existing `src/` file (byte-identity of every shipped writer holds by construction — assert it cheaply via the existing golden/structure suites passing untouched) | integration |
| **UAT** | **None — explicitly carved out.** Infrastructure with no visible surface this increment; believability gates arrive with V2-7/V2-9a. (Contract still records Max's *scope* sign-off; there is just no deferred-to-max visual AC) | — |

---

## 6. Risks + open questions

| # | Risk / question | Default / disposition |
|---|---|---|
| **R1 speculative-generality** | Building an abstraction before either consumer exists risks the wrong interface; V2-7 scoping may demand revisions. | Mitigated by AC-ZERO-WIRING: zero production imports ⇒ interface revision at V2-7 is cheap and non-breaking. Keep the module small; resist adding speculative knobs beyond what the two seeds + two consumer seams need. Technical. |
| **R2 vacuous structure-ACs** | "Reproduces the structure" can degrade into statistics so loose anything passes, or covertly drift toward byte-matching. | Enumerate the statistic list + bands in the contract BEFORE build (the gate-3 precedent: pinned discriminating statistics, validated both directions). Technical. |
| **R3 stress-coupling boundary** | Is the shell chaos gating (`stressTensile`) part of the abstraction? | Default NO — consumer-side modulation (module returns `interiorness`; caller multiplies). Keeps the abstraction honest: disruption ≠ stress physics. Recorded as a designDecision, not an AC. |
| **R4 mixedInterior third copy** | `mixedInterior.js` STEP-7's inline profile duplicate is a standing drift hazard; tempting to absorb it now. | Default: DO NOT touch it this increment (violates zero-production-wiring + zero-clobber). Record "mixedInterior profile absorption" as a deliberate non-goal + a candidate follow-up after V2-7 proves the interface. |
| **R5 namespace/doc drift** | §2.2's "new `'lid:'` namespace" phrasing now collides with the shipped V2-2 `'lid:'` streams; V2-7d must not reuse it. | Use `'disrupt:'`; note the doc nuance in intent.md so the scoper/verifier don't flag a false conflict. Trivially technical. |
| **R6 reserved draws** | Keeping shell's 2 unused per-cell draws in the cell constructor is a draw-order bet on future vigor/polarity consumption. | Keep them (cheap, mirrors shell SLICE-B intent, prevents a future draw-order break). Technical default. |
| **R7 sizing** | Roadmap says M–L. Module itself is M; the enumerated-statistics test work is the bulk. No research gate blocks it (unlike V2-2's three pre-code gates). | Scope as M with the statistics enumeration done at contract time. |
| **OQ-MAX-1 (the only genuinely Max-flavored item)** | Does the grooved-diapir demo profile (AC-CONSUMER-SEAM a) risk *feeling* like the #4.5 geometry decision has been made? §7a keeps that pick Max's. | Surface at scoping: the profile is a synthetic capability proof, not a Miranda look; no preset, no writer, no lab surface. If Max prefers, the grooved profile can be dropped to a stub + test-local function with the pluggability AC kept. |
| **OQ-MAX-2 cuttability check** | V2-7d remains formally CUTTABLE (§3.1). Scoping should re-confirm Max still wants it funded now that V2-2b/V2-3 absorbed more calendar than planned — cutting late wastes the scope; cutting now is free. | Ask once at the scope interview; the roadmap's 2026-07-03 record says "diapir option alive via V2-7d, which stays funded." |

**Dependencies:** V2-7d depends on V2-2 (per §3.1) — satisfied: `lidResponse.js`/`mixedInterior.js` are shipped and the corona-profile duplication they introduced is itself an input to this design. Nothing in V2-7d blocks or is blocked by the in-flight V2-3 dispatch flip (disjoint files).
