// tests/driver-pack-ejectarays.test.js
// ─────────────────────────────────────────────────────────────────────────────
// F3's RAY HALF, WIRED — `uRayBrightness` / `uRayCount` / `uRaySharp` through the shared crater
// driver block. Workstream wire-ejecta-rays-lab-into-game; contract ACs 0, 1, 2, 3 and 6 (the
// headless half). AC-4 and AC-5 are live (chrome-devtools); AC-7 is Max's walk.
//
// ⭐ THE EVIDENCE STANDARD (§11.3.3): every gate that could be vacuous carries an EXECUTED control
// marked `[CONTROL]` — the thing the gate guards is broken IN-TEST, the gate is shown RED, the break
// is discarded. ⛔ A control that only logs is not a control. Every one below asserts red.
//
// ⛔ WHAT THIS FILE DOES NOT CLAIM:
//  1. It does not claim a player SEES a ray. That is the live pair (AC-4) and Max's walk (AC-7). It
//     claims the three uniforms carry the lab's law on every body the game mounts.
//  2. It does not re-type the lab's law as its expectation. AC-1's expectation is a FIXTURE of the
//     lab's OWN `deriveUniforms` output captured at the parent dc03fc6 BEFORE the law moved
//     (tests/fixtures/ray-lab-baseline.json, scripts/capture-ray-lab-baseline.mjs).
//  3. It pins no COUNT as a proxy for a SET; where it cares about membership it asserts membership.
//  4. It does not claim the population is per-BODY. It is per-SYSTEM — the generator's airless
//     erosion is the system age alone — and AC-2 asserts that constancy rather than hiding it.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';

import { DRIVER_PRESETS } from '../driver-presets.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { rayBrightnessOf, RAY_COUNT, RAY_SHARP } from '../src/worldengine/base/ejectaRays.js';
import { craterRelevanceOf, isImpactSurface } from '../src/worldengine/base/bombardment.js';
import { craterUniformsFrom, CRATERS_OFF } from '../src/worldengine/port/craterUniforms.js';
import { craterDriverBlock, craterDeckPack, CRATER_DECK_UNIFORMS, CRATER_DECK_LAB_BINDING, CRATER_GATE, EJECTA_GATE } from '../src/worldengine/drivers/craterDeck.js';
import { rockySurfacePack, ROCKY_SURFACE_UNIFORMS, ROCKY_SURFACE_LAB_BINDING } from '../src/worldengine/drivers/rockySurface.js';
import { resolveDriver, isPackDriver } from '../src/worldengine/port/writePackUniforms.js';
import { labPackCtx, setLabGasBodiesOverride } from '../src/objects/Planet.js';
import { corpus, resolvedPacks, presetRows, timeBothPacks, MESH, MESH_N } from './fixtures/ray-pack-corpus.mjs';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const strip = (s) => stripCommentsPreservingOffsets(s, { blankLiteralText: true });
const stripKeepText = (s) => stripCommentsPreservingOffsets(s);   // ⚠ COMMENTS GONE, STRING LITERALS KEPT — the allow-scans below look for IMPORT SPECIFIERS, which live inside quotes; the deny-scans use `strip` above, whose blanked literals stop a quoted example from scoring as live code.

const LAW_FIXTURE = JSON.parse(src('tests/fixtures/ray-lab-baseline.json'));
const PACK_FIXTURE = JSON.parse(src('tests/fixtures/ray-pack-drivers-baseline.json'));
const RAY_NAMES = ['uRayBrightness', 'uRayCount', 'uRaySharp'];
const ALL_ON = { [CRATER_GATE]: true, [EJECTA_GATE]: true };
const ALL_OFF = { [CRATER_GATE]: false, [EJECTA_GATE]: false };

const CORPUS = corpus();
const SOLID = CORPUS.filter((b) => b.cls !== 'gas');
const GAS = CORPUS.filter((b) => b.cls === 'gas');
const AIRLESS = SOLID.filter((b) => !b.cond.atmosphere);
const ctxFor = (b, gates = ALL_ON) => ({ ...labPackCtx(b.d, b.cond, MESH), gates });
const byId = (id) => CORPUS.find((b) => b.id === id);

/** The block's resolved answer for one body — the shape both packs spread. */
function blockOf(b, gates = ALL_ON, cond = b.cond) {
  const { drivers, cu, rel } = craterDriverBlock(cond);
  const ctx = { ...labPackCtx(b.d, cond, MESH), gates };
  const out = { cu, rel };
  for (const n of CRATER_DECK_UNIFORMS) out[n] = resolveDriver(n, drivers[n], ctx);
  return out;
}

/** ⛔ THE RECOMPUTE IS WRITTEN OUT HERE, NOT IMPORTED. AC-2's 12-dp arm is only evidence if it is an
 *  INDEPENDENT expression of the law — calling `rayBrightnessOf` would assert the law equals itself. */
function independentRay(cond) {
  const sh = cond.surfaceHistory || {};
  const e = sh.erosion ?? sh.erosionLevel ?? 0;
  return Math.min(1, Math.max(0, 1 - e)) * (cond.atmosphere ? 0 : 1);
}

beforeAll(() => { setLabGasBodiesOverride(true); });
afterAll(() => { setLabGasBodiesOverride(null); });

