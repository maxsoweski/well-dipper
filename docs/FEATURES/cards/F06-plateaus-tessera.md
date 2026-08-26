# Feature Card — F06 Plateaus / highlands / tessera
Domain: Relief · Lab status: ✅ · Build-seq phase: 3

## 1. Description (WHAT)

F6 "Plateaus / highlands / tessera" (F-relief family, close-up/LOD2). Physical chain: P2 tectonic deformation — crust stretches, contracts, or slides (drivers D11, D12, D14, D16 cooling-contraction, D2 ice-shell extension), active or fossil, crosscutting what it offsets — thickens crust into elevated provinces; P15 crustal tessellation/fracture — cooling-contraction or convective stress tiles/shatters the crust — supplies the intensely-deformed end-member. Two variants: (1) uplift plateau — broad flat-topped highland standing above surrounding plains (Tibetan Plateau); (2) crustal-plateau tessera — a crosscutting ridge-and-groove lattice from polyphase compression+extension, Venus's Ovda Regio being the type example (intersecting subparallel ridge/fracture sets, ~10-20 km spacing, rising >3 km above the plains). WD types: terrestrial, venus, rocky, hex, shattered. Inventory status `[aspirational]` (doc row at docs/FEATURES/planet-visual-features.md:221, P2 at :143), but the lab build has since landed — campaign tracker shows F6 ✅.

## 2. Current shader approach (HOW, as-built)

BUILT (Stage-C step 3, Relief) in /home/ax/projects/well-dipper/world-engine-lab.html as TWO solo-able sub-features sharing F6. Uniforms declared :224-238 (uPlateauStrength/Scale/Offset/Levels/Softness + uPlateauDomainOffset; uTesseraStrength/Axis[2]/Freq/Warp/WarpFreq + uTesseraDomainOffset). PLATEAUS: fbmdHetero() :900-921 — Musgrave height-stratified fBm (each octave weighted by clamp(running value,0,1) so highs grow rough, basins stay smooth) with analytic gradient via the standard fbmd chain rule and the fwidth/trailing-octave anti-shimmer fade; terraceProfile() :954-968 — floor(h*levels)+smoothstep riser, returns (value, dv/dh); plateauCombiner() :976-986 runs HeteroTerrain through the terrace (octaves capped at min(uOctaves,3) so treads stay BROAD), h += strength*(terrace-0.5), grad chain-ruled tp.y*ph.grad*uPlateauScale; ≤0 early-out. TESSERA: ridgeWave() :993-998 — 1-|sin(phase)| fold with the -sign(sin)*cos derivative (the §5.4 silent-bug sign correction); tesseraCombiner() :1022-1045 — two warped iso-contour ridge fields dot(pos,axis)+warp*noised (F5 scarp machinery, macro/detail-seed decorrelated), MULTIPLIED so grooves from EITHER orientation cut through (product-rule gradient). Both called in height assembly :1506-1507. Driver derivation in planet-lod-lab-core.js: plateauStrength = clamp01(tectonicActivity*(1-0.4*erosion))*0.2 (:706); tesseraStrength = clamp01(smoothstep(0.45,0.9,tectonicActivity)*(1-0.4*erosion))*0.15 — high-stress gate (:712); tesseraAxes = 2 seeded unit vec3s (:716). GUI: fPlateaus folder :2363-2368, fTessera :2375-2379; enable gates feed uniforms :2727/:2732. Registry: planet-archetypes.js:12-13 — keys 'plateaus' and 'tessera', archetype 'tectonic-terrestrial'.

## 3. Reference images (real + art)

- [real] https://www.jpl.nasa.gov/images/pia00311-magellans-perspective-view-of-ovda-regio-0-s-129-e/
  — Magellan 3-D perspective of Ovda Regio — the tessera highland rises as a coherent elevated block with chaotic ridge texture, distinct from the smooth plains; the plateau-above-plains silhouette is the macro read.
- [real] https://science.nasa.gov/photojournal/venus-interior-of-ovda-regio/
  — Interior of Ovda Regio — NE-SW ridge fabric (10-20 km spacing) cut by NW-SE extension fractures: exactly the two-orientation crosscutting lattice the dual-axis tesseraCombiner is modeling.
