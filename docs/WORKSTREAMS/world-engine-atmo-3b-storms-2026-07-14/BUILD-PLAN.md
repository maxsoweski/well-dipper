# BUILD-PLAN — world-engine-atmo-3b-storms

> **Status:** FINAL (review-cleared). Authored 2026-07-14 against branch `feature/world-engine-atmo-3b @ 705d11c` in worktree `/home/ax/projects/well-dipper-atmo`.
> **Provenance:** planner draft → 2-lens adversarial review (Lens A phantom-seam killer · Lens B physics/fence honesty) → revise pass (this doc), 2026-07-14. All code citations re-verified against `705d11c` during the revise pass; the folded fixes below were each confirmed against actual code, not taken on a lens's word.
> **Prereqs cleared:** Slice R (PHENOMENA-TAXONOMY.md) RATIFIED 2026-07-14 with Rider A + Rider B. This plan resolves both riders and the four §11 build-time flags into concrete mechanism choices, every one grounded in code cited by file + symbol.
> **Scope pins carried from contract designDecisions (do not re-litigate):** REPLACE+DELETE the mulberry32 hash placement (no legacy path); STATIC place-once (no `uTime` in any storm term); per-seed variety ROUTED OUT to derive-not-freeze; gas gate derives from composition `'h2-he'`; carriage-reuse envelope = **no new uniforms for core storms, exactly ONE new baked vertex attribute** (the mask).

---

## Provenance & folded-fix ledger (review pass 2026-07-14)

Both lenses independently re-opened every symbol/line/uniform/attribute the draft cites and re-ran the gates. **No phantom seams; all seven gate counts and the full-suite baseline reproduced exactly.** One MUST-FIX and six MINOR/nit findings folded; **zero findings rejected** (all verified true against code this pass).

| # | Lens · severity | Finding | Fold (verified against code) |
|---|---|---|---|
| **F1** | B · **MUST-FIX** | The static-source guard as drafted can green a `uTime` violation. `bandWarpField` (body `glsl.js:1522-1529`, itself uTime-free) is called at **two animated sites** (`1782-1783`, arg `jetRotY(pos, u·uJetSpeed·(ph0-0.5))` where `ph0=fract(uTime·0.04)`) and **one static site** (`1786`). The local `r` at `1795` is `mix(r0,r1,w)` — **animated when jets on**. A filamentation term that "extends `bandWarpField`" via the animated path or reads `r`/`r0`/`r1` inherits uTime motion with **no literal `uTime` token**, so a `uTime`-only grep passes green while designDecision-2 breaks. | **V-α.1 rewritten (§5):** filamentation MUST sample a **fresh static warp** — a new `bandWarpField(N)`/`bandWarpField(pos)` call or the `else`-branch static `r`, NEVER the jets-on animated `r`/`r0`/`r1` nor any `jetRotY(…ph…)` path. **Static-source grep strengthened** to reject `uTime`, `ph0`, `ph1`, `r0`, `r1` tokens inside the added term (§5 per-step check + §7 gate). |
| **F2** | A · MINOR | `abs(comp)` sign bug. At `glsl.js:1667` the additive is `vec3(0.30,0.32,0.34)·(comp·g)`; the §2.1/V-α.5 sign-pack makes `comp<0` the "centered DS2" flag, so a negative `comp` would **darken** the companion instead of brightening it. | **§2.1 flag-1 + V-α.5 pinned:** amplitude uses `abs(comp)`; sign selects placement only. Exact edit spelled out in §2.1. |
| **F3** | A · MINOR | Swirl *application* lives at `lab.html:641-646` (inside `if (uStormCount>0)`), not in `glsl.js`. V-α.3's "extend `stormSwirl`" fence named only `glsl.js`. | **V-α.3 fence (§5) amended:** V-α edits the `stormSwirl`/`stormColTerms`/`zonalBandCol` **bodies** in `glsl.js`; `lab.html:641-646` is named as the band-composition seam, touched ONLY if the swirl *application* changes (default: it does not). |
| **F4** | A · MINOR | A second `mulberry32` at `lab.html:1929` is `drawPresetRadius()`'s PRNG (preset radius draw) and MUST survive; its comment even calls it "same family as the storm-placement streams," so a grep-and-delete could break preset radii. | **§0.4 + Slice-P fence (§4) carry an explicit carve-out:** `lab.html:1929 mulberry32()` is preset-radius — **DO NOT touch**. DELETE targets are only the storm/polar closures at `3160`/`3289`. |
| **F5** | B · MINOR | Polar determinism recoupling. Legacy `_polRng` (`lab.html:3283-3294`) deliberately forks from `_spotRng` (`^0x9E3779B9`) so F28's **variable per-vigor draw count can't move the pole structure**. #3b explicitly varies count-mix per seed, so drawing polar params from `stormE:place` after the variable-count loop would recouple pole structure to count-mix. | **Alea namespace (§4) gains a fourth disjoint sub-namespace `stormE:polar`** (mirrors the legacy stream-split intent). Pole params draw from `stormE:polar`, never from `stormE:place` after the variable-count vortex loop. |
| **F6** | B · MINOR | Hot-Jupiter suppression: emergent vs policy. Taxonomy §6.6 disposition is "**IN-#3b as a suppression policy** (explicit)"; the draft leaned on "falls out of V-α.1's shear gate" (emergent). A single wide equatorial jet still carries flank shear V-α.1 would filament, so pure emergence under-suppresses. | **V-β.6 (§6) made an explicit regime gate:** hot-Jupiter (single-wide-jet regime, `E5_REGIME.HOT_JUPITER`) hard-suppresses the filamentation term via a regime flag, not by relying on low shear. Matches the ratified taxonomy. |
| **F7** | B/A · nits | (a) §0.2 cited `jetU`/`jetShearGate` at "1518-1561" — actually `jetU@1499`, `jetShearGate@1509`, `jetsDisp@1530`. (b) The 4-failed label "vendor/motion-test-kit noise" understates breadth (the failed set spans motion-test-kit, star-billboard, warp-portal/tunnel, BodyRenderer.dispose, GalacticFeatures, KnownObjects — all pre-existing, none in scope). (c) P3 "off-gate byte comparison" under headless is a **uniform-state assertion** (uStormCount 0 → GLSL no-op), not a pixel diff. | (a) Line refs corrected in §0.2. (b) §7/§8 relabelled "pre-existing infra failures (broad; none in storm scope) — the 4-failed SET must not grow." (c) §4/§7 wording tightened to "uniform-state off-gate assertion (headless) + pixel A/B (live)." |

