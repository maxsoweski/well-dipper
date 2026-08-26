# BUILD-PLAN (draft) — world-engine-atmo-3b-storms

> **Status:** DRAFT for review. Authored 2026-07-14 against branch `feature/world-engine-atmo-3b @ 705d11c` in worktree `/home/ax/projects/well-dipper-atmo`.
> **Prereqs cleared:** Slice R (PHENOMENA-TAXONOMY.md) RATIFIED 2026-07-14 with Rider A + Rider B. This plan resolves both riders and the four §11 build-time flags into concrete mechanism choices, every one grounded in code cited by file + symbol.
> **Scope pins carried from contract designDecisions (do not re-litigate):** REPLACE+DELETE the mulberry32 hash placement (no legacy path); STATIC place-once (no `uTime` in any storm term); per-seed variety ROUTED OUT to derive-not-freeze; gas gate derives from composition `'h2-he'`; carriage-reuse envelope = **no new uniforms for core storms, exactly ONE new baked vertex attribute** (the mask).

---

## 0. Grounding ledger (every seam cited by file + symbol)

### 0.1 Physics substrate — READ, new writer is a sibling (never edited)
`src/worldengine/base/climate-e5.js`:
- `E5_REGIME` + `DRIVER_BUNDLES` (regimes GAS_GIANT/SATURNIAN/NEPTUNIAN/SUB_NEPTUNE/HOT_JUPITER; the three frozen constants live here: `internalHeat`, `dissipation`, `shellDepthFrac`).
- `resolveParams(regime, drivers, macroSeed)` → param bundle `P` (carries `contrast`, `phaseJet`, `phaseMush`, `envMax`, `normDenom`, `m`, `s2`, `wardGain`, `uPeak`). This is the writer's read-only input bundle.
- `jetProfile(lat, P)` → signed `u(lat)` master field.
- **`jetShear(lat, P)` → analytic `du/dφ`** — THE placement field (AC-WRITER c argmax runs over this). The comment at its head confirms it is the *same* function the AC8 correlation test uses, so writer turbulence and the correlation mold stay consistent.
- `jetShearPeak(P, samples)` → normalization denominator for `aShear`.
- `writeClimateE5Sphere(carrier, drivers, opts)` → returns `{ bandField, bandNorm, turbulence, mushball, W, shearMag, …diagnostics(params) }`. The writer-output mold.
- **`bakeClimateE5Attributes(positions, count, radius, opts)`** → `{ aBand, aShear, aMush, params, bandCount, jetCount, eqSign, peakU }`. **This is the exact mold for the ONE new baked attribute** (mask): sample a closed-form field per node direction, normalize, return a `Float32Array`.

`src/worldengine/base/emission-e.js` (untouched; parity mold only): `writeEmissionESphere`, `bakeEmissionEAttributes`, `EMISSION_BB_STOPS` (the CPU↔GLSL constant-table parity mold for AC-PARITY c).

### 0.2 Render carriage — REUSE, storm/band sections only
`planet-lod-uniforms.js`:
- `uStormPosSize[8]` (vec4 xyz+R), `uStormParams[8]` (vec4: `.x` rotStrength, `.y` aspect, `.z` mode 0/1, `.w` companion strength), `uStormColor[8]` (vec3), `uStormCount` — lines ~362-365.
- `uPolarStrength/uPolarMode/uPolarSides/uPolarR0/uPolarAmp/uPolarPole/uPolarRing/uPolarPhase/uPolarW/uPolarTint` — lines ~369-378. **`uPolarRing` EXISTS at line 375** (§11 flag 4 resolved below).

