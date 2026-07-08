# Systems — Well Dipper

This is the wiring map. Every `src/**/*.js` file belongs to exactly one
system (Rule 10). Each system has a slug that:

- names a folder under [`SYSTEMS/`](SYSTEMS/) when a deep-dive doc gets
  authored (Phase 6 of doc-system v5 migration deliberately authors only
  `app-shell/`; the rest are written progressively as feature work
  touches them — Rule 1: no empty folders)
- appears in `FEATURES/<feature>.md` "Systems touched:" lines, parsed by
  `npm run doc-rot` (Check 7)
- appears in `WORKSTREAMS/<slug>.md` `Scope.systems:` frontmatter,
  parsed by `npm run doc-rot --workstream <slug>`

Two views below: an **auto-generated graph + table** showing call
relationships derived from `madge` import analysis + per-system
Module(s) ownership (regenerate with `npm run doc-graph`), and a
**manual systems index** listing every system with a one-line purpose
and key paths.

## System-of-systems diagram

<!-- AUTO-GENERATED: graph (npm run doc-graph) -->
```mermaid
graph LR
```
<!-- /AUTO-GENERATED -->

## Systems (auto-generated)

Per-system call relationships. Populated by `scripts/doc-graph.js` from
`SYSTEMS/<slug>/README.md` Module(s) declarations. `app-shell` fans out
to many systems but per Gap O is excluded from receiving systems'
"Called by" — see Manual overlays below.

<!-- AUTO-GENERATED: table (npm run doc-graph) -->
| System | Calls | Called by | Has deep dive |
|---|---|---|---|
| app-shell | — | — | 📄 SYSTEMS/app-shell/ |
<!-- /AUTO-GENERATED -->

## Systems index (manual)

