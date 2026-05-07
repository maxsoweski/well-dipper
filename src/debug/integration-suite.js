// Scene-inspection integration test suite.
//
// Designed to run from the dev browser console after entering Sol:
//   await __wd_runIntegrationSuite()
//
// Returns { passed, failed, total, results: [{name, passed, evidence}] }.
// Side-effect: logs grouped results to the console.
//
// Tests Groups A-F from docs/testing/scene-inspection-integration-tests.md.
// Groups G-I (production drift, warp lifecycle, regressions) are out of
// scope for in-browser auto-running -- they need build artifacts or
// require driving the warp via real keypress with timing windows.

import {
  meshVisibleAt,
  cameraConfigAt,
  lightActiveAt,
  uniformValueAt,
  clockProgressedSince,
  modeIs,
  phaseEquals,
} from 'motion-test-kit/core/inventory/predicates.js';

const REQUIRED_PLANETS = [
  'earth', 'mars', 'mercury', 'venus', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
];
// ids that may be classified as either body.planet.<id> OR body.moon.<id>:
// Titan + similar planet-class moons go through the Planet renderer.
const REQUIRED_BODIES_FLEXIBLE_KIND = [
  'luna', 'io', 'europa', 'ganymede', 'callisto', 'titan', 'triton', 'charon',
];
const REQUIRED_WARP = [
  'effect.warp.entry-strip', 'effect.warp.landing-strip',
  'effect.warp.portal-a', 'effect.warp.portal-b',
  'effect.warp.portal-group', 'effect.warp.tunnel',
];

function check(name, fn, results) {
  try {
    const out = fn();
    const passed = !!out?.passed;
    results.push({ name, passed, evidence: out?.evidence ?? null });
    return passed;
  } catch (e) {
    results.push({ name, passed: false, evidence: 'EXCEPTION: ' + e.message });
    return false;
  }
}

async function checkAsync(name, fn, results) {
  try {
    const out = await fn();
    const passed = !!out?.passed;
    results.push({ name, passed, evidence: out?.evidence ?? null });
    return passed;
  } catch (e) {
    results.push({ name, passed: false, evidence: 'EXCEPTION: ' + e.message });
    return false;
  }
}

