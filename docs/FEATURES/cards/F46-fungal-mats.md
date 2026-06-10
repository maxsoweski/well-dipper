# Feature Card — F46 Bioluminescent / fungal mats
Domain: Overlay · Lab status: ⬜(lab) · Build-seq phase: 4c

## 1. Description (WHAT)

Bioluminescent / fungal mats — a living surface coating that emits its own light, the F-overlay realization of process P27 "Biospheric colonization" (a surface biosphere spreading across habitable terrain, driven by drivers D15 + D16 along the L1c biotic/technogenic track). It is NOT a geomorphic landform: it has no L0→L1→L2 formation chain of its own — it composites OVER a natural base planet (terrestrial or ocean) whose own oceans/weather/relief still show through where the mat doesn't cover. Variants follow biosphere maturity: sparse glowing patches → coalescing reticulated colonies → a planet-spanning living mat. WD type: `fungal` (EXOTIC), F46 over a terrestrial/ocean base. No confirmed real exoplanet examples (speculative game-construct); terrestrial analogs are dinoflagellate bio-bays (Mosquito Bay) and forest-floor foxfire/mycelial glow. The defining behavior is self-emission visible on the unlit/night side — like F48 city lights and F37 aurora, it lives in the emissive channel, not the albedo.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). The L2 table's "[current] (bioluminescent spots)" refers to a legacy main-game stand-in, NOT the lab — F46 has no implementation in planet-lod-lab.html. There is only a reserved owner-slot comment in the emissive composite-split (planet-lod-lab.html:1574: "city lights F48/49, bioluminescence F46, aurora Optical F37, sunglint Optical F36"). planet-archetypes.js FEATURES (lines 6-22) contains only geomorphic keys (craters…rivers) and no fungal/bio key, so the per-feature solo system can't target it. Nearest existing machinery it should plug into: the post-posterize EMISSIVE BYPASS channel (planet-lod-lab.html:1572-1597) — specifically the aurora night-side term (lines 1589-1595) is the ready-made template, since it already combines a spatial mask (ringMask), a night-visibility gate (nightMask = smoothstep(0.1,-0.1,diff), line 1592), animated noise, and a colored emissive added AFTER the quantizer (line 1597). F46 = swap the aurora's latitude ring for a biosphere coverage mask, keep the night gate and the bypass-add. Driving uniforms would mirror uAuroraIntensity (line 1618) / uEmissive (1611) / uEmissiveBypass (1614); GUI home is the Envelope folder (lines 2126-2134).

## 3. Reference images (real + art)

- [real] https://en.wikipedia.org/wiki/Puerto_Mosquito
  — Dinoflagellate bio-bay: blue-green glow concentrated in patches, triggered by agitation — note glow lives in darkness against an otherwise dark surface, the night-side emissive read we want.
- [real] https://www.wxpr.org/natural-resources/2020-08-31/foxfire-and-bioluminescent-fungi
  — Foxfire / mycelial glow on the forest floor — yellowish-green, patchy reticulated coverage following decaying matter, the 'colonies coalescing into a mat' spatial pattern.
- [real] https://www.atlasobscura.com/articles/the-magic-of-mushrooms
  — Glowing mushrooms only read in the dark — confirms the feature must be Lambert-independent emissive gated to the unlit hemisphere, not an albedo tint.
- [real] https://svs.gsfc.nasa.gov/gallery/earthat-night-imagery/
  — NASA Earth-at-Night (VIIRS Black Marble): the exact rendering analog — discrete emissive patches over the dark hemisphere; study how coverage clusters and fades to nothing, the F46 coverage-mask target.
- [art] https://nomanssky.fandom.com/wiki/Lepios
  — NMS exotic bioluminescent planet (purple/green glowing flora) — palette and 'whole-biome glows' density target for the planet-spanning-mat variant.
- [art] https://www.thegamer.com/no-mans-sky-nms-all-planet-types-explained/
  — NMS Exotic-biome design language: bioluminescent flora as an overlay identity on otherwise calm worlds — confirms base-planet-plus-glow-overlay framing.

## 4. Math / modeling notes (HOW, from the field)

