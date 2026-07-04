# world-engine-v2-2b-1-stagnant-response-2026-07-04 — intent

**The first half of the V2-2b split** (§7a RESOLVED 2026-07-03; V2-2b re-split 2026-07-04, Max
approved). V2-2 (the pilot) split into **V2-2a** (router + both byte-anchors — DONE, VERIFIED `02cb221`
@ `0a7646b`) and **V2-2b** (mixed interior + stagnant response). V2-2b is XL+, so Max approved splitting
it AGAIN: **V2-2b-1 = the STAGNANT-side driver→expression MULTIPLY only**; V2-2b-2 = the mixed interior +
the 3 falsification worlds + the pilot UAT. **This increment is V2-2b-1 ONLY.**

It is the **direct analog of the shipped #4-MULTIPLY** (`world-engine-magmatism-multiply`, SHIPPED
2026-07-01) — but on the **STAGNANT** (pure-strong / Venus) corner instead of the **VOLCANIC** (pure-weak /
Lava-Magma) corner. #4-MULTIPLY built `magmaDriversToTune` (magmatism.js:113), mapping a body's D-vector to a
`tune` override anchored so `magmaDriversToTune(MAGMA_REF) === null` → byte-identical volcanic corner,
non-null elsewhere → more/bigger volcanoes. V2-2b-1 builds the **from-scratch `stagnantDriversToTune`**
(does **not** exist today — stagnantLid.js:174 is `void drivers`, seed-only) mapping drivers → a `tune`
override on `stagnantLid.js`'s `DEFAULTS`, anchored so `stagnantDriversToTune(VENUS_REF) === null` →
byte-identical Venus, non-null elsewhere → **within-world VARIETY** on stagnant worlds.

## Why we care

**Max's load-bearing UAT feedback is on the pure-strong corner** — the Venus stagnant-lid increment (#4b,
AC9, basis-level PASS 2026-07-03). His verdict, verbatim
(`world-engine-venus-stagnantlid-2026-07-01/verdict.json` AC9):

> *"These...look like the first steps toward the kinds of planets they're supposed to be. Very crude
> still. Landforms are pretty **samey-looking (not necessarily between worlds but across the same
> world)**. This may be fine for this stage in the process."* → *"OK then, based on this description all
> pass."*

The load-bearing phrase is **"samey-looking … across the same world"** — **within-world** sameness. The
Venus verdict routes that phrase EXPLICITLY (AC9 adjudication, same file):

> *"Within-world sameness is the KNOWN seed-only-BROADEN limitation, **owned by V2-2's stagnant-side
> response space** (ROADMAP-v2 disposition #4b)."*

**`stagnantLid.js` today is `void drivers` (stagnantLid.js:174) → every stagnant world is a re-rolled
Venus by seed** — EXACTLY Max's original catalog-bounded-variety fear (ROADMAP-v2 §0: *"every stagnant-lid
world is a re-rolled Venus"*). **V2-2b-1 builds the response mechanism that fixes it:** a body's real
formation drivers (dryness `V`, surface temperature `T_surf`, thermal state / age) now shape *how many* and
*which kind of* provinces appear — so a wet-and-cooler stagnant world reads with less preserved tessera,
more resurfaced plains, and a different corona population than dry-hot Venus, instead of a re-rolled Venus.

**⚠ Honesty flag carried up front (it shapes every success criterion + AC below).** The 75-golden
byte-identity constraint forces `stagnantDriversToTune(VENUS_REF) === null` where **`VENUS_REF` = Venus's
REAL preset drivers** (driver-presets.js:47) — Venus is the *only* stagnant preset in the golden (captured
`7441c92`, NEVER re-captured). So the shipped **Venus preset stays byte-identical**, and V2-2b-1 does **NOT**
change Venus's *own* within-world texture. This is a **stronger** anchor than #4-MULTIPLY, where `MAGMA_REF`
was a synthetic-neutral point *off* the real Lava/Magma vectors and those presets *did* respond. Here the
shipped preset **is** the reference. **So the AC9 answer V2-2b-1 delivers is: "the response space exists,
and a driver-VARIED stagnant world reads varied within itself and distinct from Venus" — NOT "Venus
changes."** The within-world variety lands on driver-varied worlds (the lab sliders now; the wet-stagnant
falsification world at V2-2b-2), not on the shipped Venus preset. Re-tuning Venus *itself* to read less
samey would move the golden = a separate look-tuning decision, out of V2-2b-1's zero-clobber scope. **Open
for Max: confirm this framing is the accepted AC9 fix.**

## Success criteria (Max's language — each names the input × the observable)

