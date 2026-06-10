# Feature Card — F33 Nightside thermal glow
Domain: Thermal · Lab status: 🟡 · Build-seq phase: 4b

## 1. Description (WHAT)

Nightside thermal glow (Thermal domain, F-thermal family) — the permanently dark hemisphere of a tidally-locked hot giant is not black: it self-emits a dim incandescent glow. Physical chain (L0→L1→L2): D7 tidal lock fixes a permanent day/night split; D1 extreme T_eq roasts the dayside; P21 tidally-locked circulation (superrotating day→night winds, D8/D5/D2) carries heat around the terminator, so the nightside stays ~1100 K — hot enough for dull-red Planck self-emission — while mineral vapor condenses there into patchy silicate/sulfide clouds that blanket and break up the glow. Variants per the inventory: dim self-emission + patchy mineral/silicate nightside clouds. Real-body examples: ultra-hot Jupiters — WASP-43b (JWST-mapped: ~1250°C clear dayside, ~600°C cloud-blanketed nightside, eastward-shifted hotspot), WASP-12b. WD type: hot-jupiter (paired with F32 dayside hotspot and F24 thermal day/night). Inventory status: `[current]` (a crude night-side glow exists in production); campaign tracker: 🟡 partial, Phase 4b (atmosphere build).

## 2. Current shader approach (HOW, as-built)

Partial — staged machinery in the lab, combiner unbuilt; crude version in production. In planet-lod-lab.html the dedicated F33 combiner does not exist yet: `uThermalStrength` appears only in comments (planet-lod-lab.html:525; planet-lod-lab-core.js:111) and there is no temperature-field uniform or GUI folder. What IS built and waiting: (1) `emissiveBlackbody(tempK)` GLSL chromaticity ramp at planet-lod-lab.html:529-536, whose header comment (:522-528) names "BANDS thermal (F32/F33)" as a consumer and specifies the drive as `uThermalStrength × starFacing`, added AFTER posterize; (2) its CPU mirror `BB_STOPS`/`emissiveBlackbody()` in planet-lod-lab-core.js:~109-141 (stylized Planckian-locus stops, 800-6500 K); (3) the canonical shared varying `vSubstellarAngle` (vertex shader, planet-lod-lab.html:133-143) that all locked-world features read; (4) the post-posterize emissive bypass channel (Option-C split) at planet-lod-lab.html:1572-1597 where the glow must be summed; (5) debug modes 5 'blackbody ramp' and 6 'substellar angle' (uniform :1625, GUI :2120) for verifying the ramp and angle field. Production (`[current]` in the inventory): src/objects/Planet.js planetType==6 hot-jupiter — `nightSide = max(-dot(normalize(vWorldPos), lightDir), 0.0)` with a fixed deep-red tint `vec3(0.15,0.03,0.01)*nightSide*0.5` in the surface pass (:318-320) plus `vec3(0.12,0.02,0.0)*pow(nightSide,0.8)*0.4` added to finalColor (:373-375); both are added BEFORE `posterize(...)` at :411 (no bypass, so the glow gets quantized) and the hue is hard-coded, not temperature-driven — exactly the two things the lab rebuild should fix.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/asset/webb/hot-gas-giant-exoplanet-wasp-43-b-rotating-global-temperature-map/
  — JWST/MIRI global temperature map of WASP-43b — the day→night brightness gradient, the eastward-shifted hotspot, and the cooler cloud-blanketed nightside are the exact longitudinal profile our T(angle) curve should reproduce.
- [real] https://www.nature.com/articles/s41550-019-0859-z
  — Keating, Cowan & Dang: hot-Jupiter nightsides cluster at a near-universal ~1100 K regardless of irradiation — justifies a constant dim-red nightside FLOOR rather than a glow that fades to black at the antistellar point.
- [real] https://iopscience.iop.org/article/10.3847/2041-8213/ac139f
  — Gao & Powell, 'A Universal Cloud Composition on the Nightsides of Hot Jupiters' — optically thick silicate cloud decks below T_eq ≈ 2100 K; clouds sit ON the nightside and OCCLUDE the glow (dark patches, not bright ones).
- [real] https://www.mpg.de/21875918/0424-astr-jwst-wasp43b-clouds-150980-x
  — MPIA press release with visuals: thick high clouds blanket only the nightside while the dayside stays clear — the asymmetric cloud gating to mimic with a substellar-angle-masked cloud term.
