// planet-lod-tributaries.test.js — Option B river-LOD CPU tributary-growth TOPOLOGY de-risk.
//
// Proves the Option B topology algorithm in ISOLATION (no THREE, no GPU): growTributaries grows
// REAL connected finer tributaries that CONVERGE onto the existing trunk by local refined
// re-routing. This is the exact property Option A (per-pixel Dendry SDF) could not deliver — it
// produced local texture, not global connectivity. The three property clusters below are the
// make-or-break: connectivity/convergence, dendricity (no radial starbursts), determinism.
//
// FIXTURE. A coarse base "patch": a low-res geodesic-ish grid on the sphere (reusing buildFineGrid
// at low gridRes gives a real triangular sphere mesh with neighbour adjacency). Through it we lay
// ONE macro trunk VALLEY: the lattice column nearest planar su=0, ordered by descending sv, with a
// hand-built routed graph (receiver chain down the valley, isChannel=1 along it, surf descending
// along the chain and HIGHER off the valley). This is geometrically consistent with the base verts
// (the chain follows real neighbours and runs downhill) — exactly the hand-built-routed convention
// of planet-lod-rivers-carve-channels.test.js. The point is to prove the FINE growth, not re-test
// routeAndOrder.
import { describe, it, expect } from 'vitest';
import {
  growTributaries, buildFineGrid, localFrame, hash01, fbm, DEFAULT_TRIB_PARAMS,
} from '../planet-lod-tributaries.js';

// ── Build a coarse base mesh patch with one trunk valley + a consistent hand-built routed graph ──
function buildBaseFixture() {
  const center = [0, 0, 1];
  const angularRadius = 0.32;
  // Reuse the lattice builder at LOW res to get a realistic geodesic-ish patch with adjacency.
  const grid = buildFineGrid({ center, angularRadius }, 12);
  const verts = grid.fverts;      // Array<[x,y,z]> on the unit sphere
  const adj = grid.fadj;          // neighbour indices
  const planar = grid.planar;     // [su, sv] per vert
  const N = verts.length;

  // Trunk valley = a HORIZONTAL strip nearest sv=0, walked along su (a basin axis), with a gentle
  // downhill toward +su so one end is the terminus (the local "ocean"). Running the trunk ACROSS the
  // patch (not down a single fall-line) gives it lateral length, so tributaries attach ALONG it from
  // BOTH flanks — a real dendritic basin, not a straight chute that funnels everything to one foot.
  // For each distinct su-column (rounded) pick the vert with |sv| minimal → a single connected row.
  const colMap = new Map();
  for (let i = 0; i < N; i++) {
    const su = planar[i][0];
    const ck = Math.round(su * 1000);
    const cur = colMap.get(ck);
    if (cur === undefined || Math.abs(planar[i][1]) < Math.abs(planar[cur][1])) colMap.set(ck, i);
  }
  // sort by ascending su → trunk drains downhill toward +su; the +su end is the terminus.
  const trunkRows = [...colMap.entries()].sort((a, b) => a[0] - b[0]).map(([, i]) => i);

  // Build the hand routed graph.
  const receiver = new Int32Array(N).fill(-1);
  const isChannel = new Uint8Array(N);
  const strahler = new Int32Array(N).fill(0);
  const surf = new Float64Array(N);

  // Base macro surface: a basin whose floor is the sv=0 trunk line. Elevation rises with |sv|
  // (distance from the trunk, so both flanks drain INTO it) and the trunk floor itself falls gently
  // with +su (so flow runs ALONG the trunk to the +su terminus). The whole patch trends toward the
  // trunk LINE, and the trunk's own slope is shallow so tributaries — not the trunk axis — carry the
  // bulk of the relief: this is what spreads attachment along the line instead of funnelling.
  for (let i = 0; i < N; i++) {
    const su = planar[i][0], sv = planar[i][1];
    surf[i] = 1.6 * Math.abs(sv) - 0.18 * su; // floor at sv=0; flanks drain in; trunk falls toward +su
  }

  // Trunk chain: each trunk col drains to the next (toward +su); the +su-most is the terminus.
  for (let r = 0; r < trunkRows.length; r++) {
    const i = trunkRows[r];
    isChannel[i] = 1;
    strahler[i] = 3;                       // trunk is high order
    surf[i] -= 0.05;                       // seat the trunk floor strictly below its flanks
    receiver[i] = (r + 1 < trunkRows.length) ? trunkRows[r + 1] : i; // last = terminus
  }
  const maxOrder = 3;

  const surfFn = (i) => surf[i];
  const baseMesh = { verts, adj, N, isChannel, strahler };
  const routed = { receiver, isChannel, strahler, surf: surfFn, maxOrder, accum: null };
  return { baseMesh, routed, region: { center, angularRadius }, trunkRows };
}

// Walk freceiver from a fine vert to its sink, with a visited guard. Returns
// { sink, steps, cycle:boolean }.
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

