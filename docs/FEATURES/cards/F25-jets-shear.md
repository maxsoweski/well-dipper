# Feature Card — F25 Jets & shear turbulence
Domain: Bands · Lab status: 🟡 · Build-seq phase: 4b

## 1. Description (WHAT)

F25 "Jets & shear turbulence" (F-bands domain) is the dynamic edge-detail of zonal banding: where alternating prograde/retrograde jets meet, wind shear rolls the cloud deck into turbulence. Physical chain: D8 rotation rate (fast spin drives zonal organization; PlanetGenerator.js:659-665) → P16 zonal banding (differential heating + rotation organize deep convection into alternating prograde/retrograde latitude bands — condensation brightens zones, sinking clears belts; permanent, drifting/fading over years) → F25 as the shear expression at band boundaries. Variants: equatorial superrotation jet (widest, fastest band — also the eastward-shifted hotspot mechanism on hot Jupiters, cf. P21/F32) · counter-rotating jet shear (adjacent bands moving opposite ways, Kelvin-Helmholtz roll-up at the interface) · festoon/scallop turbulence (one-sided hooks/plumes trailing off a belt edge, e.g. Jupiter's NEB festoons bounded by dark hot spots). Real examples: Jupiter belt edges (prograde jets to ~140 m/s vs retrograde ~60 m/s, turbulent "folded filamentary regions" at boundaries); Venus's superrotating cloud deck. WD types: gas, hot-jupiter, venus. Inventory status: [partial] — generic turbulence exists in the production gas-giant shader; no directional shear, jets, or festoons anywhere.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) in world-engine-lab.html — the lab is solid-surface only: its FEATURES taxonomy (planet-archetypes.js:6-22) has no gas/jets key, no gas archetype (planet-archetypes.js:26-32), and no gas-giant DRIVER_PRESET (world-engine-lab.html:2149-2155). The lab's "band" hits are unrelated solid-world systems (F22 PLD strata pldBands() at world-engine-lab.html:1420; Ganymede grooved bands at :1194-1220). Nearest existing machinery is the PRODUCTION gas-giant fragment shader, GAS_BODY in src/objects/Planet.js:248-265: a sin(lat) band stack plus isotropic snoise turbulence weighted by `turb * (1.0 - abs(bands))` (Planet.js:261) — i.e., turbulence already concentrates at band-function zero crossings (belt/zone edges), which is a static, non-directional proxy for shear. A lab build would add a gas preset to DRIVER_PRESETS, a 'jets' FEATURES key, and route the band/jet field through the existing deriveUniforms → applyDrivers pipeline (world-engine-lab.html:2164, 2288).

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/photojournal/junocam-captures-a-northern-jet-on-jupiter/
  — JunoCam northern jet — the jet reads as a coherent bright linear streak with turbulent eddies hanging off its flanks, not uniform speckle.
- [real] https://apod.nasa.gov/apod/ap970310.html
  — Galileo close-up at a belt-zone boundary — the canonical shear read: bright zone meets dark belt with rolled-up Kelvin-Helmholtz-style vortices strung along the interface.
- [real] https://svs.gsfc.nasa.gov/11204/
  — NASA SVS on Jupiter's hot spots — festoons are ONE-SIDED hooks trailing southwest off dark equatorial hot spots; directionality, not symmetric swirl, is the signature.
- [real] https://en.wikipedia.org/wiki/Atmosphere_of_Jupiter
  — Zonal wind profile chart u(latitude) — alternating prograde/retrograde jets peaking at belt-zone boundaries; this is the analytic curve a shader should encode.
- [art] https://medium.com/@barth_29567/procedural-gas-giants-f2a61bc6bd97
  — Paleologue's procedural gas giants — latitude-stretched FBM + domain warp gives the full banded-fluid read with very few ingredients; matches our budget.
