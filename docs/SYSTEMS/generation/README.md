<!-- Written 2026-08-17. Format contract for the `## Module(s)` block below was established
     by reading scripts/doc-graph.js:50-105 directly and probing its two regexes with a
     throwaway script in /tmp. Contract, verbatim from the parser:
       - heading must be exactly `## Module(s)` — H2, no trailing colon (scripts/doc-graph.js:64)
       - each bullet must be `- ` + a backtick-quoted repo-root-relative path, optionally
         ` (scope: x)` or ` (meta: x)`, then NOTHING but whitespace to EOL (scripts/doc-graph.js:68)
       - any trailing prose on a bullet makes that line invisible, silently (bare `continue`
         at scripts/doc-graph.js:65 — no warning path exists)
     ⛔ CLAUDE.md:64-68 and docs/PROTOCOLS/doc-updates-on-ship.md:33-36 both call this a
     "`Module(s):` line" with a colon. Both are wrong — they describe the v3 one-line field
     (docs/ARCHIVE/_design-doc-system-v3_LEGACY.md:287). The parser rejects the colon.
     The only correct written spec is docs/ARCHIVE/_design-doc-system-v5_LEGACY.md:301-333;
     the copyable live example is docs/SYSTEMS/worldengine/README.md:23-56. -->

# generation — the procedural generation layer

## What this is, and what it is not

This is the structural reference for `src/generation/**`: the modules, the **draw-stream discipline**, the **instrument battery** that fences it, the **corpora** those instruments run on, and an index of the dated `docs/FEATURES/*.md` artifacts that hold everything else.

⛔ **It does not describe the per-stage pipeline order, and it does not describe what `MoonGenerator` does step by step.** That is deliberate. The B5 moon-formation window is about to rewrite the moon half of the pipeline — `docs/FEATURES/moon-formation-channel-model-PLAN-2026-08-15.md:129` states that its channel selector "replaces in place" the gate at `src/generation/MoonGenerator.js:123`. Writing the per-stage description now would document a shape that is about to move, and this repo already has a directory full of documents that read as current while describing a tree three months gone. The per-stage half gets written **after B5 lands**.

If you came here asking:

| Question | Go to |
|---|---|
| How does moon sizing work / why are the big moons around gas giants? | `docs/FEATURES/moon-formation-channel-model-PLAN-2026-08-15.md` — the plan of record for the moon lane. Its §0 is verified against the tree. ⛔ Three of its own numbers are dead; see the superseded list in §6 below. |
| What are the target rates for big moons? | `docs/FEATURES/how-rare-are-big-moons-2026-08-15.md:14` (Band A / Band B, Elser 8.3% central) |
| What is the current state of the moon lane? | `docs/FEATURES/moon-formation-handoff-2026-08-17.md` — but two of its three next-actions are now done, and its §2(b) at `:66` is refuted by `docs/FEATURES/moon-formation-b4-prediction-2026-08-17.md:130`. |
| What does the whole lab→game port program look like? | `docs/FEATURES/one-pipeline-two-frontends-PLAN.md` |
| I want to change a `rng.` call | §3 of this file, first. All of it. |

Everything in §3–§5 is the half that survives B5. Everything in §6 is dated and must be read with its corrections.

---

## Module(s)

- `src/generation/AsteroidBeltGenerator.js`
- `src/generation/ClusterGenerator.js`
- `src/generation/DestinationPicker.js`
- `src/generation/ExoticOverlay.js`
- `src/generation/GalacticMap.js`
- `src/generation/GalacticSectors.js`
- `src/generation/GalaxyGenerator.js`
- `src/generation/HashGridStarfield.js`
- `src/generation/KnownSystemAuthoring.js`
- `src/generation/KnownSystems.js`
- `src/generation/MilkyWayModel.js`
- `src/generation/MoonGenerator.js`
- `src/generation/NameGenerator.js`
- `src/generation/NavigableClusterGenerator.js`
- `src/generation/NavigableNebulaGenerator.js`
- `src/generation/NebulaGenerator.js`
- `src/generation/PlanetGenerator.js`
- `src/generation/RealSystemOverlay.js`
- `src/generation/SeededRandom.js`
- `src/generation/SolarSystemData.js`
- `src/generation/StarSystemGenerator.js`
- `src/generation/StarfieldGenerator.js`
- `src/generation/StyleProfileAdapter.js`
- `src/generation/arrivalResolution.js`
- `src/generation/componentSystems.js`
- `src/generation/knownObjectSearch.js`
- `src/generation/multiplicityOracle.js`
- `src/generation/realStarSeed.js`
- `src/generation/data/knownSystemContents.generated.js`
- `src/generation/data/namedSystemsCatalog.js`
- `src/generation/data/realProperNames.js`
- `src/generation/data/stellarCompanions.js`

*(Bare paths — `doc-graph.js` parses this list strictly and any trailing prose on a bullet is silently dropped. Per-module descriptions are in the table below, which is safe because the `## Module(s)` section terminates at the next `## ` heading, `scripts/doc-graph.js:64`.)*

### Three files that live in `src/generation/` and are deliberately NOT claimed here

| File | Claimed by | Why it matters |
|---|---|---|
| `src/generation/PhysicsEngine.js` | `physics` (docs/SYSTEMS.md:60) | ⭐ Stateless, RNG-free physics (`PhysicsEngine.js:2-14`) called by `PlanetGenerator`, `MoonGenerator` and `StarSystemGenerator`. **The shared physical substrate of the whole generation pipeline is owned by a different slug** — a deep dive scoped to `generation` structurally excludes the module that decides most of what generation produces. Read it anyway. |
| `src/generation/RealStarCatalog.js`, `src/generation/RealFeatureCatalog.js` | `data-catalogs` (docs/SYSTEMS.md:52) | `RealStarCatalog` is **async** — `await catalog.load()` fetches `hyg-stars.json` at runtime (`RealStarCatalog.js:8-11`), unlike the static `src/data/*Profiles.js` it is grouped with. |
| `src/generation/GalaxyVolumeRenderer.js` | `rendering-galaxy` (docs/SYSTEMS.md:61) | A renderer in `src/generation/`. `docs/SYSTEMS.md:126-130` records it as a historical accident with a pending move to `src/rendering/`. Its density math must match `GalacticMap` exactly (`GalaxyVolumeRenderer.js:8-10`) — duplicated constants, no automated guard found. |

⚠ `src/generation/__tests__/` (~30 `.js` files) is unclaimed by anything. `docs/SYSTEMS.md:131-134` files this as an open question; there is no directory-prefix inheritance in `doc-graph.js` or `doc-rot-check.sh`, so those files will show as unclaimed until someone decides.

---

## 2. The module inventory

Grouped by what they produce. Every row's citation is a line I opened.

### System and body generation

| Module | Produces | ⛔ Trap |
|---|---|---|
| `StarSystemGenerator.js:36` | A whole system — star or binary pair, orbital slots, planets with moons, belts. 51 KB. | Orbital angular speeds MUST anchor on `KEPLER_ANCHOR_AU = 0.387` (Mercury), not the per-system visual map base (`:19-25`). Anchoring on the map base made luminous/binary systems orbit up to ~100× too fast — the parked-ship planet-drift bug of 2026-06-28. `keplerOrbitSpeed` must be recomputed anywhere `orbitRadiusAU` changes (migration, resonance snap). |
| `PlanetGenerator.js:16` | One planet as pure data in Earth radii. 52 KB. | ⭐ The **only** file in `src/generation/` that imports `src/worldengine` (`:1-4`). Three of those four imports (`port/conditionFromBody.js`, `base/surfaceMaterial.js`, `display/albedoTransfer.js`) are absent from `docs/SYSTEMS/worldengine/README.md:25-56`, so `doc-graph` will show one edge where there are four. |
| `MoonGenerator.js:7-14` | Moon data (orbits, radii, composition, surface history) for a parent body. | ⭐ **This is what B5 rewrites.** Do not document its step order. Durable fact: the giant-parent criterion is parent MASS, not shader family or name (`:9-11`). |
| `AsteroidBeltGenerator.js:5` | Power-law belt description; `AsteroidBelt.js` renders it as an InstancedMesh. | Belt distances are deliberately compressed for visual drama (`:10-12`) — this module is NOT in the honest physical units the layer otherwise advertises. Also: belt particles are ~98% of a system's draws (see Rule 12). |
| `ExoticOverlay.js:5` | A post-pass after `generate()` that swaps planet types to add civilized / exotic / anomalous worlds. | Mutates the planets array in place (`:9`) and imports `PlanetGenerator` (`:1`). Its `rng.child('swap-' + newType)` at `:322` keys the suffix on a derived VALUE — change the swappable type set and every swapped planet's sub-stream moves even if the population is identical. |
| `SolarSystemData.js:8-14` | Hardcoded real Solar System (8 planets, 5 dwarfs) in `StarSystemGenerator`'s output shape; Shift+0. | ⭐⭐ **Sol cannot validate procgen or rendering.** NASA textures, a different renderer, no condition fields. Never test a generation change on it. It also owns the extremes of any corpus it is in — see RECON-2000 in §5. |

### Determinism, naming, style

| Module | Produces | ⛔ Trap |
|---|---|---|
| `SeededRandom.js:4-11` | The Alea-backed PRNG. 97 lines. The determinism substrate for all of generation. | Kept deliberately distinct from `src/core/SimRandom.js` so visual non-determinism cannot couple to the sim seed (`docs/SYSTEMS.md:121-125`). ⛔ Do NOT "unify the RNGs" as a tidy-up. See also Rule 0. |
| `NameGenerator.js:2` | Deterministic names for systems, stars, planets, moons; `generateSystemName(rng, galacticPos)` is a pure function of canonical position. | Uniqueness is STRUCTURAL — no registry, no persistence (`:14-19`). "Why did two systems get the same name" can only be answered by re-deriving the position quantization. |
| `StyleProfileAdapter.js:4-8` | Converts a `KnownObjectProfile` (M42, M1…) into the shapes `Nebula.js` / `Galaxy.js` / `SkyFeatureLayer.js` expect. | Its output shape is a RENDERER contract, not physical data — sits awkwardly against `docs/SYSTEMS.md:87-91` ("generation-* produce pure data in physical units"). A renderer field change breaks a generation-side file. |

