# Feature Card — F22 Polar caps & frost fields
Domain: Cryo · Lab status: ✅ · Build-seq phase: 3

## 1. Description (WHAT)

Polar caps & frost fields — climate-painted bright volatile deposits at a world's cold points. The bridge family between climate and terrain: derives from P22 seasonal volatile cycling (volatiles condense onto the winter pole as frost, sublimate in spring; on thin-air worlds a large fraction of the atmosphere itself cycles — pressure breathing; the surface expression of the snowline) and P10 glacial flow (accumulated volatiles compact into layered polar deposits). Driver chain: D1 equilibriumTemperature gates whether the species' condensation point is reached, D2 volatileFraction sets the frost budget, D3 axialTilt sets seasonal amplitude and the latitude frost reaches, D5 atmosphere density modulates transport. Four variants: perennial water cap (Earth, Mars north — stable bright low-noise cap with polar-layered-deposit strata), seasonal CO2 frost (Mars — thin, advances to mid-latitudes, retreats in spring), N2/CH4 frost field (Triton, Pluto — coldest worlds; fresh N2 reads blue-green, irradiated CH4-tholin reads pink), and eyeball nightside cap + terminator melt ring (tidally locked worlds — the whole antistellar hemisphere is one cap). WD types: terrestrial, ice, eyeball, rocky. Status: [partial] — terrestrial/eyeball caps built; seasonal dynamics and the N2/CH4 two-tone tint aspirational.

## 2. Current shader approach (HOW, as-built)

BUILT (partial — Cryo steps 2+3). The keystone is frostCoverage() at world-engine-lab.html:1379-1407: a per-fragment COVERAGE scalar (not relief). coldFactor goes 0 at the hot point to 1 at the cold point — geographic latitude (sinLat²) normally, or the shared vSubstellarAngle varying when uFrostLocked=1 (eyeball antistellar cap, :1386-1393); uFrostLatitudeBias (D3 axialTilt) lifts the equatorial floor for high-obliquity worlds (:1392). localT = uPlanetTempEq·(1−uFrostLatChill·coldFactor) − h·uFrostLapseRate·uPlanetTempEq (:1399-1400) — frost deposits where localT < uFrostCondensationT, with noised() fractal boundary breakup in Kelvin units (:1403) and a smoothstep soft snowline (:1405), scaled by the uFrostMaxCoverage budget. The F22 PLD strata layer is pldBands() at :1420-1429 — albedo-only annular banding keyed on the pole-distance coordinate (coldFactor), parity-alternating bright/dark layers with a soft riser. Consumed at the Stage-6 albedo stage (:1539-1547): albedoCol = mix(uWeatheredColor, uFrostAlbedo·pldBands(frostBandCoord), frostCover) BEFORE posterize, so the luminance lift survives quantization as a bright cap (tint is the stylize/drop part). Uniforms declared :284-300; call site :1518. CPU derivation in planet-lod-lab-core.js: volatileSpecies classifier :555-570, frostCondensationT per species + frostMaxCoverage = smoothstep(0.05,0.4, volatileFraction) + frostLatitudeBias = axialTilt/90 + frostAlbedo by species + frostLocked at :777-810, pldStrength = budget × (1−resurfacing) × 0.35 at :814-819. GUI folder 'Cryo / Frost (F23/F22)' at world-engine-lab.html:2443-2459. Feature key 'frost' (archetype 'volatile-cold') in planet-archetypes.js:18. NOT yet built: seasonal-phase modulation (P22 cycle), the N2/CH4 two-tone frostAge tint LUT, the terminator melt-ring edge narrowing.

## 3. Reference images (real + art)

- [real] https://www.nasa.gov/image-article/layered-deposits-north-pole-of-mars/
  — Mars north polar layered deposits — the stacked bright/dark strata bands pldBands() abstracts; notice how few discrete tones the banding really needs.
- [real] https://en.wikipedia.org/wiki/Martian_polar_ice_caps
  — Both Mars caps as whole forms — spiral troughs, seasonal CO2 advance to mid-latitudes, perennial water core; the cap-vs-seasonal-rim two-zone read.
- [real] https://www.jpl.nasa.gov/images/pia06801-polar-cap-retreat/
  — Seasonal CO2 cap retreat — the frost edge is ragged and patchy, never a clean latitude circle; this is what uFrostNoiseAmp boundary breakup is for.
- [real] https://science.nasa.gov/resource/global-color-mosaic-of-triton/
  — Triton global mosaic — pinkish CH4-tholin south cap, blue-green fresh N2 equatorial band, dark plume streaks on the cap; the two-tone species tint target.
- [real] https://astrogeology.usgs.gov/search/map/triton_voyager_2_global_color_mosaic_600m
  — USGS Triton 600m mosaic (data product) — cap boundary morphology at map scale: lobate, scalloped, altitude-independent on an airless-ish world.
