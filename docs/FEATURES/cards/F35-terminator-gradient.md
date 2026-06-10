# Feature Card — F35 Terminator color gradient
Domain: Optical · Lab status: 🟡 · Build-seq phase: 4c

## 1. Description (WHAT)

F35 Terminator color gradient (domain: Optical) — a colored twilight band at the day/night boundary, the visible signature of P26 Optical/atmospheric scattering: slant-path and aerosol scattering along near-grazing sun rays redden the terminator (and brighten the limb, F34's half). Physical chain: D5 atmosphere density sets how long/opaque the slant path is (band width and saturation), D6 retention gates existence (airless = razor-sharp colorless terminator), D4 composition + aerosols set the hue. Variants per the L2 row: reddened day/night boundary; distinct twilight band. Real-body examples: Earth's orange-red sunset band seen from orbit; Mars's INVERTED blue sunset (fine dust forward-scatters blue near the sun while the sky reddens); Venus's abnormally broad orange twilight arc (90-bar atmosphere stretches twilight). WD types: terrestrial, rocky, venus. Doc status is `[current]` (terminator day/night) — read carefully, that credits only the day/night *boundary* (Lambert shading + terminator-width shaping); the COLOR gradient itself is the unbuilt part. (Source: docs/FEATURES/planet-visual-features.md:301 [F35], :172 [P26], :98-99 [D5/D6].)

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) — no terminator tint term, uniform, or GUI knob exists; grep for terminator/twilight/redden in planet-lod-lab.html and planet-archetypes.js finds only comments, and FEATURES (planet-archetypes.js:6-22) has no optical entries. Nearest machinery it plugs into: Stage 9 OPTICAL in /home/ax/projects/well-dipper/planet-lod-lab.html:1566-1572 — the "limb/terminator scattering (additive-tint ONLY; must not double-darken)" stage, currently holding only the F34 fresnel limb term (uLimbStrength, driven by deriveUniforms via applyDrivers at :2167-2172). The geometric ingredients already exist in the same shader: `float diff = max(dot(shadeN, uLightDir), 0.0)` (:1529) and the aurora's twilight-detecting `nightMask = smoothstep(0.1, -0.1, diff)` (:1592). Production precedent for terminator *shape* (not color): src/objects/Moon.js:484-495 (sharp vs soft smoothstep terminator by body type) and src/rendering/shaders/MaterialBodyShader.js:333-337 (roughness-modulated terminator width).

## 3. Reference images (real + art)

- [real] https://apod.nasa.gov/apod/ap241227.html
  — Planet Earth at Twilight (ISS) — the terminator is a soft band, not a line: cloud tops near the boundary catch reddened light while a thin blue scattering layer rides the dayside edge; our band should read as 1-2 warm posterize buckets wide.
- [real] https://www.nasa.gov/image-article/earth-twilight/
  — NASA's canonical Earth-at-twilight orbital photo — note the diffuse shadow line and how the reddening hugs the boundary while the deep day side keeps its normal palette (additive tint near the terminator only).
- [real] https://www.jpl.nasa.gov/news/nasas-curiosity-rover-views-serene-sundown-on-mars/
  — Curiosity's blue Martian sunset — fine dust passes blue preferentially near the sun: the species/aerosol swap that should flip our band hue from warm (n2-o2) to cool blue (thin dusty CO2).
- [real] https://www.syfy.com/syfy-wire/akatsuki-reveals-a-hot-dynamic-venus
  — Akatsuki's Venus crescent — the vertical orange terminator stripe is abnormally WIDE because the 90-bar atmosphere stretches twilight: band width must scale with D5 atmosphere density.
- [art] https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/
  — The dithering/retro-shading reference our envelope is built on — how a smooth lighting gradient (exactly what a terminator is) should dissolve into Bayer texture instead of hard color rings.
