# MVP spine 3 of 3 — the Phase-5 integration couplings

**What this is.** Max ruled on 2026-08-06 that MVP is bigger than F1–F53
(`one-pipeline-two-frontends-PLAN.md:599-605`): it also includes the lab quality backlog and
**the Phase-5 integration couplings**. This file is the enumeration of that third spine, which had
never been listed, and which is why MVP was not closable.

**Scope of the spine — 69 items:**

| Block | Count | Source | IDs |
|---|---|---|---|
| The audit's 52 cross-feature gaps, sequenced WS1–WS5 | 52 | `feature-interaction-audit-2026-06-20.md:93-146` (appendix) + `planet-lod-phase5-integration-plan.md:115-168` (WS mapping) | **invented** `P5-G01`…`P5-G52` |
| The I-check acceptance layer | 15 | `cards/INTEGRATION.md:16-74` | source's own `I-1`…`I-15` |
| Cross-cutting: re-derive `ASSOCIATIONS.dependsOn` | 1 | `planet-lod-phase5-integration-plan.md:73` | source's own `X` |
| Orogenic drainage-corridor co-genesis (mountains↔rivers) | 1 | `planet-lod-phase5-integration-plan.md:97-106` | source's own `WS4-7` |

**IDs.** The 52 gaps carry **no IDs in either source** — the audit and the plan both key them by
edge name (`craters × rivers`). `P5-G01`…`P5-G52` are **invented here**, numbered in the audit
appendix's own row order (which is its severity × tractability ranking, not alphabetical) so the
number is stable and back-traceable to a row. `I-1`…`I-15`, `X` and `WS4-7` are the sources' own.
`WS4-7` is **not one of the 52** — the plan is explicit that co-genesis is a *vertical* axis
invisible to the 84-edge matrix (`:52-57`), so it is enumerated separately and does not change the
tally.

---

## How the statuses were determined

**LAB status** — read against the lab pipeline as it stands on `feature/world-engine-production-L1`
at `92277c6`: `planet-lod-height.glsl.js`, `planet-lod-shaders.glsl.js`, `planet-lod-lab.html`,
`planet-lod-rivers.js`, `planet-lod-tectonic.js`, `planet-lod-uniforms.js`.

- **BUILT** — the coupling's mechanism is present *in executed code* and on by default in the lab.
- **PARTIAL** — a mechanism exists but is one-directional, mask-only, default-off, or shares an
  input rather than the output the audit asked for.
- **UNBUILT** — no coupling code. Established by a code-vs-comment separated probe (below).
- **UNKNOWN** — the mechanism exists but whether it *reads correctly* is a render question I did
  not answer. Named explicitly, with what would settle it.

**GAME status** — `ABSENT` for all 69, on two independent grounds, both verified:

1. **The lab material does not ship.** `src/rendering/LabPlanetMaterial.js:2-3` does import the lab
   shader and uniforms, but its only call site is the debug hook `tryLabShader(index)`
   (`src/main.js:2409-2439`), whose own docstring reads *"Defaults only — no condition driving."*
   No production body renders through it. Every coupling that lives in the lab shader is therefore
   unreachable in the game regardless of its lab status.
2. **A coupling needs both endpoints, and the game has almost none of them.** The game's own planet
   material declares 45 uniform names (`src/objects/Planet.js`). None of `river`, `lake`, `dune`,
   `dust mantle`, `glacial`, `sublimation`, `karst`, `chaos`, `scarp`, `canyon`, `plateau`,
   `tessera`, `cryoRidge`, `outflow`, `delta`, `massWasting`, `magma`, `airglow`, `sunglint`,
   `lightning`, `vortex` or `snowline` appears at all.

Two game-side structural notes worth carrying, because they are stronger than "not wired yet":

