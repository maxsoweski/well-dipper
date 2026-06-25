// ws4-carve-subtractive.test.js — WS4 T9/T10, AC `carve-subtractive` (unit) + `epoch-build-identical`
// (partial). Proves the carve is strictly SUBTRACTIVE over the routed substrate via the NEW pure helper
// `perNodeIncision({ mesh, routed, authored, params }) → Float32Array Δ` (length N, every Δ[i] ≤ 0).
//
// WHY this helper exists (plan §D5-pre, the operand problem): `buildValleyGeometry` returns 3-rail valley
// STRIP geometry whose `aDepth` is a POSITIVE tent on NEW strip vertices that do NOT map 1:1 to mesh
// nodes — there is NO importable per-node `carved[i]` array, so `carved[i] <= authored[i]` had no operand.
// `routeAndOrder` returns `filled` (priority-flood, which RAISES) — also not a carve. `perNodeIncision`
// is the missing single source of carve depth: `buildValleyGeometry`'s per-rail `aDepth` and the carve
// cube R channel both DERIVE from `-Δ[i]`, so unit + rendered agree by construction (plan §D5/T9).
//
// MESH HYDRATION IS MANDATORY (plan §D8): `buildIrregularSphere` returns `{ verts, faces, adj }` with NO
// `pos`, NO `N`. The live path bridges this in `ensureMesh` (rivers.js:865-868). The harness MUST
// replicate it BEFORE calling `routeAndOrder`/`perNodeIncision` or they read `undefined.length` and throw
// — a HARNESS bug masquerading as RED. `hydrateMesh` below factors that out per D8's "factor into an
// exported helper if it recurs" note (kept local — only this suite needs it today).
//
// The unit proves the LAW's subtractive sign over the ROUTER's OWN field (`authored` = the height the
// router actually routed on), NOT the rendered chain. `reliefGate` is a RENDERED-only field (plan §D5d)
// proven LIVE (T12), never witnessed here. Determinism / regime / the rendered "cut into the same relief"
// reconciliation are other ACs' jobs.
import { describe, it, expect } from 'vitest';
import {
  buildIrregularSphere, routeAndOrder, perNodeIncision, DEFAULT_PARAMS,
} from '../planet-lod-rivers.js';

// Replicate ensureMesh's hydration (rivers.js:865-868): flat Float32 mesh.pos + mesh.N from mesh.verts.
function hydrateMesh(mesh) {
  const N = mesh.verts.length;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = mesh.verts[i][0];
    pos[i * 3 + 1] = mesh.verts[i][1];
    pos[i * 3 + 2] = mesh.verts[i][2];
  }
  mesh.pos = pos;
  mesh.N = N;
  return mesh;
}

// A smooth, bumpy, DETERMINISTIC height field (no rng) over the mesh directions — a few low-frequency
// sinusoids in the unit-direction components give real ridges + basins so the router produces a non-
// trivial drainage graph (channels, Strahler orders > 1). Ocean = the low band (height below a threshold
// that yields ~35% ocean), so the priority-flood has real sinks → 0 uphill / 0 orphan off its own graph.
function syntheticField(mesh) {
  const N = mesh.N;
  const height = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = mesh.pos[i * 3], y = mesh.pos[i * 3 + 1], z = mesh.pos[i * 3 + 2];
    // low-freq smooth relief — fully deterministic, no rng, no Date.now
    const h =
      0.55 * Math.sin(3.0 * x + 1.3) * Math.cos(2.0 * y - 0.7) +
      0.30 * Math.sin(5.0 * z + 0.4) +
      0.20 * Math.cos(4.0 * x - 2.0 * z) +
      0.15 * Math.sin(7.0 * y + 1.1) * Math.sin(6.0 * x);
    height[i] = h;
  }
  return height;
}

// Ocean mask: the lowest ~OCEAN_FRACTION of the height field. Picking a threshold by sorting keeps the
// ocean fraction stable across the smooth field so there are guaranteed sinks for every basin.
function oceanMaskByFraction(height, frac) {
  const N = height.length;
  const sorted = Float32Array.from(height).sort();
  const thr = sorted[Math.floor(frac * N)];
  const isOcean = new Uint8Array(N);
  for (let i = 0; i < N; i++) isOcean[i] = height[i] <= thr ? 1 : 0;
  return isOcean;
}

