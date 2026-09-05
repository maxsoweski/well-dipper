import * as THREE from 'three';
import { PIXEL_SCALE } from '../rendering/pixelScaleUniform.js';
import { SKY_PIXEL_SCALE } from '../rendering/skyPixelScale.js';
import { planetTargetPx, MAGNITUDE_LAW } from '../rendering/apparentMagnitude.js';

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
    // ⚠ RADIUS STORED, SIZE NOT CACHED. computeTargetPixels now reads SKY_PIXEL_SCALE and the
    // magnitude-law toggle, both of which move at RUNTIME — the resolution setting changes the
    // former on every window resize and the backslash key flips the latter. A value cached here
    // would strand every already-mounted planet at whatever they were when it spawned, which is
    // the same build-time-read defect posterizeLevels.js and pixelScaleUniform.js both warn about.
    // The star billboard already recomputes per frame; this now matches it.
    this._sceneRadius = sceneRadius;

    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uDitherScale: PIXEL_SCALE,
        uMagnitudeLaw: MAGNITUDE_LAW,   // ⭐ shared object, so the backslash key reaches every already-mounted billboard
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
        uniform float uDitherScale;
        uniform float uMagnitudeLaw;
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
          float ditherAuthority = 1.0 - smoothstep(3.0, 4.5, uDitherScale);   // ⭐ THE CURVE IS PINNED TO THE SHIPPED DEFAULT. 1.0 at scale <= 3 means the look Max already
          // approved is BYTE-IDENTICAL — this must not quietly restyle the game at its own default —
          // and it reaches 0 by 4.5, which is 240p on his window, because that is the resolution he
          // says the dithering was not designed for. Between them it eases rather than steps.
          // ⚠ A CHOSEN CURVE, NOT A DERIVED ONE: the endpoints are principled (shipped default /
          // the resolution he rejected it at), the easing between them is taste and is his to move.
          // ⭐ Max, 2026-09-06: the checkerboard is "pronounced on the stars when you get close
          // enough". A close star is a LARGE sprite, so the edge stipple that reads as a soft
          // rim at 3px cells is applied across its whole disc at 4.5 — the sprite becomes a
          // checkerboard rather than a star. Fading toward a fixed 0.5 threshold gives a hard
          // circular edge instead, which is what a sprite at this resolution should be.
          float threshold = mix(0.5, bayerDither(floor(gl_FragCoord.xy / max(1.0, 3.0 / uDitherScale))), ditherAuthority);   // ⭐ cell held at ~3 SCREEN px: gl_FragCoord is in BUFFER px, so a bare /3.0 became a 13.5px checker at scale 4.5 (see pixelScaleUniform.js)
          if (shape < threshold * 0.5) discard;
          // Dimmer than stars — 1.2x HDR vs 1.8x for stars.
          // ⭐ 1.2 COULD NOT REACH THE CEILING AND THAT IS ARITHMETIC, NOT TASTE. uColor here is a
          // BODY colour — a brown or blue-grey whose largest channel is already well under 1 —
          // and shape peaks below 1 because a plane's fragment centres do not land on the exact
          // peak at 240p. 1.2 times that clips at nothing: measured peaks were 204-221 against a
          // background star's 255, so a planet read DIMMER than the stars behind it.
          // ⚠ uMagnitudeLaw GATES IT so the backslash A/B compares against the shipped look.
          // Planets stay under the STAR (1.8x on a near-white colour); the point is only to
          // clear the STARFIELD, which is what the complaint was about.
          vec3 col = uColor * shape * mix(1.2, 2.6, uMagnitudeLaw);
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
    // ⭐ THE LAW MOVED OUT TO apparentMagnitude.js, AND THE FLOOR IS THE REASON. 4 screen px is
    // under one BUFFER pixel at 240p (4 / 4.7 = 0.85), and unlike StarfieldLayer — which clamps a
    // sub-pixel star to a whole buffer pixel AND exempts it from the dither discard — this program
    // had neither, so a rocky moon's dot landed at about half a pixel with a live discard and
    // winked on and off with sub-pixel camera drift. Measured at 240p: planet dots peak at 204-221
    // where a background star hits 255, and the smallest is 2x3 px against that star's 2x3. Both
    // dimmer AND smaller than the sky behind them, which is Max's "still illegible" exactly.
    return planetTargetPx(sceneRadius, SKY_PIXEL_SCALE.value);
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
    const worldSize = (PlanetBillboard.computeTargetPixels(this._sceneRadius) / pixelsPerRadian) * dist;
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