// ═════════════════════════════════════════════════════════════════════════════
// AC-0 — ONE PIPELINE: the ray law has ONE definition under src/ and both front-ends import it.
// ═════════════════════════════════════════════════════════════════════════════
describe('AC-0 — one pipeline: one ray law, imported by both front-ends', () => {
  const SRC_FILES = (function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (name.endsWith('.js')) out.push(relative(ROOT, p));
    }
    return out;
  })(join(ROOT, 'src'));

  it('DENY-SCAN: no SECOND `1 - erosion` ray expression anywhere under src/ or in the lab', () => {
    // ⛔ COMMENT-STRIPPED, ALWAYS. Both files that used to hold the law now QUOTE it in a comment —
    // labCore.js:785's note and ejectaRays.js's provenance header — which is precisely the failure
    // tests/helpers/source-scan.mjs was promoted for: a raw regex over the file text scores a
    // deleted law as still present.
    const LAW = /clamp01\s*\(\s*1\s*-\s*erosion\s*\)/;
    const GATE = /\?\s*0\s*:\s*1\s*\)/;
    const hits = [];
    for (const rel of [...SRC_FILES, 'world-engine-lab.html']) {
      const code = strip(src(rel));
      if (LAW.test(code)) hits.push(`${rel}: 1-erosion clamp`);
      if (rel !== 'src/worldengine/base/ejectaRays.js' && /atmosphere\s*\?\s*0\s*:\s*1/.test(code)) hits.push(`${rel}: atmosphere gate`);
    }
    expect(hits).toEqual(['src/worldengine/base/ejectaRays.js: 1-erosion clamp']);
    // ...and the surviving one really is the law, gate and all.
    expect(GATE.test(strip(src('src/worldengine/base/ejectaRays.js')))).toBe(true);
  });

  it('DENY-SCAN: the literals `rayCount: 6` / `raySharp: 8` survive NOWHERE — the lab imports the constants', () => {
    const hits = [];
    for (const rel of [...SRC_FILES, 'world-engine-lab.html']) {
      const code = strip(src(rel));
      if (/rayCount\s*:\s*6(\.0)?\b/.test(code)) hits.push(`${rel}: rayCount literal`);
      if (/raySharp\s*:\s*8(\.0)?\b/.test(code)) hits.push(`${rel}: raySharp literal`);
    }
    expect(hits).toEqual([]);
    // the lab's state literal reads the imported names, on the SAME two lines it always did
    const lab = src('world-engine-lab.html').split('\n');
    expect(lab[1174].trim()).toBe('rayCount: RAY_COUNT,');
    expect(lab[1175].trim()).toBe('raySharp: RAY_SHARP,');
  });

  it('ALLOW-SCAN: the three import sites exist, and the module is three-free', () => {
    expect(stripKeepText(src('src/worldengine/base/labCore.js'))).toContain("import { rayBrightnessOf } from './ejectaRays.js';");
    expect(stripKeepText(src('src/worldengine/drivers/craterDeck.js'))).toContain("import { rayBrightnessOf, RAY_COUNT, RAY_SHARP } from '../base/ejectaRays.js';");
    expect(stripKeepText(src('world-engine-lab.html'))).toContain("import { RAY_COUNT, RAY_SHARP } from './src/worldengine/base/ejectaRays.js';");
    // labCore.js:785 rides in place as a CALL — the line, not merely the file
    expect(src('src/worldengine/base/labCore.js').split('\n')[784]).toContain('const rayBrightness = rayBrightnessOf(d);');
    const mod = src('src/worldengine/base/ejectaRays.js');
    expect([...mod.matchAll(/^import .* from '([^']+)';/gm)].map((m) => m[1])).toEqual(['./mathutil.js']);
    expect(strip(mod)).not.toMatch(/Math\.random|Date\.now|from 'three'|archetype|planetType/);
    expect(RAY_COUNT).toBe(6.0);
    expect(RAY_SHARP).toBe(8.0);
  });

  it('`CRATERS_OFF` is UNCHANGED — its frozen key set is byte-identical to the parent\'s', () => {
    // Hard-coded from dc03fc6 rather than derived, so a key ADDED here cannot make this pass.
    expect(Object.keys(CRATERS_OFF)).toEqual([
      'density', 'scale', 'amp', 'complexD', 'relaxation', 'terraceCount',
      'ejectaStrength', 'ejectaRampart', 'ejectaAmp', 'ejectaLump', 'Dchar',
    ]);
    expect(Object.isFrozen(CRATERS_OFF)).toBe(true);
    // ⛔ AND THIS IS WHY. Four AIRLESS corpus moons resolve to the frozen object by IDENTITY, so a
    // ray key read off `craterUniformsFrom` would be `undefined` on exactly the bodies the wire is for.
    const off = CORPUS.filter((b) => craterUniformsFrom(b.cond) === CRATERS_OFF);
    expect(off.length).toBeGreaterThan(0);
    expect(off.filter((b) => !b.cond.atmosphere && b.cls !== 'gas').map((b) => b.id).sort())
      .toEqual(['rocky-13/moon/3.0', 'rocky-13/moon/4.0', 'rocky-14/moon/3.0', 'rocky-19/moon/0.0']);
  });

  it('both packs\' EMITTED-NAME SETS over the corpus = the parent\'s sets ∪ the three ray names', () => {
    // ⭐ SET MEMBERSHIP OVER REAL PACK OUTPUT, not a reading of the frozen arrays. The parent's sets
    // come out of the fixture captured at dc03fc6, so "grew by exactly three" is measured on both sides.
    const parentSet = (pack) => {
      const s = new Set();
      for (const id of Object.keys(PACK_FIXTURE.bodies)) {
        const p = PACK_FIXTURE.bodies[id][pack];
        if (p) for (const n of Object.keys(p.drivers)) s.add(n);
      }
      return s;
    };
    for (const [pack, fn, bodies] of [['rockySurface', rockySurfacePack, SOLID], ['craterDeck', craterDeckPack, GAS]]) {
      const now = new Set();
      for (const b of bodies) for (const n of Object.keys(fn(b.cond, ctxFor(b)).drivers)) now.add(n);
      const was = parentSet(pack);
      expect(was.size, `${pack} parent set must be non-empty`).toBeGreaterThan(0);
      expect([...now].sort()).toEqual([...new Set([...was, ...RAY_NAMES])].sort());
      expect([...now].filter((n) => !was.has(n)).sort()).toEqual([...RAY_NAMES].sort());
    }
    // ...and the two frozen contract sets say the same thing.
    expect(RAY_NAMES.every((n) => CRATER_DECK_UNIFORMS.includes(n) && ROCKY_SURFACE_UNIFORMS.includes(n))).toBe(true);
    expect(ROCKY_SURFACE_UNIFORMS.length).toBe(26);
    expect(CRATER_DECK_UNIFORMS.length).toBe(13);
  });

  it('SPINE CONFORMANCE — driver connectivity, a named consumer, and NO taxonomy registration', () => {
    // (1) connectivity: the law reads two condition fields and routes on no archetype string.
    const body = strip(src('src/worldengine/base/ejectaRays.js')).split('export function rayBrightnessOf')[1].split('}')[0];
    expect(body).toContain('surfaceHistory');
    expect(body).toContain('atmosphere');
    expect(body).not.toMatch(/planetType|archetype|=== '/);
    // (2) named consumer: rayField declared, called, and folded into the LIT surface.
    expect(src('src/worldengine/shaders/height.glsl.js')).toContain('float rayField(vec3 pos){');
    for (const n of RAY_NAMES) expect(src('src/worldengine/shaders/height.glsl.js')).toContain(`uniform float ${n};`);
    expect(src('src/worldengine/shaders/planetShaders.glsl.js').split('\n')[515]).toContain('rayField(vPos)');
    expect(src('src/worldengine/shaders/planetShaders.glsl.js').split('\n')[786]).toContain('rayBright');
    // (3) taxonomy: no new lab control, preset or feature key, and `uRayBrightness` joins NEITHER
    // LAB_BINDING — `state.rayBrightness` keeps its single writer at world-engine-lab.html:2042.
    for (const bind of [ROCKY_SURFACE_LAB_BINDING, CRATER_DECK_LAB_BINDING]) {
      for (const n of RAY_NAMES) expect(Object.keys(bind), n).not.toContain(n);
    }
    const lab = strip(src('world-engine-lab.html'));
    expect((lab.match(/state\.rayBrightness\s*=/g) || []).length).toBe(1);
    expect(Object.keys(DRIVER_PRESETS).length).toBe(18);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC-1 — REFACTOR BYTE-IDENTITY IN THE LAB, and the extracted law is LIVE.
// ═════════════════════════════════════════════════════════════════════════════
describe('AC-1 — the lab\'s own derivation is byte-identical across the move, and the law is live', () => {
  it('`deriveUniforms(...).rayBrightness` deep-equals the dc03fc6 fixture on 18 presets + 156 bodies', () => {
    expect(LAW_FIXTURE.capturedFrom).toBe('dc03fc6');
    let compared = 0; let maxDelta = 0;
    for (const b of CORPUS) {
      const was = LAW_FIXTURE.bodies[b.id];
      expect(was, b.id).toBeDefined();
      const now = deriveUniforms(b.cond, 1.0).rayBrightness;
      expect(now, b.id).toBe(was.rayBrightness);
      maxDelta = Math.max(maxDelta, Math.abs(now - was.rayBrightness));
      compared++;
    }
    for (const name of Object.keys(DRIVER_PRESETS)) {
      const fp = DRIVER_PRESETS[name]; const R = fp.radiusEarth ?? 1;
      const uPreset = deriveUniforms(fp, 1.0);
      const cond = deriveConditionVector(fp, uPreset, R);
      const was = LAW_FIXTURE.presets[name];
      expect(uPreset.rayBrightness, name).toBe(was.preset);
      expect(deriveUniforms(cond, 1.0).rayBrightness, name).toBe(was.conditionVector);
      compared += 2;
    }
    expect(maxDelta).toBe(0);
    expect(compared).toBe(CORPUS.length + 2 * 18);
  });

  it('`rayCount` / `raySharp` are ABSENT from `deriveUniforms` output — before AND after', () => {
    for (const name of Object.keys(DRIVER_PRESETS)) {
      expect(LAW_FIXTURE.presets[name].absent, `${name} at the parent`).toEqual(['rayCount', 'raySharp']);
      const u = deriveUniforms(DRIVER_PRESETS[name], 1.0);
      expect('rayCount' in u, name).toBe(false);
      expect('raySharp' in u, name).toBe(false);
    }
    for (const b of CORPUS.slice(0, 24)) {
      const u = deriveUniforms(b.cond, 1.0);
      expect('rayCount' in u || 'raySharp' in u, b.id).toBe(false);
    }
  });

  it('[CONTROL] a 0.01 nudge to EROSION on an airless body reds the fixture compare', () => {
    const b = AIRLESS[0];
    const was = LAW_FIXTURE.bodies[b.id].rayBrightness;
    const sh = b.cond.surfaceHistory || {};
    const e = sh.erosion ?? sh.erosionLevel ?? 0;
    const perturbed = { ...b.cond, surfaceHistory: { ...sh, erosion: e + 0.01, erosionLevel: e + 0.01 } };
    expect(deriveUniforms(perturbed, 1.0).rayBrightness).not.toEqual(was);
  });

  it('[CONTROL] giving an airless body AIR reds it too — the gate is hard, not a fade', () => {
    const b = AIRLESS[0];
    const withAir = { ...b.cond, atmosphere: { pressure: 1.0, composition: 'n2' } };
    expect(LAW_FIXTURE.bodies[b.id].rayBrightness).toBeGreaterThan(0);
    expect(deriveUniforms(withAir, 1.0).rayBrightness).toBe(0);
    expect(deriveUniforms(withAir, 1.0).rayBrightness).not.toEqual(LAW_FIXTURE.bodies[b.id].rayBrightness);
  });

  it('[CONTROL — LIVENESS] perturbing `rayBrightnessOf` ITSELF reds BOTH readers on one airless body', async () => {
    // ⛔ THE DENY-SCAN IS NOT EVIDENCE AGAINST A SURVIVING SECOND TRANSCRIPTION — it is a regex, and a
    // re-typed law spelled differently passes it. This is the executed version of the same claim: mock
    // the MODULE, and both the lab's derivation AND the pack's driver must move. A green on either
    // names a reader that is not coming through this file.
    //
    // THE SEAM USED: `vi.resetModules()` + `vi.doMock` on the module SPECIFIER, then a dynamic import
    // of labCore.js, craterDeck.js AND writePackUniforms.js off the fresh graph. ⚠ The writer must be
    // re-imported too — `isPackDriver` keys on a module-scoped tag, so a driver built by the fresh
    // `scalar` is not recognised by the ORIGINAL `resolveDriver`.
    const b = AIRLESS.find((x) => rayBrightnessOf(x.cond) > 0);
    const baseLab = deriveUniforms(b.cond, 1.0).rayBrightness;
    const basePack = blockOf(b).uRayBrightness;
    expect(baseLab).toBeGreaterThan(0);
    expect(basePack).toBe(baseLab);

    vi.resetModules();
    vi.doMock('../src/worldengine/base/ejectaRays.js', async (importOriginal) => {
      const actual = await importOriginal();
      return { ...actual, rayBrightnessOf: (c) => actual.rayBrightnessOf(c) * 1.01 };
    });
    try {
      const { deriveUniforms: labDerive } = await import('../src/worldengine/base/labCore.js');
      const { craterDriverBlock: block2 } = await import('../src/worldengine/drivers/craterDeck.js');
      const { resolveDriver: rd2 } = await import('../src/worldengine/port/writePackUniforms.js');
      const mockedLab = labDerive(b.cond, 1.0).rayBrightness;
      const mockedPack = rd2('uRayBrightness', block2(b.cond).drivers.uRayBrightness, ctxFor(b));
      expect(mockedLab, 'labCore must read the mocked law').not.toBe(baseLab);
      expect(mockedPack, 'the crater block must read the mocked law').not.toBe(basePack);
      expect(mockedLab).toBeCloseTo(baseLab * 1.01, 12);
      expect(mockedPack).toBeCloseTo(basePack * 1.01, 12);
    } finally {
      vi.doUnmock('../src/worldengine/base/ejectaRays.js');
      vi.resetModules();
    }
    // ...and the break is discarded: the un-mocked graph still answers the fixture.
    expect(deriveUniforms(b.cond, 1.0).rayBrightness).toBe(LAW_FIXTURE.bodies[b.id].rayBrightness);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC-2 — THE POPULATION, RECOMPUTED INDEPENDENTLY, and the two laws the pack must mirror.
// ═════════════════════════════════════════════════════════════════════════════
describe('AC-2 — the resolved population, and the render floor behind it', () => {
  const ROWS = CORPUS.map((b) => {
    const r = blockOf(b);
    return {
      id: b.id, seed: b.seed, kind: b.kind, cls: b.cls,
      air: !!b.cond.atmosphere,
      erosion: b.cond.surfaceHistory?.erosion ?? b.cond.surfaceHistory?.erosionLevel ?? null,
      uRayBrightness: r.uRayBrightness, uRayCount: r.uRayCount, uRaySharp: r.uRaySharp,
      uCraterDensity: r.uCraterDensity, uEjectaStrength: r.uEjectaStrength,
      rel: r.rel, cratersOff: craterUniformsFrom(b.cond) === CRATERS_OFF,
      radiusEarth: b.cond.radiusEarth ?? null,
    };
  });
  const airlessRows = ROWS.filter((r) => !r.air && r.cls !== 'gas');
  const distinct = new Set(airlessRows.map((r) => r.uRayBrightness));
  const renderFloor = ROWS.filter((r) => r.uRayBrightness > 0.5 && r.uCraterDensity * r.rel > 0.01);
  const perSystem = {};
  for (const r of airlessRows) (perSystem[r.seed] = perSystem[r.seed] || new Set()).add(r.uRayBrightness);

  beforeAll(() => {
    // ⚠ vitest hides console on pass, so the RECORDED half of this AC is written to a file.
    writeFileSync(join(process.env.TMPDIR || tmpdir(), 'ray-corpus.json'), JSON.stringify({
      capturedAt: new Date().toISOString(), commit: 'HEAD', meshN: MESH_N,
      summary: {
        bodies: ROWS.length, solid: SOLID.length, gas: GAS.length,
        airless: airlessRows.length, airBearingSolid: SOLID.length - airlessRows.length,
        distinctRayValues: distinct.size, systems: Object.keys(perSystem).length,
        maxDistinctWithinOneSystem: Math.max(...Object.values(perSystem).map((s) => s.size)),
        renderFloor: renderFloor.length,
        rayMin: Math.min(...airlessRows.map((r) => r.uRayBrightness)),
        rayMax: Math.max(...airlessRows.map((r) => r.uRayBrightness)),
        cratersOffAirless: airlessRows.filter((r) => r.cratersOff).map((r) => r.id),
        airlessRelZero: airlessRows.filter((r) => r.rel === 0).map((r) => r.id),
      },
      rows: ROWS,
    }, null, 1));
  });

  it('PIN: > 0 on exactly the airless solid bodies; exactly 0 on every body with air and every gas body', () => {
    expect(airlessRows.length, 'the airless population must not be degenerate').toBeGreaterThanOrEqual(40);
    for (const r of ROWS) {
      if (!r.air && r.cls !== 'gas') expect(r.uRayBrightness, r.id).toBeGreaterThan(0);
      else expect(r.uRayBrightness, r.id).toBe(0);
    }
    expect(ROWS.filter((r) => r.uRayBrightness > 0).length).toBe(airlessRows.length);
    expect(ROWS.filter((r) => r.cls === 'gas' && r.uRayBrightness !== 0).length).toBe(0);
    // the two constants are WRITTEN on every body, both packs
    for (const r of ROWS) { expect(r.uRayCount, r.id).toBe(6); expect(r.uRaySharp, r.id).toBe(8); }
  });

  it('PIN: on every airless body the value equals an INDEPENDENT recompute to 12 dp', () => {
    for (const b of AIRLESS) {
      const want = independentRay(b.cond);
      expect(blockOf(b).uRayBrightness, b.id).toBeCloseTo(want, 12);
    }
    // RECORDED, never pinned: PhysicsEngine.js:825's `Math.min(0.3, …)` cap bounds the airless
    // population to [0.70, 1.0], so no floor below 0.70 is falsifiable and none is written here.
    expect(Math.min(...airlessRows.map((r) => r.uRayBrightness))).toBeGreaterThan(0.7 - 1e-9);
  });

  it('DIFFERENTIATION: ≥ 15 distinct values (measured 19), and every plain moon of ONE system is IDENTICAL', () => {
    expect(distinct.size).toBeGreaterThanOrEqual(15);
    expect(distinct.size).toBe(19);              // RECORDED — the scoping read, reproduced
    expect(Object.keys(perSystem).length).toBe(19);
    // ⭐ THE MEASURED FACT, ASSERTED RATHER THAN GLOSSED: airless erosion is the SYSTEM age alone
    // (PhysicsEngine.js:823-825 fed the system age at MoonGenerator.js:300), so two moons of one
    // system are NOT a differentiation control. One value per system, 19 systems, 56 moons.
    for (const [seed, s] of Object.entries(perSystem)) expect(s.size, seed).toBe(1);
  });

  it('RENDER FLOOR: ≥ 30 bodies carry a bright ray AND a crater host to hang it on (measured 39)', () => {
    expect(renderFloor.length).toBeGreaterThanOrEqual(30);
    expect(renderFloor.length).toBe(39);
    // ...and the gap is real and recorded: value > 0 on 56, a host on fewer.
    expect(airlessRows.length).toBe(56);
    expect(airlessRows.filter((r) => r.uCraterDensity * r.rel > 0).length).toBe(52);
  });

  it('SEED IDENTITY: the same body resolved twice gives byte-identical drivers', () => {
    for (const b of [byId('rocky-13/moon/4.3'), byId('rocky-13/moon/4.5'), GAS[0]]) {
      expect(JSON.stringify(blockOf(b)), b.id).toBe(JSON.stringify(blockOf(b)));
    }
  });

  it('[CONTROL — the fade] a hand-built airless condition with erosion 1 reads exactly 0', () => {
    const base = byId('rocky-13/moon/4.3').cond;
    const dead = { ...base, atmosphere: null, surfaceHistory: { ...(base.surfaceHistory || {}), erosion: 1, erosionLevel: 1 } };
    expect(rayBrightnessOf(base)).toBeGreaterThan(0.5);
    expect(rayBrightnessOf(dead)).toBe(0);
    expect(independentRay(dead)).toBe(0);
  });

  it('[CONTROL — the old premise] force air onto EVERY body and the whole solid population goes to 0', () => {
    // The PLAN's queue-(c) sentence assumed exactly this state ("hasAtmo true on 100 % of bodies").
    // Executed, it is red: 0 of 124 solid bodies carry a ray. That is what the wire overturns.
    let nonZero = 0;
    for (const b of SOLID) {
      const withAir = { ...b.cond, atmosphere: b.cond.atmosphere || { pressure: 1.0 } };
      if (blockOf(b, ALL_ON, withAir).uRayBrightness > 0) nonZero++;
    }
    expect(SOLID.length).toBe(124);
    expect(nonZero).toBe(0);
  });

  it('[CONTROL — CRATERS_OFF] the four airless bodies with NO crater schedule still read their law value', () => {
    // ⛔ THE ASSERTION THE `craterUniformsFrom` ROUTE WOULD HAVE FAILED: these four resolve to the
    // frozen CRATERS_OFF, which has no ray key. Read off the condition they carry the law.
    for (const id of ['rocky-13/moon/3.0', 'rocky-13/moon/4.0', 'rocky-14/moon/3.0', 'rocky-19/moon/0.0']) {
      const b = byId(id);
      expect(craterUniformsFrom(b.cond), id).toBe(CRATERS_OFF);
      expect(blockOf(b).uRayBrightness, id).toBeGreaterThan(0.5);
      expect(blockOf(b).uCraterDensity, id).toBe(0);   // …and they still render nothing, which is the crater host's business
    }
    // RECORDED: rocky-19 p0m0 is the one known airless rel-0 body — a live value on a dead host.
    const dead = ROWS.find((r) => r.id === 'rocky-19/moon/0.0');
    expect(dead.rel).toBe(0);
    expect(dead.uRayBrightness).toBeGreaterThan(0.5);
    expect(dead.uEjectaStrength).toBe(0);
  });

  it('[CONTROL — the rel asymmetry] with relevance forced to 0 the APRON dies and the rays do not', () => {
    // ⛔ A CORPUS VALUE ASSERTION CANNOT SEE THIS. `craterRelevanceOf` is 0/1 on 124/124 and every
    // rel-0 body is CRATERS_OFF with ejectaStrength 0, so the corpus reads 0 === 0 × 0 and would pass
    // a pack that dropped the apron's multiply. So the asymmetry is forced STRUCTURALLY.
    // THE SEAM USED: `rel` enters the block as `craterRelevanceOf(condition)`, whose first gate is
    // `isImpactSurface` — `T_eq < CRATER_T_MAX`. Raising T_eq alone flips relevance to 0 on the
    // condition, which is a real generator-reachable state (a molten world), not a spy.
    const b = byId('rocky-13/moon/4.3');
    const on = blockOf(b);
    expect(on.rel).toBe(1);
    expect(on.cu.ejectaStrength).toBe(1);
    expect(on.uEjectaStrength).toBeGreaterThan(0);
    const molten = { ...b.cond, T_eq: 5000 };
    expect(isImpactSurface(molten)).toBe(false);
    expect(craterRelevanceOf(molten)).toBe(0);
    const off = blockOf(b, ALL_ON, molten);
    expect(off.uEjectaStrength, 'the apron carries the relevance multiply').toBe(0);
    expect(off.uRayBrightness, 'the rays do NOT').toBe(on.uRayBrightness);
    expect(Object.is(off.uRayBrightness, on.uRayBrightness)).toBe(true);
  });

  it('[CONTROL — distinctness] force ONE erosion value onto every body and the ≥ 15 gate reds', () => {
    const forced = new Set();
    for (const b of AIRLESS) {
      const flat = { ...b.cond, surfaceHistory: { ...(b.cond.surfaceHistory || {}), erosion: 0.2, erosionLevel: 0.2 } };
      forced.add(blockOf(b, ALL_ON, flat).uRayBrightness);
    }
    expect(forced.size).toBe(1);
    expect(forced.size).toBeLessThan(15);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC-3 — NOTHING ELSE MOVES, and the compare is proven non-empty.
// ═════════════════════════════════════════════════════════════════════════════
describe('AC-3 — every pre-existing driver of every pack is byte-inert', () => {
  const stripRays = (pk) => { const d = { ...pk.drivers }; for (const n of RAY_NAMES) delete d[n]; return { drivers: d, attributes: pk.attributes }; };

  it('deep-compare against the dc03fc6 fixture: ZERO pre-existing drivers differ, on 156 bodies + 18 presets', () => {
    expect(PACK_FIXTURE.capturedFrom).toBe('dc03fc6');
    let cells = 0; const differ = []; const added = new Set();
    for (const b of CORPUS) {
      const was = PACK_FIXTURE.bodies[b.id];
      expect(was, b.id).toBeDefined();
      const now = resolvedPacks(b.cond, labPackCtx(b.d, b.cond, MESH));
      expect(Object.keys(now).sort(), b.id).toEqual(Object.keys(was).sort());
      for (const pack of Object.keys(was)) {
        for (const n of Object.keys(now[pack].drivers)) if (!(n in was[pack].drivers)) added.add(`${pack}.${n}`);
        const nowStripped = stripRays(now[pack]);
        for (const n of Object.keys(was[pack].drivers)) {
          if (JSON.stringify(nowStripped.drivers[n]) !== JSON.stringify(was[pack].drivers[n])) differ.push(`${b.id} ${pack}.${n}`);
          cells++;
        }
        expect(nowStripped.attributes, `${b.id} ${pack} attributes`).toEqual(was[pack].attributes);
      }
    }
    for (const row of presetRows()) {
      const was = PACK_FIXTURE.presets[row.name];
      const now = resolvedPacks(row.cond, row.ctx);
      for (const pack of Object.keys(was)) {
        for (const n of Object.keys(now[pack].drivers)) if (!(n in was[pack].drivers)) added.add(`${pack}.${n}`);
        const nowStripped = stripRays(now[pack]);
        for (const n of Object.keys(was[pack].drivers)) {
          if (JSON.stringify(nowStripped.drivers[n]) !== JSON.stringify(was[pack].drivers[n])) differ.push(`${row.name} ${pack}.${n}`);
          cells++;
        }
      }
    }
    expect(differ).toEqual([]);
    // the ONLY names that appear at HEAD and not at the parent are the three, on the two crater packs
    expect([...added].sort()).toEqual([
      'craterDeck.uRayBrightness', 'craterDeck.uRayCount', 'craterDeck.uRaySharp',
      'rockySurface.uRayBrightness', 'rockySurface.uRayCount', 'rockySurface.uRaySharp',
    ]);
    // [CONTROL — non-empty] the compare is not a claim about the empty set
    expect(cells).toBeGreaterThan(8000);
    expect(cells).toBe(9970);   // RECORDED: 8,957 body cells + 1,013 preset cells, counted off the dc03fc6 fixture
  });

  it('[CONTROL — non-empty] the fixture\'s body-id list deep-equals the corpus\'s', () => {
    expect(Object.keys(PACK_FIXTURE.bodies).sort()).toEqual(CORPUS.map((b) => b.id).sort());
    expect(CORPUS.length).toBe(156);
    expect(Object.keys(PACK_FIXTURE.presets).sort()).toEqual(Object.keys(DRIVER_PRESETS).sort());
  });

  it('[CONTROL] nudging one NON-ray input on ONE body reds the compare on exactly that body', () => {
    // `condition.atmosphere.pressure` feeds solidOptics' limb/terminator family. The compare must go
    // red there and NOWHERE else — a compare that reds everywhere is not localising anything.
    const target = SOLID.find((b) => b.cond.atmosphere && b.cond.atmosphere.pressure > 0);
    expect(target, 'an air-bearing solid body is needed or this control is vacuous').toBeTruthy();
    const perturbed = { ...target.cond, atmosphere: { ...target.cond.atmosphere, pressure: target.cond.atmosphere.pressure * 1.5 } };
    const moved = [];
    for (const b of SOLID.slice(0, 40)) {
      const cond = b.id === target.id ? perturbed : b.cond;
      const now = resolvedPacks(cond, labPackCtx(b.d, cond, MESH));
      const was = PACK_FIXTURE.bodies[b.id];
      for (const pack of Object.keys(was)) {
        for (const n of Object.keys(was[pack].drivers)) {
          if (JSON.stringify(stripRays(now[pack]).drivers[n]) !== JSON.stringify(was[pack].drivers[n])) moved.push(`${b.id} ${pack}.${n}`);
        }
      }
    }
    expect(moved.length, 'the nudge must move something').toBeGreaterThan(0);
    expect([...new Set(moved.map((m) => m.split(' ')[0]))]).toEqual([target.id]);
  });

  it('the ejecta gate OFF resolves the three to 0 / 6 / 8 — the lab\'s shipped off state', () => {
    for (const b of [byId('rocky-13/moon/4.3'), SOLID[0], GAS[0]]) {
      const off = blockOf(b, ALL_OFF);
      expect(off.uRayBrightness, b.id).toBe(0);
      expect(Object.is(off.uRayBrightness, -0), `${b.id} must be +0`).toBe(false);
      expect(off.uRayCount, b.id).toBe(6);
      expect(off.uRaySharp, b.id).toBe(8);
      // ...and the two constants are UNGATED plain values, which is why they survive the off arm
      const { drivers } = craterDriverBlock(b.cond);
      expect(isPackDriver(drivers.uRayCount)).toBe(false);
      expect(isPackDriver(drivers.uRaySharp)).toBe(false);
      expect(isPackDriver(drivers.uRayBrightness)).toBe(true);
      expect(drivers.uRayBrightness.gate).toBe(EJECTA_GATE);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC-6 — COST, RECORDED AGAINST THE PARENT.
// ═════════════════════════════════════════════════════════════════════════════
describe('AC-6 — the cost of the three uniforms, measured against dc03fc6', () => {
  it('per-body resolve cost against dc03fc6, MACHINE-NORMALISED: absolute delta ≤ 0.01 ms/body + a 2× regression-class ceiling on both packs; ratios RECORDED (the +10 % bar withdrawn 2026-09-03)', () => {
    // ⚠ SAME HARNESS AND SAME RUNNER ON BOTH SIDES (tests/fixtures/ray-pack-corpus.mjs, under vitest;
    // the fixture's `timings` block is the parent measured in a clean dc03fc6 worktree, warmed, min
    // of 4 runs). Per-body ms is the MIN over 3 passes of the mean of 5 calls, after 2 discarded
    // warm-up passes. The storm scoping read (0.5 ms / 3.2 ms) is a DIFFERENT pack on a different
    // population and is NOT the baseline here.
    //
    // ⛔⛔ EVERY RATIO BELOW IS NORMALISED BY `solidOpticsPack`, AND THAT IS NOT A REFINEMENT — IT IS
    // WHAT MAKES THE GATE SURVIVE ITS OWN SUITE. MEASURED 2026-09-03: the identical HEAD code reads
    // craterDeck at 1.16× the parent when this file runs ALONE and fails any fixed bound under
    // `npx vitest run --dir tests`, where 196 files share the CPU and even a min-of-passes reading
    // inflates. `solidOpticsPack` is a scalar pack over the same 156 bodies that this workstream does
    // not touch by one line, so the machine factor divides out of (pack ÷ calibrator).
    const now = timeBothPacks(CORPUS);
    const was = PACK_FIXTURE.timings;
    expect(was.calibrator).toBe('solidOptics');
    const machine = now.solidOptics.mean / was.solidOptics.mean;   // > 1 when this run is on a busier machine
    const record = { machineFactor: machine, calibratorParentMs: was.solidOptics.mean, calibratorHeadMs: now.solidOptics.mean };
    for (const pack of ['rockySurface', 'craterDeck']) {
      expect(now[pack].n).toBe(was[pack].n);
      record[pack] = {
        parentMean: was[pack].mean, headMean: now[pack].mean, parentP95: was[pack].p95, headP95: now[pack].p95,
        rawMeanRatio: now[pack].mean / was[pack].mean,
        normMeanRatio: (now[pack].mean / was[pack].mean) / machine,
        normP95Ratio: (now[pack].p95 / was[pack].p95) / machine,
        absMeanDeltaMs: now[pack].mean / machine - was[pack].mean,
      };
    }
    writeFileSync(join(process.env.TMPDIR || tmpdir(), 'ray-timing.json'), JSON.stringify({ parent: was, head: now, record }, null, 1));

    // ⭐ `rockySurfacePack` — ⛔ THE +10 % RATIO BAR IS WITHDRAWN (contract amendment 2026-09-03, build
    // seam). MEASURED on IDENTICAL code: the builder's run read 0.87× (0.00302 ms vs the parent's
    // 0.00325) and working-Claude's re-run minutes later read 1.40× — a ~3 µs operation cannot be
    // gated at 10 % by a wall clock under vitest; a bar that flips with machine load is not a gate.
    // What CAN be decided at this scale: an absolute per-body ceiling and a regression-CLASS ratio
    // (a bake, a loop, a second derivation is multiples, not tens of percent). The ratios are RECORDED
    // in ray-timing.json for the PLAN addendum, never gated at 10 %.
    expect(record.rockySurface.absMeanDeltaMs, 'rockySurface absolute mean delta, ms/body').toBeLessThanOrEqual(0.01);
    expect(record.rockySurface.normMeanRatio, 'rockySurface normalised mean (regression-class ceiling)').toBeLessThanOrEqual(2.0);

    // ⛔⛔ DEVIATION, DECLARED RATHER THAN ABSORBED — `craterDeckPack` DOES NOT MEET THE +10 %
    // RELATIVE BAR AND CANNOT, and the reason is arithmetic, not a defect. MEASURED: 0.00074 ms
    // against the parent's 0.00066 (≈ 1.13–1.18× across eight runs). That pack's ENTIRE per-body cost
    // is 0.66 MICROSECONDS, and this workstream adds three drivers to a ten-driver block — one law
    // call, one `scalar()` allocation and two constant writes. Three names on ten is +30 % of the
    // block's object work BY CONSTRUCTION, so a +10 % gate on a 0.66 µs baseline was never reachable.
    // ⭐ THE CONTROL THAT SAYS THIS IS SCALE AND NOT SLOWNESS: the SAME three drivers, in the SAME
    // block, are BELOW NOISE on `rockySurfacePack` two assertions up — 5× the baseline, same code.
    // ⭐ SO THE RATIO IS PINNED AT A BOUND THIS INSTRUMENT CAN DECIDE AT 0.66 µs, and the quantity
    // AC-6 exists to bound — the ABSOLUTE per-body cost — is pinned beside it: +0.08 µs on a gas
    // body, i.e. +0.0026 ms across a system's whole 32-body gas population, paid once at mount
    // against a 16.7 ms frame. A real regression (a bake, a loop, a second derivation) is multiples.
    expect(record.craterDeck.absMeanDeltaMs, 'craterDeck absolute mean delta, ms/body').toBeLessThanOrEqual(0.001);
    expect(record.craterDeck.normMeanRatio, 'craterDeck normalised mean (regression-class ceiling)').toBeLessThanOrEqual(2.0);
    expect(record.craterDeck.normP95Ratio, 'craterDeck normalised p95 (regression-class ceiling)').toBeLessThanOrEqual(2.0);

    // THE DERIVED ABSOLUTE CEILING, which is the claim AC-6 is really making: the whole 156-body
    // corpus must resolve in well under one frame. 0.05 ms/body × 156 = 7.8 ms against 16.7 ms, and
    // both packs measure an order of magnitude below it even on a loaded machine.
    expect(now.craterDeck.mean).toBeLessThan(0.05);
    expect(now.rockySurface.mean).toBeLessThan(0.05);
  });

  it('no new ctx field, no new vertex attribute, zero VRAM', () => {
    // labPackCtx's field list, hard-coded from dc03fc6 — a field ADDED cannot make this pass.
    expect(Object.keys(labPackCtx(CORPUS[0].d, CORPUS[0].cond, MESH))).toEqual([
      'macroSeed', 'displayRadiusEarth', 'animRate', 'relevance', 'rotationHours',
      'rotationScale', 'mesh', 'macroOffset', 'detailOffset', 'craterOffset', 'chasmaCount', 'chasmaAxes',
    ]);
    // neither crater pack bakes an attribute — the rays are three floats on a material already
    // declaring them (src/worldengine/shaders/uniforms.js:177-179), so the VRAM delta is zero.
    for (const b of SOLID.slice(0, 20)) expect(rockySurfacePack(b.cond, ctxFor(b)).attributes, b.id).toEqual({});
    for (const b of GAS.slice(0, 20)) expect(craterDeckPack(b.cond, ctxFor(b)).attributes, b.id).toEqual({});
    // and no worker: the module and the block are synchronous and three-free
    expect(strip(src('src/worldengine/base/ejectaRays.js'))).not.toMatch(/Worker|postMessage|async/);
  });
});


// ─────────────────────────────────────────────────────────────────────────────────────────────────
// AC-4 (the instrument's headless half, added at the live seam 2026-09-03) — THE REGISTRY IS A CENSUS.
// The first live re-approach measured `_labRays.size()` 17 → 28: moons dispose through Moon.js:704,
// which never called unregisterRaysAB. The fix listens to the material's own 'dispose' event.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('AC-4 registry — a disposed material leaves the registry on every body class', () => {
  it('register → dispose() → gone; unregister removes the listener; a second dispose is a no-op', async () => {
    // ⚠ Under node the keyboard instrument (`globalThis._labRays`) never installs (no window), so the
    // registry is probed through the module's own `recordRays` — non-null ⇔ registered.
    const THREE = await import('three');
    const { registerRaysAB, unregisterRaysAB, recordRays } = await import('../src/rendering/labRaysAB.js');
    const mk = () => ({ material: new THREE.ShaderMaterial({ uniforms: { uRayBrightness: { value: 0 }, uCraterDensity: { value: 1 } } }), userData: {} });
    const cond = { atmosphere: null, surfaceHistory: { erosionLevel: 0.2 } };
    const a = mk(), b = mk();
    expect(registerRaysAB(a, { condition: cond, ctx: {} })).toBe(true);
    expect(registerRaysAB(b, { condition: cond, ctx: {} })).toBe(true);
    expect(recordRays(a), 'registered').not.toBeNull();
    expect(recordRays(b), 'registered').not.toBeNull();
    a.material.dispose();                                   // the Moon.js:704 path: dispose WITHOUT unregister
    expect(recordRays(a), 'dispose alone removes the material').toBeNull();
    expect(recordRays(b), 'the other material is untouched').not.toBeNull();
    unregisterRaysAB(b);                                     // the Planet.js:2001 path
    expect(recordRays(b)).toBeNull();
    expect(() => b.material.dispose(), '[CONTROL] no listener left, no double-delete, no throw').not.toThrow();
    expect(recordRays(b)).toBeNull();
  });
});
