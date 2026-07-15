# DERIVE-FORMS.md — D-slot derivation forms + regime ranges (Slice R)

> **Author:** Slice-R researcher, 2026-07-15, worktree `~/projects/well-dipper-atmo`
> (branch `feature/world-engine-atmo-3b`). Symbol anchors only — never line numbers.
> **Satisfies:** BUILD-PLAN §3 (Slice R deliverable), contract designDecision-2 (D-slot derivation
> per ATMOSPHERE-PLAN §(e)). **Unblocks:** Slice D (`giant-drivers.js` `deriveGiantDrivers`).
> **Ratify gate:** the FORMS TABLE (below) is what Max nods before Slice D wires the constants — the
> per-regime range width is the one taste-adjacent call (see §5 EXPECTATIONS).

## 0. What this pins, and how to read it

Three scalars — `shellDepthFrac`, `internalHeat`, `dissipation` — are frozen per-regime constants
today (`DRIVER_BUNDLES` in `climate-e5.js`). This doc pins the **derivation FORMS** that let them
derive per-seed from the condition vector (`deriveConditionVector` in `body-condition-vector.js`),
so a re-roll gives a different — but still regime-plausible — jet profile. It answers three things
per scalar: (a) the condition→value **FORM** (which inputs, what functional shape, which sign each
dependency carries — the AC-DERIVER **(D4)** monotonicity target); (b) a regime-plausible **RANGE**
per giant regime; (c) the **ANCHOR** check — that the canonical condition vector reproduces the
current `DRIVER_BUNDLES` triple (so the textbook body still reads like itself and the shipped
#3a/#3b goldens are preserved).

**Design pattern (load-bearing — makes the anchor exact by construction).** Every form is an
**anchored multiplicative response**: `value = BUNDLE0[regime] · Π (response factors)`, where each
factor equals **1** at that regime's canonical condition inputs. So at the canonical draw the output
is *exactly* the `DRIVER_BUNDLES` value (float-epsilon tolerance) — the §3 anchor check is trivially
satisfied, and all per-seed variety comes from perturbing the condition inputs. This mirrors the
GROUND track's condition→driver-**response** multiply pattern (ATMOSPHERE-PLAN §(e) names it: "the
atmosphere analog of the GROUND track's #2 / #4-MULTIPLY driver-response passes").

**Confidence flags** (house style, PHENOMENA-TAXONOMY §0.4): `observed` = spacecraft/direct imaging ·
`model-predicted` = GCM/interior-model, robust but not directly measured · `speculative` = plausible,
weakly constrained · `†unverified` = a specific number recalled from training, not re-fetched this
session. Applied per claim below.

**Coefficient discipline (measure-first, per BUILD-PLAN [RESOLVED-BY-REVISE: 3] / [minor-2]).** The
**signs** of each dependency are fixed by physics (pinned here, and asserted by D4). The **magnitudes**
(the response exponents α…ζ, and the exact clamp widths) are calibrated at Slice D to land the ranges
below on the live sweep — they are NOT hard-pinned at BUILD-PLAN. The ranges in the FORMS TABLE are the
ratify artifact; the exponents are how the deriver hits them.

---

## FORMS TABLE — the ratify artifact (one row per scalar)

| Scalar | FORM (condition → value) | Condition inputs | Per-regime RANGE (J / S / N / SubN / HJ) | Anchor check |
|---|---|---|---|---|
| **internalHeat** | `IH0[reg] · (M/M0)^α · (age0/age)^β · (T0/T_eq)^γ`, clamp ±12%. Emitted/absorbed energy-balance ratio (convective-vigor proxy). **Signs:** ↑ mass, ↓ age, ↓ T_eq. (α,β,γ > 0; calibrated at Slice D.) | mass `= surfaceGravity·radiusEarth²`; `age`; `T_eq` (all in `condition`) | 1.47–1.87 / 1.57–1.99 / **2.29–2.91** / 1.01–1.29 / 1.76–2.24 (±12% of bundle) | canonical (M0,age0=4.5,T0) → factors=1 → **1.67 / 1.78 / 2.60 / 1.15 / 2.00** exact |
| **shellDepthFrac** | `SDF0[reg] · (1 − δ·(Z/Z0 − 1))`, clamp to regime band. Fractional radius of the jet-bearing convective shell; sets eq-jet SIGN via `tanh(6·(SDF−0.40))`. **Sign:** ↓ metal/ice enrichment Z (↑ H/He fraction). (δ > 0.) | `Z` = metallicity if present, else enrichment proxy from `density` + `composition` (iron+volatile frac) | 0.74–0.86 / 0.85–0.95 / 0.09–0.21 / **0.28–0.44** / 0.80–0.90 | canonical (Z=Z0) → factor=1 → **0.80 / 0.90 / 0.15 / 0.35 / 0.85** exact |
| **dissipation** | `DIS0[reg] · (SDF/SDF0)^ε · (T_eq/T0)^ζ`, clamp ±15%. Net wind damping (Ohmic braking where winds meet the conducting layer + drag) — the wind-paradox denominator. **Signs:** ↑ shellDepthFrac, ↑ T_eq. (ε,ζ > 0.) | derived `shellDepthFrac` (above); `T_eq` | 0.85–1.15 / 0.72–0.98 / 0.13–0.17 / 0.47–0.63 / 1.02–1.38 (±15%) | canonical (SDF=SDF0,T_eq=T0) → factors=1 → **1.00 / 0.85 / 0.15 / 0.55 / 1.20** exact |

Regimes: J=Jovian, S=Saturnian, N=Neptunian, SubN=Sub-Neptune, HJ=Hot-Jupiter. **Bold** ranges are the
two variety-carriers Max should look at: Neptunian internalHeat (widest absolute swing → band-count
sensitivity) and Sub-Neptune shellDepthFrac (the only range that straddles `D_THR=0.40` → eq-jet SIGN
flip; see §5).

---

## 1. Physical basis per scalar (the FORMS, grounded)

### 1.1 `internalHeat` — the energy-balance ratio (LAW3 amplitude numerator `F_int`)

**What it is.** The amplitude law `U = C·√(F_int/dissipation)·(1+κ(1−D/a))` (LAW3, `amplitudeLaw`) reads
`internalHeat` as `F_int`, the convective vigor that drives the zonal winds. LAW3 *deliberately omits
insolation* — that IS the Neptune wind paradox (Neptune has the fastest winds despite the least
sunlight). The `DRIVER_BUNDLES` values are the **emitted/absorbed energy-balance ratios** measured for
the solar-system giants: Jupiter **1.67**, Saturn **1.78**, Neptune **2.61** (Pearl & Conrath 1991,
Voyager/IRIS; refined by Li et al. 2018 with Cassini/Juno) — these match the bundle triple 1.67 / 1.78
/ 2.60 essentially exactly [`observed`]. Uranus's near-unity ratio (**1.06**, Voyager-2; a 2025 GRL
re-analysis, Wang et al., puts its internal flux at ~12.5% of absorbed — non-zero but tiny) is the
low-internal-heat tell that separates a Uranian read from Neptune [`observed`]. Sub-Neptune (1.15) and
Hot-Jupiter (2.00) have no direct energy-balance measurement — they are model extrapolations
[`model-predicted`/`speculative`]; HJ is elevated because intense irradiation + Ohmic/tidal heating
inflate the deep entropy.

