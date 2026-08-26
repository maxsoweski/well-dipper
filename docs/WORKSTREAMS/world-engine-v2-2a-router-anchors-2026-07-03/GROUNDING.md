# V2-2a — Anchor-preserving router + both byte-anchors — GROUNDING BRIEF

**File:** docs/WORKSTREAMS/world-engine-v2-2a-router-anchors-2026-07-03/GROUNDING.md
**Date:** 2026-07-03
**Status:** GROUNDING (pre-contract). Answers the questions the V2-2a `contract.json` cannot be written
without, from the roadmap + gates + live code (file:line). Feeds `dev-collab-scope` → `intent.md` + `contract.json`.
**Branch:** feature/world-engine-production-L1 @ ac307aa (V2-1 E1 shadow VERIFIED; `computeE1` live, dispatch untouched).

**What V2-2a IS (the split, §7a RESOLVED 2026-07-03):** the FIRST half of the V2-2 pilot split Max
approved — *"router + both anchors first, stagnant response + mixed interior second."* V2-2a = the
Option-A anchor-preserving **router** (`writeLidResponseSphere` = classifier + corner delegation) proven
**byte-identical at both anchors AND the real Lava/Magma/Venus preset vectors**, plus the pre-code-gate
constants (gate-1 `L`, gate-2 routing model, gate-3 `familyOf`) wired as the classification boundary.
It is a **pure routing/plumbing increment, like V2-0** — zero behavioral change for every shipped preset,
**no new height-writing machinery** (§5.5). Everything that renders a NEW world is V2-2b.

**Line of sight → north star (ROADMAP §5 preamble):** converts the two cheapest-to-unify shipped writers
from archetype-gated menus into one condition-derived response space. V2-2a lays the *spine* of that
(condition → router) and proves it clobbers nothing; V2-2b fills the response space that yields the
predicted-but-never-observed worlds. V2-2a itself produces **no new visible experience** → per the
omit-when-no-experience rule it carries **no UAT AC** (see §6).

---

## Q1 — EXERCISE MODEL: how `writeLidResponseSphere` is invoked + verified while dispatch still routes on `PRESET_ARCHETYPE`

**The constraint.** Dispatch (`writeBodyRelief`, planet-lod-rivers.js:448-497) routes on `archetype`
until V2-3. V2-2a must **not** wire the router into that seam (that flip is V2-3; §3.1 V2-3 row). So the
router is exercised the way V2-1's `computeE1` was: a **pure module, called directly in headless vitest**,
with an **optional thin live shadow probe** — never in the render path.

**Cheapest faithful mechanism — headless direct-call vitest over a real carrier (pin this):**

1. **New module** `src/worldengine/base/lidResponse.js` exporting `writeLidResponseSphere(carrier, drivers, opts)`
   + the classifier (`classifyLidPath(e1, rawTidal)` → `'pure-weak' | 'pure-strong' | 'mixed' | 'off-pilot'`)
   + `isUnbrokenLidPath(e1)` (the subtractive gate, D3-MF1). Precedent for a new base writer: `e1Regime.js`
   is a pure module imported by tests, never by a writer (V2-1 BUILD-NOTES §5 grep-audit).
2. **Headless carrier harness — reuse the shipped one verbatim:** `carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD))`
   (tests/worldengine-base-magmatism-structure.test.js:28; `TARGET_N=700, LLOYD=2` for the golden mesh in
   tests/fixtures/v2-0-carrier-golden.mjs:41-42). No `three` needed at the writer level — `makeSphereField`
   *consumes* a prebuilt `{verts,faces,adj}` (gate-3 Open-Q4).
3. **Supply the router's inputs by calling `computeE1` on the real preset vectors** — exactly the V2-1
   oracle path: `deriveConditionVector(fp, u, radiusEarth)` (body-condition-vector.js; now carries `T_eq`,
   `surfaceGravity`, `rawTidalIoRatio` per V2-1 AC6) → `computeE1(cv, macroSeed)` (e1Regime.js:155) → the
   E1 tuple → passed to `writeLidResponseSphere`. For lab/mid-axis worlds, **hand-set** a condition vector
   (mirrors gate-1/gate-2's `.mjs` calib scripts and §5.4 #3's hand-set Mars D-vector).
