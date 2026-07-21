/**
 * componentOrbit + OrbitArc — BN3 of multistar-component-travel-2026-07-21
 * (AC6-component-orbit-render, headless half).
 *
 * deriveComponentOrbitSpec is the pure lane-C helper (componentIdentity.js
 * precedent) that turns a componentSystems WRAPPER entry's separationAU into
 * a renderable near-ARC spec; OrbitArc is the scene class that consumes it
 * (mesh/addTo/dispose parity with OrbitLine so the GB6 spawnSystem consumption
 * is a drop-in next to the binary starOrbitLines block).
 *
 * WHY AN ARC AND NOT AN OrbitLine CIRCLE (trace 2, pinned here):
 *   - A full circle at R = 13e6 scene units (Proxima: 13,000 AU x AU_TO_SCENE
 *     1000) would carry ~115k vertices under OrbitLine's segment formula.
 *   - float32 vertex quantization at 1.3e7 magnitude is ~1-2 scene units --
 *     BIGGER than an M-dwarf's ~0.7-unit scene radius (visible jitter). The
 *     fix is COMPONENT-LOCAL coordinates: the arc's vertices stay small,
 *     near the component's own origin. Load-bearing, not an optimization.
 *   - The camera far plane (200,000 units, main.js camera ctor) clips all but
 *     a ~+/-200 AU near-arc anyway; over that span the circle deviates only
 *     ~1,540 units laterally -- Max's predicted "straight line".
 *
 * BARYCENTER APPROXIMATION (deliberate, so AC9's diff review doesn't flag it
 * as accidental): the orbit radius is taken as the full separationAU -- i.e.
 * the barycenter is approximated AT the sibling pair. Fine for Proxima
 * (M5.5Ve vs A+B: the pair holds nearly all the mass), less exact for the
 * near-equal-mass 36 Oph C / Zet-2 Ret cases, where the true barycenter sits
 * a substantial fraction toward the midpoint. The payload carries only a
 * scalar separationAU (no masses), and at these radii the on-screen
 * difference is sub-sagitta -- revisit only if masses ever land in the
 * wrapper.
 *
 * FAR-PLANE EDGE TREATMENT (design decision, pinned by the fade tests):
 * opacity fade along the arc (per-vertex alpha ramp to 0 over the outer span)
 * rather than a hard cap inside far -- a full-brightness line ending abruptly
 * at the clip boundary reads as a bug in UAT.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  deriveComponentOrbitSpec,
  COMPONENT_ORBIT_SEGMENTS,
  COMPONENT_ORBIT_FADE_START,
  CAMERA_FAR_SCENE,
} from '../componentOrbit.js';
import { OrbitArc } from '../../objects/OrbitArc.js';
import { OrbitLine } from '../../objects/OrbitLine.js';
import { AU_TO_SCENE } from '../../core/ScaleConstants.js';
import { STELLAR_COMPANIONS } from '../data/stellarCompanions.js';
import { KnownSystems } from '../KnownSystems.js';
import { generateAuthoredSystem } from '../KnownSystemAuthoring.js';
import {
  worldOrigin,
  maybeRebase,
  resetWorldOrigin,
  placeInRebasedFrame,
} from '../../core/WorldOrigin.js';

// ── Fixtures ──────────────────────────────────────────────────────────────

// Wrapper-shaped parent payloads built from the authored companion table (the
// single separation source of truth) — the helper reads ONLY the wrapper
// fields (separationAU lives on the WRAPPER, not inner systemData).
function parentFromTable(entryName) {
  const entry = STELLAR_COMPANIONS.find((e) => e.name === entryName);
  return {
    componentSystems: entry.farCompanions.map((fc, i) => ({
      name: fc.name,
      class: fc.class,
      type: 'M',
      separationAU: fc.separationAU,
      seed: `${entryName}:component-${i}:x`,
      systemData: { star: { type: 'M' }, planets: [] },
    })),
  };
}

// The three authored separations (stellarCompanions.js): Proxima 13,000 AU,
// HD 156026 4,400 AU, Zet-2 Ret 3,750 AU → radii 13e6 / 4.4e6 / 3.75e6.
const AUTHORED = [
  { entry: 'Alpha Centauri', component: 'Proxima Centauri', separationAU: 13000, radiusScene: 13e6 },
  { entry: 'Guniibuu', component: 'HD 156026', separationAU: 4400, radiusScene: 4.4e6 },
  { entry: 'Zet-1 Ret', component: 'Zet-2 Ret', separationAU: 3750, radiusScene: 3.75e6 },
];

const specFor = (a, options) =>
  deriveComponentOrbitSpec(parentFromTable(a.entry), 0, options);

// Max |single coordinate| and max vertex vector magnitude over the arc.
function vertexExtremes(spec) {
  let maxCoord = 0;
  let maxMagSq = 0;
  const p = spec.positions;
  for (let i = 0; i < spec.vertexCount; i++) {
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    maxCoord = Math.max(maxCoord, Math.abs(x), Math.abs(y), Math.abs(z));
    maxMagSq = Math.max(maxMagSq, x * x + y * y + z * z);
  }
  return { maxCoord, maxMag: Math.sqrt(maxMagSq) };
}

// Max displacement along a (unit) direction over the arc — the geometric
// sagitta when the direction is the barycenter direction.
function maxAlong(spec, dx, dy, dz) {
  let m = -Infinity;
  const p = spec.positions;
  for (let i = 0; i < spec.vertexCount; i++) {
    m = Math.max(m, p[i * 3] * dx + p[i * 3 + 1] * dy + p[i * 3 + 2] * dz);
  }
  return m;
}

// ── (1) component-local vertex bounds — THE float32 fix ─────────────────────

describe('deriveComponentOrbitSpec — component-local coordinates bound every vertex (float32 fix)', () => {
  it.each(AUTHORED)('$entry / $component (separation $separationAU AU → R $radiusScene)', (a) => {
    const spec = specFor(a);
    expect(spec).not.toBeNull();
    expect(spec.componentName).toBe(a.component);
    expect(spec.separationAU).toBe(a.separationAU);
    // Radius = separationAU × AU_TO_SCENE — the documented barycenter
    // approximation (barycenter AT the sibling; see module header).
    expect(spec.radiusScene).toBe(a.separationAU * AU_TO_SCENE);
    expect(spec.radiusScene).toBe(a.radiusScene);

    // Every vertex coordinate is bounded WELL under the float32 hazard scale
    // (~1e7, where quantization exceeds an M-dwarf radius) and inside the
    // camera far plane. Vertices live near the component-local origin.
    const { maxCoord, maxMag } = vertexExtremes(spec);
    expect(maxCoord).toBeLessThan(4e5);
    expect(maxMag).toBeLessThanOrEqual(CAMERA_FAR_SCENE + 1e-6);
    // …and float32 quantization at that magnitude is sub-milli-unit scale,
    // far below any body radius (the jitter hazard is gone by construction).
    expect(maxCoord * Math.pow(2, -23)).toBeLessThan(0.05);
  });

  it('the arc passes exactly through the component star (local origin is a vertex)', () => {
    const spec = specFor(AUTHORED[0]);
    const mid = Math.floor(spec.vertexCount / 2) * 3;
    expect(spec.positions[mid]).toBe(0);
    expect(spec.positions[mid + 1]).toBe(0);
    expect(spec.positions[mid + 2]).toBe(0);
  });

  it('derivation is pure — the parent payload is not mutated', () => {
    const parent = parentFromTable('Alpha Centauri');
    const before = JSON.stringify(parent);
    deriveComponentOrbitSpec(parent, 0);
    expect(JSON.stringify(parent)).toBe(before);
  });

  it('works against the REAL generated Alpha Centauri payload (not just fixtures)', () => {
    const entry = KnownSystems.getAll().find((k) => k.name === 'Alpha Centauri');
    const systemData = generateAuthoredSystem(entry, null);
    const spec = deriveComponentOrbitSpec(systemData, 0);
    expect(spec).not.toBeNull();
    expect(spec.componentName).toBe('Proxima Centauri');
    expect(spec.radiusScene).toBe(13e6);
  });
});

// ── (2) non-component systems → null (the AC6 headless observable) ──────────

describe('deriveComponentOrbitSpec — null for non-component systems', () => {
  it('returns null for payloads without componentSystems (procgen / Sirius shape)', () => {
    expect(deriveComponentOrbitSpec({ star: { type: 'G' }, planets: [] }, 0)).toBeNull();
    expect(deriveComponentOrbitSpec({}, 0)).toBeNull();
  });

  it('returns null for degenerate inputs without throwing', () => {
    expect(deriveComponentOrbitSpec(null, 0)).toBeNull();
    expect(deriveComponentOrbitSpec(undefined, 0)).toBeNull();
  });

  it('returns null for out-of-range / invalid indices', () => {
    const parent = parentFromTable('Alpha Centauri'); // 1 component
    expect(deriveComponentOrbitSpec(parent, 1)).toBeNull();
    expect(deriveComponentOrbitSpec(parent, -1)).toBeNull();
    expect(deriveComponentOrbitSpec(parent, 1.5)).toBeNull();
  });

  it('returns null for a wrapper with a missing/invalid separationAU', () => {
    const parent = parentFromTable('Alpha Centauri');
    delete parent.componentSystems[0].separationAU;
    expect(deriveComponentOrbitSpec(parent, 0)).toBeNull();
    parent.componentSystems[0].separationAU = 0;
    expect(deriveComponentOrbitSpec(parent, 0)).toBeNull();
    parent.componentSystems[0].separationAU = NaN;
    expect(deriveComponentOrbitSpec(parent, 0)).toBeNull();
  });
});

// ── (3) vertex count capped — never the 115k-vertex geometry ────────────────

describe('deriveComponentOrbitSpec — vertex count is capped and radius-independent', () => {
  it('all three authored radii emit the same small vertex count', () => {
    const counts = AUTHORED.map((a) => specFor(a).vertexCount);
    expect(counts[0]).toBe(counts[1]);
    expect(counts[1]).toBe(counts[2]);
    expect(counts[0]).toBe(COMPONENT_ORBIT_SEGMENTS + 1);
    // OrbitLine's segment formula at R=13e6 would emit ~115,378 vertices;
    // the arc stays orders of magnitude under that. (Deliberately NOT
    // instantiating OrbitLine(13e6) here — trace 2 risk.)
    expect(counts[0]).toBeLessThan(1100);
    expect(specFor(AUTHORED[0]).positions.length).toBe(counts[0] * 3);
  });
});

// ── (4) direction parameter rotates the arc ─────────────────────────────────

describe('deriveComponentOrbitSpec — siblingDirection orients the arc', () => {
  it('default direction is +X: sagitta bulges toward +X, lateral span in Z, flat in Y', () => {
    const spec = specFor(AUTHORED[0]);
    const p = spec.positions;
    let minX = Infinity, maxAbsZ = 0;
    for (let i = 0; i < spec.vertexCount; i++) {
      minX = Math.min(minX, p[i * 3]);
      maxAbsZ = Math.max(maxAbsZ, Math.abs(p[i * 3 + 2]));
      expect(p[i * 3 + 1]).toBe(0); // horizontal orbit plane
    }
    expect(minX).toBeGreaterThanOrEqual(0);           // bulge only TOWARD the barycenter
    // Precision 3 (5e-4): positions are float32-stored — ulp ≈ 1.2e-4 at
    // magnitude ~1540. Sub-milli-unit agreement IS the component-local win.
    expect(maxAlong(spec, 1, 0, 0)).toBeCloseTo(spec.sagittaScene, 3);
    expect(maxAbsZ).toBeGreaterThan(1e5);             // the lateral near-arc span
  });

  it('direction (0,0,1) is the +X arc rotated 90° about Y', () => {
    const specX = specFor(AUTHORED[0]);
    const specZ = specFor(AUTHORED[0], { siblingDirection: { x: 0, y: 0, z: 1 } });
    for (let i = 0; i < specX.vertexCount; i++) {
      // Rotation about Y mapping +X → +Z: (x, y, z) → (−z, y, x).
      expect(specZ.positions[i * 3]).toBeCloseTo(-specX.positions[i * 3 + 2], 4);
      expect(specZ.positions[i * 3 + 1]).toBeCloseTo(specX.positions[i * 3 + 1], 4);
      expect(specZ.positions[i * 3 + 2]).toBeCloseTo(specX.positions[i * 3], 4);
    }
  });

  it('non-unit directions are normalized (2,0,0 ≡ 1,0,0)', () => {
    const a = specFor(AUTHORED[0], { siblingDirection: { x: 2, y: 0, z: 0 } });
    const b = specFor(AUTHORED[0]);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
  });

  it('a THREE.Vector3 direction works (GB6 will supply catalog-derived vectors)', () => {
    const spec = specFor(AUTHORED[0], { siblingDirection: new THREE.Vector3(0, 0, 1) });
    expect(maxAlong(spec, 0, 0, 1)).toBeCloseTo(spec.sagittaScene, 3); // float32-stored, see above

  });

  it('degenerate directions never NaN: vertical (0,1,0) and zero-length fall back safely', () => {
    const vertical = specFor(AUTHORED[0], { siblingDirection: { x: 0, y: 1, z: 0 } });
    expect(vertical).not.toBeNull();
    for (const v of vertical.positions) expect(Number.isFinite(v)).toBe(true);
    expect(maxAlong(vertical, 0, 1, 0)).toBeCloseTo(vertical.sagittaScene, 3); // float32-stored

    const zero = specFor(AUTHORED[0], { siblingDirection: { x: 0, y: 0, z: 0 } });
    expect(Array.from(zero.positions)).toEqual(Array.from(specFor(AUTHORED[0]).positions));
  });
});

// ── (5) OrbitArc — mesh/addTo/dispose contract parity with OrbitLine ────────

describe('OrbitArc — scene-class contract parity with OrbitLine (GB6 drop-in)', () => {
  const makeArc = () => new OrbitArc(specFor(AUTHORED[0]), 0x00dd00);

  it('exposes the OrbitLine surface: mesh (Object3D), addTo(scene), dispose()', () => {
    const line = new OrbitLine(40, 0x00dd00);
    const arc = makeArc();
    for (const obj of [line, arc]) {
      expect(obj.mesh).toBeInstanceOf(THREE.Object3D);
      expect(typeof obj.addTo).toBe('function');
      expect(typeof obj.dispose).toBe('function');
    }
    line.dispose();
    arc.dispose();
  });

  it('addTo adds the mesh to the scene; mesh.visible is settable (O-toggle contract)', () => {
    const scene = new THREE.Scene();
    const arc = makeArc();
    arc.addTo(scene);
    expect(scene.children).toContain(arc.mesh);
    arc.mesh.visible = false;
    expect(arc.mesh.visible).toBe(false);
    arc.dispose();
  });

  it('dispose disposes both geometry and material (leak parity with OrbitLine)', () => {
    const arc = makeArc();
    let geoDisposed = false, matDisposed = false;
    arc.mesh.geometry.addEventListener('dispose', () => { geoDisposed = true; });
    arc.mesh.material.addEventListener('dispose', () => { matDisposed = true; });
    arc.dispose();
    expect(geoDisposed).toBe(true);
    expect(matDisposed).toBe(true);
  });

  it('is an OPEN arc (THREE.Line, never LineLoop — a closed 13M-unit loop would chord across the sky)', () => {
    const arc = makeArc();
    expect(arc.mesh).toBeInstanceOf(THREE.Line);
    expect(arc.mesh).not.toBeInstanceOf(THREE.LineLoop);
    arc.dispose();
  });

  it('geometry carries the spec positions verbatim (component-local, no re-derivation)', () => {
    const spec = specFor(AUTHORED[0]);
    const arc = new OrbitArc(spec, 0x00dd00);
    const posAttr = arc.mesh.geometry.getAttribute('position');
    expect(posAttr.count).toBe(spec.vertexCount);
    expect(posAttr.array).toBe(spec.positions);
    arc.dispose();
  });

  it('far-plane edge treatment: per-vertex ALPHA fade (RGBA color attribute), transparent material', () => {
    const spec = specFor(AUTHORED[0]);
    const arc = new OrbitArc(spec, 0x00dd00);
    const colorAttr = arc.mesh.geometry.getAttribute('color');
    expect(colorAttr.itemSize).toBe(4); // RGBA → three.js USE_COLOR_ALPHA path
    expect(arc.mesh.material.vertexColors).toBe(true);
    expect(arc.mesh.material.transparent).toBe(true);
    // Alpha channel IS the spec fade profile.
    for (let i = 0; i < spec.vertexCount; i++) {
      expect(colorAttr.array[i * 4 + 3]).toBeCloseTo(spec.fades[i], 6);
    }
    arc.dispose();
  });
});

// ── fade profile — the decided far-plane edge treatment, pinned ─────────────

describe('deriveComponentOrbitSpec — edge fade profile', () => {
  it('full brightness at the star, fading to exactly 0 at both arc ends', () => {
    const spec = specFor(AUTHORED[0]);
    const mid = Math.floor(spec.vertexCount / 2);
    expect(spec.fades[mid]).toBe(1);
    expect(spec.fades[0]).toBe(0);
    expect(spec.fades[spec.vertexCount - 1]).toBe(0);
  });

  it('fade is monotonically non-increasing outward from the center', () => {
    const spec = specFor(AUTHORED[0]);
    const mid = Math.floor(spec.vertexCount / 2);
    for (let i = mid; i < spec.vertexCount - 1; i++) {
      expect(spec.fades[i + 1]).toBeLessThanOrEqual(spec.fades[i] + 1e-9);
    }
    for (let i = mid; i > 0; i--) {
      expect(spec.fades[i - 1]).toBeLessThanOrEqual(spec.fades[i] + 1e-9);
    }
  });

  it('the inner span (inside the fade-start fraction) stays at full brightness', () => {
    const spec = specFor(AUTHORED[0]);
    const mid = Math.floor(spec.vertexCount / 2);
    const innerVerts = Math.floor(mid * COMPONENT_ORBIT_FADE_START * 0.95);
    for (let i = mid - innerVerts; i <= mid + innerVerts; i++) {
      expect(spec.fades[i]).toBe(1);
    }
  });
});

// ── (6) WorldOrigin rebase — arc-local vertices are rebase-invariant ────────

describe('OrbitArc under world-origin rebasing (orbit-ring-rebase template)', () => {
  function freshScene() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    scene.add(camera);
    return { scene, camera };
  }

  it('rebase shifts only mesh.position — the local vertex data is untouched', () => {
    resetWorldOrigin();
    const { scene, camera } = freshScene();

    const arc = new OrbitArc(specFor(AUTHORED[0]), 0x00dd00);
    placeInRebasedFrame(arc.mesh);
    arc.addTo(scene);
    const verticesBefore = Array.from(arc.mesh.geometry.getAttribute('position').array);

    // Fly far enough to trigger a rebase (threshold 100 units).
    camera.position.set(250, 8, -120);
    expect(maybeRebase(camera, scene)).toBe(true);

    // Vertices: byte-identical. Placement: mesh tracks the rebased barycenter.
    expect(Array.from(arc.mesh.geometry.getAttribute('position').array)).toEqual(verticesBefore);
    const bary = new THREE.Vector3(0, 0, 0).sub(worldOrigin);
    expect(arc.mesh.position.x).toBeCloseTo(bary.x, 5);
    expect(arc.mesh.position.y).toBeCloseTo(bary.y, 5);
    expect(arc.mesh.position.z).toBeCloseTo(bary.z, 5);
    arc.dispose();
    resetWorldOrigin();
  });

  it('an arc spawned after warp-accumulated worldOrigin coincides with the barycenter', () => {
    resetWorldOrigin();
    const { scene, camera } = freshScene();

    camera.position.set(250, 0, 0);
    expect(maybeRebase(camera, scene)).toBe(true);
    expect(worldOrigin.x).toBeCloseTo(250, 5);

    const arc = new OrbitArc(specFor(AUTHORED[0]), 0x00dd00);
    placeInRebasedFrame(arc.mesh); // the GB6 consumption contract
    arc.addTo(scene);

    const bary = new THREE.Vector3(0, 0, 0).sub(worldOrigin);
    expect(arc.mesh.position.x).toBeCloseTo(bary.x, 5);
    expect(arc.mesh.position.z).toBeCloseTo(bary.z, 5);
    arc.dispose();
    resetWorldOrigin();
  });
});

// ── (7) near-straight property — sagitta pinned numerically ─────────────────

describe('deriveComponentOrbitSpec — the near-straight giant orbit (sagitta pin)', () => {
  it('R=13e6 (Proxima): sagitta over the visible span ≈ 1,540 scene units (analytic)', () => {
    const spec = specFor(AUTHORED[0]);
    // Analytic: R(1 − cos(halfSpan/R)) with halfSpan = camera far 200,000
    //   = 13e6 × (1 − cos(0.0153846…)) ≈ 1538.4 — "~1,540-unit deviation".
    const analytic = spec.radiusScene * (1 - Math.cos(spec.halfSpanScene / spec.radiusScene));
    expect(spec.sagittaScene).toBeCloseTo(analytic, 6);
    expect(spec.sagittaScene).toBeGreaterThan(1500);
    expect(spec.sagittaScene).toBeLessThan(1580);
    // The emitted geometry agrees with the analytic value.
    expect(maxAlong(spec, 1, 0, 0)).toBeCloseTo(spec.sagittaScene, 3);
    // Max's "straight line": deviation is <1% of the visible span.
    expect(spec.sagittaScene / (2 * spec.halfSpanScene)).toBeLessThan(0.01);
  });

  it('halfSpan is clip-aware: bounded by the camera far plane for all authored radii', () => {
    for (const a of AUTHORED) {
      const spec = specFor(a);
      expect(spec.halfSpanScene).toBeLessThanOrEqual(CAMERA_FAR_SCENE);
      expect(spec.halfSpanScene).toBeGreaterThan(0);
    }
  });

  it('a hypothetical tiny separation clamps the arc angle instead of wrapping the circle', () => {
    const parent = parentFromTable('Alpha Centauri');
    parent.componentSystems[0].separationAU = 100; // R = 100,000 < camera far
    const spec = deriveComponentOrbitSpec(parent, 0);
    expect(spec).not.toBeNull();
    // Arc never exceeds a quarter-circle each side; vertices stay bounded.
    expect(spec.halfSpanScene).toBeLessThanOrEqual(spec.radiusScene * Math.PI / 2 + 1e-6);
    const { maxMag } = vertexExtremes(spec);
    expect(maxMag).toBeLessThanOrEqual(2 * spec.radiusScene);
  });
});
