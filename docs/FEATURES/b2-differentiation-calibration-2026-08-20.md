# B2 — THE DIFFERENTIATION CALIBRATION, ALL THREE LEGS IN ONE TABLE

**Block** B2 of `docs/FEATURES/comprehensive-wiring-plan-2026-08-20.md`, greenlit by Max, built
2026-08-20 on `feature/world-engine-production-L1`.

**This is B2's single calibration deliverable.** Leg 1 already shipped its own table and it is not
duplicated here — `docs/FEATURES/crater-floors-calibration-2026-08-20.md` stays the full crater
derivation and §4 below carries only its RULE and the cross-link. Leg 2's full derivation likewise
stays in `docs/FEATURES/oxidation-window-calibration-2026-08-20.md`; §3 carries its anchors and its
refusals. **Leg 3 had no document before this one** — §2 is its calibration table, and it is the
reason this file exists rather than a third sibling.

## ⛔ THE CORPUS, AND IT IS ON EVERY NUMBER

Unless a row names another, every corpus figure below is
`StarSystemGenerator.generate('lab-procedural-N', null)` for **N = 0…199**, **re-measured for this
document rather than carried over from the leg reports**:

| | bodies |
|---|---:|
| **TOTAL** | **1517** |
| gas | 357 (343 planets + 14 planet-class moons) |
| **NON-GAS** | **1160** = **509 planets + 632 plain moons + 19 planet-class moons** |

⛔ **Nothing here is measured on Sol.** Sol renders NASA textures through a different renderer with
no world-engine condition fields, so it is the one population that cannot validate procedural
generation. No file under `src/generation/SolarSystemData.js` was read or written by any leg.

⚠ **THE 632 PLAIN MOONS ARE A LIVE POPULATION.** The moon-formation window is open (`34b502d`), and
32 tests are red by design over it. Every moon count in this document is therefore a **floor at the
sha in its row**, not a stable figure.

## ⛔ THE SHA ON EVERY NUMBER

| leg | what it moved | sha |
|---|---|---|
| **leg 1** | the two crater floors | **`5afef82`**, committed |
| **leg 3** | `uNoiseScale` unpinned | **uncommitted** — working tree on top of `5afef82` |
| **leg 2** | the oxidation window re-anchored | **uncommitted** — working tree on top of `5afef82` + leg 3 |

⚠ **Legs 2 and 3 carry no sha because they are not committed.** Every leg-2 and leg-3 number below
was measured on the working tree at the time of writing; the day they commit, this table gets the two
shas and nothing else in the document changes. Leg 1's numbers are the only ones in this file that
name a commit that exists.

---

## 1. The line of sight

B2 exists so that **bodies stop reading identical to one another** — at the impact scale (leg 1), the
terrain-frequency scale (leg 3) and the palette (leg 2) — on the largest population the engine
generates. Each leg replaced a value that was **the same on every body, or nearly so**, with a value
derived from a stated rule calibrated against real bodies.

| leg | the quantity | before | after | corpus |
|---|---|---|---|---|
| 1 | `uCraterScale` | **25 distinct values** over 1160 non-gas bodies; 485 cratered, 269 of them on ONE shared scale | **324 distinct**; 772 cratered, 323 of them on one shared scale | `lab-procedural-0…199`, sha `5afef82` |
| 3 | `uNoiseScale` | **1 distinct value** (the factory `4.0`) on all 1160 non-gas | **985 distinct across 83 5 % bins**; 0 still answer 4.0 | same, uncommitted |
| 2 | the ground palette | 1159 distinct `weathered` colours over 1160 | **1159** — ⚠ the palette was never short of values; see §3.0 | same, uncommitted |

⭐ **Leg 2 is the one whose headline is a refusal, and it is stated here rather than buried.** The
palette leg moves 663 of 1160 bodies and **0 of them past one `uLevels` 6 posterize quantum**. What
makes discs read alike at the shipped posterize level is the quantum, not the palette law.

---

