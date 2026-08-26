# Feature Card — F13 Outflow / megaflood channels
Domain: Fluvial · Lab status: ⬜ · Build-seq phase: 4a

## 1. Description (WHAT)

Outflow / megaflood channels — the catastrophic-release end of P8 (fluvial erosion/deposition): a sudden expulsion of liquid (groundwater outburst, ice-dam failure, or chaos-terrain collapse) scours a single enormous channel instead of a dendritic network. P8's drivers are liquid stability (D1 temperature + D2 volatiles + D6 insolation), gravity (D14), and rain (D4); its intensity axis runs "trickle rill … continental trunk river / megaflood" — F13 is the megaflood extreme. The catalogued variant is the streamlined-island scoured channel: a broad (up to ~480 km wide, ~1600+ km long on Mars) anastomosing scoured floor with teardrop-shaped islands where resistant obstacles (often crater rims) split the flood, tails pointing downstream. Activity signature: active = sharp banks; relict = degraded edges (10^3–10^7 yr). Real-body examples: Kasei Valles, Ares Vallis / Tiu / Maja Valles emptying into Chryse Planitia (Mars), and the Channeled Scablands of Washington State (Earth — glacial Lake Missoula outbursts). WD types: terrestrial, ice, ocean. Status in inventory: [aspirational]. Related: F9 chaos terrain is the source region (Iani Chaos feeds Ares Vallis), F4 canyons share carve machinery, F14 lakes could pool in the carved floor.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). No F13/outflow/scour code exists in world-engine-lab.html or planet-archetypes.js (grep confirms zero hits). Nearest machinery is the shipped F11 fluvial stack it should plug into: drainageField() primitive at world-engine-lab.html:618-646 (warped |noise| zero-set channel with analytic gradient, ported from fluvial-drainage-lab.html), fluvialCombiner() at world-engine-lab.html:648-671 (carves into the shared canyonHeight accumulator, low-ground biased, bends grad for perturbAnalytic wall lighting, writes fluvialWet for the Stage-6 floor tint), uniforms uFluvialActivity/Density/Depth/Meander/Width/Freq/WarpAmt/WarpFreq/TribLac/TribGate/LowBias/HiGround/Offset at world-engine-lab.html:329-342, GUI folder 'Rivers & valleys (F11)' at world-engine-lab.html:2501, registry row planet-archetypes.js:21 (rivers / riversEnabled). F13 wants a second, much wider pass through the same shared-accumulator pattern: broad flat-floored scour band + preserved teardrop obstacles, registered as its own FEATURES key so it solos independently of F11.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/photojournal/channels-on-a-streamlined-island-of-kasei-vallis/
  — NASA Photojournal, Kasei Vallis streamlined island — blunt upstream nose, long tapered downstream tail, and the scoured channel floor wrapping around it: the exact form the posterized relief must read as.
- [real] https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/The_floodwaters_of_Mars
  — ESA Mars Express Kasei Valles mosaic — regional view: one continent-scale trunk up to ~480 km wide with eroded craters left as tailed islands; this is the ~8-radii distance read, not a river network.
- [real] https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/Ancient_floods_on_Mars_Iani_Chaos_and_Ares_Vallis
  — ESA Iani Chaos feeding Ares Vallis — shows the source-to-channel chain (chaos collapse F9 at the head, teardrop islands and terraced banks downstream) useful for F9/F13 co-placement.
- [real] https://www.lpi.usra.edu/education/timeline/gallery/slide_30.html
  — LPI educational slide on Mars outflow channels — concise annotated overview of scour marks, teardrop tails on eroded craters, and 'island' morphology, good single-page form vocabulary.
- [real] https://iceagefloodstrail.org/sites/drumheller-channels/
  — Drumheller Channels, Channeled Scablands (Earth analog) — anastomosing rock-cut channels and butte-and-basin scabland: the braided/anastomosing multi-thread look at the megaflood scale.
- [art] https://www.shadertoy.com/view/7ljcRW
  — 'Terrain Erosion Noise' Shadertoy (Clay John lineage) — single-pass, point-evaluable branching-gully noise: proof the carved-channel look survives a pure deterministic per-fragment evaluation like ours.
- [art] https://blog.runevision.com/2026/03/fast-and-gorgeous-erosion-filter.html
  — runevision's erosion filter writeup — stylized renders of crisp branching channels and divides; notice how channel walls read entirely through lighting/relief, which is our posterize-survival route.
