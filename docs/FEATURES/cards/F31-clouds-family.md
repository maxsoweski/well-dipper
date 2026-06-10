# Feature Card — F31 Clouds family (F31a–F31f)
Domain: Clouds · Lab status: 🟡 · Build-seq phase: 4b

## 1. Description (WHAT)

The cloud/haze FAMILY — the inventory's canonical example of process-first modeling: one driver (atmosphere: D4 composition, D5 density, D6 retention gated by D13/P25 stripping, D1 T_eq gradient, D7 lock, D8 spin) routed through three L1 regimes (P18 cloud condensation — each volatile condenses at its own T/P level into stacked composition-specific decks: H2O/NH4SH/NH3, CH4 on cold giants, H2SO4 on Venus; P19 photochemical haze — UV breaks CH4/N2 into tholin aerosols that mute deeper structure and settle into layered/detached shells; P21 tidally-locked circulation — substellar standing convection + day-to-night terminator flow), with P16 zonal banding and P20 meridional circulation shaping where decks sit. Six L2 looks: F31a terrestrial weather clouds (P18+P20; patchy/banded white over visible ground; Earth; terrestrial+ocean; [current]) · F31b gas-giant band tops (P16+P18; the cloud deck IS the visible surface; Jupiter; gas+hot-jupiter; [current]) · F31c sub-neptune featureless haze (P19; flat structureless muted globe; GJ 1214 b; sub-neptune+eyeball; [partial]) · F31d Venus opaque blanket (P18; total reflective shroud with faint UV Y-markings as a [subtle]; Venus; venus type; [current]) · F31e layered/detached haze shells (P19; stacked aerosol shells with a detached upper layer; Titan, Pluto; sub-neptune+ice+terrestrial; [aspirational]) · F31f eyeball substellar cloud + terminator ring (P21; fixed bright "pupil" cloud locked to the star plus a day/night terminator cloud ring; modeled tidally-locked worlds; eyeball; [current] as climate rings). Same driver, different L1 regime, different L2 look.

## 2. Current shader approach (HOW, as-built)

Partially built in the lab — one generic F31a-style weather layer; the other five variants are unbuilt there. Stage 8 of the fragment shader (planet-lod-lab.html:1558-1564) computes an analytic-FBM cloud field `fbmd(vPos*1.7 + vec3(uTime*0.02,0,0), 5.0, 0.0)`, masks it with `smoothstep(0.15, 0.5, cw.x) * uCloudCoverage * (diff + 0.05)` (sun-weighted white), posterizes it as its own term, and adds it into the final composite at planet-lod-lab.html:1597. The driver chain: uniform declared at :168 and :1617, wired each preset change at :2170 from deriveUniforms, which derives `cloudCoverage = hasAtmo ? clamp01((habitability ?? 0) + 0.2) : 0` at planet-lod-lab-core.js:940. Pre-plumbed integration point for F31f: the canonical shared varying `vSubstellarAngle` (vertex shader, planet-lod-lab.html:133-143) was computed once explicitly so "Clouds (F31f pupil/ring)" can read it. Gaps: clouds have NO entry in the planet-archetypes.js FEATURES registry (lines 6-22) — so no GUI folder, no enableKey, no solo toggle; there is no gas-giant, venus, sub-neptune, or eyeball preset in DRIVER_PRESETS (planet-lod-lab.html:2149-2160); no haze muting exists despite the Stage 8 header naming it ("haze muting runs BEFORE final posterize"). The inventory's [current] flags for F31b/d/f refer to production src/objects/Planet.js machinery (plain-snoise clouds ~382-385 per the research doc; eyeball climate rings), not the lab. Campaign tracker shows F31 as 🟡, build-pass 4b.

## 3. Reference images (real + art)

- [real] https://www.nasa.gov/image-article/cassini-jupiter-portrait/
  — Cassini full-disk Jupiter mosaic — the cloud deck IS the surface: alternating bright zones / dark belts with turbulent sheared edges, exactly the band-lobe vocabulary F31b must carry in 6 levels.
- [real] https://epic.gsfc.nasa.gov/
  — DSCOVR/EPIC full-disk Earth — F31a's target read: patchy white swirls and an equatorial ITCZ band floating over clearly legible ground, clouds as a sparse layer not a stain.
- [real] https://apod.nasa.gov/apod/ap230703.html
  — Venus in UV from Akatsuki — the F31d blanket: a featureless bright shroud whose only structure is the faint planet-scale dark Y/V chevron, the [subtle] marking budget.
- [real] https://photojournal.jpl.nasa.gov/catalog/PIA06123
  — Cassini close-up of Titan's detached haze — F31e's form: a thin upper shell visibly separated from the main haze deck at the limb, reading as concentric arcs.
- [real] https://science.nasa.gov/asset/webb/exoplanet-gj-1214-b-and-its-star-illustration/
  — NASA/Webb illustration of GJ 1214 b — F31c's target: a deliberately flat, structureless, highly reflective haze globe where featurelessness is the feature.
- [real] https://arxiv.org/pdf/1307.0515
  — Yang, Cowan & Abbot GCM paper on tidally-locked cloud feedback — the physical source of F31f's geometry: a standing convective cloud cap pinned to the substellar point.
- [art] https://deep-fold.itch.io/pixel-planet-generator
  — Deep-Fold Pixel Planet Generator — the closest existing match to our envelope: a separate drifting dithered cloud layer composited over posterized terrain, plus flat gas-giant band variants.
- [art] https://pixeljoint.com/pixelart/31581.htm
  — 'The Gas Giant' on PixelJoint — hand-dithered band tops showing how few tones can still carry zonal lobes and turbulence; a benchmark for F31b inside a Bayer-dither budget.