## 2. LEG 3 — THE MACRO WAVELENGTH, READ OFF EIGHT REAL BODIES

⛔ **Uncommitted.** Every figure in this section was measured on the working tree over
`lab-procedural-0…199`.

`uNoiseScale` was the last frequency in the engine with no physical size behind it: the factory
default src/worldengine/shaders/uniforms.js:10 `      uNoiseScale: { value: 4.0 },` on **both**
front-ends' lab material, written by neither. The lab already km-keys sixteen feature families
through `featureFrequencyFromKm`; the base terrain field alone carried a raw frequency.

### 2.1 ⭐ THE TABLE, UNDER BOTH NAMING CONVENTIONS — AND BOTH COLUMNS ARE LOAD-BEARING

The dominant macro-relief structure of eight reference bodies. The radii and the structure diameters
are literature figures, cited not measured; **every ratio in the two λ/R columns was recomputed for
this document from the two numbers on its own row.**

| body | R (km) | **(A) largest single macro structure** | A λ/R | **(B) dominant repeat unit** | B λ/R |
|---|---:|---|---:|---|---:|
| **Earth** | 6371 | Africa, longest coherent continental block, ~7,400 km | **1.162** | an ocean basin (Atlantic, ~5,000 km) | 0.785 |
| Venus | 6051.8 | Aphrodite Terra, ~10,000 km | **1.652** | Ishtar Terra, ~5,600 km | 0.925 |
| Mars | 3389.5 | the Tharsis rise, ~5,000 km | 1.475 | Hellas basin, 2,300 km | 0.679 |
| Mercury | 2439.7 | Caloris basin, 1,550 km | **0.635** | Rembrandt basin, 715 km | 0.293 |
| Luna | 1737.4 | South Pole–Aitken, ~2,500 km | 1.439 | Imbrium, 1,145 km | 0.659 |
| Callisto | 2410.3 | the Valhalla ring system, ~3,800 km | 1.577 | the Asgard system, ~1,600 km | 0.664 |
| Ganymede | 2634.1 | Galileo Regio, ~3,200 km | 1.215 | a sulcus block (Uruk, ~1,200 km) | 0.456 |
| **Io** | 1821.6 | a mountain, mean basal length ~157 km | **0.086** | a patera, mean Ø ~41 km | 0.023 |

**Recomputed spread over the seven non-Io rows: column A runs 0.635 → 1.652 λ/R, column B runs
0.293 → 0.925 λ/R.**

⚠ **COLUMN B IS NOT A SECOND MEASUREMENT OF THE SAME QUANTITY.** It is the same body read under a
different answer to *"which structure is the dominant one?"* **Luna is the worked case: 1.439 R for
South Pole–Aitken against 0.659 R for Imbrium — a factor of 2.18 out of a convention choice alone**
(recomputed). A single-column table would read as far more discriminating than this evidence is, and
that is why both conventions are printed.

⚠ **EARTH IS THE WEAKEST ROW AND IT IS THE ROW THE CONSTANT RESTS ON.** Plate tectonics resurfaces at
every scale, so Earth has no single dominant basin the way Luna and Mercury do. Its three defensible
readings — a continental block (7,400 km), an ocean basin (5,000 km), the whole Pacific basin
(~15,000 km) — **recompute to 1.162, 0.785 and 2.354 λ/R, a spread wider than the entire seven-body
bracket.** The shipped constant is Earth's column-A reading at two figures:

```
K_MACRO_R = 1.16 body radii    →    uNoiseScale = (1/0.3) / 1.16 = 2.873563
```

src/worldengine/base/macroWavelength.js:69 `export const K_MACRO_R = 1.16;` with
src/worldengine/base/macroWavelength.js:80 `export const C_MACRO = 1 / 0.3;`. **The other seven
bodies BRACKET that choice; they are not averaged into it**, and ⛔ **the third digit of 1.16 is not
real.** Re-tuning it is a one-constant change in one file.

