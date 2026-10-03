# Galactic Engine — plan (DRAFT 2026-10-03, pre-scoping)

> Working name: **Galactic Engine** = the rendering engine for galaxy-scale features (the Milky Way, nebulae,
> giant molecular clouds, dark clouds, supernova remnants, star-forming regions) — in the sky, up close, from
> inside, and in the nav computer's maps. Sibling of the World Engine (the world/moon renderer).
> Branch `feature/galactic-engine`, worktree `~/projects/wd-galactic`.
> Status: **v2 — revised after Astra review (`.astra/jobs/20261003-102428-galactic-engine-plan-review/report.md`). No code yet. Scoping (`dev-collab-scope`) comes after Max reacts.** Built under the `lab-wired-to-game` skill.

## 1. What Max wants (his words, 2026-10-03)

- "figuring out where a huge galactic feature is, how it renders when the player is in a system that is close
  enough to see it, and how the rendering changes, and how close the player is, including getting quite close to
  them or even being inside of them, such that they meaningfully color a huge part of the star field"
- The Milky Way: "most of the time inside … it's all around you, and also it's far away from you … if you get far
  enough away from the galaxy, at any given angle, you can see more and more of its shape"
- "eventually … render representations of these huge features from the top down in the navigation menus when we
  zoom into region and sector views"
- Same basis as the World Engine: "understanding the history or story of any given galactic feature based on the
  procedural generation data and then using that as the basis for all of the variables that go into rendering"
- ⭐ "I want to avoid what we did with world engine … it took like a month to wire all that stuff up … I want this
  to be working in parallel from day one."

## 2. What the game has today (measured on master `172c613`, research 2026-10-03)

**Keep (sound foundations):**
- `GalacticMap.js` — galactocentric kpc coordinates, a real potential-derived density model (disc, thick disc,
  bulge, halo, Cox-Gomez spiral arms, bar), deterministic per-region feature placement (4 kpc cubes, LRU cache),
  per-feature context (age, metallicity, arm strength). 6 tests.
- `KnownObjectProfiles.js` — 37 real objects (Orion, Crab, …) injected over procedural ones.
- The sky rebuilds once per warp (`prepareForPositionAsync` during FOLD) with an origin/destination crossover.

**Replace (it is the wrong shape for what Max wants):**
- `ProceduralGlowLayer.js` — the Milky Way band, a 16-step raymarch **every pixel, every frame** at full resolution,
  with its OWN copy of the galaxy density (simplified, arms rotated ~14° from the CPU model that places features).
- `SkyFeatureLayer.js` — nebulae are flat billboards with 6 shape modes. No size cap: near a nebula the plane is
  bigger than the sky sphere. Inside one, the billboard is skipped and the feature **vanishes**. The "15 % inside
  tint" the docs claim is computed but **nothing renders it** (only the debug panel reads it).
- `NavGalaxyRenderer.js` — the nav backdrop is a THIRD copy of the galaxy density (no clouds, no features).
- Two unrelated GMC systems (a CPU list of 140 clouds with no renderer; a GPU noise field unrelated to it).

**Dead code to retire as we go:** `GalaxyGlowLayer`, `GlowTextureManager` (instantiated, never used),
`GalaxyVolumeRenderer` + offline PNG pipeline, `MilkyWayModel.js`, `objects/MilkyWay.js`, `GalaxyCloud.js`,
`GalaxyNebula.js`, five never-called `SkyFeatureLayer` methods.

**The core defect in one line:** there are three galaxies (CPU placement, sky shader, nav shader) that disagree,
and no nebula model at all — just pictures of nebulae.

## 3. Lessons carried from the World Engine (why its wiring took a month)

From `one-pipeline-two-frontends-PLAN.md` / `lab-pipeline-into-game-PLAN.md`:
1. The real logic lived inside a 6,500-line lab HTML file nothing could import; every feature reached the game by an
   agent re-typing it, and the copies drifted. → **Here: the lab HTML holds sliders and a camera, nothing else.**