- `hex(11) / shattered(12) / crystal(13) / fungal(14) / machine(15) / city-lights(16) /
  ecumenopolis(17)` are **mutually exclusive `else if (planetType == N)` branches**
  (`src/objects/Planet.js:951-1140`). `P5-G31` (hexTess × shatter) and `P5-G23`
  (ecumenopolis × cityLights) cannot co-occur on one game body **by construction** — the game is
  not "missing the wire," it forbids the pair.
- The game's frost is a whole-body scalar mix — `surfaceColor = mix(ground, uIceColor, uIcenessMix)`
  (`:771`) — with no latitude, altitude or crater term. That settles the game side of every
  `× frost` and `frost ×` row.

### ⚠ Two traps this pass had to walk around, recorded so the next pass does not fall in

**Trap 1 — comments that read like couplings.** A naive term-probe of the relief combiners "found"
craters in `edificeCombiner`, chaos in `cryoRidgeCombiner`, dust in `duneCombiner` and frost in
`glacialCombiner`. Re-running the probe with comment lines stripped, **all but the frost one were
prose**. This is the same failure mode as the F26 `uWeatheredColor` mis-match. Every UNBUILT verdict
below comes from the comment-stripped probe.

**Trap 2 — "true and misleading" default values.** The shared tectonic grain field (below) is real,
executed code. Its **production uniform default is `uTectonicGrainStrength: { value: 0.0 }`**
(`planet-lod-uniforms.js:191`), which branches every grained combiner back to its pre-WS4 verbatim
independent axis. It is the **lab** that sets it live to `1.0` (`planet-lod-lab.html:1442`,
`:1448`). So "canyons and scarps share a lineament field" is **entirely true and entirely
misleading** if said without the default: true in the lab, inert at the shipped default.

---

## The tracker's claim, checked

`planet-lod-campaign-tracker.md:23` says of Phase 5: *"Each WS scoped via `dev-collab-scope` when
built (**none built yet**)."* That is **substantially right and materially stale**.

**Right:** no WS was ever scoped or built as a WS. `docs/WORKSTREAMS/` contains no `ws1`…`ws5`
integration directory; `cards/INTEGRATION.md:79` still reads `I-1 … I-15: (pending)`; and
`docs/FEATURES/cards/shots/` holds **314 screenshots, zero** matching `INT-*`. The acceptance lap
has never been run.

**Stale:** three of the audit's named remedies were built **incidentally**, by world-engine
workstreams that were not aiming at Phase 5, between the audit (2026-06-20) and today. 102 commits
touched the coupling-bearing files in that window. Specifically:

1. **A shared tectonic lineament field now exists and six relief combiners read it.**
   `uTectonicGrainCube` + `sampleGrainStrike()` (`planet-lod-height.glsl.js:145-198`) is consumed at
   eight sites: orogeny/mountains `:960-961`, canyons `:2326-2327`, scarps `:2369-2370`, tessera
   `:2524`/`:2534`, lava `:2616-2617`, cryoRidge `:3058`/`:3071`. The audit's fix line for
   `canyons × scarps` was verbatim *"a shared tectonic lineament generator both combiners read"*
   (`feature-interaction-audit-2026-06-20.md:123`). That generator is built.
2. **A rivers→relief incision feedback exists** (`carveEpoch` / `perNodeIncision` / `applyIncision`,
   `planet-lod-lab.html:6241-6253`), bearing on the router-re-route prerequisite.
3. **Grain is a precondition of height generation** — `writeGrainSphere(carrier, grainDrivers)` runs
   *before* `writeHeightSphere(...)` (`planet-lod-rivers.js:664-665`), which invalidates the
   premise the plan's co-genesis section was written on.

⛔ **Beware the WS-number collision.** `planet-lod-rivers.js:1435` ("WS4 T8"),
`planet-lod-height.glsl.js:2325` ("WS4 T13") and `tests/ws4-grain-*.test.js` refer to the
**rivers/world-engine** workstream's WS4, **not** Phase-5's WS4. Nothing in the tree is tagged with
a Phase-5 WS number.

---

## The 52 gaps

