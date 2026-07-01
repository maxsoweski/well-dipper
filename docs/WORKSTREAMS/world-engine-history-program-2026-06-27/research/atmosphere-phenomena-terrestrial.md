# Terrestrial-Class Atmospheric Phenomena — Generative Field Catalog

> Provenance: research pass for World-Engine Track-A #3a scoping, 2026-06-30. Sourced, adversarially framed.
> Sibling passes: [giants](atmosphere-phenomena-giants.md), [exoplanet](atmosphere-phenomena-exoplanet.md).

**Framing.** Everything is a closed-form/seeded field over the sphere — function of latitude φ (or, for tidally-locked worlds, angular distance from substellar point θ_s=arccos(r̂·ŝ)) + per-body scalars. "RECYCLABLE?" asks whether the mechanism is another instance of the **giant-planet band/jet substrate** (u(lat) zonal wind, banded T(lat), banded/layered haze, wave/vortex decorations) or **genuinely terrestrial** — requiring the one new capability this branch adds: a **one-way READ of the surface-relief field h(φ,λ)**. **OBS**=observed, **THY**=theorized, **CON**=contested.

---

## 1. Earth-like worlds
Organizing object: the zonally-averaged **precipitation-minus-evaporation profile P(φ)** — a seeded u(lat)-class scalar with a fixed band skeleton:

| Band | Center φ | Sign | Driver |
|---|---|---|---|
| ITCZ / equatorial wet | ~0° (migrates ±5–15° seasonally) | P≫E | Hadley ascending |
| Subtropical dry belts | ~20–30° | E≫P | Hadley descending (subtropical highs) |
| Mid-lat storm-track wet | ~45–60° | P>E | baroclinic-eddy moisture convergence |
| Polar dry | >70° | ~0 | subsidence, low saturation vapor |

Seed form: `P(φ) ≈ A_eq·G(φ−φ_ITCZ,σ_eq) − A_st·G(φ−φ_st,σ_st)[both hemi] + A_ml·G(φ−φ_ml,σ_ml)[both hemi]` (G=Gaussian).

| Phenomenon | Mechanism as field | Driver | Recyclable? | Sources |
|---|---|---|---|---|
| **Hadley/Ferrel/polar cells → temp & precip banding** (OBS+THY) | Axisymmetric overturning; angular-momentum-conserving Hadley limit → closed-form cell width + u(lat) upper jet; sets ITCZ & subtropical dry latitude | Cell width∝Ω⁻¹ (faster→narrower, more bands); dry-belt lat scales w/ thermal Rossby #∝(gH·ΔT)/(Ω²a²); obliquity shifts ITCZ seasonally | **RECYCLE** — terrestrial u(lat)+banded-T substrate; only diff = small fixed cell count (3/hemi) vs many jets | Held&Hou1980(JAS37:515); Schneider2006(ARANEPS34:655) |
| **Subtropical dry belts / ITCZ** (OBS) | Descending vs ascending Hadley = ± lobes of P(φ); ITCZ=energy-flux equator | ITCZ→warmer/summer hemi; amp∝flux, hemispheric asymmetry | **RECYCLE** (P(lat) skeleton) | Schneider2006; Schneider,Bischoff&Haug2014(Nature513:45) |
| **Storm tracks / baroclinic eddies** (OBS+THY) | Baroclinic instability of mid-lat T gradient → eddy heat/moisture transport → mid-lat wet band + Ferrel jet; seed banded eddy-activity envelope ~45–60° | Needs thin stratified atm + strong ΔT_eq-pole; activity∝ΔT & f; weak on slow rotators | **PARTIAL** — mean jet=u(lat) recycle; eddy band=lat-statistic recycle; generating instability terrestrial | Charney1947; Eady1949; Chang,Lee&Swanson2002 |
| **Orographic precip & rain shadow** (OBS) | **THE new machinery.** Upslope: `S≈C_w·(U·∇h)` — uplift=prevailing wind U · terrain gradient ∇h; precip=S through advection+fallout kernel. Rain shadow=leeward descent (U·∇h<0→drying)+upstream depletion | ∝|U|, saturation moisture C_w(∝T,humidity), relief slope; needs oceans/volatiles + prevailing wind | **NEW terrestrial-only** — only item requiring one-way READ of relief + wind vector | Roe2005(ARANEPS33:645); Smith&Barstad2004(JAS61:1377) |
| **Driver-scaling of whole circulation** (THY) | GCM survey: band count, jet latitude, ITCZ, P(φ) across rotation/obliquity/flux/mass/gravity/radius; supplies driver→band-parameter map | Explicit maps for Ω, obliquity, T_eq, surface p, g; slow Ω→fewer wider cells weaker jets | **RECYCLE** (parameterizes band substrate) | Kaspi&Showman2015(ApJ804:60; arXiv:1407.6349) |

