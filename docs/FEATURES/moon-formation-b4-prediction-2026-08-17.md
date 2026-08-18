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
| `systems` | **0 / 221** — ⛔ **SUPERSEDED by §8.5: 27 / 221 once binaries are in the window** | no system scalar is touched *by the moon steps*; but `body-identity-fence.test.js:376` puts the moon COUNT inside the per-seed `system` object, so a companion moves this arm and nothing else in regime 1 does — which makes it the binary line item's attribution channel |
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

   ⛔ **B4 MUST BE AMENDED with that coordinate list and the revised partition BEFORE B5 runs.** ✅ **DONE 2026-08-18 — §8.** `N = 27` on FENCE-221 at `p = 0.0335`; coordinate list at §8.4.
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
- `planets` reading anything other than **521 at steps 2–6** (⛔ **502 in the pre-§8 reading**) — the alias analysis in §2b is then
  wrong. (After step 7 it must **rise**; a figure still at 502 means the count law moved nothing.)
- `plainMoons` still reading exactly 770 **after step 7** — the count law did not take effect.
- RECORD SHAPE reporting `shapes: 2` at the end of the window — a conditional append shipped.
- Instrument C exiting 1 rather than 2 — the population did not move, so B5 did not do its job.
- Any Band A rate asserted in B8 without naming which denominator it used (§4a).

---

## §8 — ⭐⭐ THE BINARY LINE ITEM. Added 2026-08-18. This section is what unblocks B5.

§6 item 6 said this document *"MUST BE AMENDED with that coordinate list and the revised partition
BEFORE B5 runs."* This is that amendment. It is appended rather than woven in, because
`docs/SYSTEMS/generation/README.md` cites this file at `:14`, `:39-49`, `:130` and `:229` — Rule 9,
line-count neutrality. **Nothing above line 374 moved.**

**Method.** A detached probe worktree at `65d3bb5` (`/home/ax/wd-b5-probe`, `node_modules` and
`vendor/motion-test-kit` symlinked from the main tree), never `~/projects/well-dipper` — a dev
server has been serving that tree on `:5173` for five days. Two line-count-neutral `src` stamps were
needed and are **observation only**, never part of the design: `_preType` at
`StarSystemGenerator.js:567` (the type an in-loop eligibility read sees, before
`ExoticOverlay` retypes) and `_probeSeed`/`_probeOrdinal` at `ExoticOverlay.js:401` (because the
overlay *strips* `_systemSeed`/`_ordinal` — see §8.7 trap 1).

⭐ **The probe is committed, at `tools/binary-yield-probe.mjs`, and not archived to `scratchpad/`.**
`binary-planets-scoping-2026-08-17.md` §4 says its own probe is *"archived at
`scratchpad/probe-binary-criteria.mjs`"*; **that file does not exist** — the convention lost the
evidence inside a day. This is a prediction commit, and a prediction nobody can re-derive is worth
less than no prediction. The tool carries both stamps in its header as runnable `sed` one-liners, and
⛔ **without `--stamped` it refuses to print a coordinate list and exits 3**, naming every planet
whose key it could not resolve — because a list short by an unknown number of rows is worse than no
list. `node tools/binary-yield-probe.mjs --stamped` reproduces §8.3 and §8.4 exactly.

**Tier, per §0:** everything in §8.1 through §8.6 is **M — MEASURED**, except the declared fraction
`p` itself, which is **T — TARGET** and named as authored. §8.7 is M. Every count carries its corpus.

---

### 8.1 — The selector, stated exactly

```js
// zero draws. No SeededRandom instance — see §3 Rule 2 of docs/SYSTEMS/generation/README.md.
const BINARY_PAIR_RATE = 0.0335;
const eligible = !GIANT_PARENT_TYPES.has(planetData.type);           // MoonGenerator.js:29
const selected = eligible
  && namespacedFloat(`binarypair:${planetData._systemSeed}:${planetData._ordinal}`) < BINARY_PAIR_RATE;
```

Evaluated **inside the planet loop, immediately after the moon loop closes** —
`StarSystemGenerator.js:599` is the loop's closing brace, `:601` is `const wrapper = {`. Both stamps
the key needs are already set, at `:566` `planetData._systemSeed = seed;` and `:567`
`planetData._ordinal = i;`.

⛔ **Correction to the scoping doc.** `binary-planets-scoping-2026-08-17.md` §5 fact 3 offers a
second site, *"any post-loop emission after `:806`"*. Two things are wrong with it. The trojan `if`
closes at `:806` but its `for` closes at `:807`, so an emission "after `:806`" is still **inside the
trojan loop body**; and the site is in any case observationally identical to the in-loop one, because
the only type write between them is `:662` `migrantInSurviving.planetData.type = 'hot-jupiter';`,
whose subject is fenced to gas giants at `PhysicsEngine.js:541` — **giant → giant, never crossing the
eligibility boundary.** The fork that matters is not A-vs-B; it is A/B vs anything after
`ExoticOverlay.apply` (`:921`), which is fatal for three separate reasons (§8.7).

#### ⛔ USE `namespacedFloat`, NOT `fnv1aString`. The handoff offered both. They are not equivalent.

`MoonGenerator.js:578-587` is module-private; **lift it**, do not copy `moonecc:`'s mechanism
(README §3 Rule 3). The alternative the handoff named — `fnv1aString` from
`vendor/motion-test-kit/core/hash/fnv1a.js`, already imported at `scene-naming.js:20` — **fails on
this key family, and a uniformity histogram will not tell you so.**

Measured over `wd-0`…`wd-2999` (12 583 planets, 9 578 adjacent-ordinal pairs), at `p = 0.0335`:

