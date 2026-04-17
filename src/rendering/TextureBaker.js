import * as THREE from 'three';
import { SNOISE } from './shaders/common.glsl.js';

/**
 * TextureBaker — bakes procedural noise to equirectangular textures at runtime.
 *
 * Renders a fullscreen quad with a noise shader into a WebGLRenderTarget with
 * MRT (Multiple Render Targets): output 0 = diffuse color, output 1 = heightmap.
 * The resulting textures drop straight into TexturedBodyShader — same pipeline
 * as NASA textures, with all the seam fixes and normal perturbation.
 *
 * Usage:
 *   const baker = new TextureBaker(renderer);
 *   const { diffuseMap, heightMap, renderTarget } = baker.bake(seed, params);
 *   // Wire into TexturedBodyShader uniforms...
 *   // Later: renderTarget.dispose() when planet leaves view
 */

const BAKE_WIDTH = 1024;
const BAKE_HEIGHT = 512;

// ── Baking fragment shader (GLSL3 for MRT) ──
// Converts equirectangular UV → 3D sphere direction → samples 3D noise
// Outputs: location 0 = diffuse RGBA, location 1 = height RGBA
const BAKE_FRAG = /* glsl */ `
precision highp float;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outHeight;

in vec2 vUv;

uniform float seed;
uniform float noiseScale;
uniform int bodyType;       // 0=rocky, 1=ice, 2=lava, 3=terrestrial, 4=volcanic, 5=ocean, 6=carbon, 7=venus
uniform vec3 baseColor;
uniform vec3 accentColor;
uniform float noiseDetail;

// ── 3D Simplex noise ──
${SNOISE}

// ── FBM (fractal Brownian motion) ──
float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// ── Equirectangular UV → 3D sphere direction ──
// UV (0,0) = bottom-left, (1,1) = top-right
// Returns normalized direction on unit sphere
vec3 equirectToDir(vec2 uv) {
  float theta = (uv.x - 0.5) * 2.0 * 3.14159265;  // longitude: -π to π
  float phi = (uv.y - 0.5) * 3.14159265;            // latitude: -π/2 to π/2
  return vec3(
    cos(phi) * cos(theta),
    sin(phi),
    cos(phi) * sin(theta)
  );
}

void main() {
  vec3 dir = equirectToDir(vUv);
  // Offset by seed so each planet is unique
  vec3 p = dir * noiseScale + vec3(seed, seed * 0.7, seed * 1.3);

  // ── Height computation ──
  // Large-scale features (basins, continents)
  float h = snoise(p * 0.4) * 0.5;
  // Medium terrain
  h += snoise(p * 1.0) * 0.3;
  // Detail
  h += snoise(p * 2.0) * 0.15;
  h += snoise(p * 4.0) * 0.08;
  // Extra fine detail (visible up close)
  h += snoise(p * 8.0) * 0.04;
  h += snoise(p * 16.0) * 0.02;

  // Normalize to 0-1 range for heightmap storage
  float heightNorm = clamp(h * 0.5 + 0.5, 0.0, 1.0);

  // ── Surface color (type-dependent) ──
  vec3 color;

  if (bodyType == 0) {
    // Rocky: cratered terrain with maria basins
    float mariaMask = smoothstep(0.35, 0.55, heightNorm);
    color = mix(accentColor, baseColor, mariaMask);
    // Impact crater ejecta (bright spots at high elevations)
    float ejecta = smoothstep(0.7, 0.85, heightNorm);
    color += vec3(0.12) * ejecta;
    // Dark basin floors
    float basin = 1.0 - smoothstep(0.2, 0.35, heightNorm);
    color *= 1.0 - basin * 0.25;

  } else if (bodyType == 1) {
    // Ice: bright surface with dark crack networks
    float crackNoise = snoise(p * 3.0);
    float cracks = 1.0 - abs(crackNoise);
    cracks = pow(cracks, 3.5);
    float terrain = heightNorm * 0.3 + 0.7; // mostly bright
    color = baseColor * terrain;
    color = mix(color, accentColor, cracks * 0.7);

  } else if (bodyType == 2) {
    // Lava: dark crust with glowing cracks
    float crackVal = snoise(p * 2.0);
    float cracks = 1.0 - abs(crackVal);
    cracks = pow(cracks, 2.5);
    color = mix(baseColor, accentColor, heightNorm * 0.6);
    // Glowing cracks
    color += accentColor * cracks * 0.6;

  } else if (bodyType == 3) {
    // Terrestrial: ocean + varied land with elevation zones
    float seaLevel = 0.42;
    float landMask = smoothstep(seaLevel - 0.01, seaLevel + 0.02, heightNorm);

    // Ocean
    vec3 deepOcean = baseColor * 0.75;
    float oceanDepth = smoothstep(seaLevel - 0.25, seaLevel, heightNorm);
    vec3 ocean = mix(deepOcean, baseColor * 1.05, oceanDepth);

    // Land elevation zones
    float landElev = smoothstep(seaLevel, seaLevel + 0.35, heightNorm);
    vec3 lowland = accentColor;
    vec3 midland = accentColor * 0.6 + vec3(0.16, 0.12, 0.05);
    vec3 highland = vec3(0.42, 0.38, 0.34);
    vec3 peak = vec3(0.6, 0.58, 0.55);
    vec3 land = lowland;
    land = mix(land, midland, smoothstep(0.2, 0.45, landElev));
    land = mix(land, highland, smoothstep(0.55, 0.78, landElev));
    land = mix(land, peak, smoothstep(0.85, 0.98, landElev));
    // Local variation
    float terrVar = snoise(p * 6.0) * 0.05;
    land += vec3(terrVar, terrVar * 0.7, terrVar * 0.4);

    color = mix(ocean, land, landMask);

    // Ice caps
    float lat = abs(dir.y);
    float iceNoise = snoise(p * 2.0) * 0.12;
    float iceMask = smoothstep(0.6, 0.78, lat + iceNoise);
    color = mix(color, vec3(0.85, 0.88, 0.92), iceMask);

  } else if (bodyType == 4) {
    // Volcanic: sulfur yellow with dark lava patches
    float lavaMask = smoothstep(0.3, 0.55, heightNorm);
    color = mix(accentColor, baseColor, lavaMask);
    float frost = pow(max(heightNorm - 0.6, 0.0) * 3.0, 2.0);
    color += vec3(0.18, 0.14, 0.04) * frost;
    float caldera = pow(max(0.3 - heightNorm, 0.0) * 4.0, 2.0);
    color -= vec3(0.1) * caldera;

  } else if (bodyType == 5) {
    // Ocean world: mostly water with sparse islands
    float seaLevel = 0.55;
    float landMask = smoothstep(seaLevel - 0.01, seaLevel + 0.03, heightNorm);
    vec3 ocean = mix(baseColor * 0.7, baseColor * 1.1, smoothstep(seaLevel - 0.3, seaLevel, heightNorm));
    vec3 land = mix(accentColor, accentColor * 0.7 + vec3(0.12, 0.1, 0.06), smoothstep(0.0, 0.5, heightNorm - seaLevel));
    color = mix(ocean, land, landMask);

  } else if (bodyType == 6) {
    // Carbon: dark with crystalline highlights
    color = mix(baseColor, accentColor, smoothstep(0.3, 0.6, heightNorm));
    float crystal = pow(max(heightNorm - 0.75, 0.0) * 5.0, 3.0);
    color += vec3(0.5, 0.55, 0.6) * crystal;

  } else if (bodyType == 7) {
    // Venus: subtle banding beneath clouds
    float lat = dir.y * noiseScale;
    float bands = sin(lat * 2.0) * 0.08 + sin(lat * 4.0) * 0.04;
    float val = heightNorm + bands;
    color = mix(baseColor, accentColor, clamp(val, 0.0, 1.0));

  } else {
    // Fallback
    color = mix(baseColor, accentColor, heightNorm);
  }

  outColor = vec4(color, 1.0);
  outHeight = vec4(heightNorm, heightNorm, heightNorm, 1.0);
}
`;

