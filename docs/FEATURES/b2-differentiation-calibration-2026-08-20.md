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

## ⛔ THE PRECISION CONVENTION, AND IT IS ON EVERY DISTINCT-VALUE COUNT

Two of this document's tables originally counted distinct uniform values at **raw float64**, which
splits one physical value across ULP-adjacent doubles — `32.27486121839514` and `32.274861218395145`
counted as two. That made a table disagree with leg 1's committed record and made a correct committed
figure look unreproducible. It is fixed here in one direction only: **the committed figures were
right and this document was wrong.**

| convention | what it is | used for |
|---|---|---|
| **9 significant figures** | the DEFAULT for every distinct-value count below | every `distinct` row unless the row says otherwise |
| `float32` | the precision a uniform actually reaches the shader at | named wherever it differs from the 9-sig reading |
| raw float64 | the bit pattern in JS | printed only alongside, and never on its own |

⛔ **A count with no convention on it is not a measurement.** On `uCraterScale` the three readings
agree exactly (9 sig = float32 = 21 → 322); on `uNoiseScale` they do not (985 raw → 844 at 9 sig →
780 at float32), which is why the convention is stated per figure rather than once and forgotten.

## ⛔⛔ WHAT ANY OF THIS CHANGES IN A FRAME MAX CAN OPEN TODAY: NOTHING

**Stated before the first number, because every table below is a POST-FLIP reading.** The lab
material is admitted only behind a flag that is OFF —
src/objects/Planet.js:2153 `export const LAB_GAS_BODIES_DEFAULT = false;` and
src/objects/Planet.js:2194 `    admitted: flag.enabled && provenance.isWorldEngine && packs.length > 0,`,
so `Planet._createLabSurface` returns null on every body in a default frame.

**MEASURED over `lab-procedural-0…199`: `rockySurface` SELECTS 1160 of 1160 non-gas bodies and
`0 of 1160` are ADMITTED at the default flag** — the flag alone refuses all 1160.

| leg | what it writes | reaches a pixel at the DEFAULT flag |
|---|---|---|
| **1** `uCraterScale` + 7 | the pack AND the game's own `craterUniformsFrom` | **yes** — leg 1 is a game-side law, which is why Instrument C sees it on 514 bodies |
| **3** `uNoiseScale` | the pack only | **no** — 0 of 1160 |
| **2** the palette | the pack, AND the baked `landPalette` the legacy `Planet` program reads | **528 of 1160** — 509 planets + 19 planet-class. **0 of 632 plain moons**, see §3.2 |

⛔ **This is B2 working as the plan specifies, not a defect.** B2, B3 and B4 are all pre-flip wiring
blocks; **B7 is the plan's only player-facing node.** It is stated here so that no table below can be
read as a claim about what renders today.

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
| 1 | `uCraterScale` | **22 distinct values** over 1160 non-gas bodies (21 over cratered ones); 485 cratered, **465 of them = 95.9 % on ONE shared scale** | **323 distinct** (322 over cratered ones); 772 cratered, **451 = 58.4 %** still on one shared scale | `lab-procedural-0…199`, sha `5afef82`, **9 sig figs** |
| 3 | `uNoiseScale` | **1 distinct value** — the LAB factory `4.0`. ⛔ The MOUNTED legacy material already writes **1160 distinct** on the same bodies | **844 distinct** (985 raw float64, 780 float32) across **83** 5 % bins; 0 still answer 4.0 | same, uncommitted, **9 sig figs** |
| 2 | the ground palette | 1159 distinct `weathered` colours over 1160 | **1159** — ⚠ the palette was never short of values; see §3.0 | same, uncommitted |

⛔⛔ **LEG 3 IS A RE-CALIBRATION, NOT A DIFFERENTIATOR, AND ITS ROW ABOVE IS MEASURED AGAINST THE LAB
FACTORY DEFAULT RATHER THAN AGAINST WHAT RENDERS.** The "1 distinct value" it replaces is
src/worldengine/shaders/uniforms.js:10 `      uNoiseScale: { value: 4.0 },`, the lab's default. What
the mounted material spends today is src/objects/Planet.js:1681 `        uNoiseScale: { value: d.noiseScale },`
and src/objects/Moon.js:73 `        noiseScale: { value: d.noiseScale },` — the generator's own
`rng.range`-shaped draw, MEASURED at **1160 distinct values over the 1160 non-gas bodies at raw
float64, at 9 significant figures and at float32 alike** (509 planets 1.5055…4.9970 · 632 plain moons
4.8319…510.6324 · 19 planet-class 2.1662…4.6128). **Post-flip the swap is 1160 distinct → 844: FEWER
distinct values.** It is the intended trade only because Max ruled the base field must carry a
PHYSICAL wavelength rather than a random draw — the number now MEANS a size in km. ⛔ Do not read
§2 as a differentiation win.

