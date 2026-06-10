# Feature Card — F44 Hexagonal-tessellated crust
Domain: Exotic · Lab status: ⬜ · Build-seq phase: 4c

## 1. Description (WHAT)

F44 Hexagonal-tessellated crust (F-exotic-natural, EXOTIC family; flagged speculative). Derives from P15 crustal tessellation/fracture: cooling-contraction or convective stress in a uniform-lithology crust tiles it into regular polygons — contraction stress is relieved most efficiently by three fractures meeting at 120°, yielding six-sided cells; the pattern records the body's cooling/disruption history. L0 drivers: D11 surface-history, D16 planet/surface age (cooling time), D12 tidal-heating stress. Intensity axis / variants: small local polygon patches → planet-wide hex tiling. Real-body small analogs: columnar basalt (Giant's Causeway-style jointing), Pluto's Sputnik Planitia N₂-convection polygons (16-40 km cells, ~100 m domed centers, trough borders), Mars thermal-contraction crack polygons. The planet-wide tiling endmember is a speculative game-construct with no confirmed real body. WD types: hex (headline — the 'hex' EXOTIC archetype lists F44 plus an F29 Saturn-hexagon polar-vortex hook, a separate feature), rocky, ice.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). No hex/tessellation combiner, uniform, or GUI folder exists — grep of /home/ax/projects/well-dipper/planet-lod-lab.html and /home/ax/projects/well-dipper/planet-archetypes.js finds no F44/hex code, and the FEATURES registry (planet-archetypes.js:6-23) has no hex key nor any 'exotic' archetype. Nearest existing machinery it should plug into: the voronoi3d keystone primitive (planet-lod-lab.html:499 — seam-free 3D cellular noise returning F1/F2/cellId/grad), and specifically the F18 sublimation N₂-convection-polygon branch (planet-lod-lab.html:1295-1300, uVolatileSpecies==4, uSubPolyScale) which already renders raised-cell-interior / trough-border polygon fields from smoothstep(F2−F1); the F9 chaos-raft combiner (planet-lod-lab.html:1162-1177) supplies the per-cell hashed flat-height convention. F44 is essentially those two mechanisms plus a center-regularity control and its own enable/GUI plumbing.

## 3. Reference images (real + art)

- [real] https://www.nasa.gov/image-article/intricate-surface-patterns-revealed-plutos-sputnik-planum/
  — Pluto's Sputnik Planitia convection cells: 16-40 km polygons with smooth, slightly domed centers and rougher trough borders — the relief profile (raised interior, carved edge) our combiner should reproduce.
- [real] https://www.usgs.gov/observatories/hvo/news/volcano-watch-columnar-jointing-provides-clues-cooling-history-lava-flows
  — USGS HVO on columnar jointing: contraction fractures meet at ~120° triple junctions — the junction angle, not perfect hexagons, is what makes the pattern read as 'cooled crust.'
- [real] https://www.nps.gov/subjects/volcanoes/columnar-jointing.htm
  — NPS columnar-jointing gallery: real columns are 5-7-sided with irregular sizes — a believable hex crust keeps that variance rather than a perfect grid (until the exotic planet-wide endmember).
- [real] https://hirise.lpl.arizona.edu/ESP_016641_2500
  — HiRISE Mars polygonal patterned ground: thermal-contraction crack polygons read as a network of dark trough LINES on a flat plain — borders carry the signal, interiors stay quiet.
- [real] https://www.jpl.nasa.gov/images/pia10658-polygon-patterned-ground-on-mars-and-on-earth/
  — JPL side-by-side of Mars vs. Earth permafrost polygons — same border-trough morphology at different scales; supports one mechanism with a scale knob.
- [art] https://store.steampowered.com/app/1073910/Before_We_Leave/
  — Before We Leave's Goldberg-polyhedron planets: clean stylized hex-tiled globes that hide the 12 mandatory pentagons in oceans — the planet-wide-tiling art target, flat-shaded tiles with crisp borders.
- [art] https://www.shadertoy.com/view/wtdSzX
  — Minimal Hexagonal Shader/Grid (Shadertoy): the canonical compact GLSL hex-coordinate math — note how border-distance gives a single clean edge channel, ideal for routing into relief instead of color.
- [art] https://andrewhungblog.wordpress.com/2018/07/28/shader-art-tutorial-hexagonal-grids/
  — Hexagon-grid shader tutorial: staggered-lattice nearest-point construction (a zero-jitter Voronoi degenerates to hexagons) — exactly the bridge from our existing voronoi3d to regular tiling.

## 4. Math / modeling notes (HOW, from the field)

