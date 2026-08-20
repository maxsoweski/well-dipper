# The 48 lab-only features — which are wireable now, which are not, and why

*Branch `feature/world-engine-production-L1`, HEAD `0809950`. Read-only run: nothing under `src/` or `tests/` was touched, no baseline re-recorded, no commit made.*

**What this document is.** `one-pipeline-two-frontends-PLAN.md:127-135` §3 splits the wiring work into three queues and assigns a letter to about 14 of the 48 lab-only features, leaving the rest — and the size of queue (c), written as "**~8 features**" — open with a tilde. This finishes that enumeration on measured evidence. It is not a new plan and it does not re-scope one; §3, §7 and the L1 plan keep their rulings, and §7 of this document lists what is already scheduled so nobody redoes it.

**Corpus for every number below: `lab-procedural-0…199` — 1517 bodies = 852 planets + 632 plain moons + 33 planet-class moons; 1160 non-gas / 357 gas by `compositionClass`.** Sol is excluded by construction and cannot validate any of this.

---

## 1. ⭐ THE HEADLINE

**21 of the 48 lab-only features are queue (a) — wire-and-it-works. Only 4 are queue (c), half of §3's feared "~8".**

That is the good news, and it is immediately qualified by the bad news:

**§3's three letters do not cover 13 of the 48, and those 13 are not a rounding error — they outnumber (b) and (c) combined.** Two blockers have no letter in §3's vocabulary:

- **5 features are blocked by a PORT DROP** — the law is healthy, the field it needs is *present on the adapter under a different name*, and the engine reads a hard zero. No bake, no world-generation, one rename. Filing these under (b) would queue them behind river and storm bakes they have nothing to do with; filing them under (c) would send them to a multi-month world-generation workstream they do not need.
- **8 features have NO DRIVER LAW AT ALL.** Their master uniform in the lab is a GUI slider multiplied by an enable flag with nothing on the other end. These are not wiring work in any amount, and (a)/(b)/(c) are each false for them.

### The partition over the 48

| category | count | definition used |
|---|---|---|
| **(a) wire-and-it-works** | **21** | §3's, verbatim |
| **(b) wire-and-it-needs-a-bake** | **4** | §3's, verbatim |
| **(c) renders-nothing-until-world-gen** | **4** | §3's, verbatim — §3 guessed "~8" |
| **(p) PORT-DROP** — ⭐ no §3 letter | **5** | law healthy; an adapter field is dropped or renamed at the seam |
| **(d) NO DRIVER LAW** — ⭐ no §3 letter | **8** | master is `knob × enableFlag`; nothing derives it |
| already shipped through the engine | 3 | F24 gas half, F25, F29 geometry |
| outside the pack frame entirely | 3 | F50 envelope · F51 rings · F53 LOD |
| **total** | **48** | |

Two features split across letters and are counted once at their primary: **F20** is (p) for its strandline half and (c) for its coastline half; **F24** is shipped for gas and (c) for the venus-class half.

### Differentiation capacity of the 21 (a) features

One criterion, applied once: **distinct master values the shipped law already emits over the 1517-body corpus.** Disjoint bins, exhaustive:

| distinct master values | count | features |
|---|---|---|
| **≥200** | **13** | F4, F5, F6, F7, F8, F9, F10, F17, F18, F22, F23, F37, F38 |
| 5–199 | 3 | F15 (76), F41 (61), F31 (11) |
| ≤4 | 5 | F26, F30, F32, F33, F40 |

**13 of the 21 already emit ≥200 distinct values.** Nine of those 13 have zero port obstacles; four sit behind one shared obstacle (§3 below). That is the number to size the differentiation block from.

⚠ **This measures LAWS, not PIXELS**, per §3's own instruction that queue-(c) items must not be measured through the renderer. "603 distinct values" is a claim about a driver, not about whether an eye can tell two bodies apart — and `uniforms.js:32` `uLevels` posterises colour to 6 levels globally, a 0.1667 quantum that sets a ceiling under every *colour* feature. Relief features are not posterize-limited. Nothing here was measured through a renderer and none of it is a substitute for Max's eyes.

---

## 2. ⛔ THE LEGEND — read this before the table, because two documents use these letters differently

This document uses **§3's** definitions and only those:

| letter | §3's definition (`one-pipeline-two-frontends-PLAN.md:131-135`) |
|---|---|
| **(a)** | wire-and-it-works |
| **(b)** | wire-and-it-needs-a-bake |
| **(c)** | wire-and-it-renders-nothing until world-gen work lands |
| **(p)** | ⭐ NEW HERE — a port drop. Not in §3. |
| **(d)** | ⭐ NEW HERE as a letter, but **the category is already named and already has a standing recommendation** — see §7. |

⛔ **`r-rows-decision-packet-2026-08-20.md:382-396` uses (a)/(b)/(c) for a DIFFERENT partition** — there (a) = WORLD GENERATION, (b) = PORT MAPPING, (c) = THE LAW ITSELF. On the letter that matters most these are near-inverses: **§3-(a) means "wire it now and it works"; r-rows-(a) means "no wiring helps."** The two documents are both correct and both live. To keep them apart, **§4 of this document names its root causes in words, never in letters.** The mapping, so the two can be read side by side:

| this document's root wording | §3 letter | r-rows letter |
|---|---|---|
| INPUT-CONSTANT (world-generation) | (c) | (a) |
| PORT-DROP (a field dropped at the seam) | *(p)* — none | (b) |
| LAW-COLLAPSE (one constant inside a shared law) | (c) | (c) |

---

## 3. THE 48-ROW TABLE

**R** = the game has its own parallel implementation Step 12 would delete. Masters are quoted as `distinct / % of the 1517 bodies where the master is exactly 0`.

