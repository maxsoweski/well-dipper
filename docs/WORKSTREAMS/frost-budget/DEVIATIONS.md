# frost-budget — deviations

Where the built thing departs from `contract.json`, and why. Written against the contract, not
around it.

---

## 1. ⚠ AC-1's NUMBERS WERE WRONG WHEN I WROTE THEM, and the reason is worth more than the numbers

AC-1 asks for Earth at "5–15%" with a snowline "poleward of 55°". The `Rocky (Earthlike)` preset
lands at **19.8% extent, snowline 53°**. That misses both bounds, narrowly, and I am not going to
retune a physical constant to hit a bound I invented before I understood the quantity.

**What I had wrong: `frostCover` is an OPACITY, not an area.**
`planetShaders.glsl.js:610` — `albedoCol = mix(albedoCol, frostShade, frostCover);`. So the two
numbers are independent and the contract collapsed them into one:

| | set by | on the Earthlike preset |
|---|---|---|
| **extent** — how much of the sphere is inside the snowline | temperature + latitude | 61.4% → **19.8%** |
| **whiteness** — how white the cap is inside it | volatiles + permanence | 0.198 → 0.167 |

A pale wash over 61% of a world and a white cap over 10% scored the SAME under the metric AC-1 was
written in. The census now reports both columns separately, and the first draft of that file — which
multiplied them into one "painted %" — is the mistake the file's own header now warns about.

⭐ **What Earth's remaining 2× gap actually is, measured rather than tuned:** the snowline is drawn
where the MEAN annual temperature crosses freezing, but permanent ice is what survives SUMMER. That
is why Earth's real ice line sits at ~66° and its mean-annual-freezing line sits near 53°. I built
the seasonal term (amplitude from axial tilt, damped by atmospheric pressure), measured it, and
**dropped it** — see §3.

## 2. ⚠ AC-5's TOLERANCE AVERAGED TWO DIFFERENT CLASSES TOGETHER

AC-5 asks the cold bands to hold "to within 1 percentage point". Stated that way it fails, and the
failure is the AC's, not the law's: a band mean pools bodies that are frozen through with bodies
sitting 1 K under their own freeze point, and a real pole-to-equator gradient is SUPPOSED to bare the
second group's equator.

Restated by **distance below the freeze point**, which is the class Max actually named:

| | n | move by >1 point |
|---|---:|---:|
| more than 40 K below | 83 | **0** |
| 10–40 K below | 35 | **0** |
| within 10 K of the line | 12 | 8 |

**Zero of the 118 genuinely frozen bodies move.** `Frozen (airless)`, `Titan`, `Europa` are
byte-identical. The 8 movers are enumerated by name and margin in the census output; the largest is a
265 K world that freezes at 273 K, i.e. 8 K below the line, whose equator now correctly thaws.

⭐ The census asserts this by class and **exits non-zero if the temperate band does NOT move down** —
the discriminating control from trap 18, because "nothing moved" passes under exactly the bug it is
meant to catch.

## 3. A THIRD TERM WAS DESIGNED, MEASURED, AND DROPPED

The seasonal-margin term above would have closed AC-1's Earth gap. Measured across the population it
moved the anchor body by **0.8 of a percentage point** (13.6% → 12.8%), because the lab presets carry
no `axialTilt` key at all. A third law, a third constant and a new uniform for eight tenths of a
point is not a trade worth making, so it is not in the change.

⚠ **It also collides with an existing term in a way that needs its own thinking, not a hurried
reconciliation.** `frostLatitudeBias` today spreads frost toward LOW latitudes as tilt rises. For
*seasonal* frost that is right. For *permanent* ice it is backwards — high obliquity means fiercer
summers, which pushes permanent ice poleward. Both are true of different things, and the code has one
term. Logged, not fixed.

## 4. `uFrostLatChill` IS CONSTANT ON EVERY MOON — named, not hidden

The gradient is derived from atmospheric pressure, and a plain-moon record carries no atmosphere at
all, so all 632 read pressure 0 and take the identical airless gradient (0.60). The suite caught this
on its own (`driver-pack-solidfeatures.test.js`, "⭐ THE MOON HALF, SEPARATELY — and the three that
stay flat there are named, not hidden") and it is now the fourth entry in that file's `FLAT_ON_MOONS`
list with its reason.

It is the law answering correctly rather than failing — airless bodies DO all have steep
pole-to-equator gradients — and it is the same shape as the `uFrostLatitudeBias` entry above it
(no tilt key on a moon record). It moves the day a moon record carries an atmosphere.

## 5. FOUR SHIPPED FIXTURES RE-CAPTURED, values only

`docs/WORKSTREAMS/frost-budget/recapture-fixtures.mjs` — the instrument `volatile-delivery` wrote,
reused rather than rewritten. Each fixture's own key set is walked and only values are replaced;
structure, pack scope and key set stay byte-identical, and **`uFrostLatChill` is deliberately NOT
introduced into any of them** — a new name is declared at each suite's own `added` gate instead, so
an *undeclared* new driver still reds.

| fixture | capturedFrom | body values | preset values |
|---|---|---:|---:|
| `pack-drivers-baseline.json` | 36ffec2 → aad21bb | 40 | 4 |
| `ray-pack-drivers-baseline.json` | 36ffec2 → aad21bb | 40 | 4 |
| `term-pack-drivers-baseline.json` | 36ffec2 → aad21bb | 40 | 4 |
| `solidrelief-pack-drivers-baseline.json` | 36ffec2 → aad21bb | 40 | 4 |

⛔ **Four PRESET values move, where `volatile-delivery`'s contract required zero — and here that is
the point, not a breach.** `Ocean (temperate)` scored a 0.945 frost budget on a 295 K ocean world and
always has; `Rocky (Earthlike)` sat at 0.198. Both are declared BY NAME in the recapture script,
which **refuses to write** if any preset outside that list moves. The 40 body values are 20
`uFrostMaxCoverage` plus the 20 `uPldStrength` that follow it (PLD = budget × surface age × 0.35).

## 6. ⛔ AC-4 IS NOT VERIFIED — "in high places" still has no measurement

Max's criterion "in high places" is the shader's altitude lapse, and nothing in the tree establishes
its real strength. It needs the running lab, which has not been driven yet. **It is the one AC of the
six objective ones that is open.**

⚠ **And the number I nearly put in the contract for it was wrong.** I read `reliefAmplitude`
(0.6…0.99) as a height and concluded the altitude term was 471× too weak. It is a 0–1 SOFTNESS
multiplier (`labCore.js:1107` `mix(1.0, 0.6, erosion)`), not a height. The shader's `h` is the
accumulated relief field, and sea level runs −0.2…+0.3 (`fluvialDeck.js:174`), so `h` is a
dimensionless field of order 1 and the lapse term is plausible in magnitude — but "plausible" is not
"measured", which is why AC-4 says the number must be read off the live lab with `h`'s observed range
stated beside it.

## 7. What the change does NOT touch

- **The icy-body path.** `uIcenessMix`, `cryoActivity` and `iceness` are untouched; the anchor body
  measures `uIcenessMix` 0, so this is frost deposition throughout.
- **Volatile delivery.** How much water a world has is upstream and shipped.
- **`uFrostLapseRate`.** Named in the follow-up as the second underived knob; left alone pending
  AC-4's measurement, because changing a term before measuring it is what §6 is about.