| | `fnv1aString(k)/2³²` | `namespacedFloat(k)` (xmur3) |
|---|---:|---:|
| companions selected | 306 | 296 |
| χ²(49) marginal uniformity, 50 bins | 26.57 — **passes** | 35.12 — **passes** |
| **distinct within-system gap values, 9 578 pairs** | **8** | **9 132** |
| top two gaps | **0.14848 (n=3605), 0.85152 (n=3594)** | 3, 3 |
| systems with 2 companions | **0** | 13 |

For a single-digit `_ordinal` the FNV-1a tail reduces to `h = (h_prefix ⊕ c)·P²`, and
`P² mod 2³² = 637 696 617 = 0.148475·2³²` — the measured 0.14848 gap, derived two ways. So every
planet in a system sits on a **fixed lattice of eight rungs**, and the channel acquires a property
nobody chose: *no system can ever contain two binary pairs*. The binomial expectation at this `p` is
~10 such systems per 3 000; xmur3 gives 13, FNV gives 0. ⭐ **The marginal distribution is fine on
both — the failure is entirely in the joint structure, which is exactly the banding
`namespacedFloat`'s own docstring (`:571-573`) says the hash exists to prevent.**

---

### 8.2 — The declared fraction `p`, and its weakest joint

`p = 0.0335` — a **fraction of solid planets**, evaluated once per planet, **not** a fraction of
systems and not of all planets. The denominator is **693 of 961** on FENCE-221
(`moon-census-baseline-2026-08-15.md:197`, `:233`: mean 3.1357 solid planets per system;
reproduced by the probe to the digit).

**Derivation.** Bisection of `P = (1/N)·Σ_s [1 − (1−p)^{k_s}]` against a per-system target of 10%,
over the measured solid-planets-per-system histogram on FENCE-221
(`0:10 · 1:27 · 2:38 · 3:57 · 4:47 · 5:26 · 6:12 · 7:3 · 8:1`, 211 of 221 systems carry ≥1 solid
planet — a quantity **the tree does not measure anywhere**; `moon-census.mjs:345` publishes only
`meanSolidPerSystem`, and `:346`'s histogram is built at `:339-340` from `terrestrialPerSystem`). Result:
`p = 3.3497%` → **0.0335**. For Lazzoni's 14.3% the same bisection gives 4.8994%.

⚠ **§4a and §4b use the concave approximation of that conversion, and it shifts §4b's finding to
the other end of the band.** Both apply `P̃ = 1 − (1−p)^k̄` with `k̄ = 3.1357` — averaging `k` and
*then* exponentiating. `x ↦ 1−(1−p)^x` is concave, so by Jensen `P ≤ P̃` always: the mean form
**overstates** the per-system rate. Recomputed exactly over the histogram above:

| per-planet `p` | §4a/§4b's `P̃` | exact `P` |
|---:|---:|---:|
| 2.2% — the clamp floor | 6.7379% | **6.6791%** |
| 8.3% — Elser central | 23.7921% | **23.0643%** |
| 8.766% — §4b's stated ceiling | 24.9999% | 24.1968% |
| **9.1005% — the exact ceiling** | 25.8588% | **25.0000%** |

§4a's headline is unaffected in kind — 23.06% is still inside the plan's 6.67–25% bracket, so **there
is still no `_pickType` defect.** §4b moves in two directions at once, and ⛔ **neither is "the
finding does not survive":**

- **At the ceiling it gets easier.** The co-satisfiable per-planet band is `[2.2071%, 9.1005%]`, not
  `[2.2%, 8.766%]`. Elser's 8.3% clears the ceiling by **0.8005 pp** rather than 0.466 pp. §4b's
  *"barely co-satisfiable"* is **refined, not refuted**.
- ⛔ **At the floor it gets harder, and §4b did not look there.** The clamp floor `p = 2.2%` maps to
  **6.6791%** per system — **below** B8's 6.7% per-system floor, by 0.021 pp. On the mean form it
  read 6.7379% and passed. **The tension §4b located at the ceiling actually sits at the floor**, and
  it is a floor a legitimate calibration can land on.

⛔ **B8 redoes the co-satisfiability arithmetic on the exact form, and states which end binds.**
Recorded here rather than patched into §4b, because §4b is cited by line from
`docs/SYSTEMS/generation/README.md:459`.

**The weakest joint, named.** Ochiai et al. 2014's ~10% counts **systems undergoing orbit crossing**
— the *opportunity* for pair formation, not the yield of surviving pairs — and both it and Lazzoni's
14.3% are **gas-giant-only**, while this channel's denominator is the *complement* of gas giants.
Converting one to the other is the same species of category error as the SECOND FINDING withdrawn in
§4a, with a second error stacked on it (event → outcome) for which no change of denominator helps.
**`p` is therefore an authored constant with a literature-shaped ceiling, not a derived one** — the
same status the plan gives C3's and C4's normalisation constants, which §3 B8 sets by measurement.
⛔ **Do not read "10% of systems" as a prediction of this document.** §8.3 predicts integers.

---

### 8.3 — Yield per corpus, at `p = 0.0335`. MEASURED.

`N` = companions created · `S` = seeds carrying ≥1 · `Z` = of those companions, the ones whose parent
had **zero** moons before the append (this is the number that moves the `planets` arm beyond §3a's
502). Eligibility read on the **in-loop** type, per §8.1.

| Corpus | systems | planets | eligible parents | **N** | **S** | **Z** | planet-class moons | total moons |
|---|---:|---:|---:|---:|---:|---:|---|---|
| **FENCE-221** | 221 | 961 | 693 | **27** | 27 | 19 | 24 → **51** | 794 → **821** |
| **MC-197** | 197 | 838 | 593 | **22** | 22 | 16 | 23 → **45** | 728 → **750** |
| **PCC-120** | 120 | 526 | 396 | **17** | 16 | 9 | 12 → **29** | 411 → **428** |
| **LAB-PROCEDURAL-200** | 200 | 852 | 628 | **16** | 15 | 5 | 17 → **33** | 649 → **665** |
| BULK-221 (cross-reference) | 221 | 948 | 671 | 23 | 23 | 17 | 26 → **49** | 829 → **852** |

Every "today" column above was reproduced by the probe before anything was predicted from it: 961 /
794 / 770 / 24 matches `body-identity-fence.test.js:687`; 705 + 23 matches MC-197's row in
README §5; 526 matches `port-condition-contract.test.js:286`; 948 / 803 / 26 matches BULK-221.
⭐ **PCC-120's 411 moons / 12 planet-class — which README §5 records as "Not found: a code-level
assertion" — are now measured.** And the probe reproduces this document's own **502** moon-bearing
planets on FENCE-221, independently of §2b's route, which is the fourth derivation of that number.

⛔ `N_mc ≠ a subset of N_fence`. MC-197 drops the 24 `gc-*` seeds, so it is 838 planets against 961,
not a sub-selection of the same records.

---

### 8.4 — The FENCE-221 coordinate list. This is the falsifiable artefact.

Stated in the fence's own coordinate form, `seed/pi/mi` (`body-identity-fence.test.js:477`
`planetClassMoons.push(\`${seed}/${pi}/${mi}\`);`). `mi` is the parent's pre-existing moon count,
because the companion is appended last.

