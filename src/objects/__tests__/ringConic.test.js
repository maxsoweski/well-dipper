import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildRingConic, sampsonDistancePx, frontBranchOK } from '../ringConic.js';

// GLSL-mirror-parity suite for the screen-space conic math (orbit-ring-conic
// Slice A, closes AC1). The lab's `conic` mode (orrery-orbit-lab.html, dig
// record e961dfd) is the PROVEN reference; ringConic.js extracts that exact
// math and this suite pins it so the fragment shader's Sampson evaluation can
// never drift from a headless test. Numbers reproduce the lab, not new claims.
//
// Fixed acceptance harness geometry: the lab's 1/3-res sceneTarget (657x282)
// under the ORRERY FOV 70; camera built from the dig scenario table so the
// poses are the dig's, not invented.

const W = 657, H = 282, FOV = 70, ASPECT = W / H, NEAR = 0.01, FAR = 1e6;

// Camera at the lab's orbit-drift placement (az=0): orbit `camCenter` at
// `dist`, `pitch` radians above the ring plane — the driftMeasure/poseCamera
// formula in orrery-orbit-lab.html.
function poseCamera({ camCenter, dist, pitch }) {
  const cam = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
  const horiz = dist * Math.cos(pitch);
  cam.position.set(camCenter[0], camCenter[1] + dist * Math.sin(pitch), camCenter[2] + horiz);
  cam.up.set(0, 1, 0);
  cam.lookAt(camCenter[0], camCenter[1], camCenter[2]);
  cam.updateMatrixWorld();
  cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  return cam;
}

// PVM = P.V.M for a ring whose local XZ-circle sits at `ringCenter` (same
// column order the lab consumes: projection premultiplied onto view*model).
function pvmFor(cam, ringCenter) {
  const meshWorld = new THREE.Matrix4().makeTranslation(ringCenter[0], ringCenter[1], ringCenter[2]);
  return new THREE.Matrix4()
    .multiplyMatrices(cam.matrixWorldInverse, meshWorld)
    .premultiply(cam.projectionMatrix);
}

// Project a world point to sceneTarget pixels; w<0 is the behind-camera branch.
function projectToPx(cam, x, y, z) {
  const v = new THREE.Vector4(x, y, z, 1)
    .applyMatrix4(cam.matrixWorldInverse)
    .applyMatrix4(cam.projectionMatrix);
  return { px: (v.x / v.w + 1) * W / 2, py: (v.y / v.w + 1) * H / 2, w: v.w };
}

// Signed conic residual pᵀCs p — the Sampson numerator, whose SIGN a4 pins.
function conicResidual(Cs, px, py) {
  const cx = Cs[0] * px + Cs[1] * py + Cs[2];
  const cy = Cs[3] * px + Cs[4] * py + Cs[5];
  const cz = Cs[6] * px + Cs[7] * py + Cs[8];
  return px * cx + py * cy + cz;
}

// The 4 ported dig poses (dig-record dead-zone + conic scenario tables). Each
// carries the ring the scenario grazes: planet rings sit at the star (origin),
// moon rings at the [5200,0,0] planet used by the dig battery.
const DIG_POSES = [
  { name: 'mid-range in-plane (pitch .01)', camCenter: [3000, 0, 0], dist: 25, pitch: 0.01, ringCenter: [0, 0, 0], radius: 1520 },
  { name: 'grazing @5200 (pitch .002)', camCenter: [5200, 0, 0], dist: 25, pitch: 0.002, ringCenter: [5200, 0, 0], radius: 40 },
  { name: 'gentle (pitch .35)', camCenter: [5200, 0, 0], dist: 25, pitch: 0.35, ringCenter: [5200, 0, 0], radius: 40 },
  { name: 'overview (pitch .7)', camCenter: [0, 0, 0], dist: 121806, pitch: 0.7, ringCenter: [0, 0, 0], radius: 30000 },
];

