# Review record — camera API + pack registration (range `0ad659c..29bb284`)

**Date:** 2026-08-11 · **Reviewed at:** `29bb284`, tracked tree clean, four instruments green,
399 citations resolve.

Max's ask: *"first thing is a code review for bugs / architecture review for making sure everything's
getting wired up in the most efficient/repeatable way"* — run as two passes because they ask
different questions.

**Method.** 6 finders on disjoint surfaces, each paired with an adversarial verifier whose first
question was "is this a DECLARED LIMIT documented in place?" — because reviews on this repo have
twice filed a deliberate documented limit as a defect. 24 raw findings → 13 survived verification,
+9 the verifiers caught that their finders missed. Verifiers were told to default to REFUTED when
uncertain.

⚠ **Coverage gap in this record, stated rather than discovered later.** The run hit an account limit
with 7 of 18 agents unfinished: the polarDeck/limbDeck verifier and all five architecture judges.
Those were re-done by hand in the main thread, which means the architecture section below rests on
direct measurement but **not** on the adversarial second pass the bug section got. Treat Pass B's
numbers as measured and its *judgements* as single-pass.

---

## PASS A — defects, ranked

### 1. HIGH · the camera API is blind to `uReliefOctaves` at the shipped default
`src/camera/agentFraming.js:98` (`lodStateOf`), surfacing in both front-ends' sweep captions.

`lodStateOf` reads only `uOctaves`. With the 6e flag at its **shipped default (off)**, an ordinary
game planet is LODManager-registered and driven through the identical `autoOctaves(lodRampOf(d))`
law — but under `uReliefOctaves`. The API reports `live.octaves: null` and emits the note *"this body
carries no uOctaves uniform — it does not render through the LOD-driven path at all"*, which is
**false for that body class**, plus a `saturatedNote` asserting a distance it did not measure.

This is the `11d1962` correction — *"at the shipped default the same gas giant has 71 uniforms and no
`uOctaves`; it ramps `uReliefOctaves` 4→9 instead"* — not having been propagated into the new module. ⛔ **THE FINGERPRINT MOVED — 71 → 72 AT B2P, 2026-08-20.** `uPosterizeLevels` joined the game material (src/rendering/posterizeLevels.js:55 `export const POSTERIZE_QUANTUM = { value: new THREE.Vector2(6.0, Math.fround(1 / 6)) };` — ⚠ **the GAME slot, re-pointed 2026-08-20.** This sentence used to cite posterizeLevels.js:45 `export const POSTERIZE_LEVELS = { value: 6.0 };`, which is still live and still resolves, but is the LAB material's SCALAR bound to `uniform float uLevels`; the game material's `uPosterizeLevels` holds the vec2 at :55. The citation fence validates the quoted line TEXT, not the attribution, so it stayed green through the wrong one), so a body ON THE GAME MATERIAL now reports **72** uniforms and 71 identifies nothing. 71 was correct the day this line was measured; it is kept, annotated, rather than rewritten. Debug against `isLabPlanetMaterial` — a boolean cannot drift with the next uniform.
Two independent verifiers confirmed it from different surfaces.

**Why it ranks first:** the API exists to answer Max's approach criterion, and at the default it
answers it wrongly for every body not yet on the pipeline — which is 41 of 50.

### 2. HIGH · `frameSequence` re-enables the per-frame ORRERY body tracker
`src/camera/agentFraming.js:146` → `src/main.js:12348`.

Clearing `cameraController.bypassed` (step 1 of the documented four-step ordering) re-enables
simStep's per-frame camera-tracking block. If any body is focused (`focusIndex >= 0`) and it is not
the body being framed, the camera is silently re-targeted onto the **focused** body during the two
rAF that `frameBody` awaits — and the measurement is then taken there and reported `ok: true`.

Found independently by two verifiers. The four-step ordering comment is correct about what it does
and silent about this interaction.

### 3. HIGH · the lab's `frameBody` converts radii through a stale `sVis`
`planet-lod-lab.html:~5634`.

`sVis` is written **only** inside `frame()`. Any radius change made since the last render makes the
requested body-radii convert to the wrong absolute `state.distance`. The game side has no equivalent
staleness. This is a cross-front-end divergence in the one API built to make the two comparable.

### 4. MEDIUM · three places still assert a near-clamp this commit range measured as absent
`src/camera/agentFraming.js:66`, `src/main.js:3371-3373`, and the `clampNote` string at `:3437`.

