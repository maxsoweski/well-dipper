import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildRingConic, sampsonDistancePx, withinRingExtent, frontArcDistPx,
  arcTolerancePx, ARC_TOLERANCE_MARGIN_PX,
} from '../ringConic.js';
import { OrbitConicField } from '../OrbitConicField.js';

// f1-f10 — THE FRONT-ARC GATE (orbit-ring-phantom-2026-08-12).
//
// THE BUG (docs/FEATURES/orbit-ring-depth-artefact.md §7, §7.1, §7.2). For a ring
// the camera is INSIDE and near the plane of — which is automatic on approach to
// any body in ORRERY, because the pivot body is itself in the ecliptic and camera
// height above the plane is exactly distance*sin(pitch) — a faint straight line
// paints across the whole screen in directions containing no ring.
//
// It is not a spurious conic (17 conics for 17 orbits was always right) and not a
// near-miss of the band. Cs is built from adj(H); as the camera nears the plane
// adj(H) collapses to rank 1 (u vᵀ) and
//     Cs = adj(H)ᵀ diag(1,1,-R²) adj(H) ≈ (u₀²+u₁²-R²u₂²) v vᵀ
// — a DOUBLE LINE whose zero set vᵀp = 0 is the ring plane's VANISHING LINE. The
// phantom pixels are exactly ON the conic the CPU handed the shader; measured, the
// phantom's true distance to it (0.663 px) is SMALLER than the real ring's (0.922).
//
// ⛔ AND THE OTHER TWO GATES ARE BLIND AT THE SAME TIME, which is why three fixes
// failed here. The extent AABB is deliberately disabled for a straddling ring
// (d0b5170) and that carve-out is correct — a ring you are inside really does
// project unbounded. The front-branch guard tests only the SIGN of a clip w
// recovered through adj(H)·p = u(vᵀp), which is ZERO on that same line: a pole. So
// clip-w magnitude, reconstructed radius and exact distance-to-conic were each
// measured dead (§7.2 — on inclined rings the legit and debris classes INVERT).
//
// THE CURE, and why it is not a fourth guess: every refuted candidate is a function
// of adj(H). The FORWARD map is perfectly conditioned exactly where the inverse
// collapses — the same property axisExtentInto already relies on for the extent.
// frontArcDistPx asks the one question none of the others can: is there a point ON
// THIS CIRCLE, IN FRONT of the camera, that projects to this pixel?
//
// These tests pin the GEOMETRY (brute-force forward projection is the oracle, with
// no reconstruction anywhere in it), not the implementation.
//
// ⚠ Green here is NOT evidence the shipped shader does this — §3/§4 record that
// validating against the JS twin is exactly how the last fix got refuted 3/3. The
// GLSL is covered by Instrument E (`npm run check:conic-gl`, mutants M12-M16).

const W = 557, H = 285, FOV = 70, NEAR = 0.01, FAR = 2e5;   // the game's sceneTarget at pixelScale 3
const R = 6748.05;                                          // Max's own repro ring, seed lab-procedural-6
const PIXEL_WIDTH = 1.0, FEATHER = 0.5;
const TOL = arcTolerancePx(PIXEL_WIDTH, FEATHER);

function poseOf(radius, matrixWorld, camPos, lookAt) {
  const cam = new THREE.PerspectiveCamera(FOV, W / H, NEAR, FAR);
  cam.position.set(...camPos); cam.up.set(0, 1, 0); cam.lookAt(...lookAt);
  cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  const mw = matrixWorld ?? new THREE.Matrix4();
  const pvm = new THREE.Matrix4()
    .multiplyMatrices(new THREE.Matrix4().copy(cam.matrixWorld).invert(), mw)
    .premultiply(cam.projectionMatrix);
  return { cam, mw, radius, conic: buildRingConic(pvm, radius, W, H) };
}

// P1 — the §7.1 reproducer: camera inside the ring, pitched just off its plane,
// looking outward. wMin < 0 < wMax, so the extent bound is the sentinel by design.
const P1 = () => poseOf(R, null, [R - 116, 12.95, 0], [R + 400, 0, 0]);

