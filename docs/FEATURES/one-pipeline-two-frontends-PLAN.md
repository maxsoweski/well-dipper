# One Pipeline, Two Front‑Ends — the buildable plan

*Destination: `docs/FEATURES/one-pipeline-two-frontends-PLAN.md`*
*Branch: `feature/world-engine-production-L1`. Parent strategy: `docs/FEATURES/planet-lod-CHARTER.md`. Supersedes the sequencing in `docs/FEATURES/lab-pipeline-into-game-PLAN.md` (that document's diagnosis is corrected in §2; its measurements are still cited).*

---

## 1. The one‑paragraph version

The World Engine Lab can draw about 52 planetary features. The main game draws four of them through the world engine, and it is not because the game is missing code — it is because the lab's *driver stage* (the ~800 lines that turn a world's physical condition into shader numbers) lives inside a 6,411‑line HTML file that nothing under `src/` can import, and because the two front‑ends build their inputs to the shared engine differently. So every feature that has ever reached the game reached it by a human reading the lab, re‑deriving the law, and hand‑typing it into `Planet.js` — and three laws have already silently drifted apart doing exactly that. This plan does not "port more features." It builds the machinery that makes porting unnecessary: small pure **driver packs** under `src/worldengine/drivers/` that both the lab and the game import, a **runtime pack list** so adding a pack is one array entry rather than one branch per body class, and **five machine‑checked fences** that refuse a future increment that reintroduces a copy. Along the way it ships the two things Max asked for next — gas giants, then moons — because shipping them is what proves the machinery works, and because a fence generalised from two working examples bites harder than one designed from a diagram.

---

## 2. What makes migrations expensive today

**The working diagnosis was half right, and the half that was wrong changes the whole ordering.**

The brief's diagnosis was: *the lab and the game reach the world engine by two separate routes, so each migration hand‑reconciles them.* Recon contradicts the first clause and confirms the consequence.

**They already share the derivation core.** [⭐ Citation convention — see §10 at the end of this file; refs into `conditionFromPlanet.js` carry **no line number** on purpose.] `src/worldengine/port/conditionFromPlanet.js` (`import { deriveConditionVector }`) and `planet-lod-lab.html:174` import `deriveConditionVector` from the *same* file, `body-condition-vector.js`. There is one condition engine, not two. [VERIFIED — read both import lines.]

What is actually duplicated is the two *ends*:

**(a) Upstream — two constructors for the engine's input.** The game builds an `fp` literal in `conditionFromPlanet.js` (`const fp = {`); the lab builds one from `DRIVER_PRESETS`. Fed the same nominal body they disagree by 3–6× on temperature (Venus 737 K lab / 2345 K game; Jovian 125 / 776) and by 5–7 orders of magnitude on tidal heat (Europa 137 / 0.0019). Two causes, both verified:
- The game double‑applies a greenhouse correction — `T_eq: surfaceTemperatureOf(d.T_eq ?? 288, atmosphere?.pressure)` in that fp literal, a fit calibrated on Earth 1 bar and Venus 92 bar (`conditionFromPlanet.js`, the `TAU_REF`/`TAU_EXP` block above `export function surfaceTemperatureOf`) and then handed a giant's 1000 bar, where it multiplies by 6.207×.
- The port reads `d.tidalHeat` (via `baseStep.js:26-33`) while `PlanetGenerator.js` emits `tidalHeating` (grep `tidalHeating, // D12`), so the real value is dropped and a hardcoded 1 M☉‑at‑1‑AU fallback substituted. Measured over 161 generated planets: within 2× of the true value for **5.6%** of them, median 75× off. ⚠️ **THESE TWO FIGURES DO NOT REPRODUCE AND ARE KEPT ONLY AS THE CLAIM BEING CORRECTED — do not re‑quote them.** The 161‑planet population is not named anywhere and the treatment of bodies where both rules return exactly 0 (an `e = 0` body: an $e^2$ law is 0 under either rule) is not stated, and both choices move the headline a lot. Re‑measured for Step 2's gate over a fully specified 526‑body population (`docs/FEATURES/step2-tidal-delta-table.md` §4): within 2× is **19.4%** counting both‑zero bodies as agreement and **11.1%** dropping them; the median ratio is **31.9986×** and **49.9184×** respectively — and it is strongly stratum‑dependent (16.9% / 41.8× on system planets, 4.7% / 14.9× on planet‑class moons, 40.0% / 32.0× on the forced‑type grid), so one number for "the galaxy" was always going to be a choice of population. **The direction and the order of magnitude survive and the defect is real** — the fallback is wrong by roughly 1.5 orders of magnitude on the median body — but the precise numbers on this line do not, on any stratum or on the whole.

**(b) Downstream — the driver stage exists only in the lab.** `applyDrivers` (`planet-lod-lab.html:1933-2734`) plus `ensureNetworkRouted` (`:2745`) derive ~40 features; the game has 71 hand‑assembled uniforms in `src/objects/Planet.js:1548-1717`. The measurement that settles this: **the six derivations the game has are exactly the six that already lived in importable modules** (`surfacePaletteOf`, `icenessOf`, `biosphereOf`, `craterUniformsFrom`, `atmosphereOpticsOf`, `emissiveBlackbody`). Zero of the ~40 derived *inside* `applyDrivers` has any game path. The boundary of the port **is** the boundary of extraction.

**The cost is not effort — it is drift.** Three laws have already diverged while someone was actively trying to keep them in sync — and a FOURTH instance was caught one rung earlier and closed on 2026-08-06: `surfacePaletteOf(cond).weathered`, one value from one world-engine source, reached the lab's shader as `uBaseColor` and the game's as `uWeatheredColor` (`Planet.js:30`). Two names for one value is the state each row below started in, and it is what let Instrument C's original name intersection watch `uFreshColor`/`uSedColor` while silently skipping the largest contributor to a rocky body's surface colour. The lab was renamed onto the game's spelling (it names the endmember, not a position in a ramp); zero uniform delta on all 526 bodies, and a re-divergence now trips Instrument C's completeness fence (exit 2, verified by negative control) instead of quietly narrowing the watched set. The three that got further:

| Quantity | Sources today | Evidence |
|---|---|---|
| Aurora ring | 2 divergent laws | `PlanetGenerator.js:490-503` vs `planet-lod-lab.html:2585-2611`; the lab floors `ringWidth` at 0.07 and adds a giant‑dynamo boost, the game adds a `windIntensity` term — under a lab comment (`:2517`) claiming it *mirrors* the game |
| `limbExponent` | 3 sources | `atmosphereOptics.js:161` (continuous) → lab overrides with a binary at `planet-lod-lab.html:2452` → `Planet.js:1579-1583` deliberately takes the module's, recording it in‑source as "a live drift between the lab and the module it imports" |
| Crater relief GLSL | 1 module + 1 transcription | `src/worldengine/shaders/craterRelief.glsl.js:1-20` — "Transcribed from `planet-lod-height.glsl.js`" with three deliberate divergences, held only by a transcription test, and the lab does not import it back |

Against exactly one artifact that got it right: `src/worldengine/shaders/heightNoise.glsl.js:1-14` — `hash3`/`noised`/`fbmd` "live here and NOWHERE else," and `planet-lod-height.glsl.js:13` imports them **back**. That module costs **zero** port action for a future change. That is the template, and it is the acceptance test for every step below.

**Two more structural facts the diagnosis missed.**

1. **`buildLabPlanetMaterial` has exactly one call site** — `src/main.js:2439`, inside the hand‑invoked `window._lab.tryLabShader` debug hook. No body of any class receives the lab material automatically. So "wire up moons" is not currently expressible as feature work: there is no production consumer to wire *into*.

2. **The 351 lab uniform defaults are neutral OFF switches, not arbitrary values.** `planet-lod-uniforms.js:380` — `uBandStrength: 0.0 // F24 master gate … <= 0 ⇒ no-op`; `:400` `uJetStrength: 0.0`; `:425` `uPolarStrength: 0.0`; `:165` `uCraterDensity: 0.0`; `:68` `uBioCoverage: 0.0`. [VERIFIED by reading the file.] This is why the plan is incremental rather than big‑bang: driving twelve gas‑deck uniforms on a defaults material yields *bands on a plain sphere*, not garbage. Two designs argued the whole derivation stage must be extracted before any feature can ship. That argument is true‑sounding and wrong, in this codebase's signature way.

**One correction to a claim you will see repeated.** The port does **not** drop `massEarth` and `surfaceHistory` from its `fp` — both are there, as the `massEarth:` and `surfaceHistory:` keys of `conditionFromPlanet.js`'s `const fp = {` literal. [VERIFIED by reading the literal.] It drops **three** things: `tidalHeat` (name mismatch), `magneticField` and `metallicity` (never set, though body-condition-vector.js:156 `magneticField:   fp.magneticField` and :157 `metallicity:     fp.metallicity` declare them as vector keys). And `surfaceHistory` *goes in* and is *not emitted* — the loss is in the vector, not the adapter. Both statements about `surfaceHistory` in the recon are true; they describe different halves of the same pipe. Fix the vector, not the fp. **[Step 1 SHIPPED both halves: `magneticField` is now forwarded by the adapter and `surfaceHistory` is now emitted by the vector — see the Step 1 record below. `metallicity` is still deliberately withheld until Step 5.]**

---

## 3. The MVP checklist

Max's MVP: *"all of the planned features in World Engine are implemented in the World Engine Lab **and** have been wired up in the main well-dipper game."*

