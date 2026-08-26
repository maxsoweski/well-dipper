# Feature Card — F49 Ecumenopolis
Domain: Overlay · Lab status: ⬜(lab) · Build-seq phase: 4c

## 1. Description (WHAT)

F49 Ecumenopolis (family F-overlay, domain Overlay) is the saturation endpoint of P28 Technospheric development: a civilization builds out until engineered structures replace/coat the entire natural terrain and light the whole nightside — a planet-covering megacity with whole-surface glow. It sits on the L1c biotic/technogenic process track (an agentive process, not geomorphic), driven by D15 habitability-to-tech + D16 age (civilizational time to reach saturation), with D7 nightside contrast powering the lights read. Variants run along the P28 intensity axis: scattered structures (F47 machine) → scattered cities / continuous urban band (F48 city lights) → planet-covering build-out (F49). The L1c compositing rule is load-bearing: an ecumenopolis sits on what WAS a terrestrial world — the representation must be base-type + overlay layer, so base oceans/weather/relief show through wherever coverage < 1, never a from-scratch generator. Real-body examples: none — fictional only (Coruscant, Trantor); Earth-at-night is the nascent real precursor (that's F48). WD type: `ecumenopolis` (EXOTIC), inventory status `[current]` (whole-surface city glow, production path).

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) in world-engine-lab.html — no ecumenopolis combiner, uniform, or GUI folder exists in the lab or in planet-archetypes.js FEATURES. The lab has already reserved its slot, though: the ★ EMISSIVE bypass channel comment at world-engine-lab.html:1572-1575 explicitly names "city lights F48/49" as an owner of the post-posterize emissive composite (alongside lava F41, bioluminescence F46, aurora F37) — that Lambert-independent, quantizer-skipping channel (uEmissive at :1577-1579, lavaCrackEmissive at :1580-1581, and the aurora nightMask pattern `smoothstep(0.1,-0.1,diff)` at :1593) is exactly the machinery F49 plugs into. A legacy production implementation DOES exist outside the lab: src/objects/Planet.js planetType==17 — two-scale axis-aligned fract() block grid + hash district pattern (Planet.js:772-789), steel/concrete day albedo with warm districts (Planet.js:843-849), and whole-surface nightside emissive glow `nightMask = 1.0 - smoothstep(0.0, 0.15, diffuse)` with cityGrid + districtBright hash (Planet.js:934-948). Generation: src/generation/ExoticOverlay.js:99 (civilized roll → 30% ecumenopolis) and src/generation/PlanetGenerator.js:277. The lab rebuild should port the production intent onto the lab's analytic-noise + emissive-bypass architecture, not copy the tri-axis cube grid.

## 3. Reference images (real + art)

- [real] https://earthobservatory.nasa.gov/images/79803/night-lights-2012-the-black-marble
  — Suomi NPP Black Marble composite — city light is clumpy and filamentary (coast-hugging clusters linked by highway threads), never uniform; F49 is this pattern run to full coverage.
- [real] https://svs.gsfc.nasa.gov/30878/
  — Black Marble 2016 rotating globe — how nightside lights read at whole-planet scale: bright cores, dim webbing, hard dark ocean gaps (the gaps are what F49 saturation removes).
- [real] https://www.earthdata.nasa.gov/data/projects/black-marble
  — VIIRS Day/Night Band radiance product — the actual measured brightness distribution of urban light (log-scale dynamic range: a few blazing cores, vast dim sprawl).
- [real] https://en.wikipedia.org/wiki/Ecumenopolis
  — The concept itself (Doxiadis 1967) — a single continuous worldwide city; useful for what 'saturation' means: no rural remainder, only districts of one urban fabric.
- [art] https://www.artstation.com/artwork/4NDP64
  — Coruscant early concepts (Gabriel Yeganyan) — megacity as repeating blocky massing with canyon-like gaps; structure reads through silhouette and shading, not surface detail.
- [art] https://vfxvoice.com/building-a-stunning-new-civilization-that-spans-the-galaxy-in-foundation/
  — Foundation's Trantor (DNEG) — brutalist monolithic blocky forms generated procedurally in Houdini by rules + bounding boxes; big geometric masses with few windows suit a 6-level posterize.
- [art] https://akikun.wordpress.com/procedural-city-lights-shader/
  — Procedural city-lights shader — two-tier model: bright 'big city' nodes plus a dim web-like small-town network; the tiering is what makes lights read as civilization, not noise.
