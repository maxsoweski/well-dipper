# Feature Card — F43 Crystalline facet field
Domain: Exotic · Lab status: ⬜ · Build-seq phase: 4c

## 1. Description (WHAT)

Crystalline facet field (F-exotic-natural; speculative endmember). L1 chain: P15 "Crustal tessellation / fracture" — cooling-contraction or convective stress tiles the crust; the F43 branch is the slow-crystallization endmember where unhurried, near-equilibrium crystal growth grows facet fields across the surface. L0 drivers: D11 (surface-history — impact flux + resurfacing budget), D16 (planet/surface age — cooling time available), D12 (tidal stress), with uniform lithology as a precondition; the resulting pattern records the body's cooling/disruption history. Intensity axis (the F43 variant ramp): scattered crystals … continuous faceted field. Real-body examples: none confirmed (flagged speculative) — nearest analogs are Naica's 12 m gypsum/selenite crystals (slow crystallization at planetary-process timescales, ~500 kyr), Pluto's bladed methane-ice terrain (self-organized sharp blade fields), and 55 Cancri e (candidate crystalline-carbon "diamond planet"). WD types: crystal (headline — Appendix A lists the crystal preset as F43 + F3 glints), carbon, lava (cooled). Status: [aspirational] (speculative). Source rows: docs/FEATURES/planet-visual-features.md:156 (P15), :322 (F43), :372 (crystal preset).

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). Zero hits for F43/crystal/facet in planet-lod-lab.html and planet-archetypes.js — no combiner, no uniforms, no FEATURES entry, no GUI folder. Nearest existing machinery it should plug into: (1) the lab's voronoi3d KEYSTONE primitive (planet-lod-lab.html:486-525) — seam-free 3D cellular noise returning F1/F2 + cellId + grad, already consumed by F2 craters (:718-726), F7 edifices (:1066-1077), F8 Worley crack mask (:1122-1132); (2) most directly, the F9 chaosCombiner (planet-lod-lab.html:1160-1180), which already gives each voronoi3d cell a flat per-cell hashed height AND a per-cell constant hashed TILT so adjacent plates catch light differently — exactly the per-cell-planar-facet mechanism F43 needs, just at jigsaw-raft amplitude instead of crystal amplitude; (3) production has a vestigial cousin: Planet.js carbon crystalline glints — snoise^8 thresholded bright facets (src/objects/Planet.js:450-454, glint at :577-579) — and the exotic dispatch carries a TODO "crystal facets" (:857). Registration path: add a `facets` entry to FEATURES in planet-archetypes.js:6-23 (e.g. under a new exotic-geometric archetype) and a combiner + GUI folder in the lab's per-feature pattern.

## 3. Reference images (real + art)

- [real] https://apod.nasa.gov/apod/ap171005.html
  — Pluto's bladed terrain (NASA APOD) — a real planet-scale field of sharp, repeated crystalline-looking ridges; notice the uniform blade orientation and how the field reads as texture at distance, individual forms up close.
- [real] https://www.nasa.gov/missions/scientists-offer-sharper-insight-into-plutos-bladed-terrain/
  — NASA on bladed-terrain formation — self-organized sharp forms from a single slow process (sublimation), the behavioral template for 'slow crystallization grows facet fields'.
- [real] https://en.wikipedia.org/wiki/Cave_of_the_Crystals
  — Naica giant selenite crystals — 12 m planar-faced prisms grown over ~500 kyr; notice flat faces meeting at hard edges and the random criss-cross orientation of individual crystals (the 'scattered crystals' end of the variant axis).
- [real] https://www.jpl.nasa.gov/images/pia10615-naica-mine-chihuahua-mexico/
  — NASA JPL image page for the Naica mine — institutional photo reference for how clustered euhedral crystals catch light: each face is a near-uniform tone that flips brightness as the viewing angle changes.
- [real] https://science.nasa.gov/exoplanet-catalog/55-cancri-e/
  — 55 Cancri e (NASA exoplanet catalog) — the canonical crystalline-carbon-planet candidate; grounding for a whole-planet crystal/carbon preset rather than a local deposit.
