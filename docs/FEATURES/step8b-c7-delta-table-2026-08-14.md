# Step 8b / break C7 — the delta table, measured before the change

**Date:** 2026-08-14 · **Measured at:** HEAD `59b48ac` on `feature/world-engine-production-L1`,
all four instruments green.
**Status when written:** PREDICTION. Not one tracked file had been modified when these numbers were taken.

> ⭐ **Why this document exists.** The build plan's declared 8b delta table has **no geometry columns**,
> and its safety claim (`radiusEarth` 0/400) measured a field that `_generatePlanetMoon` overwrites
> two lines later. Handoff [`step8-handoff-c7-2026-08-14.md`](step8-handoff-c7-2026-08-14.md) §2
> required this table to carry the geometry columns before any src edit. This is that table.

**Method.** Five measurement lanes and five independent adversarial verifiers, across seven substitution
techniques. **Two harnesses each passed a byte-identical control before any delta was accepted**: an
in-process static-property swap (221 seeds, 6,358,435 bytes, sha256 `f84a7e05…` identical between an
unpatched run and a patched-but-inert run) and a real one-line source edit in a detached `git worktree`
(3,277,724 bytes, sha256 `3791ed14…`, `cmp` exit 0). A harness that cannot reproduce the current
universe exactly is measuring itself — see handoff §4.1.

---

# C7 — Substitute the parent's real pre-migration AU into planet-class moon generation

**Change under test.** `src/generation/MoonGenerator.js:378`, inside `_generatePlanetMoon`:

```js
- const pData = PlanetGenerator.generate(rng, 1.0, planetData.sunDirection, zones, planetType);
+ const pData = PlanetGenerator.generate(rng, Math.max(parentOrbitAU ?? 1.0, 0.01), planetData.sunDirection, zones, planetType);
```

Same convention already shipped for plain moons at `MoonGenerator.js:252-254`. `parentOrbitAU` is the 7th arg of `MoonGenerator.generate` (`:117`), forwarded at `:124`/`:371`; `StarSystemGenerator.js:595` passes the **pre-migration** `orbitRadiusAU` (migration mutates in place at `:655`, `snapToResonances` at `:682`, both **after** the moon loop at `:592-599`).

Measured at HEAD `59b48ac` on `feature/world-engine-production-L1` by five measurement lanes and five independent adversarial verifiers, across seven substitution techniques (in-process static-property swap; `git worktree` source edit; `git archive` tree source edit; non-git file-copy tree source edit; Node `module.register` ESM load-hook transform; `module.registerHooks` transform; vitest `setupFiles` injection). Every number below was re-derived from the retained raw artifacts in this document's own pass.

> ⚠ **LINE NUMBERS IN THIS DOCUMENT ARE AS OF `59b48ac`, before the change.** One has since
> moved and it is the important one: the convention-discriminating assertion cited throughout
> as `moon-rng-stream-identity.test.js:280` is at **`:288`** after the gate re-derivation at
> `ab173a3`. Anchor to the symbol, not the number — `expect(Math.min(...nums(planetClass))).toBe(19);`
> (the `18` quoted below was the pre-C7 value; the gate now pins `19`).

---

## Corpora

Every count below names one of these. **They are not interchangeable.**

| Tag | Definition | Population |
|---|---|---|
| **FENCE-221** | Instrument B, `tests/body-identity-fence.test.js:93-120` — 192 bulk `wd-0`…`wd-191` + 5 pinned (`wd-356`, `wd-395`, `wd-614`, `wd-2232`, `wd-1403`) + 24 galaxy `gc-0`…`gc-23` (`GalacticMap('body-identity-fence')`, golden-angle spiral) | 961 planets · 794 moons = **770 plain + 24 planet-class** |
| **MC-197** | `tests/moon-condition-contract.test.js` | 705 plain + 23 planet-class moons |
| **PCC-120** | `tests/port-condition-contract.test.js`, seeds `pcc-0`…`pcc-119` | 526 planets · 411 moons · 12 planet-class |
| **PRA-600** | `tests/port-route-agreement.test.js`, 600 integer seeds | 2485 planets · 29 planet-class moons |
| **STREAM-1500** | `tests/moon-rng-stream-identity.test.js`, `wd-0`…`wd-1499` | 5207 `MoonGenerator.generate` calls = 5038 plain + 169 planet-class; 64 keys / 105 pairs |
| **IC-526** | `tools/port-uniform-delta.mjs` capture | 526 bodies = 372 S + 64 P + 90 G |
| **MR-14** | `tests/moon-mass-radius-consistency.test.js` (4-arg harness) | 14 bodies |

**Call counts, which are not body counts.** `_generatePlanetMoon` runs **26 times on FENCE-221** and yields **24** surviving planet-class moons — two parents are culled (migration removal `StarSystemGenerator.js:648`, stability filter `:724`): `wd-144/m1` (preAU 7.0124) and `wd-170/m4` (preAU 8.7420), both draw-delta 0. A fence-shaped double-pass sweep makes **52** calls. Instrument C's `--record` makes **142** (two `buildPopulation` passes × 71 = 67 P-scan + 4 S-loop), of which 3 P-scan parents are culled, giving 64 P bodies. **A gate asserting `substitutionsApplied === 24` reds for the wrong reason.**

---

## 1. Delta table — columns that MOVE

All planet-class-moon rows are **FENCE-221 / 24 planet-class moons** unless stated. Exemplar `wd-24/1/2` = seed `wd-24`, planet index 1, moon index 2 (parent preAU 0.2200).

### 1a. Geometry — the moon's size, orbit and motion

These are the columns the build plan's declared table omits. They move because a draw-count shift inside `PlanetGenerator.generate` rewrites the `rng` draws that follow at `MoonGenerator.js:381-402`. Movement is **all-or-nothing per body**: the same 7 bodies move every geometry column, and the other 17 are bit-identical on all of them.

| Column | Moved | Magnitude | Example |
|---|---|---|---|
| `moon.radiusEarth` | **7 / 24** | ratio 0.974× – **1.969×**; fractional \|Δ\| 0.0257 / 0.2256 / 0.9691 (min/med/max); abs 2.192e-2 / 9.435e-2 / 1.066 R⊕ | `wd-24/1/2` 0.8542719322647017 → 0.8323499920658196 |
| `moon.radiusScene` | **7 / 24** | abs 9.339e-4 / 4.019e-3 / 4.541e-2 | `wd-24/1/2` 0.036391984314476294 → 0.03545810966200392 |
| `moon.radius` (map units) | **7 / 24** | abs 6.979e-3 / 2.938e-2 / 2.855e-1 | `wd-24/1/2` 0.2719570032255837 → 0.26497816553209486 |
| `moon.orbitRadiusEarth` | **7 / 24** | fractional 0.0422 / 0.1585 / 0.4210; abs 3.752 / 17.55 / 110.8 R⊕ | `wd-24/1/2` 148.17567349373306 → 124.68952426301077 |
| `moon.orbitRadiusScene` | **7 / 24** | abs 1.598e-1 / 7.478e-1 / 4.718 | `wd-24/1/2` 6.312283690833028 → 5.311773733604259 |
| `moon.orbitRadius` (map units) | **7 / 24** | fractional 0.0019 / 0.0314 / 0.1319; abs 5.230e-3 / 1.226e-1 / 1.402 | `wd-24/1/2` 6.860184695815115 → 6.965764508984433 |
| `moon.orbitSpeed` | **7 / 24** | fractional 0.0442 / 0.1752 / 0.3449; abs 6.565e-7 / 1.741e-6 / 4.409e-6. **Sign is +1 on 24/24 in every arm** — `MoonGenerator.js:400` is a strictly positive range; a planet-class moon can never be retrograde | `wd-24/1/2` 7.98036e-6 → 1.02117e-5 |
| `moon.inclination` | **7 / 24** | abs 5.351e-2 / 9.329e-2 / 1.792e-1 rad. **Crosses zero** — fractional max reads 33.0070 for that reason | `wd-24/1/2` −0.01872899627778679 → **+0.06188270200509577** (sign flip) |
| `moon.startAngle` | **7 / 24** | abs 5.253e-1 / 2.213 / 3.715 rad | `wd-24/1/2` 4.671631776946428 → 2.4837628558125346 |
| `moon.tidalHeating` | **7 / 24** | fractional 0.896× / 26.87× / **563.7×**; abs 0.0404 – 90.47 | `wd-27/3/1` 0.16832300124312666 → 90.64010915372455 |
| `pd.massEarth` (nested) | **7 / 24** | fractional 0.0750 / 0.8412 / 6.6352; abs 1.467e-2 / 5.178e-2 / 5.714 M⊕. Worst `wd-27/3/1` 0.861 → 6.575 M⊕ (7.64×) | `wd-24/1/2` 0.24783730219561398 → 0.2292430614075487 |
| **derived surface gravity** `pd.massEarth / pd.radiusEarth²` | **7 / 24** | **0.974× – 1.969×** — exactly the radius ratio, because `MoonGenerator.js:419-427` rescales mass as R³, so M/R² ∝ R. This is the quantity `MoonGenerator.js:413-418` exists to protect (`reliefEnvelope` and every gravity-dependent law) | `wd-27/3/1` gravity 1.969× |