### 2.2 ⭐ Io IS THE SECOND ANCHOR, NOT AN OUTLIER

Io is the one body in the set whose macro relief is built by tidal heating rather than by impacts,
tectonics or ice, and it sits an order of magnitude finer than every other row under **either**
convention (0.086 and 0.023). Two anchors, one process axis:

```
no tidal drive        →  k = 1.16    →  uNoiseScale  2.873563
Io-grade tidal drive  →  k = 0.068   →  uNoiseScale 49.019608
```

src/worldengine/base/macroWavelength.js:90 `export const K_MACRO_R_IO = 0.068;`, interpolated by the
engine's own bounded Io-anchored dial at
src/worldengine/base/macroWavelength.js:126 `export function macroShortening(rawIoRatio) {` and
resolved per body at
src/worldengine/base/macroWavelength.js:148 `export function macroWavelengthKm(condition) {`.

**Measured on this tree: `macroShortening(0) = 1` exactly, `macroShortening(1) = 0.0586…` (the Io
anchor), and the law is bounded at
src/worldengine/base/macroWavelength.js:136 `export const MACRO_FREQ_CEIL = C_MACRO / (K_MACRO_R * macroShortening(Infinity));`
= 251.030934.** The corpus reaches 245.175, i.e. inside the ceiling and not at it.

⚠ **THE HONEST HEADLINE, STATED BEFORE THE COUNTS.** The reference bodies put the macro wavelength at
about one body radius from Luna to Venus, so **the radius cancels under the game's display policy and
the calibrated base law is a CONSTANT** 2.873563 against today's 4.0 — a 1.39× *longer* wavelength on
every untidal body. **All** of the per-body variation comes from the Io-anchored process term.

### 2.3 THE CORPUS DELTA — measured through the shipped pack

⛔ Re-measured for this document over `lab-procedural-0…199`, resolved through the writer
(`resolveDriver`), not read raw off the pack.

| population | distinct values | distinct 5 % bins | min | max | still at 4.0 |
|---|---:|---:|---:|---:|---:|
| **1160 non-gas** | **985** | **83** | 2.873563 | 245.175 | **0** |
| **632 plain moons** | **632** | **79** | 2.873563 | 245.175 | **0** |
| 509 planets | 340 | 33 | 2.873563 | 56.4358 | 0 |
| 19 planet-class moons | 16 | 3 | 2.873563 | 69.8999 | 0 |
| *before the leg, all 1160* | *1* | *1* | *4.0* | *4.0* | *1160* |

⚠ **THE VARIATION IS NOT EVENLY SPREAD, AND THE PLANET HALF GETS FAR LESS OF IT.** 509 planets return
340 distinct values across 33 bins against the moons' 632 across 79. The moons are where this leg
lands, because the tidal process term is where the variation comes from.

### 2.4 THE RENDER-PIXEL CONSEQUENCE, in leg 1's own framing

Leg 1 measured the scene at **1/3 render resolution** and a **359.41 RENDER-px disc radius** at its
closest approach framing (`5afef82`). Octave px = `359.41 / (mult × uNoiseScale)` for the base
stack's four multipliers `0.3 / 1 / 2 / 4`. Recomputed here:

| uNoiseScale | λ/R | octave 0 | 1× | 2× | 4× |
|---:|---:|---:|---:|---:|---:|
| **2.8736** (new base) | 1.1600 | 416.92 px | 125.07 | 62.54 | 31.27 |
| 4.0000 (today) | 0.8333 | 299.51 px | 89.85 | 44.93 | 22.46 |
| 49.0196 (Io anchor) | 0.0680 | 24.44 px | 7.33 | 3.67 | 1.83 |
| **245.175** (corpus max) | 0.0136 | **4.89 px** | 1.47 | **0.73** | **0.37** |

**Octave 0 stays above leg 1's 4-px "reads as a feature" bar across the whole range.** ⚠ The 2× and
4× octaves — 26 % of the stack's amplitude — fall below two render px above `uNoiseScale ≈ 45`. ⛔ No
ceiling was imposed on it, and the measured reason is in §7.