- [art] https://commons.wikimedia.org/wiki/File:Eyeballplanet.jpg
  — Eyeball-planet concept art — one hemispheric ice cap centered on the antistellar point with a clear warm 'pupil'; the form uFrostLocked must read as.
- [art] https://deep-fold.itch.io/pixel-planet-generator
  — Deep-Fold pixel planet generator — ice caps surviving in a handful of palette levels with Bayer-style dithering; proof the cap reads at our envelope's fidelity.
- [art] https://github.com/jsulpis/realtime-planet-shader
  — Realtime WebGL planet shader — latitude+noise polar cap mask in a single-pass fragment shader, the same architectural slot as our combiner stack.

## 4. Math / modeling notes (HOW, from the field)

Academia models caps with energy-balance condensation: a local surface temperature field (insolation by latitude/obliquity, minus an altitude lapse, ~6.5 K/km on Earth) compared against a per-species frost point — the Leighton-Murray-style CO2 energy-balance model for Mars predicts seasonal cap extent and the pressure-breathing cycle; PLD strata are modeled as Milankovitch-paced deposition (obliquity cycles redistribute ice and dust, e.g. arXiv 2012.04745 'Obliquity dependence of the formation of the martian polar layered deposits' and arXiv 2203.10471 on cap stratigraphy, both surfaced in search). Games and procedural-planet tools collapse this to a threshold mask: coverage = smoothstep over (T_condense − T_local) with noise breakup, exactly the latitude+altitude+threshold snow-line mask seen in Unity Shader Graph planet tutorials and WebGL planet shaders. In the project's research vocabulary (RESEARCH_high-lod-planet-shaders §2-3, stage-b cryo doc): this is a COVERAGE term, not relief — it rides the analytic-derivative noised() height only via the lapse term, is derived CPU-side into semantic uniforms (driver→semantic-uniform scaffolding: D1/D2/D3 → condensationT/budget/latitudeBias), early-outs when driven to ≤0, and is mixed at the albedo stage BEFORE the 6-level posterize so the luminance lift is load-bearing while colour tint is the stylize/drop call; PLD banding is itself a quantizer (floor(x·N)/N softened riser) so it survives the posterize trivially. Most promising shader-side path forward: keep the built localT-vs-condensationT coverage mask as the single source of truth and extend it with (1) a seasonal-phase uniform modulating frostMaxCoverage and the snowline latitude (the P22 advance/retreat, an Option-C bypass-free luminance effect), (2) a 2-entry species tint LUT keyed on a frostAge noise field for the Triton/Pluto blue-green-vs-pink read (the one place the domain wants a colour channel — per-body Option-B bypass, not a default), and (3) the terminator melt ring as a local narrowing of uFrostEdgeSoftness where vSubstellarAngle crosses the snowline on locked worlds.

## 5. Isolation recipe (:9223)

Built — solo it live. (1) Use the second Chrome on :9223 (chrome-devtools MCP, per well-dipper-testing-reference.md) and navigate to the vite-served world-engine-lab.html. (2) Pick a preset via window._lab.setPreset(...): 'Rocky (Earthlike)' for the classic terrestrial polar cap + snowline-on-mountains (matches screenshots/cryo-step2-frost-03-rocky-polarcap.png), 'Frozen (airless)' for a broad cold-world frost field, 'Europa (icy moon)' for the tidally-locked eyeball antistellar cap (frostLocked=1; matches cryo-step2-frost-05-europa-eyeball.png). (3) window._lab.solo('frost') — 'frost' is the real FEATURES key (planet-archetypes.js:18); clear with window._lab.enableAllFeatures(). (4) Distances via window._lab.state.distance (radii, clamp 1.1-30): 20 for whole-disc cap form, 6-8 for snowline breakup and frost-climbs-mountains, and rotate pitch (window._lab.state.pitch) to look down on the pole for the PLD annular rings. (5) Sanity-check the driven uniforms: window._lab.uniforms.uFrostMaxCoverage.value > 0 and uFrostCondensationT.value > 0 (both ≤0 ⇒ shader early-out); tune knobs in the 'Cryo / Frost (F23/F22)' folder (pldStrength/pldLevels for strata, frostNoiseAmp for edge breakup).

## 6. What to judge (UAT checklist)

