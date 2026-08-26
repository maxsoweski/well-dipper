# Feature Card — F46 Bioluminescent / fungal mats
Domain: Overlay · Lab status: ⬜(lab) · Build-seq phase: 4c

## 1. Description (WHAT)

Bioluminescent / fungal mats — a living surface coating that emits its own light, the F-overlay realization of process P27 "Biospheric colonization" (a surface biosphere spreading across habitable terrain, driven by drivers D15 + D16 along the L1c biotic/technogenic track). It is NOT a geomorphic landform: it has no L0→L1→L2 formation chain of its own — it composites OVER a natural base planet (terrestrial or ocean) whose own oceans/weather/relief still show through where the mat doesn't cover. Variants follow biosphere maturity: sparse glowing patches → coalescing reticulated colonies → a planet-spanning living mat. WD type: `fungal` (EXOTIC), F46 over a terrestrial/ocean base. No confirmed real exoplanet examples (speculative game-construct); terrestrial analogs are dinoflagellate bio-bays (Mosquito Bay) and forest-floor foxfire/mycelial glow. The defining behavior is self-emission visible on the unlit/night side — like F48 city lights and F37 aurora, it lives in the emissive channel, not the albedo.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). The L2 table's "[current] (bioluminescent spots)" refers to a legacy main-game stand-in, NOT the lab — F46 has no implementation in world-engine-lab.html. There is only a reserved owner-slot comment in the emissive composite-split (world-engine-lab.html:1574: "city lights F48/49, bioluminescence F46, aurora Optical F37, sunglint Optical F36"). planet-archetypes.js FEATURES (lines 6-22) contains only geomorphic keys (craters…rivers) and no fungal/bio key, so the per-feature solo system can't target it. Nearest existing machinery it should plug into: the post-posterize EMISSIVE BYPASS channel (world-engine-lab.html:1572-1597) — specifically the aurora night-side term (lines 1589-1595) is the ready-made template, since it already combines a spatial mask (ringMask), a night-visibility gate (nightMask = smoothstep(0.1,-0.1,diff), line 1592), animated noise, and a colored emissive added AFTER the quantizer (line 1597). F46 = swap the aurora's latitude ring for a biosphere coverage mask, keep the night gate and the bypass-add. Driving uniforms would mirror uAuroraIntensity (line 1618) / uEmissive (1611) / uEmissiveBypass (1614); GUI home is the Envelope folder (lines 2126-2134).

## 3. Reference images (real + art)

- [real] https://en.wikipedia.org/wiki/Puerto_Mosquito
  — Dinoflagellate bio-bay: blue-green glow concentrated in patches, triggered by agitation — note glow lives in darkness against an otherwise dark surface, the night-side emissive read we want.
- [real] https://www.wxpr.org/natural-resources/2020-08-31/foxfire-and-bioluminescent-fungi
  — Foxfire / mycelial glow on the forest floor — yellowish-green, patchy reticulated coverage following decaying matter, the 'colonies coalescing into a mat' spatial pattern.
- [real] https://www.atlasobscura.com/articles/the-magic-of-mushrooms
  — Glowing mushrooms only read in the dark — confirms the feature must be Lambert-independent emissive gated to the unlit hemisphere, not an albedo tint.
- [real] https://svs.gsfc.nasa.gov/gallery/earthat-night-imagery/
  — NASA Earth-at-Night (VIIRS Black Marble): the exact rendering analog — discrete emissive patches over the dark hemisphere; study how coverage clusters and fades to nothing, the F46 coverage-mask target.
- [art] https://nomanssky.fandom.com/wiki/Lepios
  — NMS exotic bioluminescent planet (purple/green glowing flora) — palette and 'whole-biome glows' density target for the planet-spanning-mat variant.
- [art] https://www.thegamer.com/no-mans-sky-nms-all-planet-types-explained/
  — NMS Exotic-biome design language: bioluminescent flora as an overlay identity on otherwise calm worlds — confirms base-planet-plus-glow-overlay framing.

## 4. Math / modeling notes (HOW, from the field)