### 2.5 ⛔ THE GAS RULING — NO, AND IT IS RULED RATHER THAN OMITTED

**`uNoiseScale` is NOT added to `giantDeck`.** On a gas body the lab spends the same spelling as a
**band-warp frequency**, reached through `fbmd` at
src/worldengine/shaders/heightNoise.glsl.js:88 `        float freq = uNoiseScale * 0.3 * uDispDomainScale;`
— not as a terrain wavelength. None of the eight reference bodies above is a gas giant, and the
process term's anchor is Io, a solid body. Same spelling, two quantities: the shape the parity ledger
already rules at P-15.

**MEASURED: 0 of 357 gas bodies in the corpus are claimed by any rocky pack**, so all 357 keep the
factory 4.0. Ruled in the ledger at `docs/FEATURES/step6-parity-ledger.md:135` (P-15, the gas half,
`accepted-loss`) and `docs/FEATURES/step6-parity-ledger.md:130` (P-10, the solid half, `carried`).

---

## 3. LEG 2 — THE OXIDATION WINDOW, RE-ANCHORED ON REAL SURFACES

⛔ **Uncommitted.** Full derivation: `docs/FEATURES/oxidation-window-calibration-2026-08-20.md`;
regenerate every table with `node tools/oxidation-window-delta.mjs`, which prints a CONTROL first.

### 3.0 ⚠ THE HEADLINE IS A NEGATIVE RESULT AND IT LEADS

Re-measured for this document over the 1160 non-gas bodies, with an independent mirror whose CONTROL
run reproduces the shipped `surfacePaletteOf` **BIT-IDENTICALLY over 1160 bodies × 4 endmembers**:

- **`weathered`: 663 of 1160 bodies move. 50 clear the posterize dither window (0.0667), 22 clear
  half a quantum, `0` clear one full `uLevels` 6 quantum (0.1667). Max |Δ| = 0.0995.**
- **`craton`: 698 move, 99 past dither, 54 past half a quantum, `0` past one. Max |Δ| = 0.1586.**

⛔ **At the shipped posterize level this leg is sub-quantum on the entire corpus.** It is a
correctness fix with a real-body rule, and it is not a visibility win at `uLevels` 6.

### 3.1 THE DERIVATION — both edges sit ON a body

The gate reads `composition.volatileFraction`, and that quantity already has a real-body scale in
this repository: `driver-presets.js`, whose rows are named after real bodies.

| body | `volatileFraction` | volatile budget | observed surface oxidation | what the gate must do |
|---|---:|---|---|---|
| **Mercury** | 0.02 | essentially anhydrous | **none** — fO₂ several log units below iron–wüstite | **exactly 0** |
| **Luna** | 0.02 | bulk water at ppm level | **none** — Fe²⁺ and native Fe⁰; Fe³⁺ effectively absent | **exactly 0** |
| Venus | 0.02 | bone dry today | **partial, by a DIFFERENT mechanism** — CO₂/SO₂ at 737 K | 0 here — see below |
| **Mars** | 0.10 | wt %-level regolith water + a lost ocean | **saturated** — dust Fe³⁺/ΣFe ≈ 0.7–0.9 | **exactly 1** |
| Earth | 0.15 | oceans + hydrated mantle | **saturated** — crust equilibrated against 21 % O₂ | **1** (sits above Mars) |

```
OX_VOL_LO = 0.02   ← Luna and Mercury, the reference UNOXIDISED bodies   (was 0.03)
OX_VOL_HI = 0.10   ← Mars,             the reference OXIDISED body       (was 0.12)
```

src/worldengine/base/surfaceMaterial.js:194 `export const OX_VOL_LO     = 0.02;` and
src/worldengine/base/surfaceMaterial.js:195 `export const OX_VOL_HI     = 0.10;`.

