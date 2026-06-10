# Feature Card — F43 Crystalline facet field
Domain: Exotic · Lab status: ⬜ · Build-seq phase: 4c

## 1. Description (WHAT)

F43 Crystalline facet field (F-exotic-natural, speculative): a planet whose crust grew — rather than fractured — into geometric crystal forms, from scattered individual crystals up to a continuous faceted field covering the globe. Physical chain: derives from P15 Crustal tessellation / fracture (docs/FEATURES/planet-visual-features.md:156), specifically its third mode — "slow crystallization grows facet fields" — driven by D11 surface-history (impact flux / resurfacing budget, line 102), D16 planet/surface age (cooling time, line 107), uniform lithology, and D12 tidal stress (line 103); the facet pattern records the cooling/disruption history. Intensity axis: scattered crystals … continuous faceted field (line 322). No confirmed real bodies; terrestrial analogs are Naica's giant selenite crystals (slow crystallization at constant temperature over ~500 kyr) and bismuth hopper crystals (edge-dominated stepped facets); the candidate carbon/diamond world 55 Cancri e is the nearest astronomical anchor. WD types: crystal (the dedicated EXOTIC crystallization preset, which pairs F43 with specular glints — line 372), carbon, and cooled lava.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). There is no crystal/facet entry in the planet-archetypes.js FEATURES registry (lines 6-23), no crystal archetype (lines 27-33), and no crystal preset in DRIVER_PRESETS (planet-lod-lab.html:2149-2162); grep for crystal/facet in the lab shader returns nothing. The machinery it should plug into is the shared voronoi3d keystone cellular primitive (planet-lod-lab.html:486-520, hash33 cell-id + F1/F2 + analytic grad), already consumed per-cell by F2 craters (:718-756), F9 chaos rafts with per-cell hashed flat heights (:1162-1196 — the closest existing "flat per-cell plate" look), and F18 sublimation polygons (:1276-1300), combined with the existing Blinn-Phong specular-glint channel uSpecStrength (:1583-1587, with its own posterize/bypass gate) and the emissive-bypass path used by lava cracks (:1132, :1581) for any internal diamond-glow variant.

## 3. Reference images (real + art)

- [real] https://en.wikipedia.org/wiki/Cave_of_the_Crystals
  — Naica's 12 m selenite beams — the literal P15 'slow crystallization grows facet fields' mechanism: long prismatic forms with dead-flat faces and sharp terminations, all at hashed-random orientations.
- [real] https://www.nationalgeographic.com/science/article/photos-mexico-cave-of-crystals
  — Photo set of the same cave — notice how each crystal reads as 2-3 flat tone planes under a single light, exactly what a 6-level posterize can reproduce.
- [real] https://en.wikipedia.org/wiki/Hopper_crystal
  — Hopper (bismuth-style) growth: edges outpace face centers, giving stepped terraced facets — a recipe for nested per-cell relief rather than smooth bumps.
- [real] https://en.wikipedia.org/wiki/55_Cancri_Ae
  — The candidate carbon/diamond super-Earth — the nearest real-body anchor for a whole-planet crystalline crust; pairs F43 with the carbon type's emissive glints.
- [art] https://www.behance.net/gallery/52064975/WIP-Low-Poly-Crystal-Cave
  — Low-poly crystal cave: facets carried entirely by per-face flat shading and a tiny palette — the stylization target our posterized envelope naturally lands on.
- [art] https://sketchfab.com/3d-models/stylized-low-poly-crystals-ea90e27f87f7405dbf96cd504e6264c7
  — Stylized low-poly crystal clusters — note how silhouette (tilted prisms breaking the horizon line) sells 'crystal' more than any surface detail does.
- [art] https://www.shadertoy.com/view/ld3Szs
  — 3D Cellular Tiling shadertoy with a 'crystalline surface' — a procedural voronoi-cell facet field, the same mechanism family as our voronoi3d keystone.

## 4. Math / modeling notes (HOW, from the field)

