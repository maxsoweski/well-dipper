# Well Dipper Stage-B Research — Domain: EXOTIC / OVERLAY

**Date:** 2026-06-06 · **Stage:** B (per-domain feature research) · **Domain:** Exotic-natural (F41–F45) + Overlay (F46–F49)
**Plugs into:** Stage-A foundation (`docs/superpowers/specs/2026-06-06-planet-rendering-foundation-design.md`) — analytic-derivative `noised()` base, `lodRamp` + hysteresis, variable-octave FBM + fwidth clamp, composite-split envelope (`posterize(surface) + emissiveGlow + specGlint + limbGlow`, per-effect bypass), driver→semantic-uniform scaffolding.
**Reuses vocabulary from:** `research/RESEARCH_high-lod-planet-shaders-2026-06-05.md` (Voronoi/cellular, domain warp, Worley F2−F1 cracks, emissive bypass, analytic-deriv noise, RD-LUT/fake-Turing).
**Confidence note (read first):** This is the **most speculative** Stage-B domain. Track (i) geometric types have real-time-proven techniques (high confidence). Track (ii) overlays are game-constructs with no ground truth — the *techniques* are proven (city-lights blends, masked noise) but the *art direction* (how much base shows, how "grown" coverage reads) is taste, flagged throughout.

---

## 1. Scope

### Two tracks

**Track (i) — F-exotic-natural** (real natural premises, driven by real L0 params; these are NOT overlays — they are genuine driver-driven relief/albedo):

| F# | Feature | Variants | Drivers → Process |
|---|---|---|---|
| **F41** | Hemispheric magma ocean | molten dayside sea · magma shoreline/waves at terminator · nightside rock-frost condensate plains | D7 (tidal-lock) + D1/D12 (extreme heat) → P4/P6 |
| **F42** | Carbon-world crust | graphite plain · diamond-studded ridges · hydrocarbon/tar flats | D10 (C/O ratio) → composition |
| **F43** | Crystalline facet field | scattered crystals … continuous faceted field | P15 (crystallization), D10/D16 |
| **F44** | Hexagonal-tessellated crust | small polygons … planet-wide hex tiling | P15 (cooling-contraction tessellation), D11/D16 |
| **F45** | Shattered / fractured crust | local fracture … globally shattered blocks | P15 (catastrophic stress), D12/D11 |

**Track (ii) — F-overlay** (artificial/biotic; NO geomorphic formation; composite OVER a natural base planet whose own L0→L1→L2 chain runs beneath):

| F# | Feature | Variants | Drivers → Process |
|---|---|---|---|
| **F46** | Bioluminescent / fungal mats | sparse patches … planet-spanning living mat | D15 + D16 → P27 (biospheric colonization) |
| **F47** | Machine / structured surface | scattered structures … fully machined crust (circuit grid) | D15→tech + D16 → P28 (technospheric dev) |
| **F48** | City lights | scattered cities … continuous urban band; lit nightside | D15 + D16 + **D7** (nightside gate) → P28 |
| **F49** | Ecumenopolis | planet-covering megacity (whole-surface glow) | D15 + D16 (saturation) → P28 |

### Cross-domain seams (DEFER + handoff)

- **P15 relief (F43–F45) vs RELIEF domain.** The geometric tessellation/fracture *relief* (height + normal) overlaps RELIEF's Voronoi-border tessellation note. **Resolution: this domain OWNS F43–F45** (they're exotic-natural scope); RELIEF defers them here. The shared primitive (3D Voronoi F1/F2−F1 on the object-local sphere) is described in §3 below so RELIEF and we use the same code. **Seam to deconflict: the Voronoi cell-count / quality-tier knob and the analytic-derivative-of-Voronoi normal must be ONE implementation, not two.**
- **Magma terminator (F41) vs BANDS/STORMS thermal (F32/F33) + OPTICAL terminator.** We own the **molten dayside surface + magma shoreline/waves at the terminator + nightside condensate**. The *thermal self-emission glow* of a hot dayside is shared with F32/F33 (hot-jupiter dayside/nightside thermal) — same emissive-bypass channel. The *terminator color gradient* (F35, reddening) is OPTICAL's. **Seam: the magma shoreline is a surface/relief term we own; the day/night reddening is OPTICAL's; both write to the same fragment but are authored separately. Don't double-apply terminator reddening.**
- **Overlay base-planet reuse (F46–F49) vs EVERY other domain.** The whole point of the compositing model: the overlay sits on a **natural base planet** rendered by the other domains' shaders (terrestrial relief, oceans, clouds, weather, optical). **This domain CONSUMES their output; it does not redefine it.** Our deliverable is the *mask × overlay-term × blend-over-base* math, not the base shader. **Seam: the overlay needs the base shader's final lit color AND a few base-derived masks (land/ocean from terrestrial, `diffuse`/nightMask from lighting). Those must be exposed as locals the overlay block can read — a small ordering contract in the mega-shader.**

---

## 2. THE overlay compositing architecture (governs Track ii — read before §3 F46–F49)