### Galaxy scale

| Module | Produces | ⛔ Trap |
|---|---|---|
| `GalacticMap.js:5` | ⭐ The structural galaxy the player is INSIDE: master seed → parameters → potential → density → star properties. 70 KB, largest file here. | Its own header (`:7-10`) opens by disowning the name collision: it is **not** `GalaxyGenerator.js`. |
| `GalaxyGenerator.js:4` | Data for a distant deep-sky galaxy you warped to — log-spiral arms or de Vaucouleurs R^1/4 ellipticals. | See above. Two near-identical names, opposite jobs. |
| `GalacticSectors.js:4` | ~1,000 deterministic density-weighted named sectors usable as persistent gameplay entities. | none found |
| `HashGridStarfield.js:4` | Realistic-scale star generation by hashing coords against local density; seven spectral tiers. Nothing is stored. | Named in `generation-galaxy`'s Purpose text at `docs/SYSTEMS.md:55` but omitted from its Key-paths — the old index's purpose text and path list disagreed. Claimed here for the first time. |
| `StarfieldGenerator.js:5-14` | Position/colour/size arrays for `Starfield.js`, in two layers (real warp-targetable + density-weighted background). | Added 2026-03-14, predates the old index; the whole sky-star half of galactic generation was invisible to the ownership map. |
| `MilkyWayModel.js:5` | A 3D particle cloud of the player's own galaxy from `GalacticMap`'s actual density model — nav textures from above, equirect glow skyboxes from inside. | Same purpose-vs-keypaths gap as `HashGridStarfield`. |
| `NebulaGenerator.js:4` / `NavigableNebulaGenerator.js:5` | Billboard layers for distant emission/planetary nebulae / flyable volumetric nebulae with real `Star` objects. | Billboard-for-distance vs volumetric-for-flying. Only the billboard half was previously slugged. |
| `ClusterGenerator.js:4` / `NavigableClusterGenerator.js:5` | Distant globular (King-profile) and open clusters / flyable open clusters as individual `Star` objects, no planets. | `NavigableClusterGenerator.js:5` states the distinction explicitly. Do not conflate. |

### Real-universe overlay (all added 2026-07-13 → 2026-07-20; none were in the old index)

| Module | Produces | ⛔ Trap |
|---|---|---|
| `arrivalResolution.js:2` | ⭐ The ONE shared arrival core: canonical seed + position + catalog type + display name → `KnownSystems` override → overlay → generate → merged display names. Thin sync/async wrappers over one core. | It exists because nav preview and warp arrival had forked — `NavComputer._renderSystem` previewed via a raw overlay-less `generate()`, so Guniibuu previewed 6 planets and delivered a K+K binary + 4 (`:12-18`). **Any new "just generate a system here" call site is at risk of re-forking. Route through this module.** |
| `RealSystemOverlay.js:2` | Joins a real catalog star's display name to ingested archive data and emits `companionSpec` / `knownPlanets` / `farCompanions` + index-aligned names. | The overlay does not fork generation — it feeds `StarSystemGenerator`'s existing ctx fields (`:5-8`). "Real system" and "procedural system" are the same code path with different inputs. |
| `realStarSeed.js:2` | The single canonical seed formula for a real catalog star: position binned to 0.1 pc, folded through `GalacticMap.hashCombine`. 1.3 KB. | ⭐ Smallest file here, widest blast radius. It replaced four near-identical forks. Changing the body re-seeds every real star in the game and breaks path identity (`:13-15`). |
| `multiplicityOracle.js:2` | How many stars the player will find on arrival, without generating the system — so nav prism dot counts cannot contradict arrival. | Its precedence chain matches arrival BY REUSE, not by a parallel implementation (`:10-16`). If it disagrees with arrival, one of them stopped reusing. It calls `stellarPrefix` on the same seed (`:97`) — harmless to generation, but see Rule 11. |
| `componentSystems.js:2` | Seed derivation, generation-context builder and payload validator behind `systemData.componentSystems` — promotes far companions (Proxima, HD 156026, Zet-2 Ret) into spawnable sub-systems. | ⭐ `buildComponentContext` is the RECURSION GUARD: it destructure-OMITS the parent's multi-star fields so the recursive `_generateIterator` call cannot re-enter the far-companion block (`:14-16`). **Adding a field back can produce infinite recursion.** |
| `KnownSystemAuthoring.js:2` | Turns a declarative `KnownSystems` entry (position + seed + `companionsRef`) into full contents by routing through the overlay ctx fields. | none found beyond its generated-data dependency below. |
| `knownObjectSearch.js:2` | Pure headless-testable resolver for the nav search — real stars, named systems in a player-centred box, structures. | A UI QUERY path living in `src/generation/`; it generates nothing. It ports logic from `src/ui/DebugPanel.js:582-711` which it explicitly leaves unmodified (`:5-6`) — two implementations that can drift. |
| `KnownSystems.js:2` | Registry of handcrafted systems that replace procedural generation on arrival. | Matching is by galactic POSITION within a tolerance, **not by seed** (`:6-8`). "Which seed produces Alpha Centauri" is the wrong frame. |
| `DestinationPicker.js:2` | 611-byte static classifier: is this warp destination deep-sky or star-system. | It no longer picks anything — the deep-sky dice-roll was removed in `deep-sky-cleanup-2026-05-29`; the only surviving path is the external-galaxy click Easter egg (`:4-8`). The name over-promises. |

### Generated and curated data

| File | What | ⛔ Trap |
|---|---|---|
| `data/stellarCompanions.js:2-16` | Hand-authored curated table of famous multiples (+ pinned famous singles). **The** multiplicity source of truth. | Documented non-goal: no bulk WDS ingest, because that catalog is full of noisy optical line-of-sight pairs. It carries NO positions. "Completing" it from a catalog reverses a recorded decision. |
| `data/namedSystemsCatalog.js:1-16` | GENERATED. The shipped named-systems catalog — the fifth real-object mechanism (`docs/NAMING_AND_REAL_OBJECTS.md` §2). Rebuild: `node scripts/gen-named-systems.mjs`. | All invariants (uniqueness, blocklist, key-collision, round-trip) are checked at BUILD time inside the generator, not at runtime — a hand-edit ships silently until the script is next run. |
| `data/realProperNames.js:1-12` | GENERATED. 325 single-token real proper star names, used as a structural blocklist so procgen naming never emits a real star's name. Build: `node scripts/gen-real-proper-names.mjs`. | It is a union over four sources **including `data/stellarCompanions.js`** — adding a companion silently invalidates this blocklist until the script re-runs. |
| `data/knownSystemContents.generated.js:1-16` | GENERATED. Pre-resolved real planet lists for far companions, keyed by display name. Rebuild: `node scripts/gen-known-system-contents.mjs`. | Hand-editing is caught by a vitest drift guard that re-derives and deep-equals (`KnownSystemAuthoring.test.js`) — it surfaces as an unrelated-looking test failure, not a lint error. |

---

## 3. ⭐ The draw-stream discipline

**The one-sentence version: every saved seed in the game is a promise that this exact sequence of `rng` calls happens in this exact order. Any change to which draws are taken, or when, silently re-rolls the universe.**

A newcomer who reads only this section should be unable to move the universe by accident. Each rule carries the citation and the consequence.

### Rule 0 — Know the draw cost of every method

`src/generation/SeededRandom.js:13-97`. Complete public surface, with draw cost:

| Call | Draws | Line |
|---|---|---|
| `float()` | 1 | `:19-21` |
| `range(min,max)` | 1 | `:24-26` |
| `int(min,max)` | 1 | `:29-31` |
| `pick(array)` | 1 | `:34-36` |
| `chance(p)` | **1, even for `p = 0`** | `:39-41` |
| `gaussian(mean,sd)` | **2, always** (Box-Muller, no rejection loop) | `:52-58` |
| `logNormal(mu,sigma)` | **2** | `:69-71` |
| `gaussianClamped(...)` | **2** | `:84-86` |
| `child(suffix)` | **1, off the PARENT** | `:93-96` |

⛔ **Consequences.** `chance(0)` still consumes a draw — the comparison happens after `this.rng()` (`:40`). So `rng.chance(cloudChance[type] || 0)` at `PlanetGenerator.js:526` costs a draw for the fourteen types whose entry is `0.0` (`:516-524`). That is a feature: it keeps the cadence identical across types. **Deleting a zero-probability call to "optimise" it is a universe change.** Likewise, replacing Box-Muller with rejection sampling would make `gaussian`'s cost data-dependent and desynchronise everything downstream.

### Rule 1 — `.child()` costs one parent draw, and insulates horizontally only

`src/generation/SeededRandom.js:93-96`: `child(suffix) { return new SeededRandom(this.rng() + '-' + suffix); }`. Constructing a `SeededRandom` costs zero draws anywhere (`node_modules/alea/alea.js:26-63` — `new Alea(seed)` seeds by three `mash()` passes and never invokes the returned function); the one draw is `this.rng()` inside `child`, taken off the parent.

**The child's seed is a function of the parent's STREAM POSITION, not of the suffix alone.** Measured consequence at `tests/body-identity-fence.test.js:20-26`: shifting `planetRng` by one draw changed all four moons of a test planet and flipped one from plain to planet-class.

⛔ **Consequence.** The naming scheme — `rng.child(\`planet-${i}\`)` at `StarSystemGenerator.js:512`, `planetRng.child(\`moon-${m}\`)` at `:594`, `rng.child('main-belt')` `:741`, `'kuiper-belt'` `:761`, `\`trojan-${i}\`` `:783` — buys you **horizontal** insulation: adding a draw inside `PlanetGenerator.generate` cannot move planet i+1. It buys you **nothing vertically**. The planet loop itself takes root draws: `rng.logNormal(spacingMu, spacingSigma)` at `StarSystemGenerator.js:527` is **2 draws off the root**, conditional on `i > 0` and on the `known` branch above it (`:513-543`). So planet i's child seed depends on how many previous planets took the spacing branch. **The suffix string is decoration for auditability; there is no way to name a child that pins it against upstream movement.**

