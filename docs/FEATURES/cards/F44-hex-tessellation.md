# Feature Card — F44 Hexagonal-tessellated crust
Domain: Exotic · Lab status: 🟢 VERIFIED_PENDING_MAX (v2, on 7d105fc) · Build-seq phase: 4c

## 1. Description (WHAT)

F44 Hexagonal-tessellated crust (F-exotic-natural, EXOTIC family; flagged speculative). Derives from P15 crustal tessellation/fracture: cooling-contraction or convective stress in a uniform-lithology crust tiles it into regular polygons — contraction stress is relieved most efficiently by three fractures meeting at 120°, yielding six-sided cells; the pattern records the body's cooling/disruption history. L0 drivers: D11 surface-history, D16 planet/surface age (cooling time), D12 tidal-heating stress. Intensity axis / variants: small local polygon patches → planet-wide hex tiling. Real-body small analogs: columnar basalt (Giant's Causeway-style jointing), Pluto's Sputnik Planitia N₂-convection polygons (16-40 km cells, ~100 m domed centers, trough borders), Mars thermal-contraction crack polygons. The planet-wide tiling endmember is a speculative game-construct with no confirmed real body. WD types: hex (headline — the 'hex' EXOTIC archetype lists F44 plus an F29 Saturn-hexagon polar-vortex hook, a separate feature), rocky, ice.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). No hex/tessellation combiner, uniform, or GUI folder exists — grep of /home/ax/projects/well-dipper/world-engine-lab.html and /home/ax/projects/well-dipper/planet-archetypes.js finds no F44/hex code, and the FEATURES registry (planet-archetypes.js:6-23) has no hex key nor any 'exotic' archetype. Nearest existing machinery it should plug into: the voronoi3d keystone primitive (world-engine-lab.html:499 — seam-free 3D cellular noise returning F1/F2/cellId/grad), and specifically the F18 sublimation N₂-convection-polygon branch (world-engine-lab.html:1295-1300, uVolatileSpecies==4, uSubPolyScale) which already renders raised-cell-interior / trough-border polygon fields from smoothstep(F2−F1); the F9 chaos-raft combiner (world-engine-lab.html:1162-1177) supplies the per-cell hashed flat-height convention. F44 is essentially those two mechanisms plus a center-regularity control and its own enable/GUI plumbing.

## 3. Reference images (real + art)

- [real] https://www.nasa.gov/image-article/intricate-surface-patterns-revealed-plutos-sputnik-planum/
  — Pluto's Sputnik Planitia convection cells: 16-40 km polygons with smooth, slightly domed centers and rougher trough borders — the relief profile (raised interior, carved edge) our combiner should reproduce.
- [real] https://www.usgs.gov/observatories/hvo/news/volcano-watch-columnar-jointing-provides-clues-cooling-history-lava-flows
  — USGS HVO on columnar jointing: contraction fractures meet at ~120° triple junctions — the junction angle, not perfect hexagons, is what makes the pattern read as 'cooled crust.'
- [real] https://www.nps.gov/subjects/volcanoes/columnar-jointing.htm
  — NPS columnar-jointing gallery: real columns are 5-7-sided with irregular sizes — a believable hex crust keeps that variance rather than a perfect grid (until the exotic planet-wide endmember).
- [real] https://hirise.lpl.arizona.edu/ESP_016641_2500
  — HiRISE Mars polygonal patterned ground: thermal-contraction crack polygons read as a network of dark trough LINES on a flat plain — borders carry the signal, interiors stay quiet.
- [real] https://www.jpl.nasa.gov/images/pia10658-polygon-patterned-ground-on-mars-and-on-earth/
  — JPL side-by-side of Mars vs. Earth permafrost polygons — same border-trough morphology at different scales; supports one mechanism with a scale knob.
- [art] https://store.steampowered.com/app/1073910/Before_We_Leave/
  — Before We Leave's Goldberg-polyhedron planets: clean stylized hex-tiled globes that hide the 12 mandatory pentagons in oceans — the planet-wide-tiling art target, flat-shaded tiles with crisp borders.