`Sev` and `Tract` are the audit's own. `WS` is the plan's sequencing. `Lab` / `Game` per the legend ⭐ **`QB` is the CROSS-SPINE INDEX added 2026-08-20 (B0 item 6 of `comprehensive-wiring-plan-2026-08-20.md`); this file previously contained zero `QB-` strings.** ⭐⭐ **The column is almost entirely `—`, and that is the finding, not a gap in the work:** spine 3 is 52 EDGES over spine-1 NODES, spine 2 is 14 quality VERDICTS over the same nodes, and the two intersect in exactly **three rows** — `P5-G27` (canyons × scarps), `WS4-7` (orogenic drainage co-genesis) and part of `P5-G14` (lava × mountains), all three meeting **QB-7** at the one `grainStrength` 0-vs-1 render this document already calls its highest-leverage measurement (`:272-273`). ⛔ No pairing here is inferred from a title match; a coupling and a quality complaint that merely mention the same feature are not the same item.
above.

### WS1 — Keystone: surface per-basin `filled` (5 gaps, +2 it unblocks in WS3)

Verified UNBUILT as a block, one piece of evidence: the router still computes per-basin pour-point
levels (`priorityFlood()` → `filled`, `planet-lod-rivers.js:762-782`, closed over by `surf` at
`:822-824`, returned at `:942`) and the shader still cuts standing liquid at global sea level only —
`liquidMask = smoothstep(uSeaLevel + 0.02, uSeaLevel - 0.02, h) * provinceWeight(PROV_LAKES)`
(`planet-lod-shaders.glsl.js:375`). The identifiers `fillLevel`, `basinFill`, `uFill` and
`pourPoint` **do not occur anywhere in the tree**. The audit cited this cut at
`planet-lod-lab.html:435`; the GLSL has since been extracted to its own module, so that line
reference is stale but the code is unchanged in substance.

| ID | Coupling | Sev | Tract | Lab | Game | Evidence / blocked on | QB (spine 2) |
|---|---|---|---|---|---|---|---|
| P5-G01 | craters × rivers | 4 | wireable-now | UNBUILT | ABSENT | `planet-lod-rivers.js:762-782,942` computes `filled`; `planet-lod-shaders.glsl.js:375` discards it. Game has craters (WE-driven) but no rivers at all. | — |
| P5-G02 | craters × lakes | 4 | wireable-now | UNBUILT | ABSENT | Same root. Game's only standing water is the type-branch ocean; no per-basin datum. | — |
| P5-G03 | rivers × lakes | 3 | wireable-now | UNBUILT | ABSENT | Same root. Neither endpoint in the game. | — |
| P5-G13 | lakes × deltas | 2 | wireable-now | UNBUILT | ABSENT | Same root — deltas need an elevated-lake datum. Neither endpoint in the game. | — |
| P5-G20 | karst × lakes | 1 | wireable-now | UNBUILT | ABSENT | Same root. `karstCombiner` (`planet-lod-height.glsl.js:1209`) writes `canyonHeight`, never reads a fill level. | — |

### WS2 — Wire-now batch (18 gaps)

The optical rows share one structural piece of evidence: the fragment shader's final composite is a
**pure additive sum of thirteen independently-computed channels** —
`surface + emissive + specC + limbC + termC + cloudC + auroraC + airglowC + cloudOpticsC + bioC +
machC + cityC + ecuC` (`planet-lod-shaders.glsl.js:1383`). No optical channel modulates another.

