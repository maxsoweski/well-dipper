# Feature Card — F24 Zonal belts & zones
Domain: Bands · Lab status: 🟡(game) · Build-seq phase: 4b

## 1. Description (WHAT)

Zonal belts & zones (family F-bands — atmospheric banding, the visible "surface" of gas worlds). Derives from P16 zonal banding: differential heating plus fast rotation (D8, PlanetGenerator.js:659-665) organize deep convection into alternating prograde/retrograde latitude bands — condensation brightens zones (anticyclonic upwelling, fresh high cloud), subsidence clears and darkens belts (cyclonic, deeper warmer cloud showing through). Drivers: D8 fast spin, D5 atmosphere density, interior heat, D1 insolation. Variability signature: permanent, but bands drift/fade over years. Intensity axis: faint 2-3 bands → high-contrast many-banded. Variants: high-contrast many-banded (Jupiter), soft few-banded (Saturn), bland blue disc + sparse CH4 clouds (ice giant — Neptune, Uranus). WD types: gas-giant, sub-neptune, hot-jupiter. Inventory status `[current]` (gas-giant) — but that refers to the legacy production shader, not the lab.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) in planet-lod-lab.html — the lab is solid-surface/terrain only: the FEATURES registry (planet-archetypes.js:6-22) has no gas archetype and DRIVER_PRESETS (planet-lod-lab.html:2149-2154) has no gas-giant preset; the only "belt" hits in the lab are unrelated orogeny fold-belts (planet-lod-lab.html:574-576). The inventory's `[current]` status points at the LEGACY production shader: src/objects/Planet.js GAS_BODY fragment (const at :248). Pattern (getSurfacePattern, :249-264): three stacked sin(lat) harmonics at frequencies 3.5/7.0/13.0 plus 2-octave snoise turbulence weighted by (1.0-abs(bands)), plus a pow(snoise,4) storm term. Coloring (:296-306): zoneMask smoothstep(0.42,0.58) mixing baseColor↔accentColor, stormMask smoothstep(0.78,0.88) toward a reddish stormColor, polar darkening via smoothstep on abs(y)/radius. Hot-jupiter (:266-271) and sub-neptune (:278-282) are lower-amplitude sin variants. No domain warp, no jet drift, no D8-derived band count. Nearest lab machinery to plug into: the driver→semantic-uniform scaffolding — deriveUniforms (planet-lod-lab-core.js, called from applyDrivers at planet-lod-lab.html:2163-2164) deriving uBandCount/uBandContrast from a new gas preset's D8/D5/D1, plus a new FEATURES entry and a banded-FBM combiner dispatched like the existing per-feature combiners.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-cylindrical-map/
  — Cassini PIA07782 cylindrical map of Jupiter — canonical band count, relative band widths, and zone-vs-belt value contrast laid out flat.
- [real] https://www.jpl.nasa.gov/images/pia26077-nasas-juno-mission-images-jupiters-belts-and-zones/
  — Juno close view of belts and zones — band EDGES are scalloped, festooned, and turbulent, never ruler-straight; that irregularity is what sells fluidity.
- [real] https://science.nasa.gov/missions/hubble/hubbles-grand-tour-of-the-outer-solar-system/
  — Hubble OPAL grand tour — Jupiter/Saturn/Uranus/Neptune side by side: the full variant spread from high-contrast many-banded to soft few-banded to bland blue with a polar hood.
- [art] https://medium.com/@barth_29567/procedural-gas-giants-f2a61bc6bd97
  — Paleologue procedural gas giants — the exact vertical-stretch FBM + recursive domain warp recipe; note how warp strength alone moves bands from striped to fluid.
- [art] http://johnwhigham.blogspot.com/2011/11/gas-giants.html
  — Whigham gas giants — latitude indexes a small palette ramp, storms packed in a cubemap; stylized few-color bands that still read as Jovian.
