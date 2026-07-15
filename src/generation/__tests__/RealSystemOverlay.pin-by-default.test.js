import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { RealSystemOverlay } from '../RealSystemOverlay.js';
import { GalacticMap } from '../GalacticMap.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';

/**
 * AC5 — fabrication reach = PIN-BY-DEFAULT (Max ruling 2026-07-15,
 * real-star-identity-unification-2026-07-15, FIX-3). A REAL catalog star with
 * NO companion-table entry and NO exoplanet-archive host never rolls a
 * fabricated stellar companion — it arrives SINGLE. Overrides stay data-won:
 * the curated table wins where it covers; the archive snum wins in BOTH
 * directions (snum==1 pins single; an un-tabled snum>=2 host keeps its roll).
 * Reach is real-catalog arrivals only — procgen (non-real) stars keep their
 * live binary roll untouched (resolve() is only ever invoked for a resolved
 * real-catalog arrival; procgen ctx never passes through the overlay).
 *
 * End-to-end through the REAL arrival pipeline exactly as the two main.js call
 * sites build it: deriveGalaxyContext(position) → starTypeOverride = catalog
 * spect (D6) → RealSystemOverlay.applyToContext bolts the overlay ctx fields →
 * StarSystemGenerator.generate. Real shipped ingest, no mocks, read off disk.
 * Every case is generated TWICE and deep-compared (determinism).
 *
 * Seed fixtures were probed against the bare (no-companionSpec) generator so
 * they demonstrably WOULD roll a binary absent the pin: 'bet-b0' rolls a binary
 * for an M star; 'procgen-b0' rolls a binary for a pure-procgen (no override)
 * ctx. Precedence proof: table > snum > pin-by-default.
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

describe('AC5(a) — un-tabled, un-hosted real star: pinned single (never fabricates a companion)', () => {
  // Betelgeuse is a real HYG star (catalog spect M) with NO archive host and NO
  // companion-table entry. 'bet-b0' rolls a binary on a BARE ctx (proving the
  // seed "would roll a binary absent the pin"); pin-by-default must veto it.
  const NAME = 'Betelgeuse';
  const SEED = 'bet-b0';
  const build = () => {
    const ctx = baseCtx();
    ctx.starTypeOverride = 'M'; // catalog spect (HYG), D6
    return OV().applyToContext(ctx, NAME);
  };

  it('resolve() synthesizes the pin-by-default single (no table, no host)', () => {
    const r = OV().resolve(NAME);
    expect(r.tableEntry).toBeUndefined();
    expect(r.host).toBeUndefined();
    expect(r.companionSpec).toEqual({ kind: 'single', source: 'pin-by-default' });
    expect('knownPlanets' in r).toBe(false);
    expect('farCompanions' in r).toBe(false);
  });

  it('the seed WOULD roll a binary absent the pin, and the pin suppresses it', () => {
    // Baseline: same star type, NO companionSpec → the procgen roll fires.
    const bare = baseCtx();
    bare.starTypeOverride = 'M';
    expect(StarSystemGenerator.generate(SEED, bare).isBinary).toBe(true);
    // With the pin (full overlay applyToContext): NO companion.
    const sys = StarSystemGenerator.generate(SEED, build());
    expect(sys.isBinary).toBe(false);
    expect(sys.star2).toBeNull();
    expect(sys.star.type).toBe('M'); // catalog type preserved
  });

  it('generate twice → deep-equal systemData (deterministic)', () => {
    expect(rt(StarSystemGenerator.generate(SEED, build())))
      .toEqual(rt(StarSystemGenerator.generate(SEED, build())));
  });
});

describe('AC5(b) — companion-table binary: Sirius → A+DA2 (table wins over the pin)', () => {
  const NAME = 'Sirius';
  const SEED = 'sirius-ac5';
  const build = () => {
    const ctx = baseCtx();
    ctx.starTypeOverride = 'A'; // catalog spect
    return OV().applyToContext(ctx, NAME);
  };

  it('resolve() keeps the curated multiple — the pin-by-default never fires', () => {
    const r = OV().resolve(NAME);
    expect(r.companionSpec.kind).toBe('multiple');
    expect(r.companionSpec.source).toBeUndefined(); // not a synthesized single
  });

  it('generates the white-dwarf companion at 19.8 AU (no fallback warn)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sys = StarSystemGenerator.generate(SEED, build());
    expect(sys.isBinary).toBe(true);
    expect(sys.star2.type).toBe('D');
    expect(sys.star2.spectFull).toBe('DA2');
    expect(sys.star.spectFull).toBe('A1V');
    expect(sys.binarySeparationAU).toBe(19.8);
    const fallback = warnSpy.mock.calls.map((a) => String(a[0]))
      .filter((m) => /Unknown star type|Unknown companion class/.test(m));
    expect(fallback).toEqual([]);
  });

  it('generate twice → deep-equal systemData (deterministic)', () => {
    expect(rt(StarSystemGenerator.generate(SEED, build())))
      .toEqual(rt(StarSystemGenerator.generate(SEED, build())));
  });
});

describe('AC5(c) — archive snum==1 host: TRAPPIST-1 → M single, 7 knowns b–h (snum pin intact)', () => {
  const NAME = 'TRAPPIST-1';
  const SEED = 't1-ac5';
  const build = () => {
    const ctx = baseCtx();
    ctx.starTypeOverride = 'M'; // TRAPPIST-1 catalog spect (supplement)
    return OV().applyToContext(ctx, NAME);
  };

  it('resolve() keeps the archive-snum single — NOT the pin-by-default (host present)', () => {
    const r = OV().resolve(NAME);
    expect(r.host.snum).toBe(1);
    expect(r.companionSpec).toEqual({ kind: 'single', source: 'archive-snum' });
  });

  it('arrives single with all seven archive planets b–h at their real params', () => {
    const host = hostByName(NAME);
    const sys = StarSystemGenerator.generate(SEED, build());
    expect(sys.isBinary).toBe(false);
    expect(sys.star2).toBeNull();
    const known = sys.planets.filter((p) => p.known);
    expect(known.map((p) => p.letter)).toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h']);
    for (const p of known) {
      const a = host.planets.find((h) => h.letter === p.letter);
      expect(p.orbitRadiusAU).toBe(a.smaAU);
      expect(p.planetData.radiusEarth).toBe(a.radiusEarth);
      expect(p.planetData.massEarth).toBe(a.massEarth);
    }
  });

  it('generate twice → deep-equal systemData (deterministic)', () => {
    expect(rt(StarSystemGenerator.generate(SEED, build())))
      .toEqual(rt(StarSystemGenerator.generate(SEED, build())));
  });
});

describe('AC5(d) — un-tabled archive snum>=2 host: 55 Cnc keeps its companion roll', () => {
  // 55 Cnc: archive snum:2, five knowns b–f, catalog G, NOT in the companion
  // table. The pin-by-default must NOT reach it — the archive says multiple, so
  // its live binary roll on 'imm-5' stays. One-directional boundary.
  const NAME = '55 Cnc';
  const SEED = 'imm-5';
  const build = () => {
    const ctx = baseCtx();
    ctx.starTypeOverride = 'G'; // catalog spect
    return OV().applyToContext(ctx, NAME);
  };

  it('resolve() supplies NO companionSpec — the roll is left live (pin never fires)', () => {
    const r = OV().resolve(NAME);
    expect(r.host.snum).toBeGreaterThanOrEqual(2);
    expect(r.tableEntry).toBeUndefined();
    expect('companionSpec' in r).toBe(false);
  });

  it('the procgen companion roll is preserved and knowns survive it', () => {
    const host = hostByName(NAME);
    const sys = StarSystemGenerator.generate(SEED, build());
    expect(sys.isBinary).toBe(true); // roll preserved — archive multiplicity honored
    expect(sys.star2).not.toBeNull();
    const known = sys.planets.filter((p) => p.known);
    expect(known).toHaveLength(5);
    for (const p of known) {
      const a = host.planets.find((h) => h.letter === p.letter);
      expect(p.orbitRadiusAU).toBe(a.smaAU);
    }
  });

  it('generate twice → deep-equal systemData (deterministic)', () => {
    expect(rt(StarSystemGenerator.generate(SEED, build())))
      .toEqual(rt(StarSystemGenerator.generate(SEED, build())));
  });
});

describe('AC5(e) — pure procgen star: the pin never reaches it, the binary still rolls', () => {
  // A procgen (non-real) star never passes through the overlay — resolve() is
  // never called for it, so no companionSpec is ever synthesized. 'procgen-b0'
  // rolls a binary on a bare procgen ctx and must keep doing so.
  const SEED = 'procgen-b0';
  const build = () => baseCtx(); // no starTypeOverride, no overlay, no companionSpec

  it('a binary-rolling procgen seed still rolls its binary (pin out of reach)', () => {
    const ctx = build();
    expect('companionSpec' in ctx).toBe(false);
    const sys = StarSystemGenerator.generate(SEED, ctx);
    expect(sys.isBinary).toBe(true);
    expect(sys.star2).not.toBeNull();
  });

  it('generate twice → deep-equal systemData (deterministic)', () => {
    expect(rt(StarSystemGenerator.generate(SEED, build())))
      .toEqual(rt(StarSystemGenerator.generate(SEED, build())));
  });
});
