# ⭐ Lab pipeline → game — THE PLAN OF RECORD

**Systems touched:** worldengine, planet-lod-lab, rendering

> **This file is the plan. It is the ONE durable artifact for this program and it is updated IN
> PLACE, never stacked.** Per-session handoff briefings under `~/briefings/` are disposable, and on
> this project they have twice been *wrong* about what had already shipped. When a briefing and this
> file disagree, **this file wins; when this file and `git log` disagree, the log wins.**
>
> Strategic frame: [`planet-lod-CHARTER.md`](planet-lod-CHARTER.md). Deferred-work register and the
> full measurement tables: [`surface-variation-beyond-mvp.md`](surface-variation-beyond-mvp.md).
> The graft-vs-replace analysis this supersedes: [`lab-vs-game-renderer-divergence.md`](lab-vs-game-renderer-divergence.md) §4.1.

## The two standing constraints (Max, verbatim — these decide every design question below)

1. **"We change the rendering capabilities of the main game however we need to such that the
   features of the world engine can render in the main game."** (2026-08-01)
   → The game bends. There is no "which features ship" negotiation and no parity budget. If the
   lab's shader wants a vertex attribute the game's mesh lacks, the mesh grows it.

2. **"We will likely do additional development in the world engine lab, and so we need to easily be
   able to move the latest developments from that lab into the main game in the future."**
   (2026-08-01)
   → **This is the load-bearing one.** It rules out copying the lab's shader into the game, because
   a copy is a snapshot and the lab keeps moving. The seam must be **shared modules that the lab
   itself imports**, so that "porting" a future lab change is not an action anyone has to take.

Earlier, and still in force: *"the goal here is to have the lab's rendering pipeline in the game —
the procgen and the rendering itself. go forward in whatever way will make that happen asap."*
(2026-07-31) — this is the **replace** option in the divergence doc, not the graft.

## Why the plan has the shape it has

The obvious plan — write a game-side driver that produces the lab's uniforms — satisfies constraint
1 and **violates constraint 2**, because it creates a second implementation that drifts from the lab
the first time anyone does lab work. So every step below is an **extraction**: lab code moves into a
module, and the lab imports it back. The game becomes a second consumer of the same module.

**This is not a new pattern here. It has run twice, and both times it was proven byte-identical:**

- `src/worldengine/display/albedoTransfer.js` — pulled *out of the lab's own `applyDrivers`*.
  Byte-identical across 18 presets × 5 endmembers × 3 channels, **max delta exactly 0**.
- `src/worldengine/shaders/heightNoise.glsl.js` — the `hash3`/`noised`/`fbmd` hoist. The lab splices
  them back at the two (non-contiguous) points they occupied; resolved `HEIGHT_GLSL` is
  **265 920 bytes before and after, byte-identical** (commit `f77d9ff`).

⭐ **"Resolved output byte-identical" is this program's definition of done for every extraction
step.** It is a command a fresh session can run, not a judgement call — which is the whole point.

## Where the boundary actually is today

Already shared — the lab imports these from the game's tree, so **anything landing here is already
in the game for free**: `src/worldengine/**` (42 modules — `sphereField`, `tectonic`, `plates`,
`magmatism`, `e1Regime`, `surfaceMaterial`, `albedoTransfer`, `atmosphereOptics`, `bombardment`,
`province`, `climate-e5`, `storm-e`, `giant-drivers`, `band-flow`, …).

Already importable but living at repo root rather than in the engine: `planet-lod-height.glsl.js`
(264 KB), `planet-lod-uniforms.js` (`makeUniforms` — **defaults only**), `planet-lod-lab-core.js`,
`planet-lod-tectonic.js`, `planet-lod-rivers.js`, `planet-lod-tributaries.js`, and friends.

**Still trapped inside `planet-lod-lab.html`** (one 7 554-line inline module, 265 top-level
declarations) — this is the entire remaining problem:

| what | where | size |
|---|---|---|
| `vertexShader` | `planet-lod-lab.html:207` | 1 661 chars |
| `fragmentShader` | `planet-lod-lab.html:231` | ~101 K chars, ONE interpolation: `${HEIGHT_GLSL}` |
| `applyDrivers()` | `planet-lod-lab.html:3226–4027` | **802 lines** |

