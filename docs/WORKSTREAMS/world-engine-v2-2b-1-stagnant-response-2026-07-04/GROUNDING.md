# V2-2b-1 — Stagnant-side driver→expression MULTIPLY — GROUNDING BRIEF

**File:** docs/WORKSTREAMS/world-engine-v2-2b-1-stagnant-response-2026-07-04/GROUNDING.md
**Date:** 2026-07-04
**Status:** GROUNDING (pre-contract). Answers the questions the `contract.json` cannot be written without,
from the roadmap + the 4b physics source-of-truth + the shipped #4-MULTIPLY precedent + live code (file:line).
Feeds `dev-collab-scope` → `intent.md` + `contract.json`.
**Branch:** feature/world-engine-production-L1 @ 0a7646b (V2-2a router + both byte-anchors VERIFIED `02cb221`).

**What V2-2b-1 IS (Max's second split, 2026-07-03/04):** V2-2 (the pilot) split into V2-2a (router + both
byte-anchors — DONE, `0a7646b`) and V2-2b (mixed interior + stagnant response). V2-2b is XL+; Max approved
splitting it AGAIN. **V2-2b-1 = the STAGNANT-side MULTIPLY only** — the direct analog of the shipped
#4-MULTIPLY, but on the STAGNANT (pure-strong / Venus) corner instead of the volcanic (pure-weak /
Lava-Magma) corner. It builds the **from-scratch `stagnantDriversToTune`** (does not exist today —
stagnantLid.js:174 is `void drivers`) that maps a body's D-vector → a `tune` override on `stagnantLid.js`'s
`DEFAULTS`, anchored so `stagnantDriversToTune(VENUS_REF)===null` → byte-identical Venus, non-null elsewhere
→ within-world variety on stagnant worlds. Everything mixed-interior stays V2-2b-2 (Q4 fence).

