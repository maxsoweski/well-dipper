import * as THREE from 'three';

/**
 * Planet — a sphere with a procedural noise-based surface, optional
 * cloud layer, atmosphere rim glow, and ring system.
 *
 * Uses a THREE.Group as the root (this.mesh) so that:
 * - The surface sphere rotates on its axis
 * - The ring stays fixed (just tilted with axial tilt)
 * - main.js can still use planet.mesh.position etc.
 */
export class Planet {
  constructor(planetData, starInfo = null) {
    this.data = planetData;
    this.mesh = new THREE.Group();
    this._lightDir = new THREE.Vector3(...planetData.sunDirection).normalize();
    this._lightDir2 = new THREE.Vector3(0, 0, 0); // second star (binary systems)

    // Star color/brightness for dual lighting
    this._starColor1 = starInfo?.color1 || [1, 1, 1];
    this._starColor2 = starInfo?.color2 || [0, 0, 0];
    this._starBrightness1 = starInfo?.brightness1 ?? 1.0;
    this._starBrightness2 = starInfo?.brightness2 ?? 0.0;

    // Surface sphere
    this.surface = this._createSurface();
    this.mesh.add(this.surface);

    // Ring system (if any)
    this.ring = this._createRing();
    if (this.ring) {
      if (planetData.rings.tiltX) this.ring.rotation.x += planetData.rings.tiltX;
      if (planetData.rings.tiltZ) this.ring.rotation.z += planetData.rings.tiltZ;
      this.mesh.add(this.ring);
    }

    // Axial tilt applies to the whole group
    this.mesh.rotation.z = this.data.axialTilt;
  }

  _createSurface() {
    const geometry = new THREE.IcosahedronGeometry(this.data.radius, 5);
    const d = this.data;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        baseColor: { value: new THREE.Vector3(...d.baseColor) },
        accentColor: { value: new THREE.Vector3(...d.accentColor) },
        noiseScale: { value: d.noiseScale },
        noiseDetail: { value: d.noiseDetail },
        lightDir: { value: this._lightDir },
        lightDir2: { value: this._lightDir2 },
        starColor1: { value: new THREE.Vector3(...this._starColor1) },
        starColor2: { value: new THREE.Vector3(...this._starColor2) },
        starBrightness1: { value: this._starBrightness1 },
        starBrightness2: { value: this._starBrightness2 },
        time: { value: 0 },
        planetType: { value: this._typeIndex() },
        planetRadius: { value: d.radius },
        // Clouds
        hasClouds: { value: d.clouds ? 1.0 : 0.0 },
        cloudColor: { value: new THREE.Vector3(...(d.clouds?.color || [1, 1, 1])) },
        cloudDensity: { value: d.clouds?.density || 0.0 },
        cloudScale: { value: d.clouds?.scale || 3.0 },
        // Atmosphere
        atmosphereStrength: { value: d.atmosphere?.strength || 0.0 },
        atmosphereColor: { value: new THREE.Vector3(...(d.atmosphere?.color || [0.5, 0.5, 0.8])) },
        // Shadow casters
        starPos1: { value: new THREE.Vector3() },
        starPos2: { value: new THREE.Vector3() },
        shadowMoonCount: { value: 0 },
        shadowMoonPos: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
        shadowMoonRadius: { value: new Float32Array(6) },
        shadowPlanetCount: { value: 0 },
        shadowPlanetPos: { value: [new THREE.Vector3(), new THREE.Vector3()] },
        shadowPlanetRadius: { value: new Float32Array(2) },
      },

      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPos;
        varying vec3 vViewDir;

        void main() {
          // World-space normal (independent of camera rotation)
          vNormal = normalize(mat3(modelMatrix) * normal);
          vPosition = position;  // object space — for noise sampling
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;  // world space — for lighting
          vViewDir = cameraPosition - vWorldPos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }
      `,

      fragmentShader: /* glsl */ `
        #include <logdepthbuf_pars_fragment>
        uniform vec3 baseColor;
        uniform vec3 accentColor;
        uniform float noiseScale;
        uniform float noiseDetail;
        uniform vec3 lightDir;
        uniform vec3 lightDir2;
        uniform vec3 starColor1;
        uniform vec3 starColor2;
        uniform float starBrightness1;
        uniform float starBrightness2;
        uniform float time;
        uniform int planetType;
        uniform float planetRadius;
        uniform float hasClouds;
        uniform vec3 cloudColor;
        uniform float cloudDensity;
        uniform float cloudScale;
        uniform float atmosphereStrength;
        uniform vec3 atmosphereColor;
        // Shadow casters
        uniform vec3 starPos1;
        uniform vec3 starPos2;
        const int MAX_SHADOW_MOONS = 6;
        uniform int shadowMoonCount;
        uniform vec3 shadowMoonPos[6];
        uniform float shadowMoonRadius[6];
        const int MAX_SHADOW_PLANETS = 2;
        uniform int shadowPlanetCount;
        uniform vec3 shadowPlanetPos[2];
        uniform float shadowPlanetRadius[2];

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPos;
        varying vec3 vViewDir;

