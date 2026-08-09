# Step 4 item 4 — the committed delta table: the no-surface domain guard

> **Generated artifact — do not hand-edit.** Regenerate with `node tools/port-condition-delta.mjs --step4`.
> Gate for item 4 of Step 4 in `docs/FEATURES/one-pipeline-two-frontends-PLAN.md`.
> This is a **declared pixel-moving step** (§11.3.6): the named movers *must* move, and a table
> of zeros here is a failure, not a pass.

**Tree at generation:** `f66821d` · **generated:** 2026-08-09 · **law this tree implements, read off the live material:** `NEW`

## ⛔ What this table is NOT evidence of (ledger C20)

Every number below is measured **through the game material** — the five uniforms
`src/objects/Planet.js` writes today, with the limb term fully on — src/objects/Planet.js:1401
`const LIMB_MIX = 1.0;`. **Step 6 swaps most of this population onto a material whose limb
term is gated by a different uniform name.** This is the right gate for Step 4 and it is *not* a
durable statement about what a player sees afterwards. Quote it as evidence about Step 4 only.

It is also a statement about **uniform values, not pixels**. A moved uniform may be invisible.

## What is being differenced

| rule | `condition.T_eq` for a `compositionClass === 'gas'` body | every other body |
|---|---|---|
| **OLD** | `surfaceTemperatureOf(rec.T_eq, atmosphere.pressure)` — the grey-greenhouse fit, solved on Earth (1 bar) and Venus (92 bar), evaluated at the generator's 1000 bar envelope depth | same |
| **NEW** | `rec.T_eq` — the fit is not applied, because there is no surface for a surface pressure to be measured at | **identical to OLD, by construction** |

Both are computed **by this tool** from the shipped `surfaceTemperatureOf` and the shipped
`atmosphereOpticsOf`, never by reading what the tree happens to do, so the table reproduces
before and after the guard lands. Only `T_eq` is substituted; the rest of the condition is the
real `conditionFromPlanet(rec)` output.

## Population — fully specified

⚠ §2's own history is that an under-specified population produced headline numbers that did not
reproduce. Every body below is a pure function of an integer seed and the recipe is stated in
full, so a disagreeing measurement can be attributed rather than argued about.

| stratum | recipe | bodies | of which `compositionClass === 'gas'` |
|---|---|---:|---:|
| `S` | every planet of `StarSystemGenerator.generate(seed)`, seed = 1..200 | 800 | 331 |
| `P` | every **planet-class** moon (`m.isPlanetMoon && m.planetData`) found over seeds 1..1000 | 64 | 8 |
| `G` | forced-type grid: `PlanetGenerator.generate(new SeededRandom(20260808 + cell*7919), au, null, null, type)` over all 18 `PlanetGenerator.TYPES` × 5 orbits (0.35, 0.9, 2, 6, 18 AU) | 90 | 40 |
| **total generated** | | **954** | **379** |
| `SOL` | `generateSolarSystem()` planets + planet-class moons — **reported separately, never pooled** | 14 | 2 |

**Exclusions, stated rather than left to inference:**

- Bodies whose generation threw: excluded by `buildGeneratedPopulation`'s final `filter(b => b.rec)`. On this run the three strata yielded 954 records and 954 of them derived a condition without throwing (**0 excluded**).
- **Non-planet-class moons are excluded**, and that is a scope statement, not a convenience:
  `MoonGenerator` emits ~none of the condition fields the world engine reads, and
  `tryLabShader` structurally excludes moons from this render path. They enter at Step 8.
- **Nothing is excluded on the basis of its measured delta.** The gas / non-gas split below is
  made by `compositionClass`, i.e. by the same predicate the guard itself keys on — which is
  what makes the non-gas rows a control rather than a leftover.
- **Sol is a separate labelled population and is never pooled into the headline.** It is measured because a delta between two evaluations of a pure function of a data record is a fact about the function. ⛔ No Sol pixel was inspected; Sol renders from NASA textures through a different renderer and nothing here may be quoted as a rendering claim.

