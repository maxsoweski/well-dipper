# Feature Card — F21 Karst / dissolution
Domain: Fluvial · Lab status: ⬜ · Build-seq phase: 4a

## 1. Description (WHAT)

F21 Karst / dissolution (domain: Fluvial; family F-gradational, docs/FEATURES/planet-visual-features.md:243). Physical chain from P14 (line 155): a solvent — water, or an exotic like liquid methane/ethane — chemically eats soluble crust, producing sinkholes/dolines, labyrinth/dissolution terrain, and collapse lakes. Drivers: soluble lithology + a stable solvent liquid + D11 surface-history (line 102, erosion/age budget) + D4 atmosphere composition (line 95, supplies the rain). Maturity axis = degree of dissection: shallow grooves → deep labyrinth maze. The whole F-gradational family is existence-gated by D6/P25 (retained atmosphere + stable liquid — airless worlds skip it, line 228). Variants: sinkhole/doline field · labyrinth maze (dissected plateau cut into polygonal remnants by through-going valley slots) · collapse lake (liquid-filled pit). Real bodies: Titan's high-latitude labyrinth terrain (methane dissolving organic crust) and Earth limestone karst (Florida dolines, Guilin fenglin/fengcong tower karst). WD types: terrestrial, ice, carbon, ocean. Status: [aspirational].

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). No karst key exists in the FEATURES registry (planet-archetypes.js:6-23) and no karstCombiner in the lab; the only mention is the Stage-4 roadmap comment that explicitly reserves the slot — "Stage 4: FLUVIAL incision — channels/karst carve, add into canyonHeight; uLiquidMask cut at seaLevel" (planet-lod-lab.html:1523). Nearest machinery it should plug into: the F11 fluvialCombiner (planet-lod-lab.html:653-670), which carves into the shared canyonHeight accumulator, bends grad for perturbAnalytic wall lighting, early-outs on uFluvialDensity≤0 (uniform declared :331, default 0.0 at :1761, driven from state.riversEnabled at :2823), and writes fluvialWet for the Stage-6 species floor-tint (:1551) — a karstCombiner would be a sibling in the same Stage-4 call block (:1504), reusing the lowGround bias, the canyonHeight/grad contract, and the uLiquidSpecies tint + seaLevel cut for collapse lakes.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/resource/a-titanic-labyrinth/
  — Cassini SAR of Titan labyrinth terrain (T-120, 47°S): an elevated plateau sliced into closed polygonal remnants by a dense maze of narrow valleys — the form is 'plateau minus slots', not mountains.
- [real] https://planetarygeomorphology.wordpress.com/2020/06/01/titans-labyrinth-terrain/
  — Planetary Geomorphology image-of-the-month on Titan labyrinths: note how dissection density (few grooves vs full maze) is the visible maturity axis, exactly the P14 spectrum.
- [real] https://www.usgs.gov/mission-areas/water-resources/science/science-topics/karst-sinkholes-and-land-subsidence
  — USGS karst/sinkhole topic page: dolines are CLOSED rimless depressions clustered on soluble ground — unlike craters they have no raised rim or ejecta, and they pull drainage inward/underground.
- [real] https://arxiv.org/pdf/1505.08109
  — Cornet et al., 'Dissolution on Titan and on Earth': the solvent-vs-lithology rate framework — why one mechanism (dissolution) gives both Earth limestone karst and Titan organic-crust labyrinths, justifying species-switched parameters.
- [real] https://geoexpro.com/crowns-of-nature-the-majestic-landscape-of-guilin/
  — Guilin tower karst (fenglin isolated towers vs fengcong linked-base clusters): end-stage maturity where only the plateau remnants survive as steep towers — a strong silhouette target for posterized rendering.
- [art] https://www.fab.com/listings/be125409-ce81-4c3b-a4ce-411516091ca6
  — 'Guilin Karst Landscape' UE asset pack: how game artists reduce tower karst to a few bold vertical masses with simple value steps — silhouettes carry the read, not surface detail.
- [art] https://www.deviantart.com/artbychien/art/Stylized-Low-Poly-Game-Environment-WIP-558651594
  — Stylized low-poly karst-like environment: flat-shaded facets and 2-3 value bands per landform still read as steep dissolution towers — evidence the form survives heavy quantization.
