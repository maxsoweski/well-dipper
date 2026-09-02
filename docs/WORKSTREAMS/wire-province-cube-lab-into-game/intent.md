# wire-province-cube-lab-into-game — intent

## Why we care

Max, 2026-08-26: *"Our goal is to wire up the World Engine renderer. If the world engine renderer is
missing something important, then we need to log that as something important to work on after we get
things wired up. But we can't shoestring everything together."*

The program's standing constraint #3, Max 2026-07-31: **"REPLACE, not graft"** — *"the goal here is
to have the lab's rendering pipeline in the game — the procgen and the rendering itself."*

And his reason wiring outranks feature work, 2026-08-26: *"Part of the reason to wire up all the
rendering tech here is that as we continue to experiment and add new features, they'll be
implemented into the game seamlessly and quickly."*

**`uCratonColor` is the last queue-(b) item with a clear shape** (`one-pipeline-two-frontends-PLAN.md:132`).
The lab paints a solid body's ground from a HISTORY-derived partition — ancient shield (craton),
active deformation belt (orogen), sediment sink (basin) — baked into a cube map the shader reads at
`planetShaders.glsl.js:566`. The game binds a 1×1 black placeholder there (`LabPlanetMaterial.js:84`),
so the province term is inert on every body the game renders. Max greenlit this lane on 2026-08-28 and
asked for it to wait until he was at a desk, because *judging a ground palette is a visual call*. He is
back: *"I'm back home so let's proceed"* (2026-09-01).

⭐ **Correction to the 2026-09-01 handoff, measured 2026-09-01 evening:** it said the sphere mesh
builder and the province cube baker were *"neither written; both are small."* Both are WRITTEN —
`buildIrregularSphere` at `planet-lod-rivers.js:410` and `createProvinceCube` / `bakeProvinceCube` /
`PROVINCE_CUBE_SIZE` at `planet-lod-tectonic.js:377-460`. They live in root lab modules that nothing
under `src/` may import (`tests/src-boundary-fence.test.js`). **This is a move-and-wire, not a build**,
which is exactly the shape `feedback_wire-dont-shoestring` says to check for first.

## Success criteria (Max's language where he has given it; derived from the measured appendix otherwise)

- The game's ground palette on solid bodies comes from **the lab's province cube**, baked by **the
  lab's own baker** and **the lab's own relief dispatch** — one module each under `src/`, imported by
  both front-ends. Not a copy, not a graft onto the game's shader.
- **Every solid body the world engine already renders gets its province** — today that number is
  zero. Gas bodies get none. (Measured 2026-08-28 over 156 generated bodies: 97 of 124 solid bodies
  earn a genuine three-class partition; the 27 despun ones get a seed-decorative two-class one. That
  qualification is recorded, not fixed here.)
- **The mesh resolution is chosen on a measurement against the lab's 40,000-node reference**, not
  inherited from the lab's default, because cost spans 60× while the class fractions are flat.
- In the running game, on a procedural system, flipping province colour off and on **visibly changes
  the ground** of a solid body — and today it changes nothing.
- ⭐ **Nothing else about the universe moves.** Same planets, same moons, same seeds, same uniforms;
  all four instruments stay where they are.
- ⭐ Max's gate: flying in on a rocky or icy body with the A/B key, **the ground reads as kinds of
  crust** — shield, belt, basin — rather than one tone, and it coheres with the rest of the surface.

## What this UNLOCKS (feedback_worldengine-does-unlocks-map)

| DOES | driver | player sees |
|---|---|---|
| `uProvinceCube` RGB = {craton, orogen, basin} weights, A = coverage | `writeProvince` ← fault density, structural grain, accommodation, relaxed; routed by `writeBodyRelief` from the E1 regime (shell / despun / stagnant-lid / volcanic / plate) + `macroSeed` | ground colour splits into `uCratonColor` / `uFreshColor` / `uSedColor` at `uProvinceColorMix` 0.65; `provBasin` also feeds the biosphere term (`:593`, basins hold the water) |

**UNLOCKS:** this wire builds the GAME-SIDE CARRIER PATH — shared mesh → `makeSphereField` →
`writeBodyRelief` → a cube bake with a renderer. The other three "layer-4" cubes the placeholder note
lists (`uReliefBakeCube`, `uCraterBakeCube`, `uRiverCarveMap`; F11/F12 the river router) ride that
same path. None of them is wired here; all of them become one bake entry each once it exists.

## Deliberately NOT in this workstream — logged, not built

- **Despun bodies are body-blind on the province channel** (appendix §iii: byte-identical province
  across a rocky, a gas and an icy body at one seed, because `despun()` reads no `bodyDrivers`).
  A backlog row, in the lab's own generative model. Not a renderer fix (`feedback_procgen-layer-not-render`).
- **The plate path reaches 0.8% of generated bodies** (appendix §iv). Pre-existing, V2-3 already
  records it, not this lane's.
- **The relief, crater and river-carve cubes.** Same path, separate increments, so a failure stays
  attributable to one cube.
- **Any change to the baker, the dispatch, or the mix value.** Both functions move byte-verbatim;
  `uProvinceColorMix` stays the lab's 0.65.
- **The 108 KB `planet-lod-rivers.js` file move.** Still its own step (`PLAN.md:576`); only the
  ~55-line mesh builder leaves it here.
