# Feature Card — F26 Latitude weather bands (terrestrial)
Domain: Bands · Lab status: 🟡 · Build-seq phase: 4b

## 1. Description (WHAT)

Latitude weather bands on terrestrial-class worlds (domain: Bands, status `[current]` in production, pending in lab — tracker stage 4b). Derives from P20 meridional circulation: Hadley/Ferrel/polar cells plus ITCZ/monsoon convergence set wet/dry latitude belts and migrating storm bands on terrestrials (planet-visual-features.md:166, F26 row :261). Variants: Hadley/Ferrel zonation (alternating cloudy storm-track belts at ~30-60° and clear subtropical gaps) and the ITCZ/monsoon convergence band (a single bright, broken equatorial cloud band that migrates seasonally). Drivers per P20: D1 equilibrium temperature, D3 axial tilt (seasonal ITCZ migration), D8 rotation rate (cell count — slow rotators collapse to one equator-to-pole cell, fast rotators multiply bands), D5 atmosphere density, D2 volatile budget. Intensity scale: "faint zonation … crisp multi-zone bands." Real-body example: Earth (the ITCZ as the white equatorial cloud band in GOES/EPIC imagery; mid-latitude storm tracks as swirling belts at cell edges). WD types: terrestrial, ocean, eyeball — distinct from F24 gas-giant zonal belts because here the bands are a cloud/moisture pattern over a visible ground, not the visible surface itself; on eyeball worlds the circulation reorganizes around the substellar point instead of the spin axis.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) in planet-lod-lab.html — no FEATURES registry key in planet-archetypes.js and the lab's Stage 8 cloud layer is latitude-blind uniform FBM: `fbmd(vPos*1.7 + time)` thresholded by uCloudCoverage (planet-lod-lab.html:1560-1564; uniform declared :168, value :1617). The doc's `[current]` status reflects PRODUCTION code, which is the build's reference implementation: src/objects/Planet.js:588-610 (planetType==5 branch — `lat = abs(vPosition.y)/planetRadius`; three lobes: ITCZ Gaussian `exp(-lat²/(2·0.08²))*0.6`, storm-track Gaussian centered 0.55 width 0.15 `*0.8`, polar `smoothstep(0.65,0.85,lat)*0.4`; summed latBias added into a domain-warped 3-octave snoise cloud mask as `cn + latBias*0.3`), duplicated in src/rendering/shaders/TexturedBodyShader.js:289-308 (cloudStyle==1), with the surface-side analog in src/rendering/TextureBaker.js:368-390 (Hadley-cell latMoisture curve — ITCZ wet belt, subtropical dry dip at lat≈0.27, temperate recovery at 0.50, polar decline — baked into biomes). Nearest lab machinery to plug into: the Stage 8 cloud slot itself, plus the frost stage's smooth-latitude pattern `sinLat = normalize(p).y` (:1389) and the uFrostLatitudeBias axial-tilt driver (:287, :1719) for D3 coupling.

## 3. Reference images (real + art)

- [real] https://earthobservatory.nasa.gov/images/703/the-intertropical-convergence-zone
  — GOES full-Earth view: the ITCZ as a single bright cloud band cutting across the equator — broken into storm clumps, never a clean drawn line.
- [real] https://earthobservatory.nasa.gov/images/2628/twin-convergence-zones
  — Rare double-ITCZ — the convergence band is a dynamic feature that can split and migrate, not a fixed latitude circle.
- [real] https://science.nasa.gov/earth/earth-observatory/earths-clouds-on-the-move-154443/
  — DSCOVR/EPIC full-disk: storm clouds cluster at the EDGES of the Hadley/Ferrel/polar cells — bands are where winds converge, with clear subtropical gaps between.
- [real] https://svs.gsfc.nasa.gov/11501
  — NASA SVS Hadley Cell Circulation visualization — the three-cell-per-hemisphere skeleton our latBias curve abstracts (rising air = cloud belt, sinking air = clear belt).
- [real] https://epic.gsfc.nasa.gov/
  — Daily EPIC full-disk gallery — at our gallery viewing distance Earth's zonation reads as subtle: equatorial band + mid-lat swirl trains, subordinate to continents.