describe('Option B tributary-growth — helper primitives', () => {
  it('localFrame returns an orthonormal right-handed basis', () => {
    const { u, v, n } = localFrame([0.3, -0.7, 0.5]);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(dot(u, u)).toBeCloseTo(1, 6);
    expect(dot(v, v)).toBeCloseTo(1, 6);
    expect(dot(n, n)).toBeCloseTo(1, 6);
    expect(dot(u, v)).toBeCloseTo(0, 6);
    expect(dot(u, n)).toBeCloseTo(0, 6);
    expect(dot(v, n)).toBeCloseTo(0, 6);
    // right-handed: cross(u,v) == n
    const cx = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    expect(dot(cx, n)).toBeCloseTo(1, 6);
  });

  it('hash01 is deterministic and in [0,1)', () => {
    for (let t = 0; t < 50; t++) {
      const a = hash01(t, t * 3, 7), b = hash01(t, t * 3, 7);
      expect(a).toBe(b);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
    expect(hash01(1, 2, 7)).not.toBe(hash01(1, 2, 8)); // seed changes the value
  });

  it('buildFineGrid adjacency is a pure function of (region, gridRes)', () => {
    const region = { center: [0, 0, 1], angularRadius: 0.3 };
    const g1 = buildFineGrid(region, 16);
    const g2 = buildFineGrid(region, 16);
    expect(g1.fverts.length).toBe(g2.fverts.length);
    for (let k = 0; k < g1.fadj.length; k++) {
      expect(g1.fadj[k]).toEqual(g2.fadj[k]);       // identical adjacency
    }
    // adjacency is symmetric (undirected lattice)
    for (let k = 0; k < g1.fadj.length; k++) {
      for (const nb of g1.fadj[k]) expect(g1.fadj[nb]).toContain(k);
    }
    // all verts inside the planar radius
    const R = Math.tan(0.3);
    for (const [su, sv] of g1.planar) expect(su * su + sv * sv).toBeLessThanOrEqual(R * R + 1e-9);
  });

  it('fbm is deterministic and bounded around 0', () => {
    expect(fbm(1.1, 2.2, 3.3, 42)).toBe(fbm(1.1, 2.2, 3.3, 42));
    expect(Math.abs(fbm(1.1, 2.2, 3.3, 42))).toBeLessThanOrEqual(1);
  });
});

describe('Option B (A) CONNECTIVITY / CONVERGENCE onto the trunk', () => {
  const { baseMesh, routed, region } = buildBaseFixture();
  const out = growTributaries({ baseMesh, routed, region: { ...region, gridRes: 56 }, seed: 7 });
  const { freceiver, isFineChannel, isOutlet, outletBaseNode, fstrahler } = out;
  const Nf = freceiver.length;

  it('grew a non-trivial fine channel network and real outlets', () => {
    const chCount = isFineChannel.reduce((a, b) => a + b, 0);
    const outletCount = isOutlet.reduce((a, b) => a + b, 0);
    expect(outletCount).toBeGreaterThan(1);
    expect(chCount).toBeGreaterThan(10);      // a real network, not a couple of cells
  });

  it('EVERY fine channel vert drains to an outlet whose base node is a real trunk; 0 orphans/cycles', () => {
    let orphans = 0, cycles = 0;
    for (let k = 0; k < Nf; k++) {
      if (!isFineChannel[k]) continue;
      const w = walkToSink(freceiver, k);
      if (w.cycle) { cycles++; continue; }
      // sink must be an outlet whose base node is a real trunk channel
      if (!isOutlet[w.sink]) { orphans++; continue; }
      const bn = outletBaseNode[w.sink];
      if (bn < 0 || baseMesh.isChannel[bn] !== 1) orphans++;
    }
    expect(cycles).toBe(0);
    expect(orphans).toBe(0);
  });

  it('no self-loops among non-outlet verts; no receiver cycles anywhere', () => {
    let selfLoops = 0, cycles = 0;
    for (let k = 0; k < Nf; k++) {
      if (!isOutlet[k] && freceiver[k] === k) selfLoops++;
      if (walkToSink(freceiver, k).cycle) cycles++;
    }
    expect(selfLoops).toBe(0);
    expect(cycles).toBe(0);
  });

  it('flow attaches along the trunk LINE (>1 distinct outlet base node receives flow)', () => {
    const receivingBaseNodes = new Set();
    for (let k = 0; k < Nf; k++) {
      if (!isFineChannel[k]) continue;
      const w = walkToSink(freceiver, k);
      if (!w.cycle && isOutlet[w.sink]) receivingBaseNodes.add(outletBaseNode[w.sink]);
    }
    expect(receivingBaseNodes.size).toBeGreaterThan(1);
  });
});

describe('Option B (B) DENDRICITY — no radial starbursts, joins from upstream', () => {
  const { baseMesh, routed, region } = buildBaseFixture();
  const out = growTributaries({ baseMesh, routed, region: { ...region, gridRes: 56 }, seed: 7 });
  const { freceiver, fverts, isFineChannel, isOutlet, outletBaseNode, fstrahler } = out;
  const Nf = freceiver.length;

  function pos(k) { return fverts[k]; }
  function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function vlen(a) { return Math.hypot(a[0], a[1], a[2]); }
  function vnorm(a) { const L = vlen(a) || 1e-30; return [a[0] / L, a[1] / L, a[2] / L]; }
  function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  it('confluence alignment: tributaries point DOWNSTREAM into the trunk (mean dot > 0.3)', () => {
    // incoming[j] = list of fine verts i with freceiver[i] === j (only channel flow counts)
    const incoming = Array.from({ length: Nf }, () => []);
    for (let i = 0; i < Nf; i++) {
      if (isOutlet[i]) continue;
      const r = freceiver[i];
      if (r !== i) incoming[r].push(i);
    }
    let sum = 0, n = 0;
    for (let j = 0; j < Nf; j++) {
      if (incoming[j].length < 2) continue;       // a confluence: ≥2 tributaries meet at j
      const rj = freceiver[j];
      if (rj === j) continue;                      // need a downstream direction at j
      const trunkDown = vnorm(vsub(pos(rj), pos(j)));
      for (const i of incoming[j]) {
        const tribDir = vnorm(vsub(pos(j), pos(i)));
        sum += vdot(tribDir, trunkDown);
        n++;
      }
    }
    expect(n).toBeGreaterThan(0);                  // confluences actually exist
    const mean = sum / n;
    expect(mean).toBeGreaterThan(0.3);             // NOT head-on/radial (the Option-A starburst test)
  });

  it('multi-order branching: fine maxOrder >= 2 and the order histogram is monotone-ish decreasing', () => {
    let maxOrder = 0; const hist = {};
    for (let k = 0; k < Nf; k++) {
      const o = fstrahler[k];
      if (o <= 0) continue;
      if (o > maxOrder) maxOrder = o;
      hist[o] = (hist[o] || 0) + 1;
    }
    expect(maxOrder).toBeGreaterThanOrEqual(2);    // tributaries-of-tributaries exist (dendritic)
    // more low-order than high-order channels: count(order o) >= count(order o+1) for o>=1
    for (let o = 1; o < maxOrder; o++) {
      expect((hist[o] || 0)).toBeGreaterThanOrEqual(hist[o + 1] || 0);
    }
  });

  it('anti-starburst: no single outlet base node terminates > 60% of all fine channels', () => {
    const tally = new Map();
    let total = 0;
    for (let k = 0; k < Nf; k++) {
      if (!isFineChannel[k]) continue;
      const w = walkToSink(freceiver, k);
      if (w.cycle || !isOutlet[w.sink]) continue;
      const bn = outletBaseNode[w.sink];
      tally.set(bn, (tally.get(bn) || 0) + 1);
      total++;
    }
    expect(total).toBeGreaterThan(0);
    let maxShare = 0;
    for (const c of tally.values()) maxShare = Math.max(maxShare, c / total);
    expect(maxShare).toBeLessThanOrEqual(0.6);
  });
});

describe('Option B (C) DETERMINISM', () => {
  const { baseMesh, routed, region } = buildBaseFixture();

  it('identical (region, seed) → bit-identical freceiver and fstrahler', () => {
    const a = growTributaries({ baseMesh, routed, region: { ...region, gridRes: 56 }, seed: 11 });
    const b = growTributaries({ baseMesh, routed, region: { ...region, gridRes: 56 }, seed: 11 });
    expect(a.freceiver.length).toBe(b.freceiver.length);
    for (let k = 0; k < a.freceiver.length; k++) {
      expect(a.freceiver[k]).toBe(b.freceiver[k]);
      expect(a.fstrahler[k]).toBe(b.fstrahler[k]);
    }
  });

  it('a different seed changes the channel pattern (freceiver not identical)', () => {
    const a = growTributaries({ baseMesh, routed, region: { ...region, gridRes: 56 }, seed: 11 });
    const c = growTributaries({ baseMesh, routed, region: { ...region, gridRes: 56 }, seed: 999 });
    let diffs = 0;
    for (let k = 0; k < a.freceiver.length; k++) if (a.freceiver[k] !== c.freceiver[k]) diffs++;
    expect(diffs).toBeGreaterThan(0);
  });

  it('eval-order invariance: adjacency is index-canonical, so the channel SET is order-free', () => {
    // By construction every internal pass (priority-flood heap, steepest-receiver, strahler sort)
    // breaks ties on ascending index and buildFineGrid sorts each neighbour list — so output cannot
    // depend on iteration order. We verify the standing-in property directly: re-running yields the
    // SAME fine-channel index set (already covered bit-exactly above; here as a set check on a
    // second seed to guard the channel-membership pass specifically).
    const a = growTributaries({ baseMesh, routed, region: { ...region, gridRes: 48 }, seed: 5 });
    const b = growTributaries({ baseMesh, routed, region: { ...region, gridRes: 48 }, seed: 5 });
    const setA = new Set(); const setB = new Set();
    for (let k = 0; k < a.isFineChannel.length; k++) { if (a.isFineChannel[k]) setA.add(k); }
    for (let k = 0; k < b.isFineChannel.length; k++) { if (b.isFineChannel[k]) setB.add(k); }
    expect(setA.size).toBe(setB.size);
    for (const k of setA) expect(setB.has(k)).toBe(true);
  });
});