The field doesn't model bioluminescent mats as a landform — there's no geomorphology equation. It's modeled in two decoupled parts: (1) SPATIAL COVERAGE — a biological-distribution mask driven by biosphere maturity (P27, drivers D15/D16). Procedurally this is the same toolkit the research doc already uses elsewhere: a thresholded domain-warped FBM coverage field (research §3.2 warp; the ejecta patchMask at world-engine-lab.html:760-785 is the in-repo precedent — "continuous near a center, breaking into patches outward"), optionally Worley/Voronoi F2−F1 (research line 103/75) to give discrete colony cells with crisp edges, and thresholded warped-noise contours for the reticulated mat veining (the "fake-Turing" workaround, research line 108, deterministic — avoid true reaction-diffusion since ping-pong breaks re-approach determinism). A single coverage scalar lerps sparse-patches → planet-spanning-mat. (2) EMISSION — model the glow as a Lambert-independent emissive term that BYPASSES the 6-level posterize, added after the quantizer exactly like the lava Worley-crack pulse (research line 103) and the aurora term (world-engine-lab.html:1597). This is squarely research §2.C Option-C ("emissive + specular get their own channel that skips the clamp"; lines 54-57): albedo glow gets crushed by the Bayer-on-luminance posterize, crisp emissive glow survives. Gate it to the dark hemisphere with the existing nightMask = smoothstep(0.1,-0.1,diff) so the mats appear as the terminator sweeps, and optionally animate with a slow noised() pulse for a living shimmer. MOST PROMISING APPROACH: clone the aurora term — replace its latitude ringMask with a domain-warped-FBM coverage mask (one threshold = colony patches, raise it toward 1.0 for full-mat coverage), keep the nightMask gate and a colored emissive added post-posterize via the bypass path. Add Worley F2−F1 cell edges only if discrete colony rims read better than soft patches under the 4×4 dither. Zero new pipeline — it reuses the emissive-bypass split already wired for lava/aurora/city-lights.

## 5. Isolation recipe (:9223)

Unbuilt — recipe to use once built. (1) Add a feature key to planet-archetypes.js FEATURES, e.g. `bioMats: { label:'Bioluminescent mats (F46)', enableKey:'bioMatsEnabled', archetypes:['tectonic-terrestrial'] }`, and register its folder in featureFolders (world-engine-lab.html:2515) so the Body-filter per-feature solo (setFeatureEnables, line 2539) can isolate it. (2) Implement the term as an aurora-style emissive clone added at world-engine-lab.html:1597, with a uBioCoverage uniform and a uBioMatsEnabled gate. (3) To solo: open the Body filter folder, choose solo → `bioMats` (or call setFeatureEnables('bioMats')); base preset = 'Ocean (temperate)' or 'Rocky (Earthlike)' (the habitable bases F46 overlays); turn the Envelope folder's "emissive bypass quantizer" ON. (4) Distances via window._lab.state.distance: ~3 radii to read patch DISTRIBUTION across the disk (sparse-vs-mat), then ~1.3 radii to inspect patch EDGES + glow crispness under the posterize. (5) Set state.spinSpeed > 0 to sweep the terminator and confirm the mats light up only on the night side, like the aurora. Sweep uBioCoverage 0→1 to walk the sparse-patches → planet-spanning-mat variant ladder.

## 6. What to judge (UAT checklist)

- [ ] Does it read as SELF-EMISSION (glowing in darkness) rather than a lit albedo tint, when the terminator sweeps in the 6-level posterized envelope? It must survive on the night side like aurora/city-lights, not vanish into the dark buckets.
- [ ] Does the coverage read as biological PATCHES/colonies — clustered, irregular, organically reticulated — rather than a uniform wash or an obvious noise grid, after the 4×4 Bayer dither?
- [ ] Does sweeping the coverage driver read as a believable maturity ladder: sparse isolated patches → coalescing colonies → a planet-spanning mat, with each stage still legible as form (not just brightness) under posterization?
- [ ] Does the glow stay CRISP (bypassing the quantizer) instead of banding into stair-stepped emissive rings the way a pre-posterize glow would?
- [ ] Does it read as an OVERLAY — does the natural base planet (oceans, relief, terminator) still show through where the mat doesn't cover, rather than the mat replacing the whole surface?
- [ ] Does the emissive color read as bioluminescent (blue-green / yellow-green palette) and distinct from the lava-orange and city-light-white emissive owners sharing the same channel?
- [ ] If animated, does the pulse read as a slow living shimmer rather than a distracting flicker amplified by the dither?

