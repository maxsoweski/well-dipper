# Galactic Engine — plan (DRAFT 2026-10-03, pre-scoping)

> Working name: **Galactic Engine** = the rendering engine for galaxy-scale features (the Milky Way, nebulae,
> giant molecular clouds, dark clouds, supernova remnants, star-forming regions) — in the sky, up close, from
> inside, and in the nav computer's maps. Sibling of the World Engine (the world/moon renderer).
> Branch `feature/galactic-engine`, worktree `~/projects/wd-galactic`.
> Status: **draft for Max + Astra review. No code yet. Scoping (`dev-collab-scope`) comes after Max reacts.**

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

## 4. Architecture — one model, several views

Same layering as the World Engine: *procgen decides, the renderer expresses.*

```
 L0  GalacticMap (keep)           where things are: density model + feature placement + known objects
  │
 L1  featureHistory(feature)      the feature's STORY, derived once on the CPU, pure + headless:
  │                                age, ionizing population (Q), gas density n, metallicity, dust-to-gas,
  │                                supernova energy + time since, orientation, morphology seed
  │
 L2  render packs                 pure functions: history → render parameters, physically grounded:
  │   (like driver packs)          Strömgren radius R_s=(3Q/4πn²α)^⅓ · Hα/[OIII]/[SII] line weights ·
  │                                dust optical depth + reddening · shell radius (Sedov) · pillar/filament preset
  │
 L3  GalacticField (GLSL, ONE    sampleMedium(p) → (emission RGB, extinction RGB)
  │   source file)                 = analytic Milky Way (disc/bulge/bar/arms/dust) + catalog features read from a
  │                                small data texture. Plus a CPU twin of the analytic part for tests.
  │
 L4  views (front-ends)           each supplies only a ctx: camera, scale, resolution, step budget
       ├─ sky bake      per system, a cube map marched outward from the system (galaxy band + far features)
       ├─ near volume   live raymarch of the 1–3 nearest features (approach, warp, parallax)
       ├─ inside        local fog/glow + starfield extinction when the system sits inside a feature
       ├─ nav map       galaxy / region / sector views: orthographic marches of the SAME field, cached as tiles
       └─ lab page      any vantage point (inside the disc, at the edge, outside the galaxy), same code
```

**Why one field matters:** if the sky and the map both call `sampleMedium`, a nebula that is red with a teal core in
the sky is red with a teal core on the map, and the arms are in the same place in both. Today they are not.

**Code boundary:** `src/galactic/` is headless (history, packs, CPU field twin — no three.js). GLSL lives once in
`src/galactic/shaders/`. GPU-coupled code (bakers, materials) goes in `src/rendering/galactic/`. Fence test: no
shader text duplicated, lab imports only from `src/`.

## 5. When each view is used — distance criteria

The deciding number (research, arithmetic): at 240p, a pixel is ~0.004 rad. Moving 100 AU inside a system shifts
anything beyond ~0.4 light-years by less than a pixel. So **almost everything can be baked once per system** —
which is also much cheaper than today's every-pixel-every-frame march.

| Player's situation | What draws it | Cost |
|---|---|---|
| Feature far away (small patch in the sky) | sky bake | once per warp, hidden by the warp |
| Feature big in the sky but > a few ly away | sky bake (bigger, more detail) | same |
| System within a few ly of a feature's edge | near volume (real parallax as you fly) | live, low-res, 32–64 steps |
| System inside a feature | inside: glow all around, starfield dimmed/reddened by dust, bake shows the rest | ~free |
| In warp, crossing light-years | near volume for features you pass, bake crossfade | live |
| Outside the galaxy / at the edge | sky bake shows the whole galaxy's shape from that angle | once per warp |
| Nav galaxy view | orthographic march, cached texture | once |
| Nav region / sector view | orthographic march of features in the box, cached tiles | per tile, cached |

The retro look helps: 240p is ~27× fewer pixels than 1080p, and the existing Bayer dither hides low step counts.

## 6. Slices — each one visible IN THE GAME and in the lab on the day it lands

**S1 — One galaxy.** Build `GalacticField` (analytic Milky Way only) + the per-system sky bake. In the game, behind
flag `wd.galacticEngine` with an A/B key, it replaces `ProceduralGlowLayer`'s band. The nav galaxy backdrop switches
to the same field. The lab page shows the same field from inside, the edge and outside. Fences: sky/map/CPU arms
agree; bake ≈ live-march reference; frame-time measured on Max's machine.
*Visible result:* the Milky Way band in-game, from any system, drawn by the new engine; the nav map and the sky now
agree; flying far out of the disc shows the galaxy's shape.

**S2 — Nebulae with a story.** `featureHistory` + render packs for emission nebulae (H II regions); features enter
the bake. Replaces far billboards. *Visible:* nebulae whose colour and size come from their star population, age and
dust — not 6 stock shapes.

**S3 — Getting close and inside.** Near-volume view + inside view. Warping to a nebula no longer makes it vanish; the
star field takes on its colour; structure has parallax. *Visible:* Max's core ask.

**S4 — The dark side.** Dark nebulae / giant molecular clouds (one system, not two), dust reddening of the
starfield, reflection nebulae, supernova remnants, planetary nebulae, pillars at ionization fronts.

**S5 — Maps.** Region and sector nav views draw features from the same field.

## 7. Risks (stated up front)

- **Performance is unmeasured.** The research numbers are sample counts, not milliseconds. S1 measures on Max's
  laptop before anything else is built on top. Mobile may need smaller bakes (128² faces).
- **Bake time during warp.** A cube bake must fit in the FOLD window; plan is one face per frame. Unmeasured.
- **Dither "swimming" on a baked cube** when the camera turns — the dither must be applied in screen space after
  sampling, or anchored to the sky. Needs a look test by Max.
- **File collision with the nav-menu session** (other Claude): S1 touches `NavGalaxyRenderer.js` and possibly
  `NavComputer.js`. Coordinate before S1 lands on master.
- **Precision:** kpc-scale field, AU-scale camera. The field is sampled in system-relative coordinates.
- **Physics fidelity is approximate by design** — real line ratios need photoionization codes; we use simple laws
  tuned by eye. Max judges the look; the physics only supplies *which way* each variable pushes.
- **"Fixing the arms" moves the sky** in every system (the 14° disagreement). That's an intended pixel change and
  will be declared, not hidden.

## 8. Open for Max

See the session recap — kept out of this doc so it does not rot.
