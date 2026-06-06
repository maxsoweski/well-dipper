# Stage-B Research — Cryo / Sublimation Domain (the cold half of the surface)

**Date:** 2026-06-06 · **Domain:** CRYO / SUBLIMATION · **Stage:** B (per-domain HOW + generation-path research)
**Project:** `~/projects/well-dipper` · three.js r183.1 / WebGL2 · desktop-primary, graceful mobile
**Plugs into:** Stage-A foundation (`docs/superpowers/specs/2026-06-06-planet-rendering-foundation-design.md`) — `noised()` analytic-derivative base, `lodRamp` scalar + hysteresis, variable-octave FBM + fwidth clamp, composite-split envelope (`posterizeLevels` + per-effect bypass), driver→semantic-uniform scaffolding.
**Vocabulary base:** `research/RESEARCH_high-lod-planet-shaders-2026-06-05.md` (reused, not re-derived).

> **Frame discipline carried through this doc:** NO parity-with-old. NO `planetType` branch — everything derives from DRIVERS via semantic uniforms. Single shader behind `qualityTier` + `lodRamp`; cheap fallback reachable behind the same uniforms. Retro envelope (posterize 6→16 + Bayer/IGN dither) is a tunable axis, not a fixed stance — each feature below is tagged survive / bypass / keep-stylize-drop.

---

## 1. Scope