## 6.5 Build plan (HOW to build it)

Strategy: §4's "most promising approach" verbatim — clone the **F37 aurora term**
(world-engine-lab.html:3746-3777, inside the `if (uAuroraIntensity > 0.0)` block ending at the
final composite-add :3779), swap its latitude `ringMask` for a **domain-warped-FBM biosphere
coverage mask**, keep the `nightMask` gate and the **post-posterize emissive-bypass add** (the
canonical Option-C survivor — F8 lava cracks live at :3516, the exact insertion neighbour).
F46 is an **emissive OVERLAY**, never relief: it writes a `vec3 bioC` added to `gl_FragColor`,
never touches `h`/`grad`/the analytic-normal accumulator. Zero new pipeline — reuses the
emissive-bypass channel already wired for lava/aurora/city-lights.

**⚠️⚠️ ALL LINE NUMBERS BELOW ARE LIVE-VERIFIED (grep'd 2026-06-13).** The card's §2/§5 cite
:1572/:1611/:2126/:2515/:2539 — ALL STALE by ~1200+ lines; ignore them. Use these.

**GLSL prefix discipline: `bio`.** All locals + uniforms use `uBio*` / `bio*`. `bio` collides
with no GLSL reserved word and is clear of the traps. A reserved-word/identifier collision
blacks out the WHOLE lab with a shader-compile error no static check catches.

**EDIT ONLY** `world-engine-lab.html`, `planet-archetypes.js`, `tests/planet-archetypes.test.js`,
this card. NEVER touch `src/`, `docs/NOW.md`. Stage explicit paths only — never `git add -A`
(a parallel warp session shares the tree).

### ⚠️ PROV DECISION — A PROV ID *IS* REQUIRED (the overlay-needs-no-PROV hypothesis is FALSE)
Registering `bioMats` in `FEATURES` (required so the per-feature solo system can target it,
card §5) DRAGS THE FULL PROV TRIO ALONG, enforced by `tests/planet-archetypes.test.js`:
- `:122-123` — `Object.keys(PROVINCES)` MUST `.toEqual` `Object.keys(FEATURES)` → every FEATURES
  key needs a PROVINCES row.
- `:143-148` — every non-ejecta FEATURES key needs a matching GLSL `provinceWeight` if-arm.
**Precedent: F37 aurora is ALSO an overlay and carries `PROV_AURORA=35` as a NEUTRAL row** (the
FROST-row pattern: `f=gProvince.z; fl=1.00`, never gated by rock provinces). So F46 follows
aurora exactly: **`PROV_BIOMATS=42`, neutral**, AND the cloned bio term multiplies by
`provinceWeight(PROV_BIOMATS)` (as the aurora term does at :3773). This is the single biggest
trap — skipping the PROV row fails 3 vitest assertions.

### Uniform list (4 new — type · default · the THREE registration sites)
| uniform | type | default | rationale |
|---|---|---|---|
| `uBioCoverage` | `float` | `0.0` | master gate + intensity axis (0 = off / sparse, →1 = planet-spanning mat). Sole owner = writer; gates the GLSL early-out. |
| `uBioColor` | `vec3` | `(0.30, 0.95, 0.55)` | bioluminescent blue-green (distinct from aurora green-teal `(0.3,0.9,0.5)`, lava-orange, city-white). |
| `uBioScale` | `float` | `2.4` | coverage-FBM frequency (patch size). |
| `uBioIntensity` | `float` | `0.7` | glow gain (the aurora `*0.8` analog). |
Each touches THREE places: (a) GLSL `uniform` decl, (b) THREE `uniforms` object, (c) per-frame writer.

### Edit sites (ordered; REAL line numbers, all in world-engine-lab.html unless noted)
1. **GLSL uniform decls** — `world-engine-lab.html:185` (after the F37 `uMagAxis;` line :185, before
   `uTime`): add the 4 `uBio*` decls (`uniform float uBioCoverage;` `uniform vec3 uBioColor;`
   `uniform float uBioScale;` `uniform float uBioIntensity;`), commented `// F46 bioluminescent mats`.
2. **PROV define** — `world-engine-lab.html:895` (after `PROV_SHATTER = 41` :895):
   `const int PROV_BIOMATS = 42; // F46 — neutral (biosphere coverage, not geology): the mat spreads over habitable terrain (life-/coverage-driven, planet-global), never gated by rock provinces (FROST-row pattern, like aurora F37)`
3. **provinceWeight arm** — `world-engine-lab.html:954` (after the `PROV_SHATTER` arm :954):
   `else if (fid == PROV_BIOMATS)    { f = gProvince.z; fl = 1.00; }`
4. **The bio emissive term** — `world-engine-lab.html:3516` insertion point: add the `bioC` block
   (GLSL below) immediately AFTER `emissive += lavaCrackEmissive(vPos) * (1.0 - mgSeaMask);` :3516
   (same post-posterize bypass region as lava cracks). Then add `bioC` to the final composite at
   **:3779**: change `... + cloudC + auroraC` → `... + cloudC + auroraC + bioC`.
5. **THREE uniforms object** — `world-engine-lab.html:3815` (after the F37 `uAuroraRingWidth` entry
   :3815, alongside `uMagAxis` :3816): `uBioCoverage:{value:0.0}, uBioColor:{value:new THREE.Color(0.30,0.95,0.55)}, uBioScale:{value:2.4}, uBioIntensity:{value:0.7}` — comment each `// F46 inert behind uBioCoverage 0`.
6. **State-init defaults** — `world-engine-lab.html:4423` (after the F37 `magAxis` line :4423):
   `bioMatsEnabled: true,  // F46 enable gate — off zeroes uBioCoverage at the writer (bioC vec3(0) exactly)`
   `bioCoverage: 0.45,  bioColor: [0.30, 0.95, 0.55],  bioScale: 2.4,  bioIntensity: 0.7,`
   (STARTING guesses — walk live per Verify hooks before baking finals.)
7. **Per-frame uniform writer** — `world-engine-lab.html:6474` (after the F37 `uMagAxis` writer :6474,
   before `uProvinceWeight` :6475):
   ```
   // F46 bioluminescent mats — bioMatsEnabled gates coverage→0 (the bio block is guarded on
   // uBioCoverage > 0, so one gate skips the whole bypass term: bioC = vec3(0) exactly). Sole F46 write site.
   uniforms.uBioCoverage.value  = state.bioMatsEnabled ? state.bioCoverage : 0.0;   // ✓ enable gate
   uniforms.uBioScale.value     = state.bioScale;
   uniforms.uBioIntensity.value = state.bioIntensity;
   uniforms.uBioColor.value.setRGB(state.bioColor[0], state.bioColor[1], state.bioColor[2]);
   ```
8. **GUI bindings (Envelope folder = `fEnv`)** — `world-engine-lab.html:4730` (after the
   `emissiveBypass` toggle :4730, the last Envelope line). The Envelope folder is the GUI home
   per the card (NOT a new relief folder):
   ```
   // ▸ Bioluminescent mats (F46) — emissive-bypass overlay (night-side biosphere glow). NO 🎲
   // (coverage domain is seeded off uMacroOffset; the Seeds folder rerolls it).
   fEnv.add(state, 'bioCoverage', 0, 1, 0.01).name('bio coverage (patch→mat)');  // intensity axis, default 0.45 mid
   fEnv.add(state, 'bioScale', 0.8, 6, 0.1).name('bio patch density');           // default 2.4 mid
   fEnv.add(state, 'bioIntensity', 0, 1.5, 0.01).name('bio glow');               // default 0.7 mid
   fEnv.addColor(state, 'bioColor').name('bio color');
   fEnv.add(state, 'bioMatsEnabled').name('✓ bio mats enabled');
   ```
   The literal `.add(state, 'bioMatsEnabled')` is REQUIRED — the test derives `panelEnableKeys`
   by regex `/\.add\(state, '(\w+Enabled)'\)/` (test :15-16); without it, FEATURES↔panel fails (:28-31).
9. **featureFolders entry** — `world-engine-lab.html:6267` (the map; append to the
   `carbon: fCarbon, facets: fFacets, hexTess: fHex, shatter: fShat,` line :6267): add `bioMats: fEnv,`.
   This routes the per-feature solo + `relocateEnableToTitle` (:6275-6286) onto the Envelope folder.
   `setFeatureEnables` (:6288) needs NO new case — it iterates `FEATURES` generically, flipping
   `state.bioMatsEnabled`. ⚠️ Note: `bioMats: fEnv` means the bio enable controller gets relocated
   into the *Envelope* folder title and the solo 🔆 button is appended to Envelope — acceptable
   (Envelope is the intended home), but confirm at live-verify the Envelope title doesn't break.
10. **FEATURES registry** — `planet-archetypes.js:126` (after the `shatter:` row :126):
    `bioMats:    { label: 'Bioluminescent mats (F46)', enableKey: 'bioMatsEnabled', archetypes: ['tectonic-terrestrial'] },`
11. **PROVINCES row** — `planet-archetypes.js:200` (after the `shatter:` row :200):
    `bioMats:    { field: 2, polarity: +1, floor: 1.00 },  // neutral — biosphere coverage, not geology: the mat spreads over habitable terrain (life-/coverage-driven, planet-global), never gated by rock provinces (FROST-row pattern, like aurora F37)`
12. **GLSL_NAME test entry** — `tests/planet-archetypes.test.js:108` (after `shatter: 'PROV_SHATTER',` :108):
    `bioMats: 'PROV_BIOMATS',`  (the drift-guard cross-checks FEATURES/PROVINCES/GLSL.)

### The bio emissive term GLSL (insert at world-engine-lab.html:3516, after the lava-crack add)
Clones the aurora term's structure (mask × nightMask × intensity × provinceWeight, added
post-posterize). Coverage mask = thresholded domain-warped FBM (the ejecta patchMask idiom
:1931 + lava-crack warp idiom :2296-2301), reticulated "fake-Turing" veining = a thresholded
warped-noise contour band (deterministic — NO ping-pong reaction-diffusion). `noised` :727,
`voronoi3d` :776, `hash33` :768 are the available helpers.
```
// ★ F46 bioluminescent / fungal mats — emissive OVERLAY (NOT relief): a night-side biosphere
// glow added AFTER the quantizer (Option-C bypass survivor, like lava cracks above / aurora).
// Coverage = thresholded domain-warped FBM (sparse patches → planet-spanning mat as uBioCoverage→1);
// reticulated veining = thresholded warped-noise contour (deterministic fake-Turing, NO ping-pong);
// gated to the dark hemisphere by nightMask + slow noised() shimmer. uBioCoverage 0 ⇒ bioC = vec3(0).
vec3 bioC = vec3(0.0);
if (uBioCoverage > 0.0) {
  // domain warp (lava-crack idiom :2296) so colonies meander, not a noise grid
  vec4 bw1 = noised(vPos * (uBioScale*0.6) + uMacroOffset + vec3(5.2, 18.7, -9.3));
  vec4 bw2 = noised(vPos * (uBioScale*0.6) + uMacroOffset + vec3(-12.1, 3.4, 7.8));
  vec3 bwPos = vPos + 0.35 * vec3(bw1.x, bw2.x, bw1.y);
  // coverage FBM → patch mask; raising uBioCoverage lowers the threshold (patches grow & merge)
  float bfbm = 0.5 + 0.5 * noised(bwPos * uBioScale + uMacroOffset).x;
  float thresh = mix(0.72, 0.08, uBioCoverage);                 // high thresh = sparse, low = full mat
  float patch  = smoothstep(thresh, thresh + 0.18, bfbm);       // soft colony patches
  // reticulated veining — thresholded contour of a 2nd warped noise = "fake-Turing" net (deterministic)
  float vein01 = 0.5 + 0.5 * noised(bwPos * (uBioScale*2.3) + uMacroOffset + vec3(31.0,-4.0,12.0)).x;
  float veins  = 1.0 - smoothstep(0.0, 0.10, abs(vein01 - 0.5)); // bright on the iso-0.5 contour ridges
  float mat    = patch * mix(0.55, 1.0, veins);                 // veins brighten within colonies
  // night gate (the aurora nightMask :3752) + slow living shimmer (aurora flicker :3771)
  float nightMask = 1.0 - smoothstep(-0.1, 0.1, diff);
  float shimmer   = 0.75 + 0.25 * noised(vec3(bwPos.xy * 1.5, uTime * 0.06)).x;
  float bio = mat * nightMask * shimmer * uBioIntensity * provinceWeight(PROV_BIOMATS);
  bioC = uBioColor * clamp(bio, 0.0, 1.0);
}
```
OPTIONAL upgrade if soft patches read mushy under the 4×4 dither (defer unless needed): swap the
veining for a Worley **F2−F1** edge — `voronoi3d(bwPos*uBioScale*2.0, uVoroCells, id, g)` then
`1.0 - smoothstep(0.0, 0.08, ff.y - ff.x)` for crisp colony-cell rims (the lava-crack mask idiom
:2303-2304). Single-octave noise contour is the cheaper faithful default; add Worley only if UAT
item 2 (organic reticulation) fails.