- **A stagnant world's landforms track its dryness + temperature, not just a seed.** *Input:* at a **fixed
  seed**, sweep the dryness `V` / surface-temperature `T_surf` driver from Venus-like (dry, hot) toward
  wet-and-cooler. *Observable:* the surface visibly changes — a drier/older world shows **more preserved
  tessera plateaus**; a wetter/younger/hotter world shows **fewer tessera, more resurfaced plains, and a
  more active corona population** — one stagnant world becomes a *different* stagnant world (fixes "every
  stagnant world is a re-rolled Venus"). *(Lab/UAT reachability, honesty note — finding 4: `V` (the
  existing **volatiles** slider) and `T_surf` (the NEW control, overriding nested `condition.T_eq`) are
  lab-drivable; **`age` has NO lab slider** — "age descoped Inc.2", planet-lod-lab.html:2684 — so the
  **age half** of the tessera response is a **headless-only** assertion (AC-TUNE-RESPONSE synthetic
  vectors), and the **live/UAT** tessera variety rides on `V` dryness + `T_surf`. AC-LAB must confirm the
  V-alone/T_surf tessera response is visible enough to carry the live gate without age.)*
- **A driver-varied stagnant world reads varied WITHIN ITSELF — not samey.** *Input:* view a driver-varied
  stagnant world (sliders off Venus). *Observable:* distinct provinces read side by side — tessera plateaus
  beside active coronae beside resurfaced plains — instead of one uniform texture repeated everywhere (the
  direct answer to *"samey-looking … across the same world"*).
- **The worlds still read as stagnant-lid worlds, coherently.** *Input:* any driver vector. *Observable:*
  tessera is still the highest, oldest crust; plains the young background; rifts the lows — the elevation
  ordering (`tessera > plains > rift`) and the plume-organized (not latitude-banded) structure the #4b UAT
  already accepted **never break**. The fix adds variety; it doesn't break the #4b skeleton.
- **Nothing else regresses; Venus itself is byte-identical.** *Input:* the shipped presets + the neutral
  Venus reference. *Observable:* Venus, and every plate / icy / volcanic world, render byte-for-byte
  unchanged — this is a MULTIPLY on top of the validated Venus skeleton at the neutral reference, not a
  rewrite (honesty flag above: Venus staying byte-identical is a *requirement*, not a limitation to fix
  here).

## DOES / UNLOCKS card (Rule 15; edges read from the ROADMAP-v2 §3.1 DAG + the #4-MULTIPLY precedent, not invented)

**What it DOES** (each output × what sets it × its named consumer):