Everything else in that file is GUI and lab state and should stay lab-only.

## Steps

Status values: `TODO` / `IN PROGRESS` / `DONE <sha>`. **Update in place.**

### Step 0 — async compile + swap-on-ready — `DONE 9da286b, d87a8fe`

The enabler. The lab's shader costs ~29–47 s of cold compile; nothing ships while that is a freeze.
Also retired a hitch the game already paid: **5 424 ms → 58.7 ms worst frame**, 99%.

Full measurement table, the 10.3× render-target finding, and the serialization fix are in
[`surface-variation-beyond-mvp.md`](surface-variation-beyond-mvp.md) → *"STAGE 0 SHIPPED +
LIVE-MEASURED"*. Do not re-derive them.

Built but **not yet exercised by anything**: `swapMaterialWhenReady()` in
`src/rendering/ShaderWarmup.js`. Step 3 is its first consumer.

### Step 1 — extract `applyDrivers` into a shared module — `TODO`

**The one that makes every future lab change free.** 802 lines that turn a condition vector into the
349 uniform values. `makeUniforms()` supplies only defaults, and the spike proved those defaults
render **black** (mesh rasterises 76.2%, shader computes black) — so this is not decoration, it *is*
the procgen half of the ask.

- Interface to find: `(condition, knobs, seed) → uniform values`, pure, no lab `state`, no GUI.
- The lab imports it back and keeps working exactly as before.
- **Done when:** the lab's resolved uniform set is byte-identical across the preset population,
  by the `albedoTransfer` method (max delta exactly 0), and a test pins it.

### Step 2 — extract the shaders into `.glsl.js` modules — `TODO`

Same pattern, `heightNoise.glsl.js` precedent. After this, **a lab shader edit is a game shader edit**
— there is no port action at all.