- [art] https://www.shadertoy.com/view/wtdSzX
  — Minimal Hexagonal Shader/Grid (Shadertoy): the canonical compact GLSL hex-coordinate math — note how border-distance gives a single clean edge channel, ideal for routing into relief instead of color.
- [art] https://andrewhungblog.wordpress.com/2018/07/28/shader-art-tutorial-hexagonal-grids/
  — Hexagon-grid shader tutorial: staggered-lattice nearest-point construction (a zero-jitter Voronoi degenerates to hexagons) — exactly the bridge from our existing voronoi3d to regular tiling.

## 4. Math / modeling notes (HOW, from the field)

Physics: columnar jointing is modeled as thermal-contraction fracture mechanics — tensile stress in a cooling, uniform layer is relieved most efficiently by three cracks intersecting at 120°, which maximizes energy release per crack area and converges (over crack-network maturation) toward hexagonal columns; real fields are 5-7-sided. Sputnik Planitia's polygons are instead Rayleigh-Bénard convection in solid N₂ ice (McKinnon-style models): overturning cells with domed centers (~100 m) and sinking trough borders — convection planforms are naturally polygonal/hexagonal. Mars patterned ground is seasonal thermal-contraction cracking (Levy 2009 HiRISE classification). Sphere topology constraint: Euler's formula forbids tiling a sphere with hexagons alone — a Goldberg polyhedron needs exactly 12 pentagons (games like Before We Leave hide them deliberately); a planet-wide hex tiling must either accept 12 pentagon defects (good exotic flavor) or stay patch-local. Shader side, in the research doc's vocabulary: this is a Voronoi-border-distance (F2−F1) feature, the same IQ voronoilines machinery the lab's craters/chaos/sublimation already consume, with detail routed through normals (lighting-routed detail survives the 6-level Bayer posterize; albedo lines get crushed). The key insight from 2D hex-grid shader math is that a staggered lattice with zero jitter IS a hexagonal tiling — regularity is just a jitter knob. Most promising approach: extend the existing voronoi3d keystone with a uHexRegularity uniform — `center = mix(cellCenter, cellCenter + hash33(...), 1.0 - uHexRegularity)` — over a BCC-offset dual lattice (zero-jitter cubic gives squares; BCC truncated-octahedron cells slice the sphere into predominantly hexagonal cross-sections), then carve smoothstep(F2−F1) trough borders plus per-cell hashed flat/domed interiors exactly per the F18 N₂-polygon and F9 chaos-raft conventions, all expressed as height+gradient so it posterizes as relief. A later 'true planet-wide hex' rich tier swaps placement to nearest-geodesic-point on a subdivided icosahedron (Goldberg cells, equal-area on the sphere) without touching the border/relief code.

## 5. Isolation recipe (:9223)

Unbuilt — recipe for once it lands. (1) Register in /home/ax/projects/well-dipper/planet-archetypes.js FEATURES as `hexTess: { label: 'Hex crust (F44)', enableKey: 'hexTessEnabled', archetypes: ['exotic-geometric'] }` with a new 'exotic-geometric' ARCHETYPES entry (the registry inversion auto-wires the panel filter and solo button). (2) In the :9223 debug Chrome (see memory/chrome-devtools-9223-launch.md), open world-engine-lab.html via vite. (3) `window._lab.solo('hexTess')` — disables every other feature combiner. (4) Preset: until a dedicated 'Hex (exotic)' preset exists, `window._lab.setPreset('Frozen (airless)')` is the best base (cold uniform crust, no atmosphere/weather interference). (5) Distances via `window._lab.state.distance` (radii, 1.1-30; lodRamp = smoothstep(20,6,dist)): 20 for the global-tiling read (does the globe read geometric?), 8 mid-approach (borders resolving as relief), 2.5 for full-LOD2 close-up (trough cross-section + flat/domed tile interiors). (6) Verify with `window._lab.featureEnabled('hexTess')` and the __wd-style state reads, not image recognition; sweep the uHexRegularity knob 0→1 to confirm the random-Voronoi→hex continuum.

## 6. What to judge (UAT checklist)

