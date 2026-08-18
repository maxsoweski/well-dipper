# B4 — the prediction commit for the moon-formation window

**Step:** B4 of [`moon-formation-channel-model-PLAN-2026-08-15.md`](moon-formation-channel-model-PLAN-2026-08-15.md)
**Tree:** `feature/world-engine-production-L1` @ `a76f9e7`, tracked tree clean, node v24.13.1
**Template:** the C7 delta table at `9ebb24b` / [`step8b-c7-delta-table-2026-08-14.md`](step8b-c7-delta-table-2026-08-14.md)

> ⭐ **This commit is B5's revert target.** B5 is the single window that moves the universe.
> Everything below is committed **before** B5 exists, so the prediction's priority is in the git
> history, not in a message written afterwards. Any number here that B5 contradicts is a failed
> prediction and must be reported as one — never adjusted to fit.

---

## §0 — ⭐⭐ WHAT IS MEASURED AND WHAT IS PREDICTED. Read this before quoting any number.

C7 could measure its whole delta table because C7 was **one substitution**. B5 is **nine
sub-steps**, and building all nine to measure them would *be* B5. So this document is in three
tiers, and every claim below is tagged with its tier. **A tier-2 or tier-3 number quoted as
though it were tier-1 is exactly the failure this lane keeps recording.**

| tier | meaning | how to treat it |
|---|---|---|
| **M — MEASURED** | run in a treated worktree at `a76f9e7`, reverted after | B5 must reproduce it exactly. A mismatch is a real defect in B5, not a stale prediction. |
| **D — DERIVED** | read off the code with a citation, not executed | B5 may refute it. If it does, the *reading* was wrong and that is worth knowing. |
| **T — TARGET** | a rate the plan intends B5 to hit | B8 sets these by measurement. Not a prediction about B5's mechanics. |

**Method for the M tier.** A detached worktree at `a76f9e7` (`/home/ax/wd-b4-probe`, removed
after), `node_modules` symlinked from the main tree. ⛔ Probes were **not** run in
`~/projects/well-dipper` because a dev server has been serving that tree on `:5173` for three
days; an `src/` edit there fires HMR and disturbs the live session. All patches were
line-count-neutral (a shortened template literal on one line), so no citation moved.

---

## §1 — Corpora

Unchanged from C7; repeated because **a number without its corpus is not a number** and this lane
has already shipped four figures whose corpus was wrong.

| Tag | Definition | Population |
|---|---|---|
| **FENCE-221** | `tests/body-identity-fence.test.js:93-120` — 192 bulk `wd-0`…`wd-191` + 5 pinned (`wd-356`, `wd-395`, `wd-614`, `wd-2232`, `wd-1403`) + 24 galaxy `gc-0`…`gc-23` | 961 planets · 794 moons = **770 plain + 24 planet-class** |
| **MC-197** | `tests/moon-condition-contract.test.js` | 705 plain + 23 planet-class |
| **STREAM-1500** | `tests/moon-rng-stream-identity.test.js`, `wd-0`…`wd-1499` | 5207 generate calls; 64 keys / 105 pairs |
| **IC-526** | `tools/port-uniform-delta.mjs` capture | 526 bodies = 372 S + 64 P + 90 G |
| **BULK-221** | `wd-0`…`wd-220`, galaxyContext null | 948 planets · 829 moons · 26 planet-class |

⛔ **BULK-221 is what `moon-formation-audit-2026-08-15.md` measured on. FENCE-221 is what every
instrument is stated against. They are different corpora and they give different answers.**

---

## §2 — B5 step 2 (the composition re-key): **MEASURED**, tier M

Plan §3 B5.2: *"Composition before size; `compSeed` and `moonecc:` re-keyed off pre-size
identity."* Composition must precede size, so neither key can continue to embed the moon's
radius. Both probes below remove exactly that term — the one component that is definitionally
unavailable once composition moves above `_pickRadius`.

### 2a. The three probes

