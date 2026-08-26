# Well Dipper — Super-Earth World Engine: Decision Brief
**Prepared 2026-07-28. Four decisions: relief amplitude, terrain texture scale, tectonic regime, crater defect.**

Two framing notes before the decisions:

- **Where a hostile referee overturned a lens report, the refutation stands.** I found no referee error worth overturning. Several of the lens reports' headline recommendations did not survive; those are flagged inline rather than quietly dropped.
- **One shared dependency runs under all four decisions.** `bodyDrivers.massGravity` (`body-drivers.js:11`) reads the *canonical preset* gravity, not the drawn radius. So today, a 4.5 M⊕ super-Earth's plate uplift field is bit-identical to Earth's. Whatever laws you adopt below, none of them reach the renderer until that is fixed — and fixing it collides with `RELIEF_FLOOR = 0.40`. That ordering constraint is the same in decisions 1, 3 and 6.

---

## (1) Relief amplitude — how tall are the mountains?

### Answer

**A real model exists for this regime, and it does not support option A.** Your provisional plan — extend the measured Solar-System fit past Earth, which yields roughly constant absolute relief — has **no published support**. Every published model that actually reaches into 1–10 M⊕ predicts relief *falls* with planet mass. None predicts constant.

**Recommendation: adopt h ∝ g^−1.09 (equivalently h ∝ M^−0.5), cited to Guimond, Rudge & Shorttle 2022 (doi:10.3847/PSJ/ac562e), with bracket [0.74, 1.61] labelled as an inference back-out from that paper's Fig. 7 — not as a stated result.** Confidence: **high** on the direction, **medium** on the exponent.

### What this makes a planet look like

A 1.5 R⊕ rocky world (4.5 M⊕, 1.99 g):

| quantity | Earth | 1.5 R⊕ at q=1.09 | at q=0.57 (shallow end) | at q=1.61 (steep end) |
|---|---|---|---|---|
| total relief, km | 19.9 | **9.4** | 13.5 | 6.6 |
| relief as a fraction of radius | 1.00× | **0.31×** | 0.45× | 0.22× |

So: mountains roughly **half Earth's height in kilometres**, on a globe 1.5× wider — which means only about **a third of Earth's relief in angular terms**. The silhouette reads noticeably smoother; basins are shallower; continental margins are less pronounced. A super-Earth is a *flatter-looking* world, and the effect is stronger than the km number alone suggests because the planet is also bigger.

### Reasoning

The literature that reaches above 1 g, with everything converted to h ∝ g^−q:

| route | source | q |
|---|---|---|
| stagnant-lid crustal thickness | O'Rourke & Korenaga 2012 (M^−0.284, in *their* Valencia g(M)) | 0.57 |
| dynamic topography, coldest mantles | Guimond+2022 Fig. 7 (back-out) | 0.74 |
| brittle strength ceiling | Melosh 2011 eq. 3.17 | 1.00 |
| ductile crustal-flow ceiling | Cowan & Abbot 2014 eq. 6 | 1.00 |
| **dynamic topography, nominal** | **Guimond+2022** | **1.09** |
| dynamic topography, hottest mantles | Guimond+2022 Fig. 7 (back-out) | 1.61 |

**Three corrections to how strong this looks.** The referee found the lens report overstated its own evidence three times, and you should hear the corrected version:

1. **This is not seven independent scalings.** Four of those rows trace to Guimond+2022 alone. Cowan & Abbot *import* their 1/g from Kite+2009 rather than deriving it (verbatim: "we have adopted the gravity-dependence of Kite et al. (2009)") — the same over-reading of Kite your citations-resolved audit already caught. Honest count: **two mechanistically distinct families landing near q ≈ 1**, plus one shallower outlier. Still a real convergence, much thinner than claimed.

2. **The escape hatch for constant relief is gone.** The lens report proposed that if brittle strength Y itself scales with gravity (Heap, Byrne & Mikhail 2017), the 1/g cancels and you get constant absolute relief — a defensible route to your preferred answer. The referee retrieved Heap in full and killed it. Heap's *own* explanation for Mars's tall volcanoes is lithospheric **thickness**, which on a super-Earth goes the wrong way (higher g → thinner brittle layer → *less* support). And closing Melosh self-consistently with Coulomb friction gives h = 2Y₀/[ρg(1−2μ)] — still 1/g, with friction only in the prefactor. Melosh's own Coulomb branch confirms this. **There is currently no published mechanism supporting constant absolute relief above 1 g.**

> ⚠️ **CORRECTION 2026-07-28 (post-ruling, by the settlement workflow): item 3 below is WRONG on its
> arithmetic and its conclusion.** It compares a *fractional* clamp against the *absolute* exponent.
> The floor binds at **R = 1.379 R⊕ / g = 1.726 / M = 3.28 M⊕**, not R = 1.64 — *earlier* than the
> v1 estimate of 1.40, so moving it is **more** urgent, not less. This page self-refutes: the table
> at line 23 gives 0.31× fractional at 1.5 R⊕, already below 0.40. The RECOMMENDATION (move the
> floor) is unaffected and is now `RELIEF_FLOOR = 0.01`. See
> `docs/WORKSTREAMS/world-engine-v2-relief-law-2026-07-28/`.

3. **`RELIEF_FLOOR = 0.40` must move — and the reason is the opposite of what was first argued.** At q = 1.09 the floor binds at g = 2.32, i.e. **R = 1.64 R⊕**. That is *later* than the v1 estimate (R = 1.40), so adopting the shallower exponent makes it less urgent, not more. But it still binds inside the super-Earth population, and above that radius it would clamp the whole branch flat — **accidentally implementing constant relief while claiming to implement the derived law**. That is the single worst outcome available: your preferred answer wearing the wrong citation.

**Also adopt: drop the piecewise-in-g break entirely.** Melosh's data cannot locate a break in g (Mars and Mercury sit at identical gravity a factor of 3 apart in observed/ceiling ratio). Guimond's law is *continuous* in M across 0.1–5 M⊕ — it spans both sides of the proposed break with one exponent. If you want a low-g deviation, the models say it belongs at the *low* end (Moon, Mercury: obs/ceiling 0.41 and 0.53), where relief is *below* the model. That inverts the piecewise's current sense.

### The caveat that cuts against everything above

**The models predict a different quantity than your code fits.** Guimond, O'Rourke and Cowan & Abbot predict dynamically- and isostatically-supported relief. Your anchor set (Earth 19.9 / Mars 29.4 / Moon 19.9 / Venus 13.7 / Mercury 9.8 km) is *total* relief including impact basins, volcanic constructs and history. Nobody has modelled total relief on a super-Earth. Guimond's model under-predicts observed Solar-System relief by ~3× — they say so plainly.

**Use the published SLOPE. Never the published AMPLITUDE.** Keep Earth's observed 19.9 km as the anchor and scale it by g^−1.09.

### If you still want constant relief

You can have it, but only as an **authored art/gameplay choice, labelled as one**. It cannot be attributed to Heap+2017 or to any paper. "Extend the observed fit" is the weakest available justification, because Melosh's own diagnosis is that the mechanism flattening the observed trend ("history") operates on the *low*-gravity bodies — so extrapolating the flattened fit upward is extrapolating a low-g pathology into the high-g regime.

**If q = 1.09 looks too flat in play:** O'Rourke & Korenaga's g^−0.57 is a published, super-Earth-domain exponent that halves the effect. Citing it for *relief* is an inference from a crustal-thickness result — label it as such — but it is a real paper with a real domain, unlike "extend the fit."

### What would change my mind

- Anyone quantifying Y(g) — brittle strength as a function of surface gravity. This is the single most valuable missing number in the whole problem and it is missing from the *literature*, not just from the search.
- Byrne et al. 2021's Zenodo dataset (record 5560142) gives brittle-ductile transition depth as a function of surface gravity. If someone pulls it and it yields a thickness(g) exponent that nets out positive against the strength effect, the ceiling flattens.
- Any successor relief model. A 71-page 2026 review by Guimond plus eight co-authors still composes exactly two pieces (Guimond+2022 + Melosh), so this is unlikely soon.

---

## (2) Terrain texture scale (p_C) — how far apart are the ridges?

### Answer

**Two parts, and they point in different directions.**

**First, the crux you asked me to settle: the Landais ~10 km break is NOT a flexural signal.** That is now established and it survived hostile review. **The p_C = 0 argument loses its evidence — strike the Landais justification from the code comment.**