| F | Feature | Queue | Measured evidence | R | Already scheduled? |
|---|---|---|---|---|---|
| **F1** | Mountains / ranges | **(p)** | `labCore.js:745` `const mountainAmp` → **200 / 22.3%**, but `labCore.js:598` `const erosion` reads `d.surfaceHistory?.erosion`, **undefined on 1517/1517**. Reconnect → **472**. `labCore.js:751` `const orogenyStrength` → **15 / 41.7%** and **0 on all 632 plain moons** (no `habitability`); reconnect → **425**. Also behind the `featureRelevant.mountains` gate (`planet-lod-lab.html:5369`). | R | erosion named as a known defect in `conditionFromBody.js` (symbol-only per §10) — the rename itself is scheduled nowhere |
| **F4** | Canyons / rifts | **(a)** | `labCore.js:775` `const chasmaDepth` → **694 / 0.0%**, 0.0280–0.2800 — never zero on any body in the corpus. One obstacle: `featureRelevant.canyons` (`planet-lod-lab.html:5376`). | | obstacle disputed — see §3.2 |
| **F5** | Scarps & faults | **(a)** | `labCore.js:794` `const scarpStrength` → **814 / 16.7%** — the highest distinct count of any master in the set. Capped at 0.12 and **at that cap on 449 (29.6%)**. Obstacle: `featureRelevant.scarps` (`planet-lod-lab.html:5381`). | | same |
| **F6** | Plateaus / tessera | **(a)** | `labCore.js:812` `const plateauStrength` → **680 / 0.0%**; `labCore.js:818` `const tesseraStrength` → **346 / 59.9%**. Two obstacles, same family (`planet-lod-lab.html:5388`, `:5393`). | | same |
| **F7** | Volcanic edifices | **(a)** ⭐ | `labCore.js:830` `const volcanismStrength` → **634 / 22.3%**, full 0–1, three independent physics inputs, **no `featureRelevant` gate**. Nonzero on 979 of 1160 non-gas. ⚠ Its companion `labCore.js:836` `const edificeMaxHeight` is at a clamp rail on **834 / 1517 (55.0%)** — see §4 root 6. | | not scheduled anywhere |
| **F8** | Lava plains & flows | **(a)** | `labCore.js:851` `const lavaCoverage` → **389 / 22.3%**; `labCore.js:857` `const lavaActivity` → **337 / 60.3%**. No relevance gate. ⛔ **Both halves are much weaker than the totals suggest — see §5, R-05.** | R | ledger R-05 rules it `accepted-loss`; scheduling reserved to Max |
| **F9** | Chaos terrain | **(a)** | `labCore.js:881` `const cryoActivity` → **227 / 78.8%**. ⛔ Nonzero on 322 bodies but **237 of those are `compositionClass` gas**; the drawable population is **85 of 1160 non-gas (7.3%)**, 47 of them icy, **0 plain moons**. | | P5 coupling chaos×cryoRidge |
| **F10** | Ridged / grooved icy | **(a)** | Shares F9's master — `uniforms.js:462` `uCryoActivity` says so in source ("read by Relief"). Same population caveat. | | ledger R-02 covers the *game* branch (66 of 341) |
| **F11** | River networks | **(b)** ⛔DNR | The old carve is retired in source; the dendritic overlay is the feature and it needs the router plus the carve-cube bake. ⛔ Gated on an unresolved architecture decision — see §7. | | §3 queue (b) + QB-3 |
| **F12** | Deltas & fans | **(b)** ⛔DNR | Spatially gated by the F11 carve; dormant until it runs. Its law also recovers with the erosion rename (**24 → 163**), but that does not unblock it. | | §3 queue (b) + QB-3 |
| **F13** | Outflow channels | **(p)** ⭐ | `planet-lod-lab.html:2166` `state.outflowDensity` → **1 distinct / 100.0% zero** today. Reconnect erosion → **19 / 52.4%**. Dead to live on one field name, no bake, no world-gen. **The cheapest unblock in the set.** | | not scheduled |
| **F14** | Lakes & seas | **(c)** | `_wet` (`liquidStability > 0.15`, `labCore.js:658`) fires on **78 of 1517** — but **65 are gas**, leaving **13 of 1160 non-gas (1.1%)**, all `icy`, and **0 rocky-class and 0 ocean-typed bodies anywhere**. | R | ledger R-06 — ⛔DNR |
| **F15** | Dunes & wind forms | **(a)** | `planet-lod-lab.html:2187` `state.duneDensity` → **76 / 41.7%**, but **saturated at 1.0 on 754 (49.7%)** — the ramp's high edge is 0.3 bar against a corpus running 0.105–1000 bar. Renders; barely differentiates. | | not scheduled |
| **F16** | Dust mantles | **(p)** | `planet-lod-lab.html:2203` `state.dustDepth` → **34 / 65.2%** → **173** with the erosion rename. | | ledger R-01 `accepted-loss` records the carriers exist unwritten |
| **F17** | Glacial landforms | **(a)** | `labCore.js:953` `const glacialStrength` → **364 / 69.7%**. Input `volatileFraction` is the widest-spread field in the vector. No relevance gate. | | P5 coupling glacial×lakes/frost |
| **F18** | Sublimation | **(a)** | `labCore.js:942` `const subStrength` → **463 / 58.5%**, plus a 5-way `volatileSpecies` switch — a *categorical* differentiator, rarer than an amplitude one. No relevance gate. | | QB-5 is a lab *method* item, orthogonal |
| **F19** | Mass-wasting | **(d)** | `planet-lod-lab.html:2218` `state.massWastDensity` is the literal `1.0`. Measured: **1 distinct value on 1517/1517**. There is nothing to wire. | | QB-4 — ⛔DNR: "F19 needs a lab-side render gate before any wiring" |
| **F20** | Coastlines | **(p)** + (c) | `planet-lod-lab.html:2157` `state.strandStrength` → **1 / 100.0%** → **299 / 0.0%** with the rename ⇒ **(p)**. `planet-lod-lab.html:2156` `state.coastStrength` → **2 / 94.9%**, inherits F14 ⇒ **(c)**. **The two halves are separable and should not be scheduled together.** | | R-06 covers the coast half only |
| **F21** | Karst / dissolution | **(p)** | `planet-lod-lab.html:2175` `state.karstDensity` → **23 / 94.9%** → **197 / 41.7%** with the rename. | | P5 couplings karst×lakes, karst×rivers |
| **F22** | Polar caps & frost | **(a)** ⛔DNR-letter | `labCore.js:925` `const pldStrength` → **548 / 53.6%**. ⚠ §7's "F22/F23 also need `habitability` and a numeric seed" does not apply to this master — it reads neither. Its real gap is moon-shaped: `habitability` is absent on all 632 plain moons. | R | §3 already assigns (a) — cite, don't re-derive |
| **F23** | Snowline / frost | **(a)** ⛔DNR-letter | `labCore.js:904` `const frostMaxCoverage` → **567 / 51.0%**. | | §3 already assigns (a) |
| **F24** | Zonal belts | **SHIPPED (gas)** · venus half **(c)** | giantDeck ships the gas half. Venus half: `convectiveVigor` is exactly **1.000 on 134/134** co2 bodies, and the selector `atmosphere.composition === 'co2'` is written from `type === 'venus'` at `PhysicsEngine.js:149` `composition:`. Two gates key on `=== 'gas'`: `drivers/index.js:100` `applies:` and `giantDeck.js:163` `const gas`. | R | ledger R-07 **and L1 WS3 F3 has done-criteria** — ⛔DNR |
| **F25** | Jets & shear | **SHIPPED (gas)** | `giantDeck.js:179` `uJetStrength:` is `scalar(gas ? 1.0 : 0.0)` — ≡ 1.0 on all 357 gas bodies. A dead wire, not an unwired feature. | R | ⛔DNR |
| **F26** | Latitude weather bands | **(a)†** | `planet-lod-lab.html:2343` `state.weatherStrength` → **4 / 65.2%**. † The four values are a lookup on `atmosphere.composition` — a type label on 40.9% of atmospheres. ⭐ **NOT unknown: Max's ruling 3 (`one-pipeline-two-frontends-PLAN.md:609`) resolved the doc/ID question — built in the lab, absent from the game.** §3's "UNKNOWN: 1" headline predates that ruling. | | ⛔DNR the ID question |
| **F27** | Great-spot anticyclone | **(b)** ⛔DNR | Producer is the fenced `applyStormState`, plus the `aStorm` vertex attribute — `LabPlanetMaterial.js:37` `export const LAB_ATTRIBUTES` zero-fills it. ⛔ Gated on the same architecture decision as F11/F12 — §7. | R | §3 (b) + §7 fence + ledger G-02 |
| **F28** | Storm clusters | **(b)** ⛔DNR | Same producer, same attribute, same fence. | | same |
| **F29** | Polar vortex | **SHIPPED (geometry)** · master **(b)** | polarDeck ships the eight-name `uPolar*` family. But `planet-lod-lab.html:1911` `state.polarStrength` lives **inside** the fenced storm producer, so the master gate is on the wrong side of the fence. | R | ledger G-03 records the residue — ⛔DNR |
| **F30** | Lightning | **(a)†** | `planet-lod-lab.html:2370` `state.lightningStrength` → **4 / 41.7%**. Same type-label caveat as F26. | | P5 coupling lightning×dustStorm |
| **F31a–f** | Cloud / haze family | **F31b SHIPPED** · rest **(a)†** | `cloudCoverage` **11 / 41.7%**; `planet-lod-lab.html:2421` `state.hazeMute` **2 / 80.3%**; `cloudRegime` **4 / 62.1%** and keys on `composition` — the type label again. | R | P-06/M-05 (no cloud-COLOUR uniform) `accepted-loss`; QB-9, QB-13 |
| **F32** | Dayside thermal hotspot | **(a)** | `planet-lod-lab.html:2438` `const _hotJup` → **2 / 97.4%**; fires on **39 of 1517 (2.6%)**. `uDayTempK` itself is live (1059 distinct). | R | ledger G-05 `accepted-loss` (5 of 341) |
| **F33** | Nightside thermal glow | **(a)** | Same 39-body gate; on those 39 the value is the **literal 1100 K on all 39**. Renders; differentiates nothing. | R | ledger G-05 |
| **F36** | Sunglint | **(c)** | `specStrength` is genuinely live (**1410 distinct / 0.0% zero**, 0.022–0.800) — but the glint is spatially gated by `uLiquidMask`, which is F14, which fires on 13 of 1160 non-gas. | | QB-8 — ⛔DNR, and **must not be scored through a renderer** |
| **F37** | Aurorae | **(a)** | `planet-lod-lab.html:2613` `state.auroraIntensity` → **603 / 53.5%** once `planet-lod-lab.html:2637` `if (_cloudRegime === 3)` is applied (true on all 134 venus-class bodies). 103 of the 706 nonzero values sit at the literal 0.600 `_giantDynamo` floor. ⛔ **0 nonzero on all 632 plain moons** — `atmosphere` is absent, and `labCore.js:1045` `auroraIntensity:` multiplies the field by `hasAtmo`. | R | ledger P-05: "reduces to forwarding four values… no ruling from Max is owed" — ⛔DNR the law question |
| **F38** | Airglow limb band | **(a)** | `planet-lod-lab.html:2662` `state.airglowIntensity` → **525 / 41.7%**. Obstacle: `featureRelevant.airglow` (`planet-lod-lab.html:5064`). ⚠ Any claim that it "never reaches 0" is stale — it is exactly 0 on the 632 airless plain moons. | | Max overrode the drop 2026-06-13 — BUILD |
| **F39** | Cloud optics | **(d)** | `planet-lod-lab.html:5073` `uCloudOpticsIntensity` = `state.cloudOpticsIntensity` (a GUI knob, default 0.7) × a cloud-presence term × relevance. The *presence* gate is derived; **the intensity has no law**. Closest of the eight to being one law away. | | Max overrode the drop 2026-06-13 |
| **F40** | Dust storms | **(a)** | `planet-lod-lab.html:2681` `state.dustActivity` → **2 / 88.1%**; fires on **181 bodies at the literal 0.55 on all 181**. | R | P5 coupling dustStorm×dust |
| **F41** | Hemispheric magma ocean | **(a)** | `planet-lod-lab.html:2703` `state.magmaSeaAngle` → **61 / 96.0%**. Small population (60 bodies) but genuinely varying within it. No relevance gate. | | not scheduled |
| **F42** | Carbon-world crust | **(c)** | Gate is `C:O > 0.8`; measured corpus maximum is **0.78533 on 1517/1517**, so the master is **1 distinct / 100.0% zero**. It misses by **0.015**. The palette's own endmember gate is at 1.0 — two different thresholds for one quantity, both unreachable. | R | r-rows §4 degeneracy 1 — ⛔DNR |
| **F43** | Crystalline facet field | **(c)** | `planet-lod-lab.html:2752` `state.facetStrength` requires four legs ANDed. Measured shares TRUE over 1517: airless **632**, erosion<0.05 **1517**, **resurfacingRate<0.05 — 0**, bombardment<0.2 **1407**. The binding leg is resurfacing, floored unconditionally at 0.1 by `PhysicsEngine.js:818` `const resurfacing`. **1 distinct / 100.0% zero.** ⚠ §3/§7 attribute this to `retained === false`; that clause is separately dead but is **not** what closes F43. | R | ledger R-04 `accepted-loss`; QB-11 |
| **F44** | Hexagonal crust | **(d)** | `planet-lod-lab.html:5280` `uniforms.uHexStrength` = `hexTessEnabled ? featureRelevant.hexTess : 0.0`. The lab says it in source at `planet-lod-lab.html:5277`: *"NO driver derivation (no preset) — uHexStrength is purely the enable."* | R | ⭐ already carved out — §7 |
| **F45** | Shattered crust | **(d)** | Same shape; `uniforms.js:99` records "pure enable gate… no preset, no driver". | R | ⭐ already carved out — §7 |
| **F46** | Bioluminescent mats | **(d)** | `planet-lod-lab.html:5077` `uniforms.uBioCoverage` = `bioCoverage` (knob 0.45) × `habGate`. ⛔ **§3's stated blocker does not hold at HEAD** — see §4 root 5. The real blocker is that the coverage scalar has no law. | R | ⭐ already carved out — §7; QB-12 |
| **F47** | Machine surface | **(d)** | `planet-lod-lab.html:5301` `uniforms.uMachCoverage` = knob 0.6 × `habGate` × relevance. | R | ⭐ already carved out; QB-12 |
| **F48** | City lights | **(d)** | `planet-lod-lab.html:5311` `uniforms.uCityMaturity` = knob 0.5 × `habGate`. | R | ⭐ already carved out; QB-12 |
| **F49** | Ecumenopolis | **(d)** | `planet-lod-lab.html:5318` `uniforms.uEcuCoverage` = knob 0.85 × `habGate`. | R | ⭐ already carved out; QB-12 |
| **F50** | Posterize + Bayer | **envelope, no queue** | `uniforms.js:32` `uLevels` is the global constant 6.0, identical on both sides, written by no pack. It is the **ceiling** on colour differentiation, not a candidate for it. | R | r-rows §4 — ⛔DNR |
| **F51** | Rings | **outside the pack frame** | Not a planet-material uniform. `RingRenderer.js` is constructed nowhere in `src/`. | R | QB-14 — ⛔DNR |
| **F53** | Close-up LOD2 detail | **outside the pack frame** | `lodLevel` is read by no shader (ledger P-17 / M-10). The live half is Max's 2026-08-10 approach-detail criterion, which is a different workstream. | ◑ | ⛔ **no step in the plan of record schedules it** |

