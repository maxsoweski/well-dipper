import { describe, it, expect } from 'vitest';
import { KnownSystems } from '../KnownSystems.js';
import { RealStarCatalog } from '../RealStarCatalog.js';
import { GalacticMap } from '../GalacticMap.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const SOL_POS = { x: GalacticMap.SOLAR_R, y: GalacticMap.SOLAR_Z, z: 0.0 };

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

  it('does NOT match Sol at Rigil Kentaurus (1.32 pc — nearest real star)', () => {
    expect(KnownSystems.findAt(RIGIL_POS)).toBeNull();
  });

  it('no real catalog star falls inside a known system match radius UNLESS it IS that system', () => {
    // Load the shipped HYG catalog directly (no fetch in node).
    // Identity-agreement exemption: the catalog legitimately carries Sol
    // itself at the KnownSystems position (nav overlay + sky rendering need
    // it) — a catalog star inside a known system's radius is only a swallow
    // when the NAMES disagree.
    const here = dirname(fileURLToPath(import.meta.url));
    const catalogPath = join(here, '../../../public/assets/data/hyg-stars.json');
    const stars = JSON.parse(readFileSync(catalogPath, 'utf8'));
    const swallowed = [];
    for (const s of stars) {
      const ks = KnownSystems.findAt(s);
      if (ks && s.name !== ks.name) swallowed.push(`${s.name || '(unnamed)'} → ${ks.name}`);
    }
    expect(swallowed, `real stars swallowed by known-system radius: ${swallowed.join(', ')}`).toHaveLength(0);
  });

  it('the shipped catalog contains Sol itself, agreeing with the KnownSystems registry', () => {
    // Regression: the AC9 catalog regeneration dropped the Sun (HYG row 0 has
    // dist=0, rejected by the distance filter). Without a catalog Sol, the
    // nav computer's real-star overlay never names the home system — the
    // nearest hash-grid star shows a procgen/settled name instead ("Sol in
    // the nav computer gets a name like Talimon", UAT 2026-07-10).
    const here = dirname(fileURLToPath(import.meta.url));
    const catalogPath = join(here, '../../../public/assets/data/hyg-stars.json');
    const stars = JSON.parse(readFileSync(catalogPath, 'utf8'));
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
