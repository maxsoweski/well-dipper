// Far-companion edge chips in the SYSTEM view (AC4) — headless coverage.
//
// `systemData.farCompanions` carries wide, gravitationally-bound members that
// sqrt-AU orbital projection cannot honestly place (Proxima at ~13,000 AU) and
// that the payload gives no direction vector for. They render as informational
// EDGE CHIPS anchored at a consistent view-boundary slot (top-right), each
// showing the member's name, spectral color, separation, and its planets —
// making the Alpha Centauri / 36 Ophiuchi triples finally visible AS triples.
//
// Two layers, same split as the AC8/AC9 render coverage:
//   • pure geometry/content — `buildFarCompanionChips` + `formatSeparationAU`
//   • render wiring — `_drawFarCompanionChips` on a bare `Object.create`'d
//     instance with a stubbed 2D context (DOM-bound constructor out of scope).

import { describe, it, expect } from 'vitest';
import { NavComputer } from '../NavComputer.js';
import { buildFarCompanionChips, formatSeparationAU } from '../farCompanionChips.js';
import { rectsOverlap } from '../labelPlacement.js';

// Length-proportional measure so width math is deterministic in the pure tests.
const measure6 = (s) => s.length * 6;

// Rich 2D-context stub: records the draw calls the chip render makes.
function makeCtx() {
  const calls = { arc: [], roundRect: [], fillText: [], fill: 0, stroke: 0 };
  return {
    _calls: calls,
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, textAlign: 'left',
    measureText: (s) => ({ width: s.length * 6 }),
    beginPath() {},
    arc(x, y, r) { calls.arc.push({ x, y, r }); },
    roundRect(x, y, w, h, r) { calls.roundRect.push({ x, y, w, h, r }); },
    rect() {},
    fillRect() {}, strokeRect() {},
    moveTo() {}, lineTo() {},
    fill() { calls.fill++; },
    stroke() { calls.stroke++; },
    fillText(t, x, y) { calls.fillText.push({ t, x, y }); },
    createRadialGradient() { return { addColorStop() {} }; },
    setLineDash() {}, ellipse() {},
  };
}

function bareNav() {
  const nav = Object.create(NavComputer.prototype);
  nav._mouseX = -9999;
  nav._mouseY = -9999;
  nav._canvas = { width: 800, height: 600 };
  return nav;
}

// The concrete far-companion payloads StarSystemGenerator emits (~:856):
// { name, class, type (normalized single letter), separationAU, planets? }.
const PROXIMA = {
  name: 'Proxima Centauri', class: 'M5.5Ve', type: 'M', separationAU: 13000,
  planets: [
    { letter: 'b', name: 'Proxima Centauri b' },
    { letter: 'd', name: 'Proxima Centauri d' },
  ],
};
const OPH_C = {
  name: 'HD 156026', class: 'K5V', type: 'K', separationAU: 4400,
  // 36 Oph's wide tertiary carries no archived planets → no planet line.
};

describe('formatSeparationAU — readable large-number separation', () => {
  it('groups thousands', () => {
    expect(formatSeparationAU(13000)).toBe('13,000');
    expect(formatSeparationAU(4400)).toBe('4,400');
    expect(formatSeparationAU(8700)).toBe('8,700');
  });
  it('keeps a small fractional separation legible', () => {
    expect(formatSeparationAU(82.3)).toBe('82.3');
  });
  it('degrades safely on a missing/NaN value', () => {
    expect(formatSeparationAU(null)).toBe('?');
    expect(formatSeparationAU(undefined)).toBe('?');
    expect(formatSeparationAU(NaN)).toBe('?');
  });
});

describe('buildFarCompanionChips — content + geometry (pure)', () => {
  const opts = () => ({
    right: 788, top: 40, measure: measure6,
    colorForType: (t) => ({ M: '#ff9664', K: '#ffc480' }[t] || '#fff'),
  });

  it('Alpha Centauri: one chip carrying Proxima with planets b and d', () => {
    const chips = buildFarCompanionChips([PROXIMA], opts());
    expect(chips.length).toBe(1);
    const c = chips[0];
    expect(c.name).toBe('Proxima Centauri');
    expect(c.sepLine).toBe('far companion · 13,000 AU');
    expect(c.planetLetters).toEqual(['b', 'd']);
    expect(c.planetLine).toBe('planets: b, d');
    expect(c.color).toBe('#ff9664'); // M-dwarf swatch
    expect(c.w).toBeGreaterThan(0);
    expect(c.h).toBeGreaterThan(0);
  });

  it('36 Ophiuchi shape: one chip, no planets → no planet line', () => {
    const chips = buildFarCompanionChips([OPH_C], opts());
    expect(chips.length).toBe(1);
    expect(chips[0].name).toBe('HD 156026');
    expect(chips[0].sepLine).toBe('far companion · 4,400 AU');
    expect(chips[0].planetLetters).toEqual([]);
    expect(chips[0].planetLine).toBeNull();
    expect(chips[0].color).toBe('#ffc480'); // K swatch
  });

  it('carries the SOURCE index on each descriptor — falsy slots skipped without desync (AC5 drill key)', () => {
    // The component drill-in keys componentSystems[idx] off the chip's SOURCE
    // index into farCompanions (1:1 by emission). A falsy far entry is skipped
    // by the chip loop, so a position-based counter would desync; the
    // descriptor must carry the source index explicitly.
    const chips = buildFarCompanionChips([null, PROXIMA, undefined, OPH_C], opts());
    expect(chips.map((c) => c.index)).toEqual([1, 3]);
    // The plain 1:1 case keys identically.
    expect(buildFarCompanionChips([PROXIMA, OPH_C], opts()).map((c) => c.index)).toEqual([0, 1]);
  });

  it('no far companions: absent or empty → zero chips, no geometry', () => {
    expect(buildFarCompanionChips(undefined, opts())).toEqual([]);
    expect(buildFarCompanionChips([], opts())).toEqual([]);
  });

  it('chips are right-anchored to a consistent boundary slot', () => {
    const chips = buildFarCompanionChips([PROXIMA], opts());
    // Right edge of every chip lands on the anchor line; positions never move.
    expect(chips[0].x + chips[0].w).toBe(788);
  });

  it('two far members: two chips stacked without collision', () => {
    const chips = buildFarCompanionChips([PROXIMA, OPH_C], opts());
    expect(chips.length).toBe(2);
    // Second chip sits fully below the first — no overlap.
    expect(chips[1].y).toBeGreaterThanOrEqual(chips[0].y + chips[0].h);
    expect(rectsOverlap(chips[0], chips[1])).toBe(false);
    // Both still right-anchored.
    expect(chips[0].x + chips[0].w).toBe(788);
    expect(chips[1].x + chips[1].w).toBe(788);
  });
});

