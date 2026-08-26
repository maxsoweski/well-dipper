# Feature Card — F51 Rings
Domain: Crosscutting · Lab status: 🟢 v2 VERIFIED_PENDING_MAX (`71eea7a`) · Build-seq phase: 4c

## 1. Description (WHAT)

F51 (L2 crosscutting table, docs/FEATURES/planet-visual-features.md:345): planetary ring system — banded ringlets + a dominant Cassini-style gap + shepherd-moon gaps + the planet's shadow falling across the annulus. Unlike surface features it has no single P#/D# row; its physical chain is encoded in PhysicsEngine §11 instead: origin ('roche' | 'accretion' | 'collision' | 'captured') sets composition and color family (bright ice / dark rock / brown dust / mixed debris); the Roche limit (2.44·R·(ρp/ρm)^⅓) sets the inner edge; the innermost moon clips the outer edge; system age decays density (icy-ring lifetime ~200 Myr → fresh dense vs tenuous remnant); moon 2:1 and 3:1 mean-motion resonances carve gaps; gaps partition the disk into up to 16 ringlets. Variants: dense multi-banded icy disk (Saturn A/B/C + Cassini Division + Encke gap with shepherds Pan/Prometheus/Pandora) · narrow dark ringlets (Uranus) · faint dusty ring (Jupiter) · ring arcs (Neptune) · exotic giants (J1407b candidate, ringed centaur Chariklo). Status: [current] inline path in production; [partial] dead RingRenderer.js multi-band, never instantiated.

## 2. Current shader approach (HOW, as-built)

Built in PRODUCTION, absent from world-engine-lab.html (no ring stage, mesh, or uniform exists in the lab — grep for ring there only hits aurora ringMask and cryo bands). Production inline path: src/objects/Planet.js _createRing() (1105-1235) — THREE.RingGeometry(innerR, outerR, 64) rotated into the equatorial plane (1111-1114); fragment shader parameterizes t = (dist-innerR)/(outerR-innerR), fakes banding with two sine waves sin(t*30) and sin(t*12+1) → density + 2-color mix (1194-1198); a HARDCODED Cassini-like smoothstep gap at t≈0.4-0.51 (1200-1202); shepherd gaps as up to 6 moon-orbit notches via setRingGaps() (1241-1255, gap width = moon.radius*4); planet shadow as an analytic cylinder test — cross(vRelWorldPos, lightDir) vs planetRadius (1214-1223, shadow also drops alpha to 0.15 so stars show through); transparency via Bayer dither-discard (1225) and 6-level posterize (1227) — the retro envelope is already honored. Generation: PlanetGenerator.js:509-555 rolls per-type ring chance and calls generateRingPhysics() (PhysicsEngine.js:766-905: Roche-limit inner edge 844, moon-clipped outer edge 846-857, age-decay density 859-864, 2:1/3:1 resonance gaps 866-884, ringlet partition 886-900). DEAD PATH: src/rendering/objects/RingRenderer.js:38 consumes the full physics ringlets[]/gaps[] (16 ringlets, 8 gaps, composition-driven COMPOSITION_COLORS at line 28) in a per-fragment loop (208-235) — but it is never imported or instantiated anywhere; the physics data is generated and stored on rings.physics yet the live inline shader ignores it and renders the sine fake. Nearest lab machinery to plug into: the FEATURES solo registry in planet-archetypes.js:6 and the lab's DRIVER_PRESETS/deriveUniforms pipeline (world-engine-lab.html:2149, 2164).

## 3. Reference images (real + art)

- [real] https://photojournal.jpl.nasa.gov/catalog/PIA08885
  — F-ring shepherds Prometheus and Pandora flanking a narrow ringlet — the form a shepherd gap/confinement should imply even when the moons themselves are sub-pixel.
- [real] https://photojournal.jpl.nasa.gov/catalog/PIA11657
  — Mimas' shadow straddling the Cassini Division at equinox — the canonical look of THE dominant gap: one wide dark clearing separating two dense bands.