The planned‑feature list is closed and countable: **F1–F53** (58 rows with F31's six sub‑variants) at `docs/FEATURES/planet-visual-features.md:216-347`, cross‑checked against the 49‑key `FEATURES` registry in `planet-archetypes.js:6-140` and F‑tags on 334 of the 351 uniforms in `planet-lod-uniforms.js`.

**Read the status column in that document with care.** Its `[current]` means *the game draws something*, not *the world engine drives it*. Twenty‑two features are `[current]` there and **zero** of them reach a pixel through the world engine — they are the game's own March‑2026 type‑branch code (`Planet.js:380-570` renders gas bands as `sin(lat*3.5)+sin(lat*7.0+0.5)+sin(lat*13.0)`; `:955-1080` hand‑renders the exotic types; ice caps are a hardcoded `vec3(0.85,0.88,0.92)` at `:721-725`). Under standing constraint 3 ("the game bends") those are **not credit toward MVP — they are the things to be replaced.** Scoring them green is the single easiest way to believe this project is 60% done when it is 7.5% done.

### Legend
- **LAB** — ✅ implemented and observed rendering · ⚠️ implemented but never observed rendering · ❌ absent
- **GAME (WE)** — ✅ driven by the world engine · ◑ partially · ❌ not · **R** = the game has its own parallel implementation *to be replaced*
- Row status derived from `docs/FEATURES/planet-lod-campaign-tracker.md:56-105`, `docs/FEATURES/cards/PROFILES.md:35-49`, and a mechanical name‑intersection of Planet.js:1548 `_createSurface()`'s 71 uniforms against `planet-lod-uniforms.js`'s 351 (27 shared names at the time of writing). ⚠️ **The name intersection is no longer the watched set.** P2 (2026‑08‑06) replaced it with an explicit value‑source map: **55 watched** = 28 name‑matched + 7 aliased + 20 game‑only, 16 deliberately unwatched of 71. The rename of the lab's `uBaseColor` → `uWeatheredColor` moved one uniform from *aliased* to *name‑matched*, which is why the intersection reads 28 today and 27 in the sentence above. Do not size Instrument C from this row — size it from `node tools/port-uniform-delta.mjs --list`.

| ID | Feature | LAB | GAME (WE) | Note |
|---|---|---|---|---|
| F1 | Mountains / ranges | ✅ | ❌ R | game has type‑branch relief |
| **F2** | **Craters** | ✅ | **✅ 7/7** | but the GLSL is a transcription, not a shared module |
| **F3** | **Ejecta & rays** | ✅ | **◑ 4/7** | apron only; `uRayBrightness/uRayCount/uRaySharp` absent — the ray system is the missing half |
| F4 | Canyons / rifts | ✅ | ❌ | |
| F5 | Scarps & fault systems | ✅ | ❌ | |
| F6 | Plateaus / tessera | ✅ | ❌ | |
| F7 | Volcanic edifices | ✅ | ❌ | |
| F8 | Lava plains & flows | ✅ | ❌ R | game has lava cracks |
| F9 | Chaos / disrupted terrain | ✅ | ❌ | |
| F10 | Ridged / grooved icy terrain | ✅ | ❌ | |
| F11 | River networks | ⚠️ **inert** | ❌ | measured .00014 while drivers derive `fluvialActivity` 1.0 |
| F12 | Deltas & alluvial fans | ⚠️ **inert** | ❌ | measured .00015 |
| F13 | Outflow channels | ✅ | ❌ | |
| F14 | Lakes & seas | ✅ | ❌ R | game has ocean type + islands |
| F15 | Dunes & wind forms | ✅ | ❌ | |
| F16 | Dust mantles | ✅ | ❌ | |
| F17 | Glacial landforms | ✅ | ❌ | |
| F18 | Sublimation landscapes | ✅ | ❌ | |
| F19 | Mass‑wasting deposits | ⚠️ **inert** | ❌ | measured .00006 |
| F20 | Coastlines | ✅ | ❌ | |
| F21 | Karst / dissolution | ✅ | ❌ | |
| F22 | Polar caps & frost | ✅ | ❌ R | game has hardcoded caps; needs `axialTilt` (unit bug, §7) |
| F23 | Snowline boundary | ✅ | ❌ | same input gap as F22 |
| F24 | Zonal belts & zones | ✅ | ❌ R | **step 5/6 target** |
| F25 | Jets & shear | ✅ | ❌ R | **step 5/6 target** |
| F26 | Latitude weather bands | ✅ | **UNKNOWN** | doc says `[current]`; no Hadley/ITCZ code found in `Planet.js`. Doc stale or ID wrong — resolve before scoring |
| F27 | Great‑spot anticyclone | ✅ | ❌ R | storm slice — **not in this plan** (§7) |
| F28 | Storm clusters | ✅ | ❌ | storm slice |
| F29 | Polar vortex | ✅ | ❌ R | **step 5/6 target** |
| F30 | Lightning | ✅ | ❌ | |
| F31a–f | Cloud/haze family (6) | ✅ | ❌ R | F31c/e partial in lab; F31b is the gas band deck |
| F32 | Dayside thermal hotspot | ✅ | ❌ R | |
| F33 | Nightside thermal glow | ✅ | ❌ R | |
| **F34** | **Limb rim glow** | ✅ | **✅ 2/2** | via `atmosphereOpticsOf` — a shared module |
| **F35** | **Terminator gradient** | ✅ | **◑ 3/4** | |
| F36 | Sunglint | ⚠️ **unverified** | ❌ | "not verified either way" — `PROFILES.md:37` |
| F37 | Aurorae | ✅ | ❌ R | **two divergent laws today** (§2) |
| F38 | Airglow limb band | ✅ | ❌ | |
| F39 | Cloud optics | ✅ | ❌ | |
| F40 | Dust storms | ✅ | ❌ R | |
| F41 | Hemispheric magma ocean | ✅ | ❌ | |
| F42 | Carbon‑world crust | ✅ | ❌ R | |
| F43 | Crystalline facet field | ✅ | ❌ R | `uFacetStrength ≡ 0` today (§7) |
| F44 | Hexagonal crust | ⚠️ **BLOCKED** | ❌ R | no preset, no archetype |
| F45 | Shattered crust | ⚠️ **BLOCKED** | ❌ R | no preset, no archetype |
| F46 | Bioluminescent mats | ⚠️ **BLOCKED** | ❌ R | `habGate ≡ 0` ⇒ `uBioCoverage ≡ 0` |
| F47 | Machine surface | ⚠️ **BLOCKED** | ❌ R | |
| F48 | City lights | ⚠️ **BLOCKED** | ❌ R | |
| F49 | Ecumenopolis | ⚠️ **BLOCKED** | ❌ R | |
| F50 | Posterize + Bayer | ✅ | ❌ R | universal envelope |
| F51 | Rings | ✅ | ❌ R | `RingRenderer.js` multi‑band dead |
| **F52** | **Eclipse / moon shadows** | ❌ **absent** | game‑only | the ONE feature the lab lacks — see §7 |
| F53 | Close‑up LOD2 detail | ✅ | ◑ split | distance ramp IS shared (`BodyRenderer.js:11` imports `lodRampOf`); `lodLevel` uniform declared at `Planet.js:118`, read by no shader |

### Honest headline

- **Through the world engine, in both lab and game: 4 of 53 (7.5%)** — F2, F34 complete; F3, F35 partial.
- **Lab‑only: 48.** Of those, 22 have a game‑own parallel to delete, 26 have nothing in the game.
- **Game‑only: 1** (F52).
- **UNKNOWN: 1** (F26 — resolve the doc/ID question; do not guess).
- **Never observed rendering anywhere: 10** — F44–F49 blocked, F11/F12/F19 inert, F36 unverified.

### Three queues, not one

Wiring queue (b) or (c) first manufactures a failure nobody can attribute:

- **(a) Wire‑and‑it‑works** — the pack targets in this plan: F24, F25, F29, F31b, F2, F3, F22, F23, plus the crater/palette/iceness family.
- **(b) Wire‑and‑it‑needs‑a‑bake** — F11/F12 (river router), F27/F28 (storm slice), the four gas vertex attributes (`aBand/aShear/aMush/aStorm`, zero‑filled at `LabPlanetMaterial.js:36`).
- **(c) Wire‑and‑it‑renders‑nothing until world‑gen work lands** — ~8 features whose inputs are degenerate today: `uRayBrightness ≡ 0` because `hasAtmo` is true on 100% of bodies; `uFacetStrength ≡ 0` because `conditionFromPlanet.js`'s `atmosphereFromPlanet` only nulls atmosphere on `if (phys.retained === false) return null;`, which never happens; `habGate ≡ 0`; `airlessnessOf ≡ 0`. **These must not be measured through the renderer.**

---

## 4. The plan

**Sizes:** XS ≤ ½ session · S ≈ 1 session · M ≈ 1–2 · L ≈ 2–3 · XL ≈ 4+.

### Four standing instruments (built in Step 0, referenced by name in every gate)

| | Instrument | What it proves |
|---|---|---|
| **A** | Per‑test‑ID baseline | that no individual test flipped, in *either* direction |
| **B** | Body‑identity hash | that the RNG draw stream did not move |
| **C** | Shipped‑uniform delta harness | that a change to the port did not silently move a pixel that already ships |
| **D** | Frame‑loop crash harness (built at Step 6) | that the render loop survives N frames with zero uncaught exceptions |

---

### Step 0 — Freeze the baseline you are about to test against · **S** · deps: none

**What.** Three instruments, zero behaviour change.

- **A.** `npx vitest run --reporter=json --outputFile=tests/baseline/known-failures.json`, plus `scripts/test-baseline.mjs --check` that diffs the current failing test‑ID *set* against the committed one and exits 1 if any ID moves either way.
- **B.** `tests/body-identity-fence.test.js`: for a fixed seed list, hash `{radiusEarth, type, massEarth, and every moon's full record}` out of `StarSystemGenerator.generate` into `tests/baseline/body-identity.json`.
- **C.** `tools/port-uniform-delta.mjs`: resolve the uniforms shared between `Planet.js`'s production material and `planet-lod-uniforms.js` over ≥300 generated bodies, and emit min/median/p95/max deltas against a committed capture. — **As built, this was a 27‑name intersection, and that was the instrument's own blind spot.** A matching key made of *spelling* cannot see one world‑engine value carried under two names. `surfacePaletteOf(cond).weathered` shipped as the lab's `uBaseColor` and the game's `uWeatheredColor`, so `uFreshColor` and `uSedColor` were watched and the largest contributor to a rocky body's surface colour was not. **P2 (landed with Step 1, 2026‑08‑06) widened C to an explicit VALUE‑SOURCE map: 55 watched = 28 name‑matched + 7 aliased + 20 game‑only, with 16 of the game's 71 deliberately unwatched and each one named in `UNWATCHED` with its reason.** Three of the four quantities Step 2's gate names (`uWeatheredColor`, `uLavaGlow`, `uLavaCrust`) were outside the 27 — Step 2's primary gate could have run green over its own declared subject.

**Why.** The known‑good baseline is a *scalar* — 24 failed / 17 failed files / 22685 passed — and a scalar cannot see one test going red while another goes green, nor distinguish a GLSL‑backtick parse error (suites stop **collecting**: 0 failures, N failed files) from a logic failure. Instrument B exists because `SeededRandom.child()` draws from its parent (`src/generation/SeededRandom.js:95`), so a changed draw count silently rewrites bodies with nothing to say so. Instrument C exists because four of the steps below touch a live game path and three lenses independently found regressions that no existing test can see.

**This is not the deferred procgen snapshot.** Max deferred *render images* because they pin a half‑migrated visual state. A generation‑order hash is invariant to every rendering change and moves only when draw counts move.

**Files.** `scripts/test-baseline.mjs`, `tests/baseline/known-failures.json`, `tests/baseline/body-identity.json`, `tests/body-identity-fence.test.js`, `tools/port-uniform-delta.mjs`, `package.json`.

**Gate.** All three green on a clean tree — *then deliberately break each and confirm it fails loudly*: insert a throwaway `rng.range(0,1)` before `PlanetGenerator.js:526` → B goes red; skip one passing test → A goes red; nudge one shared uniform → C reports a non‑zero delta. **A gate that has never failed is not a gate.**

**If moved later.** Every subsequent gate cites A, B or C. Nothing can move before this.

---

### Step 1 — Widen the condition contract, additively, with provenance · **M** · deps: Step 0 · ✅ **SHIPPED `0af246e` 2026‑08‑06.** Everything under *What* and *Gate* below is the plan AS WRITTEN, kept verbatim because source comments and tests quote it by line; the **✅ LANDED** annotations record what was actually built and where it differs.

**What.** Two files, no law changes.

1. In `src/worldengine/base/body-condition-vector.js` (still at the repo root at this point), **emit** `surfaceHistory` — it is already handed in by the `surfaceHistory:` key of `conditionFromPlanet.js`'s `const fp = {` literal and silently dropped by the vector's return literal (body-condition-vector.js:109 `return {` … :198) — ⚠️ the bare `:109-158` originally written here read as a range in the *adapter*, which is a different file. ✅ **LANDED**: `surfaceHistory: fp.surfaceHistory ?? null` in that return literal, with no default invented on the vector side.
2. In `conditionFromPlanet.js`, forward `magneticField`, `atmosphere.color`, `habitability`, `axialTilt` (**convert to radians at the seam** — the game stores 0.41 for 23.4° at `SolarSystemData.js:180`; do not pass through), and `radiusEarthCanonical` distinct from the drawn radius. ⛔ **THE DIRECTION IN THIS LINE IS WRONG AND IS KEPT ONLY AS THE THING BEING CORRECTED** — `conditionFromPlanet.js` and `tests/port-condition-contract.test.js` both quote "convert to radians at the seam" verbatim in order to refute it. The cited evidence (*the game stores 0.41 for 23.4°*) is itself the proof that the game's number **is already radians**, so a degrees→radians conversion here would divide by 57.3 twice and yield 0.00716 for Earth: finite, plausible, wrong by exactly the factor the step exists to remove. ✅ **LANDED, as RADIANS → DEGREES**: `axialTiltDegreesOf` (pure conversion) composed with `effectiveObliquityDegreesOf` (folds the signed, unbounded result into `[0,90]`), forwarded as the fp key `axialTilt`. Also landed: `magneticField`, `atmosphere.color` (which turned out to have been forwarded all along — now fenced), `habitability` **as a scalar** via `habitabilityScalarOf` because the two front‑ends disagreed about whether it is a number or a `{score,factors}` object, and `radiusEarthCanonical` (emitted by the vector as `R_c`).
3. **Do NOT forward `metallicity` here.** It lands in Step 5. Reason below.
4. ✅ **LANDED** as `hasEngineAtmosphereShape` + `atmosphereFromPlanet` in `conditionFromPlanet.js` (grep the symbols; the `:101` below described the pre‑Step‑1 file). Replace the atmosphere sniff — `if (!phys) return gameAtmosphere; // already engine-shaped` — with a **positive shape validation** (require `retained` or `pressure` to be present). `MoonGenerator.js:192-196` emits a visual‑only `{color, strength}` that passes the current check and yields a condition whose atmosphere is **truthy** and whose pressure is **undefined**, i.e. "has air" for truthiness gates and "vacuum" for every pressure gate.
5. Emit `_provenance` — for each of the 13 inputs, `'measured'` or `'defaulted'`. ✅ **LANDED, and the count is 14, not 13.** The adapter already read a 14th field (`comp.carbonToOxygen`, the one `compositionClass` uses to return `'carbon'`) with no provenance row. The "13 inputs / adding a fourteenth fails loudly" fence was also **self‑referential** — it asserted `PROVENANCE_INPUTS.length === 13` against a list derived from the same constant, so nothing read the adapter. Replaced by `PROVENANCE_COVERAGE`: 14 rows, each naming the exact `d.<field>` reads it accounts for, with `PROVENANCE_INPUTS = Object.keys(PROVENANCE_COVERAGE)` and the coverage checked against the adapter's own **source text**. ⭐ This is what makes Step 2's three new reads (`d.tidalHeating`, `d.starMassEarth`, `d.orbitRadiusEarth`) impossible to add silently.

**Why `metallicity` is held back.** `giant-drivers.js:124-125` reads `condition.metallicity` as its declared *primary* enrichment term, but `canonicalZ0` (`:136-138`) is always the density proxy — a weighted sum in g/cc. Generated metallicity is a **dex** value ranging −0.473…+0.460, 39.6% of it negative. Forwarding it silently switches branches across a unit mismatch: measured over 144 generated gas bodies, `shellDepthFrac` goes from 0.740000 on all 144 to **0.860000 on all 144** — pegged at its clamp ceiling. Step 1's own text would say "changes no law" and its uniform gate would pass green, because no giant uniform ships yet. Two steps later the distinctness gate would fail and the obvious suspect would be the wrong commit.

**Why this step at all.** It is the layer‑0 contract every later step rests on, and `_provenance` is the only mechanism that would have caught the fabrications documented in §2 and §6. Nothing in the seam throws for a moon or a giant — every divisor is floored (`craterUniforms.js:125,133-138,151`; `baseStep.js:99`) — so the failure mode is exclusively a finite, plausible, wrong number.

**Files.** `src/worldengine/port/conditionFromPlanet.js`, `body-condition-vector.js`, `tests/port-condition-contract.test.js`. ✅ **AS SHIPPED, also**: `src/generation/PlanetGenerator.js` (the bake route was handing the adapter a hand‑picked nine‑key subset, so the same body got two different conditions on the bake and render routes — and the three keys they disagreed on were exactly the three Step 1 added), `tools/port-uniform-delta.mjs` + `tests/baseline/port-uniform-capture.json` (P2), and `tests/baseline/known-failures.json` (Instrument A re‑record for the new test file — required in the same commit or A is red from Step 2 onward).

**Gate.** Byte‑identity is achievable here **because nothing reads the new keys**:
- Every *pre‑existing* condition key is bit‑equal (`Object.is`, not a tolerance) over ≥300 generated bodies.
- **Instrument C: zero delta on all 27 shipped uniforms.** ⚠️ **AS RUN THIS WAS 55, NOT 27 — the gate that executed is strictly stronger than the gate stated here, and Step 2 must be sized from the real number.** P2 landed in the same commit and widened Instrument C from a name intersection to a value‑source map: **55 watched = 28 name‑matched + 7 aliased + 20 game‑only, 16 of the game's 71 deliberately unwatched, each named with its reason.** ✅ **MEASURED: 0 uniforms moved, 55 × 526 bodies, population IDENTICAL, no tolerance anywhere** (`npm run port-uniform-delta:check`, exit 0). The three uniforms P2 added that Step 2's own gate names — `uWeatheredColor`, `uLavaGlow`, `uLavaCrust` — were **outside** the 27, so a reader sizing Step 2's primary gate from the "27" would under‑scope it by half and would be scoping out three of its four declared movers. Size it with `node tools/port-uniform-delta.mjs --list`, never from this line.
- **The giant‑driver triple** `{internalHeat, shellDepthFrac, dissipation}` is byte‑identical over 200 generated bodies. *This is the assertion that actually means "additive."* ✅ **MEASURED byte‑identical**, and the assertion re‑derives `shellDepthFrac` in‑test with metallicity forwarded to prove the comparison is not vacuous.
- `_provenance.massEarth === 'measured'` on a generated planet, `'defaulted'` on `{radiusEarth: 0.273}` alone.
- `atmosphereFromPlanet({color, strength})` no longer returns a truthy atmosphere. **Note:** measured 177/177 generated planets carry `{color, physics, strength}` and 0 lack `.physics`, so this change is moon‑only. If this gate *does* go red, it is a real regression, not expected churn. ✅ **MEASURED**: 0/893 generated planets changed, 0/39 Sol bodies changed, 2 terrestrial moons changed in a 200‑seed sweep — i.e. the behaviour change is moon‑only exactly as predicted.

**If moved later.** Steps 4, 5 and 8 all read fields this step adds.

---

### Step 2 — Forward the real tidal heating · **XS** · deps: Step 1

**What.** Map `tidalHeat: d.tidalHeating` in the fp literal, and forward `starMassEarth` / `orbitRadiusEarth` so the fallback is correct when tidal heat is genuinely absent.

**Why it is a wiring bug and not a design choice.** `src/worldengine/base/adaptL0.js:34` — the engine's own, already‑tested, already‑body‑generic adapter — already maps `p.tidalHeating → tidalHeat`, and `baseStep.js:23` names it in‑source: *"Prefer the upstream D12 value (`d.tidalHeat`, from adaptL0ipin ← `planetData.tidalHeating`)."* The base step was designed to receive `adaptL0`'s output; the port hands it a differently‑named field.

⚠️ **Do not "just delegate the fp literal to `adaptL0`."** It returns a base‑step *bundle* (`ageNorm`, not `age`; no `atmosphere`, `tidalState` or `rotationHours`) while `deriveConditionVector` wants an fp, and its output is hashed by `tests/fixtures/v2-0-basestep-golden.mjs:51`. Reconciling the two adapters properly is real work and it is **not** in this plan.

**Why now, hoisted.** `rawTidalIoRatio` feeds `craterSchedule`'s `tExp` (`bombardment.js:174-176`), `resurfacingRateOf` and `meltTemperatureOf` (`surfaceMaterial.js:84,271`) — all live on the game route. Step 9 captures byte‑identity **fixtures** for the rocky pack; capturing them against a fabricated tidal number means re‑capturing them later.

**Files.** `src/worldengine/port/conditionFromPlanet.js`, `tools/port-condition-delta.mjs`, `tests/port-condition-contract.test.js`.

**Gate — deliberately NOT byte‑identity.** This step is *supposed* to move numbers; claiming otherwise would be the fourth wrong measurement in this program's history.
- A **committed delta table** over ≥300 bodies: min/median/p95/max for `rawTidalIoRatio`, `surfaceGravity`, `T_eq`, and the four bakes the assignment block at the bottom of `PlanetGenerator.generate` writes onto `planetData` (symbol-only per §10 — PlanetGenerator.js `planetData.iceness = icenessOf(condition);` and its three siblings) (`landPalette`, `iceness`, `lavaGlowColor`, `lavaCrustColor`), plus the crater uniforms. ✅ **PUBLISHED 2026‑08‑08 at `docs/FEATURES/step2-tidal-delta-table.md`** — generated by `tools/port-condition-delta.mjs`, 526 generated bodies (3 strata) + 14 Sol bodies, no epsilon anywhere. **Declared movers moved (§11.3.6):** `rawTidalIoRatio` 477/526 (median |Δ| 0.00734698, max 210988), `lavaGlowColor` 373/526 (max channel 0.0694927), `lavaCrustColor` 373/526 (max 0.0767156), the four `landPalette` endmembers 4/526 — real but ~1e‑5 in linear RGB, which is why the magnitude column is published beside the moved count and not without it. **Read as a differential, not as a tree reading:** the harness computes BOTH rules itself through the shipped `bodyRawTidal`, so the table is invariant to the working tree's state; the tree's own `conditionFromPlanet(rec).rawTidalIoRatio` was then measured separately and matches the harness's NEW column on **526/526** generated and **14/14** Sol, with the OLD≠NEW control live on 477/526 — the two measurements agree. ⚠️ **Three of the gate's named quantities read exactly 0 and are diagnosed rather than published bare:** `surfaceGravity` and `T_eq` are 0 through a second real derivation (the footprint probe re‑derives all 18 condition keys twice and only `rawTidalIoRatio` differs, on 109/120), `iceness` is the declared no‑op control (its law reads no tidal term), and **all ten crater uniforms are 0 on 526/526** — craters are on at all on only 6/526 bodies and `tExp`'s tidal term is never the binding minimum on those 6, though a forced 0→1e5 swing does move them 6/526, so the chain is wired and the zero is a fact about this population. ⛔ **That last one contradicts this step's own "why now, hoisted" argument for craters** and is left contradicted: the four bakes confirm it, the crater uniforms do not, and Step 9 must not be sequenced on the strength of a crater move that has never been observed. ⚠️ Sol is a pure‑function measurement of records only — no pixel was inspected and nothing there may be quoted as a rendering claim; its all‑zero table is `e = 0`, not evidence the forwarding computes anything.
- **Instrument B stays GREEN** — no new draw was added.
- **Instrument A** shows only tests named in the commit message, each re‑blessed in its own follow‑up commit. Not a blanket re‑record. ✅ **AND IT NAMED ONE NOBODY PREDICTED, 2026‑08‑08: the failed‑FILE set moved 2 → 3 because Step 2 CLOSED THE P‑STRATUM EXCEPTION that `tests/port-route-agreement.test.js` was pinning**, whose "at least one planet‑class moon still diverges" assertion went red on `expected 0 to be greater than 0`. **Why it closed, and note it was NOT by touching `MoonGenerator`:** the rescale still runs after the bake, but the OLD rule made `rawTidalIoRatio` a function of `radiusEarth^5` — precisely the field the rescale overrides — so `meltTemperatureOf` / `crustTemperatureOf` saw one radius on the bake route and another on the render route; the new rule COPIES `d.tidalHeating`, which the rescale does not touch, and both routes now read the same number on **29/29** planet‑class moons over that gate's own 600‑seed corpus (was 28/29 disagreeing — lavaGlowColor 28, lavaCrustColor 28, landPalette 2). The exception is **deleted**, per the instruction the pin carried in its own source. ⛔ **The replacement is NOT `toBe(0)`.** A gate whose subject has gone to zero is §11.1 class **D** through the front door, and the exception's sibling assertion ("diverges only in the declared set") had already gone vacuous exactly that way — with nothing diverging it compared `[]` to `[]` and passed, green over nothing, in the same run that went red. The P block now asserts agreement behind **three controls measured on those same 29 records, each with an executed mutant showing it fails**: **(1) per‑body** — mutating `tidalHeating` after the bake must produce a disagreement on every body (0 moves 28/29, 1e4 moves 28/29, *not the same 28*, union 29/29), so no body's zero is unfalsifiable; **(2) per‑field** — a sentinel written over each of the four bakes must be named, and named alone, 116/116, stated relative to that body's own baseline answer because the naive "must equal exactly one field" form turns the control into a second detector of the gate's own defect and reds the instrument instead of the finding (measured: 112/116 under the mutant below); **(3) the mechanism** — radius ×0.3/×3 with mass ×0.05/×10 must not move any bake, 0/58 today, so the day a bake law starts reading a rescaled field that assertion reds first and says which axis. **Mutants executed and restored:** growing the rescale by a post‑bake `tidalHeating` override ⇒ the gate reds naming `lavaGlowColor,lavaCrustColor` on 28/29; giving `meltTemperatureOf` a `radiusEarth` term ⇒ control 3 reds on 13/58 naming the axis; making the comparator return every key whenever any moved ⇒ control 2 reds 116/116 while control 1 stays green. Ledger row **C4** rides along in the same file (§11.6 — carrying is a floor on *when*): the header read "WHY FOUR CHANNELS AND NOT ONE" over three channels.

**A decision recorded here, not deferred.** `deriveConditionVector(fp, null, fp.radiusEarth)` at `:138` makes the third argument byte‑identical to `_R_c`, so `gravityRadiusRatio` returns exactly 1.0 on every game body and the gravity self‑compression law (`GRAV_R_EXP_SUB/SUPER`) never fires. **This is correct, not broken.** The lab has two radii because its GUI has a radius *slider* separate from the preset; the game has one radius per body. The law expresses "what if this body were a size other than its canonical one," which is not a question the game asks. **Ruling: do not invent a second game radius.** (The *display*-keying question is a different axis and is handled in Step 5 — do not conflate them.)

**If moved later.** Step 9's fixtures get captured against a fabricated value and have to be recaptured.

---

### Step 3 — Close the fail‑open hole in the source‑text tests · **S** · deps: Step 0

**What.** `tests/radius-live-feed.test.js` regex‑**extracts** blocks of `applyDrivers` out of `planet-lod-lab.html` (`:103` `SRC_CLOUDBLOCK`, `:104` `SRC_GIANTDYNAMO`, `:108` `SRC_AURORA`) and `new Function`‑compiles them; `tests/radius-live-feed-fence.test.js:31` DENY‑scans that single file. Re‑point both at a **file list**, assert every extraction matched a **non‑empty** string, and widen the fence's scan set to `src/worldengine/**` plus the lab HTML.

**Why before anything deletes lab code.** The failure mode is worse than red tests. The fence's `DENY_SRC` at `radius-live-feed-fence.test.js:52` matches `_fp…radiusEarth` patterns **in one file**; move a law out and the scan passes **vacuously** over an emptied region while the extracted module sits unguarded. That is this codebase's characteristic failure, pre‑armed and waiting.

**Files.** `tests/radius-live-feed.test.js`, `tests/radius-live-feed-fence.test.js`.

**Gate.** Temporarily delete one extracted block → **both files must FAIL**. Restore → both green. Plant a deliberate violation in a `src/worldengine/**` file → the fence must catch it there too.

**If moved later.** Steps 4 and 5 both delete lab code. Landing this after either one means the guard is already silently gone, with a green suite.

---

### Step 4 — Condition‑derived giant regime + the no‑surface guard · **M** · deps: Steps 1, 3

**What.**
1. `giantRegimeOf(condition)` as a sibling of the already‑condition‑pure `compositionClass` in `src/worldengine/base/e1Regime.js`: a nearest‑anchor classifier against the five `GIANT_ANCHOR` rows (`giant-drivers.js:107-113`), which (density, T_eq) separates exactly — gas‑giant (1.33, 125), saturnian (0.69, 95), neptunian (1.64, 55), sub‑neptune (2.2, 550), hot‑jupiter (1.3, 1400).
2. ⚠️ **Compute bulk density as `5.513 · M/R³`. Never read `condition.density`.** Measured: 58 of 134 generated giants (43%) have `condition.density` disagreeing with true bulk by >1.5×, worst case bulk 0.37 g/cc reported as 4.39. A classifier keyed on the reported value misclassifies nearly half the population.
3. ⚠️ **Order matters:** `drawGiantConditions` overwrites `density` with `baseDensity * densFactor` at `giant-drivers.js:239-241` before `deriveGiantDrivers` reads it. `giantRegimeOf` must run on the **un‑perturbed** condition.
4. **No‑surface domain guard** in `conditionFromPlanet`: when `compositionClass(cv) === 'gas'` (`e1Regime.js:66`, already condition‑pure), `pressure` is an envelope depth, not a surface pressure — `T_eq` passes through the greenhouse fit untouched. Do **not** widen the fit.
5. Delete `E5_PRESET_REGIME` from `planet-lod-lab.html:1711-1715` and have the lab call `giantRegimeOf`. **In the same commit**, re‑source `applyStormState` (`planet-lod-lab.html:1847`), which also reads that table.

**Why.** `giant-drivers.js:168` is `const regime = condition.regime || E5_REGIME.GAS_GIANT`, and the lab derives that regime from a **preset‑name lookup** — the exact label‑keying the adapter forbids (symbol-only per §10 — conditionFromPlanet.js `⚠ THIS ADAPTER READS`). Importing the lab's table would make the game depend on lab GUI data, which is the coupling this whole plan removes. Deriving it also *gains* the game two regimes (saturnian, neptunian) that no game `type` expresses.

**⚠️ This step moves pixels that already ship, and no gate in the obvious set would see it.** The no‑surface guard changes `condition.T_eq`, which feeds `atmosphereOpticsOf` (`atmosphereOptics.js:132`, and the haze law at `:78` with `HAZE_T_COLD=120`), whose output is written into the live material at `Planet.js:1584-1594` as `uLimbExponent`, `uLimbColor`, `uTermColor`, `uTermStrength`, `uTermWidth` — and `LIMB_MIX` is 1.0 (`Planet.js:1401`), so the limb is fully on today. Measured over 225 gas‑class bodies: the greenhouse factor currently applied is median 2.687×, max 6.207×; removing it changes `limbExponent` on 222/225 with max delta 1.6997 (the law's entire range is 1.8–3.5) and `limbColor` on 225/225 with max channel delta 0.4797. **Sol's Uranus and Neptune are in that population** (`SolarSystemData.js:497-498, :583-584`, pressure 1000 bar).

**Files.** `src/worldengine/base/e1Regime.js`, `src/worldengine/base/giant-drivers.js`, `src/worldengine/port/conditionFromPlanet.js`, `planet-lod-lab.html`, `tests/giant-regime-classifier.test.js`, `tools/port-condition-delta.mjs`.

**Gate.**
- **Anchor round‑trip, exact:** `giantRegimeOf(canonicalGiantCondition(r)) === r` for all five `E5_REGIME` members. The existing table is its own oracle.
- **Ordering assertion:** the classifier is called on the pre‑draw condition (assert directly, not just via the round‑trip).
- **Instrument C is mandatory here and it will be non‑zero.** Publish a committed delta table for `limbExponent`, `limbColor`, `termColor`, `termStrength`, `termWidth` over ≥300 bodies, with one named re‑bless per affected test. This is a declared pixel‑moving step.
- `grep` asserts `E5_PRESET_REGIME` is absent from `planet-lod-lab.html`, and the lab's `giantRegimeOf` import is present.
- Instruments A and B green.

**If moved earlier.** Before Step 3, deleting `E5_PRESET_REGIME` empties a region the DENY scan covers. Before Step 1, `giantRegimeOf` has no `radiusEarthCanonical` and the classifier's population filter is undefined.

---

### Step 5 — Driver pack #1: the gas deck · **L** · deps: Step 4

**What.** The first pack, and the step that fixes the pack **contract** so it can express the one thing that legitimately differs between the two front‑ends.

**5a. The contract.**
```
pack(condition, ctx) → { drivers, attributes }
ctx = { macroSeed, displayRadiusEarth, animRate, gates, relevance }
writePackUniforms(uniforms, drivers, ctx) → void
```
Packs emit **sizeKm‑shaped drivers**. A single shared writer applies `featureFrequencyFromKm`. **The front‑end supplies its display policy.**

**Why the contract must carry `displayRadiusEarth`.** 18 uniforms in the lab resolve as `featureFrequencyFromKm(_dispR, state.<x>SizeKm, C_X)` where `_dispR = sVis = visScaleOf(R) = R^0.5` (`planet-lod-lab.html:4895`, `:4840`) — a *display* pseudo‑radius the lab uses **because it scales the mesh** (`:4849 planet.scale.setScalar(sVis)`). The helper's own signature documents its first argument as the real `radiusEarth` (`planet-lod-lab-core.js:1063`). The game does not scale meshes that way — geometry is built at `this.data.radius` (`Planet.js:1549`) — and `grep -rn "featureFrequencyFromKm\|visScaleOf" src/` returns **zero hits**. [VERIFIED.] So for the same body the correct first argument differs: R vs R^0.5, i.e. 4× vs 2× on a 4 R⊕ world. A pack contract without a display‑policy parameter, gated on "byte‑identical to the lab," would **certify the lab's value as the game's** and render every future km‑keyed feature at the wrong spatial frequency on every body except exactly 1.0 R⊕ — a finite, plausible, in‑band number no test can see.

**There is already a worked precedent for the policy difference:** `src/worldengine/port/craterUniforms.js:146-151` carries an explicit *"⛔ NOT the lab's value"* on `craterComplexD`. The game already refuses one lab‑resolved value on purpose. The contract is making that refusal expressible instead of hand‑written.

**5b. Extract the frequency helper, at function granularity.** Move `featureFrequencyFromKm` (and `visScaleOf`) from `planet-lod-lab-core.js` into `src/worldengine/base/featureScale.js`; `labCore` imports them **back**. This is the `heightNoise.glsl.js` pattern at ~20 lines, and it means the shared writer under `src/` does not create a new repo‑root escape that Step 7's fence then has to clear.

**5c. The pack.** `src/worldengine/drivers/giantDeck.js`, composing modules already pure and three‑free under `src/worldengine/base/`: `giantRegimeOf → drawGiantConditions → deriveGiantDrivers → bakeClimateE5Attributes`. Emits `aBand/aShear/aMush` plus the band/jet/polar uniforms. Then **delete** the corresponding block from `applyDrivers`/`rebakeE5Bands` and have the lab call the pack.

⚠️ **`uStormCount`, `uStormPosSize/Params/Color/Aux` are OUT of pack #1.** Their producer is a *fourth* driver function — `applyStormState` (`planet-lod-lab.html:1811`) fills `state.trainSpots` at `:1900` and `frame()` assembles the slots at `:5150-5169`. Do not name a uniform whose producer is out of scope. `aStorm` stays zero‑filled.

⚠️ **`uJetSpeed` is `state.jetSpeed * _animRate` (`:5126`) and `uPolarStrength` folds in `state.featureRelevant.polarVortex` (`:5174`).** Both are writer‑side context. Name the game's `animRate` and relevance source explicitly *now*, not at the byte‑identity gate.

**5d. `macroSeed` — pin the shape.** Use the **numeric** `fnv1aString(\`${systemSeed}:${ordinal}\`)` (`src/util/scene-naming.js:71`), **not** `toHex(...)` (`:73`). `resolveParams` does `macroSeed | 0`, and `'da81e221' | 0 === 0` — a hex string silently collapses to seed 0 and *every* gas giant in the game gets identical band phases while every distinctness gate on driver algebra still passes (`uBandContrast` has no seeded term; `climate-e5.js:146-149` shows `phaseJet`, `phaseMush`, `ampJitter`, `obliquity` are the only seeded ones). Assert `Number.isInteger(macroSeed) && macroSeed !== 0` inside the pack. Note `_ordinal` has three shapes — number for planets (`StarSystemGenerator.js:567`), string for moons (`:597`, `'0.0'`), re‑stamped `pm-${…}` at `main.js:6191` — pin all three in a test.

**5e. Forward `metallicity` and recalibrate `canonicalZ0` in this same commit** (the deferral from Step 1), with the giant‑driver triple delta table as its gate.

**5f. The shrink‑only ratchet.** Pin the **set** of `state.*` fields `applyDrivers` writes and the **set** of uniforms `frame()` touches into a committed fixture; the test fails if either set **grows**. Removal always allowed; addition requires deleting a fixture entry in the same commit that adds the pack. Measurements differ by one between passes (146/147 state fields, 327/328 uniforms) — **pin what the harness measures, never a number copied from a document.**

**Why the ratchet is not optional.** Nothing else in this plan prevents a *new* lab feature from being authored inside `applyDrivers` + `frame()` the old way. Every authoring affordance in the lab — the 414‑key `state` literal (`:891-1360`), ~200 `.listen()`‑bound lil‑gui controllers, `_driverTouched` (`:1627`) — pulls a new feature toward the un‑packed path. Without the ratchet, "migrating a lab feature costs one pack module" is true only for features someone *chooses* to author as packs, and the plan installs nothing that makes that the default. **Pair it with a documented pack‑authoring path** (how a pack's outputs reach `state` so the `.listen()` controllers keep working) — a ratchet that blocks the wrong path without offering the right one just gets deleted.

**Files.** `src/worldengine/drivers/giantDeck.js`, `src/worldengine/port/writePackUniforms.js`, `src/worldengine/base/featureScale.js`, `src/worldengine/base/giant-drivers.js`, `planet-lod-lab.html`, `planet-lod-lab-core.js`, `tests/driver-pack-giantdeck.test.js`, `tests/lab-surface-ratchet.test.js`, `tests/fixtures/giantdeck-preset-baseline.mjs`.

**Gate.**
- **Refactor byte‑identity, under the LAB's display policy:** for each of the 5 gas presets, pack+writer output equals a fixture captured from the lab *before* the change, max delta exactly **0**. ⚠️ **Measure on the same CONDITION object, not the same preset name** — the two routes differ by 3–6× on T_eq for the same nominal body, and a preset‑to‑preset comparison produces a false red that looks exactly like a broken extraction.
- **Policy‑difference assertion:** the same pack under the GAME's display policy differs on exactly the km‑keyed uniforms and **nowhere else**.
- **Distinctness over 200 generated systems:** `internalHeat` and `dissipation` each yield ≥8 distinct values. ⛔ **Do NOT gate `shellDepthFrac ≥ 8`** — FORM 2 saturates against its per‑regime `sdfBand` clamp (`giant-drivers.js:192-193`), so the ceiling is **5** (measured best case: 0.09, 0.28, 0.74, 0.80, 0.85, four of them clamp bounds). Gate it instead as: **≥3 of 5 regimes represented AND ≥1 body strictly interior to its `sdfBand`.** A gate that gets relaxed the first time it fires destroys the gate class this design was chosen for.
- **Seeded‑field distinctness:** hash each body's `aBand` array; require ≥N distinct hashes across the population. This is the only assertion that catches a constant `macroSeed`.
- **Lab‑copy‑deleted:** deny scan clean **and** the lab's `import { giantDeckPack }` asserted present. (An orphaned module passes a byte fence — `atmosphereOptics.js` already proved that.)
- Instruments A, B, C green.

**If moved earlier.** Before Step 4 the pack has no regime and all 144 bodies derive one value. Before Step 3 the deletion empties a scanned region.

---

### Step 6 — Runtime pack composition + gas bodies render through the lab material · **L** — **SHIPS GAS GIANTS** · deps: Step 5

**What.**

**6a. Build the composition point now, while it is nearly free.**
```
applyDriverPacks(material, condition, ctx)   // iterates a PACKS array
```
Each pack declares its own **applicability predicate derived from the condition** — never a `type` label. Steps 9 and 10 then add one array entry instead of one branch per body class. Without this, game‑side cost is proportional to the number of body‑class branches and *grows* as classes are admitted: a pack for rocky planets + plain moons + planet‑class moons means editing `Planet._createSurface`, `BodyRenderer.createMoon` and whichever branch rocky planets sit on — three sites, one of which is easy to miss (planet‑class moons reach `Planet.js` by a different route), producing a feature that renders on some bodies and not others with nothing complaining.

**6b. Produce the parity list BEFORE swapping.** Mechanically diff the game material's uniform names against the lab material's 351 and enumerate every game‑side uniform with **no lab counterpart**. Known, verified entries — each one a feature that disappears silently, because every writer that would notice it is a *guarded* no‑op:

| Lost | Where the game writes it | Population affected (measured, 200 systems) |
|---|---|---|
| Moon transit + planet shadows | `main.js:9836, :9847` (guarded on `pu.shadowMoonCount` / `shadowPlanetCount`) | 177 of 223 gas bodies have moons (448 moons) |
| Second‑star lighting (`lightDir2`, `starColor2`, `shadow2`) | `Planet.js:66-69, 818-825`; lab has one `uLightDir` (`planet-lod-uniforms.js:137`) | 79 of 223 gas bodies sit in one of 72 binary systems |
| Primary star **colour** | `starColor1 * starBrightness1`; lab has no star‑colour uniform | **all** giants — every one renders under implicit white light regardless of spectral class |
| LOD1 procedural colour match | `BodyRenderer.js:268-283` (guarded on `u.baseColor`) | Sol's Jupiter/Saturn while textures load |
| `lodLevel` | `BodyRenderer.js:172-181` (guarded on `u.lodLevel`) | near‑harmless — the uniform is read by no shader |

`grep -rl "shadowMoonCount|lightDir2|starColor2" tests/` returns **zero files**. For each entry: **port the feature into the lab shader** (standing constraint 1 — the game bends — so this is the default) or record it as an accepted loss and put it in front of Max *on this step*. Land a test that fails when the parity list changes.

**6c. Register the lab program with `ShaderWarmup`.** `src/rendering/ShaderWarmup.js:132` is `if (!PLANET_SHADER_VARIANTS[key]) continue;` — the 363,566‑byte lab fragment shader is **never pre‑warmed**, and the plan of record measured it at **29.8 s cold / 46.6 ms warm** (`lab-pipeline-into-game-PLAN.md:403`). On warp arrival, when `compileAsync` exceeds the HYPER safety ceiling, `main.js:5459-5464` force‑restores the gated roots and the link is paid **synchronously on first draw** — a multi‑second freeze at the exact moment the player arrives.

**6d. Exclude Sol in CODE, not in prose.** The branch condition must not be `d.type === 'gas-giant'`: Sol's Jupiter (`SolarSystemData.js:271`) and Saturn (`:344`) are literally that type, so Sol would take the new path while every measurement rule excludes Sol from observation. Branch on world‑engine provenance (absence of `profileId`) so the standing "never Sol" rule stays honest.

**6e. Keep the `GAS_BODY` branch behind an off‑by‑default flag** until Max's UAT. Deletion is Step 12, a named commit in this arc — not a permanent fallback, and not deleted before he has seen the consequence.

**Files.** `src/objects/Planet.js`, `src/rendering/LabPlanetMaterial.js`, `src/rendering/ShaderWarmup.js`, `src/rendering/objects/BodyRenderer.js`, `src/main.js`, `src/worldengine/drivers/index.js`, `tests/gas-body-lab-material.test.js`, `tests/material-parity-list.test.js`.

**Gate.**
- **Instrument D (build it here):** spawn a generated system, install `window.onerror` + an `unhandledrejection` listener, run **≥120 frames**, fail on **any** uncaught exception, and assert the rAF handle advanced. A JS `TypeError` is not a WebGL error, and a lit‑pixel check can pass on the last frame that rendered before a throw.
- **Real warp arrival** into a system with ≥1 gas giant (not `_lab.spawnProceduralSystem`, which per commit `a52b2ce` calls `spawnSystem` directly and never touches the warp path): assert `warpMetrics.compileMs` against a recorded budget, run **once with `window.__shaderCacheBust`** so the cold number is real.
- Every gas body reports `isLabPlanetMaterial` true, `uBandStrength` 1.0, non‑zero `aBand` variance; lit‑pixel floor passes against a clean negative control; zero WebGL errors.
- Parity‑list test green.
- Instrument C on the still‑legacy bodies: zero delta.
- **Screenshot taken FOR Max on a procedural system.** The visual verdict is his.

**If moved earlier.** Before Step 5 there is no pack. Before Step 4 every giant is Jovian.

---

### Step 7 — Move the shared modules under `src/` and switch on the boundary fence · **L** · deps: Step 6

**What.** Move, rewriting import specifiers only:

| From (repo root) | To |
|---|---|
| `body-condition-vector.js` | `src/worldengine/base/conditionVector.js` |
| `planet-lod-lab-core.js` | `src/worldengine/base/labCore.js` (**WHOLE** — 1194 lines, 45 exports; splitting is a judgement call that must not ride in a mechanical commit) |
| `planet-lod-uniforms.js` | `src/worldengine/shaders/uniforms.js` |
| `planet-lod-shaders.glsl.js` | `src/worldengine/shaders/planetShaders.glsl.js` |
| `planet-lod-height.glsl.js` | `src/worldengine/shaders/height.glsl.js` |

Then land `tests/src-boundary-fence.test.js` (fs walker, regex over relative/absolute specifiers, no new dependencies — matches the existing `tests/*-fence.test.js` idiom; `madge` is a devDependency but unused by any script).

**Why these five and not two.** Moving only `conditionVector` + `labCore` clears **7** of the 9 verified escapes and leaves three — `LabPlanetMaterial.js:2` (`planet-lod-shaders.glsl.js`), `:3` (`planet-lod-uniforms.js`), and `fieldSampler.js:149` (`planet-lod-rivers.js`). The first two are the **uniform declaration table and the GLSL** — precisely the files every future lab feature must edit. A fence whose allowlist permanently contains the shader-and-uniform contract is a boundary drawn around everything except the migration‑relevant surface.

**⛔ Do not write the gate as "zero allowlist entries."** After these five moves, fieldSampler.js:149 `createHeightSampler` (→ planet-lod-rivers.js) survives (rivers imports `three` and `ConvexHull`, so it belongs under `src/rendering/bake/`, which is a separate decision — see §7). State the allowlist honestly: **exactly one root‑file entry, carrying the named step that removes it**, plus the four `src/cockpit/__tests__ → tests/helpers/glb-parse.mjs` test‑helper entries. Do not let the gate be satisfied by a silent allowlist.

**Ruling on `docs/WORKSTREAMS/**`.** 36 calibration/evidence `.mjs` (112 import lines) reference these paths. **Rewrite the paths.** The recorded provenance of a shipped contract is the *results* in the `.md` files; the `.mjs` are re‑runnable tooling and an import specifier is not evidence. No `_compat/` shim dir — a permanent shim is a second name for a module, which is what this plan removes.

Also update the stale convention headers: `cockpit-screens-lab-flight.js:1-9` and `-panels.js:1-9` both cite `planet-lod-lab-core.js` as the exemplar of "lab logic does not belong in the game's source tree," and it is now game source imported by four files. A stale declaration in a file header is how the next agent re‑derives the wrong boundary.

**Files.** the five moved modules and their new homes; `src/worldengine/port/conditionFromPlanet.js`, `src/worldengine/instrument/laws.js`, `src/worldengine/base/reliefBudget.js`, `src/rendering/LabPlanetMaterial.js`, `src/rendering/objects/BodyRenderer.js`, `planet-lod-lab.html`, ~115 test files, `scripts/gen-feature-cards.mjs`, `scripts/gen-render-audit.mjs`, 36 `docs/WORKSTREAMS/**/*.mjs`, `tests/src-boundary-fence.test.js`.

**Gate.**
- `git show HEAD:<old> | diff - <new>` shows changed lines **only** in import specifiers, for each moved file.
- Fence green with the allowlist stated above and no others.
- **Instrument A** — this is the step where a 99%‑right `sed` leaves a suite that stops collecting, which vitest reports as a *failed file with zero failed tests*. A failure count cannot see it; a per‑test‑ID set can.
- `npm run build` succeeds (`vite.config.js:37` has one alias, `motion-test-kit`; nothing resolves root `.js` by alias, so a path rewrite must suffice).
- A node script parses every import specifier in `planet-lod-lab.html` and `stat()`s each target: zero missing.
- Byte‑identity of the lab's resolved uniform bundle for all 17 `DRIVER_PRESETS`, max delta 0.

**If moved earlier.** Nothing structurally breaks, but this rewrites 115 test files and 37 lab import lines with zero visible output. Interleaving that churn with the first production swap (Step 6) doubles the blast radius of any red, and Step 5's `featureScale.js` extraction already removed the one dependency that would have forced it earlier.

---

### Step 8 — Moons get a real condition record, derived and never drawn · **L** · deps: Steps 2, 7

**What.** Two commits.

**8a (the widening).** `MoonGenerator`'s **plain** path (`:165-204`) emits `massEarth` (radius³ × a parent‑derived density), `age` (the system's), `T_eq` (from the **parent's real orbit radius**), `composition`, `surfaceHistory` and `tidalState`. Every value derived **purely** from what `MoonGenerator.generate` already holds in scope — it takes the full parent `planetData` (`:93`) and `tidalHeating` is already computed at `:161`. Rename `conditionFromPlanet → conditionFromBody` (a rename, not a redesign: `type` appears in that file only in comments at `:9,:10,:11,:83`).

**⚠️ Append, never splice.** New derivations are computed from in‑scope values and appended *after* the return literal is built. The plain path has **fifteen** draws, and **seven of them come after `startAngle`** (`:157`): `noiseScale` (`:185`), cloud density/scale (`:189-190`), atmosphere strength (`:195`), aurora intensity/ringLatitude/ringWidth (`:200-202`). Splicing a `deriveComposition(…, rngFloat)` call anywhere after `:157` re‑rolls `noiseScale` on **every plain moon in the universe** — every moon's surface detail frequency changes — while a four‑field stream gate passes byte‑identical. Where physics genuinely needs variance, use the dedicated‑namespace pattern already shipping in this file at `:257-263` (documented `:244-251`).

**⚠️ The named RNG hazard for moon work is `MoonGenerator.js:155`, not `PlanetGenerator.js:526`.** Measured over 323 generated planets, `atmoPhysics.retained` is **true 323/323**, so `:526`'s `&&` short‑circuits **zero times today** — it is dormant‑but‑armed, not live. The live conditional draw is inside the very function this step edits: `const retrograde = type === 'captured' && rng.chance(0.4)` — evaluated on 24.4% of plain moons (64 of 262 are 'captured'), short‑circuited on 75.6%. Touching `_pickType`, the type table, or the zone mapping flips presence for affected bodies and shifts `startAngle` plus all seven tail draws.

**8b (separate commit): fix the hardcoded 1 AU.** `MoonGenerator.js:278` generates every planet‑class moon at `PlanetGenerator.generate(rng, 1.0, …)`, so a 40 AU icy moon carries an inner‑system temperature and composition. Measured: T_eq 254.588 at 1.0 AU vs 43.033 at 30 AU (5.9×). This affects the ~3.5% of moons that **already reach `Planet.js` today**, and it feeds `icenessOf`, `surfacePaletteOf`, `meltTemperatureOf` and `craterSchedule` — all baked by the assignment block at the bottom of `PlanetGenerator.generate` (symbol-only per §10 — PlanetGenerator.js `planetData.landPalette = applyAlbedoTransfer(`). **Correction to the recon, in the plan's favour:** it is draw‑stream **neutral** — over 400 forced‑type seeds, 0/400 altered the post‑generate draw stream and 0/400 altered `radiusEarth`, because `retained` never flips. So this is a **value** change, not a universe change.

**Files.** `src/generation/MoonGenerator.js`, `src/worldengine/port/conditionFromBody.js`, `tests/moon-condition-contract.test.js`, `tests/moon-rng-stream-identity.test.js`, `tests/baseline/body-identity.json`.

**Gate.**
- **8a: Instrument B must hash the ENTIRE returned moon record** — all keys, sorted, full precision — not four named fields. Same cost, covers all fifteen draws. Must be **byte‑identical**. If it goes red, a draw leaked into the shared stream and the commit is wrong.
- **Per‑type draw‑count assertion:** for each moon type, the number of values consumed from the passed‑in `rng` is pinned to a committed number.
- `_provenance` reports zero `'defaulted'` entries for `massEarth`/`age`/`T_eq`/`surfaceHistory` on ≥500 sampled moons.
- `surfaceGravity` over the whole moon population lies in [0, 3] g. Today the same bodies fabricate **10.4 / 14.1 / 56.3 g**, and an 11 km Phobos‑class body derives **346,021 g**.
- Regression fixture: Sol's Moon derives **0.165 ± 0.01 g**, not today's 13.42 g.
- Zero moons produce a truthy atmosphere with undefined pressure.
- **8b: a committed delta table**, not byte‑identity, over the planet‑class moon population for `T_eq`, composition, `iceness`, `landPalette`, `lavaGlowColor`, `lavaCrustColor`; Instrument B's only allowed diff is planet‑class moons, enumerated in the commit message.

**A note filed, not fixed:** `CRATER_VIS_FLOOR_RAD` (`craterUniforms.js:68-71`) was calibrated "on Sol's 39 bodies" — a population whose gravity was fabricated as 1/R². Re‑deriving it once mass is real is a follow‑on with its own delta table.

**If moved earlier.** Before Step 2 the moons inherit a fabricated tidal ratio, which for moons is the *load‑bearing* input (tidal heating is the Io story — it is what makes one moon of a giant differ from the next).

---

### Step 9 — Driver pack #2: rocky surface, and the last type label in the crater gate · **M** · deps: Steps 5, 8

**What.** `src/worldengine/drivers/rockySurface.js` — `craterSchedule` + `craterRelevanceOf` + `surfacePaletteOf ∘ applyAlbedoTransfer` + `icenessOf` + `reliefEnvelope → uPerturb`, as one pack on the Step‑5 contract. In the same commit, replace `Planet.js:1570`'s `ROCKY_TYPES.has(d.type)` with `craterRelevanceOf(condition)` — that function already ships, is tested, is what the lab uses (`planet-lod-lab.html:2808`), and has **zero** `src/` callers.

**Why it must be pack #2.** The migration lens's core objection is that the registry would be generalised from two packs that never exercise the contract's hardest question. `giantDeck` has **no** km‑keyed frequency. `rockySurface` does — crater sizing is radius‑keyed, and `craterUniforms.js:146-151` already carries an explicit *"⛔ NOT the lab's value"*. This pack is where the policy‑difference assertion earns its keep, and it must land **before** Step 11 freezes the registry shape.

⛔ **Do not port the lab's `craterComplexD` 1.8333 pin.** The game deliberately refuses it; porting it flattens every complex crater to a bowl.

**The extraction boundary is the derivation STAGE, both functions.** `ensureNetworkRouted` (`:2745`) **overwrites five of `applyDrivers`' own writes** — `craterDensity` (`:2828`), `craterComplexD` (`:2845`), `craterRelaxation` (`:2853`), `craterSizeKm`, `seaLevel` (`:2964`). Extract only `applyDrivers` and the lab keeps two writers while the game imports the loser.

**Files.** `src/worldengine/drivers/rockySurface.js`, `src/objects/Planet.js`, `src/generation/PlanetGenerator.js`, `src/worldengine/port/craterUniforms.js`, `planet-lod-lab.html`, `tests/driver-pack-rockysurface.test.js`.

**Gate.**
- Refactor byte‑identity under the lab's display policy for the 12 rocky/icy presets, max delta **0**, measured on the same condition object.
- **Policy‑difference assertion** on the km‑keyed uniforms — and this is the gate that must be reviewed by hand once, because it is the contract's first real test.
- **No regression:** over 200 systems the crater uniforms of every currently‑craterable body are unchanged, max delta 0. ⚠️ **Say up front that this gate inspects 13 of 844 bodies.** Measured: `craterRelevanceOf > 0` on 504 of 844 planets including 82 non‑rocky, but `craterUniformsFrom`'s own density gate dominates and only **13** end with non‑zero density — 13 before the swap, 13 after. Green here is not coverage.
- **Supplement it with a Sol‑population measurement** — `craterUniformsFrom` over Sol's 39 bodies, which is where craters are actually a live feature (37/39 vs 0/504 generated). This is a legitimate use of Sol: it measures a **pure function's output**, not a rendered pixel. Do not let it become a rendering claim.
- Lab‑copy‑deleted + lab import asserted; `ROCKY_TYPES` absent from the crater path.
- Instruments A, B, C green.

**If moved earlier.** Before Step 8 there are no moon conditions for it to serve; before Step 5 there is no contract for it to conform to.

---

### Step 10 — Moons render through the pipeline · **M** — **SHIPS MOONS** · deps: Steps 6, 9

**What.** Add `rockySurface` to the runtime `PACKS` array with a condition‑derived predicate, and give the automatic path a moon branch: `BodyRenderer.createMoon` builds the lab material instead of `Moon.js`'s generic‑simplex shader (`:217-254`), keeping the LOD registration at `main.js:6212`. Widen the vestigial `owner.startsWith('body.planet.')` filter at `main.js:2422` (note: it never excluded *all* moons — planet‑class moons are named `body.planet.*`; it excludes **plain** moons). Keep `Moon.js` behind the same off‑by‑default flag as `GAS_BODY`.

**🚨 In the same commit, guard two unguarded uniform writes inside the frame loop.**

`src/main.js:9887-9891`:
```js
const mMat = moon.mesh.material;
mMat.uniforms.shadowPlanetPos.value.copy(entry.planet.mesh.position);
```
[VERIFIED by reading the file.] The lab material declares none of `shadowPlanetPos` / `shadowPlanetRadius` / `starPos1` / `starPos2`, and `BodyRenderer.js:87` sets `mesh = delegate.mesh`, so `moon.mesh.material` is exactly what this step replaces. On the first sim tick after a plain moon is built, this evaluates `undefined.value` and throws — and the three.js loop binding has no `try/catch`, so **the throw escapes before `raf()` is rescheduled and the render loop stops permanently on a frozen frame while the caller has already reported success.** This is not hypothetical: `main.js:9871-9878` is an in‑source comment recording that this exact bug already fired on the sibling planet‑class‑moon branch, which is why the branch immediately above it is guarded and this one is not. Second site: `src/objects/Moon.js:614-616` (`this.mesh.material.uniforms.time.value += renderDt`), affecting the measured 7 of 683 moons that carry clouds.

Use the `if (pmu?.shadowPlanetCount)` shape the sibling branch already uses. Produce a moon parity list on the Step‑6 pattern.

**Files.** `src/main.js`, `src/objects/Moon.js`, `src/rendering/objects/BodyRenderer.js`, `src/worldengine/drivers/index.js`, `tests/moon-render-path.test.js`.

**Gate.**
- **Instrument D is the primary gate**, not the screenshot: ≥120 frames on a generated system with plain moons, zero uncaught exceptions, rAF advanced.
- ≥95% of plain moons resolve a non‑zero `uCraterDensity` with ≥20 distinct values (today: 0 of ~571).
- **Per‑class distinctness:** the resolved uniform sets for {rocky planet, gas giant, plain moon, planet‑class moon} must **differ from each other**. A shared pipeline that renders every class identically is the degenerate failure this step must not ship.
- **Perf budget, recorded in the test:** measured frame time on the moon‑heaviest system in a 200‑system sample. The rocky pack runs per moon and a system can carry 20+. If it blows the budget the fix is a bake cache keyed on `(regime, drivers, macroSeed)`, not a retreat from the pipeline.
- Moon parity‑list test green; Instruments A, B, C green.
- Screenshot taken **for** Max on a procedural system.

**If moved earlier.** Before Step 9 there is no pack for a rocky body. Before Step 6 there is no runtime `PACKS` array and this becomes a per‑class branch.

---

### Step 11 — The standing "cheaper next time" fence · **M** · deps: Steps 5, 9, 10

**What.** One test file with **five registrations**, generalised from two shipped packs and two shipped swaps rather than authored from a diagram:

1. **Boundary** — no file under `src/` imports a loose repo‑root `.js`. Allowlist entries must each carry the named step that removes them.
2. **Import‑back, generalised beyond `drivers/`** — **every pipeline module the game imports is also imported by `planet-lod-lab.html`.** Scoping this to packs only would never have seen `atmosphereOptics.js`, which is not a pack and is the failure that has already occurred.
3. **No surviving lab copy** — deny scan over `planet-lod-lab.html` *and* `src/worldengine/**`, proven non‑vacuous by asserting it still matches a known‑present string.
4. **Runtime registration** — every module under `src/worldengine/drivers/` appears in the runtime `PACKS` array. (Registration 2 catches an orphan module; this catches a module that is imported but never applied.)
5. **No `SeededRandom` under `src/worldengine/`** — no module may import, accept or reference it. A one‑line grep, and the only mechanical guard against the whole hazard class. Relevant because `conditionFromBody` runs *inside* the rng‑consuming region of `PlanetGenerator.generate` (called at `:726`, while `noiseDetail: rng.range(0.3, 0.8)` is drawn at `:780`).

Plus the Step‑5 shrink‑only ratchet, folded in as a sixth registration.

**Files.** `tests/one-pipeline-fence.test.js`, `tests/fixtures/broken-control-pack/`, `docs/FEATURES/one-pipeline-two-frontends-PLAN.md`.

**Gate.** A deliberately‑broken control fixture is committed for **each** registration — a pack with no lab import, a pack absent from `PACKS`, a root‑level copy of a law, a `src/worldengine` file referencing `SeededRandom` — and the fence must fail **by name**, with the offending path in the message, on each. Then each fixture is asserted as an expected failure. **A pass with no failing control is worthless.**

---

### Step 12 — Delete the fallbacks · **S** · deps: Max's UAT on Steps 6 and 10

**What.** Delete the game's parallel implementations for the swapped classes — `GAS_BODY` (`Planet.js:380-570`) and `Moon.js`'s shader — plus the flags that kept them. Grep‑assert they are **gone, not commented out**.

**Why it is a named step and not a footnote.** The `craterRelief.glsl.js` precedent kept both, and that copy is now a law that quietly disagrees. A flag left as the resting position is the same outcome with a different name. But deleting inside the swap commit removes the escape hatch before Max has seen the consequence, and Steps 6 and 10 each drop shipped features (§6b). So: fallback through UAT, deletion named and scheduled in the same arc.

**Gate.** Max's UAT verdict on both swaps; then Instruments A/C green and the parity list resolved to zero unaccepted losses.

---

## 5. What a future migration costs after this lands

**The scenario, six weeks out.** Max asks for *polar dune fields* in the lab: a new `polarDuneSizeKm` control, a frequency uniform, a driver derived from wind and volatile fraction. It looks right in the lab. Now put it in the game.

### Today — 7 edit sites, 4 of them judgement calls

| # | Site | Cost |
|---|---|---|
| 1 | Find the derivation inside `applyDrivers` — 802 lines, 574 of them comment, in a 6,411‑line HTML file | read |
| 2 | Find its **other half** among 328 uniform writes in `frame()` (`:4827-5519`), applying 49 `state.*Enabled` gates, `featureRelevant`, and the `sVis` scale on the way | read |
| 3 | Check whether `ensureNetworkRouted` overwrites it | read |
| 4 | Resolve the `_dispR = sVis` question by hand — **and get it wrong silently** if you don't know it exists | **judgement** |
| 5 | Hand‑transcribe both halves into `Planet.js`'s 71‑uniform literal | transcribe |
| 6 | Discover the input isn't on the condition vector; widen the fp constructor without a contract to widen against | **judgement** |
| 7 | Ship with **no guard** that the two implementations agree | **judgement** |

Measured outcome of that process, three times: aurora with two divergent laws, `limbExponent` with three sources, crater GLSL as a transcription with three deliberate divergences. Migrations here do not merely cost effort — **they leave behind laws that quietly disagree**, and the plan of record's "resolved output byte‑identical" gate exists only because there are two things to reconcile.

### After this plan — 3 edit sites, 0 judgement calls

| # | Site | Cost |
|---|---|---|
| 1 | Write `src/worldengine/drivers/polarDunes.js` on the published contract: `pack(condition, ctx) → {drivers, attributes}`, emitting `polarDuneSizeKm` as a **driver**, never a resolved frequency | 1 module |
| 2 | Add one entry to the runtime `PACKS` array with a condition‑derived applicability predicate | 1 line |
| 3 | Delete the lab's copy; the lab imports the pack | mechanical |

The four judgement calls are gone because each has become a machine check:

- The display‑policy question is answered **by the contract** — the pack emits sizeKm, `writePackUniforms` applies `featureFrequencyFromKm`, the front‑end supplies its policy, and the policy‑difference assertion fails if the pack resolved it itself.
- The "did I widen the input" question is answered by `_provenance` — a defaulted field is named, not silently 1.0.
- The "do the two agree" question is answered by registrations 2, 3 and 4 — a pack the lab does not import back, a pack with a surviving lab copy, or a pack absent from `PACKS` **fails the build**.
- The "did I author it the old way at all" question is answered by the shrink‑only ratchet — adding a field to `state` or a uniform write to `frame()` without deleting a fixture entry **fails the build**.

### The checkable claim

> **Files a future migration must hand‑edit: 7 → 3. Judgement calls: 4 → 0. Mechanisms that fail the build if the collapse is undone: 0 → 6.**

Two honest qualifications:

1. **This is not free for every feature yet.** After Step 12, `applyDrivers` still holds roughly 38 features. Migrating one of *those* is cheaper than today — there is a template, a contract, a widened condition, and a fence — but it is not the three‑site path until it becomes a pack. The ratchet guarantees the number only goes down.
2. **The claim is measurable, so measure it.** When the first post‑plan feature migrates, record the actual edit‑site count in this document. If it is not 3, the fence has a hole and the hole is the next piece of work.

---

## 6. Risks and how each is gated

| # | Risk | Why it is real | Gate |
|---|---|---|---|
| **1** | **Shipping a degenerate feature** — correct wiring, identical output | Measured: all 144 generated gas bodies derive `internalHeat` 1.4696 and `shellDepthFrac` 0.74 — **one distinct value each** — because `condition.regime` is undefined (`giant-drivers.js:168`) and the greenhouse fit runs on a 1000‑bar envelope. A byte‑identity gate passes all 144 identical planets. | **Distinctness is a standing gate class on every wiring step** (Steps 5, 9, 10), targeted at quantities that *can* vary (`internalHeat`, `dissipation`), with regime coverage and strict clamp‑interiority for those that cannot. |
| **2** | **RNG stream: a moon widening rewrites the universe** | `SeededRandom.child()` draws from its parent (`SeededRandom.js:95`) — shifting `planetRng` by **one** draw changed all 4 moons of a test planet and flipped one from plain to planet‑class. **The live conditional draw is `MoonGenerator.js:155`** (`type === 'captured' && rng.chance(0.4)`, evaluated on 24.4% of plain moons), **not** `PlanetGenerator.js:526`, which measured `retained === true` on 323/323 planets and short‑circuits zero times today. | **Instrument B hashes the ENTIRE moon record** (Step 8) — four named fields would miss seven of fifteen draws. Plus a per‑type draw‑count assertion, and an append‑only rule for new derivations. `:526` stays flagged as dormant‑but‑armed. |
| **3** | **The live render path dies silently on the moon swap** | `main.js:9887-9891` writes `mMat.uniforms.shadowPlanetPos.value` **unguarded**; the lab material has no such uniform; the throw escapes before `raf()` reschedules and the loop stops permanently while the caller reports success. In‑source record of the same bug on the sibling branch: `main.js:9871-9878`. | **Instrument D** (≥120 frames, `window.onerror` + `unhandledrejection`, assert rAF advanced) is the primary gate on Steps 6 and 10 — a JS `TypeError` is not a WebGL error and a lit‑pixel check can pass on the last rendered frame. Guards land in the swap commit. |
| **4** | **Swapping silently drops shipped features** | Every writer that would notice is a *guarded* no‑op: moon/planet shadows (`main.js:9836,:9847`), second‑star lighting (`Planet.js:66-69,818-825`), star colour, LOD1 colour match. `grep -rl "shadowMoonCount\|lightDir2\|starColor2" tests/` → **zero files**. Measured impact: 177/223 gas bodies lose transit shadows, 79 lose their second star, all lose star colour. | **Mechanical parity list** before each swap (Steps 6b, 10), a test that fails when the list changes, and per‑entry disposition: port it (the default — the game bends) or record an accepted loss in front of Max on that step. |
| **5** | **A "true and misleading" byte‑identity gate** | Applied lab‑vs‑game, "max delta exactly 0" fails on day one by 3–6× on T_eq and 5–7 orders on tidal heat — for reasons that have nothing to do with the extraction. That false red looks exactly like a broken extraction and burns a session. | **Every byte‑identity gate in this plan is lab‑before vs lab‑after, measured on the same CONDITION object, never the same preset name.** Stated in each gate. |
| **6** | **A pixel‑moving step disguised as a neutral one** | Step 2 (tidal) and Step 4 (no‑surface guard) *must* move numbers. Step 4's obvious gates — anchor round‑trip, distinctness, grep — read **zero** shipped uniforms while the change moves `limbExponent` on 222/225 gas bodies (max delta 1.6997 on a 1.8–3.5 range) and `limbColor` on 225/225 (max channel delta 0.4797). | **Instrument C is a standing gate on every port‑touching step.** Pixel‑moving steps are *declared*, gated by a committed delta table, with one **named** re‑bless per affected test — never a blanket re‑record. |
| **7** | **Additive widening that isn't** | Forwarding `metallicity` flips `enrichmentZ` (`giant-drivers.js:124-125`) onto a branch whose anchor `canonicalZ0` (`:136-138`) is a density proxy in g/cc while metallicity is dex — measured `shellDepthFrac` 0.74 → 0.86 on all 144 bodies, pegged at the clamp ceiling. Step 1's shipped‑uniform gate would pass green and the failure would surface two steps later. | `metallicity` is **held out of Step 1** and lands in Step 5 **with** the `canonicalZ0` recalibration. Step 1's gate is extended to the giant‑driver triple over 200 bodies — the assertion that actually means "additive." |
| **8** | **A seeded field that is silently constant** | `fnv1aString` has a numeric form (`scene-naming.js:71`) and a hex form (`:73`); consumers do `macroSeed \| 0`, and `'da81e221' \| 0 === 0`. Every giant then shares `phaseJet` 0.533509 while every driver‑algebra distinctness gate still passes (`uBandContrast` has no seeded term). | Step 5 asserts `Number.isInteger(macroSeed) && macroSeed !== 0` inside the pack, adds a seeded‑field distinctness gate (hash `aBand`, require ≥N distinct), and pins all three `_ordinal` shapes. |
| **9** | **The HTML scrapers go vacuous, not red** | `radius-live-feed-fence.test.js:31` DENY‑scans **one file**; `radius-live-feed.test.js:103-113` regex‑extracts blocks and `new Function`‑compiles them. Move a law out and the fence passes trivially over an emptied region while the extracted module is unguarded. | **Step 3 lands before any step deletes lab code**, with a gate that requires both files to FAIL on a deleted block and asserts every extraction matched a non‑empty string. |
| **10** | **A prose backtick terminates a GLSL template literal** | Steps 6, 7, 9 all touch GLSL‑adjacent files. The signature is suites that stop **collecting** — 0 failures against N failed files — not N failed tests. | **Instrument A** catches it as a file‑set change. A raw failure count would not. |
| **11** | **A 99%‑right `sed` in the big move** | Step 7 rewrites 115 test files, 37 lab import lines, 36 docs `.mjs`. A path that no longer resolves gives a non‑collecting suite. | Instrument A; plus a stat() sweep over every lab import specifier; plus `git show HEAD:<old> \| diff -` showing changed lines only in specifiers. |
| **12** | **The game's gate value is an unmade rendering decision** | 49 lab checkboxes currently decide whether ~40 features render **at all**. `gates = ALL_ON` is defensible under standing constraint 1, but it is worth ~35 features of visual difference. | Named as a constant with a one‑line rationale at Step 5; **Max sees it at Step 6's screenshot**, framed as a decision he is making, not a regression he is discovering. |
| **13** | **A never‑rendered feature gets wired and blamed on the wrong side** | 10 of 49 lab features have never been observed to render (F44–F49 blocked, F11/F12/F19 measured inert at ~1e‑4 while their drivers derive 1.0, F36 unverified). Wiring them makes any failure unattributable between lab and game. **A per‑class uniform fence will not catch this** — a uniform can be non‑default and still produce nothing. | Queue (c) in §3 is **out of scope** (§7). None of the ten enters a pack in this plan. Each needs a lab‑side render gate first. |
| **14** | **Sol takes a new code path while every measurement rule excludes Sol** | Sol's Jupiter (`SolarSystemData.js:271`) and Saturn (`:344`) are `type: 'gas-giant'`, so a type‑keyed branch admits them. Sol renders from 18 NASA textures through a different renderer with no world‑engine condition fields. | **Step 6d excludes Sol in CODE** (branch on world‑engine provenance, not `type`), so the standing "never Sol" measurement rule stays honest rather than being quietly violated. |
| **15** | **Perf on the multiplied case is unmeasured** | `bakeClimateE5Attributes` is O(vertices) per giant; the rocky pack runs per moon; a system can carry 10 giants and 20+ moons. The lab shader is 363,566 bytes and `ShaderWarmup.js:132` never warms it — 29.8 s cold on first link. | Step 6 gates a **real warp arrival** with `warpMetrics.compileMs` against a recorded budget and `__shaderCacheBust` set; Step 10 gates frame time on the moon‑heaviest system in a 200‑system sample. If it blows the budget the fix is a bake cache keyed on `(regime, drivers, macroSeed)`. |

**One capability limit to state before Step 6's screenshot rather than discover after it.** `drawGiantConditions` **discards the body's real mass**: `giant-drivers.js:233-234` back‑solves `drawnMass = a.M0 * massFactor`, so `surfaceGravity` — the only mass channel `deriveGiantDrivers` reads (`:179-180`) — is (regime anchor × seed factor), never the planet's `massEarth`. Verified: setting `massEarth` to 999999 leaves `internalHeat` bit‑identical. Within a regime, game giants differ by age, T_eq and seed — **never by mass**. This is the shipped design (documented at `:211-213`), and it caps what "gas giants are wired" can mean.

---

## 7. What this plan deliberately does NOT do

A scope fence, so a fresh session does not wander.

**Not building:**

- **F52 (eclipse / moon shadows) in the lab.** The lab renders one body and has no shadow‑caster path; the game already has F52. This is the one feature where the lab is behind. **Open question for Max: is F52 in MVP scope?** If yes it is new lab work; if no, MVP is 52 features and F52 is a permanent, admitted exception to "one pipeline."
- **F44–F49 (hex, shattered, fungal, machine, city‑lights, ecumenopolis).** BLOCKED in the lab — no preset, no archetype (`cards/PROFILES.md:44-49`) — while the game already renders its own versions. **Recommendation: author the six lab presets as a prerequisite before these enter any wiring queue.** Replacing a working game feature with a lab feature nobody has ever seen render is how a failure becomes unattributable.
- **Queue (c) — the ~8 features that would wire correctly and render nothing.** `uRayBrightness ≡ 0` (F3 rays, because `hasAtmo` is true on 100% of bodies), `uFacetStrength ≡ 0` (F43, because the adapter only nulls atmosphere when `retained === false` — symbol-only per §10, conditionFromPlanet.js `if (phys.retained === false) return null;` — which never happens), `habGate ≡ 0 ⇒ uBioCoverage ≡ 0` (F46), `airlessnessOf ≡ 0`, `erosionOf` never returns 0. These need **world‑generation** work, not wiring. They must not be measured through the renderer.
- **The storm slice.** `applyStormState` (`planet-lod-lab.html:1811`) is a fourth driver function. F27/F28 and the `uStorm*` family are out; `aStorm` stays zero‑filled. Step 4 only *re‑sources* `applyStormState`'s regime read; it does not extract it.
- **The river/tectonic bakes.** `planet-lod-rivers.js` (107,980 B, 24 exports) and `planet-lod-tectonic.js` both import `three` and `ConvexHull`. **Unresolved decision: does `src/worldengine/` admit a three.js dependency, or do GPU‑coupled bakers land under `src/rendering/bake/`?** Recommendation is the latter — keep the world engine headless‑testable — but decide it *before* moving them, not during. Until then `fieldSampler.js:149` is the one named allowlist entry in the boundary fence.
- **Splitting `planet-lod-lab-core.js`.** It moves **whole** (1194 lines, 45 exports, 4 used by the game). Splitting is a judgement call that must not ride in a mechanical commit.
- **Migrating `featureRelevant` off preset names.** It currently gates 10 render uniforms via `ASSOCIATIONS[key].rendersOn.includes(driverUI.preset)` (`planet-lod-lab.html:1986-1989`). Migrating it to condition‑derived predicates is a **physics‑authoring job across ~12 features**, not a mechanical port. The precedent exists (`craterRelevanceOf`) and Step 9 uses it for craters only. The rest is a named follow‑on.
- **The remaining 20 of the 22 game‑own parallel implementations.** Only gas bodies and moons are swapped here. Exotic types (`Planet.js:955-1080`), hardcoded ice caps (`:721-725`), the aurora law, F50/F51 — all stay.
- **Reconciling `adaptL0` with `conditionFromPlanet`.** Step 2 cites `adaptL0.js:34` as the evidence that the tidal drop is a bug; it does **not** delegate to it. `adaptL0` returns a base‑step bundle (`ageNorm`, no atmosphere/tidalState/rotationHours) and its output is hashed by `tests/fixtures/v2-0-basestep-golden.mjs:51`. Two adapters remain; collapsing them is its own increment.
- **`condition.density`.** Measured wrong by >1.5× on 43% of generated giants (worst: bulk 0.37 g/cc reported as 4.39). Step 4 works around it by computing bulk density in the classifier. **The underlying generator defect stays open** and will bite whatever reads `condition.density` next.
- **`CRATER_VIS_FLOOR_RAD` re‑derivation** (`craterUniforms.js:68-71`), calibrated on Sol's 39 bodies whose gravity was fabricated as 1/R². Filed at Step 8, not fixed.
- **The `axialTilt` radians‑vs‑degrees disagreement** beyond the seam conversion in Step 1. F22/F23 also need `habitability` and a numeric seed that the fp does not carry — that is layer‑0 world‑gen work.
- **The lab's own quality backlog** (`lod-lab-quality-backlog.md`, Max's 14 entries) and the **52 Phase‑5 integration couplings** (`planet-lod-phase5-integration-plan.md`, none built). The §3 enumeration assumes **F1–F53 only**. If MVP includes those, MVP is larger than this plan and Max should say so now.
- **Re‑pointing the four dead `relief-*` harness files** or deleting the `planet-lod-river-amplifier` pair. The amplifier is dead but load‑bearing for `tests/vis-scale-fence.test.js`; deleting it turns a green test red for no gain. Leave both.
- **Anything on Sol.** 18 real NASA textures, a different renderer, no world‑engine condition fields, and `BodyRenderer` swaps the material *after* `conditionFromBody` runs — so every world‑engine measurement taken on a Sol body describes uniforms no player sees. Sol appears exactly twice in this plan: excluded in code at Step 6d, and used at Step 9 as a **pure‑function** population for crater math with an explicit note that it says nothing about pixels.

---

## ⭐⭐ MAX'S RULINGS — ALL FIVE ANSWERED 2026-08-06. The plan is GREENLIT.

The five open items below are **closed**. Answers are binding; two of them enlarge the job.

**1. F52 (eclipse / moon shadows) — IN SCOPE. Recommendation OVERRULED.** Max, verbatim:
*"yes, the lighting engine needs to work for all objects in game."* Read the scope correctly: this
is **not** just "add F52 to the list." The ruling is about the **lighting engine as a whole** —
lighting must work for **all objects in the game**, not planets only. F52 is the named instance,
and it is the one feature where the LAB is behind the game, so it means **new lab work**: the lab
renders one body and has no shadow-caster path. ⛔ Do not treat lighting coverage for moons, rings,
ships or any other object class as out of scope on the grounds that "the plan only said F52."

**2. "All the planned features" — BIGGER MVP.** Max: *"yes, bigger mvp."* MVP is **not** F1–F53
only. It also includes the lab quality backlog (`lod-lab-quality-backlog.md`, Max's 14 entries) and
the Phase-5 integration couplings (`planet-lod-phase5-integration-plan.md`, 52 gaps, none built).
⚠ **§3's checklist is therefore INCOMPLETE as written** — it enumerates one spine of three. The
second and third spines still need enumerating; that is now a prerequisite for calling MVP
closable, though NOT a prerequisite for starting Step 0.

**3. F26 — RESOLVED, and it was never UNKNOWN.** Max: *"idk, see if you can find the record."*
Found. **F26 is BUILT IN THE LAB and ABSENT FROM THE GAME** — an ordinary member of the 48-feature
lab-only queue. Two stale records pointed in opposite directions and cancelled out:
- `planet-visual-features.md` tagged it `[current]`, which the legend defines as "renders in the
  live build today." It does not. **Corrected to `[lab]`** (`:262`).
- `cards/F26-latitude-weather-bands.md:37` said "Unbuilt", written before the build. **Corrected.**
  It shipped in tracker phase 4b (`✅ 2026-06-10`): `planet-archetypes.js:38` + `:226`,
  `planet-lod-lab.html:5135-5138`, GLSL at `planet-lod-shaders.glsl.js:840-862`.
- Likely origin of the bad tag: `Planet.js:30` has `uWeatheredColor`, an unrelated **rock-palette**
  uniform. A `uWeather*` grep hits it. It is not weather bands.

⭐ **The systemic finding is worth more than the F26 answer.** The catalog's legend had **no tag
for "built in the lab, absent from the game"** — only `[current] / [partial] / [aspirational] /
[subtle]`. The doc structurally could not express the distinction Max's MVP is defined by, which is
why one feature's status silently disagreed with itself. **A `[lab]` tag has been added to the
legend.** ▶ The other ~47 lab-only features still carry whatever tag they were given under the old
scheme; a full re-tag pass is queued, NOT done — §3's enumeration is the input for it.

**4. `gates = ALL_ON` for the game — CONFIRMED.** Max: *"yes."* Recommendation stands. The ~40
features gated by the lab's 49 checkboxes all render in the game. Max sees the consequence at Step
6's screenshot as a decision he made, not a regression he discovered.

**5. The ordering — GREENLIT.** Max: *"yes."* Steps 0–3 (instruments, condition widening, tidal
fix, fail-open fence) land before anything visible. Gas giants ship at Step 6, moons at Step 10.

### What the rulings change

| | Before | After |
|---|---|---|
| MVP feature spine | F1–F53 (58 rows) | F1–F53 **+** 14 backlog entries **+** 52 Phase-5 couplings |
| F52 | proposed out of scope | **in**, and generalised to "lighting works for all objects" |
| F26 | UNKNOWN | `[lab]` — built in lab, absent from game |
| §3 checklist | "the" checklist | **one spine of three**; the other two need enumerating |
| Steps 0–12 | awaiting greenlight | **greenlit, unchanged** |

⛔ **The step sequence is NOT affected by rulings 1 and 2.** F52/lighting and the two extra MVP
spines are *additional* work that lands after this plan's machinery exists — they are not
prerequisites for Step 0, and folding them in now would be the "wire it into the two-route world
and migrate it twice" mistake this plan exists to prevent.

---

## Open items for Max — ALL ANSWERED, retained for the reasoning

1. **Is F52 (eclipse/moon shadows) in MVP scope?** It is the only feature the lab lacks. Yes ⇒ new lab work; no ⇒ MVP is 52 features and F52 is a permanent game‑owned exception. **Recommendation: no** — the game already has it and the lab has one body to render.
2. **Does "all the planned features" mean F1–F53 only?** This plan assumes yes. If the lab quality backlog (14 entries) and the Phase‑5 couplings (52 gaps) are in, MVP is materially larger and the §3 checklist needs a second spine.
3. **F26 (latitude weather bands) is UNKNOWN.** The doc tags it `[current]` in the game; no Hadley/ITCZ code exists in `Planet.js`. Stale doc or wrong feature ID — this needs a one‑line ruling before the checklist can be closed.
4. **`gates = ALL_ON` for the game.** 49 lab checkboxes currently decide whether ~40 features render at all. **Recommendation: ALL_ON**, per standing constraint 1. You will see the consequence at Step 6's screenshot; treat it as a decision, not a regression.
5. **Greenlight the ordering.** Gas giants ship at Step 6, moons at Step 10 — both after five preparatory steps that produce no visible change. The alternative (ship a feature first) was rejected because Steps 0–3 are the instruments every later gate cites, and Step 3 in particular must land before anything deletes lab code.
---

## 10. Citation convention — adopted 2026‑08‑07, after Step 1's citations rotted in a day

**The problem this closes.** Step 1 added 239 lines to `conditionFromPlanet.js` and re‑pointed nothing. Within a day every ref into that file — from `body-condition-vector.js`, and from §2 and Step 1 of *this document, which Steps 2–12 are executed from* — landed inside one of Step 1's new comment blocks. The same pass left ~15 refs in Instrument C's uniform map off by one or two; in a uniform block, off‑by‑one is not a stale ref, it **names the neighbouring uniform**. Following `uIceColor → Planet.js:1608` landed on `uIcenessMix: { value: d.iceness }` and would have "shown" that the map paired a colour with a scalar. **A ref that is wrong is worse than a ref that is absent, because it reads as freshly verified.**

**Three forms. Pick by how fast the target moves.**

| form | example | use for |
|---|---|---|
| **symbol only, no line** | ``PlanetGenerator.js `baseColor: palette.base` `` | `src/worldengine/port/conditionFromPlanet.js` (all of it) and the record‑literal / bake region at the bottom of `PlanetGenerator.generate`. Every step in this plan adds lines to both, so an integer written there is born with a half‑life of one step. |
| **line + the symbol on that line** | ``Planet.js:1609 `uIceColor` `` | everything else. The integer is the convenience; the **symbol is the ref**. If they ever disagree, grep the symbol. |
| **quoted claim** | `PLAN.md:190 "zero delta on all 27 shipped uniforms"` | refs into *this* file. |

**⛔ Edits to this file must be LINE‑COUNT‑NEUTRAL below line 24.** About thirty citations in `tools/port-uniform-delta.mjs` and `tests/port-condition-contract.test.js` address this document by line (`PLAN.md:189`, `:212`, `:548`…). Inserting a paragraph re‑points all of them at once, silently, which is the exact failure §10 exists to stop. This file's paragraphs are already one line each — **expand a line, do not insert one.** Verify before committing:

```
git show HEAD:docs/FEATURES/one-pipeline-two-frontends-PLAN.md | wc -l   # must equal
wc -l docs/FEATURES/one-pipeline-two-frontends-PLAN.md                   # this
```

If a genuinely new section is needed, append it at the end — nothing cites past `:605`.

**The `line + symbol` form is machine‑checked.** `node tools/port-uniform-delta.mjs --check-citations` resolves every `` file:NNN `symbol` `` written in the instrument sources and fails if the symbol is not on that line. It is wired into `npm run check:instruments`. Refs with no backticked symbol are counted and reported as **unchecked** — that count is the honest measure of how much of this document is still taken on trust.

---

## 11. When a step is DONE, and when hardening stops — adopted 2026‑08‑07

**Why this section exists, and what it is answering.** Three adversarial rounds ran against Steps 0 and 1. Round 1 found 1 must‑fix, round 2 found **8**, round 3 found **5** — every one of them real, each on work that had already passed its own gate and been declared proven. Round 2's finding 1 would have mis‑rendered half the galaxy's polar caps, so the rounds are not noise and "stop reviewing" is the wrong lesson. But the sequence had no defined terminator, which makes *keep hardening* indistinguishable from *churn forever*. Max named that as the risk and asked for the definition before any more code. **This section is the terminator, and every step from 2 onward inherits it.** It is derived from what the three rounds actually found, not authored from a diagram — the same reason Step 11's fence is generalised from two shipped packs.
### 11.1 Four classes of finding, three stopping powers
| class | what it is | stopping power |
|---|---|---|
| **L — live defect** | a number, pixel, draw or record that the shipped code produces is wrong | **BLOCKS** |
| **D — dead gate** | a gate the step *names* cannot fail on its own declared subject: vacuous, self‑referential, subject outside its watched set, **or the next declared step's own move can be written past it BY AN AUTHOR FOLLOWING THE FILE'S OWN IDIOMS** (⭐ amended 2026‑08‑08 — see §11.9) | **BLOCKS** |
| **N — navigational rot** | a ref, docstring or comment that reads as freshly verified and points at the wrong thing | **BLOCKS iff it sits in a file or region the next step reads or edits**; otherwise CARRIED |
| **A — advisory** | robustness, a scope widening, a better idea, a hole nothing currently walks through | CARRIED |
The evidence the taxonomy is built from, not an illustration of it: **L** = round 2 finding 1 (polar caps). **D** = round 1's must‑fix (Instrument C fingerprinted its own subject and printed `0.000000e+0` for the uniform that had moved), round 3 finding 3 (the `_provenance` fence has five constructible bypasses, one of them the file's existing idiom), round 3 finding 4 (two of the fold's four lines are unreached and two mutants survive the whole suite; the test titled *"NAMES THE HAZARD"* asserts against the test's own copy, never against the implementation). **N** = round 3 findings 1, 2 and 5. **A** = round 3's advisories A–I.
**The D clause's second half is the load‑bearing one and it is what makes D finite.** "Prove the gate bites" against an arbitrary mutant is unbounded; against **the next step's declared first move — item 1 of that step's *What* section in §4, taken literally** — it is a single, known, written‑down thing. Round 3's most valuable finding was generated by exactly that question — *Step 2's declared read is `tidalHeat: d.tidalHeating`; can it be written past the fence?* — and the answer was yes, five ways. Ask it every time; it is one question with a finite answer.
### 11.2 The conversion rule — this is what actually terminates the loop
**When a round finds a class of thing, land the machine check that closes the class — not only the point fix.** A point fix removes one instance and leaves the class findable by the next round forever; a machine check removes the class from review's reach permanently. Round 3 findings 1 and 2 (rotted refs) convert to *widen `CITE_SOURCES` to every file the step edited* — after which citation rot is a red build, never a review finding. Round 3 finding 3 converts to *scan every module‑scope function in the file except `provenanceOf`, and reject `d?.`, `d[` and `const {…} = d` the same way `planetData.` is rejected* — after which the bypass class is closed for every future step's reads, not just Step 2's.
**The loop terminates because the class count is finite and each round either closes a class or returns nothing new.** That is the whole mechanism. It is not a promise that review stops finding things; it is a structural guarantee that it stops finding the *same kind* of thing, and the kinds are few — three rounds have already enumerated four. This is the same move `heightNoise.glsl.js` made against duplication and the shrink‑only ratchet (Step 5f) makes against the un‑packed authoring path: replace a habit of vigilance with a thing that fails the build.
### 11.3 The exit criterion — six checkable facts, none of which is "an agent said SOUND"
A step is **DONE** when all six hold. Each is a command whose output lands in the commit, so a fresh session can re‑establish the verdict without re‑running the review.
1. **Every gate the step's own text names has a committed, executed mutation showing it fails**, and **at least one of those mutants is drawn from the next step's declared first move.** Step 0 already states the principle — *"A gate that has never failed is not a gate"* — and Step 11 restates it — *"A pass with no failing control is worthless."* This clause makes it the terminator rather than an aspiration.
2. **Every new or changed pure function has no line unreached by an assertion**, measured rather than asserted. No coverage or mutation tooling is installed (vitest only), so this is a hand‑authored mutant per branch until it is worth installing `@vitest/coverage-v8` — and note that line coverage is the weaker property: round 3 finding 4's two dead lines would show as *covered* if any test merely called the function.
3. **Every measurement in the step carries a control that moved.** ⭐ Non‑negotiable, and the only clause with no cheap exit. This codebase's signature failure is a measurement that is entirely true and entirely misleading, and in all three recorded instances — Instrument C fingerprinting its own subject, a `readPixels` probe reporting "0 pixels changed" against a `sceneTarget` with `preserveDrawingBuffer` false, pre‑P2 Instrument C reporting `2.2e-16` over a real `3.1e-2` move — **a known‑good control is what exposed it.** A zero with no control that moved is not evidence of anything. Expect this clause to be the first one under pressure; it is the one to refuse to trade.
4. **Instruments A, B and C green** (D from Step 6), **and `npm run port-uniform-delta:citations` green over a `CITE_SOURCES` that includes every file the step edited.** The second half is not optional bookkeeping: round 3 finding 1 was broken *by the round that fixed citations* and was invisible because the adapter and the contract test — which carry 50 and 49 refs, the two densest carriers of the port's reasoning — were outside the scanned set.
5. **Zero open L or D findings.** Every N and A is written into the carried ledger (§11.6) with the named step that clears it.
6. **The step's declared movers actually moved.** A pixel‑moving step (Steps 2, 4, 8b) publishes a committed delta table that is **non‑zero on the named quantities**; a byte‑identical step publishes **subject 0 with a control non‑zero**. A byte‑identity gate whose control never moved is indistinguishable from a gate pointed at nothing, which is finding class D arriving through the front door.
### 11.4 The round protocol
**One** adversarial round per step, run against the step's declared gate list and the §11.3 six. **A second round fires only if round 1 produced an L or D finding, and its scope is the fix diff alone** — not the step again. Anything round 2 finds outside that diff is CARRIED by definition, whatever its class. **There is no round 3.** If round 2 finds a *new* L or D inside the fix diff, that is evidence the step was mis‑scoped: stop, write what was found, and put it to Max as a scope question. That escalation is the honest escape valve — it does not declare the work done, it hands the decision to the person whose call scope is.
**Why not "review until a round returns clean."** Under §11.1 the blocking class is narrow enough that it probably *would* terminate in two or three rounds. It is rejected anyway because it has no defined terminator and therefore cannot be planned against, which is the specific failure Max named. **Why not "exactly one round."** Round 3 found five real things in the fixes to round 2's eight, one of which was a citation broken by the citation‑fixing round itself; fixes to blockers demonstrably introduce blockers.
### 11.5 Who decides what
**The agent decides, by running things — not by judging:** all six of §11.3, and the class assignment (L/D/N/A) for every finding, **with the reason written down**. Gate completeness is a technical property with a mechanical test (§11.1's D clause) and it is the agent's call. An agent must never report a step DONE on the strength of a verdict word; it reports it on the strength of the six.
**Max decides:** the round‑2 escalation; anything visual; anything that changes what MVP means; and **retiring** a carried item rather than clearing it. **No agent ever closes UAT** — standing rule, unchanged by this section. `verify-workstream` marking UAT‑layer ACs `deferred-to-max` is the same rule in the other harness.
### 11.6 The carried ledger
Carried findings live in **`docs/FEATURES/one-pipeline-two-frontends-CARRIED.md`**, one row each: id · class · round found · the finding · the step that clears it. A file rather than commit messages, because commit messages are written once and re‑read never, and a carried item that nothing surfaces is indistinguishable from a dropped one. **A carried item that no step clears must be promoted to blocking or explicitly retired by Max** — "carried" is not a place to put things to die.
**Carrying is a floor on *when*, not a ceiling.** A carried item may be cleared early when it rides along a commit that is already open in that file; the ledger exists to stop things being forgotten, not to forbid cheap fixes.
### 11.7 First application, worked out loud — the `GREEN_BUT_GATE_DEAD` route‑agreement gate
The Step‑1 verify pass self‑reported `GREEN_BUT_GATE_DEAD`: route agreement catches route **shape** divergence but not **value** divergence. Round 3 advisory B has the mechanism — ``tests/port-route-agreement.test.js `disagreeingFields` `` (symbol-only per §10; Step 8 rewrites that file, and writing this ref in the `line + symbol` form is what surfaced ledger row **B4** live — the resolver exits 2 because the basename is not in `CITE_FILES`) compares `bakedOn(rec)`, which `PlanetGenerator` wrote from `conditionFromPlanet(rec)`, against `bakesFrom(conditionFromPlanet(rec))`: same pure function, same object, so it cannot fail while the bake route derives from the returned record — which is precisely what channel 1 already asserts.
**Class: D candidate** — a gate that cannot fail on half its declared subject. **Apply the D clause: can the next declared step's own move be written past it?** Step 2 forwards `tidalHeat`, `starMassEarth` and `orbitRadiusEarth` into the fp literal, and Step 1 collapsed the two routes onto **one constructor** — so for Step 2's change there is a single producer and the two routes cannot disagree on a value at all. **Not blocked.** It becomes live at **Step 8**, where `conditionFromBody` gives moons a second generator path and value divergence between routes is constructible again. **Verdict: CARRIED, cleared by Step 8.** Advisory C (channels 1 and 3 cannot see a record mutated between the literal and the adapter call) is the same family and clears with it.
### 11.8 What this section supersedes
**§10's line‑count verification recipe is corrected here** (round 3 advisory G): §10 tells you `git show HEAD:… | wc -l` "must equal" `wc -l`, then permits appending at the end — which this section does, making them unequal by design. **The correct check is that the region above the `## 11.` heading is line‑count‑neutral**, and appending below it is always allowed:
```
# LIM-4 skips the blank / --- / blank separator that precedes the heading.
LIM=$(grep -n '^## 11\. When a step is DONE' docs/FEATURES/one-pipeline-two-frontends-PLAN.md | cut -d: -f1)
diff <(git show HEAD:docs/FEATURES/one-pipeline-two-frontends-PLAN.md | head -n $((LIM-4))) <(head -n $((LIM-4)) docs/FEATURES/one-pipeline-two-frontends-PLAN.md)
```
**Proven to bite, per §11.3.1.** Run above: identical over lines 1‑679. Control: `sed -i '400i\INJECTED'` then re-run ⇒ `400a400 > INJECTED`, exit 1. A recipe that has only ever printed nothing is not a check — and the first version of this one, written two paragraphs above, was off by two and passed a real insertion.

### 11.9 The D clause, amended 2026‑08‑08 — why "can it be written past?" could not terminate
**§11 was written on 2026‑08‑07 to end a loop, and its D clause reproduced the loop in a new place.** As drafted, D asked: *can the next declared step's own move be written past this gate?* Three adversarial rounds against the `_provenance` fence answered **yes** every time, and each answer was correct. That is not a run of bad luck — **for any static analysis over a Turing‑complete language the answer is always eventually yes**, so a clause phrased that way has no terminating state and the rounds were re‑answering a question with a fixed answer.
**The rounds were not equivalent, and the clause could not see the difference.** Round 2's survivors were `_z ||= d` and `_z ??= d` — idiomatic modern JS, in a file that already writes `planetData || {}` and `?? {}`, so a Step‑2 author could hit one **by accident**. Round 3's survivors are `arguments[0].tidalHeating` written where `planetData` is in scope, and a call mis‑resolved by shadowing a function name with a non‑function binding: **deliberate evasion, not accident.** The unamended clause blocked on both identically.
**The amendment.** D now asks whether the move can be written past the gate **by an author following the file's own idioms.** An accidental bypass blocks. An adversarial one is recorded as a **named limit** in the ledger and in the gate's own source, and does not block. The justification is what a gate of this kind is *for*: it catches mistakes, and it is not an adversarial boundary — anyone willing to write `arguments[0]` to dodge a fence can equally delete the fence in the same commit. A gate that must defeat its own author is not achievable and pretending otherwise buys nothing but rounds.
**What this costs, stated so it is not discovered later.** A bypass that is exotic today becomes idiomatic when the language or the file's style moves; "follows the file's own idioms" is a judgement, not a measurement, and it is the agent's judgement under §11.5. The mitigation is that the judgement must be *written down with the construct it excused* — both surviving forms are named in `KNOWN LIMITS` inside `tests/port-condition-contract.test.js`, in the gate's own source where the next author meets them, not only in a ledger they may not open. **A limit that is not written into the gate itself has been forgotten, not accepted.**
**The generalisable rule, which is the part worth carrying to Steps 3–12.** §11.2 says close the class, not the instance. This is the same move applied to the *definition*: three rounds of the same finding is not a signal to run a fourth, it is a signal that **the criterion is wrong**. When a gate's exit test keeps returning the same verdict on genuinely different work, suspect the test before the work.
