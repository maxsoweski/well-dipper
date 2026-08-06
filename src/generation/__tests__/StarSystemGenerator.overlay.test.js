import { describe, it, expect, vi, afterEach } from 'vitest';
import { GalacticMap } from '../GalacticMap.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';
import { earthRadiiToScene } from '../../core/ScaleConstants.js';

/**
 * AC10 engine structural support (real-universe-overlay-2026-07-12, Increment 2).
 *
 * These tests exercise StarSystemGenerator's overlay generation-context fields —
 * ctx.companionSpec (forced close binary / single-pin), ctx.knownPlanets
 * (archive-shaped injection), ctx.farCompanions (wide members) — plus the
 * first-class degenerate 'D' (white-dwarf) star class and the shared
 * normalizeSpectralClass helper. Design + decisions D1–D8:
 *   docs/WORKSTREAMS/real-universe-overlay-2026-07-12/increment-2-design.md
 *
 * The AC10 representation cap (at most 2 close stars per system; wider members
 * become farCompanions data; real eccentricity carried as data while orbits
 * render circular) is written down and cited from these tests here:
 *   docs/WORKSTREAMS/real-universe-overlay-2026-07-12/representation-cap.md
 *   (authored by Builder 2 in this same increment; path pinned now).
 *
 * ctx is built the same way the real arrival path and the AC5 authoring adapter
 * build it: deriveGalaxyContext() for the position, then the overlay fields are
 * bolted on (mirroring the existing starTypeOverride idiom). The literal
 * 'well-dipper-galaxy-1' master seed matches main.js / ProcgenSnapshot.
 */

const MASTER_SEED = 'well-dipper-galaxy-1';
// A fixed solar-neighborhood position — deriveGalaxyContext gives a valid
// metallicity/age/binaryModifier there. The exact spot is immaterial: every
// test pins the primary via starTypeOverride, so galaxy star-weights never
// decide the primary type.
const POS = { x: 8.0, y: 0.025, z: -0.001 };

function baseCtx() {
  const map = new GalacticMap(MASTER_SEED);
  return map.deriveGalaxyContext(POS);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AC10 — normalizeSpectralClass helper (design D3)', () => {
  it('maps real multi-char classes by leading letter, incl. degenerate D', () => {
    const n = StarSystemGenerator.normalizeSpectralClass.bind(StarSystemGenerator);
    expect(n('DA2')).toBe('D');    // white dwarf → first-class D
    expect(n('DQZ')).toBe('D');
    expect(n('G2V')).toBe('G');
    expect(n('K1V')).toBe('K');
    expect(n('A1V')).toBe('A');
    expect(n('F5IV-V')).toBe('F');
    expect(n('M5.5Ve')).toBe('M');
  });

  it('honors the existing remap tables and out-of-catalog fallbacks', () => {
    const n = StarSystemGenerator.normalizeSpectralClass.bind(StarSystemGenerator);
    expect(n('Kg')).toBe('K');     // evolved giant → base letter
    expect(n('Gg')).toBe('G');
    expect(n('Mg')).toBe('M');
    expect(n('W')).toBe('O');      // Wolf-Rayet → hot massive
    expect(n('C')).toBe('M');      // carbon star → cool
    expect(n('S')).toBe('K');      // S-type → cool giant
    expect(n('L5')).toBe('M');     // brown dwarf → coolest
    expect(n('T8')).toBe('M');
    expect(n('Y1')).toBe('M');
  });

  it('returns null for the unrepresentable (caller uses the warn/G path)', () => {
    const n = StarSystemGenerator.normalizeSpectralClass.bind(StarSystemGenerator);
    expect(n('ZZZ')).toBeNull();
    expect(n('')).toBeNull();
    expect(n('   ')).toBeNull();
    expect(n(null)).toBeNull();
    expect(n(undefined)).toBeNull();
  });
});

