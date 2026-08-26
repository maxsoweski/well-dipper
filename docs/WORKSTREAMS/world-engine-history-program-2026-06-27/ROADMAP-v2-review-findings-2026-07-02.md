# ROADMAP-v2 — 5-lens adversarial review findings (2026-07-02)

**Target:** `ROADMAP-v2-condition-first.md` @ `e517e80`. **Panel:** 5 independent opus reviewers (internal-consistency, code-grounding, goal-coverage, science-honesty, buildability), each instructed to self-refute candidates before reporting — items below are survivors only.
**Adjudicated verdict (working-Claude):** the condition-first architecture core survived all five lenses; every serious defect is synthesis compression (dropped, resurrected-after-retiring, or promised-without-funding). Deduped: **1 BLOCKER, 11 distinct MAJORs, ~13 MINORs. Do not adopt v2 as the program map until the fix-pass (→ v2.1) lands.**
**Cross-lens confirmations:** SP-LID-DISRUPTION-unfunded found independently by goal-coverage (F3/F4) + consistency (#5). Mars-framing issues found by consistency (#2) + science (F5). V2-1 unbuildability (buildability M1/M2) coheres with the consistency oracle findings (#1/#3). No inter-reviewer contradictions.

---

## LENS 1 — INTERNAL CONSISTENCY (5 MAJOR, 3 MINOR)

**IC-1 MAJOR — Dispatch keys on `E1.label` (V2-3 L129) vs coordinates everywhere else (§1 L49, §7b L307, §5.2 L220, §0 L25, §4 L195).** §1: "Writers branch on these coordinates, never on a label; `label === PRESET_ARCHETYPE` is the conformance oracle during migration, not an input." §4 prohibits archetype-string routing except at the regime-selection layer — `E1.label` is a derived string, so routing on it violates the doc's own invariant + Rule-15/AC-0. **Fix:** reword V2-3 → "Flip dispatch to E1's derived `{compositionClass, geodynamicRegime}`; retire `PRESET_ARCHETYPE` as dispatch key"; drop "E1.label". *Highest-priority single fix.*

**IC-2 MAJOR — Risk register resurrects the retired "acid test" (§6 L273 vs §5.4 L239/243).** §5.4 demoted Mars/Tharsis to a non-falsifying integration checkpoint; R-marspreset calls the hand-set-D-vector world "the acid test". **Fix:** R-marspreset → "the Tharsis-volcanism integration checkpoint".

**IC-3 MAJOR — Conformance oracle defined two incompatible ways.** §1 L49: `label === PRESET_ARCHETYPE`; §3.1 L127 + §5.2 L219: `writerUnder(e1) === writerUnder(PRESET_ARCHETYPE)`. They disagree wherever distinct archetypes share a writer (Lava/Magma/Io all → magmatism; E1 regime = "heat-pipe/weak-lid", not "Lava") — label-equality systematically fails volcanic presets. AC-CONFORMANCE(FINE) adds a third granularity, never reconciled. **Fix:** one operational oracle (writer-equality minus allow-list) in §1; declare FINE as a tier atop it.

**IC-4 MAJOR — §3.2 L149 re-equates Φ with thermal `H` that §2.3 L88-92 separated.** "elongation MAGNITUDE rides Φ (thermal `H`)" — the parenthetical undoes the [RESOLVED-BY-SYNTH] Φ≠thermalState resolution; an implementer could wire elongation to Φ, the exact regression §2.3 warns against. §4 L186 + §7b #4 are the authoritative consistent statements. **Fix:** delete "(thermal `H`)" from L149.

**IC-5 MAJOR — V2-7 "cantaloupe-silicate payoffs" (L134) depend on SP-LID-DISRUPTION, which §2.2 L74 / §6 L259 / §5.5 L248 uniformly call FUTURE/unbuilt and NO increment owns.** **Fix:** drop from V2-7 Unlocks, or fund SP-LID-DISRUPTION as an explicit increment. *(= goal-coverage F3/F4 root cause.)*

**IC-6 MINOR — "single blocking gate … #1" (L139) undercounts:** R-phantom (L265) + L310 say #1 AND #2 block V2-2. **Fix:** "#1 and #2" (now +interpenetration statistic → three; see buildability M4).

**IC-7 MINOR — §1 L46/51 exogenic list ("compose (#6)", E8b, E9) doesn't trace to §3:** #6 is epoch/host-editor (not an orthogonal overlay — it has hard deps on the pilot's channels); E8b/E9 have no distinct §3 homes. **Fix:** reconcile #6's identity; state E8b/E9 fold into V2-8.

