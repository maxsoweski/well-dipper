# ⭐ Lab pipeline → game — THE PLAN OF RECORD

**Systems touched:** worldengine, planet-lod-lab, rendering, generation

> **This file is the plan. It is the ONE durable artifact for this program and it is updated IN
> PLACE, never stacked.** Per-session handoff briefings under `~/briefings/` are disposable, and on
> this project they have twice been *wrong* about what had already shipped. When a briefing and this
> file disagree, **this file wins; when this file and `git log` disagree, the log wins.**
>
> Strategic frame: [`planet-lod-CHARTER.md`](planet-lod-CHARTER.md). Deferred-work register and the
> full measurement tables: [`surface-variation-beyond-mvp.md`](surface-variation-beyond-mvp.md).
> The graft-vs-replace analysis this supersedes: [`lab-vs-game-renderer-divergence.md`](lab-vs-game-renderer-divergence.md) §4.1.

> ⭐⭐ **VERIFIED AND CORRECTED 2026-08-05** by a 12-agent pass (6 recon + 6 adversarial audits)
> that re-read every claim against source. **Four corrections change what you should DO**, and each
> is marked in place below:
> 1. **§LAYER 1's "BLAST RADIUS, checked" was WRONG** — an rng draw *is* conditional on
>    `atmosphere.retained` via `&&` short-circuit. Layer 1 needs a stream-safety commit first or
>    every moon of every de-atmosphered planet changes identity.
> 2. **§LAYER 3 hazard A's port instruction WOULD CAUSE A REGRESSION** — withdrawn. The game's
>    crater law already, deliberately, refuses the lab's `complexD` pin.
> 3. **§LAYER 2 item 1's *preferred* fix would break every non-lab planet** — the geometry change is
>    forbidden; use the uniform divide (and it is ~4 lines, not a re-tune).
> 4. **§LAYER 4 is PRICED** — `route()` runs headless in node; the risk is a ~1 s per-body cold
>    start, not carve cost, and the radius sweep this file prescribed was the wrong probe.
>
> It also established the fact that resequences everything: **`LabPlanetMaterial` is a debug probe
> with one hand-invoked call site, not a render path** (see §LAYER 3). No lab work reaches a player
> pixel until that changes.
>
> **RESTRUCTURED 2026-08-01.** The six-step model this file used to carry has been replaced by a
> six-LAYER model, after a multi-agent code review found 16 defects in the previous 15 commits and a
> recon found that the plan's own line numbers were 1293 lines stale. The reason for the change is in
> §"Why layers, not steps". The old step numbering is preserved in §"Step-model history" so old
> commit messages remain readable.

> ## ⭐ MVP — DEFINED (Max, verbatim, 2026-08-06)
>
> *"MVP actually means that all of the planned features in World Engine are implemented in the
> World Engine Lab and have been wired up in the main well-dipper game."*
>
> Two conditions, both required: **implemented in the Lab** AND **wired into the game**. A feature
> that renders in the lab but has no game path is NOT done. This is the gate every "are we there
> yet?" question resolves against, and the dependency the procgen snapshot below sits behind.
>
> **Standing constraint on HOW the remaining wiring is done (Max, 2026-08-06):** *"as we wire these
> features up, [make sure] it'll make future migrations of updated rendering systems from World
> Engine into well-dipper easier than they were when we just did it recently."* This reinforces
> constraint 2 below and raises it from a preference to an acceptance criterion: a wiring increment
> that lands the feature but leaves the next migration just as expensive has **not** met the bar.
> See §"Why migrations are expensive today" for the measured diagnosis.

> ⛔ **DEFERRED BEHIND THIS PROGRAM'S MVP — do not re-propose (Max's ruling, 2026-08-06).** After
> master merged into lane A (`a865753`), two master-side golden fixtures went red because lane A's
> generator legitimately produces different bodies (see `NOW.md` 2026-08-06). The obvious fix —
> capture a fresh lane-A-owned procgen snapshot — is **explicitly deferred**, verbatim: *"I would
> want to wait to take those images until I feel like we are in a good enough point where we have
> effectively merged the procgen rendering from World Engine into the Well Dipper game. And we're
> still not quite there."*
>
> The reasoning, which is the durable part: a snapshot taken mid-migration **pins a half-migrated
> state**. Every legitimate remaining step would then trip its own alarm, so the guard would spend
> its whole life reporting intended changes — churn with no protection. The snapshot is worth taking
> exactly once, when the World Engine → game merge is MVP, and not before.
>
> **Named gap Max called (2026-08-06), verified against source the same day: MOONS ARE NOT IN THE
> PIPELINE AT ALL** — not "mostly not", not at either end:
> - `src/worldengine/**` has **no moon path whatsoever** (no moon-keyed condition / driver / relief
>   writer anywhere in the tree).
> - `MoonGenerator.js` emits essentially none of the condition fields `PlanetGenerator.js` does:
>   `conditions` 0 vs 1, `habitability` 0 vs 3, `magneticField` 0 vs 8, `tidalState` 0 vs 8,
>   `surfaceHistory` 0 vs 3, `metallicity` 1 vs 11.
> - The lab-material hook excludes them **structurally**: `tryLabShader` filters
>   `owner.startsWith('body.planet.')` (`src/main.js:2422`), so a moon can never receive the lab
>   material even by hand.
>
> So moons need BOTH halves built — a driver/condition derivation path in the world engine, and
> admission to the lab render route. Treat that as a gating item for "MVP", alongside whatever else
> a scoping pass turns up. **Only once MVP is declared does the snapshot become worth taking.**

## The standing constraints (Max, verbatim — these decide every design question below)

1. **"We change the rendering capabilities of the main game however we need to such that the
   features of the world engine can render in the main game."** (2026-08-01)
   → The game bends. No "which features ship" negotiation, no parity budget. If the lab's shader
   wants a vertex attribute the game's mesh lacks, the mesh grows it.

2. **"We will likely do additional development in the world engine lab, and so we need to easily be
   able to move the latest developments from that lab into the main game in the future."**
   (2026-08-01)
   → **The load-bearing one.** It rules out copying the lab's shader into the game, because a copy
   is a snapshot and the lab keeps moving. The seam must be **shared modules that the lab itself
   imports**, so "porting" a future lab change is not an action anyone has to take.

3. **REPLACE, not graft.** *"the goal here is to have the lab's rendering pipeline in the game — the
   procgen and the rendering itself."* (2026-07-31) Grafting condition-derived values onto the
   GAME's own shader is drift. Three such slices shipped as acknowledged cheap wins; see
   §"The graft cost, now measured" for why that path is closed.

4. **Finish line: FULL GALAXY PARITY, MOONS INCLUDED.** (Max, 2026-08-01, chosen against three
   narrower options.) Moons are where the crater work was always aimed — 96.8% of generated moons
   are airless with full exposure age against 0.8% of planets, and 267 of 277 moons within 25 pc
   derive a crater record while **zero** render one.

5. **Verification is FENCE-FIRST, review at seams.** (Max, 2026-08-01.) See §"Verification cadence".

6. **"Being token efficient, drive towards the MVP outcome."** If it can be decided from the above,
   decide it — do not ask.

## Why layers, not steps

The old six-step model was a *work order*. It implied you could do step 3 before step 4. What we
actually have is a **stack**: layer 3 is not merely later than layer 2, it is **meaningless** until
layer 2 is sound. That distinction is not academic — it is the direct cause of this program's three
wrong measurements:

| the claim | why it was wrong |
|---|---|
| "the lab shader renders black" (`d8faaef`) | measured through `makeUniforms()` called bare → `uLightDir = [null,null,null]` → NaN |
| "the limb changes no pixels" (`f8a0b1e`) | measured against an animating scene; 48% motion floor vs a 50% signal |
| "the undriven floor is not black" (`fc06017`) | measured through a collapsed noise domain (see LAYER 2) and a world-space light |

Every one was read as a *rendering* question. Two were world-generation problems and one was an
environment problem. **The program is not blocked on rendering capability. It is blocked on
observability.**

> ⭐⭐ **SUPERSEDED IN PART, 2026-08-06 — read
> [`one-pipeline-two-frontends-PLAN.md`](one-pipeline-two-frontends-PLAN.md) for the buildable
> sequencing.** A 13-agent scoping workflow (5 source-verified recon passes → 3 competing designs →
> judge → 3 adversarial lenses → synthesis) **corrected the diagnosis below in one load-bearing
> way**: the lab and the game are NOT two separate routes to the world engine. Both import
> `deriveConditionVector` from the same `body-condition-vector.js`
> (`port/conditionFromPlanet.js:24`, `world-engine-lab.html:174`). There is ONE condition engine.
> What is duplicated is the two **ends** — the fp constructor upstream and the driver stage
> downstream. That changes the ordering, so the §"What cheaper next time means" prescription below
> is superseded by the new file's Steps 0-12. The measurements in this section stand.

## Why migrations are expensive today — MEASURED 2026-08-06

Max's 2026-08-06 constraint (see MVP block at top) makes "the next migration must be cheaper" an
acceptance criterion. This is the diagnosis it rests on. Every claim was checked against source.

**The root cause is not the code volume. It is that the lab and the game reach the world engine by
TWO SEPARATE ROUTES, so each migration is a hand-reconciliation of the two.** The plan's own gate —
"resolved output byte-identical" — exists *because* there are two routes. Collapse them to one and
the gate stops being necessary work.

Three findings:

1. **`src/worldengine/port/` is a declared seam that only ONE side uses.** Its own header calls it
   "the GAME-SIDE adapter into the world engine." Importers: `src/objects/Planet.js`,
   `src/generation/PlanetGenerator.js`. The lab imports from it **zero** times — it goes through the
   root-level `body-condition-vector.js` / `planet-drivers.js` cluster instead. Same engine, two
   front doors.

2. **`applyDrivers` — the function that turns conditions into uniforms — is trapped inside
   `world-engine-lab.html` (6 420 lines), and the game has NO counterpart.** The game is visibly
   working around its absence one feature at a time: see `src/objects/Planet.js:1405` and `:1623`,
   both of which say in so many words that the feature landed only because it "neither needed
   anything out of the un-extracted applyDrivers." That workaround tax is paid again by every
   feature wired from here on. Extracting it is already LAYER 3 / old-Step-1; it is the single
   highest-leverage unblock in this file.

