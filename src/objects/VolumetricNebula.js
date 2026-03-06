import * as THREE from 'three';

/**
 * VolumetricNebula — Points-based gas cloud you can fly through.
 *
 * Unlike the billboard-based Nebula.js (which clips when camera enters),
 * this uses THREE.Points so there's no geometry face to clip against.
 * Each particle is a soft fuzzy dot with per-particle opacity, and
 * additive blending makes overlapping regions naturally brighter.
 *
 * Designed for navigable planetary nebulae and emission nebulae — the
 * camera can sit inside the cloud and look around.
 *
 * Interface matches Galaxy.js: constructor(data), update(dt), addTo/removeFrom, dispose().
 */
export class VolumetricNebula {
  constructor(nebulaData) {
    this.data = nebulaData;
    this.mesh = new THREE.Group();

    this._points = this._createPoints(nebulaData);
    this.mesh.add(this._points);

    this._time = 0;
  }

  _createPoints(data) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(data.colors, 3));
    geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(data.sizes, 1));
    geometry.setAttribute('aOpacity', new THREE.Float32BufferAttribute(data.opacities, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,

      uniforms: {
        uTime: { value: 0 },
      },

      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aOpacity;

        varying vec3 vColor;
        varying float vOpacity;

        uniform float uTime;

        void main() {
          vColor = aColor;
          vOpacity = aOpacity;

          // Slow drift animation — particles float gently
          vec3 pos = position;
          float drift = uTime * 0.3;
          pos.x += sin(drift + position.z * 0.001) * 20.0;
          pos.y += cos(drift * 0.7 + position.x * 0.001) * 15.0;
          pos.z += sin(drift * 0.5 + position.y * 0.001) * 20.0;

          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPos;

          // Scale point size by distance — much larger than Galaxy.js
          // for soft overlapping cloud look when inside the nebula
          float distScale = 2000.0 / max(-mvPos.z, 1.0);
          gl_PointSize = aSize * distScale;

          // Large max clamp — particles should fill the view when close
          gl_PointSize = clamp(gl_PointSize, 0.5, 512.0);
        }
      `,

      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vOpacity;

        // 4×4 Bayer dithering (same pattern as Galaxy.js / Starfield.js)
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
          // Soft circular glow — larger and softer than Galaxy.js
          float dist = length(gl_PointCoord - 0.5);
          float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vOpacity;

          // Bayer dither on alpha edge — retro aesthetic (softer threshold to keep more gas visible)
          float threshold = bayerDither(gl_FragCoord.xy);
          if (alpha < threshold * 0.25) discard;

          // Additive blending — overlapping particles brighten naturally
          gl_FragColor = vec4(vColor * alpha, alpha);
        }
      `,
    });

    return new THREE.Points(geometry, material);
  }

  /**
   * Slow time-based drift animation.
   * @param {number} deltaTime — seconds since last frame
   */
  update(deltaTime) {
    this._time += deltaTime;
    this._points.material.uniforms.uTime.value = this._time;
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  removeFrom(scene) {
    scene.remove(this.mesh);
  }

  dispose() {
    if (this._points) {
      this._points.geometry.dispose();
      this._points.material.dispose();
    }
  }
}
