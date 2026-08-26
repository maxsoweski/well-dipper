# Feature Card — F07 Volcanic edifices
Domain: Relief · Lab status: ✅ · Build-seq phase: 3

## 1. Description (WHAT)

F7 Volcanic edifices (docs/FEATURES/planet-visual-features.md:222, F-relief family) — discrete constructed volcanoes, derived from P4 effusive volcanism (:145, low-viscosity magma builds broad shields, plus pressure-gated pancake domes on thick-air worlds) and P5 explosive volcanism (:146, gas-rich magma erupts steep stratovolcanoes, collapse calderas, pyroclastic blankets). The physical chain runs through D12 tidal heating (:103 — Io-grade flexing keeps interiors molten), D14 mass/gravity (:105 — low g lets edifices grow giant: Olympus Mons is 22 km because Mars is ~0.38 g), and D5 atmosphere density (:96 — Venus's 92-bar pressure suppresses explosive degassing, extruding flat pancake domes). Variants per the L2 row: shield, stratovolcano, summit caldera, pancake dome (thick-air), corona/nova/arachnoid (plume). Real-body examples: Mauna Loa, Olympus Mons, Sapas Mons, Venus coronae, Io's paterae. WD types: rocky, terrestrial, venus, lava, carbon. Note: the doc table still marks F7 `[aspirational]`, but the lab built it in Stage-C step 3 (the table is stale on this row).

## 2. Current shader approach (HOW, as-built)

BUILT (Stage-C step 3, Relief) in /home/ax/projects/well-dipper/world-engine-lab.html. GLSL `edificeProfile(r, shieldStratoMix, calderaR)` at world-engine-lab.html:1052 — cone body `pow(1-r, p)` with `p = mix(1.5, 4.0, shieldStratoMix)` (shield broad ↔ strato steep), summit parabolic caldera bowl subtracted at r<calderaR (the F2 cavity shape), zero for r>=1; returns vec2(height, dh/dr). `edificeCombiner(pos, h, grad)` at :1074-1087 — its OWN sparse Voronoi placement (`voronoi3d(pos*uEdificeScale + uEdificeOffset)`, sparser than craters so volcanoes are fewer and bigger), hashed host gate `step(1.0-uVolcanismStrength, ch.x)`, hashed radius `mix(0.3,0.7,ch.y)`, amplitude `uEdificeAmp*uEdificeMaxHeight*host`; analytic slope chain-rules exactly via `voroGrad*uEdificeScale` into the lighting gradient; early-out when uVolcanismStrength<=0. Called in the relief chain at :1508. Uniforms declared :240-247, GPU init :1680-1682, frame-loop writes :2737-2742 (enable gate `state.edificesEnabled`). Drivers (deriveUniforms, /home/ax/projects/well-dipper/planet-lod-lab-core.js:496): `volcanismStrength = clamp01(tidalProxy + resurfacing*0.5 + habitability*0.3)` (:724, D12 tidal + D11 resurfacing + subduction-arc proxy), `edificeMaxHeight = clamp(1/g, 0.2, 2.0)` (:730, the Olympus Mons D14 driver), `shieldStratoMix = clamp01(habitability)` (:737, wet-plate-tectonics as the magma-viscosity proxy). JS reference profile + constants (SHIELD_P=1.5, STRATO_P=4.0, CALDERA_R=0.12, CALDERA_DEPTH=0.5) at planet-lod-lab-core.js:431-447; dh/dr pinned vs central finite-diff in tests/planet-lod-relief.test.js. GUI folder 'Edifices (F7)' at world-engine-lab.html:2389-2397 (volcanism density, max height (g⁻¹), shield↔strato, cell density, amplitude, caldera radius, ✓ enabled, 🎲 randomize). Solo key `edifices` registered in planet-archetypes.js:14 (archetype 'volcanic', :29). NOT covered yet: pancake-dome and corona/arachnoid variants.

## 3. Reference images (real + art)

- [real] https://www.usgs.gov/publications/topography-shield-volcano-olympus-mons-mars
  — Canonical shield profile: very broad, very shallow flanks (the p≈1.5 end of the cone exponent) with a basal scarp and a summit caldera — the low-g giant-shield silhouette the edificeMaxHeight∝1/g driver targets.
- [real] https://pubs.usgs.gov/publication/sim3470
  — Olympus Mons caldera geologic map — nested 65×80 km collapse pits; the summit must read as a flat-floored PIT on top of the cone, not a peak (the caldera-depth>cone-drop constraint in core.js:431).
- [real] https://www2.jpl.nasa.gov/magellan/image29.html
  — Magellan radar pancake domes (Eistla Regio, Venus) — flat-topped steep-rimmed disks, the unbuilt D5 thick-air variant: a height-clamped profile, not a cone.
- [real] https://geology.com/stories/13/venus-volcanoes/
  — Venus giant shields (Sapas Mons): 400 km wide, only 1.5 km high, radial texture from hundreds of overlapping flows — the extreme-broad end of shield aspect ratio and the F8 flow-field tie-in.
- [real] https://science.nasa.gov/photojournal/active-volcanic-plumes-on-io/
  — Io's scattered point-source volcanic centers on a tidally heated world — the volcanismStrength-saturating regime: many hosts, but still discrete identifiable edifices, not uniform roughness.
- [art] https://www.artstation.com/artwork/XB4Jyy
  — Outer Wilds' Hollow's Lantern volcanic moon — a FEW large, instantly readable cones carrying a whole body's identity; form-first stylization at exactly our retro register.
- [art] https://free-game-assets.itch.io/volcanoes-3d-low-poly-pack
  — Low-poly volcano pack — what survives heavy quantization: clean cone silhouette + visible crater notch; nothing else is essential.
- [art] https://www.pixelartgg.com/gallery/volcano
  — Volcano pixel-art gallery — dithered slope shading on cones at brutal color budgets; the flank reads through 2-3 lighting bands per face, our 6-level analog.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology: edifice form is governed by magma viscosity (silica/water content) — fluid basalt spreads into low-slope shields (flank slopes ~5°), viscous andesite/dacite stacks steep stratocones (~30°); maximum edifice height scales inversely with gravity via lithospheric/flank strength limits (Olympus Mons 22 km at 0.38 g vs ~10 km Mauna Loa base-to-summit at 1 g); calderas form by roof collapse over a drained magma chamber (depth must exceed local summit relief to read as a pit); Venus pancake domes are viscous extrusions whose flat tops come from high ambient pressure suppressing explosive degassing (D5). Procedural-generation and game practice models volcanoes the same way as craters: a point process scatters centers, and each center stamps an analytic radial profile h(r) — in the research doc's vocabulary (research/RESEARCH_high-lod-planet-shaders-2026-06-05.md §3.1) this is the "Voronoi F1 + analytic profile" pattern, with the profile's exact dh/dr chain-ruled into the shading normal ("lighting-routed detail," the core posterize-survival strategy: form arrives through diffuse-bucket changes, not albedo). Flank texture, when wanted, comes from ridged multifractal or slope-damped FBM modulated by the cone mask; summit heat ties into the Worley F2−F1 crack + emissive-bypass machinery already serving F8 lava. The lab implements exactly this: jittered-Voronoi hosts, `pow(1−r, mix(1.5,4,viscosity))` cone, subtracted parabolic caldera, analytic gradient throughout — all `survives`-class techniques per the doc. Most promising next shader-side moves stay inside the same combiner: hash-perturb the effective radius angularly (cheap fbm of cell-relative azimuth) for flank irregularity and rift-zone elongation; add a flat-top clamp variant (`min(h, plateau)` with smoothed shoulder) gated by atmosphere pressure for D5 pancake domes; and seed the F8 flow field radially downslope from host centers so flows visibly emanate from the edifices.

## 5. Isolation recipe (:9223)

Built — solo it on the :9223 lab Chrome (launch per memory/chrome-devtools-9223-launch.md; drive via mcp__chrome-devtools__evaluate_script, not Bash curl). 1) Open world-engine-lab.html. 2) `window._lab.setPreset('Lava (hot airless)')` — the volcanic-archetype exemplar (planet-archetypes.js:29): Io-grade tidal heat saturates volcanismStrength≈1, sub-Earth g lifts edificeMaxHeight, habitability 0 → shieldStratoMix 0 (pure shields). 3) `window._lab.solo('edifices')` — key from FEATURES in planet-archetypes.js:14; this zeroes every other relief combiner so only Stage-A base + cones remain. 4) Distances via `window._lab.state.distance`: 4.0 for the full-LOD2 close read (lodRamp saturates near 6 radii), 2.5 to put cones on the limb and judge silhouette, 15-20 for the global scatter/density read. 5) Strato variant: `window._lab.setPreset('Rocky (Earthlike)')` (habitability 0.7 → mix 0.7) or drag the 'shield↔strato' slider in the ▸ Edifices (F7) folder to 1.0; also sweep 'volcanism (density)', 'max height (g⁻¹)', and 'caldera radius', and hit 🎲 randomize to re-roll placement. 6) Sanity uniforms: `window._lab.uniforms.uVolcanismStrength.value` > 0 confirms the combiner isn't early-outing.

