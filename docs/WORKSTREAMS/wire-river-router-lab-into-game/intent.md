# wire-river-router-lab-into-game — intent

## Why we care

Max, 2026-08-26: *"Our goal is to wire up the World Engine renderer. If the world engine renderer is
missing something important, then we need to log that as something important to work on after we get
things wired up. But we can't shoestring everything together."*

Standing constraint #3, Max 2026-07-31: **"REPLACE, not graft"** — *"the goal here is to have the lab's
rendering pipeline in the game — the procgen and the rendering itself."*

Why the rivers, in his words. On the old worm-trail F11 (2026-06-17): *"rivers run in straight sections
and then they branch off almost like trees when they meet larger bodies of water; these just don't look
like rivers."* The lab answered with the dendritic router (`rivers-dendritic-drainage-2026-06-17`, shipped
`eca2973`, his UAT passed) and then made the fluvial family depend on it (`rivers-fluvial-coupling-2026-06-19`,
shipped, his UAT passed), toward his north star (2026-06-19): *"landscape generate in such a way as all of
the features are informed by each other and we get distinct illusions of three-dimensional shapes as
opposed to a semi-homogeneous slop or mush of intersecting features that don't feed off each other."*

None of that reaches the game. The province cube shipped 2026-09-02 (*"it does read as a crust and
coheres"*) and built the carrier path — shared mesh → `makeSphereField` → `writeBodyRelief` in a worker →
a cube bound on the body's first draw. Max picked the river router as the lane's next item the same day:
*"Both recs sound good"* (F11/F12 because it rides that path; a fresh session for it).

⭐ **What "F11/F12 the river router" IS, corrected.** The plan's F-spine scores F11 and F12 *"⚠️ inert —
measured .00014 / .00015"* (`one-pipeline-two-frontends-PLAN.md:75-76`). `mvp-spine-lab-quality-backlog.md:84`
corrects that: the .00014 measures `uFluvialDensity`, which the lab pins to 0 on purpose — the OLD
worm-trail carve is RETIRED; the dendritic overlay IS the river feature. The .00015 is a missing-bake
artefact: deltas gate on the carve cube's mouth channel, so a measurement taken without the river bake
reads zero. F11/F12 in the game = `createRiverOverlay.route()` (`planet-lod-rivers.js:602`) and
everything it feeds.

## What the lab does that the game must — the DOES table (feedback_worldengine-does-unlocks-map)

| DOES (output) | driver | player sees |
|---|---|---|
| relief cube `uReliefBakeCube` (R = height, GBA = gradient) + crater cube `uCraterBakeCube` | `writeBodyRelief` → `carrier.height`, margin-composited by `compositeMargins` (`src/worldengine/rivers/router.js:178`: shelf + craters); bound at `uReliefBakeStrength = 1.0 × bakeReliefCrossover(visScaleOf(radiusEarth))` | the body's macro relief IS the lab's history-derived body (plate / shell / volcanic / stagnant-lid) on Earth-sized bodies, blending to the analytic body as size departs 1 R⊕ — the lab's own blend for that body; craters ride through the fade |
| carve cube `uRiverCarveMap` R (valley depth) | `routeAndOrder` (`:602`, priority-flood D∞ + Horton–Strahler) → `buildValleyGeometry` (`:916`, stream-power depth by order) | V-valleys with darkened floors along the REAL drainage (F11 carve) |
| carve cube G (mouth strength ∝ drainage) | sea-mouth nodes weighted by `accum` | deltas and fans at the real mouths, bigger rivers bigger deltas (F12); coast bites at mouths (F20) |
| carve cube B (Strahler order) | the routed graph | the megaflood outflow on the real trunk (F13) |
| the ribbon mesh (a child of the body) | `buildRibbonGeometry` (`:794`, Dunne–Leopold widths, Chaikin-smoothed, lifted; `paramsForRadius` `:304` scales width by radiusEarth and a seeded draw) | the blue river network — straight reaches, tree-branching, widening to the sea (F11 water) |
| `uSeaLevel`, `uLiquidMask`, `uCoastStrength` | `solveSeaLevel` (`planet-lod-sealevel.js:12`) to `TARGET_OCEAN_FRACTION` on wet bodies — the lab's rivers-ON behaviour (`world-engine-lab.html:2990-2992`) | the sea the rivers drain into (F14), coasts (F20) |
| the fluvial driver scalars — `uFluvialActivity/Density/Depth/Meander`, `uDeltaDensity`, `uOutflowDensity/Activity`, `uCoastStrength`, `uStrandStrength`, `uLiquidMask` | the lab's own derivation from `liquidStability` / `precipitation` / `surfaceGravity` / `surfaceHistory.erosion` / `volatileFraction` (`world-engine-lab.html:2123-2167`; `_wet = liquidStability > 0.15` at `:2131`) | which bodies are wet (rivers, sea, deltas, coasts), relict (dry outflow), or airless (nothing) |

**UNLOCKS.** With the relief cube bound, `uReliefBakeStrength` stops being 0 in the game, so every later
lab relief increment (the whole `writeBodyRelief` family) reaches the game's pixels, not just its province
colour. With the fluvial pack, F13 outflow and F20 coastlines are driven (today inert scalars); F21 karst
and F15 dunes derive from the same locals. The worker becomes the ONE bake transport for every cube the
lab's `route()` bakes — the grain cube (`uTectonicGrainCube`) is then one more array in the same message.

## Success criteria (Max's language where he gave it; the wiring rules otherwise)

- The game's rivers are **the lab's router** — router, ribbon builder, valley builder, sea-level solver,
  cube bakers — one module each under `src/`, imported by both front-ends. Not a copy, not a graft onto
  the game's shader.
- On a wet rocky world in a procedural system, rivers **"run in straight sections and branch like
  trees"**, **"widen as they reach the larger bodies of water"**, and **"sit on the planet's real terrain
  — following the actual valleys"**. **"No seams or weird artifacts at the poles."**
- **"The deltas sit at the actual river mouths and the bigger rivers make the bigger deltas"**; the
  outflow runs down the real trunk; the coast bites in where a river reaches the sea. **"It reads as one
  coupled system"** — his north star, not "mush".
- The sea the rivers drain into is **drawn** — today the lab material shows no sea on any game body
  (`uSeaLevel` −1, undriven: `src/worldengine/shaders/uniforms.js:334`). **"The right amount of
  ocean/lakes for the planet … not a puddle or a drowned world."**
- **The terrain a body shows is the terrain its rivers were routed on.** The lab's rule (`route()`
  `planet-lod-rivers.js:688`, fenced by `tests/relief-router-repoint.test.js`): ONE field → ONE cube →
  both consumers, gated by the same strength. So the relief and crater cubes ride along, at the lab's own
  blend for that body.
