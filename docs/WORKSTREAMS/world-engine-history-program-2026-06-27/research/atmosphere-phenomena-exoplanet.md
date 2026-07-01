# Exoplanet Giant/Sub-Neptune Atmospheres — Generative-Field Catalog

> Provenance: research pass for World-Engine Track-A #3a scoping, 2026-06-30. Sourced, adversarially framed.
> Sibling passes: [giants](atmosphere-phenomena-giants.md), [terrestrial](atmosphere-phenomena-terrestrial.md).

**Framing.** Every row is a closed-form/seeded field over a sphere — functions of latitude θ, longitude φ (measured from the substellar point, FIXED for a tidally-locked body), and per-body scalars (chiefly T_eq). **[OBS]** observed, **[MOD]** modeled, **[CONTESTED]** literature disagrees.

**The one structural fact:** a solar-system giant is longitudinally symmetric (fast rotation smears insolation → fields are latitude-only). A tidally-locked exoplanet has a permanent substellar point → fields gain a longitude axis anchored to φ_sub. **That longitude axis is the ONLY genuinely new degree of freedom.** Almost every "exotic" phenomenon is either an existing latitude-field re-parameterized, or the same machinery given longitude dependence. Two things are truly new: the **magnetic-drag westward flip** and the **H₂ dissociation–recombination heat pipe**.

---

## Master table

HJ=hot Jupiter (T_eq≈1000–1800K), UHJ=ultra-hot (≳2200K), TG=temperate giant (≲1000K), SN=sub-Neptune, IG=ice-giant. τ_rad=radiative timescale, L_R=equatorial Rossby deformation radius.

