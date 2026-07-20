# BUILD-NOTES — world-engine-atmo-deck-spiral-rhines

> Per-slice build record (function / intent / deliberate non-goals per
> `feedback_record-build-intent`) + the AC-0 driver-connectivity consumer table.
> **Symbol anchors only, never line numbers.** Append one section per slice at its seam.

---

## S1 — RHINES + ROTATION WIRES, ONE BAND COUNT (seam 1)

**What it does (plain language):** the gas-giant band-count law (`rhinesWavenumber` in
`climate-e5.js`) was already correct, but the lab fed it the *preset* radius/rotation
constants instead of the *drawn* body's radius/rotation — so every re-rolled giant showed the
same band count. S1 wires the drawn radius and a newly-drawn rotation period into that law at
both lab call sites, retires a vestigial second band count so exactly one count (`uBandM`,
the Rhines m) drives the whole band section, and makes rotation a drawn condition per archetype
(hot-Jupiter-class derived tidally locked instead of frozen).

**Intent:** make the band architecture span the drawn population (honest ×2+ band-count spread
across re-rolled giants) and collapse the two divergent band-count sources into one derived
count. Pure plumbing with fully-headless ACs; no visual mechanism yet (deck/spiral are S3/S4).

**Deliberate non-goals (this slice):**
- No edit to `climate-e5.js` / `rhinesWavenumber` — the law is correct, only its inputs were
  wrong. Protects `GOLDEN_BANDFIELD_HASH` (golden runs the frozen-`DRIVER_BUNDLES` path, which
  passes no drivers, so the wire never touches it).
- No storm-writer, `dAdvect`, relief/dispatch, or golden-fixture contact.
- `body-condition-vector.js` D8 spin (figure-ω / oblateness source) deliberately NOT wired —
  see the divergence note below.

### New / changed symbols (`src/worldengine/base/giant-drivers.js`, atmo-owned)

| Symbol | Kind | Function | Intent / non-goal |
|---|---|---|---|
| `giantDriverScalars(planetRadiusEarth, rotationHours, e5RotationScale=1)` | pure export | normalizes a drawn `(radiusEarth, rotationHours)` into the Jupiter-normalized `{rotationRate: 9.9/rotH·scale, radius: R/11.2}` the writer's `DRIVER_BUNDLES` override expects | single-sourced so `rebakeE5Bands` + `applyStormState` can never diverge again (that divergence WAS the bug); no entropy |
| `ROTATION_RANGES_HOURS` | frozen export | `{'gas-giant':[8,14], 'sub-neptune':[12,20]}` | **no `'ice'` key (F11):** `PRESET_ARCHETYPE` routes both Neptunian and hazy sub-Neptune to the shared `sub-neptune` tag (V2-3 Option-B taxonomy); the solid-`ice` tag (Frozen/Europa) carries no gas range and correctly stays canonical |
| `tidalLockRotationHours(orbitRadiusEarth, starMassEarth)` | pure export | Kepler P = 2π√(a³/GM), a in Earth radii, M in Earth masses → hours | used ONLY for the hot-Jupiter-class identity, never for a drawn value |
| `drawRotationHours({archetype, canonicalHours, locked, hydrogenAtmo, orbitRadiusEarth, starMassEarth}, seed)` | pure export | draws the rotation period; `locked && hydrogenAtmo` → `tidalLockRotationHours` (derived); gas archetype → uniform on `giantD:rot:` alea stream; else canonical | **hot-Jupiter-class = locked+h2-he ONLY (F10):** gating on `locked` alone would Kepler-derive every locked solid (Eyeball/Lava/Europa/Magma) — a real behavior change breaking the off-gate solid-preset identity proof. Hot-Jupiter preset is ABSENT from `PRESET_ARCHETYPE`, so the identity can never be archetype-keyed. alea is the ONLY entropy |

### New / changed symbols (`planet-lod-lab.html`)

