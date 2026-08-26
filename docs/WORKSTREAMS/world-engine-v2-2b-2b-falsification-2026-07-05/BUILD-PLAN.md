# V2-2b-2b — Falsification worlds (wet-stagnant + corona-pierced) + Π assertion + pilot UAT — BUILD-PLAN

**Written 2026-07-05** (PLAN phase; synthesized from `contract.json` (8 ACs + 6 settled designDecisions),
`intent.md`, and two code-grounded reader reports). This is the **honesty half** of V2-2b-2: it EXTENDS the
2b-2a composer (`mixedInterior.js`) + CONSUMES the 2b-2a Π instrument (`interpenetration.js`, untouched) to
build the two worlds that can falsify the condition-first bet — the **wet-stagnant** world (via `effectiveL`
threading) and the **corona-pierced** compound landform — then ASSERTS pierce/tent interpenetration on world B,
and earns the pilot's holistic UAT. Terminal gate = **VERIFIED_PENDING_MAX** (carries a UAT AC), not VERIFIED.

Line cites verified against HEAD `ecad42d`, branch `feature/world-engine-production-L1`. All numeric arithmetic
(Ybase, effectiveL, pierce fractions) reproduced by the reader agents with `node`; trust the cites.
`designDecisions` are **settled with Max** — do NOT re-litigate them (no `e1Regime.js` edit; corona-pierced is a
compound CENTER TYPE not a new `primitiveId`; the Π assertion rides world B; wet-stagnant UAT bar is basis-level).

---

## 0. The ONE deferred design call — THE BREACH MECHANISM DECISION

designDecision #2 defers the breach threshold ("deterministic from strength; exact threshold a build-plan call,
first-cut UAT-tunable like gate-2's Y0/Y_K"). **DECISION: adopt the grounding's mechanism (a) — a Φ-gated,
strength-driven sub-pierce band on the EXISTING draws, no new alea stream.** Per corona-type center:

```
breach[p] = ( !pierce[p] && !isAncient[p]                       // a corona-type (TENT non-ancient) center …
           && PHI > PHI_BREACH                                  // … on a corona-pierce-CAPABLE world (regime gate)
           && strength[p]*PHI >= BREACH_LO * localYield[p] )    // … whose plume sits just below its pierce cut
```