**Second: the physics does not give you a number.** There is no defensible single p_C. The one textbook-certain term is flexure's g^−1/4 at constant elastic thickness, and it fails the only two observational tests that exist, in opposite directions. **Recommendation: ship p_C as an explicitly UNDERDETERMINED named constant, with both falsifying observations in the comment, and pick its value as a declared priority call rather than as a physics finding.** Confidence: **high** that Landais is not flexural; **high** that no number is derivable; **medium** on which value to pick if forced.

### What this affects visually

p_C controls whether a super-Earth's mountain belts, ridges and grain are spaced the same in km as Earth's, finer, or coarser.

At the defensible flexural value (−0.25 in g), a 1.5 R⊕ world gets spacing × 1.99^−0.25 = **0.84 — 16% finer. That is invisible.** At the steep model-dependent end (−1.13) it is 0.46, which *would* read. No data supports the steep end.

**And here is the thing that matters more than the exponent:** elastic thickness varies from **2 km to 80+ km within Earth alone** (Watts & Burov 2003). Since λ ∝ Te^(3/4), that moves the flexural wavelength by **~16× on one planet**. The entire predicted gravity effect from Earth to a 2 R⊕ super-Earth is **~1.34×**. **Intra-planet variation dominates the inter-planet gravity signal by ~12×.** Whatever p_C ships will be perceptually invisible next to the regional variation the engine should already be generating.

**If the goal is for a super-Earth to *read* as different, p_C is the wrong lever.** See below.

### Reasoning — killing the Landais break

Three independent reasons, all verified against retrieved full text:

1. **Mechanism misidentified by ~12–21×.** Turcotte & Schubert §3.14 computes the flexural compensation transition explicitly: for Te = 25 km on Earth, topography is 50% compensated at **λ = 420 km** (independently reproduced as 419.2 km from their formula). Across Te = 10–100 km the transition spans 211–1186 km. Landais equate the transition scale with Te itself — conflating a plate *thickness* with a *wavelength*, which are separated by a factor of 12–21 (λ/Te = 3.43·(E/(gΔρTe))^(1/4)). A ~10 km break cannot be the compensation cutoff for any plausible planetary Te.

2. **The authors label it a hypothesis.** Verbatim: *"We hypothesize…"* in the abstract; *"The geological origin of this transition will be investigated in future works"* in the conclusion. That future work was never published — the break has stood unexamined for seven years.

3. **The paper contains zero gravity analysis.** Full-text grep: `"surface gravity"` 0 hits, `"flexur"` 0 hits, no fit of break location vs g, no uncertainty on the break location, Venus and Titan excluded from the sample, and Fig. 3 normalises all four curves to be equal **at 10 km** to "emphasize the transition."

**And the inference was backwards.** Landais's *own* explanation for why the break is common across bodies is that **Te is common**: *"The common transition could be explained by the averaged value of the elastic thickness quite similar for the 5 bodies."* Constancy is attributed to constancy of Te, **not to insensitivity to gravity**. Since Te is not the same on a super-Earth (Byrne+2021: max brittle thickness ~30 km at g = 5 m/s² falling to ~10 km at g = 40), **the break moves on Landais's own logic**.

One thing to fix while you're in there: the v1 derivation had already computed λ_flex = 507 km for Earth *while simultaneously* citing the 10 km break as an independent observed anchor for the same feature family — a 51× internal conflation. Both need correcting, and the v1 one is the one that ships.

### Reasoning — why no number survives either

The lens report's replacement recommendation (p_C = −0.25 in g) was refuted, using evidence already in your own project record.

**Crooks, Bar-Yam, Buldyrev & Stanley (arXiv:1809.02457)** measure the same two-regime crossover on a fifth body: **10 km on Earth vs 50 km on Venus**, at g = 1.00 vs 0.904. λ ∝ g^−1/4 predicts a **1.03×** difference. Observed: **5×**.

So both ends of the flexural bracket fail both available tests:

| observation | what it shows | what −0.25 predicts | what −0.85 predicts |
|---|---|---|---|
| Moon/Mars/Mercury/Earth (Landais) | same break across 6× in g | 1.57× spread | 4.4× spread |
| Earth vs Venus (Crooks) | **5× different break at ~equal g** | 1.03× | 1.09× |

This is **Melosh's Mars-vs-Mercury problem repeated in the horizontal**: the break location cannot be located in g from the available data. The "the observations lack statistical power" defence used to kill −0.85 cannot be applied selectively — that is exactly the asymmetric-falsification error your own v1 audit charged v1 with.

Crooks caveats that travel with the datum: 1998-dated preprint, no journal venue located, Earth data is continental US only, uses width-scaling rather than Haar fluctuations, authors flag possible bias from Venus's deep gorges. It is weaker evidence than Landais — but it is the only near-twin-gravity comparison in existence, and a 5× residual against a 1.03× prediction cannot be dismissed by a power argument.

**Also struck:** the long-wavelength "+1.00 in R / angularly invariant" leg. It rested on a Guimond+2022 sentence lifted from a *caveats* section in which the authors state, three sentences later, that their model **"cannot produce these features"** against Venus, Earth and Mars.

### The better lever, if you want a super-Earth to read differently

**Condition the wavelength law on the tectonic-mode draw, not on radius.** Guimond et al. 2026 (Space Sci Rev 222:8, doi:10.1007/s11214-025-01264-5) states, verbatim: *"the power spectrum of dynamic topography — its spatial distribution — is closely tied to the planet's tectonic mode. High amplitudes at low degrees are expected on planets with deep recycling of lithosphere, such as Earth's plate tectonics, with stagnant lid and squishy lid/heat pipe regimes showing shorter-wavelength dynamic topography."*

That is better-supported than any exponent in R or g, and it is far more visible. It also connects directly to decision (3).

### Implementation is not blocked

The lens report escalated a "1.7× exponent-base ambiguity" as the largest implementation risk. It doesn't exist. `featureFrequencyFromKm(radiusEarth, featureSizeKm, cFeature)` at `planet-lod-lab-core.js:1063` takes an **absolute feature size in km** and performs the radius conversion itself — so a physical wavelength law enters as km with no base ambiguity. And `reliefEnvelope` at `:1127` establishes **g-base** as the convention for gravity-driven laws.

### What would change my mind

Someone fitting break location against surface gravity on a real dataset. **Nobody has ever done this.** The single highest-value retrieval remaining is Ermakov, Park & Bills 2018 (doi:10.1029/2018JE005562), which fits topography power spectra across five orders of magnitude in radius and surface gravity — paywalled, closed OA, no repository copy. Note: do **not** cite any exponent or qualitative reading from it without opening it; its abstract does *not* say what it was claimed to say.

---

## (3) Tectonic regime — can the pipeline accommodate both models?

### Answer

**Yes — partly, and cheaply. But not for the reason the docs suggest, and not by the fix currently on record.**

The writers exist and produce genuinely different terrain. But **today neither model is selectable for a super-Earth**, and the "seeded three-way draw" that the recommendation on record proposes widening has **zero routing influence anywhere in the reachable parameter space**. Widening the band would change nothing.

**Recommendation: yes, build both — in three steps, of which the first two are ~8 lines.** Confidence: **high** on the code diagnosis (measured, not read); **high** that the literature supports running both as end-members; **medium** on which prior to sample.

### What a super-Earth gets today

Measured by running the shipped modules, not by reading the docs:

- The seeded band is a **mass** window (0.6–1.6 M⊕), not a radius window. Its equivalent radius window is preset-dependent: Rocky [0.8855, 1.1682], Ocean [0.8815, 1.1635]. The doc's "[0.87, 1.14]" is stale *and* conflated — 0.87 is the pre-gravity-fix low edge; the 2026-07-28 self-compression fix silently shrank the top from 1.2114 → 1.1682 and nobody recorded it.
- Above ~1.17 R⊕ a body falls out of band and hits `L < MOBILE_L → 'mobile'` **deterministically**. `lidStrength` saturates at L = 0.2795 (well under MOBILE_L = 0.35) because gravity enters through a single clamped term, `gMod = clamp(0.90, 1.12, …^0.15)`. **Verified over 2000 seeds, and with a 98%-stagnant weight override applied: always mobile, always `plate()`. Stagnant-lid is not unlikely for a wet super-Earth — it is unreachable.**
- **The seeded three-way draw is discarded even inside the band.** Dispatch rule (3d) calls `modalRegime(V, T)` — a seed-free argmax — to keep named presets byte-stable. Swept 400 seeds × 101 radii × 3 presets: **the route never varies with seed.**
- `'episodic'` has **no writer** — it is folded into `plate()`. Meanwhile `mixedInterior.js` is fully built (shield/caldera/corona/tessera/rift/plains primitives) and **unreachable from all 18 shipped presets**.
- The band edge produces a **backwards** discontinuity: growing a planet flips it from stagnant to mobile — the opposite sign to the literature debate this exercise is about.

