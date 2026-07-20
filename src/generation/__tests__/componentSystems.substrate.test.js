/**
 * componentSystems substrate emission — S2 of multistar-components-2026-07-19.
 *
 * AC1: every farCompanions-bearing STELLAR_COMPANIONS row promotes its wide
 * members to full spawnable component sub-systems (systemData.componentSystems,
 * 1:1 same-order with systemData.farCompanions); every other row emits no key.
 * AC2: the payload seed is componentSeed(canonicalSeed, idx); identical
 * componentSystems on every resolution path and repeat, including the genuinely
 * distinct sync-preview vs async-arrival pair (generate vs generateAsync sharing
 * _generateIterator through the yield* delegation).
 *
 * Census paths mirror production: Alpha Cen via the authored registry
 * (generateAuthoredSystem); all other table rows via the real arrival pipeline
 * (resolveArrivalSystem over the shipped ingest — the arrivalResolution.test.js
 * idiom).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { STELLAR_COMPANIONS } from '../data/stellarCompanions.js';
import { KnownSystems } from '../KnownSystems.js';
import { generateAuthoredSystem } from '../KnownSystemAuthoring.js';
import { resolveArrivalSystem, resolveArrivalSystemAsync } from '../arrivalResolution.js';
import { RealSystemOverlay } from '../RealSystemOverlay.js';
import { GalacticMap } from '../GalacticMap.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';
import { componentSeed, validateComponentPayload } from '../componentSystems.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = (name) => join(HERE, '../../../public/assets/data', name);
const contents = JSON.parse(readFileSync(DATA('real-system-contents.json'), 'utf8'));
const supplement = JSON.parse(readFileSync(DATA('real-star-supplement.json'), 'utf8'));
const HYG = JSON.parse(readFileSync(DATA('hyg-stars.json'), 'utf8'));

const MASTER_SEED = 'well-dipper-galaxy-1';
const REAL_POS = { x: 8.0, y: 0.025, z: -0.001 };  // overlay join is by NAME
const AC_POS = { x: 8.000948, y: 0.024984, z: -0.000924 }; // Rigil's registry pos
const rt = (o) => JSON.parse(JSON.stringify(o));

// Catalog spect for the two pinned singles (no components[] to derive from).
const SINGLE_TYPES = { Vega: 'A', Altair: 'A' };

let gm;
let overlay;

beforeAll(() => {
  gm = new GalacticMap(MASTER_SEED);
  overlay = new RealSystemOverlay({
    contentsHosts: contents.hosts,
    supplementStars: supplement.stars,
    catalogStars: HYG.concat(supplement.stars),
  });
});

const alphaCenEntry = () => KnownSystems.getAll().find((k) => k.name === 'Alpha Centauri');

// Generate a STELLAR_COMPANIONS row the way production reaches it, returning
// the systemData and the CANONICAL seed its components derive from.
function generateRow(entry, seed) {
  if (entry.name === 'Alpha Centauri') {
    const ks = alphaCenEntry();
    return { sys: generateAuthoredSystem(ks, null), canonicalSeed: ks.seed };
  }
  const starType = Array.isArray(entry.components)
    ? StarSystemGenerator.normalizeSpectralClass(entry.components[0].class)
    : SINGLE_TYPES[entry.name];
  const { systemData, knownWarp } = resolveArrivalSystem({
    galacticMap: gm, overlay, pos: REAL_POS, starType,
    seed, displayName: entry.name, hasNavStar: true,
  });
  expect(knownWarp).toBeFalsy(); // every non-Alpha-Cen row rides the overlay path
  return { sys: systemData, canonicalSeed: seed };
}

const FAR_ROWS = STELLAR_COMPANIONS
  .filter((e) => Array.isArray(e.farCompanions) && e.farCompanions.length > 0);

describe('AC1 — census over STELLAR_COMPANIONS', () => {
  it('every farCompanions-bearing row yields componentSystems 1:1 with farCompanions; every other row yields no key', () => {
    // The D4 default breadth: exactly these three far-bearing rows.
    expect(FAR_ROWS.map((e) => e.name))
      .toEqual(['Alpha Centauri', 'Guniibuu', 'Zet-1 Ret']);
    for (const entry of STELLAR_COMPANIONS) {
      const { sys } = generateRow(entry, `census-${entry.name}`);
      if (FAR_ROWS.includes(entry)) {
        expect(Array.isArray(sys.componentSystems), entry.name).toBe(true);
        expect(sys.componentSystems.length, entry.name).toBe(entry.farCompanions.length);
        sys.componentSystems.forEach((c, i) => {
          // Payload shape holds for every component of every far-bearing row.
          expect(validateComponentPayload(c).errors, `${entry.name}[${i}]`).toEqual([]);
          // 1:1 same-order mirror of the farCompanions emission.
          expect(c.name).toBe(sys.farCompanions[i].name);
          expect(c.class).toBe(sys.farCompanions[i].class);
          expect(c.type).toBe(sys.farCompanions[i].type);
          expect(c.separationAU).toBe(sys.farCompanions[i].separationAU);
        });
      } else {
        expect('componentSystems' in sys, entry.name).toBe(false);
      }
    }
  });
});

describe('AC1 — component payload contents', () => {
  it('Alpha Cen component is Proxima (type M, star.spectFull M5.5Ve) with b and d at archive orbits', () => {
    const sys = generateAuthoredSystem(alphaCenEntry(), null);
    expect(sys.componentSystems).toHaveLength(1);
    const comp = sys.componentSystems[0];
    expect(comp.name).toBe('Proxima Centauri');
    expect(comp.class).toBe('M5.5Ve');
    expect(comp.type).toBe('M');
    expect(comp.separationAU).toBe(13000);
    // The component star: single, M, full display class stamped (spectFull carry).
    expect(comp.systemData.star.type).toBe('M');
    expect(comp.systemData.star.spectFull).toBe('M5.5Ve');
    expect(comp.systemData.isBinary).toBe(false);
    expect(comp.systemData.star2).toBeNull();
    // The b/d pins land at their REAL archive orbits (payload-sourced, never
    // synthesized) with the known flag + letters, d inside b (0.02881 < 0.04848).
    const knowns = comp.systemData.planets.filter((p) => p.known === true);
    expect(knowns.map((p) => p.letter).sort()).toEqual(['b', 'd']);
    const byLetter = Object.fromEntries(knowns.map((p) => [p.letter, p]));
    expect(byLetter.d.orbitRadiusAU).toBe(0.02881);
    expect(byLetter.b.orbitRadiusAU).toBe(0.04848);
    expect(comp.systemData.planets.indexOf(byLetter.d))
      .toBeLessThan(comp.systemData.planets.indexOf(byLetter.b));
  });

  it('Guniibuu → HD 156026 (0 pins) and Zet-1 Ret → Zet-2 Ret (0 pins) are single stars, procgen fill only', () => {
    const CASES = [
      { row: 'Guniibuu', type: 'K', compName: 'HD 156026', compClass: 'K5V' },
      { row: 'Zet-1 Ret', type: 'G', compName: 'Zet-2 Ret', compClass: 'G1V' },
    ];
    for (const { row, type, compName, compClass } of CASES) {
      const { systemData } = resolveArrivalSystem({
        galacticMap: gm, overlay, pos: REAL_POS, starType: type,
        seed: `${row}-sub`, displayName: row, hasNavStar: true,
      });
      expect(systemData.componentSystems, row).toHaveLength(1);
      const comp = systemData.componentSystems[0];
      expect(comp.name).toBe(compName);
      expect(comp.systemData.isBinary).toBe(false);
      expect(comp.systemData.star2).toBeNull();
      expect(comp.systemData.star.spectFull).toBe(compClass);
      // Zero pins: no known planet ever appears — the fill is pure child-stream procgen.
      expect(comp.systemData.planets.every((p) => p.known !== true), row).toBe(true);
    }
  });
});

describe('AC2 — child-stream seed on the emission path', () => {
  it('payload seed === componentSeed(canonicalSeed, idx) — recomputed', () => {
    // Authored path: the canonical seed is the registry entry's own seed.
    const ks = alphaCenEntry();
    const authored = generateAuthoredSystem(ks, null);
    expect(authored.componentSystems[0].seed).toBe(componentSeed(ks.seed, 0));
    // Overlay path: the canonical seed is whatever generate() received.
    const { sys, canonicalSeed } = generateRow(
      STELLAR_COMPANIONS.find((e) => e.name === 'Guniibuu'), 'gun-seed-check');
    expect(sys.componentSystems[0].seed).toBe(componentSeed(canonicalSeed, 0));
  });

  it('path-independence: Alpha Cen componentSystems deep-equal across authoring, nav-pick, and a repeat', () => {
    const ks = alphaCenEntry();
    const direct = generateAuthoredSystem(ks, null);
    const repeat = generateAuthoredSystem(ks, null);
    const nav = resolveArrivalSystem({
      galacticMap: gm, overlay, pos: AC_POS, starType: 'G',
      seed: 'irrelevant', displayName: 'Alpha Centauri', hasNavStar: true,
    });
    expect(nav.knownWarp?.name).toBe('Alpha Centauri');
    expect(rt(direct.componentSystems)).toEqual(rt(repeat.componentSystems));
    expect(rt(direct.componentSystems)).toEqual(rt(nav.systemData.componentSystems));
  });

  it('sync≡async: Guniibuu componentSystems (and whole systemData) deep-equal across preview and arrival', async () => {
    // The genuinely distinct path pair: sync preview rides generate(), async
    // arrival rides generateAsync() — same _generateIterator, and the component
    // recursion's yield* delegation must not perturb either stream.
    const params = {
      galacticMap: gm, overlay, pos: REAL_POS, starType: 'K',
      seed: 'gun-async', displayName: 'Guniibuu', hasNavStar: true,
    };
    const sync = resolveArrivalSystem(params).systemData;
    const asyn = (await resolveArrivalSystemAsync(params)).systemData;
    expect(rt(sync.componentSystems)).toEqual(rt(asyn.componentSystems));
    expect(rt(sync)).toEqual(rt(asyn));
  });
});
