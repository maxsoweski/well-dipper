# V2-6 BUILD-NOTES — Radius / Craters / Ice / Crystal

Spine-conformance close-out for `world-engine-v2-6-radius-craters-ice-crystal-2026-07-19`.
Companion to `BUILD-PLAN.md` (the laws) and `contract.json` (the ACs). Anchors are SYMBOLS, never
line numbers (durable-doc discipline). Written at the S6 seam, 2026-07-20.

---

## record-build-intent — what this increment DOES, in plain language

The condition vectors already carried a radius, but nothing downstream believed it: gravity was frozen
at each preset's canonical value, and craters were drawn in an angular power-law that never asked how big
the planet was. This increment makes the DRAWN radius physically load-bearing:

- **Gravity coheres with the drawn radius.** `deriveConditionVector`'s `surfaceGravity` now scales as
  `g_c·(R/R_c)` — the same composition class at a bigger radius weighs more and pulls harder. Byte-exact at
  canonical R (every golden/NAMED_BODY/headless path passes `R === R_c` ⇒ ratio `1.0` ⇒ bit-identical),
  coherent off-canonical.
- **Craters are drawn in kilometres, converted to angle at the target.** A fixed-km crater subtends a
  smaller angle on a bigger planet (`radPerKm ∝ 1/R`), and the impactor count scales with target area
  (`N_analytic ∝ R²`). The count is gravity-INDEPENDENT by physics (`K_GD` removed); only crater SIZE
  scales with gravity (`sizeMul = (G_REF/g)^K_GS`, kept exactly).
- **Crater equilibrium is emergent, not coded.** Oldest-first obliteration stamping (a bowl RESETS the
  field, rims/ejecta accumulate) makes `N_ret = N_eq·(1−e^{−N_prod/N_eq})` fall out of the physics — no
  tanh saturation formula does the capping.
- **Ice craters relax with an Arrhenius law.** Cold-airless worlds (Frozen at 60 K) are byte-identical to
  the unrelaxed profile (`1−e^{−t/τ} === 0` exactly); warm/tidal ice (Enceladus-class) domes its crater
  floors while short-wavelength rims persist.
- **New condition-pure material scalars** (`icenessOf`, `erosionOf`, `crystallizationPotential`) drive
  render albedo and a downstream carve-out — all from condition scalars, no label/archetype/dispatch read.

### Deliberate NON-GOALS (surfaced so no one reverse-engineers intent from silence)

1. **`rawTidalIoRatio`'s R⁵ fallback is NOT made radius-coherent** — the audit's cross-cutting table names
   only `g`; tidal-heat coherence is a later increment. Recorded in BUILD-PLAN §1A.
