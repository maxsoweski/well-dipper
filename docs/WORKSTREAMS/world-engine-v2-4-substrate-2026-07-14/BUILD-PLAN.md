# V2-4 BUILD-PLAN — Shared-substrate pass (was #5.5), all five fields

**Workstream:** `world-engine-v2-4-substrate-2026-07-14` · **Plan written:** 2026-07-14
**Branch:** `feature/world-engine-production-L1` · **Builds in the MAIN checkout** (`~/projects/well-dipper`, L1), concurrent with the atmosphere lane (separate worktree, `:5178`).
**Binds to:** `contract.json` (all 10 ACs + 10 designDecisions are BINDING; the AC-ZERO-CLOBBER(e) diff fence is absolute) + `intent.md` + `~/briefings/grounding-v2-4-substrate-2026-07-14.md`.
**Mold:** `world-engine-v2-7d-lid-disruption-2026-07-12/` (GROUNDING §2 + BUILD-PLAN) — family module, byte-exact dual-run, own suite, zero production wiring.
**Deviations from this plan are recorded in `## §11 Build deviations`, never silent.**

---

## Lens fold — revisions from the two adversarial verification lenses (2026-07-14)

Two adversarial lenses (A = byte-safety/determinism, B = scope/fence/AC-coverage) verified this plan against the live source. The byte/determinism core and the fence/scope held GREEN; the defects below were folded in. Every change was re-verified against the actual code before writing.