- [art] https://planetpixelemporium.com/tutorialpages/earthlight.html
  — Classic planet-rendering technique: city lights gated to appear only on the dark side — the nightMask compositing pattern the lab's aurora already uses.

## 4. Math / modeling notes (HOW, from the field)

Real-world modeling: nighttime-light radiance (VIIRS DNB / Black Marble) shows urban light follows population density — Zipf-distributed city sizes, coast- and lowland-hugging clusters, filamentary highway connections. Urban-growth literature models this with correlated percolation / DLA and cellular automata, but the shader-side reduction games use is much simpler: a land/lowland-masked threshold-FBM coverage field (the production F48 city mask at Planet.js:925-932 already does threshold-snoise × landMask × coastBoost), pushed to coverage ≈ 1 for F49. VFX practice (Foundation's Trantor) generates the day-side structure as rule-based procedural blocky massing — at planet-shader scale that collapses to a district/block partition: the production code uses a two-scale axis-aligned fract() grid + hash district brightness (Planet.js:772-789, 934-948), which works but imprints a cube-axis lattice on the sphere; the research doc's Voronoi border distance (F2−F1, IQ two-pass) in object space is the seam-free replacement, with domain warping to bend the block network organic. Under the retro envelope the doc's spine applies directly: route detail through normals/specular, not color — day-side street canyons and mega-block massing should go through perturbAnalytic as relief (survives the 6-level posterize as dither texture), while the night glow is exactly what the Option-C ★ emissive bypass channel exists for (add AFTER the quantizer so the glow doesn't band; lab:1572-1581 already names F48/49 as an owner). Grid frequency should ramp off lodRamp with the fwidth octave clamp so the block lattice never moirés against the 4×4 Bayer. Most promising shader approach: composite an overlay over the terrestrial base per the L1c rule — a coverage mask crossfades albedo to a concrete palette and injects a Voronoi-border (F2−F1) district network into the analytic normal (street canyons as day-side relief), while the nightside gets a whole-surface emissive grid glow on the existing bypass channel, gated by the aurora-style nightMask and modulated by hash district brightness. Drive block frequency from lodRamp with fwidth clamping; let base oceans/relief show through where coverage < 1 so the world still reads as a terrestrial planet that was built over.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built. (1) Register in planet-archetypes.js FEATURES as `ecumenopolis: { label: 'Ecumenopolis (F49)', enableKey: 'ecumenopolisEnabled', archetypes: [...] }` — either added to 'tectonic-terrestrial' (it overlays a terrestrial base) or a new 'technogenic-overlay' archetype; the lab's solo plumbing (setFeatureEnables via the per-feature '🔆 solo' button at world-engine-lab.html:2563 and `window._lab.solo(key)` at :2908) then works with zero extra wiring. (2) In the :9223 debug Chrome (chrome-devtools MCP, per well-dipper-testing-reference.md — launch with --remote-debugging-port=9223), open world-engine-lab.html, select preset 'Rocky (Earthlike)' (the terrestrial base the overlay composites over), then run `window._lab.solo('ecumenopolis')`. (3) Judge at three distances via `window._lab.state.distance`: ~10 (whole-globe saturation read — is it planet-covering?), ~5 (district patchwork + terminator transition), ~2 (block-grid relief and emissive crispness at LOD2). (4) Rotate yaw to put the nightside in view and confirm the whole-surface glow on the emissive bypass channel; screenshot via mcp__chrome-devtools__take_screenshot, not Playwright.

## 6. What to judge (UAT checklist)

- [ ] Does the nightside read as a planet-wide continuous lattice of glow — saturation, no dark rural/ocean gaps — rather than scattered city patches (which would read as F48, not F49) in the 6-level posterized envelope?
- [ ] Does the emissive night glow stay crisp and unbanded (bypass channel) while the day surface stays fully inside the posterize — i.e. does it read as 'retro world with real lights' rather than banded smear?
- [ ] On the day side, do street canyons and mega-block massing read as lit relief (normal/shading detail that survives as dither texture), not as albedo noise the quantizer crushes flat?
- [ ] Does the block/district network read as organic urban fabric wrapped on a sphere — no axis-aligned cube-grid artifact or pole pinching from a tri-axis fract lattice?
- [ ] Does the underlying terrestrial base still show through where coverage < 1 — oceans, relief, weather visibly beneath/between the built-over fabric — per the L1c base+overlay compositing rule?
- [ ] Does district-to-district brightness variation read as believable urban tiering (bright cores, dimmer sprawl) at mid distance without flickering into Bayer dither noise?
- [ ] Does the terminator read as lights coming on — the emissive ramping in smoothly via the nightMask — rather than a hard day/night seam in the glow?
- [ ] Does block-grid frequency ramp coherently with approach distance (lodRamp) — more, finer blocks as you close in — without popping or moiré against the 4x4 Bayer?

