/**
 * navStarIdentity — the nav finds a star by its IDENTITY, never by its 32-bit seed
 * (naming-prism-segments AC-2, plan §3.4 / §3.5).
 *
 * ── ⛔ THE CASE THIS FILE EXISTS FOR ─────────────────────────────────────────────────────────────
 *
 * Two stars that share a seed. The generator makes them for real — the old loader key
 * `${seed}-${x.toFixed(6)}` hid two such stars in one inner-galaxy column (1.5, 0.3), measured
 * 2026-10-02 — and every lookup that went back to the LIVE row by seed (list click, map click,
 * selection, name / multiplicity memos, the binary stash) handed the pilot the twin. So the fixture
 * is a real loaded PRISM column with two of its own rows given ONE seed: different positions,
 * different keys, both drawn. Every case drives the real NavComputer + view-mode driver headless
 * (`helpers/headlessNav.mjs`) and the real main.js warp transport, extracted and compiled over stubs
 * the way `navUatWalk2026.host.test.js` does.
 *
 * ⭐ EACH CASE RUNS ON BOTH TWINS. A seed lookup returns whichever twin comes FIRST, so it is right
 * for one of them by luck; only the pair can fail it.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { stripCommentsPreservingOffsets } from '../../../tests/helpers/source-scan.mjs';
import { makeHeadlessNav, clickAt } from './helpers/headlessNav.mjs';
import { sameStar, starMemoKey } from '../navViewModes/starIdentity.js';
import { generateSystemName, generateSystemNames } from '../../generation/NameGenerator.js';
import { multiplicityForSeed } from '../../generation/multiplicityOracle.js';
import { StarSystemGenerator } from '../../generation/StarSystemGenerator.js';
import { SeededRandom } from '../../generation/SeededRandom.js';
import { GalacticMap } from '../../generation/GalacticMap.js';
import { burnWorkflowAvailable, navDispatchDuringWarp, systemEntryStyle } from '../../flight/flightModes.js';
import { POSITION_MATCH_TOL } from '../../generation/RealStarCatalog.js';

// ── main.js, extracted (same technique as navUatWalk2026.host.test.js) ─────────────────────────────
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RAW = readFileSync(resolve(REPO, 'src/main.js'), 'utf8');
const MATCH = stripCommentsPreservingOffsets(RAW, { blankLiteralText: true });
const CODE = stripCommentsPreservingOffsets(RAW);

/** The whole top-level `function NAME(...) { ... }` in main.js, comments blanked. */
function fnSource(name) {
  const m = new RegExp(`\\nfunction ${name}\\s*\\(`).exec(MATCH);
  if (!m) throw new Error(`EXTRACTION FAILED: no top-level function ${name} in main.js`);
  let i = m.index + m[0].length, depth = 1;
  while (depth > 0 && i < MATCH.length) { if (MATCH[i] === '(') depth++; else if (MATCH[i] === ')') depth--; i++; }
  i = MATCH.indexOf('{', i);
  for (depth = 0; i < MATCH.length; i++) {
    if (MATCH[i] === '{') depth++;
    else if (MATCH[i] === '}' && --depth === 0) break;
  }
  if (depth !== 0) throw new Error(`EXTRACTION FAILED: unbalanced braces in ${name}`);
  return CODE.slice(m.index + 1, i + 1);
}

const HOST_FNS = ['dispatchNavAction', '_setWarpTargetFromNavStar', '_skyTargetNavStar', '_buildCurrentStarEntry',
  '_seedSystemName'];
const ENV = ['burnWorkflowAvailable', 'navDispatchDuringWarp', 'systemEntryStyle', 'POSITION_MATCH_TOL', 'console',
  'warpTarget', 'warpEffect', 'flythrough', 'autoNav', '_effectiveRegime', '_enterSystemInstantOrrery',
  'beginWarpTurn', 'setTimeout', 'THREE', 'scControls', 'soundEngine', 'generateSystemName', 'SeededRandom',
  'bodyInfo', 'NavComputer', 'system'];