This is the single most important specification in this doc. F46–F49 are **NOT from-scratch generators.** Today they are (`Planet.js:686–948`, the `planetType == 14/15/16/17` branches build land/ocean/grids from scratch inside the EXOTIC shader). The new model **re-expresses them as an overlay layer over a natural base.**

### 2.1 The three-term composite

For any overlay world, the final fragment is:

```
baseColor   = <natural base planet shader output>   // terrestrial/ocean/rocky, fully lit, all its own L0→L1→L2
coverage    = coverageMask(pos, maturity, age, seed) // 0..1, how much of THIS point the overlay claims
overlayTerm = <emissive or structured overlay>       // city lights / fungal glow / circuit grid / megacity glow
finalColor  = mix(baseColor, baseColor * darkenUnderOverlay + overlayTerm, coverage)
```

Three pieces, each driver-derived:

1. **`baseColor`** — the natural base. An ecumenopolis sits on a *terrestrial* base (oceans, continents, weather still computed beneath). A fungal world is a *temperate ocean/terrestrial* base. The base **shows through wherever `coverage < 1`.** This is what makes it "a living/built world" rather than "a texture of a city." **Architecture:** the base is selected by a driver bundle (Appendix-A preset) — the overlay does NOT pick a base "type", it reads whatever base the driver bundle produced.
2. **`coverageMask`** — a 0..1 scalar field over the sphere, driven by **maturity = f(D15 habitability, D16 age)**. Low maturity → sparse patches (clustered, edge-feathered). High maturity → near-total coverage (ecumenopolis = coverage→1 everywhere). The mask is **deterministic structural** (it's "where the civilization/biosphere built up", stable across visits — per Stage-A Q4 the static layer is deterministic). Built from clustered FBM + threshold, NOT a from-scratch grid.
3. **`overlayTerm`** — the visible overlay content. Two sub-kinds:
   - **Emissive** (fungal glow F46, city lights F48, ecumenopolis glow F49) → **bypasses posterize** via the `emissiveGlow` channel (Stage-A §2.C `emissiveBypass`). These are point/cluster lights and grids that must stay crisp.
   - **Structured albedo/relief** (circuit grid F47, megacity block-grid F49) → modulates base albedo + a shallow normal perturbation; goes **through** the posterizer as surface.

### 2.2 The coverage mask — concrete

```glsl
// maturity in 0..1 from CPU (D15 × D16 ramp). seed offsets the field per planet.
float coverageMask(vec3 pos, float maturity, vec3 seed) {
  // large-scale "settlement clusters" — low-freq FBM, deterministic
  float cluster = fbm(pos * coverageFreq + seed);        // -1..1
  cluster = cluster * 0.5 + 0.5;                          // 0..1
  // maturity raises the threshold floor: more maturity → more of the field passes
  float t = mix(0.85, -0.05, maturity);                  // mature world: threshold below the field min → ~full coverage
  float edgeWidth = mix(0.04, 0.25, 1.0 - maturity);     // sparse worlds = crisp small patches; growth feathers at high maturity
  return smoothstep(t, t + edgeWidth, cluster);
}
```

- **Sparse (low maturity):** high threshold → only the brightest cluster peaks pass → scattered patches/cities, base mostly visible. This is F46-sparse / F48-scattered.
- **Saturated (high maturity):** threshold below the field floor → coverage→1 → ecumenopolis (F49). Base barely shows (only at ocean/relief lows if you mask those out).
- **Determinism:** `pos` is **object-local** (per Stage-A "never pass `vWorldPos` into surface noise"), `seed` is per-planet, `maturity` is a uniform. Same every visit.

### 2.3 The D7 nightside gate (city lights / ecumenopolis glow)

City lights (F48) and ecumenopolis glow (F49) are **emissive overlays that only light on the dark hemisphere.** The current code already does this (`Planet.js:920, 936`: `nightMask = 1.0 - smoothstep(0.0, 0.15, diffuse)`). Generalize it:

```glsl
float nightMask = 1.0 - smoothstep(nightFalloff0, nightFalloff1, diffuse);
finalColor += cityLightColor * coverage * nightMask * cityGrid * cityIntensity;  // emissiveBypass channel
```

- For a **tidally-locked** overlay world (D7 locked → eyeball with nightside cities, per Appendix A `eyeball → F48`), `diffuse` is permanently low on the night hemisphere → cities glow on the *fixed* dark side. The gate is the same `diffuse`-derived mask; D7 just makes the night hemisphere permanent rather than rotating. **No special D7 branch needed** — the lighting already encodes it.
- Daytime overlay structure (circuit grid albedo F47, megacity grid relief) is NOT gated — it's visible day and night; only the *emissive* term gates on night.

### 2.4 Why this is not the old type-branch

Old: `if (planetType == 17) { build grid from scratch, no ocean, no weather }`. New: the planet's driver bundle produced a terrestrial base (with oceans, weather, relief). The ecumenopolis is `coverage→1 × (megacity grid albedo + emissive glow)` composited over that base. **Drop a single uniform (`maturity → 0`) and the same shader renders the bare terrestrial world the city was built on.** That is the test that the architecture is right.

---

## 3. Per-feature research

Each feature: **(a) Render HOW · (b) Generation path (D#→P#→uniform) · (c) Envelope interaction · (d) Quality-scalar fallback.**

Shared primitive used by F43–F45 and the coverage mask — **3D Voronoi on the object-local sphere** (IQ two-pass, [voronoilines](https://iquilezles.org/articles/voronoilines/), [voronoise](https://iquilezles.org/articles/voronoise/)): sample noise on `pos` (the 3D object-local position on the unit sphere), NOT on a 2D UV. This is the seam-free, pole-free path the Stage-A research already mandates ("body-local noise space", "3D object-space 27-cell seamless vs tangent-space 9-cell"). The current hex code (`Planet.js:691–705`) uses a 2D **dominant-axis cube projection** — that has cube-face seams and was a stopgap; the new base must use 3D cellular. See §6 risk-flag 1.

---

### F41 — Hemispheric magma ocean

**(a) Render HOW.**
- **Molten dayside sea** = roiling animated-FBM emissive surface (nimitz-style time-rotated octaves, foundational §3.3): `p *= rot(time); sum += amp*noise(p*freq)`. Color from a **black-body ramp** indexed by a temperature field `T(pos)` that peaks at the substellar point and falls toward the terminator. Emissive — **bypasses posterize**.
- **Magma shoreline / waves at the terminator** = the boundary between molten dayside and solid nightside. Drive it by `dot(N, sunDir)` (substellar-angle): `shoreMask = smoothstep(shoreLo, shoreHi, dot(N, sunDir))`. At the shore band, add **Worley F2−F1 crust-crack emissive** (foundational §3.3 lava stack) so the cooling edge shows glowing cracks between solidifying plates. Optional Gerstner-lite wave normal on the molten side near the shore.
- **Nightside rock-frost condensate plains** = the cold hemisphere: low-albedo solid rock with a pale "rock-frost" tint (vaporized rock recondenses — physically Na/SiO frost, per K2-141b modelling, [IOPscience](https://iopscience.iop.org/article/10.3847/1538-4357/ac8792)). Render as a desaturated rocky base, no emission.
- **LOD-ramp:** molten churn amplitude and shoreline crack detail scale with `lodRamp` (far = smooth glowing lobe, near = roiling cracked shore).

**(b) Generation path.** `D7 (tidal-lock) + D1 (T_eq extreme) + D12 (tidal heat)` → P4/P6 (extreme heat resurfacing) → CPU derives:
- `magmaFraction` (0..1): how much of the dayside is molten (from how far T_eq exceeds the rock-melt threshold). Uniform `float u_magmaFraction`.
- `substellarDir` = sunDir (already passed as `lightDir`). The molten/solid split is `smoothstep` on `dot(N, lightDir)` — **no new geometry, the lighting already gives the day/night axis.** For a non-locked hot world the molten cap rotates with the planet; for D7-locked it's fixed (correct eyeball behavior, free).
- `magmaTempPeak` (K) → drives the black-body ramp hue. Uniform `float u_magmaTemp`.
- Generic shader consumption: NO type branch — any world with `u_magmaFraction > 0` shows magma. A "lava planet" preset just sets `magmaFraction` high.

**(c) Envelope interaction.** Molten emission + shoreline cracks → **emissive bypass** (KEEP, crisp). Nightside rock → through posterize (fine, low-contrast). The terminator is where the magma shoreline lives — **coordinate with OPTICAL** so the magma shore isn't double-reddened by F35.

**(d) Quality-scalar fallback.** Drop the animated churn to a static emissive cap + single-octave crack mask; drop Gerstner wave normal. The black-body ramp + day/night split is O(1) and stays at all tiers.

---

### F42 — Carbon-world crust

**(a) Render HOW.** Three sub-surfaces, blended by low-freq masks:
- **Graphite plain** = very dark, slightly metallic base albedo (`baseColor ≈ vec3(0.05–0.10)`), low specular roughness.
- **Diamond-studded ridges** = sparse high-frequency points (current code's `pow(snoise, 8.0)` crystal trick, `Planet.js:452/577` — KEEP this, it works) rendered as **emissive glints that survive shadow** (the current carbon path already makes diamond glints emissive at `:575–579`). Bypass posterize.
- **Hydrocarbon / tar flats** = dark, low-relief, faintly specular (wet-look) patches in basins — a low-albedo smooth mask keyed to height-lows.

**(b) Generation path.** `D10 (carbonToOxygen)` → composition (`deriveComposition:344`, already gives `carbonToOxygen`; surfaceType `'carbon'` when C/O > 0.8, `:369`). CPU derives:
- `carbonRatio` (0..1) = remap of `carbonToOxygen` (0.2..1.3) → uniform `float u_carbonRatio`. High → darker base + more diamond glints. **This is a continuous knob, not a boolean type** — a moderately carbon-rich silicate world gets a few glints; a true carbon planet gets the full dark-graphite-with-diamonds look.
- Diamond-glint density and tar-flat coverage both scale off `u_carbonRatio`.

**(c) Envelope interaction.** Graphite/tar → through posterize (very dark, banding invisible at low luminance). Diamond glints → **specGlint/emissive bypass** (KEEP — crisp sparkle is the whole point). Tar wet-look specular → spec bypass if it bands.

**(d) Quality-scalar fallback.** Diamond glints reduce to fewer, single-octave points; tar flats drop. Base dark albedo is free.

---

### F43 — Crystalline facet field

**(a) Render HOW.** **3D Voronoi cells** on the object-local sphere (the shared primitive). Two ingredients:
- **Faceted shading** = flat-shade each cell: use the cell-center direction as a per-cell constant normal so each facet catches light as a flat plane → gemstone faceting. (Current crystal code `:716–739` already does 3D Voronoi cell-value; the new version adds the **analytic per-cell normal** for true facet lighting, which the current code lacks.)
- **Continuous-field variant** = raise Voronoi `smoothness` (IQ smooth-voronoi power blend, [voronoise](https://iquilezles.org/articles/voronoise/)) and crystal density so scattered crystals merge into a continuous faceted field. The "scattered → continuous" variant axis = one density/smoothness uniform.
- Edge highlights via **F2−F1 border distance** (cell edges catch a bright accent rim).

**(b) Generation path.** `P15 (slow crystallization)` + `D10` (carbide/diamond chemistry) + `D16` (time to grow) → CPU derives:
- `crystalDensity` (0..1) = Voronoi frequency × maturity → uniform `float u_crystalDensity`. Low = scattered, high = continuous field.
- `facetSharpness` → the smooth-voronoi power. Uniform `float u_facetSharp`.

**(c) Envelope interaction.** Faceted **lighting** is high-contrast luminance → survives posterize cleanly (it's relief/lighting, the envelope's favored channel). Edge-rim accent → through posterize. No emissive needed unless gemstone "inner glow" is wanted (then bypass).

**(d) Quality-scalar fallback.** 27-cell → 9-cell (tangent-space) Voronoi behind `qualityTier` (per Stage-A Q3). Drop the smooth-voronoi power blend (hard min() is cheaper, slightly less smooth).

---

### F44 — Hexagonal-tessellated crust

**(a) Render HOW.** **Natural premise is real: basalt columnar jointing** (cooling-contraction → 120° junctions → hexagons; [USGS](https://www.usgs.gov/observatories/hvo/news/volcano-watch-columnar-jointing-provides-clues-cooling-history-lava-flows), [Oregon State Volcano World](https://volcano.oregonstate.edu/columnar-jointing)). Render as a **3D Voronoi cell tiling with F2−F1 borders as the joint grooves**:
- A roughly-uniform jittered 3D Voronoi → cells. With **low jitter** the cells trend toward hexagonal packing (this is why the current 2D hexGrid existed; the 3D-Voronoi version gives it seam-free + a natural-irregularity dial).
- `border = 1 - smoothstep(0, w, F2−F1)` → the joint grooves between columns. Grooves get a shallow **normal perturbation** (the relief — analytic derivative of the border field) so columns read as raised plates.
- Per-cell albedo jitter for plate-to-plate variation.

**(b) Generation path.** `P15 (cooling-contraction tessellation)` + `D11 (surface-history)` + `D16 (cooling time)` → CPU derives:
- `tessellation` (0..1): degree of regular polygonal tiling. Uniform `float u_tessellation`. Low = local polygons in patches; high = planet-wide hex tiling.
- `cellScale` (column diameter — faster cooling → narrower columns, per the geology). Uniform `float u_hexScale`.
- `jitterAmount` → how regular vs irregular (lower jitter = more perfectly hexagonal). Uniform `float u_hexJitter`.

**(c) Envelope interaction.** Geometric tessellation lives **under the dither as relief** (groove normals + albedo). High-contrast border lines survive; subtle per-cell albedo may flatten — KEEP the relief, treat albedo jitter as STYLIZE-or-drop. No emissive.

**(d) Quality-scalar fallback.** 27→9-cell Voronoi; drop the border-groove normal (keep albedo border line only). Drop per-cell albedo jitter.

---

### F45 — Shattered / fractured crust

**(a) Render HOW.** **Fracture-network noise**, not regular cells:
- **Crack network** = `1 - abs(noise)` ridged-fold OR Voronoi **F2−F1 inverted** (the edges become the cracks). Multi-scale (current code `:706–715` already layers two crack frequencies — KEEP the approach, move to 3D, add analytic deriv). Cracks get a **depth normal** (grooves) + optional **emissive glow** on the dark side (current shattered path glows fracture lines, `:886–891`).
- **Block chaos** = at high intensity, displace whole Voronoi cells slightly (per-cell height offset) so the crust reads as shattered/rafted blocks (Miranda-like). Variant axis "local fracture → global shatter" = one intensity uniform driving crack density + block-displacement amplitude.

**(b) Generation path.** `P15 (catastrophic stress)` + `D12 (tidal stress)` + `D11 (impact/disruption history)` → CPU derives:
- `fractureIntensity` (0..1) → uniform `float u_fractureIntensity`. Low = a few fracture zones; high = globally shattered blocks.
- `crackGlow` (0..1) — whether fractures are cold (dark grooves) or hot/active (emissive, if recent tidal heating) → uniform `float u_crackGlow`. Ties F45 to F41's heat when both high.

**(c) Envelope interaction.** Crack grooves → relief, survives. Cold cracks through posterize; hot/active crack glow → **emissive bypass**. Block displacement → relief.

**(d) Quality-scalar fallback.** Single-scale crack network; drop block displacement; drop emissive glow.

---

### F46 — Bioluminescent / fungal mats (OVERLAY)

**(a) Render HOW.** Overlay composite (§2) over a **temperate terrestrial/ocean base**:
- `coverage` = the §2.2 mask (sparse patches → planet-spanning mat by maturity).
- `overlayTerm` = **fake-Turing organic mat texture** — thresholded **domain-warped FBM** ([warp](https://iquilezles.org/articles/warp/); the foundational research's recommended fully-procedural alternative to true reaction-diffusion, which can't run single-pass deterministically). `mat = smoothstep(t0, t1, fbm(p + warp(p)))` gives blotchy organic veining without an FBO. Color = bioluminescent accent. **Emissive** (glows on the dark side too) — bypass posterize. The current fungal path (`:740–749, 894–901`) already does clustered glow-spots — KEEP the cluster idea, upgrade the spot field to warped-FBM veining for the "grown" look.
- Base oceans/weather show through wherever `coverage < 1`.

**(b) Generation path.** `D15 (habitability) + D6 (atmosphere) + D1 (temperate) + D16 (age)` → P27 (biospheric colonization). CPU derives `bioMaturity` (0..1) from D15×D16 → uniform `float u_bioMaturity` driving the coverage mask. Species/color selector `u_bioHue`. **No type branch** — any habitable, aged world can grow a biosphere overlay; "fungal" is the preset with high `bioMaturity`.

**(c) Envelope interaction.** Bioluminescent veining → **emissive bypass** (KEEP — the glow is the identity). The base planet beneath → its own envelope. Mat albedo (daytime, non-glowing) → through posterize.

**(d) Quality-scalar fallback.** Drop the domain-warp (plain thresholded FBM blotches); reduce coverage-mask octaves. Emissive glow stays (cheap, high-value).

---

### F47 — Machine / structured surface (OVERLAY)

**(a) Render HOW.** Overlay (§2) over a **rocky base**:
- `coverage` = §2.2 mask (scattered structures → fully machined crust).
- `overlayTerm` = **circuit-grid** — rectilinear 3D grid (current machine path `:750–764, 903–916` — KEEP). Two parts: **structured albedo** (dark metallic plates + grid lines, goes THROUGH posterize as surface) + **emissive lit cells/traces** (sparse `cellHash`-gated glowing lines, bypass). Shallow normal on grid lines for relief.
- Base rocky relief shows through where `coverage < 1` (partly-machined world = machinery growing over natural rock).

**(b) Generation path.** `D15→tech + D16` → P28 (technospheric dev). CPU derives `techMaturity` (0..1) → `float u_techMaturity` driving coverage. `u_circuitScale`, `u_circuitGlow`. **No type branch** — "machine" = high `techMaturity`, structured (not biotic) overlay kind.

**(c) Envelope interaction.** Grid albedo + plates → through posterize (KEEP). Emissive traces → bypass. The hard rectilinear grid is high-contrast → survives dither well.

**(d) Quality-scalar fallback.** Single grid scale (drop intersection/second-line detail); drop emissive traces or reduce to grid-line glow only.

---

### F48 — City lights (OVERLAY)

**(a) Render HOW.** Overlay (§2) over a **terrestrial base**, with the **D7 nightside gate** (§2.3):
- `coverage` = §2.2 mask × **landMask from the base** (cities only on land — read the base's land/ocean split, don't recompute). Scattered → continuous urban band by maturity.
- `overlayTerm` = warm point-light field — high-freq masked noise giving discrete city points (current path `:918–931` — KEEP the coast-boost and point-field), **gated on `nightMask`** so lights only on the dark hemisphere. **Emissive bypass.** Daytime: the base terrestrial world is just visible normally (cities barely show in daylight — correct).
- Proven blend pattern: same as the NASA Earth-at-night day/night mix ([three.js-journey earth shaders](https://threejs-journey.com/lessons/earth-shaders), [Franky Hung](https://franky-arkon-digital.medium.com/make-your-own-earth-in-three-js-8b875e281b1e)) — but procedural mask instead of a baked texture.

**(b) Generation path.** `D15 + D16 + D7` → P28. CPU derives `civMaturity` (0..1) → `float u_civMaturity`; reads base `landMask` and lighting `diffuse`. `u_cityLightColor`. For D7-locked worlds (`eyeball → F48`), nightside is permanent → cities on the fixed dark side, no special code (§2.3).

**(c) Envelope interaction.** City points → **emissive bypass** (KEEP — crisp warm pinpoints are the identity; banding would ruin them). Base terrestrial → its own envelope.

**(d) Quality-scalar fallback.** Single-octave city-point field; drop coast-boost. Night gate + emissive stay (cheap).

---

### F49 — Ecumenopolis (OVERLAY, saturation)

**(a) Render HOW.** Overlay (§2) at **coverage → 1** over a terrestrial base (the base barely shows — only at deep ocean / relief lows if those are masked out):
- `overlayTerm` = **two-scale megacity grid** (current path `:772–788, 934–947`: fine block-grid + district-grid + per-district brightness — KEEP). **Structured albedo/relief** (steel/concrete plates, block grooves) THROUGH posterize + **whole-surface emissive glow** on the nightside (district-modulated) via **emissive bypass**.
- The "ecumenopolis vs city-lights" difference is **just `maturity`** — F49 = F48 with `civMaturity → 1` (coverage saturates, grid densifies, glow goes whole-surface). Same overlay, different knob. This is the proof the architecture is right (§2.4).

**(b) Generation path.** `D15 + D16 (saturation)` → P28. Same `u_civMaturity` as F48, near 1.0. `u_districtScale`, `u_megacityGlow`.

**(c) Envelope interaction.** Block grid + plates → through posterize. Whole-surface night glow → emissive bypass. District brightness variation through posterize (banding acceptable / stylized).

**(d) Quality-scalar fallback.** Single grid scale; flat district brightness; glow stays.

---

## 4. Proposed semantic-uniform registry additions

All consumed generically (no `planetType` branch). Types = presets that set these.

| Uniform | Type | Driver → Process | Range | Default | Drives |
|---|---|---|---|---|---|
| `u_magmaFraction` | float | D7+D1+D12 → P4/P6 | 0..1 | 0 | F41 molten-dayside extent |
| `u_magmaTemp` | float | D1 (T_eq) | 1500..4000 (K) | 2500 | F41 black-body ramp hue |
| `u_carbonRatio` | float | D10 → composition | 0..1 | 0 | F42 dark base + diamond/tar density |
| `u_crystalDensity` | float | P15+D16 | 0..1 | 0 | F43 scattered→continuous facets |
| `u_facetSharp` | float | P15 | 0..1 | 0.5 | F43 smooth-voronoi power |
| `u_tessellation` | float | P15+D11+D16 → cooling | 0..1 | 0 | F44 local→planet-wide hex |
| `u_hexScale` | float | P15 (cooling rate) | 1..20 | 6 | F44 column diameter |
| `u_hexJitter` | float | P15 | 0..1 | 0.3 | F44 regular↔irregular |
| `u_fractureIntensity` | float | P15+D12+D11 | 0..1 | 0 | F45 local fracture→global shatter |
| `u_crackGlow` | float | D12 (tidal heat) | 0..1 | 0 | F45 cold↔hot-emissive cracks |
| `u_bioMaturity` | float | D15+D16 → P27 | 0..1 | 0 | F46 fungal coverage |
| `u_bioHue` | vec3 | (species selector) | color | green-cyan | F46 biolum color |
| `u_techMaturity` | float | D15+D16 → P28 | 0..1 | 0 | F47 machine coverage |
| `u_circuitScale` | float | P28 | 1..12 | 4 | F47 grid density |
| `u_circuitGlow` | float | P28 | 0..1 | 0.3 | F47 emissive traces |
| `u_civMaturity` | float | D15+D16+D7 → P28 | 0..1 | 0 | F48/F49 city coverage (1=ecumenopolis) |
| `u_cityLightColor` | vec3 | (selector) | color | warm amber | F48/F49 night-light hue |
| `u_districtScale` | float | P28 | 0.5..3 | 1.5 | F49 district grid |
| `u_coverageFreq` | float | (shared) | 0.3..2 | 0.8 | §2.2 cluster mask frequency (overlays) |
| `u_overlaySeed` | vec3 | per-planet seed | — | — | §2.2 mask offset (deterministic) |

**Shared with RELIEF (deconflict):** `u_voronoiCellCount` (27/9 quality-tier) and the analytic-Voronoi-normal helper — F43/F44/F45 and RELIEF's tessellation note must share ONE implementation.

---

## 5. Lab folder spec — `▸ Exotic / Overlay`

lil-gui folder (Stage-A §3 names it). Collapsed by default; one sub-section per feature so Max settles each independently. Every control = one semantic uniform (Stage-A structural rule 2).

```
▸ Exotic / Overlay
  ▸ Magma Ocean (F41)
      magmaFraction   [0..1]
      magmaTemp (K)   [1500..4000]
      churnAmount     [0..1]        // animated-FBM speed/amplitude (weather layer, not deterministic)
      shoreCracks     [bool]        // Worley F2-F1 emissive shoreline
  ▸ Carbon Crust (F42)
      carbonRatio     [0..1]
      diamondGlints   [0..1]
      tarFlats        [0..1]
  ▸ Crystal / Hex / Shatter (F43-45, geometric P15)
      crystalDensity  [0..1]
      facetSharp      [0..1]
      tessellation    [0..1]
      hexScale        [1..20]
      hexJitter       [0..1]
      fractureIntensity [0..1]
      crackGlow       [0..1]
      voronoiCells    [9|27]        // quality-tier (shared w/ RELIEF)
  ▸ Overlay — coverage (shared, F46-49)
      coverageFreq    [0.3..2]
      overlaySeed     [step]
      baseTypePreset  [dropdown]    // which natural base the overlay sits on (terrestrial/ocean/rocky)
  ▸ Biotic (F46)
      bioMaturity     [0..1]
      bioHue          [color]
  ▸ Technogenic (F47-49)
      techMaturity    [0..1]        // machine
      circuitScale    [1..12]
      circuitGlow     [0..1]
      civMaturity     [0..1]        // city-lights→ecumenopolis (1=saturation)
      cityLightColor  [color]
      districtScale   [0.5..3]
      nightGate       [bool/range]  // D7 nightside emissive gate
```

**Critical lab control:** `baseTypePreset` — lets Max see the overlay composited over different bases (an ecumenopolis over terrestrial vs over rocky) and verify the base shows through. Without it the overlay can't be tested as an overlay. **And a `maturity → 0` sweep on every overlay must reveal the bare base planet** — that's the live verification the architecture holds (§2.4).

---

## 6. 3-cycle-cap risk flags (with named fallbacks)

1. **Voronoi/hex seams on a sphere.** Risk: the current 2D dominant-axis cube projection (`Planet.js:691`) has cube-face seams; naive lat-long UV pinches at poles. **Primary:** 3D object-local Voronoi (27-cell) — seam-free by construction (Stage-A's mandated approach). **Fallback if 27-cell too costly or normals misbehave:** 9-cell tangent-space behind `qualityTier`. **3-cycle cap:** if neither gives clean seam-free facets in 3 rounds, fall back to F43/F44 as *albedo-only* (drop the facet normal) — still reads as crystalline/hex under dither, just flatter. Do NOT death-spiral on the analytic-derivative-of-Voronoi normal; it's the likeliest cap-hit here.

2. **Reaction-diffusion in a single shader pass (no FBO).** Risk: true Gray-Scott RD needs ping-pong buffers → not deterministic from position → re-approach shows different state (foundational research §3.3 is explicit). The fungal mat (F46) MUST be the structural/deterministic layer (it's "where the biosphere grew", stable across visits per Stage-A Q4). **Primary:** thresholded **domain-warped FBM** fake-Turing ([warp](https://iquilezles.org/articles/warp/)) — fully procedural, deterministic, single-pass. **Fallback:** a tiny pre-baked RD tile-LUT (foundational §3.3 "bake one RD pattern per seed into a tileable LUT"). **Do NOT** reach for live FBO RD for the mat — that's only re-opened for the *weather* layer, and a fungal mat is not weather. Multiscale-Turing-style procedural shaders exist (Shadertoy `MdGGzR`, *surfaced in search, not independently verified — fetch/confirm before relying on its exact math*) as a reference if warped-FBM looks too blobby.

3. **Overlay coverage reads as "pasted on" rather than "grown".** Risk: a hard threshold mask gives sharp-edged patches that look like decals, not a biosphere/city that grew. **Mitigations:** (a) feather the mask edge (`edgeWidth` in §2.2, wider at low maturity); (b) cluster the mask with low-freq FBM so coverage follows "settlement basins" not white noise; (c) let the base relief bias coverage (cities in lowlands, mats near water — multiply coverage by a base-derived habitability proxy). **3-cycle cap:** if it still reads pasted-on after 3 rounds, accept a more stylized "obviously-a-game-overlay" look (Max's call — these are speculative game-constructs, §7) rather than chasing photoreal growth.

4. **Magma day/night split fighting the terminator (cross-domain).** Risk: F41 shoreline + OPTICAL F35 terminator-reddening both write the terminator → double-reddening or z-fighting of effects. **Mitigation:** author the magma shoreline as a *surface* term (under posterize, in the molten-temperature field) and let OPTICAL own only the *atmospheric* terminator tint; gate F35 to skip where `magmaFraction` is high. Flag for the cross-domain integration session.

---

## 7. Open questions for Max (taste / scope — this domain is the most taste-laden)

1. **How much does the base planet show through an ecumenopolis?** At `civMaturity → 1`, is it 100% city (Coruscant — base invisible) or do oceans/relief still peek at lows? The architecture supports both; it's a look call. (My read: let *some* base show — it's what distinguishes "built world" from "city texture" — but you decide the floor.)
2. **Are the overlay worlds tidally-locked-by-default for city lights?** Appendix A lists both `city-lights` (rotating, day/night cities) and `eyeball → F48` (locked, fixed nightside). Both work from the same shader. Do you want city-light worlds to lean locked (permanent night cities, more dramatic) or rotating (Earth-like terminator sweep)?
3. **Magma churn: deterministic or weather-layer?** Per Stage-A Q4 the molten *extent* is structural (deterministic) but the *churn animation* can be weather (different each visit). Confirm you want the lava actively roiling (weather, always-running, cheap time-noise) vs frozen-but-glowing (deterministic). I lean roiling — it sells "molten" — but it's a UX call.
4. **Fungal mat: emissive-only (night-glow) or also daytime-colored?** Daytime visibility makes it a colored biome; emissive-only makes it a dark world that lights up at night. The current build is emissive-glow. Which identity?
5. **Crystal/hex/shatter — natural-only, or also exotic-saturated?** These have real natural premises (basalt columns, fracture). Do you want them to stay subtle/realistic (a rocky world with *some* hexagonal terrain) or push to the full "crystal planet" fantasy (whole surface faceted)? The `tessellation`/`crystalDensity` knob spans both; question is where the presets land.
6. **Carbon planet darkness floor.** A true graphite world is *very* dark (albedo ~0.05). Under 6-level posterize that's near-black with sparse diamond sparkle. Is that the intended drama, or do you want the base lifted for readability?

---

## 8. Sources (all URLs verified live unless flagged)

**Overlay compositing / city-lights blend:**
- [Three.js Journey — Earth shaders](https://threejs-journey.com/lessons/earth-shaders) — day/night mix, city-lights only on shaded side (the canonical procedural-overlay pattern).
- [Franky Hung — Make Your Own Earth in Three.js](https://franky-arkon-digital.medium.com/make-your-own-earth-in-three-js-8b875e281b1e) — emissive night-lights blend in `onBeforeCompile`.

**Voronoi / cellular / facets / tessellation (Track i geometric):**
- [Inigo Quilez — voronoise](https://iquilezles.org/articles/voronoise/) — blend noise↔Voronoi, smooth-voronoi power for facet softness (F43/F44).
- [Inigo Quilez — voronoi edge/border distance](https://iquilezles.org/articles/voronoilines/) — F2−F1 borders for joint grooves / cracks (F44/F45).
- [Inigo Quilez — domain warping](https://iquilezles.org/articles/warp/) — fake-Turing organic veining (F46), recursive warp.

**Hexagonal crust natural premise (F44):**
- [USGS — Columnar jointing & cooling history](https://www.usgs.gov/observatories/hvo/news/volcano-watch-columnar-jointing-provides-clues-cooling-history-lava-flows) — basalt columns, 120° junctions, cooling-rate→column-diameter.
- [Oregon State Volcano World — Columnar jointing](https://volcano.oregonstate.edu/columnar-jointing) — hexagonal contraction-crack formation.

**Magma ocean (F41) physical grounding:**
- [Nguyen et al. — Deep Two-phase, Hemispherical Magma Oceans on Lava Planets (ApJ, IOPscience)](https://iopscience.iop.org/article/10.3847/1538-4357/ac8792) — hemispheric dayside magma, terminator boundary, nightside.
- [EarthSky — K2-141b lava planet](https://earthsky.org/space/k2-141b-lava-planet-with-magma-ocean-rocky-rain-supersonic-winds-super-earth/) — tidally-locked, ~3000°C dayside / −200°C nightside, rock-vapor atmosphere recondensing as rock-frost (the nightside condensate premise).

**Fracture / cracks (F45):**
- [Cyan — Voronoi (cracks via F2−F1 + threshold)](https://cyangamedev.wordpress.com/2019/07/16/voronoi/) — procedural crack networks.

**Fake-Turing / organic patterns (F46) — reference, confidence flagged:**
- Shadertoy "Multiscale Turing Patterns" (`https://www.shadertoy.com/view/MdGGzR`) — *surfaced in web search; NOT independently verified (Shadertoy returns 403 to fetch; confirm title/author/whether it's buffer-based before relying on its exact math).* Use the IQ domain-warp article as the primary, buffer-free path.

**Foundational (reused, already verified in the Stage-A research doc):** `research/RESEARCH_high-lod-planet-shaders-2026-06-05.md` §3.3 (Worley F2−F1 cracks + emissive bypass for lava; RD-LUT/fake-Turing dismissal-and-workaround; nimitz animated-FBM churn) and §3.1 (analytic-derivative Voronoi, triplanar).

---

## Cross-domain handoff summary (for the integration session)

| Seam | This domain owns | Other domain owns | Deconflict action |
|---|---|---|---|
| **P15 relief (F43–F45)** | crystalline/hex/shatter relief + albedo | — (RELIEF defers to us) | ONE shared 3D-Voronoi + F2−F1 + analytic-normal impl + `voronoiCells` quality knob |
| **Magma terminator (F41)** | molten surface, magma shoreline cracks, nightside condensate | BANDS/STORMS F32/F33 thermal-emission glow; OPTICAL F35 terminator reddening | magma shore = surface term (we own); gate OPTICAL F35 off where `magmaFraction` high |
| **Overlay base (F46–F49)** | mask × overlay-term × blend-over-base math | ALL natural-base domains (terrestrial/ocean/rocky relief, oceans, clouds, weather, optical) | overlay block reads base `finalColor` + `landMask` + `diffuse` as locals; ordering contract in mega-shader (base computed first, overlay last before envelope) |
