# Feature Card — F10 Ridged / grooved icy terrain
Domain: Relief · Lab status: ✅ · Build-seq phase: 3

## 1. Description (WHAT)

F10 "Ridged / grooved icy terrain" (Relief family, close-up/LOD2) — the signature surface of geologically active icy shells. Physical chain: D2 volatileFraction (water-ice crust budget) + D12 tidal heating + D11 surface-history resurfacing feed P2 tectonic deformation (shell stretches/slides → ridge-and-groove sets) and P7 cryovolcanism (pressurized water/ammonia cryomagma ascends fractures, refreezes into ridge pairs), all gated cold by D1 T_eq. Variants per the inventory: double ridges (paired crests flanking a central trough, Europa), grooved bands (fine parallel ridge swaths, Ganymede), lenticulae (diapir domes), and refrozen-crack networks. Real-body exemplars: Europa, Ganymede, Enceladus (tiger stripes). Render families: ice, ocean. The L2 table row (docs/FEATURES/planet-visual-features.md:225) still carries the `[aspirational]` tag, but that tag is stale — the feature is built in the lab (see §2).

## 2. Current shader approach (HOW, as-built)

BUILT (cheap tier) in /home/ax/projects/well-dipper/world-engine-lab.html. Combiner: cryoRidgeCombiner() :1198-1221, called in the height stack at :1510. Two mechanisms: (1) Europa DOUBLE RIDGES — a warped directional line field (field = dot(pos, uCryoRidgeAxis0) + uCryoRidgeWarp·noised(pos·2).x, :1204), phase = field·uDoubleRidgeFreq, t = sin(phase), carrying the analytic doubleRidgeProfile(t, offset, width) cross-section :1148-1158 — two Gaussian ridge crests at a=±offset flanking a Gaussian central trough (DR_TROUGH_AMP=0.6, troughW=offset·0.5), with dh/dt folded through a=|t| via sign(t) and chain-ruled exactly through cos(phase)·freq·dfield (:1210; vitest-pinned oracle per relief doc §5.4). (2) Ganymede GROOVED BANDS — fine ridgeWave (1−|sin|) corrugations at uGroovedBandFreq along a second seed axis uCryoRidgeAxis1, confined to low-freq smoothstep band envelopes (:1211-1220), reusing F6 tessera's pinned ridgeWave primitive. Master gate: the SHARED seam uniform uCryoActivity (owner Cryo D2/D12→P7, declared :260-262; derived from the preset and flowed into state :2228-2231); amp = uCryoRidgeAmp·uCryoActivity with early-out at ≤0 (:1199-1200). Uniforms :274-283, defaults :1706-1715 (doubleRidgeFreq 3.0, offset 0.45, width 0.18, groovedBandFreq 14.0, amp 0.12, warp 0.3). GUI: Relief → "Ridged icy (F10)" folder :2429-2437 (amp + sinuosity are lab knobs; freq/offset/width/bandFreq sync from preset via .listen()), with 🎲 randomize rolling uCryoRidgeOffsetV. Registered in /home/ax/projects/well-dipper/planet-archetypes.js:17 as key 'cryoRidge' (label 'Ridged icy (F10)', enableKey 'cryoRidgeEnabled', archetype 'icy-active'). DEFERRED to rich tier (relief doc §F10.d): lenticulae diapirs + refrozen-crack web.

## 3. Reference images (real + art)

- [real] https://www.jpl.nasa.gov/images/pia01664-three-dimensional-view-of-double-ridges-on-europa/
  — Galileo stereo of Europa double ridges — crests >300 m flanking a ~1.5 km valley: the exact [ridge | trough | ridge] triplet our doubleRidgeProfile encodes; note how oblique light makes one crest bright, the trough dark, the far crest mid-tone — a natural 3-band read.
- [real] https://science.nasa.gov/photojournal/pj-europa-ridges-hills-and-domes/
  — A 2-km double ridge crossing hills and domes (lenticulae) — shows the long sinuous continuity of a single ridge line plus the dome population we deferred to the rich tier.
- [real] https://www.jpl.nasa.gov/images/pia01615-swaths-of-grooved-terrain-on-ganymede/
  — Ganymede grooved terrain in discrete SWATHS — fine parallel corrugations confined to band envelopes with different orientations per band, exactly the second-mechanism look (band envelope × ridgeWave).