/** The host's warp transport over one stub scope. `warpTarget` is the live object arrival reads. */
function host({ warpInFlight = false, foldSnapshotTaken = false, currentGalaxyStar = null } = {}) {
  const env = {
    burnWorkflowAvailable, navDispatchDuringWarp, systemEntryStyle, POSITION_MATCH_TOL,
    console: { log: () => {}, warn: () => {} },
    warpTarget: { direction: null, destType: null, navStarData: null, name: null, turning: warpInFlight },
    warpEffect: { isActive: warpInFlight },
    flythrough: { active: false, stop: vi.fn() }, autoNav: { isActive: false, stop: vi.fn() },
    _effectiveRegime: () => 'helm', _enterSystemInstantOrrery: vi.fn(), beginWarpTurn: vi.fn(),
    setTimeout: (fn) => fn(),
    THREE: { Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } } },
    scControls: { deselect: vi.fn() }, soundEngine: { play: vi.fn() },
    generateSystemName, SeededRandom, bodyInfo: { showWarpTarget: vi.fn() },
    NavComputer: { _SPECTRAL_COLORS: {} }, system: null,
  };
  // eslint-disable-next-line no-new-func
  const make = new Function('env', 'cgs', 'fst', `'use strict';
    const { ${ENV.join(', ')} } = env;
    let playerGalacticPos = { x: 8, y: 0, z: 0 };
    let _selectedTarget = null, _manualBurnOrbiting = false, _pendingPlayerWarp = null;
    let _foldSnapshotTaken = fst, _skyPickedStarData = null, currentGalaxyStar = cgs, _currentSystemName = 'Here';
    ${HOST_FNS.map(fnSource).join('\n')}
    return { ${HOST_FNS.join(', ')}, get pending() { return _pendingPlayerWarp; } };`);
  const h = make(env, currentGalaxyStar, foldSnapshotTaken);
  h.env = env;
  return h;
}

// ── the fixture: a real loaded PRISM column, two of its rows given ONE seed ─────────────────────────
async function twinNav(mode = 'rail', { list = false } = {}) {
  const h = await makeHeadlessNav({ width: 427, height: 240 });
  const { nav } = h;
  nav._viewModesEnabled = true;
  nav._levelIndex = 3;
  nav.viewMode = mode;
  nav.render();                                  // the real loader fills `_localStars`
  const drv = nav._viewDriverInst;
  const hits = drv.S.prismHits || [];
  // Two marks the map draws apart (no other mark inside either's radius), both procedural rows.
  const iso = hits.filter((a) => a.ref && a.ref.key?.startsWith('p:') && a.ref.dist > 1e-9 &&
    hits.every((b) => b === a || Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r + 1));
  if (iso.length < 2) throw new Error(`fixture: ${mode} drew only ${iso.length} isolated procedural marks`);
  const live = (ref) => nav._localStars.find((s) => s.key === ref.key);
  const A = live(iso[0].ref), B = live(iso[iso.length - 1].ref);
  B.seed = A.seed;                               // ⭐ THE INJECTION: one seed, two stars
  nav._localStars = nav._localStars.slice();     // a new array, so the adapter rebuilds its rows
  if (list) drv.toggleList();                    // design 2's list is its picker at PRISM (it hides the map)
  nav.render();
  return { ...h, drv, A, B };
}

