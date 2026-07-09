# V2-2b-2b — BUILD-NOTES

Build record for the falsification-worlds increment. One section per slice; measured numbers are REAL values
from the headless test runs at build time (not the plan's predictions), so a later reader / retune starts from
ground truth. Line cites in the plan were against HEAD `ecad42d`; this build landed on branch
`feature/world-engine-production-L1` (build HEAD `4ef2757`).

---

## SLICE 1 — effectiveL threading (wet-stagnant world)

**Landed:** the R-wetstag hand-up. `classifyLidPath` (lidResponse.js) and the composer `Ybase` (mixedInterior.js)
now read `effectiveL ?? L`, so a WET seeded-'stagnant' body routes to `'mixed'` (not off-pilot) and pierces at the
strong-but-piercable edge (a small handful) instead of pervasively. `e1Regime.js` is UNTOUCHED (it already emits
`out.effectiveL`); this slice only READS it. Terminal-gate ACs advanced: AC-EFFECTIVEL, AC-WETSTAG-BASIS (+ AC-0,
AC-ZERO-CLOBBER threaded). **Deviation from plan: NONE.**

### Files touched
| File | Change |
|---|---|
| `src/worldengine/base/lidResponse.js` | `classifyLidPath`: cuts #1/#2 stay RAW (`compositionClass`, `m_hp`); inserted `const L = e1.effectiveL ?? e1.L;` so cuts #3-6 read the effective L. `isUnbrokenLidPath` UNTOUCHED (still raw `e1.L`). JSDoc `@param` documents the optional `effectiveL` member; the `:30-34` R-A2 comment rewritten to "SEED-DEPENDENCE by design for WET in-band bodies" (§4 R1). |
| `src/worldengine/base/mixedInterior.js` | Kept `const L = e1.L` RAW; added `const Lyield = e1.effectiveL ?? L;`. `Ybase` now `Y0·exp(Y_K·Lyield)`. `mixedDiag` adds `effectiveL: Lyield` (raw `L` still published). Backward-compatible: a tuple with no `effectiveL` ⇒ `Lyield===L` ⇒ byte-unchanged. |
| `tests/worldengine-effectivel.test.js` (NEW) | AC-EFFECTIVEL (a/b/c) + AC-WETSTAG-BASIS. Composer stat helpers copied from `worldengine-mixed-composer.test.js:60-97`. |
| `tests/worldengine-lid-classifier.test.js` (reconcile) | §4 rows R2-R5 only (header-comment doc-sync + the two seed-split blocks). Every "Unaffected" block (boundary vectors, margins incl. Mars-mixed, all of `isUnbrokenLidPath`, the despun-destination block, the two "pins its defaults" its) left byte-identical. |
| `docs/…/BUILD-NOTES.md` (NEW) | this file. |

### Measured numbers (headless, N=1500 where a field is built; seeds {1,2,3,7,42})

**AC-EFFECTIVEL(c) — composer `Ybase` (seed-independent, a function of `Lyield` only):**
- `Ybase(effectiveL 0.60)` = **0.3412944060851765** (≈ 0.3413) — matches the plan's ≈0.3413.
- `Ybase(raw L 0.16)` = **0.007167417910949472** (≈ 0.0072) — matches the plan's ≈0.0072.
- pierceCount at (Φ 0.42, n 6): **wet (effectiveL) = 2 (seed 1), 3 (seed 2)** — a small handful (< n); **raw-L strip = 6 (=== n)** — pervasive. Confirms effectiveL yields the piercable-edge split; raw L 0.16 would give "Io-with-water".

**AC-WETSTAG-BASIS — wet coordinate `{L 0.16, effectiveL 0.60, Φ 0.42, n 6}` (composer field == 2b-2a's verified (L 0.60, Φ 0.42, n 6) compound, by construction):**

| seed | pierceCount | \|corr(mask,center)\| | \|corr(mask,lat)\| | pierceNodes / tentNodes | pierceFrac | primitiveId histogram (id:count) |
|---|---|---|---|---|---|---|
| 1 | 2 | 0.837 | 0.028 | 35 / 1465 | 0.0233 | `1:35 5:59 6:113 7:56 8:1237` |
| 2 | 3 | 0.774 | 0.106 | 61 / 1439 | 0.0407 | `1:59 2:2 5:81 6:98 7:47 8:1213` |
| 3 | 2 | 0.840 | 0.124 | 33 / 1467 | 0.0220 | `1:33 5:103 6:113 7:94 8:1157` |
| 7 | 2 | 0.744 | 0.114 | 29 / 1471 | 0.0193 | `1:28 2:1 5:158 6:111 7:129 8:1073` |
| 42 | 1 | 0.787 | 0.007 | 16 / 1484 | 0.0107 | `1:15 2:1 5:238 6:113 7:103 8:1030` |

- **TENT-family dominant** (tentFrac ≥ 0.959 every seed) with a **minority PIERCE presence** (pierceFrac 0.011–0.041, never 0).
- **Center-organized:** \|corr(structureMask, center predictor)\| ∈ [0.744, 0.840] ≥ 0.40; \|corr(structureMask, latitude)\| ∈ [0.007, 0.124] ⇒ cLat² < cCenter² every seed.
- **Distinct per seed:** all 5 primitiveId histograms distinct; pairwise TVD ∈ [0.0320, 0.1520].

**Venus composer reference `{L 0.728, Φ 0.69, n 6}` (the "not a re-rolled Venus" comparand — at SLICE 1 it is zero-pierce all-TENT, but that is NOT asserted, per §SLICE-1 [ADV-FIXED], so the test survives SLICE-2 breach):**

| seed | pierceCount | primitiveId histogram | TVD(wet, venus) same seed |
|---|---|---|---|
| 1 | 0 | `5:139 6:113 7:43 8:1205` | 0.0533 |
| 2 | 0 | `5:156 6:112 7:27 8:1205` | 0.0593 |
| 3 | 0 | `5:161 6:113 7:76 8:1150` | 0.0387 |
| 7 | 0 | `5:205 6:113 7:112 8:1070` | 0.0327 |
| 42 | 0 | `5:279 6:113 7:84 8:1024` | 0.0273 |

- **Histogram-DIFFERENCE floor used in the test: TVD ≥ 0.01** — sits well below the measured minimum separation **0.0273** (seed 42), giving ~0.017 margin for the small SLICE-2 Venus perturbation (breach can add a shield core on ~1/5 seeds); the wet coordinate's Φ 0.42 < PHI_BREACH is SLICE-2-frozen, so the wet side never moves.

**AC-EFFECTIVEL(a) — computeE1-DERIVED wet tuple** (real machinery, `e1Regime.js` UNEDITED): a temperate-wet Earth-mass rocky cv (`T_eq 300, V 0.15, g 1, R 1, age 4.5, rawTidal 0`), forced onto the seeded pick via `weights {mobile:0,episodic:0,stagnant:1}` → `geodynamicRegime='stagnant'`, **raw L = 0.2280** (< MIXED_LO 0.35), **effectiveL = 0.612963** (< L_STRONG 0.63) → `classifyLidPath = 'mixed'`; the same tuple with effectiveL stripped → `'off-pilot'`. Proves the emit-then-read path, not just a hand tuple.

**Classifier reconciliation (§4 R2-R5) — measured seed-split** (in-band presets; effectiveL shown when emitted):
- `Rocky (Earthlike)`: s1 stagnant(eL 0.613)→**mixed**, s2 mobile→off-pilot, s3 episodic→off-pilot, s7 mobile→off-pilot, s42 episodic→off-pilot.
- `Ocean (temperate)`: s1 stagnant(eL 0.600)→**mixed**, s2/s3/s7 mobile→off-pilot, s42 stagnant(eL 0.600)→**mixed**.
- `Eyeball (locked temperate)`: s1 stagnant(eL 0.600)→**mixed**, s2/s3/s7 mobile→off-pilot, s42 episodic→off-pilot.
- **Seed-1 tally:** pure-weak `[Lava, Magma]`, pure-strong `[Venus]`, mixed `[Eyeball, Ocean, Rocky]` (all 3 in-band presets pick stagnant at seed 1), off-pilot 9. (Was: off-pilot 12, mixed 0.)

### AC-0 conformance (SPINE-CONFORMANCE.md) — the effectiveL channel
NEW channels in THIS slice map to named readers; no dead knobs; no archetype/label input; no taxonomy change
(`planet-archetypes.test.js` drift guards green, 21/21). `effectiveL`/`Lyield`/`mixedDiag.effectiveL` are on no
grep denylist (`.label`, `PRESET_ARCHETYPE`, `stagnantLidRegimeOf(`, `isVolcanicPath(`, `archetype`) — they are
E1-coordinate channels, not labels. The composer's exactly-3-imports invariant (`alea`/`simplex-noise`/`./mathutil.js`)
is unchanged (reading `e1.effectiveL` off the argument adds no import) → the e1-shadow-audit stays clean (22/22).

| NEW channel (Slice 1) | Where written | Named consumer(s) — the reader in the DAG |
|---|---|---|
| `effectiveL` (read) | lidResponse.js `classifyLidPath` L-cut; mixedInterior.js `Lyield` | `classifyLidPath` cuts #3-5 (routing) + composer `Ybase` (pierce yield) |
| `mixedDiag.effectiveL` | mixedInterior.js `mixedDiag` | AC-EFFECTIVEL(c) Ybase-vs-rawL assert; (SLICE 3) `mixedProbe.effectiveL` |

`breach[]` / `PHI_BREACH` / `BREACH_LO` are SLICE-2 channels — NOT present in this slice; the new test file does
not reference them. The AC-WETSTAG-BASIS histogram-DIFFERENCE is written per §SLICE-1 so it survives SLICE 2 unchanged.

### AC-ZERO-CLOBBER (threaded)
Guardrail quartet green, all trivial-pass by construction (production dispatch never reaches the mixed path):
`v2-0-byte-identity` **78/78**, `worldengine-lid-byte-anchors` **39/39**, `worldengine-e1-shadow-audit` **22/22**,
`planet-archetypes` **21/21**. Fenced files byte-clean (git-diff empty): `e1Regime.js`, `interpenetration.js`,
`magmatism.js`, `stagnantLid.js`, `plates.js`, `shellRelief.js`, `verify.js`, `planet-lod-rivers.js`,
`planet-lod-lab.html`. git-diff touches ONLY the 5 in-scope files (the not-ours `CameraChoreographer.js` /
`LabMode.js` + the untracked screenshot pile stay out).

### Test tally (Slice 1 build)
`worldengine-effectivel` 8/8 (NEW) · `worldengine-lid-classifier` 33/33 (reconciled) · `worldengine-mixed-composer`
13/13 · `worldengine-mixed-pierce` 7/7 · `worldengine-interpenetration` 6/6 · `worldengine-lid-router-audit` 9/9 ·
guardrail quartet 78+39+22+21. **All 236/236 green** across the 10-file Slice-1 set.

---

## SLICE 2 — corona-pierced compound center (breach continuum)

**Landed:** the STEP-3b **breach band** — a corona-type (non-pierce, non-ancient) center whose plume sits just
BELOW its pierce cut breaches a concentric **shield core** (PIERCE) inside its **corona annulus** (TENT), at ONE
center, while every node still resolves to exactly one `primitiveId`. Mechanism (a) from the plan §0: a Φ-gated,
strength-driven sub-pierce band on the EXISTING draws — **ZERO new alea, zero draw-order change**. Terminal-gate
AC advanced: AC-CORONA-PIERCED (+ AC-0, AC-ZERO-CLOBBER threaded). **Deviation from plan: NONE.**

### Files touched
| File | Change |
|---|---|
| `src/worldengine/base/mixedInterior.js` | `MIXED_DEFAULTS`: `PHI_BREACH: 0.45, BREACH_LO: 0.75` added to the pierce-boolean group. NEW **STEP 3b** (after the ≥1-ancient promote, before the A_e/Psi_e block): `const breach = new Uint8Array(n)`, gated `if (PHI > T.PHI_BREACH)`, `!pierce && !isAncient` only, `breach[p] = strength[p]*PHI >= T.BREACH_LO*localYield` with `localYield` RECOMPUTED from the published `yspread[p]`. **STEP 5** enrollment `if (pierce[p])` → `if (pierce[p] \|\| breach[p])` (breach centers enroll a shield core with their own `Psi_e[p]`). `mixedDiag` gains `breach` + `breachCount`. STEP 7 / STEP 9 UNTOUCHED. |
| `docs/…/corona-pierced-search.mjs` (NEW) | The §3 one-shot PIN search (grid × 64 seeds; nesting gate reconstructed arm's-length). Ran ONCE to pin; not CI. |
| `tests/worldengine-corona-pierced.test.js` (NEW) | AC-CORONA-PIERCED (a/b/c/d), pin hard-coded as constants; the shield-core→corona-annulus walk reconstructed from published `centers`/`Psi_e`/`breach`/`coronaActive`/`meanEdgeAngle` + returned `primitiveId` + `carrier.verts`. |
| `docs/…/BUILD-NOTES.md` | this section. |

### The PINNED corona-pierced coordinate + full search record (real measured numbers, N=1500)

**PIN** (largest Π margin among accepted with Π ≥ PI_STAR, per §3):

```json
{ "L": 0.58, "Φ": 0.50, "n": 9, "seed": 22,
  "PHI_BREACH": 0.45, "BREACH_LO": 0.75,
  "breachCount": 3, "legibleByFamily.pierce": 8, "legibleByFamily.tent": 1,
  "Π": 0.8535178777393311, "M": 0.35438379488546184,
  "nesting": 2, "pierceCount": 5 }
```

- `primitiveId` histogram at the pin: `shield(1):98 caldera(2):4 corona(5):139 tessera(6):114 rift(7):91 plain(8):1054`.
- **2 active-corona breach centers nest legibly** (`nesting=2`): center **p=1** `core{shield:5,caldera:1}` /
  `annulus{corona:56}` and center **p=7** `core{shield:7,caldera:1}` / `annulus{corona:51}` — a shield core inside
  a pure corona annulus, node-legible at N=1500. (A 3rd breach center p=5 is inactive-corona, not counted by the gate.)
- `meanEdgeAngle=0.1002`, `Rc = CORONA_RC_NODES·meanEdgeAngle = 0.2504`, active corona footprint `1.6·Rc = 0.4006` rad.

**Search extent** (`corona-pierced-search.mjs`, 14.0 s): grid `L ∈ {0.58,0.59,0.60,0.61,0.62}` (step 0.01, all
< L_STRONG 0.63 and ≤ slider cap 0.629) × `Φ ∈ {0.50,0.52,…,0.68}` (step 0.02) × `n ∈ {7,8,9}` × `seed ∈ 1..64`
= **9600 builds**; **2201** had `breachCount ≥ 2`; **857** passed ALL gates (`breachCount≥2 ∧ legibleByFamily.pierce≥2
∧ Π>0 ∧ M≤0.70 ∧ ≥2 active-corona breach centers nesting`); **all 857** cleared `Π ≥ PI_STAR (0.15)`. The accepted
region is broad — corona-pierced worlds are the RULE across the mixed band, not a knife-edge. **Fallbacks used: NONE.**

**Controls re-confirmed clean** (structurally guaranteed — `PHI ≤ 0.42 < PHI_BREACH ⇒ breach ≡ 0` — and MEASURED):
`breachCount((L0.60,Φ0.42), seed 2) === 0` AND `breachCount(Tharsis {L0.551,Φ0.27,n6}, seed 22) === 0`. `controlsClean: true`.

**Structural note for a future retune (why the Π-max pin is degenerate):** the Π instrument projects `primitiveId`
through `familyOf` to a BINARY pierce/tent class, and **both corona (5) and plains (8) are TENT** — so Π is *blind*
to corona-vs-plains and only "sees" the shield cores. Consequently the max Π (0.85352) is shared by MANY (L,Φ,n=9,
seed 22) coordinates that differ only in how many shield-bearing centers breach vs pierce (A_e/Psi_e depend on
`strength[p]` alone, identically for pierce and breach, so a pierce↔breach flip leaves the pierce-figure metrics
unchanged). **The SHOULD-5 nesting gate — not Π — is what actually enforces the corona-in-shield structure**; Π-max
is only the §3 tie-break that guarantees the SLICE-3 ADDITIONAL `Π ≥ PI_STAR` observation passes with margin. The
pin was verified to nest cleanly (p=1, p=7 above) before selection.

### AC-0 conformance (SPINE-CONFORMANCE.md) — the breach channel
New channels map to named readers; no dead knobs; no archetype/label input; no taxonomy change. `breach` /
`breachCount` / `PHI_BREACH` / `BREACH_LO` are on no grep denylist (`.label`, `PRESET_ARCHETYPE`,
`stagnantLidRegimeOf(`, `isVolcanicPath(`, `archetype`) — they are E1-coordinate / composer channels, not labels.
Composer keeps its exactly-3-imports invariant (`alea`/`simplex-noise`/`./mathutil.js`) — STEP 3b adds no import →
e1-shadow-audit stays clean (22/22), `planet-archetypes` drift guards green (21/21).

| NEW channel (Slice 2) | Where written | Named consumer(s) — the reader in the DAG |
|---|---|---|
| `breach[]` | mixedInterior.js STEP 3b | STEP 5 pierceR enrollment (`pierce[p] \|\| breach[p]` → shield-core resolve at STEP 9) → AC-CORONA-PIERCED node walk; (SLICE 3) `interpenetration.legibleByFamily.pierce` |
| `mixedDiag.breach` / `mixedDiag.breachCount` | mixedInterior.js `mixedDiag` | AC-CORONA-PIERCED nesting reconstruction + Tharsis/cross-check controls; (SLICE 3) `mixedProbe.coronaPiercedCount` |
| `PHI_BREACH` / `BREACH_LO` | `MIXED_DEFAULTS` | STEP 3b breach decision (UAT-tunable, gate-2 Y0/Y_K precedent; `PHI_BREACH` strictly > 0.42, the cross-check Φ) |

### AC-ZERO-CLOBBER (threaded)
Guardrail quartet green, all trivial-pass by construction: `v2-0-byte-identity` **78/78**,
`worldengine-lid-byte-anchors` **39/39**, `worldengine-e1-shadow-audit` **22/22**, `planet-archetypes` **21/21**.
Fenced files byte-clean (git-diff empty): `lidResponse.js` (Slice 1, frozen), `e1Regime.js`, `interpenetration.js`,
`magmatism.js`, `stagnantLid.js`, `plates.js`, `shellRelief.js`, `verify.js`, `planet-lod-rivers.js`,
`planet-lod-lab.html`. git-diff touches ONLY `mixedInterior.js` (+2 new in-scope files); the not-ours
`CameraChoreographer.js` / `LabMode.js` + the untracked screenshot pile stay out.

Byte-inertness is asserted at TWO Φ ≤ 0.42 coords (`breachCount === 0`): the (L0.60,Φ0.42) cross-check and Tharsis.
At the two Φ > 0.45 pinned coords in `worldengine-mixed-pierce.test.js` (Venus Φ0.69, Φ-sweep 0.55) breach CAN fire,
but those tests observe only the breach-INERT `pierce[]`/`pierceCount`/`Ybase` → GREEN unchanged (7/7). The Venus Φ0.69
histogram-DIFFERENCE in `worldengine-effectivel.test.js` (TVD ≥ 0.01 vs a measured min separation 0.0273) survives the
small Venus-side breach perturbation → GREEN unchanged (8/8), as the SLICE-1 [ADV-FIXED] anticipated.

### Test tally (Slice 2 build)
`worldengine-corona-pierced` **6/6 (NEW)** · must-stay-green set UNCHANGED: `worldengine-effectivel` 8/8 ·
`worldengine-lid-classifier` 33/33 · `worldengine-mixed-composer` 13/13 · `worldengine-mixed-pierce` 7/7 ·
`worldengine-interpenetration` 6/6 · `worldengine-lid-router-audit` 9/9 · guardrail quartet 78+39+22+21.
**All 242/242 green** across the 11-file Slice-2 set.

---

## SLICE 3 — Π falsification assertion + null + cross-check + lab drive/probe

**Landed:** the FALSIFICATION ASSERTION on the corona-pierced **WORLD B** — the Π=C·F instrument (consumed
UNCHANGED, by injection) fires `Π > 0 ∧ M ≤ M_MAX ∧ legibleByFamily.pierce ≥ 2`, so shield cores and corona
annuli INTERPENETRATE (the claim 2b-2a fenced OUT); the separable-tiling NULL (Π→0); the (L0.60,Φ0.42) seed-2
CROSS-CHECK reproducing its 2b-2a Π exactly; and the lab drive/probe wiring for AC-PILOT-LIVE. `interpenetration.js`
is UNTOUCHED (injected). Terminal-gate ACs advanced: AC-INTERPEN-FALSIFY (asserted) + AC-PILOT-LIVE prep (lab seam)
(+ AC-0, AC-ZERO-CLOBBER threaded). **Deviation from plan: NONE.**

### Files touched
| File | Change |
|---|---|
| `planet-lod-lab.html` | (i) `mixedOv` gains `effectiveL: null` — a DRIVER OVERRIDE (NO `*Enabled` key). (ii) `applyMixedDrivers` absorbs `coords.effectiveL` (`'effectiveL' in coords` ⇒ set; `null` clears) and, when set, builds the `_mixedLidOverride.e1` override with `geodynamicRegime:'stagnant'` + an `e1.effectiveL` member (so classifyLidPath routes 'mixed' and the composer Ybase yields on the strong-but-piercable edge) — the object is built OUTSIDE any `route({...})` block, only the `_mixedLidOverride` identifier rides in (SF1 e1-shadow-audit clean, verified 22/22). (iii) `mixedProbe` gains SCALARS `coronaPiercedCount: md.breachCount ?? 0` + `effectiveL: md.effectiveL` (null-guarded to the file's style). NO new slider/control. |
| `tests/worldengine-interpen-falsify.test.js` (NEW) | AC-INTERPEN-FALSIFY: instrument-integrity (imported single-source), WORLD-B AC gate (MF4 first), WORLD-B ADDITIONAL `Π ≥ PI_STAR`, cross-check, NULL. `PI_STAR`/`M_MAX`/`interpenetration`/`familyOf`/`PRIMITIVE_ID` all IMPORTED (0.15/0.70 never re-declared). |
| `docs/…/BUILD-NOTES.md` | this section. |

### Measured numbers (headless, N=1500; instrument INJECTED via `writeMixedInteriorSphere(..., { interpen })`)

**WORLD B — the pinned corona-pierced coordinate `{L 0.58, Φ 0.50, n 9}` seed 22:**

| observable | value | AC clause |
|---|---|---|
| `legibleByFamily.pierce` | **8** | ≥ 2 (MF4 precondition — asserted FIRST) ✓ |
| `Π` (full precision) | **0.8535178777393311** | **> 0** (THE AC gate) ✓ |
| `M` (full precision) | **0.35438379488546184** | **≤ M_MAX (0.70)** (THE AC gate) ✓ |
| `Π ≥ PI_STAR (0.15)` | 0.8535 ≥ 0.15 | ADDITIONAL (non-AC) observation ✓ |
| `breachCount` / `pierceCount` / `legibleByFamily.tent` | 3 / 5 / 1 | (context; matches SLICE-2 pin) |

- **The AC gate = the contract observable VERBATIM: `Π > 0 ∧ M ≤ 0.70 ∧ legibleByFamily.pierce ≥ 2`** — NOT
  `Π > PI_STAR` (PI_STAR=0.15 ≠ 0; tightening the bar would be a scope change for Max). The `Π ≥ PI_STAR` leg is a
  SEPARATE, clearly-labelled ADDITIONAL check, guaranteed by SLICE-2 §3 pin-selection (largest Π ≥ PI_STAR margin).

**CROSS-CHECK — `(L 0.60, Φ 0.42)` seed 2 (breach-free: Φ 0.42 < PHI_BREACH 0.45):**
- `breachCount` = **0** ✓ (⇒ primitiveId field byte-identical to 2b-2a ⇒ Π reproduces exactly).
- `Π` FULL PRECISION = **0.6621875839828004** — **EXACT match** to the plan's measured `0.6621875839828004`
  (HEAD `ecad42d`); `toBeCloseTo(0.66, 2)` holds (|0.6622 − 0.66| = 0.0022 < 0.005). `M` = 0.29069621090385217,
  `legibleByFamily.pierce` = 3. The stale scope-time "0.63" (the mis-attributed Tharsis {0.551,0.27} value) is NOT used.

**NULL — hand-tiled separable carrier (shield polar cap `z > 0.8` vs stagnant-basaltic-plain, `interpenetration()` called DIRECTLY):**
- `nShield` = **152** (a genuine MINORITY polar cap, 152 < 750), one segregated blob.
- `Π` = **0** (< PI_STAR 0.15 — F→0 for a single legible component: TILED, not interpenetrated) ✓; `M` = **0.09889660131985027**
  (well ≤ M_MAX — a segregated cap, not scatter). `isTiled = Π < PI_STAR ∨ M > M_MAX` = **true** ✓.

### Lab edit summary (AC-PILOT-LIVE seam)
The wet-stagnant world drives via the new effectiveL override path (`_lab.setMixedDrivers({ effectiveL: 0.60, 'Φ': 0.42, n: 6, macroSeed: … })`
→ `geodynamicRegime:'stagnant'` + `e1.effectiveL` → 'mixed' route + effectiveL-yield); the corona-pierced world
drives via the EXISTING L/Φ/n sliders (L 0.58 ≤ cap 0.629, Φ 0.50 ≤ cap 1.2, n 9) with effectiveL OFF (dead-lid).
`mixedProbe()` now reports `coronaPiercedCount` (= breach-center count) and `effectiveL` (the L the composer yielded
on) as SCALARS, so the orchestrator can read ≥2 corona-pierced centers + the wet-yield L off the live probe. No new
GUI control; `mixedOv.effectiveL` is a driver override (no `*Enabled` key). AC-PILOT-LIVE is driven live by the
orchestrator post-build; AC-PILOT-UAT is Max's gate (deferred-to-max, never agent-PASSed).

### AC-0 conformance (SPINE-CONFORMANCE.md) — COMPLETED whole-increment table (plan §5)
Every NEW channel across all three slices maps to a named reader (no dead knobs); NO archetype/label input; the new
lab knob is a DRIVER OVERRIDE (no `*Enabled` key). **Grep-denylist statement:** `effectiveL` / `breach` / `breachCount`
/ `PHI_BREACH` / `BREACH_LO` / `coronaPiercedCount` / `mixedOv.effectiveL` are E1-coordinate / composer / lab-probe
channels — NONE appears on the denylist (`.label`, `PRESET_ARCHETYPE`, `stagnantLidRegimeOf(`, `isVolcanicPath(`,
`archetype`); they are not labels. The composer keeps its exactly-3-imports invariant (`alea`/`simplex-noise`/`./mathutil.js`)
→ `worldengine-e1-shadow-audit` stays clean (22/22); `mixedOv.effectiveL` adds no taxonomy key → `planet-archetypes`
drift guards green (21/21).

| NEW channel | Where written | Named consumer(s) — the reader in the DAG |
|---|---|---|
| `effectiveL` (read) | lidResponse.js `classifyLidPath` L-cut; mixedInterior.js `Lyield` | `classifyLidPath` cuts #3-5 (routing) + composer `Ybase` (pierce yield) — SLICE 1 |
| `mixedDiag.effectiveL` | mixedInterior.js `mixedDiag` | AC-EFFECTIVEL(c) Ybase-vs-rawL assert; **`mixedProbe.effectiveL` (SLICE 3)** |
| `breach[]` / `breachCount` | mixedInterior.js STEP 3b + `mixedDiag` | STEP 5 pierceR enrollment (shield-core resolve) → AC-CORONA-PIERCED; **`interpenetration.legibleByFamily.pierce` → Π (SLICE 3 AC-INTERPEN-FALSIFY)**; **`mixedProbe.coronaPiercedCount` (SLICE 3)** |
| `PHI_BREACH` / `BREACH_LO` | `MIXED_DEFAULTS` | STEP 3b breach decision (UAT-tunable, gate-2 Y0/Y_K precedent; `PHI_BREACH` strictly > 0.42) — SLICE 2 |
| `mixedOv.effectiveL` (lab driver override) | planet-lod-lab.html `applyMixedDrivers` | `_mixedLidOverride.e1.effectiveL` + `geodynamicRegime:'stagnant'` → classifyLidPath route + composer Ybase (wet-stagnant live drive) — SLICE 3 |
| `mixedProbe.coronaPiercedCount` / `mixedProbe.effectiveL` (lab probe scalars) | planet-lod-lab.html `mixedProbe` | AC-PILOT-LIVE readout (≥2 corona-pierced centers; yielded L) — SLICE 3 |

### AC-ZERO-CLOBBER (threaded)
Guardrail quartet green, all trivial-pass by construction: `v2-0-byte-identity` **78/78**,
`worldengine-lid-byte-anchors` **39/39**, `worldengine-e1-shadow-audit` **22/22** (the lab `applyMixedDrivers` +
`mixedProbe` edits are OUTSIDE the `riverOverlay.route({...})` block → the `\be1\b`-in-route grep stays clean),
`planet-archetypes` **21/21**. Fenced files byte-clean (git-diff empty, MANUALLY verified — AC-ZERO-CLOBBER(d)):
`mixedInterior.js`, `lidResponse.js`, `e1Regime.js`, **`interpenetration.js`**, `magmatism.js`, `stagnantLid.js`,
`plates.js`, `shellRelief.js`, `verify.js`, `planet-lod-rivers.js`. git-diff touches ONLY `planet-lod-lab.html`
(+ the new test + this doc); the not-ours `CameraChoreographer.js` / `LabMode.js` + the untracked screenshot pile stay out.

### Test tally (Slice 3 build)
`worldengine-interpen-falsify` **5/5 (NEW)** · must-stay-green set UNCHANGED: `worldengine-effectivel` 8/8 ·
`worldengine-lid-classifier` 33/33 · `worldengine-corona-pierced` 6/6 · `worldengine-mixed-composer` 13/13 ·
`worldengine-mixed-pierce` 7/7 · `worldengine-interpenetration` 6/6 · `worldengine-lid-router-audit` 9/9 ·
guardrail quartet 78+39+22+21. **247/247 green** across the 12-file Slice-3 set.

**FULL suite (`npx vitest run`, run ONCE):** `Test Files 17 failed | 114 passed (131)` · `Tests 4 failed | 1827 passed (1831)`.
The **4 failed TESTS are EXACTLY the 4 pre-existing known ones** (no growth):
`src/generation/__tests__/GalacticFeatures.test.js > Galactic Feature Layer > feature types match their galactic context`;
`src/generation/__tests__/KnownObjects.test.js > KnownObjectProfiles > has all five test profiles`;
`… > searchKnownObjects > is case-insensitive`; `… > searchKnownObjects > partial match works`.
The 17 failed *files* = those 2 assertion-failing files + **15 pre-existing `vendor/motion-test-kit/tests/*.test.js`
suite-collection failures** (`Error: No test suite found in file …` — they are written for node's built-in test
runner and contribute **0 counted tests**; caught by vitest's `*.test.js` glob, independent of this increment's
3-file scope). Counted-test failures did NOT grow beyond the 4 known.

## SLICE 2 amendment — cross-resolution nesting fix (found at the live pilot, 2026-07-08)

**Defect (live, lab mesh ~40k nodes):** the corona-pierced world's primitiveId histogram had ZERO corona
nodes — every breach core swallowed its annulus. Measured live: meanEdgeAngle 0.01938 → Rc 0.0484,
active support 0.0775 rad; breach cores' Psi_e 0.1288/0.1327/0.1442 rad → all three "core SWALLOWS
annulus". Root cause: Rc is node-scaled (CORONA_RC_NODES × meanEdgeAngle, by 2b-2a design) while Psi_e is
absolute — the scales cross between N=1500 (where every headless test + the search nesting gate passed)
and the lab mesh. The SHOULD-5 nesting gate guarded exactly this failure mode but was only ever evaluated
at N=1500.

**Fix (deterministic, zero new alea, breached centers only):** STEP 7 per-center corona radius
`RcP = breach[p] ? max(Rc, BREACH_ANNULUS_SCALE·Psi_e[p]) : Rc`, new UAT-tunable
`BREACH_ANNULUS_SCALE = 1.4`. At N=1500 the node term dominates (pin numbers bit-identical — search re-run
reproduces {L 0.58, Φ 0.50, n 9, seed 22, Π 0.8535178777393311, M 0.35438..., breachCount 3, nesting 2});
on the lab mesh the absolute term (~0.18–0.20 rad) puts the annulus outside the core. Pure (non-breached)
corona centers keep the shipped node-scaled Rc — 2b-2a morphology untouched. Test helper
(coronaFootprint) + search nestingCount updated to the same per-center formula (numerically identical at
N=1500). All guarded coordinates (Φ ≤ 0.42: cross-check, wet-stagnant, Tharsis) unaffected — breach≡0
there. Post-fix: 12 files / 247 tests green incl. the quartet.
