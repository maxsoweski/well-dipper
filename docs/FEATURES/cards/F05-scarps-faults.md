# Feature Card — F05 Scarps & fault systems
Domain: Relief · Lab status: ✅ · Build-seq phase: 3

## 1. Description (WHAT)

Scarps & fault systems (F5, family F-relief) — cliffs and ridge trains left where the crust broke and one block moved past another. Physical chain (L1 P2 "Tectonic deformation"): crust stretches, contracts, or slides → fault scarps, rifts/grabens, wrinkle ridges; driven by D11 (lithology), D12 (internal heat), D14 (gravity), D16 (age — secular cooling→global contraction), and D2 (ice-shell extension on icy worlds). Signature: active or fossil, and it CROSSCUTS what it offsets (a scarp slicing a crater is the tell). Intensity axis runs local fault → globe-girdling scarp/rift system. Variants: normal-fault cliff (extension — dropped block), lobate contraction scarp (compression thrust — Mercury/Moon type), wrinkle ridge (blind-thrust fold in mare plains), horst-and-graben province (alternating raised/dropped blocks). Real-body examples: Discovery Rupes and Enterprise Rupes (Mercury), lunar maria wrinkle ridges, Claritas Fossae grabens (Mars). WD types: rocky, mercury-like, terrestrial, venus, ice. Related: P12 mass-wasting degrades scarps over time (slump scarps, talus), reflected in the erosion driver. (Inventory rows: planet-visual-features.md:220 [F5], :143 [P2]; note the `[aspirational]` tag there is STALE — F5 shipped in the Relief stage.)

## 2. Current shader approach (HOW, as-built)

BUILT — Stage-C step 3 (Relief) in world-engine-lab.html. Mechanism: warped soft-step fault-block train. `scarpProfile(field, level, width)` (GLSL world-engine-lab.html:853-868, transcribed from the vitest-pinned JS oracle planet-lod-lab-core.js:296-307) is a smoothstep one-sided cliff returning (height, analytic d(height)/dfield). `scarpCombiner` (world-engine-lab.html:869-892, called at :1505 in the Stage-2 relief pass) builds a directional field `dot(pos, uScarpAxis) + uScarpWarp·noise` (warp makes the fronts sinuous/lobate), runs `sin(field·uScarpFreq)` as a periodic fault train, soft-steps it through scarpProfile, and adds ±0.5-centered block relief to h with an EXACT gradient (axis + warp·noiseGrad — no Jacobian shortcut) so cliff faces light correctly under the posterizer. `uScarpStyle` flips thrust(up)↔normal(down) polarity; `uScarpStrength ≤ 0` early-outs. Uniforms declared :214-222, initialized :1658-1666, driven per-frame :2719-2721 (gated by `state.scarpsEnabled`). Drivers (planet-lod-lab-core.js:678-698): scarpStrength = clamp01(smallness·(1−0.5·erosion))·0.12 where smallness = clamp01((1.3−radiusEarth)/1.0) — small bodies cool/contract more (Mercury logic); scarpStyle = smoothstep(0.1, 0.3, volatileFraction) — rock contracts→thrust, ice shell extends→normal; scarpAxis = seededUnitVec3(seed+7). GUI: 'Scarps (F5)' folder under Relief (world-engine-lab.html:2346-2357) with strength/style (.listen()-driven), lab knobs scarpWidth/scarpFreq/scarpWarp/scarpWarpFreq, ✓ enabled, and a 🎲 roll (re-seeds axis + domain offset). Feature registry: planet-archetypes.js:9 — key `scarps`, enableKey `scarpsEnabled`, archetypes ['impact-airless','tectonic-terrestrial'].

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/photojournal/discovery-rupes-scarp/
  — Discovery Rupes, Mercury — the type lobate contraction scarp: a single sinuous one-sided cliff snaking hundreds of km across and CUTTING THROUGH craters; note the hard lit/shadow line along the front and flat terrain on both blocks.
