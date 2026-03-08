import * as THREE from 'three';

/**
 * StarRays — star with animated lines radiating outward, always facing camera.
 *
 * 2D billboard effect: a flat disc of ray lines that always faces the camera.
 * Rays flow outward from the star, with irregular broken-up sections
 * animated via a custom shader. Same color as the star, additive blended.
 */
export class StarRays {
  constructor(starData, renderRadius = null) {
    this.data = starData;
    this._renderRadius = renderRadius !== null ? renderRadius : starData.radius;
    this.mesh = new THREE.Group();

    // Emissive sphere
    this.surface = this._createSurface();
    this.surface.frustumCulled = false;
    this.mesh.add(this.surface);

    // Animated ray disc (billboard shader)
    this.rayDisc = this._createRayDisc();
    this.mesh.add(this.rayDisc);

    this._time = 0;
  }

  _createSurface() {
    const geometry = new THREE.IcosahedronGeometry(this._renderRadius, 4);
    const [r, g, b] = this.data.color;
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(r, g, b),
    });
    return new THREE.Mesh(geometry, material);
  }

  _createRayDisc() {
    const R = this._renderRadius;
    const [cr, cg, cb] = this.data.color;

    // Large quad centered on the star — shader does the ray rendering
    const size = R * 14;
    const geometry = new THREE.PlaneGeometry(size, size);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Vector3(cr, cg, cb) },
        uStarRadius: { value: R },
        uSize: { value: size },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uStarRadius;
        uniform float uSize;
        varying vec2 vUv;

        // Hash for pseudo-random per-ray variation
        float hash(float n) {
          return fract(sin(n) * 43758.5453);
        }

        // 1D noise for irregular broken sections along each ray
        float noise1D(float x) {
          float i = floor(x);
          float f = fract(x);
          f = f * f * (3.0 - 2.0 * f); // smoothstep
          return mix(hash(i), hash(i + 1.0), f);
        }

        void main() {
          // Center UV at origin, scale to world units
          vec2 p = (vUv - 0.5) * uSize;
          float dist = length(p);
          float angle = atan(p.y, p.x);

          // Skip pixels inside the star sphere
          if (dist < uStarRadius * 1.1) discard;

          // Quantize angle into ray slots — more rays = denser look
          float rayCount = 80.0;
          float rayAngle = angle / (2.0 * 3.14159265) * rayCount;
          float rayIdx = floor(rayAngle + 0.5);
          float rayFrac = abs(rayAngle - rayIdx); // distance from ray center

          // Thin ray lines — sharp falloff from center
          float rayWidth = 0.35; // fraction of slot width
          float rayAlpha = 1.0 - smoothstep(0.0, rayWidth, rayFrac);

          // Per-ray variation: different length, speed, phase
          float rSeed = rayIdx * 127.1 + 311.7;
          float rayLen = uStarRadius * (3.0 + hash(rSeed) * 4.0);
          float raySpeed = 0.6 + hash(rSeed + 73.0) * 0.8;
          float rayPhase = hash(rSeed + 191.0) * 6.28;

          // Radial position normalized along this ray's length
          float t = (dist - uStarRadius) / rayLen;

          // Hard cutoff: rays just disappear at their max length, no fade
          if (t > 1.0) discard;

          // Flowing outward animation: noise pattern scrolls outward over time
          // The noise creates irregular broken-up sections
          float noiseCoord = t * 6.0 - uTime * raySpeed + rayPhase;
          float breakup = noise1D(noiseCoord);

          // Sharp threshold for broken segments (on/off feel)
          float segmentAlpha = smoothstep(0.3, 0.5, breakup);

          // Fade in from star surface (brief)
          float innerFade = smoothstep(0.0, 0.05, t);

          // Full brightness — nearly as bright as the star itself
          // No distance fade, just the breakup pattern and hard cutoff
          float alpha = rayAlpha * segmentAlpha * innerFade * 0.9;

          if (alpha < 0.01) discard;

          gl_FragColor = vec4(uColor * 1.0, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(geometry, material);
  }

  update(deltaTime, camera) {
    this._time += deltaTime;
    this.rayDisc.material.uniforms.uTime.value = this._time;

    // Billboard: always face camera
    if (camera) {
      this.rayDisc.quaternion.copy(camera.quaternion);
    }
  }

  updateGlow() {
    // No glow sprite — rays are the visual effect
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.surface.geometry.dispose();
    this.surface.material.dispose();
    this.rayDisc.geometry.dispose();
    this.rayDisc.material.dispose();
  }
}
