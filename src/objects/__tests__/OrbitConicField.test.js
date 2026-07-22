import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildRingConic, sampsonDistancePx } from '../ringConic.js';
import {
  OrbitConicField,
  angularFadeFactor,
  logDepthFromWClip,
  CONIC_MAX,
  CONIC_TEX_ROWS,
  CONIC_VERTEX_SHADER,
  CONIC_FRAGMENT_SHADER,
} from '../OrbitConicField.js';

// ─────────────────────────────────────────────────────────────────────────────
// OrbitConicField headless unit suite (orbit-ring-conic Slice B). Pins the
// productized fullscreen-pass field against Slice A's proven CPU math + three's
// log-depth chunk, WITHOUT a GL context. GL-battery parity (b5/b5b/b6/b7/b8/
// b8b/b9/b10) runs in the lab later; this file is b1–b4b + b5c + the shader
// negative-pin only. The field consumes GENERIC descriptors
// {matrixWorld, radius, color, alpha, active} — no OrbitLine knowledge (Slice C).
// ─────────────────────────────────────────────────────────────────────────────

const W = 657, H = 282, FOV = 70, ASPECT = W / H, NEAR = 0.01, FAR = 1e6;
const VIEWPORT = { width: W, height: H };

// Same camera idiom as ringConic.test.js so poses are the dig's, not invented.
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

function translationMat(x, y, z) {
  return new THREE.Matrix4().makeTranslation(x, y, z);
}

// Build the SAME PVM the field builds internally, for direct-vs-packed parity.
function pvmFor(cam, ringMatrixWorld) {
  const viewInv = cam.matrixWorld.clone().invert();
  return new THREE.Matrix4()
    .multiplyMatrices(viewInv, ringMatrixWorld)
    .premultiply(cam.projectionMatrix);
}

function descriptor({ center = [0, 0, 0], radius, color = 0x00ff00, alpha = 0.8, active = true } = {}) {
  return { matrixWorld: translationMat(center[0], center[1], center[2]), radius, color, alpha, active };
}

// ── b1 — descriptor → entry lifecycle ───────────────────────────────────────
describe('b1 descriptor -> entry lifecycle', () => {
  it('N active descriptors -> N active entries', () => {
    const field = new OrbitConicField();
    const cam = poseCamera({ camCenter: [0, 0, 0], dist: 121806, pitch: 0.7 });
    const descs = [1520, 723, 387].map((radius) => descriptor({ radius }));
    field.update(descs, cam, VIEWPORT);
    expect(field.count).toBe(3);
    expect(field.activeCount).toBe(3);
    for (let i = 0; i < 3; i++) expect(field.readConic(i).active).toBe(1);
  });

  it('active:false zeros that ring flag but keeps others', () => {
    const field = new OrbitConicField();
    const cam = poseCamera({ camCenter: [0, 0, 0], dist: 121806, pitch: 0.7 });
    const descs = [
      descriptor({ radius: 1520, active: true }),
      descriptor({ radius: 723, active: false }),
      descriptor({ radius: 387, active: true }),
    ];
    field.update(descs, cam, VIEWPORT);
    expect(field.count).toBe(3);
    expect(field.readConic(0).active).toBe(1);
    expect(field.readConic(1).active).toBe(0);
    expect(field.readConic(2).active).toBe(1);
    expect(field.activeCount).toBe(2);
  });

  it('buildRingConic===null (degenerate matrix) zeros that ring flag', () => {
    const field = new OrbitConicField();
    const cam = poseCamera({ camCenter: [0, 0, 0], dist: 121806, pitch: 0.7 });
    // A zero matrixWorld makes PVM singular -> buildRingConic returns null.
    const zero = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    const descs = [
      descriptor({ radius: 1520, active: true }),
      { matrixWorld: zero, radius: 723, color: 0x00ff00, alpha: 0.8, active: true },
    ];
    // sanity: the degenerate PVM truly yields null from Slice A math
    expect(buildRingConic(pvmFor(cam, zero), 723, W, H)).toBeNull();
    field.update(descs, cam, VIEWPORT);
    expect(field.count).toBe(2);
    expect(field.readConic(0).active).toBe(1);
    expect(field.readConic(1).active).toBe(0);
    expect(field.activeCount).toBe(1);
  });

  it('count clamps to CONIC_MAX', () => {
    const field = new OrbitConicField();
    const cam = poseCamera({ camCenter: [0, 0, 0], dist: 121806, pitch: 0.7 });
    const descs = [];
    for (let i = 0; i < CONIC_MAX + 6; i++) descs.push(descriptor({ radius: 2 + i * 500 }));
    field.update(descs, cam, VIEWPORT);
    expect(field.count).toBe(CONIC_MAX);
  });
});