- [real] https://ntrs.nasa.gov/citations/19990018741
  — NASA NTRS global survey of tessera terrain — confirms tessera is rare/high-stress (Ovda ~2% of Venus's surface), supporting the smoothstep(0.45,0.9) tectonicActivity gate rather than ubiquitous coverage.
- [real] https://earthobservatory.nasa.gov/images/36252/tibet
  — NASA Earth Observatory MODIS view of the Tibetan Plateau — a broad uplifted tread whose interior is comparatively smooth while its margins (Himalaya rim) carry the roughness: the HeteroTerrain rough-margin/flat-interior stratification.
- [real] https://www.nasa.gov/image-article/himalayas-separate-tibetan-plateau-from-indian-subcontinent/
  — Plateau-vs-lowland step seen obliquely from orbit — one big elevation discontinuity, not a gradient; the riser between treads should read this abruptly.
- [art] https://assetstore.unity.com/packages/3d/environments/landscapes/lowpoly-environment-pack-mesa-and-desert-rocks-167831
  — Low-poly mesa/desert pack — stylized mesas reduce to flat caps + steep planar risers with zero mid-slope detail; our terraced treads should compress to the same few-band read under posterization.
- [art] https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/
  — Heckel's dithering/retro-shading study (already in the research doc's source list) — shows how quantized lighting turns slope changes into band edges; plateau risers become deliberate band boundaries.
- [art] https://surma.dev/things/ditherpunk/
  — Obra Dinn-style ordered dithering — form survives extreme quantization only when carried by lighting/normals, the exact discipline both F6 combiners follow (height+gradient, no albedo).

## 4. Math / modeling notes (HOW, from the field)

Geomorphology: plateaus are isostatically supported thickened crust — broad uplift whose interior is a low-relief erosion surface and whose margins are dissected (the field models this as uplift rate vs. stream-power erosion; mesas/buttes are the differential-erosion end stage where a resistant caprock leaves flat treads and steep risers). Venus tessera is polyphase deformation: an early shortening fabric (subparallel ridges) overprinted by a later extension fracture set at a different strike — i.e., two superimposed quasi-periodic directional fields, which is why structural geologists describe it as "crosscutting lattice" rather than isotropic roughness. Procedural-generation lineage: Musgrave's HeteroTerrain (heterogeneous fBm where increment *= current value — the research doc's "height-based stratification" row, flagged `survives`/`low` cost) gives smooth basins + rough highlands; terracing is `floor(h*N)/N` + softened riser — the research doc calls it "a *height* posterize, survives the color posterize fine," which is the key insight: quantizing height harmonizes with, rather than fights, the 6-level luminance quantizer. Terrain tools (World Machine/Gaea terrace nodes, Blender's Musgrave hetero-terrain mode) use the identical transfer-function trick. Directional ridge trains are warped iso-contours: phase = (dot(pos,axis)+warp·noise)·freq folded by 1-|sin| — single-octave so no fwidth fade needed, but the derivative needs the -sign(sin) correction across the abs fold (the doc's §5.4 silent-bug class). Everything routes through the analytic normal per the doc's design spine ("route detail through normals/specular, not color"). Most promising shader-side approach — and what's built: height-stratified fbmd pushed through a terraced transfer function (chain rule dv/dh·dh/dpos) for the plateau read, plus two seed-decorrelated warped ridgeWave fields multiplied together (product rule for the gradient) so grooves of both orientations cut through, gated by a high-tectonic-stress driver so tessera stays rare.

## 5. Isolation recipe (:9223)

