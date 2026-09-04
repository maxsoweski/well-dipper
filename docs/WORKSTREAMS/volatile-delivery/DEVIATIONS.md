# volatile-delivery — deviations, re-captures and declared judgement calls

Every item here is a place where this workstream changed something a previous workstream had frozen,
or made a call that a reader could reasonably have made differently. Nothing here is silent.

## 1. The four shipped baseline fixtures were re-captured (AC-6)

Each pins a SHIPPED workstream's driver values captured from the corpus. Composition moves on every
body, so all four went red. Each was re-captured **values only** — structure, pack scope and key set
byte-identical — so every suite still pins exactly the packs it was written to pin.

⛔ **They were NOT regenerated with today's capture scripts, and the reason is scope.** Three of the
four store only the FOUR packs that existed when they were captured (`rockySurface`, `solidOptics`,
`solidFeatures`, `fluvialDeck`). Running today's capture over them would silently widen each fixture
to eleven packs — a different change from "the values these suites pin have moved", and one that would
quietly retire coverage each shipped workstream wrote on purpose.

| fixture | capturedFrom | body values moved | preset values moved |
|---|---|---:|---:|
| `pack-drivers-baseline.json` | 520f2c0 → 36ffec2 | 792 | **0** |
| `ray-pack-drivers-baseline.json` | dc03fc6 → 36ffec2 | 792 | **0** |
| `term-pack-drivers-baseline.json` | f0b93aa → 36ffec2 | 792 | **0** |
| `solidrelief-pack-drivers-baseline.json` | 4d81784 → 36ffec2 | 792 | **0** |

⭐ All four move by the SAME 792 values with the same top-name profile — they are four captures of one
corpus at four times, so agreement is the expected signature and disagreement would have been the
finding. ⭐ And **zero of the 18 driver presets moved in any of them**, which is the contract's
"presets are dev fixtures and must not move" clause, confirmed rather than asserted.

Attribution: `blast-radius.mjs`'s control (restore that ONE field, all 12,481 resolved values return
to byte-identity, residual 0). Re-run: `docs/WORKSTREAMS/volatile-delivery/recapture-fixtures.mjs`.

## 2. Instrument B's body-identity hash re-blessed; its DRAW STREAM channel was NOT spent

`composition` is inside the body-identity record, so 961 planet hashes moved. Re-blessed with
`npm run test:body-identity:rebless`.

⭐ **The DRAW STREAM channel stayed green, and keeping it green cost a rewrite.** The first cut drew
the delivery float with `new SeededRandom(vdelSeed).range(0, 1)`. That takes nothing off the shared
stream — AC-1 proves it, radius/orbit/type/eccentricity all byte-identical — but Instrument B counts
draws on `SeededRandom.prototype.rng`, i.e. EVERY instance, so it moved the per-yield draw profile on
**212 of 221 seeds with zero drawn values moved**. `MoonGenerator`'s own comment already warned about
exactly this and says why the red must not be spent: DRAW STREAM is the only channel that detects a
real leak into the shared stream, and a genuine leak's signature is byte-identical to a benign
construction's. Switched to `namespacedFloat`; the channel reads zero.

## 3. `namespacedFloat` lifted from MoonGenerator to SeededRandom.js

It was module-private to `MoonGenerator` and the planet path needed the same discipline. Lifted rather
than copied — one definition, two callers. Consequence: `tests/moon-condition-contract.test.js`'s
comment claiming the function "is module-private" was **corrected in place rather than deleted**; its
algebraic-identity argument still stands (re-deriving would now also need the delivery float and the
whole §3b retention chain).

## 4. 34 line-number citations repaired, by symbol

Editing `PlanetGenerator`, `MoonGenerator` and `PhysicsEngine` drifted every line-anchored citation
into them. All 858 resolve at the parent, so all 34 breaks were this workstream's. Repaired **by
locating the symbol**, never by bumping the integer — the citation fence's own instruction, because a
ref repaired to a second wrong line reads as freshly verified. Instrument C's citation fence is green.

## 5. Judgement calls, stated so they can be overruled

- **The reconciliation moves the GENERATOR to the ENGINE**, not the reverse. The engine's scale is
  anchored on six real bodies in `driver-presets.js`, and `surfaceMaterial.js:347-367` records a
  re-derivation against four of them **including an explicitly refused corpus-fitted alternative**
  ("Fitting the law to our own generator is how a world-generation defect becomes a palette law").
  The generator's ramp was anchored on nothing. Consequence: zero edits under `src/worldengine/`.
- **Two fields, not a rescale**, and this is forced rather than preferred — `moon.massEarth` is derived
  FROM `composition.density`, so a single-field bump re-rolls every moon's mass and lock state and
  drops Earth analogues under `DENS_ROCK_LO` (3.5 g/cc) where they start reading partly icy.
- **The metallicity exponent is softened to 1.0.** Fischer & Valenti (2005) put giant-planet
  *occurrence* at ∝ 10^(2·[Fe/H]), but `solidFraction` already carries a metallicity channel into
  `solidInventory`, so the published exponent would double-count. What the term needs is *scattering
  efficiency*, sub-linear in occurrence. Recorded as softened, not presented as the published figure.
- **The two system proxies are combined as a geometric mean, not multiplied.** They are two readings
  of one correlated quantity; multiplying squares the metallicity dependence. The first cut did
  multiply, gave the system term a 19× range, and drove 34 of 1,183 bodies onto the 0.7 clamp.
- **The supply ceiling is a soft asymptote, not a `min()`.** A hard cap makes a saturating instrument —
  the QB-23 defect (F13's outflow ramp saturating on 62 of 66 relict worlds). Bodies at the clamp:
  parent 0, HEAD 0.
- **No AC asserts a RATE of Earth analogues**, only reachability. Pinning a rate would be fitting the
  law to our own generator — the move refused above. The rate is reported in `POPULATION.md`.
- **Moon/Mercury and Europa are calibrated at their REAL heliocentric distance**, not the preset's
  orbit slot: `'Europa (icy moon)'` stores its orbit around Jupiter and `'Moon/Mercury
  (impact-airless)'` a placeholder. This matches what the generator actually sees, because
  `MoonGenerator` passes the PARENT's AU.

## 6. Out of scope, and why — the REPORT's Block B

`if (locked) return shell('eyeball-despun')` still sits ABOVE both roads to `plate()` and still eats
74 % of bodies (875 of 1,183, unchanged). It is **not** in this workstream, and that was decided by
measurement rather than by preference: **6 of the 11 mass-band temperate bodies are UNLOCKED**
(`scope-probe.mjs`), so the volatile fix alone opens the plate path — and it did, 0 → 4 of 124. Moving
the locked test is a relief-DISPATCH redesign in a different module and gets its own workstream.

⚠ **The class it still shuts out is real and worth naming**: tidally-locked temperate worlds around
M-dwarfs are the most common habitable-zone configuration in the real galaxy, and the lab has a
preset for them (`'Eyeball (locked temperate)'`, V = 0.25). By the charter's own test that is a whole
class of physically-real world the dispatch cannot draw with plate relief. Logged, not fixed here.
