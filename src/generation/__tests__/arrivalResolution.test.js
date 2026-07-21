import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  resolveArrivalSystem,
  resolveArrivalSystemAsync,
  findComponentIndexByName,
  componentEntryNameForMember,
} from '../arrivalResolution.js';
import { RealSystemOverlay } from '../RealSystemOverlay.js';
import { GalacticMap } from '../GalacticMap.js';
import { KnownSystems, MATCH_RADIUS } from '../KnownSystems.js';
import { realStarSeed } from '../realStarSeed.js';

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
    //
    // AMENDED (multistar-component-travel-2026-07-21, AC1 ruling): this pin
    // originally asserted the D2 primary-only arrival — a member name always
    // delivers the PARENT payload on BOTH wrappers. Component-addressable
    // arrival supersedes that: the ASYNC (arrival) wrapper now component-
    // resolves member names by default, so this test pins the UNFLAGGED
    // routing only — findByAlias identity and the parent payload with
    // component resolution explicitly opted out on both wrappers (the
    // NavComputer parent-preview semantics). The arrival-path behavior for
    // this same name is pinned in the AC1 section below.
    const fx = fixture({ name: 'Proxima Centauri', pos: AC_POS, type: 'M', seed: 'irrelevant' });
    const previewRes = previewPath(fx.nav);
    const arrivalRes = await resolveArrivalSystemAsync({
      galacticMap: gm,
      overlay,
      pos: { x: fx.resolved.worldX, y: fx.resolved.worldY, z: fx.resolved.worldZ },
      starType: fx.resolved.type,
      seed: String(fx.resolved.seed),
      displayName: fx.name,
      hasNavStar: true,
      resolveComponents: false, // explicit opt-out — parent semantics
    });
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

// ═══════════════════════════════════════════════════════════════════════════
// AC1 — component-addressable arrival (multistar-component-travel-2026-07-21,
// unit BN1). Max's ruling supersedes the D2 primary-only clause: committing
// WARP from a component's own view lands at THAT component's neighborhood,
// while system identity (title, canonical seed family, registry entry) stays
// ONE system. Transport is the NAME channel (action.star.name → warpTarget
// .name → displayName) — the only nav→arrival channel surviving main.js's
// 6-field whitelist copy — so the resolver, not main.js, interprets it:
//   • resolveArrivalSystemAsync (the arrival entry point main.js consumes
//     verbatim) component-resolves member names BY DEFAULT (zero main.js
//     edits — and lane B's ORRERY instant-cut inherits it post-merge);
//   • resolveArrivalSystem (the NavComputer parent-preview entry point)
//     defaults component resolution OFF, so the drill-in flow's _systemData
//     stays the parent (trace-1 risk); the flag is explicit on both.
// ═══════════════════════════════════════════════════════════════════════════

// Catalog positions (kpc). Proxima: real-star-supplement.json row; Rigil: the
// HYG record === the Alpha Centauri registry position (KnownSystems.js).
const PROXIMA_POS = { x: 8.000902, y: 0.024956, z: -0.000937 };
const RIGIL_POS = { x: 8.000948, y: 0.024984, z: -0.000924 };

// Deep-compare helper: the arrival component payload deep-equals the drill-in
// preview payload MODULO the _knownSystemNames decoration arrival adds.
const stripNames = (sys) => {
  const c = rt(sys);
  delete c._knownSystemNames;
  return c;
};

// The arrival-path adapter for a COMPONENT commit: main.js onPrepareSystem's
// exact field mapping (no resolveComponents field — main.js cannot pass one;
// the async default IS the arrival semantics).
async function componentArrivalPath(pos, starType, seed, warpName) {
  return resolveArrivalSystemAsync({
    galacticMap: gm, overlay, pos, starType,
    seed: String(seed), displayName: warpName, hasNavStar: true,
  });
}