Academia models crystal form via the Wulff construction (equilibrium shape minimizes anisotropic surface energy → flat low-index faces) and growth-rate anisotropy (fast-growing faces grow themselves out of existence, leaving slow faces as the visible facets; edge-favored growth gives hopper/terraced steps — the Berg effect). Nobody simulates that in a planet shader; games and demos fake the *result* with cellular partitions: a voronoi region with one constant (or planar-gradient) normal per cell reads as a flat facet, and F2−F1 border distance (Quilez's voronoi edge-distance technique, already in the research doc's source list) gives crisp inter-crystal grooves. In the vocabulary of research/RESEARCH_high-lod-planet-shaders-2026-06-05.md this is a `survives` lighting-routed-detail feature: route everything through the normal (perturb N -= strength*(g - dot(g,N)*N) before the diffuse term, never albedo), keep noise body-local on vPos (seam-free), fade sub-pixel cells with the fwidth clamp, and let the 6-level posterize quantize each tilted facet into 1-2 tone bands — posterization actually *helps* here, since real crystal faces are constant-tone planes. Most promising shader-side approach: one new voronoi3d consumer ("crystalFacets combiner") that, inside a low-frequency province mask (the scattered→continuous intensity axis), assigns each cell a hashed facet normal from hash33(cellId) plus a planar height ramp from the returned grad, carves cell borders with smoothstep on (F2−F1), and gates the existing Blinn-Phong uSpecStrength glint to crystal cells for per-facet sparkle; an optional emissive-bypass cell-interior glow (reusing the lavaCrackEmissive pattern) covers the carbon-diamond variant. Two voronoi octaves (big crystals + sub-facet steps) give the hopper-terrace read at LOD2.

## 5. Isolation recipe (:9223)

Unbuilt — recipe for once it exists. Recommended registration: add `crystals: { label: 'Crystal facets (F43)', enableKey: 'crystalsEnabled', archetypes: ['exotic-crystalline'] }` to FEATURES in planet-archetypes.js, plus a 'Crystal (exotic)' entry in DRIVER_PRESETS (until then the nearest hosts are 'Lava (hot airless)' for the cooled-lava variant and 'Frozen (airless)' for a clean dark base). Then on the :9223 lab Chrome (chrome-devtools MCP, see memory/chrome-devtools-9223-launch.md): load planet-lod-lab.html, run `window._lab.setPreset('Crystal (exotic)')`, `window._lab.solo('crystals')`, and judge at three distances via `window._lab.state.distance = 18` (province mask barely visible — global read), `= 8` (facet field resolving as lodRamp ramps in, lodRamp = smoothstep(20,6,dist)), and `= 2` (full LOD2: individual facets, border grooves, per-facet glints; legal range is 1.1-30, planet-lod-lab.html:2615). Confirm isolation with `window._lab.featureEnabled('crystals') === true` and all other featureEnabled keys false; `window._lab.enableAllFeatures()` to clear.

## 6. What to judge (UAT checklist)

- [ ] Does each cell read as a single flat tilted plane — one or two posterize bands per facet with a hard tone break at the cell border — rather than a smooth voronoi bump in the 6-level envelope?
- [ ] Do facet orientations look hashed-random (adjacent cells catch the light differently), so rotating the light/camera makes individual facets flip bands like a real crystal field glittering?
- [ ] Does the scattered→continuous intensity axis read at a glance: isolated crystals punctuating normal terrain at low intensity vs. a wall-to-wall faceted crust at high intensity?
- [ ] Do inter-crystal grooves (F2−F1 borders) stay crisp dark seams under the Bayer dither instead of dissolving into dither noise at mid distances?
- [ ] Do per-facet specular glints survive posterization as small bright pings on lit facets only — sparse and sharp, not a smeared gloss across the whole sphere?
- [ ] Is the pattern seam-free and pole-pinch-free when the planet rotates (the voronoi3d-on-vPos guarantee), with no cell shimmer as lodRamp/fwidth fades sub-pixel cells?
- [ ] At LOD2 (distance ≈ 2), does a second smaller facet octave suggest hopper-style terraced steps inside big crystals without breaking the flat-plane read of the parent facet?
- [ ] For the carbon/diamond variant, does the emissive interior glow read as light from within the crystal (bypassing posterize like lava cracks) rather than a flat albedo tint?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
