# Atmospheric-Phenomena Catalog — Completeness Review (adversarial)

> Provenance: World-Engine Track-A #3a scoping, 2026-06-30. Read WITH the three sibling catalogs
> ([giants](atmosphere-phenomena-giants.md), [exoplanet](atmosphere-phenomena-exoplanet.md),
> [terrestrial](atmosphere-phenomena-terrestrial.md)) — this doc records their **corrections + confirmed gaps**.
>
> Method: 7 blind completeness critics (each a distinct omission angle) → per-candidate adversarial
> verification (actually-absent + science-sound + in-scope, default-refute) → dedupe/rank synthesis.
> **47 candidates → 28 confirmed** (killed: 14 already-covered, 4 out-of-scope, 1 dubious-science) →
> **deduped to 23** (12 HIGH). 55 agents, ~3.1M tokens.

---

## The three structural misses (what actually matters)

1. **A whole RENDER REGISTER was missing: self-luminous emission.** All three passes modelled only
   *reflected* sunlight + thermal-IR. Nothing self-luminous. That's wrong for four archetypes at once:
   aurora (visible oval — the passes even mis-scoped it "outside fluid scope"), nightside **lightning**,
   **blackbody thermal glow** (a hot/ultra-hot Jupiter GLOWS — under a reflectance-only colour model it
   renders like a *cold* giant, i.e. just wrong), and self-luminous **brown-dwarf/directly-imaged** giants.
   → the substrate needs a second render register (emission), not just more fields.

2. **Three named Track-A archetypes have ZERO coverage** (no section in any pass): **Mars-class** (thin
   dusty CO₂ — global dust storms, seasonal frost caps, thermal tide), **Lava/magma** (rock-vapour
   dayside-only atmosphere, terminator "rock rain" ring), **Pluto/Triton** (sublimation N₂/CH₄, stacked
   blue haze strata, glacier condensation winds). Plus the **brown-dwarf/directly-imaged** class.

