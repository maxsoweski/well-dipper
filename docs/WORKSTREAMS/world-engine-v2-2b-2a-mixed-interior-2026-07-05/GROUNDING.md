# V2-2b-2a — Mixed-Interior Composer — GROUNDING

**Written 2026-07-05** (PLAN phase). Consolidated ground truth for the BUILD-PLAN: every constant, formula, `file:line`, the exact Tharsis vector, and the gotchas — each citing its source. Four upstream research memos + two gate DESIGN docs + the live code were read; this doc reconciles them so the BUILD-PLAN can cite one place. Sources are tagged inline as `[src:…]`.

**Source legend.**
- `[src:audit]` = the E1/center/namespace/audit memo (`ground:e1-centers-lid-audit`).
- `[src:seam]` = the lab-seam + byte-safety memo (`ground:lab-seam-byte`).
- `[src:gate2]` = `docs/WORKSTREAMS/world-engine-history-program-2026-06-27/gate-2-localyield-DESIGN.md`.
- `[src:gate3]` = `docs/WORKSTREAMS/world-engine-history-program-2026-06-27/gate-3-interpenetration-statistic-DESIGN.md` + `gate-3-interpenetration-validation.mjs`.
- `[src:code]` = a live-code `file:line` I read this session.
- `[src:contract]` = `contract.json` designDecisions / ACs (same dir).

---

## 1. The seam being replaced (where the composer plugs in)

`writeLidResponseSphere(carrier, drivers, {e1, rawTidal, macroSeed, locked, T_ss, grainDrivers})` — `src/worldengine/base/lidResponse.js:206-235` `[src:code]`. It classifies via `classifyLidPath(e1, rawTidal)` (`lidResponse.js:76`) and switches on `fineClass`:

- `case 'pure-weak':` fills `primitiveId = uniformPrimitiveId(carrier, PRIMITIVE_ID['lava-plain'] /*4*/)` (`:215`) `[src:code]`.
- `case 'pure-strong':` fills `uniformPrimitiveId(carrier, PRIMITIVE_ID['stagnant-basaltic-plain'] /*8*/)` (`:227`) `[src:code]`.
- `default:` (mixed + off-pilot) returns `{ path: fineClass==='mixed' ? 'lid-mixed' : 'lid-offpilot', fineClass, unimplemented:true }` with **carrier.height UNWRITTEN** (`:230-233`) `[src:code]`.

**V2-2b-2a splits `default:` into `case 'mixed':` (calls the composer, writes height, emits multi-valued `primitiveId`+`centerId`+`mixedDiag`, drops `unimplemented`) + `default:` (off-pilot marker unchanged)** `[src:contract designDecision #1]`. The documented return type is `{path, fineClass, primitiveId?, magmaDiag?, stagnantDiag?, unimplemented?}` (`lidResponse.js:202`) `[src:code]` — the mixed return stays within it (adding `centerId`/`mixedDiag` is additive).

`primitiveId`/`centerId` are **NEW router RETURN fields, never hashed carrier fields** (`uniformPrimitiveId` builds a fresh `Int32Array`, `lidResponse.js:154-160`) `[src:code]`; invariant asserted at `tests/worldengine-lid-primitiveid.test.js:74-76` `[src:audit §4]`.

---

## 2. The primitiveId / FAMILY schema (already exported — the composer POPULATES it)

`lidResponse.js` Slice-C exports `[src:code lidResponse.js:125-152]`:

- `FAMILY = Object.freeze({ TENT: 0, PIERCE: 1 })` (`:128`).
- `PRIMITIVE_ID` (`:134`): PIERCE family (ids 1-4) `shield:1, caldera:2, patera:3, 'lava-plain':4`; TENT family (ids 5-8) `corona:5, tessera:6, rift:7, 'stagnant-basaltic-plain':8`. `'lava-plain'`(4) and `'stagnant-basaltic-plain'`(8) are **deliberately distinct** so `familyOf` routes lava-plain→PIERCE, basaltic-plain→TENT (gate-3 Open-Q2) `[src:code :130-133]`.
- `PIERCE_IDS = new Set([1,2,3,4])` (module-private, `:143`).
- `familyOf(id) = PIERCE_IDS.has(id) ? FAMILY.PIERCE : FAMILY.TENT` (exported, `:152`) `[src:code]`.

