# V2-2b-2a — Mixed-interior composition machinery + Tharsis integration checkpoint — BUILD-PLAN

**Written 2026-07-05** (PLAN phase; synthesized from the draft plan + 3 adversarial lenses — byte-safety/zero-clobber, anti-mush correctness, buildability/citation-grounding). **Verdict: BUILD-READY, with ONE hard gate (MF1) that must be resolved with Max at the Slice B→C boundary before the lab render seam is coded.** This increment is the program's **first genuinely novel generative primitive** (every prior increment cloned `plates.js`) — it fills the `mixed` branch of the V2-2a router (`lidResponse.js:230-234`) with a real composer that grows shields where strong centers pierce and coronae/tessera where they tent, on ONE body, and builds the Π=C·F instrument 2b-2b's falsification will consume. Source of truth: `contract.json` (9 ACs) + `GROUNDING.md` (same dir). Every adversary must-fix is folded below and tagged `[RESOLVED-BY-SYNTH]`.

Grounding citations use the same `[src:…]` tags as `GROUNDING.md`; section numbers like `[G§8]` point into GROUNDING.md.

---

## 0. Architecture decisions (settled before slicing)

**D0-1 — separate composer module.** The composer lives in a NEW three-free module `src/worldengine/base/mixedInterior.js` exporting `writeMixedInteriorSphere(carrier, {e1, rawTidal, macroSeed, tune})`, imported by `lidResponse.js` and called from a new `case 'mixed':` arm. Clean path per `[src:audit §3]` / `[G§9]`: `lidResponse.js` gains only `import { writeMixedInteriorSphere } from './mixedInterior.js'` (no `lid:` colon) + a call — no `alea`, no `lid:` colon. The inline alternative forces fragile function-body slicing of the `/\balea\b/` + `/lid:/` audit greps; **rejected**.

**D0-2 — separate statistic module.** Π=C·F lives in a NEW three-free module `src/worldengine/base/interpenetration.js` exporting `interpenetration(mesh, primitiveId, familyOf)` → `{Pi, M, C, F, nComp, nLegible, legibleByFamily}`. Straight port of `computeStats` (`gate-3-interpenetration-validation.mjs:109-166`) generalized to project `primitiveId` through `familyOf` `[G§7]`. `legibleByFamily` (count of ≥SIZE_FLOOR components per family) is added so callers can gate on "≥2 legible pierce components" (MF4).

**D0-3 — final alea stream set** `[G§9, src:gate2 PG-1]`, all prefix-disjoint from `magma:`/`stagnant:`/`plates:`/`e1:`:
- `alea('lid:centers:'+macroSeed)` — the `n` center directions (count from `e1.n`).
- `alea('lid:strength:'+macroSeed)` — per-center `strength_p` (one draw/center, plume-index order).
- `alea('lid:yield:'+macroSeed)` — per-center yield spread `y_p` (one draw/center, plume-index order).
- `alea('lid:type:'+macroSeed)` — TENT ancient/corona split; `alea('lid:texture:'+macroSeed)` — warp/detail/fold noise.

Pierce is a **deterministic boolean from gate-2, NOT a random family tag** `[G§5 G3]` — do NOT use the `[src:audit §2b]` random `'lid:pierce:'` tag with a forced ≥1/≥1 split (it breaks the Venus-strong `P(≥1)=0.000` pin).

---

## Must-fixes folded (each `[RESOLVED-BY-SYNTH]`)

- **[MF1 · must-fix · RESOLVED-BY-SYNTH] Render-seam fence conflict → hard gate at Slice B→C.** The clean render seam edits `planet-lod-rivers.js route()`, which AC-ZERO-CLOBBER(d)'s allowlist omits `[G§10]`. **Resolution:** the builder MUST NOT touch `planet-lod-rivers.js` until this is resolved with Max at the Slice B→C boundary. Two options, decision recorded in BUILD-NOTES before Slice C code:
  - **Option B (recommended):** add the null-default `labLidOverride` param + branch + `get mixedDiag()` to `route()` and **amend AC-ZERO-CLOBBER(d) to add `planet-lod-rivers.js (route() only)`** with the null-guard byte-safety argument (harness bypasses route(); every production caller passes no override). Requires Max/scoping sign-off — a contract touch, not a silent fenced edit.
  - **Option A (fence-strict):** implement the render swap entirely inside `world-engine-lab.html` (compose the mixed carrier from `makeSphereField(riverOverlay.mesh)`, run `writeLidResponseSphere`, inject `carrier.height` + rebake via `applyReliefBake`). Needs a height-injection path the lab does not currently expose — more invasive; prove the 75-golden stays green if taken. Recommendation: take Option B unless Max wants the fence held literally.

