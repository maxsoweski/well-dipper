import * as THREE from 'three';
import { BAYER4, POSTERIZE } from './common.glsl.js';

/**
 * MaterialBodyShader — universal display shader for baked material channels.
 *
 * Reads a single RGBA texture where:
 *   R = height (drives normal perturbation + terrain zone coloring)
 *   G = biome mask (independent noise for material variation)
 *   B = detail (fine-scale noise for local color richness)
 *   A = roughness (lighting response variation)
 *
 * Color is computed from these channels + a palette (uniform arrays),
 * NOT read from a pre-baked color image. This preserves the "depth"
 * that procedural shaders have — multiple independent inputs driving
 * the final color, interacting with lighting angle.
 *
 * Palette defines color zones by height, modulated by biome and detail.
 */

export function createMaterialBodyMaterial(options = {}) {
  const {
    lightDir = new THREE.Vector3(1, 0, 0),
    lightDir2 = null,
    starInfo = null,
    heightScale = 0.06,
    posterizeLevels = 8.0,
    ditherEdgeWidth = 0.5,
    palette = null,
  } = options;

  // Default rocky palette if none provided
  const pal = palette || {
    // Height zone colors (low to high)
    zone0: [0.32, 0.30, 0.28],  // deep basins — darkest
    zone1: [0.42, 0.40, 0.37],  // lowlands
    zone2: [0.55, 0.52, 0.48],  // midlands
    zone3: [0.62, 0.58, 0.54],  // highlands
    zone4: [0.70, 0.66, 0.60],  // peaks / ejecta — brightest
    // Height thresholds (0-1)
    thresh01: 0.25,
    thresh12: 0.40,
    thresh23: 0.58,
    thresh34: 0.75,
    // Biome color shifts — how the G channel modulates color
    biomeWarm: [0.06, 0.02, -0.02],   // biome=high → warmer tint
    biomeCool: [-0.02, 0.00, 0.04],   // biome=low → cooler tint
    // Detail influence — how much B channel shifts brightness
    detailStrength: 0.08,
    // Roughness influence — how much A channel affects specular
    roughnessRange: [0.5, 1.0],
    // Sea level (-1 = no ocean)
    seaLevel: -1.0,
    oceanColor: [0.15, 0.30, 0.50],
    oceanDeepColor: [0.08, 0.18, 0.35],
  };

  const shadowPlanetPos = new THREE.Vector3();
  const starPos1 = new THREE.Vector3();
  const starPos2 = new THREE.Vector3();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      materialMap: { value: null },
      hasMaterial: { value: 0.0 },
      heightScale: { value: heightScale },
      posterizeLevels: { value: posterizeLevels },
      ditherEdgeWidth: { value: ditherEdgeWidth },
      lightDir: { value: lightDir },
      lightDir2: { value: lightDir2 || new THREE.Vector3(0, 0, 0) },
      starColor1: { value: new THREE.Vector3(...(starInfo?.color1 || [1, 1, 1])) },
      starColor2: { value: new THREE.Vector3(...(starInfo?.color2 || [0, 0, 0])) },
      starBrightness1: { value: starInfo?.brightness1 ?? 1.0 },
      starBrightness2: { value: starInfo?.brightness2 ?? 0.0 },
      shadowPlanetPos: { value: shadowPlanetPos },
      shadowPlanetRadius: { value: 0.0 },
      starPos1: { value: starPos1 },
      starPos2: { value: starPos2 },
      // Palette uniforms
      zone0: { value: new THREE.Vector3(...pal.zone0) },
      zone1: { value: new THREE.Vector3(...pal.zone1) },
      zone2: { value: new THREE.Vector3(...pal.zone2) },
      zone3: { value: new THREE.Vector3(...pal.zone3) },
      zone4: { value: new THREE.Vector3(...pal.zone4) },
      thresh01: { value: pal.thresh01 },
      thresh12: { value: pal.thresh12 },
      thresh23: { value: pal.thresh23 },
      thresh34: { value: pal.thresh34 },
      biomeWarm: { value: new THREE.Vector3(...pal.biomeWarm) },
      biomeCool: { value: new THREE.Vector3(...pal.biomeCool) },
      detailStrength: { value: pal.detailStrength },
      roughnessMin: { value: pal.roughnessRange[0] },
      roughnessMax: { value: pal.roughnessRange[1] },
      seaLevel: { value: pal.seaLevel },
      oceanColor: { value: new THREE.Vector3(...pal.oceanColor) },
      oceanDeepColor: { value: new THREE.Vector3(...pal.oceanDeepColor) },
      // Biome sub-palette (terrestrial mode)
      biomeMode: { value: pal.biomeMode ?? 0.0 },
      tropicalLow: { value: new THREE.Vector3(...(pal.tropicalLow || [0.15, 0.45, 0.18])) },
      tropicalHigh: { value: new THREE.Vector3(...(pal.tropicalHigh || [0.22, 0.55, 0.20])) },
      desertLow: { value: new THREE.Vector3(...(pal.desertLow || [0.65, 0.55, 0.35])) },
      desertHigh: { value: new THREE.Vector3(...(pal.desertHigh || [0.72, 0.60, 0.40])) },
      temperateLow: { value: new THREE.Vector3(...(pal.temperateLow || [0.30, 0.48, 0.22])) },
      temperateHigh: { value: new THREE.Vector3(...(pal.temperateHigh || [0.42, 0.52, 0.28])) },
      polarLow: { value: new THREE.Vector3(...(pal.polarLow || [0.75, 0.78, 0.82])) },
      polarHigh: { value: new THREE.Vector3(...(pal.polarHigh || [0.88, 0.90, 0.93])) },
      // Time for future dynamic layers
      time: { value: 0.0 },
    },

    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPos;
      varying vec3 vViewDir;

      void main() {
        vNormal = normalize(mat3(modelMatrix) * normal);
        vPosition = position;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vViewDir = cameraPosition - vWorldPos;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }
    `,

    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D materialMap;
      uniform float hasMaterial;
      uniform float heightScale;
      uniform float posterizeLevels;
      uniform float ditherEdgeWidth;
      uniform vec3 lightDir;
      uniform vec3 lightDir2;
      uniform vec3 starColor1;
      uniform vec3 starColor2;
      uniform float starBrightness1;
      uniform float starBrightness2;
      uniform vec3 shadowPlanetPos;
      uniform float shadowPlanetRadius;
      uniform vec3 starPos1;
      uniform vec3 starPos2;
      // Palette
      uniform vec3 zone0, zone1, zone2, zone3, zone4;
      uniform float thresh01, thresh12, thresh23, thresh34;
      uniform vec3 biomeWarm, biomeCool;
      uniform float detailStrength;
      uniform float roughnessMin, roughnessMax;
      uniform float seaLevel;
      uniform vec3 oceanColor, oceanDeepColor;
      // Biome sub-palette (terrestrial)
      uniform float biomeMode;
      uniform vec3 tropicalLow, tropicalHigh;
      uniform vec3 desertLow, desertHigh;
      uniform vec3 temperateLow, temperateHigh;
      uniform vec3 polarLow, polarHigh;
      uniform float time;

      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPos;
      varying vec3 vViewDir;

      // ── Equirectangular UV ──
      vec2 equirectUV(vec3 dir) {
        float u = atan(dir.z, dir.x) / (2.0 * 3.14159265) + 0.5;
        float v = asin(clamp(dir.y, -1.0, 1.0)) / 3.14159265 + 0.5;
        return vec2(u, v);
      }

      // ── Bayer dither + posterize ──
      ${BAYER4}
      ${POSTERIZE}

      // ── Height → normal perturbation ──
      // Samples R channel at neighboring texels for surface relief
      vec3 perturbNormal(vec3 geomNormal, vec2 uv, float scale) {
        vec2 texelSize = vec2(1.0 / 1024.0, 1.0 / 512.0);
        float hL = texture2D(materialMap, vec2(fract(uv.x - texelSize.x), uv.y)).r;
        float hR = texture2D(materialMap, vec2(fract(uv.x + texelSize.x), uv.y)).r;
        float hD = texture2D(materialMap, uv - vec2(0.0, texelSize.y)).r;
        float hU = texture2D(materialMap, uv + vec2(0.0, texelSize.y)).r;
        float dX = (hR - hL) * scale;
        float dY = (hU - hD) * scale;
        vec3 N = normalize(geomNormal);
        vec3 up = abs(N.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 T = normalize(cross(up, N));
        vec3 B = cross(N, T);
        vec3 perturbed = normalize(N + T * (-dX) + B * dY);
        // Clamp deviation to prevent flipped normals
        float deviation = dot(perturbed, N);
        if (deviation < 0.5) {
          perturbed = normalize(mix(perturbed, N, 0.5));
        }
        return perturbed;
      }

      // ── Shadow test ──
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

        // ── Sample material channels ──
        vec3 dir = normalize(vPosition);
        vec2 uv = equirectUV(dir);

        // Seam-safe derivatives
        vec3 dDirDx = dFdx(dir);
        vec3 dDirDy = dFdy(dir);
        vec2 uvDx = equirectUV(normalize(dir + dDirDx)) - uv;
        vec2 uvDy = equirectUV(normalize(dir + dDirDy)) - uv;
        if (uvDx.x > 0.5) uvDx.x -= 1.0;
        if (uvDx.x < -0.5) uvDx.x += 1.0;
        if (uvDy.x > 0.5) uvDy.x -= 1.0;
        if (uvDy.x < -0.5) uvDy.x += 1.0;

        vec4 channels = textureGrad(materialMap, uv, uvDx, uvDy);
        float height    = channels.r;  // elevation
        float biome     = channels.g;  // material variation
        float detail    = channels.b;  // fine noise
        float roughness = channels.a;  // lighting response

        // ── Compute surface color from channels + palette ──
        vec3 surfaceColor;

        if (seaLevel > 0.0 && height < seaLevel) {
          // Ocean: shallow shelves show depth, deep ocean is uniform
          // oceanDepth: 0 = deepest, 1 = at coastline
          float oceanDepth = smoothstep(seaLevel - 0.20, seaLevel, height);
          // Deep ocean is a consistent mid-blue (reflects sky light uniformly)
          // Only shallow coastal shelves show lighter/darker variation
          float shelfZone = smoothstep(0.6, 0.95, oceanDepth); // near coast
          vec3 deepSea = oceanColor;  // uniform deep water
          vec3 shallowSea = oceanColor * 1.15 + vec3(0.02, 0.04, 0.02); // lighter shelf
          surfaceColor = mix(deepSea, shallowSea, shelfZone);
          // Subtle tropical vs polar tinting
          vec3 warmWater = vec3(0.02, 0.03, 0.0);
          vec3 coldWater = vec3(-0.01, 0.0, 0.02);
          surfaceColor += mix(warmWater, coldWater, biome);

        } else if (biomeMode > 0.5 && seaLevel > 0.0) {
          // ── Terrestrial biome band mode ──
          // G channel = latitude: 0=tropical, 0.25=desert, 0.5=temperate, 1.0=polar
          // Select biome color based on G channel, modulated by elevation within land

          float landElev = smoothstep(seaLevel, seaLevel + 0.35, height);

          // Blend between biome palettes based on latitude (G channel)
          vec3 biomeColor = mix(tropicalLow, tropicalHigh, landElev);

          // Desert band
          vec3 desertC = mix(desertLow, desertHigh, landElev);
          biomeColor = mix(biomeColor, desertC, smoothstep(0.18, 0.28, biome) * (1.0 - smoothstep(0.33, 0.42, biome)));

          // Temperate band
          vec3 tempC = mix(temperateLow, temperateHigh, landElev);
          biomeColor = mix(biomeColor, tempC, smoothstep(0.38, 0.50, biome) * (1.0 - smoothstep(0.60, 0.70, biome)));

          // Polar band
          vec3 polarC = mix(polarLow, polarHigh, landElev);
          biomeColor = mix(biomeColor, polarC, smoothstep(0.65, 0.80, biome));

          // Mountains override biome at high elevation (grey/brown rock)
          biomeColor = mix(biomeColor, zone3, smoothstep(thresh23 - 0.02, thresh23 + 0.03, height));
          biomeColor = mix(biomeColor, zone4, smoothstep(thresh34 - 0.02, thresh34 + 0.03, height));

          // Vegetation density (B channel) modulates saturation/brightness
          biomeColor = mix(biomeColor * 0.85, biomeColor * 1.05, detail);

          surfaceColor = biomeColor;

        } else {
          // ── Standard height-zone mode (rocky, ice, lava, etc.) ──
          vec3 c = zone0;
          c = mix(c, zone1, smoothstep(thresh01 - 0.03, thresh01 + 0.03, height));
          c = mix(c, zone2, smoothstep(thresh12 - 0.03, thresh12 + 0.03, height));
          c = mix(c, zone3, smoothstep(thresh23 - 0.03, thresh23 + 0.03, height));
          c = mix(c, zone4, smoothstep(thresh34 - 0.03, thresh34 + 0.03, height));

          // Biome modulation — warm/cool tint based on G channel
          vec3 biomeTint = mix(biomeCool, biomeWarm, biome);
          c += biomeTint;

          // Detail variation — B channel shifts brightness locally
          c += vec3(detail - 0.5) * detailStrength * 2.0;

          surfaceColor = c;
        }

        // ── Normal perturbation from height channel ──
        vec3 shadingNormal = vNormal;
        if (hasMaterial > 0.5) {
          // No perturbation over ocean (water is flat)
          float perturbMask = (seaLevel > 0.0 && height < seaLevel) ? 0.0 : 1.0;
          if (perturbMask > 0.5) {
            shadingNormal = perturbNormal(vNormal, uv, heightScale);
          }
        }

        // ── Lighting ──
        // Roughness modulates terminator sharpness
        float r = mix(roughnessMin, roughnessMax, roughness);
        float termWidth = mix(0.04, 0.15, 1.0 - r); // rough = sharp, smooth = soft
        float diff1 = smoothstep(-0.02, termWidth, dot(shadingNormal, lightDir));
        float diff2 = smoothstep(-0.02, termWidth, dot(shadingNormal, lightDir2));

        // Shadows
        float shadow1 = 1.0;
        float shadow2 = 1.0;
        if (shadowPlanetRadius > 0.0) {
          shadow1 = sphereShadow(vWorldPos, starPos1, shadowPlanetPos, shadowPlanetRadius);
          shadow2 = sphereShadow(vWorldPos, starPos2, shadowPlanetPos, shadowPlanetRadius);
        }

        vec3 starLight = starColor1 * diff1 * starBrightness1 * shadow1
                       + starColor2 * diff2 * starBrightness2 * shadow2;
        starLight = max(starLight, vec3(0.035));

        vec3 finalColor = surfaceColor * starLight;

        // ── Posterize + dither ──
        finalColor = min(finalColor, vec3(1.0));
        finalColor = posterize(finalColor, posterizeLevels, gl_FragCoord.xy, ditherEdgeWidth);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });

  material._shadowPlanetPos = shadowPlanetPos;
  material._starPos1 = starPos1;
  material._starPos2 = starPos2;

  return material;
}

// ── Preset palettes ──

export const PALETTES = {
  rocky: {
    zone0: [0.32, 0.30, 0.28],
    zone1: [0.42, 0.40, 0.37],
    zone2: [0.55, 0.52, 0.48],
    zone3: [0.62, 0.58, 0.54],
    zone4: [0.70, 0.66, 0.60],
    thresh01: 0.25, thresh12: 0.40, thresh23: 0.58, thresh34: 0.75,
    biomeWarm: [0.05, 0.02, -0.02],
    biomeCool: [-0.02, 0.00, 0.03],
    detailStrength: 0.08,
    roughnessRange: [0.6, 1.0],
    seaLevel: -1.0,
    oceanColor: [0.15, 0.30, 0.50],
    oceanDeepColor: [0.08, 0.18, 0.35],
  },

  ice: {
    zone0: [0.55, 0.58, 0.62],
    zone1: [0.68, 0.72, 0.75],
    zone2: [0.78, 0.80, 0.82],
    zone3: [0.85, 0.87, 0.88],
    zone4: [0.92, 0.93, 0.95],
    thresh01: 0.20, thresh12: 0.38, thresh23: 0.55, thresh34: 0.72,
    biomeWarm: [0.02, -0.01, -0.04],
    biomeCool: [-0.03, 0.01, 0.05],
    detailStrength: 0.06,
    roughnessRange: [0.3, 0.8],
    seaLevel: -1.0,
    oceanColor: [0.15, 0.30, 0.50],
    oceanDeepColor: [0.08, 0.18, 0.35],
  },

  terrestrial: {
    // Height zones (used for mountains that override biome colors)
    zone0: [0.18, 0.42, 0.22],
    zone1: [0.35, 0.48, 0.25],
    zone2: [0.52, 0.45, 0.30],
    zone3: [0.45, 0.40, 0.35],  // rocky highland (overrides biome)
    zone4: [0.62, 0.60, 0.57],  // mountain peaks (overrides biome)
    thresh01: 0.48, thresh12: 0.55, thresh23: 0.65, thresh34: 0.80,
    biomeWarm: [0.06, 0.03, -0.04],
    biomeCool: [-0.04, 0.02, 0.03],
    detailStrength: 0.06,
    roughnessRange: [0.4, 0.9],
    seaLevel: 0.38,
    oceanColor: [0.12, 0.30, 0.55],
    oceanDeepColor: [0.06, 0.15, 0.35],
    // Biome sub-palette (latitude-based band selection)
    biomeMode: 1.0,
    tropicalLow: [0.14, 0.40, 0.15],   // dense jungle — deep green
    tropicalHigh: [0.20, 0.50, 0.18],   // forest canopy — lighter green
    desertLow: [0.62, 0.52, 0.32],      // sandy desert — tan
    desertHigh: [0.70, 0.58, 0.38],     // bright sand/dunes
    temperateLow: [0.28, 0.45, 0.20],   // mixed forest — olive green
    temperateHigh: [0.40, 0.50, 0.25],  // grassland/steppe
    polarLow: [0.72, 0.75, 0.80],       // tundra — grey-blue
    polarHigh: [0.86, 0.88, 0.92],      // snow/ice cap — near white
  },

  lava: {
    zone0: [0.15, 0.08, 0.05],  // cooled basalt
    zone1: [0.25, 0.12, 0.08],  // warm rock
    zone2: [0.40, 0.18, 0.08],  // hot surface
    zone3: [0.70, 0.30, 0.08],  // glowing cracks
    zone4: [0.95, 0.55, 0.10],  // exposed magma
    thresh01: 0.30, thresh12: 0.45, thresh23: 0.62, thresh34: 0.80,
    biomeWarm: [0.08, 0.03, 0.00],
    biomeCool: [-0.03, -0.02, 0.02],
    detailStrength: 0.10,
    roughnessRange: [0.7, 1.0],
    seaLevel: -1.0,
    oceanColor: [0.15, 0.30, 0.50],
    oceanDeepColor: [0.08, 0.18, 0.35],
  },

  volcanic: {
    zone0: [0.60, 0.45, 0.15],  // sulfur plains
    zone1: [0.75, 0.58, 0.20],  // sulfur frost
    zone2: [0.85, 0.70, 0.28],  // bright sulfur
    zone3: [0.50, 0.30, 0.12],  // dark lava flows
    zone4: [0.90, 0.75, 0.25],  // bright ejecta
    thresh01: 0.25, thresh12: 0.42, thresh23: 0.60, thresh34: 0.78,
    biomeWarm: [0.05, 0.02, -0.03],
    biomeCool: [-0.04, -0.02, 0.02],
    detailStrength: 0.10,
    roughnessRange: [0.5, 0.9],
    seaLevel: -1.0,
    oceanColor: [0.15, 0.30, 0.50],
    oceanDeepColor: [0.08, 0.18, 0.35],
  },
};