// ── b2 — angular-size fade JS mirror ─────────────────────────────────────────
describe('b2 angularFadeFactor mirror', () => {
  const CUTOFF = 2.0;

  it('is 1 well above the cutoff and 0 well below', () => {
    // pxPerRad = (H/2)/tan(FOV/2); large ring at moderate range projects big.
    expect(angularFadeFactor(1520, 3000, FOV, H, CUTOFF)).toBe(1);
    expect(angularFadeFactor(2, 3000, FOV, H, CUTOFF)).toBe(0);
  });

  it('is monotone non-decreasing in projected size', () => {
    let prev = -1;
    for (let radius = 1; radius <= 4000; radius += 25) {
      const f = angularFadeFactor(radius, 3000, FOV, H, CUTOFF);
      expect(f).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = f;
    }
  });

  it('smoothly transitions in [0,1] through the band', () => {
    // Choose a camDist so a mid radius lands inside the fade band.
    const fovRad = (FOV * Math.PI) / 180;
    const pxPerRad = (H / 2) / Math.tan(fovRad / 2);
    // want projPx == 1.5*CUTOFF*0.5..CUTOFF range midpoint => projPx = 0.75*CUTOFF
    const targetProjPx = 0.75 * CUTOFF; // between e0=CUTOFF*0.5 and e1=CUTOFF
    const radius = 10;
    const camDist = radius * pxPerRad / targetProjPx;
    const f = angularFadeFactor(radius, camDist, FOV, H, CUTOFF);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
  });

  it('is per-ring independent (large stays while small fades) at one pose', () => {
    const big = angularFadeFactor(30000, 5000, FOV, H, CUTOFF);
    const small = angularFadeFactor(2, 5000, FOV, H, CUTOFF);
    expect(big).toBe(1);
    expect(small).toBe(0);
  });
});

// ── b3 — log-depth JS mirror pins three's chunk exactly ──────────────────────
describe('b3 logDepthFromWClip mirrors three logdepthbuf_fragment', () => {
  it('equals log2(1+w) * (2/log2(far+1)) * 0.5 for known w_clip', () => {
    const far = 1e6;
    const FC = 2.0 / (Math.log(far + 1.0) / Math.LN2); // 2/log2(far+1), three's exact form
    for (const w of [0.25, 1, 10, 1000, 123456.7]) {
      const expected = (Math.log(1.0 + w) / Math.LN2) * FC * 0.5;
      expect(logDepthFromWClip(w, far)).toBeCloseTo(expected, 12);
    }
  });

  it('is monotone increasing in w_clip (nearer w smaller => nearer depth)', () => {
    const far = 1e6;
    let prev = -Infinity;
    for (const w of [0.1, 1, 5, 50, 500, 5000]) {
      const d = logDepthFromWClip(w, far);
      expect(d).toBeGreaterThan(prev);
      prev = d;
    }
  });
});

