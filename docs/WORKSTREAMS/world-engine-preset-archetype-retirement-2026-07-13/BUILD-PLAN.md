# PRESET_ARCHETYPE Retirement — Sliced BUILD-PLAN

Branch `feature/world-engine-production-L1` @ `a892f28`. Contract:
`contract.json` (GREENLIT 2026-07-13). Intent: `intent.md`.

**Baseline, empirically confirmed at HEAD (this session, full `npx vitest run` from the repo dir):**
`Test Files 17 failed | 119 passed (136)`, `Tests 4 failed | 1976 passed (1980)`. The 4 failing
CASES are KnownObjects ×3 + GalacticFeatures ×1; the 17 failing FILES are those 2 case-bearing
files + 15 `vendor/motion-test-kit/tests/*.test.js` collection failures. Guardrail quartet green;
`worldengine-v2-3-dispatch-oracle.test.js` runs **25** tests green (NOT the stale "24" in the
standing gate — the appliedTune probe-parity follow-up was permanently added at the V2-3 verify,
9322645; see §4). **All routing/byte claims below are read off the live code at `a892f28`, symbols
grepped not line-numbered.**

## §0 — Feature → outcome line of sight (lead orientation)

This closes the condition-first flip's **last debt**: V2-3 made production/lab dispatch derive from
`computeE1`'s `{compositionClass, geodynamicRegime}` for every condition-bearing caller, but left the
old archetype chain in the tree as an enumerated **migration bridge** ("delete only after post-V2-3
verify + Max UAT"). Both halves of that trigger completed 2026-07-13. Deleting the bridge means **no
future increment (V2-4 substrate … V2-10 game-port) has to keep a second, legacy dispatch byte-safe.**
Serves the JOURNEY world-engine objective ("condition combinations produce predicted-but-never-observed
landforms"); PLAYER_EXPERIENCE-wise still lab-only by charter (the screensaver sees this at V2-10).
This is a **refactor carve-out — ZERO behavioral change; the diff + byte gates are the acceptance**
(contract statusNote). There is no new expression, no lab-GUI change, no game-port wiring.

## §1 — The seam being deleted (located by symbol, `planet-lod-rivers.js`)

One mechanism, deleted together (contract designDecision #1). All four predicates are **exported** and
consumed by the four oracle test suites; the bridge itself uses the underlying resolvers, not all four
predicates (`isShellReliefPath`/`isStagnantLidPath` exist only for the oracle composition):

| Symbol | Role today | Dies because |
|---|---|---|
| `writeBodyRelief`'s `else` **migration bridge** (the block AFTER the `if (bodyDrivers?.condition)` return, ~the `const locked = argLocked; if (isEarthlikePlatePath…) … writeGrainSphere/writeHeightSphere despun`) | Routes the ~8 condition-LESS test callers via the archetype chain | Every production/lab path is condition-bearing → takes derived dispatch; the bridge's only users are legacy tests, migrated in Slice A |
| `isEarthlikePlatePath` (export) | bridge plate gate + oracle composition | dispatch no longer keys on archetype |
| `isShellReliefPath` (export) | oracle composition ONLY (bridge uses `shellRegimeOf` directly) | same |
| `isVolcanicPath` (export) + `const VOLCANIC_ARCHETYPES = new Set(['lava','volcanic'])` | bridge volcanic gate + oracle composition | same |
| `isStagnantLidPath` (export) | oracle composition ONLY (bridge uses `stagnantLidRegimeOf` directly) | same |
| the **bridge-tune gate** `const shellTune = bodyDrivers?.condition ? shellDriversToTune(bodyDrivers, regime) : null;` (inside the bridge's `if (regime)` shell branch) | Nulls the shell tune for the condition-less bridge (V2-5s) | The bridge that hosts it dies; on the surviving derived `shell()` helper the tune is computed unconditionally (`shellDriversToTune(bodyDrivers, regime)`) — the gate has no home |
| the `archetype = null` **destructure param** of `writeBodyRelief` | read only by the bridge | dead after the bridge dies (AC1: "routing region no longer reads an `archetype` parameter"). `locked: argLocked` STAYS (the derived path uses it as the `cond.tidalState?.locked ?? argLocked` fallback). |

**Separately (`src/worldengine/base/lidResponse.js`, AC4):** the pure-strong branch's degenerate ternary
`const regime = e1.geodynamicRegime === 'stagnant' ? STRONG_REGIME : STRONG_REGIME;` folds to
`const regime = STRONG_REGIME;`, comment de-staled. Byte-inert by construction (both arms identical).
`STRONG_REGIME` (`= 'venus-stagnant-lid'`) and every other symbol in that file are untouched.

**Survives, untouched (fences, intent non-goals):** the `PRESET_ARCHETYPE` map + radius plumbing
(`drawPresetRadius`, R-GARBLE adjudication — radius selection is its surviving job); `shellRegimeOf` /
`stagnantLidRegimeOf` stay EXPORTED from their writer modules (test oracles may keep using them — only
their production-dispatch consumption in `planet-lod-rivers.js` dies); the entire condition-bearing
derived block (`if (bodyDrivers?.condition) { … }`) and its helpers (`plate/shell/despun/unbrokenLid/
stagnantLidDirect`); V2-5s shell tune threading at the derived `shell()` helper.

## §2 — Slicing (default 2-slice shape; rationale for the A/B split)

The split is chosen so **both slices are green** and the bridge is *dead code* before it is deleted:

- **Slice A — TEST-SIDE MIGRATION (bridge still present, so green on both paths).** Migrate every
  condition-LESS `writeBodyRelief` caller that CAN migrate to a condition-bearing bundle (→ derived
  path, byte-identical); re-anchor the four predicate-importing oracle suites' `writer_today`
  compositions off the deleted predicates; retire/repurpose the caller tests whose SUBJECT *is* the
  bridge and cannot become condition-bearing (enumerated §3). At the end of Slice A: the bridge, the
  four predicates, `VOLCANIC_ARCHETYPES`, and the bridge-tune gate are **referenced by nothing** (no
  test imports a predicate; no test hits the bridge). Full suite green, still exactly at baseline.
  Commit seam: `refactor(world-engine): Slice A — migrate ~8 condition-less writeBodyRelief callers to condition-bearing bundles + re-anchor 4 oracle suites off the legacy predicates (bridge now dead code, byte-inert)`.

- **Slice B — PRODUCTION DELETION + THROW + TERNARY (atomic).** Delete the bridge + the four
  predicates + `VOLCANIC_ARCHETYPES` + the bridge-tune gate + the `archetype` destructure param from
  `planet-lod-rivers.js`; make condition-less input THROW (§5) in the `else` of the surviving
  `if (bodyDrivers?.condition)` guard; add the throw test (new dedicated file); fold the `lidResponse.js`
  degenerate ternary + de-stale its comment; de-stale the `writeBodyRelief` header comment that
  describes the now-deleted bridge. Full suite green, exactly at baseline (+1 passing test file for the
  throw test). Commit seam: `refactor(world-engine): Slice B — delete PRESET_ARCHETYPE migration bridge + 4 label predicates + VOLCANIC_ARCHETYPES + bridge-tune gate; condition-less input throws; fold lidResponse degenerate ternary`.

**Why the bridge-subject retirements go in Slice A, not B:** they are test-only edits. Doing them in
Slice A makes the bridge fully dead before Slice B, so Slice B is a clean production-only deletion
whose sole test change is the NEW throw test. (Mirrors how the V2-3 plan co-located test repurposings
with the change that obsoletes them, but inverted here because the *bridge still runs* in Slice A —
the retirements can't wait for B or the un-migratable tests would keep exercising a bridge we intend to
prove dead.) No deviation from the task's default shape is required.

## §3 — Per-call-site migration table

**The byte-fidelity lemma (applies to every MIGRATE row below).** Each derived helper calls the SAME
writer as the bridge did, and the writers **void their `drivers` arg** except through `tune`:
- `plate()` → `writePlateUpliftSphere(carrier, bodyDrivers, {macroSeed, tune: driversToTune(bodyDrivers)})`; output depends only on `{carrier, macroSeed, tune}` (proven by plate-driver AC2: `writePlateUpliftSphere(c, {}, {macroSeed})` === `writePlateUpliftSphere(c, D_EARTH, {tune: driversToTune(D_EARTH)})`). `driversToTune(neutral) === null` → DEFAULTS.
- `shell(regime)` → `writeShellReliefSphere(carrier, bodyDrivers, {macroSeed, regime, tune: shellDriversToTune(bodyDrivers, regime)})`; `writeShellReliefSphere` runs `void drivers;`. `shellDriversToTune(SHELL_REFS[regime], regime) === null` — and the shipped icy presets' neutral bundles ARE the REFs (shell-multiply.test.js call-site-1 asserts `appliedTune === null at the shipped REF`).
- `unbrokenLid()` → router pure-weak `writeMagmatismSphere(carrier, drivers, {macroSeed, locked, T_ss, tune: magmaDriversToTune(drivers)})` / pure-strong `writeStagnantLidReliefSphere(carrier, drivers, {macroSeed, regime, tune})`; both writers void `drivers`; `magmaDriversToTune(MAGMA_REF) === null`.
- `despun()` → `writeGrainSphere(carrier, grainDrivers)` + `writeHeightSphere(carrier, {}, grainDrivers, {name:'tectonic-build'}, heightSeed)`; **does not read `bodyDrivers` at all.**

So: **a migrated bundle whose `bodyDrivers` sits at the route's REF (tune === null) reaches the same
writer with the same effective args → byte-identical.** The migration idiom is the shipped
`bundle17`/`buildBundle` pattern: `bodyDrivers = { ...buildNeutralBodyDrivers(deriveUniforms(fp, tier), fp),
condition: deriveConditionVector(fp, u, fp.radiusEarth) }` for a representative preset `fp`, keeping the
suite's OWN mesh (`carrierOf()`) and the test's OWN `macroSeed`/`heightSeed`/`T_eq`. **No shared fixture
file** (the strict rule "tests/fixtures/* absent from every diff" forbids adding one there): each
migrated suite gets a small LOCAL `condBundle(routeKey, opts)` adapter + the three idiom imports
(`deriveUniforms` from `planet-lod-lab-core.js`, `buildNeutralBodyDrivers` from `body-drivers.js`,
`deriveConditionVector` from `body-condition-vector.js`), plus `DRIVER_PRESETS` from `driver-presets.js`.
Representative presets per route (REF-anchored, tune-null, seed-invariant): **plate → `Rocky (Earthlike)`
/ `Ocean (temperate)`; shell(icy-active) → `Europa (icy moon)`; despun → `Gas giant (Jovian)` (or `Mars
(arid rocky)`); volcanic → `Lava (hot airless)`.**

### 3.1 MIGRATE rows (condition-bearing; same writer, same args; byte-identical)

| # | File → describe/it | Today (bridge) | Migrated bundle (route preset) | Derived route | Proof sketch |
|---|---|---|---|---|---|
| M1 | `plate-driver-response` › `AC5 › despun path (impact-airless) byte-identical whether or not bodyDrivers` (the `cA`/`cB` pair) | `impact-airless` unlocked → despun; `cB` adds `bodyDrivers:D_OFF` | route → `Gas giant (Jovian)` (or Mars) condition; `cA` no extra bodyDrivers, `cB` merges `D_OFF` keys onto the condition-bearing bodyDrivers | despun | `despun()` never reads `bodyDrivers` → `cA`===`cB` exactly. Meaning preserved (bodyDrivers inert on despun, forever). |
| M2 | `plate-regime-gate` › `icy archetype (ice) => SHELL path` | `ice` unlocked → `shell('icy-active')` | `Europa` condition | `shell('icy-active')` | Europa → cls `icy`, geodyn `icy`, `shellSubRegime 'icy-active'`; `shellDriversToTune(Europa-neutral,'icy-active')===null`. Test only asserts path `shell`, `regime 'icy-active'`, height ≠ despun-ref — all hold. |
| M3 | `plate-regime-gate` › `terrestrial => plate writer runs, differs from despun` | `terrestrial` unlocked → plate | `Rocky (Earthlike)` condition | plate | Rocky → plate, `driversToTune(neutral)===null`. Asserts path `plate`, `plateCount≥7`, height ≠ despun-ref — all hold. |
| M4 | `planet-lod-rivers-discharge-param` › `buildBody()` (feeds every AC4 it) | `terrestrial` → plate | `Rocky` condition | plate | The suite tests `routeAndOrder` discharge, not the relief writer; it needs any populated `carrier.height` and only compares `base` vs `uniform1` built from the SAME `buildBody`. Byte-identity is self-referential → preserved trivially. |
| M5 | `magmatism-structure` › `AC7 › terrestrial/ocean => plate, byte-identical to plateReference` (2 its) | `terrestrial`/`ocean` → plate | `Rocky`/`Ocean` condition | plate | `plateReference` = `writePlateUpliftSphere(c, DEFAULT_GRAIN_DRIVERS, {macroSeed})` (tune-less). Migrated `plate()` tune `= driversToTune(neutral) = null` → DEFAULTS → byte-identical (drivers-arg voided). `magmaDiag===null` on plate. |
| M6 | `magmatism-structure` › `AC8 › Europa (ice) locked => shell, byte-identical` | `ice` locked → `shell('icy-active')` | `Europa` condition | `shell('icy-active')` | shell REF tune null → matches the suite's shell baseline at `regime 'icy-active'`. `magmaDiag===null`. |
| M7 | `magmatism-structure` › `AC8 › impact-airless / gas-giant => despun, byte-identical to despunReference` (2 its) | → despun | `Gas giant` / `Mars` condition | despun | `despunReference` = `writeGrainSphere(DEFAULT)+writeHeightSphere(…,heightSeed)`; `despun()` runs the identical two calls with the same `grainDrivers`/`heightSeed` → byte-identical. `magmaDiag===null`. |
| M8 | `magmatism-structure` › `AC9 › 'lava'/'volcanic' route to path:volcanic` + `AC9 T_ss basin` (routeBody) | `lava`/`volcanic` (± locked, T_eq) → volcanic (magmatism) | `Lava` condition, `locked` from `cond.tidalState.locked`, test's `T_eq` threaded | volcanic via `unbrokenLid()` → router pure-weak | Lava → cls `rocky`, `m_hp>0` → (3a) `unbrokenLid()` → pure-weak `writeMagmatismSphere(bodyDrivers, {macroSeed, locked, T_ss, tune})`. `T_ss = locked?(T_eq)*1.4:0` uses the `T_eq` PARAM (independent of cond) → identical basin math (Lava ~0.42 rad @ T_ss 1330, Magma ~1.52 @ 2800). `magmaDriversToTune(Lava-neutral)===null` → field byte-identical to #4a. |
| M9 | `magmatism-multiply` › `AC5 › off-volcanic magmaDiag null (bodyDrivers non-null)` | `terrestrial`/`ocean`/`gas-giant` + `bodyDrivers:MAGMA_DRIVERS` | route condition + merge `MAGMA_DRIVERS` onto the condition-bearing bodyDrivers | plate / despun | Off the volcanic path `magmaDiag===null` regardless of `bodyDrivers` (plate sets `plateDiag`, despun sets none). Non-vacuous still: a non-null bodyDrivers present, magmaDiag null. |
| M10 | `magmatism-multiply` › `AC5 › volcanic bodyDrivers=null byte-identical to #4a` | `lava` locked `bodyDrivers:null T_eq:950` → volcanic | `Lava` condition, `bodyDrivers` at MAGMA_REF (tune null), `T_eq:950` | volcanic via `unbrokenLid()` | `via.magmaDiag.appliedTune===null`; `writeMagmatismSphere(bodyDrivers, {…,T_ss:1330,tune:null})` === the baseline `writeMagmatismSphere({}, {…,T_ss:1330})` (drivers voided) → `cVia.height`===`cBase.height`. |
| M11 | `magmatism-multiply` › `AC5 › volcanic real drivers => non-null tune` | `lava` locked `bodyDrivers:MAGMA_DRIVERS T_eq:2000` | `Lava` condition + `MAGMA_DRIVERS` merged (off-REF) | volcanic | route volcanic; `magmaDriversToTune(MAGMA_DRIVERS)` non-null → `appliedTune` non-null. Holds (the router pure-weak computes the tune from `drivers`). |
| M12 | `stagnantlid-structure` › `AC6 no-clobber` (terrestrial→plate, ice→shell, lava→volcanic, gas-giant→despun; `stagnantDiag null`) | 4 relief() calls | `Rocky`/`Europa`/`Lava`/`Gas` conditions | plate / shell / volcanic / despun | Each REF-anchored → byte-identical per the lemma. `stagnantDiag===null` on all four (only the pure-strong `unbrokenLid`/`stagnantLidDirect` sets it; none of these routes there). |
| M13 | `stagnantlid-structure` › `AC6 › carrier.regime stays {0,1,2}` (`archetype:'stagnant-lid'`) | `stagnant-lid` → stagnant-lid (bridge `stagnantLidRegimeOf`) | `Venus (sulfuric shroud)` condition | stagnant-lid via `unbrokenLid()` → pure-strong | Venus → (3c) `isUnbrokenLidPath` → pure-strong → `writeStagnantLidReliefSphere` (regime `venus-stagnant-lid` === `STRONG_REGIME`). `stagnantDriversToTune(Venus-neutral)===null`. Asserts only `carrier.regime ∈ {0,1,2}` → holds (no 4th constant). |
| M14 | `shell-regime-gate` › `AC7 terrestrial/ocean => plate` (2 its) | → plate | `Rocky`/`Ocean` | plate | as M5 (byte-identical to the suite's plate baseline; `shellDiag null`). |
| M15 | `shell-regime-gate` › `AC8 › impact-airless => despun byte-identical` | → despun | `Gas`/`Mars` | despun | as M7. |
| M16 | `shell-regime-gate` › `AC8 › LOCKED lava world => VOLCANIC` | `lava` locked → volcanic | `Lava` (locked) | volcanic via `unbrokenLid()` | as M8; asserts path `volcanic`. |
| M17 | `shell-regime-gate` › `AC9 › ice/eyeball/volatile route to right regime tag` | 3 relief() with short keys | `Europa`(icy-active)/`Eyeball`(eyeball-despun via 3b locked)/`Titan`(volatile-cold) | shell w/ each sub-regime | Europa→`icy-active`; Titan→`volatile-cold` (cls icy, methaneVolatile); Eyeball (locked temperate rocky) → (3b) `shell('eyeball-despun')`. Asserts the normalized regime tag per body — matches. |

### 3.2 REPURPOSE / RETIRE rows (bridge-subject dies; cannot become condition-bearing with the same assertion — each enumerated)

| # | File → describe/it | Disposition | Rationale (why migration cannot preserve the assertion) |
|---|---|---|---|
| R1 | `plate-driver-response` › `AC5 › shell path (icy-active) byte-identical whether or not bodyDrivers` (the `ice` + `D_OFF` pair, `cB` passes `bodyDrivers:D_OFF`) | **RETIRE** (delete the one `it`) | `D_OFF = {massGravity:2.5, volatileFraction:0.5, tidalHeating:0.8, age:1.0}` — its `massGravity`/`volatileFraction`/`tidalHeating` are EXACTLY the fields `shellDriversToTune` reads. On the derived `shell()` helper (tune computed unconditionally), a condition-bearing `D_OFF` yields a NON-null tune → shell bytes change → the assertion fails. The test's premise ("bodyDrivers inert on the shell path") is a *bridge-gate* artifact that V2-5s deliberately overturned (shell is now driver-responsive by design). Coverage of "shell path byte-safe at the REF regardless of the driver bundle" is owned by `shell-multiply.test.js` call-site-1 (`appliedTune null at REF`). Retire, don't fake it by making both sides REF-identical (that tests nothing). |
| R2 | `plate-regime-gate` › `tidally-locked terrestrial => despun byte-identical (locked beats archetype)` | **RETIRE** | A synthetic `'terrestrial' + locked` input. Bridge: `'terrestrial' ∈ SHELL_EXCLUDE` → `shellRegimeOf` returns null even when locked → falls through to despun. DERIVED: a locked temperate rocky routes to `shell('eyeball-despun')` via rule (3b) — the **Eyeball adjudication** (today-wins locked-awareness). No real preset is a locked `'terrestrial'`; the locked-temperate-rocky route is Eyeball (archetype null), pinned in the dispatch-oracle. There is no condition-bearing bundle that reproduces the bridge's synthetic `'terrestrial'+locked→despun`; that despun-for-locked-rocky behavior was a bridge artifact the flip replaced. |
| R3 | `plate-regime-gate` › `isEarthlikePlatePath: terrestrial/ocean => plate; …` (pure predicate-truth-table `it`) | **RETIRE** | Asserts the deleted predicate's return values. No subject post-deletion. |
| R4 | `plate-regime-gate` › `the gate lives at the route()/lab boundary, NOT inside the three-free base layer` | **REPURPOSE** | Drop the `expect(typeof isEarthlikePlatePath).toBe('function')` line (deleted symbol). KEEP the still-valid base-layer purity grep (`plates.js`/`tectonic.js` contain no `archetype`/`terrestrial`/`isEarthlikePlatePath`) — that invariant is stronger than ever after the seam is gone. |
| R5 | `magmatism-structure` › `AC8 › isVolcanicPath is FALSE for every non-volcanic archetype` (+ the `isEarthlikePlatePath`/`isShellReliefPath` sanity lines) | **RETIRE** | Pure deleted-predicate truth-table. The routing it guarded is now covered by the dispatch-oracle (17-preset derived routes) + M8 (lava→volcanic). |
| R6 | `magmatism-structure` › `AC9 › 'lava' routes volcanic` — the embedded `isVolcanicPath('lava', L)` assertion | **REPURPOSE** (trim) | Keep the `relief`-migrated route assertion (M8); delete only the `isVolcanicPath('lava',L)` line. |
| R7 | `stagnantlid-structure` › `AC7 › isStagnantLidPath fires only on the key; the other predicates never match it` (+ the `stagnantLidRegimeOf` key-based `it` if it references predicates) | **REPURPOSE** | `stagnantLidRegimeOf` SURVIVES (intent non-goal: test oracles may keep using it) — keep the `stagnantLidRegimeOf: key-based, NOT locked-gated` `it` unchanged. RETIRE only the `isStagnantLidPath`/other-predicate truth-table `it`. |
| R8 | `shell-regime-gate` › `AC9 › isShellReliefPath predicate agrees with the dispatch (and earthlike never matches)` | **REPURPOSE** | The `isShellReliefPath`/`isEarthlikePlatePath` lines die. `shell-regime-gate › AC9 › Europa fall-through: archetype=null + locked => shell eyeball-despun` uses `shellRegimeOf` — KEEP (surviving resolver). Fold the surviving-resolver checks (`shellRegimeOf('ice',false)==='icy-active'`, `shellRegimeOf(null,true)==='eyeball-despun'`, `shellRegimeOf('gas-giant',true)===null`) into that `it` as the re-anchored reference. |
| R9 | `shell-multiply` › `AC-ZERO-CLOBBER (dispatch) › call site 2 (migration bridge, bodyDrivers null): ice/volatile/eyeball archetypes route shell…` | **RETIRE** (the ONE `it`) | This is the contract's named "bridge-byte-safety AC whose subject dies with the bridge" (task 2d). It calls `writeBodyRelief({archetype, bodyDrivers:null})` (condition-less) → post-retirement it THROWS. Its two sibling `it`s — **call site 1 (condition-bearing derived shell) + call site 1 NON-VACUOUS (driven)** — are condition-BEARING and stay green UNCHANGED, and already fully cover the surviving shell path's tune-inert + driven byte-safety. The bridge call-site's coverage is redundant once the bridge is gone. |

**Enumeration completeness for AC2:** every `writeBodyRelief(` occurrence in `tests/` is accounted for
above (MIGRATE M1–M17, RETIRE R1/R2/R9) OR is already condition-bearing and untouched
(`fixtures/v2-0-carrier-golden.mjs` buildBundle, `worldengine-base-condition-vector.test.js` AC4 spy,
`worldengine-v2-3-dispatch-oracle.test.js` bundle17, `worldengine-v2-3-taxonomy.test.js` derivedPath,
`shell-multiply` call-site-1) OR is a grep-on-source, not a call (`relief-router-repoint.test.js`).
After Slice A the ONLY condition-less caller is created in Slice B: the throw test (§5).

## §4 — Per-suite re-anchoring (the four predicate-importing oracle suites)

All four compose the legacy chain via a local `classifyWriterPath(archetype, locked)` built from the four
exported predicates. **Pick per suite (contract designDecision #4b: pinned expected-route table VS
frozen test-local reference copy):**

| Suite | Composes today | Replacement | PICK + rationale | Count Δ |
|---|---|---|---|---|
| `worldengine-v2-3-dispatch-oracle` (`writer_today`/`classifyWriterPath`) | `writerToday(name) = classifyWriterPath(PRESET_ARCHETYPE[name]??null, locked)`; `rows[].today = writerToday(name)`; asserted vs `ADJUDICATION[name].today` | Delete `classifyWriterPath`/`writerToday` + the 4-predicate import; set `rows[].today = ADJUDICATION[name].today`. Drop the now-tautological `expect(r.today).toBe(exp.today)` (line ~152); the row test asserts the LIVE `derived` (path + shellRegime) against the pinned table. | **PINNED TABLE.** The `ADJUDICATION` table already hard-codes `today` (empirically verified at build time); a frozen predicate-copy would duplicate ~40 lines of deleted logic for a cross-check whose ground truth is already pinned. The "15 identical + 2 reroutes" test keeps its teeth: `equal = (ADJUDICATION.today === LIVE derived.path)` — pinned-today vs LIVE-derived, the retirement evidence. | **0** (no `it` added/removed) → suite stays **25** (see below) |
| `worldengine-e1-conformance-oracle` (V2-1 shadow oracle) | identical `classifyWriterPath`; `writerToday`; `rows[].today`; asserted vs `ORACLE_PREVIEW[name].today` | Delete `classifyWriterPath`/`writerToday` + import; set `rows[].today = ORACLE_PREVIEW[name].today`. `writerE1(cv)` (the live shadow-E1) is UNCHANGED (imports `computeE1`/`modalRegime`, not the predicates). | **PINNED TABLE.** `ORACLE_PREVIEW` already pins `today` (from `oracle-preview.mjs`). The 13-equal/2-divergent tally stays real: `equal = (pinned today === LIVE writerE1)`; divergences {Eyeball, Frozen} = pinned-today ≠ live-E1. Parent `mustStayWorking`: "V2-1 shadow oracle keeps passing" — preserved. | **0** |
| `worldengine-lid-classifier` (`dispatchPath` in the last `describe`) | `dispatchPath(archetype, locked)` (4 predicates) + `shellRegimeOf(null,true)` | Delete `dispatchPath`; re-express the "two despun destinations resolve distinctly" `it` via the SURVIVING `shellRegimeOf`: `shellRegimeOf(null,true)==='eyeball-despun'` (locked shell destination) vs `shellRegimeOf(null,false)===null` (→ despun). Keep the Mars-unmapped line. | **FROZEN/SURVIVING RESOLVER** (not a copy): `shellRegimeOf` survives and the intent explicitly blesses test-oracle use of it. It IS the resolver the bridge locked-fallback used, so the "distinct destinations" claim is asserted at the real source, not a re-implemented chain. | **0** |
| `worldengine-v2-3-taxonomy` (`classifyWriterPath` in the "writer routes unchanged" `describe`) | `classifyWriterPath(...)==='despun'` AND `derivedPath(name,1)==='despun'` for both Neptunes | Delete `classifyWriterPath` + import; keep `expect(derivedPath(name,1)).toBe('despun')`, add `expect(ADJUDICATION-pinned 'despun')` as the documented expectation (both Neptunes route despun — the taxonomy's real concern is radius, covered by the other describes). | **PINNED** (the derived dispatch already proves despun; the legacy cross-check is redundant once the chain is gone). | **0** (the `for` loop still yields 2 its) |

**Dispatch-oracle test count (the enumerated gate value).** Current HEAD = **25** (verified this session:
the 3 AC-ORACLE-17 scope/row/tally its + 17 seed-invariance its + Europa≠Titan + RT1 pure-strong +
GARBLE + AC-0 grep + appliedTune-parity). The re-anchoring adds/removes ZERO `it`s. **The throw test
lives in its own new file (§5), NOT here.** ⇒ **dispatch-oracle target after this workstream = 25**
(the standing gate's "24" is stale relative to the shipped 9322645 appliedTune follow-up; enumerated per
the gate's "or the plan's enumerated new count").

## §5 — The THROW (AC1, AC2)

**Placement:** in the surviving guard's `else`, keeping the guard shape verbatim (see §6):

```
export function writeBodyRelief(carrier, { locked: argLocked = false, grainDrivers = DEFAULT_GRAIN_DRIVERS, bodyDrivers = null, macroSeed = 0, heightSeed = 'e6:0', T_eq = null } = {}) {
  if (bodyDrivers?.condition) {
    …derived dispatch… (UNCHANGED)
  }
  throw new Error('writeBodyRelief: bodyDrivers.condition is required — the PRESET_ARCHETYPE migration bridge was retired (world-engine-preset-archetype-retirement, 2026-07-13). Every production/lab caller must pass a condition-bearing bundle.');
}
```

Exact pinned message (stable, greppable): begins `writeBodyRelief: bodyDrivers.condition is required`.
Rationale (contract designDecision #2): a silent despun default could mask an unmigrated caller as a
distant byte-diff; a throw surfaces it at the call site.

**The throw test — the ONE legitimate condition-less caller left in `tests/`.** New dedicated file
`tests/worldengine-condition-less-throw.test.js` (a passing file → Test-Files-failed unaffected; must
collect+run ≥1 test per MF#3). One `describe`, ≥2 `it`s:
- `writeBodyRelief with no bodyDrivers throws the retirement error` → `expect(() => writeBodyRelief(c, { grainDrivers: DEFAULT_GRAIN_DRIVERS, macroSeed: 1 })).toThrow(/bodyDrivers\.condition is required/)`.
- `writeBodyRelief with bodyDrivers lacking .condition throws` → `expect(() => writeBodyRelief(c, { bodyDrivers: { massGravity: 1 }, macroSeed: 1 })).toThrow(/bodyDrivers\.condition is required/)` (proves the guard is `?.condition`, not mere `bodyDrivers` presence).

**AC2 grep with the explicit carve-out** (write the exemption so it is visible, not implicit):
```
# every writeBodyRelief call in tests/ must be condition-bearing EXCEPT the intentional throw test
grep -rn 'writeBodyRelief(' tests/ \
  | grep -v 'tests/worldengine-condition-less-throw.test.js' \
  | grep -v '\.condition'   # heuristic; the AUTHORITATIVE check is the green full suite (any missed condition-less caller THROWS → red)
# AND: no test imports the deleted predicates
grep -rlE 'isEarthlikePlatePath|isShellReliefPath|isVolcanicPath|isStagnantLidPath' tests/   # → expect: (empty)
```
The carve-out is the single named file `worldengine-condition-less-throw.test.js`. The *authoritative*
"zero condition-less call sites" proof is the full suite staying green: a missed condition-less caller
throws at runtime → a red test, not a silent pass.

## §6 — AC-0 grep impact (keep the guard, throw in the else — PREFERRED, no slice-marker re-anchor)

The dispatch-oracle AC-0 grep (`the if (bodyDrivers?.condition) region reads no PRESET_ARCHETYPE / e1
label / stagnantLidRegimeOf( / isVolcanicPath(`) slices the block with `block(code, 'if (bodyDrivers?.condition)')`
— it finds the first `{` after the marker and brace-matches. **Slice B keeps the `if (bodyDrivers?.condition)
{ … }` guard shape verbatim** and puts the throw in the `else`/after. Therefore:
- The sliced region is byte-for-byte the same derived block → the denylist (no `PRESET_ARCHETYPE`,
  `.label`, `stagnantLidRegimeOf(`, `isVolcanicPath(`, `isEarthlikePlatePath(`, `shellRegimeOf(`,
  `\barchetype\b`) still passes unchanged, and the sanity anchors (`computeE1(`, `compositionClass`)
  still match. **No slice-marker re-anchor.**
- The grep's `not.toMatch(/\barchetype\b/)` on the region: the derived block never referenced
  `archetype`; removing the `archetype` destructure param (which lives in the SIGNATURE, outside the
  sliced block) does not affect the region. AC1's file-level "no `archetype` parameter" is satisfied by
  the destructure removal.

Guardrail-adjacent suites to re-run (expected UNAFFECTED, re-anchor only if a window shifts, enumerated):
`worldengine-e1-shadow-audit.test.js` (asserts exactly one `writeBodyRelief` dispatch call site — count
of definitions unchanged) and `worldengine-lid-router-audit.test.js` (slices the `writeBodyRelief` body,
counts `writeLidResponseSphere(` at one inside + one at `labLidOverride` outside — the derived
`unbrokenLid()` router call and the lab seam both survive; the bridge had no router call). Both live in
`mustStayWorking`; the plan does NOT edit them — it verifies them.

## §7 — Gate checklist per slice (STANDING gates verbatim) + scope-clean diff list

**Run ALL vitest FROM `/home/ax/projects/well-dipper` (not `~/projects`).**

**Both slices must pass all three gates:**
1. **Quartet:** `npx vitest run tests/v2-0-byte-identity.test.js tests/worldengine-lid-byte-anchors.test.js tests/worldengine-e1-shadow-audit.test.js tests/planet-archetypes.test.js` — byte-identity **83/83**; quartet all green. (Goldens NEVER re-captured — `tests/fixtures/*` absent from the diff.)
2. **Dispatch-oracle:** `npx vitest run tests/worldengine-v2-3-dispatch-oracle.test.js` — **25** tests green (the enumerated count, §4; NOT 24).
3. **FULL:** `npx vitest run` — EXACTLY `Tests  4 failed` AND `Test Files  17 failed` (KnownObjects ×3 + GalacticFeatures ×1 cases; 2 case-files + 15 vendor files — MF#3 counting rule: pin BOTH counts). AND every touched/added test file collected + ran a NONZERO test count (guards a silently-uncollected suite from reading green — the new throw file especially).

**Additional per-slice checks:**
- Slice A: `npx vitest run` on the 13 touched test suites (M/R rows + the 4 oracle suites) — all green on the DERIVED path with the bridge still present; `grep -rlE 'isEarthlikePlatePath|isShellReliefPath|isVolcanicPath|isStagnantLidPath' tests/` → empty (no test imports a predicate anymore).
- Slice B: `grep -nE 'isEarthlikePlatePath|isShellReliefPath|isVolcanicPath|isStagnantLidPath|VOLCANIC_ARCHETYPES' planet-lod-rivers.js` → empty; `grep -n 'bodyDrivers?.condition ? shellDriversToTune' planet-lod-rivers.js` → empty (bridge-tune gate gone); the AC-0 region grep (gate 2) green; `grep -n 'STRONG_REGIME :' src/worldengine/base/lidResponse.js` → empty (ternary folded); the throw test green.

**Scope-clean diff (contract designDecision #6 — `git add <paths>` ONLY, never `-A`/`.`):**
- Production: `planet-lod-rivers.js` (Slice B), `src/worldengine/base/lidResponse.js` (Slice B).
- Tests (Slice A): `worldengine-base-plate-driver-response.test.js`, `worldengine-plate-regime-gate.test.js`, `planet-lod-rivers-discharge-param.test.js`, `worldengine-base-magmatism-structure.test.js`, `worldengine-base-magmatism-multiply.test.js`, `worldengine-base-stagnantlid-structure.test.js`, `worldengine-shell-regime-gate.test.js`, `worldengine-base-shell-multiply.test.js`, `worldengine-v2-3-dispatch-oracle.test.js`, `worldengine-e1-conformance-oracle.test.js`, `worldengine-lid-classifier.test.js`, `worldengine-v2-3-taxonomy.test.js`.
- Tests (Slice B, NEW): `tests/worldengine-condition-less-throw.test.js`.
- Docs: this workstream dir.
- **MUST STAY OUT of every commit** (verified dirty at HEAD): `src/auto/CameraChoreographer.js`, `src/debug/LabMode.js` (not-ours lane-B), the untracked `*.png` pile, `qa-results/`, `scratchpad/`. **`tests/fixtures/*` ABSENT from every diff** (goldens never re-captured; the migration adds NO fixture file — local per-suite adapters only).

## §8 — Risks / ambiguities surfaced

- **RG-A (scope-honesty): the contract's "each migrates … to the SAME writer" does not hold for two synthetic bridge inputs.** R1 (AC5 shell `D_OFF`) and R2 (`'terrestrial'+locked→despun`) are bridge behaviors the derived dispatch deliberately does NOT reproduce (V2-5s shell driver-response; the Eyeball locked-awareness adjudication). They are RETIRED, not migrated — enumerated in §3.2 with rationale. This is within designDecision #4a's "except the enumerated repurposings" clause, but it means the workstream **removes a handful of tests** (R1, R2, R3, R5, R9 = 5 `it`s deleted; R4/R6/R7/R8 trimmed). Net test-count moves DOWN in those suites and UP by the throw file — flagged so the drop is not read as lost coverage: each deleted `it`'s live behavior is covered elsewhere (dispatch-oracle 17-preset routes; shell-multiply call-site-1; the migrated M-rows).
- **RG-B (throw vs a lab null-bodyDrivers path).** Slice B's throw assumes EVERY production/lab `route()` call is condition-bearing (V2-3 established this; parent drove all 17 presets live-green through the condition-bearing path). If any lab mode passes `bodyDrivers` without `.condition`, it now throws instead of rendering the bridge — this is the DESIRED loud-failure (designDecision #2), but there is no live-drive AC in this contract (byte gates are the proof). Mitigation: the full-suite green + the 83/83 golden (whose `buildBundle` is condition-bearing) are the byte proof; recommend working-Claude spot-drives the lab once post-Slice-B (setPreset over a few presets, console clean) as belt-and-suspenders, though not AC-gated.
- **RG-C (guardrail-adjacent windows).** `worldengine-lid-router-audit` / `worldengine-e1-shadow-audit` slice the `writeBodyRelief` body by paren/brace matching; deleting the bridge shrinks that body. Expected unaffected (the surviving router call + call-site count are unchanged), but the Slice B gate MUST re-run them; if a window shifts, re-anchor is enumerated (a rewrite, like the V2-3 RG1 precedent) — do NOT silently relax.
- **RG-D (dispatch-oracle count drift).** The standing gate says 24; HEAD is 25 (appliedTune follow-up). The plan pins the enumerated post-workstream count at 25. If a builder "restores 24" by dropping the appliedTune test, that is a regression — the count is 25 and the appliedTune parity `it` stays.
- **AMB-1 (`archetype` destructure param).** AC1 says "the routing region no longer reads an `archetype` parameter." The derived region already reads none; the plan additionally removes the now-dead `archetype = null` destructure from the signature (only the bridge read it). Production `route()` still passes `archetype` harmlessly (ignored). Non-blocking; noted so the removal is intentional, not accidental.