| V2-2b-1 output | set by (input → derivation) | read by (named consumer) |
|---|---|---|
| `stagnantDriversToTune(drivers)` → `null` \| `{TESSERA_FRAC, CORONA_ACTIVE_FRAC, CORONA_POOL, PLUME_MIN}` override — a **pure** DEFAULTS-override fn, ZERO alea draws | the body D-vector — **`V` (dryness) + `g` read FLAT** (`drivers.volatileFraction`, `drivers.massGravity`), **`T_surf` + `age` read NESTED** (`drivers.condition.T_eq`, `drivers.condition.age` — the sanctioned Slice-C read surface, writeBodyRelief:449-451; `thermalState` flat): `V` + `age` → `TESSERA_FRAC`; `thermalState`/`T_surf` → `CORONA_ACTIVE_FRAC`; vigor + `V` → `CORONA_POOL`; vigor → `PLUME_MIN`. Deviation-from-`VENUS_REF` signals + exact-only identity guard (mirror magmatism.js:124-127) → `null` at `VENUS_REF` | `AC-TUNE-NULL` / `AC-TUNE-RESPONSE` **now**; V2-3 threads it into the router; V2-2b-2 reuses it inside the mixed interior |
| `VENUS_REF` exported `Object.freeze` = Venus's real preset read-slots `{volatileFraction:0.02, massGravity:0.815/0.95²≈0.90304709 (EXACT live-derive, NOT rounded 0.903), T_eq:737, age:4.5}` (driver-presets.js:47) | authored constant (the null point — analog of `MAGMA_REF` magmatism.js:93, but **ON** the real preset, not off it) | `AC-TUNE-NULL` / `AC-BYTE-VENUS`; the byte-identity anchor |
| `carrier.height` REPLACE via the **UNCHANGED** `writeStagnantLidReliefSphere` writer through its existing `tune` seam (stagnantLid.js:175) — byte-identical at `VENUS_REF`, population-shaped elsewhere | `tune` = `stagnantDriversToTune(bodyDrivers)`; population knobs only, `BASE_*` floors + amplitudes untouched | the render + the diag arrays (`isTessera`, `coronaActive`, `resurfAge`, `foldAngle`) → `stagnantLidProbe` + the structure test's arm's-length predictors |
| `stagnantDiag.appliedTune` (resolved tune, `null` at `VENUS_REF`) | dispatch edit (planet-lod-rivers.js:489-491, mirror the volcanic wiring :481-483) | `stagnantLidProbe` + `AC-LAB` objective sweep readout |
| lab: a NEW `T_surf` control (overrides nested `condition.T_eq` — the read surface; NOT a flat key) + a `'Body drivers → stagnant relief (V2-2b-1)'` folder (mirror the #4-M `fMagmaDrivers` folder, planet-lod-lab.html:3833); the EXISTING `volatiles` slider (planet-lod-lab.html:3814) already drives `V` | `driverOv` / `_driverAbMode` plumbing (reused); T_surf overlay onto `condition.T_eq` in buildBodyDrivers | `AC-LAB` (agent-drivable) + `AC-UAT` (Max) — **no `age` slider** (headless-only) |

**What it UNLOCKS:** **V2-2b-2** — the mixed-interior + falsification-world half **reuses the tested
`stagnantDriversToTune` response** inside (a) the `mixed`-branch interior (the reserved `'lid:'` namespace
`'lid:strength:'`/`'lid:yield:'` draws, the per-center pierce, the absolute-datum province stack, the
`primitiveId` populate + `Π=C·F` statistic) and (b) the **wet-stagnant falsification world** (§5.4 #1 —
the very driver-varied stagnant world this increment's mechanism renders), the corona-pierced compound
(§5.4 #2), the Tharsis integration checkpoint (§5.4 #3), and the **pilot UAT**. **V2-3** — the dispatch
flips to read the V2-2a router (`classifyLidPath`), which will thread this stagnant tune at the pure-strong
branch. Per §3.1, V2-2 as a whole unlocks the *"pierce↔tent↔flood continuum"* and the *"wet-stagnant"*
worlds — **V2-2b-1 builds the stagnant-response *mechanism* those worlds consume; V2-2b-2 renders +
falsifies them.**

## Program context / line of sight

Serves the north star — **the count of genuinely distinct, history-coherent worlds visible per minute**
(ROADMAP-v2 §0) — by giving stagnant worlds a *causal within-world response* to their real formation
drivers instead of a uniform seed re-roll. **JOURNEY milestone = the SCREENSAVER world-variety arc.**

**This is the first stagnant-side increment that renders a NEW within-world-varied stagnant experience** —
unlike V2-2a (pure routing/plumbing, zero player-visible change) and V2-0, V2-2b-1 produces a *rendered,
UAT-able* stagnant surface that varies with drivers, visible in the lab on driver-varied worlds and carried
by a **real uat AC** (the direct AC9 answer). It is therefore the first pilot half to touch the
**PLAYER_EXPERIENCE** tier on the stagnant corner. **With the honesty flag above:** that touch is on
driver-VARIED stagnant worlds (the lab sliders now; the wet-stagnant world at V2-2b-2) — the shipped Venus
preset stays byte-identical, so the shipped-*game* payoff on a stagnant preset lands when V2-2b-2 adds the
wet-stagnant falsification world. V2-2b-1 builds + proves + UAT-exposes the response space that payoff
depends on.

## Deliberate non-goals (scope fence — everything below is V2-2b-2, verbatim-explicit)

Confirmed against §7a RESOLVED (*"stagnant response + mixed interior second"*) + the V2-2a intent's
"Deliberate non-goals" (this increment takes the **stagnant-response mechanism slice** ONLY):

- **The mixed interior — RESERVED.** The `'lid:'` alea namespace (`'lid:strength:'`/`'lid:yield:'` draws,
  gate-2 PG-1) stays **unused** — the assertion of **zero `'lid:'` draws** (V2-2a's
  `tests/worldengine-lid-router-audit.test.js`) must still hold. V2-2b-2 fills it.
- **The per-center pierce boolean** `strength_p·Φ > localYield(L, p)` (gate-2). No `localYield`, no `Φ`
  consumption — `stagnantDriversToTune` reads the body D-vector (`V`/`g` flat + `T_surf`/`age` nested under
  `condition`), not the pierce mechanism.
- **The absolute-datum province stack + edifice budget bound** (`AC-ORDER-MIX`, ROADMAP-v2 §2.4 / §5.3).
  V2-2b-1 keeps the shipped **constant-floor** stack (population knobs only); it does NOT build the mixed
  absolute-datum stack.
- **The multi-valued `primitiveId` populate + `centerId` co-emit + the gate-3 `Π=C·F` interpenetration
  statistic** (ROADMAP-v2 §5.4 #2; V2-2a authored only the schema). Not touched here.
- **The 3 falsification worlds** — wet-stagnant (§5.4 #1), corona-pierced compound (§5.4 #2), Tharsis
  integration checkpoint (§5.4 #3). V2-2b-1 builds the *mechanism* the wet-stagnant world will use; V2-2b-2
  renders + falsifies all three.
- **`effectiveL` consumption — EXPLICITLY OUT.** `effectiveL` (e1Regime.js:198,229 — the gate-2 §4
  R-wetstag hand-up, emitted on seeded-`'stagnant'` picks) is consumed by the **mixed** response (V2-2b-2),
  **NOT** by this pure-strong MULTIPLY. `stagnantDriversToTune` reads the body D-vector (`V`, `g` FLAT;
  `T_surf`, `age` NESTED under `condition`) → a `DEFAULTS` override; it does **not** read `effectiveL`,
  `L`, `Φ`, `n`, or `m_hp`.
- **No dispatch flip to the E1 router** (V2-3): threaded at the SHIPPED dispatch seam
  (planet-lod-rivers.js:489-491), NOT into the V2-2a router (`lidResponse.js`, byte-identical this
  increment). **No game `Planet.js` port** (V2-10). **No palette/shader.** **No Venus-itself re-tune** (would
  move the golden — honesty flag).