### Suggested defaults (will be tuned at live-verify — these are starting guesses)
- `bioCoverage 0.45` — mid-slider so the patch→mat sweep is exercisable both directions; 0.45 reads
  as coalescing colonies (the headline maturity stage), not yet full mat.
- `bioIntensity 0.7` — below aurora's effective `0.8` mean so it doesn't blow out; slider 0–1.5
  leaves headroom (default sits mid-low, the F44 range lesson).
- `bioColor (0.30, 0.95, 0.55)` — blue-green, nudged greener/bluer than aurora's `(0.3,0.9,0.5)`
  and far from lava-orange / city-white (UAT item 6 distinctness). For yellow-green foxfire try
  `(0.55, 0.95, 0.35)` at live-verify.
- `bioScale 2.4` — patches read as continent-fraction colonies at 1.3–3 radii; slider 0.8–6.

### Test line (verbatim — matches the existing GLSL_NAME pattern)
In `tests/planet-archetypes.test.js`, after `shatter: 'PROV_SHATTER',` (:108), append:
```
  bioMats: 'PROV_BIOMATS',
```
This satisfies all three guards: FEATURES↔panel-enable (:28), PROVINCES↔FEATURES key-equality
(:122-123), and PROVINCES↔GLSL accessor mirror (:143-148). Run `npx vitest run
tests/planet-archetypes.test.js` → must stay green.

