# BUILD-PLAN — world-engine-atmo-deck-spiral-rhines-2026-07-19

> **Author:** BUILD-PLAN subagent (planner), 2026-07-19, worktree `~/projects/well-dipper-atmo`
> (branch `feature/world-engine-atmo-3b`, scoped at `93287d3`).
> **Symbol anchors only — never line numbers.** Run every suite FROM the worktree dir
> (`cd ~/projects/well-dipper-atmo && npx vitest run …`).
> **Binding scope pins (contract `designDecisions` — do NOT re-litigate):** deckZ table
> `0.0 deep floor / 0.35 belts / 0.7 zones-mush / 0.9 mode-0 tower / 1.0 haze-polar hood`;
> same-deck DEFLECTS (existing `dWake`/`dAdvect` machinery, correct as-is), different-deck
> OCCLUDES/REVEALS; mode-1 fill derived from the deep-deck (belt) palette, NOT `uStormColor`;
> mode-0 earns height (emboss rim + cold annulus + age-∝ prominence); `dSpiral` is `dWake`'s
> sibling (same tangent frame / count-gate / `uAtmoInk` scale), ψ = thv + W·log(rr+ε),
> W ∝ ageScalar·sign(rot); Rhines wire = `state.planetRadiusEarth` into `resolveParams` at BOTH
> call sites; `drawPresetRotation` per archetype, hot-Jupiter DERIVED tidally locked; ONE band
> count (`uBandCount` retired, festoon gate derives from `uBandM`).
> **Hard fences (task charter):** `GOLDEN_BANDFIELD_HASH -1329854088` + `GOLDEN_STORM_MASK_HASH
> 568852786` never move, never re-captured; aStorm mask contract + phase bank byte-identical;
> existing `stormE:{place,age,phase,polar}` draw order untouched (new streams APPENDED only);
> `dAdvect` is Max-LIKED — never edited; no `uTime` in any NEW F24–F31 term (diff-scoped grep —
> the legacy F25 jets path legitimately contains `uTime`/`ph0`/`ph1`/`r0`/`r1` inside
> `zonalBandCol`, established house interpretation from the atmo-expression lens log); no
> relief/dispatch edits (concurrent L1 lane owns them); explicit-path `git add` only; no push.

---

## 0. Grounding ledger (every seam cited by file + symbol; verified against `93287d3` this session)

### 0.1 The compositing sites deckZ restructures

`planet-lod-height.glsl.js` — the F24–F31 storm/band section:
- `zonalBandCol(N, Nraw, pos, wBand, wShear, wMush, wStorm)` — the combiner. Current tail
  order: base band color (`zone` smoothstep → `zoneCol`/`beltCol` mix off `uBandTint`) → warp
  grain → mush tint → `if (uStormCount > 0) col = mix(col, stormColTerms(N, col),
  provinceWeight(PROV_GREATSPOT))` → polar `hood` multiply (`smoothstep(0.72,0.95,|trueLat|)`,
  ×`1−0.30·hood`) → `polarVortexCol`. **The storm is painted BEFORE the hood and with one
  alpha-over rule for both modes — the audit's "pasted" root cause.**
- `stormColTerms(n, col)` — per-storm loop (tangent frame `east = normalize(cross(up,c))`,
  `north = cross(c,east)`, elliptical `d` with `+100` far-side pedestal): core
  `mix(col, stormCol, core·0.85)` where `stormCol = mix(uStormColor[i], luma, uHazeMute)`;
  pale collar `×(1+0.22·collar·hazeAmp)`; V-α.3 interior spiral LUMINANCE detail (`rr<1`);
  V-α.5 companion (`uStormParams[i].w` sign-packed); V-α.2 GRS west wake cone gated
  `i==0 && uStormParams[0].z < 0.5`. `uStormParams[i]` = x rotStrength, y aspect, z mode,
  w companion.
- `dAdvect(Nraw, wShear, wBand, wStorm)` — **LIKED, frozen.** Its GLSL body is pinned by the
  band-flow `[parity]` test (exact `INK_FREQ = 2.2` etc. substrings) — one more reason no edit
  can touch it.
- `dWake(Nraw)` — the sibling pattern `dSpiral` copies: per-storm loop, count-gate
  `if (i >= uStormCount) break`, same tangent frame, `facing` antipode kill, downstream sign
  `flow = sign(bandProxy(latC) − 0.5)`, scaled `uAtmoInk`, `WAKE_*` consts mirror-paired with
  `band-flow.js BAND_FLOW.WAKE_*`.
- `bandProxy(lat)` — the 6-uniform analytic reconstruction of `aBand`
  (`uBandM/uBandPhaseJet/uBandSEq/uBandAMid/uBandS2/uBandDeflectScale`); **latitude-only by
  contract** — hence dSpiral's zonal component must route through the warp-domain offset, not
  the proxy.
- Deflection consumption site in `zonalBandCol`:
  `float dLat = dAdvect(…) + dWake(Nraw); bandVal += bandProxy(latRaw + dLat) − bandProxy(latRaw);`
- Pigment samples that take the dSpiral 2D domain offset: the primary warp `r`
  (`bandWarpField(pos)` jets-off / `bandWarpField(jetRotY(pos,…))` jets-on) and the V-α.1
  filament `fila = bandWarpField(pos·3.7+…)`. The slice-J jag sample is EXCLUDED — its
  literal `pos * 7.0` is pinned by the band-flow slice-J `[parity]` test, and the jag rides
  the dLat-deflected `bandVal` anyway, so band edges still wind (lens fold F3; adjudicable
  §9). Both displaced samples are storm-independent today; offsetting them by a count-gated
  BRANCHED displacement keeps the off-gate byte-exact (§5.3).
- **Call-site domain fact (lens fold F1/F8; verified this session):** the `pos` that
  `zonalBandCol` receives from the lab is `bandPos` — literal `vPos` when `uStormCount==0`,
  and `stormSwirl(normalize(vPos))·length(vPos)` (the SWIRLED domain) when storms are on.
  Any `posD` must therefore be derived FROM the received `pos` (composing spiral with swirl)
  and must branch to literal `pos` off-gate — never rebuilt from `Nraw` (drops the swirl) and
  never `normalize(vPos)·length(vPos)` unconditionally (ulp drift breaks byte identity).

### 0.2 The vestigial second band count (AC-ONECOUNT target)

`uBandCount` (`planet-lod-uniforms.js` value entry; `uniform float uBandCount;` decl in
`planet-lod-height.glsl.js`) is read at exactly THREE GLSL sites, all in the F25 jets family
inside the band section: `jetU` (`sin(6.2831853·0.25·latC·uBandCount)`), `jetShearGate` (same
ladder), `jetsDisp` (festoon window `b = 0.25·latC·uBandCount`). CPU side:
`state.bandCount = round(12·(_fp.radiusEarth ?? 1)/_rotH)` clamp 3..16 in `applyDrivers` (the
"Band count, Rhines-flavored" block), GUI row `fBands.add(state,'bandCount',…)`, per-frame
`uniforms.uBandCount.value = state.bandCount`. **No vitest pins the `uBandCount` uniform**
(the only `bandCount` test hits are the WRITER diagnostic `bake.bandCount` in
`worldengine-base-climate-e5.test.js` — untouched). The writer's `uBandM = P.m` counts
belt/zone alternations pole-to-pole in the same convention (`sin(m·lat)` over ±π/2 ⇒ m
half-periods), so `uBandM` is a drop-in for the ladder count.

### 0.3 The broken Rhines wires (session-verified; trust, don't re-derive)

`world-engine-lab.html`:
- `rebakeE5Bands()`: `drivers = { ..._gd, rotationRate: (9.9/(_fp.rotationHours ?? 24))·(state.e5RotationScale ?? 1), radius: (_fp.radiusEarth ?? 1)/11.2 }`
  — **preset constants**, while `deriveConditionVector(_fp, _gu, state.planetRadiusEarth)` two
  lines up already receives the drawn radius.
- `applyStormState()`: `_stormDrivers` repeats the exact same two preset-constant lines.
- `drawPresetRadius(presetName, seed)`: NAMED_BODY → canonical; else `PRESET_ARCHETYPE` →
  `RADIUS_RANGES_EARTH` (gas-giant [6,14], sub-neptune [2.5,4.0], ice [0.4,1.2],
  hot-jupiter [8,16]) via mulberry32. Applied at the `state._radiusDirty` block in
  `applyDrivers` → `state.planetRadiusEarth`.
- `NAMED_BODY` set includes `'Hot Jupiter (locked giant)'`; hot-Jupiter preset:
  `rotationHours:80` (comment: "pseudo-synchronous"), `orbitRadiusEarth:150000`,
  `starMassEarth:332946`, `tidalState:{locked:true}`.
- Rotation is **never drawn**: every gas rotation consumer reads `_fp.rotationHours`
  (`rebakeE5Bands`, `applyStormState`, the `_rotH` local feeding `state.jetSpeed = 8/_rotH`
  and `state.weatherCells = 72/_rotH`).

`src/worldengine/base/climate-e5.js` (READ-ONLY this increment — protects
`GOLDEN_BANDFIELD_HASH`): `rhinesWavenumber(rotationRate, radius, uPeak) =
max(M_MIN, round(RHINES_K·√(radius·rotationRate/uPeak)))`, `RHINES_K = 15.2`, `M_MIN = 2`.
The law is correct; only the caller-supplied `drivers.radius`/`drivers.rotationRate` are wrong.

### 0.4 The storm writer + stream bank (append-only surface)

`src/worldengine/base/storm-e.js`: `resolveStormE(regime, drivers, macroSeed, stormSeed)` draws
`stormE:polar` FIRST (disjoint), then `stormE:place` / `stormE:age` / `stormE:phase` with fixed
draw order into `makeVortex(lat, lon, radius, rot, aspect, mode, role, ageScalar, phaseScalar,
companion, node, score)`. `GOLDEN_STORM_MASK_HASH` reads ONLY `stormE:place` vortices. Guards
in `tests/worldengine-base-storm-e.test.js`: every `alea(…)` arg must contain `'stormE:'`
(new `stormE:emboss`/`stormE:billow` namespaces PASS); the four existing namespaces must be
present; `[envelope]` = exactly one `attribute float aStorm` in the lab + no uniform named
`uStormMask` (our `uStormAux` is safe); golden mask + phase-bank byte tests are the draw-order
proof. Downstream consumers #4 lightning / #5 brown-dwarf / #8 Mars-oscillator read the phase
bank + mask — untouched fields.