⛔ **`pi` is the FINAL index in `planets[]`. The selector keys on `_ordinal`. They are not the same
number** — migration re-sorts (`:666-667`) and the binary-stability cull re-packs (`:724-726`)
without restamping, and they disagree on **18 of 961 planets across 6 systems** on FENCE-221 today.
None of the 27 below happens to land on one, which is luck, not structure: a different `p`, or B5
step 7's population change, will produce one. Both are given.

| # | fence coord | `_ordinal` | parent type | parent R⊕ / M⊕ | h | existing moons |
|---|---|---:|---|---|---|---:|
| 1 | `wd-10/3/0` | 3 | ice | 1.0781 / 1.1889 | 0.001397 | 0 |
| 2 | `wd-17/3/0` | 3 | carbon | 0.4313 / 0.0401 | 0.004996 | 0 |
| 3 | `wd-20/5/1` | 5 | ice | 1.0203 / 0.9693 | 0.009569 | 1 |
| 4 | `wd-27/1/0` | 1 | lava | 0.8274 / 0.4464 | 0.027577 | 0 |
| 5 | `wd-29/0/0` | 0 | carbon | 0.4284 / 0.0391 | 0.001640 | 0 |
| 6 | `wd-30/5/1` | 5 | ice | 0.7175 / 0.2636 | 0.027575 | 1 |
| 7 | `wd-31/5/0` | 5 | carbon | 0.5020 / 0.0703 | 0.001012 | 0 |
| 8 | `wd-34/0/0` | 0 | venus | 0.9793 / 0.8329 | 0.015589 | 0 |
| 9 | `wd-35/2/0` | 2 | venus | 1.0920 / 1.2466 | 0.002207 | 0 |
| 10 | `wd-36/2/0` | 2 | rocky | 0.3187 / 0.0131 | 0.029857 | 0 |
| 11 | `wd-53/2/0` | 2 | venus | 1.1401 / 1.4622 | 0.028204 | 0 |
| 12 | `wd-82/2/0` | 2 | ice | 0.6485 / 0.1812 | 0.004137 | 0 |
| 13 | `wd-91/2/0` | 2 | ice | 1.1741 / 1.6301 | 0.028188 | 0 |
| 14 | `wd-121/0/0` | 0 | venus | 1.0579 / 1.1083 | 0.018815 | 0 |
| 15 | `wd-148/1/0` | 1 | venus | 0.9152 / 0.6483 | 0.032053 | 0 |
| 16 | `wd-153/2/1` | 2 | rocky | 0.4245 / 0.0378 | 0.020532 | 1 |
| 17 | `wd-161/4/1` | 4 | ice | 1.1002 / 1.2816 | 0.024812 | 1 |
| 18 | `wd-166/0/1` | 0 | rocky | 0.5286 / 0.0851 | 0.015037 | 1 |
| 19 | `wd-172/0/0` | 0 | rocky | 0.5009 / 0.0697 | 0.026861 | 0 |
| 20 | `wd-174/1/0` | 1 | rocky | 0.4879 / 0.0632 | 0.010718 | 0 |
| 21 | `wd-181/1/1` | 1 | lava | 0.4373 / 0.0422 | 0.033160 | 1 |
| 22 | **`wd-1403/1/0`** | 1 | **venus → `machine`** | 0.9575 / 0.7665 | 0.012067 | 0 |
| 23 | `gc-0/3/0` | 3 | ice | 0.5979 / 0.1342 | 0.025804 | 0 |
| 24 | `gc-7/5/0` | 5 | ice | 0.9766 / 0.8246 | 0.021031 | 0 |
| 25 | `gc-9/1/1` | 1 | rocky | 0.7612 / 0.3279 | 0.001529 | 1 |
| 26 | `gc-19/4/1` | 4 | ice | 0.5441 / 0.0947 | 0.032376 | 1 |
| 27 | `gc-22/1/0` | 1 | rocky | 0.7923 / 0.3802 | 0.031045 | 0 |

Row 22 is bolded because it is the one that detonates (§8.7 traps 2 and 3).

`PLANET_CLASS_MOONS` (`:288-293`) becomes these **51** strings, in `captureAll`'s walk order:

```js
'wd-10/3/0', 'wd-11/2/2', 'wd-15/6/1', 'wd-17/3/0', 'wd-20/5/1', 'wd-24/1/2', 'wd-27/1/0',
'wd-27/3/1', 'wd-29/0/0', 'wd-30/5/1', 'wd-31/5/0', 'wd-34/0/0', 'wd-35/2/0', 'wd-36/2/0',
'wd-40/4/4', 'wd-53/2/0', 'wd-61/1/2', 'wd-66/0/1', 'wd-70/5/5', 'wd-82/2/0', 'wd-91/2/0',
'wd-100/5/1', 'wd-101/4/2', 'wd-116/5/1', 'wd-121/0/0', 'wd-126/4/3', 'wd-133/4/3',
'wd-133/4/4', 'wd-147/1/2', 'wd-148/1/0', 'wd-153/2/1', 'wd-161/4/1', 'wd-161/5/1',
'wd-166/0/1', 'wd-166/3/1', 'wd-166/3/5', 'wd-168/3/1', 'wd-172/0/0', 'wd-174/0/1',
'wd-174/1/0', 'wd-181/1/1', 'wd-187/2/1', 'wd-189/0/1', 'wd-1403/1/0', 'wd-1403/2/2',
'gc-0/3/0', 'gc-7/5/0', 'gc-9/1/1', 'gc-19/4/1', 'gc-22/1/0', 'gc-22/2/2',
```

---

### 8.5 — The revised partition, and every literal that moves

#### ⭐⭐ The `systems` arm is the attribution channel. §3a was wrong to write it off.

§3a predicts `systems: 0 / 221` for the whole of regime 1 — *"no system scalar is touched."* True of
the moon window. **False the moment a companion exists.** `body-identity-fence.test.js:376` puts
`moons: entries.reduce((a, e) => a + (e.moons?.length || 0), 0)` inside the per-seed `system` object,
and `:716` compares `JSON.stringify(now.system) !== JSON.stringify(was.system)` → `moved.systems++`.

⭐ **So across B5 steps 2–6 and 9 — the entire fixed-population regime — `moved.systems` moves for
exactly one reason, and that reason is binaries.** A wrong moon-mass sampler cannot touch it; a wrong
composition re-key cannot touch it; a wrong binary rate moves it by exactly `S`. This is a cleaner
separation than §6 item 6 asked for, and it is the line item's primary gate. It stops being clean at
step 7, which changes moon counts and therefore the same field.

#### The partition literal (`:740-742`), in the two readings B5 needs

| reading | `systems` | `planets` | `plainMoons` | `planetClassMoons` |
|---|---:|---:|---:|---:|
| today's literal | 0 | 0 | 0 | 0 |
| §3a, moon window only (no binaries) | 0 | 502 | 770 | 24 |
| **Route M alone** (binaries, no other B5 step) | **27** | **27** | **0** | **27** |
| **§3a + Route M, regime 1** | **27** | **521** | **770** | **51** |

`planets: 521 = 502 + 19`. The 502 are §2b's moon-bearing parents, already moved by the `moonecc:`
re-key. The **19** are moonless solid parents whose `systemContext.moons` goes `[] → [companion]`:
`:947-952` builds that summary from `entry.moons`, `:972` writes it onto `planetData`, and
`planetRecord` (`:190-194`) excludes only `WORLDENGINE_BAKES`, so it is hashed. ⛔ **The bound in §3a
— "`planets` reading anything other than 502 at steps 2–6 means the alias analysis is wrong" — is
superseded for the binary-bearing window: 521 is the correct figure and 502 is now the failure.**

#### ⛔ The partition classifies moons by the LITERAL, not by `isPlanetMoon`

⚠ **The `:732` below is off by one — the classifier is `:733`. Corrected in §8.10.**

`:705` `const planetClass = new Set(PLANET_CLASS_MOONS);` and `:732`
`if (planetClass.has(key)) moved.planetClassMoons++; else moved.plainMoons++;`. A companion
coordinate absent from `:288`'s literal is therefore counted as a **plain** moon. **The `:288`
amendment and the `:740` amendment must land in the same commit**, or B4's prediction and the fence's
report will disagree by exactly `N` in both arms while the code is correct.

#### The rest of the fence's six non-reblessable literals

| line | today | after Route M | why |
|---|---|---|---|
| `:687` | `{planets: 961, moons: 794, plain: 770, planetClass: 24}` | `{planets: 961, moons: 821, plain: 770, planetClass: 51}` | `plain` is derived at `:683` as `moonCount − planetClassMoons.length`; both terms rise by `N` and cancel |
| `:697` | `onDisk {planets: 961, moons: 794}` | `{planets: 961, moons: 821}` — **but only after the re-bless.** It sums the on-disk JSON (`:693-696`), so it sits green while `:687` is red | |
| `:779` | `planetClass: { shapes: 1, keyCounts: [20], records: 24 }` | `records: 51`; `shapes: 1` / `keyCounts: [20]` hold **only if §8.7 trap 3 is fixed** | |
| `:778` | `plain: { shapes: 1, keyCounts: [25], records: 770 }` | unchanged | |
| `:787` | `hiddenBodyKeys []` | unchanged | the append attaches no non-enumerable |
| `:804` | `bakeMisses 0` | unchanged | `:461` tests `e.planetData` only, never `moon.planetData` |

#### `material-parity-list.test.js` — MEASURED, and it is nearly free

`:288-289` `withMoons 228` / `moons 456` are **not** the LAB-PROCEDURAL-200 corpus totals; they count
only the 341 bodies the lab pipeline admits (`census()` at `:157-190`). Of that corpus's 16
companions, 5 land on an admitted parent and 1 of those was moonless. Probe reproduced
`claimed 343 / provenanceBlocked 2 / swapped 341 / withMoons 228 / moons 456` exactly, then:
**`withMoons 228 → 229`, `moons 456 → 461`.** ⚠ That file's `swapped` means *admitted to the lab
shader pipeline*, and has nothing to do with `ExoticOverlay._swapPlanetType`. Two different senses of
"swapped", one corpus, and conflating them is a live hazard in this lane.

#### `moon-rng-stream-identity.test.js` — ⛔ **THREE of four literals unchanged. `ORPHANS` is not — see §8.10.**

