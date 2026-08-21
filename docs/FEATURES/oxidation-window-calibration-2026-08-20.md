# The oxidation window, re-derived from reference bodies — B2 leg 2

**Block** B2 "The differentiation calibration", leg 2 (the palette leg).
⭐ **B2 ships ONE calibration deliverable across all three legs and it is
`docs/FEATURES/b2-differentiation-calibration-2026-08-20.md`** — this file stays the full oxidation
derivation; that one carries the block's delta table and the 632-moon split no instrument prints.
**Corpus for every corpus number below:** `lab-procedural-0…199` = **1517 bodies**, of which **1160 are
non-gas** (509 planets + 632 plain moons + 19 planet-class) and 357 are gas. ⛔ **Sol is not in it and
cannot be** — nothing here is measured on Sol.
**Regenerate every table:** `node tools/oxidation-window-delta.mjs`. That tool prints a CONTROL first: its
parameterised mirror of `surfaceAlbedoOf` must reproduce the shipped `surfacePaletteOf` bit-for-bit over all
18 driver presets × 4 endmembers, or the tables it prints are void.

---

## 0. What moved

`src/worldengine/base/surfaceMaterial.js`, two constants:

| | before | after | the rule the number now carries |
|---|---|---|---|
| src/worldengine/base/surfaceMaterial.js:194 `export const OX_VOL_LO     = 0.02;` | 0.03 | **0.02** | = Luna's and Mercury's own volatile budget. The reference **unoxidised** bodies read exactly 0. |
| src/worldengine/base/surfaceMaterial.js:195 `export const OX_VOL_HI     = 0.10;` | 0.12 | **0.10** | = Mars's own budget. The reference **oxidised** body **saturates** the gate. |
| src/worldengine/base/surfaceMaterial.js:204 `export const OX_MAX        = 0.60;` | 0.60 | **0.60 — held** | re-examined and not moved; §5. |

They are spent at one place, `surfaceAlbedoOf`'s oxidation stage, so **both front-ends move together and
cannot disagree**: src/generation/PlanetGenerator.js:809 `planetData.landPalette = applyAlbedoTransfer(surfacePaletteOf(condition), {` bakes the
record's palette, and src/worldengine/drivers/giantSurface.js:156 `const sp = applyAlbedoTransfer(surfacePaletteOf(condition), { extra: { pigment: BIO_PIGMENT } });`
derives the pack's from the same two functions in the same order. The uniforms they reach are consumed on the **whole disc with no
gate**: src/worldengine/shaders/planetShaders.glsl.js:565 `vec3 groundCol = uWeatheredColor;` and
src/worldengine/shaders/planetShaders.glsl.js:578 `groundCol = mix(groundCol, uSedColor,   terrLowFlat * uTerrainAlbedoMix);`.

⛔ **`uCratonColor` was the plan's stated target and is NOT this leg's object.** Its only executable use is
src/worldengine/shaders/planetShaders.glsl.js:573 `vec3 provCol = pw.r * uCratonColor + pw.g * uFreshColor + pw.b * uSedColor;`,
inside `if (provSum > 0.001)`, and src/rendering/LabPlanetMaterial.js:110 `export function ensureLabSamplers(uniforms, shaderSource) {`
binds `uProvinceCube` to a 1×1 placeholder because the game never runs the lab's bake route. The 73.5 %-of-non-gas `uCratonColor === uWeatheredColor` equality is real and
paints zero pixels. It still moves here as a side effect: 853 → **759** of 1160 bodies carry the equality.

---

## 1. The reference bodies

The gate reads `composition.volatileFraction`. That quantity already has a **real-body scale in this
repository** — `driver-presets.js`, whose rows are named after real bodies — and that is the scale used
here, rather than any statistic of the generator's own draw:

