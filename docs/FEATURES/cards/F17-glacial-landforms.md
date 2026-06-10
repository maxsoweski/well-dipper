# Feature Card — F17 Glacial landforms
Domain: Cryo · Lab status: ✅ · Build-seq phase: 3

## 1. Description (WHAT)

F17 Glacial landforms (F-gradational family) — surface expression of P10 Glacial flow: accumulated frozen volatiles compact and flow under their own weight, producing ice sheets/valley glaciers, U-valleys, fjords, moraines, eskers, and polar layered deposits. Physical chain: D2 volatile inventory + D1 cold supply the ice; D3 drives polar accumulation; D14 gravity sets sheet thickness and flow vigor. Timescale signature: builds/retreats over 10³–10⁶ yr, leaving flow lineations; intensity axis runs valley glacier → continental ice sheet. Real-body examples: Earth (fjords, drumlin/lineation fields), Mars (polar layered deposits, lobate ice), Pluto's N₂ glaciers draining into Sputnik Planitia. WD types: ice, terrestrial, eyeball, ocean. Inventory status `[aspirational]` is stale — v1 (mantle + lineations) is now built in the lab; U-valley/fjord carving remains the deferred rich tier.

## 2. Current shader approach (HOW, as-built)

BUILT (Cryo step 5, v1 scoped to mantle + lineations; U-valley/fjord flow-line carving explicitly deferred to a rich tier — comment at planet-lod-lab.html:1304-1305). Combiner: glacialCombiner() at planet-lod-lab.html:1317-1368, wired into the relief chain before lavaCombiner at :1512. Two pieces: (1) ICE MANTLE — fbmdDamped() at :931-948, the "erosion FBM" a += b·n.x/(1+k·dot(grad,grad)) from relief research §3.1, ponded where a LOW-frequency flow-proxy field (one noised() eval at FLOW_SCALE 0.7, :1337-1347) reports low regional slope (basinMask via uGlacialBasinThresh), and confined to the cold cap by the SAME localT<condensationT gate frost/F18 use (:1319-1331, reuses uFrost* uniforms — warm worlds glaciate only poles, Pluto-cold worlds broadly). (2) FLOW LINEATIONS (moraine/esker) — flow-aligned ridgeWave (1−|sin|) ridges (:1353-1367): across-flow axis = cross(normal, regional-downhill) held locally constant so the warped directional field's gradient is exact (no finite-diff oracle); skipped where slope≈0 (lineations are a flow signature). Uniforms declared :315-330, defaults :1746-1753, lab state :1998-2010, GUI folder 'Glacial (F17)' under Relief at :2477-2492. Drivers (planet-lod-lab-core.js): glacialStrength = smoothstep(0.15, 0.5, volatileFraction) at :847 — a HIGHER volatile-budget threshold than frost's 0.05→0.4 (relief needs ice thick enough to FLOW, not a frost coat); glacialFlowVigor = mix(0.4, 0.9, 1−g) ∝ 1/g at ~:852 scales lineation amplitude. Registry: planet-archetypes.js:20 — key 'glacial', enableKey 'glacialEnabled', archetype 'volatile-cold'.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/photojournal/valley-glaciers-on-pluto/
  — Pluto's N₂ valley glaciers draining highlands into Sputnik Planitia through 3-8 km valleys — the canonical 'cold-cap ice ponds in basins, flows off steeps' silhouette our mantle+basinMask should evoke.
- [real] https://www.nasa.gov/solar-system/new-horizons-discovers-flowing-ices-on-pluto/
  — New Horizons flowing-ice imagery: smooth bright sheet abutting rough dark uplands — a two-tone smooth-vs-detailed contrast that survives a 6-level posterize naturally.
- [real] https://science.nasa.gov/earth/earth-observatory/drumlin-field-in-northern-canada-85506/
  — Drumlin/mega-scale-lineation field from orbit: parallel flow-aligned ridges coherent over tens of km — exactly the regional coherence our ridgeWave lineations must show (not isotropic noise).
- [real] https://www.uahirise.org/PSP_010008_2630
  — Mars north polar layered deposits: stacked quasi-parallel strata along cap margins — the 'polar layered deposits' variant; banding reads as discrete luminance steps, posterize-friendly.
- [real] https://science.nasa.gov/earth/earth-observatory/hardangerfjord-norway-1269/
  — Hardangerfjord from orbit: deep U-profile troughs cut through a plateau — the deferred rich-tier U-valley/fjord carving target; note troughs follow regional flow lines.
- [art] https://www.artstation.com/marketplace/p/xG8r/low-poly-glacier-environment-for-game-development
  — Low-poly glacier game environment: ice reduced to a few flat luminance bands with hard facet edges — shows glacial forms still reading when color depth is heavily quantized.
- [art] https://store.steampowered.com/app/325210/Arctico/
  — Arctico's low-poly arctic: cold restrained palette, smooth ice sheets vs. sparse rock detail — form-first ice landscape proof for our retro/dithered envelope.

## 4. Math / modeling notes (HOW, from the field)