- [real] https://photojournal.jpl.nasa.gov/catalog/PIA17199
  — Saturn's shadow sweeping across the rings: lit particles below, shadowed above — the shadow is a sharp-edged bite across the annulus, not a dimming gradient.
- [real] https://www.jpl.nasa.gov/images/pia05421-ringscape-in-color/
  — Natural-color ringscape: sandy/pink/grey banding within the B ring — the palette range (2-3 muted hue families, brightness-led) our 6-level posterize must compress to.
- [real] https://en.wikipedia.org/wiki/Rings_of_Saturn
  — A/B/C structure, division widths, and optical-depth profile — the 1-D radial density function the shader is really drawing.
- [art] https://www.artstation.com/artwork/nEEvJe
  — Procedural ring shader (Adam Porembiński) — shows which knobs matter artistically: band frequency, contrast, gap placement, edge falloff.
- [art] https://helianthus-games.itch.io/pixel-art-planets
  — 250+ 64px pixel-art planets incl. ringed ones — proof of how FEW distinct bands (3-5) still read unmistakably as 'ringed planet' at low resolution.
- [art] https://www.shadertoy.com/view/WfXyzB
  — Shadertoy 'planetary rings' — live example of 1-D noise-over-radius banding carved by smoothstep gaps, the technique class we'd adapt under the dither envelope.

## 4. Math / modeling notes (HOW, from the field)

Academically a ring system is a 1-D radial optical-depth profile τ(r) on a razor-thin disk: the inner edge sits at the Roche limit (2.44·R·(ρ_planet/ρ_moon)^⅓ — already in rocheLimit(), PhysicsEngine.js:776); gaps are cleared at mean-motion resonances with moons, a_gap = a_moon·(p/q)^(2/3) by Kepler (the Cassini Division ↔ Mimas 2:1; the code computes 2:1 and 3:1 gaps at PhysicsEngine.js:874-883); narrow ringlets are confined by shepherd-moon torques (Goldreich-Tremaine); density decays with age via viscous spreading and micrometeoroid pollution (the ageFactor exponential at 859-864). Games/sims collapse all of this to that 1-D profile: render a flat annulus and sample either a baked 1-D density LUT or a procedural 1-D FBM over normalized radius t, with smoothstep notches for gaps; planet shadow is an analytic cylinder-occlusion test along the light direction (already implemented, Planet.js:1214-1217); dusty rings additionally brighten when backlit (forward scattering) — an optional [needs-adaptation] extra. In the research doc's vocabulary the whole feature is naturally 'lighting-routed': τ(r) drives the ALPHA dither-discard (Bayer threshold → translucency that survives the retro envelope with zero blending/sorting), hue stays a 2-color composition mix posterized to 6 levels, and the radial band frequency needs the fwidth band-limiting clamp so fine ringlets fade to their mean at grazing angles instead of moiréing against the 4×4 Bayer grid (the sine fake at sin(t*30) currently has no such clamp). Most promising shader-side approach: resurrect the dead RingRenderer ringlet/gap loop as a single 1-D density combiner — ringlet rectangles with smoothstep edges × resonance-gap notches × a low-octave deterministic 1-D FBM(t) for fine ringlet texture — evaluated from length(vPos.xz), keeping the existing dither-discard alpha, cylinder planet-shadow, and 6-level posterize untouched. This swaps the fake sine bands for the already-generated physics chain at near-zero added fragment cost, and the fwidth clamp on t handles the one new failure mode (edge-on shimmer).

## 5. Isolation recipe (:9223)

