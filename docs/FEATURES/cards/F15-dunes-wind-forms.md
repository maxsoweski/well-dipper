# Feature Card — F15 Dunes & wind forms
Domain: Aeolian · Lab status: ⬜ · Build-seq phase: 4a

## 1. Description (WHAT)

Dunes & wind forms (F-gradational family). Physical chain: D5 atmosphere density (air to move grains, computed in computeAtmosphere:140) + D8 rotation/circulation + a dry surface (low liquid stability) + D14 gravity drive P9 aeolian transport — wind saltates sand into migrating dunes, abrades bedrock into yardangs and ventifacts, lays dust mantles, and paints wind streaks downwind of obstacles. The whole family is existence-gated by D6/P25 atmosphere retention: an airless world skips it entirely (the doc's living-world vs wind-still-rock fork). Variants per the L2 row: barchan (crescent, unidirectional wind, sand-starved) · linear/longitudinal (bidirectional, parallel ridges) · star (multidirectional, conic with arms) · yardang (wind-fluted bedrock) · ventifact (wind-carved rock) · wind streak (albedo tails off craters/hills). Intensity axis runs from a single crescent to a planet-scale erg (dune sea), migrating m–10m/yr. Real-body examples: Namib Sand Sea (100 m linear ridges + star dunes), Titan's equatorial hydrocarbon dune belts (Shangri-La), Mars barchans/yardangs/streaks. WD types: terrestrial, venus, ice, carbon, lava (silicate sand). Sibling F16 dust mantles (P9+P23) smooths relief rather than adding it.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). The lab reserves its slot explicitly: Stage 5 placeholder comment "AEOLIAN — dunes (anisotropic relief mod); dust mantle SMOOTHS relief (runs AFTER stage 2)" at planet-lod-lab.html:1524-1525 (no combiner exists in the Stage-2 chain at :1500-1513); the driver-preset comment at :2144 names "Aeolian F15" as a step-3 consumer; uLiquidStability (:1782, owner Fluvial) is documented as read by Aeolian for the dryness gate; and the GUI "Surface — Gradational" folder at :2495-2497 says "Future F12–F16 land here too." planet-archetypes.js FEATURES (:6-23) has no dunes entry. Nearest existing machinery to plug into: the relief-combiner pattern — a `duneCombiner(vPos, h, grad)` slotted after fluvialCombiner (:1504) writing anisotropic relief into h/grad, gated by uLiquidStability dryness + a D5-pressure-derived wind uniform from deriveUniforms, with a new FEATURES key wired into featureFolders (:2515-2520) for solo support.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/photojournal/flowing-dunes-of-shangri-la/
  — Titan Cassini SAR: hundreds of dark linear dunes snaking west-to-east, diverging and threading through chutes around bright mountains — dune fields read as a directional STRIPE TEXTURE that respects topography.
- [real] https://science.nasa.gov/photojournal/dome-and-barchan-dunes-in-newton-crater/
  — Mars HiRISE barchans: isolated crescents with two horns pointing downwind and one steep slip face — a sparse field of repeated asymmetric crescent glyphs on flat ground.
- [real] https://science.nasa.gov/earth/earth-observatory/linear-dunes-namib-sand-sea-89136/
  — Namib Sand Sea from ISS: ~100 m complex linear ridges running parallel for tens of km, with strong one-sided shading — the erg-as-corduroy look at orbital distance.
- [real] https://science.nasa.gov/photojournal/pj-medusae-fossae-formation/
  — Medusae Fossae yardangs: bedrock fluted into elongated parallel hills aligned with prevailing wind — same anisotropy as dunes but carved INTO relief, not deposited on it.
- [real] https://www.nasa.gov/image-article/wind-carved-rock-mars/
  — Wind-carved ventifact rock on Mars — sub-dune-scale wind sculpting; on our scale this is texture grain, not a discrete form.
- [art] https://www.alanzucconi.com/2019/10/08/journey-sand-shader-1/
  — Zucconi's Journey sand-shader series: dunes sold almost entirely through normals + specular on smooth geometry, not albedo — exactly the lighting-routed discipline our posterizer rewards.
- [art] https://www.gamedeveloper.com/marketing/how-shedworks-refined-the-art-of-sable-in-pursuit-of-readability
  — Sable's flat-shaded Moebius desert: dune seas as near-empty readable shapes where a few landmark forms carry orientation — a model for how little detail a stylized erg needs.
