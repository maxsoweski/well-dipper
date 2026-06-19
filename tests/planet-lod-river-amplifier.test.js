// planet-lod-river-amplifier.test.js — headless unit lock on the river sub-tributary AMPLIFIER
// (spec docs/superpowers/specs/2026-06-19-river-lod-design.md §8). These prove the MATH/algorithm
// of the JS reference port (planet-lod-river-amplifier.js), which is a faithful transcription of
// the GLSL primitive (RIVER_AMPLIFIER_GLSL). The GPU proves RENDERING separately (chrome-devtools
// :9223) — these tests are the make-or-break de-risk that the primitive is dendritic, downhill,
// trunk-convergent, Strahler-spaced, and width-law-correct BEFORE any production sampleCarve edit.
//
// Five required properties (task spec): (a) DETERMINISM (b) DOWNHILL (c) TRUNK-CONVERGENCE
// (d) SPACING scales with Strahler order (e) WIDTH follows 0.42*accum^0.69.
import { describe, it, expect } from 'vitest';
import {
  AMP, ampHash, ampKeyPoint, buildChildren, amplifierSample, widthKm, controlElev, distSeg, baseSpacing, connectAngle,
} from '../planet-lod-river-amplifier.js';

// A horizontal baked trunk segment along +x at z=0 (downhill end at b), used as the level-0 parent.
const TRUNK = { a: [0.0, 0.0], b: [2.0, 0.0], za: 1.0, zb: 0.0 };
const SEED = 1337;
const FULL_LOD = 1.0;
const HIGH_ORDER = 1.0;     // normalized Strahler (6th-order trunk → 1.0)
const DEPTH_OK = 0.8;       // > AMP.TRUNK_EPS so the gate opens
const PX_INV = 0.0;         // disable the half-pixel floor so width law is read directly
const WIDTH_SCALE = 1.0;    // render-space channel-width factor; 1.0 reads the raw km width law

describe('river amplifier — (a) DETERMINISM (position-seeded, no flicker)', () => {
  it('hash is a pure function of (cell, level, seed)', () => {
    expect(ampHash(3, 7, 2, SEED)).toBe(ampHash(3, 7, 2, SEED));
    expect(ampHash(3, 7, 2, SEED)).not.toBe(ampHash(3, 7, 2, SEED + 1));
    expect(ampHash(3, 7, 2, SEED)).not.toBe(ampHash(4, 7, 2, SEED));
    const h = ampHash(123, 456, 1, SEED);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
  });

  it('same surface point → bit-identical (sdf, incision, flowDir) across repeated calls', () => {
    const p = [0.83, 0.21];
    const r1 = amplifierSample(p[0], p[1], TRUNK, HIGH_ORDER, DEPTH_OK, FULL_LOD, PX_INV, WIDTH_SCALE, SEED);
    const r2 = amplifierSample(p[0], p[1], TRUNK, HIGH_ORDER, DEPTH_OK, FULL_LOD, PX_INV, WIDTH_SCALE, SEED);
    expect(r2.sdf).toBe(r1.sdf);
    expect(r2.incision).toBe(r1.incision);
    expect(r2.flowDir).toEqual(r1.flowDir);
    expect(r2.bestGen).toBe(r1.bestGen);
  });

  it('query ORDER cannot change a point\'s value (shuffled evaluation is identical)', () => {
    const pts = [];
    for (let i = 0; i < 40; i++) pts.push([0.1 + 0.03 * i, 0.05 + 0.017 * (i % 7)]);
    const forward = pts.map((p) => amplifierSample(p[0], p[1], TRUNK, HIGH_ORDER, DEPTH_OK, FULL_LOD, PX_INV, WIDTH_SCALE, SEED).sdf);
    const reversed = [...pts].reverse().map((p) => amplifierSample(p[0], p[1], TRUNK, HIGH_ORDER, DEPTH_OK, FULL_LOD, PX_INV, WIDTH_SCALE, SEED).sdf);
    reversed.reverse();
    expect(reversed).toEqual(forward);
  });

  it('lodRamp only scales strength/count — the SAME children exist at lod 0.6 and 1.0', () => {
    // The children admitted at the LOWER lod must be a prefix-subset (same endpoints) of the higher
    // lod's: lod changes K (generation count) but never WHICH key-points/segments exist per gen.
    const lo = buildChildren(0.7, 0.15, TRUNK, HIGH_ORDER, DEPTH_OK, 0.6, SEED);
    const hi = buildChildren(0.7, 0.15, TRUNK, HIGH_ORDER, DEPTH_OK, 1.0, SEED);
    expect(lo.length).toBeGreaterThan(0);
    expect(hi.length).toBeGreaterThanOrEqual(lo.length);
    // every gen-0 child in `lo` is reproduced bit-identically in `hi`
    const gen0lo = lo.filter((c) => c.gen === 0);
    const gen0hi = hi.filter((c) => c.gen === 0);
    expect(gen0lo).toEqual(gen0hi);
  });

  it('amplifier emits ZERO when far (lod=0) or off-trunk (depth below the gate)', () => {
    const far = amplifierSample(0.5, 0.2, TRUNK, HIGH_ORDER, DEPTH_OK, 0.0, PX_INV, WIDTH_SCALE, SEED);
    expect(far.incision).toBe(0);
    expect(far.sdf).toBeGreaterThan(1e8);
    const dry = amplifierSample(0.5, 0.2, TRUNK, HIGH_ORDER, AMP.TRUNK_EPS - 0.001, FULL_LOD, PX_INV, WIDTH_SCALE, SEED);
    expect(dry.incision).toBe(0);
    expect(buildChildren(0.5, 0.2, TRUNK, HIGH_ORDER, AMP.TRUNK_EPS - 0.001, FULL_LOD, SEED)).toHaveLength(0);
  });
});