// ORACLE — brute-force forward projection of the IN-FRONT arc. No adj(H), no Cs,
// no reconstruction: the only definition of "this pixel is on the visible ring".
//
// ⚠ THE REFINE IS NOT OPTIONAL. A bare sweep can only ever land NEAR the true
// minimum, so it OVERSTATES it — and near the camera the arc crosses many screen px
// between adjacent theta samples. Without the golden-section pass this oracle reports
// ~0.9 px where the truth is ~0.08, which then reads as the closed form "understating"
// and as real pixels drifting into the ambiguous band. Both were seen; both were the
// oracle, not the gate.
function oracleArcDist(Hfwd, radius, px, py, n = 30000) {
  const at = (th) => {
    const X = radius * Math.cos(th), Z = radius * Math.sin(th);
    const w = Hfwd[6] * X + Hfwd[7] * Z + Hfwd[8];
    if (!(w > 0)) return Infinity;
    return Math.hypot((Hfwd[0] * X + Hfwd[1] * Z + Hfwd[2]) / w - px,
                      (Hfwd[3] * X + Hfwd[4] * Z + Hfwd[5]) / w - py);
  };
  const dth = (Math.PI * 2) / n;
  let best = Infinity, bestTh = null;
  for (let k = 0; k < n; k++) {
    const d = at(k * dth);
    if (d < best) { best = d; bestTh = k * dth; }
  }
  if (bestTh === null) return Infinity;
  let lo = bestTh - dth, hi = bestTh + dth;
  for (let i = 0; i < 70; i++) {
    const a = lo + (hi - lo) * 0.381966, b = lo + (hi - lo) * 0.618034;
    if (at(a) < at(b)) hi = b; else lo = a;
  }
  return Math.min(best, at((lo + hi) * 0.5));
}

// Every pixel the SHIPPED per-pixel accept paints, mirrored from the exported
// byte-mirrors — the same set the fragment shader covers.
function paintedByOldGates(pose) {
  const { Cs, Hinv, rowW, bounds } = pose.conic;
  const margin = PIXEL_WIDTH * 0.5 + FEATHER + 1.0;
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = x + 0.5, py = y + 0.5;
    const d = sampsonDistancePx(Cs, px, py);
    const t = (d - PIXEL_WIDTH * 0.5) / FEATHER;
    if (1 - (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)) < 0.01) continue;
    if (!withinRingExtent(bounds, px, py, margin)) continue;
    const qz = Hinv[6] * px + Hinv[7] * py + Hinv[8];
    const X = (Hinv[0] * px + Hinv[1] * py + Hinv[2]) / qz;
    const Z = (Hinv[3] * px + Hinv[4] * py + Hinv[5]) / qz;
    let w = rowW[0] * X + rowW[1] * Z + rowW[2];
    if (!(w > 0)) { if (bounds[0] <= -5e29) continue; w = rowW[2]; if (w <= 0) continue; }
    out.push({ px, py, planeRatio: Math.hypot(X, Z) / pose.radius });
  }
  return out;
}

