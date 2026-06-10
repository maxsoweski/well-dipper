# Feature Card — F25 Jets & shear turbulence
Domain: Bands · Lab status: 🟡 · Build-seq phase: 4b

## 1. Description (WHAT)

F25 "Jets & shear turbulence" (F-bands domain) is the dynamic edge-detail of zonal banding: where alternating prograde/retrograde jets meet, wind shear rolls the cloud deck into turbulence. Physical chain: D8 rotation rate (fast spin drives zonal organization; PlanetGenerator.js:659-665) → P16 zonal banding (differential heating + rotation organize deep convection into alternating prograde/retrograde latitude bands — condensation brightens zones, sinking clears belts; permanent, drifting/fading over years) → F25 as the shear expression at band boundaries. Variants: equatorial superrotation jet (widest, fastest band — also the eastward-shifted hotspot mechanism on hot Jupiters, cf. P21/F32) · counter-rotating jet shear (adjacent bands moving opposite ways, Kelvin-Helmholtz roll-up at the interface) · festoon/scallop turbulence (one-sided hooks/plumes trailing off a belt edge, e.g. Jupiter's NEB festoons bounded by dark hot spots). Real examples: Jupiter belt edges (prograde jets to ~140 m/s vs retrograde ~60 m/s, turbulent "folded filamentary regions" at boundaries); Venus's superrotating cloud deck. WD types: gas, hot-jupiter, venus. Inventory status: [partial] — generic turbulence exists in the production gas-giant shader; no directional shear, jets, or festoons anywhere.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) in planet-lod-lab.html — the lab is solid-surface only: its FEATURES taxonomy (planet-archetypes.js:6-22) has no gas/jets key, no gas archetype (planet-archetypes.js:26-32), and no gas-giant DRIVER_PRESET (planet-lod-lab.html:2149-2155). The lab's "band" hits are unrelated solid-world systems (F22 PLD strata pldBands() at planet-lod-lab.html:1420; Ganymede grooved bands at :1194-1220). Nearest existing machinery is the PRODUCTION gas-giant fragment shader, GAS_BODY in src/objects/Planet.js:248-265: a sin(lat) band stack plus isotropic snoise turbulence weighted by `turb * (1.0 - abs(bands))` (Planet.js:261) — i.e., turbulence already concentrates at band-function zero crossings (belt/zone edges), which is a static, non-directional proxy for shear. A lab build would add a gas preset to DRIVER_PRESETS, a 'jets' FEATURES key, and route the band/jet field through the existing deriveUniforms → applyDrivers pipeline (planet-lod-lab.html:2164, 2288).

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

Unbuilt — recipe once built: (1) add a 'Gas giant (Jovian)' entry to DRIVER_PRESETS (planet-lod-lab.html:2149) and a 'jets' key to FEATURES in planet-archetypes.js (label 'Jets & shear (F25)', enableKey 'jetsEnabled', new archetype 'gas-banded' with presets ['Gas giant (Jovian)']). (2) On the :9223 debug Chrome (chrome-devtools MCP, per memory/chrome-devtools-9223-launch.md), open the lab and run `window._lab.setPreset('Gas giant (Jovian)')` then `window._lab.solo('jets')` — solo zeroes every other feature's enable for a clean A/B (clear with `window._lab.enableAllFeatures()`). (3) Judge at three camera distances via `window._lab.state.distance` (radii, clamp 1.1-30): 20 = full disk (do bands + jet edges read at all?), 5 = belt-edge scallops/festoons emerge, 2 = LOD2 close-up (lodRamp high — does shear turbulence carry detail without breaking band silhouettes?). Base F24 banding should ideally be a separate 'bands' key so F25's solo shows ONLY the shear/turbulence delta against a flat band field.

## 6. What to judge (UAT checklist)

- [ ] Does turbulence concentrate at band boundaries (where the shear lives) rather than speckling the whole disk uniformly, in the 6-level posterized envelope?
- [ ] Do festoons read as one-sided directional hooks trailing off a belt edge in a consistent direction — wind shear — not as symmetric blobs or mirrored swirls?
- [ ] Does the equatorial jet read as the widest, most coherent band, with its flanks the most turbulent latitudes on the disk?
- [ ] Under animation, do adjacent bands drifting in opposite directions read as counter-rotating shear, without crawling/aliasing against the 4x4 Bayer dither?
- [ ] Does jet/shear detail survive as luminance contrast and dither texture (not subtle hue gradients that the posterize crushes)?
- [ ] At distance ~20 radii do bands collapse to 2-3 clean stripes; at ~2 radii do scallops and filaments emerge WITHOUT destroying the band silhouette that defines the world's identity?
- [ ] Do shear vortices at a belt-zone interface read as rolled-up forms strung along a line (Kelvin-Helmholtz train), not random noise patches?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