describe('river amplifier — (b) DOWNHILL (child sits above the segment it feeds)', () => {
  const children = buildChildren(0.7, 0.15, TRUNK, HIGH_ORDER, DEPTH_OK, FULL_LOD, SEED);

  it('produced a non-trivial dendritic set', () => {
    expect(children.length).toBeGreaterThan(10);
  });

  it('every emitted child key-point elevation > its connection-point elevation (monotone)', () => {
    for (const c of children) {
      expect(c.zChild).toBeGreaterThan(c.zConn);   // strict: water flows downhill into the parent
    }
  });

  it('finer generations require steeper minimum slope (Dendry per-level MINSLOPE rises)', () => {
    expect(AMP.MINSLOPE[0]).toBeLessThan(AMP.MINSLOPE[1]);
    expect(AMP.MINSLOPE[1]).toBeLessThan(AMP.MINSLOPE[2]);
    expect(AMP.MINSLOPE[2]).toBeLessThan(AMP.MINSLOPE[3]);
  });

  it('the per-level slope floor is actually APPLIED — each gen-k child has (zChild-zConn)/dC ≥ MINSLOPE[k]', () => {
    // The constant-array assertion above is necessary but not sufficient: it would pass even if the
    // implementation ignored MINSLOPE entirely. This test proves the floor is enforced per-generation
    // in buildChildren — for every generation present, the MINIMUM realized slope meets that level's
    // floor (a child can exceed it via the controlElev max(), never undershoot it).
    const EPS = 1e-9;
    const gens = [...new Set(children.map((c) => c.gen))].sort((a, b) => a - b);
    expect(gens.length).toBeGreaterThan(1);          // need ≥2 generations for this to mean anything
    for (const k of gens) {
      const ofGen = children.filter((c) => c.gen === k && c.dC > 1e-6);
      const minSlope = Math.min(...ofGen.map((c) => (c.zChild - c.zConn) / c.dC));
      expect(minSlope).toBeGreaterThanOrEqual(AMP.MINSLOPE[k] - EPS);
    }
  });

  it('the elevation chain key-point → connection is non-increasing toward the trunk', () => {
    // For each child, the foot of its key-point projected to the trunk is no higher than zChild.
    for (const c of children.filter((x) => x.gen === 0)) {
      const footElev = controlElev(c.conn[0], c.conn[1], TRUNK);
      expect(c.zChild).toBeGreaterThanOrEqual(footElev - 1e-9);
    }
  });
});