- **[MF2 · must-fix · RESOLVED-BY-SYNTH] Composer must NOT import `familyOf`.** The draft had `mixedInterior.js` import `familyOf` from `lidResponse.js` → a **circular import** (`lidResponse ↔ mixedInterior`) + violates designDecision #1. The composer assigns primitiveIds directly from the B-3 kernel table and does not need `familyOf`. **Resolution:** `mixedInterior.js` imports ONLY `alea` / `simplex-noise` / `mathutil`; `familyOf` is imported ONLY by `interpenetration.js` (one-way, non-circular). AC-0's composer-import assertion allows only those three deps `[G§11 G10]`.

- **[MF3 · must-fix · RESOLVED-BY-SYNTH] NO global cross-province relax.** The draft copied `magmatism.js:401-410` (whole-field Jacobi smooth over `carrier.adj`) AFTER the province stack — that averages every boundary node's height across the neighbouring primitive's kernel, i.e. the exact smeared-boundary mush AC-MIX-DISCRETE forbids, and it would make AC-MIX-DISCRETE's own kernel-match check un-passable at boundaries. **Resolution:** the mixed path applies **no cross-province relax**. Within-province smoothing is applied per-province-mask only (or boundary nodes — nodes with ≥1 differently-labelled neighbour — are excluded from the smooth); the kernel-match leg of AC-MIX-DISCRETE is restricted to province INTERIORS `[G§8 G4]`.

- **[MF4 · must-fix · RESOLVED-BY-SYNTH] "Π>0 on Tharsis" only holds conditional on ≥2 legible pierce components.** `Π=C·F`, and `F=0` for a single legible component `[src:gate3:58]`; gate-2's Tharsis histogram gives `P(≤1 pierce)≈0.55`, and a sub-`SIZE_FLOOR`(6-node) shield is illegible → `e_k=0`. So "Π>0 unconditionally" is false for the majority of seeds, and a legitimate 1-shield Tharsis SHOULD read Π=0. **Resolution:** the AC-INTERPEN Tharsis leg (and AC-THARSIS) assert **Π finite ALWAYS, and Π>0 CONDITIONAL on `interpenetration(...).legibleByFamily.pierce ≥ 2`**. Pin the demonstration to the **compound coordinate `(L 0.60, Φ 0.42)`** `[G§4]` (reliably ~2 pierce) at an explicitly-verified `macroSeed`, and assert `legibleByFamily.pierce ≥ 2` BEFORE asserting `Π>0`. This is documented as the gate-3 Open-Q6 "confirm on real output" step, not a guaranteed single-seed property `[src:contract AC-INTERPEN scope fence]`.

- **[MF5 · must-fix · RESOLVED-BY-SYNTH] Pierce count is asserted over an ensemble / pinned seed, never a single unvetted seed.** Gate-2's `[1,3]` is a 400-seed MEAN (piercē 1.45; P(0)≈0.22), so a single-seed hard-assert fails ~1 in 4-5 `[G§5 G6]`. **Resolution:** AC-PIERCE asserts the **mean pierce count over `{1,2,3,7,42}` lands in a stated band around 1.45** (or the empirical `P(1-3)` over that set ≥ a threshold), plus one explicitly-pinned seed verified to land in `[1,3]`. AC-THARSIS reads the probe pierceCount at a pinned, pre-verified seed. The Venus-strong `~0` pin stays a hard single check (P(≥1)=0.000 is robust).

- **[SF1 · should-fix · RESOLVED-BY-SYNTH] e1-shadow-audit sweeps both new modules; lab route() arg block must have no bare `e1`.** `worldengine-e1-shadow-audit.test.js` globs every `base/*.js` except e1Regime.js+lidResponse.js `[G§9 G7]`, so `mixedInterior.js` + `interpenetration.js` are auto-swept and MUST declare all constants locally and never import `e1Regime`. The same test forbids `/\be1\b/i` inside the `route({...})` arg block (`:78`) `[G§9 G8]`. **Resolution:** add `worldengine-e1-shadow-audit.test.js` to every slice's verification set; the lab render-seam override is a **pre-built identifier** threaded as `labLidOverride: _mixedLidOverride` — the `{ e1: … }` object is constructed OUTSIDE the `route({...})` block, so no bare `e1` token appears inside it.