3. **The shared/not-shared boundary is undeclared, so every migration re-derives it.** 34 loose
   `.js` files sit at the repo root beside the HTML, mixing genuinely-shared pipeline
   (`planet-lod-shaders.glsl.js`, `planet-lod-uniforms.js`, `planet-lod-lab-core.js`,
   `body-condition-vector.js`) with lab-only UI/debug (`lab-render-audit.js`, `lab-render-status.js`,
   `lab-isolation.js`, `driver-presets.js`) and unrelated cockpit-lab files. Nothing marks which is
   which. `src/rendering/LabPlanetMaterial.js` then reaches **out of `src/` and up to the repo root**
   (`../../planet-lod-shaders.glsl.js`, `../../planet-lod-uniforms.js`, `../../planet-lod-lab-core.js`).

⭐ **And the seam is PLANET-KEYED, which is exactly why moons and gas giants are not wired.**
`conditionFromPlanet(planetData)` is named and shaped for planets. `MoonGenerator` emits nearly none
of the condition fields `PlanetGenerator` does (`conditions` 0 vs 1, `habitability` 0 vs 3,
`magneticField` 0 vs 8, `tidalState` 0 vs 8, `surfaceHistory` 0 vs 3), `src/worldengine/**` has no
moon path at all, and `tryLabShader` structurally excludes moons via its `body.planet.` filter
(`src/main.js:2422`). The widening that makes migrations cheap and the widening that unblocks
LAYER 5 body-class coverage are **the same change**.

### What "cheaper next time" concretely means

**One pipeline, two front-ends** — not two pipelines reconciled by hand:

1. **Widen `port/` from planet-keyed to body-keyed** (`conditionFromPlanet` → `conditionFromBody`,
   accepting planets / moons / giants). This is not extra work ahead of the body-class wiring — it
   *is* that work, done once instead of three times.
2. **Extract `applyDrivers` into the shared pipeline and have the LAB IMPORT IT BACK.** That is
   already this file's stated rule ("every step is an *extraction* the lab imports back, never a
   copy"); it simply has not been applied to the biggest piece.
3. **Make the boundary physical and enforce it with a test.** Shared modules live under
   `src/worldengine/**`; lab-only files stay at root; **nothing under `src/` may import from the
   repo root**. That last rule is a greppable invariant (`../../` escapes out of `src/`), so it can
   be a standing test instead of a convention that rots.

**Ordering matters:** do 1 and 2 BEFORE wiring moons/gas giants. Wire them first and you wire them
into the two-route world, then pay to migrate them a second time.

## The six layers

| # | layer | owns | verified by |
|---|---|---|---|
| 0 | **Condition contract** | what a body's physical description *is*, and honest reporting of what is missing | headless, no renderer |
| 1 | **World-gen physics** | producing bodies whose conditions actually *differ* | headless, calibrated to real bodies |
| 2 | **Renderer conformance** | the game environment satisfying what the lab's shader assumes | browser, fixed inputs |
| 3 | **The driver** | condition → uniforms, through shared modules | headless fence + live probe |
| 4 | **The bakes** | per-planet CPU work producing the fields the shader samples | perf budget |
| 5 | **Body-class coverage** | rocky, giants, moons | per-class fence |

**Layers 0/1 and layer 2 are independent.** 0/1 is pure data and needs no renderer; 2 is pure
rendering and needs no real condition data. They run as parallel tracks and neither blocks the other.
Layer 3 is where they meet and is only meaningful once both are done.

### Done criteria — each is a command, not a judgement

- **0** — no field is fabricated without the vector saying so; a fence asserts every generator
  populates the fields its bodies' renderers consume.
- **1** — the population spans real physical range (airless present, thin present), calibrated
  against Earth / Venus / Mars / Titan / Mercury / Moon.
- **2** — the lab's shader on a game mesh produces the same image the lab produces for the same
  condition.
- **3** — resolved uniform set byte-identical to the lab's for the same condition, **max delta
  exactly 0** (the `albedoTransfer` / `heightNoise` precedent).
- **4** — measured cost per body inside an explicit budget.
- **5** — each body class renders through the same pipeline, with a per-class fence.

---

## LAYER 0 — the condition contract — ✅ `SHIPPED 2026-08-06` ⭐ NEW, AND IT IS UNDERNEATH EVERYTHING

> ⛔ **STATUS CORRECTED 2026-08-19. THIS ROW READ `TODO` FOR THIRTEEN DAYS AFTER IT SHIPPED, AND THE
> STALENESS COST A SESSION.** Layer 0's deliverable landed as **Step 1 of
> [`one-pipeline-two-frontends-PLAN.md`](one-pipeline-two-frontends-PLAN.md) — *"Widen the condition
> contract, additively, with provenance"* — at `0af246e` on 2026-08-06. The provenance mechanism this
> section asks for is live and documented at `src/worldengine/port/conditionFromBody.js`, fenced by
> `tests/port-condition-contract.test.js`. On 2026-08-19 a session read this `TODO`, was told by
> `planet-lod-CHARTER.md` that THIS file was the plan of record, and nearly rebuilt it.
> ⭐ **The WORK BELOW IS STILL WORTH READING — the diagnosis, the 1120-moon measurement and the
> fabrication failure mode are all still true and still cited.** It is the STATUS that was wrong.

Discovered 2026-08-01. It did not exist as a concept before the moon measurement.

`src/worldengine/port/conditionFromPlanet.js` answers every question whether or not it has the data:
`massEarth ?? 1.0`, `age ?? 4.5`, `surfaceHistory || {erosion:0, bombardmentIntensity:0,
resurfacingRate:0}`, `T_eq ?? 288`, `ironFraction ?? 0.32`. Nothing throws. So nothing upstream can
distinguish a measured world from a fabricated one.

**MEASURED, 1120 generated moons (corrected 2026-08-01 — see the correction note below):**

    plain moons   -> Moon.js, ZERO worldengine imports   1106   never reach conditionFromPlanet
    planet-class  -> Planet.js -> conditionFromPlanet       14   the only moons in the port's path
    carry a surfaceHistory / age (plain moons)               0   0.0%
    conditionFromPlanet failures                             0

⚠⚠ **CORRECTION, AND IT IS THE BEST EVIDENCE IN THIS FILE FOR WHY LAYER 0 EXISTS.** The first
version of this section claimed *"every moon in the game reports a 4000 g body"*, citing
`surfaceGravity: 4042.6` on a 0.0157 R⊕ moon. **That number was an artifact of the measuring script,
not a live bug.** The harness read the top-level object `MoonGenerator.generate()` returns, which is
not what gets rendered; it carries no `massEarth`, so `conditionFromPlanet` defaulted to 1.0 and
divided by a moon-sized radius. The real rendered population measures **0–35 g**, and only 14 bodies
reach that path at all.

⛔ **`conditionFromPlanet` answered a malformed input with a confident, plausible 4042 instead of
signalling that mass was missing — and it fooled the author of this file into writing a wrong claim
into the plan of record.** That is the fabrication failure mode doing its work on the very session
that discovered it. No consumer, human or code, can currently distinguish a measured body from an
invented one. **That is what layer 0 fixes.**

**The real defect this uncovered — ✅ FIXED, see the fix commit.** `_generatePlanetMoon` built a
planet-class moon by generating a FULL PLANET at 1 AU and then overriding `radiusEarth` with 10–25%
of the parent's radius **without touching `massEarth`** — a planet's mass inside a moon's volume.
Worst case measured: **27.6 M⊕ at 0.89 R⊕ ≈ 213 g/cc**, about 20× the density of osmium, reported as
~35 g. Fixed by scaling mass with the cube of the radius ratio, which preserves the body's density
exactly (same material, less of it) and keeps `composition.density` valid. Gravity now spans
**0–2 g**. Fence: `tests/moon-mass-radius-consistency.test.js`.

**The fix is NOT to remove the defaults** — a body genuinely missing mass still has to render. It is
to make the vector **carry its own provenance**: which fields were measured, which were defaulted.
Consumers that care (the driver, every fence, every measurement script) can then refuse or flag;
consumers that do not can carry on. That turns the failure mode from silent into loud.

**Work:**
- `conditionFromPlanet` returns provenance alongside the vector (proposed: a `_fabricated: Set<string>`
  or a parallel `provenance` object — shape is an implementation call, not a design one).
- ⭐ **Export the fp — RE-SCOPED 2026-08-05. It is not two lines, it is not six fields, and it is
  not a prerequisite today.** `deriveUniforms(drivers)` reads **SEVEN** fields the condition vector
  does not carry: `massEarth`, `surfaceHistory.*`, `habitability` (:744 **and :1046**), `seed`,
  `starMassEarth`/`orbitRadiusEarth`, **and `axialTilt` (:907)** — the seventh was missing from this
  list, so anyone implementing "export the fp + the four table fields" still leaves
  `frostLatitudeBias` dead. The fp literal at `conditionFromPlanet.js:119-137` carries **two** of the
  seven (`massEarth :121`, `surfaceHistory :135`) — not "most of them"; the other five appear
  nowhere in the file. Corrected work order, because the data does not exist yet:
  1. `habitability` — **the cheapest real win in this file.** One line; `PlanetGenerator.js:789`
     already computes `habitability: habScore`. Revives `uBioCoverage` **and** `uMachCoverage`,
     `uCityMaturity`, `uEcuCoverage` (`world-engine-lab.html:5266/5276/5283`), none of which this
     file lists.
  2. `starMassEarth` / `orbitRadiusEarth` — **not on `planetData` at all.** `starMassSolar` and
     `orbitRadiusAU` are function-locals (`PlanetGenerator.js:326`, `:372`) that are never returned.
     PlanetGenerator must widen first.
  3. `seed` — **there is no numeric seed.** `StarSystemGenerator.js:371-372` stamps `_systemSeed`
     (a **string|number** — `'sol'` for Sol) *after* `generate()` returns, and the `ExoticOverlay.js:291`
     path regenerates without re-stamping. Needs an fnv1a hash (helper exists in
     `src/util/scene-naming.js`) plus two call-site fixes.
  4. ⚠⚠ `axialTilt` — **a silent unit bug is waiting.** The lab law is `clamp01(axialTilt / 90)`
     — **degrees** — while the game stores **radians** (`SolarSystemData.js:180 axialTilt: 0.41, // 23.4°`).
     A naive passthrough gives Earth `frostLatitudeBias` **0.0046 instead of 0.26**, and the
     procedural range (±0.5–1.5 rad) reads as 0.006–0.017 instead of 0.32–0.95. This is the third
     unit disagreement on this seam (density kg/m³ vs g/cc, T_eq radiative vs surface are the other
     two) and the only one not yet flagged in source.
  ⚠ **Realistic total ~15 lines across FOUR sites**, not two lines across one. The fourth is
  `PlanetGenerator.js:726-729` — a hand-built 9-field `conditionFromPlanet({...})` literal that
  already drops `habitability` and `axialTilt` **even though both are live locals in the same
  function.** Any fp widening must widen that call site too or the game's own palette/iceness/lava
  chain keeps the old defaults.
  ⛔ **"Prerequisite for any crater / relief / glint work" is FALSE today.** `grep -rn deriveUniforms
  src/` → **zero production hits** (only tests, the lab, and three comments). `src/objects/Planet.js`
  reaches craters/optics/biosphere through the condition vector at `:1567` without ever touching
  `deriveUniforms`. Layer 0 item 2 joins the critical path only once something under `src/` calls
  `deriveUniforms` — i.e. after layer 3.