`localYield[p] = Ybase·(1+SPREAD·(2·yspread[p]−1))` is the SAME quantity STEP 2 already computes (`:194`) from the
already-drawn `strength[p]`/`yspread[p]`. **First-cut constants (UAT-tunable, named like gate-2's Y0/Y_K):**

| Constant | First-cut | Role (retune exactly like Y0/Y_K, gate-2 §7) |
|---|---|---|
| `PHI_BREACH` | **0.45** | Which worlds are corona-pierce-capable. MUST be **strictly > 0.42** (the cross-check Φ). |
| `BREACH_LO`  | **0.75** | How close to piercing a plume must get to breach (band width). |

**Why (a) over (b) a new `lid:breach:` stream / (c) no Φ-gate:** (a) adds **ZERO alea draws and ZERO draw-order
change** (streams `strength`/`yield`/`type`/`texture`/`centers` are byte-identical), leaves `pierce[]`/`pierceCount`
untouched (all of `worldengine-mixed-pierce.test.js` passes unchanged), and reuses the existing `Psi_e`/STEP-9
precedence. Option (b) buys nothing but a wider `lid:` audit; (c) makes the two hardest AC clauses seed-luck. Only
(a) makes them **true by construction** (§0-byte-safety).

### The byte-safety argument (3 lines — the decisive property)
1. **No draw / no reorder:** mechanism (a) consumes no alea; the only output change is at nodes near a *breach-firing*
   center, and `breach[p]≡0` ⇒ `pierceR`/`primitiveId`/`U` are **bit-for-bit** 2b-2a.
2. **Tharsis control (Φ 0.27):** `0.27 > 0.45` is false ⇒ `breach≡0` ⇒ **zero corona-pierced centers structurally**
   (satisfies AC-CORONA-PIERCED(c)) and every `worldengine-mixed-composer` Tharsis assertion is byte-identical.
3. **Cross-check (L 0.60, Φ 0.42) seed 2:** `0.42 > 0.45` is false ⇒ `breach≡0` ⇒ `primitiveId` byte-identical ⇒
   **Π ≈ 0.662 reproduced exactly** (working-Claude MEASURED `Π=0.6621875839828004`, M=0.291, legiblePierce=3 at HEAD
   `ecad42d` via the LEG-2 idiom → `toBeCloseTo(0.66,2)`). [ADV-FIXED: buildability] The prior "0.627/0.63" was
   MIS-ATTRIBUTED: BUILD-NOTES 2b-2a:112 ties 0.63 to the DIFFERENT **Tharsis** coordinate `{L 0.551, Φ 0.27}` (in its
   Live AC-THARSIS block), NOT this one; the 2b-2a LEG-2 test at (0.60,0.42) only ever asserted `Π>0`, never the exact
   value. Root cause: L/Φ enter the composer field ONLY through the pierce boolean (`:189` Ybase, `:195` compare), so at
   seed 2 the compound (0.60,0.42) and Tharsis (0.551,0.27) share the same 3-pierce pattern → a **bit-identical field →
   identical Π** (I confirmed both measure 0.6621875839828004). No contract exception needed. If a build ever raises
   `PHI_BREACH` at or below 0.42, THIS reproduction breaks — the gate must stay > 0.42.

---

## 1. Slice table

**One commit per slice. Stage the EXPLICIT file list per commit — NEVER `git add -A`** (the checkout carries
not-ours dirty files `src/auto/CameraChoreographer.js` + `src/debug/LabMode.js` + an untracked screenshot pile;
they stay out of every commit — contract `mustStayWorking` / feedback_stage-only-touched). **AC-ZERO-CLOBBER is
threaded through EVERY slice:** after each, run `npx vitest run tests/v2-0-byte-identity.test.js` (75-golden),
`tests/worldengine-lid-byte-anchors.test.js` (corners), `tests/worldengine-e1-shadow-audit.test.js`,
`tests/planet-archetypes.test.js` (drift) — all trivial-pass by construction (production dispatch never reaches the
mixed path; `writeBodyRelief` keys on `PRESET_ARCHETYPE`; `route()` byte-inert without `labLidOverride`).

### SLICE 1 — effectiveL threading (wet-stagnant world)
**Goal:** wire the R-wetstag hand-up — `classifyLidPath` + the composer `Ybase` read `effectiveL ?? L` — so a wet
seeded-'stagnant' body routes to `'mixed'` (not off-pilot) and pierces at the strong-but-piercable edge (not
pervasively). **ACs:** AC-EFFECTIVEL, AC-WETSTAG-BASIS (+ AC-0, AC-ZERO-CLOBBER threaded).
**Files:** `src/worldengine/base/lidResponse.js`, `src/worldengine/base/mixedInterior.js`,
`tests/worldengine-lid-classifier.test.js` (reconcile), `tests/worldengine-effectivel.test.js` (NEW), BUILD docs.

**Exact edits:**
- **lidResponse.js `classifyLidPath` (:81-88).** Insert after cut #2, keep cuts #1/#2 on raw fields:
  ```
  if (e1.m_hp > 0) return 'pure-weak';                 // 2 — raw m_hp (effectiveL can never reach pure-weak)
  const L = e1.effectiveL ?? e1.L;                     // R-wetstag hand-up (§5.4 #1 / gate-2 §4) — ONLY the L-cuts
  if (L >= L_STRONG && rawTidal < SHOULDER_LO) …       // 3   move e1.L → L at :84,:85,:86
  ```
  Cuts #1 (`compositionClass`) + #2 (`m_hp`) stay RAW — this IS the guard: effectiveL moves only the L-cuts, never
  routes to pure-weak or off-via-composition. **`isUnbrokenLidPath` (:110) stays RAW `e1.L` — DO NOT thread** (its
  L-guard keeps a low-raw-L seeded-stagnant body off the Venus pilot; threading would misread a synthetic dry tuple).
- **lidResponse.js:30-34** — rewrite the "SEED-INDEPENDENCE (R-A2, load-bearing)" comment (§4 reconciliation).
- **mixedInterior.js Ybase.** Keep `const L = e1.L` raw at `:167`; add `const Lyield = e1.effectiveL ?? L;`. Change
  `:189` `Math.exp(T.Y_K * L)` → `Math.exp(T.Y_K * Lyield)`. In `mixedDiag` (`:388-396`) keep `L` = raw, **add
  `effectiveL: Lyield`** (`Ybase` at `:394` now reflects effectiveL automatically). Backward-compatible: existing
  tuples carry no `effectiveL` ⇒ `Lyield===L` ⇒ byte-unchanged.

**Tests:** `worldengine-effectivel.test.js` (NEW) — **AC-EFFECTIVEL** (a) wet `{compositionClass:'rocky',
geodynamicRegime:'stagnant', m_hp:-0.45, L:0.16, effectiveL:0.60}` → `classifyLidPath==='mixed'`; control
`{...wet, effectiveL:undefined}` → `'off-pilot'` (raw L 0.16 < MIXED_LO). Also derive one wet tuple via
`computeE1(cv, seed, {weights:{mobile:0,episodic:0,stagnant:1}})` to prove the REAL machinery emits effectiveL.
(b) dry `{…, L:0.20, effectiveL:0.65}` → `'pure-strong'` (rawTidal 0 < SHOULDER_LO). (c) composer at
`(effectiveL 0.60, Φ 0.42, n 6)` vs effectiveL-stripped (raw L 0.16): assert `mixedDiag.Ybase`≈0.3413 (effectiveL)
vs 0.0072 (rawL) and `pierceCount` small-handful vs pervasive; `git diff e1Regime.js` empty.
**AC-WETSTAG-BASIS** — reuse the `worldengine-mixed-composer.test.js:61-97` helpers (`centerPredictor`,
`structureMask`, `latY`, `pearson`) copied into the file; at the wet coordinate × seeds {1,2,3,7,42}: TENT-family-
dominant histogram + minority PIERCE; `|corr(structureMask, predictor)| ≥ 0.40` AND `cLat² < cCenter²`; distinct per
seed; wet primitiveId histogram measurably ≠ the Venus `{L:0.728, Φ:0.69, n:6}` composer histogram (a
**histogram-DIFFERENCE** assertion — the "not a re-rolled Venus" bar; the wet world's own minority PIERCE presence is
asserted directly). [ADV-FIXED: buildability] **Do NOT assert "Venus → 0 pierce / all TENT"**: Venus's Φ 0.69 is
ABOVE `PHI_BREACH` 0.45, so once SLICE 2 lands, breach CAN fire in the Venus composer build (~1/5 seeds, incl. seed 1
→ breachCount=1 → a shield core) — the "all TENT" sub-claim is false. The histogram-DIFFERENCE holds regardless; if a
zero-pierce Venus anchor is ever wanted, pin a breach-free Venus seed or a Φ≤0.42 pure-strong reference.
**Reconcile** `worldengine-lid-classifier.test.js` (§4). **Guardrails:** AC-ZERO-CLOBBER quartet; `git-diff
e1Regime.js`/`interpenetration.js` empty.
**Commit:** `feat(worldengine): thread effectiveL into classifyLidPath + composer Ybase (wet-stagnant world) [V2-2b-2b AC-EFFECTIVEL/AC-WETSTAG-BASIS]`

### SLICE 2 — corona-pierced compound center
**Goal:** grow the compound center type — a corona-type (TENT) center whose plume ALSO breaches a concentric
shield core (PIERCE) inside its corona annulus (TENT), at ONE center; every node still exactly one `primitiveId`.
**ACs:** AC-CORONA-PIERCED (+ AC-0, AC-ZERO-CLOBBER threaded). **Files:** `src/worldengine/base/mixedInterior.js`,
`tests/worldengine-corona-pierced.test.js` (NEW), `docs/…v2-2b-2b…/corona-pierced-search.mjs` (NEW, workstream dir),
BUILD docs.

**Exact edits (mixedInterior.js):**
- **MIXED_DEFAULTS (:40)** — add `PHI_BREACH: 0.45, BREACH_LO: 0.75,` to the pierce-boolean group.
- **NEW STEP 3b** (after the ≥1-ancient promote `:211`, before STEP 4 `:224`):
  ```
  const breach = new Uint8Array(n);
  if (PHI > T.PHI_BREACH) {
    for (let p = 0; p < n; p++) {
      if (pierce[p] || isAncient[p]) continue;                          // corona-type only
      const localYield = Ybase * (1 + T.SPREAD * (2 * yspread[p] - 1)); // recomputed from published yspread[p]
      breach[p] = (strength[p] * PHI >= T.BREACH_LO * localYield) ? 1 : 0;
    }
  }
  ```
- **STEP 5 enrollment (:258)** — `if (pierce[p])` → `if (pierce[p] || breach[p])` (breach already excludes
  pierce/ancient). This gives a breach center's inner disc `pierceR<1` so STEP 9's edifice branch paints
  shield/caldera; the annulus keeps `pierceR≥1` → STEP 9's corona branch. **STEP 7 corona-skip (`:279`
  `if (pierce[p]||isAncient[p]) continue;`) and STEP 9 (`:334-354`) UNTOUCHED** — breach is non-pierce non-ancient,
  so it still paints its corona annulus; the shield core just overwrites the central dome ("the plume punched
  through instead of merely doming"). SF3 holds (core on `BASE_PLAINS`, `:342`); budget bound holds (A_e≤0.40 +
  swell 0.10 = 0.50 < MIN_FLOOR_GAP 0.55).