The "the game holds a zoom floor just above the surface" premise was **measured absent on the
`focusOn` path** in this very range (contract AC-2 amendment, `34046f4`). The absence is declared and
deliberately left as a finding for Max — so this is documentation drift, not a logic bug. But the
consequence is live: when `clampedFromAsk` fires, `clampNote` names a cause that does not exist.

⭐ Related and **not** covered by the amendment: `frameBody` captures `worldPos`/`worldRadius` *before*
awaiting two frames and measures against a freshly-read position. A body that moves in orbit during
those frames trips `clampedFromAsk` and gets reported as a clamp. Unverified — I could not construct
the orbital speed at 1.2 radii without a live run.

### 5. MEDIUM · the lab's sweep drops the caption that explains its own nulls
`planet-lod-lab.html` `approachSweep`.

It drops `shot.lod.note` from its rows and carries no aggregate. With `octAuto` OFF it returns
`lodAgrees: null` at every rung **and** a confident `saturatedNote` — the exact shape of a result
that is true and misleading.

### 6. MEDIUM · the parity ledger contradicts its own table, and it is a TEST INPUT
`docs/FEATURES/step6-parity-ledger.md` — parsed by `tests/material-parity-list.test.js`.

- §7 "What is open for Max" still lists **P-04 as blocking**; the same document's table now rules it
  `carried`.
- §0's headline table — introduced as *"Three measured numbers say more than the forty rows below"* —
  still says **16 of 356** varying; the registration commit measured 26.
- P-13's evidence cell enumerates the 16 by name, an enumeration registration invalidated.

The parser checks the `ruling` column for membership in `{carried, accepted-loss, blocking}` only, so
none of this reddens. See Pass B §3.

### 7. LOW–MEDIUM · `LIMB_STRENGTH_WITH_AIR` is pinned to a literal, not to its producer
`src/worldengine/drivers/limbDeck.js:84`, `tests/driver-pack-limbdeck.test.js:314`.

The constant is declared as a transcription of `planet-lod-lab-core.js:1043
`limbStrength: hasAtmo ? 0.7 : 0.0,``, but the assertion is `expect(LIMB_STRENGTH_WITH_AIR).toBe(0.7)`
— self-referential. No test reads the lab file.

**Verified mitigation the finder missed:** the citation on `limbDeck.js:83` quotes the producer's
line text verbatim and **is** in the fence's checked column, so retuning `0.7` on the lab side breaks
the citation and `check:instruments` goes red. The fence protects this, the test does not. Severity
is low *given the fence* — and that is a dependency worth knowing, because it is exactly what §8
below shows is not universal.

### 8. LOW · `check:instruments` green does not mean the new packs' citations are right
Measured: `polarDeck.js` carries **5 unchecked refs**, `limbDeck.js` **1**. One of them —
`polarDeck.js:57` citing `planet-lod-lab.html:5174` — is **wrong by 26 lines**; the quoted
`uniforms.uPolarStrength.value = …` line is at `:5200`. The fence prints *"all 399 symbol-anchored
citations resolve. Exit 0."*

Two of the five are explained: lines 17 and 89 carry **two** backtick spans, so the strict parser
cannot tell which is the symbol. I did **not** isolate the parser's reason for the other three, which
are single-span, even-backtick lines that should have been checkable.

Also: `step6-parity-ledger.md:114` cites `src/main.js:11027`; the symbol is at `:11208`.

### 9. LOW · gates that pass while asserting less than they claim
- `tests/agent-camera-api.test.js:240` — the `setCameraPose` AC-6 gate asserts `resync` appears
  **anywhere** in the body, while the file's own header (lines 15-21) declares misplaced resync
  *worse* than absent and says the assertion is on ORDER. The sibling `frameSequence` gate does
  assert order.
- The `frameBody` half of the 6e-flag gate never names `labGasBodies` or `flagDefault` — both fields
  can be deleted from the returned `pipeline` block with **all four assertions green** (verifier ran
  it: 4/4 survive). This is the handoff's trap #2 recurring in the same file.
- `tests/driver-pack-polardeck.test.js:529` — the identity gate runs all 120 bodies at a hardcoded
  `macroSeed: 4242`, so `uPolarPole` takes exactly **one** value across the slice. The
  driver→pole-field mapping gets no per-body evidence.
- The uniform-collision throw at `index.js:213-219` has **no executed control**: disabling it leaves
  all seven `applyDriverPacks` suites green. (Carries IDX-165 — see Open items.)

