// planet-lod-river-amplifier.js — JS REFERENCE PORT of the GLSL river amplifier.
//
// Numerically faithful to RIVER_AMPLIFIER_GLSL (planet-lod-river-amplifier.glsl.js): SAME
// integer bit-mix hash, SAME key-point jitter, SAME 5x5 neighborhood, SAME connect-to-nearest-
// of-{a,b,mid}, SAME downhill min-slope, SAME bend, SAME width law, SAME constants (AMP).
//
// This is the AUTHORITATIVE math the headless unit tests exercise (the GPU proves rendering
// later, separately). It exposes TWO entry points:
//   amplifierSample(...)  — the production-shaped path: returns {sdf, incision, flowDir} exactly
//                           as the GLSL riverAmplifier() does (this is what sampleCarve will call).
//   buildLocalTree(...)   — the SAME computation but returns the full set of synthesized child
//                           segments WITH endpoints + elevations, so tests can assert the
//                           structural properties (downhill, trunk-convergence, spacing) that the
//                           scalar SDF return alone can't expose.
// Both share buildChildren() so the structural facts the tests check are the SAME facts the SDF
// is computed from — not a parallel reimplementation.

import { AMP } from './planet-lod-river-amplifier.glsl.js';
export { AMP };

// ── deterministic position-seeded hash — EXACT mirror of GLSL ampHash (uint32 bit-mix) ──
const U32 = 0x100000000;            // 2^32
function u32(x) { return x >>> 0; }
export function ampHash(cellX, cellY, lvl, seed) {
  // h = 541*i + 79*j + lvl*0x9e3779b9 + seed   (all in uint32 modular arithmetic, like GLSL)
  let h = u32(Math.imul(u32(cellX), 541) + Math.imul(u32(cellY), 79)
            + Math.imul(u32(lvl), 0x9e3779b9 | 0) + u32(seed >>> 0));
  h = u32(h ^ (h >>> 16));
  h = u32(Math.imul(h, 0x7feb352d | 0));
  h = u32(h ^ (h >>> 15));
  h = u32(Math.imul(h, 0x846ca68b | 0));
  h = u32(h ^ (h >>> 16));
  return h / U32;
}

// qk(i,j) jittered in [EPS, 1-EPS] — cell-space (caller multiplies by cellSize).
export function ampKeyPoint(cellX, cellY, lvl, seed) {
  const jx = AMP.EPS + (1 - 2 * AMP.EPS) * ampHash(cellX, cellY, lvl, seed);
  const jy = AMP.EPS + (1 - 2 * AMP.EPS) * ampHash(cellX, cellY, lvl, (seed + 11) >>> 0);
  return [cellX + jx, cellY + jy];
}

// clamped projection SDF (math2d distToLineSegment) + the projection param u (for convergence test).
export function distSeg(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const denom = Math.max(abx * abx + aby * aby, 1e-9);
  const u = Math.min(1, Math.max(0, ((px - ax) * abx + (py - ay) * aby) / denom));
  const cx = ax + u * abx, cy = ay + u * aby;
  return { dist: Math.hypot(px - cx, py - cy), u, cx, cy };
}

// Strahler-driven level-0 cell size: high-order trunks subdivide FINER. (mirror of ampBaseSpacing)
export function baseSpacing(orderN) {
  return AMP.BASE_SPACING / Math.max(0.35, orderN);
}

// synthesized child accum proxy → child accum ALWAYS < parent (so child narrower). (ampWidthKm)
export function widthKm(orderN, gen) {
  const accum = Math.max(0.02, orderN) / Math.pow(2, gen + 1);   // halves per generation
  return AMP.WIDTH_PHI * Math.pow(accum, AMP.WIDTH_EXP);
}

