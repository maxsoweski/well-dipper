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

The global relief-amplitude uniform is blind twice over: `uPerturb` (`world-engine-lab.html:5908`) is
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

⭐ **THERE ARE THREE SEAMS, NOT TWO — and the third one is inside this workstream.** The rulings file
lists two. The settlement found a third: `world-engine-lab.html:5937` feeds the envelope
`state.surfaceGravity`, whose sole writer (`:3033`) took `deriveUniforms`' **canonical, radius-blind**
`g`. **The `uPerturb` feed fix lands in the same commit as the law.**
`bodyDrivers.massGravity` can keep its place in the queue; this cannot.

> ⚠ **CORRECTED DURING BUILD 2026-07-28.** This paragraph originally justified that ordering by
> asserting *"the new envelope form carries a `1/R` term … ship the new form against a frozen `g`
> and the envelope degenerates to bare uncapped `1/R`."* **The adopted form has no radius term**, so
> that hazard is **structurally unreachable**, not merely avoided by ordering. (Along any physical
> trajectory the seam-normalising radius cancels identically — see the AC-CONTINUOUS annotation in
> `contract.json` — so every continuous candidate is a `g`-only law.) The feed fix still lands in the
> same commit, for the **other** ordering reason: the `RELIEF_FLOOR` = 0.40 clamp. Measured, with the
> new law against the old floor, the clamp binds at **R = 1.3787** on a `g_c = 1` rocky body and
> **R = 1.4669** on Rocky (Earthlike) — *inside* Rocky's own seeded draw band `[0.8, 1.5]`.

## Success criteria (Max's language)

The measure of done, verbatim, from the predecessor workstream's intent:

> *"'Works' means we have a coherent model that determines the effects of gravity on terrain
> features/atmosphere according to scientific principles/models"*

⚠️ That sentence is **broader than this workstream** and the gap is deliberate. It names
`/atmosphere`, and no atmosphere law reads the corrected gravity — scale height `H = kT/(μg)` is
unwired and tracked nowhere. That is separate scope his words opened; it is surfaced, not absorbed.

Concretely, for this workstream:

- The relief law is the one he ruled: **`h ∝ g^−1.09`** (Guimond+2022), **slope from the paper,
  amplitude from Earth's observed 19.9 km — never the paper's amplitude** — applied **above g = 1**.

  ⭐ **RULING 1 AMENDED 2026-07-28, by Max, after the derivation was costed.** The original rider was
  *"drop the piecewise-in-g break entirely."* The settlement showed what that costs at the **low**-g
  end, which nobody had computed when the ruling was made: an Earth-anchored `19.9·g^−1.09` predicts
  **141.8 km for the Moon** (7.1× its observed 19.9), **57.6 km for Mercury** (5.9× observed 9.8) and
  **57.3 km for Mars** (1.95× observed 29.4) — i.e. it knowingly regresses *the only relief
  measurements that exist* in order to be right where none do. Worse, the relief multiplier at
  R = 0.27 goes **2.75 (today) → 24.66**, which is **3.5× the 7.0× that produced the "molten waves"
  look Max rejected at the 2026-07-21 UAT**. Max's call, given those numbers:

  > **Derived above 1 g, keep the calibrated fit below** — labelled *"calibration below, derivation
  > above"*, i.e. a **data boundary, not a physical transition**.

  This does not contradict the original reasoning, it completes it. The reason for dropping the break
  was that no *physical* break can be located in g (Melosh's Mars/Mercury sit at identical gravity a
  factor of 3 apart). A calibration/derivation boundary is a statement about **where measurements
  stop**, which is exactly true at g = 1: Earth is the only Solar-System body at ≥ 0.9 g. The seam
  was the recommendation on the table before the ruling (predecessor intent, "Open for Max" §2).

  Consequence: **every measured body renders exactly as it does today** (zero low-g regression, no
  re-UAT at small radii), and the derived law governs only the branch where there is no data to
  contradict it.

