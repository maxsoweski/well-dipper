import * as THREE from 'three';

/**
 * StarFlare — star with lens diffraction spikes and rainbow chromatic dispersion.
 *
 * Based on real lens flare reference:
 * - 8 spikes (4 pairs): vertical/horizontal are thickest, diagonals thinner/shorter
 * - Blazing bright at base (nearly star brightness), fading outward
 * - Rainbow chromatic aberration: R/G/B channels offset along each spike
 * - Bright highlight knots partway down each spike
 * - Subtle circular halo ring
 * - Screen-position alignment: spike pattern rotates to point from screen center
 *   toward the star (real lens flare behavior)
 * - Brightness pulses subtly when camera moves
 *
 * All elements billboard (face camera).
 */
export class StarFlare {
  constructor(starData, renderRadius = null) {
    this.data = starData;
    this._renderRadius = renderRadius !== null ? renderRadius : starData.radius;
    this.mesh = new THREE.Group();

    // Invisible sphere for click raycasting (star systems register
    // star.surface as a click target — needs to be a real mesh).
    this.surface = this._createSurface();
    this.surface.frustumCulled = false;
    this.mesh.add(this.surface);

    // Diffraction spikes + glow + core (all in one shader billboard)
    this._flareDisc = this._createFlareDisc();
    this._flareDisc.frustumCulled = false;
    this.mesh.add(this._flareDisc);

    // Distance billboard — opaque colored plane, hidden up close,
    // toggled visible when the flare disc is too small to see.
    this._billboard = this._createBillboard();
    this.mesh.add(this._billboard);
    this._billboard.visible = false;

    this._time = 0;
    this._lastCamPos = new THREE.Vector3();
    this._camSpeed = 0;       // smoothed camera speed for brightness pulse
  }

  _createSurface() {
    const geometry = new THREE.IcosahedronGeometry(this._renderRadius, 2);
    const material = new THREE.MeshBasicMaterial({
      visible: false, // not rendered, only used for raycasting
    });
    return new THREE.Mesh(geometry, material);
  }