2. **`shellRelief.js` AC-0 radius grep-ban is NOT lifted** — the lift protocol belongs to a later increment
   (FENCE 5). Legacy F2/F3 crater/ejecta synth untouched; ejecta stays height-only (Max ruling #1).
3. **Crystal's `_facetClass` lab wiring is NOT flipped, and NO CRYSTAL_HI/LO extreme thresholds are pinned**
   — this is the AC-CRYSTAL adjudication carve (see below).
4. **`regolithRoughness` (sub-floor SFD mass) is COMPUTED but not yet rendered** — the closed-form
   sub-mesh-floor crater mass folds into a `craterSchedule` scalar and rides the `relief.surfaceMaterial`
   channel, deferred to the **regolith/micro-relief increment (Increment 8)** as its ready consumer input.
5. **The exposure-age erosion term is an ADDED completion** beyond footnote 5's tidal-only wording (see
   Deviations #2 in BUILD-PLAN §8) — surfaced for Max, not silently baked.

---

## DOES / UNLOCKS (Rule 15 card, restated AS-BUILT)

**DOES (as shipped across S1–S6):** derives gravity from the drawn radius at the condition-vector root
(`deriveConditionVector` `surfaceGravity = g_c·(R/R_c)`, byte-exact at canonical R — resolving `massEarthOf`
incoherence with zero edit to `e1Regime.js`); adds the `radPerKm`/`KM_PER_EARTH_RADIUS` derived scalars in
`baseStep.js`; rewrites `craterSchedule`/`writeBombardment` into km-space physics (bounded-Pareto SFD B=2.0
in km, angular size `= D_km·radPerKm ∝ 1/R`, closed-form `N_analytic ∝ R²`, `K_GD` removed so count is
gravity-independent while `K_GS = 0.17` size scaling is kept, graded atmo floor `∝ P^0.65` replacing binary
`CRATER_ATMO_MAX`, continuous tidal+erosion exposure age replacing the binary tidal gate, deep-envelope
`P_SURF_MAX` impact-surface clause, sub-mesh-floor SFD mass folded analytically into `regolithRoughness`);
makes crater equilibrium emergent via oldest-first obliteration stamping (bowl RESETS, rim/ejecta accumulate)
with the legacy `CRATER_SAT_N` tanh surviving only as a safety clamp; adds Arrhenius ice relaxation in
`craterProfile` (bit-identical to unrelaxed at 60 K, domed floors + persistent short-λ rims on warm/tidal
ice); ships the condition-pure `surfaceMaterial.js` module (`icenessOf`, `erosionOf`,
`crystallizationPotential(cond, schedule)`, `deriveSurfaceMaterial`) driving a render-side
`uIcenessMix`/`uIcenessAlbedo` albedo pair and the `relief.surfaceMaterial` return channel; re-rolls radius
per world from one alea-namespaced `worldSeed` (`newPlanet` GUI button + `draw:radius/macro/detail`
namespaces, `mulberry32` retired for new draws, draw law extracted to `driver-presets.js`); and ships the
`population-sweep.mjs` acceptance harness (64-seed × archetype, pinned gates).

**UNLOCKS (as-built):** Increment 3 (relief-scale spine — now sizes against coherent g); Increment 8
(regolith/micro-relief — `regolithRoughness` computed and riding the channel, awaiting its render consumer;
exogenic dressing on an honest SFD); Increment 9 (full no-default population — extends the worldSeed alea
namespaces); the epoch editor's thresholdable crater floors (exact pre-clamp on zero-overlap retained
craters, order-thresholdable post-clamp on all); and every future radius-consuming law (`radPerKm` is now the
shared km→angular derivation). AC-CRYSTAL's extreme-agreement clause + the lab `_facetClass` flip remain
gated on Max's adjudication (below) — NOT unlocked by this build.

---

## AC-0 — named consumers (spine-conformance driver-connectivity law)

Every new driver has a named, wired consumer. The AC-0 grep sweep confirms `bombardment.js` and
`surfaceMaterial.js` read only condition scalars + `radPerKm` — zero `.label`/`archetype`/
`geodynamicRegime`/`PRESET_ARCHETYPE`/`computeE1`/`e1Regime` substrings (incl. comments). No new
`*Enabled` key, no `FEATURES` entry, no guard-table edit.

