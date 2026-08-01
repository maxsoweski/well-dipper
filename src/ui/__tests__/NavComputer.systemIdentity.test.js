// AC3 — system-identity naming for the SYSTEM view. Headless coverage of the
// pure derivations (title / component annotation / star-hover names) plus the
// _drawSystemHeader wiring that routes them into the prism, driven by bare
// `Object.create(NavComputer.prototype)` instances with a stubbed 2D context
// (same pattern as NavComputer.glyphLabels.test — the DOM-bound constructor is
// out of scope headless).
//
// The invariant this workstream protects: a real multi-star system reads as ONE
// system on every path. The SYSTEM view of any member marker is titled by the
// SYSTEM, carries a "via <component>" annotation, and shows the real component
// names on star hover — while a procgen system (no _knownSystemNames) renders
// byte-identically to today (explicit regression below).

import { describe, it, expect } from 'vitest';
import { NavComputer } from '../NavComputer.js';
import {
  deriveSystemTitle,
  deriveSystemAnnotation,
  deriveStarHoverName,
} from '../systemIdentity.js';

// ── Fixtures ──────────────────────────────────────────────────────────────
// Alpha Centauri as the arrival/preview resolver attaches it: the primary
// marker is 'Rigil Kentaurus', the authored components are star/star2, and
// Proxima Centauri rides in farCompanions (its own true-position marker draws
// separately — AC1). _knownSystemNames.planets has authored entries; index 2
// is a procgen-fill planet with no authored entry.
function alphaCenSys() {
  return {
    isBinary: true,
    star: { type: 'G' },
    star2: { type: 'K' },
    ageGyr: 5.3,
    planets: [{}, {}, {}],
    farCompanions: [
      { name: 'Proxima Centauri', class: 'M5.5Ve', type: 'M', separationAU: 8700, planets: [{}, {}] },
    ],
    _knownSystemNames: {
      system: 'Alpha Centauri',
      star: 'Rigil Kentaurus',
      star2: 'Toliman',
      planets: [{ name: 'Rigil Kentaurus b' }, { name: 'Toliman c' }],
    },
  };
}

// A known single system: marker name == system name, no far companions.
function trappistSys() {
  return {
    isBinary: false,
    star: { type: 'M' },
    ageGyr: 7.6,
    planets: [{}, {}, {}, {}, {}, {}, {}],
    _knownSystemNames: {
      system: 'TRAPPIST-1',
      star: 'TRAPPIST-1',
      planets: [{ name: 'TRAPPIST-1 b' }],
    },
  };
}

// A procgen system: NO _knownSystemNames key at all (fact 2 — procgen never
// gains it), single star. Must render exactly as before AC3.
function procgenSys() {
  return {
    isBinary: false,
    star: { type: 'G' },
    ageGyr: 4.6,
    planets: [{}, {}, {}],
  };
}

// A procgen binary (star2 present, isBinary true, still no _knownSystemNames).
function procgenBinarySys() {
  return {
    isBinary: true,
    star: { type: 'F' },
    star2: { type: 'M' },
    ageGyr: 2.1,
    planets: [{}, {}],
  };
}

// 2D-context stub that records fillText calls with the font/fillStyle live at
// call time, so header layout (positions + call count) can be asserted exactly.
function makeCtx() {
  const texts = [];
  const ctx = {
    _texts: texts,
    font: '',
    fillStyle: '',
    textAlign: 'left',
    fillText(text, x, y) { texts.push({ text, x, y, font: ctx.font, fillStyle: ctx.fillStyle }); },
  };
  return ctx;
}

function bareNav() {
  return Object.create(NavComputer.prototype);
}