**Why this interpretation is coherent.** `internalHeat` is the **ratio** (internal + reprocessed vs.
absorbed), not absolute flux. That is precisely why cold, far-out Neptune scores highest: its tiny
insolation denominator lifts the ratio. Within a regime the response therefore rises with residual +
contraction luminosity (↑ mass, ↓ age, via Kelvin-Helmholtz cooling — Burrows/Marley giant-cooling
tracks †unverified for exact slopes) and rises as absorbed insolation falls (↓ T_eq). Signs, not
slopes, are load-bearing.

**FORM.** `internalHeat = IH0[regime] · (M/M0)^α · (age0/age)^β · (T0/T_eq)^γ`, then clamp to ±12% of
`IH0`. Mass `M = condition.surfaceGravity · condition.radiusEarth²` (Earth units; g=M/R²). `age0 = 4.5`
(the `deriveConditionVector` age fallback — note **all** gas presets omit `age`, so at canonical
`age=age0` and the age factor is 1; the term exists for physical honesty and the D4 age-perturbation
test). α,β,γ > 0, magnitudes calibrated at Slice D to land the ±12% band from a plausible
(mass ±~30%, age ±~1.5 Gyr, T_eq ±~10%) within-regime spread.

**Why ±12% is the right width (band-count variety).** `uPeak = √(internalHeat/dissipation)·(1+κ(1−SDF))`,
so `uPeak ∝ √internalHeat`; a ±12% internalHeat swing is ±~6% uPeak. The canonical Rhines counts sit
*right on* `Math.round` boundaries — Jovian `n = 15.2·√(1·1/1.5507) = 12.21` (→12), Neptunian
`n = 15.2·√(0.346·0.616/7.70) = 2.53` (→3, on the 2↔3 edge). A −6% uPeak lifts Jovian n to 12.61 →
**13**; a +2.5% uPeak drops Neptunian n to 2.47 → **2**. So the class-width range alone crosses a
band-count boundary (confirms BUILD-PLAN [RESOLVED-BY-REVISE-2: minor-4] — wide ranges are NOT needed).

