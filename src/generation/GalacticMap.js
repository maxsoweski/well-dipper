import { SeededRandom } from './SeededRandom.js';

/**
 * GalacticMap — the structural/navigational galaxy that the player lives inside.
 *
 * NOT the same as GalaxyGenerator.js, which renders visual galaxy particles
 * for deep-sky objects (what you see when you warp to a distant galaxy).
 * GalacticMap is the galaxy you're IN — it determines where stars are,
 * what properties they have, and what you encounter as you warp around.
 *
 * Architecture:
 *   Master seed → galaxy parameters (arms, bulge, disk)
 *   Galaxy → sectors (0.5 kpc cubes, cached with LRU)
 *   Sector → stars (5-30 per sector, positioned and seeded)
 *   Star → system seed + galaxy context (metallicity, age, star-type weights)
 *
 * The galaxy is deterministic: same master seed → same galaxy, always.
 * Same star at same position → same system, always.
 *
 * Science basis: see docs/RESEARCH_star-population-synthesis.md and
 * docs/RESEARCH_galaxy-generation.md
 *
 * See docs/GAME_BIBLE.md §12 for design context.
 */
export class GalacticMap {

  // ── Galaxy structure constants ──
  // Milky Way-inspired defaults. Could be seed-varied for different galaxies.
  static SECTOR_SIZE = 0.5;           // kpc per sector cube edge
  static MAX_STARS_PER_SECTOR = 30;   // cap for densest regions
  static MAX_CACHED_SECTORS = 64;     // LRU cache size

  // Legacy constants removed: DISK_SCALE_LENGTH, THIN_DISK_HEIGHT,
  // THICK_DISK_HEIGHT, THICK_DISK_NORM, BULGE_SCALE, BULGE_FLATTENING,
  // BULGE_NORM — these were for the old componentDensities() model.
  // All density now derives from potentialDerivedDensity() via MN/Hernquist/NFW.

  // Galactic bar — elongated stellar structure at the center.
  // Modeled as a Dehnen (2000) quadrupolar potential perturbation.
  // The Milky Way's bar is ~4-5 kpc long, oriented ~25-30° from
  // the Sun-center line. It connects the inner ends of the major arms.
  // References: Dehnen 2000, Wegg & Gerhard 2015, Bland-Hawthorn & Gerhard 2016
  static BAR_HALF_LENGTH = 2.2;       // kpc (bar radius R_b in Dehnen model)
  static BAR_HALF_WIDTH = 0.7;        // kpc (used for bar axis ratio)
  static BAR_HALF_HEIGHT = 0.4;       // kpc (vertical scale)
  static BAR_ANGLE_DEG = 28;          // degrees from Sun-center line
  static BAR_AMPLITUDE = 0.005;       // potential perturbation strength (Dehnen model, modest)
  static BAR_DENSITY = 3.0;           // bar's own stellar mass boost relative to bulge

  // Cox & Gomez (2002) spiral arm potential perturbation.
  // Each arm is a separate perturbation term with its own amplitude.
  // The density emerges from the Poisson equation applied to this potential.
  static SPIRAL_SCALE_HEIGHT = 0.18;  // kpc — vertical scale of spiral perturbation
  static SPIRAL_RADIAL_SCALE = 3.5;   // kpc — radial decay length
  static SPIRAL_REF_RADIUS = 4.0;     // kpc — reference radius for log-spiral phase

  // Spiral arms — realistic Milky Way structure
  // 2 major arms (Scutum-Centaurus, Perseus) + minor arms
  // See Churchwell et al. 2009, Vallée 2017
  static ARM_PITCH_DEG = 12;
  // ARM_DENSITY_BOOST is now per-arm (see ARM_DEFS below), but we keep
  // a base value for backward-compat calculations in _generateSector
  static ARM_DENSITY_BOOST = 1.8;

  // Each arm: { name, offset (radians), densityBoost, width (kpc), isMajor }
  // Offsets calibrated so the Sun (R=8, theta=0) falls between Perseus
  // and Sagittarius, near the Orion Spur — matching real Milky Way geometry.
  //
  // Angular offsets at R=4 kpc reference radius:
  //   Scutum-Centaurus: 0°     (major)
  //   Perseus:          180°   (major, wraps behind Sun)
  //   Sagittarius:      ~50°   (minor, inside Sun's orbit)
  //   Norma:            ~230°  (minor)
  //   Outer:            ~140°  (minor, beyond Perseus)
  //   Orion Spur:       local spur near the Sun
  static ARM_DEFS = [
    // ─── Major arms ───
    { name: 'Scutum-Centaurus', offset: 0.0,    densityBoost: 2.5, width: 0.7, isMajor: true },
    { name: 'Perseus',          offset: Math.PI, densityBoost: 2.5, width: 0.7, isMajor: true },
    // ─── Minor arms ───
    { name: 'Sagittarius',  offset: 0.87,           densityBoost: 1.2, width: 0.45, isMajor: false },
    { name: 'Norma',        offset: Math.PI + 0.87,  densityBoost: 1.0, width: 0.40, isMajor: false },
    { name: 'Outer',        offset: Math.PI * 0.78,  densityBoost: 0.8, width: 0.35, isMajor: false },
    // ─── Local spur (Orion Spur) ───
    // Short spur between Perseus and Sagittarius, near the Sun.
    // Lower density than even minor arms, but included for realism.
    { name: 'Orion Spur',   offset: Math.PI * 0.65,  densityBoost: 0.6, width: 0.30, isMajor: false },
  ];

  // Navigable range
  static GALAXY_RADIUS = 15;          // kpc (visible disk)
  static GALAXY_HEIGHT = 3;           // kpc above/below plane

  // Player start (solar neighborhood)
  static SOLAR_R = 8.0;              // kpc from center
  static SOLAR_Z = 0.025;            // kpc above plane

  // ── Component star-type weights (single source of truth) ──
  // Used by both _deriveStarWeights (system generation) and
  // starTypeDensityMultiplier (hash grid per-type density).
  // Each component has a characteristic spectral type mix reflecting its age.
  static COMPONENT_STAR_WEIGHTS = {
    thin:  { O: 0.05,  B: 0.08,  A: 0.13,  F: 0.16, G: 0.20, K: 0.20, M: 0.18 },
    thick: { O: 0,     B: 0,     A: 0.02,  F: 0.10, G: 0.18, K: 0.30, M: 0.40 },
    bulge: { O: 0.005, B: 0.015, A: 0.04,  F: 0.10, G: 0.18, K: 0.28, M: 0.38 },
    halo:  { O: 0,     B: 0,     A: 0,     F: 0.07, G: 0.18, K: 0.30, M: 0.45 },
  };

  constructor(masterSeed = 'well-dipper-galaxy-1') {
    this.masterSeed = masterSeed;
    this.rng = new SeededRandom(masterSeed);

    // Galaxy-level parameters (could be varied per seed for different galaxies)
    this.pitchAngle = GalacticMap.ARM_PITCH_DEG * Math.PI / 180;
    this.pitchK = 1.0 / Math.tan(this.pitchAngle);

    // Build arm data from static definitions + small per-seed jitter
    // so different galaxy seeds get slightly different arm positions.
    this.arms = GalacticMap.ARM_DEFS.map((def, i) => ({
      name: def.name,
      offset: def.offset + this.rng.range(-0.08, 0.08),
      densityBoost: def.densityBoost,
      width: def.width,
      isMajor: def.isMajor,
    }));

    // Legacy compat: numArms = total arm count
    this.numArms = this.arms.length;
    // Legacy compat: flat armOffsets array
    this.armOffsets = this.arms.map(a => a.offset);

    // Galactic bar angle (with per-seed jitter)
    this.barAngle = (GalacticMap.BAR_ANGLE_DEG + this.rng.range(-3, 3)) * Math.PI / 180;
    this.barCosA = Math.cos(this.barAngle);
    this.barSinA = Math.sin(this.barAngle);

    // Pre-compute per-arm spiral potential amplitudes from densityBoost.
    // Major arms (densityBoost 2.5) get the full amplitude; minor arms are proportional.
    const maxBoost = Math.max(...this.arms.map(a => a.densityBoost));
    this.armAmplitudes = this.arms.map(a => a.densityBoost / maxBoost);

    // Pre-computed arm data arrays for GPU uniforms (GalaxyGlow shader).
    // Single source of truth — glow shader reads these, not its own definitions.
    this.armWidths = this.arms.map(a => a.width);
    this.armStrengths = this.arms.map(a => a.densityBoost / 2.5); // normalized 0-1

    // ── Calibrate potential model ──
    // Scale potentialDerivedDensity so the solar neighborhood matches the
    // target density of ~0.06 stars/pc³ (observational constraint).
    // This is the ONLY calibration point — all other densities derive
    // from the same potential model with this single normalization.
    this._potentialDensityNorm = 1.0; // temporary, recalculated below
    const TARGET_SOLAR_DENSITY = 0.06; // stars/pc³ at solar neighborhood
    const rawPotentialDensity = this.potentialDerivedDensity(GalacticMap.SOLAR_R, GalacticMap.SOLAR_Z).totalDensity;
    if (rawPotentialDensity > 1e-10) {
      this._potentialDensityNorm = TARGET_SOLAR_DENSITY / rawPotentialDensity;
    }

    // Sector cache (LRU)
    this._sectorCache = new Map();

    // Galactic features cache — Level 1 in the generation hierarchy.
    // Features are generated per "feature region" (4 kpc cubes) and cached.
    // Each region contains 0-N positioned features (nebulae, clusters, etc.)
    this._featureRegionCache = new Map();
    this._featureRegionSize = 4.0; // kpc — 8× sector size, covers many sectors
    this._maxFeatureRegions = 32;
  }

