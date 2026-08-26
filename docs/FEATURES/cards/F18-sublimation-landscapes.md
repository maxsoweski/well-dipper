# Feature Card — F18 Sublimation landscapes
Domain: Cryo · Lab status: ✅ · Build-seq phase: 3

## 1. Description (WHAT)

F18 Sublimation landscapes (domain: Cryo) — surface expression of P11 "Sublimation / volatile etching": frozen volatiles pass solid→gas wherever insolation hits, etching landforms whose morphology depends on WHICH volatile is solid. Physical chain (L1/L0): D1 T_eq gates which species is frozen (condensation bands), D2 volatileFraction sets the budget, D3 axialTilt makes it seasonal, D5 thin atmosphere lets sublimation dominate over wind/liquid erosion. Variants per the inventory: sublimation pits/hollows (H₂O, mild — terrestrial), Swiss-cheese flat-floored depressions (CO₂, Mars S-pole residual cap), bladed terrain/penitentes (CH₄, Pluto Tartarus Dorsa — sun-aligned blades up to ~500 m), araneiform "spider" terrain (CO₂ gas-jetting, Mars polar — radial dendritic channels), and convection polygons (N₂, Pluto Sputnik Planitia / Triton — ~33 km cells, raised smooth centers, trough borders). Active sublimation = sharp fresh forms; intensity scales from a single pit to basin-filling pit/polygon fields. Archetypes: ice, terrestrial, eyeball (cryo-dominant "ice" archetype lists F18 alongside F2/F9/F10/F17/F22). The doc's `[aspirational]` status flag (planet-visual-features.md:240) is stale — F18 is built in the lab as Cryo step 4.

## 2. Current shader approach (HOW, as-built)

