# WORLD-ENGINE HISTORY PROGRAM — ROADMAP v2 (CONDITION-FIRST)

**File:** docs/WORKSTREAMS/world-engine-history-program-2026-06-27/ROADMAP-v2-condition-first.md
**Status:** DRAFT for Max review · design-only, no code written · read-only synthesis
**Branch:** feature/world-engine-production-L1
**Register:** program map. Supersedes the *sequencing + input model* of ROADMAP.md; the full pilot build detail lives in §5 here and the per-increment planning notes in ROADMAP.md remain valid as sub-detail unless contradicted below.
**Synthesized from:** D1 (process design) + D2 (roadmap mapping) + D3 (pilot spec), each adversarially verified. Every MUST-FIX from the three verdicts is applied; conflicts are marked inline **[RESOLVED-BY-SYNTH]**. Unresolved verdict RISKS are carried verbatim-ish into §6.

---

## 0. DECISION RECORD & PROVENANCE

**Decision (Max, project owner, 2026-07-01):** Re-found the history program from **ARCHETYPE-FIRST** (an archetype string selects a bespoke per-world writer with an authored feature list) to **CONDITION-FIRST**, executed by **staged decomposition**, not a rewrite:

1. Build **E1**, a derived regime selector: per-body drivers (D1–D16) → geodynamic regime. Physics-derived at the regime-diagram *edges* (dead lid, heat-pipe, hot-surface stagnant lid, icy conductive-vs-convective); **seeded, literature-bounded** pick in the genuinely multistable middle (mobile/episodic/stagnant), per `condition-to-regime-research.md`. Archetype is **demoted** from load-bearing input to an **emergent LABEL** (the spine §4b principle — locked on paper, never built).
2. **Pilot process-level production** at the cheapest, most telling seam: `magmatism.js` and `stagnantLid.js` both already build a seeded mantle-plume field as their single cause. Unify them into **one mantle-upwelling-meets-unbroken-lid process** whose **response space** selects expressions (pierce-through shields at weak lid ↔ coronae/tessera/plains at strong lid). Feature lists become **regions of a response space**, not per-world menus.
3. **Extend writer by writer afterward**; existing writers keep shipping until absorbed. **ALL** ROADMAP goals must still complete under the new architecture, reusing as many shipped wins as possible.

**Motivating concern (Max, verbatim intent):** *catalog-bounded variety* — "every stagnant-lid world is a re-rolled Venus." He wants condition **combinations** to produce **predicted-but-never-observed** landforms, not re-rolls of the catalog.

**North star (unchanged):** count of genuinely **distinct, history-coherent worlds visible per minute**. **Key tension:** a continuous condition-space risks *mushy middles* — the response space must keep **legible, nameable regions**.

### What this supersedes in ROADMAP.md
- The **BROADEN-FIRST archetype-writer sequence** (one new bespoke writer per archetype family) as the *primary* variety engine. Under v2, **MULTIPLY (driver→expression continuum within a region) is the primary variety engine**; BROADEN survives only as the *rollout order* for siblings not yet absorbed.
- **Archetype string as a load-bearing dispatch input.** Demoted to an emergent label; dispatch moves to E1 (staged, with byte-identity gates).
- The framing of **#4-MULTIPLY / #4b Venus / Mars-gap** as separate archetype increments — these **dissolve into the pilot's response space** (§3).

