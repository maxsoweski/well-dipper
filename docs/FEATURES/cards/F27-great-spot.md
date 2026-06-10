# Feature Card — F27 Great-spot anticyclone
Domain: Storms · Lab status: 🟡 · Build-seq phase: 4b

## 1. Description (WHAT)

F27 Great-spot anticyclone (family F-storms, derives from P17 Vortex/storm formation): zonal shear + deep convection spin up a single quasi-permanent giant vortex sitting between counter-rotating jets — persistent for decades to centuries, the signature "face" of a gas world. Physical chain: D8 rotation rate (fast spin → Coriolis-organized jets) + D5 atmosphere density/depth, zonal shear, interior heat and condensables (P17 drivers per planet-visual-features.md:163) → a coherent oval embedded in the banded flow (P16), with a turbulent wake downstream. Variants: (a) single giant oval — warm/contrasting interior with pale collar (Jupiter GRS-class); (b) dark spot — a 1–2-shade darker bruise with bright companion clouds on an otherwise bland disk (Neptune GDS-class). Real-body examples: Jupiter's Great Red Spot, Neptune's Great Dark Spot. WD types: gas, hot-jupiter. Inventory status `[current]` (single) — but that flag refers to production's noise-blob storm term, not a true coherent oval (see §2).

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) in planet-lod-lab.html — gas types are explicitly DEFERRED in the lab header (planet-lod-lab.html:22), there is no gas preset in DRIVER_PRESETS (planet-lod-lab.html:2149–2160), and no storm combiner, uniform, or FEATURES entry exists (grep for storm/spot/vortex/anticyclone hits only comments and the Aeolian F40 stage note at :1559). Nearest existing machinery it should plug into: (1) production already GENERATES deterministic per-seed storm data — src/generation/PlanetGenerator.js:587–655 builds `storms.spots` (sphere position avoiding poles, angular radius 0.1–0.3 "small storm → massive Great Red Spot", three color modes: dark bruise / warm GRS-like / bright pale) plus `polarStorm` — currently UNWIRED to any shader; (2) the production GAS_BODY shader's stand-in is a pow-thresholded low-frequency snoise patch (src/objects/Planet.js:262–264) colored via `stormMask = smoothstep(0.78, 0.88, bandVal)` (Planet.js:301–303) — noise blobs, no coherent oval or swirl; (3) the Stage-C canonical-uniform registry RESERVES the carriage for exactly this feature: `uStormPosSize[8]` / `uStormParams[8]` / `uStormColor[8]` / `uStormCount`, owner Bands domain, consuming the existing `storms.spots`/`polarStorm`, mirroring the `shadowMoonPos[6]` flat-array pattern (research/stage-c/REGISTRY-canonical-uniforms.md:42, status DEFERRED). F27 in the lab = a gas-banded base stage (F24) plus a storm combiner reading those reserved arrays.

## 3. Reference images (real + art)

- [real] https://photojournal.jpl.nasa.gov/catalog/PIA22946
  — Juno color-enhanced GRS (Feb 2019): note the pale collar ring around the darker red core and how the surrounding bands wrap and deflect around the oval — the 'embedded in the flow' read our combiner must keep at 6 levels.
- [real] https://science.nasa.gov/photojournal/close-up-of-jupiters-great-red-spot/
  — NASA close-up of the GRS interior: internal spiral structure and the east-west elongated (not circular) ellipse aspect — the close-distance swirl hint to suggest, not resolve.
- [real] https://photojournal.jpl.nasa.gov/catalog/PIA21775
  — True-color JunoCam GRS: at natural contrast the spot is mostly a LUMINANCE feature against the bands — exactly the property that survives the posterize envelope.
- [real] https://www.jpl.nasa.gov/images/pia00049-neptune-great-dark-spot-scooter-dark-spot-2/
  — Voyager 2 Neptune: Great Dark Spot variant — a soft dark oval with bright white companion clouds at its edge on a near-featureless blue disk; the minimal two-tone version of the feature.
- [art] http://johnwhigham.blogspot.com/2011/11/gas-giants.html
  — Whigham's procedural gas giants: hash-placed storm centers with rotational swirl distortion of the band texture — the canonical 'rotate the sampling coordinate around the center' technique, already cited in our research doc.
- [art] https://medium.com/@barth_29567/procedural-gas-giants-f2a61bc6bd97
  — Paleologue procedural gas giants: latitude-banded FBM + recursive domain warp base the spot must sit ON; shows how warp strength alone turns flat bands into fluid-looking flow.
- [art] https://parallelcascades.com/gas-giant-curl-simulation/
  — Parallel Cascades Unity gas-giant curl simulation: layered domain-warped noise with swirling storms — a good reference for how much swirl reads as 'rotation' without any real fluid sim.
