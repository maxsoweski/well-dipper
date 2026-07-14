# V2-4 BUILD-PLAN — Shared-substrate pass (was #5.5), all five fields

**Workstream:** `world-engine-v2-4-substrate-2026-07-14` · **Plan written:** 2026-07-14
**Branch:** `feature/world-engine-production-L1` · **Builds in the MAIN checkout** (`~/projects/well-dipper`, L1), concurrent with the atmosphere lane (separate worktree, `:5178`).
**Binds to:** `contract.json` (all 10 ACs + 10 designDecisions are BINDING; the AC-ZERO-CLOBBER(e) diff fence is absolute) + `intent.md` + `~/briefings/grounding-v2-4-substrate-2026-07-14.md`.
**Mold:** `world-engine-v2-7d-lid-disruption-2026-07-12/` (GROUNDING §2 + BUILD-PLAN) — family module, byte-exact dual-run, own suite, zero production wiring.
**Deviations from this plan are recorded in `## §11 Build deviations`, never silent.**

---

## §0 — Global invariants (apply to EVERY slice)

**Byte regime.** `HASHED_FIELDS = ['height','grainAngle','grainMag','regime','faultDensity']` (`tests/fixtures/v2-0-carrier-golden.mjs:54`). The 75-golden hashes only these five, over 15 presets × seeds {1,2,3,7,42}, and **bypasses `route()` entirely** (it calls `writeBodyRelief` directly — `planet-lod-rivers.js:1241` comment). The lid byte-anchors (`tests/worldengine-lid-byte-anchors.test.js`) do full-`Float32Array` equality on `height`/`faultDensity`/`grainAngle` at MAGMA_REF/Lava/Magma/Venus. **Two mechanical facts make every V2-4 channel byte-inert:** (1) new typed arrays on the carrier are outside `HASHED_FIELDS` and are never compared by the anchors (which read named arrays, not the whole object); (2) `alea` streams are independent by seed-string, so drawing a new `'margin:'`/`'province:'` stream cannot perturb any existing `'plates:*'`/`'shell:*'`/`'stagnant:*'`/`'e6:*'` sequence — byte-identity breaks **only** by writing a hashed field or reordering draws *within* an existing stream, neither of which any slice does.

