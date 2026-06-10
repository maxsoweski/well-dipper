# Feature Card — F40 Dust storms
Domain: Dust · Lab status: 🟡 · Build-seq phase: 4c

## 1. Description (WHAT)

F40 "Dust storms" (F-dust family — aeolian atmospheric features; sole member) derives from P23 Aerosol/dust lofting (planet-visual-features.md:169, 312): wind stress and dust devils loft loose surface dust; a radiative feedback loop (airborne dust absorbs sunlight → heats air → strengthens winds → lofts more dust) can grow a local event into a planet-encircling storm; settling leaves a persistent haze veil (which is sibling F16 Dust mantles' butterscotch tint, line 238). Drivers: D5 atmosphere density (air thick enough to move grains, thin enough that the surface stays dry and dusty), loose-dust supply, D1 equilibrium temperature, D3 axial tilt (Mars storms cluster around southern-summer perihelion — seasonal/interannual signature), D14 gravity (lofting/settling rates). Timescale: transient, weeks–months. Intensity axis: "local dust cloud … whole-planet ochre obscuration." Variants: dust devil tracks (dark curlicue trails where bright dust is stripped) → regional dust front (advancing lobed wall, e.g. Hellas-spawned storms) → planet-encircling global storm (2018 event that ended Opportunity; surface features vanish, optical depth τ ≈ 10). Real-body example: Mars (2001 Hellas/Syrtis, 2018 global). WD types: rocky, terrestrial (arid), venus. Status: [partial] — "optional Mars dust storms" exists only in the OLD production pipeline, not the lab.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) in the lab — planet-archetypes.js FEATURES (lines 6–21) has no dust/storm key, and planet-lod-lab.html has no storm uniform or GUI folder. The nearest existing machinery is exactly where the architecture already reserves its slot: Stage 8 CLOUDS & HAZE, planet-lod-lab.html:1558–1564 — the comment at :1559 states "AEOLIAN F40 storm veil wins the upper slot when both active. [domains: Clouds, Aeolian]". That stage currently renders an analytic-FBM weather deck (`fbmd(vPos*1.7 + uTime drift)` → `smoothstep(0.15,0.5)` × `uCloudCoverage` × diffuse, posterized at 0.4 — :1561–1564) driven by uCloudCoverage (:168, :1617, set from deriveUniforms at :2170). The surface-side dust-mantle smoothing belongs to the (empty) Stage 5 AEOLIAN placeholder (:1524) and is F16, not F40. Precedent code for the "[partial]" status lives in the old production pipeline: src/rendering/shaders/TexturedBodyShader.js:310–317 (cloudStyle==2 dust branch — 2-octave snoise at 0.6× cloud scale, slow drift time*0.002, smoothstep(0.3,0.6) so only the densest patches show, mixed thin over the surface) and the same Mars-like branch in src/objects/Planet.js:617–626.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/photojournal/mars-before-and-after-dust-storm/
  — MARCI before/after of the 2018 planet-encircling event — the 'after' is the global-storm endmember: a near-featureless ochre globe where only the polar cap and faintest mega-relief survive.
- [real] https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/Mars_Express_watches_a_dust_storm_engulf_Mars
  — Mars Express sequence of the storm growing — note the storm is brighter than the surface it covers (lit dust tops), the key luminance cue our posterize can carry.
- [real] https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/Dust_storms_swirl_at_the_north_pole_of_Mars
  — Upwelling dust front near the north polar cap — the regional-front variant: a lobed, shredded leading edge, strongly asymmetric, not a round blob.
- [real] https://science.nasa.gov/resource/the-2001-great-dust-storms-hellassyrtis-major/
  — 2001 Hellas/Syrtis regional storms — storms nucleate in/around the Hellas basin and spill along topographic lows; placement should correlate with low-elevation arid terrain.
- [real] https://hirise.lpl.arizona.edu/ESP_031199_2070
  — HiRISE dust devil tracks on dunes — the low-intensity variant reads as thin DARK curlicues where bright dust was removed (albedo subtraction), not added dark clouds.
- [real] https://svs.gsfc.nasa.gov/30983
  — NASA SVS visualization of the 2018 global storm's growth — the regional→global ramp over weeks; good behavior reference for an intensity-axis animation.
- [art] https://deep-fold.itch.io/pixel-planet-generator
  — Deep-Fold's pixel planets (Godot shaders, MIT source on GitHub) — closest existing match to our posterized envelope; its 'dry terran' atmosphere bands show how a thin moving veil reads at low level counts.
- [art] https://en.riotpixels.com/games/surviving-mars/screenshots/
  — Surviving Mars dust-storm shots — stylized game treatment: storms read as a warm-tinted contrast collapse plus a bright advancing wall, exactly the two cues worth keeping.

## 4. Math / modeling notes (HOW, from the field)

Academia models P23 with a saltation threshold (friction velocity must exceed a grain-lifting threshold — easiest where dust is loose and air thin-but-present) feeding a Mars-GCM multi-tracer transport model; the regional→global runaway is the radiative feedback loop, and the observable is optical depth τ (column dust opacity, τ≈10 in 2018), with settling over weeks–months. Games skip all that and render an opacity/fog layer plus a tinted contrast collapse (Surviving Mars). In the vocabulary of RESEARCH_high-lod-planet-shaders-2026-06-05.md, F40 is a Stage-8 layer whose three variants map the P23 intensity axis onto three existing techniques: (1) dust devil tracks = surface-albedo curlicues (thin dark domain-warped strokes, low coverage — strictly a `survives` luminance darkening); (2) regional front = a sparse storm-mask (`smoothstep(0.6,0.8,n)` hash-placed, à la the gas-giant GRS storm-mask row) whose edge is shredded by recursive domain warping (`q=fbm(p+o); r=fbm(p+4q)`), animated with BOUNDED time for re-approach stability; (3) global storm = whole-planet veil where τ→1. The critical posterization insight: unlike clouds, the dust veil's job is to FLATTEN — `mix(surface, ochreDust*diff, 1-exp(-tau))` run BEFORE the final posterize (the Stage-8 comment already mandates "muting runs BEFORE final posterize") so obscuration reads as the surface's band count collapsing from 6 levels toward 2–3, which is exactly the right retro read for "whole-planet ochre obscuration." The storm FRONT, by contrast, must route through the clouds-as-relief adaptation (add veil density into the height before the normal calc) so the advancing wall self-shades and survives as dither texture instead of a flat color wash. Most promising shader-side approach: a single uDustActivity uniform (derived from D5 thin-atmosphere + dryness/low uLiquidStability + D3 season) drives τ = activity × domain-warped FBM patch mask in Stage 8; surface color is veiled via `mix(..., 1-exp(-tau))` pre-posterize while the mask's gradient feeds the cloud-relief slot for a self-shading front edge; ramping activity 0→1 sweeps the full P23 axis from a few drifting patches to planet-encircling obscuration, with dust devil tracks as a cheap low-activity albedo-curlicue garnish on the surface side.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built: register in planet-archetypes.js FEATURES as `dustStorm: { label: 'Dust storms (F40)', enableKey: 'dustStormEnabled', archetypes: ['tectonic-terrestrial'] }` (or a new aeolian-arid archetype when Stage 5 lands). Then on the :9223 lab Chrome (chrome-devtools MCP, per well-dipper-testing-reference.md): (1) open planet-lod-lab.html; (2) `window._lab.setPreset('Rocky (Earthlike)')` — today's closest arid-rocky driver bundle (thin-atmo Mars-like preset worth adding alongside the feature); (3) `window._lab.solo('dustStorm')`; (4) judge at three distances via `window._lab.state.distance`: 8 (global-storm obscuration read), 3 (regional front shape/edge), 1.5 (front self-shading + dust devil track curlicues); (5) sweep the new uDustActivity GUI slider 0→1 to walk the full P23 intensity axis; `window._lab.enableAllFeatures()` to clear solo.

## 6. What to judge (UAT checklist)

- [ ] Does the regional storm read as an advancing lobed wall with a shredded, asymmetric leading edge in the 6-level envelope — not a symmetric noise blob?
- [ ] Does the global-storm endmember read as whole-planet ochre obscuration — the surface's posterize bands collapsing toward 2–3 levels — while limb glow and terminator still survive on top?
- [ ] Does the veil mute underlying relief progressively with intensity (continuous tau ramp) rather than flipping on/off, so the P23 axis 'local cloud … planet-encircling' is walkable on one slider?
- [ ] Does the storm front self-shade — sunlit dust top reading brighter than the surface it covers — surviving as dither texture (luminance) rather than a flat albedo wash the posterizer crushes?
- [ ] At low intensity, do dust devil tracks read as thin dark curlicues etched INTO bright terrain (dust removal), not dark blobs added on top?
- [ ] Does animation drift slowly and deterministically (bounded time), so a fly-away/re-approach shows the same storm in a plausible nearby state with no pop or pooling?
- [ ] Does it gate correctly on drivers — appearing only on dry thin-but-present-atmosphere worlds (rocky/arid terrestrial/venus), never on airless, ocean, or ice presets?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
