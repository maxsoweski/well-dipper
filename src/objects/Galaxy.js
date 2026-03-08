import * as THREE from 'three';

/**
 * Galaxy — renders galaxies and star clusters as a cloud of point sprites.
 *
 * Used for: spiral galaxies, elliptical galaxies, globular clusters, open clusters.
 * All are fundamentally "lots of colored dots" with different spatial distributions.
 *
 * Uses THREE.Points with additive blending — where particles overlap (e.g. galaxy
 * core), brightness accumulates naturally. This creates the bright-core, dim-edge
 * look of real galaxies without any extra logic.
 *
 * Follows the same pattern as AsteroidBelt (data-driven, dispose(), addTo/removeFrom).
 */
export class Galaxy {
  constructor(galaxyData) {
    this.data = galaxyData;
    this.mesh = new THREE.Group();

    this._points = this._createPoints(galaxyData);
    this.mesh.add(this._points);

    // Apply viewing tilt (spiral/elliptical galaxies are tilted)
    if (galaxyData.tiltX) this.mesh.rotation.x = galaxyData.tiltX;
    if (galaxyData.tiltZ) this.mesh.rotation.z = galaxyData.tiltZ;
  }

  _createPoints(data) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(data.colors, 3));
    geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(data.sizes, 1));

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
        varying vec3 vColor;
        varying float vTwinkle;
        uniform float uTime;

        void main() {
          vColor = aColor;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;

          // Scale point size by distance (perspective)
          float distScale = 300.0 / max(-mvPos.z, 1.0);
          gl_PointSize = aSize * distScale;

          // Min 1.0px — sub-pixel particles cause aggressive blinking
          // as they cross pixel boundaries during rotation
          gl_PointSize = clamp(gl_PointSize, 1.0, 32.0);

          // Slow per-particle twinkle: gentle brightness variation
          // using position as a unique hash (each star twinkles independently)
          float hash = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);
          vTwinkle = 0.9 + 0.1 * sin(uTime * (0.1 + hash * 0.15) + hash * 6.28);
        }
      `,

      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vTwinkle;

        // 4×4 Bayer dithering (matches Starfield.js pattern)
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
          // Soft circular glow: each point is a fuzzy dot
          float dist = length(gl_PointCoord - 0.5);
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);

          // Apply slow twinkle
          alpha *= vTwinkle;

          // Gentler dithered edge — lower multiplier (0.4 vs 0.8)
          // so fewer edge pixels pop in/out during rotation
          float threshold = bayerDither(gl_FragCoord.xy);
          if (alpha < threshold * 0.4) discard;

          // Additive blending handles the rest — overlapping dots brighten
          gl_FragColor = vec4(vColor * alpha, alpha);
        }
      `,
    });

    return new THREE.Points(geometry, material);
  }

  /**
   * Slow rotation for visual interest (called each frame).
   * @param {number} deltaTime — seconds since last frame
   */
  update(deltaTime) {
    // Gentle rotation — galaxies and clusters drift slowly
    this.mesh.rotation.y += 0.003 * deltaTime;

    // Advance twinkle clock
    this._points.material.uniforms.uTime.value += deltaTime;
  }

  /**
   * Find the nearest particle to a ray direction (for click selection).
   * Checks every 10th particle for performance.
   *
   * @param {THREE.Vector3} rayDirection — normalized ray from camera
   * @param {THREE.Vector3} cameraPosition — camera world position
   * @returns {THREE.Vector3|null} — normalized direction to nearest particle, or null
   */
  findNearestParticle(rayDirection, cameraPosition) {
    const positions = this._points.geometry.attributes.position.array;
    const count = this.data.particleCount || (positions.length / 3);
    const cosThreshold = Math.cos(5 * Math.PI / 180); // 5° cone (wider than starfield — galaxy particles are bigger)
    let bestDot = cosThreshold;
    let bestDir = null;

    const _dir = new THREE.Vector3();
    const _worldPos = new THREE.Vector3();

    for (let i = 0; i < count; i += 10) {
      const i3 = i * 3;
      // Transform particle position to world space (accounting for mesh rotation/position)
      _worldPos.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);
      this.mesh.localToWorld(_worldPos);

      // Direction from camera to particle
      _dir.copy(_worldPos).sub(cameraPosition).normalize();

      const dot = rayDirection.dot(_dir);
      if (dot > bestDot) {
        bestDot = dot;
        bestDir = _dir.clone();
      }
    }
    return bestDir;
  }

  /**
   * Pick a random particle in the forward hemisphere.
   * Used for auto-selecting a warp target from a distant galaxy/cluster.
   *
   * @param {THREE.Camera} camera — the camera
   * @returns {THREE.Vector3|null} — normalized direction to a random particle
   */
  getRandomParticle(camera) {
    const positions = this._points.geometry.attributes.position.array;
    const count = this.data.particleCount || (positions.length / 3);
    const cameraForward = new THREE.Vector3();
    camera.getWorldDirection(cameraForward);

    const candidates = [];
    const _worldPos = new THREE.Vector3();
    const _dir = new THREE.Vector3();

    // Check every 20th particle for speed
    for (let i = 0; i < count; i += 20) {
      const i3 = i * 3;
      _worldPos.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);
      this.mesh.localToWorld(_worldPos);

      _dir.copy(_worldPos).sub(camera.position).normalize();
      if (cameraForward.dot(_dir) > 0.3) {
        candidates.push(i);
      }
    }

    if (candidates.length === 0) return null;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const p = pick * 3;
    _worldPos.set(positions[p], positions[p + 1], positions[p + 2]);
    this.mesh.localToWorld(_worldPos);
    return _worldPos.sub(camera.position).normalize();
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
