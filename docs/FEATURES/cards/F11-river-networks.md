# Feature Card — F11 River networks & valleys
Domain: Fluvial · Lab status: ✅ · Build-seq phase: 3

## 1. Description (WHAT)

River networks & valleys (F-gradational family, planet-visual-features.md:233). A stable surface liquid — water, or methane/ethane on cold worlds — flows downslope and incises channels, building branching drainage systems. Source process P8 "Fluvial erosion/deposition" (:149): liquid stability requires the D1 (T_eq) + D2 (volatile budget) + D6 (atmosphere retention) chain plus D14 gravity and D4 rain; an airless world skips the entire family (the D13 geomagnetism callout: lose the field → lose the atmosphere → lose all fluvial features). Activity regime sets sharpness: active = sharp banks, relict = degraded (10³–10⁷ yr timescales, magnitudes from trickle rill to continental trunk river/megaflood). Variants: dendritic network · meanders · single trunk · relict (degraded). Real bodies: Earth (water dendritic + meanders), Titan (methane rivers, Vid Flumina), Mars (relict valley networks like Warrego Valles). WD types: terrestrial, ocean, ice, eyeball, carbon (hydrocarbon). Siblings F12 deltas, F13 outflow channels, and F14 lakes share the same P8 driver.

## 2. Current shader approach (HOW, as-built)

BUILT (ported 2026-06-07/08 from the fluvial-drainage-lab.html spike, "proven on :9223"). Registry: planet-archetypes.js:21 — FEATURES.rivers, label 'Rivers & valleys (F11)', enableKey 'riversEnabled', archetypes ['tectonic-terrestrial','volatile-cold']. Shader: 13 uniforms at planet-lod-lab.html:329-342 (uFluvialActivity/Density/Depth/Meander/Width/Freq/WarpAmt/WarpFreq/TribLac/TribGate/LowBias/HiGround/Offset). drainageField() :618-646 — channels are the near-zero band |fbm| < uFluvialWidth of a domain-warped analytic-derivative noise field (trunks); a finer tributary octave is gated to a wide apron approaching the trunk and UNIONed via max() so feeders connect INTO trunks (dendritic) instead of overlaid loops; the analytic gradient follows the union winner. fluvialCombiner() :648-669 (Stage-4, called :1504) — early-outs at uFluvialDensity<=0, mixes "channels everywhere" vs "low ground only" via uFluvialLowBias, carves DOWN into both h and the shared canyonHeight accumulator (so a future F14 lake pass can pool liquid for free), scales depth 0.35..1 by activity (relict = shallower), and bends grad so perturbAnalytic lights the channel walls. Stage-6 species floor-tint :1548-1551 — fluvialWet darkens floors blue (water) or brown (uLiquidSpecies==1, methane), albedo-only, pre-posterize, x0.35xdensity. Driver derivation :2265-2283 in applyDrivers(): existence gate = liquidStability (computed planet-lod-lab-core.js:531-553 with water AND methane windows), density from rain, depth adds gravity, relict path only for presets that retained an atmosphere (airless floors to 0). GUI folder 'Rivers & valleys (F11)' :2498-2509 under Gradational, with a per-feature solo button (:2561-2563).

## 3. Reference images (real + art)

- [real] https://photojournal.jpl.nasa.gov/catalog/PIA16197
  — Cassini radar of Titan's Vid Flumina river system — a clean dendritic hierarchy of deeply incised channels (~1 km wide, ~200 m deep) in ice crust; the methane/hydrocarbon variant our uLiquidSpecies=1 floor-tint targets.
- [real] https://www.jpl.nasa.gov/images/pia06899-warrego-valles/
  — Warrego Valles, Mars — the canonical RELICT dendritic network: branching form still legible but banks degraded and shallow, exactly what low uFluvialActivity should read as.
- [real] https://science.nasa.gov/earth/earth-observatory/yukon-delta-alaska-72762/
  — Yukon Delta — branching channels 'like overlapping blood vessels'; notice trunks dominating with tributaries feeding in, the union-into-trunk topology our apron gate reproduces.
- [real] https://science.nasa.gov/earth/earth-observatory/meandering-mississippi-river-147001/
  — Meandering Mississippi — sinuosity of a single trunk plus oxbow scars; the form the uFluvialMeander domain-warp knob is aiming for at high rain.
- [art] http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/
  — Amit Patel's polygonal map generation — stylized game rivers traced coast-to-mountain on a Voronoi graph; shows how few, bold, connected channels read better than many faint ones in a flat-shaded style.
