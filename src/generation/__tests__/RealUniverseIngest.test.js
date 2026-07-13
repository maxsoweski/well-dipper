import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { KnownSystems, MATCH_RADIUS } from '../KnownSystems.js';
import { POSITION_MATCH_TOL } from '../RealStarCatalog.js';
import { STELLAR_COMPANIONS, validateStellarCompanions } from '../data/stellarCompanions.js';

// AC7 (real-universe-overlay-2026-07-12) — build-time ingest guardrail.
// Unit layer, NO network: reads the committed AC7 outputs and asserts exactly
// the fields the downstream ACs consume (increment-1-design.md §5). Tolerances
// come from the real engine modules (MATCH_RADIUS from KnownSystems.js,
// POSITION_MATCH_TOL from RealStarCatalog.js) — never re-hardcoded — so if the
// engine retunes them these invariants move with it.
//
// TWO checks below are reconciled against reality (the ingest build surfaced
// them and left the design's blanket wording to the coordinator): real distinct
// stars exist closer than these coarse "same star" tolerances — binary planet
// hosts (HD 20781/20782, TOI-2267 A/B) and Proxima Centauri 0.055 pc from
// Alpha Cen A/B. The contract's own Alpha-Cen architecture requires Proxima to
// sit inside MATCH_RADIUS of the A/B pair and resolve via ALIAS MEMBERSHIP
// (identity-agreement exemption, d8d6b63), "never via radius shrinking". So the
// naive design assertions ("no two hosts within POSITION_MATCH_TOL", "no
// supplement star within a hyg star's tolerance") are encoded here as
// clearance-UNLESS-a-documented-identity-exemption — the same idiom the shipped
// KnownSystems.match-radius test already uses. These guard against a NEW
// accidental duplicate while passing on the documented real neighbours.

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = (name) => join(HERE, '../../../public/assets/data', name);

const contents = JSON.parse(readFileSync(DATA('real-system-contents.json'), 'utf8'));
const supplement = JSON.parse(readFileSync(DATA('real-star-supplement.json'), 'utf8'));
const HYG = JSON.parse(readFileSync(DATA('hyg-stars.json'), 'utf8'));

const HOSTS = contents.hosts;
const SUPP = supplement.stars;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// Find every host pair whose galactocentric positions sit within `tol` kpc.
// Sweep in x-sorted order so this stays O(n log n) rather than O(n^2) over the
// ~4,500 hosts.
function hostPairsWithin(hosts, tol) {
  const idx = hosts.map((_, i) => i).sort((a, b) => hosts[a].x - hosts[b].x);
  const pairs = [];
  for (let i = 0; i < idx.length; i++) {
    const a = hosts[idx[i]];
    for (let j = i + 1; j < idx.length; j++) {
      const b = hosts[idx[j]];
      if (b.x - a.x > tol) break; // x-sorted: no further host can be within tol
      if (dist(a, b) < tol) pairs.push([a.name, b.name].sort().join(' ↔ '));
    }
  }
  return pairs;
}