- **[SF2 · should-fix · RESOLVED-BY-SYNTH] AC-ORDER-MIX undefined provinces.** Tessera can be absent (Tharsis: shields+plains+rift, no tessera — intent.md:27), and "basin" maps to no emitted primitive. **Resolution:** (1) define `basin := rift` (the deepest preserved lows / `BASE_RIFT`); (2) AC-ORDER-MIX skips an ordering pair ONLY when a province is genuinely empty at that sweep point, and documents which provinces Tharsis is expected to lack; (3) carry a `≥1-ancient` guarantee into the composer (mirror `stagnantLid.js:289-293`, consumes no extra draws) so tessera is present when the coordinate warrants ancient centers, keeping `mean(tessera)` well-defined where the sweep expects it `[G§8]`.

- **[SF3 · should-fix · RESOLVED-BY-SYNTH] Edifice/tessera spatial overlap.** A node in both a pierce shield disc and a nearby TENT-ancient tessera cap gets an ambiguous primitiveId, and an edifice on the tessera base (0.70+0.40=1.10) breaks the budget arithmetic. **Resolution:** strict **disjoint precedence** so each node resolves to exactly one province/primitive (`edifice > tessera/corona > rift > plains`, resolved per node before height synthesis); the shield edifice adds **ONLY on the plains datum**, never on tessera/corona/rift bases. Assert (AC-ORDER-MIX) that no shield/caldera node has a non-plains base — the budget bound's premise is enforced, not assumed `[G§8 SF3]`.

- **[N1 · nit · RESOLVED-BY-SYNTH] Budget arithmetic.** `A_e ∈ [0.232, 0.40]` (STR_LO=0.30 raises the floor; the max 0.40 is the only bound-relevant value). The Walcott moat is NEGATIVE — dropped from the positive plains-relative sum. Tessera texture sits on the tessera datum — bounded separately `< 0.60`, not in the plains-relative sum. The gate-3 synthetic generators emit `cls∈{0,1}`; they reproduce gate-3 only via the `familyOf(1)=PIERCE`/`familyOf(0)=TENT` identity `[G§7, G§8]`.

- **[N2 · nit · RESOLVED-BY-SYNTH] Citation fixes.** `writeBodyRelief` is at `planet-lod-rivers.js:448` and keys on `archetype` (`:454-496`), not `:1209`. `makeSphereField` returns field arrays too but NOT `edges`/`meanEdgeAngle`/`nodeArea` (the Π module derives them). "Both `lid:` streams drawn once each in plume-index order" is `gate-2:26`. AC-STRUCTURE's squared-Gaussian predictor needs the belt/proximity scale → the composer publishes `beltScale` in `mixedDiag` (and the probe) `[G§ throughout]`.

---

## (A) Slice breakdown with justified seams

**Slice A — the pure mixed composer + all unit ACs on it.**
Build `mixedInterior.js` end-to-end (centers → pierce boolean → per-primitive kernels → disjoint-precedence province resolve → absolute-datum stack + edifice budget → multi-valued `primitiveId` + `centerId` + `mixedDiag` incl. `beltScale`, `strength`, `yield`, `centers`, `pierce`), and wire it into `case 'mixed':` of `writeLidResponseSphere` (`lidResponse.js:210-234`). Prove: AC-0 (grep), AC1 (determinism + first `lid:` draws), AC-PIERCE, AC-STRUCTURE, AC-ORDER-MIX, AC-MIX-DISCRETE.
*Seam justification:* everything here is a pure function of `(e1, rawTidal, macroSeed)` → `carrier.height`+`primitiveId`+`centerId`, headless-testable with no lab and no statistic. Highest-risk work (first novel primitive) → lands first, standalone. NO `planet-lod-rivers.js` edit.

