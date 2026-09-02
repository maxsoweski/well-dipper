// tests/province-bake-host.test.js — docs/WORKSTREAMS/wire-province-cube-lab-into-game/ AC-0, AC-1,
// AC-2, AC-5 (the headless half; AC-3 is a live chrome-devtools drive and AC-6 is Max's).
//
// ⚠ ALWAYS `npx vitest run --dir tests` — without --dir a stale worktree copy under .claude/ doubles
// every count (handoff 2026-08-28).
//
// WHAT EACH BLOCK GATES, AND THE NUMBER IT WAS WRITTEN AGAINST:
//   AC-0  the four moved symbols are DEFINED exactly once each, under src/, and the root lab modules
//         re-export them — so world-engine-lab.html and ~60 suites keep their import path.
//   AC-1  over the appendix's 24 rocky-* seeds (156 bodies: 124 solid / 32 gas, all admitted), every
//         solid body gets a fully-labelled province from the game's inputs; gas bodies get none; the
//         array is byte-identical to the lab's own import path on the same inputs. Before: 0 bodies.
//   AC-2  the game's mesh IS the lab's (DEFAULT_PARAMS 40000 / 4), pinned through the lab's own
//         export — because the 2026-09-01 measurement (provinceDispatch.js header) showed any coarser
//         mesh draws a DIFFERENT partition (69–73% label agreement), not a cheaper copy of the same one.
//   AC-5  bake-once + dispose-once through the real mount, on both transports (sync and async),
//         with a late reply after dispose dropped; the shared mesh is built once across bodies.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { Planet, labPipelineAdmits, labMacroSeed, setLabGasBodiesOverride } from '../src/objects/Planet.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../src/worldengine/mesh/sphereMesh.js';
import { writeBodyRelief as writeBodyReliefViaLab, buildIrregularSphere as buildViaLab, DEFAULT_PARAMS } from '../planet-lod-rivers.js';
import { PROVINCE_CUBE_SIZE, createProvinceCube, buildProvinceCubeGeometry } from '../planet-lod-tectonic.js';
import { PROVINCE_CUBE_SIZE as SIZE_SRC, createProvinceCube as createSrc } from '../src/rendering/bake/provinceCube.js';
import {
  GAME_MESH, sharedCarrierMesh, meshBuildCount, _resetSharedMeshForTests,
  bodyDriversFromCondition, provinceAppliesTo, provinceFractions, buildProvinceForBody,
  attachProvinceBake, disposeProvinceBake, provinceRecordOf, toggleProvinceAB, provinceTransport,
} from '../src/rendering/bake/labBakeHost.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// ── The corpus: the appendix's 24 rocky-* seeds, planets + moons, each with its condition ─────────
// ⚠ A planet in `sys.planets` is an ENTRY wrapping `planetData`; the provenance stamps live on the
// record (StarSystemGenerator.js:566). Pass the entry and every planet is refused — measured.
const SEEDS = Array.from({ length: 24 }, (_, i) => `rocky-${i}`);
function corpus() {
  const out = [];
  for (const seed of SEEDS) {
    const sys = StarSystemGenerator.generate(seed, null);
    for (const e of sys.planets) {
      out.push({ seed, kind: 'planet', d: e.planetData || e });
      for (const m of (e.moons || [])) out.push({ seed, kind: m.isPlanetMoon ? 'planet-moon' : 'moon', d: m });
    }
  }
  for (const b of out) { b.cond = conditionFromBody(b.d); b.admit = labPipelineAdmits(b.d, b.cond); }
  return out;
}
let BODIES = null;
const bodyOf = (b) => ({ condition: b.cond, macroSeed: labMacroSeed(b.d), T_eq: b.cond.T_eq });
beforeAll(() => { setLabGasBodiesOverride(true); BODIES = corpus(); });
afterEach(() => { toggleProvinceAB(false); });

