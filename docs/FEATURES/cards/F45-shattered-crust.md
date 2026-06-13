# Feature Card — F45 Shattered / fractured crust
Domain: Exotic · Lab status: ⬜ · Build-seq phase: 4c

## 1. Description (WHAT)

F45 "Shattered / fractured crust" (F-exotic-natural table, planet-visual-features.md:324) derives from P15 "Crustal tessellation / fracture" (:156): cooling-contraction or convective stress tiles the crust into regular polygons; **catastrophic stress shatters it into chaotic blocks**; slow crystallization grows facet fields — F45 is the chaotic-blocks endmember of that triplet (F44 hex = polygons, F43 crystal = facets). Drivers: D11, D16 (cooling), uniform lithology, D12/tidal stress; the fracture pattern records the body's disruption history. Intensity axis: "local fracture zone … globally shattered blocks." Real-body example: Miranda (analog — Voyager 2 patchwork of mismatched provinces, fault canyons up to 20 km deep, historically explained as disruption + reaccretion); Europa's Conamara Chaos is the small-scale sibling (F9, which shares the `shattered` type). WD types: shattered (the EXOTIC catastrophic-disruption preset, whose feature set is F45+F9 per :371), rocky, ice. Status: `[aspirational]` *(speculative)* — but per the overlay design note (:386), `shattered` is NOT an overlay exotic: it has a plausible natural physical premise (P15) driven by real L0 params, so it composes through the normal L0→L1→L2 relief chain.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). No `shatter`/F45 entry exists in the FEATURES registry (/home/ax/projects/well-dipper/planet-archetypes.js:6-23) and no exotic archetype in ARCHETYPES (:27-33); nothing in planet-lod-lab.html references F45. Nearest existing machinery it should plug into: the F9 `chaosCombiner` (/home/ax/projects/well-dipper/planet-lod-lab.html:1171-1186) — a `voronoi3d` cell partition with per-cell constant raft height + per-cell CONSTANT tilt gradient and a recessed "refrozen matrix" between rafts, gated by a low-frequency region mask (`uChaosMaskScale`, uniforms :268-273, :1700-1704) — F45 is essentially that mechanism promoted from masked local patches to a global, two-scale block field; secondarily the F6 `tesseraCombiner` (:1022-1044, warped crosscutting lattice) for crack families, and the graben carve-down profile used by cryo chasma (:836-849). All would ADD IN to the unified relief accumulator (h/grad) at :1476-1509, behind a ≤0 early-out uniform per the registry convention.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/uranus/moons/miranda/
  — Miranda full-disc: discrete mismatched terrain provinces with sharp seams — the 'reassembled patchwork' read F45 wants at planet scale.
- [real] https://science.nasa.gov/photojournal/miranda-high-resolution-of-large-fault/
  — Verona Rupes (Voyager 2, 36,250 km): a single fault scarp ~20 km high — block boundaries read as huge shadow-casting cliffs, not soft slopes.
- [real] https://photojournal.jpl.nasa.gov/catalog/PIA01182
  — Conamara Chaos (Galileo): rigid crustal rafts shifted, rotated, and tilted in a lower jumbled matrix — the per-block tilt + recessed-matrix form, just scaled up for F45.
- [real] https://svs.gsfc.nasa.gov/11176
  — NASA SVS Europa chaos-terrain visualization: how block fields read at oblique lighting — borders carry the signal, block interiors stay flat.
- [art] https://outerwilds.fandom.com/wiki/Brittle_Hollow
  — Outer Wilds' Brittle Hollow: a stylized low-detail shattered planet where crust plates read as discrete chunks purely through silhouette + flat-shaded facets — proof the form survives heavy stylization.
- [art] https://deep-fold.itch.io/pixel-planet-generator
  — Deep-Fold's dithered pixel-planet generator: cracked/lava planet types show fracture networks reading clearly inside a Bayer-dithered, few-color envelope — directly our posterize regime.

## 4. Math / modeling notes (HOW, from the field)