const markOf = (drv, star) => (drv.S.prismHits || []).find((m) => m.ref && m.ref.key === star.key);
const rowIndexOf = (drv, star) => {
  const lg = drv.S.listGeom, off = lg.offset | 0;
  const i = drv.D.starRows.findIndex((r) => r.key === star.key) - off;
  return i >= 0 && i < lg.rows ? i : -1;
};
/** Page the drawn list until `star` is on it, then hand back its drawn row index. */
function showRow(nav, drv, star) {
  const full = drv.D.starRows.findIndex((r) => r.key === star.key);
  for (let guard = 0; guard < 400; guard++) {
    nav.render();
    const i = rowIndexOf(drv, star);
    if (i >= 0) return i;
    drv.page?.(full < (drv.S.listGeom.offset | 0) ? -1 : 1);
  }
  throw new Error('fixture: the row never came onto the drawn page');
}
const rowPoint = (drv, i) => ({ x: drv.S.listGeom.x0 + 4, y: drv.S.listGeom.top + (i + 1) * drv.S.listGeom.lead });

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('the fixture really holds two stars with one seed', () => {
  it('different keys, different positions, the same seed — and both drawn', async () => {
    const { drv, A, B } = await twinNav();
    expect(A.seed).toBe(B.seed);
    expect(A.key).not.toBe(B.key);
    expect(Math.hypot(A.wx - B.wx, A.wy - B.wy, A.wz - B.wz)).toBeGreaterThan(POSITION_MATCH_TOL);
    expect(drv.D.starRows.filter((r) => r.seed === A.seed)).toHaveLength(2);
    expect(markOf(drv, A)).toBeTruthy();
    expect(markOf(drv, B)).toBeTruthy();
  }, 60000);
});

describe('⛔ each twin resolves to ITSELF on every path (AC-2)', () => {
  for (const mode of ['rail', 'bars']) {
    it(`${mode}: the MAP MARK hovers, clicks, selects and warps to its own star (picking.js)`, async () => {
      const { nav, drv, A, B } = await twinNav(mode);
      for (const star of [A, B]) {
        const m = markOf(drv, star);
        nav._handleMouseMove({ clientX: m.x, clientY: m.y });
        nav.render();
        expect(nav._hoveredLocalStar?.star, `${mode}: hovering ${star.key} resolved its twin`).toBe(star);
        clickAt(nav, m.x, m.y);
        expect(nav._selectedNavStar, `${mode}: clicking ${star.key} selected its twin`).toBe(star);
        nav.render();
        expect(drv.D.selStar?.key, `${mode}: the published selection is the twin`).toBe(star.key);
        let action = null;
        nav._onCommit = (a) => { action = a; };
        nav._commitAction = null;
        expect(drv.commit()).toBe(true);
        expect(action?.star?.key).toBe(star.key);
        expect([action.star.wx, action.star.wy, action.star.wz]).toEqual([star.wx, star.wy, star.wz]);
        nav._levelIndex = 3; nav._systemStar = null; nav._systemData = null;
        nav.render();
      }
    }, 60000);

    it(`${mode}: the LIST ROW clicks and selects its own star (index.js)`, async () => {
      const { nav, drv, A, B } = await twinNav(mode, { list: mode === 'bars' });
      for (const star of [A, B]) {
        const p = rowPoint(drv, showRow(nav, drv, star));
        nav._handleMouseMove({ clientX: p.x, clientY: p.y });
        nav.render();
        expect(nav._hoveredLocalStar?.star, `${mode}: row ${star.key} resolved its twin`).toBe(star);
        clickAt(nav, p.x, p.y);
        expect(nav._selectedNavStar, `${mode}: clicking row ${star.key} selected its twin`).toBe(star);
        nav._levelIndex = 3; nav._systemStar = null; nav._systemData = null;
        nav.render();
      }
    }, 60000);
  }

  it('a SELECTION handed in as a copy publishes its own row, not the twin (state.js D.selStar)', async () => {
    const { nav, drv, A, B } = await twinNav();
    for (const star of [A, B]) {
      nav._selectedNavStar = { ...star };        // not the row object: the adapter must FIND it
      nav.render();
      expect(drv.D.selStar?.key, `selecting ${star.key} published its twin`).toBe(star.key);
      expect(drv.D.selStar.wy).toBe(star.wy);
    }
  }, 60000);

  it('a keyless selection is found by position at 0.1 pc, never by seed', async () => {
    const { nav, drv, A, B } = await twinNav();
    for (const star of [A, B]) {
      const { key: _k, ident: _i, ...bare } = star;
      nav._selectedNavStar = bare;
      nav.render();
      expect(drv.D.selStar?.key, `a keyless copy of ${star.key} published its twin`).toBe(star.key);
    }
  }, 60000);

  it('the binary stash on the way out of SYSTEM marks its own row (NavComputer.js:1465)', async () => {
    const { nav, A, B } = await twinNav();
    for (const star of [A, B]) {
      for (const s of nav._localStars) { delete s._isBinary; delete s._star2Type; }
      nav._levelIndex = 4;
      nav._systemStar = { ...star };
      nav._systemData = { isBinary: true, star2: { type: 'K' }, planets: [], star: { type: 'G' } };
      nav._systemMode = 'system'; nav._anim = null;
      nav.handleEscape();
      expect(nav._levelIndex, 'Escape must leave SYSTEM for PRISM').toBe(3);
      expect(nav._localStars.filter((s) => s._isBinary).map((s) => s.key)).toEqual([star.key]);
    }
  }, 60000);
});

