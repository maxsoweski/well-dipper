import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildRingConic, sampsonDistancePx, frontBranchOK, withinRingExtent,
  CONIC_EXTENT_UNBOUNDED,
} from '../ringConic.js';
import { OrbitConicField } from '../OrbitConicField.js';

// a6-a10 — EXTENT BOUND for the edge-on degeneracy (orbit-ring-conic follow-up).
//
// THE BUG: when the camera aligns with a ring's plane the plane->screen
// homography H goes singular, so Cs = H^-T diag(1,1,-R^2) H^-1 becomes rank-
// deficient and its zero set is an INFINITE LINE, not a bounded ellipse. The
// Sampson band then paints across and far beyond the screen ("the orbit lines
// expand out to infinity"), and at EXACTLY 0 elevation the old inv3 returned
// null so the ring vanished outright. Measured on this fixture (R=100, D=400,
// true projected extent 126.1 px): 163 px @0.57 deg, 457 px @0.036 deg,
// 717 px @0.014 deg, 6989 px @0.00014 deg, >16000 px @0.00001 deg, GONE @0 deg.
//
// A conic has no endpoints and cannot express a bounded line SEGMENT, so the
// bound is explicit: buildRingConic also returns the ring's true screen-space
// AABB (analytic, from the FORWARD map, which is perfectly conditioned at the
// degeneracy) whenever the whole circle is in front of the camera. When part of
// the circle crosses the camera plane the projection is GENUINELY unbounded (a
// hyperbola that really does sweep off-screen) and the sentinel disables the
// bound. These tests cross-validate the analytic AABB against brute-force
// forward projection, so they pin the geometry, not the implementation.

const W = 657, H = 282, FOV = 60, ASPECT = W / H, NEAR = 0.1, FAR = 1e7;
const R = 100, D = 400;

// Shader band knobs (OrbitConicField defaults) and the derived extent margin —
// the mirror of `uPixelWidth * 0.5 + uFeatherPx + 1.0` in CONIC_FRAGMENT_SHADER.
const PIXEL_WIDTH = 1.0, FEATHER = 0.5;
const HALF_BAND = PIXEL_WIDTH * 0.5 + FEATHER;
const MARGIN = PIXEL_WIDTH * 0.5 + FEATHER + 1.0;

// Elevation ladder in camera height above the ring plane, matching the measured
// degrees above: 0.57, 0.036, 0.014, 0.00014, 0.00001, and EXACTLY 0.
const CAM_Y_LADDER = [
  { camY: 4, deg: '0.57' },
  { camY: 0.2513, deg: '0.036' },
  { camY: 0.0977, deg: '0.014' },
  { camY: 1e-3, deg: '0.00014' },
  { camY: 6.98e-5, deg: '0.00001' },
  { camY: 0, deg: '0 (exactly in plane)' },
];

function cameraAt(camY, dist = D) {
  const cam = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
  cam.position.set(0, camY, dist);
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  return cam;
}

function pvmFor(cam) {
  return new THREE.Matrix4()
    .multiplyMatrices(cam.matrixWorldInverse, new THREE.Matrix4())
    .premultiply(cam.projectionMatrix);
}

// Ground truth: brute-force FORWARD projection of the 3D circle. Independent of
// everything buildRingConic does with H^-1 / adj(H).
function bruteExtent(cam, radius = R, n = 8192) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, wMin = Infinity;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const th = (k / n) * Math.PI * 2;
    const v = new THREE.Vector4(radius * Math.cos(th), 0, radius * Math.sin(th), 1)
      .applyMatrix4(cam.matrixWorldInverse)
      .applyMatrix4(cam.projectionMatrix);
    const px = (v.x / v.w + 1) * W / 2, py = (v.y / v.w + 1) * H / 2;
    wMin = Math.min(wMin, v.w);
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    if (k % 64 === 0) pts.push({ px, py, w: v.w });
  }
  return { minX, minY, maxX, maxY, wMin, width: maxX - minX, pts };
}

const isBounded = (conic) => conic.bounds[0] > -CONIC_EXTENT_UNBOUNDED;

// Byte-mirror of the fragment shader's per-pixel accept: Sampson band, then the
// extent reject, then the front-branch guard (which falls back to the ring
// centre's clip w when the extent is bounded — see frontBranchOK).
function painted(conic, px, py) {
  if (sampsonDistancePx(conic.Cs, px, py) >= HALF_BAND) return false;
  if (!withinRingExtent(conic.bounds, px, py, MARGIN)) return false;
  return frontBranchOK(conic.Hinv, conic.rowW, px, py, isBounded(conic));
}

// Painted extent along a horizontal scan line through the ring's screen row.
function scanBand(conic, py, from = -8000, to = 8000) {
  let lo = null, hi = null, n = 0;
  for (let x = from; x <= to; x += 1) {
    if (!painted(conic, x, py)) continue;
    if (lo === null) lo = x;
    hi = x; n++;
  }
  return { lo, hi, count: n, width: lo === null ? 0 : hi - lo };
}

