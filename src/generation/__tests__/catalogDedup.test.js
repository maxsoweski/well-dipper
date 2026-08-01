// catalogDedup.test.js — FIX-4 of real-star-identity-unification-2026-07-15.
//
// Two things this unit ships: (1) curated companion-table entries for the three
// remaining collision-census multiples (36 Ophiuchi, 61 Cygni, ζ Reticuli); and
// (2) a catalog-regen dedup that collapses duplicate destinations to ONE row +
// aliases (same-position dup rows + table-covered multiple secondaries), so a
// real system renders ONE marker and every dropped designation stays BOTH
// searchable and on the real-proper-name blocklist.
//
// These tests run against the REAL shipped, regenerated JSON (the same files the
// game loads), not stubs — they are the guardrail for the two named invariants.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { resolveKnownObjects } from '../knownObjectSearch.js';
import { RealStarCatalog } from '../RealStarCatalog.js';
import { RealSystemOverlay } from '../RealSystemOverlay.js';
import { KnownSystems } from '../KnownSystems.js';
import { STELLAR_COMPANIONS } from '../data/stellarCompanions.js';
import { REAL_PROPER_NAME_SET } from '../data/realProperNames.js';
import { realStarSeed } from '../realStarSeed.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = (name) => join(HERE, '../../../public/assets/data', name);
const HYG = JSON.parse(readFileSync(DATA('hyg-stars.json'), 'utf8'));
const SUPPLEMENT = JSON.parse(readFileSync(DATA('real-star-supplement.json'), 'utf8'));
const CONTENTS = JSON.parse(readFileSync(DATA('real-system-contents.json'), 'utf8'));

const SOL = { x: 8.0, y: 0.025, z: 0.0 };

// The full FIX-4 dedup map, mirrored here as the assertion oracle.
const DEDUP = [
  { drop: 'Xi UMa',    into: 'Alula Australis' },
  { drop: 'Xi Sco',    into: 'Graffias' },
  { drop: 'Toliman',   into: 'Rigil Kentaurus' },
  { drop: 'HD 155886', into: 'Guniibuu' },
  { drop: 'HD 156026', into: 'Guniibuu' },
  { drop: 'HD 201092', into: 'HD 201091' },
  { drop: 'Zet-2 Ret', into: 'Zet-1 Ret' },
];

let catalog;
beforeAll(() => {
  catalog = new RealStarCatalog();
  catalog.ingestCatalogData(HYG, SUPPLEMENT, CONTENTS); // builds ._stars + overlay
  KnownSystems.associate(catalog); // folds Rigil's 'Toliman' alias into Alpha Centauri
});

function byName(name) { return HYG.filter((s) => s.name === name); }

// ── the deduped catalog shape ───────────────────────────────────────────────
describe('FIX-4 catalog dedup — one destination per real system', () => {
  it('collapses the census multiples to 15,592 rows (15,599 − 7 secondary rows)', () => {
    expect(HYG.length).toBe(15592);
  });

  it('each dropped row is gone and lives as an alias on exactly its primary row', () => {
    for (const { drop, into } of DEDUP) {
      expect(byName(drop), `${drop} still a top-level row`).toHaveLength(0);
      const primary = byName(into);
      expect(primary, `${into} primary row`).toHaveLength(1);
      expect(primary[0].aliases, `${into} alias set`).toContain(drop);
    }
  });

  it('Guniibuu (36 Oph) carries BOTH secondary designations as aliases', () => {
    const g = byName('Guniibuu')[0];
    expect(g.aliases).toEqual(['HD 155886', 'HD 156026']);
  });

  it('no two surviving rows share an exact rounded position (one marker per spot)', () => {
    const seen = new Set();
    const collisions = [];
    for (const s of HYG) {
      const key = `${s.x},${s.y},${s.z}`;
      if (seen.has(key)) collisions.push(`${s.name} @ ${key}`);
      seen.add(key);
    }
    expect(collisions).toEqual([]);
  });
});

