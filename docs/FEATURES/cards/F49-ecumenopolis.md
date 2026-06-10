# Feature Card — F49 Ecumenopolis
Domain: Overlay · Lab status: ⬜(lab) · Build-seq phase: 4c

## 1. Description (WHAT)

F49 Ecumenopolis (family F-overlay, domain Overlay) is the saturation endpoint of P28 Technospheric development: a civilization builds out until engineered structures replace/coat the entire natural terrain and light the whole nightside — a planet-covering megacity with whole-surface glow. It sits on the L1c biotic/technogenic process track (an agentive process, not geomorphic), driven by D15 habitability-to-tech + D16 age (civilizational time to reach saturation), with D7 nightside contrast powering the lights read. Variants run along the P28 intensity axis: scattered structures (F47 machine) → scattered cities / continuous urban band (F48 city lights) → planet-covering build-out (F49). The L1c compositing rule is load-bearing: an ecumenopolis sits on what WAS a terrestrial world — the representation must be base-type + overlay layer, so base oceans/weather/relief show through wherever coverage < 1, never a from-scratch generator. Real-body examples: none — fictional only (Coruscant, Trantor); Earth-at-night is the nascent real precursor (that's F48). WD type: `ecumenopolis` (EXOTIC), inventory status `[current]` (whole-surface city glow, production path).

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) in planet-lod-lab.html — no ecumenopolis combiner, uniform, or GUI folder exists in the lab or in planet-archetypes.js FEATURES. The lab has already reserved its slot, though: the ★ EMISSIVE bypass channel comment at planet-lod-lab.html:1572-1575 explicitly names "city lights F48/49" as an owner of the post-posterize emissive composite (alongside lava F41, bioluminescence F46, aurora F37) — that Lambert-independent, quantizer-skipping channel (uEmissive at :1577-1579, lavaCrackEmissive at :1580-1581, and the aurora nightMask pattern `smoothstep(0.1,-0.1,diff)` at :1593) is exactly the machinery F49 plugs into. A legacy production implementation DOES exist outside the lab: src/objects/Planet.js planetType==17 — two-scale axis-aligned fract() block grid + hash district pattern (Planet.js:772-789), steel/concrete day albedo with warm districts (Planet.js:843-849), and whole-surface nightside emissive glow `nightMask = 1.0 - smoothstep(0.0, 0.15, diffuse)` with cityGrid + districtBright hash (Planet.js:934-948). Generation: src/generation/ExoticOverlay.js:99 (civilized roll → 30% ecumenopolis) and src/generation/PlanetGenerator.js:277. The lab rebuild should port the production intent onto the lab's analytic-noise + emissive-bypass architecture, not copy the tri-axis cube grid.

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

Unbuilt — recommended recipe once built. (1) Register in planet-archetypes.js FEATURES as `ecumenopolis: { label: 'Ecumenopolis (F49)', enableKey: 'ecumenopolisEnabled', archetypes: [...] }` — either added to 'tectonic-terrestrial' (it overlays a terrestrial base) or a new 'technogenic-overlay' archetype; the lab's solo plumbing (setFeatureEnables via the per-feature '🔆 solo' button at planet-lod-lab.html:2563 and `window._lab.solo(key)` at :2908) then works with zero extra wiring. (2) In the :9223 debug Chrome (chrome-devtools MCP, per well-dipper-testing-reference.md — launch with --remote-debugging-port=9223), open planet-lod-lab.html, select preset 'Rocky (Earthlike)' (the terrestrial base the overlay composites over), then run `window._lab.solo('ecumenopolis')`. (3) Judge at three distances via `window._lab.state.distance`: ~10 (whole-globe saturation read — is it planet-covering?), ~5 (district patchwork + terminator transition), ~2 (block-grid relief and emissive crispness at LOD2). (4) Rotate yaw to put the nightside in view and confirm the whole-surface glow on the emissive bypass channel; screenshot via mcp__chrome-devtools__take_screenshot, not Playwright.

## 6. What to judge (UAT checklist)

- [ ] Does the nightside read as a planet-wide continuous lattice of glow — saturation, no dark rural/ocean gaps — rather than scattered city patches (which would read as F48, not F49) in the 6-level posterized envelope?
- [ ] Does the emissive night glow stay crisp and unbanded (bypass channel) while the day surface stays fully inside the posterize — i.e. does it read as 'retro world with real lights' rather than banded smear?
- [ ] On the day side, do street canyons and mega-block massing read as lit relief (normal/shading detail that survives as dither texture), not as albedo noise the quantizer crushes flat?
- [ ] Does the block/district network read as organic urban fabric wrapped on a sphere — no axis-aligned cube-grid artifact or pole pinching from a tri-axis fract lattice?
- [ ] Does the underlying terrestrial base still show through where coverage < 1 — oceans, relief, weather visibly beneath/between the built-over fabric — per the L1c base+overlay compositing rule?
- [ ] Does district-to-district brightness variation read as believable urban tiering (bright cores, dimmer sprawl) at mid distance without flickering into Bayer dither noise?
- [ ] Does the terminator read as lights coming on — the emissive ramping in smoothly via the nightMask — rather than a hard day/night seam in the glow?
- [ ] Does block-grid frequency ramp coherently with approach distance (lodRamp) — more, finer blocks as you close in — without popping or moiré against the 4x4 Bayer?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