// ── Pure title derivation ───────────────────────────────────────────────────
describe('deriveSystemTitle — system name for known multiples, marker name for procgen', () => {
  it('titles a known multi-star system by the SYSTEM, from ANY member marker', () => {
    const sys = alphaCenSys();
    expect(deriveSystemTitle(sys, 'Rigil Kentaurus')).toBe('Alpha Centauri');
    expect(deriveSystemTitle(sys, 'Proxima Centauri')).toBe('Alpha Centauri');
  });

  it('falls back to the marker name for a procgen system (no _knownSystemNames)', () => {
    expect(deriveSystemTitle(procgenSys(), 'Kepler-442')).toBe('Kepler-442');
  });

  it('falls back to Unknown when there is neither a known name nor a marker name', () => {
    expect(deriveSystemTitle(procgenSys(), null)).toBe('Unknown');
    expect(deriveSystemTitle(undefined, undefined)).toBe('Unknown');
  });
});

// ── Pure annotation derivation ──────────────────────────────────────────────
describe('deriveSystemAnnotation — component annotation under the title', () => {
  it('marks a far-companion marker as a far companion', () => {
    expect(deriveSystemAnnotation(alphaCenSys(), 'Proxima Centauri'))
      .toBe('via Proxima Centauri — far companion');
  });

  it('marks the primary marker (system name differs from marker) as via-primary', () => {
    expect(deriveSystemAnnotation(alphaCenSys(), 'Rigil Kentaurus'))
      .toBe('via Rigil Kentaurus');
  });

  it('draws NO annotation for a known single where the marker IS the system (TRAPPIST-1)', () => {
    expect(deriveSystemAnnotation(trappistSys(), 'TRAPPIST-1')).toBe(null);
  });

  it('draws NO annotation for a procgen system', () => {
    expect(deriveSystemAnnotation(procgenSys(), 'Kepler-442')).toBe(null);
  });
});

// ── Pure star-hover name derivation ─────────────────────────────────────────
describe('deriveStarHoverName — real component names on hover, never marker A/B', () => {
  it('uses the authored component names even when browsed via the far-companion marker', () => {
    const sys = alphaCenSys();
    // Browsed via Proxima's marker, but the system IS Alpha Centauri: hover the
    // primary → 'Rigil Kentaurus', the companion → 'Toliman' (never Proxima A/B).
    expect(deriveStarHoverName(sys, 'Proxima Centauri', 0, true)).toBe('Rigil Kentaurus');
    expect(deriveStarHoverName(sys, 'Proxima Centauri', 1, true)).toBe('Toliman');
  });

  it('procgen binary falls back to marker A / marker B', () => {
    const sys = procgenBinarySys();
    expect(deriveStarHoverName(sys, 'Kepler-442', 0, true)).toBe('Kepler-442 A');
    expect(deriveStarHoverName(sys, 'Kepler-442', 1, true)).toBe('Kepler-442 B');
  });

  it('procgen single falls back to the bare marker name (no suffix)', () => {
    expect(deriveStarHoverName(procgenSys(), 'Kepler-442', 0, false)).toBe('Kepler-442');
  });
});