2. The game had no real consumer — only a hand-invoked debug hook. → **Here: the game mounts the real consumer in
   slice 1, behind a flag with an A/B key.**
3. The shader assumed the lab's world (unit radius, origin, no rebasing, no log depth). → **Here: the lab runs the
   game's own render path (same render target, same resolution/dither pass) from day one.**
4. Two constructors for the engine's input disagreed by 3–6×. → **One `featureHistory()` constructor, called by both.**
5. Correctly wired, degenerate inputs (all 144 giants had the same value). → **A distinctness fence from slice 1.**
6. Material swaps silently dropped features. → **A parity ledger when we replace each old layer.**
7. 1,500-line plans with citation rot. → **This plan stays short; detail lives in code + tests.**

## 4. Architecture — one model, one integrator, one controller, several views

Same layering as the World Engine: *procgen decides, the renderer expresses.*

```
 L0  GalacticMap (keep)            where things are: density model + feature placement + known objects
  │
 L1  featureHistory(feature)       the feature's STORY, pure + headless, typed units, three separate clocks
  │                                 (star-population age, cloud age, time since explosion); ionizing sources
  │                                 (position, luminosity, hardness); gas mass/extent, clumping, density gradient;
  │                                 dust-to-gas; metallicity; orientation; provenance (procedural vs catalog).
  │                                 Feature-keyed random streams, so adding a field never reshuffles the galaxy.
  │
 L2  render packs                  history → render parameters. Physics says WHICH WAY each knob pushes;
  │                                 a declared display palette says what colour that is (Hα red, [OIII] teal via an
  │                                 explicit hardness mapping, dust reddening as RGB transmittance).
  │
 L3  GalacticField (GLSL, once)    sampleMedium(p) → emission per unit length (RGB) + extinction (RGB, 1/length).
  │   + CPU twin for tests          Analytic Milky Way (light weights per component — dark matter emits nothing)
  │                                 + catalog features via spatial candidate lists, never "scan every feature".
  │
 L3b ONE integrator                 march(ray, interval) → radiance L (RGB) + transmittance T (RGB).
  │                                 Segments compose:  L = L_near + T_near·L_far,  T = T_near·T_far.
  │                                 Stars are dimmed by T only up to THEIR distance, not the full column.
  │
 L4  ONE production controller      owns prepare → upload → bake scheduling → atomic activation → disposal →
  │   (game AND lab instantiate it) composition into RetroRenderer. Debug snapshot: input hash, bake origin,
  │                                 candidates + omitted count, tiles done, timings, texture bytes.
  │
 L5  views (front-ends, ctx only)
       ├─ sky bake      per system; stores L and T (two RGBA16F cubes; fallback format if float targets missing)
       ├─ live interval  only where moving visibly changes the picture (projected-error budget, see §5)
       ├─ nav map       galaxy / region / sector: orthographic use of the SAME field + integrator, cached tiles
       └─ lab page      a camera + sliders over the controller, rendering through RetroRenderer
```

