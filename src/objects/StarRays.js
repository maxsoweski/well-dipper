import * as THREE from 'three';

/**
 * StarRays — star with animated lines radiating outward, always facing camera.
 *
 * 2D billboard effect: a flat disc of ray lines that always faces the camera.
 * Rays flow outward from the star, with irregular broken-up sections
 * animated via a custom shader. Same color as the star, additive blended.
 * Star has a visible glow around it.
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

    // The ray disc (circular cutoff) is at rayDiscRadius.
    // The quad must be LARGER than this so geometry doesn't clip before
    // the circular discard can do its job. Diagonal of quad = size * sqrt(2),
    // so size needs to be at least rayDiscRadius * 2 / sqrt(2) ≈ * 1.42.
    // We use * 2 for plenty of margin.
    const rayDiscRadius = R * 7;
    const quadSize = rayDiscRadius * 2.5; // much bigger than the circle
    const geometry = new THREE.PlaneGeometry(quadSize, quadSize);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Vector3(cr, cg, cb) },
        uStarRadius: { value: R },
        uDiscRadius: { value: rayDiscRadius },
        uQuadSize: { value: quadSize },
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
        uniform float uDiscRadius;
        uniform float uQuadSize;
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
          vec2 p = (vUv - 0.5) * uQuadSize;
          float dist = length(p);
          float angle = atan(p.y, p.x);

          // Perfect circular mask — hard cutoff at disc radius
          if (dist > uDiscRadius) discard;

          vec3 color = vec3(0.0);
          float alpha = 0.0;

          // ── Star glow ──
          // Bright radial glow emanating from the star, makes it look luminous
          float glowRadius = uStarRadius * 2.8;
          float glowBright = exp(-dist / glowRadius * 2.0) * 1.0;
          float outsideStar = smoothstep(uStarRadius * 0.7, uStarRadius * 1.0, dist);
          color += uColor * glowBright * outsideStar;
          alpha += glowBright * outsideStar;

          // ── Rays ──
          if (dist > uStarRadius * 0.85) {
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
            float t = (dist - uStarRadius * 0.85) / rayLen;

            if (t <= 1.0 && t >= 0.0) {
              // Flowing outward animation: noise creates irregular broken-up sections
              float noiseCoord = t * 6.0 - uTime * raySpeed + rayPhase;
              float breakup = noise1D(noiseCoord);

              // Sharp threshold for broken segments (on/off feel)
              float segmentAlpha = smoothstep(0.3, 0.5, breakup);

              // Full brightness — nearly as bright as the star itself
              float rayBright = rayAlpha * segmentAlpha * 0.9;
              color += uColor * rayBright;
              alpha += rayBright;
            }
          }

          alpha = clamp(alpha, 0.0, 1.0);
          if (alpha < 0.01) discard;

          gl_FragColor = vec4(color, alpha);
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
    // No glow sprite — shader handles the glow
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