### Rule 2 — ⭐⭐ A value derived from a body's identity uses `namespacedFloat`, NOT `new SeededRandom(key).float()`

`src/generation/MoonGenerator.js:543-587`. `namespacedFloat(key)` (`:578-587`) is xmur3 — two `Math.imul` rounds over the key's charcodes plus an xorshift finalizer, returning a float. **It is a pure hash. No `SeededRandom` instance is constructed.** Its one caller builds the key from the body's stable identity and nothing else (`:256-257`).

The four-part reasoning, from the docstring:

1. Instrument B's DRAW STREAM channel counts draws through an accessor on `SeededRandom.prototype`, so it counts **every instance in the process**, not only the generation stream (`:550-552`).
2. The older `moonecc:` sub-rng reads green only because its draws were baked into the baseline at Step 0, commit `b2ac455` (`:552-554`).
3. **Measured counterfactual**: this exact block written with `new SeededRandom(compSeed).float()` moves the draw profile on **197 of 221 fence seeds** (`wd-0`: first divergence at yield 2, 68 → 69; total 8903 → 8907), +1 per plain moon, **with zero drawn VALUES moved**. The hash version moves **0 of 221** (`:554-558`).
4. DRAW STREAM is the only channel that can detect a leak into the shared stream, and a genuine `rng.float()` leak spliced at that point produces a signature byte-identical to the benign sub-rng's. Spending the channel's red on an expected construction leaves the next commit unable to tell a leak from noise (`:560-564`).

⛔ **Consequence of getting this wrong.** The trap is thinking "a fresh `SeededRandom` draws from its own stream, therefore it is invisible." **It is invisible to the generator and loud to the instrument**, because the instrument is on the prototype. Two further constraints: the key carries no per-system seed and no per-body counter, so the value is a pure function of the body (`:566-569`); and the hash must have real avalanche, because `deriveComposition` uses this one float as scatter across three correlated outputs and a weak hash would band them (`:571-573`).

### Rule 3 — ⛔ `moonecc:` is grandfathered, not a template

`src/generation/MoonGenerator.js:340-362`. `_computeTidalHeating` builds `moonecc:${...}` (`:358`), constructs `new SeededRandom(eccSeed)` (`:359`) and draws (`:360`). Its docstring (`:343-350`) correctly describes the NAMESPACE discipline — prefix + stable identity, no seed, no counter, zero draws from the passed-in `rng`.

**Copying its mechanism is the specific mistake Rule 2 exists to prevent.** `moonecc:` is green on DRAW STREAM only because its extra instance-draw was already in the baseline when the baseline was blessed. A NEW instance built the same way reds 197/221. **The namespace discipline transfers; the `SeededRandom` instance does not.**

Same applies to the third technique in the layer: `componentSystems.js:41` builds `new SeededRandom(String(canonicalSeed)).child(...)` and draws off it. Its docstring correctly says it draws nothing from the parent's live rng — and it, too, is green only because it predates the baseline. ⭐ **Of the three, only `namespacedFloat` costs the DRAW STREAM channel nothing when added today.**

### Rule 4 — ⭐ Do not grep for `&&`. Grep for *any `rng.` call whose evaluation depends on a value derived earlier in the same body.*

JS short-circuits. A conditional draw costs 1 on one branch and 0 on the other, so the draw cost of the line becomes a function of the data.

**Worked example, `hasClouds`** — `src/generation/PlanetGenerator.js:526`: `const hasClouds = atmoPhysics.retained && rng.chance(cloudChance[type] || 0);` When `retained` is false, `rng.chance` never evaluates. Two further draws sit in the dependent block at `:532-533`. `docs/FEATURES/lab-pipeline-into-game-PLAN.md:359-378` carries the corrected write-up — including its own retraction ("THIS SECTION ASSERTED THE OPPOSITE AND IT WAS WRONG. Corrected 2026-08-05 by a 12-agent verification pass") — and the downstream mechanism: `planetRng` desynchronises from that point, `child()` also consumes a draw, therefore **"every moon of every de-atmosphered planet becomes a different body, and every saved seed changes meaning."**

⚠ And the correction itself was partly wrong. That doc's "`retained` is true for 100% of bodies so the draw always fires" was measured wrong: `docs/FEATURES/step8-recon-lane-output-2026-08-12.md:984-991` and `:1489` report the short-circuit firing on **3.6–5.2% of planet-class moons** — live, not dormant, and live on the very population a later commit certified as neutral. **Two lessons: a conditional draw that is dormant today is a loaded gun, and "measured 323/323" can be an artefact of a small population.**

**Worked example that is not an `&&`** — `src/generation/PlanetGenerator.js:692-699`, the tidal-lock rotation branch: **2 draws unlocked, 0 draws locked**, expressed as `if/else` with no boolean operator in sight. `docs/FEATURES/one-pipeline-two-frontends-PLAN.md:396` names this as the mechanism behind a 22.0–22.7% draw-stream move measured on three independent harnesses, present on 52/52, 49/49 and 17/17 of the draw-altered bodies — **while `retained`, the mechanism the argument had rested on, flipped on only 8–12.** The `if/else` was the bigger mover and nobody was looking at it.

Other same-shape sites, all verified: `MoonGenerator.js:179` (`type === 'captured' && rng.chance(0.4)`), `:321`/`:326` (nested `rng.chance` inside a size branch), `:477` (`moonIndex === 0 && rng.chance(0.35)`), `:499` (`rng.chance(0.03)`, `hz` branch only); `StarSystemGenerator.js:497-499` (`rng.chance(0.08) ? 0 : Math.round(rng.gaussianClamped(...))` — a planetless system costs 1 draw here, a planeted one costs 3, because `gaussianClamped` is 2); `StarSystemGenerator.js:781` (`p.planetData.type === 'gas-giant' && rng.chance(0.6)` inside a planet loop — the number of ROOT draws this loop takes is a function of how many gas giants the system rolled).

⛔ There is **no test or lint rule** that mechanically forbids a new `rng.` call inside a conditional. The fence catches it after the fact and tells you the yield index, not the line.

### Rule 5 — Hoisting is right *sometimes*. Say which you did, in the comment.

Two shipped positive examples:

- `StarSystemGenerator.js:643` — `const destroyed = rng.chance(0.7); // draw unconditionally (cadence)`. The roll happens for every scattered index even when the planet is a known/injected one that can never be destroyed; the surrounding comment (`:636-640`) says the draw is "load-bearing for revisit-stability" and a known index is simply never added to the removal set.
- `MoonGenerator.js:470` — `const roll = rng.float();` at the top of `_pickType`, drawn before any branch, consumed even when the volcanic early-return at `:477` discards it.

⛔ **But hoisting is not free and not always right.** `docs/FEATURES/moon-formation-channel-model-PLAN-2026-08-15.md:129` states the rule for the four-term gate at `MoonGenerator.js:123` (`isLargeParent && moonIndex > 0 && totalMoons >= 3 && rng.chance(0.10)`, firing on 28.36% of calls per `docs/FEATURES/step8-recon-lane-output-2026-08-12.md:478`): *"An unconditional probability evaluation adds a draw to every moon of every rocky/ice/terrestrial parent — a draw-stream change across a large population that must be predicted, not discovered. **Keep the cheap binary gate first.**"*

**The rule: hoist when the branch is rare and the draw is already taken by the majority. Keep the cheap binary gate first when the draw is currently taken by almost nobody.** Hoisting at `:123` does not preserve the cadence, it *changes* it for the majority population.

### Rule 6 — The prefix is the highest-leverage position in the stream

`StarSystemGenerator.js:247-262`: `const isBinary = forceBinary === null ? rng.chance(binaryBaseChance) : forceBinary;` (`:262`). `forceBinary` is null for procgen and set when a `companionSpec` is present (`:249-252`). **Authored and component sub-systems take one fewer root draw than procgen systems, at the very top of the stream.** `stellarPrefix` returns the live `rng` (`:264-266`) and `_generateIterator` destructures it (`:279-281`) — this is the shared root, not a duplicate.

⛔ **Consequence.** Anything added here moves the entire system, every body, every seed.

### Rule 7 — Instrumentation you add to production code is an instrument change

`multiplicityOracle.js:97` calls `stellarPrefix(String(seed), ctx)` on the same seed purely to peek at `isBinary`. That is safe for generation — it gets its own instance and the cadence matches by construction (`multiplicityOracle.js:22`). **But under Instrument B's prototype counter, that oracle call's draws ARE counted.** An oracle call added inside an instrumented region is an instrument change dressed as a read.

Same class: `SeededRandom.js:15` assigns `this.rng = new Alea(seed)` as an **own-property assignment**, which is load-bearing — the fence defines an accessor on the prototype (`tests/body-identity-fence.test.js:226-244`) and that assignment invokes the setter. ⛔ **Refactoring the constructor to `#rng` or a closure would silently blind the primary instrument with every test still green.** This fact is documented only in the test (`:209-212`); `SeededRandom.js` itself says nothing about it.

### Rule 8 — A re-bless is a named commit, never a reflex

`tests/body-identity-fence.test.js:54-58`: *"a re-bless is a NAMED commit that says which step moved the stream and why. Never a reflex."* Echoed at `tools/port-uniform-delta.mjs:1685` ("A blanket re-record is how a regression becomes the new baseline") and `tools/moon-census.mjs:830` ("Do NOT adjust the expected numbers to match. Report it."). See §4 for the full matrix.

### Rule 9 — ⛔ Edits to the load-bearing plan docs must be LINE-COUNT-NEUTRAL