**The 7 geometry movers, enumerated:** `wd-24/1/2`, `wd-27/3/1`, `wd-66/0/1`, `wd-100/5/1`, `wd-174/0/1`, `wd-189/0/1`, `gc-22/2/2`.

### 1b. Temperature, condition and physics

| Column | Population | Moved | Magnitude | Example |
|---|---|---|---|---|
| `pd.T_eq` | FENCE-221 / 24 pc | **24 / 24** | ratio T/C min 0.0278, median 0.583, max 2.432. **Two-tailed: 7 hotter, 17 colder, 0 unchanged.** \|ΔK\| min 42.4 / med 122.4 / max 5792.6 | `wd-11/2/2` 320.1278582842372 → 223.30544854070985 K; `wd-27/3/1` 5958.25080906519 → 165.65039639911407 K |
| **`conditionFromBody(pd).T_eq` (shipped surface temp)** | FENCE-221 / 24 pc | **24 / 24** | 7 warmer, 17 cooler. ΔK −5783.40 / −120.82 / +236.17. ΔF −10410.12 / +425.11. **>50 K on 24/24, >100 K on 21/24** | `wd-11/2/2` 355.2 → 247.8 K (179.8 → −13.6 °F); `wd-147/1/2` +236.17 K (+425.11 °F) |
| `compositionClass` / `noSurface` | FENCE-221 / 24 pc | **9 / 24** | 6 rocky→gas, 2 icy→rocky, 1 rocky→icy. Counts rocky 19 / icy 2 / gas 3 → rocky 14 / icy 1 / **gas 9**. **noSurface (no greenhouse lift) 3 → 9** | `wd-15/6/1` rocky → gas |
| `pd.composition.density` | FENCE-221 / 24 pc | **14 / 24** | fractional 0.1686 / 0.5294 / 0.8444; 12 drop, 2 rise | `wd-15/6/1` 4797.827691609416 → 1551.7426739649309 kg/m³ |
| `pd.composition.volatileFraction` | FENCE-221 / 24 pc | **14 / 24** | fractional 0.896× / 7.99× / 40.5×; abs 0.0592 / 0.3201 / 0.5685 | `wd-15/6/1` 0.013421306074596942 → 0.556842612149194 |
| `pd.composition.surfaceType` | FENCE-221 / 24 pc | **2 / 24** | both silicate → ice-rock, 0 reverse | `wd-15/6/1`, `wd-126/4/3` |
| `pd.iceness` | FENCE-221 / 24 pc | **13 / 24** | 11 go 0 → nonzero, 2 go nonzero → 0. Bodies with any ice **2 → 11**. \|Δ\| 0.0109 / 0.702 / 1.000 | `wd-15/6/1` 0 → 1; `gc-22/2/2` 0.46369717236190106 → 0 |
| `pd.eccentricity` | FENCE-221 / 24 pc | **24 / 24** | fractional 0.128 – 8.66e15. **Treatment produces exactly 0 (`gc-22/2/2`), 2.69e-257, 1.61e-72, 8.33e-28** where control's smallest \|e\| is 4.14e-17 | see left |
| `pd.tidalState` (`locked` + `lockType`) | FENCE-221 / 24 pc | **7 / 24** | 5 gain a lock (4 synchronous, 1 `3:2-resonance` = `wd-174/0/1`), 2 lose one | `wd-24/1/2` none → synchronous |
| `pd.rotationSpeed` | FENCE-221 / 24 pc | **7 / 24** | 4 go to exactly 0; 2 spin up from 0; 1 → 0.0008333333333333333. Exact-zero count **2 → 4** | `wd-24/1/2` 0.004767980623699259 → **0** |
| `pd.tidalHeating` (nested) | FENCE-221 / 24 pc | **24 / 24** | fractional 0.318 / 1.000 / 2.07e16; abs 1.39e-14 / 1.77e-3 / 1.828. **Exactly 0 on 2/24 under treatment (`wd-66/0/1`, `gc-22/2/2`), 0/24 today** | `wd-11/2/2` 0.005655113915472281 → 0.0004581591379686126 |
| `pd.magneticField` | FENCE-221 / 24 pc | **6 / 24** | fractional 0.80 / 0.80 / 4.00 — the `isLocked ? 0.2 : 1.0` factor at `PlanetGenerator.js:417` | `wd-24/1/2` 0.21168088680482644 → 0.04233617736096529 |
| `pd.habitability.score` (+ `.factors[]`) | FENCE-221 / 24 pc | **16 / 24** | \|Δ\| 0.10 / 0.25 / 0.40 | `wd-15/6/1` 0.95 → 0.7 |
| `pd.surfaceHistory.erosionLevel` | FENCE-221 / 24 pc | **2 / 24** | 3.75× and 4.00×; the two atmosphere-gaining bodies. `PhysicsEngine.js:796-825` keys on `hasAtmosphere` + `ageGyr` only | `wd-27/3/1` 0.21061319817933027 → 1 |
| `pd.axialTilt` | FENCE-221 / 24 pc | **2 / 24** | abs 0.0128 and 0.3532 rad | `wd-27/3/1` −0.39261814299970865 → −0.3798196504358202 |
| `pd.rings` (interior fields only) | FENCE-221 / 24 pc | **2 / 24** | `innerRadius`/`outerRadius`/`physics.*`/`ringlets[].innerR/outerR`; **never `tiltX`, and ring presence never flips (5/24 both arms)** | `wd-126/4/3`, `wd-133/4/3` |
| `pd.noiseDetail` | FENCE-221 / 24 pc | **7 / 24** | fractional 0.0016 / 0.433 / 1.108; abs 8.84e-4 – 0.393 | `wd-24/1/2` 0.3017925619613379 → 0.6038490110775456 |

### 1c. Atmosphere

| Column | Moved (FENCE-221 / 24 pc) | Magnitude | Example |
|---|---|---|---|
| `pd.atmosphere.physics.jeansCO2 / jeansH2 / jeansN2` | **20 / 24 each** | The largest mover set. Also forwarded to `moon.atmosphere` (`MoonGenerator.js:453`) — this is why `moon.atmosphere` moves 20/24 with no draw shift | `wd-24/1/2` all three move |
| `atmosphere` presence | **2 / 24** | 2 gain, 0 lose; count 22 → 24 | `wd-27/3/1` null → `{n2-o2, 0.4259098485120204 bar, retained}`; `wd-100/5/1` → `{h2-he, 10.426620669257941 bar}` |
| `atmosphere.physics.pressure` | **9 / 24** (7 comparable + 2 gainers) | fractional 0.688× / 19.6× / 30.3×; abs 0.230 – 13.600 bar. **6 bodies end in the 10–15 bar band** | `wd-15/6/1` 0.3246816488741629 → 10.154260305463518 bar |
| `atmosphere.physics.composition` | **8 / 24** | `h2-he` count **3 → 9**. n2-o2 15→10, co2 3→3, co2-n2 1→2, none 2→0 | `wd-15/6/1` n2-o2 → h2-he |
| `atmosphere.physics.retained` | **2 / 24** | both absent → true; `retained: false` occurs 0/24 in every arm (the generator nulls the whole object, `PlanetGenerator.js:448-449`) | `wd-27/3/1`, `wd-100/5/1` |
| `atmosphere.physics.type` | **7 / 24** | secondary ↔ primordial | `wd-100/5/1` → primordial |
| `pd.atmosphere.color` | **8 / 24** | rim tint — a visible channel | — |
| `pd.atmosphere.strength` | **7 / 24** | — | — |