// ── _drawSystemHeader wiring (bare-nav) ─────────────────────────────────────
describe('_drawSystemHeader — title/annotation/type-line layout', () => {
  function drawHeader(sys, markerName, planetCount) {
    const ctx = makeCtx();
    bareNav()._drawSystemHeader(ctx, sys, markerName, planetCount);
    return ctx._texts;
  }

  it('(i) far-companion browse: system title + far annotation + shifted type line', () => {
    const t = drawHeader(alphaCenSys(), 'Proxima Centauri', 3);
    expect(t.length).toBe(3);
    expect(t[0]).toMatchObject({ text: 'Alpha Centauri', x: 16, y: 24 });
    expect(t[1]).toMatchObject({ text: 'via Proxima Centauri — far companion', x: 16, y: 38 });
    expect(t[2].y).toBe(54); // type line pushed down to clear the annotation
    expect(t[2].text).toBe('G+K binary · 3 planets · 5.3 Gyr');
  });

  it('(ii) primary browse: system title + via-primary annotation', () => {
    const t = drawHeader(alphaCenSys(), 'Rigil Kentaurus', 3);
    expect(t.length).toBe(3);
    expect(t[0]).toMatchObject({ text: 'Alpha Centauri', x: 16, y: 24 });
    expect(t[1]).toMatchObject({ text: 'via Rigil Kentaurus', x: 16, y: 38 });
    expect(t[2].y).toBe(54);
  });

  it('(iii) current-system view (known single, marker == system): title, no annotation', () => {
    // The derivation is identity-of-systemData, not of browse-vs-current — a
    // current known single (e.g. Sol) still titles by the system, no annotation.
    const sol = { isBinary: false, star: { type: 'G' }, ageGyr: 4.6, planets: [{}],
      _knownSystemNames: { system: 'Sol', star: 'Sol', planets: [] } };
    const t = drawHeader(sol, 'Sol', 1);
    expect(t.length).toBe(2);
    expect(t[0]).toMatchObject({ text: 'Sol', x: 16, y: 24 });
    expect(t[1].y).toBe(42); // no annotation → type line stays at its home y
  });

  it('(v) known single TRAPPIST-1: system title, no annotation', () => {
    const t = drawHeader(trappistSys(), 'TRAPPIST-1', 7);
    expect(t.length).toBe(2);
    expect(t[0]).toMatchObject({ text: 'TRAPPIST-1', x: 16, y: 24 });
    expect(t[1].y).toBe(42);
    expect(t[1].text).toBe('M · 7 planets · 7.6 Gyr');
  });

  it('(iv) procgen system renders byte-identically to pre-AC3 (regression guard)', () => {
    // Exactly two fillText calls at the historical positions: title=marker@(16,24)
    // in 14px white, type line@(16,42). No annotation, no layout shift. This is
    // the byte-identical contract for systems without _knownSystemNames.
    const t = drawHeader(procgenSys(), 'Kepler-442', 3);
    expect(t.length).toBe(2);
    expect(t[0]).toEqual({ text: 'Kepler-442', x: 16, y: 24,
      font: '14px "DotGothic16", monospace', fillStyle: '#fff' });
    expect(t[1]).toMatchObject({ text: 'G · 3 planets · 4.6 Gyr', x: 16, y: 42,
      font: '11px "DotGothic16", monospace', fillStyle: 'rgba(100, 180, 255, 0.6)' });
  });

  it('procgen binary type line unchanged (G/F+M binary label preserved)', () => {
    const t = drawHeader(procgenBinarySys(), 'Kepler-442', 2);
    expect(t.length).toBe(2);
    expect(t[0].text).toBe('Kepler-442');
    expect(t[1].text).toBe('F+M binary · 2 planets · 2.1 Gyr');
  });
});

// ── Planet-display-name routing keys off the system name ────────────────────
describe('_planetDisplayName routing — procgen-fill planets key off the system name', () => {
  it('a procgen-fill planet in a known system reads <system>-N, not <marker>-N', () => {
    const nav = bareNav();
    nav._systemData = alphaCenSys();
    const title = deriveSystemTitle(nav._systemData, 'Proxima Centauri');
    // idx 0/1 are authored → real names; idx 2 has no authored entry → fill.
    expect(nav._planetDisplayName(0, title)).toBe('Rigil Kentaurus b');
    expect(nav._planetDisplayName(2, title)).toBe('Alpha Centauri-3');
    // The bug this closes: passing the raw marker name would read 'Proxima Centauri-3'.
    expect(nav._planetDisplayName(2, 'Proxima Centauri')).toBe('Proxima Centauri-3');
  });

  it('procgen planet naming is byte-identical (title === marker → <marker>-N)', () => {
    const nav = bareNav();
    nav._systemData = procgenSys();
    const title = deriveSystemTitle(nav._systemData, 'Kepler-442');
    expect(title).toBe('Kepler-442');
    expect(nav._planetDisplayName(0, title)).toBe('Kepler-442-1');
    expect(nav._planetDisplayName(2, title)).toBe('Kepler-442-3');
  });
});