### The cost

**Step 1 — make the draw exist for super-Earths** (`e1Regime.js`, ~7 lines). Do *not* retune `lidStrength`; it is anchor-calibrated against Venus (0.728) and Mars (0.551) and moving it re-routes shipped presets. Instead add one new rocky branch between the seeded-band branch and the hot-high-L branch, keyed on out-of-band + mass above a super-Earth threshold, doing a second `weightedPick` over `['mobile','stagnant']`. Add `SUPER_EARTH_REGIME_WEIGHTS` next to the existing constant. **That constant IS your declaration of the unresolved prior:** `{mobile:1, stagnant:0}` = Valencia+2007; `{0,1}` = O'Neill & Lenardic 2007; `{0.5,0.5}` = "the field doesn't know." Mutually exclusive with the existing branch, so no stream shifts and no golden moves.

**Step 2 — make the dispatch honour the tuple** (`planet-lod-rivers.js`, 1 line): `if (e1.geodynamicRegime === 'stagnant') return stagnantLidDirect();` inserted between rules (3d) and (3e). Byte-safe today for every shipped preset.

**Step 3 — make the two regimes actually look different** (`body-drivers.js:11/:24`). Point `massGravity` at `condition.surfaceGravity` instead of `u.surfaceGravity`. **Without this, both regimes render at canonical Earth gravity and "accommodate both" is two labels over one picture.** ⚠ This is the expensive step, it goes live on every preset simultaneously, and it collides with `RELIEF_FLOOR = 0.40` — same dependency and same ordering as decision (1): g(R) → v2 relief law → then this wiring. **Steps 1+2 can ship without step 3; they just won't be visible, and the workstream must say so rather than claiming a visual result.**

**Step 4 (optional) — give `'episodic'` the writer that already exists.** Route it through `writeLidResponseSphere` with a synthesised mixed coordinate. Cheapest way to make the three-way draw genuinely three-way. Fix the diagnostics drop at `planet-lod-rivers.js:548` while you're there.

### Does the literature offer a parameter space instead of a dice roll?

**Yes — three axes, and none of them is planet mass.**

**Axis 1 — THERMAL MATURITY (strongest; the engine already has the inputs).** O'Neill et al. 2016 (doi:10.1016/j.pepi.2016.04.002) gives an *ordered trajectory*, not a draw: hot post-magma-ocean start → "hot" stagnant lid → **episodic lasting 1–3 Gyr** → plate-tectonic → **cold senescent stagnant lid after ~10 Gyr**. Verbatim: *"plate tectonics may be a phase in planetary evolution between hot and cold stagnant states, rather than an end-member."* Note the ladder is **non-monotonic** — stagnant appears at *both* the hot and the cold end.

The engine already computes `convectiveVigor` Φ (`e1Regime.js:97-105`), which is strongly monotonic in R (0.74 at R=1 → 1.445 at 1.5 → 2.35 at 2). Today it feeds only `centerCount` and one cold-dead cut. **A derived regime law needs no new condition-vector plumbing — it needs one new transfer function on (Φ, L, mass), and the ingredients already flow to the routing seam.** Ra and yield stress are genuinely absent from the engine; Φ is the standing proxy.

**Axis 2 — YIELD STRENGTH in MPa, with real published boundaries.** Lyu et al. 2025 (doi:10.1038/s41467-025-65943-1): σ_s ≲ 90 MPa → mobile, independent of thermal state; hot + 130–180 → episodic; hot + ≳180 → stagnant; cool + ≳120 → sluggish. Weller & Lenardic 2018: mono-stable mobile < 45, **bistable 50–105**, mono-stable stagnant > 105, window width ∝ Ra_t^(2/3).

**⚠ This axis is EARTH-CONDITIONS-ONLY, and the apparent super-Earth bridge is void.** Lyu 2025 contains zero occurrences of "super-Earth" or "planet mass." The lens report offered Meier et al. 2024's GJ 486b sweep (125–200 MPa) as corroboration; the referee retrieved it and found Meier **assume a mobile lid throughout** (*"we did not consider any stagnant lid cases"*), and their 125–200 MPa is a **convection-planform** transition (uniform → degree-1) *inside* the mobile-lid regime — a different physical transition whose numerical proximity to Lyu's lid boundaries is coincidence. **There is no published mapping from planet mass to yield stress in MPa. Using Lyu's numbers at 4.5 M⊕ is an authored assumption with no warrant.**

**Axis 3 — CLOSED-FORM AND OBSERVABLE, but narrow.** McIntyre 2022 (doi:10.1051/0004-6361/202141112) applies a tidal-bulge criterion h > 10⁻⁵, computed from stellar mass, planet mass, planet radius, eccentricity and semi-major axis — all quantities the engine has. **Only valid for tidally locked, close-in, eccentric planets with R_p ≤ 1.23 R⊕.** Not your regime.

### Is "account for both" defensible, or an evasion?

**Defensible, and it is normal practice — but it is contested, and you should hear both sides.**

**For:** Weller & Lenardic 2018 find a genuinely **bistable band** (50–105 MPa in their setup), not a global coin flip, whose width is itself computable (∝ Ra^(2/3)) — so super-Earths should have a *wider* bistable window. Lenardic & Crowley 2012 state *"history dependence can outweigh the effects of a planet's energy content and material parameters."* Two peer-reviewed papers — Spaargaren+2020 and Affholder+2025 — decline to pick a regime and run both as end-members; Affholder explicitly design their analysis to be *"agnostic to prior beliefs on which convection regime is most frequent."*

**Against:** Ferrick & Korenaga 2023 argue that once heating mode and nondimensionalization are handled correctly, *"tectonic mode is unique with respect to key planetary properties"* — i.e. the bistability motivating "account for both" may be a modelling artifact. Lyu+2025 independently report *"limited effects of hysteresis"* once magmatism is included. Ferrick & Korenaga also say a convective regime diagram for terrestrial planets is *"within reach"* — a polite way of saying **it does not exist yet**.

There are also **two competing accounts of the deadlock itself**: an assumptions/nondimensionalisation problem (van Heck & Tackley 2011; Ballmer & Noack 2021; Ferrick & Korenaga 2023) *versus* genuine solution multiplicity (Lenardic & Crowley 2012: *"different groups can find different solutions, all potentially viable and stable, using identical models and identical system parameter values"*). The honest framing is "contested," not "now understood."

Lenardic & Crowley's own bottom line is worth quoting to you directly: **"the question of whether extrasolar terrestrial planets will have plate tectonics is unanswerable and will remain so until the temporal evolution of extrasolar planets can be constrained."**

### The structural recommendation

**Emit a continuous mobility scalar and derive the discrete label from it.** Foley & Bercovici 2014 (doi:10.1093/gji/ggu275): *"the transitional regime between the stagnant lid and fully mobilized regimes is large, and the transition from stagnant lid to mobile convection is gradual and continuous. Thus planets could exhibit a full range of surface mobility, as opposed to the bimodal distribution ... that is typically assumed."* Lyu+2025 operationalise this with two continuous discriminants (Plateness P, Mobility M).

Combined with Weller & Lenardic's bounded window, the best structure is: **deterministic outside the bistable band, seeded draw only inside it, band width growing with convective vigour.** That gives you "both models" in exactly the place the physics says both are allowed, rather than a uniform dice roll everywhere.

### What should actually differ between the two regimes

Not a total-relief amplitude — the **hypsometry** and the **low-order spectral content**. Adams & Laughlin (arXiv:2312.07483, preprint, no journal ref):

- **Mobile-lid (Earth):** strongly low-order **odd-ℓ dominated**, bimodal elevation distribution (continent/ocean).
- **Stagnant-lid (Venus):** near-**unimodal**, ~60% of the surface within 500 m of the mean, topography much more closely correlated with gravity.

That is a concrete, citable spec for two distinct generators — and it connects this decision straight back to the `bakeReliefCrossover` question in decision (6).

### Two smaller notes

