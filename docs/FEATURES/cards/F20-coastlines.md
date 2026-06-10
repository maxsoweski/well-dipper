# Feature Card — F20 Coastlines
Domain: Gradational · Lab status: ⬜ · Build-seq phase: 4a

## 1. Description (WHAT)

F20 Coastlines (F-gradational family — water/wind/ice-shaped landforms; docs/FEATURES/planet-visual-features.md:242). L1 source P13 Coastal/shoreline action (:154): a standing liquid body's margin erodes & deposits → shorelines/strandlines, sea cliffs, beaches/terraces; abandoned levels record paleo-climate ("paleo-shorelines = climate record"). Intensity axis: faint bench → stacked terrace flight. L0 drivers: liquid stability = D1 equilibriumTemperature + D2 volatileFraction + D6 atmosphere retention (all [current] in PhysicsEngine.js), plus wave/tide energy and D14 mass/gravity. Variants: strandline/paleo-shoreline · sea cliff · beach/terrace. Real-body examples: Earth coasts (active beaches, cliffed fjord margins), Titan lake margins (ragged methane-sea shores), plus relict cases — Mars' hypothesized Arabia/Deuteronilus paleo-shorelines and Lake Bonneville's stacked Stansbury/Bonneville/Provo benches. WD planet types: ocean, terrestrial, eyeball. F20 is a named ingredient of the ocean archetype recipe (:361 — "F14 F20 F36 F31a F34"). Status: [aspirational].

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). No coastlines entry exists in the FEATURES registry (planet-archetypes.js:6-23) and no coast/shore code in planet-lod-lab.html. Nearest existing machinery it should plug into: the Fluvial domain owns the land/sea cut — Stage-4's comment reserves it ("uLiquidMask cut at seaLevel", planet-lod-lab.html:1524); uniforms uLiquidStability/uLiquidMask/uLiquidSpecies are declared at :1782-1784 (Stability/Species driven LIVE at :2172-2174, uLiquidMask still a 0.0 placeholder); the Stage-A FBM continents (macroSeed, octaves 0-2 — :1855, :2052) provide the height field whose sea-level isoline IS the coastline; fluvialCombiner (:654) shares the canyonHeight accumulator so "a future F14 lake pass [can] pool liquid in these channels for free" (:652); and the F36 sunglint stand-in (uSpecStrength, :1612/:2130) is the designated downstream reader of the mask F20 would produce.

## 3. Reference images (real + art)

- [real] https://www.usgs.gov/media/images/ligeia-mare-a-sea-north-polar-region-titan-saturns-largest-moon
  — Ligeia Mare radar mosaic — a dark flat sea against bright land with a ragged, drowned-valley shoreline (bays, fingers, near-shore islands); the high-contrast two-tone read is exactly what a posterized land/sea boundary should give for free.
- [real] https://en.wikipedia.org/wiki/Mars_ocean_theory
  — Arabia/Deuteronilus paleo-shorelines — thousands-of-km contour-following bands with no liquid present; shows the strandline variant as a faint topographic line, distinct from an active coast.
- [real] https://geology.utah.gov/map-pub/survey-notes/geosights/bonneville-salt-flats/
  — Lake Bonneville wave-cut benches on the Silver Island Mountains — stacked terrace flights (Stansbury/Bonneville/Provo levels) read as parallel horizontal shelves on slopes, visible from huge distances; the 'stacked terrace flight' end of the intensity axis.
- [real] https://science.nasa.gov/earth/earth-observatory/cape-farewell-greenland-9033/
  — Cape Farewell, Greenland — steep fjord-cut bedrock coast: the cliff-coast variant where the land/sea boundary is abrupt and dark, no beach band at all.
- [art] https://godotshaders.com/shader/procedural-pixelated-sea-shader/
  — Procedural pixelated sea — quantized water surface in a pixel-art envelope; evidence that animated water detail survives heavy color quantization when carried by luminance.
- [art] https://timcoster.com/2021/09/24/unity-shader-graph-procedural-planet-water-tutorial/
  — Procedural-planet water tutorial — depth-below-sea-level drives a shore band (shallow tint/foam rim hugging the coast); the standard game-side recipe F20 should adapt to a slope-aware band.