⛔ **WHAT WAS WRONG WITH `0.03 / 0.12`: neither edge sat on a body.** 0.12 is *above* Mars's own
budget, so the archetype of an oxidised surface was held at 0.8738 of its own oxidiser gate instead
of saturating it. 0.03 zeroed a band above Luna that no reference body occupies.

⚠ **VENUS IS THE WEAKEST ROW AND NO CONSTANT FIXES IT.** Venus carries the same 0.02 and reads 0, yet
its surface **is** partly oxidised — by CO₂/SO₂, not water. **This law has no oxidiser channel but
water.** Declared, not repaired: adding one is a new law, not a constant.

⛔ **THE CORPUS-FITTED WINDOW WAS MEASURED AND REFUSED.** `0.015 / 0.080 × 0.80` scores better (87
bodies past a quantum against 0), and it was refused on a fact about a real body:
`smoothstep(0.015, 0.080, 0.02) = 0.0168`, so it hands **Luna and Mercury a non-zero oxidiser gate** —
the two bodies in the set with no ferric iron at all begin to rust. Fitting a palette law to our own
generator's draw is how a world-generation defect gets laundered into physics.

⛔ **`OX_MAX` was re-examined and HELD at 0.60**
(src/worldengine/base/surfaceMaterial.js:204 `export const OX_MAX        = 0.60;`): over the 1160 it
is not a ceiling at all but a flat 0.6× gain, and the real-body rule that would raise it (Martian
bright-region R/B ≈ 3.3) asks for **1.19**, not a legal mix fraction.

### 3.2 THE CORPUS DELTA, SPLIT BY BODY CLASS — re-measured for this document

`max |Δ|` over three display channels against the `uLevels` 6 quantum 0.1667; dither window 0.0667.

| endmember | population | moved | > dither | > ½ q | **> 1 q** | max |
|---|---|---:|---:|---:|---:|---:|
| `weathered` | 1160 non-gas | 663 | 50 | 22 | **0** | 0.0995 |
| `weathered` | **632 plain moons** | **313** | **26** | **12** | **0** | **0.0995** |
| `weathered` | 509 planets | 336 | 23 | 10 | **0** | 0.0976 |
| `weathered` | 19 planet-class | 14 | 1 | 0 | **0** | 0.0753 |
| `craton` | 1160 non-gas | 698 | 99 | 54 | **0** | 0.1586 |
| `craton` | **632 plain moons** | **313** | **26** | **12** | **0** | **0.0995** |
| `craton` | 509 planets | 369 | 70 | 40 | **0** | 0.1586 |
| `craton` | 19 planet-class | 16 | 3 | 2 | **0** | 0.1206 |

⭐ **The moon rows are new here — no instrument in the repo prints them.** They say the palette leg
lands on the moons at exactly half the rate it lands on planets (313 of 632 = 49.5 % against 336 of
509 = 66.0 %), and that `craton` and `weathered` are IDENTICAL on the moon half — the moons' craton
branch and weathered branch return the same colour, which is the `craton === weathered` collapse the
leg-2 document reports at 853 → 759 bodies, concentrated here.

---

## 4. LEG 1 — THE TWO CRATER FLOORS (committed at `5afef82`)

Full derivation and its corpus table: `docs/FEATURES/crater-floors-calibration-2026-08-20.md`. Only
the two RULES and the re-measured corpus delta are repeated here, so that B2's calibration reads as
one document.

**RULE 1 — the visibility floor.** *The SMALLEST crater the shader draws (`2·R_LO` = 0.36 cell units)
must span ≥ 4 RENDER px at the closest measured approach framing.* 4 because a crater must show bowl
AND rim to read as one, not merely be detected. `0.36·√f·359.41 = 4 ⇒ f = 9.56e-4`, shipped at
src/worldengine/port/craterUniforms.js:71 `export const CRATER_VIS_FLOOR_RAD = 9.6e-4;`.

