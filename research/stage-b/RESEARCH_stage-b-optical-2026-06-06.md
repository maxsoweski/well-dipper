# Stage-B Research — OPTICAL / ATMOSPHERE domain (limb, terminator, glint, aurora)

**Date:** 2026-06-06 · **Domain:** Optical / Atmosphere · **Stage:** B (per-domain HOW + generation-path)
**Project:** `~/projects/well-dipper` · three.js r183.1 / WebGL2 · desktop-primary, graceful mobile
**Feeds:** Stage-C implementation in `world-engine-lab.html` (`▸ Optical / Atmosphere` folder)
**Frame docs:** `docs/superpowers/specs/2026-06-06-planet-rendering-foundation-design.md` (§2.D/§2.E),
`research/RESEARCH_high-lod-planet-shaders-2026-06-05.md`, `docs/FEATURES/planet-visual-features.md`

> **One-line thesis.** The Optical domain is where the system's two defining
> architectural patterns *already live in working form*: (1) the aurora/atmosphere
> driver→semantic-uniform path that **§2.D generalizes for every feature** — this domain
> owns the reference implementation, not just a consumer of it; and (2) the
> **fresnel ↔ Lague-raymarch quality fork** that **§2.E names as the canonical
> `qualityTier` example**. So this doc is partly "research new optics" and partly
> "document the precedent the rest of Stage B is told to imitate."

---

## 1. Scope

### Owned feature IDs (from `planet-visual-features.md` §F-optical)
| ID | Feature | Status today | Variants in scope |
|---|---|---|---|
| **F34** | Limb / atmosphere rim glow | `[current]` (fresnel) | fresnel rim · blue line · thick haze halo |
| **F35** | Terminator color gradient | `[current]` (day/night) | reddened day/night boundary · twilight band |
| **F36** | Sunglint off liquid | `[aspirational]` (no specular in pipeline) | sharp specular spot on water / methane sea |
| **F37** | Aurorae | `[current]` (physics-gated) | polar ovals · ring lat/width by field strength |
| **F38** | Airglow / nightglow limb band | `[subtle]` | faint diffuse night-limb ring |
| **F39** | Cloud optics (rainbows / glories) | `[subtle]` | colored arcs/rings of uniform-droplet clouds |

### Owned processes
- **P24** — Aurora & airglow (`D13` hard gate, D4, stellar wind/D1).
- **P26** — Optical / atmospheric scattering (D5, aerosol, D6, geometry, surface liquid).

### Owned drivers
- **D13 magnetic field strength** — HARD aurora gate (`fieldStrength > 0.05`); ring geometry
  scales with strength. **Computed inline, NOT surfaced as a first-class field — the key
  generation-side deliverable of this domain (see §3 + §2.b).**
- **D5 atmosphere density** — limb thickness, haze halo depth, scattering optical depth.
- **D6 atmosphere retention** — gates whether *any* limb/terminator/scattering exists.
- **D4 atmosphere composition** — limb tint, terminator redness, aurora emission color.
- **surface-liquid** (derived, D1+D2+D6) — sunglint mask. **Consumed from the FLUVIAL agent.**
- **view/light geometry** — fresnel angle, terminator band, sunglint reflection vector.

### Cross-domain seams (DEFER + note the handoff)
| Seam | Who owns what | Contract needed |
|---|---|---|
| **P21 three-way split** (tidally-locked worlds) | **This domain owns the limb/terminator OPTICS** above a locked world's atmosphere. **BANDS/STORMS owns thermal emission (F32/F33).** **CLOUDS/HAZE owns the substellar "pupil" cloud (F31f).** | We read the locked-world atmosphere `density`/`composition` uniforms; we do NOT compute the dayside hotspot or the standing cloud. Our terminator gradient must *composite over* their cloud term without double-darkening. |
| **F36 sunglint ← FLUVIAL liquid mask** | FLUVIAL produces a `uLiquidMask` (0..1, + a `uLiquidType` enum water/methane). We consume it to gate the specular spot. | **We must NOT invent our own liquid mask.** If FLUVIAL's mask isn't ready, sunglint ships behind a lab toggle reading a placeholder analytic mask, flagged as stub. |
| **F41 magma-ocean (EXOTIC)** | EXOTIC owns the molten dayside **emissive** + magma shoreline. **We own the atmospheric scattering *above* it** (a thin silicate-vapor atmosphere still has a limb). | Our limb term reads `uLimbStrength`; EXOTIC's emissive is a *separate* composite term (`uEmissive`, already split). No overlap if both stay additive. |
| **Aurora curtain noise ← base `noised()`** | RELIEF/foundation owns the analytic `noised()` core. We sample it for curtain rays (Q7: convert aurora off plain `snoise`). | Already done in the lab (`noised(N*8.0…)` at `world-engine-lab.html:388`). Keep it; do not re-introduce `snoise`. |

