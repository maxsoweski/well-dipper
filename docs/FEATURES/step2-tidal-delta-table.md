# Step 2 — the committed delta table: forwarding the real tidal heating

> **Generated artifact — do not hand-edit.** Regenerate with `node tools/port-condition-delta.mjs`.
> The gate for Step 2 of `docs/FEATURES/one-pipeline-two-frontends-PLAN.md` (PLAN.md:199).
> This step is a **declared pixel-moving step** (§11.3.6): its named movers *must* move, and a
> table of zeros here is a failure, not a pass.

**Tree at generation:** `b8a6102` · **generated:** 2026-08-08

## What is being differenced

Both rules are computed **by this tool**, through the shipped `bodyRawTidal`
(`src/worldengine/base/baseStep.js`), so the table reads the same before and after the port
edit lands and can be re-run at any time:

| rule | bundle handed to `bodyRawTidal` | what baseStep then does |
|---|---|---|
| **OLD** | `{radiusEarth, eccentricity}` | falls back to its own `starMassEarth = 332946`, `orbitRadiusEarth = 23455` — **1 M☉ at 1 AU, for every body in the galaxy** |
| **NEW** | `+ {tidalHeat: d.tidalHeating, starMassEarth, orbitRadiusEarth}` | takes the D12 value when present; when genuinely absent, runs the same fallback against the body's **real** star and orbit |

The condition itself is the real one — `conditionFromPlanet(rec)` — with `rawTidalIoRatio`
substituted. That substitution is licensed by the FOOTPRINT PROBE below, not assumed.

## Population

- **GENERATED — 526 bodies** (target ≥300). Three strata, every one a pure function of an integer seed:
  `S` all planets of `StarSystemGenerator.generate(seed)` for seed 1..90; `P` the rare planet-class moons harvested over seeds 1..1000; `G` a forced-type grid over all 18 types × 5 orbits (0.35, 0.9, 2, 6, 18 AU).
  Determinism: a second build from the same seeds gave the same population size and the same `rawTidalIoRatio` headline — **PASS**.
- **SOL — 14 bodies**, reported separately below.

## GENERATED — delta table

Delta = |NEW − OLD| per body; colour/palette rows are the max absolute channel delta.
No epsilon anywhere: `moved` counts bodies whose delta is not exactly 0.

⚠ **Read the magnitude column, not just the moved count.** The four `landPalette` rows move on a
handful of bodies at ~1e-5 in linear RGB — real, and far below anything a frame could show. The
two lava colours are the substantive move: they change on most of the population and by up to
~0.08 per channel. Reporting "landPalette moves" without the magnitude would overstate this step.

| quantity | moved / n | min | median | p95 | max |
|---|---:|---:|---:|---:|---:|
| `rawTidalIoRatio` | 477 / 526 | 0 | 0.00734698 | 574.375 | 210988 |
| `surfaceGravity` | 0 / 526 | 0 | 0 | 0 | 0 |
| `T_eq` | 0 / 526 | 0 | 0 | 0 | 0 |
| `landPalette.fresh` | 4 / 526 | 0 | 0 | 0 | 9.9416e-6 |
| `landPalette.weathered` | 4 / 526 | 0 | 0 | 0 | 2.2259e-5 |
| `landPalette.craton` | 4 / 526 | 0 | 0 | 0 | 2.2259e-5 |
| `landPalette.sediment` | 4 / 526 | 0 | 0 | 0 | 1.4349e-5 |
| `iceness` | 0 / 526 | 0 | 0 | 0 | 0 |
| `lavaGlowColor` | 373 / 526 | 0 | 3.2351e-5 | 0.0471187 | 0.0694927 |
| `lavaCrustColor` | 373 / 526 | 0 | 0.000131586 | 0.0691506 | 0.0767156 |
| `crater.density` | 0 / 526 | 0 | 0 | 0 | 0 |
| `crater.scale` | 0 / 526 | 0 | 0 | 0 | 0 |
| `crater.amp` | 0 / 526 | 0 | 0 | 0 | 0 |
| `crater.complexD` | 0 / 526 | 0 | 0 | 0 | 0 |
| `crater.relaxation` | 0 / 526 | 0 | 0 | 0 | 0 |
| `crater.terraceCount` | 0 / 526 | 0 | 0 | 0 | 0 |
| `crater.ejectaStrength` | 0 / 526 | 0 | 0 | 0 | 0 |
| `crater.ejectaRampart` | 0 / 526 | 0 | 0 | 0 | 0 |
| `crater.ejectaAmp` | 0 / 526 | 0 | 0 | 0 | 0 |
| `crater.ejectaLump` | 0 / 526 | 0 | 0 | 0 | 0 |