// a1 — on-circle Sampson ~0 across the 4 ported dig poses. A point on the
// ring's 3D circle projects onto the screen conic by construction, so its
// Sampson distance must be sub-pixel regardless of pose (well below the ~1px
// band). Threshold 0.5px per plan; observed worst is ~5e-10px.
describe('a1 on-circle Sampson ~ 0 over the ported dig poses', () => {
  for (const P of DIG_POSES) {
    it(`${P.name}: 32 circle points all Sampson < 0.5px`, () => {
      const cam = poseCamera(P);
      const conic = buildRingConic(pvmFor(cam, P.ringCenter), P.radius, W, H);
      expect(conic).not.toBeNull();
      for (let k = 0; k < 32; k++) {
        const th = (k / 32) * Math.PI * 2;
        const pr = projectToPx(
          cam,
          P.ringCenter[0] + P.radius * Math.cos(th),
          P.ringCenter[1],
          P.ringCenter[2] + P.radius * Math.sin(th),
        );
        expect(sampsonDistancePx(conic.Cs, pr.px, pr.py)).toBeLessThan(0.5);
      }
    });
  }
});

// a2 — off-circle Sampson grows monotonically as the sample steps radially off
// the circle. Overview pose (well-conditioned, whole ring in front); small
// radial factors so the growth stays in the near-linear Sampson regime.
describe('a2 off-circle Sampson is monotone in radial offset', () => {
  it('strictly increases with radial scale factor', () => {
    const P = DIG_POSES[3];
    const cam = poseCamera(P);
    const conic = buildRingConic(pvmFor(cam, P.ringCenter), P.radius, W, H);
    const th = 0.6;
    const factors = [1.001, 1.003, 1.006, 1.01, 1.02, 1.04];
    let prev = -1;
    for (const k of factors) {
      const pr = projectToPx(
        cam,
        P.ringCenter[0] + P.radius * k * Math.cos(th),
        P.ringCenter[1],
        P.ringCenter[2] + P.radius * k * Math.sin(th),
      );
      const d = sampsonDistancePx(conic.Cs, pr.px, pr.py);
      expect(d).toBeGreaterThan(prev);
      prev = d;
    }
  });
});

// a3 — front-branch guard. A circle point in front of the camera (clip.w>0)
// passes; a point on the behind-camera branch (clip.w<0) is rejected. Grazing
// @5200 pose splits the moon ring's circle across the camera plane.
describe('a3 front-branch guard rejects the behind-camera branch', () => {
  it('front point true, behind point false', () => {
    const P = DIG_POSES[1];
    const cam = poseCamera(P);
    const conic = buildRingConic(pvmFor(cam, P.ringCenter), P.radius, W, H);
    let front = null, behind = null;
    for (let k = 0; k < 128; k++) {
      const th = (k / 128) * Math.PI * 2;
      const pr = projectToPx(
        cam,
        P.ringCenter[0] + P.radius * Math.cos(th),
        P.ringCenter[1],
        P.ringCenter[2] + P.radius * Math.sin(th),
      );
      const onScreen = pr.px > 0 && pr.px < W && pr.py > 0 && pr.py < H;
      if (pr.w > 0 && onScreen && !front) front = pr;
      if (pr.w < 0 && !behind) behind = pr;
    }
    expect(front).not.toBeNull();
    expect(behind).not.toBeNull();
    expect(frontBranchOK(conic.Hinv, conic.rowW, front.px, front.py)).toBe(true);
    expect(frontBranchOK(conic.Hinv, conic.rowW, behind.px, behind.py)).toBe(false);
  });
});