describe('⛔ the memos are keyed by the star, not the seed (state.js nameFor / multFor)', () => {
  it('two nameless stars with one seed get their OWN position names', async () => {
    const { nav, drv, A } = await twinNav();
    const far = (dx, key) => ({ wx: A.wx + dx, wy: A.wy, wz: A.wz, seed: A.seed, spectral: 'G', dist: 0.01, key });
    const X = far(0.05, 'p:G:test:1:0'), Y = far(0.09, 'p:G:test:2:0');
    for (const s of [X, Y]) {
      nav._selectedNavStar = s;
      nav.render();
      expect(drv.D.selStar.name).toBe(generateSystemName(null, { x: s.wx, y: s.wy, z: s.wz }));
    }
    expect(generateSystemName(null, { x: X.wx, y: X.wy, z: X.wz }))
      .not.toBe(generateSystemName(null, { x: Y.wx, y: Y.wy, z: Y.wz }));   // the probe can fail
  }, 60000);

  it('the COMPS fill answers each twin from its own inputs', async () => {
    // ⚠ BUILT, NOT FOUND. `multFor` hands the oracle `pos:`, which its `_normalize` does not read, so a
    //   procedural row's count is a function of its seed alone (pre-existing; reported, not changed
    //   here) and two procedural twins can never disagree. A KnownSystems NAME is the input that can:
    //   the oracle's first rule answers by alias. So twin B becomes a catalogue star the way the
    //   real-star merge makes one — new name, new 'r:' key (NavComputer.js:3815), seed kept equal.
    const { nav, drv, A, B } = await twinNav();
    const gm = drv.D.gm;
    expect(gm, 'the adapter needs a galactic map for the fill').toBeTruthy();
    B.name = 'Alpha Centauri'; B.key = `r:Alpha Centauri@${B.wx},${B.wy},${B.wz}`; B.ident = null;
    nav._localStars = nav._localStars.slice();
    nav.render();
    const mult = (s) => multiplicityForSeed({ seed: s.seed, pos: { x: s.wx, y: s.wy, z: s.wz }, type: s.spectral,
      name: s.name }, { galacticMap: gm }).count;
    expect(mult(A), 'the twins must have different answers or the probe cannot fail').not.toBe(mult(B));
    for (const s of [A, B]) {
      expect(drv.D.starRows.find((r) => r.key === s.key).mult, `${s.name}'s COMPS came from its twin`).toBe(mult(s));
    }
  }, 60000);
});