- [art] https://www.mobiusdigitalgames.com/news/giants-deep-visual-effects-vfx
  — Outer Wilds Giant's Deep VFX (Mobius Digital dev blog): heavily stylized low-detail cyclones that still read unmistakably as storms — proof that form/silhouette carries the read, our style target's spirit.

## 4. Math / modeling notes (HOW, from the field)

Academia models a great spot as a coherent anticyclonic vortex in shallow-water / quasi-geostrophic flow, trapped between counter-rotating zonal jets: the ambient meridional shear sets the oval's east-west elongation, the vortex core rotates as a near-solid body (Rankine-like tangential-velocity profile: linear rise to the radius of maximum wind, then ~1/r decay), and downstream the flow sheds a turbulent wake of filaments. Games and demos skip the dynamics and model the KINEMATIC signature in texture space — the research doc's "Storm-mask + rotational swirl (GRS)" row (RESEARCH_high-lod-planet-shaders-2026-06-05.md:88): hash-placed deterministic centers; per center `ang = rotStrength * smoothstep(radius, 0, d); p = c + rot2D(ang) * (p - c)` applied to the sampling coordinate BEFORE the latitude-banded FBM + recursive domain-warp lookup (rows :86–87), so the bands themselves wrap around the vortex and form the collar/moat for free; Whigham packs 100–200 such storms as cones in a 128² cubemap. Animation, if wanted, uses the two-phase flow-map primitive (:102) or curl-noise advection (:89) with bounded time for re-approach determinism; it's classified needs-adaptation, while the static swirl itself survives the envelope (high-contrast luminance). On a sphere, "distance to center" is great-circle distance and the rotation needs a local tangent frame at the storm center — the research doc flags the sphere flow-frame as the single biggest technical-risk fork (:188). Most promising shader-side approach: wire PlanetGenerator's existing `storms.spots` through the reserved `uStormPosSize/uStormParams/uStormColor/uStormCount` flat arrays, and in the gas-banded combiner apply a per-storm rotational domain warp (angle = strength × smoothstep falloff of great-circle distance, axis = the center's surface normal) to the band coordinate before the banded-FBM sample, then mix in the storm color inside a soft elliptical mask (stretch the distance metric east-west by the local zonal direction). One storm with radius ~0.25 and high rotStrength IS the F27 great spot; the same machinery at smaller radii is F28 — build once, drive by data.

## 5. Isolation recipe (:9223)

Unbuilt — recipe for once it lands. Recommended registration: key `greatSpot` (label 'Great spot (F27)', enableKey `greatSpotEnabled`) in planet-archetypes.js FEATURES, under a new gas archetype (e.g. 'gas-banded') with a new DRIVER_PRESETS entry such as 'Gas giant (Jovian)'; the combiner should read storm position/size from the seed-derived driver data, not a lab slider, so the 🎲 reroll exercises placement determinism. Then on the :9223 debug Chrome (per memory/chrome-devtools-9223-launch.md + well-dipper-testing-reference.md): load the Vite-served planet-lod-lab.html, set the Drivers 'type preset' to the gas-giant preset, run `window._lab.solo('greatSpot')` (solo wiring already generic — setFeatureEnables, planet-lod-lab.html:2539/2908), then judge at `window._lab.state.distance = 10` (full-disk: oval placement, aspect, band wrap) and `window._lab.state.distance = 2.5` (close: collar levels, internal swirl, wake filaments). Enable spin to confirm the spot is anchored to the rotating surface, and reroll the seed twice to confirm position/size change deterministically.

## 6. What to judge (UAT checklist)

- [ ] Does a SINGLE dominant oval read as one coherent closed vortex at full-disk distance in the 6-level posterized envelope — not a smeared noise blob like the current production pow(snoise) patch?
- [ ] Does the spot read as east-west elongated (roughly 1.5–2:1 ellipse), i.e. shaped by the zonal shear, rather than a circular sticker?
- [ ] Do the neighboring bands visibly deflect and wrap around the spot (collar/moat), so it reads as embedded IN the flow rather than pasted ON it?
- [ ] Does the rim/interior contrast survive posterization as at least two distinct levels — pale collar ring vs. darker or warmer core?
- [ ] At close distance, does the interior suggest rotation — a spiral/swirl hint in the dither structure — rather than reading as static texture?
- [ ] Is there a one-sided turbulent wake or peel-off filament downstream that breaks the oval's symmetry, implying flow direction?
- [ ] Dark-spot variant: on a bland ice-giant disk, does a soft 1–2-level darker oval with a small bright companion patch still read as a storm and not as a rendering artifact?
- [ ] Behavior: does the spot stay anchored to the rotating surface (no sliding), and does the same seed reproduce the same position and size on re-approach?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
