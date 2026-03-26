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

      // Distance-based brightness falloff
      const distFade = Math.min(1.0, 1.0 / (feature.dist * 2));
      const brightness = distFade * this._brightnessRange.max;

      const mesh = this._createFeatureMesh(feature, skyPos, skySize, brightness);
      if (mesh) {
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
      feature._asymmetry = asymRoll * 0.6; // 0 to 0.6
      const dlRoll = this._hashSeed(feature.seed + '-dlane');
      // Emission nebulae often have dark lanes (dust); others less so
      feature._darkLaneStrength = (feature.type === 'emission-nebula' && dlRoll > 0.5)
        ? dlRoll * 0.5 : 0.0;
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
  _assignProceduralShapeMode(feature) {
    const roll = this._hashSeed(feature.seed + '-shape');
    switch (feature.type) {
      case 'emission-nebula':
        return roll < 0.7 ? SHAPE_MODE['irregular'] : SHAPE_MODE['filamentary'];
      case 'planetary-nebula':
        if (roll < 0.5) return SHAPE_MODE['ring'];
        if (roll < 0.8) return SHAPE_MODE['bipolar'];
        return SHAPE_MODE['shell'];
      case 'supernova-remnant':
        if (roll < 0.4) return SHAPE_MODE['filamentary'];
        if (roll < 0.8) return SHAPE_MODE['shell'];
        return SHAPE_MODE['irregular'];
      case 'reflection-nebula':
        return SHAPE_MODE['diffuse'];
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
    const domainWarpStrength = kp ? (kp.domainWarpStrength ?? 0.8) : (0.4 + warpRoll * 0.8); // 0.4 to 1.2
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

    // ── Absorption mesh: darkens galaxy glow behind the nebula ──
    // Uses custom blending: dst = dst * (1 - srcAlpha), src contributes nothing.
    // Same density computation as emission, but outputs black with absorption alpha.
    // This creates the visual effect of gas/dust blocking light behind it.
    const absGeo = new THREE.PlaneGeometry(size, size);
    const absorbStrength = this._getAbsorptionStrength(feature);
    const absMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquation: THREE.AddEquation,
      side: THREE.DoubleSide,
      uniforms: {
        uSeed: { value: this._hashSeed(feature.seed) },
        uDomainWarpStrength: { value: domainWarpStrength },
        uAsymmetry: { value: asymmetry },
        uDarkLaneStrength: { value: darkLaneStrength },
        uShapeMode: { value: shapeMode },
        uAbsorbStrength: { value: absorbStrength },
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
        uniform float uDomainWarpStrength;
        uniform float uAsymmetry;
        uniform float uDarkLaneStrength;
        uniform int uShapeMode;
        uniform float uAbsorbStrength;
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
          float density = 0.0;

          // Compute density using the same shape modes as emission pass
          if (uShapeMode == 0) {
            float stretchAngle = uSeed * 6.28;
            float cs0 = cos(stretchAngle), sn0 = sin(stretchAngle);
            vec2 asym = vec2(
              centered.x * cs0 - centered.y * sn0,
              (centered.x * sn0 + centered.y * cs0) * (1.0 + uAsymmetry * 0.8)
            );
            float asymDist = length(asym);
            float falloff = 1.0 - smoothstep(0.2, 0.5, asymDist);
            if (falloff < 0.01) discard;
            vec2 nc = centered * 4.0 + vec2(uSeed, uSeed * 0.7);
            float n = fbm(nc);
            vec2 warp = vec2(fbm(nc + 1.3), fbm(nc + 2.7));
            n = fbm(nc + warp * uDomainWarpStrength);
            density = n * falloff;
          } else if (uShapeMode == 1) {
            float ringAngle = uSeed * 6.28;
            float cs1 = cos(ringAngle), sn1 = sin(ringAngle);
            vec2 ringCoord = vec2(
              centered.x * cs1 - centered.y * sn1,
              (centered.x * sn1 + centered.y * cs1) * (1.0 + uAsymmetry * 0.6)
            );
            float ringDist = length(ringCoord);
            float ring = exp(-pow(ringDist - 0.25, 2.0) / (2.0 * 0.07 * 0.07));
            ring *= smoothstep(0.0, 0.15, ringDist);
            ring *= 1.0 - smoothstep(0.38, 0.5, ringDist);
            vec2 nc = centered * 5.0 + vec2(uSeed, uSeed * 0.7);
            float n = fbm(nc);
            vec2 warp = vec2(fbm(nc + 1.3), fbm(nc + 2.7));
            n = fbm(nc + warp * uDomainWarpStrength * 0.5);
            density = ring * (0.5 + 0.5 * n);
          } else if (uShapeMode == 2) {
            float lobeAngle = uSeed * 6.28;
            float cosA = cos(lobeAngle), sinA = sin(lobeAngle);
            vec2 rotated = vec2(
              centered.x * cosA - centered.y * sinA,
              centered.x * sinA + centered.y * cosA
            );
            float lobeX = rotated.x * (1.8 + uAsymmetry * 0.5);
            float lobeY = rotated.y * 0.9;
            float lobeDist = length(vec2(lobeX, lobeY));
            float waistShift = rotated.y * uAsymmetry * 0.15;
            float lobeBias = abs(rotated.y + waistShift) * 2.0;
            float falloff = (1.0 - smoothstep(0.2, 0.45, lobeDist)) * smoothstep(0.0, 0.08, lobeBias);
            float hub = exp(-dist * dist / 0.008) * 0.3;
            falloff = max(falloff, hub);
            if (falloff < 0.01) discard;
            vec2 nc = centered * 5.0 + vec2(uSeed, uSeed * 0.7);
            float n = fbm(nc);
            vec2 warp = vec2(fbm(nc + 1.3), fbm(nc + 2.7));
            n = fbm(nc + warp * uDomainWarpStrength * 0.6);
            density = n * falloff;
          } else if (uShapeMode == 3) {
            float stretchFactor = 2.0 + uAsymmetry * 2.0;
            float stretchAngle = uSeed * 6.28;
            float cosS = cos(stretchAngle), sinS = sin(stretchAngle);
            vec2 stretched = vec2(
              centered.x * cosS - centered.y * sinS,
              (centered.x * sinS + centered.y * cosS) * stretchFactor
            );
            vec2 nc = stretched * 6.0 + vec2(uSeed, uSeed * 0.7);
            vec2 warp1 = vec2(fbm(nc + 1.3), fbm(nc + 2.7));
            vec2 warp2 = vec2(fbm(nc + warp1 * 0.8 + 3.1), fbm(nc + warp1 * 0.8 + 4.5));
            float n = fbm(nc + warp2 * uDomainWarpStrength);
            float threshLow = 0.2 + dist * 1.2;
            float threshHigh = threshLow + 0.15;
            density = smoothstep(threshLow, threshHigh, n) * 0.55;
          } else if (uShapeMode == 4) {
            float shellAngle = uSeed * 6.28;
            float cs4 = cos(shellAngle), sn4 = sin(shellAngle);
            vec2 shellCoord = vec2(
              centered.x * cs4 - centered.y * sn4,
              (centered.x * sn4 + centered.y * cs4) * (1.0 + uAsymmetry * 0.5)
            );
            float shellDist = length(shellCoord);
            float shell = exp(-pow(shellDist - 0.3, 2.0) / (2.0 * 0.04 * 0.04));
            shell *= 1.0 - smoothstep(0.42, 0.5, shellDist);
            float shellAng = atan(shellCoord.y, shellCoord.x);
            float angularN = noise(vec2(shellAng * 4.0 + uSeed, shellDist * 10.0));
            shell *= 0.5 + 0.5 * angularN;
            density = shell;
          } else {
            float gaussian = exp(-dist * dist / 0.06);
            gaussian *= 1.0 - smoothstep(0.35, 0.5, dist);
            vec2 nc = centered * 3.0 + vec2(uSeed, uSeed * 0.7);
            float n = fbm(nc);
            vec2 warp = vec2(fbm(nc + 1.3), fbm(nc + 2.7));
            n = fbm(nc + warp * uDomainWarpStrength * 0.3);
            density = gaussian * (0.6 + 0.4 * n);
          }

          // Dither for retro transparency
          float threshold = bayerDither(gl_FragCoord.xy);
          if (density < threshold) discard;

          // Output black with absorption alpha — darkens whatever is behind
          float alpha = density * uAbsorbStrength;
          gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
        }
      `,
    });

    const absMesh = new THREE.Mesh(absGeo, absMat);
    absMesh.position.copy(position);
    absMesh.lookAt(0, 0, 0);
    absMesh.renderOrder = -1; // Render absorption BEFORE emission

    // ── Emission mesh: adds the nebula's own light ──
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
        uAsymmetry: { value: asymmetry },
        uDarkLaneStrength: { value: darkLaneStrength },
        uShapeMode: { value: shapeMode },
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
            // Asymmetry stretches the falloff shape (0 = circular, 1 = very elongated)
            float stretchAngle = uSeed * 6.28;
            float cs0 = cos(stretchAngle), sn0 = sin(stretchAngle);
            vec2 asym = vec2(
              centered.x * cs0 - centered.y * sn0,
              (centered.x * sn0 + centered.y * cs0) * (1.0 + uAsymmetry * 0.8)
            );
            float asymDist = length(asym);
            float falloff = 1.0 - smoothstep(0.2, 0.5, asymDist);
            if (falloff < 0.01) discard;
            vec2 nc = centered * 4.0 + vec2(uSeed, uSeed * 0.7);
            n = fbm(nc);
            vec2 warp = vec2(fbm(nc + 1.3), fbm(nc + 2.7));
            n = fbm(nc + warp * uDomainWarpStrength);
            // Dark lanes: subtract noise-based dark channels (dust absorption)
            if (uDarkLaneStrength > 0.0) {
              float lane = fbm(nc * 1.5 + vec2(uSeed * 3.1, uSeed * 1.7));
              lane = smoothstep(0.4, 0.7, lane);
              n *= 1.0 - lane * uDarkLaneStrength;
            }
            density = n * falloff;

          } else if (uShapeMode == 1) {
            // ── RING: hollow center, bright rim ──
            // Planetary nebulae (Ring M57, Helix, Southern Ring)
            // Asymmetry makes the ring eccentric (elliptical, not circular)
            float ringAngle = uSeed * 6.28;
            float cs1 = cos(ringAngle), sn1 = sin(ringAngle);
            vec2 ringCoord = vec2(
              centered.x * cs1 - centered.y * sn1,
              (centered.x * sn1 + centered.y * cs1) * (1.0 + uAsymmetry * 0.6)
            );
            float ringDist = length(ringCoord);
            float ringRadius = 0.25;
            float ringWidth = 0.07;
            float ring = exp(-pow(ringDist - ringRadius, 2.0) / (2.0 * ringWidth * ringWidth));
            // Dim the interior — center is darker than the rim
            float centerDim = smoothstep(0.0, ringRadius * 0.6, ringDist);
            ring *= centerDim;
            // Outer falloff
            ring *= 1.0 - smoothstep(0.38, 0.5, ringDist);
            // Angular noise for texture along the ring
            vec2 nc = centered * 5.0 + vec2(uSeed, uSeed * 0.7);
            n = fbm(nc);
            vec2 warp = vec2(fbm(nc + 1.3), fbm(nc + 2.7));
            n = fbm(nc + warp * uDomainWarpStrength * 0.5);
            density = ring * (0.5 + 0.5 * n);

          } else if (uShapeMode == 2) {
            // ── BIPOLAR: two lobes / hourglass / butterfly ──
            // Planetary nebulae (Dumbbell M27, some PNe with jets)
            // Two lobes along a seed-derived axis
            float lobeAngle = uSeed * 6.28;
            float cosA = cos(lobeAngle);
            float sinA = sin(lobeAngle);
            vec2 rotated = vec2(
              centered.x * cosA - centered.y * sinA,
              centered.x * sinA + centered.y * cosA
            );
            // Lobes: stretched in one axis, compressed in the other
            // Asymmetry: one lobe larger than the other (0 = symmetric, 1 = very lopsided)
            float lobeX = rotated.x * (1.8 + uAsymmetry * 0.5);
            float lobeY = rotated.y * 0.9;
            float lobeDist = length(vec2(lobeX, lobeY));
            // Two-lobe shape: bias toward top and bottom
            // Asymmetry shifts the waist off-center
            float waistShift = rotated.y * uAsymmetry * 0.15;
            float lobeBias = abs(rotated.y + waistShift) * 2.0;
            float falloff = (1.0 - smoothstep(0.2, 0.45, lobeDist)) * smoothstep(0.0, 0.08, lobeBias);
            // Add back a faint central hub
            float hub = exp(-dist * dist / 0.008) * 0.3;
            falloff = max(falloff, hub);
            if (falloff < 0.01) discard;
            vec2 nc = centered * 5.0 + vec2(uSeed, uSeed * 0.7);
            n = fbm(nc);
            vec2 warp = vec2(fbm(nc + 1.3), fbm(nc + 2.7));
            n = fbm(nc + warp * uDomainWarpStrength * 0.6);
            density = n * falloff;

          } else if (uShapeMode == 3) {
            // ── FILAMENTARY: stretched wispy threads ──
            // NO mask — the noise threshold rises with distance from center,
            // so filaments naturally peter out at irregular distances.
            float stretchFactor = 2.0 + uAsymmetry * 2.0;
            float stretchAngle = uSeed * 6.28;
            float cosS = cos(stretchAngle);
            float sinS = sin(stretchAngle);
            vec2 stretched = vec2(
              centered.x * cosS - centered.y * sinS,
              (centered.x * sinS + centered.y * cosS) * stretchFactor
            );
            vec2 nc = stretched * 6.0 + vec2(uSeed, uSeed * 0.7);
            vec2 warp1 = vec2(fbm(nc + 1.3), fbm(nc + 2.7));
            vec2 warp2 = vec2(fbm(nc + warp1 * 0.8 + 3.1), fbm(nc + warp1 * 0.8 + 4.5));
            n = fbm(nc + warp2 * uDomainWarpStrength);
            // Rising threshold: organic boundary, no geometric mask
            float threshLow = 0.2 + dist * 1.2;
            float threshHigh = threshLow + 0.15;
            float filament = smoothstep(threshLow, threshHigh, n);
            density = filament * 0.55;

          } else if (uShapeMode == 4) {
            // ── SHELL: thin bright rim, dark interior (soap bubble) ──
            // Supernova remnant shells, bubble nebulae
            // Asymmetry makes the shell non-circular (deformed by asymmetric explosion)
            float shellAngle = uSeed * 6.28;
            float cs4 = cos(shellAngle), sn4 = sin(shellAngle);
            vec2 shellCoord = vec2(
              centered.x * cs4 - centered.y * sn4,
              (centered.x * sn4 + centered.y * cs4) * (1.0 + uAsymmetry * 0.5)
            );
            float shellDist = length(shellCoord);
            float shellRadius = 0.3;
            float shellThickness = 0.04;
            float shell = exp(-pow(shellDist - shellRadius, 2.0) / (2.0 * shellThickness * shellThickness));
            // Outer falloff
            shell *= 1.0 - smoothstep(0.42, 0.5, shellDist);
            // Angular noise for uneven brightness around the shell
            float shellAng = atan(shellCoord.y, shellCoord.x);
            float angularN = noise(vec2(shellAng * 4.0 + uSeed, shellDist * 10.0));
            shell *= 0.5 + 0.5 * angularN;
            n = angularN;
            density = shell;

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

          // Dither IS the transparency mechanism
          float threshold = bayerDither(gl_FragCoord.xy);
          if (density < threshold) discard;

          // Color: blend between primary and secondary using profile-driven mix
          float colorMix = smoothstep(0.3, 0.7, n);
          vec3 col = mix(uColor, uColorSecondary, colorMix * uColorMixStrength);

          float bright = smoothstep(0.0, 0.7, density);
          gl_FragColor = vec4(col * uBrightness * bright, 1.0);
        }
      `,
    });

    const emitMesh = new THREE.Mesh(geo, mat);
    emitMesh.position.copy(position);
    // Billboard: face the origin (camera is always at sky sphere center)
    emitMesh.lookAt(0, 0, 0);
    emitMesh.renderOrder = 0; // After absorption pass

    // Return group containing both absorption + emission meshes
    const group = new THREE.Group();
    group.add(absMesh);
    group.add(emitMesh);
    return group;
  }

  /**
   * Per-type absorption strength. Denser gas types absorb more.
   * Emission nebulae have the most dust; planetary nebulae are thinner shells;
   * supernova remnants are wispy; reflection nebulae scatter but still occlude.
   */
  _getAbsorptionStrength(feature) {
    switch (feature.type) {
      case 'emission-nebula':   return 0.55; // Dense gas + dust, strong absorption
      case 'planetary-nebula':  return 0.25; // Thin expanding shell, moderate
      case 'supernova-remnant': return 0.20; // Wispy filaments, light absorption
      case 'reflection-nebula': return 0.40; // Dust scattering = occlusion
      default:                  return 0.30;
    }
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
      // Custom blending: dst = dst * (1 - srcAlpha) — purely absorptive
      blending: THREE.CustomBlending,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquation: THREE.AddEquation,
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