- [art] https://science.nasa.gov/image-detail/clear-to-cloudy-hot-jupiters/
  — NASA 'Ten Clear to Cloudy Hot Jupiters' artist's montage — the hottest planets (WASP-12b, WASP-19b, WASP-17b) are painted with glowing nightsides; note how the glow reads as a rim-to-antistellar dimming wash over a dark disk.
- [art] https://science.nasa.gov/asset/hubble/artists-view-of-extrasolar-planet-wasp-12b/
  — WASP-12b artist's view — near-black light-eating disk with a warm incandescent edge; a good minimal target for how little color the 6-level envelope actually needs to sell 'hot in the dark.'
- [art] https://www.patreon.com/posts/stylized-lava-32245619
  — Minions Art stylized lava shader — crisp emissive glow layered over a flat-shaded base; the bypass-channel look (smooth glow over quantized surface) we already use for F8 lava cracks and should reuse here.

## 4. Math / modeling notes (HOW, from the field)

Academia models this with 3-D GCMs of tidally-locked giants: stellar forcing drives a superrotating equatorial jet that advects the thermal hotspot eastward and sets a heat-recirculation efficiency between dayside re-emission and nightside transport; observations (Spitzer/JWST thermal phase curves) invert to longitudinal brightness-temperature maps like the WASP-43b MIRI map. Two robust empirical anchors: (1) nightside brightness temperatures cluster near ~1100 K for T_eq < 2500 K (Keating/Cowan/Dang 2019), and (2) that uniformity is explained by an optically thick silicate/sulfide cloud deck condensing on the nightside (Gao & Powell 2021) — so the visible nightside glow is cloud-top Planck emission with patchy breaks where the deck thins. Emission color is the blackbody chromaticity at local T; intensity scales ~T⁴ (Stefan-Boltzmann), though stylized renderers use a normalized brightness ramp. In games/demos this is the 'black-body palette ramp + emissive' pattern the research doc catalogs for lava (RESEARCH_high-lod-planet-shaders-2026-06-05.md §3.3), and the doc's Option-C composite-split — add emissive AFTER the 6-level posterize so the glow isn't banded — is the structural home; the gas-giant combiner stack (latitude-banded FBM + recursive domain warp) supplies the underlying cloud texture. Most promising shader-side approach: build a per-fragment temperature scalar from the canonical vSubstellarAngle — a dayside lobe T_day·cosⁿ(angle) with a small eastward longitude offset (superrotation) relaxing onto a constant nightside floor T_night ≈ 0.4-0.5·T_day — and feed emissiveBlackbody(T) × uThermalStrength × normalized-brightness into the existing post-posterize emissive channel. Gate it on the nightside with a low-frequency fbmd() silicate-cloud mask that DARKENS (clouds block outgoing IR), optionally routed through clouds-as-relief so the deck self-shades; this gives F32 and F33 one shared temperature curve, matching the 'ONE curve, two consumers' contract already written into the code comments.

## 5. Isolation recipe (:9223)

Unbuilt in the lab — recommended recipe once built. Wiring prerequisites: register a `thermal` key in planet-archetypes.js FEATURES (e.g. `thermal: { label: 'Thermal day/night (F32/F33)', enableKey: 'thermalEnabled', archetypes: ['irradiated-giant'] }` with a new archetype entry), and add a 'Hot Jupiter (locked giant)' DRIVER_PRESETS bundle (T_eq ≈ 1400 K, tidalState locked, thick atmosphere) so deriveUniforms derives uThermalStrength + nightside floor. Then, in the second Chrome on :9223 (per memory/chrome-devtools-9223-launch.md) with planet-lod-lab.html open: (1) `window._lab.setPreset('Hot Jupiter (locked giant)')` — until that preset exists, `'Lava (hot airless)'` is the nearest locked+hot driver bundle; (2) `window._lab.solo('thermal')`; (3) orbit to the dark hemisphere — set `window._lab.state.yaw` so the camera faces the antistellar point (light dir is the fixed WORLD_LIGHT; debug check: `_lab.uniforms.uDebugMode.value = 6` shows the substellar-angle field, `= 5` the blackbody ramp; reset to 0); (4) judge at `window._lab.state.distance = 6` (full disk: terminator gradient + dark-limb rim), `= 2.5` (nightside fills frame: glow floor + cloud patches), and `= 1.3` (LOD2 close-up: bypass crispness vs dither).