UNBUILT in the lab — recommended recipe once built: (1) register a FEATURES key in planet-archetypes.js:6, e.g. rings: { label: 'Rings (F51)', enableKey: 'ringsEnabled', archetypes: [...] }, so the lab's setFeatureEnables() solo plumbing (world-engine-lab.html:2539-2569) picks it up automatically; (2) add a ringed host preset to DRIVER_PRESETS (world-engine-lab.html:2149) — none of the six existing presets is a gas giant, so either add 'Gas giant (ringed)' or hang the ring off 'Frozen (airless)' for first light. Then, on the dedicated :9223 Chrome (see memory/chrome-devtools-9223-launch.md; verify liveness with mcp__chrome-devtools__list_pages, NOT curl), open the lab page and run: window._lab.solo('rings'). Distances via window._lab.state.distance (lab range 1.1-30 radii, world-engine-lab.html:2106): 12 for the full annulus face-on (rings span roughly 1.2-4 planet radii); 25 for the far-silhouette readability check (do bands still read at a handful of pixels?); 3-5 hovering near the ring plane for the planet-shadow bite, gap edges, and dither-translucency against the starfield. Sweep pitch between face-on and edge-on to exercise the grazing-angle moiré case.

## 6. What to judge (UAT checklist)

- [ ] Does the ring read as a flat annulus locked to the planet's equatorial plane (tilting with axial tilt), not a screen-space billboard, in the 6-level posterized envelope?
- [ ] Do the bands read as discrete concentric ringlets of differing density — 3-5 distinguishable light/dark bands — rather than a smooth radial gradient flattened by the posterizer?
- [ ] Does ONE dominant wide gap (the Cassini analog) stay readable at far distance, with thinner resonance/shepherd gaps appearing as crisp clearings only as the camera closes?
- [ ] Does the planet shadow read as a sharp-edged bite sweeping the far-side arc of the ring — and do stars remain visible through the shadowed region (alpha drop), not blocked by opaque black fragments?
- [ ] Does the Bayer dither-discard transparency read as translucent ice/dust at every density level, with no sorting or halo artifacts where the ring crosses the planet limb?
- [ ] Do composition families survive the posterize as distinguishable identities — bright cool ice vs dark grey rock vs warm brown dust — within the 6-level budget?
- [ ] At grazing/edge-on angles, do the radial bands stay stable instead of shimmering into moiré against the 4x4 Bayer grid (the band-limiting behavior)?
- [ ] Does ring presence/density vary believably across bodies (fresh dense disk vs tenuous old remnant), reading as a property of the world rather than a fixed decal?

## 6.5 Build plan — v2 (3D LOD particle ring) — CURRENT

> Spec: `docs/superpowers/specs/2026-06-13-f51-rings-3d-lod-particle-design.md` ·
> Plan: `docs/superpowers/plans/2026-06-13-f51-rings-3d-lod-particle.md`
> Supersedes the v1 build plan below (kept for envelope/shadow/dither reference).

**Why v2:** Max rejected v1 (§7) — a single flat-annulus fragment shader reads as "the old
rings" up close. v2 makes the ring a **two-tier object with LOD**: the v1 impostor annulus is
reused as the always-on FAR tier (it looks fine at distance), and a `THREE.Points` particle
cloud layers on top, sized + faded per-particle by camera distance so detail **emerges** on
approach and resolves into individual glinting particles. Because the impostor is always
underneath, there is no pop and no dissolve. Approach B: "emergence, not swap."

**Architecture:**
- **Pure baker** `bakeRingCloud(physics, opts)` (`ring-particle-cloud.js`, repo root) — samples
  particles (rejection sampling, area-weighted by r) from the SAME `generateRingPhysics()`
  ringlet/gap density profile the impostor draws, so the cloud↔impostor seam is invisible.
  Returns flat typed arrays. Pure + unit-tested (`tests/ring-particle-cloud.test.js`).
- **Cloud factory** `makeRingCloudPoints(baked, opts)` — a `THREE.Points` with a point-sprite
  shader adapted from `src/objects/Galaxy.js`, but NormalBlending (not additive), a
  camera-distance LOD ramp (`smoothstep(dResolve, dCull)`), a per-particle analytic
  planet-shadow, and the 6-level posterize + Bayer dither retro envelope.
- **Harness** `rings-lod-lab.html` (repo root) — standalone scene + plain planet + ported v1
  impostor + cloud + camera/RT controls, where the mechanism was proven before integration.
- **Integration** — in `world-engine-lab.html` the cloud is built next to the existing impostor
  `ring`, driven by the SAME `state.ringsEnabled` toggle, tilted per-frame via
  `ringCloud.quaternion.copy(ring.quaternion)` (coplanar with the impostor under axial tilt).