**IC-8 MINOR — carbon flag cross-ref (§1 L53) points at §7; the flag lives in §6 R-exotic (L267).** **Fix:** "(flagged, §6 R-exotic)".

**Verdict:** core spine (E1, Option-A router, byte-identity-via-preserved-paths, ≥4-axis response space, Φ redefinition) propagates consistently; defects cluster in three un-propagated seams (dispatch mechanism, resurrected retired framings, unfunded unlocks). IC-1 and IC-3 must be resolved before V2-1/V2-3 contracts.

---

## LENS 2 — CODE-GROUNDING (all 10 claims VERIFIED; 3 MINOR footnotes)

Verification table: (1a) magmatism disjoint `alea('magma:count')`/`alea('magma:centroid')`, count∈[5,11) — VERIFIED `magmatism.js:190-199,45-46`. (1b) stagnantLid single interleaved `alea('stagnant:plumes')`, count∈[6,12), forced split, CORONA_POOL=120 — VERIFIED `stagnantLid.js:199-211,46,51,283-297`. (2) `magmaThermal H` at `magmatism.js:97-103`, raw clamp01 tidal not tanh — VERIFIED (nuance F1). (3) baseStep exports only `makeBaseStep`; thermalState/shellThickness/rawTidal internal locals — VERIFIED `baseStep.js:10,23,42,85` (nuance F2). (4) #4-M grain axis `alea('magma:grain:')` writer-private, magnitude via ELONGATION_GAIN·Hd — VERIFIED `magmatism.js:251-254,123,116-117`. (5) adaptive flood datum `mu0−FLOOD_Z·sigma0` + EDIFICE_HEIGHT=1.0 vs constant floors 0.70/0.10/−0.45 — VERIFIED `magmatism.js:377,76,57`; `stagnantLid.js:62,363`. (6) T_ss route-level `T_eq*1.4` locked — VERIFIED `planet-lod-rivers.js:473,479`. (7) regime∈{0,1,2} — VERIFIED `verify.js:39` (nuance F3). (8) 15 presets `world-engine-lab.html:1923-1938`; Frozen(airless)→'ice' `:1927`; Neptunian+Sub-Neptune both →'sub-neptune' `:1930-1931` — VERIFIED. (9) `D_EARTH`/`driversToTune` `plates.js:105,128,86`; `REGIME_WEIGHTS` `shellRelief.js:61` — VERIFIED. (10) locked non-excluded → eyeball-despun `shellRelief.js:51,39`; dispatch order `rivers.js:451→459→467→486→491` — VERIFIED.