### 1.2 `shellDepthFrac` — the jet-bearing shell fraction (LAW2 eq-jet SIGN + LAW3 concentration)

**What it is.** The fraction of planetary radius occupied by the **dynamically active, differentially
rotating outer convective shell** that carries the zonal jets, before magnetic (Ohmic) braking or a
stably stratified interior halts them. LAW2 (`equatorialJetSign = tanh(6·(SDF − 0.40))`) reads it as
the eq-jet-direction decider: a **deep** shell (H/He-dominated gas giants) gives a **prograde**
equatorial jet; a **thin** shell (ice giants — a shallow weather layer over a stably stratified,
compositionally graded ionic-water mantle) gives a **retrograde** one. This is the current
best-supported mechanism: 3-D deep-convection models produce prograde equatorial superrotation
(Heimpel, Aurnou & Wicht; Busse-column dynamics) [`model-predicted`], and a 2025 quasi-geostrophic
study (arXiv 2503.17828, *Influence of penetration depth on jets on giant planets*) shows **deeply
penetrating jets → prograde equatorial jet (Jupiter/Saturn), shallow jets → retrograde (Uranus/Neptune)**
— jet penetration depth regulated by Ohmic dissipation [`model-predicted`]. The ice-giant thin-shell
picture is independently supported by their non-dipolar magnetic fields, which thin-shell convective
dynamos reproduce (Stanley & Bloxham 2004/2006 †unverified; compositional-convection interiors, arXiv
2111.05371) [`model-predicted`]. Bundle anchors: Jovian 0.80, Saturnian 0.90 (deep, prograde);
Neptunian 0.15, Sub-Neptune 0.35 (thin, retrograde); HJ 0.85.