### 10. LOW · remainder
Reentrancy: `frameBody`/`approachSweep` hold no single-flight lock while awaiting two rAFs and mutate
a shared controller — two overlapping calls return two `ok:true` tables of mutually corrupted numbers.
`bypassed` is cleared and never restored, with no mode guard, so a console call during HELM leaves the
HUD in a mixed state. Neither front-end times out the rAF wait, so on a non-animating page the promise
never settles. The lab's `frameBody` writes `state.pitch` with no clamp, bypassing `PITCH_LIMIT`.
`index.js:7` still argues from *"today it iterates an array of length one"* — falsified by the same
commit that edited it. `limbDeck.js` and `polarDeck.js` both title themselves "DRIVER PACK #2".

### Refuted — recorded so they are not re-filed
- The `_wp`/`_scl` module scratch vectors in `agentFraming.js` are safe: no await, no user callback,
  no yield between write and read; `_wp` is cloned and `_scl` is collapsed to a local before return;
  the lab does not import the module.
- `worldRadius` cannot reach 0 — `bodyRadiusOf` returns 1.0 for degenerate geometry, documented.
- `else if (predicted)` is not a latent falsy-prediction bug — `lodPredictionAt` always returns an
  object literal.
- `attributes` collision via `in` matching `Object.prototype` keys — no reachable pack name collides,
  and the failure would be a loud construction-time throw.
- The `pipeline` block does not misreport: all four fields are live reads.

---

## PASS B — architecture, against §5's yardstick

§5 states the checkable claim: **files a future migration must hand-edit 7 → 3, judgement calls
4 → 0**, plus its own qualification — *"If it is not 3, the fence has a hole and the hole is the next
piece of work."*

### 1. Is pack #4 one import + one array element? — **No. Measured ~8, matching registration's cost.**
26 files name a pack. Setting aside each pack's own module + test file (irreducible) and pure docs,
the **shared** sites a 4th pack must touch: `drivers/index.js` (the 1 import + 1 entry §5 promises),
`tools/port-uniform-delta.mjs` `CITE_SOURCES` (a hardcoded file list), `tests/gas-body-lab-material.test.js`,
`tests/pack-contract.test.js`, `tests/material-parity-list.test.js`, `tests/lab-surface-ratchet.test.js`
+ `tests/fixtures/lab-surface-baseline.mjs`, `planet-lod-lab.html` (the import-back), and
`step6-parity-ledger.md`.

That is ~8, consistent with the 8 the last session measured — and with the pack's own test file
having instructed 3. **§5's own rule fires: the count is not 3, so the fence has a hole.**

The reducible ones are specific: `CITE_SOURCES` could glob `src/worldengine/drivers/*.js` instead of
listing files, and the fences that hardcode pack names could read `PACKS`. That would take ~8 to ~4.

### 2. Do the three mount sites still exist? — **There is only ONE call site, and Step 10 breaks it.**
`applyDriverPacks` has exactly one production caller: `src/objects/Planet.js:2030`. Not three.

The array's claim therefore **holds for Step 9** — rocky planets reach `_createSurface` by the same
two routes gas planets do, so a rocky pack really is one entry.

It **does not hold for Step 10**, and the code says so in its own words at `Planet.js:2120-2125`: a
plain moon carries neither provenance stamp (`MoonGenerator` emits no `_systemSeed`; most Sol moons
have no `profileId`), so *"on the day Step 10 routes plain moons through `BodyRenderer.createMoon`,
THIS FUNCTION WOULD ADMIT SOL'S MOONS."* Named hole, pinned by a test. `Planet.js:2087-2092` adds
that the single-admission-test property holds *"by luck"* today.

**So Steps 9 and 10 are not symmetric, and the plan treats them as if they were.** Step 10 needs a
provenance stamp on plain moons *before* it can be one array entry — and `src/objects/Moon.js` is
still a third renderer.

### 3. The ledger as a test input — **a trap, and it fired this session.**
`material-parity-list.test.js` validates the `ruling` column for *membership* in a legal set, not for
agreement with what the subjects measured. So a ruling can move between two legal values with no
assertion change — which is what happened, and §6 above is the consequence: three places in the
document now contradict its own table while the suite stays green.

Cheapest hardening that keeps the coupling: a **floor assertion** (minimum parsed row count, so a
regex that silently matches zero rows reddens) plus generating §0's headline numbers and §7's open
list *from* the table rather than hand-writing them beside it.

### 4. The citation tax — **real, and the fence's green is weaker than it reads.**
399 checked; 6 unchecked in the two newly-registered packs; one provably wrong. Every commit that
adds lines to a scanned file breaks refs into it, and repair took three throwaway scripts.

