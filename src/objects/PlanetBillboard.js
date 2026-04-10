import * as THREE from 'three';

/**
 * PlanetBillboard — a shader-based billboard dot for distant planets.
 *
 * When a planet is too small to resolve as a 3D mesh but close enough to
 * still be "visible" in the system, it renders as a small colored dot —
 * similar to how StarFlare switches to a circular billboard at distance.
 *
 * Key differences from star billboards:
 *   - Dimmer (reflected light, not emissive) — HDR multiplier 1.2 vs 1.8
 *   - Smaller (4–10 px vs 16–22 px for stars)
 *   - Sized by physical radius (gas giants bigger dots than rocky worlds)
 *   - Has a distance cutoff — beyond it, ghost reticle takes over
 *
 * Uses the same Bayer dithering and circular-disc shader as StarFlare
 * for visual consistency with the retro pipeline.
 */
export class PlanetBillboard {
  /**
   * @param {number[]} color — [r, g, b] in 0–1, with minimum brightness applied
   * @param {number} sceneRadius — planet radius in scene units (for sizing)
   */
  constructor(color, sceneRadius) {
    const [r, g, b] = color;
    this._targetPx = PlanetBillboard.computeTargetPixels(sceneRadius);

    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Vector3(r, g, b) },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        varying vec2 vUv;

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
          vec2 center = vUv - 0.5;
          float dist = length(center);
          if (dist > 0.5) discard;
          // Softer falloff than stars — less bright core, more glow.
          // Reads as a dim reflected-light dot, not a self-luminous point.
          float coreBright = 1.0 - smoothstep(0.0, 0.25, dist);
          float glow = 1.0 - smoothstep(0.1, 0.5, dist);
          float shape = coreBright * 0.5 + glow * 0.5;
          // Bayer dither in 3-pixel screen blocks (matches star billboards)
          float threshold = bayerDither(floor(gl_FragCoord.xy / 3.0));
          if (shape < threshold * 0.5) discard;
          // Dimmer than stars — 1.2x HDR vs 1.8x for stars.
          vec3 col = uColor * shape * 1.2;
          gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /**
   * Map planet scene-radius to billboard pixel size (4–10 px).
   * Log scale so gas giants are noticeably bigger than rocky worlds,
   * but never as big as star billboards (16–22 px).
   *
   * Scene radii (from ScaleConstants):
   *   Rocky (0.3–1.5 R⊕)     → 0.013–0.064 scene units
   *   Sub-Neptune (2.5–4 R⊕)  → 0.107–0.170
   *   Gas giant (6–16 R⊕)     → 0.256–0.682
   */
  static computeTargetPixels(sceneRadius) {
    // log10 range: ~-1.9 (smallest rocky) to ~-0.17 (largest gas giant)
    const logR = Math.log10(Math.max(sceneRadius, 0.01));
    // Map [-1.9, -0.17] → [4, 10]
    const t = (logR + 1.9) / 1.73; // 1.73 = 1.9 - 0.17
    return Math.max(4, Math.min(10, 4 + 6 * t));
  }

  /**
   * Update billboard to face camera and maintain constant screen-space size.
   * Call every frame when visible.
   * @param {THREE.PerspectiveCamera} camera
   */
  update(camera) {
    if (!this.mesh.visible) return;
    const dist = camera.position.distanceTo(this.mesh.position);
    if (dist < 0.001) return;

    const fovRad = camera.fov * Math.PI / 180;
    const pixelsPerRadian = (window.innerHeight / 2) / Math.tan(fovRad / 2);
    const worldSize = (this._targetPx / pixelsPerRadian) * dist;
    this.mesh.scale.set(worldSize, worldSize, 1);
    this.mesh.quaternion.copy(camera.quaternion);
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  removeFrom(scene) {
    scene.remove(this.mesh);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