- **Keep the volatile nudge and cite it.** `e1Regime.js:123` (wetter → more mobile) is exactly van Heck & Tackley's conclusion after all their scaling work: *"factors other than planet size, such as the presence of surface water, are likely most important for determining the presence or absence of plate tectonics."*
- **The taxonomy is behind the literature.** Lyu+2025 distinguish **six** regimes (adding sluggish, plutonic-squishy, episodic-squishy); Lourenço+2020 introduced plutonic-squishy with intrusion efficiency as its axis. Not urgent, but the code comment should say three is a known simplification rather than implying it is the physical set.

### What would change my mind

Stamenković & Breuer 2014 (doi:10.1016/j.icarus.2014.01.042) — the paper the field itself points to as the reconciliation of the deadlock. **Neither lens could retrieve even its abstract** (Crossref has none deposited, Semantic Scholar returned null, ScienceDirect 403). If one more retrieval is funded, make it this one.

---

## (6) The crater defect

### Answer, in three parts

**First, a framing correction that changes the whole question.** The "0.04" you were dragging is **`radiusProxy.t`**, a log-position proxy on `[0,1]`, not 0.04 R⊕. `radiusFromT(0.04) = 0.3517 R⊕`. **The slider physically cannot go below 0.3 R⊕.** The `radius (RE)` and `radius (km)` readouts beside it are `.disable()`d getters. So this is not a small-body physics question — and the Vesta/Ceres investigation one lens ran, while correct, answers a question you didn't ask. (For the record: at genuine 0.04 R⊕ — Vesta's radius, 262.7 km — a body is *near geometric saturation*, one of the most heavily cratered surfaces in the solar system. Nothing in physics erases craters there.)

**Second: you reported two different defects, with two different root causes, in two different files.**

**Third: both are code bugs, both have a physically-correct replacement in the literature, and the replacement you described — a probabilistic impactor distribution — is a refactor of an existing subsystem, not a new one.** But it has a prerequisite that costs real work.

---

### (a) Root-cause diagnosis

#### Defect A — "constant apparent size, scaling with the radius"

**Root cause is exact, not approximate: the stamped crater population's angular diameter distribution is mathematically independent of planet radius.** Identical to the last float.

In `src/worldengine/base/bombardment.js`, **both** edges of the km draw band are ∝ R:
- `D_FLOOR_KM = MESH_FLOOR_RAD / rpk = 0.055 × 6371 × R` (`:178`), and it **always wins** the `max(L, D_FLOOR_KM)` at `:179` because L ≈ 0.9 km vs D_FLOOR ≥ 105 km
- `H = C_BASIN × R_km = 6371 × R` (`:172`)

`drawBoundedPareto` is homogeneous of degree 1, so **D_km ∝ R exactly**. Then `:335` converts back: `delta = D_km * rpk`, dividing by 6371R. **The R cancels identically.** The whole thing reduces to

```
δ = drawBoundedPareto(u, MESH_FLOOR_RAD, C_BASIN, B_SFD)   — a function of the RNG draw alone
```

Measured: the angular band is `[0.0550, 1.0000] rad` at **every** radius on **every** impact preset; median stamped δ = `7.7664e-2 rad` at every radius, to all printed digits. Same seed at R=0.5 and R=4 returns **literally the same δ values** while D_km scales ×8.

The disc is then scaled `sVis = √R` at a fixed camera, so crater screen size ∝ δ·√R ∝ √R = **exactly the disc's own growth rate**. Your words — "scaling up and down with the radius" — describe the arithmetic precisely.

**The lower band edge is pinned to a rendering constant** (mesh resolution — a fixed *angle*, because node count is fixed), **not to the physical small-crater cutoff** (`D_SFD_MIN_KM = 1 km`). This exact UAT complaint was predicted and signed off as physics in the v2-6 BUILD-PLAN (*"the L5 restructure makes the stamped angular ensemble R-invariant even PAIRED"*, and §9 risk 2: *"a product call to surface, not a wiring bug to fix silently"*). **The physics defence does not hold.** Real crater self-similarity is a statement about a population extending to sub-km sizes; here the population is truncated at 3.15° of arc — 350 km on Earth, 5,600 km on a 16 R⊕ world. The scale-free theorem is being applied to a band the *renderer* defined.

Two consequences worth naming:
- **`K_GS = 0.17` — the π-group gravity SIZE law, the module's headline physics — is structurally dead** for the stamped population. It only multiplies `L`, and `L` is discarded at every reachable radius (crossover at 0.133 R⊕; slider floor 0.27). It survives only via `P_STAMP → nStamp ∝ sizeMul²` — **gravity was converted from a size law into a count law**, which is exactly the unphysical "gravity COUNT factor" the module header says the v2-6 rewrite removed.
- **Crater COUNT is independent of surface area.** `nAnalytic ∝ R²` is exactly cancelled by `P_STAMP ∝ 1/R²`. A 16 R⊕ world gets **19** stamped craters; a 0.3 R⊕ one gets **164**. Surface area grows ×2844 over that span; count falls ×8.6.

#### Defect B — "vanishing below ~0.04"

**Root cause: `bakeReliefCrossover`.** At `world-engine-lab.html:5904`:

```js
uniforms.uReliefBakeStrength.value = grainCarveUI.reliefBakeStrength * bakeReliefCrossover(sVis);
// bakeReliefCrossover(sVis) = 1 - smoothstep(0, 1, |log2 sVis|),  sVis = √R
```

The discrete stamped crater population exists **only** in the baked relief cube (`writeBombardment → craterField → compositeMargins → bakeHeightCube → uReliefBakeCube`). `uReliefBakeStrength` is its **single multiplier**, and as it falls, an analytic FBM body **carrying no craters at all** cross-fades in to replace it.

| slider t | R (R⊕) | crossover | % of the Moon/Mercury preset's boot value |
|---|---|---|---|
| 0.000 | 0.300 | **0.047** | 22% |
| 0.020 | 0.325 | 0.094 | 43% |
| **0.040** | **0.352** | **0.152** | **70%** |
| 0.0595 | 0.380 (boot) | 0.219 | 100% |
| 0.303 | 1.000 | 1.000 | 458% |
| ≥0.651 | ≥4.0 | **0.000 (exact)** | 0% |

So **Moon/Mercury renders at only 22% baked relief at boot**, and dragging left takes it to 5%.

**Honest caveat, reported rather than papered over: this is a smoothstep ramp, not a hard cliff at t = 0.04.** No mechanism in the code produces a threshold there. Two exact numeric coincidences at t ≈ 0.04 were chased and eliminated (`surfaceGravity` crosses 0.25 at t = 0.04010 — no 0.25-gravity gate exists anywhere; `D_char` crosses the Pike transition at t = 0.04763 — nothing acts on it).

**A hard, complete "craters gone" DOES exist — at the other end.** At R ≥ 4 R⊕ the crossover is exactly 0, which additionally flips `bakedOn` (`planet-lod-rivers.js:1370`, which reads the *display-scaled* uniform) and abandons the whole worldengine carrier for the legacy in-shader RTT. Trivially reproducible; fix it in the same change.

**This was predicted and shipped without sign-off.** `FIX-PLAN.md:89-92`: *"a `bake→synth` crossover as `sVis` departs 1 … but **loses stamped basins at large radius** — a visible morph in continent character. **D3 needs Max's nod on mechanism before Slice D.**"* The fallback shipped. It is symmetric in `|log2 sVis|`, so it loses stamped basins at **small** radius too — and every impact-cratered preset lives there (Moon/Mercury 0.27–0.38, Mars 0.53, Crystal 0.3–0.8). The low-radius half was never reasoned about.

---

### (b) The physically-correct model, as implementable equations

**The core artifact: Johnson et al. 2016, Icarus 271:350–359, doi:10.1016/j.icarus.2016.02.023, eq (4).** It takes exactly the inputs you named — impactor size, density, speed, angle — plus target gravity, and returns a final crater diameter. Verified against the paper's own four worked examples (160 km and 300 km craters on Earth and the Moon) to within 1.2%.

**Final crater, non-porous** (MKS, valid for D_fin > D_SC):
```
D_fin = 1.52 · (ρ_imp/ρ_targ)^0.38 · D_imp^0.88 · v_imp^0.5 · g^−0.25 · D_SC^−0.13 · sin(θ)^0.38
```
**Porous branch** (eq 5): `1.66 · (…)^0.38 · D_imp^0.94 · v_imp^0.38 · g^−0.19 · D_SC^−0.13 · sin(θ)^0.38`

**Simple branch, below D_SC:** `D_fin = 1.25 · D_trans`, with
```
D_trans = 1.161 · (ρ_imp/ρ_targ)^(1/3) · D_imp^0.78 · v_imp^0.44 · g^−0.22 · sin(θ)^(1/3)
```