- [art] https://deep-fold.itch.io/pixel-planet-generator
  — Deep-Fold pixel planet generator — dithered, posterized gas giants in a handful of palette levels; the closest existing match to our 6-level Bayer envelope.
- [art] https://smcameron.github.io/space-nerds-in-space/gaseous-giganticus-slides/slideshow.html
  — Gaseous Giganticus slides — curl-noise particle-advected band textures; the upper bound for what 'earned' fluid band edges look like (offline bake, not our runtime path).

## 4. Math / modeling notes (HOW, from the field)

Physics: fast rotation makes the Coriolis term dominate, organizing convection into alternating east-west jets; band count scales with rotation rate via the Rhines scale (Jupiter ~30 jets, Saturn fewer/softer, ice giants ~3 broad jets), so D8 is the natural CPU-side driver for band count and D1/temperature for contrast (cold CH4-haze giants go bland blue). Zones = anticyclonic upwelling = bright fresh condensate; belts = cyclonic subsidence = darker deep cloud — i.e. the visual is fundamentally a LUMINANCE alternation, which is exactly what the research doc says survives the retro envelope ("gas-giant bands... survive because they're high-contrast luminance"). Procedural practice (research/RESEARCH_high-lod-planet-shaders-2026-06-05.md §"Latitude-banded FBM", low risk, survives): compress the sampling domain vertically (p.y *= ~2.5) before FBM so noise streaks horizontally; index a small palette ramp by latitude; per-band longitudinal scroll with alternating sign gives counter-rotating jets. The doc's highest-leverage "bands → fluid" trick is recursive domain warp (q=fbm(p+o); r=fbm(p+4q+o); fbm(p+4r)) sampled at latitude + warpStrength*warp (~2.0); storms come later (F27/F28) via hash-placed storm-mask + rotational swirl; live flow later still via two-phase flow-map / curl advection (needs the sphere-tangent-frame spike the doc flags). Most promising shader-side approach: the doc's gas-giant LOD2 stack verbatim — latitude-banded FBM (vertical stretch) + recursive domain warp, with band count/contrast/warp derived CPU-side from D8+D5+D1 into semantic uniforms (uBandCount, uBandContrast, uWarpStrength) per the lab's deriveUniforms precedent, swapping the combiner not the noised() core. Route all band structure through luminance levels so the 6-level Bayer posterize runs unchanged on top; no relief — this is an albedo/value feature, the one family exempt from the displacement pipeline.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built: (1) add a FEATURES entry in planet-archetypes.js, key `bands` (label 'Zonal belts (F24)', enableKey 'bandsEnabled'), under a new 'gas-giant' archetype; (2) add a 'Gas giant (Jovian)' DRIVER_PRESETS entry (fast rotation, h2-he atmosphere, no surface) in planet-lod-lab.html. Then on the :9223 chrome-devtools Chrome (chrome-devtools-9223-launch.md): open the lab page, run `window._lab.setPreset('Gas giant (Jovian)')`, `window._lab.solo('bands')`, then judge at `window._lab.state.distance = 20` (full disc: band count, contrast, variant identity), `= 5` (band-edge festooning from the domain warp), and `= 1.5` (close deck: warp texture inside a single band, dither granularity). Verify with mcp__chrome-devtools__take_screenshot, and A/B variants by also adding soft-banded (Saturn-like, lower uBandContrast) and ice-giant (low count, blue, near-bland) presets via `window._lab.setPreset(...)`.

## 6. What to judge (UAT checklist)

