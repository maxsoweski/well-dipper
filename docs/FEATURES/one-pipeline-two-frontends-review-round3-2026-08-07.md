# Adversarial review — round 3, Step 1 fixes · 2026-08-07

*Verbatim agent output, extracted programmatically from the workflow result (not retyped).
Subject: commit `56d136a`, the fixes to round 2's eight findings.
Verdict: `SOUND_WITH_FIXES` — 5 confirmed problems, 9 advisories.*

**Read this with [`one-pipeline-two-frontends-CARRIED.md`](one-pipeline-two-frontends-CARRIED.md),
which classifies every finding below under PLAN §11.1 and says which block and which are carried.**
This file is the evidence; the ledger is the disposition. It is preserved because the original
lived only in a `/tmp` workflow output, and §11.3.3 makes the evidence behind a verdict part of
the verdict.

---

Verified everything myself against the working tree: ran `npm run check:instruments` (all four green), both touched test files (66 pass), plus four independent scripts — an 808-body old-literal-vs-whole-record differential with a control, a hard-case table for the fold, a replication of the provenance extractor against six synthetic adapters, and a re-run of the citation resolver over the two files `CITE_SOURCES` omits.

---

# CONFIRMED PROBLEMS

## 1. The route fix broke a symbol-anchored citation, in the one file the new citation fence does not scan

`src/worldengine/port/conditionFromPlanet.js:194`:

```
//   game  PlanetGenerator.js:789 `habitability: habScore`, where
```

`PlanetGenerator.js:789` is `T_eq,`. The real line is **791**. The record literal grew by two lines when the four bake placeholders (`landPalette: null` … `lavaCrustColor: null`) were inserted at `:762-766`, and this ref was not moved.

It is written in the exact `file:NNN \`symbol\`` form `--check-citations` was built to resolve. It is not caught because `CITE_SOURCES` (`tools/port-uniform-delta.mjs:952-957`) is `port-uniform-delta.mjs`, `body-condition-vector.js`, `PLAN.md`, `body-identity-fence.test.js` — the **adapter itself and the contract test are omitted**, and they carry 50 and 49 refs. I ran the tool's own resolver over them; it finds this one plus `:322` (advisory H below).

**Failure scenario:** the next reader checking whether the game really emits an object for `habitability` follows `PlanetGenerator.js:789`, lands on `T_eq,`, and concludes the block describes a field the generator no longer sets — while the actual `{score,factors}` claim, which `habitabilityScalarOf` exists for, sits two lines down unverified. This is finding 5's failure mode reproduced inside the round that fixed finding 5.

The tool's own note says adding a source "is a one-line change and should be done." It is not: `conditionFromPlanet.js` cites `climate-e5.js`, `storm-e.js` and `emission-e.js`, none of which are in `CITE_FILES`, and the mode **exits 2 on an unknown basename by design**.

## 2. Four more bake-block citations rotted by the same edit, one of them written this round

All point into the middle of the new comment block at `PlanetGenerator.js:727-759`:

| ref | claims | actually at that line |
|---|---|---|
| `tests/port-condition-contract.test.js:70` | "Five are baked onto planetData at `PlanetGenerator.js:743-756`" | `// render route calls. The moment Step 4/5/8 adds…` |
| `tests/port-condition-contract.test.js:1367` | "`PlanetGenerator.js:743-756` writes only its five named bakes" | same block |
| `src/worldengine/port/conditionFromPlanet.js:496` | "`PlanetGenerator.js:756-761` writes only its five named bakes" | `//` · `const planetData = {` · `type,` · `landPalette: null,` |
| `docs/FEATURES/one-pipeline-two-frontends-PLAN.md:212` | "the four bakes `PlanetGenerator.js:753-755` writes onto `planetData`" | `// on 224 each), so the zero is a fact about the laws…` |

The five bakes are now `iceColor: ICE_ALBEDO` at `:764` and the assignments at `:809`, `:827`, `:828`, `:829`.

Separately, `tests/port-condition-contract.test.js:1346` cites "`rotationSpeed` (`PlanetGenerator.js:782`)" — `:782` is `noiseDetail: rng.range(0.3, 0.8),`; `rotationSpeed` is `:783`. Off by one.

`conditionFromPlanet.js:496` also **violates the §10 convention landed in the same round**: PLAN.md:672 rules that "the record-literal / bake region at the bottom of `PlanetGenerator.generate`" takes symbol-only refs, no integer. That is exactly the region it cites by integer.

## 3. The derived `_provenance` fence has five constructible bypasses — and one of them is the pattern the file already uses