`docs/FEATURES/one-pipeline-two-frontends-PLAN.md:670-680`. About thirty citations in `tools/port-uniform-delta.mjs` and `tests/port-condition-contract.test.js` address that document **by line**. Inserting a paragraph re-points all of them at once, silently. The file's paragraphs are already one line each — **expand a line, do not insert one.** Verify: `git show HEAD:docs/FEATURES/one-pipeline-two-frontends-PLAN.md | wc -l` must equal `wc -l` on the working copy, for the region above the `## 11.` heading (`:674-677`, corrected at `:719`).

The governing sentence (`:660`): **"A ref that is wrong is worse than a ref that is absent, because it reads as freshly verified."** `docs/FEATURES/moon-formation-handoff-2026-08-17.md:86` records the live failure: "I broke line-count neutrality in `main.js` and only found out via 27 broken citations."

Citation forms, by how fast the target moves (`:664-668`): **symbol only, no line** for files every step adds lines to; **line + the symbol on that line** for everything else ("the integer is the convenience; the symbol is the ref"); **quoted claim** for refs into the plan itself.

### Rule 10 — Read the profile by yield index, not by total

The fence samples the running draw count at every `yield` of `_generateIterator` (`tests/body-identity-fence.test.js:355-358`). Yields sit at `StarSystemGenerator.js:511` (before each planet), `:593` (between moons, `m > 0` only), `:626` (post-loop, migration + resonance), `:732` (pre-belt), `:757` (pre-kuiper), `:776` (pre-trojan), `:916` (pre-overlay).

**Why segmented and not one total** (`:46-52`): on `wd-0` the whole system takes **8903 draws, but the star, all 6 planets and all 4 moons are done by draw 205** — the other 8698 are asteroid-belt particles. *"A single total is therefore ~98% belt noise… an extra draw inserted at index 500 moves the total by exactly +1 and moves NOT ONE BODY, which reads identical to a real body regression."*

The failure message names the index (`:635-638`). Reading it (`:621-624`): *"a change that starts at the belt index and leaves the body indices alone is a belt change, not a body regression."*

⛔ **The index→stage mapping is per-seed, not fixed.** Planet and moon entry counts vary; the `m > 0` guard at `:593` means a planet's FIRST moon contributes no yield; and `StarSystemGenerator.js:903` (`yield* this._generateIterator(cSeed, componentCtx)`) splices an entire nested system's yields into the middle of the parent's profile for multi-star systems. `profile[0]` is "everything up to the first planet" — or, for a planetless system, "everything up to migration". **Read the index against the seed's own structure.**

### Rule 11 — The two draw counters measure different objects, on purpose. Do not unify them.

| Counter | Mechanism | Sees | Blind to |
|---|---|---|---|
| Instrument B (`tests/body-identity-fence.test.js:226-244`) | Accessor on `SeededRandom.prototype` | **Every** SeededRandom in the process, including `child()` and every sub-rng | `alea` instantiated directly — nine `src/worldengine/**` modules do this (`:216-220`) |
| `moon-rng-stream-identity` (`tests/moon-rng-stream-identity.test.js:81-89`) | Patches the OWN `rng` property of the single instance per `generate` call, restored in a `finally` | The **shared stream only** | `rng.child(...)` and `new SeededRandom('moonecc:…')` — correctly |

`tests/moon-rng-stream-identity.test.js:35-36` says explicitly they must NOT be unified. The second counter's distinction is exactly the one the first cannot make, and it is why a benign namespaced sub-rng reds the fence on 197 of 221 seeds with zero drawn values moved (Rule 2).

### Rule 12 — When you add a channel to an instrument, name the mutant that reds it

`tests/body-identity-fence.test.js:806-846`. The stated principle: **"A gate that has never failed is not a gate."** The in-file negative control makes the wrapped Alea burn one extra value at draw **40** — deliberately inside `wd-0`'s body region, since bodies finish by 205 — asserts both channels move and at least one moon record moves, then asserts the un-perturbed call reproduces the baseline. The comment states the rejected alternative (`:819-822`): perturbing at 500 instead *"moves the total by +1 and moves no body at all, which is precisely the correct-and-useless measurement this file is built to avoid."*

The manual version of this control needed a production edit and got run once, by hand, in a session nobody remembers. **The question when you add a channel is not "is it green" but "what mutant makes it red, and does that mutant run automatically."**

---

## 4. The instrument battery

`npm run check:instruments` (`package.json:16`) runs **four** gates and ORs their exit codes. ⛔ **"All four" is not all the generation gates — it is four.** The moon battery, the L0 fixtures, material-parity, the driver decks, port-route-agreement and the golden trajectory run only under a bare `npm test` (`vitest run`, `package.json:14`) or by hand. **Nothing in the battery is enforced by git**: `scripts/git-hooks/` contains one file, `pre-push`, which runs `doc-rot-check.sh` in warn-only mode.

### The battery

| Instrument | Measures | Corpus | Re-bless |
|---|---|---|---|
| **A** — per-test-ID baseline<br>`scripts/test-baseline.mjs:3` | Set comparison over six channels: `failingTests`, `nonCollectingFiles`, `failingFiles`, `skipped`/`todo`, and `files{path:count}` so a **vanished** suite is caught. Nothing timing-dependent. | The whole suite. Recorded at `821e3f1f…`, **dirty tree**, vitest 4.1.0: 324 files, 5314 tests, 24 failed, 4 skipped, 15 non-collecting (`tests/baseline/known-failures.json:1`) | `npm run test:baseline:record` (`package.json:18`) |
| **B** — body-identity fence<br>`tests/body-identity-fence.test.js:1` | Three channels over the RNG draw stream and generated body records. Captures no pixels; invariant to every rendering change. 8 tests. | FENCE-221 | `npm run test:body-identity:rebless` (`package.json:20`) — ⛔ **rewrites the JSON only**, see below |
| **C** — shipped-uniform delta<br>`tools/port-uniform-delta.mjs:1` | Passes every body through the real `new Planet(sceneData)` and reads uniforms off `planet.surface.material.uniforms`. Does not re-derive the law. **No epsilon anywhere** (`:71-74`). | IC-526, 55 watched uniforms | `npm run port-uniform-delta:record --force` (`package.json:23`) — bare `--record` exits **65** rather than overwrite (`:1683-1687`) |
| **C′** — citation fence<br>`tools/port-uniform-delta.mjs:1023` | Scans every ``file:NNN `symbol` `` ref in ~30 CITE_SOURCES files; fails if the symbol is not a **token** on that line. | ~30 files | **NONE** — every broken ref repaired by symbol, by hand |
| `moon-rng-stream-identity`<br>`tests/moon-rng-stream-identity.test.js:133` | The per-`(parentType, moonIndex, resultType)` draw-count SET, pinned whole: **64 keys**. 4 tests. | STREAM-1500 | **NONE** — 64 lines + 4 counts + 6 span bounds, hand-edited |
| `moon-condition-contract`<br>`tests/moon-condition-contract.test.js:1` | VALUE gates for six derived moon fields (`massEarth`, `age`, `T_eq`, `composition`, `surfaceHistory`, `tidalState`) — a hash says "same as last time", not "right". 16 tests, at two layers. | MC-197 | **NONE** — every threshold fitted to MC-197 by hand |
| `port-condition-contract`<br>`tests/port-condition-contract.test.js:1` | The game→engine seam, four channels: key set; **bit equality** against a frozen pre-Step-1 adapter (`Object.is`, no tolerance); no-reader (delete each new key, re-run all eight laws); provenance via `@babel/parser` AST. 66 `it(` blocks. | PCC-120 | **NONE** |
| `port-route-agreement`<br>`tests/port-route-agreement.test.js:1` | The game crosses the engine seam **twice** per body (BAKE at generation, RENDER at `Planet.js:1594`) and both must describe the same body. | PRA-600 (2485 S + 29 P) | **NONE** |
| `moon-census`<br>`tools/moon-census.mjs:1` | Read-only population instrument. Installs no wrapper, writes no file, adds **zero** test IDs to Instrument A. Exit 3 if the corpus disagrees with its pin. | FENCE-221 (default) or BULK-221 | **NONE** — the pin `{221, 961, 770, 24}` at `:116` is hand-derived |
| L0 planet + moon baselines<br>`.../regen-l0-moon-baseline.mjs:1` | Freezes a 5-row moon grid against a byte-frozen parent (`GRID[7]`), and a 23-key planet grid. Gated in `world-engine-l0-plumbing.test.js` at `:459/:464/:473` and `:485/:489/:495`. | Synthetic grids | `node src/generation/__tests__/__fixtures__/regen-l0-moon-baseline.mjs` (and `regen-l0-baseline.mjs`) |
| `material-parity-list`<br>`tests/material-parity-list.test.js:1` | Parses `docs/FEATURES/step6-parity-ledger.md` and fails when doc and code disagree. Two live derivations, never a reading. | LAB-PROCEDURAL-200 | **NONE** |
| Driver-pack decks + `pack-contract` | PLAN §4 Step 5's five gates against `tests/fixtures/giantdeck-preset-baseline.mjs`, required max delta **exactly 0**. | Fixture rows keyed **by condition, not preset name** | **NONE** for the tests; ⛔ the fixture is **un-regenerable** — see below |
| `lab-surface-ratchet`<br>`tests/fixtures/lab-surface-baseline.mjs:1` | Shrink-only ratchet over three measured sets from `planet-lod-lab.html`. Growth blocks; shrinking is legal. | Source-level scan | **NONE** — entries added by hand, in the same commit, with a reason |
| V2-0 / V2-4 byte goldens<br>`tests/fixtures/v2-0-carrier-golden.mjs:1` | SHA-256 over carrier typed-arrays / exact `makeBaseStep` output / pre-extraction `steeredNoise3` bytes. Harness is **both** fixture generator and gate compute path, so they cannot drift. | Fixed seeds | Run the harness directly (each has a `main()` guard at `:134` / `:118` / `:149`) |
| `ProcgenSnapshot`<br>`src/generation/__tests__/ProcgenSnapshot.test.js:7` | AC8 seed-stream isolation for the real-universe overlay: purely procedural systems must be identical before/after. | Captured pre-Increment-1 through the real nav-warp arrival pipeline | `node scripts/capture-procgen-snapshot.mjs` — **overwrites unconditionally** |
| Mutation testing<br>`stryker.conf.mjs:1` | Closes one class by machine: **an assertion whose control is derived from its own subject**, which no mutant can kill. Two scopes: `test:mutation:helper` and `test:mutation:assertions` (⭐ the test files are both the subject and the suite). | 4 files | n/a — a review instrument |