⭐ **Leg 2 is the one whose headline is a refusal, and it is stated here rather than buried.** The
palette leg moves 663 of 1160 bodies and **ZERO of them past one `uLevels` 6 posterize quantum**
(0.1667 — the largest move on `uWeathered` is 0.0995, **0.60 of a quantum**). What makes discs read
alike at the shipped posterize level is the quantum, not the palette law. ⭐ **And B2P — shipped
today — made that quantum raisable**, so the leg becomes visible the moment Max raises it: MEASURED,
at `uLevels` 6 the leg moves body-pair separation by **0.97 points** (12.73 % → 13.70 %) while raising
the level 6 → 12 moves it by **37.82 points** with the pre-leg law still in place. **The posterize
setting is worth about 39× this leg's constants on that measure**, and no constant in
`surfaceMaterial.js` can close that ratio.

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
the calibrated base law is a CONSTANT** 2.873563 against the lab's 4.0 — a 1.39× *longer* wavelength
on every untidal body. **All** of the per-body variation comes from the Io-anchored process term.

⛔⛔ **AND THE SECOND HALF OF THAT HEADLINE, WHICH IS THE ONE THAT DECIDES HOW §2.3 READS: THIS IS A
RE-CALIBRATION, NOT A DIFFERENTIATOR.** Two measured facts, both stated at the top of this document:

1. **It is invisible today.** 0 of 1160 bodies are ADMITTED to the lab material at
   src/objects/Planet.js:2153 `export const LAB_GAS_BODIES_DEFAULT = false;`, so every count in §2.3
   is a POST-FLIP reading.
2. **Post-flip it REPLACES a 1160-distinct legacy draw with an 844-distinct derived one** (9 sig
   figs; 985 raw float64, 780 float32). Fewer values, on purpose: the trade Max ruled for is
   *meaning* — a size in km — not *count*.

### 2.3 THE CORPUS DELTA — measured through the shipped pack

⛔ Re-measured for this document over `lab-procedural-0…199`, resolved through the writer
(`resolveDriver`), not read raw off the pack.

**Distinct-value counts are at 9 significant figures**, per the convention block at the top; the raw
float64 and float32 readings are given beside them because on this uniform the three disagree.

| population | **distinct @ 9 sig** | raw f64 | float32 | 5 % bins | min | max | still at 4.0 |
|---|---:|---:|---:|---:|---:|---:|---:|
| **1160 non-gas** | **844** | 985 | 780 | **83** | 2.873563 | 245.175 | **0** |
| **632 plain moons** | **557** | 632 | 521 | **79** | 2.873563 | 245.175 | **0** |
| 509 planets | 285 | 340 | 266 | 33 | 2.873563 | 56.4358 | 0 |
| 19 planet-class moons | 14 | 16 | 14 | 3 | 2.873563 | 69.8999 | 0 |
| *the LAB default this replaces, all 1160* | *1* | *1* | *1* | *1* | *4.0* | *4.0* | *1160* |
| ⛔ *the MOUNTED legacy draw, same 1160* | ***1160*** | *1160* | *1160* | ***117*** | *1.505478* | *510.6324* | *0* |

⛔ **READ THE LAST TWO ROWS TOGETHER OR THE TABLE LIES.** The `1` is the LAB factory default; the
`1160` is what the game actually writes today and what this replaces after the flip. **1160 → 844 is
a REDUCTION in distinct values, and 117 → 83 a reduction in 5 % bins** — accepted deliberately in
exchange for the value meaning a physical size in km rather than being a draw off a type table. ⚠ The ULP spread is why the convention matters here: 179 of the 1160 sit exactly on the cold
floor at one physical wavelength and present as **four** distinct raw doubles.

⚠ **THE VARIATION IS NOT EVENLY SPREAD, AND THE PLANET HALF GETS FAR LESS OF IT.** 509 planets return
285 distinct values across 33 bins against the moons' 557 across 79. The moons are where this leg
lands, because the tidal process term is where the variation comes from — and MEASURED, 179 of the
1160 (173 of them planets, 1 moon, 5 planet-class) sit below the `log10(1 + t)` float64 underflow at
t = 1.1102e-16 and take the base constant unchanged.

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
factory 4.0 on the lab material. Ruled at `docs/FEATURES/step6-parity-ledger.md:130` (P-10, the solid
half, `carried`), whose cell carries the gas half in prose on P-15's precedent.

