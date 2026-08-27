// src/worldengine/shaders/ringRelief.glsl.js — THE ONE PLANETARY RING, for both front-ends.
//
// F51 in the one-pipeline checklist, which scored it `LAB ✅ | GAME ❌ R` — the lab had a ring that
// rendered and the game had its own parallel one to delete. This module is that deletion.
//
// ⛔ WHAT THE GAME WAS DRAWING, AND WHY IT IS NOT A LOSS TO REPLACE IT. Planet.js `_createRing` drew
// two hardcoded sine waves — `sin(t*30.0)` and `sin(t*12.0)` — over a Cassini gap at a fixed
// fraction of the annulus. Identical on every planet in the galaxy, keyed to nothing: not the ring's
// composition, not its age, not its moons. Its `RingRenderer.js` replacement was written years ago
// and instantiated nowhere.
//
// ⭐ WHAT REPLACES IT is the lab's physics-driven body: real ringlets partitioned by real resonance
// gaps, coloured by what the ring is actually made of. Those gaps only started existing on
// 2026-08-27 — `deriveRingStructure` in PhysicsEngine.js, re-derived once a planet's moons exist —
// so this renderer is the first thing in the project able to draw one.
//
// ── THE BAND-LIMIT CLAMP, AND WHY THE RING NEEDED ONE ─────────────────────────────────────────────
// Max's ruling, 2026-08-26: a feature must span >= 4 RENDER px at the closest approach framing to
// READ as that feature. Rings were measured against it before any of this was built
// (docs/FEATURES/ring-resolvability-measurement-2026-08-26.md, tools/ring-resolvability-probe.mjs):
// the old sine banding crossed the 4px bar only above ~48 degrees of elevation on the median body,
// so roughly 74% of viewing directions failed it, and a ring is edge-on for most of its life.
// `uRingBandLimit` is the fbm-style screen fade generalised to the radial axis: as `fwidth(ringT)`
// grows — a pixel spanning many ringlets at a grazing angle — the per-ringlet density cross-fades
// toward the disk-wide mean, so fine structure DISSOLVES INTO TONE instead of moiréing against the
// 4x4 Bayer grid. ⭐ Max ruled the visual target directly: an edge-on ring should go smooth.
//
// ── ⚠ ONE DELIBERATE DIVERGENCE FROM THE LAB'S OLD COPY, AND IT IS A FIX ──────────────────────────
// The lab posterized its ring at a hardcoded `6.0` while the game has used the shared
// POSTERIZE_QUANTUM at 31 since 2026-08-21 (Max's ruling: 31 gives 32 values per channel = RGB555,
// the framebuffer depth of the N64/PlayStation/Saturn alike). So the lab's ring was showing 7 colour
// levels where the game showed 32 — a 5x cruder ring, and a lab/game divergence hiding inside the
// claim that the lab renders identically to the game. That claim was earned for the planet SURFACE,
// never for the ring. This module takes the game's vec2 B2P form, so the lab's ring gets finer and
// both sides quantise from ONE object. ⛔ The vec2 form is load-bearing — see posterizeLevels.js.
import * as THREE from 'three';

/** Uniform-array capacity. Both front-ends size their Float32Arrays from these. */
export const RING_MAX_RINGLETS = 16;
export const RING_MAX_GAPS = 8;

/**
 * Composition → base colour. ⭐ THIS IS THE HALF THE GAME HAS NEVER HAD: its ring took `color1`/
 * `color2` off `planetData.rings`, so an icy ring and a rocky one differed only by a palette the
 * generator happened to pick, never by what the ring is made of.
 */
export const RING_COMPOSITION_COLORS = Object.freeze({
  ice: [0.85, 0.92, 0.98],   // bright cyan-white
  rock: [0.35, 0.32, 0.30],  // dark grey
  dust: [0.55, 0.45, 0.35],  // brown-grey
  mixed: [0.60, 0.58, 0.55], // light grey
});

/**
 * Flatten a `generateRingPhysics` result into the uniform arrays the shader reads.
 *
 * ⛔ CPU-SIDE AND SHARED ON PURPOSE. This packing was written twice before — once in the dead
 * RingRenderer.js and once inline in the lab — and a third copy in Planet.js is exactly the debt the
 * one-pipeline program exists to pay down. Both front-ends call THIS.
 *
 * @param {object} physics  a `generateRingPhysics` result (`ringlets`, `gaps`, `density`)
 * @param {number} planetRadius  scene units per planet radius; physics radii are in planet radii
 * @returns {{ringletCount:number, ringletInnerR:Float32Array, ringletOuterR:Float32Array,
 *            ringletOpacity:Float32Array, ringletColors:Float32Array, gapCount:number,
 *            gapCenters:Float32Array, gapWidths:Float32Array, meanDensity:number}}
 */