**There is no "inside" renderer.** Being inside a cloud is just rays that start inside it
(`entry = max(entry, 0)`). The bake already captures the cloud's structure around you; the inside/outside
boundary is smooth because it is one volume. (Today's `insideFeature` switch is what makes nebulae vanish.)

**Precision:** positions are subtracted in CPU doubles; the GPU gets feature-relative and system-relative
coordinates. (float32 at 8 kpc resolves only ~197 AU.)

**Code boundary:** `src/galactic/` is headless (history, packs, CPU field twin). GLSL lives once in
`src/galactic/shaders/`. Controller, bakers, compositor in `src/rendering/galactic/`. RetroRenderer stops reaching
into the sky layers' private fields and talks to the controller's interface.

## 5. When to bake vs draw live — measured, not assumed

Rule: bake everything that would not visibly change as you move around the system. "Visibly" = projected error
in screen pixels, from the bake origin, at the current FOV, for the closest meaningful structure (not the
feature's centre), with hysteresis. Rough guide only: 100 AU of travel moves things beyond ~0.4 ly by under one
pixel at 240p — so most systems need nothing live. Live drawing is for systems right next to structure.

Cost is bounded by design: spatial candidates per ray, ray-vs-bounds intervals (64 uniform steps over 30 kpc
would skip anything smaller than ~470 pc), a visible overflow counter instead of silent truncation.
Benchmarks (16/32/64 bake candidates; 1/3/8 live) are measured in S1a, not promised now.

**Warp:** the bake runs as bounded tiles across FOLD/ENTER/HYPER (≈ 8.5 s), against the real dual-portal
lifecycle: immutable origin/destination snapshots, a generation token, programs pre-compiled, a cube is shown
only when every face is done, defined timeout + fallback, no stale completions. Flying THROUGH clouds during warp
is deferred until warp has a real path through galactic space.

**Sky resolution:** today the sky renders at full resolution. The new medium pass renders low-res and dithers in
screen space after composition (never per cube face — faces would show seams).

## 6. Slices — each visible IN THE GAME and in the lab the day it lands

**S1a — One galaxy, end to end.** Simple analytic Milky Way + integrator + bake + controller + game flag
`wd.galacticEngine` with an A/B key + lab on RetroRenderer. Includes a test sphere of glowing/absorbing gas to
prove composition before any nebula exists. *Visible:* the Milky Way band in-game, drawn by the new engine.

**S1b — The galaxy agrees with itself.** CPU/GPU field agreement against `GalacticMap` (fixes the 14° arm
offset — a declared change to every system's sky), views from outside the galaxy, and the nav galaxy backdrop
switched to the same field. *Visible:* nav map and sky match; fly out of the disc and see the galaxy's shape.

**S2 — One cloud, far → near → inside.** One emission nebula with dust, from its history, correct far away, at
its edge and inside, with the star field reddened/dimmed by its dust. A small top-down view of it too.
*Visible:* Max's core ask, on one cloud.

**S3 — The family.** Dark clouds / GMCs (one system replaces today's two), reflection nebulae, supernova
remnants, planetary nebulae, real catalog objects with real-ish histories (today every known object gets
age 10 and metallicity 0 — placeholders that must not become "history").

**S4 — Maps.** Region and sector nav views draw features from the same field.

**Later:** pillars at ionization fronts, fine filaments (need filtering at 240p or they sparkle), fly-through
during warp.

## 7. Acceptance gates for S1 (proposed; Max's UAT is separate and always last)

- Six fixed poses (Sun's neighbourhood, galactic centre, disc edge, above the disc, outside face-on, outside
  edge-on), six axis views each plus cube corners, identical inputs in lab and game.
- 1,000 CPU/GPU field probes within `1e-4 + 1e-3·|ref|`, all finite and non-negative; reference = `GalacticMap`.
- Test sphere within 1 % of its analytic answer; doubling steps changes the image ≤ 1 % RMS.
- Bake vs converged live reference ≤ 1 % RMS, 99th percentile ≤ 3 %.
- Lab vs game sky capture ≤ 1/255 per channel, same GPU, frozen state, including after rebasing and resize.
- 20 consecutive warps incl. rapid retargeting and a deliberately slow bake: no partial cube, stale sky, or
  leaked textures.
- Performance on Max's desktop (RTX 5080) AND a phone: ≤ 2 ms p95 GPU per bake frame, ≤ 1 ms steady composition,
  ≤ 1 s warm bake. Cold numbers recorded separately. Negative control: changing one arm parameter must fail parity.

## 8. Risks still open

- Performance is unmeasured until S1a runs. The phone is the real constraint, not the desktop.
- File collision with the nav-menu session: S1b touches `NavGalaxyRenderer.js`. Coordinate before it merges.
- Unresolved galaxy glow + individual stars need one shared brightness budget or starlight is counted twice.
- Context loss, cache eviction, revisiting systems: ownership defined in the controller from S1a.
- `findNearbyFeatures` only searches neighbouring 4 kpc regions — an outside-the-galaxy view needs a separate
  coarse whole-galaxy representation.