**Five draws per crater, all with published distributions:**

| draw | law | source |
|---|---|---|
| impactor diameter | bounded Pareto, `D = [L^−b − u(L^−b − H^−b)]^(−1/b)`; b ≈ 2 | assumption adopted in Brasser 2025, not a paper result |
| impactor density | Comet 0.8, C-type 1.8, S-type 3.0, **Steel** 7.8 g/cm³ | Holsapple impactor table (the 7.8 row is "Steel", not "iron") |
| impact angle | `α = asin(√u)` from the sin(2α) law; size factor `sin(α)^0.38`; ×1.67 spread | Robertson+2021, doi:10.3847/PSJ/abefda |
| impact velocity | `v_imp = √(v_inf² + v_esc²)`, `v_esc = √(2GM/R)` a **hard floor**; with M ∝ R^3.7, v_esc = 11.19·R^1.35 km/s | Robertson+2021 eqs (1)–(3) |
| target class | porous (μ=0.41) vs competent (μ=0.55) | Johnson+2016 eq 4/5; Prieur+2017 |

**Crater SFD slope from impactor slope:** `b_crater = b_imp / 0.88` (non-porous) or `/0.94` (porous).

**Simple→complex transition:** `D_SC(planet) = D_SC(Moon) · g_Moon/g` (Pike 1980, via Brasser+2020 eq 3). **Your `K_DT = 3.1` is CORRECT AS SHIPPED** — the literature product D_SC·g clusters at 24–39 km·m/s² across Moon/Earth/Mars/Mercury, and 3.1 × 9.81 = 30.4 sits dead centre. `D_D_SIMPLE = 0.20` also matches Pike 1977 exactly. **Do not touch either.**

**Saturation cap (stops naive over-production of small craters):** geometric saturation `n(>r) = 0.385 r^−2` (Gault 1970); empirical equilibrium is **0.7–4% of that**, best single value `n_eq(>r) = 0.0084 r^−2`, slope β = 2 (Minton+2019, doi:10.1016/j.icarus.2019.02.021). Diameter form: **`N(≥D) ≤ 0.0336 · D^−2` per unit area.** Your oldest-first obliteration stamping already produces equilibrium emergently, so treat this as a **validation target**, not a new formula.

#### The headline result — and it is the answer to your defect

**At fixed impactor, final crater diameter in KM is nearly independent of planet radius**, because the shrinking effect of higher g (g^−0.25) is almost exactly cancelled by two growing effects: higher impact velocity (v^0.5, with v_esc ∝ R^1.35) and a smaller simple→complex transition (D_SC^−0.13, D_SC ∝ 1/g).

| R (R⊕) | g | v_esc (km/s) | D_fin in km, vs Earth | **angular size, vs Earth** | flux per unit area |
|---|---|---|---|---|---|
| 0.5 | 0.40 | 4.98 | 1.04× | 2.07× | 0.76× |
| 1.0 | 1.00 | 11.2 | 1.00× | 1.00× | 1.00× |
| 1.5 | 1.99 | 19.3 | 1.04× | **0.69×** | **1.61×** |
| 2.0 | 3.25 | 28.5 | 1.11× | **0.56×** | **2.68×** |

**Therefore angular crater size falls as roughly 1/R. A bigger planet must read FINER-cratered.** That is the opposite of what the shader does, and it is exactly what you reported.

Referee correction, which strengthens this: with all three channels included the effective gravity exponent is **+0.00 / +0.11 / +0.17** at R = 1.0 / 1.5 / 2.0 — gravity is weakly *positive* for crater size on super-Earths, not merely neutral.

**Separately: a super-Earth is hit MORE OFTEN per unit area.** Gravitational focusing gives a per-area flux enhancement of **(1 + v_esc²/v_inf²)** — 1.61× Earth at 1.5 R⊕, 2.68× at 2.0 (×2.25 and ×4 in area, so 3.6× and 10.7× total impacts). This depends on **escape velocity**, not surface gravity — which is why removing a *g*-keyed count factor (`bombardment.js` footnote 1) was right, and leaving nothing in its place is wrong. **This is the missing driver for crater density on large planets, which the engine currently gets from surface age alone.** ⚠ Every planetary number in that column rests on `v_inf = 16.9 km/s`, a back-out from a mean Earth impact speed of 20.3 km/s that is **uncited**. Derive it from Robertson 2021's retrieved velocity PDF or Brasser 2020 Table A1 before shipping.

#### Epistemic status — better than the relief law, not the same

The lens report framed this as "the identical epistemic situation as the relief law." **That is wrong, and it matters.** The π-group law is a function of **π₂ = g·a/U²**, not of g. A 2 R⊕ super-Earth at fixed impactor sits at π₂ = **1.21×** Earth's — equivalent to a 21% larger impactor on Earth, deep inside the calibrated range. And Holsapple 2022 confirms centrifuge cratering *"at up to 500G ... a way to vary the π₂ parameter, in place of increasing the impactor size."* Venus is also at 0.904 g with a Magellan-mapped crater record.

**Transient-crater scaling to super-Earths is experimentally grounded.** The genuine extrapolation is narrower: **D_SC, γ and η are fitted to observed planetary craters at ≤1 g, there are no laboratory complex craters, and Holsapple concedes "we really don't have definitive information about appropriate strengths"** for the transition. The code comment should say exactly that.

#### What you can ignore

The **strength regime** is irrelevant for anything a planet renderer draws. The strength→gravity transition is at crater diameters of **0.4 m to 153 m** at Earth gravity depending on material (hard rock: 153 m). Use the pure gravity-regime forms everywhere. Do **not** confuse that transition with the simple→complex transition (3.2 km Earth / 15 km Moon) — different mechanism, though both scale as 1/g.

---

### (c) Size of the work — honest estimate

**Your desired behaviour is a refactor of an existing subsystem, not a new one.** The engine already has a probabilistic size draw (bounded Pareto, `drawBoundedPareto`, oldest-first obliteration stamping). What it does not have is impactor size, impactor density, velocity, angle, focusing, or a **physical** lower band edge. Three tiers:

#### TIER 0 — the disappearance bug. Half a day to a day. Do first; independent of everything else.

Stop the crater channel riding the bake↔synth cross-fade. Two candidate mechanisms:
- **(a)** split the craterField onto its own strength uniform that is **not** cross-faded — requires splitting `compositeMargins`, a second cube + uniform + blend term; or
- **(b)** implement the FIX-PLAN's actually-recommended Slice D (re-bake the continuous body at display density) and delete the crossover fallback entirely.