Physics: columnar jointing is modeled as thermal-contraction fracture mechanics — tensile stress in a cooling, uniform layer is relieved most efficiently by three cracks intersecting at 120°, which maximizes energy release per crack area and converges (over crack-network maturation) toward hexagonal columns; real fields are 5-7-sided. Sputnik Planitia's polygons are instead Rayleigh-Bénard convection in solid N₂ ice (McKinnon-style models): overturning cells with domed centers (~100 m) and sinking trough borders — convection planforms are naturally polygonal/hexagonal. Mars patterned ground is seasonal thermal-contraction cracking (Levy 2009 HiRISE classification). Sphere topology constraint: Euler's formula forbids tiling a sphere with hexagons alone — a Goldberg polyhedron needs exactly 12 pentagons (games like Before We Leave hide them deliberately); a planet-wide hex tiling must either accept 12 pentagon defects (good exotic flavor) or stay patch-local. Shader side, in the research doc's vocabulary: this is a Voronoi-border-distance (F2−F1) feature, the same IQ voronoilines machinery the lab's craters/chaos/sublimation already consume, with detail routed through normals (lighting-routed detail survives the 6-level Bayer posterize; albedo lines get crushed). The key insight from 2D hex-grid shader math is that a staggered lattice with zero jitter IS a hexagonal tiling — regularity is just a jitter knob. Most promising approach: extend the existing voronoi3d keystone with a uHexRegularity uniform — `center = mix(cellCenter, cellCenter + hash33(...), 1.0 - uHexRegularity)` — over a BCC-offset dual lattice (zero-jitter cubic gives squares; BCC truncated-octahedron cells slice the sphere into predominantly hexagonal cross-sections), then carve smoothstep(F2−F1) trough borders plus per-cell hashed flat/domed interiors exactly per the F18 N₂-polygon and F9 chaos-raft conventions, all expressed as height+gradient so it posterizes as relief. A later 'true planet-wide hex' rich tier swaps placement to nearest-geodesic-point on a subdivided icosahedron (Goldberg cells, equal-area on the sphere) without touching the border/relief code.

## 5. Isolation recipe (:9223)

Unbuilt — recipe for once it lands. (1) Register in /home/ax/projects/well-dipper/planet-archetypes.js FEATURES as `hexTess: { label: 'Hex crust (F44)', enableKey: 'hexTessEnabled', archetypes: ['exotic-geometric'] }` with a new 'exotic-geometric' ARCHETYPES entry (the registry inversion auto-wires the panel filter and solo button). (2) In the :9223 debug Chrome (see memory/chrome-devtools-9223-launch.md), open planet-lod-lab.html via vite. (3) `window._lab.solo('hexTess')` — disables every other feature combiner. (4) Preset: until a dedicated 'Hex (exotic)' preset exists, `window._lab.setPreset('Frozen (airless)')` is the best base (cold uniform crust, no atmosphere/weather interference). (5) Distances via `window._lab.state.distance` (radii, 1.1-30; lodRamp = smoothstep(20,6,dist)): 20 for the global-tiling read (does the globe read geometric?), 8 mid-approach (borders resolving as relief), 2.5 for full-LOD2 close-up (trough cross-section + flat/domed tile interiors). (6) Verify with `window._lab.featureEnabled('hexTess')` and the __wd-style state reads, not image recognition; sweep the uHexRegularity knob 0→1 to confirm the random-Voronoi→hex continuum.

## 6. What to judge (UAT checklist)

- [ ] Do tile borders read as carved troughs / raised ridge seams (lighting-driven relief) in the 6-level posterized envelope — not as flat albedo lines that the posterizer crushes?
- [ ] Do cells read as predominantly six-sided with ~120° triple junctions at mid distance, distinct from the random Voronoi blobs of the existing crater/chaos fields?
- [ ] Do tile interiors hold a stable, quiet dither bucket (flat plateau or gently domed center) while borders consistently catch a darker band, so the network reads at a glance?
- [ ] Does the regularity continuum behave: low setting reads as natural patterned ground (Pluto/Mars analog), high setting reads as a deliberate planet-wide geometric tiling (exotic endmember), with no broken intermediate states?
- [ ] Is the pattern seam-free and pole-pinch-free while orbiting — cells stay roughly equal-sized across latitudes (3D/geodesic placement, no UV-grid stretching)?
- [ ] At distance ~20 does the planet-wide-tiling endmember read as an intentionally artificial-looking 'hex world' silhouette rather than rendering noise, and at distance ~2.5 do individual tiles read as columnar/plateau forms?
- [ ] If domed-center variant is on, does each cell's interior read as convex shading (Sputnik-style raised center) rather than per-cell flicker under the Bayer dither?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
