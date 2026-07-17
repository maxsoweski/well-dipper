# BUILD-PLAN — world-engine-atmo-expression-2026-07-17

> **Author:** BUILD-PLAN subagent (planner), 2026-07-17, worktree `~/projects/well-dipper-atmo`
> (branch `feature/world-engine-atmo-3b`, MERGED with L1 at the `68972f4` seam, GREENLIT at `2ade359`).
> **Symbol anchors only — never line numbers.** Run every suite FROM the worktree dir
> (`cd ~/projects/well-dipper-atmo && npx vitest run …`).
> **Binding scope pins (contract `designDecisions` + Max's four rulings — do NOT re-litigate):**
> INTERACTION ONLY (no multi-deck parallax); REAL directional advection (not stronger isotropic noise —
> Max already rejected that read at the 2026-07-15 UAT); STATIC place-once (NO `uTime` in any term);
> PER-BAND shear-driven jaggedness + one per-seed global draw; ONE increment / THREE slices with a
> re-scope gate; OVERSHOOT BOLD (Max dials back at UAT via one named dial). New fields are ADDITIVE —
> `GOLDEN_BANDFIELD_HASH -1329854088` + `GOLDEN_STORM_MASK_HASH 568852786` never move, never re-captured;
> the `aStorm` mask contract + phase bank stay byte-identical (#4/#5/#8 downstream).

---

## 0. Grounding ledger (every seam cited by file + symbol; verified against `2ade359` this session)

### 0.1 The ROOT CAUSE, stated mechanically (grounding brief §2a, re-verified in code)

The gas deck composites in `zonalBandCol(N, pos, wBand, wShear, wMush, wStorm)`
(`planet-lod-height.glsl.js`), called ONCE from the lab band block
(`planet-lod-lab.html`, the `bandMask > 0.0` branch). There the swirl is applied to the DIRECTION:
`bandN = stormSwirl(normalize(vPos)); bandPos = bandN * length(vPos);` (both only when `uStormCount>0`),
then `zonalBandCol(bandN, bandPos, vBand, vShear, vMush, vStorm)`.

Inside, the dominant band luminance is
`float bandVal = wBand + uBandWarp*0.16*r;` → `zone = smoothstep(0.34, 0.66, clamp(bandVal))`.
**`wBand` is the BAKED per-vertex scalar `aBand`** (`bakeClimateE5Attributes` →
`aBand[i] = clamp01(0.5 + 0.5·contrast·jetProfile(lat,P)/normDenom)`), interpolated per fragment. The
swirl rotates `bandN`/`bandPos`, so it deflects only the **fine warp overlay** `r = bandWarpField(bandPos)`
(amplitude `0.16`) and the `trueLat`-derived terms — but **NOT `wBand`**, which carries the FULL band
swing. #3a moved the band VALUE into `aBand`, which defeated the pre-#3a F27 latitude-computed
deflection. Net: the primary band boundaries sit still while `stormColTerms` (an alpha-over
`mix(col, stormColTerms(N,col), weight)`) paints a decal → **"one on top of the other."**

The existing "ink" (V-α.1 filamentation) is `bandVal += uBandWarp*0.14 * (wShear·clamp(wStorm)) * ffr *
bandWarpField(pos*3.7+…) * (1-uHazeMute)` — an **isotropic `bandVal += noise`** boundary perturbation.
It does NOT advect the scalar along the flow → reads as grain, not viscous structure ("not rendered at
all"). The wake (`stormColTerms` `i==0` branch) is a color MULTIPLY confined to a west cone within
`~2.6·R` — no circulation into the far band field.

### 0.2 The analytic band field IS fully reconstructable render-side (the linchpin)

`aBand` is a pure closed form of latitude + the resolved param bundle `P` (`resolveParams` in
`climate-e5.js`): `bandNorm(lat) = clamp01(0.5 + 0.5·P.contrast·jetProfile(lat,P)/P.normDenom)`, with
`jetProfile = P.uPeak·(P.sEq·P.aEq·g + P.aMid·mid)`, `g = exp(-(lat/P.phiEq)²)`,
`mid = sin(P.m·lat + P.phaseJet)·(1-g)·env`, `env = P.envBase + P.wardGain·P.s2·P2(sinLat)`.
**`P.uPeak` and `P.normDenom` cancel** in `bandNorm` because `normDenom = uPeak·(aEq + aMid·envMax)`:

```
bandNorm(lat) = clamp01( 0.5 + DEFLECT_SCALE · ( sEq·aEq·g + aMid·mid ) )
DEFLECT_SCALE = 0.5·P.contrast / (P.aEq + P.aMid·P.envMax)          ← one exported scalar
```

So a faithful **render-side band PROXY** needs only 6 per-planet uniforms (`m, phaseJet, sEq, aMid, s2`,
and the combined `DEFLECT_SCALE`) plus 4 GLSL consts (`aEq=0.6, phiEq=0.35, wardGain=0.8, envBase=1.0`,
from `PHYS`). This proxy reproduces `wBand` to float tolerance — **it is used ONLY to form a DEFLECTION
DELTA**, never to replace the baked render value, so `aBand` and its golden are untouched (§4 proof).

### 0.3 Render carriage — REUSE, storm/band sections only (atmo fence)

`planet-lod-uniforms.js`: `uBandCount/uBandContrast/uBandWarp/uBandTint/uBandStretch/uBandLatPow/`
`uBandOffset` (band deck); `uJetEqWidth` (equatorial Gaussian); `uStormPosSize[8]` (xyz center, w radius),
`uStormParams[8]` (**x rotStrength, y aspect, z mode, w companion**), `uStormColor[8]`, `uStormCount`;
`uPolar*`; `uHazeMute`. **NOTE:** `uBandCount` is the LEGACY stripe count (drives `jetU`/`jetShearGate`/
`jetsDisp`) — it is NOT the writer's Rhines `m` and is NOT phase-aligned with `wBand`; the proxy must
NOT reuse it (that would mis-place the deflection). The proxy carries the writer's real `P.m`/`P.phaseJet`.

`planet-lod-height.glsl.js` (edit storm/band GLSL bodies only): `bandWarpField(vec3)` (static, `uTime`-free
— the fresh-static-warp source for all new detail, F1 discipline), `stormSwirl`, `stormColTerms` (holds
the existing GRS wake cone `i==0`), `polarVortexCol`, `zonalBandCol` (the combiner all three slices edit).

### 0.4 Lab wiring — KEEP; the reseed path re-runs the writers (derive-not-freeze inheritance)

`rebakeE5Bands()` computes `_gd = deriveGiantDrivers(drawGiantConditions(regime, _gcond, macroSeed))`,
then `bake = bakeClimateE5Attributes(…)` (**`bake.params` = the full `P` — the proxy-uniform source**) and
`bakeStormEAttributes(…)`. `applyStormState()` resolves the discrete vortices via `resolveStormE`.
`reseedGiant() = updateSeedUniforms(); rebakeE5Bands(); applyStormState();` — the New-planet button, the
macro-seed slider, and `_lab.setSeed` all route through it. **The new proxy/roughness uniforms are
exported inside `rebakeE5Bands` from `bake.params`, so every reseed re-exports them.** The per-frame
uniform block (`uBandCount.value = …` etc.) fills `uStormPosSize/uStormParams/uStormColor/uStormCount`
from `state.spot*/trainSpots[]` and is unchanged except for the added value-slider reads.

### 0.5 Goldens / suites that lock current behavior (measured GREEN at `2ade359` this session)

`climate-e5` 17 · `storm-e` (incl. `GOLDEN_STORM_MASK_HASH 568852786`, the `stormE:*`-only alea guard,
the `[envelope]` one-new-attribute guard) · `emission-e` 12 (re-asserts `GOLDEN_BANDFIELD_HASH
-1329854088`) · `giant-drivers` · `planet-archetypes` 21 — **5 files / 102 tests PASS**. The `[envelope]`
guard forbids exactly two things relevant here: a second `attribute float aStorm` (we add NO baked
attribute) and a uniform literally named `uStormMask` (none of our names collide). Full-suite pre-existing
failed-SET = **4 failed / 7 files** (motion-test-kit, star-billboard, warp-portal/tunnel,
BodyRenderer.dispose, GalacticFeatures, KnownObjects — none in atmo scope); **re-measure at the build
commit; the SET must not grow.**

---

## 1. The unifying architecture (one new render term; three contributors)

All three findings reduce to **one insight**: displace the LATITUDE at which the primary band field is
read, then re-derive the band value analytically — because the band field is reconstructable (§0.2).
Add exactly ONE new term to `zonalBandCol`:

```
float latRaw = asin(clamp(Nraw.y, -1.0, 1.0));                 // raw (un-swirled) latitude, radians
float dLat   = dWake(Nraw) + dAdvect(Nraw, wShear, wBand);     // meridional displacement, STATIC (no uTime)
float dBand  = bandProxy(latRaw + dLat) - bandProxy(latRaw);   // deflect the PRIMARY baked band
bandVal += dBand;                                               // ADDITIVE; == 0 wherever dLat == 0
```

Because `bandProxy(latRaw) ≈ wBand` (same closed form), `bandVal ≈ bandProxy(latRaw + dLat)` — the
primary bands genuinely bend, at FULL non-linearity (the delta re-samples the oscillation at the
displaced latitude; a first-order gradient would over/undershoot — displacement can reach ~0.4 band-widths
at `m≈12`). Two contributors feed `dLat`:

- **`dWake`** (slice I / finding 2): storm-anchored meridional deflection + a **downstream cone extending
  well past the rim** (`~6·R`, vs today's `2.6·R`). COUNT-gated `uStormCount>0` → **0 whenever there are no
  storms** (non-gas AND gas-storms-off), the same lever `stormColTerms` uses. Bands bow around the storm and
  a wake trails into the field.
- **`dAdvect`** (slice K / finding 3): **anisotropic** static displacement — long correlation ALONG the
  zonal flow, short ACROSS it (stretch), a FOLD at shear interfaces (breaking-wave / festoon read — NOT a
  literal vortex roll-up; §3.1 mechanism boundary), 2-octave fold. Gated on `clamp(wStorm,0,1)` (the mask)
  → **0 where mask=0 (non-gas)** (the exact lever the existing filament term uses); it is NOT count-gated,
  so on a gas deck the mask baseline (`MASK_FLOOR 0.06` + shear) makes it render everywhere the jets shear,
  storms on OR off.

Slice **J (jaggedness / finding 4-remainder)** is a SEPARATE high-frequency edge term on `bandVal`
(NOT a latitude displacement), per-band shear-scaled × a per-seed global draw. Independent of the proxy.

**Why this satisfies every hard constraint:** `dLat` is a pure function of position + baked fields +
per-planet uniforms → no `uTime`, place-once per seed, same-seed deterministic. `dBand == 0` exactly
wherever `dLat == 0` (identical proxy inputs). **Two PRECISE identities (not one — fluid-lens):** on a
NON-GAS deck (`uBandStrength`/mask = 0) every new term is 0 ⇒ full byte-identity (this is the "off-gate"
guarantee AC-ZERO-CLOBBER checks); on a GAS deck with storms toggled off, `dWake=0` (count-gated) but
`dAdvect`+jag persist (mask-gated, by design, like the existing V-α.1 filament) — that is intended, not a
breach. The term READS `wBand` and adds to a LOCAL `bandVal`; it never writes `aBand` →
`GOLDEN_BANDFIELD_HASH` frozen by construction. No storm/mask/phase writer is touched →
`GOLDEN_STORM_MASK_HASH` + phase bank byte-identical (§4).

---

## 2. Slice I — THE DEFLECTION / INTERACTION MECHANISM (finding 2)

**What it builds.** `dWake(Nraw)` — a static meridional displacement that (a) bows the primary bands
AROUND each storm and (b) sheds a wake DOWNSTREAM into the band field far past the rim — plus the
`stormColTerms`/`stormSwirl` reinforcement so the local circulation reads coherently.

### 2.1 `dWake` term shape (concrete GLSL, inserted in `zonalBandCol` right after `float bandVal = wBand + uBandWarp*0.16*r;`)

Loop the storms in the storm tangent frame (the SAME `east/north` frame `stormColTerms` builds):
```
// per storm i (i < uStormCount): c = uStormPosSize[i].xyz, R = uStormPosSize[i].w
east  = normalize(cross(vec3(0,1,0), c));  north = cross(c, east);
de = dot(Nraw, east);  dn = dot(Nraw, north);
float facing = step(0.0, dot(Nraw, c));                       // near-side only (antipode kill, stormColTerms idiom)
float rot    = uStormParams[i].x;                             // sign = circulation direction
// DOWNSTREAM SIGN from the LOCAL ZONAL FLOW at the storm latitude (fluid-lens must-fix; needs slice-K proxy):
float latC  = asin(clamp(c.y, -1.0, 1.0));
float flow  = sign(bandProxy(latC) - 0.5);                    // sign(jetProfile(latC)); +east in zones, −east in belts
float ds    = flow * de;                                      // >0 downstream, <0 upstream (per-storm, per-band correct)
// (a) near-storm ROTATIONAL bow: push bands meridionally, sign following the swirl → bands wrap the oval
float rr    = length(vec2(de/uStormParams[i].y, dn)) / max(R,1e-4);
float bow   = sign(dn) * (1.0 - smoothstep(0.0, 1.6, rr));    // dies by ~1.6R (wider than today's rim)
// (b) DOWNSTREAM WAKE cone (downstream = flow-sign·east, NOT hard-coded west):
float along = ds / (WAKE_LEN * R);                            // 0 at core … 1 at the cone tip (~6R), downstream
float lat_w = dn / (WAKE_WID * R);
float cone  = smoothstep(0.05, 0.30, ds/R)                    // starts just downstream of the core
            * (1.0 - smoothstep(0.75, 1.15, along))            // long downstream reach
            * exp(-lat_w*lat_w);                               // lateral Gaussian
float wave  = sin(WAKE_K * along) * (1.0 - smoothstep(0.6, 1.1, along));  // von-Kármán meander in the tail
dWakeSum += uAtmoInk * sign(rot) * facing * ( WAKE_BOW*R*bow + WAKE_AMP*R*cone*wave );
```
`dWake = dWakeSum` (loop, `for i<8; if i>=uStormCount break;`). **All spatial detail is `Nraw`-static** —
no `uTime`, no animated `jetsDisp`/`r0`/`r1` path (F1). The bow makes bands bend around the oval; the cone
+ meander carries deflection ~6R downstream (finding 2's "wake into the band field beyond the rim").

**Downstream direction is DERIVED, not hard-coded (fluid-lens must-fix #5, promoted from §9 adjudicable).**
A hard `-de` (always west) trails the wake wrong for storms in eastward jets. With the proxy render-side
(slice K), `sign(bandProxy(latC) - 0.5) = sign(jetProfile(latC))` gives the local zonal-flow sign for free,
so the wake trails DOWNSTREAM per band (east in zones, west in belts). This makes slice I depend on K's
`bandProxy` (I lands after K — ordering already correct). **Labeling note:** the existing GRS `stormColTerms`
`i==0` cone points WEST and is labeled *upstream* (torn filaments where the westward jet piles in); this
`dWake` cone is the *downstream* wake — reconcile the two so the plan/code don't call the same side both
names. (For a canonical prograde-equator GRS-class primary the two often coincide; the derivation makes it
correct for the general per-seed case.)

**Perceptual amplitude — the bow/wake must READ, not merely diff (fluid-lens must-fix #4).** At the starting
constants the bow peak ≈ `WAKE_BOW·R = 0.06·0.24 ≈ 0.014 rad ≈ 2–3 px` and the far wake at 3R computes
sub-pixel — yet the AC-INTERACT pixel-diff still "passes" on a sub-perceptual amount. §6.0 must therefore
pin `WAKE_BOW/AMP` to a **perceptual floor** (peak near-storm meridional band-edge deflection ≥ a reading
band-width fraction, target ≥ ~0.25 band-width; far-wake ridge ≥ ~3–4 px at the pinned camera), NOT merely
"detectable by diff" — confirmed at the live A/B read-gate (§6.0) before the constants freeze.

### 2.2 Why the baked `aBand` + golden are untouched

`dWake`/`dBand` READ `wBand` (a param) and the proxy uniforms, and ADD to a local `bandVal`. Nothing here
touches `bakeClimateE5Attributes` or the `aBand` buffer (a vertex attribute — not fragment-writable
regardless). `GOLDEN_BANDFIELD_HASH` is hashed from `writeClimateE5Sphere().bandField` on the **frozen
DRIVER_BUNDLES path** (no derived drivers) — that code path is not edited → golden frozen by construction.

### 2.3 CPU mirror & where AC-INTERACT / AC-ADVECT references live

AC-INTERACT is a **live A/B pixel-diff** (`:5178`, storm on/off) — no CPU reference needed for the pass,
but a **headless sanity floor** on `dWake` lives in the new mirror module (below): the wake `|dLat|`
must stay above threshold past `2.6·R` downstream (documented reach ~`5–6·R`) and vanish at
`uStormCount→0`. AC-ADVECT is **headless** and reads its CPU reference from the **NEW module**
`src/worldengine/base/band-flow.js` (atmo-owned, additive — the giant-drivers/storm-e "new sibling
module" precedent), which exports pure mirrors:
- `bandProxy(lat, P)` — mirrors the GLSL proxy; a parity floor asserts `bandProxy(lat,P) ≈
  bakeClimateE5Attributes.aBand(lat)` within tol (imports `resolveParams`/`jetProfile` from
  `climate-e5.js` read-only; **climate-e5 is NOT edited**).
- `stormBandDrag(dir, vortices, P)` — mirrors `dWake` (the wake-reach sanity floor).
- `advectDisplacement(dir, P, {ink, stretch})` — mirrors `dAdvect` (the AC-ADVECT anisotropy source).
- `bandRoughness(wShear, uBandRough)` + `drawBandRoughness(regime, macroSeed)` — slice J.

The GLSL formulas are faithful transcriptions of these mirrors; the parity floor + the live A/B prove the
GPU path (the emission-e CPU↔GLSL constant-parity precedent — vitest has no GPU, so numeric truth lives in
the mirror and the uniform-export assertion, visual truth in AC-INTERACT/AC-LIVE).

---

## 3. Slice K — THE ADVECTION / VISCOUS MECHANISM (finding 3, "ink in water")

**What it builds.** `dAdvect(Nraw, wShear, wBand)` — a static meridional displacement whose SPATIAL
STRUCTURE is directional: dye-like tendrils drawn LONG along the zonal flow, FOLDED at shear interfaces
(breaking-wave / festoon read — NOT a literal vortex roll, §3.1 mechanism boundary), folded at two scales.
Fed into the SAME `dBand` term (§1), so the PRIMARY bands themselves stretch and fold — the read Max wants,
not edge grain.

### 3.1 Term shapes (concrete GLSL)

```
// local zonal (flow) frame at Nraw — POLE-GUARDED (fluid-lens minor: cross(up,Nraw)→0 at the poles)
vec3 exN = cross(vec3(0,1,0), Nraw);
vec3 eF  = exN / max(length(exN), 1e-3);        // never normalize(vec3(0)) → NaN; term self-fades as e→0 near pole
vec3 nF  = cross(Nraw, eF);
float e = dot(Nraw, eF), n = dot(Nraw, nF);
// (1) ANISOTROPIC stretch: COMPRESS the along-flow axis in the sample domain ⇒ features ELONGATE along flow.
vec3 dom1 = (Nraw + eF*(e*(1.0/uInkStretch - 1.0))) * INK_FREQ + INK_OFF;   // east-compressed domain
float s1  = bandWarpField(dom1);                                            // fresh STATIC warp (uTime-free)
// (2) MULTI-SCALE FOLD: a second octave, half amplitude, decorrelated offset
vec3 dom2 = (Nraw + eF*(e*(1.0/uInkStretch - 1.0))) * (2.0*INK_FREQ) + INK_OFF2;
float s2f = 0.5 * bandWarpField(dom2);
// (3) SHEAR-INTERFACE FOLD (breaking-wave / festoon read — NOT a literal vortex roll-up, see note):
float fold = FOLD_K * clamp(wShear,0.0,1.0) * sin(FOLD_FREQ*n + PI*step(0.5,wBand)) * bandWarpField(dom1.zxy + FOLD_OFF);
float ink  = (s1 + s2f + fold);
dAdvect = uAtmoInk * INK_AMP * ink * clamp(wStorm, 0.0, 1.0);               // MASK-gated ⇒ 0 off-gate
```

- **Directional (not isotropic):** the `1/uInkStretch` compression on the flow axis `e` makes warp
  features long east / short north → tendrils stretched along the jets. Setting `uInkStretch=1` collapses
  to isotropic — the **null AC-ADVECT rejects**.
- **Shear-interface fold (renamed from "roll-up"; fluid-lens must-fix #3):** `fold` adds a shear-gated,
  belt/zone-phase-flipped (`step(0.5,wBand)`) meridional fold at shear interfaces — it reads as a
  breaking-wave / festoon FOLD. It is **NOT** a literal Kelvin-Helmholtz billow / closed vortex roll-up (see
  the mechanism-boundary note below). Pin `FOLD_K` bold enough that the folds READ (live read-gate, §6.0).
- **Static / place-once:** every sample is `bandWarpField` of an `Nraw`-derived domain — no `uTime`, no
  animated `r`/`r0`/`r1`/`jetRotY(…ph…)` path (F1 grep guard, §7).

**Mechanism boundary — record in BUILD-NOTES; surface to Max at UAT (fluid-lens must-fix #3).** `dBand`
displaces only LATITUDE (`bandProxy` is a function of latitude ONLY, so any 2D domain move ultimately just
re-reads the band value at a displaced latitude). A latitude-value field can STRETCH, WAVE, and (at bold
amplitude) FOLD its iso-contours in latitude — but it **cannot spiral into a closed overturning vortex**
(a true billow). This increment therefore delivers **anisotropic stretch + shear-interface fold** — the
faithful, honest read of Max's "tendrils stretched along the flow, folded at shear boundaries." Literal
vortex ROLL-UP would require a genuinely 2D-advected passive scalar (band value carried as its own 2D
field, not re-derived from latitude) — a different, bigger mechanism that would balloon this slice (re-scope
gate). If Max at UAT still wants literal roll-up, it is a follow-up increment; do NOT silently claim
"billows" this increment.

### 3.2 Amplitude constants + the single boldness dial

| Const | Role | Starting value | Pinned by |
|---|---|---|---|
| **`uAtmoInk`** | **THE boldness dial** (scales `dWake` AND `dAdvect`) — Max tames at UAT | **1.0 (bold)**, GUI range **0..2** | live A/B / UAT |
| `uInkStretch` | anisotropy (flow-axis domain compression) | ~3.5, GUI 1..6 | AC-ADVECT calibration |
| `INK_FREQ` | base tendril frequency | ~2.2 (const) | calibration |
| `INK_AMP` | base displacement (rad) at `uAtmoInk=1` | ~0.055 rad (~0.2 band-width) | calibration (bold read) |
| `FOLD_K` / `FOLD_FREQ` | shear-interface fold gain / frequency (NOT a vortex roll) | ~0.5 / ~9.0 (const) | calibration + live read-gate |
| `WAKE_LEN/WID/BOW/AMP/K` | wake reach/width/bow/tail/meander | ~6 / ~1.2 / ~0.06 / ~0.05 / ~7 | calibration + **perceptual floor** + AC-INTERACT |

`uAtmoInk` is the **one dial** the ruling asks for: default bold, Max slides toward ~0.5 at UAT; it scales
the whole viscous read (wake + advection). Jaggedness has its own `uBandRough` (§4). **Numbers above are
starting estimates — pinned from measured sweeps by the calibration script (§6.0) BEFORE shader coding**
(measure-before-pin, the derive-not-freeze discipline) **AND then confirmed at a live A/B visual read-gate
(§6.0) before they freeze** — because the increment's whole reason for existing is a READ Max called "not
rendered at all," and numeric distributions alone cannot tell "reads as flow" from "anisotropic but
invisible" (the V-α.1 trap; fluid-lens must-fixes #1/#4).

### 3.3 The anisotropy metric AC-ADVECT asserts (headless, on the JS mirror)

Over `SWEEP_SEEDS × {Jovian, Saturnian, Neptunian}`, `advectDisplacement` is sampled on two great-circle
transects at fixed mid-belt latitudes: an **east (along-flow) transect** and a **north (cross-flow)
transect**. The metric = **ratio of decorrelation lengths** `L_east / L_north` (first-zero of the transect
autocorrelation, or the ratio of RMS finite-difference gradients `⟨|∂n|⟩/⟨|∂e|⟩` — pin the exact estimator
at calibration). **Assertion band (measured, e.g. `[2.5, 5.0]`) on every seed; isotropic null
(`uInkStretch=1`) yields ~1.0 and is clearly rejected; repeat-seed byte-equal; the static-source grep
(DIFF-SCOPED to the added lines — see §8 note) confirms no `uTime` in the added terms.** The band is set
from the calibration distribution, not guessed a priori.

**Amplitude FLOOR, not ratio-only (fluid-lens must-fix #1).** A ratio in `[2.5,5.0]` can be satisfied by a
field that is anisotropic yet SUB-PERCEPTUAL — exactly how V-α.1 passed its numbers and read as nothing.
So AC-ADVECT ALSO asserts a **peak-displacement floor keyed to band-width**: peak `|dLat|` ≥ a measured
fraction of one band-width (`π/m`), and peak `|dBand|` ≥ a measured fraction of the visible `smoothstep(0.34,
0.66)` transition width (0.32) — pinned at the §6.0 live read-gate. A later edit that shrinks amplitude then
FAILS the test instead of passing on ratio alone.

---

## 4. Slice J — PER-BAND JAGGEDNESS (finding 4 remainder)

**What it builds.** A high-frequency edge-roughness term on `bandVal` combining a **per-band belt/zone base**
(`cyc` from `wBand` → whole belts rougher than whole zones — the contract's ask) with an **edge boost**
(`wShear` → extra at high-shear boundaries), times **one per-seed global draw** (`uBandRough`). Belts read
rougher than zones on one planet; re-rolls differ globally. (`wShear` ALONE cannot deliver this — it is a
boundary field blind to belt-vs-zone; see §4.1.)

### 4.1 Term shape (concrete GLSL, inserted right AFTER the existing filament line in `zonalBandCol`)

**Why `roughness ∝ wShear` ALONE is wrong (fluid-lens must-fix).** `wShear` (baked `aShear`) is a
BOUNDARY field: it peaks at every belt/zone EDGE and is ≈0 at every band CENTER (belt centers AND zone
centers both sit at `jetProfile` extrema where `jetShear≈0`). So `wShear` alone CANNOT tell a belt from a
zone — `roughness ∝ wShear` makes every band identical (rough edges, smooth center), which is NOT the
contract's ask (**belts rougher than zones on the same planet**). The belt/zone DISCRIMINATOR is the band
SIGN `cyclonic = clamp((0.5-wBand)*2, 0, 1)` — the exact term the existing filament FFR already uses
(`ffr = 0.55 + 0.45*cyclonic`, height `zonalBandCol`). Roughness = **per-band base (`cyc`) + edge boost
(`wShear`)**:
```
float cyc   = clamp((0.5 - wBand) * 2.0, 0.0, 1.0);                 // 1 belt (cyclonic) … 0 zone — the PER-BAND discriminator
float rough = (ROUGH_BELT * cyc + ROUGH_EDGE * clamp(wShear,0.0,1.0)) * uBandRough;  // whole belts rough + extra at high-shear edges; × per-seed global
float jag   = bandWarpField(pos * ROUGH_FREQ + ROUGH_OFF);          // fresh STATIC high-freq warp (uTime-free)
bandVal += ROUGH_AMP * rough * jag * clamp(wStorm, 0.0, 1.0);       // MASK-gated ⇒ 0 off-gate (filament precedent)
```
`ROUGH_FREQ ~ 7.0` (well above the `3.7` filament and the `2.2` advection → a distinct high-frequency band =
"jagged edge" not "flowing tendril"). `ROUGH_AMP ~ 0.10`; the `ROUGH_BELT`/`ROUGH_EDGE` split (start ~0.7 /
~0.5) is calibration-pinned so whole belts carry visible baseline roughness AND high-shear edges get extra.
`cyc`/`wShear` are BOTH existing params (from `aBand`/`aShear`) → NO new baked attribute. **Optional richer
variety (adjudicable, beyond Max's ruling-2 minimum):** a per-band-cell hash draw multiplying `rough` would
give literal "some bands smooth, some jagged" beyond the 2-level belt/zone split — keep OUT of the required
build unless the belt/zone read under-delivers at UAT (re-scope gate).

### 4.2 Where the per-band value comes from — and why NO new baked attribute

Two EXISTING params carry the per-band physics — no new baked attribute (adding one would trip the
`[envelope]` one-new-attribute guard):
- **`cyclonic` (from `wBand`/`aBand`, the SIGN of the band).** `cyc = clamp((0.5-wBand)*2,0,1)` = 1 on a
  cyclonic belt, 0 on an anticyclonic zone — the **per-band discriminator** that makes whole belts rougher
  than whole zones (the contract's ask). Slice J EXTENDS the proven FFR per-band signal (`ffr = 0.55 +
  0.45*cyclonic`, height `zonalBandCol`).
- **`wShear` (baked `aShear` = `clamp01(|jetShear(lat,P)|/shearPeak)`, climate-e5 `bakeClimateE5Attributes`).**
  A BOUNDARY field: peaks at every belt/zone EDGE, ≈0 at every band CENTER. It ADDS extra roughness at
  high-shear edges but CANNOT by itself distinguish a belt from a zone (both centers sit at `jetProfile`
  extrema where `jetShear≈0`). Used ONLY as the edge-boost term, never as the sole key.

### 4.3 The per-seed global draw — a NEW disjoint alea stream (append-only; goldens safe)

`uBandRough` is drawn per seed by `drawBandRoughness(regime, macroSeed)` in `band-flow.js` on a **NEW
disjoint stream `bandFlow:rough:<regime>:<macroSeed>`** — it does NOT touch `resolveParams` (adding a draw
there would shift `phaseJet/phaseMush/ampJitter/obliquity` draw order and MOVE `GOLDEN_BANDFIELD_HASH`),
nor any `stormE:*` stream (mask golden). Draw: `uBandRough = ROUGH_MEAN + (rng()-0.5)·2·ROUGH_SPREAD`
(e.g. mean 1.0 ± 0.4). GUI-overridable (a value slider, §5). This mirrors derive-not-freeze's append-only
`stormE:polar` and giant-drivers' disjoint `giantD:cond` precedent exactly.

**Override-flag pin (golden-lens must-fix — must be explicit).** `drawBandRoughness` fires inside
`rebakeE5Bands`, which runs on BOTH reseed AND every `applyDrivers` (knob-drag) — so a manual `uBandRough`
slider drag would be re-clobbered on the next knob touch unless it carries a touched-flag. Reuse the exact
D-slot override mechanism already in the lab: the `_driverTouched` Set + `resetDriverOverrides()` clear
(lab `planet-lod-lab.html`). Concretely: add `uBandRough` to the touched-set on its slider `.onChange`;
`rebakeE5Bands` re-draws it from `bandFlow:rough` ONLY when it is NOT in the touched-set (untouched ⇒
per-seed derived; touched ⇒ the slider value persists across reseeds until `resetDriverOverrides`). Same
opt-in semantics as the bodyDrivers sliders — determinism is unaffected (same seed → same derived draw).

### 4.4 AC-JAG belt-CENTER vs zone-CENTER band (headless, on the JS mirror)

**The comparison MUST be belt-CENTER vs zone-CENTER — NOT boundary-vs-center (fluid-lens must-fix).** A
boundary (high `wShear`) vs a center (low `wShear`) ratio is a **tautology**: it passes for ANY shear-keyed
field and proves NOTHING about belts-vs-zones, so it would land green while the contract feature (belts
rougher than zones) is absent. Both a belt center and a zone center sit at `jetProfile` extrema where
`jetShear≈0` (so `wShear≈0` at BOTH); the ONLY difference is the band sign `cyc`. Over `SWEEP_SEEDS ×
{Jovian, Saturnian, Neptunian}`: sample `bandRoughness` at a **belt center** (`wBand` minimum, `cyc≈1`,
`wShear≈0`) vs a **zone center** (`wBand` maximum, `cyc≈0`, `wShear≈0`), both at fixed seed. **Assert
`roughness(beltCenter)/roughness(zoneCenter) >` the measured ratio band (pin from the calibration sweep —
the split is driven by `ROUGH_BELT·cyc`, NOT the edge boost) at every fixed seed; `uBandRough` varies across
seeds (set-size ≥ ⌈0.75·N⌉); same-seed byte-equal.** Optionally ALSO assert a separate edge-vs-center gap
(edge `wShear`-high > same-band center) to prove the `ROUGH_EDGE` boost — but the belt/zone center-vs-center
ratio is the one that proves the contract's per-band feature.

---

## 5. NEW FIELDS INVENTORY (all ADDITIVE; all uniforms — ZERO new baked attributes)

Every new field is a **per-planet uniform** (or a GLSL const) — NO new baked vertex attribute (the
`[envelope]` guard stays green), NO new `PROV_*` province (terms ride the already-registered `PROV_BANDS`
band deck and `PROV_GREATSPOT` storm weight), NO `*Enabled` key.

| Uniform | Value (deriver) | DAG consumer | AC-0 backing | Additive proof |
|---|---|---|---|---|
| `uBandM` | `P.m` (`rhinesWavenumber`, reads the D-slot triple) | `bandProxy` in `zonalBandCol` | D-slot-backed (via `deriveGiantDrivers`→`resolveParams`) | export only; no writer edit |
| `uBandPhaseJet` | `P.phaseJet` (`resolveParams`, `climateE5:params`) | `bandProxy` | named-derivation (`resolveParams`) | ″ |
| `uBandSEq` | `P.sEq` (`equatorialJetSign(shellDepthFrac)`) | `bandProxy` | D-slot-backed | ″ |
| `uBandAMid` | `P.aMid` (`resolveParams`) | `bandProxy` | named-derivation | ″ |
| `uBandS2` | `P.s2` (`wardS2(obliquity)`) | `bandProxy` (env) | named-derivation | ″ |
| `uBandDeflectScale` | `0.5·P.contrast/(P.aEq+P.aMid·P.envMax)` | `bandProxy` | named-derivation | ″ |
| `uAtmoInk` | boldness dial (default 1.0; GUI override) | `dWake` + `dAdvect` | declared-frozen-w/-named-deriver (future: convective-vigor→ink deriver) | new term, mask/count-gated |
| `uInkStretch` | anisotropy (default ~3.5; GUI) | `dAdvect` | declared-frozen-w/-named-deriver | ″ |
| `uBandRough` | `drawBandRoughness(regime, macroSeed)` on `bandFlow:rough` (GUI override) | slice-J edge term | named-derivation (new disjoint stream) | new term, mask-gated; append-only stream |

**`GOLDEN_BANDFIELD_HASH` proof:** all proxy uniforms are READ from `bake.params` and CONSUMED only in
the new `dBand` term; `bakeClimateE5Attributes`/`writeClimateE5Sphere`/`resolveParams`/`jetProfile` are
unedited → the frozen-bundle golden path is byte-identical. **`GOLDEN_STORM_MASK_HASH` + phase-bank proof:**
`storm-e.js` gets NO new alea draw and NO edit to `stormMaskAt`/`resolveStormE`/`resolvePole` → mask +
phase byte-identical; `#4`/`#5`/`#8` read unchanged fields. The `bandFlow:rough` stream is disjoint from
every `stormE:*`/`climateE5:*`/`giantD:*` stream → existing draw orders undisturbed.

GLSL consts (from `PHYS`, no uniform): `AEQ=0.6`, `PHI_EQ=0.35`, `WARD_GAIN=0.8`, `ENV_BASE=1.0`;
`INK_FREQ`, `FOLD_K`, `FOLD_FREQ`, `ROUGH_FREQ`, `ROUGH_AMP`, `ROUGH_BELT`, `ROUGH_EDGE`, `WAKE_*` (§3.2/§4,
calibration-pinned).

**WHERE the uniform DECLARATIONS live — HEIGHT_GLSL, NOT the lab wrapper (golden-lens must-fix #1).** Every
new uniform CONSUMED inside `zonalBandCol` (all 9: the 6 proxy + `uAtmoInk`/`uInkStretch`/`uBandRough`) MUST
get its `uniform …;` declaration in the **storm/band section of `planet-lod-height.glsl.js`** — mirroring
`uniform float uBandWarp;` (height `zonalBandCol` band-uniform block) and the slice-J `uBandRough decl`.
Reason: `planet-lod-height.glsl.js` exports one monolithic `HEIGHT_GLSL` compiled into TWO materials — the
lab planet material AND the river-router `HEIGHT_FRAG = HEIGHT_GLSL + ROUTER_MAIN` (`planet-lod-rivers.js`).
The router never CALLS `zonalBandCol`, but GLSL compiles the whole function body, so any uniform it
references must be declared in `HEIGHT_GLSL` or the router material **link-fails with "undeclared
identifier."** Do NOT mirror the *varying* pattern (`varying float vBand;` lives in the lab wrapper because
"HEIGHT_GLSL stays varying-agnostic" for router-sharing) and do NOT declare them only in
`planet-lod-uniforms.js` (the JS value file — three.js does NOT auto-inject those into GLSL). The
`ws4-grain-scarp-wire.test.js` precedent asserts exactly this for the grain uniforms; NO existing test
asserts it for the *band* uniforms, so the failure would surface at RUNTIME in the router material — see the
§6.0/§8 router-compile live check.

---

## 6. LAB-UI INTEGRATION

**No `*Enabled` keys, no new FEATURES row, no new PROV province.** The three GUI controls are **value
sliders** (driver overrides), registered as diagnostic/override sliders in the existing `fWorldEngine`
storm/band folders — exactly the derive-not-freeze D-slot-slider precedent (the `planet-archetypes`
drift guard scrapes only `/\.add\(state, '(\w+Enabled)'\)/` checkbox keys → value sliders are invisible to
it, so AC-0 taxonomy-registration for these is a **manual diff-audit note**: "value-slider override, not a
gated feature — no FEATURES/PROVINCES row; terms live inside the already-registered `PROV_BANDS`/
`PROV_GREATSPOT`").

- **`uAtmoInk`** — slider **"Ink / flow boldness"** in the **band (F24/F25)** folder, range **0..2**,
  default **1.0** (bold). This is Max's UAT tame-down dial.
- **`uInkStretch`** — slider **"Ink stretch (anisotropy)"**, band folder, range 1..6, default ~3.5.
- **`uBandRough`** — slider **"Band edge roughness"** in the band folder, range 0..2; its VALUE is
  re-drawn per seed by `drawBandRoughness` on every `reseedGiant` **UNLESS the slider is touched** (the
  `_driverTouched` override-flag gate — §4.3), in which case the manual value persists across reseeds until
  `resetDriverOverrides`.

Provenance: `.we-summary` F24–F31 writer-tags are UNAFFECTED (these are overrides/values on existing
writer-tagged features, not new features). Export site: inside `rebakeE5Bands`, right after the `aBand`
set, read `bake.params` → set the six proxy uniforms (every reseed re-exports them) + re-draw+export
`uBandRough` when untouched (§4.3). The boldness/stretch sliders write their uniforms directly on `.onChange`
(no reseed needed).

---

## 7. SLICE DECOMPOSITION (three slices; ordered for maximal independent verifiability)

| Slice | Ships | Fence surface | Gate |
|---|---|---|---|
| **J — jaggedness** (FIRST) | slice-J edge term (`cyc` belt/zone base + `wShear` edge boost); `uBandRough` + `bandFlow:rough` stream; `bandRoughness`/`drawBandRoughness` mirrors | `planet-lod-height.glsl.js` (`zonalBandCol` edge term + **`uBandRough` `uniform` decl IN HEIGHT_GLSL**); `planet-lod-uniforms.js` (`uBandRough` value); NEW `band-flow.js` (roughness only) + NEW `tests/worldengine-base-band-flow.test.js`; lab (roughness slider + export + touched-flag override) | AC-0, AC-JAG, AC-ZERO-CLOBBER |
| **K — ink-in-water** (SECOND — lands the shared proxy) | proxy uniforms + `bandProxy` GLSL; the `dBand` term; `dAdvect`; `uAtmoInk`/`uInkStretch`; `bandProxy`/`advectDisplacement` mirrors + parity | `planet-lod-height.glsl.js` (`bandProxy` fn + `dBand`/`dAdvect` in `zonalBandCol` + `zonalBandCol` 7th param `Nraw` + **all 8 K-uniform `uniform` decls IN HEIGHT_GLSL** — 6 proxy + 2 ink); `planet-lod-lab.html` (call-site `, N`; proxy-uniform export; ink sliders); `planet-lod-uniforms.js` (6 proxy + 2 ink uniform VALUES); `band-flow.js` (proxy/advect) + its test | AC-0, AC-ADVECT, AC-ZERO-CLOBBER, AC-LIVE(partial) |
| **I — interaction** (THIRD — the live headline) | `dWake` (bow + downstream cone/meander); downstream sign from `bandProxy(latC)` (needs K's proxy); reinforcement of `stormColTerms`/`stormSwirl` if live A/B needs it | `planet-lod-height.glsl.js` (`dWake` in `zonalBandCol`, reads `uStorm*` + `bandProxy`); `band-flow.js` `stormBandDrag` mirror + wake-reach floor + perceptual bow/wake floor | AC-0, AC-INTERACT, AC-LIVE, AC-ZERO-CLOBBER |

**Order rationale (which first + why):**
1. **J first** — its acceptance (AC-JAG) is **fully headless** and depends on NOTHING new but `aShear`
   (already baked) + the disjoint roughness stream. It is the safe independent landing (derive-not-freeze
   slice-1 precedent: ships band-edge variety even if K/I slip) and touches no proxy machinery.
2. **K second** — it lands the **shared** proxy + `dBand` infra behind **headless** gates (the
   `bandProxy↔aBand` parity floor + AC-ADVECT anisotropy on the CPU mirror), so the riskiest shared
   mechanism is validated WITHOUT the GPU. `dAdvect` renders deck-wide (mask-gated), so K's live check is
   meaningful on its own.
3. **I third** — it adds ONLY `dWake` on top of K's proven `dBand`, and its acceptance (AC-INTERACT) is
   the one **live-only** pixel-diff. The slice that must be judged live goes last, riding validated infra.

**Re-scope gate:** if any slice balloons past a coherent unit (e.g. `dWake` needs a real per-band flow
field, or the proxy can't hit parity), split — do not grow silently. J alone is shippable value.

### 6.0 Calibration script — RUN BEFORE shader coding (`tools/atmo-expression-calibrate.mjs`)

**Two-phase pin: headless CANDIDATES → live READ-GATE → freeze (fluid-lens must-fixes #1/#4).** The headless
script produces CANDIDATE ranges from the numeric distributions; the final constants are frozen only AFTER a
live A/B visual read-gate confirms the read (numbers alone re-run the V-α.1 trap — "passes the ratio,
invisible on screen").

**Phase A — headless (`tools/atmo-expression-calibrate.mjs`).** Precedent: `tools/giant-drivers-calibrate.mjs`.
Imports the `band-flow.js` mirrors + `resolveParams`; over `SWEEP_SEEDS × {Jovian, Saturnian,
Neptunian(+Sub-Neptune)}`, prints candidate ranges + the AC assertion bands:
- **`bandProxy` parity** — max `|bandProxy(lat,P) − aBand(lat)|` across a latitude sweep (target `< 1e-3`;
  confirms the 6-uniform proxy reproduces `wBand`).
- **AC-ADVECT anisotropy** — the `L_east/L_north` distribution → pins `uInkStretch` + `INK_FREQ` + the
  assertion band; confirms the isotropic null ≈ 1.0. ALSO reports peak `|dLat|`/`|dBand|` (the perceptual
  FLOOR, §3.3) so the amplitude — not only the ratio — is gated.
- **Wake reach + bow AMPLITUDE** — the downstream `|dLat|` fall-off of `stormBandDrag` → pins
  `WAKE_LEN/WID/BOW/AMP/K` so the deflection exceeds threshold past `2.6·R` (reach ~`5–6·R`) AND the
  near-storm bow peak ≥ the reading band-width fraction (perceptual floor, §2.1) — not merely diff-detectable.
- **Jaggedness (belt-CENTER vs zone-CENTER)** — the `roughness(beltCenter)/roughness(zoneCenter)` split
  (driven by `ROUGH_BELT·cyc`, both centers at `wShear≈0`) + the `uBandRough` per-seed spread → pins
  `ROUGH_AMP/FREQ`, `ROUGH_BELT/ROUGH_EDGE`, `ROUGH_MEAN/SPREAD`, and the AC-JAG band.
- **Boldness** — the peak `dLat` (in band-widths) at `uAtmoInk=1` → confirms "bold" (~0.2–0.4 band-widths)
  yet tameable to subtle at ~0.5.
It writes NO source; the candidate constants are set from its measured output (measure-before-pin).

**Phase B — live A/B visual read-gate (before the constants freeze; working-Claude drives `:5178`).** Render
an A/B strip at candidate amplitudes (uAtmoInk∈{0.5,1.0,1.5}; ink stretch on/off; jag on/off; storm on/off)
on a pinned Jovian seed+camera, and EYEBALL that each effect READS: tendrils read as directional flow (not
grain), the storm bow + wake read around/downstream of the storm, belts read rougher than zones. Adjust
`INK_AMP`/`WAKE_*`/`FOLD_K`/`ROUGH_*` up if any is sub-perceptual, then freeze — and set the AC perceptual
floors (§3.3/§2.1/AC-INTERACT) to the confirmed reading amplitude so a later shrink FAILS headless.
**Router-compile check (golden-lens must-fix #1):** in the same live pass, confirm the river-router material
(`HEIGHT_FRAG = HEIGHT_GLSL + ROUTER_MAIN`) compiles with ZERO shader errors after the band edits — open a
page that instantiates it (`rivers-terrain-lab.html` or confirm the planet-lab loads the router material)
and check the console; the planet-lab `zonalBandCol` path alone does NOT exercise `HEIGHT_FRAG`.

---

## 8. AC MAP — each contract AC → the concrete closer

| AC | Layer | Closed by |
|---|---|---|
| **AC-0** (spine conformance) | unit + manual | `planet-archetypes.test.js` (21) + `storm-e`/`giant-drivers` suites GREEN; **manual diff audit, WRITTEN as a BUILD-NOTES artifact** (so verify-workstream's AC-0 audit has evidence — golden-lens minor): every new uniform names its deriver (§5 table) + DAG consumer; the three value sliders are logged verbatim as *"value-slider override, rides `PROV_BANDS`/`PROV_GREATSPOT`, adds NO `*Enabled` key, no FEATURES/PROVINCES row"* (drift guard is blind to non-`*Enabled` keys → this is manual, not automated); `bandFlow:rough` disjoint from every `stormE:*`/`climateE5:*`/`giantD:*` stream |
| **AC-ADVECT** (directional, static, per-seed, bold) | unit (headless) | `tests/worldengine-base-band-flow.test.js`: `advectDisplacement` anisotropy `L_east/L_north` in the calibrated band on every seed; **peak `|dLat|`/`|dBand|` amplitude floor keyed to band-width (§3.3) — ratio alone can pass sub-perceptual**; isotropic null rejected; repeat-seed byte-equal; static-source grep (DIFF-SCOPED to the added lines — no `uTime`/`ph0`/`ph1`/`r0`/`r1`) |
| **AC-INTERACT** (storms deflect bands + wake past rim) | integration (LIVE) | live drive `:5178` (fresh chrome-devtools context): Jovian PINNED seed+camera, A/B storm enabled/disabled. **The A/B diff isolates `dWake` exactly** — `dAdvect`+jag are storm-COUNT-independent (mask-gated), so (storms-on)−(storms-off) subtracts them out; the diff IS the wake. Assert band-boundary deflection around the storm AND diff in a **pinned downstream annulus (e.g. 3R–6R, past the old `2.6·R` reach)** at a **minimum magnitude floor** (perceptual, not a few sub-threshold px); zero new console errors; agent pages closed after |
| **AC-JAG** (per-band + per-seed roughness) | unit (headless) | `band-flow.test.js`: `bandRoughness(beltCENTER)/(zoneCENTER) >` the calibrated ratio band at every fixed seed (both centers `wShear≈0` — the split proves belt/zone via `cyc`, NOT a boundary-vs-center tautology); over Jovian/Saturnian/Neptunian; `uBandRough` set-size varies across `SWEEP_SEEDS`; same-seed byte-equal |
| **AC-LIVE** (full circuit reads live via real GUI reseed) | integration (LIVE) | live drive `:5178`: New-planet button + macro-seed slider across ≥3 regimes × multiple seeds show all three effects; state parity at clicked seed (reseed re-runs the writers — derive-not-freeze wiring intact); screenshots → `evidence/`; console clean |
| **AC-ZERO-CLOBBER** (nothing locked moves) | unit | full suite from the worktree dir: `GOLDEN_BANDFIELD_HASH -1329854088` + `GOLDEN_STORM_MASK_HASH 568852786` unchanged & NOT re-captured; **OFF-GATE byte-identity = NON-GAS decks** (`uBandStrength`/mask = 0 ⇒ ALL new terms 0 ⇒ render byte-equal); `[envelope]` one-attribute guard green; fixtures git-diff-empty; fence-diff audit (zero relief/dispatch edits); failed-SET not grown. **NOTE (fluid-lens): a GAS deck with discrete storms toggled OFF is NOT the off-gate identity** — `dAdvect`+jag are mask-gated (baseline `MASK_FLOOR 0.06`+shear), so they persist on a gas deck by design (exactly like the existing V-α.1 filament); only `dWake` is count-gated to 0. There is no GPU render byte-test (goldens are CPU), so this is a live-verifier expectation, not an automated failure — do NOT expect a storms-off gas giant to match the pre-increment render |
| **AC-UAT** (Max's holistic gate) | uat | Max drives `:5178` solo; `deferred-to-max`, never agent-PASSed; `uAtmoInk` is his tame-down dial |

**Gate bundle (run FROM `~/projects/well-dipper-atmo` at EVERY slice landing):** the 8-suite fence —
`climate-e5` (17, golden `-1329854088`) · `emission-e` (12, re-asserts the same) · `v2-0-byte-identity`
(83 · 75 goldens NEVER re-captured) · `worldengine-lid-byte-anchors` · `worldengine-e1-shadow-audit` ·
`planet-archetypes` (21) · `worldengine-v2-3-dispatch-oracle` (25) · `storm-e` (golden `568852786`, alea
guard, `[envelope]`) — PLUS the new `worldengine-base-band-flow.test.js`. **The 8-suite is a FAST fence, NOT
exhaustive of the new uniforms' consumers (golden-lens minor):** `ws4-uniforms.test.js` / `ws4-lab-gui.test.js`
read `planet-lod-uniforms.js` but assert only specific uniform VALUES (no fixed-set/count/snapshot) so the
9 new uniforms can't break them — the **full-suite** gate below is the real net; don't treat the 8-suite as
covering the uniform file. **Full suite:** failed-SET = 4 failed / 7 files (re-measure at build commit; must
not grow). **Static-source grep — DIFF-SCOPED, not whole-file (golden-lens minor):** grep only the ADDED
lines (`git diff`) for `uTime|ph0|ph1|r0|r1` → zero hits; a whole-file grep FALSE-TRIPS because `HEIGHT_GLSL`
legitimately contains `uTime`/`ph0`/`ph1`/`r0`/`r1` in the LEGACY jets-on path INSIDE `zonalBandCol`
(F25 jets — not our terms). The §8 live two-frame check is the backstop the grep can't provide.
**Per-commit fence audit:** `git show --stat <sha>` against §7; exclude not-ours dirty files
(`CameraChoreographer.js`, `LabMode.js`).

**Live gates:** Max-started dev server (`npm run dev -- --port 5178`; lab
`http://localhost:5178/well-dipper/planet-lod-lab.html`); liveness via chrome-devtools `list_pages` (NEVER
sandbox-curl); screenshots → `evidence/`; **all agent pages closed after** (window hygiene). K carries an
extra live check: two frames at different `uTime` with storms on must be pixel-identical in the advected
region (the F1 static-invariance frame check the grep can't catch). **Isolation matrix (state the term
being read at each live check — fluid-lens minor):** `uAtmoInk=0` ⇒ jag-only; storms-off (gas deck) ⇒
`dAdvect`+jag only (`dWake=0`); (storms-on)−(storms-off) ⇒ `dWake` alone; `uBandRough=0` ⇒ no jag. (Optional:
split `uAtmoInk`→`uWakeInk`/`uAdvectInk` for a cleaner live A/B — adjudicable.) **Router-compile check:** after
the band edits, confirm `HEIGHT_FRAG` (river-router material) compiles with zero shader errors (§6.0 Phase B).
**Perf note (fluid-lens minor):** `dAdvect` adds ~3 `bandWarpField` calls (each = 2× `fbmd`@4 octaves), slice-J
one, `dWake` an 8-storm loop — roughly doubling `zonalBandCol`'s FBM cost per fragment; fine for the lab,
noted for budget. AC-UAT is Max's alone.

---

## 9. DEVIATION TRIGGERS

**HARD STOPS (any one ⇒ the build is wrong; STOP, do not commit, re-scope):**
- Either golden hash (`GOLDEN_BANDFIELD_HASH -1329854088` / `GOLDEN_STORM_MASK_HASH 568852786`) MOVES, or
  any byte fixture is re-captured.
- Any `uTime` (or `ph0`/`ph1`/`r0`/`r1` animated-warp path) appears in ANY NEW storm/band/ink/roughness
  term (static-place-once breach — the grounding brief's non-negotiable program rule). **Test the
  DIFF-scoped grep** (added lines only) — a whole-file grep false-trips on the legacy F25 jets path, which
  legitimately uses `uTime`/`ph0`/`ph1`/`r0`/`r1` inside `zonalBandCol`.
- Any `*Enabled` key is added (AC-0 breach; new controls are value overrides only).
- Any edit OUTSIDE the atmo fence: relief/dispatch (`planet-lod-rivers.js`, `lidResponse.js`,
  `e1Regime.js`, plate/shell/magmatism writers), `climate-e5.js` (protects the band golden),
  `src/auto/CameraChoreographer.js`, `src/debug/LabMode.js`, or ANY second new baked attribute
  (`[envelope]` breach). `band-flow.js` may import `climate-e5` READ-ONLY only.
- Off-gate render is NOT byte-identical, OR the aStorm mask contract (`[0,1]`, `MASK_FLOOR 0.06` +
  shear-correlated, off-gate all-zero) / phase bank / regime reads (Jovian primary spot, Saturn
  hexagon-likely, Uranian mute + obliquity-85 gate, HJ suppression) change. **Precise off-gate identity
  (fluid-lens):** OFF-GATE = a NON-GAS deck (`uBandStrength`/mask = 0) ⇒ ALL new terms 0 ⇒ byte-equal. A GAS
  deck with discrete storms TOGGLED OFF is NOT the off-gate identity — `dAdvect`+jag are mask-gated (like the
  existing filament) and persist by design; only `dWake` count-gates to 0. Do not treat a storms-off gas
  giant differing from pre-increment as a breach.
- The derive-not-freeze reseed wiring (New-planet + macro-seed slider → `rebakeE5Bands` →
  `deriveGiantDrivers` → `resolveStormE`) stops re-running the writers.

**ADJUDICABLE deviations (proceed within the re-scope gate; record in BUILD-NOTES, surface to Max at
UAT):**
- Final magnitudes of `uAtmoInk`/`uInkStretch`/`WAKE_*`/`INK_*`/`ROUGH_*` (calibration-pinned; the whole
  point of §6.0 — measured, not guessed).
- The exact AC-ADVECT anisotropy band, AC-JAG ratio band, and wake documented-reach multiple (set from
  the calibration distributions, not a priori — the derive-not-freeze measure-before-pin pattern).
- The AC-ADVECT anisotropy estimator (autocorrelation first-zero vs RMS-gradient ratio) — pick at
  calibration, document the choice.
- Whether the existing V-α.1 filament coefficient (`uBandWarp*0.14`) is reduced once `dAdvect` carries the
  ink (a taste tune at live A/B; keep both, re-weight via `uAtmoInk`/`uBandWarp` — no deletion needed).
- `dWake`'s downstream direction is now DERIVED from `sign(bandProxy(latC) - 0.5)` (a §2.1 build
  requirement, fluid-lens must-fix #5 — no longer "align with the GRS west cone"). What stays adjudicable:
  the bow WIDTH / cone-length tuning (calibration-pinned) and whether a further per-vertex (not per-storm)
  local-jet refinement is worth it (default: no — the storm-latitude flow sign is the coherent choice).
- Whether `stormSwirl`/`stormColTerms` need a light reinforcement pass in slice I (default: no — `dBand`
  carries the primary deflection; the swirl's residual `trueLat`/warp effect is harmless secondary).

---

*Planner-authored 2026-07-17 against `2ade359` (post-L1-merge). On sign-off, working-Claude runs the §6.0
calibration FIRST, then builds slices J → K → I via opus-pinned workflows (≤2–3 concurrent agents, WSL OOM
rule), staggered against any ground-track workflow. `verify-workstream` audits AC-0/AC-ADVECT/AC-JAG/
AC-ZERO-CLOBBER headless; working-Claude drives AC-INTERACT/AC-LIVE live; AC-UAT is Max's gate alone.*

---

## 10. Lens log — adversarial review resolution (revised 2026-07-17 against `2ade359`)

Two adversarial lenses reviewed this plan. Every anchor below was re-verified in code this session before
folding. **6 must-fixes folded, 0 rejected; 10 minors folded, 1 no-change (lens confirmed the plan correct).**

### GOLDEN/CONTRACT-SAFETY lens (verdict NEEDS-FIX → resolved)
- **MUST-FIX 1 — 8 slice-K uniforms must be declared INSIDE `HEIGHT_GLSL`, not the lab wrapper / JS value
  file, or the river-router material link-fails.** → **[FOLDED]** New §5 block "WHERE the uniform
  DECLARATIONS live"; §7 slice-K/J fence rows now spell out "all N K-uniform `uniform` decls IN
  HEIGHT_GLSL"; added a router-compile live check to §6.0 Phase B + §8 Live gates. *Verified:*
  `HEIGHT_FRAG = HEIGHT_GLSL + ROUTER_MAIN` (`planet-lod-rivers.js`), band uniforms live in HEIGHT_GLSL
  (`uniform float uBandWarp;`), varyings deliberately in the lab wrapper ("HEIGHT_GLSL stays
  varying-agnostic"), `ws4-grain-scarp-wire.test.js` asserts the same for the grain uniforms.
- **MINOR 1 — static-source no-`uTime` grep must be diff-scoped, not whole-file.** → **[FOLDED]** §3.3,
  §8 gate bundle, and §9 hard-stop now say DIFF-SCOPED (added lines only). *Verified:* the legacy F25 jets
  path uses `uTime`/`ph0`/`ph1`/`r0`/`r1` INSIDE `zonalBandCol` — a whole-file grep false-trips.
- **MINOR 2 — 8-suite fence omits `ws4-uniforms`/`ws4-lab-gui` (uniform-file consumers).** → **[FOLDED]**
  §8 note: the 8-suite is a fast fence; the full-suite gate is the real net for the 9 new uniforms (those two
  suites assert only specific values, no fixed-set/snapshot).
- **MINOR 3 — `uBandRough` re-draw must carry the D-slot override flag or a manual slider is re-clobbered
  on the next knob-drag.** → **[FOLDED]** §4.3 override-flag pin (reuse `_driverTouched` + `resetDriverOverrides`);
  §6 redraw note made touched-gated. *Verified:* `_driverTouched` Set + `_driverAbMode` pattern exists in
  `planet-lod-lab.html`.
- **MINOR 4 — AC-0 value-slider registration must be a WRITTEN BUILD-NOTES artifact.** → **[FOLDED]** §8
  AC-0 row now specifies the verbatim note verify-workstream's AC-0 audit consumes.

### FLUID-MECHANISM lens (verdict NEEDS-FIX → resolved)
- **MUST-FIX 1 — verification is numeric-only; it cannot distinguish "reads as flow" from "anisotropic but
  invisible" (the V-α.1 trap).** → **[FOLDED]** §6.0 split into Phase A (headless candidates) → Phase B
  (live A/B visual read-gate) → freeze; AC-ADVECT (§3.3) gains a peak `|dLat|`/`|dBand|` amplitude floor
  keyed to band-width so a shrink FAILS headless. *Verified:* the pinned `INK_AMP≈0.055`→`dBand≈0.14`
  matches the V-α.1 magnitude Max called "not rendered."
- **MUST-FIX 2 — `roughness ∝ wShear` makes every band identical (rough edges/smooth center), NOT belts
  rougher than zones; AC-JAG's boundary-vs-center test is a tautology.** → **[FOLDED]** §4.1/§4.2 re-key on
  the belt/zone discriminator `cyc = clamp((0.5-wBand)*2)` (base) + `wShear` (edge boost); §4.4/AC-JAG
  rewritten to belt-CENTER vs zone-CENTER (both `wShear≈0`). *Verified:* `aShear = clamp01(|jetShear|/sp)` is
  a derivative (peaks at boundaries, ≈0 at extrema); the existing filament already uses `cyclonic`/`ffr`.
- **MUST-FIX 3 — the `roll` term is a meridional ripple, not roll-up; a meridional-resample mechanism cannot
  produce billows; the plan overclaims "Kelvin-Helmholtz billows."** → **[FOLDED]** renamed `roll`→`fold`
  (`CURL_K`/`ROLL_FREQ`→`FOLD_K`/`FOLD_FREQ`) as a shear-interface breaking-wave fold; dropped the billow/KH
  claim; added a §3.1 mechanism-boundary note (true vortex roll-up needs a 2D-advected scalar — deferred,
  surfaced to Max at UAT, re-scope gate). *Verified:* `bandProxy` is a function of latitude only ⇒ contours
  can fold in latitude but not spiral into a closed vortex.
- **MUST-FIX 4 — `dWake` bow/wake sub-read at pinned constants; calibration pins reach, not perceptual
  amplitude.** → **[FOLDED]** §2.1 + §6.0 add a perceptual bow floor (≥ ~0.25 band-width) and a wake ridge
  floor (≥ ~3–4 px); AC-INTERACT gains a magnitude floor. *Verified:* `SPOT_R_MIN 0.18 + SPAN 0.12` ⇒ bow
  ≈ 2–3 px, far wake sub-pixel at the starting constants.
- **MUST-FIX 5 — wake direction hard-coded west; wrong for storms in eastward jets; flow sign is now
  derivable.** → **[FOLDED]** §2.1 derives downstream from `sign(bandProxy(latC) - 0.5)`; promoted from §9
  adjudicable to a build requirement; up/downstream labeling reconciled with the GRS term; §7 slice-I notes
  the K-proxy dependency (ordering already K→I). *Verified:* `bandNorm-0.5 ∝ jetProfile` (same sign).
- **MINOR — `dAdvect` is off-GATE-zero (non-gas) but NOT off-STORM-zero on a gas deck.** → **[FOLDED]** §1
  now states two precise identities; §9 hard-stop + AC-ZERO-CLOBBER row clarified; the live verifier must not
  expect a storms-off gas giant to match pre-increment.
- **MINOR — `dAdvect` direction handling is actually FINE (axis-symmetric stretch; jet sign irrelevant).**
  → **[NO-CHANGE — lens confirmed the plan correct]** the sign issue lives only in `dWake` (must-fix 5).
- **MINOR — `eF = normalize(cross(up,Nraw))` singular at the poles.** → **[FOLDED]** §3.1 pole guard
  (`/max(length,1e-3)`), term self-fades as `e→0`.
- **MINOR — per-slice isolation undocumented.** → **[FOLDED]** §8 Live gates isolation matrix (`uAtmoInk=0`
  ⇒ jag; storms-off ⇒ `dAdvect`+jag; on−off ⇒ `dWake`); AC-INTERACT states the (on−off)=`dWake` isolation.
- **MINOR — AC-INTERACT falsifier under-specified.** → **[FOLDED]** AC-INTERACT pins a downstream annulus
  (3R–6R) + a minimum magnitude floor + pinned seed/camera.
- **MINOR — perf (`dAdvect` roughly doubles `zonalBandCol` FBM cost).** → **[FOLDED]** §8 perf note.

*Reviser cross-check: after folding, re-read the full plan for composition order — the belt/zone `cyc` fix
(J) touches no proxy machinery; the `dWake` flow-sign fix (I) depends on K's `bandProxy` (order already
K→I); the read-gate/floor fixes strengthen ACs without changing slice fences. No fold invalidated another
slice. Constants renamed globally (`CURL_K`/`ROLL_FREQ`→`FOLD_K`/`FOLD_FREQ`; added `ROUGH_BELT`/`ROUGH_EDGE`)
in §3.2/§5. Stale intros in §4 "What it builds" + §6 redraw note reconciled to the corrected mechanism.*