| Driver (symbol) | Produced by | Named consumer(s) |
|---|---|---|
| `surfaceGravity` (coherent) | `deriveConditionVector` | `craterSchedule` (`sizeMul`), `computeE1` (`massEarthOf` → Φ/L routing), all downstream g reads |
| `radPerKm`, `KM_PER_EARTH_RADIUS` | `baseStep.js` | `bombardment.js` `craterSchedule` km→angular conversion; `population-sweep.mjs` |
| `icenessOf(cond)` | `surfaceMaterial.js` | (1) `bombardment.js` `iceRelaxation` gate (ε × iceness); (2) render uniform `uIcenessMix`/`uIcenessAlbedo` in `planet-lod-uniforms.js` beside the frost block, mixed in the lab Stage-6 albedo, driven in `applyDrivers` from `icenessOf(_cond)`; (3) `relief.surfaceMaterial.iceness` return field |
| `erosionOf(cond)` | `surfaceMaterial.js` | `craterSchedule` `t_exp` erosion term (Rocky/Ocean crater-retention shortening) |
| `crystallizationPotential(cond, schedule)` | `surfaceMaterial.js` | `relief.surfaceMaterial.crystallizationPotential` channel field (downstream-consumable; lab `_facetClass` flip deferred — adjudication) |
| `regolithRoughness` | `craterSchedule` (sub-floor mass) | `relief.surfaceMaterial.regolithRoughness` channel field → **Increment 8 (regolith/micro-relief)** |
| `deriveSurfaceMaterial(cond, schedule)` | `surfaceMaterial.js` | `writeBodyRelief` `relief.surfaceMaterial` return-object field (the `relief.figure` precedent: pure, no carrier, byte-inert, populated on every dispatch path) |

`relief.surfaceMaterial` channel shape (final, post-S4): `{ iceness, crystallizationPotential, regolithRoughness }`.

---

## AC-POPSWEEP — the operational definitions the contract phrase required (Lens L20)

The contract says "bowl coverage in [10%, 80%] for ≥90% of mature impact-surface seeds." Two terms needed
pinning; both are hard-coded in `population-sweep.mjs` and reproduced here.

- **Coverage metric** = the closed-form drawn-population coverage `craterSchedule.coverage`
  = `N_analytic · E[(δ/2)²]/4`, with `E[D²] = 2L²·ln(H/L)/(1−(L/H)²)` for the bounded-Pareto B=2 draw.
  This is the exact quantity `F_REF` was calibrated against in `crater-sfd-km.mjs` (step-0). It is NOT a
  stamped-bowl pixel count (which legitimately exceeds 100% at old ages under equilibrium palimpsest).
- **"MATURE impact-surface seed"** (the ≥90% denominator) = `isImpactSurface(cond) && screen ≥ SCREEN_MATURE
  (0.9) && t_exp ≥ K_EXP_MATURE (0.25)·age`. Airless, substantially-unscreened, substantially-exposed
  surfaces. Erosion-shortened seeds (Rocky/Ocean/Eyeball — an atmosphere drives `t_exp ≈ 0.1 Ga` ⇒
  coverage ≈ 0 BY PHYSICS, not by a gate) are reported in a SEPARATE row and never counted against the band.

### First-run acceptance table (2026-07-20 — the values pinned into `REGIME_PIN`)

`N_SEEDS = 64`, 11 seed-varying archetype presets, ~10k-node carrier mesh, total ≈ 1.7 s (budget 600 s):

| preset | archetype | impact | E1 distinct (k) : allow-list | MATURE cov mean |
|---|---|---|---|---|
| Rocky (Earthlike) | terrestrial | yes | 3 : rocky/episodic, rocky/mobile, rocky/stagnant | erosion-suppressed |
| Lava (hot airless) | lava | no | 1 : rocky/heat-pipe | — |
| Ocean (temperate) | ocean | yes | 3 : rocky/episodic, rocky/mobile, rocky/stagnant | erosion-suppressed |
| Frozen (airless) | ice | yes | 1 : icy/dead-lid | 41.0% |
| Gas giant (Jovian) | gas-giant | no | 1 : gas/dead-lid | — |
| Gas giant (Saturnian) | gas-giant | no | 1 : gas/dead-lid | — |
| Ice giant (Neptunian) | sub-neptune | no | 1 : gas/dead-lid | — |
| Sub-Neptune (hazy) | sub-neptune | no | 1 : gas/dead-lid | — |
| Eyeball (locked temperate) | eyeball | yes | 3 : rocky/episodic, rocky/mobile, rocky/stagnant | erosion-suppressed |
| Carbon (high C/O) | carbon | no | 1 : carbon/dead-lid | — |
| Crystal (faceted) | crystal | yes | 1 : icy/dead-lid | 36.9% |

