import * as THREE from 'three';

/**
 * GalaxyGlowLayer — diffuse glow representing billions of unresolved stars.
 *
 * DISPLAY LAYER ONLY — renders a pre-computed equirectangular panorama
 * texture onto a sky sphere. The textures are generated offline by
 * GalaxyVolumeRenderer (scripts/generate-galaxy-glow.mjs) which
 * ray-marches the same density model as GalacticMap.
 *
 * At runtime this is just a textured sphere — no ray-marching, no
 * arm calculations, no GLSL density math. All that complexity lives
 * in the offline generator.
 */
export class GalaxyGlowLayer {
  /**
   * @param {number} radius — sky sphere radius (should be < starfield radius)
   * @param {{ min: number, max: number }} brightnessRange — output brightness limits
   */
  constructor(radius, brightnessRange) {
    this.radius = radius;
    this._brightnessRange = brightnessRange;

    // Icosahedron has no UV seam — the fragment shader computes
    // equirectangular UVs from world direction, so geometry type
    // is just topology. Subdivision 5 = smooth enough sphere.
    const geometry = new THREE.IcosahedronGeometry(radius, 5);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,

      uniforms: {
        uGlowMap: { value: null },
        uBrightnessMax: { value: brightnessRange.max },
        uOpacity: { value: 1.0 },
      },

      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          // Pass local position as world direction (sphere centered on camera)
          vWorldDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,

      fragmentShader: /* glsl */ `
        #define PI 3.14159265359

        uniform sampler2D uGlowMap;
        uniform float uBrightnessMax;
        uniform float uOpacity;

        varying vec3 vWorldDir;

        void main() {
          // Compute equirectangular UVs from world direction — no UV seam.
          vec3 dir = normalize(vWorldDir);
          float u = atan(dir.z, dir.x) / (2.0 * PI) + 0.5;
          float v = asin(clamp(-dir.y, -1.0, 1.0)) / PI + 0.5;

          vec4 texel = texture2D(uGlowMap, vec2(u, v));

          // Textures are pre-tone-mapped, pre-dithered, and include
          // alpha=0 for transparent (dark sky) regions.
          if (texel.a < 0.01) discard;

          // Apply brightness budget
          vec3 color = texel.rgb * uBrightnessMax;
          gl_FragColor = vec4(color, texel.a * uOpacity);
        }
      `,
    });

    this._sphere = new THREE.Mesh(geometry, material);
    this.mesh = this._sphere;
  }

  /**
   * Set the glow panorama texture.
   * @param {THREE.Texture} texture — equirectangular panorama
   */
  setTexture(texture) {
    if (texture) {
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      // Disable flipY — the shader computes UVs from world direction,
      // matching the panorama generator's coordinate system directly.
      texture.flipY = false;
      texture.needsUpdate = true;
    }
    this._sphere.material.uniforms.uGlowMap.value = texture;
  }

  /**
   * Set opacity (useful for crossfading between textures during warp).
   * @param {number} opacity — 0 to 1
   */
  setOpacity(opacity) {
    this._sphere.material.uniforms.uOpacity.value = opacity;
  }

  update(cameraPosition) {
    this.mesh.position.copy(cameraPosition);
  }

  setBrightnessMax(max) {
    this._brightnessRange.max = max;
    this._sphere.material.uniforms.uBrightnessMax.value = max;
  }

  dispose() {
    const tex = this._sphere.material.uniforms.uGlowMap.value;
    if (tex) tex.dispose();
    this._sphere.geometry.dispose();
    this._sphere.material.dispose();
  }
}
