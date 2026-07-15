import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { multiplicityForSeed } from '../multiplicityOracle.js';
import { RealStarCatalog } from '../RealStarCatalog.js';
import { RealSystemOverlay } from '../RealSystemOverlay.js';
import { KnownSystems } from '../KnownSystems.js';
import { GalacticMap } from '../GalacticMap.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';
import { realStarSeed } from '../realStarSeed.js';

/**
 * AC7 — the multiplicity oracle answers ARRIVAL TRUTH for every star class.
 *
 * The invariant every case pins: the oracle's `count` equals the multiplicity of
 * the ACTUALLY-GENERATED systemData through the real arrival pipeline
 * (deriveGalaxyContext + starTypeOverride + overlay.applyToContext + generate for
 * real stars; KnownSystems.generate for authored; raw generate for procgen). A
 * glyph driven by the oracle therefore can never contradict what warping delivers.
 *
 * Real data (no mocks) is read off disk — the same JSON RealStarCatalog.load
 * fetches. KnownSystems.associate wires the catalog aliases (Rigil Kentaurus →
 * Alpha Centauri) exactly as main.js does after load.
 *
 * Cited: seed-identity-investigation.md §2/§4/§5; ac9-uat-findings.md finding #1
 * (oracle design); contract.json AC7.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = (name) => join(HERE, '../../../public/assets/data', name);
const contents = JSON.parse(readFileSync(DATA('real-system-contents.json'), 'utf8'));
const supplement = JSON.parse(readFileSync(DATA('real-star-supplement.json'), 'utf8'));
const HYG = JSON.parse(readFileSync(DATA('hyg-stars.json'), 'utf8'));
const CATALOG_STARS = HYG.concat(supplement.stars);
const byName = (n) => CATALOG_STARS.find((s) => s.name === n);

const MASTER_SEED = 'well-dipper-galaxy-1';

let catalog;
let overlay;
let map;
let deps;

beforeAll(() => {
  map = new GalacticMap(MASTER_SEED);
  catalog = new RealStarCatalog();
  catalog.ingestCatalogData(HYG, { stars: supplement.stars }, { hosts: contents.hosts });
  overlay = catalog.overlay;
  KnownSystems.associate(catalog, map); // wire catalog aliases as main.js does
  deps = { overlay, galacticMap: map };
});

afterEach(() => vi.restoreAllMocks());

/** Multiplicity of a generated systemData: primary + close companion + wides. */
const mult = (sys) =>
  1 + (sys.star2 ? 1 : 0) + (Array.isArray(sys.farCompanions) ? sys.farCompanions.length : 0);

/** Build the arrival context for a real catalog star exactly as main.js does. */
const arrivalCtx = (pos, type, name) => {
  const ctx = map.deriveGalaxyContext(pos);
  ctx.starTypeOverride = type;
  overlay.applyToContext(ctx, name, pos);
  return ctx;
};

/** Star object shaped like a findVisible (prism/sky) entry. */
const starObj = (rec, { name, isReal = true } = {}) => ({
  worldX: rec.x, worldY: rec.y, worldZ: rec.z,
  type: rec.spect,
  seed: realStarSeed(rec.x, rec.y, rec.z),
  name: name ?? rec.name,
  isRealStar: isReal,
});

