# Stage-B Research — Clouds & Haze (the F31 cloud/haze family)

**Date:** 2026-06-06 · **Domain:** Clouds & Haze (one driver, six looks) · **Stage:** B (per-domain render+generation research) · **Implements into:** `world-engine-lab.html` (Stage C)

> **Frame (do not re-litigate).** This is a ground-up NEW planet renderer building UP from the
> 1-LOD retro/dithered foundation. **No parity-with-old goal. No `planetType` branch** — derive
> everything from DRIVERS via semantic uniforms; "types" are driver-bundle presets. Single shader
> behind `qualityTier` + `lodRamp`. The retro envelope (posterize 6→16 + Bayer/IGN dither) is a
> tunable axis — features survive it, deliberately bypass it, or are flagged keep/stylize/drop.
>
> **Stage A already converted clouds onto the analytic base.** The lab has `uCloudCoverage`,
> `uAuroraIntensity`, `uTime`, and a cloud term:
> ```glsl
> // world-engine-lab.html:379-382
> vec4 cw = fbmd(vPos * 1.7 + vec3(uTime * 0.02, 0.0, 0.0), 5.0, 0.0);
> float cloud = smoothstep(0.15, 0.5, cw.x) * uCloudCoverage * (diff + 0.05);
> vec3 cloudC = vec3(cloud);
> cloudC = posterize(cloudC, uLevels, fc, 0.4, uDitherMode);
> ```
> driven by `deriveUniforms(...).cloudCoverage` (planet-lod-lab-core.js:67:
> `cloudCoverage: hasAtmo ? clamp01((d.habitability ?? 0) + 0.2) : 0`). **This research EXTENDS
> that single cloud term into the six-look family — it does NOT add a second, parallel cloud
> system.** Every proposal below is phrased as a delta on the existing `cw`/`cloud`/`cloudC` lines.

---

## 1. Scope

**Feature IDs (the F31 family — `docs/FEATURES/planet-visual-features.md` F-clouds):**

| ID | Variant | Canonical look | Driving regime |
|---|---|---|---|
| **F31a** | Terrestrial weather clouds | patchy/banded white over **visible ground** | H₂O condensation, temperate, partial coverage |
| **F31b** | Gas-giant band tops | the cloud deck **IS** the surface (opaque) | NH₃/NH₄SH/H₂O decks, full coverage |
| **F31c** | Sub-neptune featureless haze | flat, structureless muted globe | photochemical aerosol, total muting |
| **F31d** | Venus opaque blanket | total reflective shroud + faint UV Y-markings `[subtle]` | H₂SO₄, full opacity |
| **F31e** | Layered / detached haze shells | stacked aerosol shells, **detached** upper layer | photochemical, multi-shell |
| **F31f** | Eyeball substellar cloud + terminator ring | fixed bright "pupil" cloud + day/night ring | tidal-lock circulation (P21) |

**Processes:** P18 cloud condensation · P19 photochemical haze · P21 tidally-locked circulation (cloud side only).
**Drivers:** D4 atmosphere **composition** (→ cloud SPECIES/color) · D5 **density**/pressure (→ opacity) · D1 T/P gradient (→ deck altitude / which volatile condenses) · D7 tidal-lock (→ eyeball pupil).

**The canonical claim this family proves:** *same driver (atmosphere), six looks by L1 regime.*
A single semantic-uniform set — `cloudSpecies` (which volatile → color) + `cloudOpacity` (does ground
show through?) + `hazeMuting` (P19 flattening) — selects among all six with **no type branch**. The
six "types" are six presets of those three knobs (+ existing `uCloudCoverage`, +`uTidalLock` for F31f).

### Cross-domain seams (DEFER + note the handoff)

- **P21 splits three ways.** I own only the **eyeball substellar CLOUD + terminator cloud RING**
  (F31f). The **thermal emission** (dayside hotspot F32 / nightside glow F33) → **BANDS/STORMS**
  (it is `uEmissive`-driven, already a Stage-A composite term). The **limb/terminator scattering
  OPTICS** (reddened terminator F35, rim glow F34) → **OPTICAL**. My terminator-ring shadow uses
  `diff` (the day/night boundary) as a *mask for where cloud lives*, not as a scattering optic — no
  overlap, but the visual seam (cloud ring vs scattering twilight band) sits at the same latitude
  and must be art-directed together. **Flag for OPTICAL: the F31f cloud ring and the F35 twilight
  band co-locate at the terminator; decide layering order in the composite.**