## Controls (§11.3.3 — every measurement carries a control that moved)

### 1. The moved control

`rawTidalIoRatio` moved on **477 / 526** generated bodies. The differential is wired; the rows that read 0 below are facts about the laws, not about a blind comparator.

Quantities that moved on ≥1 body (7): `rawTidalIoRatio`, `landPalette.fresh`, `landPalette.weathered`, `landPalette.craton`, `landPalette.sediment`, `lavaGlowColor`, `lavaCrustColor`

Quantities that read exactly 0 on all 526 (13): `surfaceGravity`, `T_eq`, `iceness`, `crater.density`, `crater.scale`, `crater.amp`, `crater.complexD`, `crater.relaxation`, `crater.terraceCount`, `crater.ejectaStrength`, `crater.ejectaRampart`, `crater.ejectaAmp`, `crater.ejectaLump`

### 2. The genuinely-absent case

`d.tidalHeating` is **present on 526 / 526** generated bodies and **absent on 0**.

⚠ **The absent branch is empty on this population, and that is a real finding, not a gap in the
harness.** `PlanetGenerator` writes `tidalHeating` on every record it returns, and `MoonGenerator`
does the same for planet-class moons — so on generated bodies the NEW rule always takes the D12
value and the corrected fallback is never *reached*. Two consequences, both stated rather than
smoothed over:

- Forwarding `starMassEarth` / `orbitRadiusEarth` buys **nothing on today's generated population**.
  It is insurance for the bodies that do not carry a D12 value — Sol's (below), hand-authored
  records, and the moons Step 8 brings through `conditionFromBody`.
- So the split alone is not evidence the forwarding does anything. The counterfactual below is.

**Counterfactual — the same bodies with the D12 value deliberately withheld**, so the fallback is
the branch taken. OLD fallback (1 M☉ at 1 AU) vs CORRECTED fallback (real star, real orbit):

| | moved / n | min | median | p95 | max |
|---|---:|---:|---:|---:|---:|
| |Δ| of the fallback itself | 477 / 526 | 0 | 0.012744 | 2126.99 | 1.7143e+9 |

And the check that the forwarded pair is the *right* pair — relative error between the corrected
fallback and the body's own `d.tidalHeating`, over the bodies with a non-zero D12 value. This is
the strongest available evidence that `starMassEarth`/`orbitRadiusEarth` are the correct two
quantities to forward: `PhysicsEngine.js` `tidalHeatingPlanet` is the SAME Peale–Cassen–Reynolds
law the baseStep fallback runs, so a correctly-forwarded pair must reproduce the D12 value.
Reported per stratum, because the three strata answer differently and one number would hide it:

| stratum | n (D12 > 0) | agrees to float noise (rel. err ≤ 1e-12) | real misses | of those, in a system whose orbits were rewritten | max rel. err |
|---|---:|---:|---:|---:|---:|
| `S` | 341 | 300 / 341 | 41 | 40 | 1.7329e+11 |
| `P` | 64 | 0 / 64 | 64 | 0 | 6.7452e+6 |
| `G` | 72 | 72 / 72 | 0 | 0 | 3.5046e-16 |

Read the three rows separately — the two non-zero ones are findings, not noise:

- **`G` reproduces it to float noise** (max ~3e-16). This is the clean case: the grid generates at
  a known orbit under a 1 M☉ default (`PlanetGenerator.js:372` `zones?.starMassSolar || 1.0`),
  nothing rewrites either afterwards, and the forwarded pair reconstructs the D12 value exactly.
  **The forwarding is correct.**
- **`S` reproduces it exactly on most bodies and misses on the rest** — and the miss is not a bug in
  the forwarding. `StarSystemGenerator` rewrites `orbitRadiusAU` **after** `PlanetGenerator` has
  already computed `tidalHeating`: resonance-chain snapping and migration both move a planet, and
  90 of the 372 `S` bodies sit in a system where that happened. So the record's D12 value describes the body's
  **pre-snap** orbit while the wrapper reports the post-snap one. The correlation is close to
  total: of the 41 real misses in `S`, **40** are in a system whose orbits were rewritten.
  ⚠ **1 is not**, and that residue is NOT explained here — it is left on the record
  rather than rounded away, because a mechanism that accounts for 40 of 41 cases is exactly the
  kind of story that gets treated as accounting for 41.
  ⚠ **The ordering itself is a real finding about the game's own physics, independent of Step 2** —
  `planetData.tidalHeating` is stale on every resonance-snapped or migrated planet. It does not
  affect the delta table (the NEW rule takes `d.tidalHeating` whatever orbit produced it), and it
  is not fixed here.
- **`P` (planet-class moons) never reproduces it**, and this one matters for Step 8.
  `MoonGenerator` `_computeTidalHeating` draws a *dedicated* moon eccentricity from its own seed
  (`moonecc:…`) and feeds THAT to `tidalHeating()`. The value never lands on the record — the
  moon record's `eccentricity` field is a different draw entirely. So for a moon there is no pair
  of forwardable record fields that reconstructs its D12 value: the eccentricity that produced it
  is not on the record. **Forwarding `starMassEarth`/`orbitRadiusEarth` is therefore necessary but
  not sufficient for moons**, and Step 8's `conditionFromBody` will need the moon eccentricity
  surfaced (or the D12 value taken as authoritative and the fallback never relied on).

### 2b. ⚠ THE CRATER UNIFORMS DO NOT MOVE — diagnosed, with its own control

Step 2's gate names *"plus the crater uniforms"* among the quantities to publish, on the
reasoning that `rawTidalIoRatio` feeds `craterSchedule`'s `tExp` (`bombardment.js:174-176`).
**Measured: every crater uniform reads exactly 0 on 526 / 526 bodies.** That is a real
result, not a blind comparator, and three separate measurements say so:

- **Craters are on at all on only 6 / 526 bodies.** `craterUniformsFrom` returns
  `CRATERS_OFF` unless the schedule fires, the resolvable band is non-empty and
  `density ≥ CRATER_MIN_DENSITY`. A uniform that is off almost everywhere cannot move almost
  anywhere.
- **The chain CAN see a tidal move.** Forcing `rawTidalIoRatio` 0 → 1e5 on the same conditions
  moves `craterSchedule` on **333 / 526** bodies and the crater uniforms on
  **6 / 526** — i.e. on every body that has craters at all. The comparator is wired.
- **Why the real delta is nevertheless zero.**
  `tExp = min(age, T_RESURF_TIDAL/td, T_RESURF_ERODE/erosion)` is a **min of three**. The tidal
  term only binds once `td` is large enough to pull `0.7/td` under the other two. Argmin of
  `tExp` under the NEW rule: **age 38**, **erosion 446**, **tidal 42**
  (of 526); the tidal term is the binding constraint under *either* rule on **105** bodies.
  At the Io-ratios this population actually carries, tides are not what limits crater
  retention — age and erosion are — so changing `td` slides a term that is not the minimum.