## 6.5 Build plan

**Strategy (tri-part overlay, maturity-gated, over the terrestrial base).** F49 is the P28 saturation endpoint: it composites THREE channels over the posterized terrestrial base, all gated by one master knob `uEcuCoverage` (0 ⇒ byte-identical bare Stage-6 base). (a) **Day-side albedo crossfade** — Stage-6 `albedoCol` is mixed toward a concrete/steel palette by coverage PRE-posterize (the F41/F42 `albedoCol = mix(...)` precedent), so at high coverage the surface color is *replaced* toward concrete (UNLIKE F47, which kept its plate albedo on the Stage-7 composite and left Stage-6 flat). (b) **Day-side relief** — an **object-space Voronoi-border (F2−F1) district network** injected into the analytic `grad` accumulator (street canyons + mega-block massing), lit by the existing `perturbAnalytic`, exactly mirroring F47's `machineRelief` grad-feed but using the seam-free `voronoi3d` keystone instead of F47's triplanar `machGridSDF` — this is the load-bearing choice that kills the cube-axis lattice + pole pinching (UAT item 4). (c) **Night-side emissive** — F48's warm grid glow run to SATURATION (coverage≈1, no dark gaps) + per-district hash brightness tiering, on the post-quantizer emissive-bypass channel, gated by the aurora `nightMask`. Block frequency ramps off `uLodRamp` with the `fwidth` octave clamp so the lattice never moirés against the 4×4 Bayer (UAT item 8). **Confirmed: Voronoi-border, NOT triplanar.**

**GLSL prefix discipline.** Every new identifier uses the `ecu`/`uEcu` prefix. Checked against the GLSL ES 3.00 reserved-word list — `ecu`, `ecuCov`, `ecuBorder`, `ecuC`, `ecuCanyon`, `ecuWarp`, `ecuHash`, `ecuNight`, `uEcuCoverage`, `uEcuConcreteColor`, `uEcuGlowColor`, `uEcuGlowIntensity`, `uEcuDistrictScale`, `uEcuBlockScale`, `uEcuCanyonDepth`, `uEcuSeamWidth` are all clear (no `patch`/`sample`/`filter`/`input`/`output`/`active`/`common`/`partition`/`resource`/`superp`/`mat*`/`vec*`/`sampler*` collision). Precedent: F46/F40 had to rename a local `patch`→`bioPatch`/`dustPatch` (`'patch' is a GLSL ES 3.00 reserved word`, world-engine-lab.html:3613, :3422) — do NOT reintroduce one.

**PROV decision: `PROV_ECUMENOPOLIS = 45`, NEUTRAL.** Highest PROV in use is 44 (`PROV_CITYLIGHTS`, F48, world-engine-lab.html:918). F49 is an engineered/civilization overlay, not geology, so it follows the FROST-row NEUTRAL pattern of every overlay since aurora — GLSL arm `else if (fid == PROV_ECUMENOPOLIS) { f = gProvince.z; fl = 1.00; }` and JS row `ecumenopolis: { field: 2, polarity: +1, floor: 1.00 }`. This satisfies the test trio: `keys(PROVINCES) === keys(FEATURES)` (planet-archetypes.test.js:126), the GLSL-mirror row match (:151), and the no-extra-rows set (:157, needs `GLSL_NAME.ecumenopolis: 'PROV_ECUMENOPOLIS'`).

