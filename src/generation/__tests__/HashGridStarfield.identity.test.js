// HashGridStarfield star identity (naming-prism-segments AC-1, plan §3.2-§3.3).
//
// Every procedural star record carries `ident` = the (tier, cell) slot that
// generated it — carried from the generating loop, never recomputed from
// position — and `key` = starKey(ident). Consumers compare `key`, never the
// 32-bit seed, which really does collide (the equal-seed test finds pairs).
//
// The REGRESSION block pins that adding identity changed nothing else: for
// fixed queries at Sol, the inner galaxy and the rim, the star lists
// (positions, seeds, types, distances, nav names) and the sky buffers hash
// byte-identically to the baseline recorded from HEAD before the change.

import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import alea from 'alea';
import { GalacticMap } from '../GalacticMap.js';
import { HashGridStarfield, TIER_CELL_KPC } from '../HashGridStarfield.js';
import { generateSystemName } from '../NameGenerator.js';
import { starKey, addressOf, slabRef } from '../GalaxyGrid.js';

const gm = new GalacticMap('well-dipper-galaxy-1');
const SOL = { x: 8, y: 0.025, z: 0 };

// Inner galaxy (R ≈ 1.5 kpc): ~148k stars in one query, dense enough that the
// 32-bit seed collides several times (birthday bound). Shared by several tests.
let inner = null;
const innerStars = () => (inner ??= HashGridStarfield.findStarsInPrism(gm, { x: 1.5, y: 0, z: 0.2 }, 0.02, 0.05, 1e7));

// Coarse tiers only (O, Kg, Gg, Mg): a box wide enough that every finer tier
// exceeds the 200-cells-per-axis cap and is skipped — cheap, and full of giants.
const coarse = (c) => HashGridStarfield.findStarsInPrism(gm, c, 1.2, 0.3, 1e7);

describe('every record carries its generating slot', () => {
  it('all four query paths stamp ident {tier, cx, cy, cz} and key = starKey(ident)', () => {
    const sky = HashGridStarfield.generate(gm, SOL, 500).realStars.map(r => r.starData);
    const lists = [
      HashGridStarfield.findStarsInPrism(gm, SOL, 0.0039, 0.05, 50000),
      HashGridStarfield.findStarsInRadius(gm, SOL, 0.01, 500),
      HashGridStarfield.findStarsInCube(gm, SOL, 0.005, 500),
      sky,
    ];
    for (const list of lists) {
      expect(list.length).toBeGreaterThan(0);
      for (const s of list) {
        expect(s.ident.tier).toBe(s.type);
        expect(Number.isInteger(s.ident.cx) && Number.isInteger(s.ident.cy) && Number.isInteger(s.ident.cz)).toBe(true);
        expect(s.key).toBe(starKey(s.ident));
        // The star lies in its cell's closed extent [c·cell, (c+1)·cell].
        const cell = TIER_CELL_KPC[s.type];
        for (const [v, c] of [[s.worldX, s.ident.cx], [s.worldY, s.ident.cy], [s.worldZ, s.ident.cz]]) {
          expect(v).toBeGreaterThanOrEqual(c * cell - 1e-12);
          expect(v).toBeLessThanOrEqual((c + 1) * cell + 1e-12);
        }
      }
    }
  }, 60000);

  it('ident is CARRIED, not recomputed: a star on its cell\'s upper face keeps its own cell', () => {
    // Offset byte 255 puts a star exactly on the next cell's lower face, where
    // floor(position / cell) names the NEIGHBOUR. The carried ident must not.
    const onFace = innerStars().filter(s => {
      const cell = TIER_CELL_KPC[s.type];
      return Math.floor(s.worldX / cell) !== s.ident.cx || Math.floor(s.worldY / cell) !== s.ident.cy
        || Math.floor(s.worldZ / cell) !== s.ident.cz;
    });
    expect(onFace.length).toBeGreaterThan(100);
    for (const s of onFace.slice(0, 50)) {
      const cell = TIER_CELL_KPC[s.type];
      const recomputed = { tier: s.type, cx: Math.floor(s.worldX / cell), cy: Math.floor(s.worldY / cell), cz: Math.floor(s.worldZ / cell) };
      expect(s.key).not.toBe(starKey(recomputed));
    }
  }, 60000);
});