const BAKE_VERT = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// ── Channel baking shader ──
// Outputs RGBA: R=height, G=biome, B=detail, A=roughness
// These are INDEPENDENT noise channels — the display shader combines them
// with a palette to produce the final color. This preserves the "depth"
// that procedural shaders have from multiple noise sources.
const CHANNEL_BAKE_FRAG = /* glsl */ `
precision highp float;

out vec4 outChannels;
in vec2 vUv;

uniform float seed;
uniform float noiseScale;
uniform float bodyType;  // 0=rocky, 1=ice, 2=lava, 3=terrestrial, 4=volcanic, 5=ocean
uniform float seaLevel;  // height threshold for water (-1 = no ocean)
uniform float axialTilt; // radians, for latitude-based biomes

// ── 3D Simplex noise ──
${SNOISE}

vec3 equirectToDir(vec2 uv) {
  float theta = (uv.x - 0.5) * 2.0 * 3.14159265;
  float phi = (uv.y - 0.5) * 3.14159265;
  return vec3(cos(phi) * cos(theta), sin(phi), cos(phi) * sin(theta));
}

void main() {
  vec3 dir = equirectToDir(vUv);

  // Seed offsets for independent noise sampling per channel
  vec3 pH = dir * noiseScale + vec3(seed, seed * 0.7, seed * 1.3);
  vec3 pB = dir * noiseScale * 0.8 + vec3(seed + 100.0, seed * 1.4 + 50.0, seed * 0.9 + 200.0);
  vec3 pD = dir * noiseScale * 2.5 + vec3(seed * 1.7 + 300.0, seed * 0.3 + 400.0, seed + 500.0);

  float height = 0.0;
  float biome = 0.5;
  float detail = 0.5;
  float roughness = 0.5;

  if (bodyType > 2.5 && bodyType < 3.5) { // terrestrial
    // ══════════════════════════════════════════════════════════════
    // TERRESTRIAL — big continents, atmospheric circulation biomes
    // ══════════════════════════════════════════════════════════════

    // R: Continental terrain — big shapes with ragged coastlines
    // Low freq for continent-scale, but MORE high-freq octaves for
    // interesting coastlines (bays, peninsulas, archipelagos).
    float continent = snoise(pH * 0.4) * 0.48;    // continent-scale shapes
    continent += snoise(pH * 0.8) * 0.20;          // sub-continent variation
    continent += snoise(pH * 1.6) * 0.14;          // coastline raggedness
    continent += snoise(pH * 3.2) * 0.08;          // bays and peninsulas
    continent += snoise(pH * 6.4) * 0.05;          // fjords, islands
    continent += snoise(pH * 12.0) * 0.025;        // fine coastal detail
    height = clamp(continent * 0.5 + 0.5, 0.0, 1.0);

    float isLand = step(seaLevel, height);

    // ── Atmospheric circulation model ──
    // Latitude relative to axial tilt (0 = equator, 1 = pole)
    vec3 poleAxis = vec3(sin(axialTilt), cos(axialTilt), 0.0);
    float lat = abs(dot(dir, poleAxis));

    // ── Moisture model (drives biome selection) ──
    // Base moisture from latitude (atmospheric circulation),
    // then modified by continental position and elevation.

    // Continental interior dryness: large-scale noise determines
    // which parts of a continent are inland vs coastal-influenced.
    // This breaks the uniform latitude bands.
    float continentality = snoise(pB * 0.35) * 0.5 + 0.5; // 0=coastal-like, 1=deep inland
    continentality = continentality * isLand; // only on land

    // Latitude-based moisture tendency (simplified Hadley cells)
    // Instead of hard bands, use a smooth curve with noise perturbation
    float latMoisture = 0.5;
    // Tropical wet belt (ITCZ): peaks near equator
    latMoisture += 0.35 * exp(-lat * lat / (2.0 * 0.12 * 0.12));
    // Subtropical dry dip: Gaussian trough at ~0.25 latitude
    float dryDip = exp(-(lat - 0.27) * (lat - 0.27) / (2.0 * 0.08 * 0.08));
    latMoisture -= 0.45 * dryDip;
    // Temperate recovery
    latMoisture += 0.15 * exp(-(lat - 0.50) * (lat - 0.50) / (2.0 * 0.12 * 0.12));
    // Polar decline
    latMoisture -= 0.2 * smoothstep(0.65, 0.90, lat);

    // Continental interior is drier (deserts form inland, not at coasts)
    float moisture = latMoisture - continentality * 0.35;

    // Elevation: high ground is drier (rain shadow)
    float elevAboveSea = max(height - seaLevel, 0.0) / max(1.0 - seaLevel, 0.01);
    moisture -= smoothstep(0.3, 0.8, elevAboveSea) * 0.25;

    // Large-scale weather noise (breaks remaining band uniformity)
    moisture += snoise(pB * 0.6) * 0.12;
    moisture = clamp(moisture, 0.0, 1.0);

    // G: Encode biome — derived from moisture + latitude, not just latitude
    // Low G = hot/wet (tropical), mid-low G = hot/dry (desert),
    // mid G = temperate, high G = polar
    float temperature = 1.0 - lat;
    // Desert: hot AND dry (low moisture + subtropical latitude)
    float isDesert = (1.0 - moisture) * smoothstep(0.12, 0.22, lat) * (1.0 - smoothstep(0.40, 0.55, lat));
    // Build biome value from latitude, pushed toward desert where arid
    float biomeVal = lat;
    biomeVal = mix(biomeVal, 0.25, isDesert * 0.7);
    biome = clamp(biomeVal + snoise(pB * 0.4) * 0.06, 0.0, 1.0);

    // B: Vegetation density — driven by moisture + temperature (latitude)
    // (temperature already declared above)
    float vegBase = moisture * temperature; // need BOTH warmth and water for vegetation
    float vegNoise = snoise(pD * 1.0) * 0.15;
    detail = clamp(vegBase + vegNoise, 0.0, 1.0) * isLand;
    // Underwater: subtle ocean floor
    detail = mix(0.5, detail, isLand);

    // A: Roughness — land rough (slope-dependent), ocean smooth
    float slopeEst = abs(snoise(pH * 3.0 + vec3(0.05, 0.0, 0.0))
                       - snoise(pH * 3.0 - vec3(0.05, 0.0, 0.0)));
    roughness = isLand * (0.45 + slopeEst * 0.4) + (1.0 - isLand) * 0.12;
    roughness = clamp(roughness, 0.0, 1.0);

  } else if (bodyType < 0.5) { // rocky
    // ══════════════════════════════════════════════════════════════
    // ROCKY — cratered terrain, maria basins, highland/lowland
    // ══════════════════════════════════════════════════════════════

    // R: Multi-octave terrain
    height += snoise(pH * 0.4) * 0.45;
    height += snoise(pH * 1.0) * 0.28;
    height += snoise(pH * 2.0) * 0.14;
    height += snoise(pH * 4.0) * 0.07;
    height += snoise(pH * 8.0) * 0.035;
    height += snoise(pH * 16.0) * 0.018;
    height = clamp(height * 0.5 + 0.5, 0.0, 1.0);

    // G: Biome — correlated with height (maria fill basins) + independent variation
    float mariaBase = smoothstep(0.3, 0.6, height); // highlands = bright, basins = dark
    float indep = snoise(pB * 0.5) * 0.25;
    biome = clamp(mariaBase * 0.7 + indep + 0.15, 0.0, 1.0);

    // B: Surface roughness/crater detail
    detail = snoise(pD * 1.0) * 0.5 + 0.5;
    detail += snoise(pD * 2.0) * 0.15;
    detail = clamp(detail, 0.0, 1.0);

    // A: Slope-based roughness (rocky = uniformly rough)
    float slope = abs(snoise(pH * 2.0 + vec3(0.05, 0.0, 0.0))
                    - snoise(pH * 2.0 - vec3(0.05, 0.0, 0.0)));
    roughness = clamp(0.6 + slope * 0.3 + snoise(pD * 3.0) * 0.1, 0.0, 1.0);

  } else {
    // ══════════════════════════════════════════════════════════════
    // DEFAULT — generic FBM (placeholder for unimplemented types)
    // ══════════════════════════════════════════════════════════════
    height += snoise(pH * 0.4) * 0.45;
    height += snoise(pH * 1.0) * 0.28;
    height += snoise(pH * 2.0) * 0.14;
    height += snoise(pH * 4.0) * 0.07;
    height += snoise(pH * 8.0) * 0.035;
    height = clamp(height * 0.5 + 0.5, 0.0, 1.0);

    biome = snoise(pB * 0.5) * 0.5 + 0.5;
    detail = snoise(pD * 1.0) * 0.5 + 0.5;
    roughness = 0.5 + snoise(pD * 2.0) * 0.2;
  }

  outChannels = vec4(height, biome, detail, roughness);
}
`;