- [art] https://inspirnathan.com/posts/58-shadertoy-tutorial-part-12/
  — Fresnel/rim-lighting shader tutorial (the research doc's cited analytic-atmosphere source) — the `mix(twilight, day, dot(N,sun))` pattern is the whole F35 mechanism in one line, stylized not raymarched.
- [art] https://lettier.github.io/3d-game-shaders-for-beginners/rim-lighting.html
  — Game-shader rim lighting — shows how a cheap dot-product mask reads as 'atmosphere' in stylized renders; F35 is the same trick aimed at dot(N,sun)≈0 instead of dot(N,V)≈0.

## 4. Math / modeling notes (HOW, from the field)

Physically this is single-scattering along grazing slant paths: Rayleigh scattering removes blue from direct sunlight as λ⁻⁴ over a path that grows like 1/cos(solar zenith) near the terminator, so transmitted light reddens; aerosols add a Mie forward-scattering lobe (Mars inverts the hue because micron dust forward-scatters blue toward the observer). Academia/sims model it with full atmospheric-scattering integrals (Nishita-style single scattering; precomputed/raymarched optical depth), which the project's research doc captures as "Raymarched scattering (Lague) — ray-sphere the atmo shell, density*exp(-h/H), Rayleigh (λ⁻⁴) + Mie phase, bake optical depth to a LUT" — flagged LOD2-desktop-only, high cost (research/RESEARCH_high-lod-planet-shaders-2026-06-05.md:93). Games default to the doc's "Analytic fresnel atmosphere" row (:92): `atmoColor = mix(twilight, day, dot(N,sun))`, O(1), survives posterization — the lead recommendation ("fresnel atmosphere default with Lague reserved for the single desktop LOD2 body", :96, :176). In our vocabulary F35 is a 1-D function of mu = dot(N, uLightDir): a twilight mask peaked at mu≈0 (smoothstep pair or gaussian `exp(-pow(mu/width,2))`), width driven by D5 pressure (airless → width 0 → term vanishes), tint by D4 composition (warm red-orange for n2-o2, blue for thin dusty CO2, broad orange for venus-thick), composited in Stage 9 under the additive-tint-only rule so it never double-darkens, with the envelope split deciding posterize vs bypass. Most promising shader-side approach: an analytic terminator-band term `vec3 termC = uTwilightColor * uTerminatorStrength * exp(-pow(diff0/uTwilightWidth, 2.0)) ` (where diff0 = raw dot(N,uLightDir), signed, so the band straddles zero and bleeds slightly onto the night side), with uTwilightWidth/uTwilightColor derived in deriveUniforms from atmosphere pressure and composition exactly like uLimbStrength, added next to limbC and run through the same posterize-with-bypass-toggle. One uniform bundle, no raymarch, and it inherits the F34 wiring pattern wholesale.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built. Registration: add `terminator: { label: 'Terminator gradient (F35)', enableKey: 'terminatorEnabled', archetypes: ['tectonic-terrestrial'] }` to FEATURES in planet-archetypes.js (membership matches the doc's terrestrial/rocky/venus types). Then, in the :9223 debug Chrome (launch per memory/chrome-devtools-9223-launch.md), open the Vite-served planet-lod-lab.html and run via mcp__chrome-devtools__evaluate_script: (1) `window._lab.setPreset('Rocky (Earthlike)')` — n2-o2, pressure 1.0, the warm-red baseline; (2) `window._lab.solo('terminator')` — zeroes every other feature's enableKey; (3) `window._lab.state.distance = 20` for the global view (this is a whole-disk feature; also check mid-range at `= 6`); (4) drag yaw or set the spin-speed slider >0 so the terminator sweeps and you can watch the band track it. A/B checks: `setPreset('Titan (methane seas)')` (pressure 1.5 — band should widen/shift hue) and `setPreset('Frozen (airless)')` (atmosphere:null — band must vanish, sharp terminator regression). Clear with `window._lab.enableAllFeatures()`. Verify state via `window._lab.state._derived`, not screenshots alone.

## 6. What to judge (UAT checklist)

- [ ] Does a distinct colored twilight band read at the day/night boundary as its own 1-2 posterize buckets, rather than just the darkest Lambert step ending?
- [ ] Does band width track atmosphere density in the 6-level envelope — hairline on thin-air rocky, broad Venus-like arc on thick-atmosphere presets, and exactly zero (razor terminator) on airless presets?
- [ ] Does the hue swap read at a glance per composition — warm red-orange on n2-o2 worlds vs cool blue on thin dusty-CO2 worlds — surviving quantization as a recognizably different-colored band?
- [ ] Does the band behave as an additive tint only — night side stays dark, day-side palette away from the boundary is untouched, no double-darkening of the terminator?
- [ ] Does the band track the terminator great-circle as the planet spins or the light moves — sweeping with the lighting, never pinned to latitude or showing a seam?
- [ ] Under the 4x4 Bayer envelope, does the band's edge dissolve into dither texture instead of forming a hard concentric color ring (the banding failure mode the envelope exists to prevent)?
- [ ] Does it compose with the F34 limb glow at the limb-terminator corners without blowing out — two scattering terms reading as one atmosphere?

## 6.5 Build plan (working-Claude, 2026-06-10 — Phase 4c heavy loop)

Strategy: the §4 analytic band verbatim — a 1-D gaussian of signed
mu = dot(N, uLightDir) in Stage 9, additive-tint only, riding the F34
wiring pattern (freshest exemplar commit `3587fab`).

1. **Register** — `terminator` in FEATURES (archetypes:
   tectonic-terrestrial, per §5) + featureFolders + `terminatorEnabled`
   default true + GUI folder "Terminator gradient (F35)" in the
   Surface — Optical group F34 created (driven sliders `.listen()`:
   termStrength, termWidth; own bypass toggle mirroring limbBypass;
   ✓ enable LAST).
2. **Shader** — uniforms uTermColor (vec3), uTermStrength, uTermWidth,
   uTermBypass. Stage 9, GEOMETRIC N (atmospheric great-circle band, F34
   precedent): `float mu = dot(N, uLightDir); float tt = mu / uTermWidth;
   vec3 termC = uTermColor * uTermStrength * exp(-tt*tt);` — signed mu so
   the band straddles zero and bleeds onto the night side. NO
   pow(negative, y) — exp(-tt*tt) exactly. Posterize unless uTermBypass;
   add next to limbC (additive only, never darkens).
3. **applyDrivers derivation** (core.js OFF-LIMITS): strength
   hasAtmo ? ~0.5 : 0; width from D5 pressure — hairline ~0.06 at ≤0.1 bar,
   ~0.12 at 1 bar, broad ~0.30 Venus-class (log-ish clamp); hue from a
   small per-preset map (warm red-orange n2-o2; broad orange Venus; cooler
   for cold-haze worlds; Mars-blue rule recorded as data for any future
   thin-dusty-CO2 preset), fallback warm orange.
4. **Gates** — terminatorEnabled false OR airless ⇒ strength 0 (razor
   terminator regression).
5. **Plumbing** — PROV_TERM=33 + PROVINCES neutral row + provinceWeight
   GLSL row + GLSL_NAME vitest line, per F34.

v1 scope cuts (logged, not built): Mie forward-lobe phase (the Mars blue
INVERSION mechanism — hue carried as data only); raymarched scattering
(LOD2 rung); cloud-top reddening coupling near the band.

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: **🟡 taste-call — VERIFIED_PENDING_MAX** (2026-06-10, Phase 4c heavy loop)
- Evidence (repo root, gitignored): `F35-rocky-d20.png`(+`-off`) (warm band straddling mu≈0: peak dRGB [113,48,29], FWHM 0.22 mu ≈ theory 0.20, ~1.4 posterize buckets), `F35-venus-d20.png` (broad orange, FWHM 0.48 — 2.18× Rocky vs theory 2.47×), `F35-rocky-d6.png` (Bayer dissolve, no hard ring), `F35-eyeball.png` (F31f ring + band = one coherent twilight zone). Verifier ray-cast every diff pixel onto the sphere to bin by mu — found uLightDir is OBJECT-space (world light fixed [0.61,0.36,0.71]); accounted for.
- §6 checklist: distinct band 🟢 (own 1-2 buckets) · width↔pressure 🟢 (0.12→0.297 derived, 2.18× measured) · hue swap 🟢 (Rocky R-dominant / Titan B>R>G mauve / Neptunian blue-dominant) · additive-only 🟢 (night mean |diff| ≤0.26, day mu>0.5 diff 0.0 on Venus/Titan/Neptunian) · tracks lighting 🟢 (spun 1.2 rad, band re-centered at world-mu −0.03, no seam) · Bayer dissolve 🟢 · F34 composition 🟢 (Venus corner maxRGB [255,255,175], no white flood; saturated px are dayside clouds, band ≈0.002 there).
- Live drivers: strength 0.5 all retained-atmosphere presets / 0 airless (Frozen/Lava A/B diff identically 0.0); width clamp(0.12+0.09·log10(P), 0.06, 0.30): Rocky 0.12 · Ocean/Titan 0.136 · Venus 0.297 · gas ×4 0.30; hue map 10 presets (Mars blue-inversion rule recorded as data for future thin-CO2 presets).
- Tweaks applied: 0 of 3 cycles — first live render passed all items (review M1 fixed pre-verify).
- Code review (fable): APPROVE-WITH-FIXES. M1 fixed pre-verify: FEATURES registration was tectonic-terrestrial only while drivers light the band on every retained-atmosphere preset and the default-on archetype filter would have hidden the GUI on 6 live presets — widened to F34's four-archetype set (scope widening vs the card's terrestrial/rocky/venus doc types, logged here). N4: corner stacking can't blow out (limb carries diff+0.15≈0.15 at the terminator; composite min-clamps). Implementer deviations accepted: constant warm-orange fallback (sidesteps N6 staleness), veilTint on termC (matches limbC), double zero-guard.
- Taste forks for Max's lap: (a) Eyeball — F31f cloud-ring speckle picks up a warm/pink tint where it overlaps the band (coherent twilight overall, but the tinted speckle is an aesthetic call); (b) terminator band on the gas giants (physically real, widened per M1, but the card's doc scope was terrestrial/rocky/venus — drop to zero there if it fights the band stack); (c) global strength 0.5 authored, not derived.
- Status: VERIFIED_PENDING_MAX
