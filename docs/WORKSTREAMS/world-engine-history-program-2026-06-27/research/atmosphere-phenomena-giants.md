# Giant-Planet Atmospheric Phenomena — Generative Catalog (Jupiter · Saturn · Uranus · Neptune)

> Provenance: research pass for World-Engine Track-A #3a scoping, 2026-06-30. Sourced, adversarially framed.
> Sibling passes: [exoplanet](atmosphere-phenomena-exoplanet.md), [terrestrial](atmosphere-phenomena-terrestrial.md).

**Framing for the engine.** Almost the entire catalog below reduces to *one shared field stack* evaluated with different per-body scalars. The master field is the zonal wind `u(lat)`; nearly every "phenomenon" is either (a) a direct feature of `u(lat)`, (b) a coherent structure seeded into the shear/PV field derived from `u`, or (c) a radiative overlay (clouds/haze) driven by the thermal field. Single most engineering-relevant fact: **latitude of features is largely deterministic given `u(lat)`; longitude and count are seeded (stochastic).** That is exactly the generative/seeded split we want.

---

## §0 — Per-body driver scalars (the inputs every field reads)

| Driver | Jupiter | Saturn | Uranus | Neptune | Why it matters |
|---|---|---|---|---|---|
| Rotation Ω (period) | 9.93 h | 10.66 h | 17.24 h | 16.11 h | Sets β=2Ωcosφ/a → Rhines scale → **jet count** |
| Equatorial radius a | 71,492 km | 60,268 km | 25,559 km | 24,764 km | Larger a → more jets (a/L_β) |
| Gravity g (m/s²) | 24.8 | 10.4 | 8.7 | 11.0 | Scale height, deformation radius |
| Internal heat flux (emitted/absorbed) | ~1.67× | ~1.78× | **~1.06× (≈0, anomalous)** | **~2.6× (largest)** | Convective vigor → eddy energy driving jets/storms |
| Obliquity ε | 3.1° | 26.7° | **97.8° (extreme)** | 28.3° | Seasonal insolation → thermal field, polar heating |
| Distance (AU) | 5.2 | 9.6 | 19.2 | 30.1 | Radiative T, photochemical haze production |
| Dynamical-layer depth D | ~3,000 km (deep) | ≥9,000 km (deep) | ~1,000 km (thin) | ~1,000 km (thin) | **Sets equatorial-jet sign + jet count** |
| Peak winds (m/s) | ±150 | +450 (eq) | −100 eq/+200 hi-lat | **−400 eq/+250 hi-lat** | Amplitude U of the master field |

**Two headline contrasts.** (1) Jup/Sat = fast+large+deep layer → **many narrow jets (~20–30) + prograde (super-rotating) equator**. Ura/Nep = smaller+thin shell → **3 broad jets + retrograde (sub-rotating) equator**. (2) "Wind paradox": Neptune has the *lowest* energy input yet *fastest* winds — a thin weakly-dissipative weather layer concentrates momentum into few broad jets.

---

## §1 — Master catalog

