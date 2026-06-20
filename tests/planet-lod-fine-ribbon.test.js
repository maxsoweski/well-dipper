// planet-lod-fine-ribbon.test.js — Section 2 fine-ribbon render representation, headless-portable parts.
//
// The GPU/visual behaviour (flood, relief, sunglint, seam) is GPU-gate-only (spec §6). Here we prove
// the buildFineRibbonGeometry primitives:
//   Fork A — emits a non-empty 2-rail strip (position + color) walked down the fine receiver chains.
//   Fork B — fine rail width is CLAMPED so it never out-widths the trunk at its outlet (the "finer
//            reads as finer" invariant, by construction of the shared width law + the outlet cap).
//   Fork E — at a trunk-pinned outlet the terminal vertex sits at the trunk node position (no T-gap).
import { describe, it, expect } from 'vitest';
import { growTributaries, buildFineGrid } from '../planet-lod-tributaries.js';
import { buildFineRibbonGeometry, buildFineValleyGeometry } from '../planet-lod-tributary-patch.js';
import { DEFAULT_PARAMS } from '../planet-lod-rivers.js';

// Same trunk-valley fixture convention as the other tributary tests, but we also keep the base verts +
// a routed graph carrying accum/strahler/maxOrder so the trunk-pin (Fork E) + width-clamp (Fork B)
// have real trunk data to read.
function buildFixture() {
  const center = [0, 0, 1];
  const angularRadius = 0.32;
  const grid = buildFineGrid({ center, angularRadius }, 12);
  const verts = grid.fverts, adj = grid.fadj, planar = grid.planar, N = verts.length;
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
    accum[i] = 500 + r * 50;                    // big trunk drainage so the trunk is WIDE at the outlet
    receiver[i] = (r + 1 < trunkRows.length) ? trunkRows[r + 1] : i;
  }
  const baseMesh = { verts, adj, N, isChannel, strahler };
  const routed = { receiver, isChannel, strahler, accum, surf: (i) => surf[i], maxOrder: 3 };
  const sampleHeight = (p) => 1.6 * Math.abs(p[1]);
  const out = growTributaries({ baseMesh, routed, sampleHeight, region: { center, angularRadius, gridRes: 56 }, seed: 7 });
  return { out, routed, baseVerts: verts };
}

describe('§2 Fork A — fine ribbon emits a non-empty coloured 2-rail strip', () => {
  const { out, routed, baseVerts } = buildFixture();
  const geo = buildFineRibbonGeometry({ out, routed, baseVerts });

  it('has position + color attributes and a non-empty index', () => {
    const pos = geo.getAttribute('position'), col = geo.getAttribute('color');
    expect(pos).toBeTruthy();
    expect(col).toBeTruthy();
    expect(pos.count).toBeGreaterThan(0);
    expect(col.count).toBe(pos.count);
    expect(geo.getIndex().count).toBeGreaterThan(0);
    expect(geo.userData.renderedCount).toBeGreaterThan(0);
  });

  it('all rail vertices are lifted to ~LIFT radius (seated in the channel, not floating)', () => {
    const pos = geo.getAttribute('position').array;
    for (let i = 0; i < pos.length; i += 3) {
      const r = Math.hypot(pos[i], pos[i + 1], pos[i + 2]);
      expect(r).toBeGreaterThan(0.9);
      expect(r).toBeLessThan(1.05);
    }
  });
});

describe('§2 Fork B — fine width never exceeds the trunk width at the outlet', () => {
  const { out, routed, baseVerts } = buildFixture();
  const P = DEFAULT_PARAMS;
  const widthLaw = (accum) => Math.min(P.WIDTH_MAX, Math.max(P.WIDTH_MIN, P.WIDTH_SCALE * (P.WIDTH_PHI * Math.pow(accum, P.WIDTH_EXP))));

  it('the widest fine rail half-width <= the trunk half-width at the maximum-accum trunk node', () => {
    // trunk widths span the routed.accum range; the outlet cap is the trunk width where a fine path
    // joins. The fine ribbon clamps each fine width to its path's outlet cap, so the GLOBAL max fine
    // half-width can never exceed the GLOBAL max trunk half-width.
    let maxTrunkW = 0;
    for (let i = 0; i < routed.accum.length; i++) if (routed.isChannel[i]) maxTrunkW = Math.max(maxTrunkW, widthLaw(routed.accum[i]));
    const geo = buildFineRibbonGeometry({ out, routed, baseVerts });
    // reconstruct per-vertex half-width from the rail spread: |L - R| / 2 per ribbon cross-section.
    const pos = geo.getAttribute('position').array;
    let maxFineW = 0;
    for (let i = 0; i + 5 < pos.length; i += 6) {
      const dx = pos[i] - pos[i + 3], dy = pos[i + 1] - pos[i + 4], dz = pos[i + 2] - pos[i + 5];
      maxFineW = Math.max(maxFineW, 0.5 * Math.hypot(dx, dy, dz));
    }
    expect(maxFineW).toBeLessThanOrEqual(maxTrunkW + 1e-6);
  });
});