- [ ] Does the cap read as one coherent BRIGHT polar region in the 6-level posterized envelope — a clean luminance step up from bare ground — rather than dissolving into Bayer dither noise at the boundary?
- [ ] Does the snowline read as a fractal, broken, ragged edge (Mars-retreat-like) and not a drawn-on latitude circle, at both disc scale (distance ~20) and close-up (~6-8)?
- [ ] Does frost climb mountains — isolated bright high-altitude patches equatorward of the main cap line — so the altitude-lapse behavior reads as a snowline, not a pure latitude band?
- [ ] Do the PLD strata read as concentric bright/dark annular rings nested inside the cap when looking down on the pole, clearly distinct from the dither pattern and gated to the cap (no rings on bare ground)?
- [ ] On the locked preset (Europa), does the cap form an eyeball — one hemispheric frost region centered on the antistellar point with the substellar 'pupil' clear — rather than two latitude caps?
- [ ] With latitude bias raised (high obliquity), does frost spread plausibly toward low latitudes as patchy seasonal-style coverage instead of just thickening the polar disc?
- [ ] With the feature soloed OFF or budget driven to 0, is bare ground pixel-identical (regression-safe early-out) — no residual tint or banding?
- [ ] Does the frost tint stay luminance-led — a bright cap with a subtle species hue — rather than a flat saturated color slab that fights the posterizer?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: 🟢 2026-06-10 (VERIFIED_PENDING_MAX) — Rocky (Earthlike) +
  Europa (icy moon), solo `frost`, d20/d8/d7. Drivers verified live:
  Rocky maxCov 0.198 / condT 273 / locked 0 / pld 0.062; Europa maxCov
  1.0 / locked 1.
  - Cap: coherent bright polar region, a clean luminance step above
    bare ground (shots 01 d20, 02 d7).
  - Snowline: ragged fractal edge, never a latitude circle; isolated
    bright high-altitude patches equatorward of the cap line — the
    lapse-rate snowline climbing mountains with F1 enabled (shot 02).
  - PLD strata: annular brightness structure nested inside the cap from
    the pole-down view, gated to the cap (shot 03 at pldStrength 0.25).
    Legibility is subtle at the derived 0.06 — Phase-7 taste knob note.
  - Eyeball (locked): at Europa's 110 K the whole shell frosts —
    physically right (everything is below the H₂O frost point). Raising
    uPlanetTempEq to 320 K clears a bare warm substellar PUPIL with
    frost wrapping toward the antistellar hemisphere — the eyeball form
    verified as temperature behavior, not geometry failure (shots 05,
    06).
  - Latitude bias: formula-level (bias lifts the equatorial coldFactor
    floor); not separately screenshotted.
  - No-op: budget 0 (enabled) vs disabled pixel-identical — 0 px diff.
  - Tint stays luminance-led; bright cap, subtle hue (no saturated slab).
  - Shots: F22-frost-01-d20-rocky-cap.png, -02-d7-snowline-mountains.png,
    -03-d8-pole-pld.png, -04-d20-europa-eyeball.png,
    -05-d8-europa-pupil.png, -06-d8-eyeball-pupil-320K.png.
- Max's feedback: (pending Phase-7 lap)
- Tweaks applied: none needed
- Re-verify: n/a
- Status: VERIFIED_PENDING_MAX

### Deferrals — recorded here 2026-09-05 because the CODE ALREADY CITED THIS SECTION AND IT WAS EMPTY

⛔ `src/worldengine/shaders/planetShaders.glsl.js:448` says *"(Frozen-sea / eyeball ice-ring variant
deferred — **flagged in card §7 for the integration pass**)"*. It was never flagged here. The citation
pointed at nothing for as long as it has existed, so the deferral lived only in a shader comment and
never reached a backlog anyone reads. Filed now, with what 2026-09-05 measured:

1. **Frozen sea / sea ice — DEFERRED, and actively BLOCKED.** `:452` does
   `frostCover *= 1.0 - liquidMask`, so frost is zeroed on all standing liquid. Its reasoning is right
   for Titan (94 K methane seas ARE liquid and must stay radar-dark against frosted ground) but the
   test is UNCONDITIONAL where the rule should be *"suppress frost on liquid ABOVE its own freeze
   point"*. Cost of leaving it: on an ocean-poled world the cap cannot form at all — measured on
   `Ocean (temperate)` seed 1 (267 K), 78 % of the surface poleward of 60° is sea and 43 % of the
   sphere is cold ocean with frost forced to zero.
2. **⭐ AN ICE SHEET AS GEOMETRY IS NOT DEFERRED — IT WAS NEVER SCOPED, and that is a real gap rather
   than a missing tick.** §2's "NOT yet built" list is seasonal phase, the frostAge tint LUT and the
   terminator melt ring — **all three are albedo**. §4 states the design position outright: *"this is
   a COVERAGE term, not relief"*. So F22 can re-tint terrain but can never bury it. Max, 2026-09-05,
   looking at a warm wet world: *"I'm not seeing an ice cap; this is just coloring applied to
   continents that would be there either way."* He is right, and the source agrees — `frostCoverage()`
   writes no `h` and no `grad`, and its single consumer is one `mix()` at `:610`. F17 glacial is the
   only ice GEOMETRY, and turned on live it moves the height field by **0.26 % rms**.

⚠ **AND THE 🟢 ABOVE IS NOT CONTRADICTED BY THIS, which is the part worth carrying.** That rating was
taken on `Rocky (Earthlike)` and `Europa` — both **land**-poled. On a land pole, tinting the ground
white IS a convincing cap, and the verdict was honest. The ocean-poled case simply did not exist to
look at until the volatile-delivery and frost-budget work put a warm wet world on screen. Same shape
as every finding in that arc: the wiring did not break this, it made it visible.