Plus one line: make `bakedOn` (`planet-lod-rivers.js:1370`) read `grainCarveUI.reliefBakeStrength` (the author's intent) rather than the per-frame display product.

⚠ **Not checkable headlessly.** `bakeReliefCrossover` only runs inside `frame()`, which goldens never execute. Needs a live A/B at `reliefBakeStrength = 1.0` at R = 0.30 / 0.38 / 1.0 on Moon/Mercury, plus 4.0 and 8.0 for the hard-zero end. Staging at `bake = 0` would repeat the "tested the wrong profile" miss the FIX-PLAN already calls out.

#### TIER 1 — the constant-size bug. 2–4 days plus a product decision. This is a workstream, not a fix.

**The one structural change:** stop truncating the *draw* at the mesh floor. Draw D_km from a **physical** band `[D_LO_KM·sizeMul, min(C_BASIN·R_km, basin limit)]`, then decide **at stamp time** which craters clear `D_FLOOR_KM` and get BFS-stamped, folding the rest into the sub-floor texture band. That single move restores δ ∝ 1/R, revives `sizeMul` as a size law, and makes `nStamp` scale with area.

**What breaks and must move with it:**
- `nStamp` becomes ∝ R² — a ×256 loop growth at R=16 against `N_STAMP_SAFETY = 5000`. Needs re-derivation, **not** a cap (the v2-6 plan explicitly rejected a cap because it flattened the radius law).
- `F_REF = 488000` was solved against the [10%,80%] coverage gate *under the truncated band*. Must be recalibrated. Harness exists: `calibration/crater-sfd-km.mjs`.
- The closed-form second moment `ED2` (`:187`) is hard-coded for B=2 and is load-bearing for the coverage gate.
- `regolithRoughness` and `state.craterDensity` re-derive.
- **Tests go red:** `worldengine-v2-6-craters.test.js` (AC-RADIUS-LAW), `radius-live-feed.test.js` (its `craterRelevanceOf` reduction is valid *only because* `D_FLOOR_KM > L` everywhere — exactly the condition the fix removes), `worldengine-inc3b-crater-relevance.test.js`, the `EPSILON_VCF` clamp.

**The hard constraint that must be faced, not designed around:** at fixed km, a big planet's craters fall **below the mesh floor**. `MESH_FLOOR_RAD = 0.055` rad at `TARGET_N = 40000`; `RELIEF_CUBE_SIZE = 256`. A 500 km crater is 4.5° on Earth and 0.28° on a 16 R⊕ world — under a node spacing of ~1°. **A correct size law requires the sub-floor population to render**, which means the `_Dchar` derivation (`world-engine-lab.html:3813-3823`) must stop anchoring both ends to `D_FLOOR_KM` and carry real km through `featureFrequencyFromKm`.

**A product decision, not a code fix.** The `* sVis` term at `:6264`, `visScaleOf`'s `VIS_SCALE_EXP = 0.5`, and `bakeReliefCrossover` all exist to **hold apparent size constant on a growing disc**. The whole "hold apparent size" program and "craters should read physically smaller on a big world" are in **direct opposition**. One of them has to yield. **That is yours to decide, and it is the gate on Tier 1.**

#### TIER 2 — the full impactor model. ~1 day of code + 1–2 days recalibration, *given Tier 1 is done*.

This is the probabilistic impactor distribution you described. On top of Tier 1 it is genuinely modest — **~40 lines of closed-form JS, no new data files, no solver:**
- impactor diameter draw (reuse `drawBoundedPareto`, change what it draws)
- density-by-type — a 4-entry table
- `α = asin(√u)`, factor `sin(α)^0.38` — one line
- `v_imp = √(v_inf² + v_esc²)` — one line, plus a `v_inf` policy decision
- focusing `(1 + v_esc²/v_inf²)` on the count — one line
- porous/non-porous branch selection

The cost is not the code — it is that **every one of those knobs changes `nStamp` and coverage**, so `F_REF` recalibration happens once at the end rather than per-knob. And `v_inf` needs a policy: **there is no published `v_inf`(heliocentric distance) law**; the a^−1/2 parameterisation is a plausible guess, not a citation.

#### ⚠ Do not bolt Tier 2 on without Tier 1

Adding Johnson eq (4) to the *current* truncated band would produce a physically-parameterised law whose output is **still exactly R-invariant**. Right physics, wrong answer, real citations. That is the worst outcome available.

#### Three constants worth correcting while you're in there

- **`K_GS`:** it is applied to *final*-crater diameters, so the correct porous/non-porous pair is **0.19 / 0.25**, not 0.17 / 0.22 (those are transient exponents). Currently moot, since K_GS is dead — it becomes live and matters the moment Tier 1 lands.
- **`P_COMPLEX = 0.66`** is a deliberate two-constraint fit (Pike slope + South Pole–Aitken depth), *not* a mis-transcription of 0.699. Changing it discards the SPA constraint. That is a decision, not a cleanup.
- **The atmospheric floor needs no change and any "fix" is a trap.** `D_LO_KM = max(D_SFD_MIN_KM /* 1 km */, D_ATMO_KM)` means the atmo floor is **completely inert below P = 16.8 bar** — Earth and Mars are governed entirely by the 1 km anchor. The proposed refit to `P^0.97` would still leave Earth and Mars unchanged and would move **Venus away** from the observation justifying it (89% → 67% depletion, against ~98% observed). **The real gap** is that Venus needs a **graded** survival probability rising from ~0 at 2 km to 1 at ~30–35 km (Phillips et al. 1992, verbatim: *"for craters larger than about 30 km, the size-frequency distribution is close to the atmosphere-free case"*), not any single floor.
- **`B_SFD` age-dependence is not a two-line change.** It is load-bearing in three other places (`screen`, `P_STAMP`, the `ED2` closed form calibrated against `F_REF`). The underlying physics point is sound — an ancient airless world should carry Strom's wavy Population-1 shape (cumulative ~1.2 from 1–50 km) rather than young-mare Population-2 statistics — but budget it as a calibration change.

---

## Derived vs Calibrated vs Chosen

You said this distinction matters more than any number. Here it is explicitly.

| quantity | status | basis |
|---|---|---|
| g(R) piecewise, R^4/3 / R^1.70 | **DERIVED** | Valencia+2006, Zeng+2016 — shipped |
| relief exponent q ≈ 1.09 | **DERIVED** | Guimond+2022, doi:10.3847/PSJ/ac562e, domain 0.1–5 M⊕ |
| relief bracket [0.74, 1.61] | **INFERENCE** | back-out from Guimond Fig. 7 water-mass-fraction slopes; not a stated result |
| relief amplitude at Earth (19.9 km) | **CALIBRATED** | 5-body Solar-System extreme-value fit, all ≤ 1 g, *total* relief |
| dropping the piecewise-in-g break | **DERIVED** | Guimond's law is continuous across 0.1–5 M⊕; Melosh's data cannot locate a break |
| `RELIEF_FLOOR = 0.40` | **CHOSEN** | no basis; binds at R = 1.64 and would flat-clamp the branch |
| p_C (texture exponent) | **CHOSEN — and must be labelled UNDERDETERMINED** | flexure's −0.25 is textbook-certain but falsified 5× by Earth-vs-Venus and 1.57× by Landais; no value survives both |
| striking the Landais p_C = 0 justification | **DERIVED** | mechanism misidentified by 12–21× against T&S's own worked number; authors call it a hypothesis; zero gravity analysis in the paper |
| crater simple→complex `K_DT = 3.1` | **CALIBRATED, and correct** | D_SC·g clusters 24–39 km·m/s² across 4 bodies; 3.1×9.81 = 30.4 |
| crater depth `D_D_SIMPLE = 0.20` | **DERIVED** | Pike 1977, exact |
| `P_COMPLEX = 0.66` | **CALIBRATED** | Pike slope + SPA depth, two constraints |
| Johnson eq (4) crater size law | **DERIVED** | doi:10.1016/j.icarus.2016.02.023, verified against its own worked examples |
| crater angular size ∝ 1/R | **DERIVED (composition)** | Johnson eq 4 + Robertson v_esc + Pike D_SC + shipped M(R). No single paper states it |
| gravitational focusing (1 + v_esc²/v_inf²) | **DERIVED** | Armitage eq (181) / Safronov 1969 |
| `v_inf = 16.9 km/s` | **CHOSEN, currently UNCITED** | load-bearing for every focusing and velocity number |
| impactor SFD b ≈ 2 | **ASSUMPTION ADOPTED** | Brasser 2025 uses it as an input; the real MBA/NEO SFDs are wavy |
| tectonic regime prior for super-Earths | **CHOSEN — no published prior exists** | `SUPER_EARTH_REGIME_WEIGHTS` *is* the declaration |
| Lyu 2025 MPa regime boundaries | **DERIVED at Earth conditions, AUTHORED above** | zero super-Earth content; the Meier bridge is void |
| mobile/stagnant hypsometry difference | **DERIVED** | Adams & Laughlin, arXiv:2312.07483 (preprint) |
| plate count invariant in R | **DERIVED NULL LAW, but recorded nowhere in code** | Valencia+2007 (L/R 0.29 → 0.30 from 1 to 10 M⊕). Currently correct **by omission** — add the comment before someone "fixes" it |

---

## Citations relied on

### Relief amplitude

| source | identifier | retrieval |
|---|---|---|
| Guimond, Rudge & Shorttle 2022, PSJ 3:66 | doi:10.3847/PSJ/ac562e · arXiv:2201.05636 | FULL_TEXT |
| Guimond et al. 2026, Space Sci Rev 222:8 | doi:10.1007/s11214-025-01264-5 · arXiv:2512.09785 | FULL_TEXT |
| Cowan & Abbot 2014, ApJ 781:27 | doi:10.1088/0004-637X/781/1/27 · arXiv:1401.0720 | FULL_TEXT |
| O'Rourke & Korenaga 2012, Icarus 221:1043 | doi:10.1016/j.icarus.2012.10.015 · arXiv:1210.3838 | FULL_TEXT |
| Heap, Byrne & Mikhail 2017, Icarus 281:103 | doi:10.1016/j.icarus.2016.09.003 | FULL_TEXT — **refutes** the constant-relief use |
| Byrne et al. 2021, JGR Planets 126:e2021JE006952 | doi:10.1029/2021JE006952 | FULL_TEXT (via St Andrews repo) |
| Melosh 2011, *Planetary Surface Processes* ch.3 | doi:10.1017/CBO9780511977848 | FULL_TEXT |
| Broquet, Maia & Wieczorek 2025, JGR Planets 130 | doi:10.1029/2025JE009139 | ABSTRACT_ONLY |
| Landais, Schmidt & Lovejoy 2019, MNRAS 484:787 | doi:10.1093/mnras/sty3253 · arXiv:1902.00047 | FULL_TEXT |
| Whipple & Tucker 1999, JGR 104:17661 | doi:10.1029/1999JB900120 | ABSTRACT_ONLY |
| Egholm et al. 2009, Nature 460:884 | doi:10.1038/nature08263 | ABSTRACT_ONLY |
| Dielforder, Hetzel & Oncken 2020, Nature 582:225 | doi:10.1038/s41586-020-2340-7 | ABSTRACT_ONLY |
| Zeng, Sasselov & Jacobsen 2016 | doi:10.3847/0004-637X/819/2/127 | shipped in project record |
| Parsons & Daly 1983, JGR 88:1129 | doi:10.1029/JB088iB02p01129 | ABSTRACT_ONLY (via Guimond) |
| Lees, Rudge & McKenzie 2020, G³ 21 | doi:10.1029/2019GC008809 | ABSTRACT_ONLY (via Guimond) |

### Terrain texture scale

| source | identifier | retrieval |
|---|---|---|
| Turcotte & Schubert, *Geodynamics* 3rd ed., §3.14/§3.15 | doi:10.1017/CBO9780511843877 | FULL_TEXT (ch.3 PDF; ends at eq 3.124) |
| Landais, Schmidt & Lovejoy 2019, Icarus 319:14 | doi:10.1016/j.icarus.2018.07.005 · arXiv:1805.11249 | FULL_TEXT |
| Crooks, Bar-Yam, Buldyrev & Stanley | arXiv:1809.02457 | ABSTRACT_ONLY — Earth 10 km / Venus 50 km |
| Watts & Burov 2003, EPSL 213:113 | doi:10.1016/S0012-821X(03)00289-9 | FULL_TEXT |
| van Heck & Tackley 2011, EPSL 310:252 | doi:10.1016/j.epsl.2011.07.029 | FULL_TEXT |
| Melosh 2011 ch.6, "Impact cratering" | doi:10.1017/CBO9780511977848.007 | FULL_TEXT |
| Sandwell 2001, flexure lecture notes | topex.ucsd.edu/geodynamics/12flexure.pdf (no DOI) | FULL_TEXT |
| Biot 1961, GSA Bull 72:1595 | doi:10.1130/0016-7606(1961)72[1595:TOFOSV]2.0.CO;2 | NOT_RETRIEVED — **DOI resolves** (the earlier "failed" report was a percent-encoding false negative) |
| ETH Zurich "Folding" lecture notes (jpb 2017) | files.ethz.ch (no DOI) | FULL_TEXT |
| Ermakov, Park & Bills 2018, JGR Planets 123:2038 | doi:10.1029/2018JE005562 | ABSTRACT_ONLY — ⚠ do not cite any exponent *or* qualitative reading |

### Tectonic regime

| source | identifier | retrieval |
|---|---|---|
| O'Neill et al. 2016, PEPI 255:80 | doi:10.1016/j.pepi.2016.04.002 | ABSTRACT_ONLY (substantive) |
| O'Neill & Lenardic 2007, GRL 34:L19204 | doi:10.1029/2007GL030598 | ABSTRACT_ONLY |
| van Heck & Tackley 2011, EPSL 310:252 | doi:10.1016/j.epsl.2011.07.029 | FULL_TEXT |
| Lyu et al. 2025, Nat Commun 16:10037 | doi:10.1038/s41467-025-65943-1 | FULL_TEXT |
| Weller & Lenardic 2018, Geosci Front 9:91 | doi:10.1016/j.gsf.2017.03.001 | FULL_TEXT |
| Weller & Lenardic 2012, GRL 39 | doi:10.1029/2012GL051232 | NOT_RETRIEVED (source of the TCTW-604 / 10¹⁰ figure) |
| Lenardic & Crowley 2012, ApJ 755:132 | doi:10.1088/0004-637X/755/2/132 | ABSTRACT_ONLY (via OpenAlex) |
| Ferrick & Korenaga 2023, JGR Solid Earth 128 | doi:10.1029/2023JB027869 | ABSTRACT_ONLY |
| Al Asad et al. 2023, JGR Solid Earth 128 | doi:10.1029/2023JB027274 | ABSTRACT_ONLY — O'Connell-number definition **not** obtained |
| Foley & Bercovici 2014, GJI 199:580 | doi:10.1093/gji/ggu275 · arXiv:1410.7652 | FULL_TEXT |
| McIntyre 2022, A&A 662:A15 | doi:10.1051/0004-6361/202141112 | FULL_TEXT |
| Zanazzi & Triaud 2019, Icarus 325:55 | doi:10.1016/j.icarus.2019.01.029 | criterion via McIntyre |
| Ballmer & Noack 2021, Elements 17:245 | doi:10.2138/gselements.17.4.245 · arXiv:2108.08385 | FULL_TEXT |
| Meier et al. 2024, JGR Planets 129 | doi:10.1029/2024JE008491 · arXiv:2408.10851 | FULL_TEXT — ⚠ assumes mobile lid throughout; its 125–200 MPa is a **convection-planform** transition |
| Adams & Laughlin 2023 | arXiv:2312.07483 | FULL_TEXT (preprint, no journal ref) |
| Spaargaren et al. 2020, A&A 643:A44 | doi:10.1051/0004-6361/202037632 · arXiv:2007.09021 | FULL_TEXT |
| Affholder et al. 2025, AJ 169:125 | doi:10.3847/1538-3881/ada384 · arXiv:2406.16104 | FULL_TEXT |
| Lourenço et al. 2020, G³ 21 | doi:10.1029/2019GC008756 | ABSTRACT_ONLY |
| Stern, Gerya & Tackley 2018, Geosci Front 9:103 | doi:10.1016/j.gsf.2017.06.004 | ABSTRACT_ONLY |
| Baumeister et al. 2025 (review) | arXiv:2511.10269 | verbatim quote verified |
| Stamenković & Breuer 2014, Icarus 234:174 | doi:10.1016/j.icarus.2014.01.042 | **NOT_RETRIEVED — highest-value gap** |
| Noack & Breuer 2014, PSS 98:41 | doi:10.1016/j.pss.2013.06.020 | NOT_RETRIEVED |
| Valencia, O'Connell & Sasselov 2007 | arXiv:0710.0699 | plate-size null, in project record |

### Crater scaling and impactor population

| source | identifier | retrieval |
|---|---|---|
| **Johnson et al. 2016, Icarus 271:350** | **doi:10.1016/j.icarus.2016.02.023** | **FULL_TEXT — the core artifact** |
| Collins, Melosh & Marcus 2005, MAPS 40:817 | doi:10.1111/j.1945-5100.2005.tb00157.x | NOT_RETRIEVED (eq 1 confirmed second-hand via Johnson) |
| Holsapple, LPI crater-calculator theory doc | lpi.usra.edu/lunar/tools/lunarcratercalc/theory.pdf (no DOI) | FULL_TEXT — ⚠ **K2 sits OUTSIDE the bracket** in eq (7) |
| Holsapple 2022 | arXiv:2203.07476 | FULL_TEXT |
| Holsapple 1993, Annu Rev Earth Planet Sci 21:333 | doi:10.1146/annurev.ea.21.050193.002001 | NOT_RETRIEVED |
| Housen & Holsapple 2011, Icarus 211:856 | **doi:10.1016/j.icarus.2010.09.017** | NOT_RETRIEVED — ⚠ `10.1016/j.icarus.2011.02.005` is a **different paper** (Turtle et al., Titan) |
| Kurosawa & Takada 2019, Icarus 317:135 | doi:10.1016/j.icarus.2018.06.021 · arXiv:1806.07665 | FULL_TEXT — ⚠ contains **no K2**; cannot verify parenthesisation |
| Robertson et al. 2021, PSJ 2:88 | doi:10.3847/PSJ/abefda | FULL_TEXT |
| Brasser, Werner & Mojzsis 2020, Icarus 338:113514 | doi:10.1016/j.icarus.2019.113514 · arXiv:1910.11282 | FULL_TEXT |
| Silber et al. 2017, JGR Planets 122:800 | doi:10.1002/2016JE005236 · arXiv:1704.04247 | FULL_TEXT |
| Armitage, planet-formation lecture notes | arXiv:astro-ph/0701485 | FULL_TEXT |
| Nesvorný et al. 2024 (NEOMOD 3), Icarus 417:116110 | arXiv:2404.18805 | FULL_TEXT |
| Strom et al. 2015, RAA 15:407 | doi:10.1088/1674-4527/15/3/009 · arXiv:1407.4521 | FULL_TEXT |
| Minton et al. 2019, Icarus 326:63 | doi:10.1016/j.icarus.2019.02.021 · arXiv:1902.07746 | FULL_TEXT |
| Marchi et al. 2014, PSS 103:96 | doi:10.1016/j.pss.2013.05.005 · arXiv:1305.6679 | FULL_TEXT |
| Williams, Pathare & Aharonson 2014, Icarus 235:23 | doi:10.1016/j.icarus.2014.03.011 · arXiv:1309.2849 | ABSTRACT_ONLY |
| Prieur et al. 2017, JGR Planets 122:1704 | doi:10.1002/2017JE005283 | ABSTRACT_ONLY |
| Gault 1970, Radio Science 5:273 | doi:10.1029/RS005i002p00273 | NOT_RETRIEVED (relation verbatim via Minton 2019) |
| Richardson et al. 2005, Icarus 179:325 | doi:10.1016/j.icarus.2005.07.005 | NOT_RETRIEVED (quote verbatim via Minton 2019) |
| Phillips et al. 1992, JGR 97 | doi:10.1029/92JE01696 | ABSTRACT_ONLY ("30 km" verified) |
| Bjonnes et al. 2022, JGR Planets 127 | doi:10.1029/2021JE007028 | ABSTRACT_ONLY (26 km inflection verified) |
| Schenk 2002, Nature 417:419 | doi:10.1038/417419a | NOT_RETRIEVED — the ~2 km ice transition is **second-hand** |
| Kraus, Senft & Stewart 2011, Icarus 214:724 | doi:10.1016/j.icarus.2011.05.016 | NOT_RETRIEVED — the **right** source for ice |
| Le Feuvre & Wieczorek 2011, Icarus 214:1 | doi:10.1016/j.icarus.2011.03.010 | NOT_RETRIEVED |
| Neukum, Ivanov & Hartmann 2001, SSR 96:55 | doi:10.1023/A:1011989004263 | NOT_RETRIEVED — **coefficients not obtained; do not reproduce** |
| Bottke et al. 2005, Icarus 175:111 | doi:10.1016/j.icarus.2004.10.026 | NOT_RETRIEVED |
| Leliwa-Kopystyński, Burchell & Lowen 2008, Icarus 195:817 | doi:10.1016/j.icarus.2008.02.010 | NOT_RETRIEVED — D/R = 0.90 ± 0.05 is a **mean**, not a cap |
| Bierhaus et al. 2012, Icarus 218:602 | doi:10.1016/j.icarus.2011.12.011 | NOT_RETRIEVED — its threshold is Mimas/Enceladus (160–240 m/s), not Vesta |
| Benz & Asphaug 1999, Icarus 142:5 | doi:10.1006/icar.1999.6204 | NOT_RETRIEVED |
| Bland & Artemieva 2003, Nature 424:288 | doi:10.1038/nature01757 | NOT_RETRIEVED — ⚠ its **net result** (stony/iron dichotomy) contradicts the 22 m Earth-floor use it was put to |
| Hirabayashi, Fassett, Costello & Minton 2024, PSJ 5(11):250 | doi:10.3847/PSJ/ad8883 | ABSTRACT_ONLY — ⚠ its **β is a degradation exponent**, not the equilibrium slope |
| Vitale & Hirabayashi 2026 (Ceres) | arXiv:2604.16223 | ABSTRACT_ONLY |
| Marchi et al. 2016, Nat Commun 7:12257 | doi:10.1038/ncomms12257 | NOT_RETRIEVED |
| Brasser 2025 | arXiv:2506.08499 | FULL_TEXT (b ≈ 2 is an adopted input, not a result) |

**Citation-integrity note:** across ~100 identifiers checked by two hostile referees, **zero failed to resolve and zero were fabricated**, including one 2026 arXiv ID that was pre-registered as the highest fabrication risk and turned out real and correctly attributed. The failures in this round were of a different kind — inference tagged as result, symbol collisions across papers, and citations read past their stated scope. Six such cases are flagged with ⚠ above.

---

## What the science does not know

Stated plainly, because several of these are load-bearing.

1. **Nobody has quantified Y(g)** — brittle strength as a function of surface gravity. This is the single most valuable missing number in the relief problem. Heap+2017 argues the mechanism qualitatively; Byrne+2021 models brittle-layer *thickness* but produces no strength exponent; Guimond+2022 flags the gap and does not close it.

2. **Nobody has modelled TOTAL relief on any planet.** Every model predicts dynamically- or isostatically-supported relief. The observational anchor set is total relief including impact basins and volcanic constructs. Guimond's own basin capacities fall ~3× short of Venus/Earth/Mars. The slope and the amplitude come from different physics and nobody has joined them.

3. **Melosh's "history must play a role" has no quantitative counterpart with a gravity term anywhere in the literature.** Quantitative mountain-height models exist (Whipple & Tucker stream power, Egholm glacial buzzsaw, Dielforder megathrust force balance) but every one is Earth-only, parameterised by *climate* or *tectonic force*, and Egholm and Dielforder reach **opposite conclusions about which controls Earth**.

4. **Nobody has ever fitted topographic spectral-break location against surface gravity on any dataset.** The two observations that exist contradict each other: Landais's four bodies show the *same* break across 6× in g; Crooks's Earth-vs-Venus shows a **5× different** break at essentially the *same* g. Both contradict flexure. The horizontal length scale, like Melosh's amplitude, cannot be located in g from the data.

5. **No published regime diagram has planet mass or radius as an axis with an agreed sign.** That IS the 18-year deadlock. Every existing diagram is drawn in yield stress, Rayleigh number, damage/healing ratio, viscosity contrast, internal heating rate, or CMB temperature — never mass. Ferrick & Korenaga 2023 say such a diagram is "within reach," which means it does not exist.

6. **There are two competing accounts of the deadlock itself** — an assumptions/nondimensionalisation problem, or genuine multiplicity of stable solutions at identical parameters. They are mutually exclusive and unresolved.

7. **No published mapping from planet mass to lithospheric yield stress in MPa.** This is the precise missing link between Lyu's beautiful Earth-condition boundaries and the mass/radius the engine has. The apparent bridge (Meier's GJ 486b sweep) is void.

