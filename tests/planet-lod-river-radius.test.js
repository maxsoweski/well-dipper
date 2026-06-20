// planet-lod-river-radius.test.js — port-ready pass (task 1): the VISIBLE ribbon builders must be
// radius-parameterized so they emit geometry on a sphere of arbitrary `radius` (the game surface is
// IcosahedronGeometry(d.radius,5), NOT a unit sphere), while staying byte-identical at the default
// radius 1.0 (the lab path must be a no-op).
//
// Scope (per the audit): ONLY the two ribbon builders that render DIRECTLY at the surface depend on
// radius — buildRibbonGeometry (trunk water) and buildFineRibbonGeometry (fine water). The two valley
// builders feed DIRECTION-keyed (carve cube: textureCube(normalize(vPos))) and ANGLE-keyed (ortho
// patch: planar tan-space) targets, so their vertex radius never reaches the surface — they are
// radius-invariant by construction and are deliberately NOT parameterized.
//
// Invariant under test: scaling `radius` by R scales the WHOLE ribbon geometry uniformly by R — both
// the radial lift (centerline) AND the lateral width — so the river occupies the SAME angular footprint
// on any sphere (lift-ratio and width-as-fraction are radius-invariant; absolute size scales linearly).
import { describe, it, expect } from 'vitest';
import { buildRibbonGeometry, DEFAULT_PARAMS } from '../planet-lod-rivers.js';
import { growTributaries, buildFineGrid } from '../planet-lod-tributaries.js';
import { buildFineRibbonGeometry } from '../planet-lod-tributary-patch.js';

// ── trunk fixture: a 4-node sea-bound chain (same convention as the carve-channels suite) ──
function trunkFixture() {
  const dirs = [[0, 0, 1], [0.2, 0, 0.98], [0.4, 0, 0.92], [0.6, 0, 0.80]];
  const N = dirs.length;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const d = dirs[i], L = Math.hypot(d[0], d[1], d[2]);
    pos[i * 3] = d[0] / L; pos[i * 3 + 1] = d[1] / L; pos[i * 3 + 2] = d[2] / L;
  }
  const adj = [[1], [0, 2], [1, 3], [2]];
  const mesh = { adj, pos, N };
  const routed = {
    receiver: new Int32Array([0, 0, 1, 2]),
    accum: new Float32Array([0, 4, 3, 1]),
    strahler: new Int32Array([0, 3, 3, 2]),
    maxOrder: 3,
    isChannel: new Uint8Array([0, 1, 1, 1]),
  };
  return { mesh, routed };
}

// ── fine fixture: the §2 trunk-valley convention reused from the fine-ribbon suite ──
function fineFixture() {
  const center = [0, 0, 1];
  const angularRadius = 0.32;
  const grid = buildFineGrid({ center, angularRadius }, 12);
  const verts = grid.fverts, planar = grid.planar, N = verts.length;
  const colMap = new Map();
  for (let i = 0; i < N; i++) {
    const ck = Math.round(planar[i][0] * 1000);
    const cur = colMap.get(ck);
    if (cur === undefined || Math.abs(planar[i][1]) < Math.abs(planar[cur][1])) colMap.set(ck, i);
  }
  const trunkRows = [...colMap.entries()].sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  const receiver = new Int32Array(N).fill(-1);
  const isChannel = new Uint8Array(N);
  const strahler = new Int32Array(N).fill(0);
  const accum = new Float32Array(N).fill(1);
  const surf = new Float64Array(N);
  for (let i = 0; i < N; i++) surf[i] = 1.6 * Math.abs(planar[i][1]) - 0.18 * planar[i][0];
  for (let r = 0; r < trunkRows.length; r++) {
    const i = trunkRows[r];
    isChannel[i] = 1; strahler[i] = 3; surf[i] -= 0.05;
    accum[i] = 500 + r * 50;
    receiver[i] = (r + 1 < trunkRows.length) ? trunkRows[r + 1] : i;
  }
  const baseMesh = { verts, adj: grid.fadj, N, isChannel, strahler };
  const routed = { receiver, isChannel, strahler, accum, surf: (i) => surf[i], maxOrder: 3 };
  const sampleHeight = (p) => 1.6 * Math.abs(p[1]);
  const out = growTributaries({ baseMesh, routed, sampleHeight, region: { center, angularRadius, gridRes: 56 }, seed: 7 });
  return { out, routed, baseVerts: verts };
}

// assert two position arrays are related by an elementwise uniform scale of factor R.
function expectUniformScale(posA, posR, R) {
  expect(posR.length).toBe(posA.length);
  expect(posA.length).toBeGreaterThan(0);
  for (let i = 0; i < posA.length; i++) {
    const want = posA[i] * R;
    expect(Math.abs(posR[i] - want)).toBeLessThan(1e-5 + 1e-5 * Math.abs(want));
  }
}

describe('task1 — buildRibbonGeometry is radius-parameterized', () => {
  const { mesh, routed } = trunkFixture();
  const P = { ...DEFAULT_PARAMS, CHAIKIN_ITERS: 0 };

  it('default (no params.radius) is byte-identical to explicit radius 1.0 (lab no-op)', () => {
    const a = buildRibbonGeometry({ mesh, routed, params: P }).getAttribute('position').array;
    const b = buildRibbonGeometry({ mesh, routed, params: { ...P, radius: 1.0 } }).getAttribute('position').array;
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) expect(b[i]).toBe(a[i]);
  });

  it('radius=R scales the whole ribbon (centerline lift AND lateral width) uniformly by R', () => {
    const R = 6.371;
    const a = buildRibbonGeometry({ mesh, routed, params: { ...P, radius: 1.0 } }).getAttribute('position').array;
    const b = buildRibbonGeometry({ mesh, routed, params: { ...P, radius: R } }).getAttribute('position').array;
    expectUniformScale(a, b, R);
  });

  it('lift-RATIO (mean vertex radius / sphere radius) is radius-invariant', () => {
    const meanLiftRatio = (radius) => {
      const p = buildRibbonGeometry({ mesh, routed, params: { ...P, radius } }).getAttribute('position').array;
      let s = 0, n = 0;
      for (let i = 0; i < p.length; i += 3) { s += Math.hypot(p[i], p[i + 1], p[i + 2]) / radius; n++; }
      return s / n;
    };
    expect(Math.abs(meanLiftRatio(3.0) - meanLiftRatio(1.0))).toBeLessThan(1e-5);
  });
});

describe('task1 — buildFineRibbonGeometry is radius-parameterized', () => {
  const P0 = { CHAIKIN_ITERS: 0 };

  it('default (no params.radius) is byte-identical to explicit radius 1.0 (lab no-op)', () => {
    const f = fineFixture();
    const a = buildFineRibbonGeometry({ ...f, params: P0 }).getAttribute('position').array;
    const b = buildFineRibbonGeometry({ ...f, params: { ...P0, radius: 1.0 } }).getAttribute('position').array;
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) expect(b[i]).toBe(a[i]);
  });

  it('radius=R scales the whole fine ribbon uniformly by R', () => {
    const R = 4.25;
    const f = fineFixture();
    const a = buildFineRibbonGeometry({ ...f, params: { ...P0, radius: 1.0 } }).getAttribute('position').array;
    const b = buildFineRibbonGeometry({ ...f, params: { ...P0, radius: R } }).getAttribute('position').array;
    expectUniformScale(a, b, R);
  });
});