| # | Phenomenon | Which giants / how it differs | Generating mechanism (field over sphere) | Driver scaling | Recyclable? | Key sources |
|---|---|---|---|---|---|---|
| 1 | **Zonal jets** | All 4. Jup ~20 alt jets; Sat fewer/broader + huge eq jet; Ura/Nep **3 jets** (1 broad retro eq + 2 prograde hi-lat) | `u(φ)` alternating prograde/retrograde; spacing = Rhines L_β=π(2U/β)^½; jets = PV staircase | N_jets∝(aΩ/U)^½. ↑Ω,↑a→more; ↑U→fewer/broader | **YES universal** | Rhines1975; Vasavada&Showman2005; Dritschel&McIntyre2008; Cho&Polvani1996 |
| 2 | **Equatorial jet sign** | Jup/Sat prograde; Ura/Nep retrograde | Sign = single switch s_eq. Deep-tangent-cylinder geometry OR dissipation type (Newtonian cooling→super; drag→sub) | Set by depth fraction D/a and/or dissipation | **YES as ±1 flag** (mechanism contested) | Schneider&Liu2009(JAS); Warneford&Dellar2017(JFM); Kaspi2013 |
| 3 | **Belt/zone banding** | All; sharpest Jup/Sat; muted Ura/Nep | Albedo = sign map of meridional circ tied to jets (zones=upwelling/anticyc, belts=subsidence/cyc — classical, partly revised by Juno) | Contrast ↑ jet strength & cloud opacity; ↓ haze burial | **YES** — projection of sign(dU/dφ) onto cloud field | Ingersoll+2004; Vasavada&Showman2005 |
| 4 | **Long-lived anticyclones** (GRS, ovals BA) | Jup GRS+ovals; Nep transient Great Dark Spots; Sat/Ura fewer | Balanced anticyclone in shear zone; shallow-water vortex over deep layer. **Latitude deterministic** (anticyc-shear+stable-PV band); longitude/number seeded | Size∝shear-zone width & L_d=NH/f; persistence↑ weak dissipation | **YES** seeded object placed by u(lat)-shear/PV | Dowling&Ingersoll1989; Marcus1993; Parisi+2021(~500km deep) |
| 5 | **Vortex placement/aspect/E-W stretch** | All; Jovian ovals ~2:1 E-W:N-S | N-S half-width≈L_d; E-W≈anticyc shear-zone width → aspect λ≈W_shear/L_d; vertical H/L≈f/N | λ↑ jets widely spaced vs L_d; ↑ rotation | **YES closed-form** from u(lat) spacing+strat | Marcus1993; Dowling&Ingersoll1989 |
| 6 | **Vortex chains / "string of pearls"** | Jup chain of cyclones ~40°S; rows of ovals along jets | Row of like-sign vortices along a jet = saturated jet instability at most-unstable wavelength (regular longitudinal spacing) | Spacing∝L_d/jet width; count=2πa/λ_unstable | **YES** same instability as hexagon, diff latitude/wavenumber | Vasavada&Showman2005; Adriani+2018 |
| 7 | **Saturn polar hexagon** (& polygonal jets) | Sat N pole wavenumber-6 ~76°N; not seen elsewhere (same mech→diff n) | Stationary Rossby wave phase-locked in sharp polar jet; barotropic/baroclinic instability selects integer n. Lab-reproduced | n set by jet width, shear, Rossby number | **YES generic** (jet instability→stationary n-gon); n=6 is Saturn's point | Godfrey1988; BarbosaAguiar+2010(lab); Cabanes/Yadav-Bloxham2020 |
| 8 | **Polar cyclone cluster vs single** | Jup **8-around-1** N, **5-around-1** S ~84°; Sat single each pole; Ura/Nep unobserved | Cyclones assemble via beta-drift of moist-convective cyclones toward pole; equilibrium polygon from vorticity balance. Cluster-vs-single = Burger-number regime | Cluster count from L_d,polar vs a | **YES one regime diagram** | Adriani+2018; Gavriel&Kaspi2021; O'Neill+2015; Brueshaber+2019 |
| 9 | **Storm trains / Great White Spot / moist outbursts** | Sat GWS ~every 30yr; Jup frequent plumes/5µm hot spots; Nep episodic; Ura rare | **Water-loading relaxation oscillator**: high-μ H₂O suppresses convection for decades then global eruption. Seeded in time by accumulation threshold | Period∝radiative timescale & water abundance (>~1%); amplitude↑F_int | **YES relaxation-oscillator field**; period is per-body scalar | Li&Ingersoll2015; Sánchez-Lavega+2011; Fischer+2011 |
| 10 | **Cloud/haze vertical layering** | All NH₃/NH₄SH/H₂O decks; Ura/Nep add CH₄ cloud + deep H₂S + thick haze | Cloud bases where T(p) crosses each species' condensation curve (closed-form thermochem); haze τ from photochem(∝UV)×mixing | Deck p↓ (colder→higher) with distance; haze τ↑ insolation & sluggish mixing | **YES closed-form** from T(lat,p)+abundances; only species list changes | Irwin+2022("Hazy Blue Worlds"); West+2004; Sromovsky+2015 |
| 11 | **Hot/cold poles T(lat)** | Sat warm cyclonic polar vortices; Nep warm summer S pole; Ura sluggish near-uniform (puzzle); Jup hot polar **thermosphere = auroral, NOT fluid** | T(lat)=radiative-eq(insolation×ε)+F_int+dynamical subsidence warming. Jup thermospheric hot pole = magnetospheric Joule/auroral | Seasonal amp∝ε & radiative time; polar-vortex warmth∝subsidence | **MOSTLY**; **Jup auroral hot pole NOT recyclable** (needs magnetosphere) | Fletcher+2008; O'Donoghue+2021; Hueso&Sánchez-Lavega2019 |
| 12 | **Equatorial trapped waves → 5µm hot-spot train (Jupiter)** | Jup regular chain of cloud-clear hot spots ~7°N; weaker/absent elsewhere | Equatorially trapped Rossby(-gravity) wave; hot spots=downwelling phase, spaced by zonal wavenumber (closed-form equatorial eigenmode) | Wavelength set by equatorial L_d & phase speed | **YES** equatorial-wave eigenfunction | Showman&Dowling2000; Friedson2005; Vasavada&Showman2005 |

---

## §2 — Closed-form / scaling laws

