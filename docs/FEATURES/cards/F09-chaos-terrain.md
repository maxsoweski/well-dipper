# Feature Card — F09 Chaos / disrupted terrain
Domain: Relief · Lab status: ✅ · Build-seq phase: 3

## 1. Description (WHAT)

Chaos / disrupted terrain — regions where coherent crust breaks into a jumble of displaced blocks. Derives from P2 tectonic deformation (crust stretches/slides; D11 surface-history, D12 tidal heating, D14 gravity, D2 ice-shell extension), P6 tidal-heat resurfacing (relentless flexing keeps the interior molten and repaves the surface, Io-grade; D12, D7, D14), and P7 cryovolcanism (pressurized water+ammonia cryomagma ascends fractures and resurfaces icy shells; D2, D12, D1). Three variants per the inventory (docs/FEATURES/planet-visual-features.md:224): (1) ice-shell chaos — rafts: broken, rotated, refrozen plates floating in a lower matrix (Europa's Conamara Chaos); (2) volatile-outflow collapse — subsidence basins with mesa/knob floors where subsurface volatiles drained (Mars Hydraotes Chaos, Mercury's volatile-loss chaotic terrains); (3) antipodal seismic jumble — hilly-and-lineated "weird terrain" focused opposite a giant impact basin (Caloris antipode). WD types: ice, ocean, rocky, shattered. Inventory status tag still reads [aspirational] — superseded by the Stage-C step-3 build (cheap tier shipped; doc lags the lab).

## 2. Current shader approach (HOW, as-built)

BUILT (cheap tier) in world-engine-lab.html. Combiner: chaosCombiner() at world-engine-lab.html:1171-1186 (doc comment :1160-1170) — early-outs when the shared uCryoActivity ≤ 0 (:262, defined :1785, owner = Cryo/P7); a low-freq noised() region mask (uChaosMaskScale, uChaosOffset) thresholded by uCryoActivity picks WHERE chaos exists; inside it, voronoi3d(pos * uChaosCellScale) partitions the shell into rafts — hash33(cellId) gives each raft a flat hashed height (raftH, cosmetic grad) AND a per-cell CONSTANT tilt gradient (exact normal, so adjacent plates catch light differently — the "jigsaw of moved plates" read); cell borders (small ff.y-ff.x) become a lower refrozen matrix (matrixDepth = −0.4·uChaosRaftJitter) roughened by a 2.7× higher-freq noised() (uChaosMatrixRough). Called in the Relief height assembly at :1509. Uniforms declared :268-273, defaults :1700-1705. Driven-vs-lab split: cryoActivity, chaosCellScale, chaosRaftJitter (∝1/g), chaosMatrixRough flow from the driver preset via applyDrivers() (:2230-2234); chaosMaskScale is a lab knob. GUI folder 'Chaos (F9)' at :2414-2426 with solo + 🎲 randomize. Registry: planet-archetypes.js:16 — key 'chaos', enableKey 'chaosEnabled', archetype 'icy-active' (Europa/Ganymede; preset 'Europa (icy moon)', world-engine-lab.html:2160). Rich tier DEFERRED per relief doc §F9.d: per-cell domain rotation, subsidence basins, antipodal placement at −largestImpactCenter (cost/seam risk flagged in research/stage-b/RESEARCH_stage-b-relief-2026-06-06.md:374). Existing isolation screenshots: f9-01-chaos-isolated.png / f9-02-chaos-off.png in repo root.

## 3. Reference images (real + art)

- [real] https://photojournal.jpl.nasa.gov/catalog/PIA01177
  — Galileo 9 m/px close-up of Europa chaos — flat-topped plates with crisp edges sitting in a visibly lower, rubbly matrix; the plate/matrix value step is the form to keep.
- [real] https://science.nasa.gov/resource/europa-ice-rafts-in-local-and-color-context/
  — Conamara ice rafts in context — rafts shifted, rotated, and tipped, each catching light differently; the per-plate tilt facet is exactly what uChaosRaftJitter's constant gradient mimics.
- [real] https://svs.gsfc.nasa.gov/11176
  — NASA SVS Europa chaos-terrains visualization — shows chaos as discrete regional patches inside otherwise coherent ridged shell, matching the low-freq region-mask approach.
- [real] https://science.nasa.gov/photojournal/weird-terrain-at-the-antipode-of-caloris/
  — Mercury's hilly-and-lineated 'weird terrain' at the Caloris antipode — the seismic-jumble variant: dense knob field crosscutting older craters, no plate flatness.
- [real] https://www.uahirise.org/PSP_009709_1810
  — HiRISE Hydraotes Chaos (Mars) — volatile-outflow collapse variant: smooth-floored basin with steep-sided mesas and knobs separated by narrow valleys (subsidence + remnant blocks).
- [real] https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/Waterworn_chaos_on_Mars
  — ESA Mars Express oblique view of waterworn chaos — broad collapsed depression with a chaotic block floor, the 'inverted-dome basin reusing the raft field' rich-tier target.
- [art] https://www.deviantart.com/uxmal750ad/art/Conamara-Chaos-418447460
  — Stylized Conamara Chaos render — demonstrates the raft/matrix read surviving heavy stylization: tilted bright plates against a dark matrix carry the whole composition.