| probe | patch | `systems` | `planets` | `plainMoons` | `planetClassMoons` |
|---|---|---:|---:|---:|---:|
| control | none | 0 | 0 | 0 | 0 |
| **A** — `compSeed` only | drop `:${moonRadiusData.radiusEarth}` from `MoonGenerator.js:256` | 0 | **0** | **770** | **0** |
| **B** — `moonecc:` only | drop `:${moonRadiusEarth}` from `MoonGenerator.js:358` | 0 | **502** | **770** | **24** |
| **A+B** — step 2 as specified | both | 0 | **502** | **770** | **24** |

Read against the literal at `tests/body-identity-fence.test.js:740`, which asserts
`{systems: 0, planets: 0, plainMoons: 0, planetClassMoons: 0}`.

### 2b. ⭐ The 502 planets. Nothing in the plan or the handoff predicts them.

`StarSystemGenerator.js:947-952` builds the `systemContext.moons` alias carrying exactly
`{type, radiusEarth, orbitRadiusEarth, tidalHeating}` — **and not `composition`**. `planetRecord()`
does not exclude `systemContext`. So a moon's `tidalHeating` is part of its **parent's** hash:

- **Probe A moves composition** → invisible to the planet record → **0 / 961 planets.**
- **Probe B moves `tidalHeating`** → visible through the alias → **502 / 961 planets.**

Probe A is therefore the moved control that proves probe B's 502 is real rather than an artefact
of the reader: the same reader, the same corpus, the same channel, 0 in one arm and 502 in the
other.

**502 is not an arbitrary number — it is every moon-bearing planet, and only those.** Derived
independently from the census's per-type `P(zero moons)` table
([`moon-census-baseline-2026-08-15.md`](moon-census-baseline-2026-08-15.md) §3):
`Σ planets × (1 − P(zero moons))` over all 18 types = **502**, with the type counts summing to 961.
Two independent routes, exact agreement.

⛔ **Consequence for B5:** any step that moves `tidalHeating`, `radiusEarth` or
`orbitRadiusEarth` on a moon reds its parent too. B5 steps 3 (mass-first sampler) and 6 (ordered
orbits) both move `radiusEarth` and `orbitRadiusEarth` on the whole plain population, so the
planet arm of the partition is **saturated at 502 from step 2 onward** and carries no further
information for the rest of the window.

### 2c. Instrument B's signature under step 2 — **8 tests, 2 failed, 6 passed**

Named individually, from a verbose run, not inferred from a count:

| test | result |
|---|---|
| the seed list on disk is the seed list in this file | ✓ |
| still covers every generation class it was built to cover | ✓ |
| is measuring the same code path production runs | ✓ |
| **DRAW STREAM: the per-yield draw profile is unchanged for every seed** | **✓ GREEN** |
| BODY IDENTITY: every planet and every moon hashes to its baseline | ✗ |
| RECORD SHAPE: no field was added to or removed from a body record | ✓ |
| the excluded world-engine bakes are still present on every planetData | ✓ |
| **NEGATIVE CONTROL: one extra draw turns both channels red** | **✗** |

⚠ **This is a different failing pair from C7's.** C7 failed DRAW STREAM + BODY IDENTITY. Step 2
fails BODY IDENTITY + NEGATIVE CONTROL, with DRAW STREAM **green**. Anyone matching C7's
signature against B5's output will misread it.

**Why NEGATIVE CONTROL fails, and why it matters more than it looks.** It is not a hardcoded
literal the re-bless misses. `tests/body-identity-fence.test.js:825` reads
`const before = baseline.systems[seed]` — the stored baseline — and `:845` asserts a fresh
unperturbed capture reproduces it. Any population move breaks that, and
`npm run test:body-identity:rebless` fixes it along with everything else.

⭐ **The real consequence:** NEGATIVE CONTROL is the test whose entire job is to prove the fence
can still *detect* a change. From B5's first population-moving edit until B7 re-blesses, that
proof is down. **For the whole window, Instrument B cannot demonstrate it is still able to see a
perturbation.** This is the same species of concern the `namespacedFloat` docstring
(`MoonGenerator.js:546-562`) raises about spending DRAW STREAM's red on a benign construction. It
is not a reason to reorder the window; it is a reason not to read a *green* fence during the
window as evidence of anything.

