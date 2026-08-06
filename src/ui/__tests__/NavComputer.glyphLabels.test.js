// NavComputer N-dot glyph (AC8) + deferred label pass (AC9) — headless coverage
// of the render methods that wire the pure helpers into the prism. Drives bare
// `Object.create'd` instances with a stubbed 2D context (the DOM-bound
// constructor is out of scope headless, same pattern as NavComputer.merge.test).
//
// The live AC8/AC9 drives (Max's gate) assert dot counts and zero label overlap
// on :5176; these tests pin the same invariants at the method boundary so a
// regression in the wiring (not just the pure geometry) fails in CI.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NavComputer } from '../NavComputer.js';
import { rectsOverlap } from '../labelPlacement.js';
import { multiplicityForSeed } from '../../generation/multiplicityOracle.js';
import { RealStarCatalog } from '../../generation/RealStarCatalog.js';
import { KnownSystems } from '../../generation/KnownSystems.js';
import { GalacticMap } from '../../generation/GalacticMap.js';

// Minimal 2D-context stub: records arc() draws and answers measureText with a
// length-proportional width so overlap tests are realistic.
function makeCtx() {
  const arcs = [];
  return {
    _arcs: arcs,
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left',
    measureText: (s) => ({ width: s.length * 6 }),
    beginPath() {},
    arc(x, y, r) { arcs.push({ x, y, r }); },
    fill() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText() {},
  };
}

function bareNav() {
  const nav = Object.create(NavComputer.prototype);
  return nav;
}

describe('_drawStarGlyph — N dots, centroid at the marker (AC8)', () => {
  it('draws 1 dot for a single', () => {
    const nav = bareNav();
    const ctx = makeCtx();
    nav._drawStarGlyph(ctx, 100, 100, 4, 1, '#fff', null);
    expect(ctx._arcs.length).toBe(1);
    expect(ctx._arcs[0]).toMatchObject({ x: 100, y: 100 });
  });

  it('draws 2 offset dots for a binary (base-case look preserved)', () => {
    const nav = bareNav();
    const ctx = makeCtx();
    nav._drawStarGlyph(ctx, 100, 100, 4, 2, '#fff', '#abc');
    expect(ctx._arcs.length).toBe(2);
    // Left dot at cx-offset, right at cx+offset; both on the marker's y line.
    expect(ctx._arcs[0].x).toBeLessThan(100);
    expect(ctx._arcs[1].x).toBeGreaterThan(100);
    expect(ctx._arcs[0].y).toBe(100);
    expect(ctx._arcs[1].y).toBe(100);
  });

  it('draws 3 dots for a triple, centroid staying at the marker', () => {
    const nav = bareNav();
    const ctx = makeCtx();
    nav._drawStarGlyph(ctx, 100, 200, 5, 3, '#fff', null);
    expect(ctx._arcs.length).toBe(3);
    const meanX = ctx._arcs.reduce((s, a) => s + a.x, 0) / 3;
    const meanY = ctx._arcs.reduce((s, a) => s + a.y, 0) / 3;
    // Ring layout is symmetric → centroid coincides with the marker (positions
    // never move; interview ruling 1).
    expect(meanX).toBeCloseTo(100, 6);
    expect(meanY).toBeCloseTo(200, 6);
  });
});

describe('_glyphMult — caches per entry (AC8)', () => {
  it('returns a cached multiplicity without recomputing when overlay-ready state is unchanged', () => {
    const nav = bareNav();
    nav._realStarCatalog = { overlay: { ready: true } };
    nav._gm = {};
    const star = { _navMult: { count: 2, closeCount: 2, farCount: 0 }, _navMultReady: true };
    const got = nav._glyphMult(star);
    // Cache hit: the exact stored object comes back, no oracle call.
    expect(got).toBe(star._navMult);
    expect(got.count).toBe(2);
  });

  it('falls back to null-safe count when the oracle throws (missing gm)', () => {
    const nav = bareNav();
    nav._realStarCatalog = null;
    nav._gm = null; // deriveGalaxyContext will not exist → procgen path handles null gm
    // A procgen bare-seed star: oracle rolls with null context, returns a count.
    const star = { seed: 'x', name: null, spectral: 'G', wx: 8, wy: 0, wz: 0 };
    const m = nav._glyphMult(star);
    // Either a valid multiplicity object or null (both are handled by the draw).
    expect(m === null || typeof m.count === 'number').toBe(true);
    // The result is cached on the entry.
    expect('_navMult' in star).toBe(true);
  });
});