8. **No published prior on the fraction of super-Earths that are mobile-lid.** The only counted fraction anywhere (McIntyre 28%/72%) is for tidally locked planets with R ≤ 1.23 R⊕ via a purely tidal criterion, and its author flags the sample as biased. Affholder+2025 confirm the absence by *designing* their analysis to be prior-agnostic.

9. **Whether tectonic bistability is real at all is contested.** The two newest scaling papers lean against it.

10. **No crater-scaling work for super-Earths or exoplanets exists.** But the *transient* branch is not extrapolation — π₂ barely moves and has been spanned experimentally to 500 G. The genuine gap is narrower: **complex-crater collapse** (D_SC, γ, η) is fitted to observed planetary craters at ≤1 g, no laboratory complex crater exists, and Holsapple concedes strengths at that scale are unknown.

11. **No source exists for v_inf as a function of heliocentric distance.** The a^−1/2 parameterisation is a guess, and v_inf is load-bearing for every gravitational-focusing and impact-velocity number above.

12. **The ice simple→complex transition constant is second-hand.** Verify from Kraus, Senft & Stewart 2011 before hard-coding an ice branch.

---

## The one thing I'd do first

**Tier 0 of decision (6)** — unhook the crater channel from `bakeReliefCrossover`. It is half a day, it is independent of every other decision, it fixes a defect you can see, and it also fixes the hard crater loss at R ≥ 4 R⊕ that nobody has reported yet because nobody drags that far.

Everything else in decisions 1, 3 and 6-Tier-1 shares one ordering constraint: **g(R) → v2 relief law (and move `RELIEF_FLOOR`) → then wire `condition.surfaceGravity` into `bodyDrivers.massGravity`.** Until that last step lands, none of the physics you adopt reaches the screen — and if it lands *before* the relief floor moves, the floor silently clamps every super-Earth flat.