- `drawPresetRotation(presetName, seed)` — sibling of `drawPresetRadius`. `isHotJupiterClass =
  preset.tidalState?.locked && preset.atmosphere?.composition === 'h2-he'`. NAMED_BODY & not
  hot-Jupiter-class → canonical `preset.rotationHours`; hot-Jupiter-class takes the derivation
  branch even though NAMED (contract ruling: the 80 h pseudo-sync is derived, not frozen);
  every other preset routes through `drawRotationHours` keyed on `PRESET_ARCHETYPE[presetName]`.
- `state.rotationHours` — new lab state (replaces `state.bandCount`). Drawn at the
  `_radiusDirty` block alongside `state.planetRadiusEarth` (one reroll = one body-identity
  redraw; disjoint `giantD:rot:` namespace keeps the mulberry32 radius stream byte-identical).
- Both driver-assembly sites (`rebakeE5Bands`, `applyStormState`) now spread
  `...giantDriverScalars(state.planetRadiusEarth, state.rotationHours ?? _fp.rotationHours,
  state.e5RotationScale)` — was the duplicated broken `_fp.radiusEarth/_fp.rotationHours` read.

### AC-0 consumer table — `state.rotationHours` DAG

| Consumer | Reads | Effect |
|---|---|---|
| `rebakeE5Bands` driver assembly | via `giantDriverScalars` → `resolveParams(regime, drivers)` | drawn rotation reaches the Rhines band count |
| `applyStormState` `_stormDrivers` | via `giantDriverScalars` (same single source) | drawn rotation reaches the storm-vortex deriver |
| `_rotH` local in `applyDrivers` | `state.rotationHours ?? _fp.rotationHours ?? 24` | feeds `state.jetSpeed = 8/_rotH` and `state.weatherCells = 72/_rotH` — giants now get drawn F25 drift speed; terrestrial identical (canonical) |

### Retired: `uBandCount` → `uBandM` (AC-ONECOUNT)

- GLSL (`planet-lod-height.glsl.js`): `uniform float uBandCount;` decl deleted; `jetU`,
  `jetShearGate`, `jetsDisp` now read `uBandM` (Rhines m — the count conventions agree, §0.2).
- The historical comment near the `bandVal` assembly was reworded from
  "The old 0.25·latC·uBandCount stripe ladder…" to "The old stripe ladder off the retired
  second band count…" (F4) — otherwise the whole-file `uBandCount` absence grep would trip on
  a comment; the AC-ONECOUNT grep is *also* comment-stripped (belt-and-braces).
- `planet-lod-uniforms.js`: `uBandCount` value entry deleted.
- Lab: `state.bandCount`, its Rhines-flavored derivation block, its `fBands` GUI row, and the
  per-frame `uniforms.uBandCount.value` line all removed. `state.e5BandCount` (writer
  diagnostic probe) is untouched.

### Guard extension (intent-preserving, non-weakening — F6)

`tests/worldengine-base-giant-drivers.test.js` `[namespaced entropy]` extended to the exact
three-part shape the plan specifies (builder did NOT improvise): (i) the whole-module loop
widens each per-call assertion to `/giantD:(cond|rot):/`; (ii) a NEW assertion slices the
`drawGiantConditions` body and re-pins its alea args to `giantD:cond:` at FULL strength; (iii)
a NEW assertion slices `drawRotationHours` and pins its alea args to `giantD:rot:`. A cond-stream
call silently renamed `rot:` still fails (ii). The guard's own description always pinned "the
giantD: namespace" — this is an intent-preserving extension, NOT a golden re-capture.

### Known consequences (not bugs — surface at UAT / morning report)

- **Hot-Jupiter derived lock period ≈ 1.42×10⁵ h** from the preset's deliberately
  non-orbit-consistent `orbitRadiusEarth 150000` (a ≈ 6.39 AU, M = 1 M_sun ⇒ P ≈ 16.1 yr).
  `rotationRate ≈ 7.0e-5` ⇒ `rhinesWavenumber` floors at `M_MIN = 2` — exactly the AC-RHINES
  collapse prediction. The honest derivation, as ruled. The S1 test asserts IDENTITY to
  `tidalLockRotationHours(150000, 332946)`, never a magnitude.
