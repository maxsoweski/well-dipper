import { describe, it, expect, vi } from 'vitest';
import { KnownSystems, MATCH_RADIUS, NAME_JOIN_RADIUS } from '../KnownSystems.js';
import { RealStarCatalog, POSITION_MATCH_TOL } from '../RealStarCatalog.js';
import { GalacticMap } from '../GalacticMap.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const SOL_POS = { x: GalacticMap.SOLAR_R, y: GalacticMap.SOLAR_Z, z: 0.0 };

// Load the shipped HYG catalog once (2.1 MB) and reuse across tests below —
// readFileSync+JSON.parse is expensive enough that per-test loading was
// doubling test runtime for no benefit (the file is read-only within a run).
const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(HERE, '../../../public/assets/data/hyg-stars.json');
const CATALOG_STARS = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));

// Real HYG catalog positions (public/assets/data/hyg-stars.json).
// Sirius is 2.64 pc from Sol — inside the old 5 pc match radius, which made
// teleport/warp arrivals at Sirius spawn the Sol system instead (the
// "Sirius search resolves to the solar system" UAT defect, 2026-07-08).
const SIRIUS_POS = { x: 7.998231, y: 0.024592, z: -0.001913 };
// Rigil Kentaurus (Alpha Cen) is the NEAREST real star to Sol: 1.32 pc.
// The match radius must stay below that distance or its identity is swallowed.
const RIGIL_POS = { x: 8.000948, y: 0.024984, z: -0.000924 };

describe('KnownSystems.findAt — match radius vs real-star neighbors', () => {
  it('matches Sol at its exact position (all intentional Sol routes pass exact coords)', () => {
    const ks = KnownSystems.findAt(SOL_POS);
    expect(ks).not.toBeNull();
    expect(ks.name).toBe('Sol');
  });

  it('does NOT match Sol at Sirius (2.64 pc away — Sirius keeps its identity)', () => {
    expect(KnownSystems.findAt(SIRIUS_POS)).toBeNull();
  });

  it('matches Alpha Centauri at Rigil Kentaurus (a1d2d4c successor flag 1 flips)', () => {
    // Increment 2 (real-universe-overlay-2026-07-12, AC5) registers Alpha
    // Centauri AT Rigil's HYG position. This test previously asserted findAt
    // returned null there ("does NOT match Sol at Rigil Kentaurus"); the
    // successor flag flips now that the authored A+B binary claims the position.
    // Rigil keeps its identity — it is now Alpha Centauri's, not Sol's, and not
    // a procgen impostor.
    const ks = KnownSystems.findAt(RIGIL_POS);
    expect(ks).not.toBeNull();
    expect(ks.name).toBe('Alpha Centauri');
  });

  it('no real catalog star falls inside a known system radius UNLESS it is a derived alias', () => {
    // Load the shipped HYG catalog directly (no fetch in node).
    // Identity-agreement exemption: a catalog star inside a known system's
    // radius is only a swallow when it is NOT one of that entry's derived
    // aliases (associate() claims every catalog star within MATCH_RADIUS —
    // for a multi-star registry entry like Alpha Centauri, BOTH component
    // names become aliases, so this stays satisfiable when that entry ships).
    const cat = new RealStarCatalog();
    cat._stars = CATALOG_STARS; cat._loaded = true;
    KnownSystems.associate(cat);
    const swallowed = [];
    for (const s of CATALOG_STARS) {
      const ks = KnownSystems.findAt(s);
      if (ks && !ks.aliases.has(s.name)) swallowed.push(`${s.name || '(unnamed)'} → ${ks.name}`);
    }
    expect(swallowed, `real stars swallowed: ${swallowed.join(', ')}`).toHaveLength(0);
  });

  it('the shipped catalog contains Sol itself, agreeing with the KnownSystems registry', () => {
    // Regression: the AC9 catalog regeneration dropped the Sun (HYG row 0 has
    // dist=0, rejected by the distance filter). Without a catalog Sol, the
    // nav computer's real-star overlay never names the home system — the
    // nearest hash-grid star shows a procgen/settled name instead ("Sol in
    // the nav computer gets a name like Talimon", UAT 2026-07-10).
    const stars = CATALOG_STARS;
    const sol = stars.filter(s => s.name === 'Sol');
    expect(sol, 'catalog must contain exactly one Sol entry').toHaveLength(1);
    expect(sol[0].x).toBeCloseTo(SOL_POS.x, 6);
    expect(sol[0].y).toBeCloseTo(SOL_POS.y, 6);
    expect(sol[0].z).toBeCloseTo(SOL_POS.z, 6);
    expect(sol[0].spect).toBe('G');
    // And KnownSystems must claim it (identity agreement, not a swallow)
    expect(KnownSystems.findAt(sol[0])?.name).toBe('Sol');
  });
});