No lens finding was rejected. Lens A verdict CLEAN; Lens B verdict NEEDS-FIX → resolved by F1 (+F5/F6 folded).

---

## 0. Grounding ledger (every seam cited by file + symbol)

### 0.1 Physics substrate — READ, new writer is a sibling (never edited)
`src/worldengine/base/climate-e5.js`:
- `E5_REGIME` + `DRIVER_BUNDLES` (regimes GAS_GIANT/SATURNIAN/NEPTUNIAN/SUB_NEPTUNE/HOT_JUPITER; the three frozen constants live here: `internalHeat`, `dissipation`, `shellDepthFrac`).
- `resolveParams(regime, drivers, macroSeed)` (line 139) → param bundle `P` (carries `contrast`, `phaseJet`, `phaseMush`, `envMax`, `normDenom`, `m`, `s2`, `wardGain`, `uPeak`). The writer's read-only input bundle.
- `jetProfile(lat, P)` (line 174) → signed `u(lat)` master field.
- **`jetShear(lat, P)` (line 185) → analytic `du/dφ`** — THE placement field (AC-WRITER c argmax runs over this). The comment at its head confirms it is the *same* function the AC8 correlation test uses, so writer turbulence and the correlation mold stay consistent.
- `jetShearPeak(P, samples)` (line 319) → normalization denominator for `aShear`.
- `writeClimateE5Sphere(carrier, drivers, opts)` (line 251) → `{ bandField, bandNorm, turbulence, mushball, W, shearMag, …diagnostics(params) }`. The writer-output mold.
- **`bakeClimateE5Attributes(positions, count, radius, opts)`** (line 337) → `{ aBand, aShear, aMush, params, bandCount, jetCount, eqSign, peakU }`. **The exact mold for the ONE new baked attribute** (mask): sample a closed-form field per node direction, normalize, return a `Float32Array`.

`src/worldengine/base/emission-e.js` (untouched; parity mold only): `writeEmissionESphere`, `bakeEmissionEAttributes`, `EMISSION_BB_STOPS` (the CPU↔GLSL constant-table parity mold for AC-PARITY c).

### 0.2 Render carriage — REUSE, storm/band sections only
`planet-lod-uniforms.js`:
- `uStormPosSize[8]` (vec4 xyz+R), `uStormParams[8]` (vec4: `.x` rotStrength, `.y` aspect, `.z` mode 0/1, `.w` companion strength), `uStormColor[8]` (vec3), `uStormCount` — lines **362-365**.
- `uPolarStrength/uPolarMode/uPolarSides/uPolarR0/uPolarAmp/uPolarPole/uPolarRing/uPolarPhase/uPolarW/uPolarTint` — lines **369-378**. **`uPolarRing` EXISTS at line 375** (§11 flag 4 resolved below).

