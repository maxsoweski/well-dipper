# Feature Card — F16 Dust mantles
Domain: Aeolian · Lab status: ⬜ · Build-seq phase: 4a

## 1. Description (WHAT)

F16 Dust mantles (Aeolian family, F-gradational table): blankets of settled fine dust that drape and smooth underlying relief. Variants: thin veneer (underlying forms ghost through) · deep loess (meters-thick fallout deposit that erases small relief into smooth plains) · butterscotch haze tint (the permanent suspended-dust veil that warms all surface light). Physical chain — L1 P9 Aeolian transport ("wind... lays dust mantles") needs D5 atmosphere density (air to move grains), D8 rotation/circulation, a dry surface (low liquid) and D14 gravity; L1 P23 Aerosol/dust lofting (wind stress + dust devils loft dust; settling leaves a permanent haze veil) supplies the fallout and the tint. Real-body anchor: the Mars dust mantle — talcum-fine global dust cover, the smooth ice-cemented latitude-dependent mantle at 30–60°, and the ~32 m loess-like Middle Amazonian deposit in the northern lowlands. WD archetype targets: terrestrial, venus, ice, rocky. Status in inventory: [aspirational].

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). The lab already reserves its slot: planet-lod-lab.html:1524 is the Stage-5 AEOLIAN placeholder comment — "dust mantle SMOOTHS relief (runs AFTER stage 2)" — and planet-lod-lab.html:2496 notes "Future F12–F16 land here too. Top-level guiRight folder per the F11 spec." No `dust` key exists in the FEATURES registry (planet-archetypes.js:6-22) and no dustCombiner/uDust* uniforms exist. Nearest existing machinery it should plug into: lavaCombiner (planet-lod-lab.html:1099-1119) is the exact relief-suppression precedent — `h *= (1.0-region); grad *= (1.0-region)` attenuation by a low-freq noised() region mask, run late in the combiner chain (chain at :1500-1513); the Stage-6 frost albedo overlay (`mix(uBaseColor, frostShade, frostCover)` before posterize, ~:1543-1548) is the precedent for the ochre albedo lift; and the Stage-8 "CLOUDS & HAZE — haze muting runs BEFORE final posterize; AEOLIAN F40 storm veil" slot is where the butterscotch haze tint belongs.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/photojournal/dust-mantled-topography-near-zephyria-tholus/
  — How a thick dust drape mutes crisp volcanic relief into soft, rounded forms — the exact 'smoothing' read F16 must produce.
- [real] https://www.jpl.nasa.gov/images/pia18775-mantled-terrain-in-the-southern-mid-latitudes/
  — Mid-latitude smooth mantle in varying states of degradation — thin-veneer vs eroded patches as a continuum, not a binary mask.
- [real] https://science.nasa.gov/photojournal/mars-before-and-after-dust-storm/
  — Whole-disk before/after: settled+suspended dust homogenizes the planet into one warm ochre tone — the global haze-tint end state.
- [real] https://pubs.usgs.gov/publication/70135621
  — The 'deep loess' variant grounded: a ~32 m thick loess-like fallout deposit blanketing 3.1M km² of the northern lowlands.
- [real] https://www.webexhibits.org/causesofcolor/14C.html
  — Why the tint is butterscotch — dust absorbs blue and scatters the rest, so the haze warms ALL light, not just the ground color.
- [art] https://www.artstation.com/artwork/WK621J
  — Stylized desert-planet concept: dust read carried by big soft value masses and a warm unified palette, no fine texture.
- [art] https://helianthus-games.itch.io/pixel-art-planets
  — Pixel-art planet pack with desert/Martian variants — dust mantles expressed in a handful of posterized ochre bands, our quantization regime.