`planet-lod-height.glsl.js` (storm/band GLSL primitives — REUSE + extend):
- `bandWarpField(vec3)` — **line 1522, EXISTS** (§11 flag 3 resolved). Recursive q/r `fbmd` warp; the "bands→fluid" trick. Filamentation extends this.
- `jetsDisp` / `jetShearGate` / `jetU` — lines 1518-1561, existing shear-gated boundary turbulence (`uJetShearTurb`). Note: `jetsDisp` reads `uTime` — it is F25 band drift, **out of the storm-term static fence**; the new filamentation term must be static (place-once), not an extension of the animated `jetsDisp`.
- `stormSwirl(vec3 n)` — line 1618. Rodrigues per-storm domain warp; reads `uStormPosSize`/`uStormParams`; static (no `uTime`). Loops `i < uStormCount`.
- `stormColTerms(vec3 n, vec3 col)` — line 1635. Core tint (→`uStormColor`), pale collar ring, companion Gaussian. **Companion offset is HARDCODED** at line 1665 `vec2(de - 1.3*R, dn - py*0.5*R)`; gated `if (comp > 0.0)` on `uStormParams[i].w` (§11 flag 1 handle).
- `polarVortexCol(vec3 n, vec3 col)` — line 1685. Modes 0 cap / 1 polygon (hexagon `r0·(1+amp·cos(N·θ))`) / 2 lattice (central + `uPolarRing`-fold ring). Gates on a **single** active pole `acos(uPolarPole·n.y)` (§11 flag 2 handle). Static (comment: "no uTime — the Juno lattice held its ring positions for five years").
- `zonalBandCol(...)` — line 1761. The deck combiner; calls `stormColTerms` (line 1823, gated `uStormCount > 0`) and `polarVortexCol` (line 1835, gated `uPolarStrength > 0.0`). `stormSwirl` feeds the direction it receives.

### 0.3 The per-frame carriage WRITER — KEEP, re-point its source
`world-engine-lab.html` lines **5584-5620**: composes `uStormPosSize/uStormParams/uStormColor` slots + `uStormCount` from `state.spotCenter/spotRadius/spotRot/…/trainSpots[]`, and passes `state.polar*` into the `uPolar*` uniforms. **This block is NOT the legacy placement — it is the carriage filler and it STAYS.** Slice P re-points *what fills the `state.*` fields it reads* (the physics writer), not this block. Enable gates here (`greatSpotEnabled`, `stormTrainEnabled`, `polarVortexEnabled`) are the AC-OFFGATE rails and are preserved verbatim.

### 0.4 The legacy mulberry32 placement — REPLACE + DELETE (exact locations)
`world-engine-lab.html`, inside `applyDrivers()`:
- **F27 great-spot derivation, lines ~3154-3190** — the `_spotRng` mulberry32 closure (line 3160-3165, seeded `(Math.imul(state.macroSeed, 2654435761) ^ state.stormSeed)`), setting `state.spotStrength/spotCenter/spotRadius/spotRot/spotAspect/spotMode/spotColor/spotCompanion`.
- **F28 train derivation, lines ~3191-3280** — `_trBeltY()` belt-snap helper + the vigor-branch pearls/plume/scooters loops → `state.trainSpots/trainCount` (same `_spotRng` stream extended).
- **F29 polar derivation, lines ~3281-3318** — the `_polRng` mulberry32 closure (line 3289-3294, seed `… ^ 0x9E3779B9`) → `state.polarStrength/polarMode/polarSides/polarR0/polarRing/polarPole/polarPhase/polarTint`.
- **State declarations to migrate** (lab `state` object): `stormSeed: 1234` (line 2045), `spotCenter` (2047), `trainSpots` (2056), `polar*` (2060-2069). These stay as the interface the 0.3 carriage-filler reads; the physics writer populates them. `stormSeed` migrates from a mulberry32 seed to the `stormE:*` alea seed; the folder "reroll storms" 🎲 re-points to the writer path.

---

## 1. Slice decomposition

Slice V is genuinely XL (filamentation + wake + interior structure + chromophore + companion + polar asymmetry + lattice N + lifecycle phases + haze extension + Uranian/hot-Jupiter policies) — it sub-splits **V-α (band + storm-interior render)** and **V-β (polar + lifecycle + regime policy)**. Slice P sub-splits into three ordered steps but ships as one slice.

