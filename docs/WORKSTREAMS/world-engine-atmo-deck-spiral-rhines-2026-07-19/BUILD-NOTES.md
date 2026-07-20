# BUILD-NOTES — world-engine-atmo-deck-spiral-rhines

> Per-slice build record (function / intent / deliberate non-goals per
> `feedback_record-build-intent`) + the AC-0 driver-connectivity consumer table.
> **Symbol anchors only, never line numbers.** Append one section per slice at its seam.

---

## Increment roll-up (as-built, all four slices landed)

**What this increment does (plain language):** it answers Max's atmo-expression UAT verdict
(2026-07-19) — "the red spot storms still seem pasted on top … I still am not seeing the kind of
'ink diffusing in water' rolling storm effects" — with three mechanisms wired as one unit on the
gas-giant renderer:

1. **A vertical column (deckZ).** Every atmo phenomenon now has a HEIGHT, and compositing is
   derived from it instead of a single paint order. Warm anticyclones (mode 0) are TOWERS that
   earn shaded-relief embossing, a cold ring, and age-tied prominence; dark spots (mode 1) are
   REVEALS that show the belt-family deep deck with band-frequency rim wisps — a hole you look
   into, not a decal. Haze mutes proportional to `(1 − deckZ)`.
2. **A storm-local roll-up (dSpiral).** Band material genuinely winds around aged storms — a
   static log-spiral displacement `ψ = thv + W·log(rr+EPS)`, `W ∝ ageScalar·sign(rot)`, `dWake`'s
   sibling, consumed both meridionally (band latitude winds in) and as a pigment-domain offset
   (arms carry entrained band colour), with a 42-lobe Kelvin-Helmholtz scallop.
3. **The band architecture spans the drawn population (Rhines/rotation wires).** The one law that
   consumes radius finally reads the DRAWN radius at both call sites, rotation becomes a drawn
   per-archetype condition (hot-Jupiter-class derived tidally locked), and the vestigial second
   band count dies so exactly one derived count (`uBandM`) drives everything.

**Intent:** turn "procedurally building the system" into checked artifacts — storms that read as
IN the flow with a real vertical-column architecture, and bands that vary ×2+ across re-rolled
giants (charter INTENT FRAME: physics-derived populations, no defaults). Ships the structural
substrate that Increment 6 (storm sizes from Rossby L_D) and Increment 7 (limb cue + ink thermal
drivers) build on.

**Deliberate non-goals (whole increment):**
- `dAdvect` is Max-LIKED — never edited, only extended around (taste fence).
- Both golden hashes (`GOLDEN_BANDFIELD_HASH -1329854088`, `GOLDEN_STORM_MASK_HASH 568852786`) +
  the aStorm mask contract + the phase bank are byte-identical; new alea streams are APPENDED
  only, never inserted into the four existing `stormE:{place,age,phase,polar}` draws.
- Static discipline: no `uTime` anywhere in the new F24–F31 terms; all new per-storm scalars are
  alea-only.
- No relief/dispatch/bombardment contact (a concurrent Increment-1 lane owns those in the L1
  tree); no `climate-e5.js` edit; no second baked attribute, no `*Enabled` key, no new GUI control.
- Deferred with named owners: limb/scale-height cue + ink thermal drivers → Increment 7; storm
  radii from L_D → Increment 6; figure-ω (`body-condition-vector.js` D8 spin) → a future figure-ω
  increment (F13 divergence, documented in S1).

### DOES / UNLOCKS card — restated as-built

