import * as THREE from 'three';

/**
 * StarFlare — star with lens diffraction spikes and rainbow chromatic dispersion.
 *
 * Based on real lens flare reference:
 * - 8 spikes (4 pairs): vertical/horizontal are thickest, diagonals thinner
 * - Blazing bright at base (nearly star brightness), fading outward
 * - Rainbow chromatic aberration: R/G/B channels offset along each spike,
 *   creating parallel color bands running the length of the spike
 * - Bright highlight knots partway down each spike
 * - Subtle circular halo ring
 *
 * All elements billboard (face camera).
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
    const size = R * 30;
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

        // Compute a single spike's contribution at a given point.
        // Returns brightness (0-1) for this spike.
        // perpDist: perpendicular distance from spike axis
        // along: distance along the spike from center (0 at star, 1 at tip)
        // spikeWidth: half-width of the spike at center
        float spikeBrightness(float perpDist, float along, float spikeWidth) {
          // Width tapers toward tip
          float w = spikeWidth * (1.0 - along * 0.7);
          float mask = smoothstep(w, w * 0.2, abs(perpDist));

          // Brightness: very bright at base, fading outward
          float falloff = exp(-along * 2.0) * 0.95;

          // Highlight knots at ~30% and ~55% along
          float knot1 = exp(-pow((along - 0.30) * 8.0, 2.0)) * 0.6;
          float knot2 = exp(-pow((along - 0.55) * 10.0, 2.0)) * 0.35;
          falloff += knot1 + knot2;

          return mask * falloff;
        }

        void main() {
          vec2 p = (vUv - 0.5) * uSize;
          float dist = length(p);

          // Skip inside star
          if (dist < uStarRadius * 0.9) discard;
          float innerFade = smoothstep(uStarRadius * 0.9, uStarRadius * 1.4, dist);

          float spikeLen = uStarRadius * 13.0;
          vec3 color = vec3(0.0);

          // 8 spikes: 4 angles, each goes both directions from center
          // Angles: 0 (horizontal), PI/2 (vertical), PI/4 (diagonal), 3PI/4 (diagonal)
          // Horizontal/vertical are 4x thicker, diagonals 2x thicker (relative to old)
          float angles[4];
          angles[0] = 0.0;               // horizontal
          angles[1] = 1.5707963;          // vertical (PI/2)
          angles[2] = 0.7853982;          // diagonal (PI/4)
          angles[3] = 2.3561945;          // diagonal (3PI/4)

          float widths[4];
          widths[0] = uStarRadius * 0.32; // horizontal — thick
          widths[1] = uStarRadius * 0.32; // vertical — thick
          widths[2] = uStarRadius * 0.16; // diagonal — half as thick
          widths[3] = uStarRadius * 0.16; // diagonal — half as thick

          for (int i = 0; i < 4; i++) {
            float sa = angles[i];
            vec2 axis = vec2(cos(sa), sin(sa));
            vec2 perp = vec2(-sin(sa), cos(sa));

            // Project point onto spike axis and perpendicular
            float alongDist = dot(p, axis);  // signed distance along spike
            float perpDist = dot(p, perp);   // signed distance perpendicular

            float along = abs(alongDist) / spikeLen; // 0 at center, 1 at tip
            if (along > 1.0) continue;

            float w = widths[i];

            // Chromatic aberration: offset R, G, B channels perpendicular to spike
            // Each color sees the spike at a slightly different perpendicular position
            // This creates parallel rainbow bands running along the spike length
            float chromOffset = w * 0.6; // how far apart the color channels spread
            // More spread further from center
            float spreadFactor = smoothstep(0.05, 0.4, along);

            float rPerp = perpDist + chromOffset * spreadFactor;
            float gPerp = perpDist;
            float bPerp = perpDist - chromOffset * spreadFactor;

            float rBright = spikeBrightness(rPerp, along, w) * innerFade;
            float gBright = spikeBrightness(gPerp, along, w) * innerFade;
            float bBright = spikeBrightness(bPerp, along, w) * innerFade;

            // Near the base, blend toward white (all channels equal)
            float whiteBlend = exp(-along * 4.0);

            // Star color tint (subtle)
            vec3 tintedR = mix(vec3(1.0, 0.15, 0.05), vec3(1.0), whiteBlend);
            vec3 tintedG = mix(vec3(0.1, 1.0, 0.15), vec3(1.0), whiteBlend);
            vec3 tintedB = mix(vec3(0.1, 0.2, 1.0), vec3(1.0), whiteBlend);

            color += tintedR * rBright + tintedG * gBright + tintedB * bBright;
          }

          // ── Halo ring (lens ghost) ──
          float haloRadius = uStarRadius * 4.0;
          float haloWidth = uStarRadius * 0.35;
          float haloDist = abs(dist - haloRadius);
          float haloAlpha = smoothstep(haloWidth, 0.0, haloDist) * 0.15;
          // Subtle rainbow around the ring
          float haloAngle = atan(p.y, p.x);
          float haloHue = fract(haloAngle / 6.28318 + 0.5);
          vec3 haloColor = vec3(
            smoothstep(0.0, 0.33, haloHue) - smoothstep(0.66, 1.0, haloHue),
            smoothstep(0.15, 0.5, haloHue) - smoothstep(0.7, 1.0, haloHue),
            smoothstep(0.4, 0.75, haloHue)
          );
          haloColor = mix(uColor, haloColor, 0.5);
          color += haloColor * haloAlpha;

          float alpha = clamp(max(max(color.r, color.g), color.b), 0.0, 1.0);
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