**Load-bearing plains choice** `[src:audit §3, GROUNDING §5 gotcha G4]`: the mixed interior's preserved ground is strong-lid, so it is `stagnant-basaltic-plain:8` (TENT), **NOT** `lava-plain:4` (PIERCE). This keeps Tharsis's ground TENT and its shields PIERCE, so Π is measurable (a single-family field gives Π≡0).

---

## 3. The E1 tuple the composer consumes (read straight off, do NOT re-derive)

`computeE1(conditionVector, macroSeed, opts)` returns the object at `e1Regime.js:217-230` `[src:audit §1]`. The composer reads:

| Field | Source | Note |
|---|---|---|
| `L` | `lidStrength(cv)` | lid strength ∈ [0,1] |
| `Φ` (unicode key) | `convectiveVigor(cv).phi` | the **compressed** Φ (`sqrt` + `C_TIDAL·rawTidal`), `e1Regime.js:103` |
| `n` | `centerCount(phi, L)` | **the center count — read `e1.n` directly, do NOT re-derive** |
| `m_hp` | `rawTidal − HEATPIPE_PEG(0.45)` | classifier input |
| `compositionClass` | — | must be `'rocky'` to route mixed |
| `geodynamicRegime` | — | not read by the mixed path |

`centerCount(phi,L)` = `clamp(N_MIN, N_MAX, round(N_BASE + N_PHI·min(phi,1.2) + N_L·(1−L)))`; `N_CONSTANTS` (`N_BASE:4, N_PHI:4, N_L:2, N_MIN:3, N_MAX:11`, `e1Regime.js:37`) are **module-private, NOT exported** — so the composer takes the count off `e1.n`, never re-imports the constants `[src:audit §1]`.