| Slice | Ships | Fences to | Gate |
|---|---|---|---|
| **P** — physics writer + mask attribute | new `storm-e.js` writer; the one new baked mask attribute; DELETE of mulberry32; carriage re-point | `src/worldengine/base/storm-e.js` (new) + its tests; `world-engine-lab.html` `applyDrivers` storm derivation + `state`; NO GLSL render change | AC-0, AC-WRITER, AC-FIELDS(a,d), AC-PARITY(a,b), AC-OFFGATE |
| **V-α** — band + storm-interior render | filamentation "ink in water" term (reads `aShear`+mask, static); FFR sign-of-shear asymmetry; GRS wake cone; storm interior structure; chromophore age→`uStormColor`; DS2 sign-packed companion | `planet-lod-height.glsl.js` storm/band GLSL; `planet-lod-uniforms.js` (no new uniforms); writer color/age outputs | AC-VIS(a,b,c), AC-FIELDS(b,c) |
| **V-β** — polar + lifecycle + regime policy | both-poles polar asymmetry (hexagon N + opposite-pole cap); lattice canonical-N GUI range; ice-giant dark-spot lifecycle phases; haze-mute extension to storm terms; Uranian variant; hot-Jupiter suppression | `planet-lod-height.glsl.js` `polarVortexCol` + haze lever; lab GUI folder; writer regime routing | AC-LIVE, AC-VIS(a) suppression, AC-FIELDS(c) |

Re-scope gate (V2-2b precedent): if V-α or V-β balloons past a coherent unit, split again — do not grow silently.

---

## 2. §11 build-time flag resolutions (verified against code, one line each)