describe('_glyphDotCount — per-marker dot count from the oracle result (AC8)', () => {
  // The oracle answers with a SYSTEM's multiplicity; this method splits it across
  // the system's markers. Synthetic mult objects + a _localStarNames set pin the
  // decision at the boundary (the real-data block below proves the wiring).
  function nav(localNames = []) {
    const n = bareNav();
    n._localStarNames = new Set(localNames);
    return n;
  }

  it('draws count when there are no far companions (Sirius: closeCount 2 → 2)', () => {
    const m = { count: 2, closeCount: 2, farCount: 0, farNames: [], source: 'table' };
    expect(nav()._glyphDotCount({ name: 'Sirius' }, m)).toBe(2);
  });

  it('draws count when the far companion has NO own marker (36 Oph: 2+1 deduped → 3)', () => {
    const m = { count: 3, closeCount: 2, farCount: 1, farNames: ['HD 156026'], source: 'table' };
    // HD 156026 is not in the marker set (deduped to a Guniibuu alias at regen).
    expect(nav(['Guniibuu'])._glyphDotCount({ name: 'Guniibuu' }, m)).toBe(3);
  });

  it('EXCLUDES a far companion that has its OWN marker (α Cen A+B: 2+1, Proxima separate → 2)', () => {
    const m = { count: 3, closeCount: 2, farCount: 1, farNames: ['Proxima Centauri'], source: 'known' };
    // Proxima IS a marker → drawn on its own marker, not the primary's.
    const n = nav(['Rigil Kentaurus', 'Proxima Centauri']);
    expect(n._glyphDotCount({ name: 'Rigil Kentaurus' }, m)).toBe(2);
  });

  it('draws 1 for the far-companion marker itself (Proxima routes to α Cen but is one star here)', () => {
    // Proxima's own oracle lookup routes to Alpha Centauri (alias) → farNames
    // contains Proxima's own name → this marker is the wide companion → 1 dot.
    const m = { count: 3, closeCount: 2, farCount: 1, farNames: ['Proxima Centauri'], source: 'known' };
    expect(nav(['Rigil Kentaurus', 'Proxima Centauri'])
      ._glyphDotCount({ name: 'Proxima Centauri' }, m)).toBe(1);
  });

  it('ζ Reticuli: primary + wide-but-deduped secondary → 2', () => {
    const m = { count: 2, closeCount: 1, farCount: 1, farNames: ['Zet-2 Ret'], source: 'table' };
    expect(nav(['Zet-1 Ret'])._glyphDotCount({ name: 'Zet-1 Ret' }, m)).toBe(2);
  });

  it('never returns below 1, and falls back to the base case on a null mult', () => {
    const m = { count: 3, closeCount: 2, farCount: 1, farNames: ['Proxima Centauri'], source: 'known' };
    // Degenerate: every member somehow has its own marker → clamp at 1, not 0.
    expect(nav(['Proxima Centauri'])._glyphDotCount({ name: 'Proxima Centauri' }, m)).toBe(1);
    expect(nav()._glyphDotCount({ name: 'x', _isBinary: true }, null)).toBe(2);
    expect(nav()._glyphDotCount({ name: 'x', _isBinary: false }, null)).toBe(1);
  });
});