`tests/port-condition-contract.test.js:1218-1230` names **one** assumption (`planetData.<field>` direct reads) and guards it. I replicated the extractor verbatim and ran it over synthetic adapters, with the plain read as a control:

```
MISSED  A · read delegated to a module-scope helper that takes `d`
MISSED  B · optional chaining  d?.starMassEarth
MISSED  C · destructuring      const { orbitRadiusEarth } = d
MISSED  D · computed access    d['starMassEarth']
MISSED  E · second alias       const p = d; p.tidalHeating
CAUGHT  CONTROL · tidalHeat: d.tidalHeating      undeclared=[d.tidalHeating]
```

**A is the damning one.** `functionBodyOf(code, 'export function conditionFromPlanet(planetData)')` scans only that one body, and `:1093-1095` says so deliberately ("scanning `provenanceOf` would put the record back on both sides"). But `provenanceOf(d, comp)` and `atmosphereFromPlanet(…)` prove the file already delegates. Step 2's declared next read is `tidalHeat: d.tidalHeating` (PLAN.md:201); written as

```js
function tidalHeatOf(d) { return d.tidalHeating ?? 0; }   // module scope
...  tidalHeat: tidalHeatOf(d),
```

the fence stays green, `_provenance` silently stops describing an input, and the file's instruction "Read it before believing any number this seam produces" starts under-reporting — the precise failure the rewrite was built to end. **Fix:** scan every module-scope function in the file *except* `provenanceOf`, and reject `d?.`, `d[`, and `const {…} = d` the same way `planetData.` is rejected.

## 4. Two of the four lines of `effectiveObliquityDegreesOf` are never exercised — including the one that handles the hazard the block names

Measured over every input any assertion feeds the fold:

```
generated deg range : -85.543 … 80.769
Sol max |deg|       : 177.617
explicit test inputs: -25, 98, 177.62, 0, 90, NaN, undefined
=> no assertion ever feeds the fold a |value| > 180 or > 360.
```

So `Math.abs(t) % 360` and `if (t > 180) t = 360 - t` (`conditionFromPlanet.js:184-185`) are dead under test. Two mutants survive the whole suite:

```
mutant  >180 → t-360   disagrees with real on any tested input?  NO — survives
mutant  no  % 360      disagrees with real on any tested input?  NO — survives
```

And `tests/port-condition-contract.test.js:895-901`, the test titled *"⚠ NAMES THE HAZARD THE FOLD INTRODUCES: a double conversion now lands INSIDE the domain"*, asserts `expectedEffectiveObliquity(4924.2) ≈ 64.21` — **against the test's own copy, never against `effectiveObliquityDegreesOf`.** The one path in the implementation that handles the >360 case the block exists to warn about is unverified. Adding `expect(effectiveObliquityDegreesOf(4924.2)).toBeCloseTo(64.21, 2)` and one input past 180 closes both.

## 5. `expectedEffectiveObliquity` is character-identical to the implementation, and its docstring claims it is not

`tests/port-condition-contract.test.js:775-787`:

> "Effective obliquity, **recomputed here from the physics rather than imported, so this file is an independent check on the adapter and not a restatement of it.**"

```js
// test :783-786                          // impl conditionFromPlanet.js:184-187
let t = Math.abs(deg) % 360;              let t = Math.abs(tiltDegrees) % 360;
if (t > 180) t = 360 - t;                 if (t > 180) t = 360 - t;
if (t >  90) t = 180 - t;                 if (t >  90) t = 180 - t;
```

