# Feature Card — F36 Sunglint off liquid
Domain: Optical · Lab status: ⬜ · Build-seq phase: 4c

## 1. Description (WHAT)

Sunglint off liquid — the mirror image of the star on a body of surface liquid. Physical chain (L1 P26, Optical / atmospheric scattering): where the reflection geometry is satisfied (surface normal bisects sun and viewer), smooth liquid mirrors the star as a bright specular point; surface roughness (wind waves) broadens the point into a glitter patch. Drivers per the inventory: viewing/illumination geometry + presence of surface liquid (with atmosphere/aerosol D5/D6 modulating it). Variability signature: permanent phenomenon, but the spot tracks geometry — it slides across the sea as sun/camera move and exists only on the lit hemisphere. Variants: sharp specular spot on water vs. on a methane/ethane sea (lower index of refraction → dimmer, tinted glint). Real-body examples from the inventory: Earth ocean glint (astronaut/satellite sunglint) and Titan's Kraken Mare glint (Cassini VIMS specular point). WD types: ocean, terrestrial, eyeball. Inventory status: `[aspirational]` — "no specular glint in pipeline" (production); the lab has a stand-in (see §2).

## 2. Current shader approach (HOW, as-built)

Partially built in planet-lod-lab.html as an explicit "sunglint F36 stand-in," but not yet a true F36 (not liquid-masked, not species-aware, not in the solo registry). As-built: Blinn-Phong specular lobe in the emissive/bypass channel — planet-lod-lab.html:1583-1588: `vec3 H = normalize(uLightDir + V); float spec = pow(max(dot(shadeN, H), 0.0), 48.0) * uSpecStrength * step(0.0001, diff);` with optional quantizer bypass `(uSpecBypass == 1) ? specC : posterize(...)`, composited additively at :1597. The channel-split comment at :1574 names this term as the F36 owner in the envelope composite-split (research Option C). Uniforms: uSpecStrength (:1612, GLSL decl :163), uSpecBypass (:1614 area); state knobs specStrength/specBypass (:1868, :1871); GUI in the "Envelope" folder (:2126) — `fEnv.add(state,'specStrength',...)` :2130 and the bypass toggle :2133; frame loop writes it at :2682. Driver side: deriveUniforms in planet-lod-lab-core.js:938 derives `specStrength: hasAtmo ? mix(iron*0.15, 0.8, clamp01(liquidStability/0.5)) : iron*0.15` — so "Ocean (temperate)" presets get a strong glint automatically via the liquidStability master gate (core.js:552-553). What's missing for true F36: the reserved read contracts at planet-lod-lab.html:1783-1784 — `uLiquidMask` ("owner Fluvial; read by Optical (sunglint F36)", value-only, not yet declared in GLSL) and `uLiquidSpecies` ("read by Optical (glint IOR/tint)", declared at :343 but only consumed by the F11 floor-tint at :1550). The current glint fires on the whole surface, land included, with no per-species IOR/tint and no roughness/glitter model. There is also no `sunglint` key in FEATURES (planet-archetypes.js:6-22), so `window._lab.solo()` cannot isolate it.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/photojournal/specular-spectacular/
  — Cassini's Kraken Mare sunglint: the glint is a tiny saturating point pinned to one spot on the sea — a single hot pixel-cluster, not a sheen over the whole mare.
- [real] https://science.nasa.gov/resource/reflection-of-sunlight-off-titan-lake-2/
  — First Titan lake glint (2009): even through thick haze the specular point reads as the brightest thing on the disc — confirms glint should punch through atmosphere terms.
- [real] https://earthobservatory.nasa.gov/images/150321/sunglint-around-milos-and-antimilos
  — Aegean astronaut sunglint: water turns to silver mirror near the specular point; islands stay dark silhouettes — strong liquid-vs-land mask contrast is the read.
- [real] https://science.nasa.gov/earth/earth-observatory/the-science-of-sunglint-84333/
  — NASA's sunglint explainer: roughness (wind) broadens the mirror point into an elongated glitter patch; calm water = tight spot, choppy = wide smeared lobe.
- [art] https://unitywatershader.wordpress.com/2018/05/17/sun-glitter/
  — Sun glitter as tight specular + ripple-normal breakup → shimmering specks; the exact 'sparkle band toward the sun' form our close-up LOD should evoke.
- [art] https://ameye.dev/notes/stylized-water-shader/
  — Stylized water breakdown: highlights/glints carried as a separate crisp term over flat-shaded water — same separation as our spec-bypass channel.
- [art] https://godotshaders.com/shader/pixel-art-water-shader/
  — Pixel-art water with stepped/thresholded specular highlights — proof the glint can read as discrete bright cells inside a quantized palette, matching our 6-level envelope.