| body | `volatileFraction` (driver-presets.js) | real volatile budget | **observed surface oxidation** | what the gate must therefore do |
|---|---:|---|---|---|
| **Mercury** | 0.02 (shares the `Moon/Mercury (impact-airless)` row) | essentially anhydrous; trace polar cold-trap ice only | **none.** Surface FeO < 2 wt %, sulfide-bearing, oxygen fugacity several log units below the iron–wüstite buffer — one of the most reduced planetary surfaces known. Grey. | **exactly 0** |
| **Luna** | 0.02 | bulk water at the ppm level | **none.** fO₂ ≈ IW−1; iron present as Fe²⁺ in mare basalt and as **native Fe⁰** nanophase metal in the agglutinates; Fe³⁺ effectively absent. Bond albedo ≈ 0.12, grey. | **exactly 0** |
| **Venus** | 0.02 | bone dry today (atmospheric H₂O tens of ppm; D/H says an ocean was lost) | **partial, and by a different mechanism** — CO₂/SO₂ at 737 K, not water. Venera true-colour reads dark grey-brown basalt. | 0 here — see the declared gap, §6 |
| **Mars** | 0.10 | several wt % water-equivalent hydrogen in the regolith, plus a lost ocean's worth | **saturated.** Dust Fe³⁺/ΣFe ≈ 0.7–0.9 nanophase ferric oxide; the reddest surface measured anywhere. | **exactly 1** |
| **Earth** | 0.15 | oceans plus a hydrated mantle | **saturated.** Crust equilibrated against a 21 % O₂ atmosphere; lateritic ferricrete is the deep-weathering endmember. | **1** (and it sits above Mars, so it saturates either way) |

**The window falls out of the two ends of that column**, and both edges sit **ON** a body rather than in a
gap between bodies:

```
OX_VOL_LO = 0.02   ← Luna and Mercury, the reference UNOXIDISED bodies
OX_VOL_HI = 0.10   ← Mars,             the reference OXIDISED body
```

### ⚠ What was wrong with the pre-leg pair, stated as the thing corrected

`0.03 / 0.12`. **Neither edge sat on a body.** The consequence that matters is at the top end: 0.12 is above
Mars's own budget, so **the archetype of an oxidised surface was held at 0.8738 of its own oxidiser gate**
rather than saturating it. At the bottom, 0.03 zeroed a band above Luna that no reference body occupies.

### ⚠ The weakest row is Venus, and it is weak in a way the window cannot fix

Venus carries the same 0.02 as Luna and Mercury and reads 0, yet Venus's surface **is** partly oxidised.
This law has no oxidiser channel but water, so it cannot express a CO₂/SO₂-driven oxidation at all. That is
**declared, not repaired** — adding one is a new law, not a constant. Venus is therefore an anchor for
neither edge; it is listed because leaving it out would make the bracket look tighter than the evidence is.

---

## 2. ⛔ The corpus-fitted window, refused

A recon proposed `0.015 / 0.080` with `OX_MAX` 0.80, fitted to this generator's own `volatileFraction`
histogram (measured on the 1160 non-gas: min 0.0100, p25 0.0266, median 0.0444, p75 0.1135, max 0.6495).

**Measured, it is the better-scoring option**: 87 bodies past one posterize quantum against 0, and
23.66 % of body pairs separated by more than a quantum against 13.70 %.

**It is refused anyway**, for one reason that is a fact about a real body and not a preference:
`smoothstep(0.015, 0.080, 0.02) = 0.0168`, so **0.015 hands Luna and Mercury a non-zero oxidiser gate.** The
two bodies in the reference set with no ferric iron at all would begin to rust. Fitting the edges to our own
draw is exactly how a world-generation defect gets laundered into a palette law, and the score it buys is
bought by breaking the anchor the law is for.

**The disagreement between the two windows is reported rather than resolved by scoring**: the real-body pair
ships; the fitted pair is recorded here and refused.

---

## 3. Reference-body delta (through the shipped functions)

`volGate` is `smoothstep(OX_VOL_LO, OX_VOL_HI, vf)`; `ox_w` / `ox_c` are the oxide **mix fraction** on the
weathered and craton branches; the hexes are post-`applyAlbedoTransfer` display values.

