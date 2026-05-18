# Star Population Synthesis for Procedural Generation

> Research conducted 2026-03-14. Feeds into GAME_BIBLE.md §12 (Galaxy-Scale Generation).
> Sources: Kroupa 2001, Chabrier 2003, Raghavan et al. 2010, Bland-Hawthorn & Gerhard 2016, Hayden et al. 2015.

---

## 1. Stellar Populations

### Population I (Disk Stars)
- **Location:** Thin disk (scale height ~300 pc), concentrated in spiral arms
- **Metallicity:** [Fe/H] = -0.5 to +0.3 (solar neighborhood average ~0.0)
- **Ages:** 0 to ~10 Gyr (spiral arms skew young, <1 Gyr)
- **Star types:** Full OBAFGKM spectrum. O and B stars ONLY found here.
- **Fraction:** ~70-75% of all stars

### Population II (Old, Metal-Poor)
- **Location:** Thick disk (scale height ~1000 pc), bulge, halo, globular clusters
- **Metallicity:** [Fe/H] = -2.5 to -0.5 (halo ~ -1.5, thick disk ~ -0.6)
- **Ages:** 8-13 Gyr (almost all old)
- **Star types:** No O, B, or A main-sequence stars left. Dominated by G, K, M dwarfs + red giants.
- **Fraction:** ~24-28% (thick disk ~15%, halo ~1-2%, bulge ~10%)

### Population III (Primordial)
- All dead. Skip for game, or include as lore only.

### Spectral Type by Region (main-sequence surviving)

| Type | Thin Disk | Thick Disk | Bulge | Halo |
|------|-----------|------------|-------|------|
| O | 0.00003% | 0% | 0% | 0% |
| B | 0.1% | 0% | 0% | 0% |
| A | 0.6% | 0.1% | 0.1% | 0% |
| F | 3% | 1.5% | 1% | 0.5% |
| G | 7.5% | 7% | 6% | 5% |
| K | 12% | 13% | 13% | 13% |
| M | 76.8% | 78.4% | 79.9% | 81.5% |

In spiral arms: multiply O and B fractions by ~5-10x.

---

## 2. Initial Mass Function (Kroupa IMF)

```
xi(m) = dN/dm proportional to m^(-alpha)

| Mass Range (solar) | alpha |
|---------------------|-------|
| 0.08 - 0.50 | 1.3 |
| 0.50 - 150 | 2.3 |
```

### Mass to Spectral Type

| Type | Mass Range | Typical | Main-Seq Lifetime |
|------|-----------|---------|-------------------|
| O | 16-150 | 30 | 3-10 Myr |
| B | 2.1-16 | 5 | 10-300 Myr |
| A | 1.4-2.1 | 1.7 | 0.3-2 Gyr |
| F | 1.04-1.4 | 1.2 | 2-7 Gyr |
| G | 0.8-1.04 | 0.9 | 7-15 Gyr |
| K | 0.45-0.8 | 0.6 | 15-40 Gyr |
| M | 0.08-0.45 | 0.2 | >40 Gyr |

Main-sequence lifetime:
```
t_ms ~ 10 * m^(-2.5) Gyr  (for 0.8 < m <= 2)
t_ms ~ 10 * m^(-3.0) Gyr  (for m > 2)
t_ms ~ 10 * m^(-2.0) Gyr  (for m <= 0.8)
```

### Fraction by Number (at birth)

| Type | Fraction |
|------|----------|
| O | 0.003% |
| B | 0.13% |
| A | 0.6% |
| F | 3.0% |
| G | 7.6% |
| K | 12.1% |
| M | 76.5% |

### Sampling Code (Inverse Transform)

```javascript
function sampleKroupaMass(rng) {
    const r = rng.float();
    if (r < 0.765) return inversePowerLaw(rng.float(), 0.08, 0.45, 1.3);      // M
    else if (r < 0.886) return inversePowerLaw(rng.float(), 0.45, 0.8, 2.3);   // K
    else if (r < 0.962) return inversePowerLaw(rng.float(), 0.8, 1.04, 2.3);   // G
    else if (r < 0.992) return inversePowerLaw(rng.float(), 1.04, 1.4, 2.3);   // F
    else if (r < 0.998) return inversePowerLaw(rng.float(), 1.4, 2.1, 2.3);    // A
    else if (r < 0.9997) return inversePowerLaw(rng.float(), 2.1, 16, 2.3);    // B
    else return inversePowerLaw(rng.float(), 16, 150, 2.3);                      // O
}

function inversePowerLaw(u, mMin, mMax, alpha) {
    const a = 1 - alpha;
    return Math.pow((1 - u) * Math.pow(mMin, a) + u * Math.pow(mMax, a), 1/a);
}

function massToSpectralType(mass) {
    if (mass >= 16) return 'O';
    if (mass >= 2.1) return 'B';
    if (mass >= 1.4) return 'A';
    if (mass >= 1.04) return 'F';
    if (mass >= 0.8) return 'G';
    if (mass >= 0.45) return 'K';
    return 'M';
}
```

