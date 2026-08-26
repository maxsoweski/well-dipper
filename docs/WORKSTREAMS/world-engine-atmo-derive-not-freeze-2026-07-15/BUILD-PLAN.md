# BUILD-PLAN — world-engine-atmo-derive-not-freeze-2026-07-15

> **Author:** BUILD-PLAN subagent, 2026-07-15, worktree `~/projects/well-dipper-atmo`
> (branch `feature/world-engine-atmo-3b`). Symbol anchors only — never line numbers.
> **Binding scope pins (from contract designDecisions — do NOT re-litigate):** wiring fix =
> slice 1; D-slot derivation per ATMOSPHERE-PLAN §(e); canonical-N DEMOTED to regime-conditioned
> prior + per-seed presence gating (Max re-ruling supersedes Rider B); provenance/GUI routed OUT
> to `planet-lod-lab-ux`; minimal lab-HTML footprint; generative-not-simulative (NO `uTime` in any
> storm term); determinism on disjoint alea namespaces.

---

## 0. Grounding — the two mechanisms this increment moves, verified against code

**Mechanism 1 — the wiring gap (the confirmed bug, slice 1).** The discrete-vortex derivation
(the `resolveStormE(...)` call → `state.spotCenter/spotRadius/spotRot/spotAspect/spotMode/`
`spotColor/spotCompanion`, `state.trainSpots[]/trainCount`, `state.polarStrength/polarMode/`
`polarSides/polarR0/polarRing/polarPole/polarPhase`) lives INSIDE `applyDrivers` (the block after
the `rebakeE5Bands()` call). The two reseed paths — the `newPlanet` closure and the `macroSeed`
GUI `.onChange` (both in the Seeds folder `fSeeds`) — call only `updateSeedUniforms()` +
`rebakeE5Bands()`. `rebakeE5Bands()` re-bakes the `aStorm` MASK attribute (via
`bakeStormEAttributes`) at the new `macroSeed`, but **never re-runs the discrete-vortex block**, so
`state.spot*/train*/polar*` stay frozen and the per-frame carriage-filler (the
`uniforms.uStormPosSize.value[...]/uStormCount/uPolar*` composition block, gated by
`greatSpotEnabled`/`stormTrainEnabled`/`polarVortexEnabled`) writes the OLD placement. This is why
the storm-folder 🎲 buttons (`fSpot`/`fTrain`/`fPolar` roll → `state.stormSeed = …; applyDrivers()`)
DO re-place while New-planet / macro-slider do not — and it is the same root as the "transient
GUI-only mask/vortex seed skew" logged in `evidence/README.md` (the mask re-bakes on the reseed path
but the vortices don't, so mask and vortices momentarily disagree).

**Mechanism 2 — the frozen shear profile (the D-slot debt, slices D/P).** `resolveStormE` places
the primary at the anticyclonic-shear argmax over the #3a jet profile (`resolveStormPlacement(P)` →
`jetShear`/`jetShearPeak` from `climate-e5.js`). That profile's SHAPE — band count `m`
(`rhinesWavenumber`, reads `uPeak`), equatorial drift sign `sEq` (`equatorialJetSign(shellDepthFrac)`),
amplitude `uPeak` (`amplitudeLaw(internalHeat, dissipation, shellDepthFrac)`) — is a pure function of
the THREE frozen constants `shellDepthFrac`/`internalHeat`/`dissipation` (fixed per regime in
`DRIVER_BUNDLES`) plus `rotationRate`/`radius`. Within a regime those three never move, so `m`, the
`|shear|` envelope, and the argmax-latitude SET are byte-identical across seeds — only `phaseJet`
(seeded in `resolveParams` off `macroSeed`) shifts the band phase. Result: same band count, same
drift signs, storms on the same belts every seed. Deriving the three constants per-seed from the
condition bundle is the namesake fix; it makes `m`/`sEq`/`uPeak` — hence band count, drift direction,
and storm latitudes — genuinely per-seed while staying regime-plausible.

**Architectural decision that protects both goldens (load-bearing):** the D-slot derivation lives in
a NEW module and reaches `climate-e5.js` / `storm-e.js` **only through the `drivers` argument**
(`resolveParams` already merges caller `drivers` over the frozen `DRIVER_BUNDLES`; `resolveStormE`
forwards `drivers` into `resolveParams`). **`climate-e5.js` is NOT edited.** Its headless tests call
with the frozen bundle (no derived drivers) → `GOLDEN_BANDFIELD_HASH -1329854088` preserved. The
storm-e mask golden (`GOLDEN_STORM_MASK_HASH`, captured with plain `GAS = {composition:'h2-he'}` and
NO derived drivers) likewise stays on the frozen-bundle path → preserved by construction. Only the
LAB (and the new derived-path unit tests) pass derived D-slots.

---

## 1. Slice decomposition (each independently verifiable + committable)

| Slice | Name | Lights | Fence surface | Depends |
|---|---|---|---|---|
| **1** | **WIRING** — reseed paths re-place storms/pole | AC-WIRING; partial AC-LAT (phaseJet-driven) | lab: factor `applyStormState()`; wire `newPlanet` + `macroSeed`; fold vortex+mask coherence into one reseed seam | — |
| **R** | **RESEARCH** — pin D-slot derivation forms + regime-plausible condition ranges | (doc; unblocks D) | `docs/…/DERIVE-FORMS.md` only | — |
| **D** | **DERIVER** — new `giant-drivers.js`; per-seed conditions → D-slots → bands+storms | AC-LAT, AC-BANDS | new module + test; lab passes derived drivers to BOTH `bakeClimateE5Attributes` and the storm resolve | R |
| **P** | **POLAR** — presence gating + N-around-prior + per-seed size/shape/position | AC-POLAR | `storm-e.js` `resolvePole` + revise `storm-e.test.js` V-β.2/[gate] | D |
| **V** | **LIVE + REGRESSION** — drive :5178, evidence, full battery | AC-WIRING(live), AC-LIVE-VARIETY, AC-REGRESSION | working-Claude live drive; no source change | 1,D,P |

**Re-scope gate (V2-2b/atmo-3b precedent):** if D or P balloons past a coherent unit, split again —
do not grow silently. Slice 1 ships value on its own (reseeds finally re-place; latitudes shift via
`phaseJet`); it is the safe first landing even if R/D slip.

---

## 2. Slice 1 — WIRING FIX (design)

**Refactor (single seam, kills the skew).** Extract the discrete-vortex derivation currently inside
`applyDrivers` into a named lab function `applyStormState()` that: (a) builds `_stormRegime` +
`_stormDrivers` (composition gas-gate, `T_eq`, `rotationRate`, `radius`, obliquity — plus the derived
D-slots once slice D lands), (b) calls `resolveStormE(_stormRegime, _stormDrivers, macroSeed,`
`stormSeed)`, (c) materializes `state.spot*/trainSpots[]/trainCount/polar*` + the `_stormColor`
chromophore mapping (reads the already-set `state.bandTint` — valid on reseed because the preset is
unchanged). `applyDrivers` calls `rebakeE5Bands(); applyStormState();` in place of the inlined block.