- [art] https://onlinelibrary.wiley.com/doi/10.1111/cgf.13815
  — Desertscape Simulation (Paris et al. 2019): the canonical CG result imagery for barchan/longitudinal/anchored dunes + wind abrasion — shows the target FORM vocabulary even though we replace the sim with closed-form noise.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology/CG models this with iterative transport sims: Werner's 1995 cellular automaton moves random "sand slabs" downwind with shadow-zone deposition and reproduces all four dune types (barchan/transverse/longitudinal/star) purely from wind directional variability + sand supply; Desertscape Simulation (Paris et al., CGF 2019) computes a relief-aware surface wind field, simulates saltation/reptation transport plus bedrock abrasion (yardangs), and a 2023 ACM PACMCGIT GPU follow-up adds echo dunes/obstacle interaction in real time. Underlying physics (Bagnold, "physics of wind-blown sand and dust"): saltation flux scales with shear velocity over a transport threshold; dune type is a function of wind-regime directionality (uni→barchan/transverse, bi→linear, multi→star) and sand availability; slip faces sit at the ~34° angle of repose, giving every dune a gentle stoss side and a sharp avalanche face. All of these are ping-pong/accumulation methods — per the research doc's determinism constraint they're off-limits for the structural layer (same verdict as Gray-Scott/stable-fluids in §3.3), so F15 must be a closed-form combiner: deterministic noise evaluated from position + seed. The research doc already contains the needed primitives: anisotropic domain compression (the gas-giant `p.y *= 2.5` latitude-banding trick, §3.2, re-aimed along a per-planet wind tangent field), ridged/billow octave variants and Voronoi F1 placement (§3.1/3.4), and lighting-routed detail through analytic-derivative `noised()` gradients so relief survives the 6-level posterize. Most promising shader-side approach: a `duneCombiner` that builds a wind tangent direction (e.g. zonal east-west from D8, hash-warped), compresses noise space perpendicular to it, and shapes an asymmetric sawtooth ridge profile (long stoss ramp, steep slip face) whose gradient feeds shadeN — dispatching linear (stretched ridged FBM) vs barchan (Voronoi-cell crescent masks) vs star (multi-direction max) off a wind-variability scalar derived from D5/D8, all gated by atmosphere pressure × dryness (1−uLiquidStability). Wind streaks ride along as the one allowed low-frequency albedo term: a downwind smear mask behind crater/edifice fields, mirroring the F3 ray-albedo exception (:1536-1538).

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built: (1) add a FEATURES entry in planet-archetypes.js, key `dunes` (label 'Dunes & wind forms (F15)', enableKey 'dunesEnabled', archetypes ['tectonic-terrestrial','volatile-cold']), and a 'Dunes & wind forms (F15)' subfolder under the existing 'Surface — Gradational' folder (planet-lod-lab.html:2497) wired into featureFolders (:2515) so the 🔆 solo button auto-appears. (2) Launch the :9223 Chrome (chrome-devtools-9223-launch memory file), open planet-lod-lab.html, run `window._lab.solo('dunes')` (:2908). (3) Preset 'Rocky (Earthlike)' as primary (retained 1-bar atmosphere, dry land above sea level); cross-check 'Titan (methane seas)' for the hydrocarbon-sand belt and 'Frozen (airless)' as the must-be-invisible airless gate proof. (4) Distances via `window._lab.state.distance` (radii, 1.1–30; lodRamp = smoothstep(20→6)): 12 — erg belts must read as coherent directional banding at near-global view; 4 — full LOD2, individual ridge anisotropy and slip-face shading; 1.5–2 — closest inspection, asymmetric profile and dither texture on the stoss slope. Verify state via `window.__wd.*` / the lab readout, not image recognition.

## 6. What to judge (UAT checklist)

- [ ] Does the dune field read as ANISOTROPIC — one coherent grain direction per region — in the 6-level posterized envelope, where every other relief feature (FBM mountains, craters) reads isotropic?
- [ ] Does each ridge read as asymmetric form: a long gentle stoss ramp catching a wide lit band and a short steep slip face dropping to a darker posterize level in one step?
- [ ] At far distance (~12 radii) does the erg read as a directional stripe/corduroy texture region distinct from bare rock, rather than dissolving into dither noise?
- [ ] Do dune belts behave like a deposit ON the surface — pooling in lowlands and flowing around mountains/crater rims (Titan Shangri-La behavior) — instead of stamping uniformly across all relief?
- [ ] Does the behavior gate correctly: dunes vanish on airless presets (no D5 air), shrink under high liquid stability (wet world), and strengthen on dry windy worlds?
- [ ] If wind streaks are included, do they read as faint one-directional albedo tails behind craters/obstacles, all agreeing with the dune grain direction, without breaking the posterize discipline?
- [ ] Does soloing the feature leave the base sphere unchanged where sand coverage is zero (regression-safe, like frostCover=0 ⇒ uBaseColor unchanged)?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
