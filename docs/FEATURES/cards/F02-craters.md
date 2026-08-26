# Feature Card — F02 Craters
Domain: Relief · Lab status: ✅ · Build-seq phase: 3

## 1. Description (WHAT)

F2 "Craters" (inventory L2 row, docs/FEATURES/planet-visual-features.md:217) — the observable surfacing of P1 Impact cratering (:142): impactors gouge bowls, throw ejecta, and at size rebound into central peaks / multi-ring basins; crater DENSITY = surface age. Physical chain (L0 drivers): D11 surface-history supplies bombardment-vs-resurfacing budget; D14 mass/gravity sets the simple→complex transition diameter (Earth ~3 km vs Moon ~20 km, i.e. complexD ∝ g⁻¹); D16 surface age accumulates the count; D5 thick atmospheres burn small impactors; D2 volatile inventory fluidizes ejecta and weakens icy crust (smaller transition diameter, viscous relaxation). Variants: simple bowl · complex (central peak + terraced walls) · peak-ring · multi-ring basin · palimpsest (relaxed ghost). Real-body examples: Tycho (complex), Orientale (multi-ring), Caloris (giant basin), Valhalla (icy palimpsest + ring troughs). WD types: rocky, ice, terrestrial, venus, carbon, machine, shattered, crystal. Inventory status `[partial]` (basin height only) is stale for the lab — full crater morphology is now built in world-engine-lab.html (production Planet.js still has only the old basin-height term).

## 2. Current shader approach (HOW, as-built)

BUILT in the lab. GLSL: `craterProfile(r, morphology, relaxation, terraceCount)` at world-engine-lab.html:695-716 — parabolic cavity 0.2·(r²−1) (depth/diam ≈ 0.2), morphology-gated central peak (inverse smoothstep over r<0.4, amp 0.14), cos-ring wall terraces (uTerraceCount), gaussian rim peak at r≈1 (amp 0.05, width 0.18), relaxation k=1−relaxation multiplies the whole profile → palimpsest; returns vec2(h, dh/dr) so the gradient is analytic. Placement: `craterCombiner` :723-738 — first consumer of the voronoi3d keystone; per-cell hash33 gates host (uCraterDensity fraction) and hashes radius mix(0.18,0.55); morphology = smoothstep(uCraterComplexD·0.6, uCraterComplexD, diameter) with NO type branch; accumulates height + chain-rule gradient (prof.y·(1/craterRadius)·voroGrad·uCraterScale); uCraterDensity≤0 early-outs. Called in the Stage-2 relief-combiner stack at :1501 (F3 ejectaCombiner :1502 wraps the SAME Voronoi centers). Uniforms :1628-1635; state defaults :1877-1884; GUI folder 'Craters (F2)' :2296-2304 (density/complexD/relaxation/terraces/cell density/amplitude/enable/🎲 randomize); frame-loop uniform writes :2693-2698, offset :2811. Drivers: planet-lod-lab-core.js deriveUniforms:591-615 — craterDensity = clamp01(bombardment·(1−resurfacing)) (surface AGE; Io-grade resurfacing wipes it), craterComplexD = mix(0.9 rocky, 0.45 icy, volatileGate)/max(g,0.05) (Melosh ch.6 g⁻¹ law), craterRelaxation = clamp01(volatileFraction·smoothstep(120,273,T)·2). Vitest-pinned JS twin craterProfile at planet-lod-lab-core.js:154-195. Quality: qualityKnobs core.js:40 picks 27-cell 3D vs 9-cell Voronoi. Taxonomy: planet-archetypes.js:7 — key 'craters', enableKey 'cratersEnabled', archetype 'impact-airless' (Moon/Mercury; preset 'Frozen (airless)'). Gap vs inventory variants: peak-ring and multi-ring basin morphologies are NOT modeled — the blend stops at central-peak complex.

## 3. Reference images (real + art)

- [real] https://www.nasa.gov/image-article/tycho-craters-peak/
  — Tycho's central peak rising from a shadowed flat floor — the complex-crater silhouette (bright peak inside dark bowl, raised rim) is exactly the high-contrast luminance form a 6-level posterize can keep.
- [real] https://science.nasa.gov/moon/lunar-craters/the-explosive-history-of-orientale-basin/
  — Orientale's three concentric rings as a bullseye — the multi-ring basin form (currently unbuilt variant) reads at global scale as alternating bright/dark rings, ideal posterize material.
