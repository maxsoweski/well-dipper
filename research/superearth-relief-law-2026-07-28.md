# What relief should a super-Earth have? — derivation + audit, 2026-07-28

**Why this exists.** Max's ruling on `BAKE_CROSS_SPAN`: *"We should go with whatever is
scientifically predicted for super earths/large terrestrial planets."* Physics-first world-engine
intent means the law is derived, not chosen. This is that derivation and the adversarial audit of it.

**Workflow** `wf_77f39c5b-88e` — 3 literature lenses + 1 codebase-law audit → derivation →
citation+physics audit. 6 opus agents. Raw record: `superearth-relief-law-2026-07-28.json`.

**Status: the derivation is NEEDS-FIX.** Direction is sound; ~9 specific claims must be corrected
before anything ships. Do not build from the derivation without folding the audit.

---

## ⚠️ Read this before using any number below

**There is no measured super-Earth topography. None.** No rocky exoplanet surface has been
spatially resolved — no image, no altimetry, no shape model, no topographic spectrum. McTier &
Kipping 2018 (MNRAS 475:4978, arXiv:1801.05814) find detection would need Colossus/OWL-class
apertures plus a Mars-sized planet transiting a white dwarf.

The Solar System contains **exactly one body at or above 0.9 g** (Earth). So:

> Every `g ≤ 1` anchor in the codebase is **CALIBRATION**. Everything above 1 g is **DERIVATION**.
> Those are different kinds of knowledge and the code comments must not let a future reader conflate them.

"Scientifically predicted" is the honest description. "Observed" would not be.

## Citation integrity — STRONG

20 load-bearing citations retrieved and checked: every DOI/arXiv ID resolved to the correct paper
with matching authors, year, venue; every reachable verbatim quote matched. **No fabrications.**

Three flagged, and one carries real load:

1. **Melosh 2011 lunar quote — UNVERIFIED and load-bearing.** *"Evidently strength is not the major
   factor limiting the Moon's topography: History must play a role"* could not be retrieved
   (textbook, not indexed). It is the **sole cited support for the entire piecewise structure**.
   The `h = 2Y/(ρ_c g)` formula itself is corroborated second-hand (Guimond+2022 eq. 21 attributes
   it to Melosh 2011), but a search surfaced a *different* Melosh maximum-height form,
   `H_max = (2c/ρg)·tan(45+Φ/2)`. **Do not ship the g = 1 break citing this until someone opens the book.**
2. **Kite, Manga & Gaidos 2009 verbatim quote — UNVERIFIED.** Paper is real and correctly cited
   (ApJ 700:1732); the quoted sentence was not retrieved. Open text at
   `sseh.uchicago.edu/doc/Kite_et_al_ApJ_2009.pdf`.
3. **Valencia et al. 2006 (arXiv:astro-ph/0511150) — NOT RETRIEVED**, load-bearing twice as a
   mass–radius cross-check.

---

## Finding 0 — my brief was wrong, and all three lenses caught it independently

I told the agents *"realistic compression softens the exponent (a ≈ 0.5–1.0)."* **Compression
steepens it.** Constant density gives `g ∝ R`; self-compression makes big planets denser.

**Zeng, Sasselov & Jacobsen 2016** (ApJ 819:127, doi:10.3847/0004-637X/819/2/127), verified verbatim:
`R/R⊕ = (1.07 − 0.21·CMF)·(M/M⊕)^(1/3.7)`, valid 1–8 M⊕ →

> **a = dln g / dln R = 1.70**, constant to 3 decimals over R = 1.0–2.0.

A 1.5 R⊕ planet is **4.5 M⊕ and 1.99 g** — not 1.5 g. `a ∈ [0.5, 1.0]` is unattainable for any
Earth-composition planet above 1 R⊕. This propagates into every downstream law.

## ⭐ Finding 1 — the codebase's gravity is wrong for super-Earths (the most actionable result)

`src/worldengine/base/body-condition-vector.js:37` sets `surfaceGravity = g_c·(R/R_c)`, and its own
comment states the assumption: *"M_derived(R) = M_c·(R/R_c)³ ⇒ g = g_c·(R/R_c)"* — constant density,
`g ∝ R^1.0`.

> The lab **under-reads a 1.6 R⊕ super-Earth's gravity by 39%** (1.60 vs 2.22).

This is upstream of relief, tectonics, magmatism *and* crater scaling — all of which take `g`. It is
a physics bug independent of the crossover question, and fixing it at the source is cheaper than
pre-distorting every downstream exponent to compensate.

**It also reframes the relief defect.** The audit's correction: with the *correct* `g = R^1.70`, the
existing `Q_RELIEF = 0.58` gives `h ∝ R^0.014` — essentially **flat**, not rising. So the residual
defect is a **slope error (constant vs falling relief), not a sign error**, and the derivation's
overshoot table double-counted the two fixes.

## Finding 2 — the amplitude law

    E(R) = clamp(g^-0.58, FLOOR, CEIL)   for g ≤ 1    [UNCHANGED — calibrated]
    E(R) = clamp(R^-2.70, FLOOR, CEIL)   for R > 1    [NEW — derived; = g^-1.588 once g is correct]
    FLOOR: 0.40 → 0.12     CEIL: 133 (unchanged, never binds)

Absolute form, where the physics lives: `h(g) = h_E · min(1,g)^-q`, **q = 1.0 (+0.6 / −0.3)**,
`h_E = 19.8 km` total dynamic range. Hard ceiling at any g: `h ≤ 2Y/(ρ_c g)`, Y = 100–200 MPa →
7.6–15.1 km at 1 g, 3.8–7.6 km at 2 g.