- **Figure-ω divergence (F13, deferred consumer with named owner):**
  `body-condition-vector.js` carries D8 spin as `fp.rotationHours ?? 24` (V2-4 C5 —
  the E2-figure/oblateness ω source), and all `deriveConditionVector` sites pass `_fp` — so a
  drawn 8 h Jovian keeps the canonical 9.9 h figure ω. Deliberately NOT wired this increment
  (blast radius: bodyFigure/oblateness + possible golden contact, outside this contract's AC
  set). Mirrors the dynamo-gate deferral; owner = a future figure-ω increment.
- **Off-gate identity caveat for the verifier:** S1 intentionally changes STORMLESS GAS output
  (honest band count from drawn R/rot). Off-gate identity is proven on solid presets (full) and
  on gas with radius+rotation pinned canonical — NOT on free-drawn gas seeds. AC-ADVECT-REGRESS
  / AC-POP live probes must pin radius+rotation canonical to read a dAdvect regression rather
  than the intended S1 band-count honesty.

### Gate at seam 1

- S1 file `tests/worldengine-atmo-deck-spiral-rhines.test.js` + extended
  `worldengine-base-giant-drivers.test.js`: green (43 tests).
- Fast fence (climate-e5 golden `-1329854088`, emission-e, storm-e golden `568852786` + phase
  bank + `[envelope]`, band-flow, giant-drivers, planet-archetypes, v2-3 dispatch oracle,
  v2-0-byte-identity 75 goldens): green (212 tests).
- Full suite failed-SET unchanged from baseline: 4 failed (KnownObjects ×3 + GalacticFeatures
  ×1) + 5 collection-error files (BodyRenderer.dispose, motion-test-kit-smoke,
  star-billboard-switch, warp-portal-logdepth, warp-tunnel-rebase — env noise). Not grown.

---

## S2 — PER-STORM SCALAR SUBSTRATE (streams + carriage; zero visual change) (seam 2)

**What it does (plain language):** every storm vortex already carries a seeded age + phase.
S2 gives each vortex two more place-once seeded scalars — an *emboss direction* (a shading
axis) and a *billow phase* (a scallop azimuth) — drawn on two brand-new alea streams, and
carries all of it (plus a derived *deckZ* height) into the shader through one new uniform array
`uStormAux[8]`. Nothing is drawn on screen yet: the uniform is declared but unread this slice.
It is the substrate S3 (deck compositing) and S4 (spiral roll-up) read.

**Intent:** land the scariest fence in the whole increment — the storm-mask golden + phase
bank + draw-order — in ISOLATION, so S3/S4 diffs can never be confused with a stream
regression. The two new streams are drawn in an APPEND-ONLY post-pass over the finalized vortex
list, so they consume zero draws from the four placement streams ⇒ `GOLDEN_STORM_MASK_HASH` +
the phase bank + every #4/#5/#8 downstream consumer are byte-identical **by construction**.

**Deliberate non-goals (this slice):**
- No render change: `uStormAux` is a DECL-ONLY uniform (an unread declared uniform is
  compile-safe). No new GLSL term, no `stormColTerms`/`zonalBandCol` edit (that is S3).
- No draw INSERTED into `stormE:{place,age,phase,polar}` — the append-only post-pass is the
  only sanctioned shape. No `dAdvect`, relief/dispatch, or golden-fixture contact.
- No new baked attribute, no `*Enabled` key, no new GUI control.

### New / changed symbols (`src/worldengine/base/storm-e.js`)

| Symbol | Kind | Function | Intent / non-goal |
|---|---|---|---|
| `stormE:emboss` / `stormE:billow` | alea streams | post-pass over the FINALIZED `vortices` list sets `v.embossDir = rngEmboss()·2π`, `v.billowPhase = rngBillow()·2π` | append-only AFTER `stormE:{place,age,phase,polar}` — the golden mask + phase-bank tests are the non-disturbance proof; both are STATIC place-once (no uTime) |
| `STORM_DECK` | frozen export (no alea) | the five-row deck table `{FLOOR 0.0, BELT 0.35, ZONE 0.7, TOWER 0.9, HAZE 1.0}` | F16-consts: computational values live where consumed — the lab carriage's `_stormDeckZ` reads FLOOR/ZONE/TOWER now; GLSL `DECK_HAZE` (hood minuend) + BELT (deepBase deriver) get their consumers in S3. Guard-safe: no alea in the decl |