- [real] https://science.nasa.gov/photojournal/the-valhalla-multi-ring-structure-on-callisto/
  — Valhalla on Callisto — a bright relaxed palimpsest core with faint trough rings on ice; the target look for uCraterRelaxation→1 (form flattened, albedo ghost remains).
- [real] https://science.nasa.gov/photojournal/mercurys-caloris-basin-one-of-the-largest-impact-basins-in-the-solar-system/
  — Caloris on Mercury — giant basin whose interior is smoother volcanic plain than its surroundings; note crater-density CONTRAST as an age signal, the thing craterDensity encodes.
- [real] https://www.lpi.usra.edu/lunar/missions/orbiter/lunar_orbiter/impact_basin/
  — LPI impact-basin geology overview — rim/ejecta/secondary structure of lunar basins; useful for which morphological elements carry the read at distance.
- [art] https://deep-fold.itch.io/pixel-planet-generator
  — Deep-Fold Pixel Planet Generator — dithered shader planets with toggleable dithering; the closest existing match to our Bayer+posterize envelope and how craters read as 2-3 tone dimples in it.
- [art] https://github.com/Deep-Fold/PixelPlanets
  — MIT shader source for the above (Godot GLSL) — inspect how their dwarf/no-atmosphere planet does crater dimples with hard banding, for amplitude/contrast calibration.
- [art] https://emaceart.itch.io/cosmokit-low-poly-planet-pack
  — CosmoKit stylized low-poly planets — craters reduced to pure silhouette form (rim ring + bowl shadow); a reminder that form-first, not texture-first, is what survives stylization.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology: impact-crater morphometry is well codified (Melosh, "Impact Cratering") — simple bowls have depth/diameter ≈ 1/5 and rim height ≈ 4-5% of diameter; above a transition diameter D* ∝ 1/g (and roughly halved in weak icy targets) craters collapse to complex morphology: flat floor, central peak, terraced walls; still larger sizes give peak-ring then multi-ring basins. Crater size-frequency follows a power law, and crater counting / saturation equilibrium is the standard surface-age clock — which is why density = age is the right driver. On warm ice, viscous relaxation flattens topography into palimpsests while leaving an albedo ghost (Valhalla). Procedural/games practice (per research/RESEARCH_high-lod-planet-shaders-2026-06-05.md §3.1 row "Impact craters (Voronoi F1 + analytic profile)"): place craters at jittered Voronoi centers (sparse-convolution style), normalize r = dist/craterRadius, and sum an analytic radial profile — parabolic cavity (r²−1) + gaussian/smoothstep rim at r≈1 + 1/r² ejecta skirt — with central peak + cos(2πnr) terraces for large D (sources: LPI impact-cratering PDF, davidar.io sim-glsl, Book of Shaders ch.12, IQ voronoi). The doc's keystone vocabulary applies directly: one voronoi3d evaluation with analytic chain-rule gradients feeds a per-feature COMBINER that routes all detail through the normal (lighting-routed detail), which is what survives the 6-level posterize; the fwidth clamp + lodRamp octave budget keep it shimmer-free. Most promising shader-side path: the built craterCombiner is already the literature-recommended architecture, so extend rather than replace — (1) add a second, coarser Voronoi octave (lower uCraterScale, larger radii) to approximate the size-frequency power law and host the rare basin class, (2) extend craterProfile with a peak-ring term (annular gaussian at r≈0.5) blended in by a second smoothstep above the complex threshold, (3) keep everything vec2(h, dh/dr) analytic so the chain-rule gradient stays exact.

## 5. Isolation recipe (:9223)

Built — solo it on the :9223 debug Chrome (launch per memory/chrome-devtools-9223-launch.md: second Chrome with --remote-debugging-port=9223 --user-data-dir="C:\\temp\\chrome-mcp-filmstrip"; use chrome-devtools MCP, not Playwright). Steps: (1) navigate to the vite-served world-engine-lab.html; (2) evaluate `window._lab.setPreset('Frozen (airless)')` — the impact-airless archetype preset (bombardment 0.85, resurfacing 0.05 → craterDensity ≈ 0.81); (3) `window._lab.solo('craters')` — key 'craters' from planet-archetypes.js FEATURES, disables every other combiner; (4) set camera: `window._lab.state.distance = 6` for full LOD2 (lodRampOf: smoothstep(20→6), so 6 ⇒ ramp = 1), then also judge at 12 (mid-ramp pop-in check) and 3 (close inspection; floor is 1.1, LOD2 hysteresis enters <18); (5) variant sweeps via state: `craterRelaxation = 0.8` (palimpsest), `craterComplexD = 0.1` (force central-peak complex everywhere), `craterComplexD = 2.0` (all simple bowls), `terraceCount` 2..6; (6) `state.craterOffset = [Math.random()*10,Math.random()*10,Math.random()*10]` (or GUI '🎲 randomize') to re-roll placement; (7) confirm gating with `window._lab.featureEnabled('craters')` and read `window._lab.state._derived` for the driven values.

