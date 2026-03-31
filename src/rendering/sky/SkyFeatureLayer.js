import * as THREE from 'three';

/**
 * SkyFeatureLayer — renders nearby galactic features as sky overlays.
 *
 * Queries GalacticMap for features near the player's position and renders
 * them as billboards / point groups in the sky. Each feature type has
 * a distinct visual treatment:
 *
 *   emission-nebula:   FBM noise billboard, H-alpha red + OIII teal, additive
 *   dark-nebula:       absorption billboard, dims glow + stars behind it
 *   open-cluster:      bright blue-white star points
 *   ob-association:    scattered bright blue-white points (larger spread)
 *   globular-cluster:  compact warm glow billboard
 *   supernova-remnant: ring-shaped billboard, green emission
 *
 * Features are positioned on the sky sphere based on their real galactic
 * position relative to the player. Angular size comes from physical size ÷ distance.
 */

// Max features to render at once (performance budget)
const MAX_FEATURES = 16;
// Sky sphere radius for feature placement (between glow and starfield)
const FEATURE_RADIUS = 499.5;
// Search radius for features (kpc) — features beyond this are too dim to see
const SEARCH_RADIUS = 3.0;

/**
 * Shape mode integers for the nebula billboard fragment shader.
 * Each mode produces a visually distinct noise/falloff pattern.
 *   0 = irregular:   FBM + strong domain warp, dark lanes (emission nebulae like Orion)
 *   1 = ring:        hollow center, bright rim (planetary nebulae like Ring, Helix)
 *   2 = bipolar:     two lobes / hourglass (planetary nebulae like Dumbbell)
 *   3 = filamentary: stretched wispy threads (supernova remnants like Veil, Crab)
 *   4 = shell:       thin bright rim, dark interior (supernova remnant shells)
 *   5 = diffuse:     soft Gaussian blob, smooth edges (reflection nebulae like M78)
 */
const SHAPE_MODE = {
  'irregular': 0,
  'ring': 1,
  'bipolar': 2,
  'bilobed': 2,  // alias — bilobed profiles map to bipolar shader
  'filamentary': 3,
  'shell': 4,
  'diffuse': 5,
  'center-bright': 0,  // legacy fallback
  'scattered': 0,      // legacy fallback
};

export class SkyFeatureLayer {
  /**
   * @param {{ min: number, max: number }} brightnessRange — output brightness limits
   */
  constructor(brightnessRange) {
    this._brightnessRange = brightnessRange;
    this._group = new THREE.Group();

    // Active feature meshes (disposed + recreated on position change)
    this._meshes = [];

    // Ambient tint when inside a feature (blended in composite shader later)
    this.ambientTint = null; // { r, g, b, strength } or null
  }

  get mesh() {
    return this._group;
  }