// a4 — degenerate cell |camY| < 1e-3. Sweep the camera through the ring plane
// (edge-on, H near-singular) in 90 steps. GUARDS FINITENESS + SIGN STABILITY
// ONLY, not visibility (per plan): every Cs/Hinv/rowW entry stays finite, the
// build never returns null (inv3 nulls only on true-singular det<1e-30, far
// below this band), and the conic residual at a FIXED screen probe never flips
// sign — Cs is quadratic in H⁻¹, so it survives the det sign flip that H⁻¹
// itself undergoes at camY=0. The probe is a fixed off-conic screen point (not
// re-projected per frame): an exactly-on-circle point gives residual ~0 whose
// sign is float noise, and re-projecting through the edge-on horizon is itself
// unstable — neither tests the invariant a4 is for.
describe('a4 degenerate |camY|<1e-3 stays finite with no sign flap', () => {
  it('90-step camY sweep across 0: finite, non-null, sign-stable', () => {
    const ringCenter = [0, 0, 0], radius = 1000, dist = 2500;
    const N = 90;
    const FX = W / 2, FY = H / 2 + 90; // fixed screen probe, robustly off the thin edge-on conic
    const buildAt = (camY) => {
      const cam = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
      cam.position.set(ringCenter[0], camY, ringCenter[2] + dist);
      cam.up.set(0, 1, 0);
      cam.lookAt(ringCenter[0], ringCenter[1], ringCenter[2]);
      cam.updateMatrixWorld();
      cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
      return buildRingConic(pvmFor(cam, ringCenter), radius, W, H);
    };
    const signs = new Set();
    for (let s = 0; s < N; s++) {
      const camY = -1e-3 + s * (2e-3 / (N - 1));
      const conic = buildAt(camY);
      expect(conic).not.toBeNull();
      for (let i = 0; i < 9; i++) {
        expect(Number.isFinite(conic.Cs[i])).toBe(true);
        expect(Number.isFinite(conic.Hinv[i])).toBe(true);
      }
      for (let i = 0; i < 3; i++) expect(Number.isFinite(conic.rowW[i])).toBe(true);
      signs.add(Math.sign(conicResidual(conic.Cs, FX, FY)));
    }
    expect(signs.size).toBe(1); // no sign flap across the degenerate sweep
  });
});

// a5 — max-abs normalization + float32/scale invariance (R1 pin). Every ring's
// Cs is normalized to max|entry|=1 so all coefficients survive a float32 upload
// with full precision; and the Sampson distance is invariant to a global scalar
// on Cs (numerator and gradient scale together). The float32 quantization is
// deliberate: in pure float64 the scale invariance is a trivial identity, so
// the test forces Cs through a real Float32Array (the DataTexture path's numeric
// type) before evaluating. Off-circle probe (Sampson ~4px): on-circle points
// suffer catastrophic cancellation that inflates the relative error without
// bearing on the invariant. The field-scale catastrophic-cancellation proof at
// R=67670 lives in the lab (Slice B); a5 pins the algebraic + upload-scale
// invariant only.
describe('a5 max-abs normalization + float32/scale Sampson invariance', () => {
  const RADII = [2, 8, 40, 387, 1520, 5200, 30000, 67670];
  const cam = poseCamera(DIG_POSES[3]);
  for (const R of RADII) {
    it(`R=${R}: max|Cs|~1 and Sampson stable through Float32Array*scalar`, () => {
      const conic = buildRingConic(pvmFor(cam, [0, 0, 0]), R, W, H);
      expect(conic).not.toBeNull();
      let mx = 0;
      for (let i = 0; i < 9; i++) mx = Math.max(mx, Math.abs(conic.Cs[i]));
      expect(mx).toBeCloseTo(1, 9);

      // off-circle screen probe (on-circle projection nudged 6px)
      const on = projectToPx(cam, R * Math.cos(0.6), 0, R * Math.sin(0.6));
      const px = on.px + 6, py = on.py + 6;
      const d64 = sampsonDistancePx(conic.Cs, px, py);
      expect(d64).toBeGreaterThan(0.5); // genuinely off-circle, definite value

      // pure float64 scale invariance: exact to round-off
      const scalar = 12345.678;
      const scaled = Array.from(conic.Cs, (x) => x * scalar);
      expect(sampsonDistancePx(scaled, px, py)).toBeCloseTo(d64, 6);

      // real float32 quantization THEN scalar (the shipping DataTexture path)
      const q = new Float32Array(conic.Cs);
      const qScaled = Array.from(q, (x) => x * scalar);
      const dq = sampsonDistancePx(qScaled, px, py);
      expect(Math.abs(dq - d64) / d64).toBeLessThan(1e-2); // float32 tolerance
    });
  }
});