| # | Phenomenon | Class & difference | Mechanism as spherical field | Driver dependence | Recyclable? | Sources |
|---|---|---|---|---|---|---|
| 1 | **Day–night temp contrast** [OBS] | All irradiated; contrast↑ with T_eq to ~2300K then↓ | ΔT on T(θ,φ): insolation-forced, wave-damped. ΔT/T set by τ_rad/τ_wave | ↑T_eq→larger ΔT until UHJ reversal (row6); ↑gravity→larger ΔT | Re-param (equator-pole ΔT → day-night) | Perez-Becker&Showman2013(ApJ776,134; ~1306.4673 uncertain); Komacek&Showman2016; Komacek+2017(arXiv:1610.03893); Cowan&Agol2011 |
| 2 | **Eastward hotspot offset** [OBS] | HJ canonical; weak/absent UHJ & TG | T(θ,φ) bulge displaced east of φ_sub by δ(θ), equator-peaked. δ=insolation advected by eq jet | δ∝u_jet·τ_rad/R; peaks intermediate T_eq; ↓ hot/drag | Re-param+ (jet recyclable; fixed-longitude forcing new) | Knutson+2007(HD189733b 16°); Showman&Polvani2011(arXiv:1103.3101); Hammond&Pierrehumbert2018 |
| 3 | **Equatorial superrotation jet** [OBS/MOD] | HJ single broad eastward eq jet; faster→+hi-lat jets; IG many | u(θ)=u_eq·exp(−θ²/2σ²), σ≈L_R. Standing Kelvin–Rossby (Matsuno–Gill)→equatorward momentum flux | u_eq↑ irradiation; σ from L_R(rotation); slow→single wide, fast→more | Re-param (giant zonal jet, N→1) | Showman&Polvani2011; Showman&Guillot2002; Snellen+2010(arXiv:1006.4364); Louden&Wheatley2015 |
| 4 | **Westward offset — NON-magnetic** [OBS][CONTESTED] | HJ (CoRoT-2b); async rotators | Apparent offset from thick nightside/west-limb cloud OR westward wind from async rotation. τ_cloud asym in φ | Cloud route: T_eq low enough to condense west limb | Re-param (cloud field in new longitude axis) | Dang+2018(CoRoT-2b −23°; arXiv:1801.06548); Parmentier+2021 |
| 5 | **Westward flip / hotspot REVERSAL — magnetic drag** [MOD][CONTESTED] | **UHJ** (T_eq≳1500–2000K) | Thermal ionization→partially-ionized flow + planetary B → Lorentz reverses/suppresses eq jet → bulge west; time-variable | Onset T_eq≳1500K (alkali ionization); ↑ with T_eq & B | **GENUINELY NEW** — no SS-giant analog | Rogers&Komacek2014; Rogers2017(HAT-P-7b); Hindle+2019(arXiv:1902.09683)&2021; Beltz+2022 |
| 6 | **H₂ dissociation–recombination heat pipe** [MOD] | **UHJ** (dayside T≳2500K) | Latent-heat field: H₂ splits dayside (absorbs), advects night, recombines (releases ~100× water latent). Flattens ΔT | Dayside T≳2500K; ΔT peaks ~2300K then declines | **GENUINELY NEW** — chemistry-as-latent-heat | Bell&Cowan2018(ApJL857,L20; ~1802.07725 uncertain); Komacek&Tan2018; Tan&Komacek2019(arXiv:1910.01622) |
| 7 | **Thermal inversion / stratosphere** [OBS] | HJ (TiO/VO ≳1600K)→UHJ (metals/H⁻ ≳2200K); absent cool | Vertical T(p) inversion from high-altitude absorber. As surface field: dayside inverted/emission mask where T_eq>threshold | TiO/VO ≳1600–2000K; Fe/H⁻ ≳2200K; ↑metallicity | Re-param (dayside patch uses new longitude) | Fortney+2008; Evans+2017(WASP-121b); Lothringer+2018(arXiv:1805.00038) |
| 8 | **Nightside cloud deck (~1100K universal)** [OBS] | HJ (T_eq≲2100K); silicate | τ_cloud high near antistellar; caps nightside brightness T ~1100K (near-constant) | Nightside T<silicate condensation whenever T_eq≲2100K | Re-param (condensation deck at hotter condensate, on nightside) | Keating+2019(arXiv:1809.00002); Gao&Powell2021; Parmentier+2016 |
| 9 | **Morning–evening terminator asymmetry** [OBS] | HJ & warm SN; evening ~100K warmer, morning cloudier | τ_cloud & T asym between limbs — φ-gradient at day/night boundary from jet advection + condensation lag | ↑ with T_eq gradient; jet-speed dependent | Re-param (cloud field w/ resolved longitude gradient) | Powell+2019; Kempton+2017; Espinoza+2024(WASP-39b JWST); Murphy+2024(WASP-107b) |
| 10 | **Photochemical haze / muted bands** [OBS] | **TG & SN** peak (GJ1214b); UHJ dayside clears | τ_haze(T_eq): bell-shaped production vs T_eq. High τ_haze flattens features & mutes banding | Peaks intermediate T_eq (~400–850K obs; hydrocarbon ≲950–1000K); ↑UV, C/O, metallicity | Re-param (= Uranus/Neptune CH₄-photochem haze muting) | Kawashima&Ikoma2019; Gao+2020; Crossfield&Kreidberg2017; Yu+2021 |
| 11 | **Patchy clouds / temporal variability** [OBS][CONTESTED] | HJ/UHJ variable offset; directly-imaged/BD rotational variability | Seeded stochastic patches on τ_cloud(θ,φ,t); variable jet→variable coverage→drifting phase peak | ↑ near condensation edges; timescale ~tens of orbits | Re-param (SS-giant storms as seeded blobs, substellar-anchored) | Armstrong+2016(HAT-P-7b); Demory+2013(Kepler-7b); Komacek&Showman2020; Lally&Vanderburg2022 |
| 12 | **Substellar→antistellar cell (slow rotator)** [MOD] | TG / slow tidally-locked; supplants superrotation | Divergent day→night overturning (weak Coriolis); T(θ,φ) ~radially symmetric about φ_sub, minimal offset | Dominant when slow / L_R≳radius | New-ish (regime = day-night forcing with jet off) | Showman+2013; Hammond&Lewis2021(PNAS); Carone+2020 |
| 13 | **Zonal banding / jet count** [OBS-SS/MOD-exo] | Cooler/faster giants, IG, directly-imaged; multiple jets | u(θ) N jets, N≈R/L_R; banded T(θ) & τ_cloud(θ) follow | N↑ rotation & ↓L_R; ↓irradiation favors banded | Re-param (canonical SS-giant field, diff N) | Kaspi&Showman2015; Showman+2015 |
| 14 | **Chemical longitude field (horizontal quench)** [MOD] | HJ/UHJ; CO/CH₄ disequilibrium | Horizontal jet advection homogenizes abundances→longitudinally uniform (quenched) composition field | Quench τ_dyn vs τ_chem; C/O, metallicity; ↑T_eq favors CO | Re-param (vertical quench extended horizontal by jet) | Cooper&Showman2006; Agúndez+2014; Steinrueck+2019 |

---

## Deep-dive 1 — eastward-offset magnitude (rows 2–3)
Showman&Polvani2011: fixed day-night heating excites standing Kelvin (eastward eq) + Rossby (westward off-eq) waves (Matsuno–Gill); phase-tilted structure → equatorward eddy-momentum flux → broad eastward **equatorial jet** → advects thermal bulge east.
```
δ ≈ min( u_jet · τ_rad / R , δ_wave )
```
Long τ_rad + fast jet → large eastward offset. Short τ_rad (hot) → re-equilibrates in place → small offset (why biggest offsets at intermediate T_eq). δ_wave caps at Rossby deformation radius L_R (≈planet radius for synchronous HJs → broad single jet). Hammond&Pierrehumbert2018 formalize as mean-flow(jet) vs eddy(stationary-wave) competition (two knobs). **Engine: seed T(θ,φ) as substellar Gaussian, apply eastward phase shift δ(θ)=δ₀·sech(θ/θ_j), δ₀=f(u_jet,τ_rad(T_eq)).**

