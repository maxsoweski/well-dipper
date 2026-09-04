# The `solidRelief` deck — the population read, measured at scoping

Repo `/home/ax/projects/well-dipper`, branch `feature/world-engine-production-L1`, HEAD `1629d2e`.
READ-ONLY. Script + raw rows: `population.mjs` / `population.json`.
Corpus: the 24 standard seeds `rocky-0`…`rocky-23` — **124 solid bodies (66 planets / 58 moons)**,
the same corpus as `coverage-audit-2026-09-03`.

Run it:
```
node --experimental-loader=data:text/javascript,'export async function resolve(s,c,n){if(s.startsWith("motion-test-kit/"))return n("/home/ax/projects/well-dipper/vendor/"+s,c);if(s==="motion-test-kit")return n("/home/ax/projects/well-dipper/vendor/motion-test-kit/index.js",c);return n(s,c)}' docs/WORKSTREAMS/solid-relief-deck/population.mjs
```
(the loader hook is the `motion-test-kit` alias `vite.config.js:37` supplies to the app but not to bare node.)

## The question this answers

Max checks premises. His will be *does forwarding these gates actually put anything on screen?*
Answer: **yes, on most bodies, for most gates** — with two of the thirteen provably dead and the
handoff's split wrong in two places.

| gate | F-row | non-zero | distinct | median | max | planets / moons |
|---|---|---|---|---|---|---|
| `uMountainAmp` | F1 | **103/124** | 42 | 0.318 | 0.577 | 62 / 41 |
| `uChasmaDepth` | F4 | **124/124** | 107 | 0.080 | 0.266 | 66 / 58 |
| `uScarpStrength` | F5 | **122/124** | 98 | 0.061 | 0.116 | 64 / 58 |
| `uPlateauStrength` | F6 | **124/124** | 107 | 0.057 | 0.190 | 66 / 58 |
| `uTesseraStrength` | F6 | **46/124** | 43 | 0.025 | 0.140 | 41 / 5 |
| `uLavaCoverage` | F8 | **103/124** | 41 | 0.100 | 1.000 | 62 / 41 |
| `uSubStrength` | F18 | **37/124** | 32 | 0.710 | 1.000 | 13 / 24 |
| `uKarstDensity` | F21 | **68/124** | 17 | 0.349 | 0.889 | 66 / 2 |
| `uDuneDensity` | F15 | **68/124** | 9 | 1.000 | 1.000 | 66 / 2 |
| `uDustDepth` | F16 | **68/124** | 22 | 0.911 | 1.000 | 66 / 2 |
| `uMassWastDensity` | F19 | 124/124 | **1** (constant 1.0) | 1.000 | 1.000 | 66 / 58 |
| `uFacetStrength` | F43 | **0/124** | 1 | — | — | 0 / 0 |
| `uBioCoverage` | F46 | **68/124** | **2** | 0.450 | 0.450 | 66 / 2 |

## Two corrections to the 2026-09-04 handoff, measured

1. ⭐ **F46 `uBioCoverage` is NOT queue-(c) dead.** The handoff records `habGate ≡ 0`. On the game
   corpus `condition.habitability` is a real number on **68 of 124** solid bodies (min 0.55, max 1.0,
   8 distinct), and `smoothstep(0.1, 0.4, hab)` therefore returns **exactly 1.0 on all 68**. The gate
   is wide open. What F46 lacks is the other half: the magnitude `state.bioCoverage` is a **lil-gui
   slider defaulted to 0.45** (`world-engine-lab.html:1078`) with **no law behind it on either side**,
   so forwarding it would author a constant, not wire a law — `polarDeck`'s refusal of `uPolarAmp`/
   `uPolarW` is the precedent for holding it out. Different reason, same exclusion.
2. ⭐ **F1's RUNTIME gate is live on 103 of 124.** The generation block the audit found is in the
   **bake's** `plate()` closure (`plates.js`, 0 of 124). `uMountainAmp` itself is
   `clamp01(mix(0.25, 0.6, 1 − erosion)) · rockyCrust` (`labCore.js:793`) and it is non-zero on 103
   bodies with 42 distinct values. `mountainCombiner` (`height.glsl.js:1456`) early-outs at ≤ 0 and
   otherwise adds ridged relief. So forwarding `uMountainAmp` **does** render — the "wire (2) first"
   dependency the handoff asserts applies to the plate BAKE, not to this gate.
3. ✅ **F43 `uFacetStrength` is confirmed dead — 0 of 124** — but not for the recorded reason.
   `atmosphere.retained === false` indeed never happens (68 bodies carry `retained: true`, 56 carry no
   atmosphere at all), and the actual predicate is `world-engine-lab.html:2748`: airless **and**
   erosion < 0.05 **and** resurfacingRate < 0.05 **and** bombardmentIntensity < 0.2. No generated body
   clears all four.