### 1d. Appearance / bake channels

⚠ **Instrument B is structurally blind to every row in this block.** The fence's `planetRecord()` strips the five `WORLDENGINE_BAKES` (`iceColor`, `iceness`, `landPalette`, `lavaCrustColor`, `lavaGlowColor`), and `moonRecord()` routes nested `planetData` through it. These moves are real and will not appear in any B hash.

| Column | Moved (FENCE-221 / 24 pc) | Magnitude | Example |
|---|---|---|---|
| `pd.landPalette` (craton/fresh/weathered/sediment/pigment) | **17 / 24** — but **visibly 9 / 24** | per-body max channel \|Δ\| median-among-movers 2.3055e-2, max 4.2347e-1. ≥0.02 on 9/24; ≥0.004 on 13/24. Per sub-key: craton 17, fresh/weathered/sediment/pigment 15 each | `wd-27/3/1` 0.4235; `wd-100/5/1` 0.4196; `wd-187/2/1` 0.2964 |
| `pd.lavaGlowColor` | **24 / 24** — but **visibly 2 / 24** | median 3.845e-5, max 8.289e-1. **21 of 24 move below the 8-bit display floor.** ≥0.02 on 2/24 (`wd-27/3/1` 0.829, `wd-161/5/1` 0.0439) | `wd-11/2/2` [1, 0.41521908, 0.09900398] → [1, 0.41501167, 0.09896076] |
| `pd.lavaCrustColor` | **24 / 24** — but **visibly 2 / 24** | median 1.518e-4, max 6.324e-1; ≥0.02 on 2/24, ≥0.004 on 4/24 | `wd-27/3/1` [1, 0.82951920, 0.65903841] → [1, 0.19707427, 0.05355714] |
| `pd.aurora` presence | **11 / 24** | 10 lose an aurora, 1 gains. Count **11 → 2** | `wd-11/2/2` present → null; `wd-61/1/2` null → present |
| `pd.aurora` record (incl. `intensity`, `ringLatitude`, `ringWidth`) | **12 / 24** | 11 presence flips + 1 intensity-only | — |

**Poisoning scan:** 0 non-finite values (NaN / ±Infinity) across all `pd` + `moon` leaves on 24/24 bodies in **both** arms, FENCE-221. This was previously an unstated assumption. `wd-27/3/1`'s control `T_eq` of 5958.25 K shows the shipped code does put absurd-but-finite values on this record type.

### 1e. The other corpora

| Column | Population | Moved | Example |
|---|---|---|---|
| `pd.T_eq` on planet-class moons | **MC-197** / 23 pc | **23 / 23** | `wd-11/2/2` 320.1278582842372 → 223.30544854070985 K |
| `pd.T_eq` on planet-class moons | **PCC-120** / 12 pc | **12 / 12** | `pcc-6#5` 320.1278582842372 → 79.86998264422706 K |
| `pd.T_eq` on planet-class moons | **PRA-600** / 29 pc | **29 / 29** | `P:30:p3:m2` 320.1278582842372 → 131.51050555849363 K |
| `pd.iceness` on planet-class moons | **PRA-600** / 29 pc | **11 / 29** | 10 from exactly 0; **1 from nonzero** (`P:461:p1:m2` 0.3696573600253201 → 0.3904838389505625); **2 saturate at exactly 1** (`P:221:p5:m1`, `P:294:p5:m2`) |
| `conditionFromBody(...).surfaceGravity` | **MC-197** / 23 pc | **6 / 23** | population **max does not move**: 2.666259570162693 g on `wd-133/4/3` in both arms |
| top-level `planetData` record (whole) | **PCC-120** / 526 planets | **2 / 526** | `pcc-33#2`, `pcc-111#1` — **`systemContext` and nothing else** |
| draw-count set lines | **STREAM-1500** / 7 planet-class lines | **7 / 7** | `gas-giant\|1\|PLANET-CLASS=[18,19,21,23,25,27]` → `[19,21,23,27]`; `gas-giant\|3\|PLANET-CLASS=[21,23,27]` → `[21,23,27,29]` |
| record fingerprint | **IC-526** | **65 / 526** = 64/64 P + 1/372 S | `S:00074:p0` (3 leaves, all `systemContext.moons.2.*`, 0 uniforms) |

### 1f. RNG draw stream

**Two counters, two denominators, same net.** Do not mix them in one sentence.

| Counter | Corpus total control → treatment | Net |
|---|---|---|
| **Fence profile** (per-yield, root stream; `tests/baseline/body-identity.json`) | **753,158 → 753,154** | **−4** |
| Prototype-method counter (`float`/`range`/`chance`/`gaussian`/`child` at 1/1/1/2/1, **all** `SeededRandom` instances incl. sub-rngs) | 2,113,122 → 2,113,118 | −4 |

Both were emitted by the same probe over FENCE-221 and reconciled in this pass: the per-seed values below are the fence's own profile totals and sum to 753,158; the 2.11 M figure additionally counts `namespacedFloat` and `_computeTidalHeating` sub-rngs. **Cite 753,158 in the commit.**

**Draw count shifts on 7 / 221 fence seeds:**

| Seed | Control → treatment | Δ | Cause |
|---|---|---|---|
| `wd-24` | 3604 → 3602 | −2 | lock false→true (synchronous) |
| `wd-27` | 8168 → 8171 | +3 | lock true→false (+2) **and** `retained` false→true (+1) |
| `wd-66` | 4750 → 4748 | −2 | lock false→true |
| `wd-100` | 205 → 208 | +3 | lock true→false (+2) **and** `retained` false→true (+1) |
| `wd-174` | 6350 → 6348 | −2 | lock false→true (**`3:2-resonance`**) |
| `wd-189` | 10842 → 10840 | −2 | lock false→true |
| `gc-22` | 133 → 131 | −2 | lock false→true |

**Mechanism, verified at source and exact on 24/24 surviving generations:**

```
Δdraws = −2·Δ(tidalState.locked) + 1·Δ(atmoPhysics.retained) + 2·Δ(hasClouds) − 2·Δ(hasRings)
```

- **Primary, ±2:** `PlanetGenerator.js:691-698`. `locked && 'synchronous'` → 0 draws; `locked && '3:2-resonance'` → 0 draws; otherwise `:698` `rot(rng.range(0.033,0.167) * (rng.chance(0.15) ? -1 : 1))` = 2 draws. Reading only `:697-698` misses the 3:2 arm — `wd-174` is the body that proves it. AU reaches this via `:408-409` `tidalLockTimescale(..., Math.max(orbitRadiusAU, 0.01))`.
- **Secondary, +1:** `PlanetGenerator.js:526` `const hasClouds = atmoPhysics.retained && rng.chance(...)` — JS short-circuit, 0 draws when `retained` is false. AU reaches this via `:420-426` `computeAtmosphere({... orbitAU: orbitRadiusAU ...})`. **The `if (atmoPhysics.retained)` block at `:449-461` contains no `rng` call and is not the cause.**
- `hasClouds` and `hasRings` flipped 0/24. `axialTilt`'s gate at `:687-689` (0 draws with rings, 2 without) never fires.

**Per-call draws:** 17 → 28 measuring from entry to `_generatePlanetMoon` (includes `rng.pick(allowed)` at `:374`), or 16 → 27 measuring after the pick. Deltas are identical under either window; state which window any downstream gate quotes.

**The substituted AU, 26 generations, FENCE-221:** min **0.16908953277917357** (`gc-22`), max **1293.7566714449006** (`wd-27`). 7/26 land below 1.0 AU — and those 7 are exactly the 7 bodies that get hotter. **0/26 hit the 0.01 clamp; 0/26 had a null `parentOrbitAU`** — `?? 1.0` and the `0.01` floor are dead code on this corpus.

---

## 2. Columns that DO NOT move — each with the control that proves the probe could see it

A zero without a moved control is not evidence. Every row below was re-measured with a deliberate perturbation through the same reader.

