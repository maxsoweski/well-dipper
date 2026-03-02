import * as THREE from 'three';

/**
 * GravityWell — a grid on the equatorial (XZ) plane that warps downward
 * around stars AND planets, visualizing spacetime curvature like the classic
 * "rubber sheet" analogy.
 *
 * Star wells use 1/r potential (classic funnel shape).
 * Planet wells use Gaussian (grid is too coarse for 1/r at planet scale).
 *
 * The Gaussian sigma for each planet is derived from its Hill sphere —
 * the region where the planet's gravity dominates over the star's.
 * This makes larger/farther planets have proportionally wider wells,
 * matching real gravitational physics.
 *
 * Hill sphere: r_Hill = orbitRadius × (planetMass / (3 × starMass))^(1/3)
 *
 * Toggled with the G key. Off by default.
 */

const MAX_PLANETS = 8;

export class GravityWell {
  constructor(gridExtent = 200, gridDivisions = 150) {
    this.gridExtent = gridExtent;
    this.gridDivisions = gridDivisions;
    this.totalStarMass = 1; // stored by setStars, used by setPlanets for Hill sphere
    const gridRadius = gridExtent;

    // ── Geometry: subdivided plane in the XZ plane ──
    const geometry = new THREE.PlaneGeometry(
      gridExtent * 2, gridExtent * 2,
      gridDivisions, gridDivisions,
    );
    geometry.rotateX(-Math.PI / 2);

    // Pre-allocate planet uniform arrays
    const planetPositions = [];
    const planetMasses = [];
    const planetSigmas = [];
    for (let i = 0; i < MAX_PLANETS; i++) {
      planetPositions.push(new THREE.Vector3(0, 0, 0));
      planetMasses.push(0.0);
      planetSigmas.push(3.0);
    }

    // ── Shader Material ──
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        starPos1: { value: new THREE.Vector3(0, 0, 0) },
        starPos2: { value: new THREE.Vector3(0, 0, 0) },
        starMass1: { value: 1.0 },
        starMass2: { value: 0.0 },
        starRadius1: { value: 1.0 },
        starRadius2: { value: 1.0 },

        planetPos: { value: planetPositions },
        planetMass: { value: planetMasses },
        planetSigma: { value: planetSigmas },
        planetCount: { value: 0 },

        wellDepth: { value: 1.0 },
        planetWellDepth: { value: 8.0 },
        gridSpacing: { value: 4.0 },
        gridColor: { value: new THREE.Vector3(0.0, 0.4, 0.6) },
        gridOpacity: { value: 0.22 },
        dotRadius: { value: 0.08 },
      },

      vertexShader: /* glsl */ `
        uniform vec3 starPos1;
        uniform vec3 starPos2;
        uniform float starMass1;
        uniform float starMass2;
        uniform float starRadius1;
        uniform float starRadius2;
        uniform float wellDepth;

        uniform vec3 planetPos[${MAX_PLANETS}];
        uniform float planetMass[${MAX_PLANETS}];
        uniform float planetSigma[${MAX_PLANETS}];
        uniform int planetCount;
        uniform float planetWellDepth;

        varying vec2 vGridPos;
        varying float vDepth;
        varying float vRadius;

        void main() {
          vec3 pos = position;

          vGridPos = pos.xz;
          vRadius = length(pos.xz);

          float circleRadius = ${gridRadius.toFixed(1)};
          if (vRadius > circleRadius) {
            gl_Position = vec4(0.0);
            vDepth = 0.0;
            return;
          }

          // ── Star: 1/r potential with Plummer softening ──
          // Plummer: -mass / sqrt(d² + soft²) instead of -mass / max(d, soft).
          // This creates a smooth rounded funnel bottom instead of a sharp
          // flat floor where 1/r hits the clamp — eliminates the geometric
          // angular look near the star where grid cells are too coarse
          // for the steep 1/r curve.
          // Softening radius = star visual radius × 1.5 — balances smooth
          // Plummer curve against sufficient depth for the star to dominate.
          float soft1 = starRadius1 * 1.5;
          float d1raw = length(pos.xz - starPos1.xz);
          float displacement = -starMass1 / sqrt(d1raw * d1raw + soft1 * soft1);

          if (starMass2 > 0.0) {
            float soft2 = starRadius2 * 1.5;
            float d2raw = length(pos.xz - starPos2.xz);
            displacement -= starMass2 / sqrt(d2raw * d2raw + soft2 * soft2);
          }

          displacement *= wellDepth;

          // ── Planets: Gaussian wells sized by Hill sphere ──
          // sigma = Hill sphere radius × 0.6, clamped to min 3.0 for grid visibility.
          // At the Hill sphere boundary (~1.7σ), the well is at ~24% depth — fading out.
          // Beyond 2× Hill sphere, the well is essentially gone (<4% depth).
          for (int i = 0; i < ${MAX_PLANETS}; i++) {
            if (i >= planetCount) break;
            float sigma = planetSigma[i];
            float dp = length(pos.xz - planetPos[i].xz);
            float well = planetMass[i] * exp(-(dp * dp) / (2.0 * sigma * sigma));
            displacement -= well * planetWellDepth;
          }

          displacement = max(displacement, -100.0);

          pos.y += displacement;
          vDepth = -displacement;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,

      fragmentShader: /* glsl */ `
        uniform float gridSpacing;
        uniform vec3 gridColor;
        uniform float gridOpacity;
        uniform float dotRadius;

