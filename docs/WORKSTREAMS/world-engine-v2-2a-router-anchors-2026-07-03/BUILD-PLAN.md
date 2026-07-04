<!-- Provenance: authored by working-Claude 2026-07-04 from the SIGNED contract.json (13 ACs + 9
     designDecisions, greenlit by Max 2026-07-04) + intent.md + GROUNDING.md (Q1-Q6, all resolved) +
     ROADMAP-v2-condition-first.md (SIGNED OFF 2026-07-03) §5.1 Option-A router / §5.2 pre-flip / §5.5
     non-goals / §2.2 SP-CENTERS D2-MF6 / §2.4 expression legend + the three committed gate briefs
     (gate-1 §4 router boundaries + calib table; gate-2 §Routing-model + PG-5 tidal-shoulder; gate-3
     Open-Q1/Q2 primitiveId enum + familyOf). Code-grounded: every path + line number verified by
     reading the file at 83a62a1. Templates: v2-1 BUILD-PLAN.md (shape) + v2-0 BUILD-PLAN.md §4 (AC-0
     conformance-table worked example). Baseline confirmed pre-build: tests/v2-0-byte-identity.test.js
     (75/75) + the e1 shadow suites + tests/planet-archetypes.test.js green (V2-1 VERIFIED ac307aa;
     V2-0 VERIFIED 0461463). -->
# BUILD PLAN — V2-2a "Anchor-preserving router + both byte-anchors" (code-grounded, sliced, self-auditing)

Branch `feature/world-engine-production-L1`, base `83a62a1` (contract status=building). Contract AC-0,
AC1, AC-BYTE-{WEAK-REF,STRONG-REF,LAVA,MAGMA}, AC-TSS-PRE-GATE, AC-TUNE-NULL, AC-CONFORMANCE-FINE,
AC-SUBTRACTIVE-GATE, AC-MIXED-STUB, AC-PRIMITIVEID-SCHEMA, AC-ZERO-CLOBBER (13). **Zero behavioral
change is the standing gate (AC-ZERO-CLOBBER): the 75 carrier goldens NEVER re-capture; the router is
NOT wired into `writeBodyRelief` this increment (that flip is V2-3).** All paths are repo-relative to
`/home/ax/projects/well-dipper`.

**Line of sight → north star (intent §Why / ROADMAP §5 preamble):** V2-2a lays the *spine* of the
condition-first unification — one condition-derived router that classifies a body's E1 coordinates into
`pure-weak / pure-strong / mixed / off-pilot` and proves, byte-for-byte, that routing the already-UAT'd
Lava, Magma and Venus worlds through it changes **not a single byte** of what renders. It **prepares**
Max's "every stagnant-lid world is a re-rolled Venus" fix; V2-2b **ships** it. JOURNEY milestone =
SCREENSAVER world-variety arc; **no PLAYER_EXPERIENCE tier is touched** (pure routing/plumbing, V2-0
character) ⇒ **no UAT AC** (GROUNDING Q6). Terminal gate is `verify-workstream` green → **VERIFIED**
(no `VERIFIED_PENDING_MAX` hold).

**Grounding done (read at 83a62a1; line numbers below are load-bearing):**
`src/worldengine/base/e1Regime.js` — `computeE1` :155-231 emits `{compositionClass :218, geodynamicRegime
:219, label :220 (OUTPUT-ONLY), L :221, Φ :223, V, n, m_hp :225 (=rawTidal−HEATPIPE_PEG), e1Seed,
positionWithinRegime, effectiveL? (seeded-stagnant only :229)}`; classification constants `HEATPIPE_PEG=0.45`
:40 (already `export const`), `L_STRONG=0.63` :43 + `SHOULDER_LO=0.15` :44 (module-private `const` today —
the ONE permitted byte-safe edit adds `export`), `MOBILE_L=0.35` :47 (the mixed floor, stays private).
`src/worldengine/base/magmatism.js` — `writeMagmatismSphere(carrier, drivers={}, {macroSeed=0, locked=false,
T_ss=0, tune=null})` :170 (writes `carrier.height`+`carrier.faultDensity`; returns `{U, plumeId, plumeCount,
hotspotNode, hotspotProximity, nearestPlume, substellarAxis, edificeMask, lavaPlainMask, magmaOceanMask,
A_e, Psi_e, thetaSea, D_flood, …}` :415-422); `MAGMA_REF={tidalHeating:0,age:4.5,massGravity:0.9}` :93;
`magmaDriversToTune` :113 (`magmaDriversToTune(MAGMA_REF)===null` guard :124-127; `null` arg → `null` :114);
basin gates on `T_ss>LIQUIDUS(1300)` :299-300 (NOT `locked` :172). `src/worldengine/base/stagnantLid.js` —
`writeStagnantLidReliefSphere(carrier, drivers={}, {macroSeed=0, regime='venus-stagnant-lid', tune=null,
randomPlacementControl=false})` :170-173 (`void drivers` :174 seed-only; writes `carrier.height`+`grainAngle`+
`faultDensity`; returns `{U, regime, plumeCenters, isTessera, coronaCenters, inRift, resurfAge, foldAngle,
…}` :402-411); `stagnantLidRegimeOf(archetype, locked)` :78 takes a preset LABEL — **imported ONLY by the
TEST, never the router (AC-0 grep denylist)**. `planet-lod-rivers.js` — the un-wired dispatch seam
`writeBodyRelief` :448-497 (plate :454 → shell :462 → volcanic :470 → stagnant-lid :489 → despun :494);
**the two byte-preserved corner call sites the router mirrors argument-for-argument** — weak `const T_ss =
locked ? (T_eq ?? 0) * 1.4 : 0` :476, `const magmaTune = magmaDriversToTune(bodyDrivers)` :481,
`writeMagmatismSphere(carrier, bodyDrivers, {macroSeed, locked, T_ss, tune: magmaTune})` :482; strong
`writeStagnantLidReliefSphere(carrier, grainDrivers, {macroSeed, regime: slRegime})` :491; `DEFAULT_GRAIN_DRIVERS`
:92. `body-condition-vector.js` — `deriveConditionVector(fp, derived, radiusEarth)` :23-41 (`rawTidalIoRatio`
:37, `T_eq` :30, nested under `bodyDrivers.condition`). `driver-presets.js` — `DRIVER_PRESETS` (17) :15-169,
`PRESET_ARCHETYPE` (15) :174-190 (`Lava`/`Magma`→`'lava'`, `Venus`→`'stagnant-lid'`). Tests to reuse/extend:
`tests/fixtures/v2-0-carrier-golden.mjs` — `buildBundle(name, seed)` :59-81 (single-sources
`{archetype, locked, grainDrivers:DEFAULT_GRAIN_DRIVERS, bodyDrivers:{…neutral, condition}, macroSeed,
T_eq}`), `TARGET_N=700` :41, `LLOYD=2` :42, `SEEDS=[1,2,3,7,42]` :45, `HASHED_FIELDS=['height','grainAngle',
'grainMag','regime','faultDensity']` :54; `tests/v2-0-byte-identity.test.js` (75 goldens, captured 7441c92 —
NEVER re-capture); `tests/worldengine-base-magmatism-structure.test.js` — the run-twice byte idiom
`expect(Array.from(a.c.height)).toEqual(Array.from(b.c.height))` :78-100, `carrierOf = () =>
makeSphereField(buildIrregularSphere(TARGET_N, LLOYD))` :28; `tests/worldengine-e1-conformance-oracle.test.js`
— the headless `deriveConditionVector(fp, null, fp.radiusEarth) → computeE1(cv, seed)` idiom :53/:69;
`tests/planet-archetypes.test.js` (`.add(state,'…Enabled')` drift guards :30-32).