Not imported, but the same three lines. So `'emits exactly the effective obliquity … checked body by body'` (`:819-827`) compares `f(x)` with `f(x)`; what it actually pins is the **order** of the composition (deg conversion first, then fold), which is worth pinning — but the docstring's claim is this codebase's signature shape: entirely true (it isn't an import) and entirely misleading. The gate is not vacuous — the `[0,90]` domain assertion, the consumer non-degeneracy, the two extremes control, and the four Sol retrograde bodies are all genuinely independent. Only this one test is a restatement, and only its docstring oversells.

---

# ADVISORIES

**A. The domain gate proves the VALUE is fit and says nothing about the WIRING, and the mismatch is live.** `frostLatitudeBiasFor` (`:790-794`) calls `deriveUniforms({ …, axialTilt: deg })`. But the condition key is `axialTiltDeg` (`body-condition-vector.js:200`) and `deriveUniforms` reads `d.axialTilt` (`planet-lod-lab-core.js:907`). Nothing maps one to the other — `Planet.js` and `PlanetGenerator.js` do not import `planet-lod-lab-core` at all (grepped: NONE). The gate hand-renames the key. On the day Steps 4/5/8 hand `deriveUniforms` a condition, every body reads `bias 0` again — the exact 267/526 symptom the fold removed, from a different cause, under a green gate. Worth one assertion naming the rename as required-and-missing.

**B. Route-agreement channel 2's S stratum is a tautology *given channel 1*, and it is the S-stratum test that reads as the real gate.** `disagreeingFields` (`:210-213`) compares `bakedOn(rec)` — which `PlanetGenerator` wrote from `conditionFromPlanet(rec)` — against `bakesFrom(conditionFromPlanet(rec))`. Same pure function, same object, so it cannot fail while the bake route derives from the returned record, which is precisely what channel 1 asserts. The header's framing ("channel 2 bites LATER") is right in substance — it bites on a subset-literal regression *combined with* a law reading a widened key — but "S stratum — every generated planet agrees, exactly" is currently a mutation detector for the P-stratum case only.

**C. Channels 1 and 3 cannot see a record mutated between the literal and the adapter call.** `const planetData = {…}; planetData.T_eq = 288; conditionFromPlanet(planetData); planetData.T_eq = T_eq; return planetData;` — channel 1 green (bare identifier, returned), channel 3 green (`T_eq` not in `WIDENED`), channel 2 **red** (bakes read T_eq). But for a key neither in `WIDENED` nor read by the four bakes, all three stay green. This is the same class as the P-stratum defect the file names for `MoonGenerator`; it is not named for the constructor.

**D.** `tests/port-route-agreement.test.js:45` — header says "**WHY FOUR CHANNELS** AND NOT ONE"; there are three.

**E. The citation fence checks 84 refs and leaves 232 unchecked** (PLAN.md alone: 156). Two vacuous constructions: (1) `citationHolds` is `normWs(text).includes(normWs(sym))` with no word boundary, so `foo.js:100 \`d\`` passes on almost any line; (2) wrapping a whole citation in one code span makes `insideSpan` true, `sym` null, and the ref silently drops into the UNCHECKED column — where one more among 232 is invisible. The fence is still a real improvement; both are worth one line each.

**F.** `tests/baseline/known-failures.json` records `"recordedFromCommit": "0af246e"` with no dirty-tree marker (`scripts/test-baseline.mjs:448` is just `gitHead()`), while the numbers it holds (307 files / 4748 tests) are the *working tree's*. Instrument C prints `recorded @: … (dirty tree)`; A does not. A clean checkout of `0af246e` runs Instrument A red against a record that says it came from there.

**G.** PLAN §10's own verification recipe contradicts its escape hatch: it says `git show HEAD:…| wc -l` "must equal" `wc -l`, then permits appending at the end. This edit makes them 654 vs 679. Scope the check to lines 1-655.

**H.** `conditionFromPlanet.js:322` cites ``e1Regime.js:68 `compositionClass` `` — `:68` is `if ((cv.composition?.carbonToOxygen ?? 0) > 1) return 'carbon';`; `compositionClass` is declared at `:66`. Line is right for the content, symbol is not on the line — malformed under the new convention, and invisible for the same reason as finding 1.

**I.** `conditionFromPlanet.js:337` says "`surfaceMaterial.js:335` — **inside** `surfacePaletteOf`". `:335` is inside `surfaceAlbedoOf` (`:323`), which `surfacePaletteOf` calls; the tool's own map says `surfacePaletteOf`'s body is `:304-318`. Substance right, containment claim wrong.

**J. What I could not break — stated because it is the evidence, not the absence of it.**
- **The route unification is genuinely byte-inert.** My own differential, 808 bodies (200 seeds, planets + planet-class moons), old nine-key subset reconstructed off each record vs the whole record: condition keys that differ = `magneticField:808 habitability:808 axialTiltDeg:808` and nothing else; **bodies whose four bakes moved: 0**; control (T_eq×3): **750/808 moved**. The comparator bites and the zero is a fact about the laws. Their 808 and their control figures reproduce exactly.
- **No RNG draw was reordered** by moving the record literal above the adapter call. The only draw inside the literal is `noiseDetail: rng.range(0.3, 0.8)` (`:782`), and everything that crossed it (`conditionFromPlanet`, `surfacePaletteOf`, `icenessOf`, `melt/crustTemperatureOf`, `emissiveBlackbody`, `applyAlbedoTransfer`) is pure and receives no rng. Instrument B green over 221 seeds confirms it independently. Key order is preserved by the placeholder trick, which matters because B fingerprints the record.
- **The zero delta is a true green, not a false one.** I grepped `axialTiltDeg` across `src/`, root modules, `.glsl.js` and `planet-lod-lab.html`: the only non-test hits are the vector's own emission (`body-condition-vector.js:200`) and comments. `deriveConditionVector` uses `fp.axialTilt` for nothing but that passthrough, so the fold cannot move a sibling key either.
- **The fold's maths is right on every hard case**, checked against the consumer: 0→0, −0→+0, 90→1.000, 90.001→0.99999, 180→0, 270→1.000, 360/540/720→0, −85.32→0.948, 177.6→0.0267, ±4924.2→0.7133, NaN→NaN (loud, as argued), undefined/null→undefined→0, Infinity→NaN (louder than the old Infinity→clamp 1; undocumented improvement), `'0.41'`→0.0046.
- **The population is real.** `planets` comes from `StarSystemGenerator.generate(seed).planets[].planetData` (`:387-395`), 120 seeds, 526 bodies; Sol via `generateSolarSystem()` used only for pure-function math on real records, which is the one thing Sol is legitimate for. The CONTROL at `:797-808` asserts the input spread (≥20% negative, >90% distinct) *before* the output domain, so the gate cannot go green by the generator changing.
- **The frozen legacy vector is a faithful copy.** Diffed `legacyDeriveConditionVector` (`:169-192`) against `git show b2ac455:body-condition-vector.js` — every key, every `??` operand, every helper call matches. The residual (shared `bodyShellThickness`/`bodyRawTidal`/`bodySurfaceGravity`/`compositionClass`/`gravityRadiusRatio`) is named at `:114-120` and closed by `PRE_STEP1_VECTOR_GOLDEN`, whose seven fixtures pin every scalar those helpers feed and whose degeneracy CONTROL (`:504`) is what makes the `* 2` injection catchable.
- **Instruments all green, run by me:** A `files 307 (2 failing, 15 non-collecting) · tests 4748 (24 failed, 4720 passed, 4 skipped)`, identical to baseline; B 8/8; C `55 uniforms × 526 bodies, 0 moved`; citations `84 checked, 0 broken, self-control PASS`. Failed-file identity unchanged (15 vendor + ProcgenSnapshot + componentSystems.byteSafety).
- Spot-checked **23** corrected refs by opening the files — `Planet.js:1602/1603/1604/1609/1610/1611/1612/1617/1618/1627/1628/1629/1631/1643/1655/1657/1662/1548/1519/1527/1530/692/769/785/1596`, `surfaceMaterial.js:231/304`, `planet-lod-uniforms.js:57/58/59/60/278`, `planet-lod-height.glsl.js:23`, `PlanetGenerator.js:448/449/490/503/516/526/539/560/587/687`, `body-identity-fence.test.js:173`, `main.js:6197`, `body-condition-vector.js:107`, and PLAN.md `46/86/156/176/177/182/189/190/191/192/193/212/396/548/549/553/581/605`. All resolve. PLAN.md's §1-§4 edits are line-count-neutral (`@@ -17,13 +17,13 @@` … `@@ -169,28 +169,28 @@`), so no downstream `PLAN.md:NNN` ref was silently re-pointed.

---

# VERDICT

**SOUND_WITH_FIXES**

The four substantive fixes are correct where it counts. The obliquity fold is mathematically right on every case I could construct, folds at the producer for a stated and defensible reason, keeps the retrograde bit on the record it came from, and deliberately leaves the reader unguarded so the consumer half of the gate keeps a subject. The route unification is a genuine one-constructor collapse and I proved it byte-inert independently, with a control. The provenance fence really does compare the adapter's code against a declaration and its CONTROL really does bite. Nothing moved a pixel or a draw, and the zero is a true zero because nothing reads the key.

What the fixes broke or missed, in order of how far it propagates:

1. **The provenance fence's five bypasses (#3)** — Step 2 is next and its own declared read can be written past the fence in five ways, one of which is the file's existing idiom.
2. **The fold's untested branches (#4)** — two of four lines, and the untested pair is exactly the corrupt-input path the block warns about; the warning test checks the test's copy.
3. **Citation fence scope (#1)** — the two densest, fastest-churning carriers of the port's reasoning are outside `CITE_SOURCES`, and one of them is broken right now by this round's own edit.
4. **The four rotted bake-block refs (#2)**, one of which breaks §10 the round §10 was written.
5. **`expectedEffectiveObliquity`'s independence claim (#5)** — one docstring sentence, but it is the sentence a future reader will trust when deciding whether the fold has a second witness.