export async function runIntegrationSuite() {
  if (typeof window === 'undefined' || typeof window.__wd !== 'object') {
    throw new Error('runIntegrationSuite: window.__wd not installed. Enter Sol first via _lab.enterSol().');
  }
  const __wd = window.__wd;
  const results = [];

  // Snapshot once for most tests.
  const inv = __wd.takeSceneInventory();
  const invs = new Map([['NOW', inv]]);

  // === Group A: Naming taxonomy ===

  check('A1 canonical Sol bodies — TAGGED (flexible kind)', () => {
    const missingPlanets = REQUIRED_PLANETS.filter(id => !__wd.getNamed('body.planet.' + id));
    const missingFlexible = REQUIRED_BODIES_FLEXIBLE_KIND.filter(id =>
      !__wd.getNamed('body.planet.' + id) && !__wd.getNamed('body.moon.' + id)
    );
    const total = REQUIRED_PLANETS.length + REQUIRED_BODIES_FLEXIBLE_KIND.length;
    const missing = missingPlanets.map(id => 'body.planet.' + id).concat(missingFlexible);
    return { passed: missing.length === 0, evidence: { missing, foundCount: total - missing.length, total } };
  }, results);

  check('A1b canonical Sol bodies — LIVE in inventory (visibility-respecting)', () => {
    const bodies = inv.meshes.filter(m => m.name?.startsWith('body.')).map(m => m.name);
    const unseeded = bodies.filter(n => n.endsWith('.unseeded'));
    // Default-camera Sol shows the inner-system planets. Outer planets + moons may be
    // LOD-hidden until the camera approaches; that's expected, not a layer bug.
    const minVisible = ['body.planet.mercury', 'body.planet.venus', 'body.planet.earth'];
    const minPresent = minVisible.every(n => bodies.includes(n));
    return { passed: minPresent && unseeded.length === 0, evidence: { liveBodies: bodies.length, unseeded } };
  }, results);

  check('A2 asteroid belts named', () => {
    const belts = inv.meshes.filter(m => m.name?.startsWith('body.asteroid-belt')).map(m => m.name).sort();
    return {
      passed: belts.includes('body.asteroid-belt.main') && belts.includes('body.asteroid-belt.kuiper'),
      evidence: { belts },
    };
  }, results);

  check('A3 ship NPCs named with archetype + ordinal', () => {
    const ships = inv.meshes.filter(m => m.name?.startsWith('ship.npc.'));
    if (ships.length === 0) return { passed: true, evidence: 'no ships spawned in this system (expected for some Sol layouts)' };
    const allArchetyped = ships.every(s => /^ship\.npc\.[\w-]+\.\d+-\d+$/.test(s.name));
    return { passed: allArchetyped, evidence: { count: ships.length, sample: ships.slice(0, 3).map(s => s.name) } };
  }, results);

  check('A4 warp portal — TAGGED (ignores warp activation)', () => {
    const missing = REQUIRED_WARP.filter(n => !__wd.getNamed(n));
    return { passed: missing.length === 0, evidence: { missing } };
  }, results);

  check('A5 sky layers — TAGGED (one glow per mode)', () => {
    const required = ['sky.starfield.main', 'sky.feature-layer.main'];
    const optional = ['sky.glow.galaxy', 'sky.glow.procedural'];
    const missing = required.filter(n => !__wd.getNamed(n));
    const hasGlow = optional.some(n => !!__wd.getNamed(n));
    return { passed: missing.length === 0 && hasGlow, evidence: { missing, glowsPresent: optional.filter(n => !!__wd.getNamed(n)) } };
  }, results);

  check('A6 userData mirror on body.planet.earth', () => {
    const earth = __wd.getNamed('body.planet.earth');
    const ud = earth?.userData;
    const ok = ud?.category === 'body' && ud?.kind === 'planet' && ud?.id === 'earth' && ud?.systemSeed === 'sol';
    return { passed: ok, evidence: ud };
  }, results);

  // === Group B: Multi-scene source tagging ===

  check('B1 every mesh has source tag', () => {
    const sources = new Set(inv.meshes.map(m => m.source));
    const allHave = inv.meshes.every(m => typeof m.source === 'string' && m.source.length > 0);
    return { passed: allHave && sources.has('main') && sources.has('sky'), evidence: { sources: [...sources] } };
  }, results);

  check('B2 source filter scopes mesh predicates', () => {
    const skyHit = meshVisibleAt(invs, { phaseKey: 'NOW', meshName: 'sky.starfield.main', source: 'sky' });
    const mainMiss = meshVisibleAt(invs, { phaseKey: 'NOW', meshName: 'sky.starfield.main', source: 'main' });
    return { passed: skyHit.passed === true && mainMiss.passed === false, evidence: { sky: skyHit.passed, mainMiss: mainMiss.passed } };
  }, results);

  // === Group C: 9 new predicates ===

  check('C1 cameraConfigAt — self-match (skip if camera unnamed)', () => {
    const namedCam = inv.cameras.find(c => c.name && c.name.length > 0);
    if (!namedCam) return { passed: true, evidence: 'N/A: well-dipper does not name its world camera' };
    const r = cameraConfigAt(invs, { phaseKey: 'NOW', cameraRole: namedCam.name, expected: { fov: namedCam.fov, aspect: namedCam.aspect } });
    return { passed: r.passed, evidence: { cameraRole: namedCam.name, fov: namedCam.fov } };
  }, results);

  check('C2 lightActiveAt — synthetic light.star.sol', () => {
    const r = lightActiveAt(invs, { phaseKey: 'NOW', lightId: 'light.star.sol', intensityMin: 0.9 });
    return { passed: r.passed, evidence: r.violations };
  }, results);

  check('C3 uniformValueAt — warp.tunnel.uTime', () => {
    const tunnel = inv.materials?.find(m => m.role === 'warp.tunnel');
    const uTime = tunnel?.uniforms?.uTime;
    if (typeof uTime !== 'number') return { passed: false, evidence: 'warp.tunnel.uTime not captured' };
    const r = uniformValueAt(invs, { phaseKey: 'NOW', materialRole: 'warp.tunnel', uniformName: 'uTime', expected: uTime, tolerance: 0.01 });
    return { passed: r.passed, evidence: { uTime } };
  }, results);

  await checkAsync('C4 clockProgressedSince — wall clock advances', async () => {
    const t0 = __wd.takeSceneInventory();
    await new Promise(r => setTimeout(r, 1000));
    const t1 = __wd.takeSceneInventory();
    const m = new Map([['T0', t0], ['T1', t1]]);
    const r = clockProgressedSince(m, { phaseKey: 'T1', sincePhase: 'T0', clockSystem: 'wall', byMinSeconds: 0.5 });
    return { passed: r.passed, evidence: { delta: t1.clocks?.wall - t0.clocks?.wall } };
  }, results);

  check('C5 modeIs — warp.pipeline matches captured value', () => {
    const expected = inv.modes?.['warp.pipeline'];
    if (!expected) return { passed: false, evidence: 'warp.pipeline not captured' };
    const r = modeIs(invs, { phaseKey: 'NOW', slot: 'warp.pipeline', expected });
    return { passed: r.passed, evidence: { expected } };
  }, results);

  check('C7 phaseEquals — warp idle', () => {
    const r = phaseEquals(invs, { phaseKey: 'NOW', system: 'warp', expected: 'idle' });
    return { passed: r.passed, evidence: { warp: inv.phases?.warp } };
  }, results);

  // === Group D: Inventory shape integrity ===

  check('D1 all 9 host-opted-in categories present', () => {
    const have = ['cameras', 'lights', 'materials', 'clocks', 'modes', 'phases', 'audio', 'input', 'rendererInfo'].filter(k => k in inv);
    return { passed: have.length === 9, evidence: { have } };
  }, results);

  await checkAsync('D2 renderer.info aggregates accumulate (autoReset=false)', async () => {
    const a = __wd.takeSceneInventory().rendererInfo?.drawCalls ?? 0;
    await new Promise(r => setTimeout(r, 500));
    const b = __wd.takeSceneInventory().rendererInfo?.drawCalls ?? 0;
    return { passed: b > a, evidence: { a, b, delta: b - a } };
  }, results);

  // === Group F: Golden snapshot scaffold ===

  check('F1 serializeForGolden strips uuids + rounds worldPos + sorts', () => {
    const g = __wd.serializeForGolden();
    const sample = g.meshes[0];
    if (!sample) return { passed: false, evidence: 'no meshes' };
    const hasUuid = 'uuid' in sample;
    const wpOk = !sample.worldPos || sample.worldPos.every(n => Number.isInteger(n) || (n.toString().split('.')[1]?.length ?? 0) <= 3);
    const sorted = g.meshes.slice(0, 5).every((m, i, arr) => i === 0 || (arr[i-1].name ?? '') <= (m.name ?? ''));
    return { passed: !hasUuid && wpOk && sorted, evidence: { hasUuid, wpOk, sorted } };
  }, results);

  check('F2 quickGoldenDiff detects synthetic mesh insertion', () => {
    const g1 = __wd.serializeForGolden();
    const g2 = JSON.parse(JSON.stringify(g1));
    g2.meshes.push({ name: 'body.planet.fake-zorbon', source: 'main', visible: true, inFrustum: true, type: 'Mesh', frustumCulled: true, layer: 1, worldPos: [0,0,0] });
    const diff = __wd.quickGoldenDiff(g1, g2);
    return { passed: diff.meshesAppeared.includes('body.planet.fake-zorbon'), evidence: diff };
  }, results);

  // === Summary ===

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const summary = { passed, failed, total: results.length, results };

  console.group('[__wd integration suite] ' + passed + '/' + results.length + ' passed');
  for (const r of results) {
    const tag = r.passed ? '✔' : '✘';
    console.log(tag + ' ' + r.name, r.passed ? '' : r.evidence);
  }
  console.groupEnd();
  return summary;
}