| Column | Population | Result | Moved control |
|---|---|---|---|
| **plain moon record (whole)** | FENCE-221 / 770 plain | **0 / 770** | Sabotaging the plain path only (`MoonGenerator.js:254` `0.01`→`7.77`) moved **573 / 770**. Independently: the same reader finds `massEarth` present on **770/770** plain moons and negative `orbitSpeed` on **74/770**. Structural: plain moons never enter `_generatePlanetMoon`; the bakes-**included** record is also 0/770 |
| plain moon record | MC-197 / 705 plain | **0 / 705** | as above |
| **planet record excluding `systemContext`** | FENCE-221 / 961 | **0 / 961** | Injecting `axialTilt += 1e-9` before `StarSystemGenerator.js:972` moved **961 / 961** |
| planet wrapper record | FENCE-221 / 961 | **0 / 961** | same |
| top-level `T_eq`, `iceness` on planets | PRA-600 / 2485 | **0 / 2485** each | field-level zero; see §5 for the record-level correction |
| `pd.type` **and** `moon.type` | FENCE-221 / 24 pc | **0 / 24** each | Forcing `forceType='gas-giant'` at the generate call moved `pd.type` **24/24**; injecting a draw **before** `rng.pick(allowed)` at `:374` moved both **12/24**. ⚠ Forcing `forceType` moves `pd.type` but **not** `moon.type` — `moon.type` is the pick at `:374`, upstream of the substituted call, and no arm in any lane moved it |
| `moon.baseColor`, `moon.accentColor` | FENCE-221 / 24 pc | **0 / 24** each | one injected draw moved each **20/24**; `forceType` moved each **24/24** |
| `moon.noiseScale` | FENCE-221 / 24 pc | **0 / 24** | draw-shift moved it 24/24; `forceType` 21/24 |
| `moon.clouds` (presence + record) | FENCE-221 / 24 pc | **0 / 24** | draw-shift moved presence 4/24, record 6/24; `forceType` presence 3/24. Base rate: 3/24 non-null |
| ring **presence** | FENCE-221 / 24 pc | **0 / 24** flips | draw-shift 6/24; `forceType` 11/24. Base rate 5/24 |
| `pd.composition.ironFraction` | FENCE-221 / 24 pc | **0 / 24** | draw-shift 24/24; zone-shift 24/24; 24 distinct values |
| `pd.composition.carbonToOxygen` | FENCE-221 / 24 pc | **0 / 24** | draw-shift 24/24; zone-shift 24/24 |
| `pd.age` | FENCE-221 / 24 pc | **0 / 24** | zone-shift 24/24. `PlanetGenerator.js:373` `const ageGyr = zones?.ageGyr \|\| 4.5` |
| `pd.metallicity` | FENCE-221 / 24 pc | **0 / 24** | zone-shift 24/24. `PlanetGenerator.js:376` |
| `surfaceHistory.bombardmentIntensity` | FENCE-221 / 24 pc | **0 / 24** | zone-shift 10/24 |
| `surfaceHistory.resurfacingRate` | FENCE-221 / 24 pc | **0 / 24** | zone-shift 1/24 (a step function of `ageGyr` at 3 Gyr, `PhysicsEngine.js:818`) |
| `pd.storms` | FENCE-221 / 24 pc | **0 / 24** | null on 24/24 in control; `forceType='gas-giant'` moved it 16/24. `PlanetGenerator.js:620-622` gates on `type === 'gas-giant'` |
| `pd.iceColor` | FENCE-221 / 24 pc | **0 / 24** | **no control exists** — `PlanetGenerator.js:764` `iceColor: ICE_ALBEDO`, 1 distinct value `[0.86, 0.9, 0.95]`. Reported as a constant, not as evidence |
| 13 hardcoded uniforms (`uCraterReliefGain`, `uDispDomainScale`, `uEjectaLump`, `uFwClamp`, `uIceColor`, `uLimbMix`, `uReliefGain`, `uReliefGainCont`, `uReliefMix`, `uReliefNormalGain`, `uReliefOctaves`, `uTerraceCount`, `uVoroCells`) | IC-526 | **0 / 526** each | **no control exists** — the tool itself flags them `1 distinct / 526 modal / CONSTANT`. A ×1.5 AU sabotage moving 42/55 uniforms on 507/526 bodies moved none of these 13 |
| S stratum (all 55 uniforms) | IC-526 / 372 S | **0 / 372** | ×1.5 AU sabotage moved 42/55 uniforms on **372/372** S |
| G stratum (all 55 uniforms) | IC-526 / 90 G | **0 / 90** | same sabotage moved **90/90** G. G bodies call `PlanetGenerator.generate` directly and never enter `MoonGenerator` |
| entire file | MR-14 | **0 / 14**, gravity max bit-identical at 1.862804525580659 g | **Structurally blind**: `tests/moon-mass-radius-consistency.test.js:36` calls `MoonGenerator.generate(rng, p, i, 4)` — 4 args, so `parentOrbitAU` is its `null` default (`MoonGenerator.js:117`) and `?? 1.0` yields exactly 1.0. A 7-arg control moves the population 14 → **15** and body 0's `T_eq` 254.58831515634046 → 56.927677896671725 K |
| `canonical-scenario-v1` golden | — | hash `40c18aad`, PASS both arms | `grep -rE 'MoonGenerator\|PlanetGenerator\|StarSystemGenerator' tests/golden-trajectories/` → **zero hits, exit 1**. `canonical-scenario.js` imports only `vendor/motion-test-kit/core/loop/accumulator.js` and `.../rng/mulberry32.js` |
| `gravity-provenance-fence` (6 tests) | — | 6/6 pass both arms | pure source-text scan, no generation |
| **`moon.massEarth`** | FENCE-221 / 24 pc | **ABSENT 24/24 — a structural absence, not a zero** | The return literal at `MoonGenerator.js:433-455` has no `massEarth` key. Key-presence channel proven live: the same reader finds `massEarth` on **770/770** plain moons (written at `:264`) |
| **`moon.retrograde`** | FENCE-221 | **ABSENT 24/24 pc and 0/770 plain** | `:179` is a local; its only consumer is the sign flip at `:203`. Never stored |
| **`composition.waterFraction`** | FENCE-221 / 24 pc | **DOES NOT EXIST — defined on 0/24** | Composition keys, printed from one live instance: `[carbonToOxygen, density, ironFraction, surfaceType, volatileFraction]`. **Any report of "waterFraction 0/N unchanged" is a confident zero from a nonexistent path.** |

---

## 3. Instrument B prediction (`tests/body-identity-fence.test.js`)