- [ ] Do alternating light zones and dark belts read as parallel latitude bands wrapping a 3D sphere — curving with the limb, foreshortening toward the poles — in the 6-level posterized envelope, not as flat vertical stripes pasted on a disc?
- [ ] Do band edges read as fluid — scalloped/festooned irregularity from the domain warp — rather than ruler-straight sin() boundaries, at distance 5 and closer?
- [ ] Does the variant spread read distinctly: many narrow high-contrast bands (Jupiter) vs few soft wide bands (Saturn) vs near-bland blue disc (ice giant), purely from driver changes (D8/D1) and not hand-tuned per-preset hacks?
- [ ] Does band structure land on luminance-level transitions so the Bayer dither textures the boundaries — i.e. does the banding survive AS posterize steps rather than depending on hue shifts the envelope crushes?
- [ ] Do the poles read as a darkened cap rather than bands pinching into a convergence/singularity artifact?
- [ ] Is the pattern deterministic and stable on re-approach (zoom out to 30, back in to 1.5 — same bands in the same places), while still permitting slow longitudinal drift?
- [ ] At distance 1.5 inside one band, does the warped FBM still read as horizontally-sheared flow (streaks elongated along latitude) rather than isotropic blobby noise?

## 6.5 Build plan (working-Claude, 2026-06-10 — Phase 4b heavy loop)

Greenfield in the lab + new gas infrastructure the rest of 4b's gas features (F25, F27-F29) ride on. v1 = the research doc's gas-giant LOD2 stack verbatim: latitude-banded FBM (vertical stretch) + recursive domain warp, all structure routed through luminance. ALBEDO ONLY — no relief, no displacement.

1. **Data (planet-archetypes.js):** FEATURES `bands` { label 'Zonal belts (F24)', enableKey 'bandsEnabled', archetypes ['gas-giant'] }. New ARCHETYPES `'gas-giant'` { bodies ['Jupiter','Saturn','Neptune'], presets: the 3 below }. PROVINCES `bands` { field: 2, polarity: +1, floor: 1.00 } — NEUTRAL like frost (atmosphere, not geology).
2. **Presets (DRIVER_PRESETS):** 'Gas giant (Jovian)' (R 11.2, T_eq 125, rot 9.9h), 'Gas giant (Saturnian)' (R 9.4, T_eq 95, rot 10.7h), 'Ice giant (Neptunian)' (R 3.9, T_eq 55, rot 16.1h). Each MUST open with `radiusEarth:` (vitest preset regex). atmosphere { composition:'h2-he', retained:true, pressure high, color: tan / pale-gold / blue }. New optional `rotationHours` field (terrestrial presets omit it — derivation defaults inert). surfaceHistory zeros + resurfacing 1 so all relief driver-gates derive to 0.
3. **Drivers (in applyDrivers, F11 precedent — core.js untouched):** `_gas = _fp.atmosphere?.composition === 'h2-he'`. bandStrength = _gas ? 1 : 0 (master gate — all 6 existing presets derive 0, pre-check). bandCount ≈ clamp(round(12·radiusEarth/rotationHours), 3, 16) → Jovian ~14, Saturnian ~11, ice ~3 (Rhines-flavored: fast spin + big disc → more jets). bandContrast = 0.08 + 0.92·smoothstep(55,130,T_eq) → vivid Jovian, soft Saturnian, near-bland ice (cold CH4 haze). bandWarp = mix(1.0, 2.4, same ramp) (festooning tracks convective vigor). bandTint (vec3) = atmosphere.color. Reset bandOffset [0,0,0].
4. **GLSL:** uniforms uBandStrength/uBandCount/uBandContrast/uBandWarp/uBandTint + lab knobs uBandStretch (~2.5) / uBandLatPow. Band field: trueLat = asin(clamp(N.y,-1,1))·2/π; recursive warp q=fbm(p·s), r=fbm(p·s+4q) on a vertically-compressed domain; bandCoord = trueLat·bandCount + uBandWarp·(r−0.5); luminance = alternating zone/belt levels (smoothstepped triangle wave — lands on posterize steps), zone = bandTint lightened, belt = bandTint darkened+warmed. Polar darkening cap (smoothstep on |trueLat|), no pinch (bands keyed on latitude only). Hook at Stage 6: `albedoCol = mix(albedoCol, bandCol, bandMask)`, bandMask = uBandStrength · provinceWeight(PROV_BANDS); plus gas flattening `shadeN = mix(shadeN, N, uBandStrength)` right after perturbAnalytic (gas has no terrain lighting). PROV_BANDS = 22 + neutral if-chain row (floor 1.0) + GLSL_NAME one-liner in the test.
5. **JS/GUI:** state defaults; per-frame writes gated on bandsEnabled (uniform→0 when off); fBands folder — driven sliders .listen() (count/contrast/warp), lab knobs, 🎲 (bandOffset), ✓ enabled relocated LAST; featureFolders `bands: fBands`.
6. **Tuning pre-check:** log derived (strength,count,contrast,warp) across ALL 9 presets before settling constants — 6 terrestrial must read strength 0 (no leakage); 3 gas must hit the §6 variant spread.