---

## 2. Venus (thick, slow, near-zero obliquity CO₂)

| Phenomenon | Mechanism as field | Driver | Recyclable? | Sources |
|---|---|---|---|---|
| **Super-rotation** (OBS; mech CON) | Cloud-top ~60× solid body → strong **equatorial u(lat) jet**; maintained by mean circ + thermal tides + wave momentum pumping (Gierasch–Rossow–Williams). Seed peaked-at-eq u(φ) | Onset/strength∝slow Ω, thick atm (long radiative time), deep static stability | **RECYCLE** — extreme equatorial zonal jet, same u(lat) machinery | Gierasch1975(JAS32:1038); Read&Lebonnois2018(ARANEPS46:175) |
| **Y-feature / bow-shaped UV marking** (OBS; interp CON) | Planetary-scale ~4-day equatorial wave (Kelvin+Rossby, wavenumber-1) modulating banded UV-absorber/cloud field; wavenumber-1–2 phase pattern riding zonal flow | Tied to super-rotation speed & equatorial wave-guide; ~4-day period | **RECYCLE (wave decoration)** — wavenumber-1 wave on band substrate; same class as giant planetary waves / hexagon | Del Genio&Rossow1990(JAS47:293); Peralta+ (Kelvin/Rossby, id uncertain) |
| **Polar dipole / polar vortex** (OBS; dyn CON) | Warm subsidence core inside cold collar each pole; core morphs dipolar(wn-2)/oval/monopolar, wanders chaotically. Seed hi-lat vortex cap w/ low-wavenumber time-varying core | Poleward Hadley-like terminus, poleward of ~75°; ∝super-rotation+subsidence | **PARTIAL** — polar-cap vortex shared w/ giant polar vortices; NOT relief-coupled; chaotic core = poorly-constrained decoration | Piccioni+2007(Nature450:637); Garate-Lopez+2013(NatGeo6:254) |

*(Venus: negligible relief-weather coupling — thick atm + slow rotation decouples cloud dynamics from topography. Itself a driver result: thick+slow suppresses the relief READ.)*

---

## 3. Titan (thick N₂/CH₄, slow, methane condensable, Saturn obliquity)

| Phenomenon | Mechanism as field | Driver | Recyclable? | Sources |
|---|---|---|---|---|
| **Orange photochemical haze** (OBS) | UV/electron N₂–CH₄ chem → tholin; **layered + lat-banded opacity** (main + detached layer); function of altitude & lat, driven by T/insolation | Production∝UV, CH₄; layering from circ+settling; detached-layer altitude seasonal | **RECYCLE** — banded/layered haze, same as giant aerosol layering | Hörst2017(JGR122:432) |
| **Polar hood** (OBS) | Winter-pole haze/trace-gas enhancement from subsidence in polar vortex → hi-lat opacity+composition cap swapping hemispheres seasonally | Follows seasonal (obliquity) overturning reversal; strongest winter pole | **RECYCLE** — hi-lat banded-haze cap tied to polar vortex | Hörst2017; Teanby+ (winter enrichment, id uncertain) |
| **Methane cycle → polar lakes & ITCZ rain** (OBS surface asym; THY cause CON) | Methane hydrologic cycle: **P−E band field** (equatorial/polar rain, seasonal methane-ITCZ) drives condensation; **lakes fill relief minima** at poles. Lake placement=READ(low basins) gated by P−E. Strong N–S asymmetry (more N lakes) | Obliquity+Saturn eccentricity→asym seasons→net volatile transport to one pole over 10⁴–10⁵yr; T≈90K puts CH₄ near triple point | **MIXED** — atmospheric forcing (methane P(lat), ITCZ)=RECYCLE; lake distribution=**NEW** (volatile-pooling READ of relief minima + P−E) | Mitchell&Lora2016(ARANEPS44:353); Aharonson+2009(NatGeo2:851); Lora+ Titan GCM |
| **Super-rotation** (OBS) | Weaker Venus analogue: prograde equatorial/mid-level zonal jet | Slow rotation+thick atm; seasonally modulated by obliquity | **RECYCLE** — same equatorial-jet u(lat) | Read&Lebonnois2018 |

---

## 4. Tidally-locked "eyeball" worlds — all **THY** (TRAPPIST-1e etc. targets)

**Coordinate reframe (key point).** Replace latitude φ with angular distance from substellar point θ_s=arccos(r̂·ŝ). Band skeleton recenters on substellar point instead of rotation axis. Regime depends on rotation via Rossby deformation radius & Rhines length vs planetary radius.