**Alea namespaces (pinned here per designDecision #8/#DETERMINISM).** `'margin:'+seed` (margin slice), `'province:'+seed` (province slice, reserved — used only if a contiguity tie-break needs entropy; the derivation is field-deterministic first). `accommodation`/`sediment`/`figure` are **RNG-free** (pure functions of existing fields/drivers) — no namespace consumed. No `Math.random`, no `Date.now`, no while-to-convergence; bounded fixed relax passes only.

**Atmosphere fence (designDecision #CONCURRENCY-FENCE + AC-ZERO-CLOBBER d/e).** V2-4 NEVER edits `climate-e5.js`, `emission-e.js`, the storm/band sections of the render mega-files, or `planet-lod-uniforms.js` storm blocks. Lab edits (province overlay + any margin GUI) stay in **ground-owned** sections of `planet-lod-lab.html` — never the atmo vertex attributes (`aBand`/`aShear`/`aMush` at `:200-206`), `zonalBandCol`, or `uStorm*`. Atmosphere suites (`worldengine-base-climate-e5`, `worldengine-base-emission-e`) must pass unchanged.

**Not-ours dirty files (mustStayWorking).** `src/auto/CameraChoreographer.js`, `src/debug/LabMode.js` are already `M` in the tree and the `F13-*.png`/`F15-*.png`/… are untracked — **excluded from every commit** (`git add` only the fence's explicit paths; verify with `git show --stat`).

**Test discipline.** `npx vitest run` **FROM THE REPO DIR ONLY** (`cd ~/projects/well-dipper`). Every touched test file must collect+run nonzero tests. Full-suite baseline = **4-failed / 17-files** (pre-existing; do not "fix"). Agents run only their slice's new suites + `tests/planet-archetypes.test.js` during build; working-Claude runs the full AC-ZERO-CLOBBER gate at each commit.

**Concurrency (WSL OOM rule + agents-commit-nothing).** Build workflows opus-pinned, ≤2-3 concurrent agents, staggered against the atmo lane. **Agents commit NOTHING** — working-Claude is the serialization point and commits at each slice boundary AFTER the gate is green.

**New carrier channels (summary — parity on BOTH `makeSphereField` and `makeSubstrate`):**
| Channel | Type | Slice | Writer | Reads |
|---|---|---|---|---|
| `sediment` | Float32Array | 1 | zero-init host (documented deposit seam) | — (V2-8 writes) |
| `accommodation` | Float32Array [0,1] | 1 | `writeAccommodation` (sink-ranking) | `height` |
| `shelfDepth` | Float32Array | 3 | `writePassiveMargins` | plateDiag (`plateType`/`boundaryClass`/`boundaryDist`/`baseElevField`) |
| `province` | Uint8Array {0,1,2} | 4 | `writeProvince` | `faultDensity`/`grainMag`/`accommodation` |

The figure descriptor is **NOT a carrier channel** — it is a small object on the `writeBodyRelief` return (`relief.figure`). The E9 reserves (`baseLevel`/`standing`/`maturity`) stay allocated-and-unwritten; `shellRelief`'s `'shell:axis:'` w0 stays sibling-local, untouched.

---

## §1 — SLICE 1: Host channels (b) → AC-CHANNELS, AC-0(2), AC-DOCS(partial)

**Files touched:** `src/worldengine/base/sphereField.js` (add 2 arrays to the returned object, after `faultDensity`/before or beside the E9 reserves — keep the reserves distinct), `src/worldengine/base/substrate.js` (parity: same 2 arrays on `makeSubstrate`).
**New file:** `src/worldengine/base/hostChannels.js` — the accommodation sink-ranking writer + the sediment host initializer + the documented V2-8 seam comment.

**Mechanism.**
- `sphereField.js:11-21` return literal gains `sediment: new Float32Array(count)` and `accommodation: new Float32Array(count)`. `substrate.js:8-19` gains the identical two. These are **NEW** arrays — explicitly not aliases of `maturity`/`baseLevel` (asserted by AC-CHANNELS identity test: `carrier.sediment !== carrier.maturity`, distinct object identity + independent mutation).
- `hostChannels.js` exports:
  - `writeAccommodation(carrier, { datum = null } = {})` — **sink-ranking, non-volumetric.** For each node `i`: `accommodation[i] = clamp01((refDatum − height[i]) / DEPTH_SCALE)`, where `refDatum` is a low-percentile reference (default: the 60th-percentile height, or a passed `datum`) and `DEPTH_SCALE` normalizes the deepest expected basin to 1. **This is a RANKING of where deposition would go (deeper below datum ⇒ higher accommodation), NOT a mass/volume computation** — the assert for AC-CHANNELS greps this file for the absence of any `*=`-into-a-volume / `Σ mass` term and checks `accommodation ∈ [0,1]` across presets×seeds. Pure (reads only `height`, `count`); works on sphere OR grid (index-based, no adjacency).
  - `initSedimentHost(carrier)` — zero-fills `sediment` (pristine bedrock; V2-4 does **not** deposit — that is V2-8's job, a documented non-goal). Exists so the host is a defined, readable channel with an explicit owner, not an accidental reserve. Carries a `// V2-8 SEAM:` comment naming exactly where deposition will write.
- **Call site:** in `writeBodyRelief`'s condition-bearing branch (`planet-lod-rivers.js:429-521`), after the relief writer resolves `carrier.height`, call `writeAccommodation(carrier)` then `initSedimentHost(carrier)` **once**, before the return. (accommodation needs the finished `height`.) Both run on every path — the host is universal, not plate-only.

**Tests added** (`tests/worldengine-v2-4-host-channels.test.js`):
- AC-CHANNELS: both carriers expose `sediment`+`accommodation`; distinct object identity from `maturity`/`baseLevel` (not-aliased); `accommodation ∈ [0,1]` across presets×seeds; grep-assert the writer is sink-ranking (no volumetric term). *(→ AC-CHANNELS observable "Channels present on both carriers, distinct from E9 reserves; accommodation ∈ [0,1]".)*
- AC-CHANNELS stub: a V2-8-shaped mock reads `accommodation` to rank sinks and writes into `sediment` at the documented seam — asserts clean read/write without new plumbing. *(→ "stub reads clean".)*
- AC-0(2): named-consumer table row present in the conformance grep.

**Byte-safety.** Which of the 5 hashed fields could move? **None.** `writeAccommodation` READS `height` and writes only `accommodation` (unhashed); `initSedimentHost` writes only `sediment` (unhashed). No new alea draw. 75-golden + lid-anchors green unchanged. *(Verify: golden + anchors in the gate.)*

**Commit boundary → COMMIT 1** `V2-4 slice-1: sediment/accommodation host channels (byte-inert, sink-ranking)`.

---

## §2 — SLICE 2: SP-STRESS-FABRIC extraction (d) → AC-FABRIC, AC-ZERO-CLOBBER(a/b)

**Files touched:** `src/worldengine/base/tectonic.js` (delete private `steeredNoise3` at `:93-116`; import from the new module; adapt the `:173` call site — see below), `src/worldengine/base/shellRelief.js` (delete copy `:185-204`; import; call site `:382` unchanged — already `ridged`-form), `src/worldengine/base/mixedInterior.js` (delete copy `:91-110`; import; call sites `:373-374` unchanged), `src/worldengine/base/stagnantLid.js` (delete copy `:184-203`; import; call sites `:356-357` unchanged).
**New file:** `src/worldengine/base/stressFabric.js` — the one owned copy.

**Mechanism.** The four copies are byte-verbatim EXCEPT the final ternary is written two ways that are **arithmetically identical**:
- tectonic canonical (`:115`): `regime === REGIME.NORMAL ? Math.abs(nVal) - 0.5 : 0.5 - Math.abs(nVal)`.
- the other three (`ridged`-form): `ridged ? (0.5 - Math.abs(nVal)) : (Math.abs(nVal) - 0.5)`.

`stressFabric.js` exports the **`ridged`-boolean canonical form** (the shellRelief text, verbatim):
```
export function steeredNoise3(noise3, dir, east, north, angle, ridged, freq, sign = +1) { … return ridged ? (0.5 - Math.abs(nVal)) : (Math.abs(nVal) - 0.5); }
```
Three-free, imports **nothing** (pure; the `noise3` sampler is passed in). Call-site adaptation:
- `shellRelief`/`mixedInterior`/`stagnantLid`: already pass a boolean `ridged` → **import + delete copy, calls unchanged**, byte-identical by construction.
- `tectonic.js:173`: change the 6th arg from `carrier.regime[i]` to `carrier.regime[i] !== REGIME.NORMAL` (REGIME already imported at `tectonic.js:4`). Byte-identical: `regime===NORMAL` ⇒ `ridged=false` ⇒ `Math.abs(nVal)-0.5` (== old NORMAL branch); `regime!==NORMAL` ⇒ `ridged=true` ⇒ `0.5-Math.abs(nVal)` (== old else branch). Same FP, same order.

**Extraction scope is `steeredNoise3` ONLY** — the per-file `randDir`/`geodesicPointToArc`/`meanEdgeAngleOf` copies are out of scope (keep the diff tight; they are not the contract's fabric).

**Tests added** (`tests/worldengine-v2-4-stress-fabric.test.js`) — the V2-7d dual-run mold:
- **Function-level dual-run:** the test embeds the pre-extraction `steeredNoise3_ref` (both ternary forms) verbatim and asserts `stressFabric.steeredNoise3(...) === ref(...)` bit-for-bit across a swept battery {sign ±1} × {ridged T/F} × {angle grid} × {freq grid} × {random-but-fixed dirs/frames}. This is the within-run byte proof. *(→ AC-FABRIC "Bit-equality at all four call sites".)*
- **Writer-level equality for mixedInterior** (NOT covered by the 75-golden — it is lab-only): run the real mixedInterior tessera path on the test mesh post-extraction and compare `carrier.height`/`grainAngle` against a committed reference array captured from HEAD pre-extraction (fixture under this workstream's `calibration/`). The other three writers are covered by the goldens/anchors below.
- Module validation suite: throws-free, pure, three-free (import grep).

**Byte-safety.** Which hashed fields could move? Potentially all five *if* the extraction were not FP-identical — so the proof is layered: (1) function-level dual-run proves the extracted function is bit-identical; (2) the **75-golden** covers tectonic (`writeHeightSphere` grain on despun rows) + shellRelief (icy-active shell rows); (3) the **lid byte-anchors** cover stagnantLid (Venus, AC-BYTE-STRONG-REF); (4) the mixedInterior fixture covers the one writer absent from both. All four call sites pinned. *(Verify: new dual-run suite + goldens + anchors in the gate.)*

**Commit boundary → COMMIT 2** `V2-4 slice-2: SP-STRESS-FABRIC extraction (steeredNoise3, byte-exact ×4)`.

---

## §3 — SLICE 3: Passive margins (a) → AC-MARGIN(a/b/c/d), AC-0, AC-LAB(a), AC-UAT(1)

**Files touched:** `src/worldengine/base/sphereField.js` + `substrate.js` (add `shelfDepth: new Float32Array(count)` parity), `planet-lod-rivers.js` (the render composite seam in `route()`), optionally `planet-lod-lab.html` ground-owned section only if a margin GUI knob is wanted (probe is enough for AC-LAB).
**New file:** `src/worldengine/base/passiveMargins.js` — the margin channel writer.

**Passive-margin selection predicate.** The plate writer already returns everything needed (`plates.js:370-373` diag: `plateType`[per-plate], `plateId`/`boundaryClass`/`boundaryStress`/`boundaryDist`/`baseElevField`[per-node]). A **passive margin** = a continent↔ocean transition that is NOT an active plate-motion boundary:
- **continentality per node** `cont[i] = plateType[plateId[i]]` (1 continental / 0 oceanic).
- **transition detection:** node `i` is on a margin if any `adj` neighbor `j` has `cont[j] !== cont[i]` (the continent/ocean edge), OR `baseElevField` crosses the continental/oceanic step within a neighbor hop.
- **passive filter:** the transition is passive when `nearStress`/`boundaryStress` in the local belt ≈ 0, i.e. it is NOT `CONVERGENT`/`DIVERGENT`/`TRANSFORM` with meaningful stress (predicate: `|boundaryStress[i]| < PASSIVE_STRESS_MAX` AND the belt-weighted `nearStress` below the same floor). Active margins (Andes-type subduction, rifts) **keep their existing `plates.js` convergent/divergent relief untouched** — margins fire ONLY at passive transitions.

**Own-channel write (shelf → break → slope → rise).** `writePassiveMargins(carrier, plateDiag, bodyDrivers, { macroSeed })` writes `carrier.shelfDepth` as a **signed morphology profile parameterized by geodesic distance `s` from the shoreline** (signed: seaward positive), zero everywhere except the passive-margin belt:
- **shelf** (`0 ≤ s < SHELF_W`): shallow near-flat depression below the coastal datum, depth ramping to the shelf-break value.
- **shelf-break** (`s ≈ SHELF_W`): the steep inflection (`BREAK_DZ`).
- **slope** (`SHELF_W ≤ s < SHELF_W+SLOPE_W`): steep descent at `SLOPE_GRAD`.
- **rise** (`SHELF_W+SLOPE_W ≤ s < SHELF_W+SLOPE_W+RISE_W`): flattening tail into the abyssal datum.
Shoreline distance `s` = geodesic distance to the nearest continent/ocean transition node (a bounded multi-source BFS from the transition set × `meanEdgeAngle`, the `plates.js:317-334` idiom — O(N) queue drain, not convergence). Along-coast character jitter draws from `alea('margin:'+seed)` (bounded, one stream). **v1 scale anchors as starting constants** (converted to carrier units in §6): `SHELF_W` ~0.5° (≈0.0087 rad), `BREAK_DZ` ~140 m, `SLOPE_GRAD` ~3°, `RISE_W` ~500 km — the km/m anchors map to fractions of the continent/ocean normalized step (`BASE_CONT−BASE_OCEAN = 0.26`) and the angular anchors map directly to geodesic radians (resolution-independent, like `BELT_RADIANS`).

**Render composite seam (WITHOUT touching `carrier.height`).** In `route()` (`planet-lod-rivers.js:1230` onward), after `writeBodyRelief` and BEFORE the height consumers:
```
const composited = compositeMargins(carrier);   // = carrier.height with shelfDepth added where nonzero; NEW Float32Array
```
Then feed `composited` to BOTH consumers that today read `carrier.height`: the router height re-point (`:1274` `height = carrier.height` → `height = composited`) and the height-cube bake (`:1303` `bakeHeightCube({ height: carrier.height … })` → `{ height: composited … }`). **`carrier.height` is never mutated** — the composite is a `route()`-local array, and the 75-golden bypasses `route()`, so the golden captures the untouched `carrier.height`. This is the whole own-channel discipline (designDecision #MARGINS): visible coastline morphology, golden green, never re-capture. `compositeMargins` lives in `planet-lod-rivers.js` (a small local helper) and is a no-op (`shelfDepth` all-zero ⇒ `composited === carrier.height` values) on non-plate presets, so **non-plate worlds render byte-identically** (AC-LAB c).

**Driver-response axis (AC-MARGIN c).** `writePassiveMargins` reads the volatiles/continental-fraction axis from `bodyDrivers` (`condition.composition.volatileFraction` → the same signal `driversToTune` maps to `CONTINENTAL_FRACTION`, `plates.js:142`). `SHELF_W` (and shelf depth) scale by a documented `shelfWidthFactor(volatileFraction)` (wetter ⇒ wider/sedimented shelves, monotone). Observable: sweeping volatiles moves shelf angular extent/width monotonically above the `'margin:'` noise floor. Documented in SUBSTRATE-MAP.

**Tests added** (`tests/worldengine-v2-4-passive-margins.test.js`):
- AC-MARGIN(a): shelf→break→slope→rise structure present in `shelfDepth` at passive margins; active-boundary nodes have zero `shelfDepth` (structure only at passive transitions). *(→ observable "Shelf/break/slope structure present at passive margins only".)*
- AC-MARGIN(b): `carrier.height` byte-diff vs the plate golden rows = zero (own-channel proof). *(→ "height byte-clean".)*
- AC-MARGIN(c): volatiles sweep moves shelf-extent observable monotonically above noise floor. *(→ "driver sweep moves margin observables".)*
- AC-MARGIN(d): `'margin:'` determinism double-run bit-identical. *(→ "reruns bit-identical".)*

**Byte-safety.** Which hashed fields could move? **None.** `writePassiveMargins` writes only `shelfDepth` (unhashed) and reads plateDiag + `bodyDrivers` (read-only); its `'margin:'` stream is independent of `'plates:*'`. `compositeMargins` allocates a new array and never assigns back into `carrier.height`. The golden bypasses `route()` so never sees the composite. 75-golden + anchors green. *(Verify: golden + AC-MARGIN(b) byte-diff in the gate.)*

**Commit boundary → COMMIT 3** `V2-4 slice-3: passive continental margins (own shelfDepth channel + route composite)`.

---

## §4 — SLICE 4: History-tied province (c) → AC-PROVINCE-ASSOC, AC-0, AC-LAB(b), AC-UAT(2)

**Files touched:** `src/worldengine/base/sphereField.js` + `substrate.js` (add `province: new Uint8Array(count)` parity), `planet-lod-rivers.js` (call the writer + a `provinceProbe` seam), `planet-lod-lab.html` (**ground-owned** false-color debug overlay toggle + `_lab.provinceProbe()` at the `:5992` `window._lab` object).
**New file:** `src/worldengine/base/province.js` — the derivation + the association-test instrument (exported so the test and a future V2-9 both reuse it).

**Derivation (cratons / orogens / basins — a k=3 labeling with contiguity).** `writeProvince(carrier, { seed })` builds a per-node feature vector `[faultDensity, grainMag, accommodation]` (all already on the carrier post-slice-1) and assigns each node to one of three classes by fixed, calibrated thresholds (§6):
- **CRATON (0):** low `faultDensity` AND low `accommodation` (stable, quiet interiors).
- **OROGEN (1):** high `grainMag` OR high `faultDensity` (deformation belts). *(NB — see the plate-path caveat below.)*
- **BASIN (2):** high `accommodation` (topographic sinks).
Raw per-node labels are speckled; **contiguity** is enforced by a bounded fixed number of majority-vote relax passes over `adj` (the `plates.js:355` relax idiom — fixed `PROVINCE_RELAX_PASSES`, never while-to-convergence), so regions become legible blobs. Deterministic per seed; `'province:'+seed` is reserved only for tie-breaks (a two-way majority tie), otherwise RNG-free.

**Plate-path caveat (flagged, not silent).** On the plate path `grainMag` is **all-zero** (`plates.js` writes `height`+`faultDensity` only; it never calls `writeGrainSphere`). So on Earth-like worlds orogens are carried by **high `faultDensity`** (convergent belts), cratons by low `faultDensity` interiors, basins by high `accommodation`. The derivation must not assume `grainMag` is populated; the labeling uses whichever structural fields are non-degenerate per path. This is recorded in SUBSTRATE-MAP and drives the §6 threshold calibration (thresholds are computed from the field's own live distribution, not hard-coded absolutes).

**Association statistic (AC-PROVINCE-ASSOC — the honesty instrument).** `province.js` also exports `provinceAssociation(labels, fields)` → a scalar. **Definition:** the **correlation ratio η² (between-class variance fraction)** averaged over the populated history fields: for field `x`, `η²(x) = SS_between / SS_total` where `SS_between = Σ_k n_k (mean_k − mean)²` over the three class means and `SS_total = Σ_i (x_i − mean)²`; the statistic is `mean over populated x of η²(x)`. **Permutation null:** shuffle `labels` `NPERM=200×` and recompute; the real derivation must exceed the 99th-percentile of the null (p<0.01). **Rejection assertion (the load-bearing half):** an independent-noise/shuffled-seed control province (labels drawn from a *position-noise partition*, the `gProvince`-style spatial noise — decoupled from the fields) must **fail** to exceed the null → REJECTED as history-tied. The test asserts BOTH: real PASSES, noise control REJECTED. *(→ observable "Real province associates (above threshold); noise control REJECTED (below)".)*
- Circularity note: η² on a field the labels were thresholded on is expected-high for the real province by construction — that is fine; the AC's job is to **distinguish** a history-derived province from a position-noise one, and the noise control (which shares the fields' geometry not at all) is the discriminator. The permutation null calibrates the pass line objectively.

**Contiguity metric.** Fraction of nodes whose majority `adj` label equals their own (or connected-component count per class); assert above a floor so regions are contiguous, not per-node speckle. *(→ "regions contiguous".)*

**Lab false-color debug overlay (ground-owned).** A NEW GUI toggle (default OFF ⇒ byte-identical) in a ground-owned lab folder that recolors the planet/ribbon by `province` label (craton/orogen/basin → 3 distinct colors) via `_lab.provinceProbe()` reading the carrier field. **This is NOT the shader `gProvince` rewire** (designDecision #PROVINCE) — `gProvince`/`initProvinces`/`PROVINCES` (`planet-archetypes.js:195`) are the V2-9 job and stay untouched (`tests/planet-archetypes.test.js` drift-guard stays green). The overlay is a separate lab-only visualization living in ground-owned sections, never touching the atmo GLSL.

**Call site.** `writeProvince(carrier, { seed: macroSeed })` in `writeBodyRelief`'s condition-bearing branch after `writeAccommodation` (it reads `accommodation`), before return; `relief.province` / a probe exposes it.

**Tests added** (`tests/worldengine-v2-4-province.test.js`):
- AC-PROVINCE-ASSOC: real derivation PASSES the permutation test; the position-noise control is REJECTED — across presets×seeds. Contiguity above floor. `'province:'` determinism double-run bit-identical. *(→ all four AC-PROVINCE-ASSOC observables.)*
- AC-0: taxonomy — the overlay/control registers per Rule 14/15; `tests/planet-archetypes.test.js` drift guard green (unchanged, since `gProvince` is not rewired).

**Byte-safety.** Which hashed fields could move? **None.** `writeProvince` writes only `province` (Uint8Array, unhashed), reads `faultDensity`/`grainMag`/`accommodation` (read-only). The lab overlay is default-OFF and ground-owned. `PROVINCES`/`gProvince` untouched ⇒ archetype drift guard green ⇒ non-plate presets render byte-identically with the overlay off (AC-LAB c). 75-golden + anchors green. *(Verify: golden + anchors + planet-archetypes in the gate.)*

**Commit boundary → COMMIT 4** `V2-4 slice-4: history-tied province field + association instrument + lab overlay`.

---

## §5 — SLICE 5: E2-figure descriptor (e) → AC-FIGURE(a/b/c/d), AC-0, AC-ZERO-CLOBBER

**Files touched:** `body-condition-vector.js` (plumb `rotationHours` — D8 — into the nested condition vector), `planet-lod-rivers.js` (compute + attach `relief.figure`; a `_lab.figureProbe` seam), optionally `planet-lod-lab.html` ground-owned `_lab` object for the probe.
**New file:** `src/worldengine/base/bodyFigure.js` — the pure descriptor derivation.

**D8 plumbing (byte-inert by the V2-0 precedent).** `body-condition-vector.js:23-46` gains one nested field: `rotationHours: fp.rotationHours ?? <fallback>` (D8, `driver-presets.js:35`). **Byte-inert argument:** the condition vector is attached **NESTED** under `bodyDrivers.condition`; the tune builders (`driversToTune`/`magmaDriversToTune`) read only **flat** keys and ignore unknown fields (the file's own SHADOW-MODE doctrine, `:9-14`). The 75-golden re-runs the *condition-bearing* bundle and already matches byte-for-byte (that match IS the inertness proof — `v2-0-carrier-golden.mjs:66-76`); adding one more nested field it no path reads is inert by the identical argument (the V2-0 precedent AC-FIGURE(a) cites). Nothing in `writeBodyRelief`'s dispatch reads `condition.rotationHours` — only `bodyFigure.js` does, and figure touches no carrier field.

**Flattening formula (unit discipline — the §7b delegable-#4 trap).** `bodyFigure.js` exports `deriveFigureDescriptor(condition)`:
- `ω = 2π / (rotationHours · 3600)` rad/s.
- `a = radiusEarth · R_EARTH_M`, `R_EARTH_M = 6.371e6` m — **BODY RADIUS, from `condition.radiusEarth`. NEVER `shellThickness`** (the triple-duty trap; AC-0 grep-denies `shellThickness` in this file).
- `g = surfaceGravity · G0`, `G0 = 9.81` m/s² (`condition.surfaceGravity` is in g). `GM = g · a²`.
- `f = (5/4) ω² a³ / GM = (5/4) ω² a / g` (the `a³/(g a²)` reduction). Homogeneous-body (Maclaurin) coefficient. Earth inputs → `f ≈ 4.3e-3 ≈ 1/233` (right order, ~1/300 — the (5/4) fluid coefficient slightly overestimates the real 1/298 because Earth is centrally condensed); Jupiter inputs → `f ≈ 0.11` (right order of the real 0.065; the homogeneous coefficient overestimates ~2× for a centrally-condensed body). See §6 for the response-coefficient refinement (deferred — V2-7 CYCLE-2 needs order + the present/fossil split, not exact).

**Despun / fossil split.** `deriveFigureDescriptor` returns `{ omegaPresent, omegaFossil, fPresent, fFossil, despun, aMeters, GM }`:
- **Non-locked:** `omegaFossil = omegaPresent`, `fFossil = fPresent`, `despun = false` (no despin history).
- **Locked (`condition.tidalState.locked`):** the present spin is synchronous — `omegaPresent` from `rotationHours` (which for a locked preset already IS the synchronous period). `omegaFossil` = the **pre-despin primordial spin**, sourced from a documented constant `PRIMORDIAL_SPIN_HOURS` (~8 h — the canonical post-accretion rocky spin; there is no primordial-spin driver, so this is a named fiducial, recorded in SUBSTRATE-MAP as a deliberate modeling choice, NOT an authored w0). `fFossil` from `omegaFossil` (the frozen bulge — larger), `fPresent` from `omegaPresent` (small). `despun = true` ⇒ `fPresent ≠ fFossil` (the despun-fossil-bulge case). This satisfies "present-w0 ≠ fossil-w0" from drivers, without touching `shellRelief`'s sibling-local random `'shell:axis:'` axis (designDecision #FIGURE — that stays a red herring, untouched).

**Persisted descriptor shape + seam.** Computed in `writeBodyRelief`'s condition-bearing branch: `relief.figure = deriveFigureDescriptor(cond)` (one added return field — touches no carrier array, draws no RNG ⇒ byte-inert). Exposed via `_lab.figureProbe()`. `deriveFigureDescriptor` is a **pure function of the condition vector** (like `computeE1`), so V2-7 CYCLE-2 imports it directly at its epoch seam.

**V2-7 stub (CYCLE-2 readiness).** `tests/worldengine-v2-4-figure.test.js` includes a V2-7-shaped epoch stub that reads `{ fPresent, fFossil, despun }` and computes a gen-2 grain offset `Δgrain = K_FIG · (fFossil − fPresent)` (the figure→grain reorientation term) — asserts nonzero for a despun body, zero for a non-despun body (CYCLE-2 seam exists).

**Tests added** (`tests/worldengine-v2-4-figure.test.js`):
- AC-FIGURE(a): condition-vector plumbing byte-inertness (75-golden green after adding `rotationHours`). *(→ "Goldens green".)*
- AC-FIGURE(b): magnitude bands at reference inputs — Earth `f ∈ [2e-3, 6e-3]`, Jupiter `f ∈ [0.04, 0.15]`, physically ordered; despun case `fPresent ≠ fFossil`. grep-deny `shellThickness` in `bodyFigure.js`. *(→ "f magnitudes physically ordered; despun case splits present/fossil".)*
- AC-FIGURE(c): an authored/seeded-only w0 path is rejected — the descriptor must be COMPUTED (assert `deriveFigureDescriptor` takes no seed/authored-w0 arg; a mutated `rotationHours` changes `f`). *(→ authored-w0 rejection.)*
- AC-FIGURE(d): the V2-7 stub reads the descriptor and computes an offset. *(→ "stub computes an offset from the descriptor".)*

**Byte-safety.** Which hashed fields could move? **None.** The condition-vector field is nested + read by nothing in the write path (V2-0 precedent); `relief.figure` is a return-object field, not a carrier array; `deriveFigureDescriptor` draws no RNG and touches no carrier. 75-golden + lid-anchors green. *(Verify: golden + anchors in the gate; the grep-deny for `shellThickness`.)*

**Commit boundary → COMMIT 5** `V2-4 slice-5: E2-figure descriptor (D8 plumbed, driver-originated flattening + despun split)`.

---

## §6 — Empirical calibration (committed under `calibration/`, the V2-5s precedent)

Calibration probes are committed headless `.mjs` scripts under `docs/WORKSTREAMS/world-engine-v2-4-substrate-2026-07-14/calibration/` (precedent: `world-engine-v2-5s-shell-multiply-2026-07-12/calibration/*.mjs` — `gain-probes.mjs`/`order-probe.mjs`/`variety-probe.mjs`/`ref-slots.mjs`). Each drives the REAL writers on the deterministic test mesh (`buildIrregularSphere(N, 2)` + `makeSphereField`), seeds {1,2,3,7,42}, and prints reference tables the plan's constants are pinned against. **These are metered-safe: pure `node`, no `claude -p`.**

Constants that need a live/headless calibration pass:
1. **Margin scale anchors → carrier units (`margin-scale.mjs`).** The v1 km/m/deg anchors (SHELF ~80 km/0.5°, BREAK ~140 m, SLOPE ~3°, RISE ~500 km) must be converted to the carrier's normalized height units and geodesic radians. The probe reads the live plate-world `height` distribution and the `BASE_CONT−BASE_OCEAN` step (0.26) to map vertical anchors to fractions of that step (BREAK_DZ ≈ 140 m / ~4500 m continent-ocean relief × 0.26 ≈ 0.008 normalized) and horizontal anchors to geodesic radians (0.5° ≈ 0.0087 rad; resolution-independent). Output: the locked `SHELF_W`/`BREAK_DZ`/`SLOPE_GRAD`/`RISE_W` constants + the `shelfWidthFactor(volatileFraction)` transfer function (anchored so Earth-volatiles ⇒ the reference width). **Verify the composite reads as coastline morphology, not a re-introduced step** (AC-LAB a).
2. **Province class thresholds (`province-thresholds.mjs`).** The craton/orogen/basin cut points are computed from each field's LIVE distribution (percentile-based, per path — because `grainMag` is degenerate on plate worlds, §4), NOT hard-coded absolutes. The probe prints per-preset field quantiles + the resulting class proportions + the association η² and contiguity metric so the thresholds are pinned to give legible, associating regions across seeds. Also pins `PROVINCE_RELAX_PASSES` (fixed; justify, don't interpolate).
3. **Association significance threshold (`assoc-null.mjs`).** Prints the permutation-null distribution (NPERM=200) of η² for the real vs the position-noise control across presets×seeds, so the pass line (99th-pct) is an observed number, and confirms the noise control sits inside the null (REJECTED) on every seed — the AC-PROVINCE-ASSOC rejection is calibrated, not assumed.
4. **Figure response coefficient (deferred, documented in `figure-magnitudes.mjs`).** The probe prints `f` at Earth/Jupiter/despun reference inputs so the AC-FIGURE(b) bands are observed. **Deferred refinement:** the homogeneous (5/4) coefficient overestimates centrally-condensed bodies ~2× (Jupiter 0.11 vs real 0.065); a Darwin–Radau response coefficient (using a moment-of-inertia factor, which we have no per-body driver for) is the accuracy fix — parked, because V2-7 CYCLE-2 needs order-of-magnitude + the present/fossil split only. Recorded as a named non-goal in SUBSTRATE-MAP.

---

## §7 — Docs (AC-DOCS, Rule 3) — gates the increment

**`SUBSTRATE-MAP.md`** (this workstream dir) carries, for EACH of the five fields — `sediment`, `accommodation`, `shelfDepth`(margins), `province`, figure-descriptor — the four-part record (AC-DOCS):
1. **Function** (plain language).
2. **Position in the write-history → read-history pipeline** (which tier/writer writes it, which stage reads it — the spine §4c/§1 vocabulary): `accommodation` written post-relief in `writeBodyRelief`, read by V2-8 sink-ranking + the province derivation; `shelfDepth` written by `passiveMargins` on the plate path, read by the `route()` composite → render + V2-8; `province` written post-accommodation, read by the lab overlay now + V2-9 palette later; figure written on the relief return, read by V2-7 CYCLE-2; `sediment` a zero host, written by V2-8.
3. **Named consumers** (the AC-0 list).
4. **Deliberate non-goals** — `accommodation`'s no-mass-conservation clause; `sediment`'s V2-4-does-not-deposit clause; figure's no-render clause + the (5/4) homogeneous-coefficient + `PRIMORDIAL_SPIN_HOURS` fiducial; margins' own-channel (never `carrier.height`) clause; province's not-the-`gProvince`-rewire clause.

**SYSTEMS README** updated per Rule 3 where wiring changed (new channels + the `route()` composite seam + the condition-vector field). `npm run doc-rot -- --workstream world-engine-v2-4-substrate-2026-07-14` reports no gap. `DOES/UNLOCKS` card already in `intent.md`.

---

## §8 — Live integration (AC-LAB) + UAT surface (AC-UAT) — working-Claude drives

**AC-LAB (agent-drivable, objective; chrome-devtools on `127.0.0.1:9223` against a Max-started `npm run dev -- --port 5175`; liveness via `list_pages`, NEVER sandbox-curl):** on `http://localhost:5175/well-dipper/planet-lod-lab.html`:
- (a) plate/terrestrial preset — continent edge shows shelf→break→slope in the composited render (before/after screenshot pair at pinned camera/seed), not the prior binary step.
- (b) province debug overlay renders false-color regions tracking structure (orogenic belts on high-grain/high-fault zones, cratons in low-fault interiors), cross-checked against `_lab.provinceProbe()` + faultDensity/grainMag probe values.
- (c) non-plate presets (icy/volcanic/despun) render byte-identically with the overlay OFF.
- (d) console clean of NEW errors; screenshots archived in `evidence/`; **agent pages closed after** (window hygiene — `feedback_agent-browser-window-hygiene`).

**AC-UAT (Max's gate alone — never agent-PASSed):** (1) margins read as Earth-from-space coastlines "as a start"; (2) province overlay reads as real history. **Carve-out (framed at scope):** planets still reading rough/"balls of clay" overall is V2-5/V2-7/V2-8 work and does NOT fail this gate. Working-Claude surfaces exactly what to click + the before/after evidence; `verify-workstream` marks AC-UAT `deferred-to-max`.

---

## §9 — Risks + deviation rule

- **R-shellThickness (§7b delegable #4, carried).** Figure's `a³` term uses **BODY RADIUS** (`condition.radiusEarth`), NEVER `shellThickness` (three physically distinct thicknesses, ~30× apart). AC-0 grep-denies `shellThickness` in `bodyFigure.js`. **Denylist enforced in the gate.**
- **R-grainMag-degenerate (province, §4).** `grainMag` is all-zero on the plate path; the province derivation must lean on `faultDensity`/`accommodation` there and must not assume `grainMag` is populated. Thresholds are per-field-distribution (§6), not absolutes.
- **R-figure-coefficient (§5/§6).** The homogeneous (5/4) coefficient overestimates centrally-condensed bodies ~2×; acceptance is order-of-magnitude bands, refinement deferred. Do not tighten AC-FIGURE(b) to exact real values.
- **R-atmo-collision.** Only a *visible-oblateness render* would touch the atmo vertex/geometry path — and figure is **descriptor-only this increment** (no render), so the one real collision is descoped. Lab overlay + any margin GUI stay ground-owned. **Atmosphere suites green unchanged (AC-ZERO-CLOBBER d).**
- **R-not-ours-dirty.** `CameraChoreographer.js`/`LabMode.js` + untracked PNGs are excluded from every commit (`git show --stat` audit at each boundary).

**Deviation rule (§10-style, Dev-Collab OS convention).** Any deviation from this plan (a different seam, a renamed export, a constant that had to move, an AC test that needed a different shape) is **recorded in `## §11 Build deviations` with the reason** — never silent. Working-Claude reconciles deviations against the contract before each commit; a deviation that touches an AC's mechanism is surfaced to Max, not absorbed.

---

## §10 — Slice / commit map + AC coverage

| Slice | Files (new → touched) | New carrier field | ACs | Commit |
|---|---|---|---|---|
| **1 — host channels (b)** | `hostChannels.js` → `sphereField.js`,`substrate.js`,`planet-lod-rivers.js` | `sediment`,`accommodation` | AC-CHANNELS, AC-0(2) | **C1** |
| **2 — SP-STRESS-FABRIC (d)** | `stressFabric.js` → `tectonic.js`,`shellRelief.js`,`mixedInterior.js`,`stagnantLid.js` | — | AC-FABRIC, AC-ZERO-CLOBBER(a/b) | **C2** |
| **3 — passive margins (a)** | `passiveMargins.js` → `sphereField.js`,`substrate.js`,`planet-lod-rivers.js`(composite),[lab GUI] | `shelfDepth` | AC-MARGIN(a-d), AC-LAB(a), AC-UAT(1) | **C3** |
| **4 — history-tied province (c)** | `province.js` → `sphereField.js`,`substrate.js`,`planet-lod-rivers.js`,`planet-lod-lab.html`(overlay) | `province` | AC-PROVINCE-ASSOC, AC-LAB(b), AC-UAT(2) | **C4** |
| **5 — E2-figure descriptor (e)** | `bodyFigure.js` → `body-condition-vector.js`,`planet-lod-rivers.js`,[lab probe] | — (relief.figure) | AC-FIGURE(a-d) | **C5** |
| **docs (all slices)** | `SUBSTRATE-MAP.md`, SYSTEMS README, `calibration/*.mjs` | — | AC-DOCS, AC-0(1/3) | folded into each commit |

**Every commit runs the full AC-ZERO-CLOBBER gate FROM THE REPO DIR before it lands:** `npx vitest run` over goldens (`tests/v2-0-byte-identity.test.js`) + lid anchors (`tests/worldengine-lid-byte-anchors.test.js`) + quartet + dispatch-oracle (25/25) + atmosphere suites (`worldengine-base-climate-e5`, `worldengine-base-emission-e`) + `tests/planet-archetypes.test.js` + the slice's own new suite + full-suite at the 4-failed/17-files baseline; then `git show --stat` against the fence. Green ⇒ working-Claude commits; agents commit nothing.

**Integration green → `VERIFIED_PENDING_MAX <sha>` → Max UAT → Shipped.** AC-LAB is working-Claude's live integration gate; AC-UAT is Max's alone (`deferred-to-max`).

---

## §11 — Build deviations

*(Empty at plan time. Working-Claude appends `{slice, planned, actual, reason, AC-impact}` rows here as they occur — nothing silent.)*