  // ════════════════════════════════════════════════════════════
  // HASHING — deterministic integer hash for sector/star seeds
  // ════════════════════════════════════════════════════════════

  /**
   * Splitmix64-inspired 32-bit integer hash.
   * Combines two seeds into a single deterministic value.
   */
  static hashCombine(a, b) {
    let h = (a * 2654435761) ^ (b * 2246822519);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h = (h ^ (h >>> 16)) >>> 0;
    return h;
  }

  /**
   * Derive a deterministic string seed for a sector from its grid coordinates.
   */
  sectorSeed(sx, sy, sz) {
    const h1 = GalacticMap.hashCombine(sx + 10000, sy + 10000);
    const h2 = GalacticMap.hashCombine(h1, sz + 10000);
    return this.masterSeed + '-sector-' + h2;
  }

  // ════════════════════════════════════════════════════════════
  // DENSITY MODEL — where stars are in the galaxy
  // ════════════════════════════════════════════════════════════

  // componentDensities() — REMOVED.
  // Was a legacy density model using exponential profiles (separate from the
  // potential-derived model). Only used for calibration normalization, which
  // now uses a direct target constant (TARGET_SOLAR_DENSITY = 0.06).
  // The potential-derived density is the single source of truth.

  /**
   * How strongly a position is inside a spiral arm (0 = inter-arm, 1+ = arm center).
   * Uses logarithmic spiral model with Gaussian cross-section.
   * Returns a density-weighted strength: major arms peak higher than minor arms.
   *
   * See RESEARCH_star-population-synthesis.md §6.
   *
   * @param {number} R_kpc - cylindrical radius
   * @param {number} theta_rad - angle in disk plane
   * @returns {number} 0 to ~1 (can exceed 1 for strongest major arms)
   */
  /**
   * Galactic bar density enhancement at a position.
   * Returns 0–1+ indicating how much the bar boosts density at (R, theta).
   * The bar is an elongated triaxial structure at the galaxy center.
   *
   * @param {number} R_kpc — cylindrical radius
   * @param {number} theta_rad — angle in disk plane
   * @returns {number} bar density boost factor (0 = no bar, >0 = inside bar)
   */
  barStrength(R_kpc, theta_rad) {
    if (R_kpc > GalacticMap.BAR_HALF_LENGTH * 1.5) return 0;

    // Rotate into bar frame
    const x = R_kpc * Math.cos(theta_rad);
    const z = R_kpc * Math.sin(theta_rad);
    const bx = x * this.barCosA + z * this.barSinA;
    const bz = -x * this.barSinA + z * this.barCosA;

    // Evaluate ellipsoidal Gaussian
    const sx = bx / GalacticMap.BAR_HALF_LENGTH;
    const sz = bz / GalacticMap.BAR_HALF_WIDTH;
    return Math.exp(-0.5 * (sx * sx + sz * sz)) * GalacticMap.BAR_DENSITY;
  }

