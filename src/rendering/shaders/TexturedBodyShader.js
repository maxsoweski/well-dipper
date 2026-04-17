import * as THREE from 'three';
import { BAYER4, POSTERIZE, SNOISE, FRESNEL } from './common.glsl.js';

/**
 * TexturedBodyShader — equirectangular texture-mapped body with heightmap normals,
 * weather/cloud layers, and atmosphere rim glow.
 *
 * Used for bodies with a KnownBodyProfile (always-textured mode for Sol system).
 *
 * Key features:
 *   - Equirectangular UV computed in fragment shader (no vertex seam artifacts)
 *   - Heightmap sampled to perturb normals (fake relief without extra geometry)
 *   - Posterization + Bayer dithering preserved (retro aesthetic)
 *   - Dual-star lighting with shadow casting
 *   - Animated cloud/weather layer (terrestrial, dust, thick styles)
 *   - Atmosphere rim glow
 */

export function createTexturedBodyMaterial(options = {}) {
  const {
    lightDir = new THREE.Vector3(1, 0, 0),
    lightDir2 = null,
    starInfo = null,
    heightScale = 0.04,
    posterizeLevels = 8.0,
    ditherEdgeWidth = 0.5,
    clouds = null,
    atmosphere = null,
    planetRadius = 1.0,
    cloudStyle = 0,  // 0=none, 1=terrestrial weather, 2=dust storms, 3=thick/venus
  } = options;

  const shadowPlanetPos = new THREE.Vector3();
  const starPos1 = new THREE.Vector3();
  const starPos2 = new THREE.Vector3();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      diffuseMap: { value: null },
      heightMap: { value: null },
      hasTextures: { value: 0.0 },
      hasHeightMap: { value: 0.0 },
      heightScale: { value: heightScale },
      posterizeLevels: { value: posterizeLevels },
      ditherEdgeWidth: { value: ditherEdgeWidth },
      lightDir: { value: lightDir },
      lightDir2: { value: lightDir2 || new THREE.Vector3(0, 0, 0) },
      starColor1: { value: new THREE.Vector3(...(starInfo?.color1 || [1, 1, 1])) },
      starColor2: { value: new THREE.Vector3(...(starInfo?.color2 || [0, 0, 0])) },
      starBrightness1: { value: starInfo?.brightness1 ?? 1.0 },
      starBrightness2: { value: starInfo?.brightness2 ?? 0.0 },
      // Shadow: parent planet eclipsing starlight
      shadowPlanetPos: { value: shadowPlanetPos },
      shadowPlanetRadius: { value: 0.0 },
      starPos1: { value: starPos1 },
      starPos2: { value: starPos2 },
      // Crossfade blend
      blendAlpha: { value: 1.0 },
      // Cloud / weather layer
      time: { value: 0.0 },
      hasClouds: { value: clouds ? 1.0 : 0.0 },
      cloudColor: { value: new THREE.Vector3(...(clouds?.color || [1, 1, 1])) },
      cloudDensity: { value: clouds?.density || 0.0 },
      cloudScale: { value: clouds?.scale || 3.0 },
      cloudStyle: { value: cloudStyle },
      // Atmosphere rim glow
      hasAtmosphere: { value: atmosphere ? 1.0 : 0.0 },
      atmosphereColor: { value: new THREE.Vector3(...(atmosphere?.color || [0.4, 0.6, 1.0])) },
      atmosphereStrength: { value: atmosphere?.strength || 0.0 },
      planetRadius: { value: planetRadius },
    },

    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPos;
      varying vec3 vModelNormal;
      varying vec3 vViewDir;

      void main() {
        vNormal = normalize(mat3(modelMatrix) * normal);
        vModelNormal = normalize(normal);
        vPosition = position;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vViewDir = cameraPosition - vWorldPos;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }
    `,

    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D diffuseMap;
      uniform sampler2D heightMap;
      uniform float hasTextures;
      uniform float hasHeightMap;
      uniform float heightScale;
      uniform float posterizeLevels;
      uniform float ditherEdgeWidth;
      uniform vec3 lightDir;
      uniform vec3 lightDir2;
      uniform vec3 starColor1;
      uniform vec3 starColor2;
      uniform float starBrightness1;
      uniform float starBrightness2;
      // Shadow uniforms
      uniform vec3 shadowPlanetPos;
      uniform float shadowPlanetRadius;
      uniform vec3 starPos1;
      uniform vec3 starPos2;
      // Crossfade alpha
      uniform float blendAlpha;
      // Cloud / weather
      uniform float time;
      uniform float hasClouds;
      uniform vec3 cloudColor;
      uniform float cloudDensity;
      uniform float cloudScale;
      uniform int cloudStyle;
      // Atmosphere
      uniform float hasAtmosphere;
      uniform vec3 atmosphereColor;
      uniform float atmosphereStrength;
      uniform float planetRadius;

      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPos;
      varying vec3 vModelNormal;
      varying vec3 vViewDir;

      // ── Equirectangular UV from object-space normal ──
      vec2 equirectUV(vec3 dir) {
        float u = atan(dir.z, dir.x) / (2.0 * 3.14159265) + 0.5;
        float v = asin(clamp(dir.y, -1.0, 1.0)) / 3.14159265 + 0.5;
        return vec2(u, v);
      }

      // ── Simplex noise (for clouds) ──
      ${SNOISE}

      // ── Bayer dither + posterize ──
      ${BAYER4}
      ${POSTERIZE}

      // ── Fresnel factor ──
      ${FRESNEL}

      // ── Heightmap → normal perturbation ──
      vec3 perturbNormal(vec3 geomNormal, vec2 uv, float scale) {
        vec2 texelSize = vec2(1.0 / 1024.0, 1.0 / 512.0);
        float hL = texture2D(heightMap, vec2(fract(uv.x - texelSize.x), uv.y)).r;
        float hR = texture2D(heightMap, vec2(fract(uv.x + texelSize.x), uv.y)).r;
        float hD = texture2D(heightMap, uv - vec2(0.0, texelSize.y)).r;
        float hU = texture2D(heightMap, uv + vec2(0.0, texelSize.y)).r;
        float dX = (hR - hL) * scale;
        float dY = (hU - hD) * scale;
        vec3 N = normalize(geomNormal);
        vec3 up = abs(N.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 T = normalize(cross(up, N));
        vec3 B = cross(N, T);
        return normalize(N + T * (-dX) + B * dY);
      }

      // Ray-sphere shadow test
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

      void main() {
        #include <logdepthbuf_fragment>

        // Compute equirectangular UV from object-space position
        vec3 dir = normalize(vPosition);
        vec2 uv = equirectUV(dir);

        // Fix seam artifact: compute correct derivatives manually
        vec3 dDirDx = dFdx(dir);
        vec3 dDirDy = dFdy(dir);
        vec2 uvDx = equirectUV(normalize(dir + dDirDx)) - uv;
        vec2 uvDy = equirectUV(normalize(dir + dDirDy)) - uv;
        if (uvDx.x > 0.5) uvDx.x -= 1.0;
        if (uvDx.x < -0.5) uvDx.x += 1.0;
        if (uvDy.x > 0.5) uvDy.x -= 1.0;
        if (uvDy.x < -0.5) uvDy.x += 1.0;

        // Sample with explicit gradients — correct mip level across seam
        vec3 surfaceColor = textureGrad(diffuseMap, uv, uvDx, uvDy).rgb;

        // Compute shading normal — perturbed by heightmap if available
        vec3 shadingNormal = vNormal;
        if (hasHeightMap > 0.5) {
          shadingNormal = perturbNormal(vNormal, uv, heightScale);
        }

        // ── Dual-star Lighting ──
        float diff1 = smoothstep(-0.02, 0.08, dot(shadingNormal, lightDir));
        float diff2 = smoothstep(-0.02, 0.08, dot(shadingNormal, lightDir2));

        // Shadow from parent planet
        float shadow1 = 1.0;
        float shadow2 = 1.0;
        if (shadowPlanetRadius > 0.0) {
          shadow1 = sphereShadow(vWorldPos, starPos1, shadowPlanetPos, shadowPlanetRadius);
          shadow2 = sphereShadow(vWorldPos, starPos2, shadowPlanetPos, shadowPlanetRadius);
        }

        // Combined star-colored light
        vec3 starLight = starColor1 * diff1 * starBrightness1 * shadow1
                       + starColor2 * diff2 * starBrightness2 * shadow2;
        starLight = max(starLight, vec3(0.025));
        float diffuse = diff1 * starBrightness1 * shadow1 + diff2 * starBrightness2 * shadow2;

        vec3 finalColor = surfaceColor * starLight;

        // ── Cloud / weather layer ──
        if (hasClouds > 0.5) {
          if (cloudStyle == 1) {
            // Terrestrial weather: latitude bands + domain-warped swirls
            float lat = abs(vPosition.y) / planetRadius;
            float itcz = exp(-lat * lat / (2.0 * 0.08 * 0.08)) * 0.6;
            float stormTrack = exp(-(lat - 0.55) * (lat - 0.55) / (2.0 * 0.15 * 0.15)) * 0.8;
            float polar = smoothstep(0.65, 0.85, lat) * 0.4;
            float latBias = itcz + stormTrack + polar;

            vec3 cloudPos = vPosition * cloudScale + vec3(time * 0.005, 0.0, 0.0);
            float warpX = snoise(cloudPos * 0.5 + vec3(0.0, 0.0, time * 0.002)) * 0.3;
            float warpZ = snoise(cloudPos * 0.5 + vec3(50.0, 0.0, time * 0.002)) * 0.3;
            vec3 warpedPos = cloudPos + vec3(warpX, 0.0, warpZ);

            float cn = snoise(warpedPos);
            cn += snoise(warpedPos * 2.0) * 0.4;
            cn += snoise(warpedPos * 4.0) * 0.15;

            float cloudMask = smoothstep(-0.1, 0.25, cn + latBias * 0.3) * cloudDensity;
            float cloudLight = max(diffuse * 0.85, 0.06);
            finalColor = mix(finalColor, cloudColor * cloudLight, cloudMask);

          } else if (cloudStyle == 2) {
            // Dust storms: large regional patches, very thin
            vec3 dustPos = vPosition * cloudScale * 0.6 + vec3(time * 0.002, 0.0, 0.0);
            float dust = snoise(dustPos * 0.5);
            dust += snoise(dustPos * 1.0) * 0.4;
            float dustMask = smoothstep(0.3, 0.6, dust) * cloudDensity;
            float dustLight = max(diffuse * 0.9, 0.04);
            finalColor = mix(finalColor, cloudColor * dustLight, dustMask);

          } else {
            // Thick clouds (Venus-like) or generic
            vec3 cloudPos = vPosition * cloudScale + vec3(time * 0.017, time * 0.007, 0.0);
            float cn = snoise(cloudPos);
            cn += snoise(cloudPos * 2.0) * 0.4;
            cn += snoise(cloudPos * 4.0) * 0.2;
            cn += snoise(cloudPos * 8.0) * 0.1;
            float cloudMask = smoothstep(0.05, 0.15, cn) * cloudDensity;
            float cloudLight = max(diffuse * 0.9, 0.04);
            finalColor = mix(finalColor, cloudColor * cloudLight, cloudMask);
          }
        }

        // ── Atmosphere rim glow ──
        if (hasAtmosphere > 0.5) {
          vec3 viewDir = normalize(vViewDir);
          float f = fresnel(vNormal, viewDir, 3.0);
          float sunFacing = smoothstep(-0.1, 0.3, diffuse);
          finalColor += atmosphereColor * f * atmosphereStrength * sunFacing * 0.5;
        }

        // Posterize + dither (retro aesthetic preserved)
        finalColor = min(finalColor, vec3(1.0));
        finalColor = posterize(finalColor, posterizeLevels, gl_FragCoord.xy, ditherEdgeWidth);

        gl_FragColor = vec4(finalColor, blendAlpha);
      }
    `,
  });

  // Store refs for external updates (shadow casting, etc.)
  material._shadowPlanetPos = shadowPlanetPos;
  material._starPos1 = starPos1;
  material._starPos2 = starPos2;

  return material;
}