- [art] https://itch.io/games/tag-mars/tag-pixel-art
  — Gallery of pixel-art Mars treatments — survey how low-color-count games sell 'dusty' via brightness banding and muted contrast.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology models dust mantling as near-uniform atmospheric fallout plus hillslope diffusion: settling flux is roughly constant over a region, so a thin mantle drapes topography conformally while a deep mantle acts diffusively (∂h/∂t = D∇²h + deposition), erasing high-frequency relief first; accumulation anti-correlates with wind shear and slope (dust survives on flats and lows, gets stripped from steep windswept faces), and on Mars the latitude-dependent mantle adds a clean latitude gate (smooth, high-albedo, ice-cemented dust at 30–60° both hemispheres). Games model this exactly like snow-coverage shaders: a coverage scalar from slope + altitude + latitude masks, normals flattened toward the underlying smooth surface, albedo lerped toward the mantle color. In the research doc's vocabulary this is a `survives / low-cost` feature precisely because it REMOVES high-frequency normal detail rather than adding albedo gradients — "route detail through normals, not color" applies in reverse: less normal perturbation = fewer dither transitions = a visibly smoother posterized surface. The depth mask is a low-freq noised() FBM region (lavaCombiner pattern) weighted by inverse slope using the already-accumulated grad — literally the slope-damped FBM trick `1/(1+dot(grad,grad))` repurposed as a settling weight; the albedo lift is a pre-posterize mix (frost-overlay pattern) so the luminance change survives quantization; the butterscotch veil is a pre-posterize color muting in the Stage-8 haze slot. Most promising shader-side approach: a dustCombiner late in the relief chain (after fluvial/cryo, before or beside lavaCombiner) that attenuates h and grad by depth·flatness — `atten = uDustDepth * region * 1/(1+k·dot(grad,grad))`, `h *= (1-atten); grad *= (1-atten)` — paired with a Stage-6 `mix(albedoCol, uDustAlbedo, atten·0.x)` ochre lift and a Stage-8 whole-disk butterscotch muting scaled by a fraction of uDustDepth. One driver uniform (uDustDepth, derived from D5 atmosphere density × surface dryness × erosion history) runs all three channels so veneer→loess→haze is a single continuum.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built. Register in planet-archetypes.js FEATURES as `dust: { label: 'Dust mantles (F16)', enableKey: 'dustEnabled', archetypes: ['tectonic-terrestrial', ...] }` (mirroring the F11 `rivers` entry). Then, in the :9223 debug Chrome (chrome-devtools MCP, per well-dipper-testing-reference.md), open planet-lod-lab.html and run: (1) `window._lab.setPreset('Rocky (Earthlike)')` — the dry-terrestrial preset with retained atmosphere (D5) and erosion 0.4, best Mars-analog available; (2) `window._lab.solo('dust')` and confirm with `window._lab.featureEnabled('dust') === true`; (3) `window._lab.state.distance = 6` for the full-lodRamp mantle-smoothing read (lodRamp = smoothstep(20,6,distance), so 6 = fully ramped in); (4) `window._lab.state.distance = 2.5` for the veneer-vs-loess close read while sweeping the dust-depth GUI slider 0→1; (5) `window._lab.state.distance = 20` to confirm the whole-disk ochre/butterscotch haze read at far range. A/B against the base: `window._lab.enableAllFeatures()` then toggle `dustEnabled` and verify relief returns exactly at depth 0.

## 6. What to judge (UAT checklist)

- [ ] Does the mantled region read as softened relief in the 6-level posterized envelope — craters/ridges visibly muted, with fewer dither-band transitions across mantled slopes than bare ones?
- [ ] Does veneer→loess read as one continuum as dust depth rises: forms ghosting through at low depth, erased into smooth plains at high depth — never a binary on/off?
- [ ] Does dust read as settling behavior — accumulating on flats and lows, thinning on steep faces — rather than a uniform coat painted over everything?
- [ ] Does the ochre albedo lift survive posterize as a distinctly brighter/warmer band, instead of collapsing into the same quantization bin as bare rock?
- [ ] Does the butterscotch tint read as airborne haze (whole-disk warm muting of the lit limb and terminator) rather than a surface paint on the ground?
- [ ] Does the mantle margin read as a gradational fade, with no posterize-amplified hard contour line where the region mask cuts off?
- [ ] With the feature soloed off or depth at 0, does the underlying accumulated relief return exactly — regression-safe attenuation like lavaCombiner's?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