// ── core: build the synthesized child branches in the 5x5 neighborhood of (uvx,uvy) ──
// Returns an array of children, each: { gen, q:[x,y], conn:[x,y], mid:[x,y], zChild, zConn, cell }.
// The child is the 2-segment bent spline q -> m1 -> conn (so it terminates ON the parent at conn).
// Level-0 parent = the reconstructed baked trunk segment [trunkA,trunkB]; deeper levels descend
// off the nearest child built at the previous level (tracked via paA/paB), exactly like the GLSL.
export function buildChildren(uvx, uvy, trunk, orderN, depth, lod, seed) {
  if (lod <= 0 || depth < AMP.TRUNK_EPS) return [];
  const K = Math.floor(
    mix(1, AMP.MAXGEN, lod) * clamp(orderN, AMP.ORDER_GATE_LO, 1)
  );
  let cellSize = baseSpacing(orderN);
  // parent segment for the current level (starts as the baked trunk)
  let paA = trunk.a.slice(), paB = trunk.b.slice();
  let paZa = trunk.za, paZb = trunk.zb;
  const all = [];

  for (let k = 0; k < AMP.MAXGEN && k < K; k++) {
    const baseX = Math.floor(uvx / cellSize), baseY = Math.floor(uvy / cellSize);
    const levelChildren = [];
    let nearestToQuery = null, nearestD = Infinity;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const cx = baseX + dx, cy = baseY + dy;
        const kp = ampKeyPoint(cx, cy, k, seed);
        const qx = kp[0] * cellSize, qy = kp[1] * cellSize;
        // connect q to nearest of {a, b, mid} of the parent segment
        const midx = 0.5 * (paA[0] + paB[0]), midy = 0.5 * (paA[1] + paB[1]);
        let conn = [midx, midy], dC = Math.hypot(qx - midx, qy - midy), zConn = 0.5 * (paZa + paZb);
        const dA = Math.hypot(qx - paA[0], qy - paA[1]);
        if (dA < dC) { conn = paA.slice(); dC = dA; zConn = paZa; }
        const dB = Math.hypot(qx - paB[0], qy - paB[1]);
        if (dB < dC) { conn = paB.slice(); dC = dB; zConn = paZb; }
        // DOWNHILL: child key-point elevation forced strictly above its connection point
        // zChild = max(zConn + minSlope*dist, controlElev(q))  (Dendry GenerateSubSegments).
        const minSlope = AMP.MINSLOPE[k];
        const zChild = Math.max(zConn + minSlope * dC, controlElev(qx, qy, trunk));
        // bend midpoint toward downhill by Δ*len, perpendicular to the q->conn direction
        const dirx = conn[0] - qx, diry = conn[1] - qy;
        const dlen = Math.max(Math.hypot(dirx, diry), 1e-9);
        const nx = dirx / dlen, ny = diry / dlen;
        const sgn = ampHash(cx, cy, k + 7, seed) < 0.5 ? -1 : 1;
        const m1 = [
          0.5 * (qx + conn[0]) + AMP.DISP * dC * (-ny) * sgn,
          0.5 * (qy + conn[1]) + AMP.DISP * dC * (nx) * sgn,
        ];
        const child = {
          gen: k, cell: [cx, cy],
          q: [qx, qy], mid: m1, conn,
          zChild, zConn, dC,        // dC = |q-conn| (connection distance) — used by the per-level slope test
          flowDir: [nx, ny],
        };
        levelChildren.push(child);
        all.push(child);
        // track the child whose key-point is nearest the query, to descend next level
        const dq = Math.hypot(qx - uvx, qy - uvy);
        if (dq < nearestD) { nearestD = dq; nearestToQuery = child; }
      }
    }
    // descend: next level's parent = the child nearest the query (this is what makes finer
    // generations nest INSIDE coarser detail). zChild is the upstream end of that child.
    if (nearestToQuery) {
      paA = nearestToQuery.q.slice(); paB = nearestToQuery.conn.slice();
      paZa = nearestToQuery.zChild; paZb = nearestToQuery.zConn;
    }
    cellSize *= 0.5;
  }
  return all;
}

// SDF of a single bent child (min over its 2 sub-segments). Returns {dist, gen}.
// Flow direction is NOT returned here — the caller (amplifierSample) reads it from child.flowDir.
function childSDF(px, py, child) {
  const s0 = distSeg(px, py, child.q[0], child.q[1], child.mid[0], child.mid[1]);
  const s1 = distSeg(px, py, child.mid[0], child.mid[1], child.conn[0], child.conn[1]);
  return s0.dist <= s1.dist ? { dist: s0.dist, gen: child.gen } : { dist: s1.dist, gen: child.gen };
}

// Production-shaped entry point — EXACT JS mirror of GLSL riverAmplifier().
// trunk = { a:[x,y], b:[x,y], za, zb }.  Returns { sdf, incision, flowDir:[x,y], bestGen }.
// widthScale: render-space factor decoupling the channel radius from the km magnitude of the
// width law (see GLSL note). Same param order as the GLSL signature: lod, pxPerKmInv, widthScale, seed.
export function amplifierSample(uvx, uvy, trunk, orderN, depth, lod, pxPerKmInv, widthScale, seed) {
  const flowDir0 = unit2([trunk.b[0] - trunk.a[0] + 1e-6, trunk.b[1] - trunk.a[1]]);
  if (lod <= 0 || depth < AMP.TRUNK_EPS) {
    return { sdf: 1e9, incision: 0, flowDir: flowDir0, bestGen: 0 };
  }
  const children = buildChildren(uvx, uvy, trunk, orderN, depth, lod, seed);
  let best = { dist: 1e9, gen: 0 }, bestFlow = flowDir0;
  for (const c of children) {
    const s = childSDF(uvx, uvy, c);
    if (s.dist < best.dist) { best = s; bestFlow = c.flowDir.slice(); }
  }
  const wKm = widthKm(orderN, best.gen);
  const radius = Math.max(wKm * widthScale * 0.5, 0.5 * pxPerKmInv);
  const incision = smoothstep(radius + AMP.AA, radius - AMP.AA, best.dist) * lod;
  return { sdf: best.dist - radius, incision, flowDir: bestFlow, bestGen: best.gen, radius };
}

// ── control function (carve cube stand-in for headless tests) ──
// In production controlElev reads the baked height sampler at q; here it's the linear elevation
// of the projection of q onto the trunk axis (monotone-downhill toward the trunk), so the JS port
// is self-contained and deterministic. The amplifier only ever USES it as a floor under the
// min-slope rule, exactly as Dendry's control function seeds level-0 elevation.
export function controlElev(qx, qy, trunk) {
  const s = distSeg(qx, qy, trunk.a[0], trunk.a[1], trunk.b[0], trunk.b[1]);
  return trunk.za + (trunk.zb - trunk.za) * s.u;   // elevation along the trunk at the foot point
}

// ── small math helpers (mirror GLSL builtins) ──
function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
function mix(a, b, t) { return a + (b - a) * t; }
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
function unit2(v) { const l = Math.max(Math.hypot(v[0], v[1]), 1e-9); return [v[0] / l, v[1] / l]; }