| preset | vf | volGate before → after | ox_w before → after | weathered | craton |
|---|---:|---|---|---|---|
| Moon/Mercury (impact-airless) | 0.02 | 0.0000 → **0.0000** | 0.0000 → 0.0000 | `#4f4035` → `#4f4035` | `#4f4035` → `#4f4035` |
| Venus (sulfuric shroud) | 0.02 | 0.0000 → **0.0000** | 0.0000 → 0.0000 | `#766f65` → `#766f65` | `#766f65` → `#766f65` |
| **Mars (arid rocky)** | 0.10 | 0.8738 → **1.0000** | 0.3397 → **0.3888** | `#b77b5a` → **`#ba7958`** | `#b77b5a` → **`#ba7958`** |
| Rocky (Earthlike) | 0.15 | 1.0000 → 1.0000 | 0.0000 → 0.0000 | `#6e675e` → `#6e675e` | `#fc8f5e` → `#fc8f5e` |
| Europa (icy moon) | 0.50 | 1.0000 → 1.0000 | 0.0000 → 0.0000 | `#8e7660` → `#8e7660` | `#8e7660` → `#8e7660` |
| Titan (methane seas) | 0.40 | 1.0000 → 1.0000 | 0.0000 → 0.0000 | `#9c9486` → `#9c9486` | `#9c9486` → `#9c9486` |

⭐ **Mars is the only reference body that moves, and it moves by three units in the red channel.** That is
the honest size of a correctly-aimed real-body recalibration on a body that was already 87 % of the way
there. Every other reference row is unmoved **by construction**, which is the check that the edges did not
silently disturb the bodies they were derived from.

---

## 4. Corpus delta — and the finding that matters more than the delta

Display domain, `max |Δ|` over the three channels, against the **`uLevels` 6 quantum, 1/6 = 0.1667** (the
shipped default, src/worldengine/shaders/uniforms.js:32 `uLevels:     { value: 6.0 },`). The `>0.0667` column is the posterize **dither
window** (`edgeWidth 0.4 / levels`), the amplitude below which a change cannot move even a dithered pixel a
full level.

| endmember | bodies moved | > dither window | > ½ quantum | **> 1 quantum** | median Δ | p90 Δ | max Δ |
|---|---:|---:|---:|---:|---:|---:|---:|
| `weathered` | 663 / 1160 | 50 | 22 | **0** | 0.0005 | 0.0472 | 0.0995 |
| `sediment` | 664 | 0 | 0 | **0** | 0.0003 | 0.0245 | 0.0454 |
| `craton` ⚠ paints 0 px | 698 | 99 | 54 | **0** | 0.0012 | 0.0593 | 0.1586 |
| `fresh` | 663 | 0 | 0 | **0** | 0.0001 | 0.0101 | 0.0208 |

⛔ **`craton` CARRIES THE LARGEST NUMBERS IN THIS TABLE AND THE FEWEST PIXELS**, per §0 — it is kept as
a proxy for how far the law moved and must not be read as the leg's headline. **`weathered` is the row
that paints the disc**, and its honest headline is: **663 of 1160 bodies move and ZERO of them past one
`uLevels` 6 quantum** — the largest move, 0.0995, is 0.60 of a quantum. ⭐ **B2P made the quantum
raisable, which is what turns this leg visible**: MEASURED, at `uLevels` 6 the leg buys 0.97 points of
body-pair separation and raising the level 6 → 12 buys 37.82 points with the PRE-leg law still in place
(§6) — **about 39×**.

### ⚠ AND THE ROWS ABOVE ARE THE LAW'S OUTPUT, NOT ITS REACH — 0 of the 632 plain moons

MEASURED per kind. The `1160` denominator above is the population the LAW covers; the population a
palette uniform actually reaches today is smaller, and the difference is the whole moon half:

| population | carries a baked `landPalette` | reached today |
|---|---:|---|
| 509 non-gas planets | **509 / 509** | ✅ src/objects/Planet.js:1629 `uWeatheredColor: { value: new THREE.Vector3(...(d.landPalette?.weathered` binds it — **336 move** |
| 19 non-gas planet-class moons | **19 / 19** | ✅ the same legacy `Planet` program — src/main.js:7681 `const planetMoon = new Planet(scenePMData, pmStarInfo);` — **14 move** |
| **632 plain moons** | **0 / 632** | ⛔ **nothing binds a palette on a plain moon.** `grep -c 'uWeatheredColor\|uSedColor\|uFreshColor\|uBioGroundColor\|landPalette' src/objects/Moon.js` → **0**; a plain moon's colour is src/generation/MoonGenerator.js:134 `const palette = rng.pick(this.PALETTES[type]);`. The 313 that "move" is a POST-FLIP figure |

