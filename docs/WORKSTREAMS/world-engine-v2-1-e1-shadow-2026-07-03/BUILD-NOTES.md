# BUILD NOTES — V2-1 "E1 regime selector (SHADOW mode)" · AC-0 conformance evidence

Provenance: authored by the Slice-D build agent 2026-07-03 against the SIGNED contract.json (AC-0, AC1–AC7)
+ BUILD-PLAN.md §3/§4 (adversarially reviewed) at HEAD after Slices A (`dd88f72`), B (`3a2af88`), C (`a23e918`).
This file is **AC-0's evidence** (contract AC-0 `verifyVia.input`: "Read the diff + BUILD notes conformance
table"). It reproduces the V2-0 BUILD-PLAN §4 worked-example discipline: every scalar E1 **reads** × its
D-slot/named backing, and every tuple field E1 **emits** × its named consumer.

**Line of sight (feature → outcome):** the E1 regime selector is the *condition-first* spine the whole
World-Engine history program is being rebuilt onto — a body's geodynamics should fall out of its DRIVERS
(temperature, volatiles, mass, tidal heat, age), not a hand-assigned archetype string. V2-1 stands E1 up in
**SHADOW**: it computes the full tuple and proves it tracks today's shipped routing (AC3: 13/15 writer-equal),
with **zero** influence on what renders, so V2-2 (router) and V2-3 (dispatch) can adopt it increment-by-increment
without a single-step rewrite. Slice D is the lab read-surface + live probe that lets Max/working-Claude *watch*
the shadow tuple per preset (AC7) before any of it goes live.

---

## 0. Slice D — record-build-intent (plain language)

**What it does.** Wires the (already-built, Slice B) pure `computeE1` into the lab as a **data-only shadow
read**: on every route it computes the body's E1 tuple from the SAME condition vector + macroSeed and stashes
it on `state._lastE1`. Adds `_lab.e1Probe()` (returns the full tuple for the current body — the AC7 live probe,
sibling of `magmaProbe`/`stagnantLidProbe`) and a **console-only** seeded-weight override
(`_lab.e1RegimeWeights` / `_lab.e1RegimeWeightsReset`, mirroring `_driverAbMode`) so AC5's weight-nudge behavior
can be exercised live. Adds the AC2/AC-0 **grep-audit test** (`tests/worldengine-e1-shadow-audit.test.js`).

**Why (intent).** Give the increment a *live read surface* + a *mechanical shadow-discipline gate* without
touching a rendered byte, so AC7 is observable and the emit-only contract is enforced by CI, not by trust.