## Deep-dive 2 — westward flip & T_eq threshold (rows 4–5)
Two distinct routes, keep separate. **(A) Non-magnetic [CONTESTED]:** thick west/night-limb cloud makes apparent peak shift west, or async rotation → westward wind. Ordinary HJ temps. **(B) Magnetic drag [UHJ]:** above T_eq≈1500K alkali ionization → conducting flow + dynamo B → Lorentz brakes/reverses eq jet → hotspot west, time-variable. Strengthens with T_eq & B; dominates T_eq≳2000K. Thresholds: ≳1500K magnetic relevant; ≳2000K suppress/reverse. Combined w/ rows6–7: pushing T_eq up washes out the clean eastward offset → UHJs show small/variable/westward. Encode as δ(T_eq) rising then collapsing through zero. Route A recyclable; route B genuinely new.

## Deep-dive 3 — haze vs T_eq bell (row 10)
**Yes a bell, physically motivated, exact peak/width CONTESTED.** Kawashima&Ikoma2019: hydrocarbon haze needs both CH₄ (favored low T_eq, CH₄→CO ~1000K) and UV photochemistry (favored higher T_eq) → product peaks intermediate; efficient ≲950K. Gao+2020: aerosol composition switches ~950K — hydrocarbon haze below, silicate clouds above; "partial-cloud" runs mostly-cloudy ~500K → mostly-clear ~1500K, silicate returns hot; thermal-dissociation clears >~2200K → really **bimodal** (haze hump + silicate hump + clear window). **CONTESTED:** Dymont+2022 finds T_eq correlation weak once sample grows (gravity/metallicity/C-O muddy it) — treat bell as tendency not law. **Band muting:** high τ_haze raises effective photosphere above condensate/dynamical layers → washes out albedo/temp banding (the Uranus/Neptune muted look). Engine: τ_haze(T_eq) bell/bimodal master curve + band-contrast multiplier decaying as exp(−τ_haze). GJ1214b = τ_haze-maxed corner (Kreidberg+2014 flat spectrum; Kempton+2023 reflective metal-rich; Gao+2023).

---

## Driver-scaling quick-reference
| Driver | Effects |
|---|---|
| T_eq/irradiation | ΔT↑ to ~2300K then↓ (1,6); offset peaks intermediate collapses hot (2,5); inversion 1600/2200K (7); haze bell + silicate 1000–2000K + clear>1500K + dissoc>2200K (10); nightside clouds if ≲2100K (8) |
| Rotation/locking | L_R→jet width & N (3,13); slow→substellar-antistellar cell (12); async→westward wind (4); synchronous locks φ_sub |
| Gravity | ↑g→larger ΔT, deeper clouds, smaller scale height (1,8,10) |
| Metallicity | ↑opacity/haze/cloud/μ→muted (7,8,10); extreme SN |
| C/O | high→more CH₄/hydrocarbon→more haze (10); shifts inversion agents; CO/CH₄ (14) |

---

## Shared substrate — what it reduces to
Three master fields, SAME as a solar-system-giant model:
1. **u(θ) zonal wind** — SS: many jets N≈R/L_R. Exo HJ: SAME field N→1 broad eq jet, width L_R. **Fully recyclable.**
2. **T(θ,φ) thermal** — SS: banded latitude-only. Exo: gains **longitude axis** (substellar hotspot + eastward offset δ(θ;u,τ_rad) + warm nightside floor). **Longitude dependence is the single genuinely new DoF; built by advecting insolation forcing with recyclable u(θ).**
3. **τ(θ,φ) cloud+haze** — SS: banded albedo + condensation decks + photochem haze muting. Exo: SAME microphysics re-parameterized by T_eq/UV/C-O + longitude structure. **Fully recyclable microphysics; new only in longitude placement + T_eq parameterization.**

**Genuinely new (not re-parameterizations):** magnetic-drag westward flip (row5); H₂ dissociation heat pipe (row6); thermal-dissociation dayside clearing (rows6–7,10); (softer) the permanent day/night longitude asymmetry as a forcing geometry.

**Sub-Neptune ↔ ice-giant overlap (flagged):** a hazy sub-Neptune (GJ1214b) is generatively **a scaled ice giant with two knobs**: τ_haze up + band-contrast down → near-featureless. Same haze/methane field as Uranus/Neptune; differences = (a) thicker haze vs banding, (b) if close-in tidally-locked it also inherits HJ longitude structure. **Model ice-giant and hazy-sub-Neptune from ONE recipe (banded τ_cloud + high τ_haze + CH₄ muting) with `haze_opacity` + `band_contrast` sliders + optional `tidally_locked` flag. Highest-leverage reuse in the catalog.**

## Confidence
Observed/solid: rows 1,2,3,8,9,10,11 + deep-dive cores. Modeled/well-motivated: 5,6,12 + bell shape. Contested: magnetic vs non-magnetic westward origin (4/5); haze-vs-T_eq strength (Crossfield/Yu vs Dymont); HAT-P-7b variability reality. arXiv IDs needing final check: Perez-Becker&Showman2013 (~1306.4673), Bell&Cowan2018 (~1802.07725) — author/year/venue correct.