- [art] https://www.shadertoy.com/view/7ljcRW
  — 'Terrain Erosion Noise' (clayjohn/Fewes lineage) — pointwise-evaluable noise with branching gully structure; the shader-side aesthetic ceiling for non-iterative drainage like ours.
- [art] https://blog.runevision.com/2026/03/fast-and-gorgeous-erosion-filter.html
  — Runevision's fast erosion filter — stylized real-time erosion where channel walls carry the look via lighting, not texture; matches our grad-bending wall-lighting approach.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology models channel incision with the stream-power law E = K·A^m·S^n (upstream drainage area A, local slope S), with Horton–Strahler ordering describing the dendritic hierarchy and sinuosity describing meanders. Offline terrain tools simulate this with iterative hydraulic erosion (droplet or pipe-model ping-pong passes — the research doc's 'true hydraulic needs ping-pong → bake once into a per-body LUT at LOD2 entry'); hydrology-first procedural papers invert the problem, growing the river graph and fitting terrain to it (Amit Patel's Voronoi mapgen is the game-art cousin). Pointwise shader-side alternatives, in the research doc's vocabulary: slope-damped/erosion FBM (IQ morenoise — 'a += b*n.x/(1+dot(d,d))', survives, low cost), the analytic stream-power proxy carve ('elevation -= k*pow(flowProxy,0.8)*pow(slope,2)' using the analytic-derivative |grad| as slope), the clayjohn/Fewes/Hatchling 'eroded terrain noise' family (branching gullies, every point evaluable in isolation), and zero-set channel carving — channels as the near-zero band of a domain-warped FBM, which is what the lab ships, extended with an apron-gated tributary octave UNIONed via max() for dendritic topology. Most promising path: keep the current analytic-derivative zero-set + tributary-union primitive (proven, cheap, gradient chain-rules cleanly into perturbAnalytic so it survives the posterize as lit relief). If LOD2 demands more realism, add the analytic stream-power proxy as a second carve term, or bake one true hydraulic ping-pong pass into a per-body LUT at LOD2 entry — both already flagged 'survives' in the research doc.

## 5. Isolation recipe (:9223)

Built — use the :9223 chrome-devtools lab session (per well-dipper-testing-reference.md, NOT Playwright). 1) Load planet-lod-lab.html, then in evaluate_script: window._lab.setPreset('Rocky (Earthlike)') — wet n2-o2 world, derives active water network (check window._lab.state.fluvialDensity > 0 and window._lab.uniforms.uFluvialDensity.value). 2) window._lab.solo('rivers') — real key from planet-archetypes.js:21 FEATURES; clears every other feature so only the F11 carve + floor-tint remain on the Stage-A base. 3) Distances via window._lab.state.distance: 2.5 radii to judge network topology (dendritic tree, trunk dominance), 1.3 for wall-lighting close-up (LOD2 band), 6 for the global existence/gating read. 4) Variant passes: window._lab.setPreset('Titan (methane seas)') for the methane species (uLiquidSpecies=1, brown floor-tint); for relict, set window._lab.state.fluvialActivity = 0.3 and fluvialDensity = 0.3 (Mars-style degraded); negative control: setPreset('Lava (hot airless)') or 'Frozen (airless)' must show zero channels (atmosphere:null → density floors to 0). Exaggerate with state.fluvialDepth up to 0.4 and fluvialMeander 0..1 via the 'Rivers & valleys (F11)' GUI folder. Restore with window._lab.enableAllFeatures().

## 6. What to judge (UAT checklist)

- [ ] Does it read as a branching dendritic TREE in the 6-level posterized envelope — tributaries visibly joining INTO trunks at junctions — rather than two overlaid, unconnected line patterns?
- [ ] Do channels read as carved negative relief: one wall lit, one shaded by the bent gradient through perturbAnalytic — not as a flat painted dark stripe?
- [ ] Does raising meander produce sinuous, winding trunks (Mississippi-style) without tearing branch connectivity apart?
- [ ] With low-ground bias up, do channels hug lowlands and valley floors and fade off peaks, so the network feels drainage-driven rather than uniformly stamped?
- [ ] Does the relict setting (low activity/density) read as degraded, shallow, soft-banked valleys (Warrego Valles) versus the sharp incised banks of the active setting?
- [ ] Does the species floor-tint read as a subtle floor darkening that survives posterize — bluish on water worlds, brownish on the Titan preset — without becoming a saturated paint line?
- [ ] Do airless presets (Lava, Frozen) show NO channels at all — the existence gate behaving as the physical chain (no atmosphere, no rivers) demands?
- [ ] At global distance (~6 radii), does the network frequency stay coarse enough to read as a few continental trunk systems instead of dissolving into posterized noise?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