**Features (F#):**
- **F17 — Glacial landforms.** ice sheet/glacier · U-valley · fjord · moraine · esker · polar layered deposits. From **P10** (glacial flow).
- **F18 — Sublimation landscapes.** pits/hollows · Swiss-cheese · bladed/penitente · araneiform spiders · convection polygons. From **P11** (sublimation/volatile etching).
- **F22 — Polar caps & frost fields.** perennial water cap · seasonal CO₂ frost · N₂/CH₄ frost field · **eyeball nightside cap + terminator melt ring**. From **P22** + **P10**.
- **F23 — Snowline / frost-coverage boundary.** sharp coverage line · diffuse tint · latitude-vs-altitude band. From **P22**. *The bridge family between climate and terrain — this is the spine of the whole domain.*

**Processes (P#):** P10 glacial flow · P11 sublimation/volatile etching · P22 seasonal volatile cycling · P7 cryovolcanism (generation-path only — see seam).

**Drivers (D#):** D1 T_eq (snowline MASTER gate) · D2 volatileFraction **+ a new SPECIES selector** · D3 axialTilt (seasonal/polar accumulation latitude) · D12 tidal heating (cryovolcanism). Secondary: D5 atmosphere density (thin-air → penitentes/araneiforms; thick-air → frost diffuses), the height field itself (altitude snowline).

**Cross-domain seams (DEFER + handoff, do not build here):**
| Seam | What cryo owns | What the other domain owns | Coordinate on |
|---|---|---|---|
| **Cryovolcanism P7 → F9 chaos / F10 ridged-icy** | The **generation-PATH** (volatile + tidal-heat resurfacing drivers that *flag* a surface as cryo-active) and the **icy-surface material/albedo** | The chaos/ridged-icy **relief geomorphology** rendering | RELIEF agent — shared `cryoActive` / `surfaceAge` uniform; cryo writes it, relief reads it for resurfacing-erases-craters |
| **Eyeball nightside cap + terminator melt ring (F22 variant)** | The **frost-cap surface** (high-albedo overlay on the cold hemisphere) | tidally-locked circulation **P21** (where the cold zone *is*) + terminator **optics** (melt-ring glow) | BANDS/STORMS (substellar→antistellar T field) + OPTICAL (terminator gradient) — cryo consumes a `dayNightTerminator` value, does not compute it |
| **Snowline coverage vs relief** | The **coverage MASK** (is it cold enough here for solid volatile) | The underlying **relief** the mask paints onto | RELIEF agent — cryo is a per-fragment overlay that reads the shared height/normal, adds no relief except where F17/F18 explicitly do |

---

## 2. Per-feature research

### Framing primitive used throughout: the frost-coverage mask (F23 / P22)

This is the **single most reusable mechanism in the domain** and every other cryo feature layers on top of it. It is a **coverage test, NOT relief**: a per-fragment scalar `frostCover ∈ [0,1]` answering *"is it cold enough here for this volatile to be solid?"*

**Construction (CPU-derived params, shader-evaluated):**
```
localT   = T_substellar driven field — for unlocked worlds: T_eq * insolationByLatitude(lat, tilt)
                                       for locked worlds: terminatorField(dot(pos, -sunDir))
                                       minus an altitude lapse term: localT -= heightField * lapseRate
coldness = (condensationT_species - localT)        // >0 means volatile freezes here
frostRaw = smoothstep(-edgeSoft, +edgeSoft, coldness + noiseBreakup)
frostCover = frostRaw * frostMaxCoverage           // global budget gate from volatileFraction
```
- `insolationByLatitude` is the classic `cos(latitude)` weighting, **biased by axial tilt (D3)** so high-obliquity worlds accumulate frost at *low* latitudes seasonally (Mars-like) and zero-tilt worlds hold sharp equatorial-symmetric caps.
- **Sharp vs diffuse edge (F23 variants)** is one uniform: `frostEdgeSoftness` (small = sharp coverage line of Mars/Earth snowline; large = diffuse tint of a hazy thin-frost rim). `noiseBreakup` = a low-amplitude `noised()` tap so the boundary is fractal, not a clean latitude circle (kills the "drawn-on band" tell).
- **(a) Render HOW:** `frostCover` drives a `mix(surfaceAlbedo, frostAlbedo, frostCover)` AND a specular/roughness shift (frost is bright + slightly specular). Critically — per the envelope research, **route the frost through the LIT value, not pure hue**: frost raises luminance hard (high albedo), so it survives posterize as a bright band even at 6 levels. The *color* of frost (blue N₂ vs pink CH₄ tholin) is the part posterize crushes — treat color as stylize, luminance as load-bearing.
- **(b) Generation path:** `D1 T_eq → P22 → frostMaxCoverage + condensationT` (CPU); `D3 axialTilt → frostLatitudeBias`; `D2 volatileFraction → frostMaxCoverage` scale; **D2 species → condensationT + frostAlbedo + frostTint** (the new selector, §3). Height field already in shader → altitude lapse free.
- **(c) Envelope:** SURVIVES (luminance-routed). Color tint = stylize/drop under posterize.
- **(d) Quality fallback:** drop `noiseBreakup` octaves to 0 and use a pure `smoothstep` latitude band; drop altitude lapse. Still reads as a polar cap.

---

### F22 — Polar caps & frost fields

**Variant: perennial water cap** (Earth/Mars north). Highest `condensationT` (273 K), so it forms on the *warmest* of the cold worlds — a stable, bright, low-noise cap. **HOW:** `frostCover` with a high `condensationT`, low `frostEdgeSoftness`, near-white `frostAlbedo`, plus *layered* banding (the polar-layered-deposit look) via a `HeteroTerrain`-style height-terrace (`floor(h*N)/N` softened riser — a height posterize that survives the color posterize fine; see relief research §3.1). **Gen path:** D1 sets whether 273 K is reached; D2 species = H₂O.

**Variant: seasonal CO₂ frost** (Mars). Low `condensationT` (~150 K at Mars pressure), thin, advances to mid-latitudes, retreats in spring. **HOW:** same mask, lower `condensationT`, and `frostMaxCoverage` modulated by a *seasonal phase* uniform (the non-deterministic weather layer — see Q4 split in §5). Tints faintly toward CO₂-frost grey-white. **Gen path:** D3 axialTilt drives seasonal amplitude; D2 species = CO₂.

**Variant: N₂/CH₄ frost field** (Triton/Pluto). Coldest worlds; nitrogen frost reads bluish-green (fresh) and methane-tholin reads pink-red (irradiated). **HOW:** `frostCover` with very low `condensationT`, plus a **two-tone tint LUT** keyed on a `frostAge` noise field (fresh N₂ = blue-green, irradiated CH₄ = pink) — *this is the one place the domain genuinely wants a color channel*, so it's an Option-B / bypass candidate per-body, not a default. Verified real coloration: Triton's south polar cap is pinkish CH₄ tholin; the equatorial band is fresh blue-green N₂ frost (NASA Triton color mosaic).
- **Envelope:** the *coverage* survives; the **blue-green vs pink distinction is the keep/stylize/drop call** — at 6 levels both crush toward "bright"; recommend KEEP as a `posterizeLevels`-raised local region OR STYLIZE to a 2-entry palette LUT (`[N₂ blue-white, CH₄ pink-white]` indexed by `frostAge`). Don't try to render the full continuous gradient under Bayer.

**Variant: eyeball nightside cap + terminator melt ring** (tidally-locked). **CRYO OWNS THE FROST-CAP SURFACE ONLY.** The cold antistellar hemisphere is one big `frostCover` region driven by `dot(pos, -sunDir)` instead of latitude; the bright "melt ring" at the terminator is where `localT` crosses `condensationT` — render as a *narrowing* of `frostEdgeSoftness` near the terminator (a sharp bright rim of fresh-deposited frost) plus an OPTICAL-owned glow. **Seam:** consume `sunDir` + a `terminatorMeltWidth` uniform; do NOT compute the circulation (P21, BANDS/STORMS) or the limb glow optics (OPTICAL).

---

### F23 — Snowline / frost-coverage boundary

This **IS** the frost-coverage mask above; F23 is the mask in isolation (no landforms, just the painted boundary). Three variants = three uniform settings:
- **sharp coverage line:** `frostEdgeSoftness` small, `noiseBreakup` mid. Earth/Mars frost edge.
- **diffuse tint:** `frostEdgeSoftness` large, low `frostAlbedo` delta. A faint cold-pole whitening.
- **latitude vs altitude band:** toggle the `lapseRate` weight — `lapseRate=0` → pure latitude band; `lapseRate>0` → frost climbs mountains at any latitude (the terrestrial snowline-on-peaks look). Both fall out of the same `localT` expression for free because the height field is already in the shader.

**Envelope:** SURVIVES (luminance). **Quality fallback:** pure latitude smoothstep, no noise, no lapse.

---

### F17 — Glacial landforms (P10 glacial flow) — *the deterministic RELIEF layer*

This is the **structural/static** half of the domain (Q4: deterministic). All of these are *relief carved/deposited by flowing ice* and layer onto `noised()` as height + normal perturbation.

- **ice sheet / glacier:** a smoothed, **slope-damped FBM** mantle (the erosion FBM `a += b*n.x/(1+dot(d,d))` from relief research §3.1) gated to `frostCover` regions and to *low-slope* areas — ice ponds in basins, flows off steeps. The slope-damping naturally gives smooth ice-filled valleys + detailed exposed rock, which is exactly the glaciated look. **HOW layering:** add `iceSheetHeight = frostCover * basinMask * smoothdampedFBM` to the height before the normal calc.
- **U-valley & fjord:** a glacier *carves* a parabolic cross-section. Approximate analytically like the crater profile (relief research): along a flow-line, cross-section height `≈ k*(d/w)²` clamped — a parabolic trough instead of a V. Flow-lines come from `-gradient(height)` (the analytic derivative you already have from `noised()`), traced as a cheap **flow proxy** (no iteration), same primitive as the stream-power erosion hack. Fjord = U-valley whose floor drops below the (frost-defined) sea/ice level.
- **moraine & esker:** *depositional lineations* — long thin ridges parallel (moraine) or transverse-to-meandering (esker) to flow. Render as **flow-aligned ridged noise**: sample `noised()` in a frame stretched along the flow direction (`p.alongFlow *= 0.2` compresses across-flow → streak ridges), then `1-abs(n)` ridge fold for crests. This is the gas-giant "vertical-stretch banded FBM" trick (weather research §3.2) repurposed with the flow field as the stretch axis. Lineations are the visual signature of glacial flow and they survive posterize well (high-contrast linear relief).
- **polar layered deposits (PLD):** the `floor(h*N)/N` height-terrace strata under the cap (shared with the F22 water-cap variant). Reads as stacked bright/dark annular bands at the pole.

- **(b) Generation path:** D2 volatileFraction → `glacialBudget` (how much ice there is to flow); D1 T_eq → must be cold enough (`frostCover` gate); D3 → polar accumulation latitude; D14 mass/gravity → flow vigor (low-g → thicker, more sluggish sheets). Flow direction is shader-derived from the analytic height gradient — **no new CPU data beyond budget + species**.
- **(c) Envelope:** SURVIVES (all relief/luminance — lineations especially). PLD terracing is itself a posterize, survives trivially.
- **(d) Quality fallback:** drop U-valley flow-tracing and moraine/esker lineations; keep the slope-damped ice mantle + cap. The mantle alone reads as "glaciated."

---

### F18 — Sublimation landscapes (P11) — *deterministic relief, but volatile-species-SWITCHED*

**This is where D2-species→morphology is the explicit, load-bearing driver-switch.** WHICH volatile sets BOTH albedo AND the landform. Make it a uniform-selected branch in the *shader's combiner choice* (which is allowed — it's a semantic-uniform switch, not a `planetType` branch):

| Species (D2) | Landform | Real body | Render primitive |
|---|---|---|---|
| **CO₂** | Swiss-cheese pits/scarps + **araneiform spiders** | Mars S-pole | round flat-floored pits (Voronoi F1 + flat-bottom profile) + radial-channel "spiders" |
| **N₂** | convection polygons + sublimation pits | Pluto Sputnik Planitia | Voronoi cellular polygons w/ trough borders + size-graded pits |
| **CH₄** | bladed terrain / **penitentes** | Pluto Tartarus Dorsa | parallel sharp blades (anisotropic ridged noise, very tall/thin) |
| **H₂O** | terrestrial sublimation hollows (mild) | Earth/Mars | shallow generic pit field |

**(a) Render HOW per variant:**

- **Swiss-cheese pits (CO₂):** Voronoi **F1** cells (relief research crater primitive) but with a *flat-floored circular* profile instead of a bowl: `pit = -depth * smoothstep(rimRadius, floorRadius, F1)` → quasi-circular depressions with steep scarps and flat floors. Scarps are actively-retreating → asymmetric (deeper on the equator-facing/sun-facing side via a `dot(slopeDir, sunDir)` bias). Pits *enlarge* toward warmer zones → scale pit radius by local insolation. Verified: Swiss-cheese is CO₂-ice pits where sublimation > deposition (Mars S-pole only).

- **Araneiform "spiders" (CO₂):** central pit + radiating dendritic channels. This is **NOT a standard noise primitive** — it's a *branching radial network*. Cheapest real-time approach: a **radial domain-warp** — convert to polar coords about each Voronoi center, apply `1-abs(fbm(angle*N + radius))` so channels appear as angular minima that branch with radius. Label this **SPECULATIVE for real-time fidelity** — true dendritic branching wants an L-system/DLA bake. Fallback: a baked spider-decal texture stamped at Voronoi centers (deterministic from cell hash). Verified mechanism: translucent CO₂ ice lets sunlight warm the substrate, basal sublimation carves radial channels vented through the ice (Planet Four / araneiform literature). **3-cycle-cap candidate** (§5).

- **Convection polygons (N₂):** Voronoi **border distance (F2−F1)** from relief research §3.1 → polygon cells separated by narrow troughs, exactly the Sputnik Planitia morphology. Cell centers slightly raised (`+relief` at cell interior, trough at border): verified — cells average ~33 km, ~100 m relief, highest at centers. Overlay **size-graded sublimation pits**: small pits near cell center, large near edges (drive pit radius by `F1/cellRadius`). Verified — pit size increases center→edge as ice transports outward at ~10–14 cm/yr; this is THE signature and it is cheap (one extra Voronoi octave at higher frequency, radius-modulated).

- **Penitentes / bladed terrain (CH₄):** tall, parallel, sharp blades. Render as **strongly anisotropic ridged noise**: stretch the sample frame hard along one axis (`p.x *= 8.0`), `ridge = 1-abs(noised())`, raised to a high power for sharpness, large amplitude. Verified scale on Pluto: ridges spaced 3–5 km, ~500 m deep — so the amplitude-to-spacing ratio is large (deep, sharp). Aligns to a **sun-azimuth** axis (penitentes point toward the noon sun) → derive blade orientation from `sunDir` projected to tangent plane.

- **(b) Generation path:** **D2 species selector (new uniform `volatileSpecies` int)** chooses the combiner; **D1 T_eq** gates which species is *solid* (CO₂ frost only below ~150 K, N₂/CH₄ only below ~40 K); **D3** sets seasonal exposure; **D5 atmosphere density** gates penitentes/araneiforms (both need a thin translucent-ice regime — flag `thinVolatileRegime` from D5). CPU derives `volatileSpecies` from `T_eq` + `volatileFraction` + composition (coldest+N₂-rich → N₂; CO₂-atmosphere cold → CO₂; CH₄ outer → CH₄).

- **(c) Envelope:** pits/polygons/blades SURVIVE (relief). Araneiform channels are FINE detail → **stylize** (will read as a dark radial smudge under posterize, not crisp channels — acceptable). Color differences between species = drop/stylize; the *morphology* is what carries identity.

- **(d) Quality fallback:** drop araneiforms entirely (highest-cost, lowest-survival); polygons → single Voronoi border, no graded pits; penitentes → fewer, lower blades; swiss-cheese → generic pit field. The species *albedo* still distinguishes them.

---

## 3. Proposed semantic-uniform registry additions

All derived CPU-side in `PlanetGenerator` from drivers already in `planetData` (`T_eq`, `composition.volatileFraction`, `axialTilt`, `tidalState`, `surfaceHistory`) **plus one new derivation** (`volatileSpecies`). Consumed generically in the shader — no `planetType` branch.

| Uniform | Type | Driver → Process | Range | Default | Notes |
|---|---|---|---|---|---|
| `volatileSpecies` | `int` | D2 + D1 → P11/P22 | 0=none,1=H₂O,2=CO₂,3=N₂,4=CH₄ | 0 | **NEW surfacing — the species selector. The morphology+albedo switch.** |
| `condensationT` | `float` (K) | D2 species → P22 | 30–273 | 273 | Per-species freeze point; CPU sets from `volatileSpecies`. |
| `frostMaxCoverage` | `float` | D2 volatileFraction → P22 | 0–1 | 0 | Global frost budget gate. |
| `frostEdgeSoftness` | `float` | D1/D3 → P22/F23 | 0.01–0.4 | 0.08 | Sharp↔diffuse snowline. |
| `frostLatitudeBias` | `float` | D3 axialTilt → P22 | 0–1 | 0 | High obliquity → low-latitude frost. |
| `frostAlbedo` | `vec3` | D2 species → P22 | — | (0.9,0.92,0.95) | Luminance is load-bearing; tint stylized. |
| `frostTintLUT` | `vec3[2]` | D2 species → P22 | — | white,white | N₂ blue-green / CH₄ pink (Option-B/bypass per-body). |
| `lapseRate` | `float` | height → F23 | 0–1 | 0.3 | Altitude snowline weight (0 = pure latitude). |
| `seasonalPhase` | `float` | D3 → P22 (weather) | 0–1 | 0 | **Non-deterministic weather layer** — frost advance/retreat. Animatable. |
| `glacialBudget` | `float` | D2 → P10 | 0–1 | 0 | Ice available to flow (F17). |
| `glacialFlowVigor` | `float` | D14 mass/g → P10 | 0–1 | 0.5 | Low-g → sluggish thick sheets. |
| `subPitDensity` | `float` | D1/D5 → P11 | 0–1 | 0 | Sublimation-pit field density. |
| `bladeAnisotropy` | `float` | D2 CH₄ + sunDir → P11 | 1–8 | 1 | Penitente blade stretch (1 = off). |
| `cryoActive` | `float` | D12 tidal + D2 → P7 | 0–1 | 0 | **Shared with RELIEF agent** — flags cryovolcanic resurfacing (cryo writes, relief reads). |
| `terminatorMeltWidth` | `float` | seam (consumed) | 0–0.2 | 0 | Eyeball melt-ring; OPTICAL/BANDS own the field, cryo consumes. |

**New CPU derivation flagged for Stage-A scaffolding:** `volatileSpecies` does not exist today (`deriveComposition` returns only a scalar `volatileFraction`). Add a species classifier in `PlanetGenerator` keyed on `T_eq` + `volatileFraction` + `carbonToOxygen`/atmosphere comp. This is the cryo domain's one genuinely-new generation-side surfacing — analogous to surfacing D13 magnetic field as first-class data.

---

## 4. Lab folder spec — `▸ Cryo / Sublimation`

lil-gui folder, collapsed by default (per Stage-A §3 lab structure). Controls map 1:1 to the registry uniforms.

```
▸ Cryo / Sublimation
  ── Frost coverage (F23 / F22) ──
  volatileSpecies        : dropdown { none, H₂O, CO₂, N₂, CH₄ }   // sets condensationT/albedo/tint presets
  frostMaxCoverage       : slider 0–1
  condensationT (K)      : slider 30–273   (auto-set by species; manual override)
  frostEdgeSoftness      : slider 0.01–0.4   // sharp ↔ diffuse snowline
  frostLatitudeBias      : slider 0–1        // axial-tilt seasonal latitude
  lapseRate              : slider 0–1        // latitude vs altitude band
  frostAlbedo            : color
  frostTint (N₂/CH₄)     : color  + 'tint strength' slider   // Option-B channel
  ── Seasonal (weather, non-deterministic) ──
  seasonalPhase          : slider 0–1  + 'animate' toggle
  ── Glacial relief (F17) ──
  glacialBudget          : slider 0–1
  glacialFlowVigor       : slider 0–1
  show U-valleys / fjords : toggle
  moraine/esker lineations: toggle  + 'lineation strength' slider
  PLD terrace levels (N) : slider 0–12
  ── Sublimation relief (F18) ──
  subPitDensity          : slider 0–1
  swiss-cheese pits      : toggle        // CO₂
  convection polygons    : toggle        // N₂ (Voronoi border + graded pits)
  araneiform spiders     : toggle        // CO₂, SPECULATIVE — may be decal-baked
  bladeAnisotropy        : slider 1–8    // CH₄ penitentes
  ── Eyeball / seam ──
  terminatorMeltWidth    : slider 0–0.2  // consumes seam uniform
  cryoActive (→ relief)  : slider 0–1    // shared seam, read-only indicator preferred
```

Two structural rules from Stage-A §3 honored: every control is a declared semantic uniform; folder mirrors the driver-bundle model (a "Pluto preset" just sets these values — it is not a code path). Preset hook lives in `▸ Presets`.

---

## 5. 3-cycle-cap risk flags + fallbacks

1. **Sharp snowline edge shimmers / stair-steps under dither.** A hard `smoothstep` coverage edge crossed by the 4×4 Bayer threshold can produce a crawling dotted boundary (the dither grid becomes visible exactly at the edge). **Mitigation:** route frost through luminance (already planned) so the edge is a *value* step the eye reads as a coastline, not a hue step; add `fwidth`-scaled `frostEdgeSoftness` so the edge is always ≥1px soft (band-limited, per relief research §3.4); switch the `▸ Envelope` dither to IGN/triangular-PDF when `posterizeLevels` is raised. **Fallback if 3 cycles fail:** accept a deliberately soft/diffuse snowline only (drop the sharp-line variant), or stylize the edge as a 1-level bright rim decal.

2. **Sublimation-pit / convection-polygon Voronoi seams on a sphere.** Voronoi in 2D tangent space pinches at the poles and seams at the UV wrap — and frost caps sit *exactly at the poles*, the worst case. **This collides with the unresolved Stage-A Q2 (sphere flow-frame) and Q3 (crater Voronoi 3D-27-cell vs tangent 9-cell).** **Mitigation:** use **3D object-space Voronoi** (27-cell, seamless — the relief research's recommended desktop path) for all cryo cellular features; it is pole-safe by construction. Reuse the exact primitive the crater work lands on — do NOT invent a parallel one. **Fallback:** if 27-cell is too costly at the cap, triplanar-blend a 2D Voronoi (relief research triplanar primitive). **3-cycle cap applies; harness-spike first.**

3. **Bladed terrain (penitentes) unreadable under posterize.** Tall thin parallel blades at 6 levels can collapse into a flat grey or an aliased zebra. **Mitigation:** blades are high-contrast *relief* (deep shadows between blades) → route as normal perturbation so self-shadowing carries them (survives as luminance); keep blade spacing ≥ a few pixels at LOD2 distance via fwidth octave clamp; align to sun azimuth so shadowing is maximal. **Fallback:** reduce to a corrugated bump (lower anisotropy) that reads as "ridged ice" rather than true penitentes — still a distinct cold-world texture.

4. **(secondary) Araneiform spiders** — flagged SPECULATIVE in §2. Real-time dendritic branching is unproven under these constraints. **Fallback baked in from the start:** baked spider-decal stamped at deterministic Voronoi centers. Don't death-spiral on procedural branching.

---

## 6. Open questions for Max (taste / scope)

1. **N₂/CH₄ frost color (blue-green vs pink) — keep, stylize, or drop?** This is the one place the domain wants a true color channel; it's an Option-B / per-effect-bypass call. My read: STYLIZE to a 2-entry tint LUT (cheap, reads as "two kinds of frost") rather than the full continuous gradient. Your call on whether Pluto/Triton's signature coloration is worth a `posterizeLevels` bump on those bodies.
2. **Araneiform spiders — build procedurally, bake a decal, or drop?** Lowest survival + highest risk feature in the domain. Recommend decal-bake or drop for v1; revisit if Mars-S-pole bodies feel empty.
3. **Seasonal frost advance/retreat (`seasonalPhase`) — animate it, or freeze at a representative phase?** Q4 split says it's the non-deterministic weather layer (allowed to differ across visits). Animating it adds life but also a "weather loading" cold-start question. Default: freeze at a mid-phase; expose the animate toggle in the lab for you to judge.
4. **How hard is the species→morphology coupling?** Should a CO₂ world *only ever* show swiss-cheese/araneiforms, or can a cold body show a mix (e.g. N₂ polygons + CH₄ blades on different latitudes, as Pluto actually does)? Affects whether `volatileSpecies` is one int or a per-region field.
5. **Glacial relief scope for v1** — full F17 set (U-valleys, fjords, moraines, eskers, PLD) or just the slope-damped ice mantle + caps? The mantle alone is cheap and reads as glaciated; the flow-traced landforms are where the cost/risk is.

---

## 7. Sources

All URLs from live web search 2026-06-06; planetary-science claims verified against the cited bodies. Shader-technique claims reuse the Stage-A foundational research vocabulary (Voronoi F1/border, slope-damped FBM, anisotropic ridged noise, domain warp) — those primitives are cited in `RESEARCH_high-lod-planet-shaders-2026-06-05.md` §3 and not re-listed here.

**Pluto — Sputnik Planitia convection / sublimation pits (N₂):**
- [Nature — Sublimation-driven convection in Sputnik Planitia on Pluto (2021)](https://www.nature.com/articles/s41586-021-04095-w) *(abstract via search; full text paywalled — key numbers verified from snippet: ~33 km cells, ~100 m relief, centers highest)*
- [ScienceDirect — Sublimation pit distribution indicates convection cell velocities ~10 cm/yr](https://www.sciencedirect.com/science/article/abs/pii/S0019103516308004) *(pit size center→edge, ~13.8 cm/yr, surface age ~180 kyr)*
- [Wikipedia — Sputnik Planitia](https://en.wikipedia.org/wiki/Sputnik_Planitia) *(polygon size, troughs, pit grading)*
- [phys.org — Cracking the mystery of nitrogen ice dynamics on Pluto](https://phys.org/news/2021-12-mystery-nitrogen-ice-dynamics-pluto.html)

**Pluto — bladed terrain / penitentes (CH₄), Tartarus Dorsa:**
- [Nature — Penitentes as the origin of the bladed terrain of Tartarus Dorsa (Moores et al. 2017)](https://www.nature.com/articles/nature20779) *(3–5 km spacing, ~500 m depth, methane ice)*
- [arXiv preprint 1707.06670](https://arxiv.org/abs/1707.06670)
- [Sci-News — New Horizons spots penitentes in Tartarus Dorsa](https://www.sci.news/space/new-horizons-penitentes-plutos-tartarus-dorsa-04513.html)

**Mars — Swiss-cheese terrain + araneiform spiders (CO₂):**
- [arXiv 1708.07858 — Planet Four: Terrains, araneiforms outside the SPLD](https://arxiv.org/abs/1708.07858) *(formation: translucent CO₂ ice, basal sublimation carves radial channels)*
- [ScienceDirect — Araneiform terrain formation in Angustus Labyrinthus](https://www.sciencedirect.com/science/article/abs/pii/S0019103517303421)
- [The Planetary Society — Help map Mars' south polar region](https://www.planetary.org/articles/0724-help-map-mars-south-polar-region) *(swiss-cheese = CO₂ pits where sublimation > deposition)*

**Triton — N₂/CH₄ frost albedo + color + cantaloupe/cryovolcanism:**
- [NASA Science — Global Color Mosaic of Triton](https://science.nasa.gov/resource/global-color-mosaic-of-triton/) *(pink CH₄ tholin S-cap, blue-green fresh N₂ equatorial band)*
- [USGS — Triton Voyager 2 Global Color Mosaic 600m](https://astrogeology.usgs.gov/search/map/triton_voyager_2_global_color_mosaic_600m)
- [arXiv 2511.18776 — Icy worlds: Moons and Dwarf Planets](https://arxiv.org/pdf/2511.18776)

**Procedural frost / snow-coverage masking technique (corroborating the latitude+altitude+threshold mask):**
- [GitHub avcourt/terrain — procedural terrain shader, 2D noise GLSL](https://github.com/avcourt/terrain)
- [arXiv 2506.23364 — Data-Driven Compute Overlays for Interactive Geographic Simulation](https://arxiv.org/pdf/2506.23364) *(snow-line altitude / steepness / blend-factor as overlay params)*

**Code grounding (verified in-repo 2026-06-06, not re-discovered):**
- `src/generation/PhysicsEngine.js:121` `equilibriumTemperature` (D1); `:341-384` `deriveComposition` → returns scalar `volatileFraction` only (no species → the gap §3 fills).
- `src/generation/PlanetGenerator.js:679-707` `generate()` return (drivers surfaced: `T_eq`, `composition`, `axialTilt`, `tidalState`, `surfaceHistory`); `:507-512` existing object-space polar ice-cap precedent (terrestrial); Moon.js `:355-388` PARTIAL LOD2 ice/sulfur-frost branch (cold-body prior art).
- `src/objects/Planet.js:1051,1061-1066` aurora/atmosphere semantic-uniform precedent (the pattern §3 generalizes).
```
