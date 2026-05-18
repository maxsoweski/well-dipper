# Zone Variability Research — Raw Findings

> Research conducted 2026-03-13. Sources at bottom.
> This feeds into GAME_BIBLE.md §4 (Star Systems) and §12 (Galaxy-Scale Generation).

---

## 1. Planet Count Distribution

### Key numbers
- **1.2 planets/star** average (Sun-like, P < 400 days, R = 1-20 R⊕) — Zhu & Dong 2021
- Only **~30-50%** of stars have Kepler-detectable planets at all
- When ALL orbital distances are included, **most stars have at least one planet**

### Distribution (inner system, P < 400 days)

| Planets | Fraction of stars |
|---------|------------------|
| 0 | ~50-70% |
| 1 | ~10-15% |
| 2 | ~8-12% |
| 3 | ~4-6% |
| 4 | ~2-3% |
| 5 | ~1-2% |
| 6+ | < 1% |

Note: these are INNER SYSTEM only. Total planet counts including outer planets are higher.

### The Kepler Dichotomy
Two populations exist:
1. **"Flat" multis** — 5+ planets, low mutual inclination (~1-2°), tightly packed
2. **"Dynamically hot" singles** — 1 planet visible, others on high inclinations or truly alone

May be a continuum rather than two discrete populations.

### By star type
- **M dwarfs**: More compact multis. ~50% may contain 5+ coplanar planets. Small planets more common per star.
- **G dwarfs**: Baseline numbers above
- **F dwarfs**: Slightly fewer detected (may be detection bias)

---

## 2. Orbital Spacing Variance

### Period ratio between adjacent planets
- **Minimum observed**: ~1.2 (nothing closer)
- **Peak of distribution**: 1.5-2.0
- **Significant excess at**: ~2.2
- **Beyond 2.5**: power law with exponent -1.26
- **Our game's 1.6-2.2x**: right in the sweet spot

### Distribution model
Log-normal: μ = 0.55, σ = 0.25 (gives median ~1.73)
In mutual Hill radii: median Δ ~ 15, mean ~ 17, peak ~ 12

### "Peas in a Pod" (Weiss et al. 2018)
From 909 planets in 355 multi-planet systems:
- Planets within a system have **correlated sizes** — neighbors are similar
- Planets within a system have **correlated spacings** — period ratios are uniform
- Smaller planets → tighter spacings
- Systems are internally consistent: either all tightly packed small worlds, or spread out larger worlds

### Clustering patterns
- **Compact multis** concentrate at P < 100 days (all inner system)
- Systems with outer giants show **gaps** in inner systems
- **Gap-giant association**: outer giant sculpts inner architecture

---

## 3. Metallicity → Planet Composition

### Fischer-Valenti (2005) — Giant planet-metallicity correlation
Giant planet probability scales as N_Fe²:

| [Fe/H] | Giant planet probability |
|--------|------------------------|
| -0.5 | ~3% |
| 0.0 | ~5-10% |
| +0.3 | ~20% |
| +0.5 | ~25-30% |

### Buchhave et al. (2014) — Three regimes

| Regime | Radius | Mean host [Fe/H] |
|--------|--------|-------------------|
| Terrestrial | < 1.7 R⊕ | -0.02 ± 0.02 |
| Gas dwarf (sub-Neptune) | 1.7-3.9 R⊕ | +0.05 ± 0.01 |
| Gas/ice giant | > 3.9 R⊕ | +0.18 ± 0.02 |

**Key insight**: Small rocky planets form at ANY metallicity. Gas giants NEED high metallicity.

At lower metallicities, rocky planets are MORE common (embryos grow too slowly to grab gas).
At higher metallicities, rocky cores tend to become sub-Neptunes (grab gas before disk dissipates).

### Metallicity across a galaxy

| Region | Mean [Fe/H] | Range |
|--------|------------|-------|
| Thin disk (solar neighborhood) | ~0.0 | -0.5 to +0.4 |
| Thick disk | ~-0.6 | -1.0 to -0.2 |
| Bulge | ~-0.2 | -1.5 to +0.5 |
| Halo | ~-1.5 | -3.0 to -1.0 |
| Spiral arms | Slightly above inter-arm | — |

**Radial gradient in disk**: -0.06 dex/kpc from center. At 4 kpc: ~+0.4. At 8 kpc (solar): ~0.0. At 12 kpc: ~-0.2.

---

## 4. Star Age Effects