- **Done when:** the lab's resolved `fragmentShader` / `vertexShader` strings are byte-identical
  before and after, asserted by a test (the hoist's own gate).
- ⚠ The game's mesh must then grow the four attributes the lab's vertex shader reads
  (`aBand`/`aShear`/`aMush`/`aStorm`) — the spike zero-filled them. Constraint 1 says the mesh grows.

### Step 3 — one land type end-to-end in a procedural system — `TODO`

Wire `conditionFromPlanet` → the extracted driver → the extracted shader, on **Caph**, with the
bakes gated OFF via their documented byte-identical gates (`uTectonicGrainStrength = 0`,
`uProvinceWeight = 0`). First consumer of `swapMaterialWhenReady`: the game draws its own cheap
shader on frame one and upgrades when the lab's links.

⭐ Keep the game's three shaders. Under constraint 1 they are not a fallback to be deleted — they are
what makes a multi-second compile survivable.

### Step 4 — the bakes — `TODO` — ⚠ **THE UNMEASURED RISK IN THIS PROGRAM**

Tectonic grain, crater, river carve. Per-planet work at spawn. The slice-3 recon warned this was
always the true cost of the lab path, and **no one has yet measured a single bake on a single body.**
Everything else in this plan has a number; this has none.

If the schedule matters, measuring one bake early prices the rest of the program.

### Step 5 — moons — `TODO`

`src/objects/Moon.js` is a **third renderer with none of the port** — no palette, no relief, no
craters, still the March-2026 `snoise` shader. **267 of 277 moons within 25 pc derive a crater
record and 0 render one**; 96.8% of generated moons are airless with a full 4.5 Ga exposure age,
against 0.8% of planets. This is the population the crater work was actually built for.

## Open calls that are Max's, both still unmade

- ⛔ **Every generated planet retains an atmosphere** — min 0.310 bar, 0/288 below 0.01 bar. Erosion
  therefore pins the crater-retention age and craters correctly vanish (2/256 generated planets
  render any). This is a **`PhysicsEngine.computeAtmosphere`** finding, not a crater one, and it also
  gates space weathering and the greenhouse correction. **Changing it moves every planet's look.**
  Worth deciding before Step 1, because the extracted driver will encode the same assumption
  everywhere.
- ⛔ **Moons** (Step 5 above) — where craters belong and cannot be drawn.

## Standing directives for this lane

1. **No multi-agent workflows / no `Workflow` tool here.** Direct implementation only. Overrides
   ultracode.
2. **No workstream artifacts** (`intent.md` / `contract.json`) by agreement — this file is the
   contract. `verify-workstream` presupposes one and does not apply.
3. **Commit at seams without asking; confirm before `git push`.** Commit messages on this lane are
   long on purpose — they are the lane's memory, and `git log` outranks this file.
4. **Explain in pipeline terms, never AC-IDs.**
5. **Sol is a special case and the wrong place to judge surface look** — hand-authored and textured,
   always will be. Test in procedural systems: `node tools/find-test-systems.mjs 25`. Caph (16.8 pc)
   is the best single target; Caph + Dalim + Larawag cover all 7 ROCKY-branch land types.
   ⚠ Sol *is* valid for compile-cost work, since the program is chosen by body type, not by system.
6. **Stage explicit paths in `git add`** — the tree carries standing NOT-OURS mods
   (`src/auto/CameraChoreographer.js`, `src/debug/LabMode.js`). Never `git add -A`.
7. `git status --short -uno` — a bare `git status` prints ~450 untracked lines here.

## Traps that have each cost real time (do not re-learn these)

- ⛔ **A black frame is indistinguishable from a clean negative control.** A `0.000000%` negative
  control AND a `0.000%` liveness were both artifacts of a NaN world matrix (Sol's moon records
  carry no `axialTilt`). **Assert a lit-pixel floor before believing any percentage, and force a
  constant fragment output** to separate "not rasterising" from "computing black" before diagnosing
  anything else.
- ⛔ **Chrome's shader DISK cache fakes compile measurements** across GL contexts and page loads.
  Cache-bust the shader SOURCE — `window.__shaderCacheBust`, read inside `planetShaderSource()` so
  it cannot reach one path and not the other.
- ⛔ **The program cache key bakes in `toneMapping` + `outputColorSpace`, both read from the bound
  render target.** Compiling against the canvas instead of `RetroRenderer.sceneTarget` warms a
  program the game never draws — and it fails by looking *mostly* fixed (606 ms vs 58.7 ms).
- ⛔ **`import()` of a game module from an evaluated page script resolves to a DIFFERENT module
  instance** than the running app's. Verify through observable state / the `window._lab` surface.
- ⛔ **`makeUniforms(WORLD_LIGHT)` takes the light vector**, not `THREE`. Bare calls yield
  `uLightDir = [null,null,null]` → NaN → black.
- ⛔ **Backticks inside the GLSL template literals in `src/objects/Planet.js` break the module.**
  Audit: `grep -c` for backtick LINES → expect **14**. Prose backticks in comments count.
- ⛔ **Do NOT add `rng` draws to `PlanetGenerator`'s shared stream** — one extra draw rewrites the
  generated universe. Derive display-side (`reliefOffsets` / `craterUniformsFrom` both do).
- ⚠ **Check rAF fps before trusting any live measurement.** A minimized or occluded Chrome throttles
  to ~1 fps while `document.hidden`, `visibilityState` and `hasFocus()` all report normal.
- ⚠ Ports drift between sessions — re-verify with `ss -ltnp` → `readlink /proc/PID/cwd` →
  `git -C <cwd> rev-parse --abbrev-ref HEAD`. Do not trust a port table in any briefing.
- ⚠ Suite baseline: **20806 passed / 4 failed** (`KnownObjects` ×3, `GalacticFeatures` ×1), plus 13
  `vendor/motion-test-kit` "No test suite found" = 17 failed FILES. Check this before blaming
  yourself. (Plus 7 from `shader-warmup-source-parity.test.js` as of Step 0 → 20813.)

## How to pick this up in a fresh session

1. Read this file.
2. `git log --oneline -15` on `feature/world-engine-production-L1` — the log outranks this file.
3. Find the first step above that is not `DONE`.
4. Read that step's linked detail in `surface-variation-beyond-mvp.md` only if you need the numbers.

Do **not** read `~/briefings/*.md` for status. They are per-session and they go stale.
