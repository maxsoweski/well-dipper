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

## 6.5 Build plan (working-Claude, 2026-06-10 — Phase 4c heavy loop)

Strategy: §4's 1-D substellar-angle model — the sea is a smoothstep around
a liquidus iso-angle of vSubstellarAngle; in-sea texture is the doc's lava
stack on the emissive-bypass channel; nightside reuses the locked frost
cap. Also discharges the 4b carry-over: F41 owns the Lava half of the
whole-globe uBaseColor*uEmissive stand-in (F32 took the hot-jupiter
half). Exemplars `b66550c` (F40, incl. new-preset pattern) / `3170d54`.

1. **New preset (data)** — `'Magma (K2-141b)'`: radiusEarth ~1.5, locked,
   T_eq ~2000 (substellar ~3000 K — rock vaporizes), airless or thin
   rock-vapor, iron-rich, near-zero volatiles. Opens with `radiusEarth:`.
   The proper carrier — shoreline well inside the dayside. Walk all
   features for sanity (no clouds/fluvial/glint; craters suppressed
   in-sea per step 5).
2. **Register** — `magma` in FEATURES (archetypes: volcanic) +
   featureFolders + `magmaEnabled` default true + GUI "Magma ocean (F41)"
   (driven `.listen()`: seaAngle, magmaTemp; ✓ enable LAST).
3. **Sea mask + thermal field** — driven uniforms uMagmaSeaAngle (the
   liquidus iso-angle, derived in applyDrivers by solving
   T_ss·cos^¼θ = liquidus with T_ss ≈ T_eq·1.4 on locked worlds, mask 0
   if T_ss < liquidus), uMagmaTemp (T_ss). GLSL: mask =
   smoothstep(uMagmaSeaAngle+δ, uMagmaSeaAngle−δ, vSubstellarAngle);
   T(θ) = uMagmaTemp·pow(max(cos θ,0.05), 0.25) (positive base —
   spec-safe); emissiveBlackbody(T(θ)) gives the concentric white→amber→
   dull-red contours.
4. **In-sea combiner** — Voronoi F2-F1 dark crust plates / bright seams
   (reuse the F8 lavaCrackEmissive machinery/knobs where possible),
   churned by two-phase bounded-time advected domain-warped FBM; seams
   denser+dimmer toward the shoreline; thin animated emissive band at
   the mask edge (shoreline waves). ALL glow through the star-emissive-
   bypass channel (added AFTER posterize).
5. **Surface suppression in-sea** — molten = zero-age: inside the mask,
   replace the rock albedo with the dark crust tone and blend shadeN
   toward geometric N (color/normal level only — NO h/grad writes), so
   craters/relief vanish in the sea and survive on the nightside.
6. **Nightside rock-frost** — reuse the antistellar locked frost-cap
   machinery (uFrostLocked pattern) as a slight albedo lift, distinct
   tone from polar frost (warm grey condensate, not white).
7. **Stand-in retirement (Lava half)** — applyDrivers zeroes the
   whole-globe state.emissive on the magma-class gate (locked && hot),
   mirroring F32's _hotJup zeroing. Lava (T_eq 950, T_ss ~1330 K) sits
   near the peridotite solidus: with liquidus 1300 K it derives a SMALL
   substellar melt pond + keeps F8 cracks — its globe glow now comes
   from real features, not the stand-in. Taste fork: Lava's look changes.
8. **Plumbing** — PROV_MAGMA=37 + PROVINCES row + provinceWeight row +
   GLSL_NAME line; frame writer sole uniform owner.

GLSL reserved-word check (F40 lesson): no `patch`/`sample`/`filter`
identifiers; node --check cannot catch shader-compile errors.

v1 scope cuts (logged, not built): rock-vapor atmosphere + supersonic
wind streaks; rock RAIN at the hot pole; eyeball-archetype hot-lobe
coupling (Eyeball preset is temperate — mask gates to 0 there anyway);
hot-pole evaporation albedo feedback.

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: **🟡 taste-call — VERIFIED_PENDING_MAX** (2026-06-10, Phase 4c heavy loop)
- Evidence (repo root, gitignored): `F41-k2-d20.png` (one coherent lobe, amber core → dull-red rim, monotonic radial falloff, extent 0.97-1.0R = predicted sin(1.5243)), `F41-lava-pond-d8.png` (pond rim 0.41R vs predicted 0.408R — iso-temperature circle clearly NOT the terminator), `F41-k2-plates-d3.png`(+frame2) (dark plates / bright seams, ONE lattice vocabulary, 12.7% churn over 2.5 s bounded), `F41-k2-shoreline-d6.png` (rim local max L27.4 vs 15.3 in-sea), `F41-k2-night.png`, `F41-lava-night.png` (night mean L 7.7/255 — wash retired).
- §6 checklist: coherent sea 🟢 · shoreline ≠ terminator 🟢 (Lava pond test) · blackbody contours 🟢 (G/R 0.73→0.63 falloff) · crust plates/seams churn 🟢 (M1 fix verified: no ghosted second lattice) · emissive-bypass crispness 🟢 · nightside condensate 🟡 (CORRECT-AS-CODED, sub-threshold as rendered: max ≈1.5/255 under ambient 0.035 — taste fork b) · two-tone whole-disc read 🟢 · relief suppression in-sea 🟢 (34.7% px A/B; sea pinned to light, centroid 0.3 px under spin while 27.3% of surface rotated).
- New preset 'Magma (K2-141b)' (15th): seaAngle 1.5243 / T_ss 2800; airless ⇒ clouds/limb/term/aurora/dust/frost all 0 (verified). NOTE: K2 derives craterDensity 0 from preset DATA (bombardment 0, resurfacing 1 — a fully-resurfacing molten world), so nightside craterlessness is data-driven, not F41 masking.
- Stand-in retirement (the 4b F32 carry-over, discharged): whole-globe uBaseColor*uEmissive wash zeroed on the magma class (locked && !gas && T_ss>1300) independent of magmaEnabled. Lava now reads "rocky world with one molten eye" — small dull-red 0.42-rad pond + bright shoreline ring + F8 crack embers on a DARK night side (was: glowing orange ball). THE headline taste fork (a).
- Tweaks applied: 0 of 3 cycles — review fixes landed pre-verify, first live render passed.
- Code review (fable): APPROVE-WITH-FIXES, both applied pre-verify. M1 MAJOR: F8 crack emissive was unmasked inside the sea (ghosted twin seam lattice + contradiction of card item 8) → `* (1.0 - mgSeaMask)`, bit-exact elsewhere. N1: cos floor 0.05→0.04 (reconciles GLSL rim temp with the CPU liquidus solve at K2's shoreline). N2 cosmetic: GUI shows nonzero T_ss display on locked non-magma presets (shader-inert). N3 = fork (c).
- Taste forks for Max's lap: (a) Lava's retired wash (the intended but large look change); (b) nightside rock-frost invisible as shipped — raise cap / add faint self-term / twilight placement if it should be SEEN; (c) rock-frost on Lava physically marginal at T_ss 1330 (vaporization needs ~2400 K) — a smoothstep on uMagmaTemp could scale it; (d) liquidus 1300 K + T_ss = T_eq×1.4 authored constants.
- Process note → testing reference: under the normal URL, toggling any *Enabled triggers an async sessionStorage scenario-restore that resets camera+uTime mid-test; `?fresh=1` makes toggles inert.
- Status: VERIFIED_PENDING_MAX
