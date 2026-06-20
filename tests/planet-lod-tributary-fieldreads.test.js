// planet-lod-tributary-fieldreads.test.js — Section 4 co-dependence field-reads (the North Star,
// made mechanical). Headless-certifiable parts of §7 step 1:
//   Fix 1 — MOUNTAIN: the fine height field routes on the REAL GPU height at coeff 1.0 (not the
//           old 50/50 dilution); baseH demoted to a tiny FLATS_EPS tie-breaker.
//   Fix 2 — SEA OUTLETS: fine verts below sea level become coast outlets (bn === -1), pinned to
//           seaLevel, flagged isOceanFine; fine flow drains to whichever outlet it reaches first.
//   Fix 3 — OCEAN MASK: buildFineValleyGeometry skips any segment touching an ocean cell, so no
//           valley quad is ever rasterized seaward of the shoreline (no carve over water).
//
// These exercise the regeneration fn (1b) + primitives (1a) only — the rendered representation (1c:
// flooding, relief, sunglint) is GPU-gate-only (spec §6). FIXTURE mirrors the spike's trunk-valley
// base (see planet-lod-tributaries.test.js) so the growth is realistic, not synthetic.
import { describe, it, expect } from 'vitest';
import { growTributaries, buildFineGrid, localFrame } from '../planet-lod-tributaries.js';
import { buildFineValleyGeometry } from '../planet-lod-tributary-patch.js';

// One trunk valley laid along sv≈0, basin flanks draining in, gentle fall toward +su (terminus).
// Same convention as planet-lod-tributaries.test.js so the fine growth is a real dendritic basin.
function buildBaseFixture({ angularRadius = 0.32 } = {}) {
  const center = [0, 0, 1];
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
  const surf = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const su = planar[i][0], sv = planar[i][1];
    surf[i] = 1.6 * Math.abs(sv) - 0.18 * su;
  }
  for (let r = 0; r < trunkRows.length; r++) {
    const i = trunkRows[r];
    isChannel[i] = 1; strahler[i] = 3; surf[i] -= 0.05;
    receiver[i] = (r + 1 < trunkRows.length) ? trunkRows[r + 1] : i;
  }
  const baseMesh = { verts, adj, N, isChannel, strahler };
  const routed = { receiver, isChannel, strahler, surf: (i) => surf[i], maxOrder: 3, accum: null };
  return { baseMesh, routed, region: { center, angularRadius }, planar: grid.planar };
}

