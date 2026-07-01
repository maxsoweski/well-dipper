# Condition → Tectonic-Regime Research

**For:** world-engine driver→regime selector design (D-vector → tectonic/geodynamic regime map).
**Question:** what determines which tectonic/geodynamic regime a body falls into — plate tectonics
(mobile lid), stagnant lid, episodic/sluggish lid, heat-pipe (Io), ice-shell regimes — and is that
determination expressible as a defensible closed-form function or lookup over a small set of per-body
scalars?
**Author:** Dana (research librarian), 2026-07-01. Method: web-verified against primary/review sources;
no citation asserted without locating it. Per-source confidence + verification status in §Sources.

**Bottom line up front.** The physics is real and the controlling parameters are named and agreed. But
the load-bearing parameter — **lithospheric yield stress / effective friction** — is *not* in the
driver vector and is not uniquely derivable from what is. The end-members (tiny/cold → dead lid; extreme
tidal flux → heat-pipe; hot rocky surface → stagnant lid; cold volatile-poor icy body → frozen) are a
**defensible lookup**. The band the field actually cares about — Earth-mass-to-super-Earth, temperate,
wet: mobile *vs.* episodic *vs.* stagnant — is a **live research dispute** where the answer is
model-dependent and history-dependent. A deterministic selector that returns a single confident answer
there is picking a side in an open argument. Recommendation at the end: treat that band as a seeded pick,
not a derived fact.

---

## 1. Established determinants of tectonic regime

The modern framing, standard across the literature, is that a rocky planet's tectonic mode is set by a
**competition between two quantities**:

- **Convective driving stress** — how hard the convecting mantle pushes/pulls on the base of the
  lithosphere. Grows with the vigor of convection (the Rayleigh number).
- **Lithospheric strength (yield stress)** — how hard it is to break the cold outer shell into
  mobile plates. If convective stress can exceed the lithosphere's yield stress, the lid fails,
  subducts, and you get mobile-lid / plate-tectonic behavior. If it can't, the lid stays welded on:
  stagnant lid. In between, the lid fails intermittently: episodic / sluggish lid.

This is the Solomatov / Moresi–Solomatov picture. **Solomatov (1995)** classified temperature-dependent-
viscosity convection into three regimes purely by the **viscosity contrast** across the layer: a *mobile*
regime (small contrast, the whole layer overturns), a *stagnant-lid* regime (large contrast — a rigid
conductive lid forms and does not participate), and an intermediate *sluggish/transitional* regime. The
stagnant-lid transition sits at a viscosity contrast of roughly **10⁴** (four orders of magnitude), weakly
Rayleigh-number-dependent. **Moresi & Solomatov (1998)** added a brittle (yield-stress) lithosphere and
showed the mode — stagnant, episodic, or mobile — is set by the **lithospheric yield stress**, written
`τ_y = c₀ + μ ρ g z` (cohesion `c₀ ≈ 0` at lithospheric conditions, so effectively `τ_y ≈ μ ρ g z`: the
product of an **effective friction coefficient μ**, density, gravity, and depth).

The individual determinants, and how each pushes the regime:

- **Interior heat budget** (radiogenic + primordial/secular + tidal). More heat → hotter, lower-viscosity
  mantle → more vigorous convection → higher driving stress → *toward mobile*. The budget is set by
  radiogenic isotopes (decays with **age**), leftover accretion/core heat (decays with **age**), and — for
  tidally forced bodies — **tidal heating**. Iron fraction shifts the radiogenic budget slightly (more iron
  → smaller silicate mantle) and sets the core/mantle geometry.
- **Lithospheric strength.** Higher yield stress → harder to mobilize → *toward stagnant*. This is the
  single most important and least-constrained term (see §3, §5). Laboratory (Byerlee) friction gives
  μ ≈ 0.6–0.85, which is **too strong** — models need an *effective* μ far lower (of order ≤ 0.1) to make
  Earth-style plates at all. That gap is the long-standing **"lithospheric strength paradox"**; the field's
  candidate resolutions (water/pore pressure, grain-scale damage, thermal cracking) are exactly the
  weakening mechanisms below.