| ID | Coupling | Sev | Tract | Lab | Game | Evidence / blocked on | QB (spine 2) |
|---|---|---|---|---|---|---|---|
| P5-G38 | clouds × sunglint | 2 | wireable-now | UNBUILT | ABSENT | Glint block `planet-lod-shaders.glsl.js:1260-1268` — `spec` is gated on `uSpecStrength`, `liquidMask`, `provinceWeight(PROV_GLINT)`, `uLodRamp`. No cloud term. Game has clouds but no sunglint uniform. | — |
| P5-G39 | clouds × cityLights | 1 | wireable-now | UNBUILT | ABSENT | `cityC` block `:1029-1043` — masked by `cityLand`, `cityCoast`, `cityFbm`, `cityNight`. No cloud term. Game's city-lights is exclusive type 16. | — |
| P5-G40 | clouds × terminator | 1 | wireable-now | UNBUILT | ABSENT | `termC` `:952-958` reads `uTermColor/uTermStrength` and `veilTint` (F16 dust) only. | — |
| P5-G41 | clouds × limb | 1 | wireable-now | UNBUILT | ABSENT | `limb = pow(1-dot(N,V), uLimbExponent) * uLimbStrength * (diff+0.15)` `:939-940`. No cloud term. | — |
| P5-G45 | lava × frost | 1 | wireable-now | UNBUILT | ABSENT | `frostCover` `:447` is modulated by exactly one thing: `frostCover *= 1.0 - liquidMask` `:452`. No lava term. | — |
| P5-G46 | bioMats × frost | 1 | wireable-now | UNBUILT | ABSENT | Same line — no bio term either. | — |
| P5-G11 | lakes × bioMats | 2 | wireable-now | UNBUILT | ABSENT | Comment-stripped probe: **zero** code lines pairing any `uBio*` with `liquidMask`/`uSeaLevel`. | — |
| P5-G10 | lakes × dunes | 2 | wireable-now | UNBUILT | ABSENT | Zero code lines pairing `uDune*` with `liquidMask`/`uSeaLevel`. | — |
| P5-G31 | hexTess × shatter | 1 | wireable-now | UNBUILT | ABSENT | Zero code lines pairing `uShat*` with `uHex*`. Game: **mutually exclusive types 11 vs 12** (`Planet.js:951-1140`) — structurally impossible, not merely unwired. | — |
| P5-G36 | weatherBands × dustStorm | 1 | wireable-now | UNBUILT | ABSENT | Zero code lines pairing band terms with `uDustStorm*`. ⚠ The game *does* scale its own rocky dust storm by `cloudDensity` (`Planet.js:890`) — that is the game's own dust/cloud code, **not** this F24×F40 pair. Do not score it. | — |
| P5-G37 | jets × greatSpot | 2 | wireable-now | UNBUILT | ABSENT | Zero code lines pairing `uJet*`/`jetSoloMask` with spot terms. | — |
| P5-G52 | lightning × dustStorm | 1 | wireable-now | UNBUILT | ABSENT | Zero code lines pairing lightning with `uDustStorm*`. Game has neither. | — |
| P5-G22 | magma × lava | 2 | wireable-now | PARTIAL | ABSENT | Audit's one-directional verdict unchanged; probe finds zero new code lines pairing `uMagma*`/`mgSeaMask` (`:480`) with `uLava*`. | — |
| P5-G21 | magma × terminator | 1 | wireable-now | PARTIAL | ABSENT | Unchanged; `termC` `:952-958` carries no magma term. Plan flags this row **low value**. | — |
| P5-G15 | dunes × craters | 2 | wireable-now | PARTIAL | ABSENT | Unchanged; zero code lines pairing `uDune*` with `uCrater*`. Plan flags **low priority — already emergent**. | — |
| P5-G17 | airglow × limb | 2 | wireable-now | PARTIAL | ABSENT | Confirmed still masked-only: `airglowC = uAirglowColor * (limb * nightMask * uAirglowIntensity) * provinceWeight(PROV_AIRGLOW)` `:1348` reuses the `limb` **scalar** and nothing else. ⚠ Plan says *partly by design* — **needs Max's ruling on whether the deliberate layering stays** before this row can be scoped. | — |
| P5-G48 | aurora × nightsideThermal | 1 | wireable-now | UNBUILT | ABSENT | Additive composite `:1383`. Plan flags **cosmetic**. | — |
| P5-G49 | airglow × nightsideThermal | 1 | wireable-now | UNBUILT | ABSENT | Additive composite `:1383`. Plan flags **near-moot — disjoint `rendersOn`**. | — |