---

## 4. ⭐ THE (a) LIST, ORDERED — this is the next block

**Ordering criterion, named.** Primary key: **number of port obstacles between the shipped law and a driver pack**, where an obstacle is a `state.featureRelevant.X` preset-name allowlist with no game analogue, a required bake, or the `d.seed` axis collapse. Secondary key within a tier: **distinct master values over the 1517-body corpus.** Obstacle count *is* the effort; distinct count *is* the differentiation, so this orders by differentiation per unit of work. It deliberately does not reward a feature for being cheap if it emits two values.

The three tiers are disjoint and cover all 21: **9 + 4 + 8 = 21.**

### Tier 1 — zero obstacles, ≥200 distinct. A pack today, nothing else needed. (9)

| # | F | distinct / zero% | note |
|---|---|---|---|
| 1 | **F7 Volcanic edifices** | **634 / 22.3%** | Widest reach of any obstacle-free master: nonzero on 979 of 1160 non-gas, full 0–1, three independent inputs, scheduled by nothing. ⚠ carries the `edificeMaxHeight` rail (§5 root 6). |
| 2 | **F37 Aurorae** | **603 / 53.5%** | Ledger P-05 already proved the port is "forwarding four values". ⛔ **0 on all 632 plain moons.** |
| 3 | **F23 Snowline / frost** | **567 / 51.0%** | Driven by `volatileFraction`, the widest-spread field in the vector. §3 already calls it (a). |
| 4 | **F22 Polar caps** | **548 / 53.6%** | Same input family. Fires on 297 of 632 plain moons — one of the few Tier-1 picks that does. |
| 5 | **F18 Sublimation** | **463 / 58.5%** | Plus a 5-way species switch: categorical, not just amplitude. |
| 6 | **F8 Lava plains** | **389 + 337** | Two masters. ⛔ **Read §5 R-05 before scheduling this one — both halves are weaker than the totals.** |
| 7 | **F17 Glacial landforms** | **364 / 69.7%** | Nonzero on 260 of 1160 non-gas, including 219 plain moons. |
| 8 | **F9 Chaos** | **227 / 78.8%** | ⛔ Drawable population is **85 of 1160 non-gas**, 0 moons. See the caveat below. |
| 9 | **F10 Ridged icy** | shares F9's master | Same one master unblocks both — but on the same 85 bodies. |

