# wire-storm-slice-lab-into-game — intent

## Why we care

Max, 2026-09-02, ruling on what comes after the river router: *"I want to continue wiring up all
the features from the world engine before we try to further develop any of them."* The storm slice
is the last row in the plan's queue (b) — F27 the great-spot anticyclone and F28 the storm clusters,
carried by the `uStorm*` uniform family. With it wired, every gas-giant feature the lab has
(F24/F25 bands and jets, F27/F28 storms, F29 the polar vortex, F31b haze, F34 the limb) reaches the
game through one pipeline.

Why wiring outranks developing, in his words (2026-08-26, looking at three real storm defects in
the lab): *"all of these do not need to be implemented before we get things wired up. Part of the
reason to wire up all the rendering tech here is that as we continue to experiment and add new
features, they'll be implemented into the game seamlessly and quickly."*

Standing constraint #3, Max 2026-07-31: **"REPLACE, not graft"** — *"the goal here is to have the
lab's rendering pipeline in the game — the procgen and the rendering itself."*

Why the storms, in his words. Scoping the lab's storm increment (2026-07-14): *"Realistic variety of
giants' atmospheres driven by physics; also, the visual detail of the storms/atmospheric phenomena
is seriously lacking today."* The lab answered with a physics writer that places vortices at the
anticyclonic-shear maxima of the band staircase (`world-engine-atmo-3b-storms-2026-07-14`, his UAT:
*"these are generally good, and I'm glad to hear they're being driven by the new system"*), then
made placement vary per seed (`world-engine-atmo-derive-not-freeze-2026-07-15`, his gate *"every
re-roll seriously different"*, his verdict *"Yep, passes"*). His complaint that increment fixed —
*"the spots/storms appear in the same place every seed"* — is the property this wire must carry
into the game: every gas giant its own storms, the same ones every visit.

None of that reaches the game. Since 2026-08-28 the game bakes the storm/convection MASK
(`aStorm`) on every gas body, so the band roughness, filamentation and ink advection the mask gates
are live — but the discrete vortices the mask was placed around never arrive: `uStormCount` is 0
on every game body, and every storm term in the shader sits behind it. The game's gas giants have
weather with no storms in it.

⭐ **What this wire IS, in pipeline terms.** Stage 1 (drivers: T_eq, rotation, radius, composition,
the body's seed) → stage 2 (world generation: the storm writer places 1 primary + up to 7 train
members on the shear maxima of the same band staircase the deck baked) → stage 4 (render: the
shader's swirl term wraps the bands around each oval, the colour term paints core/collar/companion,
the wake term advects the band ink around it). Stages 1, 2 and 4 all exist in the game today. What
is missing is the carriage between 2 and 4 — the eight slots — and the one lab-local function that
fills them. Nothing bakes, no worker, no VRAM: five uniforms on a material.

## What the lab does that the game must — the DOES table (feedback_worldengine-does-unlocks-map)

| DOES (output) | driver | player sees |
|---|---|---|
| `uStormPosSize[i]` — xyz unit-sphere centre, w angular radius | `resolveStormE` (`src/worldengine/base/storm-e.js`): the primary at the anticyclonic-shear ARGMAX of the PV staircase (`resolveStormPlacement`), longitude from the `stormE:place` stream; the train on the same / next shear maxima; radius by class (primary 0.18–0.30 rad, train 0.05–0.09) | WHERE the great spot and its family sit — on the belt the deck's own shear picked; the same place every visit (seed identity: `macroSeed` × the declared `GAME_STORM_SEED`) |
| `uStormParams[i]` — x swirl (sign = circulation), y E-W aspect, z mode, w companion | swirl sign from the shear zone; aspect 1.6–2.0 on the primary; mode from the vigor ramp (T_eq 55–130 K: < 0.35 ⇒ dark cleared spot, else warm anticyclone); companion 0.8 on dark spots, sign-packed centred/offset | the bands WRAP around the oval (`stormSwirl` rotates the direction the band ladder reads — the *embedded in the flow* read); E-W elongated; a warm red oval on warm decks, a dark cleared hole with a bright white companion on cold ice-giant decks |
| `uStormColor[i]` | the chromophore age ramp white → brick-red on the `stormE:age` stream, 20 % deck-tinted from `atmosphere.color`; barge = darkened deck tint; scooter = blue-white; dark spot = the cleared colour blended by lifecycle `coreScale` | the core's colour; an older storm is redder than a young one on the same planet |
| `uStormAux[i]` — x age, y emboss direction, z deck height, w billow phase | `stormE:emboss` / `stormE:billow` streams; deck height from mode + age via `STORM_DECK` (a warm spot earns a TOWER above the zone deck, a dark spot reveals the FLOOR) | the rim shading direction, the column height the compositing reads, the scallop phase of the collar |
| `uStormCount` | `vortices.length` (≤ 8), 0 when the writer is off-gate (non-gas; hot-Jupiter suppression) | whether any of it renders — count 0 is the shipped byte-identical off state, and the A/B |
| the same slots, read by the wake terms | `dWake` and its sibling in `height.glsl.js` iterate `i < uStormCount` | the band ink advected around each storm — the *ink-in-water* machinery that exists today and runs on zero storms |

**The population, measured at scoping** (`scoping-corpus-2026-09-02.json`; 24 `rocky-*` seeds, 32
gas bodies, the game's own condition → `giantDeckPack` inputs → `resolveStormE` at
`GAME_STORM_SEED`): every one of the 32 gets storms (hot-Jupiter 0, Uranian 0). Primaries: 26 warm
anticyclones, 6 dark spots. Families: 22 pearl trains (4–6 pearls), 4 barge + oval pairs, 6 scooter
families. 2–7 storms per body; 25 distinct primary latitudes and 29 distinct longitudes over 32
bodies. Regimes: 19 sub-Neptune, 6 Saturnian, 7 Neptunian — **no Jovian body and no hot Jupiter in
the game's population**, the same coverage gap `tests/driver-pack-polardeck.test.js` records for
the pole. Cost: 0.5 ms mean, 3.2 ms max per body including pack #1's own derivation.

**UNLOCKS.** With the slots live, every storm-facing lab increment reaches the game on the day it
lands in the lab — the per-storm compositing (S3/S4), the blend fix Max logged as QB-16, the
ink-in-water work QB-18, lightning on the mask + slots (#4), the haze family's Uranian read (F31).
F27 and F28 flip to ✅ in the F-spine and **queue (b) is empty**; what remains unwired is queue (c)
(features that render nothing until world generation feeds them) and the two partials F3 / F35.

## Success criteria (Max's language where he gave it; the wiring rules otherwise)

- The game's storms are **the lab's storm writer** — one pack under `src/`, imported by both
  front-ends; the lab's own copies of the colour law, the deck-height law and the slot assembly are
  deleted. Not a copy, not a graft onto the game's shader (which already carries every consumer).
- On a gas giant in a procedural system, the storms are *"driven by the new system"* — placed on the
  belt the shear picked, not *"rolling dice on specific variables"*: the vortices the game places
  are the vortices its `aStorm` mask was baked around (one (regime, drivers, seeds) tuple, two
  readers).
- *"Every re-roll seriously different"* → in the game, every gas giant its own storms: over the
  corpus the primaries' latitudes and longitudes are distinct across bodies, and the family (pearls /
  barge / scooters, warm / dark) follows each body's temperature.
- Not *"in the same place every seed"* → the same body shows the same storms on re-approach.
- The bands *wrap around* each oval rather than a decal pasted on them — the lab's `stormSwirl`
  term is what renders, gated on the count.
- ⭐ **Nothing else about the universe moves.** With the count at 0 the render is byte-identical to
  today (the lab's own regression contract); solid bodies are untouched; every other pack's output
  is unchanged.
- The lab in Chrome still authors: its two ✓ checkboxes still drop the great spot and the train
  independently, its 🎲 reroll still re-places everything, its driven sliders still read the values.
- Every cost is **recorded**: per-body resolve time; zero VRAM; no worker; no new attribute.
- ⭐ **Max's gate:** flying in on a gas giant in a procedural system with the A/B key — does the great
  spot and its storm family read as part of the gas deck, riding its bands, in the same place when he
  comes back; and does the next gas giant carry a different family? He judges the WIRE. The great
  spot *"does not blend correctly with the rest of the gas"* (QB-16) and the missing *"ink in water"*
  complexity (QB-18) are lab defects he has already logged and deferred by the 2026-09-02 ruling;
  they will be visible and are not this gate.

## Decisions taken in scoping (stated so Max can overrule at greenlight)

1. **Storms are ON in the game, both families.** Ruling #4 (2026-08-06, `gates = ALL_ON`): the lab's
   two enable checkboxes (`greatSpotEnabled`, `stormTrainEnabled`) become two registry gates, both
   true under the game's policy. The A/B key is **`I`** — unbound in the game's key map (measured:
   `grep -rhoE "'Key[A-Z]'" src` has no `KeyI`; `SceneInspector` uses Shift+I, and the A/B handler
   ignores every modifier, the same rule V/J/U follow). It writes `uStormCount` 0 on every live gas
   material — the lab's own off state — and restores the composed count.
2. **`GAME_STORM_SEED = 0`**, already declared at `polarDeck.js` on Max's 2026-08-22 ruling (the lab's
   1234 is an authoring knob; the divergence is DECLARED, not closed). The pair (`macroSeed`, 0) is
   per-body unique because `macroSeed` already is. The pack imports it; no second 0 is authored.
3. **The storm colour reads `condition.atmosphere.color`** — the field pack #1 makes `uBandTint`
   from and the polar pack makes its cap tint from — not the lab's live `state.bandTint`. Identical
   by construction across the two front-ends (the polar pack's precedent); in the lab `bandTint` is
   driven from the same field, so the lab is byte-identical too, and AC-2 measures rather than
   argues it.
4. **`trainRadiusScale` is a lab knob** (default 1.0 = the derived size, world-engine-lab.html:1011).
   The game does not write it; the pack test asserts the lab default equals 1 so "unwritten" is
   provably "the lab's value" — the `POLAR_LAB_KNOBS` precedent.
5. **The pack contract learns ONE new value shape.** `resolveDriver` admits finite numbers, flat
   numeric arrays and `scalar()/sizeKm()` drivers; `writePackUniforms` writes an array into an
   array-valued uniform ELEMENT-WISE, which would replace the eight `Vector4` slots with numbers.
   The storm carriage is three `vec4[8]`, one `vec3[8]` and an `int`. The extension: a driver may be
   an array of equal-length numeric arrays, written slot-wise through each target's `.set`; every
   existing driver is byte-inert (measured over the corpus, AC-1). The alternative — flatten to 32
   floats and reshape in the writer by uniform name — was rejected because it needs a per-uniform
   width table, a second thing to drift.
6. **The slot composer is ONE function both front-ends call.** Slot 0 = the primary iff its gate,
   then the train iff its gate, cap 8, count = slots written, `uStormAux` slot-synced — the lab's
   frame-loop law (world-engine-lab.html:5170-5195) moves into the pack module; the lab's frame loop
   calls it every frame with its checkboxes, the game calls it once at material creation. Once is
   correct: every storm term in the shader is static (`no uTime` at each block), so nothing
   animates the slots.
7. **The pack re-derives pack #1's input chain** (`giantRegimeOf → drawGiantConditions →
   deriveGiantDrivers → giantDriverScalars`, plus composition and T_eq) rather than reading pack #1's
   `meta`: packs cannot see each other's results inside `runPacks`, and a pack that depended on
   array order would be the ordering dependency the collision throw exists to forbid. The chain is
   deterministic, so the two derivations agree — and AC-3 TESTS that they do (deep-equal against the
   mask bake's own vortex list) instead of relying on it.
8. **No per-feature relevance key.** The lab's storm write (world-engine-lab.html:5176) carries no
   `featureRelevant` multiply, unlike the polar write at :5174 — measured, not assumed. The game's
   `GAME_RELEVANCE` stays empty.
9. **Two lab defects ship with the wire, as they are:** QB-16 (the great spot laid ON the bands, no
   shear at its boundary) and QB-18 (ink-in-water complexity). Max's 2026-09-02 ruling defers them;
   the UAT walk names them so they are not re-judged as the wire's.
10. **One new backlog row, logged not fixed:** the writer's personality ramp saturates at 130 K
    (`STORM_PHYS.VIGOR_HI`, calibrated on Solar-System giants), and 20 of the game's 32 gas bodies
    sit above it — every warm sub-Neptune (T_eq 138–337 K) draws the same Jovian personality (warm
    primary + pearl train). Outside the calibration domain the rule stays neutral
    (feedback_no-unsimulated-invention); the row records the population so the constancy is a known
    property of the model, not a wiring defect.

## Deliberately NOT in this workstream — logged, not built

- **The blend** (QB-16) and **ink-in-water** (QB-18): lab model work, deferred by ruling.
- **The vigor saturation on warm sub-Neptunes** (decision 10): a backlog row in the lab's model.
- **Animation of the slots** — none exists in the lab either; the terms are static by design.
- **Obliquity for gas bodies** (the Uranian branch): the game passes none; `resolveStormE`'s
  Uranian read is unreachable in the game today and is recorded as such (0 of 32), not wired around.
- **A per-body storm seed UI**: `GAME_STORM_SEED` is the declared law.
- **Any change to `resolveStormE`, `STORM_PHYS`, `STORM_DECK`, the chromophore ramp or the colour
  coefficients**: everything moves byte-verbatim and binds at the lab's values.
- **Polar-pack changes**: `polarDeck.js` keeps its fence (it never names `resolveStormE`); the two
  packs stay siblings with disjoint emitted sets, the collision throw guarantees it.

## Risks named up front

- **Risk #13 — a regime the lab's UAT never judged.** 59 % of the game's gas bodies are
  sub-Neptunes. The lab has a `Sub-Neptune (hazy)` preset (T_eq 550 K, vigor 1) so the regime has
  rendered there, but Max's storm UATs were on the Jovian / Saturnian / Neptunian presets. A storm
  defect on a warm sub-Neptune is the lab model's, and this line is what lets it be attributed.
- **Line-cited files.** `src/worldengine/drivers/index.js` (fifteen refs point into it by line) and
  `src/objects/Planet.js` are edited by RIDING existing lines, never inserting; the PLAN is
  line-count-neutral below line 24 (1202 lines at scoping) and gains its addendum at EOF.
- **The lab's shrink-only ratchet** (`tests/lab-surface-ratchet.test.js`) pins the set of `state`
  fields the lab writes; the mirror writes the fields that already exist (`spot*`, `train*`,
  `_stormUranian`) and adds none.
- **The A/B instrument must touch only gas materials and must not persist a sabotage arm.**
- **First sight will include QB-16.** Stated in the walk.
