# Feature Card — F41 Hemispheric magma ocean
Domain: Exotic · Lab status: ⬜ · Build-seq phase: 4c

## 1. Description (WHAT)

Hemispheric magma ocean (domain: Exotic, F-exotic-natural group; status `[aspirational]`, confidence *speculative*). Physical chain from the L0/L1 rows: D1 `equilibriumTemperature` at an extreme value (insolation -> blackbody surface temp, the master gate for volatile state) plus D7 tidal-lock state (locked -> permanent day/night hemispheres -> "substellar magma") melt the permanent dayside outright; P4 effusive volcanism (low-viscosity magma, lava plains/flood basalts) and P6 tidal-heat resurfacing (interior kept molten, zero-age crater-free surface) supply the molten-rock processes. Result: a molten sea centered on the substellar point, a magma shoreline with waves at the terminator where surface temperature crosses the silicate freezing point, and nightside rock-frost condensate plains where rock vapor blown across the terminator snows back out. Variants: molten dayside sea; magma shoreline/waves at terminator; nightside rock-frost condensate plains. Real-body examples: K2-141b and 55 Cnc e (candidates -- K2-141b is modeled with a ~100 km deep magma ocean, rock-vapor atmosphere, and supersonic winds returning rock rain to the hot pole). WD types: `lava` (recipe row: F8 + F41 + emissive cracks) and `eyeball` (F41 as the hot lobe, alongside F31f pupil cloud, F22 terminator ring, F48 night cities).

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). F41 appears in planet-lod-lab.html only as a named future consumer of existing machinery: the shared incandescence ramp `emissiveBlackbody(tempK)` (planet-lod-lab.html:529, header comment at :522-523 reads "ONE curve, two consumers: BANDS thermal (F32/F33) + EXOTIC magma (F41)") and the Stage-9 ownership comment at :1573 ("magma Exotic F41 (emissiveBlackbody)"). The nearest existing machinery it should plug into: (a) the star-emissive-bypass channel that adds glow AFTER the 6-level posterize (:1576-1581, composited at :1597) with `uEmissive`/`uEmissiveBypass` uniforms (:1611, :2129-2132); (b) the F8 `lavaCrackEmissive` Voronoi F2-F1 crack combiner (:1121-1140) which already calls `emissiveBlackbody(1400.0)` for fresh-basalt incandescence with `uLavaActivity`/`uCrackScale`/`uCrackWidth`/`uLavaGlowRate` knobs (:250-259); (c) the shared `vSubstellarAngle` varying (:134-139) -- 0 at the substellar point, pi at the antistellar -- already consumed by the tidally-locked eyeball frost cap via `uFrostLocked` (:290, :1387), which is exactly the field a hemispheric magma mask needs; and (d) the `'Lava (hot airless)'` preset (:2151, `tidalState:{locked:true}`, T_eq 950). The FEATURES registry in planet-archetypes.js (lava key at line 15) has no magma entry yet -- F41 would need its own key there to get a GUI folder + solo button.

## 3. Reference images (real + art)

- [real] https://www.eurekalert.org/multimedia/619275
  — Canonical K2-141b artist's impression (McGill): glowing molten hemisphere centered on the substellar point, dark solid nightside, sharp luminous shoreline -- the exact two-tone hemispheric form F41 must read as.
- [real] https://science.nasa.gov/missions/webb/nasas-webb-hints-at-possible-atmosphere-surrounding-rocky-exoplanet/
  — NASA Webb page on 55 Cnc e -- magma-ocean candidate whose CO/CO2 atmosphere bubbles out of the melt; note the dull-red-to-orange day/night emission gradient in the render.
- [real] https://en.wikipedia.org/wiki/K2-141b
  — K2-141b parameters: ~2/3 of the surface in perpetual daylight, dayside ~3000 C (rock vaporizes), nightside below -200 C -- sets the temperature endpoints the blackbody ramp should span.
- [real] https://www.usgs.gov/media/images/radial-fracture-patterns-halemaumaus-lava-lake-surface-kilauea-volcano-summit
  — Kilauea lava-lake surface: dark foundering crust plates separated by incandescent radial fracture seams -- the small-scale texture vocabulary for the magma sea's interior (bright seams on dark plates, high luminance contrast).
- [real] https://www.usgs.gov/media/images/halemaumau-lava-lake-kilauea-summit-eruption-may-24-2021
  — Halemaumau lava lake overview: mostly-crusted surface with a few open molten patches -- shows that a believable magma sea is NOT uniformly bright; brightness lives in moving seams and ponds.
- [art] https://deep-fold.itch.io/pixel-planet-generator
  — Deep-Fold Pixel Planet Generator's Lava World: dithered pixel planet where the molten material reads through 2-3 hot emissive bands over near-black rock -- proof the magma read survives a tiny posterized palette.
- [art] https://github.com/Deep-Fold/PixelPlanets
  — Open-source Godot shader code behind the above -- the lava rivers are animated warped noise thresholded into a few flat emissive levels, directly portable vocabulary for our posterize envelope.