**RULE 2 — the population floor.** *A body must render at least one visible crater on its disc*,
`density × visibleCells ≥ 1` with `visibleCells = 2π·scale²`, shipped at
src/worldengine/port/craterUniforms.js:79 `export const CRATER_MIN_VISIBLE = 1.0;`. It replaces a
fixed density floor that could not state that quantity, because the cell count moves with the floor.

### 4.1 RE-MEASURED FOR THIS DOCUMENT, PRE (`5afef82^`) vs POST (`5afef82`)

⛔ Not quoted from the commit message: the pre-leg module was recovered with `git show 5afef82^` and
both versions were run side by side over `lab-procedural-0…199`.

| | PRE | POST | denominator |
|---|---:|---:|---|
| bodies with craters ON | 485 | **772** | 1160 non-gas |
| — of which **plain moons** | 473 | **547** | 632 |
| — of which planets | 12 | **214** | 509 |
| — of which planet-class moons | 0 | **11** | 19 |
| distinct `uCraterScale` (all bodies) | 25 | **324** | 1160 non-gas |
| distinct `uCraterScale` (cratered only) | 24 | **323** | 485 → 772 cratered |
| distinct `uCraterScale` | 25 | **324** | 632 plain moons |
| distinct `uCraterScale` | 4 | 3 | 509 planets |
| **largest single-value group** | **269** at scale 7.0710678 | **323** at scale 32.274861 | cratered bodies |
| cratered bodies rendering UNDER 1 crater | 119 | **0** | all cratered |
| — of which plain moons | 108 | **0** | 632 |

⛔ **TWO FIGURES IN THE COMMITTED RECORD DO NOT REPRODUCE HERE, AND THEY ARE RECORDED RATHER THAN
OVERWRITTEN.**

1. **A denominator correction.** `5afef82`'s message — and
`docs/FEATURES/comprehensive-wiring-plan-2026-08-20.md:403` repeating it — state *"cratered 485 →
761"* under the heading `1160 non-gas`. **761 is the planets +
plain moons sum (214 + 547); the non-gas total is 772**, because 11 of the 19 planet-class moons also
gained craters and were not counted. PRE is unaffected (0 planet-class were cratered), so the LEG is
larger than its own commit message says, not smaller.

2. **A figure I could not reproduce, named rather than overwritten.** The same two records state
*"distinct `uCraterScale` 21 → 322"*. Measured here **through the shipped driver path** — the
`cu.Dchar > 0 ? sizeKm(Dchar, C_CRATER) : cu.scale` branch, resolved at each body's own
`displayRadiusEarth` by `resolveDriver`, which is what actually reaches a uniform — the pair is
**24 → 323 over cratered bodies** and **25 → 324 over all 1160 non-gas** (the extra value is the
`scale: 1` that `CRATERS_OFF` hands the uncratered ones). Neither reading gives 21 → 322. ⚠ **The
direction and the size of the move are not in dispute** — a ~13× rise in distinct values either way —
and this is recorded as a method disagreement, not as a claim that the committed figure is wrong.

⚠ **AND THE MOVE IS OFF A FLOOR ONTO A CEILING, WHICH NEITHER RECORD SAYS.** Measured here: PRE, the
largest single-value group is **269 cratered bodies sharing scale 7.0710678**; POST it is **323
sharing scale 32.274861**, which is also the corpus maximum. Leg 1 genuinely un-pinned 485 → 772
bodies and 24 → 323 values, **and 42 % of the cratered population still answers with one number.**
That is the next crater question, and it is not this block's.

⭐ **AND THE ENTIRE `uCraterScale` DIFFERENTIATION IS ON THE MOONS.** 25 → 324 distinct over the 1160
non-gas is the *same* 25 → 324 measured over the 632 plain moons alone; the 509 planets go 4 → 3.
Leg 1's distinctness gain is a moon result with a planet-count side effect, and Instrument C — which
samples no plain moon at all (§5) — cannot see any of it.

---

## 5. THE DELTA TABLE — Instrument C, and what it cannot see

