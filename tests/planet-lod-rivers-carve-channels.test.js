// planet-lod-rivers-carve-channels.test.js — AC2 (rivers-fluvial-coupling): the carve cube gains
// two ADDITIVE channels baked from the retained router graph — G = mouth/apron (point feature, tent
// across the valley cross-section, sized by accum) and B = Strahler-order/width (channel-wide
// property, FLAT across the cross-section so a high-order trunk's EDGE still beats a crossing
// low-order valley's CENTER under MAX blend).
//
// The AC2 change is additive-only: R = valley depth (aDepth) is unchanged, and G/B are new. This
// suite is the cheap unit lock on the additive contract so future edits can't silently break it —
// it exercises buildValleyGeometry's aMouth/aOrder emission (validated live for AC1, untested in CI
// per the audit) against a hand-built routed graph with one mouth node and one trunk.
//
// Why CHAIKIN_ITERS:0 — with smoothing OFF each routed path node maps to exactly ONE [L,C,R] rail
// triple, so the per-triple assertions (tent for mouth, flat for order) are deterministic; the
// shipped R=depth tent rasterization is the same code path and is asserted unchanged here too.
import { describe, it, expect } from 'vitest';
import { buildValleyGeometry, DEFAULT_PARAMS } from '../planet-lod-rivers.js';

// Minimal hand-built drainage: ocean sink 0; mouth 1 (land channel whose receiver is ocean);
// mid-trunk 2; headwater 3. Chain: 3 -> 2 -> 1 -> 0(ocean). strahler peaks on the trunk (1,2),
// drops at the headwater (3). accum largest at the mouth so mouthStrength normalizes to 1 there.
function buildFixture() {
  const N = 4;
  // four distinct unit directions so rails don't degenerate
  const dirs = [
    [0, 0, 1],            // 0 ocean
    [0.2, 0, 0.98],       // 1 mouth
    [0.4, 0, 0.92],       // 2 mid-trunk
    [0.6, 0, 0.80],       // 3 headwater
  ];
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const d = dirs[i], L = Math.hypot(d[0], d[1], d[2]);
    pos[i * 3] = d[0] / L; pos[i * 3 + 1] = d[1] / L; pos[i * 3 + 2] = d[2] / L;
  }
  const adj = [[1], [0, 2], [1, 3], [2]];   // linear adjacency along the chain
  const mesh = { adj, pos, N };

  const receiver = new Int32Array([0, 0, 1, 2]); // 0 self (ocean), 1->0, 2->1, 3->2
  const accum    = new Float32Array([0, 4, 3, 1]); // monotone-nondecreasing downstream; max at mouth
  const strahler = new Int32Array([0, 3, 3, 2]);   // trunk order 3, headwater order 2
  const isChannel = new Uint8Array([0, 1, 1, 1]);  // land nodes are channels; ocean is not
  const maxOrder = 3;
  const routed = { receiver, accum, strahler, maxOrder, isChannel };

  const isOcean = new Uint8Array([1, 0, 0, 0]);
  return { mesh, routed, isOcean };
}

const PARAMS = { ...DEFAULT_PARAMS, CHAIKIN_ITERS: 0 };

describe('AC2 carve-cube extra channels (additive mouth G + order B)', () => {
  const { mesh, routed, isOcean } = buildFixture();
  const geo = buildValleyGeometry({ mesh, routed, isOcean, params: PARAMS });

  const pos = geo.getAttribute('position');
  const aDepth = geo.getAttribute('aDepth').array;
  const aMouth = geo.getAttribute('aMouth').array;
  const aOrder = geo.getAttribute('aOrder').array;

  it('emits aDepth, aMouth and aOrder attributes (1 float each per vertex)', () => {
    expect(aDepth).toBeTruthy();
    expect(aMouth).toBeTruthy();
    expect(aOrder).toBeTruthy();
    // vertices come in [L,C,R] rail triples — count is a multiple of 3
    expect(pos.count % 3).toBe(0);
    expect(aMouth.length).toBe(pos.count);
    expect(aOrder.length).toBe(pos.count);
  });

  it('aMouth is a TENT (0 on the L/R edges, strength only at the C rail)', () => {
    for (let v = 0; v + 2 < aMouth.length; v += 3) {
      expect(aMouth[v]).toBe(0);       // L edge
      expect(aMouth[v + 2]).toBe(0);   // R edge
      expect(aMouth[v + 1]).toBeGreaterThanOrEqual(0); // C: 0 or strength, never negative
    }
  });

  it('aMouth is nonzero ONLY at/near the real mouth node and zero on headwaters', () => {
    // The chain path is [headwater 3, mid 2, mouth 1, ocean 0] -> 4 rail triples (centers).
    // Only the mouth (node 1) has isMouth true, so exactly one center carries mouth strength,
    // and (accum max at the mouth) it normalizes to 1.0.
    const centers = [];
    for (let v = 1; v < aMouth.length; v += 3) centers.push(aMouth[v]);
    const nonzero = centers.filter(m => m > 0);
    expect(nonzero.length).toBe(1);               // mouth only
    expect(nonzero[0]).toBeCloseTo(1.0, 6);       // normalized by max-mouth accum
    // headwater center (first triple in the path) must be a dry zero
    expect(centers[0]).toBe(0);
  });

  it('aOrder is FLAT across each rail triple (channel-wide property, not a tent)', () => {
    for (let v = 0; v + 2 < aOrder.length; v += 3) {
      expect(aOrder[v]).toBe(aOrder[v + 1]);
      expect(aOrder[v + 1]).toBe(aOrder[v + 2]);
    }
  });

  it('aOrder is monotone with Strahler order (trunk > headwater) and normalized to [0,1]', () => {
    const centers = [];
    for (let v = 1; v < aOrder.length; v += 3) centers.push(aOrder[v]);
    // path order: [headwater(s=2), mid(s=3), mouth(s=3), ocean(s=0)]
    const headwater = centers[0], trunk = centers[1];
    expect(headwater).toBeGreaterThanOrEqual(0);
    expect(trunk).toBeLessThanOrEqual(1);
    expect(trunk).toBeGreaterThan(headwater);     // higher Strahler -> higher B
    // orderNorm = (s-MIN_ORDER)/(maxOrder-MIN_ORDER) = (2-2)/(3-2)=0 ; (3-2)/(3-2)=1
    expect(headwater).toBeCloseTo(0, 6);
    expect(trunk).toBeCloseTo(1, 6);
  });

  it('R=depth tent is unchanged by the added channels (0 edges, order-lerped center)', () => {
    // Shipped contract: aDepth is a tent (0 on edges) with the center lerped LO..HI by order.
    for (let v = 0; v + 2 < aDepth.length; v += 3) {
      expect(aDepth[v]).toBe(0);
      expect(aDepth[v + 2]).toBe(0);
      const c = aDepth[v + 1];
      expect(c).toBeGreaterThanOrEqual(PARAMS.VALLEY_DEPTH_LO - 1e-6);
      expect(c).toBeLessThanOrEqual(PARAMS.VALLEY_DEPTH_HI + 1e-6);
    }
  });
});
