# Feature Card — F34 Limb / atmosphere rim glow
Domain: Optical · Lab status: 🟡 · Build-seq phase: 4c

## 1. Description (WHAT)

Limb / atmosphere rim glow (domain: Optical; status [current], fresnel limb). Physical chain: D5 atmosphere density + D6 atmosphere retention (Jeans escape + UV stripping, generator computeAtmosphere) feed P26 optical/atmospheric scattering — a viewing ray that skims the limb traverses a far longer slant-path air column than one hitting the disc center, so Rayleigh + aerosol (Mie) scattering permanently brighten the disc edge into a rim glow. Variants from the F34 row: (1) plain fresnel rim — thin sharp edge brightening on any retained atmosphere; (2) "blue line" — Earth's razor-thin band of layered blues hugging the horizon (Rayleigh-dominated, thin clear atmosphere); (3) thick haze halo — deep aerosol stacks that glow well off the limb, e.g. Titan's multi-layer orange detached haze and Pluto's backlit blue haze bands. Real-body examples named in the inventory: Earth blue line, Titan. Applies to all atmospheric WD types (terrestrial, ocean, venus/titan-likes, gas); hard-gated OFF on airless bodies. Sibling P26 features: F35 terminator reddening, F36 sunglint.

## 2. Current shader approach (HOW, as-built)

Built in planet-lod-lab.html as Stage 9 OPTICAL (additive-tint only; must not double-darken). Shader: lines 1566–1570 — `float limb = pow(1.0 - max(dot(N, V), 0.0), 3.0) * uLimbStrength * (diff + 0.15); vec3 limbC = uWeatheredColor * limb;` i.e. fresnel against the GEOMETRIC normal N (not the relief-perturbed shadeN, so the rim hugs the true silhouette), exponent fixed at 3, sun-weighted by `(diff + 0.15)` so the lit limb is brightest but the night limb keeps a floor. limbC is posterized (6-level + Bayer) unless `uLimbBypass == 1` (line 1570), then composited additively into gl_FragColor (line 1597). Uniforms: declared :164–167 (`uLimbStrength`, `uLimbBypass`), initialized :1613/:1616, synced from state each frame :2683/:2686. GUI: "Envelope" folder — 'limb glow' slider (0–1) at :2131, 'limb bypass quantizer' toggle at :2134; state defaults :1869/:1872 (0.0/false). Driver side: planet-lod-lab-core.js:937 `limbStrength: hasAtmo ? 0.7 : 0.0` — applied by applyDrivers (planet-lod-lab.html:2164–2168) from DRIVER_PRESETS. NOT in the planet-archetypes.js FEATURES solo registry (that registry is terrain-relief features only), so no `_lab.solo()` key exists. Known gaps vs the F34 variant list: tint uses uWeatheredColor (surface color), ignoring the preset's `atmosphere.color`, so Earth-blue-line vs Titan-orange-halo can't differ in hue; strength is a binary 0.7/0 (not scaled by D5 pressure) and the exponent is fixed, so the "thick haze halo" variant is unexpressed; glow cannot extend past the silhouette (single-sphere pass, no halo shell).

## 3. Reference images (real + art)

- [real] https://www.nasa.gov/image-article/thin-blue-line/
  — Earth's limb from ISS — the 'blue line' variant: a razor-thin luminous band hugging the horizon, bright at the bottom edge and fading fast to black; our thin-atmosphere rim should be this narrow, not a broad wash.
- [real] https://www.earthobservatory.nasa.gov/images/150240/earths-limb-with-a-crescent-moon
  — Layered lighter/darker blues stacked in the limb band — a natural fit for posterize steps reading as concentric atmosphere layers.
- [real] https://science.nasa.gov/resource/haze-silhouettes-against-titans-glow/
  — Titan's thick multi-layer haze (Cassini, ~400 km detached layer) — the 'thick haze halo' variant: glow extends far off the solid limb and has its own internal banding.
- [real] https://science.nasa.gov/photojournal/plutos-haze-in-bands-of-blue/
  — Pluto's backlit blue haze bands — rim glow is brightest at high phase (backlit), showing the sun-weighting behavior the (diff+0.15) term approximates.
