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

---

## S3 — DECK-Z COMPOSITOR (AC-DECK enablement) (seam 3)

**What it does (plain language):** until now the storm was *painted onto* the finished band
color with one alpha-over rule for both storm kinds (the audit's "pasted" root cause). S3 gives
every storm a HEIGHT (the S2-carried `deckZ`) and derives its compositing from it. A warm
anticyclone (mode 0) is a TOWER (deckZ 0.7–0.9): it earns shaded-relief embossing, a cold ring
instead of a bright collar, and a core weight that grows with age. A dark spot (mode 1) is a
REVEAL down to the deep FLOOR (deckZ 0.0): its interior stops taking the storm's hue and instead
shows the belt-family deep deck, with thin band-frequency wisps streaking its rim. Haze becomes
deck-weighted (a tower pokes above the haze; a hole mutes fully), and a documented-marginal
hood-exposure term lets a high deck poke above the polar hood.

**Intent:** close AC-DECK's enablement — make storms read as vertical structure occluding/
revealing the deck around them, not decals — while keeping the stormless render byte-identical
(every S3 term lives inside the `uStormCount > 0` gate or the per-storm loop) and the whole thing
STATIC (no `uTime`). Live pixel probes are the orchestrator's; this slice ships the mechanism +
the source-structure closers.

**Deliberate non-goals (this slice):**
- No `dAdvect` edit (the LIKED layer), no relief/dispatch/writer contact, no golden-fixture
  contact — S3 touches ONLY `zonalBandCol` + `stormColTerms` in `planet-lod-height.glsl.js`.
- No new uniform, attribute, `*Enabled` key, or GUI control — S3 consumes the S2 `uStormAux`
  carriage and the `STORM_DECK`/`DECK_HAZE` constants already in place.
- V-α.2 GRS wake, V-α.3 interior spiral, V-α.5 companion cloud left byte-untouched (audit-correct).
- The dSpiral roll-up is S4, not here.

### New / changed symbols (`planet-lod-height.glsl.js` — storm section only)

| Symbol | Kind | Function | Intent / non-goal |
|---|---|---|---|
| `LUMA` | `const vec3` | Rec.601 luma weights `(0.299,0.587,0.114)` | replaces the file's inline weight triples in new code; single source for the deep-deck donor + cold-annulus luminance |
| `DECK_HAZE` | `const float` 1.0 | the hood/haze deck height — the `hoodExposure` minuend | F16-consts: the ONLY GLSL-declared deck const (FLOOR/ZONE/TOWER live in `STORM_DECK`, BELT in `deepBase`) |
| `EMB_K` / `COLLAR_K` / `WISP_K` / `WISP_WARP` / `WISP_OFF` | `const` | mode-0 emboss gain 0.18, cold-annulus depth 0.55, mode-1 wisp weight 0.10, wisp warp gain 1.5, wisp offset `(2.3,5.7,-1.1)` | **Phase-A CANDIDATES** — Phase-B live freeze belongs to the orchestrating session (atmo-expression precedent). `WISP_WARP`/`WISP_OFF` are builder-chosen (the plan gave the wisp form, not these two magnitudes — deviation 3 below) |
| `stormColTerms(vec3 n, vec3 col, float hood)` | signature change | gains the `hood` param so each storm takes hood exposure ∝ its own deck depth | the call site `stormColTerms(N, col, hood)` + the hood reorder pass it |

### Composition reorder (`zonalBandCol` tail)

- The polar-hood multiply (`col *= 1.0 − 0.30·hood`) now runs BEFORE the storm call (was after),
  so `stormColTerms` receives the hood-dimmed base and can re-expose high decks per storm.
  **Off-gate byte-identity is preserved:** when `uStormCount == 0` the storm call is skipped in
  BOTH orders, leaving `col *= 1−0.30·hood` then `polarVortexCol` — a scalar multiply of the same
  value in the same sequence. Storms-ON is *supposed* to change (that is AC-DECK). The polar
  vortex still paints last (deck = `DECK_HAZE`, correctly on top).

### Per-storm compositing (inside the loop, AFTER the `i >= uStormCount` break)

- **Deck reads:** `age = uStormAux[i].x`, `deckZ = uStormAux[i].z`, `prom = 0.35 + 0.65·age`
  (the same reconstruction the carriage `_stormDeckZ` used — comment cross-ref, single source is
  the carriage value in `.z`).
- **Deck-weighted haze:** `hazeX = uHazeMute·(1 − deckZ)`; `stormCol = mix(uStormColor[i], luma,
  hazeX)`, `hazeAmp = 1 − hazeX`. `uHazeMute == 0` on every non-haze preset ⇒ `hazeX == 0` ⇒ the
  V-β.4 byte-identity precedent holds.
- **mode-0 tower (`uStormParams[i].z < 0.5`):** core weight `core·(0.60 + 0.30·prom)` (aged GRS
  ≈ 0.90, young ovals lower); emboss rim `col *= 1 + EMB_K·prom·rim·asym·hazeAmp` with
  `asym = cos(thv − embossDir)` (the `stormE:emboss` axis — the live AC-DECK asymmetry probe);
  cold annulus `mix(col, luma·(0.90,0.99,1.14), COLLAR_K·collar·hazeAmp)` replacing the old
  bright-collar luminance lift.
- **mode-1 reveal (else):** `deepBase = uBandTint·(0.62,0.52,0.42)·(0.72,0.60,0.52)` (belt family
  darkened + warmed); `deep = deepBase · min(dot(uStormColor[i],luma)/max(dot(deepBase,luma),
  1e-3), 1.5)` — HUE from the deep deck, VALUE from the writer lifecycle donor, ratio **CLAMPED at
  1.5** (F-deep: precursor spots would otherwise desaturate out of the belt family). Core mixes
  toward `deep`, NOT `uStormColor`. Keeps the pale-collar luminance lift. Rim wisps
  `sin(uBandM·latHere + uBandPhaseJet + WISP_WARP·bandWarpField(n·4.3 + WISP_OFF))` sharpened
  `pow(|·|,6)`, mixed toward a zone-tint at `WISP_K·wispBand`.
- **hoodExposure:** `col *= 1 − 0.30·hood·(DECK_HAZE − deckZ)` — a tower (deckZ 0.9) barely dims,
  a mode-1 hole (0.0) dims fully into the hood. See the reachability note below.

### hoodExposure reachability (F16-hood — documented-marginal, EXCLUDED from probes)

For the DRAWN population the term is a no-op: writer pole-avoidance `BELT_Y_MAX 0.75` (|sin lat|
≤ 0.75 ⇒ center ≤ 0.848 rad, +0.06 mature poleward drift) with `SPOT_R_MIN 0.18 + SPAN 0.12`
(R ≤ 0.30 rad) puts a storm core's max normalized `trueLat` (×2/π; GLSL anchor
`asin(clamp(N.y,…))·0.63661977`) at ≈ 0.67 < the `smoothstep(0.72, 0.95, …)` hood floor ⇒
**core `hood` is exactly 0 population-wide**, so `1 − 0.30·hood·(…)` ≡ 1.0 at every storm core
today. Only the outer collar fringe of an extreme-corner storm (max lat, max R) reaches
`hood ≈ 0.3`. Kept as principled future-proofing for polar-storm increments (one multiply,
correct physics); hood interaction stays OUT of the AC-DECK probe recipe (unfalsifiable on the
drawn population).