- [art] https://www.davidhol.land/articles/3d-pixel-art-rendering/
  — 3D pixel-art rendering — how one-pixel-crisp boundary lines read in a quantized 3D scene; the target crispness for the coastline contour itself.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology treats a coastline as the sea-level isoline of the topographic field, with two classic properties: (1) it is fractal (Mandelbrot's coastline paradox, dimension ~1.2-1.3 — an FBM height field's level set inherits this for free, which is why the Stage-A continents already produce plausible coast shapes), and (2) shore character is slope-controlled — gentle nearshore slope → wide beach/wave-built terrace, steep slope → wave-cut cliff and notch. Paleo-shorelines (Bonneville benches, Mars' Deuteronilus) are simply earlier isolines preserved as wave-cut platforms: a discrete comb of contour levels above present sea level. Games/procgen model this almost universally as a height threshold: landMask = smoothstep(seaLevel-w, seaLevel+w, h), then a "distance to shore" proxy for beach/foam bands; the slope-aware first-order version d = (h - seaLevel)/|∇h| (the standard SDF-from-implicit-function trick) converts the height margin into a true geometric shore distance, so beach width automatically widens on flats and collapses to a cliff line on steeps. The lab's analytic-derivative FBM (noised() returning value + gradient) supplies ∇h at zero extra cost, and the research doc's envelope analysis says contour/terrace forms are "survives" techniques — they are relief/luminance structure, not hue, so the 6-level posterize keeps them (terracing is literally quantization of h, aesthetically congruent with the posterized envelope; foam is a thin pre-posterize bright band, sunglint is the existing bypass channel). Most promising shader-side approach: a coastlineCombiner that runs AFTER all relief combiners, reads the accumulated h and grad, computes signed shore distance d = (h - uSeaLevel)/length(grad), and writes (a) uLiquidMask-style landMask for F14/F36 consumers, (b) an albedo beach band where 0 < d < uBeachWidth gated by low slope, (c) cliff darkening where slope exceeds a threshold near d≈0, and (d) optional paleo-strandline benches as small relief flats at h = uSeaLevel + k·uTerraceStep (k = 1..3), driven by erosion/climate-history params. All terms are luminance/relief so they survive the Bayer-dithered posterize unchanged.

## 5. Isolation recipe (:9223)

Unbuilt — recipe once built: register in planet-archetypes.js FEATURES as coastlines: { label: 'Coastlines (F20)', enableKey: 'coastEnabled', archetypes: ['tectonic-terrestrial','volatile-cold'] } (the per-folder 🔆 solo button and Body-filter wiring then come free via setFeatureEnables). Steps on the :9223 lab: (1) load preset 'Ocean (temperate)' (the canonical water-coast exemplar; 'Rocky (Earthlike)' for a continent-dominant coast, 'Titan (methane seas)' for the methane lake-margin/species variant); (2) window._lab.solo('coastlines'); (3) judge at three distances via window._lab.state.distance = 8 (global continent-outline read), 3 (regional coast: bays/peninsulas/beach band), 1.5 (LOD2 close-up: cliff line, terrace flight, foam). Vary state.macroSeed to re-roll continents and confirm the boundary tracks them. Clear with window._lab.enableAllFeatures().

## 6. What to judge (UAT checklist)

- [ ] Does the land/sea boundary read as one crisp, coherent contour at global distance — continents against sea, not speckle — in the 6-level posterized envelope?
- [ ] Does the coast read as fractal/ragged (bays, peninsulas, near-shore islands) rather than a smooth blobby isoline, and does it re-roll convincingly with macroSeed?
- [ ] Does shore character respond to slope — a wide bright beach/terrace band on gentle coasts collapsing to an abrupt dark cliff line on steep coasts?
- [ ] Do paleo-shoreline strandlines read as thin stacked benches parallel to the present coast (a terrace flight), clearly distinguishable from posterize banding artifacts?
- [ ] Does the boundary hold position through the LOD ramp (no crawling or swimming of the coastline as octaves ramp with distance)?
- [ ] On the Titan preset, does the margin read as dark methane sea against bright land with drowned-valley raggedness — species-tinted, with no bright water-world beach band?
- [ ] Does all land-side coastal detail survive as relief/luminance structure (still legible if hue were stripped), per the envelope's survives-the-posterize rule?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