- [art] https://chsxf.medium.com/designing-a-versatile-planet-shader-for-crying-suns-468444245503
  — Crying Suns pixel-art planet shader — atmosphere haze/halo as a separate pass on a slightly enlarged sphere; the closest shipped-game match to our retro posterized target.
- [art] https://lettier.github.io/3d-game-shaders-for-beginners/rim-lighting.html
  — Canonical fresnel rim-lighting recipe (dot(N,V) silhouette term) — the exact O(1) technique Stage 9 implements; note how rim width is governed by the exponent.
- [art] https://godotengine.org/asset-library/asset/2002
  — Zylann's Godot planet atmosphere shader — stylized-friendly fresnel/scattering shell with day-tint vs twilight-tint mixing, the upgrade path for atmosphere-colored limb.

## 4. Math / modeling notes (HOW, from the field)

Physically this is single-scattering radiative transfer along a slant path: limb brightness tracks optical depth via airmass ~ a Chapman-function/exp(-h/H) column, with Rayleigh scattering (lambda^-4, gives Earth's blue line) vs aerosol Mie scattering (forward-peaked phase function — why Titan/Pluto halos blaze when backlit at high phase angle) deciding hue and thickness. The repo research doc (RESEARCH_high-lod-planet-shaders-2026-06-05.md §3.2) frames the game-side ladder in exactly this feature's terms: (1) "Analytic fresnel atmosphere" — `fres = pow(1-max(dot(N,V),0), 2..4)`, `atmoColor = mix(twilight, day, dot(N,sun))`, night-gated; O(1), tagged [survives] posterization, the cheap default (inspirnathan, lettier, Zylann); (2) enlarged-shell second pass with additive fresnel for halo extension beyond the silhouette (the Crying Suns approach); (3) "Raymarched scattering (Lague) — LOD2 only": ray-sphere the atmo shell, ~10 view x ~10 sun samples, density*exp(-h/H), Rayleigh (lambda^-4) + Mie phase, optical depth baked to a LUT (GPU Gems 2 ch.16 lineage) — [needs-adaptation], high cost, desktop-LOD2 only. The doc's posterization-split guidance applies directly: limb glow is one of the three terms that "look wrong when banded," so it lives in the bypass/raise-levels family (Stage 9 already has uLimbBypass). Most promising shader-side approach: keep the analytic fresnel core but make it driver-true — tint with the preset's atmosphere.color instead of uWeatheredColor, derive strength AND exponent from D5 pressure/aerosol (thin clear atmo → exponent ~4, narrow blue line; thick hazy atmo → exponent ~1.5–2 + higher strength, fat halo), and add the doc's mix(twilight, day, dot(N,sun)) hue shift. If the halo must extend past the silhouette for Titan-class worlds, add the cheap enlarged back-face shell pass rather than raymarching.

## 5. Isolation recipe (:9223)

Built — isolate on :9223 (see chrome-devtools-9223-launch + well-dipper-testing-reference memory: chrome-devtools MCP, not Playwright). There is NO `_lab.solo()` key for limb (planet-archetypes.js FEATURES is relief-only); isolate via the Envelope state instead. Steps: (1) open planet-lod-lab.html in the :9223 Chrome; (2) `window._lab.setPreset('Rocky (Earthlike)')` — deriveUniforms sets limbStrength 0.7 (hasAtmo); (3) kill competing additive terms: `window._lab.state.emissive = 0; window._lab.state.specStrength = 0;` and `window._lab.uniforms.uCloudCoverage.value = 0; window._lab.uniforms.uAuroraIntensity.value = 0;` (clouds/aurora are uniform-only, set once; emissive/spec are frame-loop-synced from state); (4) optionally flatten terrain noise with the relief solo cleared or just judge the rim against the dark side; (5) sweep `window._lab.state.limbStrength` through 0 → 0.3 → 0.7 → 1.0; (6) view at `window._lab.state.distance = 18` (full-disc silhouette), then 8, then 2.5 (close pass — rim must not flood the frame); orbit yaw so the sun sits at the limb to check the (diff+0.15) sun-weighting; (7) toggle `window._lab.state.limbBypass` to compare quantized vs continuous rim; (8) negative control: `window._lab.setPreset('Frozen (airless)')` then `setPreset('Lava (hot airless)')` — derived limbStrength must be 0 (rim absent); (9) cross-check 'Titan (methane seas)' and 'Ocean (temperate)' for the atmospheric-type spread.

## 6. What to judge (UAT checklist)

- [ ] Does the rim read as a luminous band hugging the geometric silhouette in the 6-level posterized envelope — a distinct edge phenomenon, not a broad fresnel wash smearing a third of the disc?
- [ ] Does the glow read as sun-weighted behavior: brightest on the lit limb, dimming around toward the night limb with only a faint floor — does the rim visibly 'track' the light direction as you orbit?
- [ ] With limb bypass OFF, do the posterize+Bayer steps read as clean concentric atmosphere layers (the Earth-limb 'layer cake' form) rather than ragged banding artifacts; with bypass ON, does the smooth ring still feel in-style next to the quantized surface?
- [ ] Does the airless gate read correctly as behavior: Frozen/Lava presets show a hard dark silhouette edge with zero rim, while every retained-atmosphere preset shows one?
- [ ] Does the rim stay anchored to the true sphere edge as relief/perturb amplitude rises (fresnel uses geometric N) — mountains should NOT drag glow into the disc interior?
- [ ] At close distance (~2.5 radii) does the limb arc stay a coherent curved band at the frame edge instead of flooding the view?
- [ ] Variant spread (currently a known gap): does a Titan-class world read thicker/hazier at the limb than an Earth-like, and does the rim hue read as atmosphere color rather than just brightened surface color?

## 6.5 Build plan (working-Claude, 2026-06-10 — Phase 4c heavy loop)

Strategy: keep the analytic fresnel core (§4's [survives] pick) but make it
driver-true and registered; absorb the parked F31e detached-haze-shell
companion as a cheap enlarged back-face shell pass for thick-haze worlds.

1. **Register as a feature** — `limb` entry in planet-archetypes.js FEATURES
   + `featureFolders` + `limbEnabled` state default true + GUI folder
   "Limb glow" (driven sliders `.listen()`, ✓ enable LAST): limbStrength,
   limbExponent, limbHazeShell, limb-bypass toggle. MIGRATE the two existing
   Envelope-folder limb controls into this folder (no duplicate GUI).
2. **Driver-true rim** — new uniforms `uLimbColor` (vec3), `uLimbExponent`
   (float); shader keeps geometric-N fresnel but
   `pow(1.0 - max(dot(N,V),0.0), uLimbExponent) * uLimbStrength * (diff+0.15)`,
   tinted `uLimbColor` (not uWeatheredColor). Posterize/bypass path unchanged.
3. **applyDrivers derivation** (post-process; core.js OFF-LIMITS): keep
   derived hasAtmo gate; thin/clear atmosphere → exponent ~3.5 (narrow blue
   line); thick-haze class (Titan / Venus / Sub-Neptune hazeMute>0) →
   exponent ~1.8 + strength ×1.3 (fat halo). `limbColor` from a small
   per-preset/archetype map in applyDrivers (Earth-blue temperate/ocean,
   Titan orange, Venus pale sulfur, ice-giant blue…) — fallback uWeatheredColor.
4. **F31e companion shell** — second back-face sphere mesh (scale ~1.04,
   additive, depthWrite false) whose fresnel is quantized into 1–2 concentric
   arcs, color uLimbColor, intensity `limbHazeShell` derived >0 ONLY for
   thick-haze worlds (0 default). Enable-gated per frame with the rim.
5. **Gates** — limbEnabled false OR airless ⇒ uLimbStrength 0 + shell
   invisible (Frozen/Lava negative control stays hard-edged).
6. **Registry plumbing per F32/F33 exemplar** (`e5e9a45`): PROVINCES affinity
   row + PROV_LIMB id (next free: 32) + provinceWeight row + GLSL_NAME vitest
   line.

v1 scope cuts (logged, not built): raymarched scattering (LOD2 ladder rung 3);
day/twilight hue mix vs sun (F35 terminator-gradient owns sun-hue coupling);
>2 detached shell layers; Pluto backlit phase-function boost.

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: **🟡 taste-call — VERIFIED_PENDING_MAX** (2026-06-10, Phase 4c heavy loop)
- Evidence (repo root, gitignored): `F34-rocky-d18.png` (blue rim, half-peak width 0.06R hugging the silhouette), `F34-rocky-bypass-off/on.png` (quantized histogram spikes 341/249/183 vs smooth 123/90/82), `F34-titan-d18.png` + `F34-titan-d8.png` (orange fat rim + detached shell: rim peak 108.5 → gap 0.8 → bright arc 29.6 → gap 4.0 → dim arc 16.4 → dark by 1.17R), `F34-rocky-d2.5.png` (close pass: band 0.058R, zero below 0.85R).
- §6 checklist: rim-band 🟢 (0.06R, not a wash) · sun-weighting 🟢 (lit/night peak ratio 9.4×, blue-only night floor) · posterize layers 🟢-caveat (steps measurable but read as DITHERED bands, not crisp concentric rings, at d18 disc size — taste fork a) · airless gate 🟢 (Frozen/Lava limb+2px lum 0.1) · relief anchor 🟢 (perturb 0.55→1.0, rim stays r 0.90–1.01, zero inboard) · close-pass 🟢 · variant spread 🟢 (Titan exp 1.8/strength 0.91/orange vs Rocky exp 3.5/0.7/blue; Neptunian ice-blue) · F31e companion shell 🟢 (Titan/Venus/Sub-Neptune arcs 40.9/35.0/29.6 with gaps; Ocean/Jovian/Neptunian shell-zone max 0.1).
- Live drivers: Rocky/Ocean/Eyeball 0.70/3.5/shell 0 · Titan/Venus/Sub-Neptune 0.91/1.8/shell 0.6 (orange/pale-sulfur/haze-grey) · gas ×4 0.70/3.5/shell 0 · airless 0. Thick-haze gate data-driven: `_cloudRegime 2||3 || (!gas && retained && T_eq<150 && pressure>=1)`.
- Tweaks applied: 0 of 3 cycles — first live render passed all items (review M1 fixed pre-verify).
- Code review (fable): APPROVE-WITH-FIXES. M1 MAJOR fixed pre-verify: shell was 1.04R with the bright bucket flush against the rim (sub-pixel at judging distances + the F31e smear failure) → 1.15R, remap 2.0, explicit gap-bright-gap-dim windows. N6 staleness comment added to LIMB_COLOR_BY_PRESET. Implementer deviations accepted: shell sun-weighting, full 10-preset color map, new "Surface — Optical" GUI group (home for F35/F36).
- Taste forks for Max's lap: (a) bypass-off rim steps read dithered rather than crisp-concentric at d18 (Earth "layer cake" only partially expressed; crisper would need Bayer excluded from the rim term); (b) the rim re-tint changes EVERY atmosphere preset's default look vs pre-F34 (uWeatheredColor → atmosphere color, exp 3 → 3.5) — intended per §6.5 but globally visible; (c) shell arc radii/intensity (1.15R, 0.6) authored, not derived.
- **⚠ Known artifact (Max UAT, 2026-06-15) — DEFERRED, not yet fixed.** Max observed F34 renders correctly on the planet but produces **"two rings OUTSIDE the planet silhouette."** Confirmed cause: the **F31e companion shell** (taste-fork (c)) — the deliberately-detached double-arc authored at ~1.15R with shell intensity 0.6, firing on **Titan / Venus / Sub-Neptune** (arcs 40.9/35.0/29.6; the evidence line's "rim → gap → bright arc → gap → dim arc → dark by 1.17R"). The "bright arc + dim arc" pair IS the two rings; it reads as detached ring artifacts rather than an atmospheric halo. When worked: decide — retune the arc radii/intensity to hug the rim, gate the shell more tightly per preset, or **disable the detached shell entirely** (fork (c) flagged it "authored, not derived," so removal is a clean taste option — same move as the F39 disable; the shell uniforms + the 1.15R remap are the edit sites). NOT fixed this session — Max chose the systematic render-correctness audit (the "Audit this world" tool) first; queued as a render-correctness residual.
- Status: VERIFIED_PENDING_MAX