**Tuning finding (visual gate):** disk **thickness MUST stay physically thin** (real rings are
razor-thin) — `thickness: 0.01` → yHalf ≈ 4% of planet radius, reads as a real thin ring
edge-on. Since thickness can't buy richness, in-plane **density (count)** carries it:
`count: 400000` reads dense from flyby/ansa angles (800k = diminishing returns). The near ring
*face* stays sparse up close — physically correct for a thin ring. A denser-near-foreground
option (recycled-proximity-patch) was scoped and **deferred** (Max chose ship-thin+static,
2026-06-13); revisit only if UAT wants more foreground richness.

---

## 6.5 Build plan — v1 (SUPERSEDED by v2 above; envelope/shadow/dither still valid reference)

### Feasibility verdict — CLEAN (scene-mesh, not fullscreen-shader)
The lab is a REAL THREE scene, not a single fullscreen raymarched quad. Evidence (LIVE world-engine-lab.html):
`new THREE.WebGLRenderer` (116), `new THREE.Scene()` (121), `PerspectiveCamera` (122), the planet is a real
`new THREE.SphereGeometry(R,256,256)` → `new THREE.Mesh` → `scene.add(planet)` (4385-4388), and the main loop
does `renderer.render(scene, camera)` into a low-res RT then a nearest-blit upscale (7219-7223). The blit is ONLY
a post pixelation pass — the dither/posterize live in each object's own fragment shader, not in the blit. So a ring
is just a SECOND mesh added to the same `scene` with its own ShaderMaterial. There is exactly one prior-art for this
in the lab: the **hazeShell** (`new THREE.Mesh(new THREE.SphereGeometry(R*1.15,…), hazeShellMat)` + `scene.add` at
4451-4453, toggled per-frame by `hazeShell.visible = …` at 6775). The ring follows that pattern verbatim — only the
geometry (RingGeometry, equatorial) and the shader differ. NO awkward surgery, NO raymarch-into-quad.

### Approach: port the production annulus, swap its shader body for the dead RingRenderer ringlet/gap loop
Build a single ring mesh in the lab using the **production `_createRing()` envelope** (Planet.js:1105-1235 — those
card line numbers are LIVE-accurate) for geometry, vertex shader, planet-shadow cylinder, Bayer dither-discard
(1225), 6-level posterize (1183-1187, 1227), and the moon-gap loop (1208-1212). Then **replace the fake-sine band
body** (Planet.js:1194-1202) with the **dead `RingRenderer.js` physics-driven ringlet/gap loop** (RingRenderer.js:208-235:
per-fragment ringlet rectangles with smoothstep edges × resonance-gap notches, composition color from
`COMPOSITION_COLORS` at RingRenderer.js:28-33). Feed it from a **CPU-side `generateRingPhysics()` call**
(PhysicsEngine.js:793-905 — Roche inner edge 844, moon-clipped outer 847-857, age-decay density 858-862,
2:1/3:1 resonance gaps 866-887, ringlet partition 889-903) flattened into the same Float32Array uniform layout
RingRenderer already builds (RingRenderer.js:69-101). Add the ONE new term §4 calls for: an `fwidth(t)`
band-limiting clamp on the ringlet density so fine bands fade to their mean at grazing angles instead of moiréing
against the 4×4 Bayer grid (the sine fake had none).

### PROV decision (lesson 3): DO NOT register rings in FEATURES — use a standalone toggle
`setFeatureEnables()` (LIVE 6607-6612) loops `Object.keys(FEATURES)` and the test `tests/planet-archetypes.test.js:127`
hard-asserts `keys(PROVINCES).sort() === keys(FEATURES).sort()`, plus each row needs a `provinceWeight` GLSL arm
(test 115-123). A ring is a **separate mesh, not a surface province** — it has no `provinceWeight` meaning. Registering
it in FEATURES would force a meaningless PROV row + GLSL arm just to satisfy the test. So: **add a standalone
`state.ringsEnabled` boolean + its own lil-gui checkbox**, NOT a FEATURES entry. This means NO edit to
`planet-archetypes.js` and NO edit to `tests/planet-archetypes.test.js`. Trade-off: rings won't get the automatic
🔆-solo button (6630-6632) or archetype-filter row — acceptable; add a plain checkbox in a new `Rings (F51)` folder.
(Highest PROV id is currently `PROV_ECUMENOPOLIS`; we deliberately do NOT consume id 46.)