- [art] https://www.davidhol.land/articles/3d-pixel-art-rendering/
  — David Holland's 3D pixel-art rendering — how large landforms stay legible under hard quantization: bold silhouettes and lighting-banded slopes, the envelope F13's wide channel must read through.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology models outflow channels as extreme stream-power erosion: E = K·A^m·S^n with discharge spiking to 10^8–10^9 m^3/s for days-to-weeks (Baker's megaflood literature, 'Megaflooding on Earth and Mars'). Distinctive products: (1) streamlined (lemniscate/teardrop) islands — drag-minimizing forms with length:width ~3-4, blunt nose upstream, tail downstream, usually nucleated on resistant obstacles like crater rims; (2) flat scoured floors with longitudinal grooves/lineations parallel to flow; (3) anastomosing multi-thread reaches, inner-channel terraces, and dry cataracts; (4) relict degradation softening banks over Gyr. Games/procgen rarely simulate this directly — the practical lineage is single-pass 'erosion-look' noise (Clay John / Fewes Shadertoy, runevision's filter) and the analytic stream-power carve already catalogued in RESEARCH_high-lod-planet-shaders-2026-06-05.md §3.1 ('elevation -= k·pow(flowProxy,0.8)·pow(slope,2)' via davidar/proceduralpixels) — all deterministic-from-position, no ping-pong buffers, exactly the constraint our static/structural layer demands. Per that research's design spine, the channel must be routed through height + analytic gradient (lighting-routed detail), never albedo. Most promising shader-side approach: a second pass through the existing drainageField() primitive with megaflood parameterization — much wider band (uFluvialWidth ×8-15), near-zero tributary gate, low meander (floods run straight), and a flattened floor profile (smoothstep plateau instead of the V-carve) written into the shared canyonHeight accumulator. Inside the channel mask, plant streamlined islands as Voronoi-F1 height bumps anisotropically stretched along the local flow direction (the tangent perpendicular to the field gradient drainageField already returns), so noses/tails align downstream automatically; add faint high-frequency ridges along the same direction for longitudinal scour grooves. All terms carry analytic gradients into grad so perturbAnalytic lights walls and island flanks for the 6-level posterize.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built: (1) register in planet-archetypes.js FEATURES as `outflow: { label: 'Outflow channels (F13)', enableKey: 'outflowEnabled', archetypes: ['tectonic-terrestrial','volatile-cold'] }` so the existing per-feature GUI solo button and setFeatureEnables() pick it up automatically (world-engine-lab.html:2563, :2908). (2) On the :9223 lab Chrome, isolate via `window._lab.solo('outflow')`. (3) Preset: `window._lab.setPreset('Rocky (Earthlike)')` for the relict-Mars terrestrial read; re-check with 'Titan (methane seas)' for the cold-liquid variant. (4) Distances: `window._lab.state.distance = 8` for the regional trunk-channel read (the headline view), `= 3` for the streamlined-island close-up (nose/tail and wall lighting), `= 20` to confirm it fades to a faint lineation without popping. (5) Verify enable state in transcript via `window._lab.featureEnabled` per the campaign goal; for the F11-coexistence check, `window._lab.enableAllFeatures()` then re-solo.

## 6. What to judge (UAT checklist)

- [ ] Does it read as ONE broad scoured trunk — categorically wider than the F11 river network — in the 6-level posterized envelope at distance ~8, not as a thicker dendritic branch?
- [ ] Do streamlined islands read as teardrop forms (blunt upstream nose, tapered downstream tail) with all tails agreeing on a single flow direction along the channel?
- [ ] Does the channel cross-section read flat-floored and scoured (walls + plateau floor) rather than V-shaped — a distinct silhouette from F4 canyons under the same lighting?
- [ ] Does flow directionality read as coherent behavior — longitudinal grooves/lineations inside the channel band aligned with the trunk — rather than isotropic noise texture?
- [ ] Do channel walls and island flanks light through the analytic gradient, so the Bayer dither textures the slope bands instead of smearing albedo?
- [ ] With F11 also enabled, does the outflow trunk read as a different geomorphic event (catastrophic, singular) than the fine drainage network, with no visual double-carving artifacts where they cross?
- [ ] At low uFluvialActivity-style relict settings, do banks soften and degrade while the teardrop forms stay legible (relict Mars read), instead of the whole feature dissolving?
- [ ] At distance 20 does the feature degrade gracefully to a faint dark lineation and at 1.5-3 does the island close-up hold form without shimmer in the posterize?

## 6.5 Build plan (added 2026-06-10, Phase-4a heavy loop — second carve pass through the F11 pattern)

1. **`outflowField(pos)` primitive** — structurally `drainageField()` minus tributaries: own
   uniforms (uOutflowFreq lower than F11's for a continental single trunk, uOutflowWarpAmt low —
   floods run straight, own uOutflowOffset seed so the trunk is NOT an F11 channel), wide band
   `chan = 1 − smoothstep(0, uOutflowWidth, |field|)` with uOutflowWidth ≈ 8-15× the F11 width.
   Analytic gradient throughout (same dstep chain rule as drainageField).
2. **`outflowCombiner` (Stage-4)** — runs immediately AFTER fluvialCombiner (shares the
   canyonHeight accumulator so F14 can pool in the scour; F12/F14 downstream see the carved h).
   Early-out `uOutflowDensity <= 0`. **Flat-floored scour, not a V**: floor mask
   `plateau = smoothstep(0.0, 0.35, chan)` (saturates → walls only at the band edge), carve
   `= −uOutflowDepth · mix(0.45, 1.0, uOutflowActivity) · plateau · lowGround ·
   provinceWeight(PROV_OUTFLOW)`; relict (low activity) additionally WIDENS the wall smoothstep
   (degraded banks) rather than just shrinking depth. Same lowGround mix as F11.