Regenerate: `npm run --silent port-uniform-delta:check`. **Run on this tree: exit 2**, on a
PRE-EXISTING Instrument-B structural break that B2 neither caused nor repaired and that was NOT
re-recorded.

### 5.1 THE DENOMINATOR AND THE EXCLUSIONS, STATED BEFORE THE TABLE

- **Bodies in the capture: 526. Bodies now: 633. BODIES COMPARED: 514.**
- **12 excluded as `record changed`** — the generated body itself moved, so a delta across them would
  compare two different planets (e.g. `S:00003:p3`, `S:00007:p4`, `S:00013:p4`).
- **107 excluded as `new`** — bodies that did not exist in the capture at all (e.g. `P:00003:p3:m0`,
  `P:00007:p4:m0`). Every one is a `P:` id, i.e. a **planet-class moon**: the moon-formation window
  created them. `526 − 12 = 514`.
- **Uniforms compared: 55. Uniforms that MOVED: 12.**
- ⛔ **Instrument C's corpus is NOT `lab-procedural-0…199`.** It is numeric seeds `1…N` plus a
  forced-type grid, in three strata: `S:` systems, `P:` planet-class moons, `G:` forced-type grid.

### 5.2 THE 12 MOVED ROWS, EACH WITH ITS TIER

| uniform | **TIER** | kind | moved | signed Δ range | leg |
|---|---|---|---:|---|---|
| `uCraterScale` | `condition` | number | 271/514 | [0.000000e+0, 3.127486e+1] | **1** |
| `uCraterComplexD` | `condition` | number | 271/514 | [−9.978241e−1, 3.467571e−1] | **1** |
| `uCraterAmp` | `condition` | number | 271/514 | [−1.104375e−1, 3.098387e−2] | **1** |
| `uEjectaAmp` | `condition` | number | 271/514 | [−5.521874e−3, 1.549193e−3] | **1** |
| `uCraterDensity` | `condition` | number | 270/514 | [0.000000e+0, 1.766066e−3] | **1** |
| `uEjectaStrength` | `condition` | number | 266/514 | [0.000000e+0, 1.000000e+0] | **1** |
| `uCraterRelaxation` | `condition` | number | 256/514 | [0.000000e+0, 9.700461e−1] | **1** |
| `uEjectaRampart` | `condition` | number | 136/514 | [0.000000e+0, 1.000000e+0] | **1** |
| `uWeatheredColor` | `bake` | Vector3 | 237/514 | [−2.259432e−2, 8.740566e−2] | **2** |
| `uSedColor` | `bake` | Vector3 | 237/514 | [−2.425869e−2, 4.319326e−2] | **2** |
| `uFreshColor` | `bake` | Vector3 | 237/514 | [−1.918580e−2, 0.000000e+0] | **2** |
| `uBioGroundColor` | `bake` | Vector3 | 237/514 | [−1.982138e−2, 0.000000e+0] | **2** |

**PER LEG, from this instrument alone:**

- **Leg 1 moved 8 uniforms**, all at tier `condition`, on 136–271 of 514 bodies.
- **Leg 2 moved 4 uniforms**, all at tier `bake`, on 237 of 514 bodies each. ⭐ `uFreshColor` and
  `uBioGroundColor` move only DOWNWARD (both ranges top out at exactly zero) because
  `applyAlbedoTransfer` solves one exposure scale for the whole palette from `weathered`'s luminance
  — the signature of an exposure renormalisation, not a hue change.
- **Leg 3 moved 0 uniforms in this instrument, and that is correct rather than a failed wire.**
  `uNoiseScale` sits at tier **`record`**, 0/514: this instrument reads the GAME's legacy material,
  where the value is still the drawn record field. **Leg 3 is a lab-side wire and Instrument C is
  structurally blind to it.**