- **The seam is continuous.** The two branches are expressed in different variables — the shipped
  fit is fractional-in-g (`g^−0.58`, no radius term), the derived law is absolute-in-g converted to
  fractional (`g^−1.09 / R`). They agree at the Earth point (both return exactly 1 at R = 1, g = 1)
  but **not automatically elsewhere on the g = 1 locus**, because g = 1 does not imply R = 1 for
  presets whose canonical radius is not 1. Deriving the continuous form is a build task with
  continuity as an acceptance criterion — it is not hand-waved here.

  > **RESOLVED DURING BUILD 2026-07-28: there is no `/R` form.** The `/R` cancels identically.
  > Along any physical trajectory `g = g_c·(R/R_c)^n`, the radius `R_s` at which that body's own
  > gravity crosses 1 satisfies `R_s/R = g^(−1/n)` exactly — both `R_c` and `g_c` cancel, for every
  > composition class — so the seam-normalised form `E = (R_s/R)·g^−1.09` collapses to the
  > **`g`-only** law `g^−(1.09 + 1/n)`. Pinning `n = 1.70` (the rocky super-Earth branch) gives
  > `Q_RELIEF_DERIVED = 1.09 + 1/1.70 = 1.678235294117647`, exact in IEEE. Continuity is then
  > structural rather than fitted — `Math.pow(1, ±anything) === 1`, so the branches meet at exactly
  > 1 for **any** radius — and `reliefEnvelope` keeps its unused `radiusEarth` argument. Measured:
  > one-sided ratio at `g = 1 ± 1e-9` is `1.0000000023` at every preset seam radius; 0 mismatches
  > below the seam over 363 points across all 18 presets.
- **`RELIEF_FLOOR` no longer binds inside the super-Earth population.** Whatever it becomes, it must
  not silently re-impose constant relief on the branch the law was adopted to describe.

  ⚠️ **A number under the ruling moved.** Both the decision brief (`:49`, `:417`) and the rulings
  file (`:30`) say the floor binds at **R = 1.64 R⊕** and conclude that this makes moving it *"less
  urgent, not more."* **That is wrong** — it compared a *fractional* clamp against the *absolute*
  exponent. The correct bind point is **R = 1.379 R⊕ / g = 1.726 / M = 3.28 M⊕**, which is
  *marginally earlier* than the v1 estimate of 1.40, so the conclusion **inverts**: it is more
  urgent, not less. Max's ruling ("must move off 0.40") stands and is strengthened. The brief
  self-refutes on this — its own table at `:23` gives 0.31× fractional at 1.5 R⊕, already below 0.40
  at a radius the same page calls 0.14 R⊕ short of binding.

- **The shipped law already IS constant relief.** `Q_RELIEF = 0.58` against
  `1/GRAV_R_EXP_SUPER = 0.5882`: `Q = 1/n` is exactly the condition for constant *absolute* relief
  above R = 1. The shipped implied absolute exponent is **+0.0082** — relief is flat, then *rises*
  once the floor bites. The failure mode the ruling worried about is not a risk being avoided; it is
  the status quo being corrected, and its cause is the exponent, not the clamp.

  > **CORRECTED DURING BUILD 2026-07-28 — the `+0.0082` is an exponent IN GRAVITY, not in radius.**
  > `1/1.70 − 0.58 = 0.008235294117647118` is the shipped absolute-relief slope measured against
  > `g`. Expressed against **radius** — the variable the slider and the render actually move — the
  > same fact is **+0.014000000000000123** (`1 − 1.70·0.58`), measured `+0.013999999999999834` by
  > the real `auditLaw` on the `relief-absolute-vs-radius` sweep points. Any radius-driven guard's
  > `nullValue` must therefore be **+0.014**, not +0.0082, or it cannot separate the adopted law
  > (`−1.853`) from the shipped one.
- Dragging the radius slider right on a rocky world **visibly subdues relief** — a heavier world's
  mountains are crushed toward the datum — and dragging left exaggerates it (the Olympus-Mons read).
  Today the slider does nothing at all to global relief amplitude on any preset.
