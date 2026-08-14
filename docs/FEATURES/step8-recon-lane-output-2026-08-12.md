# Step 8 recon — RAW PER-LANE OUTPUT, recovered 2026-08-13

*The 9 agent returns from the `step8-moon-condition-recon` workflow (`wf_fd4380a4-5b1`), run
2026-08-12 at `f679046` on a clean tree. Recovered verbatim from the workflow journal after the
session handoff in `/tmp` was lost to a tmp sweep.*

⛔ **This file is EVIDENCE, not a plan.** The plan of record is
[`step8-build-plan-2026-08-12.md`](step8-build-plan-2026-08-12.md), which weighs these lanes against
each other and discounts some of them by name. Where a lane here disagrees with the build plan, the
build plan wins — it re-measured the load-bearing numbers itself and says which lane it believed and
why. Read this for the detail the synthesis compressed out, never for a verdict.

⚠ Lane returns are unedited agent output. Some carry numbers the synthesis later refuted
(lane INSTRUMENTB's +1 draw counts, discounted in §1 row 3 of the build plan, are the clearest case).

---

## Lane transcript `a9d1017abbd634aa5`

# LANE 5 — `_provenance`, the moon population harness, and the remaining gates

All numbers below come from commands I ran in this session against `feature/world-engine-production-L1` @ clean HEAD. Scripts: `/tmp/claude/lane5/{measure,measure2,terr,baseline,grav,route}.mjs`.

---

## 1. What `_provenance` is, where it comes from, what fence guards it

**Produced at** `src/worldengine/port/conditionFromPlanet.js:890-895` — `Object.defineProperty(condition, '_provenance', { value: provenanceOf(d, comp), enumerable: false, writable: false, configurable: false })`, at the end of `conditionFromPlanet` (`:707`). It rides on the *condition vector* (the port's output), never on `planetData` — deliberate, so it cannot enter Instrument B's body hash or Instrument C's watched set (`:869-888` states the argument; `body-identity-fence.test.js:192` `WORLDENGINE_BAKES.includes(k)` is the exclusion it avoids growing).

**Possible values: exactly two — `'measured'` and `'defaulted'`.** No third. Base rule `conditionFromPlanet.js:682`: `const seen = (v) => (v != null ? 'measured' : 'defaulted');`. Two rows override it:
- `composition` (`:686-687`) — `'measured'` only if **all three** of `ironFraction`/`density`/`volatileFraction` are present.
- `atmosphere` (`:696-697`) — `'measured'` if `d.atmosphere === null` (null is a *measurement*: "nothing retained") **or** `hasEngineAtmosphereShape(d.atmosphere?.physics ?? d.atmosphere)`. `hasEngineAtmosphereShape` is `conditionFromPlanet.js:371-373`: `!!a && typeof a === 'object' && (a.retained !== undefined || a.pressure !== undefined)`.

**18 rows today**, keys derived from `PROVENANCE_COVERAGE` (`:594-624`) via `PROVENANCE_INPUTS = Object.freeze(Object.keys(PROVENANCE_COVERAGE))` (`:626`). Enum enforced at `tests/port-condition-contract.test.js:3886` (`expect(['measured','defaulted']).toContain(v)`).

**The fence** is the AST walk in `tests/port-condition-contract.test.js`, describe block at `:3312` `'Step 1 · _provenance describes THE ADAPTER, not itself'`. Its load-bearing assertion is `:3853` `it('⛔ EVERY property the adapter reads off planetData has a provenance row')` — `reads` (Babel-parsed, binding-resolved, from the adapter source) vs `declared = new Set(Object.values(PROVENANCE_COVERAGE).flat())`, in **both** directions (`undeclared` at `:3860`, `stale` at `:3862`), plus `provUndeclared` (`:3869`) which closes bypass J. Parser guard: `:2377` `PARSE_OPTS`, loud-red at `parseAdapterSource` (`PROVENANCE_FENCE_PARSER_UNAVAILABLE`). Completeness is `NODE_TYPE_LEDGER` (`:2395+`) partitioned against `ESTREE_UNIVERSE` (`:2572-2600`, transcribed from `@babel/types@7.29.0`); the shipped adapter must produce **zero** `unmodelled:` hits (`:3640-3644`).

**KNOWN LIMITS block — `tests/port-condition-contract.test.js:2541-2570`.** Two constructible bypasses, both rule-semantics (not node-type), both still open:
- **#1 `arguments`.** Inside `conditionFromPlanet`, `arguments[0]` *is* `planetData`. `Identifier` is MODELLED so the sweep is satisfied, but the rule has no case for the name — `arguments[0].tidalHeating` records **no read and produces no finding**. `usesArguments` covers a resolvable in-file callee's arguments object, never the adapter's own, and returns false for arrow functions.
- **#2 Callee resolution is not JavaScript's.** `fnNamed` consults only `scope.fns` (FunctionDeclarations and `const f = <function literal>`), so a nearer non-function binding of the same name is invisible and the call **mis-resolves to an outer function** — worse than failing to resolve, because the unknown-callee escape never fires.

The block states outright: *"This fence is for catching mistakes. It is NOT an adversarial boundary and must never be cited as one."* Ledger rows **C5 and C6** carry both (`:2569`).

⚠ **Rename hazard.** `tests/port-condition-contract.test.js:3657-3662` pins the adapter's export surface as a literal array containing `'conditionFromPlanet'`. Step 8's rename reds this assertion.

---

## 2. Existing ≥500-moon harness

**None exists.** Measured:

| candidate | file:line | moons it reaches | why it fails the gate |
|---|---|---|---|
| contract-test corpus | `tests/port-condition-contract.test.js:517` `SEEDS = Array.from({length:120}, …'pcc-'+i)`, harvested `:541` `for (const m of e.moons \|\| []) moons.push(m)` | **411** (measured) | 89 short of 500. Only asserts `moons.length > 0` (`:554`). |
| route-agreement P stratum | `tests/port-route-agreement.test.js:184` `SEEDS = 600`, filter `:190` `if (m.isPlanetMoon && m.planetData)` | **29** planet-class only (measured; 1834 plain moons discarded) | wrong population entirely |
| moon mass/radius | `tests/moon-mass-radius-consistency.test.js:28` `planetClassMoons()` | planet-class only, `expect(moons.length).toBeGreaterThan(5)` (`:55`) | wrong population |
| Instrument B | `tests/body-identity-fence.test.js:93` `BULK_SEEDS = 192 × 'wd-N'` + 5 pinned + 24 galaxy | **713** over BULK alone (measured) | it *hashes*, it does not read `_provenance`; but it is the only committed seed list that already clears 500 |
| `tools/port-condition-delta.mjs:148` | `pmScanSeeds: 1000` | ~25 planet-class | comment says so in-source |

**Cheapest correct build (do NOT write it — description only).** `tests/moon-condition-contract.test.js` (the file Step 8's **Files** list already names), ~30 lines, zero new machinery:

1. **Seeds: reuse `body-identity-fence.test.js:93`'s `BULK_SEEDS` (`wd-0`…`wd-191`).** Measured **713 moons** — clears 500 with 40% headroom, and it is the *same* committed seed list Instrument B's whole-record hash gate runs on, so 8a's two gates speak about one population instead of two. (Alternative: widen the contract test's `pcc-` run from 120 → 150 seeds = **539 moons**. Thinner margin; a generator change that drops moon counts 8% silently un-gates it.)
2. **Harvest**: copy the four lines at `port-condition-contract.test.js:534-542` verbatim (`StarSystemGenerator.generate(seed, null)` → `for (const m of e.moons || [])`).
3. **Unwrap**: `const rec = m.planetData || m` — planet-class moons nest a full record (`body-identity-fence.test.js:200` does the same unwrap).
4. **Assert**: `conditionFromBody(rec)._provenance[k] !== 'defaulted'` for the four named keys, collecting failing body ids (`${seed}#${pi}#m${mi}`) not just a count — the `bodyIds` pattern at `port-condition-contract.test.js:531`.
5. **Population guard first**: `expect(moons.length).toBeGreaterThanOrEqual(500)` as its own `it()`, before the gates. Without it the gate passes vacuously if generation shape changes — the exact "0 blinks with no control" failure `moon-mass-radius-consistency.test.js:53-55` calls out.

---

## 3. TODAY'S BASELINE — the before-numbers

### Gate A — `_provenance` `'defaulted'` counts

Measured over three corpora. **Split by class, because the number is a step function, not a distribution.**

**`wd-0…wd-191` (Instrument B BULK seeds) — 713 moons: 691 plain + 22 planet-class**

| key | defaulted (plain) | defaulted (planet-class) | **TOTAL / 713** |
|---|---|---|---|
| **massEarth** | 691 | 0 | **691 (96.9%)** |
| **age** | 691 | 0 | **691 (96.9%)** |
| **T_eq** | 691 | 0 | **691 (96.9%)** |
| **surfaceHistory** | 691 | 0 | **691 (96.9%)** |

Cross-checks (same four keys, same shape):
- `pcc-0…pcc-149` — 539 moons (521 plain + 18 pc): **521 / 539 (96.7%)** on each of the four.
- integer seeds `1…600` — 1863 moons (1834 plain + 29 pc): **1834 / 1863 (98.4%)** on each of the four.

**The plain-moon count IS the defaulted count, exactly, on all four keys, in all three corpora.** No plain moon carries any of them; every planet-class moon carries all four. Step 8a must move that number from 691 → 0 (or 521 → 0, or 1834 → 0, depending on the corpus the gate commits to).

Full 18-row table at `wd` seeds, for the rows Step 8a does *not* name:
```
radiusEarth        0     composition     691    carbonToOxygen  691
eccentricity     691     tidalHeat         0    starMassEarth   713  ← 100%, incl. planet-class
orbitRadiusEarth  22  (planet-class ONLY)  tidalState      691
atmosphere         0     rotationHours   713  ← 100%, incl. planet-class
magneticField    691     habitability    691    axialTilt       691    metallicity  691
```
⚠ **Two rows read 100% defaulted and are not on Step 8a's list**: `starMassEarth` (713/713) and `rotationHours` (713/713). `orbitRadiusEarth` is the inverse — defaulted **only** on the 22 planet-class moons (the plain path writes it at `MoonGenerator.js:137`; the planet-class path does not). That is the incoherent star-mass/orbit-radius pair the adapter's tidal block names at `conditionFromPlanet.js:653-655`, and it is live on planet-class moons today.

### Gate B — truthy atmosphere with undefined pressure

**Baseline: 0. In every sample. And the 0 is structural, not lucky.**

| corpus | moons | `condition.atmosphere` truthy | of which `pressure === undefined` |
|---|---|---|---|
| `pcc-0…149` | 539 | 18 | **0** |
| `wd-0…191` | 713 | 20 | **0** |
| int `1…600` | 1863 | 27 | **0** |

Two independent reasons it is 0, both worth knowing before the step is scored:

1. **The adapter already nulls the wrapper.** `MoonGenerator.js:193-197` emits `atmosphere: type === 'terrestrial' ? { color, strength } : null`. That object has no `.physics` and fails `hasEngineAtmosphereShape` (`conditionFromPlanet.js:371-373`), so `atmosphereFromPlanet` returns `null` (`:380`). Verified on a **real generated** plain terrestrial moon (`pcc-231`): raw record `{"color":[0.4,0.6,1],"strength":0.433…}` → `condition.atmosphere === null`, `_provenance.atmosphere === 'defaulted'`.
2. **When it *is* truthy, pressure cannot be undefined** — `conditionFromPlanet.js:390` `pressure: phys.pressure ?? 0`.

⚠ **The population that could break this gate is nearly empty today.** Plain `terrestrial` moons require `MoonGenerator.js:399` `if (rng.chance(0.03)) return 'terrestrial'` in the `hz` zone of a gas-giant/sub-neptune parent. Measured: **9 in 6611 moons over 2000 seeds (0.14%)**; **0 in 695 moons over 200 seeds**. `body-identity-fence.test.js:108` records `wd-1403` as *"the only terrestrial moon in 6000 seeds"* — my 2000-seed scan found 9, so that in-file claim does not reproduce as stated, but the order of magnitude does.

⛔ **Therefore: gate B as written passes today, and will pass on a 500-moon random sample regardless of what Step 8 does, because ~0.7 terrestrial moons are expected in 500.** A gate that measures 0 → 0 on a subject that appears 0.14% of the time is a gate that cannot fail. It needs a forced-population arm (force `type: 'terrestrial'` through `MoonGenerator`, or pin `wd-1403` the way Instrument B already does) or it is decoration.

### Bonus (adjacent lane, measured while here): the `surfaceGravity` gate
`wd` seeds, 713 moons: **564 (79%) outside [0,3] g**, median **29.2 g**, max **25 556 g**. Over integer seeds 1…2000 (6445 moons): **5435 outside**, max **25 889 g** on a `captured` moon with `radiusEarth 0.006215` (≈39.6 km). Cause: `massEarth: d.massEarth ?? 1.0` (`conditionFromPlanet.js:730`) × `surfaceGravity = massEarth / (radiusEarth²)` (`baseStep.js:20`) ⇒ every plain moon is exactly `1/R²`.
⚠ **PLAN Step 8's "10.4 / 14.1 / 56.3 g" understates it by 3 orders of magnitude** — those are not the extremes. **"an 11 km Phobos-class body derives 346,021 g" did NOT reproduce**: no generated moon in 6445 is that small (smallest ≈39.6 km). The figure is arithmetically consistent (`1/0.0017² = 346 021`, R = 10.8 km) but describes a **hand-constructed** body, not one this generator emits. Recorded as a claim, not a fact.

---

## 4. Ledger C2 / C3 — what Step 8 must do, and whether the plan's text does it

**C2** (`CARRIED.md:18`, class A, from Step 1's `GREEN_BUT_GATE_DEAD` + round 3 adv. B). Headline narrowed 2026-08-08 to the **S stratum only** — the P stratum *does* bite (3 mutants: post-bake `T_eq` override reds 20/29, a bake law reading `surfaceGravity` reds 1/29, a rescale reader reds 26/29). The surviving qualified claim: `disagreeingFields` (`port-route-agreement.test.js:212-216`) compares `bakedOn(rec)` — which `PlanetGenerator` wrote from `conditionFromPlanet(rec)` — against `bakesFrom(conditionFromPlanet(rec))`. Same pure function, same object ⇒ **channel 2's S stratum cannot fail while the bake route derives from the returned record**, which is exactly what channel 1 asserts. Clears at Step 8 because *"`conditionFromBody` gives moons a second generator path and value divergence becomes constructible again."*

**C3** (`CARRIED.md:19`, class A, round 3 adv. C). *"Channels 1 and 3 cannot see a record mutated between the literal and the adapter call."* For a key that is neither in `WIDENED` (`:460`) nor read by the four bakes, all three channels stay green through `const planetData = {…}; planetData.X = v; conditionFromPlanet(planetData); planetData.X = orig;`. Clears **"at Step 8, with C2 — same gate, same commit."**

**What Step 8 must actually do to clear them** — both reduce to one requirement: **make the route-agreement file capable of failing on a moon whose bake route and render route disagree in VALUE.** Concretely (each verified against the file):
- A second producer that calls `conditionFromBody` — Step 8a's `MoonGenerator` widening supplies it.
- That producer's output must be **compared against a recompute** — i.e. the M (plain-moon) stratum must be added to channel 2.
- For C3 specifically: a **mutation-window control** — a synthetic post-literal/pre-adapter override of a key no bake law reads, asserted to be **caught**. C3 is a mutation-timing hole, not a field-set hole; adding a stratum does not close it by itself.

**Does the plan's Step 8 text do it? NO — and that is a finding.**

Step 8's **Files** list (`PLAN.md:392`) is: `MoonGenerator.js`, `conditionFromBody.js`, `tests/moon-condition-contract.test.js`, `tests/moon-rng-stream-identity.test.js`, `tests/baseline/body-identity.json`. **`tests/port-route-agreement.test.js` is not in it.** Step 8's **Gate** list (`:394-401`) contains seven bullets: whole-record hash, per-type draw-count, `_provenance`, surfaceGravity band, Sol Moon regression, atmosphere/pressure, and 8b's delta table. **None mentions route agreement, channel 2, an M stratum, or a mutation-window control.**

So as written, Step 8 lands the *precondition* for C2/C3 (a second generator path) and lands **none of the gate work**. Both rows are marked "clears at Step 8" and would ship un-cleared while the ledger records them as closed. Under §11.6's own rule — *"a carried item that no step clears must be promoted to blocking or explicitly retired by Max"* — this is C2/C3 silently becoming that item, at the step named to close them.

---

## 5. §11.7 — what has to change in `tests/port-route-agreement.test.js`

§11.7 (`PLAN.md:716-717`) rules the gate *"becomes live at **Step 8**, where `conditionFromBody` gives moons a second generator path and value divergence between routes is constructible again. **Verdict: CARRIED, cleared by Step 8.**"* Advisory C (= C3) *"is the same family and clears with it."*

**Both test files are GREEN today**: `npx vitest run tests/port-route-agreement.test.js` → 10/10 passed; `tests/port-condition-contract.test.js` → 66/66 passed.

### What has to change, item by item

| # | site | today | required |
|---|---|---|---|
| 1 | `:61` `import { conditionFromPlanet } from '../src/worldengine/port/conditionFromPlanet.js';` | resolves | rename to `conditionFromBody` from `conditionFromBody.js` |
| 2 | `:124` `const needle = 'conditionFromPlanet(';` | matches both call sites | needle must become `'conditionFromBody('` — this is the **only** hardcoded source-scan needle for the symbol in the whole repo (grepped) |
| 3 | channel 1, `:261` / `:273` | scans `PlanetGenerator.js` and `Planet.js` only | needs a **third** route-shape check anchored on `MoonGenerator.generate`'s signature. That call site **does not exist today** — `grep conditionFromPlanet src/generation/MoonGenerator.js` returns one hit, a *comment* at `:309`. Step 8a creates it. |
| 4 | corpus, `:190` `if (m.isPlanetMoon && m.planetData) P.push(…)` | **29** planet-class moons over seeds 1..600 (measured) | needs an **M stratum** of plain moons. Measured over the same 600 seeds: **1834 plain moons**, i.e. the P stratum covers **1.6%** of Step 8's declared subject and the other 98.4% is invisible to every channel. |
| 5 | `bakedOn`, `:207-210` | reads `rec.landPalette / iceness / lavaGlowColor / lavaCrustColor` | ⛔ **plain moon records carry none of these four keys.** Measured moon-record key set: `_ordinal,_systemSeed,accentColor,atmosphere,aurora,baseColor,clouds,inclination,noiseScale,orbitRadius,orbitRadiusEarth,orbitRadiusScene,orbitSpeed,radius,radiusEarth,radiusScene,startAngle,tidalHeating,type`. Consequence, **measured**: `disagreeingFields` on plain moons reds **1834/1834**, naming all four fields on every one (`captured`, `rocky`, … alike), because it compares `undefined` against a computed value. Planet-class: **0/29**. |

### What happens if nobody touches it

**It goes RED, loudly, not vacuous** — but for the wrong reason and with a misleading message:
- Item 1 alone takes the whole file down at import (module not found) → suite red by name. That is the *good* failure mode; the file cannot silently pass.
- If the rename keeps a re-export (so item 1 survives), item 2 bites: `conditionCallArgsIn` finds **0** occurrences → `routeShapeOf` returns `{ok:false, why:'expected exactly 1 conditionFromPlanet call, found 0'}` and both `BAKE route` (`:261`) and `RENDER route` (`:273`) fail with a message naming a symbol that no longer exists. A reader repairs the needle, gets green, and the file is now **exactly as dead as C2 says it is** — channel 1 still scans two planet files, channel 2 still holds 29 planet-class moons, and the second generator path §11.7 says makes divergence constructible is **not scanned, not sampled, and not compared**.

⚠ **And the naive repair is a trap.** Adding plain moons to the existing P-stratum comparison reds 1834/1834 instantly (item 5) — not because a route diverged, but because `bakedOn` reads five bakes `MoonGenerator` never writes. Step 8a's *What* (`PLAN.md:388`) lists what the plain path will emit — `massEarth`, `age`, `T_eq`, `composition`, `surfaceHistory`, `tidalState` — and **does not include the five bakes**. So either Step 8 also makes `MoonGenerator` bake `landPalette/iceness/lavaGlowColor/lavaCrustColor/iceColor` (not in the plan), or the M stratum needs a *different* comparator than `bakedOn`, and §11.7's "value divergence becomes constructible" is true of the *code path* and false of *this file's comparator*. That gap is not addressed anywhere in Step 8's text.

### Also breaking on the rename, outside this file
- `tests/port-condition-contract.test.js:3657-3662` — export-surface array literal contains `'conditionFromPlanet'`.
- **23 files** import from `src/worldengine/port/conditionFromPlanet.js` (grep, excluding `node_modules`/`scratchpad`); **34 files / 241 references** mention the symbol. Includes `planet-lod-lab.html`, `src/main.js`, 5 `tools/*.mjs`, and 15 test files.

---

## Lane transcript `a18bfc89666d38836`

## 1. HOW INSTRUMENT B WORKS TODAY

**File:** `/home/ax/projects/well-dipper/tests/body-identity-fence.test.js` (574 lines). **Blessed data:** `/home/ax/projects/well-dipper/tests/baseline/body-identity.json` (12,659 lines). **Runner:** `package.json:19` → `vitest run tests/body-identity-fence.test.js --exclude '**/.claude/**'`. Rebless: `package.json:20`, `WD_REBLESS_BODY_IDENTITY=1`.

**Hashing function, verbatim** (`tests/body-identity-fence.test.js:177-204`):

```js
/** Recursively sort object keys so a literal reorder is not a false red. */
function canon(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(canon);
  const out = {};
  for (const k of Object.keys(v).sort()) out[k] = canon(v[k]);
  return out;
}

function hash(v) {
  return createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
}

function planetRecord(pd) {
  const out = {};
  for (const k of Object.keys(pd)) if (!WORLDENGINE_BAKES.includes(k)) out[k] = pd[k];
  return canon(out);
}

function moonRecord(m) {
  const out = {};
  for (const k of Object.keys(m)) {
    out[k] = k === 'planetData' && m[k] && typeof m[k] === 'object'
      ? planetRecord(m[k])   // planet-class moons nest a full planetData
      : m[k];
  }
  return canon(out);
}
```

- **Bodies:** 221 systems — 192 bulk `wd-0…wd-191` (`:93`), 5 pinned (`:95-109`), 24 galaxy-context `gc-0…gc-23` (`:114-120`). **Measured population: 794 moons (770 plain, 24 planet-class), across those exact 221 seeds.**
- **Precision:** `JSON.stringify` of raw JS doubles — shortest round-trip repr, exact. **Measured: 0 of all numeric fields across 713 sampled moon records fail `JSON.parse(JSON.stringify(v)) === v`.** The 16-hex truncation at `:187` is 64 bits; irrelevant at 794 records.
- **Two channels** (`:463` DRAW STREAM, `:489` BODY IDENTITY) + shape (`:518`), bake-presence (`:528`), negative control (`:544`).
- `rollup = hash({ system, planets })` at `:290`; used as a fast-path `continue` at `:497` and as the negative control's assertion at `:562,:572`.

## 2. ⛔ WHICH FOUR NAMED FIELDS — **NONE. THE PREMISE IS FALSE.**

**Instrument B already hashes the entire moon record, and has since Step 0.**

- `moonRecord` (`:196-204`) iterates `Object.keys(m)` with no allowlist and no exclusion. Planets get the 5-key `WORLDENGINE_BAKES` exclusion (`:173-175`); **moons get none**.
- `git log --oneline -- tests/body-identity-fence.test.js` → 3 commits (`b2ac455`, `0af246e`, `56d136a`). `git show <each>:tests/body-identity-fence.test.js | grep -A12 moonRecord` — **the function body is byte-identical in all three.** A four-named-field moon hash has never existed in this file's history.
- `tests/baseline/body-identity.json` has **one** commit, `b2ac455` (Step 0). The blessed moon hashes on disk are whole-record hashes.
- The file's own header already states this: `:125-132` — *"MOONS: the ENTIRE record, every key, no exceptions (plan requirement — four named fields would miss seven of fifteen draws)."*
- Grep over `tests/ tools/ scripts/` finds no other moon hasher. The only occurrences of "four named fields" in the repo are `docs/FEATURES/one-pipeline-two-frontends-PLAN.md:401` and `:545` — the PLAN talking about itself.

**Verdict: Step 8a's first gate bullet describes work that landed in commit `b2ac455`. There is nothing to widen.**

## 3. WHAT WOULD CHANGE — AND THE HAZARDS THAT ARE REAL

**The diff in words: zero lines.** No widening is required. The live hazards are not "how do we widen it" but "what breaks the widened hash that already exists."

**Non-JSON values in the moon record — measured.** Walked all 794 moons over the fence's exact 221 seeds, recursively, checking own-enumerable keys:

| hazard | count | note |
|---|---|---|
| `undefined` values | **0** | |
| `NaN` | **0** | |
| `±Infinity` | **0** | |
| `-0` | **0** | |
| functions | **0** | |
| class instances (non-`Object.prototype` proto) | **0** | |
| `Symbol` keys | **0** | |
| `BigInt` / `Date` | **0** | |
| accessor properties (get/set) | **0** | |
| true cycles | **0** | `JSON.stringify(moon)` throws nothing |
| **shared/aliased object refs** | **1,598 hits** | not cycles — see below |

The 1,598 "cyclic" hits are **aliasing, not cycles**. Measured: for `wd-4` planet 2 moon 2 (type `ice`), `MoonGenerator.PALETTES['ice'].some(p => p.base === m.baseColor)` → **true**. `baseColor`/`accentColor` are *references into the module-level `PALETTES` table* (`src/generation/MoonGenerator.js:110` `const palette = rng.pick(this.PALETTES[type]);`). `JSON.stringify` duplicates them harmlessly. **The hazard is mutation:** any Step-8a code that writes into `moon.baseColor` in place corrupts the constant table for every moon of that type in the universe.

**Record shape is exactly 2 variants** (`tests/baseline/body-identity.json` `moonShapes`, reproduced live):
- plain (770): `type, radiusEarth, radiusScene, orbitRadiusEarth, orbitRadiusScene, tidalHeating, radius, orbitRadius, baseColor, accentColor, orbitSpeed, inclination, startAngle, noiseScale, clouds, atmosphere, aurora, _systemSeed, _ordinal`
- planet-class (24): same minus `aurora`, plus `isPlanetMoon`, `planetData`

**Hazards, each demonstrated by running `canon` + `JSON.stringify`:**

| hazard | behaviour | verdict |
|---|---|---|
| key ordering | `canon` sorts recursively (`:182`) | **handled** |
| `undefined` value vs missing key | `{a:1,b:undefined}` → `{"a":1}`; `{a:1}` → `{"a":1}` | **COLLIDE.** An appended key whose derivation returns `undefined` is invisible to the hash. Caught only by RECORD SHAPE (`:518`), which uses `Object.keys` |
| `NaN` | → `{"a":null}` | **COLLIDES with `null`.** A NaN `massEarth` hashes identically to a null one |
| `Infinity` | → `{"a":null}` | same collision |
| `-0` vs `0` | both → `{"a":0}` | **COLLIDE.** Load-bearing: `retrograde` survives only as the *sign* of `orbitSpeed` (`MoonGenerator.js:180`). Min \|orbitSpeed\| measured ~1e-5, never 0 today |
| nested objects | `canon` recurses | handled; `planetData` is re-routed through `planetRecord` at `:199-200`, i.e. planet-class moons inherit the 5-key bake exclusion |
| floats | full double precision preserved, 0/713 round-trip failures | **handled** |
| `Map` / `Set` | both → `{}` | silently empty |
| class instance with `toJSON` | `canon` rebuilds a plain object → **`toJSON` is bypassed** | a `toJSON`-bearing value hashes as its raw own-keys |
| `Date` | → `{}` (no own keys, and `canon` strips `toJSON`) | silently empty |
| true cycle | **`canon` throws `RangeError: Maximum call stack size exceeded`** before `JSON.stringify` can throw `TypeError` | the error message will not say "circular" |

**⛔ THE HAZARD THAT MATTERS MOST — non-enumerable properties.** `Object.keys` skips them. `conditionFromPlanet.js:890` already establishes exactly this pattern in this codebase, with an explicit rationale at `:483-489`: *"it CANNOT enter any hash, golden or key-shape assertion by accident. The protection is structural."* Measured (below): appending Step-8a's six fields **non-enumerably** leaves **all eight Instrument-B tests green and blind**.

## 4. ⛔ THE VACUITY QUESTION — MEASURED, WITH THE GATE'S OWN CONTRADICTION

I simulated 8a: monkeypatched `MoonGenerator.generate` to append `{massEarth, age, T_eq, composition, surfaceHistory, tidalState}` to plain moons using zero `rng` draws, then re-ran Instrument B's exact capture logic against the committed `tests/baseline/body-identity.json`. Script: `/tmp/claude/wd/sim8a.mjs`.

```
MODE=off  seeds=221                       ← control: my replication is faithful
  DRAW STREAM channel: profiles moved on 0/221 seeds  -> GREEN
  BODY IDENTITY moons: moved 0, unchanged 794  -> GREEN
  planet hashes moved: 0 -> GREEN

MODE=append  seeds=221                    ← 8a as specified, enumerable
  DRAW STREAM channel: profiles moved on 0/221 seeds  -> GREEN
  BODY IDENTITY moons: moved 770, unchanged 24  -> RED
     of which planet-class 0, plain 770
  planet hashes moved: 0 -> GREEN

MODE=append-nonenum  seeds=221            ← 8a via Object.defineProperty
  DRAW STREAM channel: profiles moved on 0/221 seeds  -> GREEN
  BODY IDENTITY moons: moved 0, unchanged 794  -> GREEN
  planet hashes moved: 0 -> GREEN
```

**⛔ THE GATE AS WRITTEN IS SELF-CONTRADICTORY, NOT MERELY VACUOUS.** *"Instrument B must hash the ENTIRE returned moon record… Must be byte-identical"* — those two clauses cannot both hold. Hashing the entire record means the six appended keys enter the hash, so **770 of 794 moon hashes move by construction**. Byte-identity is achievable only on the *four-named-field* hash the same sentence forbids.

The test file already knows this. `:518-523`:
> *"When Step 8 lands, this test and the value test go red together while the DRAW test stays green — that combination is the proof the addition really was additive."*

**The three vacuity traps, ranked:**

1. **Non-enumerable append.** Fully green, fully blind, and *precedented in this repo* (`conditionFromPlanet.js:890`). A commit doing this passes every gate and proves nothing.
2. **Widen-then-bless in the 8a commit.** Dead as stated (nothing to widen), but the same shape survives as *rebless-in-the-8a-commit*: if `WD_REBLESS_BODY_IDENTITY=1` is run inside 8a, the file rewrites itself from the post-8a code and the 770 diffs vanish. `:382-408` writes `systems` from `live`, so the fence records whatever it is shown.
3. **Reading the "must be byte-identical" clause as the pass condition** and then reblessing to satisfy it. That is the file's own named death-mode at `:150-153`.

**CORRECT ORDERING OF OPERATIONS, and which commit each half belongs in:**

- **Nothing goes in a "widen Instrument B" commit — there is no such commit.** The widened hash was committed at `b2ac455` (Step 0), 7+ commits before HEAD (`f679046`). **The baseline predates 8a. The gate can fail today.** That is the one fact that rescues this gate, and it is an accident of Step 0, not of Step 8's design.
- **8a commit** — production change only (`src/generation/MoonGenerator.js`, `conditionFromPlanet.js → conditionFromBody.js`). **Do not touch `tests/baseline/body-identity.json`.** Expected verdict, which must be *written into the commit message before the run*:
  - `DRAW STREAM` (`:463`) — **GREEN**, 0/221 seeds. *This is the real gate.* Any red here = a draw leaked; the commit is wrong.
  - `BODY IDENTITY` (`:489`) — **RED on exactly 770 moons, 0 planets, 0 planet-class moons.** The counts are the assertion. 771+ or a planet red = the change was not additive.
  - `RECORD SHAPE` (`:518`) — **RED, and it must name the six new keys**, plain shape only. If it stays green, the fields were attached non-enumerably and the whole instrument is blind — treat green here as a **failure**, not a pass.
  - The other five tests — green.
- **Separate, later, named rebless commit** — `WD_REBLESS_BODY_IDENTITY=1 npm run test:body-identity`, `tests/baseline/body-identity.json` alone in the diff, message naming Step 8a and the 770/0/0 split (`:404-406` demands exactly this).

**The gate bullet needs rewriting to be runnable.** Suggested replacement: *"8a: Instrument B's DRAW STREAM channel stays green on 221/221 seeds. BODY IDENTITY goes red on exactly 770 plain moons, 0 planets and 0 planet-class moons; RECORD SHAPE goes red naming exactly the six appended keys on the plain shape only. A green RECORD SHAPE is a failure — it means the append was non-enumerable. The rebless is its own commit, after."*

## 5. `npm run test:body-identity` — VERBATIM, THE BEFORE-NUMBER

```
> well-dipper@0.0.0 test:body-identity
> vitest run tests/body-identity-fence.test.js --exclude '**/.claude/**'


 RUN  v4.1.0 /home/ax/projects/well-dipper


 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  15:55:13
   Duration  886ms (transform 138ms, setup 0ms, import 188ms, tests 622ms, environment 0ms)
```

(First run of the session, cold: `Duration 2.14s (… tests 1.27s)`. 8/8 both runs.)

**On "same cost."** Measured 50× over 713 real moon records: four-field hash **1.98 µs/moon**, whole-record hash **4.82 µs/moon** — a **2.4× per-hash ratio**, but **≈3.8 ms total** per 794-moon capture pass, i.e. **<0.6% of the 622 ms test time**. "Same cost" is true in wall-clock, false as a ratio. Moot regardless: the whole-record hash is what already runs.

## 6. PLANET-CLASS COVERAGE — THE FENCE SEES THEM BUT CANNOT NAME THEM

**Coverage exists, and is thin but non-empty.** Measured over the fence's exact 221 seeds: **24 planet-class moons across 22 seeds = 3.02% of 794** —
`wd-11 wd-15 wd-24 wd-27 wd-40 wd-61 wd-66 wd-70 wd-100 wd-101 wd-116 wd-126 wd-133(×2) wd-147 wd-161 wd-166(×2) wd-168 wd-174 wd-187 wd-189 wd-1403 gc-22`.

**Checking the PLAN's "~3.5%":** measured 3.25% over 400 seeds (48/1475 — this exactly reproduces the figure in the test comment at `:132`), 3.12% over 1000 seeds (110/3521), 3.02% over the fence's 221. **The claim is high by ~0.3 pp; "~3.1%" is the reproducible number.** Also reproduced from the same sweep: retrograde fires on **40.6–41.0% of captured moons** (`rng.chance(0.4)` at `MoonGenerator.js:155`) — the PLAN's `0.4` is live.

**Can the current fence express "diff only on planet-class moons, enumerated"? NO.** The baseline stores per planet `{type, hash, moons: [<16-hex string>, …]}` (`:271-278`). **`isPlanetMoon` is nowhere in the captured structure.** The diff message at `:509-511` can only say `${seed} planet ${i} moon ${j}: hashA → hashB` — it cannot classify moon `j`. `classesOfSystem` computes `planet-class-moon` at `:319`, but that is a *set membership over the whole corpus*, discarded per-body, and it does not change under 8b (a planet-class moon stays planet-class), so the class test at `:429` stays green and tells you nothing.

**What it needs — and the trap in the obvious fix.** The obvious move is adding a `pc: [bool…]` array beside `moons` in `captureSystem`'s planet entries. **Measured cost of that:**

```
baseline rollup wd-0      : e67f7a5184d423ac
rollup, planets as today  : e67f7a5184d423ac      ← reproduces
rollup, planets + `pc` key: 95dbe61d46cc21be      ← moves
```

`rollup = hash({system, planets})` (`:290`) — so a `pc` key inside `planets[]` **moves the rollup on all 221 seeds**. The `BODY IDENTITY` test survives (the `:497` shortcut just stops firing and the detailed loop still finds nothing), but **`NEGATIVE CONTROL` at `:572` breaks**: `expect(captureSystem(seed, null).rollup).toBe(before.rollup)` compares live against the *file*. That forces a full 221-seed rebless in the same commit as 8b — i.e. **the exact rebless-inside-the-gated-commit that makes 8b's delta table unfalsifiable.**

**The fix that avoids it:** carry the planet-class flags **outside the rollup input** — either derive them live-only inside `captureAll`'s second `StarSystemGenerator.generate` pass (`:355-361`, which already holds `m.isPlanetMoon` and already feeds `moonShapes`) into a side-map keyed `seed/planet/moon`, or store them as a new **top-level** `baseline.planetClassMoons` sibling of `systems`, never inside `hash({system, planets})`. Then the `BODY IDENTITY` diff loop can partition its 24-entry output into "planet-class (allowed, enumerated)" and "anything else (fail)". **That is a ~15-line test-only change and it must land in its own commit, BEFORE 8b**, or 8b's "only allowed diff is planet-class moons" is a sentence with no mechanism behind it.

**One more gap, out of my lane but adjacent:** the fence contains **no Sol**. Seeds are `wd-*` and `gc-*` only (`:93,:95-109,:114-120`). Step 8a's *"Sol's Moon derives 0.165 ± 0.01 g"* regression fixture has no home in Instrument B and needs its own test file.

---

## CORRECTIONS TO THE PLAN THAT MY MEASUREMENTS FORCE

1. **`docs/FEATURES/one-pipeline-two-frontends-PLAN.md:401`** — *"Instrument B must hash the ENTIRE returned moon record… not four named fields"* is **already done** (commit `b2ac455`, `tests/body-identity-fence.test.js:196-204`, unchanged across all 3 commits touching the file). And *"Must be byte-identical"* is **impossible in the same breath** — measured 770/794 moon hashes move under a faithful 8a append.
2. **`:545`** (risk-2 mitigation column) — *"Instrument B hashes the ENTIRE moon record (Step 8)"* should read *"(Step 0, already shipped)"*.
3. **"The plain path has fifteen draws"** (`:394`) — that is a count of `rng.` **call sites** inside `MoonGenerator.generate`'s own body (16 lines, of which `:151`/`:152` are mutually exclusive → 15), **not draws executed**. Measured executed draws over 60,000 forced generations across 5 parent types × 3 zones × moonIndex 0-4:

   | resulting type | draws consumed from the passed-in `rng` |
   |---|---|
   | rocky | **12 / 13 / 14** |
   | ice | **12 / 13 / 14** |
   | captured | **12 / 13 / 14** |
   | volcanic | **13** (n=2809, constant) |
   | terrestrial | **19** (n=200, constant) |
   | planet-class | **23 / 25 / 29 / 31** |

   The *"seven of them come after `startAngle` (:157)"* claim **does reproduce**: `:185, :189, :190, :195, :200, :201, :202` = 7. All cited line numbers in Step 8a resolve correctly against `src/generation/MoonGenerator.js` at HEAD.
4. **Step 8a gate bullet 2**, *"for each moon type, the number of values consumed from the passed-in `rng` is pinned to a committed number"* — **not satisfiable as written.** Draw count is a function of (parent type, `moonIndex`, `_pickRadius`/`_pickType` branch), not of moon type: the `:99` `isLargeParent && … rng.chance(0.10)` gate only draws for gas-giant/sub-neptune parents, `_pickRadius` has conditional `rng.chance(0.2)` / `rng.chance(0.12)` branches, and `_pickType` has a `moonIndex === 0 && rng.chance(0.35)` branch. Pin the **set** per type, or pin per (parent-type, moonIndex, type) triple.
5. **"~3.5% of moons"** (`:398`) — measured 3.02% (fence's 221 seeds), 3.25% (400 seeds), 3.12% (1000 seeds). **~3.1%.**

## FILES

- `/home/ax/projects/well-dipper/tests/body-identity-fence.test.js`
- `/home/ax/projects/well-dipper/tests/baseline/body-identity.json`
- `/home/ax/projects/well-dipper/src/generation/MoonGenerator.js`
- `/home/ax/projects/well-dipper/src/worldengine/port/conditionFromPlanet.js` (the non-enumerable `_provenance` precedent, `:890`)
- Probes written (read-only, `/tmp`, no repo file touched): `/tmp/claude/wd/probe.mjs`, `probe2.mjs`, `probe3.mjs`, `probe4.mjs`, `probe5.mjs`, `probe6.mjs`, `rollup.mjs`, `sim8a.mjs`

**UNMEASURED:** whether 8b's `PlanetGenerator.generate(rng, 1.0 → real AU)` change is draw-stream neutral (PLAN claims 0/400); whether the `_provenance` "zero defaulted entries on ≥500 moons" gate is reachable; the `surfaceGravity ∈ [0,3] g` and Sol-Moon-0.165 g figures. Those belong to other lanes.

---

## Lane transcript `a0bb423fb3dbf087a`

# LANE 1 RECON — MoonGenerator RNG draw stream

**Method for every number below.** `MoonGenerator.generate` was wrapped so the *passed-in* `SeededRandom` instance had its own `rng` (the Alea closure, `SeededRandom.js:15`) replaced by a counter that captures `new Error().stack` on each call and extracts the innermost `MoonGenerator.js:<line>` frame. Only the passed-in instance is wrapped, so the dedicated `eccRng` (`:259`) is invisible by construction. Population = `StarSystemGenerator.generate('wd-0' … 'wd-1999', null)`, unmodified production path. Scripts: `/tmp/claude-1000/-home-ax/237cc0d0-1e26-4841-ac3a-117ca5c72fbe/scratchpad/{drawtrace.mjs,drawtrace2.mjs,freq.mjs,scope.mjs,scope2.mjs,teq3.mjs}`.

Every `SeededRandom` method consumes exactly **one** underlying value: `float` (`:19-21`), `range` (`:24-26`), `int` (`:29-31`), `pick` (`:34-36` → one `int`), `chance` (`:39-41`). `gaussian` = 2, `child` = 1 (`:93-95`). `orb()` = `realisticOrbitSpeed` (`src/core/CelestialTime.js:94-96`) is `legacyValue * K` — **zero draws**.

---

## 1. Complete ordered draw list, plain path — **the plan's "fifteen" is a static expression count, and no moon ever consumes 15**

### 1a. Every lexical `rng` consumption site reachable on the plain path (28 sites, not 15)

`MoonGenerator.generate` is `:93-205`. The plan calls the plain path `:165-204` — that range is only the **return literal**; the path actually begins at `:98`.

| # | file:line | expression | lands in | fires on % of plain moons (N=6696) |
|---|---|---|---|---|
| — | `MoonGenerator.js:99` | `rng.chance(0.10)` | (planet-moon gate — no binding) | **28.36%** |
| — | `:370` (via `:103`) | `rng.float()` | `roll` in `_pickType` | 100.00% |
| — | `:377` (via `:103`) | `rng.chance(0.35)` | volcanic-Io gate | 26.82% |
| — | `:399` (via `:103`) | `rng.chance(0.03)` | terrestrial gate | 4.33% |
| — | `:217` (via `:108`) | `rng.range(0.08,0.15)` | `fraction` (terrestrial) | 0.09% |
| — | `:219` (via `:108`) | `rng.range(0.02,0.04)` | `fraction` (captured) | 23.92% |
| — | `:221` (via `:108`) | `rng.chance(0.2)` | giant size-class gate | 51.70% |
| — | `:222` (via `:108`) | `rng.range(0.10,0.20)` | `fraction` | 10.68% |
| — | `:224` (via `:108`) | `rng.range(0.04,0.10)` | `fraction` | 41.02% |
| — | `:226` (via `:108`) | `rng.chance(0.12)` | non-giant size gate | 24.28% |
| — | `:227` (via `:108`) | `rng.range(0.15,0.25)` | `fraction` | 2.79% |
| — | `:229` (via `:108`) | `rng.range(0.03,0.08)` | `fraction` | 21.49% |
| 1 | `:110` | `rng.pick(this.PALETTES[type])` | `palette` | 100.00% |
| 2 | `:133` | `rng.range(3, 8)` | `zoneSpread` | 100.00% |
| 3 | `:134` | `rng.range(minMult, maxMult)` | `orbitMultiple` | 100.00% |
| 4 | `:143` | `rng.range(-0.3, 0.5)` | `orbitRadius` | 100.00% |
| 5 | `:147` | `rng.range(0.025, 0.052)` | `orbitSpeed` | 100.00% |
| 6 | `:151` | `rng.range(-0.5, 0.5)` | `inclination` (captured branch) | 23.92% |
| 6′ | `:152` | `rng.range(-0.1, 0.1)` | `inclination` (regular branch) | 76.08% |
| 7 | `:155` | `rng.chance(0.4)` | `retrograde` | **23.92%** |
| 8 | `:157` | `rng.range(0, 2π)` | `startAngle` | 100.00% |
| 9 | `:185` | `rng.range(3.0, 6.0)` | `noiseScale` | **100.00%** |
| 10 | `:189` | `rng.range(0.3, 0.55)` | `clouds.density` | 0.09% |
| 11 | `:190` | `rng.range(2.5, 4.5)` | `clouds.scale` | 0.09% |
| 12 | `:195` | `rng.range(0.25, 0.5)` | `atmosphere.strength` | 0.09% |
| 13 | `:200` | `rng.range(0.1, 0.4)` | `aurora.intensity` | 0.09% |
| 14 | `:201` | `rng.range(0.7, 0.85)` | `aurora.ringLatitude` | 0.09% |
| 15 | `:202` | `rng.range(0.08, 0.15)` | `aurora.ringWidth` | 0.09% |

`:161-163` `_computeTidalHeating` → `tidalHeating`: **0 draws** from `rng` (verified — the trace shows no site between `:157` and `:185`).

### 1b. Where the plan's count comes from, and where it goes wrong

The numbered column above reproduces **15** exactly — and that is the plan's number. It is obtained by: counting only sites lexically inside `generate`, **excluding `:99`**, and collapsing the `:151`/`:152` ternary pair into one. On that convention "**seven of them come after `startAngle` (`:157`)**" is also exactly right: `:185, :189, :190, :195, :200, :201, :202` = 7. ✅

Three ways the count is misleading as stated:

1. **It omits 12 more sites that consume the same `rng`.** `_pickType` (`:370, :377, :399`) and `_pickRadius` (`:217-229`) draw from the *passed-in* `rng`, called at `:103` and `:108`. Total reachable sites on the plain path = **28**, not 15.
2. **It omits `:99`.** `rng.chance(0.10)` is a real draw on the plain path — it fires on **28.36%** of plain moons (1899/6696) and on 30.52% of all `generate` calls (2107/6904). It is the *first* draw whenever it is evaluated, so it shifts the entire remainder of the moon's stream.
3. **No moon ever consumes 15.** Measured per-moon totals over 6696 plain moons:

```
plain draw-count histogram: {"11":2943,"12":3520,"13":227,"17":1,"18":5}
per-type:  rocky {11:1173, 12:838, 13:74}
           captured {11:970, 12:591, 13:41}
           ice {11:782, 12:1409, 13:112}
           volcanic {11:18, 12:682}
           terrestrial {17:1, 18:5}
min = 11, max = 18.   (planet-class path: min 18, max 29)
```

Terrestrial (the only shape that reaches all seven tail sites) exists on 6/6696 plain moons (0.09%), seeds `wd-927, wd-1028, wd-1230, wd-1496, wd-1854, wd-1930`. Its full stream (`wd-1230`):
`:99, :370, :399, :217, :110, :133, :134, :143, :147, :152, :157, :185, :189, :190, :195, :200, :201, :202` = 18.

**The load-bearing hazard itself is CONFIRMED, and stronger than stated.** `:185` (`noiseScale`) fires on **100.00%** of plain moons (6696/6696). Any draw inserted anywhere in `:158-:184` re-rolls `noiseScale` on every plain moon. ✅

One scope correction in the plan's favour and against panic: each moon receives its **own child stream** — `StarSystemGenerator.js:594` `const moonRng = planetRng.child(\`moon-${m}\`)`, and `child` (`SeededRandom.js:93-95`) draws once from `planetRng` *before* `generate` runs. So a draw-count change inside `generate` cannot shift sibling moons, the parent planet, or the system. The blast radius of a splice is **within each moon's own tail** — which, because `:185` is universal, is still every plain moon in the universe.

---

## 2. Conditional draws, and the 24.4% re-measured

**Conditional sites** (all frequencies from the table in §1a, N = 6696 plain moons over seeds `wd-0…wd-1999`):

- `:99` `isLargeParent && moonIndex > 0 && totalMoons >= 3 && rng.chance(0.10)` — **28.36%**. Three-term short-circuit; the plan does not name this one at all.
- `:377` `moonIndex === 0 && rng.chance(0.35)` — 26.82%
- `:399` `rng.chance(0.03)` (hz + giant parent only) — 4.33%
- `_pickRadius` branch set — exactly one of `{:217}`, `{:219}`, `{:221,:222|:224}`, `{:226,:227|:229}`; the giant/non-giant branches cost **2** draws, terrestrial/captured cost **1**
- `:151` vs `:152` — mutually exclusive, always exactly 1 (not a count-conditional)
- **`:155` `type === 'captured' && rng.chance(0.4)`** — **23.92%**
- `:189, :190, :195, :200, :201, :202` — `type === 'terrestrial'`, **0.09%**

**Re-measure of the plan's 24.4% claim.** Seeds `wd-0`…`wd-1999`, unmodified `StarSystemGenerator.generate(seed, null)`, moon type read off the returned record, planet-class moons (`isPlanetMoon`) excluded from the "plain" denominator:

```
moons total       6904
plain             6696     planet-class  208
plain types       {rocky:2085, captured:1602, ice:2303, volcanic:700, terrestrial:6}
captured / plain  1602/6696 = 23.925%
captured / all    1602/6904 = 23.204%
:155 fired on     1602/6696 = 23.92%  (identical, as it must be)
```

**The claim reproduces.** 23.925% vs the plan's 24.43% (64/262); at p=0.239 a 262-moon sample has σ ≈ 2.6 pp, so 24.4% is 0.2σ away. The plan's *denominator* is the one to watch: 24.4% is of **plain** moons; over **all** moons it is 23.2%. And `:155` is confirmed as the live conditional — it draws on 1602 moons and short-circuits on 5094.

---

## 3. Last draw, and the earliest safe append point

**Last draw site: `MoonGenerator.js:202`** — `ringWidth: rng.range(0.08, 0.15),`, inside the `aurora` ternary, closed by `:203` `} : null,` and the literal by `:204` `};`.

**Earliest safe append point: after `:204`** — i.e. the `return {` at `:165` must become `const moon = { … };`, new derivations appended to `moon`, then `return moon;`. There is no safe insertion point *inside* the function body before `:204`: the last draw is the last-but-two line of the literal.

For non-terrestrial moons (99.91% of the plain population) the last draw is `:185`, but that is not a usable append point — `:189-:202` are live on the terrestrial branch and an insertion at `:186` would re-roll all six of them.

---

## 4. What is in scope at the append point (immediately before `return`, i.e. `:204`)

All bindings live in `generate`'s scope there:

| binding | file:line | note |
|---|---|---|
| `rng`, `planetData`, `moonIndex`, `totalMoons`, `parentZone`, `zones` | `:93` (params) | `zones` **defaults to `null`** |
| `isLargeParent` | `:98` | |
| `type` | `:103` | |
| `moonRadiusData` `{radiusEarth, radiusScene, radius}` | `:108` (built `:233-237`) | |
| `palette` | `:110` | |
| `orbitZone` `:121`, `minMult/maxMult` `:131`, `zoneSpread` `:133`, `orbitMultiple` `:134` | | |
| `orbitRadiusEarth` | `:137` | moon's orbit about the **parent**, in R⊕ |
| `orbitRadiusScene` `:138`, `mapBaseOrbit` `:142`, `orbitRadius` `:143`, `orbitSpeed` `:147` | | |
| `inclination` `:150`, `retrograde` `:155`, `startAngle` `:157` | | |
| `tidalHeating` | `:161-163` | already computed, draw-free |
| `EARTH_RADIUS_AU`, `earthRadiiToScene`, `AU_TO_SCENE` | imported `:1` | lets `orbitRadiusEarth` → AU |

**Measured presence on the parent** (`planetData`), 1541 `generate` calls over `wd-0…wd-399`, all keys present on **1541/1541**: `massEarth, radiusEarth, composition {carbonToOxygen, ironFraction, volatileFraction, surfaceType, density}, T_eq, tidalState {locked, lockType}, surfaceHistory, age, metallicity, eccentricity, tidalHeating, atmosphere, type, sunDirection`. `zones` was **non-null on 1541/1541** production calls with all 9 keys (`frostLine, hzInner, hzOuter, starType, metallicity, sizeBias, luminosity, ageGyr, starMassSolar`).

Per Step 8a's named derivations:

| derivation | reachable? | evidence |
|---|---|---|
| **`massEarth`** = radius³ × parent-derived density | ✅ **in scope** | `moonRadiusData.radiusEarth` (`:108`) and parent density = `planetData.massEarth / planetData.radiusEarth³`, both defined on 1541/1541. Measured parent density range (Earth = 1): **0.0759 … 1.2980**. `planetData.composition.density` (kg/m³) is also present and >0 on 1541/1541 as an alternative. |
| **`age`** (the system's) | ✅ **in scope, two routes** | `planetData.age` present 1541/1541, range **0.1000 … 11.5339 Gyr**; and `zones.ageGyr` 1541/1541. Measured `planetData.age === zones.ageGyr` on **1541/1541** (0 mismatches). ⚠ The `zones` route is null-defaulted at `:93`; the `planetData.age` route is not. |
| **`T_eq`** from the **parent's real orbit radius** | ⚠ **NOT reachable as written** | **`planetData.orbitRadiusAU` is `undefined` on 1541/1541 parents.** The parent's orbit in AU is a local in `StarSystemGenerator` (`:517-543`, forwarded to the wrapper at `:605`), never written onto `planetData`. `equilibriumTemperature(luminosityRel, orbitAU)` (`PhysicsEngine.js:121`) therefore cannot be called with a real orbit radius from this scope. **Two workarounds, both with a measured cost — see below.** |
| **`composition`** | ⚠ **NOT reachable without violating the append rule** | `deriveComposition(metallicity, orbitAU, frostLineAU, rngFloat)` (`PhysicsEngine.js:380`) needs (a) `orbitAU` — same gap as `T_eq` — and (b) **`rngFloat`, a random draw**. `zones.metallicity` / `planetData.metallicity` and `zones.frostLine` are in scope; the other two are not. This is precisely the `deriveComposition(…, rngFloat)` splice the plan warns about — at the append point it is *safe* (after the last draw), but it is a **new draw on the shared stream**, so it still moves every downstream consumer of that moon's `rng`… of which there are none, because `rng` is the moon's own child (`StarSystemGenerator.js:594`) and is discarded after `generate` returns. **Measured consequence of appending draws after `:204`: none on any other body.** But it reds Instrument B's DRAW channel, so use the `:257-263` namespace pattern instead (§5). |
| **`surfaceHistory`** | ✅ **in scope** | `computeSurfaceHistory(ageGyr, nearBelt, nearGiant, hasAtmosphere, tidalHeatingRate)` (`PhysicsEngine.js:796`). `ageGyr` ✅; `nearBelt`/`nearGiant` — `PlanetGenerator.js:610-611` itself passes `false, false` ("refined by system generator later"), so a moon may do the same; `hasAtmosphere` = `type === 'terrestrial'` (`:193`); `tidalHeatingRate` = `tidalHeating` (`:161`) — note `PlanetGenerator.js:618` deliberately passes `0` here, so a moon passing the real value is a **deliberate divergence** that must be stated, not inherited. |
| **`tidalState`** | ✅ **in scope, fully** | `tidalLockTimescale(massParent, massBody, radiusBody, semiMajorAU)` (`PhysicsEngine.js:264`) → `checkTidalLock(t, ageGyr)` (`:280`). `massParent` = `planetData.massEarth` ✅, `massBody` = the new derived moon mass ✅, `radiusBody` = `moonRadiusData.radiusEarth` ✅, `semiMajorAU` = `orbitRadiusEarth * EARTH_RADIUS_AU` (`:137` × import at `:1`) ✅, `ageGyr` ✅. Zero unreachable inputs. |

### The `orbitRadiusAU` gap, measured

Two ways out, both measured over 893 moon-bearing planets (seeds `wd-0…wd-399`):

**(a) Use the parent's own `T_eq` directly** (same stellar distance, same 0.3 albedo). Present on 1541/1541. Exact by construction. This satisfies the *physics* the plan wants, but not its literal wording.

**(b) Invert `equilibriumTemperature`** — `T ∝ d^-1/2`, so `orbitAU = (equilibriumTemperature(zones.luminosity, 1) / planetData.T_eq)²`. Result:

```
exact to float (rel err ≤ 1e-15):  828/893
rel err > 1e-9:                     65/893  (7.3%)
rel err > 1%:                       42/893  (4.7%)
rel err > 10%:                       4/893  (0.45%)
worst: wd-167  trueAU 0.03575  recovered 10.552  (294× off)  T_eq 78.37K, lum 1.0
```

**Root cause of the 65:** `StarSystemGenerator.js:655` `migrantInSurviving.orbitRadiusAU = migrationResult.finalOrbitAU;` mutates the wrapper's orbit **after** `PlanetGenerator.generate` (`:563`) computed `T_eq` at the pre-migration orbit; resonance snapping (`:543`) does the same. Grep confirms `T_eq` is never re-derived: **zero** occurrences of `T_eq` in `StarSystemGenerator.js`.

Consequence for Step 8a: **a migrated parent's own `T_eq` is already stale relative to its real orbit.** So route (a) inherits that staleness silently, and route (b) reproduces it *plus* a 294× outlier. Neither is "T_eq from the parent's real orbit radius." Closing this properly means threading `orbitRadiusAU` into `MoonGenerator.generate` as a parameter (or onto `planetData`) — a signature change the plan does not currently budget for.

---

## 5. The dedicated-namespace pattern (`:244-251` doc, `:257-263` code)

Documentation, `MoonGenerator.js:244-251`:

> Moons carry NO eccentricity field, so we SEED one from a DEDICATED sub-rng keyed on the moon's stable identity (parent identity + orbit + radius), exactly like the planet-eccentricity pattern (PlanetGenerator AC2). This draws ZERO numbers from the passed-in moon-generation `rng`, so moon generation is byte-identical and the additive gate stays green. The moon eccentricity range (0–0.012) brackets Io's real e≈0.0041; tidal flexing of a close inner moon stays nonzero (a perfectly circular orbit gives 0 heat).

Code, `MoonGenerator.js:257-263`:

```js
  static _computeTidalHeating(planetData, moonRadiusEarth, orbitRadiusEarth) {
    const eccSeed = `moonecc:${planetData.massEarth}:${planetData.radiusEarth}:${orbitRadiusEarth}:${moonRadiusEarth}`;
    const eccRng = new SeededRandom(eccSeed);
    const moonEcc = eccRng.range(0.0, 0.012); // brackets Io's e≈0.0041
    const parentMassEarth = planetData.massEarth || 0;
    return tidalHeatingFn(moonEcc, parentMassEarth, moonRadiusEarth, Math.max(orbitRadiusEarth, 1e-6));
  }
```

Same pattern at `PlanetGenerator.js:391` — `const eccSeed = \`ecc:${orbitRadiusAU}:${metallicity}:${starMassSolar}:${zones?.starType ?? 'none'}\``.

**How a new derivation uses it.** Build a **string namespace prefix unique to the derivation** plus the moon's stable identity, construct a fresh `new SeededRandom(seed)`, and draw from *that*. E.g. for the `rngFloat` argument `deriveComposition` requires:

```js
const compSeed = `mooncomp:${planetData.massEarth}:${planetData.radiusEarth}:${orbitRadiusEarth}:${moonRadiusData.radiusEarth}`;
const compRng  = new SeededRandom(compSeed);
const composition = deriveComposition(metallicity, orbitAU, frostLineAU, compRng.float());
```

Three rules the shipped instance encodes:
1. **The prefix must be new** (`moonecc:` vs a new `mooncomp:`) — reusing `moonecc:` would hand `deriveComposition` the identical float as the eccentricity, correlating two independent physical quantities.
2. **The identity key must be values already drawn**, so the sub-rng is a pure function of the moon and never touches the shared stream. `_computeTidalHeating` keys on parent mass + parent radius + moon orbit + moon radius — all fixed by `:137` and `:108`.
3. ⚠ **The key is not unique.** Two moons of the same parent with identical `orbitRadiusEarth` **and** identical `moonRadiusEarth` collide and get the same draw. Not measured here as a live collision — flagging it because a Step-8a namespace would inherit the same key and the same exposure; adding `moonIndex` (in scope, `:93`) to the seed string would close it, at the cost of changing `_computeTidalHeating`'s output for every moon.

Also: the sub-rng costs **zero** draws on `rng`, confirmed by the trace — no site appears between `:157` and `:185` in any of the 6904 recorded streams.

---

## 6. Existing tests pinning the draw stream / draw count

**No test pins a per-moon-type draw COUNT.** That gate does not exist; Step 8a's "per-type draw-count assertion" would be new.

What does exist:

- **`tests/body-identity-fence.test.js` (Instrument B) — the closest thing, and it does not do it.** It installs a prototype-accessor draw counter (`:205-243`, `installDrawCounter`) that counts the whole `SeededRandom` tree including `child()`, and pins a **per-yield cumulative draw profile** per seed (`DRAW STREAM: the per-yield draw profile is unchanged for every seed`, `:466-486`). Granularity is the yield chunk, not the moon: `StarSystemGenerator.js:593` `if (m > 0) yield;` folds **moon 0 of every planet into that planet's chunk**. Measured `wd-0` profile: `[14,35,68,82,96,115,134,166,204,205,4785,8889,8897,8903]` for 6 planets / 4 moons / 2 belts / 2 trojans. It also pins a full-record hash of every moon (`moonRecord`, `:195-203` — *all* keys) and the record key-set (`RECORD SHAPE`, `:518-527`; `baseline.moonShapes` currently holds exactly 2 shapes). Verified green now: `npx vitest run tests/body-identity-fence.test.js` → **8 passed, 1 file passed, 2.06s**.
- **`src/generation/__tests__/world-engine-l0-moon-grid.js` + `__fixtures__/l0-moon-baseline.json`**, gated by `world-engine-l0-plumbing.test.js:448-475`. Freezes 5 moons (`MOON_GRID`, `world-engine-l0-moon-grid.js:44-50`) against a fixed gas-giant parent, comparing **pre-existing keys only** (`MOON_BASELINE_KEYS`, `:452`). It catches a spliced draw (via `noiseScale`) on those 5 bodies, but the grid is documented as "Picked to land on REGULAR moons" — no terrestrial, no planet-class, so `:189-:202` are unwatched by it.
- `tests/moon-mass-radius-consistency.test.js` — value invariant on planet-class moons, not the stream.
- `tests/worldengine-lid-disruption-drawcount.test.js` / `worldengine-v2-6-drawlaw.test.js` — grep confirms **zero** `MoonGenerator`/moon references; they are world-engine lid/draw-law tests, unrelated.

### ⚠ Contradiction between Step 8a's gate and the instrument it names

The plan's 8a gate says Instrument B hashing the entire moon record "**Must be byte-identical. If it goes red, a draw leaked into the shared stream and the commit is wrong.**"

`moonRecord` (`tests/body-identity-fence.test.js:195-203`) copies **every** key. Appending `massEarth`/`age`/`T_eq`/`composition`/`surfaceHistory`/`tidalState` changes every moon hash *and* `moonShapes` **by construction, with zero draws moved**. The test file already says so, at `:518-524`:

> Named separately from the value channel so an ADDITIVE field (plan Step 8 gives moons a condition record, "derived and never drawn") reports itself by name instead of arriving as an opaque hash mismatch. When Step 8 lands, **this test and the value test go red together while the DRAW test stays green — that combination is the proof the addition really was additive.**

So the gate as written in the PLAN would condemn a correct commit. The channel that must stay byte-identical on 8a is the **per-yield draw profile**, not the record hash; the hash and shape channels are expected red and require a `WD_REBLESS_BODY_IDENTITY=1` re-bless committed on its own.

---

## Lane transcript `a42ff6540b336905a`

**LANE 2 RECON — `conditionFromPlanet` → `conditionFromBody`. All numbers measured; repo left untouched (`git status --porcelain | grep -v '^??'` → 0 tracked modifications, HEAD `f679046`).**

Method note: measurements were reproduced in a hardlink-free tar copy at `/tmp/claude/wd-sim` (node_modules symlinked). The copy reproduces the live citation-fence numbers **byte-identically** (400/421/0/0/0/2/1/6, exit 0), so simulated renames there are valid evidence.

---

## 1. Every occurrence of `conditionFromPlanet` repo-wide

**Total: 314 grep hits** (excluding `node_modules`, `.git`, `dist`, `scratchpad`, `.claude`). Two lexically distinct things are being counted, and the distinction is the whole story:

| form | occurrences |
|---|---|
| filename form `conditionFromPlanet.js` | **87** |
| bare identifier `conditionFromPlanet` (negative-lookahead `.js`) | **249** |

### Classification totals (by grep line, 314 lines)

| class | count |
|---|---|
| CALL SITE (executable `conditionFromPlanet(` ) | 146 |
| CITATION-IN-MARKDOWN / .html prose | 74 |
| COMMENT-OR-PROSE (inside `.js`/`.mjs`) | 62 |
| FILE-PATH STRING (incl. the 16 `import … from '…/conditionFromPlanet.js'` lines) | 22 |
| IMPORT SPECIFIER w/o path on the same line | 2 |
| BARE STRING LITERAL `'conditionFromPlanet'` | 2 |
| OTHER (destructured binding / template-literal prose) | 6 |
| TEST NAME (`it(`/`describe(` title) | **0** |

⚠ The `IMPORT SPECIFIER` row is misleading on its own and I am flagging it rather than reporting it: 16 lines carry the specifier **and** the path on one line, so they fell into FILE-PATH STRING. The true import count is **16** (`src/generation/PlanetGenerator.js:1`, `src/objects/Planet.js:11`, plus 14 in `tests/`+`tools/`; `tests/port-condition-contract.test.js:74` is the multi-line `} from …` tail). Scratchpad adds 30 more importers, excluded per instruction.

### Code-vs-comment split per file (the operative table)

`ID-code` = bare identifier on a non-comment line; `PATH-*` = filename form.

```
file                                          ID-code PATH-code ID-cmt PATH-cmt
src/generation/MoonGenerator.js                    0      0       1      0
src/generation/PlanetGenerator.js                  2      1       2      0
src/generation/SolarSystemData.js                  0      0       3      0
src/main.js                                        0      0       2      0
src/objects/Planet.js                              2      1       2      0
src/worldengine/base/conditionVector.js            0      0       1      2
src/worldengine/base/e1Regime.js                   0      0       0      1
src/worldengine/base/giant-drivers.js              0      0       0      1
src/worldengine/base/storm-e.js                    0      0       0      1
src/worldengine/drivers/giantDeck.js               0      0       1      0
src/worldengine/drivers/limbDeck.js                0      0       1      0
src/worldengine/drivers/polarDeck.js               0      0       1      0
src/worldengine/port/conditionFromPlanet.js        1      0       4      1
tests/body-identity-fence.test.js                  0      0       1      0
tests/crater-uniform-law.test.js                  13      1       1      0
tests/driver-pack-giantdeck.test.js                4      1       0      0
tests/driver-pack-limbdeck.test.js                 2      1       0      0
tests/driver-pack-polardeck.test.js                4      1       0      0
tests/gas-body-lab-material.test.js                6      1       0      0
tests/material-parity-list.test.js                 6      1       0      0
tests/moon-mass-radius-consistency.test.js         3      1       2      0
tests/port-condition-contract.test.js             89      3       8      5
tests/port-limb-optics.test.js                     6      1       2      1
tests/port-route-agreement.test.js                 9      1       5      0
tests/radius-live-feed-fence.test.js               0      1       0      2
tests/source-scan-helper.test.js                   0      1       0      0
tests/src-boundary-fence.test.js                   0      1       0      0
tools/find-test-systems.mjs                        3      1       0      0
tools/port-condition-delta.mjs                    10      2       5      0
tools/port-crater-measure.mjs                      3      1       0      0
tools/port-ice-lava-measure.mjs                    2      1       0      0
tools/port-palette-measure.mjs                     2      1       0      0
tools/port-uniform-delta.mjs                       1      3      (3)    (3)
TOTALS  ID-code 168 / 19 files · PATH-code 26 / 21 files · ID-cmt 45 / 18 · PATH-cmt 17 / 9
```

Docs+`.html`: **9 files**, 45 bare-identifier + 63 filename-form occurrences. `planet-lod-lab.html:1711` is the only non-`docs/` prose hit.

---

## 2. ⛔ THE `type` CLAIM IS WRONG — but wrong in the plan's favour, so this stays a rename

PLAN.md:390 claims `type` appears in `conditionFromPlanet.js` "only in comments at `:9,:10,:11,:83`."

**Every `\btype\b` (case-insensitive) occurrence in the 897-line file, with code/comment verdict:**

```
  9 [COMMENT] // ⚠ THIS ADAPTER READS `type` FOR NOTHING. That is deliberate and load-bearing…
 10 [COMMENT] // …laws key off physical scalars, never a type label. If a future edit
 11 [COMMENT] // needs `planetData.type` in here to make something come out right, that is a signal…
350 [COMMENT] //     MoonGenerator.js:193 `atmosphere: type === 'terrestrial' ? {` — a `{ color, strength }` literal
545 [COMMENT] //     TEXT, AND A NODE TYPE NOBODY HAS BUCKETED IS A FAILURE, NOT A PASS…
546 [COMMENT] //     BUCKETED TYPE IS STILL SILENT — two such holes are known and named in KNOWN LIMITS in
582 [COMMENT] // node-TYPE level, so a construct nobody had modelled was silently fine…
584 [COMMENT] // for a bucketed type still passes silently, and two such holes are known (KNOWN LIMITS…
```

Two defects in the claim:

- **`:83` is `//` — a bare comment-continuation line with no `type` on it at all.** Not "off by a step's line growth": I checked the commit that *wrote* the claim, `dcad360`, where the file was **140 lines** and `type` appeared at **9, 10, 11 and nowhere else**; `:83` there reads `// spanning 11 orbits x 6 metallicities x 5 types:` — i.e. `types`, plural, not `\btype\b`. **The citation was wrong on the day it was written**, before any line-rot.
- **It misses 4–5 real occurrences** (`:350`, `:584`, plus uppercase `:545`, `:546`, `:582`).

**But the substantive claim HOLDS, loudly and in the plan's favour: 8/8 occurrences are COMMENTS, 0/8 are code.** The only word-boundary-adjacent code hits are `typeof` (`:315`, `:317`, `:372`) — a different token. Nothing in the adapter reads `planetData.type`. **This remains a rename, not a redesign.** The line list `:9,:10,:11,:83` should be replaced with the symbol-only form §10 already mandates for this file, since it is the exact rot class §10 exists to stop.

---

## 3. ⛔ THE CITATION HAZARD — measured, and it is *smaller* than it looks, on one condition

**§10's rule** (PLAN.md:666, row 1 of the three-form table): `src/worldengine/port/conditionFromPlanet.js` **(all of it)** takes symbol-only refs, no integer — one of the two named regions, the other being the record-literal/bake region at the bottom of `PlanetGenerator.generate`.

**The two lines in `tools/port-uniform-delta.mjs` that bind the file by path:**
- `:943` — `'conditionFromPlanet.js': 'src/worldengine/port/conditionFromPlanet.js',` (CITE_FILES override)
- `:1042` — `'src/worldengine/port/conditionFromPlanet.js',` (CITE_SOURCES, one of 28 entries)

**Citations pointing INTO the file:**

| | count |
|---|---|
| **with a line number**, inside the CITE_SOURCES scanned set | **6** (`CARRIED.md:26→:361`, `CARRIED.md:26→:268` (bare-`:NNN` continuation form), `CARRIED.md:70→:158`, `port-condition-contract.test.js:1149→:149`, `:1165→:671`, `radius-live-feed-fence.test.js:459→:652`) |
| with a line number, **outside** the scanned set (ungated) | **9** — `one-pipeline-two-frontends-review-round3-2026-08-07.md` ×7 (`:194`, `:496`×2, `:184`×2, `:322`, `:337`), `lab-pipeline-into-game-PLAN.md` ×2 (`:24`, `:119`), `port-limb-optics.test.js:157→:369` |
| **symbol-only, §10-compliant** (``conditionFromPlanet.js `sym` ``) | **4** — `PLAN.md:216`, `PLAN.md:245`, `PLAN.md:572`, `planet-lod-lab.html:1711` |
| carrying a line number **and** a symbol (i.e. FATAL-column) | **0** |

⚠ **The finding that matters:** `CITE_RE` (`tools/port-uniform-delta.mjs:1090`) is `/([A-Za-z0-9_.\-]+\.(?:js|mjs|html|md)):(\d+)|(?<![\w.\/:]):(\d+)/g` — it **requires** `:\d+`. So the 4 §10-compliant symbol-only refs are not CHECKED, not UNCHECKED, not UNRESOLVED — **the fence cannot see them at all.** §10's own preferred form for this file is the one form its machine check is blind to. That is a fact about the instrument, not a bug I am asserting: it follows from the regex and is confirmed by the counters below never moving under any file-rename scenario.

### `npm run port-uniform-delta:citations` — BEFORE number (run just now, live repo)

```
self-control    : PASS
refs CHECKED    : 400
refs UNCHECKED  : 421
refs UNRESOLVED : 0
refs PAST-EOF   : 0
refs MALFORMED  : 0
refs TICK-PARITY: 2
refs SPAN-OPEN  : 1
refs ILLUSTRATIVE: 6
RESULT: all 400 symbol-anchored citations resolve. Exit 0.
```

### What a FILE rename actually breaks — three simulated scenarios, all run

| scenario | result |
|---|---|
| **B1** file renamed, nothing else | `EXIT 69` — module load dies first: `Cannot find module …/conditionFromPlanet.js imported from …/src/objects/Planet.js`. Instrument C never reaches the fence. |
| **B1″** file renamed + all 16 import paths fixed, `port-uniform-delta.mjs` stale | `EXIT 3` — `⛔ CITE_FILES maps basenames to paths that DO NOT EXIST. conditionFromPlanet.js → src/worldengine/port/conditionFromPlanet.js`. Loud, precise, one line to fix. |
| **B2** file renamed, CITE_FILES **key kept** `'conditionFromPlanet.js'`, only the **value** + the CITE_SOURCES entry repointed (the Step-7 precedent written into the comment at `tools/port-uniform-delta.mjs:964-971`) | `EXIT 0`, counters **diff-identical to baseline**: 400/421/0/0/0/2/1/6. **Zero citations repaired.** |
| **B3** key "tidied" to `'conditionFromBody.js'` | `EXIT 2` — `conditionFromPlanet.js ×6 [NOT FOUND in repo]`, naming exactly the 6 scanned line-numbered refs above. This is the trap `tools/port-uniform-delta.mjs:964` explicitly forbids. |

**So: a file rename costs 2 lines in one file (`tools/port-uniform-delta.mjs:943` value, `:1042`) and repairs 0 citations — provided the CITE_FILES *key* does not move.** Line numbers survive because a pure rename preserves content byte-for-byte.

### What a FUNCTION rename breaks in the fence — 1 CHECKED citation, fatal

**Scenario C** (identifier renamed across 27 code files, filename untouched): `EXIT 2`, counters otherwise identical.

```
⛔ BROKEN CITATIONS — the symbol is NOT on the cited line:
   docs/FEATURES/one-pipeline-two-frontends-PLAN.md:779  cites  Planet.js:1594
       `const condition = conditionFromPlanet(d);`
   that line actually reads: const condition = conditionFromBody(d);
```

That is the **only** `line + symbol` citation repo-wide whose symbol contains the identifier (verified: `grep -rnoP ':\d+\s*\`[^\`]*conditionFromPlanet[^\`]*\`'` → 1 hit). It is caught fatally.

⚠ **Silent-rot residue, non-fatal by design:** `tests/port-route-agreement.test.js:13` reads `*   RENDER src/objects/Planet.js:1594 — \`conditionFromPlanet(d)\` where \`d =` and is classified **TICK-PARITY** (odd backtick count). `tickParity` has no `process.exit` path (exits are only on `broken`, `unknown`+`unknownNoSym`, `pastEof`, `punctOnly` — `tools/port-uniform-delta.mjs:1565-1569`). If that comment is left stale it cannot fail the build. That is `CARRIED.md` row **C12**, already open.

---

## 4. Things keyed on the STRING — 2 live gates, both fatal, both easy to miss

`grep -rnoP "['\"\`]conditionFromPlanet['\"\`]"` → 29 hits, of which **2 are single-quoted executable strings**, both in `tests/port-condition-contract.test.js`:

- **`:2757`** `const adapterName = opts.adapter || 'conditionFromPlanet';` — the AST analyser finds the adapter **by name** (`:2794` `if (nm === adapterName)`, `:2798`). Measured negative check (export renamed, this string left stale): **4 tests RED**, e.g. `AssertionError: the analysis must converge: the adapter \`conditionFromPlanet\` was not found in this source` and `PROVENANCE_COVERAGE claims … but the adapter no longer reads it: expected [ 'comp.carbonToOxygen', …(20) ] to deeply equal []`.
- **`:3660`** the pinned export surface `'atmosphereFromPlanet', 'axialTiltDegreesOf', 'conditionFromPlanet',`. Measured in isolation (`:2757` correct, `:3660` stale): **1 test RED** — `expected [ 'PROVENANCE_COVERAGE', …(10) ] to deeply equal […]`. Note `conditionFromBody` sorts into the same slot, so only the spelling changes.

**Path-keyed strings (break on a FILE rename, not a function rename) — 6 sites outside the import lines:**
- `tools/port-condition-delta.mjs:107` `await loadOrExplain('src/worldengine/port/conditionFromPlanet.js')`
- `tests/source-scan-helper.test.js:656` `expect(files).toContain('src/worldengine/port/conditionFromPlanet.js')`
- `tests/src-boundary-fence.test.js:172` `const VICTIM = 'src/worldengine/port/conditionFromPlanet.js'` (the planted-defect subject for 3+ negative checks)
- `tests/radius-live-feed-fence.test.js:66` `const ADAPTER_REL = 'src/worldengine/port/conditionFromPlanet.js'`
- `tests/port-condition-contract.test.js:3281` `fileURLToPath(new URL('../src/worldengine/port/conditionFromPlanet.js', import.meta.url))`
- `tools/port-uniform-delta.mjs:943`, `:1042`

**Nothing else keys on it.** Verified absent: `grep -rl conditionFromPlanet --include=*.json --include=*.snap` → **0 hits** (no baseline fixture, no `_provenance` tag, no serialized record, `tests/baseline/` clean). Cosmetic only: `tests/port-route-agreement.test.js:160` embeds the name in an error-message template literal.

**Whole-suite check:** with the identifier renamed across all 27 code files (both strings included), the 14 affected test files run **486 passed / 1 failed, 487 total** — and the 1 failure is a **sim artifact**, not the rename: `driver-pack-giantdeck.test.js:450` shells out to `git -C ROOT show 4e864bc…:planet-lod-lab.html` and the tar copy has no `.git`. The same file is **73/73 green** on the live repo.

---

## 5. RECOMMENDATION — **rename the file too**, in the same commit

| | function only | function **+ file** |
|---|---|---|
| code files touched (mandatory) | 19 (`ID-code` ≥ 1) | **25** (adds `e1Regime.js`, `giant-drivers.js`, `storm-e.js`, `radius-live-feed-fence.test.js`, `source-scan-helper.test.js`, `src-boundary-fence.test.js` for the path string) |
| code files touched if comments are kept consistent | 27 | **33** |
| doc/`.html` files that go stale | 9 | 9 (same set) |
| citations that must be repaired | **1** (`PLAN.md:779`) | **1** (same one) |
| lines to change in `tools/port-uniform-delta.mjs` | 1 (the `:1594` symbol is elsewhere; only its own prose) | **+2** (`:943` value, `:1042`) |
| `port-uniform-delta:citations` after | 400/421, exit 0 | **400/421, exit 0 — diff-identical** (measured, scenario B2) |
| gates that catch a miss | citation fence exit 2; 5 tests RED | same, plus `EXIT 3` dead-CITE_FILES and `EXIT 69` module-not-found — **strictly louder** |

**The marginal cost of also renaming the file is 6 extra files and 2 extra lines, and it repairs zero additional citations.** §10's symbol-only rule is what makes it cheap: the 4 compliant refs into this file carry no integers, and the 15 that do carry integers survive because a rename preserves content byte-for-byte and the CITE_FILES *key* is a citation spelling, not a basename.

Three further reasons:

1. **The PLAN already assumes it.** `PLAN.md:398` lists `src/worldengine/port/conditionFromBody.js` under Step 8's **Files.**, and `PLAN.md:584` already writes prose in the post-rename name. Renaming only the export leaves the plan citing a file that does not exist — and `PLAN.md` is in CITE_SOURCES, so the discrepancy sits in the scanned set with no gate that can see it (the ref is symbol-less prose, not `file:NNN`).
2. **Splitting it costs a second migration.** `conditionFromBody` living in `conditionFromPlanet.js` is the exact "wrong-and-ungated" state §11.3.4 was written against — every future author's grep for the moon adapter lands on the planet filename.
3. **Step 7 already ran this exact play and left the recipe in-file** (`tools/port-uniform-delta.mjs:964-971`: four values repointed, keys deliberately frozen, 152 pre-move refs kept resolving). Following it here is not novel work.

⛔ **Two hard preconditions, both measured:**
- **Do NOT change the CITE_FILES key** at `:943` — repoint the value only. Tidying the key is `EXIT 2` with 6 unresolved refs (scenario B3).
- **Fix `PLAN.md:779`'s symbol** in the same commit (`Planet.js:1594 \`const condition = conditionFromPlanet(d);\`` → `conditionFromBody`). It is the one FATAL-column citation the rename breaks.

**Also fold into Step 8a (independent of the file decision):** correct `PLAN.md:390`'s `type` citation. Replace `` `type` appears in that file only in comments at `:9,:10,:11,:83` `` with the symbol-only form §10 requires for this exact file — e.g. *"`type` appears in that file in comments only, zero code reads; the load-bearing note is `conditionFromPlanet.js` `⚠ THIS ADAPTER READS`."* Per §10's line-count-neutrality rule below `:24`, **expand that line, do not insert one.**

---

## Lane transcript `ad6af39aa4ca20ec8`

LANE 4 — RE-MEASUREMENT REPORT. Tree: `feature/world-engine-production-L1` @ `f679046`, no tracked file modified (verified `git status --porcelain` shows only pre-existing untracked artifacts). Scripts in `/tmp/claude-1000/-home-ax/237cc0d0-1e26-4841-ac3a-117ca5c72fbe/scratchpad/`.

---

# SHARED MECHANISM (needed to read a–b)

`src/worldengine/port/conditionFromPlanet.js:730` — `massEarth: d.massEarth ?? 1.0`
`src/worldengine/base/baseStep.js:18-19` — `surfaceGravity = massEarth / (radiusEarth * radiusEarth)`
`src/worldengine/base/conditionVector.js:134` — `(derived?.surfaceGravity ?? bodySurfaceGravity(fp)) * gravityRadiusRatio(_R, _R_c, _class)`; `_R === _R_c` on this route so the ratio is exactly 1.0.

⇒ **for any body with no `massEarth`, derived `surfaceGravity` is exactly `1/R²` in Earth radii.** Measured: 6,542 of 6,719 moons carry no `massEarth`.

---

# (a) "surfaceGravity over the whole moon population lies in [0,3] g … 10.4 / 14.1 / 56.3 g … 11 km Phobos-class body derives 346,021 g"

**Population (fully specified):** 5 seed families × 400 seeds = 2,000 systems via `StarSystemGenerator.generate(seed, null)` — prefixes `pcc-`, `lane4-`, `lab-procedural-`, `seed-`, and bare numeric `"0".."399"` — **plus** Sol via `generateSolarSystem()`. Every moon of every planet: `conditionFromPlanet(m.isPlanetMoon ? m.planetData : m)`. **n = 6,719 moons** (6,693 generated + 26 Sol).

| | n | min | p25 | **median** | p75 | p95 | **max** | **>3 g** | in [0,3] |
|---|---|---|---|---|---|---|---|---|---|
| ALL moons | 6719 | 0.1379 | 6.072 | **33.254** | 681.33 | 3992.5 | **1,000,000** | **5529 (82.3%)** | 1190 |
| plain moons | 6541 | 0.1379 | 7.376 | 36.839 | 720.20 | 4074.3 | 1,000,000 | 5528 | 1013 |
| planet-class | 178 | 0.1617 | 0.4431 | 0.7656 | 1.2533 | 2.1463 | **3.2596** | **1** | 177 |
| Sol only | 26 | 0.2799 | 22.250 | 118.147 | 730.46 | 5917.2 | 1,000,000 | 25 | 1 |

**346,021 g — REPRODUCES EXACTLY.** `sol#3.0` = **Phobos**, `src/generation/SolarSystemData.js:230` `radiusEarth: 0.0017,   // ~11 km` → measured `surfaceGravity = 346020.76124567474` = `1/0.0017²`.

**WORST OFFENDER IS NOT PHOBOS.** `sol#3.1` = **Deimos**, `SolarSystemData.js:241` `radiusEarth: 0.001,    // ~6 km` → **exactly 1,000,000 g**. The plan names the second-worst body in the tree. Worst generated body: `seed-66#0.0`, captured, 41.3 km, **23,766 g**.

**10.4 / 14.1 / 56.3 — DOES NOT REPRODUCE as a specified triple; UNATTRIBUTABLE.** Not present in Sol's 26 moons (Sol's neighbours are 5.863, 6.999, 12.226, 13.418, 16.660, 22.250, 65.036). Back-solved radii are 1975.6 km / 1696.7 km / 849.1 km. In the 6,719-moon corpus: 13 bodies within ±0.05 of 10.4, 16 within ±0.05 of 14.1, **0** within ±0.05 of 56.3. Consistent with three arbitrary hand-picked samples. **Correct numbers: median 33.25 g, max 1,000,000 g, 82.3% above 3 g.** The triple understates the defect by 2–4 orders of magnitude. **DIRECTION SURVIVES; the plan's own headline numbers are far too kind to the current state.**

⚠ **A SEPARATE FAILURE THE GATE AS WRITTEN WOULD ALREADY TAKE:** the 178 planet-class moons — the only ones with a real `massEarth` today — max at **3.2596 g**, i.e. **one body already breaks `[0, 3]`** before Step 8 changes anything. The shipped fence `tests/moon-mass-radius-consistency.test.js` asserts `< 5`, not `< 3`. Writing the gate at 3 g reds on a body the mass fix (`b43c090`) already considers correct. Verified: `npx vitest run tests/moon-mass-radius-consistency.test.js` → 5 passed.

---

# (b) "Sol's Moon derives 13.42 g today, target 0.165 ± 0.01 g"

**REPRODUCES.** Body: `sol#2.0`, `profileId: 'sol-moon'`, `src/generation/SolarSystemData.js:194` `radiusEarth: 0.273`, no `massEarth`.
Measured today: **`surfaceGravity = 13.41759583517825`**, bit-identical to `1/0.273² = 13.41759583517825`.
Target check: real Moon `0.0123 M⊕ / 0.273² = 0.16503642877269248` → the 0.165 target is the real body and is self-consistent. ✅ both halves.

---

# (c) call site + "T_eq 254.588 at 1.0 AU vs 43.033 at 30 AU (5.9×)"

**CALL SITE — REPRODUCES EXACTLY.** `src/generation/MoonGenerator.js:278`:
```js
const pData = PlanetGenerator.generate(rng, 1.0, planetData.sunDirection, zones, planetType);
```
Signature `PlanetGenerator.js:326 static generate(rng, orbitRadiusAU, sunDirection = null, zones = null, forceType = null)` — arg 2 is `orbitRadiusAU`. Confirmed.

**254.588 at 1.0 AU — REPRODUCES EXACTLY** (`PhysicsEngine.js:121 equilibriumTemperature`, L=1, albedo 0.3): `254.588`.

**43.033 at 30 AU — DOES NOT REPRODUCE. 43.033 is the value at exactly 35.000 AU.**

| AU | T_eq (L=1, A=0.3) | ratio vs 1 AU |
|---|---|---|
| 30 | **46.481** | **5.477×** |
| 35 | **43.033** | **5.916×** |
| 40 | 40.254 | 6.325× |

The "5.9×" ratio is right *for a 35 AU body*. At the stated 30 AU it is 5.477× and 46.481 K. Direction survives; the AU label is wrong.

⚠ **A LARGER CORRECTION THE PLAN MISSES ENTIRELY.** `PlanetGenerator.js:368` `const luminosityRel = zones?.luminosity || 1.0;` — so "1.0 AU" is not a fixed temperature. Measured over **233 real planet-class-moon generations** (4 seed families × 600 seeds):

- today's derived `T_eq` spans **113.86 … 5958.25 K**
- at the parent's real orbit AU it spans **40.89 … 409.60 K**
- ratio today/correct: min **0.404**, p25 1.066, **median 1.797**, p75 3.122, max **57.23**
- **112 / 233 (48.1%) are wrong by more than 2× in one direction or the other**

The failure is **not** "moons are too hot": about a quarter of them are too **cold** today (a moon of a 0.04 L☉ M-dwarf planet at 0.305 AU derives 113.86 K where the truth is 206.16 K). The plan's one-directional framing ("a 40 AU icy moon carries an inner-system temperature") describes one tail of a two-tailed error.

Note for implementation: **the parent's orbit AU is not reachable from inside `_generatePlanetMoon` today.** `planetData` carries no `orbitAU` (`PlanetGenerator.js:421` `orbitAU: orbitRadiusAU` is an argument inside the `computeAtmosphere` params object, not a record field); `_generatePlanetMoon(rng, planetData, moonIndex, parentZone, zones)` receives only the zone label. 8b needs a plumbing change first.

---

# (d) "~3.5% of moons already reach Planet.js today"

**Operational definition (the code path that decides it):** `src/main.js:7636` `if (moonData.isPlanetMoon)` → `src/main.js:7657` `const planetMoon = new Planet(scenePMData, pmStarInfo);`. The `else` at `:7659` is `BodyRenderer.createMoon(...)` (Moon.js path, zero worldengine imports). So "reaches `Planet.js`" ≡ `moon.isPlanetMoon === true`, set only at `MoonGenerator.js:335` (procedural) and `SolarSystemData.js:422` / `:764` (Sol's Titan).

**Measured, 400 seeds per family:**

| seed family | planets | moons | planet-class | % of moons | % of all bodies |
|---|---|---|---|---|---|
| `lab-procedural-` | 1673 | 1305 | 35 | 2.68% | 1.18% |
| `lane4-` | 1738 | 1374 | 30 | 2.18% | 0.96% |
| `pcc-` | 1739 | 1414 | 49 | **3.47%** | 1.55% |
| `seed-` | 1697 | 1382 | 44 | 3.18% | 1.43% |
| numeric `0..399` | 1664 | 1218 | 19 | **1.56%** | 0.66% |
| **pooled (2000 systems)** | 8511 | **6693** | **177** | **2.64%** | **1.16%** |

**PARTIALLY REPRODUCES.** ~3.5% is the **top of the observed range**, matched only by the `pcc-` family (3.47%). Correct pooled figure: **2.64% of moons (1.16% of all bodies)**, family-dependent **1.56–3.47%**. The in-repo prior at `src/rendering/objects/PlanetMoonBody.js:28-30` ("48 of 1475 moons over 400 generated seeds (3.25% of moons, 1.5% of all bodies)") is the same family-tail, not the population. Direction survives — it is a small minority either way.

Sol: 1 of 26 moons (Titan, `SolarSystemData.js:421`) — but Sol's Titan is hand-authored and never passes through `PlanetGenerator.generate`, so **8b does not touch it**.

---

# (e) "8b is draw-stream NEUTRAL: 0/400 altered the draw stream, 0/400 altered radiusEarth, because retained never flips" — **BROKEN**

**Method.** Patched the static `PlanetGenerator.generate` (MoonGenerator resolves it at call time, so the patch is live). Detected the `_generatePlanetMoon` call via stack. Snapshotted the Alea state with `exportState()`, ran today's `1.0`, snapshotted after, `importState`-restored to the pre-call state, ran the shadow at the **parent's real orbit AU**, then restored the post-real state so generation continued unperturbed. Draws counted by wrapping `SeededRandom.rng`.

**CONTROL (a gate whose control never moved is evidence of nothing):** a 60-seed fingerprint over `pcc-` — planet `radiusEarth`/`T_eq`/`axialTilt` + moon `radiusEarth`/`startAngle`/`noiseScale`, 26,022 chars — is **byte-identical with and without the harness installed**. The harness does not perturb.

**Result, 4 seed families × 600 seeds = 2,400 systems, 233 planet-class-moon generations:**

| | measured |
|---|---|
| post-generate **draw count altered** | **52 / 233 = 22.3%** |
| `radiusEarth` of the generated planet altered | **0 / 233** ✅ (this half reproduces) |
| **`atmoPhysics.retained` flipped** | **8 / 233 = 3.4%** ❌ |
| `rings` presence flipped | 3 / 233 |

Per family: `pcc-` 12/62, `lane4-` 10/54, `lab-procedural-` 16/54, `seed-` 14/63.

**MECHANISM — IT IS NOT `retained`, AND IT IS NOT `PlanetGenerator.js:526`.** Attribution over the 52 draw-altered cases: `tidalState.locked` flipped on **52/52**; `retained` flipped on 8, every one of which also flipped `locked`; **0** cases with neither. The live site is `src/generation/PlanetGenerator.js:697-698`:
```js
} else {
  rotationSpeed = rot(rng.range(0.033, 0.167) * (rng.chance(0.15) ? -1 : 1));
}
```
— **two draws** taken when the body is unlocked, **zero** when locked. `tidalState` comes from `PlanetGenerator.js:408 tidalLockTimescale(starMassSolar, massEarth, radiusEarth, Math.max(orbitRadiusAU, 0.01))`, which is strongly orbit-dependent. Moving 1.0 AU → the parent's real AU crosses the locking boundary on ~22% of bodies.

**Independent synthetic confirmation** (different population, same verdict): 400 seeds × 6 forced types (`rocky, venus, terrestrial, ocean, ice, sub-neptune`) × 4 zone-sets × 15 AUs = **144,000 comparisons** against the 1.0 AU baseline → **29,717 (20.6%) draw-count diffs, 29,717 post-stream diffs, 0 radiusEarth diffs**. Traced call sites for `8b-0`/`rocky`/`0.1 AU`: 14 draws at 1.0 AU vs 12 at 0.1 AU, the two missing draws both at `PlanetGenerator.js:698`, **with `retained === true` on both sides**.

**DOWNSTREAM BLAST RADIUS, MEASURED AND BOUNDED.** Whole-system A/B over 600 `pcc-` seeds, comparing every moon record's `radiusEarth`/`orbitRadiusEarth`/`inclination`/`startAngle`/`orbitSpeed`:

- **planet-class moon records moved: 12 / 61 (19.7%)** — e.g. `pcc-111#1.1` radius `0.7511633199295386` → `0.5178939636577111`, startAngle `0.0273` → `5.6253`. These are the draws at `MoonGenerator.js:281-302`, which run *after* the shifted `PlanetGenerator.generate` returns.
- **plain moon records moved: 0 / 1985** — containment holds, because `StarSystemGenerator.js:594` gives each moon its own `planetRng.child('moon-' + m)`, so a draw shift inside one moon cannot reach its siblings.

**VERDICT: DOES NOT REPRODUCE. 8b is NOT draw-stream neutral and NOT a value-only change.** It moves the *size and orbit* of ~20% of planet-class moons. The direction of the plan's argument does **not** survive: the gate it proposes for 8b ("a committed delta table … over the planet-class moon population for `T_eq`, composition, `iceness`, `landPalette`, `lavaGlowColor`, `lavaCrustColor`") does not cover `radiusEarth`/`orbitRadiusEarth`/`startAngle`, which is exactly what moves. It survives only in the weaker form "the blast radius is confined to planet-class moons" — which IS confirmed (0/1985 plain moons).

---

# (f) "atmoPhysics.retained is true 323/323 over 323 generated planets, so `PlanetGenerator.js:526`'s `&&` short-circuits zero times today"

**Method.** `atmosphere` is non-null iff `atmoPhysics.retained` (`PlanetGenerator.js:448` `let atmosphere = null;` / `:449` `if (atmoPhysics.retained) {` / `:456` `atmosphere = {`), so `planetData.atmosphere?.physics?.retained` is a faithful read. Population: **5 seed families × 600 seeds = 3,000 systems**.

| population | n | retained TRUE | retained FALSE | fraction |
|---|---|---|---|---|
| **generated planets** | **12,742** | 12,741 | **1** | **0.999922** |
| **planet-class moons** | **250** | 241 | **9** | **0.9640** |
| combined | 12,992 | 12,982 | 10 | 0.99923 |

**DOES NOT REPRODUCE as an absolute.** The `&&` at `PlanetGenerator.js:526` **does** short-circuit — 10 times in this population.

- The single planet counterexample: seed **`pcc-255`, ordinal 1**, type `crystal`, `R = 0.37141953986138104`, `M = 0.02305377635`, `T_eq = 631.4899`, `atmosphere: null`.
- The nine moon counterexamples are **all planet-class moons generated at the hardcoded 1.0 AU around luminous stars** (`T_eq` 1353.98 K ×5, 5958.25 K ×4) — i.e. exactly the fabricated-hot bodies 8b exists to fix. Seeds: `pcc-316#2`, `lane4-200#4`, `lane4-301#2`, `lane4-384#3`, `lab-procedural-88#3`, `seed-342#0` (×2), `169#4`, `545#4`.

Per-type on planets: `rocky` 2530/2536, `ice` 1968/1970, `ocean` 209/210, `crystal` 69/70; every other type 100%.

**HAZARD-ANALYSIS CONSEQUENCE.** The plan's `:526`-is-dormant framing (`§2` row 2, `Step 8` ⚠ block: "dormant-but-armed, not live") is false at 12,742-planet scale and **badly** false on 8b's own subject population, where it fires **3.6% of the time**. And the two claims interact: since (e) shows `retained` flips on 3.4% of planet-class moons under 8b, `:526`'s short-circuit changes state *inside the very commit the plan certifies as neutral*. `:526` is not the primary mechanism — `:698` is (52/52 vs 8/52) — but it is not dormant either.

---

# ROLLUP

| # | claim | verdict | measured |
|---|---|---|---|
| a | 346,021 g Phobos-class body | **REPRODUCES exactly** | 346020.76124567474, `SolarSystemData.js:230` |
| a | "10.4 / 14.1 / 56.3 g" | **DOES NOT REPRODUCE / unattributable** | median **33.25**, max **1,000,000** (Deimos), **82.3% > 3 g** over 6,719 moons |
| a | `[0,3] g` is achievable as a gate | ⚠ **already fails today** on the well-formed subpopulation | planet-class max **3.2596 g**; shipped fence asserts `< 5` |
| b | Sol's Moon 13.42 g → target 0.165 | **REPRODUCES** (both halves) | **13.41759583517825**; 0.0123/0.273² = 0.165036 |
| c | `MoonGenerator.js:278` call site | **REPRODUCES exactly** | `PlanetGenerator.generate(rng, 1.0, …)` |
| c | 254.588 at 1.0 AU | **REPRODUCES exactly** | 254.588 |
| c | 43.033 at 30 AU, 5.9× | **DOES NOT REPRODUCE** — 43.033 is **35.000 AU**; 30 AU = **46.481** (5.477×) | plus: real error is two-tailed, ratio 0.404…57.23, **48.1% wrong by >2×** |
| d | ~3.5% of moons reach `Planet.js` | **PARTIALLY** — top of range, not the population | pooled **2.64%** (1.56–3.47% by family), decided at `main.js:7636` |
| e | 0/400 draw-stream, 0/400 radiusEarth, retained never flips | **BROKEN** on 2 of 3 clauses | **52/233 (22.3%)** draw-altered · 0/233 radius ✅ · **8/233 retained flips** · cause = `tidalState.locked` at **`PlanetGenerator.js:697-698`**, 52/52 · **12/61 moon records move geometry**, 0/1985 plain moons |
| f | retained true 323/323, `:526` short-circuits zero times | **DOES NOT REPRODUCE as absolute** | planets **12,741/12,742**; **planet-class moons 241/250 (3.6% fire)**; `:526` is live, not dormant |

**Two figures the plan is sold on survive intact (346,021 g; 13.42 g; plus the `:278` call site and 254.588 K). Two are wrong in the plan's favour and two are wrong against it.** The one that changes the build order is **(e)**: 8b cannot ship on a value-only delta table, because it moves the radius, orbit, inclination and start angle of about a fifth of all planet-class moons.

---

## Lane transcript `a13506dd9d108d3c2`

ADVERSARIAL LANE — "append, never splice" + the draw-stream safety argument. Tree `feature/world-engine-production-L1` @ `f679046`, 0 tracked files modified. Instrument B green today: 8/8, 842 ms. Scripts: `/tmp/claude-1000/-home-ax/237cc0d0-1e26-4841-ac3a-117ca5c72fbe/scratchpad/adv/{clamp,splice,splice2,cmp,cmp2,verify,orbau,swap,inv}.mjs`.

# THE HEADLINE: FOUR CONSTRUCTIONS, ONE TABLE

All four run over Instrument B's own `BULK_SEEDS` (`tests/body-identity-fence.test.js:93`, `wd-0…wd-191`, **713 moons = 691 plain + 22 planet-class**), using `canon`/`hash` copied verbatim from `tests/body-identity-fence.test.js:177-204` and the draw counter copied verbatim from `:225-241`.

| # | construction | touches shared stream? | actually harmful? | **DRAW STREAM** | **RECORD HASH (whole record)** |
|---|---|---|---|---|---|
| 1 | `subrng` — one draw on a fresh `new SeededRandom(...)`, **the PLAN's own recommended-SAFE pattern** (`MoonGenerator.js:257-263`) | **no** | no | **RED, 170/192 seeds** | GREEN 0/713 |
| 2 | `tail` — one `rng.float()` **after the whole return literal is built** (the PLAN's own "append after the last draw" point, drawn from the shared rng) | yes | **no** (`moonRng` is discarded at `StarSystemGenerator.js:595`) | **RED, 170/192 seeds** | GREEN 0/713 |
| 3 | `splice` — one `rng.float()` immediately before `MoonGenerator.js:185`. **THE PLAN'S NAMED HAZARD.** | yes | **yes** | RED, 170/192 seeds | **GREEN on 686 of 691 plain moons. 5 red (0.72%).** |
| 4 | `picktype` — one `rng.float()` at the top of `_pickType` (`:369`) | yes | yes | RED, 170/192 seeds | RED 691/691 plain |

**DRAW STREAM is a constant across all four — 170/192 seeds red whether the change was safe or harmful. It carries zero discriminating information.** And RECORD HASH, the channel Step 8a names as decisive, is 99.3% blind on the plan's own named hazard.

---

# CONFIRMED BREAK #1 — the byte-identity gate cannot see a `noiseScale` re-roll, because `noiseScale` is not in the record

**Mechanism.** `src/generation/MoonGenerator.js:185`:
```js
noiseScale: Math.max(rng.range(3.0, 6.0), 2.5 / moonRadiusData.radius),
```
The drawn value only reaches the record when it exceeds the floor. Measured over **2000 seeds / 6474 plain moons**:

```
noiseScale === 2.5/radius EXACTLY (drawn value discarded)  6394 / 6474 = 98.76%
noiseScale === the drawn range(3,6) value                    80 / 6474 =  1.24%
smallest floor (2.5/radius) seen anywhere                  3.774017666099865
```
The floor **never** falls below 3.774 while the draw range is `[3, 6)`. On 98.76% of plain moons `noiseScale` is a pure deterministic function of `radius` and the draw is thrown away.

**Direct construction** (`splice.mjs splice`), 192 seeds: a one-draw splice at `:185` moves the whole-record hash on **5 of 691 plain moons**, 0 of 22 planet-class. The five:
```
wd-5   moon#4  5.2414634032174945 -> 4.302222539539395
wd-5   moon#5  3.792780808202862  -> 5.972537868423387
wd-34  moon#4  5.215246753999963  -> 4.351572835352272
wd-133 moon#3  4.603526606457308  -> 4.478682833981143
wd-183 moon#1  5.721441892907023  -> 4.964027713285759
```

**Two PLAN sentences fail at `PLAN.md:390`:**
1. *"Splicing a `deriveComposition(…, rngFloat)` call anywhere after `:157` re-rolls `noiseScale` on **every plain moon in the universe** — every moon's surface detail frequency changes"* — **DOES NOT REPRODUCE.** It changes the surfacing `noiseScale` on **0.72%** of plain moons. 99.28% are byte-identical.
2. `PLAN.md:394` *"Instrument B must hash the ENTIRE returned moon record… Must be **byte-identical**. If it goes red, a draw leaked into the shared stream and the commit is wrong."* — **the contrapositive is what an author will use, and it is false.** Green does **not** mean no draw leaked: construction 3 leaks a draw and the record hash stays green on 686/691 moons.

The plan's argument is that the wide hash is what upgrades the gate over "four named fields." Measured: on this specific hazard the wide hash buys **5 moons of coverage out of 691**, because the hazard's own observable is clamped out of the record 98.76% of the time.

# CONFIRMED BREAK #2 — the PLAN's recommended-safe pattern reds the only channel that can see anything

`SeededRandom.prototype.rng` is instrumented as a **prototype accessor** (`tests/body-identity-fence.test.js:225-241`), so the constructor assignment at `SeededRandom.js:15` is intercepted for **every instance**, including a fresh `new SeededRandom(eccSeed)`. The file states it counts `child()`; it does not state that it counts unrelated dedicated sub-rngs, and it does.

Consequence, measured (construction 1): adding **one** draw on a dedicated namespace — literally the pattern `PLAN.md:390` instructs authors to use, and which `MoonGenerator.js:244-251` documents as *"draws ZERO numbers from the passed-in moon-generation `rng`, so moon generation is byte-identical and the additive gate stays green"* — moves the per-seed draw total on **170 of 192 seeds**, indistinguishable from the harmful splice.

**The in-file documentation at `MoonGenerator.js:248-250` is wrong about the gate it names.** The sub-rng draws zero from the *shared* stream (true) but is not invisible to *Instrument B's* draw channel (false). It only reads as true today because `_computeTidalHeating`'s draws are already baked into `tests/baseline/body-identity.json`.

**This is a §11.9 amended-D-clause failure in the accident direction, not the adversarial one.** An author following the file's own written idiom gets a red on the channel the plan calls "the real gate", is told by `PLAN.md:394` that *"a draw leaked into the shared stream and the commit is wrong"*, and the correct repair — rebless — simultaneously blesses away any real splice landing in the same commit.

# CONFIRMED BREAK #3 — the append point is not after the last mutation. `ExoticOverlay` rewrites the derivations' own inputs after `generate` returns.

`src/generation/ExoticOverlay.js:325-337`, inside `_swapPlanetType`, which runs from `StarSystemGenerator.js:920` `ExoticOverlay.apply(systemData)` — **after every moon has been generated**:
```js
const kEarth = newData.radiusEarth / oldData.radiusEarth;
const kMap   = newData.radius / oldData.radius;
for (const moon of moons) {
  moon.radiusEarth *= kEarth;  moon.radiusScene *= kEarth;
  moon.orbitRadiusEarth *= kEarth;  moon.orbitRadiusScene *= kEarth;
  moon.radius *= kMap;  moon.orbitRadius *= kMap;
  // noiseScale is texture detail, not geometry — leave it alone.
}
```
Measured, 2000 seeds / 6670 moons: **73 type swaps, 41 swapped parents carrying moons, 44 moons rescaled after `generate` returned (0.66%)**. `kEarth` min **0.1329**, median **0.786**, max **2.682**, **exactly 1.0 on zero of them.**

Every one of Step 8a's six named derivations is a function of exactly these mutated fields:

| derivation | input | rescaled after append? |
|---|---|---|
| `massEarth` = radius³ × parent density | `radiusEarth` | yes, ×kEarth — mass **not** rescaled |
| `T_eq`, `tidalState` (semiMajorAU) | `orbitRadiusEarth` | yes, ×kEarth |
| `tidalHeating` (**already shipped**, `MoonGenerator.js:161`) | both | yes — **stale on those 44 moons today** |

`surfaceGravity = massEarth / radiusEarth²` (`src/worldengine/base/baseStep.js:18-19`) then carries an error of exactly **1/kEarth²** — up to **56.6×** at kEarth = 0.1329. **That directly threatens Step 8a's own `[0, 3] g` gate**: a body whose derivation is correct at generate time reports up to 56.6× its true gravity, and the gate reds with no channel pointing at `ExoticOverlay`. And the byte-identity gate is structurally blind here — the mutation is identical on both sides of any A/B, so it is not a hash diff at all.

**Bonus, same mechanism.** `MoonGenerator.js:182-184` states the invariant *"noise needs input range ≥2.0 units. Effective range = radius(map) × noiseScale."* `ExoticOverlay.js:335` deliberately leaves `noiseScale` alone while shrinking `radius`. Measured on the final records, 2000 seeds: **28 of 6474 plain moons have `radius × noiseScale < 2.0`**, min **0.6616** (`wd-1169` ordinals 4.0 and 4.1). The comment's premise ("texture detail, not geometry") is false — 98.76% of `noiseScale` values *are* `2.5/radius`.

# CONFIRMED BREAK #4 — `T_eq` "from the parent's real orbit radius" is not in scope. `PLAN.md:388` overstates.

`PLAN.md:388`: *"Every value derived **purely** from what `MoonGenerator.generate` already holds in scope — it takes the full parent `planetData` (`:93`)."*

Measured, 200 seeds, 454 moon-bearing planets:
```
planetData.orbitRadiusAU defined :   0 / 454
wrapper.orbitRadiusAU    defined : 454 / 454
planetData.age                   : 454 / 454
planetData.T_eq                  : 454 / 454
```
The AU lives on the **wrapper** (`StarSystemGenerator.js:605`), which `MoonGenerator.generate(moonRng, planetData, m, …)` at `:595` never receives. Step 8a's `T_eq` as literally specified requires a **signature or `planetData` change the plan does not budget**. `age` and the mass/density inputs *are* in scope; `T_eq` is not.

---

# REFUTED — the claims that survive

**R1. Is the append point after all draws on every branch inside `generate`?** REFUTED (the claim survives, inside this function). `generate` (`:93-205`) has exactly **one** early return, `:100` `return this._generatePlanetMoon(...)`, taken before any plain-path code. The plain path's last draw is `:202` (`ringWidth`), two lines above the literal's close at `:204`. There is **no draw after the return literal** in `generate`. Hoisting to `const moon = {…}; …; return moon;` is a valid append point *with respect to `generate`'s own draws*. It is not valid with respect to the record's lifetime — see Break #3.

**R2. Do the record's consumers re-enter the shared moon rng after `generate` returns?** REFUTED for the shared rng specifically. `moonRng` (`StarSystemGenerator.js:594`) is created per-moon and discarded; the only post-return writes at `:596-597` are `_systemSeed` / `_ordinal`, no draws. `ExoticOverlay` re-enters the **system** rng (`ExoticOverlay.js:306` `rng.child('swap-' + newType)`) and mutates moons — that is Break #3, a mutation hazard, not a stream hazard. Sole production caller is `StarSystemGenerator.js:595`; the other 5 call sites are tests/fixtures.

**R3. Do the new derivations need a value obtainable only by calling something that draws?** REFUTED for five of six, CONFIRMED for one. Draw-free: `equilibriumTemperature` (`PhysicsEngine.js:121`), `tidalLockTimescale` (`:264`), `checkTidalLock` (`:280`), `computeSurfaceHistory` (`:796`), and mass-from-density (arithmetic). **`deriveComposition(metallicity, orbitAU, frostLineAU, rngFloat)` (`PhysicsEngine.js:380`) takes a drawn float as its 4th positional argument** — the plan names this correctly, and its escape hatch (dedicated namespace) is the one that trips Break #2.

**R4. Can `_pickType` / the type table / zone mapping be changed accidentally following the file's own idioms?** CONFIRMED as *easy*, REFUTED as *undetected*. `_pickType` (`:368-405`) mixes two idioms on the same `rng`: one pre-drawn `const roll = rng.float()` at `:370` reused by every threshold ladder (**1 site, draw-free to extend**) and inline `rng.chance(…)` at `:377` and `:399` (**2 sites, each a new draw**). The majority idiom draws. But construction 4 measures the consequence: one draw at the top of `_pickType` moves **691/691** plain moon hashes. The record hash catches this class loudly.

**R5. "Seven of them come after `startAngle` (`:157`)."** REFUTED — the claim reproduces exactly: `:185, :189, :190, :195, :200, :201, :202` = 7. (The *"fifteen draws"* framing is a call-site count, not an executed count, as three lanes independently found; that is not my lane's target.)

---

# WHAT THE PLAN MUST SAY INSTEAD

- **`PLAN.md:390`** — *"re-rolls `noiseScale` on every plain moon in the universe"* → the drawn value is clamped out on **98.76%** of plain moons (`Math.max(…, 2.5/radius)`, `MoonGenerator.js:185`; floor never below 3.774 against a `[3,6)` draw). A one-draw splice at `:185` moves the whole-record hash on **5 of 691**.
- **`PLAN.md:394`** — *"If it goes red, a draw leaked… and the commit is wrong"* → green does not mean no draw leaked. The record hash is 99.28% blind to the plan's own named hazard. **Neither Instrument B channel can distinguish safe from unsafe on this class**: the draw channel fires identically on all four constructions above, the hash channel is blind on the one that matters.
- **`MoonGenerator.js:248-250`** — the shipped comment claiming the dedicated sub-rng keeps *"the additive gate green"* is false against Instrument B's counter, which is a `SeededRandom.prototype` accessor and counts every instance. Any new namespace added in 8a reds the draw channel by construction.
- **Step 8a needs a gate nobody has proposed: a post-`ExoticOverlay` internal-consistency assertion** — `|massEarth/(radiusEarth³·ρ_parent) − 1| < ε` and `tidalHeating` recomputed from the final `radiusEarth`/`orbitRadiusEarth` — on the **44-in-6670** swapped-parent moons. Without it, `[0,3] g` reds on correct code with an error factor up to 56.6× and no channel names the cause. This is also a **pre-existing defect on `tidalHeating` today**, not something 8a introduces.
- **`PLAN.md:388`** — *"derived purely from what `MoonGenerator.generate` already holds in scope"* is false for `T_eq`: `planetData.orbitRadiusAU` is undefined on 454/454 moon-bearing planets; the AU exists only on the wrapper.

**UNMEASURED:** whether the real vitest run of `tests/body-identity-fence.test.js` reddens under constructions 1–4 (I reproduced its capture logic verbatim rather than patching the repo, and the per-*yield* profile array was not reconstructed — I measured the per-seed draw **total**, which is that array's last element); whether `_generatePlanetMoon`'s own append point is draw-clean (out of 8a's declared scope); the `[0,3] g`, Sol-Moon and `_provenance` before-numbers (other lanes').

---

## Lane transcript `a1c5cb3e779353b39`

All measurements below are mine, run this session against `feature/world-engine-production-L1` @ `f679046`, no tracked file modified. Scripts in `/tmp/claude/l6/`.

---

# LANE 6 — STEP 8'S SEVEN GATES, TESTED FOR CLASS D

**Verdict up front: 6 of 7 are class D. 1 (the atmosphere/pressure gate) is D by "subject outside its watched set". The 7th (8b's delta table) is D by "the next step's move is written past it" *and* is measured against a control the PLAN records as immovable and which I measured moving.**

Step 9's declared first move, taken literally (`PLAN.md:441`): create `src/worldengine/drivers/rockySurface.js` (craterSchedule + craterRelevanceOf + surfacePaletteOf∘applyAlbedoTransfer + icenessOf + reliefEnvelope), and **in the same commit replace `src/objects/Planet.js:1596`'s `ROCKY_TYPES.has(d.type)` with `craterRelevanceOf(condition)`**. Verified at `src/objects/Planet.js:1596` and `src/worldengine/base/bombardment.js:220`. That move makes `craterSchedule(condition)` — which reads `surfaceGravity` — the crater gate for **every** body including moons. **Every §11.3.1 mutant below is drawn from it.**

---

## GATE 1 — "Instrument B must hash the ENTIRE returned moon record… Must be byte-identical" (`PLAN.md:394`)

### D. Two independent constructions.

**(a) The widening is not work — it shipped at Step 0.** `tests/body-identity-fence.test.js:196-204` `moonRecord` iterates `Object.keys(m)` with no allowlist and no exclusion (planets get `WORLDENGINE_BAKES` filtering at `:190-193`; moons get none). There is no four-field hash to widen.

**(b) The two clauses of the gate's own sentence are mutually exclusive, and the file says so.** Measured, using `canon`/`hash`/`moonRecord` transcribed verbatim from `:177-204`, on `wd-0`'s first moon:

```
baseline hash          c3e408af21f483f0
enumerable append      42b8cb008e8af0fb   moved: true
NON-ENUMERABLE append  c3e408af21f483f0   moved: FALSE
UNDEFINED-value append c3e408af21f483f0   moved: false   (RECORD SHAPE moves)
non-enum values readable downstream? nonenu.massEarth = 0.004
shape key list identical?  true
```

Hashing the entire record means an additive commit moves the hash **by construction**. Byte-identity is achievable only by the four-field hash the same sentence forbids. Measured on the fence's own corpus (`wd-0…wd-220`, 803 plain + 26 planet-class moon records): a faithful 8a append moves **803/803** plain hashes with **zero** draws moved.

### The construction that passes while the thing is broken — and it is idiomatic, so §11.9 BLOCKS.

`Object.defineProperty(moon, 'massEarth', { value: …, enumerable: false })`. Hash unchanged, RECORD SHAPE unchanged, DRAW STREAM unchanged, **all eight Instrument B tests green**, and the value is fully readable by every downstream consumer (measured above: `nonenu.massEarth = 0.004`).

This is not adversarial evasion. It is **the file-being-renamed's own idiom, framed there as a virtue** — `src/worldengine/port/conditionFromPlanet.js:890-895`, with the rationale at `:885-889`:

> `// it CANNOT enter any hash, golden or key-shape assertion by accident. The protection is`
> `// structural — nobody has to remember to exclude it.`

Under §11.9 an accidental/idiomatic bypass **blocks**; only deliberate evasion is downgraded to a named limit. An author who has just renamed that file and read that comment is following the file's own idioms.

### Mutation that would prove it bites
`tests/body-identity-fence.test.js` must assert **counts, not identity**: DRAW STREAM green on 221/221; BODY IDENTITY red on exactly 803 plain / 0 planet-class / 0 planets; **RECORD SHAPE red naming the appended keys — a green RECORD SHAPE is a FAILURE**. Mutant: change the 8a append from `moon.massEarth = m` to `Object.defineProperty(moon,'massEarth',{value:m,enumerable:false})` at the append point in `src/generation/MoonGenerator.js` (after `:204`) ⇒ must go red on RECORD SHAPE.

### Control question
`tests/baseline/body-identity.json` was blessed at Step 0 (`b2ac455`), so it **is** a control that can move. That is an accident of Step 0's sequencing, not of Step 8's design — and it is destroyed the moment `WD_REBLESS_BODY_IDENTITY=1` is run inside the 8a commit. **Before-number, run now:** `npm run test:body-identity` → `Test Files 1 passed (1) / Tests 8 passed (8) / Duration 874ms`.

---

## GATE 2 — "for each moon type, the number of values consumed from the passed-in `rng` is pinned to a committed number" (`PLAN.md:395`)

### Not satisfiable as written. Measured, 1500 seeds `wd-0…wd-1499`, counter installed on the *passed-in* instance's `rng` closure only:

```
rocky         n= 1567   11×868  12×641  13×58
captured      n= 1211   11×740  12×439  13×32
ice           n= 1740   11×586  12×1059 13×95
volcanic      n=  516   12×503  13×13
terrestrial   n=    4   17×1    18×3
PLANET-CLASS  n=  169   18×7 19×7 21×113 23×24 24×1 25×1 27×13 29×3
```

**No moon type has "a committed number".** Every type has 2–8. The PLAN's "fifteen draws" (`:392`) is a count of `rng.` call sites lexically inside `generate` with the `:151`/`:152` ternary collapsed — **no moon consumes 15**. (The related claim *"seven of them come after `startAngle` (`:157`)"* — `:185,:189,:190,:195,:200,:201,:202` — does reproduce.)

### D. If written as set membership, the construction is: the plan's own prescribed idiom draws from a different object.

`PLAN.md:392` instructs new derivations to use `MoonGenerator.js:257-263` — `const eccRng = new SeededRandom(eccSeed); eccRng.range(...)`. Verified verbatim at those lines. **That object is not the passed-in `rng`, so the gate cannot see it at all.** An 8a author can take unlimited draws through the namespace pattern — including `deriveComposition(…, compRng.float())` for the declared `composition` derivation — and the per-type count is unchanged by construction. Combined with Gate 3 (presence-only), **nothing in Step 8's gate list checks that any appended value is a function of anything.**

Second construction: the counts already form overlapping sets. Any edit that changes *which* `_pickRadius` branch fires without changing its arity — e.g. `src/generation/MoonGenerator.js:221` `rng.chance(0.2)` → `rng.chance(0.8)` (giant branch costs 2 draws either way) — re-rolls every radius and every downstream value with the per-type count sets **identical**.

### Mutation that would prove it bites
`sed` `src/generation/MoonGenerator.js:157` to insert `rng.float();` before `const startAngle` ⇒ every type's set must shift by +1. Note this is strictly weaker than Instrument B's DRAW STREAM channel, which already catches it.

---

## GATE 3 — "`_provenance` reports zero `'defaulted'` entries for `massEarth`/`age`/`T_eq`/`surfaceHistory` on ≥500 sampled moons" (`PLAN.md:396`)

### D, decisively. `_provenance` is a **presence** test, not a correctness test.

`src/worldengine/port/conditionFromPlanet.js:682`: `const seen = (v) => (v != null ? 'measured' : 'defaulted');`. Measured against a real plain-moon record:

```
mutant              massEarth  age       T_eq      surfaceHistory  defaulted(of 4)  surfaceGravity
ALL NaN / empty     measured   measured  measured  measured        0                NaN
ALL zero            measured   measured  measured  measured        0                0
ALL negative        measured   measured  measured  measured        0                -25.0
ALL strings ('x')   measured   measured  measured  measured        0                NaN
ALL false           measured   measured  measured  measured        0                0
plausible           measured   measured  measured  measured        0                0.12
```

`massEarth: false` reports `'measured'`. `age: -5` reports `'measured'`. `T_eq: 'x'` reports `'measured'`.

### The construction
Append `{ massEarth: 0, age: 0, T_eq: 0, surfaceHistory: {} }`. Gate 3 reads **0 defaulted**; Gate 4 reads **g = 0 ∈ [0,3]**; Gate 2 is unchanged; Gate 1's DRAW STREAM is green. **Four of Step 8's seven gates pass on a record with no physics in it.**

Specifically for `T_eq`, Step 8a's declared derivation is *"from the parent's real orbit radius"* — and **that quantity is not in scope**. Verified: `src/generation/StarSystemGenerator.js:605` places `orbitRadiusAU` on the *wrapper*, and `:594` calls `MoonGenerator.generate(moonRng, planetData, m, planetData.moonCount, parentZone, zones)` — no AU parameter. `planetData` carries none. `_provenance.T_eq` reads `'measured'` whether the value came from the parent's real orbit, from the parent's own (post-migration-stale) `T_eq`, or from the fabricated 1.0 AU. **The gate cannot distinguish 8a-done from 8a-not-done.**

Also: Step 8a's *What* declares six derivations (`massEarth`, `age`, `T_eq`, `composition`, `surfaceHistory`, `tidalState`); the gate names four. `composition` and `tidalState` are ungated.

### Mutation that would prove it bites
Not a mutation — a gate replacement. The provenance row can only witness presence, so the gate must be paired with value assertions: `massEarth` within ±1% of `radiusEarth³ × parentDensity` on ≥500 moons; `T_eq` equal to `equilibriumTemperature(zones.luminosity, parentOrbitAU)` on ≥500 moons — which forces the signature change `MoonGenerator.generate` needs and Step 8's **Files** list does not budget for.

### Before-number (my measurement, `wd-0…wd-1999`, 6474 plain + 196 planet-class moons)
All four keys read `'defaulted'` on exactly the plain-moon count and `'measured'` on every planet-class moon.

---

## GATE 4 — "`surfaceGravity` over the whole moon population lies in [0, 3] g" (`PLAN.md:397`)

### D. The band cannot fail under the step's own declared formula, and it already fails today on the one subpopulation it can see.

Step 8a declares `massEarth = radius³ × a parent-derived density`. Then `surfaceGravity = massEarth/radiusEarth² = radiusEarth × ρ_parent` (`src/worldengine/base/baseStep.js:18-19`). Measured over 600 seeds `wd-0…wd-599`, 2109 plain moons:

```
moon radiusEarth        min 0.006255  med 0.17498  p95 1.0438  MAX 2.6157
parent ρ (Earth=1)      min 0.07540   p05 0.08451  med 0.5551  p95 0.86384  MAX 1.3191
SIM g = R × ρ_parent    min 2.443e-3  med 6.748e-2 p95 0.2339  MAX 0.5390   outside [0,3]: 0/2109
SIM g = R × comp.density/5514         med 9.757e-2                MAX 2.0434   outside [0,3]: 0/2109
```

**Max 0.539 g against a 3 g ceiling — 5.6× headroom, p95 at 0.234.** The band cannot be reached by any correct application of the declared formula.

### The construction — omit the density factor entirely (`massEarth = radiusEarth³`)

An easy, idiomatic slip. Measured over the same 2109 moons:

```
max g, correct parent density : 0.5390     ┐ BOTH inside [0,3]
max g, density term omitted   : 2.6157     ┘
mass over-estimate factor (1/ρ): min 0.758  med 1.801  p95 11.833  MAX 13.263
```

**A mass wrong by up to 13.3× (median 1.8×) passes the gate.**

### §11.3.1 mutant, drawn from Step 9's declared first move

Step 9's move puts `craterRelevanceOf(condition)` — hence `craterSchedule(condition)`, which consumes `surfaceGravity` via `transitionDiameterKm(g)` (`bombardment.js:234`) — on the moon path. Feeding both gravities through it, 2109 plain moons:

```
craterRelevanceOf FLIPPED           :    0 / 2109   (the 0/1 gate is insensitive)
craterSchedule.regolithRoughness moved : 2109 / 2109
craterSchedule.sizeMul moved           : 2109 / 2109
craterSchedule.nStamp moved            : 1765 / 2109
regolithRoughness relative |Δ|: med 0.1371  p95 0.5344  max 2.3870
```

**Step 8's gravity gate passes a mass error that moves Step 9's own declared consumer on 100% of the moon population, by a median 13.7% and a max 239%.** That is the D clause's second half, satisfied literally.

### Second, independent defect: the gate reds today on a body Step 8a does not touch

Planet-class moons already carry a real `massEarth` (from `PlanetGenerator`). Measured, 600 seeds, 70 planet-class moons: `min 0.1296 · med 0.6364 · MAX 3.1291` — **1 of 70 exceeds 3 g today.** The shipped fence asserts a different bound: `tests/moon-mass-radius-consistency.test.js:76` `expect(Math.max(...gs)).toBeLessThan(5);`. Writing the gate at 3 g reds on a body the mass-rescale fix already considers correct, and contradicts a shipped assertion.

### On the PLAN's stated before-numbers
`10.4 / 14.1 / 56.3 g` (`:397`) is unattributable — I did not reproduce it as a specified triple. `346,021 g` for an 11 km body reproduces arithmetically (`1/0.0017²`) and the body is `src/generation/SolarSystemData.js:230` (Phobos), **hand-authored, not generated** — the smallest generated moon I measured is `radiusEarth 0.006255` (≈40 km). The plan's headline numbers describe hand-picked Sol bodies, not the population the gate names.

---

## GATE 5 — "Regression fixture: Sol's Moon derives 0.165 ± 0.01 g, not today's 13.42 g" (`PLAN.md:398`)

### D — subject outside the watched set — and worse: **unsatisfiable by the step's own declared derivation**, in either direction.

**Measured:**
```
sol-moon   R = 0.273   massEarth = undefined   g = 13.41759583517825   _provenance.massEarth = defaulted
sol-earth  R = 1.0     massEarth = undefined   → parent-derived density = (1.0 ?? default) / 1³ = 1.0
grep -c massEarth src/generation/SolarSystemData.js  →  0
grep -n MoonGenerator src/generation/SolarSystemData.js → one hit, :55, a COMMENT
```

Three facts, each independently fatal:

1. **Sol's Moon is a hand-authored literal** at `src/generation/SolarSystemData.js:191-201` (`profileId: 'sol-moon'`, `radiusEarth: 0.273`). `MoonGenerator` is never invoked for Sol. Step 8a's declared change — widening `MoonGenerator`'s plain path — **cannot move this body at all**. The fixture stays at 13.4176 no matter what 8a does.
2. **`SolarSystemData.js` is not in Step 8's declared Files list** (`PLAN.md:392`: `MoonGenerator.js`, `conditionFromBody.js`, `moon-condition-contract.test.js`, `moon-rng-stream-identity.test.js`, `body-identity.json`). Satisfying the gate requires editing an undeclared file — at which point the gate tests the undeclared edit, not Step 8.
3. **The declared formula gives the wrong answer.** `massEarth` appears **zero times** in the whole of `SolarSystemData.js`, so Sol's Earth has no mass and its derived density is exactly 1.0. `g = R × ρ = 0.273 × 1.0 = 0.273 g`. The gate demands **0.165 ± 0.01**, i.e. `0.155–0.175`. **0.273 misses by 9.8 tolerances.** Hitting 0.165 requires ρ = 0.605 — the Moon's *actual* density, 3344/5514 — which is a per-body datum no parent-derived rule can produce.

**So the gate can only be made green by hardcoding the Moon's mass into an undeclared file.** At that point it is a fixture of a literal against itself: self-referential, class D through the front door.

### Mutation that would prove it bites
There isn't one that stays inside the step. The honest repair is to give every Sol body a real `massEarth` in `SolarSystemData.js` and add it to Step 8's Files — which is exactly the scope the "filed, not fixed" `CRATER_VIS_FLOOR_RAD` note at `PLAN.md:404` defers. **This gate and that note are the same undeclared work.**

---

## GATE 6 — "Zero moons produce a truthy atmosphere with undefined pressure" (`PLAN.md:399`)

### D — vacuous on Step 8's declared subject, and unreachable on a 500-moon sample.

**Measured, `wd-0…wd-1999`, 6474 plain + 196 planet-class moons:**
```
condition.atmosphere truthy   : 187
of which pressure===undefined :   0
plain terrestrial moons       :   6  = 0.093%
expected terrestrial moons in a 500-moon sample: 0.46
```

The zero is **structural, not lucky**. Two independent reasons, both verified by running `atmosphereFromPlanet`:

```
today's moon literal {color,strength}   truthy: false   (fails hasEngineAtmosphereShape, :371-373)
{physics:{retained:true}} no pressure   truthy: true    pressure: 0       (:390 `phys.pressure ?? 0`)
FLAT {retained:true} no physics         truthy: true    pressure: undefined   ← THE ONLY VIOLATION
FLAT {pressure:1}                       truthy: true    pressure: 1
```

The **only** construction that fails this gate is the flat passthrough branch at `conditionFromPlanet.js:380`, which exists specifically to return lab presets and hand-authored fixtures unchanged (comment at `:367-370`). Step 8a's declared *What* lists `massEarth`/`age`/`T_eq`/`composition`/`surfaceHistory`/`tidalState` — **it does not touch `atmosphere`**, and `MoonGenerator.js:193-197` is unmodified by the step. A gate whose only failure mode is a construction the step never writes, on a subject that appears 0.093% of the time, is D on both counts.

### Mutation that would prove it bites
Force the population and the shape: pin `wd-1403` (already pinned in `tests/body-identity-fence.test.js:108` as the terrestrial-moon seed) **plus** a synthetic `MoonGenerator` output with `atmosphere: { retained: true, color }` and no `.physics`, asserted caught. Without the forced arm the gate measures 0 → 0 forever.

---

## GATE 7 — 8b: "a committed delta table… for `T_eq`, composition, `iceness`, `landPalette`, `lavaGlowColor`, `lavaCrustColor`; Instrument B's only allowed diff is planet-class moons, enumerated" (`PLAN.md:400`)

### The PLAN's own supporting claim does not reproduce, and the gate is scoped to the wrong fields.

**Method.** `MoonGenerator._generatePlanetMoon` intercepted; the parent's real generation AU recovered via a `WeakMap` keyed on the `planetData` object `PlanetGenerator.generate` returned (verified reachable — `StarSystemGenerator.js:585-597` runs the moon loop *before* the migration mutation at `:655`). The alea closure's `exportState`/`importState` snapshot the stream so each planet-class moon is generated twice from the identical state and the production stream continues unperturbed. ⚠ Note: `exportState` is on the alea closure `this.rng`, **not** on `SeededRandom` — `src/generation/SeededRandom.js` has no such method.

**A/B, 600 seeds `wd-0…wd-599`, 75 `_generatePlanetMoon` calls with a resolvable parent AU:**

```
draw count altered              : 17 / 75  = 22.7%
moon record radiusEarth moved   : 17 / 75
orbitRadiusEarth moved          : 17 / 75
inclination moved               : 17 / 75
startAngle moved                : 17 / 75
orbitSpeed moved                : 17 / 75
tidalState.locked flipped       : 17 / 75   ← exactly the draw-altered set
atmosphere presence flipped     :  4 / 75
T_eq differed                   : 75 / 75
sample: AU 179.316  draws 17→20  r 0.45199→0.52766  startAngle 2.7663→3.2916  T_eq 1353.98→101.11
sample: AU   0.472  draws 20→18  r 0.36341→0.56439  startAngle 0.7984→3.9303  T_eq  254.59→370.47
```

**Mechanism:** `src/generation/PlanetGenerator.js:697` — `rotationSpeed = rot(rng.range(0.033,0.167) * (rng.chance(0.15) ? -1 : 1));` — **two draws when unlocked, zero when locked.** `tidalState` comes from `tidalLockTimescale(..., Math.max(orbitRadiusAU, 0.01))`, so moving 1.0 AU → the real AU crosses the locking boundary on ~23% of bodies. `PlanetGenerator.js:526` is not the mechanism; `:697` is.

**The PLAN's claim at `:391` — *"0/400 altered the post‑generate draw stream and 0/400 altered `radiusEarth`, because `retained` never flips… a value change, not a universe change"* — DOES NOT REPRODUCE on any of its three clauses.**

### Full-run confirmation on Instrument B's own channels (221 seeds `wd-0…wd-220`, real substitution applied live):

```
DRAW PROFILE moved on            :   6 / 221 seeds
plain moon hashes moved          :   0 / 803     ← containment CONFIRMED
planet-class moon hashes moved   :  26 / 26
```

### D. Three constructions.

1. **The delta table's declared columns do not include what moves.** `T_eq`, composition, `iceness`, `landPalette`, `lavaGlowColor`, `lavaCrustColor` are all value fields. The step moves `radiusEarth`, `orbitRadiusEarth`, `inclination`, `startAngle` and `orbitSpeed` on 17/75 planet-class moons — **the size and orbit of ~23% of the bodies**. A delta table with the declared columns is green-and-complete while a fifth of the subject silently changes geometry.
2. **The Instrument B clause does not cover the channel that reds.** "Instrument B's only allowed diff is planet-class moons" authorizes hashes. The **DRAW STREAM** channel moves on 6/221 seeds — and the plan's *own 8a text* says a DRAW STREAM red means *"a draw leaked into the shared stream and the commit is wrong"* (`:394`). An author is left with an unauthorized red on a channel the plan has already trained them to read as fatal, and will rebless it.
3. **`radiusEarth` is measured against a control that could not move.** The PLAN's `0/400 altered radiusEarth` almost certainly measured the *generated planet's* `radiusEarth` — which `_generatePlanetMoon` **overrides two lines later** (`MoonGenerator.js:281-283`, `radiusEarth = fraction * planetData.radiusEarth`, with the ⚠ MASS MUST BE RESCALED comment at `:303-309` documenting exactly that override). A field that is overwritten unconditionally cannot move, so a 0 there is `e = 0`, not evidence. **The record that ships moves 17/75.** This is the codebase's signature failure, occurring a fourth time, inside the sentence the PLAN labels *"Correction to the recon, in the plan's favour."*

### Mutation that would prove it bites
Gate must add geometry columns and split Instrument B by channel: DRAW STREAM red on exactly 6/221 seeds (enumerated), BODY IDENTITY red on exactly the planet-class set, plain moons 0/803. Mutant: substitute the *wrapper's post-migration* `orbitRadiusAU` instead of the pre-migration one ⇒ the enumerated seed set must change.

---

## CROSS-CUTTING

**Controls that could not move — this codebase's signature failure, found twice more here:**
1. Gate 7's `radiusEarth 0/400` (above) — measured on a field overwritten unconditionally two lines later.
2. Gate 6's atmosphere/pressure `0 → 0` — measured on a subject that is 0.093% of the population and whose only failure mode is a code shape the step does not write. Expected occurrences in the gate's own declared 500-moon sample: **0.46**.

**Navigational rot inside the region Step 8 edits (class N, blocks per §11.1):**
- `PLAN.md:390` — *"`type` appears in that file only in comments at `:9,:10,:11,:83`"*. `src/worldengine/port/conditionFromPlanet.js:83` is a bare `//` with no `type` on it. The substantive claim (0 code reads) holds — `grep -nP '\btype\b'` minus comment lines returns nothing — so this stays a rename.
- `PLAN.md:392` — *"The plain path has fifteen draws"*. Measured: no moon consumes 15 (11–13 plain, 17–18 terrestrial, 18–29 planet-class).
- `PLAN.md:391` — *"~3.5% of moons already reach `Planet.js`"*. Measured `wd-0…wd-1999`: 196/6670 = **2.94%**.
- `PLAN.md:389` / `:545` — *"`retained` true 323/323, `:526` short-circuits zero times"* and *"Instrument B hashes the ENTIRE moon record **(Step 8)**"*. The latter should read (Step 0, `b2ac455`).

**Ledger C2/C3 (`CARRIED.md:18-19`), which §11.7 rules *"CARRIED, cleared by Step 8"*:** Step 8's **Files** list does not contain `tests/port-route-agreement.test.js`, and none of its seven gates mentions route agreement, channel 2, a plain-moon stratum, or a mutation-window control. Step 8 as written lands the *precondition* (a second generator path) and none of the gate work. Under §11.6 that makes C2/C3 the carried item no step clears, at the step named to clear it.

**Before-numbers, run now:**
```
npm run test:body-identity                        → 1 file passed, 8 tests passed, 874ms
npx vitest run tests/port-route-agreement.test.js  → 1 file passed, 10 tests passed, 492ms
```

**UNMEASURED:** whether the 8b delta table's `iceness`/`landPalette`/`lavaGlowColor`/`lavaCrustColor` columns are non-zero on planet-class moons (I measured only `T_eq`, 75/75); the citation-fence before/after numbers (lane 2's territory); whether `tests/moon-condition-contract.test.js` and `tests/moon-rng-stream-identity.test.js` exist (they do not — `Files` names them as new).

---

## Lane transcript `a6975af19c7248e2d`

## VERDICT: 8b's central safety claim is **BROKEN**. It is a universe change, not a value change.

All numbers below come from commands run this session at `f679046`, clean tree (`git status --porcelain | grep -v '^??'` → empty). Scripts: `/tmp/claude-1000/-home-ax/237cc0d0-1e26-4841-ac3a-117ca5c72fbe/scratchpad/{ab,blast,planetmove,instrb,instrc,extremes,cond,named}.mjs`, `setup8b.js`, `v8b.config.mjs`, `vctl.config.mjs`.

**METHOD + CONTROL.** `PlanetGenerator.generate` is monkeypatched; calls whose stack contains `MoonGenerator.js` get the parent's real `orbitRadiusAU` (captured from the immediately preceding `StarSystemGenerator.js:563` call) instead of `1.0`. Draws counted by wrapping the Alea closure (`SeededRandom.js:15`); A/B at a single call site done by `exportState`/`importState` with restore to the 1.0-AU post-state so production continues unperturbed. **Control: my replication of Instrument B's capture over its exact 221 seeds reproduces the committed `tests/baseline/body-identity.json` with 0 profile mismatches, 0 planet-hash mismatches, 0 moon-hash mismatches.** A harness whose control never moved would be worthless; this one is pinned to the shipped fixture.

⚠ **8b as written is not implementable.** `planetData` carries no orbit AU (`PlanetGenerator.js:421 orbitAU: orbitRadiusAU` is an argument inside a `computeAtmosphere` params object, never a record field), and `_generatePlanetMoon(rng, planetData, moonIndex, parentZone, zones)` (`MoonGenerator.js:271`) never receives it. My sim is the **minimal** 8b — a signature/plumbing change the plan does not budget is required first.

---

## ANGLE 1 — "`retained` never flips" → **CONFIRMED BREAK, twice over**

Real population, 5 seed families × 400 seeds = 2,000 systems, **223 planet-class-moon generations** (`ab.mjs`):

| | measured |
|---|---|
| **draw count altered** | **49 / 223 = 21.97%** |
| `radiusEarth` of the generated pData altered | **0 / 223** ✅ (only this half survives) |
| **`atmoPhysics.retained` flipped** | **12 / 223 = 5.38%** |
| `tidalState.locked` flipped | **49 / 223 = 21.97%** |
| draw-count delta histogram | `{+2: 14, +3: 10, +9: 1, −2: 23, −3: 1}` |
| attribution among the 49 | `locked+lockType` **37**, `locked+retained+lockType` **12**, neither **0** |

**`retained` flips.** Refuted directly. But the more damaging finding is that **`retained` is not the mechanism** — `tidalState.locked` flipped on **49/49** draw-altered bodies, `retained` on only 12. The live site is **`src/generation/PlanetGenerator.js:697-698`**:

```js
    } else {
      rotationSpeed = rot(rng.range(0.033, 0.167) * (rng.chance(0.15) ? -1 : 1));
    }
```

— **two draws when unlocked, zero when locked**, gated at `:694`/`:696` on `tidalState.locked`, which comes from `PlanetGenerator.js:408 tidalLockTimescale(starMassSolar, massEarth, radiusEarth, Math.max(orbitRadiusAU, 0.01))`. Strongly orbit-dependent. 1.0 AU → real AU crosses the locking boundary on ~22% of bodies.

**Named counterexample where `retained` is TRUE on both sides and the stream still moves** — and it is inside Instrument B's own seed list. `wd-24 planet 1 moon 2`, parent at **0.22001367352134604 AU**:

| | today (1.0 AU) | 8b (0.220 AU) |
|---|---|---|
| draws inside `generate` | **12** | **10** |
| `T_eq` | 113.85535579334345 | 242.73289106564215 |
| `tidalState.locked` / lockType | `false` / `none` | **`true` / `synchronous`** |
| `atmoPhysics.retained` | `true` | `true` ← **unchanged** |
| pData `radiusEarth` | 0.3112082294654101 | 0.3112082294654101 |
| **moon** `radiusEarth` | 0.8542719322647017 | **0.8323499920658196** |
| **moon** `orbitRadiusEarth` | 148.17567349373306 | **124.68952426301077** |
| **moon** `startAngle` | 4.671631776946428 | **2.4837628558125346** |

Second named case, `retained` flipping: `wd-27 planet 3 moon 1`, parent at **1293.7566714449006 AU** — today 9 draws, `T_eq 5958.25`, `retained false`; 8b 12 draws, `T_eq 165.65`, `retained true`.

**Extremes sweep** (`extremes.mjs`): 6 star luminosities (M 0.008 L☉ → O 10⁴ L☉) × 9 forced types × 14 orbits (0.02 → 3000 AU) × 40 seeds = **30,240 same-state comparisons vs 1.0 AU**:

```
drawCountAltered      12307 / 30240 = 40.70%
radiusEarthAltered        0 / 30240        ← the one clause that holds, robustly
retainedFlips          2760      lockedFlips 11815
cloudsFlips             850      ringsFlips    324
composition.surfaceType flips 10165
draw-altered with NEITHER retained NOR locked flipped:  0
drawAlteredByAU: 0.02→1920, 0.05→1913, 0.1→1901, 0.3→1856, 0.5→1631, 0.8→158,
                 1.5→366, 3→366, 8→366, 20→366, 50→366, 1000→366, 3000→366
```

Density of flips is highest **close in** (0.02–0.5 AU, ~48% of cells), not far out — the opposite of the plan's "a 40 AU icy moon" framing.

**`retained true 323/323` also does not reproduce.** Measured over the same 2,000 systems: planets **8555 true / 2 false**; **planet-class moons 200 true / 11 false (5.2%)**. `PlanetGenerator.js:526`'s `&&` short-circuits **13 times today** in this population, and 11 of those are on 8b's own subject population.

---

## ANGLE 2 — "Is `retained` the only conditional in that path?" → **No. Full enumeration.**

`forceType` is always truthy on this path (`MoonGenerator.js:274` `const planetType = rng.pick(allowed)` → `:278`), so `PlanetGenerator.js:327`'s `this._pickType(...)` and its draws at `:854`/`:920` **never run**. `sunDirection` is always supplied, so `:703-704` is dead. Every remaining `rng.` site in `generate`, with its gate:

| line | draws | gate | orbit-sensitive? |
|---|---|---|---|
| `:333` `radiusEarth` | 1 | none | no — **drawn before any orbit-dependent branch, which is why `radiusEarth` can never move** |
| `:345` `palette`, `:355` `noiseScale` | 1+1 | none | no |
| `:364`/`:365` `deriveComposition(…, rng.float())` | 1 | `zones ?` ternary | ternary is on `zones`, not orbit — same cost both arms |
| **`:526`** `atmoPhysics.retained && rng.chance(...)` | **0 or 1** | **`retained`** | **YES** |
| `:532-533` cloud density/scale | 0 or 2 | `hasClouds` | YES (downstream of `:526`) |
| `:548` `hasRings` | 1 | none | shifts only if upstream shifted |
| `:552, :560, :568-569` ring internals | 0 or 8-9 | `hasRings` | shift-only |
| `:596` `moonCount` | 1 | none | shift-only |
| `:625-636`, `:666-672` storms | 0..n | `type === 'gas-giant'` | type is forced → no |
| `:687-689` `axialTilt` | 0 or 2 | `rings ? rings.tiltX : …` | via rings |
| **`:697-698`** `rotationSpeed` | **0 or 2** | **`tidalState.locked` + `lockType`** | **YES — the primary mechanism** |
| `:782` `noiseDetail: rng.range(0.3, 0.8)` | 1 | none | **the LAST draw in `generate`** |

**The post-generate assignment block (`:800-827`) contains ZERO lexical conditionals and ZERO rng draws.** `const condition = conditionFromPlanet(planetData)` (`:800`), then four pure assignments — `planetData.landPalette` (`:808`), `.iceness` (`:825`), `.lavaGlowColor` (`:826`), `.lavaCrustColor` (`:827`). So the plan's location of the hazard is wrong in both directions: the block it points at is inert, and the two live gates (`:526`, `:697-698`) sit ~120 and ~270 lines earlier.

---

## ANGLE 3 — "Does T_eq feed anything that BRANCHES rather than scales?" → **CONFIRMED BREAK**

Traced, `src/generation/PhysicsEngine.js`:

- `:154-155` `T_eq = equilibriumTemperature(luminosityRel, orbitAU)` → `T_exo = exosphericTemperature(T_eq)` → `:159-162` `jeansH2/N2/CO2/H2O`.
- `:189` `retainsH2 = jeansH2 > 6 && !primordialStripped` — **hard threshold**
- `:190-192` `retainsN2/CO2/H2O > (6 + uvStripFactor)` — **hard thresholds**
- `:194` `if (!retainsCO2 && !retainsN2) return { retained: false, … }` — **the early return that gates `PlanetGenerator.js:526`**
- `:218` `if (retainsH2O && T_eq < 373)` — direct T_eq threshold
- `:234` `composition: T_eq > 500 ? 'co2' : 'co2-n2'` — direct T_eq threshold
- `:653` `if (atmosphereRetained && T_eq > 200 && T_eq < 350)` — habitability
- `src/worldengine/base/bombardment.js:146` `const cold = (condition.T_eq ?? 288) < CRATER_T_MAX;` — **the crater path's own T_eq gate**

**Two independent orbit paths, not one.** `PhysicsEngine.js:175` `uvFlux = luminosityRel / (orbitAU * orbitAU)` and `:181` `primordialStripped = stripRate * ageGyr > 10` and `:185-186` `uvStripFactor = uvFlux > 10 && fieldStrength < 0.1 ? … : 0` take **`orbitAU` directly**, not through `T_eq`. `PlanetGenerator.js:423` also passes `rotationSpeed: tidalState.locked ? 0 : rot(0.1)` — a third orbit→branch chain into `fieldStrength` (`PhysicsEngine.js:174`). Treating this as "T_eq is just a value" understates it by two paths.

Measured on 211 planet-class moons (`cond.mjs`), condition-level flips under 8b:

```
condition.T_eq              211/211
lavaGlowColor / lavaCrust   211/211
composition.volatileFraction 132   composition.density 132
iceness                     130    landPalette         115
condition.atmosphere         85
composition.surfaceType      28    bombardment cold-gate (T<1200)  20
compositionClass              0    noSurface  0    composition.ironFraction  0
T_eq today/correct ratio: min 0.4377 · p25 0.9996 · median 1.7007 · p75 2.9366 · max 44.04
  wrong by more than 2x, either direction: 93/211 = 44.1%
```

The error is **two-tailed** — the minimum ratio 0.4377 means today's value is *too cold* on a substantial tail, not only too hot.

**Plan arithmetic check.** `equilibriumTemperature(1.0, au)`: 1 AU → **254.58831515634046** ✅ reproduces. 30 AU → **46.48125436278735** (5.477×), 35 AU → **43.03327955170912**, 40 AU → 40.25394707794011. Back-solve: `43.033` is the value at **35.0004 AU**, not 30. `PLAN.md:388`'s "43.033 at 30 AU (5.9×)" is mislabelled; at 30 AU it is 46.481 and 5.477×.

---

## ANGLE 4 — "Does composition or iceness feed a conditional draw?" → **REFUTED (both), with one caveat**

- **`iceness`, `landPalette`, `lavaGlowColor`, `lavaCrustColor` cannot gate a draw.** They are assigned at `PlanetGenerator.js:808-827`, after the last draw at `:782`. Structurally draw-free. ✅ REFUTED.
- **`composition.ironFraction` is orbit-independent.** `PhysicsEngine.js:387-389`: `0.28 + 0.15*metallicity + (rngFloat-0.5)*0.1` — no `orbitAU` term. Measured **0/211 flips**. So the chain composition → `fieldStrength` (`PhysicsEngine.js:174`) → `retained` → `:526` draw **does not move**. ✅ REFUTED.
- **Caveat:** `composition.volatileFraction` *is* orbit-branched — `PhysicsEngine.js:395` `frostRatio = orbitAU / frostLineAU` with thresholds at `< 0.5` and `< 1.0` (`:397, :399`), cascading into `surfaceType` (`:407-415`, threshold `volatileFraction > 0.4`) and `density`. Measured 132 / 28 / 132 flips. These are **value** flips only — nothing downstream of them draws. `composition.density` feeds `generateRingPhysics` at `PlanetGenerator.js:557`, whose five `rngFloat1..5` are pre-drawn at `:568-569`, so no draw is gated.

---

## ANGLE 5 — Fixtures and harnesses that pin values that move

Full vitest suite run twice under identical configs, once unpatched (control) and once with the 8b setup file. **CONTROL 25 failed / 5293; SIM-8b 27 failed / 5293. Newly failing: exactly 2. Newly passing: 0.**

| artefact | verdict under 8b | measured |
|---|---|---|
| **`tests/baseline/body-identity.json` (Instrument B)** | ⛔ **RED — including the channel the plan says must stay green** | `DRAW STREAM: draw profile moved on 7 seed(s)` and `BODY IDENTITY: 31 body record(s) moved`. My replication over the same 221 seeds: **7/961 planet hashes, 24/24 planet-class-moon hashes, 0/770 plain-moon hashes, 7/221 draw profiles.** `RECORD SHAPE` stays green. |
| **`tests/baseline/port-uniform-capture.json` (Instrument C)** | ⛔ **RED, `RESULT: STRUCTURAL BREAK (1) … Exit 2`** | `⛔ POPULATION MISMATCH … record changed : 65 e.g. S:00074:p0, P:00030:p3:m2 …`. Classified: **1 of 372 S-stratum planets + 64 of 64 P-stratum + 0 of 90 G-grid.** The 65 bodies are then *excluded*, and the tool prints its own warning that the 21 `record`-tier rows reading `0.000000e+0` are "entirely true and entirely misleading" as a result. |
| **Instrument A `npm run test:baseline`** | ⛔ RED | baseline pins **24 failing test IDs**; under 8b it is 26. (Control run just now: `OK — every test ID is exactly where the baseline left it (24 failing, 15 non-collecting files).`) |
| `src/generation/__tests__/__fixtures__/l0-moon-baseline.json` | ✅ green | `MOON_GRID` (`world-engine-l0-moon-grid.js:44-50`) is documented "Picked to land on REGULAR moons"; plain moons don't reach `:278`. |
| `tests/golden-trajectories/canonical-scenario.golden.json` | ✅ **REFUTED as a risk** | `canonical-scenario.js` imports only `accumulator.js` and `mulberry32.js`; zero `StarSystemGenerator`/`PlanetGenerator`/`MoonGenerator` references. Pure math. |
| `tests/moon-mass-radius-consistency.test.js`, `world-engine-l0-plumbing.test.js`, `port-route-agreement.test.js` | ✅ green | 56/56 passed unpatched; unchanged under 8b. |

---

## ANGLE 6 — Blast radius: **the plan's containment claim is also wrong** (new finding, not in any lane)

Whole-universe A/B, 2,000 systems (`blast.mjs`):

```
systems 2000 · planets 8557 · moons 6975 (plain 6764, planet-class 211)

planetHashMoved          41 / 8557      ← PLANETS MOVE
plainMoonHashMoved        0 / 6764  ✅
pcMoonHashMoved         211 / 211
pcMoonGeomMoved          47 / 211 = 22.3%
plainMoonGeomMoved        0 / 6764  ✅
geomKeyMoved: radiusEarth 47, radiusScene 47, radius 47, orbitRadiusEarth 47,
              orbitRadiusScene 47, orbitRadius 47, orbitSpeed 47,
              inclination 47, startAngle 47
moonCountChanged 0 · moonArrayLenChanged 0 · planet count changes 0
```

**Every one of the 41 moved planets moved on exactly one key: `systemContext`** (`planetmove.mjs`: key-signature histogram is `{"systemContext": 41}`, and with `systemContext` dropped from the fingerprint the count falls to **0**). The feedback path is `src/generation/StarSystemGenerator.js:966-971`:

```js
      const moons = entry.moons.map((moon) => ({
        type: moon.type,
        radiusEarth: moon.radiusEarth,
        orbitRadiusEarth: moon.orbitRadiusEarth,
        tidalHeating: moon.tidalHeating,
      }));
```

written onto `entry.planetData.systemContext` at `:972`. `systemContext` is **not** in `WORLDENGINE_BAKES` (`tests/body-identity-fence.test.js:173-175`), so it is inside both Instrument B's `planetRecord` hash and Instrument C's `identityRecord` fingerprint. It is also forwarded into the world engine at `src/worldengine/base/adaptL0.js:41`.

So `PLAN.md:401`'s **"Instrument B's only allowed diff is planet-class moons, enumerated in the commit message"** is false as written: 7 of the 31 diffs on Instrument B's population are **planets** (`wd-24 p1`, `wd-27 p3`, `wd-66 p0`, `wd-100 p5`, `wd-174 p0`, `wd-189 p0`, `gc-22 p2` — all reported as `sub-neptune→sub-neptune` / `gas-giant→gas-giant`, same type, different hash).

Containment **does** hold for plain moons: 0/6764 and 0/770. Mechanism: `StarSystemGenerator.js:594 const moonRng = planetRng.child(\`moon-${m}\`)` gives each moon its own stream, so a shift inside one moon cannot reach a sibling.

---

## ROLLUP

| clause of the 8b claim | verdict | number |
|---|---|---|
| "0/400 altered the post-generate draw stream" | ⛔ **CONFIRMED BREAK** | **49/223 (21.97%)** real population; **12,307/30,240 (40.70%)** synthetic; Instrument B `DRAW STREAM` red on **7/221 seeds** |
| "0/400 altered `radiusEarth`" | ✅ **REFUTED — the claim holds, but measures the wrong body** | 0/223 and 0/30,240 on the generated *pData*. The **moon's** `radiusEarth` moves on **47/211 (22.3%)**, because `fraction = rng.range(0.10, 0.25)` at `MoonGenerator.js:281` is drawn *after* `:278` returns. |
| "because `retained` never flips" | ⛔ **CONFIRMED BREAK, and the wrong mechanism** | `retained` flips **12/223**; `tidalState.locked` flips **49/223** and is present on **49/49** draw-altered bodies. Site = `PlanetGenerator.js:697-698`, not `:526`. `wd-24 p1 m2` moves the stream with `retained` true on both sides. |
| "`:526` short-circuits zero times today / 323/323" | ⛔ **does not reproduce** | planets **8555 T / 2 F**; planet-class moons **200 T / 11 F (5.2%)** |
| "this is a **value** change, not a universe change" | ⛔ **CONFIRMED BREAK** | it moves radius, orbit, orbitSpeed, inclination and startAngle on **47/211 planet-class moons**, and `systemContext` on **41/8557 planets** |
| "Instrument B's only allowed diff is planet-class moons" | ⛔ **CONFIRMED BREAK** | **31** diffs = 24 planet-class moons + **7 planets**, plus 7 red draw profiles |
| "T_eq 254.588 at 1 AU vs 43.033 at 30 AU (5.9×)" | ⚠ half wrong | 254.588 ✅; **43.033 is 35.0004 AU**; 30 AU = **46.481** (5.477×); real error two-tailed, ratio 0.438…44.04, **44.1% wrong by >2×** |
| "~3.5% of moons reach `Planet.js`" | ⚠ high | **211/6975 = 3.02%** (2,000 systems); **24/794 = 3.02%** on Instrument B's population |
| golden-trajectory harness at risk | ✅ **REFUTED** | `tests/golden-trajectories/` imports no generator; pure accumulator + mulberry32 |
| `iceness`/`landPalette`/bakes gate a draw | ✅ **REFUTED** | assigned at `PlanetGenerator.js:808-827`, after the last draw at `:782` |
| `composition` gates a draw | ✅ **REFUTED** | `ironFraction` is orbit-free (`PhysicsEngine.js:387-389`), 0/211 flips; ring `rngFloat`s are pre-drawn at `:568-569` |

**Consequence for the build order.** 8b cannot ship on a value-only delta table over `T_eq`/composition/`iceness`/`landPalette`/`lavaGlowColor`/`lavaCrustColor` — none of those cover `radiusEarth`, `orbitRadiusEarth`, `orbitSpeed`, `inclination`, `startAngle` or `systemContext`, which is exactly what moves. It requires a rebless of `tests/baseline/body-identity.json` (7 profiles + 31 records), of `tests/baseline/port-uniform-capture.json` (65 bodies), and of Instrument A's 24→26 failing-ID baseline, each of which must be its own commit or the delta table is unfalsifiable. And it needs a plumbing change first, because the parent's orbit AU is not reachable from `MoonGenerator._generatePlanetMoon`.

---

## Lane transcript `a84ac0dea7ca4cfa6`

# BUILD PLAN — PLAN §4 Step 8 ("Moons get a real condition record, derived and never drawn")

Synthesised from 5 recon + 3 refutation lanes, with the load-bearing numbers re-measured by me at `f679046`, clean tree. My own probes: `/tmp/claude/syn1.mjs`, `syn2.mjs`, `syn3.mjs`. Before-numbers I ran just now: `npm run test:body-identity` → **8 passed, 889 ms**; `npm run port-uniform-delta:citations` → **400 CHECKED / 421 UNCHECKED / 0 UNRESOLVED / 0 PAST-EOF / 0 MALFORMED / 2 TICK-PARITY / 1 SPAN-OPEN / 6 ILLUSTRATIVE, exit 0**.

---

## 1. VERDICT ON THE PLAN'S OWN CLAIMS

Every number Step 8 (`PLAN.md:386-404`) is sold on. "Mine" = I re-ran it this session; otherwise the lane is named and I say why I believe it.

| # | Claim (PLAN.md line) | REPRODUCES? | Corrected value | Does the argument survive? |
|---|---|---|---|---|
| 1 | `:394` "Instrument B must hash the ENTIRE moon record… not four named fields" — presented as Step 8 work | **NO — already shipped** | `tests/body-identity-fence.test.js:196-204` `moonRecord` iterates `Object.keys(m)` with **no allowlist**; planets get `WORLDENGINE_BAKES` filtering at `:190-193`, moons get none. Byte-identical across all 3 commits touching the file (`b2ac455`, `0af246e`, `56d136a`). **Mine: read the function.** `:545` should read "(Step 0, `b2ac455`)" | Argument survives; the *task* does not exist. See §3 for why this accident is what rescues the gate |
| 2 | `:394` "Must be **byte-identical**. If it goes red, a draw leaked" | **NO — self-contradictory** | Hashing the whole record means a faithful additive append moves **every plain moon hash with zero draws moved**. The test file says so itself at `:518-524`. And the contrapositive is false — see break #1 | **Argument inverts.** As written the gate condemns a correct commit and blesses a broken one |
| 3 | `:390` "The plain path has **fifteen** draws" | **Partially — it is a call-site count, not an executed count** | 15 = `rng.` sites lexically inside `generate` with the `:151`/`:152` ternary collapsed and `:99` excluded. **No moon consumes 15.** Executed: rocky/ice/captured **11-13**, volcanic **12-13**, terrestrial **17-18**, planet-class **18-29** (lanes DRAWSTREAM + refuter 3 agree, both instrumenting the passed-in instance on the production path). Lane INSTRUMENTB reports each +1 (12/13/14, 19) from a synthetic forced-generation driver — **discounted: it measured a harness it built, the two production-path lanes agree** | Survives as prose, kills gate #2 (§5) |
| 4 | `:390` "seven of them come after `startAngle` (`:157`)" | **YES, exactly** | `:185, :189, :190, :195, :200, :201, :202` = 7. Verified by 4 independent lanes | Survives |
| 5 | `:390` "Splicing… re-rolls `noiseScale` on **every plain moon in the universe**" | **NO — off by 138×** | `MoonGenerator.js:185` is `Math.max(rng.range(3.0,6.0), 2.5/radius)`. **Mine (`syn1.mjs`, 4861 plain moons over `wd-0…1499`): the drawn value is clamped away on 98.77%; min floor 3.774 vs a `[3,6)` draw.** Mine (`syn2.mjs`, Instrument B's own 192 seeds): a one-draw splice at `:185` moves **5 of 691** plain record hashes (`wd-5`×2, `wd-34`, `wd-133`, `wd-183`) — independently reproducing refuter 1's five bodies | **Argument collapses.** The hazard is real but the wide hash buys 5 moons of coverage out of 691 on it |
| 6 | `:391` "`retained` true **323/323**, `:526` short-circuits **zero times** today — dormant-but-armed" | **NO** | Lane NUMBERS: planets **12,741/12,742**; **planet-class moons 241/250 → fires 3.6%**. Refuter 2: planets 8555/8557; planet-class moons 200/211. Two lanes, different populations, same verdict. `:526` is live, and live *on 8b's own subject* | Framing fails; `:526` is still not the mechanism (see #8) |
| 7 | `:388` "24.4% of plain moons are captured" (`:155` conditional) | **YES** | 1602/6696 = **23.93%** over `wd-0…1999` (lane DRAWSTREAM). 24.4% is 0.2σ from that at n=262. ⚠ denominator is *plain* moons; over **all** moons it is 23.2% | Survives |
| 8 | `:391` "8b is draw-stream **neutral**: 0/400 draw stream, 0/400 `radiusEarth`, because `retained` never flips. A **value** change, not a universe change" | **BROKEN on all three clauses** | **Draw stream:** 52/233 (lane NUMBERS), 49/223 (refuter 2), 17/75 (refuter 3) = **22.0–22.7%**, three independent harnesses. **Mechanism is `PlanetGenerator.js:697-698`** (`rng.range` + `rng.chance` — 2 draws unlocked, 0 locked, gated on `tidalState.locked`), present on **52/52, 49/49, 17/17** of draw-altered bodies; `retained` flips only 8-12. **`radiusEarth 0/400` measured the wrong object** — refuter 3's catch: it is the *generated pData's* radius, which `MoonGenerator.js:281-283` overwrites unconditionally two lines later. The **moon's** `radiusEarth` moves on **17/75, 47/211** | **Does not survive.** 8b moves radius, orbit, orbitSpeed, inclination, startAngle. This is the plan's own signature failure — a control that could not move, inside the sentence labelled "Correction to the recon, in the plan's favour" |
| 9 | `:391` "T_eq 254.588 at 1.0 AU vs **43.033 at 30 AU** (5.9×)" | **Half** | 254.588 at 1 AU ✅ exact. **43.033 is the value at 35.0004 AU**; 30 AU = **46.481**, ratio **5.477×**. Both refuter 2 and lane NUMBERS back-solved it independently. Also: the error is **two-tailed** — ratio today/correct spans 0.404–57.2, **44-48% wrong by >2×**, ~25% of moons are too *cold* today | Direction survives; the "40 AU icy moon carries an inner-system temperature" framing describes one tail |
| 10 | `:391` "~3.5% of moons already reach `Planet.js`" | **High, family-dependent** | **Mine: 157/5018 = 3.13%** on `wd-0…1499`. Refuter 2: 3.02% (2000 systems). Lane NUMBERS pooled across 5 seed families: **2.64%**, range 1.56% (numeric seeds) – 3.47% (`pcc-`). Use **~3.1% on `wd-*`**, and say the family dependence out loud | Survives — small minority either way |
| 11 | `:397` "today the same bodies fabricate **10.4 / 14.1 / 56.3 g**" | **NO — unattributable, and far too kind** | **Mine: median 34.6 g, p95 4315, max 25,556 g, 4127/4861 (84.9%) above 3 g** on generated plain moons. Lane NUMBERS incl. Sol: median 33.25, **max 1,000,000 g (Deimos, `SolarSystemData.js:241` `radiusEarth: 0.001`)**. Mechanism `conditionFromPlanet.js:730` `massEarth: d.massEarth ?? 1.0` × `baseStep.js:18-19` ⇒ **every plain moon's g is exactly 1/R²** | Direction survives, *understated by 3-4 orders of magnitude*. Replace the triple |
| 12 | `:397` "an 11 km Phobos-class body derives **346,021 g**" | **YES, exactly — but it is a hand-authored Sol body** | 346020.76124567474 = 1/0.0017², `SolarSystemData.js:230`. **No generated moon is that small** — smallest measured ≈40 km (`radiusEarth 0.006255`). And Deimos (`:241`) is worse at exactly 1e6 g. The plan names the second-worst body | Survives as an illustration; must be labelled hand-authored |
| 13 | `:397` "`surfaceGravity` over the whole moon population lies in **[0, 3] g**" as a gate | **Cannot fail, and already fails** | **Mine:** under 8a's own declared formula (`g = radiusEarth × ρ_parent`) **max 0.539 g, p95 0.229, 0/4861 outside [0,3]** — 5.6× headroom. Meanwhile **planet-class moons, which already carry real mass, max 3.13-3.26 g → 1 body over the line today**, and the shipped fence `tests/moon-mass-radius-consistency.test.js:76` asserts `< 5` | **Gate is both vacuous and self-contradicting a shipped assertion** |
| 14 | `:398` "Sol's Moon derives **0.165 ± 0.01 g**, not today's **13.42 g**" | **13.42 reproduces; the target is unreachable by 8a** | 13.41759583517825 = 1/0.273² ✅. But: **`grep -c massEarth src/generation/SolarSystemData.js` → 0** (mine), Sol's Moon is a hand-authored literal at `SolarSystemData.js:191-201`, and **`MoonGenerator` is never invoked for Sol** (its only mention there is a comment at `:55`, mine). 8a cannot move this body. And with Sol-Earth massless the declared formula gives 0.273 g (or NaN), not 0.165 — 0.165 needs the Moon's *actual* density 3344/5514 | **Gate is unsatisfiable inside Step 8's declared Files.** See open question Q1 |
| 15 | `:399` "Zero moons produce a truthy atmosphere with undefined pressure" | **Reproduces as 0 — and cannot ever be non-zero** | Lane PROVENANCE, 3 corpora, 3115 moons: truthy atmosphere 18/20/27, **pressure undefined 0 in all**. Structural: `MoonGenerator.js:193-197` emits `{color,strength}` which fails `hasEngineAtmosphereShape` (`conditionFromPlanet.js:371-373`), and when truthy, `:390` is `phys.pressure ?? 0`. Only the flat-passthrough branch at `:380` can violate it, and 8a does not write it. Plain terrestrial moons are **0.09-0.14%** — expected count in a 500-moon sample: **0.46** | **Gate measures 0→0 forever** |
| 16 | `:388` "Every value derived **purely** from what `generate` already holds in scope" | **NO for `T_eq`** | **Mine: `planetData.orbitRadiusAU` is undefined on 6279/6279 planets.** The AU lives on the wrapper (`StarSystemGenerator.js:605`); `:594-595` passes only `(moonRng, planetData, m, moonCount, parentZone, zones)`. `age`, mass/density, `tidalState` inputs **are** in scope | **8a needs a signature change the Files list does not budget** |
| 17 | `:388` "`type` appears in that file only in comments at `:9,:10,:11,:83`" | **Line list wrong, substance right** | `:83` is a bare `//` with no `type` on it — and was wrong on the day it was written (`dcad360`, where `:83` read `types`, plural). Misses `:350, :545, :546, :582, :584`. **All 8 occurrences are comments; 0 code reads** (only `typeof` at `:315,:317,:372`) | **Stays a rename, not a redesign.** Fix the citation to §10's symbol-only form |
| 18 | `:401` "Instrument B's only allowed diff is planet-class moons" (8b) | **NO** | Refuter 2, live substitution over the fence's 221 seeds: **31 record diffs = 24 planet-class moons + 7 PLANETS**, plus **DRAW STREAM red on 6-7/221 seeds**. The planets move on exactly one key — `systemContext` (`StarSystemGenerator.js:966-972`, which folds moon `radiusEarth`/`orbitRadiusEarth`/`tidalHeating` back onto the parent and is **not** in `WORLDENGINE_BAKES`) | **Does not survive.** Containment holds only for *plain* moons: 0/6764, 0/803, 0/1985 across three lanes |
| 19 | §11.7 `:716-717` "C2/C3 CARRIED, cleared by Step 8" | **NO mechanism in the step** | Step 8's Files (`:392`) does not list `tests/port-route-agreement.test.js`; none of its 7 gates mentions route agreement, channel 2, an M stratum, or a mutation-window control. And the naive repair reds **1834/1834** plain moons because `bakedOn` (`port-route-agreement.test.js:207-210`) reads `landPalette`/`iceness`/`lavaGlowColor`/`lavaCrustColor`, which plain moon records do not carry | **C2/C3 would ship un-cleared at the step named to clear them** — §11.6's promote-or-retire trigger |

---

## 2. CONFIRMED BREAKS

Constructions the refuters actually built and I verified where noted.

**B1 — The byte-identity gate is 99.28% blind to the plan's own named hazard.** *(refuter 1; I reproduced it independently in `syn2.mjs`)* One `rng.float()` spliced immediately before `MoonGenerator.js:185` leaks a draw into the shared stream and moves the whole-record hash on **5 of 691 plain moons**. `PLAN.md:394`'s contrapositive — green ⇒ no draw leaked — is false. Cause: `Math.max(…, 2.5/radius)` discards the drawn value on 98.77% of plain moons (mine, 4861 moons). Corollary: `MoonGenerator.js:333-334`'s comment "noiseScale is texture detail, not geometry" (`ExoticOverlay.js:335`) is false — 98.77% of `noiseScale` values *are* `2.5/radius`.

**B2 — Instrument B's DRAW channel carries zero discriminating information across the four constructions that matter.** *(refuter 1)* Its counter is a `SeededRandom.prototype` accessor (`tests/body-identity-fence.test.js:225-241`), so it counts **every instance**, including a fresh `new SeededRandom(eccSeed)`. Measured on `wd-0…191`: a dedicated-namespace draw (the pattern `PLAN.md:390` instructs authors to use, documented as safe at `MoonGenerator.js:244-251`), a tail draw, a splice at `:185`, and a splice in `_pickType` **all red the draw channel on 170/192 seeds**. The shipped comment at `MoonGenerator.js:248-250` ("draws ZERO numbers… so the additive gate stays green") is wrong about the gate it names; it only reads true today because those draws are already in `tests/baseline/body-identity.json`.

**B3 — The non-enumerable bypass. All eight Instrument B tests stay green while the six fields are fully readable.** *(lane INSTRUMENTB + refuter 3, independently)* `Object.defineProperty(moon,'massEarth',{value:m,enumerable:false})` ⇒ hash unchanged, RECORD SHAPE unchanged, DRAW STREAM unchanged, `moon.massEarth` = 0.004 downstream. **This is idiomatic, not adversarial**: it is exactly the pattern of the file being renamed, `conditionFromPlanet.js:890-895`, framed there at `:885-889` as *"it CANNOT enter any hash… The protection is structural."* Under §11.9 an idiomatic bypass **blocks**.

**B4 — `_provenance` is a presence test; four of Step 8's seven gates pass on a record with no physics in it.** *(refuter 3)* `conditionFromPlanet.js:682` is `v != null ? 'measured' : 'defaulted'`. Measured: `massEarth: false`, `age: -5`, `T_eq: 'x'` all report `'measured'`. Append `{massEarth:0, age:0, T_eq:0, surfaceHistory:{}}` ⇒ gate 3 reads 0 defaulted, gate 4 reads g=0 ∈ [0,3], gate 2 unchanged, DRAW STREAM green.

**B5 — The gravity gate passes a mass wrong by up to 13.3× (median 1.8×), and that error moves Step 9's own declared consumer on 100% of moons.** *(refuter 3)* Omitting the density factor (`massEarth = radiusEarth³`) gives max 2.616 g — still inside [0,3]. Fed through `craterSchedule`, which Step 9's declared first move (`PLAN.md:441`, replace `Planet.js:1596`'s `ROCKY_TYPES.has(d.type)` with `craterRelevanceOf(condition)`) puts on the moon path: `regolithRoughness` moved 2109/2109, `sizeMul` 2109/2109, `nStamp` 1765/2109, median |Δ| 13.7%, max 239%. This is the §11.3.1 D-clause satisfied literally.

**B6 — 8b is a universe change.** *(lane NUMBERS + refuters 2 & 3, three harnesses)* 22.0–22.7% of planet-class moon generations change draw count; **17/75 and 47/211 moon records move `radiusEarth`, `orbitRadiusEarth`, `orbitSpeed`, `inclination`, `startAngle`** — none of which is a column in the declared delta table. Plus 7/8557 planets move via `systemContext`, and Instrument B's DRAW STREAM reds on 6-7/221 seeds — a channel `PLAN.md:394` has already trained the author to read as fatal.

**B7 — `ExoticOverlay` mutates the derivations' own inputs after `generate` returns.** *(refuter 1; I reproduced it in `syn3.mjs`)* `ExoticOverlay.js:325-337`, reached from `StarSystemGenerator.js:920` after every moon is generated, multiplies `moon.radiusEarth`, `radiusScene`, `orbitRadiusEarth`, `orbitRadiusScene`, `radius`, `orbitRadius` by kEarth/kMap. **Mine, `wd-0…1499`: 56 swaps, 31 with moons, 34 moons rescaled, kEarth 0.1329–2.6818, `k === 1` on zero of them.** Any derived `massEarth` is not rescaled ⇒ `surfaceGravity` carries an error of exactly 1/kEarth², up to **56.6×**. The byte-identity gate is structurally blind (same mutation both sides of any A/B). **This is already a live defect on the shipped `tidalHeating` (`MoonGenerator.js:161`), not something 8a introduces.**

**B8 — The Sol gate is unsatisfiable inside Step 8's Files.** *(refuter 3; I verified the two facts)* `grep -c massEarth src/generation/SolarSystemData.js` → **0**; `grep -n MoonGenerator` there → one hit, a comment at `:55`.

**Attacks run that broke nothing** — so "nothing found" is a coverage fact:
- **Append point inside `generate`**: `generate` (`:93-205`) has exactly one early return (`:100`, before any plain-path code); last draw is `:202`; no draw after the return literal. Hoisting to `const moon = {…}; …; return moon;` is valid *with respect to `generate`'s own draws*. (Invalidated only by B7, which is about the record's lifetime.)
- **Post-return re-entry into the shared rng**: none. `moonRng` (`StarSystemGenerator.js:594`) is per-moon and discarded; `:596-597` writes `_systemSeed`/`_ordinal` with no draws. Blast radius of any splice is confined to that one moon — measured 0/6764, 0/1985, 0/803 plain moons across three lanes.
- **Do the new derivations need a drawing callee?** 5 of 6 are draw-free: `equilibriumTemperature` (`PhysicsEngine.js:121`), `tidalLockTimescale` (`:264`), `checkTidalLock` (`:280`), `computeSurfaceHistory` (`:796`), mass-from-density. Only `deriveComposition(…, rngFloat)` (`:380`) takes a drawn float — as the plan says.
- **Do `iceness`/`landPalette`/`lavaGlowColor`/`lavaCrustColor` gate a draw?** No — assigned at `PlanetGenerator.js:808-827`, after the last draw at `:782`. **Does `composition` gate one?** No — `ironFraction` is orbit-free (`PhysicsEngine.js:387-389`), 0/211 flips; ring floats are pre-drawn at `:568-569`.
- **Golden-trajectory harness at risk from 8b?** No — `tests/golden-trajectories/canonical-scenario.js` imports only `accumulator.js` + `mulberry32.js`, zero generator references.
- **Non-JSON hazards in the moon record** (undefined / NaN / ±Inf / -0 / functions / Symbols / Dates / Maps / accessors / cycles): **0 across 794 records**. One real finding: 1598 *aliased* refs — `baseColor`/`accentColor` point into the module-level `PALETTES` table (`MoonGenerator.js:110`). Harmless to hash; **fatal if any 8a code writes in place**.
- **Full suite under a simulated 8b**: control 25 failed / 5293, sim 27 failed / 5293. Newly failing exactly 2, newly passing 0.
- **Rename simulation, 4 scenarios** (lane RENAME, in a tar copy that reproduces the live citation counters byte-identically): B1 file-only → exit 69 module-not-found; B1″ imports fixed, tool stale → exit 3 naming the dead mapping; B2 key frozen, value repointed → **exit 0, counters diff-identical 400/421/0/0/0/2/1/6**; B3 key "tidied" → exit 2 with 6 unresolved. Function rename → exit 2 on **exactly one** citation, `PLAN.md:779`.

---

## 3. THE COMMIT SHAPE

**The recording-vs-checking fact that makes this plan work.** The widened moon hash was recorded in `tests/baseline/body-identity.json` at commit **`b2ac455` (Step 0)**, eight commits before HEAD `f679046`. There is **no "widen Instrument B" commit to write** — the widening shipped. Because the recording predates every commit below, the check **can fail**, and that is an accident of Step 0's sequencing, not of Step 8's design.

**The rule that keeps it non-vacuous, stated once and enforced per commit:** `WD_REBLESS_BODY_IDENTITY=1` must not run inside C1, C2, C3, C4 or C7. Mechanical check before each of those commits — `git log -1 --format=%H -- tests/baseline/body-identity.json` must return a sha **older than the commit being made**, and `git diff --cached --name-only` must not contain `tests/baseline/`.

| # | Commit | What it changes | Why it is its own commit | Gate that must be green before the next starts |
|---|---|---|---|---|
| **C0** | `docs(step 8): correct the numbers Step 8 is sold on` | `PLAN.md` §4 Step 8 + `:545` + §11.7 + `CARRIED.md`. Every row of §1 above that says NO. Per §10, `conditionFromPlanet.js` refs go symbol-only; per the line-count-neutrality rule, **expand lines, do not insert** | Navigational rot inside the region Step 8 edits is class N and blocks per §11.1. Folding it into a code commit makes the code diff unreviewable | `npm run port-uniform-delta:citations` → **400/421/0/0/0/2/1/6, exit 0** (unchanged) |
| **C1** | `test(Instrument B): planet-class side-channel + counted assertions` | Test-only. Add a **top-level** `baseline.planetClassMoons` map keyed `seed/planet/moon`, derived live in `captureAll`'s second pass (`tests/body-identity-fence.test.js:355-361`, which already holds `m.isPlanetMoon`). Rewrite BODY IDENTITY / RECORD SHAPE to assert **counts and partitions**, not identity | ⛔ **It must not go inside `hash({system, planets})` (`:290`).** Measured: adding a `pc` key inside `planets[]` moves `wd-0`'s rollup `e67f7a5184d423ac → 95dbe61d46cc21be`, which breaks NEGATIVE CONTROL at `:572` and forces a 221-seed rebless **inside** the gated commit. And without this commit, "only allowed diff is planet-class" is a sentence with no mechanism | `npm run test:body-identity` → **8 passed**; and every `rollup` in `tests/baseline/body-identity.json` **unchanged** (`git diff --stat tests/baseline/` → empty) |
| **C2** | `refactor: conditionFromPlanet → conditionFromBody (file + function)` | `git mv` the file; rename the export; 25 code files; the 2 string gates (`tests/port-condition-contract.test.js:2757` adapter-name, `:3660` export surface); `tests/port-route-agreement.test.js:124` needle; `tools/port-uniform-delta.mjs:943` **value only** and `:1042`; repair `PLAN.md:779` | Zero behaviour change. Keeping it separate is what makes C4's diff readable. ⛔ **Do not touch the CITE_FILES *key* at `:943`** — measured exit 2 with 6 unresolved refs | Citations **400/421, exit 0, diff-identical**; `npm run test:body-identity` **8 passed, all hashes byte-identical**; full suite failure count unchanged from Instrument A's blessed 24 |
| **C3** | `feat(plumbing): thread the parent's real orbit AU into MoonGenerator` | Pass `orbitRadiusAU` to `MoonGenerator.generate` at `StarSystemGenerator.js:595` (it is in scope there — `:605` writes it onto the wrapper) and forward to `_generatePlanetMoon`. **Nothing consumes it yet** | `planetData.orbitRadiusAU` is undefined on 6279/6279 (mine). Both 8a's `T_eq` and 8b need it. Landing it inert means it can be gated by **full byte-identity**, the strongest gate available — which is impossible once anything consumes it | `npm run test:body-identity` → **all three channels byte-identical green**. Any red here means the signature change leaked |
| **C4** | `feat(8a): moons carry a derived condition record` | `src/generation/MoonGenerator.js` only. Hoist the literal (`:165-204`) to `const moon = {…};`, append the six derivations, `return moon;`. Plain assignment. Use the `:257-263` namespace pattern with a **new** prefix (`mooncomp:`) for `deriveComposition`'s float | The production change alone, against a baseline recorded 8 commits earlier | Three-channel verdict written into the commit message **before the run** — see §6 |
| **C5** | `re-record(Instrument B): bless 8a's additive moon fields, named` | `tests/baseline/body-identity.json` **alone** | Reblessing inside C4 destroys the only control Step 8 has | `git diff --stat` shows exactly one file; the diff touches only moon hash strings + `moonShapes` (a third shape appears); zero `rollup`… wait — rollups **will** move, since moon hashes feed them. State that in the message as an expected count |
| **C6** | `test(8a): value gates for the six derivations` | New `tests/moon-condition-contract.test.js` + `tests/moon-rng-stream-identity.test.js` (§5) | These must be written against a **stable** baseline, or a failing value gate is indistinguishable from an unblessed hash | New file green; a named mutant per gate reds it (§5) |
| **C7** | `fix(8b): planet-class moons generate at the parent's real orbit` | `MoonGenerator.js:278` `1.0` → the threaded AU | The universe change, isolated | Delta table **including geometry columns**; Instrument B partitioned by channel — see §5 gate 7 |
| **C8** | `re-record: bless 8b across three instruments` — **three commits, one per instrument** | `tests/baseline/body-identity.json`; `tests/baseline/port-uniform-capture.json` (65 bodies: 1 S + 64 P); Instrument A's failing-ID baseline (24 → measured 26) | One commit per instrument or the delta table is unfalsifiable — you cannot tell which instrument's red you blessed | Each: exactly one baseline file in the diff, counts in the message matching the numbers C7 predicted |
| **C9** | `test(route agreement): the M stratum + a mutation-window control` | `tests/port-route-agreement.test.js` — add plain moons, with a comparator that is **not** `bakedOn` | ⛔ Adding plain moons to the existing P-stratum comparator reds **1834/1834** instantly, because `bakedOn` (`:207-210`) reads four bakes `MoonGenerator` never writes. This needs its own comparator | Ledger C2 and C3 (`CARRIED.md:18-19`) close with a named mutant each, or they get promoted to blocking per §11.6 |

---

## 4. THE RENAME DECISION

**File AND function, in one commit (C2).**

| | function only | **function + file** |
|---|---|---|
| code files that must change | 19 | **25** |
| …incl. keeping comments consistent | 27 | 33 |
| doc/`.html` files that go stale | 9 | 9 (same set) |
| citations that must be repaired | 1 (`PLAN.md:779`) | **1 (the same one)** |
| lines in `tools/port-uniform-delta.mjs` | 1 | **3** (`:943` value, `:1042`, plus its own prose) |
| citation fence after | 400/421 exit 0 | **400/421 exit 0 — diff-identical** (measured) |
| failure mode if you miss a site | exit 2 + 5 tests red | same **plus** exit 3 (dead CITE_FILES) and exit 69 (module not found) — strictly louder |

**Marginal cost: 6 files, 2 lines, 0 additional citations repaired.** Line numbers survive because a pure rename preserves content byte-for-byte and the CITE_FILES *key* is a citation spelling, not a basename. Three reasons beyond cost: `PLAN.md:398` already lists `src/worldengine/port/conditionFromBody.js` under Files and `:584` already writes the post-rename name, so a function-only rename leaves the plan citing a file that does not exist, in the scanned set, with no gate that can see it (the ref is symbol-less prose); splitting it costs a second migration and leaves every future author's grep for the moon adapter landing on the planet filename; and Step 7 already ran this play and left the recipe in-file at `tools/port-uniform-delta.mjs:964-971`.

**Two hard preconditions, both measured:** do not change the CITE_FILES key at `:943` (repoint the value only — tidying the key is exit 2 with 6 unresolved); and repair `PLAN.md:779`'s symbol (`src/objects/Planet.js:1594 \`const condition = conditionFromPlanet(d);\``) in the same commit — it is the only `line + symbol` citation repo-wide carrying the identifier, verified by `grep -rnoP ':\d+\s*`[^`]*conditionFromPlanet[^`]*`'` → 1 hit.

---

## 5. THE GATE LIST, REWRITTEN

Each replacement gate carries a **named mutant** that must red it.

| Step 8 gate | Verdict | Replacement | Named mutant |
|---|---|---|---|
| **G1** `:394` whole-record hash, byte-identical | **REPAIR** — the widening shipped at `b2ac455`; byte-identity is impossible in the same breath | *"C4: DRAW STREAM green 221/221. BODY IDENTITY red on exactly N plain moons, 0 planets, 0 planet-class. RECORD SHAPE red naming exactly the six appended keys on the plain shape only. **A green RECORD SHAPE is a FAILURE** — it means the append was non-enumerable."* N is written into the commit message before the run | **`nonenum`**: change one append to `Object.defineProperty(moon,'massEarth',{value:m,enumerable:false})` ⇒ RECORD SHAPE must red. **`onemoretoo`**: 771 plain moons instead of N ⇒ counts assertion must red |
| **G2** `:395` per-type draw count pinned to a committed number | **REPLACE** — not satisfiable: every type has 2-8 counts (rocky/ice/captured 11-13, volcanic 12-13, terrestrial 17-18, planet-class 18-29), and the plan's own prescribed namespace idiom draws from a different object the gate cannot see | Delete it. Instrument B's DRAW STREAM channel already strictly dominates it, and C1 makes that channel counted. In its place, `tests/moon-rng-stream-identity.test.js` pins the **per-(parent-type, moonIndex, resulting-type) draw-count SET** over ≥1500 seeds, as documentation of the stream shape rather than a gate | **`extradraw`**: insert `rng.float();` before `MoonGenerator.js:157` ⇒ every set shifts +1 and DRAW STREAM reds |
| **G3** `:396` `_provenance` zero `'defaulted'` on ≥500 moons | **KEEP as a presence gate + ADD value gates** — `conditionFromPlanet.js:682` is `v != null`, so `massEarth: false` reads `'measured'` | Presence arm: reuse `body-identity-fence.test.js:93`'s `BULK_SEEDS` (**713 moons**, 40% headroom, same population as G1) with a population guard `expect(moons.length).toBeGreaterThanOrEqual(500)` as its own `it()` **first**. Baseline to beat: **691/713 defaulted on each of `massEarth`/`age`/`T_eq`/`surfaceHistory` → must go to 0.** Value arm: `\|massEarth − radiusEarth³·ρ_parent\| / massEarth < 1e-9`; `T_eq === equilibriumTemperature(zones.luminosity, parentOrbitAU)` exactly; `tidalState` and `composition` too — the plan gates 4 of its 6 declared derivations | **`zerofill`**: append `{massEarth:0, age:0, T_eq:0, surfaceHistory:{}}` ⇒ presence arm stays green (that is the point), **value arm must red**. **`nodensity`**: `massEarth = radiusEarth³` ⇒ value arm reds |
| **G4** `:397` `surfaceGravity ∈ [0,3] g` | **REPLACE** — cannot fail (max **0.539 g** under the declared formula, mine) and already fails today (planet-class max 3.13-3.26 g, against a shipped `< 5` at `moon-mass-radius-consistency.test.js:76`) | Two-sided, per-body: `\|g − radiusEarth × ρ_parent\| / g < 1e-9` on every plain moon, plus a distribution assertion `p95 < 0.30 && max < 1.0` on plain moons and the existing `< 5` retained for planet-class. **Plus** the ExoticOverlay consistency assertion nobody proposed: **after** `StarSystemGenerator.generate` returns, `\|massEarth / (radiusEarth³ · ρ_parent) − 1\| < 1e-9` on the 34-in-5018 swapped-parent moons | **`nodensity`** (above) ⇒ max jumps to 2.62, still inside [0,3] but the per-body arm reds. **`exotic`**: leave `massEarth` un-rescaled at `ExoticOverlay.js:325-337` ⇒ post-overlay arm reds on the 34, error up to 56.6× |
| **G5** `:398` Sol's Moon 0.165 ± 0.01 g | **REPLACE or DEFER — Max's call (Q1).** Unsatisfiable: `SolarSystemData.js` contains zero `massEarth` (mine), Sol's Moon is a literal at `:191-201`, `MoonGenerator` is never invoked for Sol (mine), and the declared formula gives 0.273 g (Sol-Earth is massless) — **9.8 tolerances off** | If Q1 = yes: give every Sol body a real `massEarth` in `SolarSystemData.js`, add that file to Step 8's Files, and the fixture becomes a genuine regression test. If Q1 = no: retire the gate to the `CRATER_VIS_FLOOR_RAD` follow-on at `:404` — **it is the same undeclared work** | Under Q1=yes: **`moonmass`**: revert the Moon's `massEarth` literal ⇒ fixture reds at 13.4176 |
| **G6** `:399` zero truthy atmosphere with undefined pressure | **REPAIR** — measures 0→0 forever; the only violating shape is the flat-passthrough branch at `conditionFromPlanet.js:380`, which 8a never writes, on a subject that is 0.09-0.14% of moons (**expected 0.46 in a 500-moon sample**) | Add a forced-population arm: pin `wd-1403` (already pinned at `body-identity-fence.test.js:108`) **plus** a synthetic `MoonGenerator` output shaped `{ retained: true, color }` with no `.physics`, asserted **caught**. Without the forced arm, delete the gate rather than ship decoration | **`flatatmo`**: change `MoonGenerator.js:194-196` to emit `{retained:true, color}` ⇒ forced arm reds |
| **G7** `:401` 8b delta table + "Instrument B's only allowed diff is planet-class moons" | **REPLACE** — the declared columns (`T_eq`, composition, `iceness`, `landPalette`, `lavaGlowColor`, `lavaCrustColor`) do not cover what moves, and 7 planets + 6-7 draw profiles move too | Delta table gains **geometry columns**: `radiusEarth`, `orbitRadiusEarth`, `orbitSpeed`, `inclination`, `startAngle` — expect ~22% of planet-class moons to move each. Instrument B split by channel and enumerated: **DRAW STREAM red on exactly the named seed set; BODY IDENTITY red on exactly {24 planet-class moons} ∪ {7 planets, each moving only on `systemContext`}; plain moons 0/803.** Plus the systemContext feedback path named in the message (`StarSystemGenerator.js:966-972`) | **`postmigration`**: substitute the wrapper's **post-**migration `orbitRadiusAU` (mutated at `StarSystemGenerator.js:655`) instead of the pre-migration one ⇒ the enumerated seed set must change |

---

## 6. ORDER OF OPERATIONS FOR 8a's BYTE-IDENTITY (C4)

Spelled out so the gate can fail.

1. **Record the baseline's provenance.** `git log -1 --format='%H %ad' -- tests/baseline/body-identity.json` → must be `b2ac455` (Step 0) or C1's commit, and must be **strictly older** than the commit you are about to make. Paste the sha into the commit message. If it is your own commit, stop — the gate is vacuous.
2. **Capture the before-state.** `npm run test:body-identity` → must be **8 passed**. Record the duration.
3. **Predict, in writing, before touching `src/`.** Run a read-only probe that counts plain vs planet-class moons over the fence's 221 seeds and write the three-channel prediction into the commit message draft: *DRAW STREAM green 221/221 · BODY IDENTITY red on exactly N plain, 0 planet-class, 0 planets · RECORD SHAPE red naming `massEarth, age, T_eq, composition, surfaceHistory, tidalState` on the plain shape only.* (Lane INSTRUMENTB measured N = 770 on the fence's 221 seeds; refuter 3 measured 803 over `wd-0…220`. Re-derive it yourself — the two lanes used different seed lists.)
4. **Write the change.** Hoist `MoonGenerator.js:165-204` to `const moon = { … };`, append with **plain assignment** (`moon.massEarth = …`), `return moon;`. ⛔ No `Object.defineProperty`. ⛔ No in-place write to `moon.baseColor`/`accentColor` — they are refs into the module-level `PALETTES` table (`:110`), 1598 aliased refs measured. ⛔ Any needed float comes from a **new** namespace prefix per `:257-263`, never from `rng`.
5. **Run.** `npm run test:body-identity`.
6. **Read the three channels against the prediction, in this order.**
   - DRAW STREAM red ⇒ **a draw leaked. Revert.** This is the only channel where red means wrong.
   - RECORD SHAPE **green** ⇒ **failure, not pass.** The fields were attached non-enumerably. Revert.
   - BODY IDENTITY red on a count ≠ N, or any planet, or any planet-class moon ⇒ the change was not additive. Revert.
7. **Verify no rebless leaked in.** `git diff --name-only` must contain **only** `src/generation/MoonGenerator.js`. `git log -1 --format=%H -- tests/baseline/body-identity.json` must be unchanged from step 1.
8. **Commit C4 with the failing test run in the message**, verdict-vs-prediction inline.
9. **Only then, C5:** `WD_REBLESS_BODY_IDENTITY=1 npm run test:body-identity`. `git diff --stat` must show exactly one file. Skim the diff: moon hash strings + a third entry in `moonShapes` + moved rollups, nothing else. Message names Step 8a and the N/0/0 split.

The gate can fail at steps 6 and 7 because the answer it is checked against was written at step 3 and recorded at `b2ac455`. Reversing steps 5 and 9 makes every one of those checks vacuous.

---

## 7. OPEN QUESTIONS FOR MAX

Two. Everything else I decided above.

**Q1 — Does Sol get real masses in Step 8, or does the Sol-Moon gate get retired to a follow-on?** `SolarSystemData.js` has zero `massEarth` on any of Sol's 39 bodies; every Sol moon's gravity today is 1/R² (the Moon 13.42 g, Phobos 346,021 g, **Deimos exactly 1,000,000 g**). Fixing it means hand-authoring masses for 39 bodies in a file Step 8 does not declare, and it changes Sol's rendering inputs — the one system that by your standing rule cannot validate procgen. **My recommendation: retire the gate from Step 8 and fold Sol's masses into the `CRATER_VIS_FLOOR_RAD` follow-on already filed at `PLAN.md:404` — it is literally the same undeclared work** (that constant was calibrated "on Sol's 39 bodies" whose gravity was fabricated as 1/R²). Doing both at once, once, with one delta table. This is yours because it changes what Step 8 means as a deliverable.

**Q2 — 8b changes the size and orbit of ~22% of planet-class moons, and those bodies render today.** Three harnesses agree: `radiusEarth`, `orbitRadiusEarth`, `orbitSpeed`, `inclination`, `startAngle` all move on 17/75 and 47/211 planet-class moons, plus `systemContext` on 7/8557 planets. Planet-class moons are ~3.1% of moons and already reach `Planet.js` (`src/main.js:7636`). So this is a visible world change to bodies you may have already flown past — a saved system's big moon can shift orbit and size. **My recommendation: ship it in Step 8 as C7, with the geometry delta table.** The current state (every planet-class moon generated as if at 1 AU) is the defect Step 8 exists to fix, and deferring it means Step 9's crater pack and Step 10's moon rendering both build on fabricated temperatures. But you may want it after Step 10 so the visible change lands once, with the new renderer, rather than twice.

---

## 8. WHAT IS STILL UNMEASURED

1. **N for C4's BODY IDENTITY prediction.** Lane INSTRUMENTB says 770 plain moons over the fence's 221 seeds; refuter 3 says 803 over `wd-0…220`. Different seed lists. **Nobody ran the real 8a append through real vitest** — every lane simulated `moonRecord`/`canon`/`hash` in a probe. Re-derive N in step 3 of §6, and expect the first real run to be the first time the actual test file sees the change.
2. **The per-*yield* draw profile under a splice.** Refuter 1 measured the per-seed draw **total**, which is only that array's last element. `StarSystemGenerator.js:593` `if (m > 0) yield;` folds moon 0 of every planet into the planet's chunk, so a splice in moon 0 may be invisible at a granularity nobody tested.
3. **The 8b delta table's non-`T_eq` columns.** Only `T_eq` was measured at 75/75 and 211/211. `iceness` (130/211), `landPalette` (115/211) and composition (132/211) come from one lane's single probe; `lavaGlowColor`/`lavaCrustColor` at 211/211 from the same probe. Not cross-checked.
4. **Whether the `_provenance` ≥500-moon gate is reachable after 8a.** The 691→0 target assumes all six derivations land on every plain moon. Nobody has run `conditionFromBody` on a post-8a record.
5. **`_generatePlanetMoon`'s own append point.** 8a declares the plain path only; whether the planet-class path has a draw-clean append point is unmeasured. Step 10 will need it.
6. **The exact `PlanetGenerator.generate` signature/plumbing cost for C3.** Three lanes independently confirmed the AU is not in scope, and all three simulated it by monkeypatching. Nobody wrote the real signature change.
7. **Whether `tests/moon-condition-contract.test.js` and `tests/moon-rng-stream-identity.test.js` can be written without importing the fence's private helpers.** Both files are new (`PLAN.md:392` names them); neither exists.
8. **The `[0,3] g` replacement's p95/max thresholds.** I measured p95 0.229 / max 0.539 on `wd-0…1499` under the declared formula. Those are simulation numbers from a formula nobody has implemented; the real 8a may pick a different density source (`planetData.composition.density` in kg/m³ is also in scope, and gives max 2.04 — a 3.8× different answer).
9. **Instrument C (`port-uniform-capture.json`) under 8a.** Only measured under 8b (65 bodies move). Whether the six appended keys move Instrument C's `identityRecord` is unmeasured — and `systemContext` is in it, which is how 8b's planets moved.
10. **The `_computeTidalHeating` seed collision** (`MoonGenerator.js:258`: two moons of the same parent with identical `orbitRadiusEarth` *and* `radiusEarth` get the same eccentricity draw). Flagged by one lane, never measured as a live collision. Any new namespace in 8a inherits the same key shape.
11. **Live/visual verification of anything.** No screenshots, no browser, no render check. Every number here is headless.