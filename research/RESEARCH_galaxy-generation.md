# Procedural Galaxy Generation Research

Research compiled for Well Dipper's galaxy-scale generation system.

---

## 1. Galaxy Structure from a Seed

### Logarithmic Spiral Arms

The standard equation for a logarithmic spiral in polar coordinates:

```
r = a * e^(b * theta)
```

Where:
- `r` = distance from center
- `theta` = angle (radians)
- `a` = initial radius (scale factor)
- `b` = controls tightness. Related to **pitch angle** `p` by: `b = tan(p)`

The **pitch angle** is the angle between the spiral arm and a circle centered on the galaxy. The Milky Way has a pitch angle of ~12 degrees. Typical spirals range 5-25 degrees.

**Inverse form** (useful for placing stars along arms):
```
theta = (1/b) * ln(r/a)
```

To generate N arms, offset each by `2*PI / N`:
```javascript
function spiralArmAngle(r, armIndex, numArms, a, pitchAngle) {
  const b = Math.tan(pitchAngle * Math.PI / 180);
  const baseAngle = (1 / b) * Math.log(r / a);
  return baseAngle + (armIndex * 2 * Math.PI / numArms);
}
```

### Beltoforion's Density Wave Approach

The most implementation-ready approach comes from [Beltoforion's Galaxy Renderer](https://beltoforion.de/en/spiral_galaxy_renderer/) (C++ and TypeScript source available on [GitHub](https://github.com/beltoforion/Galaxy-Renderer-Typescript)).

Key insight: **Stars orbit on ellipses, not spirals.** The spiral pattern emerges because the elliptical orbits are progressively tilted as a function of radius. This mirrors real density wave theory -- the arms are traffic jams, not physical structures.

Each star has:
- **Semi-major axis `a`** (orbit radius) -- sampled from density distributions below
- **Eccentricity `e`** -- varies with radius, typically 0.1-0.5
- **Tilt angle `tilt`** -- the key to spiral structure: `tilt = radius * twistFactor`
- **Angle on orbit `theta`** -- random [0, 2*PI)

Position at any time:
```javascript
// Elliptical orbit position
const cosTheta = Math.cos(theta);
const sinTheta = Math.sin(theta);
const r = (a * (1 - e * e)) / (1 + e * cosTheta);

// Local position on ellipse
let x = r * cosTheta;
let y = r * sinTheta;

// Apply the progressive tilt (THIS creates the spiral)
const cosTilt = Math.cos(tilt);
const sinTilt = Math.sin(tilt);
const xFinal = x * cosTilt - y * sinTilt;
const yFinal = x * sinTilt + y * cosTilt;
```

**Varying eccentricity to shape the galaxy:**
- Near center (bulge): low eccentricity ~0.1 (nearly circular, no arm structure)
- Mid-disk: higher eccentricity ~0.3-0.5 (strongly elliptical, pronounced arms)
- Outer disk: moderate eccentricity ~0.2-0.3 (looser arms, more diffuse)

A typical eccentricity curve:
```javascript
function eccentricity(r, galaxyRadius) {
  const t = r / galaxyRadius;
  // Peaks in mid-disk, low at center and edge
  return 0.5 * Math.sin(t * Math.PI);
}
```

### Making Each Galaxy Look Different

Vary these parameters per galaxy seed:
| Parameter | Range | Effect |
|-----------|-------|--------|
| `numArms` | 2-6 | Number of spiral arms |
| `pitchAngle` | 5-25 deg | Tightness of spiral |
| `armWidth` | 0.02-0.15 | How spread out stars are around arm centerline |
| `bulgeRatio` | 0.1-0.4 | Fraction of stars in bulge vs disk |
| `haloFraction` | 0.01-0.05 | Fraction of stars in halo |
| `barLength` | 0-0.4 | Length of central bar (0 = no bar) |
| `dustLaneOffset` | 0-0.5 rad | Offset of dust lanes from arm centers |
| `eccentricityPeak` | 0.2-0.6 | Max orbit eccentricity |

### The Three Components: Bulge, Disk, Halo

Each component gets a fraction of the total star count and its own distribution function.

---

## 2. Density Functions

### Exponential Disk (Thin + Thick)

The disk is where most stars live. Density falls off exponentially in both radius and height:

```
rho(R, z) = rho_0 * exp(-R / h_R) * exp(-|z| / h_z)
```

**Milky Way parameters:**
| Component | Scale Length (h_R) | Scale Height (h_z) | Central Density |
|-----------|-------------------|--------------------|--------------------|
| Thin disk | 2.5-3.5 kpc | 300 pc | ~0.14 stars/pc^3 at Sun |
| Thick disk | 2.0 kpc | 900 pc | ~10% of thin disk |

**For a game**, normalize to your galaxy radius. If your galaxy radius = 1.0:
```javascript
function diskDensity(R, z, scaleLength, scaleHeight) {
  return Math.exp(-R / scaleLength) * Math.exp(-Math.abs(z) / scaleHeight);
}

// To sample a star's radius from this distribution,
// use inverse CDF sampling:
function sampleDiskRadius(rng, scaleLength, maxRadius) {
  // Inverse CDF of exponential: -h * ln(1 - u)
  // But we need to truncate at maxRadius
  const u = rng();
  const maxCDF = 1 - Math.exp(-maxRadius / scaleLength);
  return -scaleLength * Math.log(1 - u * maxCDF);
}

function sampleDiskHeight(rng, scaleHeight) {
  // Double-sided exponential (Laplace distribution)
  const u = rng() * 2 - 1; // [-1, 1]
  return -Math.sign(u) * scaleHeight * Math.log(1 - Math.abs(u));
}
```

### De Vaucouleurs Bulge (Sersic n=4)

The bulge follows a surface brightness profile:

```
I(R) = I_e * exp(-7.67 * ((R/R_e)^(1/4) - 1))
```

Where `R_e` is the effective (half-light) radius. The constant 7.67 ensures half the light falls within R_e.

**3D density** (deprojected, for a spherical bulge):
```
rho(r) ~ rho_0 * r^(-0.855) * exp(-7.67 * (r/R_e)^0.25)
```

**For sampling star positions in the bulge:**
```javascript
function sampleBulgeRadius(rng, effectiveRadius) {
  // Rejection sampling is easiest here
  // Or approximate with a simpler profile:
  // Use a Hernquist profile as an approximation (has analytic inverse CDF)
  const u = rng();
  // Hernquist: M(r)/M_total = (r/(r+a))^2
  // Inverse: r = a * sqrt(u) / (1 - sqrt(u))
  const sqrtU = Math.sqrt(u);
  return effectiveRadius * sqrtU / (1 - sqrtU + 0.001); // small epsilon to avoid infinity
}
```

The Hernquist profile is a common game-dev substitute for de Vaucouleurs because it has an analytic inverse CDF (easy to sample from) and looks nearly identical.

**Milky Way bulge:** R_e ~ 0.7 kpc (compact relative to 15 kpc disk radius)

### Power-Law Halo

The stellar halo follows a power law:

```
rho(r) = rho_0 * (r / r_0)^(-alpha)
```

Where alpha ~ 2.5-3.5 for the Milky Way's stellar halo (steeper than the NFW dark matter profile).

**For sampling:**
```javascript
function sampleHaloRadius(rng, minRadius, maxRadius, alpha) {
  // Inverse CDF of power-law r^(-alpha) in 3D (spherical volume element r^2 dr)
  // Effective PDF: r^(2 - alpha), so need alpha > 3 for convergence
  // For alpha < 3, truncate at maxRadius
  const u = rng();
  const p = 3 - alpha; // For alpha=2.8, p=0.2
  if (Math.abs(p) < 0.001) {
    // Log case
    return minRadius * Math.exp(u * Math.log(maxRadius / minRadius));
  }
  return Math.pow(
    u * Math.pow(maxRadius, p) + (1 - u) * Math.pow(minRadius, p),
    1 / p
  );
}
```

**Milky Way halo:** Contains only ~1% of the galaxy's stars, extends to ~100 kpc. Stellar density ~ 0.001 stars/pc^3 near the Sun's position.

### Putting It Together: Star Budget

For a game with N total "star slots" in the galaxy map:

| Component | Fraction | Distribution | Notes |
|-----------|----------|--------------|-------|
| Thin disk | 70-80% | Exponential disk | Most stars, spiral arms |
| Thick disk | 5-10% | Exponential disk (thicker) | Older, more diffuse |
| Bulge | 10-20% | Hernquist/de Vaucouleurs | Concentrated center |
| Halo | 1-3% | Power-law sphere | Very sparse, old stars |

---

## 3. How No Man's Sky Does It

### Galaxy Structure

Source: [NMS Wiki](https://nomanssky.fandom.com/wiki/Galaxy), [NMS Miraheze Wiki](https://nomanssky.miraheze.org/wiki/Universe), [Rambus Analysis](https://www.rambus.com/blogs/the-algorithms-of-no-mans-sky-2/)

- **256 galaxies** (0x00 - 0xFF, one byte)
- Each galaxy: ~4.2 billion **regions** (~400 ly x 400 ly x 400 ly cubes)
- Each region: 122-642 **star systems**
- Each system: 2-6 planets/moons
- Total: ~18 quintillion possible planets (2^64 address space)

### Seed Architecture (Datamined)

The coordinate/seed system packs into a 64-bit integer:
```
GG:YYZZZXXX:SSS:P

GG     = galaxy index (0-255)
YYZZZXXX = region coordinates within galaxy (x,y,z packed, ~4.2 billion regions)
SSS    = system index within region (0-4095)
P      = planet index within system (0-15)
```

This means **any location in the entire universe can be addressed by a single 64-bit number**, and that number deterministically generates everything at that location.

### Deriving Properties from Position

NMS uses the galaxy seed as the master RNG seed. From that:
1. Region coordinates are hashed to determine regional properties (dominant lifeform race, conflict level, economy type)
2. System seeds derive from region seed + system index
3. Planet seeds derive from system seed + planet index
4. Everything cascades: the same seed always produces the same planet with the same terrain, flora, fauna, colors

### Galaxy Shape

NMS galaxies are **not** true spiral galaxies. They use a simpler model:
- Stars are distributed in a rough sphere/ellipsoid
- Denser toward center
- Different galaxy "types" (Normal, Lush, Harsh, Empty) bias the distribution of planet types but don't fundamentally change the shape
- The galaxy map view shows a vaguely spiral structure but it's mostly cosmetic

---

## 4. How Elite Dangerous Stellar Forge Works

Source: [Elite Dangerous Wiki](https://elite-dangerous.fandom.com/wiki/Stellar_Forge), [80.lv Technical Breakdown](https://80.lv/articles/generating-the-universe-in-elite-dangerous), [Frontier Forums Myth Busting](https://forums.frontier.co.uk/threads/myth-busting-on-stellar-forge-and-the-generation-of-everything-from-stars-to-rocks.517029/)

### Core Design

Stellar Forge generates **~400 billion star systems** in a 1:1 scale Milky Way. It runs **client-side** -- every player's game generates identical systems from the same algorithm. No central server needed for star data.

### Seed from Coordinates

A unique value derived from **galactic coordinates** feeds a PRNG as the starting seed. The generated numbers are then modified by:
- **Galactic position biases**: star type, mass distribution, and metallicity are adjusted based on where you are in the galaxy
- A top-down **density map** (one of the few non-procedural inputs) ensures spiral arms and bulge have the correct shape

### The 64-bit Address System

A single 64-bit integer encodes:
- x, y, z coordinate of the **sector** (a cube of space)
- **Sector layer** (which level of an 8-layer octree)
- **System ID** within that sector
- **Body ID** within that system

The sector layer can be encoded as a single letter (a-h), visible in system names like "Prua Phoe AA-A h1" where the letter indicates the octree depth.

### Regional Variation

- **Spiral arms**: Higher star density, more young/hot stars (O, B types), more nebulae
- **Galactic bulge**: Dense, older stars, more metal-rich
- **Inter-arm regions**: Lower density, more red dwarfs
- **Outer rim**: Very sparse, lower metallicity
- **Known structures**: Real nebulae, star clusters, and the galactic bar are hand-seeded into the density map

### System Formation (Simplified)

Stellar Forge simulates system formation from first principles:
1. Allocate mass to the sector based on density map
2. Distribute mass into individual systems (initial mass function)
3. For each system: simulate accretion disk formation, proto-planet aggregation
4. Chemical composition varies by galactic region (metallicity gradient)
5. Effects tracked: solar wind, tidal locking, gravitational heating, catastrophic events

### Octree Structure

Eight layers of octree subdivision. Top level covers the entire galaxy. Each subdivision halves the sector size. The finest layer contains individual star systems. This allows:
- Quick lookup of nearby systems
- LOD: show sector-level aggregates when zoomed out
- Efficient memory: only generate sectors the player visits

---

## 5. How Space Engine Does It

Source: [SpaceEngine Wiki](https://spaceengine.fandom.com/wiki/Procedural_Generation), [SpaceEngine Blog](https://spaceengine.org/news/blog120306), [0.991 Update](https://spaceengine.org/news/blog251118), [0.991 Overview](https://spaceengine.org/news/blog250911)

### Population Synthesis Model

Space Engine generates stars using astrophysical population synthesis:
- **Population I stars**: Young, metal-rich, found in disk/arms (blue-white supergiants, solar-type)
- **Population II stars**: Old, metal-poor, found in bulge/halo (red giants, subdwarfs)
- Star types are weighted by galactic position -- not just random

### Star Type Variation by Region

- **Disk/Arms**: Higher fraction of O, B, A stars. More active star formation. H-II regions.
- **Bulge**: Older populations dominate. More K, M giants. Metal-rich but old.
- **Halo**: Almost exclusively old, metal-poor stars. Globular clusters.
- **Spiral arms specifically**: Enhanced density of young massive stars, which is what makes arms visible (bright blue stars die fast, so they never leave the arm region)

### Metallicity Gradients

Space Engine models metallicity `[Fe/H]` as decreasing with galactic radius:
- Center: [Fe/H] ~ +0.3 (metal-rich)
- Solar position (8 kpc): [Fe/H] ~ 0.0 (solar metallicity)
- Outer disk (15+ kpc): [Fe/H] ~ -0.5 (metal-poor)
- Halo: [Fe/H] ~ -1.5 to -2.5 (very metal-poor)

Metallicity affects:
- Probability of gas giant planets (higher metallicity = more gas giants)
- Rocky planet composition
- Star color (subtle effect on spectral type)
- Carbon-to-oxygen ratio in stars

### 0.991 Universe Generation Update

Major changes:
- **Broke the "giant-terra-giant-terra" pattern**: Previous versions alternated planet types predictably. 0.991 uses more realistic orbital architecture.
- **Dwarf planets**: Now common (were extremely rare before)
- **Ultra-cool dwarf improvements**: Better temperatures and radii for M7+ and brown dwarfs (L, T, Y types)
- **Fixed metallicity bugs**: Procedural star metallicity was incorrect in 0.990
- **Universe reset**: All procedural objects regenerated -- coordinates from 0.990 are invalid

---

## 6. Practical Seed Architecture for a Game

### The Hierarchy

```
Galaxy Seed (master)
  |
  +-- Sector Seed = hash(galaxySeed, sectorX, sectorY, sectorZ)
        |
        +-- System Seed = hash(sectorSeed, systemIndex)
              |
              +-- Planet Seed = hash(systemSeed, planetIndex)
                    |
                    +-- Moon Seed = hash(planetSeed, moonIndex)
```

### Hash Function (JavaScript)

Well Dipper already uses `alea` for seeded RNG. For seed derivation, use a deterministic hash:

```javascript
// Simple but effective seed combiner
// Based on the splitmix64 pattern
function hashSeed(seed1, seed2) {
  let h = (seed1 ^ seed2) + 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0; // unsigned 32-bit
}

// Derive a sector seed from galaxy seed + coordinates
function sectorSeed(galaxySeed, sx, sy, sz) {
  let seed = hashSeed(galaxySeed, sx);
  seed = hashSeed(seed, sy);
  seed = hashSeed(seed, sz);
  return seed;
}

// Derive a system seed from sector seed + index
function systemSeed(sectorSeed, systemIndex) {
  return hashSeed(sectorSeed, systemIndex);
}
```

Then feed the resulting seed into `alea(seed)` to get a full PRNG for that system.

### Consistency Guarantee

The reason this works for warping between systems:
1. Player is at system A in sector (3, 7, 2)
2. Player warps to system B in sector (4, 7, 2)
3. Game generates sector (4, 7, 2) from scratch using `sectorSeed(galaxySeed, 4, 7, 2)`
4. Always produces the same stars, same positions, same properties
5. No need to store anything -- it's pure math

### Chunk/Sector Loading

**How big should sectors be?**

| Approach | Sector Size | Stars per Sector | Pros | Cons |
|----------|-------------|------------------|------|------|
| NMS-style | ~400 ly cube | 100-600 systems | Simple grid, easy addressing | Fixed granularity |
| Elite-style | Octree (variable) | ~few dozen per leaf | Adaptive density | More complex |
| Simple grid | 50-100 ly cube | 10-50 systems | Easy to implement | May need LOD |

**Recommendation for Well Dipper:** Start with a simple 3D grid. Each sector is a cube of fixed size. Use the sector coordinates directly in the seed.

```javascript
const SECTOR_SIZE = 100; // light-years per sector edge

function getSectorCoords(worldPosition) {
  return {
    x: Math.floor(worldPosition.x / SECTOR_SIZE),
    y: Math.floor(worldPosition.y / SECTOR_SIZE),
    z: Math.floor(worldPosition.z / SECTOR_SIZE)
  };
}

// Load sectors in a radius around the player
function getNearbySectors(playerPos, radius = 1) {
  const center = getSectorCoords(playerPos);
  const sectors = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        sectors.push({
          x: center.x + dx,
          y: center.y + dy,
          z: center.z + dz
        });
      }
    }
  }
  return sectors;
}
```

### Spatial Hashing for Nearby Star Lookup

When the player needs to find the closest N stars (for the galaxy map, warp targets):

```javascript
class GalaxyMap {
  constructor(galaxySeed) {
    this.galaxySeed = galaxySeed;
    this.sectorCache = new Map(); // key: "x,y,z" -> star array
  }

  getSectorKey(sx, sy, sz) {
    return `${sx},${sy},${sz}`;
  }

  generateSector(sx, sy, sz) {
    const key = this.getSectorKey(sx, sy, sz);
    if (this.sectorCache.has(key)) return this.sectorCache.get(key);

    const seed = sectorSeed(this.galaxySeed, sx, sy, sz);
    const rng = alea(seed);

    // Determine star count based on galactic position
    const galacticR = Math.sqrt(sx*sx + sy*sy + sz*sz) * SECTOR_SIZE;
    const density = diskDensity(galacticR, sz * SECTOR_SIZE, SCALE_LENGTH, SCALE_HEIGHT);
    const starCount = Math.floor(density * MAX_STARS_PER_SECTOR);

    const stars = [];
    for (let i = 0; i < starCount; i++) {
      const sysSeed = hashSeed(seed, i);
      stars.push({
        seed: sysSeed,
        // Position within sector (0 to SECTOR_SIZE)
        x: sx * SECTOR_SIZE + rng() * SECTOR_SIZE,
        y: sy * SECTOR_SIZE + rng() * SECTOR_SIZE,
        z: sz * SECTOR_SIZE + rng() * SECTOR_SIZE,
        // Derive basic properties lazily or eagerly
        spectralType: deriveSpectralType(sysSeed, galacticR),
      });
    }

    this.sectorCache.set(key, stars);
    return stars;
  }

  findNearestStars(position, count = 10) {
    const sectors = getNearbySectors(position, 2);
    let allStars = [];
    for (const s of sectors) {
      allStars.push(...this.generateSector(s.x, s.y, s.z));
    }
    // Sort by distance to player
    allStars.sort((a, b) => {
      const da = (a.x-position.x)**2 + (a.y-position.y)**2 + (a.z-position.z)**2;
      const db = (b.x-position.x)**2 + (b.y-position.y)**2 + (b.z-position.z)**2;
      return da - db;
    });
    return allStars.slice(0, count);
  }
}
```

### LRU Cache for Memory Management

Follow the Infinity Engine / Ysaneya approach: keep a budget of N cached sectors, evict least-recently-used when exceeded.

```javascript
// Simple LRU: track access order, evict oldest when cache exceeds budget
const MAX_CACHED_SECTORS = 100;

if (this.sectorCache.size > MAX_CACHED_SECTORS) {
  const oldest = this.sectorCache.keys().next().value;
  this.sectorCache.delete(oldest);
}
```

(JavaScript `Map` preserves insertion order, so the first key is the oldest.)

---

## 7. Star Density by Region (Real Numbers)

### Milky Way Reference Values

| Region | Distance from Center | Stellar Density | Notes |
|--------|---------------------|-----------------|-------|
| Galactic center | < 1 pc | ~10^6 stars/pc^3 | Extreme, not game-relevant |
| Inner bulge | ~100 pc | ~100 stars/pc^3 | Very dense |
| Outer bulge | ~1 kpc | ~10 stars/pc^3 | Still dense |
| Solar neighborhood (disk) | ~8 kpc | ~0.14 stars/pc^3 | "Normal" space |
| Spiral arm (disk) | varies | ~0.2-0.3 stars/pc^3 | ~2x inter-arm |
| Inter-arm (disk) | varies | ~0.1 stars/pc^3 | Sparse |
| Thick disk | same R, higher z | ~0.01 stars/pc^3 | Much thinner population |
| Stellar halo | ~20-50 kpc | ~0.0001 stars/pc^3 | Very sparse |
| Outer halo | ~100 kpc | ~10^-6 stars/pc^3 | Almost empty |

### Converting to Game-Useful Numbers

**Example: 100 ly x 100 ly x 100 ly sectors**

1 parsec = 3.26 light-years, so 100 ly = 30.7 pc. A sector volume = 30.7^3 = ~28,900 pc^3.

| Region | Density (stars/pc^3) | Stars per (100 ly)^3 sector |
|--------|---------------------|----------------------------|
| Solar-like disk | 0.14 | ~4,050 |
| Spiral arm | 0.25 | ~7,200 |
| Inter-arm | 0.08 | ~2,300 |
| Outer disk | 0.02 | ~580 |
| Bulge | 10 | ~289,000 |
| Halo | 0.0001 | ~3 |

**For a game**, you probably don't want 4,000 full star systems per sector. Options:
- **Only generate "notable" systems**: 10-50 per sector, representing the ones worth visiting
- **Two-tier system**: A few fully-generated systems + thousands of particle-rendered background stars
- **Scale down uniformly**: Decide your total galaxy should have, say, 100,000 visitable systems, then set density accordingly

### Recommended Game Scale for Well Dipper

Given Well Dipper's aesthetic (meditative, drifting between systems), you probably want:
- **~5,000 to 50,000 total visitable systems** (enough to feel vast, not so many they're meaningless)
- **Sectors of ~50 ly**: Gives 5-20 systems per sector in disk regions
- **Galaxy radius ~500 ly** (compressed -- real Milky Way is 50,000 ly radius, but gameplay doesn't need that scale)
- **OR** keep "real" scale but only populate ~1 in 100 potential star locations as visitable

---

## 8. Spiral Arm Placement (Combining Everything)

Here's a complete approach for placing stars that form visible spiral arms:

```javascript
function generateGalaxyStars(galaxySeed, totalStars, params) {
  const rng = alea(galaxySeed);

  const {
    numArms = 4,
    pitchAngle = 12,       // degrees
    galaxyRadius = 1.0,    // normalized
    bulgeRadius = 0.15,    // fraction of galaxy radius
    diskScaleLength = 0.3, // fraction of galaxy radius
    diskScaleHeight = 0.02,
    armWidth = 0.05,       // spread around arm centerline
    bulgeFraction = 0.15,
    haloFraction = 0.02,
  } = params;

  const stars = [];
  const b = Math.tan(pitchAngle * Math.PI / 180);

  for (let i = 0; i < totalStars; i++) {
    let x, y, z, component;
    const roll = rng();

    if (roll < bulgeFraction) {
      // BULGE: Hernquist profile, spherical
      component = 'bulge';
      const u = rng();
      const sqrtU = Math.sqrt(u);
      const r = bulgeRadius * sqrtU / (1 - sqrtU + 0.01);
      const clampedR = Math.min(r, bulgeRadius * 3);
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      x = clampedR * Math.sin(phi) * Math.cos(theta);
      y = clampedR * Math.sin(phi) * Math.sin(theta);
      z = clampedR * Math.cos(phi);

    } else if (roll < bulgeFraction + haloFraction) {
      // HALO: Power-law sphere
      component = 'halo';
      const u = rng();
      const alpha = 3.0;
      const rMin = bulgeRadius;
      const rMax = galaxyRadius * 1.5;
      const p = 3 - alpha; // = 0 for alpha=3
      const r = rMin * Math.exp(u * Math.log(rMax / rMin)); // log-uniform for alpha=3
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      x = r * Math.sin(phi) * Math.cos(theta);
      y = r * Math.sin(phi) * Math.sin(theta);
      z = r * Math.cos(phi);

    } else {
      // DISK: Exponential radial, assign to nearest arm with scatter
      component = 'disk';

      // Sample radius from exponential distribution
      const maxCDF = 1 - Math.exp(-galaxyRadius / diskScaleLength);
      const R = -diskScaleLength * Math.log(1 - rng() * maxCDF);

      // Determine angle: find arm centerline, add scatter
      const armIndex = Math.floor(rng() * numArms);
      const armAngle = (1 / b) * Math.log(R / 0.01 + 1); // log spiral
      const baseAngle = armAngle + (armIndex * 2 * Math.PI / numArms);

      // Gaussian scatter around arm (tighter = more defined arms)
      // Box-Muller transform for normal distribution
      const u1 = rng();
      const u2 = rng();
      const scatter = armWidth * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

      const theta = baseAngle + scatter;
      x = R * Math.cos(theta);
      y = R * Math.sin(theta);

      // Height: exponential falloff
      const zSign = rng() < 0.5 ? -1 : 1;
      z = zSign * diskScaleHeight * (-Math.log(1 - rng()));
    }

    stars.push({ x, y, z, component, seed: hashSeed(galaxySeed, i) });
  }

  return stars;
}
```

---

## Sources

### Galaxy Generation Tutorials and Implementations
- [Procedural Generation For Dummies: Galaxy Generation](https://martindevans.me/game-development/2016/01/14/Procedural-Generation-For-Dummies-Galaxies/)
- [Ysaneya Galaxy Generation (Infinity Engine)](https://www.gamedev.net/blogs/entry/1952708-galaxy-generation/)
- [Beltoforion: Rendering a Galaxy with Density Wave Theory](https://beltoforion.de/en/spiral_galaxy_renderer/)
- [Beltoforion Galaxy Renderer TypeScript (GitHub)](https://github.com/beltoforion/Galaxy-Renderer-Typescript)
- [Beltoforion Galaxy Renderer C++ (GitHub)](https://github.com/beltoforion/Galaxy-Renderer)
- [Galaxy Voyager (Three.js + React Three Fiber)](https://discourse.threejs.org/t/galaxy-voyager-a-procedural-galaxy-explorer-with-220-star-systems-built-with-react-three-fiber-post-processing/86659)

### No Man's Sky
- [Procedural Generation - NMS Wiki](https://nomanssky.fandom.com/wiki/Procedural_generation)
- [Galaxy - NMS Wiki](https://nomanssky.fandom.com/wiki/Galaxy)
- [Region - NMS Miraheze Wiki](https://nomanssky.miraheze.org/wiki/Region)
- [Universe - NMS Miraheze Wiki](https://nomanssky.miraheze.org/wiki/Universe)
- [The Algorithms of No Man's Sky (Rambus)](https://www.rambus.com/blogs/the-algorithms-of-no-mans-sky-2/)

### Elite Dangerous
- [Stellar Forge Wiki](https://elite-dangerous.fandom.com/wiki/Stellar_Forge)
- [Generating The Universe in Elite: Dangerous (80.lv)](https://80.lv/articles/generating-the-universe-in-elite-dangerous)
- [Myth Busting on Stellar Forge (Frontier Forums)](https://forums.frontier.co.uk/threads/myth-busting-on-stellar-forge-and-the-generation-of-everything-from-stars-to-rocks.517029/)
- [Elite Dangerous Astrometrics](https://edastro.com/mapcharts/distribution.html)

### Space Engine
- [Procedural Galaxies Blog (2012)](https://spaceengine.org/news/blog120306)
- [0.991 Universe Generation Update](https://spaceengine.org/news/blog251118)
- [0.991 Overview](https://spaceengine.org/news/blog250911)
- [Procedural Generation Wiki](https://spaceengine.fandom.com/wiki/Procedural_Generation)

### Astrophysics Reference
- [Stellar Density (Wikipedia)](https://en.wikipedia.org/wiki/Stellar_density)
- [De Vaucouleurs' Law (Wikipedia)](https://en.wikipedia.org/wiki/De_Vaucouleurs's_law)
- [Sersic Profile (Wikipedia)](https://en.wikipedia.org/wiki/Sersic_profile)
- [Milky Way (Wikipedia)](https://en.wikipedia.org/wiki/Milky_Way)
- [Stellar Populations (UOregon)](http://abyss.uoregon.edu/~js/ast122/lectures/lec26.html)
- [Local Galactic Disk Density (Astrophysics Spectator)](https://astrophysicsspectator.org/topics/milkyway/MilkyWayLocalDensity.html)
- [Thick Disk (Wikipedia)](https://en.wikipedia.org/wiki/Thick_disk)
- [Thin Disk (Wikipedia)](https://en.wikipedia.org/wiki/Thin_disk)
