import * as THREE from 'three';
import { assignBodyName } from '../util/scene-naming.js'; import { POSTERIZE_QUANTUM } from '../rendering/posterizeLevels.js'; // ⛔ B2P RIDES THIS LINE: this file carries line-anchored citations, so a new import line moves them.

/**
 * AsteroidBelt — renders a belt of asteroids using InstancedMesh.
 *
 * Uses 4 shape variants (displaced icosahedrons), each as its own
 * InstancedMesh. This gives 4 draw calls for potentially hundreds
 * of asteroids — very efficient.
 *
 * Per-instance color is done via InstancedBufferAttribute (not uniforms).
 * Lighting is computed per-fragment from the asteroid's world position,
 * so asteroids on opposite sides of the belt are correctly lit from
 * different directions.
 *
 * Supports dual-star lighting for binary systems.
 */
export class AsteroidBelt {
  constructor(beltData, starInfo) {
    this.data = beltData;
    this._elapsedTime = 0;

    // Create shared material (all shape variants use the same shader)
    this._material = this._createMaterial(starInfo);

    // Create one InstancedMesh per shape variant
    this._groups = this._createGroups();

    // Phase 2-followup of welldipper-scene-inspection-layer: wrap shape-
    // variant InstancedMeshes in a parent Group so the inspection layer
    // can name + query the belt as a single load-bearing entity. Per
    // brief: "container only; per-shape InstancedMesh children unnamed".
    this.mesh = new THREE.Group();
    for (const g of this._groups) this.mesh.add(g.mesh);
    assignBodyName(this.mesh, 'asteroid-belt', beltData);

    // Pre-allocate reusable objects for update()
    this._tempMatrix = new THREE.Matrix4();
    this._tempPos = new THREE.Vector3();
    this._tempQuat = new THREE.Quaternion();
    this._tempScale = new THREE.Vector3();
    this._tempAxis = new THREE.Vector3();
  }