**F1 MINOR:** "coincide only at MAGMA_REF" not rigorous — different age normalizations (`age/10` w/ inner clamp01 vs adaptL0 `ageNorm`) + raw-vs-tanh tidal; no clean equality point. Reword: "tidal terms coincide only where tidal≈0; age terms use different normalizations — not interchangeable." Conclusion (don't reuse thermalState as Φ) unaffected.
**F2 MINOR:** "baseStep called only by tests" misses `worldengine-fieldviz.html:25,33` (non-test viz harness, OUTSIDE the V2-0 refactor's test guard). Sphere path genuinely never calls it (relief-* callers import `relief-base-step.js`, a different file).
**F3 MINOR:** `verify.js:39` asserts `sub.regime` (substrate), not `carrier.regime` — same 3-valued taxonomy, wrong field owner named.
**F4 context note (not a defect):** TWO despun destinations exist — shell's 'eyeball-despun' (locked bodies, path:'shell') vs the final zonal fallback (unlocked, path:'despun'). Doc navigates it correctly (real Mars is unlocked → final despun); flag so contract authors don't conflate.

**Verdict:** highly trustworthy; no stale/wrong load-bearing claim; safe to contract from once F1-F3 footnoted.

---

## LENS 3 — GOAL COVERAGE (1 BLOCKER, 3 MAJOR, 5 MINOR; ~86-commitment independent ledger)

**GC-F1 BLOCKER — Atmosphere track loses 5 standing increments with no disposition.** ATMOSPHERE-PLAN.md = 9 increments (2 shipped: #3a, #2-emission). V2-6 carries only #3-wiring, #3b, derive-not-freeze. DROPPED: atmo **#4** (EMISSION v2: aurora+lightning+airglow+magnetic-dipole driver), **#5** (brown-dwarf/directly-imaged — archetype with ZERO home in any map), **#6** (rock-vapour atmosphere: dayside presence-mask, terminator rock-rain), **#8** (Mars thin-CO₂: dust relaxation-oscillator, frost caps, thermal tide), **#9** (Pluto/Triton sublimation: blue-haze comb, seasonal p_s collapse). Refutation attempt failed: v2's header grants only ROADMAP.md notes sub-detail standing; one "L" increment ≠ 5-7 increments. **Fix (adopted as default):** restore ATMOSPHERE-PLAN.md as first-class parallel sub-plan; V2-6 = pointer row ("continues unchanged; 2 shipped, 7 remaining; size L→XL"); add brown-dwarf coverage row.
**GC-F2 MAJOR — E13 transient + E14 inhabitation vanish.** v1 #8 Tier-5 = six overlays; V2-9b lists four. **Fix:** add E13/E14 to V2-9b (default: restore; cutting would be a Max call).
**GC-F3 MAJOR — #4.5 favored diapir geometry punted to unfunded owner-less SP-LID-DISRUPTION** — v1 made it an explicit Max choice between two BUILDABLE options; v2 funds only block-jumble. **Fix:** give SP-LID-DISRUPTION an owning increment or state plainly the geometry choice is forced.
**GC-F4 MAJOR — V2-7 cantaloupe unlock unfunded** (same root cause; = IC-5).
**GC-F5 MINOR —** V2-9 missing V2-4 dep; the "palette DERIVED from province, not noise" anti-bag-of-overlays guard unwired. Fix: add dep + restate as V2-9b AC.
**GC-F6 MINOR —** #5.5 fine print: restore (i) accommodation = SINK-RANKING only, no CYCLE-1 mass-conservation claim (volume budget belongs to #6); (ii) figure must ORIGINATE w0 from drivers.
**GC-F7 MINOR —** #6 solver requirements compressed: surface Jacobi-not-Gauss-Seidel + volumetric-budget into R6-solver/V2-7.
**GC-F8 MINOR —** sub-Neptune "resolved by label demotion" drops the radius hazard (Neptunian→gas-giant flips seeded radius [2.5,4.0]→[6.0,14.0] = Jupiter-sized Neptunians; need `ScaleConstants.js` ice-giant range or keep key). Fix: note in V2-3.
**GC-F9 MINOR —** `moons:[]` system-graph prerequisite for rings/E4 not carried into V2-9b.
**Checked-and-cleared (do NOT re-litigate):** #4-M grain-source change (declared D2-MF7); Mars acid-test replacement (declared); north-star metric reframe (declared); #5 preset blocker (fixed by V2-5); #5.5 five fields all carried; SPINE-CONFORMANCE carried; #7 volcanic-weathering note carried; §e derive-not-freeze carried; emission "shipped, whole" accurate.
**Scorecard:** ~86 audited / ~63 carried / ~5 relocated-declared / ~18 dropped-or-narrowed (9 findings; F1=6 items). **Verdict:** "nothing loses coverage" substantially true for the ground endogenic re-architecture, false as a whole-program claim; do not adopt until F1-F4 resolved or converted to declared cuts.

---

## LENS 4 — SCIENCE HONESTY (2 MAJOR, 3 MINOR)

**SH-F1 MAJOR — §0 L15 (+§1 L49) still enumerates the hot-surface/Venus edge as "physics-derived"** while §2.3 L94 retracts it ("data-placed, not physics-derived") and the brief marks it "agreed outcome, contested mechanism" (Lenardic stress-reduction vs Noack/Breuer healing — different intermediate-case predictions). **Fix (L15):** "Physics-derived at three edges (dead lid, heat-pipe, icy convect-vs-conduct); the hot-surface stagnant edge is outcome-agreed but data-placed (surface-temp anchored), mechanism contested — see §2.3."
**SH-F2 MAJOR — `shellThickness` triple duty:** one field supplies lithosphere z (in L), icy shell D (shell-Ra), AND rocky mantle depth d (Φ's d³) — three distinct thicknesses (~30× apart on Earth); brief derives rocky d from mass/gravity and keeps z/D/d separate. R-Φsize's outcome test won't catch it. **Fix:** add coherence-risk flag to §7b #4: confirm shellThickness semantics + distinct transforms for z vs d before treating d³-from-shellThickness as a vigor derivation.
**SH-F3 MINOR —** R-g's two-camp (Valencia/O'Neill) framing omits the brief's modal position (mass is NOT the controlling lever — weakening dominates; Noack non-monotone 1-5 M⊕; "a selector keying regime on mass alone is choosing a camp"). Add the caveat sentence.
**SH-F4 MINOR —** heat-pipe "~0.4-0.5" reads as calibrated precision; actually licensed (≈ brief's ≳1 W/m² over Io's ~2.2) but restate as order-of-magnitude peg, model/epoch-dependent.
**SH-F5 MINOR —** non-monotonic `L` presented as necessity; brief reads Mars as LOW-Φ (low vigor), which would leave L monotonic. **Feed into delegable #1 as an explicit modeling fork** (route Mars via lid strength OR via low vigor).
**Cleared:** seeded middle faithful (nudge directions verbatim from brief); wet-stagnant licensed + handled with exemplary caution; τ_y non-generalization honored; episodic silence is under-specification not laundering.
**Verdict:** faithfully transmits the brief's uncertainty structure; laundering localized to the summary layer (F1) and one derivation (F2).

---

## LENS 5 — BUILDABILITY (4 MAJOR, 2 MINOR)

**BU-M1 MAJOR — V2-1's conformance oracle has no headless preset source.** `DRIVER_PRESETS` is inline in `world-engine-lab.html` (~L2641), not importable; tests string-scrape it (`tests/planet-archetypes.test.js:16,25`); `planet-archetypes.js` exports taxonomy only. **Fix:** add V2-0 deliverable "extract DRIVER_PRESETS → importable presets.js" (or 15-vector fixture; state which).
**BU-M2 MAJOR — `computeE1` cannot form its condition vector at the dispatch seam.** `route()`→`writeBodyRelief` gets `{archetype, locked, grainDrivers, bodyDrivers, macroSeed, heightSeed, T_eq}`; `bodyDrivers` = `{massGravity, volatileFraction, tidalHeating, thermalState}` (lab `2881-2889`; age folded-then-dropped `2858-2866`). MISSING at seam: composition/density (Stage-A, consumed FIRST per §7b #10), age, radius (d³), eccentricity/orbit (raw Io-ratio for m_hp), shellThickness. All exist in `_fp` but stop at the lab. Byte-safety of widening: LOW risk — `driversToTune` (`plates.js:127`) + `magmaDriversToTune` (`magmatism.js:113-124`) `?? D_EARTH`-default and ignore unknown fields. Note: AC-BYTE-LAVA/MAGMA routing decision (pure-weak) needs density/composition — safe in shadow (dispatch still string), risk lands at V2-3 flip. **Fix:** explicit V2-0/V2-1 line "thread full body condition-vector through route()→writeBodyRelief (byte-safe: tune builders ignore unknown fields)."
**BU-M3 MAJOR — AC-MIX-DISCRETE unmeasurable without per-node primitive-id:** within-province BOUNDED-CONTINUOUS legitimately produces heights indistinguishable from forbidden blends by height-array inspection. Precedent: `magmatism.js:220` `plumeId:Int32Array`. **Fix:** `writeLidResponseSphere` must emit `primitiveId`; restate AC as "every node's height derives from exactly one primitive keyed by primitiveId."
**BU-M4 MAJOR — interpenetration statistic is a named unsolved measurement** (zero metric infra in repo) — yet it's the ONLY automated new-landform discriminator. **Fix:** "define + validate interpenetration statistic" (e.g. cross-type nearest-neighbour mixing index over primitiveId) = pre-V2-2 design deliverable, co-located with delegable #2. **Pre-code gates are now THREE.**
**BU-MINOR-1 —** "15 presets" ambiguous: PRESET_ARCHETYPE=15 entries but DRIVER_PRESETS=17 (Mars `2726` + Hot Jupiter `2701` have data, no archetype mapping). V2-3 "Add Mars preset" → "add Mars archetype MAPPING + routing"; state oracle count.
**BU-MINOR-2 —** "survives one release" has no referent for a lab; define retirement trigger (e.g. post-V2-3 verify-workstream green + Max UAT).
**Holds up:** baseStep claims accurate (7 test files pin the exact scalars — `worldengine-base-interior` pins thermalState/shellThickness/loveK2); gates #1/#2 genuinely resolvable in-repo (surfaceGravity `baseStep.js:14`, T-slot, volatileFraction, per-center `hotspotProximity` `magmatism.js:291`) — design passes, not data holes.
**Sizing:** V2-0 credible ONLY with the two plumbing deliverables added; **V2-1 NOT scopable as written** (fold M1+M2 in → clean M-L); V2-2 build tasks clear but acceptance tests un-startable until primitiveId + statistic exist.