**FORM.** `shellDepthFrac = SDF0[regime] · (1 − δ·(Z/Z0 − 1))`, clamp to the regime band (§2). `Z` is
the bulk **metal/ice enrichment** (anti-correlates with H/He dominance): metallicity if the condition
carries it, else a proxy derived from `condition.density` and `composition` (iron + volatile fraction)
— a declared-frozen-with-named-deriver input (AC-0 (1): `condition.metallicity` is `undefined` for lab
presets, so the density/composition proxy is the operative path, with metallicity named as its future
primary). δ > 0: a metal/ice-richer draw of the same regime → shallower shell (compositional
stratification confines convection to a thinner outer layer — the ice-giant mechanism). The base
`SDF0` carries the H/He-vs-ice regime identity; the within-regime response is a *narrow* perturbation
so gas giants stay prograde and ice giants stay retrograde — see §5 for the one deliberate exception.

### 1.3 `dissipation` — the wind-paradox denominator (LAW3 damping)

**What it is.** The net damping on the zonal winds — the LAW3 denominator. Physically dominated by
**Ohmic dissipation** where the winds overlap the electrically conducting region (semi-conducting →
metallic hydrogen), plus turbulent/frictional drag. This is the "isn't even the same concept as any
existing driver" scalar (L0 audit; ATMOSPHERE-PLAN §(e)) — it has no D-slot, so it is *fully* derived
here. Neptune's very low value (**0.15**) is the other half of the wind paradox: its jets sit in a
thin, low-conductivity molecular shell **far above** the conducting ionic-water mantle → almost no
Ohmic braking → fast winds on modest forcing. Gas-giant winds reach down toward the shallow metallic-H
transition → stronger Ohmic drag → higher dissipation (Jovian 1.00, Saturnian 0.85). Hot Jupiters,
with intense thermal ionization, dissipate the most (**1.20**). Grounding: Ohmic constraints on deep
zonal winds (Liu, Goldreich & Stevenson 2008, *Icarus* "Deep jets on gas-giant planets" — deep winds
must be Ohmic-budget-limited) [`model-predicted`]; Ohmic dissipation in irradiated giants (Batygin &
Stevenson 2010; Perna et al. 2010 †unverified) [`model-predicted`].

**FORM.** `dissipation = DIS0[regime] · (SDF/SDF0)^ε · (T_eq/T0)^ζ`, clamp ±15%. It reads the **derived**
`shellDepthFrac` (deeper winds → more overlap with the conductor → more Ohmic drag: ε > 0) and `T_eq`
(hotter → more thermal ionization/conductivity: ζ > 0). The coupling to `shellDepthFrac` is exactly
the "coupling to the wind-paradox denominator" the plan names, and it holds across the anchors:
Neptunian's thin shell (0.15) pairs with the lowest dissipation (0.15); HJ's warm deep shell (0.85 @
1400 K) pairs with the highest (1.20).

---

## 2. Per-regime RANGES (regime-plausible envelope a seed may sample)

Each regime's re-roll must stay *that regime* (a Jovian sweep must not morph into an ice giant —
AC-LAT "regime-plausible", risk R3). Ranges are the clamp bands the forms are held to.

| Regime | shellDepthFrac | internalHeat | dissipation | eq-jet sign `tanh(6·(SDF−0.40))` | Notes |
|---|---|---|---|---|---|
| **Jovian** | 0.74 – 0.86 | 1.47 – 1.87 | 0.85 – 1.15 | +0.97 … +0.99 → **prograde (fixed)** | canonical 0.80 / 1.67 / 1.00 |
| **Saturnian** | 0.85 – 0.95 | 1.57 – 1.99 | 0.72 – 0.98 | +0.99 → **prograde (fixed)** | canonical 0.90 / 1.78 / 0.85 |
| **Neptunian** | 0.09 – 0.21 | 2.29 – 2.91 | 0.13 – 0.17 | −0.95 … −0.81 → **retrograde (fixed)** | canonical 0.15 / 2.60 / 0.15 |
| **Sub-Neptune** | **0.28 – 0.44** | 1.01 – 1.29 | 0.47 – 0.63 | −0.62 … +0.24 → **SIGN FLIPS** | canonical 0.35 / 1.15 / 0.55; straddles `D_THR` |
| **Hot-Jupiter** | 0.80 – 0.90 | 1.76 – 2.24 | 1.02 – 1.38 | +0.98 → prograde | storms suppressed (regime gate); ranges for band variety only |

