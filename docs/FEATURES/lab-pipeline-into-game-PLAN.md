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

### Step 1 — extract the condition→uniforms CORE of `applyDrivers` — `IN PROGRESS`

**The one that makes every future lab change free.** 802 lines that turn a body's condition into the
uniform values. `makeUniforms()` supplies only defaults, and the spike proved those defaults render
**black** (mesh rasterises 76.2%, shader computes black) — so this is not decoration, it *is* the
procgen half of the ask.

⛔ **It is NOT a pure function and will not become one by being moved.** Measured 2026-08-01:
**153 distinct `state.*` reads, 57 `u.*` uniform writes**, plus calls into GUI plumbing
(`listen()`, `syncDisplays()`, `riverRerouteDebounced()`, `applyStormState()`). So the step is not
"move 802 lines"; it is **split** them:

- **(A) the pure core** — `condition → uniforms`, moves to `src/worldengine/`, lab imports it back,
  game is the second consumer. This is the deliverable.
- **(B) lab-only residue** — GUI knobs, debounce, display sync. Stays in the HTML.

The classification that decides the split: of the 153 `state` fields, which are **condition-derived**
(the game already has these through `src/worldengine/port/conditionFromPlanet.js`) versus **hand
knobs** (the game needs a documented default instead). ⚠ A knob misclassified as condition puts a
human-only slider on the game's critical path — so "unknown" must be reported as unknown, not
guessed.

- **Done when:** the lab's resolved uniform set is byte-identical across the preset population, by
  the `albedoTransfer` method (max delta exactly 0), and a test pins it.
- **MVP bias:** if the full split is large, ship the smallest independently-verifiable slice that
  gets a real game planet rendering through lab-derived uniforms, and record what it defers.

#### ✅ Step 1 MVP SHIPPED — the limb — `f8a0b1e`

⭐ **The lesson: check whether the seam already exists before extracting anything.** The recon
proposed pulling a new air-optics module out of `applyDrivers`. It was unnecessary —
`src/worldengine/base/atmosphereOptics.js` is **already** a shared module the lab imports
(`planet-lod-lab.html:177`), it already returns `limbColor` and a continuous `limbExponent`, and
every input it reads is already on the vector `conditionFromPlanet()` returns. **The game just never
called it.** Shipped with no extraction and no lab edit.

Measured on generated bodies (3 seeds, 8 planets with atmospheres): exponent spans **1.8 → 3.5**,
the law's full range, where all 8 previously drew exactly `3.0`; **4 distinct rim colours**; no NaN;
and the live compiled fragment shader declares and uses all three uniforms. `LIMB_MIX = 0` restores
the old rim byte-identically — exact by construction, since `mix(x, y, 0.0) == x`.

⛔ **Not proven: an on-screen pixel difference.** Two measurement attempts were wrong and were
discarded (a 500 ms settle let planets orbit — motion floor 48% against a 50% "signal"; and a
`useProgram` probe that also failed to find the shipped `uReliefMix`/`uCraterDensity`). Re-run
back-to-back against a 1.64% motion floor, two of three dial transitions showed nothing. Cause is
almost certainly scale — planets are a few pixels at the spawn distance. **Closing it needs the
camera flown to a body**; teleporting does not work (the world rebases around the camera). Look is
Max's UAT gate anyway.

⭐ New debug surface: **`window._lab.spawnProceduralSystem(seed)`**. Sol's major bodies render
through `BodyRenderer`'s *textured* path and never touch this shader, so measuring any port work
there produces confident wrong numbers. Use this for every look measurement from now on.

⚠ **Drift found, deliberately not fixed: the lab overrides the module it imports.**
`planet-lod-lab.html:3749` computes a **binary** `_thickHaze ? 1.8 : 3.5` and discards the
**continuous** `limbExponent` that `atmosphereOpticsOf` returns. The game takes the module's value —
the module is the shared law. Reconciling the lab changes the lab's look and must be byte-gated.

**Deferred from this slice:** `uAirglowIntensity`, `uShellIntensity`, the thick-haze
`limbStrength × 1.3`, and everything in bands/jets/weather/storm/thermal/aurora/dust/magma/carbon/
facets.

#### ✅ Slice 2 SHIPPED — biosphere cover + terminator hue — `66cc231`

**The module-gap audit that produced this is the reusable part.** Question asked: how much of the
lab is already in `src/worldengine/` and unused by the game? The answer split in two, and the
*negative* half is the more useful one:

- ⛔ **Nine modules are NOT free** — `band-flow`, `e1Regime`, `giant-drivers`, `magmatism`, `plates`,
  `province`, `sphereField`, `storm-e`, `tectonic`. Imported by the lab, not reached by the game even
  transitively. Nearly all are **bake-side** (they write spheres/cubes, or produce vertex
  attributes); `e1Regime` is data-only and renders nothing. **They are Step 4 in disguise.** This is
  why measuring one bake is now the highest-value unknown in the program.