describe('a6 the painted band stays bounded across the edge-on ladder', () => {
  for (const { camY, deg } of CAM_Y_LADDER) {
    it(`${deg} deg above plane: band width <= true projected extent + margins`, () => {
      const cam = cameraAt(camY);
      const conic = buildRingConic(pvmFor(cam), R, W, H);
      // AC2 — the ring must NEVER disappear at or near edge-on.
      expect(conic).not.toBeNull();

      const truth = bruteExtent(cam);
      expect(truth.wMin).toBeGreaterThan(0); // whole circle in front => boundable
      expect(isBounded(conic)).toBe(true);

      const band = scanBand(conic, Math.round(truth.minY));
      expect(band.count).toBeGreaterThan(0);            // still drawn
      expect(band.width).toBeLessThanOrEqual(truth.width + 2 * MARGIN + 1);
      expect(band.lo).toBeGreaterThanOrEqual(truth.minX - MARGIN - 1);
      expect(band.hi).toBeLessThanOrEqual(truth.maxX + MARGIN + 1);
    });
  }
});

describe('a7 the analytic screen AABB matches brute-force forward projection', () => {
  for (const { camY, deg } of CAM_Y_LADDER) {
    it(`${deg} deg: bounds within 0.05px of 8192-sample projection`, () => {
      const cam = cameraAt(camY);
      const conic = buildRingConic(pvmFor(cam), R, W, H);
      const truth = bruteExtent(cam);
      expect(conic.bounds[0]).toBeCloseTo(truth.minX, 1);
      expect(conic.bounds[1]).toBeCloseTo(truth.minY, 1);
      expect(conic.bounds[2]).toBeCloseTo(truth.maxX, 1);
      expect(conic.bounds[3]).toBeCloseTo(truth.maxY, 1);
    });
  }
});

describe('a8 the bound never clips a healthy ellipse', () => {
  for (const camY of [400, 120, 40, 12]) {
    it(`camY=${camY}: every on-circle projected point is still painted`, () => {
      const cam = cameraAt(camY);
      const conic = buildRingConic(pvmFor(cam), R, W, H);
      const truth = bruteExtent(cam);
      for (const p of truth.pts) {
        expect(withinRingExtent(conic.bounds, p.px, p.py, MARGIN)).toBe(true);
        expect(painted(conic, p.px, p.py)).toBe(true);
      }
    });
  }
});

describe('a9 continuity across the degeneracy', () => {
  it('bounds and band width do not jump between camY=1e-9 and camY=0', () => {
    const a = buildRingConic(pvmFor(cameraAt(1e-9)), R, W, H);
    const A = Float64Array.from(a.bounds);
    const b = buildRingConic(pvmFor(cameraAt(0)), R, W, H);
    for (let k = 0; k < 4; k++) expect(b.bounds[k]).toBeCloseTo(A[k], 3);

    const rowY = Math.round(A[1]);
    const wa = scanBand(a, rowY).width;
    const wb = scanBand(b, rowY).width;
    expect(Math.abs(wa - wb)).toBeLessThanOrEqual(2);
  });

  it('band width is monotone non-increasing as the camera drops to the plane', () => {
    let prev = Infinity;
    for (const { camY } of CAM_Y_LADDER) {
      const conic = buildRingConic(pvmFor(cameraAt(camY)), R, W, H);
      const truth = bruteExtent(cameraAt(camY));
      const w = scanBand(conic, Math.round(truth.minY)).width;
      expect(w).toBeLessThanOrEqual(prev + 1);
      prev = w;
    }
  });
});

describe('a10 a circle crossing the camera plane keeps the unbounded sentinel', () => {
  it('camera inside the ring radius => genuinely unbounded projection, bound disabled', () => {
    const cam = cameraAt(0.5, 50); // dist 50 < R 100: the circle straddles the camera
    const truth = bruteExtent(cam);
    expect(truth.wMin).toBeLessThan(0);
    const conic = buildRingConic(pvmFor(cam), R, W, H);
    expect(conic).not.toBeNull();
    expect(conic.bounds[0]).toBe(-CONIC_EXTENT_UNBOUNDED);
    expect(conic.bounds[3]).toBe(CONIC_EXTENT_UNBOUNDED);
    expect(isBounded(conic)).toBe(false);
    // the sentinel is a no-op: every pixel passes the extent test
    expect(withinRingExtent(conic.bounds, -1e6, 1e6, 0)).toBe(true);
  });
});

describe('a11 the packed DataTexture carries the extent bound', () => {
  it('readConic(i).bounds round-trips buildRingConic bounds at float32', () => {
    const field = new OrbitConicField();
    const cam = cameraAt(0);
    const direct = buildRingConic(pvmFor(cam), R, W, H);
    field.update(
      [{ matrixWorld: new THREE.Matrix4(), radius: R, color: 0x00ff00, alpha: 0.8, active: true }],
      cam, { width: W, height: H },
    );
    const back = field.readConic(0);
    expect(back.active).toBe(1); // edge-on ring stays live
    for (let k = 0; k < 4; k++) expect(back.bounds[k]).toBe(Math.fround(direct.bounds[k]));
  });
});