// A small but real mesh — big enough for multi-order drainage, small enough for a fast unit test.
const PARAMS = { ...DEFAULT_PARAMS, TARGET_N: 2000, LLOYD_ITERS: 2 };

function buildRouted() {
  const mesh = hydrateMesh(buildIrregularSphere(PARAMS.TARGET_N, PARAMS.LLOYD_ITERS));
  const height = syntheticField(mesh);
  const isOcean = oceanMaskByFraction(height, 0.35);
  const routed = routeAndOrder({ mesh, height, grad: null, isOcean, params: PARAMS });
  return { mesh, height, isOcean, routed };
}

describe('WS4 carve-subtractive — perNodeIncision is a strictly subtractive per-node operand', () => {
  const { mesh, height, routed } = buildRouted();
  const authored = Float32Array.from(height); // the routed substrate the carve is subtractive OVER
  const incision = perNodeIncision({ mesh, routed, authored, params: PARAMS });

  it('returns a Float32Array of length N', () => {
    expect(incision).toBeInstanceOf(Float32Array);
    expect(incision.length).toBe(mesh.N);
  });

  it('the routed substrate the law operates on has 0 uphill and 0 orphan (graph is sane)', () => {
    // Off the routed graph's OWN counters (rivers.js: landCount/uphill/orphan). If these aren't 0 the
    // harness mesh/ocean is degenerate and any subtractive pass would be vacuous.
    expect(routed.uphill).toBe(0);
    expect(routed.orphan).toBe(0);
    expect(routed.landCount).toBeGreaterThan(0);
    expect(routed.maxOrder).toBeGreaterThanOrEqual(2); // real multi-order drainage exists to carve
  });

  it('is strictly subtractive: incision[i] ≤ 1e-9 ∀i (carved = authored + Δ ≤ authored)', () => {
    for (let i = 0; i < incision.length; i++) {
      expect(incision[i]).toBeLessThanOrEqual(1e-9);
      // authored + Δ ≤ authored + 1e-9  (the contract's per-vertex carved ≤ authored)
      expect(authored[i] + incision[i]).toBeLessThanOrEqual(authored[i] + 1e-9);
    }
  });

  it('Δ is nonzero ONLY on channel nodes, exactly 0 elsewhere (off-channel nodes are untouched)', () => {
    const { isChannel } = routed;
    let carvedChannels = 0;
    for (let i = 0; i < incision.length; i++) {
      if (!isChannel[i]) {
        expect(incision[i]).toBe(0); // ocean + non-channel land carry no incision
      } else if (incision[i] < 0) {
        carvedChannels++;
      }
    }
    expect(carvedChannels).toBeGreaterThan(0); // at least some channels are actually cut
  });

  it('|Δ| stays within the cube depth band [VALLEY_DEPTH_LO..HI] (HalfFloat/uRiverCarveDepth range guard)', () => {
    // Range guard (plan §D5b/T10): the cube R channel is HalfFloat and uRiverCarveDepth expects depth in
    // the established [0.45..1.0] band; deep trunks must NOT clip the cube or blow the carve budget.
    let maxAbs = 0;
    for (let i = 0; i < incision.length; i++) maxAbs = Math.max(maxAbs, Math.abs(incision[i]));
    expect(maxAbs).toBeLessThanOrEqual(PARAMS.VALLEY_DEPTH_HI + 1e-6);
    // the deepest carved channel reaches at least the LO depth (the law actually drives meaningful depth)
    expect(maxAbs).toBeGreaterThanOrEqual(PARAMS.VALLEY_DEPTH_LO - 1e-6);
  });

  it('is deterministic — same (mesh, routed, authored) → byte-identical Δ on re-run (no rng/Date.now)', () => {
    const again = perNodeIncision({ mesh, routed, authored, params: PARAMS });
    expect(again.length).toBe(incision.length);
    for (let i = 0; i < incision.length; i++) expect(again[i]).toBe(incision[i]);
  });
});