describe('one star, one key (plan §3.2, §3.4)', () => {
  it('two stars with EQUAL seeds get different keys', () => {
    const bySeed = new Map();
    for (const s of innerStars()) {
      if (!bySeed.has(s.seed)) bySeed.set(s.seed, []);
      bySeed.get(s.seed).push(s);
    }
    const collisions = [...bySeed.values()].filter(g => g.length > 1);
    expect(collisions.length).toBeGreaterThan(0);                 // the seed really is not unique
    for (const g of collisions) {
      expect(new Set(g.map(s => s.key)).size).toBe(g.length);
      expect(new Set(g.map(s => `${s.worldX},${s.worldY},${s.worldZ}`)).size).toBe(g.length);
    }
  }, 60000);

  it('starKey is injective over a sampled volume (~148k stars, every fine tier)', () => {
    const stars = innerStars();
    expect(new Set(stars.map(s => s.key)).size).toBe(stars.length);
  }, 60000);

  it('the same star found by two overlapping queries has one key, one box and one slot — coarse tiers too', () => {
    const pairs = [
      [{ x: 6, y: 0, z: 2 }, { x: 6.9, y: 0.1, z: 2.4 }],         // coarse tiers, outer disk
      [{ x: 0, y: 0, z: 0 }, { x: 0.7, y: -0.2, z: 0.5 }],        // coarse tiers, bulge
    ];
    for (const [a, b] of pairs) {
      const A = new Map(coarse(a).map(s => [s.key, s]));
      let shared = 0;
      for (const s of coarse(b)) {
        const t = A.get(s.key);
        if (!t) continue;
        shared++;
        expect([s.worldX, s.worldY, s.worldZ, s.seed, s.type]).toEqual([t.worldX, t.worldY, t.worldZ, t.seed, t.type]);
        expect(HashGridStarfield.ownerOf(s)).toEqual(HashGridStarfield.ownerOf(t));
      }
      expect(shared).toBeGreaterThan(0);
    }
  }, 60000);

  it('inside one box, no two stars of a tier share a slot (fine and coarse tiers)', () => {
    for (const stars of [innerStars(), coarse({ x: 0, y: 0, z: 0 })]) {
      const owners = new Set();
      const tiers = new Set();
      for (const s of stars) {
        const o = HashGridStarfield.ownerOf(s);
        expect(o.slot).toBeGreaterThanOrEqual(0);
        expect(o.slot).toBeLessThan(o.count);
        const k = `${JSON.stringify(o.address)}|${s.type}|${o.slot}`;
        expect(owners.has(k)).toBe(false);
        owners.add(k);
        tiers.add(s.type);
      }
      expect(tiers.size).toBeGreaterThanOrEqual(4);
    }
  }, 60000);

  it('generated stars at exactly y = 0 belong to slab N1', () => {
    const atZero = innerStars().filter(s => s.worldY === 0);
    expect(atZero.length).toBeGreaterThan(0);
    for (const s of atZero) expect(slabRef(addressOf(s.worldX, s.worldY, s.worldZ))).toBe('N1');
  }, 60000);
});

// ── Regression: identity added nothing else (baseline recorded from HEAD) ──
const BASELINE = JSON.parse(readFileSync(fileURLToPath(new URL('./__fixtures__/hashgrid-identity-baseline.json', import.meta.url)), 'utf8')).cases;

// NavComputer._makeRng, verbatim in behaviour: the nav names rows with it.
const makeRng = (seed) => {
  const fn = alea(seed);
  return {
    float: () => fn(),
    int: (a, b) => (b === undefined ? Math.floor(fn() * a) : a + Math.floor(fn() * (b - a + 1))),
    pick: (arr) => arr[Math.floor(fn() * arr.length)],
    bool: (p) => fn() < (p || 0.5), chance: (p) => fn() < p,
    child: (label) => makeRng(seed + ':' + label),
  };
};
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
// Pre-identity fields ONLY — the new ident/key fields are deliberately left out.
const rows = (stars, named) => stars.map(s => [s.worldX, s.worldY, s.worldZ, s.seed, s.type, s.dist,
  named ? generateSystemName(makeRng(s.seed), { x: s.worldX, y: s.worldY, z: s.worldZ }) : null]);

const CASES = {
  'prism-sol': () => rows(HashGridStarfield.findStarsInPrism(gm, { x: 8, y: 0.025, z: 0 }, 0.0039, 0.05, 50000), true),
  'prism-sol-nav': () => rows(HashGridStarfield.findStarsInPrism(gm, { x: 8, y: -0.031, z: 0 }, 0.010336, 0.05, 50000), true),
  'prism-inner': () => rows(HashGridStarfield.findStarsInPrism(gm, { x: 1.5, y: 0, z: 0.2 }, 0.0039, 0.05, 50000), true),
  'prism-rim': () => rows(HashGridStarfield.findStarsInPrism(gm, { x: 0, y: 0.01, z: 16 }, 0.02, 0.1, 50000), true),
  'radius-sol': () => rows(HashGridStarfield.findStarsInRadius(gm, { x: 8, y: 0.025, z: 0 }, 0.01, 500), false),
  'cube-sol': () => rows(HashGridStarfield.findStarsInCube(gm, { x: 8, y: 0.025, z: 0 }, 0.005, 500), false),
  'sky-sol': () => {
    const g = HashGridStarfield.generate(gm, { x: 8, y: 0.025, z: 0 }, 500);
    return {
      count: g.count, pos: Array.from(g.positions), col: Array.from(g.colors), siz: Array.from(g.sizes),
      real: g.realStars.map(r => [r.index, r.starData.worldX, r.starData.worldY, r.starData.worldZ, r.starData.seed,
        r.starData.type, r.starData.featureContext, r.estimatedType, r.apparentMagnitude]),
    };
  },
};

describe('regression: generation is byte-identical to HEAD before identity', () => {
  for (const [name, run] of Object.entries(CASES)) {
    it(`${name}: same stars, positions, seeds, names and count`, () => {
      const v = run();
      expect({ count: Array.isArray(v) ? v.length : v.count, sha256: sha(v) }).toEqual(BASELINE[name]);
    }, 60000);
  }
});