Lab carriage (`world-engine-lab.html`): `applyStormState()` maps writer output → `state.spot*` /
`state.trainSpots[]` (**drops `ageScalar` and `mode` for train members today** — the per-frame
block passes literal mode `0` for train slots: `uStormParams.value[_stormN].set(s.rot,
s.aspect, 0, s.companion)`; only `uStormParams[0].z` is ever read in GLSL today, by the GRS
wake gate — so passing the true `s.mode` is consumer-safe). Per-frame F27/F28 carriage block
fills `uStormPosSize/uStormParams/uStormColor/uStormCount`.

### 0.5 Namespace-guard landscape for the new draws

- `storm-e.js` new streams must be `stormE:*` ✓ (`stormE:emboss:`, `stormE:billow:`).
- `giant-drivers.js` `[namespaced entropy]` guard currently asserts every alea arg contains
  `'giantD:cond:'` — adding a rotation draw there requires EXTENDING that guard, in the F6
  NON-WEAKENING shape specified in §2.4 (widened whole-module loop + a cond-path slice
  assertion that re-pins `giantD:cond:` at full strength + a rot-path slice assertion) — an
  intent-preserving guard extension (its own description says "the giantD: namespace"; record
  in BUILD-NOTES; NOT a golden re-capture). A bare loop-widen to `giantD:(cond|rot):` alone
  is REJECTED (it would let an existing cond call silently rename to rot — brushing the §9
  hard stop).
- `band-flow.js` guard: every alea must be `bandFlow:*` and NOT `stormE:/climateE5:/giantD:` —
  so the rotation draw does NOT go in band-flow. Its `[candidates]`/`[parity]` tests pin
  `BAND_FLOW` values and the `dAdvect` GLSL body substrings — new spiral constants therefore
  live in a **separate frozen export** (`BAND_SPIRAL`), and `dAdvect` is never edited.

### 0.6 Gate bundle measured baseline

Full suite pre-existing failed-SET (NOT ours): 4 failed (KnownObjects ×3 + GalacticFeatures ×1)
+ ~5–7 collection-error files (env noise). Fast fence (from the worktree dir):
`worldengine-base-climate-e5` (golden `-1329854088`) · `worldengine-base-emission-e`
(re-asserts same) · `worldengine-base-storm-e` (golden `568852786`, alea guard, `[envelope]`,
phase bank) · `worldengine-base-band-flow` · `worldengine-base-giant-drivers` ·
`planet-archetypes` (checkbox-key drift guard) · `worldengine-v2-3-dispatch-oracle` ·
`v2-0-byte-identity` (75 goldens). Re-measure the full-suite SET at the build commit; it must
not grow.

---

## 1. The unifying architecture

Three mechanisms, one vertical-column story:

1. **deckZ** gives every already-painted phenomenon a HEIGHT, and derives compositing from it.
   Nothing about the stormless deck changes — belts/zones/mush keep their exact arithmetic
   (their deck values 0.35/0.7 are DECLARED constants consumed only where a different-deck
   phenomenon meets them). All deck logic lives inside the existing `uStormCount > 0` gate +
   `stormColTerms`, so **off-gate identity is structural**.
2. **dSpiral** makes band material genuinely wind around aged storms: a count-gated static
   log-spiral displacement consumed (a) meridionally into the existing `dLat → bandProxy`
   deflection and (b) as a 2D domain offset of the pigment warp samples. It is `dWake`'s
   sibling in every mechanical respect and shares its off-gate lever.
3. **Rhines/rotation wires** make the band architecture span the drawn population: the correct
   law finally reads the drawn radius, rotation becomes a drawn condition, and the vestigial
   second band count dies so exactly ONE derived count (`uBandM`) drives everything.

Order of build: wires first (pure plumbing, headless-provable), then the per-storm scalar
substrate (streams + carriage, zero visual change), then the two visual mechanisms on top of
proven plumbing.

---

## 2. Slice S1 — RHINES + ROTATION WIRES, ONE BAND COUNT (AC-RHINES, AC-ROTDRAW, AC-ONECOUNT)

### 2.1 Radius wire (one-token-class, both call sites)

In `rebakeE5Bands()` AND `applyStormState()` (`world-engine-lab.html`), replace the drivers
assembly with a single-sourced helper so the two sites can never diverge again:

```js
// giant-drivers.js (new export; pure):
export function giantDriverScalars(planetRadiusEarth, rotationHours, e5RotationScale = 1) {
  return {
    rotationRate: (9.9 / (rotationHours ?? 24)) * e5RotationScale,   // Jupiter 9.9 h → 1.0
    radius: (planetRadiusEarth ?? 1) / 11.2,                          // Jupiter 11.2 RE → 1.0
  };
}
```

Call sites become `…giantDriverScalars(state.planetRadiusEarth, state.rotationHours ??
_fp.rotationHours, state.e5RotationScale)`. `state.planetRadiusEarth` is already the drawn
radius (set by `drawPresetRadius` at the `_radiusDirty` block; manual slider = the existing
driver override). NAMED_BODY presets keep canonical radius by `drawPresetRadius`'s own lock ⇒
their band field is unchanged ⇒ no golden contact anywhere (`resolveParams` is not edited; the
golden runs on the frozen `DRIVER_BUNDLES` path in the test, which passes no drivers).

### 2.2 Rotation draw (`drawPresetRotation` sibling; hot-Jupiter derived)

Pure machinery in `src/worldengine/base/giant-drivers.js` (atmo-owned; guard extension §0.5):

```js
export const ROTATION_RANGES_HOURS = Object.freeze({
  'gas-giant':   [8, 14],    // audit footnote 16
  'sub-neptune': [12, 20],   // Neptunian + Sub-Neptune (hazy) BOTH ride this key (V2-3 Option-B
                             // shared taxonomy — PRESET_ARCHETYPE maps 'Ice giant (Neptunian)'
                             // → 'sub-neptune'; there is NO 'ice-giant' key, and 'ice' belongs
                             // to solid bodies Frozen/Europa — lens fold F11: no 'ice' entry)
});
export function tidalLockRotationHours(orbitRadiusEarth, starMassEarth) {
  // Kepler: P = 2π√(a³/GM). a in Earth radii, M in Earth masses; returns hours.
  const a = orbitRadiusEarth * 6.371e6;                    // m
  const GM = 6.674e-11 * starMassEarth * 5.972e24;         // m³/s²
  return (2 * Math.PI * Math.sqrt((a * a * a) / GM)) / 3600;
}
// Lens fold F10 (blocker): the tidal-lock derivation is the HOT-JUPITER-CLASS identity ONLY —
// locked + h2-he atmosphere (the existing lab idiom, cf. thermalStrength's "locked + h2-he +
// retained" gate). A bare `if (locked)` first would send EVERY locked non-giant (Eyeball ~1 AU
// ⇒ ~8766 h, Lava ⇒ ~70 h, Europa, Magma) down the Kepler branch — a real F26 behavior change
// on solid presets, breaking the "zero behavior change off the giant path" claim AND the
// AC-OFFGATE solid-preset identity proof. NOTE (verified): 'Hot Jupiter (locked giant)' is
// ABSENT from PRESET_ARCHETYPE (15 mapped presets), so the identity CANNOT be archetype-keyed.
export function drawRotationHours({ archetype, canonicalHours, locked, hydrogenAtmo,
                                    orbitRadiusEarth, starMassEarth }, seed) {
  if (locked && hydrogenAtmo)                              // hot-Jupiter-class identity ONLY
    return tidalLockRotationHours(orbitRadiusEarth, starMassEarth); // DERIVED, not drawn
  const range = ROTATION_RANGES_HOURS[archetype];
  if (!range) return canonicalHours ?? 24;                 // no giant range ⇒ canonical, locked or not
  const r = alea('giantD:rot:' + archetype + ':' + (seed >>> 0))();
  return range[0] + r * (range[1] - range[0]);
}
```