---

## 3. Metallicity by Galactic Region

### Disk Gradients

Radial (in disk plane):
```
[Fe/H](R) = -0.06 * (R_kpc - 8.0)
```
Vertical (above/below disk):
```
[Fe/H](z) -= 0.3 * |z_kpc|
```
Combined:
```
[Fe/H]_disk(R, z) = -0.06 * (R - 8.0) - 0.3 * |z|
Scatter: sigma ~ 0.18 dex
```

### Bulge (bimodal)
- 60% chance: Gaussian(mean=+0.3, sigma=0.2)
- 40% chance: Gaussian(mean=-0.3, sigma=0.3)

### Halo
```
[Fe/H]_halo = -1.2 - 0.02 * max(0, R - 15)
Scatter: sigma = 0.5
Clamp to [-4.0, -0.5]
```

---

## 4. Age Distribution

| Component | Distribution |
|-----------|-------------|
| Thin disk | exp(-age / 12 Gyr), range [0, 10] |
| Spiral arms | 80%: exp(-age / 0.5 Gyr) in [0, 1]; 20%: uniform [1, 10] |
| Thick disk | Gaussian(10, 1.5), clamp [8, 13] |
| Bulge | 85%: Gaussian(10, 1.5) clamp [7, 13]; 15%: Uniform [0, 5] |
| Halo | Gaussian(12, 1.0), clamp [10, 13.5] |

### Age-Metallicity Constraint
```
[Fe/H]_max(age) ~ 0.5 - 0.08 * age_Gyr
[Fe/H]_min(age) ~ -3.0 + 0.2 * (13.5 - age_Gyr)
```

---

## 5. Binary Frequency

### By Spectral Type

| Primary | Binary Fraction |
|---------|----------------|
| O | 75% |
| B | 65% |
| A | 55% |
| F | 50% |
| G | 44% |
| K | 38% |
| M | 27% |

### By Region (multiplier on base fraction)
- Thin disk: 1.0x
- Thick disk: 0.8x
- Halo: 0.8x
- Bulge: 0.65x

---

## 6. Component Density Model

```javascript
function componentDensities(R_kpc, z_kpc) {
    // Thin disk
    const thinDisk = Math.exp(-R_kpc / 2.6) * Math.exp(-Math.abs(z_kpc) / 0.3);
    // Thick disk (12% normalization)
    const thickDisk = 0.12 * Math.exp(-R_kpc / 3.6) * Math.exp(-Math.abs(z_kpc) / 0.9);
    // Bulge (flattened)
    const r_bulge = Math.sqrt(R_kpc**2 + (z_kpc / 0.5)**2);
    const bulge = 2.0 * Math.exp(-r_bulge / 0.5);
    // Halo (power law)
    const r_halo = Math.sqrt(R_kpc**2 + z_kpc**2);
    const halo = 0.005 * Math.pow(Math.max(r_halo, 0.1) / 8.0, -3.5);

    const total = thinDisk + thickDisk + bulge + halo;
    return {
        thin: thinDisk / total, thick: thickDisk / total,
        bulge: bulge / total, halo: halo / total,
        totalDensity: total
    };
}
```

### Spiral Arm Detection

```javascript
function spiralArmStrength(R_kpc, theta_rad) {
    const pitchAngle = 12.0 * Math.PI / 180;
    const k = 1.0 / Math.tan(pitchAngle);
    const numArms = 4;
    const armWidth = 0.6; // kpc half-width

    let maxStrength = 0;
    for (let arm = 0; arm < numArms; arm++) {
        const theta0 = arm * (2 * Math.PI / numArms);
        const expectedTheta = theta0 + k * Math.log(R_kpc / 4.0);
        let dTheta = ((theta_rad - expectedTheta) % (2*Math.PI) + 3*Math.PI) % (2*Math.PI) - Math.PI;
        let dist = Math.abs(dTheta) * R_kpc;
        let strength = Math.exp(-0.5 * (dist / armWidth)**2);
        maxStrength = Math.max(maxStrength, strength);
    }
    return maxStrength;
}
```

### Milky Way Dimensions

| Parameter | Value |
|-----------|-------|
| Disk radius | ~15 kpc (visible), ~25 kpc (full) |
| Thin disk scale height | 0.3 kpc |
| Thick disk scale height | 0.9 kpc |
| Thin disk scale length | 2.6 kpc |
| Bulge radius | ~0.5-1.0 kpc |
| Halo extent | ~100 kpc |
| Sun's position | R = 8.0 kpc, z = 0.025 kpc |
| Total stars | ~100-400 billion |