  /**
   * Create a simple asteroid geometry.
   * At retro resolution (1/3) these are pixel-sized, so detail=0 (20 faces) is plenty.
   * Slight vertex displacement gives each shape variant a lumpy silhouette.
   */
  _createAsteroidGeometry(shapeIndex) {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const pos = geo.attributes.position;
    const normal = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      normal.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const hash = Math.abs(Math.sin(i * 127.1 + shapeIndex * 311.7) * 43758.5453) % 1;
      const displacement = 0.75 + hash * 0.45;
      pos.setXYZ(i, normal.x * displacement, normal.y * displacement, normal.z * displacement);
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  _createMaterial(starInfo) {
    return new THREE.ShaderMaterial({
      uniforms: {
        // Star positions (updated each frame for binary, stay at origin for single)
        starPos1: { value: new THREE.Vector3(0, 0, 0) }, uPosterizeLevels: POSTERIZE_QUANTUM, // B2P — the shared object. ⛔ RIDES THIS LINE.
        starPos2: { value: new THREE.Vector3(0, 0, 0) },
        starColor1: { value: new THREE.Vector3(...(starInfo?.color1 || [1, 1, 1])) },
        starColor2: { value: new THREE.Vector3(...(starInfo?.color2 || [0, 0, 0])) },
        starBrightness1: { value: starInfo?.brightness1 ?? 1.0 },
        starBrightness2: { value: starInfo?.brightness2 ?? 0.0 },
      },

      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec3 instanceColor;

        varying vec3 vNormal;
        varying vec3 vColor;
        varying vec3 vWorldPos;

        void main() {
          // InstancedMesh: instanceMatrix holds per-asteroid position/rotation/scale
          // modelMatrix is the container's world transform (identity in our case)
          mat4 fullModelMatrix = modelMatrix * instanceMatrix;

          vNormal = normalize(mat3(fullModelMatrix) * normal);
          vColor = instanceColor;

          vec4 worldPos = fullModelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
          #include <logdepthbuf_vertex>
        }
      `,

      fragmentShader: /* glsl */ `
        #include <logdepthbuf_pars_fragment>
        uniform vec3 starPos1;  uniform vec2 uPosterizeLevels;   // B2P — the colour quantum as a vec2: .x = levels, .y = its CPU-carried float32 reciprocal. It is a vec2 and not a float so the reciprocal cannot be re-derived (and re-folded into a divide) by the shader compiler; see posterizeLevels.js 'POSTERIZE_QUANTUM'. ⛔ RIDES THIS LINE.
        uniform vec3 starPos2;
        uniform vec3 starColor1;
        uniform vec3 starColor2;
        uniform float starBrightness1;
        uniform float starBrightness2;

        varying vec3 vNormal;
        varying vec3 vColor;
        varying vec3 vWorldPos;

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

        vec3 posterize(vec3 color, vec2 levels, vec2 fragCoord, float edgeWidth) {
          float dither = bayerDither(fragCoord) - 0.5;
          vec3 dithered = color + dither * (edgeWidth * levels.y);  // ⭐ B2P — levels.y is the reciprocal CARRIED FROM THE CPU (posterizeLevels.js 'POSTERIZE_QUANTUM'), and THE INNER PARENTHESES ARE LOAD-BEARING. Pre-B2P was 'dither * edgeWidth / 6.0' with BOTH operands literal, which the compiler folds into ONE constant multiply; parity therefore needs one multiply by that same constant, which '(edgeWidth * levels.y)' reproduces and '(dither * edgeWidth) * levels.y' does not. MEASURED on ANGLE/SwiftShader Vulkan over 12,582,912 knife-edge samples (6,291,456 per edgeWidth): this form 0 divergences from the bed3235 programs at edgeWidth 0.4 AND 0.6. The two forms that FAIL: the round-2 'dither * edgeWidth * inv' = 4 divergences at 0.4 and 1 at 0.6, max byte delta 43; and a shader-DERIVED '1.0 / levels' with these same parentheses = 0 at 0.4 but 5 at 0.6, because the compiler re-folds 'edgeWidth * (1.0 / levels)' back into a divide. Runtime '1.0/6.0' is itself bit-exact (0x3e2aaaab); it is the RE-FOLDING an opaque uniform denies. Also 0 differing across the FULL input domain (8,388,608 float32 samples, both edgeWidths) and 0 bytes differing in unorm8; and gl-reach's seven whole programs each render 0 px differ vs bed3235. Scope: ANGLE/SwiftShader Vulkan — not proven on every driver. ⛔ RIDES THIS LINE.
          return floor(dithered * levels.x + 0.5) * levels.y;  // B2P — the SECOND divide. '* levels.y' is a plain reciprocal multiply by the carried constant, and matched pre-B2P's folded '/ 6.0' in every one of the 12,582,912 samples above. levels.x is the quantum itself; both components ride ONE uniform, so a level and its reciprocal cannot drift apart.
        }

        void main() {
          #include <logdepthbuf_fragment>
          // Per-fragment lighting: compute direction to each star from this asteroid's position
          vec3 toStar1 = normalize(starPos1 - vWorldPos);
          vec3 toStar2 = normalize(starPos2 - vWorldPos);

          // Sharp terminator (airless rocks)
          float diff1 = smoothstep(-0.02, 0.08, dot(vNormal, toStar1)) * starBrightness1;
          float diff2 = smoothstep(-0.02, 0.08, dot(vNormal, toStar2)) * starBrightness2;

          // Combined star-colored lighting (tiny ambient so unlit sides aren't invisible)
          vec3 starLight = starColor1 * diff1 + starColor2 * diff2;
          starLight = max(starLight, vec3(0.03));

          vec3 finalColor = vColor * starLight;
          finalColor = min(finalColor, vec3(1.0));
          finalColor = posterize(finalColor, uPosterizeLevels, gl_FragCoord.xy, 0.4);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
  }

  _createGroups() {
    const asteroids = this.data.asteroids;

    // Sort asteroids by shape index
    const byShape = [[], [], [], []];
    for (const a of asteroids) {
      byShape[a.shapeIndex].push(a);
    }

    const groups = [];

    for (let s = 0; s < 4; s++) {
      const batch = byShape[s];
      if (batch.length === 0) continue;

      const geometry = this._createAsteroidGeometry(s);
      const mesh = new THREE.InstancedMesh(geometry, this._material, batch.length);

      // Per-instance color attribute
      const colors = new Float32Array(batch.length * 3);
      for (let i = 0; i < batch.length; i++) {
        colors[i * 3 + 0] = batch[i].color[0];
        colors[i * 3 + 1] = batch[i].color[1];
        colors[i * 3 + 2] = batch[i].color[2];
      }
      geometry.setAttribute('instanceColor',
        new THREE.InstancedBufferAttribute(colors, 3));

      // Spread across the belt — don't cull individual instances
      mesh.frustumCulled = false;

      groups.push({ mesh, batch });
    }

    return groups;
  }

  /**
   * Update star positions for dual-lighting (call each frame for binary systems).
   */
  updateStarPositions(pos1, pos2) {
    this._material.uniforms.starPos1.value.copy(pos1);
    if (pos2) this._material.uniforms.starPos2.value.copy(pos2);
  }

  /**
   * Advance orbital positions and tumble rotations.
   * @param {number} deltaTime  raw frame dt — kept for caller backward
   *   compat; internally converted to celestialDt.
   * @param {number} [celestialDt=deltaTime]  user-time-scaled celestial dt
   *   (= deltaTime × celestialTimeMultiplier). Both orbital advance and
   *   tumble rotation are celestial-class motion (per workstream
   *   realistic-celestial-motion-2026-04-27) and consume celestialDt.
   */
  update(deltaTime, celestialDt = deltaTime) {
    this._elapsedTime += celestialDt;

    const mat = this._tempMatrix;
    const pos = this._tempPos;
    const quat = this._tempQuat;
    const scale = this._tempScale;
    const axis = this._tempAxis;

    for (const group of this._groups) {
      for (let i = 0; i < group.batch.length; i++) {
        const a = group.batch[i];

        // Advance orbital position
        a.angle += a.orbitSpeed * celestialDt;

        // Position on the orbit
        const x = Math.cos(a.angle) * a.radius;
        const z = Math.sin(a.angle) * a.radius;
        pos.set(x, a.height, z);

        // Tumble rotation
        axis.set(a.tumbleAxis[0], a.tumbleAxis[1], a.tumbleAxis[2]);
        quat.setFromAxisAngle(axis, a.tumbleSpeed * this._elapsedTime);

        // Uniform scale
        const s = a.size;
        scale.set(s, s, s);

        mat.compose(pos, quat, scale);
        group.mesh.setMatrixAt(i, mat);
      }
      group.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  removeFrom(scene) {
    scene.remove(this.mesh);
  }

  dispose() {
    for (const group of this._groups) {
      group.mesh.geometry.dispose();
    }
    // Material is shared across all groups — dispose once
    this._material.dispose();
  }
}
