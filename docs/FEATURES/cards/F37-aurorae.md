# Feature Card — F37 Aurorae
Domain: Optical · Lab status: 🟡 · Build-seq phase: 4c

## 1. Description (WHAT)

F37 Aurorae (domain: Optical, family F-optical). Physical chain: D13 magnetic field (fieldStrength = ironFraction × rotation/lock factor — a tidally-locked slow spinner gets 0.2×) is a HARD gate (P24): no field → no aurora; the same D13 field also gates atmosphere retention, so unshielded worlds lose the whole weather stack. With field > 0.05 and a retained atmosphere (D4/D6), stellar-wind charged particles funnel along field lines and precipitate near the magnetic poles → auroral ovals (P24). Variants: polar ovals; ring latitude and width scale with field strength (stronger field → narrower ring closer to the pole); color keyed to atmosphere composition (n2-o2 green, h2-he blue-purple, co2/co2-n2 pink-red, methane blue-green). Variability signature: transient flicker, steady oval geometry; intensity axis from none (no field) to bright persistent polar ovals. Real-body examples: Earth (green O-line ovals), Jupiter and Saturn (UV H2 ovals; Saturn's oval shrinks/brightens with solar-wind pressure). WD types: terrestrial, gas, ocean, city-lights — terrestrial is the richest carrier. Inventory status: [current] (physics-gated).

## 2. Current shader approach (HOW, as-built)

Built — a deliberately minimal lab stand-in plus a fuller production version. Lab (/home/ax/projects/well-dipper/planet-lod-lab.html): fragment-shader block at lines 1589–1595 — latitude proxy lat = N.y; Gaussian ring mask exp(-((|lat|-0.7)/0.12)^2) at FIXED latitude/width; nightMask = smoothstep(0.1,-0.1,diff) so it lives in darkness/twilight; rays = 0.5+0.5*noised(N*8 + uTime*0.1).x (analytic-derivative noise core); hard-coded green vec3(0.3,0.9,0.5); summed additively at line 1597 in the ★ EMISSIVE bypass family (lines 1572–1574) that skips the 6-level posterizer (Option-C channel). Driver: uniform uAuroraIntensity (decl line 169, init line 1618, default 0) written by applyDrivers at line 2171 from deriveUniforms in /home/ax/projects/well-dipper/planet-lod-lab-core.js — magneticField = iron × (locked?0.2:1.0) at line 589, auroraIntensity = magneticField × (hasAtmo?1:0) at line 939. No dedicated GUI folder/knob and NO solo key in planet-archetypes.js FEATURES (that registry covers relief features only). Production reference implementation: /home/ax/projects/well-dipper/src/generation/PlanetGenerator.js:435–487 derives {color-by-composition, intensity = min(1, field×windIntensity×0.15), ringLatitude = 0.7+field×0.2, ringWidth = 0.15-field×0.08} behind the field>0.05 gate; /home/ax/projects/well-dipper/src/objects/Planet.js:169–200 applyAurora() renders Gaussian ring + 2-octave snoise curtain in (azimuth, lat, time) + hue shift along the ring. Lab gap vs production: composition color, field-driven ring latitude/width, and curtain/hue structure are not yet wired into the lab stand-in.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/earth/earth-observatory/image-spacecraft-pictures-aurora-6226/
  — IMAGE spacecraft view of Earth's full auroral oval from a distance — the exact form WD draws: a closed luminous ring at high latitude, brighter on the midnight sector, not a polar-cap fill.
- [real] https://science.nasa.gov/earth/earth-observatory/photographs-of-auroras-from-space-4106/
  — ISS oblique astronaut photos — green curtain band with red upper fringe, fine vertical ray striations, glow hovering visibly ABOVE the limb rather than painted on the surface.
- [real] https://esahubble.org/images/opo9804b/
  — Hubble UV complete view of Jupiter's aurorae — tight blue-purple main oval on an H2-He giant (the composition-color variant) plus moon magnetic footprints; oval is narrow and pole-hugging because the field is strong.
- [real] https://esahubble.org/images/heic0504a/
  — Saturn's dynamic aurorae — the oval brightens and SHRINKS in diameter under solar-wind pressure: the ring latitude/width-by-field-and-wind behavior axis WD's variants call for.
- [real] https://svs.gsfc.nasa.gov/31375/
  — NASA SVS ISS video of the Nov 2025 geomagnetic storm — the temporal signature: slow shimmering flicker and equatorward storm expansion while the overall oval geometry stays steady.
- [art] https://godotshaders.com/shader/volumetric-aurora-borealis-with-polar-reflection/
  — Stylized Godot aurora — shows how few layered noise sheets it takes for 'curtain' to read; the striation frequency (high in azimuth, smeared in altitude) is the load-bearing cue.
- [art] https://80.lv/articles/realistic-aurora-borealis-effect-made-in-godot-engine
  — Godot raymarch + NoiseTexture aurora breakdown — evidence that aurora reads correctly as a pure emissive luminance effect, which is exactly what survives WD's bypass channel.
- [art] https://captainskolot.itch.io/4-beautiful-aurora-borealis-backgrounds-assets-pixelart-pixel-art-sprite-wate
  — Pixel-art aurora backgrounds — flat-color banded curtains over a dark sky: the closest analog to how a posterized-era aurora should read; note green dominant with sparse magenta accents, not gradients.

## 4. Math / modeling notes (HOW, from the field)

Physics: precipitating electrons follow dipole field lines into the upper atmosphere along the auroral oval — the footprint of the open/closed field-line boundary. Oval radius is set by magnetosphere geometry: stronger dynamo → oval closer to the magnetic pole and narrower; solar-wind pressure expands it equatorward during storms (Saturn shows the inverse shrink-when-bright). Emission color is line emission keyed to species: OI 557.7 nm green / 630 nm red (N2-O2), H Balmer blue-purple (H2-He giants), CO2-dissociation pink — i.e., color is a lookup on D4 composition, which PlanetGenerator.js:463-469 already encodes as an auroraColors table. Earth's magnetic axis is offset ~11° from the spin axis, so a tilted ring axis (replace |N.y| with |dot(N, magAxis)|, magAxis hashed per seed) is the cheapest realism multiplier. Games/demos model orbital-view aurora not as a raymarched volume but as an additive emissive band on the night hemisphere: Gaussian ring in magnetic latitude × animated noise "rays" (curtain striations: high frequency in azimuth, low in latitude) × slow flicker; full raymarched curtain sheets (the Godot/Shadertoy volumetric approach) are only worth it at LOD2 grazing angles. In the research doc's vocabulary this is a textbook ★ emissive-bypass (Option C) effect: it is pure luminance glow, it looks wrong when banded, and it belongs with lava cracks/sunglint/city-lights in the channel that skips posterize(); rays come from the shared analytic noised() core, and as weather-layer animation (Q4 resolved) its time term needs no cross-visit determinism — bounded/periodic time is enough. Most promising shader path: keep the existing additive night-masked Gaussian-ring × noised()-rays term on the bypass channel, but promote its constants to uniforms fed from deriveUniforms exactly as the generator computes them — uAuroraRingLat/uAuroraRingWidth from magneticField, uAuroraColor from D4 composition, plus a seeded tilted magnetic axis. Then add a second, slower noise term for flicker and an azimuth-frequency ≫ latitude-frequency striation so curtains read at 6 levels; the production applyAurora() (Planet.js:178-200) is already 90% of this and just needs the lab stand-in upgraded to match it.

## 5. Isolation recipe (:9223)

Built, but NOT solo-able via window._lab.solo() — aurora has no key in planet-archetypes.js FEATURES (relief-only registry), so isolate by driver preset + manual uniform instead. On the :9223 second Chrome (chrome-devtools MCP, per well-dipper-testing-reference.md): (1) open planet-lod-lab.html; (2) window._lab.setPreset('Rocky (Earthlike)') — iron 0.32, unlocked, atmosphere retained → uAuroraIntensity ≈ 0.32 via deriveUniforms; (3) crank for inspection: window._lab.uniforms.uAuroraIntensity.value = 1.0; (4) silence competing emissive/optical terms: uniforms.uEmissive.value=0, uSpecStrength.value=0, uLimbStrength.value=0, uCloudCoverage.value=0; (5) it is night-masked — orbit the camera to the dark hemisphere (state.yaw/state.pitch) and look at a pole near the terminator; (6) distances: window._lab.state.distance = 15 (oval-as-ring read, GUI range 1.1–30 radii), then 4 for the ray/curtain striation read. Gate checks: setPreset('Frozen (airless)') and 'Lava (hot airless)' → aurora vanishes (no atmosphere; Lava is also locked → 0.2× field), setPreset('Europa (icy moon)') → vanishes (airless + locked). Best preset overall: 'Rocky (Earthlike)'; 'Ocean (temperate)' is the second carrier (iron 0.28, atmo retained).

## 6. What to judge (UAT checklist)

- [ ] Does it read as a closed polar RING pinned at high latitude in the 6-level envelope — a luminous oval with a dark polar cap inside it, not a cap fill and not an equatorial band?
- [ ] Does the ray structure read as curtain striations — fine breakup along azimuth, smeared along latitude — rather than uniform glow or isotropic noise speckle?
- [ ] Does it behave as a night-side phenomenon — present in darkness, fading through twilight at the terminator, never visible on the lit hemisphere?
- [ ] Does it read as a crisp self-luminous glow floating over the dithered surface (emissive-bypass channel) rather than a band of posterized surface paint?
- [ ] Does presence track the physics gate as behavior — clearly there on Rocky/Ocean presets, cleanly absent on Frozen/Lava/Europa (no atmosphere or weak locked-dynamo field)?
- [ ] Once field-driven variants are wired: does a stronger field read as a tighter, narrower, brighter ring closer to the pole, and a weaker field as a wider, more diffuse, lower-latitude ring?
- [ ] Does the animation read as slow shimmer/flicker of the rays while the oval geometry itself stays steady — no strobing, no ring wandering?
- [ ] Is the color identity legible at 6 levels — dominant green on N2-O2 worlds, distinguishable from city-lights amber and lava orange if those variants share a night side?

## 6.5 Build plan (working-Claude, 2026-06-10 — Phase 4c heavy loop)

Strategy: upgrade the lab stand-in to production parity (§4: "applyAurora()
is already 90% of this") — constants → uniforms fed per the generator's
derivations, plus registration. Exemplars `3587fab`/`7341437`/`9a3aed4`.

1. **Register** — `aurora` in FEATURES (archetypes: tectonic-terrestrial,
   gas-giant, hot-jupiter — terrestrial richest carrier, giants get UV
   ovals) + featureFolders + `auroraEnabled` default true + GUI folder
   "Aurorae (F37)" in Surface — Optical (driven `.listen()`: intensity,
   ringLat, ringWidth, color; ✓ enable LAST).
2. **Uniforms** — uAuroraColor (vec3), uAuroraRingLat, uAuroraRingWidth,
   uMagAxis (vec3). Shader: replace the fixed-constant block — magnetic
   latitude `mlat = dot(N, uMagAxis)` (axis seeded ~11° off spin axis,
   hashed from uSeed if available else authored constant), Gaussian ring
   `exp(-t*t)` with t=(|mlat|-uAuroraRingLat)/uAuroraRingWidth (no
   pow(neg)), KEEP nightMask + emissive-bypass channel (never posterized).
3. **Curtain striations** — anisotropic rays: noise frequency HIGH in
   azimuth, LOW in latitude (e.g. noised(vec3(atan2-azimuth*K_hi,
   mlat*K_lo, phase))-style or stretched-domain noised); clamp/guard
   atan inputs. Add a second slower noise term for flicker. Bounded/
   periodic time OK (weather-layer class).
4. **applyDrivers derivation** (core.js OFF-LIMITS) mirroring
   PlanetGenerator.js:435-487: gate field>0.05; ringLat = 0.7+field·0.2;
   ringWidth = 0.15−field·0.08; intensity from existing core
   auroraIntensity; color by D4 composition (n2-o2 green [0.3,0.9,0.5],
   h2-he blue-purple, co2/co2-n2 pink-red, methane blue-green).
5. **Venus override (4b carry-over)** — F31 §7 fork (a): core keys
   magneticField on lock-flag so Venus (slow rotator, no dynamo) derives
   aurora 0.3, physically wrong + invisible under the opaque blanket
   anyway. applyDrivers zeroes aurora when cloudRegime==3. Logged here +
   in F31 §7 as resolved-by-F37.
6. **Plumbing** — PROV_AURORA=35 + PROVINCES neutral row + provinceWeight
   row + GLSL_NAME line; frame writer sole uniform owner.

v1 scope cuts (logged, not built): solar-wind storm expansion dynamics
(Saturn shrink-when-bright); moon magnetic footprints; LOD2 raymarched
curtain sheets; red upper-fringe second emission line.

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: **🟡 taste-call — VERIFIED_PENDING_MAX** (2026-06-10, Phase 4c heavy loop)
- Evidence (repo root, gitignored): `F37-rocky-ring.png` (closed annulus 24/24 azimuth bins; cap mean diff 0.54 vs ring 4.30/peak 378; ring radius 161.4 px vs 163 predicted), `F37-rocky-curtain-d4.png` (15 discrete rays/188°, along-vs-across HF anisotropy 1.8×), `F37-jovian-ring.png` (blue-purple tight oval, B-max dRGB), `F37-neptunian-ring.png` (fix-cycle evidence) + supporting A/B frames.
- §6 checklist: polar ring w/ dark cap 🟢 · curtain striations 🟢 (azimuthal breakup, smooth across-ring bump) · night-side only 🟢 (lit hemisphere 58/2M px; twilight falloff 1.9×) · emissive-bypass crispness 🟢 (94 contiguous luminance values vs posterized surface clusters) · physics gate 🟢 (Frozen/Lava/Europa/Venus all 0; Venus = the F31 fork-a fix confirmed) · field-driven geometry 🟢 (Rocky 0.764/0.124 vs Jovian 0.82/0.102, pixel-confirmed tighter+narrower) · steady-geometry flicker 🟢 (ring radius 0.3 px stable over 2 s while ray pattern redistributes) · color identity 🟢 (Rocky G-max [2.1,5.1,2.4], Jovian B-max [2.0,1.1,4.9]). Tilted axis: magAxis 11.0° off +y; ring centered on mag pole (radial std 7.9 px vs 38.6 around geo pole).
- Live drivers: Rocky 0.32 / Ocean 0.28 / Titan 0.18 / Sub-Neptune 0.10 (deliberately un-boosted, regime-2 featureless) / Eyeball 0.06 / Jovian+Saturnian+Neptunian+HotJupiter 0.6 via M1 metallic-hydrogen dynamo boost (lat 0.82, width 0.102, h2-he blue-purple) / Venus 0 (regime-3 override) / airless 0.
- Tweaks applied: 1 of 3 cycles — Neptunian (r 3.9) missed the giant-dynamo radius cutoff ≥6 → intensity 0; lowered to ≥3.5 (ionic-water dynamo, still excludes Sub-Neptune r 2.7). Re-verify: targeted PASS (0.6/0.82/0.102/blue-purple exact; Sub-Neptune 0.10 and Rocky 0.32 untouched).
- Code review (fable): APPROVE-WITH-FIXES, both applied pre-verify. M1: registration↔render-set disagreement both directions → added volatile-cold (Titan's live 0.18 oval) + the radius-scoped dynamo boost (Jupiter/Saturn are the card's canonical examples; iron-only core D13 can't express giant dynamos; core off-limits). N1 comment correction. Notes: nightMask reversed-edge smoothstep (spec-undefined since the stand-in) rewritten provably-identical; Sub-Neptune aurora-vs-lightning asymmetry is deliberate (aurora emits ABOVE the haze in the ionosphere; lightning flashed from BELOW the deck — the F31 kill doesn't apply); production applyAurora has the curtain anisotropy BACKWARDS vs the card's research (lab follows the card; production-parity follow-up logged).
- v1 cuts (additional): hue-shift-along-ring (Planet.js:195-198) not ported.
- Taste forks for Max's lap: (a) dynamo boost constant 0.6 + radius cutoff 3.5 authored, not derived; (b) Eyeball's barely-over-gate 0.06 oval on the permanent night side; (c) Titan reads GREEN (its preset declares n2-o2, physically right) — methane-teal table row exists but no preset triggers it; (d) Neptunian oval reads dim at d15 (showcase shots need closer range).
- Status: VERIFIED_PENDING_MAX