// ══════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-0 — one pipeline: the moved code is defined once, under src/, and re-exported by the root modules', () => {
  const FILES = ['src/worldengine/mesh/sphereMesh.js', 'planet-lod-rivers.js', 'planet-lod-tectonic.js',
    'src/rendering/bake/provinceCube.js', 'src/rendering/bake/labBakeHost.js', 'src/rendering/bake/provinceDispatch.js',
    'src/rendering/bake/provinceWorker.js'];
  it('buildIrregularSphere + helpers, and the four province symbols, are each DEFINED exactly once', () => {
    const all = FILES.map((p) => [p, read(p)]);
    const defs = (re) => all.filter(([, t]) => re.test(t)).map(([p]) => p);
    expect(defs(/^export function buildIrregularSphere\(/m)).toEqual(['src/worldengine/mesh/sphereMesh.js']);
    expect(defs(/^function fibonacciSphere\(/m)).toEqual(['src/worldengine/mesh/sphereMesh.js']);
    expect(defs(/^function sphericalDelaunay\(/m)).toEqual(['src/worldengine/mesh/sphereMesh.js']);
    expect(defs(/^function buildAdjacency\(/m)).toEqual(['src/worldengine/mesh/sphereMesh.js']);
    expect(defs(/^export function createProvinceCube\(/m)).toEqual(['src/rendering/bake/provinceCube.js']);
    expect(defs(/^export function bakeProvinceCube\(/m)).toEqual(['src/rendering/bake/provinceCube.js']);
    expect(defs(/^export function buildProvinceCubeGeometry\(/m)).toEqual(['src/rendering/bake/provinceCube.js']);
    expect(defs(/^export const PROVINCE_CUBE_SIZE\b/m)).toEqual(['src/rendering/bake/provinceCube.js']);
  });
  it('the root modules import the moved code BACK and re-export it; the worker uses the moved builder', () => {
    expect(buildViaLab).toBe(buildIrregularSphere);
    expect(createProvinceCube).toBe(createSrc);
    expect(PROVINCE_CUBE_SIZE).toBe(SIZE_SRC);
    expect(PROVINCE_CUBE_SIZE).toBe(128);
    expect(read('world-engine-lab.html')).toMatch(/from '\.\/planet-lod-rivers\.js'/);
    expect(read('src/rendering/bake/provinceWorker.js')).toMatch(/import \{ buildProvinceCubeGeometry \} from '\.\/provinceCube\.js'/);
    expect(typeof buildProvinceCubeGeometry).toBe('function');
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-1 — every admitted solid body gets its province from the lab\'s dispatch; gas bodies get none', () => {
  it('the corpus is the appendix\'s shape: 156 bodies, 124 solid / 32 gas, all admitted', () => {
    const admitted = BODIES.filter((b) => b.admit.admitted);
    const solid = admitted.filter((b) => provinceAppliesTo(b.cond)).length, gas = admitted.length - solid;
    // eslint-disable-next-line no-console
    console.info(`[AC-1] corpus ${BODIES.length} bodies, ${admitted.length} admitted, ${solid} solid / ${gas} gas (appendix: 156 · 124 / 32)`);
    expect(BODIES.length).toBeGreaterThan(100);
    expect(admitted.length).toBe(BODIES.length);
    expect(solid).toBeGreaterThan(50);
    expect(gas).toBeGreaterThan(5);
  });

  it('⭐ every admitted solid body: a province array with EVERY node labelled; every admitted gas body: none', () => {
    const mesh = sharedCarrierMesh();
    const paths = {}; let threeClass = 0, twoClass = 0, solid = 0, gas = 0, msSum = 0;
    for (const b of BODIES) {
      if (!b.admit.admitted) continue;
      if (!provinceAppliesTo(b.cond)) { gas++; continue; }
      solid++;
      const r = buildProvinceForBody(bodyOf(b), mesh);
      expect(r.province.length).toBe(mesh.verts.length);
      const f = provinceFractions(r.province);
      expect(f.labelled).toBe(1);                         // every node is 0, 1 or 2
      expect(f.craton + f.orogen + f.basin).toBeCloseTo(1, 12);
      paths[r.relief.path] = (paths[r.relief.path] || 0) + 1;
      if (f.orogen > 0) threeClass++; else twoClass++;
      msSum += r.ms;
      b._prov = r.province; b._path = r.relief.path;
    }
    // eslint-disable-next-line no-console
    console.info(`[AC-1] solid ${solid} (three-class ${threeClass}, two-class ${twoClass}) · gas ${gas} · paths ${JSON.stringify(paths)} · mean dispatch ${(msSum / solid).toFixed(1)} ms/body` +
      ` — appendix 2026-08-28: 124 solid (97 / 27), 32 gas, paths shell 81 / despun 59 / stagnant-lid 11 / volcanic 5`);
    expect(solid).toBeGreaterThan(50);
    expect(gas).toBeGreaterThan(5);
    expect(Object.keys(paths).length).toBeGreaterThanOrEqual(3);
    for (const b of BODIES) if (b._prov && provinceFractions(b._prov).orogen === 0) expect(b._path).toBe('despun');   // appendix (iii), re-derived
  }, 120000);

  it('the array is BYTE-IDENTICAL to writeBodyRelief reached through the lab\'s own import path, same inputs, same mesh', () => {
    const mesh = sharedCarrierMesh();
    let seen = 0, checked = 0;
    for (const b of BODIES) {
      if (!b._prov) continue;
      if ((seen++ % 4) !== 0) continue;
      checked++;
      const carrier = makeSphereField(mesh);
      writeBodyReliefViaLab(carrier, {
        bodyDrivers: bodyDriversFromCondition(b.cond), macroSeed: labMacroSeed(b.d) | 0,
        heightSeed: 'e6:' + (labMacroSeed(b.d) | 0), T_eq: b.cond.T_eq,
      });
      expect(Buffer.from(carrier.province).equals(Buffer.from(b._prov))).toBe(true);
    }
    expect(checked).toBeGreaterThan(10);
  }, 120000);

  it('the bundle carries the four flat keys the lab\'s neutral builder carries, read off the condition', () => {
    const b = BODIES.find((x) => x.admit.admitted && provinceAppliesTo(x.cond));
    const bd = bodyDriversFromCondition(b.cond);
    expect(Object.keys(bd).sort()).toEqual(['condition', 'coreRadiusFraction', 'massGravity', 'thermalState', 'tidalHeating', 'volatileFraction']);
    expect(bd.massGravity).toBe(b.cond.surfaceGravity);
    expect(bd.tidalHeating).toBe(b.cond.rawTidalIoRatio);
    expect(bd.volatileFraction).toBe(b.cond.composition.volatileFraction);
    expect(bd.condition).toBe(b.cond);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-2 — the game\'s mesh is the lab\'s mesh, pinned through the lab\'s own export', () => {
  it('⭐ GAME_MESH === DEFAULT_PARAMS.{TARGET_N, LLOYD_ITERS}, and the shared mesh has that many nodes', () => {
    expect(GAME_MESH).toEqual({ TARGET_N: DEFAULT_PARAMS.TARGET_N, LLOYD_ITERS: DEFAULT_PARAMS.LLOYD_ITERS });
    expect(GAME_MESH).toEqual({ TARGET_N: 40000, LLOYD_ITERS: 4 });
    expect(sharedCarrierMesh().verts.length).toBe(40000);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-5 — bake once on first draw, dispose once, one shared mesh, both transports', () => {
  const PH = { isPlaceholder: true };
  function stubCube() {
    const c = { texture: { isStub: true }, updates: 0, disposes: 0, lastGeo: null, update(g) { c.updates++; c.lastGeo = g; }, dispose() { c.disposes++; } };
    return c;
  }
  const fakeSurface = (mix = 0.65) => ({ material: { uniforms: { uProvinceCube: { value: PH }, uProvinceColorMix: { value: mix } } }, userData: {} });
  const solid = () => BODIES.find((x) => x.admit.admitted && provinceAppliesTo(x.cond));
  const gasBody = () => BODIES.find((x) => x.admit.admitted && !provinceAppliesTo(x.cond));
  const small = () => buildIrregularSphere(300, 1);
  const payloadOf = (built) => {
    const g = buildProvinceCubeGeometry({ mesh: built.mesh, province: built.province });
    return { pos: g.getAttribute('position').array, wgt: g.getAttribute('aProv').array, idx: g.getIndex().array,
      nodes: built.province.length, path: built.relief.path, ms: built.ms, fractions: provinceFractions(built.province) };
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it('headless there is no Worker, so the transport is sync', () => { expect(provinceTransport()).toBe('sync'); });

  it('SYNC: a solid body bakes on the FIRST onBeforeRender, binds the cube, never re-bakes', () => {
    const b = solid(); const s = fakeSurface(); const cubes = []; const m = small();
    const rec = attachProvinceBake(s, bodyOf(b), { createCube: () => { const c = stubCube(); cubes.push(c); return c; }, compute: (body) => buildProvinceForBody(body, m) });
    expect(rec.attached).toBe(true); expect(rec.baked).toBe(false); expect(s.material.uniforms.uProvinceCube.value).toBe(PH);
    s.onBeforeRender({}); s.onBeforeRender({}); s.onBeforeRender({});
    expect(cubes.length).toBe(1); expect(cubes[0].updates).toBe(1); expect(rec.bakes).toBe(1);
    expect(s.material.uniforms.uProvinceCube.value).toBe(cubes[0].texture);
    expect(rec.fractions.labelled).toBe(1); expect(typeof rec.path).toBe('string'); expect(rec.nodes).toBe(m.verts.length);
    expect(provinceRecordOf(s)).toBe(rec);
  });

  it('ASYNC: frame 1 requests, the reply lands, the NEXT drawn frame bakes from the transferred arrays — once', async () => {
    const b = solid(); const s = fakeSurface(); const c = stubCube(); const m = small();
    const rec = attachProvinceBake(s, bodyOf(b), { createCube: () => c, compute: (body) => tick().then(() => payloadOf(buildProvinceForBody(body, m))) });
    s.onBeforeRender({});
    expect(rec.requested).toBe(true); expect(rec.pending).toBe(true); expect(rec.baked).toBe(false); expect(c.updates).toBe(0);
    s.onBeforeRender({});                                  // still pending: nothing happens
    expect(c.updates).toBe(0);
    await tick(); await tick();
    expect(rec.pending).toBe(false); expect(rec.baked).toBe(false);   // reply landed; bake waits for a frame with a renderer
    s.onBeforeRender({}); s.onBeforeRender({});
    expect(c.updates).toBe(1); expect(rec.bakes).toBe(1); expect(rec.transport).toBe('seam');
    expect(c.lastGeo.getAttribute('position').count).toBe(m.verts.length);
    expect(c.lastGeo.getAttribute('aProv').count).toBe(m.verts.length);
    expect(s.material.uniforms.uProvinceCube.value).toBe(c.texture);
  });

  it('ASYNC: a rejected transport falls back to the synchronous dispatch on the next drawn frame', async () => {
    const b = solid(); const s = fakeSurface(); const c = stubCube();
    const rec = attachProvinceBake(s, bodyOf(b), { createCube: () => c, mesh: small(), compute: () => Promise.reject(new Error('boom')) });
    s.onBeforeRender({});
    await tick(); await tick();
    expect(rec.fallback).toBe(true); expect(rec.baked).toBe(false); expect(rec.reason).toMatch(/boom/);
    s.onBeforeRender({});
    expect(rec.baked).toBe(true); expect(rec.transport).toBe('sync'); expect(c.updates).toBe(1);
  });

  it('ASYNC: a reply that lands AFTER dispose is dropped — no bake, no cube, placeholder kept', async () => {
    const b = solid(); const s = fakeSurface(); const c = stubCube(); let resolve;
    const rec = attachProvinceBake(s, bodyOf(b), { createCube: () => c, compute: () => new Promise((r) => { resolve = r; }) });
    s.onBeforeRender({});
    disposeProvinceBake(s);
    resolve(payloadOf(buildProvinceForBody(bodyOf(b), small())));
    await tick(); await tick();
    s.onBeforeRender({});
    expect(rec.disposed).toBe(true); expect(rec.baked).toBe(false); expect(c.updates).toBe(0);
    expect(s.material.uniforms.uProvinceCube.value).toBe(PH);
  });

  it('dispose releases the cube exactly once and restores the placeholder; a second dispose is a no-op', () => {
    const b = solid(); const s = fakeSurface(); const c = stubCube(); const m = small();
    attachProvinceBake(s, bodyOf(b), { createCube: () => c, compute: (body) => buildProvinceForBody(body, m) });
    s.onBeforeRender({});
    expect(s.material.uniforms.uProvinceCube.value).toBe(c.texture);
    disposeProvinceBake(s); disposeProvinceBake(s);
    expect(c.disposes).toBe(1);
    expect(s.material.uniforms.uProvinceCube.value).toBe(PH);
    expect(provinceRecordOf(s).disposes).toBe(1);
  });

  it('a gas body is NOT attached: no hook, placeholder kept, reason recorded', () => {
    const b = gasBody(); const s = fakeSurface();
    const rec = attachProvinceBake(s, bodyOf(b), { createCube: stubCube, mesh: small() });
    expect(rec.attached).toBe(false); expect(rec.applies).toBe(false); expect(rec.reason).toMatch(/gas/);
    expect(s.onBeforeRender).toBeUndefined();
    expect(s.material.uniforms.uProvinceCube.value).toBe(PH);
  });

  it('the shared mesh is built ONCE across bodies (the real sync transport, no seams)', () => {
    _resetSharedMeshForTests();
    expect(meshBuildCount()).toBe(0);
    const [b1, b2] = BODIES.filter((x) => x.admit.admitted && provinceAppliesTo(x.cond));
    const s1 = fakeSurface(), s2 = fakeSurface();
    attachProvinceBake(s1, bodyOf(b1), { createCube: stubCube });
    attachProvinceBake(s2, bodyOf(b2), { createCube: stubCube });
    s1.onBeforeRender({}); s2.onBeforeRender({});
    expect(provinceRecordOf(s1).transport).toBe('sync'); expect(provinceRecordOf(s1).baked).toBe(true); expect(provinceRecordOf(s2).baked).toBe(true);
    expect(meshBuildCount()).toBe(1);
    expect(sharedCarrierMesh().verts.length).toBe(40000);
    disposeProvinceBake(s1); disposeProvinceBake(s2);
  }, 60000);

  it('the A/B flips uProvinceColorMix to 0 on every baked material and restores the live value', () => {
    const b = solid(); const s = fakeSurface(0.65);
    attachProvinceBake(s, bodyOf(b), { createCube: stubCube, compute: (body) => buildProvinceForBody(body, small()) });
    s.onBeforeRender({});
    expect(toggleProvinceAB().off).toBe(true); expect(s.material.uniforms.uProvinceColorMix.value).toBe(0);
    expect(toggleProvinceAB().off).toBe(false); expect(s.material.uniforms.uProvinceColorMix.value).toBe(0.65);
    disposeProvinceBake(s);
  });

  it('⭐ THE REAL MOUNT: Planet._createLabSurface attaches the hook on a solid body and publishes into userData.wd.lab', () => {
    const b = solid();
    const geometry = new THREE.SphereGeometry(b.d.radius || 1, 12, 8);
    const surface = Planet._createLabSurface(geometry, b.d, b.cond, new THREE.Vector3(0.6, 0.3, 0.7).normalize());
    expect(surface).not.toBeNull();
    const rec = surface.userData.wd.lab.province;
    expect(rec && rec.attached).toBe(true);
    expect(surface.onBeforeRender.name).toBe('provinceBakeOnBeforeRender');
    expect(rec.baked).toBe(false);                        // nothing drawn yet — no renderer, no bake
    disposeProvinceBake(surface);                          // no cube yet: a no-op, not a throw
    expect(rec.disposes).toBe(0);
    geometry.dispose(); surface.material.dispose();
  });

  it('⭐ THE REAL MOUNT, gas: no hook is installed on a gas body', () => {
    const b = gasBody();
    const geometry = new THREE.SphereGeometry(b.d.radius || 1, 12, 8);
    const surface = Planet._createLabSurface(geometry, b.d, b.cond, new THREE.Vector3(0.6, 0.3, 0.7).normalize());
    expect(surface).not.toBeNull();
    expect(surface.userData.wd.lab.province.attached).toBe(false);
    expect(surface.onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);
    geometry.dispose(); surface.material.dispose();
  });
});