**Hard-rule ledger (grep-enforced at the Slice-C gate):** `writeBodyRelief`/dispatch **untouched** (the
router is NOT wired — headless only; AC-ZERO-CLOBBER grep asserts `writeBodyRelief` neither imports nor
calls `writeLidResponseSphere`); corner writers **byte-UNCHANGED** (delegation reproduces rivers:482/:491
argument-for-argument); **no `'lid:'` alea draws** (namespace RESERVED for V2-2b — assert zero, don't use);
no `Math.random`/`Date.now`; the 75 goldens **never re-captured**; **no `stagnantDriversToTune`** (V2-2b —
does not exist today); **no mixed height machinery** (mixed → return-marker, `carrier.height` UNWRITTEN);
**label-free routing** (the router reads E1 coordinates only — no `e1.label`, no `PRESET_ARCHETYPE`, no
`stagnantLidRegimeOf(archetype)` call; the archetype-free grep audit); the router **IMPORTS** `L_STRONG`/
`SHOULDER_LO`/`HEATPIPE_PEG` from `e1Regime.js` (no re-declared `0.63`/`0.15` literals — single source of
truth, must-fix #4) — an import that FORCES one byte-safe one-line exclusion of `lidResponse.js` from the
`worldengine-e1-shadow-audit.test.js` writer/dispatch file-set (:24/:28), the ONLY edit to a shipped file
besides the `e1Regime.js` export edit (Slice A, R-A4). New module lives at
`src/worldengine/base/lidResponse.js` (ROADMAP §5).

---

## 1. Slice ordering (3 slices; AC-0 + AC-ZERO-CLOBBER are gates run after EACH, not slices)

Ordered so the pure classifier stands up and self-proves headlessly first (A), the delegation is proven
byte-identical at both anchors second (B), then the instrument schema + the reserved-namespace/determinism
audits + AC-0 close last (C). Each slice is independently testable and committable. **The 75-golden gate
(`tests/v2-0-byte-identity.test.js`) + the drift guards (`tests/planet-archetypes.test.js`) run after every
slice** — they hold *trivially* the whole way because the router is un-wired (the harness never reaches it),
which is itself the AC-ZERO-CLOBBER proof.

**Slice A — `e1Regime.js` export-only edit + the pure label-free CLASSIFIER. FIRST.**
Why first: the byte-anchor delegation (B) and the schema/audit (C) both import `classifyLidPath` /
`isUnbrokenLidPath`; and the classifier must import its cuts from `e1Regime.js`'s single source of truth,
so the export edit precedes everything.
- **Edit `src/worldengine/base/e1Regime.js` (the ONE permitted byte-safe edit — must-fix #4, `mustStayWorking`):**
  add the `export` keyword to `L_STRONG` (:43) and `SHOULDER_LO` (:44). `HEATPIPE_PEG` (:40) is already
  `export const`. **This changes no runtime value and moves no golden** (the 75-golden set hashes carrier
  fields, not the export surface; `computeE1`'s own routing still reads the same two `const`s). `MOBILE_L`
  (:47) stays private — the router does NOT need it as a shared source (see §4.2 `MIXED_LO` decision).
- **NEW `src/worldengine/base/lidResponse.js` (classifier half):** two pure, deterministic, **label-free**
  functions — `classifyLidPath(e1, rawTidal)` and `isUnbrokenLidPath(e1)` — importing `L_STRONG`,
  `SHOULDER_LO`, `HEATPIPE_PEG` from `e1Regime.js`. Precedent for a new base module imported by tests but
  by no writer: `e1Regime.js` itself (V2-1). Full logic pinned in §4.1. No `alea`, no RNG, no
  `geodynamicRegime` read inside `classifyLidPath` (seed-independence — R-A2).
- **Edit `tests/worldengine-e1-shadow-audit.test.js` (a SECOND byte-safe edit to a shipped file — the ONLY
  test-scope edit V2-2a needs; AC-ZERO-CLOBBER, `mustStayWorking` "sibling suites green"; R-A4):** the shadow
  audit globs every `src/worldengine/base/*.js` **except** `e1Regime.js`
  (`baseFiles.filter(f => f !== 'e1Regime.js')` :24/:28) and asserts each file imports neither `computeE1`
  (:38) nor `e1Regime` (:39 regex `/from\s+['"][^'"]*e1Regime/`). `lidResponse.js` lives in `base/` and — by
  must-fix #4 — MUST `import { L_STRONG, SHOULDER_LO, HEATPIPE_PEG } from './e1Regime.js'`, which matches the
  :39 regex → **the currently-green suite would flip green→red the moment the module is added** (a NEW failure,
  directly violating AC-ZERO-CLOBBER's "no new failures vs the pre-change baseline"). That import is FORCED
  (single-source-of-truth), so the mechanical fix is the one-line filter change
  `f => f !== 'e1Regime.js' && f !== 'lidResponse.js'` at :28, excluding the router the SAME way the E1 SOURCE
  is already excluded: `lidResponse.js` is the **LEGITIMATE E1 consumer/router** (its whole job is to read E1
  coordinates), semantically like `e1Regime.js`'s own exclusion — NOT a shadow-blind writer whose contract is
  "never touches E1". **This opens no hole:** the audit's real target — E1 has zero *routing/render* influence
  — still stands because `planet-lod-rivers.js` STAYS in `WRITER_DISPATCH` (still audited for `computeE1`/
  `e1Regime`), and the complementary "router absent from the dispatch seam" guard is AC-ZERO-CLOBBER's own grep
  (`writeBodyRelief` neither imports nor calls `writeLidResponseSphere`, Slice C §1). Byte-safe: a test-scope
  change only — moves no golden, changes no runtime value. Landing it in Slice A (where `lidResponse.js` first
  appears), and gating the suite here, catches the regression at the earliest slice instead of letting it
  surface only at Slice C's full `npx vitest run`.
- **NEW `tests/worldengine-lid-classifier.test.js` (AC-CONFORMANCE-FINE + AC-SUBTRACTIVE-GATE):**
  - **(FINE)** `computeE1(deriveConditionVector(fp, null, fp.radiusEarth), seed) → classifyLidPath(e1,
    cv.rawTidalIoRatio)` over the **15** `PRESET_ARCHETYPE` presets **× seeds {1,2,3,7,42}** (the ×5 sweep
    proves seed-independence — R-A2): `{Lava, Magma}`→`'pure-weak'`, `Venus`→`'pure-strong'`, every other
    shipped preset→`'off-pilot'`, **none→`'mixed'`** (a preset drifting into mixed FAILS). Hand-set boundary
    vectors: `(L=0.64, rt=0)`→pure-strong, `(L=0.62, rt=0)`→mixed, `(L=0.70, rt=0.20)`→mixed (tidal-shoulder,
    PG-5), high-`m_hp`→pure-weak (m_hp fires before L). Margin asserts: Lava/Magma `m_hp` +7.8e5/+7.6e7;
    Venus `L` 0.728 = +0.10 above `L_STRONG`; Mars `L` 0.551 = −0.08 below. Failures print the full e1 tuple.
  - **(SUBTRACTIVE)** `isUnbrokenLidPath(e1)` over the Mars hand-set D-vector + a despun rocky (Rocky/Earthlike)
    + Lava/Magma/Venus: `true` ONLY for `{heat-pipe, hot-surface-stagnant}` rocky; `false` for Mars (dead-lid)
    + the despun rocky; the two despun destinations resolve distinctly (locked→shell `eyeball-despun`,
    unlocked→final `despun` — asserted via the shipped predicates as the reference, NOT re-implemented);
    crystal/technogenic fall to the §1 label carve-out (`compositionClass !== 'rocky'` → excluded).
- **Commit gate:** `npx vitest run tests/worldengine-lid-classifier.test.js tests/worldengine-e1-shadow-audit.test.js
  tests/worldengine-e1-regime.test.js tests/worldengine-e1-gate-fidelity.test.js tests/v2-0-byte-identity.test.js
  tests/planet-archetypes.test.js`
  — classifier green + **`worldengine-e1-shadow-audit` stays green** (the one-line `lidResponse.js` exclusion
  catches the green→red clobber HERE, at the slice that introduces the module, not deferred to the Slice-C full
  run) + **e1 runtime unchanged** (the export edit is inert) + **75/75 goldens unchanged** + drift guards green.

**Slice B — `writeLidResponseSphere` corner DELEGATION + the byte anchors. SECOND (the byte-identity core).**
Depends on A (`classifyLidPath`). Add `writeLidResponseSphere(carrier, drivers, opts)` to `lidResponse.js`:
the pure-weak / pure-strong delegation + the mixed **return-marker** (the AC-MIXED-STUB *test* is Slice C,
but the branch exists here so the router is total). Signature + branch args pinned verbatim in §4.3.
- pure-weak → `magmaDriversToTune(drivers)` → `writeMagmatismSphere(carrier, drivers, {macroSeed, locked,
  T_ss, tune})` — argument-for-argument identical to rivers:481-482.
- pure-strong → `writeStagnantLidReliefSphere(carrier, opts.grainDrivers, {macroSeed, regime: STRONG_REGIME})`,
  `STRONG_REGIME = 'venus-stagnant-lid'` resolved **archetype-free** from `e1.geodynamicRegime==='stagnant'`
  (must-fix #3) — mirrors rivers:491 except the regime source is the E1 coordinate, not the archetype string.
- mixed / off-pilot → `{path:'lid-mixed'|'lid-offpilot', fineClass, unimplemented:true}`, `carrier.height`
  UNWRITTEN.
- **NEW `tests/worldengine-lid-byte-anchors.test.js`** (AC-BYTE-WEAK-REF, -STRONG-REF, -LAVA, -MAGMA,
  AC-TSS-PRE-GATE, AC-TUNE-NULL) — the dual-carrier `Float32Array`-equality idiom (magmatism-structure
  :78-100), reusing `buildBundle` (recipe pinned §4.5), over seeds {1,2,3,7,42}. Plus the AC-TSS-PRE-GATE
  source read + `{locked, T_eq}` matrix, and the AC-TUNE-NULL asserts (`magmaDriversToTune(MAGMA_REF)===null`;
  router imports `magmaDriversToTune`, defines no `lidDriversToTune`, introduces no `stagnantDriversToTune`).
- **Commit gate:** `npx vitest run tests/worldengine-lid-byte-anchors.test.js tests/v2-0-byte-identity.test.js`
  — byte anchors green (every seed) + **75/75 goldens unchanged**.

**Slice C — `primitiveId` schema + AC1 audit + AC-MIXED-STUB + AC-0 close + BUILD-NOTES. LAST.**
Depends on B. Adds the instrument schema, the reserved-namespace/determinism audits, the mixed-stub test,
and closes AC-0.
- **`lidResponse.js` (schema constants):** export the `primitiveId` enum + `familyOf` (pinned §4.4;
  lava-plain ≠ stagnant-basaltic-plain, gate-3 Open-Q2). **OPTIONAL byte-safe uniform corner emit**
  (recommended — cheap, de-risks V2-2b): the router allocates a per-node `primitiveId: Int32Array` filled
  uniformly (pure-weak → `lava-plain` PIERCE id; pure-strong → `stagnant-basaltic-plain` TENT id) as a NEW
  return field (NOT one of the 5 hashed carrier fields) — trivially byte-safe since the router is un-wired.
  The `_lab.lidRouteProbe()` live shadow surface is **DEFERRED / not built** (designDecision Q3; V2-2a
  renders nothing new — no live/integration/UAT AC).
- **NEW `tests/worldengine-lid-primitiveid.test.js` (AC-PRIMITIVEID-SCHEMA):** import the enum + `familyOf`;
  assert `lava-plain !== stagnant-basaltic-plain` and `familyOf` routes lava-plain→PIERCE(1),
  basaltic-plain→TENT(0); if the corner emit is built, assert it is a NEW field and the 5 hashed carrier
  fields (height/grainAngle/grainMag/regime/faultDensity) are byte-identical to the un-emitted call.
- **NEW `tests/worldengine-lid-router-audit.test.js` (AC1 + AC-MIXED-STUB + AC-0 grep leg + AC-ZERO-CLOBBER
  dispatch-absence):**
  - **AC1:** source grep of `lidResponse.js` — no `Math.random(`/`Date.now(`; **zero `alea('lid:…')` draws**
    (namespace RESERVED, unused); `classifyLidPath`/`isUnbrokenLidPath` draw no alea at all; repeat-call
    `writeLidResponseSphere` on a fixed `(e1, carrier, opts)` → identical `fineClass` + identical
    `carrier.height`.
  - **AC-MIXED-STUB:** pre-fill `carrier.height` with a sentinel; call `writeLidResponseSphere` on a hand-set
    mixed vector; assert the return `=== {path:'lid-mixed', fineClass:'mixed', unimplemented:true}` and
    `carrier.height` byte-unchanged from the sentinel; assert no `'lid:'` draw occurred.
  - **AC-0 grep leg:** `lidResponse.js` reads no `e1.label`, no `PRESET_ARCHETYPE`, does not call
    `stagnantLidRegimeOf(` (nor pass any archetype-string arg); IMPORTS `L_STRONG`/`SHOULDER_LO` from
    `e1Regime.js` (no re-declared `0.63`/`0.15` literals); resolves the strong regime from
    `geodynamicRegime==='stagnant'` → the single constant.
  - **AC-ZERO-CLOBBER (dispatch seam):** grep `planet-lod-rivers.js` — `writeBodyRelief` neither imports nor
    calls `writeLidResponseSphere` (the router is absent from the dispatch seam).
- **NEW `docs/WORKSTREAMS/world-engine-v2-2a-router-anchors-2026-07-03/BUILD-NOTES.md`** — the AC-0
  conformance table (Tables A/B/C, §3 below, reproducing the V2-1 BUILD-NOTES worked-example discipline) +
  the grep-audit results + the byte-anchor pass summary + `record-build-intent` (plain-language function +
  intent + deliberate non-goals).
- **Commit gate:** `npx vitest run tests/worldengine-lid-primitiveid.test.js tests/worldengine-lid-router-audit.test.js
  tests/v2-0-byte-identity.test.js tests/planet-archetypes.test.js` + **full `npx vitest run`** green with no
  pre-existing test dropped (the 4 known unrelated failures — KnownObjects ×3, GalacticFeatures ×1 — excluded
  as known, not newly regressed). **`worldengine-e1-shadow-audit` must be GREEN here (fixed by the Slice-A
  `lidResponse.js` exclusion, R-A4) — a RED shadow-audit is the clobber, NOT a 5th "known unrelated failure".**

Reorder freedom: B and C both depend on A; C depends on B (it audits the finished router). Chosen A→B→C.

---

## 2. Per-slice AC coverage map (every AC → the slice + test that discharges it)

| AC | Statement (short) | Slice | Test file / gate | Layer |
|---|---|---|---|---|
| **AC-CONFORMANCE-FINE** | classifier: 15 presets {Lava/Magma=weak, Venus=strong, rest=off-pilot, none=mixed} × 5 seeds + 4 boundary vectors + margins | **A** | `tests/worldengine-lid-classifier.test.js` | unit |
| **AC-SUBTRACTIVE-GATE** | `isUnbrokenLidPath` true ONLY {heat-pipe, hot-surface-stagnant} rocky; Mars/despun false; two despun destinations distinct; exotics carved out | **A** | `tests/worldengine-lid-classifier.test.js` | unit |
| **AC-BYTE-WEAK-REF** | MAGMA_REF tune=null DEFAULTS branch === `writeMagmatismSphere` direct (height + magma diag), 5 seeds | **B** | `tests/worldengine-lid-byte-anchors.test.js` | unit |
| **AC-BYTE-STRONG-REF** | Venus pure-strong === `writeStagnantLidReliefSphere` direct (grainDrivers + regime, archetype-free), 5 seeds | **B** | `tests/worldengine-lid-byte-anchors.test.js` | unit |
| **AC-BYTE-LAVA** | real Lava preset (tune≠null, T_ss=1330 basin) === direct, 5 seeds | **B** | `tests/worldengine-lid-byte-anchors.test.js` | unit |
| **AC-BYTE-MAGMA** | real Magma preset (tune≠null, T_ss=2800 wide basin) === direct, 5 seeds | **B** | `tests/worldengine-lid-byte-anchors.test.js` | unit |
| **AC-TSS-PRE-GATE** | router forwards `opts.T_ss` verbatim; no internal `*1.4`/reassignment on the weak path; ordering-independent basin | **B** | `tests/worldengine-lid-byte-anchors.test.js` (matrix + source read) | unit |
| **AC-TUNE-NULL** | weak-side `magmaDriversToTune(MAGMA_REF)===null`; router reuses it; no `lidDriversToTune`/`stagnantDriversToTune` | **B** | `tests/worldengine-lid-byte-anchors.test.js` | unit |
| **AC1** | determinism; zero RNG; `'lid:'` namespace RESERVED (zero draws); classifier pure; repeat-call byte-equal | **C** | `tests/worldengine-lid-router-audit.test.js` | unit |
| **AC-MIXED-STUB** | mixed vector → `{path:'lid-mixed',fineClass:'mixed',unimplemented:true}`; `carrier.height` unwritten; no `'lid:'` draw | **C** | `tests/worldengine-lid-router-audit.test.js` | unit |
| **AC-PRIMITIVEID-SCHEMA** | enum + `familyOf` exported; lava-plain ≠ stagnant-basaltic-plain (correct families); optional corner emit is a new field | **C** | `tests/worldengine-lid-primitiveid.test.js` | unit |
| **AC-0** | spine: driver-connectivity + named-consumer + taxonomy-registration; grep audits; drift guards green | **C (close); gate every slice** | §3 table + `tests/worldengine-lid-router-audit.test.js` + `tests/planet-archetypes.test.js` | unit |
| **AC-ZERO-CLOBBER** | 75 goldens unchanged; sibling suites green (incl. `worldengine-e1-shadow-audit` via the R-A4 one-line `lidResponse.js` exclusion); router absent from dispatch; no new failures | **A,B,C (after each)** | `tests/v2-0-byte-identity.test.js` + `tests/worldengine-e1-shadow-audit.test.js` + `tests/worldengine-lid-router-audit.test.js` (grep) + full `npx vitest run` | integration |

---

## 3. AC-0 conformance table (every input READ × D-slot/derivation; every export × named consumer — the V2-0 §4 / V2-1 §3 worked-example form)

**A — driver connectivity (every scalar the router reads is a D-slot-backed E1 coordinate or a named
derivation; NO archetype-string input):**

| Router reads (`classifyLidPath` / `isUnbrokenLidPath` / `writeLidResponseSphere`) | D-slot / named backing | used for |
|---|---|---|
| `e1.compositionClass` | E1 Stage-A: density **D2** / C:O **D10** / atmosphere passthrough | classifier terminal (`!== 'rocky'` → off-pilot); subtractive-gate §1 label carve-out |
| `e1.m_hp` | E1 = `rawTidalIoRatio − HEATPIPE_PEG` (**D12 raw** − exported peg :40) | classifier pure-weak gate (fires before L); subtractive-gate heat-pipe edge |
| `e1.L` | E1 gate-1 form (`z(T_surf,age)·μProxy(V,T_surf)·gMod`) | classifier pure-strong / mixed cuts; subtractive-gate hot-surface-stagnant `L`-guard |
| `e1.geodynamicRegime` | E1 edges + seeded middle (`'e1:regime:'`) | subtractive-gate hot-surface-stagnant edge (`==='stagnant'`); strong-regime resolution `→ 'venus-stagnant-lid'` |
| `rawTidal` (= `cv.rawTidalIoRatio`) | **D12 raw** (caller precomputes, passed in opts — like T_ss) | classifier tidal-shoulder cut (PG-5: pure-strong = `L≥L_STRONG AND rawTidal<SHOULDER_LO`) |
| `T_ss` | **NAMED DERIVATION** `locked?(T_eq??0)*1.4:0` (D3-MF3, rivers:476) | pure-weak delegation → `writeMagmatismSphere` substellar basin (forwarded verbatim) |
| `L_STRONG` / `SHOULDER_LO` / `HEATPIPE_PEG` | **IMPORTED** from `e1Regime.js` :43/:44/:40 (single source of truth, must-fix #4) | classification cuts (no re-declared `0.63`/`0.15`) |
| `drivers` (bodyDrivers) | neutral bundle `buildNeutralBodyDrivers` (V2-0) | pure-weak delegation drivers arg + `magmaDriversToTune(drivers)` |
| `grainDrivers` (`DEFAULT_GRAIN_DRIVERS`) | shipped default grain bundle (rivers:92) | pure-strong delegation drivers arg (argument-for-argument :491; voided by the corner) |
| `macroSeed`, `locked` | lab seed / `tidalState.locked` (data) | delegation opts |
| *NOT read: `e1.label` (§1 invariant); `PRESET_ARCHETYPE`; `stagnantLidRegimeOf(archetype)`; `e1.{Φ,n,V,effectiveL,positionWithinRegime}` (V2-2b)* | — | — |

**Accepted debt to declare:** dispatch (`writeBodyRelief`) still routes on `PRESET_ARCHETYPE` — that is the
**un-wired seam, retired at V2-3**; the router itself is archetype-free.

**B — named consumer (every field the router emits has a reader from the ROADMAP-v2 DAG):**

| Router emits | set by (input → derivation) | named consumer |
|---|---|---|
| `classifyLidPath` fineClass (`pure-weak\|pure-strong\|mixed\|off-pilot`) | E1 gate order (§4.1) | **AC-CONFORMANCE-FINE now**; V2-3 dispatch flip |
| `isUnbrokenLidPath` boolean | subtractive gate (D3-MF1) | **AC-SUBTRACTIVE-GATE now**; V2-3 (widens as siblings absorbed) |
| pure-weak delegation → `carrier.height` + `magmaDiag` (UNCHANGED writer) | `m_hp>0` (Lava/Magma) | **AC-BYTE-WEAK-REF/-LAVA/-MAGMA now**; existing `magmaProbe`; ships byte-identical Lava/Magma |
| pure-strong delegation → `carrier.height` + `stagnantDiag` (UNCHANGED writer) | `L≥L_STRONG AND rawTidal<SHOULDER_LO` (Venus) | **AC-BYTE-STRONG-REF now**; existing `stagnantLidProbe`; ships byte-identical Venus |
| mixed marker `{path:'lid-mixed',fineClass:'mixed',unimplemented:true}`; `carrier.height` UNWRITTEN | mixed band (hand-set only in V2-2a) | **AC-MIXED-STUB now**; V2-2b swaps real mixed machinery in at this exact branch |
| `primitiveId` enum + `familyOf` (lava-plain ≠ stagnant-basaltic-plain) | authored schema (gate-3 Open-Q1/Q2) | **AC-PRIMITIVEID-SCHEMA now**; V2-2b mixed writer + gate-3 `Π=C·F` interpenetration statistic |
| OPTIONAL uniform `primitiveId: Int32Array` corner emit (new field) | pure-weak → lava-plain / pure-strong → basaltic-plain | V2-2b interpenetration statistic |
| `'lid:'` alea namespace RESERVED (no draws) | — | V2-2b `'lid:strength:'`/`'lid:yield:'` mixed-interior streams (gate-2 PG-1) |

No dead fields.

**C — taxonomy registration:** V2-2a adds **no** lab control/preset/feature/province; the `_lab.lidRouteProbe`
live surface is **DEFERRED** (console/`_lab`-only if ever built ⇒ no `.add(state,'…Enabled')` key) ⇒
`tests/planet-archetypes.test.js` drift guards stay green with **no taxonomy change**. If a future GUI toggle
is added it registers in `planet-archetypes.js` (flagged, not built).

---

## 4. Design decisions the plan PINS (not left to the slices)

### 4.1 `classifyLidPath` / `isUnbrokenLidPath` — the exact label-free logic (gate-1 §4 + gate-2 PG-5)

Both pure, deterministic, no `alea`. Constants imported from `e1Regime.js` (`L_STRONG=0.63`,
`SHOULDER_LO=0.15`, `HEATPIPE_PEG=0.45`); `MIXED_LO` is router-owned (§4.2).

```
classifyLidPath(e1, rawTidal):                       // FINE response-class — reads {compositionClass, m_hp, L}, rawTidal ONLY
  if e1.compositionClass !== 'rocky':  return 'off-pilot'   // gas/carbon/icy(+crystal by density) terminal; fires before L
  if e1.m_hp > 0:                      return 'pure-weak'   // heat-pipe (Lava/Magma); fires before L (gate-1 §4 order)
  if e1.L >= L_STRONG && rawTidal <  SHOULDER_LO: return 'pure-strong'  // Venus (data-placed hot-high-L, PG-5 shoulder)
  if e1.L >= L_STRONG && rawTidal >= SHOULDER_LO: return 'mixed'        // tidal-shoulder: would-be strong, tidally warming (PG-5, no cliff)
  if e1.L >= MIXED_LO:                 return 'mixed'       // mixed interior [MIXED_LO, L_STRONG) — Mars 0.551
  return 'off-pilot'                                        // mobile/broken-lid, L < MIXED_LO — Earth 0.250 / Ocean 0.131 / Eyeball 0.215
```
```
isUnbrokenLidPath(e1):                                // SUBTRACTIVE migration gate (D3-MF1) — reads {compositionClass, m_hp, geodynamicRegime, L}
  if e1.compositionClass !== 'rocky':  return false    // §1 label carve-out (crystal→icy, gas/carbon terminal)
  const heatPipe           = e1.m_hp > 0                                     // Lava/Magma
  const hotSurfaceStagnant = e1.geodynamicRegime === 'stagnant' && e1.L >= L_STRONG   // Venus (the DATA-PLACED hot-high-L stagnant, NOT a low-L seeded-band pick)
  return heatPipe || hotSurfaceStagnant
```

- **Seed-independence (R-A2, load-bearing):** `classifyLidPath` reads **only** `{compositionClass, m_hp, L}`
  + `rawTidal`, **never** `geodynamicRegime` — so in-band Earth/Ocean/Eyeball (which draw a seeded
  mobile/episodic/**stagnant** pick per seed) classify `'off-pilot'` on *every* seed (their base `L` is
  <`MIXED_LO`). The ×5-seed sweep in the FINE test proves it. If the classifier read the seeded
  `geodynamicRegime`, a `'stagnant'` seed would flip one to `'mixed'` and break AC-CONFORMANCE-FINE.
- **The `L`-guard on `hotSurfaceStagnant` is what keeps the two stagnant kinds apart:** Venus's stagnant is
  `L≥L_STRONG` (data-placed) → ON the pilot; a seeded-band Earth `'stagnant'` pick is low-`L` → OFF the
  pilot (stays despun). This is exactly the "two despun destinations never conflated" contract (§5.1 note);
  the wet-stagnant world's `effectiveL` (which V2-2a does NOT read — GROUNDING Q2) is a **V2-2b** concern.
- **Boundary-vector truth table (all asserted):** `(L 0.64, rt 0)`→pure-strong · `(L 0.62, rt 0)`→mixed ·
  `(L 0.70, rt 0.20)`→mixed (tidal-shoulder) · `(cls rocky, m_hp +1)`→pure-weak. Subtractive: Lava/Magma→true
  (heat-pipe) · Venus→true (hot-surface-stagnant) · Mars (dead-lid, L 0.551, m_hp −0.45)→false · Earth→false
  (low-L, no heat-pipe) · Crystal (icy)→false.

### 4.2 `MIXED_LO` (the mixed floor) — router-owned local constant, flagged

The mixed interior's lower edge (`≈0.35`, gate-1 §7) separates Mars-mixed (0.551) from Earth-off-pilot
(0.250). `e1Regime.js` holds this value as the module-private `MOBILE_L=0.35` (:47), which the contract's
permitted export edit does **NOT** cover (only `L_STRONG`/`SHOULDER_LO`). Decision: **declare `MIXED_LO=0.35`
locally in `lidResponse.js`**, with a code comment tying it to `e1Regime.MOBILE_L`. This is contract-compliant
(the AC-0 grep forbids only re-declaring `0.63`/`0.15`, not `0.35`). **Flagged (R-A3, MEDIUM):** for V2-2a the
floor only separates Mars-mixed from Earth-off-pilot — **neither renders** (both un-wired / oracle-excluded),
so a UAT retune drift is inert this increment; a V2-2b/V2-3 note recommends promoting `MOBILE_L` to an export
if the floor becomes load-bearing at the dispatch flip.

### 4.3 `writeLidResponseSphere` signature + the two corner call sites (argument-for-argument, rivers:482/:491)

```
writeLidResponseSphere(carrier, drivers, {
  e1,                 // the computeE1 tuple (classification input; caller precomputes)
  rawTidal,           // cv.rawTidalIoRatio (tidal-shoulder input; caller precomputes, like T_ss)
  macroSeed = 0,
  locked   = false,
  T_ss     = 0,       // caller computes locked?(T_eq??0)*1.4:0 (D3-MF3 pass-through — forwarded VERBATIM)
  grainDrivers,       // DEFAULT_GRAIN_DRIVERS for the strong corner (argument-for-argument with rivers:491)
} = {})
```
```
const STRONG_REGIME = 'venus-stagnant-lid';           // the single V2-2a strong constant (archetype-free; must-fix #3)
const fineClass = classifyLidPath(e1, rawTidal);
switch (fineClass) {
  case 'pure-weak': {
    const tune = magmaDriversToTune(drivers);          // === rivers:481 (MAGMA_REF → null → DEFAULTS branch)
    const magmaDiag = writeMagmatismSphere(carrier, drivers, { macroSeed, locked, T_ss, tune });  // === rivers:482, byte-for-byte
    return { path: 'lid-weak', fineClass, primitiveId: /* optional uniform lava-plain fill */, magmaDiag };
  }
  case 'pure-strong': {
    // regime resolved ARCHETYPE-FREE from e1.geodynamicRegime==='stagnant' → STRONG_REGIME.
    // NEVER stagnantLidRegimeOf(archetype) (that takes a preset LABEL — AC-0 denylist).
    const stagnantDiag = writeStagnantLidReliefSphere(carrier, grainDrivers, { macroSeed, regime: STRONG_REGIME }); // === rivers:491
    return { path: 'lid-strong', fineClass, primitiveId: /* optional uniform basaltic-plain fill */, stagnantDiag };
  }
  default:  // 'mixed' | 'off-pilot' — NO height written (§5.5 no new height machinery); return-marker, NOT a throw
    return { path: fineClass === 'mixed' ? 'lid-mixed' : 'lid-offpilot', fineClass, unimplemented: true };
}
```

- **The corner ASYMMETRY (GROUNDING Q3, a real gotcha):** the weak corner takes `drivers`(=bodyDrivers) +
  `{macroSeed, locked, T_ss, tune}`; the strong corner takes `grainDrivers` + `{macroSeed, regime}` (tune
  omitted → null → DEFAULTS). A naive uniform bundle would not be argument-for-argument faithful to the
  shipped sites. (Both corners `void drivers` today, so the drivers-arg swap is byte-inert *now* — the
  faithfulness is future-proofing for V2-2b + an AC-0 arg-audit target, not a current byte lever.)
- **Return shape:** the corner writer's full diagnostics are returned **nested** under `magmaDiag` /
  `stagnantDiag` (mirrors `writeBodyRelief`'s `{path, magmaDiag, stagnantDiag}` shape) so `path`/`fineClass`/
  `primitiveId` never collide with corner keys; the byte harness compares `carrier.height` (unambiguous) +
  the nested diag arrays.
- **`T_ss` structural pass-through (AC-TSS-PRE-GATE):** the weak branch forwards `opts.T_ss` verbatim — the
  router source contains **no** internal `(T_eq??0)*1.4` and no `T_ss` reassignment on the weak path. This is
  what makes Lava's 1330 / Magma's 2800 basins byte-identical regardless of gate ordering.

### 4.4 `primitiveId` enum + `familyOf` map (gate-3 Open-Q1/Q2 + §2.4 expression legend)

Exported constants **beside `writeLidResponseSphere`**, importable by the (V2-2b) mixed writer and the
(V2-2b) gate-3 metric. **Load-bearing: `lava-plain` and `stagnant-basaltic-plain` are DISTINCT ids** (Open-Q2
— `familyOf` must route lava-plain→PIERCE and basaltic-plain→TENT, else the Io-vs-Venus contrast blurs).

```
export const FAMILY = Object.freeze({ TENT: 0, PIERCE: 1 });   // gate-3 §Decision: PIERCE=1, TENT=0
export const PRIMITIVE_ID = Object.freeze({
  // PIERCE family — magmatic / weak-lid expressions (gate-3 §Decision; §2.4 legend)
  shield: 1, caldera: 2, patera: 3, 'lava-plain': 4,
  // TENT family — strong-lid expressions
  corona: 5, tessera: 6, rift: 7, 'stagnant-basaltic-plain': 8,
});
const PIERCE_IDS = new Set([1, 2, 3, 4]);
export function familyOf(id) { return PIERCE_IDS.has(id) ? FAMILY.PIERCE : FAMILY.TENT; }
```

V2-2a authors the **schema only**. V2-2b POPULATES the multi-valued mixed `primitiveId`, co-emits `centerId`
(gate-3 Open-Q3), and runs `Π=C·F` (gate-3 Open-Q6) — all deferred. The corners are single-family (pure-weak
all PIERCE, pure-strong all TENT), so `Π` on them is trivially 0 — the instrument earns its keep only on the
mixed world.

### 4.5 The byte-harness recipe (which fixture/idiom; how Lava/Magma's locked/T_ss reach the router headlessly)

Reuse `buildBundle` from `tests/fixtures/v2-0-carrier-golden.mjs` (single-sources the lab bundle) + the
run-twice `Float32Array`-equality idiom (magmatism-structure :78-100). `carrierOf = () =>
makeSphereField(buildIrregularSphere(TARGET_N, LLOYD))` with `TARGET_N=700, LLOYD=2` (either 700/2 or the
magmatism suite's 600/2 works — byte-identity is *same-mesh-both-sides*; pinned to 700/2 for fixture parity).

**AC-BYTE-LAVA / AC-BYTE-MAGMA (real preset vectors, tune≠null path), per seed ∈ {1,2,3,7,42}:**
```
const b = buildBundle('Lava (hot airless)' /* or 'Magma (K2-141b)' */, seed);  // {locked, bodyDrivers:{…,condition}, grainDrivers, T_eq}
const T_ss    = b.locked ? (b.T_eq ?? 0) * 1.4 : 0;               // Lava 950→1330 ; Magma 2000→2800 (rivers:476 verbatim)
const e1      = computeE1(b.bodyDrivers.condition, seed);          // classifies pure-weak (m_hp huge)
const rawTidal= b.bodyDrivers.condition.rawTidalIoRatio;
// router side
const cA = carrierOf();
const rA = writeLidResponseSphere(cA, b.bodyDrivers, { e1, rawTidal, macroSeed: seed, locked: b.locked, T_ss, grainDrivers: b.grainDrivers });
// direct side (rivers:481-482 verbatim)
const cB = carrierOf();
const rB = writeMagmatismSphere(cB, b.bodyDrivers, { macroSeed: seed, locked: b.locked, T_ss, tune: magmaDriversToTune(b.bodyDrivers) });
expect(Array.from(cA.height)).toEqual(Array.from(cB.height));
expect(Array.from(cA.faultDensity)).toEqual(Array.from(cB.faultDensity));
for (const f of ['plumeId','A_e','magmaOceanMask','edificeMask','lavaPlainMask']) expect(Array.from(rA.magmaDiag[f])).toEqual(Array.from(rB[f]));
expect(magmaDriversToTune(b.bodyDrivers)).not.toBeNull();          // exercises the tune≠null path
// AC-BYTE-MAGMA additionally: expect the magmaOceanMask non-empty (T_ss=2800 wide basin present)
```
**AC-BYTE-WEAK-REF (MAGMA_REF tune=null DEFAULTS branch):** `drivers = MAGMA_REF` (imported from
`magmatism.js`; `magmaDriversToTune(MAGMA_REF)===null`), with a hand-set pure-weak-forcing
`e1 = {compositionClass:'rocky', m_hp:+1, L:0, geodynamicRegime:'heat-pipe'}` (the classifier's pure-weak
gate keys on `m_hp` only, so the DEFAULTS branch is exercised independent of a real condition vector);
compare router vs `writeMagmatismSphere(cB, MAGMA_REF, {macroSeed, locked, T_ss, tune:null})` over
`{locked∈{false,true}, T_ss∈{0,2800}}` × seeds.

**AC-BYTE-STRONG-REF (Venus, archetype-free regime):**
```
const b = buildBundle('Venus (sulfuric shroud)', seed);           // locked:false
const e1 = computeE1(b.bodyDrivers.condition, seed);              // geodynamicRegime==='stagnant', L 0.728 → pure-strong
const rA = writeLidResponseSphere(cA, b.bodyDrivers, { e1, rawTidal: b.bodyDrivers.condition.rawTidalIoRatio, macroSeed: seed, locked: b.locked, T_ss: 0, grainDrivers: b.grainDrivers });
const rB = writeStagnantLidReliefSphere(cB, b.grainDrivers, { macroSeed: seed, regime: 'venus-stagnant-lid' });  // rivers:491, drivers=grainDrivers
expect(Array.from(cA.height)).toEqual(Array.from(cB.height));
expect(Array.from(cA.grainAngle)).toEqual(Array.from(cB.grainAngle));   // stagnantLid writes grainAngle too
expect(Array.from(cA.faultDensity)).toEqual(Array.from(cB.faultDensity));
// regime cross-check via the TEST-ONLY import (router never calls it):
import { stagnantLidRegimeOf } from '../src/worldengine/base/stagnantLid.js';
expect(rA.stagnantDiag.regime).toBe(stagnantLidRegimeOf('stagnant-lid', b.locked));  // === 'venus-stagnant-lid'
```

**AC-TSS-PRE-GATE (source + matrix):** grep the weak path for any `(T_eq ?? 0) * 1.4` or `T_ss =`
reassignment (must be ABSENT); assert `writeLidResponseSphere`'s forwarded `T_ss` equals
`locked?(T_eq??0)*1.4:0` across a `{locked∈{false,true}} × {T_eq∈{0,950,2000}}` matrix (identity check).

### 4.6 The mixed-stub marker + AC-TUNE-NULL naming (GROUNDING Q2/Q5, designDecisions)

- **Mixed stub = return-marker, NOT a throw:** `{path:'lid-mixed', fineClass:'mixed', unimplemented:true}`,
  `carrier.height` UNWRITTEN — so classification tests + any future probe read the fine-class without
  try/catch, and V2-2b swaps the real machinery in at exactly this branch (a clean seam).
- **`AC-TUNE-NULL` is WEAK-SIDE ONLY:** the router reuses the **existing** `magmaDriversToTune` (magmatism.js:113)
  — **no `lidDriversToTune` alias** (the §5.3 name is satisfied by `magmaDriversToTune`). The §5.3 table's
  stagnant-side `stagnantDriversToTune(Venus)→null` is **NOT** V2-2a — `stagnantDriversToTune` does not exist
  today (§3.2 #4b, stagnant is `void drivers`); building it is the from-scratch V2-2b response. The test
  asserts no `stagnantDriversToTune` symbol is introduced.

---

## 5. Risks + rollback (per slice; no clock-time estimates)

- **R-A1 — export-only edit perturbs `e1Regime.js` runtime (Slice A, LOW→GATED).** Adding `export` to
  `L_STRONG`/`SHOULDER_LO` must change no value. *Mitigation:* the reviewable diff shows only the `export`
  keyword added to :43/:44; `computeE1`'s own `const` reads are unchanged; the e1 runtime suites
  (`worldengine-e1-regime`/`-gate-fidelity`) + the 75 goldens stay green. *Rollback:* remove the two `export`
  keywords — `e1Regime.js` returns to its 83a62a1 export surface.
- **R-A2 — classifier seed-dependence (Slice A, HIGH→GATED).** If `classifyLidPath` read the seeded
  `geodynamicRegime`, an in-band Earth/Ocean/Eyeball `'stagnant'` seed would flip it to `'mixed'` and break
  AC-CONFORMANCE-FINE. *Mitigation:* `classifyLidPath` reads ONLY `{compositionClass, m_hp, L}` + `rawTidal`
  (§4.1); the FINE test sweeps **5 seeds × 15 presets** to prove seed-independence; `geodynamicRegime` is
  read ONLY by `isUnbrokenLidPath`, `L`-guarded so a low-`L` seeded pick can't reach the pilot. *Rollback:*
  n/a (design-time invariant).
- **R-A3 — `MIXED_LO=0.35` re-declared vs `e1Regime.MOBILE_L` (Slice A, MEDIUM-DECLARED).** A UAT retune of
  the mixed floor could drift the two apart. *Mitigation:* for V2-2a the floor only separates Mars-mixed from
  Earth-off-pilot — neither renders (router un-wired, Mars oracle-excluded), so the drift is inert this
  increment; a code comment ties `MIXED_LO` to `MOBILE_L`; a V2-2b/V2-3 note recommends exporting `MOBILE_L`
  if the floor becomes load-bearing at the flip. *Rollback:* n/a.
- **R-A4 — `lidResponse.js` importing `e1Regime.js` silently clobbers the green `worldengine-e1-shadow-audit`
  suite (Slice A, MED→GATED — a REAL regression, not bookkeeping).** The shadow audit globs `base/*.js` minus
  `e1Regime.js` (:24/:28) and asserts none imports `e1Regime` (:39 regex `/from\s+['"][^'"]*e1Regime/`);
  `lidResponse.js` MUST import `L_STRONG`/`SHOULDER_LO`/`HEATPIPE_PEG` from `e1Regime.js` (must-fix #4, an
  import with no alternative) → it matches the regex → the suite flips green→red — a NEW failure that directly
  violates AC-ZERO-CLOBBER's "no new failures vs the pre-change baseline" + `mustStayWorking`'s "sibling suites
  green". *Mitigation:* the Slice-A byte-safe one-line filter edit excludes `lidResponse.js` (the legit E1
  router, excluded like the E1 SOURCE `e1Regime.js` is), AND `worldengine-e1-shadow-audit.test.js` is ADDED to
  the Slice-A commit gate so the regression is caught at the earliest slice; the audit's routing/render target
  is preserved (`planet-lod-rivers.js` stays audited; router-absence enforced separately by AC-ZERO-CLOBBER's
  dispatch grep). *Rollback:* revert the one-line filter change (meaningful only if `lidResponse.js` is also
  removed).
- **R-B1 — corner argument asymmetry (Slice B, MED→GATED).** Passing `bodyDrivers`+`T_ss`+`tune` to the
  strong corner, or `grainDrivers`+`regime` to the weak corner, would diverge from the shipped sites (and
  break V2-2b faithfulness). Both corners `void drivers` today so a swap is byte-inert *now*. *Mitigation:*
  the byte harness + an AC-0 source/arg grep assert each branch's exact args (weak = `drivers`+`{locked,T_ss,
  tune}`; strong = `grainDrivers`+`{regime}`). *Rollback:* revert the delegation branch.
- **R-B2 — `T_ss` re-derivation drift → Magma basin not byte-identical (Slice B, MED→GATED).** *Mitigation:*
  AC-TSS-PRE-GATE — the router forwards `opts.T_ss` verbatim; grep the weak path for any internal `*1.4` /
  `T_ss` reassignment; the `{locked,T_eq}` matrix + AC-BYTE-MAGMA's wide-basin equality are the mechanical
  proof. *Rollback:* n/a (the router never computes T_ss).
- **R-B3 — router return keys leak into / collide with the byte comparison (Slice B, LOW→GATED).**
  *Mitigation:* the corner return is nested under `magmaDiag`/`stagnantDiag`; the byte comparison keys on
  `carrier.height` (the mutated carrier, unambiguous) + explicit nested corner fields. *Rollback:* adjust the
  return shape.
- **R-C1 — a `'lid:'` draw or `Math.random`/`Date.now` slips in (Slice C, LOW→GATED).** *Mitigation:* AC1
  source grep (zero `'lid:'` draws — namespace RESERVED; zero `Math.random(`/`Date.now(`) + the repeat-call
  determinism assert. *Rollback:* remove the offending draw (V2-2a needs none — the classifier is pure, the
  delegates keep their own `'magma:'`/`'stagnant:'` streams). 
- **R-C2 — `primitiveId` lumps lava-plain and basaltic-plain (Slice C, LOW→GATED, gate-3 Open-Q2).** A single
  "plains" id would collapse `familyOf`. *Mitigation:* AC-PRIMITIVEID-SCHEMA asserts the two are DISTINCT ids
  with correct PIERCE/TENT families. *Rollback:* n/a (design-time).
- **R-C3 — the router accidentally wired into `writeBodyRelief` (Slice C, LOW→GATED).** *Mitigation:*
  AC-ZERO-CLOBBER grep — `writeBodyRelief` neither imports nor calls `writeLidResponseSphere`; the 75 goldens
  stay 75/75 (that un-changed green IS the zero-clobber proof). *Rollback:* n/a (never wired this increment).
- **R-C4 — optional corner `primitiveId` emit moves a golden (Slice C, LOW→GATED).** *Mitigation:* it is a
  router **return** field, not a carrier field, AND the router is un-wired (never reaches the 75-golden
  harness); AC-PRIMITIVEID-SCHEMA asserts the 5 hashed carrier fields are byte-identical with vs without the
  emit. *Rollback:* drop the optional emit (the enum + `familyOf` schema — the load-bearing deliverable —
  stands alone).
- **R-C5 — "no pre-existing test dropped" bookkeeping (Slice C, LOW).** V2-2a adds ~4 new test files (count
  rises) and EDITS one shipped test file in place (`worldengine-e1-shadow-audit.test.js`, the R-A4 one-line
  exclusion — still present, still green). *Mitigation:* read the clause as "no pre-existing test dropped/skipped;
  the 4 known unrelated failures — KnownObjects ×3, GalacticFeatures ×1 — do not grow"; full `npx vitest run`
  diff vs the pre-change baseline at the Slice-C gate. **`worldengine-e1-shadow-audit` is NOT one of those 4
  known failures — if it is RED at ANY gate that is the R-A4 clobber, a GENUINE AC-ZERO-CLOBBER violation, NOT a
  "known unrelated failure" to wave through; it MUST be green (fixed by the Slice-A exclusion) before any commit.
  Do not misframe a 5th red suite under the "4 known failures" clause — that would mask a real clobber.**
  *Rollback:* n/a (bookkeeping).