**DOES:** gives every atmo phenomenon a deck height (`deckZ`, DERIVED from mode+age via
`STORM_DECK` rather than a drawn stream — deviation 1) and derives compositing from it (same-deck
deflects via the existing `dWake`/`dAdvect`/`dSpiral` machinery, different-deck occludes/reveals);
makes mode-1 spots holes you look into (deep-deck belt-family palette + band-frequency rim wisps,
luminance donor clamped 1.5 so young/precursor spots stay in family — F-deep) and mode-0 storms
towers that earn height (emboss rim on the `stormE:emboss` axis, cold annulus, age-tied prominence);
adds `dSpiral` static log-spiral displacement so bands wind around aged storms with 42-lobe KH
scalloping leaned downstream WITH radius (F15); wires the drawn radius into Rhines at both call
sites, draws rotation per archetype (hot-Jupiter-class tidally locked, derived — locked SOLIDS stay
canonical, F10), and retires the vestigial second band count (`uBandCount` → derived `uBandM`).

**As-built refinements to the card:** deckZ is derived-not-drawn (deviation 1); the hood-exposure
term is footprint-masked and documented-marginal (no-op at every drawn storm core — F16-hood,
deviation 5); the AC-SPIRAL live read is a RADIAL transect + `wrap_visible`, not the contract's
literal "along a ring" (F9, deviation 6); candidate magnitudes (`EMB_K`/`COLLAR_K`/`WISP_K`/
`WISP_WARP`/`WISP_OFF`/`BAND_SPIRAL.*`) are Phase-A candidates whose live freeze is the
orchestrator's (deviations 3, 6).

**UNLOCKS:** Increment 6 (storm sizes from L_D — needs the deck architecture), Increment 7 (limb
cue + ink drivers — extends deckZ-weighted haze), the brown-dwarf/lava/terrestrial atmo increments
(inherit an honest vertical column), and population-level band variety (the audit's ×2+ visible
spread per roll, made true headlessly by S1 first).

### Deviations summary (all ADJUDICABLE §9 — none hit a HARD STOP; full detail in the per-slice sections + BUILD-PLAN §11)

| # | Slice | Deviation | Why safe |
|---|---|---|---|
| 1 | S2 | **deckZ DERIVED, not a drawn `stormE:deck` stream** — `uStormAux[i].z` computed in the lab carriage (`_stormDeckZ`: mode-0 ⇒ `mix(ZONE,TOWER,0.35+0.65·age)`, mode-1 ⇒ `FLOOR`) from mode + drawn age via `STORM_DECK`. | Stronger AC-0 driver-connectivity (the deck a storm occupies IS the storm); avoids inserting a draw. emboss/billow remain the alea draws. |
| 2 | S2 | **train-slot `s.mode` pass-through** — was hard-coded `0` in `uStormParams[_stormN].z`; now passes the true `s.mode`. | Consumer-safe (§0.4): the only GLSL `.z` reader today is the slot-0 GRS wake gate (`i==0 && …`), which never inspects train slots. |
| 3 | S3 | **`WISP_WARP=1.5` / `WISP_OFF=vec3(2.3,5.7,-1.1)` builder-chosen** — §4.3 gave the rim-wisp form, not these two magnitudes. Declared `const`, commented CANDIDATE. | Same Phase-A candidate bucket as `EMB_K`/`COLLAR_K`/`WISP_K`/`BAND_SPIRAL.*`; live freeze is the orchestrator's. |
| 4 | S3 | **hoodExposure APPLICATION form** — §4.1 gave the value `0.30·hood·(DECK_HAZE−deckZ)` but not how it composites; applied as a deck-weighted dimming multiply on the storm's paint. | Documented-marginal (F16-hood: `hood≈0` at every drawn storm core ⇒ ≡ 1.0 today); excluded from AC-DECK probes. |
| 5 | S3-fix | **hoodExposure FOOTPRINT-MASKED** — root-caused the adversarial refutation (unmasked per-storm multiply darkened the whole planet's hood band far from any vortex); fixed with `hoodFoot = 1 − smoothstep(1.0·R, 1.4·R, d)` ⇒ far-field `col *= 1.0` exact identity. | Not suppression: `[hoodExposure]` structural closer still passes, AC-STATIC unaffected (no uTime), off-gate identity + F16-hood no-op-on-drawn-population conclusion unchanged. |
| 6 | S4 | **pure estimator exports** `spiralWrapProfile`/`spiralMeridional` + derived `SPIRAL_NB` (=42) added to `band-flow.js` beyond the plan's `spiralDisplacement` signature; **`BAND_SPIRAL.*` are Phase-A candidates**; **AC-SPIRAL live read is a RADIAL transect + `wrap_visible`**, not the contract's literal "along a ring" (F9 — the ring read is measurement-vacuous). | `wakeReachProfile` precedent (single-sources test + calibrate); no source-writing, no rng, zero fence contact. Radial read closes the AC's intent (wrap ∝ ageScalar). Surface at UAT. |

### AC-0 consumers documented (the roll-up verify-workstream audits)

Every new field's deriver → DAG consumer is tabled per slice (S1 `state.rotationHours`, S2/S3
`uStormAux[8]`, S4 `BAND_SPIRAL`/`spiralDisplacement`). The named-consumer spine, condensed:

