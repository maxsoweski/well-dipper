# Transition Freeze Fix — Pre-Spawn During FOLD

**Status:** Design draft, awaiting Max's review before implementation.
**Context:** Session 2026-04-15 identified GPU stall at INSIDE swap. With dual-portal traversal now working + 3x tunnel (2026-04-16), the stall is the most visible remaining warp roughness.

## Problem

At INSIDE crossing (`onTraversal('INSIDE')` → `warpEffect.onSwapSystem` → `warpSwapSystem` → `spawnSystem`), the game:

1. Disposes the current system (geometries, materials, textures)
2. Builds new system meshes (planets, moons, rings, asteroid belts, ships, …)
3. Creates shaders / compiles GLSL
4. Uploads textures to GPU
5. Adds new meshes to scene

Steps 2–4 are where the GPU stalls. Shader compilation and texture upload are synchronous — the browser blocks rendering until done. Visible as a brief freeze at the exact moment the player crosses Portal A.

## Current flow

```
FOLD (4s)   → onPrepareSystem fires at FOLD start
            → pendingSystemData = generateSystemData(target, galaxy)    [CPU only]

ENTER (1.5s) → geometric plane check every frame

FOLD→ENTER  → camera crosses Portal A → onTraversal('INSIDE')
              → warpSwapSystem()                                         [GPU stall]
              → spawnSystem(pendingSystemData)
                  - dispose current system
                  - build new meshes + shaders
                  - add to scene

HYPER (6.5s) → camera traverses tunnel mesh (INSIDE state)

HYPER→EXIT   → camera crosses Portal B → OUTSIDE_B
```

The GPU work on the swap line is 50–400ms depending on system complexity.

## Proposed fix: pre-spawn during FOLD

FOLD is 4s of visible wind-up. The CPU data is already generated at FOLD start via `onPrepareSystem`. What's missing is GPU resource creation. We can do that during FOLD too.

```
FOLD start    → onPrepareSystem:
                  pendingSystemData = generateSystemData(...)    [CPU, fast]
                  _pendingBuiltSystem = buildSystemGPU(pendingSystemData)
                                                                 [GPU, slow — hidden behind FOLD portal]

FOLD → ENTER → camera crosses Portal A → onTraversal('INSIDE')
              → activateSystem(_pendingBuiltSystem)              [fast pointer swap]
```

The GPU work happens during FOLD (visually masked by the portal fold-in animation) instead of at the traversal moment.

## Implementation sketch

### New function: `buildSystemGPU(systemData)`

Extracted from `spawnSystem`. Does everything EXCEPT:
- Replacing the global `system` variable
- Adding meshes to the scene (keep `_scene.add` calls out — meshes are built but not in the scene graph)
- Disposing the current system (that happens at activation time)
- Resetting warp-related state

Returns a "built system" object: `{ star, planets, moons, belts, … }` with all GPU resources initialized.

### New function: `activateSystem(builtSystem)`

Runs at `onSwapSystem`. Steps:
1. Dispose current `system` (synchronous — old system is on-screen during dual-portal OUTSIDE_A, not problematic)
2. `system = builtSystem`
3. Add all `system.*` meshes to `scene`
4. Reset the state that `spawnSystem` currently resets (warpTarget, idleTimer, camera far, shipSpawner, etc.)

### `onPrepareSystem` hook (expanded)

```js
warpEffect.onPrepareSystem = () => {
  const destType = DestinationPicker.pick(seed);
  pendingSystemData = generateSystemData(destType, seed, target);

  // NEW: also build GPU resources now, not at INSIDE crossing
  _pendingBuiltSystem = buildSystemGPU(pendingSystemData);
};
```

### `onSwapSystem` hook (simplified)

```js
warpEffect.onSwapSystem = () => {
  warpSwapSystem();  // unchanged
};

function warpSwapSystem() {
  flythrough.stop();
  autoNav.stop();
  _cancelSystemMusic();
  _clearReticleTargets();

  activateSystem(_pendingBuiltSystem);  // REPLACES: spawnSystem({ forWarp: true, systemData: pendingSystemData })
  _pendingBuiltSystem = null;
  pendingSystemData = null;

  // … rest unchanged (camera placement, etc.)
}
```

## Risks

1. **Memory: two systems in RAM simultaneously.** Current system + pending system for up to 4s. Each system is 20–200MB of GPU resources. On low-end hardware, could OOM. Mitigation: start simple; add a "dispose current system GPU early" phase if needed (e.g., during INSIDE if memory is tight).

2. **Cancellation.** If the warp is aborted between FOLD start and FOLD end (player presses Escape, new Space during warp, etc.), the pre-built system must be disposed cleanly. New cleanup path: `if (_pendingBuiltSystem) { dispose(_pendingBuiltSystem); _pendingBuiltSystem = null; }`.

3. **Refactoring `spawnSystem`.** It's ~500 lines and does a lot. Splitting into `buildSystemGPU` + `activateSystem` requires careful separation of "build resources" vs. "commit to scene state." A wrong split could leave orphaned meshes or missed state resets.

4. **Test coverage.** Need to verify: star systems, navigable deep sky (nebulae, clusters), distant deep sky (galaxies), binary stars, KnownSystems (Sol). Each has different generation paths.

## Alternative: incremental mesh creation

Instead of pre-building during FOLD, spread the mesh creation across frames using generators or `requestIdleCallback`. Pro: no double-memory. Con: significantly more refactoring; GPU work is still synchronous to the renderer thread, so the incremental approach only helps if we chunk shader compilation which is non-trivial.

Not recommended for the MVP fix.

## Phased rollout

1. **Phase 1**: extract `buildSystemGPU` + `activateSystem` from `spawnSystem`, verify current behavior unchanged (spawnSystem calls both sequentially). No functional change — just refactor + test.
2. **Phase 2**: wire the pre-spawn into `onPrepareSystem`. Measure stall reduction in Playwright.
3. **Phase 3**: add cancellation cleanup for aborted warps.
4. **Phase 4**: gate behind `_preSpawnEnabled = true` flag for A/B testing against current behavior.

## Open questions for Max

1. Is memory a concern? What's the target low-end hardware? (RTX 5080 with 16GB VRAM is forgiving; Steam Deck is not.)
2. Should the pre-spawn be optional (flag-gated) or default-on?
3. Is the current FOLD duration (4s) enough for the worst-case system build time? If large systems take 5s+ to build, FOLD may need to extend or we need the fallback timer swap to wait.

## Estimated work

- Phase 1: ~2 hours (careful refactor of spawnSystem)
- Phase 2: ~1 hour (wiring + measurement)
- Phase 3: ~1 hour (cleanup paths)
- Phase 4: ~30 min (flag + A/B)
- Testing: ~1 hour (Playwright scripts for each destination type)

Total: ~5–6 hours of focused work. Probably spans two sessions.