4. **Verification layers (all UNIT/headless — mirrors V2-1 AC1-AC6; the only live AC there, AC7, is a probe):**
   - **AC-BYTE-*** — build two fresh carriers on the *same* mesh: one via `writeLidResponseSphere(...)`
     routed to the corner, one via the corner writer called directly with identical args; assert
     `Float32Array` equality of `carrier.height` (+ the diag arrays). Precedent: the magmatism structure
     test's "byte-identical determinism … run twice" does exactly `expect(Array.from(a.c.height)).toEqual(Array.from(b.c.height))`
     (worldengine-base-magmatism-structure.test.js:78-85).
   - **AC-CONFORMANCE(FINE)** — assert `classifyLidPath` over the 15 mapped presets: Lava/Magma → pure-weak,
     Venus → pure-strong, every other shipped preset → off-pilot, **none → mixed** (a preset drifting into
     mixed fails). This is the router twin of V2-1's writer-equality oracle (tests/worldengine-e1-conformance-oracle.test.js).
   - **75-golden byte-identity** (tests/v2-0-byte-identity.test.js) stays green **untouched** — because the
     router is NOT wired into `writeBodyRelief`, that harness never reaches it. That un-changed green **is**
     the ZERO-CLOBBER proof for the shipped dispatch.
5. **Optional thin live surface** — a `_lab.lidRouteProbe()` shadow read returning the fine-class + T_ss for
   the current body, mirroring V2-1's `_lab.e1Probe()` (world-engine-lab.html, sibling of `magmaProbe`/`stagnantLidProbe`).
   **Optional because V2-2a renders nothing new** — recommend deferring the live probe unless the contract
   wants an AC7-style console-clean check; if added it is `layer:integration, live:true` but is NOT a UAT.

**Net:** V2-2a is verified entirely headless (byte-equality + fine-class classification + AC-0), no
`VERIFIED_PENDING_MAX` UAT hold — the V2-0 pattern (VERIFIED `0461463`, no UAT).

---

## Q2 — ROUTER INPUT: which E1 outputs the router reads; headless supply; where `T_ss` comes from; pre-gate computation