`planet-lod-height.glsl.js` (storm/band GLSL primitives — REUSE + extend):
- `bandWarpField(vec3)` — **line 1522, EXISTS** (§11 flag 3 resolved). Recursive q/r `fbmd` warp; the "bands→fluid" trick. **Pure function of its `pos` arg — no `uTime` in its body.** Filamentation extends this via a STATIC call (see F1 / §5).
- `jetU` (**line 1499**) / `jetShearGate` (**line 1509**) / `jetsDisp` (**line 1530**) — existing shear-gated boundary turbulence (`uJetShearTurb`). **`jetsDisp` reads `uTime`** (`ph0/ph1` at 1538-1539) — it is F25 band drift, **out of the storm-term static fence**. The new filamentation term must be static, NOT an extension of the animated `jetsDisp`, and must NOT sample the animated call path of `bandWarpField` (F1).
- `stormSwirl(vec3 n)` — line 1618. Rodrigues per-storm domain warp; reads `uStormPosSize`/`uStormParams`; static (no `uTime`). Loops `i < uStormCount`. *Application* seam at `lab.html:641-646` (F3).
- `stormColTerms(vec3 n, vec3 col)` — line 1635. Core tint (→`uStormColor`), pale collar ring, companion Gaussian. **Companion offset HARDCODED** at line 1665 `vec2(de - 1.3*R, dn - py*0.5*R)`; gated `if (comp > 0.0)` at line 1663 on `uStormParams[i].w`; additive at line 1667 `vec3(0.30,0.32,0.34)*(comp*g)` (§11 flag 1 handle; F2 sign fix).
- `polarVortexCol(vec3 n, vec3 col)` — line 1685. Modes 0 cap / 1 polygon (`r0·(1+amp·cos(N·θ))`) / 2 lattice (central + `uPolarRing`-fold ring). Gates on a **single** active pole via `acos(uPolarPole·n.y)` at line 1686 (§11 flag 2 handle). Static (comment: "no uTime — the Juno lattice held its ring positions for five years").
- `zonalBandCol(...)` — line 1761. The deck combiner; calls `stormColTerms` (line 1823, gated `uStormCount > 0`) and `polarVortexCol` (line 1835, gated `uPolarStrength > 0.0`). Holds the animated `r0/r1/r` locals (1779-1795) — the F1 hazard surface.

### 0.3 The per-frame carriage WRITER — KEEP, re-point its source
`planet-lod-lab.html` lines **5584-5620**: composes `uStormPosSize/uStormParams/uStormColor` slots + `uStormCount` from `state.spotCenter/spotRadius/spotRot/…/trainSpots[]`, and passes `state.polar*` into the `uPolar*` uniforms. **This block is NOT the legacy placement — it is the carriage filler and it STAYS.** Slice P re-points *what fills the `state.*` fields it reads* (the physics writer), not this block. Enable gates here (`greatSpotEnabled`, `stormTrainEnabled`, `polarVortexEnabled`) are the AC-OFFGATE rails and are preserved verbatim.

### 0.4 The legacy mulberry32 placement — REPLACE + DELETE (exact locations)
`planet-lod-lab.html`, inside `applyDrivers()`:
- **F27 great-spot derivation, lines ~3154-3190** — the `_spotRng` mulberry32 closure (line 3160-3165, seeded `(Math.imul(state.macroSeed, 2654435761) ^ state.stormSeed)`), setting `state.spotStrength/spotCenter/spotRadius/spotRot/spotAspect/spotMode/spotColor/spotCompanion` (spotCompanion derived `= spotMode*0.8` at line 3190).
- **F28 train derivation, lines ~3191-3280** — `_trBeltY()` belt-snap helper + the vigor-branch pearls/plume/scooters loops → `state.trainSpots/trainCount` (same `_spotRng` stream extended).
- **F29 polar derivation, lines ~3281-3318** — the `_polRng` mulberry32 closure (line 3289-3294, seed `… ^ 0x9E3779B9`) → `state.polarStrength/polarMode/polarSides/polarR0/polarRing/polarPole/polarPhase/polarTint`.
- **⚠ CARVE-OUT (F4):** the `mulberry32()` at **`lab.html:1929`** is `drawPresetRadius()`'s PRNG (preset-radius draw), **NOT** storm placement — **DO NOT delete or touch it.** The DELETE range is the storm/polar derivation only (3154-3318); a `mulberry32` grep will hit 1929, 3165, 3294 — keep 1929.
- **State declarations to migrate** (lab `state` object): `stormSeed: 1234` (line 2045), `spotCenter` (2047), `trainSpots` (2056), `polar*` (2060-2069). These stay as the interface the 0.3 carriage-filler reads; the physics writer populates them. `stormSeed` migrates from a mulberry32 seed to the `stormE:*` alea seed; the three shared-seed "reroll storms" 🎲 buttons re-point to the writer path (F-nit A-M4 — see §4 P3).

---

## 1. Slice decomposition

Slice V is genuinely XL (filamentation + wake + interior structure + chromophore + companion + polar asymmetry + lattice N + lifecycle phases + haze extension + Uranian/hot-Jupiter policies) — it sub-splits **V-α (band + storm-interior render)** and **V-β (polar + lifecycle + regime policy)**. Slice P sub-splits into three ordered steps but ships as one slice.