The companion is built from a pure hash and is **not** routed through `MoonGenerator.generate`, so
the shared-stream counter (`:81-89`, which patches the own `rng` property of the single instance per
`generate` call) never sees it. `PINNED_STREAM_SET` (`:133-198`), `POPULATION` (`:226`),
and
`PARTITION`/`DISJOINTNESS` (`:282-290`) stay green. **The single largest non-re-blessable component
of the toll is avoided**, as scoping §5 fact 1 predicted. ⛔ **But `ORPHANS` (`:349-356`) does NOT —
it counts survivors by walking the finished system, so it sees a body `calls` never counted, and
`orphanPlanetClass` goes to −20. §8.10 item 1.**

---

### 8.6 — ⭐ Instrument C: the corpus goes 526 → 633. Nobody had this.

`tools/port-uniform-delta.mjs:219-231` harvests the **P** stratum by sweeping integer seeds
`1…1000` and taking **every** `m.isPlanetMoon && m.planetData` record. A binary companion is exactly
that. Measured (probe reproduces IC-526's published 372 S + 64 P + 90 G = 526 first):

| stratum | today | after Route M |
|---|---:|---:|
| S — integer seeds 1…90 | 372 planets, **178 moon-bearing** | 372 planets, **184 moon-bearing** (12 companions, 6 on moonless parents) |
| **P — planet-class moons, seeds 1…1000** | **64** | **171** (+107) |
| G — forced-type grid | 90 | 90 |
| **CORPUS_BODIES** | **526** | **633** |

⛔ **This rewrites §3c.** That section warns that 242 of 526 rows (178 moon-bearing S + all 64 P) will
be *"re-baselined, not verified"* — `0.000000e+0` printed for bodies whose fingerprint moved. After
binaries the figure is **354 of 633**, and the P stratum — the one stratum that exists specifically
because planet-class moons are too rare to harvest from S — **nearly triples**. The structural
POPULATION MISMATCH exit at `:1860` fires on the P count alone, before any moon-window effect.

---

### 8.7 — ⛔ Three traps. Each is measured, each will otherwise be discovered by going red.

**Trap 1 — a post-hoc coordinate list is wrong, and wrong by a knowable amount.**
`ExoticOverlay.js:401` `planetEntry.planetData = newData;` replaces `planetData` wholesale with a
fresh `PlanetGenerator.generate()` result, which carries **no `_systemSeed` and no `_ordinal`** —
the defect already pinned, cause and all, at `tests/gas-body-lab-material.test.js:567`. So the
selector's key **does not exist in the generator's output** for swapped planets. Measured on
FENCE-221: 10 swapped planets, all 10 eligible; recomputing the list from output instead of in-loop
gives **26, not 27** — the missing body is `wd-1403/1`, whose key degrades to
`binarypair:undefined:undefined`. ⭐ **Anyone verifying B5 against §8.4 by walking `generate()`'s
output will file a false failure on exactly one row.** Verify in-loop, or fix the stripping first.

**Trap 2 — `ExoticOverlay` can move a planet giant → solid, and only that direction.**
Three paths have no giant filter: `_applyFungal` puts `sub-neptune` in its candidate list
(`ExoticOverlay.js:176`) and its second arm `hasAtmo || isRocky` (`:182`) admits gas giants;
`_applyHex` filters on orbit only (`:226`) with an any-planet fallback (`:233`); `_applyMachine`
filters on orbit only and *prefers* beyond the frost line (`:255`), which is where giants live. None
of the seven swap-in types is in `GIANT_PARENT_TYPES`, so solid → giant is structurally impossible.
Measured over `wd-0`…`wd-2999`: 165 swaps, **8 cross giant → solid** (`sub-neptune → fungal` ×7,
`gas-giant → machine` ×1), **0 cross solid → giant**. On all four stated corpora the crossing count
is **0** — the populations are too small — so the in-loop and output readings agree there *by
accident*. Reading eligibility off the output type is nonetheless wrong, and B5 must not.

**Trap 3 — ⛔⛔ `wd-1403/1/0` turns `moonShapeCensus.planetClass` into `{shapes: 2}`, and the record
carries a `NaN`.** `ExoticOverlay.js:371-389` rescales **every** moon of a swapped parent, with no
`isPlanetMoon` guard, and its last line is `:389` `moon.massEarth *= kEarth ** 3;`. A planet-class
moon record has **20 keys and no top-level `massEarth`** — mass lives on `planetData.massEarth`
(README §5, "the mass trap"). Six of the seven rescale targets are present; `massEarth` is the one
that is not. **Proven by intervention** on `wd-11`'s planet-class moon: `undefined * k³` → the
property is *created* with value `NaN`, and the record goes **20 keys → 21**, while the real mass
inside `planetData` is left unscaled — so the pair's `q` is silently wrong as well.

This is a **pre-existing latent defect that the binary channel wakes up**: measured today, **0 of 24
planet-class moons sit on an overlay-swapped parent**, which is the only reason
`{shapes: 1, keyCounts: [20]}` is green. `wd-1403/1/0` is the first one ever to. And
`{shapes: 2, keyCounts: [20, 21]}` shares `shapes: 2` with the signature §3b names as *"what a
conditional append produces"* (⚠ §3b's own literal is `[25, 27]`, on the **plain** class — see
§8.10) — so the failure will be read as a channel-model bug when it is an overlay bug.

**Fix it in the same commit as the channel**, alongside the `GravityField._estimateMoonMass` repair
scoping §6 item 4 already requires: guard the rescale loop on key presence, or scale
`moon.planetData.massEarth` for planet-class moons. Either is one line. ⛔ **Do not ship the channel
without it.**

---

### 8.8 — What would falsify §8

