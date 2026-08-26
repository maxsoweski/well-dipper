# World-Engine L0 Input-Boundary Audit (Q1 sufficiency · Q2 over-supply)

**Status:** DRAFT audit, 2026-06-22. Answers Max's Q1 + Q2 from
[`world-engine-architecture-spine.md`](world-engine-architecture-spine.md) §6.
Grounded in the live generator code (`src/generation/*`) + the driver/feature
manifests. Conservative: where a verdict turns on a judgement call it is flagged.

**Method.** "L0" = everything the input boundary actually supplies to a body:
(a) the per-body driver vector D1–D16 (`planet-drivers.js`, computed in
`PlanetGenerator.generate` / `PhysicsEngine.js`), and (b) the system context
the galaxy/system generator computes (`StarSystemGenerator.js`). For each of the
15 engines (E1–E15) we ask: does L0 supply that engine's *declared* inputs?
Gap classes (spine §4): **(a) structured fields** scalars can't carry
(orientation field, stress tensor, field topology, resurfacing sequence);
**(b) system-level context** not exposed per-body (moons, rings, companion,
resonances).

---

## Key structural facts established by reading the code

These underlie every verdict below.

1. **`planetData` is generated in isolation and carries NO handle to its
   system.** `PlanetGenerator.generate(rng, orbitRadiusAU, sunDirection, zones)`
   receives only a `zones` blob (`frostLine, hzInner, hzOuter, starType,
   metallicity, sizeBias, luminosity, ageGyr, starMassSolar` —
   `StarSystemGenerator.js:285-295`). It returns a flat object
   (`PlanetGenerator.js:660-688`) with **no reference to siblings, moons, rings,
   the companion star, or resonances.** Neighbors/moons/rings live one level up
   on the `planets[i] = { planetData, moons, ... }` wrapper and in
   `systemData.{star2, asteroidBelts, trojanClusters, resonanceChain,
   binaryStability}` — none of which is reachable from a body. This is gap
   class (b), and it is total: **every system-context input is currently
   unreachable per-body.**

2. **D13 magneticField is computed but NOT surfaced.** `fieldStrength =
   ironFraction × (locked?0.2:1.0)` is recomputed *inline twice* — once in
   `computeAtmosphere` (`PhysicsEngine.js:168`) for stripping, once in
   `PlanetGenerator.js:421` for aurora — and never written to the returned
   `planetData`. `planet-visual-features.md:104` confirms `[partial]` exposure.
   So D13 reaches L1 only as the implicit consequences (atmosphere retained?
   aurora object?), never as a readable scalar, and never as a field *topology*.

3. **D12 tidalHeating is hard-zeroed for planets.**
   `computeSurfaceHistory(ageGyr, false, false, retained, 0)` —
   `PlanetGenerator.js:563-566`, comment "tidalHeatingRate for planets is ~0".
   The `tidalHeating()` physics function (`PhysicsEngine.js:295`) is **only ever
   called in tests** (grep: no call site in `src/generation` except the
   docstring). Moons do not call it either in the current
   `MoonGenerator`. So D12 — the North-Star driver for cryovolcanism, Io-grade
   volcanism, tidal resurfacing (E3/E7/E11) — is effectively **0 everywhere** in
   the game pipeline today.

4. **D3 axialTilt is a pure RNG roll, not derived.**
   `PlanetGenerator.js:513/635`: `rng.chance(0.1) ? rng.range(-1.5,1.5) :
   rng.range(-0.5,0.5)`, or inherited from ring tilt. It is exposed, but it is
   not physics-derived and not coupled to anything (no Milankovitch, no
   collision history).

5. **Eccentricity is never computed per body.** `circularize()`
   (`PhysicsEngine.js:321`) exists but is never called; planets carry
   `orbitAngle`/`orbitSpeed` but no `eccentricity` field
   (`StarSystemGenerator.js:393-403`). D12's whole physical basis (e² flexing)
   has no input. The lab's `DRIVER_PRESETS` hand-author an `eccentricity` per
   type precisely to paper over this (see Q2).