| Slice | Ships | Fences to | Gate |
|---|---|---|---|
| **P** — physics writer + mask attribute | new `storm-e.js` writer; the one new baked mask attribute; DELETE of mulberry32 storm/polar closures; carriage re-point | `src/worldengine/base/storm-e.js` (new) + its tests; `planet-lod-lab.html` `applyDrivers` storm derivation + `state`; NO GLSL render change | AC-0, AC-WRITER, AC-FIELDS(a,d), AC-PARITY(a,b), AC-OFFGATE |
| **V-α** — band + storm-interior render | filamentation "ink in water" term (reads `aShear`+mask, **static-sampled**, F1); FFR sign-of-shear asymmetry; GRS wake cone; storm interior structure; chromophore age→`uStormColor`; DS2 sign-packed companion (`abs(comp)`, F2) | `planet-lod-height.glsl.js` storm/band GLSL bodies; `lab.html:641-646` band-composition seam (only if swirl application changes, F3); `planet-lod-uniforms.js` (no new uniforms); writer color/age outputs | AC-VIS(a,b,c), AC-FIELDS(b,c) |
| **V-β** — polar + lifecycle + regime policy | both-poles polar asymmetry (hexagon N + opposite-pole cap); lattice canonical-N GUI range; ice-giant dark-spot lifecycle phases; haze-mute extension to storm terms; Uranian variant; hot-Jupiter suppression (explicit policy, F6) | `planet-lod-height.glsl.js` `polarVortexCol` + haze lever; lab GUI folder; writer regime routing | AC-LIVE, AC-VIS(a) suppression, AC-FIELDS(c) |

Re-scope gate (V2-2b precedent): if V-α or V-β balloons past a coherent unit, split again — do not grow silently.

---

## 2. §11 build-time flag resolutions (verified against code, one line each)

1. **§4.4 DS2 centered companion — RESOLVED in-envelope (with F2 sign fix).** `uStormParams` vec4 is fully allocated (`.x/.y/.z/.w`); `.z` mode is NOT read inside `stormColTerms` (color is precomputed into `uStormColor`); the companion offset is hardcoded (`glsl.js:1665`). Choice: **sign-pack `uStormParams.w`** — magnitude = companion strength, sign = placement. Concrete GLSL edit at `glsl.js:1663-1667`:
   - `line 1663`: `if (comp > 0.0)` → `if (comp != 0.0)`.
   - `line 1665`: offset becomes `comp < 0.0 ? vec2(0.0) : vec2(1.3*R, py*0.5*R)` (centered when negative).
   - **`line 1667` (F2 — MUST):** amplitude uses `abs(comp)`, not `comp`, so a negative (centered) flag still *brightens*: `col = min(col + vec3(0.30,0.32,0.34) * (abs(comp) * g), vec3(1.0));`.
   One small GLSL edit, **no new uniform** (V-α.5).