**MUST-FIX resolved:**
- **[A#1 = B#1] The post-dispatch seam does not exist as "before the return."** `writeBodyRelief`'s `if (bodyDrivers?.condition)` branch (`planet-lod-rivers.js:429-521`) resolves via a **9-way early-return rule chain** (`:491,:496,:497,:503,:507,:509,:515,:518,:520`) through **five helper closures** (`plate`/`shell`/`despun`/`unbrokenLid`/`stagnantLidDirect`), each returning a helper's `{path,…diag}` object immediately; `:522` is a `throw` reachable only for condition-*less* input. There is no reachable "before the return" point after the chain. A literal insertion of the slice-1/3/4/5 post-writes lands either at the unreachable throw (writers never run → `accommodation`/`shelfDepth`/`province`/`relief.figure` stay unwritten → AC-CHANNELS/AC-MARGIN/AC-PROVINCE-ASSOC/AC-FIGURE(d) fail) or forces an unscoped refactor of the byte-and-grep-sensitive dispatch block. **Fix:** a single explicit **IIFE-capture seam**, specified once in §0 ("Post-dispatch write seam") and referenced from §1/§3/§4/§5. Oracle-safe and byte-safe (verified below).
- **[B#2] AC-PROVINCE-ASSOC's shuffle null does not control for spatial autocorrelation.** A label-shuffle null destroys spatial contiguity, so its η² collapses to chance; both the real province AND a *contiguous* position-noise control are blobby over strongly-autocorrelated history fields (`faultDensity`, relaxed `height`), so the noise control will very likely EXCEED the shuffle null and PASS — defeating the load-bearing "must REJECT a noise province" half. **Fix (§4/§6.3):** the null becomes a **contiguity-preserving ensemble of position-noise partitions** at the same blob scale; the real province must exceed the 99th pct of *that* spatial null, and a single noise control is REJECTED by construction. Decision rule + fallback documented.
- **[B#3] The province overlay render mechanism was unspecified and, as scoped, collided with the atmo-shared planet vertex/geometry+GLSL path.** **Fix (§4):** the overlay is pinned to a **ground-owned mechanism that adds NO attribute to, and edits NO line of, the atmo-shared planet vertex/fragment shader** (a ribbon-only recolor / separate debug mesh / ground-owned data-texture uniform); the "only figure would touch the vertex/geometry path" claim is reconciled; the atmo-attribute citation is corrected (declared in-shader `:200-206`, populated via `geometry.setAttribute` at `:1436-1438`).

**Minors applied:**
- **[A-M1] Stale gradient in the margin composite** — §3 now recomputes `grad` from the `composited` height (`computeAdjGradient` on a composited-height carrier view), not the pre-shelf `reliefGrad`, so the shelf reshades/reroutes rather than displace-without-reshade.
- **[A-M2 = B-M2 seam] `writePassiveMargins` call site + `plateDiag` source pinned** — runs in the §0 seam, guarded by `relief.plateDiag` (plate path only), source = `relief.plateDiag`.
- **[A-M3] mixedInterior fixture must predate the extraction** — §2 adds an explicit capture-order guard so the reference cannot silently compare extracted-to-extracted.
- **[B-m1] Margin passive-filter names a non-exported input** — `nearStress` is a `plates.js` **local**, not in the diag; §3 now reconstructs near-boundary stress from the exported `boundaryStress` + `adj` via the writer's own bounded belt scan (no `plates.js` edit).
- **[B-m2] AC-CHANNELS non-degeneracy** — §1 adds an assertion that `accommodation` varies across nodes / correlates inversely with `height`, so a dead all-zero channel cannot pass "∈ [0,1]" vacuously.
- **[B-m3] AC-MARGIN(c) driver-sweep confound** — §3/§6 isolate `shelfWidthFactor`'s response (fixed partition/seed) from the repartition `volatileFraction` also causes via `CONTINENTAL_FRACTION`.
- **[B-m4] AC-0(3) registration contradiction** — §4 clarifies the carrier-`province` debug viz is **exempt** from the `PROVINCES`/GLSL-mirror taxonomy (not a `gProvince` affinity entry), so "registers per Rule 14/15" and "`planet-archetypes.test.js` unchanged" are consistent.
- **[B-m5] Figure Jupiter band vs contract number** — §5/§7 call out that AC-FIGURE(b)'s `[0.04,0.15]` band sits above the contract's stated "~0.06" (the documented ~2× homogeneous-coefficient overestimate; ordering is the real gate) so the divergence isn't later read as an error.

---

## §0 — Global invariants (apply to EVERY slice)

**Byte regime.** `HASHED_FIELDS = ['height','grainAngle','grainMag','regime','faultDensity']` (`tests/fixtures/v2-0-carrier-golden.mjs:54`). The 75-golden hashes only these five, over 15 presets × seeds {1,2,3,7,42}, and **bypasses `route()` entirely** (it calls `writeBodyRelief` directly — `planet-lod-rivers.js:1241` comment). The lid byte-anchors (`tests/worldengine-lid-byte-anchors.test.js`) do full-`Float32Array` equality on `height`/`faultDensity`/`grainAngle` at MAGMA_REF/Lava/Magma/Venus. **Two mechanical facts make every V2-4 channel byte-inert:** (1) new typed arrays on the carrier are outside `HASHED_FIELDS` and are never compared by the anchors (which read named arrays, not the whole object); (2) `alea` streams are independent by seed-string, so drawing a new `'margin:'`/`'province:'` stream cannot perturb any existing `'plates:*'`/`'shell:*'`/`'stagnant:*'`/`'e6:*'` sequence — byte-identity breaks **only** by writing a hashed field or reordering draws *within* an existing stream, neither of which any slice does.

**Alea namespaces (pinned here per designDecision #8/#DETERMINISM).** `'margin:'+seed` (margin slice), `'province:'+seed` (province slice, reserved — used only if a contiguity tie-break needs entropy; the derivation is field-deterministic first). `accommodation`/`sediment`/`figure` are **RNG-free** (pure functions of existing fields/drivers) — no namespace consumed. No `Math.random`, no `Date.now`, no while-to-convergence; bounded fixed relax passes only.

**Atmosphere fence (designDecision #CONCURRENCY-FENCE + AC-ZERO-CLOBBER d/e).** V2-4 NEVER edits `climate-e5.js`, `emission-e.js`, the storm/band sections of the render mega-files, or `planet-lod-uniforms.js` storm blocks. Lab edits (province overlay + any margin GUI) stay in **ground-owned** sections of `planet-lod-lab.html` — never the atmo vertex attributes `aBand`/`aShear`/`aMush` (declared in the shared planet shader at `:200-206`, populated via `geometry.setAttribute` at `:1436-1438`, updated at `:2775-2777`), `zonalBandCol`, or `uStorm*`. The province overlay's separate-debug-mesh mechanism (§4) is what keeps it off this surface. Atmosphere suites (`worldengine-base-climate-e5`, `worldengine-base-emission-e`) must pass unchanged.

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

**Post-dispatch write seam (slices 1/3/4/5 — the single shared insertion point; folded from lens A#1 = B#1).** The condition-bearing branch (`planet-lod-rivers.js:429-521`) is a **9-way early-return rule chain** through **five helper closures** (`plate`/`shell`/`despun`/`unbrokenLid`/`stagnantLidDirect`); each returns its `{path,…diag}` object immediately (`:491,:496,:497,:503,:507,:509,:515,:518,:520`), and `:522` is a `throw` reachable only for condition-*less* input. **There is NO reachable "before the return" point after the chain** — so the post-dispatch writers CANNOT be attached "before the return." Instead, **capture the rule chain in an inner IIFE and post-write on the captured result:**
```
// inside  if (bodyDrivers?.condition) { … after computeE1 + the 5 closures …
const relief = (() => {
  // ── the derived rule chain, verbatim & unchanged (all 9 returns intact) ──
  if (cls === 'gas' || cls === 'carbon') return despun();
  …                                    // every existing return unchanged
  return despun();                     // (3f)
})();
// ── POST-DISPATCH WRITES (byte-inert; every closure has already finalized carrier.height) ──
writeAccommodation(carrier);                                             // slice 1 — reads finished height
initSedimentHost(carrier);                                              // slice 1 — zero host
if (relief.plateDiag) writePassiveMargins(carrier, relief.plateDiag, bodyDrivers, { macroSeed }); // slice 3 — plate path only
writeProvince(carrier, { seed: macroSeed });                            // slice 4 — reads accommodation
relief.figure = deriveFigureDescriptor(cond);                          // slice 5 — return-object field
return relief;
```
**Why this is the ONLY correct seam, not per-closure insertion:** every one of the five closures writes `carrier.height` *before* it returns (`plate`→`writePlateUpliftSphere`, `shell`→`writeShellReliefSphere`, `despun`→`writeHeightSphere`, `unbrokenLid`→`writeLidResponseSphere`, `stagnantLidDirect`→`writeStagnantLidReliefSphere`), so after the IIFE returns, `carrier.height` is finalized on **every** path — which is exactly why `writeAccommodation` (reads height) and `writeProvince` (reads accommodation) must run here, once, not duplicated into each closure. Order is load-bearing: accommodation → province (province reads accommodation); margins/figure are order-independent.

**Byte-safety of the seam.** No hashed field moves: the writers touch only unhashed channels (`accommodation`/`sediment`/`shelfDepth`/`province`) plus `relief.figure` (a return-object field, not a carrier array); no new draw reorders an existing alea stream. The 75-golden calls `writeBodyRelief` directly and hashes only `HASHED_FIELDS`, so it runs the seam but captures untouched hashed arrays.

**Oracle-safety of the seam.** The dispatch-oracle grep (`tests/worldengine-v2-3-dispatch-oracle.test.js:252-269`) balanced-brace-slices this entire `if (bodyDrivers?.condition)` block and (a) **requires** `computeE1(` + `compositionClass` remain, (b) **denies** `PRESET_ARCHETYPE`, `\.label\b`, `stagnantLidRegimeOf\s*\(`, `isVolcanicPath\s*\(`, `isEarthlikePlatePath\s*\(`, `\bshellRegimeOf\s*\(`, `\barchetype\b`. The IIFE wrap keeps both anchors intact, and `writeAccommodation`/`initSedimentHost`/`writePassiveMargins`/`writeProvince`/`deriveFigureDescriptor`/`relief.figure`/`relief.plateDiag` contain **none** of the denied tokens — so the wrap + post-writes leave the oracle GREEN. (Confirmed against the grep source, not assumed.)

---

## §1 — SLICE 1: Host channels (b) → AC-CHANNELS, AC-0(2), AC-DOCS(partial)

**Files touched:** `src/worldengine/base/sphereField.js` (add 2 arrays to the returned object, after `faultDensity`/before or beside the E9 reserves — keep the reserves distinct), `src/worldengine/base/substrate.js` (parity: same 2 arrays on `makeSubstrate`).
**New file:** `src/worldengine/base/hostChannels.js` — the accommodation sink-ranking writer + the sediment host initializer + the documented V2-8 seam comment.

**Mechanism.**
- `sphereField.js:11-21` return literal gains `sediment: new Float32Array(count)` and `accommodation: new Float32Array(count)`. `substrate.js:8-19` gains the identical two. These are **NEW** arrays — explicitly not aliases of `maturity`/`baseLevel` (asserted by AC-CHANNELS identity test: `carrier.sediment !== carrier.maturity`, distinct object identity + independent mutation).
- `hostChannels.js` exports:
  - `writeAccommodation(carrier, { datum = null } = {})` — **sink-ranking, non-volumetric.** For each node `i`: `accommodation[i] = clamp01((refDatum − height[i]) / DEPTH_SCALE)`, where `refDatum` is a low-percentile reference (default: the 60th-percentile height, or a passed `datum`) and `DEPTH_SCALE` normalizes the deepest expected basin to 1. **This is a RANKING of where deposition would go (deeper below datum ⇒ higher accommodation), NOT a mass/volume computation** — the assert for AC-CHANNELS greps this file for the absence of any `*=`-into-a-volume / `Σ mass` term and checks `accommodation ∈ [0,1]` across presets×seeds. Pure (reads only `height`, `count`); works on sphere OR grid (index-based, no adjacency).
  - `initSedimentHost(carrier)` — zero-fills `sediment` (pristine bedrock; V2-4 does **not** deposit — that is V2-8's job, a documented non-goal). Exists so the host is a defined, readable channel with an explicit owner, not an accidental reserve. Carries a `// V2-8 SEAM:` comment naming exactly where deposition will write.
- **Call site:** the **§0 post-dispatch write seam** (the IIFE-capture — there is no reachable "before the return" in the 9-way early-return chain). After the IIFE resolves `relief` (and with it `carrier.height` finalized on every path), call `writeAccommodation(carrier)` then `initSedimentHost(carrier)` **once**. (accommodation needs the finished `height`; the IIFE guarantees it on every path.) Both run on every path — the host is universal, not plate-only.

**Tests added** (`tests/worldengine-v2-4-host-channels.test.js`):
- AC-CHANNELS: both carriers expose `sediment`+`accommodation`; distinct object identity from `maturity`/`baseLevel` (not-aliased); `accommodation ∈ [0,1]` across presets×seeds; grep-assert the writer is sink-ranking (no volumetric term). *(→ AC-CHANNELS observable "Channels present on both carriers, distinct from E9 reserves; accommodation ∈ [0,1]".)*
- AC-CHANNELS non-degeneracy (folds lens B-m2 — the bounds check alone is vacuous for an all-zero channel): assert `accommodation` is **not constant** across nodes (variance > 0 on a plate world) AND is **inversely associated with `height`** (deeper-below-datum ⇒ higher accommodation — a negative rank correlation over the populated nodes). This proves the writer actually ran and ranks sinks, so `clamp01 of nothing = 0 ∈ [0,1]` cannot pass the AC.
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
- **Writer-level equality for mixedInterior** (NOT covered by the 75-golden — it is lab-only): run the real mixedInterior tessera path on the test mesh post-extraction and compare `carrier.height`/`grainAngle` against a committed reference array captured from HEAD pre-extraction (fixture under this workstream's `calibration/`). **Capture-order guard (folds lens A-M3):** the reference MUST be generated and committed **before** `steeredNoise3` is deleted from `mixedInterior.js` — otherwise it silently compares extracted-to-extracted and the check is vacuous. The capture script (`calibration/mixedInterior-ref.mjs`) is run and its output committed as the FIRST action of slice 2, and the test asserts the fixture file's git blob predates the extraction commit (or, simpler and enforced in-band: the ref is committed in a distinct pre-extraction commit that the slice-2 commit builds on). *Mitigating fact (not a substitute for the guard): mixedInterior's call sites (`mixedInterior.js:373-374`) pass literal `true` and are unchanged by the extraction, and the function-level dual-run (below) already proves the extracted function bit-identical across the swept battery — so mixedInterior is byte-safe by construction even if this fixture were vacuous. The guard is belt-and-suspenders.* The other three writers are covered by the goldens/anchors below.
- Module validation suite: throws-free, pure, three-free (import grep).

**Byte-safety.** Which hashed fields could move? Potentially all five *if* the extraction were not FP-identical — so the proof is layered: (1) function-level dual-run proves the extracted function is bit-identical; (2) the **75-golden** covers tectonic (`writeHeightSphere` grain on despun rows) + shellRelief (icy-active shell rows); (3) the **lid byte-anchors** cover stagnantLid (Venus, AC-BYTE-STRONG-REF); (4) the mixedInterior fixture covers the one writer absent from both. All four call sites pinned. *(Verify: new dual-run suite + goldens + anchors in the gate.)*

**Commit boundary → COMMIT 2** `V2-4 slice-2: SP-STRESS-FABRIC extraction (steeredNoise3, byte-exact ×4)`.

---

## §3 — SLICE 3: Passive margins (a) → AC-MARGIN(a/b/c/d), AC-0, AC-LAB(a), AC-UAT(1)

**Files touched:** `src/worldengine/base/sphereField.js` + `substrate.js` (add `shelfDepth: new Float32Array(count)` parity), `planet-lod-rivers.js` (TWO edit sites: the §0 post-dispatch seam writer call inside `writeBodyRelief`, AND the render composite + `computeAdjGradient` override-param in `route()`), optionally `planet-lod-lab.html` ground-owned section only if a margin GUI knob is wanted (probe is enough for AC-LAB).
**New file:** `src/worldengine/base/passiveMargins.js` — the margin channel writer.

**Passive-margin selection predicate.** The plate writer already returns everything needed (`plates.js:370-373` diag: `plateType`[per-plate], `plateId`/`boundaryClass`/`boundaryStress`/`boundaryDist`/`baseElevField`[per-node]). A **passive margin** = a continent↔ocean transition that is NOT an active plate-motion boundary:
- **continentality per node** `cont[i] = plateType[plateId[i]]` (1 continental / 0 oceanic).
- **transition detection:** node `i` is on a margin if any `adj` neighbor `j` has `cont[j] !== cont[i]` (the continent/ocean edge), OR `baseElevField` crosses the continental/oceanic step within a neighbor hop.
- **passive filter:** the transition is passive when the near-boundary stress in the local belt ≈ 0, i.e. it is NOT `CONVERGENT`/`DIVERGENT`/`TRANSFORM` with meaningful stress. **Stress source (folds lens B-m1 — the plan MUST name the real input):** `plates.js`'s own `nearStress` is a **module-local `Float32Array` (`plates.js:318`), NOT exported** in the diag return (`:370-373`, which carries `plateType/plateId/boundaryClass/boundaryStress/boundaryDist/signedProximity/baseElevField/…`); and the exported `boundaryStress[i]` is **0 at every non-boundary node** (set only where `isBoundary`, `:311`), while `signedProximity = sign(s)·falloff` carries only sign, not magnitude. So the writer **reconstructs** belt stress itself: a bounded multi-source BFS from the boundary set (`boundaryStress[i] !== 0`) over `adj`, propagating `|boundaryStress|` with a hop-count falloff (the exact `plates.js:317-334` nearest-boundary idiom, O(N) queue drain, not convergence) → a per-node `beltStress`. Predicate: `beltStress[i] < PASSIVE_STRESS_MAX`. This keeps slice 3 from editing `plates.js` (the diag has no `nearStress`), and makes the passive/active discrimination real rather than "fires everywhere" (which a raw `|boundaryStress[i]|<floor` test would degrade to, since it is 0 at all interior/margin nodes). *(Alternative considered and rejected for scope: add `nearStress` to the `plates.js` diag return — in-fence per AC-ZERO-CLOBBER(e) but pulls `plates.js` into slice 3's touched-files set; the self-reconstruction avoids that.)* Active margins (Andes-type subduction, rifts) **keep their existing `plates.js` convergent/divergent relief untouched** — margins fire ONLY at passive transitions.

**Own-channel write (shelf → break → slope → rise).** `writePassiveMargins(carrier, plateDiag, bodyDrivers, { macroSeed })` writes `carrier.shelfDepth` as a **signed morphology profile parameterized by geodesic distance `s` from the shoreline** (signed: seaward positive), zero everywhere except the passive-margin belt:
- **shelf** (`0 ≤ s < SHELF_W`): shallow near-flat depression below the coastal datum, depth ramping to the shelf-break value.
- **shelf-break** (`s ≈ SHELF_W`): the steep inflection (`BREAK_DZ`).
- **slope** (`SHELF_W ≤ s < SHELF_W+SLOPE_W`): steep descent at `SLOPE_GRAD`.
- **rise** (`SHELF_W+SLOPE_W ≤ s < SHELF_W+SLOPE_W+RISE_W`): flattening tail into the abyssal datum.
Shoreline distance `s` = geodesic distance to the nearest continent/ocean transition node (a bounded multi-source BFS from the transition set × `meanEdgeAngle`, the `plates.js:317-334` idiom — O(N) queue drain, not convergence). Along-coast character jitter draws from `alea('margin:'+seed)` (bounded, one stream). **v1 scale anchors as starting constants** (converted to carrier units in §6): `SHELF_W` ~0.5° (≈0.0087 rad), `BREAK_DZ` ~140 m, `SLOPE_GRAD` ~3°, `RISE_W` ~500 km — the km/m anchors map to fractions of the continent/ocean normalized step (`BASE_CONT−BASE_OCEAN = 0.26`) and the angular anchors map directly to geodesic radians (resolution-independent, like `BELT_RADIANS`).

**Writer call site (folds lens A-M2/B-M2 — the plan must pin where `writePassiveMargins` runs and where `plateDiag` comes from).** `writePassiveMargins(carrier, plateDiag, bodyDrivers, { macroSeed })` runs in the **§0 post-dispatch write seam** (inside `writeBodyRelief`, after the IIFE), **guarded by `relief.plateDiag`** so it fires on the plate path only; the `plateDiag` argument **IS `relief.plateDiag`** (produced by `writePlateUpliftSphere` inside the `plate()` closure, `planet-lod-rivers.js:444`, and returned on the relief object). Running the writer in the seam — not in `route()` — means the 75-golden (which calls `writeBodyRelief` directly) **populates `carrier.shelfDepth` too**, so AC-MARGIN(a)/(d) test the real channel via the same direct call (no separately-captured `plateDiag` plumbing needed), while AC-MARGIN(b) still sees `carrier.height` byte-clean because `writePassiveMargins` writes only `shelfDepth`. On non-plate paths `relief.plateDiag` is null ⇒ the writer is skipped ⇒ `shelfDepth` stays all-zero (AC-LAB c for free).

**Render composite seam (WITHOUT touching `carrier.height`).** In `route()` (`planet-lod-rivers.js:1230` onward), after `writeBodyRelief` (which has already written `carrier.shelfDepth` via the seam) and BEFORE the height consumers:
```
const composited = compositeMargins(carrier);              // = carrier.height + shelfDepth where nonzero; NEW Float32Array
const compositedGrad = computeAdjGradient(carrier, composited);  // gradient OF the composited surface (folds lens A-M1)
```
`computeAdjGradient` (`planet-lod-rivers.js:149`) gains an **optional trailing `heightOverride = null` param** (`const h = heightOverride || carrier.height`) — safe for all existing 1-arg callers (`:1264` + the four test imports), byte-identical when omitted. Then feed BOTH `composited` **and** `compositedGrad` to BOTH consumers that today read `carrier.height`/`reliefGrad`: the router height re-point (`:1274` `height = carrier.height; grad = reliefGrad` → `height = composited; grad = compositedGrad`) and the height-cube bake (`:1303` `bakeHeightCube({ height: carrier.height, grad: reliefGrad … })` → `{ height: composited, grad: compositedGrad … }`). **Recomputing the gradient from `composited` is what makes the shelf actually reshade/reroute** — feeding `composited` height but the stale pre-shelf `reliefGrad` would displace-without-reshading (the shelf-break morphology would be present in displacement but shaded/routed against the pre-shelf surface, threatening AC-LAB(a)'s "visible coastline morphology"). **`carrier.height` is never mutated** — the composite is a `route()`-local array, and the 75-golden bypasses `route()`, so the golden captures the untouched `carrier.height`. This is the whole own-channel discipline (designDecision #MARGINS): visible coastline morphology, golden green, never re-capture. `compositeMargins` lives in `planet-lod-rivers.js` (a small local helper) and is a no-op (`shelfDepth` all-zero ⇒ `composited`/`compositedGrad` value-identical to `carrier.height`/`reliefGrad`) on non-plate presets, so **non-plate worlds render byte-identically** (AC-LAB c).

**Driver-response axis (AC-MARGIN c).** `writePassiveMargins` reads the volatiles/continental-fraction axis from `bodyDrivers` (`condition.composition.volatileFraction` → the same signal `driversToTune` maps to `CONTINENTAL_FRACTION`, `plates.js:142`). `SHELF_W` (and shelf depth) scale by a documented `shelfWidthFactor(volatileFraction)` (wetter ⇒ wider/sedimented shelves, monotone). **Confound isolation (folds lens B-m3):** `volatileFraction` also drives `CONTINENTAL_FRACTION` (`plates.js:142`), which changes the `plateType` draws (`plates.js:238`) and therefore **which nodes are margins** — so a raw aggregate "total shelf extent" sweep moves for two coupled reasons (repartition + `shelfWidthFactor`), which is not a clean monotonicity test. The AC-MARGIN(c) observable is therefore measured on **`shelfWidthFactor`'s response in isolation**, one of: (i) evaluate the per-node width law `SHELF_W · shelfWidthFactor(vf)` directly across the `vf` sweep (pure transfer-function monotonicity, partition-independent), OR (ii) hold the partition + seed FIXED (freeze `plateType`/`plateId` from one reference draw) and sweep only the `shelfWidthFactor` input, measuring per-margin shelf width. Observable: the isolated shelf width/extent moves monotonically above the `'margin:'` noise floor. Documented in SUBSTRATE-MAP.

**Tests added** (`tests/worldengine-v2-4-passive-margins.test.js`):
- AC-MARGIN(a): shelf→break→slope→rise structure present in `shelfDepth` at passive margins; active-boundary nodes have zero `shelfDepth` (structure only at passive transitions). *(→ observable "Shelf/break/slope structure present at passive margins only".)*
- AC-MARGIN(b): `carrier.height` byte-diff vs the plate golden rows = zero (own-channel proof). *(→ "height byte-clean".)*
- AC-MARGIN(c): the **isolated** `shelfWidthFactor` response (per-node width law, or fixed-partition/seed sweep — not the confounded aggregate; see Driver-response axis above) moves shelf width/extent monotonically above the `'margin:'` noise floor. *(→ "driver sweep moves margin observables".)*
- AC-MARGIN(d): `'margin:'` determinism double-run bit-identical. *(→ "reruns bit-identical".)*

**Byte-safety.** Which hashed fields could move? **None.** `writePassiveMargins` writes only `shelfDepth` (unhashed) and reads plateDiag + `bodyDrivers` (read-only); its `'margin:'` stream is independent of `'plates:*'` (drawing it perturbs no existing sequence). The golden's direct `writeBodyRelief` call now runs the seam writer too (populating `carrier.shelfDepth`) — still inert, because it touches only the unhashed `shelfDepth` and the golden hashes only `HASHED_FIELDS`. `compositeMargins`/`compositedGrad` allocate new arrays and never assign back into `carrier.height`; the golden bypasses `route()` so never sees the composite at all. 75-golden + anchors green. *(Verify: golden + AC-MARGIN(b) byte-diff in the gate.)*

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

**Association statistic (AC-PROVINCE-ASSOC — the honesty instrument).** `province.js` also exports `provinceAssociation(labels, fields)` → a scalar. **Definition:** the **correlation ratio η² (between-class variance fraction)** averaged over the populated history fields: for field `x`, `η²(x) = SS_between / SS_total` where `SS_between = Σ_k n_k (mean_k − mean)²` over the three class means and `SS_total = Σ_i (x_i − mean)²`; the statistic is `mean over populated x of η²(x)`.

**Spatial null — NOT a label shuffle (folds lens B#2, the load-bearing correction).** A naive label-shuffle null is **wrong here** and would make the AC pass by accident: shuffling `labels` destroys spatial contiguity, so the shuffle-null η² collapses to ~chance; but the history fields (`faultDensity`, relaxed `height`, `accommodation`) are **strongly spatially autocorrelated**, so *any* large contiguous partition — the real province AND a contiguous position-noise control alike — scores η² well above a shuffle-null. The noise control would then **exceed** the shuffle-null and **PASS**, defeating the "must be able to REJECT a noise province" half of the AC (the classic spatial-null / autocorrelation-inflation pitfall). The null is therefore a **contiguity-preserving ensemble of position-noise partitions**: `NPERM=200` random *spatial* partitions generated by the **same blob-scale process as the noise control itself** (the `gProvince`-style position-noise partition, matched in region count and characteristic patch size to the real province), each scored with the same η². **Pass line:** the real derivation's η² must exceed the **99th percentile of this spatial null** (p<0.01). **Rejection assertion (the load-bearing half), now by construction:** any single position-noise control is one draw from the null's own generating process, so it sits *inside* the spatial null (below the 99th pct) ~99% of the time → REJECTED. The test asserts BOTH: real PASSES (η² > spatial-null p99), noise control REJECTED (η² ≤ spatial-null p99). *(→ observable "Real province associates (above threshold); noise control REJECTED (below)".)*
- **Decision rule + fallback (no silent hope):** the spatial-null p99 and the real-vs-null separation are printed by the `assoc-null.mjs` calibration probe (§6.3) across presets×seeds; the pass line is an *observed* number, not assumed. If on some preset the real province does NOT clear its spatial null (e.g. `grainMag`-degenerate plate worlds where only `faultDensity`/`accommodation` carry signal), that is surfaced to Max as a genuine AC finding — the derivation's thresholds are re-tuned (§6.2) rather than the null being weakened. The circularity is acknowledged and controlled: η² on a field the labels were thresholded on is expected-high for the real province, so the discriminator is not "η² is high" (a contiguous noise province is also high vs a shuffle) but "η² beats a **contiguity-matched** spatial null" — the only comparison that separates history-tied structure from equally-blobby position noise.

**Contiguity metric.** Fraction of nodes whose majority `adj` label equals their own (or connected-component count per class); assert above a floor so regions are contiguous, not per-node speckle. *(→ "regions contiguous".)*

**Lab false-color debug overlay (ground-owned).** A NEW GUI toggle (default OFF ⇒ byte-identical) in a ground-owned lab folder that recolors by `province` label (craton/orogen/basin → 3 distinct colors) via `_lab.provinceProbe()` reading the carrier field.

**Overlay render mechanism — PINNED to avoid the atmo-shared vertex/geometry path (folds lens B#3).** Getting a per-node `province` into a "recolor the planet" render naively would require either a new `geometry.setAttribute('aProvince', …)` **on the same planet BufferGeometry** the atmosphere lane populates its attributes on, or a new colormap branch in the **shared planet vertex/fragment shader** — exactly the vertex/geometry+GLSL surface the grounding (R-atmo-collision) flagged as the *sole* atmo collision zone and that this plan otherwise keeps V2-4 entirely out of (figure's oblateness render is descoped, so **nothing** in V2-4 is meant to touch that path). The overlay therefore uses a **ground-owned, atmo-shader-free mechanism**: a **separate debug mesh** — a NEW `THREE.Mesh` on its own NEW `BufferGeometry` (ground-owned; the `province` attribute lives on *this* geometry, never the shared planet geometry) with its own simple flat colormap material (province → 3 colors), toggled visible/hidden; a ribbon-only recolor of the already-ground-owned river ribbon material is the fallback if the separate mesh is overkill. **It adds NO attribute to, and edits NO line of, the atmo-shared planet vertex/fragment shader** (`aBand`/`aShear`/`aMush`: declared in that shader at `planet-lod-lab.html:200-206`, populated via `geometry.setAttribute` at `:1436-1438`, updated at `:2775-2777` — the overlay touches none of these), so the "V2-4 touches nothing on the atmo vertex/geometry path" invariant (§9 R-atmo-collision, AC-ZERO-CLOBBER d/e) holds and there is no AC-ZERO-CLOBBER(d) clobber hazard against the concurrent atmo lane.

**This is NOT the shader `gProvince` rewire** (designDecision #PROVINCE) — `gProvince`/`initProvinces`/`PROVINCES` (`planet-archetypes.js:195`) are the V2-9 job and stay untouched (`tests/planet-archetypes.test.js` drift-guard stays green). The overlay is a separate lab-only visualization living in ground-owned sections, never touching the atmo GLSL.

**Call site.** `writeProvince(carrier, { seed: macroSeed })` in the **§0 post-dispatch write seam** (the IIFE-capture), after `writeAccommodation` (it reads `accommodation`) — there is no reachable "before the return" in the 9-way early-return chain; the seam runs it once, every path, after `carrier.height`/`accommodation` are finalized. A probe (`_lab.provinceProbe()`) exposes the carrier field.

**Tests added** (`tests/worldengine-v2-4-province.test.js`):
- AC-PROVINCE-ASSOC: real derivation PASSES the permutation test; the position-noise control is REJECTED — across presets×seeds. Contiguity above floor. `'province:'` determinism double-run bit-identical. *(→ all four AC-PROVINCE-ASSOC observables.)*
- AC-0: taxonomy — the overlay/control registers per Rule 14/15 as a **new lab GUI control** (a `dat.GUI`/lil-gui toggle in a ground-owned folder), which is the Rule-14 registration surface. **This registration is EXEMPT from the `PROVINCES`/GLSL-mirror taxonomy (folds lens B-m4):** the carrier-`province` debug viz is NOT a new `gProvince` affinity entry — it adds no row to `PROVINCES` (`planet-archetypes.js:195`) and rewires no `initProvinces`/`gProvince` GLSL — so `tests/planet-archetypes.test.js`'s drift guard is correctly **unchanged** (a genuine Rule-15 `gProvince` registration WOULD re-baseline that guard; a debug overlay does not). The two claims — "registers per Rule 14/15" (as a lab GUI control) and "`planet-archetypes.test.js` unchanged" (because it is not a `gProvince` taxonomy entry) — are thus consistent, not contradictory.

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

**Persisted descriptor shape + seam.** Set in the **§0 post-dispatch write seam**: after the IIFE resolves `relief`, `relief.figure = deriveFigureDescriptor(cond)` (one added field on the captured return object — touches no carrier array, draws no RNG ⇒ byte-inert). Setting it in the seam — not "before the return" (which does not exist in the 9-way chain) — guarantees `relief.figure` is populated on **every** preset path; a per-closure insertion that missed a path would leave `figureProbe`/the AC-FIGURE(d) stub reading `undefined` for that preset. Exposed via `_lab.figureProbe()`. `deriveFigureDescriptor` is a **pure function of the condition vector** (like `computeE1`), so V2-7 CYCLE-2 imports it directly at its epoch seam.

**V2-7 stub (CYCLE-2 readiness).** `tests/worldengine-v2-4-figure.test.js` includes a V2-7-shaped epoch stub that reads `{ fPresent, fFossil, despun }` and computes a gen-2 grain offset `Δgrain = K_FIG · (fFossil − fPresent)` (the figure→grain reorientation term) — asserts nonzero for a despun body, zero for a non-despun body (CYCLE-2 seam exists).

**Tests added** (`tests/worldengine-v2-4-figure.test.js`):
- AC-FIGURE(a): condition-vector plumbing byte-inertness (75-golden green after adding `rotationHours`). *(→ "Goldens green".)*
- AC-FIGURE(b): magnitude bands at reference inputs — Earth `f ∈ [2e-3, 6e-3]`, Jupiter `f ∈ [0.04, 0.15]`, physically ordered; despun case `fPresent ≠ fFossil`. grep-deny `shellThickness` in `bodyFigure.js`. **Band-vs-contract note (folds lens B-m5):** the plan's Jupiter band `[0.04, 0.15]` sits deliberately **above** the contract's stated "~0.06" — the homogeneous (5/4) Maclaurin coefficient overestimates centrally-condensed Jupiter ~2× (`f≈0.11` vs the real ~0.065). This divergence is intentional (the real gate is *ordering* Earth ≪ Jupiter, not the exact number; refinement deferred, §6.4/§9 R-figure-coefficient), and is recorded in SUBSTRATE-MAP so the band is not later mistaken for an error against the contract's figure. *(→ "f magnitudes physically ordered; despun case splits present/fossil".)*
- AC-FIGURE(c): an authored/seeded-only w0 path is rejected — the descriptor must be COMPUTED (assert `deriveFigureDescriptor` takes no seed/authored-w0 arg; a mutated `rotationHours` changes `f`). *(→ authored-w0 rejection.)*
- AC-FIGURE(d): the V2-7 stub reads the descriptor and computes an offset. *(→ "stub computes an offset from the descriptor".)*

**Byte-safety.** Which hashed fields could move? **None.** The condition-vector field is nested + read by nothing in the write path (V2-0 precedent); `relief.figure` is a return-object field, not a carrier array; `deriveFigureDescriptor` draws no RNG and touches no carrier. 75-golden + lid-anchors green. *(Verify: golden + anchors in the gate; the grep-deny for `shellThickness`.)*

**Commit boundary → COMMIT 5** `V2-4 slice-5: E2-figure descriptor (D8 plumbed, driver-originated flattening + despun split)`.

---

## §6 — Empirical calibration (committed under `calibration/`, the V2-5s precedent)

Calibration probes are committed headless `.mjs` scripts under `docs/WORKSTREAMS/world-engine-v2-4-substrate-2026-07-14/calibration/` (precedent: `world-engine-v2-5s-shell-multiply-2026-07-12/calibration/*.mjs` — `gain-probes.mjs`/`order-probe.mjs`/`variety-probe.mjs`/`ref-slots.mjs`). Each drives the REAL writers on the deterministic test mesh (`buildIrregularSphere(N, 2)` + `makeSphereField`), seeds {1,2,3,7,42}, and prints reference tables the plan's constants are pinned against. **These are metered-safe: pure `node`, no `claude -p`.**

Constants that need a live/headless calibration pass:
1. **Margin scale anchors → carrier units (`margin-scale.mjs`).** The v1 km/m/deg anchors (SHELF ~80 km/0.5°, BREAK ~140 m, SLOPE ~3°, RISE ~500 km) must be converted to the carrier's normalized height units and geodesic radians. The probe reads the live plate-world `height` distribution and the `BASE_CONT−BASE_OCEAN` step (0.26) to map vertical anchors to fractions of that step (BREAK_DZ ≈ 140 m / ~4500 m continent-ocean relief × 0.26 ≈ 0.008 normalized) and horizontal anchors to geodesic radians (0.5° ≈ 0.0087 rad; resolution-independent). Output: the locked `SHELF_W`/`BREAK_DZ`/`SLOPE_GRAD`/`RISE_W` constants + the `shelfWidthFactor(volatileFraction)` transfer function (anchored so Earth-volatiles ⇒ the reference width). Also prints the **isolated** `shelfWidthFactor(vf)` transfer curve across the `vf` sweep (partition held fixed) so AC-MARGIN(c) monotonicity is read off the width law itself, not the repartition-confounded aggregate (§3 confound isolation, lens B-m3). **Verify the composite reads as coastline morphology, not a re-introduced step** (AC-LAB a).
2. **Province class thresholds (`province-thresholds.mjs`).** The craton/orogen/basin cut points are computed from each field's LIVE distribution (percentile-based, per path — because `grainMag` is degenerate on plate worlds, §4), NOT hard-coded absolutes. The probe prints per-preset field quantiles + the resulting class proportions + the association η² and contiguity metric so the thresholds are pinned to give legible, associating regions across seeds. Also pins `PROVINCE_RELAX_PASSES` (fixed; justify, don't interpolate).
3. **Association significance threshold (`assoc-null.mjs`).** Prints the **contiguity-preserving spatial-null** distribution (NPERM=200 random blob-scale position-noise partitions — NOT a label shuffle; §4) of η² across presets×seeds, so the pass line (99th-pct of the spatial null) is an observed number; prints the real province's η² and a sample noise control's η² against that null. Confirms (a) the real province clears the spatial-null p99 (PASS) and (b) the noise control sits inside the spatial null (REJECTED) on every seed. If a preset's real province does NOT clear its spatial null (e.g. `grainMag`-degenerate plate worlds), the probe surfaces it as a finding → thresholds are re-tuned (§6.2), the null is never weakened — the AC-PROVINCE-ASSOC rejection is calibrated against autocorrelation-matched noise, not assumed.
4. **Figure response coefficient (deferred, documented in `figure-magnitudes.mjs`).** The probe prints `f` at Earth/Jupiter/despun reference inputs so the AC-FIGURE(b) bands are observed. **Deferred refinement:** the homogeneous (5/4) coefficient overestimates centrally-condensed bodies ~2× (Jupiter 0.11 vs real 0.065); a Darwin–Radau response coefficient (using a moment-of-inertia factor, which we have no per-body driver for) is the accuracy fix — parked, because V2-7 CYCLE-2 needs order-of-magnitude + the present/fossil split only. Recorded as a named non-goal in SUBSTRATE-MAP.

---

## §7 — Docs (AC-DOCS, Rule 3) — gates the increment

**`SUBSTRATE-MAP.md`** (this workstream dir) carries, for EACH of the five fields — `sediment`, `accommodation`, `shelfDepth`(margins), `province`, figure-descriptor — the four-part record (AC-DOCS):
1. **Function** (plain language).
2. **Position in the write-history → read-history pipeline** (which tier/writer writes it, which stage reads it — the spine §4c/§1 vocabulary): `accommodation` written post-relief in `writeBodyRelief`, read by V2-8 sink-ranking + the province derivation; `shelfDepth` written by `passiveMargins` on the plate path, read by the `route()` composite → render + V2-8; `province` written post-accommodation, read by the lab overlay now + V2-9 palette later; figure written on the relief return, read by V2-7 CYCLE-2; `sediment` a zero host, written by V2-8.
3. **Named consumers** (the AC-0 list).
4. **Deliberate non-goals** — `accommodation`'s no-mass-conservation clause; `sediment`'s V2-4-does-not-deposit clause; figure's no-render clause + the (5/4) homogeneous-coefficient (with the explicit note that the AC-FIGURE(b) Jupiter band `[0.04,0.15]` is ~2× above the contract's "~0.06" **by design** — ordering is the gate, exact value deferred; lens B-m5) + `PRIMORDIAL_SPIN_HOURS` fiducial; margins' own-channel (never `carrier.height`) clause + the AC-MARGIN(c) `shelfWidthFactor`-isolation-vs-repartition-confound note; province's not-the-`gProvince`-rewire clause + the contiguity-preserving spatial-null (not label-shuffle) rationale.

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
- **R-atmo-collision.** Only a *visible-oblateness render* would touch the atmo vertex/geometry path — and figure is **descriptor-only this increment** (no render), so the one real collision is descoped. The province overlay is the other candidate to touch that path (a naive "recolor the planet" would add an attribute to the shared planet BufferGeometry or a branch to the shared shader); §4 PINS it to a **separate ground-owned debug mesh / ribbon-only recolor** that adds no attribute to and edits no line of the atmo-shared planet vertex/fragment shader (`aBand`/`aShear`/`aMush` at `:200-206` decl / `:1436-1438` set / `:2775-2777` update — untouched). Any margin GUI stays ground-owned. So **nothing in V2-4 touches the atmo vertex/geometry path. Atmosphere suites green unchanged (AC-ZERO-CLOBBER d).**
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

| Slice | Planned | Actual | Reason | AC-impact |
|---|---|---|---|---|
| C1 | "DEPTH_SCALE normalizes the deepest expected basin to 1" (constant framing) | `depthScale = refDatum − min(height)` derived live per carrier | Deepest sink maps to exactly 1 on every world without a magic constant | None — AC-CHANNELS bounds/non-degeneracy hold; verifier byte-matched an independent reimplementation |
| C1 | Sink-ranking grep over the file | Grep slices the `writeAccommodation` body only; doc comments reworded to avoid `*=`/`+=`/mass/volume tokens | Comments *describing* the absent volumetric terms false-positived the denylist | None — the assertion still denies volumetric code in the writer |
| C2 | Fixtures under `calibration/`; mixedInterior-only fixture | `tests/fixtures/v2-4-stress-fabric-*` covering ALL FOUR call sites (SHA-256-of-height idiom, `v2-0-carrier-golden.mjs` mold) | Repo fixture idiom + strictly stronger coverage (4 sites vs 1) | Strengthens AC-FABRIC; hash-equality ⟺ byte-equality |
| C2 | Cite "the lidDisruption.js precedent" in the module comment | Rephrased to "the V2-7d family-module extraction mold" | `worldengine-lid-disruption.test.js` AC-ZERO-WIRING greps ALL of src/ for the substring `lidDisruption` — even comments fail it | None — comment-only, byte-inert; caught by the full-suite gate in-build |
| C2 | (not planned) | `tests/worldengine-mixed-composer.test.js` import-allowlist 3→4 (adds `./stressFabric.js`) | The composer's import-fence test must admit the new shared module | None — the fence's intent (no rogue imports) preserved |
| C3 | Along-coast jitter draws from `alea('margin:'+seed)` | Pure RNG-free seed-phased vertex-direction hash (±6%); `'margin:'` namespace reserved-not-consumed | §0 "prefer derivation" + determinism designDecision; strengthens AC-MARGIN(d) (writer greps no-alea) | AC-MARGIN(d) strengthened; impl and test agree |
| C3 | (not planned) | `relief-router-repoint.test.js` + `relief-height-cube.test.js` SPLIT-TRAP greps updated `carrier.height`→`marginHeight` (+ added `marginHeight = composited \|\| carrier.height` check) | §3 renames the two route() consumers; the guard tests assert the source literally | Guard invariant (single shared DATA source, never `sampler.read`) preserved + strengthened |
| C3 | AC-MARGIN(a) four-zone morphology on the sampled channel | Four-zone structure proven on the mesh-independent `marginProfileFrac` (gSlope > 5×gShelf and > 5×gRise) + applied membership/monotonicity on the channel | Shelf/break/slope (≤1.08°) are SUB-NODE at every practical mesh (meanEdgeAngle ≈2.5° @ N8000); the sampled channel reads as a monotone coast→abyss apron dominated by the rise | ⚠ CARRIES TO AC-LAB/AC-UAT: the visible render is a smooth graded apron, not a resolved shelf-break — surfaced to Max pre-UAT, his call there |
| C3 | (implicit in AC-DOCS) | SUBSTRATE-MAP.md NOT authored at C3 | AC-DOCS is increment-level: the five-field map spans slices C4/C5 that don't exist yet; margins record lives in the module header + committed calibration probe meanwhile | OWED at the increment doc pass (before verify-workstream) — working-Claude's item |
| C3 | Margin GUI in the lab (optional) | Not added | Optional per plan; probe + channel suffice for the unit gate; GUI folds into the AC-LAB drive if needed | None at unit layer |
| C2/C3 | shadow-audit pinned at 24 | 25 after C2, 26 after C3 | The suite dynamically enumerates `src/worldengine/base/*.js` — each new module adds one E1-blind guard that PASSES | None — growth-by-enumeration, not regression; gate reading updated |
| C4 | `'province:'+seed` consumed for a two-way majority-relax tie-break | RNG-FREE: relax ties KEEP the current label (deterministic); the `'province:'` namespace is RESERVED-not-consumed (mirrors C3's margin-jitter deviation) | §0 "prefer derivation" + the determinism designDecision; a field-deterministic writer is a stronger byte story than a seeded tie-break | AC-PROVINCE-ASSOC(determinism) STRENGTHENED — writeProvince body greps no alea/Math.random/Date.now; impl+test agree |
| C4 | province.js is RNG-free like passiveMargins.js (whole-file alea grep) | province.js DOES `import alea` — but ONLY for the test/calibration spatial-null instrument (`spatialNullPartition`); the RNG-free assertion slices the `writeProvince` FUNCTION BODY, not the whole file | The contiguity-preserving null legitimately needs seeded entropy and the plan wants the instrument EXPORTED + reusable (V2-9); the production WRITER stays field-deterministic | None — writeProvince draws no alea; the null runs only in tests/calibration, never the production seam (byte-inert) |
| C4 | Spatial null "matched in region count + patch size" (unpinned mechanism) | K = the real province's connected-COMPONENT count (post-relax); cells = multi-source BFS Voronoi from K seeds (bounded partial Fisher–Yates, no while-to-convergence); cells 3-coloured ~ the real class proportions | Matching K to the component count matches the mean patch size on a fixed sphere; Voronoi cells are contiguous+structureless (no field read) — exactly the autocorrelation-matched comparison lens B#2 requires | None — assoc-null.mjs confirms real η² (0.23–0.62) clears null p99 (0.04–0.17) and the control is REJECTED on every preset×seed |
| C4 | Association η² field set (unpinned) | Computed on the RAW history fields [faultDensity, grainMag, accommodation]; degenerate fields (plate-path grainMag) auto-DROPPED from BOTH real+null scoring (apples-to-apples) | "mean η² of the history fields" = the raw fields; dropping degenerate fields is the path-degeneracy handling §4 requires | None — Mars/despun (grainMag speckle erased by relax, orogen≈0) still clears via accommodation; surfaced as a finding, not a fail |
| C4 | Overlay "probe exposes the carrier field" (mechanism unpinned) | Added `reliefCarrier` (module-level `let` + read-only getter) to `createRiverOverlay` so the ground-owned lab overlay/probe reads the live `carrier.province` (+ history fields); overlay = a SEPARATE `THREE.Mesh` on a NEW `BufferGeometry` (irregular-sphere verts/faces, per-vertex province colours, `MeshBasicMaterial{vertexColors}`) — the plan's "separate debug mesh" option | The carrier is `const`-local to `route()`; a retained handle is the minimal seam. The separate-geometry mesh adds NO attribute to the shared planet geometry + edits NO shader line (atmo fence held) | None — AC-ZERO-CLOBBER(d) atmo suites green unchanged; default-hidden ⇒ byte-identical render |
| C4 | shadow-audit 26 after C3 | 27 after C4 (+1 `province.js` E1-blind guard, PASSES) | Same dynamic enumeration of `src/worldengine/base/*.js` | None — growth-by-enumeration; gate reads 27 |
| C4 | (implicit AC-DOCS) | SUBSTRATE-MAP.md still NOT authored at C4 | Increment-level doc pass spans C4+C5 (figure); province's record lives in the module header + the two committed calibration probes meanwhile | OWED at the increment doc pass (before verify-workstream), alongside C3's margins record — working-Claude's item |
