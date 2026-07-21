/**
 * componentOrbit — pure derivation of a component's barycentric orbit arc
 * (BN3 of multistar-component-travel-2026-07-21, AC6-component-orbit-render).
 *
 * WHAT: turns a `systemData.componentSystems[idx]` WRAPPER entry's scalar
 * `separationAU` (the wrapper carries it; the inner systemData does NOT —
 * StarSystemGenerator's emission shape) into a renderable near-ARC spec:
 * vertex positions in COMPONENT-LOCAL coordinates plus a per-vertex edge-fade
 * profile. Consumed by `src/objects/OrbitArc.js`; the spawnSystem consumption
 * next to the binary starOrbitLines block is GB6 (gated on lane B landing).
 *
 * WHY AN ARC IN LOCAL COORDINATES (all three are load-bearing, trace 2):
 *   1. float32 — a circle centered on the barycenter at R = separationAU ×
 *      AU_TO_SCENE (Proxima: 13,000 AU → 1.3e7 scene units) quantizes vertices
 *      by ~1–2 scene units at that magnitude — BIGGER than an M-dwarf's
 *      ~0.7-unit scene radius, i.e. visible jitter. Emitting only the arc
 *      NEAR the component, with vertices near the local origin (≤ camera-far
 *      magnitudes), keeps float32 error sub-milli-unit. This is the fix,
 *      not an optimization.
 *   2. clipping — the camera far plane (200,000 units, main.js camera ctor)
 *      clips everything beyond ~±200 AU anyway; generating the full circle
 *      (~115k vertices under OrbitLine's segment formula) buys nothing.
 *   3. the look — over the visible span the circle deviates only ~1,540 units
 *      laterally (R=13e6): Max's predicted "it will probably seem like just a
 *      straight line" is a geometric consequence, pinned in the tests.
 *
 * BARYCENTER APPROXIMATION (deliberate): orbit radius = full separationAU,
 * i.e. the barycenter is approximated AT the sibling pair. Right for Proxima
 * (the A+B pair holds nearly all the mass), coarser for near-equal-mass pairs
 * (36 Oph C, Zet-2 Ret) — but the payload carries no masses, and at these
 * radii the on-screen difference is below the sagitta. Documented in
 * componentOrbit.test.js so AC9's diff review reads it as intended.
 *
 * FAR-PLANE EDGE TREATMENT (design decision): the arc FADES to zero alpha
 * over its outer span (COMPONENT_ORBIT_FADE_START → 1.0 of the half-span)
 * instead of ending full-brightness at the clip boundary — a hard edge at
 * camera.far would read as a bug in UAT. OrbitArc turns the fade profile
 * into per-vertex alpha.
 *
 * DIRECTION IS A PARAMETER: the payload carries only a scalar separationAU —
 * no direction to the sibling. Orientation depends on AC1's sky/scene
 * decision; at consumption time (GB6) RealStarCatalog positions supply the
 * true 3D direction. Default +X keeps the helper total and deterministic.
 *
 * Pure module: no THREE import, no scene state, no main.js coupling —
 * the componentIdentity.js lane-C precedent.
 */

/**
 * Mirrors main.js's camera far plane (`new THREE.PerspectiveCamera(fov,
 * aspect, 1e-9, 200000)`). GB6's consumption may pass the live value via
 * `options.cameraFar` if the camera ever changes; this constant is the
 * documented default, not a second source of truth main.js reads.
 */
export const CAMERA_FAR_SCENE = 200000;

/**
 * Arc segment count (vertices = segments + 1, odd so the exact midpoint —
 * the component star itself — is a vertex). 256 keeps per-chord sagitta
 * error < ~0.1 scene units at the smallest authored radius (3.75e6), well
 * under any body radius, at ~0.2% of the vertex count a naive full circle
 * would carry.
 */
export const COMPONENT_ORBIT_SEGMENTS = 256;

/**
 * Fraction of the half-span at which the edge fade begins. Inside this the
 * arc renders at full brightness; outside, alpha smoothsteps to 0 at the
 * arc ends (the far-plane edge treatment).
 */
export const COMPONENT_ORBIT_FADE_START = 0.55;

// AU → scene conversion. Kept as a local re-export-free import so this module
// tracks the single scale source of truth.
import { AU_TO_SCENE } from '../core/ScaleConstants.js';

/**
 * Derive the near-arc spec for a component's own barycentric orbit.
 *
 * Geometry: the component sits ON a circle of radius R = separationAU ×
 * AU_TO_SCENE centered on the (approximated) barycenter, which lies at
 * distance R along `siblingDirection` from the component-local origin.
 * Parameterizing the circle by the angle φ from the component's position:
 *
 *   vertex(φ) = R·(1 − cos φ)·d̂  +  R·sin φ·t̂
 *
 * with d̂ the unit barycenter direction and t̂ a unit tangent ⊥ d̂ in the
 * orbit plane. φ = 0 is exactly the local origin (the star); the arc spans
 * φ ∈ [−φmax, +φmax] with φmax = halfSpan / R, halfSpan clamped to the
 * camera far plane (and to a quarter-circle for degenerate small radii).
 *
 * @param {object|null|undefined} parentSystemData — the PARENT system payload
 *   (the wrapper array lives here; component-scene callers pass the parent).
 * @param {number} idx — index into componentSystems.
 * @param {object} [options]
 * @param {{x:number,y:number,z:number}} [options.siblingDirection] — unit-ish
 *   vector from the component TOWARD the barycenter/sibling (THREE.Vector3
 *   works). Non-unit vectors are normalized; degenerate ones fall back to +X.
 * @param {number} [options.cameraFar=CAMERA_FAR_SCENE] — clip-aware span bound.
 * @param {number} [options.segments=COMPONENT_ORBIT_SEGMENTS] — arc segments.
 * @returns {null | {
 *   componentName: string,
 *   separationAU: number,
 *   radiusScene: number,
 *   halfSpanScene: number,
 *   sagittaScene: number,
 *   vertexCount: number,
 *   positions: Float32Array,
 *   fades: Float32Array,
 * }} null for non-component systems / invalid indices (the AC6 headless
 *   observable: procgen and non-component authored systems derive nothing).
 */