Built — two solo keys. (1) Launch the second Chrome on :9223 (per memory/chrome-devtools-9223-launch.md: `--remote-debugging-port=9223 --user-data-dir="C:\temp\chrome-mcp-filmstrip"`) and open the vite-served /world-engine-lab.html; drive it with mcp__chrome-devtools__ tools, not Playwright. (2) In the Driver-Presets folder pick 'Rocky (Earthlike)' (the tectonic-terrestrial archetype preset per planet-archetypes.js:30 — derives nonzero plateauStrength/tesseraStrength from tectonicActivity). (3) Plateaus: run `window._lab.solo('plateaus')` (enables ONLY plateausEnabled via setFeatureEnables, world-engine-lab.html:2539/2908). Tessera: `window._lab.solo('tessera')`. (4) Distances via `window._lab.state.distance` (1.1-30 radii): 8 for the plateau-province global silhouette, 3 for mesa treads/risers; tessera lattice reads best at 1.5-3. (5) If the derived strength is too subtle (tessera's smoothstep(0.45,0.9,tectonicActivity) gate may sit low on the Earthlike preset), raise `window._lab.state.plateauStrength` (slider range 0-0.4) or `window._lab.state.tesseraStrength` (0-0.3) manually — they're .listen()-ed GUI fields at :2363/:2375. (6) Restore with `window._lab.enableAllFeatures()`.

## 6. What to judge (UAT checklist)

- [ ] Do plateaus read as broad flat-topped uplands in the 6-level envelope — each tread settling into one stable posterize band, with the dither texture concentrating on the risers rather than speckling the flats?
- [ ] Does the terracing read as discrete stacked levels (mesa steps) rather than a smoothed slope — i.e., does the height quantization produce crisp band boundaries that look intentional, not like banding artifacts?
- [ ] Is the HeteroTerrain stratification legible: highland margins visibly rougher than basin floors, so the eye separates 'uplifted province' from 'plains' by texture as well as silhouette?
- [ ] Does tessera read as a CROSSCUTTING lattice — two distinguishable groove orientations intersecting — and not as single-direction corrugation or isotropic noise?
- [ ] Are groove walls lit from a consistent side (the -sign(sin) gradient correction holding) — no backward-lit groove faces breaking the relief illusion under posterized lighting?
- [ ] Do plateaus stay broad at close range (the 3-octave cap working) — no fine band-crossing noise chopping treads into flicker as lodRamp rises?
- [ ] While orbiting, does the tessera lattice hold steady under the 4x4 Bayer dither — no shimmer/moire from the ridge product at the chosen uTesseraFreq?
- [ ] Does the driver gating read as physical storytelling: tessera appearing only on high-tectonic-stress worlds and fading with erosion, while quiet worlds stay clean?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: 🟢 2026-06-10 (VERIFIED_PENDING_MAX) — Rocky (Earthlike), solo
  `plateaus` then solo `tessera`, d8/d3/d1.5. Drivers verified live:
  Rocky plateauStrength 0.0825 / tesseraStrength 0.0029 (gate correctly
  near-closed).
  - Plateau treads: broad flats settle into one posterize band each, with
    dither concentrating along the stepped riser edges; discrete stacked
    mesa levels read as intentional at strength 0.2 (shots 02, 03 +
    tight zoom). Treads stay broad at d3/d1.5 — the 3-octave cap holds.
  - Stratification: rough texture concentrates on the elevated provinces,
    basins stay smoother (shot 03).
  - Tessera lattice: at 0.15 (the real Lava-derived value), grooves run
    in two intersecting orientations — crosscutting Ovda-style fabric,
    not single-direction corrugation or isotropic noise; groove walls lit
    from a consistent side (shots 04 d3, 05 d1.5).
  - Driver gating as storytelling (read live across all 6 presets):
    tessera 0.15 Lava / 0.147 Europa (high-stress) vs 0.0029 Rocky,
    0.0408 Ocean, 0 Titan, 0 Frozen — rare/high-stress per the NTRS
    survey; the manual 0.15 used for judging is exactly the Lava value.
  - Rotation/dither stability covered by FOUNDATION checks 3 & 4 🟢.
  - Shots: F06-plateaus-01-d8.png, F06-plateaus-02-d3-treads.png,
    F06-plateaus-03-d3-strength02.png, F06-tessera-04-d3-strength015.png,
    F06-tessera-05-d1.5-lattice.png.
- Max's feedback: (pending Phase-7 lap)
- Tweaks applied: none needed
- Re-verify: n/a
- Status: VERIFIED_PENDING_MAX