- **mixedDiag (:388-396)** — add `breach,` and `breachCount: breach.reduce((a,v)=>a+v,0),`.

**Tests:** `worldengine-corona-pierced.test.js` (NEW) — at the PINNED coord/seed (from §3 search): (a) `breachCount ≥ 2`;
walk node ids outward from a breach center by RECONSTRUCTING the walk arm's-length from the **PUBLISHED
`mixedDiag.centers` + `Psi_e` + the RETURNED `primitiveId` + `carrier.verts`** (the `centerPredictor` pattern,
`worldengine-mixed-composer.test.js:70-82`) — sort nodes by `acos(dot(verts[i], centers[p]))`, assert PIERCE
(shield/caldera 1/2) at small r → TENT corona (5) in the annulus. [ADV-FIXED: buildability] (`pierceOwner`/`pierceR`/
`coronaCover` are PRIVATE locals in mixedInterior.js — NOT in mixedDiag — so the test cannot read them directly;
`centers`/`A_e`/`Psi_e`/`isAncient`/`coronaActive`/`pierce` ARE published, and `writeMixedInteriorSphere` returns
`{U, primitiveId, centerId, mixedDiag}`.) (b) every node `primitiveId ∈ {1,2,5,6,7,8}`, exactly one (AC-MIX-DISCRETE); (c)
Tharsis `{L:0.551, Φ:0.27, n:6}` → `breachCount === 0` (control). **Byte-inertness leg:** `(0.60,0.42)` seed 2 →
`breachCount === 0`. **Guardrails:** AC-ZERO-CLOBBER quartet; `worldengine-mixed-composer`/`-pierce`/`-interpenetration`
+ **`worldengine-effectivel.test.js`** (SHOULD-6 — it carries AC-WETSTAG-BASIS's Venus Φ0.69 reference that breach now
perturbs) GREEN UNCHANGED. [ADV-FIXED: buildability] Mechanism (a) does NOT touch the LOW-Φ pinned coords; at the two
Φ>0.45 pinned coords (mixed-pierce: Venus Φ0.69 :30, Φ-sweep 0.55 :95) breach CAN fire, but those tests assert only
the breach-INERT pierce boolean / pierceCount / Ybase (§4), so they stay green. **Commit:** `feat(worldengine): corona-pierced
compound center (breach continuum) in mixedInterior [V2-2b-2b AC-CORONA-PIERCED]`

