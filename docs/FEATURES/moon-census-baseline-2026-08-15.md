# Moon census — the pre-rework baseline

**Step:** B0 of `docs/FEATURES/moon-formation-channel-model-PLAN-2026-08-15.md`
**Tree:** `feature/world-engine-production-L1` @ `571b04d`, node v24.13.1
**Amended** after adversarial review of B0 — see the third and fifth findings (the Hill rows were
reported as if disjoint; the audit's Hill figures were not checked against this census).
**Tool:** `tools/moon-census.mjs` — read-only. Imports the shipped generator, installs no
wrappers, writes no file, mutates no record. Regenerate with:

```
node tools/moon-census.mjs                  # §A below
node tools/moon-census.mjs --corpus=bulk221 # §B below
```

**Why this exists.** Every rate claim in the channel-model plan is unfalsifiable without it, and
the plan already records one mis-scoping caused by its absence — a Band A conversion computed
against an assumed mean of ~20 moons per system. This is the measurement that replaces the
assumption. Zero bodies moved: no generator file was touched.

---

## ⭐ THE FIRST FINDING, AND IT LANDS BEFORE ANY RATE

**"221 seeds" already means two different corpora in this tree, and they give different answers.**

`moon-formation-audit-2026-08-15.md` reports 829 moons over 221 seeds, `P(zero | gas giant)` = 10
of 72 = 13.9%, and 60 inverted sibling pairs of 321. FENCE-221 — the corpus
`tests/body-identity-fence.test.js` pins and the corpus every other instrument in this tree is
stated against — has **794 moons, 63 gas giants, and 57 inversions of 292**. None of the audit's
figures reproduce on it.

Measured this session: the audit's corpus is a plain `wd-0`…`wd-220` bulk run. On that corpus all
four of its figures reproduce **exactly** — 948 planets, 829 moons, 10 of 72 → 13.9%, 60 of 321 →
18.7%. It is registered in the tool as BULK-221 and reported in §B so the two are comparable side
by side rather than confused for each other a second time.

Neither corpus is wrong. Quoting one's number against the other is, and the plan's §B0 does
exactly that when it carries the audit's 13.9% into a design that will be verified on the fence.

**Consequences for the plan, stated plainly:**

- **`m̄ = 3.69` reproduces on NEITHER corpus and is asserted, never derived.** The plan states it
  three times (`:154`, `:216`, `:271`) and shows no computation for it anywhere in the tree. FENCE-221
  gives 3.5928 per system, 3.7453 per planet-bearing system, 4.0510 per moon-bearing system.
  BULK-221 gives 3.7511 / 3.9289 / 4.2081. The plan's own warning — that no rate claim survives
  without this measurement — applies to the plan's own figure. Use the measured row, and name the
  denominator with it.
- **`P(zero moons | gas giant)` is 12.70% on the fence, not 13.9%.** The C1 ruling that this
  number motivates is unaffected in direction; the number in the acceptance test is not.
- **Sibling inversions are 57 of 292 on the fence, not 60 of 321.** The rate is close (19.52% vs
  18.69%); the absolute pair count is not, and B8's "zero inverted sibling pairs" assertion has to
  be written against whichever corpus the test actually runs.

## ⚠ THE SECOND FINDING: the terrestrial-planet multiplicity risk has landed, and it is worse than the plan's bracket

The plan calls this "the highest-risk unknown" and converts Elser's 8.3% per terrestrial planet to
a per-system rate through an assumed ~3 terrestrial planets per system. **Measured: 0.0181.**
FENCE-221 contains **4** planets of type `terrestrial` across 961 planets and 221 systems — 217 of
221 systems have none at all.

Through 0.0181 terrestrial planets per system, Elser's 8.3% yields roughly **0.15% of systems**
with a Band A moon, not the 22.9% the plan computes. That is a factor of ~150, and it is not
absorbable by tuning the moon rate. Per the plan's own §4 ruling, this is reported and not
absorbed: **the defect is in `PlanetGenerator._pickType`, which is a planet-layer workstream.**

If the intended denominator is instead *any solid planet*, the generator has 3.1357 per system
(693 of 961 planets), which is in the range the plan assumed. That is a scoping question for the
owner, not something this step decides: `terrestrial` is a **type label** in this generator, not
the class of rocky bodies.

## ⚠ THE THIRD FINDING: 49 moons sit outside their own Domingos limit, and 17 are unbound outright

Under `R_H = a_p · (M_p / 3M_*)^(1/3)` at the parent's final orbit, **49 of 794 moons are beyond
the stability limit for their own orbital sense** — 45 prograde past 0.4895 R_H, 4 retrograde past
0.9309 R_H. **49 is the number B8 has to drive to zero.** Of those, **17 are beyond 1.0 R_H
outright** — unbound — reaching a maximum of **17.5 R_H**.

⛔ **Those three counts are nested, not disjoint.** Because `0.4895 < 0.9309 < 1.0`, all 17 unbound
moons are already inside the 49 — verified, the overlap is 17 of 17. Adding the rows gives 66,
which is 17 moons of double-count. The unbound figure is a *severity* note on the 49, not an
addition to it.

## ⚠ THE FIFTH FINDING: the audit's Hill numbers do not reproduce, and this is NOT the corpus problem

`moon-formation-audit-2026-08-15.md` §0 reports "**32 of 829** moons sit outside R_Hill outright,
plus **47 more** beyond the 0.4895 prograde limit," explicitly "recomputed against final orbits."
On BULK-221 — the audit's own corpus — the measurement is **16 and 48, a union of 51 against its
79**. The unbound count is off by exactly 2×.

This one cannot be waved off as the corpus confusion above, because BULK-221 reproduces *everything
else the audit reports*: 948 planets, 829 moons, 10-of-72 gas giants, 60-of-321 inversions, 26
planet-class moons, and 508 moon-bearing planets (its 73+435 ring split). The corpus is settled; the
Hill figure is the outlier.

The audit records no formula. Swept this session and **not** reproduced under `M_p/(3M_*)` or
`M_p/M_*`, thresholds 0.4895 → 1.0, per-moon or per-planet denominators, primary-only or combined
binary star mass. **The audit's 32/47 should be treated as unsourced until someone reproduces it.**
This matters because B8's acceptance bracket would otherwise be written against 79.

Roche is clean: **0 violations of 794**, minimum a/R_roche = 2.439. So the plan's B8 Roche
assertion is already satisfied and will stay satisfied only if the ordered-orbit ladder keeps its
clamp — it is not currently *enforced* anywhere, it just happens not to bind at 6+ parent radii.

## ⚠ THE FOURTH FINDING: Band A is at exactly zero on its own channel's parent class

Band A (0.2–0.7 R⊕ on a solid parent) has **2 bodies in 794 across FENCE-221** — and **neither is
on a `terrestrial` parent**. Both sit on `ice` parents (`wd-127/5` at 0.200 R⊕, `wd-135/2` at
0.260 R⊕). So the strict per-terrestrial-planet rate C2 exists to move is **0.00000**, from a
population of 4 terrestrial planets.

This is the measured version of the plan's "from never to roughly one system in four", and it
confirms the *direction* while breaking the *arithmetic*: with 0.0181 terrestrial planets per
system, C2 as specified cannot reach one system in four no matter what Bernoulli it carries. The
per-planet rate and the parent population are two separate problems and only the first belongs to
this workstream.

## What is clean

- Population reproduces the fence exactly: 221 / 961 / 770 / 24.
- The mass-path assertion holds on both populations: 770 plain moons carry top-level `massEarth`,
  **0 planet-class moons do**, and all 24 carry `planetData.massEarth`. The naive single-path read
  silently drops those 24 records — the entire Band B planet-class contribution, whose mass ratios
  run to 1.47e-1 against the plain population's 4.18e-2 max.
- 0 Roche violations, 0 moons with missing density on either path.

---

# §A — FENCE-221 (the corpus every other instrument in this tree is stated against)

# Moon census — corpus FENCE-221

**Corpus:** `FENCE-221` — 192 bulk `wd-0`…`wd-191` (galaxyContext null) + 5 pinned rare-type seeds + 24 `gc-N` GalacticMap positions under master seed `body-identity-fence`.

**Provenance:** verbatim from tests/body-identity-fence.test.js — the corpus every fence measurement in this tree is stated against.

⛔ Do not quote any number below against a different corpus without re-measuring. This
project has already lost figures that way: `moon-formation-audit-2026-08-15.md` and
`tests/body-identity-fence.test.js` both say "221 seeds" and mean different sets.

**Tool:** `tools/moon-census.mjs` — read-only; imports the shipped generator, installs no
wrappers, writes nothing, mutates nothing.

## 1. Population

| quantity | measured | fence pins |
|---|---:|---:|
| seeds | 221 | 221 |
| planets | 961 | 961 |
| plain moons | 770 | 770 |
| planet-class moons | 24 | 24 |
| moons total | 794 | 794 |

## 2. m̄ — mean moons per system

⚠ Three denominators, and they are **not** interchangeable. The plan quotes 3.69; whichever
row that was, the others are the ones a rate conversion will silently get wrong.

| denominator | n | m̄ |
|---|---:|---:|
| all systems in the corpus | 221 | **3.5928** |
| systems that have ≥1 planet | 212 | 3.7453 |
| systems that have ≥1 moon | 196 | 4.0510 |
| per PLANET (not per system) | 961 | 0.8262 |

Planet-free systems: 9 of 221.

## 3. Moons per parent type

| parent type | planets | moons | mean | max | P(zero moons) |
|---|---:|---:|---:|---:|---:|
| rocky | 201 | 107 | 0.532 | 1 | 46.77% |
| sub-neptune | 201 | 299 | 1.488 | 3 | 25.87% |
| ice | 158 | 80 | 0.506 | 1 | 49.37% |
| venus | 138 | 0 | 0.000 | 0 | 100.00% |
| carbon | 119 | 64 | 0.538 | 1 | 46.22% |
| gas-giant | 63 | 191 | 3.032 | 6 | 12.70% |
| lava | 53 | 33 | 0.623 | 1 | 37.74% |
| ocean | 8 | 4 | 0.500 | 1 | 50.00% |
| terrestrial | 4 | 4 | 1.000 | 2 | 25.00% |
| hot-jupiter | 4 | 8 | 2.000 | 4 | 25.00% |
| crystal | 3 | 1 | 0.333 | 1 | 66.67% |
| eyeball | 2 | 1 | 0.500 | 1 | 50.00% |
| fungal | 2 | 0 | 0.000 | 0 | 100.00% |
| hex | 1 | 1 | 1.000 | 1 | 0.00% |
| shattered | 1 | 0 | 0.000 | 0 | 100.00% |
| city-lights | 1 | 1 | 1.000 | 1 | 0.00% |
| ecumenopolis | 1 | 0 | 0.000 | 0 | 100.00% |
| machine | 1 | 0 | 0.000 | 0 | 100.00% |

**P(zero moons | gas giant) = 12.70%**

## 4. Band A and Band B

**Band A** = a moon of radius 0.2–0.7 R⊕ on a SOLID parent (parent type not in
{gas-giant, hot-jupiter, sub-neptune}). **Band B** = a moon of radius > 1 R⊕.

Parent inventory: 4 planets of type `terrestrial`, 693 solid planets of any type, 268 giants.

| Band A — the denominators are NOT interchangeable | value |
|---|---:|
| bodies in band (solid parents, all solid types) | 2 |
| of those, planet-class records | 0 |
| of those, on a `terrestrial` parent | 0 |
| **per `terrestrial` planet (strict — Elser's denominator)** | **0.00000** |
| per SOLID planet (any solid type) | 0.00289 |
| mean per system | 0.00905 |
| fraction of systems with ≥1 | 0.90% (2/221) |
| ⚠ MIXED denominator, do not quote: all solid-parent band-A bodies ÷ `terrestrial` planets | 0.50000 |

Band A bodies by parent type: `ice` 2.

Coordinates (`seed/planetIndex`): `wd-127/5 (parent ice, moon R=0.200 R⊕)`; `wd-135/2 (parent ice, moon R=0.260 R⊕)`.

| Band B | value |
|---|---:|
| bodies in band (any parent) | 51 |
| of those, planet-class records | 11 |
| of those, on a giant parent | 51 |
| per giant | 0.19030 |
| fraction of giants with ≥1 | 10.82% |
| mean per system | 0.23077 |
| fraction of systems with ≥1 | 12.22% (27/221) |

Band B bodies by parent type: `gas-giant` 50, `hot-jupiter` 1.

## 5. Terrestrial-planet multiplicity

The plan names this the highest-risk unknown: Elser's per-planet rate converts to a
per-system rate only through this number.

- mean `terrestrial` planets per system (all 221): **0.0181**
- mean `terrestrial` planets per system with ≥1 planet: 0.0189
- mean SOLID planets per system: 3.1357

| terrestrial planets in system | systems |
|---:|---:|
| 0 | 217 |
| 1 | 4 |

## 6. Mass ratio (moon mass ÷ parent mass)

Nearest-rank percentiles, no interpolation. The two populations are reported SEPARATELY
because they carry mass on different paths — see §7.

| population | n | p05 | median | p95 | max |
|---|---:|---:|---:|---:|---:|
| plain moons | 770 | 1.505e-5 | 2.790e-4 | 1.008e-2 | 4.175e-2 |
| planet-class moons | 24 | 1.826e-3 | 1.165e-2 | 7.100e-2 | 1.470e-1 |
| combined | 794 | 1.548e-5 | 2.945e-4 | 1.328e-2 | 1.470e-1 |
| ⚠ naive `m.massEarth` only | 770 | 1.505e-5 | 2.790e-4 | 1.008e-2 | 4.175e-2 |

## 7. Record-shape assertions (the mass trap, asserted not assumed)

| assertion | count |
|---|---:|
| plain moons carrying top-level `massEarth` | 770 |
| plain moons MISSING top-level `massEarth` | 0 |
| planet-class moons carrying top-level `massEarth` (expect 0) | 0 |
| planet-class moons carrying `planetData.massEarth` | 24 |
| planet-class moons with no mass on EITHER path | 0 |
| plain moons carrying `composition.density` | 770 |
| planet-class moons carrying `planetData.composition.density` | 24 |

## 8. Hill-sphere occupancy

**Convention:** R_H = a_p · (M_p / (3·M_*))^(1/3); a_p = FINAL wrapper.orbitRadiusAU.
Star mass reproduced as `star.radiusSolar ** 1.25` (`StarSystemGenerator.js:386`).
⚠ The parent orbit used is the FINAL one — migration and resonance-snap rewrite
`wrapper.orbitRadiusAU` in place AFTER the moon loop, so for a migrated system this is not
the orbit the moon was generated against. Migration incidence is reported so the size of
that caveat is visible.

| quantity | value |
|---|---:|
| moons evaluated | 794 |
| moons skipped (missing input) | 0 |
| prograde moons beyond 0.4895 R_H (Domingos) | 45 |
| retrograde moons beyond 0.9309 R_H (Domingos) | 4 |
| **UNION — beyond its OWN sense's Domingos limit (the B8 number)** | **49** |
| a > 1.0 R_H (unbound) — a SUBSET of the union above | 17 |
| of those unbound, already counted in the union | 17 |

⛔ **These rows are NESTED, not disjoint — do not add them.** Because
`0.4895 < 0.9309 < 1.0`, every unbound moon is already past its own Domingos limit, so
the 17 unbound moons sit INSIDE the 49, not beside them. Summing the prograde,
retrograde and unbound rows gives 66, which is 17 moons of double-count. B8 asserts "zero moons
outside 0.4895 R_H prograde / 0.9309 R_H retrograde" — the count it must drive to zero is
**49**, and the unbound subset is a severity note on it, not an addition to it.

| further detail | value |
|---|---:|
| a/R_H  p05 / median / p95 / max | 0.00138 / 0.04846 / 0.60490 / 17.53066 |
| systems where migration occurred | 6 / 221 |
| systems with a resonance chain | 27 / 221 |

## 9. Roche-limit violations

**Convention:** PhysicsEngine.rocheLimit(rho_parent, rho_moon), fluid form, in parent radii.

| quantity | value |
|---|---:|
| moons evaluated | 794 |
| moons skipped (missing density) | 0 |
| inside Roche (a < R_roche) | 0 |
| a/R_roche  min / p05 / median / max | 2.439 / 2.714 / 8.389 / 36.675 |

## 10. Sibling-order inversions

Adjacent moon pairs (by `orbitRadiusEarth`, in generation order): **57 inverted of 292** — 19.52%.
Planets carrying at least one inversion: 50.

## 11. Regular / irregular split

⚠ There is no `regular` flag and no `retrograde` FIELD on any generated moon. Retrograde
survives only as the SIGN of `orbitSpeed`. So this is a convention, and three of them are
reported side by side rather than one being passed off as a read.

| convention | count | of | share |
|---|---:|---:|---:|
| type === 'captured' | 187 | 794 | 23.55% |
| orbitSpeed < 0 (retrograde) | 74 | 794 | 9.32% |
| either (irregular) | 187 | 794 | 23.55% |
| both | 74 | 794 | 9.32% |
| regular (neither) | 607 | 794 | 76.45% |

|abs inclination| p05 / median / p95 / max (rad): 0.0070 / 0.0612 / 0.4003 / 0.4982

## 12. Moon radius distribution (context for §4)

| population | n | min | p05 | median | p95 | max |
|---|---:|---:|---:|---:|---:|---:|
| plain | 770 | 0.0063 | 0.0140 | 0.1647 | 1.0127 | 2.6157 |
| planet-class | 24 | 0.3104 | 0.3628 | 0.8323 | 2.6398 | 2.8758 |
| combined | 794 | 0.0063 | 0.0141 | 0.1743 | 1.2011 | 2.8758 |

## 13. Disagreements with figures quoted upstream

⛔ Nothing below was adjusted to make a quoted figure come out right. Where this corpus
disagrees, the disagreement is the report.

| quantity | quoted upstream | measured on FENCE-221 | verdict |
|---|---:|---:|---|
| m̄, mean moons per system (PLAN §B0) | 3.69 | 3.5928 all · 3.7453 with-planets · 4.0510 moon-bearing | **no denominator reproduces 3.69 on either corpus** |
| P(zero moons \| gas giant) (AUDIT §2) | 13.9% (10 of 72) | 12.70% | **does not reproduce** |
| sibling-order inversions (AUDIT §3.1) | 60 of 321 (18.7%) | 57 of 292 (19.52%) | **does not reproduce** |
| moons / 221 seeds (AUDIT §1) | 829 | 794 | **does not reproduce** |
| moons outside R_Hill outright (AUDIT §0) | 32 of 829 | 17 of 794 | **does not reproduce** |
| + "47 more" beyond 0.4895 prograde ⇒ union (AUDIT §0) | 79 | 49 | **does not reproduce** |
| population (planets / plain / planet-class) (FENCE) | 961 / 770 / 24 | 961 / 770 / 24 | reproduces (exact) |

⭐ **The audit's corpus is not the fence's corpus.** Run `--corpus=bulk221` and all four
of its POPULATION figures reproduce exactly; run the default FENCE-221 and none of them do.
Both documents say "221 seeds". Neither corpus is wrong; quoting one's number against the
other is.

⛔ **The Hill rows are the exception, and they are a different KIND of disagreement.** The
audit's corpus is settled — BULK-221 reproduces its 948 planets, its 829 moons, its 10-of-72,
its 60-of-321, its 26 planet-class moons, and its 508 moon-bearing planets (73+435). So its
Hill figures cannot be excused as a corpus artefact: on the very corpus that reproduces
everything else it reports, "32 of 829 outside R_Hill, plus 47 more" measures **16 and 48**
here, a union of **51** against its 79. The audit states it recomputed "against final
orbits" — the convention used here — but records no formula. Swept this session and NOT
reproduced under: `M_p/(3M_*)` and `M_p/M_*`; thresholds 0.4895 → 1.0; per-moon and
per-planet denominators; primary-only and combined binary star mass. **Treat the audit's
32/47 as unsourced until someone reproduces it; the numbers above are the reproducible ones.**


---

# §B — BULK-221 (the corpus `moon-formation-audit-2026-08-15.md` measured on)

# Moon census — corpus BULK-221

**Corpus:** `BULK-221` — 221 bulk seeds `wd-0`…`wd-220`, galaxyContext null throughout.

**Provenance:** reconstructed this session as the corpus `moon-formation-audit-2026-08-15.md` measured on — it reproduces all four of that document's reported figures exactly.

⛔ Do not quote any number below against a different corpus without re-measuring. This
project has already lost figures that way: `moon-formation-audit-2026-08-15.md` and
`tests/body-identity-fence.test.js` both say "221 seeds" and mean different sets.

**Tool:** `tools/moon-census.mjs` — read-only; imports the shipped generator, installs no
wrappers, writes nothing, mutates nothing.

## 1. Population

| quantity | measured | pinned elsewhere |
|---|---:|---:|
| seeds | 221 | — |
| planets | 948 | — |
| plain moons | 803 | — |
| planet-class moons | 26 | — |
| moons total | 829 | — |

## 2. m̄ — mean moons per system

⚠ Three denominators, and they are **not** interchangeable. The plan quotes 3.69; whichever
row that was, the others are the ones a rate conversion will silently get wrong.

| denominator | n | m̄ |
|---|---:|---:|
| all systems in the corpus | 221 | **3.7511** |
| systems that have ≥1 planet | 211 | 3.9289 |
| systems that have ≥1 moon | 197 | 4.2081 |
| per PLANET (not per system) | 948 | 0.8745 |

Planet-free systems: 10 of 221.

## 3. Moons per parent type

| parent type | planets | moons | mean | max | P(zero moons) |
|---|---:|---:|---:|---:|---:|
| sub-neptune | 200 | 311 | 1.555 | 3 | 24.50% |
| rocky | 199 | 106 | 0.533 | 1 | 46.73% |
| ice | 147 | 78 | 0.531 | 1 | 46.94% |
| venus | 131 | 0 | 0.000 | 0 | 100.00% |
| carbon | 127 | 66 | 0.520 | 1 | 48.03% |
| gas-giant | 72 | 217 | 3.014 | 6 | 13.89% |
| lava | 52 | 34 | 0.654 | 1 | 34.62% |
| ocean | 8 | 4 | 0.500 | 1 | 50.00% |
| hot-jupiter | 5 | 8 | 1.600 | 4 | 40.00% |
| eyeball | 3 | 1 | 0.333 | 1 | 66.67% |
| crystal | 2 | 1 | 0.500 | 1 | 50.00% |
| hex | 1 | 1 | 1.000 | 1 | 0.00% |
| terrestrial | 1 | 2 | 2.000 | 2 | 0.00% |

**P(zero moons | gas giant) = 13.89%**

## 4. Band A and Band B

**Band A** = a moon of radius 0.2–0.7 R⊕ on a SOLID parent (parent type not in
{gas-giant, hot-jupiter, sub-neptune}). **Band B** = a moon of radius > 1 R⊕.

Parent inventory: 1 planets of type `terrestrial`, 671 solid planets of any type, 277 giants.

| Band A — the denominators are NOT interchangeable | value |
|---|---:|
| bodies in band (solid parents, all solid types) | 2 |
| of those, planet-class records | 0 |
| of those, on a `terrestrial` parent | 0 |
| **per `terrestrial` planet (strict — Elser's denominator)** | **0.00000** |
| per SOLID planet (any solid type) | 0.00298 |
| mean per system | 0.00905 |
| fraction of systems with ≥1 | 0.90% (2/221) |
| ⚠ MIXED denominator, do not quote: all solid-parent band-A bodies ÷ `terrestrial` planets | 2.00000 |

Band A bodies by parent type: `ice` 2.

Coordinates (`seed/planetIndex`): `wd-127/5 (parent ice, moon R=0.200 R⊕)`; `wd-135/2 (parent ice, moon R=0.260 R⊕)`.

| Band B | value |
|---|---:|
| bodies in band (any parent) | 59 |
| of those, planet-class records | 14 |
| of those, on a giant parent | 59 |
| per giant | 0.21300 |
| fraction of giants with ≥1 | 12.27% |
| mean per system | 0.26697 |
| fraction of systems with ≥1 | 14.48% (32/221) |

Band B bodies by parent type: `gas-giant` 58, `hot-jupiter` 1.

## 5. Terrestrial-planet multiplicity

The plan names this the highest-risk unknown: Elser's per-planet rate converts to a
per-system rate only through this number.

- mean `terrestrial` planets per system (all 221): **0.0045**
- mean `terrestrial` planets per system with ≥1 planet: 0.0047
- mean SOLID planets per system: 3.0362

| terrestrial planets in system | systems |
|---:|---:|
| 0 | 220 |
| 1 | 1 |

## 6. Mass ratio (moon mass ÷ parent mass)

Nearest-rank percentiles, no interpolation. The two populations are reported SEPARATELY
because they carry mass on different paths — see §7.

| population | n | p05 | median | p95 | max |
|---|---:|---:|---:|---:|---:|
| plain moons | 803 | 1.723e-5 | 2.945e-4 | 1.039e-2 | 4.175e-2 |
| planet-class moons | 26 | 1.826e-3 | 1.698e-2 | 7.325e-2 | 1.470e-1 |
| combined | 829 | 1.779e-5 | 3.097e-4 | 1.335e-2 | 1.470e-1 |
| ⚠ naive `m.massEarth` only | 803 | 1.723e-5 | 2.945e-4 | 1.039e-2 | 4.175e-2 |

## 7. Record-shape assertions (the mass trap, asserted not assumed)

| assertion | count |
|---|---:|
| plain moons carrying top-level `massEarth` | 803 |
| plain moons MISSING top-level `massEarth` | 0 |
| planet-class moons carrying top-level `massEarth` (expect 0) | 0 |
| planet-class moons carrying `planetData.massEarth` | 26 |
| planet-class moons with no mass on EITHER path | 0 |
| plain moons carrying `composition.density` | 803 |
| planet-class moons carrying `planetData.composition.density` | 26 |

## 8. Hill-sphere occupancy

**Convention:** R_H = a_p · (M_p / (3·M_*))^(1/3); a_p = FINAL wrapper.orbitRadiusAU.
Star mass reproduced as `star.radiusSolar ** 1.25` (`StarSystemGenerator.js:386`).
⚠ The parent orbit used is the FINAL one — migration and resonance-snap rewrite
`wrapper.orbitRadiusAU` in place AFTER the moon loop, so for a migrated system this is not
the orbit the moon was generated against. Migration incidence is reported so the size of
that caveat is visible.

| quantity | value |
|---|---:|
| moons evaluated | 829 |
| moons skipped (missing input) | 0 |
| prograde moons beyond 0.4895 R_H (Domingos) | 48 |
| retrograde moons beyond 0.9309 R_H (Domingos) | 3 |
| **UNION — beyond its OWN sense's Domingos limit (the B8 number)** | **51** |
| a > 1.0 R_H (unbound) — a SUBSET of the union above | 16 |
| of those unbound, already counted in the union | 16 |

⛔ **These rows are NESTED, not disjoint — do not add them.** Because
`0.4895 < 0.9309 < 1.0`, every unbound moon is already past its own Domingos limit, so
the 16 unbound moons sit INSIDE the 51, not beside them. Summing the prograde,
retrograde and unbound rows gives 67, which is 16 moons of double-count. B8 asserts "zero moons
outside 0.4895 R_H prograde / 0.9309 R_H retrograde" — the count it must drive to zero is
**51**, and the unbound subset is a severity note on it, not an addition to it.

| further detail | value |
|---|---:|
| a/R_H  p05 / median / p95 / max | 0.00161 / 0.04773 / 0.61720 / 17.53066 |
| systems where migration occurred | 8 / 221 |
| systems with a resonance chain | 25 / 221 |

## 9. Roche-limit violations

**Convention:** PhysicsEngine.rocheLimit(rho_parent, rho_moon), fluid form, in parent radii.

| quantity | value |
|---|---:|
| moons evaluated | 829 |
| moons skipped (missing density) | 0 |
| inside Roche (a < R_roche) | 0 |
| a/R_roche  min / p05 / median / max | 2.398 / 2.700 / 8.825 / 36.675 |

## 10. Sibling-order inversions

Adjacent moon pairs (by `orbitRadiusEarth`, in generation order): **60 inverted of 321** — 18.69%.
Planets carrying at least one inversion: 53.

## 11. Regular / irregular split

⚠ There is no `regular` flag and no `retrograde` FIELD on any generated moon. Retrograde
survives only as the SIGN of `orbitSpeed`. So this is a convention, and three of them are
reported side by side rather than one being passed off as a read.

| convention | count | of | share |
|---|---:|---:|---:|
| type === 'captured' | 193 | 829 | 23.28% |
| orbitSpeed < 0 (retrograde) | 78 | 829 | 9.41% |
| either (irregular) | 193 | 829 | 23.28% |
| both | 78 | 829 | 9.41% |
| regular (neither) | 636 | 829 | 76.72% |

|abs inclination| p05 / median / p95 / max (rad): 0.0063 / 0.0627 / 0.4003 / 0.4982

## 12. Moon radius distribution (context for §4)

| population | n | min | p05 | median | p95 | max |
|---|---:|---:|---:|---:|---:|---:|
| plain | 803 | 0.0063 | 0.0147 | 0.1714 | 1.0452 | 2.6157 |
| planet-class | 26 | 0.3104 | 0.3628 | 1.1225 | 2.6398 | 2.8758 |
| combined | 829 | 0.0063 | 0.0149 | 0.1832 | 1.2344 | 2.8758 |

## 13. Disagreements with figures quoted upstream

⛔ Nothing below was adjusted to make a quoted figure come out right. Where this corpus
disagrees, the disagreement is the report.

| quantity | quoted upstream | measured on BULK-221 | verdict |
|---|---:|---:|---|
| m̄, mean moons per system (PLAN §B0) | 3.69 | 3.7511 all · 3.9289 with-planets · 4.2081 moon-bearing | **no denominator reproduces 3.69 on either corpus** |
| P(zero moons \| gas giant) (AUDIT §2) | 13.9% (10 of 72) | 13.89% | reproduces (corpus match) |
| sibling-order inversions (AUDIT §3.1) | 60 of 321 (18.7%) | 60 of 321 (18.69%) | reproduces (corpus match) |
| moons / 221 seeds (AUDIT §1) | 829 | 829 | reproduces (corpus match) |
| moons outside R_Hill outright (AUDIT §0) | 32 of 829 | 16 of 829 | **does not reproduce** |
| + "47 more" beyond 0.4895 prograde ⇒ union (AUDIT §0) | 79 | 51 | **does not reproduce** |

⭐ **The audit's corpus is not the fence's corpus.** Run `--corpus=bulk221` and all four
of its POPULATION figures reproduce exactly; run the default FENCE-221 and none of them do.
Both documents say "221 seeds". Neither corpus is wrong; quoting one's number against the
other is.

⛔ **The Hill rows are the exception, and they are a different KIND of disagreement.** The
audit's corpus is settled — BULK-221 reproduces its 948 planets, its 829 moons, its 10-of-72,
its 60-of-321, its 26 planet-class moons, and its 508 moon-bearing planets (73+435). So its
Hill figures cannot be excused as a corpus artefact: on the very corpus that reproduces
everything else it reports, "32 of 829 outside R_Hill, plus 47 more" measures **16 and 48**
here, a union of **51** against its 79. The audit states it recomputed "against final
orbits" — the convention used here — but records no formula. Swept this session and NOT
reproduced under: `M_p/(3M_*)` and `M_p/M_*`; thresholds 0.4895 → 1.0; per-moon and
per-planet denominators; primary-only and combined binary star mass. **Treat the audit's
32/47 as unsourced until someone reproduces it; the numbers above are the reproducible ones.**