⚠ **Three of these nine are identically zero on all 632 plain moons — the exact population whose UAT Max passed with "these are all identical".** Measured, on 632/632 plain moons: F37 `auroraIntensity` 0 nonzero / 1 distinct, F8 `lavaActivity` 0 / 1, F9+F10 `cryoActivity` 0 / 1. Causes, all measured on the moon record: `atmosphere` absent on 632/632 (so `labCore.js:1045` `auroraIntensity:` multiplies by `hasAtmo` = 0); `eccentricity` absent on 632/632, and `labCore.js:611` recomputes tidal heat from eccentricity rather than reading the forwarded `tidalHeat`, so the tidal proxy is 0 and both `lavaActivity` and `cryoActivity` go with it. **Packing ranks 2, 6 and 8 first and re-running the moon UAT would produce 632 byte-identical moons on all three, while every driver Max would be pointed at measures healthy over the pooled corpus** — the unattributable failure §3 warns about. `eccentricity` is a fifth dropped field, and it is a generator-side absence rather than a rename — ⭐ **already scheduled as `world-engine-production-L1-plan.md:90` F2 · Compute orbital eccentricity**, blast LOW if data-only, and a hard prerequisite of WS1 F1 above. ⛔ Do not re-scope it; **do** note that WS1 F1+F2 is the cheapest known fix for three of the nine Tier-1 picks being dead on every moon.

⚠ **F9/F10's 227-distinct figure is manufactured on bodies that cannot draw it.** `cryoActivity` is nonzero on 322 bodies, but 237 of those are `compositionClass` gas — claimed by giantDeck/limbDeck/polarDeck, not rockySurface — and chaos terrain and grooved icy crust are surface relief that cannot render on an h2-he envelope. The population that could draw it is **85 of 1160 non-gas (7.3%)**, of which 47 are icy. It is still the best two-for-one in the tier; it is not a 322-body feature.

⚠ **"zero%" counts exact 0.0 only, and these laws emit arbitrarily small nonzero values.** Share of the 1517 whose master rounds to 0.000 at three decimals: F8 `lavaActivity` **74.0%** (vs 60.3% reported), F22 `pldStrength` **64.7%** (vs 53.6%, and its maximum is 0.315 so the residual is under 0.16% of full scale), F18 `subStrength` **63.2%** (vs 58.5%), F23 `frostMaxCoverage` **58.1%** (vs 51.0%), F9/F10 `cryoActivity` **82.7%** (vs 78.8%), F17 `glacialStrength` **70.2%** (vs 69.7%). The discount term in the ordering criterion is overstated by 5–14 points, unevenly across ranks.

### Tier 2 — ONE shared obstacle, ≥200 distinct. Solve it once, unblock five. (4 in (a), plus F1 from (p))

| # | F | distinct / zero% |
|---|---|---|
| 10 | **F5 Scarps** | **814 / 16.7%** — highest in the whole set |
| 11 | **F4 Canyons** | **694 / 0.0%** — never zero on any body in the galaxy |
| 12 | **F6 Plateaus / tessera** | **680 / 0.0%** and **346 / 59.9%** — two masters |
| 13 | **F38 Airglow** | **525 / 41.7%** — same allowlist, unrelated family |
| (+) | **F1 Mountains** | **200 → 472** — needs the erosion rename too, so it trails its siblings |

**The obstacle is `state.featureRelevant.X`, a preset-name allowlist with no game analogue.** Measured: it gates **12 render uniforms** in the lab (`planet-lod-lab.html:5064` `uAirglowIntensity`, `:5073` `uCloudOpticsIntensity`, `:5200` `uPolarStrength`, `:5280` `uHexStrength`, `:5289` `uShatStrength`, `:5301` `uMachCoverage`, `:5354` `uCraterDensity`, `:5369` `uMountainAmp`, `:5376` `uChasmaDepth`, `:5381` `uScarpStrength`, `:5388` `uPlateauStrength`, `:5393` `uTesseraStrength`).

⚠⚠ **The counter-example to "solve it once" is already written, and this tier must be scoped against it rather than around it.** The template usually cited is `bombardment.js:220` `export function craterRelevanceOf(condition) {`, which the lab adopted at `planet-lod-lab.html:2834` `state.craterRelevance` and `rockySurface.js` imports. But `r-rows-decision-packet-2026-08-20.md:578-593` already ran that argument to the end: *"The one family that has all three (craters) is the warning: its predicate is condition-derived and still takes only two values, and two numeric floors downstream turned it into a moon-only feature anyway. **Porting a family correctly and having it render on a useful population are two different jobs.**"* And `one-pipeline-two-frontends-PLAN.md:578` prices the migration independently as *"a physics-authoring job across ~12 features, not a mechanical port"*. **Porting F4/F5/F6/F1/F38 on the crater template could reproduce the crater outcome on five more families at the cost of the largest workstream in this list.** That risk is real and it is not priced here; what *is* measured is that the five laws upstream of the gate emit 200–814 distinct values, which craters' predicate does not.

⚠ **The ownership of that one obstacle is unassigned, and two documents dispose of it oppositely.** `one-pipeline-two-frontends-PLAN.md:578` fences the `featureRelevant`/`rendersOn` migration out as "a named follow-on"; `world-engine-production-L1-plan.md:181` **F2 · Replace `rendersOn` allowlists with driver-threshold gates** schedules it as a HIGH-blast workstream *with* an incremental strategy ("keep `rendersOn` as a derived-and-asserted equality check, flip only when derived == declared, then delete the hand list") and a done-criterion at `:194`. Same site, opposite dispositions. **Tier 2 cannot start until Max names the owner.**

### Tier 3 — renders, but sorts the galaxy into a handful of buckets. (8)