**§2a Jet number/spacing (Rhines).**
```
β(φ)   = 2Ω cosφ / a
L_β    = π · (2 U_rms / β)^(1/2)     # jet half-spacing
N_jets ≈ a / L_β  ∝ (a·Ω / U_rms)^(1/2)
```
Faster rotation & larger radius → more jets; stronger eddy velocity widens them. Spans Jupiter (~10/hemi) to Neptune (~1–2). Deep-convection view: count = nested Taylor-Proudman cylinders outside the tangent cylinder (depth-controlled, numerically consistent).

**§2b Equatorial jet sign (s_eq switch).** Reduce to one per-body bit. Deep view: deep layer (D/a large)→prograde (Jup/Sat); thin shell (Ura/Nep D/a~0.04)→retrograde. Shallow view: Newtonian cooling→super, Rayleigh drag→sub. Both collapse to s_eq∈{+1,−1} keyed on depth-fraction/dissipation scalar. Contested mechanism; solid observation.

**§2c Vortex latitude/placement/aspect (deterministic given u).**
```
L_d = N·H / f,  f = 2Ω sinφ         # N-S size
b   ≈ L_d                            # N-S half-width
L   ≈ width of anticyclonic shear zone   # E-W half-length
λ   = L / b ≈ W_shear / L_d          # E-W elongation
H/L ≈ f / N                          # vertical pancake
Placement latitude: where dU/dφ anticyclonic AND dQ/dφ (PV grad) weak/stable
                    → discrete latitude bands fixed by u(lat)
```
**Latitude deterministic from u(lat); longitude & number seeded; size/aspect closed-form from jet spacing + stratification.**

**§2d Storm timing (relaxation oscillator).** Convective inhibition builds over radiative/loading timescale τ, then discharges. τ grows with condensable (water) μ-excess & radiative time; needs water mixing ratio ≳1%. Period ~1 Saturn year emerges without tuning.

---

## §3 — Contested / theorized>observed flags
- **Equatorial jet sign mechanism:** deep-geometry vs dissipation genuinely unsettled. Observation solid, cause not. Parameterize, don't claim mechanism.
- **Belt/zone ↔ up/downwelling:** classic picture partly contradicted by Juno. Appearance heuristic, not ground truth.
- **Hexagon origin:** shallow barotropic instability (lab) vs deep-convection anchoring both live. Why n=6 & so stationary not closed.
- **Uranus thermal near-uniformity:** 98° obliquity yet ~uniform T & F_int≈0 — open puzzle. Don't hard-code obliquity→T for Uranus.
- **Ice-giant winds:** ~decade of data each; jet count/profile less constrained. Neptune dark spots migrate/vanish — transient/seeded.
- **Non-recyclable:** Jupiter auroral thermosphere (magnetospheric, outside fluid scope).

---

## §4 — SHARED SUBSTRATE (the key output)

Five fields in strict dependency order; each level reads only levels above.
```
L0 drivers: Ω, a, g, F_int, S(∝1/d²), ε, composition(μ,H2O,NH3,CH4,H2S), D/a → also s_eq sign bit
L1 (A) T(lat,p) = radiative-eq(S·f(ε)) + F_int + dynamical warming
   (B) N²(lat,p)/convective-vigor + moist-trigger (from F_int, μ, H2O)
L2 u(lat) ★ MASTER: amplitude U←eddy energy from (B)/F_int; jet count←Rhines L_β(Ω,a,U);
   eq sign←s_eq(D/a); thermal-wind link ∂u/∂p from ∂T/∂lat → jet LATITUDES quasi-deterministic
L3 dU/dφ shear → cyclonic/anticyclonic SIGN MAP → belt/zone; Q(lat) PV & dQ/dφ staircase
L4 coherent structures SEEDED in L3: anticyclones/GRS/ovals/string-of-pearls (lat deterministic,
   lon+count seeded, size/aspect §2c); polar hexagon (stationary Rossby wave, n from polar-jet
   instability); polar cyclone cluster vs single (Burger regime + moist beta-drift); eq hot-spot
   train (equatorial trapped-wave eigenmode)
L5 radiative overlay: cloud decks (T-p condensation crossing); haze τ (photochem∝S × mixing);
   BELT/ZONE ALBEDO = (L3 sign map) ⊗ (cloud/haze); global color = integrated τ + deck depth
```
One-line order: `drivers → (T,N²) → u(lat) → {shear,PV} → {vortices,waves,polar}`; parallel `(T,N²,S)→{clouds,haze}→color`; `belt/zone = circulation-sign ⊗ cloud`.

**Buys:** one `u(lat)` generator (Rhines count + s_eq + amplitude) + one thermal/condensation stack → every phenomenon falls out as feature-of-u, seeded structure placed by u's shear/PV, or radiative projection. Per-body variety = 6–8 scalars, not 4 bespoke worlds. Only non-recyclable: Jupiter auroral hot pole.