- [real] https://www.usgs.gov/publications/grooved-terrain-ganymede-first-results-galileo-high-resolution-imaging
  — USGS Galileo analysis of Uruk Sulcus — alternating ridges and grooves in straight and curvilinear sets that crosscut older terrain; the crosscutting of distinct lineation families is the key form cue.
- [real] https://www.jpl.nasa.gov/images/pia10352-tiger-stripes-on-enceladus-fracture-zones-and-plumes-sources/
  — Enceladus tiger stripes — a sparse, widely-spaced parallel fracture family (deep grooves flanked by two raised ridges): the low-frequency end of the doubleRidgeFreq range.
- [art] https://www.artstation.com/artwork/4X4bxn
  — Destiny 2 Beyond Light Europa ice shaders/props (Ethan Scheu) — stylized ice that reads through value contrast and crack/sculpt shapes, not photo texture; good target for how ridged ice should read once color is collapsed.
- [art] https://www.artstation.com/artwork/rAPkB2
  — Jesse van Dijk early Europa concept — big readable silhouettes of ridged/fractured ice at landscape scale; form-first art direction worth borrowing for ridge-line scale and sinuosity.
- [art] https://helianthus-games.itch.io/pixel-art-planets
  — Pixel-art planet pack with ice/snow worlds — demonstrates what icy terrain must collapse to at extreme stylization: a few luminance bands plus directional streak structure, which is our posterized end-state.

## 4. Math / modeling notes (HOW, from the field)

Geophysics: Europan double ridges are modeled as either tidal pumping of refreezing cracks or refreezing shallow water sills (Culberg et al. 2022, in the search results) — both yield a characteristic symmetric cross-section: two raised crests at ±~0.5-1 km flanking a central trough, height/spacing roughly constant along hundreds of km of strike. Ganymede's grooved terrain is extensional tectonics — lithospheric necking instability under stretching produces PERIODIC ridge-and-groove wavelengths inside discrete bands (sulci), each band with its own orientation, crosscutting older cratered terrain (USGS/Galileo Uruk Sulcus results). Tiger stripes are the sparse end-member: ~4 parallel fractures, deep grooves flanked by twin ridges. Procedurally, games/demos model all of these as ANISOTROPIC LINE FIELDS rather than isotropic FBM: a scalar field = dot(pos, axis) + warp·fbm(pos) gives quasi-parallel curvilinear lineations (the same family as our F8 wrinkle ridges and F6 tessera), and the cross-line shape is an authored analytic profile evaluated on sin(phase). In the research doc's vocabulary this is the per-type COMBINER pattern over the shared noised() core: domain warping for sinuosity, analytic-derivative discipline (exact chain-rule gradients, no warp Jacobian shortcuts) so the relief is lighting-routed and survives the 6-level Bayer posterize, and fwidth frequency-clamping so the fine grooved-band frequency fades before it aliases. Deferred variants map to existing keystones: lenticulae = sparse hash/Voronoi-F1-placed Gaussian dome profiles (the crater-placement machinery, inverted), refrozen-crack networks = inverted Voronoi border distance (F2−F1). Most promising shader-side approach: exactly what is built — warped directional phase fields carrying analytic, derivative-correct cross-section profiles (Gaussian double-crest + trough for Europa; 1−|sin| ridgeWave inside smoothstep band envelopes for Ganymede), gated by a single physically-derived activity scalar. The rich-tier extension should add hash-placed lenticulae domes and a Voronoi-border refrozen-crack web, both routed through normals only so they survive posterization.

## 5. Isolation recipe (:9223)