describe('_drawFarCompanionChips — render wiring (bare prototype harness)', () => {
  it('draws nothing and publishes an empty rect list when farCompanions is absent', () => {
    const nav = bareNav();
    nav._systemData = { planets: [] }; // procgen-shaped: no farCompanions key
    const ctx = makeCtx();
    nav._drawFarCompanionChips(ctx, 800, 550);
    expect(nav._farChipRects).toEqual([]);
    // Zero draw calls → the chip feature cannot shift any existing layout.
    expect(ctx._calls.roundRect.length).toBe(0);
    expect(ctx._calls.fillText.length).toBe(0);
    expect(ctx._calls.arc.length).toBe(0);
  });

  it('draws nothing when farCompanions is an empty array', () => {
    const nav = bareNav();
    nav._systemData = { farCompanions: [] };
    const ctx = makeCtx();
    nav._drawFarCompanionChips(ctx, 800, 550);
    expect(nav._farChipRects).toEqual([]);
    expect(ctx._calls.roundRect.length).toBe(0);
  });

  it('draws one chip (panel + color dot + name) for Alpha Centauri', () => {
    const nav = bareNav();
    nav._systemData = { farCompanions: [PROXIMA] };
    const ctx = makeCtx();
    nav._drawFarCompanionChips(ctx, 800, 550);
    expect(nav._farChipRects.length).toBe(1);
    // Panel drawn (roundRect), color dot drawn (arc), name text drawn.
    expect(ctx._calls.roundRect.length).toBe(1);
    expect(ctx._calls.arc.length).toBeGreaterThanOrEqual(1);
    expect(ctx._calls.fillText.some((f) => f.t === 'Proxima Centauri')).toBe(true);
    expect(ctx._calls.fillText.some((f) => f.t === 'far companion · 13,000 AU')).toBe(true);
    expect(ctx._calls.fillText.some((f) => f.t === 'planets: b, d')).toBe(true);
  });

  it('stacks two chips without overlap for a two-far-member system', () => {
    const nav = bareNav();
    nav._systemData = { farCompanions: [PROXIMA, OPH_C] };
    const ctx = makeCtx();
    nav._drawFarCompanionChips(ctx, 800, 550);
    expect(nav._farChipRects.length).toBe(2);
    expect(rectsOverlap(nav._farChipRects[0], nav._farChipRects[1])).toBe(false);
  });

  it('hovering a chip sets _hoveredFarChip and draws a tooltip', () => {
    const nav = bareNav();
    nav._systemData = { farCompanions: [PROXIMA] };
    // First pass (mouse away) to learn the chip rect.
    nav._drawFarCompanionChips(makeCtx(), 800, 550);
    const r = nav._farChipRects[0];
    expect(nav._hoveredFarChip).toBeNull();
    // Second pass with the cursor over the chip centre.
    nav._mouseX = r.x + r.w / 2;
    nav._mouseY = r.y + r.h / 2;
    const ctx = makeCtx();
    nav._drawFarCompanionChips(ctx, 800, 550);
    expect(nav._hoveredFarChip).not.toBeNull();
    expect(nav._hoveredFarChip.name).toBe('Proxima Centauri');
    // Tooltip adds its own panel → chip panel (1) + tooltip panel (1) = 2.
    expect(ctx._calls.roundRect.length).toBe(2);
  });

  it('leaves _hoveredFarChip null when the cursor is away from every chip', () => {
    const nav = bareNav();
    nav._systemData = { farCompanions: [PROXIMA] };
    nav._mouseX = 10; nav._mouseY = 500; // bottom-left, nowhere near top-right chips
    nav._drawFarCompanionChips(makeCtx(), 800, 550);
    expect(nav._hoveredFarChip).toBeNull();
  });

  it('resolves the chip color from _SPECTRAL_COLORS by normalized type', () => {
    const nav = bareNav();
    nav._systemData = { farCompanions: [PROXIMA] };
    nav._drawFarCompanionChips(makeCtx(), 800, 550);
    expect(nav._farChipRects[0].chip.color).toBe(NavComputer._SPECTRAL_COLORS.M);
  });
});