### Verify hooks (map to §6 UAT checklist; live on :9223 GPU Chrome — NOT Playwright)
- `window._lab.setPreset('Ocean (temperate)')` (or `'Rocky (Earthlike)'`) then
  `window._lab.solo('bioMats')`; `featureEnabled('bioMats')` → true. Turn Envelope's "emissive
  bypass quantizer" ON.
- **Self-emission / crisp / overlay (items 1,4,5):** `state.spinSpeed > 0` to sweep the terminator
  → mats light ONLY on the night side; base ocean/relief shows through where coverage < 1.
  Bypass ON vs OFF → glow stays smooth vs bands into emissive stair-steps.
- **Maturity ladder (item 3):** sweep `state.bioCoverage` 0→1 at distance ~3 → sparse patches →
  coalescing colonies → planet-spanning mat; each stage legible as FORM, not just brightness.
- **Reticulation (item 2):** distance ~1.3 → veining reads organic/net-like, not a noise grid.
  If mushy under dither, apply the Worley F2−F1 upgrade above.
- **Color distinctness (item 6):** enable lava emissive + city lights simultaneously → bio
  blue-green reads distinct from orange/white.
- **Shimmer (item 7):** confirm slow pulse, not dither-amplified flicker.
- **Determinism:** re-approach same seed → identical patches (domain-offset convention, uMacroOffset).
- **A/B regression:** `bioMatsEnabled` off → byte-identical pre-F46 render.
- `npx vitest run tests/planet-archetypes.test.js` → registration trio green.

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- **Rating: 🟢 (ships as-is).** Live-verified on :9223 GPU Chrome (dpr 1.25, innerW 1402 — sane, no zoom trap). Zero console errors/warnings across the whole session. All 7 §6 UAT items pass; the build-plan starting-guess defaults (`bioCoverage 0.45 / bioScale 2.4 / bioIntensity 0.7 / bioColor (0.30,0.95,0.55)`) held up under live judgment and needed NO tuning.

  **ON/OFF delta — bypass-add CONFIRMED firing.** Same camera (Rocky base, solo `bioMats`, emissive-bypass ON, night-side yaw 3.4, dist 3, cov 0.45): ON = dark hemisphere filled with green reticulated mats; OFF (`bioMatsEnabled=false` → `uBioCoverage` writer zeroes to 0) = night side goes essentially black, only the lit day-crescent rim remains. Not identical → the overlay is real. Shots `F46-on.png` / `F46-off.png`.

  **Night-side-only gate — CONFIRMED under terminator sweep.** `spinSpeed=0.01` rotated the body; mats stay confined to the dark hemisphere and fade out cleanly at the terminator, the lit crescent carries NO glow (shots `F46-terminator-sweep.png`, `F46-sweep-dayside.png`). nightMask gate tracks the terminator exactly like aurora.

  **Per-UAT-item verdict (from screenshots, not readPixels):**
  1. Self-emission survives posterize — PASS. Glows in darkness on the night side under the 6-level quantizer; does not vanish into dark buckets.
  2. Biological patches/colonies, not a wash/grid — PASS. Clustered, irregular, reticulated veining reads organic (the domain-warped FBM + fake-Turing contour); no visible noise grid after the 4×4 Bayer. Worley F2−F1 upgrade NOT needed.
  3. Maturity ladder — PASS. cov 0.15 = sparse isolated colonies (`F46-ladder-cov15.png`), 0.45 = coalescing reticulated colonies (headline), 0.85 = planet-spanning mat (`F46-ladder-cov85.png`). Each stage legible as FORM, not just brightness.
  4. Crisp glow, no stair-step rings — PASS. At ~1.35–1.7 radii (`F46-near-crisp-cov45.png`, `F46-near-edge-cov45.png`) edges are smooth gradients; Bayer shows as fine stipple in mid-tones but the glow does NOT band into concentric emissive rings — the post-quantizer bypass is doing its job.
  5. Reads as OVERLAY — PASS. Base relief / lit day side / terminator all show through where coverage < 1 (clearest at cov 0.15 and on the day crescent); the mat composites over, never replaces, the base.
  6. Bioluminescent color distinct from lava-orange / city-white — PASS. `uBioColor (0.30,0.95,0.55)` reads unambiguously blue-green in every night shot; far in hue from lava-orange and city-white. (Co-enabled lava `emissive=1` washed the scene via the global emissive gain — `F46-color-vs-lava.png` is muddy from that exposure bump, NOT a bio-color failure; distinctness judged from hue separation + the clean green read in all other shots.)
  7. Slow living shimmer, not dither flicker — PASS. `shimmer = 0.75 + 0.25*noised(uTime*0.06)` (slow time-scale, gentle 0.25 amplitude); during the live spin sweep the glow was stable, no dither-amplified flicker.