  spiralArmStrength(R_kpc, theta_rad) {
    if (R_kpc < 0.5) return 0; // No arms in the very center (bulge dominates)

    let maxStrength = 0;
    for (const arm of this.arms) {
      // Expected angle at this radius for this arm
      const expectedTheta = arm.offset + this.pitchK * Math.log(R_kpc / 4.0);
      // Angular distance (wrapped to [-pi, pi])
      let dTheta = ((theta_rad - expectedTheta) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      // Perpendicular distance to the spiral arm in kpc.
      // The spiral crosses the radial direction at the pitch angle,
      // so perpendicular distance = arc_distance * sin(pitch_angle).
      const sinPitch = Math.sin(this.pitchAngle);
      const dist = Math.abs(dTheta) * R_kpc * sinPitch;
      // Gaussian profile with per-arm width
      const gaussianStrength = Math.exp(-0.5 * (dist / arm.width) ** 2);
      // Scale by this arm's density boost (major arms ~2.5, minor ~0.6-1.2)
      // Normalize so the max possible value from the strongest arm ≈ 1.0
      const strength = gaussianStrength * (arm.densityBoost / 2.5);
      if (strength > maxStrength) maxStrength = strength;
    }
    return maxStrength;
  }

  /**
   * Detailed arm info at a position — which arm is closest and its properties.
   * Used for galaxy context (star formation rates differ by arm type).
   *
   * @param {number} R_kpc - cylindrical radius
   * @param {number} theta_rad - angle in disk plane
   * @returns {{ armName, isMajor, strength, densityBoost }}
   */
  nearestArmInfo(R_kpc, theta_rad) {
    if (R_kpc < 0.5) return { armName: 'bulge', isMajor: false, strength: 0, densityBoost: 0 };

    let bestArm = null;
    let bestStrength = 0;

    const sinPitch = Math.sin(this.pitchAngle);
    for (const arm of this.arms) {
      const expectedTheta = arm.offset + this.pitchK * Math.log(R_kpc / 4.0);
      let dTheta = ((theta_rad - expectedTheta) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      // Perpendicular distance to spiral arm — same formula as spiralArmStrength
      const dist = Math.abs(dTheta) * R_kpc * sinPitch;
      const strength = Math.exp(-0.5 * (dist / arm.width) ** 2);
      if (strength > bestStrength) {
        bestStrength = strength;
        bestArm = arm;
      }
    }

    return {
      armName: bestArm ? bestArm.name : 'inter-arm',
      isMajor: bestArm ? bestArm.isMajor : false,
      strength: bestStrength,
      densityBoost: bestArm ? bestArm.densityBoost : 0,
    };
  }

  // ════════════════════════════════════════════════════════════
  // GRAVITATIONAL POTENTIAL MODEL — the primary data structure
  // ════════════════════════════════════════════════════════════
  //
  // The gravitational potential Φ(R,z) is the fundamental quantity.
  // Density, star count, feature locations, and gameplay values
  // (escape velocity, warp cost, energy harvesting) all derive from it.
  //
  // Standard potential-density pairs from astrophysics:
  //   Disk:  Miyamoto-Nagai (1975)
  //   Bulge: Hernquist (1990)
  //   Halo:  Navarro-Frenk-White (1997)
  //   Arms:  Cox & Gomez (2002) perturbation model

  // ── Potential model parameters ──
  // Calibrated so potentialDerivedDensity at solar neighborhood
  // matches componentDensities output (~0.065). G is absorbed into
  // the mass constants (we work in arbitrary potential units, not SI).

  static MN_A = 3.0;           // kpc — Miyamoto-Nagai thin disk radial scale
  static MN_B = 0.28;          // kpc — thin disk vertical scale
  static MN_GM = 1.0;          // thin disk "mass" (arbitrary units, calibrated)

  // Thick disk — older stellar population, larger scale height
  // Contains ~15% of disk stars, extends ~3x higher than thin disk
  static MN_THICK_A = 2.6;    // kpc — thick disk radial scale (slightly more compact)
  static MN_THICK_B = 0.90;   // kpc — thick disk vertical scale (~3x thin disk)
  static MN_THICK_GM = 0.65;  // thick disk mass (calibrated for ~200B total galaxy)

  static HERNQUIST_A = 0.6;    // kpc — bulge scale length
  static HERNQUIST_GM = 0.50;  // bulge "mass" (tuned for component weight balance)

  static NFW_RS = 12.0;        // kpc — halo scale radius
  static NFW_NORM = 0.0003;    // halo normalization (tuned: Solar=1.0, Halo=1.14x)

  /**
   * Gravitational potential at a position in the galaxy.
   * This is the PRIMARY data — everything else derives from it.
   *
   * When theta is provided, includes non-axisymmetric perturbations:
   *   - Spiral arms: Cox & Gomez (2002) per-arm perturbation
   *   - Galactic bar: Dehnen (2000) quadrupolar perturbation
   * When theta is omitted, returns the axisymmetric potential only.
   *
   * @param {number} R_kpc — cylindrical radius from center
   * @param {number} z_kpc — height above/below disk plane
   * @param {number} [theta_rad] — angle in disk plane (optional)
   * @returns {{ disk, bulge, halo, spiral, bar, total }}
   *   All values are negative (deeper well = more negative).
   */
  gravitationalPotential(R_kpc, z_kpc, theta_rad) {
    const R = R_kpc;
    const z = z_kpc;
    const Rsq = R * R;

    // Miyamoto-Nagai thin disk potential
    const zb = Math.sqrt(z * z + GalacticMap.MN_B * GalacticMap.MN_B);
    const azb = GalacticMap.MN_A + zb;
    const thinDisk = -GalacticMap.MN_GM / Math.sqrt(Rsq + azb * azb);

    // Miyamoto-Nagai thick disk potential
    const zb2 = Math.sqrt(z * z + GalacticMap.MN_THICK_B * GalacticMap.MN_THICK_B);
    const azb2 = GalacticMap.MN_THICK_A + zb2;
    const thickDisk = -GalacticMap.MN_THICK_GM / Math.sqrt(Rsq + azb2 * azb2);

    const disk = thinDisk + thickDisk;

    // Hernquist bulge potential
    const r = Math.sqrt(Rsq + z * z);
    const bulge = -GalacticMap.HERNQUIST_GM / (r + GalacticMap.HERNQUIST_A);

    // NFW halo potential
    const rs = GalacticMap.NFW_RS;
    const rSafe = Math.max(r, 0.01);
    const halo = -GalacticMap.NFW_NORM * rs * Math.log(1 + rSafe / rs) / rSafe;

    let spiral = 0;
    let bar = 0;

    if (theta_rad !== undefined && R > 0.01) {
      // ── Cox & Gomez (2002) spiral arm potential ──
      // Each arm is a separate perturbation. Using 1 harmonic (n=1)
      // for performance — higher harmonics sharpen the arm cross-section
      // but aren't critical at game scale.
      const H = GalacticMap.SPIRAL_SCALE_HEIGHT;
      const Rs = GalacticMap.SPIRAL_RADIAL_SCALE;
      const Rref = GalacticMap.SPIRAL_REF_RADIUS;
      const sinAlpha = Math.sin(this.pitchAngle);
      const N = 1; // single-arm mode (each arm evaluated independently)

      for (let a = 0; a < this.arms.length; a++) {
        const arm = this.arms[a];
        const amp = this.armAmplitudes[a];

        // Spiral phase for this arm
        const gamma = theta_rad - arm.offset - this.pitchK * Math.log(R / Rref);

        // Radial wavenumber
        const K = N / (R * sinAlpha);
        const KH = K * H;

        // Vertical shape (sech approximation: 1/cosh(x) ≈ 2*exp(-|x|) for large x)
        const Kz = K * Math.abs(z);
        const sechTerm = Kz < 10 ? 1 / Math.cosh(Kz) : 0;

        // Density-wave normalization
        const Bn = KH * (1 + 0.4 * KH);
        const Dn = (1 + KH + 0.3 * KH * KH) / (1 + 0.3 * KH);

        // Radial decay
        const radialDecay = Math.exp(-(R - Rref) / Rs);

        // CG02 potential for this arm (n=1 harmonic only)
        // Negative because gravitational wells are negative
        const Cn = 8 / (3 * Math.PI); // n=1 coefficient
        spiral += -amp * GalacticMap.MN_GM * 0.008 * radialDecay *
          (Cn / (K * Dn)) * Math.cos(gamma) * Math.pow(sechTerm, Bn);
      }

      // ── Dehnen (2000) bar potential ──
      // Quadrupolar perturbation: cos(2*(theta - theta_bar))
      const Rb = GalacticMap.BAR_HALF_LENGTH;
      const Ab = GalacticMap.BAR_AMPLITUDE;
      const thetaBar = this.barAngle;
      const cos2 = Math.cos(2 * (theta_rad - thetaBar));

      if (R < Rb) {
        // Inside bar: potential is polynomial
        // cos2 > 0 along bar → more negative potential (deeper well)
        bar = Ab * cos2 * (R / Rb) * (R / Rb) * (-(r / Rb) * (r / Rb) * (r / Rb) - 2);
      } else {
        // Outside bar: potential falls off as (Rb/r)^3
        bar = Ab * cos2 * (R / r) * (R / r) * (-(Rb / r) * (Rb / r) * (Rb / r));
      }
    }

    return {
      disk,
      bulge,
      halo,
      spiral,
      bar,
      total: disk + bulge + halo + spiral + bar,
    };
  }

  /**
   * Gradient of the gravitational potential (analytical derivatives).
   * The gradient points TOWARD increasing potential (outward from wells).
   * Force = -gradient, so force points INTO wells.
   *
   * @param {number} R_kpc
   * @param {number} z_kpc
   * @returns {{ dR: number, dz: number, magnitude: number }}
   */
  potentialGradient(R_kpc, z_kpc) {
    const R = R_kpc;
    const z = z_kpc;

    // Miyamoto-Nagai thin disk gradient
    const b = GalacticMap.MN_B;
    const a = GalacticMap.MN_A;
    const GM_d = GalacticMap.MN_GM;
    const zb = Math.sqrt(z * z + b * b);
    const azb = a + zb;
    const D = Math.sqrt(R * R + azb * azb);
    const D3 = D * D * D;
    let dDisk_dR = GM_d * R / D3;
    let dDisk_dz = GM_d * z * azb / (zb * D3);

    // Miyamoto-Nagai thick disk gradient
    const b2 = GalacticMap.MN_THICK_B;
    const a2 = GalacticMap.MN_THICK_A;
    const GM_d2 = GalacticMap.MN_THICK_GM;
    const zb2 = Math.sqrt(z * z + b2 * b2);
    const azb2 = a2 + zb2;
    const D2 = Math.sqrt(R * R + azb2 * azb2);
    const D2_3 = D2 * D2 * D2;
    dDisk_dR += GM_d2 * R / D2_3;
    dDisk_dz += GM_d2 * z * azb2 / (zb2 * D2_3);

    // Hernquist bulge gradient
    const GM_b = GalacticMap.HERNQUIST_GM;
    const a_b = GalacticMap.HERNQUIST_A;
    const r = Math.sqrt(R * R + z * z);
    const rSafe = Math.max(r, 0.01);
    const ra2 = (rSafe + a_b) * (rSafe + a_b);
    const dBulge_dR = GM_b * R / (rSafe * ra2);
    const dBulge_dz = GM_b * z / (rSafe * ra2);

    // NFW halo gradient (radial, decomposed into R,z)
    const rs = GalacticMap.NFW_RS;
    const norm = GalacticMap.NFW_NORM;
    const x = rSafe / rs;
    const dHalo_dr = norm * rs * (Math.log(1 + x) / (rSafe * rSafe) - 1 / (rSafe * (rSafe + rs)));
    const dHalo_dR = dHalo_dr * R / rSafe;
    const dHalo_dz = dHalo_dr * z / rSafe;

    const dR = dDisk_dR + dBulge_dR + dHalo_dR;
    const dz = dDisk_dz + dBulge_dz + dHalo_dz;

    return {
      dR,
      dz,
      magnitude: Math.sqrt(dR * dR + dz * dz),
    };
  }

  /**
   * Density derived from the gravitational potential.
   *
   * The axisymmetric components (disks, bulge, halo) use closed-form
   * density-potential pairs. When theta is provided, the spiral arm and
   * bar density perturbations are computed from the potential via numerical
   * Laplacian — ensuring density is exactly consistent with the potential.
   *
   * @param {number} R_kpc
   * @param {number} z_kpc
   * @param {number} [theta_rad] — angle in disk plane (optional)
   * @returns {{ thin, thick, bulge, halo, totalDensity }}
   */
  potentialDerivedDensity(R_kpc, z_kpc, theta_rad) {
    const R = R_kpc;
    const z = z_kpc;
    const Rsq = R * R;

    // Miyamoto-Nagai thin disk analytical density
    const a = GalacticMap.MN_A;
    const b = GalacticMap.MN_B;
    const GM = GalacticMap.MN_GM;
    const zb = Math.sqrt(z * z + b * b);
    const azb = a + zb;
    const denom1 = Math.pow(Rsq + azb * azb, 2.5);
    const denom2 = Math.pow(z * z + b * b, 1.5);
    const thin = (b * b * GM / (4 * Math.PI))
      * (a * Rsq + (a + 3 * zb) * azb * azb)
      / (denom1 * denom2);

    // Miyamoto-Nagai thick disk analytical density
    const a2 = GalacticMap.MN_THICK_A;
    const b2 = GalacticMap.MN_THICK_B;
    const GM2 = GalacticMap.MN_THICK_GM;
    const zb2 = Math.sqrt(z * z + b2 * b2);
    const azb2 = a2 + zb2;
    const denom3 = Math.pow(Rsq + azb2 * azb2, 2.5);
    const denom4 = Math.pow(z * z + b2 * b2, 1.5);
    const thick = (b2 * b2 * GM2 / (4 * Math.PI))
      * (a2 * Rsq + (a2 + 3 * zb2) * azb2 * azb2)
      / (denom3 * denom4);

    // Hernquist analytical density (spherical bulge)
    const a_b = GalacticMap.HERNQUIST_A;
    const GM_b = GalacticMap.HERNQUIST_GM;
    const r = Math.sqrt(Rsq + z * z);
    const rSafe = Math.max(r, 0.01);
    const bulgeDensity = GM_b * a_b / (2 * Math.PI * rSafe * Math.pow(rSafe + a_b, 3));

    // Galactic bar's own stellar mass — computed here, applied to total below.
    // The bar is a concentration of BOTH disk and bulge stars captured into
    // elongated orbits, so it boosts the total density, not just the bulge.
    let barMassBoost = 0;
    if (R < GalacticMap.BAR_HALF_LENGTH * 1.5) {
      let barMass;
      if (theta_rad !== undefined) {
        const gx = R * Math.cos(theta_rad);
        const gz = R * Math.sin(theta_rad);
        const bx = gx * this.barCosA + gz * this.barSinA;
        const bz = -gx * this.barSinA + gz * this.barCosA;
        const sx = bx / GalacticMap.BAR_HALF_LENGTH;
        const sz = bz / GalacticMap.BAR_HALF_WIDTH;
        const sy = Math.abs(z) / GalacticMap.BAR_HALF_HEIGHT;
        barMass = Math.exp(-0.5 * (sx * sx + sz * sz + sy * sy));
      } else {
        const barR = R / GalacticMap.BAR_HALF_LENGTH;
        const barZ = Math.abs(z) / GalacticMap.BAR_HALF_HEIGHT;
        barMass = Math.exp(-0.5 * (barR * barR + barZ * barZ));
      }
      barMassBoost = barMass * GalacticMap.BAR_DENSITY;
    }

    // NFW analytical density
    const rs = GalacticMap.NFW_RS;
    const norm = GalacticMap.NFW_NORM;
    const x = rSafe / rs;
    const haloDensity = norm / (x * (1 + x) * (1 + x));

    // ── Spiral arm density from potential perturbation ──
    // When theta is provided, compute the spiral arm density contribution
    // via numerical Laplacian of the spiral potential. The bar's own mass
    // is handled above via the triaxial Gaussian (direct mass model).
    // The Dehnen bar perturbation is excluded from the Laplacian because
    // it models orbital reshaping, not mass addition — its Laplacian
    // gives the wrong sign for density (negative along the bar axis).
    let spiralBarDensity = 0;
    if (theta_rad !== undefined && R > 0.3) {
      // Numerical Laplacian in cylindrical coordinates:
      // ∇²Φ = d²Φ/dR² + (1/R)dΦ/dR + (1/R²)d²Φ/dθ² + d²Φ/dz²
      // Using central finite differences on just the spiral+bar component.
      const dR = 0.02; // kpc step for finite differences
      const dTheta = 0.02;
      const dZ = 0.02;

      // Only compute the spiral+bar part of the potential (not axisymmetric)
      // Fast spiral-only potential for the Laplacian.
      // The bar is excluded: its Dehnen perturbation models orbital dynamics
      // (escape velocity, warp cost) but its Laplacian gives inverted density.
      // Bar mass is handled directly via the triaxial Gaussian above.
      const phiSB = (r, z, t) => this._spiralPotentialOnly(r, z, t);

      const phi0 = phiSB(R, z, theta_rad);
      const phiRp = phiSB(R + dR, z, theta_rad);
      const phiRm = phiSB(Math.max(0.01, R - dR), z, theta_rad);
      const dPhidR2 = (phiRp - 2 * phi0 + phiRm) / (dR * dR);
      const dPhidR = (phiRp - phiRm) / (2 * dR);
      const dPhidT2 = (phiSB(R, z, theta_rad + dTheta) - 2 * phi0 + phiSB(R, z, theta_rad - dTheta)) / (dTheta * dTheta);
      const dPhidZ2 = (phiSB(R, z + dZ, theta_rad) - 2 * phi0 + phiSB(R, z - dZ, theta_rad)) / (dZ * dZ);

      // Poisson equation: ρ = (1/4πG) ∇²Φ
      // We work in arbitrary units where G is absorbed, so ρ = ∇²Φ / (4π)
      // This CAN be negative — spiral arms redistribute density, pulling it
      // from inter-arm regions into the arms. Negative values reduce the
      // axisymmetric density between arms. Total density is clamped to 0
      // at the end to prevent unphysical negative total.
      const laplacian = dPhidR2 + dPhidR / R + dPhidT2 / (R * R) + dPhidZ2;
      spiralBarDensity = laplacian / (4 * Math.PI);
    }

    // Disk truncation: the stellar disk genuinely ends at ~GALAXY_RADIUS.
    const truncR = GalacticMap.GALAXY_RADIUS;
    const truncWidth = truncR * 0.1;
    const diskTrunc = R < truncR - truncWidth ? 1.0 :
      R > truncR ? 0.0 :
      0.5 * (1 + Math.cos(Math.PI * (R - (truncR - truncWidth)) / truncWidth));

    // Apply calibration normalization (with disk truncation + bar mass)
    const thinWithSpiral = Math.max(0, thin + spiralBarDensity) * diskTrunc;
    const rawTotal = thinWithSpiral + thick * diskTrunc + bulgeDensity + haloDensity;
    // Bar mass boosts the total density (bar captures disk+bulge stars into elongated orbits)
    const total = rawTotal * (1 + barMassBoost) * this._potentialDensityNorm;
    const thinN = thinWithSpiral * this._potentialDensityNorm;
    const thickN = thick * diskTrunc * this._potentialDensityNorm;
    const bulgeN = bulgeDensity * this._potentialDensityNorm;
    const haloN = haloDensity * this._potentialDensityNorm;

    if (total < 1e-10) {
      return { thin: 0.25, thick: 0.25, bulge: 0.25, halo: 0.25, totalDensity: 0 };
    }

    return {
      thin: thinN / total,
      thick: thickN / total,
      bulge: bulgeN / total,
      halo: haloN / total,
      totalDensity: total,
    };
  }

  /**
   * Escape velocity at a position (derived from potential).
   * v_escape = sqrt(-2 × Φ). Useful for gameplay (warp cost).
   * @param {number} R_kpc
   * @param {number} z_kpc
   * @returns {number} escape velocity in arbitrary units
   */
  /**
   * Fast spiral-only potential (no bar, no axisymmetric components).
   * Used by the numerical Laplacian in potentialDerivedDensity —
   * the axisymmetric terms cancel in finite differences.
   * Bar is excluded because its Laplacian gives inverted density.
   * @private
   */
  _spiralPotentialOnly(R, z, theta) {
    if (R < 0.5) return 0; // No spiral structure in the bulge
    // Fade spiral in from R=0.5 to R=2 (bulge-to-disk transition)
    const spiralFade = R < 2 ? (R - 0.5) / 1.5 : 1;

    let spiral = 0;
    const H = GalacticMap.SPIRAL_SCALE_HEIGHT;
    const Rs = GalacticMap.SPIRAL_RADIAL_SCALE;
    const Rref = GalacticMap.SPIRAL_REF_RADIUS;
    const sinAlpha = Math.sin(this.pitchAngle);

    for (let a = 0; a < this.arms.length; a++) {
      const arm = this.arms[a];
      const amp = this.armAmplitudes[a];
      const gamma = theta - arm.offset - this.pitchK * Math.log(R / Rref);
      const K = 1 / (R * sinAlpha);
      const KH = K * H;
      const Kz = K * Math.abs(z);
      const sechTerm = Kz < 10 ? 1 / Math.cosh(Kz) : 0;
      const Bn = KH * (1 + 0.4 * KH);
      const Dn = (1 + KH + 0.3 * KH * KH) / (1 + 0.3 * KH);
      const radialDecay = Math.exp(-(R - Rref) / Rs);
      const Cn = 8 / (3 * Math.PI);
      spiral += -amp * GalacticMap.MN_GM * 0.008 * radialDecay *
        (Cn / (K * Dn)) * Math.cos(gamma) * Math.pow(Math.max(0, sechTerm), Bn);
    }

    return spiral * spiralFade;
  }

  /**
   * Fast spiral + bar potential (no axisymmetric components).
   * Used by gravitationalPotential for the full potential including bar.
   * @private
   */
  _spiralBarPotential(R, z, theta) {
    if (R < 0.01) return 0;

    let spiral = 0;
    const H = GalacticMap.SPIRAL_SCALE_HEIGHT;
    const Rs = GalacticMap.SPIRAL_RADIAL_SCALE;
    const Rref = GalacticMap.SPIRAL_REF_RADIUS;
    const sinAlpha = Math.sin(this.pitchAngle);

    for (let a = 0; a < this.arms.length; a++) {
      const arm = this.arms[a];
      const amp = this.armAmplitudes[a];
      const gamma = theta - arm.offset - this.pitchK * Math.log(R / Rref);
      const K = 1 / (R * sinAlpha);
      const KH = K * H;
      const Kz = K * Math.abs(z);
      const sechTerm = Kz < 10 ? 1 / Math.cosh(Kz) : 0;
      const Bn = KH * (1 + 0.4 * KH);
      const Dn = (1 + KH + 0.3 * KH * KH) / (1 + 0.3 * KH);
      const radialDecay = Math.exp(-(R - Rref) / Rs);
      const Cn = 8 / (3 * Math.PI);
      spiral += -amp * GalacticMap.MN_GM * 0.008 * radialDecay *
        (Cn / (K * Dn)) * Math.cos(gamma) * Math.pow(sechTerm, Bn);
    }

    // Dehnen bar
    let bar = 0;
    const Rb = GalacticMap.BAR_HALF_LENGTH;
    const Ab = GalacticMap.BAR_AMPLITUDE;
    const cos2 = Math.cos(2 * (theta - this.barAngle));
    const r = Math.sqrt(R * R + z * z);
    if (R < Rb) {
      bar = Ab * cos2 * (R / Rb) * (R / Rb) * (-Math.pow(r / Rb, 3) - 2);
    } else {
      bar = Ab * cos2 * (R / r) * (R / r) * (-Math.pow(Rb / r, 3));
    }

    return spiral + bar;
  }

  escapeVelocity(R_kpc, z_kpc, theta_rad) {
    const phi = this.gravitationalPotential(R_kpc, z_kpc, theta_rad).total;
    return Math.sqrt(-2 * phi);
  }

  // ════════════════════════════════════════════════════════════
  // SECTOR GENERATION — deterministic star placement
  // ════════════════════════════════════════════════════════════

  /**
   * Convert world coordinates to sector grid indices.
   */
  worldToSector(x, y, z) {
    const S = GalacticMap.SECTOR_SIZE;
    return {
      sx: Math.floor(x / S),
      sy: Math.floor(y / S),
      sz: Math.floor(z / S),
    };
  }

  /**
   * Get the sector key string for cache lookup.
   */
  getSectorKey(sx, sy, sz) {
    return `${sx},${sy},${sz}`;
  }

  /**
   * Generate or retrieve a sector from cache.
   * A sector is a 0.5 kpc cube containing 0-30 stars.
   *
   * @param {number} sx - sector grid X
   * @param {number} sy - sector grid Y
   * @param {number} sz - sector grid Z
   * @returns {{ key, stars: Array, deepSkyObjects: Array }}
   */
  getSector(sx, sy, sz) {
    const key = this.getSectorKey(sx, sy, sz);

    // Check cache
    if (this._sectorCache.has(key)) {
      const sector = this._sectorCache.get(key);
      // Move to end (most recently used)
      this._sectorCache.delete(key);
      this._sectorCache.set(key, sector);
      return sector;
    }

    // Generate
    const sector = this._generateSector(sx, sy, sz);

    // Cache with LRU eviction
    this._sectorCache.set(key, sector);
    if (this._sectorCache.size > GalacticMap.MAX_CACHED_SECTORS) {
      // Delete oldest (first key in Map iteration order)
      const oldestKey = this._sectorCache.keys().next().value;
      this._sectorCache.delete(oldestKey);
    }

    return sector;
  }

  /**
   * Internal: generate a new sector.
   */
  _generateSector(sx, sy, sz) {
    const S = GalacticMap.SECTOR_SIZE;
    const seed = this.sectorSeed(sx, sy, sz);
    const rng = new SeededRandom(seed);

    // Sector center in world coordinates
    const centerX = (sx + 0.5) * S;
    const centerY = (sy + 0.5) * S;
    const centerZ = (sz + 0.5) * S;

    // Density at sector center — derived from gravitational potential.
    // The potential is the primary data; density emerges from it.
    const R = Math.sqrt(centerX * centerX + centerZ * centerZ);
    const theta = Math.atan2(centerZ, centerX);
    const densities = this.potentialDerivedDensity(R, centerY, theta);
    const armStr = this.spiralArmStrength(R, theta);

    // Galactic features overlapping this sector (Level 1 → Level 2 cascade)
    const overlappingFeatures = this.findFeaturesOverlappingSector(sx, sy, sz);

    // ── Compute local density function that includes feature potentials ──
    // This is the key to unified generation: features contribute their own
    // gravitational potential wells, raising the local density. Stars form
    // where the TOTAL potential (galaxy + features) is deep.
    const _featureDensityAtPoint = (wx, wy, wz) => {
      let featureDensity = 0;
      for (const feat of overlappingFeatures) {
        const spec = GalacticMap.FEATURE_TYPES[feat.type];
        if (!spec) continue;
        const multiplier = spec.contextOverrides.starCountMultiplier || 1;
        if (multiplier <= 1) continue;

        const dx = wx - feat.position.x;
        const dy = wy - feat.position.y;
        const dz = wz - feat.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const eps = feat.radius;

        // Plummer sphere density: ρ ∝ (1 + r²/ε²)^(-5/2)
        // Scaled by the feature's star count multiplier
        const plummerDensity = multiplier * Math.pow(1 + (dist * dist) / (eps * eps), -2.5);
        featureDensity += plummerDensity;
      }
      return featureDensity;
    };

    // ── Determine star budget for this sector ──
    // Base count from galactic potential + boost from feature potentials.
    // Features can dramatically increase the local star count.
    const solarDensity = 0.065;
    const normalizedDensity = densities.totalDensity / solarDensity;
    const targetAtSolar = 12;
    // Arm density modulation is now built into potentialDerivedDensity (via theta).
    // No separate arm multiplication needed — that would double-count.
    const baseStarCount = normalizedDensity * targetAtSolar;

    // Feature budget: compute at EACH feature's center within this sector,
    // not just the sector center. Features are tiny relative to sectors —
    // evaluating at the sector center misses their density contribution.
    let featureStarBudget = 0;
    for (const feat of overlappingFeatures) {
      const spec = GalacticMap.FEATURE_TYPES[feat.type];
      const mult = spec?.contextOverrides?.starCountMultiplier || 1;
      if (mult <= 1) continue;
      // How much of this feature overlaps this sector?
      // Use the peak density (at feature center) scaled by volume overlap
      const featVolume = (4 / 3) * Math.PI * feat.radius ** 3;
      const sectorVolume = S * S * S;
      // Approximate: if feature center is in this sector, most of feature is here
      const fcx = feat.position.x - sx * S;
      const fcy = feat.position.y - sy * S;
      const fcz = feat.position.z - sz * S;
      const centerHere = fcx >= 0 && fcx < S && fcy >= 0 && fcy < S && fcz >= 0 && fcz < S;
      const overlap = centerHere ? 1.0 : 0.2;
      // Star budget for this feature: scale multiplier by a base count
      // representing how many stars the feature should have
      const featureBase = mult * targetAtSolar * 3; // e.g. globular: 10 × 12 × 3 = 360
      featureStarBudget += Math.round(featureBase * overlap);
    }

    const totalBudget = Math.min(
      Math.max(Math.round(baseStarCount + featureStarBudget), 0),
      GalacticMap.MAX_STARS_PER_SECTOR + Math.max(0, featureStarBudget), // raise cap for features
    );

    // ── Place stars via density-weighted rejection sampling ──
    // Propose random positions within the sector, accept/reject based on
    // local density (galaxy potential + feature potentials). Stars naturally
    // concentrate where the total potential well is deepest.
    const stars = [];
    const maxAttempts = totalBudget * 20; // rejection sampling needs headroom (features are tiny)
    let attempts = 0;
    let placed = 0;

    // Precompute max density for acceptance probability normalization.
    // Must include the PEAK feature density (at feature centers), not just
    // the sector center. Otherwise rejection sampling under-accepts near features.
    let peakFeatureDensity = 0;
    for (const feat of overlappingFeatures) {
      const spec = GalacticMap.FEATURE_TYPES[feat.type];
      const mult = spec?.contextOverrides?.starCountMultiplier || 1;
      if (mult > 1) peakFeatureDensity = Math.max(peakFeatureDensity, mult); // Plummer peak = multiplier
    }
    const maxDensity = densities.totalDensity + peakFeatureDensity + 0.001;

    while (placed < totalBudget && attempts < maxAttempts) {
      attempts++;

      const localX = rng.range(0, S);
      const localY = rng.range(0, S);
      const localZ = rng.range(0, S);
      const worldX = sx * S + localX;
      const worldY = sy * S + localY;
      const worldZ = sz * S + localZ;

      // Evaluate total density at this specific point
      const ptR = Math.sqrt(worldX * worldX + worldZ * worldZ);
      const ptDensity = this.potentialDerivedDensity(ptR, worldY).totalDensity;
      const ptFeatureDensity = _featureDensityAtPoint(worldX, worldY, worldZ);
      const totalLocalDensity = ptDensity + ptFeatureDensity;

      // Accept/reject: probability proportional to local density
      const acceptProb = Math.min(1, totalLocalDensity / maxDensity);
      if (rng.float() > acceptProb) continue;

      const starSeed = GalacticMap.hashCombine(
        GalacticMap.hashCombine(sx + 10000, sy + 10000),
        GalacticMap.hashCombine(sz + 10000, placed),
      );

      stars.push({
        localX, localY, localZ,
        worldX, worldY, worldZ,
        seed: starSeed,
        index: placed,
      });
      placed++;
    }

    // ── Tag stars inside features with featureContext ──
    // Stars don't know they're "feature stars" — they just formed where
    // the potential was deep. But we tag them so the nav computer and
    // rendering can identify which feature they belong to.
    for (const star of stars) {
      star.featureContext = null;
      for (const feat of overlappingFeatures) {
        const dx = star.worldX - feat.position.x;
        const dy = star.worldY - feat.position.y;
        const dz = star.worldZ - feat.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < feat.radius) {
          star.featureContext = {
            type: feat.type,
            featureSeed: feat.seed,
            metallicity: feat.context.metallicity,
            age: feat.context.age,
            overrides: feat.overrides,
            featureRadius: feat.radius,
            distFromCenter: dist,
          };
          break;
        }
      }
    }

    return {
      key: this.getSectorKey(sx, sy, sz),
      sx, sy, sz,
      stars,
      features: overlappingFeatures,
      armStrength: armStr,
      densities,
    };
  }

  // ════════════════════════════════════════════════════════════
  // GALAXY CONTEXT — derive star properties from position
  // ════════════════════════════════════════════════════════════

  /**
   * Derive the full galaxy context for a position.
   * This is what gets passed to StarSystemGenerator.generate().
   *
   * @param {{ x, y, z }} position - world coords in kpc
   * @returns {GalaxyContext}
   */
  deriveGalaxyContext(position) {
    const { x, y, z } = position;
    const R = Math.sqrt(x * x + z * z);
    const theta = Math.atan2(z, x);

    const densities = this.potentialDerivedDensity(R, y, theta);
    const armStr = this.spiralArmStrength(R, theta);
    const phi = this.gravitationalPotential(R, y, theta);
    const armInfo = this.nearestArmInfo(R, theta);

    // Pick dominant component
    const componentEntries = [
      ['thin', densities.thin],
      ['thick', densities.thick],
      ['bulge', densities.bulge],
      ['halo', densities.halo],
    ];
    componentEntries.sort((a, b) => b[1] - a[1]);
    const component = componentEntries[0][0];

    // Use a position-derived RNG for scatter
    const contextRng = new SeededRandom(`ctx-${x.toFixed(4)}-${y.toFixed(4)}-${z.toFixed(4)}`);

    let metallicity = this._deriveMetallicity(contextRng, component, R, y);
    let age = this._deriveAge(contextRng, component, armStr);
    let starWeights = this._deriveStarWeights(component, armStr, armInfo);
    const binaryMod = this._deriveBinaryModifier(component);

    // Check if this position is inside any galactic feature.
    // Uses a small search radius (0.5 kpc) — only catches features we're actually inside.
    // Feature regions are cached, so repeated calls in the same area are fast.
    const nearbyFeatures = this.findNearbyFeatures({ x, y, z }, 0.3);
    let featureContext = null;
    for (const feat of nearbyFeatures) {
      if (feat.insideFeature) {
        featureContext = {
          type: feat.type,
          seed: feat.seed,
          metallicity: feat.context.metallicity,
          age: feat.context.age,
          overrides: feat.overrides,
          radius: feat.radius,
          distance: feat.distance,
        };
        // Override star generation parameters based on feature
        if (feat.overrides.ageMax != null) {
          age = Math.min(age, feat.overrides.ageMax);
        }
        if (feat.overrides.ageOverride != null) {
          age = feat.overrides.ageOverride;
        }
        if (feat.overrides.metallicityOverride != null) {
          metallicity = feat.overrides.metallicityOverride;
        }
        if (feat.overrides.metallicityBoost) {
          metallicity += feat.overrides.metallicityBoost;
        }
        if (feat.overrides.obBoost) {
          // Re-derive star weights with O/B boost
          starWeights = this._deriveStarWeightsWithBoost(component, armStr, feat.overrides.obBoost);
        }
        break; // First feature wins
      }
    }

    return {
      component,
      componentWeights: { ...densities },
      spiralArmStrength: armStr,
      armInfo,  // { armName, isMajor, strength, densityBoost }
      metallicity,
      age,
      starWeights,
      binaryModifier: binaryMod,
      starDensity: densities.totalDensity,
      // Gravitational potential data (primary game data)
      gravitationalPotential: phi.total,
      escapeVelocity: Math.sqrt(-2 * phi.total),
      potentialDepth: -phi.total, // positive = deeper well
      R_kpc: R,
      z_kpc: y,
      theta_rad: theta,
      position: { x, y, z },
      featureContext,
    };
  }

  /**
   * Derive star weights with an additional O/B boost (for features like nebulae).
   */
  _deriveStarWeightsWithBoost(component, armStrength, obBoost) {
    const weights = this._deriveStarWeights(component, armStrength);
    // Apply additional boost to O and B types
    for (const entry of weights) {
      if (entry.type === 'O' || entry.type === 'B') {
        entry.weight *= obBoost;
      }
    }
    // Renormalize
    const total = weights.reduce((s, e) => s + e.weight, 0);
    for (const entry of weights) {
      entry.weight /= total;
    }
    return weights;
  }

  /**
   * Metallicity from galactic position.
   * Disk: radial + vertical gradient. Bulge: bimodal. Halo: low.
   *
   * See RESEARCH_star-population-synthesis.md §3.
   */
  _deriveMetallicity(rng, component, R_kpc, z_kpc) {
    let mean, sigma;

    switch (component) {
      case 'thin':
        // Radial gradient: -0.06 dex/kpc from solar position
        // Vertical gradient: -0.3 dex/kpc from plane
        mean = -0.06 * (R_kpc - 8.0) - 0.3 * Math.abs(z_kpc);
        sigma = 0.18;
        break;
      case 'thick':
        mean = -0.6 - 0.04 * (R_kpc - 8.0);
        sigma = 0.25;
        break;
      case 'bulge':
        // Bimodal: 60% metal-rich, 40% metal-poor
        if (rng.chance(0.6)) {
          mean = 0.3; sigma = 0.2;
        } else {
          mean = -0.3; sigma = 0.3;
        }
        break;
      case 'halo':
        mean = -1.2 - 0.02 * Math.max(0, R_kpc - 15);
        sigma = 0.5;
        break;
      default:
        mean = 0.0; sigma = 0.2;
    }

    return rng.gaussianClamped(mean, sigma, -4.0, 0.5);
  }

  /**
   * Age from galactic component and spiral arm strength.
   *
   * See RESEARCH_star-population-synthesis.md §4.
   */
  _deriveAge(rng, component, armStrength) {
    switch (component) {
      case 'thin':
        // Spiral arms: mostly young
        if (armStrength > 0.5 && rng.chance(0.8)) {
          return rng.gaussianClamped(0.3, 0.3, 0.01, 1.0);
        }
        // General disk: exponential distribution favoring older
        return rng.gaussianClamped(5.0, 3.0, 0.1, 10.0);
      case 'thick':
        return rng.gaussianClamped(10.0, 1.5, 8.0, 13.0);
      case 'bulge':
        // 85% old, 15% young
        if (rng.chance(0.85)) {
          return rng.gaussianClamped(10.0, 1.5, 7.0, 13.0);
        }
        return rng.range(0.1, 5.0);
      case 'halo':
        return rng.gaussianClamped(12.0, 1.0, 10.0, 13.5);
      default:
        return rng.gaussianClamped(4.5, 2.5, 0.1, 12.0);
    }
  }

  /**
   * Adjusted star type weights by galactic component and arm strength.
   * Returns an array matching StarSystemGenerator.STAR_WEIGHTS format.
   *
   * Key rules from research:
   * - Halo/thick disk: no O/B/A (they've all died — too old)
   * - Major spiral arms: O/B boosted strongly (active star formation)
   * - Minor arms: moderate O/B boost
   * - Bulge: shift toward K/M
   */
  /**
   * Fast per-type density multiplier for the hash grid starfield.
   *
   * Returns how much a given spectral type's base density should be scaled
   * at this galactic position. Driven by the same physics as _deriveStarWeights:
   *   - Gravitational potential → component fractions (thin/thick/bulge/halo)
   *   - Component → which star types dominate (young thin disk has O/B, old halo doesn't)
   *   - Arm strength → boosts young types in star-forming regions
   *
   * This replaces the flat ARM_DENSITY_BOOST in the hash grid with a per-type
   * multiplier that flows from the potential model.
   *
   * @param {string} type — spectral type ('O','B','A','F','G','K','M','Kg','Gg','Mg')
   * @param {Object} densities — from potentialDerivedDensity() { thin, thick, bulge, halo }
   * @param {number} armStr — from spiralArmStrength()
   * @param {Object|null} armInfo — from nearestArmInfo() { isMajor }
   * @returns {number} density multiplier (>= 0)
   */
  starTypeDensityMultiplier(type, densities, armStr, armInfo = null) {
    const W = GalacticMap.COMPONENT_STAR_WEIGHTS;
    const baseType = type.length > 1 ? type[0] : type;

    // Blend weights by component fraction (each component contributes proportionally)
    let weight = 0;
    weight += (W.thin[baseType] || 0) * (densities.thin || 0);
    weight += (W.thick[baseType] || 0) * (densities.thick || 0);
    weight += (W.bulge[baseType] || 0) * (densities.bulge || 0);
    weight += (W.halo[baseType] || 0) * (densities.halo || 0);

    // Arm boost for young types in thin disk (star formation in spiral arms)
    if (armStr > 0.1 && densities.thin > 0.2) {
      const isMajor = armInfo && armInfo.isMajor;
      if (baseType === 'O' || baseType === 'B') {
        const maxBoost = isMajor ? 4.0 : 1.5;
        weight *= (1 + armStr * maxBoost);
      } else if (baseType === 'A') {
        weight *= (1 + armStr * (isMajor ? 1.5 : 0.7));
      }
    }

    // Normalize: return multiplier relative to a "baseline" weight.
    // Use the thin disk base weight for this type as the reference,
    // so areas dominated by thin disk ≈ 1.0, thick/halo < 1.0, arm peaks > 1.0.
    const baseline = W.thin[baseType] || 0.1;
    return weight / baseline;
  }

  _deriveStarWeights(component, armStrength, armInfo = null) {
    const W = GalacticMap.COMPONENT_STAR_WEIGHTS;

    let weights;

    switch (component) {
      case 'thin':
        weights = { ...W.thin };
        // Boost O/B in spiral arms (star formation regions)
        if (armStrength > 0.1) {
          const isMajor = armInfo && armInfo.isMajor;
          const maxBoost = isMajor ? 4.0 : 1.5;
          const boost = 1 + armStrength * maxBoost;
          weights.O *= boost;
          weights.B *= boost;
          weights.A *= (1 + armStrength * (isMajor ? 1.5 : 0.7));
        }
        break;
      case 'thick':
        weights = { ...W.thick };
        break;
      case 'bulge':
        weights = { ...W.bulge };
        break;
      case 'halo':
        weights = { ...W.halo };
        break;
      default:
        weights = { ...W.thin };
    }

    // Normalize
    const total = Object.values(weights).reduce((s, v) => s + v, 0);
    const result = [];
    for (const [type, weight] of Object.entries(weights)) {
      result.push({ type, weight: weight / total });
    }
    return result;
  }

  /**
   * Binary star fraction modifier by component.
   * Multiplied with the base binary chance per star type.
   */
  _deriveBinaryModifier(component) {
    const mods = { thin: 1.0, thick: 0.8, halo: 0.8, bulge: 0.65 };
    return mods[component] || 1.0;
  }

  // ════════════════════════════════════════════════════════════
  // GALACTIC FEATURES — Level 1 in generation hierarchy
  // Positioned nebulae, clusters, OB associations.
  // Generated per "feature region" (4 kpc cubes), cached like sectors.
  // Features exist at specific positions for specific physical reasons.
  // See GAME_BIBLE.md §12 for full design.
  // ════════════════════════════════════════════════════════════

  /**
   * Feature types with generation parameters.
   * probability: base chance per feature candidate point
   * sizeRange: [min, max] radius in kpc
   * conditions: what galactic context makes this feature possible
   */
  static FEATURE_TYPES = {
    'emission-nebula': {
      sizeRange: [0.03, 0.1],  // 30-100 pc
      color: [0.8, 0.2, 0.1], // H-alpha red
      conditions: (ctx) => ctx.component === 'thin' && ctx.spiralArmStrength > 0.2,
      probability: 0.35,
      galaxyWideTarget: 7000, // ~7,000 HII regions in the real Milky Way
      contextOverrides: {
        ageMax: 0.05,          // 50 Myr — very young stars
        metallicityBoost: 0.1, // slightly enriched
        obBoost: 3.0,          // O/B stars boosted
      },
    },
    'dark-nebula': {
      sizeRange: [0.005, 0.05],  // 5-50 pc
      color: [0.05, 0.04, 0.03], // absorption (dark)
      conditions: (ctx) => ctx.component === 'thin' && ctx.spiralArmStrength > 0.15,
      probability: 0.25,
      galaxyWideTarget: 1500, // ~1,000-2,000 GMCs + thousands of smaller dark clouds
      contextOverrides: {
        ageMax: 0.01,           // pre-star-formation
        starCountMultiplier: 0.3, // few stars inside (it's dark for a reason)
      },
    },
    'open-cluster': {
      sizeRange: [0.002, 0.02],  // 2-20 pc
      color: [0.6, 0.7, 1.0],    // hot blue-white stars
      conditions: (ctx) => ctx.component === 'thin' && ctx.spiralArmStrength > 0.1,
      probability: 0.40,
      galaxyWideTarget: 100000, // ~100,000 in reality (most dissolve within 1 Gyr)
      contextOverrides: {
        starCountMultiplier: 3.0,
        metallicityScatter: 0.02, // tight metallicity (born together)
        ageScatter: 0.01,         // tight age (born together)
      },
    },
    'ob-association': {
      sizeRange: [0.05, 0.3],   // 50-300 pc
      color: [0.5, 0.6, 1.0],   // scattered hot stars
      conditions: (ctx) => ctx.component === 'thin' && ctx.spiralArmStrength > 0.35,
      probability: 0.15,
      galaxyWideTarget: 300, // ~100-300 in the real Milky Way
      contextOverrides: {
        ageMax: 0.03,
        obBoost: 5.0,
      },
    },
    'globular-cluster': {
      sizeRange: [0.01, 0.1],   // 10-100 pc
      color: [1.0, 0.85, 0.5],  // old yellow-orange stars
      conditions: (ctx) => {
        // Halo or bulge — globulars are a halo population
        const isHaloish = ctx.componentWeights.halo > 0.1 || ctx.componentWeights.bulge > 0.2;
        return isHaloish;
      },
      probability: 0.08,
      galaxyWideTarget: 50, // Target 50 → calibrated to produce ~160 after density weighting
      contextOverrides: {
        starCountMultiplier: 10.0, // very dense
        metallicityOverride: -1.5, // very metal poor
        ageOverride: 12.0,
      },
    },
    'supernova-remnant': {
      sizeRange: [0.001, 0.03],  // 1-30 pc
      color: [0.3, 0.8, 0.4],    // oxygen emission green
      conditions: (ctx) => ctx.component === 'thin' || ctx.component === 'thick',
      probability: 0.12,
      galaxyWideTarget: 1000, // ~1,000-3,000 estimated in the real Milky Way
      contextOverrides: {
        centralRemnant: true, // has neutron star or black hole at center
      },
    },
  };

  /**
   * Get feature region grid indices from world coordinates.
   */
  _featureRegionIndices(x, y, z) {
    const S = this._featureRegionSize;
    return {
      rx: Math.floor(x / S),
      ry: Math.floor(y / S),
      rz: Math.floor(z / S),
    };
  }

  /**
   * Get or generate a feature region.
   * @returns {Array} features in this region
   */
  _getFeatureRegion(rx, ry, rz) {
    const key = `fr:${rx},${ry},${rz}`;
    if (this._featureRegionCache.has(key)) {
      const region = this._featureRegionCache.get(key);
      this._featureRegionCache.delete(key);
      this._featureRegionCache.set(key, region);
      return region;
    }

    const features = this._generateFeatureRegion(rx, ry, rz);

    this._featureRegionCache.set(key, features);
    if (this._featureRegionCache.size > this._maxFeatureRegions) {
      const oldestKey = this._featureRegionCache.keys().next().value;
      this._featureRegionCache.delete(oldestKey);
    }

    return features;
  }

  /**
   * Generate features for a region.
   * Samples candidate positions within the region and rolls for feature placement.
   */
  _generateFeatureRegion(rx, ry, rz) {
    const S = this._featureRegionSize;
    const seed = this.masterSeed + `-feat-${rx},${ry},${rz}`;
    const rng = new SeededRandom(seed);

    const features = [];

    // Sample candidate positions in a grid within the region
    // 4 kpc region → 8 candidate points per axis = 512 candidates (most will be rejected)
    const samples = 8;
    const step = S / samples;

    for (let ix = 0; ix < samples; ix++) {
      for (let iy = 0; iy < samples; iy++) {
        for (let iz = 0; iz < samples; iz++) {
          const x = rx * S + (ix + rng.float()) * step;
          const y = ry * S + (iy + rng.float()) * step;
          const z = rz * S + (iz + rng.float()) * step;

          const R = Math.sqrt(x * x + z * z);
          const theta = Math.atan2(z, x);
          if (R > GalacticMap.GALAXY_RADIUS || Math.abs(y) > GalacticMap.GALAXY_HEIGHT) continue;

          const densities = this.potentialDerivedDensity(R, y);
          const armStr = this.spiralArmStrength(R, theta);

          // Derive context for this candidate position
          const ctxRng = new SeededRandom(`${seed}-ctx-${ix}-${iy}-${iz}`);
          const component = this._dominantComponent(densities);
          const metallicity = this._deriveMetallicity(ctxRng, component, R, y);
          const age = this._deriveAge(ctxRng, component, armStr);

          const ctx = {
            component,
            componentWeights: densities,
            spiralArmStrength: armStr,
            metallicity,
            age,
            totalDensity: densities.totalDensity,
          };

          // Roll for each feature type
          for (const [type, spec] of Object.entries(GalacticMap.FEATURE_TYPES)) {
            if (!spec.conditions(ctx)) continue;

            // Probability calibrated against real Milky Way feature counts.
            // Galaxy has ~84 feature regions × 512 candidates = ~43,000 total candidates.
            // After condition filtering, ~30-50% pass → ~15,000 valid candidates.
            // Scale per-candidate probability to hit realistic galaxy-wide targets.
            const densityScale = Math.min(densities.totalDensity * 15, 2.0);
            const galaxyTarget = spec.galaxyWideTarget || 100;
            // Estimated valid candidates galaxy-wide for this type
            const estValidCandidates = 15000 * spec.probability;
            const perCandidateProb = Math.min(0.95,
              (galaxyTarget / Math.max(estValidCandidates, 100)) * densityScale
            );

            if (!rng.chance(perCandidateProb)) continue;

            const featureRng = rng.child(`${type}-${ix}-${iy}-${iz}`);
            const radius = featureRng.range(...spec.sizeRange);

            features.push({
              type,
              position: { x, y, z },
              radius,
              seed: `${seed}-${type}-${ix}-${iy}-${iz}`,
              color: [...spec.color],
              context: {
                metallicity: spec.contextOverrides.metallicityOverride ?? metallicity + (spec.contextOverrides.metallicityBoost || 0),
                age: spec.contextOverrides.ageOverride ?? Math.min(age, spec.contextOverrides.ageMax || age),
                component,
                armStrength: armStr,
              },
              overrides: spec.contextOverrides,
              // Precomputed for spatial queries
              R_kpc: R,
              z_kpc: y,
            });
          }
        }
      }
    }

    return features;
  }

  /**
   * Get dominant component name from density weights.
   */
  _dominantComponent(densities) {
    const entries = [
      ['thin', densities.thin], ['thick', densities.thick],
      ['bulge', densities.bulge], ['halo', densities.halo],
    ];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }

  /**
   * Find all galactic features near a position.
   * Searches the 3x3x3 neighborhood of feature regions.
   * @param {{ x, y, z }} position
   * @param {number} maxDistance - max distance in kpc (default 2.0)
   * @returns {Array} features sorted by distance
   */
  findNearbyFeatures(position, maxDistance = 2.0) {
    const { rx, ry, rz } = this._featureRegionIndices(position.x, position.y, position.z);
    const results = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const features = this._getFeatureRegion(rx + dx, ry + dy, rz + dz);
          for (const f of features) {
            const distX = f.position.x - position.x;
            const distY = f.position.y - position.y;
            const distZ = f.position.z - position.z;
            const dist = Math.sqrt(distX * distX + distY * distY + distZ * distZ);
            if (dist < maxDistance + f.radius) {
              results.push({ ...f, distance: dist, insideFeature: dist < f.radius });
            }
          }
        }
      }
    }

    results.sort((a, b) => a.distance - b.distance);
    return results;
  }

  /**
   * Find features that overlap a specific sector.
   * Used by _generateSector to determine feature context for stars.
   * @param {number} sx, sy, sz - sector grid coords
   * @returns {Array} overlapping features
   */
  findFeaturesOverlappingSector(sx, sy, sz) {
    const S = GalacticMap.SECTOR_SIZE;
    const centerX = (sx + 0.5) * S;
    const centerY = (sy + 0.5) * S;
    const centerZ = (sz + 0.5) * S;
    // Sector diagonal ≈ 0.5 * √3 ≈ 0.87 kpc
    const sectorDiag = S * Math.sqrt(3) / 2;
    return this.findNearbyFeatures(
      { x: centerX, y: centerY, z: centerZ },
      sectorDiag, // only features that actually overlap
    );
  }

  // ════════════════════════════════════════════════════════════
  // NAVIGATION — finding nearby stars
  // ════════════════════════════════════════════════════════════

  /**
   * Find the N nearest stars to a galactic position.
   * Searches a 3x3x3 neighborhood of sectors (27 sectors).
   *
   * @param {{ x, y, z }} position - world coords in kpc
   * @param {number} count - how many to return
   * @returns {Array} sorted by distance, closest first
   */
  findNearestStars(position, count = 20) {
    const { sx, sy, sz } = this.worldToSector(position.x, position.y, position.z);

    // Search radius scales with requested count:
    // count ≤ 30  → 3x3x3 = 27 sectors (fast, ~1.5 kpc)
    // count ≤ 200 → 5x5x5 = 125 sectors (~2.5 kpc)
    // count > 200 → 7x7x7 = 343 sectors (~3.5 kpc)
    const halfR = count <= 30 ? 1 : count <= 200 ? 2 : 3;

    const candidates = [];
    for (let dx = -halfR; dx <= halfR; dx++) {
      for (let dy = -halfR; dy <= halfR; dy++) {
        for (let dz = -halfR; dz <= halfR; dz++) {
          const sector = this.getSector(sx + dx, sy + dy, sz + dz);
          for (const star of sector.stars) {
            const distX = star.worldX - position.x;
            const distY = star.worldY - position.y;
            const distZ = star.worldZ - position.z;
            const distSq = distX * distX + distY * distY + distZ * distZ;
            candidates.push({ ...star, distSq });
          }
        }
      }
    }

    // Sort by distance, return top N
    candidates.sort((a, b) => a.distSq - b.distSq);
    return candidates.slice(0, count);
  }

  /**
   * Find all stars visible to the naked eye from a position.
   * Searches outward in expanding shells, pre-filtering sectors:
   * if no star in a sector could possibly be visible (based on the
   * sector's brightest possible spectral type and distance), skip it.
   *
   * This eliminates the need for artificial background stars —
   * every visible point is a real GalacticMap star.
   *
   * @param {{ x, y, z }} position
   * @param {number} magThreshold — apparent magnitude limit (default 6.5 = naked eye)
   * @returns {Array} visible stars sorted by apparent magnitude (brightest first)
   */
  findVisibleStars(position, magThreshold = 6.5) {
    const { sx, sy, sz } = this.worldToSector(position.x, position.y, position.z);
    const S = GalacticMap.SECTOR_SIZE;
    const candidates = [];

    // Maximum search radius: O-class visible to ~10 kpc = 20 sectors
    const maxHalfR = 20;

    // Brightest absolute magnitude per component type
    // (what's the most luminous star a sector of this type could contain?)
    const brightestMagByComponent = {
      thin: -5.0,  // O-class in disk/arms
      thick: 3.0,  // F-class (no O/B in thick disk)
      bulge: 1.5,  // A-class (some young bulge stars)
      halo: 7.0,   // K-class (no hot stars in halo)
    };

    for (let halfR = 0; halfR <= maxHalfR; halfR++) {
      // Only iterate the SHELL at this radius (not the full cube)
      // This avoids re-checking inner sectors
      for (let dx = -halfR; dx <= halfR; dx++) {
        for (let dy = -halfR; dy <= halfR; dy++) {
          for (let dz = -halfR; dz <= halfR; dz++) {
            // Only process the outer shell
            if (Math.abs(dx) < halfR && Math.abs(dy) < halfR && Math.abs(dz) < halfR) continue;

            // Sector center distance from player
            const sectorCenterX = (sx + dx + 0.5) * S;
            const sectorCenterY = (sy + dy + 0.5) * S;
            const sectorCenterZ = (sz + dz + 0.5) * S;
            const distX = sectorCenterX - position.x;
            const distY = sectorCenterY - position.y;
            const distZ = sectorCenterZ - position.z;
            const sectorDist = Math.sqrt(distX * distX + distY * distY + distZ * distZ);

            // ── Sector-level visibility pre-filter ──
            // What's the brightest star this sector could contain?
            const sectorR = Math.sqrt(sectorCenterX * sectorCenterX + sectorCenterZ * sectorCenterZ);
            if (sectorR > GalacticMap.GALAXY_RADIUS * 1.2) continue;
            if (Math.abs(sectorCenterY) > GalacticMap.GALAXY_HEIGHT * 2) continue;

            const sectorDensities = this.potentialDerivedDensity(sectorR, sectorCenterY);
            const sectorArm = this.spiralArmStrength(sectorR, Math.atan2(sectorCenterZ, sectorCenterX));

            // Determine brightest possible spectral type
            const comp = this._dominantComponent(sectorDensities);
            let brightestMag = brightestMagByComponent[comp] ?? 7.0;
            // Arm boost: arms can have O-class even in thick disk regions
            if (sectorArm > 0.3 && comp !== 'halo') brightestMag = Math.min(brightestMag, -5.0);

            // Apparent magnitude of the brightest possible star at this distance
            const d_pc = Math.max(sectorDist * 1000, 0.1);
            const bestApparentMag = brightestMag + 5 * Math.log10(d_pc / 10);

            // If even the brightest possible star is invisible, skip this sector
            if (bestApparentMag > magThreshold + 1.0) continue; // +1 margin for edge cases

            // ── Sector passes pre-filter — generate and check individual stars ──
            const sector = this.getSector(sx + dx, sy + dy, sz + dz);
            for (const star of sector.stars) {
              const sdx = star.worldX - position.x;
              const sdy = star.worldY - position.y;
              const sdz = star.worldZ - position.z;
              const distSq = sdx * sdx + sdy * sdy + sdz * sdz;
              if (distSq < 0.001 * 0.001) continue; // skip self

              candidates.push({ ...star, distSq });
            }
          }
        }
      }

      // Early exit: if we've searched far enough that no more O-class stars
      // could be visible, stop expanding
      const shellDist = halfR * S;
      const bestPossibleMag = -5.0 + 5 * Math.log10(Math.max(shellDist * 1000, 0.1) / 10);
      if (bestPossibleMag > magThreshold + 1.0) break;
    }

    // Sort by distance for consistent ordering
    candidates.sort((a, b) => a.distSq - b.distSq);
    return candidates;
  }

  /**
   * Get external galaxies visible from this galaxy.
   * These are fixed objects at enormous distances — their sky positions
   * barely change regardless of where you are within the home galaxy.
   * Generated deterministically from the galaxy seed.
   *
   * @returns {Array<{ name, type, direction: {x,y,z}, angularSize, brightness, seed }>}
   */
  getExternalGalaxies() {
    if (this._externalGalaxies) return this._externalGalaxies;

    const rng = new SeededRandom(this.masterSeed + '-external-galaxies');
    const galaxies = [];

    // Generate 5-8 external galaxies at fixed sky positions
    const count = rng.int(5, 8);
    const types = ['spiral', 'elliptical', 'irregular', 'dwarf'];
    const typeWeights = [0.35, 0.30, 0.15, 0.20];

    for (let i = 0; i < count; i++) {
      // Random direction on sphere (fixed per galaxy seed)
      const theta = rng.range(0, Math.PI * 2);
      const phi = Math.acos(rng.range(-1, 1));
      const dirX = Math.sin(phi) * Math.cos(theta);
      const dirY = Math.cos(phi);
      const dirZ = Math.sin(phi) * Math.sin(theta);

      // Avoid the galactic plane (Zone of Avoidance — dust blocks visibility)
      // Re-roll if too close to the disk plane
      if (Math.abs(dirY) < 0.15) continue;

      // Pick type
      let roll = rng.float();
      let type = 'spiral';
      let cumulative = 0;
      for (let t = 0; t < types.length; t++) {
        cumulative += typeWeights[t];
        if (roll < cumulative) { type = types[t]; break; }
      }

      // Angular size: very small (these are millions of light-years away)
      // Largest (Andromeda-equivalent): ~0.02 radians (~1 degree)
      // Most: ~0.003-0.008 radians
      const isLarge = i === 0; // first one is the "Andromeda" — largest
      const angularSize = isLarge
        ? rng.range(0.015, 0.025)
        : rng.range(0.002, 0.008);

      // Brightness: faint smudges
      const brightness = isLarge ? 0.12 : rng.range(0.03, 0.08);

      // Name
      const nameRng = rng.child(`name-${i}`);
      const prefixes = ['NGC', 'IC', 'M', 'UGC', 'PGC'];
      const prefix = nameRng.pick(prefixes);
      const num = nameRng.int(100, 9999);

      galaxies.push({
        name: `${prefix} ${num}`,
        type,
        direction: { x: dirX, y: dirY, z: dirZ },
        angularSize,
        brightness,
        seed: `${this.masterSeed}-extgal-${i}`,
      });
    }

    this._externalGalaxies = galaxies;
    return galaxies;
  }

  /**
   * Get the default starting position (solar neighborhood).
   */
  getStartPosition() {
    return {
      x: GalacticMap.SOLAR_R,
      y: GalacticMap.SOLAR_Z,
      z: 0.0,
    };
  }
}