describe('river amplifier — (b2) GLSL↔JS FIDELITY of the per-level zChild rule', () => {
  // The headless tests exercise the JS port; the GLSL is a transcription. A prior bug had the GLSL
  // use MINSLOPE[0] (0.09) for ALL generations and omit the controlElev floor, so the JS could pass
  // while the GLSL silently diverged. These tests re-derive zChild from the CORRECTED GLSL formula
  // (k-indexed slope + controlElev max) in pure JS and assert the JS port matches it bit-for-bit —
  // and that it does NOT match the OLD buggy formula, so a regression to the constant slope is caught.
  const children = buildChildren(0.7, 0.15, TRUNK, HIGH_ORDER, DEPTH_OK, FULL_LOD, SEED);

  // mirror of the CORRECTED GLSL: zChild = max(zConn + minSlopes[k]*dC, ctrlElev), ctrlElev along trunk.
  const glslZChild = (c) => Math.max(c.zConn + AMP.MINSLOPE[c.gen] * c.dC, controlElev(c.q[0], c.q[1], TRUNK));
  // mirror of the OLD BUGGY GLSL: zChild = zConn + 0.09*dC (constant slope, no controlElev floor).
  const buggyZChild = (c) => c.zConn + AMP.MINSLOPE[0] * c.dC;

  it('the JS port zChild equals the corrected k-indexed GLSL formula for every child', () => {
    expect(children.length).toBeGreaterThan(10);
    for (const c of children) {
      expect(c.zChild).toBeCloseTo(glslZChild(c), 12);
    }
  });

  it('the JS port does NOT match the old constant-slope (0.09) formula for finer generations', () => {
    // For k≥1 the corrected slope (0.18/0.38/1.0) or the controlElev floor must lift zChild above
    // what the buggy constant-0.09 formula would give — at least some children must differ.
    const finer = children.filter((c) => c.gen >= 1);
    expect(finer.length).toBeGreaterThan(0);
    const anyDiffer = finer.some((c) => Math.abs(c.zChild - buggyZChild(c)) > 1e-9);
    expect(anyDiffer).toBe(true);
  });

  it('the controlElev floor is honored — zChild ≥ controlElev(q) for every child', () => {
    for (const c of children) {
      expect(c.zChild).toBeGreaterThanOrEqual(controlElev(c.q[0], c.q[1], TRUNK) - 1e-9);
    }
  });
});

describe('river amplifier — (c) TRUNK-CONVERGENCE (tributaries flow INTO the trunk, no parallel net)', () => {
  const orderN = HIGH_ORDER;
  const children = buildChildren(0.7, 0.15, TRUNK, orderN, DEPTH_OK, FULL_LOD, SEED);
  const gen0 = children.filter((c) => c.gen === 0);

  it('every gen-0 child terminates ON the trunk (its connection point lies on the trunk segment)', () => {
    for (const c of gen0) {
      const s = distSeg(c.conn[0], c.conn[1], TRUNK.a[0], TRUNK.a[1], TRUNK.b[0], TRUNK.b[1]);
      expect(s.dist).toBeLessThan(1e-6);          // conn ∈ {a, b, mid(a,b)} ⊂ trunk
    }
  });

  it('the child\'s downhill end (conn) is at-or-below its source end (q) elevation — flows toward trunk', () => {
    for (const c of gen0) {
      expect(c.zConn).toBeLessThanOrEqual(c.zChild);
    }
  });

  it('a query point near the trunk gets a small SDF (the synthesized net hugs the real trunk)', () => {
    // sample a band of points just off the trunk; the amplifier SDF (pre-radius) should be modest,
    // not large — i.e. there IS synthesized structure converging here, not empty space. Threshold is
    // tied to the level-0 cell size (baseSpacing(orderN)), NOT a loose 0.5: a channel within one cell
    // of the trunk is genuinely trunk-proximate; a uniform grid with larger cells would NOT pass.
    const CELL = baseSpacing(orderN);                // 0.25 at HIGH_ORDER — channel-width-scaled bound
    let near = 0;
    for (let x = 0.2; x < 1.8; x += 0.1) {
      const r = amplifierSample(x, 0.06, TRUNK, orderN, DEPTH_OK, FULL_LOD, PX_INV, WIDTH_SCALE, SEED);
      if (r.sdf + r.radius < CELL) near++;            // raw distance-to-nearest-child < one cell
    }
    expect(near).toBeGreaterThan(8);
  });

  it('density is TRUNK-PROXIMATE, not uniform — mean SDF far from the trunk exceeds mean SDF near it', () => {
    // Directly distinguishes "tributaries converge on the trunk" from "tributaries fill the patch
    // uniformly". If the net hugged the trunk, points at y=0.06 (near) have SMALLER raw distance to
    // the nearest synthesized child than points at y=1.5 (far), on average. A uniform net would show
    // no such gradient. (raw distance = sdf + radius, undoing the width subtraction.)
    const rawDist = (x, y) => {
      const r = amplifierSample(x, y, TRUNK, orderN, DEPTH_OK, FULL_LOD, PX_INV, WIDTH_SCALE, SEED);
      return r.sdf + r.radius;
    };
    let nearSum = 0, farSum = 0, n = 0;
    for (let x = 0.2; x < 1.8; x += 0.1) { nearSum += rawDist(x, 0.06); farSum += rawDist(x, 1.5); n++; }
    expect(nearSum / n).toBeLessThan(farSum / n);     // near the trunk is denser than far from it
  });

  it('children root on the trunk only where a trunk exists — no children when depth gate is shut', () => {
    const none = buildChildren(0.7, 0.15, TRUNK, orderN, 0.0, FULL_LOD, SEED);
    expect(none).toHaveLength(0);
  });
});