- [art] https://nomanssky.fandom.com/wiki/Biome_-_Exotic
  — No Man's Sky exotic Shard/'Glass' worlds — stylized planet-scale crystal fields; notice how few, large, repeated geometric forms with one strong accent color read as 'crystal world' from orbit.
- [art] https://www.shadertoy.com/view/ldl3W8
  — IQ's 'Voronoi - distances' — the exact F2−F1 border-distance trick; the crisp cell-edge ridges shown here are the facet-edge crests for our combiner.
- [art] https://thebookofshaders.com/12/
  — Book of Shaders cellular-noise chapter — visual vocabulary of per-cell flat regions vs border ridges; the flat-cell + hard-edge look is what survives a 6-level posterize as clean dither bands.

## 4. Math / modeling notes (HOW, from the field)

Field modeling: real crystal habit follows the Wulff construction (equilibrium shape minimizes surface energy → flat low-index faces meeting at sharp edges); growth regime splits faceted vs dendritic by supersaturation (Naica grew 12 m monocrystals because supersaturation stayed near equilibrium for ~500 kyr), and self-organized sharp-form fields (Pluto blades, penitentes) come from a positive-feedback erosion/growth instability that aligns forms over a region. Procedurally, nobody simulates this — games (NMS shard worlds, Astroneer) fake it as instanced convex prisms; in a per-fragment shader the standard encoding is a cellular/Voronoi field with per-cell planar geometry. In the lab's vocabulary (RESEARCH_high-lod-planet-shaders-2026-06-05.md): route everything through relief + lighting, not albedo (the Bayer threshold is added to luminance — normal-driven detail survives, hue gradients get crushed); use the shared voronoi3d keystone for placement; use the IQ F2−F1 border distance for facet-edge crests; per-cell hashed values give each facet a distinct constant height + tilt (the F9 chaos-raft mechanism, already shipping); and per the Option C hybrid stance, the crystal glint is a high-exponent specular spark that bypasses (or raises levels through) the 6-level posterize — same channel the research assigns to lava emissive and ocean sun-glint, and the same idea as Planet.js's existing carbon snoise^8 glint. The variant axis (scattered crystals … continuous field) is a coverage mask: a low-freq FBM threshold gates which cells grow crystals (cf. F9's region mask), ramping to all-cells at full intensity; LOD2 adds a second, finer voronoi3d octave (sub-faceting) faded in by the lodRamp/fwidth octave-budget mechanism so it arrives pop-free. Most promising shader-side approach: a facetCombiner that reuses voronoi3d — per cell, height = hashed base + dot(pos − cellCenter, hashed tilt) (a planar facet), with an F2−F1 smoothstep ridge at borders for sharp crystal edges and the per-cell constant tilt fed straight into the relief normal (exact, like F9); on top, a per-facet high-exponent specular glint when the facet normal aligns with the half-vector, composited after the posterize via the Option C bypass channel. Scattered variant gates cells with a coverage hash exactly like the F7 edifice combiner gates volcano cells.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built. (1) Register in planet-archetypes.js FEATURES as `facets: { label: 'Crystal facets (F43)', enableKey: 'facetsEnabled', archetypes: ['exotic-geometric'] }` (new archetype; until a Crystal driver preset exists, list presets: ['Lava (hot airless)','Frozen (airless)'] — cooled-lava and cold-airless are F43's listed WD-type analogs among the lab's 6 DRIVER_PRESETS, planet-lod-lab.html:2149). (2) On the second Chrome at :9223 (chrome-devtools MCP, not Playwright), open planet-lod-lab.html, then in console: `window._lab.solo('facets')` (solo API at planet-lod-lab.html:2908; per-folder 🔆 solo button at :2563; `window._lab.enableAllFeatures()` to clear). (3) Set the Drivers preset to 'Frozen (airless)' (or 'Lava (hot airless)' for the cooled-lava variant) via the type-preset dropdown. (4) Distances via `window._lab.state.distance = 8` for the global scattered-vs-continuous read, `= 3` for the facet-field mid view, `= 1.5` to check LOD2 sub-faceting and glint behavior (range is 1.1-30, fView slider at :2106). (5) Sweep the coverage knob (scattered → continuous) and drag yaw to confirm glints sweep across facets as the view rotates.

## 6. What to judge (UAT checklist)

- [ ] Do facets read as flat planar faces meeting at sharp ridge crests in the 6-level posterized envelope — each face a near-constant dither band that steps hard at the edge, not a smooth bump?
- [ ] Do adjacent facets catch light differently (per-cell tilt → distinct lit values), so the field reads as a jumble of tilted planes rather than uniform noise, within the posterize bands?
- [ ] Do specular glints behave like crystal: sparse, crisp sparks that pop on light-aligned facets and sweep/flip across the field as yaw changes — not a static bright speckle texture?
- [ ] Does the variant axis read: discrete protruding crystal forms at low coverage (scattered) growing into a wall-to-wall tiled facet field at full coverage, with the transition driven by region masking rather than global brightness?
- [ ] Is the facet field seam-free over the whole sphere (3D-domain voronoi behavior) — no pole pinching, no UV seam line, facets the same character at poles and equator?
- [ ] At the terminator, do facet edges produce crisp light/dark breaks (relief-through-normals) instead of soft albedo gradients the posterizer crushes to mud?
- [ ] As distance closes toward LOD2, does sub-faceting fade in pop-free (octave-ramp behavior) so big facets gain smaller faces rather than the whole field rescaling?

## 6.5 Build plan (working-Claude, 2026-06-10 — Phase 4c heavy loop)

Strategy: §4's per-cell planar-facet encoding — the F9 chaos-raft
mechanism (per-cell hashed height + constant tilt, exact gradient) at
crystal amplitude, IQ F2−F1 border ridges, per-facet spec sparks on the
bypass channel. New Crystal preset as the driven carrier (the Appendix-A
crystal row is F43 + glints). Exemplars `5d6a6a8` (F42 — freshest, incl.
new-archetype pattern) / `0161a93` (F41).

1. **New preset (data)** — `'Crystal (faceted)'`: airless, T_eq ~150,
   unlocked, PRISTINE surfaceHistory (erosion 0, bombardmentIntensity
   ~0.1, resurfacingRate 0) — the slow-cooling undisturbed-lithology
   profile. Opens with `radiusEarth:` (~0.8). Cool blue-grey palette.
2. **New archetype (data)** — `'exotic-geometric'` (bodies: Pluto bladed
   terrain, 55 Cnc e; presets: the new one). Register `facets` in
   FEATURES (archetypes: ['exotic-geometric']) + featureFolders +
   `facetsEnabled` default true + GUI "Crystal facets (F43)" in
   Surface — Exotic (driven `.listen()` facetStrength display +
   facetCoverage knob; ✓ enable LAST).
3. **Driver** — crystal-class gate in applyDrivers from real fields:
   airless && erosion < 0.05 && resurfacingRate < 0.05 &&
   bombardmentIntensity < 0.2 → facetStrength 1 (walk all 16 existing
   presets: Frozen/Europa/Lava/Magma/Carbon must all FAIL on at least
   one term — verify each; only the new preset fires).
4. **facetCombiner** (relief chain, beside chaosCombiner — ADDITIVE on
   grad, above the F19 contract line per F9's slot): one voronoi3d —
   per cell: height += hashed base + dot(pos − cellCenter, hashed tilt)
   (planar facet; tilt is the per-cell CONSTANT fed exactly into grad,
   the F9 mechanism) + F2−F1 smoothstep ridge crest at borders. Coverage
   mask: low-freq fbm threshold gates which cells grow (the F7 edifice
   gating); facetCoverage knob walks scattered → continuous (make the
   FULL knob range walkable — the F42 tar lesson).
5. **Sub-faceting at LOD2** — second finer voronoi3d octave faded in by
   the existing lodRamp/octave-budget mechanism (pop-free).
6. **Glints** — per-facet spark: the facet's own tilted normal vs H,
   pow(max(dot,0), ~80), sparse (per-cell hash gate), POST-posterize
   bypass family (beside the F42 glint block; distinct vocabulary —
   F43 sparks ride facet alignment, not crest∩cell).
7. **Plumbing** — PROV_FACETS=39 + PROVINCES neutral row + provinceWeight
   row + GLSL_NAME line; frame writer sole uniform owner; reserved-word
   audit (fc is TAKEN in the shader — use 'fct' prefix).

v1 scope cuts (logged, not built): Pluto blade ORIENTATION alignment
(self-organized common axis — cells are independently tilted v1);
carbon/lava cross-listing (scattered facets on Carbon — taste fork);
accent-color crystal hue (NMS-style — relief+lighting only per the
research discipline); Wulff-construction habit shapes.

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

**Rating: 🟡 taste-call — VERIFIED_PENDING_MAX (2026-06-13)**

Built via the Phase-4c heavy loop (subagent implement → code-review → live GPU
verify on :9223). vitest `tests/planet-archetypes.test.js` 19/19; shader compiled
clean (NO black-out — the reserved-word check passed live; `fct`-prefixed identifiers,
zero collisions); console error/warn-free across the verify pass.

**§6 UAT checklist (live, Crystal preset, solo'd, :9223):**
- ✅ Flat planar faces meeting at sharp ridge crests — reads as a jumble of tilted
  planes within the posterize bands (at the tuned amp/scale; see tweak below).
  `F43-11`, `F43-06/07`.
- ✅ Adjacent facets catch light differently (per-cell constant tilt → distinct lit
  values) — confirmed by the yaw A/B (`F43-06` vs `F43-07`): facets flip lit↔dark as
  orientation changes.
- ✅ Glints sparse + crisp (not a static speckle) — a handful of bright sparks; they
  track the facet-lighting sweep on yaw. `F43-04` (cov 1) vs `F43-03` (cov 0) shows
  glints scale with coverage.
- ✅ Variant axis scattered→continuous driven by region masking — coverage knob walks
  the FULL 0→1 range with no dead zone (`F43-03` cov 0 vs `F43-04` cov 1); F42 tar
  lesson satisfied.
- ✅ Seam-free over the whole sphere (3D voronoi) — no pole pinch / UV seam at any yaw.
- ✅ Relief-through-normals (terminator-crisp mechanism) — facets are normal-driven, not
  albedo; A/B-off (`F43-09`) removes the entire facet contribution cleanly
  (`uFacetStrength→0`), no leftover artifacts, no regression.
- ◐ LOD2 sub-faceting fade — mechanism wired (second finer voronoi3d octave on the
  lodRamp budget); not isolated in a dedicated close-distance capture this pass.

**Tweaks applied (live, within the 3-cycle budget):**
- Defaults under-read at the implementer's amp 0.5 / scale 9 (facets nearly invisible —
  read as mottled noise). Live-tuned to **amp 2.0 / scale 4 / coverage 0.65**, at which
  the facet field reads clearly as crystal (`F43-10`/`F43-11` sweep → `F43-12` final
  from-preset load). Widened the amplitude GUI range 0–1.5 → 0–2.5 so the new default
  sits mid-range and stays walkable. Edits in `planet-lod-lab.html` state defaults +
  the fFacets amplitude `.add()` range; comments dated.

**Parked / taste-calls for Max's review lap:**
- **Palette:** the Crystal preset reads neutral-grey with warm-pink facet tones, NOT the
  specced "cool blue-grey." Cause is the lab's own discipline — the 6-level posterize
  adds to *luminance*, so hue gradients get crushed and the warm base bleeds through
  (`F43-08` full non-solo). Not chased, because hue barely survives the posterize by
  design. Max's call whether to push the base cooler anyway.
- **Headline coverage:** default 0.65 = "mostly-faceted" crystal world. If Max wants the
  headline read more *scattered* (discrete crystals on a plainer body), drop to ~0.3.
- **Extra knobs:** implementer added `facetScale`/`facetAmp` knobs beyond the card's
  named `facetCoverage` (real uniforms, matches the per-feature knob convention). Trim to
  minimal folder if undesired.

**Shots:** `docs/FEATURES/cards/shots/F43-01`…`F43-12` (d8/d3/d2.2 + coverage/amp sweeps +
yaw A/B + facets-off A/B + final from-preset load).

- Status: **VERIFIED_PENDING_MAX** — awaiting Max's Phase-7 review-lap UAT.