**Slice B — the Π=C·F instrument + AC-INTERPEN + the lid-router-audit reconciliation.**
Build `interpenetration.js` (D0-2), have the composer call it and stash `Pi`/`M`/`legibleByFamily` in `mixedDiag`, and reconcile `tests/worldengine-lid-router-audit.test.js` (per-file `lid:` ownership greps + flip AC-MIXED-STUB). Prove AC-INTERPEN (reproduce gate-3's 100%/0% over 80 synthetic worlds × 2 meshes + conditional-Π on the pinned compound coordinate) + the AC1 namespace-reconciliation leg.
*Seam justification:* the statistic reads the `primitiveId`/`centerId` Slice A emits — cannot exist before Slice A. Pure/headless, lab-independent. Bundling the audit reconciliation keeps all "namespace went live" changes in one reviewable unit. NO `planet-lod-rivers.js` edit.

**⛔ HARD GATE (MF1) at Slice B→C boundary:** resolve the render-seam fence conflict with Max (Option A or B) and record the decision + (for B) the AC-ZERO-CLOBBER(d) amendment in BUILD-NOTES **before** any Slice C code touches the render seam.

**Slice C — the lab mixed-drivers folder + render seam + probe + live AC-THARSIS.**
Add the `Drivers → mixed lid (V2-2b-2)` gui folder, the `_lab.setMixedDrivers/renderMixed/mixedProbe` API, the lab render seam (per the MF1 decision), and the scalar mixed probe. Prove AC-THARSIS live via chrome-devtools.
*Seam justification:* the lab exercises Slices A+B; nothing headless depends on it. Only slice touching the browser; only `live:true` AC.

**AC-ZERO-CLOBBER threaded through EVERY slice:** run `tests/v2-0-byte-identity.test.js` (75-golden) + `tests/worldengine-lid-byte-anchors.test.js` (corner byte-identity) + `tests/worldengine-e1-shadow-audit.test.js` (SF1) after each slice; the golden + corners are trivial-pass by construction (production dispatch never reaches the mixed path, `[G§10 src:seam §4A]`).

---

## (B) Exact mechanism for each piece (constants + file:line)

### B-1. Center seeding — `'lid:centers:'`
Mirror stagnant's "count-then-centroids on one stream" (`stagnantLid.js:281-284`) but **drive the count from `e1.n`** (do NOT re-derive; `[G§3 G1]`). Copy `randDir` (2 draws/center, `magmatism.js:137-142`) verbatim into `mixedInterior.js`.
```
const rngCenters = alea('lid:centers:' + macroSeed);
const centers = []; for (let k = 0; k < e1.n; k++) centers.push(randDir(rngCenters));   // 2 draws each, fixed order
```
Warp/Voronoi partition + BFS geodesic proximity + `nearestPlume` → copy the pattern from `magmatism.js:216-292`. `centerId[i] = nearestPlume[i]` (gate-3 Open-Q3). Warp noise from `alea('lid:texture:'+macroSeed)`. Publish the plume-belt/proximity scale as `mixedDiag.beltScale` (N2 → AC-STRUCTURE).

### B-2. Per-center pierce boolean (gate-2 form) `[G§5]`
```
const rngStrength = alea('lid:strength:' + macroSeed);
const rngYield    = alea('lid:yield:'    + macroSeed);
const STR_LO=0.30, SPREAD=0.30, Y0=0.001759, Y_K=8.78;          // gate-2:32-33 (first-cut UAT-tunable)
const Ybase = Y0 * Math.exp(Y_K * e1.L);                         // Ybase(L)=Y0·exp(Y_K·L), gate-2:22
const strength = new Float32Array(n), pierce = new Uint8Array(n);
for (let p=0;p<n;p++) strength[p] = STR_LO + (1-STR_LO)*rngStrength();     // plume-index order, gate-2:19/26
for (let p=0;p<n;p++){ const y=rngYield();
  const localYield = Ybase*(1 + SPREAD*(2*y-1));                 // gate-2:20-21
  pierce[p] = (strength[p]*e1.Φ > localYield) ? 1 : 0;          // SHARP boolean, gate-2 / dd#3
}
```
`Φ` read straight off `e1.Φ` (unicode key; already compressed, no re-fit `[src:gate2 PG-2]`). Pinned checks: `Ybase(0.551)≈0.220`, `Ybase(0.728)≈1.05`. Publish `strength`/`yield`/`pierce` arrays in `mixedDiag` for the arm's-length AC-PIERCE predictor.

### B-3. Per-primitive kernels (mirror the corners; do NOT re-enter them — dd#1) `[G§6]`
TENT centers split ancient/corona via `alea('lid:type:'+macroSeed)`: `isAncient[p] = rngType() < TESSERA_CENTER_FRAC(0.4)` (mirror `stagnantLid.js:288`), with the **≥1-ancient guarantee** carried over (SF2, `stagnantLid.js:289-293`, no extra draws).

| Center/region | Kernel (mirror source) | primitiveId (family) |
|---|---|---|
| PIERCE center | F7 shield `(1−r)^p` + summit caldera bowl — `magmatism.js:343-352`; `CALDERA_FRAC=0.15` (`:62-65`); amplitude bounded by budget (B-4) | `shield:1`; summit `caldera:2` (PIERCE) |
| TENT + ancient | tessera plateau `BASE_TESSERA` + `steeredNoise3` fold+ribbon — `stagnantLid.js:337-358,183-202`; `TESS_FOLD_AMP=0.16, TESS_RIBBON_AMP=0.08, FOLD_FREQ=5, RIBBON_FREQ=13` | `tessera:6` (TENT) |
| TENT + corona | active/inactive analytic radial profile — `stagnantLid.js:385-404`; `CORONA_ACTIVE_FRAC=0.65` | `corona:5` (TENT) |
| rift corridors | analytic `geodesicPointToArc` between nearest center pairs — `stagnantLid.js:206-222,406-427`; `RIFT_HALFWIDTH_NODES=2.5` | `rift:7` (TENT) |
| preserved lows / background | flat plains datum ("old flat ground") | `stagnant-basaltic-plain:8` (TENT) |

**Plains id = `stagnant-basaltic-plain:8` (TENT), NOT `lava-plain:4`** `[G§2 G2]` — keeps Tharsis ground TENT + shields PIERCE so Π is measurable. Copy `steeredNoise3`/`geodesicPointToArc`/`percentileThreshold`/`randDir` verbatim into `mixedInterior.js`.

### B-4. Absolute-datum province stack + NUMERIC edifice budget bound (§2.4 D1-MF1 fix) `[G§8]`
```
BASE_TESSERA=0.70, BASE_PLAINS=0.10, BASE_RIFT=-0.45   // mirror stagnantLid.js:62
// floor gaps: tessera−plains=0.60, plains−rift=0.55  ⇒  MIN_FLOOR_GAP=0.55
EDIFICE_BUDGET=0.40, AMP_LO=0.40   // A_e = EDIFICE_BUDGET*(AMP_LO+(1-AMP_LO)*strength_p) ∈ [0.232,0.40]  (N1)
SWELL_BUDGET=0.10                  // swell = SWELL_BUDGET * proximity
// max positive plains-relative stack = A_e_max + swell_max = 0.40 + 0.10 = 0.50 < MIN_FLOOR_GAP 0.55 ✓
```
**Budget bound (the critical fix):** SUM of positive within-province contributions above a node's own floor stays strictly `< MIN_FLOOR_GAP`, **including magma's tall edifices** (native `EDIFICE_HEIGHT=1.0`, `magmatism.js:57`, would violate it — the previous unbounded-magma mush, dd#4). Moat is negative (excluded from the positive sum, N1); tessera texture is bounded separately `< 0.60` on the tessera datum (N1). **Disjoint precedence** (SF3): resolve each node to exactly one province (`edifice > tessera/corona > rift > plains`) BEFORE height synthesis; edifice adds ONLY on the plains datum. **NO global cross-province relax** (MF3) — within-province smoothing on per-province masks / boundary-excluded only.

### B-5. Multi-valued `primitiveId` + `centerId` emission `[G§1, G§11]`
Replace the corners' `uniformPrimitiveId` fill (`lidResponse.js:154-160,215,227`) with the composer's own multi-valued fill off the `lid:centers:` set. `primitiveId = new Int32Array(carrier.count)`, each node = its resolved id from B-3; `centerId = Int32Array` from `nearestPlume`. Both are **NEW router RETURN fields, never hashed carrier fields** (invariant `worldengine-lid-primitiveid.test.js:74-76`) → move no golden. `case 'mixed':` returns `{ path:'lid-mixed', fineClass:'mixed', primitiveId, centerId, mixedDiag }` **without** `unimplemented`; `off-pilot` stays the `default:` marker. Return stays within the documented type (`lidResponse.js:202`).

### B-6. The Π=C·F statistic `[G§7]`
Port `computeStats` (`gate-3-interpenetration-validation.mjs:109-166`) into `interpenetration.js`. `PI_STAR=0.15`, `M_MAX=0.70` (`gate-3 script:286-287`), `SIZE_FLOOR=max(6,round(0.004·N))`. Derive `edges` from `adj` (i<j), `meanEdgeAngle` as `magmatism.js:182-187`, `nodeArea=4π/N`. Emit `legibleByFamily` (per-family count of ≥SIZE_FLOOR components) so callers gate MF4. Imports `familyOf` from `lidResponse.js` (one-way, non-circular; MF2). No alea, no convergence loop.

---

## (C) Exact hand-set Tharsis E1 coordinate `[G§4]`

```js
const tharsisE1 = { compositionClass:'rocky', geodynamicRegime:'dead-lid', m_hp:-0.45, L:0.551, Φ:0.27, n:6 };
const tharsisRawTidal = 0;   // < SHOULDER_LO 0.15 → classifies 'mixed' via cut #5 (MIXED_LO 0.35 ≤ L < L_STRONG 0.63)
```
No preset, no seeded pick, no `effectiveL` (reserved for 2b-2b, dd#7). AC-PIERCE Venus-strong `~0` pin evaluates the boolean in isolation at `(L 0.728, Φ 0.69)` (that coordinate classifies pure-strong, never routed to the composer). Colder-Tharsis `(L 0.575, Φ 0.24)` is the sweep's high-L endpoint. **Π demonstration (MF4) is pinned to the compound coordinate `(L 0.60, Φ 0.42)` at a verified seed** (reliably ≥2 legible pierce components).

---

## (D) Per-AC verification approach

New test files: `tests/worldengine-mixed-composer.test.js` (AC-0, AC1, AC-STRUCTURE, AC-ORDER-MIX, AC-MIX-DISCRETE), `tests/worldengine-mixed-pierce.test.js` (AC-PIERCE), `tests/worldengine-interpenetration.test.js` (AC-INTERPEN). Reconcile `tests/worldengine-lid-router-audit.test.js`. All headless build the real mesh via `carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD))` at `TARGET_N=1500, LLOYD=2` (the exact pattern at `worldengine-lid-router-audit.test.js:26` / `worldengine-lid-byte-anchors.test.js:32`).

- **AC-0 (grep + conformance table).** grep `mixedInterior.js` (stripComments) with the V2-2a denylist: `.not.toMatch(/\.label\b/)`, `/PRESET_ARCHETYPE/`, `/stagnantLidRegimeOf/`, `/isVolcanicPath/`, `/archetype/` (mirror `worldengine-lid-router-audit.test.js:92-94`). **Assert the composer imports ONLY `alea`/`simplex-noise`/`mathutil` — NOT `familyOf`/`e1Regime`/`computeE1`** (MF2 + SF1). Map each emitted channel to a named reader in a BUILD-NOTES table (primitiveId→AC-MIX-DISCRETE+probe; centerId→Π; pierce/coverage/beltScale→AC-ORDER-MIX/AC-STRUCTURE+probe). Run `npx vitest run tests/planet-archetypes.test.js` (drift guards green).

- **AC1 (determinism + first `lid:` draws).** grep composer for `Math.random`/`Date.now` (absent) and for `lid:centers:`/`lid:strength:`/`lid:yield:` (present). Build the mixed field twice on fresh carriers at seeds `{1,2,3,7,42}`; assert `Float32Array` equality of `carrier.height` + `Int32Array` equality of `primitiveId`+`centerId`+diag arrays (run-twice idiom, `worldengine-lid-router-audit.test.js:47-58`). Assert `carrier.regime` untouched (no 4th regime constant, verify.js:39).

- **AC-PIERCE (arm's-length boolean sweep + ENSEMBLE assert — MF5).** Recompute per-center `strength_p·Φ > Ybase(L)·(1+SPREAD(2y_p−1))` independently from the published `strength`/`yield` diag arrays. Assert: **mean pierce count over `{1,2,3,7,42}` at Tharsis lands in a band around 1.45** (+ one explicitly-pinned seed in `[1,3]`); Venus-strong `(0.728,0.69)` → 0 (hard single check, robust); pierce count monotone non-decreasing in Φ / non-increasing in L (no inversion); every center resolves to exactly PIERCE or TENT.

- **AC-STRUCTURE (arm's-length center predictor).** Rebuild the squared-Gaussian predictor from published `centers` + `mixedDiag.beltScale` (N2) exactly as `stagnantLidProbe` (`world-engine-lab.html:6141-6146`): `pred[i]=max_p exp(-(acos(dir·center_p)/BELT)²)`. Assert `|corr(structureMask,pred)| ≥ 0.40` AND `>` the latitude signal, and `varExplainedByLatitude = r²(U, sin²(+y)) < varExplainedByCenter` at every sweep point.

- **AC-ORDER-MIX (province masks from primitiveId + budget bound; SF2/SF3).** Across the sweep + 5 seeds, build masks keyed by `primitiveId` (tessera=6, plains=8, rift=7, edifice=1/2). Assert `mean(tessera) > mean(plains) > mean(rift)` (skip a pair ONLY when a province is genuinely empty, e.g. Tharsis lacks tessera — SF2) AND `edifice > plain > basin` with `basin := rift` (SF2). **Separately** assert `max(per-node edifice contribution above its plains datum, over the whole sweep) < MIN_FLOOR_GAP` — magma edifices included (MF-N1) — AND assert **no shield/caldera node has a non-plains base** (SF3).

- **AC-MIX-DISCRETE (measured ON primitiveId, interiors for the kernel-match — MF3).** Assert every node has exactly one `primitiveId` in the enum (no sentinel/blend id). Check boundary sharpness via **primitiveId adjacency** (adjacent differing-id nodes = discrete change). Restrict the height-kernel-match leg to province **INTERIORS** (nodes whose neighbours all share their primitiveId), accounting for within-province texture — because with no cross-province relax (MF3), interior heights equal a single kernel; boundary nodes are checked on primitiveId, not height. Assert the Tharsis histogram is a small discrete populated set (shield + basaltic-plain + rift), not a continuum.

- **AC-INTERPEN (reproduce gate-3 + conditional Tharsis Π — MF4/N1).** Two legs. (1) **Synthetic:** add `export` to the generators `genTiled/genCompound/genCompoundMixed/genScatter` (`gate-3-interpenetration-validation.mjs:168-224`) + `buildFibSphere`, import them, run `interpenetration()` over the 80-world sweep (f∈{0.10,0.30} × N∈{1500,40962} × 5 seeds × 4 classes) feeding `cls∈{0,1}` directly (the `familyOf` identity on {0,1}, N1), assert COMPOUND/COMPOUND-MIXED 100% PASS, TILED/SCATTER 0% PASS, `PASS ⇔ Π≥0.15 ∧ M≤0.70` (`gate-3-DESIGN.md:88-93`). (2) **Tharsis (MF4):** compute `{Pi, M, legibleByFamily}` on the pinned compound coordinate `(0.60,0.42)`+verified seed; assert `Pi` **finite always**, and `Pi>0` **conditional on `legibleByFamily.pierce ≥ 2`** (asserted first). Scope fence: no falsification-grade tiling claim here (dd#5).

- **The lid-router-audit reconciliation** (per `[src:audit §3]`, exact edits). After `RIVERS_CODE` (`worldengine-lid-router-audit.test.js:34`) add `MAGMA_CODE`, `STAGNANT_CODE`, `COMPOSER_CODE = stripComments(readSrc('../src/worldengine/base/mixedInterior.js'))`. Rewrite the AC1 reservation `it` (lines 38-45) into ownership:
  - `MAGMA_CODE`/`STAGNANT_CODE` `.not.toMatch(/lid:/)` (corners make zero `lid:` draws → byte-identity holds).
  - `LID_CODE` `.not.toMatch(/\balea\b/)` and `.not.toMatch(/lid:/)` (router delegates; `'./mixedInterior.js'` has no `lid:` colon).
  - `COMPOSER_CODE` `.toMatch(/lid:centers:/)` and `.toMatch(/lid:strength:/)` (composer OWNS the namespace).
  - Update the `describe` title (line 37): active-in-composer, forbidden-in-router+corners.
  **Flip AC-MIXED-STUB** (lines 61-87, `mixed` half only): assert `mixed` now WRITES height (byte-changed from sentinel), emits present + multi-valued `primitiveId`, `unimplemented` absent, plus `centerId`. Off-pilot half (lines 78-86) stays valid unchanged.

- **AC-ZERO-CLOBBER (byte-diff + 75-golden + shadow-audit).** `npx vitest run tests/v2-0-byte-identity.test.js` → 75/75 (trivial pass: mixed path un-wired at production dispatch; `writeBodyRelief` keys on `PRESET_ARCHETYPE`, `planet-lod-rivers.js:448-496` — N2). `tests/worldengine-lid-byte-anchors.test.js` (corner dual-carrier diff `{1,2,3,7,42}`) green (`magmatism.js`/`stagnantLid.js` untouched). `tests/worldengine-e1-shadow-audit.test.js` green (SF1). `git show --stat` vs the (E) allowlist. Full `npx vitest run`; the 4 known failures (KnownObjects ×3, GalacticFeatures ×1) must not grow.

- **AC-THARSIS (live, chrome-devtools — MF4/MF5).** Fresh Chrome tab on `127.0.0.1:9223` at `localhost:5173/well-dipper/world-engine-lab.html` (verify liveness via `list_pages`, per sandbox-localhost-probe). Open the mixed-drivers folder, `_lab.setMixedDrivers(tharsis)` + `renderMixed`, force route, read `_lab.mixedProbe()`, screenshot. Assert `heightSource=='carrier'`, pierceCount at the pinned pre-verified seed within `[1,3]` (MF5), primitiveId histogram = shield + preserved-plain + rift, `Pi` finite (and `>0` only on the ≥2-legible-shield demo coordinate, MF4), console clean of NEW errors. Close pages when done. `mixedProbe` returns SCALARS ONLY `[G§10 src:seam §3]`: `pierceCount`, `tentCount`, `primitiveIdHistogram` (≤8 keys), `Pi`, `M`, `beltScale`, `path`, `fineClass`, `heightSource` — read off the router return / stashed `mixedDiag`, never the carrier.

---

## (E) FILE-FENCE allowlist (matching AC-ZERO-CLOBBER(d))

`git show --stat` for the workstream must touch ONLY:

1. `src/worldengine/base/lidResponse.js` — split `default:` into `case 'mixed':` (calls composer) + `default:` (off-pilot marker); add `import { writeMixedInteriorSphere }`.
2. `src/worldengine/base/mixedInterior.js` — **NEW** composer (three-free; imports ONLY alea/simplex/mathutil — MF2/SF1).
3. `src/worldengine/base/interpenetration.js` — **NEW** Π=C·F statistic (three-free + `familyOf` from lidResponse.js, one-way — MF2).
4. `world-engine-lab.html` — mixed-drivers folder + `_lab` API + lab render seam (per MF1 decision) + scalar probe.
5. `tests/worldengine-mixed-composer.test.js`, `tests/worldengine-mixed-pierce.test.js`, `tests/worldengine-interpenetration.test.js` — **NEW**.
6. `tests/worldengine-lid-router-audit.test.js` — reconciled (audit greps + AC-MIXED-STUB flip).
7. `gate-3-interpenetration-validation.mjs` — **`export` added to the synthetic generators only** (no logic change; needed so AC-INTERPEN imports them). *Flag: under `docs/WORKSTREAMS/…program…/`; adding exports is behavior-inert, but confirm acceptable, else copy the generators into the test.*
8. `docs/WORKSTREAMS/world-engine-v2-2b-2a-mixed-interior-2026-07-05/{GROUNDING.md, BUILD-PLAN.md, BUILD-NOTES.md}` — docs.
9. **CONDITIONAL on MF1 Option B (requires Max sign-off):** `planet-lod-rivers.js` — `route()` only (null-default `labLidOverride` param + branch + `get mixedDiag()`), with the AC-ZERO-CLOBBER(d) amendment recorded. **Not touched under Option A.**

**FORBIDDEN (contract `mustStayWorking`):** `magmatism.js`, `stagnantLid.js`, `plates.js`, `shellRelief.js`, `tectonic.js`, `sphereField.js`, `e1Regime.js` (except an OPTIONAL `MOBILE_L` export per V2-2a R-A3 — not needed here), `verify.js`, `body-drivers.js`, `body-condition-vector.js`, `driver-presets.js`. Do NOT add a 4th `carrier.regime` constant (`verify.js:39` asserts `sub.regime ∈ {0,1,2}`). Do NOT edit `planet-lod-rivers.js` before the MF1 gate resolves.

---

## (F) Terminal gate

Objective checkpoint — **no UAT AC** (dd#10). All 9 observables are agent-assertable. Integration green → terminal gate = **VERIFIED** (like V2-2a/V2-0), NOT `VERIFIED_PENDING_MAX`. The holistic "does a mixed world read coherent/distinct/never-observed" taste judgment is the PILOT UAT, deferred to 2b-2b by design (§5.4: Tharsis is an integration checkpoint, not a falsification).