## 4. Math / modeling notes (HOW, from the field)

Remote sensing models sunglint with Cox–Munk wave-slope statistics: the sea is a microfacet distribution whose slope variance grows with wind speed; glint radiance is the probability that a facet's normal bisects the sun→surface→viewer geometry, times the Fresnel reflectance at that incidence angle. That is literally the ancestor of game BRDFs — a Blinn-Phong/GGX NDF where exponent/roughness IS wind state, and Fresnel IOR sets brightness/tint (water n≈1.33; liquid methane/ethane n≈1.27 → Titan's glint is intrinsically dimmer, plus tholin-sky tint). Games and the lab's own research doc (research/RESEARCH_high-lod-planet-shaders-2026-06-05.md) converge on the same recipe: "Sun-glint specular + crest foam" — `pow(max(dot(N,H),0), ~200)` on a Gerstner/slope-noise normal, modulated by slope-noise into shimmering specks, with foam before posterize and "glint after/bypass (crisp highlight)" (doc §3 ocean table). The doc's design spine applies directly: route detail through lighting, not hue; the glint is one of the three effects (fire/glint/glow) that look wrong when banded, hence the Option-C envelope composite-split bypass channel the lab already implements. Everything stays deterministic-from-position (no accumulation buffers): glitter breakup comes from spatial slope noise plus the bounded uTime two-phase trick if animated. Most promising shader-side path: keep the existing bypass-channel Blinn-Phong term but (1) gate it by `uLiquidMask` (sea-level cut of the height field, the reserved Fluvial→Optical contract at planet-lod-lab.html:1783) so only liquid glints, (2) drive exponent and strength from a roughness knob (wind) and `uLiquidSpecies` Fresnel/tint (water bright white-blue at exp≈150-250; methane dimmer, warm-tinted, slightly broader), and (3) at close LOD multiply by a slope-noise mask so the single far-distance specular point resolves into a glitter patch of discrete specks that survive — or deliberately skip — the 6-level posterize.

## 5. Isolation recipe (:9223)

Stand-in exists but has NO FEATURES solo key — `window._lab.solo('sunglint')` does not work yet. To isolate today on the :9223 lab: (1) open planet-lod-lab.html in the debug Chrome (chrome-devtools MCP on port 9223, per well-dipper-testing-reference); (2) pick driver preset "Ocean (temperate)" — deriveUniforms auto-sets specStrength≈0.8 via liquidStability — or "Titan (methane seas)" for the species-1 sea; (3) kill competing envelope terms via `window._lab.state`: `emissive=0; limbStrength=0; cloudCoverage=0; auroraIntensity=0`, and set `specStrength=1.0` (or use the Envelope folder sliders, planet-lod-lab.html:2126-2133); (4) the glint lives where the half-vector geometry holds — orbit yaw so the lit hemisphere faces the camera (light is fixed WORLD_LIGHT), and sweep `window._lab.state.distance` between 20 (full-disc: glint = single bright point on the sea) and 3-5 (close-up: judge spot shape/dither behavior); (5) flip `state.specBypass` to A/B crisp-glow vs. quantized glint. Once true F36 is built: register a FEATURES entry in planet-archetypes.js (recommended key `sunglint`, enableKey `sunglintEnabled`, archetypes including 'tectonic-terrestrial'), then `window._lab.solo('sunglint')`, presets "Ocean (temperate)" and "Titan (methane seas)", distances 20 / 8 / 3.

## 6. What to judge (UAT checklist)

- [ ] Does it read as a single sharp specular POINT pinned to the mirror-geometry spot on the disc — not a broad sheen washing over the whole lit hemisphere — in the 6-level posterized envelope?
- [ ] Does the glint track geometry as a behavior: sliding across the sea when the camera orbits, hard-cut to zero past the terminator (the step(diff) gate), never appearing on the night side?
- [ ] Does it read as confined to liquid — adjacent land/ice stays matte while the sea carries the highlight — once uLiquidMask gating lands (today's stand-in fails this by design)?
- [ ] On the bypass channel, does it read as a crisp star-like hotspot floating over the posterized water, rather than concentric banded rings around a quantized blob?
- [ ] Does species read at the form level: water glint bright and cold-white, methane sea glint visibly dimmer and warm-tinted (Titan Kraken read), without needing color fidelity?
- [ ] At close distance, does roughness/slope-noise modulation read as a shimmering glitter patch of discrete specks elongated toward the sun, rather than a static painted dot?
- [ ] Does increasing 'wind/roughness' broaden and dim the spot (Cox–Munk behavior) instead of just scaling brightness?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