## 4. Math / modeling notes (HOW, from the field)

Academia models the family as one atmosphere column read three ways. (1) Condensation decks (P18): a species condenses where its partial-pressure curve crosses its saturation vapor pressure along the T-P profile — the classic Lewis/Sánchez-Lavega stacked-deck diagram (H2O low, NH4SH mid, NH3 top on Jupiter; H2SO4 on Venus); deck altitude and species are pure functions of D1/D4/D5, which is why one combiner can dispatch all of F31a/b/d. (2) Photochemical haze (P19): UV photolysis of CH4/N2 produces tholin aerosols whose production-vs-settling balance yields either a global muting veil (GJ 1214 b's flat transmission spectrum = featureless reflective haze) or dynamically separated detached layers (Titan, Pluto). (3) Tidally-locked circulation (P21): GCMs (Yang et al. 2013, arXiv:1307.0515) show near-surface convergence drives a permanent convective cloud cap at the substellar point plus terminator-flow condensation — a static function of vSubstellarAngle, not time. Venus's Y-feature is a planetary-scale Kelvin/Rossby wave in the 4-day superrotating cloud top — a slow longitude-drifting chevron modulation. Games/procedural practice (research doc vocabulary): per-type variety comes from swapping the FBM combiner, not the noise core — coverage-masked FBM for weather, banded FBM + recursive domain warp + storm-mask for gas tops, curl-noise advected clouds (Bridson divergence-free, with BOUNDED/periodic time for re-approach stability) for drift; clouds-as-relief is THE posterization adaptation (add cloudDensity to the heightfield before the normal calc so cloud tops self-shade — the lighting value gets dithered, not the cloud hue, so it survives the envelope); terminator cloud shadowing (second density sample offset along the sun dir) survives as darker buckets; in-shader deck at LOD1, thin shell mesh (radius*1.01-1.03, depthWrite:false) only at LOD2 when parallax is visible; fresnel atmosphere is the cheap haze-limb default. Most promising shader-side approach: extend Stage 8 into a regime-dispatched family combiner over the single existing fbmd field — coverage smoothstep for F31a, latitude-banded + domain-warped replacing the surface for F31b, coverage forced to 1 plus a faint drifting chevron modulation for F31d, and a substellar-angle smoothstep cap + terminator gaussian ring read off the already-plumbed vSubstellarAngle for F31f — all fed through clouds-as-relief so lighting, not hue, carries them through the 6-level posterize. The haze variants are NOT density fields: F31c is a pre-posterize contrast/saturation mute toward one haze color (the muting slot the Stage 8 header already reserves), and F31e is 1-2 offset fresnel ring terms at the limb (or the thin-shell mesh at LOD2).

## 5. Isolation recipe (:9223)

Unbuilt as a registered feature — clouds have no key in planet-archetypes.js FEATURES, so window._lab.solo() cannot isolate them yet (only the always-on uCloudCoverage uniform exists). Recommended recipe once built: (1) register key `clouds` (label 'Clouds & haze (F31)', enableKey 'cloudsEnabled') in planet-archetypes.js FEATURES, archetypes ['tectonic-terrestrial'] plus the future gas/venus/sub-neptune archetypes as their presets land. (2) On the :9223 lab page (chrome-devtools per well-dipper-testing-reference.md, NOT Playwright): `window._lab.setPreset('Rocky (Earthlike)')` — habitability 0.7 ⇒ derived cloudCoverage 0.9; `window._lab.solo('clouds')`; judge at `window._lab.state.distance = 20` (global deck-vs-ground read), `= 6` (band/patch structure), `= 2` (clouds-as-relief self-shading and drift). For F31b/c/d/e add and use the corresponding gas-giant / sub-neptune / Venus presets (none exist in DRIVER_PRESETS today); for F31f a tidally-locked preset WITH an atmosphere is required (the only locked preset today, 'Lava (hot airless)', has atmosphere:null). Interim, pre-registration: drive `window._lab.uniforms.uCloudCoverage.value = 1.0` directly on any preset and zero the relief features via the existing solo of an unrelated key.

## 6. What to judge (UAT checklist)

- [ ] F31a — do clouds read as a distinct white layer FLOATING above the terrain (own brightness buckets, gaps revealing legible ground) rather than a baked albedo stain on the surface, in the 6-level posterized envelope?
- [ ] F31a behavior — does the deck drift slowly and deterministically with uTime without shimmering or crawling against the 4x4 Bayer dither pattern?
- [ ] F31b — on a gas world, does the cloud deck read as the visible surface itself: alternating band lobes with turbulent sheared edges, and no rocky relief leaking through from below?
- [ ] F31c — does the sub-neptune read as a deliberately featureless muted globe (contrast killed BEFORE the posterize, 2-3 flat bands plus limb glow) rather than 'the shader broke / texture missing'?
- [ ] F31d — does Venus read as a total reflective shroud at every distance — zero ground leak — with at most one faint planet-scale Y/V chevron surviving as a [subtle] one-bucket darkening?
- [ ] F31e — at the limb, do detached haze shells read as 1-2 crisp concentric arcs clearly separated from the main deck, surviving quantization as distinct rings rather than smearing into the limb glow?
- [ ] F31f — does the substellar 'pupil' cloud read as a bright cap locked to the light direction (static against uTime, moving only with uLightDir) with a terminator ring near 90 degrees from the substellar point?
- [ ] Family coherence — do all six variants visibly speak one cloud language (same dither texture, same brightness vocabulary) while reading as clearly different atmospheric regimes?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
