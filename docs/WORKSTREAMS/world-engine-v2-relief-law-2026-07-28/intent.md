# world-engine-v2-relief-law-2026-07-28 — intent

> **Status: building.** Scoped 2026-07-28 out of Max's four v2 rulings
> (`research/superearth-v2-rulings-2026-07-28.md`). Successor to
> `world-engine-gravity-selfcompression-2026-07-28`, which is closed at `VERIFIED_PENDING_MAX 06b0030`
> with UAT failed on craters (U1/U2 — U2 fixed at `f88c2c6`, U1 is a separate Tier-1 workstream).

## Why we care

Max's ruling that started the thread, verbatim:

> *"We should go with whatever is scientifically predicted for super earths/large terrestrial planets."*

And the standing directive this descends from, verbatim:

> *"Tectonics, craters, everything need to adjust to the new radius when adjusted. I can tell that's
> not happening across the board."*

The previous increment fixed what `g` **is**. This one fixes what **consumes** it — and it is the
step where the physics finally reaches the screen. Right now a 4.5 M⊕ super-Earth's uplift field is
**bit-identical to Earth's**, because `body-drivers.js:24` fills the flat `massGravity` D14 slot from
`u.surfaceGravity` — the canonical, radius-blind gravity — rather than the radius-aware
`condition.surfaceGravity`. Four world-engine writers read that flat slot (`shellRelief.js:138`,
`stagnantLid.js:133`, `plates.js:131`, `magmatism.js:119`), so all four are radius-deaf today.

The global relief-amplitude uniform is blind twice over: `uPerturb` (`planet-lod-lab.html:5908`) is
computed from `state.surfaceGravity`, whose sole writer (`:3016`) is the same canonical value, and it
is multiplied by `reliefEnvelope`, which **discards the `radiusEarth` argument it is handed**. Full
trace: `../world-engine-gravity-selfcompression-2026-07-28/evidence/FINDING-uperturb-radius-blind.md`.

There is an ordering constraint and it is the reason these three things are one workstream rather
than three. From the rulings file:

    g(R) [DONE] → v2 relief law + move RELIEF_FLOOR → repoint bodyDrivers.massGravity

If the repoint lands *before* `RELIEF_FLOOR` moves off 0.40, the floor silently clamps every
super-Earth flat — **accidentally implementing the constant relief Max originally preferred, while
citing the falling law that replaced it.** The brief calls that the single worst outcome available.
Splitting the workstream is what would make that mistake possible, so the ordering is an AC.

## Success criteria (Max's language)

The measure of done, verbatim, from the predecessor workstream's intent:

> *"'Works' means we have a coherent model that determines the effects of gravity on terrain
> features/atmosphere according to scientific principles/models"*

⚠️ That sentence is **broader than this workstream** and the gap is deliberate. It names
`/atmosphere`, and no atmosphere law reads the corrected gravity — scale height `H = kT/(μg)` is
unwired and tracked nowhere. That is separate scope his words opened; it is surfaced, not absorbed.

Concretely, for this workstream:

- The relief law is the one he ruled: **`h ∝ g^−1.09`** (Guimond+2022), **slope from the paper,
  amplitude from Earth's observed 19.9 km — never the paper's amplitude**, and **no piecewise-in-g
  break** in the relief law itself.
- **`RELIEF_FLOOR` no longer binds inside the super-Earth population.** Whatever it becomes, it must
  not silently re-impose constant relief on the branch the law was adopted to describe.
- Dragging the radius slider right on a rocky world **visibly subdues relief** — a heavier world's
  mountains are crushed toward the datum — and dragging left exaggerates it (the Olympus-Mons read).
  Today the slider does nothing at all to global relief amplitude on any preset.
- **Nothing that was already correct moves.** Goldens hold byte-identical (hash `40c18aad`, never
  re-captured), the suite stays at its exact 4-failure baseline, and at the canonical radius the
  change is bit-for-bit invisible.
- The code **stops telling a future reader something false.** Two comment corrections ride along
  because they are in this law's own comment block and would otherwise outlive the code they
  describe: the `p_C = 0` justification must stop citing the Landais ~10 km break (**mechanism
  misidentified by 12–21×**; `p_C = 0` is *chosen against underdetermined physics*, not derived), and
  the `Q_RELIEF` block's "g already carries the radius signal" argument must stop being stated as
  true of a call site where it is false.

## Non-goals (named, so they don't creep in)

- **The bistable tectonic band** (ruling 3). Its steps 1+2 are ~8 lines and byte-safe, but they are a
  different physics domain — regime *routing*, not relief *amplitude* — and they gate on nothing here.
  Separate workstream, immediately after. ⚠ The recommendation on record to *"widen the seeded
  tectonic band"* is **wrong and must not be actioned**: stagnant-lid is currently unreachable for a
  super-Earth (verified over 2000 seeds and again with a 98%-stagnant weight override forced on) and
  the seeded three-way draw has zero routing influence anywhere in the reachable space.
- **Tier 1 craters** (ruling 4, U1). The draw-band fix and the Johnson+2016 impactor model are their
  own workstream. `K_DT = 3.1` and `D_D_SIMPLE = 0.20` are correct as shipped and are not touched here.
- **`/atmosphere`.** Owed, surfaced above, no workstream yet. Not silently absorbed.
- **Novel super-Earth landforms.** Max's standing scope rule, his words: *"if nobody has simulated it
  yet for us to copy we don't have to worry about adding it."*
- **The icy / sub-Neptune exponents.** Declared debt inherited from the predecessor, not fixed here.
- **Crystal.** Parking lot, standing constraint.

## Known weakness, recorded so it is not rediscovered as a surprise

Every model in the literature predicts *dynamically/isostatically supported* relief. The anchor set
this code fits is *total* relief, including impact basins and volcanic constructs. **Nobody has
modelled total relief on any planet.** The slope and the amplitude therefore come from different
physics, and Guimond's own model under-predicts observed Solar-System relief by ~3×. This is stated
in the rulings file and is carried here so the calibration is never mistaken for a derivation.