- [art] https://plasmator-games.itch.io/pixel-planet-creator
  — Pixel Planet Creator (8-16 bit): noise + fixed palettes + retro dithering planets -- reference for how hot/cold hemisphere splits stay legible at sprite scale.

## 4. Math / modeling notes (HOW, from the field)

Academia models lava worlds with magma-ocean GCMs coupled to a rock-vapor cycle (K2-141b literature): surface temperature follows an irradiation law T(theta) ~ T_ss * cos^(1/4)(theta) outward from the substellar point, the magma "shoreline" is the iso-irradiation circle where T crosses the silicate liquidus (~1400-1700 K), rock vapor evaporates at the hot pole, supersonic winds carry it across the terminator, and it condenses as rock frost on the nightside -- so the whole feature is a 1-D function of substellar angle plus surface texture. In shader terms (research/RESEARCH_high-lod-planet-shaders-2026-06-05.md vocabulary): the lab already exposes that angle as the shared `vSubstellarAngle` varying, so the sea mask is a `smoothstep` around a liquidus angle (a "driven" uniform from T_eq + lock state, same pattern as `uFrostLocked`). Inside the mask, the doc's lava stack applies directly: domain-warped FBM / nimitz-style animated-fbm churn for the molten surface, the two-phase flow-map advection primitive for buffer-free flow, Worley F2-F1 crust-plate seams (the Kilauea foundering-crust look) with `emissiveBlackbody(T(theta))` chromaticity, all routed through the star-emissive-bypass channel so the glow is added AFTER the 6-level posterize ("the single best posterization-survivor in the domain -- emissive + high contrast"). The nightside condensate plains are an albedo lift reusing the existing antistellar frost-cap machinery; shoreline "waves" are a thin animated emissive band at the mask edge. Most promising approach: a substellar-angle `smoothstep` mask gated on T_eq + tidal lock defines the sea; within it, replace the rock surface with two-phase-advected domain-warped FBM whose value drives both `emissiveBlackbody(T(theta))` brightness (via the existing emissive-bypass channel) and a Voronoi F2-F1 dark-plate/bright-seam structure that gets denser and dimmer toward the shoreline. The nightside half reuses the F22/F23 locked frost cap as rock-frost; the only genuinely new code is the mask + the in-sea combiner.

## 5. Isolation recipe (:9223)

Unbuilt -- recipe for once it lands. Recommended: register a `magma` key in planet-archetypes.js FEATURES (e.g. `{ label: 'Magma ocean (F41)', enableKey: 'magmaEnabled', archetypes: ['volcanic'] }`, plus the future eyeball archetype), which auto-grants the GUI folder solo button. Then: launch the second Chrome on :9223 per memory/chrome-devtools-9223-launch.md, open planet-lod-lab.html, select preset 'Lava (hot airless)' (the only tidally-locked hot preset, T_eq 950 -- consider adding a hotter 'Magma ocean (K2-141b)' preset with T_eq ~3000 so the shoreline angle is well inside the dayside), run `window._lab.solo('magma')`, and inspect at `window._lab.state.distance = 20` (whole-disk hemispheric read: bright lobe vs dark nightside), `= 6` (shoreline band at the terminator), and `= 2` (in-sea crust-plate/seam texture at full lodRamp). Set a small `spinSpeed` or drag yaw to sweep the shoreline through view; `window._lab.solo(null)`-equivalent is the 'clear solo' button / `window._lab.enableAllFeatures()`.

## 6. What to judge (UAT checklist)

- [ ] Does the dayside read as a single coherent molten SEA centered on the substellar point -- one glowing lobe, not scattered lava patches -- in the 6-level posterized envelope?
- [ ] Does the magma/rock boundary read as a SHORELINE (a roughly circular iso-temperature edge offset from the lighting terminator) rather than just the day/night shading boundary repainted orange?
- [ ] Does brightness within the sea fall off from the hot pole toward the shoreline along the blackbody ramp (white/amber center -> dull red rim), so the posterize bands form concentric temperature contours rather than noise?
- [ ] Up close, does the sea surface read as dark crust plates separated by bright incandescent seams that slowly churn (Kilauea foundering-crust behavior), not as a flat uniform glow?
- [ ] Does the emissive glow stay crisp and unbanded over the dithered rock -- i.e., is it visibly riding the emissive-bypass channel, still readable on the unlit side of the relief?
- [ ] Does the nightside read as cold condensate plains -- a slightly lifted-albedo frosty cap on dark rock -- distinct from both the magma glow and ordinary polar frost?
- [ ] At whole-disk distance, does the planet still read as the two-tone 'eyeball' archetype (hot lobe + dark frosted back) within 2-3 posterize levels, without the shoreline aliasing into dither shimmer?
- [ ] When relief features (F8 cracks, craters) coexist, does the sea suppress them inside the mask (molten = smooth, zero-age) while they survive on the solid nightside?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
