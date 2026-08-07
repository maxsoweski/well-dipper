# Carried findings — one-pipeline-two-frontends

*Companion to [`one-pipeline-two-frontends-PLAN.md`](one-pipeline-two-frontends-PLAN.md) §11. Read §11.1 for the classes and §11.6 for the rules that govern this file.*

**Scope.** Adversarial-review findings only. The plan's deliberate non-goals live in §7 and are not carried items — they were never findings. A row here is a thing a review found, classified **N** or **A** under §11.1, with the named step that clears it.

**The two rules that keep this file honest:**
- A carried item that no step clears must be **promoted to blocking** or **explicitly retired by Max**. "Carried" is not a place to put things to die.
- Carrying is a floor on *when*, not a ceiling. Clear an item early when it rides along a commit already open in that file.

---

## Open

| id | class | round | finding | clears at |
|---|---|---|---|---|
| **C1** | A | 3 (adv. A) | **The obliquity domain gate proves the VALUE is fit and says nothing about the WIRING, and the mismatch is live.** `frostLatitudeBiasFor` (`tests/port-condition-contract.test.js:790-794`) calls `deriveUniforms({ …, axialTilt: deg })`, but the condition key is `axialTiltDeg` (`body-condition-vector.js:200`) and `deriveUniforms` reads `d.axialTilt` (`planet-lod-lab-core.js:907`). Nothing maps one to the other — the gate hand-renames the key. On the day Steps 4/5/8 hand `deriveUniforms` a real condition, every body reads `bias 0` again: the exact 267/526 symptom the fold removed, from a different cause, under a green gate. | **Step 5** — where the pack contract and `writePackUniforms` settle the driver/uniform key mapping. Land one assertion naming the rename as required-and-missing. ⭐ Highest-value row in this file. |
| **C2** | A | Step 1 verify (`GREEN_BUT_GATE_DEAD`) + 3 (adv. B) | **Route agreement catches route SHAPE divergence, not VALUE divergence.** ``tests/port-route-agreement.test.js `disagreeingFields` `` compares `bakedOn(rec)` — which `PlanetGenerator` wrote from `conditionFromPlanet(rec)` — against `bakesFrom(conditionFromPlanet(rec))`: same pure function, same object, so channel 2's S stratum cannot fail while the bake route derives from the returned record, which is what channel 1 already asserts. Worked out loud in PLAN §11.7 as the definition's first test case. | **Step 8** — `conditionFromBody` gives moons a second generator path and value divergence becomes constructible again. |
| **C3** | A | 3 (adv. C) | **Channels 1 and 3 cannot see a record mutated between the literal and the adapter call.** For a key that is neither in `WIDENED` nor read by the four bakes, all three channels stay green through `const planetData = {…}; planetData.X = v; conditionFromPlanet(planetData); planetData.X = orig;`. Same class as the P-stratum defect the file names for `MoonGenerator`; not named for the constructor. | **Step 8**, with C2 — same gate, same commit. |
| **C4** | N | 3 (adv. D) | `tests/port-route-agreement.test.js:45` header reads **"WHY FOUR CHANNELS AND NOT ONE"**; there are three. | **Step 8** with C2/C3. Ride-along eligible — one word. |

## Cleared

*(none yet)*

## Retired by Max

*(none yet)*

---

## Blocking residue from round 3 — NOT carried, listed here so it is not mistaken for carried

These were classified **L** or **D**, or **N inside a file Step 2 edits**, so under §11.1 they **block Step 2** and are not eligible for this ledger. They are one focused commit. Recorded here only because round 3's full text lives outside the repo.