⚠ **AND THE GAS HALF IS NOT A SUBJECT ON P-15'S OWN LIST, WHICH THIS DOCUMENT SAYS RATHER THAN LETS
THE CROSS-REFERENCE IMPLY.** `tests/material-parity-list.test.js:540` pins every measured subject to
exactly ONE row, so `uNoiseScale` cannot appear in P-15's subject list while it is P-10's. The gas
half therefore exists as **reasoned evidence in two cells and in no machine-checked ruling column** —
a real gap, named here, and the honest form of it is: the ruling that *is* machine-checked is P-10's
`carried`, and P-10's own cell states that its `carried` covers the solid half only.

---

## 3. LEG 2 — THE OXIDATION WINDOW, RE-ANCHORED ON REAL SURFACES

⛔ **Uncommitted.** Full derivation: `docs/FEATURES/oxidation-window-calibration-2026-08-20.md`;
regenerate every table with `node tools/oxidation-window-delta.mjs`, which prints a CONTROL first.

### 3.0 ⚠ THE HEADLINE IS A NEGATIVE RESULT AND IT LEADS

Re-measured for this document over the 1160 non-gas bodies, with an independent mirror whose CONTROL
run reproduces the shipped `surfacePaletteOf` **BIT-IDENTICALLY over 1160 bodies × 4 endmembers**:

⭐ **THE ONE SENTENCE:** the oxidation window moves **663 of 1160 bodies and ZERO of them past one
`uLevels` 6 posterize quantum.**

- **`weathered` — the endmember the whole disc is painted with: 663 of 1160 bodies move. 50 clear the
  posterize dither window (0.0667), 22 clear half a quantum, `0` clear one full quantum (0.1667). Max
  |Δ| = 0.0995, which is `0.60` of a quantum.**
- `sediment`: 664 move, 0 past dither, `0` past one. Max |Δ| = 0.0454.
- `fresh`: 663 move, 0 past dither, `0` past one. Max |Δ| = 0.0208.

⛔ **At the shipped posterize level this leg is sub-quantum on the entire corpus.** It is a
correctness fix with a real-body rule, and it is not a visibility win at `uLevels` 6.

⭐⭐ **AND THAT IS A STATEMENT ABOUT THE QUANTUM, NOT ABOUT THE LAW — WHICH IS WHY B2P MAKES THE LEG
VISIBLE.** B2P (shipped today) turned `uLevels` into a live setting. MEASURED on body-pair separation
over all 672,220 pairs of the 1160:

| | quantum | pairs separated by > 1 quantum |
|---|---:|---|
| `uLevels` **6**, today's default | 0.1667 | 12.73 % → **13.70 %** — this leg buys **0.97 points** |
| `uLevels` **12**, B2P's setting | 0.0833 | 50.55 % → **54.53 %** — the level alone buys **37.82 points** with the PRE-leg law still in place |

**The posterize setting is worth ≈ 39× this leg's constants on that measure** (37.82 / 0.97), and no
constant in `surfaceMaterial.js` can close that ratio — the quantum is the thing the palette is being
compared against. ⭐ **So: raise `uLevels` to 12 and this leg becomes something to look at. Leave it
at 6 and it is not.** That is the single most useful thing to do at B2's UAT.