**Coherence rule (resolves the transient mask/vortex skew).** The reseed seam must re-run BOTH the
mask bake and the vortex resolve from the SAME `(regime, derivedDrivers, macroSeed, stormSeed)`.
Implement a thin `reseedGiant()` wrapper = `updateSeedUniforms(); rebakeE5Bands(); applyStormState();`
and point the `newPlanet` closure and the `macroSeed` `.onChange` at it. Because `rebakeE5Bands`
(mask via `bakeStormEAttributes`) and `applyStormState` (discrete via `resolveStormE`) now always
fire together off one seed, the mask and the slots can never disagree — the `evidence/README.md`
"someday-item" skew is closed as a side effect.

**[RESOLVED-BY-REVISE: 1] Route `_lab.setSeed` through `reseedGiant()` too — it is a THIRD reseed
path and the one the evidence actually uses.** Verified: the `setSeed(macro, detail)` method on the
`_lab` console object (near `carveEpoch`) currently calls ONLY `updateSeedUniforms()` — it never
`rebakeE5Bands()` and never re-runs the storm block. It is the exact path contract designDecision-1
used to DEMONSTRATE the frozen-storm bug (`_lab.setSeed(42)` → `spotCenter/trainLons/polarPhase`
bit-identical). It is also the only DETERMINISTIC reseed entry: the GUI `newPlanet` button uses
`Math.random`, so both AC-LIVE-VARIETY's same-seed AE=0 repeat and AC-WIRING's reproducible
before/after cross-check must reseed via `setSeed` (or via `state.macroSeed = N` + the slider path).
If `setSeed` is left on the bare `updateSeedUniforms()` path, storms AND bands stay frozen through
it (note `updateSeedUniforms` only schedules the debounced river reroute; it does NOT bake E5 bands),
so the increment reads broken exactly where the evidence is captured. Fix: replace the
`updateSeedUniforms()` call inside `setSeed` with `reseedGiant()` (guarded so it is inert on
non-gas presets — `rebakeE5Bands`/`applyStormState` already early-return when there is no E5 regime).
This is in the slice-1 lab-reseed-wiring fence.

**Slider-drag frequency — resolved WITHOUT debounce.** The `macroSeed` slider has integer step 1, so
a drag emits discrete seed values. The added per-drag cost is `resolveStormE` (an O(`STORM_PHYS.SAMPLES`
= 721) argmax + a handful of alea draws) — negligible beside `rebakeE5Bands`, which already bakes four
whole-sphere attribute arrays (`aBand/aShear/aMush/aStorm`) on every drag today. So run
`applyStormState()` on every `onChange`, matching the existing `rebakeE5Bands`-per-drag cadence; do
NOT call the full `applyDrivers` on drag (it re-derives all relief/emission uniforms — genuinely
expensive and unnecessary for a seed change). No debounce, no on-release special-casing. (If a future
profiling pass shows the four attribute bakes janking on drag, debounce `rebakeE5Bands` itself — a
separate lab-ux concern, out of scope here.)

**What slice 1 alone delivers.** With the wiring fixed but D-slots still frozen, a New-planet /
macro-slider reseed re-runs `resolveStormE` at the new `macroSeed` → `resolveParams` redraws
`phaseJet` → the jet profile shifts phase → the argmax-latitude set moves (the band-phase shift is
real, not epsilon). This satisfies **AC-WIRING** fully and moves AC-LAT partway. It does NOT yet vary
band COUNT or drift SIGN (those need D-slot variety) — that is exactly why the contract folds the
deriver in rather than shipping the wiring fix standalone.

**AC-WIRING verification.** In-lab on :5178: capture `state.spotCenter/trainLons/polarPhase` before,
click `newPlanet` (and separately drag `macroSeed`), capture after → post ≠ pre AND post bit-matches
an independent in-page `resolveStormE(regime, drivers, newSeed, stormSeed)` call. (Mirrors the
`evidence/README.md` argmax cross-check already used for the 🎲 path.)

**Fence for slice 1:** lab only — `fSeeds` closures, the `_lab.setSeed` method
([RESOLVED-BY-REVISE: 1]), the extracted `applyStormState`, and its call sites. No
`climate-e5.js`/`storm-e.js`/GLSL edit. The per-frame carriage-filler
(`uniforms.uStormPosSize.value[…]/uStormCount/uPolar*`) and the three enable gates are UNCHANGED.

---

## 3. Slice R — RESEARCH SLICE (bounded; declared, not invented)

**Why a research slice is required (not optional).** The D-slot derivation forms are genuinely
under-determined by the repo. ATMOSPHERE-PLAN §(e) names the DIRECTION ("a per-body seed→driver
DERIVATION of shellDepthFrac/internalHeat/dissipation from real D-slots — mass/gravity D14, age D16,
composition/metallicity, eccentricity — the atmosphere analog of the GROUND track's driver-response
passes") and the L0 audit records that `dissipation`'s physical basis "isn't even the same concept as
any existing driver." The consuming LAWS are pinned (`amplitudeLaw`, `rhinesWavenumber`,
`equatorialJetSign` in `climate-e5.js`) but the FORMS that produce the three inputs from
more-fundamental conditions are NOT in any repo research doc. Inventing coefficients here would breach
the "driven first by physics/astronomy" ruling and the determinism-discipline honesty bar. Precedent:
atmo-3b's slice R (web-grounded researchers → synthesis → adversarial audit).

**Scope (bounded — write `DERIVE-FORMS.md`).** Establish, grounded in giant-planet interior /
thermal-evolution literature (Fortney/Nettelmann interior models, Guillot; Pearl & Conrath internal
flux; Rhines/Showman jet-scaling), and cross-checked against the condition-vector fields the lab
already surfaces (`body-condition-vector.js`: `surfaceGravity`, `radiusEarth`, `density`, `age`,
`eccentricity`, `composition`, `shellThickness`):

1. **Regime-plausible condition RANGES** per giant regime (Jovian/Saturnian/Neptunian/Sub-Neptune) —
   the mass/gravity, age, metallicity, shell-thickness, eccentricity envelope a seed may sample so the
   re-roll stays that regime (a Jovian seed sweep must not morph into an ice giant).
2. **Derivation FORMS** condition → each of `shellDepthFrac`, `internalHeat`, `dissipation`: the
   monotonicity + sign of each dependency (e.g. shellDepthFrac ↑ with mass/metallicity via the deeper
   molecular→metallic transition fraction; internalHeat ↑ with mass and ↓ with age via residual
   formation + contraction flux, capturing Neptune's anomalously high flux; dissipation's basis and
   its coupling to the wind-paradox denominator), each with a plausible numeric range and the citation.