- [art] https://parallelcascades.com/gas-giant-curl-simulation/
  — Unity gas-giant curl simulation — divergence-free curl-noise advection produces festoon-like filaments that curl without pooling; the look target for animated shear.
- [art] http://johnwhigham.blogspot.com/2011/11/gas-giants.html
  — Whigham's classic gas giants — band palette ramp indexed by warped latitude; proof the whole feature can live in luminance/ramp space, which is what survives our posterize.
- [art] https://helianthus-games.itch.io/pixel-art-planets
  — Pixel-art planet pack — gas giants at tiny scale: bands + dither alone carry the identity; benchmark for how F25 must still read inside a 6-level envelope.

## 4. Math / modeling notes (HOW, from the field)

Academia models zonal jets as 2D beta-plane turbulence: an inverse energy cascade arrested at the Rhines scale organizes eddies into alternating zonal jets, giving an analytic zonal wind profile u(lat) with prograde peaks at zone-belt boundaries (Jupiter: ~140 m/s prograde vs ~60 m/s retrograde); shear instability (Kelvin-Helmholtz) at jet flanks produces the rolled vortices, and "folded filamentary regions" / festoons appear where shear is strongest, bounded by 5-µm hot spots (equatorially trapped Rossby-wave troughs). Games and demos skip the dynamics and encode the RESULT: per the project research doc (research/RESEARCH_high-lod-planet-shaders-2026-06-05.md §3.2-3.3), the gas-giant LOD2 stack is latitude-banded FBM (vertical-stretch `p.y *= 2.5`) + recursive domain warp (`q=fbm(p+o); r=fbm(p+4q+o); fbm(p+4r)`, sampling bands at `latitude + warpStrength*warp`) + per-band longitudinal scroll `p.x += time*bandSpeed(lat)` with ALTERNATING SIGN = counter-rotating jets, animated through the two-phase flow-map primitive (`mix(n0,n1,w)` with phase0/phase1 offset 0.5) so detail flows without accumulation buffers, deterministically on bounded/periodic time. Curl-noise (`v=(dPsi/dy,-dPsi/dx)` of an FBM potential) supplies divergence-free festoon filaments; the sphere-tangent-frame fork (research doc §188) is the flagged risk for advection near poles. All of it routes through high-contrast luminance, so it survives the 6-level Bayer posterize. Most promising shader-side approach: define an analytic u(φ) as a sum of alternating-sign Gaussians centered on band edges, scroll longitude by u(φ)·t (periodic time), and make domain-warp amplitude proportional to |∂u/∂φ| so turbulence concentrates exactly at jet flanks — generalizing the existing `(1.0 - abs(bands))` gate in Planet.js:261. Stamp festoons as curl-noise hooks masked to one flank of the equatorial band, biased in the shear direction.

## 5. Isolation recipe (:9223)

Unbuilt — recipe once built: (1) add a 'Gas giant (Jovian)' entry to DRIVER_PRESETS (world-engine-lab.html:2149) and a 'jets' key to FEATURES in planet-archetypes.js (label 'Jets & shear (F25)', enableKey 'jetsEnabled', new archetype 'gas-banded' with presets ['Gas giant (Jovian)']). (2) On the :9223 debug Chrome (chrome-devtools MCP, per memory/chrome-devtools-9223-launch.md), open the lab and run `window._lab.setPreset('Gas giant (Jovian)')` then `window._lab.solo('jets')` — solo zeroes every other feature's enable for a clean A/B (clear with `window._lab.enableAllFeatures()`). (3) Judge at three camera distances via `window._lab.state.distance` (radii, clamp 1.1-30): 20 = full disk (do bands + jet edges read at all?), 5 = belt-edge scallops/festoons emerge, 2 = LOD2 close-up (lodRamp high — does shear turbulence carry detail without breaking band silhouettes?). Base F24 banding should ideally be a separate 'bands' key so F25's solo shows ONLY the shear/turbulence delta against a flat band field.