describe('§8.10 — configurable fine-channel render threshold (legible density)', () => {
  // Re-grow at a higher gridRes so the fine network carries a range of Strahler orders, then sweep the
  // render threshold. The SAME network is reused (channelOrderMin only gates which channels RENDER, it
  // never changes topology), so a higher threshold must yield a monotone-non-increasing segment count.
  function richOut(gridRes = 72) {
    const center = [0, 0, 1], angularRadius = 0.32;
    const grid = buildFineGrid({ center, angularRadius }, 12);
    const verts = grid.fverts, adj = grid.fadj, planar = grid.planar, N = verts.length;
    const colMap = new Map();
    for (let i = 0; i < N; i++) {
      const ck = Math.round(planar[i][0] * 1000);
      const cur = colMap.get(ck);
      if (cur === undefined || Math.abs(planar[i][1]) < Math.abs(planar[cur][1])) colMap.set(ck, i);
    }
    const trunkRows = [...colMap.entries()].sort((a, b) => a[0] - b[0]).map(([, i]) => i);
    const receiver = new Int32Array(N).fill(-1), isChannel = new Uint8Array(N), strahler = new Int32Array(N).fill(0), surf = new Float64Array(N);
    for (let i = 0; i < N; i++) surf[i] = 1.6 * Math.abs(planar[i][1]) - 0.18 * planar[i][0];
    for (let r = 0; r < trunkRows.length; r++) { const i = trunkRows[r]; isChannel[i] = 1; strahler[i] = 3; surf[i] -= 0.05; receiver[i] = (r + 1 < trunkRows.length) ? trunkRows[r + 1] : i; }
    const baseMesh = { verts, adj, N, isChannel, strahler };
    const routed = { receiver, isChannel, strahler, surf: (i) => surf[i], maxOrder: 3, accum: null };
    return growTributaries({ baseMesh, routed, sampleHeight: (p) => 1.6 * Math.abs(p[1]), region: { center, angularRadius, gridRes }, seed: 7 });
  }

  it('higher channelOrderMin renders strictly fewer (or equal) valley + ribbon segments', () => {
    const out = richOut();
    const counts = [2, 3, 4, 5].map(min => ({
      min,
      valley: buildFineValleyGeometry({ out, planar: out.planar, params: { channelOrderMin: min } }).userData.segmentCount,
      ribbon: buildFineRibbonGeometry({ out, routed: { accum: null }, baseVerts: null, params: { channelOrderMin: min } }).userData.ribbonVerts,
    }));
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i].valley).toBeLessThanOrEqual(counts[i - 1].valley);
      expect(counts[i].ribbon).toBeLessThanOrEqual(counts[i - 1].ribbon);
    }
    // the lowest threshold renders something; a high threshold thins it well below the dense default
    expect(counts[0].valley).toBeGreaterThan(0);
    expect(counts[3].valley).toBeLessThan(counts[0].valley);
  });

  it('default (no channelOrderMin param) matches an explicit threshold of 2 — backward compatible', () => {
    const out = richOut();
    const def = buildFineValleyGeometry({ out, planar: out.planar }).userData.segmentCount;
    const two = buildFineValleyGeometry({ out, planar: out.planar, params: { channelOrderMin: 2 } }).userData.segmentCount;
    expect(def).toBe(two);
  });
});

describe('§2 Fork E — a trunk-pinned outlet vertex sits at the trunk node position', () => {
  const { out, routed, baseVerts } = buildFixture();
  const LIFT = DEFAULT_PARAMS.LIFT;

  it('at least one fine path terminates on a trunk node whose lifted position appears in the strip', () => {
    // find a trunk outlet that a fine channel actually drains to
    let pinned = null;
    for (let k = 0; k < out.freceiver.length; k++) {
      if (!out.isFineChannel[k]) continue;
      // walk to sink
      const seen = new Set(); let c = k;
      while (!seen.has(c)) { seen.add(c); const r = out.freceiver[c]; if (r === c) break; c = r; }
      if (out.isOutlet[c] && out.outletBaseNode[c] >= 0) { pinned = out.outletBaseNode[c]; break; }
    }
    expect(pinned).not.toBeNull();
    const tp = baseVerts[pinned];
    const target = [tp[0] * LIFT, tp[1] * LIFT, tp[2] * LIFT];
    const geo = buildFineRibbonGeometry({ out, routed, baseVerts });
    const pos = geo.getAttribute('position').array;
    // some rail vertex must be near the trunk node centerline (within a rail half-width tolerance)
    let minD = Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      const d = Math.hypot(pos[i] - target[0], pos[i + 1] - target[1], pos[i + 2] - target[2]);
      if (d < minD) minD = d;
    }
    expect(minD).toBeLessThan(0.02);   // pinned cross-section straddles the trunk node
  });
});