**Reproduction:** the whole generated population was rebuilt from the same integer seeds and all five uniforms re-measured **per body** (not per headline): **954 / 954 bodies identical under both laws — PASS**.

## The greenhouse factor this guard removes

Over the **379** generated gas-class bodies, `surfaceTemperatureOf(rec.T_eq, pressure) / rec.T_eq`:

| | min | median | p95 | max |
|---|---:|---:|---:|---:|
| greenhouse factor | 1.75795× | **2.68749×** | 6.20738× | **6.20738×** |

## GENERATED, gas-class — the delta table

|Δ| = |NEW − OLD| per body. Colour rows are the **max absolute channel delta**. No epsilon
anywhere: `moved` counts bodies whose delta is not exactly 0.

| uniform | moved / n | min |Δ| | median |Δ| | p95 |Δ| | max |Δ| |
|---|---:|---:|---:|---:|---:|
| `uLimbExponent` | 334 / 379 | 0 | 0.877924 | 1.60702 | 1.7 |
| `uLimbColor` | 353 / 379 | 0 | 0.091616 | 0.471121 | 0.743874 |
| `uTermColor` | 353 / 379 | 0 | 0.0853134 | 0.55974 | 0.729446 |
| `uTermStrength` | 0 / 379 | 0 | 0 | 0 | 0 |
| `uTermWidth` | 0 / 379 | 0 | 0 | 0 | 0 |

`uLimbExponent`'s entire law range is **1.8 – 3.5** (`atmosphereOptics.js:161` `limbExponent: 3.5 - 1.7 * thick,`), i.e. a span of 1.7 — so read its max |Δ| of 1.7 against that span, not against zero.

### The gas bodies that did NOT move — accounted for, not rounded off

**26 of 379** gas bodies move none of the five uniforms. A row of "moved" counts with no
account of the residue is how a partial mechanism gets read as a total one, so:

- **0** carry `atmosphere.pressure == 0`. The greenhouse factor is exactly 1 there by
  construction (`P = 0 ⇒ tau = 0`), so OLD and NEW are the *same number* and the guard has nothing
  to remove. These are not bodies the guard failed on; they are bodies it was already correct on.
- **26** carry a non-zero pressure and still do not move — and **26 of those 26** have
  `primordialFractionOf(cond) == 0`.

⚠⚠ **THAT IS A SECOND DISAGREEMENT, NOT A ROUNDING — and it is worth more than the row it sits in.**
`compositionClass` calls a body `'gas'` on ONE test: `atmosphere.composition === 'h2-he'`, a
label the generator wrote. `primordialFractionOf` asks a physical question instead — the Jeans
escape parameter λ_H2 = m·v_esc²/(2kT_exo) against `LAMBDA_H2_LO`/`LAMBDA_H2_HI` — and answers
**"this body cannot hold hydrogen"** for 26 of the 379 bodies the label calls a hydrogen envelope.
With `prim == 0` the deck ramp is mixed in at weight zero, `thickHaze` collapses, and the optics
stop reading `T_eq` at all — which is why the guard is invisible on exactly these bodies.

**Two engine functions disagree about which bodies have a hydrogen envelope.** That is this
codebase's "one quantity, two answers" shape, and it is *out of scope for item 4*: the guard is
correct to key on `compositionClass`, because that is the predicate the vector itself classifies
on at body-condition-vector.js:107 `const _class = compositionClass(`, and a second opinion at
this seam would be the defect, not the fix.
It is recorded here so the next step that reads either function inherits a named
finding rather than rediscovering it against the wrong commit.

Separately, **19** gas bodies move a `uLimbColor` channel while `uLimbExponent` stays put — the
exponent is a function of `thickHaze`, which saturates at 1.0 on a deep envelope, so both
temperatures can land on the same clamped exponent while the hue ramp underneath still moves.
That is why the two "moved" counts differ, and why quoting only the exponent count would
understate the change.

### ⚠ The affected set is NOT the game's `gas-giant` types — it crosses them