- [ ] Do tile borders read as carved troughs / raised ridge seams (lighting-driven relief) in the 6-level posterized envelope — not as flat albedo lines that the posterizer crushes?
- [ ] Do cells read as predominantly six-sided with ~120° triple junctions at mid distance, distinct from the random Voronoi blobs of the existing crater/chaos fields?
- [ ] Do tile interiors hold a stable, quiet dither bucket (flat plateau or gently domed center) while borders consistently catch a darker band, so the network reads at a glance?
- [ ] Does the regularity continuum behave: low setting reads as natural patterned ground (Pluto/Mars analog), high setting reads as a deliberate planet-wide geometric tiling (exotic endmember), with no broken intermediate states?
- [ ] Is the pattern seam-free and pole-pinch-free while orbiting — cells stay roughly equal-sized across latitudes (3D/geodesic placement, no UV-grid stretching)?
- [ ] At distance ~20 does the planet-wide-tiling endmember read as an intentionally artificial-looking 'hex world' silhouette rather than rendering noise, and at distance ~2.5 do individual tiles read as columnar/plateau forms?
- [ ] If domed-center variant is on, does each cell's interior read as convex shading (Sputnik-style raised center) rather than per-cell flicker under the Bayer dither?

## 6.5 Build plan (HOW to build it)

Strategy: §4's prescription verbatim — extend the `voronoi3d` keystone
(world-engine-lab.html:737) with a regularity jitter knob, carve
`smoothstep(F2−F1)` trough borders into height+gradient (the F18
N₂-polygon convention, :2541-2546), and stamp per-cell hashed flat/domed
interiors (the F9 chaos-raft convention, :2353-2369). Everything routes
through relief (height + gradient), never albedo, so it survives the
6-level Bayer posterize. F44 mirrors the F43 plumbing pattern EXACTLY
(commit `12be875`) and **reuses the `exotic-geometric` archetype F43
created** — it only adds `hexTess` to it, creates no new archetype, and
adds no new preset (rely on `'Frozen (airless)'` as the §5 base).

**GLSL prefix discipline:** F43 used `fct`. F44 uses **`hx`** for ALL
locals and uniforms (avoid `fc`=gl_FragCoord, `hex` is fine but `hx` is
shorter/collision-safe). A reserved-word/identifier collision blacks out
the whole lab with no static check — keep every F44 local under the `hx`
prefix.

**EDIT ONLY** `world-engine-lab.html`, `planet-archetypes.js`,
`docs/FEATURES/**`. NEVER touch `src/`, `docs/NOW.md`. Stage explicit
paths only — never `git add -A` (a parallel warp session shares the tree).

### 1. Uniforms (add in the F42/F43 uniform block, after :582)
GLSL declarations (mirror the F43 `uFacet*` block at :578-582):
- `uniform float uHexStrength;`   — master gate 0..1 (driven: 1 when `hexTessEnabled`, else 0; the writer is sole owner). Default `{ value: 0.0 }`.
- `uniform float uHexRegularity;` — 0..1 jitter knob: 0 = random Voronoi blobs, 1 = zero-jitter regular hex lattice. Default `{ value: 0.85 }` (reads as deliberate hex while keeping believable variance).
- `uniform float uHexScale;`      — hex cell density (voronoi3d frequency). Default `{ value: 4.0 }` (F43 lesson: 9 too fine to read; big clear cells).
- `uniform float uHexBorderDepth;`— trough carve depth (−) / ridge raise (+). Default `{ value: 0.5 }`.
- `uniform float uHexBorderWidth;`— smoothstep width of the F2−F1 border band. Default `{ value: 0.08 }`.
- `uniform float uHexDome;`       — per-cell domed-center amount (Sputnik convex shading) 0=flat plateau, 1=fully domed. Default `{ value: 0.4 }`.

Three.js `uniforms` object (after the `uFacetAmp` line ~:3649) — same six, same defaults.
State block (after `facetAmp` ~:4234): `hexTessEnabled: true`, `hexRegularity: 0.85`, `hexScale: 4.0`, `hexBorderDepth: 0.5`, `hexBorderWidth: 0.08`, `hexDome: 0.4`.