⚠ **`uCratonColor` IS DELIBERATELY NOT IN THIS HEADLINE, THOUGH ITS NUMBERS ARE THE LARGEST IN THE
LEG** (698 move, 99 past dither, 54 past half a quantum, max |Δ| = 0.1586 — 0.95 of a quantum, the
biggest figure in this document's §3). **It is demoted because it paints zero pixels on either
mounted material, and ranking the leg by it would rank the dead endmember first.** Verified in
source, not assumed:

- The legacy game program does not have the uniform: `grep -c uCratonColor src/objects/Planet.js
  src/objects/Moon.js` → **0 and 0**. It binds `uFreshColor`, `uWeatheredColor`, `uSedColor` and
  `uBioGroundColor` only.
- On the lab material the pack does write it — src/worldengine/drivers/rockySurface.js:318 `    uCratonColor: sp.craton.slice(),` — and the shader does read it —
  but at exactly one site, src/worldengine/shaders/planetShaders.glsl.js:573 `            vec3 provCol = pw.r * uCratonColor + pw.g * uFreshColor + pw.b * uSedColor;`,
  inside the gate at src/worldengine/shaders/planetShaders.glsl.js:569 `        if (provSum > 0.001) {`.
  `provSum` comes from `sampleProvince` → `uProvinceCube`, declared at
  src/worldengine/shaders/height.glsl.js:177 `      uniform samplerCube uProvinceCube;` and written by
  **nothing in `src/`** — the only value it ever receives is the 1×1 all-zero placeholder built at
  src/rendering/LabPlanetMaterial.js:84 `    const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);`.
  So `provSum` is 0, the branch never runs, and the read is unreachable in any shipped frame.

⭐ Its numbers are kept in §3.2 because `craton === weathered` on most bodies makes it a useful
*proxy* for how far the law moved — but a proxy is not a pixel, and it is not the headline.

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

⛔⛔ **EVERY ROW ABOVE IS THE LAW'S OUTPUT, NOT ITS REACH, AND THE MOON ROWS REACH NOTHING AT ALL.**
A table that prints rows for a population no consumer reads would be claiming coverage it does not
have, so the reach is stated here as its own measurement:

| population | carries a baked `landPalette` | what binds it | leg 2's reach at the DEFAULT flag |
|---|---:|---|---|
| 509 non-gas planets | **509 / 509** | src/objects/Planet.js:1629 `uWeatheredColor: { value: new THREE.Vector3(...(d.landPalette?.weathered` | **336 move — REAL TODAY** |
| 19 non-gas planet-class | **19 / 19** | the same legacy `Planet` program — src/main.js:7681 `        const planetMoon = new Planet(scenePMData, pmStarInfo);` where `scenePMData` is a spread of `moonData.planetData`, so the baked palette carries through | **14 move — REAL TODAY** |
| **632 plain moons** | **0 / 632** | ⛔ **nothing.** `MoonGenerator` never calls `surfacePaletteOf`, and `grep -c 'uWeatheredColor\|uSedColor\|uFreshColor\|uBioGroundColor\|landPalette' src/objects/Moon.js` → **0**. A plain moon's colour is src/generation/MoonGenerator.js:134 `    const palette = rng.pick(this.PALETTES[type]);` | **0 move — the 313 above is a POST-FLIP figure only** |

**So leg 2's pixel reach today is 350 of 1160 bodies** (336 planets + 14 planet-class), not 663. The
other 313 are the value the pack *would* write on the lab material, which no body mounts at
src/objects/Planet.js:2153 `export const LAB_GAS_BODIES_DEFAULT = false;`.

⭐ **The moon rows are still worth printing — no instrument in the repo prints them — and with that
label on them they say two things.** The palette law lands on the moons at almost exactly half the
rate it lands on planets (313 of 632 = 49.5 % against 336 of 509 = 66.0 %), and `craton` and
`weathered` are IDENTICAL on the moon half, which is the `craton === weathered` collapse the leg-2
document reports at 853 → 759 bodies, concentrated there.

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

⛔ **AT 9 SIGNIFICANT FIGURES, per the convention block at the top.** An earlier draft of this
section counted at raw float64 and therefore disagreed with leg 1's committed record; the committed
record was right. Both readings are printed so the disagreement cannot recur silently.

| | PRE | POST | denominator |
|---|---:|---:|---|
| bodies with craters ON | 485 | **772** | 1160 non-gas |
| — of which **plain moons** | 473 | **547** | 632 |
| — of which planets | 12 | **214** | 509 |
| — of which planet-class moons | 0 | **11** | 19 |
| **distinct `uCraterScale`, cratered only** | **21** | **322** | 485 → 772 cratered |
| **distinct `uCraterScale`, all bodies** | **22** | **323** | 1160 non-gas |
| distinct `uCraterScale` | 22 | **323** | 632 plain moons |
| distinct `uCraterScale` | 2 | 2 | 509 planets |
| **largest single-value group** | **465 of 485 = 95.9 %** at scale 7.07106781 | **451 of 772 = 58.4 %** at scale 32.2748612 | cratered bodies |
| cratered bodies rendering UNDER 1 crater | 119 | **0** | all cratered |
| — of which plain moons | 108 | **0** | 632 |

*The same quantities at raw float64, for the record only: distinct cratered 24 → 323, all 25 → 324,
plain moons 25 → 324, planets 4 → 3; largest group 269 (55.5 %) → 323 (41.8 %). Every one of those
splits a physical value across ULP-adjacent doubles — POST's largest group covers exactly two,
`32.27486121839514` and `32.274861218395145`; PRE's covers four.* **At 9 sig figs, at 12 sig figs and
at float32 the readings are identical**, which is what makes 9 sig figs the right convention here.

⛔ **THE COMMITTED FIGURE REPRODUCES EXACTLY, AND AN EARLIER DRAFT OF THIS SECTION SAID IT DID NOT.**
`5afef82`'s message and `docs/FEATURES/crater-floors-calibration-2026-08-20.md:123` state *"distinct
`uCraterScale` 21 → 322"* over cratered bodies. **That is the 9-significant-figure reading through
the shipped driver path** (`cu.Dchar > 0 ? sizeKm(Dchar, C_CRATER) : cu.scale`, resolved at each
body's own `displayRadiusEarth` by `resolveDriver`) and it reconciles to the digit. The earlier
draft's "24 → 323" was the raw-float64 count of the same quantity, and its sentence *"Neither reading
gives 21 → 322"* was wrong. **It is corrected in this direction and not the other: the committed
record is right and this document was wrong.**

⛔ **ONE FIGURE IN THE COMMITTED RECORD REMAINS CORRECTED, AND IT IS A DENOMINATOR, NOT A VALUE.**
`5afef82`'s message and `docs/FEATURES/comprehensive-wiring-plan-2026-08-20.md:403` state *"cratered
485 → 761"* under the heading `1160 non-gas`. **761 is the planets + plain-moons sum (214 + 547); the
non-gas total is 772**, because 11 of the 19 planet-class moons also gained craters and were not
counted. PRE is unaffected (0 planet-class were cratered), so **the leg is larger than its own commit
message says, not smaller.** The committed doc's own branch split reconciles on the same 11:
*"floor binds 465 of 485 → 440 of 761"*, and 440 + 11 = **451**, the POST largest group above.

⚠ **AND THE MOVE IS OFF A FLOOR ONTO A CEILING, WHICH NEITHER RECORD SAYS — AND IT IS 58.4 %, NOT
42 %.** PRE, the largest single-value group is **465 of 485 cratered bodies (95.9 %) sharing scale
7.07106781**; POST it is **451 of 772 (58.4 %) sharing 32.2748612**, which is also the corpus
maximum. Leg 1 genuinely un-pinned 485 → 772 bodies and 21 → 322 values, **and 58.4 % of the cratered
population still answers with one number** — measured, that group is **all 214 cratered planets, all
11 cratered planet-class moons, and 226 of the 547 cratered plain moons.** The un-pinning is real and
it is concentrated entirely in the moon half.

⭐ **AND THE ENTIRE `uCraterScale` DIFFERENTIATION IS ON THE MOONS — MORE SO AT THIS PRECISION THAN
THE RAW COUNT SUGGESTED.** 22 → 323 distinct over the 1160 non-gas is the *same* 22 → 323 measured
over the 632 plain moons alone. **The 509 planets go 2 → 2**: 214 of them gained craters and every
one landed on the ceiling, so at the precision that reaches the shader the planet half gains no
distinctness at all — it gains craters. Instrument C, which samples no plain moon (§5), cannot see
any of the moon result.

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

| leg | quantity | 632 plain moons, PRE → POST | reaches a pixel today | instrument |
|---|---|---|---|---|
| **1** | bodies with craters ON | **473 → 547** | **yes** | direct probe, `5afef82^` vs `5afef82` |
| **1** | distinct `uCraterScale` (9 sig figs) | **22 → 323** | **yes** | direct probe |
| **1** | moons rendering under 1 crater | **108 → 0** | **yes** | direct probe |
| **3** | distinct `uNoiseScale` (9 sig figs) | **1 → 557** (632 raw f64, 521 float32; 79 5 % bins) | **no — 0 of 632 admitted** | direct probe, shipped pack |
| **3** | moons still at the LAB factory 4.0 | **632 → 0** | **no** | direct probe |
| **2** | `weathered` bodies moved | **0 → 313** (0 past one quantum) | **no — no moon material binds a palette** | direct probe, validated mirror |

⛔ **THREE OF THOSE SIX ROWS ARE POST-FLIP READINGS**, per the flag section at the top of this
document. Leg 1's three are real today because leg 1 changed a GAME-side law
(`craterUniformsFrom`), which is exactly why Instrument C can see leg 1 on 514 bodies and cannot see
leg 3 at all.

⛔ **THE LEGACY MOON RANGE, AND THE NEW RANGE IS NOT A SUBSET OF IT.** Measured over the same 632:
the game's own record `noiseScale` runs **4.8319 … 510.6324 across 632 distinct values, 0 of them
4.0.** The new lab range is **2.8736 … 245.175**. The new MAXIMUM sits well inside what ships today
(245 against 511) — but **483 of 632 plain moons (76.4 %) fall BELOW the legacy minimum**, i.e. three
quarters of the moon population would carry a *longer* macro wavelength than any moon the game has
ever shipped. ⚠ An earlier draft of this paragraph narrowed that to "the calibrated untidal body",
singular; the population is 483. And the relationship inverts on the other two kinds, which is why it
must be stated per population and never pooled:

| population | NEW | LEGACY | below legacy min | above legacy max |
|---|---|---|---:|---:|
| 632 plain moons | 2.8736 … 245.175 | 4.8319 … 510.632 | **483 / 632** | 0 / 632 |
| 509 planets | 2.8736 … 56.4358 | 1.5055 … 4.9970 | 0 / 509 | **33 / 509**, up to 11.3× |
| 19 planet-class | 2.8736 … 69.8999 | 2.1662 … 4.6128 | 0 / 19 | **1 / 19** |
| *all 1160 pooled* | *2.8736 … 245.175* | *1.5055 … 510.632* | *0* | *0* |

**The pooled row is the one that made "subset" look true**, and it is true only because the moons'
ceiling covers the planets' and the planets' floor covers the moons'. No population is a subset of
its own legacy range. ⛔ Two shipped source comments asserted the subset claim and both were
corrected in this pass.

---

## 6. WHAT EACH LEG DELIBERATELY DID **NOT** DO

- **Leg 3 did not wire `giantDeck`** (§2.5) and **did not clamp at the hot anchor**: clamping the
  tidal ratio at Io would collapse **the 67 hottest plain moons onto one shared value** — the exact
  floor-bound pathology leg 1 was spent removing.
- **Leg 2 did not move `OX_MAX`** (§3.1) and **did not ship the palaeo-temperature window**
  (`OX_T_LO/HI` 150/250 → 110/210), which is derived and measured in the leg-2 document and is the
  larger lever: 18 bodies past a full quantum against this leg's 0.
- **No leg flipped the lab flag**, so none of legs 2's moon half or leg 3's whole is visible in a
  default frame. That is the plan's sequencing, not an omission — see the flag section up top.
- **Leg 1 did not re-derive from Sol.** `PLAN.md:409`'s Sol-mass follow-on stays open and untouched;
  the floor was derived from measured render pixels instead, which touches Sol not at all.
- **No baseline was re-recorded by any leg**, and the Instrument-B break that makes
  `port-uniform-delta:check` exit 2 is pre-existing and was left exactly as found.

## 7. THE ONE THING FOR MAX'S EYES

⚠ Above `uNoiseScale ≈ 45`, **26 % of the base stack's amplitude falls below two render px** (§2.4).
⛔ **The case for shipping it uncapped is now ONE measured fact, not two** — an earlier draft also
offered "the whole new range sits inside what the legacy material already spends", which §5.3 shows
is false on 483 of 632 moons. **The surviving reason: a cap at the Io anchor would re-collapse the 67
hottest plain moons onto one shared value**, the exact floor-bound pathology leg 1 was spent
removing. **Whether it reads as fine relief or as noise is Max's eyes, not any instrument's** — and
it cannot be looked at until the lab flag is flipped. The bodies are the tidally hot moons; the
corpus maximum is `lab-procedural-15`, planet 2, moon 0, at `uNoiseScale` 245.

⭐⭐ And for the palette, **the one that is real today on 350 bodies**: at the shipped `uLevels` 6,
**87.27 % of body pairs share a posterized ground tone**, and this leg moves that by **0.97 points**
(12.73 % → 13.70 %). **Raising `uLevels` 6 → 12 moves it by 37.82 points with the pre-leg law still
in place — about 39× the leg's own constants.** B2P shipped that setting live for exactly this
reason. **The most useful thing to do at B2's UAT is look at the same quad at 6 and then at 12 in one
sitting**, on a planet or a planet-class moon (a plain moon binds no palette uniform, §3.2).