### 2d. Two corrections to the handoff, both confirmed by the probes

1. ⛔ **"`namespacedFloat` returns a different float for EVERY moon" is false.** `namespacedFloat`
   has exactly one caller, `MoonGenerator.js:257`, inside the append block. `:124` early-returns
   planet-class moons to `_generatePlanetMoon` (`:371`) long before it. **Measured: probe A moves
   0 / 24 planet-class moons.** It is every *plain* moon, and only plain moons.
2. ⛔ **"`compSeed` and `moonecc:` are both zero-draw" collapses two different mechanisms.**
   `compSeed` → `namespacedFloat` (`:578`) is a pure xmur3 hash: genuinely zero draws. `moonecc:`
   (`:358-359`) is `new SeededRandom(eccSeed)` + `.range()` — a **real draw**, and DRAW STREAM
   counts every `SeededRandom` instance via a prototype accessor
   (`tests/body-identity-fence.test.js:225-241`). It stays green only because re-keying preserves
   the draw **count**; the profile counts draws, not values. Same colour, different reason. The
   distinction is load-bearing: the docstring at `:551-558` records that turning `compSeed` into a
   sub-rng moves the draw profile on **197 of 221** fence seeds, +1 per plain moon.

   `moonecc:` is also why probe B reaches planet-class moons at all — `_generatePlanetMoon` calls
   `_computeTidalHeating` independently at `:431`, mirroring the plain path's `:185`.

---

## §3 — The rest of B5, tier D (derived, not executed)

### 3a. Predicted partition for the full window

⭐ **The window has two regimes and they must not be conflated.** Steps 2–6 and 9 move *values* on
a fixed population. **Step 7 changes the population itself** — the count law at
`PlanetGenerator.js:595-596`, the `ice`/`lava` table repair, and C1's removal of
`P(zero moons | gas giant)` all change how many moons exist.

**Regime 1 — steps 2, 3, 4, 5, 6, 9 (fixed population):**

| arm | predicted | basis |
|---|---:|---|
| `systems` | **0 / 221** | no system scalar is touched |
| `planets` | **502 / 961** | measured at step 2 (§2b); steps 3 and 6 move the same alias fields on the same 502 parents, so it saturates and carries no further information |
| `plainMoons` | **770 / 770** | saturated at step 2 |
| `planetClassMoons` | **24 / 24** | saturated at step 2 via `moonecc:`; step 4's merge then changes their *shape* as well |

**Regime 2 — step 7 onward (population changes):**

⛔ **The four hard literals stop being a partition and become a population statement.** Today the
fence pins planets 961, moons 794, plain 770, planet-class 24 (`:687`, one of the six literals the
re-bless env var does **not** rewrite).

- **`plainMoons` will not be 770.** C1 removes the zero-moon outcome for gas giants — measured
  today at **12.70% of 63 giants ≈ 8 parents** gaining a retinue where they had none — and the
  `ice`/`lava` `?? 1` cap repair lifts the ceiling on 211 more parents. The moon population rises;
  the exact figure is B5's to produce and B8's to accept.
- **`planets` will exceed 502.** Every planet whose `moonCount` changes moves, including
  previously-moonless ones whose `systemContext.moons` goes from `[]` to populated. The bound is
  **961**, not 502. ⚠ **I am not predicting the exact figure — it is a function of the count law
  B5 writes, which does not exist yet.** Saying otherwise would be inventing precision.

⚠ **So the partition is a weak instrument for most of B5.** It saturates on the first sub-step,
then stops being comparable at all once the population moves. ⛔ **Do not read "the partition
matched B4" as "B5 did what it was supposed to."** The load-bearing checks for steps 3–9 are
RECORD SHAPE, the rate tests in B8, and the stream re-derivation in B7 — not this literal.