### 2. The combiner GLSL — `void hexCrust(vec3 pos, inout float h, inout vec3 grad)`
Place it in the relief-combiner region immediately AFTER `facetCombiner`
(ends :2431), so it sits above the F19 mass-wasting line, ADDITIVE on
grad (the F9 contract).

Structure (mirror chaosCombiner :2353 + the F18 N₂ branch :2541):
```
void hexCrust(vec3 pos, inout float h, inout vec3 grad){
  if (uHexStrength <= 0.0) return;
  float amp = uHexStrength * provinceWeight(PROV_HEXTESS);
  if (amp <= 0.0) return;
  // regularity = jitter knob. voronoi3d jitters cell centers by hash33 internally;
  // to make it walkable we pre-warp pos by a regularity-scaled offset toward the
  // BCC-offset lattice. Cheapest faithful route per §4: sample voronoi3d, then blend
  // the returned cell field toward a zero-jitter staggered read.
  vec3 hxId, hxGrad;
  vec3 q = pos * uHexScale + uMacroOffset + vec3(19.4, -8.7, 33.1);
  // BCC offset: sample a second lattice shifted by (0.5,0.5,0.5) and mix by regularity
  // so high uHexRegularity collapses jitter toward the regular truncated-octahedron
  // dual (predominantly hex cross-sections); low regularity keeps full Voronoi jitter.
  vec2 hxFF = voronoi3d(mix(q + hash33(floor(q))*0.0, q, 1.0), uVoroCells, hxId, hxGrad);
  // (Implementer: the regularity mix is on the JITTER inside a local voronoi variant —
  //  see §4 `center = mix(cellCenter, cellCenter + hash33(...), 1.0 - uHexRegularity)`.
  //  Simplest correct impl: add a `regularity` param to a hexCrust-local copy of
  //  voronoi3d, OR pre-snap pos. Pick whichever compiles clean; verify the 0→1 sweep
  //  actually walks random→hex before tuning anything else.)
  // ── borders: F2−F1 trough/ridge carved into height+gradient (F18 convention) ──
  float hxEdge = 1.0 - smoothstep(0.0, uHexBorderWidth, hxFF.y - hxFF.x);  // 1 at seam
  h    += amp * uHexBorderDepth * (-hxEdge);          // carve trough (negative)
  grad += amp * uHexBorderWidth * 0.9 * hxEdge * hxGrad;  // ride ∂F1/∂p at the seam
  // ── per-cell hashed flat/domed interior (F9 chaos-raft + Sputnik dome) ──
  vec3  hxRh   = hash33(hxId);
  float interior = smoothstep(0.0, uHexBorderWidth*1.5, hxFF.y - hxFF.x);  // 1 inside
  float hxFlat = (hxRh.x - 0.5) * 0.4;                // per-cell flat plateau height
  float dome   = uHexDome * (1.0 - hxFF.x) * (1.0 - hxFF.x);  // convex toward cell center (F1→0 at center)
  h    += amp * interior * (hxFlat + dome);
  grad += amp * interior * (-uHexDome * 2.0 * (1.0 - hxFF.x) * hxGrad);  // dome's analytic grad
}
```
Note: `voronoi3d` returns `grad = normalize(pos − center)` (the ∂F1/∂p
relief term, :756) — that's exactly what the dome/border gradients ride.
The dome uses F1 (distance-to-center) so the center bulges and falls off
to the seam — analytic gradient, no per-cell flicker (UAT item 7). Pick
the regularity-mix implementation that COMPILES CLEAN first; if a
local voronoi variant is needed, name it `voronoi3dReg` and keep it `hx`-adjacent.

### 3. Call site (height/normal accumulation chain)
Add ONE line in the analytic-relief branch, immediately after the
`facetCombiner(vPos, h, grad, fctMask);` call at **:2835**:
```
hexCrust(vPos, h, grad);   // F44 — hex-tessellated crust (voronoi3d + regularity knob; trough borders + domed interiors; ADDITIVE on grad, F19 contract; gated by uHexStrength × provinceWeight(PROV_HEXTESS))
```
Gating is internal to the combiner (`uHexStrength<=0` early-out +
`provinceWeight(PROV_HEXTESS)`), matching every other combiner.

