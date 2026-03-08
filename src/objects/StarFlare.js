import * as THREE from 'three';

/**
 * StarFlare — star with lens diffraction spikes and rainbow chromatic dispersion.
 *
 * Mimics real camera lens artifacts:
 * 1. Emissive sphere (core)
 * 2. 6 diffraction spikes — bright white at center, dispersing into rainbow
 *    spectrum toward the tips (like real lens flare chromatic aberration)
 * 3. Circular halo ring at ~3.5x radius (lens ghost)
 *
 * All spike/halo elements billboard (face camera).
 */
export class StarFlare {
  constructor(starData, renderRadius = null) {
    this.data = starData;
    this._renderRadius = renderRadius !== null ? renderRadius : starData.radius;
    this.mesh = new THREE.Group();

    // Emissive sphere
    this.surface = this._createSurface();
    this.surface.frustumCulled = false;
    this.mesh.add(this.surface);

    // Diffraction spikes + halo (shader-based billboard)
    this._flareDisc = this._createFlareDisc();
    this.mesh.add(this._flareDisc);

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

  _createFlareDisc() {
    const R = this._renderRadius;
    const [cr, cg, cb] = this.data.color;

    // Large quad — shader renders spikes + halo
    const size = R * 28;
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

        // Rainbow spectrum: maps 0-1 to visible light colors
        vec3 spectrum(float t) {
          // Peaking RGB channels at different positions for a natural rainbow
          vec3 c;
          c.r = smoothstep(0.0, 0.35, t) - smoothstep(0.65, 1.0, t);  // red-orange peak early
          c.g = smoothstep(0.15, 0.5, t) - smoothstep(0.7, 1.0, t);   // green peaks middle
          c.b = smoothstep(0.4, 0.75, t);                               // blue-violet peaks late
          // Add some warm overlap for yellow/orange
          c.r += smoothstep(0.1, 0.3, t) * (1.0 - smoothstep(0.3, 0.55, t)) * 0.5;
          return clamp(c, 0.0, 1.0);
        }

        void main() {
          vec2 p = (vUv - 0.5) * uSize;
          float dist = length(p);
          float angle = atan(p.y, p.x);

          float alpha = 0.0;
          vec3 color = vec3(0.0);

          // ── Diffraction spikes (6-pointed) ──
          float spikeCount = 6.0;
          for (float i = 0.0; i < 6.0; i++) {
            float spikeAngle = i / spikeCount * 3.14159265;
            // Distance from this spike's line (in both directions)
            float diff = abs(sin(angle - spikeAngle));

            // Spike width tapers: thick near star, thin far away
            float spikeLen = uStarRadius * 12.0;
            float t = clamp(dist / spikeLen, 0.0, 1.0);
            float width = mix(0.04, 0.008, t);

            float spikeMask = smoothstep(width, width * 0.3, diff);

            // Brightness falloff along spike length
            float falloff = exp(-t * 2.5);

            // Skip inside star
            float innerMask = smoothstep(uStarRadius * 0.8, uStarRadius * 1.3, dist);

            float spikeAlpha = spikeMask * falloff * innerMask;

            // Color: white/star-color near center, rainbow spectrum toward tips
            // t=0 (center) -> star color, t=0.3+ -> rainbow dispersion
            float spectrumBlend = smoothstep(0.15, 0.5, t);

            // Each spike gets a slightly different spectrum offset for variety
            float specOffset = i * 0.05;
            // Map angular position across spike width to spectrum position
            // This creates the rainbow spread — red on one edge, blue on the other
            float spikeAngleDiff = sin(angle - spikeAngle); // signed, -1 to 1
            float specPos = clamp(spikeAngleDiff / (width * 2.0) + 0.5 + specOffset, 0.0, 1.0);

            vec3 rainbowColor = spectrum(specPos);
            vec3 baseColor = mix(vec3(1.0), uColor, 0.3); // mostly white near center
            vec3 spikeColor = mix(baseColor, rainbowColor * 1.3, spectrumBlend);

            color += spikeColor * spikeAlpha;
            alpha += spikeAlpha;
          }

          // ── Halo ring (lens ghost) ──
          float haloRadius = uStarRadius * 3.5;
          float haloWidth = uStarRadius * 0.4;
          float haloDist = abs(dist - haloRadius);
          float haloAlpha = smoothstep(haloWidth, 0.0, haloDist) * 0.25;

          // Halo gets subtle rainbow too
          float haloSpecPos = (angle / 6.28318 + 0.5); // map angle to 0-1
          vec3 haloColor = mix(uColor, spectrum(fract(haloSpecPos)) * 0.8, 0.4);

          color += haloColor * haloAlpha;
          alpha += haloAlpha;

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
    this._flareDisc.material.uniforms.uTime.value = this._time;

    // Billboard: always face camera
    if (camera) {
      this._flareDisc.quaternion.copy(camera.quaternion);
    }
  }

  updateGlow() {
    // No glow sprite — flare disc replaces it
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.surface.geometry.dispose();
    this.surface.material.dispose();
    this._flareDisc.geometry.dispose();
    this._flareDisc.material.dispose();
  }
}