## 6. What to judge (UAT checklist)

- [ ] Does each crater read as a concave bowl with a raised rim in the 6-level posterized envelope — i.e. does the terminator-side lighting give a shadowed inner wall opposite a lit one, with a bright rim ring — rather than a flat albedo spot?
- [ ] Do large craters read as COMPLEX — a distinct lit central peak inside the bowl plus concentric terrace steps on the inner wall — while small ones stay simple bowls, with the transition shifting when craterComplexD changes (gravity/ice driver)?
- [ ] Does craterDensity read as surface AGE at a glance: the Frozen (airless) preset looks saturated/battered, and dialing density toward 0 (resurfaced world) reads as a young smooth plain, not just dimmer craters?
- [ ] Does the hashed radius range produce believable size variety — overlapping mixed sizes — rather than a uniform polka-dot field that betrays the Voronoi cell lattice (no visible grid regularity, alignment rows, or cell seams)?
- [ ] Does relaxation → 1 read as palimpsest behavior: the bowl flattens toward the plain while a faint ghost ring remains, instead of craters simply popping off?
- [ ] Do rims and peaks light CORRECTLY as the planet rotates or the camera orbits (analytic chain-rule gradient check) — bright sun-facing slopes, shadowed lee slopes — with no inverted or static-looking shading?
- [ ] Do craters survive the Bayer dither across the distance ramp — still legible as forms at distance 12-20, no shimmer/flicker of rim pixels while rotating, no pop when the lodRamp brings relief amplitude in?
- [ ] With ejecta solo'd OFF, is the crater silhouette self-sufficient (F2 owns r≤1), and with both on, does the apron visibly wrap the same craters rather than introducing mismatched centers?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: 🟢 2026-06-10 (VERIFIED_PENDING_MAX) — Frozen (airless), solo
  `craters`, d6/d3/d12 + morphology/relaxation/density sweeps. Drivers
  verified live: craterDensity 0.8075, complexD 1.607 (after
  `applyDrivers()` — setPreset alone leaves stale uniforms, same gotcha
  as F01).
  - Bowl + rim form: shadowed inner wall opposite lit wall with bright rim
    ring at d6 and d3; battered/saturated read fits the airless preset
    (shots 01, 02).
  - Morphology driver: complexD=0.1 → interior central peaks + terrace
    structure appear in the same craters; complexD=2.0 → plain bowls
    everywhere; transition visibly tracks the driver (shots 04 vs 05).
  - Age driver: density 0.08 reads as young resurfaced plain with a few
    bowls — craters disappear, not dim (shot 07 vs 01).
  - Size variety: hashed radii give overlapping mixed sizes; no lattice
    rows or cell seams visible at d6 or d3.
  - Palimpsest: relaxation 0.85 flattens bowls to faint ghost depressions
    instead of popping craters off (shot 06).
  - Distance: large craters still legible as forms at d12 through the
    Bayer dither (shot 03). Rotation-lighting correctness and no-pop LOD
    ramp covered by FOUNDATION checks 2 & 4 🟢 (crater shading explicitly
    verified there across yaw sweep).
  - Ejecta pairing (checklist item 8): solo silhouette self-sufficient
    here; shared-center wrap verified in F03 (same Voronoi centers by
    construction — see F03 §7).
  - Vitest: craterProfile JS twin pinned; suite 8/8 green this session.
  - Shots: F02-craters-01-d6.png, -02-d3.png, -03-d12.png,
    -04-d6-allcomplex.png, -05-d6-allsimple.png, -06-d6-relax085.png,
    -07-d6-density008.png.
- Max's feedback: (pending Phase-7 lap)
- Tweaks applied: none needed
- Re-verify: n/a
- Status: VERIFIED_PENDING_MAX