### WS3 — Resolve-pass / re-order (10 gaps, one shared with WS5)

| ID | Coupling | Sev | Tract | Lab | Game | Evidence / blocked on | QB (spine 2) |
|---|---|---|---|---|---|---|---|
| P5-G26 | glacial × lakes | 2 | resolve-pass | UNBUILT | ABSENT | **Blocked on WS1** (needs the fill datum) + negative-carve. | — |
| P5-G34 | outflow × lakes | 1 | resolve-pass | UNBUILT | ABSENT | **Blocked on WS1** + head anchoring. `outflowCombiner` `:1108` writes `canyonHeight`; no fill read. | — |
| P5-G14 | lava × mountains | 2 | resolve-pass | **PARTIAL ↑** | ABSENT | **Materially changed since the audit.** `lavaCombiner` `:2616-2617` and orogeny/`fbmdRidged` `:960-961` now *both* derive their axis from `sampleGrainStrike`. That is a shared **orientation**, not the "flows follow accumulated relief" resolve-pass the audit asked for — so still PARTIAL, but for a different reason than recorded. | **QB-7** (part) |
| P5-G09 | machine × craters | 2 | resolve-pass | UNBUILT | ABSENT | Zero code lines pairing `uMach*` with `uCrater*`. Game: machine is exclusive type 15. | — |
| P5-G08 | magma × edifices | 2 | resolve-pass | PARTIAL | ABSENT | Audit's masked-only verdict unchanged. | — |
| P5-G24 | edifices × craters | 2 | resolve-pass | UNBUILT | ABSENT | `edificeCombiner` `:2578+`: the two "crater" hits inside it are **comments** (`:2571`, `:2576`). No code read. | — |
| P5-G44 | plateaus × canyons | 1 | resolve-pass | UNBUILT | ABSENT | `plateauCombiner` `:2474` reads neither `canyonHeight` nor a canyon axis. | — |
| P5-G32 | karst × rivers | 1 | resolve-pass | UNBUILT | ABSENT | Needs karst injected into the router **plus a re-route** — same prerequisite as P5-G12. | — |
| P5-G18 | glacial × frost | 2 | wireable-now | PARTIAL | ABSENT | Confirmed masked-only, precisely: `glacialCombiner` `:3182-3189` **recomputes** the cold-cap field from the same `uFrostLocked` / `uFrostLatitudeBias` / `uFrostCondensationT` / `uFrostLapseRate` / `uPlanetTempEq` uniforms that `frostCoverage` `:3240-3247` uses. Shared **gate**, no shared volatile **budget**. | — |
| P5-G19 | sublimation × frost | 2 | wireable-now | PARTIAL | ABSENT | Same pattern — the sublimation block mirrors `frostCoverage`'s field by construction (`planet-lod-height.glsl.js:3097`, `:3105`). Group with P5-G18 as one volatile-budget item. | — |
| P5-G06 | glacial × mountains | 3 | view-LOD | PARTIAL | ABSENT | Audit's one-directional verdict; WS3 grad-bias half + **WS5↗** U-valley carving half. Both open. | — |

### WS4 — Architecture (17 gaps, each sub-item its own design pass)