### SLICE 3 — Π falsification assertion + null + cross-check + lab drive/probe
**Goal:** ASSERT pierce/tent interpenetration on world B (the claim 2b-2a fenced out); add the separable-tiling null
+ the (L0.60,Φ0.42) cross-check; wire the lab drive paths + probe fields for AC-PILOT-LIVE. **ACs:**
AC-INTERPEN-FALSIFY, AC-PILOT-LIVE prep (+ AC-0, AC-ZERO-CLOBBER threaded). **Files:** `world-engine-lab.html`,
`tests/worldengine-interpen-falsify.test.js` (NEW), BUILD docs. **`planet-lod-rivers.js` NOT touched** — `breachCount`
rides `mixedDiag → route() {...composerDiag}` automatically; the `primitiveIdHistogram` already exists in `route()`.

**Exact edits (world-engine-lab.html):**
- **`mixedOv`** — add an `effectiveL` field (a DRIVER OVERRIDE, **NO `*Enabled` key** — AC-0 taxonomy rule).
- **`applyMixedDrivers` (:3885-3900)** — when `mixedOv.effectiveL` is set, set `_mixedLidOverride.e1.effectiveL` +
  `geodynamicRegime:'stagnant'` (object built OUTSIDE the `route({...})` block — SF1 shadow-audit clean; only the
  identifier `_mixedLidOverride` rides into `route()` at `:3680`). classifyLidPath then reads effectiveL → `'mixed'`
  and the composer Ybase reads it.
- **`mixedProbe` (:6259-6269)** — add `coronaPiercedCount: md.breachCount ?? 0` and `effectiveL: md.effectiveL`
  (SCALARS only). The corona-pierced world drives via the EXISTING L/Φ/n sliders (L cap 0.629 covers L<0.63; Φ cap
  1.2 covers Φ~0.55) — no new control.