describe('RealStarCatalog.findByPosition — identity lookup for teleport arrivals', () => {
  // Build a catalog instance with controlled data (load() uses fetch — not
  // available here; _stars injection mirrors how load() populates it).
  const makeCatalog = (stars) => {
    const cat = new RealStarCatalog();
    cat._stars = stars;
    cat._loaded = true;
    return cat;
  };

  it('finds a star at its exact position', () => {
    const cat = makeCatalog([{ ...SIRIUS_POS, name: 'Sirius', spect: 'A' }]);
    expect(cat.findByPosition(SIRIUS_POS)?.name).toBe('Sirius');
  });

  it('returns null when nothing is within tolerance', () => {
    const cat = makeCatalog([{ ...SIRIUS_POS, name: 'Sirius', spect: 'A' }]);
    // Sol's position is 2.64 pc from Sirius — far outside the 0.1 pc default.
    expect(cat.findByPosition(SOL_POS)).toBeNull();
  });

  it('returns the NEAREST star when a close pair sits within tolerance', () => {
    // 61 Cygni A/B style pair: ~0.0004 pc apart — both inside a 0.1 pc
    // tolerance around either component. Must pick the closer one.
    const a = { x: 8.001, y: 0.025, z: 0.003, name: 'Pair A', spect: 'K' };
    const b = { x: 8.001, y: 0.025, z: 0.0034, name: 'Pair B', spect: 'K' };
    const cat = makeCatalog([b, a]); // deliberately not in nearest-first order
    expect(cat.findByPosition({ x: 8.001, y: 0.025, z: 0.003 })?.name).toBe('Pair A');
    expect(cat.findByPosition({ x: 8.001, y: 0.025, z: 0.0034 })?.name).toBe('Pair B');
  });

  it('returns null before the catalog has loaded', () => {
    const cat = new RealStarCatalog();
    expect(cat.findByPosition(SIRIUS_POS)).toBeNull();
  });
});

describe('cross-file invariant — RealStarCatalog tolerance vs KnownSystems radius', () => {
  it('POSITION_MATCH_TOL stays below KnownSystems.MATCH_RADIUS', () => {
    // If RealStarCatalog's default identity tolerance ever grew to meet or
    // exceed KnownSystems' match radius, a teleport landing in the annulus
    // between them (position within POSITION_MATCH_TOL of a real star but
    // outside MATCH_RADIUS of a known system) could resolve ambiguously —
    // or, if the ordering flipped, a real star just outside its own
    // tolerance could still fall inside a known system's radius and spawn
    // wearing that known system's name (the inverse of the Sirius bug this
    // file guards against above). Keeping tol < radius keeps the two lookups
    // strictly nested rather than overlapping.
    expect(POSITION_MATCH_TOL).toBeLessThan(MATCH_RADIUS);
  });
});