- Any row of §8.4 absent from B5's output, or any row present that §8.4 does not list. The list is
  exact, not approximate; `N = 27` on FENCE-221 and there is no sampling error in a hash.
- `moved.systems` reading **0** during regime 1 — the companion is not reaching `entry.moons` before
  the fence's `system` object is built, i.e. the append site drifted past `:601`.
- `moved.systems` reading anything other than **27** on FENCE-221 during regime 1 — the rate is
  wrong, and nothing else in the window can produce that.
- `moved.planets` reading **502** — the companions are not reaching `systemContext.moons`, so the
  append landed after the post-pass at `:935`.
- `moonShapeCensus.planetClass.keyCounts` reading `[20, 21]` — trap 3 shipped unfixed.
- Instrument C's population mismatch reporting a P stratum of **64** — the companion is not carrying
  `isPlanetMoon` or `planetData`, so it is not the record the scoping doc ruled for.
- `PINNED_STREAM_SET` in `moon-rng-stream-identity.test.js` going red — a draw leaked; the selector
  is not the pure hash §8.1 specifies.
- Any figure in §8.3 quoted against a corpus other than the one on its row.

### 8.9 — Two things §8 deliberately does not settle

1. **`p` is authored** (§8.2). B8 sets it by measurement, like C3's and C4's constants. Changing it
   is `node tools/binary-yield-probe.mjs --p=<new> --stamped`, which re-issues §8.3 and §8.4 in the
   shape they are printed here; nothing else in this section depends on the value.
2. **The parent population skews small.** 9 of the 27 FENCE-221 hosts are below 0.1 M⊕, the smallest
   being `wd-36/2` at **0.0131 M⊕ / 0.3187 R⊕**. At the ruled `q ∈ [0.122, ~0.6]` its companion is a
   ~1 400 km body: a binary *dwarf* planet. That is not a defect — Pluto–Charon is the anchor Max
   ruled on, and Pluto is 0.0022 M⊕ — but it is what the channel will mostly produce, and it is a UAT
   question, not a physics one. **No mass floor is applied**; adding one is a one-line eligibility
   change and a re-run of §8.3/§8.4.

---

### 8.10 — ⛔ SIX THINGS §8.1–§8.9 MISSED. Found by the verification pass, each re-verified by hand.

§8 as first committed (`1ed1176`) claimed a toll surface that is **incomplete in four files and wrong
in one assertion**. Recorded here rather than patched into §8.5, so the correction has a date and
whoever reads §8.5 first still meets it.

#### 1. ⛔⛔ `ORPHANS` does **not** stay green. It goes NEGATIVE, and the invariant dies.

§8.5 says all four `moon-rng-stream-identity.test.js` literals hold. `PINNED_STREAM_SET`,
`POPULATION` and `PARTITION`/`DISJOINTNESS` do. **`ORPHANS` does not**, and the mechanism is not the
one scoping §5 fact 1 reasoned about:

- `calls` is counted by a wrapper on the method — `:326` `MoonGenerator.generate = function counting(...args)`.
  A companion built without going through `MoonGenerator.generate` is **invisible** to it. That is
  the whole point of the design, and it is what keeps the other three green.
- `survivors` is counted by walking the **finished system** — `:339-341`
  `for (const m of (entry.moons || [])) { survivors++; if (m.planetData) survivingPlanetClass++; … }`.
  A companion **is** visible there.

So at MC-197's `N = 22`: `survivors 728 → 750`, `survivingPlanetClass 23 → 45`, and `:353-356`
computes `orphanPlanetClass = planetClassCalls − survivingPlanetClass = 25 − 45 = ` **−20**.

⛔ **This is not a re-number.** "Orphan" means *a moon whose parent was discarded after generation*,
and the arithmetic assumes `calls ⊇ survivors`. Route M inserts a survivor that was never a call, so
the containment — not the constant — is what breaks. Hand-re-deriving the three literals to make it
green would delete the invariant. **The honest repair is to count appended companions as their own
term**, and it is a mechanism change, so B5 must either make it or say out loud that it did not.

#### 2. ⛔ `StarSystemGenerator.binary-barycentre.test.js` reds on two pins, and it is in no toll list

`:163-174` is a ten-row `PINS` table asserted whole at `:176`, each row carrying a live
`reduce` over `p.moons.length`. Two of its ten seeds are §8.4 rows:

| pin | today | after |
|---|---|---|
| `{ seed: 'wd-10', star: 'M', star2: 'M', planets: 5, moons: 5, belts: 1 }` | `moons: 5` | **6** — §8.4 row 1, `wd-10/3/0` |
| `{ seed: 'wd-27', star: 'O', star2: 'O', planets: 4, moons: 5, belts: 2 }` | `moons: 5` | **6** — §8.4 row 4, `wd-27/1/0` |

Ten hand-written literals, **no re-bless mechanism**, in a file that exists to guard *the binary-star
barycentre fix* and has nothing to do with moons. Its own comment (`:157-162`) explains a red as
"someone tidied the recompute up next to the qRoll," which is exactly the wrong diagnosis here.
**Amend the two rows in the same commit, and say why in the message.**

#### 3. ⛔ `tools/moon-census.mjs` carries a population pin and **exits 3** rather than warn

`:116` `pinned: { seeds: 221, planets: 961, plain: 770, planetClass: 24 },` → `planetClass: 51`.
Enforced at `:828-835`, which prints *"⛔ FENCE-221 DISAGREES WITH ITS PINNED POPULATION. This is a
FINDING, not a nuisance. Do NOT adjust the expected numbers to match. Report it."* and
`process.exit(3)`. Zero `process.env` in the file — no re-bless. It is the referee this lane built
to stop corpus confusion, and after B5 it refuses to run until the pin is amended.

#### 4. `moon-condition-contract.test.js` — §5 says "~35 literals"; these are the ones N moves