F15 dunes (76 distinct but saturated at 1.0 on 49.7%) · F41 magma ocean (61, on 60 bodies) · F31 clouds (11 and 4) · F26 weather bands (4) · F30 lightning (4) · F32 dayside thermal (2, on 39 bodies) · F33 nightside glow (2, literal 1100 K) · F40 dust storms (2, literal 0.55 on 181).

⚠ **F26, F30 and F31 all key on `atmosphere.composition`, which `PhysicsEngine.js:149` `composition:` writes from the `type` label for four types.** Measured: **491 of 885 atmospheres (55.5%) carry a type-written composition**, and 362 of them sit on three hardcoded pressure literals from `PhysicsEngine.js:150` `pressure:`. Wiring these three differentiates by type name — which `drivers/index.js:19` forbids across the seam in capitals.

### ⛔ What this ordering does NOT contain, and must be read alongside

**Option C — the differentiation option already written and recommended — shares zero items with the list above.** `r-rows-decision-packet-2026-08-20.md:564` is *"Option C — Differentiation push: two crater floors, a hue-moving palette input, unpin `uNoiseScale`"*, and `:596` recommends *"A now, then C, with D as the ceiling, B last"* under a named criterion. Two of its three items are absent from every tier here because they are not lab-only features:

- **`uNoiseScale`** — `uniforms.js:10` `uNoiseScale` is the factory default 4.0, written by neither side (`grep -c uNoiseScale planet-lod-lab.html` = 0). Ruled `blocking` twice (ledger P-10, M-09) against a legacy range 4.83–510.6 on 632 moons with 0 of 632 equal to 4.0. **Max's own scheduling ruling is already given — "a characteristic wavelength in km, AFTER moons ship" — and moons shipped at Step 10a.** r-rows measures it as the single largest differentiation win in the corpus (254 → 371 distinct signatures; largest bucket 9.8% → 5.3%). It is not in this document's tiers and its ruling is currently expiring unexecuted.
- **The palette law** — r-rows §4 measures it as "the biggest single reason the discs look alike" (a 25° hue slice; `uCratonColor === uWeatheredColor` on 73.6% of 1156 and 100% of plain moons).

**Shipping Tier 1 without them leaves terrain frequency identical on every body in the galaxy and the disc one posterised tone** — r-rows §4 states that outcome in capitals. The two lists are complements, not alternatives, and this document does not rank them against each other.

---

## 5. THE ROOTS, BY LEVERAGE — named in words, never in letters (see §2)

One degenerate field feeding six features outranks six fields feeding one. Each root is labelled by **who owns the fix**, not by a queue letter.

### ⭐⭐ ROOT 1 — `surfaceHistory.erosion` is dropped at the seam. **PORT-DROP. The highest-leverage line in this report.**