describe('⛔ the loader de-duplicates by identity (NavComputer.js:3755)', () => {
  it('two real generator twins — same seed, same X to 6 dp — both load', async () => {
    // FOUND, NOT BUILT: measured 2026-10-02, the inner-galaxy column at (1.5, 0.3) holds
    // p:M:1366:-407:271 and p:M:1366:-242:271, one seed (3375394016) and one X (1.502729), 181 pc apart.
    const { nav } = await makeHeadlessNav({ width: 427, height: 240 });
    nav._gm = new GalacticMap('well-dipper-galaxy-1');
    nav._realStarCatalog = null;
    nav._localStars = []; nav._loadedSeen = new Set(); nav._loadedYMin = null; nav._loadedYMax = null;
    nav._loadBlockCenter = { x: 1.5, z: 0.3 }; nav._loadBlockHalf = 0.0039;
    nav._queryYRange(-0.46, -0.44);
    nav._queryYRange(-0.28, -0.26);
    const pair = nav._localStars.filter((s) => s.key === 'p:M:1366:-407:271' || s.key === 'p:M:1366:-242:271');
    expect(pair.map((s) => s.key).sort()).toEqual(['p:M:1366:-242:271', 'p:M:1366:-407:271']);
    expect(pair[0].seed).toBe(pair[1].seed);
    expect(pair[0].wx.toFixed(6)).toBe(pair[1].wx.toFixed(6));
    // and the rows carry the generator's identity, never a recomputed one
    for (const s of pair) expect(s.ident).toEqual({ tier: 'M', cx: 1366, cy: Number(s.key.split(':')[3]), cz: 271 });
  }, 60000);

  it('the same star returned by two overlapping queries still loads once', async () => {
    const { nav } = await makeHeadlessNav({ width: 427, height: 240 });
    nav._realStarCatalog = null;
    nav._localStars = []; nav._loadedSeen = new Set(); nav._loadedYMin = null; nav._loadedYMax = null;
    nav._loadBlockCenter = { x: 8, z: 0 }; nav._loadBlockHalf = 0.005;
    nav._queryYRange(-0.05, 0.05);
    const n = nav._localStars.length;
    expect(n).toBeGreaterThan(0);
    nav._queryYRange(-0.05, 0.05);
    expect(nav._localStars.length).toBe(n);
    expect(new Set(nav._localStars.map((s) => s.key)).size).toBe(n);
  }, 60000);
});