Classification route: `:140` `if (m.planetData) planetClass.push(rec); else plain.push(rec);` — the
companion carries `planetData`, so it lands in **`planetClass`**, at MC-197's `N = 22`:

| line | today | after |
|---|---|---|
| `:162` `expect(planetClass.length).toBe(23);` | 23 | **45** |
| `:163` `expect(plain.length + planetClass.length).toBe(728);` | 728 | **750** |
| `:370` `expect(g.length).toBe(23);` | 23 | **45** |
| `:161` `expect(plain.length).toBe(705);` | 705 | **unchanged** |
| `:166` `expect(returned.length).toBe(733);` | 733 | **unchanged** — that count comes off the `MoonGenerator.generate` wrapper, which the companion never enters |

#### 5. ⚠ `ProcgenSnapshot.test.js` — one companion, and one filter I did not evaluate

`:81` `expect(JSON.parse(JSON.stringify(regenerated))).toEqual(sample.systemData);` — whole-system
deep equality against a committed fixture. One companion falls inside the fixture's 24 samples
(`star.seed 592560942`, planet index 2, `carbon`, `h = 0.003969`). ⚠ **Tier: ASSERTED, not measured** —
the test first filters through `:63` `const active = snapshot.samples.filter(`, and whether that
sample survives the real-coverage exclusion was not checked. A re-bless exists
(`scripts/capture-procgen-snapshot.mjs`).

#### 6. ⭐⭐ The ruled `q ≥ 0.122` is **unreachable** with the builder scoping §6.2 requires

This is a design consequence, not a toll item, and it is the one that would have been discovered
mid-B5. Scoping §6 asks for two things at once: item 2, *"built by the existing planet-class-moon
builder so the 20-key shape is unchanged"*; item 3, *"mass derived to a target `q`."*

The builder sizes the body as a fraction of its parent — `MoonGenerator.js:381`
`const fraction = rng.range(0.10, 0.25);` — and derives mass from that radius at its **own**
generated type's density: `:418`
`const massScale = pData.radiusEarth > 0 ? (radiusEarth / pData.radiusEarth) ** 3 : 1;`. So

> `q = (ρ_companion / ρ_parent) · f³`

Confirmed on `wd-11`'s planet-class moon: `q / f³ = 1.2093`, and the measured density ratio
`4.6962 / 3.8843 = 1.2090`. **The maximum `q` the shipped sampler can produce is
`0.25³ = 0.015625` times that ratio — about 0.031 even at a generous 2× density ratio, four times
below the ruled floor of 0.122.** Reaching `q ∈ [0.122, 0.6]` needs `f ≈ 0.40–0.84`. ⛔ **The two
ranges do not overlap at any density ratio the generator produces.**

Two things this is **not**, both checked so B5 does not budget for them:

- **Not a Roche or collision problem.** `:387-391` puts a planet-class moon at
  `orbitMultiple ∈ [12, 30] + moonIndex·[3, 8]` parent radii, so even at `f = 0.84` the separation
  is `a / (R₁ + R₂) ≥ 6.5`.
- **Not a density-gate problem.** The companion's density is its own generated type's and is
  **invariant in `f`** (the `f³` cancels), so `moon-condition-contract.test.js:374-378`'s
  `2.0 < g/cc < 7.0` band is untouched by widening the fraction. ⛔ It **would** be violated by the
  other route — keeping `f` and forcing `massEarth` up to hit `q` — which is the obvious
  implementation and the wrong one.

**So the resolution is: widen the radius fraction on the companion path only, and leave the mass law
alone.** That changes no key, so scoping §6.2's shape constraint survives intact — but §6.2's
"existing builder, untouched" reading does not, and B5 must say which it did.

#### Two corrections to §8 itself

- §8.5 cites `:732` for the partition's moon classifier. `:732` is the `cls` label; the classifier is
  `tests/body-identity-fence.test.js:733`
  `if (planetClass.has(key)) moved.planetClassMoons++; else moved.plainMoons++;`. The substance —
  `:288` and `:740` must land in one commit — is unaffected.
- §8.7 trap 3 says `{shapes: 2, keyCounts: [20, 21]}` is *"precisely the signature §3b names."*
  Overstated: §3b's literal is `{shapes: 2, keyCounts: [25, 27]}`, on the **plain** class. Only
  `shapes: 2` is shared. The misdiagnosis risk is real; the wording was not.

#### Added to §8.8 — what would falsify §8

- `ORPHANS` reading `orphanPlanetClass: 2` after B5 — the companion **is** being routed through
  `MoonGenerator.generate` after all, so the selector is not the zero-draw hash §8.1 specifies and
  `PINNED_STREAM_SET` should be red too.
- `world-engine-l0-plumbing.test.js:310`
  `expect(body.systemContext.moons.length).toBe(entry.moons.length);` staying **green** proves
  nothing about the append site: measured over its 3 seeds, **0 of 10 eligible parents are selected**
  at `p = 0.0335`. §8.8's `moved.planets` falsifier is the real placement gate; this one is inert.
- `componentSystems.byteSafety.test.js:104` `expect(sirius).toEqual(FIXTURE('sirius-baseline.json'));`
  going red at `p = 0.0335` — it must not. Its fixture's eligible parent (`planets[1]`, `rocky`,
  `_ordinal` **2** — another live instance of §8.4's index-vs-ordinal warning) hashes to
  **0.120329**, so it is not selected. ⚠ It reds at any `p > 0.1204`.

---

### 8.11 — ⭐⭐ B5.0 LANDED. Measured against §8, same day. Tier M.

The binary channel shipped **alone**, before B5 steps 1–9, for one reason: §8.5's Route-M-alone
partition is the only exact, separable prediction this window has, and it stops being checkable the
moment step 2 saturates the arms. It is checked below and it holds.

#### What matched, exactly