describe('AC10 — class-D companion generates end-to-end with no G-fallback warn', () => {
  it('emits a white-dwarf star2 (Sirius-shaped) and never warns "Unknown star type"', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ctx = baseCtx();
    ctx.starTypeOverride = 'A'; // Sirius A primary
    ctx.companionSpec = {
      name: 'Sirius',
      kind: 'multiple',
      components: [
        { name: 'Sirius', class: 'A1V' },
        { name: 'Sirius B', class: 'DA2', separationAU: 19.8 },
      ],
    };

    const sys = StarSystemGenerator.generate('sirius-overlay', ctx);

    // The AC10 acceptance clause: class-D companion emerges with white-dwarf
    // parameters and NO fallback-to-G warn — neither the primary-star path
    // ('Unknown star type') nor the companion path ('Unknown companion class').
    const fallbackWarns = warnSpy.mock.calls
      .map(args => String(args[0]))
      .filter(msg => /Unknown star type|Unknown companion class/.test(msg));
    expect(fallbackWarns).toEqual([]);

    expect(sys.isBinary).toBe(true);
    expect(sys.star2).not.toBeNull();
    expect(sys.star2.type).toBe('D');
    // White-dwarf parameters come from the first-class STAR_PROPERTIES.D row.
    const D = StarSystemGenerator.STAR_PROPERTIES.D;
    expect(D).toBeDefined();
    expect(D.color).toEqual([0.85, 0.9, 1.0]); // blue-white
    expect(sys.star2.color).toEqual([0.85, 0.9, 1.0]);
    expect(sys.star2.temp).toBe(25000);
    // Full class strings retained for display honesty (D2).
    expect(sys.star2.spectFull).toBe('DA2');
    expect(sys.star.spectFull).toBe('A1V');
    // Separation comes verbatim from the companion table, not a roll.
    expect(sys.binarySeparationAU).toBe(19.8);
    // massRatio is the deterministic radiusSolar^1.25 ratio (D2), not rolled.
    const m1 = Math.pow(StarSystemGenerator.STAR_PROPERTIES.A.radiusSolar, 1.25);
    const m2 = Math.pow(D.radiusSolar, 1.25);
    expect(sys.binaryMassRatio).toBeCloseTo(Math.min(m2 / m1, 1.0), 12);
  });
});

describe('AC10 — known-planet injection (design D2)', () => {
  // Three archive-shaped known planets, deliberately given OUT of sma order and
  // with a mix of orbit sources: 'd' has only a period (smaAU derived via
  // Kepler), 'c' has no eccen (eccen key must be omitted), 'b' is fully
  // specified. Real eccentricity is carried as data; orbits still render
  // circular — see representation-cap.md.
  const KNOWNS = [
    { letter: 'b', name: 'Test b', periodDays: null, smaAU: 0.5,  massEarth: 1.2, radiusEarth: 1.1, eccen: 0.01 },
    { letter: 'c', name: null,      periodDays: null, smaAU: 1.4,  massEarth: 2.5, radiusEarth: 1.4, eccen: null },
    { letter: 'd', name: null,      periodDays: 20.0, smaAU: null, massEarth: 0.8, radiusEarth: 0.9, eccen: 0.2 },
  ];

  function injectedSystem() {
    const ctx = baseCtx();
    ctx.starTypeOverride = 'K';
    ctx.knownPlanets = KNOWNS;
    // Seed verified (this file's exploration) to keep all knowns — no migration
    // scatter / binary-stability removal — so the injection is observable.
    return StarSystemGenerator.generate('kp-1', ctx);
  }

  it('places every known planet with its designation, sorted by semi-major axis', () => {
    const sys = injectedSystem();
    const injected = sys.planets.filter(p => p.known === true);
    expect(injected.length).toBe(3);
    // Sorted by (possibly Kepler-derived) sma: d≈0.12 < b=0.5 < c=1.4.
    expect(injected.map(p => p.letter)).toEqual(['d', 'b', 'c']);
    // Injected planets are the FIRST slots.
    expect(sys.planets.slice(0, 3).every(p => p.known === true)).toBe(true);
  });

  it('merges real radius/mass onto planetData and keeps orbits monotonic', () => {
    const sys = injectedSystem();
    const byLetter = Object.fromEntries(
      sys.planets.filter(p => p.known).map(p => [p.letter, p]),
    );
    // Real physical params override the procgen size/mass (radiusScene tracks).
    expect(byLetter.b.planetData.radiusEarth).toBe(1.1);
    expect(byLetter.b.planetData.massEarth).toBe(1.2);
    expect(byLetter.b.planetData.radiusScene).toBeCloseTo(earthRadiiToScene(1.1), 12);
    expect(byLetter.c.planetData.radiusEarth).toBe(1.4);
    // 'd' pins its orbit to the Kepler-derived sma from periodDays.
    expect(byLetter.d.orbitRadiusAU).toBeGreaterThan(0);
    expect(byLetter.d.orbitRadiusAU).toBeLessThan(0.5);
    // Orbits step outward across the whole system (knowns then procgen fill).
    const aus = sys.planets.map(p => p.orbitRadiusAU);
    for (let i = 1; i < aus.length; i++) expect(aus[i]).toBeGreaterThan(aus[i - 1]);
  });

  it('carries eccen only where the archive has it (omit-null; representation-cap.md)', () => {
    const sys = injectedSystem();
    const byLetter = Object.fromEntries(
      sys.planets.filter(p => p.known).map(p => [p.letter, p]),
    );
    // Real eccentricity is data-only (orbits render circular per the cap doc).
    expect(byLetter.b.eccen).toBe(0.01);
    expect(byLetter.d.eccen).toBe(0.2);
    // 'c' had eccen:null → the key is OMITTED, never emitted as null (fact 2).
    expect('eccen' in byLetter.c).toBe(false);
    // name is likewise added only when present.
    expect(byLetter.b.name).toBe('Test b');
    expect('name' in byLetter.c).toBe(false);
  });

  it('procgen fills the remainder; planetCount = max(rolled, known.length)', () => {
    const sys = injectedSystem();
    // At least the 3 knowns, and at least one procgen-filled slot beyond them.
    expect(sys.planets.length).toBeGreaterThanOrEqual(3);
    expect(sys.planets.some(p => !p.known)).toBe(true);
    // A procgen filler carries none of the injected-only keys.
    const filler = sys.planets.find(p => !p.known);
    expect('letter' in filler).toBe(false);
    expect('known' in filler).toBe(false);
    expect('eccen' in filler).toBe(false);
  });
});