| Phenomenon | Mechanism as field | Driver | Recyclable? | Sources |
|---|---|---|---|---|
| **Substellar convective cloud + cold nightside** (THY) | Peak convection/cloud/precip at θ_s=0, declining w/ θ_s. `Cloud,P(θ_s)≈f(cosθ_s)` peaked substellar; cold nightside trap at θ_s→180° w/ possible atmospheric collapse (volatile freeze-out) below p threshold; thick substellar cloud↑albedo (stabilizing) | Stellar flux (substellar T), atm mass (collapse threshold ~tens mb), day-night heat transport | **RECYCLE w/ reframe** — substellar-centric analogue of latitude banding; pole moved from rotation axis to substellar point | Joshi,Haberle&Reynolds1997(Icarus129:450); Pierrehumbert2011(ApJL726:L8); Yang,Cowan&Abbot2013(ApJL771:L45) |
| **Day→night overturning & super-rotating jet** (THY) | Thermally-direct day→night cell near surface + return aloft; super-rotating eq jet as rotation↑. Slow: single day-night cell (θ_s only). Rapid: latitude bands reappear atop substellar pattern | Rotation sets regime: slow (day-night, L_R & Rhines>radius) / Rhines (mid-lat jets) / rapid (banded) | **RECYCLE** — zonal-jet+overturning substrate; regime=where on rotation axis you sample same machinery | Merlis&Schneider2010(JAMES2:13); Haqq-Misra+2018(ApJ852:67); Pierrehumbert&Hammond2019(ARFM51:275) |
| **Terminator / climate-state palette** (THY) | Family of end-states (eyeball ocean pool, snowball, waterworld) set by flux+volatile inventory; multi-GCM spread | Stellar flux, water inventory, composition, rotation | **RECYCLE** (state selection over θ_s field); relief coupling only if continents → orographic READ in substellar-centered wind | Pierrehumbert2011; THAI: Turbet+2022, Sergeev+2022, Fauchez+2022 (PSJ3:211-213) |

---

## Shared substrate & the relief coupling

**Fields that generate the whole catalog:**
1. **u(φ)/u(θ_s)** — axisymmetric zonal wind. Generates Hadley/Ferrel/polar cells, Venus & Titan super-rotation, eyeball day-night flow. **SAME as giant-planet jet substrate.** Terrestrial diffs: (a) small fixed cell/jet count, (b) option to recenter pole on substellar point.
2. **T(φ)/T(θ_s)** — thermal banding; sets condensation thresholds + haze photochem. **SAME.**
3. **P(φ)/P(θ_s)** — precip-minus-evaporation profile (wet equator/substellar, dry subtropics, wet mid-lat, dry poles/nightside). **New scalar field but generated same way** — closed-form function of latitude/substellar-angle. Reusable machinery, new output channel.
4. **Haze/cloud opacity** — banded+layered (Titan haze/hood, Venus UV absorber, eyeball substellar cloud). **SAME as giant aerosol layering.**
5. **Wave/vortex decorations** — Venus Y-feature (wn-1 Kelvin+Rossby), polar dipole, polar-cap vortices. **SAME low-wavenumber-wave-riding-band substrate** as giant planetary waves & polar vortices.

**Genuinely new (terrestrial-only): the one-way READ of surface-relief h(φ,λ).** Two read-only couplings:
- **(a) Orographic precip / rain shadow:** `P_oro≈C_w·(U·∇h)` as modulation on base banded P(φ); needs terrain **gradient ∇h** (slope+aspect) + **prevailing low-level wind U**. Rain shadow free (leeward U·∇h<0).
- **(b) Volatile pooling** (oceans, Titan lakes): standing liquid fills **relief minima** where P−E net-positive; needs **absolute elevation h** (sea/lake level) + P−E band.

**Dependency the engine must respect:**
> Before terrestrial precip can be derived, surface-relief writers must publish (1) absolute elevation h(φ,λ) — for pooling/sea level; (2) gradient ∇h (slope+aspect) — for orographic modulation. Atmosphere publishes a prevailing low-level wind-direction field (derivable from u(φ) band structure + Hadley overturning: trade easterlies equatorward of subtropical highs, mid-lat westerlies). Then: **bands first → relief modulates.**

Relief coupling = one-way read-only post-process per frame (no precip→relief feedback within a frame; erosion is long-timescale, out of scope). Everything else in the terrestrial branch is the giant-planet band/jet/haze/wave substrate — as-is (Venus/Titan super-rotation, hazes, vortices, waves), specialized to fixed cell count (Earth Hadley/Ferrel/polar), or recentered onto the substellar point (eyeball).

**Contested/theorized flags:** Venus super-rotation mechanism; Y-feature wave interpretation; Venus polar-dipole dynamics (chaotic); Titan lake-asymmetry cause (orbital-forcing hypothesis); **all eyeball phenomena model-only** — no confirmed terrestrial eyeball observed.
