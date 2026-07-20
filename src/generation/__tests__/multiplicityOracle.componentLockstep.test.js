/**
 * Oracle / mult() lockstep under componentSystems — S4 of
 * multistar-components-2026-07-19 (AC4). Guard slice: production untouched
 * (multiplicityOracle.js reads companionSpec/farCompanions only, never a
 * generated systemData's componentSystems).
 *
 * FRAMING (accurate per build-plan S4): componentSystems is structurally
 * INVISIBLE to the oracle and to mult(). These tests prove additive
 * non-interaction / count invariance at 5583651 behavior — not "lockstep
 * under a componentSystems-bearing payload". The outcome is NO oracle
 * production change; the 1:1 invariant additionally future-proofs a switch
 * to counting components directly.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { multiplicityForSeed } from '../multiplicityOracle.js';
import { RealStarCatalog } from '../RealStarCatalog.js';
import { KnownSystems } from '../KnownSystems.js';
import { GalacticMap } from '../GalacticMap.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';
import { realStarSeed } from '../realStarSeed.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = (name) => join(HERE, '../../../public/assets/data', name);
const contents = JSON.parse(readFileSync(DATA('real-system-contents.json'), 'utf8'));
const supplement = JSON.parse(readFileSync(DATA('real-star-supplement.json'), 'utf8'));
const HYG = JSON.parse(readFileSync(DATA('hyg-stars.json'), 'utf8'));
const CATALOG_STARS = HYG.concat(supplement.stars);
const byName = (n) => CATALOG_STARS.find((s) => s.name === n);

const MASTER_SEED = 'well-dipper-galaxy-1';

let map;
let overlay;
let deps;

beforeAll(() => {
  map = new GalacticMap(MASTER_SEED);
  const catalog = new RealStarCatalog();
  catalog.ingestCatalogData(HYG, { stars: supplement.stars }, { hosts: contents.hosts });
  overlay = catalog.overlay;
  KnownSystems.associate(catalog, map);
  deps = { overlay, galacticMap: map };
});

// The multiplicityOracle.test.js helper, verbatim: primary + close + wides.
const mult = (sys) =>
  1 + (sys.star2 ? 1 : 0) + (Array.isArray(sys.farCompanions) ? sys.farCompanions.length : 0);

const arrivalCtx = (pos, type, name) => {
  const ctx = map.deriveGalaxyContext(pos);
  ctx.starTypeOverride = type;
  overlay.applyToContext(ctx, name, pos);
  return ctx;
};

const starObj = (rec) => ({
  worldX: rec.x, worldY: rec.y, worldZ: rec.z,
  type: rec.spect,
  seed: realStarSeed(rec.x, rec.y, rec.z),
  name: rec.name,
  isRealStar: true,
});

describe('AC4 — mult()/oracle invariance under the componentSystems key', () => {
  it('mult() ignores componentSystems — a synthetic sys with the key returns the same count', () => {
    const base = { star2: { type: 'K' }, farCompanions: [{ name: 'far' }] };
    const withKey = { ...base, componentSystems: [{ name: 'far', systemData: { planets: [] } }] };
    expect(mult(base)).toBe(3);
    expect(mult(withKey)).toBe(mult(base));
    // And on a single with no far members: the key alone must not add a count.
    expect(mult({ star2: null, componentSystems: [] })).toBe(1);
  });

  it('componentSystems.length === farCompanions.length for every census row (the 1:1 invariant)', () => {
    // Even a future oracle that counted components directly would agree.
    const CASES = [
      { name: 'Guniibuu', type: 'K' },
      { name: 'Zet-1 Ret', type: 'G' },
    ];
    for (const { name, type } of CASES) {
      const rec = byName(name);
      const sys = StarSystemGenerator.generate(
        String(realStarSeed(rec.x, rec.y, rec.z)),
        arrivalCtx({ x: rec.x, y: rec.y, z: rec.z }, type, name),
      );
      expect(sys.componentSystems.length, name).toBe(sys.farCompanions.length);
    }
    const alphaCen = KnownSystems.findByAlias('Rigil Kentaurus', byName('Rigil Kentaurus')).generate();
    expect(alphaCen.componentSystems.length).toBe(alphaCen.farCompanions.length);
  });

  it('Zet-1 Ret intermediate oracle object pinned — the third topology (S4-verify NIT)', () => {
    // The contract's AC4 observable is the full {count, closeCount, farCount,
    // farNames} shape; every other census row's object is pinned in
    // multiplicityOracle.test.js, but Zet-1 Ret (single primary + collapsed
    // far companion) had only count + end-to-end dots pinned anywhere.
    const rec = byName('Zet-1 Ret');
    expect(multiplicityForSeed(starObj(rec), deps)).toMatchObject({
      count: 2, closeCount: 1, farCount: 1, farNames: ['Zet-2 Ret'], source: 'table',
    });
  });

  it('oracle.count === mult(generated systemData) for the full census WITH componentSystems present', () => {
    // Alpha Cen 3 (authored, components present).
    const rigil = byName('Rigil Kentaurus');
    const acSys = KnownSystems.findByAlias('Rigil Kentaurus', { x: rigil.x, y: rigil.y, z: rigil.z }).generate();
    expect('componentSystems' in acSys).toBe(true);
    expect(multiplicityForSeed(starObj(rigil), deps).count).toBe(mult(acSys));
    expect(multiplicityForSeed(starObj(rigil), deps).count).toBe(3);

    // Table rows through the real arrival ctx (components present on far rows).
    const TABLE = [
      { name: 'Guniibuu', type: 'K', expected: 3, hasComponents: true },
      { name: 'Zet-1 Ret', type: 'G', expected: 2, hasComponents: true },
      { name: 'Sirius', type: 'A', expected: 2, hasComponents: false },
    ];
    for (const { name, type, expected, hasComponents } of TABLE) {
      const rec = byName(name);
      const sys = StarSystemGenerator.generate(
        String(realStarSeed(rec.x, rec.y, rec.z)),
        arrivalCtx({ x: rec.x, y: rec.y, z: rec.z }, type, name),
      );
      expect('componentSystems' in sys, name).toBe(hasComponents);
      const oracle = multiplicityForSeed(starObj(rec), deps);
      expect(oracle.count, name).toBe(mult(sys));
      expect(oracle.count, name).toBe(expected);
    }

    // Procgen binary control (no componentSystems ever).
    const POS = { x: 8.31, y: 0.09, z: 0.17 };
    let binary = null;
    for (let i = 0; i < 40 && !binary; i++) {
      const ctx = map.deriveGalaxyContext(POS);
      ctx.starTypeOverride = 'G';
      const sys = StarSystemGenerator.generate(`procgen-${i}`, ctx);
      if (sys.isBinary) binary = { seed: `procgen-${i}`, sys };
    }
    expect(binary, 'found a binary-rolling seed').not.toBeNull();
    expect('componentSystems' in binary.sys).toBe(false);
    const oracle = multiplicityForSeed(
      { name: 'Procgen Test Star', seed: binary.seed, type: 'G', worldX: POS.x, worldY: POS.y, worldZ: POS.z, isRealStar: false },
      deps,
    );
    expect(oracle.count).toBe(mult(binary.sys));
    expect(oracle.count).toBe(2);
  });
});
