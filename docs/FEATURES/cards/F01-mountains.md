# Feature Card — F01 Mountains / ranges
Domain: Relief · Lab status: ✅ · Build-seq phase: 3

## 1. Description (WHAT)

F1 "Mountains / ranges" (F-relief family, close-up/LOD2): the ridged base-relief layer every other relief feature sits on. Physical chain (L0→L1): tectonic deformation P2 + orogeny P3 + effusive volcanism P4, driven by surface-history/age (D11, D16), tidal heating (D12), mass/gravity (D14 — low-g permits giant shields), and habitability D15 as the water-lubricated-subduction proxy (the inventory marks full plate-tectonic fold belts as Earth-only in the solar system; treat as terrestrial/ocean-exclusive). Variants: tectonic fold belt, volcanic shield/strato, ridged crestlines. Real-body examples: Himalaya (fold belt), Olympus Mons (shield), Tharsis (volcanic province); Maxwell Montes is the Venus belt case. WD types: rocky, terrestrial, venus, lava, ice, carbon. Intensity axis: single anticline … Himalaya-scale belt, growing over 10s Myr and eroding over Gyr (old worlds = rounded low ranges).

## 2. Current shader approach (HOW, as-built)

BUILT (campaign tracker row F1 = done, card docs/FEATURES/cards/F01-mountains.md). Registry: planet-archetypes.js:10 — key `mountains`, enableKey `mountainsEnabled`, archetype `tectonic-terrestrial` (presets 'Rocky (Earthlike)', 'Ocean (temperate)', planet-archetypes.js:28). Shader (all in planet-lod-lab.html): uniforms uMountainAmp/uRidgeOffset/uRidgeGain/uOrogenyStrength/uOrogenyAxis/uMountainScale/uMountainDomainOffset at :198-205; `fbmdRidged()` at :580-617 — Musgrave ridged multifractal, per-octave fold signal = uRidgeOffset − |n.x|, squared (sharpen), next octave weight-gated by clamp(signal²·uRidgeGain,0,1) so ridges connect into ranges; Decarpentier-correct analytic gradient (−sign(n.x) fold flip + chain rule through the square, pinned by the vitest ridgedFold() oracle); anisotropic fold belts via a symmetric xz-domain stretch mix(1,3,uOrogenyStrength) across uOrogenyAxis with the gradient transformed back by the same S; fwidth-clamp trailing-octave fade for anti-shimmer; shares uMacroOffset seed. `mountainCombiner()` at :676-682 (early-out at uMountainAmp≤0, regression-safe), called in the Stage-2 relief stack at :1500. Driver wiring: planet-lod-lab-core.js:635-653 — mountainAmp = mix(0.25, 0.6, 1−erosion) (erosion-softened), orogenyStrength = habitability × (1−erosion) (D15 subduction proxy × young-age window), orogenyAngle hashed from seed. GUI: 'Mountains (F1)' folder under Relief at planet-lod-lab.html:2319-2327 (amplitude, orogeny, strike angle, ridge offset/gain, domain freq, ✓ enabled, 🎲 randomize); uniform push at :2708-2712. Frost interplay: uFrostLapseRate (:292) lets the snowline climb the accumulated relief.

## 3. Reference images (real + art)

- [real] https://earthobservatory.nasa.gov/images/144355/an-astronauts-view-of-the-himalayas
  — Oblique ISS view of the Himalaya/Everest — a fold belt reads as one coherent grain of parallel crestlines with deep shadowed valleys, not isolated peaks.
- [real] https://earthobservatory.nasa.gov/images/146570/rolling-through-the-appalachians
  — Appalachian Valley-and-Ridge from the ISS — the purest anisotropic-belt signature: long parallel ridges along a single strike axis, exactly what uOrogenyStrength→1 should evoke.
- [real] https://science.nasa.gov/resource/viking-1-orbiter-image-olympus-mons/
  — Viking 1 mosaic of Olympus Mons — the volcanic-shield variant: one broad low-slope massif, isotropic and radial, the opposite pole from a belt.
- [real] https://en.wikipedia.org/wiki/Maxwell_Montes
  — Maxwell Montes (Magellan radar) — a Himalaya-scale belt on airless-hot Venus, radar-bright above a 'snowline' elevation: precedent for altitude-keyed shading on non-Earth types.
- [art] https://deep-fold.itch.io/pixel-planet-generator
  — Deep-Fold Pixel Planet Generator — the closest published cousin of our envelope: dithered, palette-quantized procedural planets where terrain reads through value bands, not hue.