The field doesn't model bioluminescent mats as a landform — there's no geomorphology equation. It's modeled in two decoupled parts: (1) SPATIAL COVERAGE — a biological-distribution mask driven by biosphere maturity (P27, drivers D15/D16). Procedurally this is the same toolkit the research doc already uses elsewhere: a thresholded domain-warped FBM coverage field (research §3.2 warp; the ejecta patchMask at planet-lod-lab.html:760-785 is the in-repo precedent — "continuous near a center, breaking into patches outward"), optionally Worley/Voronoi F2−F1 (research line 103/75) to give discrete colony cells with crisp edges, and thresholded warped-noise contours for the reticulated mat veining (the "fake-Turing" workaround, research line 108, deterministic — avoid true reaction-diffusion since ping-pong breaks re-approach determinism). A single coverage scalar lerps sparse-patches → planet-spanning-mat. (2) EMISSION — model the glow as a Lambert-independent emissive term that BYPASSES the 6-level posterize, added after the quantizer exactly like the lava Worley-crack pulse (research line 103) and the aurora term (planet-lod-lab.html:1597). This is squarely research §2.C Option-C ("emissive + specular get their own channel that skips the clamp"; lines 54-57): albedo glow gets crushed by the Bayer-on-luminance posterize, crisp emissive glow survives. Gate it to the dark hemisphere with the existing nightMask = smoothstep(0.1,-0.1,diff) so the mats appear as the terminator sweeps, and optionally animate with a slow noised() pulse for a living shimmer. MOST PROMISING APPROACH: clone the aurora term — replace its latitude ringMask with a domain-warped-FBM coverage mask (one threshold = colony patches, raise it toward 1.0 for full-mat coverage), keep the nightMask gate and a colored emissive added post-posterize via the bypass path. Add Worley F2−F1 cell edges only if discrete colony rims read better than soft patches under the 4×4 dither. Zero new pipeline — it reuses the emissive-bypass split already wired for lava/aurora/city-lights.

## 5. Isolation recipe (:9223)

Unbuilt — recipe to use once built. (1) Add a feature key to planet-archetypes.js FEATURES, e.g. `bioMats: { label:'Bioluminescent mats (F46)', enableKey:'bioMatsEnabled', archetypes:['tectonic-terrestrial'] }`, and register its folder in featureFolders (planet-lod-lab.html:2515) so the Body-filter per-feature solo (setFeatureEnables, line 2539) can isolate it. (2) Implement the term as an aurora-style emissive clone added at planet-lod-lab.html:1597, with a uBioCoverage uniform and a uBioMatsEnabled gate. (3) To solo: open the Body filter folder, choose solo → `bioMats` (or call setFeatureEnables('bioMats')); base preset = 'Ocean (temperate)' or 'Rocky (Earthlike)' (the habitable bases F46 overlays); turn the Envelope folder's "emissive bypass quantizer" ON. (4) Distances via window._lab.state.distance: ~3 radii to read patch DISTRIBUTION across the disk (sparse-vs-mat), then ~1.3 radii to inspect patch EDGES + glow crispness under the posterize. (5) Set state.spinSpeed > 0 to sweep the terminator and confirm the mats light up only on the night side, like the aurora. Sweep uBioCoverage 0→1 to walk the sparse-patches → planet-spanning-mat variant ladder.

## 6. What to judge (UAT checklist)

- [ ] Does it read as SELF-EMISSION (glowing in darkness) rather than a lit albedo tint, when the terminator sweeps in the 6-level posterized envelope? It must survive on the night side like aurora/city-lights, not vanish into the dark buckets.
- [ ] Does the coverage read as biological PATCHES/colonies — clustered, irregular, organically reticulated — rather than a uniform wash or an obvious noise grid, after the 4×4 Bayer dither?
- [ ] Does sweeping the coverage driver read as a believable maturity ladder: sparse isolated patches → coalescing colonies → a planet-spanning mat, with each stage still legible as form (not just brightness) under posterization?
- [ ] Does the glow stay CRISP (bypassing the quantizer) instead of banding into stair-stepped emissive rings the way a pre-posterize glow would?
- [ ] Does it read as an OVERLAY — does the natural base planet (oceans, relief, terminator) still show through where the mat doesn't cover, rather than the mat replacing the whole surface?
- [ ] Does the emissive color read as bioluminescent (blue-green / yellow-green palette) and distinct from the lava-orange and city-light-white emissive owners sharing the same channel?
- [ ] If animated, does the pulse read as a slow living shimmer rather than a distracting flicker amplified by the dither?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
