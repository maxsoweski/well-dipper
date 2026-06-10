# Feature Card — F48 City lights
Domain: Overlay · Lab status: ⬜(lab) · Build-seq phase: 4c

## 1. Description (WHAT)

F48 "City lights" (Overlay/EXOTIC family): warm artificial lighting on a planet's nightside, the visible signature of P28 Technospheric development — a civilization building out over civilizational time (D16 surface age), gated by D15 habitability, expressed on the dark hemisphere via D7 day/night geometry. Intensity axis runs the full P28 ramp: scattered cities → continuous coastal/urban bands → lit-nightside saturation (the F49 ecumenopolis end-state is "whole-surface glow + circuit grid"). The inventory's L1 design note (planet-visual-features.md:188-198) mandates base-type + overlay-layer compositing: the terrestrial base's oceans, weather, and relief must still show through wherever the overlay doesn't cover. Variants per the F48 row (planet-visual-features.md:336): "scattered cities … continuous urban band; lit nightside." Real-body example: Earth at night (nascent — Earth is the sparse start of the axis). WD types: the `city-lights` archetype (F48 over a terrestrial base, planet-visual-features.md:375) and `eyeball` (nightside cities on a tidally-locked world, :368 — civilization lights the permanently dark hemisphere).

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) in planet-lod-lab.html — F48 exists only as a reserved slot: the ★ emissive-channel header comment lists "city lights F48/49" as an owner of the posterize-bypass channel (planet-lod-lab.html:1572-1574), and Stage 7 "EXOTIC overlay" is an explicit placeholder (:1554-1556, "maturity→0 must reveal the bare stage-6 base — the overlay-correctness test"). Nearest existing machinery it plugs into: (a) the emissive bypass terms after the quantizer split — uEmissive/uEmissiveBypass (:1576-1578) and lavaCrackEmissive (:1581), the canonical Option-C survivors; (b) aurora's nightside gate `nightMask = smoothstep(0.1, -0.1, diff)` (:1592); (c) the existing landMask/albedo chain in Stage 6. Note: the inventory marks F48 `[current]` because the LEGACY production renderer implements it — src/objects/Planet.js:918-931 (planetType 16: multi-octave snoise cityMask × landMask × coastBoost × nightMask, warm vec3(0.95,0.75,0.3)) and :934-948 (type 17 ecumenopolis: fract-grid glow × per-district hash × nightMask), with habitability/HZ gating in src/generation/PlanetGenerator.js (types declared :37-45, spawn gating ~:495-518, :723). The lab version is a port-and-upgrade of that proven recipe into the envelope pipeline, not a from-scratch invention. No GUI folder or uniforms exist yet in the lab; planet-archetypes.js FEATURES (:6-22) has no city/overlay entry.

## 3. Reference images (real + art)

- [real] https://svs.gsfc.nasa.gov/30876/
  — NASA SVS Black Marble 2016 global composite — lights form filamentary networks along coasts and river valleys with bright nodes, not uniform speckle; oceans and deserts stay black.
- [real] https://science.nasa.gov/earth/earth-observatory/night-lights-2012-the-black-marble-79803/
  — The original Black Marble (Suomi NPP VIIRS) — at whole-disc distance cities read as a few bright clusters plus dim connective tissue; this is the 'nascent' start of the F48 intensity axis.
- [real] https://science.nasa.gov/earth/earth-observatory/cities-at-night-the-view-from-space/
  — NASA Earth Observatory ISS night-city gallery — at close range cities resolve into grid/radial street filaments around a saturated core, the structural target for LOD2.
- [real] https://www.nasa.gov/image-article/paris-night/
  — Paris from the ISS — radial-spoke street grid dominating at night, warm sodium-amber core vs cooler periphery; note the hue is warm, not white.
- [art] https://akikun.wordpress.com/procedural-city-lights-shader/
  — Procedural city-lights shader (Blender) — two-scale decomposition: bright 'big city' spots plus a dim web of small towns; exactly the two-octave mask structure that survives posterization.
- [art] https://planetpixelemporium.com/tutorialpages/earthlight.html
  — Planet Pixel Emporium city-lights tip — the classic game-rendering trick of masking the lights layer to the night hemisphere so it never bleeds into daylight.
- [art] https://www.artstation.com/artwork/4NDP64
  — Coruscant early concepts (Gabriel Yeganyan, ArtStation) — the ecumenopolis end-state: continuous engineered glow with district-scale brightness variation, the saturation end of the P28 ramp.

## 4. Math / modeling notes (HOW, from the field)

