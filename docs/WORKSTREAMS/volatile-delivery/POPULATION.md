# volatile-delivery — the population read

**What Max checks first.** Acceptance targets the DRAWN population, never a preset — the charter's own
rule (*"No defaults. Presets are dev fixtures."*). Parent column captured at `a980edc`/`b12ff27`
**before any src edit**, into `tests/fixtures/volatile-delivery-parent-population.json`; HEAD column
re-run from the same script. 200 seeds → 1,577 bodies, 1,183 of them solid.

Re-run: `node --import ./scripts/node-alias-motion-test-kit.mjs scripts/capture-volatile-delivery-baseline.mjs`

## 1. The class that could not exist

| | parent | HEAD |
|---|---:|---:|
| solid bodies | 1,183 | 1,183 |
| temperate (250–320 K) | 135 | 135 |
| wet (V ≥ 0.12) | 352 | 464 |
| ⭐ **temperate AND wet** | **0** | **14** |
| in the plate band (mass ∧ temperate ∧ wet) | 0 | 5 |
| ⭐ **`plate()` reached, 124-body corpus** | **0 of 124** | **4 of 124** |
| corpus wet worlds (`fluvialClassOf`) | 2 of 124 | 7 of 124 |
| bodies pinned at the 0.7 clamp | 0 | 0 |

The first row is the charter's operational test: *a generation law is wrong if it makes a whole class
of physically-real world unreachable.* It was zero over 1,183 bodies, with margin on both sides — the
wettest temperate body was V = 0.0595 against the band's 0.12, and the warmest wet body 186 K against
its 250 K. It is not zero now.

⚠ **Only 4 of the 8 dispatch slots that reach `plate()` come from the band.** The other four arrive
through step 7, `geodynamicRegime === 'mobile'`, because `regimeWeights(V, T)` reads the same field —
so the fix opens the plate path by two roads, not one.

## 2. Through the engine's OWN gate

`labCore.js:693` — `smoothstep(0.05, 0.2, V)`, the *"bone-dry floor at 0.05"*.

| bucket | all solid (parent → HEAD) | **temperate** (parent → HEAD) |
|---|---:|---:|
| `gate == 0` — at/under the bone-dry floor | 626 → 592 | **106 → 98** |
| `0 < gate < 0.25` — essentially dry | 185 → 94 | **29 → 15** |
| `0.25 ≤ gate < 0.75` | 56 → 76 | **0 → 12** |
| `gate ≥ 0.75` — the engine reads this as WET | 316 → 421 | **0 → 10** |

Not one temperate world in 1,183 read wet before. Ten do now, and twelve more sit in the middle band
that did not exist at all.

## 3. Warm planets moved; warm moons correctly did not

Split the 135 temperate bodies by kind, because they are two different physical populations.

| | temperate PLANETS (76) | temperate MOONS (59) |
|---|---|---|
| median V, parent → HEAD | 0.035 → 0.036 | 0.039 → **0.020** |
| p95 V | 0.059 → **0.294** | 0.058 → 0.043 |
| max V | 0.059 → **0.328** | 0.059 → 0.079 |
| past the bone-dry floor 0.05 | 14 → **36** | 15 → **1** |
| past the plate band's 0.12 | 0 → **14** | 0 → 0 |

⭐ **The median warm planet barely moved and the p95 moved five-fold — that is the point.** The law
gives warm worlds a *distribution*, mostly low and occasionally Earth-like, instead of one monotone
dial. The parent's whole temperate population fitted inside 0.011–0.059, a band whose ceiling sat
*below* the engine's own bone-dry floor.

⚠ **Warm moons got DRIER, and that is correct rather than a regression.** Their median mass is
0.0004 M⊕ — they are Luna-scale rocks, and Luna is the anchor that says a body that small holds no
surface water. The parent handed them 0.039 by accident of orbital distance. Fifteen of them used to
clear the bone-dry floor; one does now.

## 4. What did NOT move

- **The eight structural fields are byte-identical on all 1,577 bodies**: radius, mass, density,
  orbit, type, eccentricity, atmosphere, and `tidalState.locked`. This is the load-bearing one —
  `MoonGenerator.js` derives `moon.massEarth` FROM `composition.density` and `checkTidalLock` reads
  that mass, so a rescale rather than a split would have re-rolled every moon's lock state, which is
  the first thing `writeBodyRelief`'s dispatch tests.
- **`locked` stays at 875 of 1,183 (74 %)**, so the REPORT's Block B is untouched and still open.
- **The 18 driver presets: ZERO values moved**, in all four shipped baseline fixtures. They are dev
  fixtures and the engine's real-body anchors; this workstream moved the generator to them.
- **Instrument C: 47 of 57 shipped game uniforms unmoved**, all 633 bodies matched by id.
- **Zero edits under `src/worldengine/`.**

## 5. The blast radius, measured — and attributed

156-body corpus, every claiming driver pack resolved: **919 of 12,481 values moved (7.4 %)**.

| pack | moved | | uniform | moved |
|---|---:|---|---|---:|
| rockySurface | 446 | | uCratonColor | 88 |
| solidFeatures | 182 | | uWeatheredColor / uFreshColor / uSedColor / uBioGroundColor | 80 each |
| solidRelief | 127 | | uFrostMaxCoverage | 52 |
| giantSurface | 70 | | uPldStrength | 49 |
| fluvialDeck | 44 | | uLdaFat | 42 |
| solidOptics | 30 | | uScarpStyle | 36 |
| limbDeck | 12 | | uFrostCondensationT | 31 |
| craterDeck | 8 | | uSubStrength / uGlacialStrength | 26 each |

⭐ **[CONTROL] — and this is the part that makes the table mean something.** A before/after table shows
that values moved; it cannot show *why*. So the comparison is run a second time with the parent's own
`volatileFraction` injected back into every HEAD body and **nothing else restored**: all 12,481 values
return to byte-identity, **residual 0**. Every moved value has one cause and no second cause is hiding
in the diff. Vacuity arm: 919 move without the restore.

Re-run: `node --import ./scripts/node-alias-motion-test-kit.mjs docs/WORKSTREAMS/volatile-delivery/blast-radius.mjs`

## 6. The shipped game uniforms (Instrument C)

10 of 57 moved; the other 47 did not. Every one that moved reads the volatile budget:

| uniform | bodies moved (of 633) |
|---|---:|
| uWeatheredColor · uFreshColor · uSedColor · uBioGroundColor | 340 each |
| uEjectaRampart | 133 |
| uTermColor | 106 |
| uLimbExponent | 98 |
| uBioGroundCover | 75 |
| uIcenessMix | 65 |
| uLimbColor | 63 |

`uIcenessMix` reads density **and** volatiles; density is unchanged, so its 65 are the volatile half
alone.
