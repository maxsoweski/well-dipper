# Stage-B Per-Domain Research — AEOLIAN (wind-shaped surface + atmospheric dust)

**Date:** 2026-06-06 · **Domain:** Aeolian (F15 dunes & wind forms · F16 dust mantles · F40 dust storms)
**Project:** `~/projects/well-dipper` · three.js r183.1 / WebGL2 · desktop-primary, retro dithered/posterized envelope
**Plugs into:** Stage-A foundation (`docs/superpowers/specs/2026-06-06-planet-rendering-foundation-design.md`) —
analytic-derivative `noised()` base, `lodRamp` scalar + hysteresis, variable-octave FBM + fwidth clamp,
composite-split envelope (`posterizeLevels` + per-effect bypass), driver→semantic-uniform scaffolding.

> **Vocabulary reuse:** this doc builds on `research/RESEARCH_high-lod-planet-shaders-2026-06-05.md`
> (analytic-deriv noise, ridged multifractal, domain warp, Voronoi placement, clouds-as-relief, emissive
> bypass, fresnel atmosphere). It does **not** restate those primitives — it composes them anisotropically.
>
> **Frame discipline:** no parity-with-old goal; no `planetType` branch; single shader behind
> `qualityTier` + `lodRamp`; everything derives from DRIVERS via semantic uniforms. "Types" = driver-bundle
> presets (a Martian world is a driver bundle, not an `if`).

---

## 1. Scope

| Layer | IDs | What it is |
|---|---|---|
| **Static relief** (deterministic) | **F15** dunes & wind forms — barchan · linear (longitudinal) · star · yardang · ventifact · wind streak | Anisotropic, **oriented** relief modulation layered onto the `noised()` height base, plus downwind albedo masks. |
| **Static mantle** (deterministic) | **F16** dust mantles — thin veneer · deep loess · butterscotch tint | A coverage/tint field that *softens* underlying relief and shifts albedo toward an ochre dust color. |
| **Weather transient** (NON-deterministic per Q4) | **F40** dust storms — dust-devil tracks · regional front · planet-encircling global storm | A time-animated haze/coverage term that **veils** the surface, scaling regional→global by intensity. |

**Processes:** **P9** aeolian transport (drives F15/F16 relief & mantle) · **P23** aerosol/dust lofting (drives F40 storm).
**Drivers:** **D5** atmosphere density (need air to move grains) · **D8** rotation/circulation (wind direction) ·
**D14** gravity (dune repose angle / dune scale) · **D1** T_eq (thermal contrast → wind strength, frost-vs-dust) ·
plus a **dry-surface gate** (low liquid activity).

### Cross-domain seams (deconflict before Stage C)

1. **Dry-surface gate ⟷ FLUVIAL agent (the load-bearing seam).** Dunes need air AND a dry surface. The
   dryness signal is the **inverse** of the fluvial domain's stable-liquid signal. The Fluvial Stage-B
   research is expected to define a `liquidStability` (or equivalently named) scalar derived from D1+D2+D6
   (liquid-stability gate per P8/inventory). **Aeolian CONSUMES `1.0 - liquidStability` as its dryness
   factor.** If Fluvial names it differently, the two agents must agree on ONE shared uniform name + range at
   Stage-C integration. I propose the shared contract below (`uDryness`, 0..1) and flag it as a **must-reconcile
   seam** — do not let each domain compute its own dryness independently or a world will be simultaneously
   river-carved and dune-covered in the same band.

2. **Dust mantle ⟷ RELIEF agent.** F16 dust mantle *softens* the relief produced by the Relief domain
   (craters, mountains, ridged FBM). The mantle is applied as a **post-relief height-smoothing + albedo-tint
   pass**, so it must run *after* the relief combiner in the shader. Coordinate ordering: relief height →
   dune modulation (this domain) → mantle smoothing (this domain) → lighting.

3. **Dust storm ⟷ CLOUDS/HAZE agent.** F40 is an atmospheric obscuration overlay that competes with the same
   composite slot as clouds/haze. It should be the **last surface-veiling term before atmosphere/limb**, and it
   reuses the clouds-as-relief vocabulary but with **zero relief contribution** (it's a flat coverage veil, not
   lit cloud tops). Flag: if both a cloud deck AND a global dust storm are active, the dust storm wins the
   upper-altitude slot (it lofts to ~75 km, above most weather). Decide layering order with the Clouds agent.

4. **Wind-direction vector ⟷ BANDS & STORMS agent.** Both this domain (surface wind for dunes) and the
   Bands/Storms domain (zonal jets) derive from D8/circulation. They are **different altitudes** (surface
   boundary-layer wind vs. upper-atmosphere zonal flow) and should NOT share one uniform, but they should
   derive from the **same D8 rotation sign + axial-tilt** CPU inputs so a fast-prograde world's dunes and jets
   agree in handedness. Flag for consistency, not sharing.