- **Gas-giant band TOPS (F31b).** I own the cloud-deck **material/opacity** (the deck reads as the
  surface: `cloudOpacity = 1`, species→color); **BANDS/STORMS owns the band PATTERN** (latitude
  banding, zonal jets, storm-mask swirl, F24/F27). Concretely: BANDS produces the base albedo/relief
  of the gas-giant surface; my contribution is "this surface IS a cloud deck of species X at opacity
  1, with the species color and a faint condensation-relief detail." **Flag for BANDS/STORMS: who
  writes the final gas-giant surface color? Proposal — BANDS writes the banded base; CLOUDS supplies
  `cloudSpecies`→tint that BANDS multiplies in. Single seam, decide at integration.**
- **Aurora is OPTICAL's.** I share the Stage-A `uAuroraIntensity` term only as context (it already
  composites alongside my cloud term); I do not touch it.

---

## 2. Per-feature research

Each variant below is written as **(a) Render HOW** (extending the existing `cw`/`cloud`/`cloudC`
lines), **(b) Generation path** (D#→P#→uniform, extending `deriveUniforms`), **(c) Envelope
interaction**, **(d) Quality-scalar fallback**.

### The shared machinery (all six build on this)

The whole family is **one extended cloud block** in the fragment shader. The six looks come from
three new uniforms modulating the existing term, plus the existing `uCloudCoverage` and `uTime`:

```glsl
// EXTENDED cloud block (replaces lab lines 377-382). Pseudocode — Stage-C tunes constants.
// --- 1. cloud density field (existing analytic fbmd base; drift only for weather species) ---
float drift = uCloudDrift * uTime * 0.02;            // 0 for permanent decks (Venus/sub-N/pupil)
vec4  cw    = fbmd(vPos * uCloudScale + vec3(drift, 0.0, 0.0), 5.0, 0.0);
// --- 2. coverage threshold: low threshold => more coverage; opacity collapses it to a blanket ---
float cover = smoothstep(uCloudThresh, uCloudThresh + 0.35, cw.x);   // patchy
cover = mix(cover, 1.0, uCloudOpacity);              // opacity=1 => full blanket (F31b/c/d)
float cloudMask = cover * uCloudCoverage;
// --- 3. species color (D4-composition selector) ---
vec3 species = uCloudColor;                          // set CPU-side from composition string
// --- 4. clouds-as-relief: feed cloud height into the SAME normal calc so tops self-shade ---
//      (only when opacity<1 and we want puffy relief; gas decks use band relief instead)
float cloudLit = diff + 0.05;                        // posterized-safe: routes through lighting
vec3 cloudC = species * cloudMask * cloudLit;
cloudC = posterize(cloudC, uLevels, fc, 0.4, uDitherMode);   // posterized WITH surface (Stage A)
// --- 5. haze muting (P19): coverage-weighted lerp of the WHOLE composite toward haze color +
//      contrast collapse toward its own mean. Runs LAST, over surface+clouds. ---
//      applied in the final-composite section, see §2 F31c.
```

CPU side, `deriveUniforms` gains a **composition→species selector** (one switch on the existing
`d.atmosphere.composition` string — the only "branch," and it lives in CPU JS, NOT the shader):

```js
// extends planet-lod-lab-core.js deriveUniforms() — see §3 registry for full table
const comp = d.atmosphere?.composition ?? 'none';
const species = CLOUD_SPECIES[comp];   // {color, opacity, drift, scale} bundle, table in §3
```

---

### F31a — Terrestrial weather clouds *(patchy white over visible ground)*

**(a) Render HOW.** This is the *baseline* the existing lab term already does — extend, don't
replace. Keep `uCloudOpacity ≈ 0` (ground shows through), `uCloudDrift = 1` (animated, P20/P18
weather — non-deterministic per Q4), species color near-white (`vec3(0.92)`). The **two real
extensions** over the current term:
1. **Clouds-as-relief** (research spec §3.2, the universal posterization adaptation): add
   `cloudMask` into the heightfield *before* the normal calc so cloud tops catch diffuse/specular
   and self-shade. This is what makes posterized clouds read as 3D puffs rather than a flat white
   overlay — the *lighting* gets dithered, which survives; faint cloud hue would not.
2. **Latitude banding** (P20 meridional circulation): bias `cw.x` by a `sin(lat*k)` term so clouds
   cluster into Hadley/ITCZ bands rather than uniform speckle — the existing production terrestrial
   path already does this (`Planet.js:589-610`, `latBias`); port that bias, do not invent new.
   `lat = N.y` (object-space normal y, already used for aurora at lab:385).

**(b) Generation path.** D4=`n2-o2`/`co2-n2` (temperate secondary atmo) → P18+P20 → species=white,
opacity≈0, coverage from `uCloudCoverage`. The existing `cloudCoverage = habitability + 0.2`
derivation (core.js:67) is the right driver — habitable worlds are cloudy. **Extend** it so coverage
also scales with D5 pressure (thin air → wispy → low coverage). Uniforms: `uCloudColor` (vec3),
`uCloudOpacity=0.0`, `uCloudDrift=1.0`, `uCloudScale≈1.7`, `uCloudThresh≈0.15` (matches current).

**(c) Envelope.** Posterized WITH the surface (Stage A rule) — already done at lab:382. Clouds-as-
relief routes detail through `diff`, the posterize-survival path. Keep. No bypass.

**(d) Quality fallback.** Cheap = the current single in-shader term (no shell). Rich = optional
cloud-shell parallax at high `lodRamp` only (see §5 risk). `qualityTier<0.5` forces single-shell.

---

### F31b — Gas-giant band tops *(the deck IS the surface)*

**(a) Render HOW.** Set `uCloudOpacity = 1.0` → `cover` collapses to a full blanket; no ground
shows through. The deck color = `uCloudColor` from **Sudarsky species** (§3 table: NH₃ class-I
white/pale, H₂O class-II bright, NH₄SH bluish-when-UV-irradiated, methane class-III azure). The
band PATTERN and zonal swirl are **BANDS/STORMS' domain** — my term supplies the species TINT and
a faint **condensation relief** (sub-octave `fbmd` perturbation so the deck has soft cloud-top
texture under the bands, not a flat paint). Concretely my contribution multiplies into BANDS' base:
`gasSurface *= mix(vec3(1.0), uCloudColor, uCloudOpacity)`.

**(b) Generation path.** D4=`h2-he` (primordial) + D1 T_eq picks the Sudarsky class → species color:
T_eq<150K→ammonia white, <250K→water bright, 350-800K→cloudless azure (class III, opacity drops!),
>900K→alkali dark, >1400K→silicate. **This T_eq→Sudarsky-class map is the gas-giant cloudSpecies
selector** and is the single most science-grounded mapping in this doc (Sudarsky 2003, verified).
Uniforms: `uCloudColor` from class, `uCloudOpacity=1.0` (except class III → 0.2, "cloudless").

**(c) Envelope.** The deck color posterizes with the gas surface (single composite). High-contrast
band luminance survives cleanly (research spec §3.2). No bypass.

**(d) Quality fallback.** No shell ever (the deck is the surface). Relief detail octaves trim with
`qualityTier`.

---

### F31c — Sub-neptune featureless haze *(flat muted globe)* — **the muting reference**

**(a) Render HOW.** This is where **`hazeMuting` (P19)** is defined, because F31c is its maximum.
Haze muting is a **coverage-weighted flattening of the whole composite**, applied LAST (after
surface+clouds, before final clamp):

```glsl
// haze muting — P19. hazeMuting 0 (clear) .. 1 (sub-neptune featureless).
vec3 lit = surface + cloudC;                 // the assembled lit globe
float luma = dot(lit, vec3(0.299, 0.587, 0.114));
vec3 flattened = mix(lit, vec3(luma), uHazeMuting * 0.85);   // collapse contrast toward mean
vec3 hazed = mix(flattened, uHazeColor, uHazeMuting * 0.6);  // lerp toward aerosol color
lit = hazed;
```
This is the *aerial-perspective* recipe (desaturate + contrast-collapse + tint, grounded below)
applied globally rather than by depth. At `uHazeMuting = 1` the globe becomes a near-uniform
`uHazeColor` disk — exactly the "flat, structureless muted globe" F31c demands, matching the
**flat, featureless transmission spectrum of GJ 1214 b** (high-metallicity aerosol blanket, verified).

**(b) Generation path.** D4=`h2-he`/high-metallicity + D1 (UV from insolation drives photochemistry)
→ P19 → `hazeMuting` high (0.8-1.0), `hazeColor` muted orange/grey (tholin). The driver is **UV
flux** (already computed in PhysicsEngine: `uvFlux = luminosityRel/(orbitAU²)`, :170) × low D13
field → more photochemistry → more muting. Uniforms: `uHazeMuting` (float), `uHazeColor` (vec3).

**(c) Envelope.** Muting runs *before* the final posterize on the surface+cloud composite, so the
flattened result still posterizes — but with everything crushed to ~1-2 luminance buckets, the
dither pattern itself becomes the only texture. **Triage call: this is FINE** — a featureless globe
*should* read as a flat dithered disk. No bypass; muting and posterize compound intentionally.

**(d) Quality fallback.** Trivially cheap (one lerp pair). No fallback needed — `hazeMuting` is the
*same* uniform at all tiers.

---

### F31d — Venus opaque blanket *(total reflective shroud + UV Y-markings)*

**(a) Render HOW.** `uCloudOpacity = 1.0` (total shroud, ground never shows) + `uCloudDrift` slow
(quasi-permanent, NOT weather-drift) + species color cream/yellow (H₂SO₄). The reflective shroud =
high coverage, high albedo, low relief. **UV Y-markings** (the faint planet-scale "Y"/"ψ" dark
streak): a very-low-frequency `fbmd` band warped into a broad sinuous streak, subtracted from the
deck albedo. Grounded: Venus's UV absorber is now attributed to **rhomboclase + acid ferric sulfate
(iron-sulfur chemistry)**, manifesting as dark UV streaks (Cambridge 2024, verified) — so the
Y-marking is a *darkening* of the cream deck, not a separate color.

**(c) Envelope — the `[subtle]` triage (REQUIRED CALL).** The UV Y-markings are flagged `[subtle]`
in the inventory: the 6-level posterize will crush a faint planet-scale tint. **Recommendation:
STYLIZE, not drop.** Make the Y-marking a deliberate ~15-20% albedo *step* (not a faint gradient)
so it survives one posterize bucket as a visible darker streak — i.e. push it into the luminance
that the dither quantizes, the same survival rule as everything else. Gate it behind a
`uVenusMarkings` toggle (default on for Venus preset, off elsewhere). If it reads as noise rather
than a coherent Y at posterize-6, **drop it** — 3-cycle cap on this one sub-feature.

**(b) Generation path.** D4=`co2` + D5 high pressure (≥90 bar) + D1 hot → species=cream/yellow,
opacity=1, hazeMuting moderate (Venus is a blanket, not featureless — markings need to read).
Uniforms: `uCloudColor=vec3(0.95,0.9,0.7)`, `uCloudOpacity=1.0`, `uVenusMarkings` (float toggle).

**(d) Quality fallback.** No shell. Markings toggle off at low `qualityTier`.

---

### F31e — Layered / detached haze shells *(stacked aerosol shells, detached upper layer)*

**(a) Render HOW.** This is the **one variant that genuinely needs cloud-shell parallax** — the
"detached" haze layer (Titan, Pluto) is *visibly above* the main deck with a gap. Two render paths:
1. **Limb-only fake (cheap, recommended default):** render the detached shell ONLY at the limb as
   a thin offset rim band — `pow(1 - dot(N,V), k)` (fresnel, like the existing limb term lab:373)
   at a *larger* effective radius, tinted `uHazeColor`, with a dark gap below it. This gives the
   silhouette-edge "floating ring of haze" read (which is how detached layers are actually seen —
   in profile at the limb) for ~3 instructions, no second draw call. **This is the F31e headline
   technique** and it sidesteps the parallax-artifact risk entirely.
2. **True shell (rich, LOD2 only):** a second sphere at `radius * 1.02-1.05`, `depthWrite:false`,
   independent slow rotation, additive haze. Reserve for `lodRamp` near 1 only.

**(b) Generation path.** D4 photochemical (CH₄/N₂ or sub-neptune aerosol) + D1 (cold, UV) + D6
retention → P19 → `hazeShellCount` (1=single deck, 2=detached upper). Real anchor: Titan's detached
haze sits at **~350-500 km** and descends seasonally (verified) — so shell altitude is a tunable
`uHazeShellAlt` (mapped to a fraction-of-radius offset, exaggerated per the "system map is
representational not true-scale" design principle). Uniforms: `uHazeShellAlt` (float),
`uHazeShellStrength` (float).

**(c) Envelope.** Limb-only fake routes through fresnel luminance → survives posterize. The shell's
additive haze should *bypass* the quantizer (smooth rim glow, like `limbBypass`) so the detached
band doesn't band into chunky steps. **Use `limbBypass` channel.**

**(d) Quality fallback.** `qualityTier<0.5` → limb-only fake (path 1). Desktop high-`lodRamp` → true
shell (path 2). The shell is the single most expendable richness in this whole domain.

---

### F31f — Eyeball substellar cloud + terminator ring *(fixed pupil + day/night ring)*

**(a) Render HOW.** Tidal-lock (D7) gives a **permanent** substellar point (the sub-stellar
direction = the sun direction `uLightDir`). Two fixed cloud features, both keyed off
`s = dot(N, uLightDir)` (the substellar cosine, NOT animated — quasi-permanent per Q4):
1. **Pupil cloud:** `smoothstep(0.85, 1.0, s)` → a bright fixed cap of dense cloud at the substellar
   point (rising convection over the hot spot, P21). Boost `cloudMask` inside this cap.
2. **Terminator ring:** `exp(-pow((s - 0.0)/0.12, 2.0))` → a gaussian band at `s≈0` (the day/night
   terminator) where day→night circulation dumps condensate (P21). A ring of cloud at the
   terminator latitude.

Both reuse the existing `cw` density field; they are *masks* that modulate `cloudMask` by substellar
geometry. `uCloudDrift = 0` (the pupil and ring are locked to the star, not drifting weather).

**(b) Generation path.** D7 `tidalState.locked` → `uTidalLock = 1`; D1 day/night contrast → ring
strength. Species = white (water) if temperate, else from composition. Uniforms: `uTidalLock`
(float 0/1), `uPupilStrength` (float), `uTermRingStrength` (float). The substellar direction is
already available as `uLightDir`.

**(c) Envelope.** Posterized with surface. The pupil is high-contrast bright → survives. The
terminator ring co-locates with the OPTICAL twilight band (seam noted §1) — **layer the cloud ring
UNDER the optical twilight tint** so the reddened terminator reads on top of the cloud.

**(d) Quality fallback.** Pure masks on the existing term — cheap at all tiers. No fallback needed.

---

## 3. Proposed semantic-uniform registry additions

**Extends** the existing `uCloudCoverage` / `uTime` — does NOT duplicate them. All driver-derived in
`deriveUniforms`; consumed generically by the one cloud block (no `planetType` in shader).

| Uniform | Type | Driver → Process | Range | Default | Role |
|---|---|---|---|---|---|
| `uCloudCoverage` | float | D5,D15 → P18 | 0..1 | *existing* | overall cloud amount (KEEP — already wired) |
| `uTime` | float | — | sec | *existing* | drift clock (KEEP — only used when `uCloudDrift>0`) |
| **`uCloudColor`** | vec3 | **D4 → P18** | rgb | (0.92,0.92,0.94) | **species color** (Sudarsky/H₂SO₄/tholin) |
| **`uCloudOpacity`** | float | D5 → P18 | 0..1 | 0.0 | 0=ground shows (F31a) · 1=blanket (F31b/d) |
| **`uHazeMuting`** | float | D4,D1(UV) → P19 | 0..1 | 0.0 | global flatten+tint (F31c max, F31e mid) |
| **`uHazeColor`** | vec3 | D4 → P19 | rgb | (0.7,0.6,0.45) | aerosol/tholin muting target |
| `uCloudDrift` | float | P18/P20 vs P21 | 0..1 | 1.0 | 1=weather drift (F31a) · 0=permanent (d/f) |
| `uCloudScale` | float | — | 1..4 | 1.7 | cloud-field frequency (matches existing) |
| `uCloudThresh` | float | D5 → P18 | 0..0.5 | 0.15 | coverage threshold (matches existing) |
| `uTidalLock` | float | D7 → P21 | 0/1 | 0.0 | enables pupil+terminator-ring masks (F31f) |
| `uPupilStrength` | float | D7,D1 → P21 | 0..1 | 0.0 | substellar cloud cap boost (F31f) |
| `uTermRingStrength` | float | D7,D1 → P21 | 0..1 | 0.0 | terminator cloud ring (F31f) |
| `uHazeShellAlt` | float | D4,D1 → P19 | 0..0.1 | 0.0 | detached-shell radius offset (F31e) |
| `uHazeShellStrength` | float | D4 → P19 | 0..1 | 0.0 | detached-shell visibility (F31e) |
| `uVenusMarkings` | float | D4(Fe-S) → P18 | 0..1 | 0.0 | UV Y-marking strength `[subtle]` (F31d) |

**The cloudSpecies selector (CPU, the only "branch" — in JS, not shader).** `deriveUniforms` reads
`d.atmosphere.composition` (string, already produced by `computeAtmosphere`) and `d.T_eq`:

```js
// CLOUD_SPECIES bundle table — grounded in Sudarsky 2003 (gas) + solar-system clouds (rocky).
// composition strings come from PhysicsEngine.computeAtmosphere: h2-he | co2 | co2-n2 | n2-o2 | none
function cloudSpeciesFor(comp, T) {
  if (comp === 'none')   return { color:[0,0,0],          opacity:0, drift:1, muting:0 };       // no clouds
  if (comp === 'co2')    return { color:[0.95,0.90,0.70], opacity:1, drift:0, muting:0.3 };     // Venus H2SO4 cream
  if (comp === 'n2-o2')  return { color:[0.92,0.92,0.94], opacity:0, drift:1, muting:0 };       // terrestrial H2O white
  if (comp === 'co2-n2') return { color:[0.85,0.80,0.72], opacity:0.2, drift:1, muting:0.15 };  // thin/dusty
  if (comp === 'h2-he') {                                                                        // gas/sub-N -> Sudarsky by T
    if (T < 150)  return { color:[0.95,0.93,0.88], opacity:1, drift:0.3, muting:0.1 };          // I  ammonia white
    if (T < 250)  return { color:[0.98,0.98,1.00], opacity:1, drift:0.4, muting:0.05 };         // II water bright
    if (T < 800)  return { color:[0.30,0.45,0.75], opacity:0.2, drift:0.5, muting:0.5 };        // III cloudless azure
    if (T < 1400) return { color:[0.15,0.10,0.10], opacity:1, drift:0.6, muting:0.2 };          // IV alkali dark
    return            { color:[0.55,0.30,0.25], opacity:1, drift:0.7, muting:0.1 };             // V  silicate reflective
  }
}
```
This table is the **D4-composition → cloud-species mapping made explicit** that the inventory's
F-clouds note demands. **Tunable constants; the LOGIC (h2-he+hot→azure cloudless, co2→opaque cream)
is what Stage-C unit tests should pin** (mirroring the existing core.js test pattern). Sub-neptune
is `h2-he` + high `uHazeMuting` overriding the class color toward `uHazeColor` (the aerosol wins).

---

## 4. Lab folder spec — `▸ Clouds & Haze`

lil-gui folder (spec §3 names it). Collapsed unless active. Every control = one semantic uniform
(spec §3 rule 2). Suggested layout:

```
▸ Clouds & Haze
  ├─ preset            ['terrestrial','gas-deck','sub-neptune','venus','titan-layered','eyeball']
  │                    (dropdown — loads a CLOUD_SPECIES bundle into the controls below)
  ├─ Condensation (P18)
  │   ├─ coverage      uCloudCoverage   0..1
  │   ├─ opacity       uCloudOpacity    0..1   (0 ground-through ↔ 1 blanket)
  │   ├─ color         uCloudColor      colorpicker
  │   ├─ scale         uCloudScale      1..4
  │   ├─ threshold     uCloudThresh     0..0.5
  │   └─ drift         uCloudDrift      0..1   (0 permanent ↔ 1 weather)
  ├─ Haze (P19)
  │   ├─ muting        uHazeMuting      0..1   (→ sub-neptune featureless at 1)
  │   ├─ haze color    uHazeColor       colorpicker
  │   ├─ shell alt     uHazeShellAlt    0..0.1 (detached layer offset)
  │   └─ shell str     uHazeShellStrength 0..1
  ├─ Tidal-lock (P21)
  │   ├─ locked        uTidalLock       0/1
  │   ├─ pupil         uPupilStrength   0..1
  │   └─ term ring     uTermRingStrength 0..1
  └─ Venus markings    uVenusMarkings   0..1   ([subtle] — keep/stylize/drop probe)
```

The `preset` dropdown is the **driver-bundle preset** mechanism in action: picking 'venus' loads
`{opacity:1, color:cream, drift:0, muting:0.3, markings:1}`. This is how "types" appear in the lab
without a shader branch. The presets should be **derivable from `deriveUniforms`** given a synthetic
driver bundle, so the lab and production tell one story — wire the dropdown to call
`cloudSpeciesFor(comp, T)` with the preset's representative `(composition, T_eq)`.

---

## 5. 3-cycle-cap risk flags (with named fallbacks)

1. **Cloud-shell parallax artifacts (F31e/F31a-rich).** A second sphere at `radius*1.03` will (a)
   z-fight / clip into the surface at grazing angles, (b) show a hard silhouette mismatch at the
   limb, (c) double the draw call. **This is the likeliest cap-hit.** *Fallback (pre-committed):*
   the **limb-only fresnel fake** (§2 F31e path 1) — no second draw, gives the detached-layer
   silhouette read for ~3 instructions. Build the fake FIRST; only attempt the true shell if the
   fake reads as flat at high `lodRamp`. Do NOT death-spiral on shell z-fighting — switch to fake.

2. **Terminator-shadow / ring seam (F31f).** The terminator cloud ring co-locates with OPTICAL's
   reddened twilight band AND the day/night `diff` cutoff. Risk: the ring, the twilight tint, and
   the posterize bucket boundary all land at `s≈0` and produce a hard ugly seam line. *Fallback:*
   widen the ring gaussian (`/0.18` instead of `/0.12`) so it straddles the terminator softly, and
   fix layering order (cloud ring UNDER optical tint, §2 F31f). If still seamy at posterize-6,
   stylize the ring as a deliberate single-bucket band rather than fighting for a smooth gradient.

3. **Haze muting that just looks like grey fog (F31c).** Risk: `mix(lit, hazeColor, muting)` with a
   neutral haze color produces "someone turned the brightness down," not "a real aerosol-shrouded
   world." *Fallback:* (a) use a *chromatic* `uHazeColor` (tholin orange / sub-neptune slate-blue,
   not grey) so the muting reads as atmosphere, not a fade; (b) keep a faint residual large-scale
   `fbmd` band even at `muting=1` so the globe has *some* structure (a real featureless globe still
   has a limb-darkening gradient and a subtle terminator). The contrast-collapse-toward-mean term
   (not just the tint lerp) is what sells it — keep both halves of the recipe.

4. **(Secondary) Gas-deck ownership collision with BANDS/STORMS.** If both domains write the
   gas-giant surface color independently, they'll fight. *Mitigation (not a cap):* the integration
   contract in §1 — BANDS writes banded base, CLOUDS supplies a species tint multiplied in. Decide
   at Stage-C integration, not now.

---

## 6. Open questions for Max (taste / scope)

1. **Cloud-shell parallax — build it at all?** My recommendation is the **limb-only fresnel fake**
   for F31e and **no true shell** anywhere in v1 (the parallax-artifact risk is high and the payoff
   is one variant's detached layer). True multi-shell parallax is the single most expendable
   richness in this domain. **Confirm: limb-fake only, defer true shells?** (My call: yes.)

2. **Venus UV Y-markings (`[subtle]`) — keep/stylize/drop?** My recommendation: **stylize** as a
   deliberate ~15-20% albedo step behind `uVenusMarkings`, 3-cycle cap → drop if it reads as noise
   at posterize-6. Confirm you want it attempted, or drop outright to save budget.

3. **Sub-neptune featureless globe — how featureless?** A truly flat disk (muting=1, no residual
   structure) is scientifically honest (GJ 1214 b) but may read as "unfinished planet" to a player.
   Do you want a *faint* residual band/limb-gradient kept (risk-flag 3 fallback), or fully flat?
   This is pure taste — flag because "correct" and "reads as a planet" diverge here.

4. **Gas-deck color authority.** Confirm the §1 seam resolution: BANDS/STORMS owns the band pattern
   + base, CLOUDS supplies the species tint. If you'd rather CLOUDS own the whole gas surface color
   (and BANDS only the band *geometry*), say so — it changes who writes the final gas albedo.

5. **Eyeball pupil — animated or frozen?** Q4 says weather drifts, structure is fixed. The substellar
   pupil cloud is *quasi-permanent* (locked to the star) but real circulation makes it churn. Frozen
   (cheap, deterministic) or slow-churn (`uCloudDrift≈0.2`, prettier, non-deterministic)? My call:
   slow-churn — it's the dramatic centerpiece of an eyeball world.

---

## 7. Sources (verified this session)

- **Sudarsky's gas giant classification** — class I-V, T-ranges, condensate species (ammonia /
  water / cloudless-azure / alkali / silicate), albedos. The backbone of the gas-deck cloudSpecies
  selector. https://en.wikipedia.org/wiki/Sudarsky's_gas_giant_classification (verified — class
  table fetched)