| id | class | finding | conversion (§11.2) |
|---|---|---|---|
| **B1** | D | **The `_provenance` fence has five constructible bypasses**, one of which is the file's existing idiom, and **Step 2's own declared read `tidalHeat: d.tidalHeating` can be written past all five.** Verified by replicating the extractor against six synthetic adapters: MISSED on module-scope helper taking `d`, `d?.x`, `const {x} = d`, `d['x']`, and a second alias `const p = d`. Only the plain `d.x` control was CAUGHT. | Scan **every** module-scope function in `conditionFromPlanet.js` except `provenanceOf`, and reject `d?.`, `d[` and `const {…} = d` the same way `planetData.` is rejected. Closes the class for every future step's reads. |
| **B2** | D | **Two of the four lines of `effectiveObliquityDegreesOf` are never exercised — including the one handling the hazard the block names.** No assertion feeds the fold `|value| > 180`; mutants `>180 → t-360` and *no `% 360`* both survive the whole suite. `tests/port-condition-contract.test.js:895-901`, titled *"⚠ NAMES THE HAZARD THE FOLD INTRODUCES"*, asserts against **the test's own copy**, never against the implementation. | Two assertions: `effectiveObliquityDegreesOf(4924.2)` against the real function, and one input past 180. Fails §11.3.2 as written. |
| **B3** | D | **The citation fence has two vacuous paths and it is the machine check §11.2 relies on to close class N.** (1) `citationHolds` is `normWs(text).includes(normWs(sym))` with no word boundary, so ``foo.js:100 `d` `` passes on almost any line. (2) Wrapping a whole citation in one code span makes `insideSpan` true and `sym` null, and the ref **silently drops into UNCHECKED** — where one more among 232 is invisible. | One line each. A fence with a silent-drop path cannot be the thing that closes a class. |
| **B4** | N→D | **`CITE_SOURCES` omits the adapter and the contract test — the two densest carriers of the port's reasoning (50 and 49 refs).** `tools/port-uniform-delta.mjs:952-957` lists only `port-uniform-delta.mjs`, `body-condition-vector.js`, `PLAN.md`, `body-identity-fence.test.js`. Adding a source is **not** the one-line change the tool's own note claims: `conditionFromPlanet.js` cites `climate-e5.js`, `storm-e.js` and `emission-e.js`, none in `CITE_FILES`, and the mode **exits 2 on an unknown basename by design**. | Widen `CITE_SOURCES` *and* `CITE_FILES`. This is the conversion that makes §11.3.4 real; B5–B8 are then found by the build, not by review. **Hit live 2026-08-07 while writing §11.7**: citing `disagreeingFields` in the correct `line + symbol` form made the fence exit 2 on the unknown basename, so §11.7 had to fall back to symbol-only. Writing a *correct* citation is currently a red build — that is the shape of this defect, and it is why B3's silent-drop path matters: the vacuous form passes. **This file must join `CITE_SOURCES` in the same change**, or the ledger becomes the next unscanned carrier of the port's reasoning. |
| **B5** | N | `conditionFromPlanet.js` cites ``PlanetGenerator.js:789 `habitability: habScore` `` — `:789` is `T_eq,`; the real line is **791**. Written in the exact form `--check-citations` was built to resolve, and invisible only because of B4. **This is round 2 finding 5's failure mode reproduced inside the round that fixed finding 5.** | caught by B4 |
| **B6** | N | **Four bake-block refs rotted by the same edit**, all pointing into the middle of the new comment block at `PlanetGenerator.js:727-759`: `tests/port-condition-contract.test.js:70` and `:1367`, `conditionFromPlanet.js` (the `:496` bake-region claim), and **`PLAN.md:212` — which is Step 2's own gate text.** The five bakes are now `iceColor: ICE_ALBEDO` and the assignments at `:809`, `:827`, `:828`, `:829`. Separately `tests/port-condition-contract.test.js:1346` cites `rotationSpeed` at `:782`, which is `noiseDetail`. The `conditionFromPlanet.js` ref also **violates §10 in the round §10 landed** — it cites the bake region by integer where §10 rules symbol-only. | caught by B4 (except `PLAN.md:212`, which needs a line-count-neutral expansion) |
| **B7** | N | `conditionFromPlanet.js` cites ``e1Regime.js:68 `compositionClass` `` — line is right for the content, but `compositionClass` is declared at `:66`. Malformed under §10's `line + symbol` form. | caught by B4 |
| **B8** | N | `conditionFromPlanet.js` says "`surfaceMaterial.js:335` — **inside** `surfacePaletteOf`". `:335` is inside `surfaceAlbedoOf` (`:323`), which `surfacePaletteOf` calls; the tool's own map puts `surfacePaletteOf`'s body at `:304-318`. Substance right, containment claim wrong. | caught by B4 |
| **B9** | D | **`tests/baseline/known-failures.json` records `"recordedFromCommit": "0af246e"` with no dirty-tree marker** (`scripts/test-baseline.mjs:448` is a bare `gitHead()`) while the numbers it holds are the working tree's. Instrument C prints `(dirty tree)`; A does not. A clean checkout of `0af246e` runs Instrument A red against a record that claims to come from there — and Step 2 re-records. | One line: give A the dirty-tree marker C already has. |
| **B10** | — | §10's line-count verification recipe contradicted its own append hatch. | ✅ **FIXED** — corrected recipe in PLAN §11.8. |

**What round 3 could not break, stated because it is the evidence and not the absence of it.** The route unification is genuinely byte-inert (808 bodies, condition keys differing = `magneticField`/`habitability`/`axialTiltDeg` only, **bodies whose four bakes moved: 0**, control `T_eq×3` moved **750/808**). No RNG draw was reordered. The zero delta is a true green — nothing outside the vector's own emission reads `axialTiltDeg`. The fold's maths is right on every hard case checked against the consumer. The frozen legacy vector is a faithful copy of `b2ac455`. All four instruments green.