| New field | Deriver (driver/stream) | Consumer(s) |
|---|---|---|
| `state.rotationHours` | `drawPresetRotation` → `giantD:rot:` alea (gas) / `tidalLockRotationHours` (hot-Jupiter-class) / canonical (else) | `giantDriverScalars` → `resolveParams` at BOTH call sites (Rhines band count); `_rotH` → `jetSpeed`/`weatherCells` |
| `uBandM` (single band count) | Rhines m (writer) | `jetU`, `jetShearGate`, `jetsDisp` (retired `uBandCount`'s three sites); mode-1 rim-wisp band frequency |
| `uStormAux[i].x` ageScalar | `stormE:age` vortex field | S3 tower prominence + emboss gain + deck-weighted haze; S4 spiral wrap `W ∝ age` |
| `uStormAux[i].y` embossDir | `stormE:emboss` (new, append-only) | S3 mode-0 shaded-relief asymmetry axis |
| `uStormAux[i].z` deckZ | DERIVED (mode+age via `STORM_DECK`, `_stormDeckZ`) | S3 deck-weighted haze + hoodExposure minuend + mode branch |
| `uStormAux[i].w` billowPhase | `stormE:billow` (new, append-only) | S4 dSpiral KH scallop azimuth phase |
| `STORM_DECK` | frozen export (no alea) | carriage `_stormDeckZ` (FLOOR/ZONE/TOWER); GLSL `DECK_HAZE` (hood minuend); BELT → `deepBase` deriver |
| `BAND_SPIRAL` / `SPIRAL_NB` / `spiralDisplacement` | frozen export + mirror (`band-flow.js`, separate from `BAND_FLOW`) | GLSL `dSpiralVec` constant parity; headless AC-SPIRAL props + `deck-spiral-calibrate.mjs` |

Taxonomy registration: no new `*Enabled` key, no new checkbox, no new FEATURES/PROVINCES row — all
terms ride `PROV_GREATSPOT`/`PROV_BANDS` weights already in place; drift guards green. The existing
`e5RotationScale` slider stays the manual rotation override (a driver dial, not a new control).

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
- **AC-ROTDRAW wrapper gap closed (adversarial verify follow-up):** the `drawRotationHours`
  pure fn was already pinned, but the LAB wrapper `drawPresetRotation` (NAMED_BODY bypass +
  `isHotJupiterClass` dispatch) was confirmed only by code reading. New describe block
  `S1 AC-ROTDRAW — drawPresetRotation lab wrapper` closes it: a source-read leg (`fnBody` over
  `LAB_CODE`, the sibling `drawPresetRadius` house pattern — inline-pinned, not module-extracted)
  asserts the four wired behaviors (NAMED_BODY→canonical bypass; `isHotJupiterClass` identity
  overriding the gate; delegation keyed on `PRESET_ARCHETYPE` carrying the orbit fields; no own
  entropy), and a behavioral leg drives the SHIPPED `DRIVER_PRESETS` data through
  `drawRotationHours`/`tidalLockRotationHours` (Hot Jupiter ≡ orbit-derived + seed-independent;
  Jovian drawn in range + deterministic; Mars canonical). +8 tests.
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
- **hoodExposure:** `col *= 1 − 0.30·hood·(DECK_HAZE − deckZ)·hoodFoot` — a tower (deckZ 0.9)
  barely dims, a mode-1 hole (0.0) dims fully into the hood, applied to THE STORM'S PAINT via the
  `hoodFoot` footprint envelope (S3-fix deviation 5 below). See the reachability note below.

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

**Deviation 5 (S3-fix, root-cause of the adversarial refutation): hoodExposure is
FOOTPRINT-MASKED.** The as-committed term `col *= 1 − 0.30·hood·(DECK_HAZE − deckZ)` carried NO
spatial mask — unlike every other per-storm term it read no `d`-based factor and no facing guard,
so inside the per-storm loop it multiplied EVERY fragment once per storm regardless of storm
position/facing. The declared marginality ("≡ 1.0 today") holds only where `hood = 0`; at polar
fragments `hood → 1` while the storm's own core/collar/rim masks are ≈ 0 (the fragment is far from
the storm), so the term darkened the *whole planet's* hood band by `0.70` per storm, compounding
into near-black poles far from any vortex (8 mode-1 slots ⇒ `0.7^8 ≈ 0.057`). That contradicts
§4.1's "each storm takes hood exposure ∝ its own deck depth — the storm's paint, not the whole
planet" (the base deck already took the FULL planet hood at the pre-call `col *= 1 − 0.30·hood`).
Fix: multiply the exposure by `hoodFoot = 1 − smoothstep(1.0·R, 1.4·R, d)` — 1 across the painted
footprint (core/collar/rim ≤ 1.18–1.35·R), 0 beyond the rim, and 0 on the far side via the `+100`
pedestal already baked into `d`. Far from the storm `hoodFoot = 0` ⇒ `col *= 1.0` EXACT identity,
so the term now only ever dims the storm's own paint. The `[hoodExposure]` structural closer still
passes (`0.30 * hood * (DECK_HAZE - deckZ)` remains a substring); AC-STATIC is unaffected
(`hoodFoot` reads only `d`/`R`/`smoothstep`, no uTime); off-gate identity is unchanged (still
inside the count-gated loop). The F16-hood no-op-on-drawn-population conclusion is UNCHANGED — the
mask only removes the far-field mis-fire, it does not alter behavior at any drawn storm core.

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

