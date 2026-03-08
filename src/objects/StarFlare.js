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
 * - Brightness pulses subtly when camera moves
 * - Bayer dithered edges matching the game's retro aesthetic
 * - Billboard fallback at distance so the star never disappears
 *
 * All elements billboard (face camera).
 */
export class StarFlare {
  constructor(starData, renderRadius = null) {
    this.data = starData;
    this._renderRadius = renderRadius !== null ? renderRadius : starData.radius;
    this.mesh = new THREE.Group();

    // No separate sphere mesh — the star core is rendered entirely in the
    // flare shader so there's no hard geometry edge visible through the bloom.
    this.surface = null;

    // Diffraction spikes + glow + core (all in one shader billboard)
    this._flareDisc = this._createFlareDisc();
    this._flareDisc.frustumCulled = false;
    this.mesh.add(this._flareDisc);

    // Distance billboard — bright glow visible when the flare quad is too small
    this._billboard = this._createBillboard();
    this._billboard.frustumCulled = false;
    this.mesh.add(this._billboard);
    this._billboard.visible = false;

    this._time = 0;
    this._lastCamPos = new THREE.Vector3();
    this._camSpeed = 0;
    this._screenAngle = 0;
  }

  _createFlareDisc() {
    const R = this._renderRadius;
    const [cr, cg, cb] = this.data.color;

    // Luminosity factor: log-scale mapping
    const rawLum = this.data.luminosity || 1.0;
    const lumFactor = Math.max(0.55, Math.min(2.0, 0.7 + 0.2 * Math.log10(rawLum)));

    const size = R * 30;
    const geometry = new THREE.PlaneGeometry(size, size);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Vector3(cr, cg, cb) },
        uStarRadius: { value: R },
        uSize: { value: size },
        uScreenAngle: { value: 0 },
        uBrightPulse: { value: 1.0 },
        uLumFactor: { value: lumFactor },
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

        float spikeBrightness(float perpDist, float along, float spikeWidth) {
          float w = spikeWidth * (1.0 - along * 0.7);
          float mask = smoothstep(w, w * 0.2, abs(perpDist));
          float falloff = exp(-along * 2.0) * 0.95;
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
          // Single smooth radial falloff from overexposed white center
          // through star color to dim glow. No separate core/glow boundary.
          // This prevents the "flat disc" artifact on warm-colored stars.
          float r = dist / uStarRadius;

          // Overexposed center: blows out to white, fading to star color further out.
          // At r=0 brightness is ~2.5 (overexposed white), at r=1 it's ~1.0 (star color),
          // beyond that it's the exponential glow tail.
          float radialBright = exp(-r * 0.8) * 2.5 * max(uLumFactor, 0.7);

          // Color: white at center → star color further out
          // The overexposure (brightness > 1) naturally pushes toward white via additive blending
          float whiteness = exp(-r * 1.2);
          vec3 coreColor = mix(uColor, vec3(1.0), whiteness * 0.6);

          color += coreColor * radialBright;

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

          // Bayer dithered edges
          float brightness = max(max(color.r, color.g), color.b);
          if (brightness < 0.01) discard;
          float dither = bayerDither(gl_FragCoord.xy);
          if (dither > brightness) discard;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(geometry, material);
  }

  /**
   * Billboard fallback — a small bright dot that stays visible at any distance.
   * Uses a Sprite so Three.js auto-sizes it in screen space.
   */
  _createBillboard() {
    const [cr, cg, cb] = this.data.color;

    // Procedural radial gradient — matches Star.js glow style
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.04)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      color: new THREE.Color(cr, cg, cb),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);
    this._baseGlowScale = this._renderRadius * 3.5;
    sprite.scale.set(this._baseGlowScale, this._baseGlowScale, 1);

    return sprite;
  }

  update(deltaTime, camera) {
    this._time += deltaTime;
    const uniforms = this._flareDisc.material.uniforms;
    uniforms.uTime.value = this._time;

    if (camera) {
      // Billboard: always face camera
      this._flareDisc.quaternion.copy(camera.quaternion);

      // ── Distance LOD: swap between flare disc and billboard ──
      const dist = camera.position.distanceTo(this.mesh.position);
      // The flare quad is R*30 wide. At far distances it becomes sub-pixel.
      // Switch to billboard when the quad would be smaller than ~10 pixels.
      const angularSize = (this._renderRadius * 30) / Math.max(dist, 0.001);
      const pixelSize = angularSize * window.innerHeight * 0.5;
      if (pixelSize < 10) {
        this._flareDisc.visible = false;
        this._billboard.visible = true;
      } else {
        this._flareDisc.visible = true;
        this._billboard.visible = false;
      }

      // Scale billboard to maintain minimum angular size (same as Star.js)
      // so the star is always visible as a bright colored point
      const minAngularSize = 0.015;
      const distScale = dist * minAngularSize;
      const scale = Math.max(this._baseGlowScale, distScale);
      const maxScale = dist * 0.2;
      const finalScale = Math.min(scale, maxScale);
      this._billboard.scale.set(finalScale, finalScale, 1);

      // ── Screen-position alignment ──
      const starWorld = this.mesh.position;
      const projected = starWorld.clone().project(camera);
      const sx = projected.x;
      const sy = projected.y;
      const screenDist = Math.sqrt(sx * sx + sy * sy);

      if (screenDist > 0.02) {
        this._screenAngle = Math.atan2(sy, sx);
      }
      uniforms.uScreenAngle.value = this._screenAngle;

      // ── Brightness pulse from camera motion ──
      const camPos = camera.position;
      const dx = camPos.x - this._lastCamPos.x;
      const dy = camPos.y - this._lastCamPos.y;
      const dz = camPos.z - this._lastCamPos.z;
      const moveSpeed = Math.sqrt(dx * dx + dy * dy + dz * dz) / Math.max(deltaTime, 0.001);
      this._lastCamPos.copy(camPos);

      this._camSpeed += (moveSpeed - this._camSpeed) * Math.min(1, deltaTime * 5);

      const normalizedSpeed = this._camSpeed / (this._renderRadius * 2);
      const pulse = 1.0 + Math.min(0.4, normalizedSpeed * 0.1);
      uniforms.uBrightPulse.value = pulse;
    }
  }

  updateGlow() {
    // No glow sprite — flare disc replaces it
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this._flareDisc.geometry.dispose();
    this._flareDisc.material.dispose();
    this._billboard.material.map.dispose();
    this._billboard.material.dispose();
  }
}