**Tests:** `worldengine-interpen-falsify.test.js` (NEW) — inject `interpenetration` (import + pass as `interpen`, the
`worldengine-interpenetration.test.js:17-20,59-62` idiom). (1) **World B** at the pinned coord/seed: assert
`legibleByFamily.pierce ≥ 2` FIRST (MF4), then **the AC gate = the contract observable `Π > 0`** AND `M ≤ M_MAX`.
[ADV-FIXED: contract-fidelity] **NOT `Π > PI_STAR`** — `PI_STAR = 0.15` (interpenetration.js:31), so `Π > PI_STAR`
≠ `Π > 0`; the contract observable is verbatim "Π > 0, M≤0.70, ≥2 legible pierce" and tightening the AC bar would be
a scope change for Max, not a build-plan call (the false "(i.e. Π>0)" gloss on PI_STAR is removed). Then, as a
SEPARATE, clearly-labeled **ADDITIONAL** observation (NOT the AC gate): assert `Π ≥ PI_STAR` (the gate-3 PASS-rule
margin) — guaranteed to hold because §3 PIN-SELECTS on `Π ≥ PI_STAR` (below). (2) **Cross-check:** `(L0.60,Φ0.42)`
seed 2 → `breachCount === 0` AND `Π` `toBeCloseTo(0.66, 2)` — MEASURE-and-pin at build (working-Claude measured
`0.6621875839828004` at HEAD `ecad42d`); do NOT hardcode a stale `0.63`. [ADV-FIXED: buildability] (3) **NULL:** hand-tile the real
carrier — `pid[i] = verts[i][2] > zc ? PRIMITIVE_ID.shield : PRIMITIVE_ID['stagnant-basaltic-plain']` (zc puts pierce
in the minority cap) → `interpenetration(c, pid, familyOf)` → `Π < PI_STAR || M > M_MAX`. `PI_STAR`/`M_MAX` imported
from `interpenetration.js` (single-source). **Guardrails:** AC-ZERO-CLOBBER quartet; `git-diff interpenetration.js`
+ `e1Regime.js` empty (manual, AC-ZERO-CLOBBER(d)); full `npx vitest run` — 4 known failures don't grow.
**AC-PILOT-LIVE** is driven live by working-Claude post-build (chrome-devtools, `127.0.0.1:9223`,
`localhost:5173/well-dipper/world-engine-lab.html`; `list_pages` liveness per sandbox-localhost-probe; close pages
after — window hygiene) — NOT a headless test. **AC-PILOT-UAT** is Max's gate, deferred-to-max, never agent-PASSed.
**Commit:** `feat(worldengine): Π falsification assertion on corona-pierced world + wet-stagnant lab drive [V2-2b-2b AC-INTERPEN-FALSIFY / AC-PILOT-LIVE prep]`

---

## 2. Resolution of the two reports' one tension (inline)

Report 1 §4 flagged that the wet-stagnant coordinate `(effectiveL 0.60, Φ 0.42)` **coincides** with the
AC-INTERPEN-FALSIFY cross-check `(L 0.60, Φ 0.42)` — the composer is raw-L-blind (reads only `effectiveL ?? L`, Φ,
n), so the two produce a **bit-identical composer field** on the same seed — and suggested nudging the wet world to
Φ≈0.40 to keep them "nominally distinct." Report 2's `PHI_BREACH=0.45` gate makes both **breach-free** anyway.
**RESOLUTION: keep the wet-stagnant coordinate at Φ 0.42.** It (1) inherits 2b-2a's VERIFIED pierce/Π profile as a
FREE anchor (seed 2 → 3 legible pierce, Π≈0.662 — working-Claude MEASURED at HEAD `ecad42d`; the prior "0.627" was the
mis-attributed Tharsis value, see §0 pt 3), and (2) stays below `PHI_BREACH`, so it is NOT a
corona-pierced world. The wet-stagnant world and the cross-check coordinate SHARE a composer field by construction;
they differ only at the ROUTING layer (the wet body's raw L 0.16 → off-pilot WITHOUT effectiveL) and in ROLE
(wet = AC-WETSTAG-BASIS substrate; `(L0.60,Φ0.42)` = AC-INTERPEN-FALSIFY regression anchor). The **two PILOT worlds**
AC-PILOT-UAT must read as distinct ARE distinct: wet-stagnant (Φ 0.42, breach-free — minority pierce-on-plains +
coronae) vs corona-pierced (Φ~0.55, breach-on — shield cores nested in coronae). No other report conflict.

---

## 3. Pinned-coordinate search procedure

**Precedent (2b-2a):** calibration ran as `*.mjs` in the program dir and the vitest hard-coded the pinned numbers.
**Here:** one-shot search scripts live in the **workstream dir** (`corona-pierced-search.mjs`), run ONCE to PIN,
results recorded in **BUILD-NOTES.md**; the vitest hard-codes the pinned tuples as constants (mirroring
`tharsisE1`/`compoundE1`). **Do NOT run the search in CI** (N=1500 × grid is slow) — targeted single-file runs only.

- **Wet-stagnant coordinate — no search needed.** Pinned by inheritance: `wetE1 = {compositionClass:'rocky',
  geodynamicRegime:'stagnant', m_hp:-0.45, L:0.16, effectiveL:0.60, Φ:0.42, n:6}`, seeds {1,2,3,7,42}. Its composer
  field == 2b-2a's verified `(L0.60,Φ0.42)` compound (§2), so AC-WETSTAG-BASIS is pre-characterized.
- **Corona-pierced coordinate — one-shot search** (`corona-pierced-search.mjs`; imports `writeMixedInteriorSphere`
  + `makeSphereField` + `buildIrregularSphere(1500,2)` + `interpenetration`, the `interpenetration.test.js:17-20`
  set). Grid `L ∈ [0.58, 0.63)` (mixed band, **hard: L < L_STRONG 0.63 so the lab classifies 'mixed'; ≤0.62 also
  clears the L-slider cap 0.629**), `Φ ∈ [0.50, 0.68]`, `n ∈ [7, 9]`, `seed ∈ 1..64`; start `(0.60,0.55,7)` /
  `(0.62,0.60,8)`. **Accept iff** `breachCount ≥ 2` AND `legibleByFamily.pierce ≥ 2` (MF4 precondition) AND
  **the AC gate `Π > 0`** AND `M ≤ 0.70` AND **(nesting gate — SHOULD-5) ≥2 breach centers are active-corona with
  ≥1 corona-family node inside their annulus** — so AC-CORONA-PIERCED(a)'s node-legible shield-core→corona-annulus
  holds by construction, not luck (an inactive / large-`Psi_e` breach core can pass the four numeric gates yet leave
  an annulus thinner than one node-ring at N=1500, reading shield→plains/rift instead of shield→corona).
  [ADV-FIXED: buildability] **PIN-SELECTION: among accepted candidates require `Π ≥ PI_STAR` and pick the largest Π
  margin** — this keeps the AC gate at the contract's `Π > 0` while guaranteeing the SLICE-3 ADDITIONAL `Π ≥ PI_STAR`
  observation passes, so there is NO §3-accept-vs-SLICE-3-assert threshold contradiction. [ADV-FIXED: contract-fidelity]
  **Then re-confirm both controls clean** (`breachCount((0.60,0.42),seed2)===0` AND
  `breachCount(Tharsis 0.551/0.27, pinnedSeed)===0`). Record
  `{L, Φ, n, seed, PHI_BREACH, BREACH_LO, breachCount, legibleByFamily.pierce, Π, M}` in BUILD-NOTES. (Requires the
  Slice-2 `breachCount` emit first — sequence the script after Slice 2's composer edit.)

---

## 4. Reconciliation list (every existing test/comment the two reads touch)

The composer extension (Slice 2, mechanism (a)) touches **no existing test's ASSERTIONS** — but NOT because "all
2b-2a pinned coordinates are Φ ≤ 0.42 < PHI_BREACH ⇒ byte-identical" (that enumeration is **FALSE** — two pinned
coords in `worldengine-mixed-pierce.test.js` are ABOVE PHI_BREACH: Venus `{L:0.728, Φ:0.69}` :30 and the Φ-sweep
0.55 case :95 — see row B1). [ADV-FIXED: contract-fidelity] The ACTUAL invariant: breach perturbs ONLY
`height`/`primitiveId`/`pierceR` and leaves `pierce[]`/`pierceCount`/`Ybase` untouched; the ONLY existing tests at
Φ>0.45 (mixed-pierce) observe ONLY those breach-INERT quantities, so they stay green even where the field changes.
The reconciliations below are ALL from the **effectiveL Read A into
`classifyLidPath`** (Slice 1) — a DELIBERATE flip of the classifier's seed-independence for in-band WET bodies, the
increment's whole point (designDecision #1). Production stays byte-inert (router un-wired; dispatch on
PRESET_ARCHETYPE) → AC-ZERO-CLOBBER unaffected; only pure-function TEST expectations change.

