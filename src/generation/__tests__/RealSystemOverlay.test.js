import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { RealSystemOverlay } from '../RealSystemOverlay.js';
import { GalacticMap } from '../GalacticMap.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';

/**
 * AC3/AC4 bulk overlay merge — the DATA side (real-universe-overlay-2026-07-12,
 * Increment 3, design D1/D2/D5/D7). These tests exercise RealSystemOverlay's
 * name-first join and ctx-field population against the REAL shipped ingest data
 * (real generators, no mocks) — the same JSON RealStarCatalog.load() fetches in
 * the browser, read here off disk (design D5 latitude: one code path for the
 * index/join logic, fs is just the test data source).
 *
 * Cap + design references cited by these tests:
 *   docs/WORKSTREAMS/real-universe-overlay-2026-07-12/increment-3-design.md (D1–D9)
 *   docs/WORKSTREAMS/real-universe-overlay-2026-07-12/representation-cap.md
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = (name) => join(HERE, '../../../public/assets/data', name);

const contents = JSON.parse(readFileSync(DATA('real-system-contents.json'), 'utf8'));
const supplement = JSON.parse(readFileSync(DATA('real-star-supplement.json'), 'utf8'));
const HYG = JSON.parse(readFileSync(DATA('hyg-stars.json'), 'utf8'));

const CONTENTS_HOSTS = contents.hosts;
const SUPPLEMENT_STARS = supplement.stars;
const CATALOG_STARS = HYG.concat(SUPPLEMENT_STARS);

function makeOverlay() {
  return new RealSystemOverlay({
    contentsHosts: CONTENTS_HOSTS,
    supplementStars: SUPPLEMENT_STARS,
    catalogStars: CATALOG_STARS,
  });
}

// Build a galaxy ctx the way the real arrival path / AC5 authoring path do:
// deriveGalaxyContext for the position, then bolt on the overlay fields. The
// literal master seed matches main.js / ProcgenSnapshot / the overlay suite.
const MASTER_SEED = 'well-dipper-galaxy-1';
const POS = { x: 8.0, y: 0.025, z: -0.001 };
function baseCtx() {
  return new GalacticMap(MASTER_SEED).deriveGalaxyContext(POS);
}

afterEach(() => vi.restoreAllMocks());

describe('RealSystemOverlay — companion-table join (design D2)', () => {
  it('Sirius → companionSpec with the class-D companion at 19.8 AU', () => {
    const ov = makeOverlay();
    const r = ov.resolve('Sirius');
    expect(r.companionSpec).toBeTruthy();
    expect(r.companionSpec.name).toBe('Sirius');
    expect(r.companionSpec.kind).toBe('multiple');
    const companion = r.companionSpec.components[1];
    expect(companion.name).toBe('Sirius B');
    expect(companion.class).toBe('DA2');           // leading 'D' → degenerate class
    expect(companion.separationAU).toBe(19.8);
    // Sirius hosts no archive planets → no knownPlanets / farCompanions keys.
    expect('knownPlanets' in r).toBe(false);
    expect('farCompanions' in r).toBe(false);
  });

  it('Sirius generates a white-dwarf star2 at 19.8 AU through the real pipeline (no warn)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ov = makeOverlay();
    const ctx = baseCtx();
    ctx.starTypeOverride = 'A';                     // catalog spect (main.js sets this)
    ov.applyToContext(ctx, 'Sirius');
    const sys = StarSystemGenerator.generate('sirius-merge', ctx);

    expect(sys.isBinary).toBe(true);
    expect(sys.star2).not.toBeNull();
    expect(sys.star2.type).toBe('D');
    expect(sys.star2.spectFull).toBe('DA2');
    expect(sys.star.spectFull).toBe('A1V');
    expect(sys.binarySeparationAU).toBe(19.8);
    const fallbackWarns = warnSpy.mock.calls
      .map((a) => String(a[0]))
      .filter((m) => /Unknown star type|Unknown companion class/.test(m));
    expect(fallbackWarns).toEqual([]);
  });

  it('Vega → single-pin companionSpec (suppresses the binary roll), no planets', () => {
    const r = makeOverlay().resolve('Vega');
    expect(r.companionSpec).toBeTruthy();
    expect(r.companionSpec.kind).toBe('single');
    expect('knownPlanets' in r).toBe(false);
  });

  it('farCompanions emit ONLY when the table entry supplies them, with archive planets bridged in', () => {
    // A table entry WITH far companions (Alpha Centauri → Proxima). The far
    // member's planets are bridged from the contents archive ('Proxima Centauri'
    // → 'Proxima Cen' → planets b, d). Sirius (no far companions) supplies none.
    const ov = makeOverlay();
    expect('farCompanions' in ov.resolve('Sirius')).toBe(false);
    const r = ov.resolve('Alpha Centauri');
    expect(r.farCompanions).toHaveLength(1);
    expect(r.farCompanions[0].name).toBe('Proxima Centauri');
    expect(r.farCompanions[0].separationAU).toBe(13000);
    expect(r.farCompanions[0].planets.map((p) => p.letter)).toEqual(['b', 'd']);
  });
});

describe('RealSystemOverlay — known-planet join (design D2)', () => {
  it('TRAPPIST-1 → 7 archive-shaped known planets b–h with real params', () => {
    const r = makeOverlay().resolve('TRAPPIST-1');
    expect(Array.isArray(r.knownPlanets)).toBe(true);
    expect(r.knownPlanets.map((p) => p.letter)).toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h']);
    // Real archive params carried through verbatim (spot-check b and h).
    const b = r.knownPlanets.find((p) => p.letter === 'b');
    expect(b.name).toBe('TRAPPIST-1 b');
    expect(b.smaAU).toBeCloseTo(0.01154, 6);
    expect(b.radiusEarth).toBeCloseTo(1.116, 6);
    expect(b.massEarth).toBeCloseTo(1.374, 6);
    const h = r.knownPlanets.find((p) => p.letter === 'h');
    expect(h.smaAU).toBeCloseTo(0.06189, 6);
    // The canonical archive shape: exactly these 7 keys on every entry.
    for (const p of r.knownPlanets) {
      expect(Object.keys(p).sort()).toEqual(
        ['eccen', 'letter', 'massEarth', 'name', 'periodDays', 'radiusEarth', 'smaAU'],
      );
    }
    // TRAPPIST-1 has no curated companion table entry → no companionSpec.
    expect('companionSpec' in r).toBe(false);
  });

  it('a plain HYG-named host joins directly (no bridge entry)', () => {
    // HD 209458 is a contents host, NOT in the dim-host supplement → the join
    // falls through name === hostname with no bridge indirection.
    const host = CONTENTS_HOSTS.find((h) => h.name === 'HD 209458');
    const r = makeOverlay().resolve('HD 209458');
    expect(r.host).toBe(host);
    expect(r.knownPlanets.length).toBe(host.planets.length);
  });
});

describe('RealSystemOverlay — supplement display-name → hostname bridge (design D2)', () => {
  it("'Proxima Centauri' bridges to the 'Proxima Cen' archive host (planets b, d)", () => {
    const r = makeOverlay().resolve('Proxima Centauri');
    expect(r.host.name).toBe('Proxima Cen');
    expect(r.knownPlanets.map((p) => p.letter)).toEqual(['b', 'd']);
  });

  it("'Kepler-90' bridges to the 'KOI-351' archive host (8 planets)", () => {
    const r = makeOverlay().resolve('Kepler-90');
    expect(r.host.name).toBe('KOI-351');
    expect(r.knownPlanets.length).toBe(8);
  });
});

describe('RealSystemOverlay — zero-data arrival supplies nothing (AC8 omit-not-null)', () => {
  it('a real star with no table entry and no archive host yields no overlay keys', () => {
    const r = makeOverlay().resolve('Betelgeuse');
    expect(r).toEqual({}); // no companionSpec / knownPlanets / farCompanions / host
  });

  it('applyToContext adds NO overlay keys for a zero-data arrival', () => {
    const ov = makeOverlay();
    const ctx = baseCtx();
    ctx.starTypeOverride = 'M';
    ov.applyToContext(ctx, 'Betelgeuse');
    expect('companionSpec' in ctx).toBe(false);
    expect('knownPlanets' in ctx).toBe(false);
    expect('farCompanions' in ctx).toBe(false);
  });

  it('applyToContext sets ONLY the keys the data supplies', () => {
    const ov = makeOverlay();
    // TRAPPIST-1: knownPlanets only (no companion table entry).
    const t = ov.applyToContext(baseCtx(), 'TRAPPIST-1');
    expect('knownPlanets' in t).toBe(true);
    expect('companionSpec' in t).toBe(false);
    expect('farCompanions' in t).toBe(false);
    // Sirius: companionSpec only (no archive host).
    const s = ov.applyToContext(baseCtx(), 'Sirius');
    expect('companionSpec' in s).toBe(true);
    expect('knownPlanets' in s).toBe(false);
    expect('farCompanions' in s).toBe(false);
  });
});

describe('RealSystemOverlay — D2 dup-name discipline', () => {
  it('PIN: no contents host name collides with a duplicated catalog name (join stays pure-name)', () => {
    // The position disambiguator only fires when an arrival name is duplicated in
    // the catalog AND resolves to a contents host. Today's data has ZERO such
    // overlaps, so the join is always pure-name — no position veto anywhere.
    expect([...makeOverlay().ambiguousJoinNames]).toEqual([]);
  });

  it('MECHANISM: a synthetic duplicated join name attaches contents to the nearer star only', () => {
    // Two catalog stars share the name 'Twin'; only one sits at the archive
    // host's ingested position. Contents attach to that (near) star, and an
    // arrival at the far twin gets NO knownPlanets.
    const host = { name: 'Twin', x: 8.0, y: 0.0, z: 0.0, planets: [{ letter: 'b', name: 'Twin b', smaAU: 1 }] };
    const nearTwin = { name: 'Twin', x: 8.0, y: 0.0, z: 0.0, spect: 'G' };
    const farTwin = { name: 'Twin', x: 8.5, y: 0.0, z: 0.0, spect: 'K' };
    const ov = new RealSystemOverlay({
      contentsHosts: [host],
      supplementStars: [],
      catalogStars: [nearTwin, farTwin],
    });
    expect([...ov.ambiguousJoinNames]).toEqual(['Twin']); // gate fired
    expect(ov.resolve('Twin', { x: 8.0, y: 0.0, z: 0.0 }).knownPlanets).toHaveLength(1);
    expect('knownPlanets' in ov.resolve('Twin', { x: 8.5, y: 0.0, z: 0.0 })).toBe(false);
  });

  it('NO position veto on a UNIQUE-name join (archive/HYG distance disagreement is not a miss)', () => {
    // A unique-name host must attach regardless of how far the arrival position is
    // from the archive's ingested position — 104/116 bright hosts have >0.1 pc
    // sy_dist vs HYG disagreement (design ruling 6). A far arrival still joins.
    const r = makeOverlay().resolve('TRAPPIST-1', { x: 999, y: 999, z: 999 });
    expect(r.knownPlanets).toHaveLength(7);
  });
});

describe('RealSystemOverlay — determinism (design D8)', () => {
  it('resolve twice → deep-equal overlay fields', () => {
    const ov = makeOverlay();
    expect(ov.resolve('TRAPPIST-1')).toEqual(ov.resolve('TRAPPIST-1'));
    expect(ov.resolve('Sirius')).toEqual(ov.resolve('Sirius'));
  });

  it('the join drives a revisit-stable generate (Sirius ×2 → deep-equal systemData)', () => {
    const ov = makeOverlay();
    const build = () => {
      const ctx = baseCtx();
      ctx.starTypeOverride = 'A';
      return ov.applyToContext(ctx, 'Sirius');
    };
    const a = JSON.parse(JSON.stringify(StarSystemGenerator.generate('sirius-rev', build())));
    const b = JSON.parse(JSON.stringify(StarSystemGenerator.generate('sirius-rev', build())));
    expect(a).toEqual(b);
  });
});

describe('RealSystemOverlay — unready warns, never silently procgen (design D5)', () => {
  it('applyToContext on an unloaded overlay console.warns and applies nothing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ov = new RealSystemOverlay();       // empty, not ready
    expect(ov.ready).toBe(false);
    const ctx = baseCtx();
    ov.applyToContext(ctx, 'Sirius');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toMatch(/RealSystemOverlay/);
    expect('companionSpec' in ctx).toBe(false);
    expect('knownPlanets' in ctx).toBe(false);
  });
});

describe('RealSystemOverlay — merged display names (design D7, data side)', () => {
  it('Sirius: system/star = Sirius, star2 = Sirius B, procgen planets keep the letter convention', () => {
    const ov = makeOverlay();
    const ctx = baseCtx();
    ctx.starTypeOverride = 'A';
    ov.applyToContext(ctx, 'Sirius');
    const sys = StarSystemGenerator.generate('sirius-names', ctx);
    const names = ov.deriveMergedNames('Sirius', sys);
    expect(names.system).toBe('Sirius');
    expect(names.star).toBe('Sirius');
    expect(names.star2).toBe('Sirius B');          // table's secondary component
    expect(names.planets.length).toBe(sys.planets.length);
    // Sirius carries no known planets → every planet is procgen-lettered.
    if (sys.planets.length > 0) expect(names.planets[0].name).toBe('Sirius b');
  });

  it('TRAPPIST-1: injected known planets carry their archive designations; star2 null (no table binary)', () => {
    // Grounded in REAL join output (resolve().knownPlanets), assembled into the
    // injected-wrapper shape StarSystemGenerator produces (known:true + letter +
    // name). This tests the D7 names mapping directly, independent of the D3
    // known-planet immunity that makes the tight planets survive generation
    // (built in the StarSystemGenerator lane) — so it is robust either way.
    const ov = makeOverlay();
    const known = ov.resolve('TRAPPIST-1').knownPlanets;
    const sys = {
      isBinary: false,
      star2: null,
      planets: [
        ...known.map((kp) => ({ known: true, letter: kp.letter, name: kp.name, moons: [] })),
        { planetData: { type: 'rocky' }, moons: [] }, // one procgen filler
      ],
    };
    const names = ov.deriveMergedNames('TRAPPIST-1', sys);
    expect(names.system).toBe('TRAPPIST-1');
    expect(names.star).toBe('TRAPPIST-1');
    expect(names.star2).toBeNull(); // TRAPPIST-1 has no curated table binary
    // The 7 injected planets keep their archive designations, index-aligned.
    expect(names.planets.slice(0, 7).map((p) => p.name))
      .toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h'].map((l) => `TRAPPIST-1 ${l}`));
    // The procgen filler falls back to the `<system> <letter>` convention.
    expect(names.planets[7].name).toBe('TRAPPIST-1 i');
  });
});