**Leg 2's pixel reach today is 350 of 1160 bodies**, not 663 — and the lab material that would carry
the other 313 is admitted on no body at src/objects/Planet.js:2153 `export const LAB_GAS_BODIES_DEFAULT = false;`.

Other corpus movements: oxide mix values **534 → 699 distinct**; bodies with oxidation exactly zero
**627 → 462**; `craton === weathered` **853 → 759**.

### ⭐ THE FINDING: the palette is not short of values, it is short of QUANTA

**Distinct `weathered` colours over the 1160 non-gas bodies: 1159 before, 1159 after.** The ground palette
was already carrying a different float triple for all but one body **before this leg ran**. Nothing about
"the discs look alike" is a shortage of derived values.

What it is short of is quantization headroom:

| | quantum | pairs separated by > 1 quantum, before → after |
|---|---:|---|
| **`uLevels` 6 — today's default** | 0.1667 | **12.73 % → 13.70 %** |
| `uLevels` 8 | 0.1250 | 27.48 % → 29.86 % |
| **`uLevels` 12** | 0.0833 | **50.55 % → 54.53 %** |
| `uLevels` 16 | 0.0625 | 65.00 % → 68.93 % |
| `uLevels` 24 | 0.0417 | 80.37 % → 83.18 % |

(all 672,220 pairs, `max |Δ|` on `weathered`.)

⭐ **At the shipped default, 87.27 % of body pairs land on the same posterized ground tone. This leg takes
that to 86.30 % — a gain of 0.97 points.** Raising `uLevels` from 6 to 12 — one setting, no law change,
already shipped and raisable as block **B2P** — takes the same figure from 87.27 % to 49.45 % **with the
pre-leg law still in place**: a gain of 37.82 points. ⛔ **On this measure the posterize setting is worth
about 39× the palette law**, and no constant in `surfaceMaterial.js` can close that ratio, because the
quantum is what the palette is being compared against.

---

## 5. `OX_MAX` — re-examined, and held at 0.60

Two measured facts about the constant, neither of them previously recorded:

1. **It is a ceiling on exactly two presets and on none of the corpus.** `clamp01(product)` reaches 1 only
   on `Rocky (Earthlike)` and `Eyeball (locked temperate)`, both on the `stable` craton branch. Over the
   1160 non-gas bodies the largest product is 0.399, so **on the corpus `OX_MAX` is not a ceiling at all —
   it is a flat 0.6× gain applied to every body at once.**
2. **The real-body rule that would raise it refuses.** Reproducing Martian bright-region red/blue
   (≈3.3 in Rec.709-ish bands) through the rest of this chain needs an oxide mix of **0.771** on a product
   of **0.648**, i.e. `OX_MAX` = **1.19** — not a legal mix fraction. Targeting R/B 3.0 asks 1.07; targeting
   4.0 asks 1.40. The law reaches R/B **2.12** on Mars after this leg (2.02 before).

So the chain under-reds Mars by roughly 1.6×, **and the term holding it back is not this cap.** It is
`palaeoWater`: `OX_T_HI = 250` puts Mars's 210 K at **0.6480**. `OX_T` is a different window and was outside
this leg's scope; §7 carries the arithmetic for whoever opens it.

Raising `OX_MAX` was therefore refused on two counts — it has no real-body rule that lands inside [0,1], and
the module's own recorded refusal (a fully mature, fully stable surface must not become pure hematite:
`Rocky (Earthlike)`'s craton is already `#fc8f5e` at 0.60) stands. **What raising it would buy is recorded
here so the decision is Max's and not silently mine:** at 0.80, bodies past ½ quantum go 22 → 88 and pairs
past a quantum go 13.70 % → 15.56 %; at 1.00, 22 → 136 and 13.70 % → 18.33 %.

---

## 6. Declared non-goals

- **No re-keying of redness on `ironFraction`.** The module refuses it twice and the refusal is right; the
  gate is saturated at exactly 1.0 on **1160 of 1160** non-gas bodies, so it carries no per-body signal here.
