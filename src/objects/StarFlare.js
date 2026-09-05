import * as THREE from 'three';
import { assignName, resolveStarId } from '../util/scene-naming.js';
import { PIXEL_SCALE } from '../rendering/pixelScaleUniform.js';
import { POSTERIZE_QUANTUM } from '../rendering/posterizeLevels.js';
import { GLOW_GRADIENT_MODE } from '../rendering/glowGradientMode.js';
import { SKY_PIXEL_SCALE } from '../rendering/skyPixelScale.js';   // the ceiling the star must beat is the STARFIELD's, so the margin is measured in sky buffer pixels
import { lumFactorOf, starTargetPx } from '../rendering/apparentMagnitude.js';   // ⭐ how the halo renders its falloff at 240p; see that file for why a stipple cannot.

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
    const _flareInfo = resolveStarId(starData);
    const _flareKind = starData?._isSecondary ? 'starflare2' : 'starflare';
    assignName(this.mesh, { category: 'effect', kind: _flareKind, id: _flareInfo.id, systemSeed: starData?._systemSeed, fullHash: _flareInfo.fullHash });

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
    // Distance billboard — replaces the flare disc when the star has
    // shrunk to background-star size on screen. Shader is a direct port
    // of StarfieldLayer's shape function (circular core+glow, Bayer
    // dithered edge in 3-pixel screen blocks) so the billboard reads
    // identical to a bright background star at the switch point. The
    // hard `if (dist > 0.5) discard` kills the rectangular quad bounds
    // that the previous MeshBasicMaterial version showed at distance.
    const [r, g, b] = this.data.color;
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uDitherScale: PIXEL_SCALE,
        // ⭐⭐ THE MAGNITUDE TERM THIS PROGRAM NEVER HAD. lumFactor was computed in
        // _createFlareDisc and spent ENTIRELY on billboardSwitchDistance, so an O-class supergiant
        // and an M-dwarf wrote the IDENTICAL peak byte. The starfield carries a per-star magnitude
        // baked into its colour; the system's own star carried none. Set in _createFlareDisc,
        // ⚠ READ FROM this._lumFactor, WHICH IS ALREADY SET: the constructor builds the flare
        // disc BEFORE the billboard (see the two _create calls), and _createFlareDisc stashes
        // it. The 0.7 fallback is Sol's, so a reorder degrades to the shipped look rather than
        // to a black star.
        uLumFactor: { value: this._lumFactor || 0.7 },
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
        uniform vec3 uColor;
        uniform float uLumFactor;
        varying vec2 vUv;

        // 4x4 Bayer dithering threshold (matches StarfieldLayer / Planet.js)
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
          // Hard circular discard — the rectangular quad bounds never show.
          if (dist > 0.5) discard;
          // Circular shape with soft glow falloff (StarfieldLayer formula).
          // Bright core → soft edge. Reads as a point of light.
          float coreBright = 1.0 - smoothstep(0.0, 0.2, dist);
          float glow = 1.0 - smoothstep(0.1, 0.5, dist);
          float shape = coreBright * 0.6 + glow * 0.4;
          // Bayer dither in 3-pixel screen blocks — matches the retro
          // pipeline and StarfieldLayer's edge stippling exactly.
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
          // Boost brightness past 1.0 and clamp — same trick StarfieldLayer
          // uses (HDR vColor → min(col, 1.0)). Without this, the peak
          // pixel never reaches 255 because Plane fragments don't land at
          // exact vUv (0.5,0.5) and the post-process pipeline darkens
          // a bit more on top. 1.8x guarantees the center pixel saturates
          // while leaving the mid-falloff (shape ~0.3-0.5) clearly below
          // 1.0 so it dithers into a hazy glow halo around the bright
          // core, matching the brightest background stars' look.
          // ⭐ 1.8 WAS A CONSTANT WHERE A MAGNITUDE BELONGED. Its own comment called it "the same
          // trick StarfieldLayer uses", which is wrong: StarfieldLayer has no constant multiplier,
          // it has a per-star brightness. Scaling by luminosity keeps the bright stars saturating
          // exactly as before and lets the dim ones fall below the ceiling, which is the only way
          // value can say anything at all once the core clips at 255.
          // ⚠ NORMALISED AT lumFactor 0.7 (Sol) SO THE SHIPPED LOOK IS THE FIXED POINT: a Sol-like
          // star is byte-identical to before, an O-class is brighter, an M-dwarf dimmer.
          vec3 col = uColor * shape * 1.8 * (uLumFactor / 0.7);
          gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
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
    const lumFactor = lumFactorOf(rawLum);   // ⭐ shared clamp — apparentMagnitude.js
    // Save for distance-LOD threshold + billboard sizing in update().
    // Brighter stars get bigger background-star equivalents when they
    // shrink past the switch threshold.
    this._lumFactor = lumFactor;

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
        // Spike intensity faded out as the star shrinks toward the
        // billboard switch threshold. By the time the switch happens,
        // spikes are at 0 so the flareDisc looks like a bare circular
        // core — matching the billboard's circular dot. Without this
        // fade the switch was a hard pop (lens flare → dot). Updated
        // per frame in update().
        uSpikeIntensity: { value: 1.0 },
        // ⭐ THE SHARED WORLD PIXEL-SCALE OBJECT — identity, not a copy, for the reason in
        // pixelScaleUniform.js: this material is built once and mutated, so a build-time read
        // would strand it at whatever the slider said when the star mounted.
        uDitherScale: PIXEL_SCALE,
        // ⭐ BOTH SHARED BY IDENTITY, for the same reason as uDitherScale above. uPosterizeLevels
        // is the colour-depth number Max already owns (31 = RGB555); the banded halo takes its
        // step count AND its termination from it rather than from a constant invented here.
        uPosterizeLevels: POSTERIZE_QUANTUM,
        uGlowMode: GLOW_GRADIENT_MODE,
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
        uniform float uDitherScale;
        uniform vec2  uPosterizeLevels;   // x = levels, y = 1/levels
        uniform float uGlowMode;
        uniform float uSpikeIntensity;
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

            color += mix(rainbowContrib, starContrib, starBlend) * uSpikeIntensity;
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

          // ── THE FALLOFF ─────────────────────────────────────────────────────────────────────
          // ⭐⭐ THIS IS THE PROGRAM THAT DRAWS A *CLOSE* STAR. StarFlare has two programs and swaps
          // between them by distance (billboardSwitchDistance): far = _createBillboard, near = this
          // flare disc. The billboard got the 2026-09-06 dither-authority fade; this did not, so
          // that fix landed on exactly the representation Max was NOT looking at.
          //
          // ⭐⭐⭐ WHAT THE STIPPLE WAS ACTUALLY DOING, WHICH TOOK ME TWO WRONG ANSWERS TO SEE.
          // The line "if (dither > brightness) discard" lights a pixel with probability brightness
          // and, when lit, writes brightness. Its EXPECTED VALUE over the cell is therefore
          // brightness * brightness. The dither was never only a texture — it was a GAMMA, and it
          // is what held every faint feature down. Delete it and the falloff linearises: the
          // lens-ghost ring at 4R (alpha 0.15) and the outer halo, which used to be sparse
          // speckle, get drawn SOLID. Max, 2026-09-07: "star is now surrounded by a bunch of
          // discs ... just get rid of those discs." Those discs are pre-existing features that my
          // de-stippling promoted from speckle to solid geometry. Banding them made it worse by
          // adding steps on top.
          //
          // ⭐ SO THE HONEST TRANSLATION OF A COVERAGE DITHER INTO VALUE IS ITS EXPECTED VALUE:
          // multiply by brightness. That reproduces what the stipple averaged to, exactly, at ANY
          // resolution and with no screen-space pattern — which is the whole requirement in his
          // words, "a simple transparency/glow gradient ... that works with this resolution".
          // The core (brightness ~1) is untouched; only the faint regions come back down, which is
          // precisely where the discs were.
          //
          // ⚠ AND THE CUT HAS TO BE BELOW ONE 8-BIT LEVEL, NOT AT 0.01. A discard boundary at 0.01
          // is 2.5/255 — small, but not zero, so it draws a faint hard-edged circle where the glow
          // stops, magnified 4.5x by the composite. Cutting at 1/255 puts the boundary below the
          // smallest value the framebuffer can hold, so there is nothing there to see.
          // ⛔ THE BRANCH IS AN A/B INSTRUMENT ON THE LEFT-BRACKET KEY, NOT A SETTING.
          float brightness = max(max(color.r, color.g), color.b);
          if (brightness < 0.0039) discard;   // 1/255 — one 8-bit level; below this nothing renders

          if (uGlowMode < 0.5) {
            // BAYER — the checkerboard defect, kept as the A/B floor.
            if (bayerDither(gl_FragCoord.xy) > brightness) discard;
          } else if (uGlowMode < 1.5) {
            // HARD CUT — cc06693. Amputates the halo: the whole glow is under 0.5, so only the
            // core survives and the star becomes a bare cross.
            float ditherAuthority = 1.0 - smoothstep(3.0, 4.5, uDitherScale);
            if (mix(0.5, bayerDither(gl_FragCoord.xy), ditherAuthority) > brightness) discard;
          }
          // LINEAR (mode 2) falls through: raw falloff, alpha 1. Kept as the honest "no correction
          // at all" reference — it is the one that shows both faults, the solid rings AND the disc.

          // ── ⭐⭐⭐ THE ALPHA IS NOT DECORATION HERE, IT DECIDES WHETHER THE STARFIELD SURVIVES ──
          // Max, 2026-09-05: "there's still a big black disk around the star."
          //
          // RetroRenderer's composite is mix(bg.rgb, scene.rgb, scene.a) — the SKY is bg, this
          // material draws into scene, and scene.a decides how much of the sky is REPLACED. Writing
          // alpha 1.0 across a quad of radius 15R therefore stamps "fully opaque world" over the
          // starfield everywhere this shader does not discard, and where the glow has fallen to
          // near-black that reads as a big black disc with a hard circular edge at the quad clip.
          //
          // ⭐ SO THE STIPPLE HAD A THIRD JOB, AND THIS IS THE ONE I MISSED TWICE. Beyond being a
          // texture and a gamma, its discard held scene.a at ZERO across most of the quad, which is
          // what let the starfield show through the flare at all. Dropping the threshold to 1/255
          // to kill a faint edge ring turned almost the whole quad opaque and made the disc huge.
          //
          // Writing the glow's own coverage as alpha fixes it at the root: faint regions barely
          // replace the sky, the bright core still fully does. And the coverage GAMMA comes out of
          // the same term for free, because the composite multiplies by scene.a — mix(sky, color, b)
          // is b*color + (1-b)*sky, which is precisely what the stipple averaged to. One term now
          // does all three of the dither's jobs, with no screen-space pattern and no threshold.
          // ⛔ WHICH IS WHY THERE IS NO color *= brightness HERE. The composite already applies it;
          // doing it in the shader too gives b*b*color and a star dimmer than it has ever been.
          float alphaOut = (uGlowMode > 2.5) ? brightness : 1.0;
          gl_FragColor = vec4(color, alphaOut);
        }
      `,
      transparent: true,
      // ⭐ CUSTOM BLENDING, BECAUSE THE COLOUR AND THE COVERAGE NEED DIFFERENT FACTORS AND THREE
      // IGNORES blendSrc/blendDst ENTIRELY UNLESS blending IS CustomBlending. A preset cannot say
      // "add the colour, accumulate the coverage", which is exactly what this material needs.
      //
      // ⭐⭐ THE RGB FACTOR IS One, NOT SrcAlpha, AND THAT IS ARITHMETIC RATHER THAN TASTE. The look
      // being matched is the pre-2026-09-06 one Max approved, where the stipple averaged to
      //     b * color + (1 - b) * sky        [P(lit) = b, and a lit pixel wrote color at alpha 1]
      // The composite is mix(sky, scene.rgb, scene.a), so writing alpha = b reproduces that term
      // for term ONLY if scene.rgb is color itself. With SrcAlpha the buffer would hold color * b
      // and the composite would deliver b*b*color — measured, and the star came out visibly dimmer
      // than it had ever been, which is the wrong direction given magnitude is the open complaint.
      // ⚠ NO EFFECT ON THE OTHER THREE MODES: they write alpha 1, where One and SrcAlpha agree.
      //
      // ⚠ AND ALPHA CANNOT RIDE ON THE RGB FACTORS: it would come out src.a * src.a, squaring the
      // coverage. OneMinusSrcAlpha on the destination is ordinary coverage compositing and
      // saturates at 1, so overlapping flares cannot push scene.a past 1 and make mix() extrapolate.
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(geometry, material);
  }

  /**
   * Camera distance at which the flare disc yields to the distance
   * billboard (and vice versa) — the same screen-space criterion
   * update() applies per frame: the flare's visible glow
   * (renderRadius × 6 world units) projecting below a
   * luminosity-dependent 16–22 px target. Pure math, no renderer
   * needed — warp arrival placement calls this to land the camera in
   * guaranteed-billboard range (main.js warpSwapSystem).
   */
  billboardSwitchDistance(fovDegrees, screenHeightPx) {
    const fovRad = fovDegrees * Math.PI / 180;
    const pixelsPerRadian = (screenHeightPx / 2) / Math.tan(fovRad / 2);
    const lf = this._lumFactor || 0.7;
    // The biggest background stars in StarfieldLayer use aSize=8 which
    // doubles to gl_PointSize=16. Target 16-22 px so the billboard is
    // always at least as big as the brightest BG star:
    //   any star (clamp floor)   → 16 px
    //   G-class (Sol, lf ~0.7)   → 17 px
    //   A-class (~1.0)           → 19 px
    //   O-class (~1.5)           → 22 px (clamp ceiling)
    // ⭐ THE LAW MOVED OUT, AND THE COMMENT ABOVE IS WHY IT HAD TO. It calibrated this against
    // aSize 8 = 16px, the ceiling of StarfieldLayer's LEGACY random path; the live starfield is
    // built from generator data and its measured aSize histogram tops out at 10 = 20px, with the
    // real-star catalog reaching 12 = 24px. So "always at least as big as the brightest BG star"
    // was never true — measured at 240p, this star is 1x2 buffer px against the brightest
    // background star's 2x3. apparentMagnitude.js anchors on the real ceiling plus a margin in
    // BUFFER pixels, so the margin survives a resolution change.
    // ⛔ AND IT IS SHARED NOW: orreryEntryGeometry.starGlowRadiusPx() re-implemented these two
    // lines verbatim against citations that had already gone stale, and it feeds arrival framing —
    // so changing the size here used to desync the orrery camera silently. It imports instead.
    const targetPx = starTargetPx(lf, SKY_PIXEL_SCALE.value);
    // Visible glow diameter is renderRadius*6 (shader glowRadius*2);
    // switch when it projects below targetPx:
    //   (R*6/dist)*pixelsPerRadian < targetPx  ⇔  dist > this value.
    return (this._renderRadius * 6 / targetPx) * pixelsPerRadian;
  }

  update(deltaTime, camera) {
    this._time += deltaTime;
    const uniforms = this._flareDisc.material.uniforms;
    uniforms.uTime.value = this._time;

    if (camera) {
      // Billboard: always face camera
      this._flareDisc.quaternion.copy(camera.quaternion);

      // ── Distance LOD: swap flare disc for circular billboard ──
      // Threshold math lives in billboardSwitchDistance() (single source
      // of truth — warp arrival placement reuses it). The billboard
      // renders at a constant screen size so the star is always at least
      // as big and bright as a peak background starfield star and its
      // halo has room to dither out into a hazy glow.
      const dist = Math.max(
        camera.position.distanceTo(this.mesh.position), 0.001);
      const switchDist =
        this.billboardSwitchDistance(camera.fov, window.innerHeight);

      if (dist > switchDist) {
        // Star has shrunk to background-star size — show the billboard.
        this._flareDisc.visible = false;
        this._billboard.visible = true;
        // World-space scale that produces exactly targetPx pixels at the
        // current camera distance (targetPx/pixelsPerRadian == R*6/switchDist,
        // so worldSize == R*6*dist/switchDist). Recomputed every frame so
        // the projected size stays constant as you fly away.
        const worldSize = (this._renderRadius * 6 * dist) / switchDist;
        this._billboard.scale.set(worldSize, worldSize, 1);
        this._billboard.quaternion.copy(camera.quaternion);
      } else {
        this._flareDisc.visible = true;
        this._billboard.visible = false;
        // Spike fade — ramp diffraction spike contribution down to 0 by
        // the time we'd switch to the billboard, so the flareDisc's last
        // visible state matches the billboard's circular dot. Full spikes
        // above 4× the switch-size, smooth fade down to the switch. (In
        // the old px terms: (visibleDiameterPx − targetPx)/(3·targetPx)
        // == (switchDist/dist − 1)/3 — same ramp, re-expressed.)
        const t = Math.max(0, Math.min(1, (switchDist / dist - 1) / 3));
        const spikeIntensity = t * t * (3 - 2 * t); // smoothstep
        uniforms.uSpikeIntensity.value = spikeIntensity;
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