### 3b. RECORD SHAPE — the one channel that still carries information

`RECORD SHAPE` is **green** under step 2 (measured) and must go **red** later in the window, by
construction: step 4 merges `_generatePlanetMoon` into the shared tail, and the append block gains
`moon.figure`, `moon.channel`, `moon.retrograde` and `contextSource`.

- Today: plain `{shapes: 1, keyCounts: [25], records: 770}`, planet-class
  `{shapes: 1, keyCounts: [20], records: 24}` (`:777-780`).
- Predicted after the window: **one shape per class, key counts risen by the same amount on both**,
  because the plan requires the new fields be assigned **unconditionally with explicit nulls**.
- ⛔ **The failure signature to watch for:** `{shapes: 2, keyCounts: [25, 27]}`. That is what a
  *conditional* append produces — the natural shape of a channel model — and it downgrades the
  strongest uniformity assertion in the tree instead of re-blessing it.

### 3c. Instrument C — sharper than the plan states

- **Exit 2, structural, one break, trigger = POPULATION MISMATCH** (`tools/port-uniform-delta.mjs:1860`,
  message at `:1862`). Not uniform-set drift (`:1791`), not shape drift (`:1840`), not
  build-failures (`:1875`).
- ⛔ **`--allow-deltas` cannot rescue it.** The structural check runs first and exits at
  `:2054-2057`; the `--allow-deltas` branch is `:2059`. The tool says so about itself at `:739`.
  The only path through is `--record --force`.
- ⭐ **The trap, and B4's job is to name it before anyone reads the output.** A body whose
  fingerprint moved is **excluded from the delta comparison**, so its uniforms print
  `0.000000e+0`. The file's own comment at `:735-739` records the measured precedent: 116 of 526
  bodies excluded, *"the uniform that actually moved reports 0.000000e+0 and the operator is told
  to go fix a green Instrument B."* At B5's scale that is the **242 of 526** rows (178 moon-bearing
  S + all 64 P) the plan's B7 already flags as *"re-baselined, not verified."*
  **Those 242 zeros are not evidence of no pixel change. They are evidence of nothing.**

### 3d. Instrument A

Predicted: the 24-entry failing-ID list is **unchanged in membership**; the total test count rises
by however many tests B5 and B8 add. ⚠ `known-failures.json` was last re-recorded at `3800dff`
**from a dirty tree** — an inherited flaw, not a new one. Treat Instrument A's pointer as soft for
the whole window and re-record only on a clean tree with the 24 confirmed unchanged.

---

## §4 — Rates after B5, tier T

### 4a. ⛔ The census's "SECOND FINDING" is withdrawn. It is a category error, not a defect.

[`moon-census-baseline-2026-08-15.md`](moon-census-baseline-2026-08-15.md) reports terrestrial
multiplicity at **0.0181 / system** against the plan's assumed ~3, calls it *"a factor of ~150,"*
and files the defect to `PlanetGenerator._pickType`. Its own next paragraph names the alternative
denominator and calls it a scoping question — but the headline is what a future reader takes.

**Elser et al. 2011** (Icarus 214:2) grew rocky planets by collisional accretion in N-body
simulations; their "terrestrial planet" is the astrophysical class. Their result — 1-in-12 central,
1-in-45 low, 1-in-4 high — *is* the plan's 8.3% / 2.2% / 25%. This generator's `terrestrial` is a
**game type string** meaning life-bearing Earth-like, deliberately tuned to ~3% of systems
(`PlanetGenerator.js:30`, `:947`, `:955`).

The two are different categories. The right denominator is the **3.1357 solid planets per system**
the census already measured:

| denominator | source | P(≥1 Band A per system) |
|---|---|---:|
| ~3 terrestrial (plan's assumption) | asserted | 22.89% |
| **3.1357 solid planets** | census §5, measured | **23.79%** |
| 0.0181 `terrestrial`-type | census §5, measured | 0.16% |

**Plan target: 1-in-4 to 1-in-15 = 6.67%–25%.** The conversion lands inside it and is robust —
it clears the 6.67% floor for any denominator above ~0.8 solid planets per system.
**No `_pickType` defect. Nothing to file.**

⚠ **The honest caveat:** "solid" here is *not in {gas-giant, hot-jupiter, sub-neptune}*, which
includes outer-system `ice` planets, while Elser's giant-impact era is an inner-system phenomenon.
The true denominator is therefore between 0.0181 and 3.1357 and much nearer the top. The plan's C2
crowding modulation — *solid siblings placed inward of this parent* — already restricts it in
roughly the right way. **B8 must state which denominator it asserts against.**

### 4b. ⭐ NEW: B8's two acceptance assertions are barely co-satisfiable

Plan §3 B8 asserts **both**: Band A per terrestrial planet inside `[0.022, 0.25]`, **and** Band A
per system inside `6.7–25%`. At the measured 3.1357 solid planets per system those are not
independent:

| per-planet rate | ⇒ per-system rate |
|---|---:|
| 2.2% (clamp floor) | 6.74% |
| **8.3% (Elser central)** | **23.79%** |
| 8.766% | 25.00% ← per-system ceiling |
| 25% (clamp ceiling) | 59.43% |

The two assertions hold together **only for per-planet ≤ 8.766%**. Elser's central value clears the
ceiling by **0.466 percentage points**. ⛔ B8 must not discover this by going red; it is stated
here so the resolution is a deliberate choice — widen the per-system band, narrow the clamp, or
assert only one of the two.

### 4c. Baseline rates B5 must move

From the census on FENCE-221 — the control column for B8:

| quantity | today | B5 target |
|---|---:|---|
| Band A bodies (0.2–0.7 R⊕, solid parent) | **2 / 794**, neither on a terrestrial parent | ~23.8% of systems carry ≥1 |
| Band B bodies (> 1 R⊕) | 51 / 794 (gas-giant 50, hot-jupiter 1) | Hansen-anchored, set in B8 |
| `m̄` (per system) | **3.5928** | unchanged in kind; recount after the count law |
| sibling-order inversions | **57 / 292** | **0** (ordered by construction) |
| Roche violations | **0 / 794**, min a/R_roche 2.439 | 0 — already clean |
| moons outside Domingos limit | **49**, 17 unbound outright | 0 |
| `P(zero moons \| gas giant)` | **12.70%** | ~0 (C1 does not roll) |

⛔ `m̄ = 3.69` appears in the plan and reproduces on **no corpus** (3.5928 FENCE-221 / 3.7453 /
4.0510). Do not re-import it.

---

## §5 — The re-bless surface

**Commands exist (4):**
- `tests/baseline/body-identity.json` — `npm run test:body-identity:rebless` (also clears NEGATIVE CONTROL)
- `tests/baseline/port-uniform-capture.json` — `node tools/port-uniform-delta.mjs --record --force` (refuses without `--force`, exit 65)
- `tests/baseline/known-failures.json` — `npm run test:baseline:record` ⚠ clean tree only
- `src/generation/__tests__/__fixtures__/l0-moon-baseline.json` — `regen-l0-moon-baseline.mjs`

**No mechanism exists (3):**
- `moon-rng-stream-identity.test.js` — `PINNED_STREAM_SET` (`:133-198`), `POPULATION` (`:226`), `PARTITION`/`DISJOINTNESS` (`:282-290`), `ORPHANS` (`:349-356`)
- `moon-condition-contract.test.js` — ~35 literals on MC-197, **not** FENCE-221
- `body-identity-fence.test.js` — six literals `WD_REBLESS_BODY_IDENTITY` does not rewrite: `PLANET_CLASS_MOONS` (`:288-293`), population (`:687`), `onDisk` (`:697`), `moonShapeCensus` (`:777-780`), `hiddenBodyKeys` (`:787`), `bakeMisses` (`:804`)

⛔ `moon-condition-contract.test.js:528-542` — the parameter-free composition identity gate — reads
**green straight through the `compSeed` reshuffle** and **must not be cited as evidence the reorder
was safe.**

⛔ Per [`world-engine-reconciliations-2026-08-15.md`](world-engine-reconciliations-2026-08-15.md):241,
*"plain moons stay 0/770"* is now a **failure** statement. `body-identity-fence.test.js:740`'s
literal must be edited to the §3a partition, not defended.

---

## §6 — Open risks and unmeasured surface

1. **Steps 3–9 are entirely tier D.** Only step 2 is measured. The partition saturates immediately,
   so B4 gives B5 far less audit power than C7's table gave its change. Stated plainly rather than
   dressed up.
2. **A single `p` reproducing both Jupiter (spread across four) and Saturn (Titan at 95%) may not
   exist.** The plan names this; nothing here reduces it.
3. **The 770 plain moons have no visual gate.** They render through `Moon.js`, which has zero
   worldengine imports; Instrument C's P stratum harvests only `isPlanetMoon` bodies. A green
   Instrument C says nothing about them.
4. **Instrument A's baseline was recorded from a dirty tree** at `3800dff`. Inherited.
5. **Three constants are unpinned:** the potato-radius threshold (blocks B9) and C3's and C4's
   normalisation constants (set by measurement in B8, not by taste).
6. ⭐ **Binary planets — scoping has since RULED, and it recommends folding them into this
   window.** See [`binary-planets-scoping-2026-08-17.md`](binary-planets-scoping-2026-08-17.md).
   Summary of what it means for B4:

   - **Route M** — the companion is delivered through `planets[i].moons[]` as a planet-class
     record, built by the existing builder, with **zero renderer changes**. Its instrument toll
     *is* B5's toll: the same literals get different numbers, no additional files.
   - **§3a's partition therefore gains companions**, and `planetClassMoons` stops being 24.
     `moonShapeCensus.planetClass.records` becomes `24 + N`, with `shapes` still **1** — the
     companion must reuse the existing 20-key shape, not invent one.
   - ⛔ **N is not yet knowable.** It depends on the mass-ratio threshold, which is Max's call
     (scoping §8 Q1) and is not made. Measured today: the generator produces **zero** bodies above
     `q = 0.25` and **one** at Pluto–Charon's `q = 0.122` across 192 seeds, so the channel must
     *create* bodies — reclassification is dead.
   - ⭐ **Attribution is preserved if and only if the channel selector is a deterministic
     zero-draw hash.** Then the exact `(seed, planet)` coordinate list is computable read-only
     *before* any generator code exists, and B4 states it as a **separate line item** — so a wrong
     binary rate and a wrong moon-mass sampler cannot produce the same red.

   ⛔ **B4 MUST BE AMENDED with that coordinate list and the revised partition BEFORE B5 runs.**
   This document as committed predicts the moon window *without* binaries. Running B5 with
   binaries against this version forfeits the attribution the prediction commit exists to buy.

7. **`material-parity-list.test.js`'s `withMoons 228` / `moons 456` (`:290-291`) move under B5
   alone**, and that file is **absent from the plan's B7 re-derivation list**. Add it.

---

## §7 — What would falsify this document

Stated so B5 cannot quietly pass:

- Step 2 producing anything other than `{systems: 0, planets: 502, plainMoons: 770, planetClassMoons: 24}`.
- DRAW STREAM going **red** on step 2 — that means a draw leaked into the shared stream and the
  re-key was not draw-neutral.
- `planets` reading anything other than **502 at steps 2–6** — the alias analysis in §2b is then
  wrong. (After step 7 it must **rise**; a figure still at 502 means the count law moved nothing.)
- `plainMoons` still reading exactly 770 **after step 7** — the count law did not take effect.
- RECORD SHAPE reporting `shapes: 2` at the end of the window — a conditional append shipped.
- Instrument C exiting 1 rather than 2 — the population did not move, so B5 did not do its job.
- Any Band A rate asserted in B8 without naming which denominator it used (§4a).