### 4. Registration trio + test line (ALL FOUR required by the test)
- **FEATURES** (planet-archetypes.js, after the `facets:` line ~:111):
  `hexTess: { label: 'Hex crust (F44)', enableKey: 'hexTessEnabled', archetypes: ['exotic-geometric'] },`
- **featureFolders** map (world-engine-lab.html ~:6018, after `carbon: fCarbon, facets: fFacets,`):
  add `hexTess: fHex,`
- **GUI binding** (the `.add(state,'hexTessEnabled')` controller — see §6 below).
- **GLSL_NAME test line** (tests/planet-archetypes.test.js ~:107, after `carbon: 'PROV_CARBON', facets: 'PROV_FACETS',`):
  add `hexTess: 'PROV_HEXTESS',`

Confirm `exotic-geometric` archetype ALREADY EXISTS (planet-archetypes.js
:125, added by F43) — REUSE it, do NOT recreate. No `ARCHETYPES` edit needed.

### 5. Provinces — PROV_HEXTESS = 40 (next after PROV_FACETS=39)
- GLSL define (world-engine-lab.html, after PROV_FACETS at :854):
  `const int PROV_HEXTESS = 40;  // F44 — neutral (crustal tessellation, not geology): the hex field tiles the WHOLE uniform-lithology crust (surface-history/cooling-driven, planet-global), never gated by rock provinces (FROST-row pattern, like facets F43)`
- `provinceWeight` switch arm (after the `PROV_FACETS` arm at :911):
  `else if (fid == PROV_HEXTESS)   { f = gProvince.z; fl = 1.00; }`
- PROVINCES row (planet-archetypes.js, after the `facets:` row ~:182):
  `hexTess:    { field: 2, polarity: +1, floor: 1.00 },  // neutral — crustal tessellation, not geology: the hex tiling covers the whole uniform crust (cooling/surface-history-driven, planet-global), never gated by rock provinces (FROST-row pattern, like facets F43)`

### 6. GUI folder (mirror fFacets at :5943-5947)
In `fExoticGroup`, after the Crystal facets folder block (~:5947):
```
const fHex = fExoticGroup.addFolder('Hex crust (F44)'); fHex.close();
fHex.add(state, 'hexRegularity', 0, 1, 0.01).name('regularity (voronoi→hex)');
fHex.add(state, 'hexScale', 3, 24, 0.5).name('cell density');
fHex.add(state, 'hexBorderDepth', 0, 1.5, 0.01).name('border depth');
fHex.add(state, 'hexBorderWidth', 0.02, 0.2, 0.005).name('border width');
fHex.add(state, 'hexDome', 0, 1, 0.01).name('dome amount');
fHex.add(state, 'hexTessEnabled').name('✓ enabled');
```
NO 🎲 (the hex domain is seeded off `uMacroOffset` — the world's own
identity; the Seeds folder rerolls it). The `✓ enabled` controller is
moved into the folder header by the existing controller-relocation pass
(same as all other features).

### 7. Frame writer (sole uniform owner — mirror the F43 block at :6402-6411)
In `frame()`, after the F43 `uFacetAmp` write (~:6411):
```
// F44 hex crust — hexTessEnabled gates the master strength→0 (border relief, domed
// interiors ALL key on uHexStrength > 0, so ONE gate kills the family: byte-identical
// pre-F44 output). regularity/scale/border/dome pass through (inert behind strength 0).
uniforms.uHexStrength.value     = state.hexTessEnabled ? 1.0 : 0.0;   // ✓ enable gate
uniforms.uHexRegularity.value   = state.hexRegularity;
uniforms.uHexScale.value        = state.hexScale;
uniforms.uHexBorderDepth.value  = state.hexBorderDepth;
uniforms.uHexBorderWidth.value  = state.hexBorderWidth;
uniforms.uHexDome.value         = state.hexDome;
```
NO driver-derivation needed (unlike F43): F44 has no preset, so
`uHexStrength` is purely the enable gate. It rides whatever preset is
loaded (`'Frozen (airless)'` is the §5 test base).

