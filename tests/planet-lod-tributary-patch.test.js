// planet-lod-tributary-patch.test.js — Option B river-LOD STEP 2, PORTABLE (headless) parts only.
//
// The GPU bake (2D ortho RTT) and the shader blend are GPU-gated by working-Claude on Chrome :9223
// (spec §11 live gate) — NOT here. This file proves the headless-portable parts:
//   1. B-on-irregular-base   — growTributaries on an IRREGULAR base (perturbed lattice + non-uniform
//      trunk spacing) still yields 0 orphans / 0 cycles (closes the reviewer caveat that the spike
//      only used a regular lattice as its base). Height is a deterministic injected JS fn (headless
//      has no renderer; the topology is height-source-agnostic, already proven in STEP 1).
//   2. Patch UV round-trip   — projectToPatch (the pure no-THREE port byte-aligned with the GLSL):
//      a dir built as normalize(N + su·u + sv·v) maps back to (su,sv) within the cap; lateral gate ~0
//      at centre, ~1 at su=R.
//   3. Fine valley geometry  — buildFineValleyGeometry emits position/aDepth attributes, non-empty for
//      a fixture with fine channels.

import { describe, it, expect } from 'vitest';
import {
  growTributaries, buildFineGrid, localFrame, fbm, DEFAULT_TRIB_PARAMS,
} from '../planet-lod-tributaries.js';
import { projectToPatch, buildFineValleyGeometry } from '../planet-lod-tributary-patch.js';

// ── Build an IRREGULAR base patch: a low-res lattice whose vertex directions are deterministically
// perturbed off the regular grid (so adjacency spacing is non-uniform), plus a hand-built routed
// trunk laid along the perturbed sv≈0 row. This proves connectivity holds when the BASE (which trunk
// nodes we read + their geodesic spacing) is irregular — the fine LATTICE itself stays regular (per
// the design: base irregularity only changes which trunk nodes we read, not the fine dendricity).
function buildIrregularBaseFixture() {
  const center = [0, 0, 1];
  const angularRadius = 0.32;
  const grid = buildFineGrid({ center, angularRadius }, 12);
  const { u, v, n } = localFrame(center);
  const N = grid.fverts.length;
  const planar = grid.planar.map(s => s.slice());
  const adj = grid.fadj;

  // Deterministic perturbation of each vert's planar position (irregular spacing), re-projected to the
  // sphere via normalize(n + su·u + sv·v). Perturbation amplitude < half the cell so adjacency holds.
  const cell = grid.cell;
  const verts = [];
  for (let i = 0; i < N; i++) {
    const jitterU = (fbm(planar[i][0] * 7.0, planar[i][1] * 7.0, 1.3, 101) ) * 0.35 * cell;
    const jitterV = (fbm(planar[i][0] * 7.0, planar[i][1] * 7.0, 9.7, 202) ) * 0.35 * cell;
    const su = planar[i][0] + jitterU, sv = planar[i][1] + jitterV;
    planar[i][0] = su; planar[i][1] = sv;
    const p = [n[0] + u[0] * su + v[0] * sv, n[1] + u[1] * su + v[1] * sv, n[2] + u[2] * su + v[2] * sv];
    const L = Math.hypot(p[0], p[1], p[2]) || 1;
    verts.push([p[0] / L, p[1] / L, p[2] / L]);
  }

  // Trunk = one connected row nearest sv=0, walked along ascending su (the +su end is the terminus).
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
  const surf = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const su = planar[i][0], sv = planar[i][1];
    surf[i] = 1.6 * Math.abs(sv) - 0.18 * su;     // basin floor at sv=0; flanks drain in; trunk → +su
  }
  for (let r = 0; r < trunkRows.length; r++) {
    const i = trunkRows[r];
    isChannel[i] = 1; strahler[i] = 3; surf[i] -= 0.05;
    receiver[i] = (r + 1 < trunkRows.length) ? trunkRows[r + 1] : i;
  }

  const baseMesh = { verts, adj, N, isChannel, strahler };
  const routed = { receiver, isChannel, strahler, surf: (i) => surf[i], maxOrder: 3, accum: null };
  // deterministic injected height fn (the GPU read's stand-in for the headless test).
  const sampleHeight = (p) => 1.6 * Math.abs(p[0] * v[0] + p[1] * v[1] + p[2] * v[2]);
  return { baseMesh, routed, region: { center, angularRadius }, sampleHeight };
}

function walkToSink(freceiver, start) {
  const seen = new Set();
  let c = start, steps = 0;
  while (true) {
    if (seen.has(c)) return { sink: c, steps, cycle: true };
    seen.add(c);
    const r = freceiver[c];
    if (r === c) return { sink: c, steps, cycle: false };
    c = r; steps++;
    if (steps > freceiver.length + 5) return { sink: c, steps, cycle: true };
  }
}

