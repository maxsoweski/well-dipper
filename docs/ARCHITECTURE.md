# Well Dipper — Generation & Rendering Architecture

## The Pipeline: Gravity → Stars → Display

Everything flows downward from the gravitational potential model.
No layer generates data independently — each reads from the layer above.

```
LAYER 0: GRAVITATIONAL POTENTIAL (source of truth)
│
│  GalacticMap.gravitationalPotential(R, z)
│  ├── Miyamoto-Nagai thin disk potential
│  ├── Miyamoto-Nagai thick disk potential
│  ├── Hernquist bulge potential
│  └── NFW dark matter halo potential
│
├──→ potentialDerivedDensity(R, z)          ← analytical density from Φ
│    Returns: { thin, thick, bulge, halo, totalDensity }
│    (component fractions = what KIND of stars live here)
│
├──→ spiralArmStrength(R, theta)           ← arm modulation
│    Returns: 0–1 (how close to a spiral arm center)
│    Uses: ARM_DEFS (6 arms: offsets, widths, density boosts)
│
├──→ nearestArmInfo(R, theta)              ← which arm, major/minor
│    Returns: { armName, isMajor, strength }
│
└──→ escapeVelocity(R, z)                 ← gameplay: warp cost
```

```
LAYER 1: GALACTIC FEATURES (positioned from density)
│
│  GalacticMap.findNearbyFeatures(pos, radius)
│  Types: emission nebula, dark nebula, planetary nebula,
│         supernova remnant, open cluster, globular cluster, OB association
│  + RealFeatureCatalog (152 real globular clusters from Harris catalog)
│
│  Feature DENSITY derived from Layer 0:
│    Emission nebulae → where thin disk + arm strength high
│    Globular clusters → where halo density high (spherical distribution)
│    Open clusters → where arm strength high
│
└──→ Features modify local star density via Plummer profiles
```

```
LAYER 2: STAR PLACEMENT (hash grid — the actual stars)
│
│  HashGridStarfield.generate(galacticMap, playerPos)
│  7 spectral tiers: O, B, A, F, G, K, M (+ 3 evolved: Kg, Gg, Mg)
│  Each tier has its own grid cell size (O=74pc, M=1.1pc)
│
│  PER-CELL ACCEPTANCE driven by Layer 0 + Layer 1:
│  ┌─────────────────────────────────────────────────────────┐
│  │ densities = potentialDerivedDensity(R, z)               │
│  │ armStr    = spiralArmStrength(R, theta)                 │
│  │ armInfo   = nearestArmInfo(R, theta)                    │
│  │                                                         │
│  │ typeMultiplier = starTypeDensityMultiplier(              │
│  │   type, densities, armStr, armInfo)                     │
│  │                                                         │
│  │ This blends component weights by position:              │
│  │   thin disk (young) → O/B present, boosted in arms     │
│  │   thick disk (old)  → no O/B, mostly K/M               │
│  │   bulge (old/dense) → few O/B, mostly K/M              │
│  │   halo (ancient)    → no O/B/A, only F/G/K/M           │
│  │                                                         │
│  │ totalDensity = baseDensity × typeMultiplier             │
│  │             + featureDensity (Plummer wells)            │
│  │                                                         │
│  │ acceptProb = totalDensity × acceptNorm                  │
│  │ if (hash < acceptProb) → star exists                   │
│  └─────────────────────────────────────────────────────────┘
│
│  Result: O/B concentrate in arms (5:1), K/M uniform (1:1)
│  Total count contrast: ~1.3:1 (realistic)
│  Luminosity contrast: ~5:1 (realistic)
│
└──→ Each star has: position, seed, spectral type, apparent magnitude
```

```
LAYER 3: STAR SYSTEM GENERATION (when player visits a star)
│
│  StarSystemGenerator.generate(seed, galaxyContext)
│  galaxyContext from GalacticMap.deriveGalaxyContext(position):
│    ├── component (thin/thick/bulge/halo)
│    ├── metallicity (from component + R + z)
│    ├── age (from component + arm strength)
│    ├── starWeights (from _deriveStarWeights — same physics as Layer 2)
│    └── binaryModifier
│
│  PhysicsEngine processes each body:
│    atmosphere, tides, composition, habitability, rings, belts...
│    All driven by star properties + orbital mechanics
│
└──→ System data: star(s), planets, moons, belts, rings
```

```
LAYER 4: RENDERING (display systems — read-only consumers)
│
│  All renderers READ from Layers 0–3. None generate data independently.
│
│  ┌─ SKY ──────────────────────────────────────────────────┐
│  │ SkyRenderer (coordinator)                               │
│  │ ├── StarfieldLayer  ← reads Layer 2 star positions      │
│  │ ├── GalaxyGlowLayer ← reads Layer 0 density + arms     │
│  │ └── SkyFeatureLayer ← reads Layer 1 feature positions   │
│  └─────────────────────────────────────────────────────────┘
│
│  ┌─ SYSTEM OBJECTS ───────────────────────────────────────┐
│  │ StarRenderer    ← reads Layer 3 star data               │
│  │ BodyRenderer    ← reads Layer 3 planet/moon data        │
│  │ RingRenderer    ← reads Layer 3 ring physics            │
│  │ AsteroidBelt    ← reads Layer 3 belt composition        │
│  │ LODManager      ← reads camera distance, selects detail │
│  └─────────────────────────────────────────────────────────┘
│
│  ┌─ UI / NAV ─────────────────────────────────────────────┐
│  │ NavComputer     ← reads Layers 0-2 (density, sectors,   │
│  │                    star positions, arm structure)        │
│  │ Galaxy image    ← from density queries or exported PNG   │
│  │ Debug HUD       ← reads all layers for display          │
│  └─────────────────────────────────────────────────────────┘
│
│  ┌─ EFFECTS ──────────────────────────────────────────────┐
│  │ WarpEffect      ← visual only, no generation            │
│  │ RetroRenderer   ← post-processing (dither, composite)   │
│  └─────────────────────────────────────────────────────────┘
```

```
TOOLS (offline, not runtime)
│
│  Galaxy Model Viewer (galaxy-viewer.html)
│  ├── MilkyWayModel.js  ← samples Layer 0 density for particles
│  ├── MilkyWay.js       ← renders particles + glow + dust
│  └── Export Nav Map    ← orthographic capture for NavComputer
│
│  generate-galaxy-map.mjs  ← debug visualization scripts
```

## Key Principle

**The gravitational potential is the single source of truth.**

- Where stars are → derived from potential
- What type of stars → derived from component fractions (which come from potential)
- How many O/B vs K/M → driven by component + arm strength (from potential)
- Feature placement → driven by density (from potential)
- Visual brightness contrast → emerges naturally from per-type density

No rendering layer should define its own density model, arm structure,
or star type distributions. If a display doesn't match the generation,
the fix is to make the display read from the generation — never to add
independent parameters to the display.