### AC-0 consumer table — S3 reads of the S2 carriage

| Reads | From | Effect |
|---|---|---|
| `uStormAux[i].x` (ageScalar) | `stormE:age` (via carriage) | `prom` → tower core weight + emboss gain |
| `uStormAux[i].y` (embossDir) | `stormE:emboss` | mode-0 shaded-relief asymmetry axis |
| `uStormAux[i].z` (deckZ) | `STORM_DECK`-derived (`_stormDeckZ`) | deck-weighted haze + hoodExposure + mode branch |
| `uStormColor[i]` | writer lifecycle (`_stormColor`) | mode-1 luminance donor (value only; hue from `deepBase`) |
| `uBandTint / uBandM / uBandPhaseJet` | band writer | mode-1 `deepBase` family + rim-wisp band frequency |

### AC-DECK live probe recipe (ORCHESTRATOR closes on `:5178`)

Fixed seed with a mode-0 primary (Jovian) and mode-1 primaries at BOTH a mature AND a
young/precursor lifecycle phase (Neptunian — the F-deep young-spot case), probe coords from
`state.spotCenter`: (1) mode-0 emboss luminance asymmetry across `embossDir`; (2) desaturated/
blue-shifted mode-0 collar; (3) mode-1 interior within the belt-derived family (hue distance to
`deepBase` ≪ to `uStormColor` hue) on BOTH mature AND young spots; (4) rim wisps at band
frequency. Hood interaction NOT probed (F16-hood — unreachable on the drawn population).

### Gate at seam 3

- Increment file `tests/worldengine-atmo-deck-spiral-rhines.test.js` (S1+S2+S3 blocks) +
  band-flow + storm-e + climate-e5: green (105 tests) — the S3 AC-STATIC diff-scoped grep, the
  deck-read / mode-0 / mode-1 / hoodExposure structure closers, the off-gate structural asserts,
  and the dAdvect-untouched fence all pass.
- Fast fence (climate-e5 golden `-1329854088`, emission-e, storm-e golden `568852786` + phase
  bank + `[envelope]`, band-flow `[parity]` dAdvect/dWake pins, giant-drivers, planet-archetypes,
  v2-3 dispatch oracle, v2-0-byte-identity 75 goldens): green.
- Full suite failed-SET unchanged from baseline: 4 failed (KnownObjects ×3 + GalacticFeatures
  ×1) + 5 collection-error env-noise files. Not grown.