- **Jupiter cloud/haze structure** — ammonia deck at ~0.5-1 bar, stratospheric photochemical haze
  above; NH₄SH bluish when UV-irradiated; ammonia/water ice colorless (chromophores from S/P/organics).
  https://arxiv.org/pdf/1905.02978 (Cassini ISS multi-spectral, verified via search snippet) ·
  https://www.gamedev.net/blogs/entry/1388471-glsl-gas-giants-atmospheric-scattering/ (GLSL gas-giant
  color-table + noise-transparency approach)
- **Venus clouds** — H₂SO₄ droplet deck 50-52 km, haze to 68 km, detached haze ~77 km; UV absorber =
  rhomboclase + acid ferric sulfate (iron-sulfur), manifesting as dark UV streaks (the Y-marking is a
  *darkening*). https://www.cam.ac.uk/research/news/mysterious-missing-component-in-the-clouds-of-venus-revealed
  · https://www.science.org/doi/10.1126/sciadv.adg8826 (both verified via search)
- **Titan detached haze** — descends ~500→350 km (2008-2011); Voyager-2 357 km post-equinox; tied to
  stratospheric circulation top. Anchors `uHazeShellAlt`. (verified via search; arxiv 2402.01957 region)
- **GJ 1214 b** — flat, featureless near-IR transmission spectrum → high-metallicity aerosol/haze
  blanket. Anchors F31c "featureless globe." https://arxiv.org/abs/2305.05697 ·
  https://arxiv.org/html/2410.10186v1 (verified via search)