v1 scope cuts (logged for the card): per-band counter-rotating drift → F25 (jets ARE that feature); storms → F27/F28; gas-preset interplay with leftover-enabled terrain features → Phase-5 integration (judging here is solo-based per §5); palette stays 2-tone zone/belt derived from atmosphere.color (no multi-band hue ramp).

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: **🟡 taste-call — VERIFIED_PENDING_MAX** (2026-06-10, Phase 4b heavy loop)
- Evidence (repo root, gitignored): `F24-jovian-d20.png` (full disc), `F24-jovian-d5-tune1.png` (festooned bands, post-tune), `F24-jovian-d1.5.png` (close deck), `F24-saturnian-d5.png` + `F24-icegiant-d5.png` (variant spread), `F24-ab-on/off/diff.png` (A/B: 8054 px changed, ALL inside the disc bbox — clean planetwide-albedo signature), `F24-stab-a/b.png` (zoom-cycle 20→1.5→30→20: **0 px changed** — deterministic, §6 item 6).
- §6 checklist: items 1/3/4/5/6 read 🟢 live. Item 2 (festooning) 🟢 after tune 1. Item 7 (close-deck sheared grain) 🟡 — present but subtle (grain factor 0.10·contrast·r; reads stratified, not blobby, but faint).
- Live driver verification: Jovian {strength 1, count 14, contrast 0.988, warp 0.545}, Saturnian {1, 11, 0.586, 0.356}, Neptunian {1, 3, 0.080, 0.120}; Rocky AND Titan derive strength 0 live (no terrestrial leakage). Variant spread is drivers-only (T_eq vigor ramp + Rhines count + atmosphere.color) — no per-preset hacks.
- Tweaks applied (1 of 3 cycles): first-cut warp mix(1.0,2.4) displaced ±1.07 stripe units — more than a full band width — smearing bands into marble at d5. Re-derived to mix(0.12,0.55) (Jovian ≈ ±0.23-stripe festoons); bands now hold identity with scalloped edges.
- Code review (fable, 2 should-fix, both applied): (1) stripe count rendered 2× the derived value — latC spans 2 units, coefficient fixed 0.5→0.25 so uBandCount counts visible stripes; (2) unconditional shadeN renormalize broke the byte-identical-at-strength-0 contract — branched on uBandStrength > 0.
- Taste forks for Max's lap: (a) festoon turbulence is conservative — real Juno edges are MORE chaotic; warp ramp is one knob if he wants wilder; (b) 2-tone zone/belt palette from atmosphere.color (v1 cut — no multi-band hue ramp); (c) close-deck grain subtlety (item 7).
- Scope cuts (per §6.5): longitudinal drift + counter-rotating jets → F25; storms → F27/F28; gas-preset × leftover-terrain-features interplay → Phase-5 integration; GUI band-tint swatch shows a stale color on solid presets (inert behind the strength gate — reviewer nit, accepted).
- New infrastructure this card landed (4b features ride on it): 'gas-giant' archetype, 3 gas DRIVER_PRESETS (h2-he, rotationHours = the new D8 field), gas shadeN flatten, PROV_BANDS=22 neutral row.
- Status: VERIFIED_PENDING_MAX
