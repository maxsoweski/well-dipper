# Stage-B Research — RELIEF (surface relief & topology, close-up / LOD2)

**Domain:** F-relief (F1–F10), the widest current coverage gap (the dead-`lodLevel` LOD2 story; Appendix-B's entire F-relief row is `○`/`◐` across every rocky type).
**Date:** 2026-06-06 · **Project:** `~/projects/well-dipper` (three.js r183.1 / WebGL2, desktop-primary, retro dithered/posterized envelope).
**Plugs into:** Stage-A foundation — analytic-derivative `noised()` → `vec4(value, gradient.xyz)`, `fbmd()` variable-octave FBM with chain-rule gradient accumulation, `perturbAnalytic()` tangent-plane normal perturbation, composite-split envelope `posterize(surface) + emissive + spec + limb`, driver→semantic-uniform scaffolding (`deriveUniforms` in `planet-lod-lab-core.js`), `qualityTier` scalar, `lil-gui` folders.
**Reuses vocabulary from:** `research/RESEARCH_high-lod-planet-shaders-2026-06-05.md` (analytic-derivative noise, ridged multifractal, domain warp, Voronoi craters, slope-damped FBM, emissive bypass).

> **Frame discipline:** No parity-with-old. No `planetType` branch — everything derives from physics drivers via semantic uniforms. Single shader behind `qualityTier` + `lodRamp`. Every feature must survive (or deliberately bypass) the 6→16-level posterize/Bayer-IGN quantizer. This is a render-HOW + generation-PATH spec; Stage C implements directly from it.

---

## 1. Scope

**Features (L2):** F1 mountains/ranges · F2 craters · F3 ejecta & rays · F4 canyons/rifts · F5 scarps & fault systems · F6 plateaus/highlands/tessera · F7 volcanic edifices · F8 lava plains & flows · F9 chaos/disrupted terrain · F10 ridged/grooved icy terrain.

**Processes (L1):** P1 impact cratering · P2 tectonic deformation · P3 orogeny · P4 effusive volcanism · P5 explosive volcanism · P6 tidal-heat resurfacing · P12 mass-wasting.

**Drivers (L0):** D11 surface-history (`surfaceHistory.{bombardmentIntensity,erosionLevel,resurfacingRate}`) · D14 mass/gravity (`massEarth` → surface g) · D12 tidal heating (via `tidalState` + resurfacing) · D2 volatile (`composition.volatileFraction`) · D16 age (folded into `surfaceHistory`).

**Cross-domain seams — DEFERRED to sibling agents (do NOT build here):**

- **F43 crystalline / F44 hex-tessellation / F45 shattered (P15)** → EXOTIC/OVERLAY agent. These are geometric endmembers, not geomorphology. *Seam:* if the exotic agent wants a "shattered relief" that reuses my Voronoi-border crack primitive (§2.F5), it can — but the P15 fracture-pattern *generation* (cooling-contraction tessellation, catastrophic-disruption block fields) is theirs.
- **Cryovolcanism P7** (the volatile/resurfacing *generation* path for icy chaos/ridged terrain) → CRYO agent. **I own the relief/geomorphology *rendering* of F9 chaos and F10 ridged-icy terrain** (how the rafts/double-ridges/grooves are built on `noised()`). The cryo agent owns *what volatile budget + tidal-heat resurfacing produces them* (D2/D12 → P7 generation). *Seam:* F9/F10 consume a `resurfacingAge`/`iceShellActivity` uniform that the cryo agent's generation path may also feed — coordinate the uniform name (§3 flags `uIceShellActivity` as shared-candidate).
- **Fluvial canyons (P8 fluvial-incised gorge variant of F4)** → FLUVIAL agent owns the incision *process*; I own the tectonic graben/chasma variant of F4. *Seam:* both write into a shared canyon-relief term; flagged in F4 below.
- **Aeolian/dust mantling that softens relief** → AEOLIAN agent. I expose `erosionLevel` as the relief-softening input; aeolian-specific dune overlay is theirs.

---

## 2. Per-feature research

All features layer onto the foundation's `fbmd()` output. The universal pattern:

```
vec4 base = fbmd(vPos, uOctaves, fwBase);   // height + analytic gradient (continents)
// each feature ADDS a height delta + its gradient delta, accumulated:
float h = base.x;  vec3 grad = base.yzw;
h += featureHeight;  grad += featureGrad;   // chain-rule-correct deltas
shadeN = perturbAnalytic(N, grad, reliefAmp);  // ONE tangent-plane perturb at the end
```

The discipline (from foundational §3.4): **route relief through the normal/gradient, never through new albedo.** The Bayer threshold is added to luminance before `floor()`, so normal-perturbed lighting survives as dither texture; a feature that only tints albedo gets crushed. Every F# below is gradient-driven for exactly this reason.

**Critical correctness rule for every folded octave (ridged/billow):** the analytic gradient must be sign-corrected when an `abs()`/fold is applied, or the normals point the wrong way on inverted faces. Per Decarpentier (Scape): for **billow** use `n = vec4(abs(n.x), sign(n.x)*n.yzw)`; for **ridged** use `n = vec4(1.0-abs(n.x), -sign(n.x)*n.yzw)` (note the gradient sign flips, and for ridged it is the *negative* because of the `1.0 - abs()`). Skipping this is the single most likely silent bug in this whole domain (flagged §5).

---

### F1 — Mountains / ranges

Variants: **tectonic fold belt** (P3) · **volcanic shield/strato crestline** (P4, cross-ref F7) · **ridged crestlines** (P2).

**(a) Render HOW.**
- **Core technique: ridged multifractal (Musgrave), derivative-correct.** Replace the per-octave `noised()` accumulation in a *dedicated* `fbmdRidged()` with the fold `signal = uRidgeOffset - abs(n.x)`; `signal *= signal` (sharpen); weight the next octave by `weight = clamp(signal * uRidgeGain, 0.0, 1.0)` so ridges only grow where the previous octave was already high → connected crestlines, not isotropic spikes. Params from the literature: `H=1, offset≈1, gain≈2, lacunarity≈2`. The gradient accumulates with the **ridged sign correction above** and the multifractal weight (`grad += amp * weight * freq * (-sign(n.x)) * n.yzw`).
- **Fold-belt anisotropy (tectonic, P3):** before sampling, apply a **directional domain stretch** `pos.xz *= mat2(...)` compressing one axis (e.g. `pos.x *= 3.0`) so ridges elongate into parallel belts (the "Himalaya" linear-range look) rather than a radial massif. The stretch axis is a per-planet semantic uniform (`uOrogenyAxis`, vec2) so belts have a coherent strike direction. This is the relief analogue of the gas-giant `p.y *= 2.5` band-stretch in the foundational §3.2.
- **Shield/strato (P4) variant:** a single large-amplitude `smoothstep`-profiled radial bump (a low-frequency Gaussian-ish cone) placed at a Voronoi/hash center, summed onto the ridged base. Strato = steeper profile (higher exponent), shield = broad shallow. Cross-references F7 (same primitive; F7 owns the edifice catalogue, F1 owns "this range *is* a chain of them").
- **Slope-damped erosion on top (free realism):** wrap the whole mountain FBM in IQ's `iqTurbulence` damping — `sum += amp * n.x / (1.0 + dot(dsum, dsum)); dsum += amp * freq * n.yz` — so steep ridge faces stop accumulating high-freq detail (smooth faces) while flats stay detailed. One line; biggest realism-per-instruction.
- **LOD-ramp behavior:** mountain octave depth scales with `uOctaves = mix(4,9,lodRamp)`; ridge *amplitude* also ramps (`reliefAmp` already does this in `perturbAnalytic`). Far away → a few smooth ridges; close → sharp crestlines with eroded faces. The fwidth clamp must stay on or ridged crestlines shimmer violently under dither (§5).

**(b) Generation path.**
- **Drivers:** P3 orogeny is **terrestrial/ocean-exclusive** (Earth-only plate tectonics in the solar system, per inventory P3) — gate it on `habitability` (water lubricates subduction, D15) AND a tectonic-activity proxy. P2/P4 ridged mountains are general rocky.
- **CPU derivation (extend `deriveUniforms`):**
  - `mountainAmplitude` ← grows with tectonic/volcanic activity, *shrinks* with `surfaceHistory.erosionLevel` (old eroded worlds = rounded low ranges). `reliefAmplitude = mix(1.0, 0.6, erosion)` already exists — extend with an orogeny term.
  - `orogenyStrength` ← `habitability` (subduction proxy) × age-window (young enough that ranges haven't fully eroded). High → strong anisotropic fold belts; low → isotropic ridged hills only.
  - `uOrogenyAxis` ← derived from seed (a stable per-planet strike direction).
- **Semantic uniforms:** `uMountainAmp` (float), `uRidgeOffset` (float ~1.0), `uRidgeGain` (float ~2.0), `uOrogenyStrength` (float 0..1, blends isotropic-ridged ↔ anisotropic-belt), `uOrogenyAxis` (vec2). No NEW driver surfacing needed — all derive from existing `surfaceHistory` + `habitability` + seed.
- Shader consumes generically: `mix(isotropicRidged, anisotropicBelt, uOrogenyStrength)` — no type branch.

**(c) Envelope interaction.** **Survives** — pure relief through the normal. *Keep.* The ridged crestlines are exactly the high-contrast luminance detail the posterizer renders well. Risk is shimmer not crushing (fwidth clamp handles it).

**(d) Quality-scalar fallback.** Rich: 9 octaves ridged + slope-damping + anisotropic belt. Cheap (`qualityTier<0.5`): drop to `maxOctaves≈4–5`, skip slope-damping (it's an extra gradient accumulation per octave), keep the anisotropic stretch (cheap). Reachable behind `uOctaves`/`uQualityTier` — no separate path.

---

### F2 — Craters

Variants: **simple bowl** · **complex (central peak + terraces)** · **peak-ring** · **multi-ring basin** · **palimpsest (relaxed)**. Currently `[partial]` — only impact-basin height exists.

**(a) Render HOW.**
- **Placement: 3D Voronoi (cellular) over object-space position.** Per spec Q3: **27-cell (3×3×3) seamless on desktop**, **9-cell tangent-space cheap fallback on mobile**. 3D-domain Voronoi sampled on `vPos` is inherently seamless on the sphere (no UV seam, no pole pinch) — this is *the* reason to pay for 27 cells. Jitter each integer-cell center by a hash; the nearest center is the crater this fragment belongs to.
- **Analytic radial profile (the crater shape), built on `r = dist(fragment, center)/craterRadius`:**
  - **Cavity:** parabolic bowl `(r*r - 1.0)` for `r < 1` → depth ≈ D/5 (real morphology, depth-to-diameter ~0.2 for simple).
  - **Rim:** `smoothstep` peak at `r ≈ 1`, raised ~5% above datum, decaying outward.
  - **Floor flattening for complex craters:** clamp the cavity floor flat (complex craters have low depth/diameter and flat floors).
  - **Central peak (complex):** an inner `smoothstep` bump at `r ≈ 0`, amplitude scaled by crater size above the simple→complex threshold.
  - **Terraces (complex):** `cos(2π · r · uTerraceCount)` modulating the inner wall → slumped terrace rings.
  - **Peak ring (large complex):** a raised annulus at `r ≈ 0.5` (massifs roughly half the rim-to-rim diameter, per Mercury/Moon LOLA observations) *replacing* the central peak above the peak-ring onset diameter.
  - **Multi-ring (basin):** several concentric `smoothstep` ridges at `r ≈ 0.5, 0.75, …`.
  - **Palimpsest (relaxed):** for icy/old surfaces, multiply the whole profile amplitude by `(1 - relaxation)` so the crater is a faint ghost (viscous relaxation flattens icy craters).
- **Morphology SELECTION (the physics, no type branch):** the simple→complex (→peak-ring→multi-ring) transition is **gravity-gated**: transition diameter scales as **g⁻¹** (Moon ~20 km, Mars ~6–11 km, Mercury ~11 km; **the constant differs for icy vs rocky bodies** — confirmed in the literature). So each crater's morphology is chosen by comparing its (hash-assigned) diameter to a per-planet `uCraterComplexD = k / surfaceGravity`, with `k` switched by `volatileFraction` (icy worlds transition at smaller diameters). A continuous `morphology = smoothstep(simpleD, complexD, craterD)` blends bowl→complex→peak-ring with NO branch.
- **Gradient:** the analytic profile is differentiable; accumulate its derivative into `grad` exactly like FBM octaves, so crater rims/peaks light correctly. (This is the harder part — see §5: central-peak morphology under posterize.)
- **Compositing:** blend additively into the height field, `exp(-k·r)`-weighted so distant cells don't bleed. Multiple overlapping craters = additive (a saturated old surface naturally produces overlapping bowls).

**(b) Generation path.**
- **Drivers:** **D11 surface-history → crater DENSITY = surface age.** `surfaceHistory.bombardmentIntensity` is the master density driver; `erosionLevel` and `resurfacingRate` *subtract* (eroded/resurfaced worlds lose craters — Io-grade tidal resurfacing → zero-age crater-free surface, P6). **D14 gravity → morphology transition diameter.** **D2 volatile → icy-vs-rocky transition constant + relaxation/palimpsest.**
- **CPU derivation (extend `deriveUniforms`):**
  - `craterDensity` ← `surfaceHistory.bombardmentIntensity * (1 - resurfacingRate)` (already partly in the engine — `bombardmentIntensity` is computed net of resurfacing at `computeSurfaceHistory:758`). Drives the Voronoi cell-fill probability (fraction of cells that actually host a crater).
  - `craterComplexD` ← `k_morph / surfaceGravity`, `surfaceGravity` from `massEarth`/`radiusEarth` (D14). NEW: surface gravity is not currently surfaced as a uniform — derive it CPU-side (`g ∝ massEarth / radiusEarth²`). **Flag: needs new surfacing** (cheap — both fields exist in `planetData`).
  - `craterRelaxation` ← `volatileFraction` × warmth (icy + warm → relaxed palimpsests). Uses D2 + T_eq.
  - `craterMorphConstant` ← switch by `volatileFraction` (icy `k` vs rocky `k`).
- **Semantic uniforms:** `uCraterDensity` (float 0..1), `uCraterComplexD` (float, the g⁻¹ transition diameter in crater-radius units), `uCraterRelaxation` (float 0..1), `uCraterCells` (int 27|9, from `qualityTier`), `uTerraceCount` (float). **`surfaceGravity` (float) is the one new field to surface** (D14→P1).
- Generic consumption: morphology blended by `smoothstep(simpleD, uCraterComplexD, hashDiameter)` — fully driver-derived.

**(c) Envelope interaction.** **Survives for bowls/rims** (high-contrast relief). **At-risk for central-peak + terraces under 6-level posterize** — fine terrace steps quantize to nothing. *Keep bowl+rim; stylize central-peak/terraces* (push amplitude up so the peak occupies a full luminance band, and let terraces read as 2–3 hard steps rather than smooth slumps — the posterizer turning terraces into discrete rings is actually on-aesthetic). *Drop* sub-rim micro-ejecta texture (→ F3 handles ejecta as its own term). Bright ray systems are F3.

**(d) Quality-scalar fallback.** Rich: 27-cell 3D Voronoi, full morphology ladder, relaxation. Cheap: **9-cell tangent-space** (needs a seamless tangent frame — the Q3/Q2 risk), simple-bowl-only (skip central-peak/terrace/peak-ring branches via `uCraterComplexD = ∞`), no relaxation. Both behind `uCraterCells` + `uQualityTier`.

---

### F3 — Ejecta & rays

Variants: **continuous blanket** · **discontinuous** · **rampart (fluidized, icy/wet)** · **bright ray system (airless only)** · **secondary crater fields**.

**(a) Render HOW.**
- **Ejecta blanket (relief):** a `~1/r²`-decaying additive height skirt around each crater (radius `1 < r < ~2.5`), modulated by FBM so it's lumpy not smooth. Continuous near the rim, breaking into **discontinuous** patches further out via a `smoothstep(threshold, 1, fbm)` mask. Reuses the crater Voronoi centers from F2 — no new placement.
- **Rampart ejecta (fluidized, icy/wet — D2):** instead of a smooth `1/r²` skirt, a **lobate terminal scarp** — the ejecta ends in a raised rounded ridge (the fluidized flow froze at its margin). Render as a `smoothstep` ridge at the ejecta's outer radius. Gated on `volatileFraction` (ground ice fluidizes ejecta — Mars ramparts).
- **Bright ray system (airless only — albedo, the exception):** rays are *not* relief — they're high-albedo streaks of fresh material radiating from young craters. This is the **one F-relief feature that legitimately uses albedo**, because rays have no topographic expression. Render as radial streaks: `ray = pow(max(dot(normalize(fragDir), rayDir), 0), k)` summed over N hashed azimuths, masked to young craters only. **This needs an emissive/bypass-ish treatment to survive posterize** (a faint albedo brightening gets crushed) — route it as a small additive *brightening of the surface luminance before posterize* with enough amplitude to cross a band, OR accept it reads as 1–2 dither-stippled bright bands (on-aesthetic).
- **Secondary crater fields:** small clustered craters downrange of big ones — reuse F2's profile at reduced radius, placed by a secondary Voronoi seeded off the primary's center.

**(b) Generation path.**
- **Drivers:** D11 (rays only on *young* craters — `1 - erosionLevel` high; rays fade fast), D2 (rampart vs dry blanket), D6/atmosphere (rays are **airless-only** — an atmosphere weathers them away; gate on `atmosphere == null`).
- **CPU derivation:** `ejectaRampart` ← `volatileFraction > threshold`; `rayBrightness` ← `(1 - erosionLevel) * (hasAtmosphere ? 0 : 1)`; `ejectaStrength` ← tied to `craterDensity` (more craters → more ejecta).
- **Semantic uniforms:** `uEjectaStrength` (float), `uRampart` (float 0..1), `uRayBrightness` (float, airless-gated). No new driver surfacing (all from existing fields).

**(c) Envelope interaction.** Ejecta relief **survives** (relief). Bright rays are albedo → **at-risk**; *stylize* as hard bright bands (lean into the posterizer rather than fight it). Rampart scarp **survives** (relief). *Keep* ejecta + rampart, *stylize* rays, *drop* faint secondary-field micro-relief at low `qualityTier`.

**(d) Quality-scalar fallback.** Rich: lumpy FBM-modulated blanket + rampart + rays + secondaries. Cheap: smooth `1/r²` skirt only, no secondaries, rays off.

---

### F4 — Canyons / rifts

Variants: **tectonic graben/chasma** (P2 — **I own this**) · **fluvial-incised gorge** (P8 — FLUVIAL agent owns) · **cryo-chasma** (P7 — CRYO agent owns generation; I own relief).

**(a) Render HOW (tectonic graben — my variant).**
- **Inverted Voronoi-border ridge → trench.** IQ's two-pass Voronoi *edge distance* (pass 1 nearest center, pass 2 over the 3×3(×3) neighborhood: `d = dot(0.5*(mr+r), normalize(r-mr))` min → perpendicular distance to the cell border). A `ridge = 1 - smoothstep(0, w, d)` along borders gives fault lines; **inverting it (`-ridge` into height)** carves a **graben** (down-dropped block between two faults) — a flat-floored steep-walled trench. This is the canonical Valles-Marineris-style chasma.
- **Linear chasma (not networked):** a single dominant rift wants a *directional* carve, not an isotropic Voronoi web. Use a **1D distance-to-line** field: `canyonDepth = uChasmaDepth * (1 - smoothstep(0, halfWidth, abs(dot(pos - canyonCenter, canyonNormal))))`, with the line direction a per-planet seed uniform. Combine 1–3 such lines for a rift system. Flat floor = clamp the profile.
- **Gradient:** the `smoothstep` walls are differentiable → steep canyon walls light correctly; accumulate into `grad`.
- **Layered strata in walls (bonus):** apply height-terracing `floor(h*N)/N` *inside the canyon walls only* → exposed sedimentary/lava layers (a height-posterize, survives the color-posterize fine).

**(b) Generation path.**
- **Drivers:** D11/D12 (tectonic activity — `surfaceHistory` + tidal stress), D14 (gravity sets how deep walls can stand before mass-wasting collapses them — cross-ref F-mass-wasting).
- **CPU derivation:** `chasmaStrength` ← tectonic-activity proxy (tidal heating + age-window); `chasmaCount` ← seed; `chasmaAxis` ← seed.
- **Semantic uniforms:** `uChasmaDepth` (float), `uChasmaCount` (int 0..3), `uChasmaAxis[3]` (vec2 array), `uChasmaWidth` (float). **Seam uniform:** the FLUVIAL agent's incised-gorge and CRYO's cryo-chasma should *add into the same `canyonHeight` accumulator* — I define the accumulator + the tectonic contribution; they add their process-specific contributions. Flag for orchestrator: **shared `canyonHeight` term**.

**(c) Envelope interaction.** **Survives** — deep trenches are maximal-contrast relief. Wall strata via height-terrace **survives** (it's relief banding, orthogonal to color posterize). *Keep.*

**(d) Quality-scalar fallback.** Rich: Voronoi-border graben web + directional chasma + wall strata. Cheap: directional chasma lines only (1–2), no Voronoi web (the edge-distance second pass is the expensive part), no wall strata.

---

### F5 — Scarps & fault systems

Variants: **normal-fault cliff** · **lobate contraction scarp** · **wrinkle ridge** · **horst-and-graben province**.

**(a) Render HOW.**
- **Wrinkle ridge / scarp via directional warp + sharp step.** A scarp is a **one-sided cliff** — a step in elevation along a curved line. Build from a **directionally-warped Voronoi border** or a warped FBM iso-contour: take a smooth field `s = fbm(pos)` (or Voronoi edge distance), and a scarp is `scarpHeight * smoothstep(level - w, level + w, s)` — a soft step at iso-level `level`. The **directional warp** (`pos += uScarpWarp * fbm(pos*2)` along a preferred axis) makes the scarp line sinuous and gives the lobate (rounded, thrust-front) shape of contraction scarps (Mercury's Discovery Rupes).
- **Wrinkle ridge:** a *narrow asymmetric* ridge (broad gentle rise + steep front) on lava-plain surfaces — a `smoothstep`-up + sharp `smoothstep`-down at the front, placed along warped lines. Cross-refs F8 (wrinkle ridges live on lava plains).
- **Horst-and-graben province:** alternating up/down blocks — a thresholded periodic-in-warped-space pattern (`sign(sin(dot(pos, axis)*freq + warp))` smoothed) raising/lowering alternating strips.
- **Gradient:** the `smoothstep` step has a clean analytic derivative → the cliff face shades as a hard lit/shadowed edge (exactly what reads under posterize).

**(b) Generation path.**
- **Drivers:** D11/D16 (lobate contraction scarps form from **global cooling/contraction** as a planet ages — `surfaceHistory` + age), D2 (ice-shell extension produces different fault style), D12 (tidal stress orientation).
- **CPU derivation:** `scarpStrength` ← cooling/contraction proxy (older + smaller bodies contract more → more scarps); `scarpStyle` ← `volatileFraction` (rock contraction-thrust vs ice extension-normal); `uScarpWarp`, `uScarpAxis` ← seed.
- **Semantic uniforms:** `uScarpStrength` (float), `uScarpStyle` (float 0..1, thrust↔normal), `uScarpWarp` (float), `uScarpAxis` (vec2), `uScarpDensity` (float).

**(c) Envelope interaction.** **Survives** — a scarp *is* a hard lit/shadow edge, the posterizer's favorite. *Keep.* (Wrinkle ridges are subtle; at low amplitude they may read as `[subtle]` — push amplitude or accept they vanish on far LOD.)

**(d) Quality-scalar fallback.** Rich: warped lobate scarps + wrinkle ridges + horst-graben. Cheap: simple iso-level scarp steps, no warp (straight-ish lines), no wrinkle ridges.

---

### F6 — Plateaus / highlands / tessera

Variants: **uplift plateau** · **crustal-plateau tessera** (crosscutting lattice — P15, but the *relief expression* is mine; the geometric P15 *pattern* is exotic agent's).

**(a) Render HOW.**
- **Plateau:** **height-stratification / HeteroTerrain** — `increment *= currentValue` before each FBM octave so high areas get rougher and low areas stay smooth → broad flat-topped highlands with rough margins (the Musgrave HeteroTerrain trick). Plus **height-terracing** `floor(h*N)/N` with a softened riser → mesa/plateau steps (a height-posterize, survives color-posterize).
- **Tessera (Venus Ovda Regio):** crosscutting ridge-and-groove lattice — **two superimposed directional Voronoi-border (or warped-stripe) fields at different orientations**, both carved as ridges, intersecting → the chaotic crosscutting lattice. The relief is mine (intersecting ridge grooves); if the EXOTIC agent's hex/shatter pattern generator produces a cleaner lattice, that's their P15 path — *seam noted*.

**(b) Generation path.**
- **Drivers:** D11/D12 (crustal thickening/tessera form from tectonic+thermal stress), D14.
- **CPU derivation:** `plateauStrength` ← tectonic-activity + age; `tesseraStrength` ← high-stress-history proxy.
- **Semantic uniforms:** `uPlateauStrength` (float), `uTesseraStrength` (float), `uTesseraAxes` (2× vec2 for the two lattice orientations).

**(c) Envelope interaction.** Plateau flat-tops + mesa steps **survive** (relief banding). Tessera lattice **survives** (high-contrast ridge grooves). *Keep.*

**(d) Quality-scalar fallback.** Rich: HeteroTerrain + terracing + dual-axis tessera. Cheap: single-axis ridges, no HeteroTerrain weighting (plain FBM plateau).

---

### F7 — Volcanic edifices

Variants: **shield** · **stratovolcano** · **caldera** · **pancake dome (thick-air)** · **corona/nova/arachnoid (plume)**.

**(a) Render HOW.**
- **Shield/strato (shared with F1's volcanic variant):** radial profile cone at hashed centers. **Shield** = broad shallow (`pow(1-r, 1.5)`), **strato** = steep (`pow(1-r, 4)`). Summit **caldera** = subtract an inner bowl at `r≈0` (an inverted small crater profile — reuses F2 primitive).
- **Pancake dome (Venus, thick-air D5):** flat-topped steep-sided circular dome — `smoothstep` plateau profile with near-vertical sides; pressure-gated (only on thick-atmosphere worlds). Reuses the plateau-step primitive at small radius.
- **Corona/nova/arachnoid (plume uplift, Venus):** concentric + radial fracture pattern around an uplift — a radial Voronoi-border/groove pattern (radial cracks) plus concentric `smoothstep` ridges. The relief is a domed uplift ringed and radially fractured. Reuses F5 scarp grooves in a radial arrangement.
- **Gradient:** all radial profiles are differentiable.

**(b) Generation path.**
- **Drivers:** **D12 tidal heating + D11 resurfacing → volcanic activity** (drives edifice density/size); **D14 low gravity → giant shields** (Olympus Mons is huge because Mars is low-g — edifice max height ∝ 1/g); **D5 atmosphere density → pancake domes** (pressure-gated). D2 for corona/cryo overlap (note seam to CRYO for icy plume features).
- **CPU derivation:** `volcanismStrength` ← `tidalHeating` + young-age resurfacing; `edificeMaxHeight` ← inversely with surface gravity (low-g → tall); `pancakeDomes` ← `atmosphereDensity > threshold`; `coronaStrength` ← plume/tidal proxy.
- **Semantic uniforms:** `uVolcanismStrength` (float), `uEdificeMaxHeight` (float, g⁻¹-scaled), `uShieldStratoMix` (float 0..1, viscosity proxy — effusive shield vs explosive strato), `uPancakeStrength` (float, pressure-gated), `uCoronaStrength` (float). **Reuses `surfaceGravity`** (the new field from F2).

**(c) Envelope interaction.** Edifice relief **survives** (big radial cones = strong relief). Caldera **survives**. Corona radial fractures **survive** (groove relief). *Keep.* Emissive summit/lava (if active) routes through the **emissive bypass** channel (cross-ref F8). 

**(d) Quality-scalar fallback.** Rich: full edifice catalogue + corona fracture pattern. Cheap: shield/strato cones + caldera only; drop corona/arachnoid radial-fracture (expensive Voronoi).

---

### F8 — Lava plains & flows

Variants: **flood-basalt plain** · **leveed channel** · **sinuous rille** · **collapsed tube/pit chain**. Currently `[partial]` (lava cracks only).

**(a) Render HOW.**
- **Flood-basalt plain (relief):** a *smoothed, low-relief* surface — flood basalt fills and flattens older terrain. Render as a **resurfacing mask** that *suppresses* the underlying relief (crater/mountain amplitude × `(1 - lavaCoverage)`) inside flow regions, leaving a smooth plain. The plain itself has gentle flow-lobe FBM + wrinkle ridges (cross-ref F5).
- **Leveed channel / sinuous rille:** a **directional carved channel** (reuse F4's distance-to-line) but *raised levees* on the banks (a thin ridge either side) + a flat channel floor. Sinuous rille = a meandering line (warp the line direction with low-freq FBM). Collapsed tube = a *chain of pits* along the line (periodic inverted bumps).
- **Emissive cracks (D12 active lava — the headline, from foundational §3.3):** **Worley F2−F1 crack mask** `crackMask = 1 - smoothstep(0, w, F2-F1)`; `emiss = crackMask * (0.5 + 0.5*sin(uTime*rate + fbm*TAU)) * lavaColor`. **Routed through the emissive bypass channel** (`uEmissiveBypass`) so the glow stays crisp over the posterized rock rather than banding. This is the existing `uEmissive` term in the lab composite — F8 drives it spatially via the crack mask instead of a flat value.

**(b) Generation path.**
- **Drivers:** **D12 tidal heating → active lava** (emissive cracks, glowing) vs **D11 old lava plains** (cold, just smoothed relief). D14 (low-g → larger flow extents).
- **CPU derivation:** `lavaCoverage` ← `surfaceHistory.resurfacingRate` (volcanic resurfacing fraction); `lavaActivity` ← `tidalHeating` (cold-vs-glowing — drives `uEmissive` amplitude); `channelDensity` ← seed × activity.
- **Semantic uniforms:** `uLavaCoverage` (float 0..1, suppresses base relief), `uLavaActivity` (float 0..1, glow intensity → feeds `uEmissive`), `uChannelDensity` (float), `uCrackScale` (float). The `tidalHeating` driver (D12) **needs surfacing** for non-moon planets — currently `tidalHeating()` exists in PhysicsEngine but is moon-centric (`tidalHeating(e, M_parent, R_moon, a)`); confirm a planet-level tidal-heat value reaches `planetData`. **Flag: D12 surfacing for planets.**

**(c) Envelope interaction.** Plain relief-suppression **survives** (it's the *absence* of relief). Channels/levees **survive** (relief). **Emissive cracks bypass posterize** — the canonical Option-C bypass channel; *keep + bypass.* This is the single best posterization-survivor in the domain (emissive + high contrast).

**(d) Quality-scalar fallback.** Rich: resurfacing mask + channels + Worley emissive cracks + animation. Cheap: resurfacing mask + a single flat emissive value (no per-fragment crack Worley — Worley F2−F1 is a 2-pass cost), or static (no `uTime` animation).

---

### F9 — Chaos / disrupted terrain

Variants: **ice-shell chaos (rafts)** · **volatile-outflow collapse** · **antipodal seismic jumble**. **I own the relief rendering; CRYO owns the volatile/resurfacing generation path.**

**(a) Render HOW.**
- **Ice-shell chaos (Europa Conamara — rafts):** a region of **broken, rotated, re-frozen blocks** in a disrupted matrix. Render as: (1) a **chaos mask** (where chaos exists — a low-freq FBM threshold); (2) inside the mask, a **Voronoi cellular field whose cells are individually height-jittered and rotation-jittered** (each cell = a raft, hash-offset in height and given a small per-cell domain-rotation so its internal texture points a different way) sitting in a **low rough matrix** (the refrozen ice between rafts, lower elevation + high-freq noise). The visual is "jigsaw of tilted plates." The per-cell rotation is the key — it makes blocks look *moved* not just *bumpy*.
- **Volatile-outflow collapse:** a **subsidence basin** — a broad inverted-dome depression (terrain collapsed where subsurface volatile drained) with a chaotic floor. Reuse the chaos-block field at the basin floor.
- **Antipodal seismic jumble:** chaos mask placed **antipodal to a large F2 basin** (the seismic-focusing point opposite a giant impact — Caloris antipode). Generation places the mask at `-impactCenter`.

**(b) Generation path.**
- **Drivers (mostly CRYO's to set):** D2 volatile (ice shell exists), D12 tidal heating (drives shell disruption), D11/D16. **Seam:** CRYO computes `iceShellActivity` (how disrupted the shell is) from D2/D12/P7; I consume it as `uIceShellActivity` to drive chaos coverage. **Flag for orchestrator: `uIceShellActivity` is a shared uniform — CRYO generates, RELIEF + CRYO both render.**
- **CPU derivation (mine):** `chaosCoverage` ← `uIceShellActivity` (from cryo) × seed; `antipodalCenter` ← `-largestImpactCenter`.
- **Semantic uniforms:** `uChaosCoverage` (float), `uChaosCellScale` (float), `uChaosRaftJitter` (float, height+rotation jitter amount), `uIceShellActivity` (float, **SHARED with CRYO**).

**(c) Envelope interaction.** Raft relief + matrix **survives** (strong block-edge contrast). Per-cell rotation reads as varied lit/shadow facets — posterizer-friendly. *Keep.*

**(d) Quality-scalar fallback.** Rich: Voronoi rafts + per-cell rotation + rough matrix + subsidence basins. Cheap: height-jittered Voronoi cells without per-cell rotation (cheaper — rotation needs a per-cell matrix), no subsidence basins.

---

### F10 — Ridged / grooved icy terrain

Variants: **double ridges** · **grooved bands** · **lenticulae (diapirs)** · **refrozen-crack networks**. **I own relief rendering; CRYO owns generation path.**

**(a) Render HOW.**
- **Double ridges (Europa — the signature icy feature):** **two parallel raised ridges flanking a central trough**, spanning thousands of km. Render along **warped Voronoi-border lines** (or warped FBM iso-contours): for each crack line, a profile of `[ridge | trough | ridge]` across the line normal — `+smoothstep` at `±offset`, `−smoothstep` at center. The lines themselves are long and gently curving (low-freq warp). Confirmed formation physics (NASA): cracks that open-and-close repeatedly build the flanking ridges — so the *double* profile is the right primitive, not a single ridge.
- **Grooved bands (Ganymede):** **parallel sets of many fine ridges** in a band — a directional high-frequency ridged field (`abs`-folded noise stretched along one axis, `pos.x *= 8`) confined to a band mask. Multiple bands at different orientations crosscut (reuse F6 tessera dual-axis idea).
- **Lenticulae (diapirs):** small circular domes/pits — Voronoi-placed `smoothstep` bumps (dome) or dimples (pit), small radius, scattered.
- **Refrozen-crack networks:** Voronoi-border ridge web (reuse F4/F5 edge-distance) at low amplitude — a fine polygonal crack lattice across the ice.

**(b) Generation path.**
- **Drivers (CRYO sets activity):** D2, D12 (tidal flexing cracks the shell — the more tidal heat, the more ridges/bands), D1 (cold — refreezes cracks).
- **Seam:** consumes the same `uIceShellActivity` (CRYO-generated) as F9. High activity → dense double-ridges + bands; low → a few old refrozen cracks.
- **CPU derivation (mine):** `ridgeDensity`, `bandDensity` ← `uIceShellActivity`; orientations ← seed.
- **Semantic uniforms:** `uDoubleRidgeDensity` (float), `uGroovedBandStrength` (float), `uLenticulaeDensity` (float), `uIceShellActivity` (**SHARED with CRYO/F9**).

**(c) Envelope interaction.** Double ridges + grooved bands **survive** (parallel ridge relief = strong lit/shadow stripes, very posterizer-friendly — these read beautifully banded). Lenticulae **survive** (small domes). Refrozen-crack web is low-amplitude → `[subtle]`, may need amplitude push. *Keep ridges/bands/lenticulae; stylize/possibly-drop the faint crack web at distance.*

**(d) Quality-scalar fallback.** Rich: double-ridges + grooved bands + lenticulae + crack web. Cheap: single-ridge cracks (not double — the double profile is 2× the smoothsteps), one band orientation, no crack web.

---

## 3. Proposed semantic-uniform registry additions

Extends the `deriveUniforms(drivers, qualityTier)` registry in `planet-lod-lab-core.js`. All derive CPU-side from existing `planetData` fields unless flagged **NEW**.

| Uniform name | GLSL type | Driver source (D#→P#) | Value range | Default |
|---|---|---|---|---|
| `uMountainAmp` | float | D11/D16→P3/P2 (erosion-softened) | 0.0–1.0 | 0.4 |
| `uRidgeOffset` | float | (constant, lab-tunable) | 0.8–1.2 | 1.0 |
| `uRidgeGain` | float | (constant, lab-tunable) | 1.5–2.5 | 2.0 |
| `uOrogenyStrength` | float | D15→P3 (subduction proxy) | 0.0–1.0 | 0.0 |
| `uOrogenyAxis` | vec2 | seed | unit vec | (1,0) |
| `uCraterDensity` | float | D11→P1 (`bombardmentIntensity × (1−resurfacing)`) | 0.0–1.0 | 0.5 |
| `uCraterComplexD` | float | **D14→P1** (`k/g`, k by D2) | 0.05–2.0 | 0.3 |
| `uCraterRelaxation` | float | D2+D1→P1 (icy palimpsest) | 0.0–1.0 | 0.0 |
| `uTerraceCount` | float | (constant) | 2–6 | 4 |
| `uCraterCells` | int | `qualityTier` (Q3: 27↔9) | 9 or 27 | 27 |
| **`surfaceGravity`** | float | **D14 — NEW surfacing** (`massEarth/radiusEarth²`) | 0.1–4.0 (g) | 1.0 |
| `uEjectaStrength` | float | D11→P1 | 0.0–1.0 | 0.4 |
| `uRampart` | float | D2→P1 (fluidized) | 0.0–1.0 | 0.0 |
| `uRayBrightness` | float | D11 (young) × airless gate (D6) | 0.0–1.0 | 0.0 |
| `uChasmaDepth` | float | D11/D12→P2 | 0.0–1.0 | 0.0 |
| `uChasmaCount` | int | seed | 0–3 | 0 |
| `uChasmaAxis` | vec2[3] | seed | unit vecs | — |
| `uChasmaWidth` | float | seed | 0.02–0.2 | 0.06 |
| `canyonHeight` (accumulator) | float | **SHARED** — tectonic (mine) + fluvial + cryo add in | — | — |
| `uScarpStrength` | float | D11/D16→P2 (contraction) | 0.0–1.0 | 0.0 |
| `uScarpStyle` | float | D2→P2 (thrust↔normal) | 0.0–1.0 | 0.5 |
| `uScarpWarp` | float | seed | 0.0–1.0 | 0.3 |
| `uScarpAxis` | vec2 | seed | unit vec | (1,0) |
| `uPlateauStrength` | float | D11/D12→P2 | 0.0–1.0 | 0.0 |
| `uTesseraStrength` | float | D11/D12→P2/P15 | 0.0–1.0 | 0.0 |
| `uVolcanismStrength` | float | D12+D11→P4/P5 | 0.0–1.0 | 0.0 |
| `uEdificeMaxHeight` | float | **D14→P4** (g⁻¹) | 0.2–2.0 | 1.0 |
| `uShieldStratoMix` | float | D4/D2→P4/P5 (viscosity) | 0.0–1.0 | 0.5 |
| `uPancakeStrength` | float | D5→P4 (pressure-gated) | 0.0–1.0 | 0.0 |
| `uCoronaStrength` | float | D12→P4 (plume) | 0.0–1.0 | 0.0 |
| `uLavaCoverage` | float | D11→P4 (`resurfacingRate`) | 0.0–1.0 | 0.0 |
| `uLavaActivity` | float | **D12→P4** (drives `uEmissive`) | 0.0–1.0 | 0.0 |
| `uChannelDensity` | float | seed × activity | 0.0–1.0 | 0.0 |
| `uChaosCoverage` | float | `uIceShellActivity` × seed | 0.0–1.0 | 0.0 |
| `uChaosRaftJitter` | float | (constant) | 0.0–1.0 | 0.5 |
| `uDoubleRidgeDensity` | float | `uIceShellActivity` | 0.0–1.0 | 0.0 |
| `uGroovedBandStrength` | float | `uIceShellActivity` | 0.0–1.0 | 0.0 |
| `uLenticulaeDensity` | float | `uIceShellActivity` | 0.0–1.0 | 0.0 |
| **`uIceShellActivity`** | float | **D2+D12→P7 — SHARED w/ CRYO** | 0.0–1.0 | 0.0 |

**NEW driver surfacing required (flag to Stage-A/generation):**
1. **`surfaceGravity`** — trivial (both `massEarth` and `radiusEarth` exist in `planetData`; `g ∝ M/R²`). Gates crater morphology (F2) AND edifice height (F7). Highest-value single addition in this domain.
2. **Planet-level `tidalHeating` (D12)** — `tidalHeating()` exists but is parameterized for *moons* (`M_parent, R_moon, a`). Confirm/derive a planet-applicable tidal-heat scalar reaching `planetData` for F8 `uLavaActivity` and F7 `uVolcanismStrength`. (Eccentricity + close-orbit planets self-heat.)
3. **`uIceShellActivity`** — owned by CRYO agent's generation path; RELIEF consumes it. Coordinate name.

---

## 4. Lab folder spec — `▸ Surface — Relief`

Extends the existing `fRelief = gui.addFolder('Surface — Relief')` (currently a stub, closed). Sub-organized so 10 features don't make a flat 40-slider wall. Maps to spec §3 ("folders mirror the driver-bundle model"); every control is a semantic uniform declared once.

```
▸ Surface — Relief
  ▸ Mountains (F1/F6)
      uMountainAmp [0..1]
      uRidgeOffset [0.8..1.2]   uRidgeGain [1.5..2.5]
      uOrogenyStrength [0..1]   uOrogenyAxis (xy pad / angle)
      uPlateauStrength [0..1]   uTesseraStrength [0..1]
      [toggle] slope-damped erosion
  ▸ Craters (F2/F3)
      uCraterDensity [0..1]
      surfaceGravity [0.1..4]   → drives uCraterComplexD (read-only readout)
      uCraterRelaxation [0..1]  uTerraceCount [2..6]
      uCraterCells {9, 27}      (also set by qualityTier)
      uEjectaStrength [0..1]    uRampart [0..1]   uRayBrightness [0..1]
  ▸ Tectonic (F4/F5)
      uChasmaDepth [0..1]  uChasmaCount {0..3}  uChasmaWidth [0.02..0.2]
      uScarpStrength [0..1] uScarpStyle [0..1] uScarpWarp [0..1] uScarpAxis(angle)
  ▸ Volcanic (F7/F8)
      uVolcanismStrength [0..1]  uEdificeMaxHeight [0.2..2]
      uShieldStratoMix [0..1]    uPancakeStrength [0..1]  uCoronaStrength [0..1]
      uLavaCoverage [0..1]       uLavaActivity [0..1] (→ emissive bypass)
      uChannelDensity [0..1]     uCrackScale [..]
  ▸ Icy (F9/F10)
      uIceShellActivity [0..1]   (SHARED — also in Cryo folder)
      uChaosCoverage [0..1]      uChaosRaftJitter [0..1]
      uDoubleRidgeDensity [0..1] uGroovedBandStrength [0..1] uLenticulaeDensity [0..1]
```

Plus a **`▸ Relief presets`** hook under `▸ Presets`: loading a "type" (rocky / ice / lava / venus / …) sets a *bundle* of these uniform values (Appendix-A driver bundle), NOT a code path — so Max can A/B "what does a heavily-cratered ancient rocky world look like" vs "young Io-grade lava world" by preset, then tune per-uniform from there. This is the §3 structural rule made concrete for relief.

---

## 5. 3-cycle-cap risk flags

Per MEMORY.md: if any of these fails research→implement→test 3×, switch technique rather than death-spiral. Named fallback for each.

1. **Voronoi seams / pole-pinch on the sphere (Q2/Q3 — the single biggest technical risk).** 3D-domain Voronoi on `vPos` *should* be seamless (no UV, no poles) — but the 27-cell cost and the tangent-frame needed for the 9-cell mobile fallback are unproven on this pipeline. **Fallback:** commit to 3D 27-cell desktop-only for craters; if the 9-cell tangent path can't be made seamless in 3 cycles, drop the mobile crater path entirely (mobile gets crater-free smooth relief, untuned per spec) rather than ship a seam. This is a dedicated harness spike (foundational §6 Q2).

2. **Central-peak + terrace morphology under 6-level posterize.** Fine central peaks and terrace rings quantize to mush at 6 levels. **Fallback:** stylize — push central-peak amplitude to occupy a full luminance band, render terraces as 2–3 *hard* steps (lean into posterize) rather than smooth slumps. If even the bowl+rim won't read at 6 levels, that's evidence for raising `posterizeLevels` at LOD2 for cratered bodies (an Option-B data point for Max, §6).

3. **Ridged-multifractal shimmer under dither.** Ridged crestlines are high-frequency and *will* shimmer into flickering dither blocks without the fwidth octave clamp — and even with it, the sharp `abs()` fold amplifies aliasing. **Fallback:** if the fwidth clamp can't tame it in 3 cycles, soften the ridge fold (`signal = uRidgeOffset - abs(n.x)` → blend toward un-folded FBM via `uRidgeSharpness < 1`), trading crispness for stability. The IGN/triangular dither mode (already in the envelope folder) is the second lever.

4. **Analytic-gradient sign errors on folded octaves (silent-bug risk, not a perf risk).** Every ridged/billow fold MUST apply the Decarpentier sign correction (`-sign(n.x)*n.yzw` for ridged). If skipped, normals light inverted faces backward — looks "wrong" but compiles fine, exactly the failure the harness catches. **Mitigation, not fallback:** unit-test the folded-FBM gradient against finite-difference of the height in `planet-lod-lab-core.js` *before* trusting the shader normal (the core file already pins logic with vitest — add a gradient-correctness test).

5. **Per-cell raft rotation (F9 chaos) cost + seams.** Per-cell domain rotation inside a Voronoi field is a matrix-per-fragment cost and risks discontinuities at cell borders. **Fallback:** height+offset jitter only (no rotation) — rafts still read as displaced blocks, just less convincingly "rotated." Cheaper and seam-free.

---

## 6. Open questions for Max (taste/scope, not technical)

1. **Posterize level at LOD2 for cratered bodies.** Craters are the feature most likely to want `posterizeLevels` > 6 up close (central peaks/terraces/ejecta gradients). Hold 6 strict (Option A — craters read as bold bowl+rim, fine morphology stylized to hard steps), or let cratered rocky/icy worlds push to ~10–12 at full `lodRamp` (Option B for this family only)? This is the §4 tracked-open-goal decision, scoped to relief.
2. **How much crater morphology to actually build.** The full ladder is simple→complex→peak-ring→multi-ring→palimpsest. Is the gameplay payoff worth all five, or do simple-bowl + complex(central-peak) + faint-palimpsest cover the felt range, deferring peak-ring/multi-ring? (Each is a profile branch + a gravity-threshold; the marginal ones are the rarest visually.)
3. **Orogeny (P3) — build it or skip it?** True fold-mountain belts are Earth-only (terrestrial/ocean-exclusive). It's one of the more involved relief features (anisotropic belts + erosion) for one rare type. Worth the budget, or do ridged-multifractal "generic mountains" cover the terrestrial case acceptably?
4. **Ejecta ray systems — albedo exception.** Rays are the one relief feature that's albedo, not relief, so they fight the posterizer. Keep them (stylized as hard bright bands), or drop them as not-worth-the-envelope-fight? (They're striking on young craters but only airless worlds.)
5. **Relief "intensity" exposure.** The inventory names an "intensity / how-extreme" axis per process. Do you want a global `reliefDrama` master slider (gameplay/art knob that exaggerates all relief amplitude beyond physical) for the retro-stylized look, or keep amplitudes physically-derived only?

---

## 7. Sources

Real, consulted this session. URLs verified live except where noted.

**Foundational (in-repo, re-grounded):**
- `research/RESEARCH_high-lod-planet-shaders-2026-06-05.md` — analytic-derivative noise, ridged multifractal, slope-damped FBM, Voronoi craters, domain warp, emissive bypass. (The HOW vocabulary this doc extends.)
- `docs/FEATURES/planet-visual-features.md` — D#/P#/F# catalogue, Appendix A/B.
- `docs/superpowers/specs/2026-06-06-planet-rendering-foundation-design.md` — Stage-A architecture.
- `planet-lod-lab.html` / `planet-lod-lab-core.js` — `noised()`, `fbmd()`, `perturbAnalytic()`, `deriveUniforms()`, composite-split envelope, lil-gui folders.
- `src/generation/PhysicsEngine.js` — `computeSurfaceHistory` (`:733`), `deriveComposition` (`:341`), `tidalHeating` (`:295`), `estimateMassEarth`/`escapeVelocity` (`:61`/`:81`).
- `src/generation/PlanetGenerator.js` — `planetData` returned fields (`:679-707`).
- `src/objects/Planet.js` — aurora/atmosphere semantic-uniform precedent (`:1051, 1059-1066`), dead `lodLevel` (`:1077`).

**Web (consulted this session, verified):**
- Inigo Quilez — gradient noise + derivatives: https://iquilezles.org/articles/gradientnoise/ ; value-noise derivatives (morenoise, slope-damped erosion `a += b*n.x/(1+dot(d,d))`): https://iquilezles.org/articles/morenoise/ ; domain warp: https://iquilezles.org/articles/warp/ ; Voronoi edge/border distance (pass-2 `dot(0.5*(mr+r), normalize(r-mr))`): https://iquilezles.org/articles/voronoilines/ ; filtering/band-limiting: https://iquilezles.org/articles/filtering/
- Giliam de Carpentier — "Scape: Procedural basics" — **derivative-correct billow `vec3(abs(n.x), sign(n.x)*n.yz)` and ridged `vec3(1-abs(n.x), -sign(n.x)*n.yz)`, FBM derivative accumulation, `iqTurbulence` slope-damping**: https://www.decarpentier.nl/scape-procedural-basics
- Ken Musgrave reference C (ridged multifractal `signal=offset-abs(noise); signal*=signal*weight; weight=clamp(signal*gain,0,1)`, HeteroTerrain `increment*=current`): https://engineering.purdue.edu/~ebertd/texture/1stEdition/musgrave/musgrave.c
- Isaratech ridged-multi reference: https://docs.isaratech.com/ue4-plugins/noise-library/generators/ridged-multi
- Krüger et al. 2018, *JGR Planets* — lunar simple-to-complex transition diameter (~20 km) morphometric database: https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2018JE005545
- Melosh, *Impact Cratering* ch.6 (transition diameter ∝ g⁻¹, depth/diameter, central peak / peak-ring formation): https://geosci.uchicago.edu/~kite/doc/Melosh_ch_6.pdf
- Wikipedia, *Complex crater* (central uplift, terraced rim, peak-ring massifs ~½ rim diameter): https://en.wikipedia.org/wiki/Complex_crater
- Encyclopedia.com, *Impact Crater* (transition diameters Moon ~20 km / Mars ~6–11 km / Mercury ~11 km; icy-vs-rocky g⁻¹ constant differs): https://www.encyclopedia.com/science/encyclopedias-almanacs-transcripts-and-maps/impact-crater
- NASA/JPL — Europa chaos terrain + double-ridge formation (cracks opening/closing build flanking ridges; bands = horizontal dilation; chaos = rotated refrozen blocks): https://www.jpl.nasa.gov/news/newly-reprocessed-images-of-europa-show-chaos-terrain-in-crisp-detail/
- LPI impact-cratering primer (profile depth/rim proportions): https://www.lpi.usra.edu/exploration/education/hsResearch/moon_101/ImpactCratering.pdf
- The Book of Shaders — cellular/Voronoi (12): https://thebookofshaders.com/12/ ; FBM/ridged (13): https://thebookofshaders.com/13/
- tuxalin/procedural-tileable-shaders — seamless/tileable Voronoi + warp reference: https://github.com/tuxalin/procedural-tileable-shaders/blob/master/voronoi.glsl
- Shadertoy "Faster Voronoi Edge Distance" (scarp/border distance, for F4/F5): https://www.shadertoy.com/view/llG3zy

**Not separately re-verified (cited from the foundational doc, which marked them verified):** davidar.io sim-GLSL crater profile (https://davidar.io/post/sim-glsl), glsl-worley (https://github.com/Erkaman/glsl-worley) — used for F8 Worley cracks.