- **Nothing that was already correct moves.** Goldens hold byte-identical (hash `40c18aad`, never
  re-captured) and the suite stays at its exact 4-failure baseline.

  ⚠️ **Correction to this criterion as first drafted.** It originally read *"and at the canonical
  radius the change is bit-for-bit invisible."* **That sentence was false and is struck.** It was
  inherited from the gravity workstream, where it held because `gravityRadiusRatio` is `x/x` at
  canonical. Here, **8 of 18 presets change at their own canonical radius** — exactly the `g_c > 1`
  set: Ocean 1.0744, Jovian 2.5335, Saturnian 1.0774, Neptunian 1.1243, Sub-Neptune 1.1248,
  Hot Jupiter 2.3669, Magma 2.2222, Carbon 1.1570. Recorded rather than quietly deleted, because it
  was about to become an AC that could not be passed.

  > **CORRECTED DURING BUILD 2026-07-28.** The replacement sentence, as first written, was itself
  > wrong: it said **17 of 18** and cited *"Titan 2.935 → 18.909; Mars 1.750 → 5.403; even
  > Rocky/Earthlike 1.063 → 1.122."* Those are the **unamended** no-seam law's numbers. Under the
  > amended (seam) ruling only bodies at or above `g = 1` move at all, so it is **8 of 18**.
  > Measured, unchanged: Titan stays `2.9348396980002267`, Mars stays `1.7503198484819087`, Venus
  > stays `1.0609330264979282`, Moon/Mercury stays `2.1054948190870233`, and Rocky/Earthlike stays
  > `1.0630148818083676` — its `g_c` is 0.90, **below** the seam. Eyeball (`R_c = 1, g_c = 1`) sits
  > exactly on the seam and returns 1.0 on either branch, so it does not move either.

  **Goldens hold for a different reason than that sentence claimed:** `reliefEnvelope` is not
  imported anywhere in the bake path (only `src/worldengine/instrument/laws.js:34` and
  `world-engine-lab.html:151`). Byte-identity therefore survives **only if the new exponent is added as
  a new constant and `Q_RELIEF = 0.58` is left alone** — `src/worldengine/base/reliefBudget.js:30`
  imports it and `:91` uses it with `C_RELIC = 0.00014558245419776515`, a Mercury+Moon fit solved
  **at 0.58**. Editing `Q_RELIEF` in place goes stale and moves the goldens.
- The code **stops telling a future reader something false.** Two comment corrections ride along
  because they are in this law's own comment block and would otherwise outlive the code they
  describe: the `p_C = 0` justification must stop citing the Landais ~10 km break (**mechanism
  misidentified by 12–21×**; `p_C = 0` is *chosen against underdetermined physics*, not derived), and
  the `Q_RELIEF` block's "g already carries the radius signal" argument must stop being stated as
  true of a call site where it is false.

  > **BLOCKED DURING BUILD 2026-07-28 — the `p_C` half was NOT actioned.** A repo-wide grep of every
  > `.js`/`.html`/`.mjs` outside `docs/` and `research/` for `p_C`, `P_C`, `Landais`, `flexur`,
  > "spectral break", "scale break", "texture exponent" and "elastic thickness" returns **zero**
  > hits for the texture-scale material. **There is no `p_C` constant in the code**, so there is no
  > comment citing the Landais break to strike; the material lives only in
  > `research/superearth-v2-{decision-brief,rulings}-2026-07-28.md`. Writing a *new* `p_C` comment
  > to satisfy the AC would be inventing the thing the AC asks to correct, and `p_C` belongs to
  > **ruling 2 (terrain texture scale)**, which this workstream does not implement. **Needs a scope
  > decision from Max:** drop item (1) from AC-HONEST, or move it to a ruling-2 workstream that
  > actually introduces `p_C`. The second correction (the "g already carries the radius signal"
  > argument) **is** actioned, in `planet-lod-lab-core.js`.

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
