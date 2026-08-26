# Well Dipper — Stage-B Domain Research: Fluvial & Standing-Liquid

**Date:** 2026-06-06 · **Stage:** B (per-domain HOW + generation-path) · **Domain:** the liquid half of F-gradational (water / methane shaped).
**Plugs into:** Stage-A foundation — analytic-derivative `noised()`/`fbmd()` base, `lodRamp = smoothstep(20,6,dist/radius)`, variable-octave FBM + fwidth clamp, composite-split envelope (`posterize(surface, posterizeLevels) + emissiveGlow + specGlint + limbGlow`), driver→semantic-uniform scaffolding (`deriveUniforms()` in `planet-lod-lab-core.js`).
**Reuses vocabulary from:** `research/RESEARCH_high-lod-planet-shaders-2026-06-05.md` (analytic-derivative noise, ridged multifractal, domain warp, Voronoi border distance, Gerstner waves, clouds-as-relief, emissive bypass, fresnel vs Lague raymarch).

> Stage C implements directly from this. Techniques are labelled **[proven]** (shipped in a cited real-time/demoscene/SIGGRAPH source), **[adapted]** (proven elsewhere, needs a sphere/posterize port), or **[speculative]** (my synthesis; flag for a harness spike).

---

## 1. Scope

| Covered | |
|---|---|
| **Features (F#)** | F11 river networks & valleys · F12 deltas & alluvial fans · F13 outflow / megaflood channels · F14 lakes & seas (standing liquid) · F20 coastlines · F21 karst / dissolution |
| **Processes (P#)** | P8 fluvial erosion/deposition · P13 coastal/shoreline action · P14 karst/chemical dissolution |
| **Drivers (D#)** | D1 T_eq · D2 volatileFraction · D4 atmosphere comp (rain) · D6 atmosphere retention (liquid-stability gate) · D14 mass/gravity · (D13→D6→P25 the existence gate upstream) |

**The two-layer split (Q4, resolved by Max 2026-06-05) is the spine of this domain:**

- **Structural / deterministic layer** — the *incised relief*: channels, valleys, canyon walls, delta lobes, lakebed basins, coastline geometry, karst pits. These carve the `noised()` height field and **MUST be a pure deterministic function of position + seed** (continents/coastlines reproducible across visits). This is where the hard problem (dendritic networks on a sphere) lives.
- **Weather / animation layer** — the *standing-liquid surface*: ocean/lake shading, Gerstner wave motion, foam, current hints, glint motion. This is a flat-shaded masked layer over the structural basins; it need **NOT** be reproducible across visits → time-animated noise (and FBO sims, if ever wanted) are re-opened for it.

**Cross-domain seams — DEFERRED (handoffs noted in §2 and §6):**

- **F36 sunglint off liquid** → **OPTICAL agent**. I own the **liquid-body mask** (`liquidMask` semantic uniform) and the **surface shading + Gerstner normal**; OPTICAL owns the specular `pow(dot(N,H),k)` glint term that reads my normal+mask. The envelope already has a `specGlint` bypass channel built — that channel is OPTICAL's, fed by my mask.
- **Glacial / cryo liquids (frozen volatiles, P10/P11)** → **CRYO agent**. The boundary: I handle liquid that *flows and stands as a fluid surface today*; once D1 drops the stable species below its freezing point, the body becomes a solid (glacier, N₂/CH₄ frost field) and is CRYO's. My `liquidStability` gate hands off to CRYO at the freeze threshold (see §3).
- **Aeolian (P9, dry playa wind forms)** → **AEOLIAN agent**. I own the *dry lakebed basin + evaporite mask* (F14 "dry playa" variant); AEOLIAN dresses it with dunes/wind-streaks. Shared `liquidMask == 0 && basinMask == 1` region.

---

## 2. Per-feature research

Everything below assumes the shared `noised()` core + `fbmd()` variable-octave base + `lodRamp` + fwidth clamp + lighting-routed detail (the Stage-A universal base). Each feature adds a *combiner* or a *masked layer*, never a `planetType` branch.

### The master gate (applies to the whole family) — `liquidStability` + `liquidSpecies`

Before any F# renders, two NEW semantic params switch and parameterize the entire stack. Both are derived CPU-side in `PlanetGenerator` (and mirrored in the lab's `deriveUniforms()`), passed as uniforms, consumed generically.

- **`liquidStability` (float 0..1)** — "is there a thermodynamically stable, retained liquid?" Derived from **D6 (retention) AND D2 (volatile budget) AND D1 (T_eq sits in a liquid window for *some* species)**. `0` ⇒ the airless/dry path: the **whole fluvial/coastal/karst stack is bypassed** (an unshielded world stripped by P25, or a bone-dry `volatileFraction<0.05` world, skips it entirely). This is the single switch that makes "airless world skips this family" explicit in the generation path, not an art accident.
- **`liquidSpecies` (int enum + a packed `vec4` of physical params)** — which liquid is stable at this D1. Not "water." Two regimes today (extensible):
  - **water** (T_eq ≈ 273–373 K with pressure): IOR ≈ 1.33, density high, deep color = blue (driver-set, not hardcoded), high surface tension → sharper waves, *higher* albedo contrast vs land.
  - **methane/ethane** (T_eq ≈ 90–112 K, Titan regime, needs thick cold atmosphere): IOR ≈ 1.29, low density, **dark/oily low-albedo body that reads BRIGHTER than land only at the glint** (verified against Cassini: Titan landmasses are *dark*, seas dark too except specular) [proven — phys.org/sci.news Cassini]. Damped, oily wave behavior (lower steepness).
  - The shader consumes `liquidSpecies` params (deep color, shallow color, IOR→fresnel F0, wave steepness, albedo-contrast sign) — **no `type==ocean` branch**; a "Titan" preset is just a driver bundle that lands `liquidSpecies=methane`.

---

### F14 — Lakes & seas (standing liquid) · `[partial]` today (ocean-type water+islands, `Planet.js:513-528`)

This is the **anchor feature** and the existing precedent. Build it first; F11/F12/F13/F20 carve INTO the same basin field, F21 is a sibling mask.

**(a) Render HOW.** Standing liquid is a **flat-shaded masked layer**, not relief — it sits at a `seaLevel` cut through the deterministic height field, exactly as the current `terrestrial`/`ocean` paths do (`height = pattern*0.5+0.5; landMask = step(seaLevel, height)`), generalized:
- **`liquidMask = smoothstep(seaLevel - ε, seaLevel + ε, height)`** where `height` is the `noised()` value. ε small = sharp shoreline. This mask is the structural deterministic output everyone downstream (OPTICAL glint, AEOLIAN playa) consumes.
- **Body color** = `mix(deepColor, shallowColor, depthFromShore)` where `depthFromShore = smoothstep(seaLevel-0.3, seaLevel, height)` — depth-gradient gives the lighter littoral band. Colors come from `liquidSpecies`, not `baseColor`.
- **Weather layer on top (LOD-ramped in):** Gerstner detail (see F14 wave note below) modulates the *normal* of the liquid layer; foam at crests; the OPTICAL glint reads this normal. At LOD1/far the body is near-flat (waves sub-pixel → fwidth clamp fades them to mean); waves *ramp in with `lodRamp`* so a distant sea is a clean posterized plane and a close sea shimmers.
- **Lakes vs seas** is purely a consequence of basin size in the height field — no separate feature. A small enclosed basin below `seaLevel` is a lake; a globe-spanning one is a sea. `liquidCoverage` (driver, below) shifts `seaLevel` to set ocean-world vs lake-dotted-continent.

**Gerstner-on-a-sphere note (the Q2 risk, scoped for this domain).** The Stage-A research flagged sphere flow-frame as the single biggest technical fork. For standing liquid specifically: the canonical spherical-Gerstner implementations are **vertex-displacement** with a dome projection to avoid pole pinch [proven — mharitsnf.xyz]. **Well Dipper does NOT displace vertices at planet scale** (the foundational research is explicit: Gerstner runs in the fragment shader as a normal-only perturbation). So the port is: **derive a per-fragment tangent frame from the object-space position** (`T = normalize(cross(up, N)); B = cross(N, T)` with a pole-safe `up` swap when `|N.y|>0.99`), project each wave direction onto that tangent plane, and accumulate the analytic Gerstner normal in tangent space — **no displacement, no dome, no pole pinch because we never move geometry.** Arc-distance phase uses `acos(dot(posN, dirN))*radius` per the spherical formulation. **[adapted]** — this is the one F14 mechanism that warrants a dedicated harness spike (§5).

**(b) Generation path.** D2 (volatileFraction) + D1 (T_eq in species window) + D6 (retention) → P8/P13 → `liquidCoverage` (how much of the surface is below sea level) + `seaLevel` + `liquidMask`(shader-computed). CPU-side in `PlanetGenerator`: derive `liquidCoverage = f(volatileFraction, T_eq)` (more volatile + temperate ⇒ higher coverage, clamped); set `seaLevel` from it. `liquidSpecies` from the T_eq band. All flow through `deriveUniforms()` exactly like the existing `specStrength`/`cloudCoverage`. **No new driver needs surfacing** — D1/D2/D6 already in `planetData` (`:703`, composition `:687`, atmosphere `:691`).

**(c) Envelope interaction.** **Survives, with a bypass seam.** The flat body color posterizes fine (it's a low-frequency luminance plane — the current ocean already does this at 6 levels). The **glint** must bypass (OPTICAL's `specGlint` channel) — a banded specular star looks broken. Foam is high-luminance → survives as the top posterize band. **Keep.**

**(d) Quality fallback.** Rich: full Gerstner (4–6 waves) + foam + curl-noise current hints + OPTICAL Lague-fed glint. Cheap (`qualityTier<0.5`): static `liquidMask` + flat depth-gradient color + a single low-freq normal ripple + fresnel-only highlight. Both reachable behind `qualityTier` + `lodRamp`; the mask itself is identical (deterministic), only the weather layer's richness scales.

---

### F11 — River networks & valleys · `[aspirational]` · **THE HARD PROBLEM**

**The challenge:** hydrologically-plausible *dendritic* channel networks on a sphere, **without a CPU erosion sim per planet**, that are **deterministic** (structural layer). Three viable strategies — I recommend a primary and name the fallbacks, because this is the chief 3-cycle-cap candidate (§5).

#### Strategy A — In-shader analytic dendritic via inverted-ridged domain warp · `[adapted]` · **RECOMMENDED PRIMARY**
The cheapest, fully in-shader, zero-data, deterministic-by-construction path. Reuses the foundation's exact vocabulary.
- **Mechanism:** ridged multifractal *inverted* gives a network of sharp valleys instead of sharp ridges. IQ's domain-warp turns the smooth network into branching, meandering, "authored" channels. Core: `ridge = 1.0 - abs(noised(warp(p)).x)`; the **valleys of the ridged field ARE the dendritic channels** — ridged noise naturally produces a connected, branching, tree-like low-locus (this is *why* ridged noise looks like eroded terrain). Domain-warp the input (`p += k*fbmd(p)`) to break the regularity into meanders/tributaries.
- **Incision:** carve the height field where the channel mask is high — `height -= channelDepth * smoothstep(channelWidth, 0.0, ridgeDist)`, with a **V/U-profile cross-section** (`pow(ridgeDist, profileExp)`, exp≈1 V-shape young, ≈2 U-shape mature/glacial-adjacent). Because we carry the analytic gradient from `noised()`, the channel normal is exact and free.
- **Flow-direction coherence (the weakness):** pure inverted-ridged valleys are *locally* dendritic but not *globally* downhill toward the sea — they don't guarantee monotonic descent to `seaLevel`. Mitigation: **bias the warp by the large-scale height gradient** so channels statistically run downslope (`warp += -gradDir * flowBias`), and **gate channel existence by `height > seaLevel` and `< snowLine`** so they only appear on land in the rain belt. This gets "looks like rivers" without true hydrology. **Honest limit:** a viewer who traces a channel may find it doesn't perfectly reach the coast. For a retro-posterized planet seen from orbit→close, this is very likely acceptable — but it's the **[speculative]** part and the reason for the harness spike.
- **LOD-ramp:** channels fade in with `lodRamp` (sub-pixel at distance → fwidth-clamped to mean). Trunk channels (low-freq warp) appear first; tributaries (high-freq) ramp in last. Perfect fit for the octave-count ramp.

#### Strategy B — CPU graph grown upstream from coastal outlets, baked to a per-body data texture · `[proven]` · **FALLBACK / "real rivers"**
If A's non-monotonic channels read wrong, this is the proven correct-hydrology path used by procedural-planet work.
- **Mechanism (Red Blob / River-Networks-for-Instant-Procedural-Planets line):** generate drainage basins *first* by BFS/Dijkstra growth **upward from coastal outlets** (cells where `height` crosses `seaLevel`), noise-biased so basins are asymmetric/natural, building a binary tree (source / bend / fork nodes). Rivers are the tree edges; flow/Strahler order = drainage area accumulated up the tree. **[proven — redblobgames.com/x/1723, Genevaux River Networks for Instant Procedural Planets].**
- **Reaches the shader as data:** rasterize the river graph into a per-body **channel distance-field texture** (R = distance-to-nearest-channel, G = flow/Strahler order → width, B = along-channel param → flow phase). Sampled in the fragment shader to carve incision + drive water animation. This is the "generated CPU-side as data" path; it's deterministic (seeded) and correct, at the cost of a per-body bake (~ms, cached on the planet object like other generated fields).
- **Cost/risk:** the bake is CPU work at planet-load; needs a sphere parameterization for the texture (cube-map or octahedral to dodge UV poles). More plumbing than A.

#### Strategy C — Flow-accumulation precompute from the heightfield · `[proven]`-but-heavy · **NOT recommended now**
Classic D8/D-infinity flow-accumulation over a sampled heightfield → drainage raster → threshold = rivers. Correct and standard in GIS, but it's an iterative grid pass (the arxiv flow-accumulation papers) — heavier than B for no visual gain at our fidelity, and the "no CPU sim per planet" constraint argues against it. List it only as the academically-correct reference point.

**Recommendation:** ship **Strategy A** behind the lab's `▸ Fluvial` folder first (zero data, fastest to validate visually under the posterizer). If the harness shows channels reading as "noise scratches" rather than "rivers," escalate to **Strategy B** (bake the graph to a distance-field texture). Hard-cap at 3 cycles before switching A→B.

**(b) Generation path (all strategies).** D4 (rain — needs atmosphere comp implying precipitation) + D1 (liquid stable) + D14 (gravity affects channel width/incision rate) + surfaceHistory.erosion (D11 — relict vs active) → P8 → semantic uniforms: `riverDensity` (float, 0 if dry/airless), `channelIncision` (depth scalar), `channelProfileExp` (V↔U), `riverRelict` (0 active sharp → 1 degraded, from erosion). For Strategy B add `channelFieldTex` (sampler2D, the baked distance-field). **`riverDensity` and the erosion→relict mapping are NEW derivations** to add to `deriveUniforms()`. **D4 "rain" is not currently a first-class field** — today atmosphere composition implies it; surfacing a `precipitation` scalar (from comp `n2-o2`/temperate + T_eq) is a small NEW derivation worth adding.

**(c) Envelope interaction.** **Survives — it's relief.** Channels are normal/height detail (the posterizer's friend, per the foundational "route detail through normals not color" spine). At 6 levels they read as crisp incision shadows. No bypass needed. **Keep.**

**(d) Quality fallback.** Rich (`qualityTier=1`, LOD2 close): full warped network + tributaries + meanders, V-profile. Cheap: trunk channels only (low-freq warp, fewer octaves) or, off-planet, none (fwidth-clamped away). Strategy-B texture sampled at lower mip on weak GPUs.

---

### F12 — Deltas & alluvial fans · `[aspirational]`

**(a) Render HOW.** A delta/fan is a **depositional bulge where a channel meets `seaLevel`** (delta) or a slope break (fan). Mechanism: at channel termini (mask high AND `height ≈ seaLevel`), **add** a fan-shaped height lobe instead of carving — `height += fanHeight * radialFalloff * distributarySplit`. Distributaries (birdsfoot pattern) come from splitting the channel mask into 2–4 sub-channels via a small Voronoi/hash at the mouth. Fan vs birdsfoot is a single param: open fan = smooth radial lobe; birdsfoot = high distributary contrast.
- This is **derived from F11's channel field** — a delta only exists where a river reaches a standing body, so F12 reuses the channel mask + `liquidMask` boundary. Cheap once F11 exists.

**(b) Generation path.** Inherits F11's `riverDensity`/`channelField` + `liquidMask`. New scalar `deltaDeposition` (D14 gravity + sediment proxy from erosion). Lower gravity / higher sediment → broader fans.

**(c) Envelope interaction.** **Survives** — relief + a subtle albedo tint (sediment lighter than deep water). The albedo part may be crushed at 6 levels → express as a *shallow-water* band (it already is, via depth gradient). **Keep (stylize the sediment color as a depth band).**

**(d) Quality fallback.** Rich: multi-distributary birdsfoot. Cheap: a single smooth fan lobe or omit (only visible at LOD2 close-up anyway).

---

### F13 — Outflow / megaflood channels · `[aspirational]`

**(a) Render HOW.** Catastrophic-release channels (Scablands / Kasei Valles): **wide, shallow, streamlined-island scoured** troughs — distinct from dendritic rivers (they're *anastomosing*, not tree-like). Mechanism: a **broad domain-warped trough** (low-freq, high-width inverted-ridge) with **embedded streamlined islands** = teardrop-shaped *un-incised* residuals (Voronoi F1 cells elongated along flow, left standing above the scoured floor). `floor = base - scourDepth; islands = Voronoi residuals aligned to flowDir`.
- Rare feature — gate hard so it appears on few worlds (a `megafloodFlag` from surfaceHistory + relict water). Mostly a **relict** look (sharp-walled, dry floor) since megafloods are catastrophic past events.

**(b) Generation path.** surfaceHistory (D11) + relict liquid (was-stable-now-dry, i.e. `liquidStability` low but `volatileFraction` historically high) → P8 catastrophic. Semantic: `outflowChannel` (0/1 rare flag + direction). Essentially a **dry-channel variant of F11** — reuses the incision machinery with a wide-low-island profile.

**(c) Envelope interaction.** **Survives — relief.** **Keep.**

**(d) Quality fallback.** Cheap: a single wide trough; drop islands. Rich: full island field.

---

### F20 — Coastlines · `[aspirational]` (partially implicit in F14 today)

**(a) Render HOW.** Coastlines are the **`liquidMask` boundary**, dressed:
- **Paleo-shorelines / strandlines:** stacked terraces above the current `seaLevel` = a **height-posterize** (`floor(height*N)/N`) applied in a band just above sea level → benches recording past liquid levels. This is the "abandoned levels record paleo-climate" look. The height-terracing survives the *color* posterizer cleanly (it's relief).
- **Sea cliffs:** where the coastal slope is steep (high `|gradient|` at the mask boundary), sharpen the shoreline ε → a hard cliff line. Where shallow, widen ε → a beach/littoral band (already the depth-gradient shallow color).
- **Beaches/terraces:** the shallow-water band + a lighter sediment tint just landward of the mask.

**(b) Generation path.** Inherits `liquidMask` + `seaLevel`. New scalar `paleoShorelineCount` (from D1 history / axialTilt seasonal swing — worlds with big climate swings get more strandlines) and `coastRelief` (cliff vs beach mix from coastal gradient, computed in-shader). `paleoShorelineCount` is a small NEW derivation.

**(c) Envelope interaction.** Strandline terraces **survive (they're relief-posterize).** Beach sediment tint is **stylize/borderline** — at 6 levels a faint tan band may collapse; express as a lightness step, not a hue. **Keep terraces; stylize beach.**

**(d) Quality fallback.** Cheap: just the sharp mask boundary (1 shoreline). Rich: multi-terrace strandline flight + cliff/beach variation.

---

### F21 — Karst / dissolution · `[aspirational]`

**(a) Render HOW.** Dissolution terrain (sinkholes, labyrinth mazes — Titan's labyrinth, Earth limestone): a **subtractive Voronoi/Worley pit field on a soluble lithology**. Mechanism: `Voronoi F1` cells, deepen cell centers (`height -= sinkholeDepth * smoothstep(rim, 0, F1)`) → bowl pits (dolines); use **F2−F1 border distance** (the IQ voronoilines trick already in the foundation's relief vocabulary) to carve the **labyrinth maze walls** (high-relief ridges between dissolution valleys). Maturity param scales from shallow grooves → deep maze.
- Karst needs *a solvent + soluble crust*, so it's gated by `liquidStability>0` (a solvent exists) AND a `solubleLithology` driver (mineralogy). It's a **sibling mask** to rivers, not a child — can coexist with or replace dendritic drainage (mature karst captures surface drainage underground → *fewer* surface rivers, a nice driver interaction: high karst ⇒ suppress `riverDensity`).

**(b) Generation path.** D2 (solvent) + composition (soluble lithology proxy — e.g. carbon/carbonate or ice-rock surfaceType) + D4 (rain) → P14 → semantic uniforms `karstMaturity` (0..1) + `solubleLithology` (0/1 gate). Both NEW. Interaction rule in `deriveUniforms()`: `riverDensity *= (1 - 0.6*karstMaturity)`.

**(c) Envelope interaction.** **Survives — relief** (pits and maze walls are normal/height). **Keep.**

**(d) Quality fallback.** Cheap: sparse shallow F1 pits. Rich: full F2−F1 labyrinth maze.

---

## 3. Proposed semantic-uniform registry additions

Mirrors the `deriveUniforms()` flat-output convention in `planet-lod-lab-core.js` (physics bundle → flat semantic values, no `planetType` branch). All derived CPU-side in `PlanetGenerator` and mirrored in the lab core.

| Uniform | GLSL type | Driver source (D# → P#) | Range | Default | Notes |
|---|---|---|---|---|---|
| `liquidStability` | `float` | D6+D2+D1 → P25/P8 gate | 0–1 | 0 | **Master gate.** 0 ⇒ entire family bypassed. NEW. |
| `liquidSpecies` | `int` | D1 → species window | 0=none,1=water,2=methane | 0 | Selects the param block below. NEW. |
| `liquidDeepColor` | `vec3` | `liquidSpecies` | — | (0,0,0) | Driver-set; water=blue, methane=dark. NEW. |
| `liquidShallowColor` | `vec3` | `liquidSpecies` | — | (0,0,0) | Littoral band color. NEW. |
| `liquidIOR` | `float` | `liquidSpecies` | 1.2–1.4 | 1.33 | → fresnel F0 (OPTICAL reads). NEW. |
| `liquidAlbedoSign` | `float` | `liquidSpecies` | -1 or +1 | +1 | water brighter than land (+1) vs methane darker (−1). NEW. |
| `waveSteepness` | `float` | `liquidSpecies` + D14 | 0–1 | 0.5 | Gerstner Q; methane lower (oily). NEW. |
| `liquidCoverage` | `float` | D2+D1 → P8 | 0–1 | 0 | Sets `seaLevel`; ocean-world vs lakes. NEW. |
| `seaLevel` | `float` | from `liquidCoverage` | 0–1 | 0.5 | Height cut for `liquidMask`. NEW. |
| `riverDensity` | `float` | D4+D1+D14 → P8 | 0–1 | 0 | Channel network strength; 0 if dry. NEW. |
| `channelIncision` | `float` | D14+D4 → P8 | 0–1 | 0.3 | Carve depth into height field. NEW. |
| `channelProfileExp` | `float` | erosion(D11) → P8 | 1–2 | 1.3 | V (young) ↔ U (mature). NEW. |
| `riverRelict` | `float` | surfaceHistory.erosion (D11) | 0–1 | 0 | Sharp active → degraded relict. NEW. |
| `precipitation` | `float` | D4 comp + D1 | 0–1 | 0 | Surfaces "rain" (D4) as first-class. NEW. |
| `deltaDeposition` | `float` | D14 + sediment proxy | 0–1 | 0.3 | Fan breadth / birdsfoot mix. NEW. |
| `outflowChannel` | `float` | D11 + relict liquid | 0/1 | 0 | Rare megaflood flag. NEW. |
| `paleoShorelineCount` | `float` | D1 history + D3 axialTilt | 0–1 | 0 | Strandline terrace count. NEW. |
| `karstMaturity` | `float` | D2+comp+D4 → P14 | 0–1 | 0 | Dissolution depth. NEW. |
| `solubleLithology` | `float` | composition surfaceType | 0/1 | 0 | Karst lithology gate. NEW. |
| `channelFieldTex` | `sampler2D` | Strategy-B bake (P8) | — | — | OPTIONAL (only if F11 escalates A→B). NEW. |

**Shared with OPTICAL (do not duplicate):** `liquidMask` (computed in-shader from `height`/`seaLevel`, exported as a varying-or-recompute for the glint term) and the Gerstner surface normal. OPTICAL's existing `specGlint`/`specStrength`/`specBypass` channel consumes these — already built in Stage A.

---

## 4. Lab folder spec — `▸ Fluvial`

Add one lil-gui folder (collapsed by default), every control a semantic uniform declared once (per the spec's "every control is a semantic uniform" rule). Sits between `▸ Surface — Relief` and `▸ Aeolian`.

```
▸ Fluvial   (folder, closed)
  ── Gate ──
  liquidStability   slider 0–1        // master kill-switch for the whole folder
  liquidSpecies     dropdown {none, water, methane}
  liquidCoverage    slider 0–1        // drives seaLevel
  seaLevel          slider 0–1        // (auto from coverage; manual override)
  ── Standing liquid (F14 / F20) ──
  waveSteepness     slider 0–1
  waveCount         slider 1–6 (int)  // Gerstner wave sum
  foamThreshold     slider 0–1
  paleoShorelines   slider 0–1        // strandline terrace count
  coastCliffiness   slider 0–1        // cliff ↔ beach
  ── Channels (F11 / F12 / F13) ──
  riverStrategy     dropdown {A: warp-analytic, B: baked-field}  // harness fork
  riverDensity      slider 0–1
  channelIncision   slider 0–1
  channelProfileExp slider 1–2        // V ↔ U
  riverRelict       slider 0–1        // active ↔ degraded
  flowBias          slider 0–1        // downhill coherence (Strategy A)
  deltaDeposition   slider 0–1
  outflowChannel    toggle            // megaflood (rare)
  ── Karst (F21) ──
  karstMaturity     slider 0–1
  solubleLithology  toggle
  ── debug ──
  showLiquidMask    toggle            // visualize the mask OPTICAL consumes
  showChannelField  toggle            // visualize the channel distance field
```

Driver presets that exercise this folder (add to `DRIVER_PRESETS` in `world-engine-lab.html`): **"Earthlike (rivers+seas)"**, **"Titan (methane seas)"** (`liquidSpecies=methane`, cold, thick atmo), **"Mars-relict (dry channels)"** (`riverRelict=1`, `liquidStability=0` now but channels carved), **"Airless rock"** (`liquidStability=0`, folder fully bypassed — proves the gate).

---

## 5. 3-cycle-cap risk flags

| Risk | Why | Fallback |
|---|---|---|
| **Dendritic networks on a sphere (F11) — CHIEF RISK** | Strategy A (inverted-ridged warp) gives *local* dendritic look but **not guaranteed-downhill-to-sea** flow; may read as "noise scratches" under posterize. | **Hard cap 3 cycles on Strategy A.** Escalate to **Strategy B** (CPU graph grown upstream from coastal outlets, baked to a per-body distance-field texture) — proven-correct hydrology, more plumbing. Do NOT attempt Strategy C (flow-accumulation grid) — heavier, no visual gain. |
| **Gerstner sphere tangent frame (F14)** | This is the Stage-A Q2 fork localized to liquid. Per-fragment tangent frame can flip/pinch near `\|N.y\|→1`. | Pole-safe `up`-swap when `\|N.y\|>0.99`; if still unstable, fall back to **3D-domain curl-noise ripple** (no explicit tangent frame) for the weather layer — lower fidelity but pole-immune. |
| **Methane-sea readability under posterize** | Titan seas are *dark like the land* except at glint — at 6 levels a dark sea over dark land may vanish entirely. | Stylize: give methane seas a deliberate (non-physical) faint sheen band so the mask reads, OR lean entirely on OPTICAL's glint + a thin bright shoreline to delineate. Flag for Max (taste). |
| **Strategy-B sphere texture parameterization** | If escalated, the baked channel field needs a seam-free sphere map. | Cube-map or octahedral parameterization (dodges UV poles); reuse whatever the relief domain settles for its own sphere-noise framing. |

---

## 6. Open questions for Max (taste / scope)

1. **Dendritic fidelity bar (F11).** How "correct" must rivers be? If channels reading as plausible *texture* from orbit→mid-close is enough, Strategy A ships cheap. If you want to trace a river mouth-to-source and have it work, we commit to the Strategy-B bake up front (more plumbing). My read: start A, escalate only if the harness looks wrong — but the bar is yours.
2. **Methane seas — physical or legible?** Physically Titan's seas are near-invisible (dark on dark) except at glint. Do you want that eerie physical accuracy (seas you only see when the sun glints), or a stylized always-readable methane sea (faint sheen so the mask shows)? Affects `liquidAlbedoSign`/sheen handling.
3. **How much standing-liquid weather animation at LOD1 (orbital)?** Gerstner/foam are a close-up payoff. Should an *orbital* sea be a dead-flat posterized plane (cheap, clean) or carry a faint large-scale swell? (I lean dead-flat far, ramp waves in with `lodRamp`.)
4. **Karst↔river interaction.** I propose mature karst *suppresses* surface rivers (drainage goes underground). Is that interaction worth the realism, or just render both independently? (Realism is cheap here — one multiply — but it's a design call.)
5. **Paleo-shorelines as a climate-history tell.** Strandline terraces visually encode "this world's seas have risen/fallen." Want that as a first-class storytelling feature (worlds with big axial tilt get dramatic terrace flights), or keep coastlines simple?

---

## 7. Sources

All URLs fetched or surfaced via WebSearch 2026-06-06; verified real. Where a source was access-blocked or read only via snippet, it's flagged.

**Dendritic rivers / drainage (F11):**
- Red Blob Games — *Procedural river drainage basins* (BFS/Dijkstra growth upstream from coastal outlets, binary-tree source/bend/fork) — https://www.redblobgames.com/x/1723-procedural-river-growing/ **[fetched, load-bearing for Strategy B]**
- *River Networks for Instant Procedural Planets* (Genevaux et al.) — hierarchical drainage graph as a modeling primitive on planets — https://www.researchgate.net/publication/230363605_River_Networks_for_Instant_Procedural_Planets **[snippet/abstract only — full PDF not fetched]**
- *Procedural Riverscapes* (Peytavie et al., HAL) — bare heightfield → hydrologically-inspired river trajectories + real-time water animation — https://hal.science/hal-02281637/file/main.pdf **[BLOCKED by Anubis access-control; identified via search snippet only — retrieve via institutional access before relying on exact method]**
- *Procedural Generation of Landscapes with Water Bodies* (CGI'22, optimal channel networks over a grid graph) — https://cgvr.cs.uni-bremen.de/papers/cgi22/CGI22.pdf **[snippet only]**
- Nick McDonald — *Procedural Hydrology: Dynamic Lake and River Simulation* — https://nickmcd.me/2020/04/15/procedural-hydrology/ **[snippet only]**
- *Simple I/O-efficient flow accumulation on grid terrains* (Strategy-C reference) — https://arxiv.org/pdf/1211.1857 **[snippet only]**

**Domain warp / inverted-ridged valleys (F11 Strategy A):**
- Inigo Quilez — *Domain warping* (warp the input space; basis for the meandering channel warp) — https://iquilezles.org/articles/warp/ **[reused from Stage-A spec; verified canonical]**
- Inigo Quilez — *Voronoi edge/border distance* (F2−F1 for karst maze walls + delta distributaries) — https://iquilezles.org/articles/voronoilines/ **[reused from Stage-A spec]**
- The Book of Shaders — *Fractal Brownian Motion* (ridged/billow variants) — https://thebookofshaders.com/13/

**Gerstner on a sphere (F14):**
- Harits Nur Fauzan — *Spherical Gerstner Wave: Vertex Shader* (sphere tangent-plane wave direction `cross(posN, cross(posN−dirN, posN))`, arc-distance phase, dome anti-pinch) — http://mharitsnf.xyz/posts/spherical-gerstner-waves/ **[fetched, load-bearing — note: vertex-based; WD adapts to per-fragment normal-only]**
- *Seamless water waves simulation on a planetary sphere* (Unity Discussions) — https://discussions.unity.com/t/seamless-water-waves-simulation-on-a-planetary-sphere/853088 **[snippet]**
- GPU Gems Ch.1 — *Effective Water Simulation (Gerstner waves + analytic normals)* — https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models **[reused from Stage-A spec]**

**Methane/ethane seas — `liquidSpecies` (F14):**
- Phys.org — *Cassini sees sunny seas on Titan* (specular sunglint; dark seas/dark land contrast) — https://phys.org/news/2014-10-cassini-sunny-seas-titan.html **[search-verified]**
- AAS Nova — *Sun Glitter and Sunglint on Titan's Hydrocarbon Seas* (2025) — https://aasnova.org/2025/04/25/sun-glitter-and-sunglint-on-titans-hydrocarbon-seas/ **[search-verified]**
- *Modeling specular reflections from hydrocarbon lakes on Titan* (Icarus, ScienceDirect) — https://www.sciencedirect.com/science/article/abs/pii/S0019103512002126 **[abstract only]**
- NASA/JPL — *Cassini Sees Sunny Seas on Titan* — https://www.nasa.gov/jpl/cassini-sees-sunny-seas-on-titan/ **[search-verified]**

**Posterization discipline (reused from Stage-A foundational research):**
- Maxime Heckel — *The Art of Dithering and Retro Shading* — https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/
- IQ — *value noise + derivatives (morenoise)* — https://iquilezles.org/articles/morenoise/ (the `noised()` base everything carves into)