3. **The ANCHOR constraint (non-negotiable):** at each regime's CANONICAL condition vector the forms
   must reproduce that regime's current `DRIVER_BUNDLES` triple within a stated tolerance, so the
   textbook body still reads like itself and the shipped #3a/#3b reads are preserved.

**Deliverable:** `DERIVE-FORMS.md` with a forms table (input → output, sign, range, citation), the
per-regime ranges, and the anchor-reproduction check. **Verification:** adversarial audit (atmo-3b
pattern) — web-verify any surprising claim, reject fabricated citations. Max ratification is NOT a
hard gate here (the contract pins forms "at BUILD-PLAN with a research slice if needed", it does not
add a taxonomy-style ratify gate), but surface the forms table to Max for a nod before slice D wires
constants, since the ranges are a taste-adjacent "how different is plausible" call.

---

## 4. Slice D — D-SLOT DERIVER (design)

**New module `src/worldengine/base/giant-drivers.js`** (an atmosphere writer this branch owns; NOT
relief/dispatch). Two pure pieces so the seed-draw and the physics-map test separately:

- `drawGiantConditions(regime, baseCondition, macroSeed)` — draws a regime-plausible per-body
  condition perturbation (mass/gravity, age, metallicity, shell-thickness, eccentricity within the
  slice-R ranges) on a NEW disjoint alea namespace **`giantD:cond:<regime>:<macroSeed>`**, anchored so
  the derivation reproduces the canonical bundle at the canonical draw. Fixed draw order; no
  `Math.random`/`Date.now`.
- `deriveGiantDrivers(condition)` — PURE (no rng): condition → `{ shellDepthFrac, internalHeat,`
  `dissipation }` per the slice-R forms, clamped to the regime range.

The seed enters ONLY via `drawGiantConditions`; the physics map is pure. This mirrors the ground
track's condition→driver-response split and keeps "same seed ⇒ same world."

**Lab wiring (minimal footprint).** In `rebakeE5Bands` and `applyStormState`, after building the base
`drivers`, compute `const _gd = deriveGiantDrivers(drawGiantConditions(regime, condition, macroSeed))`
and spread `_gd` into ALL THREE derived-driver consumers.

> **[RESOLVED-BY-REVISE-2: minor-1] (must-fix-grade) There are THREE consumers of the derived triple, not
> two.** Verified: `rebakeE5Bands` bakes the storm MASK via `bakeStormEAttributes` using a SEPARATE object
> `_sd = { ...drivers, composition, T_eq }` (built AFTER the bands `drivers`), while `applyStormState`
> resolves the VORTICES via `resolveStormE(_stormDrivers)` (its own object too). So `_gd` must reach (a) the
> `bakeClimateE5Attributes` `drivers` (bands), (b) the `_sd` mask drivers, and (c) the `_stormDrivers` vortex
> drivers. Spread `_gd` into the base `drivers` at its construction — BEFORE `_sd` is built from `...drivers`,
> so `_sd` inherits it — and independently into `_stormDrivers`. If `_gd` reaches (a)+(c) but NOT (b), the
> mask bakes FROZEN while the vortices DERIVE — the exact mask/vortex skew §2's coherence rule exists to
> kill, and NO §6 floor detects it (every §6 floor reads placement/bands; none compares mask-vs-vortex
> drivers). The §7b-ii named-consumer audit checks all three.