3. **Streamlined islands** — inside the floor mask only: voronoi-F1 bumps (reuse the existing
   voronoi3d machinery if its gradient is available, else a 2-cell noised() max) sampled in a
   domain anisotropically stretched 3-4:1 along the local flow tangent
   `t = normalize(cross(dfield, pos))` (perpendicular to the across-channel gradient and the
   radial), so noses/tails align downstream automatically. Islands ADD height back up to ~the
   rim (preserved obstacles), capped so they never exceed the pre-carve surface.
4. **Longitudinal grooves** — faint high-frequency ridges aligned with t: sample 1D-style noise
   on the across-flow coordinate `dot(pos, normalize(dfield))·uOutflowGrooveFreq`, amplitude
   gated to the floor mask and ≤ ~15% of carve depth. Pure relief (grad-routed), no albedo.
5. **Province**: PROV_OUTFLOW = 17, field 2 polarity −1 floor 0.30 (young lowlands — mirrors
   PROV_RIVERS; floods empty into the same basins).
6. **Registration + drivers**: FEATURES `outflow: { label: 'Outflow channels (F13)', enableKey:
   'outflowEnabled', archetypes: ['tectonic-terrestrial','volatile-cold'] }` (card §5); GUI
   folder after Rivers in fGrad-equivalent fluvial group with knobs width/depth/freq/islands/
   grooves + driven density/activity sliders; deriveUniforms: outflowDensity follows the F11
   fluvialDensity gate (worlds with live or relict fluvial history) but thresholded rarer
   (megafloods are singular events — e.g. on only when erosion ≥ 0.3), outflowActivity = the
   F11 activity driver (relict worlds get degraded banks for free).
7. **v1 scope cuts (flagged)**: no anastomosing multi-thread reaches (single trunk only); no
   dry cataracts/terraced inner channels; no F9 chaos-source co-placement (F9 unbuilt); island
   count/placement purely procedural (no crater-rim nucleation — craters are a separate field).

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: 🟡 taste-call (2026-06-10, working-Claude autonomous judging per spec §13.3 — VERIFIED_PENDING_MAX)
- Evidence: built per §6.5 in one pass + 1 tuning cycle. Shots (Rocky preset, solo):
  `F13-rocky-d8.png` (regional read); `F13-tune1-diff.png` (the load-bearing check: pixel-diff
  of trunk-only carve on/off at tuned settings — two broad sweeping curvilinear trunk bands
  arcing across the disc, categorically wider than F11's dendritic threads, continuous and
  flow-like); `F13-isl-diff.png` (islands-only on/off diff — discrete stretched bumps strictly
  confined to the trunk arcs, visibly elongated); `F13-tuned-full.png` (all signals).
  Drivers verified live: Rocky density 0.741 / activity 1.0 (matches the worked example in the
  driver comment), Titan 0 (driven off — see flag). Console clean. Vitest 19/19.
- Tuning cycle 1 (cap 3): as-implemented defaults (width 0.35, freq 0.7) read as diffuse
  planet-wide mottling, not a singular trunk — the |field|<0.35 band covered too much sphere.
  Fixed live and persisted: width 0.18, freq 0.5, depth 0.25. The "8-15× F11 spatial width"
  interpretation survives (0.18/0.5 vs F11's 0.10/2.3 ≈ 8.3×).
- Why 🟡 not 🟢: teardrop nose/tail asymmetry and a single agreed flow direction (§6 item 2),
  groove lineation read (§6 item 4), and distance-20 fade (§6 item 8) were not judged at fine
  grain — the screenshots confirm placement/confinement, not morphology; magnitude defaults are
  knob-backed guesses. Glance items for Max's Phase-7 lap.
- Code review (adversarial, per §13.4): clean pass at ≥80 confidence (math, GLSL guards,
  plumbing, ordering, registries, regression early-out all verified). One comment typo fixed
  (island Jacobian derivation double-counted islScale in prose; code was right). Sub-threshold
  flags: island crest + groove peak can exceed the pre-carve rim by ≤0.02 relief units; grooves
  ≥freq 24 have no fwidth fade (possible distance shimmer — §6 item 8, Max's gate).
- Taste forks (conservative, marked): driven density uses smoothstep(0.3, 0.45, erosion) instead
  of a hard 0.3 cut; **Titan gets density 0** (erosion 0.2 < threshold) so the card §5 Titan
  re-check needs a manual slider drag — if cold megafloods should be on by default, lower the
  threshold or raise Titan's preset erosion. Seed decorrelation constant vec3(31.7,−12.9,8.3).
- Scope cuts honored per §6.5.7: single trunk, no cataracts/terraces, no F9 co-placement,
  no crater-rim nucleation.
- Re-verify: n/a
- Status: VERIFIED_PENDING_MAX (Max's Phase-7 review lap)