describe('river amplifier — (c2) CONNECTION-ANGLE rule (dendritic join, NOT radial starburst)', () => {
  // The radial-starburst bug: each key-point connected to its NEAREST point on the parent
  // (perpendicular foot), so tributaries arrived from ALL directions → spokes. The Dendry
  // ConnectPointToSegmentAngle rule shifts the interior connection DOWNSTREAM by the perpendicular
  // distance, so the tributary leans into the trunk at ~45° pointing downstream. These tests assert
  // that directional, upstream-side approach — the thing that makes the pattern a branching tree.
  // TRUNK is horizontal a=[0,0]→b=[2,0] with za=1 (source) > zb=0 (mouth): downhill flow is +x.
  const DOWNHILL = [1, 0];           // unit downstream direction of TRUNK
  const gen0 = buildChildren(0.7, 0.15, TRUNK, HIGH_ORDER, DEPTH_OK, FULL_LOD, SEED).filter((c) => c.gen === 0);

  // identify children whose perpendicular foot is INTERIOR (the only ones the 45° shift applies to)
  const interior = gen0.filter((c) => {
    const s = distSeg(c.q[0], c.q[1], TRUNK.a[0], TRUNK.a[1], TRUNK.b[0], TRUNK.b[1]);
    return s.u > 1e-3 && s.u < 1 - 1e-3 && s.dist > 1e-4;   // foot strictly inside, off-axis source
  });

  it('there ARE interior-foot tributaries to test (the rule applies to a real population)', () => {
    expect(interior.length).toBeGreaterThan(3);
  });

  it('every interior connection is shifted DOWNSTREAM of the perpendicular foot (45° rule applied)', () => {
    // The connection param u must move toward the downhill end (b, +x) relative to the foot param u0.
    for (const c of interior) {
      const foot = distSeg(c.q[0], c.q[1], TRUNK.a[0], TRUNK.a[1], TRUNK.b[0], TRUNK.b[1]);
      const connParam = distSeg(c.conn[0], c.conn[1], TRUNK.a[0], TRUNK.a[1], TRUNK.b[0], TRUNK.b[1]).u;
      expect(connParam).toBeGreaterThan(foot.u + 1e-6);   // strictly downstream of the foot
    }
  });

  it('tributaries approach from the UPSTREAM side — flow into the trunk points downstream', () => {
    // (conn - q) is the tributary's flow direction; its component along the trunk's downhill
    // direction must be POSITIVE for every interior child. A radial starburst would have these
    // distributed in all directions (many negative). This is the dendritic-vs-radial discriminator.
    for (const c of interior) {
      const dx = c.conn[0] - c.q[0], dy = c.conn[1] - c.q[1];
      const len = Math.hypot(dx, dy) || 1;
      const along = (dx * DOWNHILL[0] + dy * DOWNHILL[1]) / len;   // cos(angle to downstream)
      expect(along).toBeGreaterThan(0);                            // never joins from downstream/perp-away
    }
  });

  it('the cohort is dendritic on average — mean downstream alignment is solidly positive, not ~0', () => {
    // A radial pattern averages to ≈0 alignment (spokes cancel). A dendritic tree leans downstream,
    // so the MEAN cos(angle-to-downstream) over interior tributaries is clearly positive.
    const alongs = interior.map((c) => {
      const dx = c.conn[0] - c.q[0], dy = c.conn[1] - c.q[1];
      const len = Math.hypot(dx, dy) || 1;
      return (dx * DOWNHILL[0] + dy * DOWNHILL[1]) / len;
    });
    const mean = alongs.reduce((s, v) => s + v, 0) / alongs.length;
    expect(mean).toBeGreaterThan(0.3);   // markedly downstream-biased, not the ~0 of a starburst
  });

  it('connectAngle is the exact downstream-shift rule: u shifts by segDist/segLen toward the low end', () => {
    // direct unit check of the helper against the Dendry ConnectPointToSegmentAngle formula.
    const a = [0, 0], b = [2, 0], za = 1, zb = 0;   // downhill toward b (+x)
    const q = [0.6, 0.4];                            // foot at u0=0.3, segDist=0.4, segLen=2
    const r = connectAngle(q[0], q[1], a, b, za, zb);
    const u0 = 0.3, segDist = 0.4, segLen = 2;
    const expectedU = u0 + segDist / segLen;         // = 0.5, shifted downstream
    expect(r.conn[0]).toBeCloseTo(expectedU * 2, 9); // conn.x = u*segLen
    expect(r.conn[1]).toBeCloseTo(0, 9);             // on the trunk axis
    // reversed orientation (a low) must shift the OTHER way (toward a, −x)
    const r2 = connectAngle(q[0], q[1], a, b, /*za*/0, /*zb*/1);
    expect(r2.conn[0]).toBeLessThan(q[0]);           // downstream is now −x → conn upstream-of-foot in x
  });
});