Real-world structure (remote sensing): VIIRS Day/Night Band radiance scales with population density over ~3 orders of magnitude, and the rank-size distribution of lit settlement clusters follows a power law with exponent near −2 (Zipf-like: few bright megacity cores, many dim villages — see the night-light-networks literature, e.g. Small et al.'s spatial network analyses). Lights concentrate at coasts, river valleys, and lowlands; at city scale they resolve into grid/radial filaments along transport corridors. Games/sims model this as an emissive layer gated by 1−Lambert: `nightMask = smoothstep(ε, −ε, dot(N, L))` so lights fade through twilight (the legacy WD shader, Planet.js:920, already does this). Procedurally, the field's standard recipe is a settlement-suitability scalar (land × low elevation × coast proximity × habitability) thresholded by two noise octaves — matching the legacy cityMask = smoothstep(0.2,0.6, snoise×8 + 0.5·snoise×16) × landMask × coastBoost. A Worley upgrade gives more Earth-like structure: F1 cell-center distance → city cores with radial falloff; F2−F1 ridges → highway-filament connections between cores (same Worley vocabulary as the research doc's lava-cracks row, RESEARCH_high-lod-planet-shaders-2026-06-05.md:103); per-cell hash → which cells are settled, with the settled fraction driven by P28 maturity. In the WD envelope this is a textbook Option-C citizen: the research doc's quantizer split (§Option C, :52-57) exists precisely for crisp glows that look wrong when banded, and high-contrast point-like warm emission has the best posterization survival of any color-borne detail. Most promising shader-side approach: build a suitability field from the existing landMask + coast-distance + a 2-octave noise threshold (or Worley cores+filaments), gate it with aurora-style nightMask, and add `vec3(0.95,0.75,0.3) × cityMask × coastBoost × nightMask × uCityIntensity` into the ★ emissive channel after the posterize split (planet-lod-lab.html:1572), bypassing the quantizer like lavaCrackEmissive. One maturity uniform (P28) sweeps the threshold + per-cell settled fraction from scattered specks → coastal bands → the F49 grid; maturity 0 must leave the Stage-6 base untouched (the overlay-correctness test at :1556).

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built: (1) Register in planet-archetypes.js FEATURES as `cityLights: { label: 'City lights (F48)', enableKey: 'cityLightsEnabled', archetypes: [...] }` — this auto-creates the per-feature GUI solo button and makes `window._lab.solo('cityLights')` work (the solo plumbing already exists: planet-lod-lab.html:2563 and :2908 `solo(key){ setFeatureEnables(key); }`). It needs a new EXOTIC/overlay archetype entry (e.g. 'technospheric') since none of the five existing archetypes (:26-32) covers P28. (2) In the :9223 debug Chrome (chrome-devtools MCP, per well-dipper-testing-reference.md), load the lab, pick preset 'Rocky (Earthlike)' (habitability 0.7) or 'Ocean (temperate)' (0.9) — the two terrestrial bases the overlay composites over. (3) `window._lab.solo('cityLights')`. (4) Rotate yaw so the terminator crosses mid-disc (lights live on the dark side; judging happens at and behind the terminator). (5) Distances via `window._lab.state.distance =`: 20 (whole-disc — do clusters read at all?), 12 (disc — coastal-band structure), 4 (terminator close-up — twilight fade), 2 (LOD2 — settlement filament/grid structure). (6) Sweep the P28 maturity uniform 0→1 and confirm maturity 0 exactly reproduces the bare Stage-6 base (overlay-correctness test).

## 6. What to judge (UAT checklist)

- [ ] Does the nightside read as scattered point-like settlements clustering into a few bright cores with dim connective filaments — a power-law hierarchy, not uniform noise speckle — in the 6-level posterized envelope?
- [ ] Do the lights read as hugging coastlines and lowlands (brighter band where land meets ocean), so the overlay visibly respects the base world's landMask?
- [ ] Do lights behave as nightside-only: fully absent in daylight, fading smoothly through terminator twilight rather than hard-cutting at the day/night line?
- [ ] Does the warm amber glow stay crisp against the dithered dark surface — a clean emissive-bypass read with no quantization banding halos around bright nodes?
- [ ] Does the P28 maturity sweep read as a coherent civilizational ramp: sparse specks → connected coastal/urban bands → grid-saturated lit nightside (F49 territory)?
- [ ] At maturity 0 (and everywhere on the dayside), does the bare terrestrial base render unchanged — does the overlay behave as an overlay, with oceans/weather/relief showing through?
- [ ] At whole-disc distance (12-20 radii), does the nightside still read as 'inhabited' via a handful of bright nodes rather than dissolving into the Bayer dither floor?
- [ ] On an eyeball preset, do lights sit plausibly on the habitable terminator ring / dark hemisphere rather than ignoring the locked day/night geometry?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