describe('⛔ the warp carries the star to arrival (main.js transport)', () => {
  const twins = () => {
    const A = { wx: 8.0012, wy: 0.0021, wz: -0.0007, seed: 777, key: 'p:K:1:2:3', name: 'Twin A', spectral: 'K' };
    const B = { wx: 8.0031, wy: -0.0044, wz: 0.0019, seed: 777, key: 'p:M:4:5:6', name: 'Twin B', spectral: 'M' };
    return [A, B];
  };
  const action = (s) => ({ type: 'warp', target: 'star', star: { ...s } });

  it('normal: navStarData — what arrival resolves from — is each twin\'s own position and key', () => {
    for (const s of twins()) {
      const h = host();
      h.dispatchNavAction(action(s));
      const d = h.env.warpTarget.navStarData;
      expect([d.worldX, d.worldY, d.worldZ, d.key, d.seed]).toEqual([s.wx, s.wy, s.wz, s.key, s.seed]);
    }
  });

  it('pre-FOLD overwrite and post-FOLD stash keep the key too', () => {
    for (const s of twins()) {
      const pre = host({ warpInFlight: true, foldSnapshotTaken: false });
      pre.dispatchNavAction(action(s));
      expect(pre.env.warpTarget.navStarData.key).toBe(s.key);
      const post = host({ warpInFlight: true, foldSnapshotTaken: true });
      post.dispatchNavAction(action(s));
      expect(post.pending?.key).toBe(s.key);
    }
    // the stash's consumer hands the key on (warpRevealSystem is too large to extract)
    expect(CODE).toMatch(/_setWarpTargetFromNavStar\(\{\s*worldX: _pw\.wx, worldY: _pw\.wy, worldZ: _pw\.wz,\s*seed: _pw\.seed, key: _pw\.key,/);
  });

  it('after arrival the nav reopens on the arrived star by key (_buildCurrentStarEntry)', () => {
    for (const s of twins()) {
      const h = host({ currentGalaxyStar: { worldX: s.wx, worldY: s.wy, worldZ: s.wz, seed: s.seed, key: s.key, type: s.spectral } });
      expect(h._buildCurrentStarEntry().key).toBe(s.key);
    }
  });
});

describe('⭐ debug / title / ?system= systems are named from their OWN seed (plan §3.5)', () => {
  const nameAt = (h, sd, pos) => generateSystemNames(new SeededRandom(String(sd.seed)), sd,
    sd._warpTargetName || h._seedSystemName(sd) || null, pos).system;
  const seeded = (seed) => Object.assign(StarSystemGenerator.generate(seed), { _seedNamed: true });

  it('same position, different seeds → different names; same seed, different positions → the same name', () => {
    const h = host();
    const P = { x: 8, y: 0, z: 0 }, Q = { x: 3, y: 0.2, z: -5 };
    const a = seeded('lab-procedural-1'), b = seeded('lab-procedural-2');
    expect(nameAt(h, a, P)).not.toBe(nameAt(h, b, P));
    expect(nameAt(h, a, P)).toBe(nameAt(h, a, Q));
    expect(nameAt(h, a, P)).toBe('SEED lab-procedural-1');
  });

  it('a galaxy system (no flag) keeps its position name — no normal name changes in Phase 1', () => {
    const h = host();
    const sd = StarSystemGenerator.generate('12345');
    const P = { x: 8.01, y: 0.002, z: 0.003 };
    expect(nameAt(h, sd, P)).toBe(generateSystemName(null, P));
    expect(h._seedSystemName(sd)).toBe(null);
  });

  it('spawnSystem names through it, and the three seed-only entry points set the flag', () => {
    expect(fnSource('spawnSystem')).toMatch(
      /generateSystemNames\(nameRng, systemData, systemData\._warpTargetName \|\| _seedSystemName\(systemData\) \|\| null, namingPos\)/);
    const between = (from, to) => { const i = CODE.indexOf(from); return CODE.slice(i, CODE.indexOf(to, i)); };
    expect(between('spawnProceduralSystem(seed = ', 'spawnSystem(')).toMatch(/sysData\._seedNamed = true/);
    expect(between('spawnWithSeed: (seed) => {', 'spawnSystem(')).toMatch(/sysData\._seedNamed = true/);
    expect(fnSource('_debugSpawnType')).toMatch(/preGenData = StarSystemGenerator\.generate\(seed\);\s*preGenData\._seedNamed = true;/);
  });
});

describe('starIdentity — the rule itself', () => {
  it('keys decide when both carry one; position at 0.1 pc otherwise; never the seed', () => {
    const a = { wx: 1, wy: 0, wz: 0, seed: 5, key: 'p:G:1:0:0' };
    expect(sameStar(a, { ...a, key: 'p:G:2:0:0' })).toBe(false);     // same place, other key
    expect(sameStar(a, { wx: 2, wy: 0, wz: 0, seed: 9, key: 'p:G:1:0:0' })).toBe(true);
    expect(sameStar(a, { wx: 1 + POSITION_MATCH_TOL / 2, wy: 0, wz: 0, seed: 99 })).toBe(true);
    expect(sameStar(a, { wx: 1 + POSITION_MATCH_TOL * 2, wy: 0, wz: 0, seed: 5 })).toBe(false);
    expect(sameStar(null, a)).toBe(false);
    expect(starMemoKey(a)).toBe('p:G:1:0:0');
    expect(starMemoKey({ wx: 1, wy: 2, wz: 3, seed: 5 })).not.toBe(starMemoKey({ wx: 1, wy: 2.5, wz: 3, seed: 5 }));
  });
});