| ID | Coupling | Sev | Tract | Lab | Game | Evidence / blocked on | QB (spine 2) |
|---|---|---|---|---|---|---|---|
| P5-G27 | canyons × scarps | 2 | needs-arch | **PARTIAL ↑ / UNKNOWN** | ABSENT | **The audit's named fix is built.** Its fix line: *"a shared tectonic lineament generator both combiners read"* (`audit:123`). `canyonCombiner` `:2326-2327` and `scarpCombiner` `:2369-2370` both mix toward `sampleGrainStrike(pos)` under `uTectonicGrainStrength`. ⚠ Lab-live 1.0 (`planet-lod-lab.html:1442`), **production default 0.0** (`planet-lod-uniforms.js:191`). What is shared is orientation, not geometry — **UNKNOWN whether canyon walls now read as scarp escarpments**; settled by one lab render at grain 0 vs 1 on a canyons+scarps preset. | **QB-7** |
| P5-G28 | plateaus × scarps | 2 | needs-arch | UNBUILT | ABSENT | Half the pair only: `scarpCombiner` reads the grain field, `plateauCombiner` `:2474` does **not** (the eight `sampleGrainStrike` call sites are `:960, :2326, :2369, :2524, :2534, :2616, :3058, :3071` — plateau is absent). Cheapest remaining partition win. | — |
| P5-G29 | tessera × plateaus | 2 | needs-arch | UNBUILT | ABSENT | Same shape inverted: tessera reads grain `:2524`/`:2534`, plateau does not. | — |
| P5-G30 | chaos × cryoRidge | 2 | needs-arch | UNBUILT | ABSENT | Same shape: cryoRidge reads grain `:3058`/`:3071`, `chaosCombiner` `:2743` does not. | — |
| P5-G04 | dustStorm × dust | 3 | needs-arch | UNBUILT | ABSENT | **Blocked on the writable feedback buffer**, which does not exist — no ping-pong / redeposit machinery anywhere in the render path. | — |
| P5-G42 | daysideThermal × clouds | 2 | needs-arch | UNBUILT | ABSENT | Same missing buffer (hotspot cloud-clearing). | — |
| P5-G05 | edifices × lava | 3 | needs-arch | UNBUILT | ABSENT | **Blocked on lava-as-fluid routing.** `edificeCombiner`'s `uLava` hits are comments (`:2598`, `:2602`). | — |
| P5-G25 | lava × rivers | 2 | needs-arch | UNBUILT | ABSENT | Same lava-as-fluid prerequisite. | — |
| P5-G12 | rivers × massWasting | 2 | needs-arch | **PARTIAL ↑ / UNKNOWN** | ABSENT | **The router-re-route prerequisite moved.** `carveEpoch` + `perNodeIncision` + `applyIncision` (`planet-lod-lab.html:6241-6253`, "WS4 T12") is a real rivers→relief incision feedback. But it is applied to a **readback probe field**, not the rendered chain — the code says so at `:6247-6249` (*"the ROUTER_MAIN field the carve is computed over, NOT a rendered-chain sample (that is the deferred T12b)"*), and it is a one-shot incision, not a re-route. UNKNOWN how much of the WS4-1 design pass this retires; settled by reading the T12b deferral. | — |
| P5-G07 | frost × craters | 2 | needs-arch | UNBUILT | ABSENT | **Blocked on the insolation/aspect term.** ⚠ `wardInsolation()` exists at `src/worldengine/base/climate-e5.js:104` — that is the annual-mean **latitude** insolation driving gas-giant banding, **not** a per-cell sun-axis·slope proxy. Do not match it to this row. | — |
| P5-G43 | sublimation × craters | 1 | needs-arch | UNBUILT | ABSENT | Same missing aspect term. | — |
| P5-G35 | dust × dunes | 1 | needs-arch | UNBUILT | ABSENT | **Blocked on a shared sediment-supply buffer.** `duneCombiner` `:1272`: its `dust` hits are all comments (`:1299-1324`). | — |
| P5-G33 | chaos × lakes | 1 | needs-arch | UNBUILT | ABSENT | Blocked on a shallow-liquid class. | — |
| P5-G23 | ecumenopolis × cityLights | 1 | needs-arch | PARTIAL | ABSENT | Continuum merge unbuilt; `ecuC` and `cityC` are separate additive channels `:1383`. Game: **mutually exclusive types 16 vs 17**. | — |
| P5-G51 | carbon × lava | 1 | needs-arch | UNBUILT | ABSENT | Hot-carbon variant / preset. | — |
| P5-G47 | aurora × bands | 1 | needs-arch | UNBUILT | ABSENT | Plan flags **low value — optional**. | — |
| P5-G50 | clouds × greatSpot | 1 | needs-arch | UNBUILT | ABSENT | Plan flags **low sev — optional, gas-giant close-up**. | — |