**Resulting `uPeak` spread** (the band-count / storm-latitude variety carrier): Jovian `uPeak` ranges
~1.29–1.87 (canonical 1.55) → Rhines n ~11.1–13.4 → band count varies across {11,12,13}. Neptunian
`uPeak` ~7.0–8.6 (canonical 7.70) → n straddles the 2↔3 boundary. This clears the AC-DERIVER (D1/D2)
uPeak-variety floors and the AC-BANDS count-varies floor (measure-first pin at Slice D).

---

## 3. ANCHOR reproduction arithmetic (canonical condition → `DRIVER_BUNDLES`, per regime)

Because every form is anchored (all response factors = **1** at canonical inputs), each regime
reproduces its bundle triple **exactly** (tolerance ≤ 1e-6 for the D3 test). Canonical inputs read
straight from `DRIVER_PRESETS` (mass `M0 = massEarth`; `age0 = 4.5`; `T0 = T_eq`; `Z0` = canonical
enrichment proxy):

| Regime (preset) | Canonical inputs (M0, age0, T0) | internalHeat factors | shellDepthFrac factor | dissipation factors | Output → bundle |
|---|---|---|---|---|---|
| Jovian (`Gas giant (Jovian)`) | 317.8, 4.5, 125 | (M/M0)=1·(age0/age)=1·(T0/T_eq)=1 | (1−δ·0)=1 | (SDF/SDF0)=1·(T/T0)=1 | **0.80 / 1.67 / 1.00** ✓ |
| Saturnian (`Gas giant (Saturnian)`) | 95.2, 4.5, 95 | 1·1·1 | 1 | 1·1 | **0.90 / 1.78 / 0.85** ✓ |
| Neptunian (`Ice giant (Neptunian)`) | 17.1, 4.5, 55 | 1·1·1 | 1 | 1·1 | **0.15 / 2.60 / 0.15** ✓ |
| Sub-Neptune (`Sub-Neptune (hazy)`) | 8.2, 4.5, 550 | 1·1·1 | 1 | 1·1 | **0.35 / 1.15 / 0.55** ✓ |
| Hot-Jupiter (`Hot Jupiter (locked giant)`) | 400, 4.5, 1400 | 1·1·1 | 1 | 1·1 | **0.85 / 2.00 / 1.20** ✓ |

**Worked off-canonical example (shows the range is real, not epsilon).** A Jovian seed drawing
M = 1.2·M0, age = 6 Gyr (T_eq at canonical), with α=0.4, β=0.35:
`internalHeat = 1.67 · 1.2^0.4 · (4.5/6)^0.35 = 1.67 · 1.076 · 0.904 = 1.62` — inside [1.47, 1.87],
distinct from the frozen 1.67 (clears AC-DERIVER **(D5)** "derived ≠ frozen"). The exact α/β land at
Slice D; the point is the mechanism moves the value materially, not by epsilon.

---

## 4. POLAR_PRESENCE_PRIOR — pinned constants (Slice P) + justification

Slice P replaces `resolvePole`'s always-on `strength: stormsOn ? 1 : 0` with a per-seed coin flip:
`present = stormsOn && rng() < POLAR_PRESENCE_PRIOR[regime]` (draw appended to the existing
`stormE:polar` stream). The prior is a **pinned, frozen, per-regime named constant** (de-floated per
BUILD-PLAN [RESOLVED-BY-REVISE-2: 2]; the AC-POLAR floor asserts these exact numbers). Any
condition-modulation of the prior is a **declared-but-frozen** future-deriver slot (AC-0 (1)) — inert
this increment, so the asserted constant equals the effective prior.