- **Every solid body gets the fluvial family's drivers from its condition**; gas bodies none; today every
  one is zero.
- ⭐ **Nothing else about the universe moves.**
- The bake has a lifetime and a thread; every cost is **recorded**. VRAM: the carve cube is 1024² × 6
  faces × 8 bytes = **50.3 MB per routed body** (derived from `CARVE_CUBE_SIZE` and HalfFloat RGBA, not
  measured).
- ⭐ **Max's gate:** flying in on a wet rocky or icy world with the A/B key — does it read as rivers on the
  planet's own terrain, draining into a sea that looks right, with deltas at the mouths: one coupled
  system, not blue lines painted on a ball.

## Decisions taken in scoping (stated so Max can overrule at greenlight)

1. **Rivers are ON in the game on wet bodies.** The lab's toggle defaults OFF (`riversEnabled: false`,
   `world-engine-lab.html:1325`) because *"routing the overlay is expensive"* for an authoring tool; a
   wired feature the player never sees is not wired. The A/B key (`J`, unbound in the game's key map)
   flips a wet body to the pre-wire pixels.
2. **The relief + crater cubes are IN, as the first unit.** Routing on a field the body does not display
   would put rivers across hills. The strength is the lab's frame write (`:4976`) with the lab's
   display-scale input: `1.0 × bakeReliefCrossover(visScaleOf(radiusEarth))`, and
   `uCraterBakeRestore = 1 − that` (`:4988`). Using the lab's input reproduces the lab's per-body blend;
   the game's own display policy (identity — `gameDisplayRadiusEarth` in
   `src/worldengine/port/writePackUniforms.js`) is untouched, the game still does not scale its disc.
   The consequence is visible: Earth-sized bodies change terrain (to the lab's); small and large ones
   barely. That is the lab's residue too (`src/worldengine/base/labCore.js:118-140`). A/B key `U`.
3. **Sea level is the lab's rivers-ON behaviour:** solved from the histogram to `TARGET_OCEAN_FRACTION`
   (0.35) and written to `uSeaLevel`, `lakesEnabled`, `coastStrength = 1` (`:2990-2992`). ⚠ Every wet
   body therefore gets a 35 % ocean. The lab has no condition → ocean-fraction law for the router
   (`targetOceanFraction` is a UI constant; the driven `seaLevel` at `:2147` gave ~13 % ocean on the real
   relief — the reason the histogram exists). Logged as a backlog row, not invented here.
4. **Which bodies:** the lab's own F11 existence gate — `_wet = liquidStability > 0.15` (`:2131`) —
   admits ribbons + carve + sea; relict bodies (`_hadLiquid && erosion > 0`) get the route (their F13
   outflow reads the B channel) but no ribbon and no sea; airless bodies get no route (every consumer is
   0 by the pack; the cube would be read ×0). The lab's per-body admission is unauthored (its toggle is
   global) — logged.
