import * as THREE from 'three';
import { BAYER4, POSTERIZE } from '../shaders/common.glsl.js';

/**
 * RingRenderer — physics-driven planetary ring rendering.
 *
 * Replaces the hardcoded sine-wave bands in Planet.js with actual
 * ringlet + gap data from PhysicsEngine.ringPhysics().
 *
 * Physics data consumed:
 *   ringlets[]: { innerR, outerR, opacity, composition } — up to 16 bands
 *   gaps[]: { radius, width, moonIndex, resonance } — up to 8 gaps
 *   composition: 'ice' | 'rock' | 'dust' | 'mixed' — drives color
 *   density: 0-1 (age-dependent overall opacity)
 *   color1, color2: [r,g,b] base colors
 *
 * Rendering approach (LOD tier 1 — orbital view):
 *   RingGeometry with shader that iterates ringlet + gap uniform arrays.
 *   Each ringlet has position, opacity, and composition-driven color.
 *   Each gap clears a region (smoothstep falloff).
 *
 * Usage:
 *   const ring = new RingRenderer(planetData, physicsRingData, lightDir);
 *   planetGroup.add(ring.mesh);
 *   ring.setLightDir(lightDir);
 */

// Composition → color mapping
const COMPOSITION_COLORS = {
  'ice':   [0.85, 0.92, 0.98],  // bright cyan-white
  'rock':  [0.35, 0.32, 0.30],  // dark grey
  'dust':  [0.55, 0.45, 0.35],  // brown-grey
  'mixed': [0.60, 0.58, 0.55],  // light grey
};

const MAX_RINGLETS = 16;
const MAX_GAPS = 8;

export class RingRenderer {
  /**
   * @param {object} planetData — planet data (radius, rings basic info)
   * @param {object|null} physicsRings — from PhysicsEngine.ringPhysics(), or null for legacy
   * @param {THREE.Vector3} lightDir — initial light direction
   */
  constructor(planetData, physicsRings, lightDir) {
    this._planetData = planetData;
    this._physicsRings = physicsRings;

    const rings = planetData.rings;
    if (!rings) {
      this.mesh = null;
      return;
    }

    const innerR = planetData.radius * rings.innerRadius;
    const outerR = planetData.radius * rings.outerRadius;

    this.mesh = this._createMesh(innerR, outerR, rings, physicsRings, lightDir, planetData.radius);

    // Apply tilt
    if (rings.tiltX) this.mesh.rotation.x += rings.tiltX;
    if (rings.tiltZ) this.mesh.rotation.z += rings.tiltZ;
  }

  _createMesh(innerR, outerR, rings, physics, lightDir, planetRadius) {
    const geometry = new THREE.RingGeometry(innerR, outerR, 64);
    geometry.rotateX(Math.PI / 2);

    // Build ringlet and gap uniform arrays from physics data
    const ringletInnerR = new Float32Array(MAX_RINGLETS);
    const ringletOuterR = new Float32Array(MAX_RINGLETS);
    const ringletOpacity = new Float32Array(MAX_RINGLETS);
    const ringletColors = new Float32Array(MAX_RINGLETS * 3);
    let ringletCount = 0;

    const gapCenters = new Float32Array(MAX_GAPS);
    const gapWidths = new Float32Array(MAX_GAPS);
    let gapCount = 0;

    if (physics?.ringlets && physics.ringlets.length > 0) {
      // Physics-driven: use actual ringlet data
      for (let i = 0; i < physics.ringlets.length && ringletCount < MAX_RINGLETS; i++) {
        const rl = physics.ringlets[i];
        if (rl.outerR - rl.innerR < 0.001) continue; // skip degenerate ringlets
        const j = ringletCount;
        ringletInnerR[j] = planetRadius * rl.innerR;
        ringletOuterR[j] = planetRadius * rl.outerR;
        ringletOpacity[j] = rl.opacity * (physics.density ?? 1.0);
        const color = COMPOSITION_COLORS[rl.composition] || COMPOSITION_COLORS['mixed'];
        ringletColors[j * 3] = color[0];
        ringletColors[j * 3 + 1] = color[1];
        ringletColors[j * 3 + 2] = color[2];
        ringletCount++;
      }
      // Physics-driven gaps from resonances
      if (physics.gaps) {
        for (let i = 0; i < physics.gaps.length && gapCount < MAX_GAPS; i++) {
          gapCenters[gapCount] = planetRadius * physics.gaps[i].radius;
          gapWidths[gapCount] = planetRadius * physics.gaps[i].width;
          gapCount++;
        }
      }
    }

    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        ringColor1: { value: new THREE.Vector3(...rings.color1) },
        ringColor2: { value: new THREE.Vector3(...rings.color2) },
        ringOpacity: { value: rings.opacity },
        innerRadius: { value: innerR },
        outerRadius: { value: outerR },
        lightDir: { value: lightDir || new THREE.Vector3(1, 0, 0) },
        planetRadius: { value: planetRadius },
        // Physics-driven ringlets
        uRingletCount: { value: ringletCount },
        uRingletInnerR: { value: ringletInnerR },
        uRingletOuterR: { value: ringletOuterR },
        uRingletOpacity: { value: ringletOpacity },
        uRingletColors: { value: ringletColors },
        // Physics-driven gaps
        uGapCount: { value: gapCount },
        uGapCenters: { value: gapCenters },
        uGapWidths: { value: gapWidths },
        // Legacy moon gaps (kept for backward compat)
        moonGapCount: { value: 0 },
        moonGapRadii: { value: new Float32Array(6) },
        moonGapWidths: { value: new Float32Array(6) },
      },

      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vPos;
        varying vec3 vRelWorldPos;