- ✅ **The free wins were in *partially-consumed* modules** the game already imports. Two found and
  taken: `biosphereOf` + `BIO_PIGMENT` (never called), and `termColor` + `columnFraction` (already
  computed in the object the game reads for `limbColor`, and thrown away).

Measured on **36 bodies across 8 generated systems**: biosphere on 6 of 36, 7 distinct values, max
1.0; terminator on 36 of 36 with 16 distinct hues. No NaN.

⛔⛔ **THE TERMINATOR'S STRENGTH CAME OUT DEGENERATE — EXACTLY 1.0 ON ALL 36 BODIES, range [1,1].**
Not a wiring bug. `columnFraction = smoothstep(0.003, 0.3, pressure)` and **every generated planet
retains an atmosphere** (min 0.310 bar), so every planet sits above the law's 0.3 bar saturation
point. The model is right; the population is wrong. **This is the second feature in two days
flattened by the one unmade `computeAtmosphere` decision** — craters were the first. No code change
fixes it, and swapping in a proxy that happens to vary would be hiding it.

⚠ `uTermStrength` / `uTermWidth` are **not the lab's law yet** — the lab drives them from
`state.termStrength` / `state.termWidth` inside `applyDrivers`, unextracted. `columnFraction` makes
the *gate* correct (0 for airless) while the scale stays provisional.

Also fixed by this slice: the game's terrestrial branch had `vec3 lowland = accentColor` under the
comment *"green vegetation"* — a per-planet **random colour** standing in for a biosphere on every
terrestrial world, habitable or not.

### Step 2 — extract the shaders into `.glsl.js` modules — ✅ `DONE 6f9d3f4`

`planet-lod-shaders.glsl.js` now holds both, as `LAB_VERTEX_SHADER` / `LAB_FRAGMENT_SHADER`; the lab
imports them back. **A lab shader edit is now a game shader edit** — no port step.

    vertex                            1 655 bytes,  sha256 b65a9a2f… == b65a9a2f…
    fragment (HEIGHT_GLSL resolved) 363 566 bytes,  sha256 3fca848b… == 3fca848b…

⭐ **The live control was the load-bearing part, not the hashes.** A byte-identical string does not
prove the page still runs, so the pre-extraction HTML was served alongside and both measured:
BEFORE and AFTER both give **0.375% lit pixels, mean luma 1.86, 367 uniforms, glError 0**. That
0.375% is low enough to look exactly like a black frame — the failure this lane has twice mistaken
for a clean result — and the control is the only thing that says it is the lab's normal boot state.

⚠ **SIX fences search the lab's source text and all six broke.** `vis-scale-fence` (counts the eight
`/* glsl */` blocks), `instrument-tap-fence` (pulls literals out by declaration name),
`worldengine-atmo-deck-spiral-rhines` (counts `attribute float aStorm`), `worldengine-base-band-flow`
(a `zonalBandCol` call string), `worldengine-base-storm-e` (**the sixth — the recon missed it, the
suite found it**). Fix pattern, reusable for any future GLSL move: **each fence reads
`planet-lod-lab.html` AND the module as ONE corpus**, since together they are the lab's source. One
line per fence, every assertion preserved, no fence weakened or deleted.

⛔ **The game does not import this module yet, and cannot usefully.** The lab's shader with
`makeUniforms()` defaults renders **black** (spike: 76.2% rasterised, shader computing black), so
the shader needs Step 1's uniform driver before it shows anything. Shader without uniforms shows
nothing; uniforms without shader do nothing. **Step 3 is where they meet — that is the real MVP.**

#### Original brief (kept)

Same pattern, `heightNoise.glsl.js` precedent. After this, **a lab shader edit is a game shader edit**
— there is no port action at all.