Academia models catastrophic crustal disruption via impact-fragmentation physics: SPH disruption studies (Benz & Asphaug-style Q*_D thresholds) predict shatter-then-reaccrete rubble bodies, and fragmentation statistics (Mott/Grady theory, Weibull flaw distributions) show fragment patterns are well-approximated by Voronoi-like tessellations — which is exactly why DCC tools (Blender Cell Fracture, Houdini RBD) implement destruction as (often hierarchical/clustered) Voronoi cell fracture. In shader terms, every ingredient is already in the lab's vocabulary from RESEARCH_high-lod-planet-shaders-2026-06-05.md §3.1: a `voronoi3d` cell partition with per-cell hashed constant height offset + per-cell CONSTANT tilt gradient (the chaos-convention "cosmetic gradient" — voronoi3d returns ∂F1 only, so block interiors get exact flat-plate normals that land each block in its own posterize band); IQ's **Voronoi border distance (F2−F1)** two-pass for perpendicular edge distance, inverted into a graben-style carved-DOWN crack groove (reuse the cryo `grabenProfile`); light **domain warping** of the cell-space so crack lines go irregular instead of soap-bubble-regular; a low-frequency mask (the `uChaosMaskScale` pattern) sweeping the intensity axis from local fracture zone to globally shattered (mask→1); and all of it lighting-routed (perturb N from the accumulated grad) so the form survives the 6-level posterize. Two scales sell "shattered" over "paved": low-frequency mega-blocks (province scale, large height/tilt) plus a higher-frequency sub-fracture lattice within blocks (tessera-style or second voronoi octave); an optional emissive crack term added AFTER the posterize (the lava Worley-crack bypass from §3.3) gives a "freshly shattered / hot interior" variant. Most promising approach: write `shatterCombiner` as a globalized two-octave generalization of the existing `chaosCombiner` — voronoi3d mega-blocks with hashed flat height + constant tilt, F2−F1 border distance carved down as deep crevasses with graben walls, region mask defaulting to ~1 for the `shattered` type — adding into the unified h/grad accumulator behind a `uShatterStrength ≤ 0` early-out, exactly matching the registry's combiner conventions.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built. Register in planet-archetypes.js FEATURES as `shatter: { label: 'Shattered crust (F45)', enableKey: 'shatterEnabled', archetypes: [<new 'exotic-shattered' archetype, or reuse 'icy-active'] }` so the lab's solo plumbing (planet-lod-lab.html:2539 setFeatureEnables / :2908 window._lab.solo) picks it up automatically. Then on the :9223 debug Chrome (chrome-devtools MCP, per well-dipper-testing-reference — NOT Playwright): open planet-lod-lab.html; `window._lab.setPreset('Frozen (airless)')` (best existing preset: airless, high bombardment, cold — closest to a disrupted body; add a dedicated 'Shattered (exotic)' DRIVER_PRESETS entry when the exotic types land); `window._lab.solo('shatter')`; judge at three distances via `window._lab.state.distance = 20` (full disc — global block patchwork), `= 8` (mid lodRamp — border crevasses resolving), `= 3` (LOD2 close — per-block tilt shading + sub-fracture lattice). Cross-check composition with F9: `window._lab.setPreset('Europa (icy moon)'); window._lab.solo('chaos')` shows the existing local-scale sibling. Restore with `window._lab.enableAllFeatures()`.

## 6. What to judge (UAT checklist)

- [ ] Do crustal blocks read as discrete rigid plates — flat or uniformly tilted tops, each landing in its own lighting band — rather than continuous noise lumps, in the 6-level posterized envelope?
- [ ] Do inter-block fractures read as carved-DOWN crevasses (a darker shadowed border band with cliff-like walls) separating plates, holding that read as the terminator sweeps across them?
- [ ] Does the pattern read at two scales — mega-province blocks (Miranda patchwork) subdivided by a finer crack lattice — so the disc says 'violently reassembled', not 'uniform paving stones' (which would read as F44 hex)?
- [ ] At full-disc distance (20 radii), does the limb stay a clean sphere while the surface reads chunked — i.e. does the shatter arrive as relief/lighting, not as albedo splotches that the posterize smears?
- [ ] Does the intensity axis behave: a masked local fracture zone with a sharp seam against intact crust at low strength, ramping to globally shattered blocks at full strength?
- [ ] Do adjacent blocks separate into different posterize bands often enough that the patchwork survives quantization instead of dissolving into dither noise at mid distance?
- [ ] Is the block pattern deterministic on re-approach — same seed, same plates, no temporal drift — consistent with the lab's domain-offset 🎲 convention?
- [ ] When composed with F2 craters (both enabled), do craters sit ON blocks and break at borders plausibly, rather than floating over the fracture field as an unrelated layer?