describe('alias-index + positional-belt join', () => {
  // Name-only checks against the real, shared Sol entry — safe to run
  // non-isolated because the eager self-name alias exists independent of
  // whether/when associate() has run, and the real catalog's only claim on
  // Sol's position is Sol itself (verified above), so no extra aliases leak
  // into these assertions.
  it('resolves Sol via its eager self-name alias, seeded at module load', () => {
    expect(KnownSystems.findByAlias('Sol', SOL_POS)?.name).toBe('Sol');
    // Rigil is 1.32 pc from Sol — never claimed by Sol. Since Increment 2 (AC5)
    // registered Alpha Centauri at Rigil's position, Rigil is now that entry's
    // alias (once associate() runs), not Sol's. Order-robust but exact: the
    // only legal outcomes are null (associate not yet run in this file) or
    // the Alpha Centauri entry — anything else is a mis-claim.
    const rigilOwner = KnownSystems.findByAlias('Rigil Kentaurus', RIGIL_POS);
    expect([null, 'Alpha Centauri']).toContain(rigilOwner?.name ?? null);
  });

  it('the positional belt rejects a far same-named arrival', () => {
    const farSol = { x: SOL_POS.x + 0.006, y: SOL_POS.y, z: SOL_POS.z }; // 6 pc
    expect(KnownSystems.findByAlias('Sol', farSol)).toBeNull();
    expect(KnownSystems.findByAlias('Sol', SOL_POS)?.name).toBe('Sol');
  });

  it('the belt is looser than the nav rename window (2 pc)', () => {
    expect(NAME_JOIN_RADIUS).toBeGreaterThan(0.002);
  });

  it('BINARY de-risk: one registry entry claims two aliases at two close positions', async () => {
    // Isolated: fresh KnownSystems module so the synthetic aliases below
    // don't leak into other tests' shared _aliasIndex/aliases Sets.
    vi.resetModules();
    const KS = await import('../KnownSystems.js');
    const solPos = KS.KnownSystems.getAll().find(k => k.name === 'Sol').position;
    const secondaryPos = { x: solPos.x + 0.0003, y: solPos.y, z: solPos.z }; // ~0.3 pc — inside MATCH_RADIUS (0.5 pc)
    const cat = new RealStarCatalog();
    cat._stars = [
      { ...solPos, name: 'Primary', spect: 'G' },
      { ...secondaryPos, name: 'Secondary', spect: 'K' },
    ];
    cat._loaded = true;
    KS.KnownSystems.associate(cat);

    const sol = KS.KnownSystems.getAll().find(k => k.name === 'Sol');
    expect(sol.aliases.has('Primary')).toBe(true);
    expect(sol.aliases.has('Secondary')).toBe(true);
    expect(KS.KnownSystems.findByAlias('Primary', solPos)?.name).toBe('Sol');
    expect(KS.KnownSystems.findByAlias('Secondary', secondaryPos)?.name).toBe('Sol');
  });

  it('DUPLICATE-NAME robustness: a near instance resolves, a far instance of the same name is belt-rejected', async () => {
    vi.resetModules();
    const KS = await import('../KnownSystems.js');
    const solPos = KS.KnownSystems.getAll().find(k => k.name === 'Sol').position;
    const farTwinPos = { x: solPos.x + 0.05, y: solPos.y, z: solPos.z }; // 50 pc
    const cat = new RealStarCatalog();
    cat._stars = [
      { ...solPos, name: 'Twin', spect: 'G' },
      { ...farTwinPos, name: 'Twin', spect: 'K' },
    ];
    cat._loaded = true;
    KS.KnownSystems.associate(cat);

    expect(KS.KnownSystems.findByAlias('Twin', solPos)?.name).toBe('Sol');
    expect(KS.KnownSystems.findByAlias('Twin', farTwinPos)).toBeNull(); // belt rejects
    expect(KS.KnownSystems.findAt(farTwinPos)).toBeNull();
  });

  it('IDEMPOTENCY: associating the same catalog twice does not grow the alias set', async () => {
    vi.resetModules();
    const KS = await import('../KnownSystems.js');
    const solPos = KS.KnownSystems.getAll().find(k => k.name === 'Sol').position;
    const cat = new RealStarCatalog();
    cat._stars = [{ ...solPos, name: 'Primary', spect: 'G' }];
    cat._loaded = true;

    KS.KnownSystems.associate(cat);
    const sol = KS.KnownSystems.getAll().find(k => k.name === 'Sol');
    const sizeAfterFirst = sol.aliases.size;

    KS.KnownSystems.associate(cat);
    expect(sol.aliases.size).toBe(sizeAfterFirst);
  });

  it('FALLBACK: associate(null) and associate(unloaded catalog) do not throw', () => {
    expect(() => KnownSystems.associate(null)).not.toThrow();
    expect(() => KnownSystems.associate(new RealStarCatalog())).not.toThrow();
    expect(KnownSystems.findByAlias('Sol', SOL_POS)?.name).toBe('Sol');
  });

  it('PROCGEN safety: non-known star names never resolve to a known system', () => {
    expect(KnownSystems.findByAlias('Sirius', SIRIUS_POS)).toBeNull();
    expect(KnownSystems.findByAlias('Xq-4471', SOL_POS)).toBeNull();
  });
});