- [art] https://www.sciencedirect.com/science/article/abs/pii/S0097849321002132
  — 'Procedural generation of 3D karst caves with speleothems' (Computers & Graphics 2021): phenomenological dissolution modeling driven into HLSL shaders — the vocabulary bridge from karst physics to GPU implementation.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology models dissolution as rate ∝ solvent undersaturation × dissolution kinetics of the lithology (the Cornet et al. arXiv:1505.08109 framework scales Earth limestone rates to Titan organics — same equations, different constants, so one shader with species-switched parameters is physically honest). Landform-level, karst is two distinct spatial statistics: (1) doline fields = a point process of closed, rimless, inward-draining bowls, which procedurally is a cellular/Worley field — smoothstep pits centered on cellular feature points, depth scaled by maturity; (2) labyrinth = a dissected plateau, which is the NEGATIVE of ridged noise: threshold a plateau mask on height, then subtract an inverted ridged-FBM valley network so flat-topped polygonal remnants stand between through-going slots. The karst-caves paper (Computers & Graphics 2021) confirms phenomenological dissolution fields drive shader geometry well. In the vocabulary of research/RESEARCH_high-lod-planet-shaders-2026-06-05.md: this is a per-type COMBINER on the shared analytic-derivative noised() core — like the stream-power "analytic carve" (carve ∝ k·flowProxy^0.8·slope^2) but with flowProxy replaced by a dissolution proxy (cellular-distance for dolines, inverted-ridge for labyrinth), and both terms are pure relief so they fall in the "survives posterize" column. Most promising shader-side approach: a karstCombiner sibling to fluvialCombiner that unions two analytic-gradient terms — a Worley-pit doline field (rimless bowls at cellular feature points, gated to low/plateau soluble ground) and a plateau-masked inverted-ridged maze — carving both into the shared canyonHeight accumulator and bending grad the same chain-rule way (:668). A single uKarstMaturity lerps groove-depth/dissection-density from shallow grooves to full maze, and pit floors below seaLevel inherit the existing uLiquidSpecies floor-tint to become collapse lakes for free.

## 5. Isolation recipe (:9223)

Unbuilt — recipe once built. Register in planet-archetypes.js FEATURES as karst: { label: 'Karst (F21)', enableKey: 'karstEnabled', archetypes: ['tectonic-terrestrial','volatile-cold'] } so the existing solo plumbing (planet-lod-lab.html:2561-2569, setFeatureEnables) picks it up automatically. Then on the :9223 lab: (1) window._lab.setPreset('Titan (methane seas)') for the labyrinth/methane variant (the preset already carries n2 atmosphere + methane liquid species, planet-lod-lab.html:2153) or window._lab.setPreset('Rocky (Earthlike)') for limestone doline fields; (2) window._lab.solo('karst') to zero every other combiner; (3) judge at window._lab.state.distance = 3 (mid LOD ramp — field-scale pattern: doline clustering, plateau dissection) and window._lab.state.distance = 1.5 (near-LOD2 — wall lighting, pit floors, collapse-lake tint); (4) sweep the maturity knob 0→1 and the master density to 0 to confirm the regression-safe early-out leaves the Stage-A base untouched; window._lab.solo(null) / enableAllFeatures() to clear.

## 6. What to judge (UAT checklist)

- [ ] Do dolines read as discrete CLOSED rimless pits in the 6-level posterized envelope — dark bowl floors with no raised rim or ejecta apron, so they stay distinguishable from F2 craters at a glance?
- [ ] Does labyrinth terrain read as a dissected PLATEAU — flat-topped polygonal remnants at a shared upper posterize band, separated by through-going valley slots — rather than as mountains or random roughness?
- [ ] Does the maturity axis behave monotonically: shallow grooves at low maturity deepening into a connected maze at high, with dissection density rising smoothly and no popping between posterize bands?
- [ ] Do collapse lakes emerge as behavior, not paint — pit floors that drop below seaLevel pick up the liquid-species floor tint (dark hydrocarbon on Titan preset, blue-dark water on Earthlike) while dry pits stay bare rock?
- [ ] Does the carve light correctly through perturbAnalytic — shadowed wall toward the light, lit wall opposite — with each pit/slot wall surviving quantization as 2-3 clean band steps instead of dissolving into Bayer speckle?
- [ ] Does the feature stay confined to plausible ground — biased to low/soluble terrain via the lowGround-style gate, and fully absent (base untouched) on airless/no-solvent presets when the master gate is 0?
- [ ] At far distance, does the doline field fade with the LOD ramp into a coherent stippled-darkening of the region rather than sub-pixel shimmer through the dither?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