Built — solo it in the :9223 debug Chrome (chrome-devtools MCP, per memory/chrome-devtools-9223-launch.md; do NOT curl-probe the port from Bash). 1) Navigate the :9223 Chrome to the lab page (world-engine-lab.html via the project's vite dev URL — Max starts the server). 2) window._lab.setPreset('Europa (icy moon)') — this preset (world-engine-lab.html:2160) derives cryoActivity≈1 through the live Cryo P7 registry, opening the shared uCryoActivity gate. 3) window._lab.solo('cryoRidge') — the real FEATURES key from planet-archetypes.js:17; disables every other combiner. Verify with window._lab.featureEnabled('cryoRidge') === true. 4) Distances: window._lab.state.distance = 6 for full-LOD2 double-ridge + grooved-band read (lodRamp saturated), 3 for cross-section/profile inspection near the terminator, 12 for the mid-range fade check (ridges should dissolve gracefully, no shimmer). 5) Knobs in GUI Relief → 'Ridged icy (F10)': cryoRidgeAmp (0-0.4, default 0.12), cryoRidgeWarp (sinuosity), doubleRidgeFreq / cryoRidgeOffset / cryoRidgeWidth / groovedBandFreq sync from the preset; 🎲 randomize rolls the domain offset. If testing outside the Europa preset, set window._lab.state.cryoActivity = 1.0 manually (it is the F9/F10 master gate — at 0 the combiner early-outs and you'll see nothing). Clear with window._lab.enableAllFeatures().

## 6. What to judge (UAT checklist)

- [ ] Does each double ridge read as a paired-crest triplet — bright crest / dark central trough / mid crest — under oblique light in the 6-level posterized envelope, rather than a single sine bump?
- [ ] Do the ridge lines read as long, sinuous, quasi-parallel lineations that stay coherent across the visible disc and wrap the limb, not as isotropic bumpy noise?
- [ ] Do the grooved bands read as a clearly distinct second family — much finer parallel corrugations confined to band-shaped swaths along a different axis — so the surface looks like two crosscutting tectonic generations, not one pattern?
- [ ] Does the shared cryoActivity gate behave as activity: dead-smooth shell at 0, proportionally ridging in toward 1, with no pop?
- [ ] Does all the relief arrive as dither/shading-band texture (normal-routed) with zero albedo striping, preserving the retro identity?
- [ ] At mid distance (10-20 radii) do the fine grooves fade out before they alias — no Bayer shimmer or moire from groovedBandFreq?
- [ ] Does cryoRidgeWarp produce believable ridge sinuosity (gently meandering arcs like Europa's lineae) without breaking lines into disconnected fragments at high values?
- [ ] Where double ridges and grooved bands overlap, does it read as a tectonized refrozen shell (crosscutting) rather than a regular grid or interference pattern?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: 🟢 2026-06-10 (VERIFIED_PENDING_MAX) — Europa (icy moon), solo
  `cryoRidge`, d6/d3/d12 + gate/warp/amp sweeps. Drivers verified live:
  cryoActivity 1.0, amp 0.12, drFreq 3, offset 0.45, width 0.18,
  bandFreq 14, warp 0.3.
  - Lineations: long, sinuous, quasi-parallel ridge lines stay coherent
    across the disc and wrap the limb — anisotropic line fields, not
    isotropic bumps (shots 01 d6, 02 d3).
  - Double-ridge triplet: crest/trough/crest cross-section pinned by the
    doubleRidgeProfile vitest oracle; visible as paired-line internal
    banding along lineations under oblique light — subtle at the default
    amp 0.12, unambiguous at amp 0.3 (shot 06). Default amplitude is
    conservative; flag for Max if he wants Europa to read bolder.
  - Grooved bands: a clearly finer second family confined to band swaths
    along a different axis — two crosscutting tectonic generations, no
    grid/interference read (shots 01, 06).
  - Gate: cryoActivity 0 → dead-smooth shell (shot 04); amp scales
    proportionally (early-out verified).
  - Sinuosity: warp 0.7 produces broad meandering arcs, lines stay
    connected (shot 05).
  - Distance: ridges dissolve gracefully by d12, no moire from
    bandFreq 14 in stills (shot 03); temporal stability per FOUNDATION
    checks 3 & 4 🟢. All relief arrives as shading-band/dither texture —
    zero albedo striping.
  - Shots: F10-cryoridge-01-d6.png, -02-d3-profile.png, -03-d12-fade.png,
    -04-d6-activity0.png, -05-d6-warp07.png, -06-d6-amp03.png.
- Max's feedback: (pending Phase-7 lap)
- Tweaks applied: none (amp default noted as conservative — taste knob)
- Re-verify: n/a
- Status: VERIFIED_PENDING_MAX