describe('Option B STEP 2 — (1) connectivity holds on an IRREGULAR base', () => {
  const { baseMesh, routed, region, sampleHeight } = buildIrregularBaseFixture();
  const out = growTributaries({ baseMesh, routed, sampleHeight, region: { ...region, gridRes: 56 }, seed: 7 });

  it('grows a non-trivial fine network with outlets', () => {
    expect(out.fverts.length).toBeGreaterThan(100);
    let outlets = 0; for (let k = 0; k < out.isOutlet.length; k++) if (out.isOutlet[k]) outlets++;
    expect(outlets).toBeGreaterThan(0);
    let channels = 0; for (let k = 0; k < out.isFineChannel.length; k++) if (out.isFineChannel[k]) channels++;
    expect(channels).toBeGreaterThan(0);
  });

  it('0 orphans: every non-outlet fine vert reaches an outlet sink', () => {
    let orphans = 0;
    for (let k = 0; k < out.freceiver.length; k++) {
      if (out.isOutlet[k]) continue;
      const w = walkToSink(out.freceiver, k);
      if (w.cycle || !out.isOutlet[w.sink]) orphans++;
    }
    expect(orphans).toBe(0);
  });

  it('0 cycles: the fine receiver graph is acyclic', () => {
    let cycles = 0;
    for (let k = 0; k < out.freceiver.length; k++) if (walkToSink(out.freceiver, k).cycle) cycles++;
    expect(cycles).toBe(0);
  });
});

describe('Option B STEP 2 — (2) patch UV round-trip (gnomonic-tangent, byte-aligned with GLSL)', () => {
  const center = [0.3, -0.6, 0.74];
  const frame = { ...localFrame(center), angular: 0.14 };
  const N = frame.n, u = frame.u, v = frame.v;
  const R = Math.tan(frame.angular);
  const mkDir = (su, sv) => {
    const p = [N[0] + u[0] * su + v[0] * sv, N[1] + u[1] * su + v[1] * sv, N[2] + u[2] * su + v[2] * sv];
    const L = Math.hypot(p[0], p[1], p[2]); return [p[0] / L, p[1] / L, p[2] / L];
  };
  const frameForProj = { N, u, v, angular: frame.angular };

  it('round-trips (su,sv) for several in-cap points', () => {
    for (const [su, sv] of [[0, 0], [0.05, -0.03], [-0.06, 0.02], [0.08, 0.07]]) {
      const r = projectToPatch(mkDir(su, sv), frameForProj);
      expect(r.su).toBeCloseTo(su, 6);
      expect(r.sv).toBeCloseTo(sv, 6);
      expect(r.inside).toBe(true);
    }
  });

  it('lateral gate ~0 at centre, ~1 at su=R, uv centred at 0.5', () => {
    const c = projectToPatch(mkDir(0, 0), frameForProj);
    expect(c.lateral).toBeCloseTo(0, 6);
    expect(c.uv[0]).toBeCloseTo(0.5, 6);
    expect(c.uv[1]).toBeCloseTo(0.5, 6);
    const edge = projectToPatch(mkDir(R, 0), frameForProj);
    expect(edge.lateral).toBeCloseTo(1, 5);
  });

  it('reports a dir outside the cap as not inside', () => {
    // a dir ~90° off the centre is well outside an 8° cap
    const far = [-center[0], -center[1], -center[2]];
    const r = projectToPatch(far, frameForProj);
    expect(r.inside).toBe(false);
  });
});

describe('Option B STEP 2 — (3) fine valley geometry (depth rails only)', () => {
  const { baseMesh, routed, region, sampleHeight } = buildIrregularBaseFixture();
  const out = growTributaries({ baseMesh, routed, sampleHeight, region: { ...region, gridRes: 56 }, seed: 7 });

  it('emits position + aDepth attributes, non-empty for a channelled fixture', () => {
    const geo = buildFineValleyGeometry({ out, planar: out.planar });
    const pos = geo.getAttribute('position');
    const dep = geo.getAttribute('aDepth');
    expect(pos).toBeTruthy();
    expect(dep).toBeTruthy();
    expect(pos.count).toBeGreaterThan(0);
    expect(dep.count).toBe(pos.count);
    expect(geo.getIndex().count).toBeGreaterThan(0);
    // depths are within the [0, VALLEY_DEPTH_HI] range and centre rails carry > 0 depth somewhere.
    const arr = dep.array; let maxDepth = 0;
    for (let i = 0; i < arr.length; i++){ expect(arr[i]).toBeGreaterThanOrEqual(0); if (arr[i] > maxDepth) maxDepth = arr[i]; }
    expect(maxDepth).toBeGreaterThan(0);
  });
});
