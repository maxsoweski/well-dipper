import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { RealSystemOverlay } from '../RealSystemOverlay.js';
import { GalacticMap } from '../GalacticMap.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';

/**
 * AC4 procgen-fill + AC3 real-characteristics — end-to-end through the REAL
 * arrival pipeline (real-universe-overlay-2026-07-12, Increment 3). ctx is built
 * exactly as the two main.js call sites build it: deriveGalaxyContext(position),
 * starTypeOverride = catalog spect (D6), then RealSystemOverlay.applyToContext
 * bolts on the overlay fields; StarSystemGenerator.generate then produces the
 * merged system. Data is the REAL shipped ingest (no mocks), read off disk (the
 * same JSON RealStarCatalog.load fetches — design D5 latitude).
 *
 * AC4 verifyVia (contract.json): (a) partial-known host procgen-fills, (b) a
 * zero-data catalog star (UPDATED: now arrives pinned-single per the FIX-3
 * pin-by-default ruling, not pure procgen — Max 2026-07-15,
 * real-star-identity-unification-2026-07-15 / AC5), (c) a companion-table binary,
 * (d) a pinned single — each generate-twice deep-equal (revisit-stable, D8). Plus
 * the merged-name observable (D7): a merged system exposes its real designations.
 *
 * Cited: increment-3-design.md (D1–D9), representation-cap.md (§5).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = (name) => join(HERE, '../../../public/assets/data', name);
const contents = JSON.parse(readFileSync(DATA('real-system-contents.json'), 'utf8'));
const supplement = JSON.parse(readFileSync(DATA('real-star-supplement.json'), 'utf8'));
const HYG = JSON.parse(readFileSync(DATA('hyg-stars.json'), 'utf8'));
const CATALOG_STARS = HYG.concat(supplement.stars);

const OV = () => new RealSystemOverlay({
  contentsHosts: contents.hosts,
  supplementStars: supplement.stars,
  catalogStars: CATALOG_STARS,
});

const MASTER_SEED = 'well-dipper-galaxy-1';
const POS = { x: 8.0, y: 0.025, z: -0.001 };
const baseCtx = () => new GalacticMap(MASTER_SEED).deriveGalaxyContext(POS);
const rt = (o) => JSON.parse(JSON.stringify(o));
const hostByName = (name) => OV().resolve(name).host;

afterEach(() => vi.restoreAllMocks());

describe('AC4(a) — a real host with PARTIAL known planets: knowns present + procgen fills', () => {
  // HD 10697 (real HYG G star, 1 archive planet 'b' at 2.051 AU). Seed 'a4-2'
  // rolls MORE than one planet, so the remainder is procgen-filled. Not a binary
  // on this seed → no companion cull to muddy the fill.
  const NAME = 'HD 10697';
  const build = () => {
    const ctx = baseCtx();
    ctx.starTypeOverride = 'G'; // catalog spect (HYG), D6
    return OV().applyToContext(ctx, NAME);
  };

  it('every known planet present with archive params; procgen fills the rest', () => {
    const host = hostByName(NAME);
    const sys = StarSystemGenerator.generate('a4-2', build());
    const known = sys.planets.filter((p) => p.known);
    // All (both) archive planets injected with their real designations.
    expect(known.map((p) => p.letter)).toEqual(host.planets.map((p) => p.letter));
    const b = known.find((p) => p.letter === 'b');
    const archiveB = host.planets.find((p) => p.letter === 'b');
    expect(b.orbitRadiusAU).toBe(archiveB.smaAU);           // pinned to real sma
    expect(b.planetData.radiusEarth).toBe(archiveB.radiusEarth);
    expect(b.planetData.massEarth).toBe(archiveB.massEarth);
    expect(b.name).toBe('HD 10697 b');
    // Remainder procgen-filled (Elite-style) — strictly more slots than knowns.
    expect(sys.planets.length).toBeGreaterThan(known.length);
    expect(sys.planets.some((p) => !p.known)).toBe(true);
  });

  it('generate twice → deep-equal systemData (revisit-stable)', () => {
    expect(rt(StarSystemGenerator.generate('a4-2', build())))
      .toEqual(rt(StarSystemGenerator.generate('a4-2', build())));
  });

  // Inc-3 adversarial-review finding: fill letters were assigned by ARRAY INDEX,
  // so a migrated procgen giant sorting below the known planet took the known's
  // letter — two planets both labeled 'HD 10697 b' on the _knownSystemNames path
  // (29/400 seeds). Fill letters must skip designations the knowns already carry.
  it('procgen-fill planets never duplicate a known designation', () => {
    for (const seed of ['hd-33', 'hd-63', 'hd-91']) {
      const sys = StarSystemGenerator.generate(seed, build());
      expect(sys.migration?.occurred ?? true).toBe(true); // seeds chosen to migrate
      const all = OV().deriveMergedNames(NAME, sys).planets.map((p) => p.name);
      expect(new Set(all).size).toBe(all.length);
      expect(all.filter((n) => n === 'HD 10697 b')).toHaveLength(1);
      // the real known still owns its designation
      const knownIdx = sys.planets.findIndex((p) => p.known);
      expect(all[knownIdx]).toBe('HD 10697 b');
    }
  });
});

describe('AC4(b) — an un-tabled, un-hosted real star: procedural planets, pinned single', () => {
  // Betelgeuse is a real HYG star (spect M) with NO archive host and NO companion
  // table entry. UPDATED for the FIX-3 pin-by-default ruling (Max 2026-07-15,
  // real-star-identity-unification-2026-07-15 / AC5): such a real star arrives
  // SINGLE — the overlay now supplies a { kind:'single', source:'pin-by-default' }
  // companionSpec (it never rolls a fabricated stellar companion). Planets stay
  // fully procedural (no archive host → no knownPlanets) and the catalog type holds.
  const NAME = 'Betelgeuse';

  it('the overlay supplies ONLY the pin-by-default single (no knowns, no far)', () => {
    expect(OV().resolve(NAME)).toEqual({
      companionSpec: { kind: 'single', source: 'pin-by-default' },
    });
    const ctx = baseCtx();
    ctx.starTypeOverride = 'M';
    OV().applyToContext(ctx, NAME);
    expect(ctx.companionSpec).toEqual({ kind: 'single', source: 'pin-by-default' });
    expect('knownPlanets' in ctx).toBe(false);
    expect('farCompanions' in ctx).toBe(false);
  });

  it('(e) a non-host real star gets the pin-by-default single, NOT the archive-snum pin', () => {
    // Betelgeuse has NO contents host, so resolve() never enters the host branch
    // where the D7 archive-snum pin lives. Under FIX-3 it still arrives single —
    // via the pin-by-default source, distinguishable from the archive-snum source.
    const r = OV().resolve(NAME);
    expect(r.host).toBeUndefined();
    expect(r.companionSpec).toEqual({ kind: 'single', source: 'pin-by-default' });
  });

  it('planets fully procedural + catalog type kept; the pin suppresses the binary roll', () => {
    const overlaidCtx = baseCtx(); overlaidCtx.starTypeOverride = 'M';
    OV().applyToContext(overlaidCtx, NAME);
    const merged = StarSystemGenerator.generate('bet-1', overlaidCtx);

    // The pin is the ONLY overlay field a zero-data real star now contributes, so
    // a plain procgen ctx carrying the same single-pin is byte-identical.
    const pinnedPlain = baseCtx(); pinnedPlain.starTypeOverride = 'M';
    pinnedPlain.companionSpec = { kind: 'single', source: 'pin-by-default' };
    const plain = StarSystemGenerator.generate('bet-1', pinnedPlain);

    expect(rt(merged)).toEqual(rt(plain));          // pin is the only supplied field
    expect(merged.isBinary).toBe(false);            // pinned single
    expect(merged.star2).toBeNull();
    expect(merged.star.type).toBe('M');             // catalog type preserved
    expect(merged.planets.every((p) => !p.known)).toBe(true); // no archive host
    expect('farCompanions' in rt(merged)).toBe(false);
  });

  it('generate twice → deep-equal systemData', () => {
    const build = () => { const c = baseCtx(); c.starTypeOverride = 'M'; return OV().applyToContext(c, NAME); };
    expect(rt(StarSystemGenerator.generate('bet-1', build())))
      .toEqual(rt(StarSystemGenerator.generate('bet-1', build())));
  });
});

describe('AC4(c) — a companion-table binary: Sirius → class-D star2 at 19.8 AU', () => {
  const NAME = 'Sirius';
  const build = () => {
    const ctx = baseCtx();
    ctx.starTypeOverride = 'A'; // catalog spect
    return OV().applyToContext(ctx, NAME);
  };

  it('forces the white-dwarf companion from the curated table (no warn)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sys = StarSystemGenerator.generate('sirius-ac4', build());
    expect(sys.isBinary).toBe(true);
    expect(sys.star2.type).toBe('D');
    expect(sys.star2.spectFull).toBe('DA2');
    expect(sys.star.spectFull).toBe('A1V');        // primary's full class (table)
    expect(sys.binarySeparationAU).toBe(19.8);
    const fallback = warnSpy.mock.calls.map((a) => String(a[0]))
      .filter((m) => /Unknown star type|Unknown companion class/.test(m));
    expect(fallback).toEqual([]);
  });

  it('generate twice → deep-equal systemData', () => {
    expect(rt(StarSystemGenerator.generate('sirius-ac4', build())))
      .toEqual(rt(StarSystemGenerator.generate('sirius-ac4', build())));
  });
});

describe('AC4(d) — a pinned single: Vega → no companion, ever', () => {
  const NAME = 'Vega';
  const build = () => {
    const ctx = baseCtx();
    ctx.starTypeOverride = 'A';
    return OV().applyToContext(ctx, NAME);
  };

  it('the single-pin suppresses the binary roll and injects no planets', () => {
    // A-type systems roll a binary ~35% of the time; the pin must veto it.
    for (const seed of ['vega-ac4', 'vega-2', 'vega-3']) {
      const sys = StarSystemGenerator.generate(seed, build());
      expect(sys.isBinary).toBe(false);
      expect(sys.star2).toBeNull();
      expect(sys.planets.every((p) => !p.known)).toBe(true); // Vega has no archive planets
    }
  });

  it('generate twice → deep-equal systemData', () => {
    expect(rt(StarSystemGenerator.generate('vega-ac4', build())))
      .toEqual(rt(StarSystemGenerator.generate('vega-ac4', build())));
  });
});

describe('AC3 — TRAPPIST-1 end-to-end: 7 real planets survive + expose real designations (D7)', () => {
  // The headline AC3 case: an M-dwarf whose seven tight known planets carry their
  // real b–h designations and archive parameters, through the FULL join +
  // generate pipeline. TRAPPIST-1 is archive snum:1, so the D7 single-pin
  // (RealSystemOverlay.resolve) suppresses the procgen companion roll seed 't1-b'
  // used to fire — arrival is now a true single star. The stability-cull immunity
  // demonstration (tight real planets surviving a CLOSE companion) moves to the
  // snum>=2 rolled-binary vehicle below, since the pin removes the roll here.
  const NAME = 'TRAPPIST-1';
  const build = () => {
    const ctx = baseCtx();
    ctx.starTypeOverride = 'M'; // TRAPPIST-1 catalog spect (supplement)
    return OV().applyToContext(ctx, NAME);
  };

  it('all seven archive planets present with real params; the snum:1 pin keeps it single', () => {
    const host = hostByName(NAME);
    const sys = StarSystemGenerator.generate('t1-b', build());
    // The D7 single-pin suppresses the companion roll seed 't1-b' would fire.
    expect(sys.isBinary).toBe(false);
    expect(sys.star2).toBeNull();
    const known = sys.planets.filter((p) => p.known);
    expect(known.map((p) => p.letter)).toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h']);
    // Every known planet keeps its archive orbit + radius + mass.
    for (const p of known) {
      const a = host.planets.find((h) => h.letter === p.letter);
      expect(p.orbitRadiusAU).toBe(a.smaAU);
      expect(p.planetData.radiusEarth).toBe(a.radiusEarth);
      expect(p.planetData.massEarth).toBe(a.massEarth);
    }
  });

  it('deriveMergedNames exposes the real designations the UI reads (D7)', () => {
    const ov = OV();
    const ctx = baseCtx();
    ctx.starTypeOverride = 'M';
    ov.applyToContext(ctx, NAME);
    const sys = StarSystemGenerator.generate('t1-b', ctx);
    const names = ov.deriveMergedNames(NAME, sys);
    expect(names.system).toBe('TRAPPIST-1');
    expect(names.star).toBe('TRAPPIST-1');
    // No curated table entry AND no companion at all (snum:1 pin) → star2 null.
    expect(names.star2).toBeNull();
    // The seven planets expose their real b–h designations, index-aligned.
    expect(names.planets.map((p) => p.name))
      .toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h'].map((l) => `TRAPPIST-1 ${l}`));
  });

  it('generate twice → deep-equal systemData', () => {
    expect(rt(StarSystemGenerator.generate('t1-b', build())))
      .toEqual(rt(StarSystemGenerator.generate('t1-b', build())));
  });
});

describe('AC3 — known-planet immunity on a LIVE rolled binary (snum>=2 vehicle)', () => {
  // The stability-cull immunity demonstration MOVED off TRAPPIST-1: now that the
  // snum:1 pin makes TRAPPIST-1 single, the "tight real planets survive a close
  // companion" case rides a snum>=2 non-table host whose roll stays live. 55 Cnc
  // (archive snum:2, five known planets b–f, catalog G, NOT in the companion
  // table) rolls a binary on seed 'imm-5'; all five knowns must survive the cull.
  const NAME = '55 Cnc';
  const build = () => {
    const ctx = baseCtx();
    ctx.starTypeOverride = 'G'; // 55 Cnc catalog spect
    return OV().applyToContext(ctx, NAME);
  };

  it('a snum>=2 host rolls a live binary and every known planet survives it', () => {
    const host = hostByName(NAME);
    expect(host.snum).toBeGreaterThanOrEqual(2); // the D7 pin must NOT fire here
    const sys = StarSystemGenerator.generate('imm-5', build());
    expect(sys.isBinary).toBe(true); // procgen roll stayed live (one-directional pin)
    expect(sys.star2).not.toBeNull();
    const known = sys.planets.filter((p) => p.known);
    expect(known).toHaveLength(5);
    // Each known keeps its archive orbit + radius + mass despite the companion.
    for (const p of known) {
      const a = host.planets.find((h) => h.letter === p.letter);
      expect(p.orbitRadiusAU).toBe(a.smaAU);
      expect(p.planetData.radiusEarth).toBe(a.radiusEarth);
      expect(p.planetData.massEarth).toBe(a.massEarth);
    }
  });

  it('generate twice → deep-equal systemData', () => {
    expect(rt(StarSystemGenerator.generate('imm-5', build())))
      .toEqual(rt(StarSystemGenerator.generate('imm-5', build())));
  });
});

describe('D7 — snum==1 single-pin (archive-snum, RealSystemOverlay.resolve)', () => {
  // A non-table contents host whose archive record says snum===1 gets a
  // synthesized companionSpec { kind:'single', source:'archive-snum' } that rides
  // the existing forceBinary=false path — suppressing the procgen companion roll
  // with no StarSystemGenerator edit. One-directional (snum>=2 untouched) and
  // table-wins by construction (only fires when tableEntry is null).

  it('(resolve) synthesizes the archive-snum single-pin for a snum==1 non-table host', () => {
    const r = OV().resolve('61 Vir'); // snum:1 catalog-G host, planets b/c/d, not table-covered
    expect(r.tableEntry).toBeUndefined();
    expect(r.host.snum).toBe(1);
    expect(r.companionSpec).toEqual({ kind: 'single', source: 'archive-snum' });
    expect(r.knownPlanets).toHaveLength(3);
  });

  it('(b) a snum==1 host on a would-roll seed → roll suppressed, knowns intact, revisit-stable', () => {
    const NAME = '61 Vir';
    const SEED = 'b-5'; // this seed rolls a binary when no companionSpec is present
    // Baseline: same knowns but NO companionSpec → the seed's procgen roll fires.
    const bare = baseCtx();
    bare.starTypeOverride = 'G';
    bare.knownPlanets = OV().resolve(NAME).knownPlanets;
    expect(StarSystemGenerator.generate(SEED, bare).isBinary).toBe(true);
    // With the pin (full overlay applyToContext): the roll is suppressed.
    const build = () => {
      const c = baseCtx();
      c.starTypeOverride = 'G';
      return OV().applyToContext(c, NAME);
    };
    const sys = StarSystemGenerator.generate(SEED, build());
    expect(sys.isBinary).toBe(false);
    expect(sys.star2).toBeNull();
    expect(sys.planets.filter((p) => p.known).map((p) => p.letter)).toEqual(['b', 'c', 'd']);
    // Revisit-stable.
    expect(rt(StarSystemGenerator.generate(SEED, build())))
      .toEqual(rt(StarSystemGenerator.generate(SEED, build())));
  });

  it('(c) a snum>=2 non-table host is NOT pinned — the roll stays live (one-directional boundary)', () => {
    const r = OV().resolve('55 Cnc'); // snum:2
    expect(r.host.snum).toBe(2);
    expect(r.tableEntry).toBeUndefined();
    expect('companionSpec' in r).toBe(false); // the pin never fires for snum>=2
  });

  it('(d) a host both snum==1 AND table-covered → the curated table decides (table wins)', () => {
    // Synthetic contents host named 'Sirius' (a table binary) flagged snum:1. The
    // pin's `!tableEntry` guard means the table entry wins — companionSpec is the
    // curated multiple, never the archive-snum single.
    const ov = new RealSystemOverlay({
      contentsHosts: [{ name: 'Sirius', snum: 1, planets: [] }],
      supplementStars: [],
      catalogStars: null,
    });
    const r = ov.resolve('Sirius');
    expect(r.tableEntry).toBeTruthy();
    expect(r.companionSpec).toBe(r.tableEntry); // the table entry, not the synthesized single
    expect(r.companionSpec.kind).toBe('multiple');
    expect(r.companionSpec.source).toBeUndefined(); // not 'archive-snum'
  });
});