`labCore.js:598` `const erosion` reads `d.surfaceHistory?.erosion` → **undefined on 1517/1517**. The field that *is* present is `erosionLevel` — **299 distinct values, 0.003–1.000, on 1517/1517**. Already declared as a named known defect in `conditionFromBody.js` (symbol-only per §10's convention for that file).

**Measured counterfactual. The only change is `surfaceHistory.erosion := surfaceHistory.erosionLevel`:**

| master | F | HEAD distinct / zero% | FIXED distinct / zero% |
|---|---|---|---|
| `strandStrength` | F20 | **1 / 100.0%** | **299 / 0.0%** |
| `outflowDensity` | F13 | **1 / 100.0%** | **19 / 52.4%** |
| `rayBrightness` | F3 | 2 / 58.3% | 161 / 58.3% |
| `karstDensity` | F21 | 23 / 94.9% | 197 / 41.7% |
| `dustDepth` | F16 | 34 / 65.2% | 173 / 65.2% |
| `deltaDensity` | F12 | 24 / 94.9% | 163 / 41.7% |
| `chasmaDepth` | F4 | 694 / 0.0% | 1201 / 0.0% |
| `plateauStrength` | F6 | 680 / 0.0% | 1176 / 0.0% |
| `scarpStrength` | F5 | 814 / 16.7% | 970 / 16.7% |
| `tesseraStrength` | F6 | 346 / 59.9% | 514 / 59.9% |
| `mountainAmp` | F1 | 200 / 22.3% | 472 / 22.3% |
| `orogenyStrength` | F1 | 15 / 41.7% | 425 / 55.4% |

**Twelve masters across eleven features (F1, F3, F4, F5, F6, F12, F13, F16, F20, F21 and F6's second master) move on one field name. Two go from 100%-dead to live.** Nothing else here has that ratio.

⚠ **It is not monotonically positive.** `erosionLevel < 0.05` on only 144 of 1517, so reconnecting it *narrows* F43's erosion leg from 1517 to 144. F43 stays dead either way (its resurfacing leg is 0/1517), but any other law with a `< threshold` erosion clause should be re-measured, not assumed to improve.

⚠ `conditionFromBody.js` deliberately declines this fix because it "MOVES NUMBERS" inside an additive step whose gate asserts nothing moved. **So it needs its own commit and its own delta table, on the Step 2 precedent — not a ride-along.**

### ROOT 2 — `liquidStability`: a three-gate conjunction, and only one of the three is a law problem

Feeds F14, F20-coast, F21, F11, F12, F36 — **six features.** Decomposed over the 1160 non-gas bodies:

| gate | distinct | ==0 | ==1 | strictly between | owner |
|---|---|---|---|---|---|
| `retentionGate` | **4** | 54.5% | 45.3% | **0.2%** | **INPUT-CONSTANT (world-gen)** — binary by record class: `atmosphere` present on 852/852 planets, 0/632 plain moons |
| `volatileGate` (`labCore.js:645`) | 279 | 57.5% | 18.1% | **24.4%** | **LIVE** — the one healthy gate |
| `tempWindow` | 116 | 67.4% | 20.4% | 12.2% | **LAW-COLLAPSE** — two narrow windows (273–373 K, 90–112 K) against an orbital T distribution |
| **product** (`labCore.js:658`) | **32** | **96.6%** | 0.9% | 2.6% | |

⭐ **CORRECTION.** R-06's evidence attributes the ocean worlds' zero to `volatileFraction` falling under `volatileGate`'s 0.05 dry floor. That is true of those bodies — measured over the 9 ocean-typed bodies in this corpus (6 planets + 3 planet-class moons), `liquidStability` is 0.0000, 0.0081, 0.0008 and 0.0000 ×6. **But corpus-wide it is not the binding constraint**: `retentionGate` is binary-by-record-class and `tempWindow` is zero on 67.4%. Raising the volatile floor alone moves nothing.

### ROOT 3 — `atmosphere` presence ≡ "is this a planet record". INPUT-CONSTANT (world-gen).

852/852 planets carry one; **0/632 plain moons do**; 33/33 planet-class moons do. **Zero within-class variance.** Reaches F35, F38, F3-rays, F15, F16, F26, F30, F43, F37, and `retentionGate` above. ⛔ Already diagnosed end-to-end in `lab-pipeline-into-game-PLAN.md` (three stacked `computeAtmosphere` defects behind a mandatory stream-safety commit) — ⛔DNR.

### ROOT 4 — `atmosphere.composition` and `.pressure` written from the `type` label. INPUT-CONSTANT (world-gen), ALREADY SCHEDULED.

`PhysicsEngine.js:145` `if (type === 'gas-giant'` is a four-type early return; `:149` `composition:` and `:150` `pressure:` hardcode both from the label. **491 of 885 atmospheres (55.5%) are type-written; 362 sit on three pressure literals.** Reaches F16, F24, F26, F30, F31, F32, F33, F34. ⛔ Scheduled with done-criteria as L1 WS3 F3 — ⛔DNR.

### ROOT 5 — `habitability` means two different things on the two sides. ⚠ AND THE OBVIOUS FIX IS ALREADY RULED AGAINST, TWICE, IN SOURCE.

Lab: an authored per-preset constant. Game: `habitabilityScore()` (`PhysicsEngine.js:639` `export function habitabilityScore(params) {`), an additive physics tally. Measured `habGate` (`planet-lod-lab.html:1973` `state.habGate`, edges 0.1/0.4) over 1517: **`1.0 × 877` · `0.0 × 632` · `0.926 × 8`**.

⭐ **This inverts §3's stated blocker.** §3 and §7 both name `habGate ≡ 0` as a queue-(c) degeneracy. On the game corpus it is **≡ 1 on 877 of 1517 (57.8%)** — including **356 of the 357 gas bodies**. The gate is not stuck closed; it is stuck open, and the lab's own comment at `planet-lod-lab.html:1970` names the cost.

⛔⛔ **But routing F46–F49 through `condition.habitability` is already ruled against and the ruling post-dates Step 1.** `surfaceMaterial.js:125` `habitability` states it: *"⚠ NOT keyed on the preset's `habitability` field, deliberately… keying on it would (a) smuggle an authored number into a physics-derived chain and (b) make vegetation seed-INVARIANT… ⭐ CORRECTED 2026-08-06… `condition.habitability` now exists. The DECISION is unchanged… the field is now REACHABLE and still deliberately NOT read."* And `r-rows-decision-packet-2026-08-20.md` §4 reports the wired sibling is dead anyway — `biosphereOf` is exactly 0 on 97.9% of 1156.

**So this root is a correction to the record, NOT a proposed fix.** F46–F49's blocker is that their coverage scalars are lab knobs with no law (§3's (d) column); reconnecting habitability would not render them and would re-introduce a defect the module rejected twice. ⚠ Two documents dated 2026-08-20 give opposite verdicts on this named §7 degeneracy and neither reconciles them; this one measures the gate and defers the reconciliation.

### ROOT 6 — `massEarth` is absent by design while `deriveUniforms` ignores the correct `surfaceGravity` that IS there. PORT-DROP, but ⚠ NOT differentiation leverage.

`conditionFromBody.js` deliberately omits `massEarth` (its own header, line 15: *"`massEarth` reaches the condition vector only through surfaceGravity (g = M/R²); the engine never reads mass directly"*) and supplies a correct `condition.surfaceGravity` — **1515 distinct, 0.0036–2.07 g**. But `labCore.js:610` `const massEarth` is `d.massEarth ?? 1.0` — measured **0 of 1517 carry it**, so every body is given Earth's mass — and `labCore.js:611` `const surfaceGravity` recomputes from it, never reading `d.surfaceGravity`. Measured: recomputed g runs **0.0054 … 17 864**, median ratio to the correct value **8.3×**, wrong by more than 10× on **945 of 1517 (62.3%)**.

It reaches F2, F7, F15, F17 and F9. Concretely, `labCore.js:836` `const edificeMaxHeight` is pinned at a clamp rail (0.2 or 2.0) on **834 of 1517 (55.0%)**.

⚠ **Honest counterweight, measured: substituting the correct `condition.surfaceGravity` moves the rail share to 904/1517 (59.6%).** This is a **physical-correctness** root, not a differentiation one. ⛔ Do not schedule it as a second Root 1.

### ROOT 7 — `resurfacingRate` has a generator floor of 0.1 against a gate at `< 0.05`. LAW-COLLAPSE, one constant, one feature. ⛔ ALREADY SCHEDULED.

`PhysicsEngine.js:818` `const resurfacing` floors it unconditionally at 0.1; measured minimum **0.1 on 1517/1517**. F43's facet class is TRUE on **0 of 1517**. The cheapest root in the set, and it also drives ROOT 8.

⛔ **Both this root and ROOT 8 are already owned.** `world-engine-production-L1-plan.md:86` **F1 · Un-zero D12 tidalHeating** — *"it's dead in **both** planets AND moons (`MoonGenerator` never calls it) — fix both. Needs F2 first (eccentricity is arg 1)."* — and its own blast note names the consequence: *"changes `surfaceHistory.resurfacing`, which renderers already read → some bodies will look different."* That is exactly the quantity ROOT 7 and ROOT 8 are about. ⛔ Do not re-scope it.

### ROOT 8 — `resurfacingRate` takes exactly TWO values on planets. INPUT-CONSTANT. ⛔ ALREADY SCHEDULED (WS1 F1, see ROOT 7).

Measured over the 852 planets: `{0.1 × 630, 0.3 × 222}` — because `PhysicsEngine.js:818`'s `tidalHeatingRate` term is 0 for planets, leaving only the `ageGyr < 3` branch. Plain moons get 316 distinct values. **This is what caps F8 — see §6.** The `tidalHeatingRate` term is 0 for planets precisely because `world-engine-production-L1-plan.md:86` F1's subject is hard-zeroed, so un-zeroing it moves this root and R-05's payoff together.

### ROOT 9 — `carbonToOxygen` maximum 0.78533 against a gate at 0.8. INPUT-CONSTANT (world-gen range).

Reaches F42 plus the palette's `CARBON_CRUST` endmember, whose own gate is at 1.0. ⛔DNR the measurement (r-rows §4).

### ROOT 10 — `d.seed` never reaches `deriveUniforms`. PORT-DROP.

Collapses `orogenyAxis`, `chasmaAxes`, `chasmaCount`, `scarpAxis`, `tesseraAxes`, `lavaAxis`, `cryoRidgeAxes` to **one value each over 1517** — every planet rifts along the same great circles. Reaches F1, F4, F5, F6, F8, F10. `ctx.macroSeed` already exists and giantDeck already consumes it. ⛔DNR the diagnosis (`lab-pipeline-into-game-PLAN.md`).

---

## 6. WHERE R-05 / R-06 / R-07 LAND — Max ruled all three get wired; the queue letter answers *when*

| row | feature | queue | when, and why |
|---|---|---|---|
| **R-05** | **F8 lava** | **(a)** | **Wireable now — no bake, no allowlist, no world-gen dependency.** ⛔ **But the payoff is much smaller than the 389/337 headline.** Measured on the 852 planets: `lavaCoverage` is 0.000 on 167, **0.100 on 434**, **0.300 on 152** — **753 of 852 (88.4%) on three values**, with a planet maximum of **0.3000**, not 1.0. Root: `labCore.js:851` `const lavaCoverage` is `clamp01(resurfacing) × rockyCrust`, and resurfacing takes exactly two values on planets (ROOT 8). The 389-distinct figure comes almost entirely from the 632 plain moons (288 distinct) — **the same moons on which the emissive companion `lavaActivity` is 0 nonzero / 1 distinct.** So wiring R-05 today gives every planet one of three flood-basalt looks and no glow on any moon. The ledger's `accepted-loss` ruling is about a *different parameterisation*, which is a reason not to call this "restoring a loss" and no reason to defer it — but **ROOT 8 is already scheduled as WS1 F1+F2 (`world-engine-production-L1-plan.md:86`, `:89`) and changes what this buys**. Sequencing R-05 after it, rather than before, costs nothing and is the difference between three flood-basalt looks and a continuum. |
| **R-06** | **F14 / F20 seas + coasts** | **(c)**, and **split** | Wire it whenever — it costs little — but measured it renders a sea on **13 of 1160 non-gas bodies (1.1%)**, all icy, and on **zero rocky-class and zero ocean-typed bodies**. F20-coast rides it; F36 sunglint is downstream of the same mask. ⭐ **F20-strand is separable and is a PORT-DROP: 1 → 299 distinct on the Root-1 rename alone. Take that half now.** |
| **R-07** | **F24 on venus-class solids** | **(c)** | **After L1 WS3 F3.** Two gates key on `=== 'gas'` (`drivers/index.js:100` `applies:` and `giantDeck.js:163` `const gas`), and the selector field itself is a type label (`PhysicsEngine.js:149` `composition:`). `convectiveVigor` is exactly **1.000 on 134/134** co2 bodies, so even with both gates widened the whole class gets one band tuple. **The gate exists; the field does not.** Its root cause already has a scheduled workstream with done-criteria — ⛔ do not re-scope it. |

⚠ **Corpus note on R-07's control.** `atmosphere.composition === 'co2'` is true on **134 bodies over `lab-procedural-0…199` — 130 planets plus 4 planet-class moons — and all 134 are type `venus`.** `convectiveVigor` is 1.000 on all 134, so the substantive claim holds; the commonly quoted "130/130" is a planets-only denominator and should be written as such.

---

## 7. ⭐ MAX'S RULE 2 — is "anything new feeds back into the lab" enforced today?

**Partly, in one direction, with a hole that is exactly the shape of the thing Rule 2 forbids.**

**The lab direction IS ratcheted.** `tests/lab-surface-ratchet.test.js` is a shrink-only ratchet: a new *lab* feature authored the old way inside `applyDrivers()` + `frame()` fails the build, and it closes the helper-hop escape (a write moved one function up, measured 2026-08-10, defeated an earlier version). That enforces "new lab features become packs". **It says nothing about the game.**

**The game direction is only half-covered.** `tests/material-parity-list.test.js` derives the live-branch set from the population and asserts every measured subject is claimed by exactly one ledger row — so *"a new hardcoded effect in the legacy shader"* is caught, by that file's own list of what it does and does not see. **But the remedy the fence demands is a ROW, not a lab feature.** `step6-parity-ledger.md:97` defines `accepted-loss` as *"the feature stops reaching the pixel and closing it is real work (no lab mechanism, or a producer the plan has already fenced out of pack #1)"* — one ruling covering two different facts. R-05 is ruled `accepted-loss` while the lab **does** have the mechanism (differently parameterised); P-01 is ruled `accepted-loss` because the lab has **nothing**. **So today there is no number, anywhere, for "features the game has and the lab lacks" — which is precisely the quantity Rule 2 caps at 1 (F52, Max's admitted exception).**