**What this means for the plan.** Step 2's *"why now, hoisted"* argument is that Step 9 must not
capture byte-identity fixtures against a fabricated tidal number. For the four bakes that
argument is confirmed by this table. For the crater uniforms it is **not** confirmed today: on
this population they would capture identically either way. It remains correct as insurance —
the coupling is real and one body with a high enough `td` makes it bind — but Step 9 should not
be sequenced on the strength of a crater move that has never been observed. This finding is
reported rather than reconciled.

### 3. The no-op control

**`iceness` — 0 / 526 moved, max delta 0.**

It is picked as the no-op control because its law can be read: `surfaceMaterial.js` `icenessOf`
reads `composition.density`, `composition.volatileFraction` and `T_eq` — and nothing else. There is
no tidal term and no call into one. It is nevertheless computed **through the real shipped law on
both branches**, from two conditions that genuinely differ, so its zero is measured rather than
asserted. It sits in the same list as the three bakes that DO move, which is what makes the
contrast informative: `landPalette` moves because `surfaceAlbedoOf` calls `resurfacingRateOf`
(`surfaceMaterial.js` `resurfacingRateOf`, whose first read is `cond.rawTidalIoRatio`), and the two
lava colours move because `meltTemperatureOf` reads the same scalar. `iceness` calls neither.

`surfaceGravity` and `T_eq` also read 0 — but in the main table they are **copied**, so their zero
there proves nothing on its own. The footprint probe is what gives it weight:

### FOOTPRINT PROBE — what the three forwarded fields can reach inside the condition vector

Over **120** bodies, an fp was rebuilt and `deriveConditionVector` called **twice**, differing
only in `tidalHeat` / `starMassEarth` / `orbitRadiusEarth`; all 18 returned keys were diffed.

| condition key | bodies on which it differed |
|---|---:|
| `rawTidalIoRatio` | **109** |
| _(all 17 other keys, incl. `surfaceGravity` and `T_eq`)_ | 0 |

So the substitution the main table performs is the whole causal footprint, measured — and
`surfaceGravity` / `T_eq` read 0 through a second real derivation, not because they were copied.
If a future law reads `starMassEarth` directly, a second row appears here and the assumption
behind this table breaks loudly instead of silently.

### 4. Agreement with the plan's figures

PLAN.md Step 2 (and the Step-2 brief) cite: *"within 2× of truth for **5.6%**, **median 75× off**"*,
measured over 161 generated planets. Measured here over 526 bodies, OLD vs NEW:

| figure | plan | this run |
|---|---:|---:|
| within 2× | 5.6% | **19.4%** (102 / 526) |
| median ratio | 75× | **31.9986×** |
| p95 ratio | — | 5.0550e+6× |
| max finite ratio | — | 9.0742e+13× |
| bodies where exactly one side is 0 (ratio undefined) | — | 0 |
| bodies where BOTH sides are exactly 0 (counted as ratio 1 above) | — | 49 |

The plan does not state how it treated bodies on which both rules return exactly 0 — here
49 of 526, every one an `eccentricity == 0` body where an $e^{2}$ law is 0 either way.
Counting them as agreement (above) or dropping them (below) changes the headline, so both are
published rather than one being chosen quietly:

| figure | plan | this run, both-zero bodies dropped |
|---|---:|---:|
| n | 161 | 477 |
| within 2× | 5.6% | **11.1%** |
| median ratio | 75× | **49.9184×** |
| p95 ratio | — | 7.0224e+6× |

Per stratum, because the plan's population was *"161 generated planets"* — closest to
stratum `S` alone (system planets), not to this whole population:

| stratum | n | within 2× | median ratio | p95 ratio |
|---|---:|---:|---:|---:|
| `S` | 372 | 16.9% | 41.8189× | 6.9013e+7× |
| `P` | 64 | 4.7% | 14.8794× | 6982.15× |
| `G` | 90 | 40.0% | 31.9986× | 1.8895e+6× |