| §8 said | live at B5.0 | |
|---|---|---|
| population `{planets 961, moons 821, plain 770, planetClass 51}` | identical | ✅ |
| `PLANET_CLASS_MOONS` → 51 entries, §8.4's list, in `captureAll` walk order | 51 / 51, **zero missing, zero unexpected, order byte-identical** | ✅ |
| `moonShapeCensus.planetClass` → `{shapes: 1, keyCounts: [20], records: 51}` | RECORD SHAPE's only diff is `records: 24 → 51`; shapes and key counts unmoved | ✅ |
| `orbitRadiusScene` = full parent-relative separation (Convention A) | inherited from the reused builder, so it could not be otherwise | ✅ |
| `q ≥ 0.122`, centred ~0.3–0.6 | min **0.1656** · median **0.4490** · max **0.7701**; zero below the floor | ✅ |
| §8.6: Instrument C's corpus `526 → 633` | `bodies in capture : 526   now: 633`, and it exits **2** on `POPULATION MISMATCH` — the trigger §3c named, before `--allow-deltas` can be reached | ✅ |

Measured `f = R_companion / R_parent` spans **0.523 – 0.950**, confirming §8.10 item 6's arithmetic
from the other direction: the builder's shipped `[0.10, 0.25]` could not have produced any of it.
⚠ The upper end is the **0.95 clamp**, not the sampler — a companion may not exceed 0.95 of its
primary, so the realised `q` is compressed against `BINARY_Q_MAX` and the top of the band is not
reachable at a low density ratio. Deliberate; stated so B8 does not read the ceiling as a target miss.

#### ⛔ What §8 got wrong, by one seed — and the reason matters more than the number

§8's `generateBinaryCompanion` docstring predicted *"DRAW STREAM reds on exactly the seeds carrying a
companion, +2 instances each."* Measured: **28 seeds, not 27**, every one of them `+2` exactly
(`(N → N+2)`, `total X → X+2`, no exceptions across all 28).

The extra is `wd-170`, and it carries **no companion at all**. Its `_ordinal` 4 passes the hash gate,
the companion is built — and migration then destroys 4 of its planets (`scatteredCount: 4`, leaving
ordinals 0 and 3). **The build cost is paid before the cull.** So:

> the DRAW STREAM red set is *companions **built***; the coordinate list is *companions **shipped***.
> They differ by the planets migration and the binary-stability cull remove after their moons exist.

⭐ This is the same accounting README §5 already records for moons (*"5207 calls vs 4861 records —
migration-scatter and binary culling discard whole planets after their moons are built"*), arriving
in a channel that was designed to be draw-free and is not quite. **A future reader must not
"fix" the 28 back to 27.**

The `+2` itself is not a defect and cannot be designed away while scoping §6.2's "reuse the existing
builder" holds: `PlanetGenerator.js:392` `const eccRng = new SeededRandom(eccSeed);` and
`MoonGenerator.js:358`'s `moonecc:` construction each build a fresh instance, and Instrument B's
DRAW STREAM counts every `SeededRandom` in the process. Both are grandfathered for bodies that
existed at Step 0; neither is for a body created today.

#### ⛔ And a correction to §2c, measured

§2c says NEGATIVE CONTROL fails under any population move, because `:845` asserts a fresh capture
reproduces the stored baseline. **It is green at B5.0.** The control is scoped to a single seed —
`:824` `const seed = 'wd-0';` — and `wd-0` carries no companion. So the channel that proves the fence
can still *detect* a change survives any population move that misses `wd-0`. §2c's warning holds for
the moon window (which moves every seed); it does not generalise.

#### Instrument B at B5.0 — the full signature, named individually

| test | result |
|---|---|
| the seed list on disk is the seed list in this file | ✓ |
| still covers every generation class it was built to cover | ✓ |
| is measuring the same code path production runs | ✓ |
| **DRAW STREAM** | ✗ — 28 seeds, all `+2` |
| **BODY IDENTITY** | ✗ |
| **RECORD SHAPE** | ✗ — `planetClass.records 24 → 51` only |
| the excluded world-engine bakes are still present | ✓ |
| **NEGATIVE CONTROL** | **✓ GREEN** — see above |

⚠ **A third distinct signature.** C7 failed DRAW STREAM + BODY IDENTITY; step 2 fails BODY IDENTITY +
NEGATIVE CONTROL with DRAW STREAM green (§2c); B5.0 fails DRAW STREAM + BODY IDENTITY + RECORD SHAPE
with NEGATIVE CONTROL green. Matching any one against another misreads all three.

#### Shipped in the same commit, both required rather than optional

- `GravityField._estimateMoonMass` now reads `moonData.planetData?.massEarth` first, and the stale
  comment at `:148-149` is corrected. Scoping §6 item 4 called this required once a pair exists; a
  planet-class moon's top-level `type` is a *planet* type, so `rocky`/`ocean`/`ice` all missed the
  branch and the flight model was handed a mass the generator never chose.
- `ExoticOverlay.js`'s moon rescale no longer assigns `moon.massEarth` when the key is absent —
  §8.7 trap 3. It scales `planetData.massEarth` instead. Without this, `wd-1403/1/0` would have
  taken the planet-class record to 21 keys with a `NaN`.

#### Still open at B5.0 — deliberately left red

The instruments stay red until B7, per the plan. Not yet amended, and each is a hand-derivation:
`body-identity-fence.test.js:288`/`:687`/`:740`/`:779`; `moon-condition-contract.test.js:162`/`:163`/`:370`;
`tools/moon-census.mjs:116` (which **exits 3**); `StarSystemGenerator.binary-barycentre.test.js:163-174`
(rows `wd-10` and `wd-27`, `moons 5 → 6`); and `moon-rng-stream-identity.test.js`'s `ORPHANS`, whose
`orphanPlanetClass` is now negative and needs a mechanism change rather than a new constant
(§8.10 item 1).
