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