| # | Site | What breaks / why | Planned reconciliation |
|---|---|---|---|
| R1 | `lidResponse.js:30-34` R-A2 comment | States an in-band body seeded-'stagnant' "classifies off-pilot on EVERY seed" — now false by design. | Rewrite: routing is seed-independent for bodies WITHOUT effectiveL (raw L read); a seeded-'stagnant' pick carries `effectiveL∈[0.60,0.6275]` ⇒ `classifyLidPath` reads `effectiveL ?? L` ⇒ routes 'mixed' on those seeds (R-wetstag). effectiveL can never reach pure-weak (cut #2 m_hp) / pure-strong from a real body (effectiveL<L_STRONG; only the data-placed Venus edge, no effectiveL, reaches it) / cross composition. The **subtractive gate `isUnbrokenLidPath` still reads RAW L** — the load-bearing "wet-stagnant off the Venus pilot" guard is PRESERVED. |
| R2 | `worldengine-lid-classifier.test.js:41-57` `EXPECTED_FINE` | Hard-codes `'off-pilot'` for Rocky/Ocean/Eyeball — now seed-dependent (Rocky-seed-1 is a 'stagnant' pick → effectiveL 0.613 → 'mixed'). | Split by seed: where `computeE1` emits `effectiveL` (seeded-'stagnant') expect `'mixed'`, else `'off-pilot'`. |
| R3 | `…:70-82` per-preset × 5-seed loop | `EXPECTED_FINE[name]` on every seed + `not.toBe('mixed')` — fails on stagnant seeds. | Assert the seed-split expectation (R2); drop the blanket `not.toBe('mixed')` for in-band presets. |
| R4 | `…:84-91` seed-1 tally | Rocky-seed-1 → 'mixed' breaks `off-pilot.length===12` / `tally['mixed']===[]`. | Re-tally with the seed-split; assert 'mixed' contains exactly the in-band presets whose seed-1 pick is 'stagnant'. |
| R5 | `…:94-106` R-A2 seed-independence block | Asserts `[...classes]===['off-pilot']` over {1,2,3,7,42}; Rocky's stagnant-seed makes it `{'off-pilot','mixed'}`. | Reframe as **seed-DEPENDENCE by design**: on seeds with effectiveL → 'mixed', else 'off-pilot'; flag as the deliberate flip. |
| B1 | `worldengine-mixed-pierce.test.js:30,95` — Φ>0.45 coords (Venus `{Φ:0.69}`, Φ-sweep `{Φ:0.55}`) | Post-SLICE-2 the STEP-3b gate `PHI > PHI_BREACH` **OPENS** here → `breach[]` non-zero → `height`/`primitiveId`/`pierceR` CHANGE (**NOT** byte-identical — corrects the §4 "all Φ≤0.42" premise). | **No reconciliation needed — asserted breach-INERT:** every assertion at these coords reads ONLY `diag.pierce[]`/`pierceCount`/`Ybase` (the SHARP boolean + count, which breach never modifies), never `carrier.height`/`primitiveId`/`pierceR`. Verified GREEN as-is. Fragile ONLY if PHI_BREACH is later lowered OR a height/primitiveId assertion is added at Φ>0.45. [ADV-FIXED: contract-fidelity] |
| — | `…:108-128` boundary vectors; `…:130-147` margins incl. Mars-mixed; `…:149-191` isUnbrokenLidPath (incl. L-guard :175-182); Venus pure-strong | **Unaffected** — hand-set tuples carry no effectiveL (`effectiveL ?? L` = raw); Mars is cold-dead (no effectiveL); isUnbrokenLidPath keeps raw L; Venus reads 'stagnant' via the data-placed edge (no effectiveL). | Keep as-is (regression anchors that effectiveL did NOT leak). |
| — | `worldengine-lid-router-audit.test.js` | Determinism call uses 'Lava (hot airless)', no in-band preset. | No change. |
| — | `worldengine-e1-regime.test.js:49-54`, `worldengine-e1-seeded-middle.test.js:77-101` | Assert only the EMIT of effectiveL (e1Regime untouched). | No change. |

---

## 5. AC-0 conformance table SKELETON (complete in BUILD-NOTES at build time, per SPINE-CONFORMANCE.md)

Every NEW channel maps to a named reader (no dead knobs); NO archetype/label input; new lab knobs are driver
overrides (no `*Enabled`). Grep denylist unchanged (`.label`, `PRESET_ARCHETYPE`, `stagnantLidRegimeOf(`,
`isVolcanicPath(`, `archetype`): `effectiveL`/`breach` are E1-coordinate channels, not on any denylist, not labels.

| NEW channel | Where written | Named consumer(s) — the reader in the DAG |
|---|---|---|
| `effectiveL` (read) | lidResponse.js classifyLidPath L-cut; mixedInterior.js `Lyield` | classifyLidPath cuts #3-5 (routing) + composer `Ybase` (pierce yield) |
| `mixedDiag.effectiveL` | mixedInterior.js mixedDiag | AC-EFFECTIVEL(c) Ybase-vs-rawL assert; `mixedProbe.effectiveL` |
| `breach[]` / `breachCount` | mixedInterior.js STEP 3b + mixedDiag | STEP 5 pierceR enrollment (shield-core resolve) → AC-CORONA-PIERCED; `interpenetration.legibleByFamily.pierce` (Π); `mixedProbe.coronaPiercedCount` |
| `PHI_BREACH` / `BREACH_LO` | MIXED_DEFAULTS | STEP 3b breach decision (UAT-tunable, gate-2 Y0/Y_K precedent) |

Composer keeps its exactly-3-imports invariant (`alea`/`simplex-noise`/`./mathutil.js`) — reading `e1.effectiveL`
off the argument adds no import; the e1-shadow-audit (globs `base/*.js` minus e1Regime/lidResponse) stays clean.

---

## 6. Out-of-scope fence (VERBATIM from intent.md §"Out of scope")

- **No literal "wet" expression** (albedo/hydrology/shorelines) — basis-level only this increment.
- **No production dispatch flip** (PRESET_ARCHETYPE → derived E1 regime) — that is V2-3; the mixed path stays lab-only.
- **No `e1Regime.js` edit** — it already emits `out.effectiveL` (:198,:229); this increment only *reads* it.

Also hard-fenced (contract `mustStayWorking` / AC-ZERO-CLOBBER(d)): `interpenetration.js` UNTOUCHED (consumed by
injection); the two pure corners byte-identical; no 4th `carrier.regime` constant; the 75-golden NEVER re-captured;
the 4 known failures (KnownObjects ×3, GalacticFeatures ×1) must not grow.

---

## 7. Terminal gate

**VERIFIED_PENDING_MAX** (designDecision #4), NOT VERIFIED. The 6 objective ACs (AC-0, AC-EFFECTIVEL,
AC-WETSTAG-BASIS, AC-CORONA-PIERCED, AC-INTERPEN-FALSIFY, AC-ZERO-CLOBBER) + the live AC-PILOT-LIVE are
agent-assertable; the verify-workflow marks AC-PILOT-UAT `deferred-to-max` (never PASSes it). Integration green →
`VERIFIED_PENDING_MAX <sha>` → Max UAT (both worlds coherent/distinct/never-observed) → Shipped.

---

## 8. OPEN RISKS (could not close at plan time — surface to Max/reviewer)

1. **AC-EFFECTIVEL(b) is necessarily SYNTHETIC.** `effectiveL≈0.65` (dry→pure-strong) is **unreachable by any real
   in-band body**: `effectiveLOf=0.65` needs wetness 0 (V≤0.05), but `inSeededBand` requires V≥0.12, so every real
   seeded-stagnant body has `effectiveL ≤ 0.6275 < L_STRONG` and routes `'mixed'`, never pure-strong. AC-EFFECTIVEL(b)
   is a valid unit test of the classifier's effectiveL read at the TOP of the [0.60,0.66] band, but the "dry
   seeded-stagnant → Venus" narrative does not hold for real bodies (only the data-placed Venus edge, which carries
   no effectiveL, reaches pure-strong). Does NOT block the AC (designDecisions settled, no e1Regime edit) — flagged
   so nobody is surprised the dry leg is a synthetic-tuple test.