### What this preserves (non-negotiable)
- **All 11 increment goals** (nothing is dropped; every old increment has an explicit v2 disposition in §3).
- **Every shipped win**, byte-identical until deliberately absorbed (`plates`, `shellRelief`, `magmatism`+`#4-M`, `stagnantLid`, atmosphere #3a, emission).
- **The sibling structure**: `plates` (broken lid) and `shellRelief` (icy/tidal) stay siblings for *topological* and *forcing* reasons the research supports; they are **not** merged into the pilot.
- **Disciplines**: generative-not-simulative (paint the end-state once; no clock, no per-Myr loop); three-free `base/` writers; seeded determinism (alea namespaces, fixed draw order, no `Math.random`/`Date.now`); `carrier.height` = REPLACE; bounded **fixed** relax passes; ZERO-CLOBBER; byte-identity at reference points when threading drivers (the increment-2 discipline); Rule 15 / AC-0 spine-conformance (`SPINE-CONFORMANCE.md`); lab-first validation (lab ≠ game, by charter).

---

## 1. TARGET ARCHITECTURE (compact)

One **shared convective root** delivers basal heat + buoyancy flux to the base of a lithosphere. The architecture forks **by how the lid is coupled** — and the fork points are *topological discontinuities*, not continuous knobs:

| Layer | Members | Role |
|---|---|---|
| **P-CONV** (shared root) | seeded upwelling field: N centers + a size-aware vigor scalar | common cause; feeds all lid processes |
| **P-LID-UNBROKEN** — *the pilot* | `magmatism` ∪ `stagnantLid` | single, unbroken silicate lid; response space selects pierce / tent / flood / preserve |
| **P-LID-BROKEN** (sibling) | `plates.js` | lid fragments into moving plates + a boundary network — cannot be interpolated into a plume field |
| **P-LID-ICY** (sibling) | `shellRelief.js` | ice lid over ocean; dominant forcing is **tidal** (despin/diurnal) — no silicate-mantle analog |
| **Exogenic overlays** (orthogonal, not absorbed) | P-IMPACT (bombardment), sculpting (#7), weathering (E8b), hydrology (E9), compose (#6) | overprint any endogenic base |
| **P-ATMO** (parallel track) | climate #3/#3a/#3b, emission | atmosphere is its own process family |

**E1** is the selector over all of them. It emits `{compositionClass, geodynamicRegime, label, L, Φ, V, n, m_hp, e1Seed, positionWithinRegime}`. Writers branch on these coordinates, **never on a label**. `label === PRESET_ARCHETYPE` is the conformance oracle during migration, not an input.

**[RESOLVED-BY-SYNTH — D1-risk (exogenic omission)]:** The "one root + three lid-couplings" vocabulary describes only the **endogenic** layer. Exogenic overlays (bombardment, weathering, hydrology, sculpt, compose) and the P-ATMO track are **orthogonal overlays that are NOT absorbed into the lid processes** — they remain first-class program goals (§3). "All ROADMAP goals under the new architecture" explicitly includes them; the architecture is not silently narrowed to endogenic worlds.

**[RESOLVED-BY-SYNTH — D3-MF1 (label carve-out)]:** Authored-label archetypes with **no distinguishing driver signature** — crystal/geometric, technogenic — are **permanently outside condition-derivation**. E1 excludes them by an **explicit label carve-out**, not by hoping a scalar separates them. Carbon is derivable only if the C/O>1 branch beats the density→rocky branch (flagged, §7).

---

## 2. PROCESS VOCABULARY + RESPONSE-SPACE DESIGN

### 2.1 The load-bearing anti-mush idea (province-discrete expression)

> **Mixing happens at the level of *which landform each upwelling center grows*, never by blending heightfields.**

A mid-axis world is **not** "50% shield + 50% corona everywhere" (that is mush). It is "these 3 strong centers *pierced* as shields, these 5 weaker ones *tented* into coronae, this cluster *thickened* into tessera, the lows *flooded* to a plains datum." Each landform stays crisp because the response space selects **per-province, by a sharp threshold on that province's local (flux vs lid-yield)**; only *within* a province is anything continuous. Real mixed worlds look like this — Mars is discrete Tharsis shields **beside** ancient highlands **beside** Valles rift, not a blurred average.

### 2.2 Shared sub-processes (reusable machinery — named, not all built yet)

- **SP-CENTERS** — the seeded centroid set. **[RESOLVED-BY-SYNTH — D2-MF6]:** SP-CENTERS is a **dispatcher over two byte-preserved center constructions**, NOT a single unified primitive. `magmatism` uses two *disjoint* streams (`alea('magma:count')` count∈[5,11), then `alea('magma:centroid')`); `stagnantLid` uses one interleaved stream (`alea('stagnant:plumes')` count∈[6,12) + centers), **plus** a forced ≥1-ancient/≥1-corona split and a corona rejection pool (CORONA_POOL=120). No single fixed draw order equals both. "Same centers" is **nominal**; only the *mixed interior* (new `'lid:'` namespace) draws once.
- **SP-PARTITION-HARD** — winner-take-all Voronoi (`plumeId`) → discrete placement.
- **SP-PARTITION-SOFT** — Gaussian-sum proximity (`proxAt`, `exp(-(a/BELT)²)`) → continuous fields.
- **SP-DISTANCE** — geodesic transform (BFS mode, or analytic point-to-arc). No while-loops.
- **SP-RESURFACE** — fill-to-datum flooding (magma lava plains ≡ stagnant plains province).
- **SP-STRESS-FABRIC** — steered anisotropic noise (`steeredNoise3`, verbatim across tectonic/shell/stagnant). **[RESOLVED-BY-SYNTH — D2-MF7]:** This is **sibling/tessera-local**, NOT a pilot-wide input the volcanic anchor reads. See §2.4.
- **SP-RELAX** — bounded fixed-pass Jacobi (identical loop, differs only in `PASSES`).
- **SP-LID-DISRUPTION** — basal upwelling → quasi-circular lid deformation. **[RESOLVED-BY-SYNTH — D1-risk]:** This is a **FUTURE shared abstraction to be BUILT, not existing shared machinery.** Verified: `shellRelief` STEP-2 is a space-filling spherical-Voronoi convection tessellation; `stagnantLid` coronae are sparse rejection-sampled centers with analytic dome/trench profiles — **structurally different implementations**, not copy-paste. The cantaloupe-silicate payoff (§5) depends on building this and is design-forward only.

### 2.3 Response-space axes (all are E1 outputs; the writer branches on these, never on a label)

The pilot's response space is **≥4-dimensional** — `L`, `Φ`, `V`, `n`. The old "L×Φ plane" shorthand is **retired**.

| Axis | Symbol | Source | Role |
|---|---|---|---|
| **Lid immobility / strength** | `L` | E1: `f(ρgz) · μProxy(V, T_surf)` | primary — pierce vs tent vs preserve; **must be NON-MONOTONIC in surface temperature** (see below) |
| **Convective vigor (size-aware)** | `Φ` | E1: **NEW size-aware proxy** (see below) | primary — how much upwelling to express; sets `n` |
| **Volatiles / dryness** | `V` | D2 passthrough | melt effusivity, lid-weakening, **and lid mobility** (dry → won't recycle → stagnant) |
| **Center count** | `n` | `= f(Φ, 1/L)` | discrete-vs-pervasive; **carries the Mars/Venus separation** (see below) |
| **Heat-pipe margin** | `m_hp` | `rawTidal − HEATPIPE_IO_THRESHOLD` (signed) | sharp gate to the pervasive-resurfacing corner |

**[RESOLVED-BY-SYNTH — D1-MF2 + D2-MF1 (Φ is NOT `thermalState` verbatim)]:** The reuse ledger's "Φ = `baseStep.thermalState` verbatim, zero-clobber" is **retired.** Three findings force it:
- `thermalState = 0.5·tidalHeat + 0.5·(1−ageNorm)` has **no size / mantle-depth (d³) term**, yet Ra ∝ ρgαΔT·d³/κη makes mantle depth the dominant vigor lever. With it, Venus and Mars (both ~0 tidal, both ~old, both high-`L`) collapse into one cell — the two anchors that must sit apart become degenerate, and the "Mars = neither Io nor Venus" claim is unreachable.
- The *shipped* magma driver is **`magmaThermal H` = clamp01(0.5·clamp01(rawTidal)+0.5·(1−age/10))** (magmatism.js:97-103), whose tidal term is **raw and saturating**, NOT the tanh-compressed `thermalState`. They coincide only at `MAGMA_REF`. Reusing `thermalState` as Φ would silently regress or double-drive the validated #4-MULTIPLY plume-count/height response.
- `thermalState` is **production-dormant** on the sphere path (baseStep is called only by tests), so "zero-clobber via verbatim reuse" was moot anyway.
**Resolution:** Φ is a **NEW size-aware convective-vigor proxy** in E1 = f(radiogenic budget scaled by mass, d³ mantle-depth from `shellThickness`, tidal). Small-cold-old Mars gets genuinely **lower Φ** than Earth-sized-old Venus, so they separate on Φ (plus `n`). The **shipped magma kernel keeps its own internal `H`** and stays byte-identical because the Option-A router (§5) calls it *unchanged* at the weak anchor. Φ is used only in the **mixed interior** and to set `n`. One tidal representation per axis: `m_hp` and Φ's tidal term both key on the **raw Io-ratio**, which must be **exposed in the drivers bundle** (only calibrated `tidalHeat` is exported today) so `m_hp` is computable on the upstream-D12 production path, not just the lab fallback.

**[RESOLVED-BY-SYNTH — D3-MF2 (surface vs equilibrium temperature)]:** The preset field named `T_eq` is actually **surface temperature** (Venus 737, Rocky 288 — not the ~230 K / ~255 K equilibrium values). Lid strength depends on **surface temperature**, not equilibrium temperature. Resolution: **document the D-slot as surface temperature** and feed `μProxy` from it; downgrade the temperature-axis confidence accordingly (Venus's high-`L` anchor is **data-placed, not physics-derived at the edge** as previously claimed). A proper greenhouse derivation (surface = f(T_eq, pressure, CO₂) — all present in the preset) is a future refinement, flagged in §7. The mid-axis demo (§5) **must specify surface temperature as a first-class input** or its "physically plausible" criterion is unfalsifiable.

**Non-monotonic `L`:** both hot-dry Venus (dry ductile lithosphere → can't localize faults → stagnant) and cold-thick Mars (frozen thick lid) sit at high `L`, while temperate-wet Earth sits at low `L` (mobile). So `L` conflates *yield-strength* and *breakability/mobility*, and must be **non-monotonic in surface temperature** with `V` (dryness) co-driving the stagnant placement. This is unusual and under-specified — see §7 (delegable #1) and §6 (R-L).

### 2.4 Expression regions (the legend) and the blending contract

Expression primitives, fired **per province/center**:
- **Pervasive-resurfacing corner (heat-pipe / Io)** — `m_hp > 0` gate: pervasive volcanic plains + paterae, thick cold advecting lithosphere. **[RESOLVED-BY-SYNTH — D1-risk]:** the legend previously said "weak lid, shields everywhere" — corrected: real Io is **patera+plains-dominated (low relief)**, not shield-dominated; the `m_hp` hard gate does the selection, so the mischaracterization was not load-bearing but is fixed here.
- **Pierce-through shield** — per-center: `plumeStrength_p·Φ > localYield(L, i)`, a **boolean** (magma shield/caldera curve).
- **Corona** — strong local lid + discrete upwelling (stagnant active/inactive radial profile).
- **Tessera plateau** — strong lid + sustained/clustered upwelling (SP-STRESS-FABRIC fold+ribbon).
- **Plains flood** — any lid with Φ enough to resurface lows (SP-RESURFACE datum).
- **Rift corridor** — extension between neighboring centers (analytic arc).
- **Stationary-hotspot pile** — strong lid + **low Φ** + **few centers**: the *Tharsis* expression (only the 1–3 strongest centers exceed local yield, on a preserved datum).

**Blending discipline (three transition types):**
1. **SHARP where the science is sharp** — heat-pipe onset (hard `m_hp` gate); per-center pierce boolean. No blend.
2. **BOUNDED-CONTINUOUS inside a province only** — corona active↔inactive, tessera fraction, flood depth, shield height/elongation. Texture budgets stay **strictly below province-floor gaps** so texture can never invert province ordering.
3. **SEEDED-MULTISTABLE upstream in E1** — the mobile↔episodic↔stagnant pick in the temperate-wet-Earth-mass band is `alea('e1:regime:'+macroSeed)`-drawn, weight-nudged by `V` (↑→mobile) and `T_surf` (↑→stagnant). The process receives a **resolved** regime + `positionWithinRegime`, never a blend.

**[RESOLVED-BY-SYNTH — D1-MF1 (the ordering rule is NOT one rule that degenerates to both anchors)]:** The claim of "a single constant-gap province-floor stack that reproduces both anchors byte-identically" is **false and retired.** Verified: `magmatism` orders provinces with a **fully adaptive** flood datum (`mu0 − FLOOD_Z·sigma0`) plus continuous edifices up to `EDIFICE_HEIGHT=1.0`; `stagnantLid` uses **constant** floors (`BASE_TESSERA 0.70 / BASE_PLAINS 0.10 / BASE_RIFT −0.45`). No constant-gap stack reproduces magma's adaptive/continuous output bit-for-bit. **Resolution (option b):** byte-identity is scoped to the **two anchors via preserved code paths** (the Option-A router, §5 — corners call the unchanged writers). The **mixed-interior ordering is a NEW mechanism**, an absolute-datum province stack with its **own legibility ACs** and a **budget bound that explicitly caps shield-edifice height contributions below the inter-province floor gaps** — the previous 0.24<0.60 bound covered only stagnant *texture* and left magma's tall edifices (up to 1.0) unbounded, which would let shields cross the tessera/plains/rift floors unpredictably. That gap is the exact mush the design claimed to defeat; the new bound closes it (AC-ORDER-MIX, §5).

---

## 3. INCREMENT PLAN v2

### 3.1 Increment table v2

**Metric change:** north-star count is scored by **size/legibility of an opened response-space region** (MULTIPLY), not archetypes-flipped.

| v2 | Increment | Size | Depends on | Unlocks |
|---|---|---|---|---|
| **V2-0** | **L0 plumbing + baseStep scalar extraction.** Finish surfacing D12/ecc/D13/D16/metallicity (data-only). **[RESOLVED-BY-SYNTH — D3-risk]:** "wire dormant `baseStep` into the sphere path / reuse `thermalState`,`shellThickness`,`rawTidal` verbatim" is **not achievable** — `baseStep` exports only `makeBaseStep`, a **grid** op; those quantities are internal locals. Instead: **refactor baseStep to export pure per-body scalar helpers**, guarded by its existing (test-only) suite so extraction is drift-safe. This activates never-integrated code, not a live path. | S–M | — | E1 gets real D-slots + reusable scalar derivations |
| **V2-1** | **E1 regime selector (SHADOW mode).** Emit `{compositionClass, geodynamicRegime, label, L, Φ, V, n, m_hp, e1Seed, positionWithinRegime}` onto `state` + a live probe. Dispatch still reads `PRESET_ARCHETYPE`. **Oracle = `writerUnder(e1) === writerUnder(PRESET_ARCHETYPE)`** over all 15 presets, **minus an enumerated allow-list of intentional reroutes** (V2-3). | M–L | V2-0 | The whole condition-first architecture, zero-clobber; executes spine §4b on paper |
| **V2-2** | **⭐ THE PILOT — `magmatism` ∪ `stagnantLid` → P-LID-UNBROKEN.** Option-A anchor-preserving router; shared SP-* modules; response space on `L,Φ,V,n`; per-center sharp `localYield(L,i)`; **NEW stagnant-side driver→expression build** (see disposition #4b); mixed-interior new ordering mechanism (§2.4). | **XL+** | V2-1 | Tharsis-volcanism expression; corona-pierced, heat-pipe-to-stagnant, wet-stagnant worlds; the pierce↔tent↔flood continuum |
| **V2-3** | **Flip dispatch to `E1.label`** once oracle green **and every enumerated misroute adjudicated** (below). Add **Mars preset**; resolve **sub-Neptune/Neptunian** short-key collision; fix **Frozen(airless)→dead-lid** misroute. `PRESET_ARCHETYPE` survives one release as fallback oracle, **deleted only after each misroute is explicitly resolved**. | S–M | V2-1, V2-2 | Type-as-derived-label live |
| **V2-4** | **Shared-substrate pass (was #5.5) — ALL FIVE fields.** (d) SP-STRESS-FABRIC; (b) `carrier.sediment`/`carrier.accommodation` host (new channels, not the E9-owned `maturity`/`baseLevel`); **(a) passive continental margins; (c) history-tied E12-province (random-seed association-test must FAIL); (e) E2-figure (oblate/triaxial/Roche/despun-fossil-bulge).** | M–L | V2-2 | De-risks #6/#7/#8; **provides the E2-figure that V2-7 CYCLE-2 depends on** |
| **V2-5** | **Bombardment sibling (was #5) + Moon/Mercury preset + bombardment-MULTIPLY.** Exogenic P-IMPACT crater-population field; the dead-lid low-Φ floor; editor-on-host exemplar. **Drivers → crater-density/size continuum (MULTIPLY), scheduled, not "dissolved".** | M–L | V2-1 (dead-lid regime), V2-4 (host) | Moon/Mercury history; de-risks the #6 editor |
| **V2-5s** | **Shell-MULTIPLY (was unscheduled).** Thread the D-vector into `shellRelief` so low-g vs high-g icy worlds differ within-regime (the north-star gap D2-MF5 names). | M | V2-1 | Icy variety-per-effort; closes an unscheduled-MULTIPLY gap |
| **V2-6** | **Atmosphere track (P-ATMO).** Wire `writeClimateE5Sphere` (#3); build #3b vortex/storm placement (jet-lift prereq met by #3a); **derive-not-freeze MULTIPLY** (`shellDepthFrac`/`internalHeat`/`dissipation`). *Parallelizable with V2-2..V2-5.* | L | V2-1, #3a (shipped) | Gas-giant/hot-Jupiter/Neptunian storms; precip feed for #7 |
| **V2-7** | **Epoch / host-editor model (was #6, LOCKED).** 2–4 **discrete painted epochs** (byte-identical at `epochs=1`); editor-on-host over `plumeField/provinceMap/datumStack/coronaState`. **Depends on the V2-4 E2-figure field (CYCLE-2 figure↔grain).** Fixed-point cross-tier solver stays the flagged open problem. | L–XL | V2-2 (host), **V2-4 (figure)**, V2-5 (editor exemplar) | Frozen-then-pierced, cantaloupe-silicate payoffs |
| **V2-8** | **Per-response-region sculpting (was #7).** Aeolian/cryo/fluvial overlays keyed on E1 conditions. **[RESOLVED-BY-SYNTH — D2-risk]:** carry ROADMAP #7's 2026-07-01 note — **add Lava/Magma volcanic terrain as an explicit sculpting/weathering target** (lava-flow texture, flank mass-wasting, thermal channels) or volcanic worlds stay glassy through the whole stack. | L | V2-6, V2-4, V2-7 | Multiplies every solid world |
| **V2-9** | **Exotics + technogenic + Tier-5 (was #8, split).** 9a: carbon/crystal as E1 Stage-A terminals + small writers + #4.5 block-jumble primitive; 9b: technogenic + rings/weathering/palette/magnetosphere via epoch. | XL (cuttable) | V2-1, V2-7 | Closes toward 11-of-11 |
| **V2-10** | **Game `Planet.js` port (was #9, LAST).** Port unified stack + E1 + siblings; demote game `_pickType` to E1. Gated on world-origin rebasing (float32). | XL | rebasing + all lab increments | Variety visible in the screensaver |

**Critical path:** V2-0 → V2-1 → V2-2. The single blocking gate is delegable-decision #1 (`L` functional form) — the response space *consumes* `L` but cannot *define* it.

### 3.2 Disposition of every old increment

| Old | Disposition |
|---|---|
| **#1 shellRelief** | **SURVIVES AS-IS** → P-LID-ICY sibling. Its convection-cell disruption is the *seed* for the future SP-LID-DISRUPTION (to be built, not reused). AC11 UAT stays Max's open gate. |
| **#2 plate driver-response** | **SURVIVES AS-IS** → P-LID-BROKEN sibling; reframed as the **canonical MULTIPLY template** the pilot copies (`driversToTune`/`D_EARTH` two-anchor discipline). |
| **#3 / #3b climate** | **SURVIVES** → P-ATMO track; wired + extended at **V2-6**. |
| **#4 / #4a volcanic** | **DISSOLVED into P-LID-UNBROKEN weak-lid anchor.** Shipped skeleton becomes the weak-lid end; `MAGMA_REF → tune=null` is anchor #1. |
| **#4-MULTIPLY** | **DISSOLVED into the Φ axis.** **[RESOLVED-BY-SYNTH — D2-MF7]:** its elongation **MAGNITUDE rides Φ (thermal `H`), NOT L**; its elongation **DIRECTION is a writer-private seeded fissure axis** (`alea('magma:grain:')`, derived — *not* read from `carrier.grainAngle`, because a volcanic body's grain is zero/latitude-binary). This axis **stays disjoint from SP-STRESS-FABRIC** or it clobbers the weak anchor and is physically wrong. |
| **#4b Venus stagnant-lid** | **DISSOLVED into P-LID-UNBROKEN strong-lid anchor — BUT the response REGION is NEW work.** **[RESOLVED-BY-SYNTH — D2-MF3]:** `stagnantLid` today is `void drivers` with **no `stagnantDriversToTune`/REF** — every Venus-regime world is a re-rolled Venus by seed (exactly Max's fear). Only **byte-identity-at-Venus (AC1–8)** is reuse; building a legible driver→expression response for the stagnant end is a **from-scratch #4b-MULTIPLY-scale build**, sized into V2-2's XL+. |
| **#4.5 exotic-shattered** | **SPLIT.** Diapir-grooved-coronae branch → covered by the future SP-LID-DISRUPTION family; Miranda block-jumble → small V2-9a primitive. The blocked geometry decision shrinks (still a Max call). Do **not** write a 4th `carrier.regime` constant (`verify.js:39` asserts ∈{0,1,2}). |
| **#5 bombardment** | **SURVIVES** → P-IMPACT exogenic overlay (V2-5); E1 dead-lid edge gives Moon/Mercury a regime home + the low-Φ floor. |
| **#5.5 shared-field pass** | **PARTLY DISSOLVED, RISES to V2-4 — ALL FIVE FIELDS.** **[RESOLVED-BY-SYNTH — D2-MF2]:** the earlier mapping silently dropped (a) margins, (c) history-tied province, (e) E2-figure; restored here. (e) E2-figure is a **hard pre-#6 gate** and CYCLE-2 is defined against it; (c) province is the program's explicit guard against palette/inhabitation becoming a "bag of overlays divorced from history." None are deferred. |
| **#6 epoch/host-editor** | **SURVIVES AS-IS (LOCKED)** → V2-7; host model made concrete by the pilot's persistent province structure. Fixed-point solver stays unmechanized (do-not-contract flag stands). |
| **#7 per-regime sculpting** | **SURVIVES** → V2-8, keyed on E1 conditions; carries the volcanic-weathering note. |
| **#8 exotics/technogenic/Tier-5** | **REFRAMED / SPLIT** → V2-9a/9b. |
| **#9 game port** | **SURVIVES AS-IS (LAST)** → V2-10. |
| **Mars gap** | **PARTLY dissolved.** **[RESOLVED-BY-SYNTH — D1-risk + D2-MF4]:** the pilot closes only the **Tharsis-VOLCANISM part** (shields + plains + one rift). The *full* Mars gap additionally needs cratered highlands (#5/V2-5), hemispheric dichotomy, aeolian dunes (#7/V2-8), and an early-active-then-frozen epoch (#6/V2-7). The pilot has no cratering or dichotomy primitive. "Mars gap closed with no 4th writer" is **corrected to "Tharsis-volcanism part closed."** |
| **Unscheduled MULTIPLY passes** | **[RESOLVED-BY-SYNTH — D2-MF5]:** NOT "all dissolved." The pilot demonstrates MULTIPLY; **shell-MULTIPLY (V2-5s) and bombardment-MULTIPLY (V2-5) are now explicitly scheduled**. Atmosphere derive-not-freeze is V2-6. No MULTIPLY is silently dropped. |

### 3.3 Coverage map v2 (nothing loses coverage vs today)

| Planet type | Today | v2 home | E1 regime | Status |
|---|---|---|---|---|
| tectonic-terrestrial (+ocean) | `plates.js` ✅ UAT'd | P-LID-BROKEN sibling | mobile (broken lid) | **BUILT — survives** |
| icy-active / volatile-cold / eyeball-despun | `shellRelief.js` ✅ (AC11 open) | P-LID-ICY sibling | icy / volatile / despun | **BUILT — survives; +shell-MULTIPLY V2-5s** |
| volcanic (Io/Lava/Magma) | `magmatism.js` ✅ | P-LID-UNBROKEN weak anchor | heat-pipe / weak-lid | **SHIPPED → pilot anchor #1 (byte-identical)** |
| Venus (non-canonical) | `stagnantLid.js` ✅ (AC9 open) | P-LID-UNBROKEN strong anchor | hot-surface stagnant | **byte-identical at Venus; response region NEW (V2-2)** |
| Mars (was despun fallback) | none (despun) | Tharsis expression via **hand-set D-vector**, then preset at V2-3 | dead/stagnant rocky | **Tharsis-volcanism part in V2-2; stays despun until V2-3 (subtractive gate)** |
| impact-airless (Moon/Mercury) | roadmapped, no preset | P-IMPACT + E1 dead-lid host | dead lid | **V2-5 — gains E1 home + preset** |
| gas-giant / hot-jupiter | atmosphere #3a shipped | P-ATMO | Stage-A terminal | **#3a shipped; wire V2-6** |
| sub-Neptune (collides w/ Neptunian) | none (short-key collision) | P-ATMO; collision resolved by label demotion | Stage-A terminal | **V2-3 collision fixed** |
| exotic-carbon | none, #8 | V2-9a Stage-A terminal | Stage-A terminal | **V2-9a** |
| exotic-crystal/geometric | none, #8 | V2-9a — **label carve-out (no driver signature)** | authored label | **V2-9a** |
| exotic-shattered (Miranda) | none, #4.5 blocked | V2-9a block-jumble; diapir → SP-LID-DISRUPTION | (composition/disruption) | **de-risked; geometry call shrinks** |
| technogenic | none, #8 | V2-9b epoch overlay | (overlay, post-regime) | **V2-9b** |

---

## 4. REUSE LEDGER

| Shipped win | v2 landing |
|---|---|
| `plates.js` + #2 tune | **P-LID-BROKEN sibling, whole.** `driversToTune`/`D_EARTH` = the two-anchor `tune=null` template. Voronoi/BFS/relax → SP-PARTITION/DISTANCE/RELAX (source = boundaries). |
| `shellRelief.js` #1 | **P-LID-ICY sibling, whole.** Convection-cell partition → **seed for future SP-LID-DISRUPTION (build, not reuse).** `REGIME_WEIGHTS` → proof-of-concept response-table *shape* only. Tidal-lineament half stays sibling-local. |
| `magmatism.js` #4a + #4-M | **P-LID-UNBROKEN weak anchor.** Shield/caldera VERBATIM curve → pierce primitive; plume Voronoi/argmax/BFS → SP-CENTERS(dispatcher branch)+PARTITION-HARD+DISTANCE; lava flood → SP-RESURFACE; **#4-M elongation magnitude → Φ axis; direction → writer-private `magma:grain:` axis (disjoint from SP-STRESS-FABRIC)**; substellar magma-ocean basin → LOCAL (T_ss-gated). `magmaDriversToTune`/`MAGMA_REF` → anchor #1, verbatim. |
| `stagnantLid.js` #4b | **P-LID-UNBROKEN strong anchor — byte-identity ONLY.** Soft `proxAt` → SP-PARTITION-SOFT; corona profiles → corona primitive; tessera double-fabric → tessera primitive (SP-STRESS-FABRIC, sibling-local); analytic arc → rift primitive. **The driver→expression response is NEW (`stagnantDriversToTune` does not exist today).** `age` field → diagnostic until V2-7. |
| Atmosphere #3a | **P-ATMO sibling, kept.** The **condition-first precedent** for E1 (bands derived, not looked up). Three frozen constants → V2-6 derive-not-freeze. |
| Emission (`emission-e.js`) | **P-ATMO, whole.** No architecture dependency. |
| `baseStep.js` derivations | **RISE, but re-scoped.** **[RESOLVED-BY-SYNTH — D3-risk]:** cannot "import verbatim" (grid op, internal locals, dormant). V2-0 **refactors baseStep to export pure scalar helpers** (radiogenic/size-vigor for Φ, `shellThickness` for the `L` z-term + shell-Ra, `radialStrain`/`liquidStability` for Stage-A), guarded by its tests. |
| `climate-e5.js` (lifted, not wired) | **V2-6** (`writeClimateE5Sphere`). |
| Test suite | **Reused as scaffolding** (determinism → structure → latitude-control → placement → variety → no-clobber → dispatch). The **single byte-identity reference becomes multiple** — see §5 ACs. |
| `increment-4b-venus-stagnantlid-MECHANISM.md` | **Source-of-truth for the strong-lid physics** → feeds V2-2. |
| WS1 driver plumbing | **V2-0** feeds E1 real D-slots; "surfaced-but-not-consumed" is the shadow-mode template. |
| SPINE-CONFORMANCE AC-0 / Rule 15 | **Carried forward unchanged**; check-1 threshold tightens at V2-3 (archetype-string routing prohibited except at the regime-selection layer), exactly as the spine doc anticipates. |
| `condition-to-regime-research.md` | **E1's science source-of-truth** (edge derivations + seeded-middle mandate). |

---

## 5. PILOT SPEC SUMMARY (V2-2 — full detail is its own contract)

**Line of sight → north star:** converts the two cheapest-to-unify shipped writers from archetype-gated menus into one condition-derived response space, so condition **combinations** between Lava/Magma/Venus yield predicted-but-never-observed worlds on demand.

**New files:** `src/worldengine/base/e1Regime.js` (`computeE1(conditionVector)`) and `src/worldengine/base/lidResponse.js` (`writeLidResponseSphere(...)`, the router + mixed-interior composition; imports both corner writers as expression kernels).

### 5.1 The anchor-preserving router (Option A — the byte-identity mechanism)

A single unified draw sequence is **provably not byte-identical at both anchors** (disjoint alea namespaces, structurally different draw orders). The router therefore classifies the E1 coordinate:
- `pure-weak` → call `writeMagmatismSphere(...)` **unchanged** → byte-identical Lava/Magma.
- `pure-strong` → call `writeStagnantLidReliefSphere(...)` **unchanged** → byte-identical Venus.
- `mixed` (interior, never-observed worlds) → new machinery over a shared SP-CENTERS set in a **new `'lid:'` namespace**. No shipped world exists here to clobber.

**[RESOLVED-BY-SYNTH — D3-MF1 (subtractive gate)]:** During migration the gate is **SUBTRACTIVE**: `isUnbrokenLidPath(e1)` requires `{composition ∈ rocky/magma-ocean}` **AND** `{heat-pipe edge OR hot-surface-stagnant edge}` **ONLY**. `unbroken-lid-generic` rocky bodies (Mars, and anything else currently despun) **stay on the despun fallback** until a dedicated increment absorbs them — so the flip clobbers no shipped despun world. Authored-label exotics are excluded by the §1 label carve-out.

**[RESOLVED-BY-SYNTH — D3-MF3 + D3-risk (T_ss)]:** `T_ss` (the locked-body substellar magma-ocean basin) must be computed **before** the collapsed gate and passed through, or Magma's basin is not byte-identical. The `pure-weak/pure-strong` boundary is pinned **with margin** so the real Lava and Magma **presets** (not just `MAGMA_REF`) sit well inside `pure-weak`.

### 5.2 Migration sequence (increment-2 discipline)
1. **Shadow** — `computeE1` runs data-only + probe; dispatch reads archetype. Byte-identical everywhere.
2. **Conformance oracle** — over 15 presets, `writerUnder(e1) === writerUnder(PRESET_ARCHETYPE)` **except the enumerated allow-list**. **[RESOLVED-BY-SYNTH — D2-MF8]:** the allow-list is a **hard-block adjudication list** of known-wrong routings that must be *fixed, not matched*: (i) **Frozen(airless)→'ice'** (a dead-lid airless body must route dead-lid, not to the icy-shell writer); (ii) **Neptunian/Sub-Neptune short-key collision**. `PRESET_ARCHETYPE` is **not deleted until each is explicitly resolved** — "oracle green" ≠ "E1 correct."
3. **Flip** when oracle green + allow-list adjudicated. `isVolcanicPath`/`isStagnantLidPath` survive one release as fallback oracle, then delete.

### 5.3 ACs (superset of the reused numbering)

| AC | Pins |
|---|---|
| **AC1 determinism** | no `Math.random`/`Date.now`; fixed draw order; namespaces `'e1:'`/`'lid:'` disjoint from `'magma:'`/`'stagnant:'`/`'plates:'` |
| **AC-BYTE-WEAK-REF / AC-BYTE-STRONG-REF** | at `MAGMA_REF` / Venus reference vectors, output === the corner writer bit-for-bit |
| **AC-BYTE-LAVA / AC-BYTE-MAGMA** | **[D3-MF3]** at the **real Lava and Magma preset vectors** (non-null overrides + T_ss + locked), full `Float32Array` equality vs `writeMagmatismSphere` — the shipped worlds the discipline actually protects |
| **AC-CONFORMANCE (FINE)** | oracle asserts the **fine class** (pure-weak/pure-strong/mixed), so a preset drifting into `mixed` **fails** |
| **AC-TUNE-NULL** | `lidDriversToTune(MAGMA_REF)`→null; `stagnantDriversToTune(Venus)`→null |
| **AC-ORDER-MIX** | the **new mixed-interior ordering** holds `tessera>plains>rift` and `edifice>plain>basin`, **with the shield-edifice budget bound below inter-province floor gaps** (§2.4 fix) |
| **AC-MIX-DISCRETE** | province boundaries are sharp — no node holds a blended two-primitive height (anti-mush) |
| **AC2/AC3 structure + latitude-control** | mixed output is center-organized; latitude-control FAILS, at both anchors and the mixed world |
| **AC5 variety** | mixed world differs per seed; pierce/tent mix changes |
| **AC-ZERO-CLOBBER (siblings)** | plate + shell gate suites pass unchanged; byte-diff of plate/shell carrier output pre/post pilot |

### 5.4 Falsification criterion

**[RESOLVED-BY-SYNTH — D2-MF4 + D3-MF4 (the primary test must exercise the seeded middle AND defeat the checkerboard)]:** The single most honesty-critical risk is the **seeded middle**, and the previous "Mars is the mid-axis acid test" both (a) tests the *easy, physics-derivable* end-member and (b) can pass on a Venus-tile/Io-tile checkerboard. Corrected three-part gate:

1. **PRIMARY mush-risk falsification — the WET-STAGNANT world.** An **Earth-mass, temperate, WET** body whose E1 **seeded Stage-B pick resolves 'stagnant'** (the genuinely contested band) enters the pilot's strong-lid end. **AC: it must read as a coherent wet-stagnant world, NOT "Venus with water" and NOT a re-rolled Venus.** This requires the NEW stagnant-side response (V2-2) to actually differentiate on `V` and surface temperature. This is the test that fires E1's seeded-pick machinery — the thing that can falsify the whole condition-first premise.
2. **PRIMARY new-landform falsification — the CORONA-PIERCED compound landform** (promoted from secondary). A **shield emerging FROM a corona at ONE center** must be **present and crisp**, plus an **interpenetration statistic** showing pierce and tent expressions **interpenetrate rather than tile** into separable Io-patch / Venus-patch regions. This is the only automated criterion that separates "genuinely new landform" from "two catalog landforms placed side by side." "Coverage stats differ from both anchors" is **retired** (trivially true for any mixture — zero discriminating power).
3. **INTEGRATION CHECKPOINT (not falsification) — the THARSIS world.** Via a **hand-set D-vector** (Mars has no preset until V2-3): strong `L`, low `Φ`, low `n` → 1–3 stationary-hotspot shields on a preserved datum + one rift. Confirms the Tharsis-volcanism part; it does **not** falsify the mush risk (it's the derivable end-member).

**Red flags that FALSIFY:** heightfield averaging / smeared boundaries (mush); no nameable regions (illegibility); the mid-axis world reads as a faded Venus or weak Io, or "Venus with water" (catalog-bounded); ordering inverted; output tracks latitude. Final believability is **Max's UAT gate alone; no agent closes it.**

### 5.5 Explicit NON-GOALS
No epochs/host-editor (V2-7); no game port (`_pickType` untouched); no palette/shader; no plate-path demotion; no shell unification (SP-LID-DISRUPTION design-noted, not built); no retirement of `magmatism.js`/`stagnantLid.js`; no single-sequence collapse (deferred past pilot).

---

## 6. RISK REGISTER (verdict RISKS carried verbatim-ish)

| # | Risk | Mitigation / status | Owner |
|---|---|---|---|
| **R-L** | Venus-vs-Mars separation, if forced onto `L` via `μProxy(T_surf)`, needs `L` **non-monotonic** in surface temperature (hot-annealed Venus AND cold-thick Mars both high-`L`, temperate Earth low). A monotonic `μProxy` cannot place both extremes at high-`L` — the `L` form is under-specified where it bites the two most-recognizable strong-lid worlds. | Non-monotonic `L` + `V` co-driving stagnant placement; pin form at delegable #1 | Technical → Max (taste on band) |
| **R-Φsize** | Φ omits gravity/mantle-depth (d³) unless the V2-0 size-aware proxy lands; two worlds with identical thermal but different size won't separate, costing distinct-worlds-per-minute. | Addressed by the §2.3 size-aware Φ redefinition; **verify the proxy actually separates Mars from Venus on real field values** | Technical |
| **R-wetstag** | Seeded-middle destinations into the pilot are **un-validated**: an Earth-mass temperate-WET body seeded 'stagnant' lands at the strong-lid end calibrated to hot/dry Venus → **likely "Venus with water."** This is the mush risk manifesting exactly where the research says determinism fails. | The V2-2 NEW stagnant response must differentiate on `V`+T_surf; **this is the §5.4 primary falsification** | Technical → Max UAT |
| **R-disrupt** | SP-LID-DISRUPTION is **not** existing shared machinery (Voronoi cells vs sparse corona pool — structurally different). §5 cantaloupe-silicate payoff books work on machinery that must first be **built**; risks the metasystematicity collapse the task warns against. | Demoted to future abstraction; cantaloupe demo design-forward only | Technical (V2-7+) |
| **R-marsgap** | "Closes the Mars gap with no 4th writer" **overclaims**: the ROADMAP defines the Mars gap as Tharsis volcanism PLUS cratered highlands (#5), hemispheric dichotomy, dunes (#7), early-active-then-frozen epoch (#6). The pilot delivers only the Tharsis volcanic-province part. | Reframed throughout as "Tharsis-volcanism part"; rest spans V2-5/7/8 | scope (Max) |
| **R-io** | Io as "weak `L`, pervasive shields" mischaracterizes the heat-pipe end-member (thick cold advecting lithosphere; real Io is patera+plains, low relief). `m_hp` does the real selection, so not load-bearing, but the legend was wrong. | Legend corrected (§2.4) | resolved |
| **R-centers** | SP-CENTERS unification reconciles two **disjoint, structurally different** plume-seeding streams with byte-identity at BOTH anchors; easy to under-size. | Dispatcher over two byte-preserved constructions; V2-2 sized XL+ | Technical |
| **R-g** | `g` routed only into `L` and absent from Φ leans placement toward "bigger→stagnant" (the O'Neill side of the unresolved Valencia/O'Neill dispute the brief flags as live). Defensible within the unbroken-lid family, but is a **modeling choice, not derived**. | Stated as a modeling choice; flag in E1 | Technical (declared) |
| **R-Vsize** | V2-2 bundles magmatism byte-anchor + from-scratch stagnant response + 6 SP-modules + new `localYield(L)` + dual-anchor byte-identity + mid-axis validation. "L–XL" was optimistic; this is **XL+, effectively 2–3 original increments**. | Sized XL+ here; consider splitting the stagnant-side MULTIPLY as a sub-increment | Max (scope) |
| **R-phantom** | The pilot's load-bearing decisions (`L` form, `localYield`) are **unwritten research**; the mixed-interior is the program's **first genuinely novel generative primitive** (prior increments cloned `plates.js`). The LOC estimate covers **implementation only**, after decisions #1/#2 are pinned. | Treat §7 delegable #1/#2 as a pre-code research gate | Technical → Max |
| **R-basestep** | baseStep reuse "verbatim" is impossible (grid op, internal locals, production-dormant). V2-0 activates never-integrated code via a refactor-to-export — touches a validated-but-test-only module. | Guarded by baseStep's existing suite | Technical |
| **R-exotic** | Condition-first **cannot derive authored-label archetypes** (crystal/technogenic/geometric — no distinguishing D-vector scalar). If E1's rocky threshold captures crystal, the shipped crystal despun world is clobbered; carbon survives only if C/O>1 beats density→rocky. | §1 label carve-out; each is an enumerated oracle adjudication | Technical (V2-3) |
| **R6-solver** | #6 fixed-point cross-tier solver still **unmechanized**; epoch cross-tier cycles blocked. "Bounded relaxation passes" ≠ "fixed-point cycle resolution." | Do-not-contract flag stands (V2-7 open problem) | Max (defer or fund research) |
| **R8-slip** | #8 (V2-9) slips → program silently ships ~8-of-11. | The split; carbon/crystal cheap E1 terminals | Max (scope) |
| **R-float32** | Game port float32 at ship scale. | Separate world-origin rebasing track gates V2-10 | separate track |
| **R-atmo** | Atmosphere frozen-constant residue persists if V2-6 MULTIPLY slips. | Flagged PENDING-MAX in ATMOSPHERE-PLAN §e | Technical, flagged |
| **R-clock** | generative-not-simulative: V2-7 "epoch clock" is loose wording. Keep epochs **discrete-composition, byte-identical at `epochs=1`** — no per-Myr loop. | Wording locked to discrete painted epochs | resolved |
| **R-marspreset** | Mars falls-out is validated at V2-2 but the Mars **preset** only exists at V2-3; the acid test uses a **hand-set D-vector** until then. | §5.4 uses a hand-set vector explicitly | Technical |

---

## 7. OPEN DECISIONS

### 7a. Max-owned (taste / UAT / scope — no agent closes)

| Decision | Recommendation to bring |
|---|---|
| **Pilot go/no-go:** do the §5.4 worlds read **coherent, distinct, never-observed** (not "Venus with water," not a faded catalog member)? | Ship the wet-stagnant + corona-pierced worlds for UAT |
| **Mushy-middle acceptance:** seeded-band width + whether the middle reads legible | Narrow band + province-discrete expression; surface the actual band |
| **Seeded-pick weights:** frozen constants vs UAT sliders | Frozen constants + lab override (mirrors `_driverAbMode`) |
| **V2-2 split:** ship the stagnant-side MULTIPLY as a sub-increment, given XL+ size (R-Vsize)? | Recommend splitting: magma-anchor router first, stagnant response second |
| **#4.5 residual geometry** (block-jumble scope) | Defer to V2-9a as a small primitive (diapir half → SP-LID-DISRUPTION) |
| **#8 split scope** (archetype-completers vs Tier-5 overlays; what's cuttable) | Split per ROADMAP's own recommendation |
| **Hysteresis / history-token input** | **No** — seeded pick suffices as the multistability representation |
| **Lab-only vs game-gating E1 now** | Lab-only (charter); game wiring = V2-10 |
| **Open UAT gates carried forward** (#1 AC11, #4b AC9) | Pilot must preserve #4b AC1–8 byte-identity |
| **Which presets may reroute (a fix) vs must stay byte-identical** | Reroute: Frozen(airless)→dead-lid, Mars→stagnant/dead. Byte-identical: Lava/Magma/Venus |

### 7b. Delegable technical (resolve in-build with confidence flags)

| Decision | Default | Flag |
|---|---|---|
| **1. `L` (lidStrength) form + Earth calibration** | `clamp01(f(ρgz)·μProxy(V, T_surf))`, **non-monotonic in T_surf**, anchored so `L(MAGMA_REF)<L(Venus)` — NOT the Earth mid-mobile point | **LOAD-BEARING, blocks the weak↔strong axis.** No `τ_y=180 MPa` constant; Earth is a calibration point, not a threshold. Must place both hot Venus and cold Mars high (R-L) |
| **2. `localYield(L,i)` per-center pierce threshold** | Calibrate so Io pierces pervasively, Venus almost never, at pinned vectors | The anti-mush lynchpin; sharp per-center boolean |
| **3. Two-anchor namespace reconciliation** | Keep per-branch streams disjoint (`'magma:*'`, `'stagnant:*'`) | Merged stream will NOT reproduce Lava/Magma/Venus bit-for-bit — zero-clobber non-negotiable |
| **4. Φ size-proxy form** | Radiogenic-scaled-by-mass + d³ (`shellThickness`) + raw-tidal; expose raw Io-ratio in the drivers bundle | Must separate small-cold Mars from Earth-sized Venus (R-Φsize) |
| **5. Surface temperature source** | Document the `T_eq` D-slot as **surface temperature**; feed `μProxy` from it | A greenhouse derivation (T_eq+pressure+CO₂) is a future refinement; downgrade temperature-axis confidence (D3-MF2) |
| **6. Heat-pipe threshold** | Raw pre-`calibrateTidal` Io-ratio, ~0.4–0.5, exposed as tunable | Do NOT threshold the visual-tuned `calibrateTidal` knee |
| **7. Mixed-interior ordering / edifice budget** | New absolute-datum stack; cap shield-edifice contribution below inter-province floor gaps | The §2.4 anti-mush bound; **include magma edifice heights, not just stagnant texture** |
| **8. `RELAX_PASSES` / belt-shape** | Fixed per-expression constants (justify, don't silently interpolate) | Bounded fixed passes only — never while-loop-to-threshold |
| **9. `V` (volatiles) entry** | Continuous modulator (effusivity/flood/lid-weakening/mobility) + E1 middle-band mobile-weight | Not a Stage-A gate only |
| **10. Dispatch 2-tuple consumption** | `compositionClass` first (gas/carbon/crystal terminal) → then `geodynamicRegime` | Confirm refactor shape before E1 emits |
| **11. baseStep scalar extraction** | Refactor baseStep to export pure per-body helpers, guarded by its tests | Single source of truth; avoids formula drift (R-basestep) |

**Pre-code gates:** delegable #1 and #2 are unwritten research and **block V2-2 coding** (R-phantom). Everything in §1–§5 is buildable once they are pinned.

---
*End ROADMAP v2 draft. Every MUST-FIX from the D1/D2/D3 verdicts is applied; [RESOLVED-BY-SYNTH] tags mark each place a fix overrode the source design so the human reviewer can audit the resolution.*