export class TextureBaker {
  constructor(renderer) {
    this._renderer = renderer;

    // Reusable baking infrastructure — created once
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._scene = new THREE.Scene();

    this._material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        seed: { value: 0.0 },
        noiseScale: { value: 4.0 },
        bodyType: { value: 0 },
        baseColor: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
        accentColor: { value: new THREE.Vector3(0.3, 0.3, 0.3) },
        noiseDetail: { value: 0.5 },
      },
      vertexShader: BAKE_VERT,
      fragmentShader: BAKE_FRAG,
    });

    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this._material,
    );
    this._scene.add(quad);
  }

  /**
   * Bake procedural textures for a body.
   *
   * @param {number} seed — unique seed for this body
   * @param {object} params
   * @param {number} params.noiseScale — noise frequency (default 4.0)
   * @param {number} params.bodyType — 0=rocky, 1=ice, 2=lava, 3=terrestrial, 4=volcanic, 5=ocean, 6=carbon, 7=venus
   * @param {number[]} params.baseColor — [r, g, b] 0-1
   * @param {number[]} params.accentColor — [r, g, b] 0-1
   * @returns {{ diffuseMap: THREE.Texture, heightMap: THREE.Texture, renderTarget: THREE.WebGLRenderTarget }}
   */
  bake(seed, params = {}) {
    const rt = new THREE.WebGLRenderTarget(BAKE_WIDTH, BAKE_HEIGHT, {
      count: 2,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.UnsignedByteType,
    });

    // Set uniforms for this body
    const u = this._material.uniforms;
    u.seed.value = seed;
    u.noiseScale.value = params.noiseScale ?? 4.0;
    u.bodyType.value = params.bodyType ?? 0;
    if (params.baseColor) u.baseColor.value.set(...params.baseColor);
    if (params.accentColor) u.accentColor.value.set(...params.accentColor);
    u.noiseDetail.value = params.noiseDetail ?? 0.5;

    // Bake — single draw call
    this._renderer.setRenderTarget(rt);
    this._renderer.render(this._scene, this._camera);
    this._renderer.setRenderTarget(null);

    return {
      diffuseMap: rt.textures[0],
      heightMap: rt.textures[1],
      renderTarget: rt,
    };
  }

  /**
   * Bake RGBA material channels for the MaterialBodyShader.
   * Single texture output:
   *   R = height, G = biome, B = detail, A = roughness
   *
   * @param {number} seed
   * @param {object} params — same as bake()
   * @returns {{ materialMap: THREE.Texture, renderTarget: THREE.WebGLRenderTarget }}
   */
  bakeChannels(seed, params = {}) {
    // Lazy-init the channel baking material
    if (!this._channelMaterial) {
      this._channelMaterial = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: {
          seed: { value: 0.0 },
          noiseScale: { value: 4.0 },
          bodyType: { value: 0 },
          seaLevel: { value: -1.0 },
          axialTilt: { value: 0.0 },
        },
        vertexShader: BAKE_VERT,
        fragmentShader: CHANNEL_BAKE_FRAG,
      });
      this._channelQuad = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        this._channelMaterial,
      );
      this._channelScene = new THREE.Scene();
      this._channelScene.add(this._channelQuad);
    }

    // Single RGBA render target (no MRT needed)
    const rt = new THREE.WebGLRenderTarget(BAKE_WIDTH, BAKE_HEIGHT, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.UnsignedByteType,
    });

    const u = this._channelMaterial.uniforms;
    u.seed.value = seed;
    u.noiseScale.value = params.noiseScale ?? 4.0;
    u.bodyType.value = params.bodyType ?? 0;
    u.seaLevel.value = params.seaLevel ?? -1.0;
    u.axialTilt.value = params.axialTilt ?? 0.0;

    console.log(`[TextureBaker] bakeChannels: bodyType=${u.bodyType.value}, seaLevel=${u.seaLevel.value}, noiseScale=${u.noiseScale.value}, seed=${seed.toFixed(1)}, axialTilt=${u.axialTilt.value.toFixed(2)}`);

    this._renderer.setRenderTarget(rt);
    this._renderer.render(this._channelScene, this._camera);
    this._renderer.setRenderTarget(null);

    // Debug: read back a sample of pixels to verify the texture has data
    const debugPixels = new Uint8Array(4 * 4); // 4 pixels
    this._renderer.readRenderTargetPixels(rt, 256, 256, 2, 2, debugPixels);
    console.log(`[TextureBaker] Sample pixels at (256,256): R=${debugPixels[0]} G=${debugPixels[1]} B=${debugPixels[2]} A=${debugPixels[3]} | R=${debugPixels[4]} G=${debugPixels[5]} B=${debugPixels[6]} A=${debugPixels[7]}`);

    return {
      materialMap: rt.texture,
      renderTarget: rt,
    };
  }

  dispose() {
    this._material.dispose();
    if (this._channelMaterial) this._channelMaterial.dispose();
  }
}

// ── Body type mapping ──
// Maps Planet.js type strings to baking shader bodyType ints
const BAKE_TYPE_MAP = {
  'rocky': 0,
  'ice': 1,
  'lava': 2,
  'terrestrial': 3,
  'volcanic': 4,
  'ocean': 5,
  'carbon': 6,
  'venus': 7,
  'captured': 0,
};

// Moon type mapping
const BAKE_MOON_TYPE_MAP = {
  'rocky': 0,
  'ice': 1,
  'volcanic': 4,
  'terrestrial': 3,
  'captured': 0,
};

export function getBakeType(typeString, isMoon = false) {
  if (isMoon) {
    return BAKE_MOON_TYPE_MAP[typeString] ?? 0;
  }
  return BAKE_TYPE_MAP[typeString] ?? 0;
}