### New / changed symbols (`planet-lod-lab.html`)

- `_stormDeckZ(mode, age)` — the deckZ derivation (deckZ is DERIVED, not a drawn scalar: the
  deck a storm occupies IS the storm). Mode 0 (warm) ⇒ `mix(ZONE, TOWER, 0.35 + 0.65·age)` (a
  tower whose height ∝ prominence, sharing the chromophore age driver); mode 1 (dark spot) ⇒
  `FLOOR` (the hole reveals the deep floor). Reads `STORM_DECK`.
- `applyStormState()` stashes `state.spotAge/spotEmboss/spotBillow` (from the primary's
  `ageScalar/embossDir/billowPhase`) and extends the `trainSpots` map entries with
  `{ age, embossDir, billowPhase, mode }`.
- Per-frame carriage: `uStormAux.value[_stormN].set(age, embossDir, deckZ, billowPhase)` is
  written **inside BOTH gated composition blocks at the matching `_stormN`** (F2 slot-sync,
  below). The train-slot `uStormParams` write now passes the TRUE `s.mode` where it hard-coded
  `0` (§0.4 consumer-safe: only slot-0's `.z` is read in GLSL today, by the GRS wake gate).

### F2 slot-sync (blocker-class desync, avoided)

The composition loop runs behind TWO independent GUI gates: `greatSpotEnabled` writes slot 0,
`stormTrainEnabled` writes slots `_stormN`+. With greatSpot OFF, train members occupy slot 0+.
A naive `aux[0]=primary / aux[1..]=train` fill would desync `uStormAux` from
`uStormPosSize/uStormParams/uStormColor` whenever greatSpot is unchecked — S3/S4 would then read
another storm's deck/emboss/billow scalars under an existing toggle. Fix: the aux write lives
INSIDE each gated block at the exact same `_stormN` index as the other arrays. The increment
test greps BOTH blocks (`uStormAux.value[0]` in the greatSpot block; `uStormAux.value[_stormN]`
in the train loop).

### AC-0 consumer table — `uStormAux[8]` DAG

| Field | Deriver | Consumer (this slice → future) |
|---|---|---|
| `uStormAux[i].x` = ageScalar | existing `stormE:age` vortex field | decl-only S2 → S3 prominence/haze, S4 spiral wrap `W ∝ age` |
| `uStormAux[i].y` = embossDir | `stormE:emboss` (new) | decl-only S2 → S3 emboss rim / cold-annulus shading axis |
| `uStormAux[i].z` = deckZ | DERIVED (mode+age via `STORM_DECK`, `_stormDeckZ`) | decl-only S2 → S3 hood exposure + deck-weighted haze |
| `uStormAux[i].w` = billowPhase | `stormE:billow` (new) | decl-only S2 → S4 dSpiral scallop azimuth phase |

### Gate at seam 2

- Increment file `tests/worldengine-atmo-deck-spiral-rhines.test.js` (S1 + S2 blocks) +
  `worldengine-base-storm-e.test.js`: green (50 tests) — the storm-e golden mask `568852786`,
  phase bank, `[envelope]`, and #4/#5/#8 consumer tests pass UNCHANGED (AC-FENCE re-proof).
- Fast fence (climate-e5 golden `-1329854088`, emission-e, band-flow, giant-drivers,
  planet-archetypes, v2-3 dispatch oracle, v2-0-byte-identity 75 goldens): green (216 tests).
- Full suite failed-SET unchanged from baseline: 4 failed (KnownObjects ×3 + GalacticFeatures
  ×1) + collection-error env-noise files. Not grown.