// ── b4 — DataTexture layout dims + pack/unpack round-trip ─────────────────────
describe('b4 DataTexture layout', () => {
  it('texture is CONIC_MAX wide x fixed rows, within the MAX_TEXTURE_SIZE floor', () => {
    const field = new OrbitConicField();
    const MAX_TEXTURE_SIZE_FLOOR = 2048; // WebGL2 guarantees >= 2048
    expect(field.textureWidth).toBe(CONIC_MAX);
    expect(field.textureRows).toBe(CONIC_TEX_ROWS);
    expect(field.textureWidth).toBeLessThanOrEqual(MAX_TEXTURE_SIZE_FLOOR);
    expect(field.textureRows).toBeLessThanOrEqual(MAX_TEXTURE_SIZE_FLOOR);
    // the packed source buffer matches the declared dims (RGBA)
    expect(field.texture.image.data.length).toBe(CONIC_MAX * CONIC_TEX_ROWS * 4);
  });

  it('pack/unpack round-trips a conic exactly at float32 precision', () => {
    const field = new OrbitConicField();
    const cam = poseCamera({ camCenter: [0, 0, 0], dist: 121806, pitch: 0.7 });
    const radius = 1520;
    field.update([descriptor({ radius })], cam, VIEWPORT);
    const direct = buildRingConic(pvmFor(cam, translationMat(0, 0, 0)), radius, W, H);
    const back = field.readConic(0);
    for (let k = 0; k < 9; k++) {
      expect(back.Cs[k]).toBe(Math.fround(direct.Cs[k]));
      expect(back.Hinv[k]).toBe(Math.fround(direct.Hinv[k]));
    }
    for (let k = 0; k < 3; k++) expect(back.rowW[k]).toBe(Math.fround(direct.rowW[k]));
  });
});

// ── b4b — packed conic evaluates the SAME Sampson as the direct Cs ────────────
// Catches row-stride / texel-order / transpose bugs that only bite ring
// index > 32 (second texture-column set), which b5 would pass silently.
describe('b4b DataTexture packing parity at ring indices 0, 33, 63', () => {
  it('packed Cs gives the same sampsonDistancePx as the direct Cs', () => {
    const field = new OrbitConicField();
    const cam = poseCamera({ camCenter: [0, 0, 0], dist: 121806, pitch: 0.7 });
    const descs = [];
    for (let i = 0; i < CONIC_MAX; i++) descs.push(descriptor({ radius: 200 + i * 900 }));
    field.update(descs, cam, VIEWPORT);

    const px = W / 2 + 31, py = H / 2 + 19; // arbitrary off-circle probe
    for (const i of [0, 33, 63]) {
      const direct = buildRingConic(pvmFor(cam, translationMat(0, 0, 0)), descs[i].radius, W, H);
      expect(direct).not.toBeNull();
      const dDirect = sampsonDistancePx(new Float32Array(direct.Cs), px, py);
      const dPacked = sampsonDistancePx(field.readConic(i).Cs, px, py);
      expect(dDirect).toBeGreaterThan(0);
      // both are float32 quantizations of the identical float64 conic -> equal
      expect(Math.abs(dPacked - dDirect) / dDirect).toBeLessThan(1e-5);
    }
  });
});

// ── b5c — field vertex shader is model/view/projection-independent (D-1b) ─────
describe('b5c field vertex shader has no model/view/projection matrix reference', () => {
  it('vertex shader references no modelMatrix/modelViewMatrix/projectionMatrix', () => {
    expect(CONIC_VERTEX_SHADER).not.toMatch(/modelMatrix/);
    expect(CONIC_VERTEX_SHADER).not.toMatch(/modelViewMatrix/);
    expect(CONIC_VERTEX_SHADER).not.toMatch(/projectionMatrix/);
  });
});

// ── shader negative-pin — matrices are CPU-built; no per-pixel inverse/transpose
// (load-bearing for the AC11 field-shader pin in Slice D).
describe('field fragment shader carries no GLSL matrix inversion', () => {
  it('fragment shader contains no inverse( or transpose(', () => {
    expect(CONIC_FRAGMENT_SHADER).not.toMatch(/inverse\s*\(/);
    expect(CONIC_FRAGMENT_SHADER).not.toMatch(/transpose\s*\(/);
  });
});
