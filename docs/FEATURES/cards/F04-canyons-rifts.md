# Feature Card — F04 Canyons / rifts
Domain: Relief · Lab status: ✅ · Build-seq phase: 3

## 1. Description (WHAT)

F4 "Canyons / rifts" (L2 table, docs/FEATURES/planet-visual-features.md:219) — linear negative relief carved or pulled into the crust. Three variants: tectonic graben/chasma (crust stretches → normal faults drop a flat-floored block between steep walls), fluvial-incised gorge (a liquid cuts down through the datum), and cryo-chasma (ice-shell extension as a subsurface ocean freezes and expands). Source physical processes: P2 tectonic deformation (:143 — driven by D11 surface-history, D12 tidal heating, D14 mass/gravity, D16 cooling→contraction with age; scale runs "local fault … globe-girdling scarp/rift system"; active-or-fossil, crosscuts what it offsets) and P8 fluvial erosion (:149 — needs liquid stability D1+D2+D6, rain D4; "trickle rill … continental trunk river"). Real-body exemplars: Valles Marineris (Mars — 3,000 km long, 8 km deep, rift faulting from Tharsis loading + erosional collapse), the Grand Canyon (Earth, fluvial), Charon's chasmata belt (Serenity Chasma — 1,800 km long, 7.5 km deep, freezing-ocean expansion). Archetype membership: terrestrial, rocky, venus, ice, ocean. The inventory row is marked `[aspirational]`, but the tectonic-graben variant is now built in the lab; fluvial-incised gorges (F11) and cryo-chasma are designed to ADD INTO the same accumulator later.

## 2. Current shader approach (HOW, as-built)

BUILT (tectonic-graben variant) in world-engine-lab.html, Stage-C step 3, domain Relief. Each rift is a great circle: the intersection of the unit sphere with a seeded plane through the center. A surface point's perpendicular distance to the rift line is d = |dot(pos, planeNormal)|, giving a CONSTANT gradient ds/dpos = n. Pieces: (1) grabenProfile() GLSL at world-engine-lab.html:817-827 — flat-floored trench cross-section, depth = smoothstep(floorHalf, halfWidth, d) − 1 ∈ [−1,0], plus its analytic derivative dddd; transcribed from the vitest-pinned CPU oracle grabenProfile() in planet-lod-lab-core.js:270-280 (finite-diff-pinned per relief-doc §5.4 silent-bug gate — a sign-wrong wall lights the trench inside-out yet compiles fine). (2) canyonCombiner() at world-engine-lab.html:837-851 — loops up to uChasmaCount (≤3) rifts, carves dep = uChasmaDepth·gp.x DOWN into both h and the SHARED canyonHeight accumulator (declared :1477; Fluvial F11 and Cryo chasma add into it at stages 3/4), and chain-rules the wall slope into the shading gradient: grad += uChasmaDepth·gp.y·sign(s)·n. Called at :1503, just before fluvialCombiner (:1504). uChasmaDepth ≤ 0 early-outs (:838). (3) Uniforms uChasmaDepth/uChasmaCount/uChasmaAxis[3]/uChasmaWidth/uChasmaFloor declared :208-212, values :1652+. (4) Drivers in planet-lod-lab-core.js:656-676: tectonicActivity = clamp01(max(resurfacing, habitability·0.7) + tidalProxy·0.5) (:667); chasmaStrength = clamp01(tectonicActivity·(1 − 0.4·erosion)) (:668); chasmaDepth = chasmaStrength·0.28 (:669); chasmaCount 1..3 and three seeded unit-vec3 plane normals from the seed (:675-676). (5) GUI: 'Canyons (F4)' folder under Relief at world-engine-lab.html:2331-2341 — depth (tectonic), rift count, half-width, flat-floor frac, ✓ enabled, and a 'roll rift axes' button; enable gate at :2715 (uChasmaDepth = canyonsEnabled ? chasmaDepth : 0). (6) Registry: planet-archetypes.js:11 — key 'canyons', enableKey 'canyonsEnabled', archetypes ['tectonic-terrestrial'].

## 3. Reference images (real + art)

- [real] https://photojournal.jpl.nasa.gov/catalog/PIA04304
  — Viking mosaic of Valles Marineris — the whole-disk read of a rift: one continuous dark linear gash spanning a hemisphere, exactly the great-circle trench-line our combiner draws.
