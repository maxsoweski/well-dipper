# Feature Card — F14 Lakes & seas (standing liquid)
Domain: Fluvial · Lab status: 🟡 · Build-seq phase: 4a

## 1. Description (WHAT)

Lakes & seas (standing liquid) — domain Fluvial, inventory status [partial] (ocean-type water + islands exist in production only). Physical chain: a stable liquid (water, or methane/ethane on cold worlds) requires the liquid-stability gate D1 (equilibriumTemperature) + D2 (volatileFraction) + D6 (atmosphere retention, itself gated by D13/P25 stripping — an airless world skips the whole F-gradational family). P8 (fluvial erosion/deposition) delivers liquid downslope into closed basins; P13 (coastal/shoreline action) works the standing body's margin into shorelines, sea cliffs, beaches/terraces, with abandoned strandlines recording paleo-climate. Variants: water sea · methane/ethane sea · dry playa/lakebed (the relict end-state when the liquid budget fails). Real-body examples: Earth's oceans (water sea), Titan's Kraken Mare and Ligeia Mare (methane/ethane seas with drowned-valley lobate coastlines and island archipelagos), Lake Bonneville's salt flats (dry playa). WD planet types: ocean (near-global liquid, sparse islands), terrestrial (continents + seas), eyeball (substellar liquid disk ringed by ice), carbon (hydrocarbon seas). Source rows: docs/FEATURES/planet-visual-features.md:236 (F14), :149 (P8), :154 (P13).

## 2. Current shader approach (HOW, as-built)