describe('§4 Fix 1 — MOUNTAIN: fine field routes on real height at coeff 1.0 (no 50/50 dilution)', () => {
  const { baseMesh, routed, region } = buildBaseFixture();
  // A sampleHeight that DISAGREES sharply with the base routed.surf — a "ridge" the base can't see.
  // (offset by a large constant so a 50/50 blend would land halfway, far from full-weight.)
  const sampleHeight = (p) => 5.0 + 2.0 * (p[0]); // dominated by the real field, big DC offset vs baseH~O(1)
  const out = growTributaries({
    baseMesh, routed, sampleHeight,
    region: { ...region, gridRes: 40 }, seed: 7,
    params: { fineAmp: 0 },   // kill the fbm so h == macro exactly (isolates the coefficient)
  });

  it('exposes the pre-flood fine height field h', () => {
    expect(out.h).toBeTruthy();
    expect(out.h.length).toBe(out.fverts.length);
  });

  it('non-outlet h equals sampleHeight at coeff 1.0 (NOT the old 0.5·base + 0.5·sample blend)', () => {
    let checked = 0;
    for (let k = 0; k < out.fverts.length; k++) {
      if (out.isOutlet[k]) continue;                 // outlets are pinned to trunk/sea surf
      const sh = sampleHeight(out.fverts[k]);
      // full-weight: |h - sampleHeight| is only the tiny FLATS_EPS·baseH tie-breaker (<~1e-2).
      expect(Math.abs(out.h[k] - sh)).toBeLessThan(0.05);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('pure-CPU path (no sampleHeight) still routes on baseH — backward compatible', () => {
    const cpu = growTributaries({ baseMesh, routed, region: { ...region, gridRes: 40 }, seed: 7 });
    expect(cpu.h).toBeTruthy();
    // with no sampleHeight, h follows the base routed.surf trend (rises with |sv|), NOT a constant.
    let mn = Infinity, mx = -Infinity;
    for (let k = 0; k < cpu.h.length; k++) { if (cpu.h[k] < mn) mn = cpu.h[k]; if (cpu.h[k] > mx) mx = cpu.h[k]; }
    expect(mx - mn).toBeGreaterThan(0.1);
  });
});

describe('§4 Fix 2 — SEA OUTLETS: sub-sea fine verts terminate at the coast (bn === -1)', () => {
  const { baseMesh, routed, region } = buildBaseFixture();
  const grid = buildFineGrid(region, 40);
  const Nf = grid.fverts.length;
  // Synthetic height array on the SAME lattice growTributaries rebuilds: an "ocean" wedge at +su.
  const seaLevel = -1.0;
  const height = new Float64Array(Nf);
  for (let k = 0; k < Nf; k++) {
    const su = grid.planar[k][0];
    height[k] = su > 0.12 ? -2.0 : 0.5;   // su>0.12 is below sea (ocean); else land
  }
  const out = growTributaries({
    baseMesh, routed, sampleHeight: (p) => 0.5, height, seaLevel,
    region: { ...region, gridRes: 40 }, seed: 7,
  });

  it('flags every sub-sea fine vert as ocean + an outlet; pure sea outlets carry bn === -1', () => {
    expect(out.isOceanFine).toBeTruthy();
    let pureSeaOutlets = 0, oceanCells = 0;
    for (let k = 0; k < Nf; k++) {
      if (height[k] < seaLevel) {
        oceanCells++;
        expect(out.isOceanFine[k]).toBe(1);
        expect(out.isOutlet[k]).toBe(1);
        // bn is the sea sentinel (-1) OR a real trunk node it collided with (trunk wins — both sink).
        const bn = out.outletBaseNode[k];
        expect(bn === -1 || baseMesh.isChannel[bn] === 1).toBe(true);
      }
    }
    // most ocean cells are off the trunk line ⇒ a healthy number of PURE sea outlets exist.
    for (let k = 0; k < Nf; k++) if (out.isOutlet[k] && out.outletBaseNode[k] === -1) pureSeaOutlets++;
    expect(oceanCells).toBeGreaterThan(5);
    expect(pureSeaOutlets).toBeGreaterThan(0);
  });

  it('a trunk outlet wins a collision with a sea outlet (bn === -1 never overrides a trunk node)', () => {
    // any vert that is BOTH a trunk outlet (claimed in the trunk loop) and sub-sea keeps its trunk bn.
    for (let k = 0; k < Nf; k++) {
      if (out.isOutlet[k] && out.outletBaseNode[k] >= 0) {
        // a real trunk outlet — must reference a real trunk channel node
        expect(baseMesh.isChannel[out.outletBaseNode[k]]).toBe(1);
      }
    }
  });

  it('land cells with no sampleHeight/height args (pure-CPU) produce NO sea outlets — backward compatible', () => {
    const cpu = growTributaries({ baseMesh, routed, region: { ...region, gridRes: 40 }, seed: 7 });
    let seaOutlets = 0;
    for (let k = 0; k < cpu.isOutlet.length; k++) if (cpu.outletBaseNode[k] === -1 && cpu.isOutlet[k]) seaOutlets++;
    expect(seaOutlets).toBe(0);
    // isOceanFine present but all-zero on the pure path
    expect(cpu.isOceanFine).toBeTruthy();
    expect(cpu.isOceanFine.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('§4 Fix 3 — OCEAN MASK: buildFineValleyGeometry skips segments touching ocean cells', () => {
  const { baseMesh, routed, region } = buildBaseFixture();
  const grid = buildFineGrid(region, 40);
  const Nf = grid.fverts.length;
  const seaLevel = -1.0;
  const height = new Float64Array(Nf);
  for (let k = 0; k < Nf; k++) height[k] = grid.planar[k][0] > 0.12 ? -2.0 : 0.5;
  const out = growTributaries({
    baseMesh, routed, sampleHeight: (p) => 0.5, height, seaLevel,
    region: { ...region, gridRes: 40 }, seed: 7,
  });

  it('masked geometry emits strictly fewer segments than an unmasked build', () => {
    const masked = buildFineValleyGeometry({ out, planar: out.planar });
    // build a copy of `out` with isOceanFine zeroed to simulate the pre-fix (unmasked) behaviour
    const unmaskedOut = { ...out, isOceanFine: new Uint8Array(Nf) };
    const unmasked = buildFineValleyGeometry({ out: unmaskedOut, planar: out.planar });
    expect(masked.userData.segmentCount).toBeLessThan(unmasked.userData.segmentCount);
    expect(masked.userData.segmentCount).toBeGreaterThan(0);   // still emits the land network
  });

  it('no emitted segment has BOTH endpoints over ocean (the mask actually fires)', () => {
    // reconstruct which channel verts are ocean; assert masked build skipped them. We can't read
    // per-segment endpoints back out of the BufferGeometry cheaply, so assert the invariant via the
    // count identity: masked count == count of land-only channel segments.
    const { freceiver, isFineChannel, isOceanFine } = out;
    let landSegs = 0;
    for (let k = 0; k < Nf; k++) {
      if (isFineChannel[k] !== 1) continue;
      const r = freceiver[k];
      if (r === k || r < 0) continue;
      if (isOceanFine[k] || isOceanFine[r]) continue;
      landSegs++;
    }
    const masked = buildFineValleyGeometry({ out, planar: out.planar });
    // segmentCount = vIdx.length/6 counts the TWO quads (left+right rail) emitted per channel
    // segment, so it is 2× the number of land-only channel segments.
    expect(masked.userData.segmentCount).toBe(landSegs * 2);
  });
});