export function deriveComponentOrbitSpec(parentSystemData, idx, options = {}) {
  const comps = parentSystemData?.componentSystems;
  if (!Array.isArray(comps) || !Number.isInteger(idx) || idx < 0 || idx >= comps.length) {
    return null;
  }
  const wrapper = comps[idx];
  const separationAU = wrapper?.separationAU;
  if (!(typeof separationAU === 'number' && Number.isFinite(separationAU) && separationAU > 0)) {
    return null;
  }

  const radiusScene = separationAU * AU_TO_SCENE;
  const cameraFar = (typeof options.cameraFar === 'number' && options.cameraFar > 0)
    ? options.cameraFar : CAMERA_FAR_SCENE;
  const segments = clampSegments(options.segments);

  // Clip-aware near-arc extent: never generate beyond the far plane, and
  // never wrap past a quarter-circle each side (guards hypothetical small
  // separations without ever emitting overlapping geometry).
  const halfSpanScene = Math.min(cameraFar, radiusScene * Math.PI / 2);
  const phiMax = halfSpanScene / radiusScene;

  const { d, t } = orbitBasis(options.siblingDirection);

  const vertexCount = segments + 1;
  const positions = new Float32Array(vertexCount * 3);
  const fades = new Float32Array(vertexCount);

  for (let i = 0; i < vertexCount; i++) {
    // φ sweeps −φmax → +φmax; segments is even, so i = segments/2 lands on
    // φ = 0 exactly — the component star is literally strung on its orbit.
    const phi = -phiMax + (2 * phiMax * i) / segments;
    const along = radiusScene * (1 - Math.cos(phi)); // toward the barycenter, ≥ 0
    const lateral = radiusScene * Math.sin(phi);
    positions[i * 3] = along * d.x + lateral * t.x;
    positions[i * 3 + 1] = along * d.y + lateral * t.y;
    positions[i * 3 + 2] = along * d.z + lateral * t.z;
    fades[i] = edgeFade(Math.abs(phi) / phiMax);
  }
  // Pin the midpoint to the exact origin — the float math above already lands
  // there (cos 0 = 1, sin 0 = 0), this is belt-and-braces for -0 signage.
  const mid = (segments / 2) * 3;
  positions[mid] = 0;
  positions[mid + 1] = 0;
  positions[mid + 2] = 0;

  return {
    componentName: typeof wrapper.name === 'string' ? wrapper.name : null,
    separationAU,
    radiusScene,
    halfSpanScene,
    // Analytic max deviation from the tangent line over the visible span —
    // the "near-straight" number (~1,538 units at R=13e6, halfSpan=200,000).
    sagittaScene: radiusScene * (1 - Math.cos(phiMax)),
    vertexCount,
    positions,
    fades,
  };
}

/** Segments: even (midpoint-vertex invariant), bounded to a sane range. */
function clampSegments(segments) {
  let s = Number.isInteger(segments) && segments > 0 ? segments : COMPONENT_ORBIT_SEGMENTS;
  s = Math.max(16, Math.min(1024, s));
  if (s % 2 === 1) s += 1;
  return s;
}

/**
 * Orthonormal orbit-plane basis from the sibling direction.
 * d̂ — toward the barycenter; t̂ — lateral tangent (horizontal when d̂ allows,
 * arbitrary-but-stable perpendicular otherwise). Degenerate/absent input
 * falls back to +X so the helper stays total.
 */
function orbitBasis(siblingDirection) {
  let dx = siblingDirection?.x, dy = siblingDirection?.y, dz = siblingDirection?.z;
  let len = Math.hypot(dx ?? 0, dy ?? 0, dz ?? 0);
  if (!(Number.isFinite(len) && len > 1e-12)) {
    dx = 1; dy = 0; dz = 0; len = 1;
  }
  const d = { x: dx / len, y: dy / len, z: dz / len };

  // t̂ = normalize(ŷ × d̂): horizontal, perpendicular to d̂. Degenerate when
  // d̂ is (anti)parallel to ŷ — fall back to ẑ (any perpendicular works;
  // the arc is symmetric in ±t̂).
  let tx = d.z, ty = 0, tz = -d.x; // ŷ × d̂ = (d.z, 0, −d.x)
  const tLen = Math.hypot(tx, ty, tz);
  if (tLen > 1e-9) {
    tx /= tLen; tz /= tLen;
  } else {
    tx = 0; ty = 0; tz = 1;
  }
  return { d, t: { x: tx, y: ty, z: tz } };
}

/**
 * Edge fade: 1.0 inside COMPONENT_ORBIT_FADE_START of the half-span, then a
 * smoothstep down to exactly 0 at the arc ends (u = 1).
 * @param {number} u — normalized |φ|/φmax ∈ [0, 1]
 */
function edgeFade(u) {
  if (u <= COMPONENT_ORBIT_FADE_START) return 1;
  const t = Math.min(1, (u - COMPONENT_ORBIT_FADE_START) / (1 - COMPONENT_ORBIT_FADE_START));
  return 1 - t * t * (3 - 2 * t);
}