---

## S4 — dSPIRAL STATIC ROLL-UP (AC-SPIRAL enablement) (seam 4)

**What it does (plain language):** aged storms now genuinely wind the band material around
themselves. `dSpiralVec` is `dWake`'s sibling — same tangent frame, same `i >= uStormCount`
count-gate, same `uAtmoInk` scale — a STATIC log-spiral displacement `ψ = thv + W·log(rr+EPS)`
with `W ∝ ageScalar·sign(rot)` (older, faster-spun ovals wind harder), confined to a collar
ANNULUS (the core oval stays a coherent oval, it does not smear) and textured by a
Kelvin-Helmholtz SCALLOP whose 42 lobes lean downstream WITH radius (rate `SPIRAL_LEAN`, signed
by the local zonal flow). The single displacement is consumed through TWO channels: (a) its
meridional component folds into the existing `dLat → bandProxy` deflection so band latitude
genuinely winds in; (b) `posD` offsets the 2D domain of the pigment warp samples (the primary
`bandWarpField` warp + the V-α.1 filament) so the spiral arms carry entrained band colour.

**Intent:** close AC-SPIRAL's enablement — visible band winding around an aged storm, ∝ its age,
readable along a RADIAL transect (F9 — a fixed-radius ring shows one cycle for every wrap count
and measures nothing). Keep the stormless render BITWISE-identical (both `NrawD` and `posD` branch
to their literal inputs when `uStormCount == 0`) and the whole term STATIC (no `uTime`). The
amplitude constants are Phase-A CANDIDATES; the live freeze belongs to the orchestrating session.