### WS5↗ — View-dependent rich tier (2 gaps; owned by `rivers-viewdependent-lod-2026-06-18`)

| ID | Coupling | Sev | Tract | Lab | Game | Evidence / blocked on | QB (spine 2) |
|---|---|---|---|---|---|---|---|
| P5-G16 | dunes × mountains | 2 | view-LOD | PARTIAL | ABSENT | Orientation steering. **Cross-linked, not owned here** — status lives with `docs/WORKSTREAMS/rivers-viewdependent-lod-2026-06-18/`. | — |
| — | *(glacial × mountains = P5-G06, listed under WS3 — the one gap the plan splits across two WS)* | | | | | |

---

## The acceptance layer — I-1…I-15

**All 15 UNBUILT, one shared piece of evidence:** `cards/INTEGRATION.md:79` reads
`- I-1 … I-15: (pending)`, and `docs/FEATURES/cards/shots/` contains **314 files, zero** matching
`INT-*`. The card's protocol (`:10-11`) requires a screenshot per check. The lap has never run.

**Game status is ABSENT for all 15 for a reason that outranks the build state:** each check is a
lab-protocol procedure driven by `window._lab` solo/enable flags on `:9223` (`:10-11`). No
equivalent harness exists on the game side, and the game cannot host these checks until the lab
material actually renders a production body.

| ID | Subject | Lab | Game | Disposition (plan `:184-198`) + evidence | QB (spine 2) |
|---|---|---|---|---|---|
| I-1 | Rivers × canyons (F11×F04) | UNBUILT | ABSENT | Verify-only — presumed WIRED via the shared `canyonHeight` accumulator. Never verified. | — |
| I-2 | Rivers × lakes/seas (F11×F14) | UNBUILT | ABSENT | Blocked on **P5-G03** (WS1 pour-point). | — |
| I-3 | Deltas × coastlines × seas (F12×F20×F14) | UNBUILT | ABSENT | Mostly WIRED (shipped fluvial coupling) + **P5-G13** for the elevated-lake datum. | — |
| I-4 | Frost/caps over relief (F22/F23×F01–F10) | UNBUILT | ABSENT | Verify-only (orographic lapse WIRED) + **P5-G45** + **P5-G07**. | — |
| I-5 | Glacial × mountains (F17×F01) | UNBUILT | ABSENT | **P5-G06** (grad-bias) + WS5↗ (carving). | — |
| I-6 | Sublimation × frost (F18×F22) | UNBUILT | ABSENT | **P5-G19** (volatile budget) + **P5-G43**. | — |
| I-7 | Dunes × dust mantles (F15×F16) | UNBUILT | ABSENT | **P5-G35** + **P5-G10** / **P5-G15**. | — |
| I-8 | Clouds over terrain × bands (F31a×F26) | UNBUILT | ABSENT | Verify-only + **X** (declare) + **P5-G42**. | — |
| I-9 | Bands × storms (F24×F27/F28/F29) | UNBUILT | ABSENT | Mostly WIRED + **P5-G37**. | — |
| I-10 | Atmosphere gate consistency (D6/P25 × all) | UNBUILT | ABSENT | Verify-only — airless gates the whole gradational+atmospheric stack off together. | — |
| I-11 | Aurora × magnetic gate (F37×D13) | UNBUILT | ABSENT | Verify-only + **P5-G47** (optional). | — |
| I-12 | Rings × eclipse shadows (F51×F52) | UNBUILT | ABSENT | Verify-only. ⚠ **F52 has no lab implementation at all** — the plan's own §7 calls it the one feature where the lab is behind, and Max ruled it **in scope** on 2026-08-06. This check cannot run in the lab until F52 exists there. | — |
| I-13 | Thermal day/night × tidal lock × eyeball (F32/F33×D7×F31f) | UNBUILT | ABSENT | Verify-only + **P5-G42** (hotspot clearing). | — |
| I-14 | Overlay compositing (F46–F49 × base) | UNBUILT | ABSENT | **P5-G23** + **P5-G39**. | — |
| I-15 | LOD coherence (F53 × all combiners) | UNBUILT | ABSENT | WS5↗ + general verify. | — |

