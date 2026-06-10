# Feature Card — F12 Deltas & alluvial fans
Domain: Fluvial · Lab status: ⬜ · Build-seq phase: 4a

## 1. Description (WHAT)

Depositional endpoints of the fluvial system (P8, L1 row at planet-visual-features.md:149): a stable surface liquid (water — or methane/ethane on cold worlds) gated by D1 equilibrium temperature + D2 volatile budget + D6 atmosphere retention, fed by D4 rain, flows downslope, then decelerates and drops its sediment load wherever it loses confinement — at a mountain-front slope break (alluvial fan) or on entering standing liquid (delta). D14 gravity scales the deposit geometry. Variants per the F12 row (:234): birdsfoot delta (river-dominated distributary fingers, e.g. the Mississippi), single fan (semicircular cone with radial channel splay), and coalesced bajada (fans merging into one continuous apron along a range front, e.g. Death Valley). Real-body examples: Titan's Ontario Lacus delta (two switched lobes, methane/ethane), Mars relict fans (Jezero crater fan-delta, Eberswalde's preserved distributary network with inverted channels), Earth bajadas. Active = sharp lobes and crisp distributaries; relict = degraded, inverted-channel fans (the Mars case). WD types: ocean, terrestrial, eyeball. Status in inventory: [aspirational].

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). Grep for delta/fan/F12 finds no combiner, uniform, or FEATURES entry — planet-archetypes.js FEATURES (lines 6-22) has the sibling 'rivers' (F11, enableKey riversEnabled) but nothing for F12. Nearest existing machinery it should plug into: the Stage-4 Fluvial domain in planet-lod-lab.html — the F11 drainage primitive (~:618-646, analytic-gradient warped-noise channel field with trunk+tributary terms) and fluvialCombiner (:653-669), which carves channels into the shared canyonHeight accumulator, bends grad for analytic lighting, and writes the fluvialWet mask consumed by the Stage-6 species floor-tint (:1549-1551, mixed by uFluvialDensity); it is invoked in the stage chain at :1504 right after canyonCombiner. The uFluvial* uniform block lives at :329-342, and a uLiquidMask uniform stub (owner: Fluvial, "cut at seaLevel") already exists at :1783 with the Stage-4 comment at :1523. F12 is the depositional mirror of F11's erosional carve: a deltaCombiner that ADDS a fan apron where channel strength meets base level, rather than subtracting a channel.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/photojournal/jezero-crater-delta/
  — Jezero crater fan-delta (Mars): a single coherent fan-shaped lobe with a crisp scarp edge where it meets the crater floor — the silhouette is one readable cone, not texture.
- [real] https://www.jpl.nasa.gov/images/pia04293-eberswalde-delta-in-high-resolution/
  — Eberswalde delta (Mars): preserved distributary network — a trunk channel splaying into branching fingers, lobes, and meander cutoffs; the relict/inverted-channel end of the activity axis.
- [real] https://www.jpl.nasa.gov/images/pia13172-footprint-of-ontario-lacus/
  — Ontario Lacus (Titan): the first well-developed delta seen on Titan — two lobes recording channel-switching avulsion into a methane/ethane lake; proof the form is liquid-agnostic (eyeball/cold-world variant).
- [real] https://earthobservatory.nasa.gov/images/147025/death-valley-landscapes
  — Death Valley alluvial fans coalescing into a bajada: repeated semicircular aprons along a mountain front, each lighter-toned than the basin floor — a tone band plus a slope break, ideal posterize material.
- [real] https://www.usgs.gov/publications/alluvial-fans-death-valley-region-california-and-nevada
  — USGS Death Valley fan study: fans map as discrete age/albedo units in Landsat — supports rendering a fan as one flat-ish brightness class with a radial edge, not gradient detail.
- [art] https://github.com/selimanac/defold-pixel-planets
  — Deep-Fold Pixel Planets port (dithered pixel-art planets with river/water cutoff parameters): how stylized planet shaders make liquid margins read as a hard mask boundary plus dither — our shoreline-meets-fan target register.
- [art] https://discussions.unity.com/t/randomly-generated-low-poly-styled-terrain-with-rivers-lakes-and-erosion/651085
  — Low-poly procedural terrain with rivers/lakes/erosion: stylized renders sell fluvial deposition through silhouette and one-tone sediment flats at water margins, no fine texture.