6. **D11 surfaceHistory is a 3-scalar snapshot, not a sequence.**
   `{bombardmentIntensity, erosionLevel, resurfacingRate}` —
   `PhysicsEngine.js:757-761`. No event ordering, no resurfacing *sequence*.

7. **The game return object omits several D's as first-class fields.**
   `planetData` exposes `composition{carbonToOxygen, ironFraction,
   volatileFraction, surfaceType, density}, T_eq, tidalState, habitability,
   surfaceHistory, axialTilt, rotationSpeed, massEarth`. It does **not** store
   `ageGyr`, `metallicity`, `magneticField`, `tidalHeating`, `eccentricity`,
   `atmoDensity/pressure` (pressure is nested in `atmosphere.physics`), or any
   system context. The lab consumes a *different, richer* per-body blob
   (`DRIVER_PRESETS`) that the game never produces — the lab≠game seam.

---

## Q1 — Per-engine sufficiency

Legend: **SUFF** = L0 supplies the declared inputs (as scalars; structured-field
derivation is L1's job per the spine's "expose + derive" lean, so a missing
*structured field* is scored as a class-(a) note, not an automatic SHORTFALL
unless the engine cannot start without it). **SHORT** = a declared input has no
L0 source at all (class b, or a scalar simply isn't computed).

| Engine | Declared inputs | Verdict | Missing input (class) |
|---|---|---|---|
| **E1 Composition & regime** | D2,D9,D10,D14,atmo | **SUFF** | All present (`deriveComposition` + `computeAtmosphere`). Only note: regime "class" is implicit in scalars; fine. |
| **E2 Figure & illumination** | D7,D8,D14,orbit,star | **SHORT** | D7/D8/D14 present. **orbit eccentricity absent** (fact 5) → no Roche/comet-tail/tidal-distortion figure; **companion star + pulsar/rogue lighting need `star2`/system context** (class b, fact 1). Sphere/eyeball/terminator work; the exotic figures + multi-star lighting do not. |
| **E3 Tidal / orbital-coupling** | D7,D12,orbit(ecc,libration),neighbors | **SHORT** | **D12 hard-zeroed (fact 3); eccentricity + libration absent (fact 5); neighbors unreachable (class b, fact 1).** This engine has essentially none of its forcing inputs today. Stress *tensor* is the class-(a) derive target on top. The single most starved engine. |
| **E4 Magnetosphere / radiation** | D13(+topology),neighbors,D4 | **SHORT** | D4 present. **D13 not surfaced as a scalar (fact 2); field *topology* is class (a); moon-footprint / co-orbital flux needs neighbors (class b).** Aurora *intensity* is derivable (it's computed inline today) but the engine's declared topology + neighbor coupling are not. |
| **E5 Atmosphere / climate** | D4,D5,D8,D1,D3 | **SUFF** | All present (D5 = `atmosphere.physics.pressure`; D3 is RNG-derived per fact 4 but exposed). Note: D3 not physically grounded — climate seasonality rides a dice roll. |
| **E6 Lithospheric-stress / tectonic-grain** | D11,D12,D14,composition,despin | **SHORT** | D11/D14/composition present. **D12 zeroed (fact 3); "despin" (rotational-flattening relaxation history) has no input — needs rotation *history*, not the current scalar.** Orientation/wavelength/amplitude grain field is the class-(a) derive target. Relief amplitude derivable; *oriented grain* is not. |
| **E7 Endogenic-heat / magmatism** | D12+tidal-heat,D14,D5,composition(fluid) | **SHORT** | **D12 + tidal-heat-flux field both absent (fact 3).** D14/D5/composition present. Magma-ocean from extreme T_eq + lock is derivable (the lab does it); **Io-grade / cryovolcanic magmatism, which is D12-driven, has no live input in the game.** Hotspot *field* is class (a). |
| **E8 Impact / bombardment & space-weathering** | D11,D14,D5,D2,D16,composition | **SHORT (minor)** | D11/D14/D5/D2/composition present. **D16 (age) is used internally to compute D11 but is NOT a first-class field (fact 7)** — E8 wants age directly for crater *accumulation* + space-weathering maturity. Resurfacing *sequence* is class (a). Closest to sufficient of the relief engines. |
| **E9 Hydrology / working-fluid** | relief,D1,D2,D14,D8 | **SUFF*** | All L0 drivers present (D1,D2,D14,D8). *Caveat: "relief" is an L1 (E6/E7) output, not L0 — sufficiency here is contingent on E6/E7 firing, and E6/E7 are SHORT. Base-level/standing-liquid field is class (a) but derivable from drivers + relief. |
| **E10 Aeolian** | relief,D5,D14,D2,D8,frost-gate | **SUFF*** | D5,D14,D2,D8 present; frost-gate = D1/D2/D3. Same relief-is-L1 caveat as E9. |
| **E11 Cryosphere / volatile-ice** | D1,D2,D3,D12,relief,E3-stress-tensor | **SHORT** | D1/D2 present; D3 RNG-derived (fact 4). **D12 zeroed (fact 3); E3 stress-tensor is a class-(a) field that depends on the most-starved engine.** Sublimation/frost-cycle (D1/D2/D3) works; **cryotectonic resurfacing + ice-shell convection (D12/E3) have no input.** |
| **E12 Surface-chemistry & province** | composition,irradiation(E4),T,all-surface-fields | **SUFF*** | composition + T present; irradiation comes from E4 (SHORT) and "all-surface-fields" are L1 outputs. L0-wise sufficient; the province *field* is the live Stage-D system already (`planet-archetypes.js` PROVINCES). |
| **E13 Temporal / transient** | D3,D1,frost+dust+ice+ring states | **SHORT** | D3/D1 present (D3 RNG). **"ring states" needs ring data = system context (class b, fact 1); spokes need the ring + D13.** Seasonal frost/dust transients derivable; ring-coupled transients are not. |
| **E14 Inhabitation** | D15,D16 | **SHORT (minor)** | **D15 present and first-class; D16 (age) is NOT surfaced as a field (fact 7)** — it's consumed internally then dropped. E14 reads age for biosphere/technosphere *maturity*. One-field fix. |
| **E15 Ring / circumplanetary** | system(rings/moons),D13 | **SHORT** | **Entirely class (b): rings, moons, Roche geometry all live on the system/wrapper, unreachable per-body (fact 1); D13 not surfaced (fact 2).** `generateRingPhysics` even runs with `moons:[]` hard-coded (`PlanetGenerator.js:520`) because moons don't exist yet at planet-gen time — so ring gaps from moon resonances are never computed even *inside* L0. The most system-dependent engine; currently zero of its inputs are reachable from a body. |

### Q1 tally

- **SUFFICIENT (clean):** E1, E5 — **2**.
- **SUFFICIENT\* (L0-clean but contingent on an upstream-L1 relief input or an
  L1 field; flagged):** E9, E10, E12 — **3**.
- **SHORTFALL:** E2, E3, E4, E6, E7, E8, E11, E13, E14, E15 — **10**.

**Headline gaps (drive almost all 10 shortfalls):**

1. **D12 tidalHeating is dead in the game pipeline** (hard-zeroed, function
   never called). Starves E3, E6, E7, E11 — the entire tidal/endogenic/cryo
   spine, which the CHARTER calls the North-Star couplings. *Highest-leverage
   single fix.*
2. **No per-body system context** (class b). Starves E2 (companion), E4 (moon
   footprint), E13 (ring state), E15 (rings/moons entirely), E3 (neighbors).
3. **D13 magneticField never surfaced** as a first-class field (fact 2).
   Starves E4 and E15; already flagged in `planet-visual-features.md`.
4. **Eccentricity never computed** (fact 5). Starves E2 (figure) and E3 (the
   physical basis of tidal coupling).
5. **D16 age (and metallicity) computed-then-dropped** (fact 7). Cheap to
   surface; unblocks E8 + E14 directly.
6. **Structured fields (class a)** — orientation grain (E6), stress tensor
   (E3/E11), field topology (E4), resurfacing sequence (E8) — are real but, per
   the spine's "expose + derive" lean, are L1's job to synthesize from scalars +
   graph. They are noted, not double-counted as L0 shortfalls.

**Spine-missed shortfalls this audit adds:**
- **E2/E3 eccentricity & E3 libration** — the spine lists "orbit(ecc,libration)"
  but doesn't flag that *eccentricity itself is never generated*, not merely
  unexposed. (`circularize` is dead code.)
- **D16/metallicity computed-then-dropped** — the spine treats D16 as
  `[current]`; it's computed but not a readable body field, so E8/E14 can't read
  it without plumbing. A one-line exposure, but a real gap.
- **D3 is RNG, not derived** — affects E5/E11/E13 *quality* (seasonality rides a
  dice roll), even though it's technically "exposed."

---

## Q2 — Over-supply / conflict (assumptions that pre-decide L1's job)

The pattern across all findings: **the pipeline picks a discrete planet TYPE
first, then derives — or hard-codes — features from the type**, which is exactly
the type-branch-vs-co-genesis tension the CHARTER names. Evidence:

### C1 — `_pickType` is the master branch; almost everything keys off type, not drivers
`PlanetGenerator._pickType` (`PlanetGenerator.js:710-856`) chooses one of ~18
discrete `TYPES` from a zone + `rng.float()` roll, **before any driver is
computed**. The type then drives, by lookup table rather than by D1–D16:
- `MAP_RADIUS_RANGES`, `RADIUS_RANGES_EARTH`, `PALETTES` (base/accent colour) —
  **`PlanetGenerator.js:48-310, 338`** — appearance is chosen by type, not by
  composition/D9/D10.
- `noiseScaleRanges` (`:342`), `cloudChance` (`:469`), `ringChance` (`:492`),
  `maxMoonsByType` (`:540`), atmosphere `strength` ranges (`:402`), aurora/storm
  eligibility (`type === 'gas-giant'`, `:570`).
- `estimateMassEarth(radiusEarth, type)` (`PhysicsEngine.js:61-73`) branches on
  type to pick the mass-radius law.
- `computeAtmosphere` **short-circuits on type** (`PhysicsEngine.js:145`):
  `gas-giant|hot-jupiter|sub-neptune|venus` return a hard-coded atmosphere
  (`composition:'h2-he'`/`'co2'`, `pressure: 1000|90|50`) **without running the
  Jeans/escape physics at all.** So D4/D5/D6 for a quarter of the type space are
  *type constants*, not derived — a direct co-genesis violation feeding E5/E4.

**Conflict:** a world-engine that derives composition→palette, atmosphere→sky,
moons/rings→circumplanetary from drivers would have to **ignore or override**
every one of these type-keyed tables. They pre-decide outputs E1/E4/E5/E12/E15
are supposed to own.

### C2 — `planet-archetypes.js` presets hard-code feature SETS by archetype
`FEATURES[*].archetypes` + `ARCHETYPES[*].presets` define, per type-preset,
*which features may render* — and the `rendersOn:[presetName,...]` lists in
`planet-feature-associations.js` pin each feature to an **explicit allowlist of
preset names**. Examples of over-determination:
- `lava` / `magma` features → `rendersOn:['Lava (hot airless)','Magma
  (K2-141b)','Venus (sulfuric shroud)']` (`associations:131, 395`). A volcanic
  world is volcanic because it's *named* one of those presets, not because D12
  says so (and D12 is 0 anyway — fact 3).
- `chaos`, `cryoRidge` → `rendersOn:['Europa (icy moon)']` only
  (`associations:138, 145`). Cryotectonics is gated on **being the "Europa"
  preset**, not on D2-volatiles × D12-tidal-heat.
- `bands/jets/greatSpot/...` → the gas-giant/hot-jupiter preset list
  (`associations:258-296`). Banding is gated on type, not on D8 rotation × D5
  density (P16's actual drivers).
- The 2026-06-15 audit comments throughout `planet-archetypes.js` (e.g. craters
  L7, massWasting L30) are *manual* per-preset allowlist edits — "+Lava", "+Mars
  (prominent)", "Max: blanket" — i.e. humans hand-curating which features each
  named type shows. That is the catalog doing L1's derivation by hand.

**Conflict:** co-genesis wants "Europa-like cryo terrain" to *emerge* anywhere
D2 is high and D12>0 and D1 is cold — on a body that was never labelled
"Europa." The `rendersOn` allowlists and archetype membership **pre-decide the
feature set per named type**, which is the over-supply Q2 targets. This is the
single biggest conflict surface.

### C3 — D13, D15, D16 are DERIVED COMPOSITES — a layering inversion
The spine asks whether any D's are composites an L1 engine would re-derive. Yes,
three:
- **D13 magneticField = ironFraction × rotation factor** (`PhysicsEngine.js:168`,
  `PlanetGenerator.js:421`). This is precisely **E4's job** (D13 "(+topology)").
  L0 is pre-computing a scalar collapse of what E4 should own as a field. Worse,
  it's computed *inline and discarded*, so E4 can neither read nor override it —
  it would have to recompute the same product.
- **D15 habitability = composite of D1/D4/D6/D9/D7/age/mass**
  (`habitabilityScore`, `PhysicsEngine.js:576-626`; the driver label itself says
  "the RESULT of D1/D4/D6/D9/D7…"). This is a **scored verdict**, and **E14
  Inhabitation consumes it directly** (`P27/P28` drivers = `habitability`). So
  L0 is doing E14's upstream reasoning. If E14 wanted to weight habitability
  differently (e.g. for exotic biochemistries, carbon worlds), it must **discard
  and re-derive** from the primitives — the composite is in the way.
- **D16 age** feeds D11 surfaceHistory inside L0, but E8/E16-style accumulation
  wants raw age. Less an inversion than a not-surfaced primitive (fact 7).

**Conflict / redundancy:** D13 and D15 are L1-shaped derivations sitting in L0.
They are layering inversions: L0 should hand E4 the *primitives* (ironFraction,
rotation, and a topology seed) and E14 the *primitives* (the D1/D4/D6/D7
factors), letting those engines own the composite. Today L0 bakes the answer.

### C4 — The lab's `DRIVER_PRESETS` is a parallel, hand-authored, per-TYPE input table
`world-engine-lab.html:2476+` defines `DRIVER_PRESETS` keyed by preset/type name,
each hand-supplying `eccentricity, surfaceHistory{erosion,bombardmentIntensity,
resurfacingRate}, habitability, tidalState, atmosphere{...}`. Two problems for
the world-engine boundary:
1. It supplies fields the **game L0 never computes per body** (eccentricity,
   `surfaceHistory.erosion` as a first-class field, a hand-set `habitability`) —
   so the lab's "L0" and the game's L0 are **different contracts**. Any engine
   validated in the lab is being fed inputs the game won't produce (the
   documented lab≠game seam, but here it's specifically an *input-boundary*
   divergence, not just a rendering one).
2. The presets are **per-type constants** (one row per named world), so every
   feature the lab shows is, again, type-indexed rather than driver-derived.
   E.g. the gas-row comments openly hand-tune `eccentricity:0.005` "so the lab's
   star-tidal model … doesn't derive Io-grade lavaActivity" — i.e. the input is
   reverse-engineered from the desired output. That is over-supply by
   construction.

### C5 — ExoticOverlay SWAPS type post-hoc, discarding the derived body
`ExoticOverlay.apply` (`ExoticOverlay.js`) runs *after* generation and
`_swapPlanetType` (`:286`) **regenerates the body with `forceType` and
`zones=null`** (`:295`), throwing away the physics-derived composition/atmosphere
and substituting a type's palette/feature set. `fungal/hex/machine/crystal/
shattered/city-lights/ecumenopolis` are assigned by **independent rolls keyed on
zone + star type**, not by any driver (e.g. crystal at `rng.chance(0.01)` on
rocky/carbon/ice, `:269`). For a story engine these are the *least* co-genetic
outputs: a "crystal world" is a coin flip, not the end state of a
slow-crystallization history (P15). E12/E13/E14/the exotic engines would have to
override these swaps entirely.

### Q2 verdict

**Yes — L0 (chiefly `PlanetGenerator._pickType` + `planet-archetypes.js`
presets + the lab `DRIVER_PRESETS`) pre-decides outcomes the world engine should
derive, in five concrete ways:**
- **C1** type-first branch → palette/atmosphere/moons/rings/clouds chosen by
  type lookup, with `computeAtmosphere` hard-coding D4/D5/D6 for 4 types.
- **C2** `archetypes` + `rendersOn` allowlists hard-code the **feature set per
  named preset** — the prime over-supply suspect, confirmed.
- **C3** D13 and D15 (and D16-as-input) are **derived composites = layering
  inversion**: L0 doing E4's and E14's work, then discarding it.
- **C4** the lab `DRIVER_PRESETS` is a second, richer, per-type input contract
  that diverges from the game L0 and is reverse-engineered from desired output.
- **C5** ExoticOverlay assigns exotic types by post-hoc dice and regenerates the
  body, erasing the derived history.

The thread tying C1/C2/C4/C5 together: **"type" is load-bearing at the input
boundary.** Co-genesis requires the type to become an *emergent label read off
the drivers/fields*, not an upstream choice that gates everything downstream.

---

## Recommended L0 interface changes

Ordered by leverage (unblocks the most engines per unit work).

1. **Compute & plumb D12 tidalHeating into the planet path.** Call
   `tidalHeating()` (or a planet-around-star analogue) with a real per-body
   eccentricity; stop hard-passing `0` at `PlanetGenerator.js:565`. Unblocks
   E3/E6/E7/E11 — the whole North-Star spine. *Prerequisite: compute
   eccentricity (item 2).*
2. **Generate per-body eccentricity** (call `circularize` from an initial
   draw + age) and **surface it as a `planetData` field.** Unblocks E2 (figure)
   and E3, and removes the lab's hand-authored `eccentricity` hack (C4).
3. **Surface the primitives that are computed-then-dropped:** add
   `magneticField` (D13), `ageGyr` (D16), `metallicity`, `tidalHeating` (D12),
   `eccentricity`, and `atmoPressure` (D5) to the returned `planetData`. Cheap;
   directly unblocks E4 (D13), E8 + E14 (D16), and stops the double-recompute of
   D13 (C3).
4. **Expose the system graph per-body.** Give `planetData` (or a thin
   L1 "base" wrapper as the spine's §4 lean proposes) a read-only handle to
   `{star2, siblings:[{type,orbitAU,massEarth}], moons, rings, resonanceChain}`.
   Unblocks E15 (entirely), E4 (moon footprint), E13 (ring state), E2/E3
   (companion + neighbors). This is the single fix for all of gap class (b).
   — Note: also lets `generateRingPhysics` finally receive real moons instead of
   `moons:[]` (`PlanetGenerator.js:520`).
5. **Demote "type" from a gate to a derived label.** Long-horizon, but the
   target state: `_pickType` produces a *seed/label* for naming and L0 distribution
   stats only; palette/atmosphere/feature-set come from E1/E5/E12 reading drivers
   + fields. Concretely: replace the `rendersOn`/archetype allowlists
   (`planet-archetypes.js`, `planet-feature-associations.js`) with
   driver-threshold gates (the "driver self-limits" the 2026-06-15 comments
   already gesture at), and route `computeAtmosphere` through the physics for all
   types (drop the `:145` type short-circuit, or justify it per-type).
6. **Hold D13/D15 as primitives, not verdicts, at the boundary.** Keep
   computing them for gameplay/UI if useful, but ALSO expose the input factors so
   E4/E14 can re-derive/override. Prevents the layering inversion (C3).
7. **Reconcile the lab `DRIVER_PRESETS` contract with the game L0** (C4): the
   lab should consume the *same* per-body blob the game produces (post items
   1–4), or the divergence be documented as an explicit, bounded list. Otherwise
   every lab-validated engine inherits an input it can't get in-game.

**Sequencing note:** items 1–4 are the input-boundary fixes (mostly plumbing,
high leverage, low architectural risk). Items 5–7 are the co-genesis refactor
(high value, high blast radius — they touch `_pickType`, the archetype catalog,
and the lab). The spine's §4 "expose + derive" lean is consistent with doing
1–4 first (expose graph + primitives) and deferring the structured-field
derivation + type-demotion to the WF2 per-engine pass.