⛔ **AND THE TOOL DISQUALIFIES ITS OWN `record` ROWS ON THIS RUN.** Its printed warning: *"THE
POPULATION MOVED, so the 21 rows at tier `record` are NOT evidence of stability"* — `uNoiseScale`,
`noiseScale` and `noiseDetail` are three of the 21. A `0.000000e+0` on those rows today is *entirely
true and entirely misleading*, and quoting it as leg 3's delta would be exactly the error.

### 5.3 ⚠ INSTRUMENT C SAMPLES **NO PLAIN MOON**, SO IT UNDER-REPORTS LEGS 1 AND 3 BY 632 BODIES

Verified in source, not assumed: the `P:` stratum is built under
`if (!m.isPlanetMoon || !m.planetData) return;`, so **only planet-class moons enter the corpus and
every plain moon is skipped.** The delta table above therefore says nothing at all about the
population where legs 1 and 3 do most of their work. The direct probe supplies it:

| leg | quantity | 632 plain moons, PRE → POST | instrument |
|---|---|---|---|
| **1** | bodies with craters ON | **473 → 547** | direct probe, `5afef82^` vs `5afef82` |
| **1** | distinct `uCraterScale` | **25 → 324** | direct probe |
| **1** | moons rendering under 1 crater | **108 → 0** | direct probe |
| **3** | distinct `uNoiseScale` | **1 → 632** (79 distinct 5 % bins) | direct probe, shipped pack |
| **3** | moons still at the factory 4.0 | **632 → 0** | direct probe |
| **2** | `weathered` bodies moved | **0 → 313** (0 past one quantum) | direct probe, validated mirror |

⚠ **THE LEGACY MOON RANGE, FOR SCALE, AND IT IS NOT A CLEAN SUBSET.** Measured over the same 632:
the game's own record `noiseScale` runs **4.8319 … 510.6324 across 632 distinct values, 0 of them
4.0.** The new lab range is **2.8736 … 245.175**. So the new MAXIMUM sits well inside what ships
today (245 against 511) — but the new MINIMUM sits *below* the legacy minimum, i.e. the calibrated
untidal body carries a **longer** macro wavelength than any moon the game ships. Saying "a strict
subset" would be wrong on the low edge and it is not said.

---

## 6. WHAT EACH LEG DELIBERATELY DID **NOT** DO

- **Leg 3 did not wire `giantDeck`** (§2.5) and **did not clamp at the hot anchor**: clamping the
  tidal ratio at Io would collapse **the 67 hottest plain moons onto one shared value** — the exact
  floor-bound pathology leg 1 was spent removing.
- **Leg 2 did not move `OX_MAX`** (§3.1) and **did not ship the palaeo-temperature window**
  (`OX_T_LO/HI` 150/250 → 110/210), which is derived and measured in the leg-2 document and is the
  larger lever: 18 bodies past a full quantum against this leg's 0.
- **Leg 1 did not re-derive from Sol.** `PLAN.md:409`'s Sol-mass follow-on stays open and untouched;
  the floor was derived from measured render pixels instead, which touches Sol not at all.
- **No baseline was re-recorded by any leg**, and the Instrument-B break that makes
  `port-uniform-delta:check` exit 2 is pre-existing and was left exactly as found.

## 7. THE ONE THING FOR MAX'S EYES

⚠ Above `uNoiseScale ≈ 45`, **26 % of the base stack's amplitude falls below two render px** (§2.4).
The measured case for shipping it uncapped is that the whole new range sits inside what the legacy
material already spends on these moons, and that a cap re-collapses the 67 hottest moons onto one
value. **Whether it reads as fine relief or as noise is Max's eyes, not any instrument's.** The
bodies to look at are the tidally hot moons; the corpus maximum is `lab-procedural-15`, planet 2,
moon 0, at `uNoiseScale` 245.

⚠ And for the palette: at the shipped `uLevels` 6, **87 % of body pairs share a posterized ground
tone** and this leg moves that by about one point. **Raising `uLevels` to 12 moves it by 38 points
with the pre-leg law still in place.** The most useful thing to do at B2's UAT is look at the same
quad at 6 and then at 12.
