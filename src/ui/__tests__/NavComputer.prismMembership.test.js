// Prism co-membership cue (AC2 of system-identity-grammar-2026-07-17) — headless
// coverage. When one KNOWN system's members render as separate prism markers
// (α Cen A+B marker + Proxima's own marker) the prism must SAY they are one
// system: a membership label suffix on the far member + a tether on hover/select.
//
// Layers pinned here:
//   • resolveMembership (pure) — far marker / primary marker / procgen / single,
//     with an injected findByAlias AND against the REAL KnownSystems registry.
//   • membershipLabel (pure)   — suffix composition.
//   • _drawLabelPass wiring    — a suffixed label measures/declutters as its full
//     string (reuses the glyphLabels dense-pile fixture).
//   • _drawMembershipCues wiring — tether drawn ONLY for the hovered/selected
//     marker; nothing hovered/selected → zero tether strokes; procgen → none.
//
// Same bare-prototype harness as NavComputer.glyphLabels.test.js: the DOM-bound
// constructor is out of scope headless.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NavComputer } from '../NavComputer.js';
import { resolveMembership, membershipLabel } from '../prismMembership.js';
import { rectsOverlap } from '../labelPlacement.js';
import { KnownSystems } from '../../generation/KnownSystems.js';
import { RealStarCatalog } from '../../generation/RealStarCatalog.js';
import { GalacticMap } from '../../generation/GalacticMap.js';

function bareNav() {
  return Object.create(NavComputer.prototype);
}

// Line-segment-recording 2D context stub: every stroke() after a moveTo/lineTo
// pushes one segment so tether draws are counted. setLineDash is a no-op the
// production code guards for.
function makeLineCtx() {
  const segments = [];
  let from = null;
  let to = null;
  return {
    _segments: segments,
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, textAlign: 'left',
    measureText: (s) => ({ width: s.length * 6 }),
    setLineDash() {},
    beginPath() { from = null; to = null; },
    moveTo(x, y) { from = { x, y }; },
    lineTo(x, y) { to = { x, y }; },
    stroke() { if (from && to) segments.push({ from: { ...from }, to: { ...to } }); },
    arc() {}, fill() {}, fillText() {}, closePath() {},
    save() {}, restore() {},
  };
}

// A findByAlias stub over a tiny fixture registry (mirrors the real entry shape
// resolveMembership reads: entry.name = system, entry._companion.components[0]
// = primary). Alpha Centauri only; everything else resolves to null.
function stubFindByAlias(name /*, pos */) {
  const ALPHA = { name: 'Alpha Centauri', _companion: { components: [{ name: 'Rigil Kentaurus' }, { name: 'Toliman' }] } };
  if (name === 'Proxima Centauri' || name === 'Rigil Kentaurus' || name === 'Toliman' || name === 'Alpha Centauri') {
    return ALPHA;
  }
  return null;
}