2. **The corona-pierced PIN is an empirical build-time search.** Whether `breachCount ≥ 2` AND
   `legibleByFamily.pierce ≥ 2` AND `M ≤ 0.70` co-occur at the reasoned region (L∈[0.58,0.63), Φ∈[0.50,0.68], n∈[7,9])
   is unconfirmed until §3 runs. If no coordinate satisfies all four, the fallbacks are UAT-tunable: lower `BREACH_LO`
   / raise Φ within the mixed band, or floor `Psi_e` for breach cores so a weak core clears `sizeFloor(1500)=6`
   (report 2 §2a). Constants stay named + tunable like Y0/Y_K, so a retune is a BUILD-NOTES entry, not a re-scope.
   Note: the SLICE-3 accept adds the SHOULD-5 nesting gate (≥2 active-corona breach centers with an occupied annulus),
   which slightly narrows the acceptable region — same fallbacks apply if it prunes too hard.

---

## 9. Adversarial pass — applied / deferred

**Both MUST-FIX findings APPLIED** (both verified against code + a live headless measurement, neither rejected):
- *contract-fidelity (AC-INTERPEN-FALSIFY Π>0 vs Π>PI_STAR):* PI_STAR=0.15 confirmed (interpenetration.js:31). AC gate
  set to the contract observable `Π > 0`; the false "(i.e. Π>0)" gloss removed; `Π ≥ PI_STAR` demoted to a labeled
  ADDITIONAL check; §3 pin-selection tightened to `Π ≥ PI_STAR` so §3-accept and SLICE-3-assert can't contradict.