- Fill the moon contract: `massEarth` (derivable from radius × density), `age`, `surfaceHistory`.
- ⚠ **Second-order hazard, pointing the other way:** the all-zeros `surfaceHistory` default passes
  every leg of the crystal-facet gate. If anyone loosens the airless gate before this is fixed,
  **every history-less body silently becomes a crystal world.**

**Contract gaps that are cheap widenings, not research** (each de-degenerates real features):

| missing field | consequence today | cheapest probe |
|---|---|---|
| `seed` | all 7 strike/axis uniforms are global constants — **every planet rifts along identical great circles** | already known; add to fp |
| `starMassEarth` / `orbitRadiusEarth` | `tidalHeat` computed against a fake 1 M☉ / 1 AU orbit for every body | `grep -rn "orbitRadius\|semiMajor\|starMass" src/generation/PhysicsEngine.js` |
| `habitability` | zeroes `orogenyStrength`; degrades chasma/plateau/tessera/volcanism; `shieldStratoMix ≡ 0` so every world gets pure shield volcanoes | `grep -n "habitability" src/generation/PhysicsEngine.js` |
| `axialTilt` | `frostLatitudeBias ≡ 0` — polar-symmetric caps only, never Mars-style low-latitude frost | `grep -n "axialTilt\|obliquity" src/generation/PhysicsEngine.js` |

---

## LAYER 1 — world-gen physics — `TODO` — diagnosed, not fixed

Full diagnosis and the before-table are committed in **`5daf289`**, and the instrument is
`tools/port-atmosphere-measure.mjs`. Do not re-derive. Summary:

**Measured, 454 generated bodies:** 0 airless, 0 below 0.10 bar, minimum pressure 0.111 bar,
thin-remnant branch hit 0 times.

Three stacked defects in `PhysicsEngine.computeAtmosphere`:

1. **The thin-remnant branch is unreachable.** λ is linear in molecular mass and
   M_CO₂ > M_N₂ > M_H₂O against the same threshold, so `retainsH2O ⟹ retainsN2 ⟹ retainsCO2` for
   every body in the universe. `if (retainsCO2)` at `:229` is unconditionally true, so `:240-247` —
   the only path to a sub-0.1 bar atmosphere, i.e. the only path to a Mars — is dead code.
2. **The retention threshold is off by 6×, in the wrong place.** λ is exactly `(v_esc/v_th)²`. The
   textbook rule is `v_esc ≳ 6·v_th`, i.e. **λ ≳ 36**. The code tests λ > 6 — the 6 applied to λ
   instead of to the velocity ratio. Calibration:

       body      λ(CO₂)   shipped (>6)   reality
       Earth      371.0   retains        1.0 bar        ✓
       Venus      350.2   retains        92 bar         ✓
       Mars        90.6   retains        0.006 bar      retains, but THIN
       Titan       56.1   retains        1.5 bar        ✓
       Mercury     30.9   RETAINS        ~1e-14 bar     ✗ airless
       Moon        15.8   RETAINS        ~3e-15 bar     ✗ airless

   ⭐ The threshold is bracketed tighter than it looks: it must clear **Mercury at 30.9** while
   leaving **Titan's λ(N₂) ≈ 35.7** retained. That is a **31–35 window**, and it lands on the
   textbook value.
3. **Pressure has no physical model.** Each branch is a constant plus a mass term (floors 0.3 / 0.5 /
   0.1 bar). Mars retains CO₂ under *both* thresholds, so the threshold alone cannot make a thin
   atmosphere; Mars lands at 0.15 bar against a real 0.006 — **25× too thick**. Mars is thin because
   of outgassing budget and non-thermal loss after its dynamo died, neither of which is modelled.

⛔⛔ **BLAST RADIUS — THIS SECTION ASSERTED THE OPPOSITE AND IT WAS WRONG. Corrected 2026-08-05 by
a 12-agent verification pass.** `computeAtmosphere` is pure, but **an rng draw IS conditional on its
result**, through JavaScript's `&&` short-circuit. `src/generation/PlanetGenerator.js:526`:

    const hasClouds = atmoPhysics.retained && rng.chance(cloudChance[type] || 0);

When `retained` is false, `rng.chance(...)` **never evaluates and no number is consumed**. Two
further draws sit inside the dependent block (`:533` `density: rng.range(0.3, 0.7)`, `:534`
`scale: rng.range(2.0, 4.0)`). Today `retained` is true for 100% of bodies so the draw always fires
— **which is exactly why this was never caught.** Make any body airless and its `planetRng`
desynchronises from that point on. `SeededRandom.child()` also consumes a draw, so
`StarSystemGenerator.js:386`'s `planetRng.child(\`moon-${m}\`)` reseeds: **every moon of every
de-atmosphered planet becomes a different body, and every saved seed changes meaning.**

⭐ **THEREFORE LAYER 1 NEEDS A STREAM-SAFETY COMMIT FIRST.** Hoist the `:526` draw out of the
short-circuit (`const cloudRoll = rng.chance(cloudChance[type] || 0); const hasClouds =
atmoPhysics.retained && cloudRoll;`) and hoist `:533-534` the same way, pinned by a seed-stability
fence, **before** the threshold change lands. The standing "one extra draw rewrites the generated
universe" rule **does** bite here.

