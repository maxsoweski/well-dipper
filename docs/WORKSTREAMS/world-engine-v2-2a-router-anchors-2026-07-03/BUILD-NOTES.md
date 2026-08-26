# BUILD NOTES — V2-2a "Anchor-preserving router + both byte-anchors" · AC-0 conformance evidence

Provenance: authored by the Slice-C build agent 2026-07-04 against the SIGNED contract.json (AC-0, AC1,
AC-BYTE-{WEAK-REF,STRONG-REF,LAVA,MAGMA}, AC-TSS-PRE-GATE, AC-TUNE-NULL, AC-CONFORMANCE-FINE,
AC-SUBTRACTIVE-GATE, AC-MIXED-STUB, AC-PRIMITIVEID-SCHEMA, AC-ZERO-CLOBBER — 13) + BUILD-PLAN.md
(adversarially reviewed) at HEAD after Slice A (`9892275`), Slice B (`5e726a7`). This file is **AC-0's
evidence** (contract AC-0 `verifyVia.input`: "Read the diff + BUILD-NOTES conformance table"). It reproduces
the V2-0 §4 / V2-1 BUILD-NOTES Table A/B/C worked-example discipline: every scalar the router **reads** × its
D-slot / named backing, and every field the router **emits** × its named consumer.

**Line of sight (feature → outcome).** V2-2a lays the *spine* of the condition-first unification: one
condition-derived router (`writeLidResponseSphere` = classifier + corner delegation) that classifies a body's
E1 coordinates into `pure-weak / pure-strong / mixed / off-pilot` and proves, **byte-for-byte**, that routing
the already-UAT'd Lava, Magma and Venus worlds through it changes **not a single byte** of what renders. It
**prepares** Max's "every stagnant-lid world is a re-rolled Venus" fix; V2-2b **ships** it. JOURNEY milestone =
the SCREENSAVER world-variety arc; **no PLAYER_EXPERIENCE tier is touched** (pure routing/plumbing, V2-0
character) ⇒ **no UAT AC** (GROUNDING Q6). Terminal gate is `verify-workstream` green → **VERIFIED** (no
`VERIFIED_PENDING_MAX` hold), matching V2-0 (`0461463`).

---

## 0. record-build-intent (plain language — the whole router across Slices A/B/C)

**What it does.** `src/worldengine/base/lidResponse.js` is a pure, deterministic, **label-free** module that
answers one question about a planet — *"given its condition (its E1 coordinates), which lid-response does it
belong to, and what would that response write?"* — without ever touching the render path.

- **`classifyLidPath(e1, rawTidal)`** (Slice A) returns the FINE class `'pure-weak' | 'pure-strong' | 'mixed'
  | 'off-pilot'` from `{compositionClass, m_hp, L}` + `rawTidal` only.
- **`isUnbrokenLidPath(e1)`** (Slice A) is the SUBTRACTIVE migration gate: `true` only for a rocky body that
  today reads as an unbroken (heat-pipe OR hot-surface-stagnant) lid — the two writers V2-2 unifies.
- **`writeLidResponseSphere(carrier, drivers, opts)`** (Slice B) is the TOTAL router: it classifies, then
  **delegates the two pure corners to the UNCHANGED shipped writers** (`writeMagmatismSphere` /
  `writeStagnantLidReliefSphere`) argument-for-argument with the shipped dispatch call sites
  (`planet-lod-rivers.js:481-482` weak, `:491` strong); on `mixed` / `off-pilot` it returns an
  explicit-unimplemented marker and leaves `carrier.height` UNWRITTEN.
- **`PRIMITIVE_ID` + `FAMILY` + `familyOf`** (Slice C) are the exported landform-expression **schema** the
  V2-2b mixed writer + the gate-3 `Π=C·F` interpenetration statistic will read; plus an OPTIONAL uniform
  per-node `primitiveId` corner emit (a NEW return field).

**Why (intent).** Convert the two cheapest-to-unify shipped writers (magmatism, stagnant-lid) from
archetype-gated menus into one **condition-derived** response space, and prove the conversion clobbers
nothing before wiring it. The whole increment is the shadow-then-adopt discipline V2-1 used one layer up:
stand the router up, prove byte-identity at both anchors and the real preset vectors, keep it un-wired.