describe('WS4 carve-subtractive — stream-power law depends on drainage area A and slope S (T10)', () => {
  // Plan §T10: incision at a high-accum / high-slope node is DEEPER (more negative) than at a low-accum /
  // low-slope node. The legacy Strahler tent depended ONLY on order; this asserts dependence on A and S
  // magnitude (Δ = -K·A^m·S^n). This is the property that distinguishes stream-power from the old tent.
  const { mesh, height, routed } = buildRouted();
  const authored = Float32Array.from(height);
  const incision = perNodeIncision({ mesh, routed, authored, params: PARAMS });
  const { isChannel, accum } = routed;

  it('a high-drainage-area channel node is carved at least as deep as a low-area one', () => {
    // gather carved channel nodes, sort by accum, compare the high-A tail vs the low-A head
    const carved = [];
    for (let i = 0; i < incision.length; i++) {
      if (isChannel[i] && incision[i] < 0) carved.push(i);
    }
    expect(carved.length).toBeGreaterThan(4);
    carved.sort((a, b) => accum[a] - accum[b]);
    const lowA = carved[0];
    const highA = carved[carved.length - 1];
    expect(accum[highA]).toBeGreaterThan(accum[lowA]);
    // deeper = more negative; high drainage area carves deeper (monotone in A at comparable slope)
    expect(incision[highA]).toBeLessThanOrEqual(incision[lowA] + 1e-9);
  });

  it('DISCRIMINATOR: within ONE Strahler order, stream-power spreads depth (tent gives one depth/order)', () => {
    // THE property that separates the laws — "high-A is deeper" alone does NOT (high-A nodes also carry
    // high order, so the order-only tent passes it by coincidence). The order-only tent assigns EXACTLY
    // ONE depth to every node of a given Strahler order (depth = f(order) only). Stream-power Δ=-K·A^m·S^n
    // varies with A and S, so nodes that SHARE an order still get DIFFERENT depths. Assert: pick the order
    // with the most carved nodes; under the DEFAULT (stream-power) field those nodes have >1 distinct
    // depth, while under LEGACY they collapse to a SINGLE depth. This fails the moment the default reverts
    // to the tent (it caught a forced-tent falsification probe; "high-A deeper" did not).
    const { strahler } = routed;
    const legacy = perNodeIncision({
      mesh, routed, authored, params: { ...PARAMS, LEGACY_DEPTH: true },
    });
    // group carved channel nodes by Strahler order; find the most populated order
    const byOrder = new Map();
    for (let i = 0; i < incision.length; i++) {
      if (!(isChannel[i] && incision[i] < 0)) continue;
      const o = strahler[i];
      if (!byOrder.has(o)) byOrder.set(o, []);
      byOrder.get(o).push(i);
    }
    let bestOrder = -1, bestCount = 0;
    for (const [o, nodes] of byOrder) if (nodes.length > bestCount) { bestCount = nodes.length; bestOrder = o; }
    expect(bestCount).toBeGreaterThan(3); // a real cohort of same-order channels to compare

    const nodes = byOrder.get(bestOrder);
    const round = (v) => Math.round(v * 1e5) / 1e5; // dedupe at 1e-5 so float noise isn't "distinct"
    const spDistinct = new Set(nodes.map((i) => round(incision[i])));
    const lgDistinct = new Set(nodes.map((i) => round(legacy[i])));
    // stream-power: same-order nodes carve to MULTIPLE depths (A/S vary within the order)
    expect(spDistinct.size).toBeGreaterThan(1);
    // legacy tent: same-order nodes ALL carve to ONE depth (depth = f(order) only) — the discriminator
    expect(lgDistinct.size).toBe(1);
  });

  it('the LEGACY_DEPTH flag falls back to the order-only tent (A/B path stays reachable)', () => {
    // Plan §T10: keep the old Strahler tent reachable behind params.LEGACY_DEPTH for A/B. Default path is
    // stream-power; the flag must still produce a valid strictly-subtractive field in the same band.
    const legacy = perNodeIncision({
      mesh, routed, authored, params: { ...PARAMS, LEGACY_DEPTH: true },
    });
    let maxAbs = 0;
    for (let i = 0; i < legacy.length; i++) {
      expect(legacy[i]).toBeLessThanOrEqual(1e-9); // still strictly subtractive
      maxAbs = Math.max(maxAbs, Math.abs(legacy[i]));
    }
    expect(maxAbs).toBeLessThanOrEqual(PARAMS.VALLEY_DEPTH_HI + 1e-6);
  });
});