describe('resolveMembership — role resolution with an injected findByAlias (AC2)', () => {
  const localStarNames = new Set(['Rigil Kentaurus', 'Proxima Centauri']);
  const opts = { localStarNames, findByAlias: stubFindByAlias };

  it('FAR marker (Proxima): far member of Alpha Centauri, tethered to the primary', () => {
    const star = { name: 'Proxima Centauri', wx: 8.0009, wy: 0.02496, wz: -0.00094 };
    const mult = { count: 3, closeCount: 2, farCount: 1, farNames: ['Proxima Centauri'], source: 'known' };
    const m = resolveMembership(star, mult, opts);
    expect(m.isFarMember).toBe(true);
    expect(m.systemName).toBe('Alpha Centauri');
    expect(m.memberMarkerNames).toEqual(['Rigil Kentaurus']);
  });

  it('FAR marker whose primary has NO own marker: suffix yes (isFarMember), no tether target', () => {
    const star = { name: 'Proxima Centauri', wx: 8, wy: 0, wz: 0 };
    const mult = { farNames: ['Proxima Centauri'] };
    const m = resolveMembership(star, mult, { localStarNames: new Set(['Proxima Centauri']), findByAlias: stubFindByAlias });
    expect(m.isFarMember).toBe(true);
    expect(m.systemName).toBe('Alpha Centauri');
    expect(m.memberMarkerNames).toEqual([]);
  });

  it('PRIMARY marker (Rigil): co-member is Proxima (its own marker), not a far member', () => {
    const star = { name: 'Rigil Kentaurus', wx: 8.00095, wy: 0.02498, wz: -0.00092 };
    const mult = { count: 3, closeCount: 2, farCount: 1, farNames: ['Proxima Centauri'], source: 'known' };
    const m = resolveMembership(star, mult, opts);
    expect(m.isFarMember).toBe(false);
    expect(m.systemName).toBe('Alpha Centauri');
    expect(m.memberMarkerNames).toEqual(['Proxima Centauri']);
  });

  it('PRIMARY marker whose far companion is DEDUPED (36 Oph): one marker → no cue', () => {
    const star = { name: 'Guniibuu', wx: 1, wy: 2, wz: 3 };
    // The K5 tertiary collapsed to a Guniibuu alias at regen — no own marker.
    const mult = { count: 3, closeCount: 2, farCount: 1, farNames: ['HD 156026'], source: 'table' };
    const m = resolveMembership(star, mult, { localStarNames: new Set(['Guniibuu']), findByAlias: stubFindByAlias });
    expect(m).toEqual({ isFarMember: false, systemName: null, memberMarkerNames: [] });
  });

  it('procgen binary (farNames empty): no cue', () => {
    const star = { name: 'Kesh-9482', wx: 4, wy: 4, wz: 4 };
    const mult = { count: 2, closeCount: 2, farCount: 0, farNames: [], source: 'procgen' };
    expect(resolveMembership(star, mult, opts)).toEqual({ isFarMember: false, systemName: null, memberMarkerNames: [] });
  });

  it('known single (farNames empty): no cue', () => {
    const star = { name: 'TRAPPIST-1', wx: 8, wy: 0, wz: 0 };
    const mult = { count: 1, closeCount: 1, farCount: 0, farNames: [], source: 'known' };
    expect(resolveMembership(star, mult, opts)).toEqual({ isFarMember: false, systemName: null, memberMarkerNames: [] });
  });

  it('null mult / nameless star / no far markers → NONE (defensive)', () => {
    expect(resolveMembership({ name: 'X' }, null, opts).memberMarkerNames).toEqual([]);
    expect(resolveMembership({}, { farNames: ['Proxima Centauri'] }, opts).isFarMember).toBe(false);
    // primary whose sole far member is NOT a marker → NONE even with findByAlias.
    const m = resolveMembership({ name: 'Rigil Kentaurus' }, { farNames: ['Proxima Centauri'] }, { localStarNames: new Set(['Rigil Kentaurus']), findByAlias: stubFindByAlias });
    expect(m).toEqual({ isFarMember: false, systemName: null, memberMarkerNames: [] });
  });
});

