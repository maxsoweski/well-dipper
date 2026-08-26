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

/**
 * Build the near-tier point-sprite cloud as a THREE.Points.
 * Shader adapts src/objects/Galaxy.js but: NormalBlending (rings reflect, not emit —
 * additive would wash dense ringlets white), a camera-distance LOD ramp (full size
 * below dResolve, zero beyond dCull), per-particle analytic planet-shadow, and a
 * 6-level posterize so it sits inside the retro envelope.
 *
 * The cloud is centered on the planet (add it as a child of / sibling tilted with the
 * planet), so `position` is already relative to the planet center → the shadow test
 * mirrors the impostor's (world-engine-lab.html:4676-4682).
 *
 * @param {object} baked - output of bakeRingCloud
 * @param {object} opts - { pointScale, dResolve, dCull, planetRadius, lightDir:[x,y,z], sizeClamp }
 */
export function makeRingCloudPoints(baked, opts = {}) {
  const {
    pointScale = 300,
    dResolve = 4,      // camera dist (object-space units, planet R=1): particles full size at/under this
    dCull = 14,        // camera dist: particles faded to zero beyond this → impostor alone
    planetRadius = 1,
    lightDir = [0.6, 0.35, 0.7],
    sizeClamp = 24.0,  // RT-pixel clamp so closest particles don't blow up into full-screen squares
  } = opts;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(baked.positions, 3));
  geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(baked.colors, 3));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(baked.sizes, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // NormalBlending (default) — NOT additive.
    uniforms: {
      uTime: { value: 0 },
      uPointScale: { value: pointScale },
      uDResolve: { value: dResolve },
      uDCull: { value: dCull },
      uPlanetRadius: { value: planetRadius },
      uLightDir: { value: new THREE.Vector3(lightDir[0], lightDir[1], lightDir[2]).normalize() },
      uSizeClamp: { value: sizeClamp },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      uniform float uTime;
      uniform float uPointScale;
      uniform float uDResolve;
      uniform float uDCull;
      uniform float uPlanetRadius;
      uniform vec3 uLightDir;
      uniform float uSizeClamp;
      varying vec3 vColor;
      varying float vTwinkle;
      varying float vShadow;
      varying float vLod;
      void main() {
        vColor = aColor;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPos;

        // LOD ramp: 1 when nearer than dResolve, 0 beyond dCull.
        float camDist = length(mvPos.xyz);
        float lod = 1.0 - smoothstep(uDResolve, uDCull, camDist);
        vLod = lod;

        float distScale = uPointScale / max(-mvPos.z, 1.0);
        float sz = aSize * distScale * lod;
        gl_PointSize = clamp(sz, 0.0, uSizeClamp);

        // Per-particle analytic planet-shadow (object space; position is relative to
        // planet center). Mirrors impostor world-engine-lab.html:4676-4682.
        float shadowDist = length(cross(position, uLightDir));
        float behind = step(dot(position, uLightDir), 0.0);
        float inShadow = behind * (1.0 - smoothstep(uPlanetRadius * 0.9, uPlanetRadius * 1.1, shadowDist));
        vShadow = 1.0 - inShadow;

        float hash = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);
        vTwinkle = 0.85 + 0.15 * sin(uTime * (0.1 + hash * 0.2) + hash * 6.28);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vTwinkle;
      varying float vShadow;
      varying float vLod;

      float bayerDither(vec2 coord) {
        vec2 p = mod(floor(coord), 4.0);
        float t = 0.0;
        if (p.y < 0.5) {
          t = (p.x < 0.5) ? 0.0 : (p.x < 1.5) ? 8.0 : (p.x < 2.5) ? 2.0 : 10.0;
        } else if (p.y < 1.5) {
          t = (p.x < 0.5) ? 12.0 : (p.x < 1.5) ? 4.0 : (p.x < 2.5) ? 14.0 : 6.0;
        } else if (p.y < 2.5) {
          t = (p.x < 0.5) ? 3.0 : (p.x < 1.5) ? 11.0 : (p.x < 2.5) ? 1.0 : 9.0;
        } else {
          t = (p.x < 0.5) ? 15.0 : (p.x < 1.5) ? 7.0 : (p.x < 2.5) ? 13.0 : 5.0;
        }
        return t / 16.0;
      }
      vec3 posterize6(vec3 c, vec2 fc) {
        float dither = bayerDither(fc) - 0.5;
        vec3 d = c + dither * 0.4 / 6.0;
        return floor(d * 6.0 + 0.5) / 6.0;
      }

      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = 1.0 - smoothstep(0.0, 0.5, d);   // round glint
        alpha *= vTwinkle * vLod;
        vec3 color = vColor * mix(0.18, 1.0, vShadow); // dim in shadow
        alpha *= mix(0.2, 1.0, vShadow);               // shadowed particles go sparse → stars through

        float threshold = bayerDither(gl_FragCoord.xy);
        if (alpha < threshold) discard;                // dither-discard translucency

        color = posterize6(color, gl_FragCoord.xy);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  return new THREE.Points(geometry, material);
}