A reviewer reading a failing byte-identity fence will see bodies labelled `rocky`, `crystal` and
`ice` in the moved list and reasonably suspect a leak. It is not one, and the check is mechanical:
**every** body the guard touches carries `atmosphere.composition === 'h2-he'`, because that is the
one test `compositionClass` applies. The game `type` label is not consulted anywhere on this path —
which is the adapter's stated doctrine, not an accident of it.

- gas-class bodies whose `atmosphere.composition` is **not** `'h2-he'`: **0**
- `'h2-he'` bodies that are **not** gas-class: **0**
- so the affected set and the `'h2-he'` set are **the same set, exactly**.

Game `type` labels inside the affected set, which is the part that looks wrong and is not:

| game `type` | gas-class | total in population |
|---|---:|---:|
| `sub-neptune` | 174 | 174 |
| `ice` | 60 | 151 |
| `gas-giant` | 48 | 48 |
| `rocky` | 33 | 184 |
| `carbon` | 31 | 118 |
| `hot-jupiter` | 10 | 10 |
| `ocean` | 4 | 25 |
| `terrestrial` | 3 | 13 |
| `lava` | 2 | 60 |
| `eyeball` | 2 | 10 |
| `shattered` | 2 | 5 |
| `fungal` | 2 | 5 |
| `machine` | 2 | 5 |
| `city-lights` | 2 | 5 |
| `ecumenopolis` | 2 | 5 |
| `crystal` | 1 | 10 |
| `hex` | 1 | 5 |

## GENERATED, non-gas — the control

The guard is supposed to be **exactly inert** outside the gas class.

| uniform | moved / n | min |Δ| | median |Δ| | p95 |Δ| | max |Δ| |
|---|---:|---:|---:|---:|---:|
| `uLimbExponent` | 0 / 575 | 0 | 0 | 0 | 0 |
| `uLimbColor` | 0 / 575 | 0 | 0 | 0 | 0 |
| `uTermColor` | 0 / 575 | 0 | 0 | 0 | 0 |
| `uTermStrength` | 0 / 575 | 0 | 0 | 0 | 0 |
| `uTermWidth` | 0 / 575 | 0 | 0 | 0 | 0 |

⛔ **A column of zeros here proves nothing on its own** — it is what a comparator that is not wired also prints. So the SAME comparator, on the SAME 575 non-gas bodies, was handed a moved `T_eq`:

| probe | what it changes | non-gas bodies it moved |
|---|---|---:|
| near | `T_eq` → `T_eq + 40` K | **74 / 575** |
| wide | `T_eq` = 100 K vs 1500 K — spans every anchor in both hue ramps | **290 / 575** |

**The comparator is wired.** The zeros in the table above are therefore a fact about the guard, not about the instrument.

⚠ **And the fraction is not 100%, which is a fact about the optics law and is stated rather than
quietly dropped.** `T` reaches these five uniforms through exactly two doors: `hazeFractionOf`,
and `primordialFractionOf` — whose Jeans λ carries `T_exo = 3.5·T_eq` in its denominator, so it
is temperature-dependent on a **solid** body too. Both doors are evaluated at both probe
temperatures and counted:

| non-gas subset | n | moved under the wide probe |
|---|---:|---:|
| at least one door open at some probe temperature | 290 | **290** |
| both doors shut at both ends (`haze == 0` and `prim == 0`) | 285 | 0 |

Of the 285 bodies with both doors shut, **285** did indeed not move — 100.0% agreement between the
mechanism and the observation. That agreement is why the shortfall is attributed to the law
rather than offered as an excuse for it.

⚠ **The first version of this decomposition was WRONG and is recorded rather than replaced.** It
predicted temperature-blindness from the haze gates alone (`volatileFraction > HAZE_VOL_LO` or
`pressure > HAZE_P_THICK`) and called **425** of these bodies blind against **285** observed — it
had missed that `primordialFractionOf` reads temperature. A predicate that over-predicts the
blind set by 140 bodies is exactly how a real shortfall gets explained away, so the model was
replaced by the measurement above rather than tuned.