describe('front-arc gate — the forward map separates what adj(H) cannot', () => {
  it('f1: the P1 reproducer really is in the defect regime (straddle + sentinel extent)', () => {
    const p = P1();
    const span = p.radius * Math.hypot(p.conic.rowW[0], p.conic.rowW[1]);
    const wMin = p.conic.rowW[2] - span, wMax = p.conic.rowW[2] + span;
    expect(wMin).toBeLessThan(0);          // part of the circle is behind the camera
    expect(wMax).toBeGreaterThan(0);       // and part is in front => genuinely a hyperbola
    expect(p.conic.bounds[0]).toBeLessThan(-5e29);   // extent bound correctly disabled
    // and the pass paints something: an inert fixture reads as coverage and is not
    expect(paintedByOldGates(p).length).toBeGreaterThan(1000);
  });

  it('f2: the old gates paint the vanishing line — phantom pixels reconstruct far off the circle', () => {
    const painted = paintedByOldGates(P1());
    const debris = painted.filter((q) => q.planeRatio > 2);
    expect(debris.length).toBeGreaterThan(400);           // the phantom row, ~557 px
    expect(Math.max(...debris.map((q) => q.planeRatio))).toBeGreaterThan(4);
  });

  it('f3: the front-arc distance splits the painted set with nothing in between', () => {
    const p = P1();
    const painted = paintedByOldGates(p);
    let worstReal = 0, bestPhantom = Infinity, ambiguous = 0;
    for (const q of painted.filter((_, i) => i % 3 === 0)) {
      const truth = oracleArcDist(p.conic.Hfwd, p.radius, q.px, q.py);
      const cf = frontArcDistPx(p.conic.Hfwd, p.radius, q.px, q.py);
      if (truth <= 1.6) worstReal = Math.max(worstReal, cf);
      else if (truth > 6) bestPhantom = Math.min(bestPhantom, cf);
      else ambiguous++;
    }
    expect(ambiguous).toBe(0);
    expect(worstReal).toBeLessThan(2);
    expect(bestPhantom).toBeGreaterThan(6);
    expect(worstReal).toBeLessThan(TOL);                  // the shipped tolerance keeps every real px
    expect(bestPhantom).toBeGreaterThan(TOL);             // and rejects every phantom px
  });

  it('f4: applying the gate removes the phantom and nothing else', () => {
    const p = P1();
    const painted = paintedByOldGates(p);
    const kept = painted.filter((q) => frontArcDistPx(p.conic.Hfwd, p.radius, q.px, q.py) <= TOL);
    expect(kept.length).toBeLessThan(painted.length);
    expect(kept.every((q) => q.planeRatio < 1.01)).toBe(true);   // only true ring pixels survive
    expect(painted.length - kept.length).toBeGreaterThan(400);
  });

  it('f5: it never UNDERSTATES the true distance, so it cannot silently keep a phantom', () => {
    // frontArcDistPx minimizes along a screen AXIS, not along the curve normal, so it
    // is a CONSTRAINED minimum: >= the oracle at every pixel, by construction.
    const p = P1();
    for (const q of paintedByOldGates(p).filter((_, i) => i % 37 === 0)) {
      const truth = oracleArcDist(p.conic.Hfwd, p.radius, q.px, q.py);
      expect(frontArcDistPx(p.conic.Hfwd, p.radius, q.px, q.py)).toBeGreaterThanOrEqual(truth - 1e-6);
    }
  });

  it('f6: a pixel that IS the projection of a front circle point scores ~0 (round trip)', () => {
    const p = P1();
    const Hf = p.conic.Hfwd;
    let checked = 0;
    for (let k = 0; k < 7200; k++) {
      const th = (k / 7200) * Math.PI * 2;
      const X = p.radius * Math.cos(th), Z = p.radius * Math.sin(th);
      const w = Hf[6] * X + Hf[7] * Z + Hf[8];
      if (!(w > 0)) continue;                             // behind the camera: not our claim
      const sx = (Hf[0] * X + Hf[1] * Z + Hf[2]) / w;
      const sy = (Hf[3] * X + Hf[4] * Z + Hf[5]) / w;
      if (sx < -W || sx > 2 * W || sy < -H || sy > 2 * H) continue;  // gone to the asymptote
      expect(frontArcDistPx(Hf, p.radius, sx, sy)).toBeLessThan(1e-3);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('f7: a ring entirely BEHIND the camera has no front arc at all', () => {
    // Camera outside the ring, looking directly AWAY from it: wMax <= 0.
    const p = poseOf(R, null, [R * 3, 0, 0], [R * 9, 0, 0]);
    const span = p.radius * Math.hypot(p.conic.rowW[0], p.conic.rowW[1]);
    expect(p.conic.rowW[2] + span).toBeLessThanOrEqual(0);
    for (const [px, py] of [[10, 10], [278, 142], [500, 270]]) {
      expect(frontArcDistPx(p.conic.Hfwd, p.radius, px, py)).toBe(Infinity);
    }
  });

  it('f8: it does NOT erode a legitimately visible ring — five all-real controls', () => {
    const controls = [
      ['outside-high',        poseOf(R, null, [0, 26000, 26000], [0, 0, 0])],
      ['outside-edgeon',      poseOf(R, null, [R * 2.2, 0.9, 0], [0, 0, 0])],
      ['inside-tangent',      poseOf(R, null, [R - 116, 12.95, 0], [0, 0, R])],
      ['inside-toward-star',  poseOf(R, null, [R - 116, 12.95, 0], [0, 0, 0])],
      ['tiny-moon-ring',      poseOf(0.18, null, [0.16, 0.002, 0], [0.26, 0, 0])],
      ['outside-near',        poseOf(R, null, [R * 1.05, 300, 0], [R, 0, 0])],
    ];
    for (const [name, p] of controls) {
      const painted = paintedByOldGates(p);
      expect(painted.length, name).toBeGreaterThan(100);
      // ⚠ Assert the CLAIM ("no pixel that is genuinely on the visible ring is
      // dropped"), not the pose ("every painted pixel here is real"). A pose is not
      // self-evidently clean: the first draft of this control put a 0.18 ring 0.0031
      // from a camera whose near plane is 0.01, so the ring was partly inside the near
      // clip and the "erosion" it reported was the fixture, not the gate.
      let eroded = 0;
      for (const q of painted.filter((_, i) => i % 2 === 0)) {
        if (oracleArcDist(p.conic.Hfwd, p.radius, q.px, q.py) > 1.6) continue;  // not ring
        if (frontArcDistPx(p.conic.Hfwd, p.radius, q.px, q.py) > TOL) eroded++;
      }
      expect(eroded, `${name} dropped ${eroded} px that are genuinely on the ring`).toBe(0);
    }
  });

  it('f9: the tolerance is a SCREEN quantity — same margins at ring radius 0.18 and 67622', () => {
    // If it were secretly scale-dependent, the threshold would have to be retuned per
    // ring class (moon rings are 5 orders of magnitude smaller than planet orbits).
    for (const radius of [0.18, 50, 6748.05, 67622]) {
      const inset = Math.max(radius * 0.0172, 0.02), h = Math.max(radius * 0.00192, 0.002);
      const p = poseOf(radius, null, [radius - inset, h, 0], [radius + inset * 4, 0, 0]);
      const painted = paintedByOldGates(p);
      expect(painted.length, `R=${radius}`).toBeGreaterThan(100);
      let worstReal = 0, bestPhantom = Infinity;
      for (const q of painted.filter((_, i) => i % 5 === 0)) {
        const truth = oracleArcDist(p.conic.Hfwd, radius, q.px, q.py);
        const cf = frontArcDistPx(p.conic.Hfwd, radius, q.px, q.py);
        if (truth <= 1.6) worstReal = Math.max(worstReal, cf);
        else if (truth > 6) bestPhantom = Math.min(bestPhantom, cf);
      }
      expect(worstReal, `R=${radius} real`).toBeLessThan(TOL);
      if (isFinite(bestPhantom)) expect(bestPhantom, `R=${radius} phantom`).toBeGreaterThan(TOL);
    }
  });

  it('f10: the pack the GPU reads carries Hfwd, and row 2 is exactly hScale*rowW', () => {
    // The shader spends 2 texels on Hfwd, not 3, and rebuilds the third row as
    // hScale * rowW (row 6, already fetched). If that identity ever stops holding,
    // the shader's forward map silently stops being the CPU's.
    const cam = new THREE.PerspectiveCamera(FOV, W / H, NEAR, FAR);
    cam.position.set(R - 116, 12.95, 0); cam.up.set(0, 1, 0); cam.lookAt(R + 400, 0, 0);
    cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
    const field = new OrbitConicField();
    field.update([{ matrixWorld: new THREE.Matrix4(), radius: R, color: 0x00ff00, alpha: 0.8 }],
      cam, { width: W, height: H });

    const packed = field.readConic(0);
    const direct = P1().conic;
    for (let k = 0; k < 6; k++) expect(packed.Hfwd[k]).toBeCloseTo(direct.Hfwd[k], 5);
    for (let k = 6; k < 9; k++) {
      expect(packed.Hfwd[k]).toBeCloseTo(packed.hScale * packed.rowW[k - 6], 10);
      expect(packed.Hfwd[k]).toBeCloseTo(direct.Hfwd[k], 5);
    }
    expect(Math.max(...Array.from(direct.Hfwd, Math.abs))).toBeCloseTo(1, 12); // max-abs normalized

    // and the shader's tolerance uniform is the one ringConic derives, band-coupled
    expect(field.material.uniforms.uArcTolPx.value).toBe(arcTolerancePx(1.0, 0.5));
    expect(field.material.uniforms.uArcTolPx.value).toBe(1.0 * 0.5 + 0.5 + ARC_TOLERANCE_MARGIN_PX);
    field.setBand({ pixelWidth: 3.0, featherPx: 1.0 });
    expect(field.material.uniforms.uArcTolPx.value).toBe(arcTolerancePx(3.0, 1.0));
  });
});