Lab wrapper `drawPresetRotation(presetName, seed)` beside `drawPresetRadius`
(`world-engine-lab.html`): compute `isHotJupiterClass = _fp.tidalState?.locked &&
_fp.atmosphere?.composition === 'h2-he'`. NAMED_BODY and NOT hot-Jupiter-class → canonical
`_fp.rotationHours` (Europa, Magma, Venus stay canonical); the hot-Jupiter-class preset takes
the derivation branch even though it is NAMED (the contract's explicit ruling: "the preset
80 h pseudo-sync, derived instead of frozen"); every other preset routes through
`drawRotationHours({ archetype: PRESET_ARCHETYPE[presetName], hydrogenAtmo:
isHotJupiterClass-composition-test, … })`. Locked solids (Eyeball, Lava) fall through the
identity test AND the range lookup → canonical — provably unchanged. Drawn at the same
`_radiusDirty` site → `state.rotationHours` (one reroll = one body-identity redraw; disjoint
namespaces keep the radius stream byte-identical). Terrestrial/solid presets: canonical →
**zero behavior change off the giant path** (now actually true — lens fold F10).

**Known consequence (BUILD-NOTES + morning report, not a bug):** the derived hot-Jupiter lock
period from the preset's deliberately non-orbit-consistent `orbitRadiusEarth 150000` is
≈1.42×10⁵ h (a = 6.39 AU, M = 1 M_sun ⇒ P ≈ 16.1 yr; the earlier ~2.25×10⁴ h figure omitted
the 2π — lens folds F5/F14) — `rotationRate ≈ 7.0e-5` ⇒ `rhinesWavenumber` floors at
`M_MIN = 2`, which is exactly the AC-RHINES collapse prediction. The honest derivation, as
ruled. The §2.4 test asserts IDENTITY to `tidalLockRotationHours(150000, 332946)`, never a
magnitude.

Consumer wiring: the `_rotH` local in `applyDrivers` (feeds `state.jetSpeed`,
`state.weatherCells`) becomes `state.rotationHours ?? _fp.rotationHours ?? 24` — giants get
the drawn spin in F25 drift speed too; terrestrial identical (canonical). Document all
consumers in BUILD-NOTES (AC-0 check-2). **Known consumer NOT wired (lens fold F13, deferred
like the dynamo gate):** `body-condition-vector.js` carries D8 spin as `fp.rotationHours ?? 24`
(V2-4 C5 — the E2-figure/oblateness ω source) and all `deriveConditionVector` call sites pass
`_fp` — so a drawn 8 h Jovian keeps the canonical 9.9 h figure ω. Deliberately NOT wired this
increment (blast radius: bodyFigure/oblateness + possible golden contact, outside this
contract's AC set); recorded in §9 adjudicable + morning report + the BUILD-NOTES consumer
table as a documented divergence with a named owner.

### 2.3 Retire `uBandCount` (festoon gate derives from `uBandM`)

- GLSL: delete `uniform float uBandCount;`; in `jetU`, `jetShearGate`, `jetsDisp` substitute
  `uBandM` for `uBandCount` (same ladder shape — §0.2 shows the count conventions agree).
  Comment each site: "consumer of uBandM (Rhines m) — the single band count (AC-ONECOUNT)".
  ALSO reword the historical comment near the `bandVal` assembly ("The old 0.25·latC·uBandCount
  stripe ladder is removed…") to drop the literal token (e.g. "the old stripe ladder off the
  retired second band count is removed") — otherwise the whole-file absence grep fails on a
  comment (lens folds F4/F16-grep); note the reword in BUILD-NOTES.
- `planet-lod-uniforms.js`: delete the `uBandCount` entry.
- Lab: delete `state.bandCount`, its derivation block, its GUI row
  (`fBands.add(state,'bandCount',…)`), and the per-frame `uniforms.uBandCount.value` line.
  (`state.e5BandCount` — the writer diagnostic probe — stays.)
- Router safety: `uBandM` is already declared in `HEIGHT_GLSL`, so `HEIGHT_FRAG`
  (`planet-lod-rivers.js`, not edited) keeps compiling; removing a decl together with all its
  reads is link-safe.

### 2.4 S1 tests (new file `tests/worldengine-atmo-deck-spiral-rhines.test.js`)

- **AC-RHINES population sweep (headless):** gas leg: grid R∈[6,14] × rot∈[8,14] h through
  `giantDriverScalars` → `resolveParams(E5_REGIME.GAS_GIANT, {…}, seed)` — assert m tracks
  `√(radius·rotationRate)` monotonically (fixed uPeak), max m ≥ 15 at (14 RE, 8 h)-class
  corners across seeds. Ice-giant leg (lens fold F12): the m ≈ 3-class prediction holds ONLY
  under the NEPTUNIAN regime bundle — `resolveParams(E5_REGIME.NEPTUNIAN, …)` (internalHeat
  2.60 / dissipation 0.15 ⇒ uPeak ≈ 7.70, the Neptune-wind-paradox driver; the lab routes the
  Neptunian preset to `E5_REGIME.NEPTUNIAN`): at (2.5–4 RE via the `sub-neptune` range alone —
  there is no 'ice' rotation range, F11 — 12–20 h) assert m ≈ 3-class. The same (R, rot)
  corner under GAS_GIANT gives m ≈ 5–7 — do NOT assert 3 there. Population span ≥ ×2;
  hot-Jupiter (locked+h2-he derivation) ⇒ m == `M_MIN` (2).
- **AC-ROTDRAW:** `drawRotationHours` ranges honored per archetype over many seeds;
  determinism (same seed ⇒ same hours); hot-Jupiter-class branch ≡ `tidalLockRotationHours(
  150000, 332946)` exactly (identity, not magnitude); **locked SOLIDS canonical** (Eyeball,
  Lava, Europa, Magma, Frozen inputs all return `canonicalHours` — the F10 regression net);
  alea-only (source grep: no `Math.random`/`mulberry32` in the new code).
- **AC-ONECOUNT greps (lab + GLSL source-text, the storm-e SRC-matchAll house pattern),
  COMMENT-STRIPPED (the K_CODE/I_CODE house pattern — lens folds F4/F16-grep; belt-and-braces
  with the §2.3 comment reword):** `uBandCount` absent from `planet-lod-height.glsl.js`,
  `planet-lod-uniforms.js`, `world-engine-lab.html`; `jetsDisp`/`jetU`/`jetShearGate` bodies
  contain `uBandM`; both lab driver-assembly call sites contain
  `giantDriverScalars(state.planetRadiusEarth`.
- **Guard extension (exact non-weakening shape — lens fold F6; builder does NOT improvise):**
  in `worldengine-base-giant-drivers.test.js` `[namespaced entropy]`, (i) the whole-module
  loop widens each per-call assertion to `expect(m[1]).toMatch(/giantD:(cond|rot):/)`; (ii) a
  NEW assertion slices the condition-vector draw path (from the `drawGiantConditions`
  function-body anchor) and asserts every alea arg in THAT slice still contains
  `'giantD:cond:'`; (iii) a NEW assertion slices `drawRotationHours` and asserts its alea
  args contain `'giantD:rot:'`. (ii) preserves the original per-call cond pin at full
  strength on the existing path — a cond-stream call renamed `rot:` fails (ii). Recorded in
  BUILD-NOTES as an intent-preserving guard extension.
- Gate: fast fence + full suite (SET not grown). Goldens trivially safe (no writer edits).

---

## 3. Slice S2 — PER-STORM SCALAR SUBSTRATE (streams + carriage; zero visual change)

### 3.1 Appended streams in `resolveStormE` (`storm-e.js`)

After the existing vortex list is FINALIZED (primary + train assembled, pole already drawn —
i.e., after the last existing `rngPlace`/`rngAge`/`rngPhase` consumption), run a post-pass:

```js
const rngEmboss = alea('stormE:emboss:' + regime + ':' + id);
const rngBillow = alea('stormE:billow:' + regime + ':' + id);
for (const v of allVortices) {           // deterministic creation order
  v.embossDir  = rngEmboss() * 2 * Math.PI;   // place-once shading direction (footnote 17)
  v.billowPhase = rngBillow() * 2 * Math.PI;  // KH scallop azimuth phase (footnote 19)
}
```

Zero draws inserted into the four existing streams ⇒ `GOLDEN_STORM_MASK_HASH`, phase bank, and
every existing consumer byte-identical **by construction** (the existing golden/phase tests are
the proof). The SRC alea-guard passes (`stormE:` prefix). Draw-order comment updated to name
SIX namespaces with the append-only rule restated.

**deckZ is DERIVED, not drawn** (physics: the deck a storm occupies is what the storm IS):
mode 0 (warm anticyclone) ⇒ tower, `deckZ = mix(STORM_DECK.ZONE, STORM_DECK.TOWER,
prominence)` (= mix(0.7, 0.9, ·); table export §4.1, F16-consts) with
`prominence = 0.35 + 0.65·ageScalar` (older = redder = higher — shares the chromophore age
driver); mode 1 (dark spot) ⇒ reveal, `deckZ = STORM_DECK.FLOOR` (0.0 — the hole shows the
deep floor). Recorded
as a design refinement of designDecision-8's "`stormE:deck` stream" example: the deck VALUE is
condition-derived (stronger AC-0 driver-connectivity), the stochastic per-storm scalars
(emboss/billow) are the alea draws. Adjudicable, logged in Build deviations.

### 3.2 Carriage (`world-engine-lab.html` + `planet-lod-uniforms.js` + `HEIGHT_GLSL`)

- `applyStormState()` stashes: `state.spotAge/spotEmboss/spotBillow` (from
  `_p.ageScalar/embossDir/billowPhase`) and extends the `trainSpots` map with
  `{ age: v.ageScalar, embossDir: v.embossDir, billowPhase: v.billowPhase, mode: v.mode }`.
- Per-frame F27/F28 carriage block fills ONE new uniform array
  `uStormAux[8]` (vec4: **x ageScalar, y embossDir, z deckZ, w billowPhase**), computing
  deckZ from mode+age per §3.1 (via the `STORM_DECK` table, §4.1); AND passes the true
  `s.mode` where the train slots currently hard-code `0` in `uStormParams[…].z`
  (consumer-safe: §0.4 — only the slot-0 GRS wake gate reads z today).
  **Slot-sync rule (lens fold F2, blocker-class desync):** the composition loop runs behind
  TWO independent gates (`state.greatSpotEnabled` writes slot 0; `state.stormTrainEnabled`
  writes slots `_stormN`+). With greatSpot off, train members occupy slot 0+ — so
  `uStormAux[i]` MUST be written **inside the exact same two gated blocks, at the exact same
  `_stormN` index**, as `uStormPosSize/uStormParams/uStormColor`: the slot-0 write inside the
  `greatSpotEnabled` block, the train writes inside the `stormTrainEnabled` loop. A naive
  `aux[0]=primary / aux[1..]=train` fill desynchronizes aux from the other arrays whenever
  greatSpot is unchecked, making S3 deck/emboss/prominence and S4 wrap read another storm's
  scalars under an existing GUI toggle.
- `planet-lod-uniforms.js`: `uStormAux: { value: Array.from({length:8}, () => new
  THREE.Vector4()) }`.
- `uniform vec4 uStormAux[8];` declared **inside `HEIGHT_GLSL`'s storm section**
  (`planet-lod-height.glsl.js`) — the router-material rule from the atmo-expression lens log
  (`HEIGHT_FRAG = HEIGHT_GLSL + ROUTER_MAIN` compiles the whole function set; JS-only decls
  link-fail). An unread declared uniform is compile-safe, so S2 lands with zero render change.

### 3.3 S2 tests

- storm-e: same-(macroSeed,stormSeed) ⇒ identical `embossDir/billowPhase`; namespaces present;
  golden mask + phase bank + `[envelope]` + `#4/#5/#8` consumer tests GREEN (the draw-order
  fence, already in the suite — just run it).
- Increment test file: lab-source grep — `uStormAux` write appears in BOTH gated composition
  blocks (a `uStormAux.value[0]`-class write inside the `greatSpotEnabled` block AND a
  `uStormAux.value[_stormN]`-class write inside the `stormTrainEnabled` loop — the F2
  slot-sync assert); train slots pass `s.mode`; no `attribute` added (envelope guard also
  enforces).
- Gate: fast fence + full suite.

---

## 4. Slice S3 — DECK-Z COMPOSITOR (AC-DECK enablement; footnotes 17, 18, 21)

All edits inside `zonalBandCol` + `stormColTerms` (`planet-lod-height.glsl.js`); every new
term lives inside the `uStormCount > 0` gate or the per-storm loop ⇒ structural off-gate.

### 4.1 Deck table + composition order (footnote 21)

The five-row deck table `0.0 deep floor · 0.35 belts · 0.7 zones-mush · 0.9 mode-0 tower ·
1.0 haze-polar hood` is documented ONCE as the storm-section header COMMENT, with the rule:
same-deck = deflection (`dWake`/`dAdvect`/`dSpiral` — existing machinery), different-deck =
occlusion/reveal (this function). **Named-consumer discipline (lens fold F16-consts — no dead
consts):** the COMPUTATIONAL values live where they are consumed —
- `STORM_DECK = Object.freeze({ FLOOR: 0.0, BELT: 0.35, ZONE: 0.7, TOWER: 0.9, HAZE: 1.0 })`
  exported from `storm-e.js` (append-only, no alea — guard-safe), consumed by the carriage
  deckZ derivation (§3.1: mode 0 ⇒ `mix(STORM_DECK.ZONE, STORM_DECK.TOWER, prom)`, mode 1 ⇒
  `STORM_DECK.FLOOR`) — FLOOR/ZONE/TOWER have real consumers.
- GLSL declares ONLY `DECK_HAZE = 1.0`, consumed as the hood-exposure minuend (§4.1 below:
  `hoodExposure_i = 0.30·hood·(DECK_HAZE − deckZ_i)`).
- BELT's computational content IS the mode-1 `deepBase` belt-family derivation (§4.3) — named
  in the table comment, no bare const. No GLSL const is declared without a consumer.

`zonalBandCol` tail is reordered **inside the storm gate only**:

```
float hood = smoothstep(0.72, 0.95, abs(trueLat));
col *= 1.0 - 0.30 * hood;                                   // base deck gets the FULL hood (unchanged arithmetic)
if (uStormCount > 0) col = mix(col, stormColTerms(N, col, hood), provinceWeight(PROV_GREATSPOT));
if (uPolarStrength > 0.0) col = polarVortexCol(N, col);     // polar structure = DECK_HAZE, correctly last
```

Moving the hood multiply above the storm call changes NOTHING when `uStormCount == 0`
(scalar multiply, same value) — stormless output byte-identical. `stormColTerms` gains the
`hood` param so each storm can take hood exposure ∝ its own deck depth:
`hoodExposure_i = 0.30 · hood · (DECK_HAZE − deckZ_i)` — a GRS tower (0.9) pops above the
hood at high latitude; a mode-1 hole (0.0) dims fully with it.
**Reachability caveat (lens fold F16-hood; keep + document, exclude from probes):** for the
DRAWN population the mechanism is marginal — writer pole-avoidance `BELT_Y_MAX 0.75`
(|sin lat| ≤ 0.75 ⇒ center ≤ 0.848 rad, +0.06 mature poleward drift) with `SPOT_R_MIN 0.18 +
SPAN 0.12` (R ≤ 0.30 rad) puts the storm CORE's max normalized `trueLat` (×2/π convention,
GLSL anchor `asin(clamp(N.y,…)) * 0.63661977`) at ≈ 0.67 < 0.72 ⇒ **core hood is exactly 0
population-wide**; only the outer collar fringe of an extreme-corner storm (max lat, max R)
reaches hood ≈ 0.3. hoodExposure is kept as principled future-proofing for polar-storm
increments (one multiply; correct physics), these reachability numbers go in BUILD-NOTES,
and hood interaction stays OUT of the AC-DECK probe recipe (unfalsifiable live today).

### 4.2 Mode-0 earns height (footnote 17) — in the `stormColTerms` loop, `mo = uStormParams[i].z < 0.5` branch

Per-storm reads: `age = uStormAux[i].x`, `embossDir = uStormAux[i].y`,
`deckZ = uStormAux[i].z`, `prom = 0.35 + 0.65·age` (the same derivation the carriage used —
duplicated as a comment cross-ref, single source is the carriage value in `.z`).

- **Haze becomes deck-weighted:** the existing per-storm
  `stormCol = mix(uStormColor[i], luma, uHazeMute)` / `hazeAmp = 1.0 − uHazeMute` become
  `hazeX_i = uHazeMute · (1.0 − deckZ_i)` ⇒ `stormCol = mix(uStormColor[i], luma, hazeX_i)`,
  `hazeAmp = 1.0 − hazeX_i` — "haze mutes prop (1 − deckZ) of what's below". On every
  non-haze preset `uHazeMute == 0` ⇒ exact identity (the V-β.4 precedent).
- **Emboss rim (static, place-once):** rim annulus
  `rim = smoothstep(0.50·R, 0.72·R, d) · (1 − smoothstep(1.0·R, 1.18·R, d))`, azimuth
  `thv = atan(dn, de)`, asymmetry `asym = cos(thv − embossDir)`;
  `col *= 1.0 + EMB_K · prom · rim · asym · hazeAmp` (candidate `EMB_K = 0.18`). Luminance
  asymmetry across the per-storm shading axis = the AC-DECK probe. No `uTime`; direction is
  the `stormE:emboss` draw.
- **Cold annulus (recast collar):** the mode-0 collar's `×(1 + 0.22·collar·hazeAmp)` luminance
  lift is REPLACED by an observed cold ring — desaturate + blue-shift:
  `vec3 cold = mix(col, vec3(dot(col, LUMA)) · vec3(0.90, 0.99, 1.14), COLLAR_K · collar ·
  hazeAmp)` (candidate `COLLAR_K = 0.55`), same `collar` mask shape. Mode-1 keeps the existing
  collar unchanged.
- **Tower prominence ∝ age:** core paint weight `core·0.85` becomes
  `core · (0.60 + 0.30·prom)` (aged GRS ≈ today's 0.85+; young ovals sit lower), and the
  hood exposure uses `deckZ_i` (already prom-carrying via the carriage derivation).
  The V-α.3 interior detail and V-α.2 wake cone are untouched.

### 4.3 Mode-1 stops being paint (footnote 18) — `mo ≥ 0.5` branch

- **Deep-deck fill, luminance-donor form:** the interior stops mixing toward `uStormColor`'s
  HUE. Deep palette derived in-shader from the belt family:
  `vec3 deepBase = uBandTint · vec3(0.62, 0.52, 0.42) · vec3(0.72, 0.60, 0.52)` (beltCol
  darkened + warmed — "seeing 5 bar"). The CPU lifecycle (V-β.3 `coreScale` + age, already
  blended into `uStormColor` by `applyStormState`'s `_stormColor`) survives as the luminance
  donor: `vec3 deep = deepBase · min(dot(uStormColor[i], LUMA) / max(dot(deepBase, LUMA),
  1e-3), 1.5)` — value from the writer's lifecycle, hue from the deep deck, **donor ratio
  CLAMPED at 1.5** (lens fold F-deep: precursor-phase mode-1 spots blend `_stormColor` toward
  the bright deck via `coreScale 0`, driving the unclamped ratio well past 1; per-channel
  saturation would then desaturate toward white and leave the belt family — the AC-DECK hue
  probe would fail on YOUNG spots while passing on mature ones). Core mix targets `deep`.
  AC-DECK's probe ("interior within the belt-derived family, NOT uStormColor") reads exactly
  this — and the probe seed set MUST include a young (precursor-phase) mode-1 spot alongside
  a mature one.
- **Rim wisps (band-frequency, low weight):** in the rim annulus
  `wispBand = smoothstep(0.70·R, 0.95·R, d) · (1 − smoothstep(1.15·R, 1.35·R, d))`, thin
  streaks at the BAND frequency crossing the rim:
  `wisp = sin(uBandM · latHere + uBandPhaseJet + WISP_WARP · bandWarpField(n·4.3 + WISP_OFF))`
  sharpened `pow(abs(wisp), 6.0)`-style, applied `col = mix(col, zoneish-lift,
  WISP_K · wispBand · …)` at candidate `WISP_K = 0.10` — a clearing you look INTO, streaked by
  the deck above. Static (fresh `bandWarpField` sample; no `uTime`).
- Companion-cloud physics (V-α.5) untouched — already correct per the audit.

### 4.4 S3 tests + gates

- Diff-scoped static grep (added lines only): no `uTime|ph0|ph1|r0|r1` (AC-STATIC closer,
  house pattern).
- Source-structure asserts (increment test file): `stormColTerms` signature carries `hood`;
  `uStormAux` read inside the loop; deck consts present; `dAdvect` body hash/substring
  UNCHANGED (reuse the band-flow `[parity]` expectations — they already pin it).
- Gate: fast fence + full suite; solid-preset off-gate structural audit (every new line inside
  the loop/gate) written into BUILD-NOTES.
- Live AC-DECK pixel probes are the ORCHESTRATOR's (fresh `:5178` context, 45 s cold load);
  this slice ships the recipe: fixed seed with a mode-0 primary (Jovian) and mode-1 primaries
  at BOTH a mature AND a young/precursor lifecycle phase (Neptunian; the F-deep young-spot
  case), probe coordinates from `state.spotCenter`. Hood interaction is NOT probed
  (F16-hood reachability — unfalsifiable on the drawn population).

---

## 5. Slice S4 — dSPIRAL STATIC ROLL-UP (AC-SPIRAL enablement; footnote 19)

### 5.1 Mirror first (`band-flow.js` — numeric truth lives in the mirror, GLSL transcribes)

New frozen export (NOT added to `BAND_FLOW` — its `[candidates]` test deep-pins values):

```js
export const BAND_SPIRAL = Object.freeze({
  WRAP: 2.5,        // wrap count at ageScalar=1 (W = WRAP·age·sign(rot)) — Phase-A candidate
  EPS: 0.08,        // log(rr+EPS) core regularizer
  AMP: 0.30,        // tangential displacement amplitude × R × uAtmoInk — candidate
  ANN_IN: 0.45, ANN_PEAK: 0.80, ANN_OUT_LO: 1.35, ANN_OUT_HI: 2.0,  // collar annulus (core oval coherent)
  LAMBDA_KH: 0.15,  // billow wavelength × R ⇒ N_b = max(3, round(2π/0.15)) = 42 (R cancels — note!)
  SCAL: 0.35,       // scallop amplitude on the annulus
  LEAN: 0.6,        // downstream lean RATE of the lobes: rad of azimuthal crest shift per unit
                    // rr, signed by local flow (lens fold F15 — a CONSTANT phase would be
                    // degenerate with billowPhase, i.e. a silent no-op)
});
export function spiralDisplacement(dir, vortices, P, { ink = 1 } = {}) { … }  // → [dE, dN] per §5.2 math, summed
```

Mirror unit props (extend `tests/worldengine-atmo-deck-spiral-rhines.test.js`):
- zero vortices ⇒ exactly `[0,0]` (AC-OFFGATE); `rr < ANN_IN` ⇒ ~0 (core coherent);
- **wrap is measured RADIALLY, not on a ring (lens fold F9 — at fixed rr, ψ = thv + const, so
  any ring-sampled cycle count is 1 for every W: mathematically vacuous):** sample ψ (via the
  displacement-direction phase) at two radii rr₁, rr₂ on the same azimuth and assert
  `Δψ = W·(ln(rr₂+EPS) − ln(rr₁+EPS))`; assert THAT Δψ is ∝ ageScalar (monotone, ratio ≈
  WRAP·Δln). Ship the visible-winding prediction `wrap_visible = W·Δln(rr+EPS)/2π ≈ 0.218·W`
  across the ANN_IN→ANN_OUT_HI annulus (≈ 0.54 turns at WRAP 2.5, age 1) — this is what the
  live AC-SPIRAL read counts, NOT W itself;
- lobe count on the annulus == `max(3, round(2π/LAMBDA_KH))` == 42;
- **lobe-lean prop (F15):** the lobe-crest azimuth at `rr = ANN_OUT_LO` is shifted by
  `−flow·LEAN·(ANN_OUT_LO − ANN_PEAK)` relative to `rr = ANN_PEAK` (per-lobe phase shift ×NB)
  — the flow-sign dependence is observable, not laundered into the random phase;
- deterministic and `uTime`-free by construction; displacement magnitude ≤
  `AMP·R·(1+SCAL)·ink` (lens fold F-env: the scallop factor peaks at 1+SCAL = 1.35, so a bare
  `AMP·R` bound would FAIL a correct implementation).

### 5.2 GLSL term (`planet-lod-height.glsl.js`, sibling of `dWake`)

```glsl
vec3 dSpiralVec(vec3 Nraw){                       // world-tangent displacement; count-gated; uAtmoInk-scaled
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 8; i++){
    if (i >= uStormCount) break;                  // the dWake off-gate lever
    …east/north/de/dn/facing/R/aspect exactly the dWake frame…
    float rr  = length(vec2(de / uStormParams[i].y, dn)) / R;
    float thv = atan(dn, de);
    float W   = SPIRAL_WRAP * uStormAux[i].x * sign(uStormParams[i].x);     // wrap ∝ ageScalar·sign(rot)
    float psi = thv + W * log(rr + SPIRAL_EPS);
    float ann = smoothstep(SPIRAL_ANN_IN, SPIRAL_ANN_PEAK, rr) * (1.0 - smoothstep(SPIRAL_OUT_LO, SPIRAL_OUT_HI, rr));
    float latS = asin(clamp(uStormPosSize[i].y, -1.0, 1.0));
    float flow = sign(bandProxy(latS) - 0.5);                                // downstream sign (dWake idiom)
    float scal = 1.0 + SPIRAL_SCAL * sin(SPIRAL_NB * (thv - flow * SPIRAL_LEAN * (rr - SPIRAL_ANN_PEAK)) + uStormAux[i].w);  // KH scallop: crest azimuth tilts downstream WITH rr (F15 — rr-coupled lean, not a constant phase)
    float amp  = uAtmoInk * SPIRAL_AMP * R * ann * scal * facing;
    acc += (east * (-sin(psi)) + north * cos(psi)) * amp * sign(uStormParams[i].x);
  }
  return acc;
}
```

Constants transcribed from `BAND_SPIRAL` with a `[parity]`-style substring test (the
established dWake/dAdvect constant-parity pattern). The mirror `spiralDisplacement`
transcribes the SAME rr-coupled lean form (F15 — mirror and GLSL agree or the parity/prop
legs disagree).

**Naming constraint (lens fold F7 — dSpiralVec sits between `dWake` and the `// ── F24
zonalBandCol` banner, i.e. INSIDE the band-flow test's `I_BODIES` slice, whose `[F1]` grep
rejects `\b(ph0|ph1|r0|r1|jetRotY|jetsDisp)\b` and `uTime` comment-stripped):** no local in
`dSpiralVec` (or any new §5 code) may be named `ph0/ph1/r0/r1`, and it must not call
`jetRotY`/`jetsDisp` — a builder's natural `r0/r1` spiral-radius locals would trip an
EXISTING fence test with a confusing failure. The banned-identifier list also rides the
increment test's own diff-scoped static grep (§5.4). The I-slice `toContain` pins
(`'if (i >= uStormCount) break;'`, tangent-frame substring) remain satisfied — additive code
inside the slice cannot break a `toContain`.

### 5.3 Consumption in `zonalBandCol` (both channels; byte-exact off-gate)

```glsl
vec3 dSp   = dSpiralVec(Nraw);                                  // ≡ vec3(0) when uStormCount==0
vec3 NrawD = (uStormCount > 0) ? normalize(Nraw + dSp) : Nraw;  // meridional (dLat) channel ONLY — BRANCH, ulp-exact off-gate
vec3 posD  = (uStormCount > 0)
           ? normalize(pos / length(pos) + dSp) * length(pos)   // pigment domain: the RECEIVED pos (= swirled bandPos, storms-on) + spiral, house renormalize idiom (stormSwirl precedent)
           : pos;                                               // off-gate: LITERAL pos — bitwise (lens folds F1/F8, blocker)
```
**Why posD is derived from `pos`, branched (F1/F8 — both lenses converged on this defect):**
(a) storms-ON, the `pos` this function receives is the stormSwirl-ROTATED domain (§0.1
call-site fact) — rebuilding posD from the un-swirled `Nraw` would silently strip the
shipped F27 embedded-swirl from every pigment sample, a regression the plan never sanctioned;
(b) storms-OFF, `normalize(vPos)·length(vPos)` is NOT bitwise `vPos` (normalize+rescale
rounding), so an unbranched posD flips posterize/dither pixels and fails AC-OFFGATE byte
identity — exactly the §9 hard stop. The branch takes literal `pos` off-gate; the
normalize-compose form (over F8's additive `pos + dSp·length(pos)` alternative, equivalent
for the fences) is chosen for the house domain idiom — samples stay on the `length(pos)`
shell like `bandPos = bandN·length(vPos)`.

- **(b) 2D domain offset of the pigment samples:** the primary warp `r` uses `posD` in BOTH
  branches (`bandWarpField(posD)` jets-off; `bandWarpField(jetRotY(posD, …))` jets-on) and
  the filament `fila` uses `posD` in place of `pos`. The slice-J **jag sample KEEPS
  un-displaced `pos`** (lens fold F3: its literal `pos * 7.0` is pinned by the band-flow
  slice-J `[parity]` test; retargeting the pin would be an undeclared fence-test edit
  violating AC-FENCE's "diff empty on tests/". The jag adds to the dLat-deflected `bandVal`,
  so band-edge serration still winds with the band — adjudicable, §9). (`dAdvect`'s INTERNAL
  samples keep `Nraw` — the LIKED layer is not edited.)
- **(a) meridional component into `dLat` BEFORE `bandProxy`:**
  `float dLat = dAdvect(Nraw, wShear, wBand, wStorm) + dWake(Nraw) + (asin(clamp(NrawD.y,-1.,1.)) - latRaw);`
  — the new term is APPENDED AFTER `dWake(Nraw)` so the band-flow `[wire]` pin
  `'dAdvect(Nraw, wShear, wBand, wStorm) + dWake(Nraw)'` stays a contained substring (no
  fence contact). Off-gate this term is EXACTLY zero: `latRaw` is literally
  `asin(clamp(Nraw.y, -1.0, 1.0))` (verified GLSL anchor) and `NrawD ≡ Nraw` by the branch.
  The band genuinely winds in; entrainment (arms carrying band color) falls out of the proxy
  re-sample + displaced pigment for free.

Off-gate: `uStormCount == 0` ⇒ `dSp = 0`, `NrawD = Nraw` (branch), `posD = pos` (branch,
literal) ⇒ every sample identical ⇒ stormless render byte-identical (AC-OFFGATE, structural).

### 5.4 S4 tests + calibration

- Mirror props (§5.1) + GLSL↔mirror constant-parity substrings + diff-scoped static grep
  (banned identifiers per §5.2, `uTime`).
- Phase-A candidate sweep: a small `tools/deck-spiral-calibrate.mjs` (pattern:
  `tools/atmo-expression-calibrate.mjs`; writes NO source) prints, over
  Jovian/Saturnian/Neptunian seeds: (i) `wrap_visible = W·Δln(rr+EPS)/2π` distributions (F9 —
  so WRAP is set against the intended ON-SCREEN turn count, not the vacuous ring read);
  (ii) amplitude distributions; (iii) **the combined `|dWake + dSpiral|` meridional envelope
  vs the band half-period `π/uBandM` across the population (lens fold F17):** the dSpiral
  meridional term (annulus 0.45–2.0R) overlaps dWake's bow (0–1.6R, wavenumber-1) and where
  β = W·ln(rr+EPS) ≈ ±π/2 they constructively interfere age-dependently — the report flags
  any population corner (esp. the m≈15 gas corner) where the combined |dLat| exceeds
  π/uBandM (band-jump aliasing in the wrap read). Candidates adjusted Phase-A if flagged.
  The Phase-B LIVE read-gate (amplitude freeze) belongs to the orchestrating session's
  browser pass — record candidates as CANDIDATES in comments, the atmo-expression precedent.
- Gate: fast fence + full suite; SET not grown.

---

## 6. New fields inventory (ALL additive; zero new baked attributes; zero new GUI controls)

| Field | Kind | Value / deriver | Consumer | AC-0 note |
|---|---|---|---|---|
| `uStormAux[8]` | uniform vec4 (decl in `HEIGHT_GLSL`) | x=`ageScalar` (existing `stormE:age`-derived vortex field), y=`embossDir` (`stormE:emboss`), z=`deckZ` (derived: mode+age via `STORM_DECK`, §3.1/§4.1), w=`billowPhase` (`stormE:billow`) | `stormColTerms` (emboss/annulus/prominence/deep-fill), `dSpiralVec` | append-only streams; written INSIDE both gated composition blocks at `_stormN` (F2 slot-sync); consumers documented in BUILD-NOTES |
| `stormE:emboss` / `stormE:billow` | alea streams (`storm-e.js`) | post-pass over finalized vortices | `uStormAux.y/.w` | appended AFTER `stormE:{place,age,phase,polar}`; golden/phase tests prove non-disturbance |
| `giantD:rot:` | alea stream (`giant-drivers.js`) | `drawRotationHours` | `state.rotationHours` → both `resolveParams` call sites + `_rotH` consumers | guard extended per F6 non-weakening shape (§2.4: widened loop + cond-path slice re-pin + rot-path slice pin) |
| `STORM_DECK` | frozen export (`storm-e.js`, no alea) | deck table FLOOR/BELT/ZONE/TOWER/HAZE (§4.1) | carriage deckZ derivation (FLOOR/ZONE/TOWER); GLSL `DECK_HAZE` hoodExposure minuend | F16-consts: every declared const has a named consumer; BELT documented as the deepBase deriver |
| `giantDriverScalars` | pure export (`giant-drivers.js`) | radius/rotation normalization, single-sourced | `rebakeE5Bands` + `applyStormState` | kills the two-site divergence class |
| `BAND_SPIRAL` + `spiralDisplacement` | frozen export + mirror (`band-flow.js`) | §5.1 | GLSL `dSpiralVec` parity + headless ACs | separate export — `BAND_FLOW` pins untouched |
| `state.rotationHours` | lab state | `drawPresetRotation` at the `_radiusDirty` block | driver assembly + `_rotH` | driven value; the existing `e5RotationScale` slider remains the manual override dial — NO new control, NO `*Enabled` key |
| DELETED: `uBandCount` (uniform+decl+state+GUI row) | — | — | replaced by `uBandM` in `jetU`/`jetShearGate`/`jetsDisp` | AC-ONECOUNT |

`GOLDEN_BANDFIELD_HASH` proof: `climate-e5.js` not edited; golden runs the frozen-bundle path.
`GOLDEN_STORM_MASK_HASH` + phase bank proof: zero draws inserted into the four existing
streams; mask/pole writers untouched. `[envelope]`: no new attribute, no `uStormMask` name.
Drift guards: no `*Enabled` key, no new checkbox, no new FEATURES/PROVINCES row (all terms
ride `PROV_GREATSPOT`/`PROV_BANDS` weights already in place).

---

## 7. Slice decomposition summary (each independently buildable + testable + committable)

| Slice | Ships | Fence surface | Closes (code-side) |
|---|---|---|---|
| **S1 wires** | radius wire ×2 via `giantDriverScalars`; `drawRotationHours` (hot-Jupiter-class = locked+h2-he derivation ONLY; locked solids canonical — F10) /`tidalLockRotationHours`/`ROTATION_RANGES_HOURS` (gas-giant + sub-neptune only — F11) + lab `drawPresetRotation` + `state.rotationHours`; `uBandCount` retired → `uBandM` (+ historical-comment reword — F4) | `giant-drivers.js` (+ F6-shaped guard extension), `world-engine-lab.html` (driver assembly, `_radiusDirty`, `_rotH`, GUI row removal, per-frame line), `planet-lod-uniforms.js`, `planet-lod-height.glsl.js` (jets ladder) | AC-RHINES (NEPTUNIAN-pinned ice leg — F12), AC-ROTDRAW, AC-ONECOUNT, AC-0(1) |
| **S2 substrate** | `stormE:emboss`/`stormE:billow` post-pass + `STORM_DECK` frozen export (F16-consts); `uStormAux[8]` carriage (F2 slot-sync: written inside BOTH gated `_stormN` blocks) + decl; train `s.mode` pass-through | `storm-e.js`, lab carriage, `planet-lod-uniforms.js`, `HEIGHT_GLSL` decl | AC-FENCE re-proof, AC-0(2/3) groundwork |
| **S3 deckZ** | hood reorder + `stormColTerms(…, hood)`; deck-weighted haze + `DECK_HAZE`-minuend hoodExposure (F16-hood: documented-marginal, unprobed); mode-0 emboss + cold annulus + prominence; mode-1 deep-deck fill (donor ratio clamped 1.5 — F-deep) + rim wisps | `planet-lod-height.glsl.js` (storm section only) | AC-DECK enablement, AC-OFFGATE (structural), AC-STATIC |
| **S4 dSpiral** | `BAND_SPIRAL` (rr-coupled LEAN — F15) + `spiralDisplacement` mirror (radial-Δψ wrap props — F9; envelope ×(1+SCAL) — F-env); `dSpiralVec` (I_BODIES naming constraint — F7) + dual consumption via BRANCHED `NrawD`/`posD` from the received `pos` (F1/F8; jag sample excluded — F3); calibrate script (wrap_visible + superposition envelope — F9/F17) | `band-flow.js`, `planet-lod-height.glsl.js` (`zonalBandCol` head), `tools/` | AC-SPIRAL enablement, AC-OFFGATE, AC-STATIC |

Order rationale: S1 is pure plumbing with fully-headless ACs and changes gas visuals in the
intended, population-level way — landing it first makes every later live probe already see
honest band counts. S2 is a zero-visual substrate whose fence (mask golden + draw order) is
the scariest in the increment — proving it in isolation means S3/S4 diffs can never be
confused with a stream regression. S3 and S4 are independent consumers of S2; deck (S3) goes
before spiral (S4) because AC-DECK's probes don't depend on dSpiral, while AC-SPIRAL's ring
read is easier to interpret once the deck compositing is final. Re-scope gate: any slice
ballooning past a coherent unit (e.g., the deep-fill luminance-donor form fails the palette
probe and demands a new CPU scalar) → stop, record, split — do not grow silently.

Per-slice landing = explicit-path commit + BUILD-NOTES.md append (function/intent/non-goals
per `feedback_record-build-intent`) + gate bundle from the worktree dir.

---

## 8. AC map — every contract AC → its concrete closer

| AC | Layer | Closed by |
|---|---|---|
| **AC-0** | unit + artifact | Suites green (`planet-archetypes` checkbox guard; giant-drivers guard extended, existing asserts intact); greps: no label/archetype-string reads in new GLSL/draw code (rotation keys on `PRESET_ARCHETYPE` tags — the sanctioned single-source map, same as radius); `uBandCount` gone; BUILD-NOTES consumer table (§6) names every new field's deriver + DAG consumer — the verify-workstream AC-0 audit artifact |
| **AC-FENCE** | unit | Full fence bundle at EVERY slice seam: climate-e5 golden `-1329854088` + emission-e re-assert; storm-e golden `568852786` + phase bank + alea guard + `[envelope]` + #4/#5/#8 consumer tests; `v2-0-byte-identity` 75 goldens; no fixture re-capture (git diff empty on `tests/`+fixtures except stated new/extended files) |
| **AC-OFFGATE** | unit | Structural: every new render term inside `uStormCount>0` / per-storm loop; BOTH `NrawD` AND `posD` branch to their literal inputs off-gate (§5.3 — F1/F8; unconditional normalize on either breaks bitwise identity) ⇒ bitwise sample identity; mirror test `spiralDisplacement([], …) == [0,0]`; hood-reorder identity argument (§4.1) recorded in BUILD-NOTES. **Caveat documented for the verifier:** S1 deliberately changes STORMLESS GAS output (honest band count from drawn R/rot) — the off-gate identity is proven on solid presets (full) and on gas with radius+rotation pinned canonical (radius slider = preset value; NAMED_BODY canonical rotation), NOT on free-drawn gas seeds |
| **AC-STATIC** | unit | DIFF-scoped grep on added lines (`uTime|ph0|ph1|r0|r1` zero hits — whole-file false-trips on legacy F25, house rule); mirror determinism tests (same inputs ⇒ byte-equal); all per-storm scalars traced to `stormE:*`/`giantD:rot:` streams (source grep: no `Math.random`/`Date.now`/`mulberry32` in new code) |
| **AC-RHINES** | unit | §2.4 population sweep: drawn (R, rot) grids per archetype through `giantDriverScalars`→`resolveParams`; span ≥×2 with gas corner ~15–16, ice corner ~3; hot-Jupiter == `M_MIN` (2) via the locked derivation |
| **AC-ROTDRAW** | unit | §2.4 `drawRotationHours` tests: ranges, determinism, hot-Jupiter-class (locked+h2-he) ≡ `tidalLockRotationHours(orbitRadiusEarth, starMassEarth)` identity, **locked SOLIDS canonical** (F10 regression net: Eyeball/Lava/Europa/Magma), NAMED_BODY canonical via the lab wrapper (source grep + unit on the module fn), alea-only |
| **AC-ONECOUNT** | unit | §2.4 greps: `uBandCount` absent everywhere; `jetU`/`jetShearGate`/`jetsDisp` read `uBandM`; festoon window therefore tracks `uBandM` by construction (source-level assert; visual confirmation rides AC-POP live) |
| **AC-DECK** | integration (live) | ORCHESTRATOR closes on `:5178` (this build ships enablement + recipe §4.4): mode-0 emboss luminance asymmetry across `embossDir`, desaturated/blue-shifted collar; mode-1 interior within the belt-derived family (hue distance to `deepBase` << to `uStormColor` hue) on BOTH mature AND young/precursor spots (F-deep), rim wisps at band frequency; hood interaction NOT probed (F16-hood, unreachable on the drawn population); evidence → `evidence/` |
| **AC-SPIRAL** | integration (live) | ORCHESTRATOR: **radial-transect** read around an aged storm (F9 — a fixed-rr ring shows one cycle for every W and measures nothing): sample band latitude along a radial transect over rr ∈ [1.05, 2.0] (F17 — outside stormSwirl's ≤1R support and dWake's bow core, so the age signal is attributable) — visible winding matches `wrap_visible = W·Δln(rr+EPS)/2π` (≈0.54 turns at WRAP 2.5, age 1) and is ∝ ageScalar across two ages; lobe count == 42-formula; entrained band color in the arms; recipe + probe coordinates shipped in BUILD-NOTES. (Contract wording says "along a ring" — the radial read is the faithful closer of its intent; adjudicable, §9.) |
| **AC-POP** | integration (live) | ORCHESTRATOR: re-roll contact sheet across drawn giants; ×2+ band-count spread (S1 makes it true headlessly first — the sweep numbers go in the UAT recipe) |
| **AC-ADVECT-REGRESS** | integration (live) | ORCHESTRATOR: stormless-seed screenshot diff **with radius+rotation pinned canonical** (the §AC-OFFGATE caveat — otherwise the diff shows the intended S1 band-count honesty, not a dAdvect breach); `dAdvect` source-identity additionally proven headless by the band-flow `[parity]` pins |
| **AC-UAT** | uat | Max alone, `:5178`, re-rolling giants; `deferred-to-max` — never agent-passed |

---

## 9. Deviation triggers

**HARD STOPS (any one ⇒ STOP, do not commit, re-scope / ABORT per charter):**
- Either golden hash moves, any fixture re-captured, or the aStorm mask contract / phase bank
  / existing `stormE:{place,age,phase,polar}` draw order changes (a draw INSERTED into an
  existing stream — the post-pass append is the only sanctioned shape).
- Any `uTime`/`ph0`/`ph1`/`r0`/`r1` in a NEW/edited term (diff-scoped).
- Any edit to `dAdvect`'s body, or any relief/dispatch/bombardment file, or
  `climate-e5.js`, or a second baked attribute, or a `*Enabled` key, or any new GUI control.
- `NrawD`/`posD` wired WITHOUT the `uStormCount` branch (silently breaks bitwise off-gate).
- The giant-drivers guard extension cannot be written without weakening an existing assertion.

**ADJUDICABLE (proceed; record in Build deviations + BUILD-NOTES; surface to Max at UAT):**
- All candidate magnitudes (`EMB_K`, `COLLAR_K`, `WISP_K`, `BAND_SPIRAL.*`) — Phase-A measured,
  Phase-B live freeze belongs to the orchestrating session.
- deckZ derived-not-drawn (§3.1) vs the designDecision's `stormE:deck` stream example.
- `N_b == 42` is R-invariant because λ_KH ∝ R cancels — if the live read is too busy, λ_KH
  becomes a per-storm draw (billow stream already exists to carry it).
- The hot-Jupiter derived period ≈ 1.42×10⁵ h (preset orbit is deliberately non-orbit-
  consistent; figure corrected per lens folds F5/F14 — the earlier 2.25×10⁴ omitted 2π) —
  physics-honest, visually collapses to M_MIN as predicted.
- The slice-J jag sample keeps un-displaced `pos` (F3): its literal is fence-pinned, and the
  jag rides the dLat-deflected bandVal so edges still wind. Alternative (declared retarget of
  the band-flow slice-J pin to `posD * 7.0`) REJECTED to keep AC-FENCE's "diff empty on
  tests/" clean.
- AC-SPIRAL's live recipe reads a RADIAL transect + `wrap_visible`, not the contract
  statement's literal "along a ring" (F9 — the ring read is measurement-vacuous; the radial
  read closes the AC's intent, wrap ∝ ageScalar). Surface to Max at UAT.
- Figure-ω divergence (F13): `body-condition-vector.js` D8 spin stays `fp.rotationHours` —
  drawn giants' oblateness keeps the canonical figure ω this increment. Deferred consumer
  with a named owner (mirrors the dynamo-gate deferral); morning report + BUILD-NOTES.
- Train-slot `s.mode` pass-through (honesty fix; single existing consumer verified safe).
- `_rotH` consumers (`jetSpeed`, `weatherCells`) reading the drawn rotation.
- Mode-1 luminance-donor form for lifecycle preservation (vs adding a coreScale uniform slot).
- Cloud-regime + giant-dynamo gates still read `_fp.radiusEarth` (session-verified adjacent
  gap) — OUT of this contract's scope; flag in the morning report, do not wire.

---

## 10. Lens log

### Fold 1 — adversarial lens pass (bytes-fence / fluid-mechanism / population-wiring), folded 2026-07-19 (overnight)

Every disposition re-verified against source anchors this session before folding (files:
`world-engine-lab.html`, `planet-lod-height.glsl.js`, `driver-presets.js`,
`body-condition-vector.js`, `src/worldengine/base/climate-e5.js`, `src/worldengine/base/storm-e.js`,
`tests/worldengine-base-band-flow.test.js`, `tests/worldengine-base-giant-drivers.test.js`,
`src/core/ScaleConstants.js`). 17 findings; 15 accepted (3 with modification), 0 rejected
outright, 2 pairs merged (same defect, two lenses). IDs Fn refer to lens-fold tags cited
inline in the sections.

| # | Finding (lens · section) | Disposition | Fold |
|---|---|---|---|
| F1+F8 | BLOCKER ×2 (bytes-fence + fluid-mechanism · §5.3): `posD = NrawD·length(pos)` breaks off-gate byte identity AND strips stormSwirl from pigment samples | **ACCEPTED (merged).** Verified: lab call site passes `bandPos = vPos` off-gate, `stormSwirl(normalize(vPos))·length(vPos)` storms-on; `latRaw = asin(clamp(Nraw.y,…))` confirmed at its GLSL anchor. Adopted F1's normalize-compose branch form over F8's additive alternative (house idiom: samples stay on the length(pos) shell, stormSwirl precedent); equivalent w.r.t. both fences since the branch takes LITERAL `pos` off-gate. `NrawD` retained for the meridional channel only (exactly-zero off-gate). | §0.1 (call-site fact), §5.3 (rewrite), §8 AC-OFFGATE |
| F2 | major (bytes-fence · §3.2): uStormAux fill desyncs from the two-gated `_stormN` composition | **ACCEPTED.** Verified at lab `_stormN` block (greatSpotEnabled slot-0 / stormTrainEnabled loop): with greatSpot off, train occupies slot 0+. Slot-sync rule + both-blocks lab-source grep added. | §3.2, §3.3, §6 |
| F3 | major (bytes-fence · §5.3b vs §8): displacing the jag sample breaks the pinned `'pos * 7.0'` (band-flow slice-J [parity]) | **ACCEPTED with modification.** Verified pin. Took option A for jag (keeps un-displaced `pos`; pin untouched; jag rides dLat-deflected bandVal so edges still wind) but KEPT `fila` displaced — verified `3.7` is pinned in NO test, and filaments are a visible entrainment channel. Adjudicable recorded. | §0.1, §5.3(b), §9 |
| F4+F-grep | minor ×2 (bytes-fence + population-wiring · §2.3/§2.4): whole-file `uBandCount` absence grep trips on the historical comment near the bandVal assembly | **ACCEPTED (merged).** Verified comment (contains the literal token). Both belts: reword the comment in S1 AND run the grep comment-stripped (K_CODE/I_CODE house pattern). | §2.3, §2.4 |
| F5+F14 | minor ×2 (bytes-fence + population-wiring · §2.2/§9): hot-Jupiter derived period figure omits 2π (~2.25×10⁴ → ≈1.42×10⁵ h) | **ACCEPTED (merged).** Recomputed: a=9.556e11 m, GM=1.327e20 ⇒ P≈5.10e8 s ≈ 1.42×10⁵ h; rotationRate ≈ 7.0e-5; M_MIN collapse conclusion unchanged. Figure corrected everywhere; §2.4 test stays an IDENTITY assert. | §2.2, §9 |
| F6 | minor (bytes-fence · §0.5/§2.4): bare guard-widen to `giantD:(cond|rot):` weakens the per-call cond pin | **ACCEPTED.** Verified guard shape (per-call `toContain('giantD:cond:')`). Exact non-weakening three-part shape specified (widened loop + cond-path slice re-pin + rot-path slice pin); bare widen explicitly rejected. | §0.5, §2.4 |
| F7 | minor (bytes-fence · §5.2): dSpiralVec lands inside band-flow `I_BODIES` slice whose [F1] grep bans `ph0/ph1/r0/r1/jetRotY/jetsDisp` | **ACCEPTED.** Verified `I_BODIES = dWake → '// ── F24 zonalBandCol'` + the not.toMatch. Banned-identifier naming constraint added to §5.2 + the diff-scoped grep; noted additive code can't break the slice's toContain pins. | §5.2, §5.4 |
| F9 | major (fluid-mechanism · §5.1/§8): ring-sampling ψ at fixed rr is measurement-vacuous (ψ = thv + const ⇒ one cycle for every W); wrap manifests RADIALLY | **ACCEPTED.** Math verified (incl. wrap_visible = W·Δln(rr+EPS)/2π ≈ 0.218·W over the annulus ⇒ ≈0.54 turns at WRAP 2.5). Mirror props switched to two-radius Δψ = W·Δln; live recipe switched to radial transect; calibrate reports wrap_visible. Contract's "along a ring" wording noted as adjudicable (radial read closes its intent). | §5.1, §5.4, §8 AC-SPIRAL, §9 |
| F15 | major (fluid-mechanism · §5.2): `− flow·LEAN` as a constant phase is degenerate with billowPhase — the contracted "lobes leaned downstream" is a silent no-op | **ACCEPTED.** rr-coupled lean form adopted in GLSL AND mirror (`SPIRAL_NB·(thv − flow·SPIRAL_LEAN·(rr − SPIRAL_ANN_PEAK)) + billowPhase`); LEAN redefined as lean RATE (rad azimuth per unit rr); lobe-lean mirror prop added. | §5.1, §5.2 |
| F-env | minor (fluid-mechanism · §5.1): `≤ AMP·R` envelope prop fails a correct implementation (scallop peaks at 1+SCAL) | **ACCEPTED.** Bound corrected to `AMP·R·(1+SCAL)·ink`. | §5.1 |
| F17 | minor (fluid-mechanism · §5/§9): no dWake+dSpiral superposition analysis; stormSwirl pollutes age attribution inside 1R | **ACCEPTED.** Calibrate reports combined meridional envelope vs π/uBandM across the population; AC-SPIRAL transect placed at rr ∈ [1.05, 2.0] (outside stormSwirl support + dWake bow core). | §5.4, §8 AC-SPIRAL |
| F16-hood | minor (fluid-mechanism · §4.1): hoodExposure unreachable for the drawn population — dead code, unfalsifiable probe | **ACCEPTED with corrected numbers.** Recomputed with the ×2/π-normalized trueLat + BELT_Y_MAX 0.75 + R ≤ 0.30 rad + 0.06 drift: storm CORE hood is exactly 0 population-wide (max core normalized lat ≈ 0.67 < 0.72); the outer collar fringe reaches hood ≈ 0.3 at the extreme corner (finding's "≤ ~0.1" was an underestimate, conclusion unchanged). Kept as documented future-proofing (polar-storm increments); reachability numbers to BUILD-NOTES; hood interaction OUT of AC-DECK probes. | §4.1, §4.4, §8 AC-DECK |
| F16-consts | minor (fluid-mechanism · §4.1): DECK_FLOOR/BELT/ZONE declared GLSL consts with no consumer — dead constants vs AC-0 discipline | **ACCEPTED.** Table demoted to the section comment; computational values moved to consumers: `STORM_DECK` frozen export in `storm-e.js` (FLOOR/ZONE/TOWER consumed by the carriage deckZ derivation; append-only, alea-guard-safe), GLSL declares only `DECK_HAZE` (hoodExposure minuend); BELT documented as the deepBase deriver. | §4.1, §3.2, §6 |
| F-deep | minor (fluid-mechanism · §4.3): unclamped luminance-donor ratio desaturates young (precursor) mode-1 spots out of the belt family | **ACCEPTED.** Ratio clamped `min(·, 1.5)`; young-spot seed added to the AC-DECK probe recipe. | §4.3, §4.4, §8 AC-DECK |
| F10 | BLOCKER (population-wiring · §2.2): `if (locked)` before the range check sends every locked non-giant (Eyeball ⇒ ~8766 h, Lava, Europa, Magma) down the Kepler branch — real behavior change on solid presets, breaks the AC-OFFGATE proof plan | **ACCEPTED, strengthened.** Additionally verified: `'Hot Jupiter (locked giant)'` is ABSENT from PRESET_ARCHETYPE (15 mapped presets), so an archetype-keyed lock branch could NEVER fire for it — the finding's fallback identity (locked + h2-he, the existing lab thermalStrength idiom) is the only correct key. Module fn gates derivation on `locked && hydrogenAtmo`; wrapper: NAMED ⇒ canonical except hot-Jupiter-class; locked-solids-canonical regression tests added. | §2.2, §2.4, §8 AC-ROTDRAW |
| F11 | major (population-wiring · §2.2): `'ice'` range entry mis-targets Frozen/Europa (Neptunian maps to `'sub-neptune'` — V2-3 Option-B ruling verified in driver-presets.js) | **ACCEPTED.** `'ice'` key deleted; comment documents the shared sub-neptune key; §2.4 phrasing fixed ("sub-neptune range alone"). | §2.2, §2.4 |
| F12 | major (population-wiring · §2.4): ice-corner m≈3 only holds under the NEPTUNIAN regime bundle (uPeak ≈ 7.70); GAS_GIANT at the same corner gives m ≈ 5–7 | **ACCEPTED.** Verified DRIVER_BUNDLES (NEPTUNIAN internalHeat 2.60 / dissipation 0.15) + the lab's Neptunian→E5_REGIME.NEPTUNIAN route + the "Neptunian 3.9R/16.1h → 3" house comment. Sweep leg pinned to `resolveParams(E5_REGIME.NEPTUNIAN, …)` with the uPeak dependency stated. | §2.4 |
| F13 | major (population-wiring · §2.2/§9): body-condition-vector D8 spin (`fp.rotationHours ?? 24`, V2-4 C5 figure-ω source) never sees the drawn hours — unadjudicated divergence | **ACCEPTED with the defer option** (the finding sanctions either). Wiring it would touch bodyFigure/oblateness with possible golden contact — outside this contract's AC set; documented divergence with named owner in §2.2 + §9 + morning report + BUILD-NOTES consumer table (mirrors the dynamo-gate deferral). | §2.2, §9 |

**Slice-order re-verification after folds:** unchanged S1→S2→S3→S4; every fence still proven
at its seam. S1 (F10/F11 folds) now provably leaves ALL solid presets canonical — the
AC-OFFGATE solid-preset full-identity proof is restored; S1's fence surface unchanged (guard
extension per F6 shape). S2 adds the F2 slot-sync rule + `STORM_DECK` export — still zero
visual change (unread uniform, unconsumed export until S3), mask golden/phase-bank fence
unchanged. S3 consumes STORM_DECK/uStormAux exactly as before plus the F-deep clamp — all
inside the storm gate, off-gate structural argument intact. S4's §5.3 branch rewrite makes
the off-gate STRONGER (literal `pos`/`Nraw` both channels); the dLat append preserves the
band-flow `[wire]` pin substring; jag exclusion (F3) removes the only fence-test contact the
plan had. No fold moved code across a slice boundary; no fold touches dAdvect, the four
existing stormE streams, relief/dispatch, or either golden. All accepted blockers were
plan-level defects with in-scope fixes — the increment remains buildable as contracted.

---

## 11. Build deviations

*(placeholder — builder appends deviations from this plan as they are adjudicated, with the
trigger class from §9 and the BUILD-NOTES cross-ref)*

1. **[S2, ADJUDICABLE §9] deckZ is DERIVED, not a drawn `stormE:deck` stream.** designDecision-8
   offered a `stormE:deck` alea stream as an example; S2 instead DERIVES `uStormAux[i].z` in the
   lab carriage (`_stormDeckZ`: mode-0 ⇒ `mix(ZONE, TOWER, 0.35+0.65·age)`, mode-1 ⇒ `FLOOR`)
   from the storm's mode + already-drawn age via `STORM_DECK`. Stronger AC-0 driver-connectivity
   (the deck a storm occupies IS the storm), and it avoids inserting a draw that would need its
   own append slot. The stochastic per-storm scalars (`emboss`/`billow`) remain the alea draws.
   Cross-ref: BUILD-NOTES §S2 "New/changed symbols" + AC-0 consumer table.
2. **[S2, ADJUDICABLE §9] train-slot `s.mode` pass-through (honesty fix).** The per-frame train
   carriage previously hard-coded mode `0` into `uStormParams[_stormN].z`; S2 passes the true
   `s.mode`. Consumer-safe: the only GLSL reader of `.z` today is the slot-0 GRS wake gate
   (`i==0 && uStormParams[0].z < 0.5`), which never inspects train slots. Verified against the
   §0.4 draw-order note. Cross-ref: BUILD-NOTES §S2 carriage bullet.
3. **[S3, ADJUDICABLE §9 — candidate magnitudes] `WISP_WARP` / `WISP_OFF` are builder-chosen.**
   §4.3 specified the rim-wisp FORM (`sin(uBandM·latHere + uBandPhaseJet + WISP_WARP·bandWarpField(
   n·4.3 + WISP_OFF))`, `pow(|·|,6)` sharpen, `WISP_K = 0.10`) but not the `WISP_WARP` gain or the
   `WISP_OFF` decorrelation offset. Chosen `WISP_WARP = 1.5`, `WISP_OFF = vec3(2.3, 5.7, -1.1)` as
   Phase-A candidates (declared `const`, commented CANDIDATE) — same bucket as `EMB_K`/`COLLAR_K`/
   `WISP_K`/`BAND_SPIRAL.*`: Phase-B live freeze belongs to the orchestrating session. Cross-ref:
   BUILD-NOTES §S3 consts table.
4. **[S3, ADJUDICABLE §9 — documented-marginal] hoodExposure APPLICATION form.** §4.1 gave the
   value `hoodExposure_i = 0.30·hood·(DECK_HAZE − deckZ_i)` but not how it composites onto `col`.
   Applied as a deck-weighted hood-dimming multiply on the storm-painted color: `col *= 1.0 −
   0.30·hood·(DECK_HAZE − deckZ)` — a tower (deckZ 0.9) barely dims, a mode-1 hole (0.0) dims fully
   into the hood, matching §4.1's "tower pops above / hole dims with it" prose. Marginal by F16-hood
   (`hood` ≈ 0 at every storm core population-wide ⇒ the multiply is ≡ 1.0 today), excluded from the
   AC-DECK probe recipe. Cross-ref: BUILD-NOTES §S3 hoodExposure reachability.
5. **[S4, ADJUDICABLE §9] estimator helpers `spiralWrapProfile` / `spiralMeridional` +
   `SPIRAL_NB` export added to `band-flow.js`.** §5.1 specifies `BAND_SPIRAL` + `spiralDisplacement`;
   the radial-Δψ wrap prop (F9), the 42-lobe count, the rr-coupled flow-signed lean (F15), and the
   calibrate superposition envelope (F17) need a frame-exact `(rr, thv)` sampler + the channel-(a)
   meridional deflection. Added as pure estimator exports (the `wakeReachProfile` precedent — single
   source of truth so the unit test and `deck-spiral-calibrate.mjs` measure the SAME quantity), plus
   `SPIRAL_NB = max(3, round(2π/LAMBDA_KH)) = 42` as a derived export. They write no source, draw no
   rng, and are disjoint from `BAND_FLOW`'s pinned values — zero fence contact. Cross-ref:
   BUILD-NOTES §S4 "New / changed symbols (band-flow.js)".
6. **[S4, ADJUDICABLE §9 — candidate magnitudes] `BAND_SPIRAL.*` are Phase-A candidates.** WRAP/AMP/
   SCAL/LEAN/annulus edges are measured-safe at Phase-A (`deck-spiral-calibrate.mjs`: wrap_visible
   ≤ 0.542 turns, amplitude within the `AMP·R·(1+SCAL)` bound, no envelope corner exceeds `π/uBandM`)
   but the live amplitude freeze belongs to the orchestrating session — same bucket as `EMB_K`/
   `COLLAR_K`/`WISP_K`. The AC-SPIRAL live read is a RADIAL transect + `wrap_visible`, not the
   contract's literal "along a ring" (F9 — the ring read is measurement-vacuous). Surface at UAT.