- [art] https://github.com/Deep-Fold/PixelPlanets
  — Source shaders for the above (Godot) — study how few luminance levels still convey landmass relief under dither.
- [art] https://www.decarpentier.nl/scape-procedural-basics
  — Decarpentier's Scape ridged-turbulence renders — the visual target for connected crisp crestlines vs. plain |noise| spikes; also the gradient-correction source our fbmdRidged transcribes.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology models ranges as crustal shortening (orogeny: convergence rate × time → uplift) balanced against erosion, classically the stream-power law E = K·A^m·S^n — which is why old ranges are low and rounded; our driver layer compresses that whole balance into mountainAmp = mix(0.25,0.6,1−erosion) and orogenyStrength = habitability×(1−erosion). Procedural graphics models the *look* rather than the process: Musgrave's ridged multifractal (signal = offset − |noise|, squared, weight-gated next octave; H=1, offset≈1, gain≈2, lacunarity≈2) produces connected crestlines because each octave only grows where the previous was high; IQ's analytic-derivative noised() returns vec4(value, gradient) so normals are exact in one eval and the running gradient enables slope-damped 'free erosion' FBM (a += b·n.x/(1+dot(d,d))); Decarpentier's ridged turbulence supplies the −sign(n) gradient correction through the fold. Fold-belt anisotropy is standard directional-noise practice: stretch the sampling domain across a strike axis and back-transform the gradient by the same symmetric map. The retro envelope dictates routing everything through normals/lighting — relief survives the 6-level posterize as dither texture, albedo gradients get crushed — plus fwidth frequency-clamping to fade sub-pixel octaves before the abs() fold's sign flips alias into flickering dither blocks. Most promising shader-side approach (and what is built): a variable-octave ridged multifractal with analytic gradients, layered onto the FBM continents by an early-out combiner, with the fold-belt↔isotropic-massif axis driven by an anisotropic domain stretch and amplitude erosion-softened from the driver presets; the remaining upside is slope-damped octave accumulation for asymmetric eroded faces.

## 5. Isolation recipe (:9223)

Built — solo it on the :9223 GPU Chrome (per memory/chrome-devtools-9223-launch.md and well-dipper-testing-reference.md): (1) launch the second Chrome with --remote-debugging-port=9223 and open planet-lod-lab.html; (2) in the console or via mcp__chrome-devtools__evaluate_script run `window._lab.setPreset('Rocky (Earthlike)')` (the tectonic-terrestrial exemplar; also try 'Ocean (temperate)'); (3) `window._lab.solo('mountains')` — the real FEATURES key from planet-archetypes.js:10; (4) set camera with `window._lab.state.distance = 6` for full LOD2 octaves (lodRampOf ramps 20→6 radii), then 3 and 1.5 for close-up crestline reads, and 20 for the global-silhouette sanity check; (5) in the GUI folder Relief → Mountains (F1), sweep 'orogeny (fold belt)' 0→1 to compare isotropic ridged hills vs. anisotropic belt, sweep 'strike angle', and hit 🎲 randomize to reroll the domain offset. Note the Rocky preset derives mountainAmp ≈ 0.46 (erosion 0.4) and orogenyStrength ≈ 0.42 (habitability 0.7) — push 'amplitude (erosion)' manually to see the young-world extreme.

## 6. What to judge (UAT checklist)

- [ ] Does it read as connected crestlines/ranges in the 6-level posterized envelope — linked ridge spines with shadowed flanks — rather than isotropic noise spikes or bumps?
- [ ] At orogenyStrength→1, does it read as a fold BELT: ridges elongated parallel to one per-planet strike direction (the Appalachian/Himalaya grain), with stretched ridge faces still lit correctly after the domain stretch?
- [ ] At orogenyStrength→0, does it read as isotropic ridged hills/massifs (the rocky/airless regime) clearly distinct from the belt look?
- [ ] Does amplitude track the erosion driver as form: young worlds sharp and tall, old worlds rounded and low — visible as a behavior when sweeping the slider?
- [ ] Does the relief survive the Bayer+posterize as dither texture on the lit side (detail routed through normals), with no new albedo-gradient mush and no flickering dither blocks when orbiting (fwidth clamp doing its job)?
- [ ] Do mountains compose with the rest of the relief stack — sitting ON the FBM continents, frost climbing them via the lapse rate, craters/canyons crosscutting plausibly — instead of floating as a separate layer?
- [ ] Is the solo toggle regression-safe: with mountainsEnabled off (uMountainAmp≤0 early-out), is the Stage-A base pixel-identical?
- [ ] Is the look stable and deterministic per seed — same strike grain and ridge layout on revisit, changing only under the 🎲 reroll?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