        void main() {
          vPos = position;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vec3 planetCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vRelWorldPos = worldPos.xyz - planetCenter;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }
      `,

      fragmentShader: /* glsl */ `
        #include <logdepthbuf_pars_fragment>
        uniform vec3 ringColor1;
        uniform vec3 ringColor2;
        uniform float ringOpacity;
        uniform float innerRadius;
        uniform float outerRadius;
        uniform vec3 lightDir;
        uniform float planetRadius;

        // Physics-driven ringlets (up to 16)
        const int MAX_RINGLETS = ${MAX_RINGLETS};
        uniform int uRingletCount;
        uniform float uRingletInnerR[${MAX_RINGLETS}];
        uniform float uRingletOuterR[${MAX_RINGLETS}];
        uniform float uRingletOpacity[${MAX_RINGLETS}];
        uniform float uRingletColors[${MAX_RINGLETS * 3}];

        // Physics-driven gaps (up to 8)
        const int MAX_GAPS = ${MAX_GAPS};
        uniform int uGapCount;
        uniform float uGapCenters[${MAX_GAPS}];
        uniform float uGapWidths[${MAX_GAPS}];

        // Legacy moon gaps
        const int MAX_MOON_GAPS = 6;
        uniform int moonGapCount;
        uniform float moonGapRadii[6];
        uniform float moonGapWidths[6];

        varying vec3 vPos;
        varying vec3 vRelWorldPos;

        ${BAYER4}
        ${POSTERIZE}

        void main() {
          #include <logdepthbuf_fragment>
          float dist = length(vPos.xz);
          float t = (dist - innerRadius) / (outerRadius - innerRadius);

          vec3 color;
          float alpha;

          if (uRingletCount > 0) {
            // ── Physics-driven rendering ──
            // Find which ringlet this pixel is in (if any)
            float density = 0.0;
            color = ringColor1; // fallback

            for (int i = 0; i < MAX_RINGLETS; i++) {
              if (i >= uRingletCount) break;
              if (dist >= uRingletInnerR[i] && dist <= uRingletOuterR[i]) {
                // Inside this ringlet
                float rlT = (dist - uRingletInnerR[i]) / max(0.001, uRingletOuterR[i] - uRingletInnerR[i]);
                // Smooth edges within ringlet
                float edgeFade = smoothstep(0.0, 0.08, rlT) * (1.0 - smoothstep(0.92, 1.0, rlT));
                density = max(density, uRingletOpacity[i] * edgeFade);
                // Composition color
                int ci = i * 3;
                color = vec3(uRingletColors[ci], uRingletColors[ci + 1], uRingletColors[ci + 2]);
              }
            }

            // Apply physics gaps (resonance clearing)
            for (int i = 0; i < MAX_GAPS; i++) {
              if (i >= uGapCount) break;
              float gapDist = abs(dist - uGapCenters[i]);
              density *= smoothstep(0.0, uGapWidths[i], gapDist);
            }

            alpha = density * ringOpacity;
          } else {
            // ── Legacy rendering (no physics data) ──
            float band1 = sin(t * 30.0) * 0.5 + 0.5;
            float band2 = sin(t * 12.0 + 1.0) * 0.5 + 0.5;
            float density = band1 * 0.6 + band2 * 0.4;
            color = mix(ringColor1, ringColor2, band1);

            // Cassini-like gap
            float gap = smoothstep(0.4, 0.43, t) * (1.0 - smoothstep(0.48, 0.51, t));
            alpha = density * (1.0 - gap * 0.8) * ringOpacity;
          }

          // Fade at inner and outer edges
          alpha *= smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.92, 1.0, t));

          // Legacy moon gaps
          for (int i = 0; i < MAX_MOON_GAPS; i++) {
            if (i >= moonGapCount) break;
            float gapDist = abs(dist - moonGapRadii[i]);
            alpha *= smoothstep(0.0, moonGapWidths[i], gapDist);
          }

          // Planet shadow on ring
          float shadowDist = length(cross(vRelWorldPos, lightDir));
          float behindPlanet = step(dot(vRelWorldPos, lightDir), 0.0);
          float inShadow = behindPlanet * (1.0 - smoothstep(planetRadius * 0.9, planetRadius * 1.1, shadowDist));

          float ringLight = 1.0 - inShadow;
          color *= ringLight;
          alpha *= mix(0.15, 1.0, ringLight);

          if (bayerDither(gl_FragCoord.xy) > alpha) discard;

          color = posterize(color, 6.0, gl_FragCoord.xy, 0.4);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    return new THREE.Mesh(geometry, material);
  }

  /**
   * Set moon-cleared gaps (shepherd moon effect).
   * @param {Array} moonDataArray — moon data with orbitRadius and radius
   */
  setMoonGaps(moonDataArray) {
    if (!this.mesh) return;
    const innerR = this._planetData.radius * this._planetData.rings.innerRadius;
    const outerR = this._planetData.radius * this._planetData.rings.outerRadius;
    const mat = this.mesh.material;
    let gapCount = 0;

    for (const moon of moonDataArray) {
      if (gapCount >= 6) break;
      if (moon.orbitRadius >= innerR && moon.orbitRadius <= outerR) {
        mat.uniforms.moonGapRadii.value[gapCount] = moon.orbitRadius;
        mat.uniforms.moonGapWidths.value[gapCount] = moon.radius * 4;
        gapCount++;
      }
    }
    mat.uniforms.moonGapCount.value = gapCount;
  }

  setLightDir(dir) {
    if (this.mesh) {
      this.mesh.material.uniforms.lightDir.value.copy(dir);
    }
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  }
}
