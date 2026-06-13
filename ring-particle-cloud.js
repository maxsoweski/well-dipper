import * as THREE from 'three';

// RingRenderer.js:28-33 composition palette (same as the impostor uses).
export const COMPOSITION_COLORS = {
  ice:   [0.85, 0.92, 0.98],
  rock:  [0.35, 0.32, 0.30],
  dust:  [0.55, 0.45, 0.35],
  mixed: [0.60, 0.58, 0.55],
};

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Bake a particle cloud from a ring physics profile. PURE — no three.js objects,
 * no global RNG (pass `rng` for determinism). Returns flat typed arrays.
 *
 * Density is sampled from the SAME ringlet/gap profile the impostor shader draws,
 * so dense ringlets get many particles and gaps get none — the cloud inherits the
 * banded structure and the cloud↔impostor seam stays invisible.
 *
 * @param {object} physics - { ringlets:[{innerR,outerR,opacity,composition}], gaps:[{radius,width}], innerRadius, outerRadius, density }
 * @param {object} opts - { count, R, thickness, rng, sizeMin, sizeMax }
 * @returns {{positions:Float32Array, colors:Float32Array, sizes:Float32Array, count:number}}
 */
export function bakeRingCloud(physics, opts = {}) {
  const {
    count = 80000,
    R = 1.0,
    thickness = 0.02,   // vertical half-extent as a fraction of innerRadius*R (disk depth)
    rng = Math.random,
    sizeMin = 1.0,
    sizeMax = 3.0,
  } = opts;

  const innerR = R * physics.innerRadius;
  const outerR = R * physics.outerRadius;
  const yHalf = thickness * innerR;

  const ringlets = (physics.ringlets || []).filter(r => r.outerR - r.innerR > 0.001);
  const gaps = physics.gaps || [];

  function densityAt(r) {
    let dens = 0, comp = 'mixed';
    for (const rl of ringlets) {
      const a = R * rl.innerR, b = R * rl.outerR;
      if (r >= a && r <= b) {
        const t = (r - a) / Math.max(1e-4, b - a);
        const edge = smoothstep(0, 0.08, t) * (1 - smoothstep(0.92, 1, t));
        const d = (rl.opacity ?? 0.5) * edge;
        if (d > dens) { dens = d; comp = rl.composition || 'mixed'; }
      }
    }
    for (const g of gaps) {
      const gd = Math.abs(r - R * g.radius);
      dens *= smoothstep(0, R * (g.width || 0.05), gd);
    }
    return { dens, comp };
  }

  // Peak of density×r (area weighting) for rejection sampling.
  let maxW = 1e-4;
  const SAMPLES = 512;
  for (let i = 0; i <= SAMPLES; i++) {
    const r = innerR + (outerR - innerR) * (i / SAMPLES);
    maxW = Math.max(maxW, densityAt(r).dens * r);
  }

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  let placed = 0, guard = 0;
  const guardMax = count * 200;
  while (placed < count && guard < guardMax) {
    guard++;
    const r = innerR + (outerR - innerR) * rng();
    const { dens, comp } = densityAt(r);
    if (rng() * maxW > dens * r) continue;   // reject (area-weighted by r)
    const theta = rng() * Math.PI * 2;
    const y = (rng() * 2 - 1) * yHalf;
    const i3 = placed * 3;
    positions[i3] = r * Math.cos(theta);
    positions[i3 + 1] = y;
    positions[i3 + 2] = r * Math.sin(theta);
    const c = COMPOSITION_COLORS[comp] || COMPOSITION_COLORS.mixed;
    colors[i3] = c[0]; colors[i3 + 1] = c[1]; colors[i3 + 2] = c[2];
    sizes[placed] = sizeMin + rng() * (sizeMax - sizeMin);
    placed++;
  }

  return {
    positions: positions.subarray(0, placed * 3),
    colors: colors.subarray(0, placed * 3),
    sizes: sizes.subarray(0, placed),
    count: placed,
  };
}
