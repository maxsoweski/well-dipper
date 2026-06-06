# Stage-B Research — Bands & Storms + Thermal Emission

**Date:** 2026-06-06 · **Domain:** the visible "surface" of gas worlds (zonal
banding, jets, weather bands, vortices/storms, lightning) **plus** the F-thermal
family (dayside hotspot, nightside glow) — the hot-jupiter / tidally-locked
emission side.

**Frame (inherited, non-negotiable):**
- Ground-up NEW system that builds **up** from the Stage-A 1-LOD retro base.
  **No parity-with-old** — even though F24 banding is `[current]`, this enriches
  it onto the new analytic-derivative base, it does not reproduce the old
  `sin(lat*3.5)` palette.
- **No `planetType` branch.** Everything derives from DRIVERS via semantic
  uniforms. "Gas giant" / "hot jupiter" / "ice giant" = driver-bundle presets.
- **Single shader** behind `qualityTier` + `lodRamp`; cheap fallback reachable,
  no compiled variants yet.
- **Retro envelope:** `posterizeLevels` 6→16 + Bayer/IGN dither; emissive terms
  may bypass the quantizer (the composite-split path from Stage A §2.C).

Reuses the vocabulary of `RESEARCH_high-lod-planet-shaders-2026-06-05.md`
(analytic-deriv `noised()`, domain warp, two-phase flow-map advection, emissive
bypass, `lodRamp` octave ramp, fwidth clamp).

---

## 1. Scope

| Kind | IDs |
|---|---|
| **Features (L2)** | **F24** zonal belts & zones · **F25** jets & shear turbulence · **F26** latitude weather bands (terrestrial) · **F27** great-spot anticyclone · **F28** storm clusters / oval trains · **F29** polar vortex (incl. Saturn hexagon) · **F30** lightning · **F32** dayside thermal hotspot · **F33** nightside thermal glow |
| **Processes (L1)** | **P16** zonal banding · **P17** vortex/storm formation · **P20** meridional circulation · **P21** tidally-locked circulation (thermal side) |
| **Drivers (L0)** | **D8** rotation (banding/Coriolis/jets) · **D5** atmosphere density/depth · **D1** T_eq (heating + thermal emission) · **D7** tidal-lock (hot-jupiter thermal, eyeball) · D3 obliquity (terrestrial ITCZ migration) |

### Cross-domain seams — DEFER and note the handoff

- **P21 (tidally-locked circulation) splits THREE ways.** This domain owns the
  **THERMAL emission (F32/F33)** and the **gas-world banding/storms**. The
  **eyeball substellar CLOUD (F31f)** — the bright "pupil" standing cloud +
  terminator cloud ring — belongs to **CLOUDS/HAZE**. The **limb/terminator
  OPTICS** (rim glow, reddened terminator, asymmetric limb) belong to
  **OPTICAL**. Coordinate so the three don't each implement a substellar
  `angDist` term independently — they should share one `vSubstellarAngle`
  varying (proposed in §3).
- **Magma-ocean dayside (F41, lava/eyeball) terminator** is owned by **EXOTIC**.
  Seam: our F32 dayside thermal-emission ramp must **hand off** at the molten
  surface — where T_eq is extreme enough that the dayside is a lava sea, the
  emissive term is the same blackbody ramp but the *surface* underneath is
  EXOTIC's magma shader, not our gas band field. Agree a shared
  `emissiveBlackbody(tempK)` helper so both domains read the same color curve.
- **Terrestrial F26 (latitude weather bands)** overlaps **CLOUDS/HAZE**: F26 is
  the *circulation-driven latitude structure* (Hadley/Ferrel/ITCZ zonation) that
  *biases where clouds form*; the cloud *deck rendering* is CLOUDS. We own the
  latitude-bias function; CLOUDS consumes it. The existing terrestrial code
  already couples these (`Planet.js:587-616`) — propose splitting the bias
  function out as a shared uniform-driven term.
- **Gas-giant clouds-as-relief**: the band field IS the cloud deck for gas
  worlds (F31b). We own the band/storm structure; whether it gets pushed into
  the heightfield for self-shadowing (clouds-as-relief, research §3.2) is a
  CLOUDS-domain compositing call. Flag the shared `bandHeight` output.

---

## 2. Per-feature research

Shared assumptions for every gas feature below: the Stage-A `noised()` analytic
base, object-local `pos` sampling (never `vWorldPos` into the noise — precision),
`lodRamp` driving octave count `mix(4,9,lodRamp)`, fwidth clamp on trailing
octaves, and the composite-split envelope. **Latitude** throughout =
`pos.y / planetRadius` (object-space, normalized to ±1), NOT `pos.y * noiseScale`
as the old code does — the old form ties band count to noise frequency, which we
want decoupled (band count comes from D8, see §2/F24b).

### F24 — Zonal belts & zones (P16; D8, D5, interior heat, D1)