**Deliberate non-goals (what V2-2a does NOT do).**
- **Does NOT wire the router into `writeBodyRelief`.** Dispatch still routes on `PRESET_ARCHETYPE`; the V2-3
  flip is out of scope. AC-ZERO-CLOBBER's dispatch-absence grep enforces this.
- **Adds NO new height-writing machinery.** Mixed vectors get a return-marker, `carrier.height` unwritten
  (§5.5). V2-2b swaps the real mixed-interior writer into that exact `'mixed'` branch — a clean seam.
- **Draws NO `'lid:'` alea.** The `'lid:strength:'`/`'lid:yield:'` streams (gate-2 PG-1) are V2-2b; the
  namespace is RESERVED (zero draws). The classifier is pure; the corners keep their own `'magma:'`/
  `'stagnant:'` streams, called unchanged.
- **Introduces NO `stagnantDriversToTune`** and **NO `lidDriversToTune` alias** — the weak side reuses the
  existing `magmaDriversToTune` (grounding Q2). The strong side is `void drivers` today (§3.2 #4b).
- **Re-captures NO golden.** The 75-golden byte-identity set is never re-captured; its unchanged green IS the
  zero-clobber proof.
- **Populates NO multi-valued mixed `primitiveId`, co-emits NO `centerId`, runs NO `Π=C·F`** — all V2-2b.
  V2-2a authors the schema only; the corners are single-family (Π trivially 0).

---

## 1. AC-0 Table A — driver connectivity (every scalar the router READS × its D-slot / named backing)

Verified by reading `src/worldengine/base/lidResponse.js` as landed (Slices A+B+C). **No archetype-string
input** — grep-enforced by `tests/worldengine-lid-router-audit.test.js` (AC-0 leg): no `e1.label`, no
`PRESET_ARCHETYPE`, no `stagnantLidRegimeOf(` call/import.

| Router reads (`classifyLidPath` / `isUnbrokenLidPath` / `writeLidResponseSphere`) | D-slot / named backing | used for |
|---|---|---|
| `e1.compositionClass` | E1 Stage-A: density **D2** / C:O **D10** / atmosphere passthrough | classifier terminal (`!== 'rocky'` → off-pilot, fires first); subtractive-gate §1 label carve-out |
| `e1.m_hp` (`= rawTidal − HEATPIPE_PEG`, precomputed by `computeE1`) | **D12 raw** − exported peg (`e1Regime.js:40`) | classifier pure-weak gate (fires before `L`); subtractive-gate heat-pipe edge |
| `e1.L` | E1 gate-1 form (`z(T_surf,age)·μProxy(V,T_surf)·gMod`) | classifier pure-strong / mixed cuts; subtractive-gate hot-surface-stagnant `L`-guard |
| `e1.geodynamicRegime` | E1 edges + seeded middle (`'e1:regime:'`) | subtractive-gate hot-surface-stagnant edge (`==='stagnant'`); strong-regime resolution → `'venus-stagnant-lid'` |
| `rawTidal` (`= cv.rawTidalIoRatio`) | **D12 raw** (caller precomputes, passed in opts — like T_ss) | classifier tidal-shoulder cut (PG-5: pure-strong = `L≥L_STRONG AND rawTidal<SHOULDER_LO`) |
| `opts.T_ss` | **NAMED DERIVATION** `locked?(T_eq??0)*1.4:0` (D3-MF3, rivers:476) | pure-weak delegation → `writeMagmatismSphere` substellar basin (**forwarded VERBATIM** — no internal `*1.4`, no `T_eq` read; AC-TSS-PRE-GATE) |
| `L_STRONG` / `SHOULDER_LO` / `HEATPIPE_PEG` | **IMPORTED** from `e1Regime.js:43/:44/:40` (single source of truth, must-fix #4) | classification cuts (grep asserts NO re-declared `0.63`/`0.15` literals) |
| `drivers` (bodyDrivers) | neutral bundle `buildNeutralBodyDrivers` (V2-0) | pure-weak delegation drivers arg + `magmaDriversToTune(drivers)` |
| `opts.grainDrivers` (`DEFAULT_GRAIN_DRIVERS`) | shipped default grain bundle (rivers:92) | pure-strong delegation drivers arg (argument-for-argument :491) |
| `opts.macroSeed`, `opts.locked` | lab seed / `tidalState.locked` (data) | delegation opts |
| `carrier.count` (`=== carrier.height.length`) | mesh node count (`makeSphereField`) | sizes the OPTIONAL uniform `primitiveId` Int32Array corner emit |
| *NOT read: `e1.label` (§1 invariant); `PRESET_ARCHETYPE`; `stagnantLidRegimeOf(archetype)`; `MOBILE_L` (router-owns `MIXED_LO` locally, §4.2); `e1.{Φ,n,V,effectiveL,positionWithinRegime}` (V2-2b)* | — | — |

**`MIXED_LO=0.35` (router-owned local, R-A3, MEDIUM-DECLARED).** The mixed floor separating Mars-mixed (L
0.551) from Earth-off-pilot (L 0.250). `e1Regime.js` holds this as the module-private `MOBILE_L=0.35` (:47),
which the permitted export-only edit does NOT cover (only `L_STRONG`/`SHOULDER_LO`). Declared locally
(`lidResponse.js:51`) with a comment tying it to `e1Regime.MOBILE_L`. Contract-compliant (the AC-0 grep
forbids re-declaring only `0.63`/`0.15`, not `0.35`). Inert this increment: the floor only separates
Mars-mixed from Earth-off-pilot and neither renders (router un-wired; Mars oracle-excluded). V2-2b/V2-3 note:
promote `MOBILE_L` to an export if the floor becomes load-bearing at the dispatch flip.

**Accepted debt to declare.** Dispatch (`writeBodyRelief`) still routes on `PRESET_ARCHETYPE` — the un-wired
seam, retired at V2-3; the router itself is archetype-free.

## 2. AC-0 Table B — named consumer (every field the router EMITS × its reader from the ROADMAP-v2 DAG)

| Router emits | set by (input → derivation) | named consumer |
|---|---|---|
| `classifyLidPath` fineClass (`pure-weak\|pure-strong\|mixed\|off-pilot`) | E1 gate order (§4.1) | **AC-CONFORMANCE-FINE now**; V2-3 dispatch flip |
| `isUnbrokenLidPath` boolean | subtractive gate (D3-MF1) | **AC-SUBTRACTIVE-GATE now**; V2-3 (widens as siblings absorbed) |
| pure-weak delegation → `carrier.height` + `magmaDiag` (UNCHANGED writer) | `m_hp>0` (Lava/Magma) | **AC-BYTE-WEAK-REF/-LAVA/-MAGMA now**; existing `magmaProbe`; ships byte-identical Lava/Magma |
| pure-strong delegation → `carrier.height` + `stagnantDiag` (UNCHANGED writer) | `L≥L_STRONG AND rawTidal<SHOULDER_LO` (Venus) | **AC-BYTE-STRONG-REF now**; existing `stagnantLidProbe`; ships byte-identical Venus |
| mixed marker `{path:'lid-mixed',fineClass:'mixed',unimplemented:true}`; `carrier.height` UNWRITTEN | mixed band (hand-set only in V2-2a) | **AC-MIXED-STUB now**; V2-2b swaps real mixed machinery in at this exact branch |
| `PRIMITIVE_ID` enum + `FAMILY` + `familyOf` (lava-plain ≠ stagnant-basaltic-plain) | authored schema (gate-3 Open-Q1/Q2) | **AC-PRIMITIVEID-SCHEMA now**; V2-2b mixed writer + gate-3 `Π=C·F` interpenetration statistic |
| OPTIONAL uniform `primitiveId: Int32Array` corner emit (NEW return field) | pure-weak → lava-plain (PIERCE) / pure-strong → basaltic-plain (TENT) | V2-2b interpenetration statistic |
| `'lid:'` alea namespace RESERVED (no draws) | — | V2-2b `'lid:strength:'`/`'lid:yield:'` mixed-interior streams (gate-2 PG-1) |

No dead fields.

**The `rivers:483` `appliedTune` note (delegation reviewer flag).** The shipped dispatch mutates the returned
diag after the weak call: `magmaDiag.appliedTune = magmaTune` (`planet-lod-rivers.js:483`). The router's
pure-weak branch **intentionally omits** this post-call mutation — the delegation reproduces only the writer
call itself (rivers:481-482), not the dispatch's post-processing. This is safe on two counts:
1. **Byte-safe** — `appliedTune` is a diag scalar, not one of the 5 hashed carrier fields, and the
   AC-BYTE-* harness compares `carrier.height` + the diag *arrays* (`plumeId`, `A_e`, `Psi_e`,
   `magmaOceanMask`, `edificeMask`, `lavaPlainMask`), never `appliedTune`. So every byte anchor passes.
2. **Behavior-safe even for the live probe** — the live `magmaProbe` **recomputes** `appliedTune` locally
   from `bodyDrivers` (`world-engine-lab.html:6055` `magmaDriversToTune(bodyDrivers)` → :6088 emit); it does
   **not** read `magmaDiag.appliedTune` off the writer's return. So the omission is inert for the probe too.
**Reconcile at V2-3:** when the router is wired into `writeBodyRelief`, if any *future* consumer reads
`magmaDiag.appliedTune` off the router's return (rather than recomputing from `bodyDrivers`), re-add the
`magmaDiag.appliedTune = tune` mutation at the weak delegation site. Flagged, not built (V2-2a has no such
consumer).

## 3. AC-0 Table C — taxonomy registration

V2-2a adds **no** lab control / preset / feature / province. The `_lab.lidRouteProbe` live surface is
**DEFERRED / not built** (designDecision Q3; V2-2a renders nothing new). No `.add(state,'…Enabled')` key ⇒
`tests/planet-archetypes.test.js` drift guards stay green with **no taxonomy change**. If a future GUI toggle
is added it registers in `planet-archetypes.js` (flagged, not built).

---

## 4. Grep-audit results (AC-0 + AC1 + AC-ZERO-CLOBBER mechanical evidence)

From `tests/worldengine-lid-router-audit.test.js` (comments stripped before grepping — the router legitimately
NAMES forbidden symbols in "we don't do this" comments; only definitions/uses count):

- **LABEL-FREE (AC-0):** router source matches no `/\.label\b/`, no `/PRESET_ARCHETYPE/`, no
  `/stagnantLidRegimeOf/`. The strong regime is resolved from `/geodynamicRegime\s*===\s*'stagnant'/` →
  the single constant `'venus-stagnant-lid'`.
- **SINGLE SOURCE OF TRUTH (AC-0, must-fix #4):** router matches `import { L_STRONG, SHOULDER_LO, HEATPIPE_PEG
  } from './e1Regime.js'`; matches NO re-declared `/\b0\.63\b/` or `/\b0\.15\b/` literal.
- **DETERMINISM + RESERVED NAMESPACE (AC1):** router matches no `/Math\.random\s*\(/`, no `/Date\.now\s*\(/`,
  no `/\balea\b/` (⇒ zero `'lid:'` draws; the path markers use `'lid-'` hyphens, not the `'lid:'` colon).
  Repeat-call on a fixed `(e1, opts)` → identical `fineClass` + identical `carrier.height` + identical
  `primitiveId`.
- **DISPATCH ABSENCE (AC-ZERO-CLOBBER):** `planet-lod-rivers.js` (comments stripped) matches no
  `/from ['"][^'"]*lidResponse/`, no `/writeLidResponseSphere/`, no `/classifyLidPath/` — and the isolated
  `writeBodyRelief` function body references none of them. The router is absent from the dispatch seam.

## 5. Byte-anchor + mixed-stub pass summary

| AC | Anchor | Result (Slice B/C) |
|---|---|---|
| AC-BYTE-WEAK-REF | MAGMA_REF (`tune=null` DEFAULTS branch), `{locked}×{T_ss∈{0,2800}}×5 seeds` | router `carrier.height` + magma-diag arrays === `writeMagmatismSphere(…,tune:null)` direct |
| AC-BYTE-LAVA | real Lava preset (`tune≠null`, T_ss=1330 narrow basin), 5 seeds | byte-equal; `magmaDriversToTune(Lava)` non-null both sides |
| AC-BYTE-MAGMA | real Magma preset (`tune≠null`, T_ss=2800 WIDE basin), 5 seeds | byte-equal incl. `magmaOceanMask` non-empty + `thetaSea`/`D_flood` |
| AC-BYTE-STRONG-REF | Venus (archetype-free regime → `'venus-stagnant-lid'`), 5 seeds | byte-equal `height`/`grainAngle`/`faultDensity`; regime === `stagnantLidRegimeOf('stagnant-lid', locked)` (test-only resolver) |
| AC-TSS-PRE-GATE | source grep + `{locked}×{T_eq}` matrix | no internal `*1.4`, no `T_eq` read; forwarded T_ss === `locked?(T_eq??0)*1.4:0` |
| AC-TUNE-NULL | `magmaDriversToTune(MAGMA_REF)===null` | router reuses the existing builder; no `lidDriversToTune`/`stagnantDriversToTune` symbol |
| AC-CONFORMANCE-FINE | 15 presets × 5 seeds + 4 boundary vectors + margins | `{Lava,Magma}=pure-weak`, `Venus=pure-strong`, 12=off-pilot, 0=mixed; seed-independent |
| AC-SUBTRACTIVE-GATE | Mars/despun/exotics | `isUnbrokenLidPath` true ONLY {heat-pipe, hot-surface-stagnant} rocky; two despun destinations distinct |
| AC-MIXED-STUB | hand-set mixed (L 0.5) + off-pilot (L 0.30) | return-marker; `carrier.height` byte-unchanged from sentinel; no corner emit; no `'lid:'` draw |
| AC-PRIMITIVEID-SCHEMA | enum + familyOf + uniform corner emit, 5 seeds | lava-plain ≠ basaltic-plain, correct PIERCE/TENT; emit is a NEW field; 5 hashed carrier fields byte-identical to the un-emitted direct call |

## 6. Gate results (per Slice, all commands headless `npx vitest run`)

| Gate | Command | Result |
|---|---|---|
| Slice A | classifier + shadow-audit + e1 runtime + 75-golden + drift | green (classifier + `worldengine-e1-shadow-audit` GREEN via the R-A4 one-line `lidResponse.js` exclusion; 75/75 unchanged) |
| Slice B | `worldengine-lid-byte-anchors` + `v2-0-byte-identity` | 2 files / 117 tests, 0 fail (byte anchors + 75/75 unchanged) |
| Slice C | `worldengine-lid-primitiveid` + `worldengine-lid-router-audit` + `v2-0-byte-identity` + `planet-archetypes` (+ `worldengine-e1-shadow-audit`) | **5 files / 142 tests, 0 fail** (75/75 goldens unchanged, drift guards green, shadow-audit GREEN) |
| Full suite (no new failures) | `npx vitest run` | **4 failed / 1754 passed (1758)** — the 4 are the pre-existing known failures (KnownObjects ×3, GalacticFeatures ×1); passed grew by exactly +23 (Slice-C's 14 primitiveid + 9 router-audit tests) vs the pre-build baseline (4 failed / 1731 passed / 1735). 15 `vendor/motion-test-kit/*` files fail to *load* (pre-existing infra) — unchanged. |

**`worldengine-e1-shadow-audit` is GREEN at every gate** (fixed by the Slice-A one-line `lidResponse.js`
exclusion, R-A4). A RED shadow-audit would be the R-A4 clobber, NOT a 5th "known unrelated failure" — it never
went red.

**Deviations from plan:** none material. The OPTIONAL uniform `primitiveId` corner emit (BUILD-PLAN §1
Slice C "recommended") was BUILT (`uniformPrimitiveId`, `lidResponse.js:160`), so `AC-PRIMITIVEID-SCHEMA`
carries the extra byte-safety leg (emit-vs-un-emitted 5-hashed-field equality). The pure-strong branch's
archetype-free regime resolution keeps the Slice-B documentary ternary `e1.geodynamicRegime === 'stagnant' ?
STRONG_REGIME : STRONG_REGIME` (both arms the single constant) — the explicit coordinate read the AC-0 grep
asserts; left untouched by Slice C (delegation logic is Slice B's, committed).
