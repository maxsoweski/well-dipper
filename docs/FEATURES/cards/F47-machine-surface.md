# Feature Card — F47 Machine / structured surface
Domain: Overlay · Lab status: ⬜(lab) · Build-seq phase: 4c

## 1. Description (WHAT)

Machine / structured surface — an artificial, engineered crust overlay (F-overlay group, domain: Overlay). Physical chain: L0 drivers D15 (→tech) + D16, with D7 (nightside lights) feeding the sibling F48, drive L1c process P28 "Technospheric development": a civilization builds out over civilizational time, replacing/coating natural terrain with engineered structures, running to planet-saturation (ecumenopolis, F49). F47 is the mid-band of that track: variants run from scattered structures up to a fully machined crust (circuit grid). No geomorphic formation exists — per the Appendix-A overlay design note, the representation is base-type + overlay layer compositing over a natural base planet (machine over a rocky base) whose own L0→L1→L2 chain still runs beneath, so base relief/weather show through where the overlay doesn't cover. Real-body examples: none — Dyson-tier hypothetical; nearest nascent analogs are Earth's engineered surface signatures (urban street grids and agricultural grids visible from orbit). WD type: machine (EXOTIC family). Inventory status: `[current]` (circuit grid) — referring to the legacy production shader, not the lab.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) in world-engine-lab.html — `machine` has no entry in the FEATURES registry (planet-archetypes.js:6-22) and no combiner in the lab shader. The slot it must fill already exists: the Stage-7 EXOTIC overlay placeholder (world-engine-lab.html:1554-1556, "base-type + overlay-layer composite; consumes the FULL natural-base lit color + landMask; renders LAST among surface terms, before the envelope split; maturity→0 must reveal the bare stage-6 base"). Nearest existing machinery: the ★ emissive bypass channel (world-engine-lab.html:1572-1581, the Option-C posterize(surface)+emissive split whose stated owners include city lights F48/49 and bioluminescence F46) is where glowing circuit traces belong, exactly like the F8 `lavaCrackEmissive` survivor. A legacy production implementation exists outside the lab: src/objects/Planet.js — planetType==15 pattern at :750-765 (3D `fract()` rectilinear grid-line SDF + intersection accent + per-cell hash for lit/dark cells), albedo at :825-831 (dark metallic base → accent on grid lines + bright tier), dark-side emissive grid glow at :903-917; palettes in src/generation/PlanetGenerator.js:260-266 (dark metal + amber/green/orange/cyan glow). Note the production grid is a 3D lattice intersected with the sphere (curved slice lines, no surface-aligned blocks) — the lab rebuild should not copy it verbatim.

## 3. Reference images (real + art)

- [real] https://earthobservatory.nasa.gov/features/CitiesAtNight/page1.php
  — ISS night photography of cities — rectilinear street grids read as crisp engineered lines against dark land, the nascent real analog of a machined surface.
- [real] https://science.nasa.gov/earth/earth-observatory/agricultural-patterns-6605/
  — Agricultural grids and circles from orbit — humanity's actual 'structured surface' texture: large coherent geometric tiles replacing natural terrain patchwise, not uniformly.
- [real] https://science.nasa.gov/earth/earth-observatory/windy-city-of-lights-153622/
  — Chicago's strict street grid at night — note the scale hierarchy: bright arterial lines, dimmer infill cells, irregular old districts vs compass-aligned new ones.
- [real] https://earthsky.org/space/kic-8462852-tabbys-star-no-alien-megastructure/
  — Tabby's Star / Dyson-swarm hypothesis — the scientific framing behind the 'Dyson-tier hypothetical' end of the variant range (it was dust, but the concept is the F47 ceiling).
- [art] https://www.denofgeek.com/movies/greebles-how-tiny-details-make-a-huge-star-wars-universe/
  — ILM greeble/kitbash principle (Death Star): mix smooth plates with dense detail regions — uniform fine texture kills the sense of scale; contrast sells hugeness.
- [art] https://www.deviantart.com/artofanrach/art/Machine-World-727558690
  — Machine-world concept art — fully industrialized surface with regions specialized by function: zonal variation, not one repeated tile.
- [art] https://steamcommunity.com/sharedfiles/filedetails/?id=1144654097
  — Stellaris 'Real Machine Worlds' planet textures — game-art treatment of machined crusts at globe distance: dark metal base, emissive trace networks, panel seams.

## 4. Math / modeling notes (HOW, from the field)