describe('AC1(a) — component-flagged resolve delivers the component payload (preview ≡ arrival)', () => {
  it('async arrival for "Proxima Centauri" returns the drill-in preview payload + component names', async () => {
    // The drill-in preview payload: NavComputer._renderComponentDetail renders
    // deriveComponentView(parent, 0).systemData === parent.componentSystems[0]
    // .systemData — generated here through the same parent-preview entry point.
    const parent = previewPath({
      wx: PROXIMA_POS.x, wy: PROXIMA_POS.y, wz: PROXIMA_POS.z,
      seed: 1816942132, spectral: 'M', name: 'Proxima Centauri',
    }).systemData;
    const drill = parent.componentSystems[0].systemData;

    const arrival = await componentArrivalPath(PROXIMA_POS, 'M', 1816942132, 'Proxima Centauri');
    // Preview == arrival by construction, modulo the names decoration.
    expect(stripNames(arrival.systemData)).toEqual(rt(drill));
    // One-system identity: titled by the SYSTEM, arrived via the component.
    expect(arrival.systemData._knownSystemNames.system).toBe('Alpha Centauri');
    expect(arrival.systemData._knownSystemNames.star).toBe('Proxima Centauri');
    // The component scene is Proxima's: single M5.5Ve with b and d as REAL bodies.
    expect(arrival.systemData.isBinary).toBe(false);
    expect(arrival.systemData.star.spectFull).toBe('M5.5Ve');
    const knowns = arrival.systemData.planets.filter((p) => p.known === true);
    expect(knowns.map((p) => p.letter).sort()).toEqual(['b', 'd']);
  });

  it('sync wrapper with the explicit flag produces the identical component payload (sync ≡ async)', async () => {
    const sync = resolveArrivalSystem({
      galacticMap: gm, overlay, pos: PROXIMA_POS, starType: 'M',
      seed: '1816942132', displayName: 'Proxima Centauri', hasNavStar: true,
      resolveComponents: true,
    });
    const asyn = await componentArrivalPath(PROXIMA_POS, 'M', 1816942132, 'Proxima Centauri');
    expect(rt(sync.systemData)).toEqual(rt(asyn.systemData));
  });

  it('component names cover every planet (spawnSystem naming shape) — knowns real, fills lettered', async () => {
    const arrival = await componentArrivalPath(PROXIMA_POS, 'M', 1816942132, 'Proxima Centauri');
    const names = arrival.systemData._knownSystemNames;
    const planets = arrival.systemData.planets;
    expect(names.planets).toHaveLength(planets.length);
    // Injected knowns keep their REAL archive designations…
    const byLetter = Object.fromEntries(planets.map((p, i) => [p.letter, names.planets[i]]));
    expect(byLetter.b.name).toBe('Proxima Cen b');
    expect(byLetter.d.name).toBe('Proxima Cen d');
    // …and procgen fill is lettered off the COMPONENT name (the component is
    // the host of its own scene), never the parent system's.
    for (let i = 0; i < planets.length; i++) {
      if (planets[i].known !== true) {
        expect(names.planets[i].name).toMatch(/^Proxima Centauri [a-z]$/);
      }
    }
    expect(names.star2).toBeNull();
  });
});

describe('AC1(b) — knownWarp wrapper steers the main.js realignment to the component', () => {
  it('wrapper carries the component catalog position with seed/name preserved', async () => {
    const arrival = await componentArrivalPath(PROXIMA_POS, 'M', 1816942132, 'Proxima Centauri');
    const kw = arrival.knownWarp;
    expect(kw).toBeTruthy();
    // position → the component's supplement-catalog coords: playerGalacticPos
    // and skyRenderer.prepareForPositionAsync land at Proxima (AC8's in-scene
    // sky half rides this wrapper).
    expect(kw.position).toEqual(PROXIMA_POS);
    // seed/name → unchanged: currentGalaxyStar keeps the ONE system identity.
    expect(kw.seed).toBe('alpha-centauri');
    expect(kw.name).toBe('Alpha Centauri');
    expect(kw.names.system).toBe('Alpha Centauri');
  });

  it('wrapper position stays inside every recognition radius (revisit / _isCurrentSystem)', async () => {
    const arrival = await componentArrivalPath(PROXIMA_POS, 'M', 1816942132, 'Proxima Centauri');
    const p = arrival.knownWarp.position;
    const dist = Math.hypot(p.x - RIGIL_POS.x, p.y - RIGIL_POS.y, p.z - RIGIL_POS.z);
    // 0.0554 pc actual — inside RealStarCatalog.POSITION_MATCH_TOL (0.0001 kpc
    // = 0.1 pc, hard-coded here so this file never imports lane-B/BN5 surface)
    // and inside KnownSystems.MATCH_RADIUS, so a revisit findAt() from the
    // component's coords still resolves Alpha Centauri.
    expect(dist).toBeLessThan(0.0001);
    expect(dist).toBeLessThan(MATCH_RADIUS);
    expect(KnownSystems.findAt(p)?.name).toBe('Alpha Centauri');
  });

  it('wrapper is a COPY — the registry entry itself is never mutated', async () => {
    await componentArrivalPath(PROXIMA_POS, 'M', 1816942132, 'Proxima Centauri');
    const entry = KnownSystems.getAll().find((k) => k.name === 'Alpha Centauri');
    expect(entry.position).toEqual(RIGIL_POS);
  });
});