- **No re-gating of carbon.** `carbonToOxygen` is **0 on 1160 of 1160** at the `> 1.0` gate (corpus max
  0.7853); lowering that gate would make a graphite crust out of a C:O of 0.6.
- **No oxidiser channel other than water**, so Venus's CO₂/SO₂ oxidation is unreachable. §1.
- **No `OX_T` move.** Out of scope; §7.
- **Nothing measured on Sol.**

---

## 7. The palaeo-temperature lever, measured but not shipped

Derived the same way as §1, from the same reference set: Mars at 210 K demonstrably had liquid water
(valley networks, phyllosilicates, sulfates), so a palaeo gate that saturates must saturate **at or below
210 K**; Titan (94 K) and Europa (102 K) never had liquid water, so the low edge must sit **at or above**
them. That reads `OX_T_LO = 110`, `OX_T_HI = 210` against today's `150 / 250`.

Measured on the same corpus, change-from-today on `weathered`:

| variant | moved | > dither | > ½ q | **> 1 q** | max Δ | pairs > 1 q @ L6 | @ L12 |
|---|---:|---:|---:|---:|---:|---|---|
| today `vol[0.03,0.12] T[150,250]` | 0 | 0 | 0 | 0 | 0.0000 | 12.73 % | 50.55 % |
| **this leg** `vol[0.02,0.10] T[150,250]` | 663 | 50 | 22 | **0** | 0.0995 | 13.70 % | 54.53 % |
| + palaeo `vol[0.02,0.10] T[110,210]` | 831 | 175 | 123 | **18** | 0.2136 | 15.71 % | 58.19 % |
| palaeo alone `vol[0.03,0.12] T[110,210]` | 373 | 74 | 59 | 17 | 0.2136 | 14.94 % | 54.50 % |

It is the larger of the two levers and it is real-body derivable. It is not in this leg because the leg was
scoped to the oxidiser window; it is a two-constant change in the same file if Max wants it.

---

## 8. Instrument C — the shipped-uniform delta

`npm run --silent port-uniform-delta:check`. ⛔ It exits **2** on a **pre-existing** structural break (the
comparison population moved before this leg); that break is not this leg's and was not repaired or
re-recorded. **514 bodies still compare, and this is B2 leg 2's delta table.** Unlike leg 3, which was a
lab-side wire this instrument cannot see, leg 2 moves the **baked** `landPalette` and is therefore fully
visible here.

Captured before the edit and after, and diffed:

| uniform | tier | bodies moved | signed Δ range |
|---|---|---:|---|
| `uWeatheredColor` | bake | **237 / 514** | [−2.259432e−2, 8.740566e−2] |
| `uSedColor` | bake | **237 / 514** | [−2.425869e−2, 4.319326e−2] |
| `uFreshColor` | bake | 237 / 514 | [−1.918580e−2, **0.000000e+0**] |
| `uBioGroundColor` | bake | 237 / 514 | [−1.982138e−2, **0.000000e+0**] |

The other 8 moved rows are leg 1's crater family, byte-identical to the pre-leg-2 capture. Nothing else
moved: `uNoiseScale` still reads 0/514, correctly, for leg 3's recorded reason.

### ⭐ Why `uFreshColor` and `uBioGroundColor` move, and why their range is one-signed

`surfaceAlbedoOf` skips the entire oxidation stage under `altered: false`, so the **fresh** endmember cannot
carry an oxidation change — and `tests/port-condition-contract.test.js` measures exactly that on the
pre-transfer palette, where `fresh` is pinned at **16 bodies and did not move** while `weathered` and
`sediment` went 129 → 144 and `craton` 141 → 150. That row is the leg's own negative control.

What moves them here is `applyAlbedoTransfer`, which solves **one exposure scale for the whole palette from
`weathered`'s luminance**. A redder, slightly brighter weathered endmember lowers that scale, and every
other endmember — fresh and the biosphere pigment included — comes down with it. Hence **both ranges top out
at exactly 0.000000e+0**: they only ever darken, which is the signature of an exposure renormalisation and
not of a hue change. Two instruments in two domains, agreeing.