- [real] https://science.nasa.gov/resource/valles-marineris-the-grand-canyon-of-mars/
  — NASA overview of Valles Marineris — note the morphology chain west-to-east (Noctis Labyrinthus graben → main chasma → chaotic terrain): a real rift varies width/character along its axis, which our constant-width graben does not yet.
- [real] https://www.jpl.nasa.gov/images/pia20467-plutos-hulk-like-moon-charon-a-possible-ancient-ocean/
  — Charon's Serenity Chasma belt (New Horizons) — cryo-chasma variant: flat down-dropped floor between two crisp parallel scarps on an icy body; the cleanest real match for the flat-floor + steep-wall grabenProfile.
- [real] https://earthobservatory.nasa.gov/images/77566/east-african-rift-valley-kenya
  — East African Rift from orbit — horst-and-graben at the active end of the scale: stepped escarpments and a chain of floor lakes; shows how a rift floor reads darker/flatter than the shoulders.
- [art] https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/
  — Maxime Heckel's dithering/retro-shading writeup — how ordered (Bayer) dither + posterize turn smooth shading bands into the chunky stepped look; the envelope our canyon walls must read through.
- [art] https://itch.io/game-assets/tag-canyon/tag-pixel-art
  — Pixel-art canyon game assets — note how stylized canyons reduce to 2-3 flat tones (rim / wall / floor) with a hard shadow edge; that three-tone read is our 6-level target, not photoreal gradation.