⚠ **And it is one constant away from firing on its own.** No body is airless today because of
*orbital placement* (`StarSystemGenerator.js:264`'s innermost-orbit constant), not because of the
retention law. Moving that constant trips the same desync with no atmosphere work at all.

### What layer 1 unblocks — the degenerate register

Every one of these is a **correct model on a wrong population**. Driving them today looks like a
wiring bug and is not. Do not chase them as rendering defects.

- **`airlessnessOf ≡ 0` on every body** (`P_AIR_REF = 0.1 bar`, population min 0.310). The
  space-weathering stage of `surfaceAlbedoOf` is identically 0 across the entire population — no
  world will ever show lunar darkening.
- **`uFacetStrength ≡ 0`** — gated on `!cond.atmosphere`, and `conditionFromPlanet:102` only nulls
  the atmosphere when `retained === false`, which never happens. Crystal worlds never render.
- **`uRayBrightness ≡ 0`** — `(hasAtmo ? 0 : 1)`, and `hasAtmo` is true on 100% of bodies. Crater
  ray systems never render. Re-gate on *pressure* if you want them back.
- **`uTermStrength` constant** — its only condition input is `atmosphere.retained`, which carries
  zero information. (Now `0.15` after `fd2fdd4`; was `1.0`.)
- **`uLimbStrength ∈ {0.7, 0.91}` only** — the airless-silhouette branch is dead.
- **`uAirglowIntensity` never reaches 0** — at 0.310 bar the expression gives 0.298, so every planet
  has a night-limb glow with no off state.
- **`erosionOf` never returns 0** (`P_ER_REF = 0.5 bar`) — the sharp un-eroded crust branch is
  unreachable.
- **`state.habGate ≡ 0` → `uBioCoverage ≡ 0`** — no bioluminescent mats on any world (independent of
  `uBioGroundCover`, which is genuinely condition-derived and works).

---

## LAYER 2 — renderer conformance — ✅ `DONE, VERIFIED LIVE 2026-08-06`

> **All five items shipped and measured in the running game**, on a generated system (seed 12345),
> not asserted from a test. `ef6e416` radius divide, `734b424` log depth, `ee34ce7` per-frame seam
> (light space + clock + octaves), `98f1d75` view vector. Plus `d18cbcf`, a defect the live check
> found — see below.
>
> **Measured, body at 6 radii:** shader compiles (29.8 s cold / 46.6 ms warm, zero shader errors);
> `bodyRadius 0.048749` == `geometryRadius`, not 1.0; object light `[-0.7259, -0.1613, 0.6686]`,
> which is the world light `[-0.7436, 0, 0.6686]` through the inverse of the body's `rotZ -0.21869`
> tilt; `uTime` +1.004 s per second; `uOctaves` 4 → 9 and `uLodRamp` 0 → 1 on approach;
> `uCameraPosObj` tracking 2789 → 13.3 body radii. 240 fps, console clean.
>
> ⭐ **TWO METHOD NOTES WORTH MORE THAN THE FIXES.**
> 1. **`octaves: 4` at spawn is indistinguishable from a dead seam** — at 14,015 body radii it is
>    also the *correct* answer. Proven live by writing a sentinel (7.77) into the uniform and
>    watching the seam overwrite it within a second. Reach for a sentinel whenever the correct value
>    and the broken value coincide.
> 2. ⛔ **THIS FILE'S STANDING NOTE THAT "THE LOD RAMP CANNOT BE EXERCISED BY FLYING" IS TRUE ONLY
>    OF SOL**, where bodies sit 10⁵–10⁷ radii out. In a generated system, `selectBody` +
>    `commitBurnNow` puts you inside 6 radii in about four seconds and the ramp runs. Do not skip
>    the live check on the strength of that note again.
>
> **Probe:** `window._lab.labShaderReport()` returns all of the above as numbers, leading with an
> rAF frame-rate check — a backgrounded window throttles to ~1 Hz while `document.hidden` still
> reports false, and every per-frame verdict then reads as "not wired" for the wrong reason.
>
> ⛔ **AND THE LIVE CHECK FOUND A DEFECT NO TEST COULD HAVE** (`d18cbcf`). The shader declares six
> bake samplers; **five are absent from `makeUniforms` entirely** — the lab creates them at route
> time alongside the bakes that fill them, and the game never runs that route. Five samplers of two
> types therefore shared GL's default unit 0:
> `GL_INVALID_OPERATION: Two textures of different types use the same sampler location` ×256, then
> **"no more errors will be reported for this context."** That second line is the damage: a silenced
> console is indistinguishable from a clean one, so the compile errors this layer depends on seeing
> would have been invisible. Fixed by binding a typed 1×1 black texel to every declared sampler,
> creating the slot when absent. ⚠ The first attempt only filled *null* slots and changed nothing —
> filling a null and creating a missing key are different operations, and only the browser caught it.

> **2026-08-05/06.** Items 1, 2, 3 and 4 are shipped with fences: `ef6e416` (radius divide),
> `734b424` (log depth), `ee34ce7` (per-frame seam — light space, clock, octaves). Item 5 (view
> vector) is the only one left, and it carries the one decision named at the end of its entry.
>
> ⚠⚠ **ALL FOUR ARE HEADLESS-VERIFIED ONLY.** Vitest cannot compile GLSL. What is proven: the
> chunks and expressions are present, correctly placed and byte-identical to the lab's law; three's
> include resolution produces no symbol collision (checked by resolving `<common>` +
> `logdepthbuf_*` against the lab text in node — no duplicate declarations, no clash with three's
> ShaderMaterial prefix, `isPerspectiveMatrix` present for the vertex chunk, `<common>` correctly
> kept OUT of the fragment where HEIGHT_GLSL lives). What is **not** proven: that the shader still
> compiles on a GPU, and what it looks like. Per this file's own trap list, **a black frame is
> indistinguishable from a clean negative control** — so the live check must assert a lit-pixel
> floor before believing any reading.
>
> **The live check, in order:**
> 1. `npm run dev` in a WSL terminal, open the printed localhost URL.
> 2. `window._lab.spawnProceduralSystem(seed)` — ⛔ **NOT Sol** (see the section at the bottom).
> 3. `await window._lab.tryLabShader(0)` → must return `ok: true`, and the new `bodyRadius` field
>    must be the body's scene radius (~0.013–0.68), **not** 1.0. A 1.0 there means the divisor never
>    reached the material and item 1 is inert.
> 4. Read back `material.uniforms.uOctaves.value` while approaching — it must leave 4.0 and climb
>    toward 9.0 inside 20 body radii. Constant 4.0 means the `setReliefDetail` seam is not firing.
> 5. Read `uTime.value` across two frames — it must increase.
> 6. Sort check (item 4's actual payoff): put a ring or moon in front of the disc and confirm it
>    occludes correctly rather than by traversal order.

Found by the 2026-08-01 review. **Every measurement taken through `tryLabShader` before these land
is in the same epistemic class as a Sol measurement — confidently wrong.**

All **five** fixes below (the header used to say "four" and then list five) belong in the **SHARED
module**, not patched game-side: in the lab the divides reduce
to 1.0 and the logdepth chunks compile to nothing without the define, so the lab stays unchanged and
constraint 2 is preserved. **Patching them game-side would create exactly the snapshot copy the
program exists to avoid.**

1. ⭐ **OBJECT-SPACE RADIUS COLLAPSE — the big one.** `world-engine-lab.html:202` is `const R = 1.0`
   and `planet-lod-shaders.glsl.js:41` is `vPos = position;` with no normalisation, feeding
   absolute-scale domains (`voronoi3d(vPos * uVoroScale)`, `fbmd(vPos, …)`, ~30 `*Combiner(vPos, …)`
   calls). The game builds `IcosahedronGeometry(radiusEarth × 0.0426)`. An Earth-sized body spans
   ±0.0426 where the lab spans ±1.0 — **the whole disc samples 1/23rd of one voronoi cell.**
   ⚠ **Quantification corrected 2026-08-05** (and `*Combiner(vPos` is **23** call sites, not ~30):
   the collapse runs **78.2× at 0.3 R⊕ (smallest rocky) down to 1.47× at 16 R⊕ (hot Jupiter)**, i.e.
   23.5× at Earth size. The old line said "23× on a big planet", which is backwards — **big planets
   barely collapse at all.** The 53× is the **max/min ratio** across the generated range, not a
   big-vs-Earth ratio.
   ⭐ **This is a fully sufficient alternative explanation for the "flat orange"** that `fc06017`
   read as the undriven floor — **but it is now one of THREE sufficient causes**, alongside the
   undriven palette and `uOctaves` (see item 3). **Fix them one at a time or the attribution stays
   unresolved.**
   ⛔ **FIX ORDERING CORRECTED 2026-08-05 — the option this file used to recommend FIRST is the
   dangerous one.** `IcosahedronGeometry(1, 5)` + `scale.setScalar(radius)` **must not be used.**
   `tryLabShader` (`src/main.js:1800-1844`) swaps only the MATERIAL on the game's existing mesh, so
   the geometry stays shared with the game's own planet shader — which reads absolute object-space
   position against a radius uniform (`Planet.js:436`
   `float polarDark = smoothstep(0.6, 1.0, abs(vPosition.y) / planetRadius);`, plus `:721`, `:856`,
   `:1611` `noiseScale`, `:1682` `planetRadius`). Unit-radius geometry silently changes **every
   non-lab planet in the game.**
   ✅ **THE FIX IS THE UNIFORM DIVIDE:** `vPos = position / uBodyRadius`, with `uBodyRadius = 1.0`
   in the lab (identity, so the lab is untouched) and the mesh radius written game-side.
   ⭐ **And it is ~4 lines, for a reason this file never stated:** the lab vertex shader does **not**
   displace geometry — `planet-lod-shaders.glsl.js:45` is
   `gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);` on the RAW position, so
   all relief is fragment-side normal perturbation. Normalising `vPos` **cannot** change the
   silhouette and **cannot** require re-tuning any relief amplitude.
   ⛔ **A per-body `uDispDomainScale` is not even a candidate** — stronger than this file used to
   say. It is **RETIRED dead code with no writer anywhere**, pinned at 1.0 forever
   (`world-engine-lab.html:4901-4904` "Slice C RETIRED … deliberately NO WRITE"; initializer
   `planet-lod-uniforms.js:17`) and held there by a fence
   (`tests/vis-scale-fence.test.js:232`). Repurposing it fights a test as well as the three
   exclusions at `planet-lod-height.glsl.js:970/:2393/:2427`.
2. **Light in the wrong space, and frozen.** `main.js` feeds the game's **world-space** `lightDir`
   into a uniform documented as *"object-space substellar direction"*. The surface spins and the
   parent carries axial tilt, so the terminator counter-rotates with the crust — one sweep per
   planet day. The lab does the transform the game omits (`world-engine-lab.html:4896`:
   `invQuat.copy(planet.quaternion).invert()`; `:4897` is the `applyQuaternion` that consumes it).
   Separately `LabPlanetMaterial.js:68` copies the
   vector by value, breaking the by-reference link the game material relies on, so it is also stale.
   ✅ The shader needs **no** change here — `uLightDir` already *means* object-space; only the writer
   is wrong. And the lab keeps its own writer, so the lab is untouched.
3. **No per-frame seam at all.** `uTime` is never advanced (the game's only planet clock writer
   guards on a differently-named uniform), so cloud drift, superrotation, magma churn and aurora
   curtains evaluate at t=0 forever. `uOctaves`/`uLodRamp` likewise. **Fix as ONE seam** —
   `updateLabPlanetMaterial(material, {mesh, lightDirWorld, renderDt, octaves, lodRamp})` — not four
   patches. ⚠ This whole per-frame half of `applyDrivers` appears in **none** of the old six steps.
   ⭐⭐ **`uOctaves` IS NOT MERELY "UNANIMATED" — added 2026-08-05.** It defaults to **4.0**
   (`planet-lod-uniforms.js:18`) against a documented max of 9 (`fieldSampler.js:85`: *"it is
   mix(4, 9, lodRamp)"*). **Every in-game lab-shader planet renders at the LOWEST detail rung,
   permanently, at any distance.** That is a third fully independent sufficient explanation for the
   flat-orange read, and it is nearly free to fix.
4. **No log-depth chunks.** `RetroRenderer` runs `logarithmicDepthBuffer: true` with `near = 1e-9`;
   `grep -c logdepthbuf planet-lod-shaders.glsl.js` → **0**. Every fragment writes `z ≈ 1.0`, so the
   disc draws (LessEqualDepth passes) while sorting against rings, moons and the ship by traversal
   order. **In-repo precedent: `tests/warp-portal-logdepth.test.js` exists because this project
   already shipped this exact bug once.**
5. **The view vector is scene-origin.** `planet-lod-shaders.glsl.js:447` (`:446` is the comment
   stating the assumption) assumes the planet sits at
   the origin with identity quaternion. In the game `|vPos| ≤ 0.68` while `cameraPosition` runs to
   the 100-unit rebase threshold, so `V` collapses to a constant direction. The rim glow slides
   across the disc as you orbit. The game's own shader does this correctly (`Planet.js` `vWorldPos`
   + `vViewDir`), so it is a real divergence, not a shared convention.
   ⚠ **THE "THE LAB STAYS UNCHANGED" GUARANTEE DOES NOT COVER THIS ONE (2026-08-05).** It holds for
   items 1–3. Item 5 is different: **the lab carries the same origin-assumption latently**, masked
   only because `spinSpeed` defaults to 0 (`world-engine-lab.html:906`) and its planet is never
   translated. Turn the lab's spin slider on (`:4830`, `:1551`) and the lab's own rim glow is already
   wrong. Fixing item 5 properly either changes the lab's spin-enabled look or requires deliberately
   preserving the bug behind a flag — **decide which before writing it, and byte-gate accordingly.**

---

## LAYER 3 — the driver — ⚙️ `IN PROGRESS — and further along than this file knows`

> ⛔ **STATUS CORRECTED 2026-08-19.** The driver stage is no longer trapped in the lab's HTML: the
> shared pack pipeline ships at `src/worldengine/drivers/` (`index.js` + `giantDeck`, `limbDeck`,
> `polarDeck`) with the contract at `src/worldengine/port/writePackUniforms.js`, all landed via the
> successor plan's Steps 5-7. Read that file's step statuses, not this heading.

⭐ **THE PLAN'S OLD LINE NUMBERS WERE 1293 LINES STALE** (they predated Step 2's own −1299-line
extraction). Corrected and verified 2026-08-01:

    world-engine-lab.html            6411 lines   (NOT 7554)
    applyDrivers()                 1933-2734
    ensureNetworkRouted()          2745-2904    (corrected 2026-08-05 — NOT 2745-2880; the 24
                                                 omitted lines 2882-2903 are where its six direct
                                                 uniform writes live)
    per-frame uniform writer       4899-5492    ← half of every uniform's value. See hazard F.

⛔ **PATH DRIFT — every grep this file hands a fresh session against these will silently return
nothing** (this is how the 2026-08-05 recon started): `world-engine-lab.html`,
`planet-lod-shaders.glsl.js`, `planet-lod-height.glsl.js`, `planet-lod-rivers.js`,
`planet-lod-lab-core.js` and `planet-lod-uniforms.js` are all at the **REPO ROOT**, not under
`src/worldengine/shaders/` (which holds only `craterRelief.glsl.js` and `heightNoise.glsl.js`).
`LabPlanetMaterial.js` is at `src/rendering/`. ⚠ Also: `.claude/worktrees/` holds **8 stale copies**
of `world-engine-lab.html`, so a repo-wide grep returns 9 hits — **edit the wrong one and you get a
silent no-op.**

⭐⭐ **THE BIG VISUAL UNIFORMS ARE NOT IN `applyDrivers`** — but the sentence that used to follow
was wrong and contradicted this file's own hazard F. **Corrected 2026-08-05.**
`ensureNetworkRouted` (`2745-2904`, not `2745-2880`) writes **`state.*`, not uniforms** — its only
six direct uniform writes are texture pointers (`uRiverCarveMap :2885`, `uTectonicGrainCube :2890`,
`uReliefBakeCube :2894`, `uProvinceCube :2895`, `uCraterBakeCube :2897`, `uRiverCarveGateHi :2898`).
**The uniforms are written by the per-frame writer inside `frame()` (`4899-5492`)**, which applies
`state.<feature>Enabled`, `state.featureRelevant.<key>`, `state.craterRelevance` and the `sVis`
visual-scale factor on the way. That is hazard F, and it is the truth. **Any extraction must carry
BOTH halves — derivation without gating renders the wrong thing, gating without derivation renders
nothing.** The good news survives: the derivations read `_bodyDrivers.condition`, the same object
shape `conditionFromPlanet` returns, so there is still zero adapter.

⛔⛔ **AND THE DESTINATION IS NOT A RENDER PATH YET — THE SINGLE MOST IMPORTANT FACT IN THIS FILE.**
`src/rendering/LabPlanetMaterial.js` is instantiated at **exactly one site**: `src/main.js:1824`,
inside `async tryLabShader`, a hand-invoked debug material swap that walks the scene looking for
`o?.material?.uniforms?.noiseScale`. **Nothing in the normal render path builds it.** Production
bodies render `Planet.js`'s own `GAS_BODY`/`ROCKY_BODY` (`src/objects/Planet.js:1460-1461`).
Consequences, all of which resequence this program:
- **Every "the game is flat orange / bone dry / renders black" reading in this file's history was
  taken through that probe**, i.e. through an object the player never sees — the same error class
  §LAYER 0 catalogues.
- **No lab improvement — GLSL or driver — reaches a single player pixel today.** The shared shader
  TEXT edge is real (`LabPlanetMaterial.js:2` → `planet-lod-shaders.glsl.js`) but its only consumer
  is the probe. "Lab GLSL work is doubly valuable because the module is shared" is **false** until a
  production material swap exists.
- ⭐ **So the real deliverable of this program is not a uniform count. It is: make the lab material a
  production render path.** That single milestone is what converts all future lab work into game
  work for free, which is standing constraint 2's actual mechanism.

### Slice 1 worklist — the next 10 uniforms, ranked by visual payoff per unit of work

Let `cond = conditionFromPlanet(p)`. Full catalogue: 77 uniform writes, recon 2026-08-01.

1. ⭐ **`uWeatheredColor` + `uFreshColor` + `uSedColor` + `uCratonColor` + `uBioGroundColor`** — THE
   flat-orange fix, **one module call for five uniforms, no shader change**. All four factory-default
   to the *identical* `THREE.Color(0.46, 0.40, 0.34)`, and `uTerrainAlbedoMix` already defaults 1.0,
   so the palette path is live and simply has four copies of one brown to blend.
   `applyAlbedoTransfer(surfacePaletteOf(cond), {extra:{pigment:BIO_PIGMENT}})`.
   ⚠ **`applyAlbedoTransfer` is REQUIRED** — raw `surfacePaletteOf` emits true physical albedos
   (Earthlike land 0.165) and renders Earthlike worlds nearly black. ONE scale solved from
   `weathered` and applied to every endmember; per-endmember scaling is a documented regression.
2. **`uIcenessMix`** — `icenessOf(cond)` (`surfaceMaterial.js:52`). Icy worlds go white. Default 0.
3. **`uPerturb`** — `0.55 × reliefEnvelope(cond.radiusEarth, cond.surfaceGravity)` (`lab-core:1167`).
   Master relief amplitude. The `0.55` is a hand knob; only the envelope is physical. ⚠ Applying the
   envelope twice squares it.
4. **`uCraterDensity` + `uCraterScale` + `uCraterAmp` + `uCraterComplexD` + `uCraterRelaxation`** —
   `craterSchedule(cond)` + `craterRelevanceOf(cond)`, analytic, **no bake**. Port the route-time
   block at `:2803-2856`, **not** the `applyDrivers` lines — see ordering hazard A.
5. **`uSeaLevel` + `uLiquidMask`** — ocean or no ocean, the biggest silhouette change after the
   palette. Prefer `bodyLiquidStability(cond)` (`baseStep.js:51-66`) over the fp path. Default
   `uSeaLevel = -1.0` means **every game planet is currently bone dry**.
6. **`uBioGroundCover`** — `biosphereOf(cond)`. ✅ *Shipped `9a17098`, including the display transfer
   and the rename off the lab's `uBioColor` collision.*
7. **Frost caps** — `uFrostMaxCoverage`, `uFrostCondensationT`, `uFrostAlbedo`, `uFrostLocked`,
   `uPlanetTempEq` from `deriveUniforms(fp)`. ⚠ needs the fp export (layer 0) and `axialTilt`.
8. **`uLimbColor` + `uTermColor` + `uLimbExponent`** — ✅ *limb shipped `f8a0b1e`, terminator
   `fd2fdd4`.* ⭐ Still open: the lab **overrides the module it imports** at `:2452`, branching
   `_thickHaze ? 1.8 : 3.5` and discarding the module's continuous `limbExponent`. The game takes
   the module's value; reconciling the lab changes the lab's look and must be byte-gated.
9. **`uLiquidSpecies` + `uGlintExp` + `uGlintTint` + `uSpecStrength`** — water-blue vs Titan-amber
   seas. Only pays off after (5). ⚠ three ordered writes to `uSpecStrength`.
10. **`uEmissive`** — `clamp01((T_eq-400)/600) × 0.25`, **plus three zeroing gates** (hot-Jupiter,
    magma, carbon). Porting fewer than four writes glows the wrong bodies.

⛔ **Do NOT wire `uLiquidStability`** — the uniform exists in the factory but **no shader reads it**
(0 consumers across every `.glsl.js`).

### Ordering hazards — a naive extraction that reorders these produces plausible-but-wrong output

- **A. ⭐ The crater uniforms are written TWICE — IN THE LAB.** `applyDrivers:2024-2027` sets them
  from `deriveUniforms` (the *retired* preset-age law); `ensureNetworkRouted:2828-2856`
  **overwrites** them from `craterSchedule(cond)`. The route-time values ship in the lab. They
  disagree **by design**: the route block forces `craterComplexD = 2×0.55/0.6 = 1.8333` specifically
  so `morphology ≡ 0` for the analytic sub-floor band.
  ⛔⛔ **THIS SECTION USED TO SAY "port the route-time block at :2803-2856, not the applyDrivers
  lines." THAT INSTRUCTION WOULD CAUSE A REGRESSION AND IS WITHDRAWN (2026-08-05).** The game
  already has a crater law and it deliberately refuses the lab's pin —
  `src/worldengine/port/craterUniforms.js:152` `const complexD = transitionDiameterKm(g) / Dchar;`,
  under a header that states why: *"⛔ NOT the lab's value: the lab pins this high to force
  morphology == 0, because every crater it draws is a sub-floor simple bowl. The game's craters are
  ~0.1 R across — complex craters — and their central peaks and wall terraces are most of what makes
  a big crater read as a crater rather than a dent."* Porting the lab's 1.8333 **flattens every
  complex crater in the game to a bowl.** Hazard A is a lab-internal ordering fact only; the game's
  crater uniforms are already correct and must be left alone.
- **B. `uEmissive` — four writes over 705 lines** (:2001 base, then zeroed at :2432 `_hotJup`,
  :2687 `_magmaClass`, :2706 `_carbonClass`).
- **C. `uSpecStrength` — three writes, order-critical.** Zeroing must precede the scale; lifting
  either gate alone yields `undefined`.
- **D. `_atmoOptics` is one local consumed by two writes 30 lines apart** (:2456, :2485).
- **E. `uAuroraIntensity` — derive then clobber.** :2587 derives, :2611 unconditionally zeroes it for
  `_cloudRegime === 3` (Venus).
- **F. ⭐ Half of every uniform's value lives in the per-frame writer** (`:4940-5430`), not in
  `applyDrivers` — it applies `state.<feature>Enabled`, `state.featureRelevant.<key>`,
  `state.craterRelevance` and the `sVis` visual-scale factor on the way. **Extracting one half gives
  derivation without gating, or gating without source.**
- **G. `applyDrivers` is re-entrant from the GUI** — `outflowSizeKm`, `karstDolineSizeKm`,
  `duneSizeKm`, `bandLatPow` and three storm-reseed buttons call it from `onChange`. Those fields are
  **inputs**, not outputs; any extraction must take them as parameters.
- **H. Drop entirely:** the 🎲 handlers (they clobber seeded axes with `Math.random()`),
  `drawPresetConditions` (the lab's stand-in for `conditionFromPlanet`), `drawPresetRadius`,
  `relevantFeatureSet()`, and the tail plumbing `resetDriverOverrides`/`syncDisplays`.

### The knob list — the game must hardcode these, and a naive extraction will call them condition-derived

⚠ These are emitted **by `deriveUniforms` as bare literals**, so they arrive in the same `u.*` bundle
as the real derives: **`uTerraceCount` 4, `uChaosMatrixRough` 0.5, `uDoubleRidgeFreq` 3.0,
`uCryoRidgeOffset` 0.45, `uCryoRidgeWidth` 0.18, `uGroovedBandFreq` 14.0.** Plus `state.perturb`
0.55, `uVoroCells` 27 (a device-perf tier, not physics), `uRiverCarvePatchStrength` 0.0,
`glintRoughness` 0.15, `uTerrainAlbedoMix` 1.0, `uProvinceWeight` 1.0, `limbStrength ×1.3`,
`nightTempK` 1100 K, `MG_LIQUIDUS` 1300 K, and the authored relief heights (crater depth 2.0 km,
mountain 9.0, edifice 22.0, canyon 6.0).

`TERM_STRENGTH` 0.15 and the `termWidthFor` log-pressure ramp are **no longer provisional** — both
were ported from the lab and fenced at max delta 0 in `fd2fdd4`.

---

## LAYER 4 — the bakes — `TODO` ✅ **PRICED 2026-08-05 — IT IS NO LONGER THE UNPRICED RISK**

⭐ **THE PROBE THIS FILE BUDGETED AT "A DAY" TOOK UNDER AN HOUR, HEADLESS, IN NODE.** `route()` is a
plain ES module function (`planet-lod-rivers.js:602`, inside `createRiverOverlay` at `:535`). It
touches no DOM and no canvas; its only GPU coupling is `renderer.render` / `readRenderTargetPixels`,
both stubbable. ⛔ **`tests/ws4-grain-bake-host.test.js:19` states as fact that "route() cannot run
headless." That is false and is probably where the "a day" budget came from — fix it in place.**

**MEASURED (node, CPU-only stub, `uReliefBakeStrength` pinned 1.0):**

    steady-state route()      105-190 ms   (R=1 spans 103-173 ms over 6 runs — noisy; do not quote decimals)
    FIRST route()             1.0-1.3 s    ← the real finding
    of which buildIrregularSphere(40000, 4)   0.6-0.8 s
    largest single phase      routeAndOrder ~30 ms      ribbon+valley ~44 ms combined (37%)
    bakeGrainCube (CPU)       ~6 ms  (~5%)  — already inside route()

⭐⭐ **THE ARCHITECTURAL RISK IS NOT THE CARVE COST — IT IS COLD START, AND IT IS PER INSTANCE.**
The 0.6–0.8 s mesh build is a spherical Delaunay (three's `ConvexHull`) + 4 Lloyd relaxation
iterations on a **fixed global 40,000-node sphere** (`DEFAULT_PARAMS.TARGET_N: 40000`), paid once per
`createRiverOverlay` **instance**. The lab has one planet, pays it once, and never notices. **A game
with many bodies pays ~1 s on each body's first visit unless the 40k mesh is built once and shared
across overlays.** That is the layer-4 architecture decision, and this file never raised it.

⚠ **`route()` cost is FLAT in radius** (111–138 ms over a 30× radius span) because the mesh is
global; `radiusEarth` feeds only the ribbon/valley WIDTH law. **The radius sweep this file
prescribed was the wrong probe.** The real radius dependence is a **BRANCH**:
`planet-lod-rivers.js:681` `const bakedOn` gates the router's height source on `uReliefBakeStrength > 0`, and the
lab rewrites that uniform every frame as `grainCarveUI.reliefBakeStrength * bakeReliefCrossover(sVis)`
(`world-engine-lab.html:4941`) with `sVis = radiusEarth^0.5` — **exactly 0 for radiusEarth ≤ 0.25 or
≥ 4.0.** On that branch `route()` calls `sampler.read()`: a 200×200 RGBA-float RTT running the full
9-octave height shader, then a 640 KB `readRenderTargetPixels` — **the one synchronous GPU stall in
the whole function.** The game has no `bakeReliefCrossover`, so **the port must decide which branch
it takes before porting the router.**

⛔ **TWO HONEST LIMITS ON THESE NUMBERS.** (1) Only the `bakedOn = true` path was priced — the
stub lacks `renderer.clear()` (needed at `:588`), so the strength-0 fallback above is **still
unpriced**. (2) These are isolated node-CPU figures with GPU cost zero by construction; treat them
as a **floor**, not as a transferable frame cost. Browser shader compilation for the five
`WebGLCubeRenderTarget`s built in `ensureMesh()` is not in them.

**THE BAKE WALL RUNS THROUGH THE MIDDLE OF ONE FUNCTION**, which is why it is easy to miss
(endpoints corrected 2026-08-05):

    ensureNetworkRouted()  :2745-2859   FREE   pure CPU condition scalars (iceness, biosphere,
                                               surfacePalette, the whole craterSchedule block).
                                               MEASURED at 0.042 ms per call — it really is free.
                           :2860        WALL   riverOverlay.route() — router graph + RGB carve cube

Four bakes, in payoff order: (1) river router + carve cube → rivers, coastlines, deltas,
strandlines; (2) the WS4 tectonic-grain cube → `sampleGrainStrike`, the only non-constant source for
**every** strike uniform; (3) the province partition behind `uProvinceWeight`; (4) the four vertex
attributes `aBand`/`aShear`/`aMush`/`aStorm` (gas giants only, correctly zero-filled today by
`LabPlanetMaterial.js:43`).

⭐ **Correction worth keeping:** the axis family is **seed-dependent, not bake-dependent**.
`deriveUniforms` computes it from `d.seed`, nothing supplies one, so `seed === 0` and every planet
rifts along identical great circles. **Adding `seed` to the fp de-constants seven uniforms with no
bake at all**, and should precede any grain-cube work.

✅ **Approach A's probe is DONE (2026-08-05) — see the measurements above. Streaming does NOT have to
be designed in for the carve cost; the ~1 s per-body cold start is the thing that does.** Bakes 2
(grain, ~6 ms) and 3 (province) are **already called from inside `route()`** (`:1553`, `:1558`), so
they are not separable work items — they ride along for ~11% of the router's cost. **Bake 4 (the
four gas-giant vertex attributes, ~14 ms over 66,049 synthetic positions) is the only one of the
four that needs neither the 40k mesh nor a router graph nor a cube** — a flat closed-form per-vertex
loop that can be ported independently, first, at any time.

---

## LAYER 5 — body-class coverage — ⚙️ `PARTIAL — gas giants SHIPPED and UAT-PASSED`

> ⛔ **STATUS CORRECTED 2026-08-19.** Gas giants render through the pipeline and **Max UAT-passed
> them on 2026-08-11** (successor plan Step 6). Moons are the remaining class and are the successor's
> Step 10. "Gated behind layer 0" is no longer true — layer 0 shipped.

`src/objects/Moon.js` is a **third renderer with none of the port** — no palette, no relief, no
craters, still the March-2026 `snoise` shader.

⚠ **Moons are not the easy first slice they look like**, but not for the reason first recorded here.
**1106 of 1120 generated moons render through `Moon.js`, which has ZERO worldengine imports** — so
for them the condition contract does not need fixing, it needs *building from nothing*: they carry no
age, no surface history, no composition, no mass. The other 14 are planet-class moons that already go
through `Planet.js`; their mass/radius inconsistency is fixed, and they are the natural first target
because the plumbing already exists.

Their advantage is real though: **100% are airless**, so they are the one population where
`airlessnessOf`, crater rays, space weathering and crystal facets can vary *today*, without waiting
on layer 1. Rocky planets are the inverse — real contract, degenerate population.

---

## Verification cadence — FENCE-FIRST, REVIEW AT SEAMS (Max, 2026-08-01)

Chosen because of the 7 must-fix defects the 2026-08-01 review found, **a fence would have caught
the two worst** — cheaply, permanently, and at write time.

**PER LAW (near-free, runs forever).** Write the fence *before* the port lands. Three assertions:
1. **Byte-identity** — extract BOTH the lab's expression and the game's *from source* and compare
   numerically over a sweep. **Max delta exactly 0.** (`tests/port-terminator-law.test.js` is the
   worked example: it pulls `state.termWidth` out of `world-engine-lab.html` and `termWidthFor` out of
   `Planet.js` and evaluates them against each other.)
2. ⭐ **Distinctness** — is the value constant across the population? *This program's characteristic
   failure mode is a correctly-wired law that is degenerate.* `uTermStrength` measured `[1,1]` on
   36 bodies and was reported as shipped.
3. **GLSL text** — if the law lives in a shader, assert the shader text. A JS-side measurement
   cannot see a GLSL shape bug. The terminator flood is the proof: "36 of 36 bodies tinted, 16
   distinct hues" was **entirely true** and entirely compatible with the shader flooding the whole
   night hemisphere.

**PER SLICE (cheap).** Live probe through `window._lab` on a **generated** system. Report numbers,
not screenshots. ⚠ **Check rAF fps first** — a throttled window reports `hidden:false` and lies.

**PER SUBSYSTEM (expensive, ~1 per layer).** Multi-agent review with adversarial refutation. Roughly
1.8 M tokens; budget it deliberately.

⛔ **Keep the broken form as an instrument.** A pass with no failing control is worthless — the
terminator fence retains the clamped profile as a live test showing every `mu ≤ 0` collapses to 1.0.

---

## The graft cost, now measured

Three slices shipped condition-derived values onto the game's OWN shader (limb `f8a0b1e`, biosphere +
terminator `66cc231`). They were taken as cheap wins off a module-gap audit and explicitly were not
the target. **Two of the three shipped with real defects, and both defects exist *because* the graft
re-implements a law whose correct version was sitting unused in a module the game already imports:**

- the terminator used clamped `diffuse` where the lab uses signed `mu`, at 6.7× the strength the lab
  had already reduced after Max reported that exact artifact (`fd2fdd4`);
- the biosphere pushed raw `BIO_PIGMENT` where the lab's own uniform comment specifies the display
  transfer, rendering the canopy 2.5× too dark (`9a17098`).

The graft also collided with the lab's namespace: the game's `uBioColor` was a daylight canopy
albedo, the lab's `uBioColor` is F46 bioluminescent emissive. **The graft path is closed.** Further
condition-derived work goes through layers 0–3.

## Architecture verdict (2026-08-01 review)

**Constraint 2 holds for exactly one artifact — the shader TEXT — and nothing else.** That one is
real and verified: the lab imports `LAB_VERTEX_SHADER`/`LAB_FRAGMENT_SHADER` back from
`planet-lod-shaders.glsl.js`, so a lab GLSL edit reaches the game with zero port action.

Remaining human port actions, exhaustively:
1. `LAB_ATTRIBUTES` (`LabPlanetMaterial.js:32`) hand-lists the four attribute names — a fifth baked
   attribute in layer 4 needs a game-side edit, with no test and no runtime signal;
2. `LAB_WORLD_LIGHT` (`:35`) hand-copies `world-engine-lab.html:203`;
3. ⭐ **nothing asserts the import edge itself** — the lab could re-inline its shader and all six
   re-pointed fences would stay green over an orphaned module (reproduced in node);
4. no per-frame uniform seam exists (layer 2, item 3);
5. the shader hard-assumes R=1.0, origin, identity quaternion and no logdepth — all layer 2.

---

## Step-model history (so old commit messages stay readable)

| old step | now |
|---|---|
| Step 0 — async compile + swap-on-ready | ✅ `9da286b`, `d87a8fe`. 5424 ms → 58.7 ms worst frame. |
| Step 1 — extract the applyDrivers core | → **layer 3**. Three graft slices shipped; path now closed. |
| Step 2 — extract the shaders | ✅ `6f9d3f4`. Vertex 1655 B / fragment 363 566 B byte-identical. |
| Step 3 — one land type end-to-end | → **layers 2+3**. `fc06017` put the lab's shader on a game planet; that milestone's *look* reading is void pending layer 2. |
| Step 4 — the bakes | → **layer 4**, pulled forward as a probe. |
| Step 5 — moons | → **layer 5**, now gated behind layer 0. |

## Traps that have each cost real time (do not re-learn these)

- ⛔ **A black frame is indistinguishable from a clean negative control.** Assert a lit-pixel floor
  and force a constant fragment output before diagnosing anything.
- ⛔ **A byte-identical string does not prove the page still runs.** Step 2's gate needed the
  pre-change HTML served side by side; both gave 0.375% lit / 1.86 luma / 367 uniforms. **0.375%
  looks exactly like a black frame** without that control.
- ⛔ **A frame diff cannot detect a small change while the scene animates.** A 500 ms settle gave a
  48% motion floor against a 50% signal. Back-to-back rAF grabs drop it to 1.6%, but planets are a
  few pixels at spawn distance.
- ⛔ **`gl.useProgram` + `getUniformLocation` is not a reliable "is this uniform used" probe** — it
  reported shipped, working uniforms (`uReliefMix`, `uCraterDensity`) as absent.
- ⛔ **Check whether a seam already exists before extracting anything.** Five recon agents designed
  an air-optics extraction that was unnecessary — `atmosphereOptics.js` was already shared and the
  game simply never called it.
- ⛔ **Chrome's shader DISK cache fakes compile measurements.** Cache-bust the shader SOURCE via
  `window.__shaderCacheBust`.
- ⛔ **The program cache key bakes in `toneMapping` + `outputColorSpace`, read from the BOUND render
  target.** Compiling against the canvas warms a program the game never draws.
- ⛔ **`import()` from an evaluated page script resolves to a DIFFERENT module instance.**
- ⛔ **`makeUniforms(WORLD_LIGHT)` takes the LIGHT VECTOR**, not `THREE`.
- ⛔ **Backticks inside the GLSL template literals in `src/objects/Planet.js` break the module.**
  `grep -c` for backtick LINES → **must stay 14**. Prose backticks in comments count.
- ⛔ **Do NOT add `rng` draws to `PlanetGenerator`'s shared stream** — one extra draw rewrites the
  generated universe. (Does not apply to `computeAtmosphere`; see layer 1.)
- ⚠ **`ss`/`curl` in the sandbox cannot see the dev server or Chrome** — use
  `mcp__chrome-devtools__list_pages`. `ss` reports no listener on a port that provably has one.
- ⚠ **Stage explicit paths in `git add`** — the tree carries standing NOT-OURS mods
  (`src/auto/CameraChoreographer.js`, `src/debug/LabMode.js`). Never `git add -A`.
- ⚠ Suite baseline **2026-08-01: 20832 passed / 4 failed** (`KnownObjects` ×3, `GalacticFeatures` ×1)
  + 13 `vendor/motion-test-kit` "no test suite" = **17 failed FILES**. Check before blaming yourself.

## ⭐⭐ SOL CANNOT VALIDATE ANY OF THIS WORK

Max, having had to say it more than once: *"the rendering process for Sol is unique in the galaxy
because we've got actual textures from NASA images."*

`public/assets/textures/bodies/` holds **18 NASA image assets**. Bodies with a `KNOWN_BODY_PROFILES`
entry load them through `BodyRenderer`'s **textured** path, which by standing rule never swaps back
to procedural. Sol's bodies also carry **no world-engine condition fields**. A measurement taken in
Sol is not merely unrepresentative, it is **confidently wrong** — the code path under test may not
execute at all. Use **`window._lab.spawnProceduralSystem(seed)`**, or Caph / Dalim / Larawag from
`node tools/find-test-systems.mjs 25`.

Sol *is* valid for **system-independent** work (shader compile cost — the GPU program is chosen by
body TYPE). Say which class the measurement is in whenever Sol is used at all.
⛔ Sol is **permanent**. Do not propose unifying them.

## The LAB track — this file's blind spot (added 2026-08-05)

**This file is a lab→game document end to end. It has never covered the other half of the program:
building out the lab's own missing/underbaked features.** That backlog lives in
[`lod-lab-quality-backlog.md`](lod-lab-quality-backlog.md) (Max's own 14 entries),
[`surface-variation-beyond-mvp.md`](surface-variation-beyond-mvp.md) and
[`planet-lod-campaign-tracker.md`](planet-lod-campaign-tracker.md). Verified 2026-08-05:

- ⭐⭐ **THE HIGHEST-LEVERAGE SINGLE LAB ACTION, AND IT IS IN NO PLAN: the tectonic grain is
  latitude-only.** `planet-lod-tectonic.js:106-107` — `const lat = carrier.latDegOf(i) + rotateDeg;`
  → `stressAtLat(lat, drivers)`, and `:50` says it outright: *"the grain is otherwise latitude-only
  / longitudinally uniform."* **A latitude-only strike is a mechanical explanation for Max's
  backlog #7 "canyons look like one long trench" AND for blobby mountains** — and it is *also* the
  port's only stated blocker for mountains+canyons. **Six** features ride the grain field, so one
  investigation either fixes or kills two of Max's complaints and unblocks the port. The port lane
  found this independently (`surface-variation-beyond-mvp.md:615/:625`) and nobody connected the two.
  ⚠ Note the default disagrees across sides: lab runs grain **ON** (`world-engine-lab.html:1442`
  `grainStrength: 1.0`), production defaults **0**.
- ⛔ **NOTHING on the lab backlog is superseded** by the 2026-07-31 "replace, not graft" turn. The
  STOP-DOING note kills the PORT lane's transcription rungs (plateaus, provinces, mountains/canyons
  *ported game-side*), not lab work.
- ⛔ **But "lab GLSL work is doubly valuable because the shader module is shared" is FALSE today**
  — see §LAYER 3 on `LabPlanetMaterial` being a debug probe. **Everything on the lab backlog is
  lab-only until a production material swap exists.** That is the argument for doing layer 2 first
  even if you care mainly about the lab.
- **Backlog #12 (exotic surfaces) is blocked by a data gap nobody connected to it.**
  `PROFILES.md:42-47` lists six body types as *"BLOCKED — no preset, no archetype"* (hex, shattered,
  fungal, machine, city-lights, ecumenopolis) — exactly the ones Max complained about. You cannot
  judge whether an ecumenopolis reads right *as a world* while it is only viewable as a toggle on
  someone else's world. Authoring those presets must precede the #12 fix loop.
- ⚠ **`PROFILES.md:28-47` already holds a real render probe for four backlog items** — read it
  before triaging: F20 coastlines measures 0.050 on Ocean (so #4 is not a blackout), F19
  mass-wasting is INERT at 0.00006 **on Mars**, a non-airless body (so #4 is wider than Max's
  airless framing), F36 sunglint is unproducible in the probe geometry, F11/F12 inert with healthy
  drivers.
- ⚠ **Stale lab docs that will mislead you:** the tracker still schedules **F38 airglow and F39
  cloud-optics as unbuilt Phase-4c work — both shipped ~2026-06-15**, and F39 was then turned
  default-OFF by a Max taste-call (*"too hi-fidelity for the lo-fi aesthetic"* — decide delete vs
  restyle, don't leave dead code). Tracker line 24 marks Phase 6 pending; commit `e2cdac6` ran it.
  `labs-inventory.md:17` says the lab is 7593 lines; it is **6411**. `world-engine-lab.html:1238/1240`
  calls `cryoActivity` a stub; it is derived live at `planet-lod-lab-core.js:881`.
- The lab itself has not been edited since `6f9d3f4` (2026-07-30); every commit since is port work.

## How to pick this up in a fresh session

1. Read this file — **starting with the 2026-08-05 correction box at the top.**
2. `git log --oneline -15` on `feature/world-engine-production-L1` — **the log outranks this file.**
3. **Do LAYER 2 first.** Revised 2026-08-05, against this file's own old advice to take the lowest
   unstarted layer. Reasons, in order: (a) layer 2 blocks *all measurement* — `planet-lod-shaders.glsl.js`
   has exactly **one** commit in its history (`6f9d3f4`), so every reading ever taken through
   `tryLabShader`, including `fc06017` and `d1f770a`, was taken against all five defects still live;
   (b) it is the only layer whose fixes are confirmed, small and lab-neutral; (c) it is the path to
   a production material swap, which is what makes lab work reach players at all.
4. **Layers 0/1 run in parallel with it** — but layer 1 is **gated behind the stream-safety commit**
   (see §LAYER 1 blast radius), and layer 0's cheapest real item is `habitability`, not the fp export.
5. ~~Before building on layer 4, run the bake probe~~ — **done 2026-08-05.** Carry its one
   architectural consequence instead: build the 40k router mesh **once and share it** across
   overlays, or pay ~1 s per body on first visit.

Do **not** read `~/briefings/*.md` for status. They are per-session and they go stale.

---

# ⭐ LAYER 7 — APPROACH CONSISTENCY (Max's criterion, 2026-08-10). NOT CLOSED.

**Appended, not inserted — no line above this section moved.** Added because this criterion has no
home in §LAYER 1-6 and would otherwise live only in a session handoff, which this file's own header
says has twice been wrong about what shipped.

## The criterion, verbatim

> *"in the lab, I can get really close to the planet and the LOD stays pretty consistent, keeping the
> illusion of getting closer and closer to a planet, as opposed to getting closer and closer to a
> beach ball painted to look like a planet. I'm realizing this is critical to the visuals working,
> even though we are using a lo-fi aesthetic."*

⛔ **The lo-fi aesthetic does not excuse this — Max ruled that out in the same sentence.** And he
framed it as a thing to *track toward*, not a stop-work: *"I don't want to throw a wrench into the
plan here, just something I want to keep in mind and track to."* Do not re-scope Layers 1-6 around
it. Do check every rendering increment against it.

## ⭐ TWO HALVES. DO NOT CONFLATE THEM. One is closed and one is not.

### Half 1 — SHAPE. ✅ CLOSED 2026-08-10, commit `77fff7f`.
`src/objects/Planet.js` shipped `IcosahedronGeometry(r, 5)` = **720 triangles**, a ~40-gon limb that
**collapses to 12.8 sides at the 1.05-radius zoom floor** (`ShipCameraSystem.js:859`), because the
visible cap shrinks as the camera closes while the disc grows. Measured threshold: **1 render pixel
of limb error at ~2.6 body radii**, i.e. everything inside the `radius * 2.8` autopilot survey stop
was visibly faceted. Now `SphereGeometry(r, 96, 48)`; `Moon.js` likewise (it was WORSE — detail 3,
1.80 px error already at the survey stop).

⛔ **Raising the icosphere detail was proposed and WITHDRAWN on measurement** — record it so nobody
re-proposes it. `IcosahedronGeometry` is **non-indexed**: 2160 attribute slots for **362 distinct
positions**. An indexed `SphereGeometry(r, 64, 32)` is **2145 verts — fifteen FEWER than shipped** —
at 3.3x the limb quality; `ico d10` needs 3.4x the verts to match that.

### Half 2 — APPROACH DETAIL. ⛔ NOT CLOSED. This is what Max is actually describing.
`planet-lod-lab-core.js:19-27` is `lodRampOf = smoothstep(20.0, 6.0, distanceRadii)` and
`autoOctaves = mix(4.0, 9.0, lodRamp)`. **THE RAMP SATURATES AT 6 BODY RADII.** From 6 radii down to
the 1.05 floor the disc grows ~6x in angular size and the octave budget stays pinned at 9 — *nothing
new resolves*. The surface magnifies without revealing anything smaller. **That is the beach ball.**

⭐ **The ramp itself is NOT the gap — it is already ported and live.** `BodyRenderer.js:11` and
`LabPlanetMaterial.js:8` both `import { lodRampOf, autoOctaves }` from the lab's own core ("the
LAB'S law, imported rather than re-derived"), driven per frame from `LODManager.update()`. Anyone
who "discovers" that the LOD system is unported has found the wrong thing.

**What is genuinely absent is camera-localised detail INJECTION** — new information near the camera,
not more octaves of the same field. The lab has two such mechanisms and neither is in the game:
- the fine-tributary patch bake+blend (`world-engine-lab.html:346`, "Option B river-LOD STEP 2") —
  note it is **default OFF even in the lab**, so the lab's own advantage here is partly unexercised
- the baked-relief -> in-shader-synth crossfade

⛔ **AND THERE IS NO GEOMETRIC LOD IN EITHER FRONT-END TO PORT.** No geometry constructor exists
anywhere in `src/rendering/` — `LODManager` swaps materials and ramps octaves, never meshes; the lab
builds one fixed `SphereGeometry(R, 256, 256)` at load. **Closing half 2 means BUILDING something,
not wiring something.** Scope it with `dev-collab-scope` when it becomes the active job.

### ⭐ MEASURED 2026-08-10 — the octave budget is NOT the difference, and Max's own eyes agree

The agent camera API (`_lab.approachSweep`, workstream `agent-camera-api-2026-08-10`) makes this
answerable for the first time. Run on both front-ends, seed `lab-procedural-6`:

```
20 -> 13.84 -> 9.57 -> 6.62 -> 4.58 -> 3.17 -> 2.19 -> 1.52 -> 1.05  body radii
oct  4.00     6.05    8.19    8.97    9.00    9.00    9.00    9.00    9.00
```

Saturation onset in **(6.62, 4.58]**; five of nine rungs resolve nothing new; the disc grows ~4.4x
across them.

> ### ⛔⛔ CORRECTION, SAME DAY — THIS SWEEP WAS TAKEN WITH THE 6e FLAG ON
>
> The line here originally read *"the two front-ends report the SAME live octave value at every rung
> — the ramp really is shared and really is driven on both."* **That measurement compared the lab
> shader against ITSELF.** `localStorage['wd.labGasBodies']` was `'1'`, left over from an earlier
> session, so the game body was carrying the LAB material. Caught by the planet-surface research
> workflow's M1 check, not by me.
>
> **MEASURED at the shipped default (flag cleared, page reloaded), on the SAME body
> `body.planet.41e625` in `lab-procedural-6`:**
>
> | | flag ON (the original sweep) | flag OFF (**shipped default**) |
> |---|---|---|
> | `isLabPlanetMaterial` | true | **false** |
> | uniform count | 356 | **71** (**72 since B2P, 2026-08-20** — `uPosterizeLevels`) |
> | `uOctaves` | present, driven 4.00 → 9.00 | **absent** |
> | sweep `liveOctaves` | 4.00 → 9.00 | **null at every rung** |
>
> ⭐ **THE DEFAULT GAME DOES STILL RAMP — under a DIFFERENT UNIFORM.** Measured across 20 → 1.2 body
> radii: `uReliefOctaves` 4 → 8.72 → 9 → 9 and `lodLevel` 1 → 2. So both shaders run a 4→9 octave
> ramp and **both saturate before you are close**. The octave-ceiling finding survives for both — it
> is the identification of *which* uniform, and *which shader*, that was wrong.
>
> ⭐⭐ **AND THIS MAKES MAX'S ORDERING MEASURABLY CORRECT.** He said *"in the lab I can get closer and
> still see more detail... but we just have to get the pipeline from the lab working in game first."*
> The default game body runs a **71-uniform** shader; the lab runs **356**. The lab's advantage up
> close is not a better LOD ramp — **it is a different, much richer shader**. That is a pipeline-port
> gap, which is exactly the thing he ruled comes first. ⛔ **THE FINGERPRINT MOVED — 71 → 72 AT B2P, 2026-08-20.** `uPosterizeLevels` joined the game material (src/rendering/posterizeLevels.js:55 `export const POSTERIZE_QUANTUM = { value: new THREE.Vector2(31.0, Math.fround(1 / 31)) };` — ⚠ **the GAME slot, re-pointed 2026-08-20.** This sentence used to cite posterizeLevels.js:45 `export const POSTERIZE_LEVELS = { value: 31.0 };`, which is still live and still resolves, but is the LAB material's SCALAR bound to `uniform float uLevels`; the game material's `uPosterizeLevels` holds the vec2 at :55. The citation fence validates the quoted line TEXT, not the attribution, so it stayed green through the wrong one), so a body ON THE GAME MATERIAL now reports **72** uniforms and 71 identifies nothing. 71 was correct the day this line was measured; it is kept, annotated, rather than rewritten. Debug against `isLabPlanetMaterial` — a boolean cannot drift with the next uniform.
>
> ⛔ **CHECK THE FLAG BEFORE QUOTING ANY GAME-VS-LAB COMPARISON.** `localStorage['wd.labGasBodies']`
> and `window.__wdLabGasBodies` are both live and both silent. A flag-ON measurement of "the game"
> is a measurement of the lab material wearing the game's scene graph.

**Max, 2026-08-10, after looking at the live game at 2.2 body radii:** *"The beach ball effect is
greatly mitigated by it being rounder than before. But we do still have a detail problem. In the lab
I can get closer and still see more detail. So we may need to work in more LOD steps. But we just
have to get the pipeline from the lab working in game first."*

⛔ **PUT THOSE TWO FACTS TOGETHER, BECAUSE THEY NARROW THE WORK SHARPLY.** The lab shows more detail
up close *while running the identical octave budget*. So the deficit is **NOT** the ramp, **NOT** the
octave count, and **NOT** a porting gap in `lodRampOf`/`autoOctaves`. This is measurement confirming
what this section already argued from reading: what is missing is camera-localised detail INJECTION,
above. ⛔ Anyone who proposes "raise the octave ceiling" or "re-port the LOD ramp" as the fix for
half 2 is answering a question the measurement has already closed. Max's "more LOD steps" is a
description of the symptom, not a specification of the fix — and his ruling is that the pipeline
comes first regardless.

## Known adjacent defect, do not bundle
Planet-class moons never register with `LODManager` (`src/main.js` — the `lodManager.register(moon)`
call sits in the `else` arm), so they get **no octave ramp at all**. Sweep finding S6-M7.

⛔ **CORRECTED 2026-08-10 BY MEASUREMENT — this section previously said `uOctaves` is "frozen at 4.0,
`uLodRamp` at 0.0". THERE IS NO `uOctaves` ON THESE BODIES TO FREEZE.** Measured live on
`body.planet.f5791a` ("Al", `lab-procedural-6` p=5 m=2) against an ordinary planet in the same
system:

| body | uniforms | `isLabPlanetMaterial` | `uOctaves` |
|---|---|---|---|
| ordinary planet `body.planet.41e625` | 356 | **true** | present, driven |
| planet-class moon `body.planet.f5791a` | 71 (**72 since B2P, 2026-08-20**) | **false** | **absent** (carries `uReliefOctaves`/`lodLevel`) |
| plain moon `body.moon.843748` | 29 | false | absent |

A planet-class moon is **not on the lab material at all**, so the LODManager registration gap is
**downstream of a material gap** — registration alone would not give it an octave ramp, because the
uniform the ramp writes does not exist on it. The frozen-at-4.0 signature is what would appear
*after* a lab-material swap. ⛔ Code that tests for a 4.0 here reads `undefined` and concludes the
wrong thing. Still real, still separate, still zero effect on half 1.