describe('AC10 — determinism of an overlay/authored system', () => {
  it('generate twice with the same ctx → deep-equal systemData', () => {
    const build = () => {
      const ctx = baseCtx();
      ctx.starTypeOverride = 'K';
      ctx.knownPlanets = [
        { letter: 'b', name: 'x b', periodDays: null, smaAU: 0.7, massEarth: 1, radiusEarth: 1, eccen: 0.05 },
      ];
      ctx.companionSpec = {
        name: 'x', kind: 'multiple',
        components: [{ name: 'x', class: 'K1V' }, { name: 'xB', class: 'DA2', separationAU: 12 }],
      };
      ctx.farCompanions = [{ name: 'far', class: 'M5V', separationAU: 9000, planets: [{ letter: 'z' }] }];
      return ctx;
    };
    const a = JSON.parse(JSON.stringify(StarSystemGenerator.generate('det-overlay', build())));
    const b = JSON.parse(JSON.stringify(StarSystemGenerator.generate('det-overlay', build())));
    expect(a).toEqual(b);
  });
});

describe('AC10 — far companions emitted in the documented shape (design D2)', () => {
  it('systemData.farCompanions carries name/class/normalized-type/separation/planets', () => {
    // Wide members live in farCompanions, NOT a third close-star slot — the
    // AC10 2-close-star representation cap (representation-cap.md).
    const ctx = baseCtx();
    ctx.starTypeOverride = 'G';
    ctx.companionSpec = {
      name: 'Alpha Centauri', kind: 'multiple',
      components: [
        { name: 'Rigil Kentaurus', class: 'G2V' },
        { name: 'Toliman', class: 'K1V', separationAU: 23.5 },
      ],
    };
    ctx.farCompanions = [
      { name: 'Proxima Centauri', class: 'M5.5Ve', separationAU: 13000, planets: [{ letter: 'b' }, { letter: 'd' }] },
    ];

    const sys = StarSystemGenerator.generate('alpha-cen-overlay', ctx);

    // Close pair: A + B only (2-close-star cap held).
    expect(sys.isBinary).toBe(true);
    expect(sys.star2.type).toBe('K');
    expect(sys.star2.spectFull).toBe('K1V');

    expect(Array.isArray(sys.farCompanions)).toBe(true);
    expect(sys.farCompanions).toHaveLength(1);
    expect(sys.farCompanions[0]).toEqual({
      name: 'Proxima Centauri',
      class: 'M5.5Ve',
      type: 'M', // normalized single-letter type
      separationAU: 13000,
      planets: [{ letter: 'b' }, { letter: 'd' }],
    });
  });
});

describe('AC10 — overlay fields OMITTED (not null) on procgen-only systems (fact 2)', () => {
  it('a plain procgen ctx system has no farCompanions/letter/known/eccen keys after JSON round-trip', () => {
    // No companionSpec / knownPlanets / farCompanions — exactly the AC8 shape.
    const ctx = baseCtx();
    ctx.starTypeOverride = 'G';
    const sys = JSON.parse(JSON.stringify(StarSystemGenerator.generate('procgen-plain', ctx)));

    // Top-level far-companion field must be ABSENT (unlike star2:null baseline).
    expect('farCompanions' in sys).toBe(false);
    // No planet wrapper gains the injected-only keys.
    for (const p of sys.planets) {
      expect('letter' in p).toBe(false);
      expect('known' in p).toBe(false);
      expect('eccen' in p).toBe(false);
      expect('name' in p).toBe(false);
    }
    // A rolled procgen binary (if any) carries no spectFull.
    if (sys.star2) expect('spectFull' in sys.star2).toBe(false);
    expect('spectFull' in sys.star).toBe(false);
  });
});

describe('AC10 — single-pin suppresses the binary roll (design D2 / AC4d)', () => {
  it('ctx.companionSpec kind:single forces isBinary false / star2 null on every seed', () => {
    // Without the pin, ~35% of A-type systems would roll a binary; the single
    // marker must veto that for every seed.
    for (let i = 0; i < 30; i++) {
      const ctx = baseCtx();
      ctx.starTypeOverride = 'A';
      ctx.companionSpec = { name: 'Vega', kind: 'single' };
      const sys = StarSystemGenerator.generate(`single-pin-${i}`, ctx);
      expect(sys.isBinary).toBe(false);
      expect(sys.star2).toBeNull();
    }
  });
});