### 8. Preset decision — NO dedicated preset
Per §5, rely on `'Frozen (airless)'` as the base (cold uniform crust, no
atmosphere/weather interference). Rationale: F44 is a crust-geometry
overlay with no new driver physics (regularity is a pure lab knob, not
data-derived), so a preset would only duplicate Frozen with the hex knob
on — no carrier-gate logic to validate (unlike F43's crystal-class gate).
If Max wants a one-click 'Hex (exotic)' showcase later, it's a trivial
copy of `'Frozen (airless)'` — log as a v1 scope cut.

### 9. Verify hooks (map to §6 UAT checklist)
Live on :9223 (chrome-devtools, GPU — NOT Playwright; see
memory/well-dipper-testing-reference.md):
- `window._lab.setPreset('Frozen (airless)')` then `window._lab.solo('hexTess')` — isolate the combiner.
- `window._lab.featureEnabled('hexTess')` → true.
- **Distance sweep** via `window._lab.state.distance`: 20 (global hex silhouette read → UAT items 4,6), 8 (borders resolving as relief → items 1,2), 2.5 (trough cross-section + flat/domed interiors → items 1,3,7).
- **Regularity 0→1 sweep** (`state.hexRegularity` 0, 0.5, 1.0): random Voronoi blobs → hex lattice (UAT items 2,4). Confirm NO broken intermediate (black-out / NaN).
- **Walkability tune (do this BEFORE setting defaults — F43 lesson):** live-walk regularity, hexScale, hexBorderDepth, hexDome to values where the feature READS; then bake the mid-range as the default. Expect tuning like F43's (scale 9→4); the §1 defaults are starting guesses.
- **Orbit check** (yaw the camera): cells stay equal-sized across latitudes, seam-free, no pole pinch (UAT item 5 — 3D voronoi3d gives this for free).
- **A/B**: toggle `hexTessEnabled` off → byte-identical pre-F44 render (the regression contract).
- `npm run` vitest → registration trio test green (FEATURES + featureFolders + GLSL_NAME).

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

### v2 RE-VERIFY (2026-06-13, after the two-bug GLSL fix round) — supersedes v1 below

- **Rating: 🟢 (reads; ships pending Max taste-call).** Both v1 bugs are fixed
  in source and confirmed live on :9223 GPU. The feature now produces strong,
  legible cellular relief and the regularity knob walks a clean
  random-Voronoi → regular-polygon continuum.

- **Blackout: no.** Lab loads clean after the GLSL edits + the v2 default/range
  retune; `list_console_messages` (error filter) empty across two fresh
  navigations. `uHexStrength`, `uHexScale`, `uHexRegularity` etc. all confirmed
  reaching the shader.

- **CRITICAL METHOD CORRECTION (why v1 read FALSE-NEGATIVE):** v1's "decisive"
  isolated A/B dropped base `perturb` to 0.05/0.0 to isolate hexCrust. That was
  the **wrong isolation** — line 3006-7 computes `reliefAmp = uPerturb * mix(0.7,1.0,uLodRamp)`
  and passes it to `perturbAnalytic(N, grad, reliefAmp)`, so `uPerturb` is the
  global gain on the ENTIRE accumulated `grad` (hexCrust included). At perturb≈0,
  NO grad-driven relief lights — not hexCrust, not even facetCombiner. So v1's
  "pixel-identical at perturb 0.05" proved nothing about hexCrust; it proved the
  relief consumer was switched off. The correct isolation is **`perturb` at its
  normal ~0.55 gain + `solo('hexTess')`** (base FBM identical ON vs OFF, so the
  ON−OFF delta = pure hexCrust). To judge cell SHAPE without base-FBM roughness,
  set **`octAuto=false, octaves=1`** (flat low-freq base) while KEEPING perturb
  0.55. (Note the state field is `octAuto`, not `octavesAuto`.)

- **Decisive A/B (correct method):** solo hexTess, `perturb 0.55`, distance 8,
  toggle `hexTessEnabled` ON vs OFF. They **clearly differ** — ON = a crisp dense
  field of raised cell-interiors with carved borders; OFF = soft smooth base-FBM
  mottling. Bug #1 is genuinely fixed: hexCrust contributes real analytic-normal
  relief. (`F44v2-p055-d8-on.png` / `F44v2-p055-d8-off.png`; same delta at the
  default-perturb shots `F44v2-on-d8.png` / `F44v2-off-d8.png`.)

- **Feedback (per §6 checklist), judged from :9223 GPU screenshots:**
  1. **Borders as carved troughs/raised seams — PASS.** With base FBM flattened
     (octaves=1, perturb 0.55) the F2−F1 troughs read as dark carved seams
     between raised cells; borders catch light via the depth-scaled grad term
     (`F44v2-shape-reg1.png`). At full-octave defaults they read as a textured
     polygonal network (`F44v2-defaults-d8.png`).
  2. **Six-sided cells / ~120° junctions at reg=1 — PASS (headline).** reg=1
     gives a tightly-packed polygonal tiling, predominantly 5-7-sided with clear
     triple junctions (Voronoi-of-BCC → mostly hexagonal cross-sections with the
     physically-correct pentagon/heptagon admixture the card §3 calls for — not
     a rigid textbook hex grid, by design). Bug #2 substantially fixed: the
     two-sublattice BCC scan now yields a denser, more regular lattice at reg=1.
  3. **Quiet interiors / darker border band — PASS.** Cell interiors hold a
     stable raised/domed bucket; borders consistently catch the darker band.
  4. **Regularity continuum — PASS.** reg 0 → 0.5 → 1.0 walks irregular
     stretched Voronoi (natural patterned ground) → even compact cells →
     regular tight polygons (deliberate tiling). No broken intermediate, no
     NaN/blackout (`F44v2-shape-reg0/05/1.png`).
  5. **Seam-free / pole-pinch — PASS.** Pole-on view (pitch 1.4) shows cells
     staying roughly equal-sized across all latitudes incl. the pole — no
     pinch, no seam, no UV stretch (3D voronoi3dReg gives this for free)
     (`F44v2-pole.png`).
  6. **Distance reads (20 / 8 / 2.5) — PASS.** d20: coherent geometric textured
     disc (not noise); d8: cellular relief network; d2.5: large columnar/plateau
     cells (`F44v2-d20.png`, `F44v2-d8-walk.png`, `F44v2-tune-d2.5.png`).
  7. **Domed-center convex shading — PASS.** dome=1.0 (base FBM flat) gives each
     cell a smooth convex light gradient toward its center, falling to the dark
     borders — NO per-cell flicker; the dome's analytic grad is clean
     (`F44v2-dome.png`).

- **Tweaks applied (defaults RE-TUNED + one GUI range widened):**
  - `hexScale 4.0 → 1.6` — the BCC two-sublattice scan ~doubled point density,
    so the old 4.0 packs cells too fine to read at close LOD; 1.6 gives big
    clear columnar cells that survive full-octave base FBM at d2.5–d8.
  - `hexBorderDepth 0.5 → 1.1` — deeper carve so borders shade under the now-
    correct depth-scaled grad term.
  - `hexBorderWidth 0.08 → 0.10` — slightly wider band reads cleaner mid-distance.
  - `hexDome 0.4 → 0.55` — convex centers read without flicker.
  - `hexRegularity` left at 0.85 (walked; deliberate-hex with believable variance).
  - **GUI `cell density` slider range `3–24 → 1–12` (step 0.5→0.1)** — the
    walked default 1.6 sat below the old min of 3; new range keeps it mid-low
    and walkable. Only `world-engine-lab.html` edited (state defaults + this slider).

- **Re-verify note:** new defaults reloaded via `?fresh=1`, confirmed clean
  (no console error) and reading at d8 (`F44v2-defaults-d8.png`). uniforms
  confirm `uHexScale=1.6`, `uHexStrength=1`.

- **Shots (in `docs/FEATURES/cards/shots/`, gitignored):**
  - `F44v2-on-d8.png` / `F44v2-off-d8.png` — A/B at default perturb, d8 (differ)
  - `F44v2-p055-d8-on.png` / `F44v2-p055-d8-off.png` — A/B solo perturb 0.55 (the proof)
  - `F44v2-shape-reg0.png` / `F44v2-shape-reg05.png` / `F44v2-shape-reg1.png` — continuum, base FBM flat
  - `F44v2-dome.png` — convex dome shading, no flicker
  - `F44v2-pole.png` — pole-on, no pinch/seam
  - `F44v2-d20.png` / `F44v2-d8-walk.png` / `F44v2-tune-d2.5.png` — distance reads
  - `F44v2-defaults-d8.png` — shipped defaults, d8

- **Status: VERIFIED_PENDING_MAX (pending sha)** — built on `7d105fc`. Reads on
  all seven checklist items; remaining call is Max's taste judgement on whether
  the 5-7-sided-with-variance look (vs a crisper textbook-hex endmember) is the
  desired exotic flavor. NOT blocked.

────────── v1 verdict (2026-06, FALSE-NEGATIVE — superseded; kept for trail) ──────────

- **Rating: 🔴 (broken — needs a fresh implementer round, NOT a Max taste-call)**

- **Blackout: no.** Lab loads clean, planet renders, zero GLSL compile errors in
  console (`list_console_messages` empty). All six `state.hex*` fields present;
  uniforms (`uHexStrength=1`, `uHexRegularity`, `uHexScale`, etc.) confirmed
  reaching the shader via `_lab.uniforms`. The plumbing is wired correctly — the
  feature simply produces no visible relief.

- **Feedback (per §6 checklist), all judged from :9223 GPU screenshots:**
  1. **Borders as carved troughs/raised seams — FAIL.** No border relief is
     visible at any setting. The wavy dark lines seen in early non-isolated
     shots were the BASE terrain perturbation (`perturb 0.55`), not hexCrust.
  2. **Six-sided cells / ~120° junctions at reg=1 — FAIL (headline).** Swept
     `hexRegularity` 0 → 1.0 at `hexScale` 3, 4, and 12, distance 4 and 8.
     reg=1 looks essentially identical to reg=0 — irregular blobby streaks, no
     hex lattice, no triple junctions. The regularity knob does not walk
     random→hex.
  3. **Quiet interiors / darker border band — FAIL.** No coherent cell
     network at any zoom.
  4. **Regularity continuum — FAIL.** No usable intermediate states because
     neither endmember reads.
  5. **Seam-free / pole-pinch — n/a (untestable: nothing to seam).** voronoi3d
     base is 3D so this would likely be free once relief exists.
  6. **Distance reads (20 hex-world / 2.5 columnar) — FAIL.** Surface reads as
     a plain dithered sphere at every distance.
  7. **Domed-center convex shading — FAIL.** `hexDome` 0→1 produced no
     per-cell doming.

  **v2 NOTE:** every "FAIL" above is now believed to be the perturb=0 isolation
  error (see v2 CRITICAL METHOD CORRECTION) compounded by bug #1's weak grad.
  With both fixed and the correct isolation, all seven read.

- **DECISIVE isolated A/B (the v1 "proof" — now known FLAWED):** dropped base
  `perturb` to 0.05, toggled `hexTessEnabled` ON vs OFF, pixel-identical. The
  flaw: perturb≈0 zeroes `reliefAmp`, the global gain on the grad the analytic
  normal reads — so NOTHING lights, hexCrust or otherwise. Not a hexCrust proof.

- **Root cause (for the implementer — two compounding bugs) — BOTH NOW FIXED:**
  1. **Relief routes through `grad` but is scaled into oblivion.** Border grad
     was `* uHexBorderWidth * 0.9` (≤0.18×). **Fixed:** now `* uHexBorderDepth *
     0.9` (:2527) — carve depth drives the slope (matches facetCombiner's 0.9).
  2. **`voronoi3dReg` BCC stagger is degenerate.** Per-cell parity translation
     collided sublattices. **Fixed:** now a true two-sublattice scan — corner
     node ∪ body-center node (`+0.5`) competing in F1/F2 (:2472-2493) — so reg=1
     is a real BCC point set with hexagonal cross-sections.

- **Tweaks applied: NONE** (v1). Superseded by the v2 retune above.