- [art] https://sketchfab.com/3d-models/pixel-canals-low-poly-game-level-0e7cd01efb484aff817e3b03425cc080
  — Low-poly pixel canal level — flat-floored trenches with faceted walls; demonstrates that a trench reads as form purely from one lit wall + one shadowed wall, which is what the analytic gradient buys us.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology: tectonic rifts are extensional — normal faults bound a down-dropped block (graben) between raised shoulders (horsts), so the canonical cross-section IS a flat floor between two steep walls; Valles Marineris adds erosional collapse and along-axis variation (graben field → main chasma → chaos), and Charon's belt comes from freezing-ocean volume expansion (same landform, different engine — which is why one profile primitive can serve tectonic AND cryo variants). The fluvial-gorge variant is governed by the stream-power incision law (erosion ∝ drainage area^m × slope^n), producing V-profiles and dendritic networks — that belongs to F11, which already carves into the same canyonHeight accumulator. Procedural/games practice (vocabulary from research/RESEARCH_high-lod-planet-shaders-2026-06-05.md): the static/structural layer (continents, craters, canyons) must be deterministic and seed-stable on re-approach; per-type variety comes from swapping the COMBINER, not the noise core; the doc's Voronoi-border-distance row (:75) explicitly notes "invert for graben" as an alternative rift primitive (perpendicular edge distance F2−F1 → ridge or trench), and domain warping (:73) is the standard "authored-looking" deformation, with analytic derivatives chain-ruled into the shading gradient so walls light correctly without finite-diff cost. Our as-built great-circle plane-distance approach is the cheapest exact-gradient global rift primitive (ds/dpos = n is constant). Most promising next shader step: keep the signed plane distance s = dot(pos, n) as the spine but domain-warp it with one low-frequency analytic-derivative FBM (s' = s + a·fbm(pos), grad chain-ruled as n + a·∇fbm) so rifts wander instead of being perfect circles, and modulate uChasmaDepth/uChasmaWidth along the rift axis with a second 1-D noise so the trench pinches, deepens, and dies out like Valles Marineris — both survive the posterize envelope because they change form, not texture.

## 5. Isolation recipe (:9223)

Built — solo it on the :9223 debug Chrome (launch per memory/chrome-devtools-9223-launch.md: second Chrome with --remote-debugging-port=9223; verify liveness with mcp__chrome-devtools__list_pages, NOT curl). Open world-engine-lab.html via the project's served URL, then in the page (evaluate_script): (1) window._lab.setPreset('Rocky (Earthlike)') — the tectonic-terrestrial preset; its drivers (habitability 0.7, erosion 0.4, resurfacing 0.1) yield chasmaDepth ≈ 0.12, nonzero by default. (2) window._lab.solo('canyons') — 'canyons' is the real key from planet-archetypes.js:11; this flips canyonsEnabled on and every other feature's enableKey off (setFeatureEnables, world-engine-lab.html:2539). (3) Distances via window._lab.state.distance (radii, range 1.1-30, default 20): set 8 for the global rift-line read across the disk; 3 for wall-lighting and the floor/wall/rim banding; 1.5 for close floor detail under the dither. (4) Optional shaping in the GUI 'Canyons (F4)' folder (under Relief): push state.chasmaDepth toward 0.25 to exaggerate, state.chasmaCount to 3 for crossings, and click 'roll rift axes' (:2339) to re-seed plane normals. (5) Confirm isolation: window._lab.featureEnabled('canyons') === true and e.g. featureEnabled('mountains') === false; clear with window._lab.enableAllFeatures().

## 6. What to judge (UAT checklist)

- [ ] Does each rift read as one continuous linear trench tracking a great circle across the disk and over the limb — a coherent structural gash, not a noise smudge — in the 6-level posterized envelope?
- [ ] Does the cross-section read as three distinct forms — flat dark floor, two steep walls, untouched rim datum — i.e., does the flat-floor frac actually show up as a floor band rather than a V-notch, within the quantized shading levels?
- [ ] Do the two walls light OPPOSITELY (sun-facing wall takes a brighter posterize level, far wall a darker one), proving the chain-ruled gradient sign is right and the trench never lights inside-out?
- [ ] At distance (~20 radii) does the rift survive as a thin dark line, and on approach (~8 → 3 → 1.5) does it widen smoothly into floor+walls without shimmer or crawling under the 4x4 Bayer dither?
- [ ] With chasmaCount = 2-3, do rift crossings read as superposed troughs (deeper where they intersect) rather than rendering artifacts?
- [ ] Does the canyon visibly CROSSCUT pre-existing relief (mountains F1, scarps F5) — carved through it, offsetting it — matching the P2 'crosscuts what it offsets' age cue, once solo is cleared?
- [ ] Are rift positions seed-stable — same axes, same trench, on re-approach and after preset re-apply (determinism constraint on the structural layer)?
- [ ] Does toggling ✓ enabled (or solo off) restore the Stage-A base + F1/F2 exactly, confirming the uChasmaDepth ≤ 0 early-out leaves no residue?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: 🟢 2026-06-10 (VERIFIED_PENDING_MAX) — Rocky (Earthlike), solo
  `canyons`, d20/d8/d3 + count-3/depth-0.25 exaggeration + crosscut and
  early-out checks. Drivers verified live: chasmaDepth 0.1155 (≈ card's
  0.12), count 1 default.
  - Great-circle trench: one continuous linear gash tracks across the
    disc and over the limb at d8; near-tangent plane geometry shows both
    visible segments of the same circle (shot 01).
  - Cross-section: lit wall vs shadowed wall in opposite posterize bands
    with a floor band between — no inside-out lighting (shot 03 d3;
    profile sign also pinned by the grabenProfile vitest oracle).
  - Distance: survives as a thin dark line at d20 (shot 04); widens
    smoothly into floor+walls on approach across d20→8→3 stills (no-pop
    ramp covered by FOUNDATION check 4 🟢).
  - Crossings: count=3 at depth 0.25 — superposed troughs, deeper at
    intersections, no artifacts (shot 02).
  - Crosscut: with mountains re-enabled, trenches visibly carve through
    the ridge fabric, offsetting it (shot 05) — the P2 age cue.
  - Seed stability: two fully independent setPreset→solo→applyDrivers
    cycles produced pixel-identical d8 frames (0 px diff) — rift axes
    deterministic per seed.
  - Early-out: chasmaDepth=0 (enabled) vs canyonsEnabled=false are
    pixel-identical (0 px diff, clouds zeroed) — no residue.
  - Shots: F04-canyons-01-d8.png, -02-d8-count3-deep.png,
    -03-d3-walls.png, -04-d20-line.png, -05-d6-crosscut-mountains.png.
- Max's feedback: (pending Phase-7 lap)
- Tweaks applied: none needed
- Re-verify: n/a
- Status: VERIFIED_PENDING_MAX