| Regime | `POLAR_PRESENCE_PRIOR` | Justification (observation record) | Confidence |
|---|---|---|---|
| **Jovian** | **0.98** | Juno: a central polar cyclone ringed by **8** (N octagon) / **5** (S pentagon) circumpolar cyclones — "remarkably stable… five years later, little has changed" (Adriani et al. 2018, *Nature* 25491; Tabataba-Vakili et al. 2020 long-term JunoCam tracking). Pole effectively *always* structured. | `observed` |
| **Saturnian** | **0.97** | North-polar **hexagon** + central polar vortex, persistent for **decades** — Voyager (1980–81) → Cassini (through 2017); mirrored in the stratosphere (Fletcher et al. 2018). No dark interval on record. | `observed` |
| **Neptunian** | **0.55** | Great Dark Spots are **transient**: Voyager GDS (1989) gone by 1994; new spots form every ~4–6 yr, lifetimes ~2–6 yr (NDS-2018, Simon et al. 2019, *GRL* 10.1029/2019GL081961). Extended dark-spot-free intervals → present roughly half-to-two-thirds of the time. | `observed`/`model-predicted` |
| **Sub-Neptune** | **0.45** | No polar imaging exists; heavy haze mute (`hazeMute` 0.7) + ice-giant analogy + presumed leaner/seasonal dynamics → set below Neptune. | `speculative` |
| **Hot-Jupiter** | **—** | Storms suppressed by the regime gate (`stormsOn = false`); pole strength already 0, prior never consulted. | n/a |

Constraints honored: Jovian/Saturnian **≥ 0.95** ✓; Neptunian/Sub-Neptune **≤ 0.8** ✓.

**N-around-prior weights (proposed pin for Slice P, declared-with-deriver).** `sides`/`ring` =
`clamp(POLAR_N_MIN=5, POLAR_N_MIN+POLAR_N_SPAN=8, POLAR_CANONICAL_N[regime] + δ)` with δ drawn from
`{−1: 0.25, 0: 0.50, +1: 0.25}` (modal δ=0 → **modal N = the canonical prior**). Saturn stays
hexagon-**likely** (modal 6, spans 5–7); Jupiter modal 8 (spans 7–8 after clamp). Satisfies AC-POLAR
floor (2) "N non-degenerate with modal == `POLAR_CANONICAL_N`".

---

## 5. EXPECTATIONS for Max (the three MAX-SURFACE items)

Before Slice D wires these constants, three things are worth your eyes — one is a genuine taste call.

1. **Jovian & Saturnian poles will effectively *always* appear — physically honest, but under-delivers
   AC-POLAR's "don't always appear" for those two regimes by design.** With priors 0.98 / 0.97, a
   12-seed sweep is all-present ~78% / ~69% of the time. This is *correct* — Jupiter's Juno cyclone
   crystal and Saturn's hexagon are the most persistent polar structures in the solar system, so making
   them vanish on a re-roll would be *less* physical, not more. The presence-flip variety deliberately
   lands on the **ice-giant / sub-Neptune** regimes (priors 0.55 / 0.45), whose real dark vortices come
   and go. If you'd rather see Jovian/Saturnian poles occasionally absent for gameplay variety, that's a
   one-number change (lower those priors) — but it trades away physical honesty. Recommendation: keep
   them high.