**`RELIEF_FLOOR = 0.40` must move.** At Q = 0.58 its comment is right that it binds only at g ≳ 4.85.
At the corrected exponent it binds at **g = 1.78, i.e. R = 1.40 R⊕, M = 3.4 M⊕** — the middle of the
population this whole exercise is about. It would clamp the entire super-Earth branch flat. It was
never derived; the comment says it was *"inherited from the reliefGravityFactor floor."*

### What the audit knocked down

- **"Four independent derivations" is at most two.** Routes (1) crustal strength, (3) Kite's crustal
  thickness contrast, and (4) basalt→eclogite are all *the same lever*: a fixed stress or pressure
  divided by ρg. Only Guimond+2022's convective dynamic topography is mechanistically distinct.
  The convergence claim was the derivation's strongest rhetorical move and it is overstated.
- **Route (4) is the derivation's own inference presented as citation-backed**, and Guimond's
  isostatic relation `h_A = (t_R − t_avg)(ρ_m − ρ_c)/ρ_c` **has no g in it at all**.
- **The break at g = 1 is DECLARED, not derived.** Guimond+2022 (verified verbatim) says eq. 21 with
  Y ~ 100 MPa *"will roughly reproduce the maximum elevations of Venus, Earth, and Mars"* — and Mars
  is at 0.378 g, well inside the branch the derivation calls supply-limited. Observed relief ÷
  strength ceiling: Venus 1.75, Earth 2.62, Mars 1.50, Mercury 0.49, Moon 0.44. The crossing falls
  between Mars and Mercury — **two bodies at effectively identical gravity (0.378 vs 0.377). The
  data cannot locate a break in g at all.**
- **"Statistically uncorrelated" from n = 5 is not a null.** And the regressed quantity (total
  dynamic range) is an extreme-value statistic sensitive to survey coverage — Mercury's 9.85 km is
  northern-hemisphere-only.
- **Spurious precision.** Q_hi = 1.588 quoted to 4 s.f. on an admitted bracket of [1.33, 2.20].

## Finding 3 — the pattern law (the actual gap), and the crossover verdict

**P1: plate count is invariant in R.** `N(R) = N_E·R^-0.07`; plate angular size ≈ 16.6° — invariant.
Anchor: Valencia, O'Connell & Sasselov 2007 (arXiv:0710.0699), verified verbatim: *"L/R increases
slightly, from a 0.29 for a 1 M⊕ planet to a 0.30 ratio for a 10 M⊕ planet."*

> **`plates.js:145-149` is CORRECT AS SHIPPED.** Do not add a radius term — that would be adding
> unphysical signal. Document it as a derived null law.

Audit caveat: this rests on **one modelled study**. The claimed "independent empirical support"
(Sornette & Pisarenko 2003; Wilkinson+2018) is a non-sequitur — both analyse *Earth's* plates only,
so expressing them in steradians demonstrates nothing about variation with planetary radius. Worse,
Wilkinson+2018 argues plate diameters are **exponentially** distributed, a *competing* description,
not corroboration.

**Crossover verdict: demote `bakeReliefCrossover` from a character decision to a texel-density LOD guard.**

The code comment already discloses the defect in its own words: *"RESIDUE (disclosed, D3): the baked
continent PATTERN (incl. stamped basins) morphs into the analytic body across the fade — a visible
change in continent CHARACTER, not size."* Three reasons it's wrong rather than merely inelegant:

1. Physics says the plate pattern is the thing that should **persist** at large R. The crossover
   deletes precisely the feature that is scale-invariant.
2. There is **no radius at which substituting fBm becomes defensible** — mobile-lid has a boundary
   network, stagnant-lid is crater-SFD plus discrete constructs; neither is self-affine.
   *(Audit note: this is a rendering judgement, not a retrieved physics result. Label it as such.)*
3. **The correct wavelength law delivers on-screen size-constancy for free.** The crossover exists
   to solve a problem the physics does not have.

---

## Three decisions that are Max's, not derivable

1. **Flexural wavelength sign (Family C).** Ship `p_C = −0.85` (≈2× finer mountain/ridge texture on
   a 1.5 R⊕ world) or `p_C = 0`? The audit found the observations cited *for* −0.85 actually
   contradict it: Landais+2018 (verified) finds the **same** ~10 km scale break on Earth, Mars,
   Mercury *and* the Moon — a 6× span in gravity — which is evidence for `p_C ≈ 0`. And the
   derivation applied its own falsification standard asymmetrically here (Earth vs Venus, 1.00 vs
   0.904 g, differ 5×). **Recommend shipping `p_C = 0` as the observationally-supported value.**
2. **Super-Earth tectonic regime prior.** The sign of `dP(mobile-lid)/dR` has been **unresolved for
   18 years** — Valencia+2007 and O'Neill & Lenardic 2007 modelled the same physics months apart and
   reached opposite conclusions; Korenaga 2010 says size barely matters. The engine must *declare*
   weights. Recommend keeping the seeded three-way draw and widening the band so super-Earths fall
   inside it (currently R ∈ [0.87, 1.14] excludes them all).
3. **Whether the g = 1 amplitude break renders as a hard kink or a smoothed `min()`.** The exponents
   are constrained; the corner is not. Scientifically neutral — pick what reads better.

## Next step

Fold the audit's corrections into a v2 derivation before any build. The three unverified citations
need resolving first — particularly Melosh, since the piecewise structure rests on it.