MATURE denominator = Frozen + Crystal = **128 seeds; 128 in [10%,80%] = 100%** (need ≥90%); coverage
variance `1.01e-3` (nonzero — the metric genuinely sweeps with drawn R). A rerun must reach ≥ each preset's
pinned `k` AND stay ⊆ its allow-list; a new label (physics changed) or lost diversity both FAIL the harness.
The machine-readable record is `calibration/population-sweep-summary.json`.

Presets NOT swept: the NAMED_BODY set (Moon/Mercury, Mars, Titan, Europa, Venus, Magma, Hot Jupiter) locks
the canonical radius ⇒ zero radius variance ⇒ not a drawn "population." Their canonical behaviour is the
byte-golden's job, not the sweep's.

---

## AC-LAB-LEGIBLE envelope (code-side; the live drive is working-Claude's)

The Moon/Mercury boot (canonical 0.38 R⊕ lock) is the legibility target working-Claude drives against on
`:5175`:

- **coverage = 42.9%**, `nAnalytic = 2.14e6`, `nStamp = 147`, **nRetained = 71** (on the ~10k-node mesh).
- MATURE-set coverage envelope across the drawn population: **[33.7%, 46.1%], mean 39.0%.**

A live boot reading materially outside this band (a blank sphere, or a saturated mush) is the AC-LAB-LEGIBLE
failure signature; inside it is the pass target. These numbers are reproduced by
`node calibration/population-sweep.mjs`.

---

## AC-CRYSTAL — adjudication flag (Lens L9 — STILL OPEN, Max's morning ruling)

**Four of five AC-CRYSTAL clauses closed** in S4: purity grep, continuity on [0,1], wiring proof
(explicit-schedule-parameter construction + a `radiusEarth` perturbation spy — gravity deleted from the spy
because the count path is g-independent post-`K_GD`, AC-GCOUNT), and the default-bake facet-weight-0 check.

**The extreme-agreement clause is `deferred-to-adjudication` — mathematically unsatisfiable, not a build
gap.** The presets are condition-scalar DEGENERATE where the old `_facetClass` boolean discriminated: the
new `N ∝ R²·chronN(age)` count law makes Crystal (R 0.8) the MOST-impacted airless world, so the honest
`(1−bombardmentIntensity)` term drives Crystal's derived potential BELOW Moon/Mercury and Frozen —
INVERTING the old-boolean ranking (Crystal was the sole boolean-TRUE), and Carbon (not an impact surface ⇒
zero bombardment) derives ≈max while boolean-FALSE. `clamp01` preserves the count-law ordering for EVERY
`N_BOMB_REF`, so no threshold pair can make Crystal read high while Moon/Frozen read low.

The decision artifact is `calibration/crystal-scalar.mjs` (old-boolean column beside the derived column,
flips highlighted; exits 0, asserts the contradiction still holds and prints a loud VERDICT if it ever
changes). **The lab `_facetClass` path stays live and untouched this build** — flipping it to the honest
scalar would turn Crystal's facets OFF live (the one archetype whose identity IS facets), a product
regression Max has not ruled on. Recorded options (BUILD-PLAN §1F): (a) restate extreme agreement as an
ordering/threshold claim the derived scalars can satisfy [recommended]; (b) a physically-motivated
discriminating term [none found]; (c) amend Crystal's canonical data [ABORT-adjacent under FENCE 1/2].

---

## Deviations summary (as-built vs BUILD-PLAN)

Full rows with derivations live in BUILD-PLAN §8; this is the increment-level roll-up. Nothing silent.