describe('real-system-contents.json — exoplanet-archive ingest invariants', () => {
  it('parses with license + source + hosts and clears the ≥4,000-host sanity floor', () => {
    expect(typeof contents._license).toBe('string');
    expect(contents._license).toMatch(/NASA Exoplanet Archive/);
    expect(typeof contents._source).toBe('string');
    expect(Array.isArray(HOSTS)).toBe(true);
    // Floor, not exact — the live archive grows over time (design §126).
    expect(HOSTS.length).toBeGreaterThanOrEqual(4000);
  });

  it('every host carries a finite galactocentric position, a spectral class, and snum/pnum', () => {
    for (const h of HOSTS) {
      expect(Number.isFinite(h.x) && Number.isFinite(h.y) && Number.isFinite(h.z),
        `host ${h.name} position`).toBe(true);
      expect(typeof h.spect === 'string' && h.spect.length > 0, `host ${h.name} spect`).toBe(true);
      expect(Number.isFinite(h.snum), `host ${h.name} snum`).toBe(true);
      expect(Number.isFinite(h.pnum), `host ${h.name} pnum`).toBe(true);
    }
  });

  it('every planet carries a letter, ≥1 orbital parameter, and ≥1 physical parameter', () => {
    for (const h of HOSTS) {
      for (const p of h.planets) {
        expect(typeof p.letter === 'string' && p.letter.length > 0,
          `${h.name} planet letter`).toBe(true);
        const hasOrbital = Number.isFinite(p.periodDays) || Number.isFinite(p.smaAU);
        const hasPhysical = Number.isFinite(p.massEarth) || Number.isFinite(p.radiusEarth);
        expect(hasOrbital, `${p.name} needs period or sma`).toBe(true);
        expect(hasPhysical, `${p.name} needs mass or radius`).toBe(true);
      }
    }
  });

  it('hosts are sorted by name with no duplicate host names', () => {
    const names = HOSTS.map(h => h.name);
    // Default (UTF-16 code-unit) ordering — matches the ingest's Array.sort().
    expect(names).toEqual([...names].sort());
    expect(new Set(names).size).toBe(names.length);
  });

  it('planets within each host are ordered by designation letter', () => {
    for (const h of HOSTS) {
      const letters = h.planets.map(p => p.letter);
      expect(letters, `${h.name} planet order`).toEqual([...letters].sort());
    }
  });

  it('TRAPPIST-1 carries exactly its seven known planets b–h', () => {
    const t1 = HOSTS.find(h => h.name === 'TRAPPIST-1');
    expect(t1, 'TRAPPIST-1 host present').toBeTruthy();
    expect(t1.planets.map(p => p.letter)).toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('Proxima Cen carries exactly its two known planets b and d', () => {
    const prox = HOSTS.find(h => h.name === 'Proxima Cen');
    expect(prox, 'Proxima Cen host present').toBeTruthy();
    expect(prox.planets.map(p => p.letter)).toEqual(['b', 'd']);
  });

  it('the only host pairs within POSITION_MATCH_TOL are the known real binaries', () => {
    // Design §5 asked for "no two hosts within POSITION_MATCH_TOL", assuming
    // each host has a unique position. Reality: the archive lists the components
    // of real wide binaries as SEPARATE planet-hosting hostnames at (near-)
    // identical coordinates. These are genuinely distinct stars, not duplicate
    // ingests — Increment 3's position join disambiguates them by hostname
    // (AC10 "adjacent real systems"). So we pin the exact known set instead of
    // forbidding proximity: any NEW near-coincident pair (a real duplicate-
    // ingest bug) fails this; a future archive-added real binary would also trip
    // it and warrants a look before being added here.
    const KNOWN_BINARIES = new Set([
      'HD 20781 ↔ HD 20782',      // real wide binary, 0.046 pc apart, both hosts
      'TOI-2267 A ↔ TOI-2267 B',  // real binary; archive gives identical coords
    ]);
    const near = new Set(hostPairsWithin(HOSTS, POSITION_MATCH_TOL));
    expect(near).toEqual(KNOWN_BINARIES);
  });
});

describe('real-star-supplement.json — dim famous hosts as real catalog stars', () => {
  const HYG_SHAPE = ['x', 'y', 'z', 'mag', 'absMag', 'spect', 'ci', 'lum', 'name', 'dist'];

  it('every entry mirrors the hyg-stars.json shape plus an archive hostname', () => {
    expect(Array.isArray(SUPP)).toBe(true);
    expect(SUPP.length).toBeGreaterThan(0);
    for (const s of SUPP) {
      for (const f of HYG_SHAPE) {
        expect(f in s, `${s.name} missing field ${f}`).toBe(true);
      }
      expect(typeof s.hostname === 'string' && s.hostname.length > 0,
        `${s.name} hostname`).toBe(true);
    }
  });

  it('includes Proxima Centauri and TRAPPIST-1', () => {
    const names = new Set(SUPP.map(s => s.name));
    expect(names.has('Proxima Centauri')).toBe(true);
    expect(names.has('TRAPPIST-1')).toBe(true);
  });

  it('every entry clears MATCH_RADIUS from every KnownSystems position', () => {
    const ksPositions = KnownSystems.getAll().map(k => k.position);
    for (const s of SUPP) {
      for (const p of ksPositions) {
        expect(dist(s, p), `${s.name} vs KnownSystems`).toBeGreaterThanOrEqual(MATCH_RADIUS);
      }
    }
  });

  it('no entry shares a name with a hyg-stars.json star', () => {
    const hygNames = new Set(HYG.map(h => h.name));
    const collisions = SUPP.filter(s => hygNames.has(s.name)).map(s => s.name);
    expect(collisions, `supplement names duplicating hyg: ${collisions.join(', ')}`).toHaveLength(0);
  });

  it('the only entry within POSITION_MATCH_TOL of a hyg star is Proxima Centauri', () => {
    // Design §5 asked for "no position duplicate vs hyg-stars.json". A duplicate
    // means the SAME physical star re-added; POSITION_MATCH_TOL (0.1 pc) is
    // RealStarCatalog's own identity-match tolerance. Only Proxima falls inside
    // it here — 0.055 pc from Alpha Cen A/B — and it is a genuinely DISTINCT
    // star, not a duplicate. The contract requires exactly this: Proxima inside
    // MATCH_RADIUS of the A/B pair resolves via alias membership, "never via
    // radius shrinking" (mustStayWorking, d8d6b63). YZ Cet (0.49 pc from Tau
    // Cet) clears POSITION_MATCH_TOL and needs no exemption. A NEW supplement
    // star landing on top of a hyg star (an actual re-add bug) would fail this.
    const collides = SUPP
      .filter(s => HYG.some(h => dist(s, h) < POSITION_MATCH_TOL))
      .map(s => s.name)
      .sort();
    expect(collides).toEqual(['Proxima Centauri']);
  });
});

describe('stellarCompanions.js — curated multiplicity source of truth', () => {
  it('passes its own discriminator/schema validator', () => {
    const { ok, errors } = validateStellarCompanions();
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('enforces the kind discriminator: multiples carry ≤2 classed components + a companion separation; singles carry no companion fields', () => {
    for (const e of STELLAR_COMPANIONS) {
      expect(e.kind === 'multiple' || e.kind === 'single', `${e.name} kind`).toBe(true);
      if (e.kind === 'single') {
        expect('components' in e, `${e.name} single has components`).toBe(false);
        expect('separationAU' in e, `${e.name} single has separationAU`).toBe(false);
        expect('farCompanions' in e, `${e.name} single has farCompanions`).toBe(false);
        continue;
      }
      // multiple
      expect(Array.isArray(e.components)).toBe(true);
      expect(e.components.length).toBeGreaterThanOrEqual(1);
      expect(e.components.length, `${e.name} exceeds the AC10 2-close-star cap`).toBeLessThanOrEqual(2);
      e.components.forEach((c, i) => {
        expect(typeof c.name === 'string' && c.name.length > 0, `${e.name} component name`).toBe(true);
        expect(typeof c.class === 'string' && c.class.length > 0, `${e.name} component class`).toBe(true);
        if (i === 0) {
          expect('separationAU' in c, `${e.name} primary must not carry separationAU`).toBe(false);
        } else {
          expect(c.separationAU > 0, `${e.name} companion separationAU`).toBe(true);
        }
      });
    }
  });

  it('includes Sirius, Procyon, and Alpha Centauri as multiples', () => {
    for (const name of ['Sirius', 'Procyon', 'Alpha Centauri']) {
      const e = STELLAR_COMPANIONS.find(x => x.name === name);
      expect(e, `${name} present`).toBeTruthy();
      expect(e.kind).toBe('multiple');
    }
  });

  it('Alpha Centauri lists Proxima Centauri as a far companion', () => {
    const ac = STELLAR_COMPANIONS.find(x => x.name === 'Alpha Centauri');
    const farNames = (ac.farCompanions ?? []).map(f => f.name);
    expect(farNames).toContain('Proxima Centauri');
  });

  it('every anchor and far companion resolves in hyg-stars.json ∪ supplement; close companions are exempt', () => {
    // Anchor = primary component (multiples) or the star itself (singles).
    // Far companions are real catalog stars too. Close white-dwarf companions
    // (Sirius B, Procyon B) are NEW content the overlay adds — deliberately in
    // no catalog — so they carry no resolvability requirement (design §137-138).
    const catalogNames = new Set([...HYG.map(h => h.name), ...SUPP.map(s => s.name)]);
    for (const e of STELLAR_COMPANIONS) {
      const anchor = e.kind === 'multiple' ? e.components[0].name : e.name;
      expect(catalogNames.has(anchor), `anchor ${anchor} (${e.name}) unresolved`).toBe(true);
      for (const f of e.farCompanions ?? []) {
        expect(catalogNames.has(f.name), `far companion ${f.name} (${e.name}) unresolved`).toBe(true);
      }
    }
  });
});