**`classifyLidPath` mixed cuts** (`lidResponse.js:76-83`) `[src:seam, src:code]`: returns `'mixed'` for `compositionClass:'rocky'`, `m_hp≤0`, and either `L≥L_STRONG(0.63) ∧ rawTidal≥SHOULDER_LO(0.15)` (tidal-shoulder cut #4) **or** `L≥MIXED_LO(0.35) ∧ L<L_STRONG` (Mars-interior cut #5). Tharsis takes cut #5.

---

## 4. The exact hand-set Tharsis E1 coordinate

From gate-2 §4 line 101 (Tharsis `(L 0.551, Φ 0.27, n 6)` → piercē 1.45, of 6 centers only 1-3 strongest clear yield on a preserved datum) `[src:gate2:101]`, tidally quiet (`rawTidal < SHOULDER_LO 0.15`). This classifies `mixed` via cut #5 (`m_hp≤0`, `MIXED_LO 0.35 ≤ L 0.551 < L_STRONG 0.63`):

```js
const tharsisE1 = {
  compositionClass: 'rocky',      // else off-pilot (cut #1)
  geodynamicRegime: 'dead-lid',   // Mars-like; NOT read by the mixed path, no effectiveL
  m_hp: -0.45,                    // = rawTidal(0) − HEATPIPE_PEG(0.45); ≤0 ⇒ not pure-weak (cut #2)
  L: 0.551,                       // MIXED_LO 0.35 ≤ L < L_STRONG 0.63 ⇒ mixed (cut #5)
  Φ: 0.27,                        // low vigor (unicode key 'Φ')
  n: 6,                           // low center count
};
const tharsisRawTidal = 0;        // < SHOULDER_LO 0.15 (tidally quiet)
```

No preset, no seeded pick, **no `effectiveL`** (reserved for 2b-2b's wet-stagnant world) `[src:contract designDecision #7]`.

**Companion pinned coordinates** (for AC-PIERCE, evaluated as a direct unit test of the boolean — the Venus-strong point classifies pure-strong so is never routed to the composer):
- **Venus-strong** `(L 0.728, Φ 0.69)` → `P(≥1 pierce)=0.000` over 400 seeds `[src:gate2:94,101]`.
- **Colder-Tharsis** `(L 0.575, Φ 0.24)` → mostly 0-1 pierce; the AC-PIERCE sweep's high-L endpoint `[src:gate2:96]`.
- **Compound** `(L 0.60, Φ 0.42)` → reliably ~2 pierce; the pin for the ≥2-legible-shield Π demonstration (see §7 MF4) `[src:gate2:101 band table]`.

---

## 5. The per-center pierce boolean (gate-2 form) — the anti-mush lynchpin

Two per-center `'lid:'` streams, one draw each in plume-index order `[src:gate2:19-26]`:

```
strength_p   = STR_LO + (1 − STR_LO)·u_p,       u_p = rng_strength(),  rng_strength = alea('lid:strength:'+macroSeed)   // gate2:19
localYield_p = Ybase(L)·(1 + SPREAD·(2·y_p − 1)), y_p = rng_yield(),   rng_yield    = alea('lid:yield:'+macroSeed)      // gate2:20-21
Ybase(L)     = Y0·exp(Y_K·L)                                                                                             // gate2:22
pierce_p     = (strength_p · Φ > localYield_p) ? 1 : 0    // SHARP boolean, no partial-pierce blend                    // gate2 / contract dd#3
```

`Φ` is read straight off `e1.Φ` (unicode key, already compressed `[src:gate2 PG-2]` — no re-fit).

### Constants `[src:gate2:32-33]`

| const | value | const | value | const | value |
|---|---|---|---|---|---|
| `STR_LO` | 0.30 | `Y0` | 0.001759 | `N_MIN` | 3 |
| `SPREAD` | 0.30 | `Y_K` | 8.78 | `N_MAX` | 11 |

**Pinned checks** (`Ybase(L)=Y0·exp(Y_K·L)`) `[src:gate2:38]`: `Ybase(0.551)≈0.220`, `Ybase(0.728)≈1.05`, `Ybase(0.16)≈0.0072`. Venus-suppression is the binding fit constraint: `Ybase(0.728)·(1−SPREAD) = 1.05·0.7 = 0.735 > Venus max drive (strength·Φ)max = 1·0.69 = 0.69` ⇒ Venus never pierces `[src:gate2:26]`.

`Y0/Y_K/STR_LO/SPREAD` are **first-cut UAT-tunable** (mirror #4-M's `K_*` / V2-2b-1's `K_*`); the AC asserts SIGN + gate-2's calibrated COUNTS at pinned vectors, not a frozen gain `[src:contract designDecision #3]`. Both streams are drawn **once each per center in plume-index order** `[src:gate2:26]` — draw order is load-bearing for determinism (AC1).

**⚠ do NOT use a random family tag with a forced ≥1/≥1 split.** `[src:audit §2b]` proposed `'lid:pierce:'` as a random family tag with a stagnant-style forced split. The authoritative reconciliation: pierce is a **deterministic boolean from gate-2, NOT a random draw**. A forced split would break AC-PIERCE's Venus-strong `P(≥1)=0.000` pin `[src:gate2:94]`. Tharsis gives 1-3 pierce naturally, no forcing.

---

## 6. Center seeding + per-primitive kernels (mirror the corners; do NOT re-enter them)

### Center set — the `'lid:centers:'` stream
Mirror stagnant's "count-then-centroids on one stream" (`stagnantLid.js:281-284`) but **drive the count from `e1.n`** (do NOT re-derive) `[src:audit §1, §2b]`:
```
const rngCenters = alea('lid:centers:' + macroSeed);
const centers = []; for (let k = 0; k < e1.n; k++) centers.push(randDir(rngCenters));   // 2 draws/center
```
`randDir(rng)` = 2 draws per center (`z = 2·rng()−1`, azimuth `2π·rng()`), copied verbatim from `magmatism.js:137-142` / `stagnantLid.js:172-177` `[src:audit §2]`. Warp/Voronoi partition + BFS geodesic proximity + `nearestPlume` → copy the pattern from `magmatism.js:216-292` (STEP 2 Voronoi, STEP 4 BFS) `[src:audit §2]`. `centerId[i] = nearestPlume[i]` (gate-3 Open-Q3) `[src:audit §2b]`. Warp noise field from `alea('lid:texture:'+macroSeed)` → `createNoise3D`.

### TENT-center type split — the `'lid:type:'` stream
TENT centers split ancient(tessera) vs corona via `isAncient[p] = rngType() < TESSERA_CENTER_FRAC(0.4)`, mirroring `stagnantLid.js:286-288` `[src:audit §2]`.

### Per-primitive kernels (copy verbatim into `mixedInterior.js`; corner writers NOT called) `[src:contract designDecision #1]`

| Center/region | Kernel (mirror source) `[src:audit §3]` | primitiveId (family) |
|---|---|---|
| PIERCE center | F7 shield dome `(1−r)^p` + summit caldera bowl — `magmatism.js:343-352`; `SHIELD_P_LO/HI`, `CALDERA_FRAC=0.15` (`magmatism.js:62-65`), amplitude bounded by budget (§8) | `shield:1`; summit `caldera:2` (PIERCE) |
| TENT + ancient | tessera plateau `BASE_TESSERA` + `steeredNoise3` fold+ribbon fabric — `stagnantLid.js:337-358, 183-202`; `TESS_FOLD_AMP=0.16, TESS_RIBBON_AMP=0.08, FOLD_FREQ=5, RIBBON_FREQ=13` | `tessera:6` (TENT) |
| TENT + corona | active/inactive analytic radial profile — `stagnantLid.js:385-404`; `A_DOME/A_TRENCH/A_RISE/A_DEP/A_RIM`, `CORONA_ACTIVE_FRAC=0.65` | `corona:5` (TENT) |
| rift corridors | analytic `geodesicPointToArc` between nearest center pairs — `stagnantLid.js:206-222, 406-427`; `RIFT_HALFWIDTH_NODES=2.5` | `rift:7` (TENT) |
| preserved lows / background | flat plains datum (the "old flat ground") | `stagnant-basaltic-plain:8` (TENT) |

Copy `steeredNoise3` / `geodesicPointToArc` / `percentileThreshold` / `randDir` verbatim from the corner writers into `mixedInterior.js` — base/ writers take no cross-imports beyond `alea` / `simplex-noise` / `mathutil` `[src:contract designDecision #1]`.

---

## 7. The Π = C·F interpenetration statistic

Port `computeStats(mesh, cls)` from `gate-3-interpenetration-validation.mjs:109-166` into a NEW module `interpenetration.js`, generalized to project `primitiveId` through `familyOf` into the binary `cls` it consumes `[src:gate3, src:audit]`.

- `Π = C·F`; `C` = cross-family co-occurrence, `F = 1 − Σ(e_k/E)²` (family contrast over legible components) `[src:gate3:141-158]`.
- Constants: `PI_STAR=0.15`, `M_MAX=0.70` `[src:gate3 script:286-287]`; `SIZE_FLOOR = max(6, round(0.004·N))` (= 6 at N=1500) `[src:gate3 :20,:29]`.
- Needs `mesh.{verts, adj, edges, meanEdgeAngle, nodeArea}`. `makeSphereField` returns `{N, verts, faces, adj, count}` + field arrays but **NOT** `edges`/`meanEdgeAngle`/`nodeArea` (`sphereField.js:11-20`) `[src:code, src:audit §6]` — so the module DERIVES: `edges` from `adj` (i<j pairs), `meanEdgeAngle` exactly as the writers do (`magmatism.js:182-187`), `nodeArea = 4π/N`. Three O(N·deg) passes, no alea, no convergence loop `[src:gate3:116]`.
- **F=0 for a single legible component** (confirmed: gate-3 pins "single disc F=0.000 Π=0.000") `[src:gate3:58]`. Consequence → §MF4 below: Π on Tharsis is 0 whenever <2 legible pierce components exist.

**cls-as-primitiveId identity mapping** `[src:gate3, adversary anti-mush nit]`: the gate-3 synthetic generators emit `cls ∈ {0,1}`, not enum ids. They reproduce gate-3 only because `familyOf(1)=PIERCE` and `familyOf(0)=TENT` is the identity on `{0,1}`. The AC-INTERPEN synthetic-reproduction leg feeds `cls` directly (already binary); the Tharsis leg feeds `primitiveId` through `familyOf`.

---

## 8. Absolute-datum province stack + NUMERIC edifice budget bound (the §2.4 D1-MF1 fix)

A NEW mechanism — not the corners' stacks `[src:contract designDecision #4]`. Ordered floors mirror stagnant (`stagnantLid.js:62`):
```
BASE_TESSERA = 0.70,  BASE_PLAINS = 0.10,  BASE_RIFT = -0.45
```
Inter-province floor gaps: tessera−plains = **0.60**, plains−rift = **0.55** ⇒ `MIN_FLOOR_GAP = 0.55`.

**The budget bound (the critical fix):** the SUM of all positive within-province contributions above a node's OWN floor must stay strictly below `MIN_FLOOR_GAP`, and MUST include magma's tall edifices (magma's native `EDIFICE_HEIGHT=1.0`, `magmatism.js:57`, would violate it — that is the previous unbounded-magma mush) `[src:contract designDecision #4]`. First-cut budget constants:
```
EDIFICE_BUDGET = 0.40,  AMP_LO = 0.40   // A_e = EDIFICE_BUDGET·(AMP_LO + (1−AMP_LO)·strength_p)
SWELL_BUDGET   = 0.10                   // swell = SWELL_BUDGET · proximity
```
**Corrected budget arithmetic** `[adversary anti-mush nit N1]`: with `STR_LO=0.30` the strength floor makes `strength_p ∈ [0.30,1]`, so `A_e ∈ [0.232, 0.40]` (the **max 0.40** is the only value the bound depends on). Max positive stack **above the plains datum** = `A_e_max + swell_max = 0.40 + 0.10 = 0.50 < MIN_FLOOR_GAP 0.55` ✓. A shield peak reaches `BASE_PLAINS + 0.50 = 0.60 < BASE_TESSERA 0.70`.

- The Walcott moat/apron (`magmatism.js:358`) is **NEGATIVE** → it only relaxes the bound; do NOT count it in the positive sum.
- Tessera fold/ribbon texture sits on the **tessera** datum (nothing sits above tessera) → it is a category error to include it in the plains-relative sum; bound it separately as `< (BASE_TESSERA − BASE_PLAINS) = 0.60`.
- **Edifices add ONLY on the plains datum, never on tessera/corona/rift bases** (§SF3) — the budget arithmetic's premise. Assert no shield/caldera node has a non-plains base.

Assemble with disjoint precedence `rift < plains < corona/tessera`, edifice added on the owning center's plains datum. **NO global cross-province relax** (§MF3).

---

## 9. Namespace + audit reconciliation (`'lid:'` goes live)

Four `'lid:'` streams, all prefix-disjoint from `magma:`/`stagnant:`/`plates:`/`e1:` `[src:gate2 PG-1, src:audit §2b]`:
- `alea('lid:centers:'+macroSeed)` — `n` center directions (count from `e1.n`).
- `alea('lid:strength:'+macroSeed)` — per-center `strength_p` (gate-2, §5).
- `alea('lid:yield:'+macroSeed)` — per-center yield spread `y_p` (gate-2, §5).
- `alea('lid:type:'+macroSeed)` — TENT ancient/corona split; `alea('lid:texture:'+macroSeed)` — warp/detail/fold noise.

**The audit** (`tests/worldengine-lid-router-audit.test.js`) today asserts `lidResponse.js` contains no `alea` and no `lid:` colon `[src:audit §3]`. Reconciliation (separate-module design keeps it clean): the composer lives in NEW `mixedInterior.js`, so `lidResponse.js` gains only `import { writeMixedInteriorSphere } from './mixedInterior.js'` (no `lid:` colon — `'./mixedInterior.js'` has none) + a call → it acquires no `alea`, no `lid:` colon. Precise per-file edits are in the BUILD-PLAN §D.

**⚠ e1-shadow-audit auto-sweep** `[src:code tests/worldengine-e1-shadow-audit.test.js:24-36; adversary byte SF]`: `WRITER_DISPATCH` globs **every `base/*.js` except `e1Regime.js` and `lidResponse.js`** and asserts no `computeE1` reference / no `e1Regime` import. Both NEW modules (`mixedInterior.js`, `interpenetration.js`) are swept in automatically → they MUST declare all constants locally and never import `e1Regime`. Separately, the same test asserts the lab `riverOverlay.route({...})` arg block matches no `/\be1\b/i` outside comments (`:78`) — so the lab render-seam override must be a pre-built identifier (e.g. `labLidOverride: _mixedLidOverride`), with **no bare `e1` token inside the `route({...})` block** (§SF1).

---

## 10. Lab render seam (byte-safety) — and the UNRESOLVED fence conflict

`[src:seam §1-4]` The production dispatch `writeBodyRelief(carrier, {archetype, ...})` (`planet-lod-rivers.js:448`, keys on `archetype` via `isVolcanicPath`/`stagnantLidRegimeOf`, `:454-496`) `[src:code]` **must not change** — the V2-3 flip is out of scope. The 75-golden harness (`tests/v2-0-byte-identity.test.js`) routes through `PRESET_ARCHETYPE → writeBodyRelief`, which never calls `writeLidResponseSphere` → the mixed writer is code the golden harness never reaches → **zero golden movement by construction** `[src:seam §4A]` (independently confirmed by the byte adversary).

**The cleanest render seam** `[src:seam §2]` = one optional `labLidOverride=null` param + one branch + one `get mixedDiag()` getter added to `route()` (`planet-lod-rivers.js:1186-1274`). Every production caller passes no override → `writeBodyRelief` runs verbatim → 75-golden untouched. `carrier.height` swaps into render for free (route already re-points `height = carrier.height` + `bakeHeightCube` when `bakedOn`, `:1220-1252`).

**⚠ UNRESOLVED FENCE CONFLICT (hard gate at Slice B→C).** AC-ZERO-CLOBBER(d)'s allowlist files the render seam under `planet-lod-lab.html` and does **NOT** list `planet-lod-rivers.js` `[src:contract AC-ZERO-CLOBBER(d)]`. The clean seam edits `planet-lod-rivers.js`. These conflict. Options in BUILD-PLAN §E / §MF1; requires Max/scoping sign-off before Slice C. Byte-safety of the route() hook is sound (null-guarded, harness bypasses route()); the conflict is purely fence/scope.

**Probe returns SCALARS ONLY** `[src:seam §3]`: full per-node `U`/`primitiveId` arrays overflow the MCP token limit. `mixedProbe()` returns `pierceCount`, `tentCount`, `primitiveIdHistogram` (≤8 keys), `Pi`, `M`, `path`, `fineClass`, `heightSource`, `beltScale` — read off the router return / stashed `mixedDiag`, never the carrier.

---

## 11. Gotcha register (each a build-time trap)

- **G1 — read `e1.n`, don't re-derive.** `N_CONSTANTS` are module-private in e1Regime.js `[src:audit §1]`.
- **G2 — plains id = `stagnant-basaltic-plain:8` (TENT), not `lava-plain:4`.** Else Tharsis ground reads PIERCE and Π collapses `[src:audit §3, §2 above]`.
- **G3 — pierce is a deterministic boolean, not a random family tag; NO forced ≥1/≥1 split.** A forced split breaks the Venus-strong `P(≥1)=0.000` pin `[src:gate2:94]`.
- **G4 — no global cross-province relax.** A whole-field Jacobi smooth averages across province boundaries → the exact mush AC-MIX-DISCRETE forbids (§MF3).
- **G5 — Π=0 for <2 legible pierce components.** "Π>0 on Tharsis" holds only conditional on ≥2 legible shields (§MF4) `[src:gate3:58]`.
- **G6 — single-seed pierce count [1,3] is flaky (~22-26%).** Gate-2's `[1,3]` is a 400-seed MEAN (piercē 1.45), not a per-seed guarantee (P(0)≈0.22) `[src:gate2:101]` (§MF5).
- **G7 — both new base modules are swept by e1-shadow-audit; keep them e1Regime-free** `[src:code]` (§SF1).
- **G8 — the lab route() arg block must contain no bare `e1` token** `[src:code e1-shadow-audit:78]` (§SF1).
- **G9 — no 4th regime constant.** `verify.js:39` asserts `sub.regime ∈ {0,1,2}`; the composer never writes `carrier.regime` `[src:contract designDecision #9]`.
- **G10 — composer imports only alea/simplex/mathutil.** Importing `familyOf` from lidResponse.js creates a circular import + violates designDecision #1 (§MF2); only `interpenetration.js` imports `familyOf` (one-way, non-circular).
- **G11 — `primitiveId`/`centerId` are RETURN fields, never carrier fields.** They can move no golden `[src:code lidResponse.js:154; worldengine-lid-primitiveid.test.js:74-76]`.

---

## 12. Must-fix synthesis index (folded into BUILD-PLAN, each `[RESOLVED-BY-SYNTH]`)

| tag | severity | one-line | grounding |
|---|---|---|---|
| MF1 | must-fix | render-seam fence conflict — hard gate at Slice B→C (Option A fence-strict / Option B sign-off+amend) | §10 |
| MF2 | must-fix | drop `familyOf` import from composer (circular + dd#1); keep only in `interpenetration.js` | §11 G10 |
| MF3 | must-fix | NO global cross-province relax (smeared boundaries); relax within-province only or drop | §8, §11 G4 |
| MF4 | must-fix | "Π>0 on Tharsis" only conditional on ≥2 legible shields; pin compound `(0.60,0.42)` seed | §7, §11 G5 |
| MF5 | must-fix | pierce-count [1,3] asserted over ensemble/pinned seed, not single unvetted seed | §5, §11 G6 |
| SF1 | should-fix | keep both new modules e1Regime-free; lab route() arg block no bare `e1` token | §9, §11 G7/G8 |
| SF2 | should-fix | AC-ORDER-MIX undefined provinces: ≥1-ancient guarantee, define basin, skip empty | §8 |
| SF3 | should-fix | edifice/tessera overlap: disjoint precedence, edifice on plains datum only | §8, §11 |
| N1 | nit | budget arithmetic A_e∈[0.232,0.40]; drop moat/tessera-texture from plains-relative sum; cls identity | §7, §8 |
| N2 | nit | citation fixes: writeBodyRelief:448, gate-2:26, sphereField full return, publish `beltScale` | §1,§5,§7,§10 |