- **Water / volatiles.** Water weakens the lithosphere: it lowers the effective friction coefficient (pore
  fluid pressure), hydrates and weakens mantle rock, and enables thermal-cracking hydration of young
  seafloor. **Korenaga (2010, 2013)** argues surface water may matter *more than planet size* — that the
  presence of water, by dropping μ below a critical value, is closer to a *necessary condition* for plate
  tectonics than any mass threshold. → *water pushes toward mobile.*
- **Planet size / mass.** The sign is **contested** — this is the Valencia–O'Neill dispute (§3). Analytic
  scalings say bigger → thinner relative plates + faster mantle → *toward mobile* (Valencia et al. 2007);
  numerical convection with damage says bigger → higher pressure, higher lid strength, lower driving/
  resisting ratio → *toward stagnant/episodic* (O'Neill & Lenardic 2007). Both remain in print.
- **Surface temperature.** A hot surface pushes *toward stagnant lid* — this is the standard explanation
  for why **Venus** (surface ≈ 740 K) has a stagnant lid and Earth does not. Two mechanisms are offered,
  and they are **not the same mechanism** (see §3): (i) **Lenardic et al. (2008)** — a hot surface
  propagates heat downward, lowers sub-lithospheric viscosity, and *reduces the convective stress
  delivered to the base of the lid*, so the lid is less likely to fail; (ii) **Noack & Breuer (2014)** and
  the grain-damage models — a hot surface raises mid-lithosphere temperature, which speeds **healing** of
  weak zones / grain growth, so plate boundaries anneal shut. Both land on "hot surface → stagnant," which
  is why the *heuristic* is usable even though the mechanism is unsettled.

---

## 2. Do regime diagrams exist? (Yes — here are the real axes)

The field does publish **regime diagrams**, and their canonical axes are the two competing quantities from
§1. This is the good news for a selector: the *shape* of the map is well established.

**Canonical axes (Moresi & Solomatov 1998; Stein, Schmalzl & Hansen 2004; and later regime-diagram
papers):**

- **x-axis: convective vigor** — the Rayleigh number `Ra` (often internal-heating Rayleigh number),
  and/or internal-heating rate.
- **y-axis: lithospheric yield stress** `τ_y` (equivalently the friction coefficient μ, or a dimensionless
  yield-stress / convective-stress ratio).

Qualitative structure (robust across studies; exact numeric thresholds are non-dimensional and
model-specific):

```
  high τ_y  |  STAGNANT LID  ..........................  STAGNANT LID
 (strong)   |                                              (large-Ra planets
            |   EPISODIC / SLUGGISH  (intermittent           need even higher
            |   lid failure + overturn)                      τ_y to stay stagnant)
  low  τ_y  |  MOBILE LID (plate-like)  ...................  MOBILE LID
 (weak)     +----------------------------------------------------------
              low Ra (cold/small)              high Ra (hot/big/vigorous)
```

Key features that carry over to any selector:

- **Low yield stress → mobile; high yield stress → stagnant; a band of intermediate yield stress →
  episodic/sluggish.** This ordering is not in dispute.
- **Raising Ra widens the yield-stress window in which the lid still mobilizes** but *also* raises the
  dimensionless transition stress — i.e. hotter/bigger planets need a *higher* yield stress to stay
  stagnant, but the mapping is not a simple vertical line. (This is the crux the Valencia/O'Neill dispute
  turns on — how the *dimensional* yield stress and driving stress each scale with mass.)
- Published diagrams with a **surface-yield-stress axis** exist explicitly (e.g. O'Neill & Lenardic 2007
  cast their super-Earth result as regime vs. surface yield stress and planet radius; later authors plot
  "geodynamic regime as a function of the surface yield stress of the lithosphere").

**Honest limit on the thresholds.** The axes are recoverable; the *numbers* mostly are not, in any form you
could drop into a lookup table. They are (a) **non-dimensionalized** (a critical `Ra` or a critical
yield-stress ratio, not "τ_y = 180 MPa"), (b) **model-specific** (2-D vs 3-D, Frank-Kamenetskii vs
Arrhenius rheology, internal vs basal heating all shift the boundaries — Stein et al. 2013 show
Frank-Kamenetskii vs Arrhenius alone move the regime lines), and (c) **not agreed between groups**. The one
dimensional anchor that recurs: Earth's present plate tectonics is consistent with an *effective*
lithospheric yield stress of roughly **150–250 MPa** (equivalently effective μ well below the Byerlee
0.6–0.85). That single number is the most transferable quantitative peg in the literature; treat it as the
calibration point, not as a threshold that generalizes cleanly to other masses.

---

## 3. Where the science is genuinely contested

This is the part a deterministic selector most needs to respect. Three live disputes:

**(a) Do super-Earths favor plate tectonics? — Valencia vs. O'Neill, unresolved since 2007.**
- **Valencia, O'Connell & Sasselov (2007), *ApJ* 670 L45 — "Inevitability of Plate Tectonics on
  Super-Earths":** analytic scalings — as mass rises, convective shear stress rises and plate thickness
  falls, so plates get *easier* to subduct. Conclusion: plate tectonics **equally or more likely** on
  larger planets. **van Heck & Tackley (2011)** and **Valencia & O'Connell (2009)** broadly support the
  "≥ as likely" side with fuller convection models.
- **O'Neill & Lenardic (2007), *GRL* — "Geological consequences of super-sized Earths":** numerical
  convection — increasing radius *decreases* the ratio of driving to resisting stress, so super-Earths
  trend **episodic or stagnant**. Opposite conclusion, same year.
- **Why unresolved:** the analytic scalings and the numerical models disagree because the simplifying
  assumptions in the scalings (how viscosity, plate thickness, and driving stress each scale with mass and
  pressure) may not hold across the whole parameter range. **Foley, Bercovici & Landuyt (2012)** and
  **Korenaga (2010)** land in the middle: size is not the controlling variable — **lithospheric weakening
  (water, damage) dominates**, and mass effects are swamped by uncertainties in internal heating and
  hydration. **Noack & Breuer (2014)** find a *non-monotone* result — a peak plate-tectonics likelihood
  around **1–5 M⊕** with the pressure-dependence of viscosity mattering more than radius. There is no
  consensus; a selector that keys regime on mass alone is choosing a camp.

**(b) The sign of surface temperature is mechanism-dependent (even where the outcome agrees).** Everyone
agrees hot-surfaced Venus is stagnant. But *why* is contested (Lenardic-2008 stress-reduction vs
Noack/Breuer healing, §1), and the two mechanisms predict *different* behavior for intermediate cases
(e.g. a warm-but-wet early Venus, or a tidally-heated temperate planet). Lenardic et al. (2008) explicitly
frame surface temperature as a **bifurcation control** — a warming climate can *tip* a marginally-mobile
planet into stagnant lid — which means near the boundary the regime is **history-dependent**, not a pure
function of present-day scalars.

**(c) Regime is hysteretic / path-dependent.** **Weller & Lenardic (hysteresis studies)** and **Noack &
Breuer (2014)** both show the *same* present-day planet can sit in *either* stagnant or mobile lid
depending on its **initial thermal state** and the path it took — Noack & Breuer's headline example: a body
starting at CMB ≈ 6100 K stagnates, an identical body starting ~2000 K hotter eventually evolves plate
tectonics. **Implication for any memoryless selector:** in the contested middle band, present-day scalars
**do not uniquely determine** the regime, even in principle within the models. This is not measurement
noise you can average out; it is genuine multistability.

---

## 4. Icy bodies (briefer) and the heat-pipe boundary

**Ice-shell regimes — what selects Europa-chaos vs. dead-frozen.** The controlling physics is the same
convective competition, applied to an ice I shell over an ocean or interior:

- The discriminator is whether the ice shell **convects** or merely **conducts**. It convects once the
  shell's Rayleigh number exceeds a critical value: `Ra ∝ ρ g α ΔT D³ / (κ η_ice)`. The **shell thickness D
  enters cubed**, so D is the dominant lever, followed by gravity `g` and the (strongly temperature-
  dependent) ice viscosity `η_ice`.
- **Thin shell → conductive → geologically dead-frozen** (heat escapes by conduction, surface is old and
  quiet). **Thick, warm-based shell → convective**, and the convection is itself **stagnant-lid** in style
  (a rigid cold surface lid over a convecting warm interior — Solomatov's classification again), which is
  what drives resurfacing / chaos terrain.
- **Europa sits right on the transition.** Shell-thickness estimates (~10–40 km) put Europa's ice Rayleigh
  number *near critical* — so whether it convects is genuinely marginal and sensitive to viscosity, tidal
  heating, and salinity (Barr & Showman 2009; Mitri & Showman conductive↔convective switch studies). This
  is why Europa is "active but ambiguous," not robustly one or the other.
- **What sets D (and thus the regime) is the heat balance:** tidal heating + radiogenic heating in the
  interior, vs. conductive loss set by surface (equilibrium) temperature. High tidal heat → thin warm shell
  + sustained ocean → active/chaos (Europa, Enceladus's south pole). Low tidal heat + cold surface → thick
  cold conductive shell → dead-frozen (Callisto; the cold outer shells of Ganymede). So for icy bodies the
  load-bearing scalars are **tidal heating, equilibrium temperature, volatile/water fraction (shell
  material + thickness), mass/gravity, and age** — a *cleaner* map than the rocky case, because there is no
  brittle-plate yield-stress paradox to resolve.

**The boundary to heat-pipe worlds (Io).** Heat-pipe is a distinct **advective** heat-transport mode:
volcanism (not conduction or plate recycling) carries the interior heat out through discrete conduits,
building a thick cold downward-advecting lithosphere. It switches on at **very high heat flux**. Io's
surface heat flux is ≈ **2.2 W m⁻²** — ~25× Earth's ~0.08 W m⁻² — driven almost entirely by tidal heating
(Moore & Webb 2013, "Heat-pipe Earth," *Nature* 501; Moore et al. 2017, "Heat-pipe planets"). The
discriminator is therefore **tidal-heating flux crossing a high threshold** (order ≳ 1 W m⁻², i.e. an
order-of-magnitude-plus above any plausible radiogenic surface flux). Below that, a rocky body is in one of
the §1–2 regimes; above it, heat-pipe. And Moore & Webb's other point matters for the **age** slot: a
heat-pipe world is a *phase*, not a fixed type — as tidal/radiogenic sources decline it transitions out (on
early Earth, into plate tectonics; on a small dead world, into a stagnant/dead lid).

---

## 5. What this means for a D-vector → regime map

**Which listed scalars carry the load.** The regime map wants two axes (convective vigor, lithospheric
strength) plus a few branch discriminators. Against the usable D-vector inputs (mass/gravity, age,
volatile/water fraction, tidal heating, iron fraction, equilibrium temp):

| Physical quantity the diagram needs | In the vector? | Built from |
|---|---|---|
| Convective vigor / Rayleigh number | **derivable** | mass/gravity (g, mantle depth d), age (radiogenic + secular heat → internal temp → viscosity), tidal heating, iron fraction (mantle geometry). Ra ∝ ρgαΔT d³/κη. |
| Surface boundary temperature | **present** | equilibrium temp (direct) |
| Interior heat sources | **present** | age (radiogenic + primordial, decaying) + tidal heating |
| Lithosphere-weakening / effective friction | **partial proxy only** | water/volatile fraction (Korenaga's water-as-prerequisite); the rest is unmodeled |
| Heat-pipe discriminator | **present** | tidal heating flux vs. a high threshold (~1 W m⁻²) |
| Ice-shell convect-vs-conduct | **derivable** | equilibrium temp + tidal + water fraction + mass/gravity + age → shell thickness → shell-Ra |

**What is missing and cannot be cleanly derived — the crux.**

1. **Lithospheric yield stress / effective friction coefficient μ.** This is the *y-axis of every rocky
   regime diagram* and there is **no D-slot for it.** Part of `τ_y = μ ρ g z` is derivable (the ρgz part
   scales with mass/gravity and lithosphere thickness), but the load-bearing term is the *effective* μ —
   the very quantity that is (a) unknown to a factor of ~6 even for Earth (the strength paradox), (b) set by
   weakening physics (water, grain damage, thermal cracking) only *loosely* proxied by water fraction, and
   (c) the thing the entire field is arguing about. You can *assume* it; you cannot *derive* it from the
   vector.
2. **Mantle reference viscosity + rheology** (activation energy; wet vs. dry). Sets the viscosity contrast
   that Solomatov's whole classification hinges on. No slot; must be assumed.
3. **Initial thermal state / thermal-history path.** Regime is multistable and hysteretic (§3c). A
   memoryless present-day scalar snapshot is *formally under-determined* for the contested middle. The `age`
   slot gives you a decay clock but not the initial condition or the path.
4. **Grain size / damage history.** The shear-localization memory that lets plate boundaries persist
   (Foley/Bercovici grain-damage). No slot; history-dependent.

**Defensible lookup, or research project?** Both — cleanly split by region:

- **Defensible lookup (the end-members).** These separate robustly on the available scalars, and the
  literature agrees:
  - tiny + cold + old, negligible tidal → **stagnant / dead lid** (Moon, Mercury, Mars).
  - hot rocky surface (high equilibrium temp, Venus-like) → **stagnant / episodic lid** (agreed outcome,
    contested mechanism — fine for a selector that only needs the outcome).
  - extreme tidal-heating flux (≳ ~1 W m⁻²) → **heat-pipe** (Io).
  - icy body, enough tidal + radiogenic heat to hold an ocean and push shell-Ra above critical →
    **active / chaos** (Europa, Enceladus); cold + volatile-poor + low tidal → **dead-frozen** (Callisto).
  A lookup over {mass/gravity, equilibrium temp, tidal heating, water fraction, age} reproduces all of
  these. This is genuinely a "defensible lookup."
- **Research project (the contested middle).** Earth-mass to ~few-M⊕, temperate surface, wet: **mobile vs.
  episodic vs. stagnant** is exactly where Valencia, O'Neill, Korenaga, Foley, and Noack & Breuer disagree,
  where thresholds are non-dimensional and model-specific, and where the deciding parameter (effective μ)
  is absent from the vector *and* the true regime is history-dependent even within the models. A
  deterministic function that returns one confident answer here is **not reporting settled science — it is
  adjudicating an open dispute.**

**Design recommendation (for the selector, not marketing).** Structure the map as **end-member lookup +
seeded pick in the contested band**:
1. Test the end-member branches first (heat-pipe by tidal flux; ice-shell convect/conduct by shell-Ra;
   dead-lid by small+cold+old; stagnant by high equilibrium temp). These are defensible as *derived*.
2. For bodies that fall into the Earth-mass temperate-wet band, do **not** pretend to derive the regime.
   Either (a) adopt an explicit, labeled house rule ("Earth-like wet → mobile; hotter or bigger-and-drier →
   stagnant/episodic") and document it as a modeling choice, or (b) make a **seeded pseudo-random pick**
   among the physically-plausible regimes {mobile, episodic, stagnant} for that scalar neighborhood, with
   the pick weights nudged by water fraction (more water → weight mobile) and equilibrium temp (hotter →
   weight stagnant). Option (b) is *both* scientifically honest — it represents the real multistability
   rather than faking a determinism the science doesn't have — *and* it directly serves the program's
   distinct-worlds-per-minute north star (variety within a plausible envelope). This mirrors the pattern
   already used elsewhere in the engine: a seeded look-constant inside a literature-defensible range.

The honest one-line summary for the design decision: **the regime map is a defensible lookup at the
edges and an open research question in the middle — so build the edges as physics and the middle as
seeded, literature-bounded variety, and label which is which.**

---

## Sources (with verification + confidence)

All URLs/citations below were located via web search on 2026-07-01. "Verified" = the paper's existence,
authorship, and venue were confirmed against a publisher/abstract page or arXiv; where I could only read an
abstract or secondary summary (paywalled full text), that is flagged.

**Regime physics / classification**
- **Solomatov, V. S. (1995), "Scaling of temperature- and stress-dependent viscosity convection,"
  *Physics of Fluids* 7, 266.** Three-regime classification (mobile / sluggish-transitional / stagnant) by
  viscosity contrast; stagnant transition at contrast ~10⁴. *Verified (widely cited; confirmed via multiple
  scaling-paper abstracts). Confidence HIGH for the classification.*
- **Moresi, L.-N. & Solomatov, V. S. (1998), "Mantle convection with a brittle lithosphere: thoughts on
  the global tectonic styles of the Earth and Venus," *Geophysical Journal International* 133(3), 669–682**
  (academic.oup.com/gji/article/133/3/669). Yield-stress control of stagnant/episodic/mobile; `τ_y = c₀ +
  μρgz`. *Verified (GJI page). Confidence HIGH.* Note: the exact critical-μ (~0.1) value is standard in the
  strength-paradox literature but I could not pin the precise number to this paper's text from the abstract
  — treat "effective μ ≤ ~0.1, vs Byerlee 0.6–0.85" as MEDIUM confidence on the number, HIGH on the
  qualitative paradox.
- **Stein, C., Schmalzl, J. & Hansen, U. (2004), "The effect of rheological parameters on plate behaviour
  in a self-consistent model of mantle convection," *Physics of the Earth and Planetary Interiors* 142,
  225–255.** Yield-stress regime diagram (mobile/episodic/stagnant). *Verified (title/venue/pages confirmed
  via search). Confidence HIGH for existence + topic; exact thresholds not recovered.*
- **Stein, C. et al. (2013), "Arrhenius rheology versus Frank-Kamenetskii rheology," *G-cubed* 14** — cited
  only for the point that rheology choice moves regime boundaries. *Verified (Wiley page). Confidence HIGH
  for that qualitative point.*

**Super-Earth size dispute (contested)**
- **Valencia, D., O'Connell, R. J. & Sasselov, D. D. (2007), "Inevitability of Plate Tectonics on
  Super-Earths," *ApJ* 670, L45**, DOI 10.1086/524012 (iopscience.iop.org/article/10.1086/524012; arXiv
  0710.0699). *Verified. Confidence HIGH.*
- **O'Neill, C. & Lenardic, A. (2007), "Geological consequences of super-sized Earths," *GRL* 34, L19204**
  (agupubs, DOI 10.1029/2007GL030598). Opposite conclusion (stagnant/episodic likelier). *Verified.
  Confidence HIGH.*
- **van Heck, H. J. & Tackley, P. J. (2011), "Plate tectonics on super-Earths: Equally or more likely than
  on Earth," *EPSL* 310, 252–261.** *Verified. Confidence HIGH.*
- **Foley, B. J., Bercovici, D. & Landuyt, W. (2012), "The conditions for plate tectonics on super-Earths:
  Inferences from convection models with damage," *EPSL* 331–332, 281–290** (ScienceDirect
  S0012821X12001513). Grain-damage; weakening dominates over size. *Verified. Confidence HIGH.*
- **Korenaga, J. (2010), "On the likelihood of plate tectonics on super-Earths: Does size matter?"** and
  **Korenaga, J. (2013), "Initiation and Evolution of Plate Tectonics on Earth: Theories and Observations,"
  *Annu. Rev. Earth Planet. Sci.* 41, 117–151** (people.earth.yale.edu/.../korenaga13a.pdf). Water as
  near-necessary condition; thermal-cracking hydration. *Verified (2013 review PDF confirmed; 2010 ApJ
  L-letter referenced within it). Confidence HIGH for the water argument.*
- **Noack, L. & Breuer, D. (2014), "Plate tectonics on rocky exoplanets: Influence of initial conditions
  and mantle rheology," *Planetary and Space Science* 98, 41–49** (ScienceDirect S003206331300161X).
  Path-dependence on initial CMB temperature; non-monotone mass dependence (peak ~1–5 M⊕). *Verified.
  Confidence HIGH.*

**Surface temperature / hysteresis**
- **Lenardic, A., Jellinek, A. M. & Moresi, L.-N. (2008), "A climate induced transition in the tectonic
  style of a terrestrial planet," *EPSL* 271, 34–42.** Surface temperature as a mobile↔stagnant
  bifurcation control (stress-reduction mechanism). *Verified (title/venue via search; ResearchGate record).
  Confidence HIGH for existence + thesis.*
- **Weller & Lenardic — hysteresis in mantle convection / plate-tectonic states** (e.g. Weller & Lenardic
  2012, *GRL* 39, "Hysteresis in mantle convection: Plate tectonics systems"; Weller & Lenardic 2020, *JGR
  Planets*, on Venus thermal history). Multistability of regime. *Verified (AGU pages). Confidence HIGH for
  the hysteresis result.*

**Subduction initiation / Earth as the lone plate-tectonic body**
- **Stern, R. J. & Gerya, T. (2018), "Subduction initiation in nature and models: A review,"
  *Tectonophysics* 746, 173–198.** Also the reviews chain Stern (2004), Korenaga (2013), Crameri et al.
  (2019) via Lu et al. (2021, *Earth and Planetary Physics*). Earth is the only solar-system body with
  global plate tectonics; onset timing unresolved (Hadean–Proterozoic range). *Verified. Confidence HIGH.*

**Ice-shell regimes**
- **Barr, A. C. & Showman, A. P. (2009), "Heat Transfer in Europa's Icy Shell,"** and **Mitri & Showman,
  "Convective–conductive transitions and sensitivity of a convecting ice shell…" (*Icarus* 2005,
  S0019103505001259).** Europa near the conductive↔convective (critical-Ra) transition; stagnant-lid style
  ice convection. *Verified (venue/topic via search; some full texts paywalled). Confidence HIGH for the
  near-critical framing; MEDIUM on exact shell-thickness thresholds (10–40 km cited range is estimate-
  dependent).*

**Heat-pipe / Io**
- **Moore, W. B. & Webb, A. A. G. (2013), "Heat-pipe Earth," *Nature* 501, 501–505**, DOI
  10.1038/nature12473 (nature.com/articles/nature12473; PubMed 24067709). Heat-pipe as advective volcanic
  heat-transport mode; transitions to plate tectonics as heat sources decline. *Verified. Confidence HIGH.*
- **Moore, W. B. et al. (2017), "Heat-pipe planets," *EPSL* 474, 13–19** (ScienceDirect S0012821X17303242).
  *Verified. Confidence HIGH.*
- **Io surface heat flux ≈ 2.2–2.24 W m⁻²** driven by tidal heating (vs Earth ~0.08 W m⁻²). *Verified via
  multiple Io-volcanism sources; the 2.24 figure recurs in tidal-heating/resurfacing modeling. Confidence
  HIGH on order of magnitude (~2 W m⁻², ~25× Earth); the precise value is model-and-epoch-dependent.*

**Volcanism–mass scaling (context for the interior heat budget)**
- **Kite, E. S., Manga, M. & Gaidos, E. (2009), "Geodynamics and Rate of Volcanism on Massive Earth-like
  Planets," *ApJ* 700, 1732–1749** (iopscience 10.1088/0004-637X/700/2/1732). Thermal-evolution / melting
  vs. planet mass, 0.25–25 M⊕. *Verified. Confidence HIGH.*

**What I did not cover, and why.** (i) Magnetic-field ↔ tectonics coupling — real (a dynamo needs core heat
loss, which regime modulates) but *downstream* of the regime, not a determinant of it, so out of scope for
a selector input. (ii) Carbon-cycle / habitability feedbacks (Foley & Driscoll 2016) — these are
*consequences* of regime, relevant to the habitability composite (D-slot) but not to choosing the regime.
(iii) Exact numeric regime-diagram thresholds — deliberately not tabulated: they are non-dimensional and
model-specific (§2), and presenting them as drop-in constants would be false precision. (iv) Mars-specific
stagnant-lid-rocky morphology — that is a separate writer/research pass (already flagged OUT in the
increment-4b Venus doc); this brief is about *regime selection*, not per-regime relief.