> **DRAW STREAM red on exactly 7 of 221 fence seeds** — `wd-24` (3604→3602, first divergence at yield index 4), `wd-27` (8168→8171, index 5), `wd-66` (4750→4748, index 2), `wd-100` (205→208, index 7), `wd-174` (6350→6348, index 2), `wd-189` (10842→10840, index 2), `gc-22` (133→131, index 5). Corpus draw total 753,158 → 753,154, net −4. Every first divergence lands at the yield of the moved planet-class moon itself, in the **body** region of the profile (index 2–7 of profiles 10–14 long) — never at a belt, trojan or overlay index. Profiles unchanged on the remaining **214 / 221**. Fails at `tests/body-identity-fence.test.js:646`, message `draw profile moved on 7 seed(s)`.
>
> **BODY IDENTITY red on exactly {24 planet-class moons} ∪ {7 planets, each moving only on `systemContext`}.** Literal partition received: `{ systems: 0, planets: 7, plainMoons: 0, planetClassMoons: 24 }`; fails at `:740`. The 24 are the fence's own hardcoded `PLANET_CLASS_MOONS` list at `:288-296`, element-for-element and in order. The 7 planets are `wd-24/1`, `wd-27/3`, `wd-66/0`, `wd-100/5`, `wd-174/0`, `wd-189/0`, `gc-22/2` — the direct parents of the 7 draw-shifted moons. **A hash recomputed with `systemContext` excluded moves on 0 / 961.** Within `systemContext` only `moons` moves; within `moons` only `radiusEarth`, `orbitRadiusEarth`, `tidalHeating`; never `type`. This is the post-pass alias written at `StarSystemGenerator.js:947-952` and assigned at `:972`; `planetRecord()` excludes only the five `WORLDENGINE_BAKES` and does **not** exclude `systemContext`. **Per-seed rollup hash moves on 22 / 221** — `wd-11, wd-15, wd-24, wd-27, wd-40, wd-61, wd-66, wd-70, wd-100, wd-101, wd-116, wd-126, wd-133, wd-147, wd-161, wd-166, wd-168, wd-174, wd-187, wd-189, wd-1403, gc-22`.
>
> **Plain moons 0 / 770.** Control that proves the probe could see one: sabotaging `MoonGenerator.js:254` (`0.01` → `7.77`, plain path only, no rng draw) moved **573 / 770** plain moons and 164/221 seeds through the identical reader. The zero is also true on the strictly stronger **bakes-included** record (still 0/770). Structural cause: each moon gets its own child rng at `StarSystemGenerator.js:594`, and `_generatePlanetMoon` returns before `:254`.
>
> **RECORD SHAPE green**, naming: `moonShapes` [25, 20] both arms (0 gained, 0 lost); `planetShapes` [31, 29] both arms; `bakeMisses` 0 → 0; moon-shape census plain `{shapes:1, keyCounts:[25], records:770}` / planet-class `{shapes:1, keyCounts:[20], records:24}` both arms; `hiddenBodyKeys` `[]` both arms; classes 39 → 39. Control that proves those channels live: deleting `isPlanetMoon: true` from the record literal loses the class `planet-class-moon` (39→38), swaps a 20-key moon shape for a 19-key one, drives the census to plain `{shapes:2, keyCounts:[19,25], records:794}` / planet-class `{shapes:0, records:0}`, and empties `PLANET_CLASS_MOONS` (24 → 0).
>
> **Hard literals green:** planets 961, moons 794, plain 770, planet-class 24 — unchanged. `PLANET_CLASS_MOONS` coordinate list unchanged and in order. `compared = 221` on both channels. System scalars move on 0 / 221. **C7 is a digest re-bless, not a population change.**
>
> **Also green under C7:** seed-list, class-coverage, iterator/generate parity, RECORD SHAPE, bakes-present, NEGATIVE CONTROL. Result: **8 tests, 2 failed, 6 passed** — confirmed by running the real fence in a treated worktree.

**Instrument B cannot see the appearance moves.** `lavaCrustColor` 24/24, `lavaGlowColor` 24/24, `landPalette` 17/24 and `iceness` 13/24 are stripped by `planetRecord()`. B's red on those 24 bodies is carried by `T_eq`, `eccentricity` and `tidalHeating` (24/24 each). **Anyone writing the re-bless note from the mover list above will name fields B never watched.**

---

## 4. Instrument A prediction (full vitest suite via `scripts/test-baseline.mjs`)

Re-derived directly from the retained raw reports in this pass.

**Totals:** 324 files / **5312 tests**. Pristine and installed-but-inert are identical: 5284 passed, 24 failed, 4 skipped, 0 todo, 2 failing files, 15 non-collecting files. **Treatment: 5280 passed, 28 failed, 4 skipped, 0 todo, 4 failing files, 15 non-collecting files.**

**Newly RED — exactly 4:**

```
tests/body-identity-fence.test.js :: Instrument B — body-identity hash (generation-order fence)
  > DRAW STREAM: the per-yield draw profile is unchanged for every seed
tests/body-identity-fence.test.js :: Instrument B — body-identity hash (generation-order fence)
  > BODY IDENTITY: every planet and every moon hashes to its baseline
tests/moon-rng-stream-identity.test.js :: moon rng stream identity — the shape of MoonGenerator's draws off the shared stream
  > the per-(parentType, moonIndex, resultType) draw-count set over wd-0…wd-1499 is exactly this
tests/moon-rng-stream-identity.test.js :: moon rng stream identity — the shape of MoonGenerator's draws off the shared stream
  > the plain path and the planet-class path partition the set 57 / 7
```

**Newly GREEN: 0.** 0 of the 24 baseline-failing IDs turn green; 0 files vanish; 0 per-file counts change; skipped stays 4; todo stays 0. Control that proves the green-direction reporter fires: flipping one failing assertion to `passed` in a copy of the pristine report produced `NO LONGER RED … ↳ now PASSES`, exit 1.

**The literal failures in `moon-rng-stream-identity.test.js`:**
- `:256` `expect(stream.lines).toEqual(PINNED_STREAM_SET)` — all **7 / 7** planet-class lines move, **0 / 57** plain lines move (byte-identical). `:257` `keys === 64` still passes; `:258` `pairs === 105` fails (**105 → 100**). Call counts unchanged: 5207 total / 5038 plain / 169 planet-class.
- `:280` `expect(Math.min(...nums(planetClass))).toBe(18)` — `AssertionError: expected 19 to be 18`. The 57/7 partition assertion at `:275` **passes**, as do plain max 18 (`:279`) and plain min 11 (`:282`); the test dies at `:280`. The value 18 disappears from every planet-class line; planet-class max stays 29. The five keys losing an 18 are `gas-giant|1`, `gas-giant|2`, `gas-giant|5`, `sub-neptune|1`, `sub-neptune|2`.

**Stays green:** `moon-condition-contract`, `port-condition-contract` (66/66), `moon-mass-radius-consistency`, `port-route-agreement`, `gravity-provenance-fence` (6/6), `canonical-scenario-v1` golden.

⚠ **Baseline provenance, unflagged until now:** `tests/baseline/*` was recorded from commit `952c5d00f2f65a1d0689ec2698792375da570971` with `dirty: true`, and the instrument prints its own warning that a clean checkout of that commit will read as drift. The set comparison is valid; the provenance is not clean.

---

## 5. Instrument C prediction (`tools/port-uniform-delta.mjs`) — **both halves red**

The gates lane declared Instrument C unmeasured. It is not unmeasured; it is **red on both halves**, verified empirically in two independent isolated trees (one `git archive` copy, one plain `tar` copy), each with a passing before-and-after control.

### 5a. Shipped-uniform delta — `exit 0 → exit 2`

```
BEFORE: bodies compared : 526 · uniforms that MOVED : 0
        RESULT: ZERO delta on all shipped shared uniforms. Exit 0.
AFTER:  POPULATION MISMATCH — the generated bodies themselves moved.
        record changed : 65   e.g. S:00074:p0, P:00030:p3:m2, P:00074:p0:m2, P:00075:p5:m4, …
        bodies compared : 461
        RESULT: STRUCTURAL BREAK (1) — the comparison basis itself changed. Exit 2.
```

**65 / 526 record fingerprints change: 64 / 64 P + 1 / 372 S + 0 / 90 G.** 0 bodies disappear, 0 are new. The single S body is `S:00074:p0`, whose only three differing leaves are `systemContext.moons.2.{radiusEarth, orbitRadiusEarth, tidalHeating}` and which moves **zero** uniforms — the same aliasing channel as Instrument B's 7 planets, on a third corpus.

**31 of 55 watched uniforms move, all on P-stratum bodies** (re-derived here from the raw captures):

| Moved on | Uniforms |
|---|---|
| **64 / 64 P** | `uCraterOffset`, `uDetailOffset`, `uLavaCrust`, `uLavaGlow`, `uMacroOffset` |
| 43 | `uLimbColor`, `uTermColor` |
| 41 | `uLimbExponent` |
| 35 | `auroraIntensity`, `uBioGroundColor`, `uFreshColor`, `uSedColor`, `uWeatheredColor` |
| 32 | `auroraRingLat`, `auroraRingWidth`, `uIcenessMix` |
| 31 | `auroraColor`, `hasAurora` |
| 30 | `atmosphereColor`, `uTermWidth` |
| 27 | `atmosphereStrength` |
| 11 | `noiseDetail`, `planetRadius` |
| 10 | `uBioGroundCover` |
| 5 | `noiseScale`, `uNoiseScale` |
| 4 | `uTermStrength` |
| 2 | `cloudColor`, `cloudDensity`, `cloudScale`, `hasClouds` |