1. **§4.4 DS2 centered companion — RESOLVED in-envelope.** `uStormParams` vec4 is fully allocated (`.x/.y/.z/.w`), but `.z` mode is NOT read inside `stormColTerms` (color is precomputed into `uStormColor`); the companion offset is hardcoded (height.glsl.js:1665). Choice: **sign-pack `uStormParams.w`** — magnitude = companion strength, sign = placement; change GLSL line 1663 `if (comp > 0.0)` → `if (comp != 0.0)` and make the offset `comp < 0.0 ? vec2(0.0) : vec2(1.3*R, py*0.5*R)`. One small GLSL edit, **no new uniform** (V-α).
2. **§3.2 pole asymmetry — RESOLVED in-envelope, scope-bounded.** `polarVortexCol` gates a single active pole (`acos(uPolarPole·n.y)`, height.glsl.js:1686) and single `uPolarMode`; independent per-pole *params* would need new uniforms. Choice: **extend `polarVortexCol` to paint BOTH poles in one pass** — active pole shows `uPolarMode` structure, opposite pole shows a fixed cap (mode-0) from the same uniforms — which satisfies §3.2's Saturn "N-hexagon + S-cap" with **no new uniform**; full independent per-pole tuning is DEFERRED to derive-not-freeze (V-β).
3. **§2.1 `bandWarpField` — RESOLVED, exists.** Confirmed at height.glsl.js:1522 (the grounding's worry that it was named `zonalBandCol` is wrong). The filamentation term extends `bandWarpField`'s recursive q/r warp, reading `aShear` + the new mask; **no new uniform** (V-α).
4. **§2.10 `uPolarRing` — RESOLVED, exists.** Confirmed uniform at planet-lod-uniforms.js:375, declared height.glsl.js:398, consumed by lattice mode 2 at height.glsl.js:1718, filled by the carriage writer at lab:5617. Lattice mode already uses it; **no envelope breach**.

---

## 3. Rider resolutions (taxonomy §9 ratification block)

- **Rider A (Uranian).** Realize Uranian as a **Neptunian-regime variant driven by parameters**, not a new frozen preset: reuse `E5_REGIME.NEPTUNIAN` with high-obliquity (Ward hot-poles inversion), high `hazeMute`, and low internal heat as *tunable inputs*. #3b paints the Uranian read (haze veil + near-empty slots + seasonal polar hood, taxonomy §5) via these parameters; the internal-heat driver that physically separates Uranus from Neptune stays a frozen constant → **derive-not-freeze**. Broader theorized-giant coverage ("wide variety of theorized possible planets") is agenda for derive-not-freeze, not #3b. (V-β)
- **Rider B (polar cyclone-cluster N).** Ship a **declared per-regime canonical N** (Jupiter lattice ~8, Saturn hexagon 6) as the physics-grounded default, exposed **GUI-tunable across a plausible physics range** (proposed 5–8 for both `uPolarSides` and `uPolarRing`, matching the existing driven 5..8 hash range in uniforms.js:371/375), **not a frozen literal**. Per-seed N variation belongs to derive-not-freeze. (V-β)

---

## 4. Slice P — physics writer + mask attribute

**Scope fence.** ADD `src/worldengine/base/storm-e.js` (name pinned) + `tests/worldengine-base-storm-e.test.js`. EDIT `world-engine-lab.html` `applyDrivers` storm-derivation block (delete 3154-3318, replace with a writer call) + the `state` storm fields + the "reroll storms" button. NO edit to `planet-lod-height.glsl.js` render terms in this slice (render stays byte-identical modulo where the slots point). NEVER touch relief/dispatch: `planet-lod-rivers.js`, `src/worldengine/base/{lidResponse,e1Regime,plates,shellRelief,magmatism,stagnantLid,mixedInterior,lidDisruption}.js`; exclude not-ours dirty files (`CameraChoreographer.js`, `LabMode.js`) from every commit.

**Alea namespace (pinned):** `stormE:place`, `stormE:age`, `stormE:phase` — disjoint sub-namespaces, fixed draw order, zero `Math.random`/`Date.now` (the climate-e5 static-source mold).

### Ordered build steps

- **P1 — the writer core `writeStormESphere(...)` / `resolveStormE(regime, drivers, macroSeed, stormSeed)`.**
  - Reuse `resolveParams` + `jetShear`/`jetShearPeak` from climate-e5.js (import, do not copy). Gas gate: `drivers.composition === 'h2-he'` (designDecision 5), else return an empty record set (count 0).
  - **Placement:** argmax of *anticyclonic* shear over the PV-staircase-adjusted jet profile. The PV-staircase adjustment is new #3b machinery — a monotone re-map of the `jetShear(lat,P)` sampling that steepens jet cores into steps (implement as a documented closed-form over the existing `jetProfile` samples; declare its constants with the derive-not-freeze deriver). Deterministic tie-break **lowest-lat → lowest-node** (the ATMOSPHERE-PLAN pin). Band-confined via the existing belt-snap math (port the `_trBeltY` latitude inversion from the deleted block into the writer, cleaned).
  - **Records emitted per vortex:** `{ center[3], radius, rot(sign=cyclonic/anticyclonic), aspect, mode(0 warm/1 dark), ageScalar, phaseScalar, companion }`. Longitude/phase/mix from `stormE:place`/`stormE:phase`; latitudes from the (frozen-input) shear argmax → repeat per seed by design (the carve-out).
  - **Vortex families** (taxonomy-driven, physics-placed, replacing the vigor-branch dice): GRS-class primary at the strongest anticyclonic argmax; vortex street/train at the shared argmax latitude (argmax + next-N shear maxima, even longitudes from phase); cyclonic brown-barge slot (shear-sign → mode 1, high aspect); ice-giant dark spot (mode 1, cleared) on Neptunian/Uranian.
  - **Phase bank:** every vortex carries a place-once `phaseScalar` (`stormE:phase`) — the named substrate for #4/#5/#8. No `uTime` anywhere.
  - AC: AC-WRITER(a) static-source grep + double-run byte equality; (c) argmax + tie-break; (d) arm's-length re-derivation of centers from returned params alone; (e) reseed sweep.

- **P2 — the storm/convection MASK (the ONE new baked attribute).**
  - Mirror `bakeClimateE5Attributes`: add `bakeStormEAttributes(positions, count, radius, opts)` → `Float32Array aStorm`, continuous [0,1], finite, **shear-correlated** above a stated floor (correlate to `|jetShear|` normalized by `jetShearPeak`, the AC8 mold) AND lifted toward 1 near placed vortex centers (mask maxima at/near vortices — AC-FIELDS a). Attribute name `aStorm` (aBand/aShear/aMush precedent).
  - Wire the bake into the same geometry-attribute path #3a uses (find `bakeClimateE5Attributes` call site in the lab geometry build; add the `aStorm` attribute + `varying`). This is the single permitted new attribute; assert no second attribute is added (envelope guard).
  - AC: AC-FIELDS(a) bounds/finiteness/correlation/vortex-consistency; AC-PARITY(a) bake↔writer node equality mold.

- **P3 — wire-in + DELETE + carriage re-point.**
  - DELETE lab 3154-3318 (all three mulberry32 blocks). Replace with a single `resolveStormE(...)` call; map its records → `state.spotCenter/spotRadius/…/trainSpots[]/polar*` fields the 0.3 carriage-filler (lab 5584-5620) reads. The carriage-filler and the three enable gates are unchanged.
  - Migrate the "reroll storms" 🎲: `state.stormSeed` now seeds `stormE:*`; button bumps it and re-runs the writer.
  - AC: AC-OFFGATE(a) storms-off byte-identical; AC-PARITY(b) slot-fill provenance (uStorm slots trace to writer records, not lab dice); AC-0 driver-connectivity + named-consumer + `planet-archetypes.test.js` drift guards.

**Per-step headless checks:** `npx vitest run tests/worldengine-base-storm-e.test.js` (P1/P2); off-gate byte comparison + `tests/v2-0-byte-identity.test.js` + `tests/planet-archetypes.test.js` (P3).

**Non-goals (routed out of Slice P):** no render-term changes (that is V); no per-seed latitude variety (frozen-constant carve-out → derive-not-freeze); no animated phase (static bank only); no new uniform (mask is a baked attribute, not a uniform).

---

## 5. Slice V-α — band + storm-interior render

**Scope fence.** EDIT `planet-lod-height.glsl.js` storm/band GLSL only (`bandWarpField`, `stormSwirl`, `stormColTerms`, and the `zonalBandCol` call sites). NO new uniform (planet-lod-uniforms.js untouched except values). Writer supplies `ageScalar`→color and the mask; the mask arrives via the P2 `aStorm` varying. Static fence: assert **no `uTime`** appears in any added storm term (grep guard).

### Ordered build steps

- **V-α.1 — "ink in water" filamentation term.** New static GLSL that extends `bandWarpField` (height.glsl.js:1522): modulate band-boundary detail by `aShear` (existing) × `aStorm` (new mask) — active where `|shear|`/mask high, absent where low, gated to vanish when the mask is empty. This is the taxonomy 2.1/3.4 mechanism. Not an extension of `jetsDisp` (that reads `uTime`). **FFR sign-of-shear asymmetry (Q8 ratified):** intensify filamentation on the cyclonic side using the sign of the writer's `u(lat)`/shear (taxonomy 2.2).
  - AC-VIS(a): A/B screenshot diff localized to high-shear latitudes; absent when disabled.
- **V-α.2 — GRS wake cone (Q5 ratified: bespoke term).** Add an upstream (west) turbulence-cone term in `stormColTerms` (or a mask bump) anchored to the primary vortex slot (taxonomy 2.4). AC-VIS(b) wake detail.
- **V-α.3 — storm interior structure.** Extend `stormSwirl`/`stormColTerms` so placed vortices render spiral/annular interior detail (not flat oval fill) — nonzero in-radius A/B diff, ~zero outside. AC-VIS(b).
- **V-α.4 — chromophore age coloring.** Writer `ageScalar` → monotonic white→cream→tan→orange→brick-red ramp → `uStormColor[i]`; feeds `stormColTerms` core tint. Two vortices of different age read visibly different. AC-FIELDS(b), AC-VIS(c).
- **V-α.5 — DS2 centered companion (§11 flag 1).** Sign-pack `uStormParams.w`; GLSL edit at height.glsl.js:1663-1665 per §2.1 resolution. AC-FIELDS(c).

**Per-step headless checks:** static-source grep (no `uTime` in new terms); CPU↔GLSL parity for any new color-ramp constant table (emission-e mold). Visual A/B is AC-VIS (live, agent-driven — deferred to the verify workflow's live integration; screenshots to `evidence/`).

**Non-goals:** no polar changes (V-β); no lifecycle phase states (V-β); no animation.

---

## 6. Slice V-β — polar + lifecycle + regime policy

**Scope fence.** EDIT `planet-lod-height.glsl.js` `polarVortexCol` + the haze-mute lever; lab GUI storm/polar folder (canonical-N GUI range); writer regime routing (storm-e.js). NO new uniform. NEVER touch relief/dispatch.

### Ordered build steps

- **V-β.1 — both-poles polar asymmetry (§11 flag 2).** Extend `polarVortexCol` (height.glsl.js:1685) to paint BOTH poles in one pass: active pole (`uPolarPole`) shows `uPolarMode` structure; opposite pole shows a fixed cap (mode 0) from the same uniforms. Realizes Saturn N-hexagon + S-cap (taxonomy 3.1/3.2) with no new uniform. AC-LIVE (Saturnian polar structure).
- **V-β.2 — canonical-N GUI range (Rider B).** Expose `uPolarSides` (hexagon N) and `uPolarRing` (lattice M) GUI-tunable 5–8 with declared per-regime defaults (Jupiter lattice ~8, Saturn 6). Register any new control in `planet-archetypes.js` (AC-0 taxonomy registration). AC-LIVE.
- **V-β.3 — ice-giant dark-spot lifecycle phases (Q6 ratified: three phases).** Writer `ageScalar`→ phase state: precursor (companion only, no dark core) / mature (dark core + offset cap + lat offset) / dissipating (weak contrast, near-equator). Maps to contrast + latitude offset + companion presence across the existing slot primitives; CH₄ companion gated ice-giant-only (AC-FIELDS c). AC-FIELDS(b), AC-LIVE.
- **V-β.4 — haze-mute extension.** Extend the existing #3a contrast lever (`uHazeMute`, uniforms.js:393; `resolveParams.contrast`) to gate storm-color saturation, collar contrast, and filamentation amplitude (taxonomy §1.2). No new uniform. AC-VIS(a) amplitude gated.
- **V-β.5 — Uranian variant (Rider A).** Route Uranian as a Neptunian-regime parameter variant (high obliquity + high haze + near-empty slots + seasonal polar hood via mode-0 cap). AC-LIVE read.
- **V-β.6 — hot-Jupiter suppression policy (Q1 ratified).** #3b hot-Jupiter = banded deck (#3a) + haze only; suppress band-boundary filamentation for the canonical hot/slow single-jet case (absent where shear low — falls out of V-α.1's shear gate); all active HJ phenomena DEFER to #4. AC-VIS(a).

**Per-step headless checks:** `polarVortexCol` parity/no-`uTime` grep; `planet-archetypes.test.js` drift guards for new controls; CPU↔GLSL parity for any polar constant. Per-regime visual sweep is AC-LIVE (live, agent-driven).

**Non-goals (DEFERRED, each named):** festoons/5µm hot-spots, shallow lightning, Neptune warm south-polar, HJ hotspot-offset/nightside-gyres/ultra-hot/patchiness → **#4 emission-v2**; the Scooter/fast plumes → **#5 brown-dwarf**; belt fades, Saturn GWS outbreak, Uranus 2014 outbreak, Neptune-vs-Uranus internal-heat difference → **derive-not-freeze variety**; HJ free vortex → **out-of-class**.

---

## 7. Gate list (run FROM the worktree dir `/home/ax/projects/well-dipper-atmo`)

**Measured at branch point `705d11c` this session (trust these; the contract-grounding's "17 failed files" is stale — see §8):**

| Gate | Command | Expected |
|---|---|---|
| atmosphere fence — climate-e5 | `npx vitest run tests/worldengine-base-climate-e5.test.js` | **17 passed** |
| atmosphere fence — emission-e | `npx vitest run tests/worldengine-base-emission-e.test.js` | **12 passed** |
| byte-identity quartet #1 | `npx vitest run tests/v2-0-byte-identity.test.js` | **83 passed** (75 goldens; NEVER re-capture) |
| quartet #2 — lid-byte-anchors | `npx vitest run tests/worldengine-lid-byte-anchors.test.js` | **39 passed** |
| quartet #3 — e1-shadow-audit | `npx vitest run tests/worldengine-e1-shadow-audit.test.js` | **23 passed** (enumerated at this branch) |
| quartet #4 — planet-archetypes | `npx vitest run tests/planet-archetypes.test.js` | **21 passed** |
| dispatch-oracle | `npx vitest run tests/worldengine-v2-3-dispatch-oracle.test.js` | **25 passed** |
| full-suite baseline | `npx vitest run` | **1920 total, 4 failed / 1916 passed; 7 failed files / 122 total** (vendor/motion-test-kit noise; the 4-failed set must not grow) |
| new writer (P) | `npx vitest run tests/worldengine-base-storm-e.test.js` | new; AC-WRITER/AC-FIELDS/AC-PARITY green |

Per-commit fence audit: `git show --stat <sha>` against the §4/§5/§6 scope fences; not-ours dirty files excluded from every commit.

**Live gates (agent-driven, not headless):** AC-LIVE + AC-VIS on the Max-started dev server (`cd ~/projects/well-dipper-atmo && npm run dev -- --port 5178`, lab `http://localhost:5178/well-dipper/world-engine-lab.html`), liveness via chrome-devtools `list_pages` (never sandbox-curl), screenshots to `evidence/`, all agent pages closed after (window hygiene). AC-UAT is Max's gate alone — never agent-PASSed.

---

## 8. Contract tensions found

1. **Full-suite baseline numbers are stale in the contract-grounding.** Grounding says "EXACTLY 4 failed tests / 17 failed files" and "NOT 2075 here." **Measured at `705d11c`: 1920 total tests, 4 failed / 1916 passed, 7 failed *files* / 122 total files.** The 4-failed-tests baseline holds; the failed-*files* figure (7, not 17) and the total (1920) are what this branch actually reports — pin these in the verify contract, not 17/2075.
2. **"REPLACE+DELETE the mulberry32 hash placement" must not over-reach into the carriage-filler.** The delete target is the *derivation* block (lab 3154-3318). The per-frame slot composer (lab 5584-5620) and the three enable gates are the AC-OFFGATE rails and MUST survive — the writer re-points what fills `state.*`, it does not remove the carriage. Flagged so P3 does not delete the off-gate contract by accident.
3. **`jetsDisp` reads `uTime`.** The nearest existing "boundary turbulence" primitive is animated (F25 band drift). The V-α.1 filamentation term must be a *new static* extension of `bandWarpField`, NOT an extension of `jetsDisp` — otherwise the static-place-once contract (designDecision 2) breaks. Called out because the taxonomy 2.1 row names "the existing recursive domain-warp" and the reflex would be to reuse `jetsDisp`.

---

*Prepared for review. On sign-off, working-Claude promotes this draft to BUILD-PLAN.md and builds slices P → V-α → V-β via opus-pinned workflows, ≤2-3 concurrent agents (WSL OOM rule), staggered against any ground-track workflow.*
