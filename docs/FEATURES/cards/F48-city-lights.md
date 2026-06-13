# Feature Card — F48 City lights
Domain: Overlay · Lab status: ⬜(lab) · Build-seq phase: 4c

## 1. Description (WHAT)

F48 "City lights" (Overlay/EXOTIC family): warm artificial lighting on a planet's nightside, the visible signature of P28 Technospheric development — a civilization building out over civilizational time (D16 surface age), gated by D15 habitability, expressed on the dark hemisphere via D7 day/night geometry. Intensity axis runs the full P28 ramp: scattered cities → continuous coastal/urban bands → lit-nightside saturation (the F49 ecumenopolis end-state is "whole-surface glow + circuit grid"). The inventory's L1 design note (planet-visual-features.md:188-198) mandates base-type + overlay-layer compositing: the terrestrial base's oceans, weather, and relief must still show through wherever the overlay doesn't cover. Variants per the F48 row (planet-visual-features.md:336): "scattered cities … continuous urban band; lit nightside." Real-body example: Earth at night (nascent — Earth is the sparse start of the axis). WD types: the `city-lights` archetype (F48 over a terrestrial base, planet-visual-features.md:375) and `eyeball` (nightside cities on a tidally-locked world, :368 — civilization lights the permanently dark hemisphere).

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) in planet-lod-lab.html — F48 exists only as a reserved slot: the ★ emissive-channel header comment lists "city lights F48/49" as an owner of the posterize-bypass channel (planet-lod-lab.html:1572-1574), and Stage 7 "EXOTIC overlay" is an explicit placeholder (:1554-1556, "maturity→0 must reveal the bare stage-6 base — the overlay-correctness test"). Nearest existing machinery it plugs into: (a) the emissive bypass terms after the quantizer split — uEmissive/uEmissiveBypass (:1576-1578) and lavaCrackEmissive (:1581), the canonical Option-C survivors; (b) aurora's nightside gate `nightMask = smoothstep(0.1, -0.1, diff)` (:1592); (c) the existing landMask/albedo chain in Stage 6. Note: the inventory marks F48 `[current]` because the LEGACY production renderer implements it — src/objects/Planet.js:918-931 (planetType 16: multi-octave snoise cityMask × landMask × coastBoost × nightMask, warm vec3(0.95,0.75,0.3)) and :934-948 (type 17 ecumenopolis: fract-grid glow × per-district hash × nightMask), with habitability/HZ gating in src/generation/PlanetGenerator.js (types declared :37-45, spawn gating ~:495-518, :723). The lab version is a port-and-upgrade of that proven recipe into the envelope pipeline, not a from-scratch invention. No GUI folder or uniforms exist yet in the lab; planet-archetypes.js FEATURES (:6-22) has no city/overlay entry.

## 3. Reference images (real + art)

- [real] https://svs.gsfc.nasa.gov/30876/
  — NASA SVS Black Marble 2016 global composite — lights form filamentary networks along coasts and river valleys with bright nodes, not uniform speckle; oceans and deserts stay black.
- [real] https://science.nasa.gov/earth/earth-observatory/night-lights-2012-the-black-marble-79803/
  — The original Black Marble (Suomi NPP VIIRS) — at whole-disc distance cities read as a few bright clusters plus dim connective tissue; this is the 'nascent' start of the F48 intensity axis.
- [real] https://science.nasa.gov/earth/earth-observatory/cities-at-night-the-view-from-space/
  — NASA Earth Observatory ISS night-city gallery — at close range cities resolve into grid/radial street filaments around a saturated core, the structural target for LOD2.
- [real] https://www.nasa.gov/image-article/paris-night/
  — Paris from the ISS — radial-spoke street grid dominating at night, warm sodium-amber core vs cooler periphery; note the hue is warm, not white.
- [art] https://akikun.wordpress.com/procedural-city-lights-shader/
  — Procedural city-lights shader (Blender) — two-scale decomposition: bright 'big city' spots plus a dim web of small towns; exactly the two-octave mask structure that survives posterization.
- [art] https://planetpixelemporium.com/tutorialpages/earthlight.html
  — Planet Pixel Emporium city-lights tip — the classic game-rendering trick of masking the lights layer to the night hemisphere so it never bleeds into daylight.