Academia models glacial flow with Glen's flow law inside the Shallow Ice Approximation (SIA): ice flux scales ~ thickness^(n+2) × surface-slope^n (n≈3), so ice ponds thick in basins and thins/accelerates on steeps — the physical justification for our basin-ponded mantle. The graphics-side state of the art is Argudo et al., 'Simulation, Modeling and Authoring of Glaciers' (SIGGRAPH Asia 2020, ACM TOG; open implementation at github.com/oargudo/glaciers): a multiresolution SIA solve produces ice thickness + flow direction + shear stress, then PROCEDURAL AMPLIFICATION synthesizes crevasses, moraines, ogives, seracs from those fields — i.e., simulate coarse, amplify fine, which is structurally what our combiner fakes in one fragment pass. Glacial erosion work (INRIA, Sigg et al. 2023) carves U-valleys with an abrasion law ∝ sliding-velocity², analogous to the stream-power carve in our research doc. Games almost never run SIA live; they use the research doc's (research/RESEARCH_high-lod-planet-shaders-2026-06-05.md) vocabulary: slope-damped FBM ('free erosion', §3.1 — detail dies on steeps, survives in flats, survives posterize, low cost) plus anisotropic/directional noise aligned to a flow field, with a 'cheap flow proxy' (one low-frequency analytic-derivative noised() eval, no iteration) standing in for the velocity field — exactly the as-built F17. Most promising shader-side next step: keep the current analytic-gradient mantle+lineations and add the rich-tier U-valley carve as a flow-aligned trough — subtract a parabolic cross-profile along the same low-frequency flow-proxy direction (the F4-canyon machinery with axis swapped global→local-flow), or bake a stream-power-style carve into a per-body LUT at LOD2 entry per the research doc's bake recommendation.

## 5. Isolation recipe (:9223)

Built — solo it on the :9223 debug Chrome (chrome-devtools MCP, per well-dipper-testing-reference.md): (1) navigate to planet-lod-lab.html; (2) evaluate `window._lab.setPreset('Titan (methane seas)')` — vf 0.4 → glacialStrength≈0.80, T_eq 94 K → near-global cold cap (alternatives: 'Europa (icy moon)' vf 0.5 → gate 1.0; 'Frozen (airless)' vf 0.3 → weak gate ≈0.37, good for the faint end); (3) `window._lab.solo('glacial')` — the real FEATURES key from planet-archetypes.js:20 — disables every other combiner; (4) to force full strength regardless of preset, set `window._lab.state.glacialStrength = 1.0` (GUI slider is .listen()-driven, manual override holds until next applyDrivers). Camera: `window._lab.state.distance = 8` for the cap-scale read (cold-cap confinement + basin ponding), then `= 3` and `= 1.5` for lineation texture and mantle smoothing (range is 1.1–30, default 20 is too far to see F17 relief). Toggle `window._lab.state.glacialEnabled` false/true to A/B the contribution; restore with `window._lab.enableAllFeatures()`.

## 6. What to judge (UAT checklist)

- [ ] Does the ice mantle read as smooth fill ponded in low-slope basins — flats smoothed over, steep exposed terrain keeping its detail — in the 6-level posterized envelope?
- [ ] Do the lineations read as parallel flow-ALIGNED ridges (moraine/esker/drumlin streamlining) coherent over regional distances, rather than isotropic bumpiness, within the posterize bands?
- [ ] Does glaciation stay confined to the cold cap — poles on a warm world, antistellar hemisphere on a locked eyeball, near-global on a Pluto-cold preset — with a soft rather than razor snowline edge?
- [ ] Does intensity track the volatile budget: Europa/Titan-class ice-rich worlds glaciate boldly while a modest-volatile world barely shows relief?
- [ ] Does flow vigor read as ∝1/g — low-gravity worlds carrying bolder lineation texture than subdued high-g sheets?
- [ ] Do lineations vanish where the regional surface is flat (no flow → no flow signature), so basin interiors stay smooth?
- [ ] Does the relief carry through lighting/normal shifts (posterize band boundaries tracking ridge flanks) rather than depending on color tint, per the strict-envelope rule?
- [ ] At distance, do the lineation ridges fade without shimmer/moire (fwidth anti-shimmer behaving), still suggesting a streamlined cap?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: 🟢 2026-06-10 (VERIFIED_PENDING_MAX) — Titan (methane seas) +
  Rocky polar check, solo `glacial`, d8/d3. Drivers verified live:
  Titan strength 0.802 / vigor 0.822 / basinThresh 0.15.
  - Mantle: smooth bright ice fill ponds in low-slope basins while
    steep terrain keeps its rough detail — the New-Horizons
    smooth-vs-rough two-tone contrast, posterize-native (shots 01 d8,
    02 d3). On/off A/B at d3 changes 17.7% of the frame; off restores
    base cleanly (shot 03).
  - Lineations: flow-aligned streaking within the mantle, regionally
    coherent (shot 02); slope-gated so basin interiors stay smooth.
  - Cold-cap confinement: forced strength on warm Rocky confines
    glaciation to the polar cap with a soft edge (shot 04, pitch 0.9);
    Titan's cold T_eq glaciates broadly (shot 01).
  - Volatile-budget driver (objective): strength 0 Rocky / 0.394 Frozen
    / 0.802 Titan / 1.0 Europa — tracks vf through the 0.15→0.5
    smoothstep as designed.
  - 1/g vigor driver (objective): 0.45 Rocky (1 g) vs 0.76–0.82 on the
    small icy bodies.
  - Distance fade/temporal stability per FOUNDATION checks 3 & 4 🟢.
  - Shots: F17-glacial-01-d8-titan.png, -02-d3-lineations.png,
    -03-d3-off-AB.png, -04-d8-rocky-polar.png.
- Max's feedback: (pending Phase-7 lap)
- Tweaks applied: none needed
- Re-verify: n/a
- Status: VERIFIED_PENDING_MAX