## 6. What to judge (UAT checklist)

- [ ] Does turbulence concentrate at band boundaries (where the shear lives) rather than speckling the whole disk uniformly, in the 6-level posterized envelope?
- [ ] Do festoons read as one-sided directional hooks trailing off a belt edge in a consistent direction — wind shear — not as symmetric blobs or mirrored swirls?
- [ ] Does the equatorial jet read as the widest, most coherent band, with its flanks the most turbulent latitudes on the disk?
- [ ] Under animation, do adjacent bands drifting in opposite directions read as counter-rotating shear, without crawling/aliasing against the 4x4 Bayer dither?
- [ ] Does jet/shear detail survive as luminance contrast and dither texture (not subtle hue gradients that the posterize crushes)?
- [ ] At distance ~20 radii do bands collapse to 2-3 clean stripes; at ~2 radii do scallops and filaments emerge WITHOUT destroying the band silhouette that defines the world's identity?
- [ ] Do shear vortices at a belt-zone interface read as rolled-up forms strung along a line (Kelvin-Helmholtz train), not random noise patches?

## 6.5 Build plan (working-Claude, 2026-06-10 — Phase 4b heavy loop)

F24 landed the substrate (gas-giant archetype, 3 h2-he presets, zonalBandCol with bandCoord ladder + recursive warp, PROV_BANDS, gas shadeN flatten). F25 adds the DYNAMICS on top: an analytic jet profile, counter-rotating longitudinal drift, shear-gated boundary turbulence, and one-sided festoons. All luminance, no relief.