| Slug | Purpose | Tier(s) served | Key paths | Deep dive |
|---|---|---|---|---|
| app-shell | Top-level game loop, bootstrap, scene/state transitions, URL params, debug shortcuts | All tiers | `src/main.js` | 📄 [SYSTEMS/app-shell/](SYSTEMS/app-shell/README.md) |
| audio | Music track playback gated by scene state; SFX engine over Web Audio | F&F-MVP | `src/audio/MusicManager.js`, `src/audio/SoundEngine.js` | — no doc yet |
| autopilot | Tour queue, screensaver auto-warp, mouse-look-during-tour, flythrough camera, choreographer that drives ship + camera | F&F-MVP | `src/auto/AutoNavigator.js`, `src/auto/NavigationSubsystem.js`, `src/auto/FlythroughCamera.js`, `src/auto/CameraChoreographer.js`, `src/auto/ShipChoreographer.js` | — no doc yet |
| camera | Camera modes: orbit, free-look, cinematic, ship-velocity-physics; presents stable API to app-shell regardless of mode | F&F-MVP | `src/camera/ShipCameraSystem.js`, `src/camera/CinematicDirector.js`, `src/camera/CameraPhysics.js` | — no doc yet |
| celestial-bodies | In-system scene objects: planets, moons, asteroid belts, orbit lines, billboards, star flares, gravity-well visualization | F&F-MVP | `src/objects/Planet.js`, `src/objects/Moon.js`, `src/objects/AsteroidBelt.js`, `src/objects/OrbitLine.js`, `src/objects/StarFlare.js`, `src/objects/Billboard.js`, `src/objects/PlanetBillboard.js`, `src/objects/GravityWell.js` | — no doc yet |
| data-catalogs | Static reference data: real-star catalog (Hipparcos-derived), real-feature catalog (named galactic features), known-body / known-object profiles (Sol + named exoplanets) | F&F-MVP | `src/data/KnownBodyProfiles.js`, `src/data/KnownObjectProfiles.js`, `src/generation/RealStarCatalog.js`, `src/generation/RealFeatureCatalog.js` | 📄 [NAMING_AND_REAL_OBJECTS.md](NAMING_AND_REAL_OBJECTS.md) |
| flight | Manual flight dynamics: ship state machine + Newtonian integration with gravity (GAME-tier substrate; F&F uses subset for ship-camera physics) | F&F-MVP, GAME | `src/flight/FlightDynamics.js`, `src/flight/FlightStates.js` | — no doc yet |
| galactic-bodies | Far-scale scene objects: galaxies, nebulae, milky way; the things you see between systems | F&F-MVP | `src/objects/Galaxy.js`, `src/objects/Nebula.js`, `src/objects/MilkyWay.js`, `src/objects/GalaxyCloud.js`, `src/objects/GalaxyNebula.js`, `src/objects/VolumetricNebula.js` | — no doc yet |
| generation-galaxy | Galactic-scale procgen: galaxy structure, sectors, clusters, nebulae, navigable variants, milky-way model, hash-grid starfield | F&F-MVP | `src/generation/GalaxyGenerator.js`, `src/generation/GalacticMap.js`, `src/generation/GalacticSectors.js`, `src/generation/ClusterGenerator.js`, `src/generation/NebulaGenerator.js` | — no doc yet |
| generation-planet | Planet / moon / asteroid-belt procgen — physical units (AU, Earth radii) | F&F-MVP | `src/generation/PlanetGenerator.js`, `src/generation/MoonGenerator.js`, `src/generation/AsteroidBeltGenerator.js` | — no doc yet |
| generation-style | Naming, style-profile adaptation, exotic overlay, seeded RNG for generation determinism | F&F-MVP | `src/generation/NameGenerator.js`, `src/generation/StyleProfileAdapter.js`, `src/generation/ExoticOverlay.js`, `src/generation/SeededRandom.js` | 📄 [NAMING_AND_REAL_OBJECTS.md](NAMING_AND_REAL_OBJECTS.md) |
| generation-system | Star system procgen: known systems (Sol + named), solar-system data, destination picker, system generator | F&F-MVP | `src/generation/StarSystemGenerator.js`, `src/generation/KnownSystems.js`, `src/generation/SolarSystemData.js`, `src/generation/DestinationPicker.js` | 📄 [NAMING_AND_REAL_OBJECTS.md](NAMING_AND_REAL_OBJECTS.md) |
| inspection-layer | `__wd.*` debug API, lab mode (`?lab=1` + Shift+1..7 scenarios), scene inspector, integration suite, golden trajectories, F3 debug panel, pretext text-layout sandbox, scene-naming convention | Infrastructure | `src/debug/LabMode.js`, `src/debug/SceneInspector.js`, `src/debug/integration-suite.js`, `src/debug/scene-inventory-golden.js`, `src/ui/DebugPanel.js`, `src/ui/PretextLab.js`, `src/util/scene-naming.js` | — no doc yet |
| physics | Orbital mechanics, gravity fields, full physics engine for system-wide gravitational state | F&F-MVP | `src/physics/GravityField.js`, `src/physics/OrbitalMechanics.js`, `src/generation/PhysicsEngine.js` | — no doc yet |
| rendering-galaxy | Galaxy-specific renderers: luminosity layer + volumetric in-galaxy rendering | F&F-MVP | `src/rendering/GalaxyLuminosityRenderer.js`, `src/generation/GalaxyVolumeRenderer.js` | — no doc yet |
| rendering-objects | Per-body renderers: planet/moon body shader dispatch, ring renderer (currently dead code per FEATURES.md), star renderer | F&F-MVP | `src/rendering/objects/BodyRenderer.js`, `src/rendering/objects/RingRenderer.js`, `src/rendering/objects/StarRenderer.js` | — no doc yet |
| rendering-retro | The dual-resolution compositor: starfield at full res, scene at low res; LOD management, color extraction, texture baking | F&F-MVP | `src/rendering/RetroRenderer.js`, `src/rendering/LODManager.js`, `src/rendering/LODColorExtractor.js`, `src/rendering/TextureBaker.js` | — no doc yet |
| rendering-shaders | Shared shader modules: Bayer dither pass, material-body shader, textured-body shader | F&F-MVP | `src/rendering/shaders/DitherPass.js`, `src/rendering/shaders/MaterialBodyShader.js`, `src/rendering/shaders/TexturedBodyShader.js` | — no doc yet |
| rendering-sky | Sky layer pipeline: starfield, procedural glow, galaxy glow, sky-feature layer (galaxies/nebulae as background), warp-tunnel starfield | F&F-MVP | `src/rendering/SkyRenderer.js`, `src/rendering/sky/StarfieldLayer.js`, `src/rendering/sky/SkyFeatureLayer.js`, `src/rendering/sky/GalaxyGlowLayer.js` | — no doc yet |
| ship | Player-ship state object with stable `forward`/`up`/`right` accessors and `setOrientation` API (foundation for autopilot camera + manual flight) | F&F-MVP, GAME | `src/core/Ship.js` | — no doc yet |
| ship-npc | NPC ship loading (GLB models) + stochastic per-system spawning (will be disabled for F&F ship per FEATURES.md) | ENRICHED | `src/objects/ShipLoader.js`, `src/objects/ShipSpawner.js` | — no doc yet |
| simulation | Fixed-timestep sim clock, sim-side seeded RNG (replay determinism), celestial time, input replay (golden-trajectory testing substrate + future relativistic time-debt foundation) | Infrastructure, GAME | `src/core/SimClock.js`, `src/core/SimRandom.js`, `src/core/CelestialTime.js`, `src/core/InputReplay.js` | — no doc yet |
| ui-hud | Body info, settings menu, system map (G-key minimap), gravity-well map (G-key alternate), targeting reticle | F&F-MVP | `src/ui/BodyInfo.js`, `src/ui/Settings.js`, `src/ui/SystemMap.js`, `src/ui/GravityWellMap.js`, `src/ui/TargetingReticle.js` | — no doc yet |
| ui-nav-computer | Nav computer screen: 5 zoom levels (GALAXY → SECTOR → REGION → PRISM → SYSTEM; PRISM renamed from COLUMN 2026-05-25) + galaxy-specific renderer for the nav view | F&F-MVP | `src/ui/NavComputer.js`, `src/rendering/NavGalaxyRenderer.js` | — no doc yet |
| warp | Warp effect (FOLD/HYPER/EXIT phases), warp portal (dual-portal traversal), warp tunnel | F&F-MVP | `src/effects/WarpEffect.js`, `src/effects/WarpPortal.js`, `src/effects/WarpTunnel.js` | — no doc yet |
| world-origin | World-origin rebasing for float32 precision at ship scale; scene-unit constants (1 AU = 1000 units) | Infrastructure | `src/core/WorldOrigin.js`, `src/core/ScaleConstants.js` | — no doc yet |

