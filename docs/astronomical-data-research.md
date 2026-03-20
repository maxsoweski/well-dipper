# Astronomical Data Integration Research for Well Dipper

Research conducted 2026-03-19. Covers real astronomical catalogs, data formats, access methods, recent science, and practical integration strategies for a JavaScript/Three.js procedural galaxy game.

---

## Table of Contents
1. [Star Catalogs](#1-star-catalogs)
2. [Globular Clusters](#2-globular-clusters)
3. [Open Clusters](#3-open-clusters)
4. [Nebulae](#4-nebulae)
5. [Supernova Remnants](#5-supernova-remnants)
6. [Planetary Nebulae](#6-planetary-nebulae)
7. [Combined / Pre-Packaged Data](#7-combined--pre-packaged-data)
8. [Data Formats and Integration Strategy](#8-data-formats-and-integration-strategy)
9. [Querying Services (VizieR, SIMBAD, Gaia Archive)](#9-querying-services)
10. [Recent Gravitational and Structural Research](#10-recent-gravitational-and-structural-research)
11. [JWST Discoveries (2022-2026)](#11-jwst-discoveries-2022-2026)
12. [Data Budget Estimate](#12-data-budget-estimate)
13. [Recommended Implementation Order](#13-recommended-implementation-order)

---

## 1. Star Catalogs

### HYG Database v4.2 (BEST STARTING POINT)
- **What:** Merges Hipparcos, Yale Bright Star, and Gliese catalogs into one CSV
- **Count:** ~120,000 stars
- **Size:** ~14 MB (CSV), compresses to ~3-4 MB gzipped
- **License:** CC BY-SA 4.0
- **Format:** CSV with headers
- **Download:** https://github.com/astronexus/HYG-Database (also on Codeberg)
- **Key fields:**
  - `id` - HYG catalog ID
  - `proper` - common name ("Sirius", "Betelgeuse", etc.)
  - `ra`, `dec` - right ascension, declination (J2000 epoch)
  - `mag` - apparent visual magnitude
  - `absmag` - absolute magnitude
  - `spect` - spectral type (e.g., "G2V" for our Sun)
  - `ci` - color index (B-V) -- maps directly to star color
  - `x`, `y`, `z` - Cartesian coordinates in parsecs (Sun at origin)
  - `vx`, `vy`, `vz` - velocity components
  - `dist` - distance in parsecs
  - `hr` - Harvard Revised / Yale Bright Star number
  - `hip` - Hipparcos catalog ID
  - `bf` - Bayer/Flamsteed designation (e.g., "Alp CMa" for Sirius)
- **Why it's ideal:** Already has x,y,z positions in parsecs. No coordinate conversion needed. CSV loads trivially in JS. 120K stars is enough for a rich galaxy without killing performance.

### Yale Bright Star Catalog (BSC5)
- **What:** 9,110 stars visible to the naked eye
- **Already included in HYG** -- no need to download separately
- **Useful for:** filtering "named" / "important" stars (those with `hr` field in HYG)

### Hipparcos (reprocessed 2007)
- **What:** ~118,218 stars with high-precision astrometry
- **Already included in HYG** -- the Hipparcos IDs are in the `hip` field
- **Original data:** https://www.cosmos.esa.int/web/hipparcos/hipparcos-2
- **Also on Kaggle:** https://www.kaggle.com/datasets/konivat/hipparcos-star-catalog

### Gaia DR3 (2022)
- **What:** 1.8 billion stars. The most comprehensive star survey ever.
- **Too big for a game:** Full catalog is ~1 TB. Not practical to ship.
- **Useful subset:** ESA provides a "mini" subset of 100,000 bright stars for testing
- **How to get a custom subset:** Use the Gaia Archive ADQL query interface
  - URL: https://gea.esac.esa.int/archive/
  - Example query for the 100K brightest stars:
    ```sql
    SELECT TOP 100000
      source_id, ra, dec, l, b,
      parallax, phot_g_mean_mag,
      phot_bp_mean_mag, phot_rp_mean_mag,
      bp_rp, distance_gspphot, teff_gspphot
    FROM gaiadr3.gaia_source
    WHERE phot_g_mean_mag IS NOT NULL
      AND parallax IS NOT NULL
      AND parallax > 0
    ORDER BY phot_g_mean_mag ASC
    ```
  - Fields: `l`, `b` = galactic longitude/latitude; `parallax` = 1/distance(parsec); `phot_g_mean_mag` = G-band magnitude; `bp_rp` = color; `teff_gspphot` = effective temperature; `distance_gspphot` = estimated distance
  - Output formats: CSV, VOTable, FITS
  - The query runs on ESA servers, results download as a file
- **Recommendation:** Use HYG as the base. Optionally supplement with a Gaia query for fainter stars in specific regions if needed.

### SIMBAD
- **What:** Not a catalog but a database aggregator. 17+ million objects.
- **How to query:** REST API with cone search (search by position + radius)
  - URL: `https://simbad.cds.unistra.fr/cone/?RA=1.23&DEC=4.56&SR=0.1&RESPONSEFORMAT=json`
  - Also supports TAP/ADQL for complex queries
- **Useful for:** Looking up individual objects, cross-referencing IDs
- **Not practical for:** Bulk download for a game. Use the dedicated catalogs instead.

---

## 2. Globular Clusters

### Harris Catalog (2010 edition)
- **What:** THE standard catalog of Milky Way globular clusters
- **Count:** 157 objects
- **Format:** Fixed-width ASCII text (three separate data tables)
- **Download:** http://physwww.mcmaster.ca/~harris/mwgc.dat
- **Documentation:** http://physwww.mcmaster.ca/~harris/mwgc.ref
- **Also on HEASARC:** https://heasarc.gsfc.nasa.gov/w3browse/all/globclust.html (FITS/ASCII/web table)
- **Also on VizieR:** Catalog VII/202
- **Key fields (3 parts):**
  - Part I: Name, RA, Dec, galactic l, b, distance from Sun (kpc), distance from galactic center
  - Part II: Metallicity [Fe/H], integrated V magnitude, color (B-V), spectral type
  - Part III: Radial velocity, velocity dispersion, core radius, half-light radius, tidal radius, concentration
- **Size:** Tiny. The whole thing is a few KB of text.
- **Conversion needed:** Fixed-width text to JSON. Simple Python/Node script.

### Gaia-era updates
- Baumgardt & Vasiliev (2021) used Gaia EDR3 to refine distances and proper motions for all Harris clusters. Available on VizieR.
- Vasiliev & Baumgardt (2021) provided updated mass estimates.

---

## 3. Open Clusters

### Cantat-Gaudin et al. (2020) + Hunt & Reffert (2023)
- **What:** Comprehensive open cluster catalogs from Gaia data
- **Count:** ~2,000 (Cantat-Gaudin 2020), ~7,000+ (Hunt & Reffert 2023 with Gaia DR3)
- **Publication:** "Improving the open cluster census" (A&A, 2023)
- **Data access:** VizieR (search for "Cantat-Gaudin open cluster" or "Hunt Reffert 2023")
- **Key fields:** Cluster name, RA, Dec, galactic l/b, distance, age, metallicity, number of member stars, proper motions
- **Format:** VOTable/CSV via VizieR
- **Practical subset:** ~3,500 well-characterized clusters is a reasonable number. A few KB of JSON.

---

## 4. Nebulae

### Sharpless Catalog (SH2) -- HII Regions
- **What:** 313 HII (ionized hydrogen) emission regions. The bright pink/red nebulae.
- **Access:** HEASARC: https://heasarc.gsfc.nasa.gov/W3Browse/all/hiiregion.html
- **Also on VizieR:** Catalog VII/20
- **Key fields:** Galactic l, b, angular diameter (arcmin), form (circular/elliptical/irregular), brightness (1-3 scale), number of associated stars
- **Missing:** Distances are NOT in the original catalog. Must be cross-referenced with other sources.
- **Size:** Tiny (313 entries).

### NGC/IC Catalogs -- via OpenNGC
- **What:** ~13,000+ objects (galaxies, nebulae, clusters -- mixed types)
- **License:** CC BY-SA 4.0
- **Download:** https://github.com/mattiaverga/OpenNGC
- **Format:** CSV
- **Key fields:** Name, type (galaxy, nebula, cluster, etc.), RA, Dec, major/minor axis, magnitude, surface brightness, Messier number, constellation
- **Object types coded as:** G (galaxy), GGroup, GPair, GTrpl, *Ass (stellar association), OCl (open cluster), GCl (globular cluster), Neb (nebula), HII, SNR, PN (planetary nebula)
- **Also includes:** Outlines of prominent nebulae as polygon data
- **Size:** ~2 MB CSV

### Messier Catalog
- **What:** 110 famous objects (subset of NGC/IC)
- **Included in OpenNGC** (has Messier cross-references)
- **Also available as standalone CSV:** https://github.com/7468696e6b/fourmilab-hplanet/blob/master/Messier.csv

### Lynds Dark Nebula Catalog (LDN)
- **What:** 1,802 dark nebulae (cold dust clouds that block light)
- **Access:** HEASARC: https://heasarc.gsfc.nasa.gov/W3Browse/nebula-catalog/ldn.html
- **Also on VizieR:** Catalog VII/7A
- **Key fields:** RA, Dec, galactic l, b, cloud area (square degrees), opacity (1-6 scale)
- **Missing:** Distances not in original catalog. Some have been estimated in follow-up papers.
- **Size:** Tiny (~1,800 entries)
- **Game use:** These are important for visual realism -- dark lanes and dust clouds that obscure the galactic plane.

---

## 5. Supernova Remnants

### Green's SNR Catalog (Oct 2024 edition)
- **What:** The standard catalog of galactic supernova remnants
- **Count:** 310 SNRs (updated October 2024)
- **Download:** https://www.mrao.cam.ac.uk/surveys/snrs/
- **Also on VizieR:** Catalog VII/297
- **Format:** ASCII text / HTML tables
- **Key fields:** Galactic l, b (coordinates), RA, Dec (J2000), angular size, type (S=shell, F=filled/plerion, C=composite), flux density at 1 GHz, spectral index, other names
- **Size:** Tiny (310 entries)

---

## 6. Planetary Nebulae

### HASH Database
- **What:** The most comprehensive PN catalog: 3,500+ confirmed + candidates
- **Access:** https://hashpn.space (requires free registration)
- **Format:** MySQL-backed, queryable web interface. Can export results.
- **Key fields:** Name, RA, Dec, galactic l/b, angular size, central star info, status (true/likely/possible PN)
- **Caveat:** Registration required. Not a simple download.
- **Alternative:** The Strasbourg-ESO catalogue of Galactic PNe is on VizieR (Catalog V/84) with ~1,500 PNe and is freely downloadable.
- **Also:** OpenNGC includes PNe that are in NGC/IC (about 100+ of the most famous ones).

---

## 7. Combined / Pre-Packaged Data (GOLDMINE for a JS game)

### d3-celestial by Olaf Frohn
- **URL:** https://github.com/ofrohn/d3-celestial
- **What:** A complete set of astronomical data ALREADY IN GeoJSON format, ready for web use.
- **This is the single most useful resource for Well Dipper.**
- **Data files in `/data/` directory:**
  - `stars.6.json` -- stars to magnitude 6 (~9,000 brightest stars)
  - `stars.8.json` -- stars to magnitude 8 (~40,000 stars)
  - `stars.14.json` -- stars to magnitude 14 (~110,000 stars)
  - `dsos.bright.json` -- bright deep sky objects (nebulae, clusters, galaxies)
  - `dsos.6.json` -- DSOs to magnitude 6
  - `dsos.14.json` -- all DSOs to magnitude 14
  - `mw.json` -- Milky Way band outline (multi-polygon)
  - `constellations.json` -- constellation boundaries
  - `starnames.json` -- proper names for stars
- **DSO types included:** Galaxy clusters (gg), galaxies (g, s, s0, sd, i, e), open clusters (oc), globular clusters (gc), dark nebulae (dn), bright nebulae (bn), star-forming regions (sfr), reflection nebulae (rn), emission nebulae (en), planetary nebulae (pn), supernova remnants (snr)
- **Format:** GeoJSON with coordinates in RA/Dec degrees
- **License:** BSD-3-Clause
- **Why it's great:** Already JSON. Already categorized by type. Already has magnitudes and colors. Can be loaded directly in JS. Includes practically every object type Well Dipper needs.
- **Caveat:** Coordinates are in RA/Dec (equatorial), not galactic. Need a coordinate transform (simple math -- see section 8).

### Datastro NGC/IC/Messier Combined
- **URL:** https://data.opendatasoft.com/explore/dataset/ngc-ic-messier-catalog@datastro/
- **Format:** JSON and CSV direct download
- **What:** Combined NGC + IC + Messier with coordinates, types, magnitudes

---

## 8. Data Formats and Integration Strategy

### Format Overview
| Source | Native Format | JS-Friendly? | Conversion Needed |
|--------|--------------|--------------|-------------------|
| HYG Database | CSV | Yes (Papa Parse) | Minimal -- already has x,y,z |
| d3-celestial | GeoJSON | YES -- native JS | Coordinate transform only |
| Harris Globular | Fixed-width ASCII | No | Parse script needed |
| OpenNGC | CSV | Yes | Parse + coordinate transform |
| Green's SNR | ASCII/HTML | No | Parse script needed |
| Sharpless SH2 | ASCII | No | Parse script needed |
| LDN | ASCII | No | Parse script needed |
| VizieR queries | VOTable/CSV | CSV yes | None if CSV |
| Gaia Archive | ECSV/CSV | CSV yes | Coordinate transform |

### Coordinate Conversions

**Equatorial (RA, Dec) to Galactic (l, b):**
```javascript
// RA in degrees, Dec in degrees -> galactic l, b in degrees
function equatorialToGalactic(ra, dec) {
  const raRad = ra * Math.PI / 180;
  const decRad = dec * Math.PI / 180;

  // North galactic pole (J2000): RA = 192.85948, Dec = 27.12825
  const ra_ngp = 192.85948 * Math.PI / 180;
  const dec_ngp = 27.12825 * Math.PI / 180;
  const l_ncp = 122.93192 * Math.PI / 180; // ascending node

  const sinB = Math.sin(dec_ngp) * Math.sin(decRad) +
               Math.cos(dec_ngp) * Math.cos(decRad) * Math.cos(raRad - ra_ngp);
  const b = Math.asin(sinB);

  const cosB = Math.cos(b);
  const sinLminusLncp = Math.cos(decRad) * Math.sin(raRad - ra_ngp) / cosB;
  const cosLminusLncp = (Math.cos(dec_ngp) * Math.sin(decRad) -
                          Math.sin(dec_ngp) * Math.cos(decRad) * Math.cos(raRad - ra_ngp)) / cosB;

  let l = l_ncp - Math.atan2(sinLminusLncp, cosLminusLncp);
  if (l < 0) l += 2 * Math.PI;
  if (l > 2 * Math.PI) l -= 2 * Math.PI;

  return { l: l * 180 / Math.PI, b: b * 180 / Math.PI };
}
```

**Galactic (l, b, distance) to Cartesian (x, y, z) for the game:**
```javascript
// l, b in degrees, dist in parsecs (or kpc)
// Returns position relative to galactic center
// Sun is at x=8.178 kpc from center (IAU 2022 value)
function galacticToCartesian(l, b, dist) {
  const lRad = l * Math.PI / 180;
  const bRad = b * Math.PI / 180;
  const R_sun = 8.178; // kpc, Sun's distance from galactic center

  // Position relative to Sun
  const xSun = dist * Math.cos(bRad) * Math.cos(lRad);
  const ySun = dist * Math.cos(bRad) * Math.sin(lRad);
  const zSun = dist * Math.sin(bRad);

  // Convert to galactocentric (Sun on -x axis in standard convention)
  return {
    x: R_sun - xSun,  // toward galactic center is +x
    y: ySun,
    z: zSun
  };
}
```

**Parallax to distance:**
```javascript
// Gaia parallax is in milliarcseconds
function parallaxToDistance(parallax_mas) {
  return 1000 / parallax_mas; // returns distance in parsecs
}
```

### Loading CSV in JavaScript
```javascript
// Option 1: Papa Parse (npm install papaparse)
import Papa from 'papaparse';
const response = await fetch('/data/hyg_v42.csv');
const text = await response.text();
const { data } = Papa.parse(text, { header: true, dynamicTyping: true });

// Option 2: Manual (no dependency, for simple CSVs)
const lines = text.split('\n');
const headers = lines[0].split(',');
const stars = lines.slice(1).map(line => {
  const vals = line.split(',');
  return Object.fromEntries(headers.map((h, i) => [h, vals[i]]));
});
```

---

## 9. Querying Services

### VizieR (CDS Strasbourg)
- **URL:** https://vizier.cds.unistra.fr
- **What:** Hosts 23,000+ astronomical catalogs. The "catalog store" of astronomy.
- **How to use for Well Dipper:**
  1. Go to https://vizier.cds.unistra.fr
  2. Search for a catalog (e.g., "Harris globular cluster" or "VII/202")
  3. Select output format: "semicolon-separated values" or "tab-separated values"
  4. Download the result
  5. Convert to JSON with a script
- **TAP endpoint:** `https://tapvizier.cds.unistra.fr/TAPVizieR/tap` -- supports ADQL queries
- **Cone search:** `https://vizier.cds.unistra.fr/viz-bin/conesearch/{catalog}?RA=...&DEC=...&SR=...`
- **Best used for:** Grabbing specific catalogs in a downloadable format, one-time data prep

### SIMBAD
- **URL:** https://simbad.cds.unistra.fr
- **Cone search with JSON:** `https://simbad.cds.unistra.fr/cone/?RA=83.82&DEC=-5.39&SR=1&RESPONSEFORMAT=json`
- **TAP endpoint:** `https://simbad.cds.unistra.fr/simbad/sim-tap`
- **Best used for:** Cross-referencing, looking up individual objects by name

### Gaia Archive
- **URL:** https://gea.esac.esa.int/archive/
- **Best used for:** Custom star queries with magnitude/distance/color filters
- **Output:** CSV, VOTable, FITS
- **Rate limits:** Large queries queue on ESA servers; results available for download when complete

---

## 10. Recent Gravitational and Structural Research

### Milky Way Mass
- **Best estimate (2019, Hubble+Gaia):** ~1.5 trillion solar masses within 129,000 light-years of center
- **Recent revision (2025):** Total stellar mass revised DOWN to ~2.6 x 10^10 solar masses (half of previous estimates). Most mass is dark matter.
- **Virial mass from circular velocity (Gaia DR3, 2023):** ~1.81 x 10^11 solar masses (lower than older estimates)
- **For the game:** Total mass ~1-1.5 trillion solar masses. Stars are only ~2-3% of that.

### Dark Matter Distribution
- **Classic NFW profile parameters for MW:**
  - Scale radius: ~8.1 +/- 0.7 kpc
  - Local DM density (at Sun): ~0.47 +/- 0.05 GeV/cm^3
- **Recent finding:** A cored Einasto profile (slope parameter ~0.91) fits Gaia DR3 data better than pure NFW
- **For the game:** NFW is still fine for procedural generation. The density profile shapes where mass is concentrated:
  ```
  rho(r) = rho_0 / ((r/r_s) * (1 + r/r_s)^2)
  ```
  where r_s ~ 8 kpc (scale radius) and r is distance from center.

### Milky Way Bar Structure
- **What:** The galactic center has a bar-shaped stellar overdensity, not just a spherical bulge
- **Bar half-length:** ~4-5 kpc
- **Bar angle:** ~25-30 degrees from Sun-galactic center line (the bar's near end is in galactic quadrant I, roughly toward l ~ 25-30 degrees)
- **Pattern speed:** The bar rotates as a rigid body at ~38-42 km/s/kpc
- **Gaia contribution (2024):** First direct kinematic mapping of bar stars using long-period variable stars as tracers. Confirmed the bar's rotation and extent.
- **For the game:** The bar should be modeled as an elongated ellipsoidal stellar overdensity in the central ~5 kpc, tilted ~27 degrees.

### Spiral Arm Structure
- **Number of arms:** Current best model: 2 major arms (Perseus and Norma/Outer) + 5 minor/spur arms
  - **Major arms:** Perseus, Norma (also called Norma-Outer or 3kpc arm)
  - **Minor arms:** Sagittarius-Carina, Scutum-Centaurus, Local (Orion Spur), plus outer segments
- **The Local Arm (where the Sun lives):** Now known to be ~25,000-26,000 light-years long. Not a small spur -- it's a substantial arm segment.
- **Arm positions from BeSSeL survey (maser parallaxes):**
  - Sun position: R = 8.178 kpc from center (IAU value)
  - Perseus arm: ~2 kpc outside Sun's orbit
  - Sagittarius arm: ~1.5 kpc inside Sun's orbit
  - Scutum-Centaurus: ~4 kpc inside Sun's orbit
  - Norma: ~5.5 kpc inside Sun's orbit
- **Logarithmic spiral model:** Each arm follows `r = r_0 * e^(theta * tan(pitch_angle))`
  - Pitch angles: ~12-14 degrees for major arms
- **For the game:** Model as logarithmic spirals with ~12 degree pitch angle, 2 major + 3-4 minor arms.

### Sagittarius A* (Central Black Hole)
- **Mass:** 4.297 +/- 0.012 million solar masses (best current value)
- **Distance:** 8.178 kpc (26,673 light-years) from Sun
- **Schwarzschild radius:** ~12 million km (~0.08 AU)
- **EHT imaging (2022):** First image of Sgr A* shadow, confirming mass and showing accretion disk
- **JWST observations (2025):** Constant stream of flares from the accretion disk, no rest periods. Some flares last seconds, others erupt daily, faint flickers surge for months.
- **For the game:** A special object at the exact center. Mass is important for orbital mechanics near center.

### Fermi Bubbles
- **What:** Two enormous gamma-ray structures extending ~25,000 light-years above and below the galactic plane
- **Shape:** Roughly egg/balloon-shaped, emerging from the galactic center
- **Surrounded by:** Even larger eROSITA X-ray bubbles (~40,000-46,000 light-years tall)
- **Origin (latest model, 2023):** Most likely caused by jet activity from Sgr A* about 5 million years ago. The active black hole model (not starburst) is now favored.
- **For the game:** These are visual features -- massive diffuse structures above/below the disk. Could be rendered as faint volumetric effects.

### Galactic Center Chimneys
- **What:** Two cylindrical X-ray structures extending ~500 light-years above/below the galactic center
- **Shape:** Approximately cylindrical with sharp vertical boundaries
- **Connection:** They connect the immediate galactic center region to the base of the Fermi Bubbles
- **Content:** Multiphase outflow -- hot X-ray gas plus entrained molecular gas
- **Magnetic field:** Embedded in a vertical magnetic field that diverges with increasing latitude
- **For the game:** Smaller-scale features near the galactic center. Could be rendered as narrow glowing columns.

### Galactic Magnetic Field
- **Large-scale structure:** Follows spiral arms, with field reversals between arms
- **Key finding (2024):** First map of magnetic field structures within a spiral arm. Fields in arms are significantly tilted from the galactic average.
- **Topology:** Disk field has spiral pattern (follows arms); halo field has poloidal (vertical) structure
- **Field strength:** ~6 microgauss in the solar neighborhood, stronger toward center
- **For the game:** Not directly visible, but influences dust lane geometry and relativistic jet orientation.

### Galactic Worms and Chimneys (ISM vertical structures)
- **What:** Vertical structures in the interstellar medium created by clustered supernovae
- **Worms:** Sheet-like structures running perpendicular to the galactic plane, formed by break-up of supershells
- **Chimneys:** Well-collimated vertical channels created by clustered supernovae, connecting the disk to the halo
- **Scale:** Individual chimneys span hundreds to thousands of light-years
- **For the game:** These could appear as vertical "cracks" or channels in the dust distribution near active star-forming regions.

---

## 11. JWST Discoveries (2022-2026)

### Relevant to Milky Way structure:
1. **Sgr A* flaring (2025):** The central black hole is constantly active -- no quiet periods. Flares range from faint seconds-long flickers to bright daily eruptions to months-long faint surges. This means the galactic center should always be "active" in the game.

2. **Sagittarius B2 molecular cloud:** JWST revealed the most massive and active star-forming region in the MW in unprecedented detail. Massive stars and glowing cosmic dust.

3. **Milky Way formation history (2025):** Study of 877 "Milky Way twins" at different cosmic times reconstructed how the MW evolved. Key finding: the MW was turbulent and disordered in its youth, only settling into a structured spiral relatively recently.

4. **Early spiral galaxies:** JWST found Milky Way-like spiral structure existing as early as 1.5 billion years after the Big Bang -- much earlier than expected. Challenges models of galaxy evolution.

5. **Building blocks of life in extragalactic ice (2025):** JWST detected 5 complex organic molecules in ice outside the MW for the first time. Not directly relevant to structure but very cool for game lore.

---

## 12. Data Budget Estimate

| Dataset | Object Count | Estimated JSON Size | Priority |
|---------|-------------|-------------------|----------|
| HYG stars (full) | 120,000 | ~8 MB (minified) | HIGH |
| HYG stars (mag < 6 subset) | ~9,000 | ~600 KB | HIGH (start here) |
| d3-celestial stars.8 | ~40,000 | ~3 MB | HIGH (alternative) |
| d3-celestial DSOs (bright) | ~1,500 | ~200 KB | HIGH |
| Harris globular clusters | 157 | ~15 KB | HIGH |
| Open clusters (top 2000) | 2,000 | ~200 KB | MEDIUM |
| OpenNGC (all) | 13,000 | ~1.5 MB | MEDIUM |
| Sharpless HII regions | 313 | ~30 KB | MEDIUM |
| Green's SNRs | 310 | ~30 KB | MEDIUM |
| Lynds dark nebulae | 1,802 | ~150 KB | MEDIUM |
| Planetary nebulae (VizieR) | 1,500 | ~150 KB | LOW |
| Milky Way outline (d3) | 1 polygon | ~50 KB | HIGH |
| **TOTAL (all data)** | | **~14 MB** | |
| **TOTAL (high priority only)** | | **~4-5 MB** | |

All of this compresses well with gzip (text/JSON typically compresses 70-80%), so actual download size would be ~3-4 MB for everything.

---

## 13. Recommended Implementation Order

### Phase A: Foundation (get real data in the game)
1. **Download HYG v4.2 CSV** from GitHub
2. **Download d3-celestial data files** (stars, DSOs, milky way outline)
3. **Write a build-time script** (Node.js) that:
   - Reads HYG CSV
   - Filters to desired magnitude limit
   - Extracts fields: x, y, z, mag, ci (color), spect, proper name
   - Outputs a compact JSON or binary buffer
4. **Load in Three.js** as a PointsMaterial/BufferGeometry (instanced for performance)
5. **Map color index (ci/B-V) to RGB** -- this is how you get real star colors:
   ```
   B-V < -0.33: blue-white (#9bb0ff)
   B-V ~ 0.00: white (#cad7ff)
   B-V ~ 0.30: yellow-white (#f8f7ff)
   B-V ~ 0.60: yellow (#fff4ea) [like the Sun]
   B-V ~ 1.00: orange (#ffd2a1)
   B-V ~ 1.40: red-orange (#ffcc6f)
   B-V > 1.60: red (#ff8a00)
   ```

### Phase B: Deep sky objects
1. **Parse d3-celestial dsos.bright.json** -- already has type codes
2. **Add globular clusters** from Harris catalog (convert fixed-width to JSON)
3. **Add open clusters** from VizieR
4. **Render different object types** with different visual effects (point sprites, halos, colored glows)

### Phase C: Nebulae and structure
1. **Add Sharpless HII regions** as emission nebula locations
2. **Add Lynds dark nebulae** as dust cloud locations
3. **Add SNRs** from Green's catalog
4. **Use the Milky Way outline** from d3-celestial to define the visible band

### Phase D: Galactic structure model
1. **Implement spiral arm model** using logarithmic spirals with real arm positions
2. **Add the galactic bar** as a central ellipsoidal feature
3. **Place Sgr A*** at exact center with appropriate mass
4. **Use real arm positions** to modulate star density (more stars in arms)

### Phase E: Exotic features (stretch goals)
1. **Fermi Bubbles** as volumetric features above/below disk
2. **Galactic center chimneys** as narrow structures near center
3. **Dark matter halo** visualization (optional, for educational/cool factor)

---

## Key URLs Reference

| Resource | URL |
|----------|-----|
| HYG Database | https://github.com/astronexus/HYG-Database |
| d3-celestial (GeoJSON data) | https://github.com/ofrohn/d3-celestial |
| OpenNGC | https://github.com/mattiaverga/OpenNGC |
| Harris Globular Clusters | http://physwww.mcmaster.ca/~harris/mwgc.dat |
| Green's SNR Catalog | https://www.mrao.cam.ac.uk/surveys/snrs/ |
| Gaia Archive | https://gea.esac.esa.int/archive/ |
| VizieR | https://vizier.cds.unistra.fr |
| SIMBAD | https://simbad.cds.unistra.fr |
| HEASARC (NASA catalogs) | https://heasarc.gsfc.nasa.gov/W3Browse/ |
| HASH Planetary Nebulae | https://hashpn.space |
| Sharpless HII (HEASARC) | https://heasarc.gsfc.nasa.gov/W3Browse/all/hiiregion.html |
| Lynds Dark Nebulae (HEASARC) | https://heasarc.gsfc.nasa.gov/W3Browse/nebula-catalog/ldn.html |
| Datastro NGC/IC/Messier | https://data.opendatasoft.com/explore/dataset/ngc-ic-messier-catalog@datastro/ |