1. **Data:** FEATURES `jets` { label 'Jets & shear (F25)', enableKey 'jetsEnabled', archetypes ['gas-giant'] } (reuse F24's archetype — do NOT create the card's suggested 'gas-banded'; one gas archetype). PROVINCES `jets` { field: 2, polarity: +1, floor: 1.00 } neutral. PROV_JETS = 23 + GLSL row + GLSL_NAME line.
2. **Jet profile u(φ):** analytic, derived from the SAME bandCoord ladder F24 uses (pre-warp): u = sin(2π·bandCoordBase) — alternating sign per stripe, peaks at zone-belt boundaries — plus an equatorial superrotation term: wide Gaussian at lat 0, amplitude ~1.6× (the widest, fastest band; §6 item 3). shearGate = |du/dφ| proxy: cos² of the same phase (peaks at boundaries) + equatorial-flank boost.
3. **Drift (uTime enters HERE — F24 stays static):** differential rotation of the WARP-NOISE sampling domain only: rotate p around the spin axis (y) by angle u(φ)·uJetSpeed·phase — latitude is y-invariant so band identity is untouched. Use the research doc's two-phase flow-map (§3.2-3.3: two copies at phase fract(t), fract(t+0.5), each rotation bounded ±half-period, triangle crossfade) so shear never accumulates unboundedly and the pattern is deterministic on bounded time. Read research/RESEARCH_high-lod-planet-shaders-2026-06-05.md §3.2-3.3 before writing this.
4. **Shear turbulence:** a second, higher-frequency fbm warp term added to bandCoord, amplitude = uJetShearTurb · shearGate — generalizes the legacy (1.0 − abs(bands)) gate; turbulence concentrates AT boundaries (§6 item 1), reads as a rolled KH train strung along the interface because the posterize quantizes the scalloped displacement (§6 item 7).
5. **Festoons (v1 minimal):** one-sided hooks off the equatorial belt's flank only: noise-gated displacement applied asymmetrically (single sign, single flank band of latitude), amplitude uJetFestoon. Direction consistency = the sign convention (§6 item 2). If it muddies, drop to 0 default and mark taste-call (3-cycle cap applies).
6. **Wiring:** uniforms uJetStrength/uJetSpeed/uJetShearTurb/uJetFestoon (+ lab knobs uJetTurbFreq, uJetEqWidth); state defaults; per-frame writes gated on jetsEnabled; applyDrivers — jetStrength = _gas gate, jetSpeed ∝ 1/rotationHours, shearTurb + festoon on the same T_eq vigor ramp as F24; jetOffset reset. GUI folder (driven .listen(), 🎲, ✓ LAST), featureFolders. The jets GLSL terms key on uJetStrength ONLY (not uBandStrength) so solo('jets') shows the pure shear delta per card §5.
7. **Tuning pre-check:** displacement budget in STRIPE units again (F24's lesson): peak turb displacement ≤ ~0.3 stripe at boundaries, festoon ≤ ~0.5 local. Verify u(φ) sign alternation across 3 presets numerically.

v1 scope cuts: true curl-noise advection + sphere-tangent flow (research doc's flagged risky spike) → not in v1, drift is domain rotation; storm vortices → F27/F28; Venus superrotating deck → covered implicitly by the gas gate only if a Venus-type h2-he... it is NOT (Venus is co2) — Venus variant deferred to Phase-5/6 (driver gate is h2-he in v1, logged).

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: **🟡 taste-call — VERIFIED_PENDING_MAX** (2026-06-10, Phase 4b heavy loop)
- Evidence (repo root, gitignored): `F25-ab-on/off/diff.png` (jets ON/OFF at d5 Jovian — 34,498 px delta, ALL inside the disc, concentrated in horizontal stripes AT band boundaries with the strongest cluster at the equatorial flank: §6 items 1+3 read directly off the diff), `F25-regress-jetsoff.png` (jets-off vs pre-F25 baseline `F24-stab-a.png`: **0 changed pixels in the render canvas** — the bandWarpField extraction is render-identical, F24's regression contract closed), `F25-anim-t0/t1.png` (4 s apart, jets on: 1,245 px drift vs ~250 temporal floor — drift alive), `F25-frozen-t0/t1.png` (jetSpeed 0: **0 px in 3 s** — time enters ONLY via the speed-scaled rotation).
- Live drivers (Jovian): strength 1, speed 0.808, shearTurb 0.297, festoon 0.444 — matches the implementer's pre-check table (u(φ) sign alternates at every boundary, equatorial Gaussian 1.6× and widest, shearGate maxima exactly at boundaries, displacement budgets 0.267/0.400 stripe units under the caps).
- §6 checklist: 1 🟢 (boundary concentration — diff evidence), 3 🟢 (equatorial jet), 5 🟢 (luminance/dither), 6 🟢 (d20 stripes clean per regression shot; d5 scallops keep silhouettes). 2 🟡 (festoon hooks visible near the equatorial flank; ONE-SIDEDNESS is analytic — single-sign max(0,tn) on one flank — but needs Max's eye to confirm it reads as wind). 4 🟡 (counter-rotation: alternation verified analytically + drift verified live; per-band direction read on posterized scallops defeated row cross-correlation — a Max-eye item under animation). 7 🟡 (boundary trains visible; "rolled KH forms" is a taste read).
- Tweaks applied: none — 0 of 3 cycles used (F24's displacement-budget lesson was baked into the §6.5 plan).
- Code review (fable): no blockers, no should-fix. Nits: rotation-bound comment corrected (applied); uJetEqWidth zero-guard declined (matches lab-knob trust pattern). Reviewer's open bit-identity item closed by the 0-px regression diff above.
- Taste forks for Max's lap: (a) festoon strength/shape (0.444 — v1-minimal hooks; could be richer curl filaments); (b) drift rate (25 s phase cycle — slow churn); (c) whether counter-rotation reads under live animation.
- Scope cuts (per §6.5): true curl-noise advection + sphere-tangent flow spike → not v1; Venus superrotating deck → driver gate is h2-he only, Venus variant deferred to Phase 5/6; storm vortices → F27/F28.
- Status: VERIFIED_PENDING_MAX