// ── companion-table entries for the census multiples ────────────────────────
describe('FIX-4 companion table — 36 Oph / 61 Cyg / ζ Ret', () => {
  const entry = (name) => STELLAR_COMPANIONS.find((e) => e.name === name);

  it('36 Ophiuchi (Guniibuu): A+B close pair + K5 far companion (C), honest triple', () => {
    const e = entry('Guniibuu');
    expect(e).toBeDefined();
    expect(e.kind).toBe('multiple');
    expect(e.components.map((c) => c.name)).toEqual(['Guniibuu', 'HD 155886']);
    expect(e.components[1].separationAU).toBeGreaterThan(0);
    expect(e.farCompanions.map((f) => f.name)).toEqual(['HD 156026']);
  });

  it('61 Cygni (HD 201091): K5V+K7V close binary', () => {
    const e = entry('HD 201091');
    expect(e).toBeDefined();
    expect(e.components.map((c) => c.name)).toEqual(['HD 201091', 'HD 201092']);
    expect(e.components[1].separationAU).toBeGreaterThan(0);
    expect('farCompanions' in e).toBe(false);
  });

  it('ζ Reticuli (Zet-1 Ret): single primary + wide far companion (no close binary)', () => {
    const e = entry('Zet-1 Ret');
    expect(e).toBeDefined();
    expect(e.components).toHaveLength(1); // wide pair → primary renders single
    expect(e.farCompanions.map((f) => f.name)).toEqual(['Zet-2 Ret']);
  });

  it('arriving at each primary resolves the honest structure through the overlay', () => {
    const overlay = catalog.overlay;
    // 36 Oph: forced close binary (components[1] present) + one far companion.
    const oph = overlay.resolve('Guniibuu');
    expect(oph.companionSpec.components[1].name).toBe('HD 155886');
    expect(oph.farCompanions.map((f) => f.name)).toEqual(['HD 156026']);
    // ζ Ret: companionSpec has no close companion (single primary) + far companion.
    const zet = overlay.resolve('Zet-1 Ret');
    expect(zet.companionSpec.components[1]).toBeUndefined();
    expect(zet.farCompanions.map((f) => f.name)).toEqual(['Zet-2 Ret']);
  });
});

// ── INVARIANT 1: every dropped name stays on the real-proper-name blocklist ──
describe('FIX-4 invariant — dropped names stay blocklisted (procgen never mints them)', () => {
  it("procgen can never mint 'Toliman' (single-token dropped name stays blocklisted)", () => {
    expect(REAL_PROPER_NAME_SET.has('toliman')).toBe(true);
  });

  it('the surviving single-token primaries stay blocklisted too', () => {
    for (const n of ['guniibuu', 'graffias']) {
      expect(REAL_PROPER_NAME_SET.has(n)).toBe(true);
    }
  });
});

// ── INVARIANT 2: every dropped name stays searchable → same/correct destination ──
describe('FIX-4 invariant — dropped names stay searchable to the right destination', () => {
  function search(q) {
    return resolveKnownObjects(q, {
      realStarCatalog: catalog, knownSystems: KnownSystems, playerPos: SOL,
    });
  }
  const starHit = (results) => results.find((r) => r.kind === 'star');

  it('all three 36 Ophiuchi names resolve to the SAME destination (Guniibuu)', () => {
    const g = byName('Guniibuu')[0];
    const expectedSeed = realStarSeed(g.x, g.y, g.z);
    for (const name of ['Guniibuu', 'HD 155886', 'HD 156026']) {
      const hit = starHit(search(name));
      expect(hit, `${name} star hit`).toBeDefined();
      expect(hit.name, `${name} → canonical name`).toBe('Guniibuu');
      expect(hit.seed, `${name} → canonical F1 seed`).toBe(expectedSeed);
      expect(hit.worldPos.x).toBeCloseTo(g.x, 6);
    }
  });

  it('61 Cyg B (HD 201092) and ζ² Ret (Zet-2 Ret) resolve to their primaries', () => {
    expect(starHit(search('HD 201092')).name).toBe('HD 201091');
    expect(starHit(search('Zet-2 Ret')).name).toBe('Zet-1 Ret');
  });

  it('the same-position duplicate names resolve to their proper-named primaries', () => {
    expect(starHit(search('Xi UMa')).name).toBe('Alula Australis');
    expect(starHit(search('Xi Sco')).name).toBe('Graffias');
  });

  it("searching 'Toliman' resolves to Alpha Centauri (registry alias) — one system", () => {
    const results = search('Toliman');
    // Registry hit points at the authored Alpha Centauri system...
    const reg = results.find((r) => r.kind === 'registry');
    expect(reg?.name).toBe('Alpha Centauri');
    // ...and the star-source hit lands on Rigil Kentaurus (α Cen's primary row,
    // which is Alpha Centauri's registered position), never a separate Toliman.
    const star = starHit(results);
    expect(star.name).toBe('Rigil Kentaurus');
  });
});