## The third finding the handoff does not name: the relevance gate

Five of the thirteen are multiplied in the lab by a **preset-NAME membership table**, not by a law:

```
world-engine-lab.html:5369  uMountainAmp   … × state.featureRelevant.mountains
world-engine-lab.html:5376  uChasmaDepth   … × state.featureRelevant.canyons
world-engine-lab.html:5381  uScarpStrength … × state.featureRelevant.scarps
world-engine-lab.html:5388  uPlateauStrength … × state.featureRelevant.plateaus
world-engine-lab.html:5393  uTesseraStrength … × state.featureRelevant.tessera
```

`state.featureRelevant[k] = ASSOCIATIONS[k].rendersOn.includes(driverUI.preset)`
(`world-engine-lab.html:1988`). The game has no presets, `GAME_RELEVANCE` is frozen empty
(`src/objects/Planet.js:2209`) and **a driver keyed on an absent relevance name throws**.
`polarDeck` already met and solved this (`polarDeck.js:58-66`): replace the preset-name table with a
**condition-derived admission predicate** and *measure* that the two select the same worlds over all
presets — it got 18/18 agreement. The same measurement is owed here for all five, and it is a build
task, not a taste question.

`ASSOCIATIONS[…].rendersOn` for the five, for that derivation:
- mountains / canyons / plateaus — Rocky, Ocean, Venus, Eyeball, Mars, Lava
- scarps — those six **plus** Frozen (airless)
- tessera — the five atmospheric ones (no Lava)

Note `mountainAmp` and `tesseraStrength` already carry `× rockyCrust` inside `labCore`, so the table
is partly redundant with the law it multiplies.

## Where the laws actually live — and why this is not one uniform job

| gates | law lives in | wiring shape |
|---|---|---|
| `uMountainAmp`, `uChasmaDepth`, `uScarpStrength`, `uPlateauStrength`, `uTesseraStrength`, `uLavaCoverage`, `uSubStrength` | `src/worldengine/base/labCore.js` (`deriveUniforms`) | **forward a named field**, the `solidFeatures.js` shape exactly |
| `uKarstDensity`, `uDuneDensity`, `uDustDepth`, `uMassWastDensity`, `uFacetStrength`, `uBioCoverage` | **only in `world-engine-lab.html`** (`:2175`, `:2187`, `:2203`, `:2218`, `:2752`, `:5077`) | **extract into `src/` first**, then forward — the `fluvialDeck` shape |

⚠ And the four extractable ones read `_fp` — the **frozen preset**, seed-deaf — not the per-seed
`_dp`. `fluvialDeck` hit exactly this (`fluvialDeck.js` header: the `_fp`/`_dp` seam, and a
single-spelling erosion read that left `uOutflowDensity` at 0 of 124 until the pack fixed it). The
extraction must read the condition, and the population above is measured on the condition, so these
numbers are the post-extraction truth, not today's lab behaviour.

## The double-count risk, made specific

The combiners run **on top of** the blended baked+synth field, not instead of it
(`planetShaders.glsl.js:261-265` blends the bake, then `:305` onward calls `mountainCombiner`,
`canyonCombiner`, `plateauCombiner`, `tesseraCombiner`, `lavaCombiner` …). So on a body whose bake
closure already authored that landform, forwarding the runtime gate adds a **second** expression of
it. Overlap, from `coverage-audit-2026-09-03`'s dispatch census:

| family | bake closure that writes it | bodies | runtime gate non-zero | overlap |
|---|---|---|---|---|
| F4 rifts | `stagnantLid()` | 10 | 124 | **10** |
| F6 tessera / plateaus | `stagnantLid()` | 10 | 124 / 46 | **10** |
| F8 lava plains | `unbrokenLid()` lid-weak | 4 | 103 | **4** |
| F1 ranges | `plate()` | **0** | 103 | **0** |

⭐ **The lab composes them the same way on the same bodies** — one shader, one bake, both live. So
"compose or double-count" is not a design fork for this workstream: the deck's job is to make the
game's composition **identical to the lab's on the same condition**, and any complaint about that
composition is a LAB defect to log, not a wiring decision to invent here (`feedback_wire-dont-shoestring`).
What is owed is the CONTROL: an A/B on one of the 10 `stagnantLid` bodies proving the game's
composed relief matches the lab's for that condition.

## And the strongest argument for the deck

`coverage-audit-2026-09-03` measured **no bake crossover at all below 0.22 R⊕ — 41 of 124 bodies**.
Every small moon draws the pre-bake analytic surface, where the runtime gates are the **only** road
relief can take. On those 41 the deck is not a second helping; it is the first.