**Deliberate non-goals (this slice):**
- No `dAdvect` edit (the LIKED layer) — its internal samples keep `Nraw`; no relief/dispatch/
  writer contact; no golden-fixture contact; no new uniform/attribute/`*Enabled`/GUI control.
  S4 touches ONLY `band-flow.js` (a SEPARATE `BAND_SPIRAL` export — `BAND_FLOW` pins untouched),
  `planet-lod-height.glsl.js` (`dSpiralVec` + the `zonalBandCol` head), and `tools/`.
- The slice-J jag KEEPS un-displaced `pos` (F3): its literal `pos * 7.0` is band-flow
  `[parity]`-pinned, and the jag rides the dLat-deflected `bandVal` so band edges still wind.
- No lab edit: `dSpiralVec` reads uniforms already carried by S1/S2 (`uStormAux`, `uStormPosSize`,
  `uStormParams`, `uStormCount`, `uAtmoInk`) + the existing `bandProxy`.

### New / changed symbols (`src/worldengine/base/band-flow.js` — separate `BAND_SPIRAL` export)

| Symbol | Kind | Function | Intent / non-goal |
|---|---|---|---|
| `BAND_SPIRAL` | frozen export | Phase-A candidates: `WRAP 2.5 / EPS 0.08 / AMP 0.30 / ANN_IN 0.45 / ANN_PEAK 0.80 / ANN_OUT_LO 1.35 / ANN_OUT_HI 2.0 / LAMBDA_KH 0.15 / SCAL 0.35 / LEAN 0.6` | NOT folded into `BAND_FLOW` (whose `[candidates]`/`[parity]` tests deep-pin it + `dAdvect`); the GLSL `SPIRAL_*` literals transcribe these |
| `SPIRAL_NB` | derived export | `max(3, round(2π/LAMBDA_KH)) = 42` | the R-invariant KH lobe count (λ_KH ∝ R cancels — adjudicable §9) |
| `spiralDisplacement(dir, vortices, P, {ink})` | pure export | `[dE, dN]` tangential displacement summed per-vortex-frame; `ψ = thv + W·log(rr+EPS)`, KH scallop on the annulus | the GLSL `dSpiralVec` numeric truth; zero/empty vortices ⇒ `[0,0]` (count-gate) |
| `spiralWrapProfile(vortex, P, opts)` | estimator export | frame-exact `dirAt/dispAt/magAt/psiAt`, `wrapVisibleOver`, `crestShift` — single-sourced test+calibrate | the `wakeReachProfile` pattern (no measure drift between suite and tool) |
| `spiralMeridional(dir, vortices, P, {ink})` | estimator export | the GLSL channel-(a) `Δlat = asin(NrawD.y) − asin(dir.y)` | single-sources the dWake+dSpiral superposition-envelope analysis (F17) |

### New / changed symbols (`planet-lod-height.glsl.js` — `dSpiralVec` + `zonalBandCol` head)

