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

## 6.5 Build plan (working-Claude, 2026-06-10 — Phase 4c heavy loop)

Strategy: §4's single-slider P23 axis — uDustActivity drives a
domain-warped patch mask whose τ veils the surface PRE-posterize (the
F31-regime-2 haze-mute slot precedent) while the mask gradient feeds the
cloud-relief slot for a self-shading front. Plus the card-recommended
Mars-like preset so the feature has a carrier. Exemplars `3587fab`/
`9a3aed4`/`3170d54`.

1. **New preset (data)** — `'Mars (arid rocky)'` in DRIVER_PRESETS
   (opens with `radiusEarth:` — vitest regex): r ~0.53, thin co2
   atmosphere (pressure ~0.01, retained), liquidStability 0, dry dusty
   surface palette, unlocked spin, iron ~0.19 (real Mars: weak field —
   aurora gates out). Classifies tectonic-terrestrial. Walk ALL existing
   features' derivations for sanity on it (F34 limb thin, F35 terminator
   → the recorded Mars-blue hue rule fires, F36 no sea, F37 gate).
2. **Register** — `dustStorm` in FEATURES (archetypes:
   tectonic-terrestrial) + featureFolders + `dustStormEnabled` default
   true + GUI folder "Dust storms (F40)" (driven `.listen()`:
   dustActivity 0–1 walks the whole P23 axis; ✓ enable LAST).
3. **Stage-8 veil** — uniforms uDustActivity, uDustColor (ochre,
   preset-derivable). τ = activity² × patchMask where patchMask =
   recursive domain-warped fbmd (q=fbm(p+o); r=fbm(p+4q) shred per §4)
   with BOUNDED two-phase time (F25 fract pattern — re-approach
   stability is a card checklist item). Veil applied pre-posterize:
   `mix(surfaceColor, uDustColor*diff, 1.0-exp(-tau))` so obscuration
   collapses the band count (the flatten job); at activity→1 the mask
   floor rises so the veil goes planet-encircling.
4. **Self-shading front** — feed the mask density into the existing
   cloud-relief slot (the F31 clouds-as-relief adaptation) so the
   advancing wall's lit top reads brighter than the surface under it.
5. **Dust devil tracks (low-activity garnish)** — thin dark curlicues
   ETCHED into bright terrain: albedo darkening (luminance subtraction,
   never hue) along a domain-warped stroke mask, visible at activity
   ~0.1–0.4, fading as the veil takes over.
6. **applyDrivers derivation** — activity gate: retained atmosphere AND
   pressure ≤ ~0.5 bar AND dry (liquidStability ≈ 0) → activity ~0.55
   on Mars-like; 0 on airless / wet / thick-atmo (Venus 92 bar fails
   the thin gate; regime-3 also irrelevant) / gas. uDustColor from
   preset surface palette (butterscotch).
7. **Plumbing** — PROV_DUSTSTORM=36 + PROVINCES row + provinceWeight
   row + GLSL_NAME line; frame writer sole uniform owner.

v1 scope cuts (logged, not built): seasonal/perihelion clustering (D3
axial tilt driver); Hellas-style low-elevation nucleation correlation;
weeks-scale growth animation (slider IS the axis); τ optical-depth
physical calibration.

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: **🟡 taste-call — VERIFIED_PENDING_MAX** (2026-06-10, Phase 4c heavy loop)
- Evidence (repo root, gitignored): `F40-mars-d18.png` (new Mars preset full disc: cratered rust arid world, small near-neutral polar frost, no seas), `F40-mars-regional.png`/`F40-mars-regional2.png` (regional lobes pre/post threshold tune), `F40-mars-act015/055/100.png` (P23 axis sweep), `F40-mars-tracks-d3.png` (dark curlicues 0.57% of disc, mean dLum −13.8).
- §6 checklist: regional lobed wall 🟢 (post-tune 21.8% disc coverage, 1 large + ~24 small lobed components, localized not engulfing) · global endmember 🟢 (act 1.0: inner-disc 99.0% covered, relief obscured, lit-window bands 4→3, contrast std 14.3→9.8; limb + terminator still read on top) · continuous τ ramp 🟢 (mean|diff| 0.22/0.82/3.58/26.3/34.2 at 0.15/0.35/0.55/0.8/1.0, strictly monotonic) · self-shading front 🟢 (lit patch +9 lum vs adjacent surface, warmer) · dust devil tracks 🟢 (luminance-only etched strokes; windowed 0.08–0.45, absent at driven 0.55 — slider-only, per card intent) · bounded drift 🟢 (3 s drift confined to patch zone; uTime+=1000 survives, no NaN) · driver gates 🟢 (all 13 other presets activity 0; Rocky/Frozen A/B byte-identical; Ocean/Venus/Jovian diffs ≤ animation noise floor).
- New preset 'Mars (arid rocky)' (14th): activity 0.55 sole carrier; cross-feature smoke 🟢 — F35 Mars-blue terminator LIVE (dRGB B-dominant [23,32,51]), F34 thin blue-grey limb (~11% disc radius), F36 no glint, F37 faint pink 0.10 (iron 0.10, not the card's 0.19 — implementer caught that 0.19 would derive a Titan-grade oval on a dead-dynamo world; MAVEN faint-aurora precedent), F31 regime 0 cov 0.2875, craters 0.595. Known model tension logged: F15/F16 derive 0 on Mars (lab's 0.05-bar saltation floor vs real 0.006-bar Mars).
- Tweaks applied: 2 of 3 cycles. (1) FATAL — `patch` is a GLSL ES 3.00 reserved word: shader failed validation, whole lab rendered black; verifier renamed to `dustPatch` in-tree (reviewed + kept). Lesson: node --check/vitest can't catch shader-compile errors; only live verify can. (2) patchRaw threshold 0.30..0.55 → 0.15..0.45 — driven Mars 0.55 showed 2.5-3% coverage ("no storm" on the feature's own carrier); post-tune 21.8%. Re-verify: targeted PASS (monotonic sweep intact, engulf intact, gates 0).
- Code review (fable): APPROVE. MINOR logged (manual dust slider on Venus regime-3 darkens toward black — unreachable from any driven path; lab-knob-oddity precedent). Notes: shred warp is a scalar splat, not the card's vector warp (flag if the edge reads flat); deck attenuation relies on exp(0)==1 exactness; tracks need a manual slider move to see (isolation recipe).
- Taste forks for Max's lap: (a) storm coverage tuning (21.8% at 0.55 — authored band, one knob walks it); (b) scalar-splat shred — if the leading edge doesn't read "shredded/asymmetric" enough, the vector-warp upgrade is the first lever; (c) Mars preset palette/identity overall (new world, deserves an eyeball); (d) tracks slider-only visibility.
- Status: VERIFIED_PENDING_MAX