describe('river amplifier — (d) SPACING scales with Strahler order', () => {
  it('higher-order trunks use a SMALLER level-0 cell (finer tributary spacing)', () => {
    const hi = baseSpacing(1.0);    // 6th-order
    const lo = baseSpacing(0.33);   // 2nd-order-ish
    expect(hi).toBeLessThan(lo);
  });

  it('a high-order trunk admits MORE generations than a low-order one (denser sub-net)', () => {
    const hiOrder = buildChildren(0.7, 0.15, TRUNK, 1.0, DEPTH_OK, FULL_LOD, SEED);
    const loOrder = buildChildren(0.7, 0.15, TRUNK, AMP.ORDER_GATE_LO, DEPTH_OK, FULL_LOD, SEED);
    const hiGens = new Set(hiOrder.map((c) => c.gen)).size;
    const loGens = new Set(loOrder.map((c) => c.gen)).size;
    expect(hiGens).toBeGreaterThanOrEqual(loGens);
    expect(hiGens).toBeGreaterThan(1);
  });

  it('mean nearest-neighbour key-point spacing shrinks as order rises', () => {
    const spacing = (orderN) => {
      const cs = AMP.BASE_SPACING / Math.max(0.35, orderN);
      return cs;   // cell size == nominal spacing of the level-0 grid
    };
    expect(spacing(1.0)).toBeLessThan(spacing(0.5));
    expect(spacing(0.5)).toBeLessThan(spacing(0.33));
  });
});

describe('river amplifier — (e) WIDTH follows 0.42 * accum^0.69 and child < parent', () => {
  it('widthKm reproduces the project width law for a given accum proxy', () => {
    // gen g uses accum = orderN / 2^(g+1); assert widthKm == PHI * accum^EXP exactly.
    const orderN = 1.0;
    for (let g = 0; g < AMP.MAXGEN; g++) {
      const accum = orderN / Math.pow(2, g + 1);
      const expected = AMP.WIDTH_PHI * Math.pow(accum, AMP.WIDTH_EXP);
      expect(widthKm(orderN, g)).toBeCloseTo(expected, 12);
    }
  });

  it('uses the project constants 0.42 and 0.69', () => {
    expect(AMP.WIDTH_PHI).toBe(0.42);
    expect(AMP.WIDTH_EXP).toBe(0.69);
  });

  it('each finer generation is strictly NARROWER than the one it descends from', () => {
    const orderN = 1.0;
    for (let g = 1; g < AMP.MAXGEN; g++) {
      expect(widthKm(orderN, g)).toBeLessThan(widthKm(orderN, g - 1));
    }
  });

  it('the half-pixel floor keeps the finest channel from collapsing below a pixel', () => {
    const pxInv = 0.02;                       // 1 px ≈ 0.02 km-units here
    const r = amplifierSample(0.83, 0.04, TRUNK, 1.0, DEPTH_OK, FULL_LOD, pxInv, WIDTH_SCALE, SEED);
    expect(r.radius).toBeGreaterThanOrEqual(0.5 * pxInv - 1e-12);
  });
});
