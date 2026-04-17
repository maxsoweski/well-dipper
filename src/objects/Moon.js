import * as THREE from 'three';
import { BAYER4, POSTERIZE, SNOISE } from '../rendering/shaders/common.glsl.js';

/**
 * Moon — a small sphere that orbits a parent planet.
 *
 * Keeps its own orbital state (angle) and updates position each frame.
 * Uses a simplified version of the planet shader — still has posterization
 * and dithering but fewer surface features (moons are small, don't need
 * as much detail).
 *
 * Supports dual-star lighting for binary systems.
 */
export class Moon {
  constructor(moonData, lightDir, lightDir2 = null, starInfo = null) {
    this.data = moonData;
    this.orbitAngle = moonData.startAngle;

    this.mesh = this._createMesh(lightDir, lightDir2, starInfo);
  }

  _createMesh(lightDir, lightDir2, starInfo) {
    const d = this.data;
    // Terrestrial moons get higher resolution (clouds + atmosphere need smoother rim)
    const subdivisions = d.type === 'terrestrial' ? 4 : 3;
    const geometry = new THREE.IcosahedronGeometry(d.radius, subdivisions);

    // Type index: 0=captured, 1=rocky, 2=ice, 3=volcanic, 4=terrestrial
    const typeIndex = ['captured', 'rocky', 'ice', 'volcanic', 'terrestrial'].indexOf(d.type);

    // Shadow uniforms — parent planet can eclipse starlight
    this._shadowPlanetPos = new THREE.Vector3();
    this._starPos1 = new THREE.Vector3();
    this._starPos2 = new THREE.Vector3();

    const material = new THREE.ShaderMaterial({
      uniforms: {
        baseColor: { value: new THREE.Vector3(...d.baseColor) },
        accentColor: { value: new THREE.Vector3(...d.accentColor) },
        noiseScale: { value: d.noiseScale },
        lightDir: { value: lightDir },
        lightDir2: { value: lightDir2 || new THREE.Vector3(0, 0, 0) },
        starColor1: { value: new THREE.Vector3(...(starInfo?.color1 || [1, 1, 1])) },
        starColor2: { value: new THREE.Vector3(...(starInfo?.color2 || [0, 0, 0])) },
        starBrightness1: { value: starInfo?.brightness1 ?? 1.0 },
        starBrightness2: { value: starInfo?.brightness2 ?? 0.0 },
        moonType: { value: typeIndex },
        // Shadow: parent planet eclipsing starlight
        shadowPlanetPos: { value: this._shadowPlanetPos },
        shadowPlanetRadius: { value: 0.0 },
        starPos1: { value: this._starPos1 },
        starPos2: { value: this._starPos2 },
        // Clouds + atmosphere (terrestrial moons only)
        time: { value: 0.0 },
        hasClouds: { value: d.clouds ? 1.0 : 0.0 },
        cloudColor: { value: new THREE.Vector3(...(d.clouds?.color || [1, 1, 1])) },
        cloudDensity: { value: d.clouds?.density || 0.0 },
        cloudScale: { value: d.clouds?.scale || 3.0 },
        hasAtmosphere: { value: d.atmosphere ? 1.0 : 0.0 },
        atmosphereColor: { value: new THREE.Vector3(...(d.atmosphere?.color || [0.4, 0.6, 1.0])) },
        atmosphereStrength: { value: d.atmosphere?.strength || 0.0 },
        // Aurora (terrestrial moons)
        moonRadius: { value: d.radius },
        hasAurora: { value: d.aurora ? 1.0 : 0.0 },
        auroraColor: { value: new THREE.Vector3(...(d.aurora?.color || [0.3, 0.8, 0.4])) },
        auroraIntensity: { value: d.aurora?.intensity || 0.0 },
        auroraRingLat: { value: d.aurora?.ringLatitude || 0.8 },
        auroraRingWidth: { value: d.aurora?.ringWidth || 0.1 },
        // LOD level: 1=orbital (default), 2=close-up (enhanced detail)
        lodLevel: { value: 1 },
      },

      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPos;

        void main() {
          vNormal = normalize(mat3(modelMatrix) * normal);
          vPosition = position;
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }
      `,

      fragmentShader: /* glsl */ `
        #include <logdepthbuf_pars_fragment>
        uniform vec3 baseColor;
        uniform vec3 accentColor;
        uniform float noiseScale;
        uniform vec3 lightDir;
        uniform vec3 lightDir2;
        uniform vec3 starColor1;
        uniform vec3 starColor2;
        uniform float starBrightness1;
        uniform float starBrightness2;
        uniform int moonType;
        // Shadow uniforms
        uniform vec3 shadowPlanetPos;
        uniform float shadowPlanetRadius;
        uniform vec3 starPos1;
        uniform vec3 starPos2;
        // Cloud + atmosphere uniforms (terrestrial moons)
        uniform float time;
        uniform float hasClouds;
        uniform vec3 cloudColor;
        uniform float cloudDensity;
        uniform float cloudScale;
        uniform float hasAtmosphere;
        uniform vec3 atmosphereColor;
        uniform float atmosphereStrength;
        // Aurora (+ moonRadius for latitude calc)
        uniform float moonRadius;
        uniform float hasAurora;
        uniform vec3 auroraColor;
        uniform float auroraIntensity;
        uniform float auroraRingLat;
        uniform float auroraRingWidth;
        // LOD level for detail switching
        uniform int lodLevel;

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPos;

        // ── Simplex noise (same as Planet.js) ──
        ${SNOISE}

        // ── Bayer dither + posterize ──
        ${BAYER4}
        ${POSTERIZE}

        // Ray-sphere shadow test: is a sphere blocking the light from a star?
        // Returns 0.0 (full shadow) to 1.0 (no shadow)
        float sphereShadow(vec3 fragPos, vec3 starPosition, vec3 casterPos, float casterRadius) {
          vec3 toStar = starPosition - fragPos;
          float distToStar = length(toStar);
          vec3 rayDir = toStar / distToStar;
          vec3 oc = casterPos - fragPos;
          float tca = dot(oc, rayDir);
          if (tca < 0.0) return 1.0;        // caster behind fragment
          if (tca > distToStar) return 1.0;  // caster beyond star
          float d2 = dot(oc, oc) - tca * tca;
          if (d2 >= casterRadius * casterRadius * 1.3) return 1.0;
          return smoothstep(casterRadius * 0.85, casterRadius * 1.15, sqrt(d2));
        }

        // ── Heightmap normal perturbation from procedural noise ──
        // Computes a "height" value from multi-octave noise, then uses
        // finite differences along the tangent plane to derive a perturbed
        // surface normal. This gives all procedural bodies crater-like
        // relief that responds to lighting — the same technique that makes
        // the NASA-textured Moon look great.
        float computeHeight(vec3 pos) {
          // Large-scale features: impact basins, hemispheric differences
          float h = snoise(pos * noiseScale * 0.3) * 0.5;
          // Medium terrain: large craters, ridges
          h += snoise(pos * noiseScale) * 0.35;
          // Fine detail: small craters, roughness
          h += snoise(pos * noiseScale * 2.0) * 0.2;
          h += snoise(pos * noiseScale * 4.0) * 0.1;
          return h;
        }

        vec3 perturbNormalFromNoise(vec3 N, vec3 pos, float strength) {
          // Build tangent frame from geometric normal
          vec3 up = abs(N.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          vec3 T = normalize(cross(up, N));
          vec3 B = cross(N, T);

          // Finite differences along tangent/bitangent
          float eps = 0.01;
          float h0 = computeHeight(pos);
          float hT = computeHeight(pos + T * eps);
          float hB = computeHeight(pos + B * eps);

          // Raw gradient can be ~10-20 due to noise frequency; scale down
          // so strength 0.25 = visible relief, not flipped normals
          float dT = (hT - h0) / eps;
          float dB = (hB - h0) / eps;
          float scale = strength * 0.025;

          vec3 perturbed = normalize(N - T * dT * scale - B * dB * scale);
          // Clamp: perturbed normal must stay within ~60deg of geometric.
          // Prevents flipped normals -> pure black patches.
          float deviation = dot(perturbed, N);
          if (deviation < 0.5) {
            perturbed = normalize(mix(perturbed, N, 0.5));
          }
          return perturbed;
        }

        // ── 3D Cellular (Worley) noise — simplified 2x2x2 search ──
        // Returns vec2(F1, F2) where F1 = distance to nearest cell center,
        // F2 = distance to second nearest. Used for crater placement.
        // Based on Stefan Gustavson's implementation (MIT license).
        vec3 cellHash(vec3 p) {
          // Hash function: deterministic pseudo-random point in cell
          p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
                   dot(p, vec3(269.5, 183.3, 246.1)),
                   dot(p, vec3(113.5, 271.9, 124.6)));
          return fract(sin(p) * 43758.5453123);
        }

        vec2 cellular3D(vec3 P) {
          vec3 Pi = floor(P);
          vec3 Pf = fract(P);
          float f1 = 10.0;
          float f2 = 10.0;
          // Search 3x3x3 neighborhood
          for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
              for (int z = -1; z <= 1; z++) {
                vec3 offset = vec3(float(x), float(y), float(z));
                vec3 cellCenter = offset + cellHash(Pi + offset) - Pf;
                float d = dot(cellCenter, cellCenter); // squared distance
                if (d < f1) { f2 = f1; f1 = d; }
                else if (d < f2) { f2 = d; }
              }
            }
          }
          return vec2(sqrt(f1), sqrt(f2));
        }

        // ── Crater profile from cellular F1 distance ──
        // Produces realistic impact crater: bowl depression + raised rim + ejecta
        float craterProfile(float f1, float craterRadius) {
          float r = f1 / craterRadius;
          if (r > 2.0) return 0.0;
          // Bowl: smooth parabolic depression inside crater
          float bowl = (smoothstep(0.0, 1.0, r) - 1.0) * 0.5;
          // Rim: Gaussian bump at crater edge
          float rim = exp(-(r - 1.0) * (r - 1.0) * 10.0) * 0.25;
          // Ejecta: gentle falloff outside rim
          float ejecta = exp(-max(r - 1.0, 0.0) * 4.0) * step(1.0, r) * 0.08;
          return bowl + rim + ejecta;
        }

        // ── LOD2 height: more octaves + crater features ──
        float computeHeightLOD2(vec3 pos) {
          // Base terrain (same 4 octaves as LOD1)
          float h = snoise(pos * noiseScale * 0.3) * 0.5;
          h += snoise(pos * noiseScale) * 0.35;
          h += snoise(pos * noiseScale * 2.0) * 0.2;
          h += snoise(pos * noiseScale * 4.0) * 0.1;
          // Extra fine octaves (LOD2 only)
          h += snoise(pos * noiseScale * 8.0) * 0.05;
          h += snoise(pos * noiseScale * 16.0) * 0.025;

          // Large impact basins (few, deep)
          vec2 c1 = cellular3D(pos * noiseScale * 0.4);
          h += craterProfile(c1.x, 0.4) * 0.6;

          // Medium craters (common)
          vec2 c2 = cellular3D(pos * noiseScale * 1.5);
          h += craterProfile(c2.x, 0.35) * 0.3;

          // Small impacts (many, subtle)
          vec2 c3 = cellular3D(pos * noiseScale * 4.5);
          h += craterProfile(c3.x, 0.3) * 0.12;

          return h;
        }

        void main() {
          #include <logdepthbuf_fragment>
          // Surface pattern by moon type
          float n = snoise(vPosition * noiseScale);
          vec3 surfaceColor;

          if (moonType == 1) {
            // Rocky: cratered highlands + dark maria basins (like Earth's Moon)
            // Multi-scale noise for FBM-like detail
            float maria = snoise(vPosition * noiseScale * 0.5)
                        + snoise(vPosition * noiseScale * 1.0) * 0.4;
            float mariaMask = smoothstep(-0.2, 0.5, maria);
            surfaceColor = mix(accentColor, baseColor, mariaMask);
            // Bright ray craters (stronger impact)
            float craters = snoise(vPosition * noiseScale * 2.5);
            craters = pow(max(craters, 0.0), 1.5);
            surfaceColor += vec3(0.18) * craters;
            // Fine surface roughness
            float rough = snoise(vPosition * noiseScale * 5.0) * 0.08;
            surfaceColor += vec3(rough);
            // LOD2: crater color details from cellular noise
            if (lodLevel >= 2) {
              // Large crater interiors: slightly darker (shadow-filling dust)
              vec2 cl = cellular3D(vPosition * noiseScale * 0.4);
              float largeBowl = 1.0 - smoothstep(0.0, 0.35, cl.x);
              surfaceColor *= 1.0 - largeBowl * 0.12;
              // Fresh impact rays: bright radial streaks
              vec2 cm = cellular3D(vPosition * noiseScale * 1.5);
              float freshImpact = 1.0 - smoothstep(0.0, 0.15, cm.x);
              surfaceColor += vec3(0.10) * freshImpact;
              // Extra fine roughness at LOD2
              float fineRough = snoise(vPosition * noiseScale * 10.0) * 0.04;
              surfaceColor += vec3(fineRough);
            }
          } else if (moonType == 2) {
            // Ice: white/blue surface with dark crack networks
            // Broader cracks (pow 3 not 5) + dual-scale fractures
            float cracks1 = 1.0 - abs(snoise(vPosition * noiseScale * 3.0));
            cracks1 = pow(cracks1, 3.0);
            float cracks2 = 1.0 - abs(snoise(vPosition * noiseScale * 1.2));
            cracks2 = pow(cracks2, 2.5) * 0.5;
            float cracks = min(cracks1 + cracks2, 1.0);
            // Surface variation between cracks (subtle terrain)
            float terrain = snoise(vPosition * noiseScale * 0.6) * 0.15 + 0.5;
            vec3 iceBase = baseColor * terrain + baseColor * (1.0 - terrain) * 0.85;
            surfaceColor = mix(iceBase, accentColor, cracks);
          } else if (moonType == 3) {
            // Volcanic: sulfur yellow with dark lava patches (Io-like)
            float lava = snoise(vPosition * noiseScale * 1.5);
            float lavaMask = smoothstep(-0.2, 0.3, lava);
            surfaceColor = mix(accentColor, baseColor, lavaMask);
            // Bright sulfur frost around vents (stronger)
            float frost = snoise(vPosition * noiseScale * 4.0);
            frost = pow(max(frost, 0.0), 2.0);
            surfaceColor += vec3(0.22, 0.18, 0.06) * frost;
            // Dark caldera spots
            float caldera = snoise(vPosition * noiseScale * 6.0);
            caldera = pow(max(-caldera, 0.0), 3.0);
            surfaceColor -= vec3(0.12) * caldera;
          } else if (moonType == 4) {
            // Terrestrial: ocean + varied land terrain
            float continent = snoise(vPosition * noiseScale * 0.7);
            continent += snoise(vPosition * noiseScale * 1.5) * 0.35;
            continent += snoise(vPosition * noiseScale * 3.0) * 0.18;
            continent += snoise(vPosition * noiseScale * 6.0) * 0.08;
            float height = continent * 0.5 + 0.5;
            float seaLevel = 0.48;
            float landMask = smoothstep(seaLevel - 0.02, seaLevel + 0.04, height);

            // Ocean with depth gradient
            vec3 deepOcean = baseColor * 0.6;
            float oceanDepth = smoothstep(seaLevel - 0.3, seaLevel, height);
            vec3 ocean = mix(deepOcean, baseColor * 1.1, oceanDepth);

            // Land with elevation zones
            float landElev = smoothstep(seaLevel, seaLevel + 0.3, height);
            vec3 lowland = accentColor;
            vec3 midland = accentColor * 0.6 + vec3(0.16, 0.12, 0.05);
            vec3 highland = vec3(0.40, 0.36, 0.32);
            vec3 land = lowland;
            land = mix(land, midland, smoothstep(0.25, 0.5, landElev));
            land = mix(land, highland, smoothstep(0.6, 0.85, landElev));
            // Local terrain noise for variety
            float terrVar = snoise(vPosition * noiseScale * 4.0) * 0.06;
            land += vec3(terrVar, terrVar * 0.7, terrVar * 0.4);

            surfaceColor = mix(ocean, land, landMask);
          } else {
            // Captured: dark, battered surface with multi-scale roughness
            float detail = snoise(vPosition * noiseScale) * 0.4
                         + snoise(vPosition * noiseScale * 2.5) * 0.3
                         + snoise(vPosition * noiseScale * 5.0) * 0.15;
            float mask = detail * 0.5 + 0.5;
            // Stretch across full range so posterization has bands to work with
            mask = smoothstep(0.2, 0.8, mask);
            surfaceColor = mix(baseColor, accentColor, mask);
          }

          // ── Normal perturbation from procedural noise ──
          // Airless bodies get strong relief (craters, basins, scarring).
          // Terrestrial moons: only perturb land, not water.
          float perturbStrength = 0.15;
          if (moonType == 0 || moonType == 1) perturbStrength = 0.30; // rocky/captured: heavy cratering
          else if (moonType == 2) perturbStrength = 0.22;             // ice: ridges + terrain
          else if (moonType == 3) perturbStrength = 0.25;             // volcanic: caldera relief

          // LOD2: stronger perturbation + crater features for rocky/captured
          if (lodLevel >= 2) {
            if (moonType == 0 || moonType == 1) perturbStrength = 0.45;
            else if (moonType == 2) perturbStrength = 0.32;
            else if (moonType == 3) perturbStrength = 0.35;
          }

          // Terrestrial moons: mask perturbation over water
          if (moonType == 4) {
            float tHeight = snoise(vPosition * noiseScale * 0.7)
                          + snoise(vPosition * noiseScale * 1.5) * 0.35
                          + snoise(vPosition * noiseScale * 3.0) * 0.18
                          + snoise(vPosition * noiseScale * 6.0) * 0.08;
            float tLandMask = smoothstep(0.46, 0.50, tHeight * 0.5 + 0.5);
            perturbStrength = (lodLevel >= 2 ? 0.30 : 0.20) * tLandMask;
          }

          // LOD2: use enhanced height function with craters for rocky/captured
          vec3 shadingNormal;
          if (lodLevel >= 2 && (moonType == 0 || moonType == 1)) {
            // LOD2 rocky/captured: craters + extra octaves
            vec3 up2 = abs(vNormal.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
            vec3 T2 = normalize(cross(up2, vNormal));
            vec3 B2 = cross(vNormal, T2);
            float eps2 = 0.01;
            float h0 = computeHeightLOD2(vPosition);
            float hT = computeHeightLOD2(vPosition + T2 * eps2);
            float hB = computeHeightLOD2(vPosition + B2 * eps2);
            float dT2 = (hT - h0) / eps2;
            float dB2 = (hB - h0) / eps2;
            float scale2 = perturbStrength * 0.025;
            shadingNormal = normalize(vNormal - T2 * dT2 * scale2 - B2 * dB2 * scale2);
            float dev2 = dot(shadingNormal, vNormal);
            if (dev2 < 0.5) shadingNormal = normalize(mix(shadingNormal, vNormal, 0.5));
          } else {
            shadingNormal = perturbStrength > 0.001
              ? perturbNormalFromNoise(vNormal, vPosition, perturbStrength)
              : vNormal;
          }

          // ── Dual-star Lighting (using perturbed normal) ──
          float diff1 = max(dot(shadingNormal, lightDir), 0.0);
          float diff2 = max(dot(shadingNormal, lightDir2), 0.0);

          // Type-specific terminator shaping
          // Airless bodies get sharp terminators, atmospheric ones get soft
          if (moonType == 0 || moonType == 1) {
            diff1 = smoothstep(-0.02, 0.08, dot(shadingNormal, lightDir));
            diff2 = smoothstep(-0.02, 0.08, dot(shadingNormal, lightDir2));
          } else if (moonType == 3) {
            diff1 = smoothstep(-0.02, 0.08, dot(shadingNormal, lightDir));
            diff2 = smoothstep(-0.02, 0.08, dot(shadingNormal, lightDir2));
          } else if (moonType == 4) {
            diff1 = smoothstep(-0.1, 0.3, dot(shadingNormal, lightDir));
            diff2 = smoothstep(-0.1, 0.3, dot(shadingNormal, lightDir2));
          }
          // Ice (moonType 2) keeps the default smooth diffuse

          // Shadow from parent planet (eclipse)
          // Gate on shadowPlanetRadius > 0 to avoid degenerate case when shadow
          // is not configured (e.g. gallery mode) — calling sphereShadow with all
          // positions at (0,0,0) causes NaN from floating-point cancellation.
          float shadow1 = 1.0;
          float shadow2 = 1.0;
          if (shadowPlanetRadius > 0.0) {
            shadow1 = sphereShadow(vWorldPos, starPos1, shadowPlanetPos, shadowPlanetRadius);
            shadow2 = sphereShadow(vWorldPos, starPos2, shadowPlanetPos, shadowPlanetRadius);
          }

          // Combined star-colored light with shadow (tiny ambient so unlit sides aren't invisible)
          vec3 starLight = starColor1 * diff1 * starBrightness1 * shadow1
                         + starColor2 * diff2 * starBrightness2 * shadow2;
          starLight = max(starLight, vec3(0.025));
          float diffuse = diff1 * starBrightness1 * shadow1 + diff2 * starBrightness2 * shadow2;

          vec3 finalColor = surfaceColor * starLight;

          // Volcanic: faint glow on dark side from lava
          if (moonType == 3) {
            float nightGlow = max(-dot(shadingNormal, lightDir), 0.0);
            finalColor += accentColor * nightGlow * 0.15;
          }

          // ── Aurora (terrestrial moons — night-side glow near magnetic poles) ──
          if (hasAurora > 0.5) {
            float auroraNight = 1.0 - smoothstep(0.0, 0.25, diffuse);
            float lat = abs(vPosition.y) / moonRadius;
            float ringDist = abs(lat - auroraRingLat);
            float ringMask = exp(-ringDist * ringDist / (2.0 * auroraRingWidth * auroraRingWidth));
            float azimuth = atan(vPosition.z, vPosition.x);
            float curtain = snoise(vec3(azimuth * 3.0, lat * 10.0, time * 0.3)) * 0.5 + 0.5;
            curtain += snoise(vec3(azimuth * 7.0, lat * 15.0, time * 0.5)) * 0.25;
            float rays = pow(curtain, 2.0);
            float auroraMask = ringMask * rays * auroraNight * auroraIntensity;
            finalColor += auroraColor * auroraMask * 0.5;
          }

          // ── Cloud layer (terrestrial moons — animated) ──
          if (hasClouds > 0.5) {
            float cloudSpeed = 0.008;
            vec3 cloudPos = vPosition * cloudScale + vec3(time * cloudSpeed, time * cloudSpeed * 0.3, 0.0);
            float cn = snoise(cloudPos);
            cn += snoise(cloudPos * 2.0) * 0.4;
            cn += snoise(cloudPos * 4.0) * 0.2;
            cn += snoise(cloudPos * 8.0) * 0.1;
            float cloudMask = smoothstep(0.0, 0.2, cn) * cloudDensity;
            float cloudLight = diffuse * 0.9;
            finalColor = mix(finalColor, cloudColor * cloudLight, cloudMask);
          }

          // ── Atmosphere rim glow (terrestrial moons) ──
          if (hasAtmosphere > 0.5) {
            float rim = 1.0 - max(dot(vNormal, normalize(cameraPosition - vWorldPos)), 0.0);
            rim = pow(rim, 2.5);
            float rimLight = max(diffuse, 0.15);  // atmosphere scatters even on dark side
            finalColor += atmosphereColor * rim * atmosphereStrength * rimLight;
          }

          // Posterize — wider edgeWidth (0.6) than planets (0.4) so dithering
          // creates more visible transition bands, revealing surface detail
          finalColor = min(finalColor, vec3(1.0));
          finalColor = posterize(finalColor, 6.0, gl_FragCoord.xy, 0.6);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    return new THREE.Mesh(geometry, material);
  }

  /**
   * Update orbital position around the parent planet's world position.
   * @param {number} deltaTime
   * @param {THREE.Vector3} parentPosition - the planet's world position
   */
  update(deltaTime, parentPosition) {
    // orbitSpeed is in rad/s (consistent with planet-moon path in main.js)
    this.orbitAngle += this.data.orbitSpeed * deltaTime;

    const r = this.data.orbitRadius;
    const angle = this.orbitAngle;
    const incl = this.data.inclination;

    // Orbit in XZ plane, tilted by inclination.
    // Must match OrbitLine's rotation.x = inclination, which applies a
    // rotation matrix around X: y' = -sin(θ)·z, z' = cos(θ)·z
    this.mesh.position.set(
      parentPosition.x + Math.cos(angle) * r,
      parentPosition.y - Math.sin(incl) * Math.sin(angle) * r,
      parentPosition.z + Math.cos(incl) * Math.sin(angle) * r,
    );

    // Slow self-rotation
    this.mesh.rotation.y += 0.167 * (Math.PI / 180) * deltaTime;

    // Animate clouds (terrestrial moons)
    if (this.data.clouds) {
      this.mesh.material.uniforms.time.value += deltaTime;
    }
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