export function ringUniformArraysFrom(physics, planetRadius) {
  const ringletInnerR = new Float32Array(RING_MAX_RINGLETS);
  const ringletOuterR = new Float32Array(RING_MAX_RINGLETS);
  const ringletOpacity = new Float32Array(RING_MAX_RINGLETS);
  const ringletColors = new Float32Array(RING_MAX_RINGLETS * 3);
  const gapCenters = new Float32Array(RING_MAX_GAPS);
  const gapWidths = new Float32Array(RING_MAX_GAPS);
  let ringletCount = 0;
  let gapCount = 0;
  let densitySum = 0;

  for (const rl of physics?.ringlets ?? []) {
    if (ringletCount >= RING_MAX_RINGLETS) break;
    if (rl.outerR - rl.innerR < 0.001) continue;   // degenerate sliver: nothing to draw
    const j = ringletCount;
    ringletInnerR[j] = planetRadius * rl.innerR;
    ringletOuterR[j] = planetRadius * rl.outerR;
    ringletOpacity[j] = rl.opacity * (physics.density ?? 1.0);
    const c = RING_COMPOSITION_COLORS[rl.composition] || RING_COMPOSITION_COLORS.mixed;
    ringletColors[j * 3] = c[0];
    ringletColors[j * 3 + 1] = c[1];
    ringletColors[j * 3 + 2] = c[2];
    densitySum += ringletOpacity[j];
    ringletCount++;
  }
  for (const g of physics?.gaps ?? []) {
    if (gapCount >= RING_MAX_GAPS) break;
    gapCenters[gapCount] = planetRadius * g.radius;
    gapWidths[gapCount] = planetRadius * g.width;
    gapCount++;
  }

  // ⭐ THE MEAN IS WHAT THE BAND-LIMIT FADES TOWARD, so it has to be the mean of what is actually
  // DRAWN — the ringlets' resolved opacities — and not a nominal density. Fading toward a value the
  // ring never has would make a grazing ring change brightness as it flattened, which is the very
  // artefact the clamp exists to remove. Zero ringlets means nothing renders, so the value is moot.
  const meanDensity = ringletCount > 0 ? densitySum / ringletCount : 0;

  return {
    ringletCount, ringletInnerR, ringletOuterR, ringletOpacity, ringletColors,
    gapCount, gapCenters, gapWidths, meanDensity,
  };
}

/** Build the uniform bag both front-ends hand to their ShaderMaterial. */
export function ringUniformsFrom({ physics, planetRadius, innerR, outerR, opacity, lightDir, posterizeQuantum }) {
  const a = ringUniformArraysFrom(physics, planetRadius);
  return {
    innerRadius: { value: innerR },
    outerRadius: { value: outerR },
    ringOpacity: { value: opacity },
    planetRadius: { value: planetRadius },
    lightDir: { value: lightDir || new THREE.Vector3(1, 0, 0) },
    uRingletCount: { value: a.ringletCount },
    uRingletInnerR: { value: a.ringletInnerR },
    uRingletOuterR: { value: a.ringletOuterR },
    uRingletOpacity: { value: a.ringletOpacity },
    uRingletColors: { value: a.ringletColors },
    uGapCount: { value: a.gapCount },
    uGapCenters: { value: a.gapCenters },
    uGapWidths: { value: a.gapWidths },
    uRingMeanDensity: { value: a.meanDensity },
    uPosterizeLevels: posterizeQuantum,
    // Moon-cleared gaps stay a separate channel from resonance gaps: they are set AFTER moons are
    // placed in the scene (Planet.js setRingGaps), and a shepherd moon sitting inside the annulus is
    // a different fact from a resonance carved at 2:1. The game drives these; the lab leaves them 0.
    moonGapCount: { value: 0 },
    moonGapRadii: { value: new Float32Array(6) },
    moonGapWidths: { value: new Float32Array(6) },
  };
}

