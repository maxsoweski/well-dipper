import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  resolveArrivalSystem,
  resolveArrivalSystemAsync,
} from '../arrivalResolution.js';
import { RealSystemOverlay } from '../RealSystemOverlay.js';
import { GalacticMap } from '../GalacticMap.js';

/**
 * AC3 — ONE shared arrival-resolution core (real-star-identity-unification
 * 2026-07-15, FIX-2). The nav SYSTEM preview must generate EXACTLY what arrival
 * delivers. These tests run the PREVIEW-PATH entry point and the ARRIVAL-PATH
 * entry point for a fixture star of each class and deep-compare systemData:
 *
 *   - preview-path : resolveArrivalSystem (SYNC), mapping a nav star record
 *                    {wx,wy,wz,seed,spectral,name} exactly as NavComputer
 *                    ._renderSystem does (browsed star is nav-picked → hasNavStar).
 *   - arrival-path : resolveArrivalSystemAsync (ASYNC), mapping a resolvedStar
 *                    {worldX,worldY,worldZ,type,seed} + warpTarget.name exactly as
 *                    main.js onPrepareSystem does.
 *
 * Both call the SAME core, so the proof is (1) each call site maps its differently
 * named star fields into identical core inputs, and (2) the sync (preview) and
 * async (arrival) wrappers produce byte-identical systemData — generate() and
 * generateAsync() share StarSystemGenerator._generateIterator.
 *
 * Data: the REAL shipped ingest read off disk (same JSON RealStarCatalog.load
 * fetches). Classes: plain un-tabled real star (pin-by-default single), companion-
 * table binary (Sirius), KnownSystems alias (Alpha Centauri), archive host
 * (TRAPPIST-1), pure procgen star. Cited: seed-identity-investigation.md §5 Fix 2.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = (name) => join(HERE, '../../../public/assets/data', name);
const contents = JSON.parse(readFileSync(DATA('real-system-contents.json'), 'utf8'));
const supplement = JSON.parse(readFileSync(DATA('real-star-supplement.json'), 'utf8'));
const HYG = JSON.parse(readFileSync(DATA('hyg-stars.json'), 'utf8'));
const CATALOG_STARS = HYG.concat(supplement.stars);

const MASTER_SEED = 'well-dipper-galaxy-1';
const rt = (o) => JSON.parse(JSON.stringify(o));

let overlay;
let gm;

// One GalacticMap + one ready overlay, shared by both adapters (in production the
// nav's `this._gm` IS main.js's `galacticMap` — same instance, same context).
beforeAll(() => {
  gm = new GalacticMap(MASTER_SEED);
  overlay = new RealSystemOverlay({
    contentsHosts: contents.hosts,
    supplementStars: supplement.stars,
    catalogStars: CATALOG_STARS,
  });
});

// PREVIEW-PATH adapter — NavComputer._renderSystem's field mapping (sync).
function previewPath(navStar) {
  return resolveArrivalSystem({
    galacticMap: gm,
    overlay,
    pos: { x: navStar.wx, y: navStar.wy, z: navStar.wz },
    starType: navStar.spectral,
    seed: navStar.seed,
    displayName: navStar.name,
    hasNavStar: true,
  });
}

// ARRIVAL-PATH adapter — main.js onPrepareSystem's field mapping (async, nav pick).
async function arrivalPath(resolvedStar, warpName) {
  return resolveArrivalSystemAsync({
    galacticMap: gm,
    overlay,
    pos: { x: resolvedStar.worldX, y: resolvedStar.worldY, z: resolvedStar.worldZ },
    starType: resolvedStar.type,
    seed: String(resolvedStar.seed),
    displayName: warpName,
    hasNavStar: true,
  });
}

// Build both call sites' star records from ONE canonical fixture, so the ONLY
// thing under test is that the two field mappings converge on identical output.
function fixture({ name, pos, type, seed }) {
  return {
    nav: { wx: pos.x, wy: pos.y, wz: pos.z, seed, spectral: type, name },
    resolved: { worldX: pos.x, worldY: pos.y, worldZ: pos.z, type, seed },
    name,
  };
}

// A generic real-star position — the overlay join is by NAME (position only
// disambiguates catalog dup-names, an empty set today), so any pos works for the
// non-known real cases as long as BOTH adapters use the same one.
const REAL_POS = { x: 8.0, y: 0.025, z: -0.001 };

async function assertPreviewEqualsArrival(fx) {
  const preview = previewPath(fx.nav).systemData;
  const arrival = (await arrivalPath(fx.resolved, fx.name)).systemData;
  expect(rt(preview)).toEqual(rt(arrival));
  return { preview, arrival };
}

describe('AC3(a) — plain un-tabled real star: preview ≡ arrival, pin honored single', () => {
  // Betelgeuse: real HYG M star, no companion table, no archive host. Seed
  // 'bet-1' WOULD roll a binary absent the FIX-3 pin — the preview must ALSO
  // honor the pin (single), not just arrival.
  const fx = fixture({ name: 'Betelgeuse', pos: REAL_POS, type: 'M', seed: 'bet-1' });

  it('preview systemData deep-equals arrival systemData', async () => {
    await assertPreviewEqualsArrival(fx);
  });

  it('preview honors pin-by-default: single star, no companion', async () => {
    const { preview } = await assertPreviewEqualsArrival(fx);
    expect(preview.isBinary).toBe(false);
    expect(preview.star2).toBeNull();
    expect(preview.star.type).toBe('M');
  });
});

describe('AC3(b) — companion-table binary Sirius: preview ≡ arrival, A+D binary', () => {
  const fx = fixture({ name: 'Sirius', pos: REAL_POS, type: 'A', seed: 'sirius-ac3' });

  it('preview systemData deep-equals arrival systemData', async () => {
    await assertPreviewEqualsArrival(fx);
  });

  it('preview shows the curated white-dwarf companion at 19.8 AU', async () => {
    const { preview } = await assertPreviewEqualsArrival(fx);
    expect(preview.isBinary).toBe(true);
    expect(preview.star2.type).toBe('D');
    expect(preview.star2.spectFull).toBe('DA2');
    expect(preview.star.spectFull).toBe('A1V');
    expect(preview.binarySeparationAU).toBe(19.8);
    expect(preview._knownSystemNames.star).toBe('Sirius');
    expect(preview._knownSystemNames.star2).toBe('Sirius B');
  });
});

describe('AC3(c) — KnownSystems alias Alpha Centauri: routes through findByAlias identically', () => {
  // Registry position (Rigil) — findByAlias applies a 3 pc positional belt.
  const AC_POS = { x: 8.000948, y: 0.024984, z: -0.000924 };

  it('self-name alias: preview ≡ arrival, both route to the authored system', async () => {
    const fx = fixture({ name: 'Alpha Centauri', pos: AC_POS, type: 'G', seed: 'irrelevant' });
    const previewRes = previewPath(fx.nav);
    const arrivalRes = await arrivalPath(fx.resolved, fx.name);
    expect(previewRes.knownWarp).toBeTruthy();
    expect(arrivalRes.knownWarp).toBeTruthy();
    expect(previewRes.knownWarp.name).toBe('Alpha Centauri');
    expect(previewRes.systemData._knownSystemNames.system).toBe('Alpha Centauri');
    expect(rt(previewRes.systemData)).toEqual(rt(arrivalRes.systemData));
  });

  it('derived alias (Proxima Centauri) routes to Alpha Centauri identically on both paths', async () => {
    // Proxima is an EAGER far-companion alias of Alpha Centauri (no associate()
    // needed) — a genuine alias, not the self-name, proving findByAlias routing.
    const fx = fixture({ name: 'Proxima Centauri', pos: AC_POS, type: 'M', seed: 'irrelevant' });
    const previewRes = previewPath(fx.nav);
    const arrivalRes = await arrivalPath(fx.resolved, fx.name);
    expect(previewRes.knownWarp?.name).toBe('Alpha Centauri');
    expect(arrivalRes.knownWarp?.name).toBe('Alpha Centauri');
    expect(rt(previewRes.systemData)).toEqual(rt(arrivalRes.systemData));
  });
});

describe('AC3(d) — archive host TRAPPIST-1: preview ≡ arrival, 7 knowns, snum pin single', () => {
  const fx = fixture({ name: 'TRAPPIST-1', pos: REAL_POS, type: 'M', seed: 't1-b' });

  it('preview systemData deep-equals arrival systemData', async () => {
    await assertPreviewEqualsArrival(fx);
  });

  it('preview shows all 7 archive planets b–h and stays single (snum:1 pin)', async () => {
    const { preview } = await assertPreviewEqualsArrival(fx);
    expect(preview.isBinary).toBe(false);
    expect(preview.star2).toBeNull();
    const known = preview.planets.filter((p) => p.known);
    expect(known.map((p) => p.letter)).toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(preview._knownSystemNames.planets.map((p) => p.name))
      .toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h'].map((l) => `TRAPPIST-1 ${l}`));
  });
});

describe('AC3(e) — pure procgen star: preview ≡ arrival, pin never reaches procgen', () => {
  // A name that is NOT a real catalog star and NOT a KnownSystems alias — the
  // pin-by-default gate (_catalogByName.has) never fires, so the procgen binary
  // roll stays live. Seed 'b-5' + G rolls a binary.
  const fx = fixture({ name: 'ZZZ Procgen Fixture 90210', pos: REAL_POS, type: 'G', seed: 'b-5' });

  it('preview systemData deep-equals arrival systemData', async () => {
    await assertPreviewEqualsArrival(fx);
  });

  it('procgen binary roll survives (pin never reaches procgen) + no merged names', async () => {
    const { preview } = await assertPreviewEqualsArrival(fx);
    expect(preview.isBinary).toBe(true);
    expect(preview.star2).not.toBeNull();
    expect('_knownSystemNames' in preview).toBe(false);
  });
});

describe('AC3 — call-site extraction: exactly one implementation of the resolution stack', () => {
  const SRC = (rel) => readFileSync(join(HERE, '..', rel), 'utf8');

  it('main.js arrival routes through the shared module (thin call site)', () => {
    const main = SRC('../main.js');
    expect(main).toContain('resolveArrivalSystemAsync');
    // The onPrepareSystem arrival stack (context + overlay merge + generate) moved
    // into the module: the inline arrival generate is gone. (The separate debug-
    // teleport call site is out of FIX-2 scope and intentionally untouched.)
    expect(main).not.toContain('generateAsync(seed, galaxyContext)');
  });

  it('NavComputer preview routes through the shared module (no raw overlay-less generate)', () => {
    const nav = SRC('../ui/NavComputer.js');
    expect(nav).toContain('resolveArrivalSystem(');
    // The old raw, overlay-less preview generate is gone.
    expect(nav).not.toContain('StarSystemGenerator.generate(String(star.seed)');
  });
});