## ACYCLICITY — why classifying first and setting `T_eq` second is well-defined

The guard runs `compositionClass` **before** it decides `T_eq`, because its answer is one of
the fp's own fields. That ordering is sound only while the composition gate does not itself read
temperature — and that is a property of a function in another file. So it is checked, not assumed:
every body is classified at **100 K and at 1500 K** and the two answers must agree.

**954 / 954** bodies classified identically at both temperatures. The gate is temperature-independent, so the ordering is acyclic and the guard is a single pass.

## MATERIAL CROSS-CHECK — the control that makes the rest admissible

Three of the five uniforms come out of the shipped `atmosphereOpticsOf`, but `uTermStrength`
and `uTermWidth` are finished by expressions that live in `src/objects/Planet.js` and are not
exported, so this tool transcribes them. A transcription is exactly the kind of thing that is
true when written and misleading later. So it is not trusted: every body is built as a real
`new Planet(rec)` and the five recomputed values are compared against
`planet.surface.material.uniforms`, exactly, with no tolerance.

| | count |
|---|---:|
| bodies built as a real `Planet` | 954 |
| construction failed | 0 |
| live material matched **neither** law (⇒ the transcription has drifted) | **0** |
| bodies where OLD and NEW **differ at all** (the discriminating set) | 353 |
| …of those, live material == **NEW** | 353 |
| …of those, live material == **OLD** | 0 |
| …of those, live material == neither | 0 |

**Verdict: this tree implements `NEW`.** That is read off the shipped material, not off the
source text — which is what lets `node tools/port-condition-delta.mjs --step4 --check` go red the
moment the guard is reverted, and is the executed control §11.3.3 asks for.

## ⚠ UNDECLARED MOVERS — what else the guard moves, measured because Instrument C will show it

Step 4's gate names five uniforms. `condition.T_eq` is not read only by `atmosphereOpticsOf`:
it also reaches the `WORLDENGINE_BAKES` that `PlanetGenerator.generate` writes onto the record,
and the biosphere pair, all of which become shipped uniforms of their own. Those are **watched by
Instrument C**, so they appear in its diff whether or not this table names them. A delta table
that publishes five movers while the instrument publishes thirteen is exactly the true-and-
misleading shape this program keeps catching, so they are named here.

Same gas-class population, same |Δ| rule. The middle column is the join key against Instrument
C's output (`npm run port-uniform-delta:check`), so the two can be read against each other
instead of being taken on trust:

| quantity | shipped uniform it becomes | moved / n | median |Δ| | max |Δ| |
|---|---|---:|---:|---:|
| `T_eq` | — | 379 / 379 | 241.071 | 2240.91 |
| `landPalette.fresh` | `uFreshColor` | 261 / 379 | 0.00310957 | 0.320567 |
| `landPalette.weathered` | `uWeatheredColor` | 261 / 379 | 0.014494 | 0.384215 |
| `landPalette.craton` | `(not a shipped uniform)` | 291 / 379 | 0.0334463 | 0.61476 |
| `landPalette.sediment` | `uSedColor` | 261 / 379 | 0.00796173 | 0.434833 |
| `iceness` | `uIcenessMix` | 137 / 379 | 0 | 1 |
| `lavaGlowColor` | `uLavaGlow` | 4 / 379 | 0 | 0.245876 |
| `lavaCrustColor` | `uLavaCrust` | 4 / 379 | 0 | 0.226259 |
| `biosphere` | `uBioGroundCover` | 60 / 379 | 0 | 1 |
| `landPalette.pigment` | `uBioGroundColor` | 261 / 379 | 0.00242522 | 0.180729 |

Quantities that read exactly 0 on all 379 gas bodies (12): `rawTidalIoRatio`, `surfaceGravity`, `crater.density`, `crater.scale`, `crater.amp`, `crater.complexD`, `crater.relaxation`, `crater.terraceCount`, `crater.ejectaStrength`, `crater.ejectaRampart`, `crater.ejectaAmp`, `crater.ejectaLump`

