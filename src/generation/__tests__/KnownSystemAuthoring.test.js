import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { KnownSystems, MATCH_RADIUS } from '../KnownSystems.js';
import { RealStarCatalog } from '../RealStarCatalog.js';
import { STELLAR_COMPANIONS } from '../data/stellarCompanions.js';
import { KNOWN_SYSTEM_CONTENTS } from '../data/knownSystemContents.generated.js';
import {
  deriveAuthoredNames, generateAuthoredSystem, buildAuthoredContext,
  AUTHORING_MASTER_SEED,
} from '../KnownSystemAuthoring.js';

/**
 * AC5 — data-driven KnownSystems authoring (real-universe-overlay-2026-07-12,
 * Increment 2). Proves the declarative Alpha Centauri registry entry produces
 * full contents by routing through StarSystemGenerator's overlay ctx (AC10):
 * A+B close binary from the curated companion table, Proxima as a far companion
 * carrying its archive planets, alias derivation over all three catalog names.
 * Design + decisions D1–D8:
 *   docs/WORKSTREAMS/real-universe-overlay-2026-07-12/increment-2-design.md
 *
 * The AC10 representation cap this path honors (≤2 close stars; wider members are
 * far-companion DATA, not scene bodies) is written down and cited here:
 *   docs/WORKSTREAMS/real-universe-overlay-2026-07-12/representation-cap.md
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = (name) => join(HERE, '../../../public/assets/data', name);
const HYG = JSON.parse(readFileSync(DATA('hyg-stars.json'), 'utf8'));
const CONTENTS = JSON.parse(readFileSync(DATA('real-system-contents.json'), 'utf8'));
const SUPPLEMENT = JSON.parse(readFileSync(DATA('real-star-supplement.json'), 'utf8'));

const CAP_DOC = join(
  HERE, '../../../docs/WORKSTREAMS/real-universe-overlay-2026-07-12/representation-cap.md',
);

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function alphaCenEntry() {
  return KnownSystems.getAll().find((k) => k.name === 'Alpha Centauri');
}

describe('AC5 — the representation-cap doc the tests cite exists (design D8)', () => {
  it('representation-cap.md is present in the workstream dir', () => {
    // The overlay + authoring suites cite this file where the AC10 cap binds
    // (≤2 close stars; far companions are data-level). The citation must resolve.
    expect(existsSync(CAP_DOC)).toBe(true);
  });
});

describe('AC5 — authoring fallback seed matches the game master seed (design D7)', () => {
  it("main.js constructs GalacticMap with AUTHORING_MASTER_SEED's literal", () => {
    // The adapter's no-injection fallback (tests, early callers) must derive the
    // SAME galaxy context main.js's injected map would — a drifted master seed
    // would silently fork authored contents between tests and the running game.
    const mainSrc = readFileSync(join(HERE, '../../main.js'), 'utf8');
    expect(mainSrc).toContain(`new GalacticMap('${AUTHORING_MASTER_SEED}')`);
  });
});

describe('AC5 — Alpha Centauri close binary from the companion table', () => {
  it('star is G (Rigil, G2V) and star2 is K (Toliman, K1V), sourced from the table', () => {
    const sys = alphaCenEntry().generate();
    expect(sys.isBinary).toBe(true);
    expect(sys.star.type).toBe('G');
    expect(sys.star.spectFull).toBe('G2V');
    expect(sys.star2).not.toBeNull();
    expect(sys.star2.type).toBe('K');
    expect(sys.star2.spectFull).toBe('K1V');
    // Separation is verbatim from the table (23.5 AU), not a roll.
    expect(sys.binarySeparationAU).toBe(23.5);
    // Known-system markers match Sol's decorate() so the arrival paths agree.
    expect(sys._isKnownSystem).toBe(true);
    expect(sys._knownSystemName).toBe('Alpha Centauri');
    expect(sys._destType).toBe('star-system');
  });
});

describe('AC5 — Proxima as a far companion with its archive planets (D2/D5)', () => {
  it('farCompanions[0] is Proxima Centauri (type M) with planets b, d', () => {
    // Wide member lives in farCompanions DATA, not a 3rd close-star slot — the
    // AC10 2-close-star cap (representation-cap.md §1–§2).
    const sys = alphaCenEntry().generate();
    expect(Array.isArray(sys.farCompanions)).toBe(true);
    expect(sys.farCompanions).toHaveLength(1);
    const prox = sys.farCompanions[0];
    expect(prox.name).toBe('Proxima Centauri');
    expect(prox.class).toBe('M5.5Ve');
    expect(prox.type).toBe('M'); // normalized single letter
    expect(prox.separationAU).toBe(13000);
    expect(prox.planets.map((p) => p.letter)).toEqual(['b', 'd']);
  });

  it('the far-companion planet params match the real-system-contents.json archive values', () => {
    const sys = alphaCenEntry().generate();
    const emitted = sys.farCompanions[0].planets;
    const archiveHost = CONTENTS.hosts.find((h) => h.name === 'Proxima Cen');
    expect(archiveHost, 'Proxima Cen archive host present').toBeTruthy();
    // Emitted planets are the archive planets, projected verbatim.
    expect(emitted).toHaveLength(archiveHost.planets.length);
    for (const ep of emitted) {
      const ap = archiveHost.planets.find((p) => p.letter === ep.letter);
      expect(ap, `archive planet ${ep.letter}`).toBeTruthy();
      expect(ep.periodDays).toBe(ap.periodDays);
      expect(ep.smaAU).toBe(ap.smaAU);
      expect(ep.massEarth).toBe(ap.massEarth);
      expect(ep.radiusEarth).toBe(ap.radiusEarth);
      expect(ep.eccen).toBe(ap.eccen);
      expect(ep.name).toBe(ap.name);
    }
  });
});

describe('AC5 — index-aligned display names (design D4)', () => {
  it('system/star/star2 come from the table component names', () => {
    const sys = alphaCenEntry().generate();
    const names = sys._knownSystemNames;
    expect(names.system).toBe('Alpha Centauri');
    expect(names.star).toBe('Rigil Kentaurus');
    expect(names.star2).toBe('Toliman');
    // Alpha Cen A+B is a tight binary; its planet field is empty (planets are
    // pushed outside maxOrbit by the binary min-inner-orbit) — names align 1:1.
    expect(names.planets).toEqual([]);
  });

  it('procgen-filled planets use the SAME letter convention procgen uses; moons stay named', () => {
    // Alpha Cen itself is planetless, so exercise the name derivation directly on
    // a synthetic system: procgen planets → "<system> b/c", moons → "<planet> I".
    const fakeSystem = {
      isBinary: true,
      star2: { type: 'K' },
      planets: [
        { moons: [{}, {}] }, // planet 0 → letter 'b', 2 moons
        { moons: [] },       // planet 1 → letter 'c', 0 moons
      ],
    };
    const companion = STELLAR_COMPANIONS.find((e) => e.name === 'Alpha Centauri');
    const names = deriveAuthoredNames({ name: 'Alpha Centauri' }, companion, fakeSystem);
    expect(names.planets[0].name).toBe('Alpha Centauri b');
    expect(names.planets[0].moons).toEqual(['Alpha Centauri b I', 'Alpha Centauri b II']);
    expect(names.planets[1].name).toBe('Alpha Centauri c');
    expect(names.planets[1].moons).toEqual([]);
  });

  it('an injected known planet keeps its real name/letter over the procgen letter', () => {
    const companion = STELLAR_COMPANIONS.find((e) => e.name === 'Alpha Centauri');
    const fakeSystem = {
      isBinary: false, star2: null,
      planets: [{ known: true, letter: 'd', name: 'Some Real Name', moons: [] }],
    };
    const names = deriveAuthoredNames({ name: 'X' }, companion, fakeSystem);
    expect(names.planets[0].name).toBe('Some Real Name');
    expect(names.star2).toBeNull(); // single-star name object has no star2
  });
});

describe('AC5 — the registry entry duplicates NO multiplicity data (D4)', () => {
  it('the declarative entry carries only companionsRef; structure lives in the table', () => {
    const entry = alphaCenEntry();
    // The declarative payload names the table row and nothing else.
    expect(entry.data).toEqual({ companionsRef: 'Alpha Centauri' });
    // No component classes / separations copied onto the entry itself.
    expect('components' in entry).toBe(false);
    expect('separationAU' in entry).toBe(false);
    expect('farCompanions' in entry).toBe(false);
    // The resolved companion is the SAME object as the single source of truth —
    // referenced, never duplicated.
    expect(entry._companion).toBe(STELLAR_COMPANIONS.find((e) => e.name === 'Alpha Centauri'));
  });
});

describe('AC5 — alias derivation over all three catalog names (D6)', () => {
  it('aliases include Rigil Kentaurus + Toliman (via associate) and Proxima Centauri (via the table)', () => {
    // Rigil Kentaurus is the HYG row associate() claims within MATCH_RADIUS.
    // Post-FIX-4 the Toliman row is deduped INTO Rigil's aliases[]; associate()
    // folds a claimed row's aliases into the registry entry, so Toliman is still
    // an Alpha Centauri alias (searchable) though it no longer has its own row.
    // Proxima is below the HYG cut, so it is aliased EAGERLY from the companion
    // table (design D6).
    const cat = new RealStarCatalog();
    cat._stars = HYG;
    cat._loaded = true;
    KnownSystems.associate(cat);

    const entry = alphaCenEntry();
    expect(entry.aliases.has('Alpha Centauri')).toBe(true);
    expect(entry.aliases.has('Rigil Kentaurus')).toBe(true);
    expect(entry.aliases.has('Toliman')).toBe(true);
    expect(entry.aliases.has('Proxima Centauri')).toBe(true);
  });
});

describe('AC5 — findAt resolves the whole family to Alpha Centauri (D6)', () => {
  const RIGIL_POS = { x: 8.000948, y: 0.024984, z: -0.000924 };
  const PROXIMA = SUPPLEMENT.stars.find((s) => s.name === 'Proxima Centauri');

  it('findAt at Rigil resolves to Alpha Centauri', () => {
    expect(KnownSystems.findAt(RIGIL_POS)?.name).toBe('Alpha Centauri');
  });

  it("findAt at Proxima's supplement position resolves to Alpha Centauri (inside MATCH_RADIUS)", () => {
    // Proxima sits 0.055 pc from the A+B pair — inside MATCH_RADIUS — so a
    // teleport onto Proxima's true position lands on the ONE authored system,
    // never a procgen impostor (representation-cap.md §2).
    const proxPos = { x: PROXIMA.x, y: PROXIMA.y, z: PROXIMA.z };
    expect(dist(proxPos, RIGIL_POS)).toBeLessThan(MATCH_RADIUS); // precondition
    expect(KnownSystems.findAt(proxPos)?.name).toBe('Alpha Centauri');
  });
});

describe('AC5 — determinism (design D1/D2)', () => {
  it('generate twice → deep-equal systemData (JSON round-trip)', () => {
    const entry = alphaCenEntry();
    const a = JSON.parse(JSON.stringify(entry.generate()));
    const b = JSON.parse(JSON.stringify(entry.generate()));
    expect(a).toEqual(b);
  });

  it('the adapter fallback map builds the same ctx as a second call (no injected map)', () => {
    const entry = alphaCenEntry();
    const c1 = JSON.parse(JSON.stringify(buildAuthoredContext(entry, null)));
    const c2 = JSON.parse(JSON.stringify(buildAuthoredContext(entry, null)));
    expect(c1).toEqual(c2);
    // And a directly-generated system matches the entry.generate() path.
    const direct = JSON.parse(JSON.stringify(generateAuthoredSystem(entry, null)));
    const viaEntry = JSON.parse(JSON.stringify(entry.generate()));
    expect(direct).toEqual(viaEntry);
  });
});

describe('AC5 — generated far-companion module drift guard (design D5)', () => {
  it('KNOWN_SYSTEM_CONTENTS deep-equals a fresh re-derivation from the JSONs', () => {
    // Re-run the ingest extraction (mirror of scripts/gen-known-system-contents.mjs)
    // against the same committed inputs and deep-equal the shipped module. A drift
    // between the archive/supplement JSONs and the generated module fails here.
    const PLANET_FIELDS = ['letter', 'name', 'periodDays', 'smaAU', 'massEarth', 'radiusEarth', 'eccen'];
    const displayToHost = new Map();
    for (const s of SUPPLEMENT.stars ?? []) {
      if (s.name && s.hostname) displayToHost.set(s.name, s.hostname);
    }
    const hostByName = new Map();
    for (const h of CONTENTS.hosts ?? []) hostByName.set(h.name, h);

    const requested = new Set();
    for (const e of STELLAR_COMPANIONS) {
      for (const f of e.farCompanions ?? []) if (f.name) requested.add(f.name);
    }

    const expected = {};
    for (const displayName of [...requested].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      const hostname = displayToHost.get(displayName);
      if (!hostname) continue;
      const host = hostByName.get(hostname);
      if (!host) continue;
      const planets = (host.planets ?? []).map((p) => {
        const proj = {};
        for (const f of PLANET_FIELDS) proj[f] = p[f] ?? null;
        return proj;
      });
      if (planets.length === 0) continue;
      expected[displayName] = { hostname, planets };
    }

    expect(KNOWN_SYSTEM_CONTENTS).toEqual(expected);
    // Sanity anchor: Proxima Centauri resolves to its two archive planets.
    expect(KNOWN_SYSTEM_CONTENTS['Proxima Centauri']?.hostname).toBe('Proxima Cen');
    expect(KNOWN_SYSTEM_CONTENTS['Proxima Centauri']?.planets.map((p) => p.letter)).toEqual(['b', 'd']);
  });
});