- *buildability (cross-check hardcodes 0.63):* I MEASURED `Π=0.6621875839828004` at (L0.60,Φ0.42) seed 2 (HEAD
  `ecad42d`, LEG-2 idiom) — `toBeCloseTo(0.63,2)` would FAIL. Pinned `toBeCloseTo(0.66,2)` (measure-and-pin), and
  corrected the mis-attributed "0.627/0.63" (it is the Tharsis {0.551,0.27} value) in §0 pt3 and §2.

**All SHOULDS applied** (the six near-duplicate Π-threshold / byte-identity / nesting entries fold into the fixes
above); nothing deferred:
- SHOULD (Π threshold internal inconsistency) → folded into the contract-fidelity MUST-FIX (§3 + SLICE-3 aligned).
- SHOULD (byte-safety over-generalization false for Φ>0.45) → §4 premise corrected + new row B1; SLICE-2 re-run note fixed.
- SHOULD (AC-WETSTAG-BASIS Venus reference fragile / "all TENT" false; effectivel.test.js missing from SLICE-2 re-run)
  → SLICE-1 recast as histogram-DIFFERENCE; `worldengine-effectivel.test.js` added to SLICE-2's re-run set.
- SHOULD (search accept doesn't guarantee shield-in-corona nesting) → SLICE-3 §3 accept gains the nesting gate.
- SHOULD (`pierceOwner`/`pierceR`/`coronaCover` are private, not in mixedDiag) → SLICE-2 test rewritten to reconstruct
  the walk from published `centers`/`Psi_e` + returned `primitiveId` + `carrier.verts`.

*No findings rejected.*