---

## 2. Per-feature research

The unifying mechanism for all of F15: **anisotropy = stretch the noise domain along the wind-perpendicular
axis + rotate it to the wind frame.** IQ's fBM article explicitly notes you can *"rotate the domain a bit
besides stretching it"* per octave — this is the proven, demoscene-grade way to turn isotropic `noised()` into
directional dune ridges without a new noise kernel ([iquilezles.org/articles/fbm](https://iquilezles.org/articles/fbm/)).
We reuse the Stage-A `noised()` core verbatim; only the **input transform** and **profile-shaping** change.

### Shared construction: the wind frame and anisotropic sampling

CPU derives, per planet, a **surface wind direction** as a tangent-plane vector field. In-shader, at a surface
point `p` (object-space unit-sphere position), build a local tangent frame and an along-wind / cross-wind
coordinate:

```glsl
// uWindDir: object-space wind bearing seed (vec3), uWindStrength: 0..1, uDuneAniso: stretch ratio (e.g. 3..8)
// Build a tangent frame at p (object-local; never world — Stage-A precision rule)
vec3 N   = normalize(p);
vec3 wT  = normalize(uWindDir - N * dot(uWindDir, N));   // wind projected into tangent plane (along-wind)
vec3 wB  = cross(N, wT);                                  // cross-wind
// Anisotropic domain: compress along wind, keep cross-wind → ridges run PERPENDICULAR to wind (transverse/barchan)
//                      compress cross-wind instead → ridges run PARALLEL to wind (linear/longitudinal)
float along = dot(p, wT);
float cross = dot(p, wB);
vec2  duneUV = vec2(along * uDuneFreq, cross * uDuneFreq / uDuneAniso); // transverse default
vec3  dn = noised(vec3(duneUV, N.z * 0.0 + uDetailSeed)); // value+deriv from Stage-A core
```

This is the single primitive behind every F15 variant; the variant is chosen by **which axis is compressed**
and **how the profile is shaped**, both driven by semantic uniforms (no branch on type).

---

### F15 — Dunes & wind forms

#### F15.barchan (crescentic, mono-directional wind)

**(a) Render HOW.** Barchans form under a single dominant wind; crescentic crest normal to wind, horns
pointing downwind ([arxiv barchan dynamics](https://arxiv.org/pdf/cond-mat/0108378)). Build as a **transverse
anisotropic FBM** (compress along-wind) → gives ridges perpendicular to wind. The defining barchan trait is the
**asymmetric profile**: shallow windward *stoss* slope, steep lee *slip face* at the sand repose angle (~34°).
Achieve this analytically by **warping the sawtooth phase** of the dune height:

```glsl
// h0 = anisotropic FBM dune field in [0,1]; phase t = fract(along*duneRate)
// Asymmetry: stretch stoss, compress slip-face. asym in (0,1), ~0.8 = sharp slip face
float t   = fract(along * uDuneRate + h0);              // along-wind dune phase
float ph  = (t < uDuneAsym) ? (t / uDuneAsym)           // gentle stoss ramp 0..1
                            : (1.0 - (t - uDuneAsym) / (1.0 - uDuneAsym)); // steep slip drop
float duneH = uDuneAmp * uWindStrength * smoothstep(0.0, 1.0, ph) * h0;
```

Add `duneH` to the `noised()` base height **before** the normal computation so the slip face self-shadows and
the asymmetry reads through lighting (the survival strategy — route detail through normals, not hue). Crescent
"horns" emerge for free where the cross-wind FBM `h0` thins the field laterally; a Voronoi-F1 placement field
(reuse Relief's crater placement primitive) scatters discrete barchans on a hard substrate vs. a continuous erg.

**(b) Generation path.** `D5(density)→P9` gates existence; `D8(rotation)→` wind bearing → `uWindDir`;
`D14(gravity)→` repose angle → `uDuneAsym`/`uDuneAmp` (low-g → taller, more relaxed dunes; high-g → flatter,
steeper-capped); `D1` → wind strength via day-night/equator-pole thermal contrast → `uWindStrength`. Dryness
gate `uDryness = 1 - liquidStability` (fluvial seam). CPU derivation in `PlanetGenerator`:
- **Wind bearing (`uWindDir`):** a deterministic seeded great-circle bearing biased by rotation sign
  (prograde→eastward trade-wind component) and axial tilt. `windDir = normalize(eastward*rotSign*0.7 + seeded*0.3)`.
- **Repose (`uDuneAsym`, `uDuneAmp`):** `g = surfaceGravity(massEarth, radiusEarth)`;
  `duneAmp = clamp(baseAmp / sqrt(g), …)` (lower g → taller dunes, observed on Mars/Titan); `duneAsym ≈ 0.75`
  fixed (repose angle is roughly material-invariant) with a small g nudge.
- **Field intensity:** `aeolianStrength = densityFactor * dryness * thermalWind`, where
  `densityFactor = smoothstep(D5_thinThresh, D5_thickThresh, atmosphere.physics.pressure)`.

Semantic uniforms (generic shader consumption, no type branch): `uWindDir (vec3)`, `uWindStrength (float)`,
`uDuneAmp (float)`, `uDuneAsym (float)`, `uDuneFreq (float)`, `uDuneRate (float)`, `uDuneAniso (float)`,
`uDuneRegime (float, 0..1 barchan↔linear↔star)`, `uDryness (float)`.

**New surfacing need:** surface gravity `g` is derivable from existing `massEarth`/`radiusEarth` but is **not
returned as a first-class field** — surface it (cheap, like the D13 magnetic-field surfacing item in Stage-A).
`atmosphere.physics.pressure` already exists (PhysicsEngine `computeAtmosphere` returns `pressure`) — wire it
through as the D5 signal.

**(c) Envelope interaction.** **Survives** (keep). Because dunes are added to height → drive normals → drive
the lit luminance the Bayer threshold quantizes, the slip-face/stoss contrast reads as dither texture even at
6 levels. Risk is *orientation legibility* under posterize (see §5). No bypass needed.

**(d) Quality-scalar fallback.** Rich: full anisotropic FBM + Voronoi-placed discrete barchans + asymmetric
profile. Cheap (`qualityTier` low): single-octave anisotropic ridge (drop the placement Voronoi and the
fractional octaves), symmetric profile (drop the slip-face warp). Both reachable behind the same uniforms.

#### F15.linear (longitudinal / seif, bimodal wind)

**(a)** Same primitive, **compress cross-wind instead of along-wind** → long ridges running *parallel* to the
net wind (`uDuneRegime` selects which axis the anisotropy compresses, lerped). Less asymmetry, more length;
`uDuneAniso` high (6–10). Real-world: Namib linear dunes, Titan's equatorial dune belts (longitudinal under
bimodal winds).

**(b)** Distinguished from barchan by D8 wind *steadiness*: a strongly-banded/fast-rotating world (high D8)
→ more bimodal/seasonally-reversing wind → linear regime; steady single wind → barchan. CPU: derive
`uDuneRegime` from rotation rate + axial tilt (high tilt → seasonal reversal → linear). **(c)** Survives (keep).
**(d)** Cheap: a single stretched ridged-FBM lane.

#### F15.star (multidirectional wind)

**(a)** Star dunes form under winds from many directions → radial arms, tall central peak. Render as a
**superposition of 3–4 anisotropic dune fields at different `wT` rotations** (rotate `uWindDir` by
±60°/±120° in the tangent plane) summed, producing a pyramidal star. This is the most expensive F15 variant
(3–4× the dune evaluation). **(b)** Gated by `uDuneRegime` near 1.0 — derived when wind direction variance is
high (high axial tilt + slow rotation + complex circulation). **(c)** Survives (keep) but the radial detail is
the first thing posterize crushes → **stylize** at LOD1, full only at LOD2. **(d)** Cheap: collapse to a single
billow bump (drop the multi-rotation sum); rich: full 4-arm superposition behind `qualityTier`+`lodRamp`.

#### F15.yardang (wind-abraded grooves)

**(a)** Yardangs are *erosional* (wind carves soft rock into parallel streamlined ridges, blunt upwind, tapered
downwind), not depositional. Render as a **negative, parallel-to-wind anisotropic groove field** subtracted
from the relief base: take the linear-dune primitive (cross-wind compressed), **invert it** (grooves cut DOWN),
and add a slight along-wind taper (`smoothstep` fade of groove depth toward the downwind end). Reuse Relief's
ridged-multifractal `1-abs(n)` fold but apply it in the wind frame so crests align parallel to wind
([geographypin yardang](https://geographypin.com/what-is-a-yardang/)). **(b)** Gated on a **hard, ancient,
dry** surface — derive from D11 surface-history (old/low-resurfacing) × `uDryness` × `aeolianStrength`. Distinct
uniform `uYardangDepth (float)`. **(c)** Survives (keep) — grooves are pure relief. **(d)** Cheap: lower octave
count on the groove FBM.

#### F15.ventifact (wind-polished rock facets)

**(a)** Ventifacts are *micro-scale* (faceted, polished individual rocks) — sub-pixel at planet/LOD1 scale.
Express only as a **specular/roughness modulation aligned to wind** (downwind faces smoother/shinier), NOT as
relief. A small anisotropic gloss term feeding the spec channel. **(b)** Derived from `aeolianStrength`; no new
relief uniform, reuses `uWindDir`. **(c)** `[subtle]` — the 6-level posterize crushes micro-facet albedo →
**drop at LOD1, optional stylize at LOD2** as a faint anisotropic spec glint (could ride the `specBypass`
channel if Max wants it). Default: **drop**. **(d)** N/A (drop tier).

#### F15.wind-streak (downwind albedo tails off obstacles)

**(a)** The one F15 variant that is **albedo, not relief**: bright/dark dust tails deposited in the wind-shadow
*downwind* of topographic obstacles (crater rims, mountains). Wind hits a raised feature, the lee provides a
wind-shadow that protects (or scours) dust → a streak ([NASA wind streaks](https://science.nasa.gov/photojournal/nighttime-wind-streaks/),
[ASU Mars wind streaks](https://marsed.asu.edu/mep/wind/wind-streaks)). Render as a **downwind smear mask**:
sample the relief height-field (or the Relief domain's obstacle mask — crater placement field) at the surface
point and at a point offset *upwind* by a streak-length; where an obstacle exists upwind, deposit a streak:

```glsl
// obstacleMask(p): high near crater rims / peaks (reuse Relief's placement field)
float up = obstacleMask(p + wT * uStreakLen);    // is there an obstacle upwind of me?
float streak = up * exp(-abs(cross) * uStreakNarrow) * uStreakStrength; // narrow tail along wind
finalAlbedo = mix(finalAlbedo, uStreakColor, streak * uDryness * aeolianStrength);
```

`uStreakColor` is either darker (scoured to bedrock) or brighter (dust-mantled) — sign chosen by a per-planet
`uStreakBright (float, -1..1)`. **(b)** Depends on the Relief domain's obstacle/placement field (seam #2/#4) +
`uWindDir`. New uniforms: `uStreakLen`, `uStreakNarrow`, `uStreakStrength`, `uStreakBright`, `uStreakColor (vec3)`.
**(c)** Albedo-only → the posterize is **harsh** on it (low-contrast tint gets crushed). **Stylize:** push the
streak as a clear two-level dark/light mask (not a gradient) so it survives as a posterized smear; OR route a
faint version. Honest flag: this is the **highest envelope risk** in the domain (§5). **(d)** Cheap: drop
streaks entirely (they require sampling the obstacle field twice — a real cost); rich: full downwind smear.

---

### F16 — Dust mantles

#### F16.thin-veneer / F16.deep-loess / F16.butterscotch-tint

**(a) Render HOW.** A dust mantle is a **coverage field that softens relief and tints albedo** — it does NOT
add relief, it *removes* it (buries small features under settled dust). Two coupled operations:
1. **Relief smoothing:** `mantle = coverageFBM(p) * uMantleDepth` (a large-scale FBM coverage in 0..1).
   Lerp the high-frequency relief height toward its low-pass version by `mantle`:
   `surfaceH = mix(surfaceH, lowpass(surfaceH), mantle)` — i.e. attenuate the high octaves' contribution to
   the normal where dust is deep (cheaply: scale the trailing-octave weight down by `mantle`, reusing Stage-A's
   fractional-octave weighting). Deep loess = high `uMantleDepth` (relief mostly buried); thin veneer = low.
2. **Albedo tint:** `albedo = mix(albedo, uDustColor, mantle * uMantleTint)` where `uDustColor` is the
   butterscotch/ochre (Mars dust ≈ `[0.72, 0.55, 0.36]`).

**(b) Generation path.** `P9 + P23` deposit dust; intensity from `aeolianStrength` integrated over D16 age
(old + dry + windy → thick mantle). CPU: `mantleDepth = clamp(aeolianStrength * ageFactor * dryness, 0, 1)`;
`uDustColor` from composition (iron-oxide worlds → butterscotch; basaltic → grey dust). Uniforms:
`uMantleDepth (float)`, `uMantleTint (float)`, `uDustColor (vec3)`, `uMantleScale (float)`. **(c)** The tint is
albedo → posterize-sensitive, but a *broad low-frequency* tint survives fine (it shifts whole luminance buckets
coherently, not high-freq detail). The relief-smoothing is normal-routed → survives. **Keep** (the tint is a
legit broad-mask albedo change, the one kind that survives — per the research spec's "large low-frequency masks
only" rule). **(d)** Cheap: tint-only (drop the relief-smoothing low-pass); rich: both.

---

### F40 — Dust storms (P23, weather transient, NON-deterministic per Q4)

#### F40.dust-devil-tracks / F40.regional-front / F40.global-storm

**(a) Render HOW.** This is an **atmospheric obscuration overlay**, distinct from the static dune relief — a
time-animated haze that **veils** the surface, NOT lit cloud tops. A global Martian storm lofts dust to ~75 km
and reddens the disk (red grains pass red, block green/blue → cherry-red/ochre disk;
[NASA global dust storm](https://science.nasa.gov/asset/hubble/a-global-dust-storm-on-mars/)). Render as a
**coverage veil** applied late in the composite:

```glsl
// uStormIntensity 0..1 (regional→global), animated FBM coverage, NON-deterministic (global clock, no seed-determinism)
vec3 sp = p * uStormScale + uWindDir * (time * uStormDrift);   // drifts along wind
float storm = fbm(sp);                                          // reuse Stage-A FBM core
float cover = smoothstep(1.0 - uStormIntensity, 1.0, storm + uStormIntensity); // grows with intensity
// Veil: blend the WHOLE surface toward dust color, scaled by how lit it is (storms self-illuminate via scatter)
float veilLight = max(diffuse, 0.25);                          // dust haze stays bright even in shadow-ish
finalColor = mix(finalColor, uDustColor * veilLight, cover * uStormOpacity);
```

- **Dust-devil tracks** (`uStormIntensity` low): thin, dark, wandering curvilinear scour marks on the surface
  (a different sub-effect — actually a *track* on the ground, not a haze). Render as sparse advected curl-noise
  filaments (reuse curl-noise flow primitive) darkening albedo along the path. Low priority sub-variant.
- **Regional front** (mid): a localized coverage patch with a defined leading edge — gate the veil to a
  hemisphere/latitude band (`smoothstep` on a moving front position).
- **Global storm** (high): coverage → 1 everywhere, the disk goes uniform ochre, surface detail vanishes
  under the veil. The dramatic endmember.

LOD-ramp: storm coverage amplitude `*= mix(1.0, 1.0, lodRamp)` — visible at all LODs (it's a whole-disk
phenomenon), but the curl-filament dust-devil detail only resolves at LOD2 (`* lodRamp`).

**(b) Generation path.** `D5(density) + loose-dust(=mantleDepth) + D1(thermal) + D3(seasonal) →P23`.
Because Q4 makes the weather layer **non-deterministic**, `uStormIntensity` is NOT a pure function of
position/seed — it can be a **slowly-varying global-clock function** (a planet "has a dust-storm season" that
ramps in over minutes of real time) OR an FBO-accumulation sim (re-opened for weather per Q4). **Recommend the
time-animated path** (no cold-start, always-already-running — the UX argument from the research spec's Q4
note). CPU sets the *envelope*: `uStormProneness = densityFactor * mantleDepth * thermalContrast` (a dusty,
thin-air, high-contrast world is storm-prone); the actual `uStormIntensity` oscillates on the global clock
within that envelope. Uniforms: `uStormIntensity (float)`, `uStormOpacity (float)`, `uStormScale (float)`,
`uStormDrift (float)`, `uStormProneness (float)`, reuse `uDustColor`, `uWindDir`. **(c)** The veil is a broad
albedo shift toward one color → **survives** (coherent bucket shift). It does NOT need bypass — it's *meant* to
flatten the surface (that's the storm). **Keep.** **(d)** Cheap: single-octave veil, drop dust-devil filaments;
rich: multi-octave drifting coverage + curl-noise devil tracks + moving regional front.

---

## 3. Proposed semantic-uniform registry additions

All derived CPU-side in `PlanetGenerator` from existing `planetData` (generalizing the aurora/atmosphere
precedent at `Planet.js:1051,1070-1076`), consumed generically (no `planetType` branch).

| Uniform | Type | Driver chain (D#→P#) | Range | Default (off) | Notes |
|---|---|---|---|---|---|
| `uWindDir` | `vec3` | D8 rotation + D3 tilt → P9 | unit vec3 (object-space bearing seed) | `(1,0,0)` | **The wind-direction vector.** Shared-derivation (not shared-uniform) with Bands/Storms. |
| `uWindStrength` | `float` | D1 thermal + D5 → P9 | 0..1 | 0 | Equator-pole / day-night thermal wind magnitude. |
| `uDryness` | `float` | D1+D2+D6 (= `1 - liquidStability`) | 0..1 | 0 | **SHARED SEAM with Fluvial** — reconcile name+range at Stage C. |
| `uDuneAmp` | `float` | D14 gravity → P9 | 0..0.15 (height frac) | 0 | Lower g → taller. `baseAmp / sqrt(g)`. |
| `uDuneAsym` | `float` | D14 → P9 (repose angle) | 0.5..0.9 | 0.75 | Stoss/slip-face asymmetry. ~repose-invariant. |
| `uDuneFreq` | `float` | scale | 1..30 | 8 | Dune wavelength. |
| `uDuneRate` | `float` | along-wind phase | 1..20 | 6 | Crest spacing along wind. |
| `uDuneAniso` | `float` | D8 steadiness → P9 | 2..10 | 4 | Domain stretch ratio. |
| `uDuneRegime` | `float` | D8 variance + D3 → P9 | 0..1 | 0 | 0=barchan/transverse · 0.5=linear · 1=star. |
| `uYardangDepth` | `float` | D11 age × dryness → P9 | 0..0.1 | 0 | Negative groove depth (erosional). |
| `uStreakLen` | `float` | wind-shadow length | 0..0.3 | 0.1 | Downwind streak reach (object-space). |
| `uStreakNarrow` | `float` | streak width | 4..40 | 12 | Cross-wind falloff. |
| `uStreakStrength` | `float` | P9 deposition | 0..1 | 0 | Wind-streak intensity. |
| `uStreakBright` | `float` | scour vs deposit | -1..1 | 0.5 | Sign: dark scour ↔ bright dust tail. |
| `uStreakColor` | `vec3` | composition | rgb | dust ochre | Streak tail color. |
| `uMantleDepth` | `float` | aeolianStrength × age → P9/P23 | 0..1 | 0 | Dust burial depth (relief attenuation). |
| `uMantleTint` | `float` | mantle albedo blend | 0..1 | 0 | How much albedo shifts to dust color. |
| `uMantleScale` | `float` | coverage FBM scale | 0.5..5 | 2 | Mantle patchiness. |
| `uDustColor` | `vec3` | composition (iron-oxide→butterscotch) | rgb | `(0.72,0.55,0.36)` | Shared by mantle + storm + streak. |
| `uStormProneness` | `float` | D5×mantle×D1 → P23 | 0..1 | 0 | Storm-season envelope (CPU). |
| `uStormIntensity` | `float` | P23 (global clock, Q4 non-det) | 0..1 | 0 | Regional(low)→global(1). Animated, not seeded. |
| `uStormOpacity` | `float` | veil strength | 0..1 | 0.85 | Max obscuration at full coverage. |
| `uStormScale` | `float` | coverage FBM scale | 0.3..3 | 1 | Storm cell size. |
| `uStormDrift` | `float` | along-wind advection | 0..0.01 | 0.003 | Veil drift speed. |

**New first-class surfacing needs (Stage-A-style data-management items):**
- **Surface gravity `g`** — derivable from `massEarth`/`radiusEarth` (PhysicsEngine `escapeVelocity` already
  uses both) but not returned as a field. Surface it for D14→dune-repose.
- **`atmosphere.physics.pressure`** — already computed (`computeAtmosphere` returns `pressure`), NOT currently
  passed to the shader. Wire it through as the D5 signal.
- **`uDryness` / `liquidStability`** — does not exist yet; must be defined by the Fluvial agent and shared.

---

## 4. Lab folder spec — `▸ Aeolian`

A new lil-gui folder (collapsed by default; slots between `▸ Fluvial` and `▸ Cryo / Sublimation` per the
Stage-A lab plan §3). Every control = one semantic uniform, declared once.

```
▸ Aeolian
  ── Gate ──────────────────────────────
  uDryness            slider 0..1          (mirror of fluvial liquidStability; shared at Stage C)
  aeolianStrength     readout (derived)    densityFactor*dryness*thermalWind, shown not edited
  ── Wind frame ────────────────────────
  windBearing         slider 0..360°       → uWindDir (tangent bearing; lab maps to object-space)
  uWindStrength       slider 0..1
  ── Dunes (F15) ───────────────────────
  uDuneRegime         slider 0..1          barchan ↔ linear ↔ star (label the thirds)
  uDuneAmp            slider 0..0.15
  uDuneAsym           slider 0.5..0.9      slip-face sharpness
  uDuneFreq           slider 1..30
  uDuneRate           slider 1..20
  uDuneAniso          slider 2..10
  uYardangDepth       slider 0..0.1        (erosional grooves)
  ── Wind streaks (F15) ────────────────
  uStreakStrength     slider 0..1
  uStreakLen          slider 0..0.3
  uStreakNarrow       slider 4..40
  uStreakBright       slider -1..1         dark scour ↔ bright tail
  ── Dust mantle (F16) ─────────────────
  uMantleDepth        slider 0..1
  uMantleTint         slider 0..1
  uMantleScale        slider 0.5..5
  uDustColor          color
  ── Dust storm (F40, weather) ─────────
  uStormIntensity     slider 0..1          regional → global  (animated when "live" toggled)
  stormLive           toggle               global-clock oscillation vs. manual hold
  uStormOpacity       slider 0..1
  uStormScale         slider 0.3..3
  uStormDrift         slider 0..0.01
  ── Presets ───────────────────────────
  [Mars-like]  [Titan-belt]  [Erg-world]  [Storm-season]   (driver-bundle preset buttons)
```

Preset buttons load driver bundles (Appendix-A pattern), NOT type branches: e.g. **Mars-like** =
thin-air + dry + iron-oxide dust + barchan + storm-prone; **Titan-belt** = linear dunes + low-g tall + dark
hydrocarbon dust + no storm; **Erg-world** = full dune sea, deep mantle. Each sets the folder's uniform values.

---

## 5. 3-cycle-cap risk flags

Per MEMORY rule: if a mechanism fails research→implement→test 3×, switch technique. Named fallbacks up front.

1. **RISK (highest): anisotropic dunes that don't *read* as dunes under 6-level posterize.** The slip-face/stoss
   asymmetry is a subtle normal-direction cue; the Bayer threshold may flatten the lit gradient into a single
   bucket, leaving "stripes" that read as generic noise, not oriented dunes. **Mitigation:** (a) push dune
   contrast through *self-shadowing* (the slip face should go to a distinctly darker bucket — exaggerate
   `uDuneAmp` beyond physical so the asymmetry survives quantization, accept stylization over realism per the
   "no parity" frame); (b) test at LOD2 first where octave count is highest. **Fallback if 3× fail:** drop the
   analytic asymmetric profile, render dunes as a **stylized two-tone transverse ridge mask** (hard light/dark
   bands perpendicular to wind) — deliberately embraces the retro envelope rather than fighting it. This is the
   honest "stylize" path and likely looks *better* in a posterized game than physically-accurate dunes.

2. **RISK (high): aligning wind-streaks to topography in-shader.** The streak needs to sample an *upwind
   obstacle field*, which means either (a) a second evaluation of the Relief domain's height/placement field at
   an offset point (cost + ordering dependency on the Relief agent's output), or (b) a precomputed obstacle
   mask. Per-fragment double-sampling of a multi-octave FBM is expensive and the offset along a curved tangent
   frame can drift at the poles (the same Q2 sphere-flow-frame risk that haunts lava/ocean). **Mitigation:**
   keep `uStreakLen` short (1–2 dune wavelengths) so the offset sample stays in the local tangent plane;
   coordinate with Relief to expose a cheap `obstacleMask(p)` rather than re-deriving relief. **Fallback if 3×
   fail:** drop topographically-anchored streaks; render wind streaks as a **standalone anisotropic albedo FBM**
   (directional smears not anchored to specific craters) — loses the "tail behind that crater" realism but
   keeps the directional-deposit look at a fraction of the cost. Or **drop F15.wind-streak entirely** for v1
   (it's the least essential F15 variant).

3. **RISK (medium): the dry-surface gate seam de-syncing from Fluvial.** If Aeolian and Fluvial each compute
   dryness independently they'll disagree and a band can show both rivers and dunes. **Mitigation:** force ONE
   shared `uDryness` uniform, reconciled at Stage-C integration (flagged in §1 seam #1). Not a render risk, an
   integration risk — but it's the one most likely to produce an obviously-wrong result, so it's capped here.

4. **RISK (low): star dunes' multi-rotation sum cost.** 3–4× dune evaluation. **Fallback:** collapse to a
   single billow bump at `qualityTier` low / when `uDuneRegime`→1 is rare. Already covered by the quality scalar.

---

## 6. Open questions for Max (taste/scope calls)

1. **Dune realism vs. stylization.** The physically-accurate asymmetric barchan profile may read worse under
   the 6-level posterize than a deliberately-stylized two-tone transverse ridge (risk #1). The "no parity"
   frame suggests we should *prefer the stylized retro look* — but do you want dunes that read as "real Mars
   from orbit" or as "obviously a posterized game's dunes"? This determines whether we even build the analytic
   slip-face. My lean: build the slider for both, default to stylized, let you settle it per-type in the lab
   (consistent with the Stage-A "tracked open goal" on the envelope).

2. **Wind-streak scope.** Topography-anchored streaks (tails behind specific craters) are the highest-cost,
   highest-risk F15 variant and depend on the Relief domain's output. Drop them for v1 and ship dunes+mantle
   first, or build the full crater-anchored version? My lean: defer streaks to a v2 pass after Relief lands.

3. **Dust-storm determinism UX.** Q4 frees the weather layer from determinism. Do you want a planet to *have a
   dust-storm season* (slow global-clock oscillation, always-already-running, so revisiting a Mars-world
   sometimes finds it clear and sometimes ochre-veiled) — or storms only when you "trigger" something? My lean:
   global-clock season (matches the always-running UX argument; cheap; dramatic on revisit).

4. **Should F40 global storms fully hide the surface?** A planet-encircling storm physically makes the disk a
   featureless ochre ball. That's dramatic but means the player loses all surface detail temporarily. Full
   obscuration (`uStormOpacity`→1) or capped (always leave faint relief showing)? Taste call.

5. **Ventifacts: drop or stylize?** They're micro-scale and the envelope crushes them (§F15.ventifact). My lean:
   drop at LOD1, optional faint anisotropic spec glint at LOD2 only if you want the extra texture. Default drop.

---

## 7. Sources

Real, fetched/verified. Technique sources are demoscene/SIGGRAPH/IQ-grade where possible; the physical
references ground the driver→feature derivations.

**Technique (render HOW):**
- [Inigo Quilez — fBM](https://iquilezles.org/articles/fbm/) — domain stretch + per-octave rotation = the
  anisotropic-dune primitive; ridge fold (`1-abs(n)`) for yardang grooves. *(verified)*
- [Inigo Quilez — articles index](https://iquilezles.org/articles/) — domain warp, value-noise-with-derivatives
  (the Stage-A `noised()` lineage this domain composes on). *(verified)*
- [Book of Shaders — fBM](https://thebookofshaders.com/13/) — FBM/ridge construction reference. *(verified)*
- [tuxalin/procedural-tileable-shaders — noise.glsl](https://github.com/tuxalin/procedural-tileable-shaders/blob/master/noise.glsl)
  — value noise + derivatives + ridge-like (`gridNoise`); **no native anisotropic/Gabor kernel** (confirmed
  by fetch) → anisotropy must come from the domain transform, not a special noise. *(verified)*
- [WiseShards — Procedural Desert Generation](https://www.wiseshards.com/blog/basic-procedural-desert-generation-and-rendering-in-unity/)
  — confirms naive Perlin-only dunes lack orientation/asymmetry; motivates the anisotropic-frame approach.
  *(verified — establishes what NOT to do)*
- Shadertoy "Desert Sand" (`https://www.shadertoy.com/view/ld3BzM`) — **could NOT verify** (Shadertoy returned
  HTTP 403 to the fetch). Listed as a lead for the Stage-C harness; retrieve interactively before relying on it.
  *(UNVERIFIED — flagged honestly)*

**Physical grounding (driver→feature derivation):**
- [arXiv — "Barchan dunes in the lab"](https://arxiv.org/pdf/cond-mat/0108378) — barchan = mono-directional
  wind, crescent normal to wind, horns downwind; height/spacing relations (informs `uDuneRate`/`uDuneAmp`). *(verified)*
- [GeographyPin — What is a Yardang](https://geographypin.com/what-is-a-yardang/) — yardangs align parallel to
  prevailing wind, blunt upwind / tapered downwind (informs the F15.yardang groove orientation + taper). *(verified)*
- [NASA — Nighttime Wind Streaks](https://science.nasa.gov/photojournal/nighttime-wind-streaks/) and
  [ASU Mars Ed — Wind Streaks](https://marsed.asu.edu/mep/wind/wind-streaks) — wind-shadow downwind of crater
  rims; bright (dust-deposited) vs dark (scoured) streaks (informs `uStreakBright` sign + downwind smear). *(verified)*
- [NASA — A Global Dust Storm on Mars](https://science.nasa.gov/asset/hubble/a-global-dust-storm-on-mars/) and
  [NASA/JPL — Martian Dust Storm Grows Global](https://www.jpl.nasa.gov/news/martian-dust-storm-grows-global-curiosity-captures-photos-of-thickening-haze/)
  — dust lofts ~75 km, reddens disk to cherry/ochre, regional→global growth (informs the F40 veil color +
  intensity ramp + drift). *(verified)*

**Code grounding (verified in repo):**
- `src/generation/PhysicsEngine.js` — `computeAtmosphere()` returns `pressure` (D5 signal, `:146-239`);
  `escapeVelocity(massEarth, radiusEarth)` (`:81`) and `estimateMassEarth` give D14 gravity; `fieldStrength`/
  `rotationSpeed` precedent (`:167-168`).
- `src/generation/PlanetGenerator.js` — aurora derivation block (`:435-484`) is the precedent to generalize for
  CPU-side semantic-uniform derivation; `planetData` returned at `:679-707` (has `composition`, `T_eq`,
  `tidalState`, `atmosphere`, `surfaceHistory`, `rotationSpeed`, `axialTilt`).
- `src/objects/Planet.js` — existing `[partial]` Mars dust-storm shader path (`:616-625`, planetType==0,
  `snoise` dust mask) is the F40 precedent to replace with the driver-derived veil; aurora uniform-passing
  pattern (`:1061-1066`) is the template for the new aeolian uniforms.
```