- [real] https://lroc.im-ldi.com/images/618
  — Wrinkle ridge in Mare Crisium (LROC) — low-amplitude sinuous ridge on an otherwise flat plain; reads almost entirely as a lighting edge, exactly the 'subtle relief, hard edge' our 0.12-amplitude target is going for.
- [real] https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/The_grabens_of_Claritas_Fossae
  — Claritas Fossae, Mars (Mars Express) — a horst-and-graben province: many roughly PARALLEL fault lines sharing one regional orientation with flat blocks between, the multi-scarp 'train' our sin(field·freq) models.
- [real] https://www.jpl.nasa.gov/news/study-finds-new-wrinkles-on-earths-moon/
  — NASA JPL on young lunar scarps/wrinkle ridges — scale calibration: longest ~400 km, relief only ~300 m; scarps are SMALL relative to the globe but visually dominant via their shadow line.
- [art] https://danielilett.com/2020-02-26-tut3-9-obra-dithering/
  — Obra Dinn-style dither tutorial — shows how a hard lit/shadow boundary stays crisp through Bayer dithering while smooth gradients band; a scarp front should behave like the former.
- [art] https://dukope.com/devlogs/obra-dinn/tig-32/
  — Lucas Pope's Obra Dinn devlog on stabilizing dither under motion — the temporal-coherence failure mode (crawling pixels on edges during rotation) to check our cliff faces against.
- [art] https://www.shadertoy.com/view/msdXzl
  — 'Procedural Red Planet' shadertoy — a stylized procedural rocky planet; useful for judging how directional relief features read at globe scale in a non-photoreal shader.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology: a fault scarp is a displacement STEP across a fault trace — academia models the fresh scarp as a step function of fault offset, then degrades it by hillslope diffusion (∂h/∂t = κ∇²h, the classic Hanks/Wallace scarp-dating model) — i.e. a smoothstep of growing width is literally the analytic solution shape, which is what scarpProfile already is (erosion driver ↦ wider/softer face is physically faithful). Compression worlds (Mercury, Moon) produce one-sided thrust scarps and wrinkle ridges (folds over blind listric thrusts, per LROC); extension produces paired normal faults → grabens between horsts. Procedural/games vocabulary (per research/RESEARCH_high-lod-planet-shaders-2026-06-05.md §3.1): two standard generators exist — (a) warped directional iso-contours (domain-warped `dot(pos,axis)` levels — what we built; gives a regionally-oriented parallel train, correct for contraction provinces), and (b) **Voronoi border distance (F2−F1)**, IQ's two-pass perpendicular edge distance with `ridge = 1−smoothstep(0,w,d)` for scarps/crests and inverted for graben — gives an irregular crosscutting fault NETWORK instead of a parallel train. Both "survive" the posterize because the relief feeds the analytic-derivative normal, so the cliff renders as a hard lit/shadow band edge (lighting carries the form, not albedo). Most promising shader-side path: keep the current warped iso-contour soft-step train as the base (it is the diffusion-degraded step model with exact gradients, already vitest-pinned); the highest-value extension is a Voronoi-border variant for crosscutting fault networks on tectonic-terrestrial bodies, plus an asymmetric profile (steep face, gentle back-slope) to push wrinkle-ridge reads — both reuse existing noised()/smoothstep machinery and the same chain-rule gradient pattern.

## 5. Isolation recipe (:9223)

Built — solo it in the lab on the :9223 debug Chrome (see memory/chrome-devtools-9223-launch.md; use chrome-devtools MCP, not Playwright). 1) Open world-engine-lab.html. 2) `window._lab.setPreset('Frozen (airless)')` — radiusEarth 0.5 → smallness 0.8, erosion 0.1 → scarpStrength ≈ 0.091 (strong), volatileFraction 0.3 → scarpStyle = 1.0 (normal/down-dropped cliffs). For the thrust polarity, `window._lab.setPreset('Rocky (Earthlike)')` (low volatileFraction → style ≈ 0, weaker strength — Earth-wrinkle-ridge regime). 3) `window._lab.solo('scarps')` — key `scarps` from planet-archetypes.js FEATURES (:9). 4) Distances via `window._lab.state.distance`: 6 for province read (parallel-train layout), 2.5 for individual scarp-front form, 1.3 for cliff-face close-up (range 1.1–30). 5) Tune the lab knobs in GUI folder Relief → 'Scarps (F5)': cliff softness (scarpWidth), fault count (scarpFreq), sinuosity (scarpWarp); hit 🎲 roll for fresh axis/domain seeds. 6) `window._lab.enableAllFeatures()` to clear the solo when done.