3. **A correctness hole in the shared substrate itself** (directly touches #3a): the "one u(lat)
   generator" unified jet **count** and **sign** but NOT **amplitude** — three contradicting per-archetype
   scalings, and the flagged Neptune "wind paradox" (lowest heat, fastest winds) proves energy-input
   alone can't set jet speed. Needs a unified `U = f(energy/dissipation, shell-depth)` law. #3a's
   "jet speed scales with drivers" depends on this.

---

## 4 catalog corrections (apply to the sibling files)

1. **exoplanet.md deep-dive 3** conflates stellar-UV with planet T_eq ("UV photochemistry favored higher
   T_eq"). Photochemical-haze/inversion production is set by the **host star's SED hardness (FUV/NUV)** —
   a *stellar* property, not the planet's T_eq (at fixed T_eq an M-dwarf ≠ a G/F star). Decouple UV as a
   stellar driver (see the stellar-SED gap).
2. **giants.md aurora** is dismissed "outside fluid scope / non-recyclable" (§3, row 11, §4). This conflates
   fluid-**simulation** scope with **render** scope: the visible auroral emission oval is a legit closed-form
   generative field (a one-way READ of magnetic-dipole geometry, isomorphic to the orographic relief-READ).
   Only the *thermal* magnetospheric coupling is out of the fluid substrate; the visible emission is not.
3. **giants.md Uranus near-uniform T** is labelled an unmodelable "open puzzle / don't hard-code obliquity→T."
   Overstated: it's the **long-τ_rad smoothing limit of the closed-form Ward annual-mean insolation field**
   `W(φ, obliquity)` — a driver-set OUTPUT, not an anomaly to avoid.
4. **exoplanet.md row 11** patchy-cloud opacity uses a raw time variable `τ_cloud(θ,φ,t)`, violating the
   place-once (no-time-stepping) contract. Replace `t` with a seeded per-body phase `ph=hash(seed)∈[0,1)`
   sampling the variability envelope (the place-once phase selector below).

---

## 23 confirmed gaps, ranked (variety + recyclability per effort)

### HIGH (12)
| Gap | Worlds | Mechanism (closed-form/seeded) | Recycles |
|---|---|---|---|
| **Visible auroral emission oval** (+ moon-footprint spots) — a render layer distinct from the thermal hot-pole | Gas/ice giants w/ dynamo (ice giants get dramatic off-axis ovals), magnetized rocky, ionized UHJ | Gaussian ring `I(θ_mag)=A·G(θ_mag−θ_oval,σ)` in magnetic colatitude about a tilted+offset dipole; N seeded point-emitters at torus-moon mag longitudes | seeded-Gaussian-band + seeded-point placement; NEW = magnetic dipole strength/tilt/offset drivers |
| **Nightside lightning flashes** (moist-convective; shallow high-lat; sprites) — self-luminous channel | Gas giants, ice giants (episodic), rocky ITCZ, eyeball substellar cell | inhomogeneous Poisson point-emitters, rate `λ(lat,lon)=k·C(lat,lon)` over the existing moist-convection field, gated to condensation band | reads Row-9 storm mask directly; adds only a point-emission channel to L5 |
| **Blackbody thermal-emission render channel** (glowing dayside, dark nightside, emissive hotspot) | Hot/ultra-hot Jupiter; lava/magma | `E(θ,φ)=Planck(T(θ,φ))→RGB` composited additively over reflectance; ~1100K silicate nightside floor | recycles the existing T(θ,φ) field; only the render MAPPING is new |
| **Mars-class thin dusty CO₂** — global dust storms, frost caps, thermal tide | Mars-like (named archetype, absent) | dust-τ band × relaxation-oscillator global-storm onset at perihelion; `φ_cap(season)` frost-point crossing → global p_s(t) swing; condensation wind = ∇(sublimation); dust-devil point field; sub-solar T-bulge | Row-9 oscillator retargeted to dust; L5 banded-haze; substellar-bulge at solar-day rate; NEW = CO₂ major-constituent pressure cycle |
| **Lava/magma rock-vapour** — dayside SiO/Na envelope, supersonic day→night wind, terminator rock-rain ring | Lava/Magma (named archetype, absent) | substellar `p_vap(θ_s)=P_sat(T)` (Clausius-Clapeyron); atmosphere-presence mask where dayside T>vaporization; condensate ring at θ_s~90° | eyeball θ_s reframe + day→night cell + T-p deck (species→Na/SiO); NEW = presence mask + rock-rain ring |
| **Folded filamentary turbulent texture** in cyclonic belts/wakes | Gas giants (muted on ice giants) | seeded anisotropic curl-warped noise advected along u(lat) shear, amplitude gated by cyclonic branch of L3 sign map | recycles u(lat) + L3 sign map; no new driver |
| **Fresh-vs-aged chromophore evolution** (white→red storms; belt fade/revival) | Gas giants (GRS red, SEB fade) | per-vortex seeded `age`→`1−exp(−age/τ)` white→red map; per-belt seeded phase→haze-veil opacity | recycles Row 4/6/9 objects + Row 3 albedo + Row 10 haze; adds age axis |
| **Ice-giant companion clouds** (bright CH₄ patches at a dark-vortex flank) + episodic eruptions | Ice giants (Neptune; Uranus episodic) | bright CH₄ patch keyed to Row-4 vortex position (vortex READ as a topographic obstacle); + Poisson-in-time bright patches | Row 4 + Row 10 + Row 9; NEW = vortex-obstacle orographic READ |
| **Mushball ammonia compositional banding** (equator bright/rich vs belts depleted/dark) | Gas giants | closed-form `NH3(lat)` depletion co-located with storm mask, feeds Row-10 opacity as per-lat multiplier | Row 9 + Row 10; NEW = latitudinal ammonia modulation (explains real Jupiter banding, ≠ dynamical Row 3) |
| **High-obliquity insolation inversion** (obliquity>~54° → hot poles/cold equator, band axis flips) | Uranus-analog; high-obliquity terrestrials | Ward `W(φ,obliquity)` annual-mean integral (crosses over ~54°) replaces the cos-φ T(lat) forcing; τ_rad knob spans sharp→Uranus-uniform | same banded T/P field, insolation-forcing swapped; ONE function; resolves the Uranus punt |
| **Brown-dwarf/directly-imaged self-luminous giant** (S≈0, longitude-symmetric bands, L/T cloud-clearing patchiness) | Directly-imaged young giant / brown dwarf (real observed class) | banded `τ_cloud(lat)` × `f_cloud(T_eff)` sigmoid through ~1200-1400K L/T transition; seeded holes drift on the jet; T driven by internal flux, S=0 | banding + patchy-cloud + jet advection recycle; NEW = S=0 self-luminous config + f_cloud(T_eff) curve |
| **Pluto/Triton sublimation atmosphere** (~20 stacked blue haze strata, glacier winds, seasonal collapse) | Icy dwarf (Pluto, Triton) | layered `τ(altitude)` comb (gravity-wave spacing); condensation wind = ∇(N₂ sublimation) glacier→winter-pole; global p_s(t) on/off | banded-haze overlay + Titan volatile-pooling READ (N₂ ice); NEW = sublimation-pressure on/off + surface-ice→wind READ |

### MEDIUM (9)
- **Ring-shadow banding** (ringed giant): geometric occultation mask `S'(lat,season)=S·T_ring(lat)` cools/suppresses-photochem a migrating band → feeds T(lat)+haze. Signature no other archetype has; gated on a NEW ring driver.
- **Place-once PHASE selector**: seeded `ph=hash(seed)∈[0,1)`; feature amplitude/presence = envelope(ph). The variety between two identical Saturns; fixes the raw-`t` contract violation. Infrastructure.
- **Airglow/dayglow limb ring**: thin emissive shell, limb-path integrated → luminous edge saying "this ball has air." Universal, cheap, distinct from aurora + photosphere emission.
- **Noctilucent/mesospheric polar-summer clouds**: high-altitude condensate cap gated to summer pole + coldest-mesopause; NEW mesopause-T-min driver. Vivid seasonal tell (incl. thin Mars-like worlds).
- **Stellar spectral-type / UV-SED driver**: `UV(T_star)` multiplier on the haze bell + inversion thresholds + scatter-colour tint. Ties sky colour/haze to the STAR, not an unmotivated slider (needs a chromospheric/flare seed for M-dwarfs). *(= correction 1.)*
- **Orbital-eccentricity thermal forcing**: `F(t)=L/4πr(ν)²→T_eq(ν)`; frozen render picks ν as a scalar; post-periastron ringing = seeded decaying eigenmode (Row 12). NEW driver = e.
- **Monsoon / land-sea thermal-contrast circulation**: read-only over a land/thermal-inertia mask, pulls ITCZ onto the summer continent. A THIRD surface READ (beyond ∇h and h-minima); rocky-with-continents only.
- **Unified jet-AMPLITUDE law** `U≈C·(regime-energy/dissipation)^½·(D/a factor)`: collapses three disjoint scalings; the missing third member of the count/sign/amplitude trio. *(= structural miss 3.)*
- **Shared seasonal-phase input** `season(t;obliquity,e)`: one scalar co-shifts ITCZ/band centres/winter-pole across ALL fields so the world isn't internally uncorrelated. Distinct from the place-once phase selector (astronomical season vs internal-variability state).

### LOW (2)
- **Equatorial stratospheric oscillation** (Jupiter QQO ~4yr, Saturn SAO ~15yr): stacked descending equatorial anomalies; at cloud-top collapses to a subtle slow band. Temporal-only, two-worlds.
- **Spin-orbit resonance / asynchronous rotation** (partial-eyeball smear): time-average the substellar cap over the beat → longitudinal top-hat convolution. Subtle smear of an existing feature; niche.

---

## What this changes for the plan (pointer; full plan separate)
- The substrate stack gains a **second render register (self-luminous emission)** parallel to reflectance —
  the aurora ring, lightning, thermal glow, and airglow all live there.
- The `u(lat)` "master generator" needs its **amplitude law** finished (count+sign+**amplitude**) — this is a
  #3a-relevant correctness fix, not a later add.
- **Obliquity** joins rotation+temp as a first-class band-organizing driver (Ward field / Uranus inversion).
- Cheap **within-type depth layers** (filamentary texture, chromophore, mushball, companion clouds) are the
  concrete answer to "depth/layers, cohesive-not-noise" and mostly ride already-planned fields.
- Mars / lava / Pluto-Triton / brown-dwarf are **coverage holes** to slot as their own increments.