> **[RESOLVED-BY-REVISE: 2] Derive `condition` FRESH at each call site — do NOT read
> `state._lastBodyDrivers.condition`.** Verified: `state._lastBodyDrivers` is written ONLY inside
> `ensureNetworkRouted`, which is reached via the DEBOUNCED `riverRerouteDebounced` (`updateSeedUniforms`
> schedules it on a timer, so it fires AFTER the reseed/preset call stack unwinds) — and it is
> `undefined` before the first route. The lab boots on the `Rocky (Earthlike)` preset (no E5 regime),
> so the first time Max switches to a giant, `rebakeE5Bands`/`applyStormState` run SYNCHRONOUSLY while
> `state._lastBodyDrivers` still holds the prior (Rocky / last-routed) `condition` — wrong-preset
> derivation, or a `TypeError` on `.condition` at first paint — and then a same-seed render
> discontinuity once the debounce settles (breaks AC-WIRING's in-page bit-match). Fix: at each call
> site derive `const condition = deriveConditionVector(_fp, u, state.planetRadiusEarth)` — the SAME
> single-source pure derive `buildBodyDrivers` uses (`_cond` there) — with `u = state._derived ||
> deriveUniforms(_fp, driverUI.qualityTier)` (the exact fallback `ensureNetworkRouted` already uses).
> `deriveConditionVector` is a pure `(_fp,u,radius)→condition` map with NO `macroSeed` dependency, so
> the per-seed variety still comes entirely from `drawGiantConditions(regime, condition, macroSeed)`;
> deriving fresh only makes the BASE condition correct-for-the-current-preset and available on the
> first synchronous bake.

Because `resolveParams` merges `drivers` over `DRIVER_BUNDLES`, the derived triple overrides the frozen
constants for the bands bake AND the storm placement — coherently, so storms still sit on the
per-seed-varied jets. **`climate-e5.js` untouched.** Optional new GUI: expose the three derived
D-slots as read-only/​override sliders in the Bands folder (`fBands`) — the contract's permitted "new
D-slot sliders only". No provenance badging (routed to `planet-lod-lab-ux`).

**Why this lights AC-LAT + AC-BANDS.** Per-seed `shellDepthFrac`/`internalHeat`/`dissipation` →
per-seed `uPeak` (`amplitudeLaw`) → per-seed `m` (`rhinesWavenumber`) and per-seed `sEq`
(`equatorialJetSign`, which FLIPS if a drawn `shellDepthFrac` crosses `PHYS.D_THR = 0.40`). Band count
`m`, band-edge positions (zero-crossings of `jetProfile`), widths, and per-band drift SIGN (the sign
of `bandField` the F25 render advection reads — render unchanged) all become per-seed. The storm
argmax runs over this per-seed profile → storm latitudes derive per seed and stay within the derived
anticyclonic shear band (regime-plausible). Same seed → identical draw → identical everything.

---

## 5. Slice P — POLAR (design; canonical-N demotion)

**Edit `resolvePole` in `storm-e.js`** (mask golden is `stormE:place`-derived, so pole edits do NOT
move it):

- **Presence gating (AC-POLAR "don't always appear").** Replace the always-on
  `strength: stormsOn ? 1 : 0` with a per-seed coin flip against a regime+condition-conditioned
  probability: `present = stormsOn && rng() < polarPresenceProb(regime, derivedConditions)`. Prob near
  1 for Jovian (Juno poles ~always structured), lower for ice-giant / Uranian (leaner, seasonal). The
  seed decides the flip on the existing `stormE:polar` stream; the PROBABILITY is the regime-conditioned
  prior. Some seeds → no vortex where the prior allows.
  **[RESOLVED-BY-REVISE-2: 2] Pin the priors as named constants** — a new `POLAR_PRESENCE_PRIOR` frozen
  table, each entry a DECLARED scalar naming its future deriver (AC-0 §7b-i): Jovian ≥ 0.95, Saturnian ≥ 0.95
  (Juno / Cassini poles are persistently structured), Neptunian ≤ 0.8, Sub-Neptune ≤ 0.8 (leaner / seasonal).
  **Expectation to surface to Max (see §10):** with these priors Jovian & Saturnian poles STILL effectively
  always appear — physically honest, but it under-delivers AC-POLAR's "don't always appear" for those two
  regimes BY DESIGN; the presence-flip variety lands on the ice-giant / sub-Neptune regimes.
- **N around the prior (Rider-B demotion — Max re-ruling).** `sides`/`ring` become
  `clamp(POLAR_N_MIN, POLAR_N_MIN+POLAR_N_SPAN, priorN + delta)` where `priorN = POLAR_CANONICAL_N[regime]`
  and `delta` is a seeded pick from `{-1,0,+1}` weighted toward 0 (modal N = prior). Saturn-like stays
  hexagon-LIKELY (mode 6), not pinned; other regimes may morph.
- **Size/shape/position per seed** already vary (`r0`, `poleSign`, `phase` off `stormE:polar`) — keep;
  add per-seed aspect/lobe variation if the render carriage carries it without a new uniform
  (`uPolarR0`/`uPolarPhase`/`uPolarPole`/`uPolarSides`/`uPolarRing` already carry size/orientation/N).

**Draw-order discipline.** APPEND the new presence + N-delta draws AFTER the existing `stormE:polar`
draws (`r0`, `poleSign`, `phase`, `ageScalar`, `phaseScalar`) so the existing scalars keep their
values and only the newly-appended draws add per-seed presence/N. This minimizes churn and keeps the
per-seed determinism test trivially green.

**Test revision (expected — this increment SUPERSEDES the old assertions).** `worldengine-base-storm-e.test.js`:
the `[V-β.2]` test (asserts pole N is the canonical constant, seed-INVARIANT) and the `[gate]` test
(asserts gas ⇒ `pole.strength === 1`) encode the FROZEN behavior Max re-ruled out. Revise them to
assert the new contract: N varies per seed with MODE == prior (Saturn modal 6); presence flips across
a seed sweep at a regime-appropriate rate; same seed reproduces exactly. This is a sanctioned in-scope
test update (the golden it protects is behavioral, owned by this increment), NOT a re-capture of a
byte-immutable fixture.

---

## 6. Quantified variance floors (a trivial/cheat implementation CANNOT pass — see AC-DERIVER for the frozen-triple case the OUTPUT floors alone miss)

Floors are computed over a **pinned seed sweep of ≥12 macroSeeds per giant regime, run twice per seed**
(determinism), on the SAME carrier mesh so fields are node-aligned (plate-variety mold). Cheats named
per AC.

### AC-DERIVER (the deriver is actually engaged — the load-bearing anti-cheat)
**[RESOLVED-BY-REVISE-2: 1] The §6 headline was too strong for the ULTIMATE cheat: `deriveGiantDrivers`
returning the frozen `DRIVER_BUNDLES` triple verbatim.** Verified against code: `pvStaircaseScore` (storm-e)
normalizes `|jetShear|` by `jetShearPeak`, and `jetShear = P.uPeak·h(lat)` (climate-e5 `jetShear`) — so
`uPeak` CANCELS EXACTLY in the placement score. `internalHeat`/`dissipation` reach placement latitude ONLY
through an integer `rhinesWavenumber` jump, and `sEq = tanh(K·(shellDepthFrac−D_THR))` is saturated at Jovian
0.80 / Saturnian 0.90. Therefore a frozen-triple deriver STILL produces per-seed latitude AND band-edge
variety from `phaseJet`/`ampJitter` ALONE (both already drawn in `resolveParams` off `macroSeed`): it clears
every AC-LAT floor (set-size, spread, argmax-`.lat`-equality, regime-plausible), and — once the revise-pass
fallbacks measure-away/drop bandCount, corr, and eqSign — every AC-BANDS floor too (edge-position spread also
moves with `phaseJet`). The output floors cannot tell "derived D-slots" from "frozen D-slots + `phaseJet`".
Fix — bind the test DIRECTLY to the deriver, in the new `worldengine-base-giant-drivers.test.js`:
- **(D1) uPeak varies:** `new Set(derived uPeak).size ≥ ⌈0.75·N⌉` across the sweep.
- **(D2) uPeak spread:** `stdev(derived uPeak) ≥ <stated fraction>` of the ratified slice-R uPeak range
  (fraction pinned at slice D from the DERIVE-FORMS range — measure-first per [RESOLVED-BY-REVISE: 3]).
- **(D3) canonical-anchor reproduction:** at each regime's canonical condition vector `deriveGiantDrivers`
  reproduces that regime's `DRIVER_BUNDLES` {shellDepthFrac, internalHeat, dissipation} within the slice-R
  tolerance (the §3 anchor constraint).
- **(D4) per-dependency monotonicity:** each condition→D-slot dependency moves in the sign DERIVE-FORMS
  declares (perturb one input, assert direction).
- **(D5) derived ≠ frozen:** derived-path `params.uPeak` ≠ the frozen-bundle `uPeak` for ≥3/4 of the sweep
  (kills the verbatim-passthrough cheat directly).
These are the floors that make the §6 header true. The OUTPUT floors below stay necessary (they catch
epsilon/phase-only cheats and prove regime-plausibility) but are NOT sufficient alone.

### AC-LAT (storm latitudes)
- **Cheat rejected:** epsilon-jitter on latitude (`lat += small·rng()`), and phase-only motion that
  never changes which belt.
- **Floors:** (1) **No bit-shared latitude across all seeds** — `new Set(primaryLat).size ≥ ⌈0.75·N⌉`
  (at least ¾ of the 12 seeds give a distinct primary latitude). (2) **Spread** — stdev of primary
  |lat| across the sweep `≥ 0.08 rad` (~4.6°; a real belt-to-belt jump, not jitter).
  **[RESOLVED-BY-REVISE: minor-2] Validate the `0.08 rad` threshold against the live slice-D sweep
  before pinning** — the spread hinges on the slice-R `uPeak`/`m` range producing an argmax swing
  across belts; a tight regime-plausible range may fall short. Measure the actual primary-|lat| stdev
  on the sweep and set the floor at a defensible fraction of the observed spread (still a real
  belt-jump bar, not a guessed magnitude); if the ratified range cannot clear a meaningful spread,
  that is a slice-R signal (see R1/R3), surface it rather than weakening the floor silently. (3) **The
  anti-cheat that kills epsilon-jitter:** every primary/train latitude must EQUAL the argmax of the
  arm's-length `resolveStormPlacement(returnedParams).ranked` (the existing AC-WRITER(d) mold, `.lat`
  bit-equality). A jittered latitude cannot match the pure argmax → fails.
  **[RESOLVED-BY-REVISE-2: minor-2] Close the `.center` loophole in floor (3):** the `.lat`-equality bar is
  bypassable by jittering the RENDERED `.center` while leaving `.lat` at the true argmax — the
  `iceGiantLifecyclePhase` `renderLat` precedent legitimately sets `primary.center = dirFromLatLon(renderLat,
  pLon) ≠ .lat` (storm-e). So for NON-lifecycle vortices (no `.lifecycle` field — the GRS primary + ALL train
  members, whose `makeVortex` default is `center = dirFromLatLon(lat, lon)`) assert `center ==
  dirFromLatLon(lat, lon)` bit-exactly; only dark-spot lifecycle primaries are exempt. (4)
  **[RESOLVED-BY-REVISE-2: minor-5] Regime-plausible — TRAIN members only, NOT an anti-cheat for the
  primary:** the primary is placed at the global `|shear|` argmax, so `|jetShear| == shearPeak ≥
  0.5·shearPeak` is VACUOUSLY true for it (except when the argmax is pole-filtered past `BELT_Y_MAX`). Keep
  `|jetShear(lat)| ≥ 0.5·shearPeak` as a real bar for TRAIN members (they sit on secondary/weaker maxima);
  the primary's true anti-cheat is floor (3)'s argmax `.lat`-equality. (5) Same-seed pairs bit-identical.