5. **The fluvial driver block (`:2123-2167`) moves into a driver pack**, the lab reads it back (the
   "MOVED TO DRIVER PACK #2" precedent at `:2075`; seven packs exist). One derivation, moved whole:
   F11/F12/F13/F14/F20 scalars come together because leaving half makes a state that exists nowhere.
6. **Same worker, one message.** The province worker's payload grows into the whole `route()` bundle
   (province + relief + crater + carve + ribbon arrays); the cubes bake on the same frame. Cubes stay
   attributable by their own A/B and sabotage arms, not by separate dispatches (`writeBodyRelief` is
   35–160 ms per body; running it four times is waste).

## Deliberately NOT in this workstream — logged, not built

- **The view-dependent river LOD** (`uRiverCarvePatchMap`; `rivers-viewdependent-lod-2026-06-18`,
  contract `building`; `patchStrength: 0` in the lab). The placeholder stays. ⚠ At close approach the
  global overlay's ~14 km minimum width (that workstream's own numbers) is what Max will see; that is the
  lab's current state and its open spike — `well-dipper-approach-lod-criterion`.
- **The grain cube** (`uTectonicGrainCube`, strength 0 in both front-ends today). Same message, own
  increment.
- **`createHeightSampler`** (the strength-0 GPU fallback the lab keeps for byte-identity) stays in the
  root module; the boundary fence's ONE allowlist entry is unchanged. The game routes on the carrier.
- **The condition → ocean-fraction law** (decision 3) and **per-body river admission in the lab**
  (decision 4): backlog rows in the lab's model.
- **The 108 KB `planet-lod-rivers.js` file move** (PLAN §7) — still its own step.
- **Any change to the router's laws, params, cube sizes or the carve amounts:** everything moves
  byte-verbatim and binds at the lab's values (`riverOverlayState` `:392`: carveStrength 0.01, carveFloor
  1.3, carveDepthH 0.08, carveRough 0.5, carveGateHi 0.18, ribbonLift 1.0014).

## Risks named up front

- **VRAM:** 50.3 MB per routed body (carve cube) + 3.1 + 3.1 MB per solid body (relief + crater) + 0.8 MB
  (province) — so **57.3 MB per ROUTED body and 7.0 MB per further solid one**. ⭐⭐ CORRECTED 2026-09-02
  (the whole-branch review): this line said "five **wet** bodies ≈ 280 MB", and ROUTED is wet ∪ relict —
  the carve cube binds on both, and relict is 64 of the 68 routed bodies. MEASURED over the 24-seed
  corpus (`tests/river-bake-host.test.js` → `$TMPDIR/river-corpus.json` `perSystem`): 68 routed bodies
  across the 21 seeds that route anything (3 route none), i.e. **3.24 routed bodies per routing system,
  2.83 per seed, max 5**. Per procedural system that is **≈ 204 MB mean** over the routing systems,
  ≈ 179 MB over all 24 seeds, and **≈ 300 MB on the worst measured system** (`rocky-4` and `rocky-14`:
  5 routed + 2 further solid). Fine on Max's desktop GPU; unknown on the phone (the mobile pass is live).
  Recorded; Max's phone is the only instrument.
- **Cold cost per body** in the worker: 35–160 ms dispatch + ~100–170 ms route (the dendritic AC7
  numbers at 40k) + geometry; the main thread renders six 1024² faces once. Recorded, not gated.
- **A wet body whose crossover is exactly 0** (R ≤ 0.25 or ≥ 4 R⊕ by the lab's law) would route on a
  field it does not display. Wetness needs a retained atmosphere, so this should be empty over the
  corpus; the count is an AC, and a non-zero count is a decision surfaced to Max, never a silent route.
- **Rendering the ribbon in the game:** the log-depth buffer (`RetroRenderer.js`) is fine for
  `MeshBasicMaterial`; never polygonOffset; the game's sphere is `SphereGeometry(r, 96, 48)` so the
  coarse-icosphere lift caveat in `docs/FEATURES/river-lod-port-contract.md` §D is smaller than written.