| Age | Effects |
|-----|---------|
| < 100 Myr | No mature planets. Debris disk. Skip or "forming" state. |
| 100-500 Myr | M-dwarf HZ planets desiccated (pre-MS luminosity 10-100x higher). Close-in stripping active. |
| 500 Myr - 1 Gyr | Systems settling. Stripping winding down. |
| 1-5 Gyr | Peak habitability for G/K. Stable for M. |
| 5-10 Gyr | G-star HZ migrating outward (~10% luminosity increase per Gyr). M-star HZ stable. |
| > 10 Gyr | Only M/K dwarfs still on main sequence. G dwarfs becoming subgiants. |

### Atmosphere stripping
- Hot Neptunes (P < 3-5 days): stripped within ~1 Gyr
- Sub-Neptunes at moderate distance: survive several Gyr
- Rocky planets in M-dwarf HZ: may lose original atmosphere during pre-MS, need volcanic outgassing

### M-dwarf pre-main-sequence
Lasts 100-500 Myr. During this time, luminosity is 10-100x higher than main-sequence value. Planets currently in the HZ were INSIDE the inner HZ edge — potentially losing multiple Earth-oceans of water.

---

## 5. Space Engine's Approach (0.991)

### What they model
- Population I (young, metal-rich disk) vs Population II (old, metal-poor halo/bulge)
- Metallicity tied to hot gas giant probability and system architecture
- Spiral arms via "swirl modifier" (rotation function of distance from center)
- Globular clusters scale with galaxy size

### What they DON'T model (or don't document)
- Peas in a pod intra-system correlations
- Age-dependent HZ migration
- Kepler dichotomy
- Detailed arm vs inter-arm metallicity differences

---

## 6. Zone Occupancy Patterns

### HZ occupancy (Earth-sized, 0.5-1.5 R⊕)

| Star type | HZ planets per star (conservative) |
|-----------|-------------------------------------|
| FGK | 0.37-0.60 |
| M dwarfs | 0.30-0.41 |

~1 in 5 Sun-like stars has an Earth-sized HZ planet.

### Planet occurrence by orbital period

| Period range | Occurrence (all sizes) | Dominant type |
|-------------|----------------------|---------------|
| < 3 days | Low (~2-5%) | Hot Jupiters rare, super-Earths uncommon |
| 3-10 days | ~10-15% | Super-Earths, sub-Neptunes |
| 10-50 days | ~25-30% | Sub-Neptunes dominate |
| 50-200 days | ~30-40% | Rocky + sub-Neptune mix |
| 200-400 days | ~20-30% | Rocky planets, some giants |

### Empty zone patterns
- Giant planets create gaps in inner systems (gap-giant association)
- Compact multis fill inner zone densely
- Single-planet systems have large empty regions
- NO universal "inner empty / outer full" pattern — both exist

---

## Code-Ready Parameters

```javascript
// PLANET COUNT
const MEAN_PLANETS_INNER = 1.2;       // P < 400 days
const FRACTION_WITH_PLANETS = 0.40;   // detection-corrected

// ORBITAL SPACING
const MIN_PERIOD_RATIO = 1.2;         // hard minimum
const PERIOD_RATIO_MU = 0.55;         // log-normal μ
const PERIOD_RATIO_SIGMA = 0.25;      // log-normal σ
// Peas in a pod: correlation ~0.6 between adjacent spacings

// METALLICITY → GIANT PLANETS
// P(giant) = 0.05 * 10^(2 * [Fe/H])
// Rocky planets: no metallicity threshold
// Sub-Neptunes: slight positive correlation with metallicity

// GALACTIC METALLICITY GRADIENT
const DISK_GRADIENT = -0.06;          // dex per kpc from center
const SOLAR_RADIUS_KPC = 8.0;
const BULGE_MEAN_FEH = -0.2;
const HALO_MEAN_FEH = -1.5;

// AGE
// M-dwarf pre-MS: 100-500 Myr enhanced luminosity
// Atmosphere stripping: P < 5 days over 1+ Gyr
// G-star HZ drift: ~10% luminosity increase per Gyr
```

---

## Sources
- Zhu & Dong 2021 — Exoplanet Statistics and Theoretical Implications
- Fang & Margot 2012 — Architecture of Planetary Systems Based on Kepler Data
- Weiss et al. 2018 — Peas in a Pod (California-Kepler Survey V)
- Steffen & Hwang 2015 — Period Ratio Distribution of Kepler Multiplanet Systems
- Fischer & Valenti 2005 — The Planet-Metallicity Correlation
- Buchhave et al. 2014 — Three Regimes of Extrasolar Planet Radius
- Kunimoto et al. 2020 — Occurrence Rate Estimates for FGK Stars
- Bryson et al. 2021 — Occurrence of Rocky HZ Planets Around Solar-Like Stars
- Luger & Barnes 2015 — Extreme Water Loss on M-dwarf HZ Planets
- SpaceEngine 0.991 Universe Generation Overview + Update Notes
- Matteucci — Galactic Metallicity Gradients