### Host preset (lesson 4): hang the ring off an existing preset for first light
None of the DRIVER_PRESETS is a gas giant with rings. For first light, DON'T add a new archetype — drive
`generateRingPhysics()` with a hand-built params object (origin 'roche', a planetDensity/moonDensity pair, an
`ageGyr`, one synthetic inner moon to clip the outer edge + carve a 2:1 gap) independent of the surface preset, and
render the ring on whatever body is shown. The card §5's "Frozen (airless)" works as a visual host. A dedicated
ringed gas-giant preset is a later polish step, not first-light.

### Exact edit sites (LIVE world-engine-lab.html line numbers)
1. **Ring uniforms + material + mesh** — insert immediately AFTER the hazeShell block (after 4453, before the
   render-target section at 4467). Mirror the hazeShell structure: a `ringUniforms` object, a `ringMat`
   (`THREE.ShaderMaterial`, `side: THREE.DoubleSide`, `transparent:true`, `depthWrite:false` like the production
   ring), `new THREE.Mesh(new THREE.RingGeometry(innerR,outerR,64).rotateX(PI/2), ringMat)`, `ring.visible=false`,
   `scene.add(ring)`.
2. **Per-frame uniform writes + tilt + visibility** — in the frame loop near the hazeShell writer (6773-6775).
   Write `ring.quaternion.copy(planet.quaternion)` so the annulus tilts with the body (axial tilt = planet spin
   axis), copy `lightObj`→ring lightDir (object-space, same as the planet's 6745-6746), and
   `ring.visible = !!state.ringsEnabled`.
3. **Enable toggle + GUI** — add `ringsEnabled: false` to the `state` object (near 4503+), and a new
   `guiLeft.addFolder('Rings (F51)')` with `.add(state,'ringsEnabled').name('show rings')` near the feature-folder
   setup (~6630) or the presets folder (~6645).
4. **`window._lab` hook** — add a `rings()` convenience or extend `solo` is NOT applicable (rings isn't a FEATURES
   key); instead expose `window._lab.rings = (on)=>{ state.ringsEnabled = on!==false; }` near the `_lab` object
   (7280-7282) so the :9223 recipe can toggle it.

### Port-from / resurrect-from / read-from (summary)
- **Port envelope from** `_createRing()` (Planet.js:1105-1235): geometry+rotateX, vertex shader, bayerDither +
  posterize fns, planet-shadow cylinder (1214-1223), dither-discard (1225), moon-gap loop (1208-1212).
- **Resurrect band body from** `RingRenderer.js:200-272` (the `if (uRingletCount>0)` physics branch 208-235 +
  its uniform-array build 69-101 + `COMPOSITION_COLORS` 28-33). Drop the legacy sine `else` branch (236-246) —
  we always have physics in the lab.
- **Read physics from** `generateRingPhysics()` (PhysicsEngine.js:793-905). Call it CPU-side in the lab with a
  synthetic params object; flatten `ringlets[]`/`gaps[]`/`density`/`composition` into the Float32Array uniforms.

### GLSL reserved-word check (lesson 2)
`partition` is the high-risk word here (rings "partition" into ringlets) — it is a GLSL reserved word and will
BLACK OUT the whole lab with no static-test catch. Do NOT name any GLSL identifier `partition`. Use a `uRing*`/`ringT`
prefix throughout. Also avoid `sample`, `filter`, `input`, `output`, `active`, `common`, `resource`. Reuse the
production names that are already proven safe (`uRingletInnerR`, `uGapCenters`, `vPos`, `vRelWorldPos`, `ringColor1`).

### Ordered implement checklist (next dispatch follows this)
1. Add `state.ringsEnabled = false` to the lab `state` object.
2. Write a `makeRingPhysics()` helper in the lab that calls `generateRingPhysics()` with a synthetic params bundle
   (origin 'roche', densities, ageGyr, one synthetic inner moon) → returns the physics object.
3. Build `ringUniforms` + flatten physics into Float32Arrays (copy RingRenderer.js:69-101 logic).
4. Build `ringMat` = ShaderMaterial: vertex shader (port Planet.js:1132-1147) + fragment shader (port the envelope
   from Planet.js:1150-1230 but swap the band body 1194-1202 for the RingRenderer physics loop 208-235; ADD the
   `fwidth(t)` band-limit clamp on density). DoubleSide, transparent, depthWrite false.
5. `ring = new THREE.Mesh(RingGeometry(innerR,outerR,64).rotateX(PI/2), ringMat)`, `visible=false`, `scene.add`.
   Insert after 4453.
6. Per-frame (near 6773): `ring.quaternion.copy(planet.quaternion)`, write light dir, `ring.visible = state.ringsEnabled`.
7. Add the `Rings (F51)` GUI folder + checkbox + `window._lab.rings()` hook.
8. Sanity: load lab, `window._lab.rings(true)`, set distance ≈12 face-on → annulus reads with discrete ringlets +
   one dominant Cassini gap; distance 3-5 near ring plane → planet-shadow bite + dither translucency; sweep pitch
   to edge-on → confirm fwidth clamp kills moiré. (NO FEATURES/PROVINCES test should be touched — run `npm test` to
   confirm planet-archetypes.test.js still passes unchanged.)

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- **Rating: 🟡** — clean pass on all 8 UAT items AFTER tuning, but the gap-width and
  opacity tunes are read-driven stylization (not physics-faithful), so there's a taste-call
  for Max on how literal vs. legible the dominant gap should be (see Taste-call below).
- **Host used:** `Frozen (airless)` preset. The central body renders with a cyan tectonic
  grid under the default seed (it's the province/voronoi structure, not preset-specific —
  `provinceWeight=0` did not visibly clear it without a driver re-derivation). The grid does
  NOT bleed into the ring; the ring physics is independent of the surface preset, so it was
  judged cleanly regardless.

- **What was judged (8/8 pass after tuning):**
  - ☑ Flat equatorial annulus, not a billboard — confirmed by tilting pitch: the ring
    foreshortens into an ellipse locked to the planet plane (`F51-faceon-tilt.png`,
    `F51-tuned-on.png`).
  - ☑ 3-5 discrete ringlets, not a smooth gradient — physics yields 3 ice ringlets; after the
    opacity lift + alternating contrast they read as distinct light/dark bands, not a ramp.
  - ☑ ONE dominant Cassini-analog gap readable at distance — the widened 2:1 gap reads as a
    commanding dark clearing at d=12 AND d=25 (`F51-far-d25-tuned.png`); the finer 3:1 gap
    appears as a subordinate inner clearing up close.
  - ☑ Sharp-edged planet-shadow bite with stars through it — top-down view shows the shadowed
    arc going sparse (stars visible) while the lit arc stays dense (`F51-shadow-topdown.png`).
  - ☑ Bayer dither translucency clean at the limb — no halo / sorting artifacts where the ring
    crosses the planet limb at the near-edge-on grazing pass (`F51-edgeon-grazing.png`).
  - ☑ Composition family reads — cool ice-blue palette posterizes cleanly within 6 levels.
  - ☑ Stable bands at grazing/edge-on — the `fwidth` band-limit clamp fades fine bands to their
    mean; no moiré shimmer at pitch≈0.04 (`F51-edgeon-grazing.png`).
  - ☑ Ring presence reads as a world property — density/shadow/banding cohere as a real disk,
    not a decal. ON/OFF delta is total (`F51-tuned-off.png` vs `F51-tuned-on.png`): the entire
    annulus vanishes with rings off, confirming the term fires.

- **Tweaks applied** (all lab-only, `world-engine-lab.html`; physics ENGINE untouched):
  - **Gap-width presentational boost** (flatten loop ~4521): physics gap widths (~0.035 R_p
    dominant 2:1, ~0.02 R_p 3:1) are sub-Bayer-cell and never registered. Sorted gaps by width,
    gave the dominant (widest) gap a **0.34 R_p half-width** and subordinate gaps **0.12 R_p**,
    so ONE commanding clearing reads + thinner ones stay subordinate. (was: raw physics widths →
    now: 0.34 / 0.12 R_p half-widths)
  - **Ringlet opacity lift + alternating contrast** (flatten loop ~4513): effective opacities
    were ~0.29-0.37 (base × density 0.64) and clustered → read as a gradient. Lifted base ×**1.6**
    and pushed adjacent ringlets apart (**odd ×1.15 / even ×0.78**) so band boundaries read as
    discrete steps. Physics ordering preserved; only amplified. (was: `rl.opacity*density` →
    now: `min(1, base*1.6*altContrast)`)
  - **Comment fix:** corrected the stale `makeRingPhysics()` comment "orbit = 4 planet radii" →
    "orbit = 9 planet radii" to match the code's `orbitRadiusEarth: 9.0`.

- **Re-verify (after tuning, lab reloaded, ZERO console errors):** d=12 face-on → discrete
  ringlets + one dominant gap; d=25 far → dominant gap still readable; d≈4.5-9 near plane /
  top-down → sharp planet-shadow bite with stars through the shadowed arc; pitch≈0.04 edge-on →
  no moiré, clean limb crossing. ON/OFF delta total at the same camera.

- **Taste-call for Max (the 🟡):** the dominant gap was widened to 0.34 R_p half-width (~0.68 R_p
  visible) — physically the Cassini-class gap is far narrower (~0.035 R_p), so this trades
  physical literalism for legibility in the 6-level posterized retro envelope. Dial it down toward
  physics if you want a subtler, more naturalistic gap, or keep it bold for the "unmistakably
  ringed planet at a glance" read.

- **Shots saved** (`docs/FEATURES/cards/shots/`, gitignored): `F51-faceon-on.png`,
  `F51-faceon-off.png` (pre-tune ON/OFF delta), `F51-faceon-tilt.png`, `F51-closeup-d8.png`,
  `F51-far-d25-before.png`, `F51-faceon-tuned.png`, `F51-far-d25-tuned.png`,
  `F51-nearplane-shadow.png`, `F51-shadow-bite.png`, `F51-shadow-topdown.png`,
  `F51-edgeon-grazing.png`, `F51-tuned-off.png`, `F51-tuned-on.png`.

- **Max's UAT feedback (2026-06-13): REWORK NEEDED — v1 rejected.** The flat-annulus
  shader still reads as "pretty much the old rings" (the production sine-fake look it
  replaced). Max wants rings that **look like genuine 3D objects that interact with the
  scene dynamically and have their own LOD** — close enough and the ring should **resolve
  into individual particles** (instanced geometry / particle chunks near; impostor/shader
  annulus far; smooth LOD transition between). This is an ARCHITECTURAL rethink, not a
  tuning pass — the current single-RingGeometry + fragment-shader approach is the wrong
  substrate for it. See the handoff for the rework brief. The v1 build + envelope plumbing
  (dither/posterize/shadow) is still useful reference, not throwaway.

- **Status: v1 built (`093523c`, VERIFIED then REJECTED at Max UAT 2026-06-13) → REOPENED for 3D-LOD-particle rework. Status: reopen.**

────────── v2 (3D LOD particle ring) ──────────

- **Rating: 🟢 VERIFIED_PENDING_MAX `9bcd71d`** — integration green on working-Claude's live
  checks; UAT (does the close-flyby read as genuine 3D resolving to particles, beating the v1
  rejection?) is Max's gate alone. NOT Shipped until Max signs off.

- **What was built (Tasks 1-7, plan `2026-06-13-f51-rings-3d-lod-particle.md`):** the two-tier
  impostor+cloud substrate (see §6.5 v2). Pure baker + factory (`ring-particle-cloud.js`,
  7 unit tests), proven in the standalone harness `rings-lod-lab.html`, then integrated into
  `world-engine-lab.html` next to the existing impostor `ring`, driven by the same
  `state.ringsEnabled` toggle.

- **Working-Claude live integration checks (:9223, all ✅):**
  - Cloud renders in the production lab — 400k particles, visible under the rings toggle.
  - Both tiers compose: impostor band (far) + emerging particle cloud (near) over the same
    physics profile; no double-render in the LOD band.
  - **No pop/dissolve** — per-particle `smoothstep(dResolve=4, dCull=14)` alpha ramp with the
    impostor always rendering underneath; no discrete switch exists in the code path.
  - **Coplanarity under axial tilt** — rotated the planet; the cloud quaternion exactly tracks
    the impostor's (`coplanarMatch: true`), so the seam holds when the ring tilts/spins.
  - **Toggle drives both tiers** — `rings(false)` hides cloud + impostor together; `rings(true)`
    shows both. Zero console errors after integration (only a pre-existing GUI form-field lint).
  - Mechanism verdict: **80k+ static points DO resolve as individual glinting particles** up
    close → static-buffer approach holds, recycled-proximity-patch NOT needed (deferred).

- **UAT items still owed to Max (the PENDING):** (1) does the close flyby beat v1's flat-band
  rejection — genuine-3D-resolving-to-particles, not "the old rings"? (2) is the near-face
  density acceptable (thin ring → physically sparse near face), or build the proximity-patch?
  (3) is `thickness 0.01 / count 400k` the right default, or tune the live dials
  (dResolve/dCull/pointScale/sizeClamp)? (4) a mixed-composition seed shows color banding the
  current all-ice test seed doesn't.

- **Shots saved** (`docs/FEATURES/cards/shots/`, gitignored): harness —
  `rings-lod-far-d25.png` (impostor only, cloud faded), `rings-lod-flyby-thick.png` +
  `rings-lod-flyby-px3-bothtiers.png` (cloud resolving / both tiers at ÷3),
  `rings-lod-thin-400k-flyby.png` + `rings-lod-thin-800k-flyby.png` (thin-ring density),
  `rings-lod-thin-edgeon.png` (thin reads as a real ring edge-on); lab —
  `F51-v2-lab-flyby.png`, `F51-v2-lab-oblique.png`, `F51-v2-lab-near.png`. Compare against v1
  baseline `F51-faceon-tuned.png`.

- **Lab sliders added (`71eea7a`):** all 6 cloud variables are now live GUI sliders in the
  `Rings (F51)` folder — `point scale`, `LOD resolve dist`, `LOD cull dist`, `size clamp` (live
  uniforms) + `count (rebake)`, `thickness (rebake)` (dispose+rebuild, preserving live uniform
  values; thickness capped at 0.06 to enforce physical thinness). Verified live on :9223: a
  count rebake rebuilds the cloud (400k→600k), stays visible, and preserves the live uniform
  values across the swap; live sliders move the current cloud after a rebake (no stale closure).
  (`F51-v2-lab-sliders.png`.) Build site was refactored into `buildRingCloud()` + deferred past
  the `state` declaration (the inline build sat in `state`'s temporal dead zone once it read
  `state.ring*`); `ringCloud`/`ringBaked` are now module-scope `let` for rebake swapping.

- **Max sign-off (2026-06-13): "these all seem good to me so far — go ahead with this."**
  Approach approved in principle; the sliders were his one ask before fine-tuning. Status stays
  VERIFIED_PENDING_MAX — final UAT (the cohesive-whole + slider-driven tuning call) remains
  Max's gate; no agent closes it. Then handed off to a fresh session for the bigger LOD-workstream picture.

- **Status: v2 built + slider-tunable (HEAD `71eea7a`) → VERIFIED_PENDING_MAX.
  Max approved-in-principle; awaiting his slider-driven UAT. Status: verified-pending-max.**
