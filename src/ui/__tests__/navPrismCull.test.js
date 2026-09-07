/**
 * navPrismCull — the PRISM screen-bounds cull.
 *
 * ⭐ WHY THIS FILE EXISTS RATHER THAN AN ASSERTION BOLTED ONTO AN EXISTING PRISM TEST: there was NO
 * end-to-end coverage of `_renderLocal`'s per-marker loop at realistic density. Every prism test in
 * the repo either unit-tests a pure helper (`placeLabels`, `_drawStarGlyph`, `resolveMembership`)
 * with a handful of hand-built inputs, or drives `nav.render()` to assert chrome geometry. Nothing
 * had ever counted what the loop actually does to 100+ markers, which is exactly the measurement the
 * cull is answering.
 *
 * ⛔ AND THE CULL MUST BE PROVED TO FIRE, NOT ASSERTED TO EXIST. A cull whose test only shows "the
 * on-screen star still draws" passes identically when the cull is deleted. Every case below either
 * counts a REDUCTION against the same scene with the cull's margin opened wide enough to disable it,
 * or names a marker that must survive.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { prismMarkerMayShow, PRISM_CULL_MARGIN } from '../navPrismCull.js';

const P = (x, y) => ({ x, y });
const W = 400, H = 300;               // a drawable rect; H stands in for navDrawH(h), not h
const show = (a, b, m) => prismMarkerMayShow(a, b, W, H, m);

describe('prismMarkerMayShow — the trivial reject', () => {
  it('keeps a marker whose both ends are inside', () => {
    expect(show(P(200, 150), P(200, 90))).toBe(true);
  });

  it('keeps a marker sitting exactly on each edge', () => {
    for (const p of [P(0, 150), P(W, 150), P(200, 0), P(200, H)]) {
      expect(show(p, p), `${p.x},${p.y}`).toBe(true);
    }
  });

  it('rejects a marker whose both ends are outside the SAME edge', () => {
    const m = PRISM_CULL_MARGIN;
    expect(show(P(-m - 1, 150), P(-m - 2, 90)), 'left').toBe(false);
    expect(show(P(W + m + 1, 150), P(W + m + 2, 90)), 'right').toBe(false);
    expect(show(P(200, -m - 1), P(200, -m - 2)), 'above').toBe(false);
    expect(show(P(200, H + m + 1), P(200, H + m + 2)), 'below').toBe(false);
  });

  it('⭐ KEEPS a star far above the frame whose PLANE END is inside it — the whole reason this is a segment test', () => {
    // The dashed line runs from the galactic plane up to the star. At a steep tilt the star can be
    // hundreds of pixels above the top edge while its line still crosses the visible field. A
    // starP-plus-margin test would cull this and silently take the line with it.
    expect(show(P(200, 150), P(200, -400))).toBe(true);
  });

  it('keeps the diagonal case it cannot cheaply decide — conservative in the safe direction', () => {
    // Both ends outside, but on DIFFERENT edges: the trivial reject says nothing, so it draws.
    expect(show(P(-50, 150), P(200, -50))).toBe(true);
  });

  it('the margin covers every fixed extent a marker draws, hover radius included', () => {
    // 12 is `hitDist` at NavComputer.js:2038 and the largest of the six extents in the module's
    // table. A marker one pixel inside the margin must survive; one pixel outside must not.
    expect(PRISM_CULL_MARGIN).toBe(12);
    expect(show(P(-PRISM_CULL_MARGIN, 150), P(-PRISM_CULL_MARGIN, 150))).toBe(true);
    expect(show(P(-PRISM_CULL_MARGIN - 1, 150), P(-PRISM_CULL_MARGIN - 1, 150))).toBe(false);
  });

  it('falls OPEN on a non-finite projection rather than rejecting it', () => {
    // Every comparison against NaN is false, so the marker is kept and drawn exactly as today.
    expect(show(P(NaN, NaN), P(NaN, NaN))).toBe(true);
    expect(show(P(Infinity, 150), P(200, 150))).toBe(true);
  });

  it('tests against the drawable height it is given, not the canvas height', () => {
    // `_renderLocal` passes navDrawH(h); the strip below it is the tab reserve and a marker there
    // is behind the tabs. A cull handed `h` would draw into that strip.
    const belowDrawH = P(200, H + 40);
    expect(prismMarkerMayShow(belowDrawH, belowDrawH, W, H)).toBe(false);
    expect(prismMarkerMayShow(belowDrawH, belowDrawH, W, H + 100)).toBe(true);
  });
});

describe('what the cull removes, at density', () => {
  /** A field of markers spread far wider than the frame, the shape the prism actually produces. */
  const field = (n) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, r = 900;
    const p = P(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * 0.6);
    return { planeP: P(p.x, H / 2), starP: p };
  });

  it('⭐ REJECTS THE MAJORITY OF A REALISTIC FIELD, AND THE CONTROL PROVES IT IS THE CULL DOING IT', () => {
    const markers = field(200);
    const kept = markers.filter((m) => prismMarkerMayShow(m.planeP, m.starP, W, H)).length;
    // The control: the same scene with a margin wide enough that nothing can be rejected. If the
    // function were a no-op both numbers would be 200 and the reduction below would read as zero.
    const uncullled = markers.filter((m) => prismMarkerMayShow(m.planeP, m.starP, W, H, 5000)).length;
    expect(uncullled).toBe(200);
    expect(kept).toBeLessThan(200 * 0.5);
    expect(kept).toBeGreaterThan(0);
  });

  it('never rejects a marker whose plane end is on screen, however far out the star is', () => {
    // These are the ones the segment test exists for; at any density they all survive.
    const markers = Array.from({ length: 50 }, (_, i) => ({
      planeP: P(10 + i * 7, H / 2), starP: P(10 + i * 7, -2000),
    }));
    expect(markers.every((m) => prismMarkerMayShow(m.planeP, m.starP, W, H))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE LIVENESS PROBE — is the cull actually WIRED, or is `navPrismCull.js` a green module nothing
// calls? Every test above passes unchanged if `_renderLocal` never imports it.
//
// ⛔ THE FIRST PROBE WRITTEN HERE WAS VACUOUS AND IS RECORDED SO IT IS NOT REWRITTEN. It rendered the
// same star count at two world offsets — one field around the view centre, one 50 kpc out — and
// expected the far field to draw fewer arcs. Both drew exactly 250. The reason is that `render()`
// QUERIES THE STARFIELD and overwrites `_localStars`: 212 real stars replaced the 120 hand-built
// ones before a single marker was drawn, so the two branches were the identical scene and the
// assertion could not fail for any wiring. That is the repo's own general form — ask what would
// make this green test fail; if the answer is "no input in its sample", it is pinning nothing.
//
// ⭐ SO THE PROBE MOCKS THE MODULE INSTEAD, AND IS THEREFORE INDEPENDENT OF THE SCENE ENTIRELY.
// Force `prismMarkerMayShow` to reject everything and the arc count must COLLAPSE. If `_renderLocal`
// did not import it, mocking it would change nothing and both numbers would match.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the cull is wired into _renderLocal', () => {
  /** Render one PRISM frame and count arcs, with the cull module optionally forced to reject. */
  const arcsWithCull = async (rejectEverything) => {
    vi.resetModules();
    if (rejectEverything) {
      vi.doMock('../navPrismCull.js', () => ({ PRISM_CULL_MARGIN: 12, prismMarkerMayShow: () => false }));
    } else {
      vi.doUnmock('../navPrismCull.js');
    }
    const { makeHeadlessNav } = await import('./helpers/headlessNav.mjs');
    const { nav, rec } = await makeHeadlessNav({ width: 400, height: 300 });
    nav._levelIndex = 3;                       // PRISM
    nav.render();                              // queries the real starfield — the scene is identical either way
    const stars = nav._localStars.length;
    rec.calls.length = 0;
    nav.render();
    return { arcs: rec.calls.filter((c) => c.op === 'arc').length, stars };
  };

  afterEach(() => { vi.doUnmock('../navPrismCull.js'); vi.resetModules(); });

  it('⛔ FORCING THE CULL TO REJECT EVERYTHING COLLAPSES THE ARC COUNT — the module is on the draw path', async () => {
    const live = await arcsWithCull(false);
    const rejected = await arcsWithCull(true);
    expect(live.stars, 'the scene must contain stars, or the probe measures chrome')
      .toBeGreaterThan(0);
    expect(live.stars, 'BOTH branches must render the SAME scene, or this is an apples-to-oranges count')
      .toBe(rejected.stars);
    expect(live.arcs).toBeGreaterThan(0);
    expect(rejected.arcs).toBeLessThan(live.arcs);
  });
});