        // ── Simplex-like noise (GPU version) ──
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);

          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);

          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;

          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;

          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);

          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);

          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);

          vec4 s0 = floor(b0) * 2.0 + 1.0;
          vec4 s1 = floor(b1) * 2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));

          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);

          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;

          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        // ── 4x4 Bayer dithering threshold ──
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

        // ── Edge-dithered posterization ──
        vec3 posterize(vec3 color, float levels, vec2 fragCoord, float edgeWidth) {
          float dither = bayerDither(fragCoord) - 0.5;
          vec3 dithered = color + dither * edgeWidth / levels;
          return floor(dithered * levels + 0.5) / levels;
        }

        // ── Ray-sphere shadow test ──
        // Returns 0.0 (full shadow) to 1.0 (no shadow)
        float sphereShadow(vec3 fragPos, vec3 starPosition, vec3 casterPos, float casterRadius) {
          vec3 toStar = starPosition - fragPos;
          float distToStar = length(toStar);
          vec3 rayDir = toStar / distToStar;
          vec3 oc = casterPos - fragPos;
          float tca = dot(oc, rayDir);
          if (tca < 0.0) return 1.0;
          if (tca > distToStar) return 1.0;
          float d2 = dot(oc, oc) - tca * tca;
          if (d2 >= casterRadius * casterRadius * 1.3) return 1.0;
          return smoothstep(casterRadius * 0.85, casterRadius * 1.15, sqrt(d2));
        }

        // Total shadow factor for one star from all casters
        float totalShadow(vec3 fragPos, vec3 starPosition) {
          float shadow = 1.0;
          for (int i = 0; i < MAX_SHADOW_MOONS; i++) {
            if (i >= shadowMoonCount) break;
            shadow *= sphereShadow(fragPos, starPosition, shadowMoonPos[i], shadowMoonRadius[i]);
          }
          for (int i = 0; i < MAX_SHADOW_PLANETS; i++) {
            if (i >= shadowPlanetCount) break;
            shadow *= sphereShadow(fragPos, starPosition, shadowPlanetPos[i], shadowPlanetRadius[i]);
          }
          return shadow;
        }

        // ── Surface pattern based on planet type ──
        float getSurfacePattern(vec3 pos) {
          float n = snoise(pos * noiseScale);
          n += snoise(pos * noiseScale * 2.0) * noiseDetail * 0.5;

          if (planetType == 1) {
            // Gas giant: Jupiter-like with multiple bands, turbulence, storms
            float lat = pos.y * noiseScale;
            float bands = sin(lat * 3.5) * 0.5
                        + sin(lat * 7.0 + 0.5) * 0.3
                        + sin(lat * 13.0) * 0.12;
            float turb = snoise(pos * noiseScale * 2.0) * 0.35
                       + snoise(pos * noiseScale * 4.0) * 0.15;
            bands += turb * (1.0 - abs(bands));
            float storm = snoise(pos * noiseScale * 0.5 + vec3(50.0, 0.0, 0.0));
            storm = pow(max(storm, 0.0), 4.0);
            n = bands * 0.5 + 0.5 + storm * 0.4;
          } else if (planetType == 3) {
            // Lava: sharp glowing cracks
            n = 1.0 - abs(n);
            n = pow(n, 2.0);
          } else if (planetType == 2) {
            // Ice: subtle cracks overlaid on smooth surface
            float cracks = 1.0 - abs(snoise(pos * noiseScale * 3.0));
            cracks = pow(cracks, 4.0);
            n = n * 0.3 + 0.5 + cracks * 0.3;
          } else if (planetType == 5) {
            // Terrestrial: continent-like shapes with ragged coastlines
            float continent = snoise(pos * noiseScale * 0.7);
            continent += snoise(pos * noiseScale * 1.5) * 0.3;
            continent += snoise(pos * noiseScale * 3.0) * 0.15;
            continent += snoise(pos * noiseScale * 6.0) * 0.08;
            n = continent;
          } else if (planetType == 6) {
            // Hot Jupiter: chaotic swirls, less banding than normal gas giant
            float lat = pos.y * noiseScale;
            float bands = sin(lat * 2.5) * 0.3 + sin(lat * 5.0) * 0.15;
            float swirl = snoise(pos * noiseScale * 1.5) * 0.5
                        + snoise(pos * noiseScale * 3.0) * 0.25;
            n = bands + swirl;
          } else if (planetType == 7) {
            // Eyeball: concentric climate rings centered on the sub-stellar point
            // Use world-space position so zones don't rotate with the surface
            float angDist = acos(clamp(dot(normalize(vWorldPos), lightDir), -1.0, 1.0));
            // Add noise for irregular ring edges
            float ringNoise = snoise(pos * noiseScale * 2.0) * 0.15;
            n = angDist + ringNoise;
          } else if (planetType == 8) {
            // Venus: very subtle, slow-moving banding beneath thick clouds
            float lat = pos.y * noiseScale;
            float bands = sin(lat * 2.0) * 0.15 + sin(lat * 4.0) * 0.08;
            float swirl = snoise(pos * noiseScale * 0.8) * 0.12;
            n = 0.5 + bands + swirl; // centered around 0.5, very low contrast
          } else if (planetType == 9) {
            // Carbon: dark surface with occasional bright crystalline facets
            float base = snoise(pos * noiseScale) * 0.3;
            // Sharp "glint" peaks from high-frequency noise
            float crystal = snoise(pos * noiseScale * 5.0);
            crystal = pow(max(crystal, 0.0), 8.0); // very sharp peaks = rare glints
            n = base * 0.5 + 0.4 + crystal * 0.6;
          } else if (planetType == 10) {
            // Sub-Neptune: very smooth, subtle banding, hazy appearance
            float lat = pos.y * noiseScale;
            float bands = sin(lat * 3.0) * 0.1 + sin(lat * 6.0) * 0.05;
            float haze = snoise(pos * noiseScale * 0.7) * 0.08;
            n = 0.5 + bands + haze;
          }

          return n;
        }

        void main() {
          #include <logdepthbuf_fragment>
          float pattern = getSurfacePattern(vPosition);

          // ── Surface color (type-dependent) ──
          vec3 surfaceColor;

          if (planetType == 5) {
            // Terrestrial: sharp ocean / land boundary
            float height = pattern * 0.5 + 0.5;
            float seaLevel = 0.45;
            float landMask = step(seaLevel, height);

            vec3 deepOcean = baseColor * 0.7;
            float oceanDepth = smoothstep(seaLevel - 0.25, seaLevel, height);
            vec3 ocean = mix(deepOcean, baseColor, oceanDepth);

            float landHeight = smoothstep(seaLevel, seaLevel + 0.3, height);
            vec3 highland = accentColor * 0.6 + vec3(0.15, 0.12, 0.08);
            vec3 land = mix(accentColor, highland, landHeight);

            surfaceColor = mix(ocean, land, landMask);

            // Ice caps at planet's rotational poles (object-space Y, not world Y)
            float latitude = abs(vPosition.y) / planetRadius;
            float iceNoise = snoise(vPosition * noiseScale * 2.0) * 0.15;
            float iceMask = smoothstep(0.55, 0.7, latitude + iceNoise);
            vec3 iceColor = vec3(0.85, 0.88, 0.92);
            surfaceColor = mix(surfaceColor, iceColor, iceMask);
          } else if (planetType == 1) {
            // Gas giant: zones, belts, storms
            float bandVal = pattern;
            float zoneMask = smoothstep(0.42, 0.58, bandVal);
            surfaceColor = mix(baseColor, accentColor, zoneMask);

            vec3 stormColor = baseColor * 0.5 + vec3(0.3, 0.1, 0.05);
            float stormMask = smoothstep(0.78, 0.88, bandVal);
            surfaceColor = mix(surfaceColor, stormColor, stormMask);

            float polarDark = smoothstep(0.6, 1.0, abs(vPosition.y) / planetRadius);
            surfaceColor *= 1.0 - polarDark * 0.3;
          } else if (planetType == 6) {
            // Hot Jupiter: dark base with glowing day-side heat
            float swirl = pattern * 0.5 + 0.5;
            surfaceColor = mix(baseColor, baseColor * 1.3, swirl);

            // Thermal glow: use world-space pos so it stays fixed toward the sun
            float starFacing = max(dot(normalize(vWorldPos), lightDir), 0.0);
            float hotspot = pow(starFacing, 3.0);
            vec3 glowColor = accentColor;
            surfaceColor += glowColor * hotspot * 0.8;

            // Night side thermal glow — very faint deep red
            float nightSide = max(-dot(normalize(vWorldPos), lightDir), 0.0);
            surfaceColor += vec3(0.15, 0.03, 0.01) * nightSide * 0.5;
          } else if (planetType == 7) {
            // Eyeball planet: concentric climate zones
            float angDist = pattern; // angular distance from sub-stellar point

            // Zone boundaries (from center outward):
            // 0.0-0.4: open ocean (dark blue), 0.4-0.8: habitable (green/brown),
            // 0.8-1.5: ice transition, 1.5+: frozen night (white)
            vec3 oceanColor = baseColor;
            vec3 landColor = accentColor;
            vec3 iceColor = vec3(0.82, 0.85, 0.9);
            vec3 frozenColor = vec3(0.7, 0.72, 0.78);

            float oceanMask = 1.0 - smoothstep(0.3, 0.5, angDist);
            float landMask = smoothstep(0.3, 0.5, angDist) * (1.0 - smoothstep(0.8, 1.0, angDist));
            float iceMask = smoothstep(0.8, 1.0, angDist) * (1.0 - smoothstep(1.5, 1.8, angDist));
            float frozenMask = smoothstep(1.5, 1.8, angDist);

            surfaceColor = oceanColor * oceanMask
                         + landColor * landMask
                         + iceColor * iceMask
                         + frozenColor * frozenMask;
          } else if (planetType == 8) {
            // Venus: nearly featureless, low-contrast cream/yellow clouds
            float val = pattern;
            surfaceColor = mix(baseColor, accentColor, val);
          } else if (planetType == 9) {
            // Carbon: very dark with rare bright diamond glints
            float val = pattern;
            surfaceColor = mix(baseColor, accentColor, smoothstep(0.3, 0.6, val));

            // Diamond glints: bright white specular points
            float glint = smoothstep(0.85, 0.95, val);
            surfaceColor += vec3(0.8, 0.85, 0.9) * glint;
          } else if (planetType == 10) {
            // Sub-Neptune: smooth, muted, hazy blend
            float val = pattern;
            surfaceColor = mix(baseColor, accentColor, val);
          } else {
            // Default: smooth blend between base and accent (rocky, ocean, ice, lava)
            float mixFactor = smoothstep(0.3, 0.7, pattern * 0.5 + 0.5);
            surfaceColor = mix(baseColor, accentColor, mixFactor);
          }

          // ── Dual-star Lighting with Shadows ──
          float diff1 = max(dot(vNormal, lightDir), 0.0);
          float diff2 = max(dot(vNormal, lightDir2), 0.0);

          // Shadow modulation per star (moons/planets blocking light)
          float shadow1 = totalShadow(vWorldPos, starPos1);
          float shadow2 = totalShadow(vWorldPos, starPos2);

          // Combined star-colored light with shadows
          vec3 starLight = starColor1 * diff1 * starBrightness1 * shadow1
                         + starColor2 * diff2 * starBrightness2 * shadow2;
          // Total brightness (for effects that just need a scalar)
          float diffuse = diff1 * starBrightness1 * shadow1 + diff2 * starBrightness2 * shadow2;

          // Tiny ambient so dark sides show as silhouettes, not invisible black
          float ambient = 0.02;
          // Hot Jupiter: slightly more ambient from thermal glow
          if (planetType == 6) {
            ambient = 0.04;
          }

          vec3 finalColor = surfaceColor * (starLight + vec3(ambient));

          // Hot Jupiter: add emissive glow that doesn't depend on light
          if (planetType == 6) {
            float starFacing = max(dot(normalize(vWorldPos), lightDir), 0.0);
            float hotspot = pow(starFacing, 3.0);
            finalColor += accentColor * hotspot * 0.3;
            // Night side deep red emission
            float nightSide = max(-dot(normalize(vWorldPos), lightDir), 0.0);
            finalColor += vec3(0.12, 0.02, 0.0) * pow(nightSide, 0.8) * 0.4;
          }

          // Carbon: diamond glints are emissive (glow in shadow too)
          if (planetType == 9) {
            float crystal = snoise(vPosition * noiseScale * 5.0);
            crystal = pow(max(crystal, 0.0), 8.0);
            float glint = smoothstep(0.85, 0.95, crystal * 0.6 + 0.4 + snoise(vPosition * noiseScale) * 0.15);
            finalColor += vec3(0.5, 0.55, 0.6) * glint * 0.3;
          }

          // ── Cloud layer (animated) ──
          if (hasClouds > 0.5) {
            float cloudSpeed = (planetType == 5 || planetType == 7) ? 0.005 : 0.017;
            vec3 cloudPos = vPosition * cloudScale + vec3(time * cloudSpeed, time * cloudSpeed * 0.4, 0.0);
            float cn = snoise(cloudPos);
            cn += snoise(cloudPos * 2.0) * 0.4;
            cn += snoise(cloudPos * 4.0) * 0.2;
            cn += snoise(cloudPos * 8.0) * 0.1;
            float cloudMask = smoothstep(0.05, 0.15, cn) * cloudDensity;
            float cloudLight = diffuse * 0.9;
            finalColor = mix(finalColor, cloudColor * cloudLight, cloudMask);
          }

          // ── Atmosphere rim glow (fresnel, lit side only) ──
          if (atmosphereStrength > 0.0) {
            vec3 viewDir = normalize(vViewDir);
            float fresnel = 1.0 - max(dot(vNormal, viewDir), 0.0);
            fresnel = pow(fresnel, 3.0);
            float sunFacing = smoothstep(-0.1, 0.3, diffuse);

            // Sub-Neptune and Venus: atmosphere glow wraps further around
            if (planetType == 8 || planetType == 10) {
              sunFacing = smoothstep(-0.3, 0.2, diffuse);
            }

            finalColor += atmosphereColor * fresnel * atmosphereStrength * sunFacing * 0.5;
          }

          // ── Posterize with edge dithering ──
          finalColor = min(finalColor, vec3(1.0));
          finalColor = posterize(finalColor, 6.0, gl_FragCoord.xy, 0.4);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    return new THREE.Mesh(geometry, material);
  }

  _createRing() {
    const d = this.data;
    if (!d.rings) return null;

    const innerR = d.radius * d.rings.innerRadius;
    const outerR = d.radius * d.rings.outerRadius;
    const geometry = new THREE.RingGeometry(innerR, outerR, 64);

    // RingGeometry is in XY plane — rotate to XZ so it wraps the equator
    geometry.rotateX(Math.PI / 2);

    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        ringColor1: { value: new THREE.Vector3(...d.rings.color1) },
        ringColor2: { value: new THREE.Vector3(...d.rings.color2) },
        ringOpacity: { value: d.rings.opacity },
        innerRadius: { value: innerR },
        outerRadius: { value: outerR },
        lightDir: { value: this._lightDir },
        planetRadius: { value: d.radius },
        // Moon-cleared gaps (shepherd moon effect)
        moonGapCount: { value: 0 },
        moonGapRadii: { value: new Float32Array(6) },
        moonGapWidths: { value: new Float32Array(6) },
      },

      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vPos;
        varying vec3 vRelWorldPos;

        void main() {
          vPos = position;
          // Planet-relative world position: extract planet center from modelMatrix
          // and subtract it so shadow math works regardless of orbital position
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vec3 planetCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vRelWorldPos = worldPos.xyz - planetCenter;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }
      `,

      fragmentShader: /* glsl */ `
        #include <logdepthbuf_pars_fragment>
        uniform vec3 ringColor1;
        uniform vec3 ringColor2;
        uniform float ringOpacity;
        uniform float innerRadius;
        uniform float outerRadius;
        uniform vec3 lightDir;
        uniform float planetRadius;
        // Moon-cleared gaps
        const int MAX_MOON_GAPS = 6;
        uniform int moonGapCount;
        uniform float moonGapRadii[6];
        uniform float moonGapWidths[6];

        varying vec3 vPos;
        varying vec3 vRelWorldPos;

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

        vec3 posterize(vec3 color, float levels, vec2 fragCoord, float edgeWidth) {
          float dither = bayerDither(fragCoord) - 0.5;
          vec3 dithered = color + dither * edgeWidth / levels;
          return floor(dithered * levels + 0.5) / levels;
        }

        void main() {
          #include <logdepthbuf_fragment>
          float dist = length(vPos.xz);
          float t = (dist - innerRadius) / (outerRadius - innerRadius);

          float band1 = sin(t * 30.0) * 0.5 + 0.5;
          float band2 = sin(t * 12.0 + 1.0) * 0.5 + 0.5;
          float density = band1 * 0.6 + band2 * 0.4;

          vec3 color = mix(ringColor1, ringColor2, band1);

          // Cassini-like gap
          float gap = smoothstep(0.4, 0.43, t) * (1.0 - smoothstep(0.48, 0.51, t));
          float alpha = density * (1.0 - gap * 0.8) * ringOpacity;

          // Fade at inner and outer edges
          alpha *= smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.92, 1.0, t));

          // Moon-cleared gaps (shepherd moon effect — like Mimas creating the Cassini Division)
          for (int i = 0; i < MAX_MOON_GAPS; i++) {
            if (i >= moonGapCount) break;
            float gapDist = abs(dist - moonGapRadii[i]);
            alpha *= smoothstep(0.0, moonGapWidths[i], gapDist);
          }

          // Planet shadow on ring — use planet-relative position with lightDir
          float shadowDist = length(cross(vRelWorldPos, lightDir));
          float behindPlanet = step(dot(vRelWorldPos, lightDir), 0.0);
          float inShadow = behindPlanet * (1.0 - smoothstep(planetRadius * 0.9, planetRadius * 1.1, shadowDist));

          float ringLight = 1.0 - inShadow;
          color *= ringLight;
          // Shadow also reduces opacity — prevents opaque black fragments
          // from blocking objects behind the ring (like stars)
          alpha *= mix(0.15, 1.0, ringLight);

          if (bayerDither(gl_FragCoord.xy) > alpha) discard;

          color = posterize(color, 6.0, gl_FragCoord.xy, 0.4);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    return new THREE.Mesh(geometry, material);
  }

  /**
   * Set ring gaps at moon orbital radii (shepherd moon effect).
   * Call after creating moons, passing the moon data array.
   */
  setRingGaps(moonDataArray) {
    if (!this.ring) return;
    const innerR = this.data.radius * this.data.rings.innerRadius;
    const outerR = this.data.radius * this.data.rings.outerRadius;
    const mat = this.ring.material;
    let gapCount = 0;

    for (const moon of moonDataArray) {
      if (gapCount >= 6) break;
      // Check if moon orbits within the ring bounds
      if (moon.orbitRadius >= innerR && moon.orbitRadius <= outerR) {
        mat.uniforms.moonGapRadii.value[gapCount] = moon.orbitRadius;
        // Gap width scales with moon size — larger moons clear wider gaps
        mat.uniforms.moonGapWidths.value[gapCount] = moon.radius * 4;
        gapCount++;
      }
    }
    mat.uniforms.moonGapCount.value = gapCount;
  }

  /** Map type string to integer for the shader */
  _typeIndex() {
    const types = [
      'rocky', 'gas-giant', 'ice', 'lava', 'ocean', 'terrestrial',
      'hot-jupiter', 'eyeball', 'venus', 'carbon', 'sub-neptune',
    ];
    return types.indexOf(this.data.type);
  }

  /** Call every frame. Rotates the surface and ring. */
  update(deltaTime) {
    this.surface.rotation.y += this.data.rotationSpeed * (Math.PI / 180) * deltaTime;

    if (this.ring) {
      this.ring.rotation.y += this.data.rotationSpeed * 0.3 * (Math.PI / 180) * deltaTime;
    }

    const mat = this.surface.material;
    if (mat.uniforms.time) {
      mat.uniforms.time.value += deltaTime;
      // Wrap to prevent float32 precision loss after hours of runtime
      // 10000s is ~2.8 hours — noise patterns tile seamlessly at this scale
      if (mat.uniforms.time.value > 10000) mat.uniforms.time.value -= 10000;
    }
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.surface.geometry.dispose();
    this.surface.material.dispose();
    if (this.ring) {
      this.ring.geometry.dispose();
      this.ring.material.dispose();
    }
  }
}