  _createBillboard() {
    const [r, g, b] = this.data.color;
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(r, g, b),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  _createFlareDisc() {
    const R = this._renderRadius;
    const [cr, cg, cb] = this.data.color;

    // Luminosity factor: maps the huge physical luminosity range (0.04 – 300,000)
    // to a visual multiplier using log scale.
    //   M-class (0.04) → ~0.45  — small, dim glow
    //   G-class (1.0)  → ~0.70  — moderate (Sun-like baseline)
    //   A-class (20)   → ~0.96  — bright
    //   O-class (300K) → ~1.80  — huge, blazing flare
    const rawLum = this.data.luminosity || 1.0;
    const lumFactor = Math.max(0.55, Math.min(2.0, 0.7 + 0.2 * Math.log10(rawLum)));

    // Large quad — shader renders spikes + halo
    const size = R * 30;
    const geometry = new THREE.PlaneGeometry(size, size);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Vector3(cr, cg, cb) },
        uStarRadius: { value: R },
        uSize: { value: size },
        uScreenAngle: { value: 0 },      // rotation from screen-center alignment
        uBrightPulse: { value: 1.0 },     // brightness multiplier from camera motion
        uLumFactor: { value: lumFactor },  // luminosity-based glow/spike scaling
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
        uniform float uScreenAngle;
        uniform float uBrightPulse;
        uniform float uLumFactor;
        varying vec2 vUv;

        // 4x4 Bayer dithering threshold (matches Planet.js / rest of the game)
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

        // Compute a single spike's contribution at a given point.
        float spikeBrightness(float perpDist, float along, float spikeWidth) {
          float w = spikeWidth * (1.0 - along * 0.7);
          float mask = smoothstep(w, w * 0.2, abs(perpDist));
          float falloff = exp(-along * 2.0) * 0.95;
          // Highlight knots at ~30% and ~55% along
          float knot1 = exp(-pow((along - 0.30) * 8.0, 2.0)) * 0.6;
          float knot2 = exp(-pow((along - 0.55) * 10.0, 2.0)) * 0.35;
          falloff += knot1 + knot2;
          return mask * falloff;
        }

        void main() {
          vec2 p = (vUv - 0.5) * uSize;

          // Rotate the whole pattern by the screen-center angle
          float cs = cos(uScreenAngle);
          float sn = sin(uScreenAngle);
          p = vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);

          float dist = length(p);

          if (dist > uSize * 0.5) discard;

          float mainSpikeLen = uStarRadius * 6.5 * uLumFactor;
          float diagSpikeLen = uStarRadius * 3.25 * uLumFactor;
          vec3 color = vec3(0.0);

          // ── Star core + glow ──
          // Core and glow radius stay constant so the bloom always bridges
          // smoothly into the spikes. Only glow brightness scales with luminosity.
          float coreBright = smoothstep(uStarRadius * 1.3, uStarRadius * 0.5, dist);
          float glowRadius = uStarRadius * 3.0;
          float glowBright = exp(-dist / glowRadius * 1.5) * 1.5 * uLumFactor;
          color += uColor * max(coreBright, glowBright);

          // 8 spikes: 4 angles, each goes both directions
          float angles[4];
          angles[0] = 0.0;
          angles[1] = 1.5707963;
          angles[2] = 0.7853982;
          angles[3] = 2.3561945;

          float widths[4];
          widths[0] = uStarRadius * 0.32;
          widths[1] = uStarRadius * 0.32;
          widths[2] = uStarRadius * 0.08;
          widths[3] = uStarRadius * 0.08;

          float lengths[4];
          lengths[0] = mainSpikeLen;
          lengths[1] = mainSpikeLen;
          lengths[2] = diagSpikeLen;
          lengths[3] = diagSpikeLen;

          for (int i = 0; i < 4; i++) {
            float sa = angles[i];
            vec2 axis = vec2(cos(sa), sin(sa));
            vec2 perp = vec2(-sin(sa), cos(sa));

            float alongDist = dot(p, axis);
            float perpDist = dot(p, perp);

            float sLen = lengths[i];
            float along = abs(alongDist) / sLen;
            if (along > 1.0) continue;

            float w = widths[i];

            float chromOffset = w * 0.3;
            float spreadFactor = smoothstep(0.05, 0.4, along);

            float rPerp = perpDist + chromOffset * spreadFactor;
            float gPerp = perpDist;
            float bPerp = perpDist - chromOffset * spreadFactor;

            float rBright = spikeBrightness(rPerp, along, w);
            float gBright = spikeBrightness(gPerp, along, w);
            float bBright = spikeBrightness(bPerp, along, w);

            float starBlend = exp(-along * 3.5);
            float combinedBright = (rBright + gBright + bBright) / 3.0;
            vec3 rainbowContrib = vec3(rBright, gBright, bBright);
            vec3 starContrib = uColor * combinedBright;

            color += mix(rainbowContrib, starContrib, starBlend);
          }

          // ── Halo ring (lens ghost) ──
          float haloRadius = uStarRadius * 4.0;
          float haloWidth = uStarRadius * 0.35;
          float haloDist = abs(dist - haloRadius);
          float haloAlpha = smoothstep(haloWidth, 0.0, haloDist) * 0.15;
          float haloAngle = atan(p.y, p.x);
          float haloHue = fract(haloAngle / 6.28318 + 0.5);
          vec3 haloColor = vec3(
            smoothstep(0.0, 0.33, haloHue) - smoothstep(0.66, 1.0, haloHue),
            smoothstep(0.15, 0.5, haloHue) - smoothstep(0.7, 1.0, haloHue),
            smoothstep(0.4, 0.75, haloHue)
          );
          haloColor = mix(uColor, haloColor, 0.5);
          color += haloColor * haloAlpha;

          // Apply brightness pulse from camera motion
          color *= uBrightPulse;

          // Dithered edges: use Bayer threshold against brightness to create
          // stippled transparency at the edges of spikes, glow, and halo.
          // Chunky dither (3x) matches the retro pixel grid.
          float brightness = max(max(color.r, color.g), color.b);
          if (brightness < 0.01) discard;
          float dither = bayerDither(floor(gl_FragCoord.xy / 3.0));
          if (dither > brightness) discard;

          // Alpha proportional to brightness: bright core = full replace,
          // dim edges = blend with background. Prevents dim flare pixels
          // from appearing as dark debris against bright galaxy backgrounds.
          float alpha = clamp(brightness * 2.0, 0.0, 1.0);
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
    const uniforms = this._flareDisc.material.uniforms;
    uniforms.uTime.value = this._time;

    if (camera) {
      // Billboard: always face camera
      this._flareDisc.quaternion.copy(camera.quaternion);

      // ── Distance LOD: swap flare disc for opaque billboard ──
      const dist = camera.position.distanceTo(this.mesh.position);
      const angularSize = (this._renderRadius * 30) / Math.max(dist, 0.001);
      const pixelSize = angularSize * window.innerHeight * 0.5;
      if (pixelSize < 20) {
        this._flareDisc.visible = false;
        this._billboard.visible = true;
        const minSize = dist * 0.012;
        this._billboard.scale.set(minSize, minSize, 1);
        this._billboard.quaternion.copy(camera.quaternion);
      } else {
        this._flareDisc.visible = true;
        this._billboard.visible = false;
      }

      // Diffraction spikes have a fixed orientation — they're caused by
      // the physical lens aperture, which is the same for all light sources.
      // uScreenAngle stays at 0 (no per-star rotation).

      // ── Brightness pulse from camera motion ──
      const camPos = camera.position;
      const dx = camPos.x - this._lastCamPos.x;
      const dy = camPos.y - this._lastCamPos.y;
      const dz = camPos.z - this._lastCamPos.z;
      const moveSpeed = Math.sqrt(dx * dx + dy * dy + dz * dz) / Math.max(deltaTime, 0.001);
      this._lastCamPos.copy(camPos);

      // Smooth the speed value (exponential decay)
      this._camSpeed += (moveSpeed - this._camSpeed) * Math.min(1, deltaTime * 5);

      // Map speed to brightness pulse: resting = 1.0, moving = up to 1.4
      // Normalize by star radius so it works at any zoom level
      const normalizedSpeed = this._camSpeed / (this._renderRadius * 2);
      const pulse = 1.0 + Math.min(0.4, normalizedSpeed * 0.1);
      uniforms.uBrightPulse.value = pulse;
    }
  }

  updateGlow() {
    // No glow sprite — billboard handles distance visibility
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.surface.geometry.dispose();
    this.surface.material.dispose();
    this._flareDisc.geometry.dispose();
    this._flareDisc.material.dispose();
    this._billboard.geometry.dispose();
    this._billboard.material.dispose();
  }
}