describe('AC7 — oracle == generated systemData multiplicity, per star class', () => {
  it('known-system (Alpha Centauri via the Rigil Kentaurus alias): A+B close + Proxima far → 3', () => {
    const rigil = byName('Rigil Kentaurus');
    const oracle = multiplicityForSeed(starObj(rigil), deps);
    // Arrival truth = KnownSystems.generate() for the authored system.
    const ks = KnownSystems.findByAlias('Rigil Kentaurus', { x: rigil.x, y: rigil.y, z: rigil.z });
    expect(ks?.name).toBe('Alpha Centauri');
    const sys = ks.generate();
    expect(oracle.count).toBe(mult(sys));
    expect(oracle).toMatchObject({ count: 3, closeCount: 2, farCount: 1, source: 'known' });
    expect(sys.star2).not.toBeNull();          // A+B close pair
    expect(sys.farCompanions).toHaveLength(1);  // Proxima wide
  });

  it('known-system (Alpha Centauri via its own registry name) resolves the same way', () => {
    const rigil = byName('Rigil Kentaurus');
    const oracle = multiplicityForSeed(
      { name: 'Alpha Centauri', worldX: rigil.x, worldY: rigil.y, worldZ: rigil.z, type: 'G' },
      deps,
    );
    expect(oracle).toMatchObject({ count: 3, closeCount: 2, source: 'known' });
  });

  it('known-system (Sol): single star → 1', () => {
    const sol = KnownSystems.getAll().find((k) => k.name === 'Sol');
    const sys = sol.generate();
    const oracle = multiplicityForSeed(
      { name: 'Sol', worldX: sol.position.x, worldY: sol.position.y, worldZ: sol.position.z, type: 'G' },
      deps,
    );
    expect(oracle.count).toBe(mult(sys));
    expect(oracle).toMatchObject({ count: 1, closeCount: 1, farCount: 0, source: 'known' });
  });

  it('companion-table multiple (Sirius): A + white-dwarf close pair → 2', () => {
    const sirius = byName('Sirius');
    const oracle = multiplicityForSeed(starObj(sirius), deps);
    const sys = StarSystemGenerator.generate(
      String(realStarSeed(sirius.x, sirius.y, sirius.z)),
      arrivalCtx({ x: sirius.x, y: sirius.y, z: sirius.z }, 'A', 'Sirius'),
    );
    expect(oracle.count).toBe(mult(sys));
    expect(oracle).toMatchObject({ count: 2, closeCount: 2, farCount: 0, source: 'table' });
    expect(sys.isBinary).toBe(true);
    expect(sys.star2.type).toBe('D');
  });

  it('companion-table TRIPLE (36 Ophiuchi / Guniibuu): A+B close + K5 far → 3', () => {
    const g = byName('Guniibuu');
    const oracle = multiplicityForSeed(starObj(g), deps);
    const sys = StarSystemGenerator.generate(
      String(realStarSeed(g.x, g.y, g.z)),
      arrivalCtx({ x: g.x, y: g.y, z: g.z }, 'K', 'Guniibuu'),
    );
    expect(oracle.count).toBe(mult(sys));
    expect(oracle).toMatchObject({ count: 3, closeCount: 2, farCount: 1, source: 'table' });
    expect(sys.star2).not.toBeNull();
    expect(sys.farCompanions).toHaveLength(1);
  });

  it('archive snum==1 host (TRAPPIST-1): pinned single → 1', () => {
    const t1 = byName('TRAPPIST-1');
    const oracle = multiplicityForSeed(starObj(t1), deps);
    const sys = StarSystemGenerator.generate(
      String(realStarSeed(t1.x, t1.y, t1.z)),
      arrivalCtx({ x: t1.x, y: t1.y, z: t1.z }, 'M', 'TRAPPIST-1'),
    );
    expect(oracle.count).toBe(mult(sys));
    expect(oracle).toMatchObject({ count: 1, closeCount: 1, farCount: 0, source: 'archive-snum' });
    expect(sys.isBinary).toBe(false);
  });

  it('pin-by-default single (Betelgeuse: un-tabled, un-hosted real star) → 1', () => {
    const bet = byName('Betelgeuse');
    const oracle = multiplicityForSeed(starObj(bet), deps);
    const sys = StarSystemGenerator.generate(
      String(realStarSeed(bet.x, bet.y, bet.z)),
      arrivalCtx({ x: bet.x, y: bet.y, z: bet.z }, 'M', 'Betelgeuse'),
    );
    expect(oracle.count).toBe(mult(sys));
    expect(oracle).toMatchObject({ count: 1, closeCount: 1, farCount: 0, source: 'pin-by-default' });
    expect(sys.isBinary).toBe(false);
  });

  it('procgen single AND procgen binary: the shared prefix roll matches generation', () => {
    // A star that is NOT in the catalog / registry → the oracle falls through to
    // the shared prefix roll. Same seed + context arrival would use → the binary
    // decision is identical to StarSystemGenerator.generate by construction.
    const POS = { x: 8.31, y: 0.09, z: 0.17 }; // ordinary disk position, no real star
    const TYPE = 'G';
    const NAME = 'Procgen Test Star'; // not a real catalog name (blocklist guarantees)
    const buildCtx = () => {
      const c = map.deriveGalaxyContext(POS);
      c.starTypeOverride = TYPE;
      return c;
    };

    let single = null;
    let binary = null;
    for (let i = 0; i < 40 && (single === null || binary === null); i++) {
      const seed = `procgen-${i}`;
      const sys = StarSystemGenerator.generate(seed, buildCtx());
      if (sys.isBinary && binary === null) binary = { seed, sys };
      if (!sys.isBinary && single === null) single = { seed, sys };
    }
    expect(single, 'found a single-rolling seed').not.toBeNull();
    expect(binary, 'found a binary-rolling seed').not.toBeNull();

    for (const { seed, sys } of [single, binary]) {
      const oracle = multiplicityForSeed(
        { name: NAME, seed, type: TYPE, worldX: POS.x, worldY: POS.y, worldZ: POS.z, isRealStar: false },
        deps,
      );
      expect(oracle.count).toBe(mult(sys));       // == generated multiplicity
      expect(oracle.count).toBe(sys.isBinary ? 2 : 1);
      expect(oracle.source).toBe('procgen');
      expect(oracle.farCount).toBe(0);
    }
  });

  it('archive snum>=2 host (55 Cnc): companion procedurally rolled → oracle rolls the same', () => {
    // A real exoplanet host the archive flags snum:2 supplies NO companionSpec —
    // the arrival rolls the companion procgen-style (archive multiplicity honored
    // via the live roll, not fabricated structure). The oracle must roll the same
    // seed+context and agree. Uses a synthetic position/seed; multiplicity here is
    // purely seed-driven, so both sides sharing seed+ctx is what proves agreement.
    expect(overlay.resolve('55 Cnc').host?.snum).toBe(2);
    const POS = { x: 8.05, y: 0.02, z: -0.01 };
    for (const seed of ['imm-5', 'cnc-a', 'cnc-b', 'cnc-c']) {
      const ctx = map.deriveGalaxyContext(POS);
      ctx.starTypeOverride = 'G';
      overlay.applyToContext(ctx, '55 Cnc', POS); // adds knownPlanets, no companionSpec
      const sys = StarSystemGenerator.generate(seed, ctx);
      const oracle = multiplicityForSeed(
        { name: '55 Cnc', seed, type: 'G', worldX: POS.x, worldY: POS.y, worldZ: POS.z },
        deps,
      );
      expect(oracle.count).toBe(mult(sys));
      expect(oracle.source).toBe('archive-roll');
    }
  });
});

describe('AC7 — oracle stays cheap and does not fork the precedence chain', () => {
  it('a procgen call draws only the shared prefix (no full generation, no far key)', () => {
    // The prefix consumes starVariation + the binary chance — a handful of draws.
    // We assert behaviourally: the oracle returns without a farCompanions notion
    // for procgen, matching generation which never emits the key for procgen.
    const POS = { x: 8.2, y: 0.05, z: 0.05 };
    const oracle = multiplicityForSeed(
      { name: 'nowhere-real', seed: 'x1', type: 'K', worldX: POS.x, worldY: POS.y, worldZ: POS.z },
      deps,
    );
    expect(oracle.farCount).toBe(0);
    expect([1, 2]).toContain(oracle.count);
  });

  it('a bare seed (no position/name) still answers a procgen roll', () => {
    const oracle = multiplicityForSeed('bare-seed-7', deps);
    expect(oracle.source).toBe('procgen');
    expect([1, 2]).toContain(oracle.count);
  });
});