Selected magnitudes: `uCraterOffset` min 1.394e+1 / med 5.426e+1 / max 9.336e+1 (worst `P:00537:p4:m1`); `uIcenessMix` max 1.0 (`P:00221:p5:m1`, `[0]` → `[1]`); `planetRadius` max 3.619e-2 (`P:00919:p5:m4`, 0.09002392250782432 → 0.053836028705172574); `uLimbExponent` `[3.5]` → `[1.8]`; `hasAurora` `[1]` → `[0]`. `planetRadius` and `noiseDetail` move on the same 11 P bodies (`P:00074:p0:m2, P:00120:p0:m2, P:00169:p4:m3, P:00253:p1:m1, P:00291:p2:m2, P:00435:p0:m2, P:00545:p4:m1, P:00732:p2:m1, P:00785:p0:m2, P:00807:p1:m2, P:00919:p5:m4`); `noiseScale`/`uNoiseScale` on the same 5, at 1.78e-15 – 3.55e-15 — **float64 ULP residue from the radius/radiusScene ratio, real and reportable but invisible.**

⚠ **The tool's own caveat is wrong here.** It prints "The `bake`, `condition` and `gate` rows are unaffected — their sources sit outside the identity fingerprint." **13 of the 31 movers are non-record tier** (7 bake: `uLavaCrust`, `uLavaGlow`, `uIcenessMix`, `uBioGroundColor`, `uFreshColor`, `uSedColor`, `uWeatheredColor`; 6 condition: `uLimbColor`, `uLimbExponent`, `uTermColor`, `uTermWidth`, `uTermStrength`, `uBioGroundCover`), and each reads a hollow `0/461` because all 65 movers were excluded before any row was computed. **That sentence in `tools/port-uniform-delta.mjs` is itself a defect and warrants a ledger entry.**

### 5b. Citation fence — `exit 0 → exit 2`

```
BEFORE: RESULT: all 401 symbol-anchored citations resolve. Exit 0.
AFTER:  RESULT: 1 BROKEN CITATION(S). Exit 2.
        docs/FEATURES/one-pipeline-two-frontends-PLAN.md:853 cites MoonGenerator.js:378
          `const pData = PlanetGenerator.generate(rng, 1.0, planetData.sunDirection, zones, planetType);`
        that line actually reads: const pData = PlanetGenerator.generate(rng, Math.max(parentOrbitAU ?? 1.0, 0.01), planetData.sunDire
```

CHECKED/UNCHECKED/UNRESOLVED counters unmoved at **401 / 447 / 0** — a **symbol** mismatch, not a line shift; `MoonGenerator.js` stays 587 lines and every other citation into it keeps its number. PLAN.md:853 is the Step-8b rollback recipe (`Revert src/generation/MoonGenerator.js:378 …`), which legitimately wants the old text: the fix is to re-quote the new line, not to delete the reference.

### 5c. Three more stale references the fence will never see

`CITE_SOURCES` (`tools/port-uniform-delta.mjs:1023`) is a hand-maintained allowlist of **28 files**, verified in this pass. None of the following is in it, so `--check-citations` stays silent about all three forever:

| File:line | Text | Kind |
|---|---|---|
| `docs/FEATURES/step8-handoff-2026-08-14.md:139` | `` `MoonGenerator.js:378` generates every planet-class moon at `PlanetGenerator.generate(rng, 1.0, …)` `` | symbol-anchored, ungated |
| `docs/FEATURES/step8-handoff-c7-2026-08-14.md:60` | identical text | symbol-anchored, ungated |
| `docs/NOW.md:33` | `` `MoonGenerator.js:378` generates every planet-class moon at a hardcoded 1 AU `` | prose-only, no symbol — cannot break, but becomes false |

Blindness control, run alone against otherwise pristine text: breaking `MoonGenerator.js:251` (`const luminosityRel = zones?.luminosity ?? 1.0;`), which two symbol-anchored refs in `tests/moon-condition-contract.test.js:389` and `:448` pin, produced **exit 0, "all 401 citations resolve," 401/447/0 unchanged**. The file is outside `CITE_SOURCES`.

**The C7 commit has four documentation repairs, not one, and only the first will ever go red.**

---

## 6. Contradictions between lanes and verifiers — resolved

Each resolved by re-deriving the number from the retained raw artifacts in this pass. **No averaging.**

| # | Disagreement | Believed | Why |
|---|---|---|---|
| 1 | **Draw denominator.** instrumentB lane wrote "net −4 over a **2,113,122**-draw corpus"; its verifier refuted with **753,158** and called the per-seed figures "internally inconsistent." | **Both totals are real; neither lane is wrong about its own instrument; the verifier's inconsistency charge is wrong.** Cite **753,158 → 753,154**. | Re-derived: the geometry probe's per-seed values sum to exactly **753,158**, which equals the sum of `tests/baseline/body-identity.json` profile last-entries; `wd-24` = 3604 in both. Its `globalDraws` of 2,113,122 additionally counts `namespacedFloat` and `_computeTidalHeating` sub-rng instances. The commit must cite the fence's number because that is what the fence asserts. |
| 2 | **Greenhouse-suppressed count.** physics lane: "gas/noSurface **5/24 → 9/24**"; its verifier: **3/24 → 9/24**, noting the lane's own class-count row says 3. | **3 → 9.** | Recomputed from the raw physics arms: control `{rocky:19, icy:2, gas:3}` → treat `{rocky:14, gas:9, icy:1}`; `noSurface` true 3 → 9. The lane contradicted itself; the verifier is right. |
| 3 | **`pd.type` census.** physics lane: `ice 9, rocky 9, venus 3, ocean 2, sub-neptune 1, terrestrial 1` = **25** over a 24-body population. | **`ice 8`**, everything else as stated, sum 24. | Direct tally. A census overrunning its own denominator is the arithmetic slip trap 3 exists for. |
| 4 | **pcc top-level planets.** gates lane: "the 526 top-level `planetData` records, **0** of which move." | **2 / 526** — `pcc-33#2` and `pcc-111#1`, differing key `systemContext` only. | Recomputed from the raw gates arms. The lane's 66/66-green conclusion is unaffected; the number is wrong in the exact direction this project has already paid for. |
| 5 | **PRA iceness.** gates lane: "11/29, **all** from exactly 0." | **11/29, of which 10 from 0 and 1 from nonzero** (`P:461:p1:m2` 0.3696573600253201 → 0.3904838389505625); **2 saturate at exactly 1**. | Full enumeration from the raw arms. The universal quantifier fails; the count is right. |
| 6 | **±2 draw mechanism.** instrumentB lane attributed both signs to `PlanetGenerator.js:449`. | **The tidal-lock branch at `:691-698` (±2); `:526` contributes +1 on `wd-27` and `wd-100` only.** | `:449-461` contains no `rng` call — verified by reading it. On all four −2 seeds `atmoPhysics.retained` is true in *both* arms. Four verifiers converged on this independently. |
| 7 | **Top-level moon fields.** instrumentB lane row 3: "top-level moon fields moved **7/24**." | **21 / 24 move at least one top-level non-`planetData` key**; the 7/24 holds only for the ten fields drawn *after* the generate call. | `atmosphere` is a top-level key of the record (`MoonGenerator.js:453`) and moves 20/24 with no draw shift. The lane's own row 2 already said so — the headline contradicts it. `clouds`, `baseColor`, `accentColor`, `noiseScale`, `type` move 0/24. |
| 8 | **`moon.type`'s moved control.** instrumentB/physics lanes cite `forceType` sabotage as the control for a `type` zero row. | **The control covers `pd.type` (24/24) but NOT `moon.type`.** `moon.type` moved 0/24 in *every* arm any lane ran. | `moon.type` is the pick at `:374`, upstream of the substituted call. The zero is structurally true; the cited control does not back it. `moon.type` holding still is what keeps the class census and `PLANET_CLASS_MOONS` green. |
| 9 | **"Every control moon sits at 320.13 K."** H2 asserted it; geometry lane wrote "most." | **6 distinct control `T_eq` values; exactly 10/24 (41.7%) read 320.1278582842372.** | Direct count. The hardcoded 1.0 pins the *orbit*, not the temperature — `T_eq` still scales with host-star luminosity. Neither "every" nor "most" survives. |
| 10 | **postmig stream `pairs`.** gates verifier: "105 → **102** under postmig, so `:256` reds either way." | **105 → 105 under postmig.** `:256` still reds (2 of the 64 lines differ from `PINNED_STREAM_SET`), but via the `lines` assertion, not `pairs`. | Recomputed from the raw arms: postmig `gas-giant|1` loses one value and `gas-giant|2` gains one — net 0. The verifier's conclusion holds; its stated number does not. |
| 11 | **Per-call draw range.** geometry lane 17→28; its verifier 16→27. | **Both, under different windows.** The lane's window (from entry to `_generatePlanetMoon`, including `rng.pick` at `:374`) is the correct one for a column named "draws per call." | Definitional, not a disagreement. Deltas are identical. Any downstream gate must say which window it quotes. |
| 12 | **moon-mass-radius moved control.** gates lane: "10/15 `T_eq` moved." | **Unsound as stated** — index-aligning two populations of different size (14 → 15) past the insertion point. The defensible statement is: the population changes size and body 0's `T_eq` moves 254.59 → 56.93 K. | The conclusion (the channel is live) survives; the count does not. Its density figure 4.8372 vs 4.8407 g/cc is `EARTH_DENSITY_GCC` 5.51 vs 5.514 — same number, different constant, not a discrepancy. |
| 13 | **`SeededRandom` path.** The brief and several lanes cite `src/utils/SeededRandom.js`. | **`src/generation/SeededRandom.js`.** `src/utils/` does not exist. | Any control claiming to have read the former did not. |
| 14 | **Draw-counter recipe.** The brief prescribes `float`/`range`/`chance`/`gaussian` at 1/1/1/2. | **Incomplete — it omits `child()`**, which calls `this.rng()` directly (`SeededRandom.js:95`) and fires once per moon at `StarSystemGenerator.js:594`. Correct set: `float` 1, `range` 1, `chance` 1, `gaussian` 2, `child` 1. `int`/`pick`/`logNormal`/`gaussianClamped` delegate and would double-count. | A counter using the corrected set reproduces the corpus totals exactly; the brief's set does not. |
| 15 | **`/tmp/claude-1000/wd-c7-ic` worktree.** instrumentC lane said it removed it; gates verifier said it was never in `git worktree list`. | **Moot.** The current list holds the 9 project worktrees plus H2's `/tmp/claude-1000/wd-c7-treat` only. | Re-checked in this pass. |