**⚠ THIS RUN DISAGREES WITH THE PLAN AND THE DISAGREEMENT IS NOT RECONCILED HERE.**
Neither figure reproduces: within-2× comes out ~3.5× higher than the plan's 5.6%, and the
median ratio ~2.3× lower than its 75×. The direction of both is the same — the sign and the
order of magnitude of the defect are confirmed, and "the fallback is wrong by ~1.5 orders of
magnitude on the median body" survives — but the exact numbers do not, on any stratum
individually or on the whole. Two candidate causes, neither verified here because verifying
them means re-deriving the plan's original measurement, which is out of this lane's scope:
the populations are different (526 bodies across three strata vs 161 generated planets, and
the strata table above shows the figure is strongly stratum-dependent), and the plan does not
state how it treated bodies where one side is 0. **Whoever closes Step 2 should either
re-derive the 5.6% / 75× on a named population or replace those figures in PLAN.md with the
ones above.** They should not be repeated as-is once this table exists.

## SOL — second population, clearly labelled

⛔ **This is a pure-function measurement and nothing else.** No Sol pixel was inspected and nothing
here may be quoted as a rendering claim. Sol is included because a delta between two evaluations
of a pure function of a data record is a fact about the function, and Sol bodies are records.

`d.tidalHeating` present on **0 / 14** Sol bodies; absent on **14**.

**Sol is the genuinely-absent branch, in full.** All 14 bodies take the fallback, so this is
the population where forwarding `starMassEarth` / `orbitRadiusEarth` is the only thing that could
act. It reads **all zeros anyway**, for a reason worth stating: `SolarSystemData.js` builds its
planet records without an `eccentricity` field — non-zero on **0 / 14** bodies — and the
fallback is $\propto e^{2}$. With $e = 0$ the OLD 1 M☉-at-1-AU fallback and the corrected
real-star-real-orbit fallback are both exactly 0, whatever the orbit. So Sol confirms the absent
branch is *reached* and confirms the change is *safe* there; it is not evidence that the
forwarding computes anything, and must not be cited as such. The counterfactual in control 2 is.

| quantity | moved / n | min | median | p95 | max |
|---|---:|---:|---:|---:|---:|
| `rawTidalIoRatio` | 0 / 14 | 0 | 0 | 0 | 0 |
| `surfaceGravity` | 0 / 14 | 0 | 0 | 0 | 0 |
| `T_eq` | 0 / 14 | 0 | 0 | 0 | 0 |
| `landPalette.fresh` | 0 / 14 | 0 | 0 | 0 | 0 |
| `landPalette.weathered` | 0 / 14 | 0 | 0 | 0 | 0 |
| `landPalette.craton` | 0 / 14 | 0 | 0 | 0 | 0 |
| `landPalette.sediment` | 0 / 14 | 0 | 0 | 0 | 0 |
| `iceness` | 0 / 14 | 0 | 0 | 0 | 0 |
| `lavaGlowColor` | 0 / 14 | 0 | 0 | 0 | 0 |
| `lavaCrustColor` | 0 / 14 | 0 | 0 | 0 | 0 |
| `crater.density` | 0 / 14 | 0 | 0 | 0 | 0 |
| `crater.scale` | 0 / 14 | 0 | 0 | 0 | 0 |
| `crater.amp` | 0 / 14 | 0 | 0 | 0 | 0 |
| `crater.complexD` | 0 / 14 | 0 | 0 | 0 | 0 |
| `crater.relaxation` | 0 / 14 | 0 | 0 | 0 | 0 |
| `crater.terraceCount` | 0 / 14 | 0 | 0 | 0 | 0 |
| `crater.ejectaStrength` | 0 / 14 | 0 | 0 | 0 | 0 |
| `crater.ejectaRampart` | 0 / 14 | 0 | 0 | 0 | 0 |
| `crater.ejectaAmp` | 0 / 14 | 0 | 0 | 0 | 0 |
| `crater.ejectaLump` | 0 / 14 | 0 | 0 | 0 | 0 |

---

_Regenerate: `node tools/port-condition-delta.mjs`. Negative controls: `node tools/port-condition-delta.mjs --selftest`._