## 6.5 Build plan (HOW to build it)

Strategy: §4's "most promising approach" verbatim — write `shatterCombiner` as a
**globalized, two-octave generalization of the F9 `chaosCombiner`** (planet-lod-lab.html:2372).
chaosCombiner = voronoi3d mega-cells with per-cell hashed flat raft height + per-cell
CONSTANT tilt gradient + recessed refrozen matrix, gated by a low-freq `uChaosMaskScale`
region mask. F45 promotes that from a masked LOCAL patch (mask sweeps in only where
`uCryoActivity` allows) to a GLOBAL field whose mask defaults to ~1, adds a **F2−F1 border
crevasse carved DOWN** (reuse `grabenProfile` :1950), and adds a **finer second-octave
sub-fracture lattice** inside blocks (a tessera-style cross-cut, F6 `tesseraCombiner` :2157,
or a 2nd voronoi octave) — two scales are what sell "violently reassembled" over "uniform
paving stones" (UAT item 3, the F44-distinguishing read). ALL relief (height + gradient),
never albedo, so it survives the 6-level Bayer posterize. Mirrors the F44 plumbing set
EXACTLY (commit `dde2332`).

**ARCHETYPE RECOMMENDATION — new `exotic-shattered`.** F43/F44 share `exotic-geometric`
(crystal facets + hex paving — both ORDERED tilings of a PRISTINE crust). F45 is the
opposite physical story: CATASTROPHIC disruption of an existing crust into CHAOTIC,
mismatched, tilted blocks (P15 shatter-then-reaccrete endmember; Miranda/Conamara analog).
Putting it in `exotic-geometric` would imply it shares a carrier with the ordered tilings,
which is wrong and would also let the lab's solo/archetype tooling group it with F44 — the
exact "reads like F44 paving stones" failure UAT item 3 guards against. A dedicated
`exotic-shattered` archetype (label "Exotic / shattered", bodies ['Miranda','Europa
Conamara Chaos'], preset ['Frozen (airless)'] for v1 — see preset note below) keeps the
distinct read legible AND gives the eventual `shattered` exotic type (card §1: feature set =
F45 + F9) a home. Add it to `ARCHETYPES` (planet-archetypes.js:131, after `exotic-geometric`).

**GLSL prefix discipline: `shat`.** F43 used `fct`, F44 used `hx`. F45 uses **`shat`** for
ALL locals + uniforms (`uShat*`). `shat` collides with NO GLSL reserved word and is clear of
the traps (`fc`=gl_FragCoord; `sh` alone is too close to shadowing/`shadow` reads — `shat`
is unambiguous and 4 chars). A reserved-word/identifier collision blacks out the WHOLE lab
with a shader-compile error that no static check catches — keep every F45 local under `shat`.

**EDIT ONLY** `planet-lod-lab.html`, `planet-archetypes.js`, `docs/FEATURES/**`. NEVER touch
`src/`, `docs/NOW.md`. Stage explicit paths only — never `git add -A` (a parallel warp
session shares the tree).

**⚠️ MAGNITUDE SELF-CHECK (the F44 fix-cycle, baked in — do this BEFORE declaring done):**
the lab lights surfaces from the analytic normal built off `grad` (:3006-3007, `reliefAmp =
uPerturb * mix(0.7,1.0,uLodRamp)` → `perturbAnalytic(N, grad, reliefAmp)`). Height written to
`h` ALONE does not light → feature invisible (ON==OFF pixel-identical). Route relief into
`grad`. The reference is `chaosCombiner` (:2382-2387): per-cell `tilt = (rh-0.5)*2.0*uChaosRaftJitter`
written **directly** into grad (`grad += region * interior * tilt`) at FULL jitter amplitude
(no extra scale), and the matrix term `grad += region*(1-interior)*uChaosMatrixRough*rn.yzw`.
F45's per-block tilt MUST push grad at the SAME magnitude as chaosCombiner's tilt at
comparable knob settings; the border-crevasse grad MUST use `* uShatBorderDepth * 0.9` (the
F44 lesson: F44 v1 used `*borderWidth*0.9 ≈0.07`, ~12× too weak — it was DEPTH that needed to
drive the slope, matched to the 0.9 seam scale). **Before declaring done, statically compare
`shatterCombiner`'s grad contribution term-by-term against `chaosCombiner`'s** (the raft tilt
and the matrix grad) — they should be the same order of magnitude. The correct live
isolation (NOT perturb≈0, which zeroes the relief consumer and proves nothing — the v1
false-negative): `perturb` at normal ~0.55 + `solo('shatter')`; set `octAuto=false, octaves=1`
to flatten base FBM and judge BLOCK shape.

### 1. Uniform GLSL declarations (add after the F44 `uHexDome` line :597)
Mirror the F44 `uHex*` block (:582-597). Names + default *intent*:
- `uniform float uShatStrength;`    — master gate 0..1 (pure enable: 1 when `shatterEnabled`, else 0; writer is sole owner). Default `{ value: 0.0 }`.
- `uniform float uShatScale;`       — mega-block density (voronoi3d frequency). Default intent ~1.6 (the F44 BCC lesson: large clear blocks read; fine packs dissolve under posterize at distance). Will be walked.
- `uniform float uShatBlockJitter;` — per-block flat-height + CONSTANT-tilt displacement (the chaos `uChaosRaftJitter` analog — THE grad driver). Default ~0.6.
- `uniform float uShatBorderDepth;` — F2−F1 crevasse carve-down depth (grabenProfile amplitude). Default ~1.0.
- `uniform float uShatBorderWidth;` — smoothstep width of the F2−F1 border band feeding grabenProfile. Default ~0.10.
- `uniform float uShatMaskScale;`   — low-freq region-mask frequency (the `uChaosMaskScale` pattern). Default ~1.1.
- `uniform float uShatMaskCover;`   — region coverage 0..1 = the INTENSITY axis (local fracture zone → globally shattered). **Default ~1.0** (the `shattered` global read; UAT item 5 sweeps it down for the masked-local-zone endmember).
- `uniform float uShatSubFreq;`     — second-octave sub-fracture lattice frequency (multiplier on uShatScale; ~3–4× so it subdivides blocks). Default ~3.5.
- `uniform float uShatSubAmt;`      — sub-fracture relief amount (0 = single-scale blocks, >0 = subdivided). Default ~0.4 (must be non-zero by default or UAT item 3 fails → reads as F44).

### 2. THREE.js uniforms object entries (after the F44 `uHexBorderWidth`/`uHexDome` block ~:3765)
Same nine, same defaults: `uShatStrength:{value:0.0}`, `uShatScale:{value:1.6}`,
`uShatBlockJitter:{value:0.6}`, `uShatBorderDepth:{value:1.0}`, `uShatBorderWidth:{value:0.10}`,
`uShatMaskScale:{value:1.1}`, `uShatMaskCover:{value:1.0}`, `uShatSubFreq:{value:3.5}`,
`uShatSubAmt:{value:0.4}`. Comment each `inert behind strength 0`.

### 3. State init defaults (after the F44 `hexDome` line :4357)
`shatterEnabled: true`, `shatScale: 1.6`, `shatBlockJitter: 0.6`, `shatBorderDepth: 1.0`,
`shatBorderWidth: 0.10`, `shatMaskScale: 1.1`, `shatMaskCover: 1.0`, `shatSubFreq: 3.5`,
`shatSubAmt: 0.4`. (These are STARTING guesses — walk them live per §9 before baking finals,
exactly as F44 retuned hexScale 4.0→1.6 and borderDepth 0.5→1.1.)

### 4. Per-frame uniform writer (sole owner — after the F44 `uniforms.uHexDome.value` line :6558)
```
// F45 shattered crust — shatterEnabled gates the master strength→0 (block tilt, border
// crevasses, sub-fracture ALL key on uShatStrength>0, so ONE gate kills the family:
// byte-identical pre-F45 output). No driver derivation (no preset). Sole F45 write site.
uniforms.uShatStrength.value    = state.shatterEnabled ? 1.0 : 0.0;   // ✓ enable gate
uniforms.uShatScale.value       = state.shatScale;
uniforms.uShatBlockJitter.value = state.shatBlockJitter;
uniforms.uShatBorderDepth.value = state.shatBorderDepth;
uniforms.uShatBorderWidth.value = state.shatBorderWidth;
uniforms.uShatMaskScale.value   = state.shatMaskScale;
uniforms.uShatMaskCover.value   = state.shatMaskCover;
uniforms.uShatSubFreq.value     = state.shatSubFreq;
uniforms.uShatSubAmt.value      = state.shatSubAmt;
```

### 5. The `shatterCombiner` GLSL function (place AFTER `hexCrust` ends ~:2530, above the F10 cryoRidge block)
Pseudo-GLSL (mirror chaosCombiner :2372 + grabenProfile :1950 + tessera :2157 grad style):
```
void shatterCombiner(vec3 pos, inout float h, inout vec3 grad){
  if (uShatStrength <= 0.0) return;                         // ≤0 EARLY-OUT (byte-identical pre-F45)
  // ── low-freq region mask: the uChaosMaskScale pattern, but GLOBAL (cover→1) ──
  vec4 mn = noised(pos * uShatMaskScale + uMacroOffset);
  float region = smoothstep(1.0 - uShatMaskCover, 1.0 - uShatMaskCover + 0.3, 0.5 + 0.5*mn.x);
  region *= provinceWeight(PROV_SHATTER);
  float amp = uShatStrength * region;
  if (amp <= 0.0) return;
  // ── OCTAVE 1: voronoi3d MEGA-BLOCKS — per-cell flat height + per-cell CONSTANT tilt ──
  vec3 cId, vGrad;
  vec3 shatQ = pos * uShatScale + uMacroOffset + vec3(7.3, 24.1, -15.6);   // decorrelate seed
  vec2 ff = voronoi3d(shatQ, uVoroCells, cId, vGrad);
  vec3  rh    = hash33(cId);
  float interior = smoothstep(0.0, uShatBorderWidth*1.5, ff.y - ff.x);     // 1 inside block, 0 at seam
  float blockH = (rh.x - 0.5) * 2.0 * uShatBlockJitter;                    // per-block flat raft height
  vec3  tilt   = (rh - 0.5) * 2.0 * uShatBlockJitter;                      // per-block CONSTANT tilt — THE grad driver (chaos contract, FULL jitter amplitude, no extra scale)
  h    += amp * interior * blockH;
  grad += amp * interior * tilt;                                          // ★ MAGNITUDE-MATCH chaosCombiner :2387 (region*interior*tilt)
  // ── BORDER CREVASSE: F2−F1 distance carved DOWN with graben walls (reuse grabenProfile) ──
  float bd  = ff.y - ff.x;                                                // 0 at seam → grows inward
  vec2  gp  = grabenProfile(bd, uShatBorderWidth, 0.2);                   // depth∈[−1,0], gp.y = wall slope (flat-floor trench)
  h    += amp * uShatBorderDepth * gp.x;                                  // carve DOWN (gp.x ≤ 0)
  grad += amp * uShatBorderDepth * 0.9 * gp.y * vGrad;                    // ★ DEPTH×0.9 drives slope (F44 lesson; vGrad=∂(F1)/∂p=cell-edge dir)
  // ── OCTAVE 2: finer SUB-FRACTURE lattice within blocks (sells "reassembled", not "paved") ──
  vec3 sId, sGrad;
  vec2 sff = voronoi3d(shatQ * uShatSubFreq + vec3(41.2, -3.8, 9.5), uVoroCells, sId, sGrad);
  float subEdge = 1.0 - smoothstep(0.0, uShatBorderWidth*0.6, sff.y - sff.x);   // 1 at sub-seam
  h    += amp * interior * uShatSubAmt * (-subEdge) * 0.5;                // shallow sub-grooves inside blocks
  grad += amp * interior * uShatSubAmt * 0.9 * subEdge * sGrad;          // ★ sub-seam slope into grad (0.9 scale)
  // (Sub-octave is GATED by `interior` so sub-fractures live INSIDE blocks, not across the
  //  mega-borders — preserves the two-scale read. tesseraCombiner :2157 is the alt impl if
  //  Max wants ORIENTED crosscutting cracks instead of a 2nd voronoi octave; voronoi is the
  //  cheaper faithful default and matches the SPH/Voronoi fragmentation physics in §4.)
}
```
Notes: `voronoi3d` returns `grad = normalize(pos − center)` (:754) — the per-block tilt is an
EXACT constant grad (the F9 "cosmetic gradient" — flat plates each landing in their own
posterize band, UAT item 1), while the border + sub-seam ride that analytic ∂F1/∂p so the
crevasse walls light (UAT item 2). The mask defaulting to cover≈1 gives the global shattered
read; sweeping `uShatMaskCover` down recovers the masked-local-fracture-zone endmember with a
sharp seam against intact crust (UAT item 5).

### 6. Call site in the h/grad accumulator (after the F44 `hexCrust(vPos,h,grad);` line :2942)
```
shatterCombiner(vPos, h, grad);          // F45 — shattered/fractured crust (globalized two-octave chaosCombiner: voronoi3d mega-blocks w/ per-cell flat+tilt, F2−F1 graben crevasses, sub-fracture lattice; ADDITIVE on grad, F19 contract; gated by uShatStrength × region × provinceWeight(PROV_SHATTER))
```
Gating is internal (`uShatStrength<=0` early-out + region mask + provinceWeight), matching
every other combiner. Sits in the analytic-relief branch with the other exotics.

### 7. PROV define (=41) / arm / debug row
- GLSL define (planet-lod-lab.html, after PROV_HEXTESS=40 at :872):
  `const int PROV_SHATTER     = 41;  // F45 — neutral (crustal disruption, not geology): the shatter tiles the WHOLE crust (catastrophic-stress/surface-history-driven, planet-global), never gated by rock provinces (FROST-row pattern, like hexTess F44)`
- `provinceWeight` arm (after the PROV_HEXTESS arm at :930):
  `else if (fid == PROV_SHATTER)    { f = gProvince.z; fl = 1.00; }`
- PROVINCES row (planet-archetypes.js, after the `hexTess:` row :189):
  `shatter:    { field: 2, polarity: +1, floor: 1.00 },  // neutral — crustal disruption, not geology: the shattered-block field covers the whole crust (catastrophic-stress/surface-history-driven, planet-global), never gated by rock provinces (FROST-row pattern, like hexTess F44)`

### 8. FEATURES registry entry + archetype (planet-archetypes.js, after the `hexTess:` line :117)
`shatter:    { label: 'Shattered crust (F45)', enableKey: 'shatterEnabled', archetypes: ['exotic-shattered'] },`
AND add the new archetype to `ARCHETYPES` (:131, after `exotic-geometric`):
`'exotic-shattered':    { label: 'Exotic / shattered',     bodies: ['Miranda','Europa Conamara Chaos'], presets: ['Frozen (airless)'] },`
(Per the archetype recommendation above — F45 reads DISTINCT from F44's ordered paving.)

### 9. featureFolders entry (planet-lod-lab.html, the map at :6153)
Append to the `carbon: fCarbon, facets: fFacets, hexTess: fHex,` line: `shatter: fShat,`

### 10. GUI folder + sliders (in `fExoticGroup`, after the F44 `fHex` block ~:6083)
F44 LESSON: defaults under-read, so ranges must let the GOOD value sit MID-slider, not at an
edge (F44's walked default 1.6 fell below its original min of 3 → range had to be reopened).
```
const fShat = fExoticGroup.addFolder('Shattered crust (F45)'); fShat.close();
fShat.add(state, 'shatScale', 0.8, 8, 0.1).name('block density');        // walkable mid-low (default 1.6 sits ~mid)
fShat.add(state, 'shatBlockJitter', 0, 1.2, 0.01).name('block tilt/raise');  // the grad driver (default 0.6 mid)
fShat.add(state, 'shatBorderDepth', 0, 2.0, 0.01).name('crevasse depth');    // default 1.0 mid
fShat.add(state, 'shatBorderWidth', 0.04, 0.2, 0.005).name('crevasse width');
fShat.add(state, 'shatMaskCover', 0, 1, 0.01).name('coverage (zone→global)');  // intensity axis (default 1.0 = global)
fShat.add(state, 'shatMaskScale', 0.4, 3, 0.1).name('zone scale');
fShat.add(state, 'shatSubFreq', 1.5, 6, 0.1).name('sub-fracture freq');       // default 3.5 mid
fShat.add(state, 'shatSubAmt', 0, 1, 0.01).name('sub-fracture amt');          // default 0.4 mid — MUST be >0 default (UAT item 3)
fShat.add(state, 'shatterEnabled').name('✓ enabled');
```
NO 🎲 — the shatter domain is seeded off `uMacroOffset` (the world's identity; the Seeds
folder rerolls it). The `✓ enabled` controller is relocated into the folder header by the
existing controller-relocation pass.

### 11. GLSL_NAME test line (tests/planet-archetypes.test.js, after the `hexTess: 'PROV_HEXTESS',` entry ~:107)
Append: `shatter: 'PROV_SHATTER',`  (the drift-guard cross-checks FEATURES/PROVINCES/GLSL.)

### Preset decision — NO dedicated preset (v1), emissive crack term → v2
Per §5, rely on `'Frozen (airless)'` as the base (cold airless disrupted body — Miranda-like;
also the `exotic-shattered` archetype's preset). F44 skipped its preset; do the same — F45 has
no new driver physics (mask cover is a lab knob, not data-derived). **v1 SCOPE CUTS (log them):**
(a) the emissive "freshly-shattered hot-interior" crack term (added AFTER posterize, lava
Worley-crack bypass per §4) — defer to v2 unless trivial; (b) a dedicated 'Shattered (exotic)'
DRIVER_PRESETS entry — defer (trivial Frozen copy when the exotic types land).

### Verify hooks (map to §6 UAT checklist)
Live on :9223 (chrome-devtools GPU — NOT Playwright; memory/well-dipper-testing-reference.md):
- `window._lab.setPreset('Frozen (airless)')` then `window._lab.solo('shatter')`; `featureEnabled('shatter')`→true.
- **CORRECT isolation (NOT perturb≈0):** `perturb 0.55`, distance 8, `octAuto=false, octaves=1` to flatten base FBM; toggle `shatterEnabled` ON vs OFF → must CLEARLY differ (the magnitude-self-check proof, UAT items 1,2).
- **Distance sweep** (`state.distance`): 20 (global block patchwork, clean limb → items 4,6), 8 (border crevasses resolving → item 2), 3 (per-block tilt + sub-fracture lattice → items 1,3).
- **Two-scale check** (item 3): `shatSubAmt` 0 vs 0.4 → blocks must visibly SUBDIVIDE (0 reads like F44 paving; >0 reads "reassembled"). This is THE F44-distinguishing test.
- **Intensity axis** (item 5): `shatMaskCover` 0.3→1.0 → masked local fracture zone w/ sharp seam → globally shattered.
- **Posterize-survival** (item 6): mid-distance, adjacent blocks land in DIFFERENT posterize bands (not dither noise) — bump `shatBlockJitter` if they merge.
- **Determinism** (item 7): re-approach same seed → same plates, no drift.
- **F2 compose** (item 8): enable craters too → craters sit ON blocks, break at borders.
- **A/B regression:** `shatterEnabled` off → byte-identical pre-F45 render.
- `npm run` vitest → registration trio green (FEATURES + featureFolders + GLSL_NAME).

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- **Rating: 🟡** (ships; one taste-call for Max — see below). Live-verified on :9223 GPU Chrome, `Frozen (airless)` + `solo('shatter')`, perturb 0.55, octAuto=false/octaves=1, distance sweep 20/8/3. ZERO console errors throughout. ON/OFF A/B at d8 = a HUGE, unmistakable delta (OFF = smooth dithered sphere w/ soft gradient; ON = surface broken into irregular angular plates with dark carved crevasse borders) — the F44 invisible-feature trap is NOT present, the relief lights correctly.
  - UAT 1 (discrete rigid plates) ✓ — at d3 plates read as flat/uniformly-tilted tops, each in its own posterize/lighting band.
  - UAT 2 (carved-DOWN crevasses) ✓ — inter-block fractures are dark shadowed cliff-walled grooves; hold through the terminator.
  - UAT 3 (TWO scales — the F44 distinguisher) ✓ *only after retune.* At build defaults (subFreq 3.5 / subAmt 0.4) the second scale was nearly INVISIBLE at d3 — read like a handful of big plates (F44-paving risk). Walked to subFreq 5.0 / subAmt 0.7 → the within-block crack lattice is clearly readable, surface reads "violently reassembled." (subAmt 1.0 / freq 6.0 = over-fractured mush.)
  - UAT 4 (clean limb at 20 radii) ✓ — limb stays a clean sphere; surface chunking arrives as relief/lighting, not albedo. NOTE: at distance 20 the disc renders very small (~100px), so the global-province-patchwork read is hard to *judge* at that framing — the chunking is clearly present but the "Miranda mismatched-province" gestalt is most legible at d3–d8. (Not a defect; a framing limitation of the lab's radii units.)
  - UAT 5 (intensity axis) ✓ — `shatMaskCover` sweep: 0.3 = mostly-intact crust w/ a subtle local fracture zone; 0.6 = clear partial shattering with a seam against intact crust; 1.0 = globally shattered. Behaves as designed.
  - UAT 6 (posterize survival at mid) ✓ — at d8 adjacent blocks land in different posterize bands; crevasse borders survive quantization, not dither mush.
  - UAT 7 (deterministic on re-approach) ✓ — far→re-solo→close cycle produced a PIXEL-IDENTICAL render. No temporal drift.
  - UAT 8 (compose w/ F2 craters) ✓ — craters sit ON the plates as bowl depressions while the fracture network still structures the surface; two distinct relief types coexist plausibly, craters do not float as an unrelated layer.
- **Max's taste-call (the 🟡):** the d3 read leans toward "few big plates + fine cracks." Confirm the mega-block COUNT/size at the new sub-settings is the "violently reassembled patchwork" you want, vs. wanting MORE mega-provinces (bump `shatScale` from 1.6) or a stronger province-mismatch in albedo. The relief mechanism is sound; this is purely a density/look preference.
- **Tweaks applied (defaults baked into `planet-lod-lab.html`):**
  - `shatSubFreq` 3.5 → **5.0** (state init :4453, uniforms init :3853).
  - `shatSubAmt` 0.4 → **0.7** (state init :4454, uniforms init :3854).
  - GUI `shatSubFreq` slider max widened 6 → **7** (:6195) so the walked 5.0 sits mid-high, not at the edge (F44 range lesson). `shatSubAmt` slider range unchanged (0.7 sits comfortably in 0–1).
  - No other defaults changed — shatScale 1.6, shatBlockJitter 0.6, shatBorderDepth 1.0, shatBorderWidth 0.10, shatMaskScale 1.1, shatMaskCover 1.0 all read well as-shipped.
- **Re-verify:** none blocking. The d20 global-province read couldn't be fully *judged* due to small-disc framing (chunking confirmed present); judge the patchwork gestalt at d3–d8. If Max wants more provinces, walk `shatScale` (no code change, slider already covers 0.8–8).
- Status: VERIFIED_PENDING_MAX (pending sha)