- [art] https://deep-fold.itch.io/pixel-planet-generator
  — Canonical pixel-art planet shader: dithered, palette-quantized terrestrial clouds drifting in loose latitude streaks — proof the band-over-ground read survives heavy quantization.
- [art] https://mr-sim.itch.io/procedural-planet-shader
  — Stylized procedural earthlike shader — how cloud banding stays legible when clouds are a flat bright value over a colored ground.
- [art] http://3dworldgen.blogspot.com/2015/01/procedural-universe-and-planet.html
  — 3DWorld procedural planets — single-pass shader planets where terrestrial cloud structure and gas-giant banding are deliberately distinct looks.

## 4. Math / modeling notes (HOW, from the field)

Academia: atmospheric science models this as meridional overturning cells (Held-Hou theory for the Hadley cell; the ITCZ tracks the thermal equator and migrates seasonally with obliquity D3). The controlling parameter for band COUNT is rotation rate (D8): slow rotators (Titan/Venus regime) collapse to a single equator-to-pole cell → one vague band; fast rotators shrink the Rhines scale → more, tighter cells. Exoplanet GCMs show tidally-locked (eyeball) worlds reorganize circulation around the substellar point — which is why the lab already shares vSubstellarAngle (planet-lod-lab.html:135). Games/procedural: nobody runs a GCM — the standard trick (used by our own production code and by Deep-Fold-style generators) is a latitude-indexed analytic bias curve: a sum of Gaussians in |lat| (ITCZ peak, storm-track peak, subtropical trough, polar term) added into a noise threshold so cloud FBM preferentially exceeds coverage in wet belts. In the research doc's vocabulary this is the terrestrial sibling of "latitude-banded FBM" (§3.2): bands sampled at `latitude + warpStrength*warp` via recursive domain warp so belt edges break into fronts instead of reading as drawn-on latitude circles, "clouds-as-relief" so density feeds the lighting term (lighting-routed detail survives the Bayer posterize; flat albedo tinting gets crushed), optional curl-noise advection with bounded time for drift, and terminator cloud shadowing for grounding. Most promising shader-side approach: add a latBias(sinLat) term — 2-3 Gaussians whose count/width derive from D8 rotation and whose ITCZ center shifts with D3 tilt (reuse the uFrostLatitudeBias pattern), switching the latitude coordinate to vSubstellarAngle on eyeball worlds — into the existing Stage 8 fbmd cloud threshold, then recursive-domain-warp the latitude input so band edges shred into storm fronts. Route the result through cloud-as-relief shading (density modulates the lit value, not hue) so the bands survive the 6-level posterize as dither texture.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built: register in planet-archetypes.js FEATURES as `weatherBands: { label: 'Weather bands (F26)', enableKey: 'weatherBandsEnabled', archetypes: ['tectonic-terrestrial'] }`. Then on the :9223 lab (per memory/chrome-devtools-9223-launch.md + well-dipper-testing-reference.md): (1) load planet-lod-lab.html, (2) apply preset 'Rocky (Earthlike)' — or 'Ocean (temperate)' for the band-over-sea read, (3) `window._lab.solo('weatherBands')`, (4) judge at `window._lab.state.distance = 12` (full-disk band layout: ITCZ + storm tracks + clear gaps; distance is in radii, clamped 1.1-30), then `window._lab.state.distance = 4` (band-edge breakup into fronts under the LOD ramp), and `window._lab.state.distance = 2` (individual storm-cell texture). Also flip to the eyeball/locked configuration (uFrostLatitudeBias-style D3 driver at max, or the eyeball preset if present) to verify the substellar-axis reorganization.

## 6. What to judge (UAT checklist)

- [ ] Does the ITCZ read as a single bright BROKEN band hugging the equator — clumped storm cells in the dither, not a clean drawn-on line — in the 6-level posterized envelope?
- [ ] Do mid-latitude storm tracks read as separate swirling belts around 30-60° with a visibly CLEAR subtropical gap between them and the equatorial band?
- [ ] Do band edges shred into fronts and curls (domain-warp behavior) rather than running as straight latitude circles — the killer 'painted stripes' tell?
- [ ] Do the bands read as weather floating OVER a visible ground/ocean (terrestrial identity), never as the surface itself — i.e., is F26 instantly distinguishable from F24 gas-giant belts?
- [ ] Does cloud density survive as dither texture (self-shaded relief gradient) instead of crushing to flat white blobs or vanishing into the ground's posterize levels?
- [ ] Does band structure respond plausibly to drivers — more/tighter bands on fast rotators, one vague band on slow rotators, ITCZ shifted off-equator under high axial tilt?
- [ ] On eyeball worlds, does the banding reorganize around the substellar point (rings/convergence toward the pupil) rather than the spin axis?
- [ ] At full-disk distance does zonation stay SUBORDINATE to continents (Earthlike subtlety), while close-up reveals individual storm clusters along the convergence lines?