**Deliberate non-goals (what Slice D does NOT do).** No routing change — `state._lastE1` is NEVER passed into
`route()`; `archetype:` stays `PRESET_ARCHETYPE[_preset]`. No GUI panel for the override (console/`_lab` only ⇒
no `planet-archetypes.js` taxonomy registration ⇒ drift guards untouched — AC-0 check 3). No `localYield` /
`lidResponse` / V2-2 router code. No dispatch/predicate edits. No golden re-capture. No live browser work
(AC7 is working-Claude's, after this lands).

---

## 1. AC-0 Table A — driver connectivity (every scalar `computeE1` reads × its D-slot / named backing)

Verified by reading `src/worldengine/base/e1Regime.js` as landed (Slice B) and `body-condition-vector.js`
(Slices A+B). **No archetype-string input** (AC-0 check 1 — grep-enforced by the Slice-D audit test).

| `computeE1` reads (condition vector `cv.*` / seed) | vector field (`body-condition-vector.js`) | D-slot / named backing | used for (`e1Regime.js`) |
|---|---|---|---|
| `cv.T_eq` (SURFACE temp) | `:30` (AC6 plumbing, raw-preset read) | D3-MF2 | `lidStrength` `z`/`anneal`/`meltFactor`; seeded-band gate; `effectiveL` |
| `cv.composition.volatileFraction` (`V`) | `composition` `:25` (D2 passthrough) | **D2** | `lidStrength` `dryness`/`muProxy`; `V` emit; pick weights; `effectiveL` wetness |
| `cv.density` (ρ) | `:24` (`composition.density`) | D2 / composition | `compositionClass` icy/rocky smoothstep; `lidStrength` `gMod` |
| `cv.composition.carbonToOxygen` | `composition` `:25` (D10) | **D10** | `compositionClass` carbon terminal |
| `cv.atmosphere.composition` (`'h2-he'`) | `:36` (Slice B addendum passthrough) | atmosphere passthrough | `compositionClass` gas terminal (fires first) |
| `cv.age` | `:26` (D16 fallback 4.5) | **D16** | `convectiveVigor` radiogenic; `lidStrength` `ageNorm` |
| `cv.radiusEarth` (`d`) | `:27` (drawn value; fp fallback) | radius (drawn, R5) | Φ `d³` mantle-depth (SH-F2 `d`); `massEarth` reconstruction |
| `cv.surfaceGravity` (g) | `:31` (AC6 plumbing, baseStep-exposed) | **D14** | `lidStrength` `gMod`; `massEarth` reconstruction |
| `massEarth` = `surfaceGravity·radiusEarth²` | **NAMED DERIVATION** — NOT a vector field | D14 + radius (g=M/R² exact, `baseStep.js:20`) | Φ vigor (`C_MASS·massEarth`); seeded-band mass gate. **Never `fp.massEarth`.** |
| `cv.rawTidalIoRatio` | `:37` (D12 RAW, pre-`calibrateTidal`) | **D12 raw** | `m_hp` peg; Φ tidal term; edge gates (`ACTIVE_TIDAL`/`SHOULDER_LO`) |
| `macroSeed` | lab `state.macroSeed` (→ `computeE1` arg 2) | seed → `alea('e1:regime:'+macroSeed)` | seeded-band pick + `positionWithinRegime` + `e1Seed` |
| *(NOT read: `cv.shellThickness` `:38` — SH-F2, `z`/`d` own transforms; `cv.eccentricity` `:28`; `cv.magneticField` `:39` / `cv.metallicity` `:40` — data-only)* | — | — | — |

## 2. AC-0 Table B — named consumer (every emitted tuple member × its reader)

Tuple keys verified against `computeE1`'s return (`e1Regime.js:217-230`) and the Slice-B test `TUPLE_KEYS`.

| `computeE1` emits | set by (driver → derivation) | named consumer |
|---|---|---|
| `compositionClass` | density/D9/D10/atmosphere → Stage-A terminals (§4.4) | **AC3 oracle + AC7 probe now**; V2-3 dispatch 2-tuple |
| `geodynamicRegime` | edges (heat-pipe/icy/dead-lid/stagnant) + seeded middle (`'e1:regime:'`) | **AC3 oracle + AC7 probe now**; V2-2 router, V2-3 dispatch |
| `label` | emergent `cls + '/' + geodynamicRegime` (derived LAST) | **diagnostic / probe ONLY** — no branch reads it (grep-enforced, §5) |
| `L` (+ `effectiveL`) | gate-1 pinned form `K_L·(W_Z·z+W_MU·muProxy)·gMod` | V2-2 router + `localYield(L,i)` |
| `Φ` | delegable #4: `sqrt(radiogenic·(C_MASS·m+C_SIZE·d³)) + C_TIDAL·rawTidal` | V2-2 pierce boolean + `n` |
| `V` | D2 passthrough | V2-2 stagnant response; pick weights |
| `n` | gate-2 `clamp(3,11,round(4+4·min(Φ,1.2)+2·(1−L)))` | V2-2 SP-CENTERS count |
| `m_hp` | `rawTidalIoRatio − HEATPIPE_PEG(0.45)` (delegable #6, exported tunable) | V2-2 heat-pipe hard gate |
| `e1Seed`, `positionWithinRegime` | macroSeed draw + band position (`'e1:regime:'` stream) | V2-2 within-region continua |

## 3. AC-0 Table C — taxonomy registration

Slice D exposes the seeded-weight override as a **console/`_lab` API only** (`e1RegimeWeights` /
`e1RegimeWeightsReset` on the `window._lab` object) with **no dat.GUI binding** ⇒ no `.add(state,'…Enabled')`
key ⇒ `tests/planet-archetypes.test.js` drift guards stay green with **no taxonomy change**. No new
preset / feature / province is introduced. *(If a GUI toggle is ever added it MUST register in
`planet-archetypes.js` — flagged in the code comment at the override site, not built.)*

---

## 4. Slice D wiring ledger (exactly what changed in `planet-lod-lab.html`)

| # | Site | Change | Shadow-safety |
|---|---|---|---|
| 1 | import block (after the `deriveConditionVector` import) | `import { computeE1 } from './src/worldengine/base/e1Regime.js';` | pure fn; no side effects |
| 2 | module scope, beside `_driverAbMode` | `let _e1WeightOverride = null;` — lab-only seeded-weight override (null ⇒ frozen) | console-set only; inert until an in-band body is drawn |
| 3 | `ensureNetworkRouted`, right after `state._lastBodyDrivers = _bodyDrivers;` | `state._lastE1 = computeE1(_bodyDrivers.condition, state.macroSeed, _e1WeightOverride ? { weights: _e1WeightOverride } : {});` | **NOT threaded into `route()`** — the route args (`archetype:` etc.) are byte-unchanged; audit test asserts the route arg block references no `_lastE1`/`computeE1`/`e1` |
| 4 | `_lab` object, sibling of `stagnantLidProbe` | `e1Probe()` — returns `state._lastE1`, or recomputes arm's-length from `state._lastBodyDrivers.condition` + `state.macroSeed` if a route hasn't landed | read-only; returns the tuple; never touches the render |
| 5 | `_lab` object | `e1RegimeWeights(w)` / `e1RegimeWeightsReset()` — set/clear `_e1WeightOverride`, then re-route so `_lastE1` refreshes (pattern copied from `_lab.setVolcanicThermal`) | override changes ONLY the E1 tuple (seeded-band pick); render is untouched (shadow) |
| 6 | NEW `tests/worldengine-e1-shadow-audit.test.js` | 20 grep-audit tests (AC2 label-invariant cross-file + AC-0 check 1 + no-writer-import) | test-only |

---

## 5. Grep-audit results (AC2 / AC-0 mechanical evidence — `tests/worldengine-e1-shadow-audit.test.js`, 20/20 green)

- **computeE1 imported by NO writer/dispatch (AC1/AC7 shadow):** over every `src/worldengine/base/*.js`
  except `e1Regime.js` **and** `planet-lod-rivers.js` (the dispatch seam), zero files reference `computeE1` or
  import `e1Regime`. Confirmed by `grep -rln 'computeE1\|e1Regime' src/ planet-lod-rivers.js` → only
  `src/worldengine/base/e1Regime.js`.
- **No archetype input to `computeE1` (AC-0 check 1):** both lab call sites pass a `.condition` vector as the
  first argument (`_bodyDrivers.condition`, `bd.condition`); neither passes a preset name / `PRESET_ARCHETYPE`.
- **E1 not routed (AC1):** the `riverOverlay.route({…})` argument block contains no `_lastE1` / `computeE1` /
  `e1` reference — `state._lastE1` is set BEFORE the call and never read inside it.
- **`e1.label` is OUTPUT-only (AC2, cross-file):** the lab reads no `.label` off any e1 handle
  (`_lastE1.label`, `e1Probe().label`, `computeE1(…).label` all absent); the AC3 oracle classifies on
  `geodynamicRegime`/`compositionClass`, never on `label`. (Slice B's regime test already proves the module
  itself never reads its own `label` — `e1Regime.js` derives it LAST.)

## 6. Gate results (Slice D)

| Gate | Command | Result |
|---|---|---|
| Slice-D audit | `npx vitest run tests/worldengine-e1-shadow-audit.test.js` | **20/20 pass** |
| Byte-identity (AC1) | `npx vitest run tests/v2-0-byte-identity.test.js` | **75/75 hashes unchanged** (never re-captured) |
| Drift guards (AC-0 check 3) | `npx vitest run tests/planet-archetypes.test.js` | **green** (no taxonomy change) |
| Full suite (no new failures) | `npx vitest run` | **4 failed / 1660 passed** — the 4 are the pre-existing known failures (KnownObjects ×3, GalacticFeatures ×1); passed grew by exactly the 20 new audit tests. 15 `vendor/motion-test-kit/*` files fail to *load* (pre-existing infra) — unchanged. |
| Lab parse | `node --check` on the extracted `<script type="module">` | **parse OK** (edits didn't break the `_lab` object literal) |
| AC7 (live) | chrome-devtools `:5173` `/well-dipper/`, ≥6 presets | **DEFERRED to working-Claude** (per task: no live browser work in this slice) |

**Deviation from plan:** none material. The plan permitted the AC2/AC-0 audits "as a test OR documented
one-liners"; chose a **test** (`tests/worldengine-e1-shadow-audit.test.js`) for durable enforcement, matching
the repo's grep-in-test idiom (Slice B's regime test does the same for the module internals). One
implementation note: the audit strips `//` line-comments before extracting `computeE1(` call sites, because a
prose `computeE1(...,{weights})` mention in a code comment would otherwise be mistaken for a call site.