## 6. What to judge (UAT checklist)

- [ ] Does the nightside read as faintly self-luminous — a dull deep-red floor visible with zero starlight — rather than pitch black, surviving the 6-level envelope as a smooth bypass glow instead of a banded gradient?
- [ ] Does hue track temperature along the blackbody ramp — warmer amber/orange near the terminator grading to the dim red antistellar floor — rather than one flat tint multiplied by a mask?
- [ ] Do nightside silicate clouds read as darker occluding blotches ON the glow (they block outgoing heat), never as bright clouds, with patchy low-frequency form?
- [ ] Does the day→night transition read continuous with F32 — the eastward-shifted hotspot bleeding past one limb of the terminator (superrotation asymmetry) instead of a symmetric cosine falloff?
- [ ] Does the glow bypass the quantizer cleanly — crisp smooth emission layered over the posterized surface with no Bayer dither crawl inside the glow itself, matching the F8 lava-crack channel's behavior?
- [ ] At full-disk distance, does the dark limb read as a thin warm rim that keeps the planet's silhouette legible against space, rather than the disk vanishing?
- [ ] As the camera orbits, does the glow stay locked to the substellar geometry (fixed toward the star) — no drift with view direction — confirming it's driven by vSubstellarAngle, not a view-space hack?

## 6.5 Build plan (working-Claude, 2026-06-10 — Phase 4b heavy loop)

Built TOGETHER with F32 as one shared temperature curve ("ONE curve, two
consumers" — the contract already written into the emissiveBlackbody header).
Full plan: F32 card §6.5. F33's share: the `nightsideThermal` FEATURES key
(enableKey `nightsideThermalEnabled`, PROV_NIGHTTHERM = 31), the uNightTempK
floor (driven 1100 K — the Keating universal nightside), the night-hemisphere
silicate-cloud occlusion mask (low-freq fbmd, DARKENS the glow, patchy), and
the thin warm limb rim for silhouette legibility. Disable semantics: the
per-frame writer collapses uNightTempK → 0 (floor fades to black, occlusion
off) while F32's dayside lobe survives independently. v1 cuts logged on the
F32 card (warm-variant preset, 2-axis latitude falloff, occlusion
self-shading).

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: **🟡 taste-call — VERIFIED_PENDING_MAX** (2026-06-10, Phase 4b heavy loop; built+verified with F32 — shared curve, full detail on the F32 card §7)
- Evidence (repo root, gitignored): `F33-night.png` (d6 antistellar: mean disc luminance 15.9, RGB 33/12/3 — dull deep-red self-luminous floor, clearly not black), `F33-night-close.png` (d2.5: glow smooth, mean abs neighbor diff 0.011, zero Bayer crawl), `F33-off.png` + `F33-off-term.png` (nightsideThermalEnabled false ⇒ night disc 0.024 mean lum — black except lightning pops — while the F32 dayside lobe survives at the terminator).
- §6 checklist: 1 🟢 (self-luminous floor, smooth bypass glow), 2 🟢 (warmer 37/16/8 near the terminator-side limb fading to 33/12/3 deep-night; gradient limb-compressed at exact antistellar aim — geometric, the curve lives near the terminator), 3 🟢 (occlusion blotches exclusively DARKER — dips to 12.4 against the 15.8 floor, ~10 % of area, never bright), 4 🟢 (continuous with F32; eastward asymmetry verified on the F32 card item 2), 5 🟢 (no dither crawl in the glow), 6 🟢 (limb annulus +13 % over interior — thin warm rim, silhouette legible), 7 🟢 (orbit-lock — world-space, verified F32 item 5).
- Tweaks applied: 0 of 3 cycles.
- Code review (fable): APPROVE (shared review with F32; ownership-split write-order verified — the F32-off collapse uses the post-split night value; emissiveBlackbody(0) safe below its first stop).
- Taste forks for Max's lap: (a) occlusion contrast is subtle (12.4 vs 15.8 floor — uThermalOcclusion knob 0..1 exists, driven default 0.6); (b) night floor brightness (Keating 1100 K driven — nightTempK display only); (c) rim strength (GLSL literal ×0.6).
- Status: VERIFIED_PENDING_MAX