**(a) Render HOW.** Latitude-organized banded FBM with domain warp at band edges
— the proven Whigham / Paléologue stack
([Paléologue](https://medium.com/@barth_29567/procedural-gas-giants-f2a61bc6bd97),
[Whigham](http://johnwhigham.blogspot.com/2011/11/gas-giants.html)):

1. **Vertical-stretch latitude.** `vec3 q = pos; q.y *= bandStretch;` —
   compressing vertically packs the noise into horizontal streaks. Paléologue
   uses `*= 2.5`; we make `bandStretch` a uniform (driven by D8, below).
2. **Domain warp the band coordinate** so edges scallop/festoon instead of being
   straight lines (this is F25's festoon/scallop turbulence, same mechanism):
   ```glsl
   float warp = fbm(q * warpFreq) * warpStrength;     // warpStrength ~2.0
   float bandCoord = latitude * bandScale + warp;     // bandScale from D8
   ```
   Paléologue samples color at `latitude + warp` and `latitude - warp` (two
   decisions) and blends — gives the soft double-edged band look. With the new
   `noised()` base we get the warp gradient free, which we reuse for band-edge
   normal perturbation (clouds-as-relief handoff).
3. **Band profile.** Instead of the old `sin(lat*3.5)+sin(lat*7)+...` harmonic
   stack (which hard-codes 3 fixed bands), drive bands through a **periodic ramp
   of `bandCoord`** so the count is continuous: `fract(bandCoord)` indexed into
   a small palette ramp, OR `sin(bandCoord * TAU)` for a smooth belt/zone
   alternation. Belt-vs-zone (dark sinking vs bright rising) =
   `smoothstep` around the ramp midpoint, contrast scaled by `bandContrast`.
4. **Three variants** (driver-bundle, NOT type branch):
   - **High-contrast many-banded (Jupiter):** high `bandScale` (many bands),
     high `bandContrast`, full `warpStrength`. Driven by fast D8 + high interior
     heat.
   - **Soft few-banded (Saturn):** low `bandScale`, low `bandContrast`,
     overlaid haze desaturation (CLOUDS handoff).
   - **Bland ice-giant (Neptune/Uranus):** very low `bandScale` (2-3 bands),
     near-zero `bandContrast`, blue-dominant palette, sparse bright methane
     clouds as additive spots (a degenerate storm-spot, see F28).

**(b) Generation path.** D8 (rotation) → P16 → band structure. Physical basis:
faster spin = more, narrower, higher-contrast bands (Coriolis organizes
convection into more zonal jets). `rotationSpeed` is already surfaced at
`PlanetGenerator.js:697`. CPU-side in the generator:
```js
// rotationSpeed is signed; |·| in ~[0.033,0.167] for un-locked, 0 if locked
const spin = Math.abs(d.rotationSpeed);
bandScale    = lerp(4, 18, smoothstep(0.03, 0.17, spin));   // band count
bandContrast = lerp(0.15, 0.85, smoothstep(0.03, 0.17, spin)) * heatFactor;
bandStretch  = 2.0 + bandScale * 0.15;                       // tighter w/ more bands
```
`heatFactor` from interior heat (gas giants have leftover formation heat; proxy
= mass + young age from `surfaceHistory`). D5 (atmosphere depth) modulates how
"thick"/soft the bands read (deep atmosphere → softer, ice-giant-like). Pass
`bandScale`, `bandContrast`, `bandStretch`, `warpStrength`, `warpFreq` as
uniforms (table §3). Shader consumes generically — no type check.

**(c) Envelope.** Banding is high-contrast luminance structure → survives
posterize cleanly at 6 levels (research §3.2 confirms banded FBM `survives`).
The *belt/zone contrast* is the luminance signal the dither preserves; band
*hue* differences get crushed toward the nearest palette level — fine, because
the look reads off contrast not hue. **No bypass needed.** At high
`posterizeLevels` (Option B), switch dither to IGN to avoid the 4×4 grid showing
in the soft ice-giant gradients.

**(d) Quality-scalar fallback.** `qualityTier` low → drop `warpStrength` to 0
(straight bands, no festoon) and cut FBM octaves; the band ramp alone still reads
as a gas giant. This is the cheap mobile path, reachable behind the same
uniforms.

### F25 — Jets & shear turbulence (P16; D8, zonal shear, interior heat)

**(a) Render HOW.** Three sub-effects, all on the band field:
- **Equatorial superrotation jet:** a wider, faster-drifting equatorial band.
  Implement as a latitude-dependent **drift speed** `bandDrift(lat)` that peaks
  at the equator and reverses sign at mid-latitudes (counter-rotating jets):
  `drift = jetProfile(lat) * time` added to `bandCoord` longitude. This is the
  band-flow animation layer (see §5 risk — sphere flow-frame).
- **Counter-rotating shear:** adjacent bands drift opposite directions →
  velocity discontinuity at band edges. The domain-warp at the edge (F24 step 2)
  visually reads as the shear turbulence; amplify warp near `bandDrift` sign
  flips.
- **Festoon / scallop:** the warped band edge itself. Already produced by F24's
  domain warp; F25 is the *parameterization* (warpStrength up near jets).

**(b) Generation path.** Same D8→P16 chain. Jet count and equatorial-jet width
scale with `bandScale`. New uniform `jetStrength` (drift magnitude) ∝ spin.
Sign-alternation pattern is deterministic from band index, so it's stable; the
*drift over time* is the non-deterministic weather layer (Q4 — allowed to differ
across visits).

**(c) Envelope.** Turbulence = high-contrast luminance, survives. The festoon
detail is normal-perturbable (clouds-as-relief) so it reads as shading texture
under dither rather than crushed hue.

**(d) Fallback.** `qualityTier` low → freeze drift (`jetStrength`-animated term
gated by tier), keep static warped edges.

### F26 — Latitude weather bands, terrestrial (P20; D1, D3, D8, D5)

**(a) Render HOW.** This is the Hadley/Ferrel/ITCZ zonation that biases
*terrestrial* cloud formation — already partially in `Planet.js:587-616`. The
mechanism: a **latitude-bias function** with Gaussian lobes at the ITCZ
(equator), storm tracks (~mid-latitude), and polar convergence:
```glsl
float itcz      = exp(-pow(lat        , 2.0) / (2.0*0.1*0.1));      // equatorial wet band
float stormTrk  = exp(-pow(lat - 0.55 , 2.0) / (2.0*0.15*0.15));    // Ferrel storm track
float polar     = smoothstep(0.7, 1.0, abs(lat));
float latBias   = itcz*itczW + stormTrk*trackW + polar*polarW;
```
The ITCZ band **migrates seasonally** with obliquity (D3) — offset the equator
term by `tilt * seasonPhase`. Monsoon = a stronger, more displaced ITCZ.

**(b) Generation path.** D1/D3/D8 → P20 → the `itczW/trackW/polarW` weights +
`itczOffset`. Earth-like circulation strength from D8 (rotation sets the number
of circulation cells: slow rotators → single Hadley cell, fast → multiple). Pass
as uniforms; CLOUDS consumes `latBias` to place cloud density.

**(c) Envelope.** This term modulates *cloud density* (a mask), not color → its
effect is whatever the cloud renderer does. Survives as banded cloud cover.

**(d) Fallback.** Constant `latBias` weights, no seasonal migration.

### F27 — Great-spot anticyclone (P17; single large advected oval)

**(a) Render HOW.** The Great Red Spot = **one large advected oval** — a
degenerate case of the F28 storm system (one big spot). Render as a swirl-mask:
per storm center `c`, with angular radius `r` and aspect `a` (elongated along
latitude):
```glsl
vec2 d = stormLocalCoord(pos, c);     // band-tangent local frame, see §5
d.x /= a;                              // squash to oval (aspect along longitude)
float dist = length(d) / r;
float mask = 1.0 - smoothstep(0.7, 1.0, dist);
// rotational swirl: rotate sample inside the oval (Whigham cone-rotation)
float ang = swirlStrength * (1.0 - dist);   // more rotation toward center
vec2 swirled = rot2D(ang) * d;
// re-sample band field at swirled coord → the spot drags bands into a vortex
```
Color from the stored storm color; the swirl drags the surrounding band field
into the characteristic curl. Whigham's exact trick: *rotation applied around
the cone axis proportional to distance from axis center, scaled by a global
rotational-strength parameter*
([Whigham](http://johnwhigham.blogspot.com/2011/11/gas-giants.html)).

**(b) Generation path.** Reads the EXISTING unwired `storms.spots` (generated at
`PlanetGenerator.js:619-629`). The GRS is just the largest spot
(`size` up to 0.3, `aspect` 1.2–2.5 already generated). **The job is the
uniform carriage** — see §2/F28(b) and §3 (storm-array carriage). D8→P17:
storm count/size already keyed off spin implicitly via the `rng.chance(0.4)`
gate; could tie spot probability to spin explicitly later.

**(c) Envelope.** High-contrast oval (the dark-bruise / warm-red colors are
generated with strong contrast) → survives. The swirl is luminance structure.

**(d) Fallback.** `qualityTier` low → render the oval as a flat masked tint with
no swirl re-sample (cheaper, drops the band-drag).

### F28 — Storm clusters / oval trains (P17; reads `storms.spots`)

**(a) Render HOW.** **Consume the existing generated `storms.spots` array**
(`PlanetGenerator.js:649`). Each spot is `{position[3], size, aspect, color}`.
Three render variants:
- **White-oval train:** several spots strung along one latitude band (the
  generator already places 1–3; a "train" preset would place more along a fixed
  `phi`). Render = loop the spot array, accumulate each as an F27-style swirled
  oval, additively blend.
- **String of pearls:** evenly spaced same-size spots on one band.
- **Convective plume outbreak:** a bright spot with radial bright filaments
  (add `fbm`-modulated rays from center).

**Carriage technique — TWO options, recommend the array-uniform for ≤8 spots:**
- **Option A (recommended, ≤8 spots): flat uniform arrays.** `uniform vec4
  uStormPosSize[8]` (xyz=position, w=size), `uniform vec4 uStormColorAspect[8]`
  (rgb=color, a=aspect... but aspect+color needs 4, so split into
  `uStormColor[8]` vec3 + pack aspect into `uStormPosSize.w` alongside size via
  two arrays, or use `uStormParams[8]` = vec4(size, aspect, swirl, _)). Plus
  `uniform int uStormCount`. Shader loops `for(i<uStormCount && i<8)`. This
  matches the existing `shadowMoonPos[6]` / `shadowPlanetPos[2]` precedent in
  `Planet.js:1071-1074` — the codebase already passes small struct arrays this
  way. **Lowest-friction, deterministic, no texture.**
- **Option B (Whigham, for 100-200 storms): cone cubemap.** Pack storms into a
  128² RGBA cubemap (R,G=axis xy, B=rotation strength, A=radius, sign-bit=axis
  z), sample once per fragment by surface normal
  ([Whigham](http://johnwhigham.blogspot.com/2011/11/gas-giants.html)). O(1)
  regardless of storm count. **Overkill for our 1–3 generated spots** but the
  right path if we ever want Jupiter-density storm fields. Note for Stage C: a
  cubemap bake breaks the "pure shader, no buffers" simplicity — defer unless
  spot counts grow past ~8.

**(b) Generation path.** Data already exists. Generation-side work:
1. In `PlanetGenerator`, the `storms` object is already returned (`:693`).
2. In `Planet.js` material creation (`:1039`), add the storm uniforms (mirror the
   `shadowMoonPos` array pattern), filling from `d.storms?.spots`.
3. Shader loops the array in the gas band path. No type branch — guarded by
   `uStormCount > 0`.
The `position` is already a unit sphere vector (`PlanetGenerator.js:620-624`),
directly comparable to `normalize(pos)`.

**(c) Envelope.** Generated storm colors are deliberately high-contrast
(dark-bruise `*0.4`, warm-red, bright-pale `*1.5+0.15`) → survive posterize.
Convective-plume bright filaments could be pushed to the emissive-bypass channel
if we want them to glow crisply, but default = surface (no bypass).

**(d) Fallback.** `qualityTier` low → cap loop to the largest 1–2 spots, drop
swirl re-sample.

### F29 — Polar vortex incl. Saturn hexagon (P17; reads `polarStorm`)

**(a) Render HOW.** **Consume the existing generated `polarStorm`**
(`PlanetGenerator.js:632-647`): `{sides:5-8, pole:±1, radius:0.12-0.22, color}`.
Three variants:
- **Single cyclonic cap:** a circular masked vortex at the pole with rotational
  swirl (F27 mechanism centered on the pole). `sides`-agnostic round version.
- **Polygonal jet (Saturn hexagon):** an **n-gon SDF mask** at the pole, n =
  `polarStorm.sides`. Use IQ's regular-polygon SDF. A clean regular n-gon
  distance (angle-fold via `atan`):
  ```glsl
  // p = polar-stereographic projected coord around the pole; r = polarStorm.radius
  float sdNgon(vec2 p, float r, float n) {
    float an = 3.1415926/n;
    float a  = mod(atan(p.x, p.y), 2.0*an) - an;   // fold into one wedge
    return cos(an) * (length(p)) - r * cos(a... ); // edge distance
  }
  ```
  Practically, IQ's `sdStar(p, r, n, m)` with large `m` degenerates to a regular
  n-gon, or use the simpler folded form: project the polar region to a 2D plane
  (polar-stereographic from the `pole`-side cap), fold the angle into one of `n`
  wedges, and threshold the radial distance to get a hexagon/pentagon jet
  boundary. Inside-edge = the prograde jet (bright line);
  interior = the polar cyclone ([IQ 2D SDFs](https://iquilezles.org/articles/distfunctions2d/)).
- **Cyclone-cluster lattice:** `n` small cyclones arranged in a ring at the pole
  (Jupiter's polar pentagon/hexagon of storms). Place `n` F27-ovals on a circle
  of `polarStorm.radius` at angles `2πk/n`.

**(b) Generation path.** Data already exists (`polarStorm` at `:649`). Carriage:
flat uniforms `uniform int uPolarSides; uniform float uPolarPole; uniform float
uPolarRadius; uniform vec3 uPolarColor;` (plus `uniform bool uHasPolar`). The
`pole` sign picks N/S hemisphere (`pos.y` sign). D8→P17: the hexagon is a
fast-rotation phenomenon; could gate `uHasPolar` on spin later, but the 15%
generation chance already exists.

**(c) Envelope.** Polygon edge is a sharp luminance line → survives, may even
benefit from the dither (crisp edge). The polar darkening already in the old
shader (`Planet.js:305`) coexists.

**(d) Fallback.** Low tier → render the round cyclonic cap (drop the n-gon SDF
math), keep the polar color.

### F30 — Lightning `[aspirational]` (P17; convective regions)

**(a) Render HOW.** Flash clusters in convective (storm) regions. Cheapest
believable version: a time-gated emissive flicker masked to high-turbulence band
regions or storm-spot interiors. `flash = step(0.98, hash(floor(time*rate +
cellID)))` → brief white emissive spike at random storm cells, decaying over a
few frames. This is pure animation, no determinism needed (weather layer).

**(b) Generation path.** No new generated data needed — derive flash regions
from existing storm masks + turbulence. Driver: D5 (need atmosphere) + convective
activity (interior heat).

**(c) Envelope — keep/stylize/drop call.** **Recommend STYLIZE via emissive
bypass.** A single-frame white flash through 6-level posterize would band into a
gray smear; routed through the emissive-bypass channel it stays a crisp bright
point — exactly the case the composite-split was built for. Tiny render budget,
high "alive" payoff. If budget-constrained: **DROP** (it's `[aspirational]` and
the lowest-priority storm feature). Do NOT try to render it as a posterized
surface term — that's the failure mode.

**(d) Fallback.** Off entirely at low `qualityTier`.

### F32 — Dayside thermal hotspot (P21; D1, D7) — EMISSIVE

**(a) Render HOW.** The hot-jupiter look. Dayside emits as a near-blackbody;
emission peaks at the substellar point and (for the superrotation variant)
**shifts eastward**. Three variants:
- **Warm dayside:** mild emissive add on the star-facing hemisphere.
  `starFacing = max(dot(normalize(vWorldPos), lightDir), 0.0); emit =
  blackbody(T_day) * pow(starFacing, k)`.
- **Glowing molten-bright dayside:** high T_day → bright blackbody ramp
  (deep-red → orange → white-hot toward substellar).
- **Eastward-shifted hotspot (superrotation):** rotate the emission peak east of
  the substellar point by a `hotspotShift` angle. Mechanism: advect the hot
  region downwind of the equatorial superrotation jet — observed on HD 209458 b
  / WASP-43 b ([A&A superrotation](https://www.aanda.org/articles/aa/full_html/2020/01/aa36110-19/aa36110-19.html)).
  Implement by rotating `lightDir` about the spin axis by `hotspotShift` before
  computing `starFacing` for the *emissive* term only (lighting stays physical):
  ```glsl
  vec3 hotDir = rotateAboutY(lightDir, hotspotShift);   // east offset
  float hot = pow(max(dot(normalize(vWorldPos), hotDir), 0.0), hotspotSharpness);
  emit = blackbody(T_day) * hot;
  ```
Use a shared `emissiveBlackbody(tempK)` helper (also used by EXOTIC magma —
cross-domain seam).

**(b) Generation path.** D1 (T_eq) → dayside temperature → `T_day` and blackbody
color. D7 (tidal-lock) → whether there's a permanent dayside at all
(`tidalState.locked`) → gates `hotspotShift` (only locked worlds superrotate a
fixed hotspot). D8 → magnitude of `hotspotShift` (faster equatorial jet → larger
east offset). CPU-side:
```js
if (d.tidalState.locked) {
  T_day = d.T_eq * 1.0;                  // substellar ~ T_eq (could boost for redistribution)
  hotspotShift = lerp(0, 0.6, spinJetStrength);   // radians east
} else { hotspotShift = 0; T_day = d.T_eq; }
```
Uniforms: `uThermalTemp` (→ blackbody), `uHotspotShift`, `uHotspotSharpness`,
`uThermalStrength`.

**(c) Envelope — EMISSIVE BYPASS.** This is the canonical emissive-bypass case
(Stage A §2.C). The blackbody glow is **added AFTER posterize** so it doesn't
band into ugly gray steps — research §3.3 and the lava precedent both specify
"add emissive after the quantizer." Routed through the `emissiveGlow` term in
the composite split with `emissiveBypass` on. This is the whole reason the
bypass channel exists.

**(d) Fallback.** Low tier → drop the eastward shift (just substellar-centered
glow), keep the emissive add (it's the defining hot-jupiter look — don't cut it).

### F33 — Nightside thermal glow (P21; D1, D7) — EMISSIVE

**(a) Render HOW.** Dim self-emission on the night hemisphere (ultra-hot
Jupiters glow even on the night side because the superrotation jet carries heat
around) + patchy silicate/mineral nightside clouds. The old code already does a
faint version (`Planet.js:318-320, 373-375`): `nightSide = max(-dot(normalize(
vWorldPos), lightDir), 0.0); emit += deepRed * nightSide`. Enrich:
- Make the night-glow color a *cooler* blackbody than dayside (`T_night < T_day`,
  redder).
- Add **patchy silicate nightside clouds**: an fbm-masked modulation of the
  night glow so it's not uniform (mineral clouds condense where it's cooler).
  `nightGlow *= mix(0.6, 1.0, fbm(pos*cloudScale))`.

**(b) Generation path.** D1 → `T_night` (a fraction of T_day set by day-night
redistribution efficiency; deeper/denser atmosphere D5 → more efficient → warmer
night, smaller contrast). D7 gates it (locked only). Uniform `uThermalTempNight`,
`uNightCloudScale`.

**(c) Envelope.** EMISSIVE BYPASS, same channel as F32. Dim but crisp.

**(d) Fallback.** Low tier → uniform faint night glow, drop the silicate-cloud
fbm modulation.

---

## 3. Proposed semantic-uniform registry additions

All derived CPU-side in `PlanetGenerator` from drivers already in `planetData`,
passed as semantic uniforms, consumed generically (no `planetType` branch).
Mirrors the aurora/atmosphere precedent (`Planet.js:1051,1061-1066`) and the
shadow-array precedent (`:1071-1074`).

### Banding & jets (F24/F25/F26)

| Uniform | Type | Driver → process | Range | Default |
|---|---|---|---|---|
| `uBandScale` | float | D8 → P16 (band count) | 2 – 18 | 8 |
| `uBandContrast` | float | D8 + interior heat → P16 | 0.0 – 0.85 | 0.4 |
| `uBandStretch` | float | derived from bandScale | 2.0 – 5.0 | 2.5 |
| `uWarpStrength` | float | D8 → P16/P25 (festoon) | 0.0 – 2.5 | 2.0 |
| `uWarpFreq` | float | constant-ish (tuning) | 0.5 – 4.0 | 1.5 |
| `uJetStrength` | float | D8 → P16 (drift mag) | 0.0 – 1.0 | 0.3 |
| `uLatBiasWeights` | vec3 | D1/D3/D8 → P20 (itcz,track,polar) | 0 – 1 each | (0.6,0.4,0.3) |
| `uItczOffset` | float | D3 → P20 (seasonal migration) | −0.3 – 0.3 | 0.0 |

### Storm-array carriage (F27/F28) — flat uniform arrays, ≤8 spots

| Uniform | Type | Driver → process | Notes |
|---|---|---|---|
| `uStormCount` | int | P17 (count from `storms.spots.length`) | 0 disables loop |
| `uStormPosSize` | vec4[8] | reads `storms.spots[i]` | xyz = unit position, w = size (angular radius) |
| `uStormParams` | vec4[8] | reads `storms.spots[i]` | x = aspect, y = swirlStrength, z,w = reserved |
| `uStormColor` | vec3[8] | reads `storms.spots[i].color` | high-contrast generated colors |

### Polar vortex carriage (F29) — reads `polarStorm`

| Uniform | Type | Driver → process | Range | Default |
|---|---|---|---|---|
| `uHasPolar` | bool/float | P17 (`polarStorm != null`) | 0/1 | 0 |
| `uPolarSides` | int | `polarStorm.sides` | 5 – 8 | 6 |
| `uPolarPole` | float | `polarStorm.pole` | −1 / +1 | 1 |
| `uPolarRadius` | float | `polarStorm.radius` | 0.12 – 0.22 | 0.17 |
| `uPolarColor` | vec3 | `polarStorm.color` | — | — |
| `uPolarSwirl` | float | D8 → P17 | 0 – 1 | 0.4 |

### Thermal emission (F32/F33) — emissive-bypass channel

| Uniform | Type | Driver → process | Range | Default |
|---|---|---|---|---|
| `uThermalStrength` | float | D7 gate (locked only) → P21 | 0 – 1 | 0 |
| `uThermalTemp` | float | D1 → dayside T (K, → blackbody) | 500 – 3000 | 1200 |
| `uThermalTempNight` | float | D1 + D5 redistribution → night T | 300 – 2000 | 700 |
| `uHotspotShift` | float | D8 → P21 (superrotation east offset, rad) | 0 – 0.6 | 0.0 |
| `uHotspotSharpness` | float | tuning (hotspot tightness) | 1 – 6 | 3 |
| `uNightCloudScale` | float | silicate-cloud patchiness | 1 – 8 | 4 |

### Lightning (F30) — emissive-bypass

| Uniform | Type | Driver | Range | Default |
|---|---|---|---|---|
| `uLightningRate` | float | P17 activity (D5 gate) | 0 – 1 | 0 |

**Shared varyings/helpers to coordinate cross-domain:**
- `vSubstellarAngle` (varying) — `acos(dot(normalize(vWorldPos), lightDir))`,
  computed once, shared with CLOUDS (F31f pupil) and OPTICAL (terminator).
- `emissiveBlackbody(float tempK) → vec3` — shared with EXOTIC magma (F41).
- `latBias(lat)` — shared with CLOUDS (terrestrial cloud placement).

---

## 4. Lab folder spec — `▸ Bands & Storms`

Per Stage-A §3, lil-gui folder, collapsed unless active. Every control = one
semantic uniform, declared once.

```
▸ Bands & Storms
  ── Zonal banding (F24/F25) ──
  bandScale        [2 .. 18]      slider
  bandContrast     [0 .. 0.85]    slider
  bandStretch      [2 .. 5]       slider
  warpStrength     [0 .. 2.5]     slider   (0 = straight bands → cheap fallback)
  warpFreq         [0.5 .. 4]     slider
  jetStrength      [0 .. 1]       slider
  bandsAnimate     bool           (master toggle: drift on/off — Q6 taste call)
  ── Terrestrial weather bands (F26) ──
  itczWeight       [0 .. 1]       slider
  trackWeight      [0 .. 1]       slider
  polarWeight      [0 .. 1]       slider
  itczOffset       [-0.3 .. 0.3]  slider   (seasonal ITCZ migration)
  ── Storms (F27/F28) ──
  stormCount       [0 .. 8]       int-slider   (reads/overrides storms.spots)
  stormSwirl       [0 .. 1]       slider
  stormSeed        stepper        (re-roll storm placement)
  showConvPlumes   bool           (plume filaments)
  ── Polar vortex (F29) ──
  hasPolar         bool
  polarSides       [5 .. 8]       int-slider   (hexagon = 6)
  polarPole        {N: 1, S: -1}  dropdown
  polarRadius      [0.12 .. 0.22] slider
  polarSwirl       [0 .. 1]       slider
  polarMode        {round, ngon, lattice}  dropdown
  ── Lightning (F30) ──
  lightningRate    [0 .. 1]       slider   (emissive-bypass; 0 = off)

▸ Thermal (F32/F33)          ← sub-folder or sibling; emissive-bypass domain
  thermalStrength  [0 .. 1]       slider   (0 = no hot-jupiter glow)
  thermalTemp      [500 .. 3000]  slider   (dayside blackbody K)
  thermalTempNight [300 .. 2000]  slider
  hotspotShift     [0 .. 0.6]     slider   (superrotation east offset)
  hotspotSharp     [1 .. 6]       slider
  nightCloudScale  [1 .. 8]       slider
```

Presets (`▸ Presets`): "Jupiter" (high bandScale/contrast, 1-2 storms, no
thermal), "Saturn" (low contrast, hexagon on, soft), "Neptune/ice-giant" (low
bandScale, sparse bright spots), "Hot Jupiter" (low bands, high thermal, eastward
shift), "Eyeball-thermal" (thermal + substellar). Presets are driver-bundle
value sets, NOT code paths.

---

## 5. 3-cycle-cap risk flags

1. **Sphere flow-frame / pole-pinch for band drift (THE biggest risk — Q2).**
   Animating band longitude-drift (`bandDrift(lat)*time` added to `bandCoord`) on
   a sphere needs a consistent tangent frame, or the flow pinches/tears at the
   poles. The same singularity hits storm-oval advection and curl turbulence.
   Documented hard problem ([Bridson](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf),
   spherical-flow polar-singularity treatments). **This is the single biggest
   technical risk in the whole system per the Stage-A spec.**
   - **Fallback ladder (3-cycle cap):** (1) Drift only in longitude (around the
     spin axis) — banding is inherently latitude-organized, so a pure azimuthal
     `pos.xz` rotation by `time*bandDrift(lat)` has NO pole singularity (it's
     rotation about Y, well-defined everywhere). This sidesteps the whole
     tangent-frame problem for the *band* layer. Try this FIRST — it likely just
     works. (2) If festoon turbulence needs to flow too, advect in object-space
     3D-domain noise (sample `noised()` at `pos + flowVec*time`) rather than a 2D
     tangent plane — 3D-domain noise has no UV poles. (3) Only if both fail,
     polar-stereographic dual-projection blended across the equator.
   - **Likely outcome:** azimuthal-rotation (fallback 1) resolves bands without
     ever touching the pinch problem. The pinch risk is real for arbitrary curl
     advection but bands are a special case that dodges it. Flag for a dedicated
     Stage-C spike but expect it to resolve cheaply.

2. **Polygonal-hexagon jet (F29 n-gon).** Polar-stereographic projection of the
   cap to a 2D plane for the n-gon SDF can distort the polygon near the exact
   pole, and the projection itself has a singularity AT the pole.
   - **Fallback:** clamp the n-gon to `radius` well away from the exact pole (the
     real Saturn hexagon sits at ~75° latitude, not the pole, so this is
     physically correct anyway — offset the polygon center slightly). If the SDF
     still misbehaves, drop to the round cyclonic-cap variant (visually 80% as
     good). Hexagon is a "nice to have," not load-bearing.

3. **Storm-oval advection under posterize.** If storms drift (weather layer) and
   their swirl re-samples the band field, the moving high-contrast edge can
   crawl/shimmer under the 6-level Bayer dither (temporal aliasing in the dither
   pattern).
   - **Fallback:** (1) fwidth-clamp the storm edge softness with distance (same
     mechanism as band octaves). (2) Make storms static (don't drift) — they're
     quasi-permanent (GRS lasts centuries) so a frozen storm is physically
     defensible and removes the temporal-aliasing risk entirely. (3) Switch
     dither to IGN (less structured grid crawl than Bayer). Recommend frozen
     storms by default — the drift buys little and costs the most risk.

4. **(secondary) Eastward hotspot shift direction on retrograde rotators.** D8 is
   signed (retrograde spin exists, `PlanetGenerator.js:665`). The "east" of
   superrotation must follow the spin sign or the hotspot shifts the wrong way.
   Low risk, just thread the sign of `rotationSpeed` into `uHotspotShift`.

---

## 6. Open questions for Max (taste / scope)

1. **Do gas-giant bands ANIMATE (drift) or are they frozen?** (Q4 says weather
   need not be reproducible, so drift is *allowed*.) Drift adds life but costs
   the pole-pinch risk (#5.1) and the temporal-dither-crawl risk (#5.3). My read:
   **slow azimuthal band drift ON** (it dodges the pinch problem) but **storms
   frozen** (they're quasi-permanent anyway and frozen removes the biggest
   aliasing risk). Confirm, or do you want fully static gas giants (cheapest,
   most "retro-poster"), or fully alive (storms churn too)?

2. **Hot-jupiter eastward hotspot — how strong / always on?** It's physically the
   defining feature of locked hot Jupiters but it's subtle at a distance. Render
   it prominently (stylized, clearly off-center glow) or physically-subtle
   (small offset)?

3. **Lightning (F30) — keep/stylize/drop?** I recommend STYLIZE via emissive
   bypass (crisp flash, tiny budget) but it's `[aspirational]` and the lowest
   priority. Drop it for v1 if budget is tight?

4. **Ice-giant blandness floor.** Neptune/Uranus are *deliberately* low-detail
   (2-3 faint bands). Under a 6-level posterize a near-featureless blue globe may
   read as "unfinished" rather than "bland ice giant." Accept the blandness, or
   push sparse bright methane-cloud spots to give it *some* texture?

5. **Storm count ceiling.** The flat-uniform-array path caps at 8 spots
   (matching the existing shadow-array pattern). Generated data only makes 1–3.
   Is 8 enough forever, or do we ever want Jupiter-density storm fields (→ the
   Whigham cubemap path, more infrastructure)? Defaulting to 8-cap.

6. **Terrestrial F26 ownership seam.** F26's latitude-bias function biases
   *cloud* placement. Should it live in this domain (banding/circulation) or move
   wholesale to CLOUDS? My read: the *bias function* (circulation physics) is
   ours, the *cloud rendering* is CLOUDS, shared via the `latBias` uniform.
   Confirm the split.

---

## 7. Sources

All URLs fetched/verified 2026-06-06. Where a technique is speculative or
unverified it is labeled inline.

**Gas-giant banding & storms (render technique):**
- [Barthélemy Paléologue — Procedural Gas Giants (Medium)](https://medium.com/@barth_29567/procedural-gas-giants-f2a61bc6bd97)
  — vertical-stretch latitude (`*= 2.5`), domain-warp at latitude
  (`warpStrength ~2.0`, fbm-of-fbm), dual color-decision blend. **Fetched,
  formulas extracted.**
- [John Whigham — Gas Giants](http://johnwhigham.blogspot.com/2011/11/gas-giants.html)
  — latitude→1D colour-ramp + scale-controls-band-count; storm cone-packing into
  a 128² cubemap (100–200 storms, R/G=axis, B=rotation, A=radius); rotation
  proportional to distance-from-center. **Fetched, the storm-carriage source.**
- [Eric Obermühlner — GLSL gas giant planets](http://obermuhlner.ch/wordpress/2015/06/23/using-glsl-to-generate-gas-giant-planets/)
  — corroborating banded-noise approach (search snippet only, not deep-fetched).
- [stroemer.cc — Procedural Gas Giants](https://stroemer.cc/procedural-generation-gas-giants/)
  — storm-mask technique (NOTE: TLS cert flagged in prior research; retrieve via
  archive.org before relying on exact values).

**Domain warp & SDFs:**
- [Inigo Quilez — Domain Warping](https://iquilezles.org/articles/warp/)
  — fbm-of-fbm recursive warp (`q=fbm(p+o); r=fbm(p+4q+o); fbm(p+4r)`).
- [Inigo Quilez — 2D Distance Functions](https://iquilezles.org/articles/distfunctions2d/)
  — `sdStar(p,r,n,m)` (n-gon via large m) and the angle-fold-via-atan pattern for
  the Saturn-hexagon polar jet. **Fetched, GLSL extracted.**

**Flow advection / sphere frame (the pole-pinch risk):**
- [Bridson et al. — Curl-Noise for Procedural Fluid Flow (SIGGRAPH 2007)](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf)
  — divergence-free flow; the polar-singularity problem this domain inherits.
- [Emil Dziewanowski — Dissecting Curl Noise](https://emildziewanowski.com/curl-noise/)
  — practical curl-noise for flow.
- Two-phase flow-map advection (deterministic, buffer-free) — the
  `phase=fract(t*rate)` / `mix(n0,n1, 2*abs(phase-0.5))` primitive from the
  Stage-A research §3.3 (IceFall / GraphicsRunner flow-map sources cited there).

**Thermal emission / superrotation (generation physics for F32/F33):**
- [A&A — Acceleration of superrotation in simulated hot Jupiter atmospheres (2020)](https://www.aanda.org/articles/aa/full_html/2020/01/aa36110-19/aa36110-19.html)
  — equatorial superrotation jet, eastward heat advection.
- [arXiv 1712.07643 — Atmospheric Circulations of Hot Jupiters as Heat Engines](https://arxiv.org/pdf/1712.07643)
  — day-night thermal forcing → standing waves → eastward hotspot offset.
- [arXiv 1405.5923 — 4.5µm phase curve of HD 209458b](https://arxiv.org/pdf/1405.5923)
  — observational eastward hotspot offset (the look we're emulating).

**Saturn hexagon (physical reference, for the F29 polygonal jet look):**
- [Saturn's hexagon — Wikipedia](https://en.wikipedia.org/wiki/Saturn's_hexagon)
  — hexagon = prograde zonal jet ~75° latitude (informs the off-pole placement
  in risk #5.2).

**Code grounding (verified against live source 2026-06-06):**
- `src/generation/PlanetGenerator.js:587-650` — `storms.spots` + `polarStorm`
  generation (the unwired data this domain consumes).
- `:697` — `rotationSpeed` surfaced; signed; `0` if synchronously locked.
- `:679-707` — `planetData` return (drivers available CPU-side).
- `src/objects/Planet.js:248-414` — current GAS_BODY shader (the `[current]`
  band/storm/thermal to ENRICH, not match).
- `:1039-1077` — uniform block; `shadowMoonPos[6]`/`shadowPlanetPos[2]` array
  precedent for the storm-array carriage; dead `lodLevel`.
- `:587-616` — terrestrial latitude-bias (F26) current implementation.
```