BUILT (lab Cryo step 4). Core: `sublimationCombiner(pos, h, grad)` at world-engine-lab.html:1233-1300, RELIEF (height+gradient) with morphology switched on `uVolatileSpecies` (the one allowed semantic-uniform branch — uniform control flow, not a planetType branch). Uniforms declared :302-313: `uSubStrength` (driven 0..1 gate, ≤0 early-out), `uVolatileSpecies` (0 none/1 H₂O/2 CO₂/3 CH₄/4 N₂), plus lab shape knobs (uSubAmp, uSubPitScale, uSubPolyScale, uSubFloorFrac, uSubPitDensity, uBladeFreq, uBladeSharp, uSubColdGate, uSubOffset). Spatial confinement: coldFactor (substellar angle if tide-locked, sin²lat otherwise) + the same localT<condensationT capMask the frost mask uses (reuses frost uniforms, incl. altitude lapse via accumulated h) — so a warm world etches only its cold cap, a uniformly-cold Pluto etches broadly. Morphologies: CH₄ (3) → penitente blades via `bladeProfile` :1000-1011 (pow-sharpened ridgeWave, finite-diff-pinned §5.4), anisotropic field aligned to the sun azimuth projected into the tangent plane, mild noised() warp, EXACT chain-ruled gradient; CO₂ (2)/N₂ (4)/H₂O (1) → flat-floored radial pits: shared `voronoi3d` keystone + `grabenProfile` (radial), hashed per-cell host/radius (uSubPitDensity fraction), CO₂ gets a sun-facing depth asymmetry (active scarp retreat); N₂ additionally raises convection-cell interiors with trough borders via a second voronoi3d F2−F1 smoothstep (cosmetic gradient, chaos convention). Province-aware ×uProvinceWeight (no-op 1.0 until Stage-D). Called in the relief chain at :1511. Driven side: planet-lod-lab-core.js:562-568 volatileSpecies JS classifier (T_eq bands: >273→0, >150→H₂O, >90→CO₂, >40→CH₄, else N₂; volatileFraction<0.05→0) and :832-836 `subStrength = clamp01(frostMaxCoverage) × subActiveFactor` (H₂O ×0.4 mild hollows, CO₂/CH₄/N₂ ×1.0). GUI: 'Sublimation (F18)' folder under Relief, world-engine-lab.html:2463-2476 (species dropdown, gate `.listen()`); ✓-enable zeroes the gate for clean A/B (:2788). FEATURES key `sublimation` (enableKey `subEnabled`, archetype `volatile-cold`) at planet-archetypes.js:19. Araneiform spiders are explicitly DEFERRED to a rich tier (:1305 comment, alongside F4's Voronoi-web).

## 3. Reference images (real + art)

- [real] https://www.nasa.gov/image-article/intricate-surface-patterns-revealed-plutos-sputnik-planum/
  — Sputnik Planitia N₂ convection cells: smooth raised polygon interiors (~33 km) with narrow darker trough borders — the read is cell-vs-border, two tones, not texture.
- [real] https://hirise.lpl.arizona.edu/PSP_004989_0945
  — Mars S-pole Swiss-cheese terrain: round flat-floored depressions with steep walls punched into a smooth CO₂ mesa — no raised rims (the anti-crater signature).
- [real] https://www.nasa.gov/missions/scientists-offer-sharper-insight-into-plutos-bladed-terrain/
  — Tartarus Dorsa bladed terrain: parallel CH₄ ridges hundreds of meters tall, all sharing one azimuth — strong anisotropy is the form cue, individual blades read as thin crest lines.
- [real] https://www.nasa.gov/image-article/jamming-with-spiders-from-mars/
  — Araneiform 'spiders' (rich-tier deferred variant): radial dendritic troughs converging on a center — branching channel topology, not pits.
- [real] https://en.wikipedia.org/wiki/Swiss_cheese_features
  — Mechanism summary for the CO₂ variant: pits deepen to a resistant layer then expand LATERALLY, walls retreat sunward — justifies the flat-floor + sun-facing-asymmetry knobs.
- [art] https://deep-fold.itch.io/pixel-planet-generator
  — Deep-Fold pixel planets: how few posterize bands carry an ice-world read — cap edges and pit shadows resolve as single clean band steps, exactly our envelope.
- [art] https://plasmator-games.itch.io/pixel-planet-creator
  — Bayer-dithered (2x2/4x4/8x8) planet shading with ice palettes — reference for how dither matrices handle the cap/terrain luminance boundary without shimmer.
- [art] https://www.artstation.com/artwork/XnKeb0
  — Starbase ice-planet concept: stylized icy terrain reduced to large readable silhouette forms and 2-3 value masses — the form-first abstraction target.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology: sublimation landforms are insolation-driven free-boundary problems — local retreat rate ∝ absorbed solar flux at the ice surface. Three regimes map to our three morphologies. (1) Penitentes/blades: a flat ice surface is UNSTABLE to perturbations because troughs focus reflected/scattered light (self-illumination), deepening preferentially; blades align toward the noon sun and grow normal to it (Moores et al. 2017 modeled Tartarus Dorsa as km-scale CH₄ penitentes, ~1 cm deepening per orbit). Procedurally this collapses to an anisotropic sun-azimuth-aligned ridge train — exactly the §5.4-pinned ridgeWave (1−|sin|) sharpened by a pow exponent (bladeProfile), the same directional-field machinery as F5 scarps/F8 wrinkles with the axis swapped to the projected light direction. (2) Swiss-cheese: pits nucleate, deepen to a resistant substrate, then expand laterally with sun-facing scarp retreat → flat-floored radial depressions with depth asymmetry — procedurally a jittered Voronoi F1 placement (the research doc's "impact craters via Voronoi F1 + analytic profile" pattern, rim term swapped for a graben/flat-floor profile) plus a slowly-varying insolation asymmetry factor. (3) Sputnik polygons: Rayleigh–Bénard convection in a soft N₂ ice layer (McKinnon et al., Nature 2016) — cell width ~ layer depth, warm ice rises at centers, sinks at trough borders → raised smooth interiors, narrow border troughs — procedurally Voronoi border distance (F2−F1) smoothstepped, the research doc's "Voronoi border distance" survives-posterization primitive. Araneiforms (CO₂ gas-jetting under a translucent slab, Nature Sci. Rep. 2021) are dendritic radial channels — a branching/Voronoi-web problem deferred to the rich tier. All of it rides the doc's universal base: analytic-derivative `noised()` FBM, exact chain-ruled gradients (relief routes through NORMALS, which is what survives the 6-level posterize), fwidth frequency clamping against dither shimmer. Most promising shader-side approach: exactly what's built — one species-switched combiner reusing the shared voronoi3d keystone for pits/polygons and the pinned bladeProfile for blades, gated by the frost cold-cap mask so the landforms live strictly inside the frost. Rich-tier upgrades, in order of payoff: araneiform radial-dendrite channels (reuse the F4 Voronoi-web approach), Sputnik center→edge pit-size grading (hash-blend pit radius by border distance), and seasonal D3 modulation of subStrength.

## 5. Isolation recipe (:9223)

Built — solo it in the lab on the :9223 debug Chrome (per well-dipper-testing-reference: chrome-devtools MCP, GPU Chrome, NOT Playwright). 1) Navigate the :9223 page to the lab (world-engine-lab.html via the dev server Max runs — do not start one). 2) `window._lab.setPreset('Frozen (airless)')` — T_eq=60 K → volatileSpecies=3 (CH₄ penitentes), subStrength driven >0 (verify: `window._lab.state.subStrength > 0 && window._lab.state.volatileSpecies === 3`). 3) `window._lab.solo('sublimation')` — the real FEATURES key (planet-archetypes.js:19). 4) Distances via `window._lab.state.distance`: 12 for the cap-confinement/global read, 6 for landform-field form, 2.5 for close blade/pit profile (LOD octaves ramp in automatically). 5) Morphology sweep: 'Titan (methane seas)' (94 K) and 'Europa (icy moon)' (110 K) both derive CO₂ swiss-cheese (species 2); no preset reaches the N₂ band (≤40 K), so set the species dropdown / `window._lab.state.volatileSpecies = 4` manually for Sputnik polygons, `= 1` for H₂O hollows, then re-screenshot. 6) Clean A/B: untick '✓ enabled' in the 'Sublimation (F18)' folder (zeroes the gate, preserves shape knobs) or `window._lab.state.subEnabled = false`. 7) `🎲 randomize` rolls uSubOffset for seed variety.