Two further gaps, both named in the suites' own limits: a feature implemented inside a GLSL helper with no named local is invisible to the extractor, and nothing fires for a body class outside the swapped population.

### The smallest gate that would make Rule 2 a checked fact

**Split `accepted-loss` into two rulings and count one of them.** Today's three rulings become four: `carried`, `blocking`, `accepted-loss-lab-has-it` (the lab has a mechanism, differently parameterised — R-05's case), and `accepted-loss-lab-lacks-it` (P-01's case). Then one assertion: **the count of `accepted-loss-lab-lacks-it` rows is ≤ 1, and the one permitted row is F52.**

Why this is the smallest thing that works, rather than a new instrument: the ledger is already asserted by a test rather than read, the row set is already derived from the live population, and the completeness fence already forces every measured subject to be claimed. The only missing piece is that the *claim* currently cannot distinguish "the lab has this" from "the lab does not". One field on an existing row, one count, one bound. It costs no new corpus and no new harness.

⚠ It does **not** close the GLSL-helper limit or the unswapped-body-class limit; those stay open and are named limits 3 and 4 in the ledger's §5. ⛔ Whether to add a fourth ruling is a change to a document `tests/material-parity-list.test.js` asserts against, so it is a real commit with a real gate — not a doc edit. **This is a proposal, not a decision.**

---

## 8. ⭐ WHAT IS ALREADY SCHEDULED ELSEWHERE — the DO-NOT-REDO list

| item | where it is already scheduled | what NOT to redo |
|---|---|---|
| **The (d) category itself** | `world-engine-production-L1-plan.md:205` **Carve-out (R3)**, under the heading **"Migration (recommend, don't ask)"** at `:204`: *"some features (hexTess, shatter, overlays) are pure-enable lab knobs with **no driver class** — keep them as a named 'overlay/enable' category, don't force them into driver gates."* | ⛔ **The category is named and the disposition is already recommended under an explicit don't-ask instruction.** Only **F19** and **F39** are genuinely new to it; F44–F49 are re-enumeration. Doubly covered by `one-pipeline-two-frontends-PLAN.md:573` (F44–F49 fenced as BLOCKED, "author the six lab presets as a prerequisite") and QB-12. |
| **F44–F49 method re-think** | QB-12 — Max's own verdict, all four exotics UNBUILT | ⛔ Do not re-derive that the mechanisms are cell-based |
| **`featureRelevant` migration** | `world-engine-production-L1-plan.md:181` WS3 F2 (strategy + done-criterion at `:194`) vs `one-pipeline-two-frontends-PLAN.md:578` (fenced out) | ⛔ Do not re-scope; **name the owner** (open item 1) |
| **Type-label atmospheres** | L1 WS3 F3, with done-criteria | ⛔ Do not re-scope R-07's root cause |
| **R-06's degeneracy** | ledger R-06, corrected 2026-08-20 | ⛔ Do not re-measure the six ocean planets |
| **F42 / F50 / the palette / `uNoiseScale`** | `r-rows-decision-packet-2026-08-20.md` §4 and Option C at `:564`; `uNoiseScale` also ledger P-10 + M-09 with **Max's own scheduling ruling already given** | ⛔ Do not re-measure; ⭐ **do check whether the `uNoiseScale` ruling has expired** (open item 4) |
| **The river / tectonic bakes** | `one-pipeline-two-frontends-PLAN.md:576` | ⛔ **AND there is a live architecture decision in front of them** — see the next row |
| **F11 / F12 / F27 / F28** | §3 queue (b), QB-3, ledger G-02 | ⛔ `one-pipeline-two-frontends-PLAN.md:576` carries an unresolved decision *"does `src/worldengine/` admit a three.js dependency, or do GPU-coupled bakers land under `src/rendering/bake/`?"* with the instruction to **decide it before moving them, not during**. `planet-lod-rivers.js` is 107,980 B / 24 exports and both it and `planet-lod-tectonic.js` import `three` and `ConvexHull`. Starting the (b) queue without that answer trips the boundary fence mid-commit. **Open item 3.** |
| **Eccentricity + tidal heating (⇒ `resurfacingRate`)** | `world-engine-production-L1-plan.md:86` WS1 F1 and `:89` WS1 F2, F1 hard-dependent on F2 | ⛔ Do not re-scope. ⭐ This is the root under ROOT 7, ROOT 8, R-05's cap, and three of the nine Tier-1 picks reading zero on every moon. |
| **F19's render gate** | QB-4: "F19 needs a lab-side render gate before any wiring" | ⛔ Do not wire F19 |
| **F36's observability** | QB-8: needs a lab render gate that puts the sun in the mirror direction | ⛔ Do not score F36 through a renderer |
| **F26's identity** | Max's ruling 3, `one-pipeline-two-frontends-PLAN.md:609` | ⛔ Resolved — built in the lab, absent from the game. §3's "UNKNOWN: 1" predates the ruling. |
| **F51 rings** | QB-14 + tracker | ⛔ Do not re-derive |
| **Aurora's law choice** | ledger P-05: "reduces to forwarding four values… no ruling from Max is owed" | ⛔ Do not re-open |

---

## 9. ⭐ WHAT IS UNKNOWN OR UNMEASURED — stated rather than guessed

1. **I did not measure a single pixel.** Every figure here is CPU law output. Whether a 603-value spread in `auroraIntensity` is visible on a disc is Max's eyes, not mine — and `uniforms.js:32` `uLevels`' 6-level posterize means the answer is probably "no" for colour features and "yes" for relief features, which is itself a claim I did not test.
2. **The "22 features have a game-own parallel" figure does not reproduce, and I did not pick a winner.** Counting **R** marks across my 48 rows gives **23**; counting `[current]` in `planet-visual-features.md:216-347` gives **18**; §3 says **22**. Three instruments, three numbers. Anyone quoting one should say which.
3. ⭐ **Two population disagreements — one RESOLVED here, one not.** `r-rows-decision-packet-2026-08-20.md` §6 item 15 asked whoever next quoted a planet-class-moon population to re-derive it. **Re-derived: 33 planet-class moons over `lab-procedural-0…199`, types {ice 11, rocky 11, sub-neptune 4, venus 4, ocean 3} — exactly the type census — of which 19 are non-gas and 14 are `compositionClass` gas.** The packet's objection ("33−19=14 does not reconcile against 4 sub-neptunes") is answered: the 14 gas ones are {rocky 4, ice 5, sub-neptune 4, ocean 1} by *type*, because `compositionClass` is density-derived and disagrees with the type label — the program's own theme. ⚠ **Still unresolved: non-gas totals.** This instrument counts **1160** non-gas (509 non-gas planets + 632 plain moons + 19 planet-class moons); the packet counts **1156** (505 + 632 + 19). The 4-body gap is in the planet term. My census is pre-admission (a law-output census); the packet's is post-admission (uniforms on mounted materials). That is a plausible reconciliation and I did not confirm it — `labPipelineAdmits` could not be imported headlessly here. **Percentages in this document use 1160; percentages in the packet use 1156. A difference between the two reports of that size is an accounting artefact, not a finding.** Item 16's plain-moon census disagreement (632 vs 654) is untouched.
4. **Whether F26/F30/F31's 4-value spread counts as differentiation** is a taste call, not a measurement. They will render and they will sort the galaxy into buckets; the buckets are type labels. Marked (a)† and left to Max.
5. **Whether the eight (d) features should get a law at all.** QB-12 — *"none of these is the right approach… machine surface seems just to be broken"* — is a verdict on the rendering *method*, and it may mean the right next move for the six exotics is a method re-think in the lab, not a driver law. That ordering is Max's, and the L1 plan already recommends the category disposition.
6. **Whether `mountainAmp`'s pile-up at its 0.6 cap is fully explained by the erosion drop.** The counterfactual moves it 200 → 472 distinct but the zero share does not move, so `rockyCrust` is doing something I did not decompose.
7. **Tier 2's cost.** The five laws upstream of `featureRelevant` emit 200–814 distinct values; whether a condition-derived predicate for each preserves that, or reproduces craters' two-value outcome, is not measured and cannot be until a predicate exists.
8. **`eccentricity`'s absence on plain moons** is measured (0/632 carry the field). ⭐ **Not unknown after all** — `world-engine-production-L1-plan.md:90` F2 states orbits are *"circular by construction"* generator-wide, so this is an absence by design and already scheduled. What I did **not** measure is how much of the Tier-1 moon deadness WS1 F1+F2 actually recovers; that needs the fix in hand.
9. **Nothing here was measured on Sol**, which has real NASA textures, a different renderer and no condition fields, and is structurally refused by this program.

---

## Open items for Max

1. **Name the owner of the `featureRelevant` / `rendersOn` migration.** Two docs schedule it with opposite dispositions (`one-pipeline-two-frontends-PLAN.md:578` fences it out; `world-engine-production-L1-plan.md:181` schedules it with a strategy and a done-criterion). It gates the four highest-variance relief laws in the set plus airglow. **Recommendation: L1 WS3 F2's incremental, per-feature-golden-gate version, because it already has done-criteria and a migration strategy and the other does not — but scope it against the crater counter-example in §4, which says porting a family correctly and having it render on a useful population are two different jobs.**
2. **Approve Root 1 (the erosion rename) as its own commit.** Twelve masters across eleven features, two of them 100%-dead today. `conditionFromBody.js` deliberately left it because it moves numbers inside an additive step, so it needs its own delta table on the Step 2 precedent. **Recommendation: before any pack, but AFTER WS1 F1+F2 (item 3) — it is the cheapest large move in this document and it is not the one that unblocks the moon population.**
3. ⭐ **Sequence WS1 F1+F2 ahead of the first pack — this is a recommendation that MOVED during the run.** I started ready to put Root 1 (the erosion rename) first on leverage alone. Then the body-kind split landed: three of the nine Tier-1 picks (F37 aurorae, F8's emissive half, F9/F10) are identically zero on all 632 plain moons, and the measured cause is `eccentricity` absent by construction plus tidal heating hard-zeroed — **both already scheduled, at LOW and MEDIUM blast, as `world-engine-production-L1-plan.md:90` F2 and `:85` F1.** The same pair also un-caps R-05 (§6). **Recommendation: WS1 F2 → WS1 F1 → Root 1 → Tier 1.** Root 1 is still the highest-leverage single line; it is no longer the thing I would do first, because doing it first ships a pack that re-produces the "these are all identical" UAT on the moon population.
4. **Answer the three.js question before the (b) queue starts.** `one-pipeline-two-frontends-PLAN.md:576`: does `src/worldengine/` admit a three.js dependency, or do GPU-coupled bakers land under `src/rendering/bake/`? All four (b) features are downstream of it and the plan says decide it *before* moving them. **Recommendation: the plan's own — bakers under `src/rendering/bake/`, keeping the world engine headless-testable.**
5. **Your `uNoiseScale` ruling is due and is not in any tier here.** You ruled it gets a characteristic wavelength in km *after moons ship*; moons shipped at Step 10a. r-rows measures it as the single largest differentiation win in the corpus. **Recommendation: schedule it alongside Tier 1 rather than inside it — it is not a lab-only feature and it will not surface from this document's list.**
6. **Rule on the (d) eight — or confirm the existing carve-out already does.** `world-engine-production-L1-plan.md:205` already names the "overlay/enable" category and recommends the disposition under a don't-ask heading. **Recommendation: treat F44–F49 as already ruled and do not spend a cycle on them; only F19 (waiting on QB-4's render gate) and F39 (one law away, cheap) are genuinely new to the category.**
7. **Decide whether Rule 2 gets its gate now or later.** §7's proposal is one field on an existing ledger row plus one bounded count. **Recommendation: do it before the next pack lands, because the count it produces is meaningless retroactively — it only bites on rows added after it exists.**
8. **Step 12's gate still reads satisfied and nobody has called it.** Both UATs have your pass, and `Planet.js:2153` `export const LAB_GAS_BODIES_DEFAULT = false;` means none of the shipped work reaches a player. I did not touch it.