/** Vertex shader. Byte-identical to what BOTH front-ends already had — it was never the divergence. */
export const RING_VERTEX_GLSL = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vPos;
varying vec3 vRelWorldPos;
void main() {
  vPos = position;
  // Planet-relative world position: subtract the planet centre so the shadow test below works
  // wherever the body is in its orbit.
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vec3 planetCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vRelWorldPos = worldPos.xyz - planetCenter;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

export const RING_FRAGMENT_GLSL = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform float innerRadius;
uniform float outerRadius;
uniform float ringOpacity;
uniform float planetRadius;
uniform vec3  lightDir;
uniform vec2  uPosterizeLevels;

const int RING_MAX_RINGLETS = ${RING_MAX_RINGLETS};
uniform int   uRingletCount;
uniform float uRingletInnerR[${RING_MAX_RINGLETS}];
uniform float uRingletOuterR[${RING_MAX_RINGLETS}];
uniform float uRingletOpacity[${RING_MAX_RINGLETS}];
uniform float uRingletColors[${RING_MAX_RINGLETS * 3}];

const int RING_MAX_GAPS = ${RING_MAX_GAPS};
uniform int   uGapCount;
uniform float uGapCenters[${RING_MAX_GAPS}];
uniform float uGapWidths[${RING_MAX_GAPS}];
uniform float uRingMeanDensity;

const int MAX_MOON_GAPS = 6;
uniform int   moonGapCount;
uniform float moonGapRadii[6];
uniform float moonGapWidths[6];

varying vec3 vPos;
varying vec3 vRelWorldPos;

float ringBayerDither(vec2 coord) {
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

// levels.x is the quantum, levels.y its CPU-carried float32 reciprocal — a vec2 so the compiler
// cannot re-fold the reciprocal into a divide. The parentheses are load-bearing; posterizeLevels.js
// records the 12,582,912-sample measurement behind that.
vec3 ringPosterize(vec3 color, vec2 levels, vec2 fragCoord, float edgeWidth) {
  float dither = ringBayerDither(fragCoord) - 0.5;
  vec3 dithered = color + dither * (edgeWidth * levels.y);
  return floor(dithered * levels.x + 0.5) * levels.y;
}

void main() {
  #include <logdepthbuf_fragment>
  float dist = length(vPos.xz);
  float ringT = (dist - innerRadius) / max(1e-6, outerRadius - innerRadius);

  // ── THE BAND-LIMIT CLAMP ────────────────────────────────────────────────────────────────────────
  // The radial sampling rate in normalized-t units. At a grazing angle one pixel spans many
  // ringlets, fwidth(ringT) blows up, and fine bands cross-fade toward their mean rather than
  // moiréing against the 4x4 Bayer grid below. This is the ring's half of Max's >= 4 render px
  // ruling, and it binds NEAR exactly as the terrain's fwidth fade does.
  float ringBandLimit = clamp(fwidth(ringT) * 8.0, 0.0, 1.0);

  // ── Physics-driven ringlet / gap body ───────────────────────────────────────────────────────────
  float density = 0.0;
  vec3 color = vec3(uRingletColors[0], uRingletColors[1], uRingletColors[2]);
  for (int i = 0; i < RING_MAX_RINGLETS; i++) {
    if (i >= uRingletCount) break;
    if (dist >= uRingletInnerR[i] && dist <= uRingletOuterR[i]) {
      float rlT = (dist - uRingletInnerR[i]) / max(0.001, uRingletOuterR[i] - uRingletInnerR[i]);
      float edgeFade = smoothstep(0.0, 0.08, rlT) * (1.0 - smoothstep(0.92, 1.0, rlT));
      density = max(density, uRingletOpacity[i] * edgeFade);
      int ci = i * 3;
      color = vec3(uRingletColors[ci], uRingletColors[ci + 1], uRingletColors[ci + 2]);
    }
  }

  // Resonance gaps — where a moon's 2:1 or 3:1 resonance has swept the disk clear.
  for (int i = 0; i < RING_MAX_GAPS; i++) {
    if (i >= uGapCount) break;
    density *= smoothstep(0.0, uGapWidths[i], abs(dist - uGapCenters[i]));
  }

  // Fade per-ringlet structure toward the disk-wide baseline as bands go sub-pixel. The DOMINANT
  // gap survives this (it is wide) while the fine banding dissolves, which is the intended reading:
  // an edge-on ring goes smooth rather than shimmering.
  density = mix(density, uRingMeanDensity, ringBandLimit);

  float alpha = density * ringOpacity;

  // Soft inner and outer edges.
  alpha *= smoothstep(0.0, 0.08, ringT) * (1.0 - smoothstep(0.92, 1.0, ringT));

  // Shepherd-moon gaps (a moon ORBITING inside the annulus, distinct from a resonance).
  for (int i = 0; i < MAX_MOON_GAPS; i++) {
    if (i >= moonGapCount) break;
    alpha *= smoothstep(0.0, moonGapWidths[i], abs(dist - moonGapRadii[i]));
  }

  // Planet shadow on the ring — analytic cylinder test along the light direction.
  float shadowDist = length(cross(vRelWorldPos, lightDir));
  float behindPlanet = step(dot(vRelWorldPos, lightDir), 0.0);
  float inShadow = behindPlanet * (1.0 - smoothstep(planetRadius * 0.9, planetRadius * 1.1, shadowDist));
  float ringLight = 1.0 - inShadow;
  color *= ringLight;
  // Shadow drops alpha too, so a shadowed ring does not paint opaque black over the stars behind it.
  alpha *= mix(0.15, 1.0, ringLight);

  if (ringBayerDither(gl_FragCoord.xy) > alpha) discard;

  color = ringPosterize(color, uPosterizeLevels, gl_FragCoord.xy, 0.4);
  gl_FragColor = vec4(color, 1.0);
}
`;