        varying vec2 vGridPos;
        varying float vDepth;
        varying float vRadius;

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

        void main() {
          float circleRadius = ${gridRadius.toFixed(1)};
          if (vRadius > circleRadius) discard;

          // Scale world position to grid-cell coordinates
          vec2 gridUV = vGridPos / gridSpacing;

          // Distance to nearest grid intersection
          vec2 nearest = gridUV - round(gridUV);
          float dist = length(nearest);

          // Screen-space adaptive sizing (resolution independent)
          vec2 gridWidth = fwidth(gridUV);
          float pixelScale = length(gridWidth);

          // Soft-edged circular dot at each grid intersection
          float innerEdge = dotRadius - pixelScale * 0.5;
          float outerEdge = dotRadius + pixelScale * 0.5;
          float dotMask = 1.0 - smoothstep(max(innerEdge, 0.0), outerEdge, dist);

          // Depth glow: deeper wells = brighter cyan-white
          float depthGlow = smoothstep(0.0, 50.0, vDepth);
          vec3 color = mix(gridColor, vec3(0.3, 0.8, 1.0), depthGlow * 0.7);

          // Circular edge fadeout
          float edgeFade = 1.0 - smoothstep(circleRadius * 0.6, circleRadius * 0.98, vRadius);

          // Combined alpha: dot mask * opacity * depth boost * edge fade
          float alpha = dotMask * gridOpacity * (1.0 + depthGlow * 1.0) * edgeFade;

          // Bayer dithering for retro aesthetic
          float threshold = bayerDither(gl_FragCoord.xy);
          if (alpha < threshold) discard;

          gl_FragColor = vec4(color, 1.0);
        }
      `,

      transparent: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
  }

  /**
   * Configure star masses. Stores total mass for Hill sphere calculation.
   */
  setStars(starData1, starData2) {
    const massFactor = 200;
    const m1 = starData1.radius * massFactor;
    this.material.uniforms.starMass1.value = m1;
    this.material.uniforms.starRadius1.value = Math.max(starData1.radius, 0.8);

    let m2 = 0;
    if (starData2) {
      m2 = starData2.radius * massFactor;
      this.material.uniforms.starMass2.value = m2;
      this.material.uniforms.starRadius2.value = Math.max(starData2.radius, 0.8);
    } else {
      this.material.uniforms.starMass2.value = 0;
    }

    // Store total star mass for Hill sphere computation in setPlanets
    this.totalStarMass = m1 + m2;
  }

  /**
   * Configure planet masses and compute Hill sphere sigmas.
   *
   * Hill sphere: r_Hill = orbitRadius × (planetMass / (3 × starMass))^(1/3)
   * sigma = r_Hill × 0.6 (so the well fades out near the Hill sphere boundary)
   * Minimum sigma of 3.0 ensures even tiny planets are visible on the grid.
   */
  setPlanets(planetEntries) {
    const count = Math.min(planetEntries.length, MAX_PLANETS);
    this.material.uniforms.planetCount.value = count;

    for (let i = 0; i < MAX_PLANETS; i++) {
      if (i < count) {
        const entry = planetEntries[i];
        const r = entry.planet.data.radius;
        const mass = r * 1.5;
        const orbitRadius = entry.orbitRadius;

        // Hill sphere radius — where this planet's gravity dominates
        const hillRadius = orbitRadius * Math.pow(mass / (3 * this.totalStarMass), 1 / 3);

        // Use Hill sphere × 0.6 as sigma so the Gaussian well fades
        // out near the Hill sphere boundary (~24% depth at r_Hill)
        const sigma = Math.max(hillRadius * 0.6, 3.0);

        this.material.uniforms.planetMass.value[i] = mass;
        this.material.uniforms.planetSigma.value[i] = sigma;
      } else {
        this.material.uniforms.planetMass.value[i] = 0;
        this.material.uniforms.planetSigma.value[i] = 3.0;
      }
    }
  }

  updateStarPositions(pos1, pos2) {
    this.material.uniforms.starPos1.value.copy(pos1);
    if (pos2) {
      this.material.uniforms.starPos2.value.copy(pos2);
    }
  }

  updatePlanetPositions(planetEntries) {
    const count = Math.min(planetEntries.length, MAX_PLANETS);
    for (let i = 0; i < count; i++) {
      this.material.uniforms.planetPos.value[i].copy(planetEntries[i].planet.mesh.position);
    }
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  removeFrom(scene) {
    scene.remove(this.mesh);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