Unbuilt in planet-lod-lab.html (aspirational in the lab; the inventory's [partial] refers to production: src/rendering/TextureBaker.js seaLevel-cut ocean+land mix at :172-191 for terrestrial and :209-214 for ocean worlds with sparse islands, seaLevel uniform :264 where -1 = no ocean; palettes in src/generation/PlanetGenerator.js:138-156). The lab has deliberate F14 landing hooks but no lake pass: (1) uniform uLiquidMask declared at planet-lod-lab.html:1783, value 0.0, commented "liquid-body coverage mask — owner Fluvial; read by Optical (sunglint F36)"; (2) uniform uLiquidSpecies at :343 / :1784 (enum 0=water 1=methane/ethane, first GLSL consumer is the F11 floor-tint at :1548-1551); (3) the Stage-4 pipeline slot comment at :1523 — "FLUVIAL incision — channels/karst carve, add into canyonHeight; uLiquidMask cut at seaLevel [domain: Fluvial]"; (4) fluvialCombiner (:654-671) writes carve into the shared canyonHeight accumulator, with the explicit comment at :652 that "Sharing canyonHeight lets a future F14 lake pass pool liquid in these channels for free"; (5) uSpecStrength glint (:1612, Blinn-Phong spec at :1585, GUI "specular (ocean/ice)" in the Envelope folder at :2130) is the ready-made Option-C bypass channel for ocean glint. There is no 'lakes' key in planet-archetypes.js FEATURES (lines 6-22) yet, so no solo button exists.

## 3. Reference images (real + art)

- [real] https://www.jpl.nasa.gov/news/cassinis-final-view-of-titans-northern-lakes-and-seas/
  — Cassini's final radar mosaic of Titan's north: seas read as flat dark fills with lobate, drowned-valley coastlines against bright dissected terrain — the coastline IS the feature.
- [real] https://www.jpl.nasa.gov/images/pia17655-titans-north/
  — Titan's northern lakes as crisp, sharply-bounded dark shapes ponded in low ground — exactly the hard level-set cut a posterized envelope wants.
- [real] https://science.nasa.gov/resource/sunglint-on-a-hydrocarbon-lake/
  — Specular sunglint off Kivu Lacus: liquid identifies itself as a single mirror-bright point, not surface texture — the form our F36 glint bypass should hit.
- [real] https://www.nasa.gov/image-article/sunglint-on-atlantic-ocean/
  — Earth ocean sunglint from ISS: a broad bright glint lobe centered on the specular point, fading smoothly — at sea scale the glint is a lobe, not a pixel.
- [real] https://science.nasa.gov/earth/earth-observatory/bonneville-salt-flats-91765/
  — Bonneville Salt Flats: the dry playa/lakebed variant — a bright, dead-flat, high-albedo fill occupying the same basin geometry as a sea, with zero glint.
- [art] https://deep-fold.itch.io/pixel-planet-generator
  — Deep-Fold Pixel Planet Generator: oceans as flat single-tone color fields with dithered coast transitions — proof the land/sea read survives heavy quantization.
- [art] https://www.astronomy.com/science/the-strange-case-of-eyeball-planets/
  — Eyeball-planet illustrations: dark substellar ocean disk ringed by sea ice — the high-contrast concentric form WD's eyeball type should pose with F14.
- [art] https://planetplanet.net/2014/10/07/real-life-sci-fi-world-2-the-hot-eyeball-planet/
  — Hot-eyeball concept art: dry baked dayside, ice nightside, thin liquid 'ring of life' at the terminator — the inverted eyeball variant for hotter locked worlds.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology models standing liquid as the intersection of an equipotential surface with topography: a global sea is a single level-set cut h < seaLevel, while enclosed lakes fill closed depressions to their spill elevation — terrain literature solves this with depression-filling algorithms (Planchon-Darboux, priority-flood), which are iterative and CPU-side, so real-time procedural planets approximate with (a) a global threshold plus (b) liquid pooling wherever a carve accumulator drops ground below the threshold. Games (and WD's own production TextureBaker) use exactly the threshold form: landMask = step/smoothstep at seaLevel, hypsometric depth tint for bathymetry, flattened normals over liquid (water has no relief), Blinn-Phong glint near the specular point, and a thin coastline smoothstep band for beach/shallow tint. Under our retro envelope the research doc's spine applies directly: route the liquid read through NORMALS and SPECULAR, not hue — a flat geometric-normal liquid plane against analytic-derivative-perturbed land is the strongest 6-level signal there is, and the doc's Option C explicitly names "ocean sun-glint stays a sharp star" as a designated bypass channel (the lab's uSpecStrength/Envelope split already implements that machinery). Most promising shader-side approach: a liquidCombiner-style pass AFTER all relief combiners — mask = smoothstep(uSeaLevel+eps, uSeaLevel, h) on the fully-accumulated height (so it floods fluvial canyons and basins for free via the shared canyonHeight accumulator); inside the mask, clamp h to uSeaLevel and zero the gradient so perturbAnalytic returns the smooth sphere normal, swap albedo to a species liquid color keyed on uLiquidSpecies (mirroring the F11 fluvTint switch), and write coverage into uLiquidMask to drive in-mask uSpecStrength glint (Optical F36). The dry-playa variant reuses the identical basin test with a bright high-albedo fill and spec forced to zero; uSeaLevel ≤ -1 early-outs the whole pass, regression-safe like every other combiner.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built. Registration: add key 'lakes' to FEATURES in planet-archetypes.js (label 'Lakes & seas (F14)', enableKey 'lakesEnabled', archetypes ['tectonic-terrestrial','volatile-cold'] so both the Ocean and Titan presets surface it); the existing solo plumbing (setFeatureEnables, planet-lod-lab.html:2539) then gives the solo button and window._lab.solo for free. Isolation steps on the :9223 lab Chrome (per well-dipper-testing-reference: chrome-devtools MCP, not Playwright): (1) window._lab.setPreset('Ocean (temperate)') — the water-sea exemplar; (2) window._lab.solo('lakes') AFTER the preset (presets flip enables); (3) window._lab.state.distance = 8 for the global coastline/coverage read, then 2.5 for full lodRamp (ramp = smoothstep(20,6,dist); wheel range 1.1-30 radii) to judge shoreline cut, flat-liquid normals, and glint; (4) window._lab.setPreset('Titan (methane seas)') + re-solo for the methane/ethane variant (uLiquidSpecies=1) and any dry-playa driver state. Verify programmatically: window._lab.featureEnabled('lakes') === true and window._lab.uniforms.uLiquidMask.value > 0 over a sea-bearing preset.

## 6. What to judge (UAT checklist)

- [ ] Does the land/sea boundary read as a crisp coastline contour (a level-set cut in the height field) in the 6-level posterized envelope — not a fuzzy albedo gradient or noise speckle?
- [ ] Does the liquid surface read as FLAT — smooth geometric-normal shading with no relief dither texture — against the perturbed, dithered land, so 'liquid' is legible from form alone?
- [ ] Does the sea read as ponded in low ground — flooding fluvial channels and enclosed basins into Titan-like lobate, drowned-valley coastlines — rather than a mask splattered independently of the terrain?
- [ ] Does the sun glint read as a sharp, localized bright star/lobe near the specular point via the bypass channel, instead of a banded posterized smear?
- [ ] Does the species/variant switch read as behavior: water = dark cool fill with glint, methane/ethane = darker warm fill against bright icy terrain, dry playa = bright dead-flat lakebed with zero glint occupying the same basin form?
- [ ] Does coverage scale by type: ocean preset = near-global liquid with sparse island chains, terrestrial = continents + seas, eyeball = a concentric substellar liquid disk ringed by ice?
- [ ] Across the lodRamp, does approach add only coastline sharpness and glint definition — no new hue noise, no popping of the sea boundary?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