Additional gates in this layer with no re-bless path: `moon-mass-radius-consistency.test.js` (a planet-class moon must not carry a planet's mass in a moon's volume — worst pre-fix case 27.6 M⊕ at 0.89 R⊕ ≈ 213 g/cc, ~20× denser than osmium); `gravity-provenance-fence.test.js` (fences **prose** — no comment or doc may assert the retired rocky-branch law as current behaviour); `src-boundary-fence.test.js` (no file under `src/` imports outside `src/`, exactly one allowlist entry); `StarSystemGenerator.immunity.test.js` (injected real planets with `p.known === true` survive every post-injection reshaping pass).

### ⭐ The re-bless matrix, in one line

**4 instruments have a command. 5 have a script to run. Everything else is hand literals.** The distinction is not cheap-vs-expensive but **auditable-vs-not**: a command-backed re-bless produces a diff a reviewer can read; a hand-literal re-bless produces a diff where a human typed a number, and the only thing separating "measured and named" from "adjusted until green" is the commit message. That is why every one of those files carries the same instruction in prose.

⛔ **Instrument B's one command splits its file in two.** `WD_REBLESS_BODY_IDENTITY=1` rewrites `tests/baseline/body-identity.json`. **Eight expectation sites live as hardcoded literals in the test file** and a human must re-derive every one:

| # | Literal | Line | Kind |
|---|---|---|---|
| 1 | `PLANET_CLASS_MOONS` — 24 `seed/planetIndex/moonIndex` strings | `:288` | measured @ bcb62d1 |
| 2 | live population `{planets:961, moons:794, plain:770, planetClass:24}` | `:687` | measured |
| 3 | same population re-derived from the baseline's own counts | `:697` | measured |
| 4 | `compared` = 221, asserted at **both** `:645` and `:739` | | measured |
| 5 | `moonShapeCensus` `{plain:{shapes:1,keyCounts:[25],records:770}, planetClass:{shapes:1,keyCounts:[20],records:24}}` | `:778-779` | measured |
| 6 | `PERTURB_AT = 40` (valid only because wd-0's bodies finish by draw 205) | `:826` | measured |
| 7 | `moved` partition all-zero | `:741` | structural zero |
| 8 | `hiddenBodyKeys` `[]`, `bakeMisses` 0 | `:787`, `:804` | structural zero |

**A re-bless that only runs the command leaves the file red on the population assertions until a human re-derives them.**

⚠ Stale in-file comment: `:512-520` says `baseline.planetClassMoons` "does NOT exist on disk yet". It does now.

### Instrument B's three channels, and how to read them together

| Channel | Line | Sees | Cannot see |
|---|---|---|---|
| DRAW STREAM (`profile`) | `:616` | A **segmented** draw count sampled at every yield. The pure generation-order channel; invariant to additive derived fields. | Value changes that preserve draw counts |
| BODY IDENTITY (`hashes`) | `:650` | sha256-16 value hashes over body records — catches two draws swapped, a range widened, a distribution retuned | A draw that feeds no body record |
| RECORD SHAPE | `:746` | Set equality on sorted key-name strings, plus `moonShapeCensus` and `hiddenBodyKeys` | Value drift |

**Red 1+2 = the stream moved. Red 2 alone = values moved without the stream. Red 1 alone = a draw moved somewhere that feeds no body record.**

⛔ `hiddenOwnKeys` (`:290-320`) is the ONLY channel that can see a **non-enumerable** append — every other channel is built from `Object.keys` or `JSON.stringify`, both of which skip non-enumerables, and `Object.defineProperty(moon,'massEarth',{enumerable:false})` is idiomatic here (it is how `conditionFromBody.js` attaches `_provenance`).

⛔ `PLANET_CLASS_MOONS` (`:288`) must stay TOP-LEVEL. Measured: adding a `pc` key inside `planets[]` moves `wd-0`'s rollup `e67f7a5184d423ac` → `95dbe61d46cc21be` **even on a seed with zero planet-class moons**, because it is the key's PRESENCE in the JSON that moves the digest.

### `WORLDENGINE_BAKES` — five fields excluded from two instruments, kept in sync by a comment

`['iceColor','iceness','landPalette','lavaCrustColor','lavaGlowColor']` — `planetData` fields that are OUTPUTS of the world-engine port rather than drawn values. Excluded from Instrument B's planet hash (`tests/body-identity-fence.test.js:173`) and from Instrument C's body fingerprint (`tools/port-uniform-delta.mjs:758`).

⛔ **The list is DUPLICATED, not shared.** Nothing imports across; the two are joined only by a "⛔ KEEP IN SYNC" comment. Two instruments that disagree about what "the same body" means produce an unactionable instruction, and a comment is all that stops it. Test 7 (`:801`) keeps the exclusion from becoming a hole.

### ⛔ Trap 1 — Instrument C's excluded-body zeros

The five bakes are the port's own OUTPUT. Hashing them into the body fingerprint puts the instrument's **subject inside its own matching key**:

> a port change moves the bake → the bake moves the fingerprint → the body is excluded as a POPULATION MISMATCH → **the uniform that actually moved reports `0.000000e+0`** and the operator is told to go fix a green Instrument B.

Measured on the first gas body: `iceness` 0 → 0.6002, `landPalette.weathered` `[0.408,0.250,0.176]` → `[0.241,0.228,0.206]`, **116 of 526 bodies excluded** (`tools/port-uniform-delta.mjs:735`).

⭐ **`--allow-deltas` cannot rescue this** (`:738-739`). The structural check runs first and exits **2** at `:2054-2057`, before the `movedUniforms.length && !has('--allow-deltas')` branch at `:2059` is ever reached. `--allow-deltas` only converts exit 1 into exit 0 for a **declared** pixel-moving step.

⛔ **And the negative control does not catch it.** `--selftest` (`:1955`) nudges `Planet.js:1643 uLimbExponent` — the uniform ASSIGNMENT site, **downstream** of the bake — while every real port change moves the condition **upstream** of it (`:747-750`). The file's own words: *"A convincing control can still step around the one class of change that matters."*

When the population HAS moved, the tool prints a caveat naming the `record`-tier rows as **not evidence** (`:1913-1921`) — their value source is a drawn `planetData` field and every body whose record moved was excluded by design.

### ⛔ Trap 2 — a green instrument during an open window proves nothing

Three shapes of this, all measured in-tree:

1. **Blessed-red is not green.** All 24 of Instrument A's known failures are generation-layer, and **23 of the 24 are one file** — `src/generation/__tests__/ProcgenSnapshot.test.js`, AC8 seed-stream isolation, on named bulge/far-arm/halo/mid-disk/near-sol-disk/outer-disk seeds. **The single largest standing red in the tree is a procgen-determinism gate that is currently blessed-broken.** Anyone reading "Instrument A green" is reading "those 24 are still broken in exactly the same way" — and anyone touching the draw stream will move it, which surfaces as *newly-red / no-longer-red churn on named seeds*, not as a clean signal. (The 24th is `componentSystems.byteSafety.test.js`.) The 15 non-collecting files are all `vendor/motion-test-kit/tests/**`.
2. **Green because the code never ran.** A prose backtick inside a `/* glsl */` template literal **terminates the string**, and `Planet.js` imports two such files. Under vitest that shows as a suite that stops **collecting** — 0 failures against N failed FILES — which a failure COUNT cannot see. Instrument C exits **69** for exactly this and says *"No delta was measured. This is NOT 'zero delta'"* (`tools/port-uniform-delta.mjs:118-135`). Instrument A's `nonCollectingFiles` channel exists for the same reason.
3. **Green because the assertion checks itself.** Stryker was installed 2026-08-08 after four such assertions were found in a single step — including `expect(files).toEqual([...files].sort())`, which sorts the subject's own output and compares it to itself, and a `toBeGreaterThanOrEqual(REQUIRED_CARRIERS.length)` under a comment claiming it stopped the list being trimmed: **trimming the list left the file 74/74 green** (`stryker.conf.mjs:1`).

Also: **a test going GREEN fails Instrument A's check exactly as loudly as one going red** — *"an unexpected pass is a signal, not a gift"* (`scripts/test-baseline.mjs:405-421`).

⚠ Two current caveats on the battery's own health, both from `docs/FEATURES/moon-formation-handoff-2026-08-17.md`: Instrument A's baseline was recorded from a **dirty tree** by this lane (so a clean checkout of that sha reads as drift, `scripts/test-baseline.mjs:561-565`), and Instrument C's capture was likewise recorded dirty. And `tests/moon-condition-contract.test.js:15-18` still says "TWO GATES FAIL TODAY, BY DESIGN" — ⛔ **that header is stale**: commits `10d4d1a` and `2154de1` landed after the test commit `1340c4d`, and Instrument A's baseline (recorded later still, at `821e3f1`) lists neither. Not run here to confirm; reported as indirect evidence.

⛔ **Instrument E (`npm run check:conic-gl`) cannot launch inside the agent sandbox** — `socket() failed: Operation not permitted`, a network-policy limit no flag fixes. It is deliberately NOT a `*.test.js` file, because `npm test` has no include filter and a test file there would fail everywhere Chrome is absent, turning Instrument A permanently red.

⛔ **`tests/fixtures/giantdeck-preset-baseline.mjs` is un-regenerable.** Its stated command names `scratchpad/capture-giantdeck-baseline.mjs`; that script is **not on disk** (`ls scratchpad/ | grep capture-giantdeck` → nothing). It sliced two live regions out of a pinned git blob of `planet-lod-lab.html @ 4e864bc` and ran them with `new Function`.

### Instrument C reference — strata, triggers, exits

**Strata** (`tools/port-uniform-delta.mjs:147`). **S** = `StarSystemGenerator.generate(seed)` for seed 1–90, every planet in generation order (372 bodies) — the shipped population and distribution. **P** = a wider sweep, seeds 1–1000, harvesting only `m.isPlanetMoon && m.planetData`, parents not re-added (64) — needed because `MoonGenerator.js:99` gates planet-class moons at `rng.chance(0.10)` behind a giant/sub-neptune parent with ≥3 moons in a non-innermost slot, **~1 per 40 systems**, so S alone gives 2–3. **G** = a forced grid, all 18 types × 5 orbits `[0.35, 0.9, 2.0, 6.0, 18.0] AU`, one fresh `SeededRandom(gridSeed + cell*7919)` per cell (90) — coverage insurance, because S's type mix is whatever the galaxy rolls (measured over 40 systems: 1 terrestrial, 2 ocean). G's per-cell RNG is deliberate; **G is coverage, not a draw-stream fence** (`:236-238`). A forced type that throws is RECORDED with `rec:null` and an `error` (`:249`), never silently dropped.

⛔ Do not confuse the S/P/G **strata** with the four **tiers** (`bake` / `condition` / `gate` / `record`, `:672-675`), which classify the UNIFORMS by value source, not the bodies.

**Four structural triggers → exit 2** (`:1779`): (1) watched-uniform set drift; (2) shape/kind drift on a still-shared uniform (Vector3 → Color, a silent semantic swap); (3) population mismatch; (4) build-failure count changed.

**Composition drift is deliberately NOT one of them** (`:1804-1829`). The capture writes a `counts` block that nothing read until 2026-08-07 — the committed capture said "27 name-matched + 8 aliased" while the live tool printed "28 + 7" and no gate could see it, because the comparison key is the NAME LIST. Making it fatal was rejected: it would force a 526-body re-baseline to clear a metadata mismatch, which is the exact "re-record to make the instrument green" move the plan forbids. It prints as a NOTE. Current capture: `{game:71, lab:351, shared:55, nameMatched:28, aliased:7, gameOnly:20, unwatched:16}` — ⚠ the tool's own header prose about "28 names" / "27 shared uniforms" (`:60-63`, `:77`) describes an earlier state; **the live watched set is 55**.

**Exit codes** (`:20`): `0` ok · `1` shipped uniforms moved · `2` structural break or broken citation · `3` selftest failure · `64` usage · `65` refused to overwrite without `--force` · `66` no capture on disk · `69` a game module would not load · `70` population not deterministic (a `--record`-only self-check that rebuilds the population twice and requires an identical fingerprint sequence, `:1693-1703`).

⭐ **Every Instrument C comparison is SAME-TREE-BEFORE vs SAME-TREE-AFTER on the SAME BODY RECORD.** Never lab-vs-game, never keyed by preset name (`:28-33`): fed the same nominal body the two frontends disagree by 3–6× on T_eq (Venus 737 K lab / 2345 K game) and by **5–7 orders of magnitude** on tidal heat (Europa 137 / 0.0019). A lab-vs-game "max delta 0" gate fails on day one for reasons unrelated to any change. This is enforced mechanically: `planet-lod-uniforms.js` is imported for its KEYS ONLY.

**The citation fence's self-control** (`:1327-1368`) runs six probes before checking anything and exits 3 if the resolver cannot distinguish a correct ref from a wrong one: a true ref must hold; a false ref on the same line must not; a non-token substring (`C`) must not; a **token suffix** (`SOURCES` inside `CITE_SOURCES`) must not — that probe exists because the right-hand boundary alone killed the `C` probe, so a mutant deleting the LEFT lookbehind kept the whole control green. ⛔ Second trap, recorded in the file: adding entries to `CITE_SOURCES` **shifts line numbers inside that very file**, and live refs point at `:1023` (`:1029-1031`, `:1067-1070`).

---

## 5. The corpora

⭐ **A number without its corpus is not a number.** This lane has already shipped four figures whose corpus was wrong (`docs/FEATURES/moon-formation-b4-prediction-2026-08-17.md:39-49`).

| Corpus | Definition | Population | Used by |
|---|---|---|---|
| **FENCE-221** | 192 bulk `wd-0…wd-191` (null ctx) + 5 pinned rare-type + **24 `gc-0…gc-23` with real `GalacticMap` contexts** on a golden-angle spiral 0.4→17.65 kpc at three scale-heights (`tests/body-identity-fence.test.js:93-136`) | 221 systems · **961 planets · 794 moons = 770 plain + 24 planet-class** | Instrument B; `moon-census` (default) |
| **BULK-221** | `wd-0…wd-220`, null ctx throughout — no pinned, no galaxy (`tools/moon-census.mjs:126-134`) | 221 · **948 planets · 829 moons = 803 plain + 26 planet-class** | `moon-census --corpus=bulk221`; the moon-formation audit |
| **MC-197** | FENCE's 192 bulk + FENCE's 5 pinned; drops the 24 `gc-*` (`tests/moon-condition-contract.test.js:84-89`) | 728 moons = 705 plain + 23 planet-class, from **733 plain records returned** (28 orphans discarded with their parents) | `moon-condition-contract` |
| **PCC-120** | `pcc-0…pcc-119`, null ctx (`tests/port-condition-contract.test.js:517`) | `CORPUS_BODIES = 526` planets, pinned at `:286`, asserted at `:607` | `port-condition-contract` |
| **PRA-600** | **Integer** seeds 1…600, no second arg (`tests/port-route-agreement.test.js:183-195`) | S = 2485 planets · P = 29 planet-class moons | `port-route-agreement` |
| **STREAM-1500** | `wd-0…wd-1499`, null ctx (`tests/moon-rng-stream-identity.test.js:56`) | **5207 `generate` CALLS** = 5038 plain + 169 planet-class → **4861 surviving records** | `moon-rng-stream-identity` |
| **IC-526** | Integer seeds. S = 1…90 all planets (372) · P = 1…1000 planet-class moons only (64) · G = 18 types × 5 orbits (90) (`tools/port-uniform-delta.mjs:168-172`) | **526 bodies**, 178 moon-bearing, 0 build failures | Instrument C |
| **MR-14** | Synthetic: 8 integer seeds × 7 forced types × 5 orbits × 4 moon indexes = 1120 attempts (`tests/moon-mass-radius-consistency.test.js:25-44`) | **14** come back `isPlanetMoon` | `moon-mass-radius-consistency` |
| **LAB-PROCEDURAL-200** | `lab-procedural-0…199`, null ctx | 200 systems, 64 binary; 341 planets actually swap (asserted `tests/material-parity-list.test.js:287`), 456 moons | `material-parity-list` |
| **LAB-PROCEDURAL-120** | The first 120 of the same family, re-measured at `9b33264` | 527 planets — ⛔ see below | Driver-deck seed selection |
| **RECON-2000** | 5 seed families × 400 (`pcc-`, `lane4-`, `lab-procedural-`, `seed-`, bare numeric) **+ Sol** (`docs/FEATURES/step8-recon-lane-output-2026-08-12.md:857`) | **6,719 moons** = 6,541 plain + 178 planet-class | The Step-8 recon lanes |

### ⛔⛔ FENCE-221 vs BULK-221 — the collision that has already shipped wrong numbers

Both are called "221 seeds". **They share only 192 of their seeds** and give different answers to the same question (`docs/FEATURES/moon-census-baseline-2026-08-15.md:22-38`):

| Quantity | FENCE-221 | BULK-221 |
|---|---|---|
| Moons | **794** | **829** |
| Planets | 961 | 948 |
| Gas giants | 63 | 72 |
| Sibling inversions | 57 of 292 | 60 of 321 |

`docs/FEATURES/moon-formation-audit-2026-08-15.md` quoted **BULK** figures into a plan whose acceptance tests run on **FENCE** — and that audit never says which corpus it used. **Neither corpus is wrong; quoting one against the other is.** `tools/moon-census.mjs` exists partly as the referee: it stamps every figure with its corpus key and **exits 3** if FENCE-221's shape disagrees with its pin, refusing to paper over it (`:824-835`).

### The four axes corpora disagree on

1. **Seed namespace.** `wd-N` (FENCE, BULK, MC, STREAM) · `pcc-N` · `lab-procedural-N` · **bare integers** (PRA, IC, MR) · `lane4-`/`seed-`. Different namespaces share **no bodies at all** — `1` and `'wd-1'` are different seeds.
2. **Galaxy context.** `generate(seed, galaxyContext = null)` (`src/generation/StarSystemGenerator.js:139`). ⭐ **Only FENCE-221's 24 `gc-*` seeds pass a real one.** Null skips the metallicity / age / star-weight / binary-modifier branches — so any figure from a null-context corpus is measured on a code path production does not take, **for those branches** (`tests/body-identity-fence.test.js:86-90`).
3. **Counting unit.** Records · **CALLS** (STREAM: 5207 calls vs 4861 records — migration-scatter and binary culling discard whole planets *after* their moons are built) · bodies-after-scene-scaling (IC-526 applies `toSceneData`, a hand transcription of `main.js`'s scaling law the tool flags as its own drift risk).
4. **Population shape.** Natural · forced-type grid (IC's G, MR-14) · rare-class harvest at a wider sweep (IC's P, PRA's P).

### ⛔ Traps that cut across all four

- **`526` is two unrelated numbers.** IC-526's 526 bodies (integer seeds, 372+64+90) and PCC-120's 526 planets (`pcc-*`) share **not one body**. Two corpora answering "526" is the exact shape that produced the 221 collision.
- **Thresholds do not transfer.** The same quantity — max plain-moon surface gravity — reads **1.2499 g on MC-197, 1.2499 g on FENCE-221, and 16.16 g on `wd-0…wd-1499`**. Every one of those outliers is break B7, not physics; fitting on the wide corpus would be fitting a bound to a bug (`tests/moon-condition-contract.test.js:36-37`, `:323-330`).
- ⭐ **The mass trap.** Planet-class moons return early from `MoonGenerator.generate` and never reach the record-append block, so they carry **no top-level `massEarth`** — it is on `planetData.massEarth`. Reading `m.massEarth` across the population yields `undefined` on 24 records and *"a confident, dramatic, wrong zero"* (`tools/moon-census.mjs:47-56`; verified 770/0/24 at `docs/FEATURES/moon-census-baseline-2026-08-15.md:256-260`). Same for `composition.density`. And `retrograde` is not a field at all — it survives only as the **sign of `orbitSpeed`** (`tools/moon-census.mjs:184`).
- ⛔ **Sol is in RECON-2000 and owns its extremes.** The headline max of 1,000,000 g is **Deimos** (`SolarSystemData.js:241`, radiusEarth 0.001); 346,021 g is **Phobos** (`:230`). Both hand-authored. The worst *generated* body is `seed-66#0.0` at 23,766 g — a factor of 42 lower. Any procgen claim quoted off that max is a claim about a NASA record. The per-family rows (`:925`, `:953`) are the safe read.
- ⛔ **STREAM-1500's size is part of the literal.** The key set is still growing (192→53 keys, 500→60, 1000→63, 1500→64, 2000→65), so **raising N "for coverage" reds the file by construction** (`tests/moon-rng-stream-identity.test.js:41-49`).
- ⛔ **MR-14 calls `generate` with 4 of 7 arguments** (`:37`), so `parentOrbitAU` is null and `_generatePlanetMoon` falls to its hardcoded 1.0 AU (`MoonGenerator.js:378`) regardless of which of the five orbits the loop is on. Its bodies are generated against a different star-distance than any system-walk corpus. Its guard is `moons.length > 5`, so a shape change dropping the population to 6 passes silently.
- **The seed lists are duplicated on purpose.** `moon-condition-contract` does not import the fence file, because a vitest module has no exports and importing it would execute its `describe`/`it` registrations inside the importer and silently re-run the 221-seed capture (`:56-58`).
- **`moon-census` restates six conventions next to every number they govern** — Hill radius `M/(3M)` form, POST-migration parent orbit, star mass = `radiusSolar**1.25`, Roche via the shipped `rocheLimit`, solid parent = not in `GIANT_PARENT_TYPES`, nearest-rank percentiles — because each has a defensible alternative.

⚠ **Unresolved in-tree discrepancy, not adjudicated here.** `tests/moon-rng-stream-identity.test.js:258` pins `stream.pairs` to **100**; the same file's header coverage table at `:46` says **105** at N=1500, as do both registry docs. Both numbers are in-tree. Not run (read-only session).

⚠ **Unreconciled, flagged by the doc itself.** `docs/FEATURES/one-pipeline-two-frontends-PLAN.md:820`: *"This sweep's 527 and the opening paragraph's 496 are two probes over the same seed range and they have NOT been reconciled."* Same seeds, same generator, two probes, 527 vs 496 planets. A same-corpus different-probe disagreement, still open.

⚠ **Not found:** a code-level assertion pinning PCC-120's 411 moons / 12 planet-class. Only `CORPUS_BODIES = 526` is enforced; the 411/12 appear only in `docs/FEATURES/step8b-c7-delta-table-2026-08-14.md:50`.

---

## 6. The dated-doc index

⭐ **Everything actually known about this pipeline beyond this file lives in dated `docs/FEATURES/*.md` artifacts.** They are episodic — *what changed on a date* — not structural. Read them for the question in the middle column, and check the right column before quoting a number.

### The moon cluster (read in this order)

| Doc | Answers | Authoritative for |
|---|---|---|
| `moon-formation-channel-model-PLAN-2026-08-15.md:8` | **The plan of record for the moon lane.** | §0's five verification findings checked against the tree; the B0–B10 build sequence; §4 missing instruments; §6 all four owner questions. Supersedes the moon-sizing half of `world-engine-reconciliations-2026-08-15.md` §3. |
| `moon-census-baseline-2026-08-15.md:22` | What the moon population actually is. | The FENCE/BULK corpus ruling; 49 of 794 moons beyond their own Domingos limit, 17 unbound outright (⛔ the three counts are **nested, not disjoint** — adding them double-counts 17). |
| `moon-formation-b4-prediction-2026-08-17.md:14` | What B5 must move, predicted before B5 exists. | The five-corpus register (§1); the withdrawal of the census's SECOND FINDING (§4a); §4b — B8's two acceptance assertions are co-satisfiable only for per-planet ≤ **8.766%**, and Elser's central 8.3% clears the per-system ceiling by 0.466 pp; §4c the baseline rates. Its §0 tier system (M measured / D derived / T target) is the discipline the lane runs on. |
| `how-rare-are-big-moons-2026-08-15.md:14` | What "rare" means, from the literature. | Band A (Moon-class, 0.2–0.7 R⊕, solid parents, giant-impact, Elser 8.3% central, 2.2–25% bracket; Nakajima parent gate rocky <6 M⊕ / icy <1 M⊕) vs Band B (>1 R⊕, gas giants, pull-down capture) as **two different objects, not one dial**. §2: no published channel makes a 2 R⊕ *moon* at all. §5: an explicit list of what the literature does NOT support. |
| `moon-formation-audit-2026-08-15.md:18` | The 72-entry gap register. | §1's reframing: `MoonGenerator.js:122-124`'s `isLargeParent` gate is **inverted** — the game makes its largest moons exclusively around the parents that physically cannot make them. |
| `moon-formation-handoff-2026-08-17.md:1` | Current lane state. | §1's read-order table (the fastest correct entry into the whole cluster). ⚠ Two of its three next-actions are done; ▶ NEXT now resolves to **B5** alone. |

### The port / lab→game program

| Doc | Answers | Authoritative for |
|---|---|---|
| `one-pipeline-two-frontends-PLAN.md:4` | The buildable port plan. | Steps 1–8; §2 the measured diagnosis (the two frontends already share one condition engine — the cost is the unimportable driver stage in a 6,411-line HTML file); §10 the citation convention; §11 when a step is DONE; §12 Instrument E; MAX'S RULINGS (`:588`), all five answered. ⛔ Rule 9 above governs edits. |
| `one-pipeline-two-frontends-CARRIED.md:13` | Disposition of every adversarial-review finding. | The Open / Cleared / Retired-by-Max ledger. ⛔ Rows are amended in place — **read the correction, not the sentence after "Original text follows"**. |
| `step6-parity-ledger.md:1` | Feature parity of the material swap. | Every feature the game draws on swapped bodies, ruled carried / accepted-loss / blocking, machine-checked by `material-parity-list.test.js`. §5 its named limits. ⛔ Nothing in it was measured on Sol. |
| `step8-build-plan-2026-08-12.md:7` | Step 8's real numbers. | §1's 19-row verdict table on the PLAN's own claims (most figures do not reproduce; two gates inverted or vacuous; the central safety claim about 8b wrong in the dangerous direction). ⛔ Supersedes Step 8's numbers, not its intent. ⚠ Entirely headless — no render check. |
| `step8b-c7-delta-table-2026-08-14.md:1` | The prediction-commit template. | §6 contradictions resolved; §7 REFUTED. Its method rule is the durable part: two harnesses each passing a byte-identical control **before** any delta was accepted. |
| `step8-recon-lane-output-2026-08-12.md:8` | Raw evidence behind the build plan. | ⛔ **Nothing on its own.** Where a lane disagrees with the build plan, the build plan wins. |
| `step5-6-untriaged-findings.md:6` | 27 non-blocking findings that lived only in `/tmp`. | ⚠ Only **two** are personally verified. The other 25 are leads. Reproduce before repairing. |
| `step8-recon-process-notes-2026-08-12.md:7` | How to work in this repo. | 20 gotchas / 8 probes / 9 traps — `/tmp` gets swept, the no-dev-servers hook matches "vite" inside a heredoc, a probe must live inside the tree it measures, sandbox "permission" errors are not guards. ⛔ Contains **no findings** — do not mine it for numbers. |

### Strategic frame and older layers

`planet-lod-CHARTER.md:1` — why the LOD lab exists, the standing north star, and ⭐ **the lab ≠ the game BY DESIGN**. If a handoff and this charter disagree on the FRAME, the charter wins. · `planet-visual-features.md:1` — the L0→L1→L2 causal model and the 18 type presets as driver bundles. · `world-engine-architecture-spine.md:1` — the story-engine frame in Max's words: what renders IS the body's history, so the engines' dependency order is time's arrow. ⛔ Self-described as a brainstorm, not a build. · `lab-vs-game-renderer-divergence.md:1` — why two renderers exist, and that it is intentional, not drift. · `binary-planets-scoping-2026-08-17.md:9` — yes, a binary pair can be generated with correct barycentric physics and drawn correctly **today** with zero renderer changes, if the companion is delivered through `planets[i].moons[]` with the full separation in `orbitRadiusScene`.

### ⛔ SUPERSEDED / WITHDRAWN — do not quote

| Claim | Where it still reads as live | Refuted by |
|---|---|---|
| **A planet-class moon renders black past ~3.5 body radii.** | `moon-goes-black-on-approach-2026-08-15.md` §1 onward — the whole body reads as a measured live defect | Its own §0 at `:6`. The table mixed one pre-freeze screenshot with five post-freeze and read session state as distance; A→B→A at radii 3.2 → 12.0 → 3.2 gives mean L 41.8 / 42.8 / 41.7. The ROI was also 55 px off-centre. ⭐ **Highest mistake-risk file in the directory** — skim past the strikethrough title and you reopen a defect that does not exist. §0.1 lists the four things that survive. |
| **"Nothing can currently be irregular"** (so the potato flag is blocked behind sizing) | `moon-formation-audit-2026-08-15.md` §1 | Its own §0 C1 at `:22` — false and backwards; **224 of 829 moons are under 300 km**. |
| **"0.02–0.04 of parent = 1200–2400 km"** | same audit | §0 C2 at `:32` — gas giants are [6.0, 14.0] R⊕ (`ScaleConstants.js:77`), so **764–3568 km**. |
| **"Rings should correlate with moons" as an acceptance test** | same audit | §0 C3 at `:37` — they are independent in code but **already correlated in output** (67% vs 52%), so such a test **passes on unmodified code** unless it controls for planet type. |
| **The Hill-sphere "understated 4×; 32 unbound + 47 beyond"** | same audit §0 | ⛔ **C4 at `:47` reverses direction** — that correction was itself wrong and the figure it corrected (16 and 48, union 51) was right. `moon-census-baseline-2026-08-15.md:83-96` could not reproduce the audit's 79 on the audit's own corpus under either Hill convention, either threshold, per-moon or per-planet denominators, primary-only or combined binary mass. Treated in-tree as **unsourced**. |
| **"Terrestrial multiplicity is 0.0181/system, a factor of ~150 — file a `PlanetGenerator._pickType` defect"** | `moon-census-baseline-2026-08-15.md` SECOND FINDING at `:54` — ⛔ **no withdrawal annotation exists inside that file** | `moon-formation-b4-prediction-2026-08-17.md:229` — a category error. Corrected: 3.1357 solid planets/system → **23.79% of systems**, inside the plan's 6.67–25% target. **There is no `_pickType` defect.** |
| **m̄ = 3.69 moons/planet** (stated three times) | `moon-formation-channel-model-PLAN-2026-08-15.md` | `moon-census-baseline-2026-08-15.md:22` — reproduces on **neither** corpus; measured 3.5928 / 3.7453 / 4.0510 (fence) and 3.7511 / 3.9289 / 4.2081 (bulk). Asserted, never derived. |
| **13.9% P(zero moons \| gas giant)** carried into a fence-verified design | same plan §B0 | It is the **BULK-221** figure; on FENCE-221 it is **12.70%**. |
| **"Binary planets are out of scope on renderer grounds"** | same plan §5 | `binary-planets-scoping-2026-08-17.md` §1/§3, and `moon-formation-handoff-2026-08-17.md:52` says so explicitly. ⛔ Do not read §5 as a scope ruling. |
| **"~5% prograde / ~24% retrograde retention under disk migration"** | The audit, and it reached Max in conversation | `how-rare-are-big-moons-2026-08-15.md:164` — from an **unrefereed preprint** (Pu, Li & Zhu 2025) with a stated arithmetic error and an abstract/conclusion contradiction. Use **Dobos 2021**. |
| **"Pick the middle, ~1 in 8"** | `how-rare-are-big-moons-2026-08-15.md:41` | Withdrawn by Max's ruling that Band A is the **literature value**, not a tuned dial. |
| **"`namespacedFloat` returns a different float for EVERY moon"; "`compSeed` and `moonecc:` are both zero-draw"** | `moon-formation-handoff-2026-08-17.md:66` — the **current** handoff | `moon-formation-b4-prediction-2026-08-17.md:130` — measured, probe A moves **0 of 24** planet-class moons; and the two mechanisms are different (`compSeed` is a pure xmur3 hash, `moonecc:` is a real `SeededRandom` draw that stays green only because re-keying preserves the draw COUNT). See Rules 2–3. |
| **"Planet-class moons are binary planets" → narrow the radius range** | `world-engine-reconciliations-2026-08-15.md` §2 | Its own §2.1 and §3 at `:162` — symptom and symptomatic fix. Its blast-radius line is withdrawn at `:197`: the fix moves **794 moons, not 24**, so "plain moons must stay 0/770" is now WRONG. |
| **"⛔ STATUS: OPEN. Not fixed."** (orbit-ring depth artefact) | `orbit-ring-depth-artefact.md:6` — the header | Its own §10 at `:596` — **FIXED**, shipped `b9eeaec`, VERIFIED_PENDING_MAX. The header was never updated as the 684-line file grew. What IS still open is a *different* defect: 45.9% of painted pixels have no in-front ring point within the band's reach, scoped in `orbit-ring-overpaint-SCOPE.md`. |
| **"TWO GATES FAIL TODAY, BY DESIGN"** | `tests/moon-condition-contract.test.js:15-18` | Commits `10d4d1a` and `2154de1` post-date the test commit `1340c4d`; Instrument A's baseline at the later `821e3f1` lists neither. ⚠ Indirect — not run here. |
| **Tree state, HEAD, unpushed counts** in `world-engine-INDEX.md` | `:5` — "branch master, everything local — nothing pushed (Max: HOLD)", "Current HEAD = ccd6b8d" | The tree has been on `feature/world-engine-production-L1` and pushing for months. ⭐ Only **one** item in that file is from August, so its 2026-08-14 commit date makes the whole thing look fresher than it is. |
| **`HANDOFF-phase4c-F44-pickup.md` and `HANDOFF-phase4c-F51-pickup.md`** | Both read as live handoffs | Declared stale and deletable by `HANDOFF-phase4c-rework-2026-06-13.md:5-6`, whose own F51 half is in turn superseded by `HANDOFF-F51-v2-implement-2026-06-13.md:4`. |
| **`step8-handoff-2026-08-15.md` / `-08-14.md` / `-c7-08-14.md` / `-08-12.md` as state documents** | All four carry HEAD/instrument readings | Superseded by `moon-formation-handoff-2026-08-17.md`, which states its baselines are "NOT the ones the predecessor handoff quotes" (A moved 5312 → 5314; citations 401/447 → 423/480). ⭐ **Read them for their §3–§6 only** — the working rules, what the author got wrong, the technique that worked; each later handoff explicitly declines to repeat the earlier ones. |
| **`lab-pipeline-into-game-PLAN.md` titles itself "⭐ THE PLAN OF RECORD"** | `:1` | `one-pipeline-two-frontends-PLAN.md:4` says it supersedes that file's **sequencing**. ⛔ Two files in the directory each read as the plan of record. That file's own 2026-08-05 block at `:14` also withdraws four of its own instructions, including a §LAYER 3 port instruction that **would cause a regression**. |

⚠ Two known-live errors inside `one-pipeline-two-frontends-PLAN.md` itself, filed at `step6-parity-ledger.md:229` by a lane that could not make the edit: §12.4's committed eyeball seed does not swap, and §6b's five-row loss table is scoped to the gas branch while the swap is not. **The PLAN is knowingly wrong on those points until someone edits it** — under Rule 9's line-count constraint.

---

## 7. Known open defects in this layer

Each is recorded in-tree with a citation. None is fixed as of 2026-08-17.

1. ⭐ **Binary-star mass ratio disagrees with the gravity model.** `docs/FEATURES/binary-planets-scoping-2026-08-17.md` §1. Procgen's *q* and the gravity model disagree by a **median factor of 1.22×, max 8.83×**. `star2` is a hardcoded singleton. Filed as a separate defect from the binary-planet question.
2. ⭐ **Binary-star orbits run 55–948× faster than Kepler.** Same section, same file. Same root: the star-pair orbit was authored, not derived. Compare Rule-adjacent history — `StarSystemGenerator.js:19-25` records the *planet-side* version of this bug (up to ~100× too fast) and its fix.
3. **`GravityField.js:179-188` never reads a mass.** Same file, §1 — the plan's claim that "the SOI/gravity model" needs work is right, **and worse than stated**.
4. **The Jeans-escape branch is unreached for planets.** `tests/body-identity-fence.test.js:594-604`. Break B7's fix (`2154de1`) dropped `wd-45`'s hex planet T_eq from 1023.57 K to 457.75 K and the branch stopped firing. Measured across `wd-0…wd-1499` (6279 planets): `atmosphere: null` occurred on **exactly one planet**, only before the fix, **zero after**. The corollary is left OPEN in the file: `PlanetGenerator.js:449 if (atmoPhysics.retained)`'s escape branch is now dead for planets. ⛔ This also means the fence has **lost coverage of the `atmosphere-null` class** — the only way `PlanetGenerator.js:526` short-circuits (Rule 4).
5. **`planetData.tidalHeating` is stale on every resonance-snapped or migrated planet.** `docs/FEATURES/step2-tidal-delta-table.md:125` — recorded as an adjacent unfixed defect, not part of that gate.
6. **The nav prism/NAV-screen moon angle is frozen.** `binary-planets-scoping-2026-08-17.md:99` — radius uses the real `orbitRadiusEarth` (`NavComputer.js:2546`), but the angle is static (`:2567`). ⚠ That section also self-corrects a first draft that called the radius cosmetic.
7. **`ProcgenSnapshot` AC8 is blessed-red on 6 named seed classes.** 23 of Instrument A's 24 known failures. See §4 Trap 2.
8. **`WORLDENGINE_BAKES` is duplicated across two instruments with no shared import.** §4 above. A comment is the only guard.
9. **`tests/fixtures/giantdeck-preset-baseline.mjs` cannot be regenerated** — its capture script is not on disk. §4 above.
10. **`knownObjectSearch.js` and `src/ui/DebugPanel.js:582-711` are two implementations of the same search** and can drift (`knownObjectSearch.js:5-6`).
11. **`GalaxyVolumeRenderer.js` duplicates `GalacticMap`'s density constants** with no automated guard (`GalaxyVolumeRenderer.js:8-10`), and is a renderer in `src/generation/` pending a move (`docs/SYSTEMS.md:126-130`).
12. **~30 files in `src/generation/__tests__/` are unclaimed by any system**, and `docs/SYSTEMS.md:131-134` files the "are test files claimed?" question as undecided. Neither `doc-graph.js` nor `doc-rot-check.sh` implements the stated intent that `__tests__/` inherits from its system-of-origin.

### ⚠ Not verified in this pass

Nothing in this file was verified by running the test suite — a dev server is live on this tree and the session was read-only. The instrument readings quoted are the ones recorded in `docs/FEATURES/moon-formation-handoff-2026-08-17.md`, which is a snapshot. **Run `npm run check:instruments` before trusting any of them.**

Two things I looked for and did not find: a CI configuration that runs `check:instruments` (I checked `package.json` and `scripts/git-hooks/`, not exhaustively — treat as "not looked for hard"), and any shared import joining the two `WORLDENGINE_BAKES` definitions (grepped; none).