There is no geomorphology here — the field models artificial surfaces with pattern synthesis, not process equations. The standard toolkit: (1) rectilinear grid SDFs — `fract()`-based line distance, exactly what the production planetType==15 path does, but done as surface-aligned 2D grids via triplanar projection (blend weights `pow(abs(N), 4..8)`, per the research doc's triplanar row) or cube-face UVs, so panels lie ON the sphere instead of being a 3D lattice sliced by it; (2) hierarchical subdivision / greebling — recursive quad-splitting with per-cell hash (the kitbash principle formalized): 2-3 nested grid scales (district / block / trace) where a hash decides whether a cell subdivides, stays a smooth plate, or hosts dense detail — this gives the mixed smooth-vs-greebled contrast that sells scale; (3) Voronoi with Chebyshev/Manhattan metric for plate tessellation — the existing voronoi3d keystone (F2 craters' placement engine) reused with a different distance metric yields rectangular-ish panel plates, and IQ's border-distance pass (F2−F1, already in the research table) gives panel seams; (4) Truchet/circuit-tile patterns for trace routing inside lit cells. Composition follows the Stage-7 contract: a low-frequency FBM coverage mask thresholded by a technogenic-maturity driver (D15/D16 → a derived uniform like uTechMaturity, the same gate pattern as uCryoActivity for F9/F10) decides where machine plates replace the natural base — scattered structures at low maturity, full circuit grid at 1.0, bare Stage-6 base at 0. Posterization strategy per the research doc's spine ("route detail through normals/specular, not color"): panel-edge bevels go through the normal channel (grid border distance → perturbation, a height-terracing relative that survives the envelope), the dark-metal albedo stays nearly flat, and the glowing traces + per-cell-hash lit windows ride the ★ emissive bypass channel like F8's lava cracks so they stay crisp over the 6-level quantize and read on the night side. Most promising shader-side approach: a triplanar 2-scale rectilinear grid SDF (district + block) with per-cell hash subdivision and Chebyshev-Voronoi plate variety, composited over the full natural-base lit color through a maturity-driven FBM coverage mask in the Stage-7 slot; bevel relief through the normal, trace/window glow through the emissive bypass. One combiner, three reused keystones (triplanar weights, voronoi3d, fbmd mask), no new pipeline stages.

## 5. Isolation recipe (:9223)