## 6.5 Build plan (working-Claude, 2026-06-10 — Phase 4b heavy loop)

The terrestrial sibling of F24: a latitude-indexed analytic bias curve added into the EXISTING Stage-8 cloud threshold (the production Planet.js:588-610 three-lobe reference), with the latitude input recursively domain-warped so belt edges shred into fronts. Cloud/albedo only — the bands are weather OVER the ground, never the surface.

1. **Data:** FEATURES `weatherBands` { label 'Weather bands (F26)', enableKey 'weatherBandsEnabled', archetypes ['tectonic-terrestrial'] } (card §5 verbatim; Titan still gets driver-active bands — archetype only filters the GUI). PROVINCES `weatherBands` { field: 2, polarity: +1, floor: 1.00 } neutral (climate). PROV_WEATHER = 24 + GLSL row + GLSL_NAME line.
2. **GLSL — latBias(lat):** three lobes from the production reference: ITCZ Gaussian exp(−(lat−shift)²/(2·0.08²))·0.6 (center shifted by uWeatherItczShift, the D3 term), storm-track Gaussian at ±0.55 width 0.15 ·0.8, polar smoothstep(0.65,0.85,|lat|)·0.4; implicit subtropical trough between lobes. Cell spacing scales with uWeatherCells (D8): storm-track center ≈ 0.55·(3/cells)… keep v1 simple — cells slider scales the storm-track Gaussian's center+width pair.
3. **GLSL — front shredding:** warp the latitude input before latBias: lat' = sinLat + uWeatherWarp·(fbm warp, reuse the bandWarpField pattern at its own offset/frequency) — band edges become fronts, not drawn circles (§6 item 3).
4. **Eyeball switch:** latCoord = mix(sinLat-axis, substellar-axis coordinate (vSubstellarAngle remapped), uWeatherLocked) — driven, locked×hasAtmo. No current preset exercises it; verify by a manual uniform poke, log as deferred-to-profiles.
5. **Hook (Stage 8, regression-safe):** current term is `cloud = smoothstep(0.15, 0.5, cw.x) · uCloudCoverage · (diff+0.05)`. F26 adds INSIDE the threshold input: `cw.x + uWeatherStrength · (latBias(lat')·0.45 − 0.12)` — wet belts push the FBM over threshold, the −0.12 dries the troughs below baseline (clear subtropical gaps, §6 item 2). uWeatherStrength 0 ⇒ argument identical ⇒ byte-identical cloud layer (regression contract). Density stays lighting-routed via the existing (diff+0.05) factor — survives posterize as dither (§6 item 5).
6. **Drivers (applyDrivers):** weatherStrength = NOT _gas AND atmosphere retained ? smoothstep-scaled by the preset's rain factor (n2-o2 1.0 / co2-n2 0.5 / co2 0.2) : 0 — Rocky/Ocean/Titan get bands, Lava/Frozen/Europa/gas get 0 (pre-check all 9). weatherCells from rotationHours (24h → 3); itczShift from u.frostLatitudeBias (the existing D3 proxy) ·0.25; weatherLocked = locked && retained. weatherOffset 🎲 reset.
7. **Wiring:** uniforms uWeatherStrength/uWeatherCells/uWeatherItczShift/uWeatherLocked + lab knobs uWeatherWarp/uWeatherDry; state, per-frame gated writes, GUI folder 'Weather bands (F26)' (new group 'Atmosphere — Weather' or under Bands group — follow the existing group layout), featureFolders.

v1 scope cuts: seasonal ITCZ migration (animated D3) → static shift only; curl-advected storm cells → F28/F31; cloud terminator shadows → F31; double-ITCZ variant → out; eyeball preset → Phase 6 profiles.

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