## 6. What to judge (UAT checklist)

- [ ] Does each edifice read as a single coherent CONE rising from the surrounding terrain in the 6-level posterized envelope — a radial stack of 2-3 lighting bands (lit face / shadow face) — rather than dissolving into noise?
- [ ] Does the summit read as a PIT (caldera) and never a peak — i.e., at the very top the lighting bands invert (dark bowl interior on the sun side), across the full shield↔strato slider range?
- [ ] Does the shield↔strato axis produce two visibly different forms: broad shallow domes whose bands are wide and gentle (shield, p=1.5) vs narrow steep cones with tight high-contrast bands (strato, p=4)?
- [ ] Do low-g presets show visibly FEWER-but-GIANT edifices (Olympus Mons regime) while 1-g worlds stay modest — does the g⁻¹ height driver read as a size change in the dither envelope, not just a brightness change?
- [ ] Is placement sparse and discrete — a countable handful of volcanoes per hemisphere, clearly sparser and larger than the crater field — with no Voronoi cell-grid pattern betraying the placement lattice?
- [ ] On the limb, does the cone break the sphere's silhouette as a clean bump with a summit notch, with no inside-out lighting (the sign-wrong-gradient failure mode the dh/dr test guards)?
- [ ] When the lodRamp runs in/out (distance 20 → 4), do edifices fade/resolve smoothly without popping or dither shimmer at their rims?
- [ ] At volcanismStrength near 0 (Frozen preset), does the surface show NO edifices at all — and does the transition from none → few → many track the driver monotonically?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: 🟢 2026-06-10 (VERIFIED_PENDING_MAX) — Lava (hot airless), solo
  `edifices`, d4/d2.5/d15 + shield↔strato A/B + 5-preset driver sweep.
  Drivers verified live: volcanism 1.0, maxHeight 1.246 (g⁻¹), mix 0.
  - Cone form: discrete coherent cones with lit/shadow band faces rising
    from the terrain; countable handful per hemisphere, sparser and
    larger than the crater field, no lattice pattern (shots 01 d4, 02
    d2.5).
  - Summit pit: caldera reads as a dark bowl with lit far wall — a pit,
    never a peak — at both ends of the shield↔strato slider (summit
    zooms; dh/dr also pinned by the relief vitest).
  - Shield↔strato: controlled A/B at the same host — mix 0 spreads a
    broad gentle-banded dome, mix 1 contracts it into a narrow steep
    tight-banded cone (shots 02 vs 03).
  - Driver sweep (read live): volcanism 0.04 Frozen (≈none) → 0.215
    Titan → 0.262 Rocky → 1.0 Europa/Lava — monotone none→few→many;
    maxHeight clamps at 2.0 for small bodies vs 1.11 Rocky (Olympus
    regime). shieldStratoMix 0.7 on wet Rocky vs 0 on dry Lava.
  - Distance: edifices dissolve smoothly into the LOD ramp by d15 (shot
    04); no pop (FOUNDATION check 4 🟢). Silhouette break on the limb is
    subtle at derived amplitudes but lighting never inverts.
  - Shots: F07-edifices-01-d4-lava-shields.png, -02-d2.5-limb.png,
    -03-d2.5-strato.png, -04-d15-scatter.png.
- Max's feedback: (pending Phase-7 lap)
- Tweaks applied: none needed
- Re-verify: n/a
- Status: VERIFIED_PENDING_MAX