**Archetype decision: REUSE `tectonic-terrestrial`.** Same reasoning F48 adopted (planet-archetypes.js:139-143): the §5 verify recipe selects the Rocky/Ocean/Eyeball terrestrial bases the overlay composites over, and `tectonic-terrestrial` is the only archetype whose `presets` list includes all of them (:150). F47's `technogenic` lists only `Rocky (Earthlike)` — using it would leave the Ocean/Eyeball legs of the recipe pointing at a base that archetype can't reach. Test implication: every `FEATURES.archetypes` entry must be a real `ARCHETYPES` key (test:43-48) and every preset a real `DRIVER_PRESETS` key (test:50) — reusing the existing terrestrial archetype keeps both green with zero new archetype/preset wiring. (`technogenic` stays valid because F47 still lists it — test:57 "≥1 feature per archetype" holds.)

**Voronoi-border mechanism.** `voronoi3d(vec3 p, int cells, out vec3 cellId, out vec3 grad)` returns `vec2(F1, F2)` (world-engine-lab.html:796, :816), so the seam distance is simply `r.y - r.x` from a single call — NO workaround needed, NO double-call. District relief: domain-warp the sample point first (`vec3 ecuWp = vPos + uEcuWarpAmt * vec3(noised(...).x, ...)` — the F45/bioMats warp idiom) so the block network bends organic, sample `vec2 r = voronoi3d(ecuWp * blockFreq, 27, ecuCellId, ecuVGrad)`, build the canyon `float ecuBorder = 1.0 - smoothstep(0.0, uEcuSeamWidth, r.y - r.x)` (1 in the street, 0 inside a block), and bank it onto `grad` along a seam tangent the way F47 does: `grad += -uEcuCanyonDepth * ecuBorder * ecuVGrad * ecuCov` (negative = canyons carve DOWN; `ecuVGrad` is the cell's relief-normal out-param, so `perturbAnalytic` lights the canyon walls). **Block-frequency ramp:** `float blockFreq = uEcuBlockScale * mix(1.0, 2.2, uLodRamp)` (finer blocks as the camera closes), with the canonical octave clamp applied to the canyon weight — `ecuBorder *= (uFwClamp == 1) ? 1.0 - smoothstep(0.4, 0.8, fwBase * blockFreq) : 1.0` (the `fbmd`/`fbmdRidged` idiom at :847/:1021, using the in-scope `fwBase` from :3062) so sub-pixel blocks fade to their mean instead of moiréing the Bayer. Call site mirrors `machineRelief`: a new `ecuRelief(vPos, h, grad)` invoked right after machineRelief (:3091), additive-on-grad per the F19 contract, early-out `if (uEcuCoverage <= 0.0) return;`.

**Albedo-crossfade mechanism.** Target var = `albedoCol` (Stage-6, world-engine-lab.html:3231 onward; last touched at :3378 before the lit-surface compose at :3402, then `posterize` at :3430). Add a coverage crossfade in the F42 slot (just after the F42 carbon block ~:3355, before the F16 veil at :3365): `if (uEcuCoverage > 0.0) { float ecuCovA = ecuCoverageMask(vPos) * provinceWeight(PROV_ECUMENOPOLIS); albedoCol = mix(albedoCol, uEcuConcreteColor, ecuCovA); }`. Pre-posterize so the concrete tone lands on its own quantize bin (the F42 graphite precedent — deliberately low-freq, no high-freq albedo noise to fight the dither). Concrete palette default `vec3(0.34, 0.34, 0.36)` (mid-grey steel-concrete; legacy Planet.js:843-849 intent ported, NOT its tri-axis grid). Coverage 0 ⇒ `mix(...,0)` = `albedoCol` unchanged (regression-safe). NOTE/RISK: the crossfade competes with the posterize — keep the concrete tone a single flat value (no spatial variation here) so it reads as 1-2 clean bands, exactly as F42 graphite does; per-block tonal variation rides the RELIEF channel + dither, never albedo.

**Night-emissive mechanism.** New `ecuC` block in the emissive-bypass region (after F48's `cityC` block, ~:3659, before the F30 lightning add at :3664), the F46-`bioC`/F47-`machC`/F48-`cityC` survivor pattern: `vec3 ecuC = vec3(0.0); if (uEcuCoverage > 0.0) { float ecuCovE = ecuCoverageMask(vPos) * provinceWeight(PROV_ECUMENOPOLIS); vec2 r = voronoi3d(<warped> * uEcuDistrictScale, 27, ecuDistId, ecuG); float ecuDistHash = hash33(ecuDistId).x; float ecuBright = mix(0.35, 1.0, ecuDistHash); float ecuGrid = 1.0 - smoothstep(0.0, uEcuSeamWidth*1.5, r.y - r.x); /* glowing street lattice */ float ecuNight = 1.0 - smoothstep(-0.1, 0.1, diff); /* LIVE aurora nightMask form, NOT the card-prose smoothstep(0.1,-0.1) which is invalid GLSL — see :3656 */ float ecuShimmer = 0.9 + 0.1*noised(vec3(vPos.xy*2.0, uTime*0.05)).x; /* optional slow glow only */ ecuC = uEcuGlowColor * clamp((ecuGrid + 0.25) * ecuBright * ecuNight * uEcuGlowIntensity * ecuCovE, 0.0, 1.0); }`. SATURATION distinctive vs F48: the `+0.25` floor on the grid term + HIGH default coverage means the whole nightside glows (no dark rural/ocean gaps — UAT item 1), while the district hash gives bright cores / dim sprawl tiering (UAT item 6). Spatial layout is `uMacroOffset`-seeded + deterministic; `uTime` only in the optional shimmer. Add to the final composite: `gl_FragColor = vec4(min(surface + emissive + ... + cityC + ecuC, vec3(1.0)), 1.0);` at world-engine-lab.html:3922.

**New uniforms.**

| uniform | type | default | registration sites |
|---|---|---|---|
| `uEcuCoverage` | float | 0.0 (writer-gated) | THREE.uniforms obj (~:4016, after `uCityColor`); writer (~:6922, `state.ecumenopolisEnabled ? state.ecuCoverage : 0.0`); GLSL decl (~:201, after `uCityMaturity`) |
| `uEcuConcreteColor` | vec3/Color | (0.34,0.34,0.36) | uniforms obj; writer (`.setRGB`); GLSL decl |
| `uEcuGlowColor` | vec3/Color | (0.95,0.78,0.45) warm sodium | uniforms obj; writer (`.setRGB`); GLSL decl |
| `uEcuGlowIntensity` | float | 1.0 | uniforms obj; writer; GLSL decl |
| `uEcuDistrictScale` | float | 2.4 | uniforms obj; writer; GLSL decl |
| `uEcuBlockScale` | float | 8.0 | uniforms obj; writer; GLSL decl |
| `uEcuCanyonDepth` | float | 0.45 | uniforms obj; writer; GLSL decl |
| `uEcuSeamWidth` | float | 0.07 | uniforms obj; writer; GLSL decl |
| `uEcuWarpAmt` | float | 0.30 | uniforms obj; writer; GLSL decl |

(3 registration sites each: GLSL `uniform` decl block ~:155-201 · `uniforms` JS object ~:4002-4016 · per-frame writer ~:6905-6922. Scalars use `state.<name>`; colors use `.value.setRGB(state.x[0..2])`. `uEcuCoverage` is the sole master gate — writer multiplies the enable flag exactly like `uMachCoverage`:6908 / `uCityMaturity`:6918.)

**Edit sites (ordered, REAL current lines — grep-verified, NOT the stale card numbers).**
1. `world-engine-lab.html:~201` — GLSL `uniform` decls (insert the 9 `uEcu*` after `uCityMaturity`/`uCityColor` block at :201).
2. `world-engine-lab.html:918` — add `const int PROV_ECUMENOPOLIS = 45;` after `PROV_CITYLIGHTS`.
3. `world-engine-lab.html:980` — add GLSL provinceWeight arm `else if (fid == PROV_ECUMENOPOLIS) { f = gProvince.z; fl = 1.00; }` after the `PROV_CITYLIGHTS` arm.
4. `world-engine-lab.html:~2671` — new `float ecuCoverageMask(vec3 p)` (the `machCoverageMask`:2667 clone: low-freq fbm thresholded by `uEcuCoverage`, `mix(0.55, 0.02, uEcuCoverage)` — note LOWER ceiling than F47's 0.05 because F49 saturates) + new `void ecuRelief(vec3 pos, inout float h, inout vec3 grad)` (the `machineRelief`:2674 clone with the Voronoi-border canyon mechanism above).
5. `world-engine-lab.html:3091` — insert `ecuRelief(vPos, h, grad);` right after the `machineRelief(...)` call (additive-grad, F19 contract).
6. `world-engine-lab.html:~3355` — albedo crossfade block (after the F42 carbon block, before F16 veil at :3365): `if (uEcuCoverage > 0.0) albedoCol = mix(albedoCol, uEcuConcreteColor, ecuCoverageMask(vPos)*provinceWeight(PROV_ECUMENOPOLIS));`.
7. `world-engine-lab.html:~3659` — `ecuC` night-emissive block (after F48 `cityC` block ends, before F30 lightning at :3664).
8. `world-engine-lab.html:3922` — add `+ ecuC` to the `gl_FragColor` min() sum.
9. `world-engine-lab.html:~4016` — 9 entries in the `uniforms` JS object (after `uCityColor:`).
10. `world-engine-lab.html:~4634` — state-init defaults (after `cityColor:`): `ecumenopolisEnabled: true,` + `ecuCoverage: 0.85,` + the 8 knob defaults.
11. `world-engine-lab.html:~6398` — new `const fEcu = fExoticGroup.addFolder('Ecumenopolis (F49)'); fEcu.close();` after `fMachine` (F49 has a relief channel ⇒ fExoticGroup home, like F47, NOT fEnv); add sliders for all 8 knobs + `fEcu.addColor(state,'ecuConcreteColor')` + `fEcu.addColor(state,'ecuGlowColor')` + **`fEcu.add(state, 'ecumenopolisEnabled').name('✓ enabled');`** (load-bearing literal — test:16 regex `/\.add\(state, '(\w+Enabled)'\)/` needs this exact single-line form; relocated to title by the existing :6498 loop).
12. `world-engine-lab.html:~6922` — per-frame writer block (after the F48 city writes at :6918-6922).
13. `world-engine-lab.html:6481` — add `ecumenopolis: fEcu,` to the `featureFolders` map (gives solo + title-toggle wiring for free).
14. `planet-archetypes.js:143` — add `ecumenopolis: { label: 'Ecumenopolis (F49)', enableKey: 'ecumenopolisEnabled', archetypes: ['tectonic-terrestrial'] },` after `cityLights`.
15. `planet-archetypes.js:221` — add `ecumenopolis: { field: 2, polarity: +1, floor: 1.00 },` to `PROVINCES` after `cityLights`.
16. `tests/planet-archetypes.test.js:111` — add `ecumenopolis: 'PROV_ECUMENOPOLIS',` to the `GLSL_NAME` map (after `cityLights`). This is the ONLY hand-edit the test needs — the FEATURES/PROVINCES/panel-binding/archetype assertions all auto-satisfy from sites 11/14/15.

**Key GLSL (fits voronoi3d / perturbAnalytic / lodRamp+fwidth; deterministic — domain-offset, no uTime in spatial layout).**
```glsl
// ── F49 coverage (machCoverageMask clone; saturates harder) ──
float ecuCoverageMask(vec3 p){
  float f = 0.5 + 0.5 * fbmd(p * uEcuDistrictScale * 0.5 + uMacroOffset, 3.0, 0.0).x;
  float t = mix(0.55, 0.02, uEcuCoverage);          // high coverage ⇒ near-zero threshold ⇒ planet-covering
  return smoothstep(t, t + 0.12, f);
}
// ── F49 day-side district relief: Voronoi-border canyons into grad (machineRelief slot) ──
void ecuRelief(vec3 pos, inout float h, inout vec3 grad){
  if (uEcuCoverage <= 0.0) return;                  // early-out: byte-identical pre-F49 grad
  float cov = ecuCoverageMask(pos) * provinceWeight(PROV_ECUMENOPOLIS);
  if (cov <= 0.0) return;
  float fwB  = max(max(fwidth(pos.x), fwidth(pos.y)), fwidth(pos.z));
  float bFreq = uEcuBlockScale * mix(1.0, 2.2, uLodRamp);          // blocks resolve finer as camera closes
  // domain warp → organic block network (bioMats/F45 warp idiom)
  vec4 w1 = noised(pos * (uEcuBlockScale*0.4) + uMacroOffset + vec3(7.3,-2.1,5.9));
  vec3 wp = pos + uEcuWarpAmt * vec3(w1.x, w1.y, w1.z);
  vec3 ecuCellId, ecuVGrad;
  vec2 r = voronoi3d(wp * bFreq, 27, ecuCellId, ecuVGrad);          // r.x=F1, r.y=F2
  float ecuBorder = 1.0 - smoothstep(0.0, uEcuSeamWidth, r.y - r.x); // 1 in street canyon, 0 inside block
  if (uFwClamp == 1) ecuBorder *= 1.0 - smoothstep(0.4, 0.8, fwB * bFreq); // kill sub-pixel moiré vs Bayer
  grad += -uEcuCanyonDepth * ecuBorder * ecuVGrad * cov;            // carve canyons DOWN; perturbAnalytic lights walls
}
```
(The night-emissive `ecuC` block + albedo crossfade are quoted in the two mechanism paragraphs above; both reuse `voronoi3d`/`hash33`/`noised` + the live `diff` nightMask form at :3656.)

**Suggested defaults + ranges (tuned at verify).** `ecuCoverage` default **0.85** (HIGH — F49 is the SATURATION feature; contrast F48's scattered 0.5), slider `0..1`. `ecuGlowIntensity` 1.0 (`0..2`). `ecuConcreteColor` (0.34,0.34,0.36) — mid steel-grey, bright enough that day-side canyon relief + dither read without going to an unlit ball (the F47 live-verify lesson: near-black metal killed the day read, machMetalColor was walked 0.10→0.22). `ecuGlowColor` (0.95,0.78,0.45) warm sodium (F48 amber, slightly warmer). `ecuDistrictScale` 2.4 (`0.8..6`), `ecuBlockScale` 8.0 (`3..18`), `ecuCanyonDepth` 0.45 (`0..1.2`), `ecuSeamWidth` 0.07 (`0.01..0.2`), `ecuWarpAmt` 0.30 (`0..0.6`). Reasoning: district ≈ machDistrictScale, block ≈ machBlockScale so the two-tier hierarchy reads at the same distances F47 tuned; canyon depth mid so massing reads as relief not noise.

**OFF / coverage-0 regression guarantee.** Single master gate `uEcuCoverage`: the writer forces it to 0 when `ecumenopolisEnabled` is false (the `machineEnabled`/`cityLightsEnabled` precedent). At 0: `ecuRelief` early-outs (no grad write ⇒ byte-identical pre-F49 normal), the albedo crossfade is `mix(albedoCol, _, 0)` = `albedoCol` unchanged, and the `ecuC` block is skipped ⇒ `ecuC == vec3(0)` ⇒ `gl_FragColor` byte-identical bare Stage-6 base. Coverage→0 continuously reveals the base everywhere (UAT item 5: oceans/relief show through where coverage < 1).

**Test line(s) verbatim** (the only hand-edit `tests/planet-archetypes.test.js` needs — insert into `GLSL_NAME` after the `cityLights: 'PROV_CITYLIGHTS',` line at :111):
```js
  ecumenopolis: 'PROV_ECUMENOPOLIS',
```

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- **Rating: 🟡** (ships; one taste-call for Max on day-side relief strength — see below).

- **Live-verify findings (:9223 GPU lab, Rocky (Earthlike) base, solo'd, dpr 1.25, innerWidth 1402, ZERO shader errors across all states + post-tune reload):**
  - **ON/OFF + cov-0 delta = firing.** ON (cov 0.85) vs OFF at identical camera is a strong, unambiguous delta: OFF = the bare reddish-brown terrestrial Rocky base (no concrete, no district net, no glow); ON = grey concrete albedo + Voronoi district relief + warm sodium nightside lattice. `ecuCoverage=0` is byte-identical to OFF (bare base) — the single master-gate regression contract holds. NOT an ON==OFF blocker.
  - **All THREE channels fire:** (a) day concrete albedo crossfade ✓ (surface goes mid-grey steel where built-over); (b) day-side district relief ✓ (Voronoi-border street canyons + mega-block massing read as lit relief through the normal channel — see canyon-depth tweak below); (c) night emissive grid ✓ (whole-surface warm amber Voronoi lattice, crisp/unbanded on the bypass channel, with bright-core/dim-sprawl district tiering).
  - **Saturation read = PLANET-WIDE (correct F49 identity), NOT scattered F48 patches.** At default cov 0.85 the nightside is a continuous organic glow lattice wrapping the whole disc — no large dark rural/ocean gaps, only small base-show-through spots. Coverage ladder cov0(bare)→0.5→0.85→1.0 reads as monotonically increasing saturation (cov 0.5 has visibly larger dark gaps; 1.0 densest). Reads as one worldwide urban fabric, not cities-in-a-band.
  - **POLE / cube-grid behavior = CLEAN.** Oriented over the pole (pitch 1.35), the object-space Voronoi network wraps organically — same irregular cell sizes across the pole, NO axis-aligned cube-grid lattice, NO pole pinch/convergence. The seam-free `voronoi3d` keystone (vs the legacy Planet.js tri-axis `fract()` grid) does its job; this was the load-bearing UAT-4 risk and it's resolved.
  - **Terminator = smooth.** Day/night boundary centered: the emissive ramps in gradually through the terminator band via the aurora-style nightMask — lights "come on" smoothly, no hard day/night glow seam.
  - **LOD ramp = clean.** Dolly d10→d2: finer block/canyon frequency resolves as the camera closes (lodRamp + fwidth clamp), no popping, no moiré shimmer against the 4×4 Bayer dither at LOD2.

- **Per-UAT (§6, 8 items):** (1) planet-wide glow saturation — **PASS**; (2) night crisp/unbanded vs day-in-posterize — **PASS**; (3) day canyons as lit relief not albedo noise — **PASS** (after canyon-depth tune; was borderline-subtle at the shipped default); (4) organic urban fabric, no cube-grid/pole-pinch — **PASS**; (5) terrestrial base shows through where coverage<1 — **PASS** (cov ladder + base-show-through spots); (6) district brightness tiering w/o Bayer flicker — **PASS**; (7) terminator lights-coming-on, no hard seam — **PASS**; (8) lodRamp finer blocks, no pop/moiré — **PASS**.

- **Tweaks applied:**
  - `state.ecuCanyonDepth` default **0.45 → 0.70** (`world-engine-lab.html:4720`). Reason: at the build-plan default 0.45 the day-side street-canyon network read as a subtle albedo mottle rather than clearly *lit relief* (the exact F47 "day read too weak" failure mode the card warns about). At 0.70 the canyons catch shading and the mega-block massing reads as relief through the dither, satisfying UAT-3, with no over-carving and no moiré at the closest LOD. (Spot-checked 0.45 / 0.70 / 0.90; 0.90 read slightly "scarred", 0.70 is the clean middle.) Slider range `0..1.2` (`:6507`) already covers it — no range widening needed. No other defaults changed; the build-plan glow/coverage/scale/warp/seam defaults all read correctly as-shipped.

- **Re-verify:** After the edit, reloaded the lab (`?fresh=1`) and confirmed: ZERO shader errors, default loaded as `ecuCanyonDepth:0.70`, and the day-canyons relief reads as intended at the new default (final `F49-day-canyons.png` captured at 0.70). All three channels + saturation + pole-clean re-confirmed at the tuned default.

- **Taste-call for Max (the 🟡):** Day-side relief strength. Shipped at `ecuCanyonDepth 0.70` (up from 0.45) so the megacity massing reads as *relief* on the lit day side rather than near-flat concrete. If you'd rather the day side stay more subdued/flat-brutalist (letting the nightside glow carry the feature), dial it back toward 0.5; if you want the canyons even more sculpted, 0.9 still holds without artifacting. Everything else is 🟢.

- **Shots** (in `docs/FEATURES/cards/shots/`, gitignored): `F49-on.png` / `F49-off.png` (same-camera delta), `F49-cov0-bare.png` (master-gate regression = bare base), `F49-wholedisc-d10.png` (whole-disc saturation), `F49-night-grid.png` (planet-wide warm lattice), `F49-day-canyons.png` (day relief @ tuned 0.70), `F49-poles.png` (organic-over-pole, no cube grid), `F49-ladder-cov50.png` / `F49-ladder-cov100.png` (saturation sweep), `F49-terminator.png` (smooth lights-coming-on), `F49-lod-d2.png` (LOD2, no moiré).

- **Risk/anomaly:** None blocking. Minor: the night lattice at default reads as fairly large organic "blob-border" cells (domain-warped Voronoi) rather than a tight rectilinear grid — this is by design (seam-free organic urban fabric) and reads as planet-wide saturation, but if Max expects a denser/finer street grid, raise `ecuDistrictScale`/`ecuBlockScale`. Flagging as a possible second taste-call, not a defect.

- **Max's feedback:** (pending — UAT)
- **Status:** VERIFIED_PENDING_MAX 92bf873