## 6. What to judge (UAT checklist)

- [ ] Does each scarp front read as a ONE-SIDED cliff in the 6-level posterized envelope — a single hard lit/shadow band edge with flat blocks on both sides — rather than a smooth ramp or a symmetric corrugation?
- [ ] Does the fault train read as roughly parallel scarps sharing one regional orientation (⊥ the seeded axis), each front sinuous/lobate from the warp — snaking like Discovery Rupes, never ruler-straight?
- [ ] Do the blocks BETWEEN cliffs read as flat plains (horst-and-graben), not as a continuous sine-wave undulation — i.e. does the soft-step profile keep treads flat at the current scarpWidth?
- [ ] Does the thrust↔normal polarity flip read as a form change (style 0 → raised blocks stepping UP vs style 1 → dropped blocks stepping DOWN) when comparing Frozen vs Rocky presets?
- [ ] As the light/terminator sweeps a cliff face, does it flip cleanly between posterize bands with the bright side on the correct (light-facing) slope — the exact-gradient check; a sign-wrong gradient lights the scarp backward?
- [ ] Do scarps crosscut craters and other relief plausibly (additive offset through them) without erasing the crater forms — the 'crosscuts what it offsets' P2 signature?
- [ ] During slow rotation at distance ~2.5, do the cliff-edge dither pixels stay temporally stable (no crawling/shimmer along the front)?
- [ ] At province distance (~6) does the system still read as regional fault structure rather than dissolving into noise, given the deliberately small (≤0.12) relief amplitude?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: 🟢 2026-06-10 (VERIFIED_PENDING_MAX) — Frozen (airless) + Rocky
  (Earthlike), solo `scarps`, d6/d2.5/d4. Drivers verified live: Frozen
  strength 0.0912 / style 1.0 (card's ≈0.091 normal-fault regime); Rocky
  strength 0.0288 / style 0.156 (weak thrust / wrinkle-ridge regime).
  - One-sided cliff: each front is a single hard lit/shadow band edge
    with flat dithered treads on both sides — no symmetric corrugation
    (shots 01 d6, 02 d2.5).
  - Train + sinuosity: fronts share one regional orientation and snake
    lobately (Discovery-Rupes-like), never ruler-straight (shot 01).
  - Polarity: controlled A/B at fixed strength on Frozen — style 0 vs 1
    inverts the raised/dropped relationship along the same front lines
    (same seed/axis), a form change not a re-roll (shots 02 vs 04);
    profile polarity also pinned by the scarpProfile vitest oracle.
  - Preset regimes: Rocky reads as faint low-amplitude wrinkle ridges —
    lighting-edge relief on plains (shot 03), clearly distinct from
    Frozen's strong cliffs; matches the smallness/volatile drivers.
  - Crosscut: with craters re-enabled at d4, scarp fronts slice through
    crater fields while craters stay legible — additive offset, the P2
    signature (shot 05).
  - Province read at d6 holds as regional structure despite the ≤0.12
    amplitude (shot 01). Rotation/dither stability covered by FOUNDATION
    check 3 🟢 (screen-anchored Bayer, stationary speckle under rotation).
  - Shots: F05-scarps-01-d6-frozen.png, -02-d2.5-front.png,
    -03-d2.5-rocky-wrinkle.png, -04-d2.5-style0-thrust.png,
    -05-d4-crosscut-craters.png.
- Max's feedback: (pending Phase-7 lap)
- Tweaks applied: none needed
- Re-verify: n/a
- Status: VERIFIED_PENDING_MAX