- **S1:** none.
- **S2 · Deviation #1 — `AGE_MAX = 4.6 Ga` surface-age cap** added to `craterSchedule` before `chron(age)`.
  The published Neukum chronology diverges exponentially; an unphysical `age` (older than the ~4.567 Ga
  solar system) drove `N_stamp` toward ~1e15 / an unbounded stamp loop. A surface cannot predate the solar
  system, so the cap is physically correct — INERT on every preset (max preset age 4.5), bounds
  `N_stamp ≤ ~300 ≪ N_STAMP_SAFETY`. AC-EQUILIB's old-age plateau now lands exactly at the cap; the
  obliteration signature is unaffected. Adjudicable for Max.
- **S2 · Deviation #2 — erosion-completion priors pinned:** `P_ER_REF = 0.5`, `DRY_ER_FLOOR = 0.1` (in
  `surfaceMaterial.erosionOf`) and `T_RESURF_ERODE = 0.1 Ga`. The plan gave the erosion FORM (footnote-13
  `smoothstep(0,P_ER_REF,P)·max(waterWindow,DRY_ER_FLOOR)`) as the §4-adjudicable "ship-it-and-flag"
  completion but not the values. Chosen so Rocky/Ocean (P≈1 bar, liquid-water T) reach erosion≈1 ⇒
  `t_exp ≈ 0.1 Ga` (real Earth crater-retention age) ⇒ ~zero stamped craters, while airless worlds keep
  full-age exposure. Closes the "Rocky/Ocean/Titan boot Moon-cratered" live regression the audit did not
  intend. AC-GCOUNT/RADIUS-LAW/EQUILIB unaffected (measured on airless fixtures where erosion=0). Surfaced
  for Max.
- **S2 · record (not a plan-deviation) — `F_REF = 488000`** solved by the sanctioned step-0 closed-form
  pre-check (`crater-sfd-km.mjs`) against the [10,80]% coverage gate (MATURE-set geo-mean centred in-band:
  Moon 42.9%, Frozen 44.2%, Crystal 33.7%). The `F_REF` comment in `craterSchedule` cites this.
- **S3 · file-list expansion (the refuted-defect fix):** the plan's S3 file list named `planet-lod-uniforms.js`
  for the JS uniform but omitted the companion GLSL `uniform` declaration. Fix (`a1be480`) adds
  `uniform float uIcenessMix;` + `uniform vec3 uIcenessAlbedo;` to `HEIGHT_GLSL` in `planet-lod-height.glsl.js`
  (beside the `uFrostAlbedo` precedent, clear of the atmo-owned F24–F31 sections) so both the lab planet and
  the router HEIGHT_FRAG compile — the established link rule (`ws4-grain-scarp-wire.test.js`). No AC impact;
  byte-inert (uniform defaults to 0 ⇒ bare-rock ramp).
- **S4 · record — `N_BOMB_REF = 1.0e7`** pinned from the `crystal-scalar.mjs` table (§4-adjudicable prior).
  The AC-CRYSTAL ordering/inversion conclusion is `N_BOMB_REF`-invariant (recorded in the module comment +
  artifact), so this scales the scalar without moving the adjudication verdict.
- **S4 · in-plan carve (NOT a deviation — declared BUILD-PLAN §1E/§1F/Lens L8/L9):** the
  `relief.surfaceMaterial` 2-key→3-key shape restatement is the pre-declared channel change; the
  AC-CRYSTAL extreme-agreement clause + the lab `_facetClass` flip are `deferred-to-adjudication`, not built
  around (see the AC-CRYSTAL flag above). **MORNING-REPORT FLAG carried forward.**
- **S5, S6:** none.

---

## Suite baseline at the S6 seam

Full `npx vitest run`: **2207 passed, 4 failed** — the 4 are the documented pre-existing baseline
(KnownObjects ×3 + GalacticFeatures ×1), unrelated to this increment. The vendor/motion-test-kit
collection-error files are env noise (this increment touched only `calibration/*.mjs` and this doc at S6).
Golden byte suite (`tests/v2-0-byte-identity.test.js`) green — also spawned as a `population-sweep.mjs`
gate, so `node population-sweep.mjs` exiting 0 certifies the fence at the same commit.