**E1 outputs the router consumes (from `computeE1`'s real return, e1Regime.js:217-230 — coordinates, NEVER `label`):**

| Router reads | E1 field | Gate order (gate-1 §4 "Recommended router boundaries") |
|---|---|---|
| `compositionClass` | `cls` (:218) | **1st** — gas/carbon/crystal/icy terminal → off-pilot. Fires before `L`. |
| `m_hp` = `rawTidal − 0.45` | `m_hp` (:225; `HEATPIPE_PEG=0.45` :40) | **2nd** — boolean `m_hp>0` → **pure-weak** (Lava +7.8e5, Magma +7.6e7). Fires before `L`. |
| `L` | `L` (:221; `L_STRONG=0.63` e1Regime.js:43) | **3rd** — pure-strong cut `L≥L_STRONG` (Venus 0.728; Mars 0.551 → mixed). |
| `geodynamicRegime` | (:219) | a seeded `'stagnant'` pick routes strong **regardless of raw `L`** (gate-2 §4). |
| `effectiveL` (conditional) | (:229, seeded-stagnant only) | the strong-band effective `L` for wet-stagnant — **consumed only by V2-2b** (the mixed stagnant response). |
| `rawTidalIoRatio` | `cv.rawTidalIoRatio` (e1Regime.js:164; body-condition-vector.js:37) | the **tidal-shoulder rule** (gate-2 PG-5): pure-strong = `L≥L_STRONG AND rawTidal < SHOULDER_LO(0.15, e1Regime.js:44)`, else the `m_hp` seam cliffs. |
| `Φ`, `n`, `positionWithinRegime`, `e1Seed` | (:222,224,227,226) | **mixed-interior only → V2-2b.** V2-2a's classifier does not read them. |

**Headless supply.** Same as Q1: `computeE1(deriveConditionVector(fp, u, radiusEarth), macroSeed)` for the
17 preset vectors in `driver-presets.js` (the V2-0 headless oracle source), or a hand-set condition vector.
The router is a pure function of `(carrier, drivers, {e1, macroSeed, locked, T_ss/T_eq, tune})`.

**Where `T_ss` comes from today (traced).** `T_ss` is **not** on the condition vector and **not** an E1
output. It is computed at the dispatch seam and threaded into the volcanic writer:
- planet-lod-rivers.js:476 — `const T_ss = locked ? (T_eq ?? 0) * 1.4 : 0;` (shipped F41 convention;
  `T_eq` comes from `route()`'s `_fp.T_eq`).
- passed as an **opt**: `writeMagmatismSphere(carrier, bodyDrivers, { macroSeed, locked, T_ss, tune })` (:482).
- consumed inside: `isMagmaOcean = (T_ss > T.LIQUIDUS)` with `LIQUIDUS=1300` (magmatism.js:299,80), then
  `thetaSea = acos((LIQUIDUS/T_ss)^4)` (:300) drives the substellar basin depth. The basin gates on
  **`T_ss > LIQUIDUS`, NOT on `locked`** (magmatism.js:158-160,299) — both Lava & Magma are locked; only
  `T_ss` separates their sea width (AC9). `substellarAxis` is seed-only (`alea('magma:substellar:'+seed)`, :195).

**How it is computed pre-gate (D3-MF3 — the byte-identity requirement).** For Magma's basin to be
byte-identical, `T_ss` must be computed **before** the pure-weak/pure-strong classification and passed to
`writeMagmatismSphere` **unchanged**. Concretely: the router must reproduce planet-lod-rivers.js:476
*exactly* — either (a) receive a precomputed `T_ss` in its opts (caller computes `locked?(T_eq??0)*1.4:0`,
matching the seam), or (b) receive `locked`+`T_eq` and compute it internally with the identical expression.
**Recommend (a)** — caller passes `T_ss` precomputed, so the router's pure-weak branch is a verbatim
pass-through of today's `{macroSeed, locked, T_ss, tune}` and byte-identity is *structural*, not
re-derived (any drift in the `*1.4` expression can't creep in). Pin this in the contract.

---

## Q3 — BYTE-IDENTITY MECHANICS: "calls the corner writer UNCHANGED", argument-for-argument

**The two corner signatures are ASYMMETRIC — the contract must carry both conventions (a real gotcha):**

- **pure-weak** — `writeMagmatismSphere(carrier, drivers = {}, { macroSeed = 0, locked = false, T_ss = 0, tune = null } = {})`
  (magmatism.js:170). Returns `{U, plumeId, plumeCount, hotspotNode, hotspotProximity, nearestPlume, substellarAxis, …}`
  (:164-166,416); writes `carrier.height = U` (REPLACE). Today's call (planet-lod-rivers.js:481-482):
  `tune = magmaDriversToTune(bodyDrivers)`, then `writeMagmatismSphere(carrier, bodyDrivers, {macroSeed, locked, T_ss, tune})`.
  → **Router pure-weak branch must pass: the SAME `carrier`, `drivers = bodyDrivers`, `{macroSeed, locked, T_ss (pre-gate), tune: magmaDriversToTune(bodyDrivers)}` — argument-for-argument identical to :482.** No new `alea`, no pre/post-touch of `carrier.height`. Byte-identity is then automatic (literally the same call).

- **pure-strong** — `writeStagnantLidReliefSphere(carrier, drivers = {}, { macroSeed = 0, regime = 'venus-stagnant-lid', tune = null, randomPlacementControl = false } = {})`
  (stagnantLid.js:170-173). `void drivers` — **seed-only today** (:174). Today's call (planet-lod-rivers.js:491):
  `writeStagnantLidReliefSphere(carrier, grainDrivers, {macroSeed, regime: slRegime})`.
  → **Router pure-strong branch must pass: `drivers = grainDrivers` (DEFAULT_GRAIN_DRIVERS — NOT bodyDrivers), `{macroSeed, regime: slRegime}`, tune omitted (→null→DEFAULTS).** `slRegime = stagnantLidRegimeOf(archetype, locked)` (stagnantLid.js:78) resolves `'venus-stagnant-lid'`.
  **[V2-2a CONTRACT CORRECTION — must-fix #3, see contract AC-BYTE-STRONG-REF / AC-0]:** the ROUTER must
  **NOT** call `stagnantLidRegimeOf(archetype)` — that consumes a preset *label*, violating the signed
  "router consumes E1 coordinates, never labels" invariant. The router resolves the strong regime
  **archetype-free**: map the E1 coordinate `geodynamicRegime==='stagnant'` → the single V2-2a strong
  constant `'venus-stagnant-lid'`. `stagnantLidRegimeOf(archetype, locked)` is used **only in the TEST**
  to compute the expected regime value. A naive uniform bundle across both corners **breaks byte-identity** — the weak corner takes `bodyDrivers`+`T_ss`+`tune`, the strong corner takes `grainDrivers`+`regime`.

**Anchors + fixtures that assert it:**

| Anchor | Vector | Reference |
|---|---|---|
| `MAGMA_REF` | `{tidalHeating:0, age:4.5, massGravity:0.9}` (magmatism.js:93) — the tuner neutral point | AC-BYTE-WEAK-REF |
| Venus reference | Venus preset (`driver-presets.js`) | AC-BYTE-STRONG-REF |
| **real Lava / Magma** | `DRIVER_PRESETS['Lava (hot airless)']` / `['Magma …']` — non-null overrides + T_ss + locked | **AC-BYTE-LAVA / AC-BYTE-MAGMA (D3-MF3 — the shipped worlds the discipline actually protects)** |

- **75-golden harness** (tests/v2-0-byte-identity.test.js; fixtures/v2-0-carrier-golden.mjs:32,59) — hashes
  `['height','grainAngle','grainMag','regime','faultDensity']` over 15 presets × seeds `[1,2,3,7,42]` **through
  `writeBodyRelief`**. Un-wired router ⇒ these 75 stay byte-equal ⇒ **AC-ZERO-CLOBBER (plate/shell byte-diff)** for free.
- **NEW AC-BYTE tests** — dual-carrier `Float32Array`-equality (router-routed vs direct corner call), per the
  magmatism-structure "run twice" idiom (:78-85). Assert `carrier.height` + the corner diag arrays (`plumeId`, etc.).
- **AC-TUNE-NULL** — weak side `magmaDriversToTune(MAGMA_REF) === null` (already holds, magmatism.js:124).
  **The stagnant side `stagnantDriversToTune(Venus) === null` does NOT apply in V2-2a** — `stagnantDriversToTune`
  *does not exist today* (§3.2 #4b: stagnant is `void drivers`; building it is the from-scratch V2-2b response).
  So V2-2a's AC-TUNE-NULL is **weak-side only**.

---

## Q4 — THE SPLIT LINE: §5.3 AC table + §5.4 falsification + `primitiveId`

### §5.3 AC table, row by row

| AC | V2-2a / V2-2b | Reason |
|---|---|---|
| **AC1 determinism** | **SPLIT** | Router/corner determinism + reserve the `'lid:'` namespace = **V2-2a** (corners keep their own `'magma:'`/`'stagnant:'` streams; assert the router adds no new draw). The `'lid:strength:'`/`'lid:yield:'` draws (gate-2 PG-1) fire only in the mixed interior = **V2-2b**. |
| **AC-BYTE-WEAK-REF / AC-BYTE-STRONG-REF** | **V2-2a** | Both anchors byte-identical is the core V2-2a deliverable. |
| **AC-BYTE-LAVA / AC-BYTE-MAGMA** | **V2-2a** | Real preset vectors + T_ss pre-gate (D3-MF3). "Both anchors first" (§7a). |
| **AC-CONFORMANCE(FINE)** | **V2-2a** | The router classifier; a preset drifting into mixed fails. This is the V2-2a routing gate. |
| **AC-TUNE-NULL** | **SPLIT** | Weak `magmaDriversToTune(MAGMA_REF)→null` = **V2-2a**. Stagnant `stagnantDriversToTune(Venus)→null` = **V2-2b** (builder doesn't exist yet). |
| **AC-ORDER-MIX** | **V2-2b** | Mixed-interior absolute-datum province stack + edifice budget bound (§2.4). No mixed machinery in V2-2a. |
| **AC-MIX-DISCRETE** | **V2-2b** | Measured on the mixed `primitiveId` field; the mixed writer is V2-2b. |
| **AC2/AC3 structure + latitude-control** | **SPLIT** | At both anchors = **V2-2a** (corner output is byte-identical to shipped worlds that already pass these). At the mixed world = **V2-2b**. |
| **AC5 variety** | **V2-2b** | Mixed world differs per seed; pierce/tent mix. (Corner variety already shipped.) |
| **AC-ZERO-CLOBBER (siblings)** | **V2-2a** | Plate+shell gate suites + byte-diff; the 75-golden harness already carries it. Standing gate anchored in V2-2a. |
| **AC-0 (Rule 15 spine)** | **V2-2a** | Every world-engine contract carries it (see §7 below). |

### §5.4 falsification — ALL THREE worlds are V2-2b (confirmed against §7a)

- **#1 WET-STAGNANT** (primary mush-risk) → **V2-2b.** Needs the NEW stagnant-side response + `effectiveL`
  differentiation on `V`+T_surf. **Explicitly OPEN** per gate-2 §4 / §6 / Open-Q4: at raw `L≈0.16` the pierce
  boolean gives pervasive "Io-with-water," which *fails* §5.4 #1; closing it needs E1's seeded-`'stagnant'`
  pick to set a strong-band `effectiveL` **consumed by the mixed response** — V2-2b work.
- **#2 CORONA-PIERCED compound + interpenetration statistic** → **V2-2b.** The compound landform is mixed-interior
  machinery; the `Π=C·F` / `M` statistic (gate-3) runs on the mixed `primitiveId` field.
- **#3 THARSIS integration checkpoint** (hand-set D-vector) → **V2-2b.** The stationary-hotspot pile is the
  mixed-interior response (Mars routes *mixed*, gate-1 table:92).

Confirmed against §7a RESOLVED: split = *"router + both anchors first, stagnant response + mixed interior
second."* All three falsification worlds exercise the stagnant response / mixed interior → **V2-2b.** V2-2a,
touching only routing + byte-anchors, has **no falsification world of its own** (its "falsifier" is a broken
byte-anchor or a mis-classified preset — both headless).

### `primitiveId`: emit for the corner paths, or defer?

**Recommendation: V2-2a AUTHORS the instrument's *schema*; V2-2b POPULATES + MEASURES it.** Concretely:
- **V2-2a (cheap, byte-safe, de-risks the seam):** author + export the `primitiveId` **enum** and the
  **`familyOf` map** (PIERCE=1 / TENT=0) as constants **beside `writeLidResponseSphere`**, imported by both
  the (future) writer and the metric — gate-3 Open-Q1 requires this and warns "mis-assigning even one
  primitive shifts the axis"; Open-Q2 requires **lava-plain and stagnant-basaltic-plain be DISTINCT ids**.
  Pinning the enum now costs nothing and prevents a V2-2b lump. Optionally emit a **uniform per-node
  `primitiveId: Int32Array`** from the corner paths (pure-weak → one WEAK-family id, pure-strong → one
  TENT-family id) as a forward-compatible field.
- **Byte-safety:** `primitiveId` is a **NEW return/diag field, not one of the 5 hashed carrier fields**
  (`height/grainAngle/grainMag/regime/faultDensity`, golden.mjs:54) → emitting it cannot move a golden.
- **V2-2b:** the multi-valued mixed `primitiveId`, the recommended `centerId` co-emit (gate-3 Open-Q3), and
  the `Π/M` statistic + `PI_STAR/M_MAX` real-world freeze (gate-3 Open-Q6) — all where the mixed field exists.

Rationale for not doing the full emit in V2-2a: the corners are **single-family** (pure-weak = all PIERCE,
pure-strong = all TENT), so `Π` on them is trivially 0 (F=0, correct) and measures nothing; the instrument
only earns its keep on the mixed world. But the *enum/familyOf* is load-bearing schema that must not be
invented twice — pin it in V2-2a.

---

## Q5 — MIXED-VECTOR BEHAVIOR in V2-2a: the stub

**Fact that makes this low-risk:** **no shipped preset classifies `mixed`.** The 15 mapped presets route
pure-weak / pure-strong / off-pilot (gate-1 table:84-99); Mars is the only `mixed` body and it is
**oracle-excluded until V2-3** (no `PRESET_ARCHETYPE` mapping). A mixed classification is reachable in V2-2a
only by a hand-set lab / Mars D-vector. The `'lid:'` machinery is V2-2b.

**Recommend: explicit `unimplemented` marker (return-based), `carrier.height` LEFT UNWRITTEN.**
`writeLidResponseSphere` on a `mixed` fine-class returns e.g. `{ path:'lid-mixed', fineClass:'mixed', unimplemented:true }`
and does **not** touch `carrier.height`.

Byte-safety + why not the alternatives:
- **route-to-nearest-corner — REJECT.** It would call a corner writer for a body that is *not* a byte-anchor,
  fabricating a plausible-but-wrong world with no golden — and would **mask** a preset that accidentally drifts
  into mixed, defeating AC-CONFORMANCE(FINE)'s entire purpose. Latent clobber when V2-2b lands.
- **hard `throw` — acceptable but ergonomically worse.** A throw forces every classification test + any live
  probe into try/catch. Fine as a stricter variant if Max/verify prefer loud failure.
- **return-marker — PIN THIS.** (1) No shipped world reaches it ⇒ no golden movable. (2) Writes **no
  `carrier.height`** ⇒ honors §5.5 "V2-2a adds NO new height-writing machinery." (3) AC-CONFORMANCE(FINE)
  reads the fine-class cleanly (a hand-set mid-axis vector asserts `fineClass==='mixed' && unimplemented`).
  (4) V2-2b swaps the real mixed machinery in at exactly this branch — a clean seam.

---

## Q6 — UAT: which half carries the pilot card?

**V2-2b carries it. V2-2a carries NO UAT AC.**

The UAT-RUBRICS pilot card is **Increment 4 + 4b** (UAT-RUBRICS.md:150-160 — the doc predates the V2- split;
there is no a/b card). Every one of its basis-level criteria and red flags is about a **rendered world** —
"hotspots/coronae placed by the plume field," "elevation ordering," "distinct per seed," "Venus does NOT
fall to sin²(lat)." Those worlds (Lava/Magma via #4a, Venus via #4b) are **already shipped and already
UAT'd** — Max's AC9 basis-level PASS 2026-07-03 (Venus) and AC11 PASS (shell), both with the verbatim:

> *"These...look like the first steps toward the kinds of planets they're supposed to be. Very crude still.
> Landforms are pretty samey-looking (not necessarily between worlds but across the same world). This may be
> fine for this stage in the process."* → *"OK then, based on this description all pass."*
> (venus-stagnantlid verdict.json AC9:61; shell-relief verdict.json AC11:73)

That "samey **within** a world" feedback is **routed to V2-2b's stagnant response** (venus verdict AC9:61:
"owned by V2-2's stagnant-side response space") — i.e. it is a **V2-2b** design input, not a V2-2a one.

V2-2a produces **byte-identical** corner output to those already-UAT'd worlds and **no new visible world** →
by the omit-when-no-experience rule it gets **no UAT AC**. Its terminal gate is `verify-workstream` green
(byte-anchors + fine-class + AC-ZERO-CLOBBER + AC-0) → **VERIFIED**, no `VERIFIED_PENDING_MAX` hold. This
matches V2-0 (VERIFIED `0461463`, no UAT) and the plumbing character of V2-1. The §5.4 pilot UAT — does the
wet-stagnant world read coherent-not-"Venus-with-water," does the corona-pierced compound landform read
crisp — belongs to **V2-2b**.

---

## Q7 — AC-0 spine conformance for V2-2a (SPINE-CONFORMANCE.md, folded into every world-engine contract)

1. **Driver connectivity.** The router reads E1 coordinates (all D-slot-backed via V2-1 — L/Φ/V/n/m_hp from
   the AC-0 tables in V2-1 BUILD-NOTES §1) + `rawTidalIoRatio` (D12 raw) + `T_ss` (named derivation
   `locked?(T_eq??0)*1.4:0`). **No archetype-string input to the router** — it consumes E1 coordinates,
   never `label` (§1 invariant). Accepted debt to declare: **dispatch (`writeBodyRelief`) still routes on
   `PRESET_ARCHETYPE`** — but that is the *un-wired* seam, retired at V2-3; the router itself is archetype-free.
2. **Named consumer.** Every field `writeLidResponseSphere` emits has a named reader: `fineClass` →
   AC-CONFORMANCE(FINE) test (now); `primitiveId` + `familyOf` → V2-2b interpenetration statistic (gate-3);
   corner diag pass-through → existing `magmaProbe`/`stagnantLidProbe`. No dead fields.
3. **Taxonomy registration.** If V2-2a adds any lab control it registers in `planet-archetypes.js` (drift
   guards, tests/planet-archetypes.test.js). If the route probe is console/`_lab`-only (like V2-1's
   `e1RegimeWeights`), no `*Enabled` key ⇒ drift guards stay green with no taxonomy change.

---

## Signed constraints the contract MUST carry (violating any = NEEDS-FIX)

- Option-A router: pure-weak → `writeMagmatismSphere` UNCHANGED; pure-strong → `writeStagnantLidReliefSphere`
  UNCHANGED; byte-identity at both anchors AND real Lava/Magma/Venus (AC-BYTE-WEAK/STRONG-REF/LAVA/MAGMA);
  `T_ss` computed BEFORE the gate (D3-MF3, pass-through, planet-lod-rivers.js:476); corners pinned WITH MARGIN
  (Lava/Magma via `m_hp` +7.8e5/+7.6e7; L_STRONG=0.63 gives Venus +0.10, Mars −0.08).
- Subtractive gate (D3-MF1): unbroken-lid requires rocky/magma-ocean AND (heat-pipe edge OR hot-surface-stagnant
  edge) ONLY; Mars/despun stay on fallback; two despun destinations never conflated (shell 'eyeball-despun'
  for locked, final zonal fallback for unlocked — real Mars is unlocked → final despun, §5.1 note); label
  carve-out excludes authored exotics.
- Router consumes E1 coordinates, never labels; tidal-shoulder rule (PG-5: `L≥L_STRONG AND rawTidal<0.15`) +
  L_STRONG=0.63 ([0.60,0.66]) are the pinned boundary defaults; **lab-only, no dispatch flip (V2-3), no game wiring.**
- `'lid:'` namespace draws are mixed-interior only (V2-2b); **V2-2a adds NO new height-writing machinery** —
  mixed vectors → explicit-unimplemented marker, `carrier.height` unwritten (Q5).
- AC-TUNE-NULL (weak side), AC-ZERO-CLOBBER (75-golden + plate/shell byte-diff), Rule 15 AC-0, the 75-golden gate.
- Zero behavioral change for every shipped preset — pure routing/plumbing increment (V2-0 character) → **no UAT AC** (Q6).

---

## Open questions for the contract (genuinely unresolved — need Max/scoping or gate co-calibration)

1. **`primitiveId` scope at the a/b seam.** Recommend V2-2a author the enum + `familyOf` (+ optional uniform
   corner emit) and defer populate/measure to V2-2b (Q4). This borders V2-2b's instrument — confirm the split.
2. **`lidDriversToTune` naming.** The §5.3 AC table names `lidDriversToTune(MAGMA_REF)→null`; code has
   `magmaDriversToTune` (magmatism.js:113). Confirm the router reuses the existing `magmaDriversToTune` for the
   weak side (recommended — no new tune builder in V2-2a) rather than introducing a `lidDriversToTune` alias.
3. **Live probe inclusion.** Add a thin `_lab.lidRouteProbe()` shadow surface (AC7-style, integration/live,
   console-clean — NOT UAT), or stay headless-only? V2-2a renders nothing new, so it is optional.
4. **Mixed-detection test world.** Does AC-CONFORMANCE(FINE) in V2-2a *require* a hand-set mid-axis vector that
   asserts the `mixed`+`unimplemented` path fires (recommended, to lock the V2-2b seam), or only assert the 15
   real presets classify non-mixed?
5. **Marker vs throw** for the mixed stub — recommend return-marker (Q5); confirm Max/verify don't prefer a hard
   throw for loudness.
6. **`T_ss` delivery** — router receives precomputed `T_ss` in opts (recommended, byte-structural) vs recomputes
   `locked?(T_eq??0)*1.4:0` internally. Pin which, since byte-identity depends on matching planet-lod-rivers.js:476 exactly.