| Symbol | Kind | Function | Intent / non-goal |
|---|---|---|---|
| `dSpiralVec(vec3 Nraw)` | new GLSL fn | the log-spiral world-tangent displacement; `SPIRAL_*` consts mirror `BAND_SPIRAL` | sits in the band-flow `I_BODIES` slice ⇒ NO `r0/r1/ph0/ph1/jetRotY/jetsDisp` locals + no `uTime` (F7 naming constraint) |
| `dSp / NrawD / posD` | `zonalBandCol` head | `dSp = dSpiralVec(Nraw)`; `NrawD`/`posD` BRANCH on `uStormCount>0`, literal `Nraw`/`pos` off-gate | F1/F8: `posD` is the RECEIVED (stormSwirl-rotated) `pos` re-projected onto the `length(pos)` shell, NOT rebuilt from `Nraw`; both channels bitwise off-gate |
| `dLat` meridional append | `zonalBandCol` | `+ (asin(clamp(NrawD.y,-1,1)) - latRaw)` APPENDED after `+ dWake(Nraw)` | keeps the band-flow `[wire]` substring `dAdvect(...) + dWake(Nraw)` contained; off-gate `NrawD≡Nraw` ⇒ term exactly 0 |
| primary warp `r` + `fila` | `zonalBandCol` | now sample `posD` (jets-off `bandWarpField(posD)`, jets-on `jetRotY(posD,…)`, filament `bandWarpField(posD*3.7+…)`) | the pigment 2D-domain channel (b); jag stays `pos` (F3) |

### F1/F8 — why `posD` is derived from `pos`, branched (blocker-class, avoided)

Storms-ON, the `pos` `zonalBandCol` receives is the stormSwirl-ROTATED domain (`bandPos =
stormSwirl(normalize(vPos))·length(vPos)`); rebuilding `posD` from the un-swirled `Nraw` would
silently strip the shipped F27 embedded swirl from every pigment sample. Storms-OFF,
`normalize(vPos)·length(vPos)` is NOT bitwise `vPos` (normalize+rescale rounding), so an unbranched
`posD` flips posterize/dither pixels and breaks AC-OFFGATE. The branch takes LITERAL `pos`
off-gate and the normalize-compose form (samples stay on the `length(pos)` shell, the stormSwirl
idiom) storms-on.

### AC-SPIRAL live probe recipe (ORCHESTRATOR closes on `:5178`)

RADIAL-transect read (F9 — NOT a ring): sample band latitude along a radial from an aged storm
over `rr ∈ [1.05, 2.0]` (outside stormSwirl's ≤1R support + dWake's bow core, so the age signal is
attributable — F17). Visible winding matches `wrap_visible = W·Δln(rr+EPS)/2π` (calibrate: global
`[0.007, 0.542]` turns, ≈0.54 at WRAP 2.5 / age 1) and is ∝ ageScalar across two ages; lobe count
== 42-formula; entrained band colour in the arms. Contract wording says "along a ring" — the
radial read is the faithful closer of its intent (adjudicable §9).

### Calibrate (`tools/deck-spiral-calibrate.mjs`, writes no source)

Reports over Jovian/Saturnian/Neptunian × SWEEP_SEEDS: (i) `wrap_visible` distribution
(global `[0.007, 0.542]` turns); (ii) `|dSpiral|` amplitude within the `AMP·R·(1+SCAL)·ink` bound
(F-env — within on every seed); (iii) the combined `|dWake + dSpiral|` meridional envelope vs
`π/uBandM` (F17) — NO population corner exceeds it ⇒ candidates SAFE at Phase-A.

### Gate at seam 4

- Increment file (S1+S2+S3+S4 blocks) + band-flow: green (S4 adds the mirror props — off-gate,
  core-coherent, radial-Δψ wrap ∝ ageScalar, 42-lobe count, rr-coupled flow-signed lean, envelope
  bound, determinism — plus the GLSL↔mirror constant parity, the branched-consumption wiring, the
  jag-excluded pigment pins, and the F7/AC-STATIC dSpiralVec-body grep).
- Fast fence (climate-e5 golden `-1329854088`, emission-e, storm-e golden `568852786` + phase
  bank + `[envelope]`, band-flow `[parity]` dAdvect/dWake pins, giant-drivers, planet-archetypes,
  v2-3 dispatch oracle, v2-0-byte-identity 75 goldens): green.
- Full suite failed-SET unchanged from baseline: 4 failed (KnownObjects ×3 + GalacticFeatures ×1)
  + 5 collection-error env-noise files. Not grown.