describe('AC1(c) — no component selection → primary payload, byte-identical (A+B still lands at A+B)', () => {
  it('system-name arrival (default flag) ≡ opted-out resolve: the parent pair, registry position', async () => {
    const flagged = await componentArrivalPath(RIGIL_POS, 'G', 'irrelevant', 'Alpha Centauri');
    const unflagged = resolveArrivalSystem({
      galacticMap: gm, overlay, pos: RIGIL_POS, starType: 'G',
      seed: 'irrelevant', displayName: 'Alpha Centauri', hasNavStar: true,
    });
    expect(rt(flagged.systemData)).toEqual(rt(unflagged.systemData));
    expect(flagged.systemData.isBinary).toBe(true);
    expect(flagged.systemData._knownSystemNames.star).toBe('Rigil Kentaurus');
    // No wrapper: realignment stays at the registered (Rigil) position.
    expect(flagged.knownWarp.position).toEqual(RIGIL_POS);
  });

  it('close members (Rigil Kentaurus / Toliman) can never component-resolve — not componentSystems entries', () => {
    const parent = previewPath({
      wx: RIGIL_POS.x, wy: RIGIL_POS.y, wz: RIGIL_POS.z,
      seed: 'irrelevant', spectral: 'G', name: 'Alpha Centauri',
    }).systemData;
    expect(findComponentIndexByName(parent, 'Rigil Kentaurus')).toBe(-1);
    expect(findComponentIndexByName(parent, 'Toliman')).toBe(-1);
    expect(findComponentIndexByName(parent, 'Proxima Centauri')).toBe(0);
  });
});

describe('AC1(d) — non-component systems: byte-identical passthrough (AC9 guardrail)', () => {
  it('Sirius (companion-table binary, no far components) — flag default changes nothing', async () => {
    const flagged = await componentArrivalPath(REAL_POS, 'A', 'sirius-ac1', 'Sirius');
    const unflagged = resolveArrivalSystem({
      galacticMap: gm, overlay, pos: REAL_POS, starType: 'A',
      seed: 'sirius-ac1', displayName: 'Sirius', hasNavStar: true,
    });
    expect(rt(flagged.systemData)).toEqual(rt(unflagged.systemData));
    expect(flagged.knownWarp).toBeFalsy();
  });

  it('pure procgen star — flag default changes nothing', async () => {
    const flagged = await componentArrivalPath(REAL_POS, 'G', 'b-5', 'ZZZ Procgen Fixture 90210');
    const unflagged = resolveArrivalSystem({
      galacticMap: gm, overlay, pos: REAL_POS, starType: 'G',
      seed: 'b-5', displayName: 'ZZZ Procgen Fixture 90210', hasNavStar: true,
    });
    expect(rt(flagged.systemData)).toEqual(rt(unflagged.systemData));
    expect('_knownSystemNames' in flagged.systemData).toBe(false);
  });
});

describe('AC1(e) — member-name → entry bridge (overlay systems: dedup-absorbed siblings)', () => {
  it('componentEntryNameForMember maps far members to their owning table entry', () => {
    expect(componentEntryNameForMember('HD 156026')).toBe('Guniibuu');
    expect(componentEntryNameForMember('Zet-2 Ret')).toBe('Zet-1 Ret');
    expect(componentEntryNameForMember('Proxima Centauri')).toBe('Alpha Centauri');
    // Close members and entry names are NOT far members.
    expect(componentEntryNameForMember('HD 155886')).toBeNull();
    expect(componentEntryNameForMember('Guniibuu')).toBeNull();
    expect(componentEntryNameForMember('Sirius')).toBeNull();
    expect(componentEntryNameForMember(null)).toBeNull();
  });

  it('"HD 156026" arrival bridges to Guniibuu and delivers ITS component payload (preview ≡ arrival)', async () => {
    // The far chip is this component's ONLY entry point (no PRISM marker —
    // dedup-absorbed at catalog regen), and BN2's chip commit keeps the parent
    // marker's seed/spectral, swapping only the NAME — mirrored here.
    const parent = previewPath({
      wx: REAL_POS.x, wy: REAL_POS.y, wz: REAL_POS.z,
      seed: 'gun-bridge', spectral: 'K', name: 'Guniibuu',
    }).systemData;
    expect(parent.componentSystems[0].name).toBe('HD 156026');
    const drill = parent.componentSystems[0].systemData;

    const arrival = await componentArrivalPath(REAL_POS, 'K', 'gun-bridge', 'HD 156026');
    expect(stripNames(arrival.systemData)).toEqual(rt(drill));
    expect(arrival.systemData._knownSystemNames.system).toBe('Guniibuu');
    expect(arrival.systemData._knownSystemNames.star).toBe('HD 156026');
    // Overlay branch: no KnownSystems entry, so no wrapper — nothing realigns.
    expect(arrival.knownWarp).toBeFalsy();
  });

  it('"Zet-2 Ret" arrival bridges to Zet-1 Ret identically', async () => {
    const parent = previewPath({
      wx: REAL_POS.x, wy: REAL_POS.y, wz: REAL_POS.z,
      seed: 'zet-bridge', spectral: 'G', name: 'Zet-1 Ret',
    }).systemData;
    const drill = parent.componentSystems[0].systemData;
    const arrival = await componentArrivalPath(REAL_POS, 'G', 'zet-bridge', 'Zet-2 Ret');
    expect(stripNames(arrival.systemData)).toEqual(rt(drill));
    expect(arrival.systemData._knownSystemNames.system).toBe('Zet-1 Ret');
    expect(arrival.systemData._knownSystemNames.star).toBe('Zet-2 Ret');
  });
});