- [art] https://www.artstation.com/artwork/8l32Pw
  — Lara Colson's Outer Wilds environments (Brittle Hollow) — a planet built of separate low-poly fragments; shows how flat-faceted, individually-lit plates read in a stylized envelope.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology: Europa chaos is modeled as melt-lens collapse — tidal heat (D12) thins the ice shell, a subsurface brine lens forms, the lid founders into rafts that translate/rotate and refreeze in a lower slushy matrix (the Schmidt-style collapse model; the matrix stands ~hundreds of meters below raft tops). Mars/Mercury chaotic terrain is volatile-outflow subsidence: a buried volatile layer drains/sublimates, the overburden collapses into mesas + knobs inside a basin (Rodriguez et al. 2020 reinterprets Mercury's antipodal terrain this way, alongside the classic Caloris seismic-focusing model). Games/procgen model all three as a cellular partition with per-cell rigid jitter: Voronoi/Worley cells as plates, hash-driven per-cell height offset + rotation, F2−F1 border distance carving the matrix channel — the same vocabulary the project's HOW-spec (research/RESEARCH_high-lod-planet-shaders-2026-06-05.md) uses for crater fields and fault scarps ("Voronoi border distance (F2−F1)", "analytic-derivative noised() FBM", cosmetic-gradient convention for slowly-varying masks). The spec's central rule applies directly: the 6-level Bayer posterize rewards detail routed through NORMALS, not albedo — which is why the current build's key move is the per-cell CONSTANT tilt gradient (exact normal per raft → distinct lit facets → distinct posterize bands per plate). Most promising shader-side path: keep the voronoi3d raft field + exact per-cell tilt as the spine, then add the rich tier in order of payoff — (1) per-cell 2D domain rotation of the raft's internal texture coords (with the documented height-jitter-only fallback if border seams or matrix-per-fragment cost bite), (2) a broad inverted-dome subsidence basin whose floor reuses the raft field (gives the Mars/Mercury variant nearly free), (3) antipodal mask placement at −largestImpactCenter once F2's largest-basin center is surfaced as a uniform.

## 5. Isolation recipe (:9223)

Built — solo it in the lab on the :9223 debug Chrome (launch per chrome-devtools-9223-launch.md: second Chrome with --remote-debugging-port=9223), open the Vite-served /world-engine-lab.html page (Max starts the dev server; do not start it yourself). Then via mcp__chrome-devtools__evaluate_script: (1) window._lab.setPreset('Europa (icy moon)') — derives cryoActivity≈1 plus driven chaosCellScale/chaosRaftJitter/chaosMatrixRough from the physics preset; (2) window._lab.solo('chaos') — real FEATURES key is 'chaos' (planet-archetypes.js:16), disables every other feature's enableKey; (3) sanity: window._lab.featureEnabled('chaos') === true; (4) distances: window._lab.state.distance = 8 for the whole-disk read (chaos patches vs. clean shell), then 3 for the raft close-up — lodRamp = smoothstep(20,6,approach) so ≤6 radii is full detail; (5) gate check: set window._lab.state.cryoActivity = 0 and confirm the rafts vanish (early-out), restore via setPreset; (6) variety: window._lab.state.chaosOffset = [Math.random()*100,Math.random()*100,Math.random()*100] to re-roll the domain. Compare against the existing baselines f9-01-chaos-isolated.png / f9-02-chaos-off.png in the repo root.

## 6. What to judge (UAT checklist)

- [ ] Does chaos read as discrete disrupted PATCHES inside otherwise coherent shell (region-mask behavior), not as an all-over noise texture, in the 6-level posterized envelope?
- [ ] Do rafts read as flat, individually TILTED plates — each plate landing in its own posterize band via its distinct lit facet — i.e. 'a jigsaw of moved plates', not generic bumpiness?
- [ ] Does the inter-raft matrix read as LOWER and rougher than the raft tops (refrozen slush between blocks), with the raft/matrix step surviving as a crisp value boundary rather than dither mush?
- [ ] Does dragging the shared ICY ACTIVITY knob (cryoActivity 0→1) behave as a coverage gate — none → sparse patches → broad disruption — without popping?
- [ ] Does raft jitter scaling (∝1/g, preset-driven) read as more-displaced, more-tipped blocks on the low-gravity Europa preset versus a heavier body?
- [ ] At full-disk distance (~8 radii) do chaos regions still read as mottled disrupted province against clean ice, and at ~3 radii do individual plate edges resolve without aliasing sparkle?
- [ ] When F10 ridged-icy is re-enabled alongside (clear solo), do rafts visibly TRUNCATE/disrupt the ridge fabric rather than blending into it — chaos crosscuts what it breaks?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: 🟢 2026-06-10 (VERIFIED_PENDING_MAX) — Europa (icy moon), solo
  `chaos`, d8/d3 + gate and crosscut checks. Drivers verified live:
  cryoActivity 1.0, cellScale 5, raftJitter 0.66, matrixRough 0.5.
  - Patches: chaos reads as discrete disrupted provinces inside coherent
    shell at d8, not all-over noise (shot 01).
  - Rafts: flat angular plates at distinct posterize bands (per-cell
    tilt facets catching light differently) — jigsaw of moved plates,
    with darker, rougher matrix channels between raft tops (shot 02).
  - Gate: cryoActivity=0 → raft jigsaw vanishes leaving only base macro
    relief (early-out verified live); 0.45 → sparser patches (shot 03).
  - 1/g jitter driver (read live): Europa 0.66 / Titan 0.722 (low g) vs
    Rocky 0.35 (1 g); cryoActivity simultaneously gates chaos OFF on
    Rocky and Titan (0) — only icy-active worlds get rafts.
  - Crosscut: with F10 cryo-ridges re-enabled, the ridge fabric visibly
    truncates at chaos patches instead of blending through (shot 04).
  - Temporal/aliasing stability covered by FOUNDATION checks 3 & 4 🟢.
  - Shots: F09-chaos-01-d8-patches.png, -02-d3-rafts.png,
    -03-d3-activity045.png, -04-d3-crosscut-ridges.png.
- Max's feedback: (pending Phase-7 lap)
- Tweaks applied: none needed
- Re-verify: n/a
- Status: VERIFIED_PENDING_MAX