- Max's feedback: (pending — UAT)

- **Tweaks applied: NONE.** All `state.*` defaults and GUI slider ranges shipped from the build plan verified correct at live-verify — no walk-up needed. Slider ranges (`bioCoverage 0–1`, `bioScale 0.8–6`, `bioIntensity 0–1.5`) all have the good value comfortably mid-range, not at an edge. Did NOT edit `world-engine-lab.html`.

- **Re-verify:** N/A (no tweaks to re-check). Confirmed the GUI bindings landed in the Envelope folder as designed (bio coverage / patch density / glow / color / ✓ bio mats enabled all present and editing live; the Envelope folder title did not break per the §6.5-step-9 watch-item). Restored lab to clean defaults (cov 0.45, enabled) after testing.

- **Build note:** one fix cycle — the GLSL local `float patch` blacked the whole lab (`'patch' : Illegal use of reserved word`; `patch` is a GLSL ES 3.00 reserved word, already documented at the dust-storm `dustPatch` precedent). Renamed `patch`→`bioPatch`; shader then compiled clean (zero console errors). Code-review had checked `mat` but missed `patch`; the live load was the only test that caught it (no static check does).

- **Status:** `VERIFIED_PENDING_MAX 1afe4ec`
  Shots in `docs/FEATURES/cards/shots/` (gitignored, not committed): `F46-on.png`, `F46-off.png`, `F46-terminator-sweep.png`, `F46-sweep-dayside.png`, `F46-ladder-cov15.png`, `F46-ladder-cov85.png`, `F46-near-crisp-cov45.png`, `F46-near-edge-cov45.png`, `F46-color-vs-lava.png` (+ probe shots `F46-probe-*`).