---

## Non-gap spine items

| ID | Item | Lab | Game | Evidence / blocked on | QB (spine 2) |
|---|---|---|---|---|---|
| X | Re-derive `ASSOCIATIONS.dependsOn` from the shader | UNBUILT | ABSENT | `planet-feature-associations.js` still carries **49 `dependsOn` blocks, 37 of them empty**, hand-authored (the schema is documented at `:43-53`). No re-derivation script or commit exists. The plan says the manifest under-declares ~4 honored couplings; I did not re-verify that count — **UNKNOWN which four**, settled by diffing declared `dependsOn.features` against the shader's actual cross-reads. Independent of every WS; runnable any time. | — |
| WS4-7 | Orogenic drainage-corridor co-genesis (mountains↔rivers) | **PARTIAL ↑ / UNKNOWN** | ABSENT | ⚠ **The plan's stated premise is now stale.** `planet-lod-phase5-integration-plan.md:43-46` says *"each relief writer has its own seed-hashed axis (no shared strike tensor), and inter-range lows are incidental ridged-multifractal noise minima."* Both clauses have moved: mountains read the shared strike field (`planet-lod-height.glsl.js:960-961`), and `writeGrainSphere(carrier, grainDrivers)` runs as an explicit **precondition** to `writeHeightSphere(...)` (`planet-lod-rivers.js:664-665`, comment: *"precondition: grain before height"*), so world-engine height is generated *from* the grain and the router routes on that height (`writeBodyRelief` `:1473`). **UNKNOWN whether the inter-range lows now read as oriented drainage corridors** — that is the whole point of the item and it is a render question. Settled by a lab render at `grainStrength` 0 vs 1 with rivers on, which is the same shot that settles **P5-G27**. | **QB-7** |

---

## Tally and what it means for MVP closure

| Block | Items | Lab BUILT | Lab PARTIAL | Lab UNBUILT | Game ABSENT |
|---|---|---|---|---|---|
| 52 gaps | 52 | 0 | 12 | 40 | 52 |
| I-checks | 15 | 0 | 0 | 15 | 15 |
| X + WS4-7 | 2 | 0 | 1 | 1 | 2 |
| **Total** | **69** | **0** | **13** | **56** | **69** |

**Nothing in this spine is BUILT to the standard "the mechanism is present and on by default in the
lab."** Thirteen items are PARTIAL. Three of those thirteen moved *upward* since the audit
(P5-G14, P5-G27, WS4-7) and one moved upward on a technicality that may not survive scrutiny
(P5-G12) — all four via world-engine work that was not aiming at Phase 5. **Zero items reach the
game**, and the binding reason is upstream of every individual coupling: the lab material is
reachable only through a debug hook with no condition driving. Steps 6 and 10 of
`one-pipeline-two-frontends-PLAN.md` are the prerequisite for the entire game column of this spine.

**Three things must be settled before this spine can be scoped, not after:**

1. **One lab render at `grainStrength` 0 vs 1** on a canyons+scarps+rivers preset settles P5-G27,
   WS4-7 and part of P5-G14 at once — it is the highest-leverage measurement in this document, and
   the three rows stay UNKNOWN until it is taken. Per `feedback_my-eyes-are-not-the-visual-gate`,
   the shot is for **Max's** eyes.
2. **Max's ruling on P5-G17** (airglow × limb) — the plan flags it partly by-design and says
   *"confirm w/ Max whether deliberate layering stays."* It cannot be scoped without that.
3. **F52 in the lab** — Max ruled it in scope on 2026-08-06 and generalised it to "the lighting
   engine needs to work for all objects in game." **I-12 cannot run at all until the lab has a
   shadow-caster path.**