---

## 7. REFUTED — what the build plan, the handoffs, and the lanes got wrong

1. **⭐ The build plan's own 8b safety claim, "`radiusEarth` 0/400," is wrong twice over.** It measures the *generated* `pData.radiusEarth`, which `_generatePlanetMoon` overwrites two lines later at `MoonGenerator.js:419-427` — so the field is insensitive by construction. And even so the *record's* `radiusEarth` is **not** zero: it moves on **7 / 24** planet-class moons (FENCE-221), by up to **1.969×**, because a draw-count shift rewrites the `fraction = rng.range(0.10, 0.25)` draw that follows at `:381`. **Any "0/N" on this field is a probe artefact.** This is the specific number that would have shipped this change as "safe."

2. **⭐ The declared step-8b delta table has no geometry columns.** Eleven geometry/mass columns move on 7/24 planet-class moons. Nine of them (`radiusScene`, `radius`, `orbitRadiusScene`, `orbitRadius`, `orbitSpeed`, `inclination`, `startAngle`, `tidalHeating`, the derived surface gravity) appear in no lane's declared row list either — they were found only by full leaf enumeration.

3. **PLAN.md:853's indicative figures do not describe the measured result.** It predicts "weathered palette ≤0.02/channel on 6 of 7" and "`icenessOf` 0 on 7 of 7 both sides." Measured on FENCE-221: `landPalette` moves 17/24 with **9/24 above 0.02** on some channel and a max of 0.4235; `iceness` moves **13/24**, with the any-ice count going 2 → 11. The 1/√AU proxy was directional-only and is now superseded.

4. **The gates lane's prediction sentence is true but incomplete, and a commit written to it ships red.** It names only the vitest half. `npm run check:instruments` runs four channels and C7 reds **three**: Instrument A, Instrument B, **and both halves of Instrument C**.

5. **`composition.waterFraction` does not exist** (defined on 0/24). Any report of "waterFraction 0/N unchanged" is a confident zero from a nonexistent path.

6. **The brief's `StarSystemGenerator.js:966-972` citation is wrong at HEAD `59b48ac`.** The moon fold is `:946-952`; `:962-970` is the `resonancePartners` loop; `:972` is the `entry.planetData.systemContext = {` assignment.

7. **The prior "22.0–22.7% of planet-class moons" figure does not reproduce on any corpus measured here.** The fence figure is **7 / 26 = 26.9%** of generations, or **7 / 24 = 29.2%** of surviving planet-class moons. (It was not tested against MC-197 or PCC-120.)