**Line of sight → the load-bearing UAT feedback (the reason this increment exists):** Max's Venus UAT
(AC9, `world-engine-venus-stagnantlid-2026-07-01/verdict.json`) was a basis-level PASS with the verbatim:
*"Very crude still. Landforms are pretty samey-looking (not necessarily between worlds but across the same
world)."* The Venus verdict routes that phrase EXPLICITLY: *"Within-world sameness is the KNOWN
seed-only-BROADEN limitation, owned by V2-2's stagnant-side response space."* `stagnantLid.js` today is
`void drivers` (:174) → **every stagnant world is a re-rolled Venus by seed** (EXACTLY Max's fear, ROADMAP-v2
§3.2 #4b). V2-2b-1 builds the response mechanism that fixes it. JOURNEY milestone = the SCREENSAVER
world-variety arc; north-star = *count of genuinely distinct, history-coherent worlds visible per minute*
(ROADMAP-v2 §0).

**⚠ Honesty note carried up-front (it shapes every AC below):** the golden constraint forces
`stagnantDriversToTune(VENUS_REF)===null` where **VENUS_REF = Venus's REAL preset drivers** — so the shipped
Venus preset stays **byte-identical** and V2-2b-1 does **NOT** change Venus's own within-world texture. This
is a **stronger** anchor than #4-MULTIPLY, where `MAGMA_REF` was a synthetic-neutral point OFF the real
Lava/Magma vectors and the real presets DID respond (non-null tunes). Here the shipped preset IS the
reference. The within-world variety therefore lands on **driver-varied** stagnant worlds (lab sliders now;
the wet-stagnant falsification world at V2-2b-2), not on Venus. If Max wants Venus *itself* to read less
samey, that is a re-tune of the shipped `DEFAULTS` that **would move the golden** — a separate look-tuning
decision, out of V2-2b-1's zero-clobber scope (flagged Q7).

---

## Q1 — EXERCISE MODEL: how `stagnantDriversToTune` is tested HEADLESS + UAT'd LIVE

**Constraint (identical to #4-MULTIPLY):** the tune builder is a **pure function** exercised in headless
vitest, plus a live lab surface for Max's UAT. It is threaded into the **shipped archetype dispatch**
(planet-lod-rivers.js:489-491), NOT into the V2-2a router (lidResponse.js) — that flip is V2-3 (Q4 fence).
This exactly mirrors how #4-MULTIPLY threaded `magmaDriversToTune` at the volcanic branch (:481-483) while
the router stayed a separate shadow classifier.

**Headless — reuse the shipped stagnant carrier harness VERBATIM:**
1. `carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD))` with **`TARGET_N=1500,
   LLOYD=2`** — the stagnant structure test's exact harness (tests/worldengine-base-stagnantlid-structure.test.js:
   the `carrierOf`/`build` helpers; N=1500 not 600 because stagnant ships MANY small clustered coronae +
   tessera → finer structure needs more nodes). `build(macroSeed, control)` calls
   `writeStagnantLidReliefSphere(c, {}, { macroSeed, ... })` and returns `{c, diag}`.
2. **Dual-carrier byte-equality at VENUS_REF (the #4b `run-twice` idiom):** build two fresh carriers on the
   same mesh — one via `writeStagnantLidReliefSphere(c, VENUS_DRIVERS, { macroSeed, regime, tune:
   stagnantDriversToTune(VENUS_REF) /* === null */ })`, one via the writer called directly with `tune:null`
   — assert `Float32Array` equality of `carrier.height` + the diag arrays (`isTessera`, `coronaActive`,
   `resurfAge`, `foldAngle`). Precedent: the #4-MULTIPLY byte-identity block asserts the reference call
   byte-equals the #4a baseline for `U/plumeId/edificeMask/…` (magmatism-multiply BUILD-PLAN §"SLICE A" step 6).
3. **Driver-sweep structure/variety test:** at a FIXED macroSeed, build the field at a monotone sweep of
   driver vectors (VENUS_REF → drier / younger / cooler), read the diag's responsive scalars
   (`tesseraFrac`, `coronaCount`, `activeFrac`, `plumeCount`) at each. Rebuild every predictor ARM'S-LENGTH
   from the published `plumeCenters` (the anti-tautology discipline the stagnant test already uses:
   tests/worldengine-base-stagnantlid-structure.test.js `plumePredictor`, SQUARED Gaussian, `sd.PLUME_BELT`).

**Live UAT — reuse the `driverOv` / `_driverAbMode` plumbing + the `stagnantLidProbe`:** select the Venus
preset (routes stagnant), drag the driver-override sliders off VENUS_REF → non-null tune → the rendered
stagnant world visibly changes; `stagnantLidProbe()` (planet-lod-lab.html:6111) reports the moving diag
(`plumeCount/coronaCount/tesseraFrac/activeFrac`, plus a NEW `appliedTune`). Precedent for the lab-slider +
`_lab` probe surface: the #4-MULTIPLY `fMagmaDrivers` folder (planet-lod-lab.html:3833 `'Body drivers →
volcanic relief (Inc.4-M)'`) + `setVolcanicThermal` (:5871) + `magmaProbe.appliedTune` (:6048).

---

## Q2 — DRIVER→EXPRESSION MAPPING (the design core — proposed, grounded, not free invention)

The mapping is a **bounded re-tune of the existing `DEFAULTS`** (stagnantLid.js:45-69) through the
**already-present tune seam** (stagnantLid.js:175 `const T = tune ? { ...DEFAULTS, ...tune } : DEFAULTS;`
then the full destructure at :176-183). No new writer machinery — the mechanism to accept a `tune` EXISTS;
only `stagnantDriversToTune` + the dispatch wiring are new. It mirrors `magmaDriversToTune`
(magmatism.js:113-129) exactly: read drivers → compute deviation-from-reference signals → anchored
overrides → identity guard → return null at the reference.

### (a) VENUS_REF — the null point (analog of `MAGMA_REF`, magmatism.js:93)

Derived from the **Venus preset's actual drivers** (driver-presets.js:47 — `volatileFraction:0.02,
T_eq:737, massEarth:0.815, radiusEarth:0.95` → `surfaceGravity = 0.815/0.95² = 0.903`; no `age` field →
default 4.5). Confirmed against the gate-1 L-table (gate-1-L-lidstrength-form-DESIGN.md:88 — Venus `V 0.02,
Tsurf 737, g 0.90`). So:

```
export const VENUS_REF = Object.freeze({ volatileFraction: 0.02, T_surf: 737, surfaceGravity: 0.903, age: 4.5 });
// thermalState at VENUS_REF = clamp01(0.5·rawTidal(≈0) + 0.5·(1 − 4.5/10)) = 0.275   (== magma's H_REF; old, tidal-quiet)
```

**CRITICAL DIFFERENCE from #4-MULTIPLY (must be pinned in the contract):** `MAGMA_REF` was OFF the real
Lava/Magma vectors so those presets responded and their golden was captured *after* they changed. Here
**VENUS_REF must EQUAL Venus's real drivers** so `stagnantDriversToTune(Venus)===null` and Venus stays
byte-identical — because Venus is one of the 15 presets in the 75-golden (captured `7441c92`, NEVER
re-captured) and it is the **only** preset that routes stagnant today. Any non-null tune at Venus moves the
golden = ZERO-CLOBBER violation.

### (b) Responsive `DEFAULTS` keys — POPULATION knobs only, primary `V`+`T_surf`, secondary `thermalState`/`g`

**Design decision (anti-mush by construction, see (d)):** V2-2b-1 re-tunes **only the placement/population
knobs**, leaving the `BASE_*` province floors and all amplitude constants **byte-identical to Venus**. This
makes the elevation-ordering invariant STRUCTURALLY guaranteed (same floors as the proven Venus field) —
not something a bound has to defend. Each transfer function is anchored on a **deviation-from-VENUS_REF**
signal so it evaluates to the exact `DEFAULT` at VENUS_REF (mirrors `Hd = H − H_REF`, magmatism.js:117).

| `DEFAULTS` key (line) | default | driven by (deviation signal) | sign | physics — grounded in increment-4b-venus-stagnantlid-MECHANISM.md |
|---|---|---|---|---|
| **`TESSERA_FRAC`** (:49) | 0.075 | **V (dryness)** + age | drier → ↑, older → ↑ | Tessera = the OLDEST, highest, multiply-deformed crust preserved on a strong dry lid; a wetter/weaker lid resurfaces it away. MECHANISM "Tessera fabric … ancient crustal plateaus … stratigraphically oldest, embayed by plains"; §"Resurfacing" — wetter/more-active → more plains resurfacing → less preserved tessera. |
| **`CORONA_ACTIVE_FRAC`** (:53) | 0.65 | **thermalState** (tidal+1−age), `T_surf` | younger/hotter → ↑ | Active coronae = ongoing plume support (domed interior + trench + rise); inactive = relict rim + depression. MECHANISM §"Coronae" + the 2025 gravity study (52/75 active on a still-warm Venus); a colder/older stagnant world's coronae go relict → lower active fraction. |
| **`CORONA_POOL`** (:51) | 120 | **thermalState / vigor** + V (wetter → more melt transport) | more vigor/wetter → ↑ | Corona DENSITY tracks concentrated mantle upwelling. MECHANISM §"The seeded mantle-plume field" (coronae cluster over upwelling) — the single most direct within-world heterogeneity lever (more coronae = more distinct provinces). |
| **`PLUME_MIN`** (:48; keep `PLUME_SPAN`) | 6 | **vigor** (thermal/size) | more vigor → ↑ | More upwelling provinces → more distinct regions; keeping `PLUME_SPAN` fixed preserves per-seed variety (mirrors #4-M leaving `PLUME_COUNT_SPAN` alone, BUILD-PLAN §"magmaDriversToTune"). |

**Primary axis honesty (per ROADMAP-v2 §2.3 V-axis + R-wetstag + §5.4 #1):** the response MUST
differentiate on **`V` (volatiles/dryness) and surface temperature `T_surf`**. `V` and `T_surf` drive
`TESSERA_FRAC` (dry+cool → more preserved tessera; wet → resurfaced) and, via `thermalState`, the corona
population — so a **WET** stagnant body reads with **less tessera + more resurfaced plains + more active
coronae** than dry Venus. That is the "not Venus-with-water, not a re-rolled Venus" differentiation the
whole condition-first premise is falsified/validated on. Tidal (`rawTidalIoRatio`) is NOT a stagnant driver
— it is the heat-pipe axis (`m_hp`) that routes Lava/Magma to the *other* corner (gate-1 §"honesty note"
:105); the stagnant tune ignores it.

### (c) The identity guard (mirror magmatism.js:124-127)

```
if (TESSERA_FRAC===D.TESSERA_FRAC && CORONA_ACTIVE_FRAC===D.CORONA_ACTIVE_FRAC
    && CORONA_POOL===D.CORONA_POOL && PLUME_MIN===D.PLUME_MIN) return null;   // exact-only, like plates' D_EARTH
```
At VENUS_REF every deviation signal is 0 → every override === its `DEFAULT` → return null → the writer's
`tune ? {...} : DEFAULTS` ternary (stagnantLid.js:175) takes the untouched branch → byte-identical Venus.

### (d) The anti-mush invariant (Q2d — the load-bearing ordering guarantee)

The tune MUST preserve `mean(tessera) > mean(plains) > mean(rift)`. Because V2-2b-1 **does not touch**
`BASE_TESSERA (0.70) / BASE_PLAINS (0.10) / BASE_RIFT (−0.45)` (stagnantLid.js:62) nor any amplitude
constant, the strict ordering + the "amplitudes < the 0.60/0.55 floor gaps" guarantee (stagnantLid.js:62
comment; MECHANISM §"the elevation-ordering guarantee") holds **structurally** — identical floors to the
proven Venus field. Re-tuning *how many* coronae/tessera provinces appear cannot invert *where the floors
sit*. The structure test's ordering assertion (`meanTessera > meanPlains > meanRiftTrench`,
stagnantLidProbe:6149) therefore passes under every non-null tune by construction.

**Secondary `gravity` relief-scaling (flagged, recommend OPT-IN/deferred, Q7#5):** "higher g → flatter"
(the house `reliefGravityFactor` convention, planet-lod-lab.html:1914; the #4-M `gFactor`, magmatism.js:119)
would require touching relief amplitudes. The ONLY ordering-safe way is a **uniform proportional multiply**
on `{BASE_TESSERA, BASE_PLAINS, BASE_RIFT, and all amplitude constants}` — a uniform scale keeps every gap
positive and every amplitude below its (also-scaled) gap, so ordering can't invert. Recommend deferring it
(or shipping it opt-in behind a `K_G` that Max can zero at UAT) so the anti-mush invariant stays trivially
true (floors fixed) for the core increment.

---

## Q3 — BYTE-SAFETY + DISPATCH WIRING

**The 75-golden stays 75/75 (tests/v2-0-byte-identity.test.js; fixtures captured `7441c92`):** Venus routes
stagnant and `stagnantDriversToTune(VENUS_REF)===null` → Venus byte-identical; **no other preset routes
stagnant** today (driver-presets.js:187 — Venus is the only `'stagnant-lid'` mapping), so no golden row can
move. Un-changed golden green IS the ZERO-CLOBBER proof.

**The dispatch edit (planet-lod-rivers.js:489-491):** today
```
const slRegime = stagnantLidRegimeOf(archetype, locked);
if (slRegime) { const stagnantDiag = writeStagnantLidReliefSphere(carrier, grainDrivers, { macroSeed, regime: slRegime }); ... }
```
change to pass **`bodyDrivers`** + a **`tune`** (mirroring the volcanic branch :481-483, whose comment at
:480 reads *"bodyDrivers replaces grainDrivers as the drivers arg — byte-safe, the writer voids it"*):
```
const stagnantTune = stagnantDriversToTune(stagnantDriversRefOf(bodyDrivers));   // reads flat V/T_surf/g/age (Q2)
const stagnantDiag = writeStagnantLidReliefSphere(carrier, bodyDrivers, { macroSeed, regime: slRegime, tune: stagnantTune });
stagnantDiag.appliedTune = stagnantTune;
```
`bodyDrivers` is in scope at the `writeBodyRelief` signature (planet-lod-rivers.js:452); `T_eq` is ALSO in
scope there (:452) — the source for `T_surf` (Q2a / Q7#1). At Venus with untouched sliders, `bodyDrivers`
carries Venus's real drivers → `tune` null → byte-identical. `grainDrivers` (DEFAULT_GRAIN_DRIVERS,
planet-lod-rivers.js:92) is no longer the drivers arg on the stagnant path, exactly as #4-M dropped it on
the volcanic path — byte-safe because `writeStagnantLidReliefSphere` `void drivers` (stagnantLid.js:174).

**AC-ZERO-CLOBBER for the still-shipped corner paths:** `magmatism.js` + the V2-2a router
(`lidResponse.js`) stay **byte-identical**. The router is NOT edited — `stagnantDriversToTune` is invoked
ONLY at the shipped dispatch seam (:489-491), never inside the router (the router will thread the stagnant
tune at V2-3, out of scope). The router's strong branch passes NO tune → the `tune=null` DEFAULTS path is
untouched → `worldengine-lid-byte-anchors.test.js` (V2-2a's AC-BYTE-STRONG-REF at Venus through the router)
stays green.

**The `'lid:'` namespace stays RESERVED:** `stagnantDriversToTune` is a **pure DEFAULTS-override function
with ZERO alea draws** — it adds no RNG. The mixed-interior `'lid:strength:'`/`'lid:yield:'` streams
(gate-2 PG-1) are V2-2b-2. V2-2a's assertion (tests/worldengine-lid-router-audit.test.js:37 — *"the `'lid:'`
namespace is RESERVED (unused)"*) must still hold — a grep asserts zero `'lid:'` draws in V2-2b-1 source.

---

## Q4 — THE SPLIT FENCE (explicit — everything below is V2-2b-2, NOT this increment)

Confirmed against §7a RESOLVED (*"stagnant response + mixed interior second"*) + the V2-2a intent non-goals
(world-engine-v2-2a-router-anchors-2026-07-03/intent.md "Deliberate non-goals"): V2-2b-1 takes the
**stagnant-response mechanism slice** ONLY; the mixed interior + falsification worlds + pilot UAT are V2-2b-2.

- **The mixed interior — RESERVED.** The `'lid:'` alea namespace (`'lid:strength:'`/`'lid:yield:'` draws,
  gate-2 PG-1) stays unused (assert zero `'lid:'` draws still holds — tests/worldengine-lid-router-audit.test.js).
- **The per-center pierce boolean** `strength_p·Φ > localYield(L, p)` (gate-2). No `localYield`, no `Φ`
  consumption in V2-2b-1 — the stagnant tune reads flat body drivers, not the pierce mechanism.
- **The absolute-datum province stack + edifice budget bound** (`AC-ORDER-MIX`, ROADMAP-v2 §2.4 / §5.3).
  V2-2b-1 keeps the shipped constant-floor stack (Q2d), does not build the mixed absolute-datum stack.
- **The multi-valued `primitiveId` populate + `centerId` co-emit + the gate-3 `Π=C·F` interpenetration
  statistic** (ROADMAP-v2 §5.4 #2; V2-2a authored only the schema). Not touched here.
- **The 3 falsification worlds** — wet-stagnant (§5.4 #1), corona-pierced compound (§5.4 #2), Tharsis
  integration checkpoint (§5.4 #3). V2-2b-1 builds the *mechanism* the wet-stagnant world will use; V2-2b-2
  renders + falsifies all three.
- **`effectiveL` consumption — EXPLICITLY OUT.** `effectiveL` (e1Regime.js:198,229 —
  `effectiveLOf(V)` on seeded-`'stagnant'` picks, gate-2 §4 R-wetstag hand-up) is consumed by the MIXED
  response (V2-2b-2), NOT by this pure-strong MULTIPLY. `stagnantDriversToTune` reads the flat body D-vector
  (V, T_surf, g, age) → a `DEFAULTS` override; it does NOT read `effectiveL`, `L`, `Φ`, `n`, or `m_hp`.
- **No dispatch flip to E1** (V2-3). **No game `Planet.js` port** (V2-10). **No palette/shader.**

---

## Q5 — LAB + UAT

**Lab driver controls (reuse the existing `driverOv` / `_driverAbMode` plumbing):** `driverOv` already
carries `{ gravity, volatiles, tidal, thermal }` (planet-lod-lab.html:2684) and `buildBodyDrivers` already
injects `{ massGravity, volatileFraction, tidalHeating, thermalState }` (:2709-2719) with the A/B override
gate (`useOv`, `_driverTouched`, `_driverAbMode` at :2686/:2711). For the stagnant tune:
- **`volatiles` (V)** and **`gravity` (g)** sliders already exist (:3812-3816) and already flow into
  `bodyDrivers` — they feed the stagnant tune for free.
- **NEW: a `T_surf` control** — `T_surf` is not in the flat bundle today. Recommend surfacing it (Q7#1):
  add `driverOv.tsurf` + a `'Body drivers → stagnant relief (V2-2b-1)'` folder mirroring the #4-M
  `fMagmaDrivers` folder (:3833), and have `buildBodyDrivers` add `T_surf: useOv('tsurf') ? driverOv.tsurf
  : (fp.T_eq ?? 288)`. The existing `thermal` slider (:3834) can double as the stagnant `thermalState`
  input (corona activity/age), or a stagnant-specific `age` slider is added.
- **`_lab` probe:** extend `stagnantLidProbe()` (:6111) to return `appliedTune` (non-null off VENUS_REF)
  alongside the already-published `plumeCount/coronaCount/tesseraFrac/plainsFrac/activeFrac` (:6142-6151) —
  the moving diag is the objective sweep readout.

**UAT card framing (this increment carries a REAL uat AC, unlike V2-2a):**
- **Objective integration ACs (agent-drivable — measured diag moves):** at a FIXED seed, sweeping the
  V/T_surf/thermal sliders makes `tesseraFrac/coronaCount/activeFrac/plumeCount` move measurably (correct
  sign, Q2b), `appliedTune` goes non-null off VENUS_REF, and a composite province-diversity index rises
  toward the high-heterogeneity corner. The agent drives + screenshots this (chrome-devtools, per
  `sandbox-localhost-probe` for liveness); it is NOT Max's gate.
- **Holistic UAT AC (Max-only, deferred-to-max):** *"Does a driver-varied stagnant world read VARIED WITHIN
  ITSELF — distinct provinces (tessera plateaus beside active coronae beside resurfaced plains), not samey
  — AND do two differently-driven stagnant worlds read as genuinely different worlds, not both re-rolled
  Venus?"* This is the direct AC9 answer (`world-engine-venus-stagnantlid` verdict). No agent closes it →
  `VERIFIED_PENDING_MAX <sha>` on integration green → Max UAT → Shipped. (Note the honesty flag in the
  header: this is tested on driver-VARIED worlds via the sliders; Venus-the-preset stays byte-identical.)

---

## Q6 — AC-0 SPINE CONFORMANCE (Rule 15, SPINE-CONFORMANCE.md — folded into the contract)

1. **Driver connectivity.** `stagnantDriversToTune` reads ONLY D-slot-backed flat drivers —
   `volatileFraction` (D-slot V), `T_surf` (the `T_eq` D-slot = surface temperature, per ROADMAP-v2 D3-MF2),
   `surfaceGravity` (D-slot g), `age`/`thermalState` (D16 / named derivation) — and **NO archetype string**.
   Grep denylist (mirror V2-2a AC-0): the builder source contains no `e1.label` read, no `PRESET_ARCHETYPE`
   read, no `stagnantLidRegimeOf(` call. **Accepted debt to declare:** the *dispatch* (:489) still resolves
   the strong regime via `stagnantLidRegimeOf(archetype)` — that is the un-wired seam retired at V2-3 (same
   declared debt as V2-2a); the *tune builder* is archetype-free.
2. **Named consumer.** Every tuned `DEFAULT` has a rendered expression + a named reader in the DAG:
   `TESSERA_FRAC → tesseraFrac`, `CORONA_ACTIVE_FRAC → activeFrac`, `CORONA_POOL → coronaCount`, `PLUME_MIN
   → plumeCount` — all read by `stagnantLidProbe` (:6142-6151) + the structure test's arm's-length
   predictors. No dead knobs. `appliedTune` reader = `stagnantLidProbe` + the objective sweep AC.
3. **Taxonomy registration.** The lab stagnant-driver sliders are **driver overrides**, not archetype
   toggles — like the #4-M `thermal` slider (:3834) and V2-1's `_lab.e1RegimeWeights`, they add NO
   `*Enabled` key → `planet-archetypes.js` drift guards (tests/planet-archetypes.test.js) stay green with no
   taxonomy change. If any control is `_lab`/console-only it registers nowhere by design.

---

## Q7 — OPEN QUESTIONS for Max / scoping (genuinely unresolved)

1. **`T_surf` source (small architecture choice).** Surface `T_surf` into the FLAT `bodyDrivers` bundle
   (recommended — #4-M "surface the driver first" parity; `buildBodyDrivers` adds `T_surf`, VENUS_REF.T_surf
   = 737, AC-0-clean flat read) — vs read `bodyDrivers.condition.T_eq` (the V2-1 nested read surface,
   already authoritative but mixes flat+nested) — vs pass the `T_eq` already in dispatch scope (:452) as a
   2nd opts arg to the builder (breaks single-arg parity with `magmaDriversToTune`). *Recommend: flat-bundle
   surfacing.*
2. **Lab sliders: add vs reuse.** Add a NEW `T_surf` (+ maybe stagnant `age`) slider + a dedicated
   `'Body drivers → stagnant relief (V2-2b-1)'` folder (recommended, mirrors the #4-M folder) — vs reuse
   only the existing `volatiles`/`gravity`/`thermal` sliders (leaves `T_surf`, the primary axis, undrivable
   in the lab). `T_surf` is the one genuinely-new control the primary-axis story needs.
3. **How aggressive should within-world variety be at UAT?** The transfer gains (`K_TESS`, `K_ACT`,
   `K_POOL`, `K_PLUME`) are first-cut, tunable at UAT (like #4-M's `K_COUNT/K_HEIGHT/…`, BUILD-PLAN
   §"magmaDriversToTune"). How strongly should drivers push the province mix before it reads over-busy? —
   Max's taste call at UAT.
4. **VENUS_REF = the preset's real drivers (byte-safety), confirm the exact vector.** Recommend
   `{volatileFraction:0.02, T_surf:737, surfaceGravity:0.903, age:4.5}` (Venus preset, driver-presets.js:47)
   so Venus is the null point and the golden can't move. Unlike `MAGMA_REF` this **must** equal the real
   preset — confirm, and confirm we're NOT introducing a documented-neutral-off-Venus point (which would
   move the golden).
5. **Gravity relief-scaling in-scope or deferred?** "higher g → flatter" needs the uniform-proportional
   amplitude scale (Q2d — ordering-safe by proportionality). Recommend deferring it / shipping opt-in behind
   a zeroable `K_G` so the anti-mush invariant stays trivially true (floors fixed) for the core increment.
6. **The Venus-itself honesty tension.** V2-2b-1 keeps Venus byte-identical (golden), so it does NOT reduce
   Venus's OWN within-world sameness — it delivers the response space so driver-varied stagnant worlds vary.
   Confirm Max accepts that the AC9 fix is "the response space exists + a driver-varied world reads varied,"
   NOT "Venus changes." If he wants Venus itself re-tuned, that moves the golden = a separate look-tuning
   decision, out of this increment's scope.

---

## Signed constraints the contract MUST carry (violating any = NEEDS-FIX)

- `stagnantDriversToTune(VENUS_REF)===null` where **VENUS_REF = Venus's real preset drivers** → Venus
  byte-identical → 75-golden stays 75/75 (captured `7441c92`, NEVER re-capture). Venus is the ONLY stagnant
  preset, so no golden row can move.
- Re-tune **POPULATION knobs only** (`TESSERA_FRAC`, `CORONA_ACTIVE_FRAC`, `CORONA_POOL`, `PLUME_MIN`);
  leave `BASE_*` floors + all amplitudes byte-identical → anti-mush ordering (`tessera>plains>rift`)
  STRUCTURALLY preserved. Correct-sign, primary `V`+`T_surf`, each grounded in the 4b MECHANISM doc.
- Identity guard = exact-only (mirror magmatism.js:124-127); deviation-from-VENUS_REF signals so every
  override === DEFAULT at the reference.
- Threaded at the SHIPPED dispatch seam (planet-lod-rivers.js:489-491, mirror the #4-M volcanic wiring
  :481-483) — NOT into the V2-2a router (byte-identical; V2-3 flip out of scope). `magmatism.js` +
  `lidResponse.js` stay byte-identical (AC-ZERO-CLOBBER, still-shipped corner paths).
- ZERO new alea draws in the tune builder; the `'lid:'` namespace stays RESERVED (zero `'lid:'` draws —
  tests/worldengine-lid-router-audit.test.js). No `effectiveL`/`localYield`/`Φ`/mixed-interior consumption
  (Q4 fence — all V2-2b-2). Rule 15 AC-0. `carrier.regime` untouched (verify.js `∈{0,1,2}`). The 4
  pre-existing unrelated failures (KnownObjects ×3, GalacticFeatures ×1) must not grow.
- Carries a REAL uat AC (Max-only, deferred-to-max) — the direct AC9 answer — alongside agent-drivable
  objective integration ACs. Terminal gate = `VERIFIED_PENDING_MAX <sha>` → Max UAT → Shipped.

---

## Recommended AC skeleton (contract fills the verifyVia detail; mirrors #4-MULTIPLY AC1-AC7 + V2-2a rigor)

- **AC-0** — spine conformance (Q6): driver connectivity (grep denylist, flat D-slot reads only) + named
  consumer (every knob → probe field) + taxonomy (driver sliders, no `*Enabled`). `layer: unit`.
- **AC1** — BYTE-IDENTITY AT VENUS_REF + DETERMINISM: `stagnantDriversToTune(VENUS_REF)===null`; dual-carrier
  `Float32Array` equality vs the shipped Venus (`tune:null`) for seeds {1,2,3,7,42}; zero new
  `Math.random`/`Date.now`; ZERO new alea draws; `'lid:'` namespace reserved; `|U|<STAGNANT_BOUND`. `unit`.
- **AC2** — MONOTONE DRIVER RESPONSE (between-world, correct sign): at fixed seed, drier V → ↑`tesseraFrac`;
  younger/hotter → ↑`activeFrac` + ↑`coronaCount`; more vigor → ↑`plumeCount`; at VENUS_REF collapses to
  Venus. Fixes "every stagnant world is a re-rolled Venus." `unit`.
- **AC3** — WITHIN-WORLD VARIETY (objective proxy, the AC9 mechanism): across the sweep a province-diversity
  index (over {tessera, active-corona, inactive-corona, plains, rift} coverage) rises toward the
  high-heterogeneity corner, reproducible per seed. `unit`.
- **AC4** — ANTI-MUSH / ORDERING PRESERVED UNDER SWEEP: `meanTessera>meanPlains>meanRiftTrench` for every
  sweep point (arm's-length masks); `varExplainedByPlume` stays above the #4b bar; the #4b structure suite
  green. `unit`.
- **AC5** — NO-CLOBBER + DISPATCH SAFETY: 75-golden 75/75; `magmatism.js` + `lidResponse.js` router
  byte-identical; `'lid:'` reserved; only in-scope files edited; `carrier.regime` untouched; the 4 known
  failures don't grow. `layer: integration`.
- **AC6** — LIVE DRIVER SWEEP (agent-drivable): in the lab, fixed seed, sliders low→high visibly change the
  stagnant world; `stagnantLidProbe` reports `appliedTune` non-null + moving fractions; agent screenshots.
  `layer: integration, live: true`.
- **AC7** — UAT (Max-only): does a driver-varied stagnant world read varied within itself + distinct from
  Venus (the AC9 gate)? `layer: uat`, deferred-to-max.