## Manual overlays

### Required asymmetry annotation (v5 Gap O)

> Note: `app-shell`'s outward calls render in the system-of-systems
> diagram (arrows from `app-shell` to other systems) but are EXCLUDED
> from per-system "Called by" columns in the table. This asymmetry is
> intentional — orchestration files would over-report dependencies if
> treated as ordinary callers. The diagram shows what `app-shell` wires
> up; the table shows production-call relationships.

### Cross-cutting notes

**Generators don't render; renderers don't generate.** `generation-*`
systems produce pure data (planet structure, moon orbits, galactic
features) in physical units. `rendering-*` systems consume that data +
manage GPU resources. The two halves never share state beyond the data
object passed at construction time.

**Bodies vs renderers vs objects.** Three related but distinct system
groupings:
- `generation-planet` produces planet data
- `celestial-bodies` is the scene-graph object (`Planet.js` wrapping the
  THREE.Mesh + per-frame update)
- `rendering-objects` is the shader dispatch + LOD switching
  (`BodyRenderer.js`)

A planet round-trip is `generation-planet → celestial-bodies →
rendering-objects → rendering-retro` (compositor).

**`world-origin` is a pipeline-crosser.** Per FEATURES.md row notes,
world-origin rebasing crosses procgen → rendering → gameplay. Any cached
position state (in `celestial-bodies`, `rendering-objects`, future GAME
systems) needs to subscribe to `onRebase`. This is currently the
suspected accumulation point for Layer-3 gameplay issues.

**Inspection-layer is non-load-bearing.** Disabling the inspection layer
(via build flag or runtime toggle) does not affect gameplay rendering or
state. The `__wd.*` API is a probe surface; production code never reads
from it.

## Open questions

- **Should `ship-npc` be folded into `celestial-bodies`?** Currently
  separate because ShipSpawner has its own per-system lifecycle distinct
  from system-body generation. May consolidate if/when NPC ships become
  permanently disabled for F&F.
- **Should `generation-style` and `simulation` share a single RNG
  system?** Currently `SeededRandom` (generation-side) and `SimRandom`
  (sim-side) are kept distinct by design (per `SimRandom.js` header) so
  visual non-determinism doesn't couple to sim seed. Documentation
  should make this distinction more visible than current state.
- **`rendering-galaxy` membership of `GalaxyVolumeRenderer.js`.** File
  lives in `src/generation/` (historical accident) but functionally is
  a renderer. Claimed by `rendering-galaxy` here; doc-graph may surface
  this as a discoverability issue. Future refactor: move file to
  `src/rendering/`.
- **Are inspection-layer test files claimed?** The `__tests__/`
  directories are under their system-of-origin (e.g.
  `src/camera/__tests__/` → `camera`). doc-rot will tell us if any test
  is unclaimed.

---

**Authored:** Phase 6 of doc-system v5 migration, 2026-05-19.
**Source:** Code inspection of `src/` + cross-reference to FEATURES.md.
**Next:** Phase 7 (FEATURES/{autopilot,warp}.md template-conformance) +
progressive `SYSTEMS/<slug>/` deep dives as feature work touches each
system.
