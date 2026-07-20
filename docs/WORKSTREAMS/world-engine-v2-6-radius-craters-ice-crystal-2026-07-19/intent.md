# world-engine-v2-6-radius-craters-ice-crystal-2026-07-19 — intent

## Why we care

Max's V2-5 UAT verdict (2026-07-19, verbatim in that contract's statusNote) found the crater
system physically incoherent in exactly the ways the driver-wiring audit then traced to root
causes: craters only read at high gravity (an unphysical `K_GD` count law manufactures ~2,900
craters / 255% bowl coverage at Moon gravity — saturated mush), planet radius drives nothing
(crater sizes are frozen angular constants; deeper, `deriveConditionVector` computes gravity
from the canonical preset radius so every downstream law is drawn-radius-blind by construction),
Frozen reads "less distinct" (no condition-derived surface material exists — ice renders
rock-brown), and Crystal is "a mishmash… probably should be a downstream driver like fungal."
This increment is the physics-first answer to all four findings at once, plus the "no defaults"
reseed (`newPlanet` re-rolls a drawn radius from one worldSeed). It is the root increment the
rest of the audit queue sequences behind: gravity coherence must land first or radius enters
every later law twice, inconsistently.

**Outcome line of sight:** World Engine → screensaver-MVP hero renderer whose worlds are
physics-derived populations, not hand-tuned boots (charter §INTENT FRAME). This increment makes
the two most-viewed terrain reads (craters, ice) honest functions of the drawn world.

## Success criteria (Max's words, 2026-07-19)

- "We need to make sure all relevant drivers are 'hooked up' to any new/revised feature BEFORE
  UAT" — the driver enumeration below closes craters/ice/crystal against the full driver set.
- "There should be no default; there should be seeds that are procedurally generated using these
  physics-derived driver rules" — `newPlanet` re-rolls radius; acceptance targets an N-seed
  population, not a boot state.
- "Replicate what we've observed in the real world and extrapolate from there" — every new law
  in this contract is a published scaling (π-group gravity size law, bounded-Pareto SFD, Neukum
  chronology shape via production-vs-retention, Arrhenius ice rheology) or a derivation from one.
- Crystal: "defer crystal until we get the more commonplace terrain types working… probably
  should be a downstream driver" — 1F promotes the driver honestly; the facet layer stays OUT of
  the default bake (Max's ruling #2, 2026-07-19).

## Product calls already ruled by Max (2026-07-19 — "All three sound good to me")

1. Ejecta rays / fenced albedo channel: DEFER — height-only this campaign (fence renegotiation
   stays attached to Increment 8).
2. Crystal facets stay out of the default bake; Increment 1F makes the driver honest either way.
3. Super-Earth crater sparsity: ACCEPT the honest 1/R look — big worlds read nearly crater-free
   at global view; small worlds are the crater showcases.

## Driver enumeration (per feedback_wire-relevant-drivers-before-uat)

| Driver | Status this increment |
|---|---|
| surfaceGravity (D14) | WIRED — size keeps `K_GS` g^−0.17 (correct π-group physics); count decoupled from g entirely (`K_GD` removed — primary impact count does not depend on surface gravity) |
| radiusEarth | WIRED — the headline: km-space SFD → angular size ∝ 1/R via `radPerKm`, count ∝ R², D_MAX = c_basin·R_km; plus the root gravity-coherence fix so g itself derives from drawn R |
| age (D16) | WIRED — production-vs-retention (age-ordered obliteration stamping); density-below-plateau makes age visible |
| T_eq | WIRED — ice relaxation viscosity is Arrhenius in T; Frozen (60 K) honestly crisp, warm icy worlds relaxed |
| rotationHours | IRRELEVANT — no first-order dependence of impact cratering on spin |
| rawTidalIoRatio | WIRED — binary gate → continuous exposure age (t_resurf ∝ 1/tidalHeat; Europa ≈0 craters by physics, not gate) |
| density/composition/volatileFraction | WIRED — mass derivation M=(ρ/ρ⊕)R³ for gravity coherence + condition-derived iceness material scalar (the Frozen material answer) |
| atmosphere.pressure | WIRED — binary `CRATER_ATMO_MAX` → graded floor D_min_km ≈ c·P^~0.65 |
| Crystal (F43) inputs | WIRED — boolean `_facetClass` → continuous `crystallizationPotential = airlessness·(1−erosion)·(1−resurfacingRate)·pristine(bombardment)`; `bombardmentIntensity` derived from `craterSchedule` output (bombardment becomes crystal's upstream driver, "downstream driver like fungal") |
| Deliberately unwired (surface to Max pre-UAT) | Ejecta-ray albedo (Max-deferred, Inc 8); composite relief-scale spine (Inc 3, sequenced after this so it sizes against coherent g); regolith diffusion detail (Inc 8); rot (irrelevant, above) |

## DOES / UNLOCKS (Rule 15 card)

**DOES:** derives gravity from the drawn radius at the condition-vector root (fixing the
`massEarthOf` incoherence); rewrites the bombardment schedule into km-space physics (SFD,
count ∝ R², obliteration equilibrium, continuous tidal/atmo floors); adds ice relaxation +
an iceness material scalar; promotes Crystal's predicate to a continuous condition-derived
scalar on its own unhashed channel; re-rolls radius per world from one alea-namespaced
worldSeed; ships a population calibration harness (`population-sweep.mjs`).

**UNLOCKS:** Increment 3 (relief-scale spine — needs coherent g), Increment 8 (exogenic
dressing on an honest SFD), Increment 9 (full no-default population — extends the worldSeed
namespaces), the epoch editor's thresholdable crater floors, and every future radius-consuming
law (`radPerKm` becomes the shared angular-scale derivation).

## Known legitimate churn (declared up front)

`tests/worldengine-v2-5-bombardment.test.js` pins current calibration constants and
`forEachCrater`'s stream contract — restated WITH the physics derivation recorded (audit §3;
calibration constants are not golden-fixture material). `craterField` is unhashed by design.
The 75-golden HASHED_FIELDS fixtures are NEVER re-captured — byte-identity is AC-FENCE.

## Provenance

Scoped from `~/briefings/driver-wiring-audit-2026-07-19.md` §3 Increment 1 (+ §2 matrix
footnotes 1–6, 13; §5 analyst appendix) under the standing greenlight recorded 2026-07-19.
Verified session facts (gravity incoherence, saturation numbers, Frozen≈Moon population,
rhines call sites) carried from `~/briefings/handoff-lane-A-overnight-ultracode-2026-07-19.md`.