- [art] https://www.artstation.com/artwork/4NDP64
  — Coruscant early concepts (Gabriel Yeganyan, ArtStation) — the ecumenopolis end-state: continuous engineered glow with district-scale brightness variation, the saturation end of the P28 ramp.

## 4. Math / modeling notes (HOW, from the field)

Real-world structure (remote sensing): VIIRS Day/Night Band radiance scales with population density over ~3 orders of magnitude, and the rank-size distribution of lit settlement clusters follows a power law with exponent near −2 (Zipf-like: few bright megacity cores, many dim villages — see the night-light-networks literature, e.g. Small et al.'s spatial network analyses). Lights concentrate at coasts, river valleys, and lowlands; at city scale they resolve into grid/radial filaments along transport corridors. Games/sims model this as an emissive layer gated by 1−Lambert: `nightMask = smoothstep(ε, −ε, dot(N, L))` so lights fade through twilight (the legacy WD shader, Planet.js:920, already does this). Procedurally, the field's standard recipe is a settlement-suitability scalar (land × low elevation × coast proximity × habitability) thresholded by two noise octaves — matching the legacy cityMask = smoothstep(0.2,0.6, snoise×8 + 0.5·snoise×16) × landMask × coastBoost. A Worley upgrade gives more Earth-like structure: F1 cell-center distance → city cores with radial falloff; F2−F1 ridges → highway-filament connections between cores (same Worley vocabulary as the research doc's lava-cracks row, RESEARCH_high-lod-planet-shaders-2026-06-05.md:103); per-cell hash → which cells are settled, with the settled fraction driven by P28 maturity. In the WD envelope this is a textbook Option-C citizen: the research doc's quantizer split (§Option C, :52-57) exists precisely for crisp glows that look wrong when banded, and high-contrast point-like warm emission has the best posterization survival of any color-borne detail. Most promising shader-side approach: build a suitability field from the existing landMask + coast-distance + a 2-octave noise threshold (or Worley cores+filaments), gate it with aurora-style nightMask, and add `vec3(0.95,0.75,0.3) × cityMask × coastBoost × nightMask × uCityIntensity` into the ★ emissive channel after the posterize split (planet-lod-lab.html:1572), bypassing the quantizer like lavaCrackEmissive. One maturity uniform (P28) sweeps the threshold + per-cell settled fraction from scattered specks → coastal bands → the F49 grid; maturity 0 must leave the Stage-6 base untouched (the overlay-correctness test at :1556).

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built: (1) Register in planet-archetypes.js FEATURES as `cityLights: { label: 'City lights (F48)', enableKey: 'cityLightsEnabled', archetypes: [...] }` — this auto-creates the per-feature GUI solo button and makes `window._lab.solo('cityLights')` work (the solo plumbing already exists: planet-lod-lab.html:2563 and :2908 `solo(key){ setFeatureEnables(key); }`). It needs a new EXOTIC/overlay archetype entry (e.g. 'technospheric') since none of the five existing archetypes (:26-32) covers P28. (2) In the :9223 debug Chrome (chrome-devtools MCP, per well-dipper-testing-reference.md), load the lab, pick preset 'Rocky (Earthlike)' (habitability 0.7) or 'Ocean (temperate)' (0.9) — the two terrestrial bases the overlay composites over. (3) `window._lab.solo('cityLights')`. (4) Rotate yaw so the terminator crosses mid-disc (lights live on the dark side; judging happens at and behind the terminator). (5) Distances via `window._lab.state.distance =`: 20 (whole-disc — do clusters read at all?), 12 (disc — coastal-band structure), 4 (terminator close-up — twilight fade), 2 (LOD2 — settlement filament/grid structure). (6) Sweep the P28 maturity uniform 0→1 and confirm maturity 0 exactly reproduces the bare Stage-6 base (overlay-correctness test).

## 6. What to judge (UAT checklist)

- [ ] Does the nightside read as scattered point-like settlements clustering into a few bright cores with dim connective filaments — a power-law hierarchy, not uniform noise speckle — in the 6-level posterized envelope?
- [ ] Do the lights read as hugging coastlines and lowlands (brighter band where land meets ocean), so the overlay visibly respects the base world's landMask?
- [ ] Do lights behave as nightside-only: fully absent in daylight, fading smoothly through terminator twilight rather than hard-cutting at the day/night line?
- [ ] Does the warm amber glow stay crisp against the dithered dark surface — a clean emissive-bypass read with no quantization banding halos around bright nodes?
- [ ] Does the P28 maturity sweep read as a coherent civilizational ramp: sparse specks → connected coastal/urban bands → grid-saturated lit nightside (F49 territory)?
- [ ] At maturity 0 (and everywhere on the dayside), does the bare terrestrial base render unchanged — does the overlay behave as an overlay, with oceans/weather/relief showing through?
- [ ] At whole-disc distance (12-20 radii), does the nightside still read as 'inhabited' via a handful of bright nodes rather than dissolving into the Bayer dither floor?
- [ ] On an eyeball preset, do lights sit plausibly on the habitable terminator ring / dark hemisphere rather than ignoring the locked day/night geometry?

## 6.5 Build plan

**Strategy.** F48 is the simplest overlay in the family: a pure emissive-bypass night-side term, no normal/relief channel (unlike F47). At the post-quantizer emissive site (alongside F46 `bioC` / F47 `machC`), build a *settlement-suitability* mask = land × coast-proximity × 2-octave noise threshold, gate it by the aurora `nightMask`, and add `vec3(0.95,0.75,0.3) × cityMask × nightMask × uCityIntensity`. ONE maturity uniform `uCityMaturity` lowers the noise threshold (specks → coastal bands → near-saturated nightside). `uCityMaturity == 0 ⇒ machC-style early-out ⇒ byte-identical bare Stage-6 base`. The F49 ecumenopolis (whole-surface glow + circuit grid) is a SEPARATE next card — F48 stops at "lit nightside."

**GLSL prefix discipline.** All new identifiers use a `city`/`uCity` prefix. Checked against the GLSL ES 3.00 reserved list (`patch, sample, filter, input, output, active, common, partition, resource, mat*, vec*, sampler*`): `cityMask, cityFbm, cityLand, cityCoast, cityNight, uCityMaturity, uCityIntensity, uCityColor, uCityScale, uCityCoastBoost` are all clear. (Precedent: F46 used `bioPatch` not `patch`, F40 used `dustPatch` — `'patch' is a GLSL ES 3.00 reserved word`, documented at planet-lod-lab.html:3415/:3606. Do NOT introduce a bare `sample`/`filter`/`input`.)

**Mask choice — 2-octave noise, NOT Worley.** Reasons, with criteria = (a) simplicity-mandate, (b) posterization survival, (c) where UAT judges. (1) F46's `smoothstep(thresh, thresh+δ, fbm)` lives at the adjacent emissive site and is proven to survive the 6-level posterize; reusing its shape is the minimum change. (2) F48's hierarchy comes mostly from the **land×coast gating** (lights hug coastlines — UAT item 2), not from intra-land cell structure, which only resolves at LOD2 close range. (3) Worley cores+filaments (F1 city cores, F2−F1 highways) is genuinely richer but is the *city-scale grid* — that is F49 territory; pulling it into F48 violates "simplest overlay." Worley is recorded here as the documented F49 upgrade path (`voronoi3d` keystone already exists at planet-lod-lab.html:778). A second slow octave (`snoise×2`) on top of the base FBM gives the bright-core/dim-web two-scale read the reference art (akikun, Black Marble) calls for, with no new primitive.

**PROV decision — `PROV_CITYLIGHTS = 44`, NEUTRAL.** Highest PROV in use is 43 (PROV_MACHINE, F47); 44 is next. City lights are a coverage overlay over habitable terrain, not a rock-province geology — so they take the **neutral FROST-row pattern** identical to aurora/bioMats/machine: GLSL arm `else if (fid == PROV_CITYLIGHTS) { f = gProvince.z; fl = 1.00; }` and the JS row `cityLights: { field: 2, polarity: +1, floor: 1.00 }`. This satisfies the test's PROVINCES↔FEATURES key-equality + the `provinceWeightFromField` neutral-arm assertions (floor 1.00 ⇒ weight 1 everywhere, no gating).

**Archetype decision — REUSE existing `tectonic-terrestrial` (no new archetype).** F48 is a habitable-terrestrial overlay (civilization grows on the same worlds as F46 bioMats, which already rides `tectonic-terrestrial`). That archetype's `presets` list ALREADY contains exactly the three bases the §5 verify recipe needs: `'Rocky (Earthlike)'`, `'Ocean (temperate)'`, `'Eyeball (locked temperate)'` (planet-archetypes.js:3). Test implication: every-archetype-≥1-feature and every-preset-is-a-real-DRIVER_PRESETS-key both stay green (we add a feature to an archetype that already passes; we add no preset). This is cleaner than F47's `technogenic` choice — F47 needed a new archetype because no *natural* archetype fits an engineered crust; F48 genuinely belongs to the terrestrial family, and reusing it makes the solo/preset isolation work over all three §5 bases for free. (Do NOT reuse `technogenic` — it lists only `'Rocky (Earthlike)'`, which would break the Ocean/Eyeball legs of the §5 recipe.)

**New uniforms** (insert GLSL decls after the F47 `uMachWindowDensity` line, planet-lod-lab.html:200; THREE entries after :3984; per-frame writes after :6869):

| uniform | type | default | sites |
|---|---|---|---|
| `uCityMaturity` | float | 0.0 (gate) | GLSL :200 · THREE :3984 · writer :6869 |
| `uCityIntensity` | float | 0.9 | GLSL :200 · THREE :3984 · writer :6869 |
| `uCityScale` | float | 2.8 | GLSL :200 · THREE :3984 · writer :6869 |
| `uCityCoastBoost` | float | 1.6 | GLSL :200 · THREE :3984 · writer :6869 |
| `uCityColor` | vec3 | (0.95,0.75,0.3) | GLSL :200 · THREE :3984 · writer :6869 (`.setRGB`) |

`uCityMaturity` is the master gate (pure lab knob, no driver derivation — exactly like F47 `uMachCoverage`): the writer sets it to `state.cityLightsEnabled ? state.cityMaturity : 0.0`. All others inert behind maturity 0.

**Edit sites (REAL current line numbers — file is 7151 lines; card §-numbers are stale):**

1. `planet-lod-lab.html:200` (after `uniform float uMachWindowDensity;`) — add the 4 `uniform float uCity*` + 1 `uniform vec3 uCityColor` decls.
2. `planet-lod-lab.html:912` (after `const int PROV_MACHINE = 43;`) — `const int PROV_CITYLIGHTS = 44; // F48 — neutral (civilization coverage, not geology; FROST-row, like bioMats F46 / machine F47)`.
3. `planet-lod-lab.html:973` (after the `PROV_MACHINE` arm) — `else if (fid == PROV_CITYLIGHTS) { f = gProvince.z; fl = 1.00; }`.
4. `planet-lod-lab.html:3597-3615` — STUDY ONLY: the F46 `bioC` block is the structural template (FBM patch threshold + `nightMask = 1.0 - smoothstep(-0.1, 0.1, diff)` + post-quantizer add). NOTE: `liquidMask` (declared :3032, set :3111) and `diff` (:3202) are top-scope-of-main and ARE reachable here; raw `h` is NOT (it's branch-local) — recompute land from `liquidMask`, not `h`.
5. `planet-lod-lab.html:3633` (immediately AFTER the F47 `machC` block, before the F30 lightning comment) — INSERT the new `vec3 cityC = vec3(0.0); if (uCityMaturity > 0.0) { … }` block (the key GLSL below).
6. `planet-lod-lab.html:3895` — extend the final composite: `... + bioC + machC + cityC, vec3(1.0)) ...` (add `+ cityC` to the existing `gl_FragColor` min()).
7. `planet-lod-lab.html:3984` (after the `uMachWindowDensity: { value: 0.5 },` THREE entry) — add the 5 `uCity*` uniform-object entries (`uCityColor: { value: new THREE.Color(0.95,0.75,0.3) }`).
8. `planet-lod-lab.html:4596` (after `machWindowDensity: 0.5,`) — state-init defaults: `cityLightsEnabled: true, cityMaturity: 0.5, cityIntensity: 0.9, cityScale: 2.8, cityCoastBoost: 1.6, cityColor: [0.95,0.75,0.3],`.
9. `planet-lod-lab.html:4879` (after the F46 `fEnv.add(state,'bioMatsEnabled')` line) — GUI: F48 is pure-emissive like F46, so it lives in the **Envelope `fEnv` group** (NOT `fExoticGroup` — that was F47's home because F47 has a relief channel). Add the city sliders + the load-bearing enable literal (see GUI bindings below).
10. `planet-lod-lab.html:6434` (after `machine: fMachine,` in `featureFolders`) — `cityLights: fCity,` (`fCity` = the folder created at step 9 if a sub-folder is used; if the sliders go directly into `fEnv`, map `cityLights: fEnv` exactly as `bioMats: fEnv` does at :6433).
11. `planet-lod-lab.html:6869` (after the `uMachGlowColor.value.setRGB(...)` writer line) — per-frame writes (the 5 uniforms; `uCityMaturity.value = state.cityLightsEnabled ? state.cityMaturity : 0.0` is the sole gate; `uCityColor.value.setRGB(...)`).
12. `planet-archetypes.js:127` (after the `bioMats:` FEATURES entry, mirror the F47 `machine:` comment block) — `cityLights: { label: 'City lights (F48)', enableKey: 'cityLightsEnabled', archetypes: ['tectonic-terrestrial'] },`.
13. `planet-archetypes.js` PROVINCES block (after the `machine:` row, currently :211-area) — `cityLights: { field: 2, polarity: +1, floor: 1.00 }, // neutral — civilization coverage, not geology (FROST-row, like machine F47 / bioMats F46)`.
14. `tests/planet-archetypes.test.js:108` (after `machine: 'PROV_MACHINE',` in `GLSL_NAME`) — `cityLights: 'PROV_CITYLIGHTS',`. (This is the ONE required test line; the registration-trio + GLSL-mirror + enableKey-bound assertions then all auto-cover F48.)

**Solo plumbing:** none needed — `setFeatureEnables` (planet-lod-lab.html:6455) and the per-folder solo button (:6479) iterate `Object.keys(FEATURES)` generically. Registering step 12 + mapping step 10 makes `window._lab.solo('cityLights')` work automatically (the §5 recipe).

**Key GLSL (step 5 — the `cityC` block):**
```glsl
// ★ F48 city lights — warm artificial night-side glow on the emissive-bypass channel
// (the F46 bioC / F8 lava-crack survivor pattern: crisp over the 6-level posterize, reads on
// the dark hemisphere). Suitability = land × coast-proximity × 2-octave noise threshold,
// maturity-swept. Deterministic (uMacroOffset-seeded); uCityMaturity 0 ⇒ cityC = vec3(0) exactly.
vec3 cityC = vec3(0.0);
if (uCityMaturity > 0.0) {
  float cityLand  = 1.0 - liquidMask;                                   // land where there's no standing liquid
  // coast-proximity: bright band where land meets ocean (liquidMask edge). On dry/relict worlds
  // (uSeaLevel <= -1 ⇒ liquidMask == 0) cityCoast == 1.0 everywhere, so lights still appear inland.
  float cityCoast = mix(1.0, uCityCoastBoost, smoothstep(0.0, 0.25, liquidMask) * (1.0 - liquidMask) * 4.0);
  // settlement-suitability noise: base FBM + a half-weight 2× octave (bright cores + dim web,
  // the akikun / Black-Marble two-scale read). uMacroOffset ties the pattern to the seed.
  float cityFbm = 0.5 + 0.5 * ( noised(vPos * uCityScale + uMacroOffset).x
                              + 0.5 * noised(vPos * (uCityScale * 2.0) + uMacroOffset).x );
  float cityThresh = mix(0.78, 0.30, uCityMaturity);                    // maturity lowers threshold: specks → bands
  float cityMask = smoothstep(cityThresh, cityThresh + 0.12, cityFbm) * cityLand * clamp(cityCoast, 0.0, uCityCoastBoost);
  float cityNight = 1.0 - smoothstep(-0.1, 0.1, diff);                  // LIVE aurora nightMask form (NOT the card-prose smoothstep(0.1,-0.1,diff), invalid GLSL)
  float city = cityMask * cityNight * uCityIntensity * provinceWeight(PROV_CITYLIGHTS);
  cityC = uCityColor * clamp(city, 0.0, 1.0);
}
```
NO `uTime` in the spatial mask (deterministic). A slow intensity shimmer (`0.9 + 0.1*noised(vec3(vPos.xy*2.0, uTime*0.05)).x`) is optional/allowed and may be added at live-verify if the static read is too sterile — but it is NOT required and must never enter the *coverage/threshold* path.

**GUI bindings (step 9 — exact, the enable literal is load-bearing):** the test regex at tests/planet-archetypes.test.js:16 is `/\.add\(state, '(\w+Enabled)'\)/g`, so the enable controller MUST be the literal `.add(state, 'cityLightsEnabled')` with nothing between `state,` and `)` except the quoted key (then chain `.name(...)`). Add into `fEnv` right after the F46 block:
```js
// ▸ City lights (F48) — emissive-bypass overlay (P28 night-side civilization glow). Pure
// emissive (no relief channel) so it lives in fEnv next to F46, NOT fExoticGroup (F47's home).
fEnv.add(state, 'cityMaturity',   0, 1,   0.01).name('city maturity (specks→bands)'); // intensity axis, default 0.5
fEnv.add(state, 'cityIntensity',  0, 1.5, 0.01).name('city glow');                     // default 0.9
fEnv.add(state, 'cityScale',      0.8, 6, 0.1 ).name('city density');                  // default 2.8
fEnv.add(state, 'cityCoastBoost', 1, 3,   0.05).name('coast hugging');                 // default 1.6
fEnv.addColor(state, 'cityColor').name('city color');
fEnv.add(state, 'cityLightsEnabled').name('✓ city lights enabled');                    // ← load-bearing literal (test:16 regex)
```

**Suggested defaults + slider ranges (with reasoning):**
- `cityMaturity` 0.5, range 0–1 — mid shows clear build-out without saturation; §5 sweeps 0→1; 0 is the regression gate.
- `cityIntensity` 0.9, range 0–1.5 — slightly under 1.0 so the warm glow reads bright against the dither floor (UAT item 7) without clipping the `min(...,1.0)` and losing hue.
- `cityScale` 2.8, range 0.8–6 — matched to the F46 `bioScale` 2.4 neighbourhood; gives a handful of bright clusters at whole-disc (UAT items 1, 7) rather than uniform speckle.
- `cityCoastBoost` 1.6, range 1–3 — >1 makes the coast band visibly brighter (UAT item 2); 1.0 disables coast-hugging for an inland-only look; cap 3 before it over-rings the shore.
- `cityColor` (0.95,0.75,0.3) — the proven legacy warm sodium-amber (src/objects/Planet.js:920), matching the Paris/Black-Marble references (warm, not white — UAT framing).

**OFF / maturity-0 regression guarantee.** `uCityMaturity` is the single master gate. `cityLightsEnabled == false` ⇒ writer forces `uCityMaturity = 0.0` ⇒ the `if (uCityMaturity > 0.0)` early-out leaves `cityC = vec3(0.0)` ⇒ the composite `+ cityC` adds nothing ⇒ byte-identical pre-F48 render (the Stage-7 overlay-correctness contract, mirroring F46's `if (uBioCoverage>0.0)` and F47's `if (uMachCoverage>0.0)`). City lights touch ONLY the additive emissive channel — never `surface`, never `grad`, never the posterize path — so oceans/weather/relief always show through (UAT item 6).

**Test line(s) — verbatim** (the only test-file change; insert at tests/planet-archetypes.test.js:108, after the `machine: 'PROV_MACHINE',` line):
```js
  cityLights: 'PROV_CITYLIGHTS',
```

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- **Rating: 🟡** (ships as-built; one optional default-taste call for Max — see below). The feature is mechanically correct on every axis; the 🟡 is purely a "how nascent should the default feel" taste question, not a defect.

- **Max's feedback:** (pending — UAT)

- **Live-verify findings** (chrome-devtools :9223, GPU lab; dpr 1.25, innerWidth 1402 — sane, no screenshot-scaling trap). Solo `cityLights` confirmed isolating (all 44 other features off). Console: ZERO errors/warnings across the full sweep.
  - **Bypass firing (ON / OFF / maturity-0):** CONFIRMED FIRING. Same camera (Rocky, d12, night-side yaw), maturity 0.5: ON = full warm-amber nightside; OFF = bare base (only a faint day-crescent sliver, night side black); maturity-0 = byte-identical to OFF (no lights). ON ≠ OFF; the emissive-bypass add and the `uCityMaturity>0` early-out both work. The overlay-correctness contract holds (`F48-on.png` / `F48-off.png` / `F48-maturity0-bare.png`).
  - **Nightside-only gate:** PASS. Lights absent on the dayside, fade in smoothly through the terminator twilight — no hard cut (`F48-terminator-fade-d4.png`).
  - **Per-UAT (8 items):** (1) power-law hierarchy — PASS (clearest at maturity 0.3: few bright cores + dim web; at 0.5 it reads more built-out). (2) coast-hugging / respects landMask — PASS (Ocean preset: unmistakable dark ocean voids, brightening at land/ocean edges — `F48-coast-ocean.png`). (3) nightside-only + smooth twilight — PASS. (4) crisp amber, no banding halos — PASS (clean against the dither floor at d4 and d2). (5) maturity ramp — PASS (0.3 specks → 0.5 coastal/urban build-out → 1.0 near-saturated lit nightside; `F48-ladder-mat30.png` / `F48-ladder-mat100.png`). (6) bare base at maturity 0 / dayside unchanged — PASS (maturity-0 == OFF; oceans/relief show through everywhere the overlay doesn't cover). (7) whole-disc 20 radii reads inhabited — PASS (distinct amber nodes hold against the Bayer floor, do NOT dissolve — `F48-wholedisc-d20.png`). (8) eyeball preset — PASS (lights sit on the dark hemisphere / terminator ring of the tidally-locked world, honoring the locked geometry — `F48-eyeball.png`).
  - **Whole-disc vs close brightness tension:** the build-plan defaults (intensity 0.9, scale 2.8) resolve the tension well — bright amber nodes still read as "inhabited" at d20 without washing into a uniform sheet at d2 (at d2/LOD2 the lights resolve into settlement-cluster blobs with dark gaps, not fine filaments — correct, since filament/grid structure is explicitly F49 territory, `F48-lod2-d2.png`).
  - **Eyeball result:** PASS — confirmed the locked-world geometry is respected; lights gate to the dark hemisphere the same Lambert way (frostLocked/weatherLocked=1 only bake surface features, not light direction).

- **Tweaks applied:** NONE. All build-plan defaults (`cityMaturity 0.5`, `cityIntensity 0.9`, `cityScale 2.8`, `cityCoastBoost 1.6`, `cityColor [0.95,0.75,0.3]`) and slider ranges passed every UAT distance without adjustment. The whole-disc-vs-close tension was already well-balanced at ship defaults; walking values up was unnecessary.

- **Re-verify:** N/A (no tuning). Re-confirmed console clean after the full distance/maturity/preset sweep.

- **🟡 taste-call for Max (the one open question):** at the **default maturity 0.5** the nightside reads as an already built-out coastal civilization rather than a sparse "Earth-at-night nascent" start. If you'd prefer the *default* to feel more nascent (clearer power-law: a few bright cores + dim web, like the Black-Marble reference), drop the `cityMaturity` default to ~0.35 (the 0.3 ladder shot shows that read). Purely a default-feel preference — 0.5 is a defensible "civilization visibly built out" default and the full 0→1 ramp is correct either way.

- Shots: `F48-on.png`, `F48-off.png`, `F48-maturity0-bare.png`, `F48-ladder-mat30.png`, `F48-ladder-mat100.png`, `F48-coast-ocean.png`, `F48-terminator-fade-d4.png`, `F48-wholedisc-d20.png`, `F48-lod2-d2.png`, `F48-eyeball.png` (in `docs/FEATURES/cards/shots/`, gitignored).

- **Status:** VERIFIED_PENDING_MAX 1a5bcc0