- **Done when:** the lab's resolved `fragmentShader` / `vertexShader` strings are byte-identical
  before and after, asserted by a test (the hoist's own gate).
- ⚠ The game's mesh must then grow the four attributes the lab's vertex shader reads
  (`aBand`/`aShear`/`aMush`/`aStorm`) — the spike zero-filled them. Constraint 1 says the mesh grows.

### Step 3 — one land type end-to-end in a procedural system — `IN PROGRESS`

#### ⭐⭐ THE LAB'S SHADER RENDERS A GAME PLANET — `fc06017`

`src/rendering/LabPlanetMaterial.js` + `_lab.tryLabShader(i)`. The lab's shader module (Step 2) and
the lab's 349 uniform defaults, on a live game planet, beside two game-shader planets in the same
generated system. Screenshot: `~/briefings/lab-shader-in-game-2026-08-01.png`.

⭐⭐ **THE UNDRIVEN FLOOR IS NOT BLACK — the spike's central claim was wrong.** `d8faaef` reported
that `makeUniforms()` defaults render black ("76.21% rasterised, shader computing black"), and that
is what made the uniform driver a hard prerequisite for anything visible. It was conflated with the
trap recorded two lines below it in the same register: **`makeUniforms` takes the LIGHT VECTOR**, and
calling it bare gives `uLightDir = [null,null,null]` → NaN → black. With a real light:

    lit pixels   15.073% → 15.271%
    mean luma    15.192  → 18.535     (+22%)

Flat orange with the lab's posterize/Bayer dither at the terminator. **So Step 1 is no longer
all-or-nothing** — it can go a few uniforms at a time with a visible result after each, instead of
one 802-line split up front.

⭐ **Stage 0 earned its keep here, and this is its first real consumer.** The compile measured
**31 753.8 ms** — inside the 29–47 s band the spike predicted — for **zero frozen frames**. The game
held 240 fps throughout because `swapMaterialWhenReady` links off the main thread and swaps on
resolve.

Mechanics worth not re-deriving:
- The four attributes (`aBand`/`aShear`/`aMush`/`aStorm`) are **zero-filled** by
  `ensureLabAttributes` — they are the band/jet/storm **bake** outputs (Step 4), and zero is correct
  until that bake exists. Idempotent, never overwrites, so the bakes can take ownership later.
- The surface mesh is found by **walking the scene for the game's own uniform set**, not by an
  object path. It is an *unnamed* child of a `body.planet.*` group and neither `BodyRenderer` nor
  `Planet` exposes it under a stable path — an earlier version guessed `_delegate.surface` and just
  reported "no surface mesh".
- Light comes from the body's own `lightDir` uniform, not the lab's `WORLD_LIGHT` constant.

#### Original brief (kept)

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

1. **Workflows ARE allowed — reversed by Max, 2026-08-01:** *"proceed via workflows but be token
   efficient where feasible and drive to shipping mvps."* This directive previously read "no
   multi-agent workflows on this lane, direct implementation only"; that was a working preference
   from the measurement-heavy Stage 0 work, not a standing rule, and it is retired.
   **Shape that works here:** fan out *reconnaissance* over the 625 KB lab HTML (ranged reads only —
   agents must never read it whole), synthesize a design, then implement the surgical edits in the
   main thread. The lab file has template-literal hazards that make delegated editing risky.
   ⚠ Pin an explicit `model` on every agent call (`feedback_subagent-model.md`).
2. **No workstream artifacts** (`intent.md` / `contract.json`) by agreement — this file is the
   contract. `verify-workstream` presupposes one and does not apply.
3. **Commit at seams without asking; confirm before `git push`.** Commit messages on this lane are
   long on purpose — they are the lane's memory, and `git log` outranks this file.
4. **Explain in pipeline terms, never AC-IDs.**
5. ⭐⭐ **SOL RENDERS FROM REAL NASA PHOTOGRAPHS. IT IS UNIQUE IN THE GALAXY AND CANNOT VALIDATE ANY
   OF THIS WORK.** (Max, 2026-08-01, having had to say it more than once: *"the rendering process for
   Sol is unique in the galaxy because we've got actual textures from NASA images."*)

   This is not "Sol is a bit special." `public/assets/textures/bodies/` holds **18 NASA image
   assets** — Earth, Jupiter, Venus, Titan, Mars, the Moon (LROC colour + LDEM heightmap), and the
   rest. Bodies with a `KNOWN_BODY_PROFILES` entry load them through `BodyRenderer`'s **textured**
   path, which by standing rule **never swaps back to procedural**. Sol's bodies also carry **no
   world-engine condition fields**, so anything condition-derived degrades to defaults there.

   Consequence: a measurement taken in Sol is not merely unrepresentative, it is **confidently
   wrong** — the code path under test may not execute at all, and where it does its inputs are
   placeholders. This has already produced one wrong reading on this lane (the limb MVP initially
   showed 4 identical dwarf planets and a Titan reading clear-Rayleigh-blue instead of tholin haze).

   **Use `window._lab.spawnProceduralSystem(seed)`**, or the named targets from
   `node tools/find-test-systems.mjs 25` — Caph (16.8 pc) is the best single target; Caph + Dalim +
   Larawag cover all 7 ROCKY-branch land types.

   ⚠ Sol *is* valid for **system-independent** work — shader compile cost, for instance, since the
   GPU program is chosen by body TYPE, not by system. Say which class the measurement is in whenever
   Sol is used at all.

   ⛔ Sol is **permanent**, not a stopgap the procedural pipeline grows into. Do not propose
   unifying them.
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