describe('resolveMembership — against the REAL KnownSystems registry (finding-#3 guard)', () => {
  // Same wiring main.js does: ingest the catalog + associate so the close-
  // component aliases (Rigil/Toliman) resolve. Proxima resolves EAGERLY (a
  // curated far-companion alias) — proves the entry.name / components[0] wiring.
  const HERE = dirname(fileURLToPath(import.meta.url));
  const DATA = (name) => join(HERE, '../../../public/assets/data', name);

  beforeAll(() => {
    const map = new GalacticMap('well-dipper-galaxy-1');
    const catalog = new RealStarCatalog();
    const HYG = JSON.parse(readFileSync(DATA('hyg-stars.json'), 'utf8'));
    const supplement = JSON.parse(readFileSync(DATA('real-star-supplement.json'), 'utf8'));
    const contents = JSON.parse(readFileSync(DATA('real-system-contents.json'), 'utf8'));
    catalog.ingestCatalogData(HYG, { stars: supplement.stars }, { hosts: contents.hosts });
    KnownSystems.associate(catalog, map);
  });

  const localStarNames = new Set(['Rigil Kentaurus', 'Proxima Centauri']);

  it('Proxima resolves to Alpha Centauri with primary Rigil Kentaurus', () => {
    const star = { name: 'Proxima Centauri', wx: 8.000902, wy: 0.024956, wz: -0.000937 };
    const m = resolveMembership(star, { farNames: ['Proxima Centauri'] }, { localStarNames, findByAlias: KnownSystems.findByAlias });
    expect(m).toEqual({ isFarMember: true, systemName: 'Alpha Centauri', memberMarkerNames: ['Rigil Kentaurus'] });
  });

  it('Rigil (primary) names the system Alpha Centauri and tethers to Proxima', () => {
    const star = { name: 'Rigil Kentaurus', wx: 8.000948, wy: 0.024984, wz: -0.000924 };
    const m = resolveMembership(star, { farNames: ['Proxima Centauri'] }, { localStarNames, findByAlias: KnownSystems.findByAlias });
    expect(m).toEqual({ isFarMember: false, systemName: 'Alpha Centauri', memberMarkerNames: ['Proxima Centauri'] });
  });
});

describe('membershipLabel — suffix composition (AC2)', () => {
  it('appends " · <system>" for a far member', () => {
    expect(membershipLabel('Proxima Centauri', { isFarMember: true, systemName: 'Alpha Centauri' }))
      .toBe('Proxima Centauri · Alpha Centauri');
  });
  it('leaves a primary/close marker unchanged', () => {
    expect(membershipLabel('Rigil Kentaurus', { isFarMember: false, systemName: 'Alpha Centauri' }))
      .toBe('Rigil Kentaurus');
  });
  it('leaves the name unchanged for NONE / missing systemName', () => {
    expect(membershipLabel('Kesh-9482', { isFarMember: false, systemName: null })).toBe('Kesh-9482');
    expect(membershipLabel('Kesh-9482', null)).toBe('Kesh-9482');
    expect(membershipLabel('X', { isFarMember: true, systemName: null })).toBe('X');
  });
});

describe('_drawLabelPass — suffixed label flows through declutter (AC2 × AC9)', () => {
  function makeCtx() {
    return {
      font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, textAlign: 'left',
      measureText: (s) => ({ width: s.length * 6 }),
      beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText() {},
    };
  }

  it('measures the FULL suffixed string and keeps drawn labels overlap-free', () => {
    const nav = bareNav();
    const ctx = makeCtx();
    // The α Cen pileup: a suffixed far member stacked with the primary + procgen
    // neighbours on nearly the same spot — the worst prism case.
    nav._labelQueue = [
      { name: 'Proxima Centauri · Alpha Centauri', homeX: 60, homeY: 100, anchorX: 56, anchorY: 100, tier: 2, dist: 0.01 },
      { name: 'Rigil Kentaurus', homeX: 60, homeY: 102, anchorX: 56, anchorY: 102, tier: 1, dist: 0.02 },
      { name: 'Kesh-1', homeX: 61, homeY: 104, anchorX: 57, anchorY: 104, tier: 0, dist: 0.5 },
      { name: 'Kesh-2', homeX: 61, homeY: 106, anchorX: 57, anchorY: 106, tier: 0, dist: 0.6 },
    ];
    nav._drawLabelPass(ctx);
    const rects = nav._labelRects;
    const suffixed = rects.find((r) => r.name.startsWith('Proxima'));
    expect(suffixed).toBeTruthy();
    // Full string measured (33 chars * 6 + 2 padding) — NOT the bare 'Proxima Centauri'.
    expect(suffixed.w).toBe('Proxima Centauri · Alpha Centauri'.length * 6 + 2);
    const drawn = rects.filter((r) => !r.faded);
    for (let a = 0; a < drawn.length; a++) {
      for (let b = a + 1; b < drawn.length; b++) {
        expect(rectsOverlap(drawn[a], drawn[b])).toBe(false);
      }
    }
    expect(drawn.length).toBeGreaterThan(0);
  });
});