### AC-BANDS (band/jet layout + drift direction)
- **Cheat rejected:** fixed belt template phase-shifted per seed (longitude/phase-only); epsilon jitter
  on jet edges; all bands drifting the same direction every seed.
- **Floors:** (1) **Count varies** — `new Set(bandCount).size ≥ 2` across the sweep (mold:
  `climate-e5` `[AC4]` band-count set; here at FIXED regime/rotation, varied by seed).
  **[RESOLVED-BY-REVISE: minor-2] This floor is NOT safe to hard-pin at BUILD-PLAN** — `bandCount`
  only moves when the drawn `uPeak` swing crosses a `rhinesWavenumber` rounding boundary; a tight,
  regime-plausible slice-R range may not cross one. During slice D, MEASURE the `bandCount` set over
  the live sweep FIRST; keep `≥ 2` only if the ratified range actually produces it, otherwise fall
  back to the edge-position-spread + eqSign metrics below (which do not depend on an integer boundary
  crossing) as the primary count-variety evidence, and record the measured `bandCount` distribution.
  **[RESOLVED-BY-REVISE-2: minor-4] Supportive — wide ranges NOT required:** the canonical Rhines counts sit
  right on `Math.round` boundaries (Jovian n≈12.2 → m 12, a ~5% `uPeak` drop → 13; Saturnian n≈10.7;
  Neptunian n≈2.53, on the 2↔3 edge), and `uPeak ∝ √internalHeat`, so a ±10% internal-heat-class range
  already crosses a boundary and delivers band-COUNT variety. Measure-first still governs the pin, but the
  slice-R ranges need NOT be wide to clear it.
  (2) **[RESOLVED-BY-REVISE: 3] Layout not one field rescaled — MEASURE the corr distribution before
  pinning any ceiling; do NOT ship the guessed `|Pearson corr| < 0.6`.** Verified against
  `climate-e5.js`: `aBand = clamp01(0.5 + 0.5·contrast·jetProfile/normDenom)` and
  `jetProfile = uPeak·(sEq·aEq·g + aMid·sin(m·lat + phaseJet))`. The `sEq·aEq·g` equatorial term is
  phase-INDEPENDENT and shared across same-regime seeds; `m` (`rhinesWavenumber`) takes only 2–3
  values over 12 seeds, so many pairs share `m` and differ only by `phaseJet` + the ±10% `ampJitter`.
  Whether the shared equatorial term keeps the closest same-`m` pair above 0.6 is genuinely
  data-dependent — this is the V2-3 unsatisfiable-gate pattern, and a correct deriver could fail an
  arbitrary 0.6 pin. Resolution: on the slice-D live sweep, compute the actual pairwise `|corr|`
  distribution and SET the ceiling from the measured max-of-satisfiable (a real anti-"one field
  rescaled" bar, e.g. `max|corr| < measured_p95 + margin`), OR — if the shared equatorial term makes
  ANY corr ceiling brittle — DROP corr as a floor and prove "not one field rescaled" via the robust
  metrics instead: `bandCount`-set, band-edge-position spread (stdev of jet zero-crossing latitudes
  across seeds), and the per-band sign-vector disagreement below. Pin the chosen metric+number in the
  slice-D test from measured data, not a priori. (3) **Drift direction varies** — the equatorial drift
  sign `eqSign` (== `sign(jetProfile(0))`) takes BOTH values across the sweep for regimes whose drawn
  `shellDepthFrac` range straddles `D_THR = 0.40`, i.e. `new Set(eqSign).size == 2`; AND the per-band
  sign vector (signs of `bandField` at the jet cores) disagrees across seeds.
  **[RESOLVED-BY-REVISE-2: 3] The sign-vector clause CANNOT use the most-similar pair.** Verified against
  `jetProfile`: the most-similar pair shares `m` (only 2-3 `m` values over 12 seeds) and jet cores sit at
  `u`-extrema far from zero-crossings, so a small `phaseJet` shift flips ~0 core signs — demanding `> 30%`
  disagreement from the LEAST-different pair is UNSATISFIABLE by a correct smooth build (the plate-variety
  mold presumes a discrete partition that flips even for near-seeds; smooth `bandField` signs do not). Fix:
  quantify sign-vector disagreement over a DIFFERENT-`m` pair (where core counts genuinely differ) and
  MEASURE-before-pin at slice D; do NOT pin the 30% a priori. If the sweep yields only one `m` value, this
  clause drops in favor of the D1/D5 deriver floors + edge-position spread.
  **[RESOLVED-BY-REVISE: minor-1] Which regime carries the eqSign-flip floor is DERIVED from the
  ratified slice-R ranges, NOT hard-coded to Neptunian/Sub-Neptune.** Canonical Neptunian
  `shellDepthFrac = 0.15` only straddles `D_THR = 0.40` under an implausibly wide (0.15→0.42) range
  that would violate R3 regime-plausibility; the flip floor applies ONLY to whichever regime's
  ratified range actually crosses 0.40 (likely Sub-Neptune 0.35 alone). If NO ratified range straddles
  `D_THR`, drop floor (3)'s `eqSign`-set assertion entirely and rely on `bandCount` + edge-position +
  per-band-sign variety; do not force an unsatisfiable flip. (4) Same seed reproduces exactly.

### AC-POLAR (presence + N + shape/size/position)
- **Cheat rejected:** presence-always-on; N constant (epsilon or fixed).
- **Floors:** (1) **Presence flips** — across the 12-seed sweep, for regimes whose prior < 1, BOTH
  `present` and `absent` occur (`0 < Σpresent < 12`); Jovian (prior ~1) may stay all-present.
  **[RESOLVED-BY-REVISE-2: 2] The "prior < 1" antecedent is self-referential and must not float.** The
  presence prior is implementation-chosen, so a presence-ALWAYS-ON build (exactly Max's finding-5 complaint,
  and the current `resolvePole` `strength: stormsOn ? 1 : 0` behavior) could ship `prior ≈ 1` for EVERY
  regime and satisfy this floor vacuously. Fix: the per-regime priors are PINNED named constants (§5 /
  DERIVE-FORMS — a new `POLAR_PRESENCE_PRIOR` frozen table: Jovian & Saturnian ≥ 0.95, Neptunian &
  Sub-Neptune ≤ 0.8), and the test ASSERTS those constants AND that every ≤ 0.8-prior regime actually flips
  across the sweep. (Then:)
  **[RESOLVED-BY-REVISE: minor-3] PIN the 12 seeds AFTER confirming a flip in the sweep** — the
  presence draw is deterministic but seed-set-dependent: a prior-0.9 regime yields all-present in
  ~28% of arbitrary 12-seed sets, so a correct implementation could fail this floor purely by unlucky
  seed choice. During slice D, choose (and freeze in the test) a seed set that actually exhibits both
  `present` and `absent` for each sub-1 prior regime; if no reasonable 12-seed set flips, that means
  the prior is too close to 1 and belongs in the "may stay all-present" bucket — record that instead
  of asserting a flip that can't occur. (2) **N
  non-degenerate with modal == prior** — `new Set(sides).size ≥ 2` AND `mode(sides) == POLAR_CANONICAL_N[regime].sides`
  (Saturn modal 6 — hexagon-likely, not pinned). (3) **Size/position vary** — stdev of `r0` and of
  `phase` across present seeds `> 0`. (4) Same seed reproduces exactly.

---

## 7. Test plan per AC (files, molds, namespaces)

| AC | Layer | File | Mold / assertion |
|---|---|---|---|
| **AC-0** | unit (static) + manual | `worldengine-base-giant-drivers.test.js` + manual diff audit | §7b spine conformance: (i) driver-connectivity static audit, (ii) named-consumer over ALL THREE driver objects, (iii) taxonomy registration — MANUAL (drift guard is blind to value sliders) |
| **AC-WIRING** | integration (live) | live drive on :5178 → `evidence/` | before/after `state.spot*/trainLons/polarPhase` differ AND bit-match independent in-page `resolveStormE` at new seed (argmax-cross-check pattern from `evidence/README.md`) |
| **AC-LAT** | unit | `worldengine-base-giant-drivers.test.js` (new) | seed-sweep §6 floors 1-5; anti-cheat = arm's-length `resolveStormPlacement` `.lat` equality (AC-WRITER d mold); static-source grep (`storm-e`/`climate-e5` mold: no `Math.random`/`Date.now`, alea in `giantD:`/`stormE:`/`climateE5:` only, no `uTime`) |
| **AC-BANDS** | unit | `worldengine-base-giant-drivers.test.js` | seed-sweep §6 floors; band-count-set (`climate-e5` `[AC4]` mold), profile corr-ceiling + sign-vector disagreement (plate-variety mold), `eqSign`-set for straddling regimes |
| **AC-POLAR** | unit | `worldengine-base-storm-e.test.js` (revise V-β.2/[gate]) | seed-sweep §6 floors; presence-flip count, N-set with modal==prior, r0/phase stdev; same-seed bit-equality |
| **AC-REGRESSION** | unit + integration | full battery (§8) | `GOLDEN_BANDFIELD_HASH -1329854088` unchanged; `GOLDEN_STORM_MASK_HASH` unchanged (frozen-bundle default path); 83 byte goldens 83/83; regime probes (Jovian primary mode 0, Uranian obliq-85 gate, HJ full suppression) |
| **AC-LIVE-VARIETY** | integration (live) | live drive → `evidence/` | ≥3 seeds fixed regime + pinned view, jets off: large localized inter-seed AE, same-seed repeat AE=0, per-seed state dumps, console clean |
| **AC-UAT** | uat | Max | deferred-to-max; never agent-PASSed |

**Determinism molds reused verbatim:** static-source read of `giant-drivers.js`/`storm-e.js` with
comments stripped (`storm-e.test.js` `CODE` mold); byte-identity across two runs per (regime, seed);
disjoint alea namespaces named in-source and asserted (`giantD:cond`, `stormE:{place,age,phase,polar}`,
`climateE5:{params,filament}`). **New golden:** a `giant-drivers` field golden at a canonical (regime,
macroSeed) captured ONCE in the new test (its own fixture — re-blessable when the deriver changes,
NOT one of the immutable 83).

---

## 7b. AC-0 — spine conformance (Rule 15) — the plan predated the amended contract AC-0

**[RESOLVED-BY-REVISE-2: 4]** The contract carries AC-0 (spine conformance, SPINE-CONFORMANCE.md) as its
FIRST criterion, but §7 had no verification mapping for it. Add these three audits, run from the worktree
dir against the increment diff:

**(i) Static driver-connectivity audit** (in `giant-drivers.test.js`): every scalar read by
`drawGiantConditions` / `deriveGiantDrivers` / `polarPresenceProb` traces to a `body-condition-vector`
D-slot, a `DERIVE-FORMS` named derivation, or a DECLARED-frozen scalar WITH its future deriver named.
Slice P INTRODUCES new frozen scalars — the `POLAR_PRESENCE_PRIOR` table and the N-delta weights — which MUST
be declared-with-named-deriver (AC-0 (1)). Gates stay composition-derived (`composition === 'h2-he'`); no
archetype-string routing.

**(ii) Named-consumer check:** the derived triple reaches `resolveParams` via `drivers` in ALL THREE
consumers (§4 [minor-1]: `bakeClimateE5Attributes` bands + `bakeStormEAttributes` mask + `resolveStormE`
placement); the storm mask + phase bank keep their #4/#5/#8 consumers with UNCHANGED shape; no dead fields
ship (every emitted field names a consumer from the ATMOSPHERE-PLAN DAG).

**(iii) Taxonomy registration — MANUAL (the drift guard is blind here):** any new lab control registers in
`planet-archetypes.js` FEATURES/PROVINCES, or the plan records why not. VERIFIED against
`tests/planet-archetypes.test.js`: the drift guard scrapes ONLY `/\.add\(state, '(\w+Enabled)'\)/g` — i.e.
`*Enabled` CHECKBOX keys. New D-slot VALUE sliders (`.add(state, 'e5ShellDepthFrac', …)`) are INVISIBLE to
it, so a green drift-guard suite does NOT cover them — this check MUST be a manual diff audit. (Likely
outcome: read-only/override D-slot sliders are diagnostics, not new archetype FEATURES, so the plan records
"no FEATURES/PROVINCES row — value-slider diagnostic, not a gated feature"; but state that explicitly.)

---

## 8. Gates to re-run at EVERY slice landing (from the worktree dir)

The **8-suite fence bundle** (atmo-3b's seven gates + the storm-e writer) — run all from
`~/projects/well-dipper-atmo`:

| # | Suite | Command | Baseline |
|---|---|---|---|
| 1 | climate-e5 | `npx vitest run tests/worldengine-base-climate-e5.test.js` | 17 (golden `-1329854088`) |
| 2 | emission-e | `npx vitest run tests/worldengine-base-emission-e.test.js` | 12 |
| 3 | **byte-identity (83)** | `npx vitest run tests/v2-0-byte-identity.test.js` | **83 (75 goldens — NEVER re-capture)** |
| 4 | lid-byte-anchors | `npx vitest run tests/worldengine-lid-byte-anchors.test.js` | 39 |
| 5 | e1-shadow-audit | `npx vitest run tests/worldengine-e1-shadow-audit.test.js` | 23 |
| 6 | planet-archetypes | `npx vitest run tests/planet-archetypes.test.js` | 21 |
| 7 | dispatch-oracle | `npx vitest run tests/worldengine-v2-3-dispatch-oracle.test.js` | 25 |
| 8 | storm-e (writer) | `npx vitest run tests/worldengine-base-storm-e.test.js` | green (V-β.2/[gate] revised in slice P) |

**Full suite:** `npx vitest run` — pre-existing failed-SET is **4 failed / 7 failed files** (motion-test-kit,
star-billboard, warp-portal/tunnel, BodyRenderer.dispose, GalacticFeatures, KnownObjects — none in
storm scope). **The failed-SET must NOT grow.** Byte goldens **NEVER re-captured**. New tests raise the
totals by new tests only.

**Per-commit fence audit:** `git show --stat <sha>` against the §9 fence; not-ours dirty files
(`CameraChoreographer.js`, `LabMode.js`) excluded from every commit. Rebase onto L1 before merge-back
(REQUIRED — `planet-lod-lab-ux` is editing the same lab HTML on L1).

---

## 9. Fence (standing)

- **ADD:** `src/worldengine/base/giant-drivers.js` + `tests/worldengine-base-giant-drivers.test.js`;
  `docs/…/DERIVE-FORMS.md`.
- **EDIT:** `world-engine-lab.html` (the `fSeeds` reseed wiring AND the `_lab.setSeed` method — all three
  reseed paths route through `reseedGiant()` per [RESOLVED-BY-REVISE: 1], the extracted `applyStormState`,
  the derived-driver plumbing in `rebakeE5Bands`/`applyStormState`, optional D-slot sliders in `fBands`);
  `src/worldengine/base/storm-e.js` (`resolvePole` presence/N only); `tests/worldengine-base-storm-e.test.js`
  (revise V-β.2/[gate]).
- **DO NOT EDIT:** `climate-e5.js` (protects `GOLDEN_BANDFIELD_HASH`); `planet-lod-height.glsl.js`
  (render primitives consumed unchanged — this increment moves DERIVATION, not expression);
  `planet-lod-uniforms.js` (carriage unchanged; slots already carry N/size/position/presence via
  `uPolarSides`/`uPolarR0`/`uPolarPhase`/`uPolarStrength`/`uStormPosSize`); the per-frame
  carriage-filler + the three enable gates.
- **NEVER TOUCH (hard fence):** `planet-lod-rivers.js`, `src/worldengine/base/{lidResponse,e1Regime,`
  `plates,shellRelief,magmatism,stagnantLid,mixedInterior,lidDisruption}.js`. Preserve
  `world-engine-lab.html` `mulberry32()` (drawPresetRadius — NOT storm).
- **Minimal lab-HTML footprint:** reseed wiring + derived-driver plumbing + optional D-slot sliders
  ONLY. No provenance/badging (that is `planet-lod-lab-ux` on L1).

---

## 10. Risks / open questions

- **R1 — condition draw vs. condition jitter (slice D shape).** The plan draws a regime-plausible
  per-body condition perturbation per seed, then maps it purely to D-slots ("physics picks a plausible
  planet, physics maps it to jets"). Alternative: derive D-slots purely from the preset's FIXED
  condition and add a seeded jitter directly on the D-slots. The draw approach is more physically
  honest (Max's "driven first by physics/astronomy") but needs the slice-R RANGES; the jitter approach
  is cheaper but risks the "epsilon" read AC-BANDS floor 2 is designed to reject. **Recommend the draw
  approach; flag to Max if slice R finds the ranges too thin to give count-changing variety.**
- **R2 — does `eqSign` actually flip for Jovian/Saturnian?** Their `shellDepthFrac` sits well above
  `D_THR` (0.80/0.90); a plausible Jovian draw likely stays prograde, so AC-BANDS floor 3 (`eqSign`-set
  == 2) is scoped to whichever regime's RATIFIED slice-R range actually straddles 0.40 — per
  [RESOLVED-BY-REVISE: minor-1], likely Sub-Neptune (0.35) ALONE; Neptunian's canonical 0.15 needs an
  implausibly wide range to reach 0.40 and is NOT assumed to flip. Confirm from the ratified ranges
  which regimes straddle `D_THR`; if none do, drop the `eqSign`-set floor. Band-COUNT and per-band
  mid-jet sign variety still deliver Jovian AC-BANDS via `m`/`phaseJet`.
  **[RESOLVED-BY-REVISE-2: minor-3] Plan-side expectation (already reflected in the intent DOES card).** The
  intent DOES table already reads "eq-jet DIRECTION flip is plausibly Sub-Neptune-only" — so no intent edit
  is needed; the expectation to set at the slice-R forms review is that eq-jet direction likely flips per
  re-roll for Sub-Neptune ALONE (Jovian/Saturnian/Neptunian keep a fixed drift sign).
- **R3 — regime plausibility vs. "seriously different" tension.** Too-wide ranges make a Jovian
  re-roll read as a different regime (breaks AC-LAT "regime-plausible"); too-narrow makes re-rolls
  samey (fails AC-UAT). The slice-R anchor + ranges are where this is adjudicated — the one genuine
  taste-adjacent call, surface the forms table to Max.
- **R4 — storm-e mask golden.** Confirmed preserved BY CONSTRUCTION (derivation external; the
  `GOLDEN_STORM_MASK_HASH` test calls `resolveStormE` with plain `GAS`, no derived drivers). If any
  slice-P `resolvePole` change were ever to touch a `stormE:place` draw it would move the mask golden —
  it must not; presence/N draws live on `stormE:polar` and are APPENDED.

---

## 11. Revise-pass adjudication (adversarial lens fold, 2026-07-15)

**Must-fixes folded (each verified against code before folding):**
- **[1]** `_lab.setSeed` routed through `reseedGiant()` — §2 (third reseed path; the deterministic one
  the evidence uses). Verified: `setSeed` called only `updateSeedUniforms()`.
- **[2]** Deriver `condition` derived FRESH via `deriveConditionVector` at each call site — §4 (not
  `state._lastBodyDrivers.condition`, which is debounce-stale/undefined and Rocky-preset-wrong on the
  first synchronous giant bake). Verified: `_lastBodyDrivers` written only in `ensureNetworkRouted` via
  debounced reroute; boot preset is `Rocky (Earthlike)`.
- **[3]** AC-BANDS corr-ceiling MEASURED on the live slice-D sweep (or replaced by count/edge/sign
  metrics) rather than pinned at a guessed `0.6` — §6. Verified: `aBand` structure + shared equatorial
  term + few `m` values make 0.6 satisfiability data-dependent (V2-3 unsatisfiable-gate pattern).

**Minors folded:**
- **[minor-1]** eqSign-flip floor scoped to whichever ratified slice-R range straddles `D_THR`, not
  hard-coded to Neptunian — §6 floor (3) + §10 R2. (Cheap, removes an unsatisfiable-by-plausibility pin.)
- **[minor-2]** `bandCount≥2` (§6 AC-BANDS floor 1) and primary-|lat| spread `≥0.08 rad` (§6 AC-LAT
  floor 2) validated against the live slice-D sweep before pinning — both hinge on the slice-R range
  crossing an integer/belt boundary. (Same measure-before-pin discipline as [3].)
- **[minor-3]** AC-POLAR presence-flip seed set pinned AFTER confirming a flip — §6 AC-POLAR floor (1).
  (Prevents unlucky-seed false failure of a correct build.)

**Lens A minor 4 — no action (confirmation only):** Lens A validated that the `applyStormState`
extraction is behavior-preserving (reads persisted `state.bandTint`, recomputes `_fp`/`_stormDrivers`
identically, no new `alea()` in storm-e.js) and that the `resolvePole` append-draw order keeps
`r0/poleSign/phase/age/phaseScalar` byte-stable — the plan already specifies exactly this (§2, §5); no
change needed.

**Lens B — no findings to fold:** the Lens B report contained no mechanism/AC-honesty content (only
injected boilerplate), so nothing was adjudicated from it.

**Shape check:** every fold lands inside the existing fence (lab reseed wiring, `giant-drivers.js`
call sites, the slice-D/P test files). No new files, no new source touched, no AC added or removed —
[3]/[minor-1..3] change HOW the pinned floors are calibrated (measured from the real sweep), not
WHETHER AC-BANDS/AC-LAT/AC-POLAR require per-seed variety. Contract shape intact.

### Revise-2 fold (mechanism lens, 2026-07-15) — each verified against code before folding

**Must-fixes folded:**
- **[R2:1]** New AC-DERIVER floors (D1-D5) bind the test to the deriver — §6. Verified: `pvStaircaseScore`
  divides `|jetShear|` by `jetShearPeak` and `jetShear = uPeak·h(lat)`, so `uPeak` cancels; a frozen-triple
  deriver rides `phaseJet`/`ampJitter` through every OUTPUT floor. §6 header softened.
- **[R2:2]** AC-POLAR presence prior de-floated — §5/§6 pin a `POLAR_PRESENCE_PRIOR` table (Jovian/Saturnian
  ≥ 0.95, Neptunian/Sub-Neptune ≤ 0.8) + assert it. Verified: `resolvePole` ships `strength: stormsOn ? 1 :
  0`, no prior anywhere; the "prior < 1" antecedent was self-referential.
- **[R2:3]** AC-BANDS sign-vector clause moved off the most-similar pair to a DIFFERENT-`m` pair +
  measure-first — §6. Verified: same-`m` pairs (2-3 `m` values / 12 seeds) flip ~0 core signs under a small
  `phaseJet` shift, so the most-similar-pair >30% bar was unsatisfiable by a correct build.
- **[R2:4]** Added §7b AC-0 spine-conformance mapping (static / named-consumer / MANUAL taxonomy) + §7
  table row. Verified: contract AC-0 existed with no §7 mapping; drift guard regex is `*Enabled`-only.

**Minors folded:**
- **[R2:minor-1] (upgraded to must-fix-grade)** — §4 now names all THREE derived-driver consumers and spreads
  `_gd` into the base `drivers` before `_sd`. Verified: `rebakeE5Bands` builds a separate `_sd` for the mask
  bake; missing it bakes mask-frozen while vortices derive (undetectable by §6).
- **[R2:minor-2]** — §6 AC-LAT adds a `center == dirFromLatLon(lat,lon)` assert for non-lifecycle vortices.
  Verified: `iceGiantLifecyclePhase` sets `.center ≠ .lat` legitimately, so a `.center`-jitter cheat evades
  the `.lat`-equality bar; lifecycle primaries exempt.
- **[R2:minor-3]** — §10 R2 records the Sub-Neptune-only eq-jet-flip expectation; intent DOES card already
  carries it (no intent edit).
- **[R2:minor-4]** — §6 AC-BANDS records that canonical Rhines counts sit on rounding boundaries, so ±10%
  ranges suffice (wide ranges not required). Verified numerically (Jovian n≈12.2, Neptunian n≈2.53).
- **[R2:minor-5]** — §6 AC-LAT floor (4) scoped to TRAIN members (vacuous for the argmax-placed primary).

**Rejected:** none — every mechanism-lens finding verified against `storm-e.js` / `climate-e5.js` /
`world-engine-lab.html` / `planet-archetypes.test.js` held up.

**Shape check (revise-2):** all folds stay inside the standing fence — deriver floors go in the
already-planned `worldengine-base-giant-drivers.test.js`; §7b is a static + manual audit; the presence-prior
table + §4 spread + `.center` assert are lab/storm-e edits already inside the §9 EDIT fence. No new file, no
new source module, no AC added/removed. Contract shape intact.

VERDICT: BUILD-READY
