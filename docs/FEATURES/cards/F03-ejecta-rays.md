# Feature Card — F03 Ejecta & rays
Domain: Relief · Lab status: ✅ · Build-seq phase: 3

## 1. Description (WHAT)

F3 "Ejecta & rays" (Relief domain) — the debris an impact throws outward, wrapped around the F2 craters it came from. Derives from P1 Impact cratering (impactors gouge bowls, throw ejecta; crater density = surface age), which is driven by D11 surface-history (bombardment flux), D14 mass/gravity (sets blanket scale), D5 atmosphere density (thick air burns small impactors and weathers rays away), and D2 volatileFraction (ground ice fluidizes ejecta), accumulating over D16 age. Variants per the inventory: continuous blanket near the rim · discontinuous patches outward · rampart (fluidized icy/wet ejecta ending in a lobate terminal ridge) · bright ray system (airless-only, young craters) · secondary crater fields. Real-body examples: Tycho's 1,500-km bright rays (Moon), Hokusai's planet-girdling rays (Mercury), double-lobe rampart craters (Mars, e.g. Acidalia Planitia). WD types: rocky, ice, terrestrial, machine, crystal (the inventory row's `[aspirational]` tag predates the Stage-C build — campaign tracker now marks F3 ✅ built).

## 2. Current shader approach (HOW, as-built)

BUILT in world-engine-lab.html (Stage-C step 3, Relief). Two pieces: (1) RELIEF — `ejectaProfile(r, rampart, rOuter)` at world-engine-lab.html:744-755 (transcribed from planet-lod-lab-core.js:215-227, vitest-pinned analytic dh/dr): apron lives in 1<r<2.5 crater radii, blending a normalized 1/r² dry skirt (rampart=0) with a gaussian lobate terminal ridge at r=2.0 (rampart=1). `ejectaCombiner()` at :766-787 WRAPS the same F2 voronoi3d cells — identical uCraterScale/uCraterOffset/host-gate/hashed-radius — so the apron rings the F2 craters exactly; an FBM lumpiness (uEjectaLump) × a discontinuous patch mask (continuous near rim, breaking into patches outward via smoothstep(1.2,2.2,r)) makes it read as broken ejecta, not a smooth donut; radial slope is chain-ruled exactly, lump gradient comes from noised()'s analytic grad. Called in the relief accumulation at :1502. (2) ALBEDO EXCEPTION — `rayField()` at :796-812: high-albedo radial streaks from a stable per-crater basis (e1,e2), `pow(0.5+0.5*sin(az*uRayCount+phase), uRaySharp)` streaks windowed radially smoothstep(1.0,1.3,r)·(1−smoothstep(2.0,6.0,r)); added to the lit surface BEFORE posterize at :1536-1538 (sunlit-only via ×diff) with enough amplitude to cross a quantization band. Uniforms at :189-196 (uEjectaStrength/Rampart/Amp/Lump, uRayBrightness/Count/Sharp), defaults :1636-1643, frame-loop writes with ✓-enable gate :2699-2705. Driver derivation in planet-lod-lab-core.js:619-632: ejectaStrength = craterDensity (apron exists wherever craters do); ejectaRampart = smoothstep(0.15, 0.4, volatileFraction) (D2 rock↔ice axis); rayBrightness = clamp01(1−erosion) × (hasAtmo ? 0 : 1) (airless × young gate). GUI folder 'Ejecta & Rays (F3)' under Relief at world-engine-lab.html:2308-2316. Registered in planet-archetypes.js:8 — key `ejecta`, enableKey `ejectaEnabled`, archetype `impact-airless`. Documented carry-forward limitation (:794-795): rays truncate at Voronoi cell boundaries, while a real ray system overruns its cell.

## 3. Reference images (real + art)

- [real] https://apod.nasa.gov/apod/ap010809.html
  — Tycho and Copernicus full-disk view — ray systems read as long bright radial spokes at planetary distance, the exact scale our full-disk rayBrightness must carry.
- [real] https://science.nasa.gov/photojournal/ejecta-in-tycho-crater/
  — LRO close-up of Tycho ejecta — near-rim blanket is rough and continuous, breaking into ragged patches outward (our patch-mask behavior).
- [real] https://science.nasa.gov/resource/the-impressive-rays-of-hokusai/
  — Hokusai on Mercury — rays from one young crater overrun huge distances and cross older terrain, the behavior our Voronoi-cell truncation currently clips.
- [real] https://www.jpl.nasa.gov/images/pia01330-fluidized-crater-ejecta-deposit/
  — Mars double-lobe rampart crater — fluidized ejecta ends in a raised lobate terminal ridge, not a fading skirt; the silhouette our rampart=1 gaussian ridge targets.
- [real] https://www.lpi.usra.edu/publications/slidesets/redplanet2/slide_27.html
  — LPI rampart-crater slide (22N,34W) — note the ejecta margin standing HIGHER than the mid-apron, the inverted radial profile that distinguishes rampart from dry.
- [real] https://apod.nasa.gov/apod/ap081103.html
  — MESSENGER rayed crater on Mercury — discrete countable spokes with sharp azimuthal edges, validating a low uRayCount + high uRaySharp read.
- [art] https://deep-fold.itch.io/pixel-planet-generator
  — Deep-Fold pixel planets — dithered low-palette crater rendering; shows craters/ejecta reading through dither bands as luminance steps, our exact envelope.
- [art] https://www.artstation.com/artwork/8l32Pw
  — Outer Wilds environment art (Lara Colson) — stylized planetary terrain where landforms read as bold simplified forms, not photo detail; the form-over-texture target.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology: ejecta-blanket thickness follows the McGetchin power law (t ∝ (r/R)^≈−3), continuous out to roughly one crater radius beyond the rim, then thinning into discontinuous facies and secondary-crater chains (ballistic sedimentation). Bright rays are immature, high-albedo excavated material plus secondary churn; they are an OPTICAL feature, not relief, and space weathering fades them over ~10⁸ yr — atmosphere-bearing worlds never keep them (Tycho ≈110 Ma is the canonical young rayed crater). Rampart/layered ejecta (Mars; also Ganymede per Boyce et al.) is ground-hugging flow of volatile-entrained debris that decelerates into a raised distal rampart — the radial profile INVERTS from monotone-decaying skirt to a terminal ridge. Procedural/games practice: crater "stamps" with an analytic radial profile — the research spec's own table row (RESEARCH_high-lod-planet-shaders-2026-06-05.md §3.1) gives parabolic cavity + smoothstep rim + ejecta ~1/r² on jittered Voronoi-F1 placement, LPI-grounded; rays in stylized games are usually albedo decals/streak textures. The spec's design spine applies directly: the 6-level Bayer posterize rewards detail routed through normals/relief and crushes subtle albedo, so the apron is relief (survives) while rays are the deliberate albedo exception that must jump a full quantization band. The built implementation already matches the spec's lead recommendation: analytic-derivative noised() core, chain-ruled gradients, voronoi3d keystone shared with F2, early-out combiners. Most promising next shader step: keep the analytic radial-profile-on-shared-Voronoi architecture and attack the one structural gap — rays clipping at cell boundaries — by evaluating the ray field against the N nearest crater centers (or a sparse second "young rayed crater" layer at coarser cell scale) so a Tycho-class ray system can overrun neighboring cells; optionally let rayBrightness modulate the dither threshold locally so spokes stay crisp at full-disk distance.

## 5. Isolation recipe (:9223)

Built — solo on the :9223 lab (chrome-devtools MCP, see memory/well-dipper-testing-reference.md; launch per memory/chrome-devtools-9223-launch.md). IMPORTANT cross-feature dependency: F3 placement reads uCraterDensity, and the F2 enable-gate zeroes it (world-engine-lab.html:2693), so a pure solo('ejecta') renders NOTHING — re-enable craters after soloing. Steps: (1) navigate to world-engine-lab.html; (2) `window._lab.setPreset('Frozen (airless)')` — bombardmentIntensity 0.85 / erosion 0.1 / no atmosphere ⇒ high ejectaStrength, rayBrightness ≈ 0.9, ejectaRampart ≈ 0.6 (vf 0.3); (3) `window._lab.solo('ejecta'); window._lab.state.cratersEnabled = true;` — F2 bowls + F3 apron/rays only; (4) judge at three distances via `window._lab.state.distance`: 20 (full-disk — ray spokes à la APOD Tycho), 6 (mid — apron collars ringing each crater), 2 (close — skirt-vs-rampart profile and patch breakup); (5) A/B the variants with the 'Ejecta & Rays (F3)' GUI sliders: 'rampart (icy)' 0↔1 for dry-skirt vs terminal-ridge, 'ray brightness (airless)' 0↔1, 'lumpiness'; (6) clean A/B off-state via the folder's '✓ enabled' toggle or `window._lab.enableAllFeatures()` to restore.

## 6. What to judge (UAT checklist)

- [ ] Does the apron read as a raised debris collar hugging each crater rim — clearly outside the bowl, dying off by ~2.5 radii — in the 6-level posterized envelope, rather than a smooth donut halo?
- [ ] Does the apron break up with distance from the rim — continuous blanket near the rim, ragged discontinuous patches outward — so it reads as thrown debris, not a ring decal?
- [ ] At rampart=1, does the silhouette invert into a lobate terminal ridge (outer margin standing proud, Mars-style) versus the monotone fading skirt at rampart=0 — are the two variants distinguishable after posterization?
- [ ] Do bright rays read as discrete radial spokes from young craters at full-disk distance (distance ≈ 20), crossing at least one posterize band so the dither doesn't crush them into the background?
- [ ] Does the gating behave: rays present only on airless+young presets (Frozen), absent under any atmosphere or high erosion; whole apron absent on crater-free resurfaced worlds (strength tracks craterDensity)?
- [ ] Do rays brighten only the SUNLIT hemisphere (×diff) so fresh material reads as lit albedo, not as self-glow on the night side?
- [ ] At close distance (≈2 radii), does the apron relief shade consistently with the sun direction (analytic gradient correctness) without shimmering or flickering dither blocks?
- [ ] Known carry-forward: do the cell-boundary ray truncations read as acceptable stylization, or as an obvious clipped square that breaks the form at full-disk view?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: 🟡 2026-06-10 (VERIFIED_PENDING_MAX) — Frozen (airless), solo
  `ejecta` + cratersEnabled (per §5 dependency), d20/d8/d6/d2, rampart and
  ray A/Bs. Drivers verified live: ejectaStrength 0.8075 (= craterDensity),
  rampart 0.648, rayBrightness 0.9.
  - Apron 🟢: raised debris collars hug each crater rim outside the bowl,
    lumpy and breaking into ragged patches outward — thrown debris, not a
    donut decal (shots 02 d6, 03 d2). Same Voronoi centers as F2 by
    construction; collars visibly ring the F2 bowls (closes F02 checklist
    item 8).
  - Rampart 🟢: A/B at d2 — rampart=0 monotone fading skirt vs rampart=1
    raised lobate terminal ridge rings standing proud; clearly
    distinguishable after posterize (shots 04 vs 05).
  - Gating 🟢: derived rayBrightness 0.9 on Frozen (airless) vs 0.0 on
    Rocky (Earthlike) (atmosphere+erosion gate, read live);
    ejectaStrength tracks craterDensity (0.81 vs 0.50 across presets).
  - Rays at close/mid range 🟢: read as discrete radial streak fans
    around young craters at d2–d8 (shot 04 right side, 06).
  - Rays at full disk 🟡 `taste-call`: at d20 the on/off pixel diff (1630
    px) shows rays DO cross posterize bands, but they read as bright
    speckle, not discrete Tycho-style spokes — the documented §2
    carry-forward (rays truncate at Voronoi cell boundaries; crater radii
    too small a fraction of the disk). Structural fix is §4's
    multi-cell/N-nearest evaluation — build work beyond a refine tweak,
    so taking the conservative option and surfacing for Phase 7: accept
    speckle-rays as stylization, or fund the multi-cell ray rework.
  - Shots: F03-ejecta-01-d20-rays.png, -02-d6-aprons.png,
    -03-d2-rampart-default.png, -04-d2-rampart0.png, -05-d2-rampart1.png,
    -06-d8-rays.png.
- Max's feedback: (pending Phase-7 lap — decide full-disk ray treatment)
- Tweaks applied: none (structural item documented, not slider-fixable)
- Re-verify: n/a
- Status: VERIFIED_PENDING_MAX (lab, 2026-06-10) · ⭐ **WIRED INTO THE GAME 2026-09-03** — the ray law moved to `src/worldengine/base/ejectaRays.js` (`rayBrightnessOf` + `RAY_COUNT`/`RAY_SHARP`, the ONE definition labCore and the crater driver block import), emitted by `craterDeckPack` and `rockySurfacePack` on every admitted body; live on every plain moon (56 of 124 corpus solid bodies airless, rays on the 52 with a crater host), 0 on every body with air; A/B key `Y`; workstream `wire-ejecta-rays-lab-into-game`, `VERIFIED_PENDING_MAX 6d70d56` — **Max's game-side walk pending** (rocky-13, the fifth planet's ice moons). The full-disk ray treatment and the cell-boundary truncation carry-forward stay deferred by his 2026-09-02 ruling.