8. **⭐⭐ No lane's numbers discriminate the specified PRE-migration AU from a POST-migration mutant — except one assertion.** Three verifiers built the mutant independently (resolving each call's parent by object identity against the final `planets[]`). Result on FENCE-221: post-migration AU differs from pre-migration on only **3 / 26** calls (`wd-61` ×1: 0.7346754251384624 → 0.7435945841456487; `wd-166` ×2: 2.435405180667276 → 2.472362198483761 — both resonance snaps at `StarSystemGenerator.js:682`, ~1.2–1.5%; hot-jupiter migration at `:655` moves none of them). Consequences, all re-derived here:
   - Every geometry column: **bit-identical** under the mutant. Same 7/24 movers, same coordinate set, same per-call deltas on 26/26, same per-seed shifts on 7/221, same corpus total.
   - Instrument B: identical 7-seed draw list, identical 22 rollups, identical `{0, 7, 0, 24}` partition, identical population/shape/class channels. Only **3 of 24** moon digests differ (`wd-61/1/2`, `wd-166/3/1`, `wd-166/3/5`) and **2 of 221** rollups (`wd-61`, `wd-166`, both already inside the 22).
   - Instrument C: **1 of 526** bodies differs (`P:00846:p3:m2`, seed 846, 1.2520245613314565 → 1.2735241208129457); 53 of 55 uniform rows identical; exit code, 65-body mismatch, 461 compared, 31-mover set, every worst body, all 24 zero rows and all citation numbers bit-identical.
   - **The one thing that does discriminate: `moon-rng-stream-identity.test.js:280`.** On STREAM-1500, post-migration AU differs from pre on **17 / 169** planet-class calls. Under **treatment** planet-class min goes 18 → 19 and that assertion **reds**; under **postmig** it stays 18 and that assertion **passes** (only `:256`'s `lines` equality reds, on 2 lines instead of 7). **So Instrument A reports 4 newly-red under the correct convention and 3 under the wrong one.**

   **Therefore: if the re-bless is written purely in counts, an implementation using the wrong AU satisfies almost all of it.** The gate must pin either (a) the `:280` outcome — planet-class min **19**, `pairs` **100**, all 7 planet-class lines moved — or (b) a value on one of the three discriminating bodies, e.g. `wd-61/1/2` `pd.T_eq = 297.02343102728383` (pre) vs 295.2367105975981 (post), or `wd-166/3/1` 205.13409812288415 vs 203.5951470098894.

9. **An argument on the merits for the pre-migration convention, which no lane made:** of the 26 `_generatePlanetMoon` calls on FENCE-221, **2 land on planets later culled**, so a post-migration convention would be **undefined** for them. On IC-526's P scan, 3 of 67 calls have the same problem. The pre-migration value always exists.

---

## 8. Open risks and unmeasured surface

| Risk | Status |
|---|---|
| **Degenerate outputs that do not exist today.** `pd.tidalHeating === 0` on 2/24; `eccentricity` at exactly 0 (`gc-22/2/2`), 2.69e-257, 1.61e-72, 8.33e-28 on 4/24, where control's smallest \|e\| is 4.14e-17. | **Measured, unresolved.** Anything downstream taking a log, a reciprocal or a normalisation of these will behave differently. **Nobody traced the consumers.** |
| **`wd-27/3/1`'s parent orbits at 1293.76 AU.** Its control `T_eq` is 5958.25 K at a hardcoded 1 AU; treatment gives 165.65 K. Its `pd.massEarth` goes 0.861 → 6.575 M⊕ (7.64×) and its radius 1.969×. | **Measured.** This body's control values are physically absurd; the change fixes it, but it is the single largest single-body swing in the corpus and worth a named look. |
| **Whether the 24 (or 64, or 65) moons LOOK right.** | **Not measurable by any instrument here.** Instrument C reports uniform values with no tolerance; 21 of 24 `lavaGlowColor` moves are below the 8-bit display floor; two `noiseScale` movers are float64 ULP residue. **Max's eyes are the gate.** |
| **The pre/post-migration convention gate.** | **Open unless the re-bless pins `:280`'s outcome or a value on `wd-61/1/2` / `wd-166/3/1` / `wd-166/3/5` / `P:00846:p3:m2`.** See §7.8. |
| **`ExoticOverlay.js:353`** regenerates swapped planets via `PlanetGenerator.generate` — 30 of the 1017 calls on FENCE-221. **None was ever substituted** (`pgCallsWhileActive` is exactly 26). | **Measured as untouched by C7.** Not otherwise explored. |
| **`wd-1403`'s terrestrial moon** — the fence pins it as the only terrestrial-moon system in 6000 seeds and the only seed exercising seven `MoonGenerator` draws. | **Covered but never named:** the plain channel is a clean 0/770 (FENCE-221) and 0/705 (MC-197). `wd-1403/2/2` is a planet-class moon and does move, but is not a geometry mover. |
| **Baseline provenance.** `tests/baseline/*` recorded from `952c5d0` with `dirty: true`. | **Unresolved and previously unflagged.** The instrument warns about it itself. |
| Live rendering, save-file migration, and any persisted system snapshot from an already-visited system. | **Entirely unmeasured.** No lane touched the runtime. |

---

## 9. What Max would see

Planet-class moons are **24 of 794 moons on FENCE-221 (3.0%)** — the ~3.5% of moons that already render through `Planet.js`. Every one of them changes. **Seven of the twenty-four change physically**; the other seventeen keep their exact size and orbit and change only in temperature, colour and condition.

**On 17 of 24 — same rock, different climate.** The moon is exactly where it was, exactly the size it was, on exactly the same orbit, at exactly the same angle. What changes is what it's made of and how hot it is. Surface temperature moves by **more than 50 K on 24 of 24 bodies and more than 100 K on 21 of 24**; the median shift is **151 K (272 °F)**. Most get colder (17 of 24), because most of these moons orbit a parent that is farther from its star than the hardcoded 1 AU pretended. A worked case: `wd-11/2/2`, parent at 2.06 AU — **355 K (180 °F) → 248 K (−14 °F)**. Six of the moons cross from having a rocky surface to having none at all — they acquire a hydrogen envelope at 10–15 bar and become gas bodies (`h2-he` count 3 → 9), which suppresses the greenhouse lift entirely. Eleven of twenty-four **lose their aurora**; one gains one. Nine of twenty-four shift ground colour by a visible amount (≥0.02 per channel), with a worst case of 0.42 on `wd-27/3/1` — the rest of the palette movement is below what a display can show.

**On 7 of 24 — visibly a different moon in a different orbit.** These are the bodies where the RNG stream shifts, so every size and orbit draw is redrawn. Concretely:

| Body | Parent AU | Radius | Orbit radius | Surface temp |
|---|---|---|---|---|
| `wd-24/1/2` | 0.22 | 0.854 → 0.832 R⊕ (0.97×) | 148.2 → 124.7 R⊕ (**0.84×**) | 118 → **252 K** |
| `wd-27/3/1` | 1293.76 | 1.100 → **2.166 R⊕ (1.97×)** | 300.7 → 190.0 R⊕ (0.63×) | 5958 → **175 K** |
| `wd-66/0/1` | 0.23 | 0.326 → 0.399 R⊕ (1.23×) | 60.9 → 55.3 R⊕ (0.91×) | 197 → **425 K** |
| `wd-100/5/1` | 179.32 | 0.452 → 0.528 R⊕ (1.17×) | 94.3 → 83.0 R⊕ (0.88×) | 1354 → **101 K** |
| `wd-174/0/1` | 0.77 | 0.396 → 0.560 R⊕ (**1.42×**) | 97.9 → **56.7 R⊕ (0.58×)** | 1013 → 1154 K |
| `wd-189/0/1` | 0.47 | 0.363 → 0.564 R⊕ (**1.55×**) | 44.1 → 61.6 R⊕ (1.40×) | 272 → **375 K** |
| `gc-22/2/2` | 0.17 | 0.508 → 0.602 R⊕ (1.19×) | 88.8 → 92.6 R⊕ (1.04×) | 120 → **292 K** |

On these seven the moon is **up to twice the diameter it was**, in an orbit **up to 42% tighter or 40% wider**, at a **different starting angle** (median shift 2.2 radians — it is somewhere else in its orbit at t=0), on a **different orbital-plane tilt** (median 0.093 rad, and `wd-24/1/2`'s inclination flips sign, so the plane tips the other way), moving at a **different speed** (up to 34% faster or slower). Surface gravity follows the radius exactly — **0.97× to 1.97×**.

**Five of these seven also become tidally locked.** `wd-24/1/2`, `wd-66/0/1`, `wd-189/0/1` and `gc-22/2/2` stop rotating relative to their parent (rotation 0.0048 → **exactly 0** on `wd-24/1/2`); `wd-174/0/1` drops into a 3:2 resonance. Two go the other way and start spinning. **This is a gameplay-visible change, not a palette shift** — a locked moon shows one face forever.

**Honest summary of magnitude:** for 17 of 24 it is "the moon is a different temperature and often a different colour, in the same place." For 7 of 24 it is "**the moon is a visibly different size, in a visibly different orbit, at a different point in that orbit, and half of them have stopped rotating.**" Every one of the 24 is a body that already exists in a system Max may have visited; nothing is added and nothing is removed.

**Where to look.** Per PLAN.md:853, park on a seed **from this table's top movers**, never a guessed one — a random seed has no planet-class mover and produces a green, pretty, meaningless pair. Best single before/after: **`wd-27` planet 3 moon 1** (radius 1.97×, orbit 0.63×, 5958 K → 175 K, palette Δ 0.42, gains an n2-o2 atmosphere). Best "different orbit" case: **`wd-174` planet 0 moon 1** (orbit 0.58×, and it locks into 3:2). Best "same rock, different climate" case: **`wd-11` planet 2 moon 2** (bit-identical geometry, 180 °F → −14 °F).

---

## 10. The re-bless surface — four artefacts, not one

1. `tests/baseline/body-identity.json` — **24 moon hashes + 7 planet hashes across 22 systems, plus draw profiles on 7 seeds** (`WD_REBLESS_BODY_IDENTITY=1`, deliberate and named, not reflex).
2. `tests/baseline/port-uniform-capture.json` — **65 body fingerprints** re-recorded via `--capture`/`--record`.
3. `tests/moon-rng-stream-identity.test.js` — `PINNED_STREAM_SET` (7 planet-class lines), `stream.pairs` 105 → **100**, and the partition floor `Math.min(...nums(planetClass))` 18 → **19** at `:280`. ⭐ **This last constant is the only convention-discriminating assertion in the entire gate — do not weaken it.**
4. Documentation, four lines: `docs/FEATURES/one-pipeline-two-frontends-PLAN.md:853` (**machine-checked — the citation fence reds without it**), `docs/FEATURES/step8-handoff-2026-08-14.md:139`, `docs/FEATURES/step8-handoff-c7-2026-08-14.md:60`, `docs/NOW.md:33` (all three ungated, all three stale).

**`npm run check:instruments` is red on arrival unless items 1, 2 and 4 ride in the same commit.**

---

## 11. Repo state at end of this lane

```
$ git -C /home/ax/projects/well-dipper status --porcelain=v1 --untracked-files=no
(no output, exit 0)
$ git rev-parse HEAD
59b48ac9e4224a1b60768e795d5af5c9bb66d78a
$ ls /home/ax/projects/well-dipper/probe-*.mjs
ls: cannot access 'probe-*.mjs': No such file or directory
```

Clean. No tracked file modified, staged, committed or checked out. No probe file created in the repo by this pass; all scratch work was read-only or lived in `/tmp/claude-1000`.

**⚠ One item outstanding for the orchestrator:** harness H2's git worktree at `/tmp/claude-1000/wd-c7-treat` (~314 MB, detached at `59b48ac`, one modified file: the C7 edit at `MoonGenerator.js:378`) is still registered. It contains a `node_modules` **symlink into the pristine repo** — remove it with `git -C /home/ax/projects/well-dipper worktree remove --force /tmp/claude-1000/wd-c7-treat`, not a bare `rm -rf`.