**8 shipped uniforms beyond the declared five** therefore move under this guard:
`uFreshColor`, `uWeatheredColor`, `uSedColor`, `uIcenessMix`, `uLavaGlow`, `uLavaCrust`, `uBioGroundCover`, `uBioGroundColor`.
`landPalette.craton` is measured and moves too, but it is not written to any uniform, so it is
listed above and excluded from that count.

⚠ **The counts here and Instrument C's will not match body-for-body, and should not be expected
to.** Instrument C runs its own 526-body population; this table runs the one declared above. The
claim they jointly support is *which* uniforms move and by roughly what magnitude — not a shared
per-body count. Two things do corroborate exactly, across two independently written harnesses:
`uLimbExponent`'s maximum |Δ| of 1.7 (the law's entire 1.8–3.5 span), and `uTermStrength` /
`uTermWidth` reading **zero on both**.

## SOL — second population, clearly labelled

⛔ **Pure-function arithmetic on data records, and nothing else.** No Sol pixel was inspected.
Sol renders from NASA photographic textures through a different renderer and its bodies carry no
world-engine condition fields, so it cannot validate procgen or rendering. It is measured here
because the plan names two Sol bodies as members of the affected population, and because a delta
between two evaluations of a pure function of a record is a fact about the function.

Sol bodies: **14**, of which **2** are `compositionClass === 'gas'`.

### ⛔⛔ READ THIS BEFORE READING THE SOL NUMBERS: Sol has no `T_eq` at all

`rec.T_eq` is **absent on 14 / 14** Sol bodies — against **0 / 954** generated ones. `SolarSystemData.js`
does not author an equilibrium temperature, so `d.T_eq ?? 288` fires and every Sol body enters this
table at **288 K**, which `conditionFromPlanet`'s own `_provenance.T_eq` correctly reports as
`'defaulted'`. **The Sol rows below are therefore arithmetic about the number 288, not about
Uranus.** They are published because the plan names Uranus and Neptune as members of the affected
population and that claim deserves a checked answer — and the checked answer is that the guard
does move their uniforms, on a temperature the game invented for them. ⛔ Do not quote a Sol
magnitude as a physical result, and do not let the two identical rows below read as agreement
between two independent bodies: they are identical *because* both bodies are the same 288 K.

| uniform | moved / n | min |Δ| | median |Δ| | p95 |Δ| | max |Δ| |
|---|---:|---:|---:|---:|---:|
| `uLimbExponent` | 2 / 2 | 1.7 | 1.7 | 1.7 | 1.7 |
| `uLimbColor` | 2 / 2 | 0.5 | 0.5 | 0.5 | 0.5 |
| `uTermColor` | 2 / 2 | 0.17 | 0.17 | 0.17 | 0.17 |
| `uTermStrength` | 0 / 2 | 0 | 0 | 0 | 0 |
| `uTermWidth` | 0 / 2 | 0 | 0 | 0 | 0 |

| named body | identified by | gas-class | `rec.T_eq` | OLD `T_eq` | NEW `T_eq` | Δ`uLimbExponent` | max Δ channel `uLimbColor` |
|---|---|---|---:|---:|---:|---:|---:|
| Uranus | orbit 19.19 AU + R 4.01 R⊕ | yes | **absent ⇒ 288** | 1787.73 | 288 | 1.7 | 0.5 |
| Neptune | orbit 30.07 AU + R 3.88 R⊕ | yes | **absent ⇒ 288** | 1787.73 | 288 | 1.7 | 0.5 |

⚠ **Jupiter and Saturn are NOT in the affected population, and that is a finding rather than an
omission.** Both are authored as `type: 'gas-giant'` with **no atmosphere block at all**, so
`compositionClass` never sees an `h2-he` composition and does not return `'gas'` for them. The
guard is inert on the two largest bodies in Sol. Uranus and Neptune are affected only because
they are authored as `sub-neptune` **with** a 1000-bar `h2-he` block. The plan names exactly
those two, and this run agrees with it.

---

_Regenerate: `node tools/port-condition-delta.mjs --step4`. Gate: `--step4 --check`._