describe('AC8 dot counts over the REAL catalog rows (finding-#4 guard)', () => {
  // Drives the ACTUAL oracle + catalog + KnownSystems for the exact rows the
  // verifier's probe used — the gap the synthetic tests missed. _localStarNames
  // is the full catalog name set (hyg ∪ supplement) = every name that renders as
  // its own marker, so "far companion has its own marker" is answered honestly
  // (Proxima is a supplement row; the deduped secondaries are not rows at all).
  const HERE = dirname(fileURLToPath(import.meta.url));
  const DATA = (name) => join(HERE, '../../../public/assets/data', name);
  const HYG = JSON.parse(readFileSync(DATA('hyg-stars.json'), 'utf8'));
  const supplement = JSON.parse(readFileSync(DATA('real-star-supplement.json'), 'utf8'));
  const contents = JSON.parse(readFileSync(DATA('real-system-contents.json'), 'utf8'));
  const CATALOG_STARS = HYG.concat(supplement.stars);
  const byName = (n) => CATALOG_STARS.find((s) => s.name === n);

  let deps;
  let markerNames;

  beforeAll(() => {
    const map = new GalacticMap('well-dipper-galaxy-1');
    const catalog = new RealStarCatalog();
    catalog.ingestCatalogData(HYG, { stars: supplement.stars }, { hosts: contents.hosts });
    KnownSystems.associate(catalog, map); // wire catalog aliases as main.js does
    deps = { overlay: catalog.overlay, galacticMap: map };
    markerNames = new Set(CATALOG_STARS.map((s) => s.name).filter(Boolean));
  });

  /** Reproduce the render's per-marker decision for a real catalog row. */
  function dotsFor(name) {
    const row = byName(name);
    expect(row, `catalog row for ${name}`).toBeTruthy();
    const mult = multiplicityForSeed(
      { name, worldX: row.x, worldY: row.y, worldZ: row.z, type: row.spect ?? row.type },
      deps,
    );
    const n = bareNav();
    n._localStarNames = markerNames;
    return n._glyphDotCount({ name }, mult);
  }

  // The AC8 observables, asserted against arrival-truth resolution — not synthetics.
  it('Sirius marker = 2 dots (A + white dwarf)', () => expect(dotsFor('Sirius')).toBe(2));
  it('TRAPPIST-1 = 1 dot (snum pin)', () => expect(dotsFor('TRAPPIST-1')).toBe(1));
  it('36 Ophiuchi (Guniibuu) = 3 dots (one marker, tertiary deduped in)', () =>
    expect(dotsFor('Guniibuu')).toBe(3));
  it('61 Cygni (HD 201091) = 2 dots', () => expect(dotsFor('HD 201091')).toBe(2));
  it('ζ Reticuli (Zet-1 Ret) = 2 dots', () => expect(dotsFor('Zet-1 Ret')).toBe(2));
  it('Alpha Centauri A (Rigil Kentaurus) = 2 dots — Proxima excluded (own marker)', () =>
    expect(dotsFor('Rigil Kentaurus')).toBe(2));
  it('Proxima Centauri = 1 dot — its own marker, a single red dwarf', () =>
    expect(dotsFor('Proxima Centauri')).toBe(1));
});

describe('_drawLabelPass — overlap-free drawn labels, leaders, fade (AC9)', () => {
  function runPass(queue) {
    const nav = bareNav();
    const ctx = makeCtx();
    nav._labelQueue = queue;
    nav._drawLabelPass(ctx);
    return nav._labelRects;
  }

  it('publishes an empty rect array for an empty queue', () => {
    const nav = bareNav();
    nav._labelQueue = [];
    nav._drawLabelPass(makeCtx());
    expect(nav._labelRects).toEqual([]);
  });

  it('leaves a lone label at its home position, un-faded, no leader', () => {
    const rects = runPass([
      { name: 'Sol', homeX: 50, homeY: 100, anchorX: 46, anchorY: 100, tier: 1, dist: 0.01 },
    ]);
    expect(rects.length).toBe(1);
    expect(rects[0].faded).toBe(false);
    expect(rects[0].leader).toBe(false);
  });

  it('resolves a dense pile so NO drawn (non-faded) labels overlap', () => {
    // Five labels stacked on nearly the same spot — the worst prism case
    // (Rigil-Proxima-style pileup / dense procgen field).
    const queue = [];
    for (let i = 0; i < 5; i++) {
      queue.push({
        name: `Star-${i}`, homeX: 60, homeY: 100 + i * 2,
        anchorX: 56, anchorY: 100 + i * 2, tier: 0, dist: i * 0.1,
      });
    }
    const rects = runPass(queue);
    const drawn = rects.filter((r) => !r.faded);
    for (let a = 0; a < drawn.length; a++) {
      for (let b = a + 1; b < drawn.length; b++) {
        expect(rectsOverlap(drawn[a], drawn[b])).toBe(false);
      }
    }
    expect(drawn.length).toBeGreaterThan(0);
  });

  it('flags a leader on a label displaced off its home slot', () => {
    // Two hard-overlapping labels: the lower-priority one steps a full line
    // (12px > half-line threshold) → leader line.
    const rects = runPass([
      { name: 'HighPri', homeX: 60, homeY: 100, anchorX: 56, anchorY: 100, tier: 2, dist: 0 },
      { name: 'LowPri', homeX: 60, homeY: 101, anchorX: 56, anchorY: 101, tier: 0, dist: 5 },
    ]);
    const low = rects.find((r) => r.name === 'LowPri');
    expect(low.leader).toBe(true);
  });

  it('priority order: the higher tier keeps its home slot regardless of queue order', () => {
    const rects = runPass([
      { name: 'low', homeX: 60, homeY: 100, anchorX: 56, anchorY: 100, tier: 0, dist: 9 },
      { name: 'high', homeX: 60, homeY: 102, anchorX: 56, anchorY: 102, tier: 2, dist: 9 },
    ]);
    const high = rects.find((r) => r.name === 'high');
    // High-tier home box top = baseline(102) - fontSize(10) = 92, undisplaced.
    expect(high.y).toBe(92);
    expect(high.leader).toBe(false);
  });
});