  /**
   * Update features for a new player position.
   * @param {Array} features — from GalacticMap.findNearbyFeatures()
   * @param {{ x: number, y: number, z: number }} playerPos — galactic position
   */
  setFeatures(features, playerPos) {
    this._clear();
    this.ambientTint = null;

    if (!features || features.length === 0) return;

    // Sort by angular size (biggest first) and take top N
    const scored = features
      .map(f => {
        const dist = Math.max(f.distance, 0.001); // prevent division by zero
        const angularRadius = f.radius / dist; // radians
        return { ...f, angularRadius, dist };
      })
      .sort((a, b) => b.angularRadius - a.angularRadius)
      .slice(0, MAX_FEATURES);

    for (const feature of scored) {
      // Skip features we're inside — don't render as a distant billboard.
      // The ambient tint handles the "you're inside this" indication.
      // Future: immersive mode wraps the feature around you instead.
      if (feature.insideFeature) {
        this.ambientTint = {
          r: feature.color[0],
          g: feature.color[1],
          b: feature.color[2],
          strength: 0.15,
        };
        continue;
      }

      // Direction from player to feature (in galactic coords → sky direction)
      const dx = feature.position.x - playerPos.x;
      const dy = feature.position.y - playerPos.y;
      const dz = feature.position.z - playerPos.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 0.0001) continue;

      const dirX = dx / len;
      const dirY = dy / len;
      const dirZ = dz / len;

      // Position on sky sphere
      const skyPos = new THREE.Vector3(
        dirX * FEATURE_RADIUS,
        dirY * FEATURE_RADIUS,
        dirZ * FEATURE_RADIUS
      );

      // Angular size → billboard size on sky sphere
      // At FEATURE_RADIUS=499.5, 1 radian = 499.5 units
      const skySize = Math.max(
        feature.angularRadius * FEATURE_RADIUS * 2,
        2.0 // minimum size so tiny features are still visible
      );

      // Distance-based brightness AND opacity falloff.
      // Closer nebulae are brighter and more opaque; distant ones fade
      // in both emission and transparency — like stars with apparent magnitude.
      const distFade = Math.min(1.0, 1.0 / (feature.dist * 2));
      const brightness = distFade * this._brightnessRange.max;

      // Store distFade so _createFeatureMesh can scale absorption too
      feature._distFade = distFade;

      const mesh = this._createFeatureMesh(feature, skyPos, skySize, brightness);
      if (mesh) {
        // Absorption meshes disabled — glow shader handles dimming directly.
        // Mesh-based absorption kept in _createAbsorptionMesh() for future use
        // (e.g. dark nebulae that should be visibly opaque clouds).
        // const gasTypes = ['emission-nebula', 'planetary-nebula', 'supernova-remnant',
        //                   'reflection-nebula', 'dark-nebula'];
        // if (gasTypes.includes(feature.type)) {
        //   const absorbMesh = this._createAbsorptionMesh(feature, skyPos, skySize);
        //   if (absorbMesh) {
        //     absorbMesh.renderOrder = 1;
        //     this._group.add(absorbMesh);
        //     this._meshes.push(absorbMesh);
        //   }
        // }

        mesh.renderOrder = 2;  // render AFTER absorption layer
        this._group.add(mesh);
        this._meshes.push(mesh);
      }
    }
  }

  _createFeatureMesh(feature, position, size, brightness) {
    // Assign shape mode for procedural features (no knownProfile).
    // Known objects already have a `shape` field in their profile.
    if (!feature.knownProfile) {
      feature._shapeMode = this._assignProceduralShapeMode(feature);
      // Procedural asymmetry and dark lanes for visual variety
      const asymRoll = this._hashSeed(feature.seed + '-asym');
      feature._asymmetry = asymRoll * 0.9; // 0 to 0.9 (wider range for more distinct shapes)
      const dlRoll = this._hashSeed(feature.seed + '-dlane');
      // Dark lanes: emission nebulae often, others sometimes
      if (feature.type === 'emission-nebula') {
        feature._darkLaneStrength = dlRoll > 0.3 ? dlRoll * 0.6 : 0.0;
      } else if (feature.type === 'supernova-remnant') {
        feature._darkLaneStrength = dlRoll > 0.6 ? dlRoll * 0.3 : 0.0;
      } else {
        feature._darkLaneStrength = 0.0;
      }
    }

    switch (feature.type) {
      // Gas features: rendered as sky billboards (no GalacticMap stars for gas)
      case 'emission-nebula':
      case 'planetary-nebula':
      case 'reflection-nebula':
      case 'supernova-remnant':
        return this._createNebulaBillboard(feature, position, size, brightness);
      case 'dark-nebula':
        return this._createDarkNebulaBillboard(feature, position, size, brightness);
      // Star-region features: usually NOT rendered as billboards — their stars
      // appear naturally in the starfield. EXCEPTION: known objects with
      // nebulosity layers (e.g., Pleiades reflection nebulosity) DO get
      // a faint nebula billboard for the gas component.
      case 'open-cluster':
      case 'ob-association':
      case 'globular-cluster':
        if (feature.knownProfile && feature.knownProfile.layers > 0) {
          return this._createNebulaBillboard(feature, position, size, brightness * 0.6);
        }
        return null;
      default:
        return null;
    }
  }

  /**
   * Assign a shape mode integer to a procedural (non-known) feature
   * based on its type and a seeded roll.
   *   emission-nebula:     70% irregular, 30% filamentary
   *   planetary-nebula:    50% ring, 30% bipolar, 20% shell
   *   supernova-remnant:   40% filamentary, 40% shell, 20% irregular
   *   reflection-nebula:   100% diffuse
   *   dark-nebula:         0 (handled separately)
   */
  /**
   * Beer-Lambert absorption coefficient per feature type.
   * Higher = denser cloud, blocks more galactic glow at the same noise density.
   * Emission nebulae are the thickest gas clouds; reflection nebulae are wispy.
   */
  _absorptionCoeffForType(type) {
    // Lower coefficients = more transparent, more distant-feeling.
    // Nebulae should feel like part of the sky, not painted on top.
    const coefficients = {
      'emission-nebula': 3.0,
      'dark-nebula': 5.0,
      'planetary-nebula': 2.5,
      'reflection-nebula': 1.5,
      'supernova-remnant': 2.0,
    };
    return coefficients[type] ?? 2.0;
  }

  _assignProceduralShapeMode(feature) {
    const roll = this._hashSeed(feature.seed + '-shape');
    switch (feature.type) {
      case 'emission-nebula':
        // Real emission nebulae are wildly varied — from compact blobs
        // to vast shells (Barnard's Loop) to complex filamentary structures.
        // Use all 6 modes with different weights.
        if (roll < 0.30) return SHAPE_MODE['irregular'];    // classic blob (Orion)
        if (roll < 0.50) return SHAPE_MODE['filamentary'];  // threads (NGC 6960)
        if (roll < 0.65) return SHAPE_MODE['ring'];          // shell/ring (Barnard's Loop)
        if (roll < 0.78) return SHAPE_MODE['bipolar'];       // bipolar outflow (Eta Carinae)
        if (roll < 0.90) return SHAPE_MODE['shell'];         // bubble (Bubble Nebula)
        return SHAPE_MODE['diffuse'];                         // faint diffuse glow
      case 'planetary-nebula':
        if (roll < 0.35) return SHAPE_MODE['ring'];
        if (roll < 0.60) return SHAPE_MODE['bipolar'];
        if (roll < 0.80) return SHAPE_MODE['shell'];
        return SHAPE_MODE['irregular'];  // some are messy/asymmetric
      case 'supernova-remnant':
        if (roll < 0.30) return SHAPE_MODE['filamentary'];
        if (roll < 0.55) return SHAPE_MODE['shell'];
        if (roll < 0.75) return SHAPE_MODE['ring'];          // expanding shock ring
        return SHAPE_MODE['irregular'];
      case 'reflection-nebula':
        if (roll < 0.7) return SHAPE_MODE['diffuse'];
        return SHAPE_MODE['irregular'];   // some have structure
      default:
        return SHAPE_MODE['irregular'];
    }
  }

  /**
   * Nebula billboard — unified shader with 6 distinct shape modes.
   * Handles emission, planetary, reflection nebulae AND supernova remnants.
   * Shape mode is selected from the knownProfile.shape string or
   * procedurally assigned via _assignProceduralShapeMode().
   */
  /**
   * Absorption layer — semi-transparent black shape that darkens the glow
   * behind a nebula. Same shape as the emission billboard but uses
   * NormalBlending to BLOCK light instead of adding it.
   * Like how a planet blocks the sky — just semi-transparent.
   */
  _createAbsorptionMesh(feature, position, size) {
    // High absorption — nearly fully block the glow so the nebula's own
    // emission color is what you see instead of glow + nebula stacked.
    const absorptionStrength = {
      'emission-nebula': 0.2,
      'dark-nebula': 0.3,
      'planetary-nebula': 0.15,
      'reflection-nebula': 0.12,
      'supernova-remnant': 0.15,
    }[feature.type] || 0.15;

    const absorbSize = size * 2.0;  // larger so edges fade before billboard boundary
    const geo = new THREE.PlaneGeometry(absorbSize, absorbSize);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,  // KEY: normal blending darkens the glow behind
      side: THREE.DoubleSide,
      uniforms: {
        uSeed: { value: this._hashSeed(feature.seed) },
        uAbsorption: { value: absorptionStrength },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uSeed;
        uniform float uAbsorption;
        varying vec2 vUv;

        // Simple noise for shape
        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i); float b = hash(i + vec2(1,0));
          float c = hash(i + vec2(0,1)); float d = hash(i + vec2(1,1));
          return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0; float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p); p *= 2.0; a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 centered = vUv - 0.5;
          float dist = length(centered);

          // Gaussian-like falloff — concentrated in center, fades well before edge.
          // sigma ~0.14, reaches ~1% by dist=0.3 (billboard edge is 0.5).
          float falloff = exp(-dist * dist / (0.04));
          if (falloff < 0.01) discard;

          // Soft noise — continuous variation, no hard thresholds.
          // Lower frequency + domain warp for wispy, organic shapes.
          vec2 nc = centered * 3.5 + vec2(uSeed * 1.3, uSeed * 0.9);
          vec2 warp1 = vec2(fbm(nc + 3.1), fbm(nc + 4.7));
          float n = fbm(nc + warp1 * 0.5);

          // Continuous density — no step/threshold, just smooth noise variation.
          // Noise provides natural variation (denser/thinner patches).
          float density = n * n * falloff;
          if (density < 0.02) discard;

          // Warm dark dust — matches glow tone so transitions are seamless
          vec3 dustColor = vec3(0.06, 0.045, 0.03);
          gl_FragColor = vec4(dustColor, density * uAbsorption);
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.lookAt(0, 0, 0);
    return mesh;
  }

  _createNebulaBillboard(feature, position, size, brightness) {
    // Use knownProfile colors when available, otherwise type-specific secondary
    const kp = feature.knownProfile;
    let secondaryColor;
    let colorMixStrength;
    if (kp) {
      secondaryColor = kp.colorSecondary;
      colorMixStrength = kp.colorMix;
    } else {
      // Type-specific secondary colors for procedural nebulae
      const colorRoll = this._hashSeed(feature.seed + '-col2');
      switch (feature.type) {
        case 'emission-nebula':
          // Vary between OIII teal, SII red, and NII yellow-orange
          secondaryColor = colorRoll < 0.5 ? [0.2, 0.7, 0.6]    // OIII teal
            : colorRoll < 0.8 ? [0.7, 0.2, 0.15]                 // SII red
            : [0.8, 0.6, 0.2];                                    // NII warm
          break;
        case 'planetary-nebula':
          secondaryColor = colorRoll < 0.6 ? [0.15, 0.6, 0.65]   // OIII teal-green
            : [0.5, 0.3, 0.7];                                    // NII violet
          break;
        case 'supernova-remnant':
          secondaryColor = colorRoll < 0.5 ? [0.3, 0.4, 0.8]     // synchrotron blue
            : [0.6, 0.7, 0.3];                                    // shock-heated green
          break;
        case 'reflection-nebula':
          secondaryColor = [0.4, 0.5, 0.9];                       // scattered starlight blue
          break;
        default:
          secondaryColor = [0.2, 0.7, 0.6];
      }
      colorMixStrength = 0.3 + colorRoll * 0.3; // 0.3 to 0.6
    }

    // Shape-specific parameters from profile (defaults preserve original behavior)
    const warpRoll = this._hashSeed(feature.seed + '-warp');
    const domainWarpStrength = kp ? (kp.domainWarpStrength ?? 0.8) : (0.2 + warpRoll * 1.3); // 0.2 to 1.5 (wider range)
    const asymmetry = kp ? (kp.asymmetry ?? 0.3) : (feature._asymmetry ?? 0.3);
    const darkLaneStrength = (kp && kp.darkLanes) ? (kp.darkLaneStrength ?? 0.3) : (feature._darkLaneStrength ?? 0.0);

    // Resolve shape mode: known profile shape string → integer, or procedural assignment
    let shapeMode;
    if (kp && kp.shape != null) {
      shapeMode = SHAPE_MODE[kp.shape] ?? SHAPE_MODE['irregular'];
    } else if (feature._shapeMode != null) {
      shapeMode = feature._shapeMode;
    } else {
      shapeMode = SHAPE_MODE['irregular'];
    }

    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      // Premultiplied alpha: nebula emits its own color (rgb) AND blocks
      // the galactic glow behind it (alpha). Like storm clouds blocking the sun.
      // Beer-Lambert transmittance gives physically correct opacity curves.
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,              // use rgb as-is (premultiplied)
      blendDst: THREE.OneMinusSrcAlphaFactor,  // background * (1 - alpha)
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Vector3(feature.color[0], feature.color[1], feature.color[2]) },
        uColorSecondary: { value: new THREE.Vector3(secondaryColor[0], secondaryColor[1], secondaryColor[2]) },
        uColorMixStrength: { value: colorMixStrength },
        uBrightness: { value: brightness },
        uSeed: { value: this._hashSeed(feature.seed) },
        uDomainWarpStrength: { value: domainWarpStrength },
        uAsymmetry: { value: asymmetry },
        uDarkLaneStrength: { value: darkLaneStrength },
        uShapeMode: { value: shapeMode },
        // Beer-Lambert absorption coefficient — higher = more opaque at same density.
        // Tuned per feature type so emission nebulae block glow convincingly
        // while reflection nebulae stay wispy.
        // Absorption scales with distance — distant nebulae are more transparent.
        // Without this, far nebulae create dark patches without enough emission
        // to justify them (dim but still opaque = dark blotch).
        uAbsorptionCoeff: { value: this._absorptionCoeffForType(feature.type) * (feature._distFade ?? 1.0) },
        uPixelScale: { value: 3.0 }, // match RetroRenderer.pixelScale
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uColorSecondary;
        uniform float uColorMixStrength;
        uniform float uBrightness;
        uniform float uSeed;
        uniform float uDomainWarpStrength;
        uniform float uAsymmetry;
        uniform float uDarkLaneStrength;
        uniform int uShapeMode;
        uniform float uAbsorptionCoeff;
        uniform float uPixelScale;
        varying vec2 vUv;

        // Simple hash-based noise
        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i); float b = hash(i + vec2(1,0));
          float c = hash(i + vec2(0,1)); float d = hash(i + vec2(1,1));
          return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.1; a *= 0.5;
          }
          return v;
        }

        // 4x4 Bayer dithering
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
          vec2 centered = vUv - 0.5;
          float dist = length(centered);
          float angle = atan(centered.y, centered.x);

          // ── Compute density per shape mode ──
          float density = 0.0;
          float n = 0.0;  // noise value (also used for color mixing)

          if (uShapeMode == 0) {
            // ── IRREGULAR: FBM + domain warp + dark lanes ──
            // Classic emission nebula look (Orion, Eagle, Lagoon)
            // Seed-derived variety: noise scale, falloff shape, warp offsets,
            // and clumping so each nebula has distinct character, not just rotation.

            // Derive variety parameters from seed (deterministic per nebula)
            float s1 = fract(uSeed * 7.31);   // 0-1: noise scale factor
            float s2 = fract(uSeed * 13.17);  // 0-1: falloff inner radius
            float s3 = fract(uSeed * 19.53);  // 0-1: warp offset variation
            float s4 = fract(uSeed * 29.71);  // 0-1: clump count / style

            // Noise frequency: 3.0 (coarse blobs) to 6.0 (fine detail)
            float noiseScale = 3.0 + s1 * 3.0;

            // Falloff shape: some nebulae are compact (tight center), others diffuse
            float falloffInner = 0.12 + s2 * 0.15;  // 0.12 to 0.27
            float falloffOuter = falloffInner + 0.2 + s2 * 0.15; // spread varies too

            float stretchAngle = uSeed * 6.28;
            float cs0 = cos(stretchAngle), sn0 = sin(stretchAngle);
            vec2 asym = vec2(
              centered.x * cs0 - centered.y * sn0,
              (centered.x * sn0 + centered.y * cs0) * (1.0 + uAsymmetry * 0.8)
            );
            float asymDist = length(asym);
            float falloff = 1.0 - smoothstep(falloffInner, falloffOuter, asymDist);

            // Clumping: low-frequency noise creates 2-3 density peaks instead of
            // one smooth blob. Some nebulae are single-core, others multi-lobed.
            float clumpNoise = fbm(centered * 2.0 + vec2(uSeed * 5.3, uSeed * 3.1));
            float clumpStrength = s4 * 0.5; // 0 to 0.5 — how much clumping matters
            falloff *= (1.0 - clumpStrength) + clumpStrength * smoothstep(0.25, 0.55, clumpNoise);

            if (falloff < 0.01) discard;

            // Warp offsets vary per nebula so the distortion pattern differs
            float warpOff1 = 1.3 + s3 * 4.0;
            float warpOff2 = 2.7 + s3 * 3.0;
            vec2 nc = centered * noiseScale + vec2(uSeed, uSeed * 0.7);
            n = fbm(nc);
            vec2 warp = vec2(fbm(nc + warpOff1), fbm(nc + warpOff2));
            n = fbm(nc + warp * uDomainWarpStrength);

            // Dark lanes: subtract noise-based dark channels (dust absorption)
            if (uDarkLaneStrength > 0.0) {
              float lane = fbm(nc * 1.5 + vec2(uSeed * 3.1, uSeed * 1.7));
              lane = smoothstep(0.4, 0.7, lane);
              n *= 1.0 - lane * uDarkLaneStrength;
            }

            // Cloud density: square the noise then rescale to create stronger
            // gradients. Plain noise (0-1 uniform) gives flat dithering;
            // squared noise concentrates values near 0 with peaks near 1,
            // creating the layered/billowing look when dithered.
            // Multiply by 2.5 to compensate (FBM averages ~0.5, squared = ~0.25).
            float cloud = n * n * 2.5;
            density = cloud * falloff;

          } else if (uShapeMode == 1) {
            // ── RING: distorted, lumpy, partially broken rim ──
            // Planetary nebulae (Ring M57, Helix, Southern Ring)
            // Real rings are never perfect circles — lumpy, thick/thin,
            // brighter in some arcs, fading in others.
            float ringAngle = uSeed * 6.28;
            float cs1 = cos(ringAngle), sn1 = sin(ringAngle);
            vec2 ringCoord = vec2(
              centered.x * cs1 - centered.y * sn1,
              (centered.x * sn1 + centered.y * cs1) * (1.0 + uAsymmetry * 0.6)
            );

            // Seed-derived variety
            float sr1 = fract(uSeed * 9.37);   // radius variation
            float sr2 = fract(uSeed * 14.71);  // gap character
            float sr3 = fract(uSeed * 21.53);  // noise scale

            // Polar coordinates for angular distortion
            float ringDist = length(ringCoord);
            float angle = atan(ringCoord.y, ringCoord.x);

            // Distort the ring radius — noise-based lumps make it irregular
            vec2 nc = centered * (4.0 + sr3 * 3.0) + vec2(uSeed, uSeed * 0.7);
            n = fbm(nc);
            vec2 warp = vec2(fbm(nc + 1.3 + sr1 * 3.0), fbm(nc + 2.7 + sr1 * 2.0));
            n = fbm(nc + warp * uDomainWarpStrength * 0.7);

            // Base radius varies per-nebula + angular noise distortion
            float baseRadius = 0.18 + sr1 * 0.12;  // 0.18 to 0.30
            float angularNoise = fbm(vec2(angle * 2.0 + uSeed * 5.0, uSeed * 3.0));
            float lumpyRadius = baseRadius + (angularNoise - 0.5) * 0.08;

            // Ring width varies along the circumference
            float baseWidth = 0.05 + sr2 * 0.06;   // 0.05 to 0.11
            float widthVar = 0.6 + 0.4 * fbm(vec2(angle * 3.0 + uSeed, uSeed * 2.1));
            float ringWidth = baseWidth * widthVar;

            // Gaussian ring with distorted radius and varying width
            float ring = exp(-pow(ringDist - lumpyRadius, 2.0) / (2.0 * ringWidth * ringWidth));

            // Gaps: angular noise creates partial breaks in the ring
            float gapNoise = fbm(vec2(angle * 1.5 + uSeed * 7.0, uSeed));
            float gapStrength = sr2 * 0.6; // 0 to 0.6
            ring *= (1.0 - gapStrength) + gapStrength * smoothstep(0.25, 0.5, gapNoise);

            // Dim the interior
            float centerDim = smoothstep(0.0, lumpyRadius * 0.5, ringDist);
            ring *= centerDim;

            // Outer falloff
            ring *= 1.0 - smoothstep(lumpyRadius + ringWidth * 3.0, lumpyRadius + ringWidth * 5.0, ringDist);

            // Cloud density within the ring — squared noise for billowing gradients
            float cloud = n * n * 2.5;
            density = ring * (0.3 + 0.7 * cloud);

          } else if (uShapeMode == 2) {
            // ── BIPOLAR: two lobes / hourglass / butterfly ──
            // Planetary nebulae (Dumbbell M27, some PNe with jets)
            float sb1 = fract(uSeed * 8.91);  // lobe shape variation
            float sb2 = fract(uSeed * 15.37); // warp character

            float lobeAngle = uSeed * 6.28;
            float cosA = cos(lobeAngle);
            float sinA = sin(lobeAngle);
            vec2 rotated = vec2(
              centered.x * cosA - centered.y * sinA,
              centered.x * sinA + centered.y * cosA
            );
            // Lobe dimensions vary per nebula
            float lobeX = rotated.x * (1.5 + uAsymmetry * 0.8 + sb1 * 0.5);
            float lobeY = rotated.y * (0.7 + sb1 * 0.4);
            float lobeDist = length(vec2(lobeX, lobeY));
            float waistShift = rotated.y * uAsymmetry * 0.2;
            float lobeBias = abs(rotated.y + waistShift) * (1.5 + sb1);
            float falloff = (1.0 - smoothstep(0.15, 0.42, lobeDist)) * smoothstep(0.0, 0.06 + sb1 * 0.04, lobeBias);
            float hub = exp(-dist * dist / 0.006) * 0.25;
            falloff = max(falloff, hub);
            if (falloff < 0.01) discard;

            // Cloud density — domain-warped FBM with squared gradients
            float noiseScale = 4.0 + sb2 * 3.0;
            vec2 nc = centered * noiseScale + vec2(uSeed, uSeed * 0.7);
            n = fbm(nc);
            float warpOff1 = 1.3 + sb2 * 4.0;
            float warpOff2 = 2.7 + sb2 * 3.0;
            vec2 warp = vec2(fbm(nc + warpOff1), fbm(nc + warpOff2));
            n = fbm(nc + warp * uDomainWarpStrength * 0.7);
            float cloud = n * n * 2.5;
            density = cloud * falloff;

          } else if (uShapeMode == 3) {
            // ── FILAMENTARY: tangled threads with billowing cloud density ──
            // Same "cloud rendering" technique as ring/bipolar nebulae:
            // strong internal density gradients that dithering turns into
            // visible bands/layers (topographic contour look = depth illusion).
            // Filament SHAPE masks WHERE the cloud appears; cloud DENSITY
            // controls HOW it looks within those shapes.
            float sf1 = fract(uSeed * 11.37);  // thread scale
            float sf2 = fract(uSeed * 17.89);  // knot frequency
            float sf3 = fract(uSeed * 23.41);  // warp character

            float stretchFactor = 1.5 + uAsymmetry * 1.5;
            float stretchAngle = uSeed * 6.28;
            float cosS = cos(stretchAngle);
            float sinS = sin(stretchAngle);
            vec2 stretched = vec2(
              centered.x * cosS - centered.y * sinS,
              (centered.x * sinS + centered.y * cosS) * stretchFactor
            );

            // ── Step 1: Filament mask — where the threads are ──
            float coarseScale = 4.0 + sf1 * 2.0;
            vec2 nc = stretched * coarseScale + vec2(uSeed, uSeed * 0.7);
            float warpOff1 = 1.3 + sf3 * 5.0;
            float warpOff2 = 2.7 + sf3 * 3.5;
            vec2 warp1 = vec2(fbm(nc + warpOff1), fbm(nc + warpOff2));
            vec2 warp2 = vec2(fbm(nc + warp1 * 0.8 + 3.1), fbm(nc + warp1 * 0.8 + 4.5));
            float coarseN = fbm(nc + warp2 * uDomainWarpStrength);

            // Wider, bolder filaments — lower threshold = thicker threads
            float threshLow = 0.1 + dist * 0.8;
            float threshHigh = threshLow + 0.25;
            float filamentMask = smoothstep(threshLow, threshHigh, coarseN);

            // Falloff from center so filaments fade at edges
            float radialFade = 1.0 - smoothstep(0.25, 0.48, dist);
            filamentMask *= radialFade;

            // ── Step 2: Cloud density within filaments ──
            // Same domain-warped FBM + squared gradient as irregular mode.
            // This is what gives the "billowing cloud" look — the squared
            // noise creates strong density gradients that the Bayer dithering
            // turns into visible layered bands (topographic depth illusion).
            float cloudScale = 5.0 + sf2 * 3.0;
            vec2 cloudNc = centered * cloudScale + vec2(uSeed * 3.1, uSeed * 2.3);
            float cloudWarpOff1 = 1.7 + sf3 * 3.0;
            float cloudWarpOff2 = 3.9 + sf3 * 2.0;
            vec2 cloudWarp = vec2(fbm(cloudNc + cloudWarpOff1), fbm(cloudNc + cloudWarpOff2));
            float cloudN = fbm(cloudNc + cloudWarp * uDomainWarpStrength * 0.6);

            // Squared noise for billowing gradients (same technique as mode 0)
            float cloud = cloudN * cloudN * 2.5;

            // Bright knots at intersections
            float knotFreq = 3.0 + sf2 * 4.0;
            float knotN = fbm(stretched * knotFreq + vec2(uSeed * 4.7, uSeed * 2.9));
            float knots = smoothstep(0.5, 0.7, knotN) * filamentMask;
            cloud += knots * 0.3;

            n = cloudN; // for color mixing
            density = filamentMask * cloud * 0.9;

          } else if (uShapeMode == 4) {
            // ── SHELL: distorted, broken rim with cloud density ──
            // Supernova remnant shells, bubble nebulae
            // Same distortion approach as ring mode — lumpy, varying width, gaps.
            float ss1 = fract(uSeed * 12.47);  // radius variation
            float ss2 = fract(uSeed * 18.93);  // gap/break character
            float ss3 = fract(uSeed * 25.11);  // noise scale

            float shellAngle = uSeed * 6.28;
            float cs4 = cos(shellAngle), sn4 = sin(shellAngle);
            vec2 shellCoord = vec2(
              centered.x * cs4 - centered.y * sn4,
              (centered.x * sn4 + centered.y * cs4) * (1.0 + uAsymmetry * 0.7)
            );
            float shellDist = length(shellCoord);
            float shellAng = atan(shellCoord.y, shellCoord.x);

            // Distort the shell radius with angular noise
            vec2 nc = centered * (4.0 + ss3 * 3.0) + vec2(uSeed * 1.3, uSeed * 0.9);
            n = fbm(nc);
            vec2 warp = vec2(fbm(nc + 1.5 + ss1 * 3.0), fbm(nc + 3.1 + ss1 * 2.0));
            n = fbm(nc + warp * uDomainWarpStrength * 0.6);

            float baseRadius = 0.22 + ss1 * 0.12;
            float angularLump = fbm(vec2(shellAng * 2.5 + uSeed * 6.0, uSeed * 4.0));
            float lumpyRadius = baseRadius + (angularLump - 0.5) * 0.1;

            // Varying thickness
            float baseThickness = 0.04 + ss2 * 0.05;
            float thicknessVar = 0.5 + 0.5 * fbm(vec2(shellAng * 2.0 + uSeed * 3.0, uSeed));
            float shellThickness = baseThickness * thicknessVar;

            float shell = exp(-pow(shellDist - lumpyRadius, 2.0) / (2.0 * shellThickness * shellThickness));

            // Gaps/breaks in the shell
            float gapNoise = fbm(vec2(shellAng * 1.8 + uSeed * 8.0, uSeed * 2.0));
            float gapStrength = ss2 * 0.7;
            shell *= (1.0 - gapStrength) + gapStrength * smoothstep(0.2, 0.5, gapNoise);

            // Outer falloff
            shell *= 1.0 - smoothstep(lumpyRadius + shellThickness * 3.0, lumpyRadius + shellThickness * 6.0, shellDist);

            // Cloud density for billowing look
            float cloud = n * n * 2.5;
            density = shell * (0.3 + 0.7 * cloud);

          } else {
            // ── DIFFUSE (mode 5): soft Gaussian blob ──
            // Reflection nebulae (M78, Pleiades gas)
            float gaussian = exp(-dist * dist / 0.06);
            gaussian *= 1.0 - smoothstep(0.35, 0.5, dist);
            vec2 nc = centered * 3.0 + vec2(uSeed, uSeed * 0.7);
            n = fbm(nc);
            // Very gentle warp — soft, not structured
            vec2 warp = vec2(fbm(nc + 1.3), fbm(nc + 2.7));
            n = fbm(nc + warp * uDomainWarpStrength * 0.3);
            density = gaussian * (0.6 + 0.4 * n);
          }

          // Dither at the retro pixel resolution — snap gl_FragCoord to the
          // low-res grid so nebulae look the same chunky resolution as
          // near-field scene objects (planets, moons, etc.)
          vec2 retroCoord = floor(gl_FragCoord.xy / uPixelScale);
          float threshold = bayerDither(retroCoord);
          if (density < threshold) discard;

          // Color: blend between primary and secondary using profile-driven mix
          float colorMix = smoothstep(0.3, 0.7, n);
          vec3 col = mix(uColor, uColorSecondary, colorMix * uColorMixStrength);

          // ── Beer-Lambert absorption ──
          // Dense regions block more of the galactic glow behind them.
          // transmittance = how much background light passes through.
          float beer = exp(-density * uAbsorptionCoeff);
          float transmittance = beer;
          float opacity = 1.0 - transmittance;

          // ── Powder function (Guerrilla Games) ──
          // Corrects Beer-Lambert at thin edges: gives backlit nebula edges
          // a bright rim, like the silver lining on storm clouds.
          float powder = 1.0 - exp(-density * uAbsorptionCoeff * 2.0);
          float backlitGlow = beer * powder;

          // Nebula's own emission + backlit rim glow.
          // Reduced from 1.8× to 1.2× — nebulae were too bright/close-feeling.
          // They should be subtle, distant features, not bright foreground objects.
          float emissionBright = smoothstep(0.0, 0.6, density);
          vec3 emission = col * uBrightness * emissionBright * 1.2;
          vec3 rimGlow = col * backlitGlow * uBrightness * 0.3;

          // Premultiplied alpha output:
          // rgb = emission already multiplied by opacity (premultiplied)
          // alpha = how much background to block
          vec3 premultRgb = (emission + rimGlow) * opacity;
          gl_FragColor = vec4(premultRgb, opacity);
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    // Billboard: face the origin (camera is always at sky sphere center)
    mesh.lookAt(0, 0, 0);
    return mesh;
  }

  /**
   * Dark nebula — absorption patch that dims things behind it.
   * Uses subtractive blending effect via a semi-opaque dark billboard.
   */
  _createDarkNebulaBillboard(feature, position, size, brightness) {
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      // Normal blending with alpha — will darken what's behind it
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uSeed: { value: this._hashSeed(feature.seed) },
        uOpacity: { value: Math.min(0.7, brightness * 3) }, // how much it absorbs
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uSeed;
        uniform float uOpacity;
        varying vec2 vUv;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i); float b = hash(i + vec2(1,0));
          float c = hash(i + vec2(0,1)); float d = hash(i + vec2(1,1));
          return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.1; a *= 0.5;
          }
          return v;
        }

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
          vec2 centered = vUv - 0.5;
          float dist = length(centered);
          float falloff = 1.0 - smoothstep(0.15, 0.45, dist);
          if (falloff < 0.01) discard;

          vec2 noiseCoord = centered * 3.0 + vec2(uSeed, uSeed * 0.7);
          float n = fbm(noiseCoord);
          float density = n * falloff;

          float threshold = bayerDither(gl_FragCoord.xy);
          if (density < threshold) discard;

          // Output dark pixels with alpha — absorbs light behind
          float alpha = density * uOpacity;
          gl_FragColor = vec4(0.02, 0.015, 0.01, alpha);
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.lookAt(0, 0, 0);
    return mesh;
  }

  /**
   * Open cluster / OB association — bright star points.
   */
  _createClusterPoints(feature, position, size, brightness) {
    const isOB = feature.type === 'ob-association';
    const count = isOB ? 15 : 30;
    const spread = size * 0.3;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const seedHash = this._hashSeed(feature.seed);
    for (let i = 0; i < count; i++) {
      // Seeded pseudo-random scatter
      const fx = this._seededRand(seedHash + i * 3.1) - 0.5;
      const fy = this._seededRand(seedHash + i * 7.3) - 0.5;
      const fz = this._seededRand(seedHash + i * 11.7) - 0.5;
      positions[i * 3] = position.x + fx * spread;
      positions[i * 3 + 1] = position.y + fy * spread;
      positions[i * 3 + 2] = position.z + fz * spread;

      // Blue-white color with slight variation
      const warm = this._seededRand(seedHash + i * 13.1);
      colors[i * 3] = feature.color[0] + warm * 0.2;
      colors[i * 3 + 1] = feature.color[1] + warm * 0.1;
      colors[i * 3 + 2] = feature.color[2];

      sizes[i] = (this._seededRand(seedHash + i * 17.9) < 0.1 ? 8 : 5) * brightness * 3;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uBrightness: { value: brightness },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        varying vec3 vColor;
        void main() {
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(2.0, aSize);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uBrightness;
        varying vec3 vColor;
        void main() {
          float dist = length(gl_PointCoord - 0.5);
          if (dist > 0.5) discard;
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          gl_FragColor = vec4(vColor * uBrightness * glow, 1.0);
        }
      `,
    });

    return new THREE.Points(geo, mat);
  }

  /**
   * Globular cluster — dense ball of warm star points.
   * No gas, no diffuse glow — these are resolved stars even from a distance.
   * Radial concentration toward center (King profile approximation).
   */
  _createGlobularPoints(feature, position, size, brightness) {
    const count = 120; // dense enough to read as a cluster
    const spread = size * 0.25; // tighter than open clusters

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const seedHash = this._hashSeed(feature.seed);
    for (let i = 0; i < count; i++) {
      // King profile: concentrate stars toward center
      // Use cube of random for strong central concentration
      const r = Math.pow(this._seededRand(seedHash + i * 2.3), 2.0) * spread;
      const theta = this._seededRand(seedHash + i * 5.7) * Math.PI * 2;
      const phi = Math.acos(this._seededRand(seedHash + i * 9.1) * 2 - 1);

      const fx = Math.sin(phi) * Math.cos(theta) * r;
      const fy = Math.cos(phi) * r;
      const fz = Math.sin(phi) * Math.sin(theta) * r;

      positions[i * 3] = position.x + fx;
      positions[i * 3 + 1] = position.y + fy;
      positions[i * 3 + 2] = position.z + fz;

      // Warm yellow-orange with variation (old stellar population)
      const warm = this._seededRand(seedHash + i * 13.1);
      const bright = (0.5 + 0.5 * (1 - r / spread)) * brightness * 3; // brighter near center
      colors[i * 3] = Math.min(1, feature.color[0] * bright + warm * 0.15);
      colors[i * 3 + 1] = Math.min(1, feature.color[1] * bright + warm * 0.1);
      colors[i * 3 + 2] = Math.min(1, feature.color[2] * bright * 0.7); // less blue

      // Central stars slightly larger
      sizes[i] = r < spread * 0.3 ? 6 : r < spread * 0.6 ? 4 : 3;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uBrightness: { value: brightness },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        varying vec3 vColor;
        void main() {
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(2.0, aSize);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uBrightness;
        varying vec3 vColor;
        void main() {
          float dist = length(gl_PointCoord - 0.5);
          if (dist > 0.5) discard;
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          gl_FragColor = vec4(vColor * uBrightness * glow, 1.0);
        }
      `,
    });

    return new THREE.Points(geo, mat);
  }

  /**
   * Globular cluster — compact warm glow billboard (LEGACY, kept for reference).
   */
  _createGlobularBillboard(feature, position, size, brightness) {
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Vector3(feature.color[0], feature.color[1], feature.color[2]) },
        uBrightness: { value: brightness },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uBrightness;
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
          vec2 centered = vUv - 0.5;
          float dist = length(centered);

          // Compact radial falloff (King profile approximation)
          float core = exp(-dist * dist / 0.01);  // bright core
          float halo = exp(-dist * dist / 0.06);   // diffuse halo
          float density = core * 0.6 + halo * 0.4;

          float falloff = 1.0 - smoothstep(0.35, 0.5, dist);
          density *= falloff;

          float threshold = bayerDither(gl_FragCoord.xy);
          if (density < threshold * 0.6) discard;

          gl_FragColor = vec4(uColor * uBrightness * density, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.lookAt(0, 0, 0);
    return mesh;
  }

  /**
   * Supernova remnant — ring-shaped billboard with green emission.
   */
  _createRemnantBillboard(feature, position, size, brightness) {
    // Use knownProfile colors when available, otherwise single-color rendering
    const kp = feature.knownProfile;
    const secondaryColor = kp
      ? kp.colorSecondary
      : feature.color; // fall back to primary (no blend for generic remnants)
    const colorMixStrength = kp
      ? kp.colorMix
      : 0.0;

    // Shape hints from profile: filamentary remnants (M1) get higher warp,
    // ring-shaped remnants get standard structure
    const domainWarpStrength = kp ? (kp.domainWarpStrength ?? 0.5) : 0.5;
    const isFilamentary = kp ? (kp.shape === 'filamentary') : false;

    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Vector3(feature.color[0], feature.color[1], feature.color[2]) },
        uColorSecondary: { value: new THREE.Vector3(secondaryColor[0], secondaryColor[1], secondaryColor[2]) },
        uColorMixStrength: { value: colorMixStrength },
        uBrightness: { value: brightness },
        uSeed: { value: this._hashSeed(feature.seed) },
        uDomainWarpStrength: { value: domainWarpStrength },
        uFilamentary: { value: isFilamentary ? 1 : 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uColorSecondary;
        uniform float uColorMixStrength;
        uniform float uBrightness;
        uniform float uSeed;
        uniform float uDomainWarpStrength;
        uniform int uFilamentary;
        varying vec2 vUv;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i); float b = hash(i + vec2(1,0));
          float c = hash(i + vec2(0,1)); float d = hash(i + vec2(1,1));
          return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.1; a *= 0.5;
          }
          return v;
        }

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
          vec2 centered = vUv - 0.5;
          float dist = length(centered);

          float density;
          if (uFilamentary == 1) {
            // Filamentary remnant (like M1 Crab): stringy structure, no ring
            // Use domain-warped FBM for tangled filament look
            vec2 noiseCoord = centered * 6.0 + vec2(uSeed, uSeed * 0.7);
            vec2 warp = vec2(fbm(noiseCoord + 1.3), fbm(noiseCoord + 2.7));
            float n = fbm(noiseCoord + warp * uDomainWarpStrength);
            // Radial falloff — center-bright blob, not a ring
            float falloff = 1.0 - smoothstep(0.2, 0.45, dist);
            density = n * falloff;
          } else {
            // Ring-shaped remnant (default): ring + angular noise
            float ringRadius = 0.3;
            float ringWidth = 0.08;
            float ring = exp(-pow(dist - ringRadius, 2.0) / (2.0 * ringWidth * ringWidth));
            // Noise for filamentary structure along the ring
            float angle = atan(centered.y, centered.x);
            float n = noise(vec2(angle * 3.0 + uSeed, dist * 8.0));
            ring *= 0.5 + 0.5 * n;
            density = ring;
          }

          float threshold = bayerDither(gl_FragCoord.xy);
          if (density < threshold * 0.5) discard;

          // Blend primary and secondary colors based on noise variation
          float colorN = noise(centered * 5.0 + vec2(uSeed * 1.3, uSeed * 0.9));
          vec3 col = mix(uColor, uColorSecondary, colorN * uColorMixStrength);

          gl_FragColor = vec4(col * uBrightness * density, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.lookAt(0, 0, 0);
    return mesh;
  }

  // ── Utility ──

  _hashSeed(seedStr) {
    let h = 0;
    for (let i = 0; i < seedStr.length; i++) {
      h = ((h << 5) - h + seedStr.charCodeAt(i)) | 0;
    }
    return (h >>> 0) / 4294967295;
  }

  _seededRand(n) {
    return (Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1;
  }

  update(cameraPosition) {
    // Billboard facing: sky features are on the sky sphere, which
    // follows the camera. Each billboard was set to lookAt(0,0,0)
    // at creation time (relative to sky sphere center = camera pos).
    // Moving the group with the camera keeps them positioned correctly.
    this._group.position.copy(cameraPosition);
  }

  _clear() {
    for (const m of this._meshes) {
      this._group.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    this._meshes = [];
  }

  dispose() {
    this._clear();
  }
}