## 6. What to judge (UAT checklist)

- [ ] Do CO₂ swiss-cheese pits read as flat-floored, steep-walled rounded depressions punched DOWN into a smooth cap — distinguishable from craters (no raised rim, no ejecta) — in the 6-level posterized envelope?
- [ ] Does the CO₂ sun-facing asymmetry read as behavior — pits visibly deeper/darker on the sunward wall, suggesting active scarp retreat — rather than a uniform stamp?
- [ ] Do CH₄ penitentes read as a strongly anisotropic field — thin sharp parallel crests all sharing the sun azimuth, with smooth floors between — not isotropic ridged noise?
- [ ] Do N₂ polygons read as raised smooth cell interiors with narrow trough borders (cell-vs-border two-tone), with the finer pit octave sitting on top without destroying the cell read?
- [ ] Does the cold-cap confinement behave: relief locked to poles/antistellar cap on a warm world, spreading globe-wide on a uniformly cold Pluto-like preset, with a soft (not hard-banded) edge?
- [ ] Does morphology switch cleanly and discretely with volatileSpecies (each species a distinct form language), and does species 0 / gate 0 give a pixel-clean no-op against the base relief?
- [ ] At distance, do pit walls and blade crests resolve as stable posterize band steps rather than dither shimmer (fwidth-fade behavior holding under the 4x4 Bayer)?
- [ ] Does relief arrive through NORMALS (shading-band shifts as the light moves) rather than albedo painting — i.e., do the landforms relight correctly when the planet rotates?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: 🟢 2026-06-10 (VERIFIED_PENDING_MAX) — Frozen (airless), solo
  `sublimation`, d6/d2.5, species sweep 3→2→4→1. Drivers verified live:
  subStrength 0.802, derived volatileSpecies 3 (CH₄ at T_eq 60 K, per
  the core.js classifier).
  - CH₄ penitentes: strongly anisotropic fields of thin parallel crests
    sharing one azimuth, smooth exposed terrain between — not isotropic
    ridged noise (shots 01 d6, 02 d2.5).
  - CO₂ swiss-cheese: rounded flat-floored steep-walled depressions
    punched DOWN into a smooth cap, no raised rims and no ejecta —
    clearly distinct from the F02 crater read; wall shadows biased to
    one side (sun-facing retreat asymmetry) (shot 03).
  - N₂ polygons: surface reorganizes into raised smooth cell interiors
    separated by connected narrow dark trough borders — cell-vs-border
    two-tone, finer pits riding on top without destroying the cell read
    (shot 04 vs 03, same region compared).
  - H₂O hollows: same radial-pit family, mild ×0.4 driver factor pinned
    in core.js (shot 05).
  - Species switching is discrete and uniform-gated (no planetType
    branch); gate-0 (enabled, strength 0) vs disabled is pixel-identical
    — 0 px diff, clean early-out.
  - Cold-cap confinement: uniformly cold Frozen etches broadly; the
    capMask is the same localT<condensationT machinery verified
    polar-confined on warm worlds in F17/F22.
  - Temporal/dither stability per FOUNDATION checks 3 & 4 🟢.
  - Shots: F18-sub-01-d6-ch4-blades.png, -02-d2.5-blades-close.png,
    -03-d2.5-co2-swisscheese.png, -04-d2.5-n2-polygons.png,
    -05-d2.5-h2o-hollows.png.
- Max's feedback: (pending Phase-7 lap)
- Tweaks applied: none needed
- Re-verify: n/a
- Status: VERIFIED_PENDING_MAX