The fence already resolves a symbol as a token, so it already knows how to *find* the right line — a
`--repair` mode is a small addition to something that exists. But the higher-value change is cheaper:
make **UNCHECKED a shrink-only ratchet**, the mechanism this repo already uses in §5. Today an
unresolvable ref silently joins a pile of hundreds; under a ratchet, adding one fails the build. That
converts the fence's "399 resolve" from a number into a guarantee.

### 5. Is the shape right for Steps 9 and 10? — **Shaped for 9, fighting 10.**
9 of 50 bodies (18%) render through the pipeline. Step 9 is genuinely close: the predicate is already
condition-derived, `compositionClass` already distinguishes rocky, and the single mount site serves
rocky planets. Step 10 has three named obstacles ahead of it — the Sol-moon admission hole above,
`Moon.js` as an unported third renderer, and the second mount site (`BodyRenderer.createMoon`) that
would become the array's second consumer.

---

---

## Live measurement, 2026-08-11 after the fixes — what actually resolves on approach

Taken with the repaired `_lab.frameBody` at 8 body radii over every body in
`lab-procedural-6` (`PVX J3DK6GAO+RBJGI5M`, 16 bodies). This is Max's approach criterion
measured per body, which the API could not do before defect 1 was fixed.

| class | n | octave uniform | live vs predicted |
|---|---|---|---|
| planets on the lab material | 4 | `uOctaves` | agree — 8.72 / 8.72 |
| planets on the legacy material | 2 | `uReliefOctaves` | agree — 8.72 / 8.72 |
| **plain moons** | **9** | **NONE** | **no octave uniform at all** |
| **planet-class moon** (`Al`) | **1** | `uReliefOctaves` | **4.00 vs 8.72 — frozen** |

⭐ **This splits Goal A into two unequal halves, and the split is not what the 18% coverage
number suggests.**

- **All 6 planets already resolve detail correctly on approach**, including the two still on
  the legacy shader. Step 9 changes how rocky planets LOOK; it does not change whether they
  resolve. The 20 rocky planets in the 5-system count are in this category.
- **The 9 plain moons carry no octave uniform whatsoever** — `Moon.js`'s generic-simplex
  shader, confirming it as an unported third renderer. These bodies do not resolve detail on
  approach AT ALL, at any distance. **Step 10 is where Max's criterion actually lives.**
- **`Al` is a planet-class moon and is the documented signature firing live**: it HAS the
  uniform and is pinned at the 4.0 constructed default because its branch never registers it
  with LODManager. Small, independent of the pipeline, fixable without Steps 9–12.

⚠ **A correction to an earlier claim in this session.** `Paurosgara` was first reported at
4.00 octaves and `agrees: false`; re-measured it reads 8.72 and agrees. The first sample was
taken on the body's first frame, before LODManager had run — the instrument, not the code.
It is NOT a defect and should not be carried as one.

### Post-fix verification (`8c0958b`), live, after a full page reload

| body | class | before | after |
|---|---|---|---|
| `Al` (p5 m2) | planet-class moon | 4.00 vs 8.72 — **frozen** | **8.723 / 8.723 agree** |
| `…e V` (p3 m4) | planet-class moon | 4.00 vs 8.72 — **frozen** | **8.723 / 8.723 agree** |
| `En` (p3 m0) | plain moon | no octave uniform | no octave uniform (Step 10) |
| `…g` (p5) | planet | 8.723 agree | 8.723 agree (control, unmoved) |

⚠ **The same first-frame trap fired a third time and is worth naming as a standing hazard, not an
anecdote.** `…e V` read 4.00 on its first probe after the reload and 8.723 on three stable samples
afterwards. LODManager has not run for a body on the frame it is first framed at. **Any octave
reading taken from a body's first framing is meaningless — sample twice.** This has now produced a
wrong conclusion once (`Paurosgara`, retracted above) and a wrong near-conclusion once.

## Recommendation

Fix **1, 2, 3** before real Step 7 (the `src/` module move): all three make the camera API report
confident wrong numbers, and Step 7 is when that API becomes the way the move is verified. **4, 5, 6**
are cheap and in the same files. The rest carry.

The architecture answer to Max's question: the wiring is repeatable **for Step 9** and not yet for
Step 10, and the gap between §5's promised 3 edit sites and the measured 8 is concentrated in
hardcoded lists that could read `PACKS` instead.