- [art] https://www.shadertoy.com/view/33cXW8
  — Clean Terrain Erosion Filter (Shadertoy, derivative-based): the gradient-modulated erosion family our F11 already uses — shows deposition (smoothed, brightened lowlands) emerging from the same analytic-derivative math.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology models deposition as the divergence of sediment flux (Exner equation: ∂h/∂t ∝ −∇·q_s) — sediment drops where flow decelerates, i.e. at slope breaks and base level. An alluvial fan is well approximated analytically: a semicircular cone apexed where a confined channel exits a front, with radial profile h(r) decaying exponentially/power-law from the apex at 2-10° slopes; bajadas are the lateral union (max/smooth-max) of neighboring fans. Deltas add distributary branching: the trunk bifurcates near base level, and avulsion switches lobes over time (Ontario Lacus's two lobes; birdsfoot vs arcuate end-members set by river- vs wave-dominance). Procedural literature: hydrology-first terrain generation (Génevaux et al., "Terrain Generation Using Procedural Models Based on Hydrology"; "River Networks for Instant Procedural Planets"), the Bremen CGI'22 landscape paper which generates deltas by a second, locally-bound drainage iteration traced backward from multiple coastline outlets to one river cell (https://cgvr.cs.uni-bremen.de/papers/cgi22/CGI22.pdf), and Red Blob Games' procedural river growing (https://www.redblobgames.com/x/1723-procedural-river-growing/) — all graph/grid methods, which we must collapse to a pure deterministic function of position per the lab's constraint (RESEARCH_high-lod-planet-shaders vocabulary: analytic-derivative noised() core, per-type combiner dispatch, lighting-routed detail, posterize survival). The crater combiner is the in-house precedent for "analytic landform profile at deterministic placement points." Most promising shader-side approach: a Stage-4 deltaCombiner that gates on the product of F11 channel strength (fluvialWet / the chan field) and base-level proximity (|h − seaLevel| small via uLiquidMask, or low-slope via the running grad), then ADDS an analytic fan apron into h — a smoothstep cone whose gradient is computed in closed form like the F11 dchan terms so perturbAnalytic lights the lobe edge. Distributary fingers come nearly free by re-evaluating the existing drainage primitive near base level with widened warp and tightened width (splay), and the deposit reads through posterize as a one-band-brighter sediment tint extending the existing fluvialWet albedo hook (:1549-1551) plus the normal-lit cone silhouette.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built. Register in planet-archetypes.js FEATURES as deltas: { label: 'Deltas & fans (F12)', enableKey: 'deltasEnabled', archetypes: ['tectonic-terrestrial','volatile-cold'] } (mirrors 'rivers'). Test on the :9223 GPU Chrome (per well-dipper-testing-reference.md, chrome-devtools MCP not Playwright): open planet-lod-lab.html, run window._lab.solo('deltas'), then window._lab.state.riversEnabled = true (fans are downstream of the F11 channel field — solo kills it, so re-enable the driver) — verify via window._lab.featureEnabled if exposed, else read window._lab.state. Presets: 'Ocean (temperate)' for the delta-at-shoreline read (needs the seaLevel/uLiquidMask cut), 'Rocky (Earthlike)' for subaerial fans/bajada at relief fronts, 'Titan (methane seas)' for the cold-world methane variant. Distances via window._lab.state.distance: 20 (default overview — lobes should be invisible or near-invisible), 6 (lodRamp engaging — lobes appear as tone patches at channel mouths), 1.5-3 (form read — cone silhouette, distributary splay, lit apron edge). Confirm 🎲 determinism: re-approach at the same yaw/pitch/distance reproduces identical lobes.

## 6. What to judge (UAT checklist)

- [ ] Does each fan read as a coherent semicircular cone apexed at a channel mouth in the 6-level posterized envelope — one lit slope break and a radial edge, not a smear of noise?
- [ ] Does a delta read as the termination of an F11 channel — fingers visibly splaying FROM the trunk into the liquid — rather than an unrelated bright patch on the coast?
- [ ] Does the deposit read as ADDED material (a positive apron standing above the basin/sea floor, edge catching light via the analytic gradient) where F11 channels read as carved-away material?
- [ ] Does the sediment lobe survive posterize as roughly one brighter band against the surrounding terrain (the Landsat/Death-Valley read), with the Bayer dither carrying the lobe edge instead of banding artifacts?
- [ ] On a bajada stretch, do adjacent fans merge into a continuous apron along the relief front without visible repetition or a periodic stamp pattern?
- [ ] Does activity gating behave: active worlds show sharp two-lobe/birdsfoot forms, relict (Mars-like) worlds show degraded, subdued fans consistent with uFluvialActivity?
- [ ] Does the form hold across liquids — same fan/delta morphology on the Titan methane preset as on the water ocean preset, differing only by palette/tint?
- [ ] On re-approach at identical camera state, are the lobes pixel-identical (deterministic from position + seed, no temporal state)?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
