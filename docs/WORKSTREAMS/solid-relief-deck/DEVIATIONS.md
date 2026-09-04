# solid-relief-deck — declared deviations

Every item here is a behaviour change this workstream makes on purpose, measured before and after.
Nothing on this list was discovered by a fence after the fact; each was caught by the before/after
read of the LIVE lab (`lab-parent-capture.json` at 4d81784 vs `lab-head-capture.json`) and is
recorded rather than reverted, with the reason and the precedent.

## D-1 · The lab's four surface-process laws become SEED-LIVE (`_fp` → `_dp`)

**What moved.** In the lab, karst / dunes / dust / ground-ice now change with the macro seed. Measured
on `Rocky (Earthlike)`: `karstDensity` 0.4606 (seed 1) → 0.6173 (seed 2) → 0.5875 (seed 3). Before,
every seed of one preset answered the same value.

**Why.** The lab's block mixed its sources — `_stab` off the PER-SEED draw `_dp`
(`world-engine-lab.html:2129`), `_erosion` / `_press` / `_hadLiquid` off the FROZEN preset `_fp`
(`:2127`), which is seed-deaf. The extracted module takes ONE condition and reads every input off it.

**Precedent.** Identical to driver pack #9's ruling at `world-engine-lab.html:2136`: *"THE SEAM IS
`_dp`, THE PER-SEED DRAW — NOT `_fp`, which is built from the FROZEN preset and is seed-DEAF: every
seed of one preset would answer the same rivers."* `fluvialDeck` also carried an erosion-spelling
repair that took `uOutflowDensity` from 0 of 124 game bodies to 66.

**The law itself did not move.** `surfaceProcessesOf` reproduces the parent's 18-preset values
EXACTLY when handed `_fp` and the same `u` — worst delta **0** over 18 presets × 7 fields
(`tests/driver-pack-solidrelief.test.js` §B). The whole delta is the input, none of it the expression.

**Measured blast radius in the lab:** `ldaFat` moves on **2 of 18** presets (Frozen 0.600 → 0.502,
Crystal 0.040 → 0.047). The other five fields are unchanged at seed 1 on all 18.

## D-2 · F19's angle of repose becomes RADIUS-AWARE in the lab

**What moved.** `repose` now responds to the lab's planet-radius slider. Measured on `Rocky
(Earthlike)` at drawn radius 0.8189 R⊕: **0.9387 → 1.0443**. Lava 0.9828 → 1.7093, Frozen 1.4975 →
1.6033. It moves on every preset whose drawn radius differs from the preset's canonical one.

**Why.** `repose = 0.9·g^-0.4`, and the lab's F19 block read `_g = u.surfaceGravity` — `deriveUniforms`'
CANONICAL, **radius-blind** g. Routing through the pack hands it
`deriveConditionVector(_dp, u, state.planetRadiusEarth).surfaceGravity`, the radius-aware value.
Measured on the live page: `_derived.surfaceGravity` 0.900 vs `state.surfaceGravity` 0.689 at radius
0.8189, and 1.0443 = 0.9 / 0.689^0.4.

**Why this is a repair and not a regression.** The lab already ruled the radius-blind value deficient
for its other consumers — `world-engine-lab.html:1964` writes `state.surfaceGravity` from the
radius-aware condition and its own comment says *"the radius-aware condition gravity, NOT
deriveUniforms' canonical radius-blind g … both were radius-deaf until this line changed."* F19 was
simply not on that line's consumer list. ROOT-0 fix 4 (B1, 2026-08-20) is the same repair one layer
up, where the blind fallback measured **8.3× off at the median and >10× off on 945 of 1517 bodies**.

**In the game there is no delta at all**: `conditionFromBody` supplies the real per-body g and
`deriveUniforms` prefers it (ROOT-0 fix 4), so the pack has always been going to read the correct
value. This deviation is the LAB catching up to the game, not the reverse.

## D-3 · The preset-name relevance table is not ported, so the game renders five features on more bodies than the lab's preset view

Recorded in full in `src/worldengine/drivers/solidRelief.js`'s header with the per-preset
disagreement set. Summary: the lab multiplies mountains / canyons / scarps / plateaus / tessera by
membership in `ASSOCIATIONS[key].rendersOn`, a list of preset NAMES. It is not derivable from the
condition — measured over all 18 presets it is not composition class, not atmosphere, not
temperature, not iron, not volatiles — and Max's 2026-07-19 ruling is that *"presets remain dev
fixtures / named-body canonical locks, NOT the product."* `GAME_RELEVANCE` is frozen empty and a
driver keyed on an absent relevance name throws.

## D-4 · A new parent baseline fixture rather than a re-capture of a shipped one

`tests/fixtures/solidrelief-pack-drivers-baseline.json` is this workstream's own capture at
`4d81784`. The three shipped fixtures (`pack-drivers-baseline.json`,
`ray-pack-drivers-baseline.json`, `term-pack-drivers-baseline.json`) are each pinned by a shipped
suite's `capturedFrom` and are left byte-identical — re-capturing one would silently rewrite a
shipped expectation inside a workstream claiming nothing else moved. Same reasoning, verbatim, as
`scripts/capture-ray-pack-baseline.mjs`'s header.

## Census pins re-recorded (not deviations, but declared)

Registering an eleventh pack moves every census that enumerates packs or their uniforms. Each was
updated in the same commit with the reason, never silently:
`tests/one-pipeline-fence.test.js` (ten → eleven modules), `tests/gas-body-lab-material.test.js`
(PACKS membership + the per-body pack lists), `tests/moon-lab-mount.test.js` /
`tests/moon-render-path.test.js` (the per-class pack-name strings), `tests/material-parity-list.test.js`
(the writing-pack count and the uniform tally), `tests/driver-pack-stormdeck.test.js` (stormDeck is
no longer last in PACKS), plus the sibling packs' registry-shape assertions.