- **Tholin as chromophore / photochemical haze color** — Titan tholin organic feature; tholin used as
  exoplanet coloration chromophore. Anchors `uHazeColor` (orange). (search snippets; arxiv 1412.7582)
- **Cloud-shell / multi-layer rendering** — @takram/three-clouds (up to 4 layers, cube-sphere UV,
  offset/repeat tiling); Three.js Journey earth-shaders (cloud+specular packed, terminator cloud
  shadow). https://www.npmjs.com/package/@takram/three-clouds ·
  https://threejs-journey.com/lessons/earth-shaders (verified via search)
- **Aerial-perspective / haze muting recipe** — desaturate + contrast-collapse + tint-toward-haze
  via `mix`; Mie exponential-height density. The basis for the `uHazeMuting` lerp pair.
  https://www.d5render.com/posts/atmospheric-perspective-for-aerial-rendering ·
  https://github.com/jwagner/terrain/blob/master/shaders/atmosphere.glsl (verified via search)
- **Foundational HOW (reused vocabulary)** — `research/RESEARCH_high-lod-planet-shaders-2026-06-05.md`
  §3.2 (clouds-as-relief, cloud-shell vs in-shader, terminator cloud shadowing, fresnel atmosphere).
- **Existing production cloud paths (ported, not reinvented)** — `src/objects/Planet.js:379-388`
  (gas/eyeball), `:584-636` (terrestrial latBias / Venus / rocky dust), `:951+` (exotic). Lab term:
  `world-engine-lab.html:377-392`. CPU derivation: `planet-lod-lab-core.js:51-71`.

> **Integrity note:** Sudarsky class table and the Wikipedia fetch are first-hand verified. Venus
> UV-absorber, Titan haze altitude, GJ 1214 b flat-spectrum, and tholin-chromophore claims are from
> search-snippet level (titles + abstracts), not full-text fetch — directionally solid (multiple
> concordant sources) but exact altitude/color numbers should be re-confirmed at Stage-C if used as
> hard constants. All color/opacity values in the §3 table are **art-direction starting points**, not
> measured albedos.
