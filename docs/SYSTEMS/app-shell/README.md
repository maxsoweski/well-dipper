# `app-shell`

The orchestration system. Wires every other system together at startup,
owns the top-level game loop, manages scene/state transitions, and
handles URL params + global keybinds + debug shortcuts.

## Purpose

`app-shell` is intentionally a single file (`src/main.js`) because the
game loop *is* the orchestration. Splitting it into "manager" classes
would either (a) leak shared mutable state across module boundaries or
(b) require an additional indirection layer that adds reading cost
without changing what runs. The deliberate trade-off: one ~9000-line
file with clear sectional structure (search-by-keyword scales fine in
this regime), rather than 12 files where you have to chase imports to
follow control flow.

The `(meta: orchestration)` flag on `src/main.js` tells `doc-graph`:
*this file legitimately imports many systems; don't treat it as a
caller of those systems in the per-system "Called by" tally.* Without
this flag, every system would show `app-shell` in "Called by" — true
but uninformative. The diagram still renders arrows from `app-shell` to
the receiving systems, so the wiring topology is visible.

## Module(s)

- `src/main.js` (meta: orchestration)

That's it. Every other `src/**/*.js` belongs to a non-orchestration
system. Bootstrap, scene setup, frame loop, input handling, URL-param
routing, and debug-shortcut wiring all live inside `main.js`.

## Tier(s) served

All tiers. `app-shell` doesn't itself implement any tier of the player
experience — it's the substrate that lets each tier's systems run.

## Interface

### Entry point

`index.html` includes `src/main.js` via Vite. Vite handles bundling,
HMR (dev), and the production build under `base: '/well-dipper/'` for
GitHub Pages.

### URL params (debug + lab mode)

| Param | Effect |
|---|---|
| `?lab=1` | Enables `LabMode` from the `inspection-layer` system ([row in SYSTEMS.md](../../SYSTEMS.md#systems-index-manual)); unlocks `Shift+1..7` scenario presets |
| `?portalLab` | Enters warp portal lab |
| `?warpDebug` | Enables warp debug logging |

(Additional URL params may exist; this is a sketch, not an audit. See
`feedback_build-dev-shortcuts.md` for the policy on dev shortcuts.)

### Keyboard

`window.addEventListener('keydown'/'keyup')` handlers live inside
`main.js`. Global keys (Space = new system, A = autopilot, G = HUD swap,
` ` ` = debug HUD, F3 = debug panel, X = pretext lab, etc.) dispatch
into the systems that own each behavior. The handler does not own the
behavior — it routes to the system that does.

### Globals

`__wd.*` is the inspection-layer probe surface; `_lab.*` is the lab-mode
control surface. `app-shell` is the only place that wires these onto
`window`. (`SYSTEMS/inspection-layer/` deep dive not yet authored — see
[SYSTEMS.md flat map](../../SYSTEMS.md#systems-index-manual).)

## Wiring

`main.js` instantiates every other system in this rough order:

1. `THREE.Scene`, `THREE.WebGLRenderer`, `THREE.PerspectiveCamera`
2. `RetroRenderer` (compositor — owns the dual-resolution pipeline)
3. World-origin (`WorldOrigin` from [`world-origin`](../../SYSTEMS/) +
   `ScaleConstants` import)
4. Simulation clock (`SimClock`, `SimRandom`, `CelestialTime`,
   `InputReplay` from [`simulation`](../../SYSTEMS/))
5. Audio (`SoundEngine`, `MusicManager` from
   [`audio`](../../SYSTEMS/))
6. Data catalogs (`RealStarCatalog`, `RealFeatureCatalog`,
   `KNOWN_OBJECT_PROFILES` from [`data-catalogs`](../../SYSTEMS/))
7. Generation pipeline (galaxy / system / planet generators from
   [`generation-*`](../../SYSTEMS/) families)
8. Scene-object factories (`Planet`, `Moon`, `AsteroidBelt`, `Galaxy`,
   `Nebula`, `Ship`, etc. from [`celestial-bodies`](../../SYSTEMS/) +
   [`galactic-bodies`](../../SYSTEMS/) + [`ship`](../../SYSTEMS/))
9. Renderers (`BodyRenderer`, `StarRenderer`, `LODManager`,
   `SkyRenderer`, sky layers — [`rendering-*`](../../SYSTEMS/) families)
10. Camera system (`ShipCameraSystem` from
    [`camera`](../../SYSTEMS/))
11. Autopilot (`AutoNavigator`, `NavigationSubsystem`,
    `FlythroughCamera`, choreographers — [`autopilot`](../../SYSTEMS/))
12. Warp (`WarpEffect`, `WarpPortal` from [`warp`](../../SYSTEMS/))
13. UI (`DebugPanel`, `NavComputer`, `SystemMap`, `BodyInfo`,
    `Settings`, `TargetingReticle` etc. from
    [`ui-*`](../../SYSTEMS/))
14. NPC ships (`ShipSpawner` from [`ship-npc`](../../SYSTEMS/) —
    currently enabled; per FEATURES.md will be disabled for F&F ship)
15. Inspection layer (`LabMode`, `PretextLab`, `__wd.*` API surface)

The frame loop is the fixed-timestep accumulator from
`motion-test-kit/core/loop/accumulator`, bound to `requestAnimationFrame`
via `bindToRAF`. Each frame:

- `_advanceSimClock` advances the simulation tick
- Active systems get their per-frame update calls
- `RetroRenderer.render` composites the result

## History

- **2026-04-25** — `Director` retirement (per
  [PERSONAS/director.md](../../PERSONAS/director.md) §"Retirement
  notes"). Working-Claude assumed direct responsibility for `main.js`
  orchestration changes in-session; previously Director-mediated.
- **2026-05-08** — Dev-collab edit-count gate retirement. State
  pointer at `~/.claude/state/dev-collab/active-workstream.json` still
  references this project's active workstream so PM/Tester can locate
  it; `main.js` itself doesn't read that file.
- **2026-05-18 → 2026-05-19** — Doc-system v5 migration recognized
  `main.js` as the orchestration root and authored the
  `(meta: orchestration)` semantics in
  [`PROTOCOLS/doc-updates-on-ship.md`](../../PROTOCOLS/doc-updates-on-ship.md)
  so doc-graph wouldn't over-report `app-shell` as a caller of every
  other system.

## Open questions

- **When does `main.js` itself need to split?** Today it's ~9000 lines.
  The deliberate trade-off (above) holds while sectional structure +
  search are workable. Triggers that would force a split: (a) the file
  becomes editor-unloadable, (b) multiple concurrent workstreams
  thrash the same line ranges, (c) a structural refactor (e.g.
  GAME-tier game-state machine) naturally extracts a layer. None have
  fired yet.
- **Should `LabMode`-style debug entry points migrate behind a build
  flag?** Per `feedback_build-dev-shortcuts.md` they're authorized as
  temp scaffolding tied to active workstreams. Long-term: gate behind
  `import.meta.env.DEV` for production builds.
- **Bootstrap separation.** No separate bootstrap file exists today;
  Vite + `index.html` + `main.js` is the whole entry path. If a future
  refactor introduces, say, a state-machine bootstrap or a save-load
  layer, those files would also live in `app-shell` (with the same
  `(meta: orchestration)` flag where appropriate) — not in a new
  system.
