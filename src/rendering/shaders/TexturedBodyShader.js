import * as THREE from 'three';

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
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      // ── Bayer dither + posterize ──
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
          float fresnel = 1.0 - max(dot(vNormal, viewDir), 0.0);
          fresnel = pow(fresnel, 3.0);
          float sunFacing = smoothstep(-0.1, 0.3, diffuse);
          finalColor += atmosphereColor * fresnel * atmosphereStrength * sunFacing * 0.5;
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