2. **The equatorial-jet DIRECTION flip is plausibly Sub-Neptune-*only*.** Only Sub-Neptune's
   `shellDepthFrac` range (0.28–0.44) straddles the `D_THR = 0.40` sign threshold, so only Sub-Neptune
   re-rolls flip their equatorial jet prograde↔retrograde. Jovian/Saturnian stay firmly prograde,
   Neptunian firmly retrograde — their canonical shell depths (0.80 / 0.90 / 0.15) are too far from
   0.40 for any regime-plausible draw to cross it. This matches the intent DOES card ("eq-jet direction
   flip is plausibly Sub-Neptune-only") and BUILD-PLAN risk R2. Band COUNT and per-band drift still vary
   for *all* regimes (via `uPeak`/`phaseJet`); it's only the single equatorial jet's sign that's
   regime-locked outside Sub-Neptune.

3. **Range width is the one taste call — and ±10–12% suffices.** How different should two same-regime
   re-rolls be? Too wide and a Jovian re-roll reads as a different planet class (breaks
   "regime-plausible"); too narrow and re-rolls feel samey (fails your "every re-roll seriously
   different" UAT). The ranges above are set at **±12% internalHeat / ±15% dissipation / narrow
   shellDepthFrac** — deliberately *not* wide, because the canonical Rhines band counts sit right on
   integer boundaries, so even a ±10% internal-heat swing already changes band count *and* moves storm
   latitudes to different belts. This is the knob to dial if you want re-rolls more or less dramatic;
   everything else is physics. Slice D measures the actual variety these ranges produce on the live
   sweep and reports back before pinning the test floors (measure-first discipline).

---

## 6. Sources

**Two most load-bearing:**
- **Pearl & Conrath 1991** (Voyager/IRIS energy-balance ratios: Jupiter 1.67, Saturn 1.78, Neptune
  2.61) — *the* `internalHeat` anchor; the bundle triple **is** these ratios. (Via Li et al. 2018
  synthesis + the Uranus energy-balance literature: <https://arxiv.org/pdf/2502.20722>,
  <https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2025GL115660>.)
- **arXiv 2503.17828** — *Influence of penetration depth on jets on giant planets: equatorial jet
  direction, jet numbers, and jet energy fraction* (2025): deep-penetrating jets → prograde eq jet,
  shallow → retrograde. The `shellDepthFrac` → eq-jet-SIGN grounding.
  <https://iopscience.iop.org/article/10.3847/PSJ/ae6da7> · <https://arxiv.org/html/2503.17828>

**Supporting:**
- Adriani et al. 2018, *Nature* — Jupiter polar cyclone clusters (8N/5S), Juno.
  <https://www.nature.com/articles/nature25491>
- Tabataba-Vakili et al. 2020, *Icarus* — long-term tracking of Jupiter's circumpolar cyclones.
  <https://www.sciencedirect.com/science/article/abs/pii/S0019103519302751>
- Fletcher et al. 2018 — Saturn's north-polar hexagon/vortex (stratosphere).
  <https://arxiv.org/pdf/1809.00572> · <https://pmc.ncbi.nlm.nih.gov/articles/PMC6120878/>
- Simon et al. 2019, *GRL* — formation of a new Great Dark Spot on Neptune (2018); dark-spot
  transience. <https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2019GL081961> · Great Dark
  Spot overview <https://en.wikipedia.org/wiki/Great_Dark_Spot>
- Wang et al. 2025, *GRL* — internal heat & energy imbalance of Uranus (non-zero, ~12.5% of absorbed).
  <https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2025GL115660>
- Liu, Goldreich & Stevenson 2008, *Icarus* — Ohmic constraint on deep zonal winds (dissipation
  grounding). <https://www.sciencedirect.com/science/article/abs/pii/S0019103507005489>
- Heimpel, Aurnou & Wicht — deep-convection prograde equatorial jets (rotating spherical-shell
  convection). <https://www.sciencedirect.com/science/article/abs/pii/S0019103506003733>
- Compositional convection in the deep interior of Uranus (ice-giant stratification / thin active
  shell). <https://arxiv.org/pdf/2111.05371>

**†unverified (recalled from training, not re-fetched):** Stanley & Bloxham 2004/2006 (ice-giant
thin-shell dynamos); Batygin & Stevenson 2010 / Perna et al. 2010 (Ohmic dissipation in hot Jupiters);
Burrows/Marley giant-cooling tracks (age/mass luminosity slopes). Signs used are robust; exact slopes
are not load-bearing (magnitudes calibrated at Slice D).