2. **§3.2 pole asymmetry — RESOLVED in-envelope, scope-bounded.** `polarVortexCol` gates a single active pole (`acos(uPolarPole·n.y)`, `glsl.js:1686`) and single `uPolarMode`; independent per-pole *params* would need new uniforms. Choice: **extend `polarVortexCol` to paint BOTH poles in one pass** — active pole shows `uPolarMode` structure, opposite pole shows a fixed cap (mode-0) from the same uniforms — satisfies §3.2's Saturn "N-hexagon + S-cap" with **no new uniform**; full independent per-pole tuning DEFERRED to derive-not-freeze (V-β.1).
3. **§2.1 `bandWarpField` — RESOLVED, exists.** Confirmed at `glsl.js:1522` (the grounding's worry it was named `zonalBandCol` is wrong — `zonalBandCol` is the distinct combiner at 1761). The filamentation term extends `bandWarpField`'s recursive q/r warp via a **STATIC sample** (F1), reading `aShear` + the new mask; **no new uniform** (V-α.1).
4. **§2.10 `uPolarRing` — RESOLVED, exists.** Confirmed uniform at `planet-lod-uniforms.js:375`, declared `glsl.js:398`, consumed by lattice mode 2 at `glsl.js:1718`, filled by the carriage writer at `lab:5617`. Lattice mode already uses it; **no envelope breach**.

---

## 3. Rider resolutions (taxonomy §9 ratification block)

- **Rider A (Uranian).** Realize Uranian as a **Neptunian-regime variant driven by parameters**, not a new frozen preset: reuse `E5_REGIME.NEPTUNIAN` with high-obliquity (Ward hot-poles inversion), high `hazeMute`, and low internal heat as *tunable inputs*. #3b paints the Uranian read (haze veil + near-empty slots + seasonal polar hood, taxonomy §5) via these parameters; the internal-heat driver that physically separates Uranus from Neptune stays a frozen constant → **derive-not-freeze**. Broader theorized-giant coverage is agenda for derive-not-freeze, not #3b. (V-β.5)
- **Rider B (polar cyclone-cluster N).** Ship a **declared per-regime canonical N** (Jupiter lattice ~8, Saturn hexagon 6) as the physics-grounded default, exposed **GUI-tunable across a plausible physics range** (proposed 5–8 for both `uPolarSides` and `uPolarRing`, matching the existing driven 5..8 range in `uniforms.js:371/375`), **not a frozen literal**. Per-seed N variation belongs to derive-not-freeze. (V-β.2)
  - **Note (F5 interaction):** the writer draws polar N and all pole params from the `stormE:polar` sub-namespace, drawn BEFORE the variable-count vortex loop, so canonical-N choice never recouples to the per-seed count-mix.

---

## 4. Slice P — physics writer + mask attribute

**Scope fence.** ADD `src/worldengine/base/storm-e.js` (name pinned) + `tests/worldengine-base-storm-e.test.js`. EDIT `planet-lod-lab.html` `applyDrivers` storm-derivation block (delete **3154-3318**, replace with a writer call) + the `state` storm fields + the three "reroll storms" buttons. **DO NOT touch `lab.html:1929` `mulberry32()` (preset-radius, F4).** NO edit to `planet-lod-height.glsl.js` render terms in this slice (render stays byte-identical modulo where the slots point). NEVER touch relief/dispatch: `planet-lod-rivers.js`, `src/worldengine/base/{lidResponse,e1Regime,plates,shellRelief,magmatism,stagnantLid,mixedInterior,lidDisruption}.js`; exclude not-ours dirty files (`CameraChoreographer.js`, `LabMode.js`) from every commit.

**Alea namespace (pinned — four disjoint sub-namespaces, F5):** `stormE:place`, `stormE:age`, `stormE:phase`, **`stormE:polar`** — disjoint, fixed draw order, zero `Math.random`/`Date.now` (the climate-e5 static-source mold). `stormE:polar` mirrors the legacy `_polRng` stream-split so the variable per-seed count-mix in `stormE:place` can never move pole structure (the exact bug the legacy `^0x9E3779B9` fork avoided). Pole params draw from `stormE:polar` BEFORE the variable-count vortex loop runs.

### Ordered build steps

- **P1 — the writer core `writeStormESphere(...)` / `resolveStormE(regime, drivers, macroSeed, stormSeed)`.**
  - Reuse `resolveParams` + `jetShear`/`jetShearPeak` from `climate-e5.js` (import, do not copy). Gas gate: `drivers.composition === 'h2-he'` (designDecision 5), else return an empty record set (count 0).
  - **Placement:** argmax of *anticyclonic* shear over the PV-staircase-adjusted jet profile. The PV-staircase adjustment is new #3b machinery — a monotone re-map of the `jetShear(lat,P)` sampling that steepens jet cores into steps (implement as a documented closed-form over the existing `jetProfile` samples; declare its constants with the derive-not-freeze deriver). Deterministic tie-break **lowest-lat → lowest-node** (the ATMOSPHERE-PLAN pin). Band-confined via the existing belt-snap math (port the `_trBeltY` latitude inversion from the deleted block into the writer, cleaned).
  - **Records emitted per vortex:** `{ center[3], radius, rot(sign=cyclonic/anticyclonic), aspect, mode(0 warm/1 dark), ageScalar, phaseScalar, companion }`. Longitude/phase/mix from `stormE:place`/`stormE:phase`; latitudes from the (frozen-input) shear argmax → repeat per seed by design (the carve-out).
  - **Pole params** (N, mode, sides, R0, ring, pole, phase, tint) from **`stormE:polar`**, drawn BEFORE the variable-count vortex loop (F5).
  - **Vortex families** (taxonomy-driven, physics-placed, replacing the vigor-branch dice): GRS-class primary at the strongest anticyclonic argmax; vortex street/train at the shared argmax latitude (argmax + next-N shear maxima, even longitudes from phase); cyclonic brown-barge slot (shear-sign → mode 1, high aspect); ice-giant dark spot (mode 1, cleared) on Neptunian/Uranian.
  - **Phase bank:** every vortex carries a place-once `phaseScalar` (`stormE:phase`) — the named substrate for #4/#5/#8. No `uTime` anywhere.
  - AC: AC-WRITER(a) static-source grep + double-run byte equality; (c) argmax + tie-break; (d) arm's-length re-derivation of centers from returned params alone; (e) reseed sweep.

- **P2 — the storm/convection MASK (the ONE new baked attribute).**
  - Mirror `bakeClimateE5Attributes`: add `bakeStormEAttributes(positions, count, radius, opts)` → `Float32Array aStorm`, continuous [0,1], finite, **shear-correlated** above a stated floor (correlate to `|jetShear|` normalized by `jetShearPeak`, the AC8 mold) AND lifted toward 1 near placed vortex centers (mask maxima at/near vortices — AC-FIELDS a). Attribute name `aStorm` (aBand/aShear/aMush precedent).
  - Wire the bake into the same geometry-attribute path #3a uses (`bakeClimateE5Attributes` call site in the lab geometry build; add the `aStorm` attribute + `varying`). This is the single permitted new attribute; assert no second attribute is added (envelope guard).
  - AC: AC-FIELDS(a) bounds/finiteness/correlation/vortex-consistency; AC-PARITY(a) bake↔writer node equality mold.

- **P3 — wire-in + DELETE + carriage re-point.**
  - DELETE `lab.html` 3154-3318 (the three storm/polar mulberry32 closures — NOT `1929`). Replace with a single `resolveStormE(...)` call; map its records → `state.spotCenter/spotRadius/…/trainSpots[]/polar*` fields the 0.3 carriage-filler (`lab.html:5584-5620`) reads. The carriage-filler and the three enable gates are unchanged.
  - Migrate the reroll path: `state.stormSeed` now seeds `stormE:*`; **all three shared-seed reroll buttons** (`fSpot` @4422, `fTrain` @4433, `fPolar` @4446 — all bump `state.stormSeed` → `applyDrivers()`) re-point automatically via `applyDrivers`' writer call (F-nit A-M4).
  - AC: AC-OFFGATE(a) storms-off **uniform-state off-gate assertion** (uStormCount 0 → GLSL no-op → byte-identical, headless) + AC-PARITY(b) slot-fill provenance (uStorm slots trace to writer records, not lab dice); AC-0 driver-connectivity + named-consumer + `planet-archetypes.test.js` drift guards.

**Per-step headless checks:** `npx vitest run tests/worldengine-base-storm-e.test.js` (P1/P2); uniform-state off-gate assertion + `tests/v2-0-byte-identity.test.js` + `tests/planet-archetypes.test.js` (P3).

**Non-goals (routed out of Slice P):** no render-term changes (that is V); no per-seed latitude variety (frozen-constant carve-out → derive-not-freeze); no animated phase (static bank only); no new uniform (mask is a baked attribute, not a uniform).

---

## 5. Slice V-α — band + storm-interior render

**Scope fence.** EDIT `planet-lod-height.glsl.js` storm/band GLSL bodies only (`bandWarpField`, `stormSwirl`, `stormColTerms`, and the `zonalBandCol` call sites). **`lab.html:641-646` is the band-composition seam (F3)** — touch it ONLY if the swirl *application* itself changes (default V-α: it does not; all interior structure lives in the `glsl.js` primitive bodies). NO new uniform (`planet-lod-uniforms.js` untouched except values). Writer supplies `ageScalar`→color and the mask; the mask arrives via the P2 `aStorm` varying. **Static fence (F1 — hardened): assert no `uTime`, `ph0`, `ph1`, `r0`, `r1` token appears in any added storm/filamentation term (grep guard).**

### Ordered build steps

- **V-α.1 — "ink in water" filamentation term (F1 — the static-source MUST-FIX applies here).** New static GLSL that extends `bandWarpField` (`glsl.js:1522`): modulate band-boundary detail by `aShear` (existing) × `aStorm` (new mask) — active where `|shear|`/mask high, absent where low, gated to vanish when the mask is empty. This is the taxonomy 2.1/3.4 mechanism.
  - **STATIC SAMPLING (mandatory):** the filamentation's spatial detail MUST come from a **fresh static warp sample** — a new `bandWarpField(N)` / `bandWarpField(pos)` call, OR the `else`-branch static `r = bandWarpField(pos)` value at `glsl.js:1786`. It MUST NOT read the jets-on animated locals `r`/`r0`/`r1` (`glsl.js:1782-1795`) nor any `jetRotY(pos, …ph…)` path. Rationale: those carry `uTime` through `ph0/ph1` with no literal `uTime` token, so reusing them silently animates the "static place-once" term (designDecision 2) and slips past a `uTime`-only grep. The existing F25 band drift stays as-is; filamentation is additive static complexity on top.
  - Not an extension of `jetsDisp` (that reads `uTime` at 1538-1539). **FFR sign-of-shear asymmetry (Q8 ratified):** intensify filamentation on the cyclonic side using the sign of the writer's `u(lat)`/shear (taxonomy 2.2).
  - Per-step check: static-source grep rejects `uTime`/`ph0`/`ph1`/`r0`/`r1` in the added lines. AC-VIS(a): A/B screenshot diff localized to high-shear latitudes; absent when disabled; **camera-static A/B (two frames at different `uTime`, storms on) must be pixel-identical in the filamented region** (proves the added term is static, catches an F1 regression the grep can't).
- **V-α.2 — GRS wake cone (Q5 ratified: bespoke term).** Add an upstream (west) turbulence-cone term in `stormColTerms` (or a mask bump) anchored to the primary vortex slot (taxonomy 2.4). Static-sampled (same F1 discipline). AC-VIS(b) wake detail.
- **V-α.3 — storm interior structure.** Extend `stormSwirl`/`stormColTerms` bodies so placed vortices render spiral/annular interior detail (not flat oval fill) — nonzero in-radius A/B diff, ~zero outside. **Fence (F3):** interior structure edits stay in the `glsl.js` primitive bodies; the `lab.html:641-646` application is not changed. AC-VIS(b).
- **V-α.4 — chromophore age coloring.** Writer `ageScalar` → monotonic white→cream→tan→orange→brick-red ramp → `uStormColor[i]`; feeds `stormColTerms` core tint. Two vortices of different age read visibly different. AC-FIELDS(b), AC-VIS(c).
- **V-α.5 — DS2 centered companion (§11 flag 1 + F2 sign fix).** Sign-pack `uStormParams.w`; GLSL edit at `glsl.js:1663-1667` per §2.1 resolution — **amplitude uses `abs(comp)`** so a negative (centered) flag still brightens, sign only relocates the offset. AC-FIELDS(c).

**Per-step headless checks:** static-source grep (no `uTime`/`ph0`/`ph1`/`r0`/`r1` in new terms); CPU↔GLSL parity for any new color-ramp constant table (emission-e mold). Visual A/B (incl. the V-α.1 uTime-invariance frame check) is AC-VIS (live, agent-driven — deferred to the verify workflow's live integration; screenshots to `evidence/`).

**Non-goals:** no polar changes (V-β); no lifecycle phase states (V-β); no animation.

---

## 6. Slice V-β — polar + lifecycle + regime policy

**Scope fence.** EDIT `planet-lod-height.glsl.js` `polarVortexCol` + the haze-mute lever; lab GUI storm/polar folder (canonical-N GUI range); writer regime routing (`storm-e.js`). NO new uniform. NEVER touch relief/dispatch.

### Ordered build steps

- **V-β.1 — both-poles polar asymmetry (§11 flag 2).** Extend `polarVortexCol` (`glsl.js:1685`) to paint BOTH poles in one pass: active pole (`uPolarPole`) shows `uPolarMode` structure; opposite pole shows a fixed cap (mode 0) from the same uniforms. Realizes Saturn N-hexagon + S-cap (taxonomy 3.1/3.2) with no new uniform. AC-LIVE (Saturnian polar structure).
- **V-β.2 — canonical-N GUI range (Rider B).** Expose `uPolarSides` (hexagon N) and `uPolarRing` (lattice M) GUI-tunable 5–8 with declared per-regime defaults (Jupiter lattice ~8, Saturn 6). Writer draws N from `stormE:polar` (F5). Register any new control in `planet-archetypes.js` (AC-0 taxonomy registration). AC-LIVE.
- **V-β.3 — ice-giant dark-spot lifecycle phases (Q6 ratified: three phases).** Writer `ageScalar`→ phase state: precursor (companion only, no dark core) / mature (dark core + offset cap + lat offset) / dissipating (weak contrast, near-equator). Maps to contrast + latitude offset + companion presence across the existing slot primitives; CH₄ companion gated ice-giant-only (AC-FIELDS c). AC-FIELDS(b), AC-LIVE.
- **V-β.4 — haze-mute extension.** Extend the existing #3a contrast lever (`uHazeMute`, `uniforms.js:393`; `resolveParams.contrast`) to gate storm-color saturation, collar contrast, and filamentation amplitude (taxonomy §1.2). No new uniform. AC-VIS(a) amplitude gated.
- **V-β.5 — Uranian variant (Rider A).** Route Uranian as a Neptunian-regime parameter variant (high obliquity + high haze + near-empty slots + seasonal polar hood via mode-0 cap). AC-LIVE read.
- **V-β.6 — hot-Jupiter suppression policy (Q1 ratified — F6: EXPLICIT gate, not emergent).** #3b hot-Jupiter = banded deck (#3a) + haze only. **Suppress the band-boundary filamentation term via an explicit regime gate** keyed on `E5_REGIME.HOT_JUPITER` (the single-wide-jet regime) — NOT by relying on "low shear," because the one wide equatorial jet still carries flank shear V-α.1 would filament, so pure emergence under-suppresses (taxonomy §6.6 calls this "a policy"). All active HJ phenomena DEFER to #4. AC-VIS(a) (filamentation absent on canonical hot/slow HJ regardless of local shear).

**Per-step headless checks:** `polarVortexCol` parity/no-`uTime` grep; `planet-archetypes.test.js` drift guards for new controls; CPU↔GLSL parity for any polar constant. Per-regime visual sweep is AC-LIVE (live, agent-driven).

**Non-goals (DEFERRED, each named):** festoons/5µm hot-spots, shallow lightning, Neptune warm south-polar, HJ hotspot-offset/nightside-gyres/ultra-hot/patchiness → **#4 emission-v2**; the Scooter/fast plumes → **#5 brown-dwarf**; belt fades, Saturn GWS outbreak, Uranus 2014 outbreak, Neptune-vs-Uranus internal-heat difference → **derive-not-freeze variety**; HJ free vortex → **out-of-class**.

---

## 7. Gate list (run FROM the worktree dir `/home/ax/projects/well-dipper-atmo`)

**Measured at branch point `705d11c` this session, re-confirmed by BOTH review lenses (independent headless runs — all counts reproduced exactly):**

| Gate | Command | Expected |
|---|---|---|
| atmosphere fence — climate-e5 | `npx vitest run tests/worldengine-base-climate-e5.test.js` | **17 passed** |
| atmosphere fence — emission-e | `npx vitest run tests/worldengine-base-emission-e.test.js` | **12 passed** |
| byte-identity quartet #1 | `npx vitest run tests/v2-0-byte-identity.test.js` | **83 passed** (75 goldens; NEVER re-capture) |
| quartet #2 — lid-byte-anchors | `npx vitest run tests/worldengine-lid-byte-anchors.test.js` | **39 passed** |
| quartet #3 — e1-shadow-audit | `npx vitest run tests/worldengine-e1-shadow-audit.test.js` | **23 passed** (enumerated at this branch) |
| quartet #4 — planet-archetypes | `npx vitest run tests/planet-archetypes.test.js` | **21 passed** |
| dispatch-oracle | `npx vitest run tests/worldengine-v2-3-dispatch-oracle.test.js` | **25 passed** |
| per-gate subtotal | (sum of the seven above) | **220 passed** |
| full-suite baseline | `npx vitest run` | **1920 total · 4 failed / 1916 passed · 7 failed files / 122 total** — failures are ALL pre-existing infra (motion-test-kit, star-billboard, warp-portal/tunnel, BodyRenderer.dispose, GalacticFeatures, KnownObjects); **none in storm scope; the 4-failed SET must not grow** |
| new writer (P) | `npx vitest run tests/worldengine-base-storm-e.test.js` | new; AC-WRITER/AC-FIELDS/AC-PARITY green |
| **static-source grep (V-α/V-β)** | grep added storm/filamentation terms for `uTime`\|`ph0`\|`ph1`\|`r0`\|`r1` | **zero hits** (F1 hardened guard) |

Per-commit fence audit: `git show --stat <sha>` against the §4/§5/§6 scope fences; not-ours dirty files excluded from every commit.

**Live gates (agent-driven, not headless):** AC-LIVE + AC-VIS on the Max-started dev server (`cd ~/projects/well-dipper-atmo && npm run dev -- --port 5178`, lab `http://localhost:5178/well-dipper/planet-lod-lab.html`), liveness via chrome-devtools `list_pages` (never sandbox-curl), screenshots to `evidence/`, all agent pages closed after (window hygiene). **V-α.1 carries an extra live check: two frames at different `uTime` with storms on must be pixel-identical in the filamented region (F1 static-invariance).** AC-UAT is Max's gate alone — never agent-PASSed.

---

## 8. Contract tensions found (carried from draft, numbers re-verified)

1. **Full-suite baseline numbers were stale in the contract-grounding.** Grounding says "EXACTLY 4 failed tests / 17 failed files" and "NOT 2075 here." **Measured + re-confirmed by both lenses at `705d11c`: 1920 total, 4 failed / 1916 passed, 7 failed *files* / 122 total files.** The 4-failed-*tests* baseline holds; the failed-*files* figure (7, not 17) and the total (1920) are what this branch actually reports — pin these in the verify contract, not 17/2075. The 4 failures span motion-test-kit / star-billboard / warp-portal / warp-tunnel / BodyRenderer.dispose / GalacticFeatures / KnownObjects — all pre-existing, none in storm scope (the "must not grow" guard is on the SET, not a single vendor file).
2. **"REPLACE+DELETE the mulberry32 hash placement" must not over-reach.** Two carve-outs: (a) the per-frame slot composer (`lab.html:5584-5620`) and the three enable gates are the AC-OFFGATE rails and MUST survive — the writer re-points what fills `state.*`, it does not remove the carriage; (b) `lab.html:1929 mulberry32()` is `drawPresetRadius`, NOT storm placement — MUST survive (F4). DELETE is only the storm/polar derivation closures at 3154-3318.
3. **`jetsDisp` reads `uTime`, and so does the jets-on `bandWarpField` call path.** The V-α.1 filamentation term must be a *new static* extension of `bandWarpField` sampled via a static call (F1), NOT an extension of the animated `jetsDisp` NOR a read of the animated `r`/`r0`/`r1` locals — otherwise the static-place-once contract (designDecision 2) breaks with no literal `uTime` token to catch it. This is the review's one MUST-FIX (F1), folded into V-α.1 + the hardened grep + the live uTime-invariance frame check.

---

## 9. Non-goals (increment-wide)

- **No animation.** No `uTime` in any storm/polar/filamentation term; the phase bank ships as place-once scalars for #4/#5/#8 to consume, #3b animates nothing.
- **No per-seed latitude variety.** Same-regime reseeds share storm latitudes (frozen shear inputs); longitude/phase/count-mix vary. Per-seed "seriously different planet" is the derive-not-freeze increment's UAT, not judged in #3b (Max's carve-out).
- **No new uniforms for core storms.** Exactly ONE new baked vertex attribute (`aStorm` mask). Companion placement, pole asymmetry, and canonical-N all fit the existing carriage via sign-packing / both-poles-one-pass / GUI range.
- **No new frozen presets.** Uranian is a Neptunian-regime parameter variant (Rider A); broader theorized-giant coverage → derive-not-freeze.
- **No relief/dispatch edits.** The concurrency fence: zero edits to `planet-lod-rivers.js` or `src/worldengine/base/{lidResponse,e1Regime,plates,shellRelief,magmatism,stagnantLid,mixedInterior,lidDisruption}.js`; not-ours dirty files (`CameraChoreographer.js`, `LabMode.js`) excluded from every commit.
- **Deferred phenomena** (each named to its increment in §5/§6 non-goals and taxonomy §8): festoons/hot-spots/lightning/HJ-active/warm-poles → #4; Scooter/plumes → #5; outbreak/epoch states + Neptune-vs-Uranus heat → derive-not-freeze; HJ free vortex → out-of-class.

---

*Review-cleared 2026-07-14 (planner + Lens A seams + Lens B physics/fence + revise). On sign-off, working-Claude builds slices P → V-α → V-β via opus-pinned workflows, ≤2-3 concurrent agents (WSL OOM rule), staggered against any ground-track workflow. The verify-workstream workflow audits AC-0/WRITER/FIELDS/PARITY/OFFGATE headless; working-Claude drives AC-LIVE/AC-VIS live; AC-UAT is Max's gate alone.*