describe('AC1(f) — preview regression guard: unflagged member name = PARENT payload', () => {
  it('sync resolveArrivalSystem without the flag previews the parent for "Proxima Centauri"', () => {
    // NavComputer._renderSystem browses the PRISM member marker through this
    // exact entry point: _systemData MUST stay the parent or the drill-in flow
    // breaks (trace-1 risk — never keyed on displayName alone).
    const res = resolveArrivalSystem({
      galacticMap: gm, overlay, pos: PROXIMA_POS, starType: 'M',
      seed: '1816942132', displayName: 'Proxima Centauri', hasNavStar: true,
    });
    expect(res.systemData.isBinary).toBe(true);
    expect(res.systemData._knownSystemNames.star).toBe('Rigil Kentaurus');
    expect(Array.isArray(res.systemData.componentSystems)).toBe(true);
    expect(res.knownWarp.position).toEqual(RIGIL_POS);
  });
});

describe('AC1(g) — [WARP] log seed invariant: both marker paths hash to the ONE canonical family', () => {
  it('realStarSeed(Rigil) === realStarSeed(Proxima) === 1816942132 (same 0.1 pc F1 bin)', () => {
    expect(realStarSeed(RIGIL_POS.x, RIGIL_POS.y, RIGIL_POS.z)).toBe(1816942132);
    expect(realStarSeed(PROXIMA_POS.x, PROXIMA_POS.y, PROXIMA_POS.z)).toBe(1816942132);
  });
});

describe('PINNED implicit main.js contract — knownWarp consumers read ONLY position/seed/name', () => {
  const SRC = (rel) => readFileSync(join(HERE, '..', rel), 'utf8');

  it('every knownWarp property access in main.js is position, seed, or name', () => {
    // The component knownWarp WRAPPER ({...entry, position: componentPos})
    // steers the arrival realignment lane-C-only BECAUSE main.js reads only
    // these three fields off knownWarp. A future main.js change reading any
    // other field would break component arrival SILENTLY — this pin makes it
    // loud. (Module-comment twin: arrivalResolution.js "implicit contract".)
    const main = SRC('../main.js');
    const props = new Set();
    for (const m of main.matchAll(/\bknownWarp\??\.([A-Za-z_$][\w$]*)/g)) props.add(m[1]);
    expect([...props].sort()).toEqual(['name', 'position', 'seed']);
  });
});

describe('AC1(h) — supersession is amended in place, cited, never silently deleted', () => {
  const READ = (rel) => readFileSync(join(HERE, rel), 'utf8');

  it('NAMING_AND_REAL_OBJECTS.md §6 carries the component-addressable amendment with citation', () => {
    const doc = READ('../../../docs/NAMING_AND_REAL_OBJECTS.md');
    expect(doc).toContain('component-addressable');
    expect(doc).toContain('multistar-component-travel-2026-07-21');
    // The one-identity law itself STANDS — amended, not deleted.
    expect(doc).toContain('one star system = one identity everywhere');
  });

  it('the shipped view-only/primary-arrival pins carry the workstream citation', () => {
    const drill = READ('../../ui/__tests__/NavComputer.componentDrill.test.js');
    expect(drill).toContain('multistar-component-travel-2026-07-21');
    const self = READ('./arrivalResolution.test.js');
    expect(self).toContain('AMENDED (multistar-component-travel-2026-07-21');
  });
});