describe('_drawMembershipCues — tether gated to hover/selection (AC2)', () => {
  // Screen-space marker points; the tether connects them. _glyphMult is fed from
  // a pre-cached _navMult so no oracle/overlay is needed.
  const RIGIL = { name: 'Rigil Kentaurus', wx: 8.00095, wy: 0.02498, wz: -0.00092,
    _navMult: { farNames: ['Proxima Centauri'] }, _navMultReady: true };
  const PROXIMA = { name: 'Proxima Centauri', wx: 8.0009, wy: 0.02496, wz: -0.00094,
    _navMult: { farNames: ['Proxima Centauri'] }, _navMultReady: true };
  const PROCGEN = { name: 'Kesh-9482', wx: 4, wy: 4, wz: 4,
    _navMult: { farNames: [] }, _navMultReady: true };

  function projByName() {
    return new Map([
      ['Rigil Kentaurus', { x: 100, y: 100 }],
      ['Proxima Centauri', { x: 140, y: 108 }],
      ['Kesh-9482', { x: 300, y: 50 }],
    ]);
  }

  function nav() {
    const n = bareNav();
    n._localStarNames = new Set(['Rigil Kentaurus', 'Proxima Centauri']);
    n._selectedNavStar = null;
    n._hoveredLocalStar = null;
    return n;
  }

  it('draws NO tether when nothing is hovered or selected', () => {
    const n = nav();
    const ctx = makeLineCtx();
    n._drawMembershipCues(ctx, projByName());
    expect(ctx._segments.length).toBe(0);
  });

  it('selecting Proxima (far marker) tethers to the α Cen A+B marker', () => {
    const n = nav();
    n._selectedNavStar = PROXIMA;
    const ctx = makeLineCtx();
    n._drawMembershipCues(ctx, projByName());
    expect(ctx._segments.length).toBe(1);
    const seg = ctx._segments[0];
    // From Proxima's point to Rigil's point (order-agnostic endpoints).
    const pts = [seg.from, seg.to];
    expect(pts).toContainEqual({ x: 140, y: 108 });
    expect(pts).toContainEqual({ x: 100, y: 100 });
  });

  it('selecting the primary (Rigil) tethers to Proxima', () => {
    const n = nav();
    n._selectedNavStar = RIGIL;
    const ctx = makeLineCtx();
    n._drawMembershipCues(ctx, projByName());
    expect(ctx._segments.length).toBe(1);
    const pts = [ctx._segments[0].from, ctx._segments[0].to];
    expect(pts).toContainEqual({ x: 100, y: 100 });
    expect(pts).toContainEqual({ x: 140, y: 108 });
  });

  it('hovering a member draws the tether even with no selection', () => {
    const n = nav();
    n._hoveredLocalStar = { star: PROXIMA, sx: 140, sy: 108 };
    const ctx = makeLineCtx();
    n._drawMembershipCues(ctx, projByName());
    expect(ctx._segments.length).toBe(1);
  });

  it('does not double-draw when the same marker is both hovered and selected', () => {
    const n = nav();
    n._selectedNavStar = PROXIMA;
    n._hoveredLocalStar = { star: PROXIMA, sx: 140, sy: 108 };
    const ctx = makeLineCtx();
    n._drawMembershipCues(ctx, projByName());
    expect(ctx._segments.length).toBe(1);
  });

  it('a selected PROCGEN star draws no tether', () => {
    const n = nav();
    n._selectedNavStar = PROCGEN;
    const ctx = makeLineCtx();
    n._drawMembershipCues(ctx, projByName());
    expect(ctx._segments.length).toBe(0);
  });

  it('draws no tether when the co-member marker is off-view (not in projByName)', () => {
    const n = nav();
    n._selectedNavStar = PROXIMA;
    const ctx = makeLineCtx();
    // projByName without Rigil → nothing to tether to.
    n._drawMembershipCues(ctx, new Map([['Proxima Centauri', { x: 140, y: 108 }]]));
    expect(ctx._segments.length).toBe(0);
  });
});