Unbuilt — recipe for once it lands. Register it as `machine: { label: 'Machine surface (F47)', enableKey: 'machineEnabled', archetypes: ['technogenic'] }` in planet-archetypes.js FEATURES (new archetype, since none of the five existing natural archetypes fit an overlay), wired through the existing solo plumbing (setFeatureEnables, world-engine-lab.html:2540-2543 / window._lab.solo at :2908). Then on the :9223 Chrome (chrome-devtools MCP, not Playwright): load the lab, run `window._lab.setPreset('Rocky (Earthlike)')` (the Appendix-A base for the machine overlay — the overlay-correctness test needs a visible natural base), set the maturity driver to full (whatever GUI knob derives uTechMaturity; until driver wiring exists, the lab folder's strength slider), then `window._lab.solo('machine')`. Distances (planet radii, clamp 1.1-30 per :2615): `window._lab.state.distance = 8` for the globe read (coverage-patch shapes + grid curvature over the limb), `= 3` for district structure, `= 1.5` for panel/trace detail near the LOD2 hysteresis. Sanity checks: solo off + maturity 0 must show the bare Rocky base (Stage-7 contract); rotate to the terminator to verify trace glow persists into the night side.

## 6. What to judge (UAT checklist)

- [ ] Does the surface read as engineered — straight seams, right angles, repeated rectilinear cells — against the organic FBM base, even after the 6-level posterize + Bayer dither chews the albedo?
- [ ] Does it read as an overlay ON a natural world: base relief/coast showing through between coverage patches at mid maturity, and the bare Stage-6 base returning cleanly at maturity 0?
- [ ] Do the coverage patches read as deliberate build-out (coherent blobs with hard engineered edges, scattered → saturated as maturity rises), not as random noise speckle?
- [ ] Is there a scale hierarchy — district / block / trace — so new finer grids resolve as the camera closes, implying hugeness rather than a single tiled texture (greeble principle: smooth plates contrasted with dense regions)?
- [ ] Do panel seams and bevels read through LIGHTING (edges catching the sun, dither texture from normal perturbation) rather than through albedo gradients the quantizer crushes?
- [ ] Do the glowing circuit traces and lit cells read as crisp un-banded emissive on the night side (bypass channel), the way F8 lava cracks do, while the dark-metal plates stay inside the posterized envelope?
- [ ] Do grid lines stay stable and continuous over the limb and poles as the sphere rotates — no polar pinching, no 3D-lattice slice artifacts, no shimmer at the envelope's pixel scale?

## 6.5 Build plan

> All line numbers below verified against the LIVE files on 2026-06-13 (world-engine-lab.html = 7018 lines; the card's §2/§5 numbers are stale by ~1800 lines — ignore them). Freshest exemplar = F46 bioMats (`git show 1afe4ec`, complete emissive-overlay registration trio); relief-channel exemplar = F45 shatter (`shatterCombiner`, the `grad`-feed pattern).

### Strategy (dual-channel, one combiner + one composite)
A maturity-gated **technogenic crust overlay** composited in the Stage-7 EXOTIC slot over the full natural base. A low-freq FBM **coverage mask** (`uMachCoverage` lowers a threshold → scattered structures grow into a planet-spanning circuit grid; coverage 0 ⇒ bare Stage-6 base) drives two channels:
- **Normal channel (bevel):** a `machineRelief(vPos, h, grad)` combiner inserted in the analytic relief stage (beside `shatterCombiner`) adds panel-edge bevel slope onto `grad` — the existing `perturbAnalytic` (world-engine-lab.html:3091) lights the seams so edges catch the sun. Dark-metal plate albedo is a near-flat tint mixed into the posterized `surface` at the Stage-7 slot under the coverage mask (so the quantizer never sees an albedo gradient to crush, and maturity→0 reveals the bare base).
- **Emissive channel (glow):** glowing circuit traces + per-cell-hash lit windows added AFTER the quantizer on the ★ emissive-bypass channel (the same `gl_FragColor` add site as F46's `bioC` / F8 lava cracks), so they stay crisp on the night side.

Shader toolkit (all reused keystones, NO new pipeline stage): `voronoi3d` (world-engine-lab.html:781, the F2 engine — Chebyshev metric via swapping `length(r)` for `max(abs(r.x),max(abs(r.y),abs(r.z)))` gives rectilinear panel plates; F2−F1 border-distance = seams), `fbmd`/`noised` (:823/:732, coverage + greeble hash), and an **inline triplanar grid SDF** (no triplanar helper exists yet — write one: blend three surface-aligned 2D `fract()` grids by `pow(abs(N),6.0)` weights, NOT the production 3D-lattice-sliced-by-sphere approach).

### GLSL prefix discipline (reserved-word landmine — cost a fix cycle on F46)
All F47 GLSL locals/uniforms use the **`mach` / `uMach`** prefix. F46 blacked the whole lab by naming a local `patch` (a GLSL ES 3.00 reserved word — see the precedent comment at world-engine-lab.html:3357 `dustPatch` and :3538). The implementer MUST avoid every reserved word: `patch, sample, filter, input, output, active, common, partition, resource, superp`, all `mat*`/`vec*`/`sampler*`/`image*` type names, `buffer`, `shared`, `coherent`, `volatile`, `restrict`, `readonly`, `writeonly`. Proposed identifiers — all checked clean against that list: `machCov`, `machGrid`, `machDistrict`, `machBlock`, `machEdge`, `machCellHash`, `machBevel`, `machTrace`, `machWindow`, `machPlateId`, `machTriW`, `machC`. (Note: do NOT name anything `machPatch` — `patch` is reserved even as a substring? No — only the bare token is reserved, but avoid it anyway for grep-safety; use `machPlate`/`machCell`.)

### PROV decision — `PROV_MACHINE = 43`, NEUTRAL row
Highest PROV id in use is now 42 (`PROV_BIOMATS`, F46, world-engine-lab.html:901). Use **`const int PROV_MACHINE = 43;`**. **Neutral** (`f = gProvince.z; fl = 1.00`), like the aurora/bio/exotic-overlay precedents (F37/F42–F46): a civilization builds OVER terrain regardless of the rock-province fields — an engineered crust is coverage-/maturity-driven and planet-global, never gated by tectonic/volcanic/ancient geology. Required because `tests/planet-archetypes.test.js:124` asserts `Object.keys(PROVINCES).sort() === Object.keys(FEATURES).sort()` AND :144 requires a matching GLSL `provinceWeight` if-arm per non-ejecta key (the F46 near-miss). Mirror F46's two rows exactly (planet-archetypes.js PROVINCES + the GLSL if-chain).

### Archetype decision — new `technogenic`, registers in TWO files, ONE test gotcha
`machine: { label: 'Machine surface (F47)', enableKey: 'machineEnabled', archetypes: ['technogenic'] }` in FEATURES (planet-archetypes.js, after the `bioMats` line at :127). Add a new ARCHETYPES entry (after :142):
```js
'technogenic': { label: 'Technogenic / machine', bodies: ['Trantor (fictional)','Coruscant (fictional)','Dyson-swarm hypothetical'], presets: ['Rocky (Earthlike)'] },
```
**Test gotcha (the key risk):** `tests/planet-archetypes.test.js:50` asserts *every* `ARCHETYPES[a].presets` entry is a real DRIVER_PRESETS key, and :57 asserts every archetype has ≥1 feature. So `technogenic.presets` MUST be a non-empty list of REAL preset keys — `['Rocky (Earthlike)']` is verified present (world-engine-lab.html:4791) and is the card §5 base for the overlay. Do NOT use `[]` (would still pass the preset test vacuously, but the lab's `relevantFeatureSet()` archetype filter at :6342 would never surface the machine folder under any preset — using 'Rocky (Earthlike)' makes the folder appear when that preset is loaded, matching §5's isolation recipe). No test ENUMERATES the archetype list against a fixed count, so adding `technogenic` breaks nothing — it only must satisfy: real presets + ≥1 feature (machine provides it).

### Uniforms (THREE uniforms object @ ~world-engine-lab.html:3884 after the uShat block · GLSL decl @ ~:188 after the uBio block · per-frame writer @ ~:6736 after the uShat writer)
| Uniform | Type | Default | Role |
|---|---|---|---|
| `uMachCoverage` | float | 0.0 | maturity/coverage driver — lowers the FBM threshold (scattered→full grid); 0 = bare base, gates the whole combiner + composite |
| `uMachDistrictScale` | float | 2.2 | low-freq district grid frequency |
| `uMachBlockScale` | float | 9.0 | high-freq block grid frequency (the scale-hierarchy 2nd tier) |
| `uMachSeamWidth` | float | 0.06 | grid-line / panel-seam half-width (border-distance threshold) |
| `uMachBevel` | float | 0.5 | bevel amount fed onto `grad` (the normal-channel driver) |
| `uMachMetalColor` | vec3 | (0.10,0.11,0.13) | near-flat dark-metal plate albedo |
| `uMachGlowColor` | vec3 | (0.45,0.85,1.0) | circuit-trace / window emissive color (amber/cyan tunable) |
| `uMachGlowIntensity` | float | 0.8 | trace+window glow brightness (emissive-bypass) |
| `uMachWindowDensity` | float | 0.5 | per-cell-hash fraction of lit cells |

Enable gate: `machineEnabled` (state-init default `true`, like every other feature) — the writer maps `uMachCoverage = state.machineEnabled ? state.machCoverage : 0.0`. All other uniforms pass through (inert behind coverage 0).

### Edit sites (ordered, REAL verified line numbers)
1. **world-engine-lab.html:187** (GLSL uniform decls, after the F46 `uBio*` block at :183-188) — add the 9 `uMach*` uniform declarations.
2. **world-engine-lab.html:901** (after `const int PROV_BIOMATS = 42;`) — add `const int PROV_MACHINE = 43; // F47 — neutral (engineered overlay, not geology)`.
3. **world-engine-lab.html:961** (provinceWeight if-chain, after the `PROV_BIOMATS` arm at :961) — add `else if (fid == PROV_MACHINE) { f = gProvince.z; fl = 1.00; }`.
4. **world-engine-lab.html:~802** (after the `voronoi3d` keystone, near the other combiner helpers ~:2589) — add the GLSL helpers: an inline `machGridSDF(vPos)` (triplanar 2-scale `fract`-grid border distance), and `machineRelief(vPos, inout float h, inout vec3 grad)` (early-out `if (uMachCoverage <= 0.0) return;`, computes coverage mask + bevel slope, `grad += uMachBevel * machEdge * machGrad * provinceWeight(PROV_MACHINE)`). Place beside `shatterCombiner` (:2589) for locality.
5. **world-engine-lab.html:3026** (analytic relief stage, immediately after `shatterCombiner(vPos, h, grad);`) — call `machineRelief(vPos, h, grad); // F47 panel bevels onto grad (ADDITIVE, F19 contract; gated by uMachCoverage × provinceWeight(PROV_MACHINE))`.
6. **world-engine-lab.html:3369** (Stage-7 EXOTIC slot — currently an empty placeholder comment :3367-3369) — add the **albedo composite**: recompute the coverage mask + plate SDF, then `surface = mix(surface, posterize(uMachMetalColor * (diff + ambient), uLevels, fc, 0.4, uDitherMode), machCov * platesMask);` so the dark metal lands inside the posterized envelope and maturity→0 / coverage 0 leaves `surface` untouched (byte-identical bare base). Guard the whole block on `if (uMachCoverage > 0.0)`.
7. **world-engine-lab.html:3548** (emissive-bypass channel, immediately after the F46 `bioC` block ends at :3548) — add the **trace-glow term**: `vec3 machC = vec3(0.0); if (uMachCoverage > 0.0) { ... machC = uMachGlowColor * (traceGlow + windowGlow) * uMachGlowIntensity * provinceWeight(PROV_MACHINE); }`. Trace = grid-seam SDF ridge; windows = per-cell-hash lit cells (`step(1.0 - uMachWindowDensity, hash(cellId))`). Deterministic spatial pattern; an optional `uTime` *intensity* shimmer is allowed, NO time-based coverage/grid.
8. **world-engine-lab.html:3811** (the `gl_FragColor` assembly) — add `+ machC` to the `min(... + bioC, vec3(1.0))` sum: `... + auroraC + bioC + machC`.
9. **world-engine-lab.html:3884** (THREE uniforms object, after the `uShat*` block :3882-3892) — add the 9 `uMach*: { value: ... }` entries with the defaults above.
10. **world-engine-lab.html:4485** (state-init, after the `shatterEnabled` line :4484) — add `machineEnabled: true, // F47 enable gate — off zeroes uMachCoverage at the writer (combiner early-outs + composite + glow all vanish: byte-identical pre-F47 output)` plus `machCoverage: 0.6, machDistrictScale: 2.2, machBlockScale: 9.0, machSeamWidth: 0.06, machBevel: 0.5, machMetalColor: [0.10,0.11,0.13], machGlowColor: [0.45,0.85,1.0], machGlowIntensity: 0.8, machWindowDensity: 0.5,`.
11. **world-engine-lab.html:6242** (GUI — add a new `fMachine` folder in the `Surface — Exotic` group, immediately after the F45 `fShat` block ends at :6242). NOTE: lives in `fExoticGroup` (Stage-7 exotic home, next to F45), NOT the Envelope folder — F46 went to Envelope because it is pure emissive with no relief; F47 has a relief channel + IS the Stage-7 exotic-overlay slot. Bindings:
```js
const fMachine = fExoticGroup.addFolder('Machine surface (F47)'); fMachine.close();
fMachine.add(state, 'machCoverage', 0, 1, 0.01).name('maturity (scatter→grid)');  // the uMachCoverage driver, default 0.6
fMachine.add(state, 'machDistrictScale', 0.8, 6, 0.1).name('district scale');
fMachine.add(state, 'machBlockScale', 3, 18, 0.5).name('block scale');
fMachine.add(state, 'machSeamWidth', 0.01, 0.15, 0.005).name('seam width');
fMachine.add(state, 'machBevel', 0, 1.5, 0.01).name('panel bevel');
fMachine.add(state, 'machGlowIntensity', 0, 1.5, 0.01).name('trace glow');
fMachine.add(state, 'machWindowDensity', 0, 1, 0.01).name('lit-window density');
fMachine.addColor(state, 'machMetalColor').name('plate color');
fMachine.addColor(state, 'machGlowColor').name('glow color');
fMachine.add(state, 'machineEnabled').name('✓ enabled');
```
The literal `.add(state, 'machineEnabled')` is REQUIRED — the test regex at tests/planet-archetypes.test.js:16 `/\.add\(state, '(\w+Enabled)'\)/g` scrapes panel enable-keys and :28 asserts every FEATURES enableKey is bound. Keep the exact spacing `, '` (one space after comma) to match the regex.
12. **world-engine-lab.html:6313** (`featureFolders` map, after `bioMats: fEnv,`) — add `machine: fMachine,` so solo/filter/relocate-enable plumbing picks it up (the `setFeatureEnables`/`window._lab.solo` path at :6334/:6358 then works for free).
13. **world-engine-lab.html:6736** (per-frame writer, after the `uShatSubAmt` write :6736) — add the writer block:
```js
// F47 machine surface — machineEnabled gates uMachCoverage→0 (combiner early-outs,
// composite + glow guarded on uMachCoverage>0): ONE gate kills the family, byte-identical
// pre-F47 output. Sole F47 write site.
uniforms.uMachCoverage.value      = state.machineEnabled ? state.machCoverage : 0.0;   // ✓ enable gate
uniforms.uMachDistrictScale.value = state.machDistrictScale;
uniforms.uMachBlockScale.value    = state.machBlockScale;
uniforms.uMachSeamWidth.value     = state.machSeamWidth;
uniforms.uMachBevel.value         = state.machBevel;
uniforms.uMachGlowIntensity.value = state.machGlowIntensity;
uniforms.uMachWindowDensity.value = state.machWindowDensity;
uniforms.uMachMetalColor.value.setRGB(state.machMetalColor[0], state.machMetalColor[1], state.machMetalColor[2]);
uniforms.uMachGlowColor.value.setRGB(state.machGlowColor[0], state.machGlowColor[1], state.machGlowColor[2]);
```
14. **planet-archetypes.js:128** (FEATURES, after the `bioMats` line :127) — add the `machine` entry.
15. **planet-archetypes.js:143** (ARCHETYPES, after `'exotic-shattered'` :142) — add the `technogenic` entry.
16. **planet-archetypes.js:203** (PROVINCES, after the `bioMats` row :202) — add `machine: { field: 2, polarity: +1, floor: 1.00 }, // neutral — engineered overlay, not geology: a built crust covers terrain regardless of rock provinces (FROST-row pattern, like bioMats F46)`.
17. **tests/planet-archetypes.test.js:109** (the `GLSL_NAME` map, after `bioMats: 'PROV_BIOMATS',`) — add `machine: 'PROV_MACHINE',`. This is the ONLY test edit; the assertions then validate the registration trio automatically.

### Key GLSL (fit to existing helpers — written, not copied verbatim)
Inline triplanar 2-scale grid SDF + coverage mask + bevel + trace, deterministic (domain-offset convention, `+ uMacroOffset` ties it to the seed like every other combiner — NO time in the spatial mask):
```glsl
// --- triplanar surface-aligned 2D rectilinear grid (district + block), returns
//     vec2(borderDist01, cellHash) blended over the 3 cardinal planes. ---
float machGrid1(vec2 uv, float scale, out float cellHash){
  vec2 g = fract(uv * scale);
  vec2 b = min(g, 1.0 - g);                 // distance to nearest grid line (per axis)
  float d = min(b.x, b.y);                  // 2D border distance
  vec2 cell = floor(uv * scale);
  cellHash = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  return d;
}
// blend the 3 axis-plane grids by triplanar weights (NOT a 3D lattice sliced by the sphere)
vec3 machGridSDF(vec3 p, float scale, out float cellHash){
  vec3 an = pow(abs(normalize(p)), vec3(6.0));
  an /= max(an.x + an.y + an.z, 1e-4);
  float hX, hY, hZ;
  float dX = machGrid1(p.yz, scale, hX);
  float dY = machGrid1(p.zx, scale, hY);
  float dZ = machGrid1(p.xy, scale, hZ);
  cellHash = hX*an.x + hY*an.y + hZ*an.z;   // dominant-plane cell id (blended)
  return vec3(dX*an.x + dY*an.y + dZ*an.z, cellHash, 0.0);  // .x = blended border distance
}
// coverage: low-freq FBM thresholded by maturity (scattered patches -> full grid)
float machCoverageMask(vec3 p){
  float f = 0.5 + 0.5 * fbmd(p * uMachDistrictScale * 0.5 + uMacroOffset, 3.0, 0.0).x;
  float t = mix(0.75, 0.05, uMachCoverage);   // high maturity lowers threshold (patches merge)
  return smoothstep(t, t + 0.15, f);
}
```
- **machineRelief (normal channel):** `if (uMachCoverage<=0.0) return;` → `float cov = machCoverageMask(vPos); float ch; vec3 gd = machGridSDF(vPos, uMachBlockScale, ch); float machEdge = 1.0 - smoothstep(0.0, uMachSeamWidth, gd.x);` → bevel slope = the gradient of that edge ridge banked into `grad` (finite-diff the SDF or reuse the analytic `voronoi3d` grad sign): `grad += uMachBevel * machEdge * normalize(cross(N, vec3(0.0,1.0,0.0))) * cov * provinceWeight(PROV_MACHINE);` (a directional kick along the seam tangent — tune at live-verify; the point is the seam catches light).
- **Stage-7 albedo composite:** `if (uMachCoverage>0.0){ float cov=machCoverageMask(vPos); float ch; float d=machGridSDF(vPos,uMachBlockScale,ch).x; float plates = (1.0 - smoothstep(0.0,uMachSeamWidth,d)) * 0.0 + 1.0; /* metal everywhere under coverage, seams handled by bevel */ surface = mix(surface, posterize(uMachMetalColor*(diff+ambient), uLevels, fc, 0.4, uDitherMode), cov); }`
- **Trace-glow (emissive bypass):** `if (uMachCoverage>0.0){ float cov=machCoverageMask(vPos); float chD, chB; float dD=machGridSDF(vPos,uMachDistrictScale,chD).x; float dB=machGridSDF(vPos,uMachBlockScale,chB).x; float trace = (1.0-smoothstep(0.0,uMachSeamWidth,dD)); float windows = step(1.0-uMachWindowDensity, chB) * (1.0-smoothstep(0.0,0.5,dB)); float shimmer = 0.85 + 0.15*noised(vec3(vPos.xy*3.0, uTime*0.1)).x; machC = uMachGlowColor * (trace + windows) * shimmer * uMachGlowIntensity * cov * provinceWeight(PROV_MACHINE); }`

(Chebyshev-Voronoi plate variety per §4 is an OPTIONAL refinement — start with the triplanar rectilinear grid above; if plates read too uniform at live-verify, add a `voronoi3d` Chebyshev pass to vary plate albedo/orientation. Logged as a v1-optional, not a blocker.)

### Suggested defaults + slider ranges (tuned at live-verify)
- `machCoverage` default 0.6 (mid — visible build-out without full saturation; the §5 isolation recipe sets it to 1.0 for the globe read). Range 0–1.
- `machDistrictScale` 2.2 (range 0.8–6), `machBlockScale` 9.0 (range 3–18) — a ~4× ratio gives a readable two-tier hierarchy (district vs block) per the greeble principle (§4, UAT item 4).
- `machSeamWidth` 0.06 (range 0.01–0.15) — matched to the ~500px posterized-disc seam scale (the F45 `shatBorderWidth` 0.04 precedent at world-engine-lab.html:6237).
- `machBevel` 0.5 (range 0–1.5) — mid, the grad driver; UAT item 5 (edges catch the sun) is the live gate.
- `machGlowIntensity` 0.8, `machWindowDensity` 0.5 (both mid).
- `machMetalColor` (0.10,0.11,0.13) dark neutral steel; `machGlowColor` (0.45,0.85,1.0) cyan (amber/green also valid per the production palette PlanetGenerator.js:260-266) — tunable colors.

### OFF / regression guarantee
`machineEnabled=off` ⇒ writer sets `uMachCoverage=0.0` ⇒ (a) `machineRelief` early-outs `if (uMachCoverage<=0.0) return;` (no `grad` write — `perturbAnalytic` sees the identical pre-F47 grad), (b) the Stage-7 albedo composite is guarded `if (uMachCoverage>0.0)` (`surface` untouched), (c) the trace-glow block is guarded `if (uMachCoverage>0.0)` (`machC` stays `vec3(0.0)`, and `+ machC` adds exactly zero). Maturity 0 (coverage 0) yields the identical result through the same three guards. Net: a bare Stage-6/posterized base, byte-identical to pre-F47 — the F46 `if (uBioCoverage > 0.0)` early-out pattern, applied to all three channels.

### Test line (verbatim — the ONLY test edit)
In `tests/planet-archetypes.test.js`, in the `GLSL_NAME` object, after the line `  bioMats: 'PROV_BIOMATS',` (:109):
```js
  machine: 'PROV_MACHINE',
```
After all edits, `npx vitest run tests/planet-archetypes.test.js` must stay green: the FEATURES↔panel-enable-key test (machineEnabled bound), the ARCHETYPES test (technogenic has a real preset + ≥1 feature), the PROVINCES↔FEATURES coverage test (machine row present), and the PROVINCES↔GLSL mirror test (PROV_MACHINE arm matches the data row).

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- **Rating: 🟡** (ships, one taste-call for Max). Both channels fire, the bare-base contract holds, poles are clean. The one judgment left for Max is the day-side metal albedo: out of the box it read as a near-black unlit ball; I walked it brighter so the normal channel reads, but how bright the metal should be is a taste call (see below).

- Max's feedback: (pending — UAT)

- **Live-verify findings (dpr 1.25, innerWidth 1402, zero shader errors throughout):**
  - **ON/OFF + coverage-0 delta — CONFIRMED.** `machineEnabled=true, cov=0.6` (full cyan circuit grid wrapping the globe) vs `machineEnabled=false` (bare mottled Rocky base) is a stark, unambiguous delta — the overlay/bypass is firing. `machineEnabled=true, cov=0.0` is byte-for-byte the bare Rocky base, identical to OFF — the Stage-7 maturity-0 contract holds. Shots: `F47-on.png`, `F47-off.png`, `F47-cov0-bare.png`.
  - **BOTH channels fire.** Emissive (night-side glow): crisp, un-banded, bright circuit traces + per-cell lit windows on the night hemisphere, sitting outside the posterized envelope exactly like F8 lava cracks (`F47-night-traces.png`, `F47-near-hierarchy-d1.5.png`). Normal (day-side bevel): firing but **under-read at the build-plan defaults** — at `machBevel=0.5` with near-black metal `(0.10,0.11,0.13)` the lit hemisphere was a dark dithered ball with barely-visible seam highlights (`F47-bevel0.png` vs `F47-bevel150.png` confirms bevel moves the surface but the signal was tiny against the dark albedo). Brightening the metal + bumping bevel fixed it (`F47-day-tuned.png`).
  - **Maturity ladder reads as deliberate build-out** (not noise speckle): cov 0 = bare base; cov 0.3 = scattered coherent patches of grid/glow with bare base between (`F47-ladder-cov30.png`); cov 0.6 = substantial build-out; cov 1.0 = planet-spanning saturated circuit grid (`F47-ladder-cov100.png`). Patches are coherent blobs with hard engineered edges.
  - **Scale hierarchy resolves** as the camera closes: at d8 the globe-scale district grid + limb curvature; at d3 district arterials + block subdivisions (`F47-district-d3.png`); at d1.5 the full district/block/trace + lit-window hierarchy with smooth-plate-vs-dense-region greeble contrast (`F47-near-hierarchy-d1.5.png`).
  - **Engineered read survives posterize+Bayer** — straight seams, right angles, rectilinear cells read clearly against the organic base.
  - **POLES — clean / minor-degradation (acceptable).** Looking straight down a pole (`F47-poles.png`, `F47-poles-near.png`): grid lines stay continuous and rectilinear across the polar cap. There IS a visible orientation transition at the exact pole point where the triplanar dominant-plane flips (the grid "rotates" as you cross it) — but NO polar pinching to a singularity, NO disconnected 3D-lattice slices, NO pixel-scale shimmer. The code-review-flagged tangential-kick degeneracy near N≈±y did NOT produce broken seams in practice. Limb curvature is clean (`F47-limb.png`). I judge this minor-degradation, ships as-is; flagging it as a known watch-item per the brief.

- **Tweaks applied** (world-engine-lab.html state-init defaults; both within existing GUI slider/picker ranges, no range edits needed):
  - `machBevel`: **0.5 → 0.9**. Reason: day-side panel-seam lighting (UAT item 5) under-read at 0.5 against the dark metal; 0.9 makes seams catch the sun without over-perturbing. (Slider range 0–1.5 already covers it.)
  - `machMetalColor`: **[0.10, 0.11, 0.13] → [0.22, 0.24, 0.28]**. Reason: near-black metal made the lit hemisphere an unlit ball — the normal channel had almost no lit signal to modulate. Brighter steel lets the sun-catching seams + normal-perturbation dither read on the day side (UAT item 5) while NOT washing out the night-side emissive glow (re-verified, `F47-on-tuned.png`).

- **Re-verify (after tuning):** Re-checked the full ON look at cov 0.6 / d8 with the new defaults — night-side traces still crisp and bright (emissive not washed), day-side metal now reads as visible engineered plate structure (`F47-on-tuned.png`, `F47-day-tuned.png`). Zero shader errors in console after the change. ON/OFF delta and cov-0 bare-base contract re-confirmed unaffected.

- **Taste-call for Max (the 🟡):** Day-side metal brightness. I set `machMetalColor` to `[0.22,0.24,0.28]` so the normal channel reads, but a machine world could legitimately be darker/more menacing (closer to the original near-black) if you'd rather the night-side glow carry the whole feature and the day side stay ominous. Slide `plate color` in the Machine surface (F47) folder to taste; everything else holds across the range.

- Status: VERIFIED_PENDING_MAX 685a7a4
