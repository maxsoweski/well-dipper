/**
 * Prism glyph dot-count invariance under componentSystems — S4 of
 * multistar-components-2026-07-19 (AC4). Guard slice: NavComputer untouched.
 *
 * The glyph path (_glyphDotCount ← _glyphMult ← multiplicityForSeed +
 * _localStarNames) never consumes a generated systemData, so it is
 * componentSystems-BLIND by construction; these tests pin every census dot
 * count at 5583651 behavior — including Zet-1 Ret's third topology (single
 * primary + collapsed far companion) — so any future change that routes a
 * componentSystems-bearing payload into the glyph decision trips here.
 * Extends the real-catalog census of NavComputer.glyphLabels.test.js.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NavComputer } from '../NavComputer.js';
import { multiplicityForSeed } from '../../generation/multiplicityOracle.js';
import { RealStarCatalog } from '../../generation/RealStarCatalog.js';
import { KnownSystems } from '../../generation/KnownSystems.js';
import { GalacticMap } from '../../generation/GalacticMap.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = (name) => join(HERE, '../../../public/assets/data', name);
const HYG = JSON.parse(readFileSync(DATA('hyg-stars.json'), 'utf8'));
const supplement = JSON.parse(readFileSync(DATA('real-star-supplement.json'), 'utf8'));
const contents = JSON.parse(readFileSync(DATA('real-system-contents.json'), 'utf8'));
const CATALOG_STARS = HYG.concat(supplement.stars);
const byName = (n) => CATALOG_STARS.find((s) => s.name === n);

let deps;
let markerNames;

beforeAll(() => {
  const map = new GalacticMap('well-dipper-galaxy-1');
  const catalog = new RealStarCatalog();
  catalog.ingestCatalogData(HYG, { stars: supplement.stars }, { hosts: contents.hosts });
  KnownSystems.associate(catalog, map);
  deps = { overlay: catalog.overlay, galacticMap: map };
  markerNames = new Set(CATALOG_STARS.map((s) => s.name).filter(Boolean));
});

const bareNav = () => Object.create(NavComputer.prototype);

// The per-marker decision for a real catalog row, exactly as the render wires
// it: real oracle result → _glyphDotCount with the full marker-name set. The
// oracle reads companionSpec/farCompanions (never a generated systemData), so
// every count below is componentSystems-blind BY CONSTRUCTION — the invariance
// is the point of the assertion.
function dotsFor(name) {
  const row = byName(name);
  expect(row, `catalog row for ${name}`).toBeTruthy();
  const mult = multiplicityForSeed(
    { name, worldX: row.x, worldY: row.y, worldZ: row.z, type: row.spect ?? row.type },
    deps,
  );
  const n = bareNav();
  n._localStarNames = markerNames;
  return n._glyphDotCount({ name }, mult);
}

describe('AC4 — census dot counts unchanged from 5583651 (componentSystems-blind)', () => {
  it('procgen binary marker = 2 dots (unchanged)', () => {
    // No catalog row — the oracle's shared-prefix roll drives the count, and
    // procgen output never carries componentSystems at all.
    const POS = { x: 8.31, y: 0.09, z: 0.17 };
    let found = null;
    for (let i = 0; i < 40 && !found; i++) {
      const m = multiplicityForSeed(
        { name: 'Procgen Glyph Star', seed: `procgen-${i}`, type: 'G', worldX: POS.x, worldY: POS.y, worldZ: POS.z, isRealStar: false },
        deps,
      );
      if (m.count === 2) found = m;
    }
    expect(found, 'found a binary-rolling seed').not.toBeNull();
    const n = bareNav();
    n._localStarNames = markerNames;
    expect(n._glyphDotCount({ name: 'Procgen Glyph Star' }, found)).toBe(2);
  });

  it('Guniibuu marker = 3 dots (unchanged — tertiary deduped in)', () =>
    expect(dotsFor('Guniibuu')).toBe(3));

  it('Rigil Kentaurus = 2 dots, Proxima Centauri = 1 dot (unchanged — Proxima owns its marker)', () => {
    expect(dotsFor('Rigil Kentaurus')).toBe(2);
    expect(dotsFor('Proxima Centauri')).toBe(1);
  });

  it('Zet-1 Ret = 2 dots — single primary + collapsed far companion, the third topology (unchanged)', () =>
    expect(dotsFor('Zet-1 Ret')).toBe(2));
});
