import { SeededRandom } from './SeededRandom.js';
import { GalacticMap } from './GalacticMap.js';

/**
 * MilkyWayModel — generates a 3D particle cloud of the player's galaxy.
 *
 * Unlike GalaxyGenerator (which makes generic spiral/elliptical galaxies for
 * deep-sky destinations), this uses GalacticMap's ACTUAL density model —
 * same gravitational potential, same spiral arms, same proportions.
 *
 * The particle cloud is a "physical model" that can be photographed:
 *   - From above → top-down nav textures
 *   - From inside the disk → equirectangular glow skybox textures
 *   - At any resolution needed
 *
 * Returns plain data (Float32Arrays) — no Three.js dependency.
 *
 * Coordinates: X/Z = galactic plane (kpc), Y = above/below plane (kpc).
 * Center of galaxy at origin. Sun at roughly (8, 0, 0).
 */
export class MilkyWayModel {

  /**
   * Generate the full galaxy particle model.
   *
   * @param {GalacticMap} galacticMap — the live galaxy instance (for density queries)
   * @param {Object} [options]
   * @param {number} [options.totalParticles=600000] — total particle budget
   * @param {string} [options.seed='milky-way-model'] — RNG seed for reproducibility
   * @returns {{ positions, colors, sizes, populations, particleCount, radius }}
   */
  static generate(galacticMap, options = {}) {
    const {
      totalParticles = 600000,
      seed = 'milky-way-model',
    } = options;

    const rng = new SeededRandom(seed);
    const R_MAX = GalacticMap.GALAXY_RADIUS;  // 15 kpc

    // Population budgets — no halo (causes stray particles outside disk)
    const budgets = {
      thinDiskArm:    Math.floor(totalParticles * 0.38), // bright arm stars
      thinDiskInter:  Math.floor(totalParticles * 0.22), // dimmer inter-arm disk
      thickDisk:      Math.floor(totalParticles * 0.15), // warm, diffuse
      bulge:          Math.floor(totalParticles * 0.22), // concentrated center
      hiiRegions:     Math.floor(totalParticles * 0.03), // pink star-forming knots
    };
    // Fill remainder into thin disk arm
    const allocated = Object.values(budgets).reduce((a, b) => a + b, 0);
    budgets.thinDiskArm += totalParticles - allocated;

    const positions = new Float32Array(totalParticles * 3);
    const colors = new Float32Array(totalParticles * 3);
    const sizes = new Float32Array(totalParticles);
    // Population tag per particle (0-5) for optional filtering
    const populations = new Uint8Array(totalParticles);

    let idx = 0;

    // ── Helper: reject-sample a position from the density model ──
    // Returns { R, theta, z } in galactic cylindrical coords
    const sampleDisk = (component, armBias) => {
      // Envelope for rejection sampling:
      // R: exponential with scale ~3 kpc (broader than real to catch arms)
      // z: Gaussian with scale depending on component
      const zScale = component === 'thick' ? 0.9 : 0.3; // kpc
      const rScale = component === 'bulge' ? 1.5 : 3.5;  // kpc

      for (let attempt = 0; attempt < 200; attempt++) {
        // Sample candidate position
        const R = -rScale * Math.log(rng.float() || 0.0001);
        if (R > R_MAX || R < 0.01) continue;

        const theta = rng.range(0, 2 * Math.PI);
        const z = MilkyWayModel._gaussian(rng) * zScale;
        if (Math.abs(z) > 2) continue; // keep everything within the visible disk

        // Get density at this position
        const densities = galacticMap.potentialDerivedDensity(R, z);
        const armStr = galacticMap.spiralArmStrength(R, theta);

        // Radial taper — outer 30% gets progressively sparser
        const outerStart = R_MAX * 0.7;
        const radialTaper = R < outerStart ? 1.0 :
          1.0 - ((R - outerStart) / (R_MAX - outerStart));

        // Target density for this component
        let targetDensity;
        if (component === 'thin') {
          targetDensity = densities.totalDensity * densities.thin;
          if (armBias) {
            // Stronger arm concentration than before, but not so extreme it starves
            targetDensity *= (0.1 + armStr * 3.0);
          } else {
            // Inter-arm: noticeably sparser
            targetDensity *= (1.0 - armStr * 0.6) * 0.4;
          }
          targetDensity *= radialTaper;
        } else if (component === 'thick') {
          targetDensity = densities.totalDensity * densities.thick * radialTaper;
        } else if (component === 'bulge') {
          targetDensity = densities.totalDensity * densities.bulge;
        } else {
          targetDensity = densities.totalDensity * radialTaper;
        }

        // Envelope density (generous upper bound for the exponential envelope)
        const envelopeDensity = 0.8 * Math.exp(-R / rScale);

        // Accept/reject
        const acceptance = targetDensity / Math.max(envelopeDensity, 1e-10);
        if (rng.float() < Math.min(acceptance, 1.0)) {
          // Dust lane rejection: thin out stars in dust-dense regions.
          // Dust sits on the inner (trailing) edge of arms, R > 3 kpc.
          if (R > 3.0 && component === 'thin') {
            let dustStr = 0;
            const sinPitch = Math.sin(galacticMap.pitchAngle);
            for (const arm of galacticMap.arms) {
              const expected = arm.offset + galacticMap.pitchK * Math.log(R / 4.0) - 0.08;
              let dTheta = ((theta - expected) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
              const dist = Math.abs(dTheta) * R * sinPitch;
              const w = arm.width * 0.35;
              const g = Math.exp(-0.5 * (dist / w) ** 2) * (arm.densityBoost / 2.5);
              if (g > dustStr) dustStr = g;
            }
            // Reject some fraction of stars in dusty regions
            if (dustStr > 0.3 && rng.float() < dustStr * 0.6) {
              continue; // rejected by dust — try again
            }
          }
          return { R, theta, z };
        }
      }

      // Fallback: random disk position (shouldn't happen often)
      return {
        R: rng.range(0.1, R_MAX),
        theta: rng.range(0, 2 * Math.PI),
        z: MilkyWayModel._gaussian(rng) * zScale,
      };
    };

    // ── Helper: cylindrical → cartesian ──
    const toXYZ = (R, theta, z) => ({
      x: R * Math.cos(theta),
      y: z,
      z: R * Math.sin(theta),
    });

    // ═══════════════════════════════════════════
    // POPULATION 1: Thin disk — arm stars (blue-white, bright)
    // ═══════════════════════════════════════════
    for (let i = 0; i < budgets.thinDiskArm; i++) {
      const { R, theta, z } = sampleDisk('thin', true);
      const p = toXYZ(R, theta, z);
      const armStr = galacticMap.spiralArmStrength(R, theta);

      positions[idx * 3]     = p.x;
      positions[idx * 3 + 1] = p.y;
      positions[idx * 3 + 2] = p.z;

      // Blue-white young stars, warmer toward center
      const normalizedR = R / R_MAX;
      const blend = Math.min(1, normalizedR * 2); // 0=center, 1=outer
      const blue = rng.range(0.6, 1.0);
      // Core-to-arm gradient
      const cr = blue * (0.6 + 0.3 * (1 - blend));
      const cg = blue * (0.7 + 0.25 * blend);
      const cb = blue;

      // Occasional old red giants even in arms (8%)
      if (rng.chance(0.08)) {
        const w = rng.range(0.7, 1.0);
        colors[idx * 3]     = w;
        colors[idx * 3 + 1] = w * rng.range(0.4, 0.55);
        colors[idx * 3 + 2] = w * rng.range(0.15, 0.3);
      } else {
        colors[idx * 3]     = cr;
        colors[idx * 3 + 1] = cg;
        colors[idx * 3 + 2] = cb;
      }

      // Brighter particles where arm density is high
      sizes[idx] = rng.range(0.5, 1.2) + armStr * 0.6;
      populations[idx] = 0;
      idx++;
    }

    // ═══════════════════════════════════════════
    // POPULATION 2: Thin disk — inter-arm (dimmer, warmer)
    // ═══════════════════════════════════════════
    for (let i = 0; i < budgets.thinDiskInter; i++) {
      const { R, theta, z } = sampleDisk('thin', false);
      const p = toXYZ(R, theta, z);

      positions[idx * 3]     = p.x;
      positions[idx * 3 + 1] = p.y;
      positions[idx * 3 + 2] = p.z;

      // Warmer yellow-white (older field stars)
      const w = rng.range(0.6, 0.9);
      colors[idx * 3]     = w;
      colors[idx * 3 + 1] = w * rng.range(0.75, 0.9);
      colors[idx * 3 + 2] = w * rng.range(0.5, 0.7);

      sizes[idx] = rng.range(0.4, 1.0);
      populations[idx] = 1;
      idx++;
    }

    // ═══════════════════════════════════════════
    // POPULATION 3: Thick disk (warm, vertically extended)
    // ═══════════════════════════════════════════
    for (let i = 0; i < budgets.thickDisk; i++) {
      const { R, theta, z } = sampleDisk('thick', false);
      const p = toXYZ(R, theta, z);

      positions[idx * 3]     = p.x;
      positions[idx * 3 + 1] = p.y;
      positions[idx * 3 + 2] = p.z;

      // Warm orange-yellow (old metal-poor stars)
      const w = rng.range(0.65, 0.95);
      colors[idx * 3]     = w;
      colors[idx * 3 + 1] = w * rng.range(0.6, 0.78);
      colors[idx * 3 + 2] = w * rng.range(0.3, 0.5);

      sizes[idx] = rng.range(0.4, 0.9);
      populations[idx] = 2;
      idx++;
    }

    // ═══════════════════════════════════════════
    // POPULATION 4: Bulge (dense center, warm-hot)
    // ═══════════════════════════════════════════
    for (let i = 0; i < budgets.bulge; i++) {
      const { R, theta, z } = sampleDisk('bulge', false);
      const p = toXYZ(R, theta, z);

      positions[idx * 3]     = p.x;
      positions[idx * 3 + 1] = p.y;
      positions[idx * 3 + 2] = p.z;

      // Hot yellow-orange (old metal-rich bulge stars)
      const w = rng.range(0.8, 1.0);
      colors[idx * 3]     = w;
      colors[idx * 3 + 1] = w * rng.range(0.68, 0.85);
      colors[idx * 3 + 2] = w * rng.range(0.35, 0.55);

      // Larger toward center for brightness
      const coreBrightness = Math.max(0, 1 - R / 3);
      sizes[idx] = rng.range(0.6, 1.5) + coreBrightness * 1.0;
      populations[idx] = 3;
      idx++;
    }

    // ═══════════════════════════════════════════
    // POPULATION 5: HII regions (pink/red, arm-only)
    // ═══════════════════════════════════════════
    for (let i = 0; i < budgets.hiiRegions; i++) {
      const { R, theta, z } = sampleDisk('thin', true);
      const p = toXYZ(R, theta, z);

      positions[idx * 3]     = p.x;
      positions[idx * 3 + 1] = p.y;
      positions[idx * 3 + 2] = p.z;

      // H-alpha pink/red (star-forming nebulae)
      colors[idx * 3]     = rng.range(0.75, 1.0);
      colors[idx * 3 + 1] = rng.range(0.15, 0.35);
      colors[idx * 3 + 2] = rng.range(0.25, 0.45);

      // Slightly larger — these are nebulae, not point stars
      sizes[idx] = rng.range(1.0, 2.5);
      populations[idx] = 4;
      idx++;
    }

    return {
      positions,
      colors,
      sizes,
      populations,
      particleCount: totalParticles,
      radius: R_MAX,
      // Population labels for reference
      populationNames: [
        'thinDiskArm', 'thinDiskInter', 'thickDisk',
        'bulge', 'hiiRegions',
      ],
      budgets,
    };
  }

  /**
   * Generate dust cloud particles — separate from stars.
   * Dust concentrates on the inner (trailing) edges of spiral arms
   * with a thin vertical profile (~100 pc). These render as dark
   * absorbing particles with normal blending.
   *
   * @param {GalacticMap} galacticMap
   * @param {Object} [options]
   * @param {number} [options.dustParticles=150000]
   * @param {string} [options.seed='milky-way-dust']
   * @returns {{ positions, sizes, dustCount }}
   */
  static generateDust(galacticMap, options = {}) {
    const {
      dustParticles = 200000,
      seed = 'milky-way-dust',
    } = options;

    const rng = new SeededRandom(seed);
    const R_MAX = GalacticMap.GALAXY_RADIUS;
    const pitchAngle = GalacticMap.ARM_PITCH_DEG * Math.PI / 180;
    const pitchK = 1.0 / Math.tan(pitchAngle);
    const sinPitch = Math.sin(pitchAngle);

    const positions = new Float32Array(dustParticles * 3);
    const sizes = new Float32Array(dustParticles);

    let idx = 0;
    const arms = galacticMap.arms;
    const R_MIN = 3.0; // no dust near core — too bright/hot

    for (let i = 0; i < dustParticles; i++) {
      let R;
      for (let attempt = 0; attempt < 50; attempt++) {
        R = -3.5 * Math.log(rng.float() || 0.0001);
        if (R > R_MIN && R < R_MAX * 0.85) break;
      }
      if (R < R_MIN || R > R_MAX) R = rng.range(R_MIN, 12);

      const arm = arms[Math.floor(rng.float() * arms.length)];
      const expectedTheta = arm.offset + pitchK * Math.log(R / 4.0);

      // Inner (trailing) edge offset
      const innerOffset = -0.06 - rng.range(0, 0.04);
      // Scatter perpendicular — tighter packing along lane
      const perpScatter = MilkyWayModel._gaussian(rng) * arm.width * 0.35 * sinPitch;
      const theta = expectedTheta + innerOffset + perpScatter / R;

      // Thin vertical — ~120 pc scale height
      const z = MilkyWayModel._gaussian(rng) * 0.12;

      positions[idx * 3]     = R * Math.cos(theta);
      positions[idx * 3 + 1] = z;
      positions[idx * 3 + 2] = R * Math.sin(theta);

      // Small particles — tightly packed, not individually visible
      sizes[idx] = rng.range(0.3, 1.5);
      idx++;
    }

    return { positions, sizes, dustCount: dustParticles };
  }

  /** Box-Muller Gaussian (mean 0, std 1). */
  static _gaussian(rng) {
    const u1 = rng.float() || 0.0001;
    const u2 = rng.float();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}