---

## 2. Per-feature research

> Notation: **(a) Render HOW**, **(b) Generation path** (D#→P#→semantic-uniform),
> **(c) Envelope interaction** (posterize bypass / keep-stylize-drop), **(d) Quality-scalar
> fallback**. Everything is anchored to the aurora precedent (`Planet.js:178-200, 391-407`;
> `PlanetGenerator.js:435-485`; lab `world-engine-lab.html:372-392`, `planet-lod-lab-core.js:46-71`).

---

### F34 — Limb / atmosphere rim glow (fresnel · blue line · thick haze halo)

**(a) Render HOW.** Three reachable variants behind ONE `uLimbStrength` + a `uLimbModel` enum.

- **Variant 1 — Fresnel rim (`[current]`, cheap default, mobile).** Already shipping, both in
  production (`Planet.js:391-404`) and lab (`:372-375`):
  ```glsl
  float fres = pow(1.0 - max(dot(N, V), 0.0), uLimbFalloff);   // falloff 2..4
  float sunFacing = smoothstep(-0.1, 0.3, diff);               // dark on night limb
  vec3 limbC = uLimbColor * fres * uLimbStrength * sunFacing;
  ```
  O(1), one term, no march. **This is the `qualityTier < 0.5` path.** The "blue line" variant
  is just this with `uLimbColor` = a saturated blue and a *tighter* falloff (`pow ^4`) so the
  glow hugs the edge (Earth's thin blue line); the "thick haze halo" variant is a *wider*
  falloff (`pow ^1.5`) + higher `uLimbStrength` + a desaturated tint (Titan/Venus). All three
  are the same shader, different uniform values → driver-bundle presets, no branch.

- **Variant 2 — Lague raymarched scattering (`qualityTier ≥ 0.5`, desktop rich path).**
  The canonical §2.E fork. Per Sebastian Lague's *Coding Adventure: Atmosphere* and the
  GPU-Gems-2 Ch.16 (O'Neil) / Bruneton lineage:
  1. Ray–sphere intersect the atmosphere shell (`planetRadius` → `planetRadius * atmoScale`,
     ~1.025–1.10× by D5).
  2. March ~10 *view* samples along the in-atmosphere segment.
  3. At each view sample, march ~10 *sun* samples toward the light for optical depth, or
     **read a baked optical-depth LUT** (the O'Neil/Bruneton optimization — a 2D texture keyed
     by altitude × view-zenith) to collapse the inner loop. URP-Atmosphere bakes exactly this.
  4. Accumulate Rayleigh (`λ⁻⁴` wavelength term → blue-biased) + Mie (forward-scatter phase,
     `g≈0.76`) in-scatter, attenuated by `exp(-opticalDepth)`.
  This produces a *physically-graded* limb that reddens toward the terminator **for free**
  (long slant path scatters out blue) — so F34 Variant-2 and F35's "reddened boundary"
  are the **same computation** at this tier (note this in §5 — it's a feature, not a seam).

**(b) Generation path.**
`D5 density` + `D6 retention` + `D4 composition` → **P26** → CPU derives:
- `limbStrength` (already in `deriveUniforms`: `hasAtmo ? 0.7 : 0.0`) — scale by D5 so thick
  atmospheres glow harder: `limbStrength = retained ? mix(0.4, 1.0, densityNorm) : 0.0`.
- `limbColor` — from D4 composition (n2-o2 → blue `[0.5,0.6,0.9]`; co2 → ochre `[0.8,0.6,0.4]`;
  h2-he → pale cyan; sub-neptune haze → grey-violet). **Mirror the aurora-color lookup table
  pattern** at `PlanetGenerator.js:462-469` — a `composition → vec3` dict, no type branch.
- `limbModel`/`atmoScale`/`limbFalloff` — D5 sets falloff (thin → tight blue line, thick →
  wide halo) and shell scale.
This is **exactly the aurora derivation generalized**: physics field → small CPU mapping →
flat semantic uniform → generic shader consumption. **Document this as the §2.D template.**

**(c) Envelope interaction.** Limb is a **GLOW → bypass the quantizer** (`uLimbBypass`, already
in the lab `:374-375`, default-bypass recommended). A banded rim glow reads as a rendering bug;
the smooth additive term over the posterized surface is the whole point of the composite-split.

**(d) Quality-scalar fallback.** `qualityTier` selects fresnel (cheap) ↔ raymarch (rich) behind
`uLimbModel`. Mid-tier option: **baked-LUT raymarch** (Variant 2 step 3 with the LUT, skipping
the inner sun loop) — Lague/O'Neil/URP-Atmosphere all support this as the "good enough, much
cheaper" middle path. So the fork is really three rungs: fresnel → LUT-raymarch → full-raymarch.

---

### F35 — Terminator color gradient (reddened day/night boundary · twilight band)

**(a) Render HOW.** Two reachable variants.

- **Cheap (`[current]`-adjacent, fresnel tier).** The day/night boundary already exists via the
  diffuse `sunFacing` smoothstep. Add an explicit **terminator tint band**: a narrow function of
  `diff` (the Lambert term) peaking where `diff ≈ 0`:
  ```glsl
  float twilight = exp(-pow(diff / uTermWidth, 2.0));   // Gaussian centered on the terminator
  vec3 termC = uTermColor * twilight * uTermStrength * smoothstep(-0.25, 0.0, diff); // night-bias
  ```
  `uTermColor` = a reddened/orange tint (Earth sunset) or a *blue* tint (Mars blue sunset — a real,
  citable inversion driven by D4: fine dust forward-scatters red, leaving blue near the sun). This
  is a glow term → additive, bypass.
- **Free (raymarch tier).** At `qualityTier ≥ 0.5` the F34 Variant-2 scattering *produces the
  reddened terminator inherently* (long slant optical path). So at the rich tier, F35's explicit
  band is **disabled** (`uTermStrength → 0`) and the scattering owns it. The explicit band is the
  cheap-tier stand-in for what physics gives the rich tier for free.

**(b) Generation path.**
`D4 composition` + `D5 density` → **P26** → CPU derives:
- `termColor` — D4 lookup (n2-o2 → warm red-orange; co2 fine-dust → blue-biased Mars sunset;
  thick co2 Venus → deep orange). Same dict pattern as aurora/limb.
- `termWidth` — D5 (thicker atmosphere → wider twilight band): `mix(0.06, 0.25, densityNorm)`.
- `termStrength` — gated to 0 when `qualityTier ≥ 0.5 && limbModel == raymarch` (physics owns it).

**(c) Envelope interaction.** GLOW → bypass quantizer (shares `uLimbBypass` or its own
`uTermBypass`). **Keep** — terminator reddening is high-value and survives well as a smooth
additive tint; it's one of the three things (limb, glint, terminator) the §2-research names as
"looks wrong when banded."

**(d) Quality-scalar fallback.** Cheap = explicit Gaussian band; rich = falls out of raymarch.
The fork is the *same* `uLimbModel` switch — no separate quality control needed for F35.

---

### F36 — Sunglint off liquid (sharp specular spot — water vs methane)  `[aspirational]`

**(a) Render HOW.** A tight analytic specular highlight gated by a **liquid mask**, building on
the Blinn-Phong spec term already split out in the lab (`world-engine-lab.html:366-370`).

- **Baseline (Blinn-Phong spot).** Already present:
  `pow(max(dot(N,H),0.0), 48.0) * uSpecStrength`. Raise the exponent (~200–400) for a *sharp star*
  rather than a soft sheen; gate by `uLiquidMask`:
  ```glsl
  float spec = pow(max(dot(N, H), 0.0), uGlintSharpness) * uSpecStrength;
  spec *= uLiquidMask * step(0.0001, diff);           // only on lit liquid
  ```
- **Richer (GGX + Fresnel, desktop tier).** Cook-Torrance/GGX with a Schlick-Fresnel front term
  gives a physically-shaped glint that broadens with surface roughness (wave-roughened seas spread
  the glitter — exactly the "sun glitter" Cassini saw on Titan). GGX distribution's long tails are
  the right look for a wind-roughened liquid:
  ```glsl
  // GGX NDF on the half-vector, roughness from wave-state; Schlick Fresnel with F0 from IOR.
  float a = uWaveRoughness * uWaveRoughness;
  float d = a*a / (PI * pow(nh*nh*(a*a-1.0)+1.0, 2.0));
  float F = uF0 + (1.0 - uF0) * pow(1.0 - max(dot(V,H),0.0), 5.0);
  float glint = d * F * uSpecStrength * uLiquidMask * step(0.0, diff);
  ```
- **Water vs methane** differ in **IOR → F0** and **tint**. Water n≈1.33 → F0≈0.02; liquid
  methane/ethane n≈1.27–1.29 (Cassini/VIMS-constrained) → slightly *lower* F0, slightly dimmer
  glint, and a darker/amber liquid albedo. Drive both from `uLiquidType` (a FLUVIAL-supplied enum)
  → `uF0` + `uLiquidTint`. This is a real, citable distinction (Barnes et al. 2012; Adams 2012),
  not invention.

**(b) Generation path.**
`surface-liquid` (D1+D2+D6, **derived & masked by FLUVIAL**) → **P26** → CPU derives:
- `specStrength` — already in `deriveUniforms`: `(hasAtmo && liquidWater) ? 0.8 : iron*0.15`.
  Keep the metal-sheen fallback for airless metallic worlds (faint, broad).
- `uF0` + `uLiquidTint` + `glintSharpness` — from `uLiquidType` (water | methane | none).
- `uWaveRoughness` — from wind/D5 (a weather-layer value; **not determinism-bound**, may animate).
- **`uLiquidMask` is NOT ours to generate** — it is the cross-domain consume from FLUVIAL
  (see §1 seam). Note the seam explicitly in the lab control (a "liquid mask source" readout).

**(c) Envelope interaction.** Glint is a **high-energy highlight → bypass quantizer**
(`uSpecBypass`, already in the lab `:369-370`). A 6-level posterized specular spot breaks into ugly
hard rings — the bypass is mandatory for this term, more so than for limb. **Keep** (it's one of
the named "must be crisp" effects).

**(d) Quality-scalar fallback.** `qualityTier < 0.5` → Blinn-Phong spot (one `pow`, cheap, the
spot just doesn't broaden realistically with roughness). `qualityTier ≥ 0.5` → GGX+Fresnel. Same
`uSpecStrength` knob; the model switch is `uGlintModel`.

---

### F37 — Aurorae (polar ovals · ring lat/width by field strength)  `[current]`

**This is the reference implementation. Do not duplicate it — EXTEND it.**

**(a) Render HOW.** The existing term (`Planet.js:178-200`, lab `:384-390`) is sound and already
converted to the `noised()` base in the lab (Q7-compliant). Extensions:
- **Both ovals.** Current `abs(lat)` mirrors one ring to both poles (correct). Keep.
- **Curtain rays** already from `noised()` — keep; the production version still uses `snoise`
  (`Planet.js:189-190`) → **flag: convert production aurora to `noised()` to match Q7**, the lab
  already did.
- **Asymmetric oval offset** (advanced, optional): real auroral ovals are offset toward the
  nightside magnetic pole. A small `+uAuroraDayNightOffset` on the ring latitude as a function of
  sun direction adds realism cheaply. Label speculative-polish.

**(b) Generation path — THE D13 SURFACING DELIVERABLE.**
Today `fieldStrength = ironFraction × (locked ? 0.2 : 1.0)` is computed **inline twice**
(`PhysicsEngine.js:168` for stripping, `PlanetGenerator.js:440` for aurora) and consumed locally;
it is **never returned in `planetData`** (`:679-707` has no `fieldStrength`/`magneticField` field).

**Deliverable:** surface D13 as a first-class derived field, exactly as T_eq/composition are:
1. Add `magneticField` to the `PlanetGenerator.generate()` return (`:679-707`):
   `magneticField: { strength: fieldStrength, locked: isLocked }`.
2. Have **both** the stripping path and the aurora path read it instead of recomputing inline
   (single source of truth — fixes the silent duplication the FEATURES doc flags as D13's
   `[partial]` exposure).
3. `deriveUniforms` then reads `drivers.magneticField.strength` for `auroraIntensity` and the ring
   geometry, instead of re-deriving from `ironFraction` (lab `planet-lod-lab-core.js:66` currently
   re-derives — update to read the surfaced field).
- **Ring geometry from field strength** (already in `PlanetGenerator.js:474-475`):
  `ringLatitude = 0.7 + fieldStrength*0.2` (stronger → nearer pole),
  `ringWidth = 0.15 - fieldStrength*0.08` (stronger → narrower). Surface these as
  `uAuroraRingLat` / `uAuroraRingWidth` semantic uniforms (production already passes them at
  `Planet.js:1065-1066`; the lab hardcodes 0.7/0.12 at `:386` → **wire them to the derived field**).
- **Color from D4** — the `composition → vec3` dict (`:462-469`) is the canonical lookup the
  limb/terminator dicts should mirror.

**(c) Envelope interaction.** Aurora **already skips the quantizer** (it's added after, as a smooth
glow — lab `:390-392`). Keep. This is the existing proof that the composite-split works.

**(d) Quality-scalar fallback.** Aurora is cheap (one `noised()` tap + masks) — no fork needed.
At `qualityTier < 0.5`, optionally drop the second curtain octave (lab uses one; production uses
two at `Planet.js:189-190`). Negligible.

---

### F38 — Airglow / nightglow limb band  `[subtle]` → **STYLIZE (keep as a thin tint)**

**(a) Render HOW.** A faint diffuse ring on the **night limb** — fresnel × nightMask:
```glsl
float airglow = pow(1.0 - max(dot(N,V),0.0), 4.0) * nightMask * uAirglowStrength;
finalColor += uAirglowColor * airglow;   // very low strength, bypass
```
Reuses the fresnel already computed for F34 and the `nightMask` already computed for aurora — near
zero added cost. `uAirglowColor` = faint green (O₂ 557.7nm, Earth airglow) from D4.

**(b) Generation path.** `D4` + `D6` → P24 → `uAirglowStrength = retained ? 0.06 : 0` (tiny),
`uAirglowColor` from the same composition dict. No new driver.

**(c) Envelope interaction — KEEP/STYLIZE/DROP call: STYLIZE.** Under the 6-level quantizer a
true faint airglow band would be crushed, but because it's a **glow (bypass)** and it *shares*
already-computed fresnel + nightMask, it costs almost nothing and adds a subtle "living atmosphere"
edge on the dark limb. Ship it as a low-strength bypass term, **off by default**, on for
terrestrial/ocean presets. Don't spend a raymarch on it.

**(d) Quality-scalar fallback.** Single term, no fork. Drop entirely at `qualityTier < 0.3`.

---

### F39 — Cloud optics (rainbows / glories)  `[subtle]` → **DROP (note as deferred)**

**(a) Render HOW.** A glory/rainbow is an angular-scattering ring at a specific
phase angle (≈138° for a primary rainbow; backscatter ring for a glory) requiring uniform-droplet
Mie phase modeling. Producible analytically as a colored ring keyed on `dot(V, lightDir)` near the
antisolar/rainbow angle, masked by `uCloudMask`.

**(b) Generation path.** Would need a per-droplet-size uniform from CLOUDS/HAZE — a cross-domain
dependency that doesn't exist.

**(c) Envelope interaction — KEEP/STYLIZE/DROP call: DROP for now.** Three reasons:
(1) the 6-level quantizer crushes a thin colored arc to dither noise unless bypassed *and* boosted,
at which point it looks fake; (2) it requires a droplet-uniformity input CLOUDS/HAZE doesn't
produce; (3) it's a once-in-a-blue-moon real-world phenomenon — low value per implementation cost.
**Defer; revisit only if Max specifically wants "rainbow on a wet world" as a wow-moment.**

**(d) Quality-scalar fallback.** N/A (dropped).

---

## 3. Proposed semantic-uniform registry additions

All declared once (spec §3 rule 2), consumed generically (no `planetType` branch). Types per the
lab's GLSL conventions (`float`/`int`/`vec3`). **Bold = the newly-surfaced D13 deliverable.**

| Uniform | Type | Driver → Process | Range | Default | Notes |
|---|---|---|---|---|---|
| `uLimbStrength` | float | D5,D6 → P26 | 0..1 | 0.0 | EXISTS in lab. Scale by D5 density. |
| `uLimbColor` | vec3 | D4 → P26 | rgb | `[0.5,0.6,0.9]` | composition dict (mirror aurora `:462`). |
| `uLimbModel` | int | D5 + qualityTier → P26 | 0 fresnel / 1 LUT / 2 raymarch | 0 | the §2.E canonical fork. |
| `uLimbFalloff` | float | D5 → P26 | 1.5..4 | 3.0 | tight=blue line, wide=haze halo. |
| `uAtmoScale` | float | D5 → P26 | 1.0..1.12 | 1.03 | raymarch shell radius multiplier. |
| `uLimbBypass` | int | (envelope) | 0/1 | 1 | EXISTS. Glows skip quantizer. |
| `uTermColor` | vec3 | D4 → P26 | rgb | `[1.0,0.5,0.3]` | sunset tint; blue for Mars-dust. |
| `uTermStrength` | float | D4,D5 → P26 | 0..1 | 0.0 | 0 when raymarch owns terminator. |
| `uTermWidth` | float | D5 → P26 | 0.06..0.25 | 0.12 | twilight band width. |
| `uSpecStrength` | float | liquid → P26 | 0..1 | 0.0 | EXISTS in lab. |
| `uGlintModel` | int | qualityTier | 0 phong / 1 GGX | 0 | cheap spot vs GGX. |
| `uGlintSharpness` | float | liquid → P26 | 48..400 | 200 | phong exponent (sharp star). |
| `uWaveRoughness` | float | wind/D5 (weather) | 0.02..0.4 | 0.1 | GGX roughness; animatable. |
| `uF0` | float | uLiquidType → P26 | 0.018..0.024 | 0.02 | water 0.02 / methane ~0.019. |
| `uLiquidTint` | vec3 | uLiquidType → P26 | rgb | `[0.1,0.3,0.5]` | water blue / methane amber. |
| `uLiquidMask` | float (or sampler) | **FLUVIAL** (consume) | 0..1 | 0.0 | **NOT ours** — cross-domain seam. |
| `uLiquidType` | int | **FLUVIAL** (consume) | 0 none/1 water/2 methane | 0 | drives F0+tint. |
| `uSpecBypass` | int | (envelope) | 0/1 | 1 | EXISTS. Glint must bypass. |
| **`uMagneticField`** | **float** | **D13 → (surfaced)** | **0..1** | **0.0** | **NEW first-class field — §2.b deliverable.** |
| `uAuroraIntensity` | float | D13,D4,D1 → P24 | 0..1 | 0.0 | EXISTS in lab; rewire to `uMagneticField`. |
| `uAuroraColor` | vec3 | D4 → P24 | rgb | `[0.3,0.9,0.5]` | EXISTS (prod); lab hardcodes — wire it. |
| `uAuroraRingLat` | float | D13 → P24 | 0.6..0.9 | 0.7 | `0.7+field*0.2`; lab hardcodes `:386`. |
| `uAuroraRingWidth` | float | D13 → P24 | 0.07..0.15 | 0.12 | `0.15-field*0.08`; lab hardcodes. |
| `uAirglowStrength` | float | D4,D6 → P24 | 0..0.1 | 0.0 | F38 stylize; off by default. |
| `uAirglowColor` | vec3 | D4 → P24 | rgb | `[0.2,0.7,0.3]` | O₂ green. |

> **Generation-side contract.** `PlanetGenerator.generate()` adds `magneticField` to its return
> (`:679-707`); `deriveUniforms` (`planet-lod-lab-core.js:51`) reads it for the aurora block and
> derives the limb/term color via composition dicts. **The stripping path
> (`PhysicsEngine.js:168-172`) and aurora path (`PlanetGenerator.js:440`) both switch to reading
> the surfaced field — one source of truth.** This is the generalized aurora precedent (§2.D).

---

## 4. Lab folder spec — `▸ Optical / Atmosphere`

Add a `▸ Optical / Atmosphere` folder (collapsed by default; spec §3). Today the optical controls
are scattered in `▸ Envelope` (limb/spec strength + bypass) and hardcoded aurora — **move the
optical-feature controls here; leave the generic bypass toggles in `▸ Envelope`** (they're the
A/B/C surface, cross-cutting). lil-gui structure:

```
▸ Optical / Atmosphere   (collapsed)
  ── Limb (F34) ──
  uLimbModel        dropdown { Fresnel(cheap) | LUT-raymarch | Full-raymarch }
  uLimbStrength     0..1
  uLimbColor        color
  uLimbFalloff      1.5..4        (tight=blue line ↔ wide=haze halo)
  uAtmoScale        1.0..1.12     (raymarch shell; greyed out unless raymarch)
  ── Terminator (F35) ──
  uTermStrength     0..1          (auto→0 when raymarch limb model active)
  uTermColor        color         (sunset red ↔ Mars blue)
  uTermWidth        0.06..0.25
  ── Sunglint (F36) ──
  uGlintModel       dropdown { Blinn-Phong | GGX+Fresnel }
  uSpecStrength     0..1
  uGlintSharpness   48..400
  uWaveRoughness    0.02..0.4
  liquidType        dropdown { none | water | methane }   → sets uF0,uLiquidTint
  [readout] "liquid mask source: FLUVIAL (stub until wired)"   ← seam visibility
  ── Aurora (F37) ──
  uMagneticField    0..1          ← drives the three below (auto)
  uAuroraIntensity  0..1
  uAuroraRingLat    0.6..0.9
  uAuroraRingWidth  0.07..0.15
  uAuroraColor      color
  ── Airglow (F38) ──
  uAirglowStrength  0..0.1        (off by default)
  uAirglowColor     color
```

Bypass toggles (`uLimbBypass`/`uSpecBypass`, + new `uTermBypass`/`uAirglowBypass`) **stay in
`▸ Envelope`** — they're the cross-cutting A/B/C decision surface, not optical-specific.

**Preset hooks:** the Drivers presets (`world-engine-lab.html:556-558`) should set these folder
values — e.g. "Ocean (temperate)" → water glint + blue limb + warm terminator; "Lava (hot
airless)" → no limb (airless), no glint, no aurora (locked → field×0.2, likely below 0.05 gate).

---

## 5. 3-cycle-cap risk flags

| # | Risk | Why | Fallback (name it) |
|---|---|---|---|
| **R1 (chief)** | **Lague raymarch BANDING under the 6-level posterizer.** | Raymarched scattering produces a *smooth gradient*; the limb term must **bypass** the quantizer (it does), BUT the raymarch *itself* bands from low step count (~10 samples), and that internal banding is then *visible* in the bypassed-but-low-sample glow. Two banders fighting. | (1) **Blue-noise / IGN ray-start offset** — jitter the first march sample per-pixel (demofox, jbaker, Heckel all confirm this erases march banding; the lab already has an IGN dither path for the posterizer — reuse the same `ign()`); (2) **bake optical depth to a LUT** (O'Neil/Bruneton/URP-Atmosphere) so the gradient is analytic, not step-sampled; (3) if both fail in 3 cycles → **drop to LUT-raymarch or fresnel** at this body and move on. Do NOT death-spiral on full-raymarch. |
| **R2** | **Sunglint specular spot rings under the quantizer.** | A `pow(...,200)` highlight posterized to 6 levels breaks into concentric hard rings. | `uSpecBypass` (exists) — mandatory ON for glint. If still ringy when bypassed (HDR clip), tone-map the glint with `x/(x+1)` before add. |
| **R3** | **Terminator seam / double-darkening with CLOUDS' substellar term (P21).** | On tidally-locked worlds both our terminator gradient and CLOUDS' terminator cloud ring darken the same band → muddy seam. | Make our terminator term **additive tint only** (never multiply the diffuse); let CLOUDS own the darkening. Coordinate the contract (§1 seam). If they still fight → gate `uTermStrength→0` on locked worlds and let CLOUDS' ring carry the boundary. |
| **R4** | **Raymarch perf on the 5080 at LOD2** (one body, but ~100 taps/fragment over a full-screen sphere). | Could tank framerate during close approach. | LUT-raymarch middle rung; `qualityTier` already gates the model. Profile in-lab via chrome-devtools :9223 before committing full-raymarch to production. |

> **Note (a non-risk worth recording):** F34-raymarch and F35-reddening are the **same physics** at
> the rich tier — don't implement them twice. The terminator's explicit Gaussian band is *only* the
> cheap-tier substitute. This collapses two features into one computation above `qualityTier 0.5`.

---

## 6. Open questions for Max (taste / scope calls)

1. **Limb richness ceiling.** Is full Lague raymarch worth the perf + banding risk (R1/R4), or is
   **LUT-raymarch the practical desktop ceiling** and full-raymarch a "someday"? My read: ship
   fresnel + LUT-raymarch, treat full-raymarch as an optional spike. Your call on ambition.
2. **Sunglint timing.** F36 depends on FLUVIAL's `uLiquidMask`. Build the glint **now behind a
   stub mask** (so the GGX/IOR work is done and lab-tunable), or **wait** for FLUVIAL to land the
   real mask first? (Stub-now keeps the optical domain self-contained; wait avoids a throwaway mask.)
3. **Airglow (F38).** Ship the near-free stylized version on terrestrial/ocean presets, or drop it
   entirely? (I lean ship-it-off-by-default — costs ~nothing, reuses computed fresnel.)
4. **Rainbows/glories (F39).** Confirm DROP, or is "rainbow on a wet world" a wow-moment you want?
   (I recommend drop — high cost, crushed by posterize, needs a CLOUDS input that doesn't exist.)
5. **Mars blue sunset.** Worth the D4-dust → blue-terminator special case, or is one warm sunset
   tint enough for all worlds? (It's a real, citable inversion — cheap to support, just a tint sign.)
6. **D13 surfacing scope.** Surfacing `magneticField` touches `PhysicsEngine.js` +
   `PlanetGenerator.js` + the stripping path (a generation-path refactor, not just rendering).
   Confirm this domain owns that refactor (it's the cleanest place — aurora is the only visual
   consumer), or does it belong to a generation-side workstream?

---

## 7. Sources (verified)

**Atmospheric scattering (limb / terminator — F34/F35):**
- Sebastian Lague — *Atmosphere* (Coding Adventure), Shadertoy `ssXSWs`:
  https://www.shadertoy.com/view/ssXSWs — *appeared in search with this title/author; direct
  WebFetch returned HTTP 403 (Shadertoy blocks bots), so the page body is unverified — retrieve
  in-browser before copying exact constants.*
- Sean O'Neil — *GPU Gems 2, Ch.16 "Accurate Atmospheric Scattering"* (NVIDIA):
  https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering
- Eric Bruneton & Fabrice Neyret — *Precomputed Atmospheric Scattering* (EGSR 2008), new
  implementation + code: https://ebruneton.github.io/precomputed_atmospheric_scattering/ ·
  repo: https://github.com/ebruneton/precomputed_atmospheric_scattering
- URP-Atmosphere (Lague-inspired, baked optical-depth LUT, port from Shadertoy):
  https://github.com/sinnwrig/URP-Atmosphere
- Zylann — Godot planet atmosphere shader (fresnel + raymarch reference):
  https://github.com/Zylann/godot_atmosphere_shader/blob/master/README.md

**Banding reduction under raymarch (R1):**
- Demofox — *Ray Marching Fog With Blue Noise*:
  https://blog.demofox.org/2020/05/10/ray-marching-fog-with-blue-noise/
- Maxime Heckel — *Real-time Cloudscapes with Volumetric Raymarching* (blue-noise ray-start
  offset): https://blog.maximeheckel.com/posts/real-time-cloudscapes-with-volumetric-raymarching/
- Vertex Fragment — *Volumetric Cloud Banding Artifacts*:
  https://www.vertexfragment.com/ramblings/volumetric-cloud-banding/
- jbaker.graphics — *Dithered Raymarching* series:
  https://jbaker.graphics/writings/sdf3.html
- Christoph Peters — free blue-noise textures:
  https://momentsingraphics.de/BlueNoise.html

**Sunglint / GGX specular (F36):**
- glslify — *glsl-specular-cook-torrance* (GGX/Cook-Torrance GLSL):
  https://github.com/glslify/glsl-specular-cook-torrance
- Filmic Worlds — *Optimizing GGX Shaders with dot(L,H)*:
  https://filmicworlds.com/blog/optimizing-ggx-shaders-with-dotlh/

**Methane-vs-water glint physics (F36 IOR):**
- Barnes et al. — *Modeling specular reflections from hydrocarbon lakes on Titan*, Icarus 2012:
  https://www.sciencedirect.com/science/article/abs/pii/S0019103512002126
- Adams — *Optical reflectivity of solid and liquid methane…*, GRL 2012:
  https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2011GL049710
- NASA/JPL — *Sunglint on a Hydrocarbon Lake* (Cassini VIMS, Titan):
  https://www.jpl.nasa.gov/images/pia18433-sunglint-on-a-hydrocarbon-lake/
- AAS Nova — *Sun Glitter and Sunglint on Titan's Hydrocarbon Seas* (2025):
  https://aasnova.org/2025/04/25/sun-glitter-and-sunglint-on-titans-hydrocarbon-seas/

**Aurora / limb (already-shipping precedent, in-repo):**
- `src/objects/Planet.js:178-200, 391-407` (applyAurora + fresnel limb)
- `src/generation/PlanetGenerator.js:435-485` (aurora derivation + composition color dict)
- `src/generation/PhysicsEngine.js:168-172` (D13 fieldStrength, inline)
- `world-engine-lab.html:366-392` + `planet-lod-lab-core.js:46-71` (envelope split + deriveUniforms)
- `research/RESEARCH_high-lod-planet-shaders-2026-06-05.md` §3.2 (fresnel vs Lague rows, verified)

**Integrity flags:** (1) Lague Shadertoy `ssXSWs` body is unverified (403) — confirm constants
in-browser. (2) Methane IOR (~1.27–1.29) and water (~1.33) → F0 values are derived from the cited
papers via the Fresnel equation, not lifted verbatim; treat the exact F0 numbers as my computation,
tunable in-lab. (3) All in-repo line numbers spot-verified against live files 2026-06-06.
